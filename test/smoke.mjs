#!/usr/bin/env node
/**
 * test/smoke.mjs —— lemo 控制台冒烟测试（零依赖，只用 node: 内置模块）
 *
 * 用法：
 *   node test/smoke.mjs                跑全部（不含完整回归，约 15–40 秒；WSL 冷启动时会到 1–2 分钟）
 *   node test/smoke.mjs --full         额外跑完整回归（FULL_CASES **9 条**）：
 *                                        · `⑤+` `⑤++` 跑重活 —— `⑤+` ascii-crt 全链路出片（含其配音步）、`⑤++` 现场 GPU TTS；
 *                                        · `⑤+++` `⑤++++` `⑤+++++` 三条**都不跑 TTS**（前两条走 `--keep-original`、
 *                                          第三条是 `--fit` 取值校验 + dry-run 计划透传）⇒ **不吃 GPU**，
 *                                          ★ **实测三条合计约 21–23 秒**（两次：22.7s / 21.1s）。
 *                                          ★ 2026-10-08 复核：原文写「③④⑤ 三条走 `--keep-original`」——实为**两条**
 *                                          （`⑤+++` 形态 B `--keep-original` / `⑤++++` `--keep-original-limit`）；
 *                                          第三条（`⑤+++++`）是 `--fit` 取值校验 + dry-run（不跑 TTS、不渲染）。
 *                                        · `⑤++++++` `⑤+++++++` 两条（形态 B + 现场 TTS / `--fit` 真出片差异）**也要跑现场 TTS**
 *                                          —— 实测前者约 57 秒、后者约 2–3 分钟（三次 TTS）。
 *                                        · `⑤++++++++` `⑤+++++++++` 两条是 `--fit` 的**反向分支**（素材 ≥ 旁白，三次 TTS）
 *                                          与 **atempo 链**（`--keep-original-audio`，一次 TTS）——
 *                                          也都**要跑现场 TTS**。
 *                                        · 整体约 6–18 分钟，波动几乎全来自 WSL 冷启动与 GPU 占用。
 *                                          ★ `⑤++` `⑤++++++` `⑤+++++++` `⑤++++++++` `⑤+++++++++`（现场 TTS）依赖 Index-TTS 独占锁 + 足够显存 ——
 *                                            GPU 被别的任务占着时会**立刻失败并说明是环境占用**。
 *                                        · ★ 用例名见 `test/cases.mjs` 的 `FULL_CASES`：本段直接用**用例名里的 `⑤+` 系列**
 *                                          （不再用 ①–⑨ 叙述序号 —— 两者不是同一套，读者按 ① 找不到对应用例）。
 *   node test/smoke.mjs --filter demos 只跑名字里含 "demos" 的用例
 *   node test/smoke.mjs --keep-server  跑完不杀测试服务（调试用）
 *
 * 设计要点：
 *   1. **自己起服务、自己停**：用随机空闲端口，绝不依赖、也绝不占用用户那个 18080 实例。
 *   2. **不用 curl**：本机 curl 走代理，打 localhost 得到的是 502（不是 000）—— 全部走 node:http 直连。
 *   3. **不用 spawnSync**：本环境对任何可执行文件都返回 EBUSY —— 全部异步 spawn。
 *   4. **不启动真实渲染**（除非显式 --full）；取消用例取消的是 dry-run，不是真渲染。
 *   5. 测试服务启动时会覆写 `.console-port` / `打开控制台.url` —— 跑前备份、跑后**逐字节还原**，
 *      保证用户那个 18080 实例的「固定入口」不被改掉。
 *   6. **测试产物登记 + 收尾清理**：进程用例会往 D:\lemo-films\.console 写任务记录、往 WSL 侧写临时
 *      文件、--full 的现场 TTS 用例还会建一个 `_smoke-tts-*` 输出目录；`cases.mjs` 的 ARTIFACTS
 *      登记它们，本文件在 finally 里统一摘干净（见 cleanupArtifacts）。
 *   7. **--full 会真的调 GPU TTS**（Index-TTS 全局串行锁是独占的）：
 *        · 跑之前若配音锁已被占用 → 用例**立刻失败**并说明「这是环境占用」，
 *          绝不等锁到 LOCK_TIMEOUT（2 小时）；
 *        · 所以 `--full` 要求本机装好 Index-TTS、且没有别的配音任务在跑。
 *
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import {
  STATIC_CASES, SERVER_CASES, PROCESS_CASES, FULL_CASES,
  ORCH_MD5, md5Of, cleanupArtifacts,
} from './cases.mjs';

// ★ 起服务的测试实例不该写用户的固定入口文件（.console-port / 打开控制台.url）——
//   否则每跑一次测试就把它们改成测试端口；跑崩时还原语句没执行，脏值还会残留（见 server.mjs 文件头）。
//   设了这个环境变量，本进程 spawn 出的 server.mjs 会跳过写入。下面的备份/还原是第二道防线，保留。
process.env.LEMO_CONSOLE_NO_ENTRY_FILES = '1';

// ★ 编排器的**并发锁**也必须隔离到临时树（2026-10-11 定性「首跑 6 红」时补）。
//
//   它默认落在 `D:\lemo-films\.<slug>.lock`（= 成片根，见 lemo-make.mjs 的 lockDir），
//   那是**用户真实出片根**里的共享资源。本套件会真跑几次 lemo-make（⑤ CLI dry-run、
//   ④⑥ 的 dry-run 任务），而 `--dry-run` **也会**抢这把锁 —— 编排器在 dry-run 分支
//   **之前**就抢锁，并一直持有到进程退出（实测：WSL 冷启动时持锁可达 80s，见下）。
//   此时若另有 lemo-make 在跑同一个 demo（并发的另一个测试套件 / 用户自己的一次出片），
//   两边互斥 ⇒ 本套件会红成：
//     · ⑤「CLI 退出码 1」+ ⑤ 依赖它的那条
//     · ④「任务状态 failed（期望 done），error=null」（子进程非零退出 ⇒ finishJob 不给 error）
//     · ⑦ 三条依赖 ④ 前置结果的用例级联红
//   实测（2026-10-11）：只压一把活锁 ⇒ 一次跑出 6 条红，与「首跑 6 红」的现象集合逐条对上。
//   ⇒ 指到临时树，与 test/briefs.test.mjs / test/ui.test.mjs / test/gate-blindness.test.mjs
//     三个套件同一口径（它们早就这么做了，只有本套件漏了）。
//   ★ 只对**编排器**生效（它认 LEMO_LOCK_DIR）。服务的 /api/precheck 读的是真实锁路径
//     （lib/jobs.mjs:checkLock 用 FILM_DIR 硬算，不认这个变量）⇒ ⑧ 两条锁用例自己造锁
//     自己读，不受影响。
//   ★ 临时根口径照 `scripts/run-all-tests.mjs:74`：`LEMO_TMP || 'D:/lemo-tmp'`（非 C 盘）。
const TMP_ROOT = path.resolve(process.env.LEMO_TMP || 'D:/lemo-tmp');
process.env.LEMO_LOCK_DIR = path.join(TMP_ROOT, `smoke-lock-${process.pid}-${Date.now().toString(36)}`);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ORCH_PATH = path.join(ROOT, 'lemo-make.mjs');

// 测试服务启动会覆写这两个「固定入口」文件 —— 必须备份还原（它们是用户 18080 实例的地址来源）
const ENTRY_FILES = [path.join(ROOT, '.console-port'), path.join(ROOT, '打开控制台.url')];

// ── 命令行参数 ──────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OPT = {
  full: has('--full'),
  keepServer: has('--keep-server'),
  filter: argOf('--filter') || '',
};

// ── 输出 ────────────────────────────────────────────────────
const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
  b: (s) => (TTY ? `\x1b[1m${s}\x1b[0m` : s),
};
// ★ 全程输出同时留一份在内存里（见 dumpFailureEvidence）—— 失败时把它整份写盘，
//   拿到的是**完整输出**而不是只有 summary。绿的时候这份内存缓冲只是被丢掉，不落盘。
const OUTPUT_LOG = [];
const log = (s = '') => {
  const line = `${s}\n`;
  OUTPUT_LOG.push(line);
  process.stdout.write(line);
};

// ── HTTP 工具（node:http 直连，绕开代理）────────────────────
//
// opts.headers  额外请求头（如 Range / Last-Event-ID）
// opts.maxBytes 收够这么多字节就**主动断开**（Range/成片用例用 —— 成片有 29MB，
//               整份读下来既慢又没必要；断开是客户端行为，服务端只是提前结束这个连接）
function httpRequest(port, method, p, body, {
  timeoutMs = 30000, accept = 'application/json', headers = {}, maxBytes = 0,
} = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');
    const h = { Accept: accept, Connection: 'close', ...headers };
    if (payload) {
      h['Content-Type'] = 'application/json; charset=utf-8';
      h['Content-Length'] = payload.length;
    }
    let settled = false;
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers: h, agent: false }, (res) => {
      const chunks = [];
      let n = 0;
      const finish = (truncated) => {
        if (settled) return;
        settled = true;
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* 不是 JSON 就算了 */ }
        resolve({
          status: res.statusCode, headers: res.headers, buf, text, json,
          bytes: buf.length, truncated,
        });
      };
      res.on('data', (d) => {
        chunks.push(d);
        n += d.length;
        if (maxBytes && n >= maxBytes) { res.destroy(); finish(true); }
      });
      res.on('end', () => finish(false));
      res.on('error', () => finish(true));       // 自己 destroy 之后这里会响一次，按「已收够」处理
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`HTTP 超时（${timeoutMs}ms）：${method} ${p}`)));
    req.on('error', (e) => { if (settled) return; reject(e); });
    if (payload) req.write(payload);
    req.end();
  });
}

