#!/usr/bin/env node
/**
 * check-plate-pixel.mjs —— 字幕底衬的**像素级**校验（渲染真值，不是模型推算）
 *
 * ★ 为什么需要它（2026-10-03 立的由来）：
 *   `check-dub-styles.mjs` 的底衬对比度是**按模型算的**（plateColor 与背景单层合成）。
 *   实测证明这个模型会**漏掉真实渲染的偏差**：
 *     · 把底衬色填错字段（填 BackColour 而非 OutlineColour）时，检查器仍报 25/25 通过，
 *       而实际渲染出来 12/25 个风格对比度只有 1.00~1.43（字幕根本看不清）。
 *     · `BorderStyle=3` 下 `Shadow=1` 会叠一层与盒几乎完全重叠的整盒阴影，把半透明底衬
 *       二次压暗（hd-2d 实测 6.00 → 3.18），检查器同样看不出来。
 *   ⇒ **模型校验 + 像素校验，两者都要。** 本脚本就是后者。
 *
 * 做法：对每个开了 plate="box" 的风格，
 *   ① 渲染一帧「box 模式」② 渲染一帧「把 plate 去掉（= 旧 shadow 行为）」
 *   ③ 两帧差分 ⇒ 隔离出**底衬真正占据的像素**
 *   ④ 取差分区域里出现次数最多的颜色 = 实测底衬色
 *   ⑤ 与「plateColor 与背景单层合成」的理论值比对，并算与字色的 WCAG 对比度
 *
 * 用法：
 *   node scripts/check-plate-pixel.mjs [--only a,b] [--json] [--ffmpeg <path>] [--keep]
 * 退出码：实测底衬色与理论值偏差过大、或对比度 < 3.0 → 1；否则 0。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { styleSpec, buildAss, alphaOf, isVisibleColor, relativeLuminance } from '../lib/dub-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DUB_STYLES = path.join(ROOT, 'lib', 'dub-styles.json');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const keep = argv.includes('--keep');
const onlyIdx = argv.indexOf('--only');
const only = onlyIdx >= 0 ? String(argv[onlyIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : null;
const ffIdx = argv.indexOf('--ffmpeg');
const FF = ffIdx >= 0 ? argv[ffIdx + 1]
  : (process.env.LEMO_FFMPEG || 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe');

const W = 1920, H = 1080;
const T = 1.5;                  // ★ 不能取 t=0：subtitleFadeIn>0 的风格在 t=0 字幕是全透明的
// ★ 用 4.5 而不是 WCAG 大字号的 3.0 下限：留出余量，好让「盒阴影把半透明底衬二次压暗」
//   这类回归能被抓住（实测 hd-2d 在 Shadow=1 时是 3.18 —— 用 3.0 会擦边放行）。
//   当前 25 个风格实测最低 5.95，余量充足。
const MIN_CONTRAST = 4.5;
// ★ 绝对色差**不能**当主判据（2026-10-03 实测）：渲染链有 YUV 往返（ASS 里 `YCbCr Matrix: TV.709`），
//   高饱和色会掉饱和 —— 实测偏差与饱和度正相关：backrooms #000000(零饱和) Δ0、risograph(低) Δ2、
//   tilt-shift(中高) Δ8、papercut-red(高) Δ17。而**纯色源回读**只差 1~2（`color=c=0xA8111F` → #A7111F），
//   证明偏差来自渲染链而非底衬色本身。⇒ 绝对色差只作**参考值**报告，阈值放宽；
//   真正的**决定性判据是下面的「品红标记色测试」**（验字段映射）+ 「实测对比度」（验可读性）。
const MAX_CHANNEL_DIFF = 20;    // 仅作粗筛：绝对色差超过它才提示（见上面的说明）

// ── 颜色小工具 ────────────────────────────────────────────────
const rgbOf = (v) => { const h = String(v ?? '').replace(/^#/, ''); const s = h.length === 8 ? h.slice(2) : h;
  return /^[0-9A-Fa-f]{6}$/.test(s) ? [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)] : null; };
const lum = (rgb) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  return 0.2126*f(rgb[0]) + 0.7152*f(rgb[1]) + 0.0722*f(rgb[2]); };
const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1,l2), lo = Math.min(l1,l2); return (hi+0.05)/(lo+0.05); };
const over = (fg, a, bg) => fg.map((c, i) => Math.round(c*a + bg[i]*(1-a)));
const hex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2,'0')).join('').toUpperCase();

const run = (args, cwd) => new Promise((res) => {
  const p = spawn(FF, args, { cwd, stdio: ['ignore','pipe','pipe'] });
  let e = ''; p.stderr.on('data', (d) => e += d); p.on('close', (c) => res({ code: c, err: e }));
});

const reg = JSON.parse(fs.readFileSync(DUB_STYLES, 'utf8'));
let list = reg.styles.filter((s) => s.subtitle && s.subtitle.plate === 'box');
if (only) list = list.filter((s) => only.includes(s.slug));
if (!list.length) { console.error('没有匹配的 plate="box" 风格'); process.exit(2); }
if (!fs.existsSync(FF)) { console.error(`找不到 ffmpeg: ${FF}`); process.exit(2); }

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'plate-px-'));
const items = [{ sub0: 0, sub1: 3.0, text: '字幕底衬像素校验 ABC 123' }];

/** 渲染一帧，返回 rawvideo 的 rgb24 Buffer */
async function frame(st, tag) {
  const ass = buildAss(items, { W, H, style: st, total: 3.0 });
  fs.writeFileSync(path.join(TMP, `${tag}.ass`), ass, 'utf8');
  const bg = String((st.palette || {}).bg || '0C1016').replace(/^#/, '');
  const { code, err } = await run([
    '-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=0x${bg}:s=${W}x${H}`,
    '-ss', String(T), '-vf', `subtitles=${tag}.ass`, '-frames:v', '1',
    '-pix_fmt', 'rgb24', '-f', 'rawvideo', `${tag}.raw`,
  ], TMP);
  if (code !== 0) throw new Error(`ffmpeg 失败(${tag}): ${err.slice(0, 200)}`);
  return fs.readFileSync(path.join(TMP, `${tag}.raw`));
}

const rows = [];

/**
 * ★★ 决定性判据：品红标记色测试（验「底衬色确实取自 plateColor 字段」）
 * 把 plateColor 临时设成不透明品红 #00FF00FF 再渲染，盒内众数色必须是品红系。
 * 若底衬色被写进了别的字段（历史上踩过：写进 BackColour 而盒实际取 OutlineColour），
 * 盒色就会变成 palette.subtitleOutline，不是品红 ⇒ 当场抓住。
 */
const MARK = '#00FF00FF';
async function markerTest(st) {
  const probe = { ...st, subtitle: { ...st.subtitle, plate: 'box', plateColor: MARK } };
  const withMark = { ...st, subtitle: { ...st.subtitle } };
  delete withMark.subtitle.plate; delete withMark.subtitle.plateColor;
  let A, B;
  try { A = await frame(probe, `${st.slug}_mark`); B = await frame(withMark, `${st.slug}_markold`); }
  catch (e) { return { ok: false, why: 'render: ' + e.message.slice(0, 60) }; }
  const tally = new Map();
  for (let i = 0; i < A.length; i += 3) {
    if (Math.abs(A[i]-B[i]) + Math.abs(A[i+1]-B[i+1]) + Math.abs(A[i+2]-B[i+2]) <= 6) continue;
    const k = (A[i] << 16) | (A[i+1] << 8) | A[i+2];
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  if (!tally.size) return { ok: false, why: '差分 0 像素（底衬没画出来）' };
  let bk = 0, bn = -1;
  for (const [k, n] of tally) if (n > bn) { bn = n; bk = k; }
  const rgb = [(bk >> 16) & 255, (bk >> 8) & 255, bk & 255];
  // 品红系：R、B 高、G 低。留足余量以吸收 YUV 掉饱和（实测品红会被压到约 R150/B150/G60）
  const isMagenta = rgb[0] > 110 && rgb[2] > 110 && rgb[1] < 110 && Math.abs(rgb[0] - rgb[2]) < 90;
  return { ok: isMagenta, actual: hex(rgb), why: isMagenta ? '' : `盒色 ${hex(rgb)} 不是品红 ⇒ 底衬色未取自 plateColor` };
}

for (const st of list) {
  const spec = styleSpec(st, { W, H });
  const pal = spec.palette || {};
  const r = spec.bgRecipe || {};
  const stops = Array.isArray(r.stops) ? r.stops : [];
  const bgHex = (String(r.type) === 'solid' && stops[0]) ? stops[0] : (pal.bg || '0C1016');
  const bg = rgbOf(bgHex) || [12,16,22];

  // 理论值：显式 plateColor → subtitleBack → bg@CC（与 dub-core 同一条链）
  const usable = isVisibleColor(st.subtitle.plateColor) || isVisibleColor(pal.subtitleBack);
  const raw = isVisibleColor(st.subtitle.plateColor) ? st.subtitle.plateColor : pal.subtitleBack;
  const plateSrc = usable ? raw : ('CC' + String(pal.bg || '0C1016').replace(/^#/, ''));
  const a = 1 - alphaOf(plateSrc) / 255;
  const expect = over(rgbOf(plateSrc) || bg, a, bg);

  const mark = await markerTest(st);

  const withBox = { ...st, subtitle: { ...st.subtitle } };
  const noPlate = { ...st, subtitle: { ...st.subtitle } };
  delete noPlate.subtitle.plate; delete noPlate.subtitle.plateColor;

  let A, B;
  try { A = await frame(withBox, `${st.slug}_box`); B = await frame(noPlate, `${st.slug}_old`); }
  catch (e) { rows.push({ slug: st.slug, error: e.message }); continue; }

  // 差分 ⇒ 底衬像素；取众数色
  const tally = new Map();
  let diffN = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const d = Math.abs(A[i]-B[i]) + Math.abs(A[i+1]-B[i+1]) + Math.abs(A[i+2]-B[i+2]);
      if (d <= 6) continue;
      diffN++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      const k = (A[i] << 16) | (A[i+1] << 8) | A[i+2];
      tally.set(k, (tally.get(k) || 0) + 1);
    }
  }
  if (!tally.size) { rows.push({ slug: st.slug, diffN: 0, note: '底衬与背景同色 ⇒ 差分 0 像素（视觉上等于无底衬）' }); continue; }
  let bestK = 0, bestN = -1;
  for (const [k, n] of tally) if (n > bestN) { bestN = n; bestK = k; }
  const actual = [(bestK >> 16) & 255, (bestK >> 8) & 255, bestK & 255];
  const md = Math.max(...actual.map((c, i) => Math.abs(c - expect[i])));
  const cr = contrast(rgbOf(pal.subtitle || 'FFFFFF') || [255,255,255], actual);
  rows.push({
    slug: st.slug, plate: plateSrc, alpha: +a.toFixed(3),
    expect: hex(expect), actual: hex(actual), maxDiff: md,
    box: diffN ? `${x1-x0+1}x${y1-y0+1}@(${x0},${y0})` : '-', boxPx: diffN,
    fillPct: diffN ? +(bestN / diffN * 100).toFixed(1) : 0,
    contrast: +cr.toFixed(2),
    marker: mark.ok ? '✓' : '✗',
    markerWhy: mark.why || '',
    // ★ 主判据 = 品红标记（字段映射）+ 实测对比度（可读性）；绝对色差只作粗筛
    ok: mark.ok && cr >= MIN_CONTRAST && md <= MAX_CHANNEL_DIFF,
  });
}

const fails = rows.filter((r) => r.error || r.ok === false);
if (asJson) {
  console.log(JSON.stringify({ tmp: TMP, rows, fails: fails.map((f) => f.slug) }, null, 2));
} else {
  console.log(`check-plate-pixel —— 字幕底衬像素级校验`);
  console.log(`  ffmpeg: ${FF}`);
  console.log(`  风格数: ${list.length}（plate="box"）  采样时刻 t=${T}s  底: 各风格 palette.bg 纯色`);
  console.log(`  判据(主): 品红标记色测试通过（底衬色确实取自 plateColor） 且 实测字色对比度 ≥${MIN_CONTRAST}`);
  console.log(`  判据(粗筛): 实测底衬色与理论值单通道差 ≤${MAX_CHANNEL_DIFF}（高饱和色受 YUV 往返影响，仅作粗筛）\n`);
  console.log(`${'slug'.padEnd(20)} ${'底衬(配置)'.padEnd(11)} ${'α'.padEnd(5)} ${'理论'.padEnd(8)} ${'实测'.padEnd(8)} ${'Δ'.padEnd(3)} ${'盒尺寸'.padEnd(16)} ${'填充'.padEnd(6)} 对比度  标记`);
  for (const r of rows) {
    if (r.error) { console.log(`${r.slug.padEnd(20)} ✗ 渲染失败: ${r.error.slice(0,70)}`); continue; }
    if (r.diffN === 0) { console.log(`${r.slug.padEnd(20)} ${String(r.plate).padEnd(11)} —  ${r.note}`); continue; }
    console.log(`${r.slug.padEnd(20)} ${String(r.plate).padEnd(11)} ${String(r.alpha).padEnd(5)} ${r.expect.padEnd(8)} ${r.actual.padEnd(8)} ${String(r.maxDiff).padEnd(3)} ${r.box.padEnd(16)} ${(r.fillPct+'%').padEnd(6)} ${r.contrast.toFixed(2)}  ${r.marker}${r.marker?'':' '+r.markerWhy}`);
  }
  console.log('');
  if (fails.length) { console.log(`✗ 不通过 ${fails.length} 个：`); for (const f of fails) console.log(`  - ${f.slug}${f.error?'（渲染失败）':` 标记=${f.marker}${f.markerWhy?'('+f.markerWhy+')':''}、实测 ${f.actual} vs 理论 ${f.expect}(Δ${f.maxDiff})、对比度 ${f.contrast}`}`); }
  else console.log('✓ 全部通过：底衬色确实取自 plateColor（品红标记验证），且字色对比度达标。');
  if (keep) console.log(`\n中间产物: ${TMP}`);
}
if (!keep) fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fails.length ? 1 : 0);
