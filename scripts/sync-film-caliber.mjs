#!/usr/bin/env node
/**
 * scripts/sync-film-caliber.mjs —— 用**实测值**回填 43 份 `_distill.json` 的成片技术口径
 *
 * ★ 为什么需要它（2026-10-03 实踩）：
 *   真峰值在 json 里的**权威位置是 `selfCheck.loudness.truePeakDbtp`**（43/43 都有）。
 *   `fix-truepeak.mjs` 最初写的是 `generatedVideo.truePeakDbtp` —— **该字段根本不存在**
 *   ⇒ 更新是**静默空操作**：成片已修到 −1.69，json 却仍记着 +1.73 且 `peakTargetMet:false`，
 *     而 SKILL.md 正文已写「已修」⇒ 三个地方两个答案。
 *   ⇒ 本脚本按**实测**回填，把 json 拉回与成片一致。
 *
 * 同时做一件加法式的结构归一（不改任何既有字段语义）：
 *   `generatedVideo` 补 `width/height/fps/frames`（原先只有 1–3 份有，下游要解析散文才知道画幅）。
 *
 * 用法：node scripts/sync-film-caliber.mjs [--dry]
 * 退出码：恒 0（这是回填工具；判合规请用 check-film-delivery.mjs）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DIR = 'D:/lemo-tools/lib/style-skills';
const FF = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const FP = FF.replace(/ffmpeg\.exe$/, 'ffprobe.exe');
const DRY = process.argv.includes('--dry');
const TP_TARGET = -1.2;

const run = (bin, args) =>
  new Promise((res) => {
    const p = spawn(bin, args);
    let o = '', e = '';
    p.stdout.on('data', (d) => (o += d));
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res({ c: -1, o, e: String(err.message) }));
    p.on('close', (c) => res({ c, o, e }));
  });

// loudnorm 的值是**带引号字符串** ⇒ 两侧引号都要允许
const num = (t, k) => {
  const m = t.match(new RegExp(`"${k}"\\s*:\\s*"?(-?[0-9.]+)"?`));
  return m ? Number(m[1]) : null;
};

const slugs = fs
  .readdirSync(DIR)
  .filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json')))
  .sort();

let changed = 0, added = 0;
const rows = [];

for (const slug of slugs) {
  const jsonPath = path.join(DIR, slug, '_distill.json');
  const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const film = (doc.generatedVideo || {}).path;
  if (!film || !fs.existsSync(film)) { console.log(`— ${slug}：成片缺失，跳过`); continue; }

  // 音频口径（真值）
  const { e } = await run(FF, ['-hide_banner', '-nostats', '-i', film,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
  const tp = num(e, 'input_tp'), lufs = num(e, 'input_i'), lra = num(e, 'input_lra');

  // 视频口径
  const { o: probe } = await run(FP, ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_frames,duration',
    '-show_entries', 'format=duration', '-of', 'json', film]);
  let width = null, height = null, fps = null, frames = null;
  try {
    const j = JSON.parse(probe);
    const st = (j.streams || [])[0] || {};
    width = st.width ?? null;
    height = st.height ?? null;
    if (st.r_frame_rate) { const [a, b] = st.r_frame_rate.split('/').map(Number); fps = b ? +(a / b).toFixed(3) : a; }
    frames = st.nb_frames ? Number(st.nb_frames) : null;
  } catch { /* 保持 null */ }

  const L = doc.selfCheck && doc.selfCheck.loudness;
  const before = L ? L.truePeakDbtp : null;

  if (L && tp !== null) {
    const newL = Number(tp.toFixed(2));
    if (L.truePeakDbtp !== newL) {
      L.truePeakDbtp = newL;
      L.peakTargetMet = newL <= TP_TARGET;
      L.integratedLufs = lufs !== null ? Number(lufs.toFixed(2)) : L.integratedLufs;
      if (L.lra !== undefined && lra !== null) L.lra = Number(lra.toFixed(1));
      changed++;
      rows.push({ slug, from: before, to: newL, met: L.peakTargetMet });
    }
  } else if (!L) {
    console.log(`  ⚠ ${slug}：json 无 selfCheck.loudness，跳过音频口径`);
  }

  // 加法式：补 generatedVideo 的视频技术字段（只补缺失的，不改既有值）
  const g = doc.generatedVideo;
  for (const [k, v] of [['width', width], ['height', height], ['fps', fps], ['frames', frames]]) {
    if (v !== null && g[k] === undefined) { g[k] = v; added++; }
  }

  if (!DRY) fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2) + '\n');
}

console.log('\n' + '─'.repeat(70));
console.log(`真峰值/响度被更正 ${changed} 份；generatedVideo 补字段 ${added} 处`);
if (rows.length) {
  console.log('\n  更正明细（旧 → 新，是否达标）：');
  for (const r of rows) console.log(`  ${r.slug.padEnd(20)} ${String(r.from).padStart(7)} → ${String(r.to).padStart(7)}  ${r.met ? '✓达标' : '✘仍超标'}`);
}
if (DRY) console.log('\n★ 干跑，未写入。');
