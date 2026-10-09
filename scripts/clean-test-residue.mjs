#!/usr/bin/env node
/**
 * scripts/clean-test-residue.mjs —— 清理「测试跑在用户数据根里」留下的残留（★ 默认只预览，不删）
 *
 * ★★ 由来（2026-10-09）：`D:/lemo-films` 是**用户的成片数据根**，但测试会往它里面写夹具 / 探针 /
 *   锁目录，跑挂了（被中断 / 并发互撞）就**留渣**。实测（本机只读观察）：
 *     · `.briefs/`          —— 197 个（`bfill-*` 172、`bmuz*-*` 24、`bcorrupt-1` 1）；
 *     · `.console/index.json` —— 107 条任务里 **24 条**是测试批量起的（`jmuzz*`，2026-10-08T20:10–20:12 一段爆发）；
 *     · `.console/logs/`    —— 25 个里的 **19 个** `__fp-*` 探针（另 6 个 `jmuz*` 是测试任务的日志）；
 *     · `.locks-test/`      —— 62 个 **pid 目录**（`test/briefs.test.mjs:99` 建的锁目录，跑挂后没清）。
 *   这些**都在用户数据根里** ⇒ ★★ **删之前必须用户点头**，所以本工具**默认一个字都不删**。
 *
 * ★★ 判据（★ 唯一真源 = 下面的 `TEST_ID_RE`，只认这一条；★ 绝不用 `*.json` / `*` 之类宽泛通配）：
 *   `^(bfill|bcorrupt|bmuz|jmuzz|__fp|_smoke)` —— 逐条来历（都可机械核实）：
 *     · `bfill-*`   —— `test/briefs.test.mjs:759` 的写死夹具（`bfill-${i+1}`，容量测试用）；
 *     · `bcorrupt-*`—— `test/briefs.test.mjs:679` 的坏 JSON 夹具（`bcorrupt-1`）；
 *     · `bmuz*-*`   —— `lib/briefs.mjs` 的 `newId()` = `b<base36 时间戳>-<序号>`：★ **被中断的 briefs 测试**
 *                      在真根上 `makeBrief` 留下的在飞工单（实测 24 个，`createdAt` 与当轮 `bfill` 同窗）；
 *     · `jmuzz*-*`  —— `lib/jobs.mjs` 的 `nowId()` = `j<base36 时间戳>-<序号>`：★ **测试批量起的任务** id；
 *     · `__fp-*`    —— `test/cases.mjs:1984/2071` 的探针文件（`__fp-rot-*` / `__fp-total-*`）；
 *     · `_smoke-*`  —— `test/cases.mjs:375 TEST_DIR_PREFIX`：测试专用命名（本机真根上**当前命中 0 个**）。
 *
 *   ★★ **诚实提示（不许当成绝对证明）**：`bmuz*` / `jmuzz*` 是**应用自己的 id 生成器**产出的，
 *     它们的判据其实是「**base36 时间戳落在测试那一小段窗口内**」（`bmuz`≈16.8h、`jmuzz`≈28min 窗口）。
 *     理论上「同一时间窗内真实用户建的 brief/job」也会命中 ⇒ **存在假阳性可能**。这正是本工具
 *     「默认只预览 + 真删要备份 + 二次确认」三件套存在的原因：**先把清单给人看，再删**。
 *
 * ★★ 安全设计（★ 一条都不能少）：
 *   1. **默认 = dry-run**：不带 `--apply` 时**只打印清单，一个字节都不删**；
 *   2. **要真删必须同时满足** `--apply` **且** `--yes-i-have-a-backup`（二次开关）**且** 备份成功；
 *      备份失败 ⇒ **拒绝删除并报错（exit 1）**，原数据一个不动；
 *   3. **先备份、再校验、最后删**：把要动的东西**原样复制**到**非 C 盘**的
 *      `<LEMO_BACKUP_DIR>/test-residue-<时间戳>/`（默认 `D:/lemo-backup/...`），打印备份路径，
 *      并**校验**（条目数 + 总字节对得上，逐条存在）⇒ 对不上就**中止**；
 *   4. **只删判据匹配的**：不匹配的任何东西（含成片 `*.mp4`、非测试 id 的任务条目）**一律不碰**；
 *   5. **`index.json` 只摘条目、不删文件**（且摘除前整文件已进备份）；
 *   6. **回收站优先**：能送回收站就送（Windows + PowerShell 可用时）；**不可用则明确提示**并
 *      **要求额外的 `--allow-permanent-delete`** 才永久删，否则**中止**；
 *   7. **幂等**：跑两次结果一致（第二次「无事可做」）；不留临时文件（`index.json` 用 tmp+rename 原子写）。
 *
 * ★★ 用法（三段）：
 *   预览（默认，不删）：
 *     node D:/lemo-tools/scripts/clean-test-residue.mjs
 *   备份 + 真删（★ 两道开关缺一不可）：
 *     node D:/lemo-tools/scripts/clean-test-residue.mjs --apply --yes-i-have-a-backup
 *   回收站不可用时（本机会提示）额外加第三道，才允许永久删：
 *     node D:/lemo-tools/scripts/clean-test-residue.mjs --apply --yes-i-have-a-backup --allow-permanent-delete
 *
 * ★ 覆盖点（与 `lib/store.mjs` / `scripts/prune-jobs.mjs` 同一口径，供**非破坏验证**）：
 *   `LEMO_FILM_DIR`（默认 `D:/lemo-films`）、`LEMO_BACKUP_DIR`（默认 `D:/lemo-backup`，★ 必须非 C 盘）。
 *
 * ★★ 边界（本工具**不会**做的事）：不在任何 automation / 测试 / 闸门里被调用（**只能人工跑**）；
 *   不改 `lib/**`、`web/**`、`server.mjs`、`test/**`；不动 `D:/lemo-films` 下的成片（`*.mp4` 等）。
 *
 * 退出码：0 = 正常（含 dry-run / 无事可做 / apply 成功）；1 = 被拒（缺二次开关 / 备份失败 /
 *         回收站不可用且未给 `--allow-permanent-delete` / 安全闸拦截）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
// ★★ 与 `lib/store.mjs` 共用同一把跨进程写锁（同一成片根 ⇒ 同一个 `.console/index.lock`）——
//   本脚本 `--apply` 也要写 `.console/index.json`，必须与 `saveIndex` / `prune-jobs --apply` 串行化，
//   否则整文件重写会盖掉并发 console 刚建的任务（lost update，见 `_distill/store丢失更新-2026-10-09.md`）。
import { acquireLock, releaseLock } from '../lib/store.mjs';

// ── 路径（全部从成片根派生）──────────────────────────────────────────────
const FILM_DIR = process.env.LEMO_FILM_DIR || 'D:/lemo-films';
const BRIEFS_DIR = path.join(FILM_DIR, '.briefs');
const CONSOLE_DIR = path.join(FILM_DIR, '.console');
const INDEX_FILE = path.join(CONSOLE_DIR, 'index.json');
const LOGS_DIR = path.join(CONSOLE_DIR, 'logs');
const LOCKS_DIR = path.join(FILM_DIR, '.locks-test');
const BACKUP_ROOT = process.env.LEMO_BACKUP_DIR || 'D:/lemo-backup';

// ── 开关 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRM = argv.includes('--yes-i-have-a-backup');        // 二次开关
const ALLOW_PERMANENT = argv.includes('--allow-permanent-delete'); // 回收站不可用时的第三道

// ── 判据（★ 唯一真源）────────────────────────────────────────────────────
const TEST_ID_RE = /^(bfill|bcorrupt|bmuz|jmuzz|__fp|_smoke)/;
const isTestId = (s) => TEST_ID_RE.test(String(s));

// ── 小工具 ──────────────────────────────────────────────────────────────
const fmt = (n) => (n < 1024 ? `${n}B` : n < 1048576 ? `${(n / 1024).toFixed(1)}KB` : `${(n / 1048576).toFixed(2)}MB`);
const log = (...a) => console.log(...a);

function dirSize(d) {
  let s = 0;
  const walk = (p) => {
    let ents;
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const q = path.join(p, e.name);
      if (e.isDirectory()) walk(q);
      else if (e.isFile()) { try { s += fs.statSync(q).size; } catch { /* ignore */ } }
    }
  };
  walk(d);
  return s;
}

