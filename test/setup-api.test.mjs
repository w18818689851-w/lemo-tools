#!/usr/bin/env node
/**
 * test/setup-api.test.mjs —— 「首次运行向导」HTTP 面（`/api/setup/*`）的契约与校验（**独立入口**）
 *
 * 为什么单独一个入口：沿用本项目已有的分工 —— smoke.mjs / setup.test.mjs / ui.test.mjs /
 * dub-api.test.mjs 各自一个数字、互不干扰。这一套只管**两个接口**：
 *   GET  /api/setup/actions    —— 向导的数据源（当前环境该装什么、哪些能自动装）
 *   POST /api/setup/run        —— 向导的执行入口（真的去装东西）
 *
 * ★ 全控制台覆盖审计发现：
 *   - `GET /api/setup/actions` **全仓没有任何测试**（grep 只在 README 里提到过）。
 *   - `POST /api/setup/run` 只有纯逻辑测试（test/setup.test.mjs 只测 lib/setup.mjs 的纯函数，
 *     **不起服务、不碰 HTTP**）。
 *   而这两个接口是「新机器上点『一键安装』」的唯一入口 —— 所以这里补的是 **HTTP 层契约**。
 *
 * 纪律（照抄 dub-api.test.mjs 踩出来的那套）：
 *   - 测试自己用内核分配的空闲端口起服务，**绝不碰用户那个实例**。
 *   - 测试服务会覆写 `.console-port` / `打开控制台.url` —— 跑前按字节备份、跑后逐字节还原。
 *   - 不用 curl（本机走代理，打 localhost 得到 502）；不用 spawnSync（本环境一律 EBUSY）。
 *   - 断言**增量**（不断言绝对数量）：任务历史是落盘持久化的。
 *   - ★★ **绝不真安装**：只测「失败 / 跳过」路径。**绝不对一个「真的 auto 且未就绪」的动作发请求**
 *     （那会真的去 apt / pip / git clone）。为了安全：
 *       · manual 动作的 id 从**真实计划**里挑（kind==='manual'）→ 只会 400，不执行；
 *       · 「已就绪 → skipped」只挑 **knownActionIds() 里、但不在真实计划里**的**手动**动作 id
 *         （即便环境在两次请求之间变化，它最多变成 400（manual），绝不会变成安装）；
 *       · auto 类动作**一律不发**。
 *   - ★ 每条**失败**用例都断言「没有起任务」（GET /api/jobs 前后条数不变）—— 本项目既有纪律。
 *   - 若任何用例意外起了任务，`finally` 里按**确切路径**删日志文件并从 `.console/index.json` 摘除。
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

import { CFG, run, makeTtlCache } from '../lib/env.mjs';   // 只借常量与 run()/缓存；env.mjs 顶层无副作用
import { knownActionIds } from '../lib/setup.mjs';  // 只借「静态登记的动作 id」；顶层无副作用

// ★ 起服务的测试实例不该写用户的固定入口文件（.console-port / 打开控制台.url）——
//   否则每跑一次测试就把它们改成测试端口；跑崩时还原语句没执行，脏值还会残留（见 server.mjs 文件头）。
//   设了这个环境变量，本进程 spawn 出的 server.mjs 会跳过写入。下面的备份/还原是第二道防线，保留。
process.env.LEMO_CONSOLE_NO_ENTRY_FILES = '1';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ENTRY_FILES = [path.join(ROOT, '.console-port'), path.join(ROOT, '打开控制台.url')];
const CONSOLE_ROOT = path.join(CFG.exportDir, '.console');
const CONSOLE_LOGS = path.join(CONSOLE_ROOT, 'logs');
const CONSOLE_INDEX = path.join(CONSOLE_ROOT, 'index.json');

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
// ★★ 客户端预算（2026-10-10 定性 D8②；★ 修复后订正）：`/api/env` 会触发 `checkEnv()`
//    （lib/env.mjs —— **3 次串行 wsl.exe 探针**）。改前 `POST /api/setup/run` **与** `GET /api/setup/actions`
//    都**每请求全量重探**（不用缓存）—— WSL **冷启动 / 忙**时这一次全量探针可远超 60s（实测套件里
//    `POST /api/setup/run` 偶发 60010ms 客户端超时，1/12）⇒ 用例偶发红（登记 D8②）。
//    ★ 现已修复：**两个端点都**改走与 `/api/env` **同一份** envCache（见 ⑪ 的正面断言）。
//      但**首次 / 过期后**的那一次全量探针仍可能慢（服务端单条 wsl 命令上限 RUN_TIMEOUT_MS=120s）。
//    ⇒ 客户端预算仍从 60s 提到 **180s**：覆盖冷启动首次探针并留余量。**这不是放宽断言**：所有断言
//      （状态码 / 形状 / 计数 / 任务数增量）一字未改，只是把「等一个**被服务端封顶**的高成本探针」的
//      客户端等待预算对齐到它的真实上界。
const CLIENT_TIMEOUT_MS = 180000;
function httpSend(port, { method, path: p, headers = {}, body = null, timeoutMs = CLIENT_TIMEOUT_MS } = {}) {
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

function postJson(port, p, obj) {
  const b = Buffer.from(JSON.stringify(obj), 'utf8');
  return httpSend(port, { method: 'POST', path: p, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length }, body: b });
}

/** 发一段**原文**当 body（用来造「非法 JSON」）。 */
function postRaw(port, p, text) {
  const b = Buffer.from(text, 'utf8');
  return httpSend(port, { method: 'POST', path: p, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length }, body: b });
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
const JOB_IDS = new Set();   // 万一真起了任务，登记它的 id，finally 里删干净

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
        const tmp = `${CONSOLE_INDEX}.setup-api-tmp`;
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

