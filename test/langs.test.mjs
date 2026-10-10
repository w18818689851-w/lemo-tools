#!/usr/bin/env node
// test/langs.test.mjs —— `lib/langs.mjs`（「语言版本」注册表的只读代理）的纯逻辑测试
//
// ★ 为什么必须有这一份：
//   `lib/langs.mjs` 的 5 个导出（langCodes / isLangCode / langLabel / langInfo / langsForDemoDir）
//   在 `test/` 里**零直接引用**（审计实测），且它**既无专门测试、也无专门闸门**。
//   它坏掉的形式是**静默**的：语言清单漂了 / 扫目录判据漂了，前端只是少列或多列一个「中文版」，
//   没人会去数。⇒ 用本文件把它的**纯函数与确定性行为**钉住。
//
// ★ 隔离（绝不碰真实库仓 `D:/lemo-opuscar`）：
//   本模块的注册表来源 = `path.join(CFG.winLib, 'core','lang','lang.mjs')`，而
//   `CFG.winLib` 认覆盖点 `LEMO_LIB_WIN`（本项目惯例，见 `lib/env.mjs`）。
//   ⇒ 本文件在**导入之前**把 `LEMO_LIB_WIN` 指到 `D:/lemo-tmp/` 下的**夹具库树**
//     （含一个合成 `core/lang/lang.mjs`），于是跑的是本模块**真实的**代理 / 扫目录代码，
//     只把「注册表文件」换掉。**绝不读真实库仓**。
//
// ★ 只测纯函数与确定性行为：不起服务、不跑渲染 / WSL、不写任何真实目录。
//
// 用法：node test/langs.test.mjs
// 退出码：全绿 0，有失败 1。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ── 夹具库树（`D:/lemo-tmp/` 临时树，绝不碰真实库仓）──────────────────────
const FX_ROOT = 'D:/lemo-tmp/gp2-langs-fx';          // 充当 LEMO_LIB_WIN
const FX_DEMO = path.join(FX_ROOT, 'demo-a');        // 三语齐全
const FX_DEMO_EN_ONLY = path.join(FX_ROOT, 'demo-en-only');  // 只有默认内容文件
const FX_DEMO_MISSING = path.join(FX_ROOT, 'demo-missing');  // 目录不存在

function buildFixture() {
  fs.rmSync(FX_ROOT, { recursive: true, force: true });
  fs.mkdirSync(path.join(FX_ROOT, 'core', 'lang'), { recursive: true });
  fs.mkdirSync(FX_DEMO, { recursive: true });
  fs.mkdirSync(FX_DEMO_EN_ONLY, { recursive: true });
  fs.writeFileSync(path.join(FX_ROOT, 'core', 'lang', 'lang.mjs'), [
    '// 夹具语言注册表（供 lib/langs.mjs 动态 import；合成，不来自真实库仓）',
    'export const LANGS = {',
    "  en: { id: 'en', name: 'English' },",
    "  zh: { id: 'zh', name: '中文', labelPrefix: '图', tts: { lang: 'zh', voice: 'zh_kepu9', speed: 1.1 } },",
    "  ja: { id: 'ja', name: '日本語', labelPrefix: '図' },",
    '};',
    '',
  ].join('\n'));
  // demo-a：content.json（en 默认）+ content.zh.json + content.ja.json
  fs.writeFileSync(path.join(FX_DEMO, 'content.json'), '{}');
  fs.writeFileSync(path.join(FX_DEMO, 'content.zh.json'), '{}');
  fs.writeFileSync(path.join(FX_DEMO, 'content.ja.json'), '{}');
  // demo-en-only：只有默认内容文件（没有 zh / ja 版本）
  fs.writeFileSync(path.join(FX_DEMO_EN_ONLY, 'content.json'), '{}');
}

buildFixture();
// ★ 必须在 import 之前设好：`CFG.winLib` 在 `lib/env.mjs` 的**模块求值期**读这个变量。
process.env.LEMO_LIB_WIN = FX_ROOT;
const langs = await import('../lib/langs.mjs');

after(() => {
  try { fs.rmSync(FX_ROOT, { recursive: true, force: true }); } catch { /* 清不掉也不影响结论 */ }
});

// ── 0. 夹具真的被读到了（否则后面全是「降级态」的假绿）────────────────────
test('夹具注册表被真正加载（registryError 必须为 null，而不是静默降级）', () => {
  assert.equal(langs.langsRegistryError, null, `夹具没被读到：${langs.langsRegistryError}`);
  assert.match(String(langs.langSource), /lang\.mjs$/, 'langSource 应指向夹具里的 lang.mjs');
  assert.equal(langs.DEFAULT_LANG, 'en');
});

// ── 1. langCodes / isLangCode ────────────────────────────────────────────
test('langCodes 原样返回注册表键（顺序 = 注册表插入顺序）', () => {
  assert.deepEqual(langs.langCodes(), ['en', 'zh', 'ja']);
});

test('isLangCode 只认注册表里的键，拒绝别名 / 大小写 / 非字符串', () => {
  assert.equal(langs.isLangCode('en'), true);
  assert.equal(langs.isLangCode('zh'), true);
  assert.equal(langs.isLangCode('ja'), true);
  // 别名归一化是库侧 langOf 的职责，本模块**不**接受 'zh-CN'
  assert.equal(langs.isLangCode('zh-CN'), false);
  assert.equal(langs.isLangCode('ZH'), false);
  assert.equal(langs.isLangCode(''), false);
  assert.equal(langs.isLangCode(null), false);
  assert.equal(langs.isLangCode(undefined), false);
  assert.equal(langs.isLangCode(123), false);
  assert.equal(langs.isLangCode({}), false);
});

