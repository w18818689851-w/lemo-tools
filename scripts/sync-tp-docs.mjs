#!/usr/bin/env node
/**
 * scripts/sync-tp-docs.mjs —— 把「成片真峰值已修」同步进 18 份风格文档（json + SKILL.md）
 *
 * ★ 为什么必须同步（而不是改完成片就完事）：
 *   43 份 SKILL.md 的正文里**直接写着成片实测真峰值**（如 papercut-red 写着「真峰值 +1.73 dBTP」）。
 *   成片被 `scripts/fix-truepeak.mjs` 修到 −1.69 之后若不同步正文，文档就在**说谎**，
 *   而且会出现「正文说 +1.73、json 说已修」两个答案 —— 正是 `check-skill-scores.mjs` 第 ③ 项要拦的错。
 *
 * ★ 遵守仓库既有约定（照 ascii-crt 先例，别自创格式）：
 *   · 正文里**原始观察一律保留**，在句末追加 `★ **2026-10-03 已修**：… 原值记录保留为历史`；
 *     ★ 特别注意：**不要**把「响度目标」行里的旧真峰值**就地改掉** —— 那一行后半句往往紧跟着
 *     「超出 −1.2 dBTP 交付线 X dB、真峰值为正即已削波」的判语，只改数字会让同一句话**自相矛盾**
 *     （实测踩过：改成 −1.69 dBTP 后仍写着「超出交付线 2.93 dB」）。ascii-crt 的做法是
 *     **整句保留 + 句末追加已修子句**，照抄它。
 *   · `_distill.json`：真峰值缺陷从 `defects` 移入 `resolvedDefects`，标签额回补到 `scoreBreakdown.audio`
 *     （**上限 20**，与 ascii-crt「已修缺陷回补 audio +3」同口径），`matchScore` 随之重算。
 *
 * ★ 锚点为什么逐条写死：18 份正文的旧值写法各不相同（全角 − / 半角 - / 正号 / dBTP / dBFS），
 *   用「猜一个正则」会**静默不替换**（文档继续撒谎且没人发现）。宁可写死 18 条，也不要猜。
 *
 * 用法：node scripts/sync-tp-docs.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'D:/lemo-tools/lib/style-skills';
const DRY = process.argv.includes('--dry');
const DATE = '2026-10-03';
const KEYS = ['palette', 'composition', 'typography', 'rhythm', 'audio'];

/**
 * anchor   —— 第 11 节「已知缺陷」里那条真峰值缺陷的**唯一子串**（null = 该风格 json 未记此项）
 * statusOld/New —— 「响度目标」行里旧/新真峰值串（null = 该行没写成片真峰值，无需改）
 * oldDisp  —— 写进「已修」注释的旧值展示串
 * restore  —— 该缺陷的标签扣分（回补到 audio，上限 20）
 */
