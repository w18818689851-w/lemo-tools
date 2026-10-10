#!/usr/bin/env node
// test/styles.test.mjs —— `lib/styles.mjs` + `lib/styles-root.mjs` 的纯逻辑测试
//
// ★ 为什么必须有这一份：
//   这两个模块**既无专门测试、也无专门闸门**（审计实测）。而：
//     · `lib/styles.mjs` 的 `escapeHtml` / `renderMarkdown` 是**安全边界** —— 输入是仓库里的
//       `.md`（仓库可被改、可被别人 PR，**不可信**）。它坏掉 = `<script>` / `javascript:` 链接
//       能进 DOM，是**注入**。⇒ 本文件对 `escapeHtml` 专做**注入类断言**（安全相关，优先）。
//     · `parseStyleIndex` 是「9 大类风格」分类判据的**唯一**实现；它坏掉 = 风格列表静默变空。
//     · `lib/styles-root.mjs` 的 `resolveStylesRoot` 是「风格源码根」的**唯一**解析实现，
//       被 `lib/env.mjs` / `lib/aspects.mjs` / `lib/briefs.mjs` 三方共用 ⇒ 它漂了三方一起漂。
//
// ★ 隔离：这两个模块**不读**任何库仓 / 成片根（`styles.mjs` 的目录由调用方传参，
//   `styles-root.mjs` 的库根由调用方传参）⇒ 本文件全部在 `D:/lemo-tmp/` 临时夹具上跑，
//   不 import `lib/env.mjs`、不起服务、不跑渲染 / WSL、不碰任何真实目录。
//
// 用法：node test/styles.test.mjs
// 退出码：全绿 0，有失败 1。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { escapeHtml, parseStyleIndex, readStyleIndex, renderMarkdown } from '../lib/styles.mjs';
import { resolveStylesRoot } from '../lib/styles-root.mjs';

const FX_ROOT = 'D:/lemo-tmp/gp2-styles-fx';
const FX_INDEX = path.join(FX_ROOT, 'index-ok');       // 有合法 README.md
const FX_NO_README = path.join(FX_ROOT, 'index-noreadme'); // 目录在、README.md 不在
const FX_MISSING = path.join(FX_ROOT, 'index-missing');    // 目录不存在

const VALID_INDEX = [
  '## Hand-drawn & Painting · 手绘与绘画',
  '',
  '| Style | 风格 | Folder | Our demo |',
  '|---|---|---|---|',
  '| Crayon Picture Book | 蜡笔儿童绘本 | [`crayon-book`](crayon-book/STYLE.md) | *The Moon* |',
  '| Ink Wash | 水墨 | [`ink-wash`](ink-wash/STYLE.md) | *X* |',
  '',
  '## Pixel · 像素',
  '',
  '| Style | 风格 | Folder | Our demo |',
  '|---|---|---|---|',
  '| Pixel RPG | 像素 RPG | [`pixel-rpg`](pixel-rpg/STYLE.md) | *Y* |',
  '',
].join('\n');

fs.rmSync(FX_ROOT, { recursive: true, force: true });
fs.mkdirSync(FX_INDEX, { recursive: true });
fs.mkdirSync(FX_NO_README, { recursive: true });
fs.writeFileSync(path.join(FX_INDEX, 'README.md'), VALID_INDEX);

after(() => {
  try { fs.rmSync(FX_ROOT, { recursive: true, force: true }); } catch { /* 清不掉也不影响结论 */ }
});

// ══════════════════════════════════════════════════════════════════════════
//  一、escapeHtml —— 安全边界：注入类输入必须被正确转义
// ══════════════════════════════════════════════════════════════════════════
test('escapeHtml：五个危险字符逐个转义（& < > " \'）', () => {
  assert.equal(escapeHtml('&'), '&amp;');
  assert.equal(escapeHtml('<'), '&lt;');
  assert.equal(escapeHtml('>'), '&gt;');
  assert.equal(escapeHtml('"'), '&quot;');
  assert.equal(escapeHtml("'"), '&#39;');
});

test('escapeHtml：注入串 <script> 被整体转义成纯文本', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('escapeHtml：属性注入（带引号的 on* 处理器）被转义', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('escapeHtml：& 必须第一个换（否则会把已生成的实体再转一遍）', () => {
  // 若实现顺序写错（先换 < 再换 &），'&lt;' 会被二次转义成 '&amp;lt;' 之外的形态；
  // 正确实现：输入的 & 先变 &amp;，后面的 l t ; 原样 ⇒ '&amp;lt;'
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  assert.equal(escapeHtml('&amp;'), '&amp;amp;');
});

test('escapeHtml：null / undefined / 数字 / 布尔一律安全', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(false), 'false');
  assert.equal(escapeHtml(123), '123');
});

