#!/usr/bin/env node
/**
 * scripts/check-aspect-prose.mjs —— 「画幅论述」与「实际画幅能力声明」是否互相矛盾
 *   ★ 论述来源**两处都查**：`lib/style-skills/<slug>/SKILL.md`（§2/§9/§11）**和**
 *     `lib/style-skills/<slug>/_distill.json`（`limits[]` / `defects[]` / `assetGaps[]` /
 *     `resolvedDefects[]` / `selfCheck.warnings[]`）。
 *
 * ★ ① 由来（拦的缺陷，2026-10-04 立）：
 *   事实源是 `lib/aspects.mjs` 的 `styleAspects(slug)` —— 它读 `styles/<slug>/demo/film*.js` 的
 *   `FILM_META.aspects` **字面量**（文本探测，不 import），返回 `{declared, supported}`。
 *   本库语义：**没声明 `aspects` = 只支持 16:9**（`lib/aspects.mjs:14-15,29-31`）。
 *   文档源是 `lib/style-skills/<slug>/SKILL.md` 的 §2 / §9 / §11，会写「无 `aspects` 声明 = 只支持 16:9」
 *   「9:16 会裁掉右侧 43.75%」「架构级缺陷」这类论述。
 *   ★ 实测事故一：某风格**已被改造为支持 9:16**，但它的 `SKILL.md` **只改了一半** —— 还残留 1 处
 *   「只支持 16:9」。**当时 21 个闸门全绿，没有一个能发现它**，是人工 `grep -c "只支持 16:9"` 才抓到的。
 *   这就是本项目最忌讳的那类「**文档撒谎 / 人读到的与机器读到的不同**」，而它**完全可以机械化拦住**。
 *   ★ 实测事故二（2026-10-04 扩面）：**同一句谎话还躺在 `_distill.json` 里** —— 42 个风格改造为支持
 *   9:16 后，`SKILL.md` 改了，但 `_distill.json` 的 `limits[]` / `defects[]` 仍写着「无 aspects 声明 /
 *   9:16 不可用 / 会裁掉右侧 43.75%」。而 `_distill.json` 是**机器可读**的（`lib/style-skill-reader.mjs`
 *   是唯一读取入口，下游会读到），于是「SKILL.md 改了、json 没改」= **另一种静默撒谎**，与事故一同类。
 *   ⇒ 本闸门**扩展为同时读这两处**，判据、历史豁免口径完全一致。
 *
 * ★ ② 判据（机械、可解释，**双向都查**；对 SKILL.md 与 `_distill.json` **同一套判据**）：
 *   对每个风格（枚举 `lib/style-skills/<slug>/SKILL.md` 的 slug；风格源码根取 `lib/aspects.mjs` 的
 *   `STYLES_DIR`，**不另抄一份**），取 `styleAspects(slug)` 的 `declared` / `supported`：
 *     · **正向（FAIL）**：若 `declared === true` 且 `supported` 含 `9:16`，而论述里**仍有**
 *       「只支持 16:9」「9:16 不可用 / 不适配」「会裁掉右侧 43.75%」「架构级缺陷」这类**否定式声称**
 *       ⇒ 该条记 FAIL（机器侧事实：本风格**已支持** 9:16）。
 *     · **反向（FAIL）**：若 `declared === false`（或 `supported` 不含 `9:16`），而论述声称
 *       「已适配 9:16」「已支持竖屏」⇒ FAIL（这是另一种撒谎，同样有害）。
 *     · 与否定/肯定**无关**的「只支持 16:9」在**未支持**的风格里是**正确**论述 ⇒ 不报（不误伤）。
 *   · **扫描单元**：SKILL.md 按**整行**为单元；`_distill.json` 按**每个字符串字段元素**为单元
 *     （一个 `limits[i]` / `defects[i]` / `selfCheck.warnings[i]` 就是一条论述）。
 *
 *   ★ 历史语境豁免（与 `scripts/check-tp-prose.mjs` **同源**）：项目习惯是**保留原句 + 加历史标记**，
 *     所以「整行」含历史标记（`已修` / `原记` / `已作废` / `旧文档` …）的**不算 FAIL**，单列「已标记历史」。
 *     ★ **防「一刀切豁免」**（一行里既有历史标记、又是当前结论）：本项目刚踩过「给已改正确的行加历史
 *     标记 ⇒ 被闸门豁免」的坑，所以这里加了两道保险：
 *       (A) **锚定豁免**：只有当否定/肯定声称**位于引号（`「…」`/`『…』`/`“…”`）或删除线（`~~…~~`）之内**时，
 *           才按「引用的旧句」豁免 —— 因为「保留原句」的写法一定是**引起来 / 划掉**的。
 *       (B) **整行豁免 + 当前结论守卫**：整行有历史标记也豁免，**但若该行同时含「当前结论」类标记**
 *           （`现状` / `当前结论` / `目前` / `仍然` / `依旧`）⇒ **不豁免，照判 FAIL**。
 *           依据：既引旧句、又平铺直叙把负向/正向重申为**当前状态**的行，正是「只改了一半」的残留，
 *           必须报出来；豁免的是「历史记录」，不是「披着历史外衣的当前结论」。
 *     ★ 交叉引用：行内提到**别的风格名**的，单列「交叉引用」不计 FAIL（与 `check-tp-prose` 同源）。
 *
 * ★ ③ 已知局限（★ 如实写明）：
 *   · **只读**：不跑渲染、不加载模型、不改任何 `SKILL.md` / `_distill.json` / 源码。只读文本。
 *   · **不做语义理解**：靠正则匹配「否定式 / 肯定式画幅声称」的字面说法；换一种全新措辞（本闸门词表未覆盖）
 *     会**假阴**（漏报）。已知词表见 `NEG` / `POS` 常量。
 *   · 「支持 9:16」只认 `declared && supported.includes('9:16')`。`styleAspects()` 是**文本探测**，
 *     `aspects` 写得不合法 / 藏在注释里都可能漏（与 `lib/aspects.mjs` 同一局限）。
 *   · ★ 事实源必须在 **Windows 侧**跑：`styleAspects()` 走 `lib/env.mjs` 的 `CFG.winLib`；在 WSL 里跑会
 *     降级成默认值、把**全部**风格误报成 `declared=false` ⇒ 反向判据会大面积误报。本脚本不阻止，
 *     但会在结论里打印事实源路径，便于人工识别。
 *     ★ 2026-10-07 非破坏夹具复现补记（判定：**不加**签名守卫）：
 *       · 事实源指错树时**不是假绿，而是「方向级误报」** —— 文档里的肯定式声称被**大面积**判 FAIL
 *         （真语料实测：错树 152 处矛盾、exit 1；小夹具 3/3 矛盾、exit 1）。闸门**没有失明**，只是判错方向，
 *         且首行会打印「声明支持 9:16 0 个」（真语料应为 42），异常一眼可见 ⇒ 已足够响。
 *       · 唯一的**静默**情形是「事实源错报 `declared=false` **且**文档全是否定式（零肯定式声称）」：
 *         此时与「全部风格本就只支持 16:9、文档如实陈述」在**文本上不可分辨**，闸门无从判失明（C2 夹具实测 exit 0）。
 *       · ⇒ 故**不**新增守卫。拟议签名「`probedOk>0` 且 `declared===true` 数为 0 且肯定式声称数>0」**两头不讨好**：
 *         它抓不到上述静默情形（那情形没有肯定式声称），却会在「新项目 0 个声明 aspects + 文档虚称已支持 9:16」
 *         这种**真缺陷**上误报失明（反向判据正是为抓它而设）⇒ 会掩盖真缺陷。宁可如实写明局限，不凑数。
 *   · `_distill.json` 只扫**论述字段**（`limits` / `defects` / `assetGaps` / `resolvedDefects` /
 *     `selfCheck.warnings`），**不扫** `sources` / `evidenceFrames` / `generatedVideo` 等事实字段
 *     —— 那些不是「论述」，且**绝不**应因本闸门被改写。
 *   · **防空转失明**：风格文档目录不存在 / 枚举到 0 个风格 / 事实源目录不存在 /
 *     `styleAspects()` 对全部风格都探不到影片模块 / **一份 `_distill.json` 都读不到** ⇒
 *     **判 FAIL 并明说「本闸门已失明」**。
 *   · 路径**基于脚本自身位置推导**，允许覆盖（仅供变异测试，绝不动真实文件）：
 *       `LEMO_SKILL_ROOT`（默认 `<脚本>/../lib/style-skills`，本闸门**真正枚举**的文档目录）、
 *       `LEMO_STYLES_ROOT`（默认 `lib/aspects.mjs` 的 `STYLES_DIR`）。
 *       ★ 2026-10-07 更新：`lib/aspects.mjs` 的 `STYLES_DIR` 现已支持 `LEMO_STYLES_ROOT` 覆盖 ⇒ 它**同时**
 *         驱动本闸门的失明探测**与** `styleAspects()` 的事实探测（两者读**同一棵树**）；不设时逐字节等价于旧行为。
 *         于是本闸门可把事实源指向**假风格树**做非破坏反向测试（旧版做不到 —— 事实源写死、覆盖不到）。
 *
 * ★ ④ 退出码语义：
 *   · `0` = 无异常；
 *   · `1` = 有 FAIL（正向 / 反向矛盾）**或本闸门失明**；
 *   · `2` = 读不到输入（目录存在却列不出来 / 某份 SKILL.md 或 `_distill.json` 读失败）。
 *
 * ★ ⑤ 用法：
 *   · `node scripts/check-aspect-prose.mjs` —— **默认查全部 43 个风格**（并行改造收工后的总检就用这个）。
 *   · `--ignore <slug,slug,...>`（或 `LEMO_ASPECT_PROSE_IGNORE` 环境变量）—— 把**正在被并行任务改造**
 *     的风格排除出退出码（其矛盾仍如实列出，归入「已忽略（在途）」段，**不判 FAIL**）。
 *     ★ 这是显式开关、**不是硬编码豁免** —— 不传就一个都不放过；只为「在途工作」提供临时旁路。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── 复用库侧唯一实现（事实源），不另抄一份 ─────────────────────────────────────
import { styleAspects, STYLES_DIR } from '../lib/aspects.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(
  process.env.LEMO_SKILL_ROOT || path.join(HERE, '..', 'lib', 'style-skills'));
const STYLES_ROOT = path.resolve(process.env.LEMO_STYLES_ROOT || STYLES_DIR);

/** 模板目录（`_TEMPLATE`）不是风格，不参与判据。 */
const isTemplate = (n) => n.startsWith('_') || n.startsWith('.');

