#!/usr/bin/env node
/**
 * test/ui.test.mjs —— lemo 控制台 **Web UI 层**测试（第四批新增，独立入口）
 *
 * 为什么单独一个入口：`test/README.md` 里如实写着「Web UI 交互：一条都没测」——
 * 现有 42 条全是服务端的（smoke 30 + setup 12），只保证「服务端发给前端的数据是对的」，
 *   ★ 2026-10-08 复核：服务端侧现为 smoke **41** + setup **12** = **53** 条（「42 = 30 + 12」是写本文件时的快照）；
 *     本文件（UI 层）现为 **65** 条（★ 2026-10-09：I 组加 I6 后 64 → 65）。
 * 不保证「前端渲染出来是对的」。这个文件补的就是这一段。
 *
 * 批次：A/B/C/D（前四批）+ E（第五批：文案出片面板）+ F（第六批：补三处 UI 盲区）
 *   + **G（第七批：补剩余可点击路径 + 一个刚新增的功能开关）** + **I（第八批：LLM API 配置面板）**。
 *   E 补的是「文案出片」这张卡片的**用户点击路径** —— 形态切换、断句逐字一致、分析、风格下拉、
 *   出片请求体契约（形态 1 / 形态 2）、以及三条**纯前端拦截**（空文案 / 形态 2 无素材 / 尺寸非法）。
 *   这三条拦截服务端测不到（前端先拦，请求根本不发出去），只有 UI 层能钉住。
 *   E7 会真上传一个极小的假 mp4（拿真实 videoToken）—— 落盘文件与上传登记表在 finally 里按
 *   确切路径删除 / 逐字节还原。
 *   F 补的是三处「整块静默失明」的版块（渲染/交互/契约三档全空）：播放器弹层 #playerModal、
 *   窄屏侧栏切换 #btnToggleSide、顶栏「重新检测」#btnRefreshEnv / 「演练」#btnSimulate。
 *   判据都带一条「有牙」的非平凡断言（transform 真的变了 / 请求真的发出去了 / 标题与视频源自洽）。
 *   G 补的是审计点名、此前覆盖薄弱/为零的剩余版块：形态 2 的「限幅」复选框 #dubKeepLimit（**本轮
 *   新加的功能**，默认关必须「与加功能前逐字节一致」= 不勾时不发那个键）、成片库 #films（此前一条
 *   UI 用例都没有）、声音版块三处（试合成 / 导入 / 重置为内容文件默认）、主题出片的「生成工单」、
 *   任务列表的行内「取消」（用户主动取消 ≠ 失败，文案必须中性）、启动表单的「常用组合」预设与「复制」。
 *   ★ 重活一律用**页面内 patch window.fetch** 拦下短路（真 TTS 合成 / 真导入 / 真出片绝不触发）；
 *     真落盘的工单（BRIEF_IDS）与真入队的任务（JOB_IDS）在 finally 里清干净。
 *   I 补的是 **LLM API 配置面板**（`/api/llm/*`）—— 此前在 UI 层**零覆盖**（探针只在 `D:/lemo-tmp/`，
 *   不进仓）。四条断言：① 顶栏「LLM 配置」入口可达（点了给卡片加 .flash 并滚进视口）；
 *   ② 「当前默认：WorkBuddy」胶囊默认态可见、切走变「已切换：…」；③ 多模型切换（拉取模型 → 下拉候选
 *   → 选中回填模型名输入框，手填兜底仍在）★ 并钉住规格 v3「**agent 模式禁止拉取模型清单**」（按钮不可见 + 强触发被后端拒）；④ **坏后端不白屏**（
 *   patch `window.fetch` 只拦 `/api/llm/*`，造 4 类坏响应：网络失败 / 500+HTML / 空 body / `{ok:false}`
 *   结构异常 ⇒ 逐个点校验·试一句·拉取模型 ⇒ 面板仍在且有内容 + 未捕获异常 **0**）；⑤ 落盘隔离 + 保存刷新后候选仍在；
 *   ⑥ **`workbuddy-gateway` kind 认得**（默认态 `#llmKind` 显示的就是它 + hint 解释 + 试跑经**本地网关桩**取回文本 —— ★ 绝不指向真实网关）。
 *   ★★ 落盘隔离：I 组另起一个**专用测试服务**（`LEMO_FILM_DIR` 指向临时树）⇒ 覆盖文件
 *     `<成片根>/_llm-api.json` 写进临时树，**绝不碰真实 `D:/lemo-films/_llm-api.json`**（用例里
 *     读真实文件前后快照逐字节比对当红线）。上游是**本地 mock**（不打真实外网），跑完随临时树删除。
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
import * as dub from '../lib/dub.mjs';     // 只借常量（UPLOAD_DIR）；顶层无副作用（与 dub-api.test.mjs 同款）

// ★ 起服务的测试实例不该写用户的固定入口文件（.console-port / 打开控制台.url）——
//   否则每跑一次测试就把它们改成测试端口；跑崩时还原语句没执行，脏值还会残留（见 server.mjs 文件头）。
//   设了这个环境变量，本进程 spawn 出的 server.mjs 会跳过写入。下面的备份/还原是第二道防线，保留。
process.env.LEMO_CONSOLE_NO_ENTRY_FILES = '1';

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
// E7 要真的上传一个极小的假 mp4（为了拿到一个真实 videoToken 走形态 2）——
// 它落在 dub 的上传目录里，跑前按字节备份登记表、跑完按**确切路径**删文件并还原登记表。
const DUB_INDEX_FILE = path.join(dub.UPLOAD_DIR, 'index.json');

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

/** /api/dub/upload 收的是 **raw body**（不是 multipart）：文件名走 query、字节走 body。 */
function uploadDubRaw(port, name, buf) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8');
    const req = http.request({
      host: '127.0.0.1', port, method: 'POST',
      path: `/api/dub/upload?name=${encodeURIComponent(name)}`,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': payload.length,
        Accept: 'application/json', Connection: 'close',
      },
      agent: false,
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* 不是 JSON 就算了 */ }
        resolve({ status: res.statusCode, text, json });
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error('上传超时')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── 测试服务 ────────────────────────────────────────────────
// ★ I 组（LLM 面板）要一个**落盘隔离**的测试服务：把 `LEMO_FILM_DIR` 指到临时树 ⇒
//   覆盖文件 `<成片根>/_llm-api.json` 写进临时树，**绝不碰真实 `D:/lemo-films/_llm-api.json`**。
//   `extraEnv` 是**追加**的（不传 = 与既有行为逐字一致），所以 B~H 组的主服务一点没变。
function spawnServer(port, extraEnv = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.mjs', '--port', String(port)], {
      cwd: ROOT, windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...(extraEnv || {}) },
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

async function startServer(attempts = 3, extraEnv = null) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await spawnServer(await freePort(), extraEnv); }
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

/**
 * ★ I3 用的**正常**上游：一个极小的 OpenAI 兼容 mock（只服务「拉取模型」要的 `GET /v1/models`）。
 *   · 候选清单写死 3 个，便于断言「下拉里恰好出现这 3 个」；★ 不打真实外网。
 *   · 用完在 finally 里 close（+ closeAllConnections，免得 keep-alive 连接把 close 挂住）。
 */
