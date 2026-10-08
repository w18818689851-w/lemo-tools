#!/usr/bin/env node
/**
 * test/briefs.test.mjs —— 「主题工单」数据层 + 接口 + UI 的测试（**独立入口**）
 *
 * 为什么单独一个入口：沿用本项目已有的分工 —— `smoke.mjs`（服务端 36 条）、
 * `setup.test.mjs`（安装纯逻辑 12 条）、`ui.test.mjs`（Web UI 21 条）各自一个数字、互不干扰。
 *   ★ 2026-10-08 复核：smoke 现为 **41** 条（`STATIC 9 + SERVER 27 + PROCESS 5`，`--full` 另加 9）——
 *     其中的「服务端」`SERVER_CASES` 现为 **27**；「36」是旧的 smoke **总数**（同 `_distill/RETRO-2026-10-07-b93.md`
 *     修掉的 `README.md` 第 490 行那处）；`setup` 仍 **12**；`ui` 现为 **59**。
 * 这一套只管「主题工单」：白名单 / 状态机 / 落盘 / 损坏降级 / processable / 出片全链路 / UI 锚点。
 *
 * 用法：
 *   node test/briefs.test.mjs                 全部用例
 *   node test/briefs.test.mjs --filter 状态机   只跑名字里含「状态机」的用例
 *   node test/briefs.test.mjs --keep-server   跑完不杀测试服务（调试用，自己记得收）
 *
 * 纪律（全部沿用 smoke.mjs / ui.test.mjs 踩出来的那套）：
 *   - 测试自己用内核分配的空闲端口起服务，**绝不碰用户那个 18080 实例**。
 *   - 测试服务会覆写 `.console-port` / `打开控制台.url` —— 跑前按字节备份、跑后逐字节还原。
 *   - 不用 curl（本机走代理，打 localhost 得到 502）；不用 spawnSync（本环境一律 EBUSY）。
 *   - 临时文件在非 C 盘（D:\WSL\bf-ui-*），跑完按**确切路径**递归删除（不用通配符）。
 *   - ★ 测试造的工单、任务、日志**全部登记**，`finally` 里删干净 —— 绝不往用户数据里留垃圾。
 *   - ★ 断言**增量**（不断言绝对数量）：工单目录与任务历史都是落盘持久化的。
 *
 * 退出码：全绿 0 / 有用例失败 1 / 自身异常 2。
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { CFG } from '../lib/env.mjs';     // 只借常量；env.mjs 顶层无副作用

// ★ 起服务的测试实例不该写用户的固定入口文件（.console-port / 打开控制台.url）——
//   否则每跑一次测试就把它们改成测试端口；跑崩时还原语句没执行，脏值还会残留（见 server.mjs 文件头）。
//   设了这个环境变量，本进程 spawn 出的 server.mjs 会跳过写入。下面的备份/还原是第二道防线，保留。
process.env.LEMO_CONSOLE_NO_ENTRY_FILES = '1';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BRIEFS_DIR = path.join(CFG.exportDir, '.briefs');
const CONSOLE_ROOT = path.join(CFG.exportDir, '.console');
const CONSOLE_LOGS = path.join(CONSOLE_ROOT, 'logs');
const CONSOLE_INDEX = path.join(CONSOLE_ROOT, 'index.json');
// ★ 私有并发锁目录（见下方 spawnServer 的 LEMO_LOCK_DIR）。
//   为什么需要：⑥「出片全链路」会**真跑一次编排器 --dry-run**，而编排器要抢 `.<slug>.lock` 并发锁。
//   只要此刻有别的进程在渲染**同一个风格**，⑥ 就抢不到锁、编排器退出 1 ⇒ 那条用例**假红**。
//   实测：跑出片的同时跑套件，⑥ 必然失败，整套耗时从 9s 涨到 88s。
//   这不是「并发污染」而是**测试隔离缺陷** —— 测试必须能独立于真实渲染运行。
//   ★★ 2026-10-07 再收紧一层：原先它是**全机共享**的固定路径 `D:\lemo-films\.locks-test`
//     ⇒ 并发的**两个 briefs.test.mjs**（或「测试 + 用户实例」）会**互撞**：一个实例占了 `.<slug>.lock`，
//     另一个实例的 ⑥ 就会因「锁存在且 PID 存活、年龄 <6h」被编排器**直接 fail(exit 1)** 而假红。
//     实测：造一张占位锁（`pid=4`，System，必活）⇒ ⑥ **确定性**变红（不是随机崩）。
//     现叠一层 `<pid>` 子目录 ⇒ **每个实例各用各的锁目录**，互不影响；断言一个字没改。
//   ★★ 2026-10-07 起**已可隔离**（本条原写「无覆盖点 / 未完全隔离」，已过期）：`lib/env.mjs`
//     的 `CFG.exportDir` **已认** `LEMO_FILM_DIR` ⇒ 本套件共享的 `D:\lemo-films\.briefs` 与 `.console`
//     都跟着覆盖点走。⇒ **并发跑多个实例时，给每个实例设独立的 `LEMO_FILM_DIR`**：
//       `LEMO_FILM_DIR=<每实例临时目录> node test/briefs.test.mjs`（不再需要「请单独跑」的硬约束）。
//     ★ 已知残留：编排器 `lemo-make.mjs` 的 `exportDir` **不认** `LEMO_FILM_DIR`（红线）⇒
//       本套件若走到**真出片**那一段，产物仍落真成片根 —— 那种场景下仍不要与用户实例并发。
//     ⇒ 断言一个字没改，只订正本条说明。
const TEST_LOCK_DIR = path.join(CFG.exportDir, '.locks-test', String(process.pid));
const ENTRY_FILES = [path.join(ROOT, '.console-port'), path.join(ROOT, '打开控制台.url')];

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

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
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

// ── 测试服务 ────────────────────────────────────────────────
let SERVER_OUT = '';       // 服务端 stdout+stderr 累积（用来断言 warn 真的打出来了）

function spawnServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.mjs', '--port', String(port)], {
      cwd: ROOT, windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', LEMO_LOCK_DIR: TEST_LOCK_DIR },
    });
    let out = '';
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(arg);
    };
    const timer = setTimeout(() => finish(reject, new Error(`服务 30s 内没起来\n--- 服务输出 ---\n${out}`)), 30000);
    const onData = (d) => {
      const s = d.toString('utf8');
      out += s;
      SERVER_OUT += s;
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

// ── 无头 Edge --dump-dom（只用来验 UI 锚点）──────────────────
function findEdge() {
  for (const p of EDGE_CANDIDATES) { try { if (fs.statSync(p).isFile()) return p; } catch { /* 试下一个 */ } }
  return null;
}

let PROFILE_SEQ = 0;
const TMP_ROOTS = new Set();

function freshProfile() {
  const dir = path.join(CFG.tmpDir, `bf-ui-${process.pid}-${Date.now().toString(36)}-${(PROFILE_SEQ += 1)}`);
  fs.mkdirSync(dir, { recursive: true });
  TMP_ROOTS.add(dir);
  return dir;
}

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

/** 只对**超时**重试一次：本机第一次启动无头 Edge 特别慢（实测 15s，跟在别的套件之后可能 >60s）。 */
async function dumpDom(edge, url, { attempts = 2, ...opts } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await dumpDomOnce(edge, url, opts); }
    catch (e) {
      last = e;
      if (!/超时/.test(String(e && e.message))) throw e;
    }
  }
  throw last;
}

// ── 测试产物登记与清理（**只动登记过的东西**）────────────────
const BRIEF_IDS = new Set();      // 本套件造的工单 id
const JOB_IDS = new Set();        // 本套件起的任务 id