async function jobsList(port) {
  const r = await getJson(port, '/api/jobs');
  need(r.status === 200 && r.json && Array.isArray(r.json.jobs), `GET /api/jobs 异常：${r.status} ${r.text.slice(0, 120)}`);
  return r.json.jobs;
}
const jobsCount = async (port) => (await jobsList(port)).length;

/** POST /api/setup/run 期望某状态码，且**不起任务**（任务数前后不变）。 */
async function postRunExpect(port, body, expectStatus, label) {
  const before = await jobsCount(port);
  const r = await postJson(port, '/api/setup/run', body);
  need(r.status === expectStatus, `${label}：应 ${expectStatus}，实际 ${r.status}：${r.text.slice(0, 200)}`);
  const after = await jobsCount(port);
  need(after === before, `${label}：不该起任务（${before} → ${after}）`);
  return r;
}

/** 同上，但 body 是一段**原文**（造非法 JSON）。 */
async function postRunRawExpect(port, text, expectStatus, label) {
  const before = await jobsCount(port);
  const r = await postRaw(port, '/api/setup/run', text);
  need(r.status === expectStatus, `${label}：应 ${expectStatus}，实际 ${r.status}：${r.text.slice(0, 200)}`);
  const after = await jobsCount(port);
  need(after === before, `${label}：不该起任务（${before} → ${after}）`);
  return r;
}

/**
 * `GET /api/setup/actions` 的响应契约（**从响应自算，不硬编码任何数字**）。
 * @param {object} b   响应 JSON
 * @param {string} label 出错时的上下文
 */
