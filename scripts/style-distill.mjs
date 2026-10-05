#!/usr/bin/env node
/**
 * scripts/style-distill.mjs —— 43 个内置风格的「顺序蒸馏」驱动
 *
 * 为什么要有它：蒸馏是**长期循环流程**（项目约定一），43 个风格要**逐个顺序**跑完
 * （GPU / TTS 都不能并发）。手工一个个敲命令既容易漏、也无法断点续跑。
 * 这个脚本把「枚举 → 顺序出片 → 抽帧 → 记状态」固化成可重入的一条流水线。
 *
 * 用法：
 *   node scripts/style-distill.mjs plan                    ← 按**源码指纹**报出「新增 / 变更 / 未蒸馏」的风格
 *   node scripts/style-distill.mjs render [--force] [--only a,b] [--no-skip-sync]
 *   node scripts/style-distill.mjs frames [--force] [--only a,b]
 *   node scripts/style-distill.mjs status
 *
 * ★ 「自动纳入」怎么落地的（约定一 · 长期循环）：
 *   本脚本的 `plan` 复用 `scripts/style-scan.mjs` 的**内容哈希指纹**（不是时间戳），
 *   把每个风格当前的指纹与「上次蒸馏时记下的指纹」比对 ——
 *   **新增的 styles/<slug>/ 与源码被改过的已有风格都会自己冒出来**，不需要人工记得去跑。
 *   所以新风格加入项目的流程就是：丢进 styles/ → `plan` 会列出来 → `render`/`frames`/写 Skill 文档。
 *   指纹在**出片成功时**自动写入 state.json（见 doRender）。
 *
 * 产物（全部在非 C 盘）：
 *   D:/lemo-films/<slug>/<slug>.mp4          —— 成片（编排器自己写的，本脚本不搬）
 *   D:/lemo-tools/_distill/state.json        —— 逐风格状态（可断点续跑的唯一依据）
 *   D:/lemo-tools/_distill/logs/<slug>.log   —— 每个风格的完整 stdout/stderr
 *   D:/lemo-tools/_distill/frames/<slug>/    —— 逐帧抽取 + 接触印样（contact sheet）
 *
 * ★ 纪律：
 *   · **顺序执行**，绝不并发（GPU 与 Index-TTS 都是独占资源）。
 *   · **一个失败不阻断后面的**：记 status=failed + 原因，继续跑下一个。
 *   · **可重入**：已成功的默认跳过（--force 才重跑）。
 *   · 本脚本**不改** lemo-make.mjs（红线：编排器不能被包装层改）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LIB = 'D:/lemo-opuscar';
const STYLES_DIR = path.join(LIB, 'styles');
const FILM_DIR = 'D:/lemo-films';
const WORK = path.join(ROOT, '_distill');
const STATE = path.join(WORK, 'state.json');
const LOGS = path.join(WORK, 'logs');
const FRAMES = path.join(WORK, 'frames');
const FFMPEG = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';

const argv = process.argv.slice(2);
const CMD = argv[0] || 'status';
const has = (f) => argv.includes(f);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OPT = {
  force: has('--force'),
  only: (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean),
  skipSync: !has('--no-skip-sync'),
  // 透传给 lemo-make 的额外参数（空格分隔）。用途：失败风格重跑时按需带 `--skip-audio`
  // （音频链本身跑不通、已有占位/自合成 mix.wav 的风格）或 `--skip-render`。
  extra: (argOf('--args') || '').split(/\s+/).filter(Boolean),
};

// ── 枚举：只认 styles/<slug> 且带 demo/ 的目录（_template 是骨架，不是风格）──
function allSlugs() {
  return fs.readdirSync(STYLES_DIR)
    .filter((n) => n !== '_template' && !n.startsWith('.'))
    .filter((n) => fs.existsSync(path.join(STYLES_DIR, n, 'demo')))
    .sort();
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { version: 1, updated: null, styles: {} }; }
}
function saveState(s) {
  fs.mkdirSync(WORK, { recursive: true });
  s.updated = new Date().toISOString();
  const tmp = `${STATE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 1), 'utf8');
  fs.renameSync(tmp, STATE);
}

function pickSlugs() {
  const all = allSlugs();
  return OPT.only.length ? all.filter((s) => OPT.only.includes(s)) : all;
}

/** 当前全部风格的源码指纹（复用 style-scan 的内容哈希，不用时间戳）。 */
async function currentFingerprints() {
  const m = await import('./style-scan.mjs');
  const scan = m.scanStyles({ stylesRoot: STYLES_DIR });
  const map = new Map();
  for (const [slug, v] of Object.entries(scan.styles || {})) map.set(slug, v.hash);
  return map;
}

