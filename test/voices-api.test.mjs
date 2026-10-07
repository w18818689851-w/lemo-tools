#!/usr/bin/env node
/**
 * test/voices-api.test.mjs —— 「声音」版块的**失败路径**契约（**独立入口**）
 *
 * 为什么单独一个入口：沿用本项目已有的分工 —— smoke.mjs / setup.test.mjs / ui.test.mjs /
 * briefs.test.mjs / dub-api.test.mjs 各自一个数字、互不干扰。这一套只管 `/api/voices*` 里
 * **此前零覆盖**的这几个接口：
 *   GET  /api/voices/sources             （音色源目录候选清单）
 *   POST /api/voices/import              （源素材 → 参考音；**只测失败路径，绝不真转换**）
 *   POST /api/voices/test                （试听合成；**只测失败路径，绝不真合成**）
 *   GET  /api/voices/test/audio/<file>   （试听产物字节流）
 * （`GET /api/voices`、`GET /api/voices/audio` 已由 cases.mjs / ui.test.mjs 覆盖，这里不重复。）
 *
 * ★ 硬约束：**零 GPU、零 TTS、零真渲染、零 ffmpeg 实跑**。
 *   所以 import / test 两条**只打失败路径** —— 每条失败之后都断言「没有起任务」（增量）。
 *   成功路径**故意不测**：会 jobs.enqueueSetup 一条真任务（起 ffmpeg / 加载 TTS 模型），
 *   违反硬约束。
 *
 * 用法：
 *   node test/voices-api.test.mjs                 全部用例
 *   node test/voices-api.test.mjs --filter 404    只跑名字里含「404」的用例
 *   node test/voices-api.test.mjs --keep-server   跑完不杀测试服务（调试用，自己记得收）
 *   LEMO_VOICE_TEST_TMP=<dir>                     试听**临时**目录（默认 `<CFG.tmpDir>/voicetest-<pid>`）。
 *                                                 与 lib/voices.mjs 同名同义；显式设了就用它（夹具树隔离）。
 *
 * 纪律（全部沿用 dub-api.test.mjs 踩出来的那套）：
 *   - 测试自己用内核分配的空闲端口起服务，**绝不碰用户那个实例**。
 *   - 测试服务会覆写 `.console-port` / `打开控制台.url` —— 跑前按字节备份、跑后逐字节还原。
 *   - 不用 curl（本机走代理，打 localhost 得到 502）；不用 spawnSync（本环境一律 EBUSY）。
 *   - 临时/产物目录（试听产物、试听临时文件）跑前快照，跑后**先记差集、再**按**确切路径**删除新增项。
 *     ★ 差集必须**删除之前**取 —— 先删后读会让 ⑨ 恒过、成为**假绿**（2026-10-07 修掉的真缺陷）。
 *   - ★ 试听**临时**目录是**应用目录**（lib/voices.mjs 的 `prepareVoiceTest` 真往它写盘），
 *     不是本套件的私有目录 ⇒ 靠覆盖点 `LEMO_VOICE_TEST_TMP` 隔离：显式设了用它，未设时用
 *     `voicetest-<pid>`（下面把最终值写回 env，**在 spawn server 之前** ⇒ server 继承它、真的写到这里）。
 *   - ★ 断言**增量**（不断言绝对数量）：任务历史是落盘持久化的。
 *
 * 退出码：全绿 0 / 有用例失败 1 / 自身异常 2。
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { CFG } from '../lib/env.mjs';        // 只借常量；env.mjs 顶层无副作用
import * as voices from '../lib/voices.mjs'; // 只借常量 / 路径；voices.mjs 顶层无副作用

// ★ 起服务的测试实例不该写用户的固定入口文件（.console-port / 打开控制台.url）——
//   否则每跑一次测试就把它们改成测试端口；跑崩时还原语句没执行，脏值还会残留（见 server.mjs 文件头）。
//   设了这个环境变量，本进程 spawn 出的 server.mjs 会跳过写入。下面的备份/还原是第二道防线，保留。
process.env.LEMO_CONSOLE_NO_ENTRY_FILES = '1';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 被测对象的关键常量（从实现里取，**不硬编码**）
const VOICE_TEST_DIR = voices.VOICE_TEST_DIR;                       // D:\lemo-films\_voicetest（认 LEMO_FILM_DIR）
// ★ 试听**临时**目录：应用侧定义在 lib/voices.mjs 的 `TEST_TMP_DIR`（`prepareVoiceTest` 真写盘），
//   是**应用目录**、不是本套件私有的 ⇒ 覆盖点 `LEMO_VOICE_TEST_TMP` 与它同名同义：
//   显式设了就用它（夹具树里可隔离）；未设时退回**按进程唯一**的默认 ⇒ 并发跑两个实例不互删在途文件。
//   ★ 下面把最终值**写回 env**，位置在 `main()` 之前 ⇒ 一定早于 `startServer()` 的 spawn
//   ⇒ 测试服务（继承 env）写的就是这里。若只在测试里换目录而不写回 env，快照目录会与应用
//   真写的目录**分叉**，⑨ 就成了恒真的空断言。
const TEST_TMP_DIR = process.env.LEMO_VOICE_TEST_TMP
  ? path.resolve(process.env.LEMO_VOICE_TEST_TMP)
  : path.join(CFG.tmpDir, `voicetest-${process.pid}`);
process.env.LEMO_VOICE_TEST_TMP = TEST_TMP_DIR;
const DEFAULT_TEST_TEXT = voices.DEFAULT_TEST_TEXT;
const DEFAULT_TEST_SPEED = voices.DEFAULT_TEST_SPEED;
const ENTRY_FILES = [path.join(ROOT, '.console-port'), path.join(ROOT, '打开控制台.url')];

// ★ 契约常量（写在 server.mjs 的 apiVoiceTest 里，无导出）—— 这里作为**契约**硬编码：
const NAME_RE = /^[A-Za-z0-9._-]{1,80}$/;   // 音色名白名单
const TEXT_MAX = 300;                        // 试听文本上限

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

// ── 产物登记与清理（**只动登记过的东西**）────────────────────
const EXTRA_PATHS = new Set();   // 跑后新出现的确切路径（兜底删除）
// ★ 兜底删除**之前**记下的差集（dir → 跑后新增的名字），供 ⑨ 当判据用。
//   为什么非要单独存一份：⑨ 原先是在删除**之后**重新 readdir 再算差集的 ⇒ 被删掉的东西
//   一个都报不出来，⑨ 恒过 = **假绿**（2026-10-07 实测：跑期间往目录写一个文件，删掉后仍全绿）。
const RESIDUE = new Map();

const listDir = (dir) => { try { return fs.readdirSync(dir).sort(); } catch { return []; } };

function cleanupExtra() {
  const errors = [];
  for (const p of EXTRA_PATHS) {
    try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { errors.push(`${p}：${e.message}`); }
  }
  EXTRA_PATHS.clear();
  return errors;
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

/** 当前任务数（用于「失败之后没起任务」的增量断言）。 */
async function jobsCount(port) {
  const r = await getJson(port, '/api/jobs');
  need(r.status === 200 && r.json && Array.isArray(r.json.jobs), `GET /api/jobs 异常：${r.status} ${r.text.slice(0, 120)}`);
  return r.json.jobs.length;
}

