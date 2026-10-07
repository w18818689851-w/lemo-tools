#!/usr/bin/env node
/**
 * scripts/check-loudness-targets.mjs —— 「文案+口播」通路的**响度目标解析闸门**
 *
 * ★ 为什么需要它（2026-10-03 实踩）：
 *   `dub.mjs` 的响度目标解析链是：
 *     `targetLufs = TARGET_LUFS`（默认 **−16**，注释写「社交视频常用」）
 *       ↑ 若 `lib/style-dna/<slug>.json#sound_palette.mix_rules` 里能解析出 LUFS，就用它覆盖
 *   而 `mix_rules` 是**中文散文**，LUFS 数值要靠 `parseTargetLufs()` 从散文里正则抽。
 *   实测 `pixel-rpg` 的档案**恰好漏了这个数**（全 43 份里唯一一份）⇒ 该风格的 dub 出片
 *   会静默停在 **−16 LUFS**，而其余 42 个风格都是 **−14** ⇒ **同一批交付物里差 2 LU**。
 *   这类「默认值兜底」的缺口**不会报错**，只有把「每个风格都能解析出目标值」做成闸门才拦得住。
 *
 * 判据：43 份 style-dna 的 `summarizeStyleDna(...).targetLufs` 必须**全部**是有限数值。
 *      任何一份解析不出来 ⇒ FAIL（因为它会静默回落到默认值）。
 *
 * ★ 交付线判据（2026-10-04 补）：**唯一来源 = 本项目交付线 −14 LUFS**（实测 2026-10-04 时
 *   43 份 style-dna 的 `targetLufs` **全部**是 −14）。原判据只判 `Number.isFinite(v)`
 *   —— 一个风格把 `mix_rules` 写成 −16 也照样绿 ⇒ 本闸门**从未真判「是否等于交付线」**。
 *   判据：分布里出现任何偏离 −14（超 EPS）的值 ⇒ FAIL；style-dna 档案 0 份 ⇒ 失明 FAIL。
 *
 * 用法：node scripts/check-loudness-targets.mjs
 * 退出码：有解析失败 / 偏离交付线 / 失明 → 1；否则 0。
 *   ★ 2026-10-07 收口：`dnaOnly` / `skillOnly`（下方那两行 `⚠`）**不进退出码** —— 它们判的是
 *     「**文档集合对齐**」（多一份 / 少一份 Skill 文档），**不是本闸门的主题**（本闸门只判
 *     「每个风格能不能解析出响度目标、且等于交付线 −14」）。⚠ 按本项目惯例 = **只列不判**。
 *     此前 `:97` 把它们算进了 `exitCode`，而 `:96` 的 ✘/OK **不算** ⇒ 实测出现过
 *     「末行打印 `[闸门] 响度目标解析 1/1 OK`、退出码却是 1」—— 读文案与读退出码的人得出
 *     **相反结论**。现把两处收成**同一个变量 `fail`**，结构上不可能再各说各话。
 */
import fs from 'node:fs';
import path from 'node:path';
import { readStyleDna, summarizeStyleDna } from '../lib/style-dna-reader.mjs';

const DNA_DIR = 'D:/lemo-tools/lib/style-dna';
const SKILL_DIR = 'D:/lemo-tools/lib/style-skills';

// ★ 交付线（2026-10-04 补）：本项目唯一交付线 = **−14 LUFS**。
//   来源：实测 2026-10-04 时 43 份 style-dna 的 `targetLufs` **全部**是 −14（见下方分布输出）。
//   原闸门只判 `Number.isFinite(v)` ⇒ 写成 −16 也绿 ⇒ 这里把「是否等于交付线」钉死。
const LUFS_LINE = -14;
const LUFS_EPS = 0.01;

const slugs = fs
  .readdirSync(DNA_DIR)
  .filter((x) => x.endsWith('.json'))
  .map((x) => x.replace(/\.json$/, ''))
  .sort();

const dist = {};
const miss = [];

