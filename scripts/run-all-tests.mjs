#!/usr/bin/env node
/**
 * scripts/run-all-tests.mjs —— 「全套测试入口」跑器（★ 工具，**不是闸门**）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 为什么有它（2026-10-11）
 * ══════════════════════════════════════════════════════════════════════════════
 *   本仓的质量防线是**两层**：
 *     ① `scripts/check-*.mjs`（52 个闸门）—— 一直有全跑，每次报「52/52 绿」；
 *     ② `test/*.test.mjs`（36 个测试入口）—— ★★ 此前**从未一次性全跑过**，
 *        每次都只跑「受影响的几个」+ `test/smoke.mjs`。
 *   **实测代价**：主控**第一次**把 32 个入口全跑 ⇒ **31 绿 / 1 红**：
 *   `test/gate-blindness.test.mjs` 报 **133 passed / 7 failed** —— 一处**潜伏了 3 批**的真回归
 *   （第 11 批把 9 个闸门的剥注释器抽成 `lib/js-scan.mjs` 后，该测试的**自证段夹具**没带上这个
 *   新模块 ⇒ 子进程 `ERR_MODULE_NOT_FOUND` ⇒ 7 条自证全废）。
 *   ⇒ 本跑器把「跑全套」从**靠人记得**变成**一条命令**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 它**不是闸门**（如实说明）
 * ══════════════════════════════════════════════════════════════════════════════
 *   它**不判 FAIL/OK**、没有「判据①②③」、没有失明守卫 —— 它只**跑 + 记账**。
 *   `check-gate-self-claims.mjs` 只扫 `scripts/check-*.mjs`，**不扫本文件**；本文件也**故意**
 *   不写「闸门自陈」式的头注释（不写「退出码 = 闸门判据」那一套）—— 它不是闸门。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 功能
 * ══════════════════════════════════════════════════════════════════════════════
 *   **串行**跑 `test/*.test.mjs` 下**每一个**入口，逐个记录**退出码 / passed / failed / 耗时**，
 *   最后打**总账**（入口数 / 全绿 / 失败 / 实测总条数 / 总耗时），失败入口**点名**。
 *
 * ★★ 为什么**必须串行**：`ui` / `smoke` / `review` / `stills-only` / `readcheck-probe` 会起
 *   无头浏览器、抢端口、打 `D:/lemo-films/.ascii-crt.lock` —— 并行会互撞（假红）。
 *
 * ★★ 陈旧并发锁的处理：若某入口报「已有另一个 lemo-make 在跑同一个 demo」⇒
 *   ① 用 `tasklist /FI "PID eq <pid>"` 确认那个 pid 是否还活着；
 *   ② **已死** ⇒ 按编排器自己给的处置指引（报错里写着「确认它已死掉后删掉这个文件再重试」）
 *      删锁并**重试该入口一次**（每步打日志说清「删了哪个锁、为什么」）；
 *   ③ **还活着** ⇒ 等它（轮询；有上限，超时则记失败）。
 *
 * ★ 条数兼容两种口径：`N passed, M failed`（自带汇总的套件）与 TAP 的 `# pass N / # fail M`
 *   （`node:test` 类）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 用法
 * ══════════════════════════════════════════════════════════════════════════════
 *   node scripts/run-all-tests.mjs                    # 全套（test/*.test.mjs，约 7 分钟）
 *   node scripts/run-all-tests.mjs --filter dub       # 只跑文件名含 "dub" 的入口
 *   node scripts/run-all-tests.mjs --json <路径>      # 额外落一份机器可读汇总（JSON）
 *   node scripts/run-all-tests.mjs --timeout 300000   # 单入口超时（ms；默认 0 = 不限）
 *   node scripts/run-all-tests.mjs --with-smoke       # 额外纳入 test/smoke.mjs（它**不是** *.test.mjs）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 覆盖点（与既有闸门同名同义，便于在临时树上跑）
 * ══════════════════════════════════════════════════════════════════════════════
 *   LEMO_TOOLS_ROOT  工具仓根（默认 `<脚本>/..`）—— 入口 = `<LEMO_TOOLS_ROOT>/test/*.test.mjs`
 *   LEMO_TMP         临时根（默认 `D:/lemo-tmp`）—— 每次运行的逐入口日志落这里；
 *                    ★ 解析到 C 盘**直接炸**（本项目硬规则：产物/缓存非 C 盘）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 退出码（工具语义，**非闸门判据**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   0 = 全部入口绿（退出码 0 且无 failed）；
 *   1 = 有入口失败（非零退出码 / failed>0 / 未解析到条数且非零退出 / 等锁超时）；
 *   2 = 前置不可用（`test/` 读不到、扫到 0 个入口、或 `--filter` 没匹配到任何入口）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
const TEST_DIR = path.join(ROOT, 'test');
const TMP_ROOT = path.resolve(process.env.LEMO_TMP || 'D:/lemo-tmp');
// ★ 本项目硬规则：临时/产物非 C 盘 —— 解析到 C 盘直接炸，绝不静默往 C 盘拉屎。
if (/^[cC]:[\\/]/.test(TMP_ROOT)) {
  console.error(`✘ LEMO_TMP 解析到 C 盘（${TMP_ROOT}）—— 本项目硬规则：临时/产物非 C 盘。请设 LEMO_TMP 到非 C 盘。`);
  process.exit(2);
}

// ── 开关 ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const FILTER = opt('--filter') || '';
const JSON_OUT = opt('--json');
const TIMEOUT = Math.max(0, Number(opt('--timeout') || 0) || 0);
const WITH_SMOKE = args.includes('--with-smoke');
const WAIT_MS = Math.max(0, Number(opt('--wait') || 0) || 10 * 60 * 1000);   // 「还活着 ⇒ 等它」的上限（默认 10 分钟）

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);   // 例：20261011070909
const RUN_DIR = path.join(TMP_ROOT, 'run-all-tests', stamp);
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ── 入口枚举 ─────────────────────────────────────────────────────────────────
let entries;
try {
  entries = fs.readdirSync(TEST_DIR).filter((f) => /\.test\.mjs$/.test(f)).sort();
} catch (e) {
  console.error(`✘ 读不到测试目录 ${TEST_DIR}：${e.message}`);
  process.exit(2);
}
// ★ `test/smoke.mjs` **不是** `*.test.mjs` ⇒ 默认不入列（任务定义：36 个入口 = `test/*.test.mjs`）。
//   它一直是「每次必跑」的冒烟入口，需要时用 `--with-smoke` 一并纳入。
if (WITH_SMOKE && fs.existsSync(path.join(TEST_DIR, 'smoke.mjs'))) entries.push('smoke.mjs');
if (FILTER) entries = entries.filter((f) => f.includes(FILTER));
if (entries.length === 0) {
  console.error(FILTER
    ? `✘ --filter "${FILTER}" 没匹配到任何 test/*.test.mjs 入口`
    : `✘ ${TEST_DIR} 下扫到 0 个 *.test.mjs 入口（目录不存在 / 枚举为空？）`);
  process.exit(2);
}

// ── 条数解析（兼容两种口径）──────────────────────────────────────────────────
/** 返回 { passed, failed, form }；解析不到 ⇒ passed/failed = null、form='unknown'。 */
function parseCounts(text) {
  // 口径①：自带汇总的套件 —— `N passed, M failed`（取**最后**一处，避开源码里两条分支字符串）
  const sum = [...text.matchAll(/(\d+)\s+passed,\s*(\d+)\s+failed/g)];
  if (sum.length) {
    const m = sum[sum.length - 1];
    return { passed: Number(m[1]), failed: Number(m[2]), form: 'summary' };
  }
  // 口径②：TAP（`node:test` 类）—— `# pass N` / `# fail M`
  const pass = [...text.matchAll(/^#\s*pass\s+(\d+)\s*$/gm)];
  const fail = [...text.matchAll(/^#\s*fail\s+(\d+)\s*$/gm)];
  if (pass.length || fail.length) {
    return {
      passed: pass.length ? Number(pass[pass.length - 1][1]) : 0,
      failed: fail.length ? Number(fail[fail.length - 1][1]) : 0,
      form: 'tap',
    };
  }
  return { passed: null, failed: null, form: 'unknown' };
}

// ── 跑一个入口（异步 spawn —— 本机 spawnSync/execFileSync 一律 EBUSY）─────────
function runEntry(name) {
  const abs = path.join(TEST_DIR, name);
  const t0 = Date.now();
  return new Promise((resolve) => {
    let out = '';
    let timer = null;
    const child = spawn(process.execPath, [abs], { cwd: ROOT, env: process.env, windowsHide: true });
    if (TIMEOUT > 0) timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* 已退出 */ } }, TIMEOUT);
    const done = (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, out, ms: Date.now() - t0 });
    };
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (e) => { out += `\n[runner] spawn 失败：${e.message}\n`; done(-1); });
    child.on('close', (code) => done(code === null ? -1 : code));
  });
}

