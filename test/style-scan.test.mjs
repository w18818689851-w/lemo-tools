#!/usr/bin/env node
/**
 * test/style-scan.test.mjs —— `scripts/style-scan.mjs` 的**源码指纹机制**测试（零依赖，纯文件 IO）
 *
 * ★ 为什么必须有这一份（2026-10-04 补）：
 *   `scripts/style-scan.mjs` 是约定一「风格必须**持续自动纳入**」的**判据本身**：
 *   `scripts/style-distill.mjs plan` 靠它算出的**内容哈希指纹**（不是时间戳）与「上次蒸馏时记下的
 *   指纹」比对，报出「新增 / 源码变更 / 未蒸馏」的风格 ⇒ 决定哪些风格要重新蒸馏出 Skill 文档。
 *   它此前**零测试覆盖**。它一旦坏掉，`plan` 会**静默误报「0 待处理」**，「自动纳入」无声失效，
 *   没人会去数 —— 正是本项目反复防的「空转绿灯」。所以这里把它的**两侧契约都钉住**：
 *     · **该变就变**（改了画面相关源码 ⇒ 指纹必须变，且能点名文件）；
 *     · **不该变就不变**（改了生成物/音频/被排除目录 ⇒ 指纹必须**纹丝不动**，否则噪声淹没信号）。
 *
 * ★ 有意排除是**契约**、不是 bug（引 `scripts/style-scan.mjs:12-27` 的头部注释）：
 *   · 纳入：CODE_EXT = .js .mjs .cjs .ts .html .htm .css（`style-scan.mjs:49`）
 *         + 根级 ROOT_EXTRAS = STYLE.md / DEMO.md / style.json（`style-scan.mjs:57`）
 *   · 排除：DENY_DIRS 整子树（`style-scan.mjs:51-55`，含 out stills fonts voices music assets audio tts …）
 *   · ★ `.py` / 数据 `.json`（events.json/lines.json/content*.json 是**生成物**）/ `.srt` / 媒体文件
 *     是**有意排除**的（`style-scan.mjs:22-27`：指纹只关心「画面长什么样」，音频与生成物纳入只会误报）。
 *     ⇒ 本测试把「有意排除」钉成契约，**不要**把它当 bug 去「修」。
 *
 * 覆盖（用例与硬约束逐条对应，见 team-lead 的任务书）：
 *   A 指纹基本性质：稳定 / 有区分度（防哈希退化成常量）
 *   B 该变就变：.js / index.html / .css / .mjs / 根级 STYLE.md·DEMO.md·style.json
 *   C 不该变就不变：生成物 json / .py / 新增 .txt·.srt / 在 DENY_DIRS 里新建 .js
 *   D collectStyleFiles 形状：相对路径 / 正斜杠 / 已排序 / 无重复 / **精确集合相等**
 *   E diffScans：added / changed（精确到文件）/ removed（字段名以代码为准）
 *   F 降级与解析：loadFingerprintFile 对缺失/损坏的**真实行为**；resolve* 优先级；导出常量
 *   G checkStyleChanges 状态机：baseline / no-baseline / no-change / changed / error
 *
 * ★ 全部在**临时合成目录**里跑，绝不碰真实的 `D:/lemo-opuscar/styles/**` 或 `lib/style-fingerprints.json`。
 *   临时目录：`<repo>/.tmp-scan-test-<pid>/`（非 C 盘），跑完按**确切路径**递归删除。
 *   ★ 目录名**按进程唯一**（带 `process.pid`）：本套件开头 `mkdirSync(TMP)`、末尾 `rmSync(TMP)`，
 *     若用写死的共享路径，两个进程同时跑就会互删对方夹具（实测并发 12/6 failed，单独 15 passed）。
 *
 * 用法：node test/style-scan.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SCANNER_VERSION, ALGORITHM, DEFAULT_STYLES_ROOT, DEFAULT_FP_FILE,
  collectStyleFiles, fingerprintStyle, scanStyles,
  loadFingerprintFile, writeFingerprintFile, diffScans,
  checkStyleChanges, resolveStylesRoot, resolveFpFile,
} from '../scripts/style-scan.mjs';

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

// ── 临时目录（非 C 盘；跑完按确切路径删除）────────────────────
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url)); // <repo>/test
const REPO = path.dirname(TEST_DIR);                            // <repo>
// ★ 按进程唯一（带 `process.pid`）⇒ 并发跑两个实例不互删夹具（同 `gate-blindness.test.mjs` 的修法）。
const TMP = path.join(REPO, `.tmp-scan-test-${process.pid}`);
const STYLES = path.join(TMP, 'styles');
const ALPHA = path.join(STYLES, 'alpha');
const BETA = path.join(STYLES, 'beta');

function w(base, rel, content) {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

// alpha 的**基线**文件集：前 10 个是「纳入」的，其余是「有意排除」的。
const ALPHA_BASE = {
  // ── 纳入（CODE_EXT + ROOT_EXTRAS）──
  'STYLE.md': '# alpha style\n',
  'DEMO.md': '# alpha demo\n',
  'style.json': '{"slug":"alpha"}\n',
  'index.html': '<!doctype html><body>alpha</body>\n',
  'app.css': 'body{color:#111}\n',
  'demo/film.js': 'export const film = 1;\n',
  'demo/main.mjs': 'export const main = 1;\n',
  'demo/engine/render.cjs': 'module.exports = {};\n',
  'demo/scene.ts': 'export const scene = 1;\n',
  'demo/page.htm': '<p>alpha</p>\n',
  // ── 有意排除：生成物 / 音频 / 素材 / 其它扩展名 ──
  'demo/events.json': '{"a":1}\n',
  'demo/lines.json': '{"b":2}\n',
  'demo/content.zh.json': '{"c":3}\n',
  'demo/mix.py': 'print(1)\n',
  'demo/music.py': 'print(2)\n',
  'demo/note.txt': 'hello\n',
  'demo/subs.srt': '1\n00:00:00,000 --> 00:00:01,000\nhi\n',
  'demo/poster.png': 'PNG',
  // ── 有意排除：DENY_DIRS 整子树（这里的 .js 也不该被纳入）──
  'demo/out/artifact.js': 'export const o = 1;\n',
  'demo/stills/shot.js': 'export const s = 1;\n',
  'demo/music/track.js': 'export const t = 1;\n',
  'demo/fonts/font.js': 'export const f = 1;\n',
  'demo/assets/asset.js': 'export const a = 1;\n',
  'demo/tts/voice.js': 'export const v = 1;\n',
};

// D10：alpha 上 collectStyleFiles 的**精确**期望集合（已按 JS 默认排序）。
// 注意大小写：ASCII 里 'D'(68) < 'S'(83) < 'a'(97) < 'd'(100) < 'i' < 's'。
const ALPHA_EXPECTED = [
  'DEMO.md',
  'STYLE.md',
  'app.css',
  'demo/engine/render.cjs',
  'demo/film.js',
  'demo/main.mjs',
  'demo/page.htm',
  'demo/scene.ts',
  'index.html',
  'style.json',
];

function buildAlpha() {
  fs.rmSync(ALPHA, { recursive: true, force: true });
  for (const [rel, c] of Object.entries(ALPHA_BASE)) w(ALPHA, rel, c);
}

function buildBeta() {
  fs.rmSync(BETA, { recursive: true, force: true });
  w(BETA, 'demo/film.js', 'export const film = 999;\n'); // 内容与 alpha 不同
}

/** 建 styles 根：alpha / beta + 三个**必须被 slug 过滤掉**的诱饵。 */
function buildStylesRoot() {
  fs.rmSync(STYLES, { recursive: true, force: true });
  buildAlpha();
  buildBeta();
  w(STYLES, '.hidden/x.js', 'x\n');      // 点开头 ⇒ 跳过
  w(STYLES, '_template/x.js', 'x\n');    // NON_STYLE ⇒ 跳过
  w(STYLES, 'node_modules/x.js', 'x\n'); // NON_STYLE ⇒ 跳过
}

