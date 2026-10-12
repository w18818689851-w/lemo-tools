#!/usr/bin/env node
/**
 * scripts/prune-dub.mjs —— 文案出片产物目录 `dub/` 的**保留策略**（默认只报告，不删）
 *
 * ★ 由来（2026-10-10，RISK-10）：`dub.mjs` 每出一片就在 `<dubRoot>/<时间戳>-<短id>/` 落一份
 *   `film.mp4` + `audio.wav` + `.srt` 等；校验抽帧另有 `<dubRoot>/_verify/<同名目录>/`。
 *   这些产物目录**没有任何保留策略**，跑久了只增不减（实测 `D:/lemo-films/dub/` 已有 23 个
 *   产物目录 + 69 个 `_verify/` 子目录）。项目既有的保留策略工具 `scripts/prune-jobs.mjs`
 *   **只管 `_jobs/`**，**不覆盖** dub 产物 ⇒ 立本工具。
 *   ★ `lib/dub.mjs` 的 `dubDiskUsage()` 只**如实上报占用、绝不删除**（RISK-10 已落地）——
 *     本工具是它的**写侧**：把「删」做成一个**默认 dry-run、必须显式给阈值**的独立命令。
 *
 * ★ 判据（机械、可解释）：
 *   · **只处理产物目录**：`<dubRoot>/<时间戳>-<短id>`（`newOutDir()` 的形态 = `YYYYMMDD-HHMMSS-<4hex>`）
 *     与 `<dubRoot>/_verify/<同名目录>`。其余一律不碰（见下「跳过的条目」）。
 *   · **年龄阈值**：按目录的 `mtime` 判定，`now - mtime >= --older-than <天>` 才入选；
 *     ★ **缺 `--older-than` ⇒ 不选任何一项**（**绝不**「不带阈值就删全部」）；带 `--apply` 却缺阈值 ⇒ **报错退出**。
 *   · **安全闸（两条，缺一不可）**：删之前 ① 规范化后的绝对路径必须**确实在 dubRoot 之内**
 *     （照 `lib/resources.mjs:dirFor` 的路径穿越防护口径）；② `lstat` 判定**不是符号链接/junction**
 *     （本机踩过「junction 的 `rm -rf` 会穿透删真实目标」）⇒ 命中即**拒绝并计入拦截（exit 1）**。
 *   · **`_uploads/`（用户素材）默认不动**：只有显式 `--include-uploads` 才纳入，且**醒目提示**
 *     「这是用户上传的素材」；`_uploads/index.json`（登记表）**文件本身永远保留**（删了会孤立其余素材）。
 *     ★★ 2026-10-12（第八批审计 F7 修）：`--apply` **真删掉** `_uploads/` 下的文件之后，**同一把锁内**
 *       把登记表里**指向这些已删文件的条目一并摘掉** —— 否则留下「文件没了、登记还在」的**幽灵条目**
 *       （`listUploads()` 按 `statSync` 过滤 ⇒ UI 上看不见 ⇒ 静默；且永久占用 `MAX_UPLOADS=200` 的额度）。
 *       这与「已知项 3」（只丢登记不删文件）互为镜像，两条方向**一起补齐**才算对称。
 *       ★ 读不出登记表（坏 JSON / 形状不认识）⇒ **一个字节都不改它**，只醒目告警（绝不覆盖读不懂的文件）。
 *       ★ dry-run 也会**预告**将摘掉几条（不写回）。
 *   · **只读辅助目录**（`_fonts` / `_visual-tmp` 等以 `_` 开头、但不是 `_verify`/`_uploads` 的）
 *     默认跳过，并在报告里**逐条说明跳过了什么**。
 *   · **逐个列出**将要删 / 已删的**完整路径 + 字节数**，最后给汇总（条数 / 总字节）。不许只报总数。
 *   · 任何异常（读目录 / lstat / 删除失败）**降级为报错信息**，不静默吞掉。
 *
 * ★ 用法：
 *   node scripts/prune-dub.mjs                                # 默认 dry-run：只报告（缺阈值时不选任何项），不删
 *   node scripts/prune-dub.mjs --older-than 7                 # 报告「超 7 天」的产物目录（仍不删）
 *   node scripts/prune-dub.mjs --older-than 7 --apply         # 真正删除（产物目录 + _verify 同名抽帧目录）
 *   node scripts/prune-dub.mjs --older-than 30 --only 20261002-154703-226f   # 只处理指定一个产物目录名
 *   node scripts/prune-dub.mjs --older-than 7 --include-uploads --apply      # ★ 连用户素材一起（醒目提示）
 *   node scripts/prune-dub.mjs --older-than 7 --json          # 机器可读
 *   node scripts/prune-dub.mjs --root <dir>                   # 换 dubRoot（测试 / 临时树用）
 *   node scripts/prune-dub.mjs -h | --help                    # 帮助
 * 退出码：0 = 正常完成（dry-run 报告 / `--apply` 成功 / 无待清理 / `--help`）；
 *         1 = **有安全闸拦截**（路径越界 / 符号链接-junction）或**用法错误**
 *             （`--apply` 缺 `--older-than`、`--older-than` 非数、未知参数、非法 `--only`）；
 *         2 = 前置不可用（`--root` 指向的 dubRoot 不存在 / 不是目录 / 读不到）。
 * ★ 覆盖点：`--root <dir>`（默认 = `lib/dub.mjs` 的 `DUB_ROOT` = `<CFG.exportDir>/dub`，
 *   而 `CFG.exportDir` 认既有的 `LEMO_FILM_DIR`）⇒ 可在**临时树**上非破坏地演练 `--apply`。
 *   本工具**不新增环境变量**（故无需登记进 `check-env-overrides`）。
 */