// ══════════════════════════════════════════════════════════════════════════
//  二、renderMarkdown —— 转义 + 链接伪协议防护
// ══════════════════════════════════════════════════════════════════════════
test('renderMarkdown：原始 HTML（script / img / svg）绝不进输出', () => {
  assert.equal(renderMarkdown('<script>alert(1)</script>').includes('<script>'), false);
  assert.equal(renderMarkdown('<img src=x onerror=alert(1)>').includes('<img'), false);
  assert.equal(renderMarkdown('<svg onload=alert(1)></svg>').includes('<svg'), false);
  // 转义后的正文仍在（证明不是把内容整个丢了）
  assert.equal(renderMarkdown('<script>x</script>').includes('&lt;script&gt;'), true);
});

test('renderMarkdown：javascript: / data: 伪协议链接被降级成纯文本', () => {
  const js = renderMarkdown('[点我](javascript:alert(1))');
  assert.equal(js.includes('<a '), false, 'javascript: 不该生成锚点');
  assert.equal(js.includes('javascript:'), false, '伪协议不该留在输出里');
  assert.equal(js.includes('点我'), true, '链接文字应保留');

  const data = renderMarkdown('[x](data:text/html;base64,PHN2Zz4=)');
  assert.equal(data.includes('<a '), false, 'data: 不该生成锚点');
  assert.equal(data.includes('data:'), false);
});

test('renderMarkdown：http/https/mailto/相对链接放行，并带安全属性', () => {
  const https = renderMarkdown('[x](https://example.com)');
  assert.equal(https.includes('href="https://example.com"'), true);
  assert.equal(https.includes('rel="noopener noreferrer"'), true);
  assert.equal(https.includes('target="_blank"'), true);

  assert.equal(renderMarkdown('[x](mailto:a@b.com)').includes('href="mailto:a@b.com"'), true);
  assert.equal(renderMarkdown('[x](/relative/path)').includes('href="/relative/path"'), true);
});

test('renderMarkdown：表格单元格里的注入内容同样被转义', () => {
  const out = renderMarkdown('| a | b |\n|---|---|\n| <svg onload=x> | y |');
  assert.equal(out.includes('<svg'), false);
  assert.equal(out.includes('<table>'), true, '正常表格结构仍应生成');
});

test('renderMarkdown：标题 / 粗体 / 空输入等基本形态', () => {
  assert.equal(renderMarkdown('# H').includes('<h1>H</h1>'), true);
  assert.equal(renderMarkdown('**bold**').includes('<strong>bold</strong>'), true);
  assert.equal(renderMarkdown(null), '');
  assert.equal(renderMarkdown(undefined), '');
  assert.equal(renderMarkdown(''), '');
});

// ══════════════════════════════════════════════════════════════════════════
//  三、parseStyleIndex —— 9 大类分类判据的唯一实现
// ══════════════════════════════════════════════════════════════════════════
test('parseStyleIndex：解析分类标题与表格里的 slug 链接', () => {
  const r = parseStyleIndex(VALID_INDEX);
  assert.equal(r.categories.length, 2);
  assert.equal(r.categories[0].key, 'Hand-drawn & Painting');  // key === en（'·' 前的整串）
  assert.equal(r.categories[0].en, 'Hand-drawn & Painting');
  assert.equal(r.categories[0].cn, '手绘与绘画');
  assert.deepEqual(r.categories[0].slugs, ['crayon-book', 'ink-wash']);
  assert.deepEqual(r.categories[1].slugs, ['pixel-rpg']);
  assert.deepEqual(r.bySlug.get('crayon-book'),
    { cat: 'Hand-drawn & Painting', en: 'Crayon Picture Book', cn: '蜡笔儿童绘本' });
  assert.equal(r.bySlug.size, 3);
});

test('parseStyleIndex：标题没有 · 时 en 与 cn 都取整串', () => {
  const r = parseStyleIndex('## Solo\n| a | b |\n|---|---|\n| N | M | [`slug-a`](x) |');
  assert.equal(r.categories[0].en, 'Solo');
  assert.equal(r.categories[0].cn, 'Solo');
});