function assertActionsShape(b, label) {
  need(b && typeof b === 'object', `${label}：响应不是对象`);
  need(Array.isArray(b.actions), `${label}：actions 不是数组`);
  need(b.count === b.actions.length, `${label}：count(${b.count}) ≠ actions.length(${b.actions.length})`);
  const autos = b.actions.filter((a) => a.kind === 'auto');
  const mans = b.actions.filter((a) => a.kind === 'manual');
  need(b.autoCount === autos.length, `${label}：autoCount(${b.autoCount}) ≠ 实际 auto 数(${autos.length})`);
  need(b.manualCount === mans.length, `${label}：manualCount(${b.manualCount}) ≠ 实际 manual 数(${mans.length})`);
  need(b.autoCount + b.manualCount === b.count, `${label}：auto+manual ≠ count`);
  need(b.actions.every((a) => a.kind === 'auto' || a.kind === 'manual'), `${label}：有动作的 kind 既不是 auto 也不是 manual`);
  // summary / runnable 形状
  need(b.summary && typeof b.summary === 'object', `${label}：缺 summary`);
  for (const k of ['total', 'ok', 'warn', 'fail']) need(typeof b.summary[k] === 'number', `${label}：summary.${k} 不是数字`);
  need(b.summary.total === b.summary.ok + b.summary.warn + b.summary.fail, `${label}：summary 三项之和 ≠ total`);
  need(typeof b.runnable === 'boolean', `${label}：runnable 不是布尔`);
  // 每个动作的形状（= serializeAction 的契约）
  for (const a of b.actions) {
    need(typeof a.id === 'string' && a.id, `${label}：动作缺 id`);
    need(/^[A-Za-z0-9._-]+$/.test(a.id), `${label}：动作 id 含非法字符：${JSON.stringify(a.id)}`);
    need(typeof a.title === 'string' && a.title, `${label}：动作 ${a.id} 缺 title`);
    need(a.status === 'fail' || a.status === 'warn', `${label}：动作 ${a.id} 的 status 既不是 fail 也不是 warn（${a.status}）`);
    need(typeof a.group === 'string', `${label}：动作 ${a.id} 缺 group`);
    need(typeof a.label === 'string', `${label}：动作 ${a.id} 缺 label`);
    need(Array.isArray(a.envIds), `${label}：动作 ${a.id} 的 envIds 不是数组`);
    need(typeof a.why === 'string' && typeof a.fixHint === 'string' && typeof a.impact === 'string', `${label}：动作 ${a.id} 的 why/fixHint/impact 不是字符串`);
    if (a.kind === 'auto') {
      need(Array.isArray(a.steps) && a.steps.length >= 1, `${label}：auto 动作 ${a.id} 没有步骤`);
      for (const s of a.steps) {
        need(typeof s.label === 'string' && s.label, `${label}：动作 ${a.id} 有步骤缺 label`);
        need(typeof s.cmd === 'string', `${label}：动作 ${a.id} 有步骤缺 cmd`);
        need(Number.isFinite(s.timeoutMs), `${label}：动作 ${a.id} 有步骤的 timeoutMs 不是数字`);
      }
      need(a.manual === null, `${label}：auto 动作 ${a.id} 不该带 manual 字段（实得 ${JSON.stringify(a.manual)}）`);
    } else {
      need(Array.isArray(a.steps) && a.steps.length === 0, `${label}：manual 动作 ${a.id} 不该有 steps（实得 ${JSON.stringify(a.steps)}）`);
      need(a.manual && typeof a.manual === 'object', `${label}：manual 动作 ${a.id} 缺 manual 字段`);
      need(typeof a.manual.note === 'string' && a.manual.note, `${label}：manual 动作 ${a.id} 的 manual.note 不是非空字符串`);
      need(Array.isArray(a.manual.steps) && a.manual.steps.length >= 1, `${label}：manual 动作 ${a.id} 的 manual.steps 不是非空数组`);
      need(Array.isArray(a.manual.links), `${label}：manual 动作 ${a.id} 的 manual.links 不是数组`);
    }
  }
}