import fs from 'node:fs';
import path from 'node:path';
// ★ dubRoot 的**唯一真相源**：`lib/dub.mjs` 的 `DUB_ROOT`（= `<CFG.exportDir>/dub`）——
//   与「谁生成产物目录」（`newOutDir()`）同源，避免两处各写一份 join 而漂移。
import { DUB_ROOT } from '../lib/dub.mjs';
// ★ 跨进程写锁（2026-10-12 修 F7）：`--apply` 现在也要写 `_uploads/index.json`，而 `lib/dub.mjs` 的
//   `registerUpload` / `unregisterUpload` 是**跨进程读-改-写**同一个文件 ⇒ 必须用**同一把锁**
//   （同 root ⇒ 同一个 `.console/index.lock`）才能与它们真正串行化。**绝不另写一份锁**。
//   （照 `scripts/prune-jobs.mjs:40` 对同一个 `index.json` 的做法。）
import { acquireLock, releaseLock } from '../lib/store.mjs';

const ARTIFACT_RE = /^\d{8}-\d{6}-[0-9a-f]{4}$/;   // newOutDir(): `${YYYYMMDD}-${HHMMSS}-${4 hex}`
const DAY_MS = 24 * 60 * 60 * 1000;

// ── 参数解析 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

const HELP = has('-h') || has('--help');
const APPLY = has('--apply');
const DRY = has('--dry-run');
const JSON_OUT = has('--json');
const INCLUDE_UPLOADS = has('--include-uploads');
const ONLY = valOf('--only');
const ROOT_ARG = valOf('--root');
const OT_RAW = valOf('--older-than');

/** 打印用法（`--help` 与用法错误共用）。 */
function usage() {
  console.log(`用法：node scripts/prune-dub.mjs [选项]

  --dry-run             默认行为：只报告，不删任何东西（显式写也可）
  --apply               真正执行删除（★ 必须同时给 --older-than，否则报错退出）
  --older-than <days>   年龄阈值（天）：只处理 mtime 早于「now - days 天」的产物目录
                        ★ 缺此项 ⇒ 不选任何待清理项（绝不「不带阈值就删全部」）
  --only <dir>          只处理指定一个产物目录名（须是 <时间戳>-<id> 形态，防路径穿越）
  --include-uploads     ★ 连 <dubRoot>/_uploads/（用户上传的素材）一起纳入（默认不动；
                        登记表 index.json 的**文件本身**永远保留，但删掉的文件对应的**条目会被摘掉**）
  --json                输出机器可读 JSON（stdout 只出 JSON）
  --root <dir>          指定 dubRoot（默认 = lib/dub.mjs 的 DUB_ROOT；测试 / 临时树用）
  -h, --help            显示本帮助

退出码：0 正常；1 安全闸拦截或用法错误；2 前置不可用（dubRoot 不存在 / 读不到）。
★ 默认只报告；只有 --apply 才会删除。`);
}

