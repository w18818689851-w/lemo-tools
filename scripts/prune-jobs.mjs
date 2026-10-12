#!/usr/bin/env node
/**
 * scripts/prune-jobs.mjs —— 控制台出片目录 `_jobs/` 的**保留策略**（默认只报告，不删）
 *
 * ★ 由来（2026-10-06）：`D:/lemo-films/_jobs/` 此前**没有任何保留策略** —— 控制台每出一片就在
 *   `_jobs/<任务id>/` 落一份 `<slug>.mp4` + `<slug>.srt`，日积月累只增不减（实测 5 个任务 145MB）。
 *   这是「存储放非 C 盘」之外的**第二个存储纪律**：产物可以留，但要有上限。
 *
 * ★ 三条一致性（缺一不可，否则留下孤儿）：
 *   ① 产物目录 `D:/lemo-films/_jobs/<id>/`；
 *   ② 注册表 `D:/lemo-films/.console/index.json` 里那条 job 记录；
 *   ③ 日志 `D:/lemo-films/.console/logs/<id>.jsonl`。
 *   只删①会留下「点进去 404」的僵尸任务；只删②会留下永远没人认领的孤儿目录。**三者要一起删**。★ 反向（2026-10-12 修 F4）：UI 的 `deleteJob`（`lib/jobs.mjs`）只做②③ ⇒ 留下①的孤儿，而旧版本脚本**只遍历②**（注册表）⇒ 那些目录**既不删也不报**（永久占盘、且不可发现）；现本脚本**也扫 `_jobs/`**，把没有注册表条目的目录当孤儿认领（dry-run 报告 + `--apply` 时按同一把安全闸删）。
 *
 * 判据（机械、可解释）：
 *   · 只处理**已结束**（`status` ∈ done/failed/canceled，即 `endedAt` 有值）的任务 —— **绝不动 running**；
 *   · 按 `createdAt` 从新到旧排序，**保留最新 `--keep N` 个**（默认 10）；其余为「待清理」；
 *   · ★ 待清理的任务若**产物目录不存在**，仍然清理它的②③（注册表 + 日志），否则注册表会无限增长；
 *   · ★ 安全闸：待清理的目录路径**必须**落在 `_jobs/` 之内、且**不是 junction/符号链接**（lstat 判定），
 *     否则跳过并报警（本机踩过「junction 的 rm -rf 会穿透删真实目标」）。
 *
 * 用法：
 *   node scripts/prune-jobs.mjs                 # 默认：只报告（dry-run），不删任何东西
 *   node scripts/prune-jobs.mjs --keep 20       # 换保留条数（仍只报告）
 *   node scripts/prune-jobs.mjs --apply         # 真正执行（删目录 + 摘注册表条目 + 删日志）
 *   node scripts/prune-jobs.mjs --apply --keep 5
 * 退出码：0 正常（含「无待清理」）；1 有安全闸拦截（junction / 越界路径）；2 注册表读不到 / 形状不对 ⇒ **拒绝执行**（一个字节都不动，见下 F5）。
 *
 * ★ 覆盖点：`LEMO_FILM_DIR`（默认 `D:/lemo-films`，与 lib/jobs.mjs 的 FILM_DIR 同义），
 *   便于在临时树上做非破坏性验证（不碰真实产物）。
 *
 * ★★ 并发写者（2026-10-09 第 9 轮修）：`--apply` 摘注册表条目时，**与 `lib/store.mjs` 共用同一把
 *   跨进程写锁**（`acquireLock` / `releaseLock`，同一 root ⇒ 同一个 `.console/index.lock`），
 *   且是「拿锁 → 重读 → 只摘本次真删了的 id → 原子写」—— 不再是「用启动时的旧快照整文件盖写」。
 *   拿不到锁时**不阻塞**（有界等待）⇒ 照写 + warn（与 `saveIndex` 同纪律）。
 */
import fs from 'node:fs';
import path from 'node:path';
// ★★ 与 lib/store.mjs **共用同一把跨进程写锁**（2026-10-09 第 9 轮修）——
//   本脚本 `--apply` 也写同一个 `.console/index.json`，必须和 `saveIndex` 真正串行化，
//   否则整文件重写会盖掉并发 console 刚建的任务（lost update，见第 9 轮审计 A1）。
//   同一 root（都从 `LEMO_FILM_DIR` 派生）⇒ 同一个 `.console/index.lock`。
import { acquireLock, releaseLock } from '../lib/store.mjs';

