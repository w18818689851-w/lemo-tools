#!/usr/bin/env node
/**
 * scripts/unblock-placeholder-audio.mjs —— 给「因缺源音源而跑不出片」的风格补一个**技术占位音床**
 *
 * ★ 依据项目约定七（用户 2026-10-03 明确要求，最高优先级）：
 *   · **禁止因版权拦截中断任务** —— 缺商业版权音源时不许停下来等；
 *   · **禁止在生成阶段直接替换** —— 不许顺手拿一首别的曲子顶上就当作完成；
 *   · 生成阶段的正确做法：用**最小技术占位**把链路跑通，产出**克隆成果**；
 *     「相似风格替换」是**单独的下一个步骤**。
 *
 * 所以本脚本只做两件事，都不涉及任何"选曲"判断：
 *   ① 如果该 demo **自带**的合成脚本能自己产出音源（如 halftone-dossier 的 `music.py`，纯代码合成、
 *      无第三方素材）→ **跑它**（这不是替换，这就是它自己的音频链）；
 *   ② 否则 → 生成一条**纯静音**音床（长度对齐成片），让编排器能完成混流。
 *
 * 产物：`styles/<slug>/demo/mix.wav`（编排器 --skip-audio 时会在 $D/mix.wav 探测到它）
 *      两边副本都写（Windows + WSL）。
 *
 * ★★ 2026-10-03 核实更正（重要）：下面 TARGETS 表里原先把 `brick-toy` / `hd-2d` 的配乐写成
 *   「**商业版权曲**」——**这是错的**。逐条核对 `demo/CREDITS` 后确认：
 *     · brick-toy：Kevin MacLeod「Monkeys Spinning Monkeys」「Heroic Age」= **CC BY 4.0**（署名即可商用）
 *     · hd-2d：Scott Buckley「Precipice」= **CC BY 4.0**
 *     · paper-popup：Kevin MacLeod 三首 = **CC BY 4.0**；watercolor：Scott Buckley「Wildflowers」= **CC BY 4.0**
 *   它们只是被 .gitignore 排除（规则：styles 下 demo 目录里的 mp3 / wav）**只落本地**，不是版权障碍；
 *   各风格 CREDITS 已署名，且**署名已进片**（片尾卡）。
 *   ⇒ 因此「缺商业版权音源」这个前提对上述风格**不成立**；本脚本对它们做静音占位只是
 *     「生成阶段不中断」的技术兜底，**不代表存在版权问题**，也**不意味着必须做「相似风格替换」**。
 *     真要重跑，按各自 CREDITS 里记的**官方直链**取源即可（2026-10-03 实测直链均 HTTP 200）。
 * 用法：node scripts/unblock-placeholder-audio.mjs [--dry] [--only a,b]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const WIN = 'D:/lemo-opuscar';
const WSL = '/home/lemo/lemo-opuscar';
const DISTRO = 'Ubuntu-24.04';
const FFMPEG = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const FFPROBE = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffprobe.exe';
const FILM_DIR = 'D:/lemo-films';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const only = (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

// 目标风格：selfSynth = demo 自带的纯代码合成脚本（相对 demo/），跑它就行；没有则用静音占位。
const TARGETS = [
  { slug: 'halftone-dossier', selfSynth: 'music.py', note: '自带 music.py（纯 numpy/scipy 合成，无第三方素材）—— 跑它即可，不属于版权问题' },
  { slug: 'brick-toy', placeholder: true, missing: 'Monkeys_Spinning_Monkeys.mp3 / Heroic_Age.mp3（**CC BY 4.0，非商业版权**；被 .gitignore 排除只落本地，直链在 demo/CREDITS）' },
  { slug: 'hd-2d', placeholder: true, missing: 'music/src/sb_precipice.mp3（**CC BY 4.0，非商业版权**；被 .gitignore 排除只落本地，直链在 demo/CREDITS 与 DEMO.md）' },
  { slug: 'game-show', placeholder: true, missing: 'voices/*.wav（原作用 macOS `say` 生成，本机无 macOS）' },
  { slug: 'paper-lantern', placeholder: true, missing: 'vo/*.wav（原 demo 的 `tts.py` 走 **edge-tts 云端** TTS —— 与「禁云端 TTS、用本地 Index-TTS」硬规则冲突，生成阶段不跑它）' },
  { slug: 'paper-popup', placeholder: true, missing: 'Dreamy_Flashback.mp3 等三首（Kevin MacLeod，**CC BY 4.0**；mp3 被 .gitignore 排除，直链在 demo/CREDITS）' },
  { slug: 'pictogram-motion', placeholder: true, missing: '无 mix.py/sound.py —— 该 demo 用「自己拼段 + 混音」的另一套音频架构，编排器不支持（编排器注释里已登记为已知缺口）' },
  { slug: 'watercolor', placeholder: true, missing: 'Wildflowers.mp3（Scott Buckley，**CC BY 4.0**；直链在 demo/CREDITS）+ 派生的 wf48.wav（仓库不含）' },
];

function sh(cmd, args, opts = {}) {
  return new Promise((r) => {
    const c = spawn(cmd, args, { windowsHide: true, ...opts });
    let o = '', e = '';
    c.stdout.on('data', (d) => { o += d; });
    c.stderr.on('data', (d) => { e += d; });
    c.on('close', (code) => r({ code, o, e }));
    c.on('error', (x) => r({ code: -1, o, e: String(x.message) }));
  });
}

function dur(mp4) {
  return new Promise((resolve) => {
    const c = spawn(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { windowsHide: true });
    let o = '';
    c.stdout.on('data', (d) => { o += d; });
    c.on('close', () => resolve(Number(String(o).trim()) || 0));
    c.on('error', () => resolve(0));
  });
}

/** 把 Windows 侧文件推到 WSL 侧同名路径。
 *  ★ 用 WSL 侧的 `cp /mnt/d/...`（**不要**用 `printf <base64> | base64 -d > ...`）：
 *    后者在本机沙箱里会被拦（实测 `spawn wsl.exe` 返回 EPERM），且长 base64 走 argv 也不稳。
 *    同一棵树在 WSL 里就是 /mnt/d/...，直接 cp 最稳。 */
