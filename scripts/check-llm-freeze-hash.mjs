#!/usr/bin/env node
/**
 * scripts/check-llm-freeze-hash.mjs —— 算力模块「冻结指纹」生成 / 校验闸门
 *   （★ **写作时**本仓 `check-*` 闸门之一；★ 序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 由来（对齐参考标准的 `freeze-hash`）
 * ══════════════════════════════════════════════════════════════════════════════
 *   参考标准要求：把「模块当前内容」固化成一个**聚合指纹**，让「冻结是否被破坏」成为一条
 *   **可执行判据**，而不是靠人记得重跑某个命令。
 *   ★ 参考方踩过的坑（我们照抄其结论）：早先那份指纹其实是**清单文件自身的 sha256**，
 *     且清单**不含闸门脚本本身** ⇒ **闸门实现被改动时指纹不变**，冻结机制保护不到闸门。
 *   ⇒ 本闸门的口径（**唯一口径**）：
 *       1. 取**冻结集**（见 ③，**显式列举**，不靠目录遍历）；
 *       2. 按**相对路径（POSIX 形式）排序**；
 *       3. 对每个文件，把 `relpath + "\n"` 与其**原始字节**依次拼接；
 *       4. 对整段拼接结果取 **sha256** ⇒ 这就是**冻结指纹**。
 *      ⇒ 指纹是**全部被冻结内容的聚合**，**不是**任何清单文件的自哈希；
 *      ⇒ **闸门脚本本身在冻结集内**（改闸门 ⇒ 指纹变）；
 *      ⇒ 清单写在冻结集**之外**（`scripts/llm-freeze.manifest.json`）⇒ **无自指悖论**。
 *
 *   ★ 本项目已有**同类**机制：红线 `lemo-make.mjs` 的 md5（由 `check-redline-md5.mjs` 守）。
 *     本闸门是它的**同构扩展** —— 把「不可被无声改动」的保护从编排器扩到**算力模块 + 它的闸门**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① 指纹一致：重算聚合指纹 == 清单里的 `fingerprint`。不一致 ⇒ **FAIL**，
 *      并**逐个点名**「哪些文件变了 / 新增了 / 删掉了」（用清单里的逐文件 sha256 对比）。
 *      · 真阳长什么样：有人**无意**改了 `lib/llm-api.mjs`（或某个 `check-llm-*` 闸门）
 *        而没重新冻结 ⇒ 本闸门当场红、并指出是哪个文件。
 *      · 误报长什么样：**没有** —— 任何被冻结内容的改动**本来就该**报。
 *        （若是有意改动 ⇒ 跑 `--write` 重新冻结 + 在 `test/README.md` 登记，同红线纪律。）
 *   ② 失明守卫：冻结集为空 / 规范通路不在冻结集里 / 清单缺文件条目 ⇒ **失明（exit 2）**，
 *      不输出判据① 的结论（在失明的树上那个「一致」可能是假的）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 冻结集（**显式列举**，不靠目录遍历 —— 遍历会把「今天恰好存在的文件」冻进去，
 *      明天多一个文件就假红）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · `lib/llm-api.mjs` —— 算力模块**本体**（唯一通路）；
 *   · `scripts/check-llm-*.mjs` —— 守它的**全部闸门**（★ 含本闸门自己，见 ①）。
 *   ★ **有意不在**冻结集里：清单自身（`scripts/llm-freeze.manifest.json`，避免自指）、
 *     `test/**`（夹具随用例增减）、`web/**`（前端面板，另由 UI 用例守）、
 *     运行期状态（`<成片根>/_llm-api.json`，**每次正常使用都会变** —— 把它冻进去
 *     等于每次点面板都把闸门打红，那正是参考方踩过的「把可变的东西放进不可变快照」）。
 *
 * 用法：
 *   node scripts/check-llm-freeze-hash.mjs             # 默认 = 校验（不一致 ⇒ exit 1）
 *   node scripts/check-llm-freeze-hash.mjs --write     # 重新冻结（有意改动后跑，会改写清单）
 *   node scripts/check-llm-freeze-hash.mjs --list      # 追加逐文件清单
 *   node scripts/check-llm-freeze-hash.mjs --print     # 只打印指纹、不比对（参考方的默认行为）
 *   node scripts/check-llm-freeze-hash.mjs --json      # 机器可读
 * 退出码：0 = 一致（或 --write / --print 成功）；1 = 指纹不一致（冻结被破坏）；
 *         2 = 环境错误 / **已失明**（冻结集为空 / 规范通路缺失 / 清单缺失或不可解析）。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(path.join(HERE, '..'));
const ARGV = process.argv.slice(2);
const DO_WRITE = ARGV.includes('--write');
const DO_LIST = ARGV.includes('--list');
const DO_PRINT = ARGV.includes('--print');
const JSON_OUT = ARGV.includes('--json');

/** ★ 冻结集**成员**（相对仓根，POSIX 形式）。 */
const FROZEN_FIXED = ['lib/llm-api.mjs'];
/** ★ 冻结集**通配**（相对仓根，只在本目录内展开、不递归）。 */
const FROZEN_GLOBS = [{ dir: 'scripts', prefix: 'check-llm-', suffix: '.mjs' }];
/** ★ 规范通路（必须**在**冻结集里，否则本闸门失明）。 */
const FACADE_REL = 'lib/llm-api.mjs';
/** ★ 清单路径（**必须在冻结集之外**，否则自指）。 */
const MANIFEST_REL = 'scripts/llm-freeze.manifest.json';