const FILM_DIR = process.env.LEMO_FILM_DIR || 'D:/lemo-films';
const JOBS_DIR = path.join(FILM_DIR, '_jobs');
const CONSOLE_DIR = path.join(FILM_DIR, '.console');
const INDEX = path.join(CONSOLE_DIR, 'index.json');
const LOGS_DIR = path.join(CONSOLE_DIR, 'logs');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const ki = argv.indexOf('--keep');
const KEEP = ki >= 0 ? Math.max(0, parseInt(argv[ki + 1], 10) || 0) : 10;

const DONE = new Set(['done', 'failed', 'canceled', 'cancelled']);

function rmInside(p) {
  // 安全闸：路径必须在 JOBS_DIR 内，且不是 junction / symlink
  const abs = path.resolve(p);
  const root = path.resolve(JOBS_DIR);
  if (!(abs === root || abs.startsWith(root + path.sep))) return { ok: false, why: '越界（不在 _jobs 内）' };
  let st;
  try { st = fs.lstatSync(abs); } catch { return { ok: true, missing: true }; }   // 不存在 = 无需删
  if (st.isSymbolicLink()) return { ok: false, why: '是符号链接/junction（拒绝穿透删除）' };
  return { ok: true };
}

function rmDir(p) {
  const g = rmInside(p);
  if (!g.ok) return g;
  if (g.missing) return { ok: true, missing: true };
  fs.rmSync(p, { recursive: true, force: true });
  return { ok: true, removed: true };
}

if (!fs.existsSync(INDEX)) {
  console.log(`[prune-jobs] 注册表不存在：${INDEX} ⇒ 无事可做`);
  process.exit(0);
}
// ★★ 2026-10-12 修 F5：**首次读**注册表也要「如实降级 + 明确告警」（照本文件下面「拿锁后重读」那处的口径）。
//   旧版这行 `JSON.parse` 在 try 之外 ⇒ 注册表一坏就抛**未捕获异常**（`SyntaxError` + 原始堆栈 + exit 1），
//   这个「专门用来收拾 `_jobs/` 的运维命令」在最需要它的时候**完全不可用**（实测：截断到 55% 即崩）。
//   ★ 为什么**不能**「读不到就当空表继续跑」：本脚本现在还负责认领 `_jobs/` 里的孤儿目录（见下 F4），
//     把「读不到」当「盘上是空的」⇒ **每一个产物目录都会被判成孤儿** ⇒ `--apply` 会删光用户全部成片。
//   ★ 判据与 `lib/store.mjs:233`（`if (!arr) throw new Error('index.json 里没有 jobs 数组')`）同源：
//     顶层必须是对象、且必须有 jobs 数组；两条都不满足就**拒绝执行**（exit 2），一个字节都不动。
let reg;
try {
  reg = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const arr = reg && typeof reg === 'object' && !Array.isArray(reg) && Array.isArray(reg.jobs) ? reg.jobs : null;
  if (!arr) throw new Error(Array.isArray(reg) ? '顶层是数组（本仓写的是 {version, savedAt, jobs} 形状）' : 'index.json 里没有 jobs 数组');
} catch (e) {
  console.error(`[prune-jobs] ✘ 注册表读不到 / 形状不对 / 解析失败：${INDEX}`);
  console.error(`  ${e.message}`);
  console.error('  ⇒ **拒绝执行**（exit 2）：本次一个字节都不动（既不动 `_jobs/`，也不动注册表与日志）。');
  console.error('  ★ 为什么不是「当成空注册表」：那样 `_jobs/` 下每一个产物目录都会被判成孤儿 ⇒ `--apply` 会删光全部成片。');
  console.error('  处置：先修好 / 恢复 index.json（或人工确认后把它移走）再重跑本命令。');
  process.exit(2);
}
const jobs = reg.jobs;
const ended = jobs.filter((j) => j && j.id && (j.endedAt || DONE.has(String(j.status || '').toLowerCase())));
ended.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

const keep = ended.slice(0, KEEP);
const drop = ended.slice(KEEP);
// running 的条目：既不在 keep 也不在 drop，必须原样保留（安全）
const running = jobs.filter((j) => j && j.id && !(j.endedAt || DONE.has(String(j.status || '').toLowerCase())));

