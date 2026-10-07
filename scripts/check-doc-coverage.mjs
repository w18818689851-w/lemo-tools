#!/usr/bin/env node
/**
 * scripts/check-doc-coverage.mjs —— 「新工具被写进文档了吗」的**文档完整性闸门**
 *
 * ★ 由来（2026-10-04）：`_distill/AGENT-BRIEF.md` 是**长期循环的作业手册** —— 未来跑风格蒸馏的子智能体
 *   全靠它。但它一度只提到 **3** 个脚本（实际有 24 个）：`check-skill-scores`（评分自洽，属 11 节契约的一部分）、
 *   `check-film-delivery`、`refresh-style-skill`（出片后回填）等**全都没提**
 *   ⇒ 照着它跑的产出会**通不过新闸门**。
 *   这类「工具加了、文档没跟」是**静默**的（没人会去数），只能靠机械比对拦住。
 *
 * 判据：
 *   1. `scripts/` 下每个 `check-*.mjs` 都必须在 **`test/README.md`** 与 **`_distill/AGENT-BRIEF.md`** 里被**登记**；
 *   2. `scripts/` 下每个「工具类」脚本（`sync-*` / `patch-*` / `normalize-*` / `refresh-*` / `fix-*` / `measure-*`）
 *      至少在其中**一个**文档里被**登记**。
 *   ★ 只在「新增了脚本却忘了写文档」时报错；不检查文字质量。
 *
 * ★★ 2026-10-06 收紧「登记」的判据：由**纯子串**改为**行锚定**（修一个已确认的假绿）。
 *   旧判据 `t.includes(f)` 只要求脚本名在整份文档里**出现过** ⇒ **行被并掉、格式被破坏它都看不见**
 *   （实测：`_distill/AGENT-BRIEF.md` 有 `check-render-venc.mjs` 的超长说明**直接粘着**
 *   `node …/patch-render-venc.mjs`、**没有换行**，`patch-render-venc.mjs` 那一行被吞掉，闸门照报 exit 0）。
 *   这正是本项目反复治过的「匹配判据可被无关代码满足」那一类。
 *   现要求「**存在一行**按该文档的登记格式写下这个脚本」（脚本名一律**正则转义**，含 `.`）：
 *   · `_distill/AGENT-BRIEF.md` = **命令行 / 行内代码**形态：
 *     `^[ \t`\-]*node\s+(\S*[\/\\])?scripts[\/\\]<name>` —— 行首（可含空格/Tab/`-`/行内反引号）+ `node ` + 路径。
 *     实测的三种合法形态都接受：代码块 `node D:/…/scripts/x.mjs …`、bullet `` - `node scripts/x.mjs` ``、
 *     行首行内码 `` `node D:/…/scripts/x.mjs` ``。
 *   · `test/README.md` = **检查器表**形态：`^\|\s*`(scripts|test)[\/\\]<name>`` —— 行首 `|` + 反引号包裹的路径。
 *   ★ 同型残留（2026-10-06 一并收紧）：`test/*.test.mjs` 的「已登记」判据原为**裸子串**
 *     `readme.includes(f)` ⇒ **测试入口行被并掉时同样看不见**（同一个病、同一个文件）。现改为行锚定，
 *     接受两种合法形态：① `^node\s+(\S*[\/\\])?test[\/\\]<name>`（命令行块）
 *     ② `^\|\s*`test[\/\\]<name>``（表行）。
 *     ★ 测试入口侧**没有**「工具类只需一处」的豁免（只查 `test/README.md` 一处）⇒ 并成一行**必然**翻退出码。
 *     ★ 失明守卫（`test/` 扫到 0 个 `*.test.mjs`）**早已存在**（见下面 `blind[]`），本侧无需新增。
 *   ★ 放宽锚点（多接受几种合法行首）是允许的；**绝不许退回裸子串**。
 *
 * ★★ 2026-10-07 修「失明守卫口径不一致」的假绿：主循环只检查 `isGate(f) || isTool(f)` 的**过滤集**，
 *   但失明守卫用的是**未过滤**的 `files.length` ⇒ `scripts/` 下若还有别的 .mjs（`style-distill` /
 *   `style-scan` 等「其他类」）而过滤集恰为 0（命名约定变了），则 `missing=[]`、`blind=[]` ⇒
 *   打印「都已登记」+ exit 0（一个闸门/工具都没检查过）。现改为守卫主循环**实际检查的** `checked`
 *   （= `files.filter(isGate||isTool)`），与 test 侧（用过滤过的 `testEntries.length`）口径一致。
 *
 * 用法：node scripts/check-doc-coverage.mjs
 * 退出码：有未登记的脚本 → 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';

// ★ 覆盖点（供非破坏变异验证）：lemo-tools 仓库根（`scripts/` 与两份文档都挂在它下面）。
const ROOT = process.env.LEMO_TOOLS_ROOT || 'D:/lemo-tools';
const SCRIPTS = path.join(ROOT, 'scripts');
const DOCS = {
  'test/README.md': path.join(ROOT, 'test', 'README.md'),
  '_distill/AGENT-BRIEF.md': path.join(ROOT, '_distill', 'AGENT-BRIEF.md'),
};

const texts = {};
for (const [k, p] of Object.entries(DOCS)) {
  texts[k] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

const files = (() => {
  try { return fs.readdirSync(SCRIPTS).filter((f) => f.endsWith('.mjs')).sort(); }
  catch { return []; }                     // ★ 目录读不到 ⇒ 交给下面的失明守卫（不裸抛）
})();
const isGate = (f) => /^check-/.test(f);
const isTool = (f) => /^(sync|patch|normalize|refresh|fix|measure|prune)-/.test(f);
// ★ 主循环**实际检查**的集合（闸门类 ∪ 工具类）—— 失明守卫必须用它，而不是未过滤的 `files`。
//   否则「`scripts/` 下有别的 .mjs（style-distill / style-scan 等「其他类」）、但闸门/工具类过滤集为 0」
//   时 `missing=[]`、`blind=[]` ⇒ 打印「都已登记」+ exit 0 —— 一个闸门/工具都没检查过（2026-10-07 修）。
const checked = files.filter((f) => isGate(f) || isTool(f));

// ★ 行锚定判据（2026-10-06 收紧，见头注释）—— 每个文档一种「登记格式」。
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 脚本名正则转义（含 `.`）
const ANCHORS = {
  // AGENT-BRIEF.md：命令行 / 行内代码形态（行首可含空格/Tab/`-`/行内反引号）
  '_distill/AGENT-BRIEF.md': (f) => new RegExp('^[ \\t`\\-]*node\\s+(\\S*[\\/\\\\])?scripts[\\/\\\\]' + esc(f), 'm'),
  // test/README.md：检查器表形态（行首 `|` + 反引号包裹的 `scripts/…` 或 `test/…`）
  'test/README.md': (f) => new RegExp('^\\|\\s*`(scripts|test)[\\/\\\\]' + esc(f) + '`', 'm'),
};

// ★ 测试入口（`test/*.test.mjs`）在 `test/README.md` 的登记格式（2026-10-06 一并收紧）：
//   ① 命令行块 `node test/x.test.mjs  # …`  ② 表行 `| `test/x.test.mjs` | …`
const TEST_ENTRY = (f) => new RegExp('^(?:node\\s+(?:\\S*[\\/\\\\])?test[\\/\\\\]|\\|\\s*`test[\\/\\\\])' + esc(f), 'm');

const missing = [];
for (const f of checked) {                         // ★ 与失明守卫同一集合（style-distill / style-scan / unblock-* 等「其他类」不强制登记）
  const where = Object.entries(DOCS).filter(([k]) => ANCHORS[k] && ANCHORS[k](f).test(texts[k])).map(([k]) => k);
  if (isGate(f) && where.length < 2) missing.push({ f, need: '两个文档都要', where });
  else if (isTool(f) && where.length < 1) missing.push({ f, need: '至少一个文档', where });
}

const gates = files.filter(isGate).length;
const tools = files.filter(isTool).length;
console.log(`scripts/ 下：闸门类 ${gates} 个、工具类 ${tools} 个、其他 ${files.length - gates - tools} 个`);
console.log(`文档：${Object.keys(DOCS).join(' 与 ')}`);

// ── ★ 2026-10-04 延伸：`test/*.test.mjs` 是**独立入口**，必须登记进 `test/README.md` ──
//   否则「加了一个测试文件但没人知道怎么跑」—— 与本文件的主判据（工具加了文档没跟）同一类。
const testDir = path.join(ROOT, 'test');
const readme = texts['test/README.md'];
const testEntries = fs.existsSync(testDir)
  ? fs.readdirSync(testDir).filter((f) => f.endsWith('.test.mjs')).sort()
  : [];
const unlisted = testEntries.filter((f) => !TEST_ENTRY(f).test(readme));

// ── ★ 失明守卫（防空转绿灯）────────────────────────────────────────────────
//   判据：两个扫描根任一扫到 **0 个** ⇒ 闸门空转 ⇒ 判 FAIL 并明说「本闸门已失明」。
//   否则 `missing` / `unlisted` 全空会打印「都已在文档里登记」—— 那是**假的**（什么都没扫到）。
//   （写法照 `check-config-vs-doc.mjs` 头注释的「★ 失明守卫」段 / `blind[]` 块 / `check-loudness-targets.mjs:64-79` 的同型守卫。）
const blind = [];
if (files.length === 0) {
  blind.push(`\`${SCRIPTS}\` 下扫到 0 个 .mjs（目录不存在 / 过滤变了？）⇒ 一个脚本都没检查过`);
} else if (checked.length === 0) {
  // ★ 2026-10-07 修假绿：`files.length > 0`（有「其他类」.mjs）但**过滤后**闸门/工具类为 0 ⇒ 主循环
  //   一个都没检查、`missing` 恒空 ⇒ 会打印「都已登记」+ exit 0。守卫必须看主循环实际检查的 `checked`，
  //   与下面 test 侧（用过滤过的 `testEntries.length`）口径一致。
  blind.push(`\`${SCRIPTS}\` 下 ${files.length} 个 .mjs 里**过滤后**闸门类 ∪ 工具类为 0 个（命名约定变了？）⇒ 「脚本已登记」这条判据什么都没检查`);
}
if (testEntries.length === 0) blind.push(`\`${testDir}\` 下扫到 0 个 *.test.mjs（目录不存在 / 枚举为空？）⇒ 「测试入口已登记」这条判据什么都没检查`);

if (unlisted.length) {
  console.log(`\n✘ 有 ${unlisted.length} 个测试入口没登记进 test/README.md：`);
  for (const f of unlisted) console.log(`  ${f}`);
  console.log('\n修法：写进 `test/README.md` 的「测试入口」清单（两处：命令行示例 + 文件说明）。');
} else if (testEntries.length) {
  console.log(`\n✓ ${testEntries.length} 个测试入口（test/*.test.mjs）都已登记进 test/README.md。`);
}

if (missing.length) {
  console.log(`\n✘ 有 ${missing.length} 个脚本没被登记进文档：\n`);
  for (const m of missing) console.log(`  ${m.f.padEnd(32)} 需要：${m.need}（当前只在：${m.where.join('、') || '哪儿都没有'}）`);
  console.log('\n修法：把它们写进对应的文档 ——');
  console.log('  · `check-*.mjs` → `test/README.md` 的检查器表 + `_distill/AGENT-BRIEF.md` 的「第五步：自检」清单');
  console.log('  · `sync-/patch-/normalize-/refresh-/fix-/measure-*.mjs` → 至少一处（工具表或简报的「反向更新」段）');
} else if (!blind.length) {
  console.log('\n✓ 所有闸门类与工具类脚本都已在文档里登记。');
}

if (blind.length) {
  console.log(`\n✘ 本闸门已失明：`);
  for (const b of blind) console.log(`  ✘ ${b}`);
}

console.log(`\n[闸门] 未登记脚本 ${missing.length} 个、未登记测试入口 ${unlisted.length} 个${blind.length ? '、**已失明**' : ''} ${(missing.length || unlisted.length || blind.length) ? '✘' : 'OK'}`);
process.exitCode = (missing.length || unlisted.length || blind.length) ? 1 : 0;
