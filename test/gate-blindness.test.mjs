#!/usr/bin/env node
/**
 * test/gate-blindness.test.mjs —— 「闸门失明 / 守卫被改回去」的**回归套件**（零依赖）
 *
 * 用法：node test/gate-blindness.test.mjs
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 为什么必须有这个套件（本项目的核心痛点）
 * ══════════════════════════════════════════════════════════════════════════════
 *   本项目反复出现同一类缺陷：「闸门的循环把对象全 `continue` 掉，`fails`/`blind` 双空 ⇒
 *   打印 `✓` + exit 0，其实一个东西都没检查」。近几批至少出现 6 次以上，**每次都是人工发现**。
 *   这些守卫的**证据只写在闸门的头注释里**（那是档案，不是测试）—— 没有任何**自动化**手段
 *   防止它们被改回去。本文件把「守卫还在不在」变成**可执行的测试**。
 *
 * ★★ 最重要的纪律：断言必须匹配「**为什么失败**」，不能只看退出码。
 *   本项目反复治过一类病叫「匹配判据可被无关代码满足」—— 若只断言 `exit !== 0`，
 *   那么**任何**让闸门崩溃的原因（路径拼错、文件不存在、JSON 坏、参数写错）都会让测试"通过"，
 *   而真正的守卫被删掉了它也照样绿。**本套件自己绝不能犯这个病**，所以：
 *     · 每个正向用例都断言输出里出现**该闸门特有的失明文案片段**（逐字抄自该闸门源码）；
 *     · 每个用例都配一条**阴性对照**（最小合法夹具 ⇒ exit 0 且**不含**那句失明文案）
 *       —— 否则一个「永远 exit 1」的坏断言也能让测试全绿；
 *     · 另有两个「**故意破坏**」自证用例：把被测闸门拷到临时目录、**删掉它的守卫**，
 *       再跑同一套断言，**必须变红** —— 这证明断言真的在测那个守卫，而不是在测「闸门有没有崩」。
 *
 * ★ 技术纪律（本项目踩过的坑）：
 *   · `spawnSync` / `execFileSync` 在本机一律 EBUSY ⇒ **只能用异步 `spawn`**；
 *   · 所有临时文件放 **非 C 盘**（`D:/lemo-tmp/gb-blind/`），跑完按**确切路径**清理，不留垃圾；
 *   · **绝不改真实数据**（`lib/dub-styles.json` / `lib/style-skills/` / 真实 `_distill.json` 一律只读）；
 *   · 独立入口、不用外部测试框架（项目零依赖）。
 *
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// ── 常量 ────────────────────────────────────────────────────────────────────
const TOOLS = 'D:/lemo-tools';
const SCRIPTS = path.join(TOOLS, 'scripts');
const TMP = 'D:/lemo-tmp/gb-blind';          // ★ 非 C 盘；跑完整棵删掉
const NODE = process.execPath;               // 本测试就是被目标 node 跑的 ⇒ 自洽

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
  b: (s) => (TTY ? `\x1b[1m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

/** 干净的基础环境：**剔除**任何继承来的 `LEMO_*`（否则父进程的覆盖点会污染用例）。 */
const BASE_ENV = (() => {
  const e = { ...process.env };
  for (const k of Object.keys(e)) if (/^LEMO_/.test(k)) delete e[k];
  return e;
})();

/**
 * 异步跑一个进程，合并 stdout+stderr。
 * ★ 一律异步 `spawn` —— 本机 `spawnSync`/`execFileSync` 会 EBUSY。
 */
const run = (cmd, args, { env = {}, cwd = TOOLS, timeout = 120000 } = {}) =>
  new Promise((res) => {
    const p = spawn(cmd, args, { cwd, env: { ...BASE_ENV, ...env }, windowsHide: true });
    let o = '';
    p.stdout.on('data', (d) => { o += d; });
    p.stderr.on('data', (d) => { o += d; });
    const t = setTimeout(() => { try { p.kill(); } catch { /* ignore */ } res({ code: -999, out: `${o}\n[TIMEOUT ${timeout}ms]` }); }, timeout);
    p.on('error', (e) => { clearTimeout(t); res({ code: -1, out: `${o}\n[SPAWN ERROR] ${e.message}` }); });
    p.on('close', (code) => { clearTimeout(t); res({ code, out: o }); });
  });