// ── plan：按指纹报出「需要（重新）蒸馏」的风格 ──────────────────
//   这是「新增风格自动纳入」的**检测端**：新丢进 styles/ 的目录、以及源码被改过的已有风格，
//   都会在这里自己冒出来，不需要人工记得去跑。
async function doPlan() {
  const st = loadState();
  const all = allSlugs();
  const fp = await currentFingerprints();

  const never = [], changed = [], noFilm = [], fresh = [];
  for (const slug of all) {
    const rec = st.styles[slug];
    const cur = fp.get(slug) || null;
    if (!rec || !rec.fp) { never.push(slug); continue; }
    if (rec.fp !== cur) { changed.push({ slug, from: String(rec.fp).slice(0, 10), to: String(cur).slice(0, 10) }); continue; }
    const mp4 = path.join(FILM_DIR, slug, `${slug}.mp4`);
    if (!fs.existsSync(mp4) || fs.statSync(mp4).size < 10000) { noFilm.push(slug); continue; }
    fresh.push(slug);
  }

  console.log(`\n风格 ${all.length} 个  |  已蒸馏且未变 ${fresh.length}  |  待处理 ${never.length + changed.length + noFilm.length}\n`);
  if (never.length) console.log(`  未蒸馏（新纳入）：${never.join(', ')}`);
  if (changed.length) {
    console.log(`  源码已变更（需重新蒸馏）：`);
    for (const c of changed) console.log(`    ${c.slug}  ${c.from}… → ${c.to}…`);
  }
  if (noFilm.length) console.log(`  缺成片：${noFilm.join(', ')}`);
  if (!never.length && !changed.length && !noFilm.length) console.log('  全部已蒸馏且指纹未变 —— 无待办。');
  console.log('');
  // ★ --backfill：把「已有成片但 state 里没记指纹」的风格补上指纹。
  //   用途：出片循环是在加指纹字段**之前**启动的，跑完不会自动写 fp；跑一次 --backfill 即可补平，
  //   之后 `plan` 才能真正区分「已蒸馏且未变」与「新纳入」。
  if (argv.includes('--backfill')) {
    let n = 0;
    for (const slug of [...never, ...noFilm]) {
      const mp4 = path.join(FILM_DIR, slug, `${slug}.mp4`);
      if (!fs.existsSync(mp4) || fs.statSync(mp4).size < 10000) continue;
      st.styles[slug] = { ...(st.styles[slug] || {}), fp: fp.get(slug) || null, fpBackfilledAt: new Date().toISOString() };
      n++;
    }
    if (n) { saveState(st); console.log(`  已为 ${n} 个风格补写源码指纹。\n`); }
    else console.log('  没有可补写的风格。\n');
  }
  return { never, changed, noFilm, fresh };
}

function run(cmd, args, { cwd, timeoutMs = 1800000, logFile } = {}) {
  return new Promise((resolve) => {
    const out = fs.openSync(logFile, 'a');
    const child = spawn(cmd, args, { cwd, windowsHide: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
    let tail = '';
    const keep = (b) => { const s = b.toString('utf8'); fs.writeSync(out, s); tail = (tail + s).slice(-4000); };
    child.stdout?.on('data', keep);
    child.stderr?.on('data', keep);
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); fs.closeSync(out); resolve({ code: -1, tail, error: String(e.message || e) }); });
    child.on('close', (code) => { clearTimeout(timer); fs.closeSync(out); resolve({ code, tail }); });
  });
}

