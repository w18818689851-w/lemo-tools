#!/usr/bin/env node
/**
 * scripts/check-cli-docs.mjs —— **命令行参数**的「文档 ↔ 实现」一致性闸门
 *
 * ★ 由来（2026-10-04）：本日第 5 次遇到「**文档先于实现**」——
 *   注释/用法块承诺了一个能力，代码里根本没有。最近一次是 `/api/dub/analyze` 的注释写着
 *   「也可由外部注入结果（source:'external'）」，而 `server.mjs` 里**完全没有 `analysis` 字样**。
 *   这类缺陷**读起来像已完成**，只能靠机械比对拦住。
 *
 * 本闸门把这条纪律落到**最可机械化的切面**上：CLI 参数。
 *   ① 用法块（行首缩进 ≥2 空格的 `--flag`）里列出的每个参数，代码里**必须真的处理**；
 *   ② 代码里处理的每个参数，**必须**在用法块里列出（标准参数如 `--help` 走白名单）。
 *
 * ★ 用法块**不能**按「整份源码里任意缩进的 `--flag`」来判定（2026-10-06 修，原为假绿）：
 *   那样一段**无关**的模板文本/注释里缩进写个 `--flag`，就会把「已实现但没写进用法块」的参数
 *   冒充成「已文档」。实测夹具：`--beta` 已实现、用法块里没有，只因另一段无关模板里多了一行
 *   缩进的 `--beta`，闸门就静默报 OK。
 *   但「收紧成连续块」也不行 —— 真实用法块**不是连续块**：`dub.mjs` 的用法块被空行/续行
 *   切成 12 个碎段（最长 4 行）、`lemo-make.mjs` 切成 10 个（最长 8 行），任何「最长块 / 连续块 / 块大小阈值」
 *   的收紧都会把合法参数打成「代码有文档无」（大面积假红）。
 *   故改用**锚点法**：用法块 = 「含用法小标题的那段模板字符串（或块注释）」。
 *   小标题 = 行尾的 `用法:` / `用法：` / `Usage` / `USAGE` / `选项` / `Options` / `OPTIONS`
 *   （前面是行首、空白、`*`、`·` 或反引号）。
 *   区域 = 该小标题所在的模板字符串：由「未转义反引号数的奇偶」判断它在不在模板里，
 *   再取「上一个含反引号的行 ↔ 下一个含反引号的行」为边界；块注释（`/*` 起、其闭合标记止）同理。
 *   只有落在区域内的行首缩进 `--flag` 才算「已文档」。
 *
 * 支持的解析风格（两种都在用，别只认一种）：
 *   · `case '--flag':`（`dub.mjs` 的 switch）
 *   · `a === '--flag'`（`lemo-make.mjs` 的 if 链）
 *   · `args.includes('--flag')`
 *
 * ★ 防空转绿灯（2026-10-04 补，参照 check-api-docs.mjs 的同类守卫）：若**任一侧**解析出 0 个 flag
 *   （正则/写法一变就会发生），`notImpl`/`notDoc` 都空 ⇒ 闸门静默报 OK。
 *   判据：`impl.size === 0` 或 `doc.size === 0` ⇒ 判 FAIL 并明说「失明（解析风格变了？）」。
 *
 * 用法：node scripts/check-cli-docs.mjs
 * 退出码：有不一致（或失明）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/lemo-tools';
const TARGETS = ['dub.mjs', 'lemo-make.mjs'];

/** 标准/通用参数：不在用法块里逐条列出也算正常 */
const ALLOW_UNLISTED = new Set(['--help', '--version']);

const FLAG = '--[a-z][a-z0-9-]{1,24}';

function implemented(src) {
  return new Set([
    ...[...src.matchAll(new RegExp(`case\\s+'(${FLAG})'`, 'g'))].map((m) => m[1]),
    ...[...src.matchAll(new RegExp(`\\ba\\s*===\\s*'(${FLAG})'`, 'g'))].map((m) => m[1]),
    ...[...src.matchAll(new RegExp(`args?\\.includes\\('(${FLAG})'\\)`, 'g'))].map((m) => m[1]),
  ]);
}

/** 用法块小标题：行尾的 `用法:` / `用法：` / `Usage` / `USAGE` / `选项` / `Options`（前面须是行首/空白/`*`/`·`/反引号） */
const USAGE_HEADING = /(?:^|[\s*·`])(?:用法|Usage|USAGE|选项|Options|OPTIONS)[ \t]*[:：]?[ \t]*$/;

/** 一行里**未转义**的反引号数（先去掉 `\x` 转义对，再数） */
const ticks = (line) => (line.replace(/\\./g, '\u0000').match(/`/g) || []).length;