if (HELP) { usage(); process.exit(0); }

// 未知参数 ⇒ 用法错误（exit 1）
const BOOL_FLAGS = ['--apply', '--dry-run', '--json', '--include-uploads', '-h', '--help'];
const VAL_FLAGS = ['--older-than', '--only', '--root'];
const unknown = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VAL_FLAGS.includes(a)) { i++; continue; }
  if (BOOL_FLAGS.includes(a)) continue;
  if (a.startsWith('-')) unknown.push(a);
}
if (unknown.length) { console.error(`✘ 未知参数：${unknown.join(' ')}`); usage(); process.exit(1); }
if (DRY && APPLY) { console.error('✘ --dry-run 与 --apply 不能同时给'); process.exit(1); }

// 年龄阈值
let olderThanDays = null;
if (OT_RAW !== undefined) {
  olderThanDays = Number(OT_RAW);
  if (!Number.isFinite(olderThanDays) || olderThanDays < 0) {
    console.error(`✘ --older-than 需要一个 ≥0 的数字（收到：${JSON.stringify(OT_RAW)}）`);
    process.exit(1);
  }
}
// ★ 安全底线：缺阈值 + --apply ⇒ 报错退出（绝不默认删全部）
if (APPLY && olderThanDays === null) {
  console.error('✘ --apply 必须同时给 --older-than <days>：本工具**不允许**「不带年龄阈值就删全部」。');
  console.error('  先跑 `node scripts/prune-dub.mjs --older-than <days>` 看清楚将删什么，再加 --apply。');
  process.exit(1);
}

// --only 校验：必须是纯目录名（产物形态），防 `../` 之类穿越
if (ONLY !== undefined && !ARTIFACT_RE.test(String(ONLY))) {
  console.error(`✘ --only 需要 <时间戳>-<id> 形态的目录名（收到：${JSON.stringify(ONLY)}）`);
  process.exit(1);
}

const ROOT = path.resolve(ROOT_ARG !== undefined ? String(ROOT_ARG) : DUB_ROOT);

// ── 前置：dubRoot 必须存在且是目录（否则 exit 2）─────────────────────────────
let rootStat;
try { rootStat = fs.statSync(ROOT); } catch (e) {
  console.error(`✘ 读不到 dubRoot：${ROOT}（${e.message}）`);
  process.exit(2);
}
if (!rootStat.isDirectory()) {
  console.error(`✘ dubRoot 不是目录：${ROOT}`);
  process.exit(2);
}

// ── 工具函数 ────────────────────────────────────────────────────────────────
/** 规范化后的绝对路径是否**确实**在 dubRoot 之内（照 lib/resources.mjs:dirFor 的穿越防护口径）。 */
function withinRoot(p, root) {
  const abs = path.resolve(p);
  const r = path.resolve(root);
  return abs === r || abs.startsWith(r + path.sep);
}

function dirSize(d) {
  let s = 0;
  const walk = (p) => {
    let ents;
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const q = path.join(p, e.name);
      if (e.isDirectory()) walk(q);
      else { try { s += fs.statSync(q).size; } catch { /* 读不到 ⇒ 跳过该文件 */ } }
    }
  };
  walk(d);
  return s;
}

const fmtBytes = (n) => `${n} B（${(n / 1048576).toFixed(2)} MB）`;

/** 安全删除：① 必须在 dubRoot 内；② 不是符号链接/junction。返回 { ok, removed?, missing?, why? }。 */
function rmSafe(p) {
  const abs = path.resolve(p);
  if (!withinRoot(abs, ROOT)) return { ok: false, why: '越界（规范化后不在 dubRoot 内）' };
  let st;
  try { st = fs.lstatSync(abs); } catch { return { ok: true, missing: true } };
  if (st.isSymbolicLink()) return { ok: false, why: '是符号链接/junction（拒绝穿透删除）' };
  try { fs.rmSync(abs, { recursive: true, force: true }); }
  catch (e) { return { ok: false, why: `删除失败：${e.message}` }; }
  return { ok: true, removed: true };
}

