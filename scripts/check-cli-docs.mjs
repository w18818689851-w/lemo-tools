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

/** 用法块：行首缩进 ≥2 空格的 `--flag`（各文件的 usage 都是这个排法） */
function documented(src) {
  return new Set([...src.matchAll(new RegExp(`^\\s{2,}(${FLAG})`, 'gm'))].map((m) => m[1]));
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