const toRel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

/** ★ 展开冻结集：显式固定项 + 通配项（目录内非递归）⇒ 去重 + 按 rel 排序。 */
function frozenSet() {
  const rels = new Set();
  for (const r of FROZEN_FIXED) {
    if (fs.existsSync(path.join(ROOT, r))) rels.add(r);
  }
  for (const g of FROZEN_GLOBS) {
    const dir = path.join(ROOT, g.dir);
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      if (!e.isFile()) continue;
      if (e.name.startsWith(g.prefix) && e.name.endsWith(g.suffix)) rels.add(`${g.dir}/${e.name}`);
    }
  }
  // ★ 清单自身**绝不**入集（自指悖论）
  rels.delete(MANIFEST_REL);
  return [...rels].sort();
}

/** ★ 口径（唯一）：按 rel 排序后，`relpath + "\n"` 与**原始字节**依次拼接，取 sha256。 */
function fingerprint(rels) {
  const h = crypto.createHash('sha256');
  const files = [];
  for (const rel of rels) {
    const abs = path.join(ROOT, rel);
    let data;
    try { data = fs.readFileSync(abs); } catch { continue; }
    h.update(Buffer.from(rel + '\n', 'utf8'));
    h.update(data);
    files.push({ rel, size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') });
  }
  return { fingerprint: h.digest('hex'), files };
}

function readManifest() {
  const p = path.join(ROOT, MANIFEST_REL);
  if (!fs.existsSync(p)) return { missing: true, path: p };
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!j || typeof j.fingerprint !== 'string' || !Array.isArray(j.files)) {
      return { bad: true, path: p, reason: '缺 fingerprint 字符串 / files 数组' };
    }
    return { path: p, data: j };
  } catch (e) {
    return { bad: true, path: p, reason: `${(e && e.name) || 'Error'}: ${(e && e.message) || e}` };
  }
}

// ── 计算 + 失明守卫 ─────────────────────────────────────────────────────────
const rels = frozenSet();
const cur = fingerprint(rels);
const blind = [];
if (rels.length === 0) blind.push('冻结集为空（显式项与通配项都没展开出文件）');
if (!rels.includes(FACADE_REL)) blind.push(`规范通路 ${FACADE_REL} **不在**冻结集里 ⇒ 本闸门保护不到模块本体`);
const mf = readManifest();
if (!DO_WRITE && (mf.missing || mf.bad)) {
  blind.push(`清单不可用：${mf.path} ${mf.missing ? '**不存在**（先跑 --write 冻结）' : `**不可解析**（${mf.reason}）`}`);
}

// ── --write：重新冻结 ───────────────────────────────────────────────────────
if (DO_WRITE) {
  if (blind.length) {
    console.log('✘✘ 拒绝冻结 —— 本闸门已失明：');
    for (const b of blind) console.log(`   ✘ ${b}`);
    console.log('   ⇒ 在失明的树上写清单，等于把「什么都没冻住」盖章为「已冻结」。');
    process.exitCode = 2;
    process.exit();
  }
  const payload = {
    version: 1,
    note: '算力模块 + 其闸门的**聚合冻结指纹**。口径见 scripts/check-llm-freeze-hash.mjs 头注释 ①。'
      + '★ 有意改动被冻结内容后 ⇒ 跑 `--write` 重新冻结，并在 test/README.md 登记（同红线纪律）。',
    fingerprint: cur.fingerprint,
    count: cur.files.length,
    files: cur.files,
  };
  fs.writeFileSync(path.join(ROOT, MANIFEST_REL), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`✓ 已重新冻结：${cur.files.length} 个文件 ⇒ ${cur.fingerprint}`);
  for (const f of cur.files) console.log(`   · ${f.rel}  ${f.size}B  ${f.sha256.slice(0, 12)}…`);
  console.log(`   清单：${MANIFEST_REL}`);
  process.exitCode = 0;
  process.exit();
}

