#!/usr/bin/env node
/**
 * scripts/check-lexicon-coverage.mjs —— 「风格声明的 tag 与规则词表对得上吗」的**词表覆盖闸门**
 *
 * ★ 由来（2026-10-04）：`lib/dub-lexicon.mjs` 是**规则兜底**用的中文词表，按 tag 字面量组织
 *   （`TAG_LEXICON.theme[tag] = [用户会打的触发词...]`）；`lib/dub-styles.json` 每个风格声明
 *   `tags.{theme,emotion,scene,pace}`。规则路（`lib/dub-semantic.mjs`）用 `indexOf` 做**子串匹配**，
 *   命中即给该风格加分。⇒ 若新增风格时用了**词表里没有的 tag**，规则路**永远匹配不到它**：
 *   **输出照出、只是永远选不中该风格**。这类缺陷是**静默**的（没人会去数 tag 有没有 bucket），
 *   只能靠机械比对拦住。本闸门即 `lib/dub-lexicon.mjs:218` 那句注释「快速自检」的**自动化、双向**版本。
 *
 * 判据（机械可解释）：
 *   A. 漏登记（**判 FAIL**）：`lib/dub-styles.json` 的 `styles[].tags` 里出现的每个 tag，都必须在
 *      `TAG_LEXICON` 的**同维度**里有 bucket。**用 `lexiconCoverage()` 实现，不重写一遍逻辑。**
 *      报出 `slug → 维度:tag`。
 *   B. 死词条（**只列 backlog，不判 FAIL**）：`TAG_LEXICON` 里有、但**没有任何风格**使用的 tag。
 *      这是「词表膨胀」的参考信息，不是错误（可能是为将来预留）。符合本项目纪律：
 *      「已记录积压」不判 FAIL，「没人记过的新问题」才判 FAIL。
 *
 * 已知局限 / 会误报的边界：
 *   · 只做**存在性**判定，不检查触发词质量，也不做同义词/歧义分析 —— 词表里两条 tag 共用同一个
 *     触发词是**已知现状**（见 `test/dub-lexicon.test.mjs` 的「跨 tag 共用」冻结用例），本闸门不判它 FAIL。
 *     （★ 但「同一 bucket 内把同一个词写两遍」**不属此类** —— 它会让 `hits()` 重复计数、
 *      虚增该 tag 命中数、影响 `rank()` 排序，已作为**真缺陷**修掉，并由测试钉为硬不变量。）
 *   · 维度是**硬编码四维** theme/emotion/scene/pace —— 若未来 `TAG_LEXICON` 扩维度，
 *     本闸门需同步加维度名，否则新维度不参与检查（属**假阴性**）。
 *   · 只读 `lib/dub-styles.json`，不校验该文件本身的 schema（那是 `check-dub-styles.mjs` 的事）。
 *   · ★ `styles` 不是**非空数组**时**判 FAIL**（防空转绿灯）—— 否则 schema 一变，本闸门会
 *     静默枚举到 0 个风格、报「0 处漏登记」并**绿灯通过**，比不检查更危险。
 *
 * ★ 路径**基于脚本自身位置推导**（`import.meta.url` → `..`），**不写死 `D:/lemo-tools`**：
 *   这样才能把 `lib/` 与 `scripts/` 一起拷到临时目录做**变异测试**（本项目已发生过的教训：
 *   直接改真实数据做反向测试、中途被打断，假数据留在库里）。现有部分闸门写死了绝对路径，
 *   拷出去就跑不动、也就没法做反向测试 —— 本闸门刻意不学那种写法。
 *
 * 用法：node scripts/check-lexicon-coverage.mjs [--json]
 * 退出码：A 类有漏登记 → 1；否则 0（B 类不影响退出码）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TAG_LEXICON, lexiconCoverage } from '../lib/dub-lexicon.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STYLES_JSON = path.join(ROOT, 'lib', 'dub-styles.json');
const DIMS = ['theme', 'emotion', 'scene', 'pace'];
const JSON_OUT = process.argv.includes('--json');

// ── 读风格表 ──────────────────────────────────────────────────
// ★ 防空转绿灯：若 schema 变了（例如 `styles` 从数组变成 `{slug: {...}}` 映射），
//   朴素的 `Array.isArray(...) ? ... : []` 会**静默得到空数组** ⇒ A 类报「0 处漏登记」
//   ⇒ 闸门**绿灯通过，其实什么都没检查**。这类「检查器失明却报绿」比不检查更危险，
//   故这里显式判 FAIL 并说明失明原因。
let styles = [];
let raw = null;
try {
  raw = JSON.parse(fs.readFileSync(STYLES_JSON, 'utf8'));
} catch (e) {
  console.log(`✘ 读不了 ${STYLES_JSON}：${(e && e.message) || e}`);
  console.log('\n[闸门] 词表覆盖 ✘');
  process.exitCode = 1;
  process.exit();
}
if (!Array.isArray(raw.styles) || !raw.styles.length) {
  const got = raw.styles === undefined ? 'undefined（缺字段）'
    : Array.isArray(raw.styles) ? '空数组'
      : `${typeof raw.styles}（${Array.isArray(raw.styles) ? '' : '疑似改成映射了？'}）`;
  console.log(`✘ ${STYLES_JSON} 的 \`styles\` 不是**非空数组**（实得：${got}）——`);
  console.log('  本闸门已**失明**：无法枚举风格，任何「0 处漏登记」都是假的。');
  console.log('  请先修 schema，或同步修改本闸门的读法，然后再信它的结论。');
  console.log('\n[闸门] 词表覆盖 ✘（schema 不符，无法判定）');
  process.exitCode = 1;
  process.exit();
}
styles = raw.styles;

// ── A. 漏登记（判 FAIL）—— 直接用 lexiconCoverage，不重写逻辑 ──
const missing = []; // { slug, dim, tag }
for (const s of styles) {
  const slug = s.slug || s.id || '(未命名)';
  const miss = lexiconCoverage(s.tags || {});
  for (const dim of DIMS) {
    for (const tag of miss[dim]) missing.push({ slug, dim, tag });
  }
}

// ── B. 死词条（只列 backlog，不判 FAIL）────────────────────────
const used = new Set();
for (const s of styles) {
  for (const dim of DIMS) {
    for (const tag of (s.tags && s.tags[dim]) || []) used.add(`${dim}:${tag}`);
  }
}
const dead = []; // { dim, tag }
for (const dim of DIMS) {
  for (const tag of Object.keys(TAG_LEXICON[dim] || {})) {
    if (!used.has(`${dim}:${tag}`)) dead.push({ dim, tag });
  }
}

// ── 输出 ──────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({
    styles: styles.length,
    missing,             // A 类：漏登记（判 FAIL）
    dead,                // B 类：死词条（backlog，不判 FAIL）
    ok: missing.length === 0,
  }, null, 2));
} else {
  console.log(`lib/dub-styles.json：${styles.length} 个风格；TAG_LEXICON：${DIMS.map((d) => `${d} ${Object.keys(TAG_LEXICON[d] || {}).length}`).join('、')} 个 tag`);

  if (missing.length) {
    console.log(`\n✘ A 类·漏登记 ${missing.length} 处（规则路永远匹配不到，判 FAIL）：`);
    for (const m of missing) console.log(`  ✘ ${m.slug} → ${m.dim}:${m.tag}`);
    console.log('\n修法：在 lib/dub-lexicon.mjs 的对应维度里给该 tag 补一个「tag: [触发词...]」bucket，');
    console.log('      或把风格的 tags 改成词表里已有的 tag（两者取其一，取决于该风格的真实语义）。');
  } else {
    console.log('\n✓ A 类·漏登记 0 处：所有风格的 tag 都能在词表同维度里找到 bucket。');
  }

  console.log(`\nℹ B 类·死词条（词表里有、无任何风格使用）${dead.length} 个 —— 仅参考，不判 FAIL：`);
  for (const d of dead) console.log(`  · ${d.dim}:${d.tag}`);
  if (!dead.length) console.log('  （无）');
}

console.log(`\n[闸门] 词表覆盖：漏登记 ${missing.length} 处、死词条 backlog ${dead.length} 个 ${missing.length ? '✘' : 'OK'}`);
process.exitCode = missing.length ? 1 : 0;
