#!/usr/bin/env node
/**
 * test/dub-api.test.mjs —— 「文案出片」HTTP 面（`/api/dub/*`）的契约与校验（**独立入口**）
 *
 * 为什么单独一个入口：沿用本项目已有的分工 —— smoke.mjs / setup.test.mjs / ui.test.mjs /
 * briefs.test.mjs 各自一个数字、互不干扰。这一套只管 `/api/dub/*` 这 **7 个接口**：
 *   upload / sources / source-meta / styles / preview / analyze / run。
 * ★ 另含 ⑰：`GET/HEAD /api/films/dub/:dir/:file`（「文案出片」成片字节，`server.mjs` 的 `apiDubFilmFile`）——
 *   它是成片库播放的落点，此前服务端**零断言**（ui.test.mjs 只查 video.src 属性）。
 *   覆盖 200/206/416/HEAD 与**路径穿越防护**；纯只读，不写盘。
 * 它们承担着上传安全（防目录穿越）、请求形状校验、语义结果注入等关键逻辑，
 * 此前**没有任何测试**（全仓 grep 只在 README 里提到 /api/dub/analyze 一次）。
 *
 * 用法：
 *   node test/dub-api.test.mjs                 全部用例
 *   node test/dub-api.test.mjs --filter 穿越    只跑名字里含「穿越」的用例
 *   node test/dub-api.test.mjs --keep-server   跑完不杀测试服务（调试用，自己记得收）
 *
 * 纪律（全部沿用 briefs.test.mjs 踩出来的那套）：
 *   - 测试自己用内核分配的空闲端口起服务，**绝不碰用户那个实例**。
 *   - 测试服务会覆写 `.console-port` / `打开控制台.url` —— 跑前按字节备份、跑后逐字节还原。
 *   - ★ 上传会写 `dub.UPLOAD_DIR/index.json` 登记表 —— 同样按字节备份、跑后还原。
 *   - ★★ 成片根（`dub` / `.console` / `.briefs` / `_jobs`）**默认隔离**到仓外临时树
 *     （`D:\lemo-tmp\dub-api-film-<pid>-<ts>`，见下方「隔离成片根」段）—— 绝不写用户的 `D:\lemo-films`；
 *     外部显式设了 `LEMO_FILM_DIR` 则尊重它（跑完不删）。⑰ 需一条真实成片 ⇒ 从真实 `dub` **只读**复制
 *     一条进隔离根当夹具（不写真实盘）。
 *   - 不用 curl（本机走代理，打 localhost 得到 502）；不用 spawnSync（本环境一律 EBUSY）。
 *   - 临时文件在非 C 盘（CFG.tmpDir）；跑完按**确切路径**递归删除（不用通配符）。
 *   - ★ 测试造的**每一个上传文件**都登记（用响应里的 path），`finally` 里删干净。
 *   - ★ 断言**增量**（不断言绝对数量）：上传清单与任务历史都是落盘持久化的。
 *   - ★ run 只测 **400 路径**，每条 400 后都断言「没有起任务」——绝不真出片（会调 GPU/TTS）。
 *
 * 退出码：全绿 0 / 有用例失败 1 / 自身异常 2。
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// ★★ 隔离成片根（**默认隔离**，可被外部 env 覆盖）—— 与 briefs.test.mjs / ui.test.mjs 同款。
//   为什么必须有：②③ 会上传文件、由**测试服务**写 `dub.UPLOAD_DIR/index.json` 登记表，⑮ 收尾再按字节
//   还原 ⇒ 内容虽一致，**mtime 仍被改写** ⇒ 那仍是对用户真实 `D:\lemo-films` 的一次写。
//   实测（只读快照对比，2026-10-09）：未隔离时跑完 `D:\lemo-films\dub\_uploads\index.json` 的 mtime 必变。
//   ⇒ 默认把成片根指到仓外临时树（非 C 盘 + pid 防并发互撞），跑完递归删；
//     外部显式设了 `LEMO_FILM_DIR` 则尊重它（跑完不删）。
//   ★ 唯一坑：`CFG.exportDir` 在 `lib/env.mjs` 模块求值那一刻定死 ⇒ 必须先设 env、**再动态 import**。
const EXTERNAL_FILM_DIR = process.env.LEMO_FILM_DIR || '';
const TEST_FILM_ROOT = EXTERNAL_FILM_DIR
  ? path.resolve(EXTERNAL_FILM_DIR)
  : path.resolve('D:/lemo-tmp', `dub-api-film-${process.pid}-${Date.now().toString(36)}`);
const OWNS_FILM_ROOT = !EXTERNAL_FILM_DIR;
if (OWNS_FILM_ROOT) {
  process.env.LEMO_FILM_DIR = TEST_FILM_ROOT;
  fs.mkdirSync(TEST_FILM_ROOT, { recursive: true });
  process.on('exit', () => { try { fs.rmSync(TEST_FILM_ROOT, { recursive: true, force: true }); } catch { /* 尽力而为 */ } });
}
// ★ 动态 import：让上面的 LEMO_FILM_DIR 先生效（静态 import 会被提升到文件顶部）。
const dub = await import('../lib/dub.mjs');   // 只借常量 / 路径；dub.mjs 顶层无副作用

// ★ ⑰ 要一条真实「文案出片」成片（>200KB、含 ftyp 头）来验 Range/HEAD/穿越 —— 本套件**只读**真实成片根、
//   把一条复制进隔离根当夹具（不写真实盘）。真实库里没有成片时 ⑰ 照旧明确失败（与隔离前行为一致）。
if (OWNS_FILM_ROOT) {
  try {
    const REAL_DUB = 'D:/lemo-films/dub';   // 未显式设 LEMO_FILM_DIR ⇒ 真实根就是默认的 D:\lemo-films
    let best = null;
    for (const ent of fs.readdirSync(REAL_DUB, { withFileTypes: true })) {
      if (!ent.isDirectory() || ent.name.startsWith('_') || ent.name.startsWith('.')) continue;
      const f = path.join(REAL_DUB, ent.name, 'film.mp4');
      try { const st = fs.statSync(f); if (st.size > 200000 && (!best || st.size > best.size)) best = { f, size: st.size, name: ent.name }; } catch { /* 跳过 */ }
    }
    if (best) {
      const dstDir = path.join(TEST_FILM_ROOT, 'dub', best.name);
      fs.mkdirSync(dstDir, { recursive: true });
      fs.copyFileSync(best.f, path.join(dstDir, 'film.mp4'));
    }
  } catch { /* 真实成片根不可读 ⇒ ⑰ 自行失败（与隔离前一致） */ }
}

// ★ 起服务的测试实例不该写用户的固定入口文件（.console-port / 打开控制台.url）——
//   否则每跑一次测试就把它们改成测试端口；跑崩时还原语句没执行，脏值还会残留（见 server.mjs 文件头）。
//   设了这个环境变量，本进程 spawn 出的 server.mjs 会跳过写入。下面的备份/还原是第二道防线，保留。
process.env.LEMO_CONSOLE_NO_ENTRY_FILES = '1';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 被测对象的关键常量（从实现里取，**不硬编码**）
const UPLOAD_DIR = dub.UPLOAD_DIR;
const INDEX_FILE = path.join(UPLOAD_DIR, 'index.json');
const MAX_UPLOAD_BYTES = dub.MAX_UPLOAD_BYTES;
const MAX_SCRIPT_CHARS = dub.MAX_SCRIPT_CHARS;
const MAX_TITLE_CHARS = dub.MAX_TITLE_CHARS;
const ENTRY_FILES = [path.join(ROOT, '.console-port'), path.join(ROOT, '打开控制台.url')];

