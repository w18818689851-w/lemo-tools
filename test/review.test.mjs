#!/usr/bin/env node
// test/review.test.mjs —— 编排器 ⑩「审核回路」（`--review`）的回归测试
//
// ★ 为什么必须有这一份：
//   `lemo-make.mjs` 的 ⑩ 审核回路（2026-10-11 接入上游 `TECHNIQUE.md` §8 里机器可做的两项）是
//   **opt-in** 的（`--review`，默认关）⇒ 默认出片路径**根本不会执行它**，而 `test/smoke.mjs` 走的
//   正是默认路径 ⇒ 这一整块**在既有测试里是零覆盖**。而它有两个「静默失败」面：
//     ① 接触表：`still.mjs --range` 出帧 → WSL 侧 `core/render/sheet.py` 拼图，任一步失败都**只 warn**；
//     ② 空帧检测：`ffmpeg blackdetect` 的输出**只写在 stderr 且与 `frame=` 进度行交错** ⇒
//        解析正则一错就会「0 处黑场」——而「0 处」与「没解析」在日志上**长得一样**。
//   ⇒ 本文件把这两面都钉住：CLI 契约（静态）+ blackdetect **真值**（真跑 ffmpeg）+ 端到端真产出。
//
// ★ 隔离：
//   · 不碰真实输出目录：所有临时产物落在 `D:/lemo-tmp/`（`FX`），`after()` 里清掉。
//   · **绝不**把成片写进 `D:/lemo-films/<slug>/`（本项目踩过「无 `--out` 真跑 ⇒ 样板片被覆盖」的事故）。
//   · 需要库仓（`D:/lemo-opuscar`）或 WSL / ffmpeg 的用例，缺依赖时**显式 skip**（不假装通过）。
//
// 用法：node test/review.test.mjs
// 退出码：全绿 0，有失败 1。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FX = 'D:/lemo-tmp/_review-test-fx';                 // 本测试的临时根（绝不碰真实输出目录）
const LIB = process.env.LEMO_LIB_WIN || 'D:/lemo-opuscar';
const SAMPLE = 'D:/lemo-films/ascii-crt/ascii-crt.mp4';   // 样板成片（blackdetect / 端到端用）

// ffmpeg 定位：**照抄** lemo-make.mjs 的 CFG.ffmpegDirs（同一份目录清单，不另发明）。
const FF = ['D:\\ffmpeg-9.x\\ffmpeg-9.0.2-full_build\\bin', 'D:\\Feijian\\_internal']
  .map((d) => path.join(d, 'ffmpeg.exe')).find((p) => fs.existsSync(p)) || null;
const FFPROBE = FF ? path.join(path.dirname(FF), 'ffprobe.exe') : null;
// 库仓里编排器实际要用的两个脚本（缺一 ⇒ 接触表整条路不可用 ⇒ 相关用例 skip）。
const STILL = path.join(LIB, 'core', 'render', 'still.mjs');
const HAS_LIB = fs.existsSync(STILL) && fs.existsSync(path.join(LIB, 'styles', 'ascii-crt', 'demo', 'index.html'));

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

/** ★ 与 `lemo-make.mjs` 的 `emitReview()` 里**逐字相同**的解析口径（两处一起改，别只改一处）。 */
const BLACK_RE = /black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g;
const parseBlack = (stderr) => [...String(stderr || '').matchAll(BLACK_RE)]
  .map((m) => ({ start: Number(m[1]), end: Number(m[2]), dur: Number(m[3]) }));

fs.rmSync(FX, { recursive: true, force: true });
fs.mkdirSync(FX, { recursive: true });
after(() => { try { fs.rmSync(FX, { recursive: true, force: true }); } catch { /* 清不掉不影响结论 */ } });

// ═══════════════════ A. CLI 契约（静态；不需要库 / WSL / ffmpeg）═══════════════════

test('A1 `--help` 列出审核回路的 5 个新参数', async () => {
  const r = await orch(['--help']);
  assert.equal(r.code, 0, '--help 应退出码 0');
  for (const f of ['--review', '--sheet-step', '--sheet-cols', '--sheet-w', '--blackdetect-d']) {
    assert.ok(r.out.includes(f), `--help 应列出 ${f}`);
  }
});

test('A2 默认 dry-run 不含第 10 步（--review 是 opt-in，默认关）', async () => {
  const r = await orch(['ascii-crt', '--skip-sync', '--dry-run']);
  assert.equal(r.code, 0);
  assert.ok(!r.out.includes('10. 审核回路'), '不传 --review 时不该出现第 10 步');
  assert.ok(!r.out.includes('sheet.jpg'), '不传 --review 时不该提到 sheet.jpg');
});