/** 「在途风格」旁路（显式开关，见头注释 ⑤）：这些 slug 的矛盾仍列出，但不计入退出码。 */
const IGNORE = new Set(
  (() => {
    const argv = process.argv.slice(2);
    const i = argv.findIndex((a) => a === '--ignore');
    const inline = argv.find((a) => a.startsWith('--ignore='));
    const raw = i >= 0 ? (argv[i + 1] || '')
      : inline ? inline.slice('--ignore='.length)
        : (process.env.LEMO_ASPECT_PROSE_IGNORE || '');
    return raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  })(),
);

/** 历史语境标记（与 `check-tp-prose.mjs` 同源，另补本闸门实测需要的几个）。
 *  ★ 用 `已作废` 而非 `作废`：实测 `spy-titles/_distill.json` 的「横向追逐段落基本作废」是**描述损坏**、
 *    不是历史标记，`作废` 会把这条真矛盾**误豁免**（`SKILL.md` 侧 9 处合法用法全是「已作废」，零误伤）。 */
const HIST = /已修|原为|原记|原先|曾是|曾为|曾记|历史|修复前|修复后|校正|拆分|移入|resolvedDefects|已作废|旧文档|旧版|旧源|不再成立|已完成/;
/** ★ 当前结论标记 —— 一行里同时出现它 + 历史标记 ⇒ **不豁免**（防「一刀切豁免」，见头注释 ②）。 */
const CUR = /现状|当前结论|目前|仍然|依旧|仍是只|仍只/;

