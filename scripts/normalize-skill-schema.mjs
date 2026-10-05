#!/usr/bin/env node
/**
 * scripts/normalize-skill-schema.mjs —— 把 43 份 `_distill.json` 的**字段结构**拉齐
 *
 * ★ 为什么需要它（2026-10-03）：
 *   43 份 json 的字段结构**不完全统一**：`resolvedDefects` 缺 22 份、`selfCheck.loudness.lra` 缺 23 份、
 *   `truePeakMethod` 缺 2 份、`lraMethod` 缺 26 份。下游（三条生成通路）拿到不同风格会**时有时无**，
 *   只能到处写 `?.` 兜底 —— 这正是「结构漂移」的代价。
 *
 * ★ 只做**加法**，不做重命名/合并（重要）：
 *   · 补缺失键 = 稳定 schema，零风险；
 *   · **绝不**把 `audioScoreBasis` 之类的旁注并进 `scoreBreakdown.audio` —— 那会让该字段从**数字变成对象**，
 *     直接破坏 `check-skill-scores.mjs` 的 `scoreBreakdown 五项之和 == matchScore` 判据（实测推演过）。
 *   · 多余的非标准 key（`audioScoreBasis` / `audioEvidence` / `muxPatch`）**保留不动**：
 *     稳定 schema 的消费者会忽略不认识的 key，删它们只会丢信息。
 *
 * ★ `lra` 用**实测**填，不是填 null：项目 LRA 口径 = `ebur128`（`loudnorm` 的 `input_lra` 系统性偏大）。
 *
 * 用法：node scripts/normalize-skill-schema.mjs [--dry] [--force-lra]
 *   --force-lra：把**所有** 43 份的 `lra` 统一重测为 ebur128 口径（用于修「同一字段两种口径」，
 *                或成片被重混过、LRA 变了而文档没跟 —— 见 `check-lra-caliber.mjs`）。
 * 退出码：恒 0（这是归一化工具；判合规请用 check-* 系列）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DIR = 'D:/lemo-tools/lib/style-skills';
const FF = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const DRY = process.argv.includes('--dry');
const FORCE_LRA = process.argv.includes('--force-lra');
const TOL_LRA = 0.8;

const TP_METHOD = 'ffmpeg -i <film> -af loudnorm=I=-14:TP=-1.7:LRA=11:print_format=json -f null - 的 input_tp（4× 过采样）';
const LRA_METHOD = 'ebur128=peak=true 的 LRA（项目口径；loudnorm 的 input_lra 系统性偏大）';

const run = (args) =>
  new Promise((res) => {
    const p = spawn(FF, args);
    let e = '';
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res({ e: String(err.message) }));
    p.on('close', () => res({ e }));
  });

/** ebur128 的 LRA（取最后一次打印） */
async function ebur128Lra(file) {
  const { e } = await run(['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const m = [...e.matchAll(/^\s*LRA:\s*(-?[\d.]+)/gm)];
  return m.length ? Number(m[m.length - 1][1]) : null;
}

const slugs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort();

let addResolved = 0, fillLra = 0, fillLraMethod = 0, fillTpMethod = 0, lraMismatch = 0;
const rows = [];

for (const slug of slugs) {
  const p = path.join(DIR, slug, '_distill.json');
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const film = (d.generatedVideo || {}).path;
  let touched = false;

  // ① resolvedDefects 缺 → 空数组（稳定 schema）
  if (d.resolvedDefects === undefined) { d.resolvedDefects = []; addResolved++; touched = true; }

  // ② selfCheck.loudness 的 lra / lraMethod / truePeakMethod
  if (!d.selfCheck) d.selfCheck = {};
  if (!d.selfCheck.loudness) d.selfCheck.loudness = {};
  const L = d.selfCheck.loudness;

  if (FORCE_LRA && film && fs.existsSync(film)) {
    // 统一口径：把 lra 重测成 ebur128（原值可能是 loudnorm 口径，或成片被重混后 LRA 变了）
    const v = await ebur128Lra(film);
    if (v !== null) {
      if (L.lra === undefined || Math.abs(L.lra - v) > 0.05) {
        rows.push({ slug, lra: v, note: L.lra === undefined ? '补测' : `统一口径（原 ${L.lra}）` });
        L.lra = v; fillLra++;
      }
      L.lraMethod = LRA_METHOD;
      touched = true;
    }
  } else if (L.lra === undefined && film && fs.existsSync(film)) {
    const v = await ebur128Lra(film);
    if (v !== null) { L.lra = v; fillLra++; touched = true; rows.push({ slug, lra: v, note: '补测' }); }
  }
  if (L.lraMethod === undefined) {
    // 已有 lra 的：核一下是不是 ebur128 口径，是就标 ebur128，不是就如实标注差异
    if (L.lra !== undefined && film && fs.existsSync(film)) {
      const v = await ebur128Lra(film);
      if (v !== null && Math.abs(L.lra - v) > TOL_LRA) {
        L.lraMethod = `来源未标注（与 ebur128 ${v} 差 ${Math.abs(L.lra - v).toFixed(1)} LU）`;
        lraMismatch++;
      } else L.lraMethod = LRA_METHOD;
    } else L.lraMethod = LRA_METHOD;
    fillLraMethod++; touched = true;
  }
  if (L.truePeakMethod === undefined) { L.truePeakMethod = TP_METHOD; fillTpMethod++; touched = true; }

  if (touched && !DRY) fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
}

console.log('─'.repeat(72));
console.log(`补 resolvedDefects: []        ${addResolved} 份`);
console.log(`补 loudness.lra（实测 ebur128） ${fillLra} 份`);
console.log(`补 loudness.lraMethod         ${fillLraMethod} 份${lraMismatch ? `（其中 ${lraMismatch} 份标注为「来源未标注」，因为与 ebur128 差 > ${TOL_LRA} LU）` : ''}`);
console.log(`补 loudness.truePeakMethod    ${fillTpMethod} 份`);
if (rows.length) {
  console.log('\n补测的 LRA：');
  for (const r of rows) console.log(`  ${r.slug.padEnd(20)} LRA ${r.lra} LU（${r.note}）`);
}
if (DRY) console.log('\n★ 干跑，未写入。');