// ── 扫描 ────────────────────────────────────────────────────────────────────
const candidates = [];   // { full, name, kind:'out'|'verify'|'upload', bytes, ageDays, selected }
const blockers = [];     // { full, why }
const skipped = [];      // { name, why }
let uploadsWarned = false;

function addCandidate(full, kind, name) {
  let st;
  try { st = fs.lstatSync(full); } catch (e) { blockers.push({ full, why: `lstat 失败：${e.message}` }); return; }
  // ★ 安全闸②：符号链接/junction 一律拒绝（无论是否入选）
  if (st.isSymbolicLink()) { blockers.push({ full, why: '是符号链接/junction（拒绝穿透删除）' }); return; }
  // ★ 安全闸①：规范化后必须在 dubRoot 内
  if (!withinRoot(full, ROOT)) { blockers.push({ full, why: '规范化后不在 dubRoot 内（拒绝）' }); return; }
  const ageMs = Date.now() - st.mtimeMs;
  const selected = olderThanDays !== null && ageMs >= olderThanDays * DAY_MS;
  const bytes = st.isDirectory() ? dirSize(full) : st.size;
  candidates.push({ full, name, kind, bytes, ageDays: ageMs / DAY_MS, selected });
}

function scanVerify(dir) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { blockers.push({ full: dir, why: `读不到 _verify：${e.message}` }); return; }
  for (const ent of ents) {
    const full = path.join(dir, ent.name);
    // ★ 符号链接/junction 的 `Dirent.isDirectory()` 在 Windows 上为 false ⇒ 必须一并放行到
    //   `addCandidate`（那里用 lstat 判定并**拒绝**），否则会漏判、把危险项当「非目录」跳过。
    if (!ent.isDirectory() && !ent.isSymbolicLink()) { skipped.push({ name: `_verify/${ent.name}`, why: '非目录' }); continue; }
    if (!ARTIFACT_RE.test(ent.name)) { skipped.push({ name: `_verify/${ent.name}`, why: '非产物目录形态' }); continue; }
    if (ONLY !== undefined && ent.name !== ONLY) { skipped.push({ name: `_verify/${ent.name}`, why: '--only 未选中' }); continue; }
    addCandidate(full, 'verify', ent.name);
  }
}

function scanUploads(dir) {
  if (!INCLUDE_UPLOADS) {
    skipped.push({ name: '_uploads', why: '用户上传的素材（默认不动；加 --include-uploads 才纳入）' });
    return;
  }
  uploadsWarned = true;
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { blockers.push({ full: dir, why: `读不到 _uploads：${e.message}` }); return; }
  for (const ent of ents) {
    const full = path.join(dir, ent.name);
    if (ent.name === 'index.json') {
      skipped.push({ name: '_uploads/index.json', why: '上传登记表（**文件本身**永远保留：删了会孤立其余素材；--apply 删掉同目录文件后会**摘掉对应条目**，见 F7）' });
      continue;
    }
    addCandidate(full, 'upload', `_uploads/${ent.name}`);
  }
}

// 顶层扫描
let topEntries;
try { topEntries = fs.readdirSync(ROOT, { withFileTypes: true }); }
catch (e) { console.error(`✘ 读不到 dubRoot 内容：${ROOT}（${e.message}）`); process.exit(2); }

for (const ent of topEntries) {
  const full = path.join(ROOT, ent.name);
  if (ent.name === '_verify') { scanVerify(full); continue; }
  if (ent.name === '_uploads') { scanUploads(full); continue; }
  if (ent.name.startsWith('.')) { skipped.push({ name: ent.name, why: '点开头（隐藏 / 非产物）' }); continue; }
  if (ent.name.startsWith('_')) { skipped.push({ name: ent.name, why: '只读辅助目录（_ 开头，非 _verify/_uploads）' }); continue; }
  // ★ 符号链接/junction 的 `Dirent.isDirectory()` 在 Windows 上为 false ⇒ 一并放行到 `addCandidate`
  //   （那里用 lstat 判定并**拒绝**）—— 否则「产物名 junction 指向 dubRoot 之外」会被当「顶层文件」漏判。
  if (!ent.isDirectory() && !ent.isSymbolicLink()) { skipped.push({ name: ent.name, why: '顶层文件（不在本工具范围）' }); continue; }
  if (!ARTIFACT_RE.test(ent.name)) { skipped.push({ name: ent.name, why: '非产物目录形态（应为 <8位日期>-<6位时刻>-<4位hex>）' }); continue; }
  if (ONLY !== undefined && ent.name !== ONLY) { skipped.push({ name: ent.name, why: '--only 未选中' }); continue; }
  addCandidate(full, 'out', ent.name);
}