/** 跑 `scripts/<name>`（真实闸门）。 */
const runGate = (name, env) => run(NODE, [path.join(SCRIPTS, name)], { env });

// ── 夹具小工具 ───────────────────────────────────────────────────────────────
const mk = (p) => fs.mkdirSync(p, { recursive: true });
const wf = (p, s) => { mk(path.dirname(p)); fs.writeFileSync(p, s, 'utf8'); };
const rj = (p, o) => wf(p, `${JSON.stringify(o, null, 2)}\n`);
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });

/** 建一个「风格技能树」：<root>/<slug>/SKILL.md + _distill.json。 */
const skillTree = (root, slug, skillMd, distill) => {
  wf(path.join(root, slug, 'SKILL.md'), skillMd);
  rj(path.join(root, slug, '_distill.json'), distill);
  return root;
};

/** 一份「真值齐全」的 `_distill.json` —— 缺任何一维都会让 check-tp-prose 报「该量纲已失明」。 */
const tpDistill = (over = {}) => ({
  generatedVideo: { bytes: 1000000, durSec: 60, width: 1920, height: 1080, frames: 1500 },
  selfCheck: { loudness: {
    truePeakDbtp: -1.2, integratedLufs: -14.2, lra: 3.2, peakDbtpTarget: -1.2, samplePeakDbfs: -1.3,
  } },
  ...over,
});

// ── 用例 ────────────────────────────────────────────────────────────────────
const cases = [];
const test = (name, fn) => cases.push({ name, fn });

/** 断言一个「正向」结果：必须 exit≠0 **且**输出里有该闸门特有的失明/告警文案。 */
const expectBlind = (res, needle, hint) => {
  assert.notEqual(res.code, 0,
    `${hint}：应 exit≠0（守卫该报），实得 ${res.code}\n${res.out.slice(0, 900)}`);
  assert.ok(res.out.includes(needle),
    `${hint}：exit≠0 但**没有**出现该闸门特有文案「${needle}」⇒ 很可能是别的原因崩的（路径/JSON/参数），不是守卫命中\n${res.out.slice(0, 900)}`);
};
/** 断言一个「阴性对照」结果：必须 exit 0 **且**不含失明文案（否则「永远 exit 1」的坏断言也能绿）。 */
const expectClean = (res, needle, hint) => {
  assert.equal(res.code, 0,
    `${hint}：最小合法夹具应 exit 0，实得 ${res.code}\n${res.out.slice(0, 900)}`);
  assert.ok(!res.out.includes(needle),
    `${hint}：exit 0 却出现了失明文案「${needle}」\n${res.out.slice(0, 900)}`);
};

// ── 1. check-tp-prose.mjs ───────────────────────────────────────────────────
test('check-tp-prose：CUR 反向守卫（HIST+CUR 同行 ⇒ 不豁免 ⇒ 陈旧读数 1）', async () => {
  const dir = path.join(TMP, 'tp');
  try {
    // 正向：真值 truePeakDbtp=-1.2；正文写「已修：…原为 −1.2 dBTP，现状 −0.5 dBTP（本片成片实测）」
    //   ⑤ 整行同时有 HIST（已修）与 CUR（现状）⇒ 不豁免 ⇒ −0.5 与实测差 0.7 ⇒ FAIL。
    const pos = skillTree(path.join(dir, 'pos'), 'gb-tp',
      '# gb-tp\n\n已修：真峰值原为 −1.2 dBTP，现状 −0.5 dBTP（本片成片实测）\n',
      tpDistill());
    const r1 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '陈旧读数 1 处', 'check-tp-prose 正向');

    // 阴性对照：去掉「现状」（只留 HIST）⇒ 同一行被历史语境豁免 ⇒ exit 0。
    const neg = skillTree(path.join(dir, 'neg'), 'gb-tp',
      '# gb-tp\n\n已修：真峰值原为 −1.2 dBTP（本片成片实测）\n',
      tpDistill());
    const r2 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '陈旧读数 1 处', 'check-tp-prose 阴性对照');
    assert.ok(!r2.out.includes('已失明'), `check-tp-prose 阴性对照：不应失明\n${r2.out.slice(0, 600)}`);
  } finally { rm(dir); }
});

