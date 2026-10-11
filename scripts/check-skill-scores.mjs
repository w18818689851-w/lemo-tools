#!/usr/bin/env node
/**
 * scripts/check-skill-scores.mjs —— 43 份风格 Skill 文档的**评分自洽性**校验
 *
 * ★ 为什么需要它（2026-10-03 立的由来）：
 *   `lib/dub-styles.json` 的配置被改过之后（palette 色值、`bgRecipe.texture` 等），
 *   文档里的 `defects` **不会自动跟着更新** —— 于是文档会**长期按已修好的问题扣分**，
 *   `matchScore` 被系统性低估，误导「按 Skill 文档决策」的下游生成。
 *   实测一次就查出 6 条已失效的扣分（涉及 5 个风格）。
 *
 * 查三件事：
 *   ① 每份 `_distill.json` 的 `matchScore` == `scoreBreakdown` 五项之和（palette/composition/typography/rhythm/audio）；
 *   ② `defects` 里不再有「能被当前配置值**直接证伪**」的条目；
 *   ③ `SKILL.md` 的「风格匹配度自评」== 同目录 `_distill.json` 的 `matchScore`（人读文档与机器数据**必须同源**）。
 *      ③ 的由来（2026-10-03 实踩）：拆完 `backrooms` 的混合缺陷、把 json 从 90 提到 91 后，
 *      **忘了同步 SKILL.md 的正文**，于是人读到 90、下游读 json 得到 91 —— 同一个数字两个答案。
 *      这类「改了一处忘了另一处」只能靠机械比对拦住。
 *
 * 「直接证伪」的机械判据（与校正口径一致）：
 *   条目点名了配置字段并引用了具体值（texture / fontFamily / palette 系 hex），
 *   若该值 ≠ 当前 `lib/dub-styles.json` 的实际值 ⇒ 该断言被证伪。
 *   · 条目里**所有**被抽取的配置值断言都被证伪 ⇒ 「全失效」（不该再留在 defects）→ FAIL；
 *   · 只有**部分**被证伪、且条目仍引用当前配置里存在的值 ⇒ 「混合条目」→ WARN，需人工复核。
 *
 * ★ 「仍引用当前配置值」的判据（2026-10-06 收紧；修一个已实测的假绿）：
 *   旧判据 = `[...txt.matchAll(/#hex/g)].some(m => cfgText.includes(hex))`，其中
 *   `cfgText = JSON.stringify(该风格的配置条目).toUpperCase()` —— 在**整份配置条目的文本**里
 *   做子串搜索。于是只要 defect 文本里出现**任何一个「在配置里出现过」的 hex**（哪怕是
 *   **别的字段**的色，例如 `subtitle.plateColor`），就被判成「仍引用当前配置值」⇒ 把本该
 *   FAIL 的「全失效」降级成 WARN 的「混合条目」（假绿，exit 0）。
 *   实测夹具（`D:/lemo-tmp/agent-matchaudit/fx-scores` vs `fx-scores-control`，唯一差别是
 *   defect 尾部多一句别的字段的 hex）：
 *     defect = `bgRecipe.texture 写成 grain（实际是 paper）`，配置 texture=paper、
 *     `subtitle.plateColor=#AABBCC` —— 尾部加「另见背景 #AABBCC 的说明」即从
 *     `[2] 全失效 1 条 ✘ exit 1` 变成 `⚠ 混合条目 … [2] 全失效 0 条 OK exit 0`。
 *   新判据（**复用下面同一次断言抽取的结果，不另起一套正则**）：**逐条**看被抽取的断言 ——
 *   若该断言引用的值 **== 它所涉字段的当前值**（`texture` ↔ `bgRecipe.texture`、
 *   `fontFamily` ↔ `subtitle.fontFamily`、`bg/bg2/fg/accent/subtitle` ↔ `palette.<field>`），
 *   则该断言**未被证伪**，记一次 `citesCurrent`。只有 `citesCurrent > 0` 才是「混合条目」
 *   （部分断言仍成立）。即判据从「**配置里任何地方**出现过这个值」收窄为
 *   「**本条所涉字段**的当前值」。注意「实际是 paper」这类**修正句**不会被计（它没有
 *   `texture <分隔符>` 形式，抽不到断言）—— 这正是与旧假绿的分界。
 *   误报率（铁律：先测再定稿）：真实 43 份上被抽取断言 22 条、**有证伪的条目 0 条**
 *   ⇒ 新判据在真实语料上连一次都没被触发，`[1]/[2]/[3]` 三项与改动前**逐字一致**（exit 0）。
 *
 * ★★ 失明守卫②（2026-10-11 补；治「判据② 静默空转」—— 同型闸门都补了、唯独本闸门漏了的那条）：
 *   判据② 是**纯正则抽取**型判据（从 `defects` 散文里抽 `texture` / `fontFamily` / `palette` 断言）。
 *   旧版只在「一个带 `_distill.json` 的风格都枚举不到」时判失明；**抽取命中数 = 0 时它照打
 *   「共 0 条 … OK」+ exit 0**。⇒ 一个**真的过期**的 defect（配置 `bgRecipe.texture = "paper"`、
 *   文档写「底纹用的是 grain，与实际配置不符（应为 paper）」）只要**不含可抽取的英文字段名 token**
 *   就被**静默放过**；而三条抽取正则中任意一条被改动、或语料被重新生成 / 改写成中文措辞 ⇒
 *   **全部**过期 defect 会**一次性**退出抽取集，闸门仍报 `OK`。
 *   实测（审计夹具 `D:/lemo-tmp/lemo-fix/h1/only`，1 个风格 / 1 条真过期 defect）：
 *     改前 `[2] …共 0 条 … OK` + **exit 0**（假绿）；同一条只把写法换成可抽取的
 *     （`bgRecipe.texture 写成 grain（实际是 paper）`）⇒ `全失效 1 条 ✘` + exit 1。
 *   ★ 判据（与同型闸门 `check-config-notes.mjs` / `check-lexicon-coverage.mjs` /
 *     `check-mix-candidates.mjs` 的「0 对象 ⇒ 失明」同口径，只是这里数的对象是**抽取命中数**）：
 *       `defTotal > 0 && claims === 0` ⇒ **FAIL 并明说「本闸门已失明（判据②）」**。
 *   ★★ 边界（「什么情况下 0 是失明、什么情况下 0 是合法」——**必须写清，否则会把合法内容判红**）：
 *     · `defTotal > 0 && claims === 0` ⇒ **失明**：库里有 `defTotal` 条 defect **可判**，抽取器却
 *       颗粒无收 ⇒ 判据② 的作用域塌了（措辞/正则变了），不是「没有缺陷」。
 *     · `defTotal === 0` ⇒ **不判失明**：全库**本来就没有 defect 条目**（例如最小合法夹具
 *       `defects: []`）—— 那是**合法内容**（判据② 确实无对象可判，但那是**数据**如此、
 *       不是**判据**失效）。★ 这条边界由 `test/gate-blindness.test.mjs` 的阴性对照
 *       （`check-skill-scores：失明守卫…` 用例里 `defects: []` 必须 exit 0）钉住。
 *   ★ 实测（2026-10-11 真实语料）：`defTotal = 211`（43/43 风格都有 defects）、`claims = 22`
 *     ⇒ 新守卫**不触发**，`[1]/[2]/[3]` 三项与改动前**逐字一致**（exit 0）。
 *
 * 用法：node scripts/check-skill-scores.mjs
 * 退出码：有 FAIL（①②③ 任一）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/lemo-tools';
// ★ 覆盖点（供非破坏变异验证）：`LEMO_DISTILL_ROOT` 与 `check-film-delivery.mjs` / `check-tp-prose.mjs` 的**同名常量**同名同义（风格技能树）；
//   `LEMO_DUB_STYLES` 与 `check-dna-coverage.mjs` 的 `DUB_STYLES_FILE` 同名同义（注册表）。★ 2026-10-07：原写行号（`check-film-delivery.mjs:92` / `check-tp-prose.mjs:325` / `check-dna-coverage.mjs:153`）**三处全漂**（实为 `:95` / `:387` / `:187`）⇒ 改符号锚。
const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(ROOT, 'lib', 'style-skills'));
const DUB_STYLES = process.env.LEMO_DUB_STYLES || path.join(ROOT, 'lib', 'dub-styles.json');

// ── ★ 失明守卫（防空转绿灯）────────────────────────────────────────────────
//   判据（与 `check-dna-coverage.mjs:149` 同一组）：**注册表读不到 / 解析失败 / 一个带
//   `_distill.json` 的风格都枚举不到** ⇒ ①②③ 三条判据一条都没执行过 ⇒ 判 FAIL 并明说
//   「本闸门已失明」。否则会打印 `[1] 0/0 OK` —— 那是**假的**。
//   （写法照 `check-lexicon-coverage.mjs:57-75` 的同型守卫。）
const blind = [];
let cfg = null;
try {
  cfg = JSON.parse(fs.readFileSync(DUB_STYLES, 'utf8'));
} catch (e) {
  blind.push(`${DUB_STYLES} 读不到 / 不是 JSON（${(e && e.message) || e}）`);
}
const bySlug = Object.fromEntries((cfg && Array.isArray(cfg.styles) ? cfg.styles : []).map((s) => [s.slug, s]));
const KEYS = ['palette', 'composition', 'typography', 'rhythm', 'audio'];

const TEXTURES = ['none', 'paper', 'grain', 'scanlines', 'halftone', 'rice-paper', 'dot-grid', 'hairline-grid', 'washi'];
const FONTS = ['SimHei', 'SimSun', 'KaiTi', 'DengXian', 'Microsoft YaHei', 'Consolas'];

// ★ 历史语境守卫（2026-10-03 加）：条目里**引用旧值**做历史叙述时（「原为 scanlines…已修」「移入 resolvedDefects」等），
//   那不是在**主张**当前配置 —— 不能算「被证伪的现行断言」，否则会永远误报。
//   判据：命中处 ±80 字符内出现下列词之一 ⇒ 视为历史提及，跳过。
const HIST_MARK = /已修|已改为|已改成|已移入|移入 resolvedDefects|原为|原记|原先|曾是|曾为|曾是值|校正|拆分/;
const around = (txt, m) => txt.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80);

let slugs = [];
try {
  slugs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort();
} catch (e) {
  blind.push(`\`${DIR}\` 读不到（${(e && e.message) || e}）`);
}
if (!blind.length && slugs.length === 0) blind.push(`\`${DIR}\` 下一个带 _distill.json 的风格都没枚举到（路径 / 过滤变了？）⇒ ①②③ 三条判据一条都没执行`);
if (blind.length) {
  console.log(`\n✘ 本闸门已失明：`);
  for (const b of blind) console.log(`  ✘ ${b}`);
  console.log(`\n[闸门] 评分自洽性 **已失明** ✘`);
  process.exit(1);
}
let badScore = 0, fail = 0, mixed = 0, claims = 0, scoreMismatch = 0, scoreMissing = 0;
// ★ 判据② 的**分母**：可判的 defect 条目总数（= 抽取器的输入规模）。见头注释「失明守卫②」。
let defTotal = 0;

for (const slug of slugs) {
  const raw = fs.readFileSync(path.join(DIR, slug, '_distill.json'), 'utf8');
  const d = JSON.parse(raw);
  const sum = KEYS.reduce((a, k) => a + d.scoreBreakdown[k], 0);
  if (d.matchScore !== sum) { badScore++; console.log(`✘ ${slug} matchScore=${d.matchScore} ≠ 五项和 ${sum}`); }

  // ③ SKILL.md 自评匹配度 ↔ _distill.json#matchScore
  const mdPath = path.join(DIR, slug, 'SKILL.md');
  const md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
  const mSelf = md.match(/风格匹配度自评[\s\S]{0,40}?\*\*(\d+)\s*\/\s*100\*\*/);
  if (!mSelf) { scoreMissing++; console.log(`✘ ${slug} SKILL.md 未找到「风格匹配度自评 **N/100**」`); }
  else if (Number(mSelf[1]) !== d.matchScore) {
    scoreMismatch++;
    console.log(`✘ ${slug} SKILL.md 自评 ${mSelf[1]}/100 ≠ _distill.json matchScore ${d.matchScore}`);
  }

  const c = bySlug[slug] || {};
  const texNow = c.bgRecipe && c.bgRecipe.texture;
  const fontNow = c.subtitle && c.subtitle.fontFamily;
  const palNow = c.palette || {};

  for (const txt of d.defects || []) {
    defTotal++;
    const falsified = [];
    // ★ 本条 defect 里「引用了**本条所涉字段**的当前值」的断言数（收窄后的混合判据，见文件头注释）。
    let citesCurrent = 0;
    // texture 断言
    for (const m of txt.matchAll(/texture\s*(?:=|:|是|为|写成|改成|取)\s*[`"']?([A-Za-z][\w-]*)/g)) {
      if (!TEXTURES.includes(m[1])) continue;
      claims++;
      if (texNow === m[1]) citesCurrent++;
      else if (!HIST_MARK.test(around(txt, m))) falsified.push(`texture "${m[1]}" ≠ 当前 "${texNow}"`);
    }
    // fontFamily 断言
    for (const m of txt.matchAll(/fontFamily\s*(?:=|:|是|为|被改成|回退到|回退)\s*[`"'\s]*([A-Za-z][A-Za-z ]+?)(?=[`"'\s，。；、）)]|$)/g)) {
      const v = m[1].trim();
      if (!FONTS.includes(v)) continue;
      claims++;
      if (fontNow === v) citesCurrent++;
      else if (!HIST_MARK.test(around(txt, m))) falsified.push(`fontFamily "${v}" ≠ 当前 "${fontNow}"`);
    }
    // palette 字段断言（xxx.bg = #hex / bg #hex / 字段为 bg #hex ...）
    for (const m of txt.matchAll(/\b(bg2?|fg|accent|subtitle)\b\s*(?:字段[为是]?|=|:|是|为)?\s*[`"']?(#[0-9A-Fa-f]{6,8})/g)) {
      const field = m[1];
      const hex = m[2];
      claims++;
      const cur = palNow[field];
      if (cur && String(cur).toUpperCase() === hex.toUpperCase()) citesCurrent++;
      else if (cur) falsified.push(`${field} ${hex} ≠ 当前 ${cur}`);
    }

    if (!falsified.length) continue;
    // 混合判据（★ 2026-10-06 收紧）：条目里**至少有一条被抽取的断言**引用的就是
    // **本条所涉字段**的当前值（即该断言未被证伪）⇒ 只有部分失效 ⇒ WARN 人工复核。
    // 不再用「整份配置条目文本里出现过这个 hex」—— 那会被**无关字段**的色值满足（假绿）。
    if (citesCurrent) { mixed++; console.log(`⚠ 混合条目 ${slug}：${falsified.join('；')}（条目仍引用本条所涉字段的当前值，未整体证伪）|| ${txt.slice(0, 60)}`); }
    else { fail++; console.log(`✘ 仍存全失效条目 ${slug}：${falsified.join('；')} || ${txt.slice(0, 80)}`); }
  }
}

// ★★ 失明守卫②（2026-10-11 补）：**有 defect 可判、却一条断言都抽不到** ⇒ 判据② 静默空转 ⇒ FAIL。
//   ★ 边界：`defTotal === 0`（全库本来就没有 defect）**不判失明** —— 那是合法内容（见头注释）。
if (defTotal > 0 && claims === 0) {
  console.log(`\n✘ 本闸门已失明（判据②）：`);
  console.log(`  ✘ defects 条目共 ${defTotal} 条**可判**，却**一条配置值断言都抽不到**（texture / fontFamily / palette 三条抽取正则全部零命中）`);
  console.log(`  ✘ ⇒ 判据②「过期 defect」这条防线本次**什么都没检查**（语料措辞变了？抽取正则被改了？）—— 不是「库里没有缺陷」`);
  console.log(`\n[闸门] 评分自洽性 **已失明** ✘`);
  process.exit(1);
}

console.log(`\n[1] matchScore == scoreBreakdown 五项之和：${slugs.length - badScore}/${slugs.length} ${badScore ? '✘' : 'OK'}`);
console.log(`[2] defects 条目共 ${defTotal} 条，其中被抽取的配置值断言 ${claims} 条；「全失效」残留 ${fail} 条 ${fail ? '✘' : 'OK'}；「混合条目」${mixed} 条（人工复核，见报告）`);
console.log(`[3] SKILL.md 自评匹配度 == _distill.json matchScore：${slugs.length - scoreMismatch - scoreMissing}/${slugs.length} ${scoreMismatch || scoreMissing ? '✘' : 'OK'}${scoreMissing ? `（其中 ${scoreMissing} 份缺自评行）` : ''}`);
process.exitCode = badScore || fail || scoreMismatch || scoreMissing ? 1 : 0;
