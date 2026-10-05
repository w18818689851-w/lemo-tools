#!/usr/bin/env node
/**
 * scripts/patch-tp-prose.mjs —— 给 `check-tp-prose.mjs` 报出的「陈旧正文声称」追加已修子句
 *
 * ★ 为什么要单独一个补丁脚本：这 4 处不在「响度目标」行也不在第 11 节的已知缺陷里，
 *   而是散在**文末摘要**与**下次迭代待办**里 —— `sync-tp-docs.mjs` 的锚点覆盖不到。
 *   判据由 `check-tp-prose.mjs` 机械给出，本脚本按锚点逐条打补丁（**幂等**：已含 fix-truepeak 即跳过）。
 *
 * 用法：node scripts/patch-tp-prose.mjs [--dry]
 */
import fs from 'node:fs';

const DIR = 'D:/lemo-tools/lib/style-skills';
const DATE = '2026-10-03';
const DRY = process.argv.includes('--dry');

const note = (v) =>
  ` ★ **${DATE} 已修**：成片已用 \`scripts/fix-truepeak.mjs\` 音频重混（\`-c:v copy\`，视频流逐字节未变），` +
  `真峰值 **→ ${v} dBTP**、已在 −1.2 dBTP 交付线内；本条判语为**修复前**状态，保留作历史。`;

/** 交叉引用（引用**别的风格**的旧值当先例）：整库一起修，故给一条通用的已修说明 */
const XREF_NOTE =
  ` ★ **${DATE} 已修（全库）**：本行引用的他片先例均已用 \`scripts/fix-truepeak.mjs\` 音频重混达标 —— ` +
  `\`pictogram-motion\` **+0.28 → −1.65 dBTP**、\`game-show\` **−0.22 → −2.09 dBTP**（全库 43/43 现均 ≤ −1.2 dBTP）；` +
  `旧值保留作历史（当时确实超标）。`;

/** 锚点 = 该行的唯一子串（**逐条写死**，用正则猜会静默不替换） */
const TABLE = [
  { slug: 'halftone-dossier', anchor: '4× 过采样 = +0.43 dBTP**。', v: '−2.06' },
  { slug: 'iso-infographic',  anchor: '- **修混音峰值**：把 `mix.wav` 整体降', v: '−1.69' },
  { slug: 'papercut-red',     anchor: '- **音频削波**：成片真峰值 +1.73 dBTP', v: '−1.69' },
  { slug: 'pictogram-motion', anchor: '1. **把成片真峰从 `+0.3 dBFS` 压回', v: '−1.65' },
  // 交叉引用：hd-2d 拿他片旧值当先例
  { slug: 'hd-2d', anchor: '- **【audio −0，附带 · 项目级既有风险】', xref: true },
  { slug: 'hd-2d', anchor: '- **`mux.sh` 的 AAC 余量不足**（项目级；本片达标', xref: true },
  { slug: 'hd-2d', anchor: '- **独立复测了缺陷 B 的两个先例**', xref: true },
];

let n = 0, skip = 0, miss = 0;
for (const t of TABLE) {
  const p = `${DIR}/${t.slug}/SKILL.md`;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const idx = lines.findIndex((l) => l.includes(t.anchor));
  if (idx < 0) { console.log(`  ✘ ${t.slug}：锚点未命中「${t.anchor.slice(0, 40)}」`); miss++; continue; }
  if (/fix-truepeak/.test(lines[idx])) { console.log(`  ↷ ${t.slug}：该行已有已修标记，跳过`); skip++; continue; }
  lines[idx] = lines[idx].replace(/\s*$/, '') + (t.xref ? XREF_NOTE : note(t.v));
  if (!DRY) fs.writeFileSync(p, lines.join('\n'));
  console.log(`  ✓ ${t.slug} L${idx + 1} 已追加已修子句${t.xref ? '（交叉引用）' : ''}`);
  n++;
}

console.log(`\n补丁 ${n} 处；跳过 ${skip}；锚点未命中 ${miss}`);
if (DRY) console.log('★ 干跑，未写入。');