// ── 选择与执行 ──────────────────────────────────────────────────────────────
const selected = candidates.filter((c) => c.selected);
const selBytes = selected.reduce((s, c) => s + c.bytes, 0);
const candBytes = candidates.reduce((s, c) => s + c.bytes, 0);

let deleted = 0, deletedBytes = 0, missing = 0;
/** ★ 本次「文件真的不在盘上了」的 `_uploads/` 项（实删的 + 本来就不在的）—— 供 F7 摘登记用。 */
const goneUploadPaths = [];

function runDeletions() {
  for (const c of selected) {
    const r = rmSafe(c.full);
    if (!r.ok) { blockers.push({ full: c.full, why: r.why }); continue; }
    // ★ 实删 与 「本来就不在」都算「盘上没有这个文件了」⇒ 登记表里那条都成了幽灵，一并摘掉。
    if (c.kind === 'upload') goneUploadPaths.push(c.full);
    if (r.missing) { missing++; continue; }
    deleted++;
    deletedBytes += c.bytes;
  }
}
if (APPLY) runDeletions();

// ── F7（2026-10-12 第八批审计）：删了 `_uploads/` 里的文件，就把登记表里对应的条目一并摘掉 ──────
//   ★ 由来：本工具此前只 `rmSafe(c.full)`，**不碰** `_uploads/index.json` ⇒ 留下「文件没了、登记还在」
//     的**幽灵条目**（`lib/dub.mjs` 的 `listUploads()` 按 `statSync` 过滤 ⇒ UI 上看不见 ⇒ 静默；
//     且永久占 `MAX_UPLOADS=200` 的额度、登记表只增不减）。这与「已知项 3」（只丢登记不删文件）
//     互为镜像 —— 两个方向都缺一步，本处补的是「删文件」这一半。
//   ★ 两条安全底线（与 `lib/dub.mjs` 的 F3 修同一口径）：
//     ① **绝不改一份自己读不懂的登记表** —— 坏 JSON / 顶层不是数组 ⇒ 只告警、一个字节都不写；
//     ② 写回走 `acquireLock`（与 `registerUpload`/`unregisterUpload` **同一把锁**）+ pid 化 tmp + rename。
//   ★ 已知边界（如实登记）：锁文件落在 `<CFG.exportDir>/.console/index.lock`，即**按成片根**而不是按
//     `--root` 取 —— 正常用法里 `--root` 就是 `<CFG.exportDir>/dub`（同一个 root），两者一致；
//     只有「`--root` 指到别处、却没同时改 `LEMO_FILM_DIR`」的夹具场景才会锁错树（夹具已显式设环境变量）。
const UPLOADS_DIR = path.join(ROOT, '_uploads');
const UPLOADS_INDEX = path.join(UPLOADS_DIR, 'index.json');