const LLM_MOCK_MODELS = ['mock-alpha', 'mock-beta', 'mock-gamma'];
function startLlmMock(port) {
  const srv = http.createServer((req, res) => {
    const send = (code, obj) => {
      const b = Buffer.from(JSON.stringify(obj), 'utf8');
      res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': b.length });
      res.end(b);
    };
    if (req.method === 'GET' && req.url === '/v1/models') {
      return send(200, { data: LLM_MOCK_MODELS.map((id) => ({ id })) });
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      req.on('data', () => { /* 丢掉请求体 */ });
      req.on('end', () => send(200, { choices: [{ message: { role: 'assistant', content: 'pong（ui-mock）' } }], usage: { total_tokens: 5 } }));
      return;
    }
    send(404, { error: 'not found' });
  });
  return new Promise((resolve, reject) => {
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

/**
 * ★★ I6 用的**本机智能体网关桩**（`kind:'workbuddy-gateway'`）。
 *   ★ 纪律：**绝不**打真实网关的 `POST /api/v1/runs` —— 那会**真正发起一次 Agent 执行**、且网关的
 *     `getOrCreateSession` 会落到**委托方当前会话** ⇒ **干扰用户工作**。试跑一律指向本桩（127.0.0.1:0，用完关闭）。
 *   ★ 协议同网关实现（两段式）：`POST /api/v1/runs` → `202 {data:{runId}}`，
 *     再 `GET /api/v1/runs/{runId}/stream`（SSE：`event: message` 出站消息 + `event: done`）。
 *     与 `test/llm-api.test.mjs` 的 `startGatewayStub` 同形。
 */
const GW_STUB_TEXT = '网关桩回复：你好';
function startGwStub(port) {
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/v1/runs') {
      req.on('data', () => { /* 丢掉请求体 */ });
      req.on('end', () => {
        const b = Buffer.from(JSON.stringify({ data: { runId: 'run-ui-1', status: 'accepted' } }), 'utf8');
        res.writeHead(202, { 'Content-Type': 'application/json', 'Content-Length': b.length });
        res.end(b);
      });
      return;
    }
    if (req.method === 'GET' && /^\/api\/v1\/runs\/[^/]+\/stream$/.test(req.url)) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(frame('message', { version: '1.0', replyTo: 'stub', status: 'streaming', content: { chunk: '网关桩' } }));
      res.write(frame('message', { version: '1.0', replyTo: 'stub', status: 'completed', content: { markdown: GW_STUB_TEXT } }));
      res.write(frame('done', {}));
      res.end();
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":{"code":"NOT_FOUND"}}');
  });
  return new Promise((resolve, reject) => {
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
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
function dumpDomOnce(edge, url, { budgetMs = 9000, timeoutMs = 120000 } = {}) {
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

/**
 * ★ 为什么包一层「超时重试」：本机**第一次**启动无头 Edge 特别慢，而且跟在 smoke 套件之后更慢。
 *   实测（第六批）：单独跑 A1 的 dump-dom 约 **15.5s**；紧跟 `test/smoke.mjs` 之后跑，
 *   同一个调用 **>60s 被超时掐掉**（两次复现）；而同一次跑里的第二次 dump-dom（A7）只要 **3.7s**。
 *   也就是说超时**不代表页面渲染坏了**，只代表「这台机的第一次浏览器启动慢」。
 *   本项目的环境纪律里本来就写着「慢不等于失败」，所以这里只对**超时**重试一次，
 *   且每次重试用新的 profile 目录（`freshProfile()` 在 dumpDomOnce 里）。
 *   ★ 重试只兜住「启动慢」；页面真坏了仍会被断言抓住（拿不到 `<html>` 时**不重试**，直接抛）。
 */
async function dumpDom(edge, url, { attempts = 2, ...opts } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await dumpDomOnce(edge, url, opts); }
    catch (e) {
      last = e;
      if (!/超时/.test(String(e && e.message))) throw e;   // 不是超时 → 页面真有问题，不掩盖
    }
  }
  throw last;
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
  // ★ I4「坏后端不白屏」要断言**未捕获异常数 == 0** ⇒ 这里开始记录所有 CDP 事件
  //   （`Runtime.exceptionThrown` 既覆盖同步未捕获错误，也覆盖未处理的 Promise rejection）。
  //   只新增一条 `else if`，**不影响**原有的「按 id 匹配请求响应」路径。
  const events = [];
  ws.handlers.push((m) => {
    if (m.id && pending.has(m.id)) { const fn = pending.get(m.id); pending.delete(m.id); fn(m); }
    else if (m.method) events.push(m);
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

  /** 累计的**未捕获异常**（文本化，便于失败时直接打印）。 */
  const exceptions = () => events.filter((e) => e.method === 'Runtime.exceptionThrown').map((e) => {
    const d = (e.params && e.params.exceptionDetails) || {};
    return `${d.text || ''} ${(d.exception && d.exception.description) || ''}`.trim();
  });

  return { child, cmd, evalJs, goto, close, exceptions };
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
const BRIEF_IDS = new Set();       // 本批新增：D4 会建一张测试工单，跑完必须删掉

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

/** D4 建的测试工单：删掉（工单在出片跑完前不能删 → 对 409 重试几次）。必须**在停服务之前**调。 */
async function cleanupBriefs(port) {
  const rep = { removed: [], errors: [] };
  if (!BRIEF_IDS.size) return rep;
  for (const id of BRIEF_IDS) {
    let last = null;
    for (let i = 0; i < 20; i++) {
      try {
        const r = await httpRequest(port, 'DELETE', '/api/briefs/' + encodeURIComponent(id));
        last = r;
        if (r.status === 200) { rep.removed.push(id); last = null; break; }
        if (r.status === 404) { last = null; break; }          // 已经被删掉了 → 当成成功
        if (r.status !== 409) break;                           // 409 = 还在出片，等一会再删
      } catch (e) { last = { status: 0, text: String(e.message || e) }; }
      await sleep(500);
    }
    if (last) rep.errors.push(`${id}: ${last.status} ${String(last.text || '').slice(0, 100)}`);
  }
  BRIEF_IDS.clear();
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

// ★ F1 若本机成片库为空，会**临时**在 CFG.exportDir 下造一个不以 `_`/`.` 开头的目录放一个极小的假
//   成片（播放器只 `preload="metadata"`，几字节即可，不需要真能解码）—— 为了触发播放器弹层。
//   跑完按**确切路径**递归删除（登记在这里；绝不用通配符删）。
//   G2（成片库）复用同一套：本机成片库为空时也要造假成片，绝不静默跳过。
const CREATED_FILM_DIRS = new Set();

function cleanupFilmDirs() {
  const errors = [];
  for (const d of CREATED_FILM_DIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); }
    catch (e) { errors.push(`${d}：${e.message}`); }
  }
  CREATED_FILM_DIRS.clear();
  return errors;
}

// ★ G8（声音·导入）需要一个「待导入」的源文件才会渲染出「导入」按钮 —— 干净机器上源目录里
//   全是「已导入」时造一个极小的假 mp3（落在**非 C 盘**的源目录里），跑完按**确切路径**删。
const CREATED_VOICE_SRCS = new Set();

function cleanupVoiceSrcs() {
  const errors = [];
  for (const p of CREATED_VOICE_SRCS) {
    try { fs.unlinkSync(p); } catch (e) { if (e.code !== 'ENOENT') errors.push(`${p}：${e.message}`); }
  }
  CREATED_VOICE_SRCS.clear();
  return errors;
}

// ★ G11 取消一条 running 的 dry-run 任务会留下编排器的**陈旧锁**（releaseLock 挂在 process 的
//   'exit' 钩子上，被 taskkill /F 硬杀时不会执行）—— 登记「确切路径 + 期望 pid」，跑完**只删
//   pid 完全对得上的那一个**（与 test/cases.mjs ⑥ 同款纪律；绝不用通配符）。
const CREATED_LOCKS = new Map();     // lockPath -> pid

function cleanupLocks() {
  const errors = [];
  for (const [p, pid] of CREATED_LOCKS) {
    try {
      if (!fs.existsSync(p)) continue;
      const lockPid = Number(String(fs.readFileSync(p, 'utf8')).split('\n')[0]);
      if (lockPid === pid) fs.unlinkSync(p);
    } catch (e) { errors.push(`${p}：${e.message}`); }
  }
  CREATED_LOCKS.clear();
  return errors;
}

// ★ E7 上传的假 mp4：按**确切路径**删掉，并把上传登记表逐字节还原（不留垃圾、不留假素材）。
const DUB_UPLOAD_PATHS = new Set();
let dubIndexBackup;                  // undefined = 本批没上传过；null = 跑前没有 index.json

function cleanupDubUploads() {
  const errors = [];
  for (const p of DUB_UPLOAD_PATHS) {
    try { fs.unlinkSync(p); } catch (e) { if (e.code !== 'ENOENT') errors.push(`${p}：${e.message}`); }
  }
  DUB_UPLOAD_PATHS.clear();
  if (dubIndexBackup !== undefined) {
    try {
      if (dubIndexBackup === null) { try { fs.unlinkSync(DUB_INDEX_FILE); } catch { /* ignore */ } }
      else fs.writeFileSync(DUB_INDEX_FILE, dubIndexBackup);
    } catch (e) { errors.push(`${DUB_INDEX_FILE} 还原失败：${e.message}`); }
    dubIndexBackup = undefined;
  }
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
    // ★ hover 态也算「正文」：--bg-3 是 .envbar / .style-group-head / .style-item / .film
    //   的 hover 底色，里面的 .env-sum / .caret / .gen / .si-sub 就是 --fg-faint，
    //   用户在 hover 时同样在读这些字 —— 所以 hover 态也必须 ≥ 4.5。
    //   （第二轮补：深色原值 on --bg-3 只有 4.14、浅色 4.43，都低于 AA，已一并修正。）
    ['弱化 --fg-faint on --bg-3（hover 底色）', v['fg-faint'], v['bg-3'], 4.5],
    ['次要 --fg-dim on --bg-3（hover 底色）', v['fg-dim'], v['bg-3'], 4.5],
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
  // ★ 回归钉子：本文件顶已设 LEMO_CONSOLE_NO_ENTRY_FILES=1，测试服务**不该**写这两个文件。
  //   非 null ⇒ 跑完发现它们被动过（钉子红了，见 finally 里的比对）。不混进 runCase 的用例计数。
  let entryTouched = null;

  let server = null;
  let cdp = null;
  // ★ I 组（LLM 面板）专用：一个**落盘隔离**的测试服务 + 一个正常上游 mock。
  let llmServer = null;
  let llmMock = null;
  let llmGwStub = null;      // ★ I6 用的本机智能体网关桩（绝不指向真实网关）
  const state = {};

  try {
    server = await startServer();
    log(C.dim(`  测试服务已起 → http://127.0.0.1:${server.port}  (pid ${server.child.pid})`));
    const base = `http://127.0.0.1:${server.port}`;
    const get = (p) => httpRequest(server.port, 'GET', p);
    const post = (p, b) => httpRequest(server.port, 'POST', p, b);
    const patch = (p, b) => httpRequest(server.port, 'PATCH', p, b);

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
    state.patch = patch;
    log(C.dim(`  风格 ${styleCount} 个；本用例用 ${state.slugA} / ${state.slugB}`));

    // 声音版块：先打一次 /api/voices 把服务端缓存预热（首次要起 python，D1 才不会等太久），
    // 并记下服务端的音色条数 —— D1 拿它当「DOM 里该渲染几条」的判据（不硬编码）。
    const voices = await get('/api/voices');
    need(voices.status === 200 && voices.json && voices.json.ok === true,
      `GET /api/voices → ${voices.status} / ok=${voices.json && voices.json.ok}（音色清单读不到，「声音」版块测不了）`);
    state.voiceCount = (voices.json.voices || []).length;
    need(state.voiceCount > 0, '服务端返回的音色清单是空的 —— 这台机器没装 Index-TTS 参考音？');
    log(C.dim(`  音色 ${state.voiceCount} 条（声音版块用）`));

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

    await runCase('A5 两套主题的文字对比度全部过 WCAG AA（深色是默认主题，同样要达标）', async () => {
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

      // ★ 深色是**默认主题**，所以它同样要达标 —— 第五批修的就是深色 --fg-faint
      //   （原 #5d6b7c：on --bg 3.48 / on --bg-2 3.21，都是 12px 小字，AA 要求 4.5）。
      //   两套主题共用同一份 contrastPairs，避免「浅色卡了、深色漏了」。
      const darkBad = [];
      const darkRows = [];
      for (const [label, f, b, min] of contrastPairs(dark)) {
        const r = contrast(f, b);
        darkRows.push(`${label} = ${r.toFixed(2)}`);
        if (r < min) darkBad.push(`${label}：${r.toFixed(2)} < ${min}`);
      }
      need(darkBad.length === 0, `深色主题下这些文字对比度不达标（WCAG AA）：\n  ${darkBad.join('\n  ')}`);

      const low3 = (arr) => arr.slice()
        .sort((a, b) => parseFloat(a.split('= ')[1]) - parseFloat(b.split('= ')[1]))
        .slice(0, 3).join('；');
      notes.push(`A5 浅色对比度（共 ${rows.length} 项，全部 ≥ 4.5）最低三项：${low3(rows)}`);
      notes.push(`A5 深色对比度（共 ${darkRows.length} 项，全部 ≥ 4.5）最低三项：${low3(darkRows)}`);
    });

    await runCase('A7 演练模式渲染出的文案里没有 `**` 字面量（模板串走 textContent，不认 markdown）', async () => {
      // ★ 为什么要有它：控制台里有两类**纯文本**模板串是经 textContent 渲染的 ——
      //   web/app.js 的 #setupIntro / .env-note，以及 lib/setup.mjs 给手动项写的
      //   manual.note / manual.steps / impact（服务端拼好、前端 el(...) 原样 textContent）。
      //   markdown 的 `**粗体**` 在它们身上会**原样显示成两个星号**。
      //   第五批把 app.js 4 处 + setup.mjs 9 处改成「」引号，这条钉住它不再回潮。
      //   ?simulate=<场景> = 演练模式：这台 12/12 ok 的机器也能看到环境备注与安装引导卡片
      //   （否则那些元素根本不渲染，用例会变成空转）。三个场景合起来覆盖全部卡片的文案。
      const stripComments = (h) => h.replace(/<!--[\s\S]*?-->/g, '');   // index.html 的注释里本来就有 `**`，那不是渲染内容
      const seen = [];
      for (const sc of ['clean', 'bare', 'partial']) {
        const dom = stripComments(await dumpDom(edge, `${base}/?simulate=${sc}`));

        // 反空转：这个场景必须真的渲染出了安装卡片
        const cards = (dom.match(/class="setup-item /g) || []).length;
        need(cards > 0, `?simulate=${sc} 下渲染出 0 张安装卡片 —— 演练模式没生效，这条用例没验到东西`);

        // 全域扫描：渲染出来的 DOM 里一处 `**` 都不该有
        const hits = [...dom.matchAll(/\*\*/g)]
          .map((m) => dom.slice(Math.max(0, m.index - 45), m.index + 45).replace(/\s+/g, ' '));
        need(hits.length === 0,
          `?simulate=${sc} 渲染出的 DOM 里有 ${hits.length} 处 \`**\` 字面量（会被 textContent 原样显示）：\n  ${hits.join('\n  ')}`);

        if (sc === 'bare') {
          // 环境备注（含「演练模式」那句）必须真的渲染出来了
          const envNotes = [...dom.matchAll(/<div class="env-note"[^>]*>([\s\S]*?)<\/div>/g)]
            .map((m) => m[1].replace(/<[^>]*>/g, ''));
          need(envNotes.length > 0, 'DOM 里找不到 .env-note（环境备注没渲染）');
          need(envNotes.some((t) => t.includes('演练模式')),
            `.env-note 里没有「演练模式」字样：${envNotes.join(' | ').slice(0, 160)}`);
        }
        seen.push(`?simulate=${sc} 渲染出 ${cards} 张卡片`);
      }
      notes.push(`A7 演练模式（clean/bare/partial）渲染出的 DOM 里 0 处 \`**\` 字面量；${seen.join('；')}`);
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

      // ★ 先记下「入队前已有的 batchId 集合」，后面只看**新增**的批次。
      //   为什么必须这样：任务历史是**落盘持久化**的（lib/store.mjs），上一次运行留下的
      //   批次任务会留在 /api/jobs 里。若直接断言「batchId 的任务数 === 2」，
      //   本用例**第一次跑会绿、第二次跑必红** —— 那种「时红时绿」的测试比没有测试更糟。
      const priorBatchIds = new Set(
        ((await get('/api/jobs')).json.jobs || []).map((j) => j.batchId).filter(Boolean),
      );

      // 被并发锁占用时按钮 id 会变成 btnBatchGoRisk —— 两个都认
      await cdp.evalJs(`(document.getElementById('btnBatchGo')||document.getElementById('btnBatchGoRisk')).click()`);
      await waitFor(cdp.evalJs, `document.getElementById('batchModal').hidden === true`, { timeoutMs: 20000 });
      await waitFor(cdp.evalJs, `document.getElementById('batchCount').textContent === '已选 0 个'`, { timeoutMs: 20000 });

      // 服务端核实：真的进了 2 条、同一个 batchId、序号 1/2（只看本次新增的批次）
      let batch = [];
      const t0 = Date.now();
      while (Date.now() - t0 < 20000) {
        const r = await get('/api/jobs');
        batch = (r.json.jobs || []).filter((j) => j.batchId && !priorBatchIds.has(j.batchId));
        if (batch.length >= 2) break;
        await sleep(300);
      }
      // ★ 先登记、再断言：万一下面的断言红了，这两个任务也已经进了 JOB_IDS，会由 finally 的
      //   cleanupJobs() 从注册表 + 日志里摘掉。否则「失败的 B7」会把自己刚建的批次标记**留在
      //   .console/index.json 里**，成为下一次运行的毒点（本用例原先「越跑越红」的自我投毒路径）。
      for (const j of batch) JOB_IDS.add(j.id);
      need(batch.length === 2,
        `本次新增的批次任务应为 2 条，实际 ${batch.length} 条` +
        `（入队前已有 ${priorBatchIds.size} 个历史批次，已排除）`);
      const [a, b] = batch.slice().sort((x, y) => x.batchIndex - y.batchIndex);
      need(a.batchId === b.batchId, `两条任务的 batchId 不同：${a.batchId} / ${b.batchId}`);
      need(a.batchIndex === 1 && b.batchIndex === 2, `批次序号是 ${a.batchIndex}/${b.batchIndex}，期望 1/2`);
      need(a.batchTotal === 2 && b.batchTotal === 2, `批次总数是 ${a.batchTotal}/${b.batchTotal}，期望 2`);
      state.batchId = a.batchId;
      state.batchSlugs = batch.map((j) => j.slug);
      notes.push(`B7 入队 2 条：${batch.map((j) => `${j.slug}(${j.batchIndex}/${j.batchTotal})`).join(' ')} · batchId=${a.batchId}`);

      // 任务列表 DOM 里也要能看到批次标记（不是只有接口里有）
      // ★ 只认**本次新建这一批**的标记。任务列表是**跨运行累积**的（注册表 lib/store.mjs 落盘，
      //   上一次运行留下的批次标记会原样留在表里）⇒ 扫全表 `[...#jobs .jbatch]` 会被历史残留绊倒
      //   （实测踩过：表里混进历史 `批 1/1` / `批 2/3` ⇒ 本用例假红，见 test/README.md）。
      //   每个标记都带 `data-batch-id`（web/app.js 渲染时写入）⇒ 据此过滤到本次这批。
      const bid = JSON.stringify(a.batchId);
      const grab = `[...document.querySelectorAll('#jobs .jbatch')].map(n => ({ id: n.dataset.batchId, t: n.textContent }))`;
      await cdp.evalJs(`document.getElementById('btnRefreshJobs').click()`);
      await waitFor(cdp.evalJs,
        `${grab}.filter((n) => n.id === ${bid}).length >= 2`, { timeoutMs: 15000 });
      const rows = await cdp.evalJs(grab);
      const badges = rows.filter((n) => n.id === a.batchId).map((n) => n.t);
      // 判据（**未放宽**）：这一批的标记必须**恰好 2 个**，且**恰好是**「批 1/2」与「批 2/2」——
      //   既钉住格式（`批 <序号>/<总数>`），也钉住序号覆盖 1..2、总数 == 2。
      need(badges.length === 2,
        `本次这批（batchId=${a.batchId}）在任务列表里应有 2 个标记，实际 ${badges.length} 个：${JSON.stringify(badges)}`);
      const wantBadges = ['批 1/2', '批 2/2'];
      const gotBadges = badges.slice().sort();
      need(gotBadges.join('|') === wantBadges.join('|'),
        `本次这批（batchId=${a.batchId}）的任务列表标记是 ${JSON.stringify(gotBadges)}，期望 ${JSON.stringify(wantBadges)}` +
        `（全表标记 = ${JSON.stringify(rows.map((n) => n.t))}，其中历史残留已按 batchId 排除）`);
      notes.push(`B7 任务列表批次标记（仅本次 batchId=${a.batchId}）：${badges.join(' / ')}`);
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

    // ══ D. 声音版块（音色清单 / 试听 / 选用 / 出片带 --voice）════
    log('');
    log(C.b('  D. 声音版块（音色渲染 · 试听请求 · 选用持久化 · 出片带音色）'));

    await runCase('D1 页面里有「声音」卡片，音色条目按服务端清单渲染出来（含试听 / 选用按钮）', async () => {
      const n = await waitFor(cdp.evalJs,
        `document.querySelectorAll('#voiceList .voice').length || 0`, { timeoutMs: 30000 });
      need(n === state.voiceCount,
        `声音列表里渲染出 ${n} 个音色条目，服务端清单是 ${state.voiceCount} 个（渲染漏了或多渲染了）`);
      const info = await cdp.evalJs(`(() => {
        const items = [...document.querySelectorAll('#voiceList .voice')];
        const hasBtn = (it, re) => [...it.querySelectorAll('.vacts button')].some((b) => re.test(b.textContent));
        return {
          hasCard: !!document.getElementById('voiceCard'),
          title: (document.getElementById('voiceCard') || {}).textContent || '',
          names: items.map((it) => { const n = it.querySelector('.vname'); return n ? n.textContent : null; }),
          play: items.filter((it) => hasBtn(it, /试听|暂停/)).length,
          pick: items.filter((it) => hasBtn(it, /选用/)).length,
        };
      })()`);
      need(info.hasCard, '渲染后的 DOM 里没有 #voiceCard（「声音」卡片）');
      need(info.title.includes('声音'), `#voiceCard 里没有「声音」标题：${info.title.slice(0, 80)}`);
      need(info.names.every(Boolean) && new Set(info.names).size === info.names.length,
        `音色条目的名字有缺失或重复：${JSON.stringify(info.names)}`);
      need(info.play === info.names.length, `只有 ${info.play}/${info.names.length} 个条目有「试听」按钮`);
      need(info.pick === info.names.length, `只有 ${info.pick}/${info.names.length} 个条目有「选用」按钮`);
      notes.push(`D1 #voiceCard 渲染出 ${info.names.length} 条音色（= 服务端清单），每条都有「试听」「选用」`);
    });

    await runCase('D2 点「试听」真的向 /api/voices/audio 发请求（不是空按钮）', async () => {
      // ★ app.js 用 `new Audio()` 单例播参考音，它**不在 DOM 里**，所以没法用选择器查它的 src。
      //   改成在 HTMLMediaElement.play() 处截一次：src 一定在 play() 之前赋好（见 toggleVoiceAudio）。
      await cdp.evalJs(`
        window.__voiceAudioSrcs = [];
        if (!window.__playPatched) {
          window.__playPatched = true;
          const orig = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function () {
            try { if (this.src && this.src.indexOf('/api/voices/audio') >= 0) window.__voiceAudioSrcs.push(this.src); } catch (e) {}
            return orig.apply(this, arguments);
          };
        }
        true;
      `);
      const name = await cdp.evalJs(`(() => {
        const it = document.querySelector('#voiceList .voice');
        const b = [...it.querySelectorAll('.vacts button')].find((x) => /试听|暂停/.test(x.textContent));
        const nm = it.querySelector('.vname').textContent;
        b.click();
        return nm;
      })()`);
      await sleep(600);            // 等一拍，让 play() 被调用
      const srcs = await cdp.evalJs(`window.__voiceAudioSrcs || []`);
      const hit = srcs.find((u) => u.indexOf('/api/voices/audio') >= 0 && u.indexOf(encodeURIComponent(name)) >= 0);
      need(hit, `点「试听」(${name}) 后没有向 /api/voices/audio?name=… 发请求；截到的 src：${JSON.stringify(srcs)}`);
      state.playSrc = hit;
      notes.push(`D2 点「试听」(${name}) → <audio>.play() 的 src = ${hit}`);
    });

    await runCase('D3 点「选用」→ 写进 localStorage（lemo.voice）并更新「当前」条', async () => {
      const r = await cdp.evalJs(`(() => {
        const it = document.querySelector('#voiceList .voice');
        const name = it.querySelector('.vname').textContent;
        const b = [...it.querySelectorAll('.vacts button')].find((x) => x.textContent.trim() === '选用');
        if (b) b.click();
        return { name, ls: localStorage.getItem('lemo.voice'), hadButton: !!b };
      })()`);
      need(r.hadButton, `第一个音色条目的「选用」按钮不在（可能已被选中，文案变成「已选用」）`);
      need(r.ls === r.name,
        `点「选用」后 localStorage['lemo.voice'] = ${JSON.stringify(r.ls)}，期望 ${JSON.stringify(r.name)}`);
      const cur = await cdp.evalJs(`document.getElementById('voiceCurrent').textContent`);
      need(cur.includes(r.name), `「当前」条没显示刚选中的音色：${cur}`);
      state.voiceName = r.name;
      notes.push(`D3 选用 ${r.name} → localStorage['lemo.voice']=${r.ls}，当前条=${cur.replace(/\s+/g, ' ').slice(0, 80)}`);
    });

    await runCase('D4 出片（主题工单）真的带上当前音色：请求体带 voice，任务 opts 含 --voice', async () => {
      need(state.voiceName, 'D3 没选出音色（前置失败），D4 无法验证音色是否随出片传递');

      // ① 建一张 ready 工单：pending → ready 是状态机允许的唯一迁移；
      //    runOpts 用 --dry-run，免得真渲染（服务端会把 --skip-sync 拼在前面）。
      const created = await post('/api/briefs',
        { topic: 'UI 测试：音色随主题出片传递', slug: 'engraving', lang: 'en', ratio: '9:16' });
      need(created.status === 200 || created.status === 201,
        `建工单失败：${created.status} ${created.text.slice(0, 160)}`);
      const bid = created.json.brief.id;
      BRIEF_IDS.add(bid);
      const rd = await patch('/api/briefs/' + encodeURIComponent(bid), { status: 'ready', runOpts: ['--dry-run'] });
      need(rd.status === 200, `把工单改成 ready 失败：${rd.status} ${rd.text.slice(0, 160)}`);

      // ② 在页面里装 fetch 捕获（记录 runBrief 发出去的原始 body），再点这张工单的「出片」
      const priorIds = new Set(((await get('/api/jobs')).json.jobs || []).map((j) => j.id));
      const out = await cdp.evalJs(`(async () => {
        if (!window.__runCapPatched) {
          window.__runCapPatched = true; window.__runBodies = [];
          const of = window.fetch;
          window.fetch = function (u, o) {
            try {
              const s = String(u);
              if (s.indexOf('/briefs/') >= 0 && s.indexOf('/run') >= 0) window.__runBodies.push({ url: s, body: o && o.body });
            } catch (e) {}
            return of.apply(this, arguments);
          };
        }
        document.getElementById('btnRefreshBriefs').click();
        for (let i = 0; i < 60; i++) {
          const row = [...document.querySelectorAll('#briefs .brief')]
            .find((n) => { const t = n.querySelector('.bid'); return t && t.textContent === ${JSON.stringify(bid)}; });
          if (row) {
            const btn = [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === '出片');
            if (btn) { btn.click(); return { ok: true }; }
            return { err: 'no-run-button', cls: row.className, txt: row.textContent.slice(0, 140) };
          }
          await new Promise((r) => setTimeout(r, 150));
        }
        return { err: 'row-not-found' };
      })()`, { awaitPromise: true });
      need(out.ok, `UI 里没能点到工单 ${bid} 的「出片」按钮：${JSON.stringify(out)}`);

      // ③ 请求体必须带 voice（这就是 runBrief 发出去的 body —— 也是本批补的缺口 1）
      await sleep(500);
      const caps = await cdp.evalJs(`window.__runBodies || []`);
      const cap = caps[caps.length - 1];
      need(cap, '没有捕获到出片请求（POST /api/briefs/<id>/run）—— 出片按钮没走 runBrief？');
      const body = JSON.parse(cap.body || '{}');
      need(body.voice === state.voiceName,
        `出片请求体里的 voice = ${JSON.stringify(body.voice)}，期望 ${JSON.stringify(state.voiceName)}（body 原文：${cap.body}）`);

      // ④ 服务端真的把它拼进了命令行：新任务的 opts 必须含 `--voice <name>`
      let job = null;
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        const list = ((await get('/api/jobs')).json.jobs || []);
        job = list.find((j) => !priorIds.has(j.id));
        if (job) break;
        await sleep(300);
      }
      need(job, `点了「出片」后 30s 内 /api/jobs 没有多出新任务（工单 ${bid}）`);
      JOB_IDS.add(job.id);
      const opts = job.opts || [];
      const vi = opts.indexOf('--voice');
      need(vi >= 0, `任务的 opts 里没有 --voice：${JSON.stringify(opts)}`);
      need(opts[vi + 1] === state.voiceName,
        `任务 --voice 的值是 ${JSON.stringify(opts[vi + 1])}，期望 ${JSON.stringify(state.voiceName)}`);
      notes.push(`D4 出片请求体 voice=${body.voice}；任务 opts = ${JSON.stringify(opts)}`);

      // ⑤ 等这条 dry-run 跑完（别留占 GPU 的孤儿进程；也让工单能被删掉）
      const t1 = Date.now();
      while (Date.now() - t1 < 60000) {
        const j = ((await get('/api/jobs')).json.jobs || []).find((x) => x.id === job.id);
        if (j && ['done', 'failed', 'canceled'].includes(j.status)) break;
        await sleep(500);
      }
    });
    // ══ E. 文案出片面板（形态 · 断句 · 分析 · 风格 · 出片契约 · 前端拦截）══
    //
    // 为什么补这一节：项目新加了两大输入能力 —— ①「仅自定义文案出片」（画面工具生成、配音走
    // 本机 Index-TTS）；②「文案 + 用户上传口播视频」（素材画面与声音**原样不动**，只叠字幕与
    // 叠加层）。这两条功能的 HTTP 面（dub-api.test.mjs）与逻辑面（dub-align / dub-split）都已有
    // 覆盖，唯独**用户真正点击的那条路径（这张卡片）一条都没有**。这一节补的就是它。
    log('');
    log(C.b('  E. 文案出片面板（形态 · 断句逐字 · 分析 · 风格 · 出片请求体 · 三条前端拦截）'));

    // 服务端权威数据：断言一律以它为准，**不硬编码**任何风格 / 比例。
    const dubStylesRes = await get('/api/dub/styles');
    need(dubStylesRes.status === 200 && dubStylesRes.json && dubStylesRes.json.ok === true,
      `GET /api/dub/styles → ${dubStylesRes.status} / ok=${dubStylesRes.json && dubStylesRes.json.ok}`);
    const dubStyleList = dubStylesRes.json.styles;
    const dubDefaultStyle = dubStylesRes.json.default;
    const sizesRes = await get('/api/sizes');
    need(sizesRes.status === 200 && typeof sizesRes.json.defaultRatio === 'string',
      `GET /api/sizes → ${sizesRes.status}（拿不到 defaultRatio）`);
    const dubDefaultRatio = sizesRes.json.defaultRatio;

    // 样例文案：多句，好让「断句」真的切出多行
    const DUB_SCRIPT = '春天一到，城市里最先醒的是树。你有多久没抬头看过它们了？这个周末，去走一条没走过的路吧。';

    // 页面可能还没加载（--filter E* 时 B0 会被跳过）—— 这里兜底打开并等关键元素就绪。
    const ensureDubPage = async () => {
      const ready = `!!document.getElementById('dubCard') && document.querySelectorAll('#dubStyle option').length > 0 && document.querySelectorAll('#dubRatio option').length > 0`;
      if (!(await cdp.evalJs(ready))) await cdp.goto(base + '/', 4000);
      await waitFor(cdp.evalJs, ready, { timeoutMs: 30000 });
    };
    await ensureDubPage();

    // ★ 出片请求体契约的捕获装置：patch window.fetch，**拦下** POST /api/dub/run（记录 body 后
    //   返回假响应）并把 /api/jobs 也伪造成一条终态任务，让 pollDub() 能收敛。
    //   —— 绝不让它真的创建出片任务：形态 1 会跑 TTS 烧 GPU，形态 2 需要真素材。
    await cdp.evalJs(`(() => {
      window.__dubRunBodies = [];
      if (!window.__dubFetchPatched) {
        window.__dubFetchPatched = true;
        const of = window.fetch;
        const fake = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify(obj) });
        window.fetch = function (u, o) {
          try {
            const s = String(u);
            const m = (o && o.method) || 'GET';
            if (s.indexOf('/api/dub/run') >= 0 && m === 'POST') {
              window.__dubRunBodies.push({ url: s, body: o && o.body });
              return Promise.resolve(fake({ ok: true, job: { id: 'FAKE-DUB-JOB', status: 'queued' },
                out: '', outName: '', artifacts: {}, style: '', keepOriginal: false, hint: '' }));
            }
            if (s.indexOf('/api/jobs') >= 0 && s.indexOf('/api/jobs/') < 0) {
              return Promise.resolve(fake({ jobs: [{ id: 'FAKE-DUB-JOB', status: 'canceled', slug: 'dub' }] }));
            }
          } catch (e) { /* 拦不住就走真网络 */ }
          return of.apply(this, arguments);
        };
      }
      return true;
    })()`);

    /** 点「出片」并取回本次捕获到的 /api/dub/run 请求体。会先等上一条假任务收敛（按钮解禁）。 */
    const dubRunCapture = async () => {
      await cdp.evalJs(`window.__dubRunBodies = []; true;`);
      await waitFor(cdp.evalJs, `document.getElementById('btnDubRun').disabled === false`, { timeoutMs: 20000 });
      await cdp.evalJs(`document.getElementById('btnDubRun').click()`);
      await sleep(350);
      return await cdp.evalJs(`window.__dubRunBodies || []`);
    };

    await runCase('E1 形态切换：默认「仅文案出片」；点「文案 + 口播视频」→ 类名/aria/字段显隐都跟着变', async () => {
      await ensureDubPage();
      await cdp.evalJs(`(() => { const c = document.getElementById('dubCard');
        if (c.classList.contains('mode-keep')) document.getElementById('dubModeScript').click(); return true; })()`);
      const s0 = await cdp.evalJs(`(() => {
        const c = document.getElementById('dubCard');
        return {
          script: c.classList.contains('mode-script'), keep: c.classList.contains('mode-keep'),
          scriptSel: document.getElementById('dubModeScript').getAttribute('aria-selected'),
          keepSel: document.getElementById('dubModeKeep').getAttribute('aria-selected'),
          keepOnly: getComputedStyle(document.getElementById('dubKeepNote')).display,
          scriptOnly: getComputedStyle(document.querySelector('.dub-script-only')).display,
        };
      })()`);
      need(s0.script === true && s0.keep === false, `形态 1 下 #dubCard 类名不对：${JSON.stringify(s0)}`);
      need(s0.scriptSel === 'true' && s0.keepSel === 'false', `形态 1 的 aria-selected 不对：${JSON.stringify(s0)}`);
      need(s0.keepOnly === 'none', `形态 1 下 .dub-keep-only 应 display:none，实际「${s0.keepOnly}」`);
      need(s0.scriptOnly !== 'none', `形态 1 下 .dub-script-only 应可见，实际「${s0.scriptOnly}」`);

      await cdp.evalJs(`document.getElementById('dubModeKeep').click()`);
      const s1 = await cdp.evalJs(`(() => {
        const c = document.getElementById('dubCard');
        return {
          script: c.classList.contains('mode-script'), keep: c.classList.contains('mode-keep'),
          keepSel: document.getElementById('dubModeKeep').getAttribute('aria-selected'),
          keepOnly: getComputedStyle(document.getElementById('dubKeepNote')).display,
          scriptOnly: getComputedStyle(document.querySelector('.dub-script-only')).display,
          toast: document.getElementById('toast').textContent,
        };
      })()`);
      need(s1.keep === true && s1.script === false, `形态 2 下 #dubCard 类名不对：${JSON.stringify(s1)}`);
      need(s1.keepSel === 'true', `形态 2 的 aria-selected 不对：${JSON.stringify(s1)}`);
      need(s1.keepOnly !== 'none', `形态 2 下 .dub-keep-only 应可见，实际「${s1.keepOnly}」`);
      need(s1.scriptOnly === 'none', `形态 2 下 .dub-script-only 应 display:none，实际「${s1.scriptOnly}」`);
      need(/已切到「文案 \+ 口播视频」/.test(s1.toast), `切形态没弹 toast 或文案不对：「${s1.toast}」`);
      notes.push(`E1 形态1→2：类名/aria 正确；.dub-keep-only ${s0.keepOnly}→${s1.keepOnly}、`
        + `.dub-script-only ${s0.scriptOnly}→${s1.scriptOnly}；toast「${s1.toast.replace(/\s+/g, ' ').slice(0, 46)}…」`);
      await cdp.evalJs(`document.getElementById('dubModeScript').click()`);
    });

    await runCase('E2 断句预览：DOM 行数 == 服务端 count，且逐行文本与服务端 lines[].text **逐字相等**', async () => {
      // 先用 HTTP 拿一份**权威**断句（断句规则只有一处，在前端之外）
      const auth = await post('/api/dub/preview', { script: DUB_SCRIPT });
      need(auth.status === 200 && auth.json && auth.json.ok === true,
        `POST /api/dub/preview（权威结果）→ ${auth.status} ${auth.text.slice(0, 140)}`);
      const lines = auth.json.lines;
      need(Array.isArray(lines) && lines.length >= 2, `权威断句只有 ${lines && lines.length} 行，样例文案太短？`);

      await cdp.evalJs(`(() => {
        const ta = document.getElementById('dubScript');
        ta.value = ${JSON.stringify(DUB_SCRIPT)};
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('btnDubPreview').click();
        return true;
      })()`);
      await waitFor(cdp.evalJs,
        `document.getElementById('dubLines').hidden === false && document.querySelectorAll('#dubLines .dub-line').length > 0`,
        { timeoutMs: 20000 });
      const got = await cdp.evalJs(`(() => {
        const rows = [...document.querySelectorAll('#dubLines .dub-line')];
        return {
          head: (document.querySelector('#dubLines .dub-lines-head') || {}).textContent || '',
          t: rows.map((r) => r.querySelector('.dub-line-t').textContent),
          n: rows.map((r) => r.querySelector('.dub-line-n').textContent),
          count: document.getElementById('dubCount').textContent,
        };
      })()`);
      need(got.t.length === lines.length,
        `DOM 渲染 ${got.t.length} 行，服务端 count=${auth.json.count}（lines=${lines.length}）`);
      need(got.count === String(lines.length), `#dubCount=「${got.count}」，期望「${lines.length}」`);
      for (let k = 0; k < lines.length; k++) {
        need(got.t[k] === lines[k].text,
          `第 ${k + 1} 行文本与服务端**不逐字相等**（前端不该自己切句/改字）：\n`
          + `    DOM   = ${JSON.stringify(got.t[k])}\n    服务端= ${JSON.stringify(lines[k].text)}`);
        need(got.n[k] === `${String(lines[k].text).length} 字`,
          `第 ${k + 1} 行字数标签「${got.n[k]}」与文本长度不符`);
      }
      notes.push(`E2 断句 ${lines.length} 行：DOM 逐字 == 服务端（#dubCount=${got.count}，head=「${got.head.replace(/\s+/g, ' ').slice(0, 40)}」）`);
    });

    await runCase('E3 分析文案：点「分析文案」→ 真的 POST /api/dub/analyze，#dubAnalysis 展开且有内容', async () => {
      await cdp.evalJs(`(() => {
        const ta = document.getElementById('dubScript');
        ta.value = ${JSON.stringify(DUB_SCRIPT)};
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('btnDubAnalyze').click();
        return true;
      })()`);
      // ★ 等**最终态**：分析进行中时 #dubAnalysis 也已经展开（summary=「分析中…」）——
      //   只等 hidden===false 会撞上中间态，必须等到 summary 变成「分析结果：…」。
      await waitFor(cdp.evalJs,
        `document.getElementById('dubAnalysis').hidden === false
         && /^分析结果/.test(document.getElementById('dubAnalysisSum').textContent)
         && document.getElementById('btnDubAnalyze').disabled === false`,
        { timeoutMs: 30000 });
      const a = await cdp.evalJs(`(() => ({
        sum: document.getElementById('dubAnalysisSum').textContent,
        body: document.getElementById('dubAnalysisBody').textContent,
        segs: document.querySelectorAll('#dubAnalysisBody .dub-seg').length,
      }))()`);
      need(a.sum.includes('分析结果'), `#dubAnalysisSum 没写「分析结果」：「${a.sum}」`);
      need(a.segs >= 1, `分析结果里没有段落行（.dub-seg=${a.segs}）`);
      need(/匹配结果/.test(a.body), `分析结果里没有「匹配结果」块：${a.body.slice(0, 160)}`);
      notes.push(`E3 #dubAnalysisSum=「${a.sum.replace(/\s+/g, ' ')}」；段落 ${a.segs} 段`);
    });

    await runCase('E4 风格下拉：选项数 == 服务端清单 + 1（auto + 不指定档），首项 value=auto', async () => {
      const info = await cdp.evalJs(`(() => {
        const opts = [...document.querySelectorAll('#dubStyle option')];
        return { n: opts.length, vals: opts.map((o) => o.value), labels: opts.map((o) => o.textContent) };
      })()`);
      need(info.n === dubStyleList.length + 1,
        `#dubStyle 有 ${info.n} 个选项，期望 ${dubStyleList.length + 1}（服务端清单 ${dubStyleList.length} + auto；`
        + `「不指定」档复用清单里的 default，不额外多一项）`);
      need(info.vals[0] === 'auto', `第一项 value 应是 auto，实际 ${JSON.stringify(info.vals[0])}`);
      // ★ 「不指定」档的 value 必须是**空串**（出片时不传 --style）——
      //   见 web/app.js 的 renderDubStyleOptions。曾经它复用服务端 default 的 id，
      //   导致出片 body 多带 style、下拉提示误写「指定风格「plain-dark」」。
      need(info.vals[1] === '',
        `第二项（「不指定」档）value 应是空串，实际 ${JSON.stringify(info.vals[1])}`);
      need(/不指定/.test(info.labels[1]), `第二项文案里没有「不指定」：「${info.labels[1]}」`);
      // 默认风格（dubDefaultStyle）由「不指定」档代表，**故意不**单独列一项 ⇒ 它不在 option value 里是正常的
      const missing = dubStyleList.map((s) => s.id)
        .filter((id) => id !== dubDefaultStyle && !info.vals.includes(id));
      need(missing.length === 0, `这些服务端风格在 #dubStyle 里选不到：${missing.join(', ')}`);
      notes.push(`E4 #dubStyle ${info.n} 项（= 服务端 ${dubStyleList.length} + auto）；`
        + `首项 auto；「不指定」档 value=${JSON.stringify(info.vals[1])}（空串 = 不传 --style）；`
        + `默认风格 ${dubDefaultStyle} 由该档代表，未单独列项`);
    });

    await runCase('E5 出片请求体 · 形态1（auto 风格）：含 script/style:auto/显式尺寸，不含 keepOriginal', async () => {
      await ensureDubPage();
      const set = await cdp.evalJs(`(() => {
        document.getElementById('dubModeScript').click();
        const ta = document.getElementById('dubScript');
        ta.value = ${JSON.stringify(DUB_SCRIPT)};
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        const st = document.getElementById('dubStyle');
        st.value = 'auto'; st.dispatchEvent(new Event('change', { bubbles: true }));
        const rs = document.getElementById('dubRatio');
        const def = [...rs.options].find((o) => o.value === ${JSON.stringify(dubDefaultRatio)});
        if (def) { rs.value = def.value; rs.dispatchEvent(new Event('change', { bubbles: true })); }
        return { style: st.value, ratio: rs.value };
      })()`);
      need(set.style === 'auto' && set.ratio === dubDefaultRatio, `表单没设成 auto/${dubDefaultRatio}：${JSON.stringify(set)}`);
      const caps = await dubRunCapture();
      const cap = caps[caps.length - 1];
      need(cap, '没捕获到 POST /api/dub/run（形态 1 也被前端拦了？）');
      const body = JSON.parse(cap.body || '{}');
      need(body.script === DUB_SCRIPT, `body.script 与输入的文案不一致：${JSON.stringify(body.script).slice(0, 80)}`);
      need(body.style === 'auto', `body.style 应为 'auto'，实际 ${JSON.stringify(body.style)}`);
      need(!('keepOriginal' in body), `形态 1 的 body 不该带 keepOriginal，实际 ${JSON.stringify(body.keepOriginal)}`);
      need(!('videoToken' in body), `形态 1 且没选素材时不该带 videoToken，实际 ${JSON.stringify(body.videoToken)}`);
      const sizeKeys = ['ratio', 'size'].filter((k) => k in body);
      need(sizeKeys.length === 1, `尺寸必须**显式**带且只带一个（ratio 或 size），实际带了 ${JSON.stringify(sizeKeys)}`);
      need(body.ratio === dubDefaultRatio,
        `没选自定义尺寸时应显式带默认比例 ${JSON.stringify(dubDefaultRatio)}，实际 ${JSON.stringify(body.ratio)}`);
      notes.push(`E5 形态1(auto) 请求体 = ${cap.body}`);
    });

    await runCase('E6 出片请求体 · 形态1 选「不指定」档：body **不含** style（不传 --style），下拉提示走「不指定」分支', async () => {
      await ensureDubPage();
      const info = await cdp.evalJs(`(() => {
        document.getElementById('dubModeScript').click();
        const ta = document.getElementById('dubScript');
        ta.value = ${JSON.stringify(DUB_SCRIPT)};
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        const sel = document.getElementById('dubStyle');
        const none = [...sel.options].find((o) => /不指定/.test(o.textContent));
        if (!none) return { err: 'no-none-option', labels: [...sel.options].map((o) => o.textContent) };
        sel.value = none.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, noneVal: none.value, selVal: sel.value, hint: document.getElementById('dubStyleHint').textContent };
      })()`);
      need(info.ok, `#dubStyle 里找不到「不指定」档：${JSON.stringify(info)}`);
      // ★ ① 该档 value 必须是空串，且选中后**不回弹**到 auto（否则「不指定」根本选不住）。
      need(info.noneVal === '', `「不指定」档的 value 应是空串，实际 ${JSON.stringify(info.noneVal)}`);
      need(info.selVal === '',
        `选中「不指定」档后 #dubStyle.value 应保持空串（不被重置成 auto），实际 ${JSON.stringify(info.selVal)}`);
      // ★ ② 下拉提示必须走「不指定」分支 —— 钉住「提示与行为一致」。
      //     曾经 value=plain-dark 时这里会误写「指定风格「plain-dark」」。
      need(/不传\s*--style/.test(info.hint),
        `「不指定」档的提示应写明「不传 --style」，实际：「${info.hint}」`);
      const caps = await dubRunCapture();
      const cap = caps[caps.length - 1];
      need(cap, '没捕获到 POST /api/dub/run（选了「不指定」档后被拦了？）');
      const body = JSON.parse(cap.body || '{}');
      // ★ ③ 核心断言：不传 --style —— body 里**不该有** style 键（这才是「与加这个功能之前完全一样」）。
      need(!('style' in body),
        `选「不指定」档后 body 不该带 style，实际带了 ${JSON.stringify(body.style)}（body=${cap.body}）`);
      need(body.script === DUB_SCRIPT, 'body.script 与输入的文案不一致');
      notes.push(`E6 选「不指定」档（value=${JSON.stringify(info.noneVal)}）→ body keys=[${Object.keys(body).join(', ')}]（无 style）；`
        + `下拉提示=「${info.hint.replace(/\s+/g, ' ').slice(0, 60)}」`);
    });

    await runCase('E7 出片请求体 · 形态2（文案+口播视频）：带 keepOriginal/videoToken，不带音色/语速/停顿/尺寸/fit/原声', async () => {
      await ensureDubPage();
      // ① 真传一个极小的假 mp4（拿一个真实 videoToken）—— 走 /api/dub/upload，跑完按确切路径删
      if (dubIndexBackup === undefined) {
        try { dubIndexBackup = fs.readFileSync(DUB_INDEX_FILE); } catch { dubIndexBackup = null; }
      }
      const up = await uploadDubRaw(server.port, 'ui-e7.mp4', Buffer.from('FAKE-MP4-BYTES-for-ui-e7'));
      need(up.status === 200 && up.json && up.json.ok === true,
        `上传假 mp4 失败：${up.status} ${up.text.slice(0, 160)}`);
      need(up.json.kind === 'video', `上传的 kind 应为 video，实际 ${up.json.kind}`);
      DUB_UPLOAD_PATHS.add(up.json.path);
      const token = up.json.token;

      // ② 切形态 2 → 刷新素材清单 → 在「用已上传的」下拉里选中它（走真实 change 路径）
      await cdp.evalJs(`document.getElementById('dubModeKeep').click()`);
      const picked = await cdp.evalJs(`(async () => {
        document.getElementById('btnDubRefresh').click();
        for (let i = 0; i < 60; i++) {
          const sel = document.getElementById('dubSrcSel');
          const opt = [...sel.options].find((o) => o.value === ${JSON.stringify(token)});
          if (opt) {
            sel.value = ${JSON.stringify(token)};
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return { ok: true, hint: document.getElementById('dubVideoHint').textContent };
          }
          await new Promise((r) => setTimeout(r, 200));
        }
        return { ok: false, opts: [...document.getElementById('dubSrcSel').options].map((o) => o.value) };
      })()`, { awaitPromise: true });
      need(picked.ok, `#dubSrcSel 里没有刚上传的 token（选项=${JSON.stringify(picked.opts)}）`);
      need(/已选/.test(picked.hint), `选中素材后 #dubVideoHint 没显示「已选」：「${picked.hint}」`);

      await cdp.evalJs(`(() => {
        const ta = document.getElementById('dubScript');
        ta.value = ${JSON.stringify(DUB_SCRIPT)};
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      const caps = await dubRunCapture();
      const cap = caps[caps.length - 1];
      need(cap, '没捕获到 POST /api/dub/run（形态 2 被前端拦了？）');
      const body = JSON.parse(cap.body || '{}');
      need(body.keepOriginal === true, `形态 2 的 body 必须带 keepOriginal:true，实际 ${JSON.stringify(body.keepOriginal)}`);
      need(body.videoToken === token, `body.videoToken=${JSON.stringify(body.videoToken)}，期望 ${JSON.stringify(token)}`);
      for (const k of ['voice', 'speed', 'gap', 'size', 'ratio', 'fit', 'keepOriginalAudio']) {
        need(!(k in body), `形态 2 的 body 不该带 ${k}，实际带了 ${JSON.stringify(body[k])}（body=${cap.body}）`);
      }
      notes.push(`E7 形态2 请求体 keys=[${Object.keys(body).join(', ')}]（token=${token}）`);
      await cdp.evalJs(`document.getElementById('dubModeScript').click()`);
    });

    await runCase('E8 前端拦截 · 空文案点「出片」→ 不发 /api/dub/run，只弹「先粘贴一段文案」', async () => {
      await ensureDubPage();
      await cdp.evalJs(`(() => {
        document.getElementById('dubModeScript').click();
        const ta = document.getElementById('dubScript');
        ta.value = '   \\n  ';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      const caps = await dubRunCapture();
      const toast = await cdp.evalJs(`document.getElementById('toast').textContent`);
      need(caps.length === 0, `空文案竟然发出了 ${caps.length} 个 /api/dub/run 请求（应被前端拦住）`);
      need(/先粘贴一段文案/.test(toast), `空文案拦截的提示不对：「${toast}」`);
      notes.push(`E8 空文案 → 0 个 /api/dub/run 请求；toast「${toast}」`);
    });

    await runCase('E9 前端拦截 · 形态2 但没选口播视频 → 不发 /api/dub/run，提示要先上传', async () => {
      await ensureDubPage();
      await cdp.evalJs(`(() => {
        const c = document.getElementById('btnDubClear'); if (c) c.click();
        document.getElementById('dubModeKeep').click();
        const ta = document.getElementById('dubScript');
        ta.value = ${JSON.stringify(DUB_SCRIPT)};
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      const caps = await dubRunCapture();
      const toast = await cdp.evalJs(`document.getElementById('toast').textContent`);
      need(caps.length === 0, `形态2 无素材竟然发出了 ${caps.length} 个 /api/dub/run 请求（应被前端拦住）`);
      need(/口播视频/.test(toast), `形态2 无素材拦截的提示不对：「${toast}」`);
      notes.push(`E9 形态2 无素材 → 0 个请求；toast「${toast}」`);
      await cdp.evalJs(`document.getElementById('dubModeScript').click()`);
    });

    await runCase('E10 前端拦截 · 形态1 选「自定义尺寸」但宽高非法（奇数）→ 不发 /api/dub/run，提示不合法', async () => {
      await ensureDubPage();
      const bad = await cdp.evalJs(`(() => {
        document.getElementById('dubModeScript').click();
        const ta = document.getElementById('dubScript');
        ta.value = ${JSON.stringify(DUB_SCRIPT)};
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        const sel = document.getElementById('dubRatio');
        const custom = [...sel.options].find((o) => /自定义/.test(o.textContent));
        if (!custom) return { err: 'no-custom-option', opts: [...sel.options].map((o) => o.value) };
        sel.value = custom.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
        const w = document.getElementById('dubSizeW'), h = document.getElementById('dubSizeH');
        w.value = '1081'; w.dispatchEvent(new Event('input', { bubbles: true }));
        h.value = '1921'; h.dispatchEvent(new Event('input', { bubbles: true }));
        return { ok: true, fieldHidden: document.getElementById('dubSizeField').hidden,
                 hint: document.getElementById('dubSizeHint').textContent };
      })()`);
      need(bad.ok, `#dubRatio 里没有「自定义尺寸」选项：${JSON.stringify(bad)}`);
      need(bad.fieldHidden === false, '选了自定义尺寸但 #dubSizeField 没显示出来');
      const caps = await dubRunCapture();
      const toast = await cdp.evalJs(`document.getElementById('toast').textContent`);
      need(caps.length === 0, `非法自定义尺寸竟然发出了 ${caps.length} 个 /api/dub/run 请求（应被前端拦住）`);
      need(/自定义尺寸不合法/.test(toast), `非法尺寸拦截的提示不对：「${toast}」`);
      notes.push(`E10 非法尺寸 1081×1921 → 0 个请求；toast「${toast.replace(/\s+/g, ' ').slice(0, 70)}」`);
      // 还原成默认比例，别把状态留给后续（或再次运行本套件时）
      await cdp.evalJs(`(() => {
        const sel = document.getElementById('dubRatio');
        const def = [...sel.options].find((o) => o.value === ${JSON.stringify(dubDefaultRatio)});
        if (def) { sel.value = def.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        return true;
      })()`);
    });

    // ══ F. 三处「整块静默失明」的 UI 版块（播放器弹层 · 窄屏侧栏 · 顶栏两个按钮）══
    //
    // 为什么补这一节：一次全控制台覆盖审计发现，20 个 UI 版块里有 17 个已有覆盖，唯独这三处
    // **渲染 / 交互 / 服务端契约三档全空** —— 用户点得到、坏了没人知道：
    //   ① #playerModal（点成片 / 任务行 ▶ 的唯一反馈路径）；
    //   ② #btnToggleSide（窄屏下打不开侧栏 = 没法选风格）；
    //   ③ #btnRefreshEnv / #btnSimulate（后者此前只被 `?simulate=` URL 覆盖过，按钮本身没测）。
    // 判据一律**从源码/服务端读**（不硬编码文件名、不假设 DOM 顺序），并且每条都带一条「有牙」的
    // 非平凡断言（transform 真的变了 / 请求真的发出去了 / 标题与视频源自洽），避免「只测类名 toggle」。
    log('');
    log(C.b('  F. 播放器弹层 · 窄屏侧栏 · 顶栏两个按钮（补三处 UI 盲区）'));

    // 页面可能还没加载（--filter F* 时 B0 会被跳过）—— 兜底打开并等关键元素就绪。
    const ensurePage = async () => {
      const ready = `!!document.getElementById('playerModal') && document.querySelectorAll('.style-item').length > 0`;
      if (!(await cdp.evalJs(ready))) await cdp.goto(base + '/', 4000);
      await waitFor(cdp.evalJs, ready, { timeoutMs: 30000 });
    };
    // 容忍「导航中执行上下文被销毁 / DOM 还没解析完」的等待 —— 跨导航的断言必须用它。
    const waitTolerant = async (expr, timeoutMs = 20000) => {
      const t0 = Date.now();
      let last;
      while (Date.now() - t0 < timeoutMs) {
        try { last = await cdp.evalJs(expr); if (last) return last; } catch { /* 导航中，重试 */ }
        await sleep(300);
      }
      throw new Error(`等待条件超时（${timeoutMs}ms）：${expr}（最后一次 = ${JSON.stringify(last)}）`);
    };

    // ── 成片清单（服务端权威）：F1/F2 共用同一个目标条目，断言不硬编码文件名 ──
    const filmsRes0 = await get('/api/films');
    need(filmsRes0.status === 200 && filmsRes0.json && Array.isArray(filmsRes0.json.films),
      `GET /api/films → ${filmsRes0.status}（拿不到成片清单，播放器弹层无法触发）`);
    let filmList = filmsRes0.json.films;
    if (!filmList.length) {
      // 干净机器：临时造一个极小的假成片（目录名不以 `_`/`.` 开头，否则服务端会跳过）
      const dir = path.join(CFG.exportDir, `uitest-player-${process.pid}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'clip.mp4'), Buffer.from('FAKE-MP4-BYTES-for-ui-f1'));
      CREATED_FILM_DIRS.add(dir);
      filmList = ((await get('/api/films')).json.films || []);
    }
    need(filmList.length > 0,
      `成片库为空（${CFG.exportDir}），临时造假成片后仍拿不到条目 —— 播放器弹层测不了（绝不静默跳过）`);
    const FILM = filmList[0];
    const FILM_IS_DUB = !!(FILM.source === 'dub' || !FILM.slug);
    const FILM_KEY = FILM_IS_DUB ? `文案出片 ${FILM.name || ''}`.trim() : String(FILM.slug);
    const FILM_TITLE = `${FILM_KEY} / ${FILM.file}`;
    const FILM_DUB_META = 'dub\\' + (FILM.name || '');
    // 非 dub 条目的卡片标题是**风格中文名**（见 app.js filmTitle）—— 从服务端清单里取，不猜
    let filmCardTitle = FILM_IS_DUB ? '文案出片' : String(FILM.slug);
    if (!FILM_IS_DUB) {
      const dm = await get('/api/demos');
      const st = (dm.json.styles || []).find((s) => s.slug === FILM.slug);
      if (st && st.nameCn) filmCardTitle = st.nameCn;
    }
    const FILM_MATCH_JSON = JSON.stringify({
      fslug: filmCardTitle,
      meta: FILM_IS_DUB ? FILM_DUB_META : FILM.file,
    });

    /** 页面里：刷新成片 → 按**内容**找到目标卡片（不依赖 DOM 顺序）→ 点它的「播放」按钮。 */
    const clickFilmCard = async () => cdp.evalJs(`(async () => {
      const M = ${FILM_MATCH_JSON};
      document.getElementById('btnRefreshFilms').click();
      for (let i = 0; i < 60; i++) {
        const cards = [...document.querySelectorAll('#films .film')];
        const hit = cards.find((c) => {
          const fs_ = (c.querySelector('.fslug') || {}).textContent || '';
          const metas = [...c.querySelectorAll('.fmeta')].map((n) => n.textContent || '');
          return fs_ === M.fslug && metas.some((m) => m.includes(M.meta));
        });
        if (hit) {
          const btn = hit.querySelector('.factions .btn');
          (btn || hit).click();
          return { ok: true, cards: cards.length, usedBtn: !!btn };
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      return { ok: false, cards: document.querySelectorAll('#films .film').length,
               texts: [...document.querySelectorAll('#films .film')].map((c) => (c.textContent || '').slice(0, 70)) };
    })()`, { awaitPromise: true });

    await runCase('F1 播放器弹层：点成片卡片「播放」→ #playerModal 打开，标题/视频源与该成片条目一致', async () => {
      await ensurePage();
      const pre = await cdp.evalJs(`document.getElementById('playerModal').hidden`);
      need(pre === true, '前置：弹层初始应隐藏（否则说明上一条没收拾干净）');
      const clicked = await clickFilmCard();
      need(clicked.ok,
        `成片库里找不到目标卡片（匹配=${FILM_MATCH_JSON}，DOM 卡片 ${clicked.cards} 张）：${JSON.stringify(clicked.texts)}`);
      await waitFor(cdp.evalJs, `document.getElementById('playerModal').hidden === false`, { timeoutMs: 10000 });
      const got = await cdp.evalJs(`(() => ({
        hidden: document.getElementById('playerModal').hidden,
        title: document.getElementById('playerTitle').textContent,
        src: document.getElementById('player').getAttribute('src'),
      }))()`);
      need(got.hidden === false, '点「播放」后 #playerModal 仍 hidden —— 弹层没打开（openPlayer 没把 hidden 置 false？）');
      // ★ 有牙：标题必须**自洽于同一个条目** —— 若 openPlayer 传错了 slug/file，这里必红
      need(got.title === FILM_TITLE,
        `弹层标题「${got.title}」，期望「${FILM_TITLE}」（应等于 \`slug / file\`）`);
      need(got.src === FILM.url,
        `#player 的 src=「${got.src}」，期望该成片的 url「${FILM.url}」（src 与标题必须指向同一个条目）`);
      notes.push(`F1 点成片「${FILM.file}」→ 弹层打开；title=「${got.title}」；src=${got.src}`);
    });

    await runCase('F2 播放器弹层：关闭按钮 / 点背景 / Esc 三条路径都能关，且 src 被清掉', async () => {
      await ensurePage();
      const reopen = async () => {
        const r = await clickFilmCard();
        need(r.ok, `重开弹层失败：找不到成片卡片 ${JSON.stringify(r)}`);
        await waitFor(cdp.evalJs, `document.getElementById('playerModal').hidden === false`, { timeoutMs: 10000 });
      };
      const stateNow = () => cdp.evalJs(`(() => ({
        hidden: document.getElementById('playerModal').hidden,
        src: document.getElementById('player').getAttribute('src'),
      }))()`);

      // ① 关闭按钮
      await reopen();
      await cdp.evalJs(`document.getElementById('btnClosePlayer').click()`);
      await waitFor(cdp.evalJs, `document.getElementById('playerModal').hidden === true`, { timeoutMs: 8000 });
      let s = await stateNow();
      need(s.hidden === true, '点「关闭」后 #playerModal 仍显示');
      need(s.src === null, `关闭后 #player 的 src 应被 removeAttribute 清掉，实际「${s.src}」`);

      // ② 点背景（e.target === #playerModal）
      await reopen();
      await cdp.evalJs(`document.getElementById('playerModal').click()`);
      await waitFor(cdp.evalJs, `document.getElementById('playerModal').hidden === true`, { timeoutMs: 8000 });
      s = await stateNow();
      need(s.hidden === true, '点弹层背景后 #playerModal 仍显示');
      need(s.src === null, `点背景关闭后 #player 的 src 应被清掉，实际「${s.src}」`);

      // ③ Esc（全局 keydown：Escape 关最上面那一层 —— 播放器是最底层兜底）
      await reopen();
      const topOpen = await cdp.evalJs(
        `['helpModal','batchModal','detailDrawer'].filter((id) => { const e = document.getElementById(id); return e && !e.hidden; })`);
      need(topOpen.length === 0, `前置：这些弹层还开着（Esc 会先关它们而不是播放器）：${topOpen.join(', ')}`);
      await cdp.evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
      await waitFor(cdp.evalJs, `document.getElementById('playerModal').hidden === true`, { timeoutMs: 8000 });
      s = await stateNow();
      need(s.hidden === true, '按 Esc 后 #playerModal 仍显示（全局 keydown 没处理 Escape？）');
      need(s.src === null, `Esc 关闭后 #player 的 src 应被清掉，实际「${s.src}」`);
      notes.push('F2 关闭按钮 / 点背景 / Esc 三条路径都能关，且 src 都被清掉（removeAttribute）');
    });

    await runCase('F3 窄屏侧栏：「风格」按钮宽屏(1400) display:none、窄屏(500) 变可见', async () => {
      await ensurePage();
      await cdp.cmd('Emulation.setDeviceMetricsOverride',
        { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
      await sleep(300);
      const wide = await cdp.evalJs(`getComputedStyle(document.getElementById('btnToggleSide')).display`);
      need(wide === 'none', `宽屏(1400) 下 #btnToggleSide 应 display:none，实际「${wide}」`);

      await cdp.cmd('Emulation.setDeviceMetricsOverride',
        { width: 500, height: 800, deviceScaleFactor: 1, mobile: false });
      await sleep(300);
      const nar = await cdp.evalJs(`(() => ({
        btn: getComputedStyle(document.getElementById('btnToggleSide')).display,
        innerW: window.innerWidth,
      }))()`);
      need(nar.innerW <= 860, `期望窄屏 innerWidth ≤ 860，实际 ${nar.innerW}（Emulation.setDeviceMetricsOverride 没生效）`);
      need(nar.btn !== 'none', `窄屏(500) 下 #btnToggleSide 应可见，实际 display「${nar.btn}」`);
      // ★ 说明：CSS 写的是 `.narrow-only { display: inline-block }`，但它是 flex 项（.top-actions），
      //   浏览器会「块化」成 block —— 所以这里断言的是「可见」（非 none），而不是字面 inline-block。
      need(['block', 'inline-block', 'inline-flex', 'flex'].includes(nar.btn),
        `窄屏下 #btnToggleSide 的 display 应是可见值，实际「${nar.btn}」`);
      notes.push(`F3 宽屏 display=${wide}；窄屏(${nar.innerW}px) display=${nar.btn}（flex 项被块化）`);
    });

    await runCase('F4 窄屏侧栏：点「风格」→ #sidebar 出现 .open 且 transform 真的变了；再点收起', async () => {
      await ensurePage();
      await cdp.cmd('Emulation.setDeviceMetricsOverride',
        { width: 500, height: 800, deviceScaleFactor: 1, mobile: false });
      await sleep(300);
      // 前置：确保是收起态
      await cdp.evalJs(`(() => { const s = document.getElementById('sidebar');
        if (s.classList.contains('open')) document.getElementById('btnToggleSide').click(); return true; })()`);
      await sleep(450);
      const before = await cdp.evalJs(`(() => ({
        open: document.getElementById('sidebar').classList.contains('open'),
        tf: getComputedStyle(document.getElementById('sidebar')).transform,
      }))()`);
      need(before.open === false, '前置：侧栏初始不应带 .open');
      need(before.tf !== 'none',
        `收起态 #sidebar 的 transform 不该是 none（应被推到屏外），实际「${before.tf}」`);

      await cdp.evalJs(`document.getElementById('btnToggleSide').click()`);
      await sleep(450);            // 等 transition(.18s) 走完，getComputedStyle 才是终值
      const after = await cdp.evalJs(`(() => ({
        open: document.getElementById('sidebar').classList.contains('open'),
        tf: getComputedStyle(document.getElementById('sidebar')).transform,
      }))()`);
      need(after.open === true, '点「风格」后 #sidebar 没有 .open（监听没绑上？）');
      // ★ 有牙的判据：不能只断言「类名被 toggle 了」——要证明**显隐真的变了**
      need(after.tf !== before.tf,
        `#sidebar 加了 .open 但 transform 没变（还是「${after.tf}」）—— 只 toggle 了类名、样式没生效`);
      need(after.tf === 'none', `展开态 #sidebar 的 transform 期望 none，实际「${after.tf}」`);

      await cdp.evalJs(`document.getElementById('btnToggleSide').click()`);
      await sleep(450);
      const back = await cdp.evalJs(`(() => ({
        open: document.getElementById('sidebar').classList.contains('open'),
        tf: getComputedStyle(document.getElementById('sidebar')).transform,
      }))()`);
      need(back.open === false, '再点一次「风格」没把 .open 收起');
      need(back.tf === before.tf, `收起后 transform 应回到「${before.tf}」，实际「${back.tf}」`);
      notes.push(`F4 侧栏 transform：收起「${before.tf}」→ 展开「${after.tf}」(.open) → 再收起「${back.tf}」`);
      await cdp.cmd('Emulation.clearDeviceMetricsOverride');
      await sleep(200);
    });

    await runCase('F5 顶栏「重新检测」：点它**真的**发出 GET /api/env（且带 force=1 强制重探）', async () => {
      await ensurePage();
      // 页面里 patch window.fetch：只**记录** /api/env 的 URL，回一份最小合法形状（不触发真·全量探测，慢）
      await cdp.evalJs(`(() => {
        window.__envUrls = [];
        if (!window.__envFetchPatched) {
          window.__envFetchPatched = true;
          const of = window.fetch;
          const fake = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify(obj) });
          window.fetch = function (u, o) {
            try {
              const s = String(u);
              if (s.indexOf('/api/env') >= 0) {
                window.__envUrls.push(s);
                return Promise.resolve(fake({ ok: true, summary: { ok: 1, warn: 0, fail: 0, total: 1 },
                  groups: [], drift: [], checkedAt: Date.now(), cached: false, simulated: null }));
              }
            } catch (e) { /* 拦不住就走真网络 */ }
            return of.apply(this, arguments);
          };
        }
        window.__envUrls = [];
        return true;
      })()`);
      await cdp.evalJs(`document.getElementById('btnRefreshEnv').click()`);
      await waitFor(cdp.evalJs, `(window.__envUrls || []).length > 0`, { timeoutMs: 10000 });
      const urls = await cdp.evalJs(`window.__envUrls || []`);
      need(urls.some((u) => /\/api\/env/.test(u)),
        `点「重新检测」后没看到 /api/env 请求：${JSON.stringify(urls)}`);
      // ★ 有牙：title 写的是「重新全量探测环境」—— 必须带 force=1，否则只是读了缓存
      need(urls.some((u) => /force=1/.test(u)),
        `「重新检测」应带 force=1（强制重探），实际请求：${JSON.stringify(urls)}`);
      notes.push(`F5 点「重新检测」→ 请求 ${JSON.stringify(urls)}`);
    });

    await runCase('F6 顶栏「演练」：点它进入演练态（URL+引导卡片），按 bare→partial→clean→关闭 循环', async () => {
      await ensurePage();
      if (await cdp.evalJs(`location.search.includes('simulate')`)) await cdp.goto(base + '/', 3500);
      // ★ 这个按钮的实现是「改 URL 再刷新」（见 web/app.js 里 `#btnSimulate` 的 click 处理）——所以断言必须**跨导航**。
      // ★ 关键竞态：`location.search` 一变就代表「导航已提交」，但新文档的 app.js 可能还没跑完
      //   boot() 里的 bind() —— 此时再点 #btnSimulate 会点到一个**还没绑监听**的按钮（偶发 no-op，
      //   全量跑时复现过一次：bare→partial 之后卡在 partial）。所以点击前后都等 boot() 的产物就绪。
      const waitBooted = () => waitTolerant(
        `document.readyState === 'complete' && document.querySelectorAll('.style-item').length > 0
         && !!document.getElementById('btnSimulate')`);
      const navClick = async (cond) => {
        await waitBooted();
        await cdp.evalJs(`document.getElementById('btnSimulate').click()`);
        const t0 = Date.now();
        let last;
        while (Date.now() - t0 < 20000) {
          try {
            const search = await cdp.evalJs(`location.search`);
            last = search;
            const ok = cond.has ? String(search).includes(cond.has) : !String(search).includes(cond.hasNot);
            if (ok) { await waitBooted(); return search; }
          } catch { /* 导航中执行上下文被销毁，重试 */ }
          await sleep(300);
        }
        throw new Error(`点「演练」后等 URL 变化超时：${JSON.stringify(cond)}，实际 ${JSON.stringify(last)}`);
      };

      const s1 = await navClick({ has: 'simulate=bare' });
      // 导航刚提交时 app.js 可能还没跑完 —— 用容忍式等待
      await waitTolerant(`!!document.getElementById('setupSim') && document.getElementById('setupSim').hidden === false`);
      const sim1 = await cdp.evalJs(`(() => ({
        sim: document.getElementById('setupSim').textContent,
        cardHidden: document.getElementById('setupCard').hidden,
        envNote: (document.querySelector('.env-note') || {}).textContent || '',
      }))()`);
      need(/bare/.test(sim1.sim), `#setupSim 没写「bare」：「${sim1.sim}」`);
      need(sim1.cardHidden === false, '演练态下 #setupCard 应显示（「假装干净机器」的意义就在这）');
      need(/演练模式/.test(sim1.envNote), `.env-note 没写「演练模式」：「${sim1.envNote.replace(/\s+/g, ' ').slice(0, 80)}」`);

      const s2 = await navClick({ has: 'simulate=partial' });
      const s3 = await navClick({ has: 'simulate=clean' });
      await navClick({ hasNot: 'simulate' });                 // 第 4 次 = 退出演练
      await waitTolerant(`document.getElementById('setupSim') && document.getElementById('setupSim').hidden === true`);
      const out = await cdp.evalJs(`(() => ({
        search: location.search,
        simHidden: document.getElementById('setupSim').hidden,
      }))()`);
      need(!out.search.includes('simulate'), `退出演练后 URL 仍带 simulate：${out.search}`);
      need(out.simHidden === true, '退出演练后 #setupSim 仍可见（应隐藏）');
      notes.push(`F6 演练循环 URL：${s1} → ${s2} → ${s3} → 「${out.search || '(无 query)'}」；#setupSim 已隐藏`);
    });

    // ══ G. 剩余可点击路径（形态2 限幅开关 · 成片库 · 声音三处 · 主题工单 · 任务取消 · 预设/复制）══
    //
    // 为什么补这一节：一次全控制台覆盖审计点名了 10 处覆盖薄弱/为零的版块，A–F 已补掉播放器弹层 /
    // 窄屏侧栏 / 顶栏按钮 / setup 卡片 / 文案出片面板。**这一轮补剩下的**，并覆盖一个**刚新增的
    // 功能开关**：形态 2 的 `#dubKeepLimit`（默认关 = 与加这个功能之前逐字节一致，所以「不勾时不发
    // 那个键」是它最要紧的契约）。成片库（#films）此前**一条 UI 用例都没有**。
    //
    // ★ 重活一律拦下：真 TTS 合成（#btnVoiceTest）、真导入、真出片 —— 全用**页面内 patch
    //   window.fetch** 记录请求体后短路，绝不让它们跑起来。真出片/真上传那条路已由 E7 覆盖。
    log('');
    log(C.b('  G. 限幅开关 · 成片库 · 声音三处 · 主题工单 · 任务取消 · 预设/复制'));

    // 全新加载：--filter G* 时 B0 不在（E 段已兜底加载过一次），这里再刷一次拿到一个
    // **没有 E 段 fetch 桩**的干净文档 —— 否则 E 段那个把 /api/jobs 伪造成假任务列表的桩，
    // 会让 G11（任务列表取消）永远找不到真任务行。
    await cdp.goto(base + '/', 4000);
    await waitFor(cdp.evalJs,
      `!!document.getElementById('dubCard') && document.querySelectorAll('#dubStyle option').length > 0
       && document.querySelectorAll('#dubRatio option').length > 0 && document.querySelectorAll('.style-item').length > 0`,
      { timeoutMs: 30000 });

    // G 段统一的 fetch 桩（装在最外层）：
    //   · POST /api/dub/run        → 记录 body 并**短路**（绝不真出片；job.id='' → 前端不轮询）
    //   · POST /api/voices/test    → 记录 body 并**短路**（绝不真跑 TTS 烧 GPU）
    //   · POST /api/voices/import  → 记录 body 并**短路**（绝不真导入）
    //   · POST /api/briefs         → 记录 body 后**透传真网络**（工单要真落盘，G10 才有得断言）
    //   · GET  /api/films          → 只记录 URL，透传真网络（G4 要卡片数 == 服务端 films.length）
    //   · DELETE /api/jobs/<id>    → 只记录 URL，透传真网络（G11 要真的取消）
    await cdp.evalJs(`(() => {
      window.__gRealFetch = window.fetch.bind(window);
      window.__gFilms = []; window.__gBriefReqs = []; window.__gBriefResp = null;
      window.__dubRunBodies = []; window.__gVoiceTest = []; window.__gVoiceImport = []; window.__gJobDel = [];
      const fake = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify(obj) });
      window.fetch = function (u, o) {
        try {
          const s = String(u);
          const m = String((o && o.method) || 'GET').toUpperCase();
          if (s.indexOf('/api/dub/run') >= 0 && m === 'POST') {
            window.__dubRunBodies.push({ url: s, body: o && o.body });
            return Promise.resolve(fake({ ok: true, job: { id: '', status: 'canceled' },
              out: '', outName: '', artifacts: {}, style: '', keepOriginal: false, hint: '' }));
          }
          if (s.indexOf('/api/voices/test') >= 0 && m === 'POST') {
            window.__gVoiceTest.push({ url: s, body: o && o.body });
            return Promise.resolve(fake({ ok: true, job: { id: '', status: 'done' }, url: '',
              voice: { name: 'g-fake', speed: 1.1, textChars: 0 } }));
          }
          if (s.indexOf('/api/voices/import') >= 0 && m === 'POST') {
            window.__gVoiceImport.push({ url: s, body: o && o.body });
            return Promise.resolve(fake({ ok: true, job: { id: '', status: 'done' }, out: '', name: 'g-fake', hint: '' }));
          }
          if (s.indexOf('/api/briefs') >= 0 && m === 'POST' && s.indexOf('/api/briefs/') < 0) {
            window.__gBriefReqs.push({ url: s, body: o && o.body });
            return window.__gRealFetch.apply(this, arguments).then((r) => {
              try { r.clone().text().then((t) => { try { window.__gBriefResp = JSON.parse(t); } catch (e) {} }); } catch (e) {}
              return r;
            });
          }
          if (s.indexOf('/api/films') >= 0 && m === 'GET' && s.indexOf('/api/films/') < 0) window.__gFilms.push(s);
          if (m === 'DELETE' && s.indexOf('/api/jobs/') >= 0) window.__gJobDel.push({ url: s, method: m });
        } catch (e) { /* 拦不住就走真网络 */ }
        return window.__gRealFetch.apply(this, arguments);
      };
      return true;
    })()`);

    // ── 成片库：服务端权威清单（G4–G6 的期望值全部从它自算，不硬编码文件名/顺序）──
    let gFilms = ((await get('/api/films')).json || {}).films || [];
    if (!gFilms.length) {
      // 干净机器：临时造一个极小的假成片（目录名不以 `_`/`.` 开头，否则服务端会跳过）——
      // 绝不静默跳过。跑完按**确切路径**递归删（登记在 CREATED_FILM_DIRS）。
      const dir = path.join(CFG.exportDir, `uitest-films-${process.pid}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'clip.mp4'), Buffer.from('FAKE-MP4-BYTES-for-ui-g'));
      CREATED_FILM_DIRS.add(dir);
      gFilms = ((await get('/api/films')).json || {}).films || [];
    }
    need(gFilms.length > 0,
      `成片库为空（${CFG.exportDir}），临时造假成片后仍拿不到条目 —— 成片库测不了（绝不静默跳过）`);

    const gDemos = await get('/api/demos');
    const gNameCn = (slug) => { const s = (gDemos.json.styles || []).find((x) => x.slug === slug); return (s && s.nameCn) || slug; };
    const gIsDub = (f) => !!(f && (f.source === 'dub' || !f.slug));
    const gTitle = (f) => (gIsDub(f) ? '文案出片' : gNameCn(f.slug));
    const gIdOf = (f) => (gIsDub(f) ? `D|${f.name}|${f.file}` : `S|${gTitle(f)}|${f.file}`);
    const gFilmKey = (f) => (gIsDub(f) ? `文案出片 ${f.name || ''}`.trim() : String(f.slug));
    // 与 app.js:sortedFilms 同一套排序规则（期望顺序在 node 侧自算，不硬编码）
    const gSorted = (films, sort) => films.slice().sort((a, b) => {
      if (sort === 'size') return b.size - a.size;
      if (sort === 'slug') return gFilmKey(a).localeCompare(gFilmKey(b)) || b.mtime - a.mtime;
      return b.mtime - a.mtime;
    });
    /** 读回 #films 里每张卡片的**稳定身份**（与 gIdOf 同一套编码，不依赖 DOM 顺序）。 */
    const gDomIds = () => cdp.evalJs(`[...document.querySelectorAll('#films .film')].map((c) => {
      const title = (c.querySelector('.fslug') || {}).textContent || '';
      const metas = [...c.querySelectorAll('.fmeta')].map((n) => n.textContent || '');
      const file = metas[1] || '';
      const dm = metas.find((m) => m.indexOf('dub\\\\') === 0);
      return dm ? 'D|' + dm.slice(4) + '|' + file : 'S|' + title + '|' + file;
    })`);
    const gWaitCount = async (expr, want, timeoutMs = 15000) => {
      const t0 = Date.now(); let last;
      while (Date.now() - t0 < timeoutMs) {
        last = await cdp.evalJs(expr);
        if (last === want) return last;
        await sleep(150);
      }
      throw new Error(`等待「${expr} === ${want}」超时（最后一次 = ${JSON.stringify(last)}）`);
    };
    /** 形态 2：切过去 + 注入一个合成 videoToken（G 只验 body 组装；真上传路径由 E7 覆盖）。 */
    const gKeepToken = () => cdp.evalJs(`(() => {
      document.getElementById('dubModeKeep').click();
      const sel = document.getElementById('dubSrcSel');
      if (![...sel.options].some((o) => o.value === 'G-TOKEN')) {
        const o = document.createElement('option'); o.value = 'G-TOKEN'; o.textContent = 'g-token'; sel.appendChild(o);
      }
      sel.value = 'G-TOKEN'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      return document.getElementById('dubVideoHint').textContent;
    })()`);

    await runCase('G1 出片·形态2 不勾「限幅」：body 不含 keepOriginalLimit（默认关 = 与加功能前逐字节一致）', async () => {
      await ensureDubPage();
      const hint = await gKeepToken();
      need(/已选/.test(hint), `选中素材后 #dubVideoHint 没显示「已选」：「${hint}」`);
      await cdp.evalJs(`(() => {
        const cb = document.getElementById('dubKeepLimit');
        if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        const ta = document.getElementById('dubScript');
        ta.value = ${JSON.stringify(DUB_SCRIPT)}; ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      const caps = await dubRunCapture();
      const cap = caps[caps.length - 1];
      need(cap, '没捕获到 POST /api/dub/run（形态 2 被前端拦了？）');
      const body = JSON.parse(cap.body || '{}');
      need(body.keepOriginal === true, `形态 2 的 body 必须带 keepOriginal:true，实际 ${JSON.stringify(body.keepOriginal)}`);
      need(body.videoToken === 'G-TOKEN', `body.videoToken=${JSON.stringify(body.videoToken)}，期望 'G-TOKEN'`);
      // ★ 有牙：不勾时**绝不能**带这个键 —— 带了服务端就会传 --keep-original-limit，音轨被重编码。
      need(!('keepOriginalLimit' in body),
        `不勾「限幅」时 body 不该带 keepOriginalLimit，实际带了 ${JSON.stringify(body.keepOriginalLimit)}（body=${cap.body}）`);
      notes.push(`G1 形态2 不勾 → body keys=[${Object.keys(body).join(', ')}]（无 keepOriginalLimit）`);
    });

    await runCase('G2 出片·形态2 勾上「限幅」：body 含 keepOriginalLimit===true，且仍不含音色/语速/停顿/尺寸/fit', async () => {
      await ensureDubPage();
      await gKeepToken();
      const pre = await cdp.evalJs(`(() => {
        const cb = document.getElementById('dubKeepLimit');
        if (!cb) return { err: 'no-checkbox' };
        cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
        const ta = document.getElementById('dubScript');
        ta.value = ${JSON.stringify(DUB_SCRIPT)}; ta.dispatchEvent(new Event('input', { bubbles: true }));
        return { checked: cb.checked, hint: document.getElementById('dubLimitHint').textContent };
      })()`);
      need(!pre.err, '#dubKeepLimit 不在（形态 2 专属的限幅开关没渲染）');
      // ★ 提示必须诚实：勾上后要明说音轨会被重编码、不再逐字节相同
      need(/已开/.test(pre.hint), `勾上后 #dubLimitHint 没写「已开」：「${pre.hint}」`);
      const caps = await dubRunCapture();
      const cap = caps[caps.length - 1];
      need(cap, '没捕获到 POST /api/dub/run');
      const body = JSON.parse(cap.body || '{}');
      need(body.keepOriginalLimit === true, `勾上后 body.keepOriginalLimit 应为 true，实际 ${JSON.stringify(body.keepOriginalLimit)}`);
      // ★ 服务端契约：keepOriginalLimit 只在 keepOriginal=true 时才有意义（lib/dub.mjs 会 400）
      need(body.keepOriginal === true,
        `形态 2 必须同时带 keepOriginal:true，实际 ${JSON.stringify(body.keepOriginal)}（body=${cap.body}）`);
      need('videoToken' in body, `body 缺 videoToken（形态 2 的成立条件）`);
      for (const k of ['voice', 'speed', 'gap', 'size', 'ratio', 'fit']) {
        need(!(k in body), `形态 2 的 body 不该带 ${k}，实际带了 ${JSON.stringify(body[k])}（body=${cap.body}）`);
      }
      notes.push(`G2 形态2 勾上 → body keys=[${Object.keys(body).join(', ')}]（keepOriginalLimit=true）；提示「${pre.hint.slice(0, 30)}…」`);
    });

    await runCase('G3 出片·形态1：限幅复选框不可见（.dub-keep-only），且形态1 的 body 不含 keepOriginalLimit', async () => {
      await ensureDubPage();
      const vis = await cdp.evalJs(`(() => {
        document.getElementById('dubModeScript').click();
        const cb = document.getElementById('dubKeepLimit');
        const block = document.getElementById('dubLimitBlock');
        return {
          mode: document.getElementById('dubCard').className,
          blockDisplay: getComputedStyle(block).display,
          cbOffsetParentNull: cb.offsetParent === null,
          cbVisible: !!(cb.offsetWidth || cb.offsetHeight || cb.getClientRects().length),
        };
      })()`);
      need(/mode-script/.test(vis.mode), `没切到形态 1：${vis.mode}`);
      need(vis.blockDisplay === 'none',
        `形态 1 下 .dub-keep-only 块（#dubLimitBlock）应 display:none，实际「${vis.blockDisplay}」`);
      need(vis.cbOffsetParentNull === true && vis.cbVisible === false,
        `形态 1 下 #dubKeepLimit 应不可见（offsetParent=null / 无布局盒），实际 ${JSON.stringify(vis)}`);
      const caps = await dubRunCapture();
      const cap = caps[caps.length - 1];
      need(cap, '没捕获到 POST /api/dub/run（形态 1）');
      const body = JSON.parse(cap.body || '{}');
      // ★ 即使复选框还残留 checked（G2 勾过），形态 1 也绝不能带这个键 —— 它只在 keep 分支才该出现
      need(!('keepOriginalLimit' in body),
        `形态 1 的 body 不该带 keepOriginalLimit，实际 ${JSON.stringify(body.keepOriginalLimit)}（body=${cap.body}）`);
      need(!('keepOriginal' in body), `形态 1 的 body 不该带 keepOriginal，实际 ${JSON.stringify(body.keepOriginal)}`);
      notes.push(`G3 形态1：#dubLimitBlock display=${vis.blockDisplay}、#dubKeepLimit 无布局盒；body 无 keepOriginalLimit`);
      await cdp.evalJs(`(() => { const cb = document.getElementById('dubKeepLimit'); if (cb) cb.checked = false; return true; })()`);
    });

    await runCase('G4 成片库·刷新：点「刷新」真的 GET /api/films，卡片数 == 服务端 films.length', async () => {
      await cdp.evalJs(`(() => { window.__gFilms = [];
        const s = document.getElementById('filmSearch'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await cdp.evalJs(`document.getElementById('btnRefreshFilms').click()`);
      await waitFor(cdp.evalJs, `(window.__gFilms || []).length > 0`, { timeoutMs: 15000 });
      const urls = await cdp.evalJs(`window.__gFilms || []`);
      need(urls.some((u) => u === '/api/films' || u.indexOf('/api/films?') === 0),
        `点「刷新」后没看到 GET /api/films 请求：${JSON.stringify(urls)}`);
      await gWaitCount(`document.querySelectorAll('#films .film').length`, gFilms.length, 15000);
      const info = await cdp.evalJs(`(() => ({
        n: document.querySelectorAll('#films .film').length,
        count: document.getElementById('filmCount').textContent,
      }))()`);
      need(info.n === gFilms.length, `成片卡片 ${info.n} 张，服务端 films.length=${gFilms.length}`);
      need(info.count === `${gFilms.length}/${gFilms.length}`,
        `#filmCount 应显示「${gFilms.length}/${gFilms.length}」，实际「${info.count}」`);
      notes.push(`G4 刷新 → GET ${urls[urls.length - 1]}；卡片 ${info.n} 张 == 服务端 films.length`);
    });

    await runCase('G5 成片库·排序：切 #filmSort → 卡片顺序真的变（按服务端数据自算期望，不硬编码）', async () => {
      await cdp.evalJs(`(() => { const s = document.getElementById('filmSearch');
        s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      const setSort = (v) => cdp.evalJs(`(() => { const sel = document.getElementById('filmSort');
        sel.value = ${JSON.stringify(v)}; sel.dispatchEvent(new Event('change', { bubbles: true })); return sel.value; })()`);

      const vTime = await setSort('time');
      need(vTime === 'time', `#filmSort 没能切到 time：${vTime}`);
      const timeIds = await gDomIds();
      const expTime = gSorted(gFilms, 'time').map(gIdOf);
      need(JSON.stringify(timeIds) === JSON.stringify(expTime),
        `「时间」排序与服务端数据自算的顺序不一致：\n  DOM  = ${JSON.stringify(timeIds.slice(0, 5))}…\n  期望 = ${JSON.stringify(expTime.slice(0, 5))}…`);

      const vSize = await setSort('size');
      need(vSize === 'size', `#filmSort 没能切到 size：${vSize}`);
      const sizeIds = await gDomIds();
      const expSize = gSorted(gFilms, 'size').map(gIdOf);
      need(JSON.stringify(sizeIds) === JSON.stringify(expSize),
        `「大小」排序与服务端数据自算不一致：\n  DOM  = ${JSON.stringify(sizeIds.slice(0, 5))}…\n  期望 = ${JSON.stringify(expSize.slice(0, 5))}…`);
      // ★ 有牙：顺序必须**真的变**（否则排序等于没生效 / 或本用例没验到东西）
      need(JSON.stringify(sizeIds) !== JSON.stringify(timeIds), '切成「大小」后卡片顺序没变 —— 排序没生效？');

      const vSlug = await setSort('slug');
      need(vSlug === 'slug', `#filmSort 没能切到 slug：${vSlug}`);
      const slugIds = await gDomIds();
      need(JSON.stringify([...slugIds].sort()) === JSON.stringify([...timeIds].sort()),
        '切排序后卡片集合变了（应只是顺序变）');
      // slug 排序里 dub 条目的 key 以中文开头，localeCompare 的「块位置」依赖运行环境 —— 所以只对
      // **非 dub 子序列**严格比较（纯 ASCII slug 的比较在任何 locale 下都一致）。
      const nonDubDom = slugIds.filter((x) => x[0] === 'S');
      const nonDubExp = gSorted(gFilms.filter((f) => !gIsDub(f)), 'slug').map(gIdOf);
      need(JSON.stringify(nonDubDom) === JSON.stringify(nonDubExp),
        `「风格名」排序下风格成片子序列与自算不一致：\n  DOM  = ${JSON.stringify(nonDubDom.slice(0, 5))}…\n  期望 = ${JSON.stringify(nonDubExp.slice(0, 5))}…`);
      notes.push(`G5 排序：time/size 与服务端自算逐条一致（且 size≠time）；slug 下风格子序列正确`);
      await setSort('time');
    });

    await runCase('G6 成片库·筛选：输入 slug 片段只剩匹配卡片；输入不存在的串 → 0 张 + 空状态', async () => {
      await cdp.evalJs(`(() => { const sel = document.getElementById('filmSort');
        sel.value = 'time'; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
      const gFilter = (q) => {
        const qq = q.trim().toLowerCase();
        return gFilms.filter((f) => !qq
          || (f.slug || '').toLowerCase().includes(qq)
          || (f.file || '').toLowerCase().includes(qq)
          || (f.name || '').toLowerCase().includes(qq)
          || (gIsDub(f) && '文案出片'.includes(qq)));
      };
      // 用一个**最长 slug** 当片段，保证是严格子集（别用 'coffee' 这种会前缀命中一堆的）
      const longest = gFilms.slice().sort((a, b) => String(b.slug || '').length - String(a.slug || '').length)[0];
      const frag = String(longest.slug || longest.file || '');
      const expHit = gFilter(frag);
      need(frag && expHit.length > 0 && expHit.length < gFilms.length,
        `片段「${frag}」不是严格子集（命中 ${expHit.length}/${gFilms.length}）—— 换一个片段`);

      const setQ = (v) => cdp.evalJs(`(() => { const s = document.getElementById('filmSearch');
        s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('input', { bubbles: true })); return s.value; })()`);

      await setQ(frag);
      const hitIds = await gDomIds();
      need(hitIds.length === expHit.length,
        `输入「${frag}」后卡片 ${hitIds.length} 张，期望 ${expHit.length} 张（服务端数据自算）`);
      const hitCount = await cdp.evalJs(`document.getElementById('filmCount').textContent`);
      need(hitCount === `${expHit.length}/${gFilms.length}`,
        `#filmCount 应「${expHit.length}/${gFilms.length}」，实际「${hitCount}」`);

      const nope = `zzz-no-such-film-${process.pid}`;
      await setQ(nope);
      const zero = await cdp.evalJs(`(() => ({
        n: document.querySelectorAll('#films .film').length,
        empty: (document.querySelector('#films .empty') || {}).textContent || '',
        count: document.getElementById('filmCount').textContent,
      }))()`);
      need(zero.n === 0, `输入不存在的串「${nope}」后仍有 ${zero.n} 张卡片`);
      need(/没有匹配的成片/.test(zero.empty), `空状态文案不对：「${zero.empty}」`);
      need(zero.count === `0/${gFilms.length}`, `#filmCount 应「0/${gFilms.length}」，实际「${zero.count}」`);
      notes.push(`G6 筛选「${frag}」→ ${hitIds.length} 张（= 自算 ${expHit.length}）；不存在串 → 0 张 + 空状态`);
      await setQ('');
    });

    await runCase('G7 声音·试合成一句：点它**真的**向 /api/voices/test 发请求（fetch 桩拦下，绝不真合成）', async () => {
      // 保证有一条当前音色（--filter G 时 D3 没跑）—— 否则 startVoiceTest 会在前端就被拦下
      const picked = await cdp.evalJs(`(() => {
        const it = [...document.querySelectorAll('#voiceList .voice')]
          .find((n) => [...n.querySelectorAll('.vacts button')].some((b) => b.textContent.trim() === '选用'));
        if (it) [...it.querySelectorAll('.vacts button')].find((b) => b.textContent.trim() === '选用').click();
        return { picked: !!it, ls: localStorage.getItem('lemo.voice') };
      })()`);
      need(picked.picked, '音色列表里找不到可「选用」的条目（声音版块没渲染好？）');
      await cdp.evalJs(`window.__gVoiceTest = []; true;`);
      const clicked = await cdp.evalJs(`(() => {
        const b = document.getElementById('btnVoiceTest');
        if (!b) return { err: 'no-btn' };
        b.click();
        return { ok: true };
      })()`);
      need(clicked.ok, '#btnVoiceTest 不在（「试合成一句」按钮没渲染）');
      await waitFor(cdp.evalJs, `(window.__gVoiceTest || []).length > 0`, { timeoutMs: 10000 });
      const caps = await cdp.evalJs(`window.__gVoiceTest || []`);
      const cap = caps[caps.length - 1];
      need(/\/api\/voices\/test(\?|$)/.test(cap.url), `试合成没打到 /api/voices/test，实际 ${cap.url}`);
      const body = JSON.parse(cap.body || '{}');
      need(typeof body.name === 'string' && body.name.length > 0, `试合成请求体缺 name：${cap.body}`);
      need(Number.isFinite(Number(body.speed)), `试合成请求体缺 speed：${cap.body}`);
      notes.push(`G7 点「试合成一句」→ POST ${cap.url}；body.name=${JSON.stringify(body.name)}（fetch 桩拦下，未真合成）`);
    });

    await runCase('G8 声音·导入音色：展开折叠区出现「导入」按钮，点它向 /api/voices/import 发请求（桩拦下，绝不真导入）', async () => {
      // 干净机器上源目录里可能全是「已导入」→ 没有待导入项 → 没有「导入」按钮。造一个假的待导入文件
      // （落在**非 C 盘**的音色源目录里），跑完按**确切路径**删（登记在 CREATED_VOICE_SRCS）。
      const srcInfo = (await get('/api/voices/sources')).json;
      need(srcInfo && srcInfo.ok === true && srcInfo.dir,
        `GET /api/voices/sources 读不到源目录：${JSON.stringify(srcInfo).slice(0, 160)}`);
      const tmpName = `ui-g-import-${process.pid}.mp3`;
      const tmpPath = path.join(srcInfo.dir, tmpName);
      if (!fs.existsSync(tmpPath)) {
        fs.writeFileSync(tmpPath, Buffer.from('FAKE-MP3-for-ui-g8'));
        CREATED_VOICE_SRCS.add(tmpPath);
      }
      await cdp.evalJs(`window.__gVoiceImport = []; true;`);
      const opened = await cdp.evalJs(`(() => {
        const d = document.getElementById('voiceImport');
        if (!d) return { err: 'no-details' };
        if (!d.open) d.querySelector('summary').click();
        return { ok: true, open: d.open };
      })()`);
      need(opened.ok && opened.open, `#voiceImport 折叠区打不开：${JSON.stringify(opened)}`);
      const clicked = await cdp.evalJs(`(async () => {
        for (let i = 0; i < 80; i++) {
          const row = [...document.querySelectorAll('#viList .vi-item')]
            .find((r) => { const f = r.querySelector('.vifile'); return f && f.textContent === ${JSON.stringify(tmpName)}; });
          if (row) {
            const btn = [...row.querySelectorAll('.viacts button')].find((b) => /导入/.test(b.textContent));
            if (btn) { btn.click(); return { ok: true }; }
            return { err: 'no-import-button', txt: row.textContent.slice(0, 140) };
          }
          await new Promise((r) => setTimeout(r, 150));
        }
        return { err: 'row-not-found', items: [...document.querySelectorAll('#viList .vi-item .vifile')].map((n) => n.textContent) };
      })()`, { awaitPromise: true });
      need(clicked.ok, `导入按钮没点到：${JSON.stringify(clicked)}`);
      await waitFor(cdp.evalJs, `(window.__gVoiceImport || []).length > 0`, { timeoutMs: 10000 });
      const caps = await cdp.evalJs(`window.__gVoiceImport || []`);
      const cap = caps[caps.length - 1];
      const body = JSON.parse(cap.body || '{}');
      need(body.file === tmpName,
        `导入请求体的 file=${JSON.stringify(body.file)}，期望 ${JSON.stringify(tmpName)}（body=${cap.body}）`);
      notes.push(`G8 展开折叠区 → 点「导入」→ POST ${cap.url}；body.file=${JSON.stringify(body.file)}（fetch 桩拦下，未真导入）`);
    });

    await runCase('G9 声音·「重置为内容文件默认」：点它清掉本机选择（localStorage lemo.voice / lemo.speed）', async () => {
      const before = await cdp.evalJs(`(() => {
        const it = [...document.querySelectorAll('#voiceList .voice')]
          .find((n) => [...n.querySelectorAll('.vacts button')].some((b) => b.textContent.trim() === '选用'));
        if (it) [...it.querySelectorAll('.vacts button')].find((b) => b.textContent.trim() === '选用').click();
        return { ls: localStorage.getItem('lemo.voice') };
      })()`);
      need(before.ls, '前置不成立：没能先选上一条音色（localStorage[\'lemo.voice\'] 仍为空）');
      const after = await cdp.evalJs(`(() => {
        const btn = document.querySelector('#voiceCurrent .vc-reset');
        if (!btn) return { err: 'no-reset-btn', cur: document.getElementById('voiceCurrent').textContent };
        btn.click();
        return { ok: true, ls: localStorage.getItem('lemo.voice'), speed: localStorage.getItem('lemo.speed'),
                 toast: document.getElementById('toast').textContent };
      })()`);
      need(after.ok, `#voiceCurrent 里没有 .vc-reset 按钮：${JSON.stringify(after)}`);
      // ★ 实现是 saveVoicePref(key,'') → localStorage.removeItem(key)（app.js:1018）
      need(after.ls === null,
        `点「重置为内容文件默认」后 localStorage['lemo.voice'] 应被清掉（null），实际 ${JSON.stringify(after.ls)}`);
      need(after.speed === null, `localStorage['lemo.speed'] 也应被清掉，实际 ${JSON.stringify(after.speed)}`);
      need(/已重置为内容文件默认/.test(after.toast), `重置后的 toast 文案不对：「${after.toast}」`);
      notes.push(`G9 点 .vc-reset → lemo.voice=${JSON.stringify(after.ls)} / lemo.speed=${JSON.stringify(after.speed)}；toast「${after.toast.replace(/\s+/g, ' ').slice(0, 40)}」`);
    });

    await runCase('G10 主题出片·生成工单：填主题+语言+尺寸 → 真 POST /api/briefs（体与表单一致）且 GET /api/briefs 能看到', async () => {
      await waitFor(cdp.evalJs,
        `document.querySelectorAll('#briefSlug option').length > 0 && document.querySelectorAll('#briefRatio option').length > 0`,
        { timeoutMs: 20000 });
      // 选风格（触发语言选项异步刷新 /api/langs），再等语言选项就绪（拿不到就按空 = 服务端默认）
      await cdp.evalJs(`(() => { const s = document.getElementById('briefSlug');
        s.value = s.options[0].value; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
      await waitFor(cdp.evalJs, `document.querySelectorAll('#briefLang option').length > 0`, { timeoutMs: 15000 })
        .catch(() => null);
      const form = await cdp.evalJs(`(() => {
        const slugSel = document.getElementById('briefSlug');
        const langSel = document.getElementById('briefLang');
        const ratioSel = document.getElementById('briefRatio');
        const slug = slugSel.value;
        const lang = langSel ? langSel.value : '';
        const r = [...ratioSel.options].find((o) => !/自定义/.test(o.textContent)) || ratioSel.options[0];
        ratioSel.value = r.value; ratioSel.dispatchEvent(new Event('change', { bubbles: true }));
        const topic = 'UI 测试：G10 生成工单 ' + ${JSON.stringify(String(process.pid))} + '-' + Date.now();
        document.getElementById('briefTopic').value = topic;
        document.getElementById('btnBriefCreate').click();
        return { slug, lang, ratio: ratioSel.value, topic };
      })()`);
      need(form.slug && form.ratio, `表单没填好：${JSON.stringify(form)}`);
      await waitFor(cdp.evalJs, `(window.__gBriefReqs || []).length > 0`, { timeoutMs: 15000 });
      const reqs = await cdp.evalJs(`window.__gBriefReqs || []`);
      const cap = reqs[reqs.length - 1];
      const body = JSON.parse(cap.body || '{}');
      need(body.topic === form.topic, `请求体 topic=${JSON.stringify(body.topic)}，期望 ${JSON.stringify(form.topic)}`);
      need(body.slug === form.slug, `请求体 slug=${JSON.stringify(body.slug)}，期望 ${JSON.stringify(form.slug)}`);
      need(body.lang === form.lang, `请求体 lang=${JSON.stringify(body.lang)}，期望 ${JSON.stringify(form.lang)}`);
      need(body.ratio === form.ratio, `请求体 ratio=${JSON.stringify(body.ratio)}，期望 ${JSON.stringify(form.ratio)}`);
      // ★ 工单**真的落盘**了：登记进 BRIEF_IDS，由既有 cleanupBriefs(port) 在**停服务之前**删掉
      const id = await waitFor(cdp.evalJs,
        `(window.__gBriefResp && window.__gBriefResp.brief && window.__gBriefResp.brief.id) || ''`, { timeoutMs: 15000 });
      BRIEF_IDS.add(id);
      const list = await get('/api/briefs');
      const found = ((list.json && list.json.briefs) || []).find((b) => b.id === id);
      need(found, `GET /api/briefs 里找不到刚建的工单 ${id}`);
      need(found.topic === form.topic, `工单 topic 回读不一致：${JSON.stringify(found.topic)}`);
      notes.push(`G10 生成工单 ${id}（slug=${form.slug} lang=${form.lang} ratio=${form.ratio}）；GET /api/briefs 已能看到`);
    });

    await runCase('G11 任务列表·取消：点行内「取消」→ 真发 DELETE /api/jobs/:id，状态转 canceled 且文案中性（无「失败」）', async () => {
      const slug = 'ascii-crt';
      const lockPath = path.join(CFG.exportDir, `.${slug}.lock`);
      // ① 真入队一条 --dry-run --skip-sync（无害长任务，约几秒；绝不真渲染/混流）
      const r = await post('/api/run', { slug, opts: ['--dry-run', '--skip-sync'] });
      need(r.status === 200 && r.json && r.json.job, `POST /api/run → ${r.status} ${r.text.slice(0, 160)}`);
      const id = r.json.job.id;
      JOB_IDS.add(id);

      // ② 等它 running 并拿到 pid（顺便登记陈旧锁：取消会硬杀进程树，releaseLock 不会执行）
      let job = null;
      {
        const t0 = Date.now();
        while (Date.now() - t0 < 15000) {
          const j = ((await get('/api/jobs')).json.jobs || []).find((x) => x.id === id);
          if (j && j.status === 'running' && j.pid) { job = j; break; }
          if (j && ['done', 'failed', 'canceled', 'ended'].includes(j.status)) { job = j; break; }
          await sleep(80);
        }
      }
      need(job, `/api/jobs 里找不到 ${id}`);
      need(job.status === 'running' && Number.isInteger(job.pid) && job.pid > 0,
        `取消前状态是 ${job.status}（期望 running 且有 pid）—— dry-run 是不是太快跑完了？`);
      CREATED_LOCKS.set(lockPath, job.pid);

      // ③ 在 #jobs 里找到这一行 → 点「取消」（DELETE 被 G 的 fetch 桩**记录**，但仍走真网络）
      await cdp.evalJs(`window.__gJobDel = []; true;`);
      const clicked = await cdp.evalJs(`(async () => {
        document.getElementById('btnRefreshJobs').click();
        for (let i = 0; i < 60; i++) {
          const row = [...document.querySelectorAll('#jobs .job')]
            .find((n) => { const t = n.querySelector('.jid'); return t && t.textContent === ${JSON.stringify(id)}; });
          if (row) {
            const st = row.querySelector('.status');
            const btn = [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消');
            if (btn) { btn.click(); return { ok: true, statusText: st ? st.textContent : '', cls: st ? st.className : '' }; }
            return { err: 'no-cancel-button', cls: st ? st.className : '', txt: row.textContent.slice(0, 140) };
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        return { err: 'row-not-found' };
      })()`, { awaitPromise: true });
      need(clicked.ok, `没能在 #jobs 里点到 ${id} 的「取消」按钮：${JSON.stringify(clicked)}`);
      need(clicked.statusText === '运行中' || clicked.statusText === '排队中',
        `点「取消」前该行状态应是「运行中/排队中」，实际「${clicked.statusText}」`);

      // ④ 真的发出 DELETE /api/jobs/<id>
      await waitFor(cdp.evalJs, `(window.__gJobDel || []).length > 0`, { timeoutMs: 10000 });
      const dels = await cdp.evalJs(`window.__gJobDel || []`);
      const want = '/api/jobs/' + encodeURIComponent(id);
      need(dels.some((d) => d.url === want),
        `点「取消」后没看到 DELETE ${want}；实际：${JSON.stringify(dels)}`);

      // ⑤ 服务端状态真的转 canceled，且**记录仍在**（取消 ≠ 删除 —— 删了会留下占 GPU 的孤儿）
      let st2 = null;
      {
        const t0 = Date.now();
        while (Date.now() - t0 < 20000) {
          const j = ((await get('/api/jobs')).json.jobs || []).find((x) => x.id === id);
          if (j && j.status === 'canceled') { st2 = j; break; }
          if (j && ['done', 'failed', 'ended'].includes(j.status)) { st2 = j; break; }
          await sleep(200);
        }
      }
      need(st2, `取消后 /api/jobs 里找不到 ${id} —— running 任务被「删除」了？（取消只能置 canceled）`);
      need(st2.status === 'canceled', `取消后状态 ${st2.status}（期望 canceled）`);

      // ⑥ ★ 界面文案必须**中性**：用户主动取消 ≠ 失败，不得出现红色「失败」措辞（本项目已固化的约定）
      const ui = await waitFor(cdp.evalJs, `(() => {
        const row = [...document.querySelectorAll('#jobs .job')]
          .find((n) => { const t = n.querySelector('.jid'); return t && t.textContent === ${JSON.stringify(id)}; });
        if (!row) return null;
        const s = row.querySelector('.status');
        return (s && s.textContent === '已取消')
          ? { text: s.textContent, cls: s.className, rowText: row.textContent } : null;
      })()`, { timeoutMs: 20000 });
      need(!/失败/.test(ui.rowText),
        `取消后的行里出现了「失败」措辞（应中性）：${ui.rowText.replace(/\s+/g, ' ').slice(0, 140)}`);
      need(/\bcanceled\b/.test(ui.cls) && !/\bfailed\b/.test(ui.cls),
        `状态 class 应是 canceled 而非 failed，实际「${ui.cls}」`);
      notes.push(`G11 取消 ${id}（${slug}）：UI 发 DELETE ${want}；服务端 → canceled 且记录仍在；行文案「${ui.text}」（中性）`);
    });

    await runCase('G12 启动表单·常用组合预设：点它只改勾选、**不**启动任务', async () => {
      await cdp.evalJs(`(() => { for (const id of ['fSkipSync','fSkipRender','fAudioOnly','fRenderOnly','fDryRun']) {
        const e = document.getElementById(id); if (e) e.checked = false; } return true; })()`);
      const before = ((await get('/api/jobs')).json.jobs || []).length;
      const res = await cdp.evalJs(`(() => {
        const out = [];
        for (const b of document.querySelectorAll('.preset')) {
          b.click();
          out.push({ id: b.dataset.preset,
            chk: { skipSync: document.getElementById('fSkipSync').checked,
                   skipRender: document.getElementById('fSkipRender').checked,
                   audioOnly: document.getElementById('fAudioOnly').checked,
                   renderOnly: document.getElementById('fRenderOnly').checked,
                   dryRun: document.getElementById('fDryRun').checked },
            active: b.classList.contains('active') });
        }
        return out;
      })()`);
      const by = Object.fromEntries(res.map((x) => [x.id, x]));
      need(by.audio && by.audio.chk.skipRender === true && by.audio.chk.audioOnly === true && by.audio.chk.dryRun === false,
        `「只调音」的勾选不对：${JSON.stringify(by.audio)}`);
      need(by.render && by.render.chk.renderOnly === true && by.render.chk.audioOnly === false && by.render.chk.skipRender === false,
        `「只重渲」的勾选不对：${JSON.stringify(by.render)}`);
      need(by.dry && by.dry.chk.dryRun === true && by.dry.chk.skipSync === false,
        `「试跑」的勾选不对：${JSON.stringify(by.dry)}`);
      need(by.quick && Object.values(by.quick.chk).every((v) => v === false),
        `「快速出片」应全不勾：${JSON.stringify(by.quick)}`);
      need(res.length > 0 && res.every((x) => x.active === true),
        `点过的预设应高亮（active），实际 ${JSON.stringify(res.map((x) => [x.id, x.active]))}`);
      await sleep(600);   // 给「万一真入队」一点时间冒出来
      const after = ((await get('/api/jobs')).json.jobs || []).length;
      need(after === before, `点预设竟然入队了任务：任务数 ${before} → ${after}`);
      notes.push(`G12 预设 quick/audio/render/dry 只改勾选且逐个高亮；任务数 ${before} 不变（不启动）`);
    });

    await runCase('G13 启动表单·复制按钮：点它不报错、按钮仍在（不断言剪贴板内容）', async () => {
      const st = await cdp.evalJs(`(() => {
        const f = document.getElementById('fSlug');
        f.value = ${JSON.stringify(state.slugA)};
        f.dispatchEvent(new Event('input', { bubbles: true }));
        const b = document.getElementById('btnCopyCmd');
        return { hidden: b.hidden, cmd: document.getElementById('cmdPreview').textContent };
      })()`);
      need(st.hidden === false, `选了风格后 #btnCopyCmd 应可见（cmdPreview=「${st.cmd}」），实际 hidden=${st.hidden}`);
      const clicked = await cdp.evalJs(`(() => { const b = document.getElementById('btnCopyCmd'); b.click(); return { ok: true }; })()`);
      need(clicked.ok, '#btnCopyCmd 点击抛错');
      // 剪贴板在无头环境可能被拒 —— 只断言「点了不报错、按钮仍在、且给了明确反馈」
      const txt = await waitFor(cdp.evalJs,
        `(() => { const b = document.getElementById('btnCopyCmd');
          if (!b) return ''; const t = b.textContent;
          return (t === '已复制' || t === '复制失败') ? t : ''; })()`, { timeoutMs: 5000 });
      const still = await cdp.evalJs(`(() => { const b = document.getElementById('btnCopyCmd');
        return !!b && document.body.contains(b); })()`);
      need(still, '#btnCopyCmd 点后从 DOM 里消失了');
      notes.push(`G13 点「复制」→ 不抛错；按钮文案「${txt}」（无头环境剪贴板可能被拒，只断言点了不报错）`);
    });

    // ══ H. 主题出片的画幅警告「一键修复」（警告从被动文本 → 可操作）══
    //
    // 为什么补这一节：syncBriefAspectWarn() 早就把「选的尺寸会被裁」写进了 #briefAspectWarn，
    // 但那是**被动文本** —— 用户得自己去 #briefRatio 下拉里找正确比例再改一次，摩擦大到等于没修。
    // 本轮把它升级成「一句说明 + 一个『改用 X』按钮」。这一节钉住：
    //   ① 警告态**有按钮**、且按钮**真的能把尺寸改对并让警告消失**（H1/H2 —— 有牙的核心）；
    //   ② 当前比例被该风格支持时**不警告、也没有按钮**（H3）；
    //   ③ 警告不是**空盒子**（H4）、且多次重核**不会堆出多个按钮**（H5，幂等）。
    // ★ 判据一律从服务端数据现取（/api/briefs 的 styles[].aspects、/api/sizes 的 defaultRatio 与 ratios），
    //   不硬编码风格名 / 比例。★ 本节纯前端交互：只改 #briefRatio，**绝不触发任何出片**。
    // ★ 样本前提更新（多比例改造后）：4 个白名单风格都支持默认的 9:16，样本改用「任一预设比例里不被支持的那个」
    //   （详见下方 hBad / hBadRatio 的说明）。
    log('');
    log(C.b('  H. 主题出片·画幅警告的一键修复（按钮真的生效 / 不堆叠 / 不空转）'));

    // 服务端权威：4 个「内容驱动」风格及其 aspects；默认输出比例。
    const hBriefsRes = await get('/api/briefs');
    need(hBriefsRes.status === 200 && hBriefsRes.json && Array.isArray(hBriefsRes.json.styles),
      `GET /api/briefs → ${hBriefsRes.status}（拿不到 styles[]，本节测不了）`);
    const hStyles = hBriefsRes.json.styles;
    const hSizesRes = await get('/api/sizes');
    need(hSizesRes.status === 200 && typeof hSizesRes.json.defaultRatio === 'string',
      `GET /api/sizes → ${hSizesRes.status}（拿不到 defaultRatio）`);
    const hRatio = hSizesRes.json.defaultRatio;      // 当前/默认比例（控制台产品默认 9:16）
    const hSupOf = (s) => (s && s.aspects && Array.isArray(s.aspects.supported)) ? s.aspects.supported : null;
    // 「当前比例不被支持」的风格（会触发警告）与「当前比例被支持」的风格（不警告）——都现取，不硬编码。
    // ★ 前提已更新（多比例改造后）：4 个白名单风格**都**声明了 aspects、**都**支持默认的 9:16
    //   ⇒ 原先「拿默认比例当不匹配样本」已不可达。#briefSlug 只列这 4 个白名单风格
    //   （web/app.js 的 fillBriefStyles ← /api/briefs styles[] ← lib/briefs.mjs 的 BRIEF_STYLES），
    //   **唯一**不支持 9:16 的 pixel-rpg 不是「内容驱动」风格、不在其中（其画面主体写死，主题改不动），
    //   所以它做不了本节的样本 —— 硬塞进下拉也不行：syncBriefAspectWarn 查的是 state.briefStyles。
    //   判据本身没变（「当前比例不被该风格支持 → 警告 + 一键修复」），改成**优先默认比例、否则取任一预设比例**：
    //   仍是现取服务端数据（/api/sizes 的 ratios），不硬编码风格名 / 比例。
    const hRatioIds = (hSizesRes.json.ratios || []).map((r) => r.id).filter(Boolean);
    const hRatioOrder = [hRatio, ...hRatioIds.filter((r) => r !== hRatio)];
    let hBad = null, hBadRatio = null;
    for (const r of hRatioOrder) {
      const s = hStyles.find((x) => { const sup = hSupOf(x); return sup && sup.length && !sup.includes(r); });
      if (s) { hBad = s; hBadRatio = r; break; }
    }
    const hGood = hStyles.find((s) => { const sup = hSupOf(s); return sup && sup.includes(hRatio); });
    need(hBad, `没有「不支持任何预设比例」的风格 —— H1/H2 不可达（风格清单变了？）`);

    // 页面可能还没加载（--filter H* 时 B0 会被跳过）—— 兜底打开并等关键元素就绪。
    const hReady = `document.querySelectorAll('#briefSlug option').length > 0 && document.querySelectorAll('#briefRatio option').length > 0`;
    if (!(await cdp.evalJs(hReady))) await cdp.goto(base + '/', 4000);
    await waitFor(cdp.evalJs, hReady, { timeoutMs: 30000 });

    const hSetRatio = (r) => cdp.evalJs(`(() => { const s = document.getElementById('briefRatio');
      s.value = ${JSON.stringify(r)}; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
    const hPickSlug = (slug) => cdp.evalJs(`(() => {
      const s = document.getElementById('briefSlug');
      const has = [...s.options].some((o) => o.value === ${JSON.stringify(slug)});
      if (has) { s.value = ${JSON.stringify(slug)}; s.dispatchEvent(new Event('change', { bubbles: true })); }
      return { has, value: s.value };
    })()`);
    /** 读回警告盒子的真实状态：hidden 属性 + 实际渲染盒 + 文本（去掉按钮后）+ 按钮文案。 */
    const hWarn = () => cdp.evalJs(`(() => {
      const box = document.getElementById('briefAspectWarn');
      const r = box.getBoundingClientRect();
      const c = box.cloneNode(true); c.querySelectorAll('button').forEach((b) => b.remove());
      return {
        hidden: box.hidden,
        visible: !box.hidden && r.height > 0 && r.width > 0,
        msg: (c.textContent || '').trim(),
        btns: [...box.querySelectorAll('button')].map((b) => b.textContent),
      };
    })()`);
    /** 公共前置：把当前比例设成该风格**不支持**的那一个（hBadRatio），再选中该风格 → 进入「警告态」。 */
    const hArmWarn = async () => {
      await hSetRatio(hBadRatio);
      const picked = await hPickSlug(hBad.slug);
      need(picked.has, `#briefSlug 里没有风格 ${hBad.slug}（清单不同步）`);
      return picked;
    };

    await runCase('H1 画幅不匹配 → 警告可见、含「裁切」、且渲染出「改用 X」按钮', async () => {
      await hArmWarn();
      const w = await hWarn();
      need(w.hidden === false, `选了不支持 ${hBadRatio} 的风格 ${hBad.slug}，但 #briefAspectWarn 仍 hidden`);
      need(w.visible, `#briefAspectWarn 没 hidden，但实际渲染盒为 0（不可见）`);
      need(/裁切/.test(w.msg), `警告文案里没有「裁切」：「${w.msg.slice(0, 120)}」`);
      need(w.btns.length === 1, `期望恰好 1 个按钮，实际 ${w.btns.length} 个：${JSON.stringify(w.btns)}`);
      need(w.btns[0].includes(hSupOf(hBad)[0]), `按钮文案「${w.btns[0]}」没包含建议比例 ${hSupOf(hBad)[0]}`);
      notes.push(`H1 风格 ${hBad.slug}（支持 ${hSupOf(hBad).join('/')}）+ 当前 ${hBadRatio} → 警告可见、按钮「${w.btns[0]}」`);
    });

    await runCase('H2 点「改用 X」→ #briefRatio 变成该风格支持的比例，警告随之消失（按钮真的生效）', async () => {
      await hArmWarn();
      const before = await cdp.evalJs(`document.getElementById('briefRatio').value`);
      need(before === hBadRatio, `前置失败：#briefRatio=${before}，期望 ${hBadRatio}`);
      const want = hSupOf(hBad)[0];
      // ★ 点警告里的那个按钮（而不是直接改 select）—— 这才是「按钮有牙」的证明。
      const clicked = await cdp.evalJs(`(() => {
        const b = document.querySelector('#briefAspectWarn button');
        if (!b) return { ok: false, reason: 'no-button' };
        b.click(); return { ok: true, text: b.textContent };
      })()`);
      need(clicked.ok, `#briefAspectWarn 里没有可点的按钮：${JSON.stringify(clicked)}`);
      const after = await cdp.evalJs(`document.getElementById('briefRatio').value`);
      need(after === want, `点按钮后 #briefRatio=${after}，期望该风格支持的比例 ${want}`);
      const w = await hWarn();
      need(w.hidden === true, `尺寸已改到 ${want}（被支持），但警告没消失：${JSON.stringify(w)}`);
      need(w.btns.length === 0, `警告已隐藏，仍残留 ${w.btns.length} 个按钮`);
      notes.push(`H2 点「${clicked.text}」→ #briefRatio ${before} → ${after}，警告消失（未触发任何出片）`);
    });

    await runCase('H3 当前比例被该风格支持 → 不警告、也没有按钮', async () => {
      if (!hGood) { notes.push(`H3 分支不可达：没有「支持默认比例 ${hRatio}」的风格（如实标注，未跳过断言）`); return; }
      await hSetRatio(hRatio);
      const picked = await hPickSlug(hGood.slug);
      need(picked.has, `#briefSlug 里没有风格 ${hGood.slug}（清单不同步）`);
      const w = await hWarn();
      need(w.hidden === true, `风格 ${hGood.slug} 支持当前比例 ${hRatio}，却仍显示警告：${JSON.stringify(w)}`);
      need(w.btns.length === 0, `不该有按钮，实际 ${w.btns.length} 个：${JSON.stringify(w.btns)}`);
      notes.push(`H3 风格 ${hGood.slug}（支持 ${hSupOf(hGood).join('/')}）+ 当前 ${hRatio} → 无警告、无按钮`);
    });

    await runCase('H4 防空转：警告态下盒子里**确有可见文本**（不是只显示了一个空盒子）', async () => {
      await hArmWarn();
      const w = await hWarn();
      need(w.hidden === false && w.visible, `前置失败：警告没显示 ${JSON.stringify(w)}`);
      // 去掉按钮后仍有非空文本 = 真的给了说明，而不是「盒子亮了、里面没字」的假绿。
      need(w.msg.length > 0, '#briefAspectWarn 显示了但**去按钮后没有任何文本**（空盒子）');
      need(/裁切/.test(w.msg) && w.msg.length >= 20,
        `警告文本太短 / 不含关键信息（疑似空转）：${JSON.stringify(w.msg)}`);
      notes.push(`H4 警告文本（去按钮后）${w.msg.length} 字：「${w.msg.slice(0, 60)}…」`);
    });

    await runCase('H5 幂等：连续多次重核（change 事件）**不会堆出多个按钮**', async () => {
      await hArmWarn();
      // 连派 3 次 change（值不变）—— 每次都会走 syncBriefSizeUI → syncBriefAspectWarn。
      // 若实现没有「先清空容器再重建」，每重核一次就多堆一个按钮。
      await cdp.evalJs(`(() => { const s = document.getElementById('briefRatio');
        for (let i = 0; i < 3; i++) s.dispatchEvent(new Event('change', { bubbles: true }));
        return true; })()`);
      const w = await hWarn();
      need(w.hidden === false, `前置失败：重核后警告不见了 ${JSON.stringify(w)}`);
      need(w.btns.length === 1, `重核 3 次后按钮数=${w.btns.length}，期望恰好 1 个（幂等被破坏）：${JSON.stringify(w.btns)}`);
      notes.push(`H5 连派 3 次 change → 按钮仍为 ${w.btns.length} 个（未堆叠）`);
    });

    // ══ I. LLM API 配置面板（/api/llm/*）══════════════════════════
    // ★ 本批新增：面板此前在 UI 层**零覆盖**（只有 D:/lemo-tmp 下不进仓的探针）。
    //   四条断言：① 顶栏「LLM 配置」入口可达；② 默认/切换胶囊；③ 多模型切换（拉取→下拉→回填）；
    //   ④ 坏后端不白屏（patch window.fetch 只拦 /api/llm/*，4 类坏响应 × 3 个按钮 ⇒ 面板仍在 + 未捕获异常 0）；
    //   ⑤ 落盘隔离 + 保存刷新后候选仍在。
    //   ★ 落盘隔离：本组另起一个**专用测试服务**，把 LEMO_FILM_DIR 指到临时树 ⇒ 覆盖文件
    //     `<成片根>/_llm-api.json` 写进临时树，**绝不碰真实 `D:/lemo-films/_llm-api.json`**。
    //   ★ 只用 CDP 真点击 + 页面内 patch fetch，**不打真实外网**（上游是本地 mock）。
    const I_NAMES = ['I1 顶栏', 'I2 「当前默认', 'I3 多模型', 'I4 坏后端', 'I5 落盘隔离', 'I6 workbuddy-gateway'];
    const iWillRun = !OPT.filter || I_NAMES.some((n) => n.includes(OPT.filter));
    if (iWillRun) {
      log('');
      log(C.b('  I. LLM API 配置面板（/api/llm/*）'));

      const llmFilmDir = path.join(CFG.tmpDir, `b4-ui-llm-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(llmFilmDir, { recursive: true });
      TMP_ROOTS.add(llmFilmDir);                       // 跑完随 cleanupTmpDirs() 递归删掉
      const REAL_LLM_OVERRIDE = 'D:\\lemo-films\\_llm-api.json';
      const realOverrideBefore = (() => { try { return fs.readFileSync(REAL_LLM_OVERRIDE); } catch { return null; } })();

      llmMock = await startLlmMock(await freePort());
      const llmMockBase = `http://127.0.0.1:${llmMock.address().port}/v1`;
      llmServer = await startServer(2, { LEMO_FILM_DIR: llmFilmDir });
      const llmBase = `http://127.0.0.1:${llmServer.port}`;
      log(C.dim(`  LLM 测试服务 → ${llmBase}（覆盖文件隔离到 ${llmFilmDir}）`));
      log(C.dim(`  mock 上游 → ${llmMockBase}（候选模型 ${LLM_MOCK_MODELS.join(' / ')}）`));

      // ★ 必须**先导航到隔离服务**（H 组停在主服务上；否则保存会写到真实成片根）——
      //   再等面板**完整**就绪（`#llmProfileBadge` 只在 renderLlmForm 里填 ⇒ 它非空说明初始
      //   loadLlm() 已经跑完；否则 I2 的「切 profile」会被仍在飞的初始 loadLlmConfig 回填覆盖）。
      await cdp.goto(llmBase + '/', 4000);
      const iReady = `!!document.getElementById('llmCard') && !!document.getElementById('btnGotoLlm')
        && document.getElementById('llmProfile').options.length > 0
        && document.getElementById('llmProfileBadge').textContent.length > 0`;
      await waitFor(cdp.evalJs, iReady, { timeoutMs: 30000 });

      await runCase('I1 顶栏「LLM 配置」入口可达：按钮在、点了给卡片加高亮并滚进视口', async () => {
        need(await cdp.evalJs(`!!document.getElementById('btnGotoLlm')`), '顶栏没有「LLM 配置」入口按钮 #btnGotoLlm');
        // 先滚到顶（面板卡片在长页面靠下 ⇒ 此刻必然在视口外），再点入口 —— 才能证明「点了真的滚过去」
        await cdp.evalJs(`window.scrollTo(0, 0); true`);
        const beforeTop = await cdp.evalJs(`document.getElementById('llmCard').getBoundingClientRect().top`);
        const vh = await cdp.evalJs(`window.innerHeight`);
        need(beforeTop > vh, `前置失败：#llmCard 起点 ${Math.round(beforeTop)} 已在视口内，测不出「点了会滚过去」`);
        await cdp.evalJs(`document.getElementById('btnGotoLlm').click(); true`);
        // ★ 有牙的判据：gotoLlmCard() 会给卡片加 .flash 高亮（证明入口真的接到了面板，不是空按钮）
        need(await cdp.evalJs(`document.getElementById('llmCard').classList.contains('flash')`) === true,
          '点「LLM 配置」后 #llmCard 没有 .flash 高亮类（入口没接到面板）');
        await waitFor(cdp.evalJs,
          `document.getElementById('llmCard').getBoundingClientRect().top < window.innerHeight`,
          { timeoutMs: 8000 });
        const afterTop = await cdp.evalJs(`document.getElementById('llmCard').getBoundingClientRect().top`);
        need(afterTop < beforeTop, `点入口后 #llmCard 没上移（top ${Math.round(beforeTop)} → ${Math.round(afterTop)}）`);
        notes.push(`I1 顶栏入口可达：#llmCard 加 .flash；top ${Math.round(beforeTop)} → ${Math.round(afterTop)}`);
      });

      await runCase('I2 「当前默认：WorkBuddy」胶囊：默认态可见，切到别的 profile 后变「已切换：…」', async () => {
        // 面板已完整就绪（初始 loadLlm 跑完）⇒ 此刻就是默认态。
        // ★ 这里**不点「刷新」**：刷新会再起一次 loadLlm()，若它的响应晚于「切 profile」回来，
        //   会把 pill 回填成默认态（竞态）。等 badge 非空已经保证初始加载结束。
        await waitFor(cdp.evalJs, `/当前默认/.test(document.getElementById('llmCurrentPill').textContent)`, { timeoutMs: 15000 });
        const pill0 = await cdp.evalJs(`document.getElementById('llmCurrentPill').textContent`);
        need(/WorkBuddy/.test(pill0), `默认态胶囊文案是「${pill0}」，期望含「WorkBuddy」`);
        need(/is-default/.test(await cdp.evalJs(`document.getElementById('llmCurrentPill').className`)),
          '默认态胶囊没有 .is-default 类');

        // 切到一个非默认 profile（从下拉里挑一个 ≠ workbuddy 的，**不写死 id**）
        const sw = await cdp.evalJs(`(() => {
          const s = document.getElementById('llmProfile');
          const o = [...s.options].find((x) => x.value && x.value !== 'workbuddy');
          if (!o) return { ok: false };
          s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true }));
          return { ok: true, id: o.value };
        })()`);
        need(sw.ok, '#llmProfile 下拉里没有 workbuddy 之外的 profile（profile 清单读不到？）');
        await waitFor(cdp.evalJs, `/已切换/.test(document.getElementById('llmCurrentPill').textContent)`, { timeoutMs: 15000 });
        const pill1 = await cdp.evalJs(`document.getElementById('llmCurrentPill').textContent`);
        need(/is-switched/.test(await cdp.evalJs(`document.getElementById('llmCurrentPill').className`)),
          `切走后胶囊没有 .is-switched 类：${pill1}`);
        need(pill1.startsWith('已切换：'), `切到 ${sw.id} 后胶囊文案是「${pill1}」，期望以「已切换：」开头`);
        notes.push(`I2 胶囊：默认「${pill0}」→ 切到 ${sw.id} 后「${pill1}」`);

        // 切回 workbuddy，免得影响后面的用例
        await cdp.evalJs(`(() => { const s = document.getElementById('llmProfile');
          if ([...s.options].some((o) => o.value === 'workbuddy')) {
            s.value = 'workbuddy'; s.dispatchEvent(new Event('change', { bubbles: true }));
          } return true; })()`);
        await waitFor(cdp.evalJs, `/当前默认/.test(document.getElementById('llmCurrentPill').textContent)`, { timeoutMs: 15000 });
      });

      await runCase('I3 多模型切换 + agent 模式禁止拉取：agent 下按钮不可见且强行触发被拒；model 下拉取→候选→回填', async () => {
        // ★★ W2 新规格（规格 v3：不探查智能体内部模型）——**先钉住 agent 模式禁止拉取模型清单**：
        //   · 按钮**不可见**（面板层面禁用）；★ 且即便程序化 .click() 绕过可见性，**后端也拒绝**
        //     （不会返回候选）⇒ 这条断言「有牙」：把端点指向 mock，若真去拉会**命中 mock 并出现候选**。
        await cdp.evalJs(`(() => {
          const t = document.getElementById('llmTarget');
          t.value = 'agent'; t.dispatchEvent(new Event('change', { bubbles: true }));
          document.getElementById('llmKind').value = 'openai-compatible';
          document.getElementById('llmBaseUrl').value = ${JSON.stringify(llmMockBase)};
          document.getElementById('llmKey').value = 'sk-ui-mock-key-123456';
          document.getElementById('llmTimeout').value = '5000';
          const s = document.getElementById('llmModelSelect'); s.hidden = true; s.textContent = '';
          document.getElementById('llmModelHint').textContent = '';
          return true;
        })()`);
        need(await cdp.evalJs(`document.getElementById('btnLlmModels').hidden === true`),
          'agent 模式下「拉取服务清单」按钮应不可见（规格 v3 禁止探查智能体内部模型）');
        // 强行触发（绕过可见性）⇒ 后端拒绝 ⇒ 下拉**不出现候选** + 提示含「失败」
        await cdp.evalJs(`document.getElementById('btnLlmModels').click(); true`);
        await waitFor(cdp.evalJs, `/失败/.test(document.getElementById('llmModelHint').textContent)`, { timeoutMs: 20000 });
        const agentCand = await cdp.evalJs(`[...document.getElementById('llmModelSelect').options].filter((o) => o.value).length`);
        need(agentCand === 0,
          `agent 模式强行拉取竟拿到 ${agentCand} 个候选（后端没拦住「探查智能体内部模型」？）`);

        // 切回「底层基础大模型 API」⇒ 按钮恢复可见，再走原有的「拉取 → 下拉 → 回填」流程。
        await cdp.evalJs(`(() => {
          const t = document.getElementById('llmTarget');
          t.value = 'model'; t.dispatchEvent(new Event('change', { bubbles: true }));
          document.getElementById('llmKind').value = 'openai-compatible';
          document.getElementById('llmBaseUrl').value = ${JSON.stringify(llmMockBase)};
          document.getElementById('llmModel').value = '';
          document.getElementById('llmKey').value = 'sk-ui-mock-key-123456';
          document.getElementById('llmTimeout').value = '5000';
          document.getElementById('llmModelSelect').hidden = true;
          return true;
        })()`);
        need(await cdp.evalJs(`document.getElementById('btnLlmModels').hidden === false`),
          'model 模式下「拉取服务清单」按钮应可见（切回底层基础大模型 API 后）');

        await cdp.evalJs(`document.getElementById('btnLlmModels').click(); true`);
        await waitFor(cdp.evalJs,
          `document.getElementById('llmModelSelect').hidden === false
           && [...document.getElementById('llmModelSelect').options].filter((o) => o.value).length === ${LLM_MOCK_MODELS.length}`,
          { timeoutMs: 20000 });
        const cand = await cdp.evalJs(`[...document.getElementById('llmModelSelect').options].map((o) => o.value).filter(Boolean)`);
        need(JSON.stringify(cand) === JSON.stringify(LLM_MOCK_MODELS),
          `下拉候选是 ${JSON.stringify(cand)}，期望 ${JSON.stringify(LLM_MOCK_MODELS)}`);

        // 选中第 2 个 → 回填进模型名输入框（手填兜底仍在：输入框不是 disabled/readonly）
        const pick = LLM_MOCK_MODELS[1];
        await cdp.evalJs(`(() => { const s = document.getElementById('llmModelSelect');
          s.value = ${JSON.stringify(pick)}; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
        const mv = await cdp.evalJs(`document.getElementById('llmModel').value`);
        need(mv === pick, `选中下拉项后 #llmModel = 「${mv}」，期望「${pick}」`);
        const manual = await cdp.evalJs(`(() => { const i = document.getElementById('llmModel');
          return { disabled: i.disabled, readonly: i.readOnly, hasList: !!document.getElementById('llmModelList') }; })()`);
        need(manual.disabled === false && manual.readonly === false && manual.hasList,
          `手填兜底被破坏：${JSON.stringify(manual)}`);
        notes.push(`I3 agent 模式：按钮不可见 + 强行触发被拒（候选 0）；model 模式：拉取 → 候选 ${JSON.stringify(cand)}；选中「${pick}」→ #llmModel 回填成功`);
      });

      await runCase('I4 坏后端不白屏：patch fetch 拦 /api/llm/* 造 4 类坏响应，面板仍在 + 未捕获异常 0', async () => {
        // 重新打开页面，拿一个干净的异常基线（此后本页只由本用例驱动）
        await cdp.goto(llmBase + '/', 4000);
        await waitFor(cdp.evalJs, `!!document.getElementById('llmCard')`, { timeoutMs: 30000 });
        await cdp.evalJs(`(() => {
          // 页面内计数：未捕获 error + 未处理的 Promise rejection（CDP 之外的**第二道**观测）
          window.__uncaught = 0;
          window.addEventListener('error', () => { window.__uncaught += 1; });
          window.addEventListener('unhandledrejection', () => { window.__uncaught += 1; });
          // ★ 只拦 /api/llm/*，其余请求照走真后端
          if (!window.__origFetch) {
            window.__origFetch = window.fetch;
            window.__badMode = 'none';
            window.fetch = async (input, opts) => {
              const url = String(input && input.url ? input.url : input);
              if (!url.includes('/api/llm/')) return window.__origFetch(input, opts);
              const mode = window.__badMode;
              if (mode === 'netfail') throw new TypeError('Failed to fetch');
              if (mode === 'html500') return new Response('<html><body>500 Internal Server Error</body></html>', { status: 500, headers: { 'Content-Type': 'text/html' } });
              if (mode === 'empty') return new Response('', { status: 200 });
              if (mode === 'errshape') return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
              return window.__origFetch(input, opts);
            };
          }
          return true;
        })()`, { awaitPromise: true });

        const exBefore = cdp.exceptions().length;
        const modes = [
          ['netfail', '网络失败（fetch 抛 TypeError）'],
          ['html500', '500 + HTML 响应体'],
          ['empty', '200 + 空 body'],
          ['errshape', '200 + {ok:false}（缺 error 字段的结构异常）'],
        ];
        const rows = [];
        for (const [mode, label] of modes) {
          await cdp.evalJs(`window.__badMode = ${JSON.stringify(mode)}; true`);
          // 清掉上一次的反馈，免得「等到的是陈旧输出」造成假绿
          await cdp.evalJs(`(() => {
            document.getElementById('llmTryOut').textContent = '';
            document.getElementById('llmModelHint').textContent = '';
            document.getElementById('llmSteps').hidden = true;
            for (const n of document.querySelectorAll('.llm-step')) n.className = 'llm-step';
            return true;
          })()`);
          // ★ 逐个动作都点一遍（校验 / 试一句 / 拉取模型）—— **串行**，因为前端有 llmState.busy 互斥
          await cdp.evalJs(`document.getElementById('btnLlmValidate').click(); true`);
          await waitFor(cdp.evalJs,
            `[...document.querySelectorAll('.llm-step')].some((n) => /fail/.test(n.className))`, { timeoutMs: 20000 });
          await cdp.evalJs(`document.getElementById('btnLlmTry').click(); true`);
          await waitFor(cdp.evalJs, `!!document.querySelector('#llmTryOut .llm-out-err')`, { timeoutMs: 20000 });
          await cdp.evalJs(`document.getElementById('btnLlmModels').click(); true`);
          await waitFor(cdp.evalJs, `/失败/.test(document.getElementById('llmModelHint').textContent)`, { timeoutMs: 20000 });

          // ★ 面板仍在、有内容（不白屏）
          const alive = await cdp.evalJs(`(() => {
            const c = document.getElementById('llmCard');
            return { hasCard: !!c, h: c ? c.offsetHeight : 0,
                     textLen: document.body.innerText.trim().length,
                     hasBtn: !!document.getElementById('btnLlmValidate') };
          })()`);
          need(alive.hasCard && alive.h > 0 && alive.hasBtn,
            `坏后端(${mode}/${label})：面板消失了（${JSON.stringify(alive)}）`);
          need(alive.textLen > 100, `坏后端(${mode}/${label})：页面文本只剩 ${alive.textLen} 字（疑似白屏）`);
          rows.push(`${mode} ✓`);
        }

        const exAfter = cdp.exceptions().length;
        const inPage = await cdp.evalJs(`window.__uncaught`);
        need(exBefore === 0,
          `打开面板页面时就已有 ${exBefore} 个未捕获异常（页面本身不干净）：${JSON.stringify(cdp.exceptions().slice(0, exBefore))}`);
        need(exAfter === exBefore,
          `坏后端 4 类 × 3 动作后**新增未捕获异常** ${exAfter - exBefore} 个：${JSON.stringify(cdp.exceptions().slice(exBefore))}`);
        need(inPage === 0, `页面内 error/unhandledrejection 计数为 ${inPage}（应为 0）`);
        // 恢复 fetch（后续用例 / 收尾不受影响）
        await cdp.evalJs(`if (window.__origFetch) { window.fetch = window.__origFetch; window.__badMode = 'none'; } true`);
        notes.push(`I4 坏后端 4 类（网络失败 / 500+HTML / 空 body / {ok:false} 结构异常）× 3 动作（校验/试一句/拉取模型）⇒ 面板仍在、未捕获异常新增 ${exAfter - exBefore} 个、页面内计数 ${inPage}`);
      });

      await runCase('I5 落盘隔离 + 保存刷新后候选仍在：覆盖文件写进临时树，真实 _llm-api.json 逐字节不变', async () => {
        // ★ I4 重载过页面 ⇒ 表单与候选都回到初始态，这里**自成一体**地重做一遍「指向 mock → 拉取 → 保存」。
        // ★★ 规格 v3（W2）：agent 模式已**禁止**拉取模型清单 ⇒ 本用例走**底层基础大模型 API**（target='model'）——
        //    这是「测试跟上规格」，不是放宽断言（agent 模式禁拉取已由 I3 正向钉住）。
        await cdp.evalJs(`(() => {
          const t = document.getElementById('llmTarget');
          t.value = 'model'; t.dispatchEvent(new Event('change', { bubbles: true }));
          document.getElementById('llmKind').value = 'openai-compatible';
          document.getElementById('llmBaseUrl').value = ${JSON.stringify(llmMockBase)};
          document.getElementById('llmModel').value = '';
          document.getElementById('llmKey').value = 'sk-ui-mock-key-123456';
          document.getElementById('llmTimeout').value = '5000';
          return true;
        })()`);
        await cdp.evalJs(`document.getElementById('btnLlmModels').click(); true`);
        await waitFor(cdp.evalJs,
          `document.getElementById('llmModelSelect').hidden === false
           && [...document.getElementById('llmModelSelect').options].filter((o) => o.value).length === ${LLM_MOCK_MODELS.length}`,
          { timeoutMs: 20000 });

        // 前置：面板显示的落盘路径必须在隔离的临时树里
        const hint0 = await cdp.evalJs(`document.getElementById('llmSaveHint').textContent`);
        need(hint0.includes(llmFilmDir),
          `面板显示的落盘路径「${hint0}」不在隔离的临时树里 —— 服务没吃到 LEMO_FILM_DIR？`);

        // 保存会把 models 一并落盘
        await cdp.evalJs(`document.getElementById('btnLlmSave').click(); true`);
        await waitFor(cdp.evalJs, `/已保存/.test(document.getElementById('llmSaveHint').textContent)`, { timeoutMs: 15000 });

        // ★ 覆盖文件真的落在临时树里（且不是真实路径）
        const isoFile = path.join(llmFilmDir, '_llm-api.json');
        need(fs.existsSync(isoFile), `保存后临时树里没有 ${isoFile}（覆盖没落盘？）`);
        const saved = JSON.parse(fs.readFileSync(isoFile, 'utf8'));
        need(JSON.stringify(saved.models) === JSON.stringify(LLM_MOCK_MODELS),
          `临时覆盖文件里的 models 是 ${JSON.stringify(saved.models)}，期望 ${JSON.stringify(LLM_MOCK_MODELS)}`);

        // ★ 刷新页面 → 候选下拉仍在（models 随覆盖落盘 ⇒ 前端从 /api/llm/config 读回来）
        await cdp.goto(llmBase + '/', 4000);
        await waitFor(cdp.evalJs,
          `document.getElementById('llmModelSelect') && document.getElementById('llmModelSelect').hidden === false
           && [...document.getElementById('llmModelSelect').options].filter((o) => o.value).length === ${LLM_MOCK_MODELS.length}`,
          { timeoutMs: 20000 });
        const after = await cdp.evalJs(`[...document.getElementById('llmModelSelect').options].map((o) => o.value).filter(Boolean)`);
        need(JSON.stringify(after) === JSON.stringify(LLM_MOCK_MODELS),
          `刷新后候选下拉是 ${JSON.stringify(after)}，期望 ${JSON.stringify(LLM_MOCK_MODELS)}`);

        // ★★ 红线：真实 `D:/lemo-films/_llm-api.json` 逐字节不变（读前后快照比对）
        const realAfter = (() => { try { return fs.readFileSync(REAL_LLM_OVERRIDE); } catch { return null; } })();
        const same = (realOverrideBefore === null && realAfter === null)
          || (realOverrideBefore !== null && realAfter !== null && realOverrideBefore.equals(realAfter));
        need(same,
          `真实 ${REAL_LLM_OVERRIDE} 被改动了（跑前 ${realOverrideBefore ? realOverrideBefore.length + ' 字节' : '不存在'} → 跑后 ${realAfter ? realAfter.length + ' 字节' : '不存在'}）`);
        notes.push(`I5 保存落盘到临时树 ${isoFile}（models=${JSON.stringify(saved.models)}）；刷新后下拉仍在；真实 ${REAL_LLM_OVERRIDE} 逐字节不变`);
      });

      await runCase('I6 workbuddy-gateway：默认态下拉显示本机网关 kind + 试跑经本地网关桩取回文本', async () => {
        // ★ 前置：I5 保存过覆盖文件（kind=openai-compatible）⇒ 先删掉它，回到**真·默认态**
        //   （内置默认 profile workbuddy，其 kind 已是 workbuddy-gateway）。★ 只删隔离临时树里的那份。
        const isoFile = path.join(llmFilmDir, '_llm-api.json');
        try { fs.unlinkSync(isoFile); } catch { /* 不存在就算了 */ }
        await cdp.goto(llmBase + '/', 4000);
        await waitFor(cdp.evalJs,
          `!!document.getElementById('llmCard') && document.getElementById('llmProfileBadge').textContent.length > 0`,
          { timeoutMs: 30000 });

        // ★★ 核心钉子（本次改动的直接目的）：默认态下 #llmKind 的值必须是 workbuddy-gateway
        //   —— 改前下拉里没有这个 option ⇒ `$('llmKind').value = 'workbuddy-gateway'` 被浏览器丢弃、
        //     回落成「（用 profile 默认）」⇒ 面板显示的 kind 与实际不符（误导用户）。
        const k = await cdp.evalJs(`(() => {
          const s = document.getElementById('llmKind');
          return { value: s.value, shown: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : '' };
        })()`);
        need(k.value === 'workbuddy-gateway', `默认态 #llmKind 的值是「${k.value}」，期望「workbuddy-gateway」（下拉里漏了这个 option？）`);
        need(/本机智能体网关/.test(k.shown), `默认态 #llmKind 显示「${k.shown}」，应含「本机智能体网关」`);

        // ★ 面板要能**解释**这个 kind：hint 里含「本机智能体网关」，且**不含 markdown 星号**（判据⑧ 同口径）。
        const hint = await cdp.evalJs(`(document.getElementById('llmKindHint') || {}).textContent || ''`);
        need(/本机智能体网关/.test(hint), `#llmKindHint 文案「${hint}」应含「本机智能体网关」`);
        need(!/\*\*/.test(hint), `#llmKindHint 含 markdown 星号（用户可见文案不许有）：${hint}`);

        // ★ 试跑：端点指向**本地网关桩**（绝不指向真实网关）⇒ 面板按 kind 走两段式（run → SSE）取回文本。
        llmGwStub = await startGwStub(await freePort());
        const gwBase = `http://127.0.0.1:${llmGwStub.address().port}`;
        await cdp.evalJs(`(() => {
          const t = document.getElementById('llmTarget');
          t.value = 'agent'; t.dispatchEvent(new Event('change', { bubbles: true }));
          const kk = document.getElementById('llmKind');
          kk.value = 'workbuddy-gateway'; kk.dispatchEvent(new Event('change', { bubbles: true }));
          document.getElementById('llmBaseUrl').value = ${JSON.stringify(gwBase)};
          document.getElementById('llmKey').value = '';
          document.getElementById('llmTimeout').value = '8000';
          document.getElementById('llmTryText').value = '你好';
          document.getElementById('llmTryOut').textContent = '';
          return true;
        })()`);
        await cdp.evalJs(`document.getElementById('btnLlmTry').click(); true`);
        await waitFor(cdp.evalJs, `!!document.querySelector('#llmTryOut .llm-out-text')`, { timeoutMs: 20000 });
        const got = await cdp.evalJs(`document.querySelector('#llmTryOut .llm-out-text').textContent`);
        need(!(await cdp.evalJs(`!!document.querySelector('#llmTryOut .llm-out-err')`)),
          `试跑走了错误分支（面板没取回文本）：${got}`);
        need(got.includes(GW_STUB_TEXT), `试跑取回的文本是「${got}」，期望含「${GW_STUB_TEXT}」`);
        notes.push(`I6 默认态 #llmKind=workbuddy-gateway（显示「${k.shown}」）；试跑经本地网关桩取回「${got}」`);
      });
    }
  } finally {
    // ── 收尾 ──
    // ★ 测试工单必须在**停服务之前**删（删工单要走 HTTP DELETE）
    if (server) {
      try {
        const rep = await cleanupBriefs(server.port);
        if (rep.removed.length) log(C.dim(`  测试工单已删除：${rep.removed.join(', ')}`));
        if (rep.errors.length) log(C.bad(`  ⚠️ 测试工单删除失败：${rep.errors.join('；')}`));
      } catch (e) { log(C.bad(`  ⚠️ 测试工单清理异常：${e.message}`)); }
    }
    if (cdp && !OPT.keepBrowser) { await cdp.close(); log(C.dim('  无头 Edge 已关闭')); }
    if (server) { await stopServer(server.child); log(C.dim(`  测试服务已停止（pid ${server.child.pid}）`)); }
    // ★ I 组的 LLM 专用服务 + mock 上游：一并停掉（覆盖文件所在的临时树由 cleanupTmpDirs() 删）
    if (llmServer) { await stopServer(llmServer.child); log(C.dim(`  LLM 测试服务已停止（pid ${llmServer.child.pid}）`)); }
    if (llmMock) {
      try { llmMock.closeAllConnections && llmMock.closeAllConnections(); llmMock.close(); } catch { /* ignore */ }
      log(C.dim('  LLM mock 上游已关闭'));
    }
    if (llmGwStub) {
      try { llmGwStub.closeAllConnections && llmGwStub.closeAllConnections(); llmGwStub.close(); } catch { /* ignore */ }
      log(C.dim('  LLM 网关桩已关闭'));
    }

    // ★ 回归钉子 · 取快照：**必须在还原之前**读 —— 还原会把脏值写回基线、掩盖问题。
    //   服务已停，此刻这两个文件就是「测试跑完」的状态。
    const postServer = new Map();
    for (const f of ENTRY_FILES) { try { postServer.set(f, fs.readFileSync(f)); } catch { postServer.set(f, null); } }

    const restored = [];
    for (const [f, buf] of backup) {
      try {
        if (buf === null) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
        else fs.writeFileSync(f, buf);
        restored.push(path.basename(f));
      } catch (e) { log(C.bad(`  ⚠️ 固定入口还原失败：${path.basename(f)}（${e.message}）`)); }
    }
    if (restored.length) log(C.dim(`  固定入口已还原：${restored.join(' · ')}`));

    // ★ 回归钉子：跑完（服务已停）后两个固定入口必须与**跑前备份**逐字节一致 ——
    //   用 main() 开头读进内存的 backup Map 比对（不重新读备份）。不一致 = 测试服务写了用户入口文件。
    //   ⚠️ 快照在还原**之前**取（见上）：否则还原会把脏值抹平，钉子永远绿（无牙）。
    {
      const bad = [];
      for (const f of ENTRY_FILES) {
        const before = backup.get(f) ?? null;
        const after = postServer.get(f) ?? null;
        const same = (before === null && after === null)
          || (before !== null && after !== null && before.equals(after));
        if (!same) bad.push({ f, before, after });
      }
      const show = (b) => (b === null ? '(文件不存在)' : JSON.stringify(b.toString('utf8')));
      if (bad.length) {
        entryTouched = bad;
        log(C.bad('  ✗ 回归钉子：测试服务写了用户固定入口文件（没设 LEMO_CONSOLE_NO_ENTRY_FILES=1？）'));
        for (const { f, before, after } of bad) {
          log(C.bad(`    ${path.basename(f)}：跑前 ${show(before)} → 跑后 ${show(after)}`));
        }
      } else {
        notes.push('回归钉子：测试跑完 .console-port / 打开控制台.url 与跑前逐字节一致（测试实例未写用户入口文件）');
      }
    }

    // E7 的假上传：删文件 + 还原登记表（必须等服务停掉，免得它再写一遍）
    try {
      const hadDubUpload = dubIndexBackup !== undefined || DUB_UPLOAD_PATHS.size > 0;
      const upErr = cleanupDubUploads();
      if (upErr.length) log(C.bad(`  ⚠️ 文案出片上传清理失败：${upErr.join('；')}`));
      else if (hadDubUpload) log(C.dim(`  文案出片测试上传已清理（文件 + 登记表）`));
    } catch (e) { log(C.bad(`  ⚠️ 文案出片上传清理异常：${e.message}`)); }

    try {
      await sleep(700);                       // 等测试服务的 persistSoon 去抖走完再摘任务
      const rep = cleanupJobs();
      if (rep.removed.length) log(C.dim(`  测试任务已清理：${rep.removed.join(', ')}`));
      if (rep.errors.length) log(C.bad(`  ⚠️ 测试任务清理失败：${rep.errors.join('；')}`));
    } catch (e) { log(C.bad(`  ⚠️ 测试任务清理异常：${e.message}`)); }

    const tmpErr = cleanupTmpDirs();
    if (tmpErr.length) log(C.bad(`  ⚠️ 临时目录清理失败：${tmpErr.join('；')}`));

    // F1 的临时假成片：按确切路径递归删（必须在测试服务停了之后也行，它只是只读扫描）
    try {
      const hadFilm = CREATED_FILM_DIRS.size > 0;
      const filmErr = cleanupFilmDirs();
      if (filmErr.length) log(C.bad(`  ⚠️ 临时假成片清理失败：${filmErr.join('；')}`));
      else if (hadFilm) log(C.dim('  临时假成片已清理（确切路径递归删除）'));
    } catch (e) { log(C.bad(`  ⚠️ 临时假成片清理异常：${e.message}`)); }

    // G8 的临时「待导入」源文件：按确切路径删（落在非 C 盘的音色源目录里）
    try {
      const hadSrc = CREATED_VOICE_SRCS.size > 0;
      const srcErr = cleanupVoiceSrcs();
      if (srcErr.length) log(C.bad(`  ⚠️ 临时音色源文件清理失败：${srcErr.join('；')}`));
      else if (hadSrc) log(C.dim('  临时音色源文件已清理（确切路径删除）'));
    } catch (e) { log(C.bad(`  ⚠️ 临时音色源文件清理异常：${e.message}`)); }

    // G11 取消 dry-run 任务留下的陈旧并发锁：只删 pid 完全对得上的那一个
    try {
      const hadLock = CREATED_LOCKS.size > 0;
      const lockErr = cleanupLocks();
      if (lockErr.length) log(C.bad(`  ⚠️ 陈旧并发锁清理失败：${lockErr.join('；')}`));
      else if (hadLock) log(C.dim('  陈旧并发锁已清理（仅 pid 对得上的那一个）'));
    } catch (e) { log(C.bad(`  ⚠️ 陈旧并发锁清理异常：${e.message}`)); }
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

  // ★ 钉子红了也要非 0 —— 否则会被这里覆盖成 0（但**不**混进上面 64 条用例计数）。
  process.exitCode = (failed.length || entryTouched) ? 1 : 0;
}

main().catch((e) => {
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