test('A3 `--review --dry-run` 把第 10 步排进计划（含 sheet.jpg 与 blackdetect 参数）', async () => {
  const r = await orch(['ascii-crt', '--skip-sync', '--review', '--dry-run']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('10. 审核回路'), '--review 时应出现第 10 步');
  assert.ok(r.out.includes('sheet.jpg'));
  assert.ok(r.out.includes('blackdetect'));
  // 默认值要在计划里可见（默认 2s / 4 列 / 480px / d=0.5）
  assert.match(r.out, /每 2s 一帧 · 4 列 × 480px/);
  assert.match(r.out, /blackdetect（d=0\.5s）/);
});

test('A4 非法取值一律非 0 退出并给出明确文案', async () => {
  const cases = [
    [['--sheet-step', '0'], /--sheet-step 必须是正数/],
    [['--sheet-cols', '0'], /--sheet-cols 必须是 ≥1 的整数/],
    [['--sheet-w', '8'], /--sheet-w 必须是 ≥16 的整数/],
    [['--blackdetect-d', '-1'], /--blackdetect-d 必须是正数/],
  ];
  for (const [extra, re] of cases) {
    const r = await orch(['ascii-crt', '--review', ...extra, '--dry-run']);
    assert.notEqual(r.code, 0, `${extra.join(' ')} 应非 0 退出`);
    assert.match(r.err + r.out, re, `${extra.join(' ')} 应给出文案`);
  }
});

test('A5 悬空取值非 0 退出（不静默吞掉下一个选项）', async () => {
  const r = await orch(['ascii-crt', '--sheet-step', '--dry-run']);
  assert.notEqual(r.code, 0, '悬空取值应非 0 退出（否则 --dry-run 会被当成值吞掉）');
  assert.match(r.err + r.out, /缺少值/);
});

// ═══════════════════ B. blackdetect 真值（真跑 ffmpeg；不编码，纯分析滤镜）═══════════════════

test('B1 blackdetect 在合成的「黑/白/黑」片上检出 2 段（真值，非「没解析」）', async (t) => {
  if (!FF) return t.skip('找不到 Windows ffmpeg');
  const r = await sh(FF, ['-hide_banner', '-nostdin',
    '-f', 'lavfi', '-i', 'color=c=black:s=160x120:r=10:d=1',
    '-f', 'lavfi', '-i', 'color=c=white:s=160x120:r=10:d=1',
    '-f', 'lavfi', '-i', 'color=c=black:s=160x120:r=10:d=1',
    '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0,blackdetect=d=0.5:pix_th=0.10',
    '-f', 'null', '-']);
  const hits = parseBlack(r.err);
  assert.equal(hits.length, 2, `应检出 2 段，实际 ${hits.length}：${JSON.stringify(hits)}`);
  assert.ok(hits[0].start <= 0.05, `第 1 段应从 0 开始，实际 ${hits[0].start}`);
  assert.ok(hits[0].end >= 0.9 && hits[0].end <= 1.1, `第 1 段应止于 1s，实际 ${hits[0].end}`);
  assert.ok(hits[1].start >= 1.9 && hits[1].start <= 2.1, `第 2 段应从 2s 开始，实际 ${hits[1].start}`);
  assert.ok(hits[1].end >= 2.8 && hits[1].end <= 3.0, `第 2 段应止于 3s 前，实际 ${hits[1].end}`);
});

test('B2 blackdetect 在全白片上检出 0 段（「0 处」是真空集，不是没解析）', async (t) => {
  if (!FF) return t.skip('找不到 Windows ffmpeg');
  const r = await sh(FF, ['-hide_banner', '-nostdin',
    '-f', 'lavfi', '-i', 'color=c=white:s=160x120:r=10:d=2',
    '-vf', 'blackdetect=d=0.5:pix_th=0.10', '-f', 'null', '-']);
  // ★ 必须同时钉住「ffmpeg 真的跑完了」——否则「0 段」可能只是它压根没跑。
  assert.equal(r.code, 0, `ffmpeg 应正常退出，实际 ${r.code}：${r.err.slice(-300)}`);
  assert.ok(/frame=/.test(r.err) || /Lsize|time=/.test(r.err), '应能看到 ffmpeg 的进度输出（证明真的解码过）');
  assert.equal(parseBlack(r.err).length, 0, '全白片不该检出黑场');
});

