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
 *   1. `scripts/` 下每个 `check-*.mjs` 都必须在 **`test/README.md`** 与 **`_distill/AGENT-BRIEF.md`** 里被提到；
 *   2. `scripts/` 下每个「工具类」脚本（`sync-*` / `patch-*` / `normalize-*` / `refresh-*` / `fix-*` / `measure-*`）
 *      至少在其中**一个**文档里被提到。
 *   ★ 只在「新增了脚本却忘了写文档」时报错；不检查文字质量。
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
const isTool = (f) => /^(sync|patch|normalize|refresh|fix|measure)-/.test(f);

const missing = [];
for (const f of files) {
  if (!isGate(f) && !isTool(f)) continue;          // style-distill / style-scan / unblock-* 等不强制登记
  const where = Object.entries(texts).filter(([, t]) => t.includes(f)).map(([k]) => k);
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
const unlisted = testEntries.filter((f) => !readme.includes(f));

// ── ★ 失明守卫（防空转绿灯）────────────────────────────────────────────────
//   判据：两个扫描根任一扫到 **0 个** ⇒ 闸门空转 ⇒ 判 FAIL 并明说「本闸门已失明」。
//   否则 `missing` / `unlisted` 全空会打印「都已在文档里登记」—— 那是**假的**（什么都没扫到）。
//   （写法照 `check-config-vs-doc.mjs:108-116` / `check-loudness-targets.mjs:64-79` 的同型守卫。）
const blind = [];
if (files.length === 0) blind.push(`\`${SCRIPTS}\` 下扫到 0 个 .mjs（目录不存在 / 过滤变了？）⇒ 一个脚本都没检查过`);
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
