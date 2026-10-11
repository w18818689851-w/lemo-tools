#!/usr/bin/env node
// test/stills-only.test.mjs —— 编排器 ⑫「断点式分镜」（`--stills-only`）的回归测试
//
// ★ 为什么必须有这一份：
//   `--stills-only`（2026-10-11 接入上游 `AGENTS.md` / `DIRECTOR.md` §5 的「先看分镜」）是 **opt-in**
//   （默认关）⇒ 默认出片路径**根本不会执行它**，`test/smoke.mjs` 走的正是默认路径 ⇒ 这块**零覆盖**。
//   而它有两个只有真跑才暴露的面：
//     ① **落点**：分镜总览图必须落在 `--out` 指定目录（而不是 demo 的产物区 / 默认成片库）；
//     ② **退出时机**：必须在**渲染之前**停下 —— 不渲染、不混流、**不产成片**（真跑后输出目录里只该有那张图）。
//   ⇒ 本文件把这两面 + CLI 契约 + 「复用同一份出帧/拼图实现」都钉住。
//
// ★ 隔离（照 test/review.test.mjs 的口径）：
//   · 所有临时产物落在 `D:/lemo-tmp/`（`FX`），`after()` 里清掉；
//   · **绝不**让产物落进 `D:/lemo-films/<slug>/`（本项目踩过「无 `--out` 真跑 ⇒ 样板片被覆盖」的事故）；
//   · 需要库仓 / WSL / 浏览器的用例，缺依赖时**显式 skip**（不假装通过）。
//
// 用法：node test/stills-only.test.mjs
// 退出码：全绿 0，有失败 1。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FX = 'D:/lemo-tmp/_stills-only-test-fx';            // 本测试的临时根（绝不碰真实输出目录）
const LIB = process.env.LEMO_LIB_WIN || 'D:/lemo-opuscar';
const SLUG = 'ascii-crt';                                 // 与 review.test.mjs 同一个风格（样例片/风格文档都在）
const STILL = path.join(LIB, 'core', 'render', 'still.mjs');
const DEMO_HTML = path.join(LIB, 'styles', SLUG, 'demo', 'index.html');
const HAS_LIB = fs.existsSync(STILL) && fs.existsSync(DEMO_HTML);
const SRC = fs.readFileSync(path.join(ROOT, 'lemo-make.mjs'), 'utf8');

/** 异步子进程（★ 本机 `spawnSync` / `execFileSync` 一律 EBUSY ⇒ 只能用异步 `spawn`）。 */
function sh(exe, args, opts = {}) {
  return new Promise((resolve) => {
    const c = spawn(exe, args, { windowsHide: true, ...opts });
    let out = '', err = '';
    c.stdout?.on('data', (d) => { out += d; });
    c.stderr?.on('data', (d) => { err += d; });
    c.on('error', (e) => resolve({ code: -1, out, err: String(e.message) }));
    c.on('close', (code) => resolve({ code, out, err }));
  });
}

/** 跑编排器（CLI 契约用）。 */
const orch = (args) => sh(process.execPath, ['lemo-make.mjs', ...args], { cwd: ROOT });

/** 数一个子串在源码里出现几次（判据用；别用正则，免得被特殊字符咬）。 */
const count = (hay, needle) => hay.split(needle).length - 1;

fs.rmSync(FX, { recursive: true, force: true });
fs.mkdirSync(FX, { recursive: true });
after(() => { try { fs.rmSync(FX, { recursive: true, force: true }); } catch { /* 清不掉不影响结论 */ } });

// ═══════════════════ A. CLI 契约（静态；不需要库 / WSL / 浏览器）═══════════════════