const TABLE = {
  'papercut-red':      { anchor: '成片音频削波、未达真峰值目标', statusOld: '+1.73 dBTP', statusNew: '−1.69 dBTP', oldDisp: '+1.73 dBTP', newTp: '−1.69', restore: 6 },
  'iso-infographic':   { anchor: '成片音频削顶，未达真峰值目标', statusOld: '+1.20 dBTP', statusNew: '−1.69 dBTP', oldDisp: '+1.20 dBTP', newTp: '−1.69', restore: 6 },
  'shadow-puppet':     { anchor: '★ 成片真峰值削波（此前漏记）', statusOld: '+1.43 dBTP', statusNew: '−1.60 dBTP', oldDisp: '+1.43 dBTP', newTp: '−1.60', restore: 4 },
  'game-show':         { anchor: '★ 成片真峰值削波（超出交付目标', statusOld: '−0.22 dBTP', statusNew: '−2.09 dBTP', oldDisp: '−0.22 dBTP', newTp: '−2.09', restore: 2 },
  'halftone-dossier':  { anchor: '音频这次是真配乐（非占位）', statusOld: '+0.43 dBTP', statusNew: '−2.06 dBTP', oldDisp: '+0.43 dBTP', newTp: '−2.06', restore: 4 },
  'impasto':           { anchor: '响度偏热且真峰值超线', statusOld: '−0.74 dBTP', statusNew: '−2.06 dBTP', oldDisp: '−0.74 dBTP', newTp: '−2.06', restore: 2 },
  'living-screencast': { anchor: '成片响度 / 峰值略未达标', statusOld: '−0.94 dBTP', statusNew: '−2.14 dBTP', oldDisp: '−0.94 dBTP', newTp: '−2.14', restore: 2 },
  'pictogram-motion':  { anchor: '真峰超出声明上限', statusOld: null, statusNew: null, oldDisp: 'TPK +0.3 dBFS', newTp: '−1.65', restore: 2 },
  'pixel-rpg':         { anchor: '真峰值口径未达标但未被告警', statusOld: null, statusNew: null, oldDisp: 'Peak 0.1 dBFS', newTp: '−1.72', restore: 4 },
  'ukiyoe':            { anchor: '真峰值未达标', statusOld: '-0.6 dBFS', statusNew: '−2.60 dBTP', oldDisp: '-0.6 dBFS', newTp: '−2.60', restore: 2 },
  'backrooms':         { anchor: '真峰值超交付线 0.28 dB', statusOld: '-0.92 dBTP', statusNew: '-1.86 dBTP', oldDisp: '-0.92 dBTP', newTp: '-1.86', restore: 1 },
  'blueprint':         { anchor: '真峰值超交付线 0.17 dB', statusOld: '−1.03 dBTP', statusNew: '−1.74 dBTP', oldDisp: '−1.03 dBTP', newTp: '−1.74', restore: 1 },
  'crayon-book':       { anchor: '★ 成片真峰值 −1.02 dBTP', statusOld: '−1.02 dBTP', statusNew: '−2.08 dBTP', oldDisp: '−1.02 dBTP', newTp: '−2.08', restore: 1 },
  'dataviz':           { anchor: '真峰值超交付线 0.08 dB', statusOld: '−1.12 dBTP', statusNew: '−2.23 dBTP', oldDisp: '−1.12 dBTP', newTp: '−2.23', restore: 1 },
  'microgame':         { anchor: '真峰值超交付线 0.34 dB', statusOld: '−0.86 dBTP', statusNew: '−2.18 dBTP', oldDisp: '−0.86 dBTP', newTp: '−2.18', restore: 1 },
  'risograph':         { anchor: '成片真峰值超交付线 0.44 dB', statusOld: '−0.76 dBTP', statusNew: '−1.96 dBTP', oldDisp: '−0.76 dBTP', newTp: '−1.96', restore: 1 },
  'stained-glass':     { anchor: '★ 成片真峰值 −1.12 dBTP', statusOld: '−1.12 dBTP', statusNew: '−1.83 dBTP', oldDisp: '−1.12 dBTP', newTp: '−1.83', restore: 1 },
  // art-deco：json 里本就没记真峰值缺陷（audio 扣分在别处），只同步正文，不回补评分
  'art-deco':          { anchor: null, statusOld: '−1.17 dBTP', statusNew: '−2.00 dBTP', oldDisp: '−1.17 dBTP', newTp: '−2.00', restore: 0 },
};

const note = (oldDisp, newTp, restore) =>
  `★ **${DATE} 已修**：成片已用 \`scripts/fix-truepeak.mjs\` 音频重混（\`-c:v copy\`，视频流逐字节未变、帧数与时长不变），` +
  `真峰值 ${oldDisp} → **${newTp} dBTP**，已在 −1.2 dBTP 交付线内` +
  (restore > 0 ? `；音频评分回补 +${restore}（见第 10 节）。` : '（json 本未扣该项分，评分不变）。');

let nJson = 0, nMd = 0, nSkip = 0, nMissAnchor = 0, nMissStatus = 0;
const rows = [];