/** 否定式画幅声称（= 本风格**不**支持 9:16）。命中于「已支持 9:16」的风格时 ⇒ FAIL。
 *  ★ `9:16 不可用` / `1:1 左上角` 留了短语间隔（实测 json 写「9:16（产品默认）不可用」「1:1 塞在左上角」）；
 *    但**不**把裸 `裁切`/`裁掉` 收进来 —— SKILL.md 的正面证据句「9:16 vs 16:9 中心裁切 SSIM」会因此误报。 */
const NEG = [
  ['只支持 16:9', /只支持\s*16\s*:\s*9/g],
  ['未声明 aspects', /(?:未|无|没有|没)\s*声明\s*`?aspects`?/g],
  ['无 aspects 声明', /无\s*`?aspects`?\s*声明/g],
  ['全目录 grep aspects 无命中', /全目录\s*grep\s*`?aspects`?/g],
  ['9:16 不可用/不适配', /9\s*:\s*16[^，。；\n]{0,14}(?:不可用|不适配|不能用|不可行)/g],
  ['9:16 会裁/丢/被切', /9\s*:\s*16[^，。；\n]{0,10}(?:会裁|会被裁|会丢|丢失|下丢|被切)/g],
  ['右侧 43.75%', /43\.75\s*%/g],
  ['架构级缺陷', /架构级缺陷/g],
  ['未声明竖屏', /未声明竖屏/g],
  ['1:1 塞在/进左上角', /1\s*:\s*1[^，。；\n]{0,8}左上角/g],
  ['整片黑', /整片黑/g],
  ['硬渲 9:16', /硬渲[^，。；\n]{0,8}9\s*:\s*16/g],
];