test('B3 blackdetect 在真实成片上检出 ≥1 段（走 `-i <文件>` 真路径）', async (t) => {
  if (!FF) return t.skip('找不到 Windows ffmpeg');
  if (!fs.existsSync(SAMPLE)) return t.skip(`样板成片不在：${SAMPLE}`);
  const r = await sh(FF, ['-hide_banner', '-nostdin', '-i', SAMPLE,
    '-vf', 'blackdetect=d=0.5:pix_th=0.10', '-an', '-f', 'null', '-']);
  assert.equal(r.code, 0, `ffmpeg 应正常退出，实际 ${r.code}`);
  const hits = parseBlack(r.err);
  assert.ok(hits.length >= 1, `样板片实测应有黑场（片头/片尾），实际 ${hits.length} 段`);
  for (const h of hits) assert.ok(h.dur > 0 && h.end > h.start, `黑场区间应合法：${JSON.stringify(h)}`);
});

// ═══════════════════ C. 端到端：`--review` 真跑一遍（预置成片 ⇒ 只跑第 5 步 + 第 10 步）═══════════════════

test('C1 `--review` 端到端：预置成片 ⇒ 真产 sheet.jpg 且打印 blackdetect 结果', async (t) => {
  if (!FF) return t.skip('找不到 Windows ffmpeg');
  if (!HAS_LIB) return t.skip(`库仓不可用（缺 ${STILL} 或 ascii-crt demo）`);
  if (!fs.existsSync(SAMPLE)) return t.skip(`样板成片不在：${SAMPLE}`);

  // ★ 预置「本次输出目录」里的成片 ⇒ `--skip-render --skip-audio` 时第 5 步（核验导出）能过，
  //   而第 6/7/8 步用开关关掉 ⇒ **只跑第 10 步**（这就是对新增代码的真端到端）。
  const outDir = path.join(FX, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(SAMPLE, path.join(outDir, 'ascii-crt.mp4'));

  const r = await orch(['ascii-crt', '--out', outDir,
    '--skip-sync', '--skip-audio', '--skip-render',
    '--no-preflight', '--no-readcheck', '--no-poster', '--no-deliverables',
    '--review', '--sheet-step', '30']);      // 60s 片 ⇒ 2 帧，够验通路又够快

  assert.equal(r.code, 0, `端到端应退出码 0，实际 ${r.code}\n${r.err.slice(-2000)}`);
  // ① 空帧检测：必须在输出里**明说**（无论 0 处还是 N 处）
  assert.match(r.out + r.err, /空帧检测：(\d+) 处黑场/, '应打印空帧检测结论（0 处也要明说）');
  // ② 接触表：真产出 sheet.jpg
  const sheet = path.join(outDir, 'sheet.jpg');
  assert.ok(fs.existsSync(sheet), `应产出 ${sheet}`);
  assert.ok(fs.statSync(sheet).size > 1000, 'sheet.jpg 不该是空文件');
  assert.match(r.out, /sheet\.jpg/, '应打印 sheet.jpg 落点');
  // ③ 几何：sheet.py 自己会把 `(宽, 高)` 打到 stdout，编排器原样转发 ⇒ 用它钉「cols × w」的换算。
  //    cols / w 都用默认值（4 / 480）⇒ 宽必须恰是 1920。
  assert.match(r.out, /\(1920, \d+\)/, 'sheet.py 应报出总览图尺寸（宽 = cols × w = 4 × 480 = 1920）');
});

test('C2 `--review` 失败只 warn、不阻断出片（emitReview 里没有 fail）', async (t) => {
  if (!HAS_LIB) return t.skip(`库仓不可用（缺 ${STILL} 或 ascii-crt demo）`);
  // 预置一个 **0 字节假成片**：第 5 步（核验导出）只看「文件在不在」⇒ 能过；第 10 步的 ffmpeg/ffprobe
  // 会失败 ⇒ 走 warn 分支。钉「审核回路只报告、不阻断」这条失败语义。
  const outDir = path.join(FX, 'out2');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'ascii-crt.mp4'), '');
  const r = await orch(['ascii-crt', '--out', outDir,
    '--skip-sync', '--skip-audio', '--skip-render',
    '--no-preflight', '--no-readcheck', '--no-poster', '--no-deliverables', '--review', '--sheet-step', '30']);
  assert.equal(r.code, 0, `审核回路失败不该让出片 fail，实际退出码 ${r.code}\n${r.err.slice(-1500)}`);
  // 静态钉：`emitReview` 的函数体里**不许**有 `fail(`（只 warn）。它是文件里最后一个函数 ⇒ 切到末尾即可。
  const src = fs.readFileSync(path.join(ROOT, 'lemo-make.mjs'), 'utf8');
  const body = src.slice(src.indexOf('async function emitReview('));
  assert.ok(body.length > 500, '应能切出 emitReview 函数体');
  assert.ok(!/\bfail\(/.test(body), 'emitReview 里不该有 fail(...) —— 审核回路只报告、不阻断');
});
