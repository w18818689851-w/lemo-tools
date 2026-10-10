#!/usr/bin/env node
// test/sizes.test.mjs —— `lib/sizes.mjs`（「输出尺寸」注册表的只读代理）的纯逻辑测试
//
// ★ 为什么必须有这一份：
//   `lib/sizes.mjs` 的 `resolveSize` / `parseSizeSpec` / `formatSize` / `sizeInfo` 在 `test/`
//   里**零直接引用**（审计实测），且它**既无专门测试、也无专门闸门**。
//   ★ 而它是 `--ratio` 判据的**真相源** —— `lib/briefs.mjs` 的 `--ratio` 值位判据就是
//     `lib/sizes.mjs:resolveSize`（见 `test/README.md` 的 ⑮ 段）。它坏掉 = 工单校验口径漂了，
//     而漂法是**静默**的（`--ratio 99:99` 该拒却放行、或该放行却拒）。⇒ 用本文件钉住它。
//
// ★ 隔离（绝不碰真实库仓 `D:/lemo-opuscar`）：
//   本模块的注册表来源 = `path.join(CFG.winLib, 'core','render','size.mjs')`，而 `CFG.winLib`
//   认覆盖点 `LEMO_LIB_WIN`（本项目惯例）。⇒ 本文件在**导入之前**把 `LEMO_LIB_WIN` 指到
//   `D:/lemo-tmp/` 下的**夹具库树**（含一个合成 `core/render/size.mjs`），于是跑的是本模块
//   **真实的**代理 / `sizeInfo` 分支代码，只把「库侧 size.mjs」换掉。**绝不读真实库仓**。
//
// ★ 只测纯函数与确定性行为：不起服务、不跑渲染 / WSL、不写任何真实目录。
//
// 用法：node test/sizes.test.mjs
// 退出码：全绿 0，有失败 1。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ── 夹具库树（`D:/lemo-tmp/` 临时树，绝不碰真实库仓）──────────────────────
const FX_ROOT = 'D:/lemo-tmp/gp2-sizes-fx';          // 充当 LEMO_LIB_WIN

// 夹具 size.mjs：与库侧 `core/render/size.mjs` **同形**（RATIOS / DEFAULT_RATIO /
// parseSizeSpec / resolveSize / formatSize / MIN_SIZE / MAX_SIZE），语义按本项目的
// 「偶数、96–8192」约定写死 —— 这样断言的是 lib/sizes.mjs 的**代理与分支**，不是真库。
const FIXTURE_SIZE_MJS = [
  '// 夹具尺寸注册表（合成，不来自真实库仓）',
  'export const RATIOS = [',
  "  { id: '9:16', label: '9:16 竖屏（默认）' },",
  "  { id: '16:9', label: '16:9 横屏' },",
  "  { id: '1:1', label: '1:1 方形' },",
  '];',
  "export const DEFAULT_RATIO = '9:16';",
  'export const MIN_SIZE = 96;',
  'export const MAX_SIZE = 8192;',
  'export function parseSizeSpec(s) {',
  "  const v = String(s ?? '').trim();",
  '  if (RATIOS.some((r) => r.id === v)) return { ratio: v };',
  '  const m = /^(\\d{2,5})x(\\d{2,5})$/.exec(v);',
  '  if (!m) return null;',
  '  const w = Number(m[1]); const h = Number(m[2]);',
  '  if (w % 2 !== 0 || h % 2 !== 0) return null;',
  '  if (w < MIN_SIZE || w > MAX_SIZE || h < MIN_SIZE || h > MAX_SIZE) return null;',
  '  return { w, h };',
  '}',
  'export function resolveSize(opts = {}) {',
  "  if (opts.size != null && opts.size !== '') {",
  '    const p = parseSizeSpec(opts.size);',
  '    return p && p.w ? { w: p.w, h: p.h } : null;',
  '  }',
  '  const spec = parseSizeSpec(opts.ratio || DEFAULT_RATIO);',
  '  if (!spec || !spec.ratio) return null;',
  '  const base = opts.base || 1920;',
  "  const [a, b] = spec.ratio.split(':').map(Number);",
  '  const s = base / Math.max(a, b);',
  '  const even = (n) => 2 * Math.round(n / 2);',
  '  return { w: even(a * s), h: even(b * s) };',
  '}',
  'export function formatSize(d) {',
  "  return d && d.w != null && d.h != null ? `${d.w}x${d.h}` : '';",
  '}',
  '',
].join('\n');