function dirFileCount(d) {
  let n = 0;
  const walk = (p) => {
    let ents;
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const q = path.join(p, e.name);
      if (e.isDirectory()) walk(q);
      else if (e.isFile()) n += 1;
    }
  };
  walk(d);
  return n;
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return !!(e && e.code === 'EPERM'); }   // 存在但无权限 ⇒ 视为存活（保守）
}

function assertNonC(p, label) {
  const abs = path.resolve(p);
  const m = abs.match(/^([A-Za-z]):[\\/]/);
  if (m && m[1].toLowerCase() === 'c') {
    throw new Error(`${label} 落在 C 盘（${abs}）—— 拒绝（备份/临时产物必须在非 C 盘）`);
  }
  return abs;
}

// ── 采集（★ 只读；不匹配判据的一律不进清单）───────────────────────────────
const briefs = [];   // { rel, abs, bytes }
const logs = [];
const locks = [];    // { rel, abs, bytes, pid }
const skippedLocks = [];
let indexReg = null;
let indexBad = false;
const jobEntries = [];   // { id, title, status, createdAt }

function collectFile(dir, ext, into) {
  let names;
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const n of names.sort()) {
    if (!n.endsWith(ext)) continue;
    const id = n.slice(0, -ext.length);
    if (!isTestId(id)) continue;
    const abs = path.join(dir, n);
    let st;
    try { st = fs.lstatSync(abs); } catch { continue; }
    if (st.isSymbolicLink()) continue;   // ★ 不碰链接
    if (!st.isFile()) continue;          // ★ 只删普通文件
    into.push({ rel: path.relative(FILM_DIR, abs), abs, bytes: st.size });
  }
}