// ── 输出 ───────────────────────────────────────────────────────────────────
if (blind.length) {
  if (JSON_OUT) {
    console.log(JSON.stringify({ gate: 'check-llm-freeze-hash', root: ROOT, blind, fingerprint: cur.fingerprint, count: cur.files.length, ok: false, exit: 2 }, null, 2));
  } else {
    console.log('✘✘ 本闸门已失明：');
    for (const b of blind) console.log(`   ✘ ${b}`);
    console.log('   ⇒ 「冻结一致」这个结论**不可信**。');
    console.log('[闸门] 算力模块冻结指纹：**已失明** ⇒ 判据没可信地跑过 ✘');
  }
  process.exitCode = 2;
  process.exit();
}

const prevFp = mf.data.fingerprint;
const prevFiles = new Map(mf.data.files.map((f) => [f.rel, f]));
const curFiles = new Map(cur.files.map((f) => [f.rel, f]));

const changed = [];
for (const [rel, c] of curFiles) {
  const p = prevFiles.get(rel);
  if (!p) changed.push({ rel, kind: '新增（清单里没有）' });
  else if (p.sha256 !== c.sha256) changed.push({ rel, kind: `内容变了（${p.size}B → ${c.size}B）` });
}
for (const rel of prevFiles.keys()) if (!curFiles.has(rel)) changed.push({ rel, kind: '**已删除**（清单里有、磁盘上没有）' });

const same = prevFp === cur.fingerprint;

if (DO_PRINT) {
  console.log(`冻结指纹：${cur.fingerprint}（${cur.files.length} 个文件）`);
  if (DO_LIST) for (const f of cur.files) console.log(`   · ${f.rel}  ${f.size}B  ${f.sha256.slice(0, 12)}…`);
  process.exitCode = 0;
  process.exit();
}

if (JSON_OUT) {
  console.log(JSON.stringify({
    gate: 'check-llm-freeze-hash', root: ROOT, manifest: MANIFEST_REL,
    frozen: cur.files.map((f) => f.rel), count: cur.files.length,
    fingerprint: cur.fingerprint, manifestFingerprint: prevFp, same,
    changed, ok: same, exit: same ? 0 : 1,
  }, null, 2));
  process.exitCode = same ? 0 : 1;
  process.exit();
}

console.log('算力模块冻结指纹闸门 —— 守「被冻结内容不得被无声改动」');
console.log(`  仓根 : ${ROOT}`);
console.log(`  冻结 : ${cur.files.length} 个文件（${FROZEN_FIXED.join(' + ')} + scripts/check-llm-*.mjs）`);
console.log(`  清单 : ${MANIFEST_REL}（★ 在冻结集之外 ⇒ 无自指悖论）`);
console.log('');

if (same) {
  console.log(`✓ 判据①·指纹一致：${cur.fingerprint}`);
  if (DO_LIST) for (const f of cur.files) console.log(`   · ${f.rel}  ${f.size}B  ${f.sha256.slice(0, 12)}…`);
} else {
  console.log('✘ 判据①·**冻结被破坏** —— 指纹不一致：');
  console.log(`   清单：${prevFp}`);
  console.log(`   实际：${cur.fingerprint}`);
  console.log(`   变了 ${changed.length} 个文件：`);
  for (const c of changed) console.log(`   ✘ ${c.rel} —— ${c.kind}`);
  console.log('   ↳ 若这是**有意**改动 ⇒ 跑 `node scripts/check-llm-freeze-hash.mjs --write` 重新冻结，');
  console.log('     并在 `test/README.md` 登记这次冻结变更（同红线纪律）。');
  console.log('   ↳ 若你**不知道**它为什么变了 ⇒ 先查清再冻结（这就是本闸门要抓的东西）。');
}

console.log(`\n[闸门] 算力模块冻结指纹：${cur.files.length} 个文件 · ${same ? '一致 OK' : `不一致 ✘（${changed.length} 个文件变了）`}`);
process.exitCode = same ? 0 : 1;
