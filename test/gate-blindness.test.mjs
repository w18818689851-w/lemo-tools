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

/** 跑 `scripts/<name>` 并带命令行参数。 */
const runGateArgs = (name, args, env) =>
  run(NODE, [path.join(SCRIPTS, name), ...args], { env });

/** 拷一个闸门到 `<root>/scripts/<name>`，返回副本路径（供「落点写死在脚本位置」的闸门做非破坏变异）。 */
const copyGate = (name, root) => {
  const out = path.join(root, 'scripts', name);
  mk(path.dirname(out));
  fs.copyFileSync(path.join(SCRIPTS, name), out);
  return out;
};

/** 异步跑 git（`spawnSync` 在本机 EBUSY ⇒ 只能异步）。 */
const git = (args) => run('git', args, { cwd: TOOLS });

/** 异步跑 WSL 里的一条 bash 命令（`spawnSync`/`execFileSync` 在本机 EBUSY）。 */
const wsl = (script) => run('wsl.exe', ['-d', 'Ubuntu-24.04', '-e', 'bash', '-lc', script]);

/** 本机 ffmpeg（Windows 侧，CPU 编码 —— 不碰 GPU）。 */
const FFMPEG = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';

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

// ══════════════════════════════════════════════════════════════════════════
// 第 10–25 条（2026-10-07 扩批）：把覆盖面从 9 个闸门扩到 24 个。
//   每条都照既有纪律：**正向**（命中「该失明」的条件 ⇒ exit≠0 + 逐字抄自源码的失明文案）
//   ＋**阴性对照**（最小合法夹具 ⇒ exit 0 且不含那句文案）。
//   ★ 造不出阴性对照的闸门**一律不造**（见文件末「未覆盖清单」，宁缺勿滥）。
// ══════════════════════════════════════════════════════════════════════════

