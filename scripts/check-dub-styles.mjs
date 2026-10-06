#!/usr/bin/env node
/**
 * check-dub-styles.mjs —— 「文案+风格」配置的纹理硬红线校验
 *
 * 背景：lib/dub-styles.json 的 `bgRecipe.texture` **不是纸面字段**，
 *   dub.mjs:1064 会调 lib/dub-core.mjs 的 bgFilters(spec)，把它翻成 lavfi 真渲染：
 *     grain      → noise=alls=14:allf=t
 *     scanlines  → drawgrid=w=W:h=4:c=black@0.22
 *     paper      → noise=alls=9
 *     ...
 *   所以 texture 写错 = 会渲出**违反该风格 STYLE.md 声明**的画面。
 *
 * 本脚本把 dub-styles.json 的 bgRecipe.texture 与各风格
 *   styles/<slug>/STYLE.md 里的文字断言做交叉检查，自动拦住同类错误。
 *
 * 用法：
 *   node scripts/check-dub-styles.mjs [--styles-root <path>] [--json]
 * 默认 styles 根目录按顺序探测：
 *   $LEMO_STYLES_ROOT  →  D:/lemo-opuscar/styles  →  ../lemo-opuscar/styles  →  ./styles
 *
 * ★ 失明守卫（2026-10-04 补）：STYLES_ROOT 为 null、或**所有**风格的 STYLE.md 都读不到时，
 *   主循环里每个风格都走 SKIP 分支、`fails` 恒空 ⇒ 闸门「什么都没检查」却报 exit 0（空转绿灯）。
 *   判据：`!STYLES_ROOT` 或 `skipped === dub.styles.length` ⇒ 判 FAIL 并明说「已失明」。
 * 退出码：发现硬红线不一致（或失明）→ 1；否则 0。
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { alphaOf, isVisibleColor, relativeLuminance } from '../lib/dub-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DUB_STYLES = join(ROOT, 'lib', 'dub-styles.json');
const DUB_VISUAL = join(ROOT, 'lib', 'dub-visual.json');

// ── 命令行 ──────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const rootArgIdx = argv.indexOf('--styles-root');
const rootArg = rootArgIdx >= 0 ? argv[rootArgIdx + 1] : null;

function pickStylesRoot() {
  const cands = [
    rootArg,
    process.env.LEMO_STYLES_ROOT,
    'D:/lemo-opuscar/styles',
    resolve(ROOT, '..', 'lemo-opuscar', 'styles'),
    join(ROOT, 'styles'),
  ].filter(Boolean);
  for (const c of cands) {
    if (existsSync(c)) return resolve(c);
  }
  return null;
}

const STYLES_ROOT = pickStylesRoot();

// ── 断言规则 ────────────────────────────────────────────────────
// 硬红线 1：STYLE.md 明写「无扫描线」而配置却开了 scanlines
const RE_NO_SCANLINE = /no\s+scanlines?/i;
// 硬红线 2：STYLE.md 明写「无（胶片）颗粒」/「颗粒不在画面里」而配置却开了 grain
const RE_NO_GRAIN = [
  /no\s+(film\s+|added\s+)?grain/i,
  /grain[^.\n]{0,60}?not\s+in\s+the\s+page/i,
  /\bgrain\s+0\b/i,
];

const SCANLINE_TEX = new Set(['scanlines', 'scanline']);
const GRAIN_TEX = new Set(['grain']);

// 硬红线 5 的豁免名单：风格确实由后期 pass（而非 bgRecipe）加扫描线时在此登记。
const ALLOW_MISSING_SCANLINE = new Set([]);

// ── 字幕底衬（subtitle.plate）硬红线 ────────────────────────────────
// 背景：ASS 的 `BorderStyle=1` 下 **BackColour 不参与渲染**（只有 Outline + Shadow 生效），
//   所以 STYLE.md §4 为 25 个风格声明的「底衬 / 胶囊 / 色带 / 字幕卡」在这条通路上
//   从来没画出来过。要真画出来必须切 `BorderStyle=3`（不透明底盒）。
//   ⇒ 一旦开了 plate="box"，就必须保证「字色 vs 有效底衬色」可读，否则会渲出
//     深色字压深色底、字幕整体消失的成片。
// 硬红线 6：plate="box" 时底衬与字色的 WCAG 对比度 < 3.0（字幕属大字号）→ FAIL
// 硬红线 7：plate="box" 但底衬色 alpha 字节 = 255（全透明）→ FAIL（画不出来）
// 硬红线 8：plate="box" 但 dub-visual.json 里没有对应证据 → WARN（不许无据开底衬）
// 硬红线 9：STYLE.md §4 明写「no box / not in a box」而配置开了 plate="box" → FAIL
// ★ 用 4.5 而非 WCAG 大字号下限 3.0：留余量以抓住回归（见 check-plate-pixel.mjs 的说明）。
//   注意本检查器算的是**模型值**（plateColor 与背景单层合成），与真实渲染可能有偏差，
//   所以还有 scripts/check-plate-pixel.mjs 做像素级校验 —— 两者都要跑。
const PLATE_MIN_CONTRAST = 4.5;
const RE_NO_BOX = [
  /\bno\s+box\b/i,
  /\bnot\s+in\s+a\s+box\b/i,
  /\bnever\s+a\s+generic\s+overlay\b/i,
];

/** 6 位/8 位色串 → [r,g,b]；认不出 → null */
function rgbOf(v) {
  const h = String(v ?? '').replace(/^#/, '').replace(/^&H/i, '').replace(/^0x/i, '');
  const s = h.length === 8 ? h.slice(2) : h;
  return /^[0-9A-Fa-f]{6}$/.test(s)
    ? [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
    : null;
}
/** WCAG 对比度（两色） */
function contrastOf(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
/** 半透明底衬与背景合成（ASS alpha 字节是「透明度」：0=不透明） */
function compositeOver(plateHex, bgHex) {
  const p = rgbOf(plateHex), b = rgbOf(bgHex);
  if (!p) return null;
  if (!b) return plateHex;
  const a = 1 - alphaOf(plateHex) / 255;   // 不透明度
  const mix = p.map((c, i) => Math.round(c * a + b[i] * (1 - a)));
  return '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('');
}

let dubVisual = null;
try { dubVisual = JSON.parse(readFileSync(DUB_VISUAL, 'utf8')); } catch { /* 证据层缺失只降级为 WARN */ }

const NEG_BEFORE = /\b(no|not|never|without|unlike|nor|neither)\b[^.\n]{0,40}$/i;

/**
 * 判断 STYLE.md 是否**正面**声明了某个词（word 只给单数词干，如 'scanline' / 'grain'）。
 * 命中处前 40 字符若含否定词（no/not/never/without/unlike/nor/neither）则视为否定提及。
 */
function positiveMention(md, word) {
  const re = new RegExp(`\\b${word}s?\\b`, 'gi');
  let m;
  while ((m = re.exec(md)) !== null) {
    const before = md.slice(Math.max(0, m.index - 40), m.index);
    if (!NEG_BEFORE.test(before)) return true;
  }
  return false;
}

// ── 读配置 ──────────────────────────────────────────────────────
let dub;
try {
  dub = JSON.parse(readFileSync(DUB_STYLES, 'utf8'));
} catch (e) {
  console.error(`无法读取/解析 ${DUB_STYLES}: ${e.message}`);
  process.exit(2);
}
if (!Array.isArray(dub.styles)) {
  console.error('dub-styles.json 缺少 styles[]');
  process.exit(2);
}

const fails = [];
const warns = [];
const rows = [];

for (const st of dub.styles) {
  const slug = st.slug || st.id;
  const tex = String((st.bgRecipe || {}).texture || 'none');
  const rel = `styles/${slug}/STYLE.md`;
  const abs = STYLES_ROOT ? join(STYLES_ROOT, slug, 'STYLE.md') : null;

  if (!abs || !existsSync(abs)) {
    rows.push({ slug, texture: tex, status: 'SKIP', why: `未找到 ${rel}` });
    warns.push(`${slug}: 找不到 ${rel}（styles-root=${STYLES_ROOT ?? 'null'}），跳过断言检查`);
    continue;
  }
  const md = readFileSync(abs, 'utf8');

  const noScan = RE_NO_SCANLINE.test(md);
  const noGrain = RE_NO_GRAIN.some((r) => r.test(md));
  const posScan = positiveMention(md, 'scanline');
  const posGrain = positiveMention(md, 'grain');

  // 硬红线 1：声明「无扫描线」却配 scanlines
  if (noScan && SCANLINE_TEX.has(tex)) {
    fails.push(`${slug}: STYLE.md 明写「No scanlines」，但 bgRecipe.texture="${tex}"（会渲出扫描线）`);
    rows.push({ slug, texture: tex, status: 'FAIL', why: 'STYLE.md 禁 scanlines，配置却是 scanlines' });
    continue;
  }
  // 硬红线 2：声明「无颗粒」却配 grain
  if (noGrain && GRAIN_TEX.has(tex)) {
    fails.push(`${slug}: STYLE.md 明写「no grain / 颗粒不在画面里」，但 bgRecipe.texture="${tex}"（会渲出颗粒）`);
    rows.push({ slug, texture: tex, status: 'FAIL', why: 'STYLE.md 禁 grain，配置却是 grain' });
    continue;
  }
  // 硬红线 3：配了 scanlines，但 STYLE.md 通篇没正面提过扫描线
  if (SCANLINE_TEX.has(tex) && !posScan) {
    fails.push(`${slug}: bgRecipe.texture="${tex}"，但 STYLE.md 从未正面声明扫描线（疑似误配）`);
    rows.push({ slug, texture: tex, status: 'FAIL', why: 'STYLE.md 无 scanline 声明' });
    continue;
  }
  // 硬红线 4：配了 grain，但 STYLE.md 通篇没提过颗粒
  if (GRAIN_TEX.has(tex) && !posGrain) {
    fails.push(`${slug}: bgRecipe.texture="${tex}"，但 STYLE.md 从未提过 grain（疑似误配）`);
    rows.push({ slug, texture: tex, status: 'FAIL', why: 'STYLE.md 无 grain 声明' });
    continue;
  }

  // 硬红线 5：STYLE.md 正面声明了扫描线（定义性层），配置却没开
  //   （扫描线是视觉定义层，少一层就不像；若某风格确实由后期 pass 而非 bgRecipe 加扫描线，
  //     在此登记豁免 —— 目前为空。）
  if (posScan && !noScan && !SCANLINE_TEX.has(tex) && !ALLOW_MISSING_SCANLINE.has(slug)) {
    fails.push(`${slug}: STYLE.md 正面声明 scanlines，但 bgRecipe.texture="${tex}"（少了定义性纹理层）`);
    rows.push({ slug, texture: tex, status: 'FAIL', why: 'STYLE.md 有 scanline 声明，配置未开' });
    continue;
  }

  rows.push({ slug, texture: tex, status: 'PASS', why: '' });
}

// ★ 失明守卫（2026-10-04 补）：styles-root 未找到、或所有风格的 STYLE.md 都读不到时，
//   上面的主循环会「全部 SKIP」⇒ fails 恒空 ⇒ 静默绿。这里把「什么都没检查」显式判 FAIL。
const skipped = rows.filter((r) => r.status === 'SKIP').length;
if (!STYLES_ROOT || skipped === dub.styles.length) {
  fails.push('✘ 失明：styles-root 未找到（或全部风格的 STYLE.md 都读不到）⇒ 本闸门实际上什么都没检查');
}

// ── 字幕底衬检查（与纹理检查分开遍历：纹理 FAIL 会 continue，底衬仍需独立判）──
const plateFails = [];
const plateWarns = [];
const plateRows = [];
for (const st of dub.styles) {
  const slug = st.slug || st.id;
  const sub = st.subtitle || {};
  const plate = sub.plate || 'shadow';
  if (plate === 'shadow') continue;                       // 缺省 = 旧行为，不检查
  const abs = STYLES_ROOT ? join(STYLES_ROOT, slug, 'STYLE.md') : null;
  const md = abs && existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  const text = (st.palette || {}).subtitle || 'FFFFFF';

  if (plate !== 'box' && plate !== 'none') {
    plateFails.push(`${slug}: subtitle.plate="${plate}" 不是合法值（只允许 shadow / box / none）`);
    plateRows.push({ slug, plate, status: 'FAIL', why: 'plate 取值非法' });
    continue;
  }
  if (plate === 'none') { plateRows.push({ slug, plate, status: 'PASS', why: '显式不画底衬' }); continue; }

  // 硬红线 9：STYLE.md 明写「无底盒」却开了 box
  if (md && RE_NO_BOX.some((r) => r.test(md))) {
    plateFails.push(`${slug}: STYLE.md 明写「no box / not in a box」，但 subtitle.plate="box"`);
    plateRows.push({ slug, plate, status: 'FAIL', why: 'STYLE.md 声明无底盒' });
    continue;
  }

  // 硬红线 7：**显式**给了 plateColor 却画不出来（全透明/非法色串）→ 硬错误。
  //   不能悄悄回退：作者写了值却渲染不出来，是配置错误，必须暴露。
  if (sub.plateColor !== undefined && sub.plateColor !== null && !isVisibleColor(sub.plateColor)) {
    plateFails.push(`${slug}: subtitle.plateColor="${sub.plateColor}" 画不出来（全透明或非法色串）→ 底盒不可见`);
    plateRows.push({ slug, plate, status: 'FAIL', why: 'plateColor 全透明/非法' });
    continue;
  }

  // 底衬色：显式 plateColor → palette.subtitleBack → palette.bg@CC（与 dub-core 同一条链）
  //   ★ ASS alpha 是「透明度」：0=不透明。判「画得出来」用 isVisibleColor，不能写 alphaOf>0。
  const usable = isVisibleColor(sub.plateColor) || isVisibleColor((st.palette || {}).subtitleBack);
  const raw = isVisibleColor(sub.plateColor) ? sub.plateColor : (st.palette || {}).subtitleBack;
  const plateColor = usable ? raw : (((st.palette || {}).bg || '0C1016') + '');
  const withA = usable ? plateColor : ('CC' + plateColor.replace(/^#/, ''));

  // 硬红线 6：对比度
  const r = st.bgRecipe || {};
  const stops = Array.isArray(r.stops) ? r.stops : [];
  const bgHex = (String(r.type) === 'solid' && stops[0]) ? stops[0] : ((st.palette || {}).bg || '0C1016');
  const eff = compositeOver(withA, bgHex);
  const cr = eff ? contrastOf(text, eff) : null;
  if (cr !== null && cr < PLATE_MIN_CONTRAST) {
    plateFails.push(`${slug}: 字幕字色 ${text} 与有效底衬 ${eff} 对比度 ${cr.toFixed(2)} < ${PLATE_MIN_CONTRAST}（字幕会看不清）`);
    plateRows.push({ slug, plate, status: 'FAIL', why: `对比度 ${cr.toFixed(2)}` });
    continue;
  }

  // 硬红线 8：必须有证据
  const ev = dubVisual && dubVisual.styles && dubVisual.styles[slug] && dubVisual.styles[slug].subtitleStyle;
  if (!ev || ev.plate !== 'box' || !ev.plateEvidence) {
    plateWarns.push(`${slug}: plate="box" 但 dub-visual.json 无对应证据（plate/plateEvidence）`);
    plateRows.push({ slug, plate, status: 'WARN', why: `对比度 ${cr === null ? '?' : cr.toFixed(2)}；缺证据` });
    continue;
  }
  plateRows.push({ slug, plate, status: 'PASS', why: `对比度 ${cr === null ? '?' : cr.toFixed(2)}` });
}
fails.push(...plateFails);
warns.push(...plateWarns);

// ── 输出 ────────────────────────────────────────────────────────
if (asJson) {
  console.log(JSON.stringify({ stylesRoot: STYLES_ROOT, fails, warns, rows, plateRows }, null, 2));
} else {
  console.log(`check-dub-styles —— 纹理硬红线校验`);
  console.log(`  dub-styles : ${DUB_STYLES}`);
  console.log(`  styles-root: ${STYLES_ROOT ?? '(未找到)'}`);
  console.log(`  风格总数   : ${dub.styles.length}`);
  console.log('');
  for (const r of rows) {
    const mark = r.status === 'PASS' ? '  ok ' : r.status === 'WARN' ? ' warn' : r.status === 'SKIP' ? ' skip' : ' FAIL';
    console.log(`${mark}  ${String(r.slug).padEnd(22)} texture=${String(r.texture).padEnd(14)} ${r.why || ''}`);
  }
  console.log('');
  console.log(`── 字幕底衬（subtitle.plate="box" 共 ${plateRows.length} 个）──`);
  for (const r of plateRows) {
    const mark = r.status === 'PASS' ? '  ok ' : r.status === 'WARN' ? ' warn' : ' FAIL';
    console.log(`${mark}  ${String(r.slug).padEnd(22)} plate=${String(r.plate).padEnd(8)} ${r.why || ''}`);
  }
  console.log('');
  if (warns.length) {
    console.log(`提示 ${warns.length} 条：`);
    for (const w of warns) console.log(`  - ${w}`);
    console.log('');
  }
  if (fails.length) {
    console.log(`✗ 硬红线不一致 ${fails.length} 条：`);
    for (const f of fails) console.log(`  - ${f}`);
  } else {
    console.log('✓ 未发现纹理硬红线不一致。');
  }
}

process.exit(fails.length ? 1 : 0);