/** 读 `_uploads/index.json`。三态：`{ok:true,entries}` / `{ok:false,why}`（ENOENT = 合法空表）。 */
function readUploadsIndex() {
  let raw;
  try { raw = fs.readFileSync(UPLOADS_INDEX, 'utf8'); }
  catch (e) {
    return e.code === 'ENOENT'
      ? { ok: true, entries: [] }
      : { ok: false, why: `读不到（${e.message}）` };
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { return { ok: false, why: `JSON 解析失败（${e.message}）` }; }
  if (!Array.isArray(parsed)) return { ok: false, why: `顶层不是数组（是 ${parsed === null ? 'null' : typeof parsed}）` };
  return { ok: true, entries: parsed };
}

/**
 * 摘掉「指向已删文件」的登记条目。
 * @param {string[]} targets 本次盘上已不在的 `_uploads/` 文件（绝对路径）
 * @param {boolean} apply true = 真写回；false = 只算「将摘掉几条」
 * @returns {{status:'unreadable'|'no-match'|'would-prune'|'pruned'|'write-failed', removed:number, total:number|null,
 *            left?:number, why?:string}}
 */
function syncUploadsRegistry(targets, apply) {
  const gone = new Set(targets.map((p) => path.resolve(p)));
  const goneBase = new Set(targets.map((p) => path.basename(p)));
  // ★ 匹配口径：登记条目 `path` 规范化后等于本次删掉的路径，**或**两者同名（`_uploads/` 是平铺的，
  //   文件名 = `<token><ext>`，同名即同物）。只按 token 猜不够 —— 登记表才是权威。
  const drop = (entries) => entries.filter((e) => {
    if (!e || typeof e !== 'object') return true;                 // 形状怪异的条目**原样保留**（不认识的别动）
    const p = typeof e.path === 'string' ? path.resolve(e.path) : '';
    return !(p && (gone.has(p) || goneBase.has(path.basename(p))));
  });

  const first = readUploadsIndex();
  if (!first.ok) return { status: 'unreadable', removed: 0, total: null, why: first.why };
  const after = drop(first.entries);
  const n = first.entries.length - after.length;
  if (!n) return { status: 'no-match', removed: 0, total: first.entries.length };
  if (!apply) return { status: 'would-prune', removed: n, total: first.entries.length };

  const locked = acquireLock();     // ★ 与 lib/dub.mjs 的 registerUpload / unregisterUpload 同一把锁
  try {
    // ★ 拿锁之后**重读**（读到的才是「当前」的），以它为准再算一次 —— 别的进程刚登记的那条不能被抹掉。
    const again = readUploadsIndex();
    if (!again.ok) return { status: 'unreadable', removed: 0, total: null, why: `${again.why}（拿锁后重读）` };
    const keep = drop(again.entries);
    const n2 = again.entries.length - keep.length;
    if (!n2) return { status: 'no-match', removed: 0, total: again.entries.length };
    // ★ 原子写：pid 化 tmp + rename（照 `lib/store.mjs` 的 `saveIndex` / `lib/dub.mjs` 的 `saveIndex` 范式）。
    const tmp = `${UPLOADS_INDEX}.${process.pid}.prune.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(keep, null, 2), 'utf8');
      fs.renameSync(tmp, UPLOADS_INDEX);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* 别留半个 tmp */ }
      return { status: 'write-failed', removed: 0, total: again.entries.length, why: e.message };
    }
    return { status: 'pruned', removed: n2, total: again.entries.length, left: keep.length };
  } finally {
    if (locked) releaseLock();
  }
}

// apply ⇒ 真删掉的那些；dry-run ⇒ 入选的（将要删的那些）。
const uploadTargets = APPLY ? goneUploadPaths : selected.filter((c) => c.kind === 'upload').map((c) => c.full);
const uploadsSync = uploadTargets.length ? syncUploadsRegistry(uploadTargets, APPLY) : null;

const ok = blockers.length === 0;

// ── 输出 ────────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({
    tool: 'prune-dub',
    root: ROOT,
    mode: APPLY ? 'apply' : 'dry-run',
    olderThanDays,
    includeUploads: INCLUDE_UPLOADS,
    only: ONLY ?? null,
    candidates: candidates.map((c) => ({ path: c.full, name: c.name, kind: c.kind, bytes: c.bytes, ageDays: Number(c.ageDays.toFixed(3)), selected: c.selected })),
    selected: selected.map((c) => ({ path: c.full, name: c.name, kind: c.kind, bytes: c.bytes })),
    deleted: APPLY ? deleted : 0,
    deletedBytes: APPLY ? deletedBytes : 0,
    missing,
    // ★ F7：`_uploads/index.json` 的登记摘除结果（null = 本次没有涉及 `_uploads/` 的文件）。
    uploadsRegistry: uploadsSync,
    blockers,
    skipped,
    totals: { candidates: candidates.length, candidateBytes: candBytes, selected: selected.length, selectedBytes: selBytes },
    ok,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

console.log(`[prune-dub] ${APPLY ? '★ 执行模式（--apply）' : '只报告（dry-run）'}｜dubRoot = ${ROOT}`);
console.log(`  年龄阈值：${olderThanDays === null ? '未给 --older-than ⇒ 不选任何待清理项（绝不删全部）' : `${olderThanDays} 天（mtime 早于 now - ${olderThanDays} 天）`}`);
if (uploadsWarned) console.log('  ⚠️  已启用 --include-uploads：下面 `_uploads/` 里的条目**是用户上传的素材**（登记表 index.json 的文件本身除外，永远保留）');
console.log(`  产物候选：${candidates.length} 个（共 ${fmtBytes(candBytes)}）｜其中超龄入选：${selected.length} 个（共 ${fmtBytes(selBytes)}）`);
console.log('');

if (selected.length) {
  console.log(`  ${APPLY ? '将删 / 已删' : '待清理'}（逐条：完整路径 + 字节数）：`);
  for (const c of selected) {
    const tag = c.kind === 'verify' ? '_verify' : c.kind === 'upload' ? '_uploads' : '产物';
    console.log(`    ${APPLY ? '−' : '·'} [${tag}] ${c.full}　${fmtBytes(c.bytes)}`);
  }
} else if (olderThanDays === null) {
  console.log('  （未给 --older-than ⇒ 无待清理项。加 `--older-than <days>` 后才会列出。）');
} else {
  console.log('  （没有超龄的产物目录 ⇒ 无待清理项。）');
}

if (blockers.length) {
  console.log(`\n  ✘ 安全闸拦截 ${blockers.length} 处（**拒绝删除**，逐条列出）：`);
  for (const b of blockers) console.log(`    ✘ ${b.full} —— ${b.why}`);
}

if (skipped.length) {
  console.log(`\n  ℹ 跳过的条目 ${skipped.length} 处（默认不处理，逐条说明跳过了什么）：`);
  for (const s of skipped) console.log(`    · ${s.name} —— ${s.why}`);
}

// ── F7：登记表与「删掉的文件」对齐（逐态说清，绝不静默）────────────────────────
if (uploadsSync) {
  const st = uploadsSync.status;
  if (st === 'pruned') {
    console.log(`\n  ℹ 上传登记表（${UPLOADS_INDEX}）：已摘掉 ${uploadsSync.removed} 条指向已删文件的条目`
      + `（${uploadsSync.total} → ${uploadsSync.left} 条）—— 与「删文件」对称，不留幽灵条目。`);
  } else if (st === 'would-prune') {
    console.log(`\n  ℹ 上传登记表（${UPLOADS_INDEX}）：将摘掉 ${uploadsSync.removed} 条指向待删文件的条目`
      + `（${uploadsSync.total} → ${uploadsSync.total - uploadsSync.removed} 条）—— 加 --apply 才写回。`);
  } else if (st === 'no-match') {
    console.log(`\n  ℹ 上传登记表（${UPLOADS_INDEX}）：没有条目指向本次涉及的文件（${uploadsSync.total} 条原样保留）。`);
  } else if (st === 'unreadable') {
    console.log(`\n  ⚠️  上传登记表（${UPLOADS_INDEX}）读不出来（${uploadsSync.why}）`
      + ' ⇒ **一个字节都没改它**：里面可能留下指向已删文件的「幽灵条目」'
      + '（UI 按文件是否存在过滤 ⇒ 看不见）。请人工处理这个文件后重跑本命令。');
  } else if (st === 'write-failed') {
    console.log(`\n  ⚠️  上传登记表（${UPLOADS_INDEX}）写回失败（${uploadsSync.why}）`
      + ' ⇒ 可能留下指向已删文件的幽灵条目，请人工核对。');
  }
}

console.log(`\n[prune-dub] 汇总：候选 ${candidates.length} 个（${fmtBytes(candBytes)}）｜`
  + `超龄入选 ${selected.length} 个（${fmtBytes(selBytes)}）｜`
  + `${APPLY ? `实删 ${deleted} 个（${fmtBytes(deletedBytes)}）` + (missing ? `、已不存在 ${missing} 个` : '') : '未删任何东西'}｜`
  + `安全闸拦截 ${blockers.length}｜跳过 ${skipped.length}`
  + (uploadsSync && uploadsSync.status === 'pruned' ? `｜登记表摘除 ${uploadsSync.removed} 条` : ''));
if (!APPLY && selected.length) console.log('  ⇒ 确认无误后加 --apply 执行（且必须同时保留 --older-than）。');
process.exit(ok ? 0 : 1);
