#!/usr/bin/env node
/**
 * test/ui.test.mjs —— lemo 控制台 **Web UI 层**测试（第四批新增，独立入口）
 *
 * 为什么单独一个入口：`test/README.md` 里如实写着「Web UI 交互：一条都没测」——
 * 现有 40 条全是服务端的（smoke 28 + setup 12），只保证「服务端发给前端的数据是对的」，
 * 不保证「前端渲染出来是对的」。这个文件补的就是这一段。
 *
 * 用法：
 *   node test/ui.test.mjs                 全部用例
 *   node test/ui.test.mjs --filter 批量    只跑名字里含「批量」的用例
 *   node test/ui.test.mjs --keep-browser   跑完不关无头 Edge（调试用）
 *
 * 三种手段，从弱到强：
 *   1. **无头 Edge --dump-dom**：拿到**执行完 JS 之后**的真实 DOM，断言新元素真的渲染出来了。
 *   2. **CDP（Chrome DevTools Protocol）**：手写一个极小的 WebSocket 客户端（node 无内置 ws），
 *      连上无头 Edge 的调试端口，真的去**点击 / 按键**，再读回 DOM —— 不是「元素在不在」，
 *      而是「点了之后行为对不对」。零依赖，不装 puppeteer。
 *   3. **HTTP**：批量入队的服务端语义（批次字段落盘/回显、ETA 从历史学习）。
 *
 * 安全 / 不干扰用户（沿用 smoke.mjs 的纪律）：
 *   - 测试自己用内核分配的空闲端口起服务，绝不碰用户那个 18080 实例。
 *   - 测试服务会覆写 `.console-port` / `打开控制台.url` —— 跑前按字节备份、跑后逐字节还原。
 *   - 批量入队一律用 `--dry-run --skip-sync`（不渲染、不混流、几秒结束），跑完把测试任务
 *     从 `.console/index.json` 摘掉、日志文件删掉。
 *   - 不用 curl（本机走代理，打 localhost 得到 502）；不用 spawnSync（本环境一律 EBUSY）。
 *   - 临时文件全部在非 C 盘（D:\WSL\b4-ui-*），跑完按**确切路径**递归删除（不用通配符）。
 *
 * 退出码：全绿 0 / 有用例失败 1 / 自身异常 2。
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { CFG } from '../lib/env.mjs';      // 只借常量（tmpDir / exportDir）；顶层无副作用

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const ENTRY_FILES = [path.join(ROOT, '.console-port'), path.join(ROOT, '打开控制台.url')];
const CONSOLE_ROOT = path.join(CFG.exportDir, '.console');
const CONSOLE_LOGS = path.join(CONSOLE_ROOT, 'logs');
const CONSOLE_INDEX = path.join(CONSOLE_ROOT, 'index.json');

// ── 命令行 ──────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OPT = { filter: argOf('--filter') || '', keepBrowser: argv.includes('--keep-browser') };

// ── 输出 ────────────────────────────────────────────────────
const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
  b: (s) => (TTY ? `\x1b[1m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── HTTP（node:http 直连，绕开代理）────────────────────────
function httpRequest(port, method, p, body, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');
    const headers = { Accept: 'application/json', Connection: 'close' };
    if (payload) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      headers['Content-Length'] = payload.length;
    }
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* 不是 JSON 就算了 */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`HTTP 超时（${timeoutMs}ms）：${method} ${p}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

// ── 测试服务 ────────────────────────────────────────────────
function spawnServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.mjs', '--port', String(port)], {
      cwd: ROOT, windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    let out = '';
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.stdout?.removeListener('data', onData);
      child.stderr?.removeListener('data', onData);
      fn(arg);
    };
    const timer = setTimeout(() => finish(reject, new Error(`服务 30s 内没起来\n--- 服务输出 ---\n${out}`)), 30000);
    const onData = (d) => {
      out += d.toString('utf8');
      const m = /http:\/\/127\.0\.0\.1:(\d+)/.exec(out);   // 只认它自己打印的**实际**端口
      if (m) finish(resolve, { child, port: Number(m[1]) });
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', (e) => finish(reject, e));
  });
}

async function startServer(attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await spawnServer(await freePort()); }
    catch (e) { last = e; log(C.dim(`  （第 ${i + 1} 次起服务失败，换端口重试：${String(e.message).split('\n')[0]}）`)); }
  }
  throw last;
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    const t = setTimeout(() => {
      try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* ignore */ }
      resolve();
    }, 6000);
    child.once('exit', () => { clearTimeout(t); resolve(); });
    try { child.kill(); } catch { clearTimeout(t); resolve(); }
  });
}

// ── 无头 Edge ───────────────────────────────────────────────
function findEdge() {
  for (const p of EDGE_CANDIDATES) { try { if (fs.statSync(p).isFile()) return p; } catch { /* 试下一个 */ } }
  return null;
}

let PROFILE_SEQ = 0;
const TMP_ROOTS = new Set();     // 本次跑出来的临时目录（跑完按确切路径递归删）

function freshProfile() {
  const dir = path.join(CFG.tmpDir, `b4-ui-${process.pid}-${Date.now().toString(36)}-${(PROFILE_SEQ += 1)}`);
  fs.mkdirSync(dir, { recursive: true });
  TMP_ROOTS.add(dir);
  return dir;
}

/** 手段 1：无头 Edge --dump-dom —— 拿到**执行完 JS 之后**的真实 DOM。 */
function dumpDom(edge, url, { budgetMs = 9000, timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(edge, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking',
      `--user-data-dir=${freshProfile()}`,
      `--virtual-time-budget=${budgetMs}`,
      '--dump-dom', url,
    ], { windowsHide: true });
    let out = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error(`无头 Edge --dump-dom 超时（${timeoutMs}ms）`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString('utf8'); });
    child.stderr.on('data', () => { /* Edge 往 stderr 打一堆无关 ERROR，丢掉 */ });
    child.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!out.includes('<html')) reject(new Error(`--dump-dom 没拿到 HTML（exit ${code}）：\n${out.slice(0, 500)}`));
      else resolve(out);
    });
  });
}

// ── 手段 2：CDP —— 手写极小 WebSocket 客户端（node 无内置 ws，零依赖）──
function wsConnect(url) {
  const u = new URL(url);
  const key = crypto.randomBytes(16).toString('base64');
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: u.hostname, port: Number(u.port), path: u.pathname + u.search, agent: false,
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13' },
    });
    req.on('upgrade', (_res, socket) => {
      const st = { socket, buf: Buffer.alloc(0), handlers: [], closed: false };
      socket.on('data', (d) => { st.buf = Buffer.concat([st.buf, d]); drainFrames(st); });
      socket.on('close', () => { st.closed = true; });
      socket.on('error', () => { st.closed = true; });
      st.send = (obj) => {
        const payload = Buffer.from(JSON.stringify(obj), 'utf8');
        const mask = crypto.randomBytes(4);
        let head;
        if (payload.length < 126) head = Buffer.from([0x81, 0x80 | payload.length]);
        else if (payload.length < 65536) {
          head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0x80 | 126; head.writeUInt16BE(payload.length, 2);
        } else {
          head = Buffer.alloc(10); head[0] = 0x81; head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(payload.length), 2);
        }
        const masked = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
        socket.write(Buffer.concat([head, mask, masked]));
      };
      st.close = () => { try { socket.end(); } catch { /* ignore */ } };
      resolve(st);
    });
    req.on('error', reject);
    req.end();
  });
}

function drainFrames(st) {
  for (;;) {
    const b = st.buf;
    if (b.length < 2) return;
    const op = b[0] & 0x0f;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (b.length < off + len) return;
    const payload = b.subarray(off, off + len);
    st.buf = b.subarray(off + len);
    if (op === 0x8) { try { st.socket.end(); } catch { /* ignore */ } st.closed = true; return; }
    if (op !== 0x1) continue;                                   // ping/pong/binary 一律忽略
    let msg;
    try { msg = JSON.parse(payload.toString('utf8')); } catch { continue; }
    for (const h of st.handlers) { try { h(msg); } catch { /* 单个回调出错不影响其它 */ } }
  }
}

/** 起一个带调试端口的无头 Edge，返回 { child, cmd, evalJs, goto, close }。 */
async function launchCdp(edge) {
  const dbgPort = await freePort();
  const child = spawn(edge, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking',
    `--remote-debugging-port=${dbgPort}`,
    `--user-data-dir=${freshProfile()}`,
    'about:blank',
  ], { windowsHide: true });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});

  const json = (p, method = 'GET') => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: dbgPort, path: p, method, agent: false }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(new Error(b.slice(0, 200))); } });
    });
    r.on('error', reject);
    r.end();
  });

  let target = null;
  for (let i = 0; i < 60; i++) {
    try {
      target = await json('/json/new?about:blank', 'PUT');
      if (target && target.webSocketDebuggerUrl) break;
    } catch { /* 端口还没起来 */ }
    await sleep(250);
  }
  if (!target || !target.webSocketDebuggerUrl) {
    try { child.kill(); } catch { /* ignore */ }
    throw new Error('无头 Edge 调试端口 15s 内没起来（--remote-debugging-port 不可用？）');
  }

  const ws = await wsConnect(target.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  ws.handlers.push((m) => {
    if (m.id && pending.has(m.id)) { const fn = pending.get(m.id); pending.delete(m.id); fn(m); }
  });
  const cmd = (method, params = {}, timeoutMs = 30000) => new Promise((resolve, reject) => {
    const id = ++seq;
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`CDP ${method} 超时（${timeoutMs}ms）`)); }, timeoutMs);
    pending.set(id, (m) => {
      clearTimeout(t);
      if (m.error) reject(new Error(`CDP ${method} 失败：${JSON.stringify(m.error)}`));
      else resolve(m.result);
    });
    ws.send({ id, method, params });
  });

  await cmd('Runtime.enable');
  await cmd('Page.enable');

  /** 在页面里跑一段表达式，返回**按值**结果（失败抛错，不静默）。 */
  const evalJs = async (expression, { awaitPromise = false } = {}) => {
    const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) {
      throw new Error(`页面内表达式抛错：${r.exceptionDetails.text} ${JSON.stringify(r.exceptionDetails.exception?.description || '')}`);
    }
    return r.result ? r.result.value : undefined;
  };

  const goto = async (url, waitMs = 2500) => {
    await cmd('Page.navigate', { url });
    await sleep(waitMs);
  };

  const close = async () => {
    try { ws.close(); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
  };

  return { child, cmd, evalJs, goto, close };
}

/** 轮询等一个页面内条件成立。 */
async function waitFor(evalJs, expression, { timeoutMs = 20000, intervalMs = 250 } = {}) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeoutMs) {
    last = await evalJs(expression);
    if (last) return last;
    await sleep(intervalMs);
  }
  throw new Error(`等待条件超时（${timeoutMs}ms）：${expression}（最后一次 = ${JSON.stringify(last)}）`);
}

// ── 测试产物清理（只动登记过的东西）────────────────────────
const JOB_IDS = new Set();

function cleanupJobs() {
  const rep = { removed: [], errors: [] };
  if (!JOB_IDS.size) return rep;
  for (const id of JOB_IDS) {
    try { fs.unlinkSync(path.join(CONSOLE_LOGS, `${id}.jsonl`)); } catch { /* 没有就算了 */ }
  }
  try {
    const obj = JSON.parse(fs.readFileSync(CONSOLE_INDEX, 'utf8'));
    const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.jobs) ? obj.jobs : null);
    if (arr) {
      const kept = arr.filter((m) => m && !JOB_IDS.has(m.id));
      if (kept.length !== arr.length) {
        const out = Array.isArray(obj) ? kept : { ...obj, jobs: kept };
        const tmp = `${CONSOLE_INDEX}.b4ui-tmp`;
        fs.writeFileSync(tmp, JSON.stringify(out), 'utf8');
        fs.renameSync(tmp, CONSOLE_INDEX);
      }
      rep.removed.push(...JOB_IDS);
    }
  } catch (e) {
    rep.errors.push(`从 index.json 摘除测试任务失败：${e.message}`);
  }
  JOB_IDS.clear();
  return rep;
}

function cleanupTmpDirs() {
  const errors = [];
  for (const dir of TMP_ROOTS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); }
    catch (e) { errors.push(`${dir}：${e.message}`); }
  }
  TMP_ROOTS.clear();
  return errors;
}

// ── 颜色对比度（浅色主题可读性的**客观**判据）──────────────
// ★ 为什么要有它：「浅色主题下文字必须可读」是这类改动最容易做砸的地方，而「我看着还行」
//   不是判据。这里直接从 style.css 里把两套调色板读出来，按 WCAG 2.1 的相对亮度公式算
//   对比度 —— 纯计算，不依赖任何浏览器。
function parseVars(css, sel) {
  const i = css.indexOf(sel);
  if (i < 0) return null;
  const j = css.indexOf('{', i);
  const k = css.indexOf('}', j);
  if (j < 0 || k < 0) return null;
  const out = {};
  for (const m of css.slice(j + 1, k).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}
const toRgb = (h) => {
  let s = String(h).replace('#', '').trim();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) throw new Error(`不是 6 位十六进制色：${h}`);
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const relLum = (rgb) => {
  const s = rgb.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
function contrast(a, b) {
  const l1 = relLum(toRgb(a));
  const l2 = relLum(toRgb(b));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
/** rgba(...) 叠在纯色底上 → 实际显示出来的颜色（搜索命中 / 选中预设这类半透明底要用）。 */
function blendRgba(rgba, bgHex) {
  const m = /rgba?\(([^)]+)\)/.exec(rgba);
  if (!m) return rgba;
  const p = m[1].split(',').map((s) => parseFloat(s));
  const b = toRgb(bgHex);
  const hex = '#' + p.slice(0, 3).map((v, i) => Math.round(v * (p[3] ?? 1) + b[i] * (1 - (p[3] ?? 1))).toString(16).padStart(2, '0')).join('');
  return hex;
}

/** 需要达标的「前景 on 背景」组合。4.5 = WCAG AA 正文；3.0 = 大字号/非文本图形。 */
function contrastPairs(v) {
  return [
    ['正文 --fg on --bg', v.fg, v.bg, 4.5],
    ['正文 --fg on --panel', v.fg, v.panel, 4.5],
    ['正文 --fg on --bg-2', v.fg, v['bg-2'], 4.5],
    ['正文 --fg on --bg-3', v.fg, v['bg-3'], 4.5],
    ['次要 --fg-dim on --bg', v['fg-dim'], v.bg, 4.5],
    ['次要 --fg-dim on --panel', v['fg-dim'], v.panel, 4.5],
    ['弱化 --fg-faint on --bg', v['fg-faint'], v.bg, 4.5],
    ['弱化 --fg-faint on --bg-2', v['fg-faint'], v['bg-2'], 4.5],
    ['日志正文 --fg on --log-bg', v.fg, v['log-bg'], 4.5],
    ['stderr --log-stderr on --log-bg', v['log-stderr'], v['log-bg'], 4.5],
    ['markdown 标题 --fg-strong on --panel', v['fg-strong'], v.panel, 4.5],
    ['链接/强调 --accent on --panel', v.accent, v.panel, 4.5],
    ['成功 --ok on --panel', v.ok, v.panel, 4.5],
    ['告警 --warn on --panel', v.warn, v.panel, 4.5],
    ['错误 --err on --panel', v.err, v.panel, 4.5],
    ['toast 错误 --toast-err on --bg-3', v['toast-err'], v['bg-3'], 4.5],
    ['搜索命中 --hit-fg on 混合命中底', v['hit-fg'], blendRgba(v['hit-bg'], v.panel), 4.5],
    ['选中预设 --preset-fg on 混合选中底', v['preset-fg'], blendRgba('rgba(76,154,255,.16)', v.panel), 4.5],
  ];
}

// ── 用例 ────────────────────────────────────────────────────
const results = [];
const notes = [];

async function runCase(name, fn) {
  if (OPT.filter && !name.includes(OPT.filter)) return;
  const t0 = Date.now();
  try {
    const r = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    log(`  ${C.ok('PASS')}  ${name} ${C.dim(`(${Date.now() - t0}ms)`)}`);
    return r;
  } catch (e) {
    const ms = Date.now() - t0;
    results.push({ name, ok: false, ms, err: e });
    log(`  ${C.bad('FAIL')}  ${name} ${C.dim(`(${ms}ms)`)}`);
    for (const line of String((e && e.message) || e).split('\n')) log(`        ${line}`);
    return null;
  }
}

function need(v, msg) {
  if (!v) throw new Error(msg);
}

async function main() {
  const t0 = Date.now();
  const edge = findEdge();

  log('');
  log(C.b('lemo 控制台 · Web UI 层测试（第四批）'));
  log(C.dim(`  项目   ${ROOT}`));
  log(C.dim(`  浏览器 ${edge || '（找不到 msedge.exe）'}`));
  log(C.dim(`  模式   ${OPT.filter ? `filter="${OPT.filter}"` : '全部'}`));
  log('');

  if (!edge) {
    log(C.bad('  ✗ 找不到无头 Edge（msedge.exe），UI 层测试无法进行。'));
    log(C.dim('    期望路径：' + EDGE_CANDIDATES.join(' 或 ')));
    process.exitCode = 2;
    return;
  }

  // ── 备份固定入口（测试服务会覆写）──
  const backup = new Map();
  for (const f of ENTRY_FILES) { try { backup.set(f, fs.readFileSync(f)); } catch { backup.set(f, null); } }

  let server = null;
  let cdp = null;
  const state = {};

  try {
    server = await startServer();
    log(C.dim(`  测试服务已起 → http://127.0.0.1:${server.port}  (pid ${server.child.pid})`));
    const base = `http://127.0.0.1:${server.port}`;
    const get = (p) => httpRequest(server.port, 'GET', p);
    const post = (p, b) => httpRequest(server.port, 'POST', p, b);

    // 拿真实风格清单（数量断言不写死 43 —— 那会让「风格目录变了」误报成 UI 坏了）
    const demos = await get('/api/demos');
    need(demos.status === 200, `GET /api/demos → ${demos.status}`);
    const styleCount = demos.json.styles.length;
    state.slugA = demos.json.styles[0].slug;
    state.slugB = demos.json.styles[1].slug;
    state.styleCount = styleCount;
    state.base = base;
    state.get = get;
    state.post = post;
    log(C.dim(`  风格 ${styleCount} 个；本用例用 ${state.slugA} / ${state.slugB}`));

    // ══ A. 渲染后 DOM（--dump-dom）══════════════════════════
    log('');
    log(C.b('  A. 渲染后 DOM（无头 Edge --dump-dom）'));

    await runCase('A1 页面渲染完成：DOM 里拿到真实风格列表（JS 跑过了）', async () => {
      const dom = await dumpDom(edge, base + '/');
      state.dom = dom;
      const items = (dom.match(/class="style-item"/g) || []).length;
      need(items === styleCount, `渲染出的 .style-item 有 ${items} 个，期望 ${styleCount} 个 —— app.js 可能没跑完或渲染坏了`);
      notes.push(`A1 --dump-dom 长度 ${dom.length} 字节，.style-item × ${items}`);
      return dom;
    });

    await runCase('A2 批量入队 UI 存在：多选框 ×N + 已选计数 + 批量入队按钮', async () => {
      const dom = state.dom;
      need(/id="sideBatch"/.test(dom), 'DOM 里没有 #sideBatch（批量工具条没渲染）');
      need(/id="batchCount"/.test(dom), 'DOM 里没有 #batchCount（已选数量不可见）');
      need(/id="btnBatchQueue"/.test(dom), 'DOM 里没有 #btnBatchQueue（批量入队按钮）');
      need(/id="btnBatchClear"/.test(dom), 'DOM 里没有 #btnBatchClear（清空按钮）');
      const checks = (dom.match(/class="si-check"/g) || []).length;
      need(checks === styleCount, `风格条目上的复选框有 ${checks} 个，期望 ${styleCount} 个（每个风格一个）`);
      need(/已选 0 个/.test(dom), '初始的「已选 0 个」没渲染出来');
      // 初始必须禁用（没选任何东西时不该能点）
      const m = /<button[^>]*id="btnBatchQueue"[^>]*>/.exec(dom);
      need(m, '找不到 #btnBatchQueue 的标签');
      need(/\bdisabled\b/.test(m[0]), `初始状态 #btnBatchQueue 应该是 disabled，实际标签：${m[0]}`);
      notes.push(`A2 复选框 ${checks} 个（= 风格数）；#btnBatchQueue 初始 disabled`);
    });

    await runCase('A3 批量确认弹层与快捷键面板已渲染（含批次标记样式）', async () => {
      const dom = state.dom;
      need(/id="batchModal"/.test(dom), 'DOM 里没有 #batchModal（批量确认弹层）');
      need(/id="batchBody"/.test(dom), 'DOM 里没有 #batchBody');
      need(/id="batchFoot"/.test(dom), 'DOM 里没有 #batchFoot');
      need(/id="helpModal"/.test(dom), 'DOM 里没有 #helpModal（快捷键面板）');
      need(/id="btnHelp"/.test(dom), '顶栏没有「?」按钮（快捷键入口必须可发现）');
      need(/id="btnHelp2"/.test(dom), '表单下方没有「全部快捷键」按钮');
      need(/class="kbd-hint"/.test(dom), '没有常驻的快捷键提示行');
      need(/<kbd>Ctrl<\/kbd>/.test(dom) && /<kbd>Enter<\/kbd>/.test(dom), '快捷键提示里没有 Ctrl+Enter');
      notes.push('A3 #batchModal / #helpModal / .kbd-hint 均在渲染后的 DOM 里');
    });

    await runCase('A4 ETA 与主题：进度条上有「预计还需」位、默认仍是深色', async () => {
      const dom = state.dom;
      need(/id="progEta"/.test(dom), 'DOM 里没有 #progEta（预计剩余时间的挂载点）');
      need(/id="btnTheme"/.test(dom), 'DOM 里没有 #btnTheme（主题切换按钮）');
      const html = /<html[^>]*>/.exec(dom);
      need(html, 'DOM 里没有 <html> 标签');
      need(/data-theme="dark"/.test(html[0]), `<html> 上应该是 data-theme="dark"（默认深色），实际：${html[0]}`);
      // ETA 挂载点初始必须是空的 —— 没有历史时不许显示任何数字（不瞎猜）
      const eta = /<span class="progress-eta"[^>]*id="progEta"[^>]*>([\s\S]*?)<\/span>/.exec(dom)
        || /<span[^>]*id="progEta"[^>]*>([\s\S]*?)<\/span>/.exec(dom);
      need(eta, '解析不出 #progEta 的内容');
      need(eta[1].trim() === '', `初始 #progEta 应该是空的（无历史不显示），实际是「${eta[1].trim()}」`);
      notes.push('A4 #progEta 初始为空（不瞎猜）；<html data-theme="dark"> 默认深色');
    });

    await runCase('A5 浅色主题的文字对比度全部过 WCAG AA（默认深色不受影响）', async () => {
      const css = fs.readFileSync(path.join(ROOT, 'web', 'style.css'), 'utf8');
      const dark = parseVars(css, ':root {');
      const light = parseVars(css, 'html[data-theme="light"] {');
      need(dark, 'style.css 里找不到 :root 调色板');
      need(light, 'style.css 里找不到 html[data-theme="light"] 调色板');
      // 浅色必须覆盖所有被用到的颜色变量，漏一个就会「浅色下某个地方还是深色底」
      const missing = Object.keys(dark).filter((k) => /^(bg|fg|line|panel|accent|ok|warn|err|log|hl|hit|preset|player|toast|tint|overlay)/.test(k) && !(k in light));
      need(missing.length === 0, `浅色主题没有覆盖这些颜色变量：${missing.join(', ')}`);

      const rows = [];
      const bad = [];
      for (const [label, f, b, min] of contrastPairs(light)) {
        const r = contrast(f, b);
        rows.push(`${label} = ${r.toFixed(2)}`);
        if (r < min) bad.push(`${label}：${r.toFixed(2)} < ${min}`);
      }
      state.contrastRows = rows;
      need(bad.length === 0, `浅色主题下这些文字对比度不达标（WCAG AA）：\n  ${bad.join('\n  ')}`);
      // 深色是默认主题，只记录不设卡（改动前就在用的那套，本批没有改它的取值）
      const darkRows = contrastPairs(dark).map(([label, f, b]) => `${label} = ${contrast(f, b).toFixed(2)}`);
      notes.push(`A5 浅色对比度（共 ${rows.length} 项，全部 ≥ 4.5）最低三项：`
        + rows.slice().sort((a, b) => parseFloat(a.split('= ')[1]) - parseFloat(b.split('= ')[1])).slice(0, 3).join('；'));
      notes.push(`A5 深色对比度（对照，未改动）：最低三项 `
        + darkRows.slice().sort((a, b) => parseFloat(a.split('= ')[1]) - parseFloat(b.split('= ')[1])).slice(0, 3).join('；'));
    });

    await runCase('A6 回归锚点：前三批的 UI 元素仍在（进度条/预设/空状态/复制/分组/侧栏/排序）', async () => {
      const dom = state.dom;
      const anchors = [
        ['id="progress"', '步骤进度条'],
        ['id="progFill"', '进度条填充'],
        ['id="logEmpty"', '日志空状态'],
        ['id="btnCopyCmd"', '命令预览复制按钮'],
        ['id="detailDrawer"', '风格详情侧栏'],
        ['id="filmSort"', '成片排序下拉'],
        ['id="filmSearch"', '成片筛选'],
        ['id="setupCard"', '首次运行向导卡片'],
        ['id="lockWarn"', '并发预检提示位'],
        ['id="envbar"', '环境状态条'],
        ['class="style-group"', '9 大类分组'],
        ['data-preset="quick"', '预设按钮'],
        ['id="autoScroll"', '日志自动滚底'],
      ];
      const miss = anchors.filter(([t]) => !dom.includes(t)).map(([, n]) => n);
      need(miss.length === 0, `以下前三批的元素在渲染后的 DOM 里找不到了（可能被本批改动破坏）：${miss.join('、')}`);
      notes.push(`A6 ${anchors.length} 个前三批锚点全部仍在`);
    });

    // ══ B. 真实交互（CDP）══════════════════════════════════
    log('');
    log(C.b('  B. 真实交互（CDP：真的点击 / 按键）'));

    cdp = await launchCdp(edge);
    await runCase('B0 连上无头 Edge 并打开控制台', async () => {
      await cdp.goto(base + '/', 3500);
      const n = await waitFor(cdp.evalJs, `document.querySelectorAll('.style-item').length || 0`);
      need(n === styleCount, `打开页面后只渲染出 ${n} 个风格条目，期望 ${styleCount}`);
      notes.push(`B0 CDP 连上，页面渲染出 ${n} 个风格条目`);
    });

    await runCase('B1 勾选两个风格 → 「已选 2 个」可见、批量按钮解禁', async () => {
      await cdp.evalJs(`document.querySelectorAll('.si-check')[0].click();
                        document.querySelectorAll('.si-check')[1].click();`);
      const txt = await cdp.evalJs(`document.getElementById('batchCount').textContent`);
      need(txt === '已选 2 个', `#batchCount 文本是「${txt}」，期望「已选 2 个」`);
      const dis = await cdp.evalJs(`document.getElementById('btnBatchQueue').disabled`);
      need(dis === false, '#btnBatchQueue 勾选后仍然 disabled');
      const has = await cdp.evalJs(`document.getElementById('batchCount').classList.contains('has')`);
      need(has === true, '#batchCount 勾选后没有 .has 高亮类');
      // ★ 列表是按 9 大类分组渲染的，DOM 顺序 ≠ state.styles 顺序 —— 勾到哪两个要**从 DOM 读**，
      //   不能假设是 styles[0]/styles[1]（早先这么写会误报）。
      const picked = await cdp.evalJs(`[...document.querySelectorAll('.si-check')].filter(c=>c.checked).map(c=>c.dataset.slug)`);
      need(Array.isArray(picked) && picked.length === 2, `DOM 里勾上的复选框是 ${JSON.stringify(picked)}，期望 2 个`);
      state.picked = picked;
      notes.push(`B1 点击 2 个复选框 → 「已选 2 个」，按钮解禁；勾到的是 ${picked.join(' / ')}`);
    });

    await runCase('B2 点「批量入队」→ 确认弹层出现，列出将按顺序跑的 N 个 + 预计耗时', async () => {
      await cdp.evalJs(`document.getElementById('btnBatchQueue').click()`);
      await waitFor(cdp.evalJs, `!document.getElementById('batchModal').hidden`, { timeoutMs: 15000 });
      await waitFor(cdp.evalJs,
        `document.getElementById('batchBody').textContent.includes('将按顺序跑')`, { timeoutMs: 15000 });
      const body = await cdp.evalJs(`document.getElementById('batchBody').textContent`);
      need(body.includes('将按顺序跑 2 个'), `弹层正文没写「将按顺序跑 2 个」：\n${body}`);
      for (const s of state.picked) need(body.includes(s), `弹层没有列出勾选的风格 ${s}：\n${body}`);
      need(body.includes('预计总耗时'), `弹层没有「预计总耗时」：\n${body}`);
      const rows = await cdp.evalJs(`[...document.querySelectorAll('#batchBody .batch-row')].map(r=>r.querySelector('.bslug').textContent)`);
      need(rows.length === 2, `弹层里的 .batch-row 有 ${rows.length} 行，期望 2 行`);
      need(JSON.stringify(rows) === JSON.stringify(state.picked),
        `弹层里列出的顺序/内容 ${JSON.stringify(rows)} 与勾选的 ${JSON.stringify(state.picked)} 不一致`);
      const foot = await cdp.evalJs(`document.getElementById('batchFoot').textContent`);
      need(foot.includes('取消'), `弹层底部没有「取消」按钮，实际：${foot}`);
      need(foot.includes('入队'), `弹层底部没有入队按钮，实际：${foot}`);
      notes.push(`B2 弹层正文（截断 200 字）：${body.replace(/\s+/g, ' ').slice(0, 200)}`);
      notes.push(`B2 弹层底部：${foot.replace(/\s+/g, ' ').slice(0, 120)}`);
    });

    await runCase('B3 Esc 关闭弹层（不是只能点关闭按钮）', async () => {
      await cdp.evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
      await waitFor(cdp.evalJs, `document.getElementById('batchModal').hidden === true`, { timeoutMs: 5000 });
      notes.push('B3 Esc 关掉了 #batchModal');
    });

    await runCase('B4 Ctrl+K 聚焦风格搜索框；「/」在输入框里不抢焦点', async () => {
      await cdp.evalJs(`document.getElementById('fSlug').focus()`);
      await cdp.evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))`);
      const active = await cdp.evalJs(`document.activeElement && document.activeElement.id`);
      need(active === 'search', `Ctrl+K 之后焦点在「${active}」，期望「search」`);

      // 焦点在输入框里时按 `/` 不应该被抢走。
      // ★ 真实按键的事件目标是**聚焦元素**，所以这里 dispatch 到 activeElement 上（而不是 document）
      //   —— dispatch 到 document 的话 e.target 是 document，测的就不是真实路径了。
      await cdp.evalJs(`document.getElementById('search').value=''; document.getElementById('fSlug').focus();`);
      await cdp.evalJs(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true}))`);
      const active2 = await cdp.evalJs(`document.activeElement && document.activeElement.id`);
      need(active2 === 'fSlug', `在输入框里按 / 之后焦点跑到了「${active2}」，期望仍留在「fSlug」`);
      // 反过来：焦点不在输入框时按 `/` 应该聚焦搜索框
      await cdp.evalJs(`document.activeElement.blur(); document.body.focus();`);
      await cdp.evalJs(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true}))`);
      const active3 = await cdp.evalJs(`document.activeElement && document.activeElement.id`);
      need(active3 === 'search', `不在输入框时按 / 之后焦点在「${active3}」，期望「search」`);
      notes.push('B4 Ctrl+K → #search 聚焦；输入框内按 / 不抢焦点；非输入态按 / 会聚焦搜索框');
    });

    await runCase('B5 「?」按钮打开快捷键面板，Esc 关闭（可发现入口真的能用）', async () => {
      await cdp.evalJs(`document.getElementById('btnHelp').click()`);
      await waitFor(cdp.evalJs, `!document.getElementById('helpModal').hidden`, { timeoutMs: 5000 });
      const txt = await cdp.evalJs(`document.getElementById('helpModal').textContent`);
      for (const k of ['Ctrl', 'Enter', 'K', 'Esc']) need(txt.includes(k), `快捷键面板里没提到 ${k}：${txt}`);
      await cdp.evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
      await waitFor(cdp.evalJs, `document.getElementById('helpModal').hidden === true`, { timeoutMs: 5000 });
      notes.push('B5 #btnHelp → 面板打开（含 Ctrl/Enter/K/Esc）；Esc 关闭');
    });

    await runCase('B6 主题切换：点一下变浅色并写进 localStorage，再点回深色', async () => {
      const before = await cdp.evalJs(`document.documentElement.dataset.theme`);
      need(before === 'dark', `初始主题是「${before}」，期望 dark（默认必须深色）`);
      await cdp.evalJs(`document.getElementById('btnTheme').click()`);
      const t1 = await cdp.evalJs(`document.documentElement.dataset.theme`);
      need(t1 === 'light', `点主题按钮后 data-theme=「${t1}」，期望 light`);
      const ls = await cdp.evalJs(`localStorage.getItem('lemo-console-theme')`);
      need(ls === 'light', `localStorage 里存的是「${ls}」，期望 light`);
      const label = await cdp.evalJs(`document.getElementById('btnTheme').textContent`);
      need(label === '深色', `浅色下按钮文案是「${label}」，期望「深色」`);
      await cdp.evalJs(`document.getElementById('btnTheme').click()`);
      const t2 = await cdp.evalJs(`document.documentElement.dataset.theme`);
      need(t2 === 'dark', `再点一次后 data-theme=「${t2}」，期望 dark`);
      const ls2 = await cdp.evalJs(`localStorage.getItem('lemo-console-theme')`);
      need(ls2 === 'dark', `localStorage 里存的是「${ls2}」，期望 dark`);
      notes.push('B6 dark → light（localStorage=light）→ dark（localStorage=dark）');
    });

    await runCase('B7 走完整批量入队：勾 2 个 + 试跑 → 确认 → 真的入队 2 条并带同一批次标记', async () => {
      // 用 --dry-run --skip-sync：几秒结束，不渲染、不混流（与 smoke.mjs 同一套纪律）
      await cdp.evalJs(`
        document.getElementById('fDryRun').checked = true;
        document.getElementById('fSkipSync').checked = true;
        for (const b of document.querySelectorAll('.si-check')) b.checked = false;
        document.getElementById('btnBatchClear').click();
      `);
      await cdp.evalJs(`document.querySelectorAll('.si-check')[0].click();
                        document.querySelectorAll('.si-check')[1].click();`);
      await cdp.evalJs(`document.getElementById('btnBatchQueue').click()`);
      await waitFor(cdp.evalJs,
        `document.getElementById('batchBody').textContent.includes('将按顺序跑 2 个')`, { timeoutMs: 15000 });

      const bodyTxt = await cdp.evalJs(`document.getElementById('batchBody').textContent`);
      need(/--dry-run/.test(bodyTxt), `弹层没回显 --dry-run 参数：${bodyTxt.slice(0, 200)}`);

      // 被并发锁占用时按钮 id 会变成 btnBatchGoRisk —— 两个都认
      await cdp.evalJs(`(document.getElementById('btnBatchGo')||document.getElementById('btnBatchGoRisk')).click()`);
      await waitFor(cdp.evalJs, `document.getElementById('batchModal').hidden === true`, { timeoutMs: 20000 });
      await waitFor(cdp.evalJs, `document.getElementById('batchCount').textContent === '已选 0 个'`, { timeoutMs: 20000 });

      // 服务端核实：真的进了 2 条、同一个 batchId、序号 1/2
      let batch = [];
      const t0 = Date.now();
      while (Date.now() - t0 < 20000) {
        const r = await get('/api/jobs');
        batch = (r.json.jobs || []).filter((j) => j.batchId);
        if (batch.length >= 2) break;
        await sleep(300);
      }
      need(batch.length === 2, `服务端只看到 ${batch.length} 条带批次标记的任务，期望 2 条`);
      const [a, b] = batch.slice().sort((x, y) => x.batchIndex - y.batchIndex);
      need(a.batchId === b.batchId, `两条任务的 batchId 不同：${a.batchId} / ${b.batchId}`);
      need(a.batchIndex === 1 && b.batchIndex === 2, `批次序号是 ${a.batchIndex}/${b.batchIndex}，期望 1/2`);
      need(a.batchTotal === 2 && b.batchTotal === 2, `批次总数是 ${a.batchTotal}/${b.batchTotal}，期望 2`);
      for (const j of batch) JOB_IDS.add(j.id);
      state.batchId = a.batchId;
      state.batchSlugs = batch.map((j) => j.slug);
      notes.push(`B7 入队 2 条：${batch.map((j) => `${j.slug}(${j.batchIndex}/${j.batchTotal})`).join(' ')} · batchId=${a.batchId}`);

      // 任务列表 DOM 里也要能看到批次标记（不是只有接口里有）
      await cdp.evalJs(`document.getElementById('btnRefreshJobs').click()`);
      await waitFor(cdp.evalJs, `document.querySelectorAll('#jobs .jbatch').length >= 2`, { timeoutMs: 15000 });
      const badges = await cdp.evalJs(`[...document.querySelectorAll('#jobs .jbatch')].map(n=>n.textContent)`);
      need(badges.every((t) => /^批 \d+\/2$/.test(t)), `任务列表里的批次标记长这样：${JSON.stringify(badges)}，期望「批 N/2」`);
      notes.push(`B7 任务列表批次标记：${badges.join(' / ')}`);
    });

    await runCase('B8 Ctrl+Enter 真的能启动任务（不是只绑了个监听器）', async () => {
      const before = (await get('/api/jobs')).json.jobs.length;
      await cdp.evalJs(`
        document.getElementById('fSlug').value = ${JSON.stringify(state.slugB)};
        document.getElementById('fDryRun').checked = true;
        document.getElementById('fSkipSync').checked = true;
        document.getElementById('fSlug').focus();
      `);
      await cdp.evalJs(`document.activeElement.dispatchEvent(
        new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true}))`);

      let job = null;
      const t0 = Date.now();
      while (Date.now() - t0 < 20000) {
        const r = await get('/api/jobs');
        const list = r.json.jobs || [];
        if (list.length > before) { job = list[0]; break; }
        await sleep(300);
      }
      need(job, `按下 Ctrl+Enter 后 20s 内 /api/jobs 没有多出任务（任务数一直是 ${before}）`);
      need(job.slug === state.slugB, `Ctrl+Enter 启动的是 ${job.slug}，期望 ${state.slugB}`);
      need(job.batchId === null, `Ctrl+Enter 启动的任务不该带批次标记，实际 batchId=${job.batchId}`);
      JOB_IDS.add(job.id);
      notes.push(`B8 Ctrl+Enter 启动了 ${job.slug}（${job.id}，opts=${JSON.stringify(job.opts)}）`);
    });

    // ══ C. 服务端语义（HTTP）════════════════════════════════
    log('');
    log(C.b('  C. 服务端语义（HTTP：批次字段 / ETA 从历史学习）'));

    await runCase('C1 POST /api/run 的批次参数校验（非法 batchId / batchIndex>batchTotal → 400）', async () => {
      const bad1 = await post('/api/run', { slug: state.slugA, opts: [], batchId: 'bad id!', batchIndex: 1, batchTotal: 2 });
      need(bad1.status === 400, `非法 batchId 应 400，实际 ${bad1.status}：${bad1.text.slice(0, 120)}`);
      const bad2 = await post('/api/run', { slug: state.slugA, opts: [], batchId: 'okid', batchIndex: 5, batchTotal: 2 });
      need(bad2.status === 400, `batchIndex > batchTotal 应 400，实际 ${bad2.status}：${bad2.text.slice(0, 120)}`);
      const bad3 = await post('/api/run', { slug: state.slugA, opts: [], batchId: 'okid', batchIndex: 0, batchTotal: 2 });
      need(bad3.status === 400, `batchIndex=0 应 400，实际 ${bad3.status}`);
      // 不带 batchId 的老用法必须照旧 200（不能破坏前几批的行为）
      const ok = await post('/api/run', { slug: state.slugA, opts: ['--dry-run', '--skip-sync'] });
      need(ok.status === 200, `不带 batchId 的普通入队应 200，实际 ${ok.status}：${ok.text.slice(0, 120)}`);
      need(ok.json.job.batchId === null, `普通任务的 batchId 应为 null，实际 ${JSON.stringify(ok.json.job.batchId)}`);
      JOB_IDS.add(ok.json.job.id);
      notes.push(`C1 三种非法批次参数均 400；无 batchId 的老用法仍 200（batchId=null）`);
    });

    await runCase('C2 两条批量任务跑到终态，且 /api/jobs 回显批次字段与 ETA 字段', async () => {
      const ids = [...JOB_IDS];
      need(ids.length >= 2, `登记的任务 id 只有 ${ids.length} 个`);
      const t0 = Date.now();
      let batch = [];
      while (Date.now() - t0 < 120000) {
        const r = await get('/api/jobs');
        const all = r.json.jobs || [];
        batch = all.filter((j) => JOB_IDS.has(j.id));
        if (batch.length >= ids.length && batch.every((j) => ['done', 'failed', 'canceled'].includes(j.status))) break;
        await sleep(800);
      }
      const byId = new Map(batch.map((j) => [j.id, j]));
      const missing = ids.filter((id) => !byId.has(id));
      need(missing.length === 0, `这些任务在 /api/jobs 里查不到：${missing.join(', ')}`);
      const notDone = ids.filter((id) => byId.get(id).status !== 'done');
      const detail = ids.map((id) => `${byId.get(id).slug}:${byId.get(id).status}/exit=${byId.get(id).exitCode}`).join(' ');
      need(notDone.length === 0, `dry-run 任务没跑成 done：${detail}`);
      // ETA 字段存在（dry-run 秒级结束，已结束的任务 eta 为 null 是设计如此）
      for (const id of ids) need('eta' in byId.get(id), `任务 ${id} 的 summary 里没有 eta 字段`);
      notes.push(`C2 ${detail}（耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s）`);
    });

    await runCase('C3 ETA 真的从历史学习：跑一次之后样本 +1；换参数不混用别的样本', async () => {
      // ★ 不能假设「某个 slug 从没跑过」—— 用户的历史就在 index.json 里，测试服务启动时会读回来。
      //   所以先**问一遍所有 slug**，挑样本最少的那个来验。
      const all = demos.json.styles.map((s) => s.slug);
      const q = all.map((s) => 'slug=' + encodeURIComponent(s)).join('&') + '&opt=--dry-run&opt=--skip-sync';
      const r0 = await get('/api/eta?' + q);
      need(r0.status === 200, `GET /api/eta（批量问）→ ${r0.status}`);
      need(r0.json.items.length === all.length, `批量问应返回 ${all.length} 条，实际 ${r0.json.items.length}`);
      need(r0.json.phaseKey === '--dry-run --skip-sync', `分组键应为「--dry-run --skip-sync」，实际「${r0.json.phaseKey}」`);

      const pick = r0.json.items.slice().sort((a, b) => a.n - b.n)[0];
      const S = pick.slug;
      const n0 = pick.n;
      if (n0 === 0) {
        need(pick.confidence === 'none', `没跑过的 ${S} 应该是 confidence=none，实际 ${pick.confidence}`);
        need(pick.medianMs === null, `无历史时 medianMs 必须是 null（不许瞎猜），实际 ${pick.medianMs}`);
      }

      // 真的跑它一次（dry-run，几秒）→ 再问 → 样本必须 +1
      const run = await post('/api/run', { slug: S, opts: ['--dry-run', '--skip-sync'] });
      need(run.status === 200, `入队 ${S} 失败：${run.status} ${run.text.slice(0, 120)}`);
      JOB_IDS.add(run.json.job.id);
      const t0 = Date.now();
      let fin = null;
      while (Date.now() - t0 < 150000) {
        const r = await get('/api/jobs');
        const j = (r.json.jobs || []).find((x) => x.id === run.json.job.id);
        if (j && ['done', 'failed', 'canceled'].includes(j.status)) { fin = j; break; }
        await sleep(700);
      }
      need(fin, `${S} 的 dry-run 150s 内没结束`);
      need(fin.status === 'done', `${S} 的 dry-run 跑成了 ${fin.status}（exit=${fin.exitCode}）`);

      const r1 = await get(`/api/eta?slug=${encodeURIComponent(S)}&opt=--dry-run&opt=--skip-sync`);
      const e1 = r1.json.items[0];
      need(e1.n === n0 + 1, `跑完 1 次后样本数应是 ${n0 + 1}，实际 ${e1.n}（没从历史学到东西？）`);
      const wantConf = e1.n === 1 ? 'low' : 'ok';
      need(e1.confidence === wantConf, `样本 ${e1.n} 条时 confidence 应是 ${wantConf}，实际 ${e1.confidence}`);
      need(Number.isFinite(e1.medianMs) && e1.medianMs > 0, `中位耗时应为正数，实际 ${e1.medianMs}`);

      // ★ 换一组参数问同一个 slug → 必须**不**命中刚才那批 dry-run 样本（否则就是把不同阶段的耗时混着报）
      //   32 种开关组合里总有没跑过的；逐个试到出现 none 为止。
      const combos = [
        ['--audio-only'], ['--render-only'], ['--audio-only', '--skip-render'],
        ['--render-only', '--skip-sync'], ['--skip-render'], ['--audio-only', '--skip-sync'],
      ];
      let hitNone = null;
      for (const cb of combos) {
        const r = await get(`/api/eta?slug=${encodeURIComponent(S)}` + cb.map((o) => '&opt=' + encodeURIComponent(o)).join(''));
        const e = r.json.items[0];
        if (e.confidence === 'none') { hitNone = { cb, e }; break; }
        need(e.n <= n0 + 1, `换参数后样本数 ${e.n} 大于该 slug 的全部成功记录数 ${n0 + 1} —— 样本串组了`);
      }
      need(hitNone, `试了 ${combos.length} 组参数都能查到历史 —— 无法验证「按参数分组」（该 slug 历史异常丰富？）`);
      notes.push(`C3 ${S}：dry-run 样本 ${n0} → ${e1.n}（confidence ${pick.confidence}→${e1.confidence}，`
        + `中位 ${(e1.medianMs / 1000).toFixed(1)}s）；换 ${hitNone.cb.join(' ')} 问 → none（不混用别组样本）`);
    });

    await runCase('C4 「预计还需」真的渲染到进度条上（有历史才显示，无历史为空）', async () => {
      // ① 找一个**已经有 dry-run 历史**的 slug（C3 刚给它跑过一次）——
      //    没有历史时 eta.confidence 是 none，UI 会刻意什么都不显示，那样测不出东西。
      const all = demos.json.styles.map((s) => s.slug);
      const q = all.map((s) => 'slug=' + encodeURIComponent(s)).join('&') + '&opt=--dry-run&opt=--skip-sync';
      const r0 = await get('/api/eta?' + q);
      const withHist = r0.json.items.filter((x) => x.confidence !== 'none').sort((a, b) => b.n - a.n)[0];
      need(withHist, '没有任何 slug 有 dry-run 历史（C3 应该刚跑过一次，顺序不对？）');
      const S = withHist.slug;

      // ② 连入队 5 条：第 1 条立刻跑、后面 4 条**排队**，于是「有 ETA 的排队任务」会存在好几秒
      //    （单条 dry-run 只有 ~1.3s，入队 1 条的话窗口太窄，测试会变成抽奖）。
      const ids = [];
      for (let i = 0; i < 5; i++) {
        const r = await post('/api/run', { slug: S, opts: ['--dry-run', '--skip-sync'] });
        need(r.status === 200, `第 ${i + 1} 次入队 ${S} 失败：${r.status}`);
        ids.push(r.json.job.id);
        JOB_IDS.add(r.json.job.id);
      }

      // ③ 走**真实 UI 路径**：刷新任务列表 → 点那一行（点行 = attachLog）→ 读进度条上的文字
      const out = await cdp.evalJs(`(async () => {
        document.getElementById('btnRefreshJobs').click();
        const d = await (await fetch('/api/jobs')).json();
        const j = (d.jobs || []).find((x) => x.eta && x.eta.confidence !== 'none');
        if (!j) return { err: 'no-job-with-eta', seen: (d.jobs || []).map((x) => x.slug + ':' + x.status + ':' + (x.eta && x.eta.confidence)) };
        for (let i = 0; i < 50; i++) {
          const row = [...document.querySelectorAll('#jobs .job')]
            .find((n) => { const t = n.querySelector('.jid'); return t && t.textContent === j.id; });
          if (row) {
            row.click();
            await new Promise((r) => setTimeout(r, 150));
            const box = document.getElementById('progEta');
            return { id: j.id, slug: j.slug, status: j.status, conf: j.eta.confidence,
                     text: box.textContent, hidden: box.hidden, title: box.title,
                     hasClass: box.className };
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        return { err: 'row-not-found', id: j.id };
      })()`, { awaitPromise: true });

      need(!out.err, `UI 里没能挂上带 ETA 的任务：${JSON.stringify(out)}`);
      need(out.hidden === false, `#progEta 被隐藏了（应该显示）：${JSON.stringify(out)}`);
      need(/预计还需 ~|已超过历史中位/.test(out.text), `#progEta 的文字是「${out.text}」，期望「预计还需 ~…」`);
      need(out.conf === 'ok' || out.conf === 'low', `confidence=${out.conf}，期望 ok/low（有同参数历史）`);
      need(/历史样本 \d+ 次/.test(out.title), `#progEta 的 tooltip 没说清样本来源：${out.title}`);
      need(out.hasClass.includes(out.conf), `#progEta 的 class「${out.hasClass}」里没有 confidence 标记 ${out.conf}`);
      notes.push(`C4 ${S}（${out.status}/${out.conf}）→ #progEta = 「${out.text}」`);
      notes.push(`C4 tooltip：${String(out.title).replace(/\n/g, ' | ').slice(0, 200)}`);

      // ④ 收尾：等这 5 条跑完，别留着占 GPU 的孤儿进程
      const t0 = Date.now();
      while (Date.now() - t0 < 120000) {
        const r = await get('/api/jobs');
        const mine = (r.json.jobs || []).filter((j) => ids.includes(j.id));
        if (mine.length === ids.length && mine.every((j) => ['done', 'failed', 'canceled'].includes(j.status))) break;
        await sleep(600);
      }
    });

    await runCase('C5 GET /api/eta 的参数校验（缺 slug / 非法 slug / 非法选项）', async () => {
      const a = await get('/api/eta');
      need(a.status === 400, `不带 slug 应 400，实际 ${a.status}`);
      const b = await get('/api/eta?slug=../etc');
      need(b.status === 400, `非法 slug 应 400，实际 ${b.status}`);
      const c = await get('/api/eta?slug=' + encodeURIComponent(state.slugA) + '&opt=' + encodeURIComponent('; rm -rf /'));
      need(c.status === 400, `非法选项应 400，实际 ${c.status}`);
      const d = await get('/api/eta?slug=' + encodeURIComponent(state.slugA));
      need(d.status === 200 && d.json.items.length === 1, `单个 slug 应返回 1 条，实际 ${d.status}/${d.json?.items?.length}`);
      notes.push('C5 /api/eta 的三种非法输入均 400；正常输入 200');
    });
  } finally {
    // ── 收尾 ──
    if (cdp && !OPT.keepBrowser) { await cdp.close(); log(C.dim('  无头 Edge 已关闭')); }
    if (server) { await stopServer(server.child); log(C.dim(`  测试服务已停止（pid ${server.child.pid}）`)); }

    const restored = [];
    for (const [f, buf] of backup) {
      try {
        if (buf === null) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
        else fs.writeFileSync(f, buf);
        restored.push(path.basename(f));
      } catch (e) { log(C.bad(`  ⚠️ 固定入口还原失败：${path.basename(f)}（${e.message}）`)); }
    }
    if (restored.length) log(C.dim(`  固定入口已还原：${restored.join(' · ')}`));

    try {
      await sleep(700);                       // 等测试服务的 persistSoon 去抖走完再摘任务
      const rep = cleanupJobs();
      if (rep.removed.length) log(C.dim(`  测试任务已清理：${rep.removed.join(', ')}`));
      if (rep.errors.length) log(C.bad(`  ⚠️ 测试任务清理失败：${rep.errors.join('；')}`));
    } catch (e) { log(C.bad(`  ⚠️ 测试任务清理异常：${e.message}`)); }

    const tmpErr = cleanupTmpDirs();
    if (tmpErr.length) log(C.bad(`  ⚠️ 临时目录清理失败：${tmpErr.join('；')}`));
  }

  // ── 汇总 ──
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (notes.length) {
    log('');
    log(C.b('  备注'));
    for (const n of notes) log(C.dim(`    ${n}`));
  }

  log('');
  log('─'.repeat(64));
  if (failed.length) {
    log(C.bad(`  ${passed} passed, ${failed.length} failed`) + C.dim(`  (${elapsed}s)`));
    log('');
    for (const f of failed) log(C.bad(`  ✗ ${f.name}`));
  } else {
    log(C.ok(`  ${passed} passed, 0 failed`) + C.dim(`  (${elapsed}s)`));
  }
  log('─'.repeat(64));
  log('');

  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