console.log(`[prune-jobs] ${APPLY ? '★ 执行模式' : '只报告（dry-run）'}｜保留最新 ${KEEP} 个已结束任务`);
console.log(`  注册表共 ${jobs.length} 条：已结束 ${ended.length}、进行中 ${running.length}（进行中一律不动）`);
console.log(`  保留：${keep.map((j) => j.id).join(', ') || '(无)'}`);

let blockers = 0, dirsRemoved = 0, dirsMissing = 0, bytes = 0;
const droppedIds = [];
for (const j of drop) {
  const dir = path.join(JOBS_DIR, j.id);
  let sz = 0;
  try { sz = dirSize(dir); } catch { /* ignore */ }
  bytes += sz;
  const g = rmInside(dir);
  if (!g.ok) { blockers++; console.log(`  ✘ ${j.id}：${g.why} ⇒ 跳过（不删注册表）`); continue; }
  droppedIds.push(j.id);
  if (g.missing) { dirsMissing++; console.log(`  · ${j.id}：产物目录不存在 ⇒ 只清注册表 + 日志`); }
  else {
    console.log(`  − ${j.id}：删目录（${(sz / 1048576).toFixed(1)}MB）+ 注册表条目 + 日志`);
    if (APPLY) { const r = rmDir(dir); if (r.removed) dirsRemoved++; }
  }
  if (APPLY) {
    const lf = path.join(LOGS_DIR, `${j.id}.jsonl`);
    if (fs.existsSync(lf)) fs.rmSync(lf, { force: true });
  }
}
function dirSize(d) {
  let s = 0;
  const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); if (e.isDirectory()) walk(q); else try { s += fs.statSync(q).size; } catch { /* ignore */ } } };
  walk(d); return s;
}