/** 读一条 SSE 流。stopOn(ev) 返回 true 就收工；超时按已收到的事件返回。 */
function httpSSE(port, p, { timeoutMs = 20000, stopOn, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const events = [];
    let buf = '';
    let settled = false;

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { req.destroy(); } catch { /* ignore */ }
      fn(arg);
    };

    const timer = setTimeout(() => finish(resolve, { events, timedOut: true }), timeoutMs);

    const req = http.get(
      {
        host: '127.0.0.1', port, path: p, agent: false,
        headers: { Accept: 'text/event-stream', Connection: 'close', ...headers },
      },
      (res) => {
        if (res.statusCode !== 200) {
          return finish(reject, new Error(`SSE 状态码 ${res.statusCode}：${p}`));
        }
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buf += chunk;
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const data = frame.split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trimStart())
              .join('\n');
            if (!data) continue;                       // 注释帧（`: ping` / `: lemo-console stream`）
            let ev;
            try { ev = JSON.parse(data); } catch { continue; }
            events.push(ev);
            if (stopOn && stopOn(ev)) return finish(resolve, { events, timedOut: false });
          }
        });
        res.on('end', () => finish(resolve, { events, timedOut: false }));
        res.on('error', (e) => finish(reject, e));
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy());
    req.on('error', (e) => finish(reject, e));
  });
}