async function main() {
  const t0 = Date.now();

  log('');
  log(C.b('lemo 控制台 · 首次运行向导接口（/api/setup/*）测试'));
  log(C.dim(`  项目      ${ROOT}`));
  log(C.dim(`  任务历史  ${CONSOLE_INDEX}`));
  log(C.dim(`  模式      ${OPT.filter ? `filter="${OPT.filter}"` : '全部'}`));
  log(C.dim('  ★ 只测失败/跳过路径，绝不真安装（不会对「未就绪的 auto 动作」发请求）'));
  log('');

  // ── 跑前备份固定入口（测试服务会覆写它们）──
  const backup = new Map();
  for (const f of ENTRY_FILES) {
    try { backup.set(f, fs.readFileSync(f)); } catch { backup.set(f, null); }
  }

  let server = null;
  try {
    // ── ★★ D3（2026-10-10）：run() 超时 + inflight 复位（**桩命令**模拟挂起，绝不真跑 WSL）──
    //   改前：lib/env.mjs 的 run() **没有任何超时** ⇒ 探针挂起则永不 resolve；而 server.mjs 的
    //   apiEnv 只在 .then/.catch 复位 inflight ⇒ 一次挂起就把 /api/env 永久卡在 inflight 且不自愈。
    await runCase('⑩ run() 超时：桩命令挂起 ⇒ 按 opts.timeout 封顶返回（timedOut=true，code=-2）', async () => {
      const t0 = Date.now();
      const r = await run(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], { timeout: 400 });
      const ms = Date.now() - t0;
      need(r.timedOut === true, `未标记超时：${JSON.stringify({ code: r.code, timedOut: r.timedOut })}`);
      need(r.code === -2, `超时退出码应为 -2，实际 ${r.code}`);
      need(ms < 5000, `超时没有生效（耗时 ${ms}ms，而桩命令会挂 60s）`);
      notes.push(`⑩ 桩命令（node 挂 60s）在 ${ms}ms 内被 run() 按 timeout=400ms 掐断，code=-2`);
    });

    await runCase('⑩b inflight 复位：探针超时 / 抛错后缓存都能**再次发起**（不是永久卡死）', async () => {
      const cache = makeTtlCache(30000);
      let calls = 0;
      const probe = () => { calls++; return run(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], { timeout: 300 }); };
      const a = await cache.get(probe);
      need(a.timedOut === true, `第一次 probe 未超时：${JSON.stringify(a)}`);
      // ★ 关键：inflight 若没复位，第二次 get() 会复用**同一个已 settle 的 promise** ⇒ calls 不会变 2。
      const b = await cache.get(probe);
      need(b.timedOut === true, `第二次 probe 未超时：${JSON.stringify(b)}`);
      need(calls === 2, `超时后 inflight 未复位：probe 只被调了 ${calls} 次（应 2 次）`);

      // 反面：probe **抛错**（不是超时）时也要复位 —— finally 的「任何结局」。
      const cache2 = makeTtlCache(30000);
      let calls2 = 0;
      const boom = () => { calls2++; return Promise.reject(new Error('probe 失败')); };
      let threw = false;
      try { await cache2.get(boom); } catch { threw = true; }
      need(threw, 'probe 抛错应向上传播（不能被吞）');
      let threw2 = false;
      try { await cache2.get(boom); } catch { threw2 = true; }
      need(threw2 && calls2 === 2, `抛错后 inflight 未复位：calls=${calls2}（应 2）`);
      notes.push('⑩b 探针超时后第二次 get 重新发起（calls=2）；探针抛错后同样复位（calls=2）');
    });

    server = await startServer();
    const P = server.port;
    const get = (p) => getJson(P, p);

    // ── ⑪ 一次冷启动钉住三件事：① 未知 id 的 404 **不付探测**；② `GET /api/setup/actions` 与
    //      ③ `POST /api/setup/run` 都复用 `/api/env` 的**同一份** envCache ──
    //   缺陷（D8②，2026-10-10 修）：改前 `apiSetupRun` **与** `apiSetupActions` 每个请求都
    //   `await checkEnv()`（**都不用缓存**），而且 `apiSetupRun` 还**先全量探测再判未知 id**；
    //   而 checkEnv 串行跑 3 次 wsl.exe（+1 次 powershell）⇒ WSL 冷启动/忙时单次请求可 > 60s
    //   （热态 ≈2.2s）⇒ 偶发超时。★ `apiSetupActions` 还是被 `web/app.js` **每 60 s 轮询**一次的
    //   ⇒ 与 `/api/env` 的轮询叠加，改前**每分钟白起两轮全量探针**。
    //   本用例从**冷启动**一次把三件事都钉住：
    //     · ① 未知 id（**不是** `fallback.*`）POST → 404，且**必须远快于**冷态探测（③ 的 ms1）
    //       ⇒ 证明它走的是「未知 id 廉价早退」那条路、**没有**白起一轮 WSL（改前必红）；
    //     · ② 冷态下**第一个探测请求就是 `GET /api/setup/actions`**（必付一次全量探测）—— 若它仍
    //       直连 `checkEnv`，下面 ③ 的 `/api/env` 会是 `cached:false`（缓存仍冷）⇒ **本用例必红**；
    //     · ③ `GET /api/env` 必须 `cached:true` ⇒ **actions 写进了共享 envCache**；
    //     · ④ `POST /api/setup/run`（`fallback.<不存在>`）必须**显著更快**（缓存命中、毫秒级）
    //       ⇒ **POST 读的是同一份缓存**、**没有**再付一次全量探测（改前必红）。
    //   ★ 用 `fallback.<不存在>` 当动作 id：它**会**走到探测（**不是**上面那条廉价早退），
    //     且必然被拒（404），绝不真安装（沿用本套件「只测失败/跳过路径」的铁律）。
    //   ★ 前置条件：此刻服务刚起、envCache 尚冷（server.mjs 启动不做任何 checkEnv 探测）。
    //     本用例**故意排在下面的「就绪屏障」之前** —— 屏障会预热缓存，排其后就测不出「首次付代价」。
    await runCase('⑪ 未知 id 的 404 不付探测；/api/setup/actions 与 /api/setup/run 共用 /api/env 的缓存', async () => {
      // ① 冷态：未知 id（**非** `fallback.*`）→ 404，且**不该**付全量探测
      const unknownId = 'zz-unknown-action-' + Date.now().toString(36);
      need(!knownActionIds().includes(unknownId), `bogus id「${unknownId}」竟然在 knownActionIds() 里`);
      const t0 = Date.now();
      const r0 = await postJson(P, '/api/setup/run', { actionId: unknownId });
      const ms0 = Date.now() - t0;
      need(r0.status === 404, `未知 id 应 404，实际 ${r0.status}：${r0.text.slice(0, 200)}`);
      need(r0.json && /未知动作/.test(r0.json.error || ''), `404 文案不对：${r0.text.slice(0, 160)}`);

      // ② 冷态第一个**探测**请求 = GET /api/setup/actions（必付一次全量探测）
      const t1 = Date.now();
      const a1 = await getJson(P, '/api/setup/actions');
      const ms1 = Date.now() - t1;
      need(a1.status === 200, `GET /api/setup/actions 应 200，实际 ${a1.status}：${a1.text.slice(0, 200)}`);
      const aj = a1.json || {};
      need(aj.simulated === null, `无 simulate 时 simulated 应为 null，实际 ${JSON.stringify(aj.simulated)}`);
      need(aj.count === (aj.actions || []).length, `count 与 actions.length 不一致：${aj.count} vs ${(aj.actions || []).length}`);
      need(aj.autoCount + aj.manualCount === aj.count,
        `autoCount+manualCount 应等于 count：${aj.autoCount}+${aj.manualCount} vs ${aj.count}`);

      // ★ 正面证据①：未知 id 的 404（ms0）必须**远快于**冷态全量探测（ms1）
      //   ⇒ 它没有白起一轮 WSL（若改前「先探测再判未知 id」，ms0 会与 ms1 同量级）。
      need(ms0 * 3 < ms1, `未知 id 的 404 未走廉价早退：ms0=${ms0}ms 未显著小于冷态探测 ms1=${ms1}ms（疑似先全量探测再 404）`);

      // ★ 正面证据②：actions 之后 /api/env 立刻命中缓存 ⇒ actions 与 /api/env 共用同一份 envCache。
      const env = await getJson(P, '/api/env');
      need(env.status === 200, `/api/env 异常：${env.status}`);
      need(env.json && env.json.cached === true,
        `GET /api/setup/actions 之后 /api/env 未命中缓存（cached=${env.json && env.json.cached}）—— actions 没有写进共享 envCache`);

      // ★ 正面证据③：POST 走缓存命中、**不再付全量探测** ⇒ 应显著快于冷态的 ②。
      const fbId = 'fallback.zz-probe-count-' + Date.now().toString(36);
      need(!knownActionIds().includes(fbId), `bogus id「${fbId}」竟然在 knownActionIds() 里`);
      const body = { actionId: fbId };
      const t2 = Date.now();
      const r2 = await postJson(P, '/api/setup/run', body);
      const ms2 = Date.now() - t2;
      need(r2.status === 404, `POST 应 404（未知动作），实际 ${r2.status}：${r2.text.slice(0, 200)}`);
      need(r2.json && /未知动作/.test(r2.json.error || ''), `POST 的 404 文案不对：${r2.text.slice(0, 160)}`);
      need(ms2 * 3 < ms1, `POST 未走共享缓存：ms2=${ms2}ms 未显著小于冷态 ms1=${ms1}ms（疑似重探）`);
      need(ms2 < 2000, `POST 仍花 ${ms2}ms —— 缓存命中应为毫秒级，疑似重探`);

      // ④ 第二次 POST 同样走缓存命中
      const t3 = Date.now();
      const r3 = await postJson(P, '/api/setup/run', body);
      const ms3 = Date.now() - t3;
      need(r3.status === 404, `第二次 POST 应 404，实际 ${r3.status}`);
      need(ms3 < 2000, `第二次 POST 仍花 ${ms3}ms —— 缓存命中应为毫秒级，疑似重探`);

      // ⑤ 失败路径必须不起任务（沿用本套件纪律）
      const now = await jobsList(P);
      need(now.every((j) => j.actionId !== unknownId && j.actionId !== fbId), `不该为「${unknownId}」/「${fbId}」起任务`);

      notes.push(`⑪ 冷态：未知 id 404=${ms0}ms（不探测）≪ GET /api/setup/actions=${ms1}ms（付一次全量探测）→ /api/env cached:true（共用缓存）→ POST#1=${ms2}ms / POST#2=${ms3}ms（均缓存命中）`);
    });

    // ★★ 就绪屏障（2026-10-10 定性 D8②；★ 修复后：`/api/setup/actions` 与 `POST /api/setup/run`
    //    都已改用共享 envCache，见 ⑪）：本套件起的是**真** server.mjs；`/api/env` 会触发
    //    lib/env.mjs:checkEnv 的 **3 次串行 wsl.exe 探针**。WSL **冷启动 / 忙**时这一次全量探针
    //    可远超 60s ⇒ 用例偶发红（登记 2/13；本机复现为 `POST /api/setup/run` 60010ms，1/12）。
    //    ⇒ 这里**先**用一次宽松超时的 `/api/env` 把 WSL 唤醒：探针成本照付（**真探针，不是 sleep**），
    //      但不计入被测用例；随后的用例只面对**已热**的 WSL（另见文件顶 `CLIENT_TIMEOUT_MS` 的预算对齐）。
    //      **不改任何断言**（形状 / 计数 / 任务数一字未动）。
    //    ★ ⑪ 已在本屏障**之前**把缓存探热过 ⇒ 这一发多半直接命中缓存（本行仍保留：它是**兜底**，
    //      且模拟「用户点重新检测」时 WSL 冷启动的那一发）。
    const warm = await httpSend(P, { method: 'GET', path: '/api/env' });
    need(warm.status === 200, `就绪屏障：/api/env 预热失败（${warm.status}）`);

    // 起服务后立刻记一份任务基线（跑完必须与它一致 —— 一个任务都不该新增）
    const baselineJobIds = new Set((await jobsList(P)).map((j) => j.id));

    // ── ①②③ GET /api/setup/actions ────────────────────────
    let scenarios = [];               // 权威演练场景清单（来自 GET /api/env，不硬编码）
    const simKind = new Map();        // actionId → kind（跨场景汇总）
    const manualKnownIds = new Set(); // 「已知且是手动」的动作 id（安全：即便环境变化也只会 400，不会安装）

    await runCase('① GET /api/setup/actions?simulate=<场景>：count/autoCount/manualCount 自洽 + serializeAction 形状', async () => {
      const env = await get('/api/env');
      need(env.status === 200 && env.json && env.json.setup, `GET /api/env 拿不到 setup 块：${env.status} ${env.text.slice(0, 160)}`);
      scenarios = env.json.setup.scenarios || [];
      need(Array.isArray(scenarios) && scenarios.length >= 1, `scenarios 不是非空数组：${JSON.stringify(scenarios)}`);
      need(scenarios.every((s) => s && typeof s.key === 'string' && s.key && typeof s.title === 'string'), `scenarios 里有项缺 key/title`);

      const known = knownActionIds();
      let sumAuto = 0;
      let sumManual = 0;
      const seen = [];
      for (const s of scenarios) {
        const r = await get('/api/setup/actions?simulate=' + encodeURIComponent(s.key));
        need(r.status === 200, `simulate=${s.key} 应 200，实际 ${r.status}：${r.text.slice(0, 200)}`);
        const b = r.json;
        need(b.simulated === s.key, `simulate=${s.key} 时 simulated 应回显该键，实际 ${JSON.stringify(b.simulated)}`);
        assertActionsShape(b, `simulate=${s.key}`);
        for (const a of b.actions) {
          simKind.set(a.id, a.kind);
          if (a.kind === 'manual' && known.includes(a.id)) manualKnownIds.add(a.id);
        }
        sumAuto += b.autoCount;
        sumManual += b.manualCount;
        seen.push(`${s.key}:${b.count}(a${b.autoCount}/m${b.manualCount})`);
      }
      // 反空转：演练必须真的覆盖到 auto 与 manual 两类分支
      need(sumAuto >= 1, '所有演练场景加起来一个 auto 动作都没有 —— 演练没覆盖到可自动分支');
      need(sumManual >= 1, '所有演练场景加起来一个 manual 动作都没有 —— 演练没覆盖到手动分支');
      notes.push(`① 演练场景 ${scenarios.length} 个（${scenarios.map((s) => s.key).join('/')}）：${seen.join(' · ')}；跨场景覆盖 auto+manual 两类`);
    });

    await runCase('② GET /api/setup/actions?simulate=<未知场景> → 400「未知演练场景」', async () => {
      const bogus = 'zz-不存在-' + Date.now().toString(36);
      need(!scenarios.some((s) => s.key === bogus), 'bogus 场景名竟然在权威清单里');
      const r = await get('/api/setup/actions?simulate=' + encodeURIComponent(bogus));
      need(r.status === 400, `未知场景应 400，实际 ${r.status}：${r.text.slice(0, 200)}`);
      need(r.json && typeof r.json.error === 'string' && /未知演练场景/.test(r.json.error),
        `400 文案没说明「未知演练场景」：${r.text.slice(0, 200)}`);
      notes.push(`② 未知场景 simulate=${bogus} → 400 ${JSON.stringify(r.json.error)}`);
    });

    let realPlan = null;   // 真实环境（POST /api/setup/run 用的那份）
    await runCase('③ GET /api/setup/actions（无 simulate）→ 200：真实环境计划，simulated=null', async () => {
      const r = await get('/api/setup/actions');
      need(r.status === 200, `应 200，实际 ${r.status}：${r.text.slice(0, 200)}`);
      need(r.json.simulated === null, `无 simulate 时 simulated 应为 null，实际 ${JSON.stringify(r.json.simulated)}`);
      assertActionsShape(r.json, '真实计划');
      realPlan = r.json;
      notes.push(`③ 真实计划：count=${realPlan.count}（auto=${realPlan.autoCount}/manual=${realPlan.manualCount}），summary=${JSON.stringify(realPlan.summary)}，runnable=${realPlan.runnable}`);
    });

    // ── ④ POST /api/setup/run：请求体校验（早退，不触发检测）──
    await runCase('④ POST /api/setup/run 请求体校验：非法 JSON / actionId 缺·非串·空·非法字符 → 400 且不起任务', async () => {
      const j = await postRunRawExpect(P, '{ bad json', 400, '非法 JSON');
      need(/合法 JSON/.test(j.json.error || ''), `非法 JSON 的 400 文案不对：${j.text.slice(0, 160)}`);

      const missing = [{}, { actionId: null }, { actionId: 123 }, { actionId: '' }, { actionId: '   ' }, { actionId: ['x'] }, { actionId: {} }];
      for (const body of missing) {
        const r = await postRunExpect(P, body, 400, `actionId=${JSON.stringify(body.actionId)}`);
        need(/缺少 actionId/.test(r.json.error || ''), `actionId=${JSON.stringify(body.actionId)} 的 400 文案不对：${r.text.slice(0, 160)}`);
      }

      const illegal = ['../x', 'a b', 'a/b', 'a\\b', 'a:b', 'a;b', '中文', 'a\nb'];
      for (const bad of illegal) {
        const r = await postRunExpect(P, { actionId: bad }, 400, `actionId=${JSON.stringify(bad)}`);
        need(/含非法字符/.test(r.json.error || ''), `actionId=${JSON.stringify(bad)} 的 400 文案不对：${r.text.slice(0, 160)}`);
      }
      notes.push(`④ 非法 JSON + ${missing.length} 种缺/坏 actionId + ${illegal.length} 种非法字符 → 全部 400，且每条都断言了任务数不变`);
    });

    // ── ⑤ POST /api/setup/run：完全未知的动作 → 404 ─────────
    await runCase('⑤ POST /api/setup/run 完全未知的动作 → 404 且不起任务', async () => {
      const id = 'zz-unknown-action-' + Date.now().toString(36);
      need(!knownActionIds().includes(id), `bogus id「${id}」竟然在 knownActionIds() 里`);
      const r = await postRunExpect(P, { actionId: id }, 404, `未知动作 ${id}`);
      need(r.json && typeof r.json.error === 'string' && /未知动作/.test(r.json.error),
        `404 文案没说明「未知动作」：${r.text.slice(0, 200)}`);
      notes.push(`⑤ 未知动作 ${id} → 404（不建任务）`);
    });

    // ── ⑥ POST /api/setup/run：manual 动作 → 400（带 manual 字段）──
    await runCase('⑥ POST /api/setup/run manual 动作 → 400 且带 manual 字段、不起任务', async () => {
      const manualId = ((realPlan && realPlan.actions) || []).filter((a) => a.kind === 'manual').map((a) => a.id)[0];
      if (!manualId) {
        // 本机真实环境已就绪 → 真实计划里没有 manual 动作 → 这个分支在本机**不可达**。
        // 如实标注（绝不去真跑一个安装来「制造」一个 manual 动作）。
        notes.push('⑥ ⚠️ 本机真实计划里没有 manual 动作（环境已就绪）→ manual→400 分支**在本机不可达**；'
          + 'manual 的序列化形状已由 ① 的演练场景覆盖');
        return;
      }
      const r = await postRunExpect(P, { actionId: manualId }, 400, `manual ${manualId}`);
      need(/需要手动完成/.test(r.json.error || ''), `manual 的 400 文案不对：${r.text.slice(0, 200)}`);
      need(r.json.manual && typeof r.json.manual === 'object', `manual→400 响应缺 manual 字段：${r.text.slice(0, 200)}`);
      need(typeof r.json.manual.note === 'string' && Array.isArray(r.json.manual.steps) && r.json.manual.steps.length >= 1,
        `manual 字段形状不对：${JSON.stringify(r.json.manual).slice(0, 200)}`);
      notes.push(`⑥ manual 动作 ${manualId} → 400，响应带 manual（note + ${r.json.manual.steps.length} 条指引），未起任务`);
    });

    // ── ⑦ POST /api/setup/run：已知但已就绪 → 200 skipped ────
    await runCase('⑦ POST /api/setup/run 已知但已就绪的动作 → 200 {ok,skipped} 且不起任务', async () => {
      const realIds = new Set(((realPlan && realPlan.actions) || []).map((a) => a.id));
      // ★ 只挑「已知 + 手动 + 不在真实计划里」的 id：幂等跳过；即便环境在两次请求间变化，
      //   它最多落到 manual→400（同样不安装），绝不会变成安装。
      const candidate = [...manualKnownIds].find((id) => !realIds.has(id));
      if (!candidate) {
        notes.push('⑦ ⚠️ 找不到「knownActionIds() 里、但不在真实计划里」的**手动**动作 → skipped 分支在本机不可达');
        return;
      }
      const r = await postRunExpect(P, { actionId: candidate }, 200, `已就绪 ${candidate}`);
      need(r.json && r.json.ok === true && r.json.skipped === true, `应回 {ok:true,skipped:true}，实际 ${r.text.slice(0, 200)}`);
      need(typeof r.json.reason === 'string' && r.json.reason, `skipped 没给 reason：${r.text.slice(0, 200)}`);
      notes.push(`⑦ 已就绪动作 ${candidate} → 200 skipped（reason=${r.json.reason.slice(0, 36)}…），未起任务`);
    });

    // ── ⑧ 全程零任务（在停服务之前查）──────────────────────
    await runCase('⑧ 全程未起任何任务（GET /api/jobs 增量：一条都不该新增）', async () => {
      const now = await jobsList(P);
      const added = now.filter((j) => !baselineJobIds.has(j.id));
      need(added.length === 0, `意外新增了任务：${JSON.stringify(added.map((j) => ({ id: j.id, kind: j.kind, actionId: j.actionId, status: j.status })))}`);
      // 本机历史里**本来就有**旧的 setup 任务（用户跑过向导），所以只能断言「**新增**的 setup 任务为 0」。
      const newSetup = now.filter((j) => j.kind === 'setup' && !baselineJobIds.has(j.id));
      need(newSetup.length === 0, `新增了 kind=setup 的任务：${JSON.stringify(newSetup.map((j) => ({ id: j.id, actionId: j.actionId })))}`);
      notes.push(`⑧ 全程任务数恒为 ${now.length}（相对基线零新增；新增的 kind=setup 任务为 0）`);
    });
  } finally {
    // ── 收尾 ──
    if (server && !OPT.keepServer) { await stopServer(server.child); log(C.dim(`  测试服务已停止（pid ${server.child.pid}）`)); }

    // 万一真起了任务：按确切路径删日志 + 从 index.json 摘除（正常路径下是空操作）
    try {
      await sleep(500);
      const rep = cleanupJobs();
      if (rep.removed.length) log(C.bad(`  ⚠️ 已清理意外产生的测试任务：${rep.removed.join(', ')}`));
      if (rep.errors.length) log(C.bad(`  ⚠️ 测试任务清理失败：${rep.errors.join('；')}`));
    } catch (e) { log(C.bad(`  ⚠️ 测试任务清理异常：${e.message}`)); }

    // 固定入口逐字节还原
    for (const [f, buf] of backup) {
      try {
        if (buf === null) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
        else fs.writeFileSync(f, buf);
      } catch (e) { log(C.bad(`  ⚠️ 固定入口还原失败：${path.basename(f)}（${e.message}）`)); }
    }
    log(C.dim(`  固定入口已还原：${ENTRY_FILES.map((f) => path.basename(f)).join(' · ')}`));
  }

  // ── 最后一道闸：固定入口必须与跑前逐字节一致 ──
  {
    const name = '⑨ 无残留：`.console-port` / `打开控制台.url` 跑完与跑前逐字节一致';
    const problems = [];
    for (const [f, buf] of backup) {
      let now = null;
      try { now = fs.readFileSync(f); } catch { now = null; }
      if (buf === null) { if (now !== null) problems.push(`${path.basename(f)} 跑前不存在、跑后出现了`); }
      else if (now === null) problems.push(`${path.basename(f)} 跑后不见了`);
      else if (Buffer.compare(buf, now) !== 0) problems.push(`${path.basename(f)} 内容与跑前不一致`);
    }
    if (problems.length) {
      results.push({ name, ok: false, ms: 0, err: new Error(problems.join('；')) });
      log(`  ${C.bad('FAIL')}  ${name}`);
      for (const p of problems) log(`        ${p}`);
    } else {
      results.push({ name, ok: true, ms: 0 });
      log(`  ${C.ok('PASS')}  ${name}`);
      notes.push('⑨ 两个固定入口跑前/跑后逐字节一致（无残留临时文件：本套件不产生临时文件）');
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