// ── ★★ 2026-10-12 修 F4：`_jobs/` 里**没有注册表条目**的目录 = 孤儿（认领 + 报告 + `--apply` 时删）──────
//
// ★ 缺陷（第八批审计 F4）：UI 的 `deleteJob`（`lib/jobs.mjs`）只删②注册表条目 + ③日志，**不碰①产物目录**
//   ⇒ 每个被「删除记录」的任务都留下一个 `_jobs/<id>/`（含 `film.mp4` + `.srt`，实测 100+ MB），
//   而旧版本本脚本**只遍历注册表条目**（`drop` 来自 `reg.jobs`）⇒ 这些目录**既不删也不报**、
//   **永久占盘且不可发现**（`prune-dub.mjs` 只管 `dub/`）。这直接违反本文件开头那条「三条一致性」。
// ★ 判据（机械、可解释）：目录名**不在注册表 id 集里** ⇒ 孤儿。`--keep` 对它们**不适用**（它们不是任务）。
// ★ 动作：dry-run 逐个列出（名 + 字节）并计入汇总；`--apply` 时按**同一把** `rmInside` 安全闸删
//   （越界 / junction / 符号链接一律拒删并计一次拦截 ⇒ exit 1）。
// ★ 为什么不设「年龄门槛」（与 `lib/store.mjs` 的孤儿**日志**不同，那里有一道 10 秒门槛）：注册表条目在
//   **入队时**就落盘（`lib/jobs.mjs` 的 `persistSoon`，≤500ms 去抖），而 `_jobs/<id>/` 是编排器**跑起来、
//   真正产出**时才创建的（远晚于那 500ms）⇒「目录在、条目不在」几乎不可能是「正在跑的任务」。
//   ★ 残留风险（如实登记，不假装不存在）：若 `--apply` 恰好在「目录刚建、条目还没落盘」这个极窄窗口里
//     跑（或另一实例的条目被它自己摘掉），那个目录会被当孤儿删掉。⇒ 本脚本**默认只报告**、
//     `--apply` 必须人工确认，且 dry-run 会把每一个待删目录**逐个列名 + 列字节**（不静默）。
const orphanDirs = [];
try {
  const known = new Set(jobs.filter((j) => j && j.id).map((j) => String(j.id)));
  for (const ent of fs.readdirSync(JOBS_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;                       // 只认目录（`_jobs/` 下别的形态不归本脚本管）
    if (known.has(ent.name)) continue;                      // 有条目 ⇒ 不是孤儿
    const dir = path.join(JOBS_DIR, ent.name);
    let sz = 0;
    try { sz = dirSize(dir); } catch { /* ignore */ }
    orphanDirs.push({ name: ent.name, dir, sz });
  }
} catch { /* `_jobs/` 不存在 ⇒ 没有孤儿 */ }
orphanDirs.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

let orphansRemoved = 0, orphanBytes = 0;
if (orphanDirs.length) {
  console.log(`  ★ 孤儿产物目录（_jobs/ 下有、注册表里没有 ⇒ 没有任何任务记录认领）：${orphanDirs.length} 个`);
  for (const o of orphanDirs) {
    orphanBytes += o.sz;
    const g = rmInside(o.dir);
    if (!g.ok) { blockers++; console.log(`  ✘ [孤儿] ${o.name}：${g.why} ⇒ 跳过`); continue; }
    console.log(`  ${APPLY ? '−' : '·'} [孤儿] ${o.name}：${APPLY ? '删目录' : '待删目录'}（${(o.sz / 1048576).toFixed(1)}MB）`);
    if (APPLY) { const r = rmDir(o.dir); if (r.removed) { dirsRemoved++; orphansRemoved++; } }
  }
}

if (APPLY && droppedIds.length) {
  // ★★ 与 `lib/store.mjs` 共用同一把跨进程写锁（同一 root ⇒ 同一个 `.console/index.lock`）——
  //   否则下面这句**整文件重写**会盖掉并发 console 刚建的任务（教科书式 lost update，第 9 轮审计 A1）。
  //   ★ 降级策略：拿不到锁**不阻塞**（`acquireLock` 本身有界，最多等 `LOCK_WAIT_MS`）—— 照写 + warn，
  //     与 `saveIndex` 的既有降级同纪律（best-effort：宁可有竞态，也不让运维命令卡死）。
  const locked = acquireLock();
  if (!locked) console.warn('  ⚠️  [prune-jobs] 没拿到跨进程写锁（另一实例正在写索引）→ 仍会「重读 → 只摘本次真删的 id」后写，但「读盘 → 原子写」之间有竞态窗口，对方的改动可能被覆盖');
  try {
    // ★ 拿锁之后**重读**：只摘掉本次真删了的 `droppedIds`，其余（含别的实例刚建的）一律保留。
    //   读不到 / 解析失败 ⇒ 退回本进程启动时读到的快照（`reg`）—— 绝不把「读不到」当成「盘上是空的」。
    let fresh = reg;
    try {
      const reread = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
      if (reread && typeof reread === 'object') fresh = reread;
    } catch { /* 读不到 / 坏 ⇒ 用启动时的快照 */ }
    const before = Array.isArray(fresh.jobs) ? fresh.jobs : jobs;
    fresh.jobs = before.filter((j) => !droppedIds.includes(j.id));
    fresh.savedAt = new Date().toISOString();   // ★ 与 lib/store.mjs 的写法一致（同一字段只允许一种类型：ISO 字符串）
    // ★ 原子写（tmp + rename，与 `lib/store.mjs` 同一套做法）；tmp 名带 pid 免得两个进程抢同一个 `.tmp`。
    const tmp = `${INDEX}.${process.pid}.prune.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(fresh, null, 2) + '\n');
      fs.renameSync(tmp, INDEX);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      throw e;
    }
    console.log(`  ✓ 注册表已摘除 ${droppedIds.length} 条（剩余 ${fresh.jobs.length} 条）${locked ? '' : '（★ 未拿到锁）'}`);
  } finally {
    if (locked) releaseLock();
  }
}

console.log(`\n[prune-jobs] 汇总：待清理 ${drop.length} 个（可回收约 ${(bytes / 1048576).toFixed(1)}MB）｜孤儿目录 ${orphanDirs.length} 个（可回收约 ${(orphanBytes / 1048576).toFixed(1)}MB）｜${APPLY ? `实删目录 ${dirsRemoved}（其中孤儿 ${orphansRemoved}）` : '未删任何东西'}｜安全闸拦截 ${blockers}`);
if (!APPLY && (drop.length || orphanDirs.length)) console.log('  ⇒ 确认无误后加 --apply 执行。');
process.exit(blockers ? 1 : 0);