/** 肯定式画幅声称（= 本风格**已**支持 9:16）。命中于「未支持 9:16」的风格时 ⇒ FAIL。 */
const POS = [
  ['已适配 9:16', /已适配\s*9\s*:\s*16/g],
  ['已支持 9:16', /已支持\s*9\s*:\s*16/g],
  ['已支持竖屏/竖版', /已支持\s*(?:竖屏|竖版)/g],
  ['已适配竖屏/竖版', /已适配\s*(?:竖屏|竖版)/g],
  ['可直接出竖屏', /可直接出竖屏/g],
  ['aspects 字面量含 9:16', /aspects\s*[:=]\s*\[[^\]]*9\s*:\s*16/g],
];

/** 否定前缀（`不支持 9:16` / `未适配 9:16` 不能被当成肯定声称）。 */
const NEG_PREFIX = /[不未没无难]/;

/** `idx` 是否落在 `line` 里某对 `open…close` 之内（含删除线 `~~…~~`，此时 open===close）。 */
function insideSpan(line, idx, open, close) {
  let from = 0;
  for (;;) {
    const a = line.indexOf(open, from);
    if (a < 0) return false;
    const b = line.indexOf(close, a + open.length);
    if (b < 0) return false;
    if (idx > a && idx < b) return true;
    from = b + close.length;
  }
}

/** 命中点是否被「引用 / 划掉」——即「保留原句」的两种合法写法。 */
function anchoredHistory(line, idx) {
  if (insideSpan(line, idx, '~~', '~~')) return true;
  for (const [o, c] of [['「', '」'], ['『', '』'], ['“', '”']]) {
    if (insideSpan(line, idx, o, c)) return true;
  }
  return false;
}

/** 命中点前 1 个字是否否定前缀（`不支持 9:16` 这类不能当肯定声称）。 */
function precededByNegation(line, idx) {
  return idx > 0 && NEG_PREFIX.test(line[idx - 1]);
}

// ── 失明守卫（防空转绿灯）────────────────────────────────────────────────────
const blindReasons = [];
let slugs = [];

if (!fs.existsSync(SKILL_ROOT)) {
  blindReasons.push(`风格文档目录不存在：${SKILL_ROOT}`);
} else {
  let entries;
  try {
    entries = fs.readdirSync(SKILL_ROOT, { withFileTypes: true });
  } catch (e) {
    console.error(`读不到输入：无法列出风格文档目录 ${SKILL_ROOT}：${e.message}`);
    process.exit(2);
  }
  slugs = entries
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !isTemplate(n))
    .filter((n) => fs.existsSync(path.join(SKILL_ROOT, n, 'SKILL.md')))
    .sort();
  if (slugs.length === 0) blindReasons.push(`枚举到 0 个风格（${SKILL_ROOT}）：路径/过滤变了？`);
}
if (!fs.existsSync(STYLES_ROOT)) {
  blindReasons.push(`风格源码目录不存在：${STYLES_ROOT}（styleAspects() 读不到任何声明）`);
}