// ── 2. check-skill-film-fields.mjs ──────────────────────────────────────────
test('check-skill-film-fields：CUR 反向守卫（帧数 HIST+CUR ⇒ 陈旧帧数 1）', async () => {
  const dir = path.join(TMP, 'ff');
  try {
    const gv = { generatedVideo: { frames: 100, width: 1920, height: 1080, durSec: 60 } };
    // 正向：实测 frames=100，正文「已修：成片帧数原为 100 帧，现状 999 帧。」
    //   100 与实测一致被放行；999≠100 且整行有 CUR ⇒ 不豁免 ⇒ 陈旧帧数 1。
    const pos = skillTree(path.join(dir, 'pos'), 'gb-ff',
      '# gb-ff\n\n已修：成片帧数原为 100 帧，现状 999 帧。\n', gv);
    const r1 = await runGate('check-skill-film-fields.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '陈旧帧数 1 处', 'check-skill-film-fields 正向');

    // 阴性对照：去掉「现状」且用 100 ⇒ 整行历史语境豁免 + 100 与实测一致 ⇒ exit 0。
    const neg = skillTree(path.join(dir, 'neg'), 'gb-ff',
      '# gb-ff\n\n已修：成片帧数原为 100 帧。\n', gv);
    const r2 = await runGate('check-skill-film-fields.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '陈旧帧数 1 处', 'check-skill-film-fields 阴性对照');
    assert.ok(!r2.out.includes('已失明'), `阴性对照不应失明\n${r2.out.slice(0, 600)}`);
  } finally { rm(dir); }
});

// ── 3. check-config-notes.mjs ───────────────────────────────────────────────
test('check-config-notes：失明守卫②（有风格但全无 notes ⇒ 一条都没检查过）', async () => {
  const dir = path.join(TMP, 'cfg');
  try {
    // 正向：两条配置、notes 全空 ⇒ 主循环把全部条目 continue ⇒ checkedNotes=0 ⇒ 失明。
    const pos = path.join(dir, 'empty.json');
    rj(pos, { styles: [{ slug: 'a', notes: '' }, { slug: 'b' }] });
    const r1 = await runGate('check-config-notes.mjs', { LEMO_DUB_STYLES: pos });
    expectBlind(r1, '没有一条带 notes', 'check-config-notes 正向');

    // 阴性对照：一条非空 notes ⇒ 真正检查过 ⇒ exit 0。
    const neg = path.join(dir, 'one.json');
    rj(neg, { styles: [{ slug: 'a', notes: '本条的 palette 完整，无缺项。' }] });
    const r2 = await runGate('check-config-notes.mjs', { LEMO_DUB_STYLES: neg });
    expectClean(r2, '没有一条带 notes', 'check-config-notes 阴性对照');
  } finally { rm(dir); }
});

// ── 4. check-doc-coverage.mjs ───────────────────────────────────────────────
test('check-doc-coverage：失明守卫（scripts/ 只有非闸门非工具的 foo.mjs ⇒ 一个都没检查）', async () => {
  const dir = path.join(TMP, 'doc');
  try {
    // 正向：假仓库根，scripts/ 里只有 foo.mjs（既非 check-* 也非工具类）⇒ 过滤集为 0 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    wf(path.join(pos, 'scripts', 'foo.mjs'), '// 非闸门、非工具\n');
    const r1 = await runGate('check-doc-coverage.mjs', { LEMO_TOOLS_ROOT: pos });
    expectBlind(r1, '本闸门已失明', 'check-doc-coverage 正向');

    // 阴性对照：一个已登记闸门（两份文档都按各自格式登记）+ 一个已登记测试入口 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'scripts', 'check-x.mjs'), '// 一个闸门\n');
    wf(path.join(neg, 'test', 'gb-doc.test.mjs'), '// 一个测试入口\n');
    wf(path.join(neg, 'test', 'README.md'),
      '# 测试\n\n| `scripts/check-x.mjs` | 说明 |\n| `test/gb-doc.test.mjs` | 说明 |\n');
    wf(path.join(neg, '_distill', 'AGENT-BRIEF.md'),
      '# 简报\n\nnode D:/x/scripts/check-x.mjs\n');
    const r2 = await runGate('check-doc-coverage.mjs', { LEMO_TOOLS_ROOT: neg });
    expectClean(r2, '本闸门已失明', 'check-doc-coverage 阴性对照');
  } finally { rm(dir); }
});

// ── 5. check-lexicon-coverage.mjs（无覆盖点：路径基于脚本自身位置推导 ⇒ 整棵拷贝）──
test('check-lexicon-coverage：失明守卫②（3 风格四维 tag 全空 ⇒ 没有一个声明了 tag）', async () => {
  const dir = path.join(TMP, 'lex');
  try {
    // ★ 按该闸门头注释的变异设计：把 lib/ 整目录 + 脚本拷到临时目录，保持 lib/↔scripts/ 相对位置。
    fs.cpSync(path.join(TOOLS, 'lib'), path.join(dir, 'lib'), { recursive: true });
    mk(path.join(dir, 'scripts'));
    fs.copyFileSync(path.join(SCRIPTS, 'check-lexicon-coverage.mjs'),
      path.join(dir, 'scripts', 'check-lexicon-coverage.mjs'));
    const gate = path.join(dir, 'scripts', 'check-lexicon-coverage.mjs');
    const stylesJson = path.join(dir, 'lib', 'dub-styles.json');

    // 正向：3 个风格、四维 tag 全空 ⇒ declaredTags=0 ⇒ 失明。
    rj(stylesJson, { styles: [
      { slug: 'a', tags: {} },
      { slug: 'b', tags: { theme: [] } },
      { slug: 'c', tags: { theme: [], emotion: [], scene: [], pace: [] } },
    ] });
    const r1 = await run(NODE, [gate]);
    expectBlind(r1, '没有一个声明了 tag', 'check-lexicon-coverage 正向');

    // 阴性对照：给一个风格声明一个词表里已有的 tag（theme「通用」）⇒ 漏登记 0 ⇒ exit 0。
    rj(stylesJson, { styles: [{ slug: 'a', tags: { theme: ['通用'] } }] });
    const r2 = await run(NODE, [gate]);
    expectClean(r2, '没有一个声明了 tag', 'check-lexicon-coverage 阴性对照');
    assert.ok(r2.out.includes('漏登记 0 处'), `阴性对照应报「漏登记 0 处」\n${r2.out.slice(0, 600)}`);
  } finally { rm(dir); }
});

// ── 6. check-ref-lines.mjs ──────────────────────────────────────────────────
test('check-ref-lines：失明守卫（一棵零引用的树 ⇒ 一个引用都没找到）', async () => {
  const dir = path.join(TMP, 'ref');
  const envFor = (root) => ({
    LEMO_TOOLS_ROOT: root,
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_STYLES_ROOT: path.join(root, 'opuscar', 'styles'),
    LEMO_DISTILL_ROOT: path.join(root, 'lib', 'style-skills'),
  });
  try {
    // 正向：一棵（几乎）空的树 ⇒ refCount=0 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    for (const d of ['test', '_distill', 'lib', 'scripts', 'opuscar/styles']) mk(path.join(pos, d));
    const r1 = await runGate('check-ref-lines.mjs', envFor(pos));
    expectBlind(r1, '本闸门已失明', 'check-ref-lines 正向');

    // 阴性对照：放一条能解析的引用（test/README.md 引同目录的 target.mjs:1）⇒ exit 0。
    const neg = path.join(dir, 'neg');
    for (const d of ['test', '_distill', 'lib', 'scripts', 'opuscar/styles']) mk(path.join(neg, d));
    wf(path.join(neg, 'test', 'target.mjs'), 'line1\nline2\nline3\n');
    wf(path.join(neg, 'test', 'README.md'), '# 测试\n\n见 `target.mjs:1`。\n');
    const r2 = await runGate('check-ref-lines.mjs', envFor(neg));
    expectClean(r2, '本闸门已失明', 'check-ref-lines 阴性对照');
  } finally { rm(dir); }
});

// ── 7. check-aspect-prose.mjs ───────────────────────────────────────────────
test('check-aspect-prose：失明守卫（LEMO_SKILL_ROOT 指向空目录 ⇒ 枚举到 0 个风格）', async () => {
  const dir = path.join(TMP, 'asp');
  try {
    // 正向：文档树是空目录 ⇒ 枚举到 0 个风格 ⇒ 失明（输出为「本闸门已**失明**」带 markdown 粗体）。
    const posRoot = path.join(dir, 'pos');
    mk(path.join(posRoot, 'skills'));
    mk(path.join(posRoot, 'styles'));
    const r1 = await runGate('check-aspect-prose.mjs',
      { LEMO_SKILL_ROOT: path.join(posRoot, 'skills'), LEMO_STYLES_ROOT: path.join(posRoot, 'styles') });
    expectBlind(r1, '本闸门已**失明**', 'check-aspect-prose 正向');

    // 阴性对照：一个风格，事实源里 film.js 声明 aspects:['16:9']（⇒ 未支持 9:16），
    //   文档无任何肯定/否定式画幅声称 ⇒ 无矛盾 ⇒ exit 0。
    const negRoot = path.join(dir, 'neg');
    const skills = path.join(negRoot, 'skills');
    const styles = path.join(negRoot, 'styles');
    wf(path.join(skills, 'gb-asp', 'SKILL.md'), '# gb-asp\n\n示例风格文档。\n');
    rj(path.join(skills, 'gb-asp', '_distill.json'),
      { limits: [], defects: [], assetGaps: [], resolvedDefects: [], selfCheck: { warnings: [] } });
    wf(path.join(styles, 'gb-asp', 'demo', 'film.js'),
      "export const FILM_META = { aspects: ['16:9'] };\n");
    const r2 = await runGate('check-aspect-prose.mjs',
      { LEMO_SKILL_ROOT: skills, LEMO_STYLES_ROOT: styles });
    expectClean(r2, '失明', 'check-aspect-prose 阴性对照');
  } finally { rm(dir); }
});

// ── 8. check-skill-artifacts.mjs ────────────────────────────────────────────
test('check-skill-artifacts：失明守卫②（全部 SKIP ⇒ 一个都没比对）', async () => {
  const dir = path.join(TMP, 'art');
  // ★ 阴性对照要用到真实仓里的帧图目录（`_distill/frames/<slug>/` 的落点写死在脚本 ROOT 下，
  //   覆盖点改不了它）⇒ 用一个**真实存在**的 slug，让 evidenceFrames 的存在性检查能通过。
  const REAL_SLUG = 'game-show';
  const realFrame = path.join(TOOLS, '_distill', 'frames', REAL_SLUG, '_contact.jpg');
  const realFilm = 'D:/lemo-films/game-show/game-show.mp4';
  try {
    // 正向：一个风格，generatedVideo 有但缺 `path` ⇒ 全部 SKIP ⇒ 一个都没比对 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    rj(path.join(pos, REAL_SLUG, '_distill.json'),
      { generatedVideo: { bytes: 1, durSec: 1, width: 1920, height: 1080, frames: 10 }, evidenceFrames: [] });
    const r1 = await runGate('check-skill-artifacts.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '一个都没比对', 'check-skill-artifacts 正向');

    // 阴性对照：path 指向真实成片、**不记**任何数值字段（⇒ 逐字段比对全部跳过 ⇒ PASS），
    //   evidenceFrames 用真实存在的帧图 ⇒ 无 FAIL ⇒ exit 0。
    assert.ok(fs.existsSync(realFilm), `阴性对照依赖真实成片存在：${realFilm}`);
    assert.ok(fs.existsSync(realFrame), `阴性对照依赖真实帧图存在：${realFrame}`);
    const neg = path.join(dir, 'neg');
    rj(path.join(neg, REAL_SLUG, '_distill.json'),
      { generatedVideo: { path: realFilm }, evidenceFrames: ['_contact.jpg'] });
    const r2 = await runGate('check-skill-artifacts.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '已失明', 'check-skill-artifacts 阴性对照');
    assert.ok(r2.out.includes('文档记录的成片信息与实物全部一致'),
      `阴性对照应报「全部一致」\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 9. check-mix-candidates.mjs（额外） ─────────────────────────────────────
test('check-mix-candidates：失明守卫②（全部风格无候选 ⇒ 一个候选混音都没检查过）', async () => {
  const dir = path.join(TMP, 'mix');
  // 阴性对照需要一份**非静音**的真实混音；取仓外真实文件（只读拷贝，绝不改原文件）。
  const realMix = 'D:/lemo-opuscar/styles/halftone-dossier/demo/mix.wav';
  try {
    // 正向：唯一风格目录里一个候选都没有 ⇒ 无候选数 == 风格总数 ⇒ 失明。
    const pos = path.join(dir, 'pos', 'styles');
    mk(path.join(pos, 'gb-mix'));
    const r1 = await runGate('check-mix-candidates.mjs', { LEMO_STYLES_ROOT: pos });
    expectBlind(r1, '一个候选混音都没检查过', 'check-mix-candidates 正向');

    // 阴性对照：放一份非静音的真实 mix.wav 作唯一候选 ⇒ 通过 ⇒ exit 0。
    if (!fs.existsSync(realMix)) assert.fail(`阴性对照依赖真实混音存在：${realMix}`);
    const neg = path.join(dir, 'neg', 'styles');
    mk(path.join(neg, 'gb-mix', 'demo'));
    fs.copyFileSync(realMix, path.join(neg, 'gb-mix', 'demo', 'mix.wav'));
    const r2 = await runGate('check-mix-candidates.mjs', { LEMO_STYLES_ROOT: neg });
    expectClean(r2, '本闸门已失明', 'check-mix-candidates 阴性对照');
  } finally { rm(dir); }
});

// ── ★★ 「故意破坏」自证：删掉守卫 ⇒ 同一套断言必须变红 ────────────────────────
//   证明这些断言真的在测「那个守卫」，而不是在测「闸门有没有崩」。
//   做法：把闸门源码拷到临时目录，做一处**精确字符串替换**删掉守卫，再跑同一套正向断言。

/** 读源码 → 断言待替换片段确实存在 → 替换 → 写副本。返回副本路径。 */
const mutate = (gateName, outDir, from, to) => {
  const src = fs.readFileSync(path.join(SCRIPTS, gateName), 'utf8');
  assert.ok(src.includes(from),
    `破坏用例自身失效：${gateName} 里找不到待删的守卫片段（源码已变？）\n---\n${from}\n---`);
  const mutated = src.replace(from, to);
  assert.notEqual(mutated, src, `破坏用例自身失效：${gateName} 的替换没有生效`);
  const out = path.join(outDir, gateName);
  wf(out, mutated);
  return out;
};

test('★自证 check-config-notes：删掉「全无 notes」守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-cfg');
  try {
    const gate = mutate('check-config-notes.mjs', dir,
      'if (cfg.styles.length > 0 && checkedNotes === 0) {', 'if (false) {');
    const cfg = path.join(dir, 'empty.json');
    rj(cfg, { styles: [{ slug: 'a', notes: '' }, { slug: 'b' }] });
    const res = await run(NODE, [gate], { env: { LEMO_DUB_STYLES: cfg } });
    // 守卫被删后：exit 0、无「没有一条带 notes」⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '没有一条带 notes', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-tp-prose：删掉 CUR 反向守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-tp');
  try {
    // 把「HIST 且非 CUR 才豁免」退化成「只要 HIST 就豁免」（即删掉 CUR 反向守卫）。
    const gate = mutate('check-tp-prose.mjs', dir,
      'if (HIST.test(line) && !CUR.test(line)) continue;', 'if (HIST.test(line)) continue;');
    const pos = skillTree(path.join(dir, 'styles'), 'gb-tp',
      '# gb-tp\n\n已修：真峰值原为 −1.2 dBTP，现状 −0.5 dBTP（本片成片实测）\n', tpDistill());
    const res = await run(NODE, [gate], { env: { LEMO_DISTILL_ROOT: pos } });
    // 守卫被删后：整行被历史语境豁免 ⇒ exit 0、无「陈旧读数 1 处」⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '陈旧读数 1 处', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

// ── 跑 ──────────────────────────────────────────────────────────────────────
async function main() {
  rm(TMP);
  mk(TMP);
  log(C.b(`\ntest/gate-blindness.test.mjs —— 闸门失明回归套件（${cases.length} 条）\n`));
  const t0 = Date.now();
  const results = [];
  try {
    for (const c of cases) {
      const s = Date.now();
      try {
        await c.fn();
        results.push({ name: c.name, ok: true });
        log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
      } catch (e) {
        results.push({ name: c.name, ok: false });
        log(`  ${C.bad('FAIL')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
        for (const line of String((e && e.message) || e).split('\n')) log(`        ${line}`);
      }
    }
  } finally {
    rm(TMP);   // ★ 按确切路径清理整棵临时树，不留垃圾
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  log('');
  log('─'.repeat(64));
  if (failed.length) {
    log(C.bad(`  ${passed} passed, ${failed.length} failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
    for (const f of failed) log(C.bad(`  ✗ ${f.name}`));
  } else {
    log(C.ok(`  ${passed} passed, 0 failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
  }
  log('─'.repeat(64));
  log('');
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  try { rm(TMP); } catch { /* ignore */ }
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