collectFile(BRIEFS_DIR, '.json', briefs);
collectFile(LOGS_DIR, '.jsonl', logs);

// `.locks-test/<pid>/`：只认**纯数字 pid 目录**，且**跳过仍在跑的 pid**（保守）
try {
  for (const e of fs.readdirSync(LOCKS_DIR, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (!/^\d+$/.test(e.name)) continue;      // ★ 非 pid 目录一律不碰
    const pid = Number(e.name);
    const abs = path.join(LOCKS_DIR, e.name);
    if (pidAlive(pid)) { skippedLocks.push({ name: e.name, why: `pid ${pid} 仍存活` }); continue; }
    locks.push({ rel: path.relative(FILM_DIR, abs), abs, bytes: dirSize(abs), pid });
  }
} catch { /* .locks-test 不存在 ⇒ 无锁残留 */ }

// `.console/index.json`：★ 只**摘除**匹配判据的条目（不删整个文件）
let indexBytes = 0;
if (fs.existsSync(INDEX_FILE)) {
  try {
    indexBytes = fs.statSync(INDEX_FILE).size;
    indexReg = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    const jobs = Array.isArray(indexReg.jobs) ? indexReg.jobs : [];
    for (const j of jobs) {
      if (j && isTestId(j.id)) jobEntries.push({ id: j.id, title: j.title, status: j.status, createdAt: j.createdAt });
    }
  } catch { indexBad = true; }
}

// ── 汇总 ────────────────────────────────────────────────────────────────
const totalItems = briefs.length + logs.length + locks.length + jobEntries.length;
const payloadBytes = briefs.reduce((a, x) => a + x.bytes, 0)
  + logs.reduce((a, x) => a + x.bytes, 0)
  + locks.reduce((a, x) => a + x.bytes, 0);
// 备份体积 = 要删的文件/目录 + 整份 index.json（即便只摘条目，也整文件备份）
const backupBytes = payloadBytes + (jobEntries.length ? indexBytes : 0);

// ── 打印清单 ─────────────────────────────────────────────────────────────
log(`[clean-test-residue] 成片根：${FILM_DIR}`);
log(`[clean-test-residue] 模式：${APPLY ? '★ APPLY（会真删）' : 'dry-run（只预览，一个字节都不删）'}`);
log(`[clean-test-residue] 判据：id 匹配 ${TEST_ID_RE}`);
log('');

log(`① .briefs/ 测试工单：${briefs.length} 个（${fmt(briefs.reduce((a, x) => a + x.bytes, 0))}）`);
for (const x of briefs) log(`   - ${x.rel} (${fmt(x.bytes)})`);

log('');
log(`② .console/index.json 测试任务条目：${jobEntries.length} 条（整文件 ${fmt(indexBytes)}，★ 只摘条目、不删文件，摘前整文件备份）`);
for (const x of jobEntries) log(`   - ${x.id} | ${x.status ?? '?'} | ${x.title ?? ''}`);
if (indexBad) log('   ⚠️ index.json 解析失败 ⇒ 本次**不动**它（绝不把「读不到」当成「空的」）');

log('');
log(`③ .console/logs/ 测试日志：${logs.length} 个（${fmt(logs.reduce((a, x) => a + x.bytes, 0))}）`);
for (const x of logs) log(`   - ${x.rel} (${fmt(x.bytes)})`);

log('');
log(`④ .locks-test/ 测试锁目录：${locks.length} 个（${fmt(locks.reduce((a, x) => a + x.bytes, 0))}）`);
for (const x of locks) log(`   - ${x.rel}/ (${fmt(x.bytes)})`);
for (const s of skippedLocks) log(`   · 跳过 ${s.name}/：${s.why}`);

log('');
log(`合计：待清理 ${totalItems} 项、共 ${fmt(payloadBytes)}；备份需 ${fmt(backupBytes)}（含整份 index.json）。`);
log('');

// ── dry-run 到此为止 ──────────────────────────────────────────────────────
if (!APPLY) {
  log('⇒ 这是**预览**，什么都没删。');
  log('   确认清单无误后：node D:/lemo-tools/scripts/clean-test-residue.mjs --apply --yes-i-have-a-backup');
  log('   （--apply 会先备份到非 C 盘并校验，再删；备份失败则拒绝删除。）');
  process.exit(0);
}

// ── apply：缺二次开关 ⇒ 拒绝 ──────────────────────────────────────────────
if (!CONFIRM) {
  log('✘ 拒绝执行：`--apply` 必须同时给二次确认开关 `--yes-i-have-a-backup`。');
  log('  （上面已列出完整清单与总数；本工具不会在缺少显式确认时删任何东西。）');
  process.exit(1);
}

if (totalItems === 0) {
  log('✓ 没有可清理的测试残留（幂等：再跑一次结果一致）。');
  process.exit(0);
}

// ── 备份（★ 必须在非 C 盘；失败 ⇒ 拒绝删除）──────────────────────────────
let backupDir;
try {
  assertNonC(BACKUP_ROOT, 'LEMO_BACKUP_DIR');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  backupDir = path.join(BACKUP_ROOT, `test-residue-${ts}`);
  fs.mkdirSync(backupDir, { recursive: true });
} catch (e) {
  log(`✘ 备份目录准备失败：${e.message} ⇒ **拒绝删除**，原数据未动。`);
  process.exit(1);
}

const toBackup = [...briefs, ...logs, ...locks];
try {
  for (const it of toBackup) {
    const dst = path.join(backupDir, it.rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (fs.statSync(it.abs).isDirectory()) fs.cpSync(it.abs, dst, { recursive: true });
    else fs.copyFileSync(it.abs, dst);
  }
  if (jobEntries.length) {
    const dst = path.join(backupDir, path.relative(FILM_DIR, INDEX_FILE));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(INDEX_FILE, dst);
  }
} catch (e) {
  log(`✘ 备份失败：${e.message} ⇒ **拒绝删除**，原数据未动（备份残片：${backupDir}）。`);
  process.exit(1);
}

// ── 校验备份（★ 逐条存在 + 总字节对得上）──────────────────────────────────
let verifyBad = [];
for (const it of toBackup) {
  const dst = path.join(backupDir, it.rel);
  if (!fs.existsSync(dst)) { verifyBad.push(`缺 ${it.rel}`); continue; }
  const got = fs.statSync(it.abs).isDirectory() ? dirFileCount(it.abs) : 1;
  const gotDst = fs.statSync(dst).isDirectory() ? dirFileCount(dst) : 1;
  if (got !== gotDst) verifyBad.push(`${it.rel} 文件数 ${got}≠${gotDst}`);
}
if (jobEntries.length && !fs.existsSync(path.join(backupDir, path.relative(FILM_DIR, INDEX_FILE)))) {
  verifyBad.push('缺 index.json');
}
const backupTotal = dirSize(backupDir);
if (backupTotal !== backupBytes) verifyBad.push(`总字节 ${backupTotal}≠期望 ${backupBytes}`);

log(`备份路径：${backupDir}`);
log(`备份校验：${backupTotal} 字节 / ${toBackup.length + (jobEntries.length ? 1 : 0)} 个条目`);
if (verifyBad.length) {
  log(`✘ 备份校验不通过 ⇒ **拒绝删除**，原数据未动：`);
  for (const b of verifyBad) log(`   - ${b}`);
  process.exit(1);
}
log('✓ 备份校验通过。');
log('');

// ── 回收站能力探测（★ 不可用则要求第三道开关）──────────────────────────────
function tryRecycle(absPath) {
  if (process.platform !== 'win32') return { ok: false, why: '非 Windows 平台' };
  const p = absPath.replace(/\//g, '\\');
  const isDir = (() => { try { return fs.statSync(absPath).isDirectory(); } catch { return false; } })();
  const fn = isDir ? 'DeleteDirectory' : 'DeleteFile';
  const ps = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::${fn}('${p}','OnlyErrorDialogs','SendToRecycleBin')`;
  let r;
  try { r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 20000 }); }
  catch (e) { return { ok: false, why: `spawn 失败：${e.message}` }; }
  if (r.error) return { ok: false, why: `spawn 失败：${r.error.message}` };
  if (r.status !== 0) return { ok: false, why: `powershell exit ${r.status}${r.stderr ? '：' + String(r.stderr).trim().slice(0, 120) : ''}` };
  let gone = false;
  try { gone = !fs.existsSync(absPath); } catch { gone = false; }
  if (!gone) return { ok: false, why: 'powershell 返回 0 但目标仍在' };
  return { ok: true };
}

function probeRecycle() {
  let dir;
  try {
    assertNonC(BACKUP_ROOT, 'LEMO_BACKUP_DIR');
    dir = path.join(BACKUP_ROOT, `.recycle-probe-${process.pid}`);
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'probe.tmp');
    fs.writeFileSync(f, 'x');
    const r = tryRecycle(f);
    if (!r.ok) { try { fs.rmSync(f, { force: true }); } catch { /* ignore */ } }
    try { fs.rmdirSync(dir); } catch { /* ignore */ }
    return r;
  } catch (e) {
    try { if (dir) fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    return { ok: false, why: e.message };
  }
}

const rec = probeRecycle();
let via;
if (rec.ok) {
  via = 'recycle';
  log('删除方式：回收站（探测可用）。');
} else if (ALLOW_PERMANENT) {
  via = 'permanent';
  log(`⚠️ 回收站不可用（${rec.why}）⇒ 已给 --allow-permanent-delete，**永久删除**。`);
} else {
  log(`✘ 回收站不可用（${rec.why}）。`);
  log('   本工具**不擅自永久删** —— 原数据未动，备份已留在上面路径。');
  log('   确需永久删：加第三道开关 `--allow-permanent-delete`。');
  process.exit(1);
}
log('');

function removeOne(it) {
  if (via === 'recycle') {
    const r = tryRecycle(it.abs);
    if (!r.ok) return { ok: false, why: r.why };
    return { ok: true };
  }
  try {
    if (fs.statSync(it.abs).isDirectory()) fs.rmSync(it.abs, { recursive: true, force: true });
    else fs.rmSync(it.abs, { force: true });
  } catch (e) { return { ok: false, why: e.message }; }
  return { ok: true };
}

// ── 执行删除 ──────────────────────────────────────────────────────────────
let removed = 0;
const removedIds = [];
const failures = [];
for (const it of [...briefs, ...logs, ...locks]) {
  const r = removeOne(it);
  if (r.ok) { removed += 1; log(`  − ${it.rel}`); }
  else { failures.push(`${it.rel}：${r.why}`); log(`  ✘ ${it.rel}：${r.why}`); }
}

// 锁目录删空后，顺手收掉空的 `.locks-test`（无残留）
try {
  if (fs.existsSync(LOCKS_DIR) && fs.readdirSync(LOCKS_DIR).length === 0) fs.rmdirSync(LOCKS_DIR);
} catch { /* ignore */ }

// `.console/index.json`：★ 摘除匹配条目（拿锁 → 重读 → 只摘本次的 id → 原子写）
if (jobEntries.length && !indexBad) {
  const ids = new Set(jobEntries.map((x) => x.id));
  const locked = acquireLock();
  if (!locked) console.warn('  ⚠️ [clean-test-residue] 没拿到跨进程写锁（另一实例正在写索引）→ 仍会「重读 → 只摘本次的 id」后写，但「读盘 → 原子写」之间有竞态窗口，对方改动可能被覆盖');
  try {
    let fresh = indexReg;
    try {
      const reread = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
      if (reread && typeof reread === 'object') fresh = reread;
    } catch { /* 读不到 / 坏 ⇒ 用启动时快照 */ }
    const before = Array.isArray(fresh.jobs) ? fresh.jobs : [];
    fresh.jobs = before.filter((j) => !(j && ids.has(j.id)));
    fresh.savedAt = new Date().toISOString();   // ★ 与 lib/store.mjs 的写法一致（同一字段只允许一种类型：ISO 字符串）
    const tmp = `${INDEX_FILE}.${process.pid}.clean.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(fresh, null, 2) + '\n');
      fs.renameSync(tmp, INDEX_FILE);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      throw e;
    }
    log(`  ✓ .console/index.json 已摘除 ${jobEntries.length} 条测试条目（剩余 ${fresh.jobs.length} 条）${locked ? '' : '（★ 未拿到锁）'}`);
    removedIds.push(...jobEntries.map((x) => x.id));
  } catch (e) {
    failures.push(`index.json 摘条目失败：${e.message}`);
    log(`  ✘ index.json 摘条目失败：${e.message}`);
  } finally {
    if (locked) releaseLock();
  }
}

log('');
log(`[clean-test-residue] 汇总：删 ${removed} 个文件/目录${removedIds.length ? ` + 摘 ${removedIds.length} 条任务条目` : ''}｜失败 ${failures.length}｜方式 ${via}`);
log(`  备份：${backupDir}`);
if (failures.length) {
  log('  ✘ 有失败项：');
  for (const f of failures) log(`    - ${f}`);
}
log('  ⇒ 再跑一次 `node scripts/clean-test-residue.mjs` 应为「无事可做」（幂等）。');
process.exit(failures.length ? 1 : 0);
