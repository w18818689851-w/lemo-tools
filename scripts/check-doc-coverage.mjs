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
 *   3. （2026-10-07 起）文档里的「**计数声称**」（闸门数 / 用例数 / ★自证数 / 顶层 README 的库级计数）↔ 实测；
 *   4. （2026-10-09 起）`test/README.md` 每个写了条数的**测试入口** ↔ 实测；
 *   5. （2026-10-11 起）**顶层 `README.md`** 的**测试入口条数**声称 ↔ 实测（smoke 总条数 / `--full` / 服务端用例）。
 *      ★ **判据⑤ 的边界（什么算声称、什么不算）**：只认**有明确锚点、且真值可现算**的 4 种写法 ——
 *        ① `^node test/<name>.test.mjs …（N 条`；② `^node test/smoke.mjs …（N 条`；
 *        ③ `^node test/smoke.mjs --full …共 N 条`；④ `**N 条服务端用例**`。
 *      ★ **不**把 `（N 条）` 当万能模式（实测宽形态命中 11 处、**3 处误报**：接口条数 / 「第 4 条硬伤」/「9 条台词」）；
 *        也不判**重述**（如「因为「44 条」是冻结的验收基线」——它与上行同数、无自己的锚点）。
 *        静态数算不准（`cases.mjs` 读不到 / 区域找不到）⇒ **只列不判**，不 FAIL。
 *      ★ **适用边界**：只在顶层 README **真的列了测试入口**（含 `^node test/` 行）时生效；没有该节 ⇒ 跳过（不判失明）。
 *        有该节却一条声称都抽不到 / 某定长锚点命中 ≠ 1 ⇒ **判失明**（形态变了不许静默放行）。
 *   ★ 只在「新增了脚本却忘了写文档 / 数字没跟」时报错；不检查文字质量。
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
 * 退出码：`missing`（有脚本未登记进文档）/ `unlisted`（有测试入口未登记进 `test/README.md`）/
 *         `countBad`（文档里的计数声称与实测不符）/ `blind` / `countBlind`（失明守卫）—— 任一非空 ⇒ 1；否则 0。
 *         （★ 2026-10-08 复核：原只写「有未登记的脚本 → 1；否则 0」，漏了后四条也判 1。）
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