// ── 逐风格：论述（SKILL.md 整行 + _distill.json 论述字段）vs 机器侧能力声明 ─────
const fails = [];        // 异常明细（FAIL）
const ignored = [];      // 「在途风格」旁路命中（见头注释 ⑤）
const refs = [];         // 参考项（已标记历史）
const xrefs = [];        // 交叉引用（单元内提到别的风格）
const rows = [];         // 逐风格事实（供汇总/调试）
let probedOk = 0;        // 能探到影片模块的风格数
let jsonOk = 0;          // 能读到 _distill.json 的风格数

/** `_distill.json` 里承载「论述」的字段（**不扫** `sources` / `generatedVideo` 等事实字段）。 */
const JSON_FIELDS = ['limits', 'defects', 'assetGaps', 'resolvedDefects', 'selfCheck.warnings'];

for (const slug of slugs) {
  const mdFile = path.join(SKILL_ROOT, slug, 'SKILL.md');
  let md;
  try {
    md = fs.readFileSync(mdFile, 'utf8');
  } catch (e) {
    console.error(`读不到输入：${mdFile}：${e.message}`);
    process.exit(2);
  }

  const asp = styleAspects(slug);
  const supports9 = !!asp.declared && Array.isArray(asp.supported) && asp.supported.includes('9:16');
  if (asp.films && asp.films.length > 0) probedOk++;
  rows.push({ slug, declared: !!asp.declared, supported: asp.supported.join(','), supports9 });
  const others = slugs.filter((s) => s !== slug);

  // 扫一个「论述单元」：SKILL.md 的**一整行** / json 的**一个字符串元素**（判据完全一致）
  const scanUnit = (unit, source) => {
    const histUnit = HIST.test(unit);
    const curUnit = CUR.test(unit);
    const classify = (name, idx, side) => {
      const anchored = anchoredHistory(unit, idx);
      const historical = anchored || (histUnit && !curUnit);   // 两道保险见头注释 ②
      if (historical) { refs.push({ slug, source, name, side, unit }); return; }
      if (others.some((o) => unit.includes(o))) { xrefs.push({ slug, source, name, side, unit }); return; }
      if (IGNORE.has(slug)) { ignored.push({ slug, source, name, side, unit, fact: asp }); return; }
      fails.push({ slug, source, name, side, unit, fact: asp });
    };

    for (const [name, re] of NEG) {
      for (const m of unit.matchAll(re)) {
        // 未支持 9:16 的风格里，「只支持 16:9」是**正确**论述 ⇒ 不报。
        if (!supports9) continue;
        classify(name, m.index, '正向');
      }
    }
    for (const [name, re] of POS) {
      for (const m of unit.matchAll(re)) {
        if (supports9) continue;                        // 已支持 ⇒ 肯定声称正确，不报
        if (precededByNegation(unit, m.index)) continue; // 「不支持 9:16」不是肯定声称
        classify(name, m.index, '反向');
      }
    }
  };

  // ① SKILL.md —— 按整行扫
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) scanUnit(lines[i], `SKILL.md:${i + 1}`);

  // ② _distill.json —— 按论述字段的字符串元素扫
  const jsonFile = path.join(SKILL_ROOT, slug, '_distill.json');
  if (fs.existsSync(jsonFile)) {
    let j;
    try {
      j = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    } catch (e) {
      console.error(`读不到输入：${jsonFile}：${e.message}`);
      process.exit(2);
    }
    jsonOk++;
    for (const field of JSON_FIELDS) {
      const arr = field.split('.').reduce((o, k) => (o == null ? o : o[k]), j);
      if (!Array.isArray(arr)) continue;
      arr.forEach((el, i) => {
        if (typeof el !== 'string' || !el.trim()) return;
        scanUnit(el, `_distill.json:${field}[${i}]`);
      });
    }
  }
}