// ── A. 指纹的基本性质 ────────────────────────────────────────
test('A1 稳定：同一目录连续两次指纹 ⇒ hash 与 fileCount 都相同', () => {
  buildAlpha();
  const a = fingerprintStyle(ALPHA);
  const b = fingerprintStyle(ALPHA);
  assert.equal(a.hash, b.hash, '同一内容两次指纹必须相同（否则每次扫描都误报变更）');
  assert.equal(a.fileCount, b.fileCount, 'fileCount 必须稳定');
  assert.equal(a.fileCount, ALPHA_EXPECTED.length, `alpha 应覆盖 ${ALPHA_EXPECTED.length} 个文件`);
});

test('A2 ★有区分度（防退化）：两个内容不同的目录 ⇒ hash 不同', () => {
  buildAlpha();
  buildBeta();
  const a = fingerprintStyle(ALPHA);
  const b = fingerprintStyle(BETA);
  assert.notEqual(a.hash, b.hash,
    '内容不同却同 hash ⇒ 哈希函数退化成常量，plan 会永远报「0 待处理」');
});

// ── B. 该变就变 ─────────────────────────────────────────────
test('B3 ★改一个 .js ⇒ hash 变，且 diffScans 精确点名该文件', () => {
  buildAlpha();
  const before = fingerprintStyle(ALPHA);
  w(ALPHA, 'demo/film.js', 'export const film = 2; // changed\n');
  const after = fingerprintStyle(ALPHA);
  assert.notEqual(after.hash, before.hash, '改了画面代码 hash 却没变 ⇒ 自动纳入失效');

  const d = diffScans(
    { styles: { alpha: after } },
    { styles: { alpha: before } },
  );
  assert.equal(d.changed.length, 1, '应当报出 1 个变更风格');
  assert.equal(d.changed[0].slug, 'alpha');
  assert.deepEqual(d.changed[0].changedFiles, ['demo/film.js'],
    'changedFiles 必须精确到「哪个文件」，多一个少一个都不行');
});