/**
 * 用法块区域 = 「含用法小标题的那段**模板字符串**（或块注释）」。
 * 返回若干 `[startLine, endLine]`（0 基、闭区间）。
 * ★ 判据是机械的：小标题所在行「含本行的未转义反引号累计数」为奇数 ⇒ 它在模板字符串内部；
 *   区域边界取「上一个含反引号的行 ↔ 下一个含反引号的行」。块注释按 `/*` / 闭合标记同理。
 */
function usageRegions(src) {
  const lines = src.split('\n');
  const ticksThrough = [0];
  for (let i = 0; i < lines.length; i++) ticksThrough.push(ticksThrough[i] + ticks(lines[i]));
  const out = [];
  for (let a = 0; a < lines.length; a++) {
    if (!USAGE_HEADING.test(lines[a])) continue;
    if (ticksThrough[a + 1] % 2 === 1) {                 // ① 小标题在模板字符串里
      let open = a; while (open >= 0 && ticks(lines[open]) === 0) open--;
      let close = a + 1; while (close < lines.length && ticks(lines[close]) === 0) close++;
      if (open >= 0 && close < lines.length) out.push([open, close]);
      continue;
    }
    const before = lines.slice(0, a).join('\n');          // ② 小标题在块注释里
    if ((before.match(/\/\*/g) || []).length > (before.match(/\*\//g) || []).length) {
      let open = a; while (open >= 0 && !lines[open].includes('/*')) open--;
      let close = lines[a].includes('*/') ? a : a + 1;
      while (close < lines.length && !lines[close].includes('*/')) close++;
      if (open >= 0 && close < lines.length) out.push([open, close]);
    }
  }
  return out;
}

/**
 * 用法块：**只在**「用法小标题所在的那段模板字符串 / 块注释」里找行首缩进 ≥2 空格的 `--flag`。
 * ★ 不再扫整份源码 —— 否则任意无关文本里缩进的 `--flag` 都会被当成「已文档」（假绿）。
 */
function documented(src) {
  const lines = src.split('\n');
  const set = new Set();
  for (const [s, e] of usageRegions(src)) {
    const text = lines.slice(s, e + 1).join('\n');
    for (const m of text.matchAll(new RegExp(`^\\s{2,}(${FLAG})`, 'gm'))) set.add(m[1]);
  }
  return set;
}

const fails = [];
const rows = [];

for (const rel of TARGETS) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`${rel}：文件不存在`); continue; }
  const src = fs.readFileSync(p, 'utf8');
  const impl = implemented(src);
  const doc = documented(src);

  // ★ 防空转绿灯：任一侧解析出 0 个 flag ⇒ 本闸门的「一致」结论是假的 ⇒ 判 FAIL（不许静默 OK）。
  const blind = [];
  if (impl.size === 0) blind.push(`${rel}：解析到 0 个**已实现** flag ⇒ 失明（解析风格变了？）`);
  if (doc.size === 0) blind.push(`${rel}：用法块里解析到 0 个 flag ⇒ 失明（缩进/写法变了？）`);
  fails.push(...blind);

  const notImpl = [...doc].filter((f) => !impl.has(f));                       // 文档有、代码没有 ⇒ 严重
  const notDoc = [...impl].filter((f) => !doc.has(f) && !ALLOW_UNLISTED.has(f)); // 代码有、文档没有 ⇒ 也要补

  rows.push({ rel, impl: impl.size, doc: doc.size, notImpl, notDoc, blind: blind.length });
  for (const f of notImpl) fails.push(`${rel}：用法块列了 \`${f}\`，但代码里**没有任何处理分支**（文档先于实现）`);
  for (const f of notDoc) fails.push(`${rel}：代码处理了 \`${f}\`，但用法块没列（用户看不到）`);
}

console.log('命令行参数 · 文档 ↔ 实现 一致性\n');
for (const r of rows) {
  const ok = !r.notImpl.length && !r.notDoc.length && !r.blind;
  console.log(`  ${ok ? '✓' : '✘'} ${r.rel.padEnd(16)} 实现 ${String(r.impl).padStart(2)} 个 / 用法块列出 ${String(r.doc).padStart(2)} 个`
    + (ok ? '' : `  ← 文档有代码无 ${r.notImpl.length}；代码有文档无 ${r.notDoc.length}${r.blind ? '；★ 失明' : ''}`));
}

if (fails.length) {
  console.log(`\n✘ ${fails.length} 处不一致：`);
  for (const f of fails) console.log(`  ✘ ${f}`);
  console.log('\n修法：**补实现**（若文档承诺的是真需求）或**改文档**（若只是写早了）。别让两边各说各话。');
} else {
  console.log('\n✓ 用法块与实现完全对应。');
}

console.log(`\n[闸门] CLI 文档一致性 ${fails.length ? '✘' : 'OK'}（${rows.length} 个入口）`);
process.exitCode = fails.length ? 1 : 0;