// ── 事实源 / json 整体探不到 ⇒ 失明 ─────────────────────────────────────────
if (slugs.length > 0 && probedOk === 0) {
  blindReasons.push(`styleAspects() 对全部 ${slugs.length} 个风格都探不到影片模块（事实源不可用）`);
}
if (slugs.length > 0 && jsonOk === 0) {
  blindReasons.push(`一份 _distill.json 都读不到（${SKILL_ROOT}）：路径/过滤变了？`);
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
const blind = blindReasons.length > 0;
const ok = !blind && fails.length === 0;
const supCount = rows.filter((r) => r.supports9).length;

console.log('画幅论述闸门 —— 论述（SKILL.md + _distill.json）是否与机器侧的能力声明互相矛盾（双向）');
console.log(`  风格文档: ${SKILL_ROOT}`);
console.log(`  风格源码: ${STYLES_ROOT}（事实源，须在 Windows 侧跑）`);
console.log(`  风格 ${slugs.length} 个：声明支持 9:16 ${supCount} 个、只支持 16:9 ${slugs.length - supCount} 个`);
console.log(`  论述来源：SKILL.md 整行 + _distill.json 的 ${JSON_FIELDS.join(' / ')}（读到 json ${jsonOk} 份）\n`);

if (fails.length) {
  console.log(`✘ 发现 ${fails.length} 处「画幅论述与能力声明矛盾」（含来源，改哪个文件一目了然）：\n`);
  for (const f of fails) {
    const fact = f.side === '正向'
      ? `机器侧：declared=true 且 supported=[${f.fact.supported.join(', ')}]（**已支持 9:16**）`
      : `机器侧：declared=${f.fact.declared} 且 supported=[${f.fact.supported.join(', ')}]（**未支持 9:16**）`;
    console.log(`  ${String(f.slug).padEnd(20)} ${String(f.source).padEnd(30)} [${f.side}·${f.name}]`);
    console.log(`      ${f.unit.trim().slice(0, 150)}`);
    console.log(`      ${fact}`);
  }
  console.log('');
}

if (ignored.length) {
  const bySlug = {};
  for (const g of ignored) bySlug[g.slug] = (bySlug[g.slug] || 0) + 1;
  console.log(`⚠ 已忽略（在途风格，不计入退出码）${ignored.length} 处 —— 并行任务收工后应复检：`);
  for (const [k, v] of Object.entries(bySlug)) console.log(`  ${k.padEnd(20)} ${v} 处`);
  console.log('');
}

if (refs.length) {
  const bySlug = {};
  for (const r of refs) bySlug[r.slug] = (bySlug[r.slug] || 0) + 1;
  console.log(`ℹ 已标记历史（保留原句 + 历史标记 / 引号或删除线内）${refs.length} 处 —— 不计 FAIL，供参考：`);
  for (const [k, v] of Object.entries(bySlug)) console.log(`  ${k.padEnd(20)} ${v} 处`);
  console.log('');
}

if (xrefs.length) {
  console.log(`ℹ 交叉引用（单元内提到别的风格，可能是引用他片先例）${xrefs.length} 处 —— 不计 FAIL，供人工判断：`);
  for (const x of xrefs.slice(0, 20)) {
    console.log(`  ${String(x.slug).padEnd(20)} ${String(x.source).padEnd(30)} [${x.side}·${x.name}]`);
  }
  console.log('');
}

if (blind) {
  console.log('✘✘ 本闸门已**失明**，结论不可信：');
  for (const r of blindReasons) console.log(`   ✘ ${r}`);
  console.log('');
} else if (fails.length === 0) {
  console.log(`✓ ${supCount} 个已支持 9:16 的风格，其论述（SKILL.md + _distill.json）没有残留「只支持 16:9 / `
    + `9:16 不可用」类否定式声称；${slugs.length - supCount} 个未支持的风格，其论述没有虚称「已适配 9:16」。`);
  console.log('');
}

console.log(`[闸门] 画幅论述：风格 ${slugs.length} 个（支持 9:16 ${supCount} 个）、矛盾 ${fails.length} 处、`
  + `已标记历史 ${refs.length} 处（参考）、交叉引用 ${xrefs.length} 处（参考）`
  + `${ignored.length ? `、已忽略在途 ${ignored.length} 处` : ''}`
  + `${blind ? '、**已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exit(ok ? 0 : 1);
