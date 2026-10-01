#!/usr/bin/env node
/**
 * test/smoke.mjs —— lemo 控制台冒烟测试（零依赖，只用 node: 内置模块）
 *
 * 用法：
 *   node test/smoke.mjs                跑全部（不含完整回归，约 15–40 秒）
 *   node test/smoke.mjs --full         额外跑一次完整 ascii-crt 回归（约 80 秒）
 *   node test/smoke.mjs --filter demos 只跑名字里含 "demos" 的用例
 *   node test/smoke.mjs --keep-server  跑完不杀测试服务（调试用）
 *
 * 设计要点：
 *   1. **自己起服务、自己停**：用随机空闲端口，绝不依赖、也绝不占用用户那个 18080 实例。
 *   2. **不用 curl**：本机 curl 走代理，打 localhost 得到的是 502（不是 000）—— 全部走 node:http 直连。
 *   3. **不用 spawnSync**：本环境对任何可执行文件都返回 EBUSY —— 全部异步 spawn。
 *   4. **不启动真实渲染**（除非显式 --full）。
 *   5. 测试服务启动时会覆写 `.console-port` / `打开控制台.url` —— 跑前备份、跑后**逐字节还原**，
 *      保证用户那个 18080 实例的「固定入口」不被改掉。
 *
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { STATIC_CASES, SERVER_CASES, FULL_CASES, ORCH_MD5, md5Of } from './cases.mjs';

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
function httpRequest(port, method, p, body, { timeoutMs = 30000, accept = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');
    const headers = { Accept: accept, Connection: 'close' };
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
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`HTTP 超时（${timeoutMs}ms）：${method} ${p}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** 读一条 SSE 流。stopOn(ev) 返回 true 就收工；超时按已收到的事件返回。 */
function httpSSE(port, p, { timeoutMs = 20000, stopOn } = {}) {
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
      { host: '127.0.0.1', port, path: p, headers: { Accept: 'text/event-stream', Connection: 'close' }, agent: false },
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
        sse: (p, opts) => httpSSE(server.port, p, opts),
      });
      await runCases(SERVER_CASES, ctx, null);
    } else {
      for (const c of SERVER_CASES) {
        if (OPT.filter && !c.name.includes(OPT.filter)) continue;
        results.push({ name: c.name, ok: false, ms: 0, err: new Error('测试服务没起来，跳过') });
        log(`  ${C.bad('FAIL')}  ${c.name} ${C.dim('(服务未起)')}`);
      }
    }

    // ── 完整回归（可选）──
    if (OPT.full) {
      log('');
      log(C.b('  完整回归（--full，约 80 秒）'));
      await runCases(FULL_CASES, makeCtx(), null);
    } else {
      log('');
      log(C.dim('  （跳过完整回归 —— 加 --full 才跑，约 80 秒）'));
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