// ── render：顺序出片 ──────────────────────────────────────────
async function doRender() {
  const slugs = pickSlugs();
  const st = loadState();
  fs.mkdirSync(LOGS, { recursive: true });

  console.log(`\n顺序出片：${slugs.length} 个风格（${OPT.skipSync ? '--skip-sync' : '含库同步'}）\n`);
  let first = true;
  const t00 = Date.now();

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const tag = `[${String(i + 1).padStart(2, '0')}/${slugs.length}]`;
    const mp4 = path.join(FILM_DIR, slug, `${slug}.mp4`);
    const prev = st.styles[slug] || {};

    if (!OPT.force && prev.render === 'ok' && fs.existsSync(mp4) && fs.statSync(mp4).size > 10000) {
      console.log(`${tag} ${slug}  —— 跳过（已有成片 ${(fs.statSync(mp4).size / 1048576).toFixed(1)}MB）`);
      continue;
    }

    // 第一个风格默认带上库同步（确保 WSL→Windows 的字体/素材齐），之后 --skip-sync 省时间
    const skipSync = OPT.skipSync || (!first && !OPT.skipSync);
    const args = ['lemo-make.mjs', slug];
    if (OPT.skipSync || !first) args.push('--skip-sync');
    // ★★ 2026-10-04 修：**必须显式传原生比例 16:9**，不能落编排器的产品默认 9:16。
    //   原因（实测踩过）：编排器 `--ratio` 的默认是 **9:16**（那是给「交付」的产品默认），
    //   而这里产出的是**风格样板片**，全库原生是 **1920×1080**。
    //   不传 ⇒ 10 个重渲的风格被渲成 1080×1920，其中 **9 个风格源码里根本没有 `aspects` 声明**
    //   （本库语义：`FILM_META.aspects` **不写 = 只支持 16:9**，见 `engraving/demo/film.js:35-39`）
    //   ⇒ 渲出了**该风格并不支持**的画幅（画面按 9:16 排不出来）。原本 43 部里 33 部是 1920×1080，
    //   只有被本脚本重渲的那 10 部变成了 1080×1920 —— 一套样板片画幅不一致。
    //   ⇒ 样板片一律 16:9；要出 9:16 交付片是**另一条通路**（控制台/`--ratio 9:16`）。
    args.push('--ratio', '16:9');
    args.push('--no-preflight', ...OPT.extra);
    first = false;

    const logFile = path.join(LOGS, `${slug}.log`);
    fs.writeFileSync(logFile, `# ${new Date().toISOString()}  node ${args.join(' ')}\n`, 'utf8');
    const t0 = Date.now();
    process.stdout.write(`${tag} ${slug}  … 渲染中（日志 ${path.basename(logFile)}）`);
    const r = await run(process.execPath, args, { cwd: ROOT, logFile });
    const ms = Date.now() - t0;
    const okMp4 = fs.existsSync(mp4) && fs.statSync(mp4).size > 10000;
    const status = (r.code === 0 && okMp4) ? 'ok' : 'failed';

    st.styles[slug] = {
      ...prev,
      render: status,
      renderMs: ms,
      renderAt: new Date().toISOString(),
      exitCode: r.code,
      mp4: okMp4 ? mp4 : null,
      mp4Bytes: okMp4 ? fs.statSync(mp4).size : 0,
      renderLog: logFile,
      renderErr: status === 'failed' ? (r.error || r.tail.split('\n').filter(Boolean).slice(-6).join(' | ')) : null,
      // ★ 蒸馏时的源码指纹 —— `plan` 靠它发现「新风格 / 源码改过的风格」
      // ★★ 2026-10-04 修：**只在渲染成功时写**。此前是**无条件写** ⇒ 渲染**失败**也把「当前指纹」
      //   记成「已蒸馏」，于是 `plan` 把失败报成「已蒸馏且未变」—— **失败对 plan 不可见**，
      //   而成片其实仍是旧源渲的。实测：10 风格重渲首轮有 4 个失败（音频链问题），
      //   跑完 `plan` 仍报「待处理 0」，是靠读渲染汇总才发现失败的。
      //   失败时记 `null` ⇒ `plan` 会把它报成「未蒸馏 / 待处理」⇒ 如实可见（符合「如实报告」纪律）。
      fp: status === 'ok' ? ((await currentFingerprints()).get(slug) || null) : null,
    };
    saveState(st);

    console.log(status === 'ok'
      ? `  ✔ ${(ms / 1000).toFixed(1)}s  ${(st.styles[slug].mp4Bytes / 1048576).toFixed(1)}MB`
      : `  ✘ ${(ms / 1000).toFixed(1)}s  exit=${r.code}  ${String(st.styles[slug].renderErr).slice(0, 200)}`);
  }

  // ★★ 2026-10-04 修（措辞自相矛盾）：分子原先统计的是 **全库** `st.styles` 里 `render==='ok'` 的条数，
  //   而分母是**本次选择**的风格数 ⇒ 会打出 `ok 40 / 10`（第 2 轮实测甚至 `ok 43 / 3`），
  //   读起来像「10 个里成功了 40 个」。⇒ 分子现在只数**本次选择的**那些。
  //   ★ 同时**点名失败项**：本脚本「失败不阻断」是设计（继续跑完其余），但「不阻断」不该等于「看不见」——
  //   实测发生过「4 个失败、`plan` 仍报待处理 0」的静默（失败会写指纹，见上面 fp 的说明）。
  const sel = slugs.filter((s) => st.styles[s]);
  const ok = sel.filter((s) => st.styles[s].render === 'ok').length;
  const bad = slugs.filter((s) => !st.styles[s] || st.styles[s].render !== 'ok');
  console.log(`\n出片汇总：ok ${ok} / ${slugs.length}，总耗时 ${((Date.now() - t00) / 60000).toFixed(1)} 分钟`);
  if (bad.length) {
    console.log(`  ✘ 未成功 ${bad.length} 个：${bad.join(', ')}`);
    console.log('    （失败不阻断是设计，但请**逐条看上面的错误**；重跑用 `--only <这些slug>`）');
  }
  console.log('');
}