// ── 空闲端口 ────────────────────────────────────────────────
// 让内核分配（listen 0）→ 拿到的一定是「当前可绑」的端口，且天然避开 Windows 保留段。
// 探测 socket 从未 accept 过连接，所以不会留 TIME_WAIT。
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

// ── 测试服务生命周期 ────────────────────────────────────────
function spawnServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.mjs', '--port', String(port)], {
      cwd: ROOT,
      windowsHide: true,
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
      child.removeListener('exit', onExit);
      fn(arg);
    };

    const timer = setTimeout(() => finish(reject, new Error(`服务 30s 内没起来\n--- 服务输出 ---\n${out}`)), 30000);
    const onData = (d) => {
      out += d.toString('utf8');
      // 服务可能因 Windows 保留段自动后扫端口 —— 只认它自己打印的**实际** URL
      const m = /http:\/\/127\.0\.0\.1:(\d+)/.exec(out);
      if (m) finish(resolve, { child, port: Number(m[1]), log: () => out });
    };
    const onExit = (code) => finish(reject, new Error(`服务进程提前退出（code=${code}）\n--- 服务输出 ---\n${out}`));

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('exit', onExit);
    child.on('error', (e) => finish(reject, e));
  });
}

async function startServer(attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const port = await freePort();
    try {
      return await spawnServer(port);
    } catch (e) {
      lastErr = e;
      log(C.dim(`  （第 ${i + 1} 次起服务失败，换端口重试：${String(e.message).split('\n')[0]}）`));
    }
  }
  throw lastErr;
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    const t = setTimeout(() => {
      // 兜底：连同子孙进程一起强杀（服务自己会 taskkill 子任务，这里只是保险）
      try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* ignore */ }
      resolve();
    }, 6000);
    child.once('exit', () => { clearTimeout(t); resolve(); });
    try { child.kill(); } catch { clearTimeout(t); resolve(); }
  });
}