// ── 2. langLabel（显示名：中文优先用 CN_LABEL，否则回落注册表 name）──────
test('langLabel：CN_LABEL 覆盖 en/zh，其余回落注册表 name，未知码原样回显', () => {
  assert.equal(langs.langLabel('en'), '英文版');
  assert.equal(langs.langLabel('zh'), '中文版');
  assert.equal(langs.langLabel('ja'), '日本語');   // 不在 CN_LABEL ⇒ 用 L.name
  assert.equal(langs.langLabel('xx'), 'xx');       // 未知码 ⇒ 原样
  assert.equal(langs.langLabel(null), '');
  assert.equal(langs.langLabel(undefined), '');
  assert.equal(langs.langLabel(''), '');
});

// ── 3. langInfo（给 UI 看的摘要；未知码 ⇒ null）──────────────────────────
test('langInfo：已知码回一条完整摘要（含 labelPrefix / tts 透传），未知码回 null', () => {
  assert.deepEqual(langs.langInfo('zh'), {
    code: 'zh', label: '中文版', name: '中文', labelPrefix: '图',
    tts: { lang: 'zh', voice: 'zh_kepu9', speed: 1.1 },
  });
  assert.deepEqual(langs.langInfo('en'), {
    code: 'en', label: '英文版', name: 'English', labelPrefix: '', tts: null,
  });
  assert.deepEqual(langs.langInfo('ja'), {
    code: 'ja', label: '日本語', name: '日本語', labelPrefix: '図', tts: null,
  });
  assert.equal(langs.langInfo('xx'), null);
  assert.equal(langs.langInfo(null), null);
  assert.equal(langs.langInfo(''), null);
});

// ── 4. langsForDemoDir：三语齐全 ─────────────────────────────────────────
test('langsForDemoDir：三语齐全 ⇒ 全可用，default 选 PREFERRED（zh）', () => {
  const r = langs.langsForDemoDir(FX_DEMO);
  assert.deepEqual(r.contentFiles, ['content.ja.json', 'content.json', 'content.zh.json']);
  assert.deepEqual(r.codes, ['en', 'zh', 'ja']);
  assert.equal(r.default, 'zh', '有 zh 版本时默认应选中文版');
  assert.deepEqual(r.unavailable, [], '三语齐全时不该有不可用项');

  const en = r.langs.find((l) => l.code === 'en');
  const zh = r.langs.find((l) => l.code === 'zh');
  const ja = r.langs.find((l) => l.code === 'ja');
  assert.deepEqual(en.files, ['content.json'], 'en = 不带语言后缀的内容文件');
  assert.deepEqual(zh.files, ['content.zh.json']);
  assert.deepEqual(ja.files, ['content.ja.json']);
  assert.equal(zh.tts.voice, 'zh_kepu9', 'zh 的 tts 应透传出来');
});

// ── 5. langsForDemoDir：只有默认内容文件 ─────────────────────────────────
test('langsForDemoDir：只有默认内容文件 ⇒ 其余进 unavailable，default 回落 en', () => {
  const r = langs.langsForDemoDir(FX_DEMO_EN_ONLY);
  assert.deepEqual(r.contentFiles, ['content.json']);
  assert.deepEqual(r.codes, ['en'], '只有 en 可用');
  assert.equal(r.default, 'en', '没有 zh 时应回落 DEFAULT_LANG');
  const un = r.unavailable.map((l) => l.code);
  assert.deepEqual(un, ['zh', 'ja']);
  for (const l of r.unavailable) {
    assert.equal(l.available, false);
    assert.deepEqual(l.files, []);
  }
});

// ── 6. langsForDemoDir：目录不存在（真实降级，绝不抛）────────────────────
test('langsForDemoDir：目录不存在 ⇒ 不抛，contentFiles 为空、只剩 en', () => {
  const r = langs.langsForDemoDir(FX_DEMO_MISSING);
  assert.deepEqual(r.contentFiles, []);
  assert.deepEqual(r.codes, ['en']);
  assert.equal(r.default, 'en');
  assert.deepEqual(r.unavailable.map((l) => l.code), ['zh', 'ja']);
});

// ── 7. langsForDemoDir：非内容文件被忽略（正则边界）─────────────────────
test('langsForDemoDir：只认 content*.json，别的 .json 一律不算内容文件', () => {
  fs.writeFileSync(path.join(FX_DEMO, 'events.json'), '{}');
  fs.writeFileSync(path.join(FX_DEMO, 'notes.txt'), 'x');
  try {
    const r = langs.langsForDemoDir(FX_DEMO);
    assert.deepEqual(r.contentFiles, ['content.ja.json', 'content.json', 'content.zh.json']);
    const en = r.langs.find((l) => l.code === 'en');
    assert.deepEqual(en.files, ['content.json'], 'events.json 不该被算成 en 的内容文件');
  } finally {
    fs.rmSync(path.join(FX_DEMO, 'events.json'), { force: true });
    fs.rmSync(path.join(FX_DEMO, 'notes.txt'), { force: true });
  }
});

// ── 8. langsForDemoDir：返回结构自洽 ────────────────────────────────────
test('langsForDemoDir：codes === langs 的 code 序列，且 langs 与 unavailable 不相交', () => {
  const r = langs.langsForDemoDir(FX_DEMO_EN_ONLY);
  assert.deepEqual(r.codes, r.langs.map((l) => l.code));
  const avail = new Set(r.codes);
  for (const u of r.unavailable) assert.equal(avail.has(u.code), false, `${u.code} 同时出现在可用与不可用里`);
  assert.equal(r.registrySource, langs.langSource);
  assert.equal(r.registryError, null);
});