test('B4 ★改 index.html / .css / .mjs ⇒ hash 各应变', () => {
  const targets = [
    ['index.html', '<!doctype html><body>beta</body>\n'],
    ['app.css', 'body{color:#222}\n'],
    ['demo/main.mjs', 'export const main = 2;\n'],
  ];
  for (const [rel, next] of targets) {
    buildAlpha();
    const before = fingerprintStyle(ALPHA);
    w(ALPHA, rel, next);
    const after = fingerprintStyle(ALPHA);
    assert.notEqual(after.hash, before.hash, `改了 ${rel} 指纹却没变（该扩展名漏纳入）`);
  }
});

test('B5 ★改根级 STYLE.md / DEMO.md / style.json ⇒ hash 各应变（靠 ROOT_EXTRAS 纳入）', () => {
  const targets = [
    ['STYLE.md', '# alpha style v2\n'],
    ['DEMO.md', '# alpha demo v2\n'],
    ['style.json', '{"slug":"alpha","v":2}\n'],
  ];
  for (const [rel, next] of targets) {
    buildAlpha();
    const before = fingerprintStyle(ALPHA);
    w(ALPHA, rel, next);
    const after = fingerprintStyle(ALPHA);
    assert.notEqual(after.hash, before.hash,
      `改了根级 ${rel} 指纹却没变（它不是代码扩展名，必须靠 ROOT_EXTRAS 纳入）`);
  }
});

// ── C. 不该变就不变（最容易被重构破坏，也最有价值）──────────
test('C6 ★改生成物 json（events/lines/content.zh）⇒ hash 必须不变', () => {
  buildAlpha();
  const before = fingerprintStyle(ALPHA);
  w(ALPHA, 'demo/events.json', '{"a":999}\n');
  w(ALPHA, 'demo/lines.json', '{"b":999}\n');
  w(ALPHA, 'demo/content.zh.json', '{"c":999}\n');
  const after = fingerprintStyle(ALPHA);
  assert.equal(after.hash, before.hash,
    '生成物 .json 是**有意排除**的（style-scan.mjs:22-27）：它变了不代表风格变了，纳入只会误报');
  assert.equal(after.fileCount, before.fileCount, 'fileCount 也不该变');
});

test('C7 ★在 DENY_DIRS 里新建 .js ⇒ hash 必须不变（整子树被排除）', () => {
  buildAlpha();
  const before = fingerprintStyle(ALPHA);
  const denyDirs = ['out', 'stills', 'music', 'fonts', 'assets'];
  for (const d of denyDirs) w(ALPHA, `demo/${d}/brand-new.js`, 'export const n = 1;\n');
  const after = fingerprintStyle(ALPHA);
  assert.equal(after.hash, before.hash,
    `${denyDirs.join('/')} 是 DENY_DIRS 整子树（style-scan.mjs:51-55），里面的 .js 不该参与指纹`);
  assert.equal(after.fileCount, before.fileCount);
});

test('C8 ★改 .py（mix.py / music.py）⇒ hash 必须不变', () => {
  buildAlpha();
  const before = fingerprintStyle(ALPHA);
  w(ALPHA, 'demo/mix.py', 'print("changed")\n');
  w(ALPHA, 'demo/music.py', 'print("changed")\n');
  const after = fingerprintStyle(ALPHA);
  assert.equal(after.hash, before.hash,
    '.py 是**有意排除**的（混音/TTS 与「画面长什么样」无关，style-scan.mjs:25）');
});

