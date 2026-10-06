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
 *   只删①会留下「点进去 404」的僵尸任务；只删②会留下永远没人认领的孤儿目录。**三者要一起删**。
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
 * 退出码：0 正常（含「无待清理」）；1 有安全闸拦截（junction / 越界路径）。
 *
 * ★ 覆盖点：`LEMO_FILM_DIR`（默认 `D:/lemo-films`，与 lib/jobs.mjs 的 FILM_DIR 同义），
 *   便于在临时树上做非破坏性验证（不碰真实产物）。
 */
import fs from 'node:fs';
import path from 'node:path';

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
const reg = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const jobs = Array.isArray(reg.jobs) ? reg.jobs : [];
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

if (APPLY && droppedIds.length) {
  reg.jobs = jobs.filter((j) => !droppedIds.includes(j.id));
  reg.savedAt = Date.now();
  fs.writeFileSync(INDEX, JSON.stringify(reg, null, 2) + '\n');
  console.log(`  ✓ 注册表已摘除 ${droppedIds.length} 条（剩余 ${reg.jobs.length} 条）`);
}

console.log(`\n[prune-jobs] 汇总：待清理 ${drop.length} 个（可回收约 ${(bytes / 1048576).toFixed(1)}MB）｜${APPLY ? `实删目录 ${dirsRemoved}` : '未删任何东西'}｜安全闸拦截 ${blockers}`);
if (!APPLY && drop.length) console.log('  ⇒ 确认无误后加 --apply 执行。');
process.exit(blockers ? 1 : 0);