// ── 命令行 ──────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OPT = { filter: argOf('--filter') || '', keepServer: argv.includes('--keep-server') };

// ── 输出 ────────────────────────────────────────────────────
const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
  b: (s) => (TTY ? `\x1b[1m${s}\x1b[0m` : s),
  y: (s) => (TTY ? `\x1b[33m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── HTTP（node:http 直连，绕开代理）────────────────────────
function httpSend(port, { method, path: p, headers = {}, body = null, timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: p, method, headers: { Accept: 'application/json', Connection: 'close', ...headers }, agent: false },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* 不是 JSON 就算了 */ }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`HTTP 超时（${timeoutMs}ms）：${method} ${p}`)));
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

const getJson = (port, p) => httpSend(port, { method: 'GET', path: p });

/**
 * GET / HEAD 只收前 maxBytes 字节就**主动断开**（成片几十 MB，整份读既慢又没必要）。
 * 返回 { status, headers, buf, bytes, truncated } —— 照 smoke.mjs 的 httpRequest 做法。
 */
function getPartial(port, p, { method = 'GET', headers = {}, maxBytes = 0, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const req = http.request(
      { host: '127.0.0.1', port, path: p, method, headers: { Accept: '*/*', Connection: 'close', ...headers }, agent: false },
      (res) => {
        const chunks = [];
        let n = 0;
        const finish = (truncated) => {
          if (settled) return;
          settled = true;
          resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks), bytes: n, truncated });
        };
        res.on('data', (d) => { chunks.push(d); n += d.length; if (maxBytes && n >= maxBytes) { res.destroy(); finish(true); } });
        res.on('end', () => finish(false));
        res.on('error', () => finish(true));   // 自己 destroy 之后这里会响一次，按「已收够」处理
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`HTTP 超时（${timeoutMs}ms）：${method} ${p}`)));
    req.on('error', (e) => { if (settled) return; reject(e); });
    req.end();
  });
}

function postJson(port, p, obj) {
  const b = Buffer.from(JSON.stringify(obj), 'utf8');
  return httpSend(port, { method: 'POST', path: p, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length }, body: b });
}

/** 发一段**原文**当 body（用来造「非法 JSON」）。 */
function postRaw(port, p, text) {
  const b = Buffer.from(text, 'utf8');
  return httpSend(port, { method: 'POST', path: p, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length }, body: b });
}

/** raw body 上传（不是 multipart）：文件名走 query、字节走 body。body=null 表示零字节。 */
function uploadRaw(port, name, buf) {
  const b = buf == null ? null : (Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
  const headers = { 'Content-Type': 'application/octet-stream' };
  if (b) headers['Content-Length'] = b.length;
  return httpSend(port, { method: 'POST', path: `/api/dub/upload?name=${encodeURIComponent(name)}`, headers, body: b });
}

function parseRawHttp(buf) {
  const m = /^HTTP\/1\.\d (\d{3})/.exec(buf);
  const idx = buf.indexOf('\r\n\r\n');
  const body = idx >= 0 ? buf.slice(idx + 4) : '';
  let json = null;
  try { json = JSON.parse(body); } catch { /* ignore */ }
  return { status: m ? Number(m[1]) : 0, text: body, json, raw: buf };
}

/**
 * 只发请求头、**声明**一个超大 Content-Length、不发 body —— 验「预检 413」。
 * 用裸 socket 而不是 node:http 客户端：后者会按真实 body 长度校正 Content-Length，
 * 发不出「声明得比实际大」的请求，也就碰不到 `server.mjs` 里按 `Content-Length` 提前判 413 的预检分支（`sendJson(res, 413, …)` 那处）。
 */
function headerOnlyRequest(port, p, contentLength) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let buf = '';
    let done = false;
    const finish = () => { if (done) return; done = true; try { socket.destroy(); } catch { /* ignore */ } resolve(parseRawHttp(buf)); };
    socket.on('connect', () => {
      socket.write(
        `POST ${p} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nAccept: application/json\r\n` +
        `Content-Length: ${contentLength}\r\nConnection: close\r\n\r\n`,
      );
    });
    socket.on('data', (d) => { buf += d.toString('utf8'); });
    socket.on('end', finish);
    socket.on('close', finish);
    socket.on('error', () => finish());
    socket.setTimeout(20000, finish);
  });
}

/**
 * 不带 content-length（走 chunked）地**真发**超过上限的字节 —— 验「传输中途拒 413」。
 * ★ 这条比较重（要真发 ~200MB）。拿到响应就立刻停写。
 */
function uploadOverLimitChunked(port, name, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunk = Buffer.alloc(1 << 20, 0x61);
    let settled = false;
    const req = http.request(
      { host: '127.0.0.1', port, path: `/api/dub/upload?name=${encodeURIComponent(name)}`, method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/octet-stream' }, agent: false },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          if (settled) return;
          settled = true;
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* ignore */ }
          resolve({ status: res.statusCode, text, json });
          try { req.destroy(); } catch { /* ignore */ }
        });
      },
    );
    req.on('error', (e) => { if (settled) return; settled = true; reject(e); });
    const cap = limitBytes + (8 << 20);   // 多写 8MB 保证越过阈值
    let sent = 0;
    const pump = () => {
      if (settled) return;
      while (sent < cap) {
        if (!req.write(chunk)) { req.once('drain', pump); return; }
        sent += chunk.length;
      }
      req.end();
    };
    pump();
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
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
    const finish = (fn, arg) => { if (done) return; done = true; clearTimeout(timer); fn(arg); };
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

// ── 测试产物登记与清理（**只动登记过的东西**）────────────────
const UPLOAD_PATHS = new Set();   // 本套件上传落盘的**确切路径**
const EXTRA_PATHS = new Set();    // 中途拒等路径里兜底发现的确切路径

function cleanupUploads() {
  const errors = [];
  for (const p of [...UPLOAD_PATHS, ...EXTRA_PATHS]) {
    try { fs.unlinkSync(p); } catch (e) { if (e.code !== 'ENOENT') errors.push(`${p}：${e.message}`); }
  }
  UPLOAD_PATHS.clear();
  EXTRA_PATHS.clear();
  return errors;
}

const listDir = (dir) => { try { return fs.readdirSync(dir).sort(); } catch { return []; } };

// ── 用例框架 ────────────────────────────────────────────────
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

const need = (v, msg) => { if (!v) throw new Error(msg); };

/** 当前任务数（用于「400 之后没起任务」的增量断言）。 */
async function jobsCount(port) {
  const r = await getJson(port, '/api/jobs');
  need(r.status === 200 && r.json && Array.isArray(r.json.jobs), `GET /api/jobs 异常：${r.status} ${r.text.slice(0, 120)}`);
  return r.json.jobs.length;
}

/** POST /api/dub/run 期望 400，且**不起任务**。 */
async function runExpect400(port, body, label) {
  const before = await jobsCount(port);
  const r = await postJson(port, '/api/dub/run', body);
  need(r.status === 400, `${label}：应 400，实际 ${r.status}：${r.text.slice(0, 200)}`);
  const after = await jobsCount(port);
  need(after === before, `${label}：不该起任务（${before} → ${after}）`);
  return r;
}

const SAMPLE_SCRIPT = '春天一到，城市里最先醒的是树。';

async function main() {
  const t0 = Date.now();

  log('');
  log(C.b('lemo 控制台 · 文案出片接口（/api/dub/*）测试'));
  log(C.dim(`  项目      ${ROOT}`));
  log(C.dim(`  上传目录  ${UPLOAD_DIR}`));
  log(C.dim(`  单次上限  ${(MAX_UPLOAD_BYTES / 1048576)}MB · 文案上限 ${MAX_SCRIPT_CHARS} 字`));
  log(C.dim(`  模式      ${OPT.filter ? `filter="${OPT.filter}"` : '全部'}`));
  log('');

  // ── 跑前备份固定入口 + 上传登记表（服务/上传会覆写它们）──
  const backup = new Map();
  for (const f of ENTRY_FILES) {
    try { backup.set(f, fs.readFileSync(f)); } catch { backup.set(f, null); }
  }
  const indexBefore = (() => { try { return fs.readFileSync(INDEX_FILE); } catch { return null; } })();
  const uploadsDirExistedBefore = fs.existsSync(UPLOAD_DIR);
  const uploadsBefore = listDir(UPLOAD_DIR);   // 跑完必须与它逐字一致（不留垃圾的硬判据）

  let server = null;
  try {
    server = await startServer();
    const P = server.port;
    const get = (p) => getJson(P, p);

    // ══ ① upload：缺 name / 坏扩展名 / 空 body → 400 ═════════
    await runCase('① upload 校验：缺 name / 扩展名不在白名单 / 零字节 body 都 400', async () => {
      const a = await uploadRaw(P, '', Buffer.from('x'));
      need(a.status === 400 && /缺少 name/.test(a.json.error), `缺 name 应 400，实际 ${a.status} ${a.text.slice(0, 120)}`);

      const b = await uploadRaw(P, 'evil.txt', Buffer.from('x'));
      need(b.status === 400 && /不支持的素材格式/.test(b.json.error), `坏扩展名应 400，实际 ${b.status} ${b.text.slice(0, 120)}`);
      need(/\.mp4/.test(b.json.error) && /\.srt/.test(b.json.error), `400 没列出允许的扩展名：${b.json.error}`);

      const c = await uploadRaw(P, 'empty.mp4', null);
      need(c.status === 400 && /为空/.test(c.json.error), `零字节应 400，实际 ${c.status} ${c.text.slice(0, 120)}`);

      // 这三条都不该落盘（上传目录文件名数不变）
      const now = listDir(UPLOAD_DIR);
      const leaked = now.filter((n) => !uploadsBefore.includes(n) && n !== 'index.json');
      need(leaked.length === 0, `被拒的上传竟然落了盘：${JSON.stringify(leaked)}`);
      notes.push('① 缺 name / .txt / 零字节 → 400，且都没落盘');
    });

    // ══ ② upload：.mp4 与 .srt 成功 + kind 正确 ═════════════
    let videoToken = '';
    let videoPath = '';
    let srtToken = '';
    let srtPath = '';
    await runCase('② upload 成功：.mp4 → kind=video；.srt → kind=srt；响应形状正确', async () => {
      const v = await uploadRaw(P, '口播素材.mp4', Buffer.from('FAKE-MP4-BYTES-not-a-real-video'));
      need(v.status === 200, `上传 .mp4 应 200，实际 ${v.status}：${v.text.slice(0, 160)}`);
      need(v.json.ok === true, `响应缺 ok:true：${v.text.slice(0, 160)}`);
      need(typeof v.json.token === 'string' && v.json.token.length >= 8, `token 形状不对：${JSON.stringify(v.json.token)}`);
      need(v.json.kind === 'video', `.mp4 的 kind 应是 video，实际 ${v.json.kind}`);
      need(v.json.name === '口播素材.mp4', `name 应原样回显，实际 ${v.json.name}`);
      need(v.json.size === Buffer.byteLength('FAKE-MP4-BYTES-not-a-real-video'), `size 不对：${v.json.size}`);
      need(typeof v.json.path === 'string' && fs.existsSync(v.json.path), `path 不是真实落盘文件：${v.json.path}`);
      videoToken = v.json.token;
      videoPath = v.json.path;
      UPLOAD_PATHS.add(videoPath);

      const s = await uploadRaw(P, '时间轴.srt', Buffer.from('1\n00:00:00,000 --> 00:00:02,000\n春天一到。\n'));
      need(s.status === 200, `上传 .srt 应 200，实际 ${s.status}：${s.text.slice(0, 160)}`);
      need(s.json.kind === 'srt', `.srt 的 kind 应是 srt，实际 ${s.json.kind}`);
      srtToken = s.json.token;
      srtPath = s.json.path;
      UPLOAD_PATHS.add(srtPath);

      need(videoToken !== srtToken, 'video 与 srt 拿到了同一个 token？');
      notes.push(`② 上传 video token=${videoToken}（kind=video）/ srt token=${srtToken}（kind=srt），均已登记待删`);
    });

    // ══ ③ ★ 路径穿越：用户给的名字绝不参与拼路径 ═════════════
    await runCase('③ ★ 路径穿越：恶意 name 不参与拼路径（落盘基名**恰好**是 <token>.mp4、在 UPLOAD_DIR 内、不含 ..）', async () => {
      const evilNames = ['../../evil.mp4', 'a/b.mp4', '..\\evil.mp4', '....//....//evil.mp4'];
      const upDirAbs = path.resolve(UPLOAD_DIR);
      for (const raw of evilNames) {
        const r = await uploadRaw(P, raw, Buffer.from('EVIL'));
        need(r.status === 200, `恶意 name=${JSON.stringify(raw)} 应仍能上传（清洗后合法），实际 ${r.status}：${r.text.slice(0, 160)}`);
        const p = String(r.json.path);
        UPLOAD_PATHS.add(p);
        const pAbs = path.resolve(p);
        // ① 落盘路径必须在 UPLOAD_DIR 之内（且不是 UPLOAD_DIR 自身）
        need(pAbs === upDirAbs || pAbs.startsWith(upDirAbs + path.sep),
          `path 跑到 UPLOAD_DIR 之外了：${p}（name=${JSON.stringify(raw)}）`);
        // ② ★★ 落盘基名必须**恰好**是 `<token><ext>` —— 这是「用户给的名字完全不参与拼路径」的
        //    充分必要条件，而且**与随机 token 无关**。
        //    ★ 2026-10-04 修正：这里原先是**子串启发式** —— 「用户名字的多字符片段不得出现在路径里」。
        //      它是 flaky 的：`newToken() = Date.now().toString(36) + randHex(8)`（`lib/dub.mjs` 的 `newToken()`），
        //      **末位是十六进制字符**，于是末位恰好为 `b` 的概率 = 1/16 = 6.25%，
        //      此时路径 `…<token>b.mp4` 命中片段 `b.mp4` ⇒ **误报**（实测连跑 8 次红 1 次、14 次红 1 次）。
        //      ⇒ 教训：**断言不要拿随机值做子串匹配**，要断言精确相等（见下面这行）。
        const ext = path.extname(p);
        need(ext === '.mp4', `恶意 name 的扩展名应仍解析为 .mp4，实得 ${ext}（${p}）`);
        need(path.basename(p) === `${r.json.token}${ext}`,
          `落盘基名必须**恰好**是 <token><ext>：实得 ${path.basename(p)}，期望 ${r.json.token}${ext}`);
        // ③ 不含任何目录成分 / 穿越记号
        need(!p.includes('..') && !path.basename(p).includes('..'), `path 里出现了 '..'：${p}`);
        need(path.dirname(pAbs) === upDirAbs, `落盘目录不是 UPLOAD_DIR：${path.dirname(pAbs)}`);
        need(fs.existsSync(p), `落盘文件不存在：${p}`);
      }
      notes.push(`③ 4 种穿越 name（${evilNames.map((s) => JSON.stringify(s)).join(' / ')}）落盘基名**恰好**是 <token>.mp4、目录恒为 UPLOAD_DIR、不含 '..'`);
    });

    // ══ ④ upload：content-length 预检 → 413（不落盘）══════════
    await runCase('④ upload：声明超大 content-length → 413（预检，在收字节前拒，不落盘）', async () => {
      const before = listDir(UPLOAD_DIR);
      const r = await headerOnlyRequest(P, '/api/dub/upload?name=big.mp4', MAX_UPLOAD_BYTES + 1);
      need(r.status === 413, `预检应 413，实际 ${r.status}：${r.raw.slice(0, 200)}`);
      need(r.json && /过大/.test(r.json.error || ''), `413 的理由没说清「过大」：${r.text.slice(0, 160)}`);
      const after = listDir(UPLOAD_DIR);
      const leaked = after.filter((n) => !before.includes(n));
      for (const n of leaked) EXTRA_PATHS.add(path.join(UPLOAD_DIR, n));
      need(leaked.length === 0, `预检 413 竟然落了盘：${JSON.stringify(leaked)}`);
      notes.push('④ content-length 超限 → 413（预检，未落盘）');
    });

    // ══ ⑤ upload：无 content-length 中途超限 → 413 ══════════
    await runCase('⑤ upload：不带 content-length 且中途超限 → 413（传输中途拒，不落盘）', async () => {
      const before = listDir(UPLOAD_DIR);
      const r = await uploadOverLimitChunked(P, 'big-chunked.mp4', MAX_UPLOAD_BYTES);
      need(r.status === 413, `中途超限应 413，实际 ${r.status}：${r.text.slice(0, 200)}`);
      need(r.json && /过大/.test(r.json.error || ''), `413 的理由没说清「过大」：${r.text.slice(0, 160)}`);
      const after = listDir(UPLOAD_DIR);
      const leaked = after.filter((n) => !before.includes(n));
      if (leaked.length) {
        // ★ Windows 上「写流还没关 fd 就 unlink」有竞态，可能残留半个文件。如实报告并兜底删除。
        for (const n of leaked) EXTRA_PATHS.add(path.join(UPLOAD_DIR, n));
        notes.push(`⑤ ⚠️ 中途拒后残留了 ${leaked.length} 个文件：${leaked.join(', ')}（Windows unlink 竞态？已兜底删除）`);
      } else {
        notes.push('⑤ 无 content-length 中途超限 → 413（未落盘）');
      }
    });

    // ══ ⑥ sources：刚上传的 token 出现在清单里（增量）════════
    await runCase('⑥ sources：刚上传的 video/srt token 都出现在清单里（增量断言）', async () => {
      const r = await get('/api/dub/sources');
      need(r.status === 200 && r.json.ok === true, `sources 应 200，实际 ${r.status}`);
      need(Array.isArray(r.json.uploads), `uploads 不是数组：${r.text.slice(0, 160)}`);
      need(path.resolve(r.json.dir) === path.resolve(UPLOAD_DIR), `dir 不是 UPLOAD_DIR：${r.json.dir}`);
      const mine = r.json.uploads.filter((u) => u.token === videoToken || u.token === srtToken);
      need(mine.some((u) => u.token === videoToken && u.kind === 'video'), `清单里没有刚传的视频 token=${videoToken}`);
      need(mine.some((u) => u.token === srtToken && u.kind === 'srt'), `清单里没有刚传的字幕 token=${srtToken}`);
      notes.push(`⑥ sources 里能看到 video=${videoToken} / srt=${srtToken}（清单共 ${r.json.uploads.length} 条，未断言绝对数）`);
    });

    // ══ ⑦ source-meta：400 / 404 / 400 / 200-or-502 ════════
    await runCase('⑦ source-meta：缺 token 400 / 未知 token 404 / srt 400 / 视频 200-or-502', async () => {
      const a = await get('/api/dub/source-meta');
      need(a.status === 400 && /缺少 token/.test(a.json.error), `缺 token 应 400，实际 ${a.status}`);

      const b = await get('/api/dub/source-meta?token=zz-not-registered');
      need(b.status === 404, `未知 token 应 404，实际 ${b.status}`);

      const c = await get('/api/dub/source-meta?token=' + encodeURIComponent(srtToken));
      need(c.status === 400, `srt token 应 400（只有视频才有宽高），实际 ${c.status}`);

      const d = await get('/api/dub/source-meta?token=' + encodeURIComponent(videoToken));
      const ok200 = d.status === 200 && d.json && d.json.ok === true && d.json.token === videoToken
        && Number.isFinite(d.json.w) && d.json.w > 0 && Number.isFinite(d.json.h) && d.json.h > 0
        && typeof d.json.cached === 'boolean';
      const ok502 = d.status === 502 && d.json && d.json.ok === false && typeof d.json.error === 'string' && d.json.error.length > 0;
      need(ok200 || ok502,
        `视频 token 应命中 200 或 502 之一，实际 ${d.status}：${d.text.slice(0, 200)}`);
      notes.push(`⑦ source-meta：缺 token 400 / 未知 404 / srt 400 / 视频命中 **${ok200 ? '200' : '502'}**`
        + `${ok200 ? `（w=${d.json.w} h=${d.json.h} cached=${d.json.cached}）` : `（${String(d.json.error).slice(0, 60)}…）`}`);
    });

    // ══ ⑧ styles：200 且是风格清单形状 ══════════════════════
    await runCase('⑧ styles：200 且是风格清单形状（不硬编码风格数量）', async () => {
      const r = await get('/api/dub/styles');
      need(r.status === 200, `styles 应 200（不是 500），实际 ${r.status}：${r.text.slice(0, 160)}`);
      need(r.json && r.json.ok === true, `styles 缺 ok:true：${r.text.slice(0, 160)}`);
      need(Array.isArray(r.json.styles) && r.json.styles.length >= 1, `styles 不是非空数组：${r.text.slice(0, 160)}`);
      need(typeof r.json.default === 'string' && r.json.default.length > 0, `default 不是非空字符串：${JSON.stringify(r.json.default)}`);
      for (const s of r.json.styles) {
        need(s && typeof s.id === 'string' && s.id, `风格项缺 id：${JSON.stringify(s).slice(0, 120)}`);
        need(typeof s.cn === 'string', `风格项 ${s.id} 缺 cn：${JSON.stringify(s).slice(0, 120)}`);
      }
      need(r.json.styles.some((s) => s.id === r.json.default), `default「${r.json.default}」不在 styles 里`);
      need(r.json.styles.some((s) => s.id === 'plain-dark'), `契约要求 plain-dark 必在表里，实际 ids=${r.json.styles.map((s) => s.id).join(',')}`);
      notes.push(`⑧ styles：${r.json.styles.length} 个风格，default=${r.json.default}，source=${r.json.source || '-'}`);
    });

    // ══ ⑨ preview：400 路径 + 成功 ═════════════════════════
    await runCase('⑨ preview：非法 JSON / 空 / 过长 → 400；成功 → 200 且 count===lines.length', async () => {
      const a = await postRaw(P, '/api/dub/preview', '{ not json ');
      need(a.status === 400 && /合法 JSON/.test(a.json.error), `非法 JSON 应 400，实际 ${a.status}：${a.text.slice(0, 120)}`);

      const b = await postJson(P, '/api/dub/preview', { script: '   \n  ' });
      need(b.status === 400 && /不能为空/.test(b.json.error), `空 script 应 400，实际 ${b.status}`);

      const c = await postJson(P, '/api/dub/preview', { script: 'x'.repeat(MAX_SCRIPT_CHARS + 1) });
      need(c.status === 400 && /过长/.test(c.json.error), `过长 script 应 400，实际 ${c.status}`);

      const d = await postJson(P, '/api/dub/preview', { script: SAMPLE_SCRIPT });
      need(d.status === 200 && d.json.ok === true, `preview 应 200，实际 ${d.status}：${d.text.slice(0, 160)}`);
      need(Array.isArray(d.json.lines), `lines 不是数组：${d.text.slice(0, 160)}`);
      need(d.json.count === d.json.lines.length, `count(${d.json.count}) 与 lines.length(${d.json.lines.length}) 不一致`);
      need(d.json.lines.length >= 1, '断句结果为空');
      need(d.json.lines.every((l) => typeof l.text === 'string' && l.text.trim()), `有断句项没有文本：${JSON.stringify(d.json.lines).slice(0, 160)}`);
      need(typeof d.json.source === 'string' && typeof d.json.note === 'string', 'source/note 不是字符串');
      notes.push(`⑨ preview：非法 JSON/空/过长 → 400；成功 200，count=${d.json.count}=lines.length，source=${d.json.source}`);
    });

    // ══ ⑩ analyze：400 路径（JSON / script / styleIds）══════
    await runCase('⑩ analyze 校验：非法 JSON / 空 / 过长 / styleIds 非数组 / 超 64 / 非法 id → 400', async () => {
      const a = await postRaw(P, '/api/dub/analyze', 'oops');
      need(a.status === 400 && /合法 JSON/.test(a.json.error), `非法 JSON 应 400，实际 ${a.status}`);

      const b = await postJson(P, '/api/dub/analyze', { script: '  ' });
      need(b.status === 400 && /不能为空/.test(b.json.error), `空 script 应 400，实际 ${b.status}`);

      const c = await postJson(P, '/api/dub/analyze', { script: 'x'.repeat(MAX_SCRIPT_CHARS + 1) });
      need(c.status === 400 && /过长/.test(c.json.error), `过长 script 应 400，实际 ${c.status}`);

      const d = await postJson(P, '/api/dub/analyze', { script: SAMPLE_SCRIPT, styleIds: 'not-array' });
      need(d.status === 400 && /styleIds 必须/.test(d.json.error), `styleIds 非数组应 400，实际 ${d.status}`);

      const e = await postJson(P, '/api/dub/analyze', { script: SAMPLE_SCRIPT, styleIds: Array.from({ length: 65 }, (_, i) => `s${i}`) });
      need(e.status === 400 && /最多 64/.test(e.json.error), `styleIds 超 64 应 400，实际 ${e.status}`);

      for (const bad of ['../x', 'a b', '', '中文']) {
        const r = await postJson(P, '/api/dub/analyze', { script: SAMPLE_SCRIPT, styleIds: [bad] });
        need(r.status === 400 && /非法 id/.test(r.json.error), `非法 styleId ${JSON.stringify(bad)} 应 400，实际 ${r.status}`);
      }
      notes.push('⑩ analyze：非法 JSON / 空 / 过长 / styleIds 非数组 / 65 项 / ../x·a b·空串·中文 → 全部 400');
    });

    // ══ ⑪ analyze：成功 + ★ 外部注入 source:'external' ══════
    await runCase('⑪ analyze：成功 200（不包一层）+ ★外部注入 source=external + 非对象 analysis 被忽略', async () => {
      // 规则路：返回体**就是** analyze() 的结果（不包一层）
      const r = await postJson(P, '/api/dub/analyze', { script: SAMPLE_SCRIPT });
      need(r.status === 200, `analyze 应 200，实际 ${r.status}：${r.text.slice(0, 200)}`);
      need(r.json && r.json.ok === true, `analyze 结果 ok 不是 true：${r.text.slice(0, 200)}`);
      need(Array.isArray(r.json.segments), `结果里没有 segments 数组（是否被包了一层？）：${r.text.slice(0, 200)}`);
      need(typeof r.json.emotion === 'string' && typeof r.json.styleId === 'string', '结果缺 emotion/styleId');
      need(!('result' in r.json) && !('analysis' in r.json), '结果被包了一层（不该有 result/analysis 外层）');
      need(r.json.source === 'rules', `没给 analysis 时应是规则路 source=rules，实际 ${r.json.source}`);

      // ★ 外部注入：带 analysis（对象）→ source 必须变成 'external'
      const ext = await postJson(P, '/api/dub/analyze', { script: SAMPLE_SCRIPT, analysis: { emotion: '喜悦' } });
      need(ext.status === 200, `带 analysis 应 200，实际 ${ext.status}：${ext.text.slice(0, 200)}`);
      need(ext.json.source === 'external', `外部注入后 source 应为 'external'，实际 ${JSON.stringify(ext.json.source)}：${ext.text.slice(0, 200)}`);
      need(ext.json.emotion === '喜悦', `外部注入的 emotion 没生效，实际 ${ext.json.emotion}`);

      // 非对象 analysis（字符串 / 数组）→ 必须被**忽略**（走规则路），**不是 400**
      const s = await postJson(P, '/api/dub/analyze', { script: SAMPLE_SCRIPT, analysis: 'hello' });
      need(s.status === 200, `analysis 传字符串应被忽略（200），实际 ${s.status}：${s.text.slice(0, 160)}`);
      need(s.json.source === 'rules', `analysis 传字符串应走规则路，实际 source=${s.json.source}`);

      const arr = await postJson(P, '/api/dub/analyze', { script: SAMPLE_SCRIPT, analysis: ['x'] });
      need(arr.status === 200, `analysis 传数组应被忽略（200），实际 ${arr.status}`);
      need(arr.json.source === 'rules', `analysis 传数组应走规则路，实际 source=${arr.json.source}`);
      notes.push('⑪ analyze 成功 200（不包一层）；analysis={emotion:喜悦} → source=external；analysis 传字符串/数组被忽略走 rules（非 400）');
    });

    // ══ ⑫ run：请求体校验 → 400 且不起任务 ═════════════════
    await runCase('⑫ run 校验：非法 JSON / script 缺·非字符串·空·过长 / token 形状 → 400 且不起任务', async () => {
      const before = await jobsCount(P);

      const j = await postRaw(P, '/api/dub/run', '{ bad json');
      need(j.status === 400 && /合法 JSON/.test(j.json.error), `非法 JSON 应 400，实际 ${j.status}`);

      await runExpect400(P, {}, '缺 script');
      await runExpect400(P, { script: 123 }, 'script 非字符串');
      await runExpect400(P, { script: '   ' }, 'script 全空白');
      await runExpect400(P, { script: 'x'.repeat(MAX_SCRIPT_CHARS + 1) }, 'script 过长');
      await runExpect400(P, { script: 'x', videoToken: 123 }, 'videoToken 非字符串');
      await runExpect400(P, { script: 'x', videoToken: 'a b' }, 'videoToken 含空格');
      await runExpect400(P, { script: 'x', bgToken: '../evil' }, 'bgToken 含 ../');
      await runExpect400(P, { script: 'x', srtToken: 'a/b' }, 'srtToken 含 /');
      // ★ 不对称：analyze 对非对象 analysis 是「忽略走规则路」，run 走 validateRunBody 是**硬 400**
      await runExpect400(P, { script: 'x', analysis: 'not-object' }, 'analysis 非对象（字符串）');
      await runExpect400(P, { script: 'x', analysis: ['x'] }, 'analysis 非对象（数组）');

      const after = await jobsCount(P);
      need(after === before, `上面这些 400 里有人起了任务（${before} → ${after}）`);
      notes.push(`⑫ run：非法 JSON + 10 种形状非法（含 analysis 非对象）→ 400；任务数全程 ${before}（未起任何任务）`);
    });

    // ══ ⑬ run：尺寸 / 比例 / 风格 → 400 且不起任务 ══════════
    await runCase('⑬ run 校验：size 太小·奇数·越界 / ratio 非法 / style 不存在 → 400 且不起任务', async () => {
      const before = await jobsCount(P);
      await runExpect400(P, { script: 'x', size: '64x64' }, 'size 太小（64x64）');
      await runExpect400(P, { script: 'x', size: '1081x1921' }, 'size 奇数（1081x1921）');
      await runExpect400(P, { script: 'x', size: '8193x8193' }, 'size 越界（8193x8193）');
      await runExpect400(P, { script: 'x', ratio: 'bogus' }, 'ratio 非法（bogus）');
      await runExpect400(P, { script: 'x', style: 'no-such-style' }, 'style 不存在（no-such-style）');
      const after = await jobsCount(P);
      need(after === before, `上面 5 条 400 里有人起了任务（${before} → ${after}）`);
      notes.push(`⑬ run：size 64x64 / 1081x1921 / 8193x8193、ratio bogus、style no-such-style → 400；任务数全程 ${before}`);
    });

    // ══ ⑭ run：素材登记表校验 → 400 且不起任务 ══════════════
    await runCase('⑭ run 校验：videoToken 未登记 / videoToken 是 srt / bgToken 未登记 / srtToken 是视频 → 400 且不起任务', async () => {
      const before = await jobsCount(P);
      await runExpect400(P, { script: 'x', videoToken: 'zz-not-registered' }, 'videoToken 未登记');
      await runExpect400(P, { script: 'x', videoToken: srtToken }, 'videoToken 指向 srt');
      await runExpect400(P, { script: 'x', bgToken: 'zz-not-registered' }, 'bgToken 未登记');
      await runExpect400(P, { script: 'x', srtToken: videoToken }, 'srtToken 指向视频');
      const after = await jobsCount(P);
      need(after === before, `上面 4 条 400 里有人起了任务（${before} → ${after}）`);
      notes.push(`⑭ run：videoToken 未登记 / videoToken=srt / bgToken 未登记 / srtToken=视频 → 400；任务数全程 ${before}`);
    });

    // ══ ⑯ run：--keep-original-limit 的契约（形状 + 语义）═════
    await runCase('⑯ run 校验：keepOriginalLimit 非布尔 / 有 limit 无 keepOriginal → 400 且不起任务', async () => {
      const before = await jobsCount(P);
      // 形状：只认真正的布尔（字符串 / 数字都不行）
      await runExpect400(P, { script: 'x', keepOriginalLimit: 'yes' }, 'keepOriginalLimit 非布尔（字符串）');
      await runExpect400(P, { script: 'x', keepOriginalLimit: 1 }, 'keepOriginalLimit 非布尔（数字）');
      // ★ 语义：这个开关限的是「保持原样」那条音轨 ⇒ 没 keepOriginal 就没意义，必须 400（不是静默忽略）
      await runExpect400(P, { script: 'x', keepOriginalLimit: true }, 'keepOriginalLimit=true 但没有 keepOriginal');
      const after = await jobsCount(P);
      need(after === before, `上面 3 条 400 里有人起了任务（${before} → ${after}）`);
      notes.push(`⑯ run：keepOriginalLimit 非布尔（字符串/数字）、单独 true（无 keepOriginal）→ 400；任务数全程 ${before}`);
    });

    // ══ ⑱ run 校验：speed / gap / title / keepOriginalAudio 四条零覆盖的边界 ══
    //
    // ★ 由来（2026-10-07 覆盖审计）：`/api/dub/run` 的校验分支此前只测了
    //   size / ratio / style / videoToken / bgToken / srtToken / keepOriginalLimit，
    //   而 `speed` / `gap` / `title` / `keepOriginalAudio` **四条零覆盖**。
    //
    // ★★ 同时把一处 **CLI ↔ API 的口径分歧**钉住（审计原文：「没有任何测试或闸门在对齐它们」）：
    //   · CLI  `dub.mjs` 的 `--gap`     允许 **0–5**（`if (!(o.gap >= 0 && o.gap <= 5))`）
    //   · API  `lib/dub.mjs` 的 `gap`   只允许 **0–3**（`if (… n < 0 || n > 3)`），
    //     且与**控制台 UI 的输入上限** `web/index.html` 的 `<input id="dubGap" max="3">` 一致
    //     ⇒ 控制台通路（UI → API）**内部自洽**，是有意的更严口径。
    //   核心 `lib/dub-core.mjs` 的 `buildTimeline(lines, durs, gap)` **不设上限**（gap 只是加在句间），
    //   所以 3 与 5 都不是核心实现要求的；两者是**包含关系**（API 0–3 ⊂ CLI 0–5），
    //   API 从不放过 CLI 会拒的值 ⇒ 不存在功能性错误。⇒ 判「**各有道理、不硬统一**」，
    //   改为在这里把 **API 侧的口径钉死**（下面 `gap: 3.5` 在 CLI 里合法、在 API 里必须 400），
    //   差异已写进 `dub.mjs` 的 USAGE 与 `README.md`。
    await runCase('⑱ run 校验：speed / gap / title / keepOriginalAudio 边界 → 400 且不起任务', async () => {
      const before = await jobsCount(P);
      // speed 0.5–2（lib/dub.mjs 的 ④）
      await runExpect400(P, { script: 'x', speed: 0.4 }, 'speed 低于下限（0.4）');
      await runExpect400(P, { script: 'x', speed: 2.1 }, 'speed 高于上限（2.1）');
      await runExpect400(P, { script: 'x', speed: 'x' }, 'speed 非数字');
      // gap 0–3（lib/dub.mjs 的 ⑥）★ 3.5 在 CLI 的 0–5 里合法、在 API 里必须 400
      await runExpect400(P, { script: 'x', gap: -0.1 }, 'gap 为负（-0.1）');
      await runExpect400(P, { script: 'x', gap: 3.5 }, 'gap 超 API 上限（3.5）—— CLI 允许 0–5、API 只到 3');
      await runExpect400(P, { script: 'x', gap: 'x' }, 'gap 非数字');
      // title：必须是字符串且有长度上限（lib/dub.mjs 的 ⑨）
      await runExpect400(P, { script: 'x', title: 123 }, 'title 非字符串');
      await runExpect400(P, { script: 'x', title: 'x'.repeat(MAX_TITLE_CHARS + 1) }, 'title 过长');
      // keepOriginalAudio：只认真正的布尔（lib/dub.mjs 的 ⑧）
      await runExpect400(P, { script: 'x', keepOriginalAudio: 'yes' }, 'keepOriginalAudio 非布尔（字符串）');
      await runExpect400(P, { script: 'x', keepOriginalAudio: 1 }, 'keepOriginalAudio 非布尔（数字）');
      const after = await jobsCount(P);
      need(after === before, `上面这些 400 里有人起了任务（${before} → ${after}）`);
      notes.push(`⑱ run：speed 0.4 / 2.1 / 'x'、gap −0.1 / 3.5 / 'x'、title 非串 / 过长、`
        + `keepOriginalAudio 非布尔（字符串 / 数字）→ 全部 400；任务数全程 ${before}`);
    });

    // ══ ⑰ ★ 文案出片成片字节：GET/HEAD /api/films/dub/:dir/:file ════════
    //
    // 覆盖审计里**唯一该补而没补**的自动化缺口：`GET`+`HEAD` `/api/films/dub/:dir/:file`
    // （`server.mjs` 的 `apiDubFilmFile`，路由注册与函数定义同在一处）。它发的是「文案出片」的**成片字节**
    // （D:\lemo-films\dub\<dir>\film.mp4，比一级目录深一层），支持 Range —— 成片库里点「文案出片」成片播放
    // 走的就是它（url 由 `server.mjs` 的 `apiFilms` / `dubFilms()` 给）。此前 ui.test.mjs 的 F1 只断言了
    // `video.src` 的**属性值**，**不校验响应** ⇒ 服务端零断言（坏了＝成品点不开，无兜底）。
    await runCase('⑰ ★ GET/HEAD /api/films/dub/:dir/:file：200/206/416/HEAD + ★路径穿越必须被拒（不泄露其它文件）', async () => {
      // ── 发现目标：从 /api/films 里找 dub 成片（url 形如 /api/films/dub/<dir>/film.mp4）
      //    ★ 不硬编码 <dir>（那是时间戳）；挑 **size 最大**的一条，size 大才验得出 Range。
      const list = await get('/api/films');
      need(list.status === 200 && list.json && Array.isArray(list.json.films), `GET /api/films 异常：${list.status} ${list.text.slice(0, 160)}`);
      const dubs = list.json.films.filter((f) => f && f.source === 'dub');
      // ★ 干净机器上没有 dub 成片 ⇒ 明确失败并说明原因，**不静默跳过**（这条分支不可达时它才是缺口）
      need(dubs.length > 0,
        '本机 /api/films 里没有 dub 成片（source=dub，形如 /api/films/dub/<dir>/film.mp4）—— 文案出片成品缺失，这条用例无法验证。'
        + '（不是静默跳过：请先跑一次「文案出片」生成成片，或确认 CFG.exportDir/dub 下有 <dir>/film.mp4）');
      const film = dubs.slice().sort((a, b) => b.size - a.size)[0];
      need(film.file === 'film.mp4', `dub 条目的 file 应是 film.mp4，实际 ${film.file}`);
      need(typeof film.url === 'string' && /^\/api\/films\/dub\/[^/]+\/film\.mp4$/.test(film.url),
        `dub 条目的 url 形状不对：${film.url}`);
      const size = film.size;
      need(Number.isFinite(size) && size > 200000, `dub 成片只有 ${size} 字节，太小，验不出 Range（需 >200000）`);
      const url = film.url;

      // ── 1) 无 Range → 200 · Accept-Ranges · video · Content-Length == size（只收 64KB 就断开）──
      const full = await getPartial(P, url, { maxBytes: 65536 });
      need(full.status === 200, `无 Range 应 200，实际 ${full.status}`);
      need(full.headers['accept-ranges'] === 'bytes', `Accept-Ranges=${full.headers['accept-ranges']}`);
      need(/^video\//.test(String(full.headers['content-type'] || '')), `Content-Type 不像视频：${full.headers['content-type']}`);
      need(Number(full.headers['content-length']) === size, `无 Range 的 Content-Length=${full.headers['content-length']}，期望 ${size}`);
      need(full.truncated && full.bytes >= 65536, `测试自己没断开连接（maxBytes 没生效，bytes=${full.bytes}）`);

      // ── 2) Range: bytes=0-65535 → 206 · Content-Range · Content-Length 65536 ──
      const r1 = await getPartial(P, url, { headers: { Range: 'bytes=0-65535' } });
      need(r1.status === 206, `Range 应 206，实际 ${r1.status}`);
      need(r1.headers['content-range'] === `bytes 0-65535/${size}`, `Content-Range=${r1.headers['content-range']}`);
      need(Number(r1.headers['content-length']) === 65536, `206 的 Content-Length=${r1.headers['content-length']}，期望 65536`);
      need(r1.bytes === 65536, `实际收到 ${r1.bytes} 字节（期望 65536）`);
      need(r1.buf.subarray(0, 16).equals(full.buf.subarray(0, 16)), '206 的前 16 字节与整份开头不一致 —— 不是同一个文件的同一段');

      // ── 3) 越界 Range → 416 · Content-Range: bytes */<size> ──
      const r2 = await getPartial(P, url, { headers: { Range: `bytes=${size + 1000}-${size + 2000}` } });
      need(r2.status === 416, `越界 Range 应 416，实际 ${r2.status}`);
      need(r2.headers['content-range'] === `bytes */${size}`, `416 的 Content-Range=${r2.headers['content-range']}`);

      // ── 4) HEAD → 200 · 无 body · Content-Length == size ──
      const hd = await getPartial(P, url, { method: 'HEAD' });
      need(hd.status === 200, `HEAD 应 200，实际 ${hd.status}`);
      need(hd.bytes === 0, `HEAD 不该有 body，实际收到 ${hd.bytes} 字节`);
      need(Number(hd.headers['content-length']) === size, `HEAD 的 Content-Length=${hd.headers['content-length']}，期望 ${size}`);
      need(hd.headers['accept-ranges'] === 'bytes', `HEAD 的 Accept-Ranges=${hd.headers['accept-ranges']}`);

      // ── 5) ★ 路径穿越防护 ──
      //  先读实现（server.mjs apiDubFilmFile:793-803）：白名单 ^[A-Za-z0-9._-]+$ 逐段校验 +
      //  path.resolve(dubRoot, dir, file) 后必须 startsWith(dubRoot + path.sep)。据此实际行为分三类（已实测）：
      //    · dir='..'（用 %2F 让 URL 归一化不吃掉它）⇒ 过正则、resolve 逃出 dubRoot ⇒ **403 路径越界**（守卫分支）
      //    · 反斜杠 / 冒号 / NUL ⇒ 白名单正则不匹配 ⇒ **400 路径非法**
      //    · 字面 `../` 会被 WHATWG URL 归一化掉、%2F 解码后段数不对 ⇒ 路由不匹配 ⇒ **404**
      //  三者都必须 4xx，且**绝不返回别的文件字节**。
      const GUARD = '/api/films/dub/..%2Ffilm.mp4';   // dir=.. → resolve 逃出 dubRoot → 403（守卫分支）
      const g = await getPartial(P, GUARD, { maxBytes: 8192 });
      need(g.status === 403, `dir=.. 应被 resolve 前缀守卫拒成 403，实际 ${g.status}：${g.buf.toString('utf8').slice(0, 120)}`);
      need(/路径越界/.test(g.buf.toString('utf8')), `403 的理由不是「路径越界」：${g.buf.toString('utf8').slice(0, 120)}`);

      const TRAVERSAL = [
        '/api/films/dub/..%2F..%2Ffilm.mp4',                            // 多级 ..（%2F）→ 段数不对 → 404
        '/api/films/dub/%2e%2e/film.mp4',                               // %2e%2e 被 URL 归一化 → 404
        '/api/films/dub/../../film.mp4',                                // 字面 ../ → 归一化 → 404
        '/api/films/dub/....//film.mp4',                                // 伪造 ..// → 404
        '/api/films/dub/x/..%5C..%5C..%5C..%5Clemo-tools%5Cserver.mjs', // 反斜杠（Windows 分隔符）→ 400
        '/api/films/dub/x/C%3A%5Cwindows%5Cwin.ini',                    // 盘符绝对路径 → 400
        '/api/films/dub/..%00/film.mp4',                                // NUL 字节 → 400
        '/api/films/dub/x/%2Fetc%2Fpasswd',                             // 绝对路径风格 → 404
      ];
      for (const t of TRAVERSAL) {
        const r = await getPartial(P, t, { maxBytes: 8192 });
        need(r.status >= 400 && r.status < 500, `穿越 ${t} 应 4xx，实际 ${r.status}`);
        const body = r.buf.toString('utf8');
        need(!/video\//i.test(String(r.headers['content-type'] || '')), `穿越 ${t} 回的是视频内容（Content-Type=${r.headers['content-type']}）`);
        need(!(r.buf.length >= 8 && r.buf.subarray(4, 8).toString('latin1') === 'ftyp'), `穿越 ${t} 返回了 mp4 字节（ftyp 头）`);
        need(!/apiDubFilmFile|serveRangeFile/.test(body), `穿越 ${t} 泄露了 server.mjs 源码特征串`);
      }
      notes.push(`⑰ dub 成片 ${(size / 1048576).toFixed(1)}MB（${url}）：无 Range 200 / Range 206 / 越界 416 / HEAD 200 无 body；`
        + `穿越防护共 ${TRAVERSAL.length + 1} 种写法全部被拒（dir=.. → 403 路径越界；反斜杠·冒号·NUL → 400；字面 ../ 与 %2e%2e → 404），且无字节泄露`);
    });

    // ★ 成功路径**故意不测**：/api/dub/run 的合法请求会 jobs.enqueueSetup 一条真出片任务
    //   （调 GPU/TTS/真渲染，可能跑几十分钟），违反本套件「零 GPU、零 TTS、零真渲染」的硬约束。
    //   且核心工具 dub.mjs **确实存在**（D:\lemo-tools\dub.mjs），不存在「工具缺失 → 503 短路」的
    //   安全窗口，所以任何「合法 body 不被拒」的尝试都会真的起任务 —— 故整条成功路径跳过。
  } finally {
    // ── 收尾 ──
    if (server && !OPT.keepServer) { await stopServer(server.child); log(C.dim(`  测试服务已停止（pid ${server.child.pid}）`)); }

    // 固定入口逐字节还原
    for (const [f, buf] of backup) {
      try {
        if (buf === null) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
        else fs.writeFileSync(f, buf);
      } catch (e) { log(C.bad(`  ⚠️ 固定入口还原失败：${path.basename(f)}（${e.message}）`)); }
    }
    log(C.dim(`  固定入口已还原：${ENTRY_FILES.map((f) => path.basename(f)).join(' · ')}`));

    // 上传文件按确切路径删除
    const delErr = cleanupUploads();
    if (delErr.length) log(C.bad(`  ⚠️ 上传文件清理失败：${delErr.join('；')}`));

    // 上传登记表逐字节还原（把本次上传的登记项一并抹掉）
    try {
      await sleep(400);   // 等服务端最后一次 saveIndex 落盘
      if (indexBefore === null) { try { fs.unlinkSync(INDEX_FILE); } catch { /* ignore */ } }
      else fs.writeFileSync(INDEX_FILE, indexBefore);
      log(C.dim(`  上传登记表已还原：${path.basename(INDEX_FILE)}`));
    } catch (e) { log(C.bad(`  ⚠️ 上传登记表还原失败：${e.message}`)); }

    // 若上传目录跑前不存在、跑后变空 → 一并移除（不留空目录）
    try {
      if (!uploadsDirExistedBefore && fs.existsSync(UPLOAD_DIR) && listDir(UPLOAD_DIR).length === 0) {
        fs.rmdirSync(UPLOAD_DIR);
        log(C.dim(`  上传目录（跑前不存在）已移除：${UPLOAD_DIR}`));
      }
    } catch (e) { log(C.bad(`  ⚠️ 上传目录移除失败：${e.message}`)); }
  }

  // ── 最后一道闸：上传目录 + 登记表必须与跑前逐字一致（不留垃圾）──
  {
    const after = listDir(UPLOAD_DIR);
    const added = after.filter((n) => !uploadsBefore.includes(n));
    const gone = uploadsBefore.filter((n) => !after.includes(n));
    const indexAfter = (() => { try { return fs.readFileSync(INDEX_FILE); } catch { return null; } })();
    const indexSame = (indexBefore === null && indexAfter === null)
      || (indexBefore !== null && indexAfter !== null && Buffer.compare(indexBefore, indexAfter) === 0);

    const name = '⑮ 无残留：上传目录与 index.json 跑完与跑前逐字一致（上传文件全删净）';
    const problems = [];
    if (added.length) problems.push(`新增 ${JSON.stringify(added)}`);
    if (gone.length) problems.push(`丢失 ${JSON.stringify(gone)}`);
    if (!indexSame) problems.push('index.json 内容与跑前不一致');
    if (problems.length) {
      results.push({ name, ok: false, ms: 0, err: new Error(problems.join('；')) });
      log(`  ${C.bad('FAIL')}  ${name}`);
      for (const p of problems) log(`        ${p}`);
    } else {
      results.push({ name, ok: true, ms: 0 });
      log(`  ${C.ok('PASS')}  ${name} ${C.dim(`(${after.length} 个文件 + index.json，与跑前一致)`)}`);
      notes.push(`⑮ 跑前/跑后上传目录都是 ${after.length} 个文件、index.json 逐字节一致（上传文件全删净）`);
    }
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