test('C9 ★新增 .txt / .srt ⇒ hash 必须不变（扩展名不在白名单）', () => {
  buildAlpha();
  const before = fingerprintStyle(ALPHA);
  w(ALPHA, 'demo/extra.txt', 'note\n');
  w(ALPHA, 'demo/extra.srt', '1\n00:00:00,000 --> 00:00:01,000\nhi\n');
  const after = fingerprintStyle(ALPHA);
  assert.equal(after.hash, before.hash, '非白名单扩展名不该进入指纹');
});

// ── D. collectStyleFiles 的形状 ──────────────────────────────
test('D10 ★collectStyleFiles：相对路径 / 正斜杠 / 已排序 / 无重复 / 精确集合相等', () => {
  buildAlpha();
  const files = collectStyleFiles(ALPHA);

  assert.deepEqual(files, ALPHA_EXPECTED,
    '结果集合必须与预期**精确相等**（不是子集）—— 多纳入 = 误报，少纳入 = 漏报');
  assert.ok(files.every((f) => !path.isAbsolute(f)), '必须是相对路径');
  assert.ok(files.every((f) => !f.includes('\\')), '必须用正斜杠');
  assert.deepEqual(files, [...files].sort(), '必须已排序');
  assert.equal(new Set(files).size, files.length, '不能有重复');
});

// ── E. diffScans 的三种差异 ──────────────────────────────────
test('E11 ★diffScans：added / changed（精确到文件）/ removed，字段名以代码为准', () => {
  buildStylesRoot();
  const s0 = scanStyles({ stylesRoot: STYLES });
  assert.deepEqual(Object.keys(s0.styles).sort(), ['alpha', 'beta'],
    'slug 过滤：点开头 / _template / node_modules 不该被当成风格');

  // 新增风格
  w(STYLES, 'gamma/demo/film.js', 'export const film = 1;\n');
  const s1 = scanStyles({ stylesRoot: STYLES });
  const d1 = diffScans(s1, s0);
  assert.equal(d1.added.length, 1, '新增风格应进 added');
  assert.equal(d1.added[0].slug, 'gamma');
  assert.deepEqual(d1.added[0].changedFiles, ['demo/film.js'], 'added 项应列出全部文件');
  assert.deepEqual(d1.changed, [], '新增不该同时算变更');
  assert.deepEqual(d1.removed, []);

  // 同名但内容变 ⇒ changedFiles 精确到文件
  w(ALPHA, 'demo/film.js', 'export const film = 3; // changed\n');
  const s2 = scanStyles({ stylesRoot: STYLES });
  const d2 = diffScans(s2, s1);
  assert.equal(d2.changed.length, 1);
  assert.equal(d2.changed[0].slug, 'alpha');
  assert.ok(typeof d2.changed[0].from === 'string' && typeof d2.changed[0].to === 'string',
    'changed 项应带 from/to 指纹');
  assert.deepEqual(d2.changed[0].changedFiles, ['demo/film.js']);
  assert.ok(d2.unchanged.includes('beta'), '未变风格应进 unchanged');

  // 删除风格 ⇒ 字段名是 removed（数组，元素是 slug 字符串）
  fs.rmSync(path.join(STYLES, 'gamma'), { recursive: true, force: true });
  const s3 = scanStyles({ stylesRoot: STYLES });
  const d3 = diffScans(s3, s2);
  assert.deepEqual(d3.removed, ['gamma'], '消失的风格应进 removed（字符串 slug）');
  assert.deepEqual(d3.added, []);
});