test('A1 `--help` 列出 `--stills-only`（且说明「渲染之前停下 / 不产成片」）', async () => {
  const r = await orch(['--help']);
  assert.equal(r.code, 0, '--help 应退出码 0');
  assert.ok(r.out.includes('--stills-only'), '--help 应列出 --stills-only');
  assert.ok(r.out.includes('渲染之前停下'), '--help 应说清语义 = 渲染之前停下');
  assert.ok(/不渲染、不混流、不产成片/.test(r.out), '--help 应说清不产成片');
});

test('A2 默认 dry-run 不含分镜步、不提 storyboard.jpg（--stills-only 是 opt-in，默认关）', async () => {
  const r = await orch([SLUG, '--skip-sync', '--dry-run']);
  assert.equal(r.code, 0);
  assert.ok(!r.out.includes('--stills-only'), '不传该开关时不该提到 --stills-only');
  assert.ok(!r.out.includes('storyboard.jpg'), '不传该开关时不该提到 storyboard.jpg');
  assert.ok(!r.out.includes('分镜'), '不传该开关时不该出现「分镜」字样');
});

test('A3 `--stills-only --dry-run` 排进分镜步，并明说渲染/混流「不会执行」', async () => {
  const r = await orch([SLUG, '--skip-sync', '--dry-run', '--stills-only']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('--stills-only'), '应出现 --stills-only');
  assert.ok(r.out.includes('storyboard.jpg'), '应提到分镜总览图的落点');
  assert.ok(r.out.includes('不会执行'), '应明说后续步骤不会执行');
  assert.ok(/渲染/.test(r.out) && /混流/.test(r.out), '「不会执行」那句应点名渲染与混流');
  // ★ 不该印「正常出片」那张清单（它会把 2–8 步列成**会跑**的样子 ⇒ 骗人）。
  assert.ok(!/4\. 混流     WSL/.test(r.out), '不该出现「正常出片」清单里的混流行');
  // 默认取样粒度（2s / 4 列 / 480px）要在计划里可见
  assert.match(r.out, /每 2s 一帧 · 4 列 × 480px/);
});

test('A4 未知参数仍然报错（新开关没把 parseArgs 的兜底分支吃掉）', async () => {
  const r = await orch([SLUG, '--stills-onlyy', '--dry-run']);
  assert.notEqual(r.code, 0, '拼错的参数应非 0 退出');
  assert.match(r.err + r.out, /未知参数/);
});