test('parseStyleIndex：BOM 与 CRLF 被吃掉（不污染分类名）', () => {
  const r = parseStyleIndex('\uFEFF## Cat · 猫\r\n| a | b |\r\n|---|---|\r\n| N | M | [`slug-a`](x) |\r\n');
  assert.equal(r.categories[0].key, 'Cat');
  assert.equal(r.categories[0].cn, '猫');
  assert.deepEqual(r.categories[0].slugs, ['slug-a']);
});

test('parseStyleIndex：非法 / 空输入一律回 null（优雅降级，绝不抛）', () => {
  assert.equal(parseStyleIndex(''), null);
  assert.equal(parseStyleIndex(null), null);
  assert.equal(parseStyleIndex(undefined), null);
  assert.equal(parseStyleIndex(123), null);
  assert.equal(parseStyleIndex('# Title\n\nno table here'), null, '没有 ## 分类 ⇒ null');
  assert.equal(parseStyleIndex('## Cat\n| a | b |\n|---|---|\n| plain | text |'), null,
    '有分类但没有任何 slug 链接 ⇒ null（调用方降级为扁平列表）');
});

test('parseStyleIndex：非法 slug（含空格）被跳过；全是非法 ⇒ null', () => {
  assert.equal(parseStyleIndex('## Cat\n| a | b |\n|---|---|\n| N | M | [`bad slug`](x) |'), null);
  const mixed = parseStyleIndex('## Cat\n| a | b |\n|---|---|\n| N | M | [`ok-slug`](x) |\n| P | Q | [`bad slug`](y) |');
  assert.deepEqual(mixed.categories[0].slugs, ['ok-slug']);
  assert.equal(mixed.bySlug.has('bad slug'), false);
});

test('parseStyleIndex：同一分类里重复 slug 只记一次', () => {
  const r = parseStyleIndex('## Cat\n| a | b |\n|---|---|\n| N | M | [`dup`](x) |\n| P | Q | [`dup`](y) |');
  assert.deepEqual(r.categories[0].slugs, ['dup']);
});

// ══════════════════════════════════════════════════════════════════════════
//  四、readStyleIndex —— 读盘 + 降级
// ══════════════════════════════════════════════════════════════════════════
test('readStyleIndex：目录里有合法 README.md ⇒ 解析出分类', () => {
  const r = readStyleIndex(FX_INDEX);
  assert.equal(r.categories.length, 2);
  assert.equal(r.bySlug.has('pixel-rpg'), true);
});

test('readStyleIndex：README.md 不在 / 目录不存在 ⇒ 回 null（绝不抛）', () => {
  assert.equal(readStyleIndex(FX_NO_README), null);
  assert.equal(readStyleIndex(FX_MISSING), null);
});

// ══════════════════════════════════════════════════════════════════════════
//  五、resolveStylesRoot —— 风格源码根的唯一解析实现
// ══════════════════════════════════════════════════════════════════════════
test('resolveStylesRoot：不设 LEMO_STYLES_ROOT ⇒ 逐字节等于 path.join(winLib,"styles")', () => {
  const prev = process.env.LEMO_STYLES_ROOT;
  delete process.env.LEMO_STYLES_ROOT;
  try {
    const winLib = 'D:\\lemo-opuscar';
    assert.equal(resolveStylesRoot(winLib), path.join(winLib, 'styles'));
    // 空串是 falsy ⇒ 同样走默认（生产态零行为变化）
    process.env.LEMO_STYLES_ROOT = '';
    assert.equal(resolveStylesRoot(winLib), path.join(winLib, 'styles'));
  } finally {
    if (prev === undefined) delete process.env.LEMO_STYLES_ROOT;
    else process.env.LEMO_STYLES_ROOT = prev;
  }
});

test('resolveStylesRoot：设了 LEMO_STYLES_ROOT ⇒ 跟随覆盖点（path.resolve）', () => {
  const prev = process.env.LEMO_STYLES_ROOT;
  const target = 'D:/lemo-tmp/gp2-styles-fx/root-x';
  process.env.LEMO_STYLES_ROOT = target;
  try {
    assert.equal(resolveStylesRoot('D:\\lemo-opuscar'), path.resolve(target));
    assert.notEqual(resolveStylesRoot('D:\\lemo-opuscar'), path.join('D:\\lemo-opuscar', 'styles'));
  } finally {
    if (prev === undefined) delete process.env.LEMO_STYLES_ROOT;
    else process.env.LEMO_STYLES_ROOT = prev;
  }
});