for (const [slug, t] of Object.entries(TABLE)) {
  const jsonPath = path.join(DIR, slug, '_distill.json');
  const mdPath = path.join(DIR, slug, 'SKILL.md');
  const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // ── 1. json：真峰值缺陷 → resolvedDefects，回补 audio ──
  let moved = false;
  if (t.restore > 0) {
    const idx = (d.defects || []).findIndex((x) => /真峰值|dBTP|dBFS/.test(x));
    if (idx >= 0) {
      const [def] = d.defects.splice(idx, 1);
      d.resolvedDefects = d.resolvedDefects || [];
      d.resolvedDefects.push(`${def}\n${note(t.oldDisp, t.newTp, t.restore)}`);
      d.scoreBreakdown.audio = Math.min(20, d.scoreBreakdown.audio + t.restore);
      d.matchScore = KEYS.reduce((a, k) => a + d.scoreBreakdown[k], 0);
      moved = true;
      if (!DRY) fs.writeFileSync(jsonPath, JSON.stringify(d, null, 2) + '\n');
      nJson++;
    } else {
      console.log(`  ⚠ ${slug}：json 里找不到真峰值缺陷，评分未回补`);
    }
  }
  const newScore = d.matchScore;

  // ── 2. SKILL.md ──
  let md = fs.readFileSync(mdPath, 'utf8');
  if (/fix-truepeak/.test(md)) { nSkip++; console.log(`  ↷ ${slug}：正文已含 fix-truepeak，跳过`); rows.push({ slug, restore: t.restore, audio: d.scoreBreakdown.audio, score: newScore }); continue; }
  const lines = md.split('\n');

  // (a) 「响度目标」行：**不动内联旧值**，句末追加「已修」子句（照 ascii-crt 先例，避免同句自相矛盾）
  if (t.statusOld) {
    const i = lines.findIndex((l) => /响度目标/.test(l) && l.includes(t.statusOld));
    if (i >= 0) {
      lines[i] = lines[i].replace(/\s*$/, '') +
        ` ★ **${DATE} 已修**：成片已用 \`scripts/fix-truepeak.mjs\` 音频重混（\`-c:v copy\`，视频流逐字节未变），` +
        `真峰值 ${t.oldDisp} → **${t.newTp} dBTP**、已在 −1.2 dBTP 交付线内（达标）；原 ${t.oldDisp} 记录保留为历史。`;
    } else { nMissStatus++; console.log(`  ⚠ ${slug}：响度目标行找不到 "${t.statusOld}"`); }
  }

  // (b) 第 11 节「已知缺陷」里的真峰值条目末尾追加「已修」
  if (t.anchor) {
    const i11 = lines.findIndex((l) => /^##\s*11\./.test(l));
    const iDef = lines.findIndex((l, i) => i > i11 && /^###\s*已知缺陷/.test(l));
    const iNext = lines.findIndex((l, i) => i > iDef && /^###/.test(l));
    const end = iNext < 0 ? lines.length : iNext;
    let hit = -1;
    for (let i = iDef + 1; i < end; i++) if (lines[i].includes(t.anchor)) { hit = i; break; }
    if (hit < 0) { for (let i = iDef + 1; i < end; i++) if (lines[i].includes(t.anchor)) { hit = i; break; } }
    if (hit >= 0) lines[hit] = lines[hit].replace(/\s*$/, '') + ' ' + note(t.oldDisp, t.newTp, t.restore);
    else { nMissAnchor++; console.log(`  ⚠ ${slug}：已知缺陷里找不到锚点 "${t.anchor}"`); }
  }

  md = lines.join('\n');

  // (c) 自评分数行：**NN/100** → 新值 + 括注原值
  md = md.replace(/^(\| 风格匹配度自评 \| )\*\*(\d+)\/100\*\*([^|]*)\|/m, (m, p1, old, tail) => {
    if (Number(old) === newScore) return m;
    const why = t.restore > 0 ? `音频真峰值缺陷已修，audio +${t.restore}` : '真峰值已修（json 本未扣该项分）';
    return `${p1}**${newScore}/100**（${DATE} 校正：原 ${old}，${why}）${tail}|`;
  });

  // (d) 文末「自检发现的缺陷」摘要行追加「已修」
  md = md.replace(/^(\*\*自检发现的缺陷\*\*：.*)$/m, (m0) => m0.replace(/\s*$/, '') + ` ★ ${DATE}：成片真峰值已修（${t.oldDisp} → ${t.newTp} dBTP，音频重混），见第 11 节。`);

  if (!DRY) fs.writeFileSync(mdPath, md);
  nMd++;
  rows.push({ slug, restore: t.restore, audio: d.scoreBreakdown.audio, score: newScore, moved });
}

console.log('\n' + '─'.repeat(74));
console.log(`json 改动 ${nJson} 份；SKILL.md 改动 ${nMd} 份；跳过 ${nSkip} 份；锚点未命中 ${nMissAnchor} 处；状态行未命中 ${nMissStatus} 处`);
console.log('\n  ' + 'slug'.padEnd(20) + '回补'.padStart(5) + 'audio'.padStart(7) + 'matchScore'.padStart(12));
for (const r of rows) console.log('  ' + r.slug.padEnd(20) + String('+' + r.restore).padStart(5) + String(r.audio).padStart(7) + String(r.score).padStart(12));
if (DRY) console.log('\n★ 干跑，未写入。');