test('A5 默认路径逐字节不变：默认值 false + 所有新分支都在 `if (o.stillsOnly)` 守卫之下', () => {
  // ① 默认值
  assert.match(SRC, /review: false, stillsOnly: false,/, '默认值必须是 stillsOnly: false');
  // ② 解析分支（新增 flag 必须被 a === '--stills-only' 处理，check-cli-docs 也认这条）
  assert.ok(SRC.includes("a === '--stills-only'"), "parseArgs 应有 a === '--stills-only' 分支");
  // ③ 两处「会改变默认路径行为」的落点都必须带守卫
  assert.ok(/if \(o\.stillsOnly\) \{ dryRunStillsOnly\(o, outDir\); process\.exit\(0\); \}/.test(SRC),
    'dry-run 分支必须带 if (o.stillsOnly) 守卫');
  assert.ok(/if \(o\.stillsOnly\) \{ process\.exit\(\(await emitStillsOnly\(/.test(SRC),
    '主流程调用点必须带 if (o.stillsOnly) 守卫');
  // ④ 默认值那一行不许被拆成多行（本项目刻意用它保区块行号，见 test/README.md）
  assert.ok(SRC.includes("review: false, stillsOnly: false, sheetStep: 2,"), '默认值必须仍在同一行上');
});

// ═══════════════════ B. 流程语义（静态源码钉）═══════════════════

test('B1 调用点在**渲染之前**（第 2 步「导出事件与字幕」之前，也在渲染 spawn 之前）', () => {
  const callAt = SRC.indexOf('if (o.stillsOnly) { process.exit((await emitStillsOnly(');
  const step2At = SRC.indexOf('// ── 2. 导出事件与字幕');
  // ★ 锚在**渲染 spawn** 上，不锚字符串 `core/render/video.mjs` —— 后者在本文件里首次出现是第 980 行的注释。
  const renderSpawnAt = SRC.indexOf('await runLive(process.execPath, renderVArgs');
  assert.ok(callAt > 0, '应能找到 emitStillsOnly 的调用点');
  assert.ok(step2At > 0, '应能找到第 2 步的注释');
  assert.ok(renderSpawnAt > 0, '应能找到渲染 spawn 点');
  assert.ok(callAt < step2At, '调用点必须在第 2 步之前（否则就不是「渲染之前停下」）');
  assert.ok(callAt < renderSpawnAt, '调用点必须在渲染 spawn 之前');
});

test('B2 复用同一份「出帧 + 拼图」实现：--review 与 --stills-only 都走 emitContactSheet，且只造一次', () => {
  // 两个入口各调一次（共 2 处 `await emitContactSheet(`）
  assert.equal(count(SRC, 'await emitContactSheet('), 2,
    'emitContactSheet 应恰好被调用 2 次（--review / --stills-only 各一次）');
  // 拼图命令（WSL 侧 core/render/sheet.py）在整个文件里只构造一次
  assert.equal(count(SRC, '"$PY" core/render/sheet.py'), 1,
    'core/render/sheet.py 的调用只该有 1 处（不许另造第二套拼图代码）');
  // 出帧命令（still.mjs --range）只在 emitContactSheet 里构造
  assert.equal(count(SRC, "'--range', `0:${dur.toFixed(2)}:${o.sheetStep}`"), 1,
    'still.mjs --range 的构造只该有 1 处');
  // emitReview 的接触表段必须已经改为调用 emitContactSheet（而不是留着旧的内联代码）
  const rev = SRC.slice(SRC.indexOf('async function emitReview('), SRC.indexOf('// ───────── ⑫ 断点式分镜'));
  assert.ok(rev.includes('await emitContactSheet('), 'emitReview 应改为调用 emitContactSheet');
  assert.ok(!rev.includes('const sheetSh'), 'emitReview 里不该再留着内联的 sheetSh 构造');
  assert.ok(!rev.includes("'--range'"), 'emitReview 里不该再留着内联的出帧命令构造');
});

test('B3 分镜产不出来 ⇒ 退出码 1（本开关的唯一目的就是那张图，不许当成功）', () => {
  assert.ok(/process\.exit\(\(await emitStillsOnly\([^)]*\)\) \? 0 : 1\)/.test(SRC),
    '调用点应按 emitStillsOnly 的返回值决定退出码');
  const fn = SRC.slice(SRC.indexOf('async function emitStillsOnly('));
  assert.ok(fn.includes('return false'), 'emitStillsOnly 失败时应 return false');
  assert.ok(fn.includes('return true'), 'emitStillsOnly 成功时应 return true');
  // 必须自己建输出目录：正常出片的 outDir 是第 8 步才 mkdir 的，而本开关在第 2 步前就退出
  assert.ok(/fs\.mkdirSync\(outDir, \{ recursive: true \}\)/.test(fn),
    'emitStillsOnly 必须自己 fs.mkdirSync(outDir)（否则 sheet.py 写不进去）');
});

// ═══════════════════ C. 端到端真跑（不渲染成片 ⇒ 便宜；需库 / WSL / 浏览器）═══════════════════

test('C1 `--stills-only --out <dir>` 真跑：分镜图落在 --out 目录，且**没有**成片', async (t) => {
  if (!HAS_LIB) return t.skip(`库仓不可用（缺 ${STILL} 或 ${SLUG} demo）`);

  const outDir = path.join(FX, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const r = await orch([SLUG, '--out', outDir,
    '--skip-sync', '--no-preflight', '--stills-only', '--sheet-step', '30']);   // 60s 片 ⇒ 2 帧，够验通路又够快

  assert.equal(r.code, 0, `端到端应退出码 0，实际 ${r.code}\n${r.err.slice(-2000)}`);

  // ① 分镜总览图真产出，且落在 **--out 指定目录**
  const board = path.join(outDir, 'storyboard.jpg');
  assert.ok(fs.existsSync(board), `应产出 ${board}`);
  assert.ok(fs.statSync(board).size > 1000, 'storyboard.jpg 不该是空文件');
  assert.match(r.out, /storyboard\.jpg/, '应打印 storyboard.jpg 落点');
  // ② 该目录里**不该有**成片（「不渲染、不混流、不产成片」）
  const mp4s = fs.readdirSync(outDir).filter((n) => n.endsWith('.mp4'));
  assert.deepEqual(mp4s, [], `输出目录里不该有 mp4（--stills-only 不产成片），实际 ${JSON.stringify(mp4s)}`);
  // ③ 日志里不该出现渲染/混流的完成标记
  assert.ok(!/MUX_OK/.test(r.out + r.err), '不该出现 MUX_OK（混流没跑）');
  assert.ok(!/全部完成/.test(r.out), '不该出现「全部完成」（那是正常出片收尾）');
  // ④ 流程在**渲染之前**退出 ⇒ 步骤号止于「分镜」
  assert.ok(/\[3\] 分镜/.test(r.out) || /分镜（--stills-only/.test(r.out), '应打印分镜步骤标题');
  assert.ok(!/\[4\]/.test(r.out), '不该跑到第 4 步（渲染/混流都在它之后）');
});

test('C2 时长来源 = `style.json` 的 `dur`（真值比对；分镜阶段没有成片可 ffprobe）', async (t) => {
  if (!HAS_LIB) return t.skip(`库仓不可用（缺 ${STILL} 或 ${SLUG} demo）`);
  const sjPath = path.join(LIB, 'styles', SLUG, 'style.json');
  if (!fs.existsSync(sjPath)) return t.skip(`缺 ${sjPath}`);
  const sj = JSON.parse(fs.readFileSync(sjPath, 'utf8'));
  const dur = Number(sj.dur);
  if (!Number.isFinite(dur) || dur <= 0) return t.skip(`style.json 的 dur 不可用：${sj.dur}`);

  const outDir = path.join(FX, 'out2');
  fs.mkdirSync(outDir, { recursive: true });
  const r = await orch([SLUG, '--out', outDir,
    '--skip-sync', '--no-preflight', '--stills-only', '--sheet-step', '30']);
  assert.equal(r.code, 0, `端到端应退出码 0，实际 ${r.code}\n${r.err.slice(-2000)}`);
  // 必须**如实标注来源**（不许只给个数字）
  const m = r.out.match(/分镜时长 ([\d.]+)s（来源：([^）]*)）/);
  assert.ok(m, '应打印「分镜时长 <N>s（来源：…）」');
  assert.equal(m[2], 'style.json 的 dur', `来源应标为 style.json 的 dur，实际「${m[2]}」`);
  assert.equal(Number(m[1]), Number(dur.toFixed(2)),
    `时长应与 style.json 的 dur 一致（${dur}），实际 ${m[1]}`);
});

test('C3 读不到 dur 时**如实标注**退化成「前 N 秒」（静态钉兜底分支，不伪造实测）', () => {
  const fn = SRC.slice(SRC.indexOf('async function emitStillsOnly('));
  assert.ok(/if \(dur === null\) \{/.test(fn), '应有 dur === null 的兜底分支');
  assert.ok(/兜底：前 \$\{stillsFallbackDur\(\)\}s（style\.json 无可用 dur）/.test(fn),
    '兜底分支必须把「来源」标成兜底（不许冒充实测值）');
  assert.ok(/function stillsFallbackDur\(\) \{ return \d+; \}/.test(SRC),
    '兜底秒数应由 stillsFallbackDur() 单点定义');
});