// ── 主流程 ──────────────────────────────────────────────────
const results = [];
const notes = [];

// ── 失败证据固化（★ 只在**出现红**时落盘，绿的时候一个字节都不写）──────────
//
// 背景：主控当日 8 次串行里最早那次红（EXIT=1）、**没抓到红的用例名** —— 红一次就丢一次证据。
// 这里把「失败瞬间」的证据固定下来：失败用例名 + 完整输出 + 环境快照，落到
//   `<LEMO_TMP>/smoke-fail-<时间戳>/`（★ 非 C 盘，口径照 scripts/run-all-tests.mjs:74）。
// ★ **不做自动重试** —— 要的是「看见」抖动，不是把它藏起来。

/** 异步跑一个外部命令并收 stdout/stderr（★ 本环境 spawnSync/execFileSync 一律 EBUSY ⇒ 只能异步 spawn）。 */
function runCapture(cmd, args, { cwd, timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let done = false;
    let child;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); resolve(r); };
    const timer = setTimeout(() => {
      try { child?.kill(); } catch { /* ignore */ }
      finish({ code: null, out, err: `${err}\n[超时 ${timeoutMs}ms]` });
    }, timeoutMs);
    try {
      child = spawn(cmd, args, { cwd, windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
    } catch (e) {
      return finish({ code: -1, out: '', err: String((e && e.message) || e) });
    }
    child.stdout?.on('data', (d) => { out += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { err += d.toString('utf8'); });
    child.on('error', (e) => finish({ code: -1, out, err: String((e && e.message) || e) }));
    child.on('close', (code) => finish({ code, out, err }));
  });
}

/** 一行式 stat：存在性 + mtime + size（不存在则报错码）。 */
function statLine(p) {
  try {
    const st = fs.statSync(p);
    return `${st.isDirectory() ? 'dir ' : 'file'}  存在  mtime=${new Date(st.mtimeMs).toISOString()}  size=${st.size}`;
  } catch (e) {
    return `不存在（${(e && e.code) || (e && e.message) || e}）`;
  }
}

const ASCII_CRT_LOCK = 'D:/lemo-films/.ascii-crt.lock';

/** 同步读「易变」快照（锁内容 / 关键 mtime / 时间）—— 在**首次失败的那一瞬间**调，保真。 */
function snapshotVolatileSync() {
  const snap = { at: new Date().toISOString(), lock: null, mtimes: {} };
  try {
    if (fs.existsSync(ASCII_CRT_LOCK)) {
      const raw = fs.readFileSync(ASCII_CRT_LOCK, 'utf8');
      snap.lock = { exists: true, content: raw, mtime: new Date(fs.statSync(ASCII_CRT_LOCK).mtimeMs).toISOString() };
    } else snap.lock = { exists: false };
  } catch (e) { snap.lock = { exists: null, error: String((e && e.message) || e) }; }
  for (const [k, p] of [
    ['consoleDir', 'D:/lemo-films/.console'],
    ['consoleIndex', 'D:/lemo-films/.console/index.json'],
    ['uploadsIndex', 'D:/lemo-films/dub/_uploads/index.json'],
  ]) snap.mtimes[k] = statLine(p);
  return snap;
}

// 首次失败瞬间抓一份快照（同步部分立即读；netstat 起一个异步进程，落盘时 await）。
let failProbe = null;
function probeAtFailure() {
  if (failProbe) return failProbe;
  failProbe = { sync: snapshotVolatileSync(), netstat: runCapture('netstat', ['-ano']) };
  return failProbe;
}

/**
 * 落盘失败证据。返回证据目录绝对路径（写入失败/落点解析到 C 盘则返回 null）。
 * @param {Array} failed 失败用例数组（含 name / ms / err）
 */