// ── F. 降级与解析 ────────────────────────────────────────────
test('F12 ★loadFingerprintFile：缺失 ⇒ null；损坏 JSON ⇒ **抛 SyntaxError**（实现不兜底）', () => {
  const missing = path.join(TMP, 'fp', 'nope.json');
  assert.equal(loadFingerprintFile(missing), null, '不存在的文件应返回 null');

  const corrupt = path.join(TMP, 'fp', 'corrupt.json');
  w(TMP, 'fp/corrupt.json', '{ this is not json');
  assert.throws(
    () => loadFingerprintFile(corrupt),
    (e) => e instanceof SyntaxError,
    '损坏的 JSON：loadFingerprintFile 内部直接 JSON.parse 且无 try/catch ⇒ 会抛（调用方须自行兜底）',
  );

  // 结构不对（缺 styles）⇒ null，而不是抛
  const wrongShape = path.join(TMP, 'fp', 'wrong.json');
  w(TMP, 'fp/wrong.json', '{"foo":1}');
  assert.equal(loadFingerprintFile(wrongShape), null, '缺 styles 字段应返回 null');

  // 正常文件 ⇒ 返回对象
  const good = path.join(TMP, 'fp', 'good.json');
  const scan = scanStyles({ stylesRoot: STYLES });
  writeFingerprintFile(good, scan);
  const loaded = loadFingerprintFile(good);
  assert.ok(loaded && typeof loaded === 'object', '正常文件应能读回');
  assert.equal(loaded.styleCount, Object.keys(scan.styles).length);
  assert.equal(loaded.algorithm, ALGORITHM);
  assert.equal(loaded.scannerVersion, SCANNER_VERSION);
});

test('F13 ★resolve* 优先级：显式入参 > 环境变量 > 默认值', () => {
  const saveRoot = process.env.LEMO_STYLES_ROOT;
  const saveFp = process.env.LEMO_STYLE_FP_FILE;
  try {
    delete process.env.LEMO_STYLES_ROOT;
    delete process.env.LEMO_STYLE_FP_FILE;
    assert.equal(resolveStylesRoot(), DEFAULT_STYLES_ROOT, '无入参无环境变量 ⇒ 默认值');
    assert.equal(resolveFpFile(), DEFAULT_FP_FILE);
    assert.equal(resolveStylesRoot(''), DEFAULT_STYLES_ROOT, '空串等同缺省（`v || …`）');

    process.env.LEMO_STYLES_ROOT = 'ENV_ROOT';
    process.env.LEMO_STYLE_FP_FILE = 'ENV_FP';
    assert.equal(resolveStylesRoot(), 'ENV_ROOT', '环境变量应覆盖默认值');
    assert.equal(resolveFpFile(), 'ENV_FP');
    assert.equal(resolveStylesRoot('EXPLICIT'), 'EXPLICIT', '显式入参应覆盖环境变量');
    assert.equal(resolveFpFile('EXPLICIT_FP'), 'EXPLICIT_FP');
  } finally {
    if (saveRoot === undefined) delete process.env.LEMO_STYLES_ROOT; else process.env.LEMO_STYLES_ROOT = saveRoot;
    if (saveFp === undefined) delete process.env.LEMO_STYLE_FP_FILE; else process.env.LEMO_STYLE_FP_FILE = saveFp;
  }
});

test('F14 导出常量稳定：SCANNER_VERSION=1，ALGORITHM=sha256', () => {
  assert.equal(SCANNER_VERSION, 1);
  assert.equal(ALGORITHM, 'sha256');
  assert.ok(typeof DEFAULT_STYLES_ROOT === 'string' && DEFAULT_STYLES_ROOT.length > 0);
  assert.ok(typeof DEFAULT_FP_FILE === 'string' && DEFAULT_FP_FILE.length > 0);
});

// ── G. checkStyleChanges 状态机（真实出片路径用的入口，永不抛）──
test('G15 ★checkStyleChanges：baseline → no-change → changed → error，且永不抛', async () => {
  buildStylesRoot();
  const fpFile = path.join(TMP, 'fp', 'check.json');
  fs.rmSync(fpFile, { force: true });

  // 无基线 ⇒ 建基线
  const r1 = await checkStyleChanges({ stylesRoot: STYLES, fpFile });
  assert.equal(r1.ok, true);
  assert.equal(r1.status, 'baseline', '首次无基线应建基线');
  assert.ok(fs.existsSync(fpFile), 'autoBaseline 默认应写盘');

  // 再跑 ⇒ 无变更
  const r2 = await checkStyleChanges({ stylesRoot: STYLES, fpFile });
  assert.equal(r2.status, 'no-change', '无改动应报 no-change');
  assert.equal(r2.added.length + r2.changed.length + r2.removed.length, 0);

  // 改代码 ⇒ changed
  w(ALPHA, 'demo/film.js', 'export const film = 42;\n');
  const r3 = await checkStyleChanges({ stylesRoot: STYLES, fpFile });
  assert.equal(r3.status, 'changed', '改了源码应报 changed');
  assert.equal(r3.changed[0].slug, 'alpha');
  assert.deepEqual(r3.changed[0].changedFiles, ['demo/film.js']);

  // autoBaseline:false 且无基线 ⇒ no-baseline（且不写盘）
  const fp2 = path.join(TMP, 'fp', 'nobase.json');
  fs.rmSync(fp2, { force: true });
  const r4 = await checkStyleChanges({ stylesRoot: STYLES, fpFile: fp2, autoBaseline: false });
  assert.equal(r4.status, 'no-baseline', 'autoBaseline:false 时应报 no-baseline');
  assert.equal(fs.existsSync(fp2), false, 'autoBaseline:false 时不该写盘');

  // 风格根目录不存在 ⇒ error（不抛）
  const r5 = await checkStyleChanges({ stylesRoot: path.join(TMP, 'no-such-root'), fpFile });
  assert.equal(r5.ok, false);
  assert.equal(r5.status, 'error');

  // 指纹文件损坏 ⇒ error（不抛；内部 loadFingerprintFile 抛被外层兜住）
  const fp3 = path.join(TMP, 'fp', 'broken.json');
  w(TMP, 'fp/broken.json', '{{{ not json');
  const r6 = await checkStyleChanges({ stylesRoot: STYLES, fpFile: fp3 });
  assert.equal(r6.ok, false, '损坏指纹文件不该抛，应降级为 error');
  assert.equal(r6.status, 'error');
});