async function pushToWsl(winPath) {
  const rel = path.relative(WIN, winPath).replace(/\\/g, '/');
  const src = `/mnt/${WIN[0].toLowerCase()}${WIN.slice(2)}/${rel}`;
  const r = await sh('wsl.exe', ['-d', DISTRO, '-u', 'root', '-e', 'bash', '-c',
    `mkdir -p "$(dirname ${WSL}/${rel})" && cp -f "${src}" "${WSL}/${rel}" && ls -la "${WSL}/${rel}"`]);
  return { ok: r.code === 0, rel, out: String(r.o) };
}

const list = TARGETS.filter((t) => !only.length || only.includes(t.slug));
console.log(`\n占位/自合成解阻 ${list.length} 个风格${DRY ? '（--dry）' : ''}\n`);

for (const t of list) {
  const demoWin = path.join(WIN, 'styles', t.slug, 'demo');
  const mixWin = path.join(demoWin, 'mix.wav');
  const mp4 = path.join(FILM_DIR, t.slug, `${t.slug}.mp4`);
  if (!fs.existsSync(demoWin)) { console.log(`  ✘ ${t.slug}：找不到 ${demoWin}`); continue; }

  if (t.selfSynth) {
    // ── ① 跑 demo 自带的合成脚本 ──
    const scriptWsl = `${WSL}/styles/${t.slug}/demo/${t.selfSynth}`;
    if (DRY) { console.log(`  ~ ${t.slug}：将跑自带 ${t.selfSynth}（${t.note}）`); continue; }
    const r = await sh('wsl.exe', ['-d', DISTRO, '-u', 'root', '-e', 'bash', '-c',
      `cd ${WSL} && .venv/bin/python ${scriptWsl} ${WSL}/styles/${t.slug}/demo/mix.wav 2>&1 | tail -3; echo "EXIT=$?"; ls -la ${WSL}/styles/${t.slug}/demo/mix.wav`]);
    const okRun = /mix\.wav/.test(String(r.o)) && !/No such|Traceback/.test(String(r.o));
    // 回传 Windows 侧
    const back = await sh('wsl.exe', ['-d', DISTRO, '-u', 'root', '-e', 'bash', '-c',
      `cp -f ${WSL}/styles/${t.slug}/demo/mix.wav ${WIN.replace('D:', '/mnt/d')}/styles/${t.slug}/demo/mix.wav && echo CP_OK`]);
    console.log(`  ${okRun && String(back.o).includes('CP_OK') ? '✔' : '✘'} ${t.slug}  自带 ${t.selfSynth} → mix.wav`);
    if (!okRun) console.log(`      ${String(r.o).slice(-300)}`);
    continue;
  }

  // ── ② 静音占位音床（长度对齐成片；成片还没出就用渲染中间产物；都没有才兜底 40s）──
  //   ★ 为什么优先看 `demo/out/video_gpu.mp4`：这些风格恰恰是「画面渲染成功、音频链挂掉」，
  //     成片不存在但渲染中间产物在 —— 用它的真实时长才能让 -shortest 不切帧。
  const mid = path.join(demoWin, 'out', 'video_gpu.mp4');
  const src = fs.existsSync(mp4) ? mp4 : (fs.existsSync(mid) ? mid : null);
  const d = src ? await dur(src) : 0;
  // ★ 占位音床一律取「画面时长 + 1 秒」，**不要**取精确的画面时长。
  //   实测教训（2026-10-03）：取精确时长时，`AD < VD` 的浮点比较常常不成立 ⇒ core/render/mux.sh
  //   的「补静音到画面+一帧」不触发 ⇒ `-shortest` 又切掉最后一帧 ⇒ 编排器判
  //   `MUX_FAIL 帧数不符：渲染 2922 帧，成片 2921 帧`（paper-lantern / paper-popup /
  //   pictogram-motion 三个风格都栽在这上面）。
  //   音频**比画面长**是安全的：`-shortest` 会在画面结束处停下，帧数正好等于渲染帧数。
  const secs = d > 0.5 ? d + 1.0 : 180;
  if (DRY) { console.log(`  ~ ${t.slug}：将生成静音占位 ${secs.toFixed(2)}s → mix.wav（缺：${t.missing}）`); continue; }
  const r = await sh(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-f', 'lavfi',
    '-i', 'anullsrc=r=48000:cl=stereo', '-t', secs.toFixed(3), '-c:a', 'pcm_s16le', mixWin]);
  if (r.code !== 0 || !fs.existsSync(mixWin)) { console.log(`  ✘ ${t.slug}：生成静音失败 ${String(r.e).slice(0, 200)}`); continue; }
  const p = await pushToWsl(mixWin);
  console.log(`  ${p.ok ? '✔' : '✘'} ${t.slug}  静音占位 ${secs.toFixed(2)}s → mix.wav  （缺：${t.missing}）`);
}
console.log('\n★ 生成阶段到此为止 —— **不做任何替换**。\n'
  + '★ 2026-10-03 核实结论：上表里**没有一个是「商业版权障碍」** —— brick-toy / hd-2d / paper-popup / watercolor 的曲目全是 **CC BY 4.0（署名即可商用）**且署名已进片；game-show 是**平台**问题（本机无 macOS say）；paper-lantern 是**云端 TTS 与本地 TTS 硬规则冲突**；pictogram-motion 是**架构**问题。\n'
  + '  ⇒ **「相似风格替换」在法律上并不必要**；真要重跑，按各自 CREDITS 里的官方直链取源即可。\n');