// ── 陈旧/并发锁 ──────────────────────────────────────────────────────────────
const LOCK_MSG = '已有另一个 lemo-make 在跑同一个 demo';

function extractPid(text) {
  const m = text.match(/已有另一个 lemo-make 在跑同一个 demo（pid (\d+)/);
  return m ? Number(m[1]) : null;
}
/** 编排器文案：…「确认它已死掉后删掉这个文件再重试：」\n  <path>；兜底 = 输出里最后一个 *.lock 路径。 */
function extractLockPath(text) {
  const m = text.match(/再重试[：:]\s*\n\s*(\S+)/);
  if (m) return m[1].replace(/[，。；;,、)）】\]"'`]+$/, '');
  const all = [...text.matchAll(/([A-Za-z]:[\\/][^\s"'`]*\.lock|[^\s"'`]*\.lock)/g)].map((x) => x[1]);
  return all.length ? all[all.length - 1] : null;
}
/** pid 是否还活着：`tasklist /FI "PID eq <pid>"` 为主，`process.kill(pid,0)` 兜底。 */
function pidAlive(pid) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    const fallback = () => { try { process.kill(pid, 0); finish(true); } catch (e) { finish(e.code === 'EPERM'); } };
    let out = '';
    let c;
    try {
      c = spawn('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { windowsHide: true });
    } catch { fallback(); return; }
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { out += d; });
    c.on('error', () => fallback());
    c.on('close', () => {
      const alive = out.split(/\r?\n/).some((l) => {
        const t = l.trim();
        if (!t || /^(信息|INFO)/i.test(t)) return false;          // 「没有运行的任务…」= 已死
        return new RegExp(`(^|\\s)${pid}(\\s|$)`).test(t);
      });
      if (alive) finish(true); else fallback();
    });
  });
}

/** 按编排器处置指引处理陈旧锁。返回 { retried: boolean }。 */
async function handleStaleLock(name, res) {
  const pid = extractPid(res.out);
  const lockPath = extractLockPath(res.out);
  console.log(`  ⚠ ${name} 报「${LOCK_MSG}」⇒ 并发/陈旧锁：${lockPath || '(未解析到路径)'}（pid ${pid ?? '?'}）`);

  if (pid == null) {
    console.log('  ✘ 输出里没解析到 pid ⇒ 无法确认持有者死活，**保守不删**、不重试（人工确认）');
    return { retried: false };
  }
  let alive = await pidAlive(pid);
  if (alive) {
    console.log(`  ⏳ pid ${pid} 仍活着 ⇒ 等它结束（每 3s 轮询，上限 ${Math.round(WAIT_MS / 1000)}s）…`);
    const t0 = Date.now();
    while (alive && Date.now() - t0 < WAIT_MS) { await sleep(3000); alive = await pidAlive(pid); }
    if (alive) { console.log(`  ✘ 等锁超时（持有者 pid ${pid} 仍活着）⇒ 放弃重试，本入口记失败`); return { retried: false }; }
    console.log(`  ✓ pid ${pid} 已退出（等了 ${Math.round((Date.now() - t0) / 1000)}s）`);
  } else {
    console.log(`  ✓ pid ${pid} 已死（tasklist 未找到该进程）`);
  }
  if (!lockPath) { console.log('  ℹ 没解析到锁文件路径 ⇒ 不删、不重试'); return { retried: false }; }
  if (!fs.existsSync(lockPath)) { console.log(`  ℹ 锁文件已不在：${lockPath} ⇒ 直接重试`); return { retried: true }; }
  try {
    fs.unlinkSync(lockPath);
    console.log(`  🗑 删掉陈旧锁 ${lockPath} —— 理由：持有者 pid ${pid} 已死，按编排器处置指引「确认它已死掉后删掉这个文件再重试」`);
  } catch (e) {
    console.log(`  ✘ 删锁失败（${e.message}）⇒ 不重试`);
    return { retried: false };
  }
  return { retried: true };
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
fs.mkdirSync(RUN_DIR, { recursive: true });

console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log(`  全套测试入口跑器（串行）——  ${entries.length} 个入口`);
console.log(`  仓根   ${ROOT}`);
console.log(`  日志   ${RUN_DIR}`);
console.log(`  开关   filter=${FILTER || '(无)'}  json=${JSON_OUT || '(无)'}  timeout=${TIMEOUT || '不限'}  with-smoke=${WITH_SMOKE}`);
console.log('════════════════════════════════════════════════════════════════');

const records = [];
const t0 = Date.now();
for (let i = 0; i < entries.length; i++) {
  const name = entries[i];
  console.log('');
  console.log(`▶ [${i + 1}/${entries.length}] test/${name}`);
  let res = await runEntry(name);
  let counts = parseCounts(res.out);
  let retried = false;

  if (res.code !== 0 && res.out.includes(LOCK_MSG)) {
    const h = await handleStaleLock(name, res);
    if (h.retried) {
      console.log(`  ↻ 重试 test/${name} …`);
      res = await runEntry(name);
      counts = parseCounts(res.out);
      retried = true;
    }
  }

  const logPath = path.join(RUN_DIR, `${name}.log`);
  try { fs.writeFileSync(logPath, res.out, 'utf8'); } catch { /* 日志写不下不影响结论 */ }

  const red = res.code !== 0 || (counts.failed != null && counts.failed > 0);
  const cnt = counts.passed == null ? `条数未解析(${counts.form})` : `${counts.passed} passed, ${counts.failed} failed`;
  console.log(`  ${red ? '✘' : '✓'} ${name}  exit ${res.code}  ${cnt}  (${(res.ms / 1000).toFixed(1)}s)${retried ? '  [已重试一次]' : ''}`);
  records.push({ name, code: res.code, passed: counts.passed, failed: counts.failed, form: counts.form, ms: res.ms, retried, red, logPath });
}

const totalMs = Date.now() - t0;
const failedEntries = records.filter((r) => r.red);
const passedSum = records.reduce((a, r) => a + (r.passed || 0), 0);
const failedSum = records.reduce((a, r) => a + (r.failed || 0), 0);
const unparsed = records.filter((r) => r.passed == null);

// ── 总账 ─────────────────────────────────────────────────────────────────────
console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log('  总账');
console.log('════════════════════════════════════════════════════════════════');
console.log(`  入口数       ${records.length}`);
console.log(`  全绿         ${records.length - failedEntries.length}`);
console.log(`  失败         ${failedEntries.length}`);
console.log(`  实测总条数   ${passedSum} passed / ${failedSum} failed${unparsed.length ? `（${unparsed.length} 个入口条数未解析）` : ''}`);
console.log(`  总耗时       ${(totalMs / 1000).toFixed(1)}s`);
console.log(`  逐入口日志   ${RUN_DIR}`);
if (failedEntries.length) {
  console.log('');
  console.log('  ✘ 失败入口（点名）：');
  for (const r of failedEntries) {
    const cnt = r.passed == null ? `条数未解析(${r.form})` : `${r.passed} passed, ${r.failed} failed`;
    console.log(`    - test/${r.name}  exit ${r.code}  ${cnt}${r.retried ? '  [已重试一次]' : ''}`);
  }
}
console.log('════════════════════════════════════════════════════════════════');
console.log('');

// ── 机器可读汇总（--json）─────────────────────────────────────────────────────
if (JSON_OUT) {
  const summary = {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    runDir: RUN_DIR,
    filter: FILTER || null,
    withSmoke: WITH_SMOKE,
    totals: {
      entries: records.length,
      green: records.length - failedEntries.length,
      failed: failedEntries.length,
      passed: passedSum,
      failedCases: failedSum,
      unparsed: unparsed.length,
      ms: totalMs,
    },
    entries: records.map((r) => ({
      name: `test/${r.name}`,
      code: r.code,
      passed: r.passed,
      failed: r.failed,
      form: r.form,
      ms: r.ms,
      retried: r.retried,
      status: r.red ? 'FAIL' : 'OK',
      log: r.logPath,
    })),
  };
  const jsonPath = path.resolve(JSON_OUT);
  try {
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
    console.log(`  ℹ JSON 汇总已落：${jsonPath}`);
  } catch (e) {
    console.error(`  ✘ JSON 汇总写入失败：${e.message}`);
  }
}

process.exitCode = failedEntries.length ? 1 : 0;