// ── 10. check-line-endings.mjs（J4 失明守卫）────────────────────────────────
test('check-line-endings：J4 失明守卫（git ls-files 枚举到 0 个已跟踪文件）', async () => {
  const dir = path.join(TMP, 'eol');
  try {
    // 正向：一个**真的 git 仓库**（有 .git）但一个文件都没 `git add`
    //   ⇒ `git ls-files --eol` 返回空 ⇒ recs.length===0 ⇒ J4 失明。
    //   ★ 用 `--repo tools` 只跑 tools 仓，避免读真实 D:/lemo-opuscar。
    const pos = path.join(dir, 'pos');
    mk(pos);
    assert.equal((await git(['init', '-q', pos])).code, 0, '夹具：git init 失败');
    const r1 = await runGateArgs('check-line-endings.mjs', ['--repo', 'tools'], { LEMO_TOOLS_ROOT: pos });
    expectBlind(r1, '枚举到 **0 个**已跟踪文件', 'check-line-endings 正向');

    // 阴性对照：同一个仓里放一个 LF 文本 + 正确的 `.gitattributes` ⇒ J1/J2/J3 全过 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    mk(neg);
    assert.equal((await git(['init', '-q', neg])).code, 0, '夹具：git init 失败');
    await git(['-C', neg, 'config', 'core.autocrlf', 'false']);
    wf(path.join(neg, '.gitattributes'), '* text=auto eol=lf\n');
    wf(path.join(neg, 'a.md'), 'line1\nline2\n');
    assert.equal((await git(['-C', neg, 'add', '-A'])).code, 0, '夹具：git add 失败');
    const r2 = await runGateArgs('check-line-endings.mjs', ['--repo', 'tools'], { LEMO_TOOLS_ROOT: neg });
    expectClean(r2, '本闸门已**失明**', 'check-line-endings 阴性对照');
    assert.ok(r2.out.includes('J1 `.gitattributes` 存在'),
      `阴性对照应真的跑过 J1\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 11. check-render-venc.mjs（★ 用户头号硬规则「渲染必须走 GPU」的守卫）────
test('check-render-venc：A 类失明守卫（解析出的编码器决策点为 0）', async () => {
  const dir = path.join(TMP, 'venc');
  // ★ 该闸门的 A 类决策点落点 = `<脚本>/../../lemo-opuscar/core/render/*` 与 `<脚本>/../dub.mjs`
  //   ⇒ 只能把闸门**拷到临时目录**、让它自己「落点写死」的两个路径都不存在。
  const VALID_MJS =
    "const VENC = process.env.LEMO_VENC || 'h264_nvenc';\n"
    + "if (VENC !== 'h264_nvenc' && VENC !== 'libx264') { process.exit(1); }\n";
  const VALID_SH =
    '#!/bin/sh\n'
    + 'case "${LEMO_VENC:-}" in\n'
    + "  '') VENC=h264_nvenc ;;\n"
    + '  libx264) VENC=libx264 ;;\n'
    + '  *) echo bad; exit 1 ;;\n'
    + 'esac\n';
  const envFor = (root) => ({
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_STYLES_ROOT: path.join(root, 'styles'),
  });
  try {
    // 正向：拷来的闸门旁没有 dub.mjs、opuscar 树里没有 core/render/* ⇒ 3 个 A 类决策点
    //   全部「文件不存在」⇒ aParsed=0 ⇒ 失明（且**只有**这一句能解释 exit≠0）。
    const pos = path.join(dir, 'pos');
    const gatePos = copyGate('check-render-venc.mjs', pos);
    mk(path.join(pos, 'opuscar'));
    mk(path.join(pos, 'styles'));
    const r1 = await run(NODE, [gatePos], { env: envFor(pos) });
    expectBlind(r1, '本闸门已**失明**：解析出的编码器决策点为 0', 'check-render-venc 正向');

    // 阴性对照：三个决策点都放**最小合法**实现（未设⇒h264_nvenc / 显式 libx264⇒CPU / 非法⇒exit）
    //   ⇒ aParsed=3、aFails=0、D 类两仓都非空且 0 命中、C 类因非规范路径自动跳过 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    const gateNeg = copyGate('check-render-venc.mjs', neg);
    wf(path.join(neg, 'dub.mjs'), VALID_MJS);
    wf(path.join(neg, 'opuscar', 'core', 'render', 'video.mjs'), VALID_MJS);
    wf(path.join(neg, 'opuscar', 'core', 'render', 'mux.sh'), VALID_SH);
    mk(path.join(neg, 'styles'));
    const r2 = await run(NODE, [gateNeg], { env: envFor(neg) });
    expectClean(r2, '本闸门已**失明**', 'check-render-venc 阴性对照');
    assert.ok(r2.out.includes('A 类·出片路径编码器决策点 3 个（成功解析 3 个）'),
      `阴性对照应真的解析出 3 个决策点\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 12. check-derivation-caliber.mjs（5 条守卫里最外层的那条）───────────────
test('check-derivation-caliber：失明守卫②（注册表 styles 不是非空数组）', async () => {
  const dir = path.join(TMP, 'dv');
  try {
    // 正向：`styles: []` ⇒ 一条 entry 都没检查过 ⇒ 失明（`process.exit(1)`）。
    const pos = path.join(dir, 'pos.json');
    rj(pos, { styles: [] });
    const r1 = await runGate('check-derivation-caliber.mjs', { LEMO_DUB_STYLES: pos });
    expectBlind(r1, '本闸门已失明', 'check-derivation-caliber 正向');

    // 阴性对照：一条 entry，其 `derivation` 与「机械重算」逐轴一致，且需说明的口径都在 SKILL.md 里
    //   ⇒ ①②③ 全过 ⇒ exit 0。
    const neg = path.join(dir, 'neg.json');
    rj(neg, {
      _notes: ['subtitle.fontFamily 一律填本机字体（Microsoft YaHei / SimHei / SimSun / KaiTi / DengXian / Consolas）'],
      styles: [{
        slug: 'gb-dv',
        palette: { bg: '#101010' },
        subtitle: { fontFamily: 'Consolas' },
        derived: false,
        notes: '',
        derivation: { bg: 'proxy', font: 'substituted', subtitle: 'exact', accent: 'absent' },
      }],
    });
    const vis = path.join(dir, 'vis.json');
    rj(vis, { styles: { 'gb-dv': {} } });
    const root = path.join(dir, 'skills');
    wf(path.join(root, 'gb-dv', 'SKILL.md'),
      '# gb-dv\n\n底色 #101010 派生自 demo，字体 Consolas。\n');
    const r2 = await runGate('check-derivation-caliber.mjs',
      { LEMO_DUB_STYLES: neg, LEMO_DUB_VISUAL: vis, LEMO_DISTILL_ROOT: root });
    expectClean(r2, '本闸门已失明', 'check-derivation-caliber 阴性对照');
    assert.ok(r2.out.includes('✓ 每条 entry'),
      `阴性对照应真的判过每条 entry\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 13. check-dna-coverage.mjs（第二节：注册表字段消费覆盖）─────────────────
test('check-dna-coverage：第二节失明守卫（styles[] 为空 ⇒ 枚举到 0 条字段路径）', async () => {
  const dir = path.join(TMP, 'dna');
  try {
    // 正向：注册表 styles[] 为空 ⇒ `dubStylesOk` false ⇒ 第二节「**本闸门已失明**」。
    const pos = path.join(dir, 'pos.json');
    rj(pos, { styles: [] });
    const r1 = await runGate('check-dna-coverage.mjs', { LEMO_DUB_STYLES: pos });
    expectBlind(r1, '**本闸门已失明**', 'check-dna-coverage 正向');

    // 阴性对照：一条 entry（`_notes` 是白名单元数据、其余字段在真实运行时代码里都有消费者）
    //   + 第三节：`textureRaw` 落在可解析集合 R 里、散文里能找到「声明但未实现」条目
    //   ⇒ 一二三节 0 FAIL ⇒ exit 0。
    //   ★ 第三节的**豁免表 `TEXTURE_COVERED_BY_OTHER` 是硬编码的**（`vignette` / `paper-grain`），
    //     且判据 (A5)「豁免腐烂」要求**注册表里必须有风格声明这两个值**，否则 FAIL。
    //     ⇒ 最小合法夹具**必须**把这两个值也声明进去（这是闸门真实的口径，不是夹具将就）；
    //     `none` 落在 R 里、另两个落在豁免表里，三条都放行。
    const neg = path.join(dir, 'neg.json');
    rj(neg, {
      _notes: ['★ textureRaw **声明但未实现**：（当前无）'],
      styles: [
        { slug: 'gb-dc-a', palette: { bg: '#101010' }, bgRecipe: { textureRaw: 'none' } },
        { slug: 'gb-dc-b', palette: { bg: '#101010' }, bgRecipe: { textureRaw: 'vignette' } },
        { slug: 'gb-dc-c', palette: { bg: '#101010' }, bgRecipe: { textureRaw: 'paper-grain' } },
      ],
    });
    const r2 = await runGate('check-dna-coverage.mjs', { LEMO_DUB_STYLES: neg });
    expectClean(r2, '**本闸门已失明**', 'check-dna-coverage 阴性对照');
    assert.ok(r2.out.includes('✓ 第二节：注册表每条字段路径'),
      `阴性对照应真的跑过第二节判据\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 14. check-config-vs-doc.mjs（底色 vs 文档 §3）────────────────────────────
test('check-config-vs-doc：失明守卫（0 个风格 / 全部风格都进 noSec）', async () => {
  const dir = path.join(TMP, 'cvd');
  try {
    // 正向：`styles: []` ⇒ 0 个风格 ⇒ 失明（并**抑制**那句「✓ 所有风格…」）。
    const pos = path.join(dir, 'pos.json');
    rj(pos, { styles: [] });
    const r1 = await runGate('check-config-vs-doc.mjs', { LEMO_DUB_STYLES: pos });
    expectBlind(r1, '本闸门已失明', 'check-config-vs-doc 正向');

    // 阴性对照：一个风格，其 `palette.bg` 在 §3 表格里**以背景角色**（角色列不含灯/光/强调类词）出现
    //   ⇒ 放行 ⇒ exit 0。
    const neg = path.join(dir, 'neg.json');
    rj(neg, { styles: [{ slug: 'gb-cvd', palette: { bg: '#101010' } }] });
    const root = path.join(dir, 'skills');
    wf(path.join(root, 'gb-cvd', 'SKILL.md'),
      '# gb-cvd\n\n## 3. 配色体系\n\n| 角色 | 色值 | 用途 |\n|---|---|---|\n| 底色 | `#101010` | 主背景 |\n');
    const r2 = await runGate('check-config-vs-doc.mjs',
      { LEMO_DUB_STYLES: neg, LEMO_DISTILL_ROOT: root });
    expectClean(r2, '本闸门已失明', 'check-config-vs-doc 阴性对照');
    assert.ok(r2.out.includes('✓ 所有风格的底色都能'),
      `阴性对照应真的比过这个风格\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 15. check-skill-scores.mjs（评分自洽性）─────────────────────────────────
test('check-skill-scores：失明守卫（一个带 _distill.json 的风格都枚举不到）', async () => {
  const dir = path.join(TMP, 'sco');
  try {
    // 正向：技能树是空目录 ⇒ slugs.length===0 ⇒ ①②③ 一条都没执行 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-skill-scores.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '本闸门已失明', 'check-skill-scores 正向');

    // 阴性对照：一份 `_distill.json`（matchScore == 五项之和）+ 自评行与之一致的 SKILL.md
    //   ⇒ ①②③ 全过 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    rj(path.join(neg, 'gb-ss', '_distill.json'), {
      matchScore: 90,
      scoreBreakdown: { palette: 20, composition: 20, typography: 20, rhythm: 15, audio: 15 },
      defects: [],
    });
    wf(path.join(neg, 'gb-ss', 'SKILL.md'), '# gb-ss\n\n## 风格匹配度自评 **90/100**\n');
    const cfg = path.join(dir, 'cfg.json');
    rj(cfg, { styles: [{ slug: 'gb-ss' }] });
    const r2 = await runGate('check-skill-scores.mjs', { LEMO_DISTILL_ROOT: neg, LEMO_DUB_STYLES: cfg });
    expectClean(r2, '本闸门已失明', 'check-skill-scores 阴性对照');
    assert.ok(r2.out.includes('[1] matchScore == scoreBreakdown 五项之和：1/1'),
      `阴性对照应真的判过这一份\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 16. check-api-docs.mjs（HTTP 路由 ↔ README）─────────────────────────────
test('check-api-docs：失明守卫（server 侧解析出 0 条 /api 路由）', async () => {
  const dir = path.join(TMP, 'api');
  const README_OK =
    '# 文档\n\n## HTTP 接口清单\n\n| 方法 | 路径 | 用途 | 类型 |\n|---|---|---|---|\n'
    + '| GET | `/api/x` | 用途 | 同步 |\n';
  try {
    // 正向：server.mjs 里一条 /api 路由都没有（README 侧正常）⇒ serverSet 为空 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    const gatePos = copyGate('check-api-docs.mjs', pos);
    wf(path.join(pos, 'server.mjs'), '// 没有任何 /api 路由\n');
    wf(path.join(pos, 'README.md'), README_OK);
    const r1 = await run(NODE, [gatePos]);
    expectBlind(r1, '本闸门已**失明**', 'check-api-docs 正向');

    // 阴性对照：两侧各一条同形状路由 ⇒ 双向无差异 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    const gateNeg = copyGate('check-api-docs.mjs', neg);
    wf(path.join(neg, 'server.mjs'),
      "http.createServer((req, res) => {\n  const p = req.url;\n  const m = req.method;\n"
      + "  if (p === '/api/x' && m === 'GET') return;\n"
      + "  if (p.startsWith('/api/')) { res.statusCode = 404; return; }\n});\n");
    wf(path.join(neg, 'README.md'), README_OK);
    const r2 = await run(NODE, [gateNeg]);
    expectClean(r2, '本闸门已**失明**', 'check-api-docs 阴性对照');
    assert.ok(r2.out.includes('✓ 两边完全对应'),
      `阴性对照应真的双向比过\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 17. check-esm-import-paths.mjs（动态 import 传运行时绝对路径）───────────
test('check-esm-import-paths：失明守卫（扫描根收集到 0 个 .mjs/.js）', async () => {
  const dir = path.join(TMP, 'esm');
  try {
    // 正向：LEMO_OPUSCAR 指向一棵没有 styles/*/demo/** 也没有 core/** 的树 ⇒ files 0 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-esm-import-paths.mjs', { LEMO_OPUSCAR: pos });
    expectBlind(r1, '本闸门已失明', 'check-esm-import-paths 正向');

    // 阴性对照：`core/` 下放一个不含动态 import 的 .mjs ⇒ 收集到 1 个、0 违规 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'core', 'x.mjs'), 'export const a = 1;\n');
    const r2 = await runGate('check-esm-import-paths.mjs', { LEMO_OPUSCAR: neg });
    expectClean(r2, '本闸门已失明', 'check-esm-import-paths 阴性对照');
    assert.ok(r2.out.includes('扫描 .mjs/.js：1 个'),
      `阴性对照应真的扫到 1 个文件\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 18. check-aspect-declaration.mjs（无 film*.js 风格的入口自适应探测）──────
test('check-aspect-declaration：失明守卫（枚举到 0 个风格）', async () => {
  const dir = path.join(TMP, 'ad');
  try {
    // 正向：风格根是空目录 ⇒ 枚举到 0 个风格 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-aspect-declaration.mjs', { LEMO_STYLES_ROOT: pos });
    expectBlind(r1, '本闸门已**失明**', 'check-aspect-declaration 正向');

    // 阴性对照：一个风格、有 `demo/film.js`（探测看得见它）⇒ 不查真实入口 ⇒ 0 处 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'gb-ad', 'demo', 'film.js'), 'export const FILM_META = { aspects: ["16:9"] };\n');
    const r2 = await runGate('check-aspect-declaration.mjs', { LEMO_STYLES_ROOT: neg });
    expectClean(r2, '本闸门已**失明**', 'check-aspect-declaration 阴性对照');
    assert.ok(r2.out.includes('有 film*.js 1 个'),
      `阴性对照应真的枚举到 1 个风格且探测可见\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 19. check-mux-selection.mjs（交付路径感知的混流脚本）────────────────────
test('check-mux-selection：失明守卫（styles 下扫到 0 个风格目录）', async () => {
  const dir = path.join(TMP, 'mux');
  try {
    // 正向：`styles/` 存在但是空目录 ⇒ 一个混流脚本都没检查过 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(path.join(pos, 'styles'));
    const r1 = await runGate('check-mux-selection.mjs', { LEMO_OPUSCAR: pos });
    expectBlind(r1, '本闸门已失明', 'check-mux-selection 正向');

    // 阴性对照：一个风格、自带 `demo/tools/mux.sh` 且含 `A="$2"`（会被编排器挑中）
    //   且四项口径齐（LN_TP 可覆盖 / 真峰值复核 / exit 0 / 无「续行被注释吃掉」）⇒ exit 0。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'styles', 'gb-mux', 'demo', 'tools', 'mux.sh'),
      '#!/bin/sh\n'
      + 'A="$2"\n'
      + 'LN_TP="${LEMO_LN_TP:--1.7}"\n'
      + 'TP=$(ffmpeg -i "$A" -f null - 2>&1 | grep -o "input_tp[^,]*")\n'
      + 'if [ "$(echo "$TP <= -1.2" | bc)" = "1" ]; then echo ok; fi\n'
      + 'exit 0\n');
    const r2 = await runGate('check-mux-selection.mjs', { LEMO_OPUSCAR: neg });
    expectClean(r2, '本闸门已失明', 'check-mux-selection 阴性对照');
    assert.ok(r2.out.includes('走自带 mux 的 1 个'),
      `阴性对照应真的挑中这个自带脚本\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 20. check-venc-args.mjs（编码器参数组合的真编码闸门）────────────────────
test('check-venc-args：失明守卫（抽到的编码器参数组合为 0）', async () => {
  const dir = path.join(TMP, 'varg');
  try {
    // 正向：仓库树里没有任何 `case "${LEMO_VENC:-}" in` / vencArgs 写法 ⇒ 组合数 0 ⇒ 失明
    //   （★ `runAll()` 在 list 为空时**直接返回**，不会去调 WSL —— 这条用例零外部依赖）。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-venc-args.mjs', { LEMO_OPUSCAR: pos });
    expectBlind(r1, '本闸门已**失明**', 'check-venc-args 正向');

    // 阴性对照：一个 `core/render/*.sh`，`case` 块里**只有一条** libx264 分支
    //   ⇒ 组合数 1（纯 CPU 编码，**不碰 GPU**）⇒ 真在 WSL 里编 1 帧、ffmpeg 接受 ⇒ exit 0。
    //   ★ 只留 libx264 分支是刻意的：nvenc 分支会占用用户正在跑渲染的那块 GPU。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'core', 'render', 'gb.sh'),
      '#!/bin/sh\n'
      + 'case "${LEMO_VENC:-}" in\n'
      + '  libx264) VARG="-c:v libx264 -preset medium -crf 19" ;;\n'
      + 'esac\n'
      + 'ffmpeg -i in.mp4 $VARG out.mp4\n');
    const r2 = await runGate('check-venc-args.mjs', { LEMO_OPUSCAR: neg });
    expectClean(r2, '本闸门已**失明**', 'check-venc-args 阴性对照');
    assert.ok(r2.out.includes('组合 1 个、ffmpeg 拒绝 0 个'),
      `阴性对照应真的抽出 1 个组合并实测通过\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 21. check-film-aspect.mjs（C 类：实际成片文件的画幅）────────────────────
test('check-film-aspect：C 类失明守卫（实际成片扫到 0 部）', async () => {
  const dir = path.join(TMP, 'fa');
  const mkTree = (root, filmsRoot) => {
    rj(path.join(root, 'distill', 'gb-fa', '_distill.json'),
      { generatedVideo: { width: 1920, height: 1080 } });
    mk(path.join(root, 'styles', 'gb-fa'));
    mk(filmsRoot);
    return {
      LEMO_DISTILL_ROOT: path.join(root, 'distill'),
      LEMO_STYLES_ROOT: path.join(root, 'styles'),
      LEMO_FILMS_ROOT: filmsRoot,
    };
  };
  try {
    // 正向：成片文件根**存在但是空的** ⇒ filmsFound 0 ⇒ C 类失明（A/B 两类的夹具本身是合法的）。
    const pos = path.join(dir, 'pos');
    const r1 = await runGate('check-film-aspect.mjs', mkTree(pos, path.join(pos, 'films')));
    expectBlind(r1, '实际成片扫到 0 部', 'check-film-aspect 正向');

    // 阴性对照：放一部**真的 1920×1080** 的极小 mp4（ffmpeg 现造，纯 CPU，几 KB）
    //   ⇒ filmsFound 1、A/B/C 三类全过 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    const envNeg = mkTree(neg, path.join(neg, 'films'));
    const mp4 = path.join(envNeg.LEMO_FILMS_ROOT, 'gb-fa', 'gb-fa.mp4');
    mk(path.dirname(mp4));
    assert.ok(fs.existsSync(FFMPEG), `阴性对照依赖本机 ffmpeg 存在：${FFMPEG}`);
    const gen = await run(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi',
      '-i', 'color=c=black:s=1920x1080:d=0.2:r=25', '-frames:v', '1',
      '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '45', mp4]);
    assert.equal(gen.code, 0, `夹具：ffmpeg 生成 1920x1080 测试片失败\n${gen.out.slice(0, 400)}`);
    assert.ok(fs.existsSync(mp4), `夹具：测试片没生成：${mp4}`);
    const r2 = await runGate('check-film-aspect.mjs', envNeg);
    expectClean(r2, '本闸门已**失明**', 'check-film-aspect 阴性对照');
    assert.ok(r2.out.includes('全部成片画幅一致'),
      `阴性对照应真的判过这部成片\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 22. check-dual-copy-sync.mjs（WIN ↔ WSL 两份副本）───────────────────────
test('check-dual-copy-sync：WIN 侧失明守卫（副本扫到 0 个文本文件）', async () => {
  const dir = path.join(TMP, 'dual');
  const WSL_TMP = '/tmp/gb-blind-neg';
  try {
    // 正向：WIN 副本根存在但是空的 ⇒ winMap.size 0 ⇒ 失明。
    //   ★ 加 `--no-wsl`：本闸门的 WSL 侧失明守卫另有其人（这里只钉 WIN 侧那条），且能省一次 wsl 启动。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGateArgs('check-dual-copy-sync.mjs', ['--no-wsl'], { LEMO_OPUSCAR: pos });
    expectBlind(r1, '本闸门已**失明**', 'check-dual-copy-sync 正向');

    // 阴性对照：WIN 侧与 WSL 侧各放**同一份内容**的文本文件 ⇒ 源文件 0 漂移 ⇒ exit 0。
    //   ★ 这里必须真跑 WSL 侧（`--no-wsl` 下任何 WIN 侧文件都会被算成「WSL 侧缺失」= 源文件漂移）。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'a.md'), 'hello\n');
    const setup = await wsl(`mkdir -p ${WSL_TMP} && printf 'hello\\n' > ${WSL_TMP}/a.md`);
    assert.equal(setup.code, 0, `夹具：WSL 侧建树失败\n${setup.out.slice(0, 400)}`);
    const r2 = await runGate('check-dual-copy-sync.mjs',
      { LEMO_OPUSCAR: neg, LEMO_WSL_ROOT: WSL_TMP });
    expectClean(r2, '本闸门已**失明**', 'check-dual-copy-sync 阴性对照');
    assert.ok(r2.out.includes('✓ 源文件两侧逐字节一致'),
      `阴性对照应真的比过两侧\n${r2.out.slice(0, 900)}`);
  } finally {
    rm(dir);
    await wsl(`rm -rf ${WSL_TMP}`);
  }
});

// ── 23. check-dub-styles.mjs（纹理硬红线 + 字幕底衬）────────────────────────
test('check-dub-styles：失明守卫（styles-root 未找到 / 全部 STYLE.md 读不到）', async () => {
  const dir = path.join(TMP, 'dubs');
  try {
    // ★ 该闸门的注册表路径**写死**在脚本 ROOT 下（无覆盖点）⇒ 夹具必须去满足**真实注册表**的每个 slug。
    //   正向：styles-root 指向一个空目录 ⇒ 全部风格 SKIP ⇒ skipped === styles.length ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-dub-styles.mjs', { LEMO_STYLES_ROOT: pos });
    expectBlind(r1, '失明：styles-root', 'check-dub-styles 正向');

    // 阴性对照：按真实注册表逐风格造一份**刚好不触红线**的 STYLE.md ——
    //   `texture ∈ {scanlines}` ⇒ 正文正面提「scanlines」；`texture = grain` ⇒ 正面提「grain」；
    //   其余纹理 ⇒ 两个词都不提（否则会踩「硬红线 5：有声明但配置没开」）。
    const reg = JSON.parse(fs.readFileSync(path.join(TOOLS, 'lib', 'dub-styles.json'), 'utf8'));
    assert.ok(Array.isArray(reg.styles) && reg.styles.length > 0, '夹具：真实注册表应有 styles[]');
    const neg = path.join(dir, 'neg');
    for (const st of reg.styles) {
      const tex = String((st.bgRecipe || {}).texture || 'none');
      const md = (tex === 'scanlines' || tex === 'scanline') ? '# placeholder\n\n扫描线 scanlines 是定义层。\n'
        : (tex === 'grain') ? '# placeholder\n\n颗粒 grain 是定义层。\n'
          : '# placeholder\n\n纯色底，无额外纹理层。\n';
      wf(path.join(neg, st.slug, 'STYLE.md'), md);
    }
    const r2 = await runGate('check-dub-styles.mjs', { LEMO_STYLES_ROOT: neg });
    expectClean(r2, '失明：styles-root', 'check-dub-styles 阴性对照');
    assert.ok(r2.out.includes('✓ 未发现纹理硬红线不一致'),
      `阴性对照应真的判过全部风格\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 24. check-audio-chain.mjs（音频链可跑性）────────────────────────────────
test('check-audio-chain：失明守卫（候选清单从编排器里一条都解析不出来）', async () => {
  const dir = path.join(TMP, 'ac');
  try {
    // 正向：LEMO_MAKE 指向一个**存在但没有任何候选标记**的文件 ⇒ 7 类候选清单全部解析为空 ⇒ 失明。
    //   （比「文件不存在」强：它证明的是**解析**这条守卫，不是「路径打错了」。）
    const pos = path.join(dir, 'pos');
    wf(path.join(pos, 'make.mjs'), '// 没有任何候选清单标记\n');
    mk(path.join(pos, 'styles'));
    const r1 = await runGate('check-audio-chain.mjs',
      { LEMO_MAKE: path.join(pos, 'make.mjs'), LEMO_STYLES_ROOT: path.join(pos, 'styles') });
    expectBlind(r1, '候选清单解析为空：混音脚本', 'check-audio-chain 正向');

    // 阴性对照：造一份**最小但形状正确**的编排器文本（7 类标记各配一条 `for c in "$D/…"`）
    //   + 一个自带 `mix.py` 的风格（⇒ C 类，混音步跑得起来）⇒ 0 FAIL ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'make.mjs'),
      'for c in "$D/voice_fx.py" "$D/voice.py"; do :; done\n'
      + '{ VOICEFX=1; }\n'
      + 'for c in "$D/tts/gen.py"; do :; done\n'
      + '{ TTSOWN=1; }\n'
      + 'for c in "$D/music.py" "$D/sound.py"; do :; done\n'
      + '{ MUSIC=1; }\n'
      + 'for c in "$D/mix.py" "$D/sound.py" "$D/audio/mix.py"; do :; done\n'
      + '{ MIX=1; }\n'
      + 'for c in "$D/foley.py"; do :; done\n'
      + '{ FOLEY=1; }\n'
      + 'for c in "$D/mix.wav"; do :; done\n'
      + 'if [ -f "$D/lines.json" ]; then :; fi\n');
    wf(path.join(neg, 'styles', 'gb-ac', 'demo', 'mix.py'), '# mix\n');
    const r2 = await runGate('check-audio-chain.mjs',
      { LEMO_MAKE: path.join(neg, 'make.mjs'), LEMO_STYLES_ROOT: path.join(neg, 'styles') });
    expectClean(r2, '候选清单解析为空', 'check-audio-chain 阴性对照');
    assert.ok(r2.out.includes('有混音脚本 1'),
      `阴性对照应真的把它判成 C 类\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 25. check-ref-lines.mjs 的**第二条**失明守卫 ────────────────────────────
//   （第一条「一个引用都没找到」已被既有用例 6 覆盖；这条管的是**引用全解析不到文件**。）
test('check-ref-lines：失明守卫②（找到引用但一处都解析不到文件）', async () => {
  const dir = path.join(TMP, 'ref2');
  const envFor = (root) => ({
    LEMO_TOOLS_ROOT: root,
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_STYLES_ROOT: path.join(root, 'opuscar', 'styles'),
    LEMO_DISTILL_ROOT: path.join(root, 'distill'),
  });
  try {
    // 正向：文档里**有**一条引用，但那个文件在任何一个解析根下都不存在
    //   ⇒ refCount>0 且 resolvedCount===0 ⇒ 失明②（第一条守卫不会命中）。
    const pos = path.join(dir, 'pos');
    for (const d of ['test', 'opuscar', 'distill']) mk(path.join(pos, d));
    wf(path.join(pos, 'test', 'README.md'), '# 测试\n\n见 `nope/does-not-exist.mjs:1`。\n');
    const r1 = await runGate('check-ref-lines.mjs', envFor(pos));
    expectBlind(r1, '一处都解析不到文件', 'check-ref-lines 正向②');

    // 阴性对照：同一条引用改成一个**真的存在**的同目录文件 ⇒ 解析成功 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    for (const d of ['test', 'opuscar', 'distill']) mk(path.join(neg, d));
    wf(path.join(neg, 'test', 'target.mjs'), 'line1\nline2\nline3\n');
    wf(path.join(neg, 'test', 'README.md'), '# 测试\n\n见 `target.mjs:1`。\n');
    const r2 = await runGate('check-ref-lines.mjs', envFor(neg));
    expectClean(r2, '一处都解析不到文件', 'check-ref-lines 阴性对照②');
    assert.ok(r2.out.includes('解析到文件 1 处'),
      `阴性对照应真的解析到那个文件\n${r2.out.slice(0, 900)}`);
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

test('★自证 check-render-venc：删掉 A 类失明守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-venc');
  try {
    // 把「aParsed === 0 ⇒ 失明」退化成「永不失明」。
    const gate = mutate('check-render-venc.mjs', dir, 'const blind = aParsed === 0;', 'const blind = false;');
    // 同一套正向夹具：3 个 A 类决策点全部「文件不存在」。
    mk(path.join(dir, 'opuscar'));
    mk(path.join(dir, 'styles'));
    const res = await run(NODE, [gate], {
      env: { LEMO_OPUSCAR: path.join(dir, 'opuscar'), LEMO_STYLES_ROOT: path.join(dir, 'styles') },
    });
    // 守卫被删后：exit 仍≠0（文件缺失 ⇒ aFails / D 类失明），但**不再打印**那句 A 类失明文案
    //   ⇒ 只断言「exit≠0」的坏用例会照样绿，本套件的第二条断言必须**抛**。
    assert.throws(() => expectBlind(res, '本闸门已**失明**：解析出的编码器决策点为 0', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-line-endings：删掉 J4 失明守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-eol');
  try {
    // 把「git ls-files 枚举到 0 个 ⇒ 失明」退化成「永不失明」。
    const gate = mutate('check-line-endings.mjs', dir, 'if (recs.length === 0) {', 'if (false) {');
    const repo = path.join(dir, 'repo');
    mk(repo);
    assert.equal((await git(['init', '-q', repo])).code, 0, '夹具：git init 失败');
    const res = await run(NODE, [gate, '--repo', 'tools'], { env: { LEMO_TOOLS_ROOT: repo } });
    assert.throws(() => expectBlind(res, '枚举到 **0 个**已跟踪文件', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-derivation-caliber：删掉失明块后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-dv');
  try {
    // 把「有失明原因就打印 + exit 1」整块短路掉（守卫被架空）。
    const gate = mutate('check-derivation-caliber.mjs', dir, 'if (blind.length) {', 'if (false) {');
    const cfg = path.join(dir, 'empty.json');
    rj(cfg, { styles: [] });
    const res = await run(NODE, [gate], { env: { LEMO_DUB_STYLES: cfg } });
    // 守卫被架空后：`styles: []` 走完空循环 ⇒ 分布为空、fails 为空 ⇒ 打印「✓」+ exit 0 ⇒ 正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '本闸门已失明', 'mut'),
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
