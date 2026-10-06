#!/usr/bin/env node
/**
 * test/smoke.mjs —— lemo 控制台冒烟测试（零依赖，只用 node: 内置模块）
 *
 * 用法：
 *   node test/smoke.mjs                跑全部（不含完整回归，约 15–40 秒；WSL 冷启动时会到 1–2 分钟）
 *   node test/smoke.mjs --full         额外跑完整回归（FULL_CASES **5 条**）：
 *                                        · ①② 跑重活 —— ① ascii-crt 全链路出片（含其配音步）、② 现场 GPU TTS；
 *                                        · ③④⑤ 三条走 `--keep-original`（明令**不跑 TTS、不吃 GPU**），
 *                                          ★ **实测合计约 21–23 秒**（两次：22.7s / 21.1s）。
 *                                        · 整体约 3–9 分钟，波动几乎全来自 WSL 冷启动与 GPU 占用。
 *                                          ★ ②（现场 TTS）依赖 Index-TTS 独占锁 + 足够显存 ——
 *                                            GPU 被别的任务占着时会**立刻失败并说明是环境占用**。
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
const log = (s = '') => process.stdout.write(`${s}\n`);

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
      log(C.b('  完整回归（--full：FULL_CASES 5 条 —— ①② 跑重活（① ascii-crt 全链路出片、② 现场 GPU TTS），'
        + '③④⑤ 三条 `--keep-original` 明令**不跑 TTS / 不吃 GPU**、实测合计约 21–23 秒）'));
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
  if (serverFailed) process.exitCode = 2;
}

main().catch((e) => {
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