// ── frames：抽帧 + 接触印样 ────────────────────────────────────
// 逐帧「一帧一帧」地看 43 部片子不现实（成片 30fps × 几十秒 = 上千帧），
// 所以分两层：① 等间隔抽 24 帧单图（够做逐帧细节核对）；② 拼一张接触印样（一眼看全片节奏）。
async function doFrames() {
  const slugs = pickSlugs();
  const st = loadState();
  let done = 0;
  for (const slug of slugs) {
    const mp4 = path.join(FILM_DIR, slug, `${slug}.mp4`);
    if (!fs.existsSync(mp4)) { console.log(`  ${slug} —— 没有成片，跳过`); continue; }
    const dir = path.join(FRAMES, slug);
    const sheet = path.join(dir, '_contact.jpg');
    if (!OPT.force && fs.existsSync(sheet)) { done++; continue; }
    fs.mkdirSync(dir, { recursive: true });

    // ① 等间隔 24 帧（按片长自动算 fps）
    const dur = await probeDur(mp4);
    const n = 24;
    const fps = dur > 0 ? Math.max(0.05, n / dur) : 1;
    let r = await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-i', mp4,
      '-vf', `fps=${fps.toFixed(4)},scale=360:-2`, '-q:v', '3',
      path.join(dir, 'f%02d.jpg')], { logFile: path.join(LOGS, `${slug}.frames.log`) });
    // ② 接触印样：6×4
    r = await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-i', mp4,
      '-vf', `fps=${fps.toFixed(4)},scale=320:-2,tile=6x4`, '-frames:v', '1', '-q:v', '3', sheet],
      { logFile: path.join(LOGS, `${slug}.frames.log`) });

    const nFrames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg') && !f.startsWith('_')).length;
    st.styles[slug] = { ...(st.styles[slug] || {}), frames: nFrames > 0 ? 'ok' : 'failed', framesDir: dir, frameCount: nFrames, durSec: dur };
    saveState(st);
    if (nFrames > 0) done++;
    console.log(`  ${slug}  ${dur.toFixed(1)}s → ${nFrames} 帧 + 接触印样  ${nFrames > 0 ? '✔' : '✘'}`);
  }
  console.log(`\n抽帧汇总：${done}/${slugs.length}\n`);
}

function probeDur(mp4) {
  return new Promise((resolve) => {
    const c = spawn(FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe'),
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { windowsHide: true });
    let o = '';
    c.stdout.on('data', (d) => { o += d; });
    c.on('close', () => resolve(Number(String(o).trim()) || 0));
    c.on('error', () => resolve(0));
  });
}

// ── status ────────────────────────────────────────────────────
function doStatus() {
  const st = loadState();
  const all = allSlugs();
  const rows = all.map((s) => ({ slug: s, ...(st.styles[s] || {}) }));
  const nRenderOk = rows.filter((r) => r.render === 'ok').length;
  const nFramesOk = rows.filter((r) => r.frames === 'ok').length;
  console.log(`\n风格总数 ${all.length}  |  出片 ok ${nRenderOk}  |  抽帧 ok ${nFramesOk}`);
  console.log(`state: ${STATE}  (updated ${st.updated || 'never'})\n`);
  for (const r of rows) {
    const mark = r.render === 'ok' ? '✔' : r.render === 'failed' ? '✘' : '·';
    const f = r.frames === 'ok' ? `${String(r.frameCount).padStart(2)}帧` : '  --';
    const sec = r.durSec ? `${r.durSec.toFixed(1)}s` : '   --';
    const mb = r.mp4Bytes ? `${(r.mp4Bytes / 1048576).toFixed(1)}MB` : '  --';
    console.log(`  ${mark} ${r.slug.padEnd(20)} ${f} ${sec.padStart(7)} ${mb.padStart(8)}${r.renderErr ? '   ' + String(r.renderErr).slice(0, 90) : ''}`);
  }
  console.log('');
}

// ── main ──────────────────────────────────────────────────────
if (CMD === 'render') await doRender();
else if (CMD === 'frames') await doFrames();
else if (CMD === 'plan') await doPlan();
else if (CMD === 'status') doStatus();
else { console.log('用法: node scripts/style-distill.mjs plan|render|frames|status [--force] [--only a,b]'); process.exit(2); }