function cleanupBriefs() {
  const errors = [];
  for (const id of BRIEF_IDS) {
    for (const suffix of ['.json', '.json.tmp']) {
      try { fs.unlinkSync(path.join(BRIEFS_DIR, `${id}${suffix}`)); } catch { /* 没有就算了 */ }
    }
  }
  BRIEF_IDS.clear();
  return errors;
}

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
        const tmp = `${CONSOLE_INDEX}.bf-tmp`;
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

/** 建一张工单并登记（跑完必删）。 */
async function makeBrief(get, post, { topic, slug }) {
  const r = await post('/api/briefs', { topic, slug });
  need(r.status === 201, `建工单应 201，实际 ${r.status}：${r.text.slice(0, 200)}`);
  const id = r.json && r.json.brief && r.json.brief.id;
  need(id, `响应里没有 brief.id：${r.text.slice(0, 200)}`);
  BRIEF_IDS.add(id);
  return { id, brief: r.json.brief, res: r };
}

const readBriefFile = (id) => JSON.parse(fs.readFileSync(path.join(BRIEFS_DIR, `${id}.json`), 'utf8'));
const writeBriefFile = (id, obj) => fs.writeFileSync(path.join(BRIEFS_DIR, `${id}.json`), JSON.stringify(obj, null, 2), 'utf8');

/** 轮询等某张工单到达终态（done / failed）。 */
async function waitBrief(get, id, timeoutMs = 180000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    const r = await get('/api/briefs/' + encodeURIComponent(id));
    last = r.json && r.json.brief;
    if (last && (last.status === 'done' || last.status === 'failed')) return last;
    await sleep(700);
  }
  return last;
}