fs.rmSync(FX_ROOT, { recursive: true, force: true });
fs.mkdirSync(path.join(FX_ROOT, 'core', 'render'), { recursive: true });
fs.writeFileSync(path.join(FX_ROOT, 'core', 'render', 'size.mjs'), FIXTURE_SIZE_MJS);

// ★ 必须在 import 之前设好：`CFG.winLib` 在 `lib/env.mjs` 的**模块求值期**读这个变量。
process.env.LEMO_LIB_WIN = FX_ROOT;
const sizes = await import('../lib/sizes.mjs');

after(() => {
  try { fs.rmSync(FX_ROOT, { recursive: true, force: true }); } catch { /* 清不掉也不影响结论 */ }
});

// ── 0. 夹具真的被读到了（否则后面全是「降级态」的假绿）────────────────────
test('夹具库侧 size.mjs 被真正加载（registryError 为 null，而不是静默降级）', () => {
  assert.equal(sizes.sizesRegistryError, null, `夹具没被读到：${sizes.sizesRegistryError}`);
  assert.match(String(sizes.sizeSource), /size\.mjs$/);
  assert.equal(sizes.MIN_SIZE, 96);
  assert.equal(sizes.MAX_SIZE, 8192);
});

// ── 1. 注册表常量（原样透传库侧）─────────────────────────────────────────
test('RATIOS / DEFAULT_RATIO 原样来自库侧，ratioIds 与顺序一致', () => {
  assert.deepEqual(sizes.RATIOS, [
    { id: '9:16', label: '9:16 竖屏（默认）' },
    { id: '16:9', label: '16:9 横屏' },
    { id: '1:1', label: '1:1 方形' },
  ]);
  assert.equal(sizes.DEFAULT_RATIO, '9:16');
  assert.deepEqual(sizes.ratioIds(), ['9:16', '16:9', '1:1']);
});

// ── 2. isRatioId / ratioLabel（纯判据）──────────────────────────────────
test('isRatioId 只认预设比例 id，拒绝未知 / 空 / 非字符串', () => {
  assert.equal(sizes.isRatioId('9:16'), true);
  assert.equal(sizes.isRatioId('16:9'), true);
  assert.equal(sizes.isRatioId('7:5'), false);
  assert.equal(sizes.isRatioId(''), false);
  assert.equal(sizes.isRatioId(null), false);
  assert.equal(sizes.isRatioId(undefined), false);
  assert.equal(sizes.isRatioId(916), false);
});

test('ratioLabel：预设比例回 label，未知回原样，空值回空串', () => {
  assert.equal(sizes.ratioLabel('16:9'), '16:9 横屏');
  assert.equal(sizes.ratioLabel('7:5'), '7:5');
  assert.equal(sizes.ratioLabel(null), '');
  assert.equal(sizes.ratioLabel(undefined), '');
});

// ── 3. parseSizeSpec / resolveSize（--ratio 判据的真相源）────────────────
test('parseSizeSpec：预设比例 / 合法 WxH / 非法一律 null', () => {
  assert.deepEqual(sizes.parseSizeSpec('9:16'), { ratio: '9:16' });
  assert.deepEqual(sizes.parseSizeSpec('1080x1920'), { w: 1080, h: 1920 });
  assert.equal(sizes.parseSizeSpec('99:99'), null);
  assert.equal(sizes.parseSizeSpec('1081x1920'), null, '奇数像素不合法');
  assert.equal(sizes.parseSizeSpec('10x10'), null, '低于下限 96 不合法');
  assert.equal(sizes.parseSizeSpec('99999x99999'), null, '高于上限 8192 不合法');
  assert.equal(sizes.parseSizeSpec('garbage'), null);
  assert.equal(sizes.parseSizeSpec(''), null);
  assert.equal(sizes.parseSizeSpec(null), null);
});

test('resolveSize：预设比例换算成偶数像素；非法 spec 回 null', () => {
  assert.deepEqual(sizes.resolveSize({}), { w: 1080, h: 1920 }, '默认 9:16 · base 1920');
  assert.deepEqual(sizes.resolveSize({ ratio: '16:9' }), { w: 1920, h: 1080 });
  assert.deepEqual(sizes.resolveSize({ ratio: '1:1' }), { w: 1920, h: 1920 });
  assert.deepEqual(sizes.resolveSize({ size: '1080x1920' }), { w: 1080, h: 1920 }, '自定义像素优先');
  assert.equal(sizes.resolveSize({ ratio: '99:99' }), null);
  assert.equal(sizes.resolveSize({ size: 'abc' }), null);
});