/** POST /api/voices/test 期望某状态码，且**不起任务**。 */
async function testExpect(port, body, want, label) {
  const before = await jobsCount(port);
  const r = await postJson(port, '/api/voices/test', body);
  need(r.status === want, `${label}：应 ${want}，实际 ${r.status}：${r.text.slice(0, 200)}`);
  const after = await jobsCount(port);
  need(after === before, `${label}：不该起任务（${before} → ${after}）`);
  return r;
}

/** POST /api/voices/import 期望某状态码，且**不起任务**。 */
async function importExpect(port, body, want, label) {
  const before = await jobsCount(port);
  const r = await postJson(port, '/api/voices/import', body);
  need(r.status === want, `${label}：应 ${want}，实际 ${r.status}：${r.text.slice(0, 200)}`);
  const after = await jobsCount(port);
  need(after === before, `${label}：不该起任务（${before} → ${after}）`);
  return r;
}

/**
 * 找一个**真能解析**（清单里有、且参考音文件存在）的音色名 —— 用来把请求推进到
 * 「name 之后」的校验分支（超长 text）。清单读不到就返回 null（调用方跳过并记 note）。
 */
async function pickResolvableName(port) {
  const list = await getJson(port, '/api/voices');
  if (list.status !== 200 || !list.json || !Array.isArray(list.json.voices)) return null;
  const cands = list.json.voices
    .filter((v) => v && typeof v.name === 'string' && v.exists !== false && typeof v.file === 'string')
    .map((v) => v.name);
  return cands;
}