// ── G16 ★写基线失败必须可见（D3）──────────────────────────────
// 此前：写基线失败仍返回 ok:true + status:'baseline' + 一个**全仓 0 处消费**的 writeError
// ⇒ 消费方（dub.mjs 的 warnStyleChanges）照打绿字「首次建立基线」⇒ 基线没落盘却报成功
// ⇒ 之后每次出片都 !prev ⇒ 永远停在 baseline、永不进 changed ⇒ 风格漂移检测**永久失明**。
test('G16 ★checkStyleChanges 写基线失败：ok=false + status 如实反映失败（不得静默报 baseline 成功）', async () => {
  buildStylesRoot();
  // ★ 可注入的真实 IO 失败点：让 fpFile 的**父路径是一个文件** ⇒ writeFingerprintFile 的
  //   `mkdirSync(dirname, {recursive:true})` 必然失败（ENOTDIR/EEXIST）。不 monkeypatch，纯真实 IO。
  const blocker = path.join(TMP, 'fp-blocker');
  fs.writeFileSync(blocker, 'not a directory\n');
  const fpFile = path.join(blocker, 'sub', 'baseline.json');

  const r = await checkStyleChanges({ stylesRoot: STYLES, fpFile });
  // ★ 硬判据①：写失败**不得**再伪装成「已建基线」成功
  assert.equal(r.ok, false, '写基线失败时 ok 必须为 false（此前是 true ⇒ 消费方打绿字成功话术）');
  // ★ 硬判据②：status 必须如实反映失败，不能再是成功态 'baseline'
  assert.equal(r.status, 'baseline-write-failed', `写失败应报 baseline-write-failed，实际 ${r.status}`);
  // ★ 硬判据③：必须带出失败原因，且 error 是面向用户的**可见**文案（含「基线」）
  assert.ok(r.writeError, '必须带 writeError（写失败原因）');
  assert.ok(typeof r.error === 'string' && /基线/.test(r.error) && /失败/.test(r.error),
    `error 文案必须可见且说明基线写失败，实际：${r.error}`);
  // ★ 仍守「永不抛、不阻断出片」：基线确实没落盘，但调用**正常返回**（没有 throw）
  assert.equal(fs.existsSync(fpFile), false, '基线确实没落盘（本用例就是在验这一点）');
});

// ── 运行器 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/style-scan.test.mjs —— 风格源码指纹机制 测试（合成临时目录，纯文件 IO）'));
  log(C.dim(`临时目录：${TMP}`));
  log('');

  const results = [];
  try {
    fs.mkdirSync(TMP, { recursive: true });
    for (const c of cases) {
      try {
        await c.fn();
        results.push({ name: c.name, ok: true });
        log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - t0}ms)`)}`);
      } catch (e) {
        results.push({ name: c.name, ok: false });
        log(`  ${C.bad('FAIL')}  ${c.name}`);
        for (const line of String((e && e.message) || e).split('\n')) log(`        ${line}`);
      }
    }
  } finally {
    // 按**确切路径**递归删除，不用通配符；绝不动真实目录。
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* 清不掉也不影响结论 */ }
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
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