test('formatSize：{w,h} → WxH；缺字段回空串', () => {
  assert.equal(sizes.formatSize({ w: 1080, h: 1920 }), '1080x1920');
  assert.equal(sizes.formatSize({ w: 1080 }), '');
  assert.equal(sizes.formatSize(null), '');
  assert.equal(sizes.formatSize(undefined), '');
});

// ── 4. sizeInfo：给 UI / API 的尺寸摘要（分支最多的一块）─────────────────
test('sizeInfo：空工单 ⇒ 默认比例 9:16、valid、非自定义', () => {
  const r = sizes.sizeInfo();
  assert.equal(r.ratio, '9:16');
  assert.equal(r.size, null);
  assert.equal(r.w, 1080);
  assert.equal(r.h, 1920);
  assert.equal(r.display, '9:16');
  assert.equal(r.ratioLabel, '9:16 竖屏（默认）');
  assert.equal(r.isCustom, false);
  assert.equal(r.valid, true);
  assert.equal(r.error, null);
});

test('sizeInfo：预设比例工单 ⇒ valid，ratioLabel 来自注册表', () => {
  const r = sizes.sizeInfo({ ratio: '16:9' });
  assert.equal(r.ratio, '16:9');
  assert.equal(r.w, 1920);
  assert.equal(r.h, 1080);
  assert.equal(r.display, '16:9');
  assert.equal(r.ratioLabel, '16:9 横屏');
  assert.equal(r.valid, true);
});

test('sizeInfo：未知比例 ⇒ 静默回落默认比例（不抛、不报错）', () => {
  const r = sizes.sizeInfo({ ratio: '7:5' });
  assert.equal(r.ratio, '9:16', '非预设比例应回落默认');
  assert.equal(r.display, '9:16');
  assert.equal(r.valid, true);
  assert.equal(r.error, null);
});

test('sizeInfo：合法自定义像素 ⇒ isCustom、display 回原始写法', () => {
  const r = sizes.sizeInfo({ size: '1080x1920' });
  assert.equal(r.isCustom, true);
  assert.equal(r.valid, true);
  assert.equal(r.size, '1080x1920');
  assert.equal(r.w, 1080);
  assert.equal(r.h, 1920);
  assert.equal(r.display, '1080x1920');
  assert.equal(r.ratioLabel, '自定义');
  assert.equal(r.error, null);
});

test('sizeInfo：非法自定义像素 ⇒ valid:false + 明确的错误文案（含上下限）', () => {
  const r = sizes.sizeInfo({ size: '1081x1920' });
  assert.equal(r.isCustom, true);
  assert.equal(r.valid, false);
  assert.equal(r.w, null);
  assert.equal(r.h, null);
  assert.equal(r.display, '1081x1920', '非法时 display 回原始写法，便于提示用户');
  assert.match(String(r.error), /1081x1920/);
  assert.match(String(r.error), /96[–-]8192/, '错误文案应写出 96–8192 的合法区间');
});

test('sizeInfo：越界 / 非 WxH 写法同样 valid:false', () => {
  assert.equal(sizes.sizeInfo({ size: '10x10' }).valid, false, '低于下限');
  assert.equal(sizes.sizeInfo({ size: '99999x99999' }).valid, false, '高于上限');
  assert.equal(sizes.sizeInfo({ size: 'abc' }).valid, false, '不是 WxH');
});

test('sizeInfo：纯空白 size 视为「没给」⇒ 走比例分支', () => {
  const r = sizes.sizeInfo({ size: '   ', ratio: '16:9' });
  assert.equal(r.isCustom, false);
  assert.equal(r.ratio, '16:9');
  assert.equal(r.valid, true);
});

test('sizeInfo：自定义像素优先，ratio 只作记录（合法时按 isRatioId 记）', () => {
  const ok = sizes.sizeInfo({ size: '1080x1920', ratio: '16:9' });
  assert.equal(ok.isCustom, true);
  assert.equal(ok.ratio, '16:9', '合法自定义时 ratio 仅作记录');
  assert.equal(ok.display, '1080x1920');

  const bad = sizes.sizeInfo({ size: '1080x1920', ratio: '7:5' });
  assert.equal(bad.ratio, '9:16', '非法 ratio 记录值应回落默认');
});