async function dumpFailureEvidence(failed) {
  const evidRoot = path.resolve(process.env.LEMO_TMP || 'D:/lemo-tmp');
  if (/^[cC]:[\\/]/.test(evidRoot)) {   // ★ 硬规则：产物/缓存非 C 盘
    log(C.bad(`  ⚠️ 失败证据落点解析到 C 盘（${evidRoot}）—— 按硬规则拒写，请设 LEMO_TMP 到非 C 盘。`));
    return null;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(evidRoot, `smoke-fail-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });

  // 1) 失败用例名 + 错误（结构化，含 stack）
  const cases = failed.map((f) => ({
    name: f.name,
    ms: f.ms,
    error: f.err ? String((f.err && f.err.message) || f.err) : null,
    stack: f.err && f.err.stack ? String(f.err.stack) : null,
  }));
  fs.writeFileSync(path.join(dir, 'cases.json'), JSON.stringify({
    when: new Date().toISOString(),
    pid: process.pid,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failedNames: failed.map((f) => f.name),
    cases,
  }, null, 2), 'utf8');

  // 2) 完整输出（不是只有 summary）
  fs.writeFileSync(path.join(dir, 'output.txt'), OUTPUT_LOG.join(''), 'utf8');

  // 3) 环境快照
  const probe = failProbe || probeAtFailure();
  const [gs, gl] = await Promise.all([
    runCapture('git', ['status', '--porcelain'], { cwd: ROOT }),
    runCapture('git', ['log', '-1'], { cwd: ROOT }),
  ]);
  const ns = await probe.netstat;
  const listen = (ns.out || '').split(/\r?\n/).filter((l) => /LISTEN/i.test(l));

  let lockDirList = '(LEMO_LOCK_DIR 未设置)';
  try {
    if (process.env.LEMO_LOCK_DIR) {
      lockDirList = fs.existsSync(process.env.LEMO_LOCK_DIR)
        ? (fs.readdirSync(process.env.LEMO_LOCK_DIR).join('\n') || '(空)')
        : '(不存在)';
    }
  } catch (e) { lockDirList = `列目录失败：${(e && e.message) || e}`; }

  const envTxt = [
    '=== 时间 ===',
    `首次失败瞬间: ${probe.sync.at}`,
    `落盘时刻:     ${new Date().toISOString()}`,
    `pid:          ${process.pid}`,
    `cwd:          ${process.cwd()}`,
    `LEMO_TMP:     ${process.env.LEMO_TMP || '(未设 → 默认 D:/lemo-tmp)'}`,
    `LEMO_LOCK_DIR:${process.env.LEMO_LOCK_DIR || '(未设)'}`,
    '',
    '=== 锁文件（首次失败瞬间）===',
    `路径: ${ASCII_CRT_LOCK}`,
    probe.sync.lock.exists === true
      ? `存在  mtime=${probe.sync.lock.mtime}\n内容: ${JSON.stringify(probe.sync.lock.content)}`
      : (probe.sync.lock.exists === false ? '不存在' : `读不到：${probe.sync.lock.error}`),
    '',
    '=== 隔离锁目录 LEMO_LOCK_DIR 内容（落盘时刻）===',
    lockDirList,
    '',
    '=== mtime 快照（首次失败瞬间）===',
    `D:/lemo-films/.console/               : ${probe.sync.mtimes.consoleDir}`,
    `D:/lemo-films/.console/index.json     : ${probe.sync.mtimes.consoleIndex}`,
    `D:/lemo-films/dub/_uploads/index.json : ${probe.sync.mtimes.uploadsIndex}`,
    '',
    '=== git status --porcelain ===',
    `exit=${gs.code}`,
    gs.out.trim() || '(干净)',
    gs.err.trim(),
    '',
    '=== git log -1 ===',
    `exit=${gl.code}`,
    gl.out.trim(),
    gl.err.trim(),
    '',
    '=== netstat -ano（LISTEN 行）===',
    `exit=${ns.code}  总行数=${(ns.out || '').split(/\r?\n/).length}  LISTEN 行数=${listen.length}`,
    listen.join('\n') || '(无 LISTEN 行)',
    ns.err.trim(),
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'env.txt'), envTxt, 'utf8');

  return dir;
}

function makeCtx(extra = {}) {
  return {
    root: ROOT,
    orchPath: ORCH_PATH,
    state: {},
    note: (m) => notes.push(m),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    ...extra,
  };
}

async function runCases(cases, ctx, groupLabel) {
  for (const c of cases) {
    if (OPT.filter && !c.name.includes(OPT.filter)) continue;
    const t0 = Date.now();
    try {
      await c.run(ctx);
      results.push({ name: c.name, ok: true, ms: Date.now() - t0 });
      log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - t0}ms)`)}`);
    } catch (e) {
      const ms = Date.now() - t0;
      probeAtFailure();               // ★ 首次失败的那一瞬间先抓一份易变快照（锁/端口/mtime）
      results.push({ name: c.name, ok: false, ms, err: e });
      log(`  ${C.bad('FAIL')}  ${c.name} ${C.dim(`(${ms}ms)`)}`);
      const msg = String((e && e.message) || e);
      for (const line of msg.split('\n')) log(`        ${line}`);
    }
  }
  if (groupLabel) log(C.dim(`  ── ${groupLabel} 结束 ──`));
}

async function main() {
  const t0 = Date.now();
  const orchBuf = fs.readFileSync(ORCH_PATH);

  log('');
  log(C.b('lemo 控制台 · 冒烟测试'));
  log(C.dim(`  项目     ${ROOT}`));
  log(C.dim(`  编排器   ${ORCH_PATH}`));
  log(C.dim(`  md5      ${md5Of(orchBuf)}  (期望 ${ORCH_MD5})`));
  log(C.dim(`  模式     ${OPT.full ? '全量（含完整回归）' : '快速'}${OPT.filter ? ` · filter="${OPT.filter}"` : ''}`));
  log('');

  // ── 备份「固定入口」文件（测试服务会覆写它们）──
  const backup = new Map();
  for (const f of ENTRY_FILES) {
    try { backup.set(f, fs.readFileSync(f)); } catch { backup.set(f, null); }
  }

  let server = null;
  let serverFailed = false;

  try {
    // ── 静态用例 ──
    log(C.b('  静态检查（文件 / 纯函数 / CLI）'));
    await runCases(STATIC_CASES, makeCtx(), null);

    // ── 起测试服务 ──
    log('');
    log(C.b('  HTTP 接口（测试自起服务，随机端口）'));
    try {
      server = await startServer();
      log(C.dim(`  测试服务已起 → http://127.0.0.1:${server.port}  (pid ${server.child.pid})`));
    } catch (e) {
      serverFailed = true;
      log(`  ${C.bad('FAIL')}  起测试服务`);
      for (const line of String(e.message).split('\n')) log(`        ${line}`);
    }

    if (server) {
      const ctx = makeCtx({
        port: server.port,
        get: (p, opts) => httpRequest(server.port, 'GET', p, undefined, opts),
        post: (p, body, opts) => httpRequest(server.port, 'POST', p, body, opts),
        del: (p, opts) => httpRequest(server.port, 'DELETE', p, undefined, opts),
        sse: (p, opts) => httpSSE(server.port, p, opts),
      });
      // ★ 跨重启用例要真的重启一次服务（`logSeq` 跨重启稳定这条没法用同一个进程验）。
      //   重启后把 ctx 里的四个 HTTP 工具换成指向新端口的闭包 —— 用例拿到的还是同一个 ctx。
      ctx.restartServer = async () => {
        await stopServer(server.child);
        server = await startServer();
        ctx.port = server.port;
        ctx.get = (p, opts) => httpRequest(server.port, 'GET', p, undefined, opts);
        ctx.post = (p, body, opts) => httpRequest(server.port, 'POST', p, body, opts);
        ctx.del = (p, opts) => httpRequest(server.port, 'DELETE', p, undefined, opts);
        ctx.sse = (p, opts) => httpSSE(server.port, p, opts);
        return server.port;
      };
      await runCases(SERVER_CASES, ctx, null);
    } else {
      for (const c of SERVER_CASES) {
        if (OPT.filter && !c.name.includes(OPT.filter)) continue;
        results.push({ name: c.name, ok: false, ms: 0, err: new Error('测试服务没起来，跳过') });
        log(`  ${C.bad('FAIL')}  ${c.name} ${C.dim('(服务未起)')}`);
      }
    }

    // ── 进程 / 取消（WSL 侧、进程树）──
    // ★ 放在服务用例**之后**：这两条会在本进程里 import lib/jobs.mjs 起一个独立队列，
    //   它会往 D:\lemo-films\.console 写一条任务记录。等服务已经起好、历史也读完了再跑，
    //   测试服务的内存里就不会带着这两条测试任务 —— 收尾清理时不会被它再写回去。
    log('');
    log(C.b('  进程与取消（WSL 侧进程组 / 进程树）'));
    await runCases(PROCESS_CASES, makeCtx(), null);

    // ── 完整回归（可选）──
    if (OPT.full) {
      log('');
      log(C.b('  完整回归（--full：FULL_CASES 9 条 —— ①② 跑重活（① ascii-crt 全链路出片、② 现场 GPU TTS），'
        + '③④⑤ 三条 `--keep-original` 明令**不跑 TTS / 不吃 GPU**、实测合计约 21–23 秒；'
        + '⑥⑦ 形态 B + 现场 TTS / `--fit` 真出片差异，**也要跑现场 TTS**、实测 ⑥ 约 57 秒 + ⑦ 约 2–3 分钟；'
        + '⑧⑨ `--fit` 反向分支（三次 TTS）与 atempo 链（一次 TTS），**同样要跑现场 TTS**）'));
      await runCases(FULL_CASES, makeCtx(), null);
    } else {
      log('');
      log(C.dim('  （跳过完整回归 —— 加 --full 才跑，约 3–9 分钟；含现场 GPU TTS）'));
    }
  } finally {
    // ── 收尾：杀测试服务 + 还原固定入口 ──
    if (server && !OPT.keepServer) {
      await stopServer(server.child);
      log(C.dim(`  测试服务已停止（pid ${server.child.pid}）`));
    } else if (server) {
      log(C.dim(`  --keep-server：测试服务仍在跑（pid ${server.child.pid}，端口 ${server.port}），记得手动停`));
    }

    const restored = [];
    for (const [f, buf] of backup) {
      try {
        if (buf === null) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
        else fs.writeFileSync(f, buf);      // 写回原始字节 → CRLF 原样保留
        restored.push(path.basename(f));
      } catch (e) {
        log(C.bad(`  ⚠️ 固定入口还原失败：${path.basename(f)}（${e.message}）`));
      }
    }
    if (restored.length) log(C.dim(`  固定入口已还原：${restored.join(' · ')}`));

    // ── 测试产物清理（测试锁 / 测试任务落盘 / WSL 侧临时文件）──
    // ★ 放在杀完服务之后：先让测试服务的最后一次 persist 落完，再摘掉测试任务，
    //   否则服务可能把刚摘掉的那条又写回 index.json。
    try {
      await new Promise((r) => setTimeout(r, 800));   // 等 persistSoon 的 500ms 去抖走完
      const rep = await cleanupArtifacts();
      const parts = [];
      if (rep.jobs.length) parts.push(`任务 ${rep.jobs.join(', ')}`);
      if (rep.locks.length) parts.push(`锁 ${rep.locks.join(', ')}`);
      if (rep.wsl.length) parts.push(`WSL 文件 ${rep.wsl.length} 个`);
      if (rep.dirs.length) parts.push(`目录 ${rep.dirs.length} 个（${rep.dirs.map((d) => path.basename(d)).join(', ')}）`);
      if (parts.length) log(C.dim(`  测试产物已清理：${parts.join(' · ')}`));
      if (rep.errors.length) log(C.bad(`  ⚠️ 测试产物清理有失败项：${rep.errors.join('；')}`));
    } catch (e) {
      log(C.bad(`  ⚠️ 测试产物清理异常：${e.message}`));
    }

    // ── 收掉隔离出来的并发锁目录（编排器的 `.<slug>.lock` 落在里面）──
    try {
      fs.rmSync(process.env.LEMO_LOCK_DIR, { recursive: true, force: true });
    } catch { /* 清不掉也不影响结论 */ }
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

  // ── ★ 有红 ⇒ 把完整证据落盘（绿的时候这里一行都不执行，绝不产生文件）──
  if (failed.length || serverFailed) {
    try {
      const dir = await dumpFailureEvidence(failed);
      if (dir) log(C.bad(`  📁 失败证据已留存 → ${dir}`));
    } catch (e) {
      log(C.bad(`  ⚠️ 失败证据留存失败：${(e && e.message) || e}`));
    }
    log('');
  }

  process.exitCode = failed.length ? 1 : 0;
  if (serverFailed) process.exitCode = 2;
}

main().catch(async (e) => {
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  // ★ 自身异常（exit 2）也要留证据
  try {
    const dir = await dumpFailureEvidence([{ name: '(测试自身异常)', ms: 0, err: e }]);
    if (dir) log(C.bad(`  📁 失败证据已留存 → ${dir}`));
  } catch { /* 证据留存失败不影响退出码 */ }
  process.exitCode = 2;
});