async function main() {
  const t0 = Date.now();

  log('');
  log(C.b('lemo 控制台 · 声音接口失败路径（/api/voices*）测试'));
  log(C.dim(`  项目      ${ROOT}`));
  log(C.dim(`  试听产物  ${VOICE_TEST_DIR}`));
  log(C.dim(`  试听临时  ${TEST_TMP_DIR}`));
  log(C.dim(`  契约      音色名 ${NAME_RE} · 试听文本 ≤ ${TEXT_MAX} 字 · 默认语速 ${DEFAULT_TEST_SPEED}`));
  log(C.dim(`  模式      ${OPT.filter ? `filter="${OPT.filter}"` : '全部'}`));
  log('');

  // ── 跑前备份固定入口 + 快照产物/临时目录 ──────────────────
  const backup = new Map();
  for (const f of ENTRY_FILES) {
    try { backup.set(f, fs.readFileSync(f)); } catch { backup.set(f, null); }
  }
  const testDirBefore = listDir(VOICE_TEST_DIR);
  const tmpDirBefore = listDir(TEST_TMP_DIR);
  const testDirExisted = fs.existsSync(VOICE_TEST_DIR);

  let server = null;
  try {
    server = await startServer();
    const P = server.port;
    const get = (p) => getJson(P, p);

    // ══ ① sources：200 且是候选清单形状（不硬编码候选数量）══════
    await runCase('① GET /api/voices/sources → 200 · 对象含 ok/dir/sources（不硬编码候选数量）', async () => {
      const r = await get('/api/voices/sources');
      need(r.status === 200, `sources 应 200，实际 ${r.status}：${r.text.slice(0, 160)}`);
      need(r.json && typeof r.json === 'object' && !Array.isArray(r.json), `响应应是对象：${r.text.slice(0, 160)}`);
      need(typeof r.json.ok === 'boolean', `缺 ok 布尔：${r.text.slice(0, 160)}`);
      need(typeof r.json.dir === 'string' && r.json.dir.length > 0, `dir 不是非空字符串：${JSON.stringify(r.json.dir)}`);
      need(Array.isArray(r.json.sources), `sources 不是数组：${r.text.slice(0, 160)}`);
      // ok:false 时 sources 必为空、error 非空；ok:true 时逐项形状
      if (r.json.ok) {
        for (const s of r.json.sources) {
          need(s && typeof s.file === 'string' && s.file, `候选缺 file：${JSON.stringify(s).slice(0, 120)}`);
          need(typeof s.name === 'string' && NAME_RE.test(s.name), `候选 name 不合白名单：${JSON.stringify(s.name)}`);
          need(typeof s.ext === 'string' && typeof s.size === 'number', `候选缺 ext/size：${JSON.stringify(s).slice(0, 120)}`);
          need(typeof s.already === 'boolean', `候选缺 already：${JSON.stringify(s).slice(0, 120)}`);
          need(s.refName === `${s.name}.wav`, `refName 与 name 不一致：${JSON.stringify(s).slice(0, 120)}`);
        }
      } else {
        need(typeof r.json.error === 'string' && r.json.error.length > 0, `ok:false 但 error 为空：${r.text.slice(0, 160)}`);
      }
      notes.push(`① sources：ok=${r.json.ok}，候选 ${r.json.sources.length} 条（未断言绝对数），dir=${r.json.dir}`);
    });

    // ══ ② test/audio：非法文件名 400 · 不存在 404 · ★越界不可达 ══
    await runCase('② GET /api/voices/test/audio/<file> → 非法文件名 400 / 不存在 404 / ★路径越界 403 经 HTTP 不可达', async () => {
      // 非法文件名（含空格 / 中文）→ 400
      for (const bad of ['a b.wav', '中.wav']) {
        const r = await get('/api/voices/test/audio/' + encodeURIComponent(bad));
        need(r.status === 400, `非法文件名 ${JSON.stringify(bad)} 应 400，实际 ${r.status}：${r.text.slice(0, 160)}`);
        need(r.json && /非法/.test(r.json.error || ''), `400 理由没说清「非法」：${r.text.slice(0, 160)}`);
      }
      // 形状合法但文件不存在 → 404
      const miss = await get('/api/voices/test/audio/nope_20260101-000000.wav');
      need(miss.status === 404, `不存在的产物应 404，实际 ${miss.status}：${miss.text.slice(0, 160)}`);
      need(miss.json && /不存在/.test(miss.json.error || ''), `404 理由没说清「不存在」：${miss.text.slice(0, 160)}`);

      // ★ 路径越界分支（server.mjs:1010 的 403）**经 HTTP 不可达**：
      //   路由正则 `([^/]+)` 不允许 `/`，而 `..` / `%2e%2e` 会被 `new URL()` 的
      //   dot-segment 归一化**在到达 handler 前**消掉 → 落到「未知接口」的通用 404。
      //   所以这里如实断言「不是 403、也不是 400」，且不泄漏任何越界文件。
      for (const raw of ['..', '%2e%2e']) {
        const r = await get('/api/voices/test/audio/' + raw);
        need(r.status !== 403, `期望越界不可达，却真的拿到 403：${raw} → ${r.text.slice(0, 160)}`);
        need(r.status === 404, `dot-segment 归一化后应落到通用 404，实际 ${r.status}（${raw}）：${r.text.slice(0, 160)}`);
        need(!/win\.ini/i.test(r.text), `响应泄漏了越界文件内容：${r.text.slice(0, 160)}`);
      }
      notes.push('② test/audio：非法名 400 / 不存在 404；★403「路径越界」分支经 HTTP **不可达**'
        + '（`..`·`%2e%2e` 被 URL dot-segment 归一化，`([^/]+)` 又禁 `/`）→ 实落通用 404「未知接口」');
    });

    // ══ ③ test：非法 JSON / 缺 name / 非法 name 形状 → 400 ════
    await runCase('③ POST /api/voices/test → 非法 JSON / 缺 name / 非法 name 形状 → 400 且不起任务', async () => {
      const before = await jobsCount(P);

      const j = await postRaw(P, '/api/voices/test', '{ not json ');
      need(j.status === 400 && /合法 JSON/.test(j.json.error || ''), `非法 JSON 应 400，实际 ${j.status}：${j.text.slice(0, 160)}`);

      await testExpect(P, {}, 400, '缺 name');
      await testExpect(P, { name: '   ' }, 400, 'name 全空白');
      await testExpect(P, { name: 123 }, 400, 'name 非字符串');

      // 非法字符 / 超 80 字 —— 都命中白名单正则
      const badNames = ['../x', 'a b', '中文', 'a/b', 'x'.repeat(81)];
      for (const bad of badNames) {
        const r = await testExpect(P, { name: bad }, 400, `非法 name ${JSON.stringify(bad.slice(0, 12))}`);
        need(/非法字符/.test(r.json.error || ''), `400 理由没说清「非法字符」：${r.text.slice(0, 160)}`);
      }

      const after = await jobsCount(P);
      need(after === before, `上面这些 400 里有人起了任务（${before} → ${after}）`);
      notes.push(`③ test：非法 JSON + 缺/空/非串 name + ${badNames.length} 种非法形状 → 400；任务数全程 ${before}`);
    });

    // ══ ④ test：name 形状合法但清单里没有 → 404 ══════════════
    await runCase('④ POST /api/voices/test → name 形状合法但清单里没有 → 404 且不起任务', async () => {
      const r = await testExpect(P, { name: 'definitely_not_a_voice_9f3a' }, 404, '未登记 name');
      need(r.json && typeof r.json.error === 'string' && r.json.error.length > 0, `404 缺 error 说明：${r.text.slice(0, 160)}`);
      notes.push('④ test：形状合法但清单里没有的 name → 404（resolveVoice 返回 ok:false）');
    });

    // ══ ⑤ test：超长 text（> 300）→ 400 且不起任务 ═══════════
    await runCase(`⑤ POST /api/voices/test → 超长 text（>${TEXT_MAX}）→ 400 且不起任务`, async () => {
      const cands = await pickResolvableName(P);
      if (!cands || cands.length === 0) {
        notes.push('⑤ ⚠️ 音色清单读不到（或没有可解析的音色）—— 超长 text 的 400 分支**未能验证**（跳过）');
        return;
      }
      const before = await jobsCount(P);
      let hit = null;
      let last404 = '';
      for (const name of cands.slice(0, 8)) {
        const r = await postJson(P, '/api/voices/test', { name, text: 'x'.repeat(TEXT_MAX + 1) });
        // 只有「name 解析不到」的 404 才换下一个；别的 404（如把 400 改错）必须当场暴露
        if (r.status === 404 && /不在清单里/.test((r.json && r.json.error) || '')) {
          last404 = `${name}: ${r.text.slice(0, 120)}`;
          continue;
        }
        need(r.status === 400, `超长 text 应 400，实际 ${r.status}（name=${name}）：${r.text.slice(0, 200)}`);
        need(/过长/.test(r.json.error || ''), `400 理由没说清「过长」：${r.text.slice(0, 160)}`);
        hit = name;
        break;
      }
      const after = await jobsCount(P);
      need(after === before, `超长 text 那条起了任务（${before} → ${after}）`);
      need(hit, `没有可解析的音色名能把请求推进到 text 校验（最后 404：${last404}）`);
      // ★ 边界：恰好 300 字**不该**在这条被拒（但会继续往下走 → 起任务，故不测）；这里只钉 >300
      notes.push(`⑤ test：name=${hit} + text=${TEXT_MAX + 1} 字 → 400「过长」，未起任务（任务数全程 ${before}）`);
    });

    // ══ ⑥ import：非法 JSON / 缺 file（★ 是 file 不是 name）→ 400 ══
    await runCase('⑥ POST /api/voices/import → 非法 JSON / 缺 file（★ 参数是 file，不是 name）→ 400 且不起任务', async () => {
      const j = await postRaw(P, '/api/voices/import', 'oops');
      need(j.status === 400 && /合法 JSON/.test(j.json.error || ''), `非法 JSON 应 400，实际 ${j.status}：${j.text.slice(0, 160)}`);

      const a = await importExpect(P, {}, 400, '空 body');
      need(/缺少 file/.test(a.json.error || ''), `空 body 应报「缺少 file」，实际：${a.text.slice(0, 160)}`);

      // ★ 只给 name、不给 file —— 仍然 400 且理由说的是 file（证明契约参数是 file）
      const b = await importExpect(P, { name: 'whatever' }, 400, '只给 name 不给 file');
      need(/缺少 file/.test(b.json.error || ''), `只给 name 应报「缺少 file」，实际：${b.text.slice(0, 160)}`);

      const c = await importExpect(P, { file: '   ' }, 400, 'file 全空白');
      need(/缺少 file/.test(c.json.error || ''), `空白 file 应报「缺少 file」，实际：${c.text.slice(0, 160)}`);

      notes.push('⑥ import：非法 JSON / 缺 file / 只给 name / 空白 file → 全部 400「缺少 file」'
        + '（★ 契约参数是 file，不是 name —— 与任务描述不符）');
    });

    // ══ ⑦ import：file 不在候选清单 → 400（★ 不是 404）══════
    await runCase('⑦ POST /api/voices/import → file 不在候选清单 → 400（★ 不是 404）且不起任务', async () => {
      const r = await importExpect(P, { file: 'zz-not-in-candidate-list.mp3' }, 400, '未知源文件');
      need(/不在候选清单/.test(r.json.error || ''), `400 理由没说清「不在候选清单」：${r.text.slice(0, 200)}`);
      // 目录穿越：源文件永远只是「清单里的一个名字」，穿越名自然不在清单 → 400
      const evil = await importExpect(P, { file: '../../windows/win.ini' }, 400, '穿越源文件');
      need(/不在候选清单/.test(evil.json.error || ''), `穿越名也应报「不在候选清单」：${evil.text.slice(0, 200)}`);
      notes.push('⑦ import：未知 file 与穿越 file（../../windows/win.ini）→ 都 400「不在候选清单」'
        + '（★ 是 400，不是任务描述说的 404）');
    });

    // ══ ⑧ import：真实候选文件 + 非法 name → 400 且不起任务 ════
    await runCase('⑧ POST /api/voices/import → 真实候选文件 + 非法 name → 400 且不起任务（绝不真转换）', async () => {
      const src = await get('/api/voices/sources');
      const first = src.status === 200 && src.json && Array.isArray(src.json.sources) ? src.json.sources[0] : null;
      if (!first) {
        notes.push('⑧ ⚠️ 音色源目录没有候选文件 —— 「真实 file + 非法 name → 400」未能验证（跳过）');
        return;
      }
      const r = await importExpect(P, { file: first.file, name: '../evil' }, 400, '真实 file + 非法 name');
      need(/name 非法/.test(r.json.error || ''), `非法 name 应报「name 非法」，实际：${r.text.slice(0, 200)}`);
      notes.push(`⑧ import：file=${first.file} + name=../evil → 400「name 非法」（在写脚本/起 ffmpeg **之前**被拒）`);
    });

    // ★ 成功路径**故意不测**：/api/voices/import 与 /api/voices/test 的合法请求都会
    //   jobs.enqueueSetup 一条真任务（起 ffmpeg / 加载 TTS 模型），违反本套件「零 ffmpeg、零 TTS」的硬约束。
    //
    // ★ 附带（无法安全验证，故只记录）：apiVoiceTest 里 speed 非法（非数字 / ≤0）**不是 400**，
    //   而是回落到 voices.DEFAULT_TEST_SPEED 再夹到 [0.5,2]。要观察到回落的**唯一**出口是 200 响应里的
    //   voice.speed —— 而走到 200 必然已经 enqueue 一条真合成任务。故这条行为**本套件不验**，
    //   仅在此登记契约（DEFAULT_TEST_SPEED=${DEFAULT_TEST_SPEED}）。
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

    // 产物/临时目录：★ **先取差集 → 断言（⑨）→ 再删**。顺序不能反 —— 先删后断言 ⇒ 被删掉的
    //   东西一个都报不出来 = **假绿**（2026-10-07 实测：跑期间往目录写一个文件，删掉后仍全绿）。
    //   正常情况下本套件什么都不该产生（它只打失败路径，写盘入口 `prepareVoiceTest` 在成功路径上），
    //   所以「跑后新增」只可能来自**别的进程**（并发测试 / 正在跑的控制台）⇒ 必须报出来。
    await sleep(300);
    const tAfter = listDir(VOICE_TEST_DIR);
    const tmpAfter = listDir(TEST_TMP_DIR);
    RESIDUE.set(VOICE_TEST_DIR, tAfter.filter((n) => !testDirBefore.includes(n)));
    RESIDUE.set(TEST_TMP_DIR, tmpAfter.filter((n) => !tmpDirBefore.includes(n)));

    // ── ⑨ 断言：★ 跑在删除**之前**，所以「跑期间多了文件」真的报得出来 ──
    {
      const problems = [];
      const tAdded = RESIDUE.get(VOICE_TEST_DIR);
      const tmpAdded = RESIDUE.get(TEST_TMP_DIR);
      if (tAdded.length) problems.push(`试听产物目录新增 ${JSON.stringify(tAdded)}`);
      if (tmpAdded.length) problems.push(`试听临时目录新增 ${JSON.stringify(tmpAdded)}`);

      const name = '⑨ 无残留：试听产物/临时目录跑前跑后一致（本套件不产生任何文件）';
      if (problems.length) {
        results.push({ name, ok: false, ms: 0, err: new Error(problems.join('；')) });
        log(`  ${C.bad('FAIL')}  ${name}`);
        for (const p of problems) log(`        ${p}`);
      } else {
        results.push({ name, ok: true, ms: 0 });
        log(`  ${C.ok('PASS')}  ${name} ${C.dim(`(产物 ${tAfter.length} 项 / 临时 ${tmpAfter.length} 项，与跑前一致)`)}`);
        notes.push(`⑨ 试听产物 ${tAfter.length} 项、试听临时 ${tmpAfter.length} 项，跑前跑后一致（未产生任何文件）`);
      }
    }

    // ── 再删：跑后新增的确切路径（正常为空；有值 = 上面 ⑨ 已报出的「不是自己的文件」）──
    for (const [dir, added] of RESIDUE) for (const n of added) EXTRA_PATHS.add(path.join(dir, n));
    const delErr = cleanupExtra();
    if (delErr.length) log(C.bad(`  ⚠️ 产物清理失败：${delErr.join('；')}`));

    // 产物目录若本不存在、删完仍为空 ⇒ 顺手移除空目录（不留垃圾）
    if (!testDirExisted && fs.existsSync(VOICE_TEST_DIR) && listDir(VOICE_TEST_DIR).length === 0) {
      try { fs.rmdirSync(VOICE_TEST_DIR); } catch { /* ignore */ }
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