async function main() {
  const t0 = Date.now();
  const edge = findEdge();

  log('');
  log(C.b('lemo 控制台 · 主题工单测试'));
  log(C.dim(`  项目     ${ROOT}`));
  log(C.dim(`  工单目录 ${BRIEFS_DIR}`));
  log(C.dim(`  浏览器   ${edge || '（找不到 msedge.exe —— UI 锚点那条会失败）'}`));
  log(C.dim(`  模式     ${OPT.filter ? `filter="${OPT.filter}"` : '全部'}`));
  log('');

  // ── 跑前备份固定入口（服务启动会覆写它）──
  const backup = new Map();
  for (const f of ENTRY_FILES) {
    try { backup.set(f, fs.readFileSync(f)); } catch { backup.set(f, null); }
  }
  // 跑前的工单目录快照：跑完必须与它**逐字一致**（这是「不留垃圾」的硬判据）
  const briefsBefore = fs.existsSync(BRIEFS_DIR) ? fs.readdirSync(BRIEFS_DIR).sort() : [];
  // ★ 既有工单（**不是**本套件造的）的原始字节备份 —— 见收尾处的还原。
  //   为什么必须有：⑪「容量上限」会真触发一次容量裁剪，而裁剪按 createdAt 从**最旧**的开始删，
  //   **不区分**「这张是不是本套件造的」。只要 .briefs 里有一张比填充窗口（⑪ 里铺的
  //   `now - (CAP+5-i)*1000` ⇒ 最旧 = now-210s）更旧的既有工单 —— 比如上一次被中途杀掉的套件
  //   留下的、或用户自己攒的 —— 它就会被当成「最旧」删掉，紧接着 ⑭「无残留」报「丢失：<它>」⇒ **假红**。
  //   实测：把一张 1~2 小时前的既有工单放进 .briefs 再跑本套件，稳定 15 passed / 1 failed（⑭），
  //   而**下一轮**又变绿（那张工单已经被上一轮删掉了）—— 这正是「偶发、且无法复现」的来源。
  //   ⇒ 跑前留字节，收尾时把**被删/被改**的既有工单原样写回；⑭ 的「逐字一致」判据一字未动，
  //     于是它只可能抓到「本套件自己漏删的工单」（那才是它要抓的东西）。
  const briefsPreexisting = new Map();
  for (const name of briefsBefore) {
    try { briefsPreexisting.set(name, fs.readFileSync(path.join(BRIEFS_DIR, name))); }
    catch { /* 目录 / 读不了就算了（listBriefs 也只认文件） */ }
  }

  let server = null;
  try {
    server = await startServer();
    let base = `http://127.0.0.1:${server.port}`;
    const get = (p) => httpRequest(server.port, 'GET', p);
    const post = (p, b) => httpRequest(server.port, 'POST', p, b);
    const patch = (p, b) => httpRequest(server.port, 'PATCH', p, b);
    const del = (p) => httpRequest(server.port, 'DELETE', p);

    // ══ ① 白名单与建单 ══════════════════════════════════════
    await runCase('① 建工单：合法 slug → 201 + 落盘文件存在且内容正确', async () => {
      const before = (await get('/api/briefs')).json.count;

      const bad = await post('/api/briefs', { topic: '随便', slug: 'ascii-crt' });
      need(bad.status === 400, `白名单外的 slug 应 400，实际 ${bad.status}`);
      need(/不支持/.test(bad.json.error) && /engraving/.test(bad.json.error) && /silkscreen-poster/.test(bad.json.error),
        `400 的说明没说清「只支持哪 4 个」：${bad.json.error}`);
      need(!fs.existsSync(path.join(BRIEFS_DIR, 'ascii-crt.json')), '不该为白名单外的 slug 落盘');

      const { id, brief } = await makeBrief(get, post, { topic: '咖啡的历史', slug: 'engraving' });
      need(brief.status === 'pending', `新工单应是 pending，实际 ${brief.status}`);
      need(brief.topic === '咖啡的历史', `topic 应原样保留，实际 ${brief.topic}`);
      need(brief.slug === 'engraving' && brief.styleCn === '铜版画', `slug/中文名不对：${brief.slug}/${brief.styleCn}`);
      need(brief.runOpts.length === 0 && brief.contentRel === null && brief.linesRel === null,
        '新工单不该带 runOpts / contentRel / linesRel');

      const file = path.join(BRIEFS_DIR, `${id}.json`);
      need(fs.existsSync(file), `落盘文件不存在：${file}`);
      const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
      need(onDisk.id === id && onDisk.topic === '咖啡的历史' && onDisk.status === 'pending',
        `落盘内容不对：${JSON.stringify(onDisk).slice(0, 200)}`);
      need(onDisk.createdAt && Number.isFinite(Date.parse(onDisk.createdAt)), `createdAt 不是 ISO 时间：${onDisk.createdAt}`);

      const after = (await get('/api/briefs')).json;
      need(after.count === before + 1, `列表数量应 +1（${before} → ${after.count}）`);
      need(after.briefs.some((b) => b.id === id), '新建的工单没出现在列表里');
      need(after.styles.length === 4, `styles 白名单应 4 个，实际 ${after.styles.length}`);
      need(after.styles.map((s) => s.slug).join(',') === 'engraving,hologram-hud,midcentury-toon,silkscreen-poster',
        `styles 不是那 4 个：${after.styles.map((s) => s.slug).join(',')}`);
      notes.push(`① 建单 ${id}（${brief.styleCn} / pending）；白名单外 ascii-crt → 400；列表 ${before} → ${after.count}`);
    });

    // ══ ② 入参校验 ═════════════════════════════════════════
    await runCase('② 入参校验：空主题 / 超长主题 / 非法 slug 形状都 400', async () => {
      const a = await post('/api/briefs', { topic: '   ', slug: 'engraving' });
      need(a.status === 400 && /主题不能为空/.test(a.json.error), `空主题应 400，实际 ${a.status} ${a.text.slice(0, 120)}`);

      const b = await post('/api/briefs', { topic: 'x'.repeat(600), slug: 'engraving' });
      need(b.status === 400 && /太长/.test(b.json.error), `超长主题应 400，实际 ${b.status} ${b.text.slice(0, 120)}`);

      const c = await post('/api/briefs', { topic: 'x' });
      need(c.status === 400 && /缺少 slug/.test(c.json.error), `缺 slug 应 400，实际 ${c.status}`);

      const d = await post('/api/briefs', { slug: 'engraving' });
      need(d.status === 400 && /topic/.test(d.json.error), `缺 topic 应 400，实际 ${d.status}`);

      // 没建出任何工单 —— 上面 4 条都不该落盘（数量不变）
      const n = (await get('/api/briefs')).json.count;
      const e = await post('/api/briefs', { topic: '这一条要合法', slug: 'midcentury-toon' });
      need(e.status === 201, `合法请求应 201，实际 ${e.status}`);
      BRIEF_IDS.add(e.json.brief.id);
      need((await get('/api/briefs')).json.count === n + 1, '非法请求也落了盘？数量对不上');
      notes.push('② 空主题 / 600 字主题 / 缺 slug / 缺 topic 全部 400，且都没落盘');
    });

    // ══ ③ 详情与 404 ══════════════════════════════════════
    await runCase('③ 详情：存在 → 200；未知 id → 404；非法 id → 400', async () => {
      const { id } = await makeBrief(get, post, { topic: '城市夜骑的乐趣', slug: 'hologram-hud' });
      const r = await get('/api/briefs/' + encodeURIComponent(id));
      need(r.status === 200 && r.json.brief.id === id, `详情应 200，实际 ${r.status}`);
      need(r.json.brief.styleCn === '科幻全息界面', `中文名不对：${r.json.brief.styleCn}`);

      const nf = await get('/api/briefs/bnope-1');
      need(nf.status === 404, `不存在的工单应 404，实际 ${nf.status}`);

      const bad = await get('/api/briefs/..%2f..%2fetc%2fpasswd');
      need(bad.status === 400 || bad.status === 404, `非法 id 应 400/404，实际 ${bad.status}`);
      need(!/root:/.test(bad.text), '非法 id 竟然读到了系统文件');
      notes.push(`③ 详情 200 / 未知 404 / 非法 id ${bad.status}（没有路径穿越）`);
    });

    // ══ ④ 状态机 ══════════════════════════════════════════
    await runCase('④ 状态机：pending 不许出片（409）、running 不许删（409）、非法迁移 409', async () => {
      const { id } = await makeBrief(get, post, { topic: '春天该去哪条步道', slug: 'silkscreen-poster' });

      const run = await post(`/api/briefs/${id}/run`, {});
      need(run.status === 409, `pending 出片应 409，实际 ${run.status}：${run.text.slice(0, 160)}`);
      need(/pending/.test(run.json.error) && /处理工单/.test(run.json.error),
        `409 的理由要写清「先让 WorkBuddy 处理」：${run.json.error}`);
      need(readBriefFile(id).status === 'pending', '被拒之后工单状态不该变');

      // 非法迁移：pending → done / pending → running 都不允许（只有 pending → ready）
      const t1 = await patch(`/api/briefs/${id}`, { status: 'done' });
      need(t1.status === 409, `pending→done 应 409，实际 ${t1.status}`);
      const t2 = await patch(`/api/briefs/${id}`, { status: 'bogus' });
      need(t2.status === 400, `未知 status 应 400，实际 ${t2.status}`);

      // contentRel 不许带路径（防越界）
      const t3 = await patch(`/api/briefs/${id}`, { contentRel: '../../evil.json' });
      need(t3.status === 400, `contentRel 带 .. 应 400，实际 ${t3.status}`);

      // 手动把文件改成 running（模拟「正在出片」）→ 删除必须 409
      const raw = readBriefFile(id);
      writeBriefFile(id, { ...raw, status: 'running' });
      const d = await del('/api/briefs/' + encodeURIComponent(id));
      need(d.status === 409, `running 工单删除应 409，实际 ${d.status}：${d.text.slice(0, 160)}`);
      need(fs.existsSync(path.join(BRIEFS_DIR, `${id}.json`)), 'running 工单被删掉了！');

      // 还原成 pending 再删（这张工单到此为止）
      writeBriefFile(id, { ...raw, status: 'pending' });
      const d2 = await del('/api/briefs/' + encodeURIComponent(id));
      need(d2.status === 200, `pending 工单删除应 200，实际 ${d2.status}`);
      BRIEF_IDS.delete(id);
      need(!fs.existsSync(path.join(BRIEFS_DIR, `${id}.json`)), '删除后文件还在');
      notes.push('④ pending 出片 409（附「先去对话里处理」）/ running 删除 409 / pending→done 409 / contentRel 带 .. 400');
    });

    // ══ ⑤ 外部改文件 → 控制台立刻可见 ═══════════════════════
    await runCase('⑤ WorkBuddy 直接改文件回写 ready → 列表立刻能看到（证明每次从磁盘读）', async () => {
      const { id } = await makeBrief(get, post, { topic: '咖啡的历史', slug: 'engraving' });
      const raw = readBriefFile(id);
      // 这就是 WorkBuddy 的回写：改文件，不经过任何接口
      writeBriefFile(id, {
        ...raw,
        status: 'ready',
        processedAt: new Date().toISOString(),
        contentRel: 'content_x.json',
        linesRel: 'lines_x.json',
        runOpts: ['--q', 'content=content_x.json'],
        notes: '由测试直接改文件回写',
      });
      const r = await get('/api/briefs/' + encodeURIComponent(id));
      need(r.status === 200, `详情应 200，实际 ${r.status}`);
      need(r.json.brief.status === 'ready', `外部改完文件后状态应立刻是 ready，实际 ${r.json.brief.status}（控制台缓存了？）`);
      need(r.json.brief.contentRel === 'content_x.json' && r.json.brief.runOpts.length === 2,
        `回写的 contentRel/runOpts 没读到：${JSON.stringify(r.json.brief).slice(0, 200)}`);
      const list = await get('/api/briefs');
      need(list.json.briefs.some((b) => b.id === id && b.status === 'ready'), '列表里还是旧状态（缓存了？）');
      notes.push(`⑤ 直接改 ${id}.json → 详情与列表都立刻是 ready（无缓存）`);
    });

    // ══ ⑥ 出片全链路（用 --dry-run，不真渲染）═══════════════
    await runCase('⑥ 出片全链路：ready → POST /run 起任务 → 工单自动转 done', async () => {
      const { id } = await makeBrief(get, post, { topic: '测试用主题（不会真渲染）', slug: 'engraving' });
      const raw = readBriefFile(id);
      // runOpts 由「WorkBuddy」填；这里用 --dry-run 让编排器只打印计划（不渲染、不混流）
      writeBriefFile(id, {
        ...raw,
        status: 'ready',
        processedAt: new Date().toISOString(),
        contentRel: 'content_does_not_exist.json',   // 故意指向不存在的文件 → 顺带验「只警告不拦」
        runOpts: ['--dry-run'],
      });

      const r = await post(`/api/briefs/${id}/run`, {});
      need(r.status === 200, `ready 出片应 200，实际 ${r.status}：${r.text.slice(0, 200)}`);
      need(r.json.job && r.json.job.id, `响应里没有任务：${r.text.slice(0, 200)}`);
      JOB_IDS.add(r.json.job.id);
      need(r.json.brief.status === 'running', `出片后工单应立刻是 running，实际 ${r.json.brief.status}`);
      need(r.json.job.slug === 'engraving', `任务的 slug 不对：${r.json.job.slug}`);
      need(Array.isArray(r.json.job.opts) && r.json.job.opts[0] === '--skip-sync' && r.json.job.opts.includes('--dry-run'),
        `出片命令应是 <slug> --skip-sync <runOpts>，实际 ${JSON.stringify(r.json.job.opts)}`);
      need((r.json.warnings || []).some((w) => /contentRel 指向的文件不存在/.test(w)),
        `contentRel 指向不存在的文件时应给警告，实际 ${JSON.stringify(r.json.warnings)}`);

      // 再点一次 → running 不许重复启动
      const again = await post(`/api/briefs/${id}/run`, {});
      need(again.status === 409 && /正在出片/.test(again.json.error),
        `running 重复出片应 409，实际 ${again.status}：${again.text.slice(0, 160)}`);

      const fin = await waitBrief(get, id);
      need(fin, '工单在 180s 内没到终态');
      need(fin.status === 'done', `dry-run 应让工单变 done，实际 ${fin.status}（error=${fin.error || '无'}）`);
      need(fin.jobId === r.json.job.id, `工单记的 jobId 不对：${fin.jobId} vs ${r.json.job.id}`);
      need(fin.startedAt && fin.endedAt, 'done 的工单应该有 startedAt / endedAt');
      need(Number.isFinite(Date.parse(fin.endedAt) - Date.parse(fin.startedAt)), 'startedAt/endedAt 不是 ISO 时间');
      notes.push(`⑥ ${id}：ready → running（任务 ${r.json.job.id}）→ ${fin.status}，`
        + `耗时 ${((Date.parse(fin.endedAt) - Date.parse(fin.startedAt)) / 1000).toFixed(1)}s；`
        + `警告 ${JSON.stringify(r.json.warnings)}`);
    });

    // ══ ⑦ 失败与重试 ══════════════════════════════════════
    await runCase('⑦ failed 的工单要显式 retry:true 才能重出；非法 runOpts 在起任务前就 400', async () => {
      const { id } = await makeBrief(get, post, { topic: '失败与重试', slug: 'engraving' });
      const raw = readBriefFile(id);

      // 直接构造一张 failed 的工单（「出片失败」这条路本身要真跑一个坏任务才能走到，
      // 代价太大；这里验的是**状态机与校验**，收尾逻辑由 ⑥ 的真实任务覆盖）
      writeBriefFile(id, { ...raw, status: 'failed', error: '（测试构造）出片失败', endedAt: new Date().toISOString() });

      const a = await post(`/api/briefs/${id}/run`, {});
      need(a.status === 409, `failed 不带 retry 应 409，实际 ${a.status}：${a.text.slice(0, 160)}`);
      need(/retry/.test(a.json.error), `409 的说明应提示用 retry:true：${a.json.error}`);
      need(readBriefFile(id).status === 'failed', '被拒之后状态不该变');

      // 非法 runOpts → 400，且**不该起任务**（起任务前就拦下）
      writeBriefFile(id, { ...raw, status: 'ready', runOpts: ['--out; rm -rf /'] });
      const b = await post(`/api/briefs/${id}/run`, {});
      need(b.status === 400 && /非法字符/.test(b.json.error), `非法 runOpts 应 400，实际 ${b.status}：${b.text.slice(0, 160)}`);
      const mid = (await get('/api/briefs')).json.briefs.find((x) => x.id === id);
      need(!mid.jobId && mid.status === 'ready', `被拒的请求不该起任务 / 改状态，实际 ${mid.status} jobId=${mid.jobId}`);

      // 值型选项缺值也要拦
      writeBriefFile(id, { ...raw, status: 'ready', runOpts: ['--q'] });
      const c = await post(`/api/briefs/${id}/run`, {});
      need(c.status === 400 && /缺少值/.test(c.json.error), `--q 缺值应 400，实际 ${c.status}：${c.text.slice(0, 160)}`);

      // ★ 合法的重试路径：failed → ready（状态机允许），ready → failed 不允许
      writeBriefFile(id, { ...raw, status: 'failed', error: '（测试构造）出片失败' });
      const d = await patch(`/api/briefs/${id}`, { status: 'ready' });
      need(d.status === 200 && d.json.brief.status === 'ready', `failed→ready 应 200，实际 ${d.status}：${d.text.slice(0, 160)}`);
      need(d.json.brief.processedAt, '转 ready 时应自动补 processedAt');
      const e = await patch(`/api/briefs/${id}`, { status: 'failed' });
      need(e.status === 409, `ready→failed 应 409（不允许），实际 ${e.status}`);
      notes.push('⑦ failed 出片 409（提示 retry:true）/ 非法 runOpts 400（且没起任务）/ --q 缺值 400 / '
        + 'failed→ready 200（自动补 processedAt）/ ready→failed 409');
    });

    // ══ ⑧ processable（给外部 LLM 的素材包）════════════════
    await runCase('⑧ processable：pending 工单 + STYLE.md 全文 + 两个样例 + 真实路径', async () => {
      const { id } = await makeBrief(get, post, { topic: '咖啡的历史', slug: 'engraving' });
      const r = await get('/api/briefs/processable');
      need(r.status === 200, `processable 应 200，实际 ${r.status}`);
      const j = r.json;
      need(j.count >= 1, `至少该有 1 张 pending（刚建的 ${id}），实际 ${j.count}`);
      const mine = j.pending.find((b) => b.id === id);
      need(mine, `刚建的 pending 工单不在 pending[] 里：${JSON.stringify(j.pending).slice(0, 200)}`);
      need(mine.topic === '咖啡的历史' && mine.slug === 'engraving', `pending 条目的 topic/slug 不对：${JSON.stringify(mine)}`);
      need(mine.demoDir && fs.existsSync(mine.demoDir), `demoDir 不存在：${mine.demoDir}`);
      need(mine.briefFile && fs.existsSync(mine.briefFile), `briefFile 不存在：${mine.briefFile}`);

      const st = j.styles.find((s) => s.slug === 'engraving');
      need(st, 'styles 里没有 engraving');
      need(typeof st.styleMd === 'string' && st.styleMd.length > 3000,
        `STYLE.md 全文太短（${st.styleMd && st.styleMd.length}）—— 外部 LLM 拿不到风格不变量`);
      need(/Copperplate|铜版|engrav/i.test(st.styleMd), 'STYLE.md 内容不像 engraving 的风格说明');
      need(st.contentSample && typeof st.contentSample === 'object', 'contentSample 不是对象');
      need(st.contentKeys.includes('subject') && st.contentKeys.includes('title') && st.contentKeys.includes('voice'),
        `contentSample 的字段不像 engraving 的 content.json：${JSON.stringify(st.contentKeys)}`);
      need(Array.isArray(st.linesSample) && st.linesSample.length > 0, 'linesSample 不是非空数组');
      need(st.lineKeys.includes('id') && st.lineKeys.includes('text'), `linesSample 的字段不对：${JSON.stringify(st.lineKeys)}`);
      need(st.contentPath && fs.existsSync(st.contentPath), `contentPath 不存在：${st.contentPath}`);
      need(st.linesPath && fs.existsSync(st.linesPath), `linesPath 不存在：${st.linesPath}`);
      need(st.stylePath && fs.existsSync(st.stylePath), `stylePath 不存在：${st.stylePath}`);
      need(st.subjectField === 'subject', `engraving 的主体字段应是 subject，实际 ${st.subjectField}`);
      need(typeof st.subjectNote === 'string' && st.subjectNote.length > 20, 'subjectNote 太短（没说清什么能动、什么不能动）');
      need(Array.isArray(st.assetDirs) && st.assetDirs.length > 0, `assetDirs 空：${JSON.stringify(st.assetDirs)}`);

      need(j.howTo && Array.isArray(j.howTo.steps) && j.howTo.steps.length >= 5, 'howTo.steps 太少（外部 LLM 不知道该干什么）');
      need(j.howTo.writeBack && j.howTo.writeBack.body && j.howTo.writeBack.body.status === 'ready',
        'howTo.writeBack 没说清回写什么');
      need(/lemo-make\.mjs/.test(j.howTo.runCommand || ''), `howTo.runCommand 不对：${j.howTo.runCommand}`);

      // ★ 真实的风格差异：silkscreen-poster 没有 lines.json —— 接口必须如实说 hasLines=false，而不是编一份
      const sp = await get('/api/briefs/processable?slug=silkscreen-poster');
      need(sp.status === 200, `按 slug 查应 200，实际 ${sp.status}`);
      const s1 = sp.json.styles[0];
      need(s1.hasLines === false && s1.linesSample === null,
        `silkscreen-poster 没有 lines.json，应如实报 hasLines=false / linesSample=null，实际 ${s1.hasLines}/${JSON.stringify(s1.linesSample)}`);

      const bad = await get('/api/briefs/processable?slug=ascii-crt');
      need(bad.status === 400, `白名单外的 slug 查 processable 应 400，实际 ${bad.status}`);
      notes.push(`⑧ processable：pending ${j.count} 张 · engraving STYLE.md ${st.styleMd.length} 字 · `
        + `content 键 ${st.contentKeys.length} 个 · lines ${st.linesSample.length} 条 · howTo ${j.howTo.steps.length} 步；`
        + `silkscreen-poster hasLines=false（如实报告）`);
    });

    // ══ ⑨ 损坏降级（重启一次，证明服务照常起）+ 启动收敛 ═════
    await runCase('⑨ 坏工单不让服务起不来（降级跳过 + warn）；上次没跑完的 running 工单被收敛成 failed', async () => {
      const { id: goodId } = await makeBrief(get, post, { topic: '好的工单（用来对照）', slug: 'midcentury-toon' });
      const badId = 'bcorrupt-1';
      BRIEF_IDS.add(badId);
      fs.writeFileSync(path.join(BRIEFS_DIR, `${badId}.json`), '{ "id": "bcorrupt-1", "topic": ', 'utf8');

      // 再放一张 status=running 的工单：模拟「控制台被关掉时正在出片」——
      // 它的任务已经随控制台一起没了，启动时必须被收敛，否则 UI 上会永远挂一张不能删也不能重试的僵尸单。
      const stuck = await makeBrief(get, post, { topic: '上次没跑完的（模拟控制台被杀）', slug: 'engraving' });
      const raw = readBriefFile(stuck.id);
      writeBriefFile(stuck.id, { ...raw, status: 'running', jobId: 'jnonexistent-1', startedAt: new Date().toISOString() });

      // 重启：坏文件与 running 工单在**启动前**就存在 —— 这才是「不让服务起不来」的真检验
      const before = SERVER_OUT.length;
      await stopServer(server.child);
      const s2 = await startServer();
      server = s2;
      base = `http://127.0.0.1:${server.port}`;     // 端口会变，UI 那条用的是这个
      const g2 = (p) => httpRequest(server.port, 'GET', p);
      const up = await g2('/api/console');
      need(up.status === 200, `有坏工单时服务起不来（/api/console → ${up.status}）`);
      const list = await g2('/api/briefs');
      need(list.status === 200, `有坏工单时列表接口挂了：${list.status}`);
      need(!list.json.briefs.some((b) => b.id === badId), '损坏的工单没被跳过，竟然出现在列表里');
      need(list.json.briefs.some((b) => b.id === goodId), '好的工单被连累了（不该）');
      const tail = SERVER_OUT.slice(before);
      need(/损坏/.test(tail), `服务端没有 warn 说「损坏」：\n${tail.slice(-400)}`);
      need(/已跳过/.test(tail), `warn 里没说「已跳过」：\n${tail.slice(-400)}`);

      const st = list.json.briefs.find((b) => b.id === stuck.id);
      need(st, '那张 running 工单在重启后消失了？');
      need(st.status === 'failed', `重启后 running 工单应收敛成 failed，实际 ${st.status}`);
      need(/重启/.test(st.error || ''), `收敛时应写清原因（控制台重启），实际 error=${st.error}`);
      need(/启动收敛/.test(tail), `服务端日志应说明「启动收敛」：\n${tail.slice(-400)}`);
      notes.push(`⑨ 坏文件 ${badId}.json + running 工单 ${stuck.id} 同时存在时服务照常起（/api/console 200、列表 200）；`
        + `坏的被跳过 + warn，running 的被收敛成 failed（error=「${String(st.error).slice(0, 40)}…」）`);
    });

    // ══ ⑩ UI 锚点（无头 Edge dump-dom）═════════════════════
    await runCase('⑩ UI：主题输入框 / 风格下拉（只有 4 项）/ 工单列表 / 状态徽标 都在', async () => {
      need(edge, `找不到无头 Edge（${EDGE_CANDIDATES.join(' 或 ')}）`);
      // 保证页面上至少有一张 pending 工单 → 才验得到状态徽标
      // ★ 主题里故意塞 XSS 探针：它是**用户输入**，必须被转义成实体而不是变成真标签
      const { id } = await makeBrief(get, post, {
        topic: 'UI 锚点 <script>alert(1)</script> & "引号"',
        slug: 'engraving',
      });
      const dom = await dumpDom(edge, `${base}/`);

      need(dom.includes('id="briefCard"'), 'DOM 里没有主题出片卡片（#briefCard）');
      need(dom.includes('id="briefTopic"'), 'DOM 里没有主题输入框（#briefTopic）');
      need(dom.includes('id="btnBriefCreate"'), 'DOM 里没有「生成工单」按钮');
      need(dom.includes('id="briefs"'), 'DOM 里没有工单列表容器（#briefs）');
      need(dom.includes('id="btnRefreshBriefs"'), 'DOM 里没有「刷新」按钮');

      const sel = /<select id="briefSlug"[^>]*>([\s\S]*?)<\/select>/.exec(dom);
      need(sel, 'DOM 里找不到风格下拉 #briefSlug');
      const opts = [...sel[1].matchAll(/<option[^>]*value="([^"]+)"/g)].map((m) => m[1]);
      need(opts.length === 4, `风格下拉应有 4 项，实际 ${opts.length}：${JSON.stringify(opts)}`);
      assert.deepStrictEqual(opts, ['engraving', 'hologram-hud', 'midcentury-toon', 'silkscreen-poster'],
        `风格下拉不是那 4 个：${JSON.stringify(opts)}`);
      need(/铜版画/.test(sel[1]) && /科幻全息界面/.test(sel[1]), `下拉里没显示中文名：${sel[1].slice(0, 200)}`);

      need(dom.includes('class="brief '), 'DOM 里没有渲染出工单行（.brief）');
      need(/class="status pending"/.test(dom), 'DOM 里没有 pending 状态徽标');
      need(/等待|处理工单|复制主题/.test(dom), 'pending 工单没写出「去对话里处理」这条指引');

      // ★ 主题是用户输入 → 必须被转义（不能出现真的 <script>）
      need(!/<script>alert/.test(dom), '主题里的 <script> 没被转义（XSS！）');
      need(dom.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), '主题里的尖括号没被转义成实体');
      need(dom.includes('&amp;'), '主题里的 & 没被转义成 &amp;');
      notes.push(`⑩ dump-dom：4 项下拉 ${JSON.stringify(opts)}；.brief 行 + class="status pending" 都在；`
        + '主题里的 <script>/& 被转义成实体（无 XSS）');
    });

    // ══ ⑫ 容量上限（最多 200 张，超了裁最旧的）══════════════
    await runCase('⑪ 容量上限：超过 200 张时裁掉最旧的（正在出片的不裁）', async () => {
      const CAP = 200;
      // 直接在磁盘上铺 205 张（比走 205 次 HTTP 快得多；id 先登记再写盘，
      // 所以**即使这条用例中途失败，finally 也会把它们删干净**）
      const now = Date.now();
      for (let i = 0; i < CAP + 5; i++) {
        const id = `bfill-${i + 1}`;
        BRIEF_IDS.add(id);          // ★ 先登记，再写盘
        fs.writeFileSync(path.join(BRIEFS_DIR, `${id}.json`), JSON.stringify({
          id, topic: `容量测试第 ${i + 1} 张`, slug: 'engraving', status: 'pending',
          createdAt: new Date(now - (CAP + 5 - i) * 1000).toISOString(),   // 序号越大越新
          processedAt: null, contentRel: null, linesRel: null, runOpts: [], notes: '',
          jobId: null, startedAt: null, endedAt: null, error: null, film: null,
        }, null, 2), 'utf8');
      }
      // ★ 前面的用例（⑤⑥⑦⑧⑨⑩）在 finally 之前也会把工单留在目录里 ——
      //   所以这里**不能假设只有自己铺的这 205 张**。先按「裁剪前实际有几张」算出该裁几张，
      //   再用「接口返回的排序」直接对上（接口与裁剪用的是同一套 new→old 排序）。
      const beforePost = (await get('/api/briefs')).json.briefs.map((b) => b.id);   // 新 → 旧
      const total = beforePost.length;
      need(total >= CAP + 5, `铺完应该至少有 ${CAP + 5} 张，实际 ${total}`);

      // 再建一张（走 HTTP）→ 触发裁剪
      const { id: newest } = await makeBrief(get, post, { topic: '触发裁剪的那一张', slug: 'midcentury-toon' });
      const after = await get('/api/briefs');
      need(after.json.count === CAP, `裁完应恰好 ${CAP} 张，实际 ${after.json.count}`);
      need(after.json.briefs.some((b) => b.id === newest), '最新的那张被裁掉了（裁错方向了）');

      // 该裁的 = (裁剪前张数 + 新建的 1 张) - 上限；且必须是最旧的那么多张
      const expectTrim = total + 1 - CAP;
      need(expectTrim >= 6, `本次至少该裁 6 张，实际算出 ${expectTrim}（铺得不够？）`);
      const afterIds = new Set(after.json.briefs.map((b) => b.id));
      const actuallyGone = beforePost.filter((id) => !afterIds.has(id));      // 真的从列表里消失的
      const shouldBeGone = beforePost.slice(-expectTrim);                     // 按排序最旧的 expectTrim 张
      need(actuallyGone.length === expectTrim,
        `应裁 ${expectTrim} 张，实际裁了 ${actuallyGone.length} 张`);
      const missing = shouldBeGone.filter((id) => !actuallyGone.includes(id));
      need(missing.length === 0, `该裁的最旧那几张里，这几张没被裁：${JSON.stringify(missing.slice(0, 8))}`);
      // 连文件一起删掉（不是只从列表里藏起来）
      const stillOnDisk = actuallyGone.filter((id) => fs.existsSync(path.join(BRIEFS_DIR, `${id}.json`)));
      need(stillOnDisk.length === 0, `被裁的工单文件还在磁盘上：${JSON.stringify(stillOnDisk.slice(0, 8))}`);
      // 边界：被裁的那批里最新的那张要被裁、紧挨着它的「最旧幸存者」要留下
      const newestGone = beforePost[total - expectTrim];        // 被裁集合里最新的一张
      const oldestKept = beforePost[total - expectTrim - 1];    // 没被裁集合里最旧的一张
      need(afterIds.has(oldestKept),
        `边界后第一张（${oldestKept}）不该被裁掉（裁多了）`);
      need(!afterIds.has(newestGone), `边界上的那张（${newestGone}）该被裁掉（裁少了）`);
      notes.push(`⑪ 容量上限：裁剪前 ${total} 张（含前序用例留下的）+ 建 1 张 → 裁到恰好 ${CAP} 张，`
        + `裁掉最旧 ${expectTrim} 张（${shouldBeGone[shouldBeGone.length - 1]}…${newestGone}，文件一并删除），`
        + `边界后的 ${oldestKept} 保留`);
    });

    // ══ ⑬ 删除与收尾 ══════════════════════════════════════
    await runCase('⑫ 删除：200 且文件真的没了；再删 404', async () => {
      const { id } = await makeBrief(get, post, { topic: '删我', slug: 'engraving' });
      const r = await del('/api/briefs/' + encodeURIComponent(id));
      need(r.status === 200 && r.json.ok === true, `删除应 200，实际 ${r.status}：${r.text.slice(0, 120)}`);
      need(!fs.existsSync(path.join(BRIEFS_DIR, `${id}.json`)), '删除后文件还在');
      BRIEF_IDS.delete(id);
      const again = await del('/api/briefs/' + encodeURIComponent(id));
      need(again.status === 404, `再删应 404，实际 ${again.status}`);
      notes.push('⑫ 删除 200（文件真的删了）/ 再删 404');
    });

    // ══ ⑬ 控制台出片必须写进独立输出目录（不碰样板片）═══════
    //
    // ★ 这条钉的是一个**真发生过的覆盖事故**：控制台起任务时从不传 `--out`
    //   （server.mjs:1675 只拼 `--skip-sync <runOpts>`），而编排器
    //   `lemo-make.mjs` 的 `outDir = o.out || <exportDir>\<slug>` ⇒ 成片直写**样板片路径**，
    //   把样板片覆盖掉（实测 art-deco 的样板片被覆盖成 9:16）。
    //   ⇒ 现在 lib/jobs.mjs 在**最靠近 spawn 的那一处**（buildOrchArgs）注入 `--out <exportDir>\_jobs\<任务id>`。
    // ★ 两层断言：① 命令行拼装（纯函数，廉价）；② 真走一次控制台「主题出片」入口（--dry-run，不渲染），
    //   断言接口回给 UI 的 outDir 就落在 `_jobs\<任务id>` —— 证明「注入」真的接在了控制台那条路上。
    await runCase('⑬ 控制台出片：注入 --out 到 _jobs\\<任务id>（绝不写样板片；用户自带 --out 不被覆盖）', async () => {
      const jobs = await import('../lib/jobs.mjs');
      const SAMPLE = path.join(CFG.exportDir, 'dataviz');        // 样板片目录 D:\lemo-films\dataviz
      const id = 'jtest-1';

      // ① 命令行拼装：真正 spawn 给编排器的 argv 就是它拼的
      const args = jobs.buildOrchArgs('dataviz', ['--skip-sync', '--ratio', '9:16'], id);
      const i = args.indexOf('--out');
      need(i >= 0, `控制台出片的 argv 必须带 --out（否则会直写样板片路径）：${JSON.stringify(args)}`);
      const out = args[i + 1];
      const want = path.join(CFG.exportDir, '_jobs', id);
      need(path.isAbsolute(out), `--out 必须是绝对路径：${JSON.stringify(out)}`);
      need(path.resolve(out) === path.resolve(want), `--out 应指向 ${want}，实际 ${out}`);
      need(path.resolve(out) !== path.resolve(SAMPLE)
        && !path.resolve(out).startsWith(path.resolve(SAMPLE) + path.sep),
        `--out 绝不能落在样板片目录 ${SAMPLE} 里（那正是被覆盖的那个 bug）`);
      need(args.filter((a) => a === '--out').length === 1, `--out 只该出现一次：${JSON.stringify(args)}`);

      // ★ 用户显式填了 --out → 必须**原样尊重**（保持既有自由度，绝不覆盖/追加）
      const mine = ['--skip-sync', '--out', 'D:\\my-own-out'];
      need(JSON.stringify(jobs.buildOrchArgs('dataviz', mine, id).slice(2)) === JSON.stringify(mine),
        `用户自带的 --out 被改动了：${JSON.stringify(jobs.buildOrchArgs('dataviz', mine, id))}`);

      // ② 端到端：真走控制台「主题出片」入口（--dry-run ⇒ 不渲染、不混流，秒级完成）
      const { id: bid } = await makeBrief(get, post, { topic: '出片输出目录', slug: 'engraving' });
      const raw = readBriefFile(bid);
      writeBriefFile(bid, { ...raw, status: 'ready', runOpts: ['--dry-run'] });
      const r = await post(`/api/briefs/${bid}/run`, {});
      need(r.status === 200 && r.json.job && r.json.job.id, `出片应 200 且带任务：${r.text.slice(0, 200)}`);
      const jobId = r.json.job.id;
      JOB_IDS.add(jobId);
      const wantJob = path.join(CFG.exportDir, '_jobs', jobId);
      need(r.json.job.outDir === wantJob,
        `控制台出片的 outDir 应是 ${wantJob}，实际 ${r.json.job.outDir}`);
      need(!String(r.json.job.outDir).startsWith(path.join(CFG.exportDir, 'engraving')),
        `outDir 落在样板片目录里了：${r.json.job.outDir}`);

      await waitBrief(get, bid);        // 等它跑完，别留一条「运行中」的任务给收尾
      notes.push(`⑬ buildOrchArgs → --out ${out}（≠ 样板片 ${SAMPLE}）；`
        + `用户自带 --out 原样保留；控制台出片任务 ${jobId} 的 outDir=${r.json.job.outDir}`);
    });

    // ══ ⑮ --ratio 的判据（值含 `:`；与 /api/eta 同源）══════
    await runCase('⑮ --ratio 的取值：/api/run 收 9:16 等预设比例，危险/非比例取值仍拒；/api/eta 同一处判据', async () => {
      const briefs = await import('../lib/briefs.mjs');

      // ① 纯函数层：库侧 RATIOS 全收（改前 `:` 不在 OPT_RE 白名单里 ⇒ 全被「非法字符」拒）
      const RATIOS = ['9:16', '16:9', '3:4', '4:3', '1:1'];
      for (const r of RATIOS) {
        const v = briefs.validateOpts(['--ratio', r], 'opts');
        need(v.ok, `--ratio ${r} 应该收，实际被拒：${v.error}`);
      }
      // 混在别的选项里也要收（值位判据不能把相邻 token 带坏）
      need(briefs.validateOpts(['--skip-sync', '--ratio', '9:16'], 'opts').ok, '--ratio 9:16 与其它选项混用时应收');

      // ② 反向：判据**没被放宽** —— 字符白名单原样（shell 元字符/空白/引号/反斜杠/非 ASCII 全拒），
      //    而且 --ratio 的值改用**更严**的语义判据（字符合法但不是比例 ⇒ 拒）。
      const mustReject = [
        [['--out; rm -rf /'], /非法字符/, 'shell 元字符 + 空格'],
        [['--q', '$(whoami)'], /非法字符/, '命令替换'],
        [['--film', 'film`id`'], /非法字符/, '反引号'],
        [['--out', 'D:\\mine'], /非法字符/, '反斜杠（既有行为，未放宽）'],
        [['--ratio', '99:99'], /取值非法/, '字符都合法但不是比例（比字符白名单更严）'],
        [['--ratio', '1081x1920'], /取值非法/, '奇数边'],
        [['--ratio', '64x64'], /取值非法/, '低于库侧 MIN_SIZE'],
        [['--ratio'], /缺少值/, '值缺失仍报「缺少值」（没被新判据抢错）'],
      ];
      for (const [opts, re, why] of mustReject) {
        const v = briefs.validateOpts(opts, 'opts');
        need(!v.ok && re.test(v.error), `${why} 应被拒且命中 ${re}，实际 ${JSON.stringify(v)}`);
      }

      // ③ 真服务：POST /api/run 收 `--ratio 9:16`（上一轮就是在这里被拒，只能回退 --size 1080x1920）
      const okRun = await post('/api/run', { slug: 'engraving', opts: ['--ratio', '9:16', '--dry-run'] });
      need(okRun.status === 200 && okRun.json.job, `--ratio 9:16 应被 /api/run 收下，实际 ${okRun.status}：${okRun.text.slice(0, 200)}`);
      const jid = okRun.json.job.id;
      JOB_IDS.add(jid);
      need(okRun.json.job.opts.includes('--ratio') && okRun.json.job.opts.includes('9:16'),
        `任务 opts 里应原样带着 --ratio 9:16，实际 ${JSON.stringify(okRun.json.job.opts)}`);

      // 真服务：危险 / 非比例的取值仍 400
      const badRun = await post('/api/run', { slug: 'engraving', opts: ['--out; rm -rf /'] });
      need(badRun.status === 400 && /非法字符/.test(badRun.json.error),
        `危险 opts 应 400，实际 ${badRun.status}：${badRun.text.slice(0, 160)}`);
      const badRatio = await post('/api/run', { slug: 'engraving', opts: ['--ratio', '99:99'] });
      need(badRatio.status === 400 && /取值非法/.test(badRatio.json.error),
        `--ratio 99:99 应 400，实际 ${badRatio.status}：${badRatio.text.slice(0, 160)}`);

      // ④ /api/eta 原先自己抄了一份正则（同样缺 `:`）⇒ 同一串选项在 /run 与 /eta 两处判据不一致。
      //    现在它复用 validateOpts：`--ratio 9:16` 收、`; rm -rf /` 拒。
      const etaOk = await get('/api/eta?slug=engraving&opt=--ratio&opt=9%3A16');
      need(etaOk.status === 200, `--ratio 9:16 应被 /api/eta 收下，实际 ${etaOk.status}：${etaOk.text.slice(0, 160)}`);
      const etaBad = await get('/api/eta?slug=engraving&opt=' + encodeURIComponent('; rm -rf /'));
      need(etaBad.status === 400, `危险 opt 应被 /api/eta 拒，实际 ${etaBad.status}`);

      // 别留一条「运行中」的任务给收尾（dry-run 秒级）
      const t0 = Date.now();
      while (Date.now() - t0 < 120000) {
        const j = ((await get('/api/jobs')).json.jobs || []).find((x) => x.id === jid);
        if (j && ['done', 'failed', 'canceled'].includes(j.status)) break;
        await sleep(600);
      }
      notes.push(`⑮ 5 个预设比例全收（含 9:16，任务 ${jid}）；危险/非比例取值仍拒（4 类字符 + 3 类语义 + 缺值）；`
        + '/api/eta 与 /api/run 现在同一处判据');
    });

    // ══ ⑯ filmUrl 指向本次任务的产物（不是样板片）══════════
    await runCase('⑯ filmUrl：job 产物 → /api/films/_jobs/<任务id>/（能 GET 到）；产物不在 _jobs → 退回样板片拼法', async () => {
      const SAMPLE_SLUG = 'engraving';
      const SAMPLE_FILE = `${SAMPLE_SLUG}.mp4`;
      const jobId = `jtest-filmurl-${Date.now().toString(36)}`;
      const jobDir = path.join(CFG.exportDir, '_jobs', jobId);
      const jobFilm = path.join(jobDir, SAMPLE_FILE);
      // 假产物字节：只验路由发的是**这个文件**（不验能不能解码）
      const BYTES = Buffer.from('FAKE-MP4-JOB-PRODUCT-' + jobId, 'utf8');

      try {
        fs.mkdirSync(jobDir, { recursive: true });
        TMP_ROOTS.add(jobDir);            // 万一中途失败，收尾也会删掉（TMP_ROOTS 递归删）
        fs.writeFileSync(jobFilm, BYTES);

        // ① 工单指向 job 产物（status=done + jobId + film=<slug>.mp4）⇒ filmUrl 必须是 _jobs 路由
        const { id: bid } = await makeBrief(get, post, { topic: '成片 URL 指向产物', slug: SAMPLE_SLUG });
        const raw = readBriefFile(bid);
        writeBriefFile(bid, {
          ...raw, status: 'done', film: SAMPLE_FILE, jobId,
          startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
        });
        const got = await get('/api/briefs/' + encodeURIComponent(bid));
        need(got.status === 200, `读工单应 200，实际 ${got.status}`);
        const want = `/api/films/_jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(SAMPLE_FILE)}`;
        need(got.json.brief.filmUrl === want,
          `filmUrl 应指向本次任务产物 ${want}，实际 ${got.json.brief.filmUrl}`);
        // ★ 旧拼法（样板片路由）绝不能出现 —— 那正是「打开样板片而不是本次产物」的缺陷
        need(!/^\/api\/films\/[^/]+\/[^/]+$/.test(got.json.brief.filmUrl),
          `filmUrl 退回了样板片拼法：${got.json.brief.filmUrl}`);

        // ② 真 GET 它：必须 200，且发回的正是那个假产物文件的字节
        const film = await get(got.json.brief.filmUrl);
        need(film.status === 200, `GET ${got.json.brief.filmUrl} 应 200，实际 ${film.status}：${film.text.slice(0, 160)}`);
        need(Buffer.from(film.text, 'utf8').equals(BYTES),
          `GET 到的字节不是该产物：${film.text.length} 字节`);

        // ③ 反向：产物**不在** _jobs 下（= 样板片；`--dry-run` / 产物被清理时 findFilm 就是这条路）
        //    ⇒ 必须退回旧拼法，调用方照旧能播样板片（向后兼容）。
        const { id: bid2 } = await makeBrief(get, post, { topic: '成片 URL 退回样板片', slug: SAMPLE_SLUG });
        const raw2 = readBriefFile(bid2);
        writeBriefFile(bid2, {
          ...raw2, status: 'done', film: SAMPLE_FILE, jobId: 'jtest-filmurl-none',
          startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
        });
        const got2 = await get('/api/briefs/' + encodeURIComponent(bid2));
        const want2 = `/api/films/${encodeURIComponent(SAMPLE_SLUG)}/${encodeURIComponent(SAMPLE_FILE)}`;
        need(got2.json.brief.filmUrl === want2,
          `产物不在 _jobs 下时应退回样板片拼法 ${want2}，实际 ${got2.json.brief.filmUrl}`);

        notes.push(`⑯ job 产物 → ${want}（GET 200，${BYTES.length} 字节一致）；`
          + `产物不在 _jobs → ${want2}（退回样板片，向后兼容）`);
      } finally {
        // 按**确切路径**删自己造的东西（不碰 _jobs 下别人的产物）
        try { fs.unlinkSync(jobFilm); } catch { /* 没有就算了 */ }
        try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch { /* 没有就算了 */ }
        TMP_ROOTS.delete(jobDir);
      }
    });
  } finally {
    // ── 收尾 ──
    if (server && !OPT.keepServer) { await stopServer(server.child); log(C.dim(`  测试服务已停止（pid ${server.child.pid}）`)); }

    for (const [f, buf] of backup) {
      try {
        if (buf === null) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
        else fs.writeFileSync(f, buf);
      } catch (e) { log(C.bad(`  ⚠️ 固定入口还原失败：${path.basename(f)}（${e.message}）`)); }
    }
    log(C.dim(`  固定入口已还原：${ENTRY_FILES.map((f) => path.basename(f)).join(' · ')}`));

    try {
      await sleep(700);                       // 等测试服务的 persistSoon 去抖走完再摘任务
      const rep = cleanupJobs();
      if (rep.removed.length) log(C.dim(`  测试任务已清理：${rep.removed.join(', ')}`));
      if (rep.errors.length) log(C.bad(`  ⚠️ 测试任务清理失败：${rep.errors.join('；')}`));
    } catch (e) { log(C.bad(`  ⚠️ 测试任务清理异常：${e.message}`)); }

    const pending = [...BRIEF_IDS];        // ★ 先留一份：cleanupBriefs() 会清空它
    cleanupBriefs();
    const left = fs.existsSync(BRIEFS_DIR) ? fs.readdirSync(BRIEFS_DIR) : [];
    const leaked = left.filter((n) => pending.some((id) => n.startsWith(id)));
    log(C.dim(`  测试工单已清理（${pending.length} 张）；工单目录剩余 ${left.length} 个文件`
      + `${left.length ? `：${left.slice(0, 8).join(', ')}${left.length > 8 ? ' …' : ''}` : ''}`));
    if (leaked.length) log(C.bad(`  ⚠️ 疑似残留：${leaked.join(', ')}`));

    // ★ 把「既有工单」原样写回（见 briefsPreexisting 的说明）。
    //   只补**本套件不该动**的那些：跑前就存在、且现在要么没了、要么字节被改过（⑪ 的容量裁剪会删、
    //   启动收敛会把 running 改成 failed）。本套件自己造的工单不在此列 —— 它们由 cleanupBriefs() 删。
    {
      const touched = [];
      for (const [name, buf] of briefsPreexisting) {
        const dst = path.join(BRIEFS_DIR, name);
        try {
          let cur = null;
          try { cur = fs.readFileSync(dst); } catch { /* 被裁掉了 */ }
          if (cur && cur.equals(buf)) continue;      // 原封不动，别碰
          fs.writeFileSync(dst, buf);
          touched.push(name);
        } catch (e) {
          log(C.bad(`  ⚠️ 既有工单 ${name} 还原失败：${e.message}`));
        }
      }
      if (touched.length) {
        log(C.dim(`  既有工单已还原 ${touched.length} 个（跑中被容量裁剪/启动收敛动过）：${touched.join(', ')}`));
        notes.push(`⑭ 备注：跑中被容量裁剪/启动收敛动过的既有工单 ${touched.length} 个已原样写回：${touched.join(', ')}`);
      }
    }

    const tmpErr = cleanupTmpDirs();
    if (tmpErr.length) log(C.bad(`  ⚠️ 临时目录清理失败：${tmpErr.join('；')}`));
  }

  // ── 最后一道闸：工单目录必须与跑前逐字一致（不留垃圾）──
  {
    const after = fs.existsSync(BRIEFS_DIR) ? fs.readdirSync(BRIEFS_DIR).sort() : [];
    const added = after.filter((n) => !briefsBefore.includes(n));
    const gone = briefsBefore.filter((n) => !after.includes(n));
    const name = '⑭ 无残留：工单目录跑完与跑前逐字一致（测试工单全删净）';
    if (added.length || gone.length) {
      results.push({ name, ok: false, ms: 0, err: new Error(`新增 ${JSON.stringify(added)}；丢失 ${JSON.stringify(gone)}`) });
      log(`  ${C.bad('FAIL')}  ${name}`);
      if (added.length) log(`        新增：${added.join(', ')}`);
      if (gone.length) log(`        丢失：${gone.join(', ')}`);
    } else {
      results.push({ name, ok: true, ms: 0 });
      log(`  ${C.ok('PASS')}  ${name} ${C.dim(`(${after.length} 个文件，与跑前一致)`)}`);
      notes.push(`⑭ 跑前/跑后工单目录都是 ${after.length} 个文件，逐字一致（测试工单全删净）`);
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