for (const slug of slugs) {
  const sum = summarizeStyleDna(readStyleDna(slug));
  const v = sum ? sum.targetLufs : null;
  if (!Number.isFinite(v)) miss.push(slug);
  else dist[v] = (dist[v] || 0) + 1;
}

// 顺带：风格文档与 dna 档案的 slug 集合应当一一对应（多/少都是问题）
const skillSlugs = fs
  .readdirSync(SKILL_DIR)
  .filter((s) => fs.existsSync(path.join(SKILL_DIR, s, '_distill.json')))
  .sort();
const dnaOnly = slugs.filter((s) => !skillSlugs.includes(s));
const skillOnly = skillSlugs.filter((s) => !slugs.includes(s));

// ★ 交付线：分布里任何偏离 −14 的值都要报出来（列出具体是哪些值）
const offLine = Object.keys(dist).map(Number).filter((v) => Math.abs(v - LUFS_LINE) > LUFS_EPS);
// ★ 失明：一份档案都没有 ⇒ 本闸门什么都没检查
const blind = [];
if (slugs.length === 0) blind.push('style-dna 档案 0 份（目录读空 / 路径变了？）⇒ 本闸门什么都没检查');

// ★★ 本闸门的**唯一判据**（2026-10-07 收口）：末行的 ✘/OK 与 `process.exitCode` **都读它**。
//   口径 = 头注释写的那三条：**解析失败 / 偏离交付线 / 失明**。
//   ★ 为什么**不含** `dnaOnly` / `skillOnly`：它们判的是「文档集合对齐」，不是本闸门的主题
//     （本闸门只判「响度目标能不能解析、且等于交付线」），且它们只打印 `⚠` 级（本项目惯例 = 只列不判）。
//     收成一个变量后，两处口径**结构上不可能再不一致**（此前 `exitCode` 多算了这两项 ⇒
//     出现「末行 OK 但退出码 1」的相反结论）。
const fail = miss.length > 0 || offLine.length > 0 || blind.length > 0;

console.log(`style-dna 档案：${slugs.length} 份；风格 Skill 文档：${skillSlugs.length} 份`);
console.log(`可解析出响度目标：${slugs.length - miss.length}/${slugs.length}，分布 ${JSON.stringify(dist)}`);
if (offLine.length) {
  console.log(`\n✘ 响度目标**偏离交付线 ${LUFS_LINE} LUFS** 的值：${offLine.join(', ')}`);
  console.log(`  交付线唯一来源 = ${LUFS_LINE}（2026-10-04 实测 43 份 style-dna 全为 ${LUFS_LINE}）。`);
}
if (blind.length) {
  console.log(`\n✘ 失明：`);
  for (const b of blind) console.log(`  ✘ ${b}`);
}
if (dnaOnly.length) console.log(`⚠ 只有 dna 没有 Skill 文档：${dnaOnly.join(', ')}`);
if (skillOnly.length) console.log(`⚠ 只有 Skill 文档没有 dna：${skillOnly.join(', ')}`);

if (miss.length) {
  console.log(`\n✘ 解析不出响度目标（会静默回落到默认 −16 LUFS，与其余风格不一致）：`);
  for (const s of miss) {
    const mr = (() => {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(DNA_DIR, `${s}.json`), 'utf8'));
        return ((j.sound_palette || {}).mix_rules || '').slice(0, 90);
      } catch { return '(读不到)'; }
    })();
    console.log(`  ✘ ${s.padEnd(20)} mix_rules = ${mr}…`);
  }
  console.log(`\n修法：按该风格自己的源头文档（\`styles/<slug>/STYLE.md\` / \`DEMO.md\` 的 Mix 段）把「整体 −NN LUFS」补进`);
  console.log(`      \`lib/style-dna/<slug>.json#sound_palette.mix_rules\`，**并注明来源行号**（不要凭空造值）。`);
}

console.log(`\n[闸门] 响度目标解析 ${slugs.length - miss.length}/${slugs.length} ${fail ? '✘' : 'OK'}`);
// ★ 与上面那行**同一个 `fail`** ⇒ 文案与退出码不可能各说各话（见 `fail` 处的注释）。
process.exitCode = fail ? 1 : 0;