// ── ★ 2026-10-07 延伸②：文档里的「计数声称」必须与实测一致 ─────────────────────
//   由来（实测的三处陈旧，先跑出来的）：`test/README.md:30` 写「**77** 条：**全部 33 个闸门**」、
//   `:904` 写「**73 条**…覆盖 **32/32** 个闸门」、`test/gate-blindness.test.mjs:8` 写「共 **81** 条用例」，
//   而实测是 **82 条用例 / 34 个闸门 / 28 个 ★自证**。
//   ★★ 这**与本闸门主判据是同一病症** ——「工具加了 / 用例加了，文档里的数字没跟」，而且是**静默**的
//     （没人会去数）。⇒ 归到本闸门，而不是新开一个（`check-doc-coverage` 的由来就是这条病）。
//   ★ 判据：每个计数声称都用**锚定形态**抽出，与实测逐字比；**抽不到 / 锚点不唯一也 FAIL**
//     （形态变了 ⇒ 判据失明，不许静默放行 —— 同 `check-redline-md5.mjs` 的「锚定唯一性」纪律）。
//   ★ 实测值一律**从文件系统现算**（闸门数 = `scripts/check-*.mjs`；用例数 = `^test(` 出现次数；
//     自证数 = `^test('★自证` 出现次数）⇒ 代码变了文档必须跟，闸门自身不会过期。
//
// ── ★★ 2026-10-08 延伸③：把**顶层 `README.md`** 的「计数声称 ↔ 实测」也纳入同一判据 ──────────
//   由来（实测的真缺陷）：顶层 `README.md` 一度写「全库 **43** 个风格的 `demo/build.sh`」，
//   而实测只有 **35** 个风格带 `build.sh`（有 `demo/` 的是 43 个，其中 **8** 个没有 `build.sh`）。
//   这条能长期存在，正是因为判据③此前只覆盖 `test/README.md` 与 `test/gate-blindness.test.mjs`。
//   ⇒ 把顶层 README 里**可机械验证**的计数纳入（实测值一律**从文件系统现算**，如
//     `styles/*/demo/build.sh` 的计数、`styles/*/demo/tools/<脚本>` 的存在性）。
//   ★ 锚点必须**唯一**（命中 ≠ 1 处 ⇒ 判失明，同既有纪律）。
//   ★ 顶层 README 读不到 ⇒ 判失明（本仓主文档缺失）。库侧风格根**可达但 0 风格目录** ⇒ 判失明；
//     **不可达**（库仓是另一个仓、可能没 clone）⇒ 只 ℹ、跳过其计数声称、**不判失明**
//     —— 与 `check-env-overrides.mjs` 的「库仓不可达 ⇒ 只 ℹ」口径一致（外部仓不该让本闸门误红）。
const gateCount = files.filter(isGate).length;
const GB = path.join(testDir, 'gate-blindness.test.mjs');
const gbText = fs.existsSync(GB) ? fs.readFileSync(GB, 'utf8') : '';
const caseCount = (gbText.match(/^test\(/gm) || []).length;
const selfCount = (gbText.match(/^test\('★自证/gm) || []).length;

// ── ★ 2026-10-08 延伸③：顶层 `README.md` 的计数声称（实测值全部从文件系统现算）──────
const README_TOP = path.join(ROOT, 'README.md');
const readmeTop = fs.existsSync(README_TOP) ? fs.readFileSync(README_TOP, 'utf8') : '';
// 库侧风格根（默认 lemo-opuscar；可用 env 覆盖，便于变异测试）。
// ★ 库仓是**另一个仓**（由安装向导 `git clone` 而来），**不能假设它在别人机器上存在** ⇒
//   与 `check-env-overrides.mjs` 的「库仓不可达 ⇒ 只 ℹ、**不判失明**」同一口径（见其头注释的库仓侧扩展）。
//   但**可达却扫到 0 个风格目录** ⇒ 判失明（真·空转），同 `scripts/` / `test/` 两个扫描根。
const STYLES_ROOT = process.env.LEMO_STYLES_ROOT || 'D:/lemo-opuscar/styles';
let styleDirs = null;
let stylesNote = '';
try {
  styleDirs = fs.readdirSync(STYLES_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '_template')      // 排除模板目录
    .map((e) => e.name).sort();
} catch {
  styleDirs = null;                                                // 库仓不可达 ⇒ 跳过其计数声称（不判失明）
  stylesNote = `库侧风格根 \`${STYLES_ROOT}\` 不可达 ⇒ 跳过其计数声称（只 ℹ、不判失明；同 check-env-overrides 的库仓口径）`;
}
const hasIn = (slug, rel) => { try { return fs.existsSync(path.join(STYLES_ROOT, slug, rel)); } catch { return false; } };
const readIn = (slug, rel) => { try { return fs.readFileSync(path.join(STYLES_ROOT, slug, rel), 'utf8'); } catch { return ''; } };
// 各实测计数（`null` ⇒ 库仓不可达；空数组 ⇒ 可达但 0 风格 ⇒ 交由失明守卫）。
const stylesCount = styleDirs ? styleDirs.length : null;
const buildShCount = styleDirs ? styleDirs.filter((s) => hasIn(s, 'demo/build.sh')).length : null;
// `core/render/still.mjs` 是**库侧**脚本 ⇒ 判据按 `build.sh` 里是否引用它（与 README 差异表同源）。
const stillCount = styleDirs
  ? styleDirs.filter((s) => /core\/render\/still\.mjs/.test(readIn(s, 'demo/build.sh'))).length
  : null;
// 下面三个是**demo 自带**脚本 ⇒ 判据按文件是否存在（`demo/` 或 `demo/tools/`），与 ORCH_SKIP_STEPS 同源。
const cuecheckCount = styleDirs
  ? styleDirs.filter((s) => hasIn(s, 'demo/tools/cuecheck.py') || hasIn(s, 'demo/cuecheck.py')).length : null;
const finalAsrCount = styleDirs
  ? styleDirs.filter((s) => hasIn(s, 'demo/tools/final_asr.py') || hasIn(s, 'demo/final_asr.py')).length : null;
const checkMixCount = styleDirs
  ? styleDirs.filter((s) => hasIn(s, 'demo/check_mix.py') || hasIn(s, 'demo/tools/check_mix.py')).length : null;
// HTTP 接口表条数（= 「上表共 N 条」的实测；与 `check-api-docs.mjs` 的双向闸门互补）。
const apiRowCount = (readmeTop.match(/^\|\s*(GET|HEAD|POST|PUT|PATCH|DELETE)\s*\|\s*`?\/api\//gm) || []).length;

// 顶层 README 的 CLAIMS：只有「文档读得到 + 实测算得出」时才登记（否则交由失明守卫，不误报不符）。
const README_CLAIMS = [];
if (readmeTop) {
  README_CLAIMS.push(['README.md', /上表共 \*\*(\d+)\*\* 条/g, 1, apiRowCount, '顶层README·HTTP 接口表条数']);
}
if (readmeTop && styleDirs && styleDirs.length) {
  README_CLAIMS.push(
    ['README.md', /全库 (\d+) 个风格的 `demo\/build\.sh`/g, 1, buildShCount, '顶层README·带 build.sh 的风格数(全库N个)'],
    ['README.md', /按 `build\.sh` 逐条抽取核对，(\d+) 个带 `build\.sh` 的风格里/g, 1, buildShCount, '顶层README·带 build.sh 的风格数(干净名单)'],
    ['README.md', /环境状态条 · (\d+) 个风格列表/g, 1, stylesCount, '顶层README·风格总数'],
    ['README.md', /只影响交付图 \| \*\*(\d+) 个\*\*风格（含 art-deco）/g, 1, stillCount, '顶层README·still.mjs 覆盖风格数'],
    ['README.md', /`tools\/cuecheck\.py`\s*\|\s*纯自检\s*\|\s*(\d+) 个/g, 1, cuecheckCount, '顶层README·cuecheck 覆盖风格数'],
    ['README.md', /`tools\/final_asr\.py`\s*\|\s*纯自检\s*\|\s*\*\*(\d+) 个\*\*/g, 1, finalAsrCount, '顶层README·final_asr 覆盖风格数'],
    ['README.md', /`check_mix\.py`（`demo\/` 或 `demo\/tools\/`）\s*\|\s*纯自检\s*\|\s*(\d+) 个/g, 1, checkMixCount, '顶层README·check_mix 覆盖风格数'],
  );
}

// [文档, 锚定正则, 捕获组序号(1-based), 实测值, 名称]
const CLAIMS = [
  ['test/README.md', /（(\d+) 条：\*\*全部 (\d+) 个闸门\*\*/g, 1, caseCount, 'README·总用例数'],
  ['test/README.md', /（(\d+) 条：\*\*全部 (\d+) 个闸门\*\*/g, 2, gateCount, 'README·闸门数'],
  ['test/README.md', /另含 (\d+) 个「改坏守卫或判据必须变红」自证/g, 1, selfCount, 'README·自证数'],
  ['test/README.md', /回归套件（独立入口，零依赖，\*\*(\d+) 条\*\*）/g, 1, caseCount, 'README(详述)·总用例数'],
  ['test/README.md', /覆盖 \*\*(\d+)\/(\d+)\*\* 个闸门/g, 1, gateCount, 'README(详述)·闸门数(分子)'],
  ['test/README.md', /覆盖 \*\*(\d+)\/(\d+)\*\* 个闸门/g, 2, gateCount, 'README(详述)·闸门数(分母)'],
  ['test/README.md', /另含 \*\*(\d+)\*\* 个\*\*故意破坏自证\*\*/g, 1, selfCount, 'README(详述)·自证数'],
  ['test/gate-blindness.test.mjs', /共 (\d+) 条用例 \/ 覆盖全部 (\d+) 个闸门/g, 1, caseCount, 'gate-blindness·用例数'],
  ['test/gate-blindness.test.mjs', /共 (\d+) 条用例 \/ 覆盖全部 (\d+) 个闸门/g, 2, gateCount, 'gate-blindness·闸门数'],
  ...README_CLAIMS,
];

const countBad = [];
const countBlind = [];
if (!gbText) countBlind.push(`\`${GB}\` 读不到 ⇒ 用例数 / 自证数**无法计算**`);
else if (caseCount === 0) countBlind.push(`\`${GB}\` 里扫到 0 个 \`^test(\` ⇒ 「用例数」这条判据空转`);
// ★ 2026-10-08：顶层 README 读不到 ⇒ 其计数声称空转 ⇒ 判失明（它是本仓主文档，缺失即失明）。
if (!readmeTop) countBlind.push(`\`${README_TOP}\` 读不到 ⇒ 顶层 README 的计数声称**无法比对**`);
// ★ 库仓**可达却 0 风格目录** ⇒ 真·空转 ⇒ 判失明；库仓**不可达**则只 ℹ（见上面 `stylesNote`），不在此判。
if (styleDirs && styleDirs.length === 0) countBlind.push(`\`${STYLES_ROOT}\` 可达但扫到 0 个风格目录 ⇒ 风格 / build.sh / 自检脚本覆盖数**全部空转**`);
for (const [doc, re, gi, truth, label] of CLAIMS) {
  const text = doc === 'test/README.md' ? readme : doc === 'README.md' ? readmeTop : gbText;
  const hits = [...text.matchAll(re)];
  if (hits.length !== 1) { countBlind.push(`${label}：锚点命中 **${hits.length}** 处（应为 1）⇒ 抽不到 / 不唯一（形态变了？）`); continue; }
  const got = Number(hits[0][gi]);
  if (got !== truth) countBad.push(`${label}：文档写 **${got}**、实测 **${truth}**（${doc}）`);
}

// ── ★★ 2026-10-09 延伸④：`test/README.md` 的**测试入口条数**声称 ↔ 实测 ──────────────────────
//   由来（实测的系统性漂移）：README 的「测试入口」清单里，每个**写了条数**的入口（形如
//   `node test/x.test.mjs # …（69 条…）`）都**没有闸门核** ⇒ 已经整体漂了（实测对照：
//   ui 69→**75**、dub-api 18→**21**、style-scan 15→**16**、voices-api 9→**10**、
//   triple-check-flow 11→**12**、llm-api 28→**72**、resources 19→**23**）。
//   ★ 与判据③ 同一病症（「用例加了、文档数字没跟」，且静默）⇒ 归到本闸门，不新开。
//   ★★ 计数口径（先反推、再钉死）：一律用「**该入口自己报告出来的用例数**」——
//     · 自研 `runCase` 运行器（ui / dub-api / voices-api / setup-api / briefs）报 `N passed`；
//       N = `await runCase(` 调用数 + 收尾「无残留」守卫用例数；守卫用例数 =
//       (`results.push(` 出现数 − 2) / 2（−2 = `runCase` 助手自身 ok/fail 两次 push；每处守卫是 if/else 两次）。
//       实测：ui 75、dub-api 21、voices-api 10、setup-api 9、briefs 16（= 15 + 1）。
//     · 行首 `test(` 声明（node:test 或自研 `const test = (…) => cases.push`）：数 `^test(`。
//       实测对照：consistency 17 / dub-split 10 / style-scan 16 / llm-api 72 —— 与 `N passed` / `# pass` 逐字相等。
//     · `CASES` 数组（setup）：数 `^\s{2,}name: '` 条目（12）。
//   ★ 反推依据：两个「已知对」入口 setup（声称 12）/ briefs（声称 16，= 15 runCase + 1 守卫），
//     只有上面这套口径能同时给出 12 与 16（其余写法都会少算/多算）。
//   ★ 静态计数（**不真跑 23 个套件** —— 那要几分钟，闸门会被骂）。形态不认识 / 静态数不准（用例在循环里
//     动态生成）⇒ **只列不判**（不 FAIL），避免误报。
//   ★ 失明守卫：**一个入口都没解析到** ⇒ 判失明（同既有纪律：形态变了不许静默放行）。
//   ★ 判定结果并入既有 `countBad` / `countBlind` 两桶 ⇒ 退出码聚合行不变（`gate-blindness` 的
//     「摘掉 blind/countBlind」★自证仍逐字生效）。
const ENTRY_CLAIM_RE = /^node\s+test\/(\S+\.test\.mjs)\b[^\n]*?（(\d+)\s*条/gm;
// 该入口「自己报告的用例数」的静态等价式（见上：runCase / test() / CASES 三种形态）。
const countCasesStatic = (src) => {
  const rc = (src.match(/await runCase\(/g) || []).length;
  if (rc > 0 || /async function runCase\s*\(/.test(src)) {
    const pushes = (src.match(/results\.push\(\{/g) || []).length;
    // 形态不标准（助手 2 次 push + 每个守卫 if/else 2 次 ⇒ 必为偶数）⇒ 只列不判，不硬算。
    if (pushes < 2 || (pushes - 2) % 2 !== 0) return null;
    return rc + (pushes - 2) / 2;
  }
  const t = (src.match(/^test\(/gm) || []).length;
  if (t > 0) return t;
  const c = (src.match(/^\s{2,}name: '/gm) || []).length;
  return c > 0 ? c : null;                       // null ⇒ 只列不判（静态数不准）
};
const entryClaims = [...readme.matchAll(ENTRY_CLAIM_RE)].map((m) => ({ file: m[1], n: Number(m[2]) }));
const entryListOnly = [];
let entryBad = 0;
if (entryClaims.length === 0) {
  countBlind.push('`test/README.md` 里一个「`node test/…（N 条）」入口都解析不到 ⇒ 「测试入口条数」这条**判据已失明**（清单形态变了？）');
} else {
  for (const { file, n } of entryClaims) {
    const p = path.join(testDir, file);
    const src = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    const truth = src === null ? null : countCasesStatic(src);
    if (truth === null) { entryListOnly.push(`${file}（${src === null ? '文件读不到' : '静态数不准'}）`); continue; }
    if (n !== truth) { countBad.push(`测试入口条数·${file}：文档写 **${n}**、实测 **${truth}**（test/README.md）`); entryBad++; }
  }
}

if (stylesNote) console.log(`\nℹ ${stylesNote}`);
if (entryListOnly.length) console.log(`\nℹ 「测试入口条数」只列不判（静态数不准）：${entryListOnly.join('、')}`);

// ── ★★ 2026-10-11 延伸⑤：把**顶层 `README.md`** 的「测试入口条数」声称纳入同一判据 ─────────────
//   由来（上一批**手工**修的 5 处陈旧计数）：顶层 `README.md` 的「测试」段用**命令行注释**写入口条数
//   （`node test/ui.test.mjs  # …（115 条…）`）与「**N 条服务端用例**」，而这些数字**无闸门守** ——
//   判据③④ 此前只扫 `test/README.md`（`ENTRY_CLAIM_RE` 只吃 `^node test/<x>.test.mjs …（N 条`）。
//   ★★ **判据的边界（什么算声称、什么不算）—— 先跑一遍量出来的**：
//     · 顶层 README 里 `N 条` 的**宽形态**（任何 `（N 条` / `N 条`）实测命中 **11 处**，其中 **3 处是误报**
//       （`**5 条 /api/llm/services*` 的接口条数`、`第 4 条硬伤`、`9 条台词`）⇒ **不能**把 `（N 条）` 当万能模式。
//     · 只认**有明确锚点、且指向一个可现算真值**的 4 种写法（实测 7 处、**误报 0**）：
//       ① `^node test/<name>.test.mjs …（N 条`   ⇒ 真值 = 该入口静态用例数（与 test/README 同口径 `countCasesStatic`）；
//       ② `^node test/smoke.mjs …（N 条`         ⇒ 真值 = `cases.mjs` 的 STATIC+SERVER+PROCESS（= 44）；
//       ③ `^node test/smoke.mjs --full …共 N 条` ⇒ 真值 = 上式 + FULL_CASES（= 53）；
//       ④ `**N 条服务端用例**`                   ⇒ 真值 = `cases.mjs` 的 `SERVER_CASES`（= 28）。
//     · **不算声称**（有意不判）：`test/setup.test.mjs` 那句「因为「44 条」是冻结的验收基线」——它是 ② 的
//       **重述**、没有自己的锚点（不被上面 4 条命中 ⇒ 既不重复判、也不漏判，因为它与上行同数）。
//     · 静态数算不准（`cases.mjs` 读不到 / 区域找不到 / 计数为 0）⇒ **只列不判**（不 FAIL），同既有纪律。
//     · **适用边界（防误伤最小合法夹具）**：只在**顶层 README 真的列了测试入口**（含 `^node test/` 行）时生效；
//       README 没有测试入口清单 ⇒ 整块跳过（不是失明）。★ 失明守卫：**有** `^node test/` 行、却**一条**
//       声称都解析不到（或某个定长锚点命中 ≠ 1）⇒ 判失明（形态变了不许静默放行）。
//       ★ 已知盲区（如实登记）：把整段「测试」（含 `node test/` 行）删掉会让本判据**静默停止适用**。
const CASES_MJS = path.join(testDir, 'cases.mjs');
const casesText = fs.existsSync(CASES_MJS) ? fs.readFileSync(CASES_MJS, 'utf8') : '';
// `cases.mjs` 里某个 `export const <ARR> = [ … ]` 的**顶层元素数**（现算）：
//   区域 = 从该数组的 `[` 到**行首 0 列**的 `];`（这些数组一律 `export const X = [ … \n];` 写法）；
//   ★ 为什么不用**括号配平**切区域：实测 `FULL_CASES` 的字符串/正则里有**未配平的 `[`** ⇒ 配平会走到文件尾
//     （`end=-1`）⇒ 该数组计数失真（实测踩过）。改用「行首 0 列的 `];`」= 顶层声明结束，稳。
//   顶层元素数 = 数区域里**行首恰 2 空格**的 `{`（顶层条目）+ 该数组的 `<ARR>.push({` 次数
//   （本仓 STATIC_CASES 末尾补了 1 条）。找不到 / 得 0 ⇒ `null`（只列不判，绝不硬算）。
const countCasesArray = (arr) => {
  if (!casesText) return null;
  const m = new RegExp('const\\s+' + arr + '\\s*=\\s*\\[').exec(casesText);
  if (!m) return null;
  const rest = casesText.slice(casesText.indexOf('[', m.index));
  const endM = /\n\];/.exec(rest);
  const seg = endM ? rest.slice(0, endM.index) : rest;
  const n = (seg.match(/^  \{/gm) || []).length
    + (casesText.match(new RegExp(arr + '\\.push\\(\\{', 'g')) || []).length;
  return n > 0 ? n : null;
};
const smokeBaseCount = (() => {
  const a = countCasesArray('STATIC_CASES'), b = countCasesArray('SERVER_CASES'), c = countCasesArray('PROCESS_CASES');
  return (a === null || b === null || c === null) ? null : a + b + c;
})();
const smokeFullCount = (() => {
  const f = countCasesArray('FULL_CASES');
  return (smokeBaseCount === null || f === null) ? null : smokeBaseCount + f;
})();
const serverCasesCount = countCasesArray('SERVER_CASES');
const readmeEntryListOnly = [];
let readmeEntryHits = 0;
let readmeEntryChecked = 0;
// ★ **判据⑤ 的适用边界（防误伤最小合法夹具）**：只在**顶层 README 真的在文档里列了测试入口**
//   （含 `^node test/` 命令行）时生效。README **没有**测试入口清单（如 `gate-blindness.test.mjs`
//   的合成夹具树里的 `README.md`）⇒ **无可核对象** ⇒ 整块跳过（**不是失明**）。
//   ★ 已知盲区（如实登记）：若有人把顶层 README 的「测试」整段（含 `node test/` 行）删掉，本判据
//     会**静默停止适用** —— 与 `ENTRY_CLAIM_RE`（判据④）的「派生式声称」同一性质，属**已知边界**。
const readmeHasTestSection = /^node\s+test\//m.test(readmeTop);
if (readmeTop && readmeHasTestSection) {
  for (const m of readmeTop.matchAll(/^node\s+test\/(\S+\.test\.mjs)\b[^\n]*?（(\d+)\s*条/gm)) {   // ①
    readmeEntryHits++;
    const p = path.join(testDir, m[1]);
    const src = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    const truth = src === null ? null : countCasesStatic(src);
    if (truth === null) { readmeEntryListOnly.push(`README.md·${m[1]}（${src === null ? '文件读不到' : '静态数不准'}）`); continue; }
    readmeEntryChecked++;
    if (Number(m[2]) !== truth) countBad.push(`顶层README·测试入口条数(${m[1]})：文档写 **${m[2]}**、实测 **${truth}**（README.md）`);
  }
  for (const [re, truth, label] of [                                                              // ②③④
    [/^node\s+test\/smoke\.mjs\b[^\n]*?（(\d+)\s*条/gm, smokeBaseCount, '顶层README·smoke 总条数'],
    [/^node\s+test\/smoke\.mjs\s+--full\b[^\n]*?共\s*(\d+)\s*条/gm, smokeFullCount, '顶层README·smoke --full 条数'],
    [/\*\*(\d+)\s*条服务端用例\*\*/gm, serverCasesCount, '顶层README·服务端用例条数'],
  ]) {
    const hits = [...readmeTop.matchAll(re)];
    if (hits.length !== 1) { countBlind.push(`${label}：锚点命中 **${hits.length}** 处（应为 1）⇒ 抽不到 / 不唯一（形态变了？）`); continue; }
    readmeEntryHits++;
    if (truth === null) { readmeEntryListOnly.push(`${label}（cases.mjs 读不到 / 静态数不准）`); continue; }
    readmeEntryChecked++;
    if (Number(hits[0][1]) !== truth) countBad.push(`${label}：文档写 **${hits[0][1]}**、实测 **${truth}**（README.md）`);
  }
}
if (readmeTop && readmeHasTestSection && readmeEntryHits === 0) {
  countBlind.push('顶层 `README.md` 的「测试」段里**一个**入口条数声称都解析不到（清单形态变了 / 条数被删？）⇒ 「顶层 README 测试入口条数」这条**判据已失明**');
}

if (readmeEntryListOnly.length) console.log(`\nℹ 顶层 README 的「测试入口条数」只列不判（静态数不准）：${readmeEntryListOnly.join('、')}`);

if (countBad.length) {
  console.log(`\n✘ 文档里的计数声称与实测不符 ${countBad.length} 处：`);
  for (const c of countBad) console.log(`  ${c}`);
  console.log('\n修法：把文档里的数字改成实测值（`test/README.md` / `test/gate-blindness.test.mjs` 头部 / 顶层 `README.md`）。');
} else if (!countBlind.length) {
  const extra = README_CLAIMS.length ? `、顶层 README ${README_CLAIMS.length} 条声称` : '';
  console.log(`\n✓ 文档里的计数声称与实测一致（闸门 ${gateCount} 个、用例 ${caseCount} 条、★自证 ${selfCount} 条${extra}）。`);
  if (entryClaims.length) console.log(`✓ ${entryClaims.length} 个「写了条数」的测试入口，条数都与实测一致。`);
  if (readmeEntryChecked) console.log(`✓ 顶层 README ${readmeEntryChecked} 条「测试入口条数」声称（含 smoke 总条数 / --full / 服务端用例）都与实测一致。`);
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

if (blind.length || countBlind.length) {
  console.log(`\n✘ 本闸门已失明：`);
  for (const b of blind) console.log(`  ✘ ${b}`);
  for (const b of countBlind) console.log(`  ✘ ${b}`);
}

console.log(`\n[闸门] 未登记脚本 ${missing.length} 个、未登记测试入口 ${unlisted.length} 个、计数不符 ${countBad.length} 处${(blind.length || countBlind.length) ? '、**已失明**' : ''} ${(missing.length || unlisted.length || countBad.length || blind.length || countBlind.length) ? '✘' : 'OK'}`);
process.exitCode = (missing.length || unlisted.length || countBad.length || blind.length || countBlind.length) ? 1 : 0;
