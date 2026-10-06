#!/usr/bin/env node
// dub.mjs —— 「自定义文案 → 成片」（与 lemo-make.mjs 并列的另一类产出）
//
//   形态 A：只给文案            → 画面用生成的渐变背景（或 --bg 图）
//   形态 B：文案 + 一段口播视频 → 画面用用户那段视频
//
// 与既有流水线的区别：那套是「选风格 → 按风格的内容文件出片」（画面主体写死在风格里）；
// 本工具**用户给什么文案就念什么**，画面只来自用户素材或一张背景。
//
//   node D:/lemo-tools/dub.mjs --script <文件路径|-> [选项]
//
// 用法：node dub.mjs --help
//
// 关键环境事实（实测，不要改）：
//   · 配音：本机 Index-TTS 2.5 便携版，**必须在 WSL 里跑**（脚本自重入到 Windows venv）：
//       wsl -d Ubuntu-24.04 -e bash -lc 'cd /home/lemo/lemo-opuscar && .venv/bin/python \
//         core/tts/tts_indextts.py <lines.json> <out_dir>'
//     一次进程批量合成全部句子（模型只加载一次，首载 1~2 分钟是正常的）。
//   · ffmpeg 只在 WSL 里有（6.1.1，带 libass + h264_nvenc）；Windows git-bash 没有。
//   · 编码器由环境变量 LEMO_VENC 下发（用户硬规则：渲染一律本地 GPU 优先）：
//       未设 ⇒ h264_nvenc（RTX 4060）；显式 libx264 ⇒ CPU；其它值 ⇒ 报错退出，绝不静默回落。
//   · 产物全部写非 C 盘。

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CFG, run, runWsl, shq, winToWsl,
  splitSentences, buildTimeline, buildSrt, buildAss, probe, measure,
  TARGET_PEAK_PCM, TARGET_LUFS, HARD_PEAK_LIMIT,
  PLAIN_DARK, loadStyleRegistry, resolveStyle, listStyles, styleSpec, bgSource, bgFilters,
  parseSrt, alignCuesToSentences, buildItemsFromSpans, distributeByProportion, detectSpeech,
  alignByAsr, styleIdsFromRegistry, STYLES_FILE, loadSemantic, charsPerLine,
} from './lib/dub-core.mjs';
// ★ 风格特质档案（style-dna）—— 出片链路此前**零消费者**，这里把它接进来（可选增强）。
import { readStyleDna, summarizeStyleDna, describeStyleDna } from './lib/style-dna-reader.mjs';
import { readStyleSkill, summarizeStyleSkill, describeStyleSkill } from './lib/style-skill-reader.mjs';
// ★ 出片前的显存预检 + 自动腾挪（见 lib/vram.mjs）。TTS 之前必须问一句「显存够不够」：
//   本项目的真实事故是「LM Studio 常驻模型把显存吃到 7GB ⇒ Index-TTS 静默挂死一个多小时」，
//   而 dub 的 TTS 在 WSL 里跑，INDEXTTS_MIN_FREE_MIB 传不进那个 Windows python（已实测），
//   所以「腾显存」这一步**只能在这里做** —— 否则从 dub 路径唯一的出路就是人工腾。
import { ensureVramFree } from './lib/vram.mjs';

// ── 小工具 ──────────────────────────────────────────────────────
const C = process.stdout.isTTY
  ? { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', c: '\x1b[36m', b: '\x1b[1m', d: '\x1b[2m', x: '\x1b[0m' }
  : { r: '', g: '', y: '', c: '', b: '', d: '', x: '' };
const say = (...a) => console.log(...a);
const step = (n, s) => say(`\n${C.b}[${n}]${C.x} ${s}`);
const warn = (s) => say(`${C.y}⚠ ${s}${C.x}`);
const bad = (s) => say(`${C.r}✗ ${s}${C.x}`);
const ok = (s) => say(`${C.g}✓${C.x} ${s}`);
const die = (s) => { bad(s); process.exit(1); };
const f3 = (n) => Number(n).toFixed(3);
const f2 = (n) => Number(n).toFixed(2);

// ── 视频编码器（用户硬规则：渲染一律本地 GPU 优先）─────────────────────
// ★ 口径与 core/render/video.mjs / core/render/mux.sh / styles/*/demo/tools/video_png.mjs
//   **逐字一致**，照抄同一形状，别在这里自创：
//     未设 LEMO_VENC ⇒ h264_nvenc（GPU）；显式 libx264 ⇒ CPU；其它值 ⇒ 报错退出，绝不静默回落 CPU
//     （把 h264_nvenc 打成 h264_nven 会以为在用显卡、实际走 CPU）。
// ★ 本文件是「文案+口播+风格」通路的出片路径，**唯一**的编码器决策点就在这——下面两处混流命令
//   都从这里取 VARG，别再往命令里硬写编码器名（闸门 scripts/check-render-venc.mjs 会扫这里）。
const VENC = process.env.LEMO_VENC || 'h264_nvenc';
if (VENC !== 'h264_nvenc' && VENC !== 'libx264') {
  die(`LEMO_VENC must be h264_nvenc or libx264, or unset (which means h264_nvenc, the GPU encoder), got '${VENC}'. Refusing to fall back to the CPU encoder silently.`);
}
const VARG = VENC === 'h264_nvenc'
  ? '-c:v h264_nvenc -preset p5 -rc vbr -cq 21 -b:v 0 -pix_fmt yuv420p'
  : '-c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p';

function sanitizeName(s) {
  return String(s).replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 60) || 'dub';
}

const USAGE = `dub.mjs —— 把一段自定义文案做成成片（可选配一段口播素材）

用法:
  node dub.mjs --script <文件路径|->  [选项]

必填:
  --script <file|->        文案。'-' = 从 stdin 读。

选项:
  --video <mp4>            口播素材。不给就走形态 A（生成背景）。
  --bg <image>             形态 A 的背景图。不给就用内置渐变背景。
                           ★ 与 --video 复用**同一条**画面链：保持比例、居中裁切到 --size
                             （scale=...:force_original_aspect_ratio=increase, crop=W:H），
                             不是独立实现；要改画面几何，改那一处即可。
                           字体：运行时自动把系统的 Microsoft YaHei（msyh.ttc）复制到
                           D:/lemo-films/dub/_fonts 供 libass 使用；找不到则依次退到
                           SimHei / WSL 自带的文泉驿正黑（项目里的 .woff2 libass 不认）。
  --voice <name>           音色，默认 zh_kepu9。
  --speed <n>              语速 0.5–2.0，默认 1.1。
  --ratio <spec>           输出宽高比：9:16（默认）| 16:9 | 3:4 | 4:3 | 1:1
  --size <WxH>             输出像素尺寸，如 1080x1920（自定义）。优先级高于 --ratio
                           ★ 两个都不给时用默认比例 9:16（任务没指定尺寸时的默认值）。
                           比例→像素的换算见 core/render/size.mjs（唯一来源，本文件不另写一份）
  --gap <sec>              句间停顿，默认 0.25。
  --fit loop|trim|slow     素材与配音时长不匹配时怎么办，默认 loop。
  --keep-original-audio    保留素材原声（压到很低的背景音量）。默认不保留。
  --style <id|auto>        视觉风格。不给 = 现有行为逐帧不变（plain-dark）。
                           auto = 按文案语义自动匹配（调 lib/dub-semantic.mjs）。
                           具体 id 见 lib/dub-styles.json（注册表缺失时退回基线并告警）。
  --analysis <file>        外部（WorkBuddy 智能体）提供的语义解析结果 JSON，形状
                           {theme,emotion,pace,scene,styleId,segments}。给了就用作
                           --analyze / --style auto 的输入（source=external）。
                           ★ 不给 = 纯规则路（source=rules）—— 这是**正常默认**，
                             不是"降级"：按用户模型路由规则，通用语义推理归 WorkBuddy，
                             本地 7B 不得用于此类任务，所以本工具**永不**自动调本机模型。
  --analyze                只跑语义解析并打印结果（segments/theme/emotion/pace/
                           scene/styleId/scores），然后退出（干跑，不出片）。
  --verify-triple          ★ 三者一致性校验门：抽帧后把「帧图 + 该时刻字幕文本 + 原文案」
                           交给 qwen2.5-vl-7b-official 判定是否一致，输出 triple-check.json。
                           这是规则 2 允许 7B 的唯一用途，**只在显式给本参数时才加载 7B**；
                           出片流程任何其他分支都不会碰它。跑完自动卸载 7B 释放显存。
  --film <mp4>             配 --verify-triple：直接校验这个**已有成片**（不重新出片）。
  --keep-original          ★ 保留口播原声原画：不跑 TTS、不动素材的时长/画面/声音，
                           只在素材上叠风格化字幕与叠加层。成片时长 = 素材时长。
  --keep-original-limit    ★ 在 --keep-original 下把音轨**限幅**到交付线（只压峰，不动时长/
                           画面/内容）。默认关：关时音轨 -c:a copy、与素材**逐字节相同**；
                           开时音轨**重编码 + 限幅**（不再是逐字节原声）。素材自身真峰值
                           超标（> 交付线）时才需要它。
  --srt <file>             --keep-original 下可选：用给定 SRT 当字幕时间轴。
                           ★ 对齐按「文案每句 ↔ 一段连续 cue」匹配，切成首尾相接、
                             无空档的区间；单条短于可读下界（字/秒）时向后借时间。
                           不给则依次退：ASR 强制对齐 → VAD 切段 → 均匀分配。
  --title <text>           可选片头标题（居中偏上，淡入淡出）。
  --out <dir>              输出目录。默认 D:/lemo-films/dub/<文案文件名或时间戳>。
  --dry-run                只打印计划与时间轴，不做重活。
  --echo-cmd               把每次下发到 WSL 的 bash 脚本也打出来（排障用）。
  -h, --help               本帮助。

产物（写进 --out）:
  film.mp4  film.srt  lines.json  dur.json  timeline.json
`;

// ── 输出尺寸注册表：**只读**代理到库 ──────────────────────────────
// ★ 与 lib/sizes.mjs（控制台侧只读代理）同一条纪律：比例清单与「比例→像素」换算的
//   唯一权威来源是 **库里的** D:\lemo-opuscar\core\render\size.mjs。
//   本文件绝不另维护一份比例表，否则库里改了比例、这里还认老的 —— 判据写两处必然漂移。
//   这与风格链路 lemo-make.mjs 的做法一致（同样动态 import 那个文件）。
// ★ 读不到库（老库 / 路径不对）时退回内置最小表并**明确告警**，不静默降级：
//   dub.mjs 不会因为库没就位而起不来，但也不会假装一切正常。
const FALLBACK_SIZE_MOD = {
  RATIOS: [{ id: '9:16' }, { id: '16:9' }, { id: '3:4' }, { id: '4:3' }, { id: '1:1' }],
  DEFAULT_RATIO: '9:16',
  // 自定义像素的上下限：**只在读不到库时**用（正常路径直接取库侧 MIN_SIZE / MAX_SIZE）。
  // 下限 96 与库当前值一致（16 是编造的，实测 ≤72 必崩）。改下限只改库，这里不会各说各话。
  MIN_SIZE: 96, MAX_SIZE: 8192,
  parseSizeSpec(s) {
    const v = String(s ?? '').trim();
    const m = /^(\d+)\s*:\s*(\d+)$/.exec(v);
    if (m) return FALLBACK_SIZE_MOD.RATIOS.some((r) => r.id === `${+m[1]}:${+m[2]}`) ? { ratio: `${+m[1]}:${+m[2]}` } : null;
    const q = /^(\d+)\s*[xX]\s*(\d+)$/.exec(v);
    return q ? { w: +q[1], h: +q[2] } : null;
  },
  resolveSize({ ratio, size, base = 1920 } = {}) {
    let spec = size ?? ratio;               // size 优先（下面要改写，必须是 let）
    if (spec == null || spec === '') spec = FALLBACK_SIZE_MOD.DEFAULT_RATIO;
    const pp = FALLBACK_SIZE_MOD.parseSizeSpec(spec);
    if (!pp) return null;
    const even = (n) => 2 * Math.round(n / 2);
    const ok = (n) => Number.isInteger(n) && n >= FALLBACK_SIZE_MOD.MIN_SIZE && n <= FALLBACK_SIZE_MOD.MAX_SIZE;
    if (pp.w != null) return ok(pp.w) && pp.w % 2 === 0 && ok(pp.h) && pp.h % 2 === 0 ? { w: pp.w, h: pp.h } : null;
    const [a, b] = pp.ratio.split(':').map(Number), s = base / Math.max(a, b);
    const w = even(a * s), h = even(b * s);
    return ok(w) && ok(h) ? { w, h } : null;
  },
};

let _sizeMod;
async function loadSizeModule() {
  if (_sizeMod !== undefined) return _sizeMod;
  const p = path.join(CFG.winLib, 'core', 'render', 'size.mjs');
  let M = null;
  try { if (fs.existsSync(p)) M = await import(pathToFileURL(p).href); }
  catch (e) { warn(`读 core/render/size.mjs 失败：${String(e?.message || e).split('\n')[0]} —— 用内置表兜底`); }
  if (M && Array.isArray(M.RATIOS) && M.RATIOS.length && typeof M.resolveSize === 'function') {
    _sizeMod = M;
  } else {
    if (M) warn('core/render/size.mjs 里没有导出 RATIOS / resolveSize —— 用内置表兜底');
    _sizeMod = FALLBACK_SIZE_MOD;
  }
  return _sizeMod;
}

// ── 参数 ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = {
    script: null, video: null, bg: null, voice: 'zh_kepu9', speed: 1.1,
    size: null, ratio: null, gap: 0.25, fit: 'loop', keepOriginalAudio: false,
    title: '', out: null, dryRun: false, echo: false, help: false,
    style: null, analyze: false, keepOriginal: false, srt: null,
    keepOriginalLimit: false,
    analysis: null, verifyTriple: false, film: null,
  };
  const need = (i, k) => { if (i + 1 >= argv.length) die(`${k} 需要一个值`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], inline = null;
    const eq = a.indexOf('=');
    if (a.startsWith('--') && eq > 2) { inline = a.slice(eq + 1); a = a.slice(0, eq); }
    const val = () => (inline !== null ? inline : need(i, a) && (i++, argv[i]));
    switch (a) {
      case '-h': case '--help': o.help = true; break;
      case '--script': o.script = val(); break;
      case '--video': o.video = val(); break;
      case '--bg': o.bg = val(); break;
      case '--voice': o.voice = val(); break;
      case '--speed': o.speed = Number(val()); break;
      case '--size': o.size = val(); break;
      case '--ratio': o.ratio = val(); break;
      case '--gap': o.gap = Number(val()); break;
      case '--fit': o.fit = val(); break;
      case '--title': o.title = val(); break;
      case '--out': o.out = val(); break;
      case '--style': o.style = val(); break;
      case '--srt': o.srt = val(); break;
      case '--analysis': o.analysis = val(); break;
      case '--film': o.film = val(); break;
      case '--analyze': o.analyze = true; break;
      case '--verify-triple': o.verifyTriple = true; break;
      case '--keep-original': o.keepOriginal = true; break;
      case '--keep-original-limit': o.keepOriginalLimit = true; break;
      case '--keep-original-audio': o.keepOriginalAudio = true; break;
      case '--dry-run': o.dryRun = true; break;
      case '--echo-cmd': o.echo = true; break;
      default: die(`未知参数: ${a}（--help 看用法）`);
    }
  }
  return o;
}

// ── 字体（libass 不认 woff2，必须 ttf/otf/ttc）────────────────────
const FONT_FILES = {
  'Microsoft YaHei': ['msyh.ttc', 'msyhbd.ttc'],
  SimHei: ['simhei.ttf'],
  KaiTi: ['simkai.ttf'],
  SimKai: ['simkai.ttf'],
  SimSun: ['simsun.ttc'],
  DengXian: ['Deng.ttf'],
  Consolas: ['consola.ttf', 'consolab.ttf'],
};
const FONT_CANDIDATES = ['msyh.ttc', 'msyhbd.ttc', 'simhei.ttf', 'simkai.ttf', 'simsun.ttc', 'Deng.ttf', 'consola.ttf'];

/** 备好 fontsdir，并把风格点名的字体（能用就用）解析成实际可用族名 */
function prepareFonts(style) {
  const fontDir = path.join(CFG.outRoot, '_fonts');
  const want = (style && style.subtitle && style.subtitle.fontFamily) || CFG.fontFamily;
  let fontFamily = CFG.fontFamily;
  try {
    fs.mkdirSync(fontDir, { recursive: true });
    for (const f of FONT_CANDIDATES) {
      const s = path.join(CFG.winFontsDir, f), d = path.join(fontDir, f);
      if (fs.existsSync(s) && !fs.existsSync(d)) fs.copyFileSync(s, d);
    }
    const has = (name) => (FONT_FILES[name] || []).some((f) => fs.existsSync(path.join(fontDir, f)));
    if (has(want)) fontFamily = want;
    else if (fs.existsSync(path.join(fontDir, 'msyh.ttc'))) fontFamily = 'Microsoft YaHei';
    else if (fs.existsSync(path.join(fontDir, 'simhei.ttf'))) fontFamily = 'SimHei';
    else { fontFamily = 'WenQuanYi Zen Hei'; warn('没找到 msyh.ttc / simhei.ttf，退回 WSL 自带的文泉驿正黑'); }
    if (want !== fontFamily) warn(`风格点名字体 "${want}" 本机没有，退回 "${fontFamily}"`);
  } catch (e) {
    fontFamily = 'WenQuanYi Zen Hei';
    warn(`准备字体目录失败（${e.message}），退回 WSL 自带的文泉驿正黑`);
  }
  return { fontFamily, fontDirWsl: fs.existsSync(fontDir) ? winToWsl(fontDir) : CFG.wslFontsDir };
}

// ── 功能2：--keep-original ──────────────────────────────────────
// ★ 素材的画面与声音**一个字节都不动**：不 loop / 不 trim / 不 setpts / 不换音，
//   成片尺寸与帧率沿用素材，音频直接 -c:a copy。我们只往**上面**叠字幕与叠加层。
//   字幕时间轴：--srt → ASR 强制对齐 → VAD 切段按字数分配 → 整体均匀分配。
//
// ★ 可选开关 --keep-original-limit（默认关）：素材**自身**真峰值就超交付线时（-c:a copy
//   会把它原样带进成片），开这个开关把音轨**重编码 + 限幅**到 TARGET_PEAK_PCM，只压峰，
//   不动时长/画面/内容。代价是音轨**不再是逐字节原声**（所以默认关 —— 关时与加它之前逐字节一致）。
//   限幅口径与形态1 完全一致（alimiter=limit=…dB:level=disabled，level=disabled = 只压峰不改电平）。
async function runKeepOriginal(ctx) {
  const { o, outDir, outWsl, videoHost, lines, style, sem } = ctx;
  const srcWsl = winToWsl(videoHost);
  const texts = lines.map((L) => L.text);

  step(1, '功能2：保留口播原声原画（--keep-original）');
  const p = await probe(srcWsl);
  if (!p.dur || !p.w || !p.h) die('探不到素材的时长/尺寸，--keep-original 无法工作');
  const srcDur = p.dur, W = p.w, H = p.h;
  say(`  素材  ${W}x${H} · ${f3(p.fps)}fps · ${f3(srcDur)}s · 视频 ${p.vcodec} · 音频 ${p.acodec} ${p.sr}Hz ${p.ach}ch`);
  say(`  ${C.d}成片尺寸/帧率/时长全部沿用素材；不 loop、不 trim、不 setpts、不替换音轨。${C.x}`);

  // ── 字幕时间轴 ──
  let alignMode = null, alignNote = '', spans = null;
  if (o.srt) {
    const sp = path.resolve(o.srt);
    if (!fs.existsSync(sp)) die(`--srt 文件不存在: ${sp}`);
    const cues = parseSrt(fs.readFileSync(sp, 'utf8'));
    if (!cues.length) warn('SRT 解析出 0 条，退到下一路');
    else {
      const a = alignCuesToSentences(cues, texts);
      spans = a.spans; alignMode = 'srt';
      alignNote = `SRT ${cues.length} 条 vs 文案 ${texts.length} 句 · 文本匹配率 ${(a.hitRate * 100).toFixed(1)}%`;
    }
  }
  if (!spans) {
    say(`  ${C.d}跑 ASR 强制对齐（本机 faster-whisper，只取时间不取转写文本）…${C.x}`);
    const a = await alignByAsr({ srcWsl, sentences: texts, dur: srcDur, echo: o.echo });
    if (a.ok && Array.isArray(a.spans) && a.spans.length === texts.length) {
      spans = a.spans; alignMode = 'asr';
      alignNote = `ASR(${a.model}) 方式=${a.mode} · 逐字匹配率 ${(a.rate * 100).toFixed(1)}% · 词 ${a.words} 个`;
    } else warn(`ASR 对齐失败（${a.error || '结果不完整'}），退到下一路`);
  }
  if (!spans) {
    const iv = await detectSpeech(srcWsl, srcDur, { echo: o.echo });
    if (iv.length) {
      spans = distributeByProportion(iv, texts, srcDur);
      alignMode = 'vad';
      alignNote = `silencedetect 切出 ${iv.length} 段有声区 · 按各句字数比例分配`;
    } else warn('VAD 没切出有声区间，退到均匀分配');
  }
  if (!spans) {
    spans = distributeByProportion([[0, srcDur]], texts, srcDur);
    alignMode = 'even';
    alignNote = '整条素材按各句字数比例均匀分配';
  }

  const items = buildItemsFromSpans(lines, spans, srcDur);
  const lastIt = items[items.length - 1];
  if (lastIt.sub1 > srcDur + 1e-6) die(`内部错误：末条字幕 ${f3(lastIt.sub1)} 越出素材 ${f3(srcDur)}`);
  ok(`对齐方式：${alignMode}  ${alignNote}`);
  say(`  末条字幕 ${f3(lastIt.sub0)}→${f3(lastIt.sub1)}s（素材 ${f3(srcDur)}s，余量 ${f3(srcDur - lastIt.sub1)}s）`);

  step(2, '时间轴（素材真实时长，未做任何变速/裁切）');
  for (const it of items) {
    say(`  ${it.id.padStart(4)}  ${f3(it.t0).padStart(8)} ${f3(it.t1).padStart(8)} ${f3(it.dur).padStart(7)}   ` +
      `${`${f3(it.sub0)}→${f3(it.sub1)}`.padEnd(19)} ${it.text}`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'timeline.json'),
    JSON.stringify(items.map(({ id, text, t0, t1, dur }) => ({ id, text, t0, t1, dur })), null, 1), 'utf8');
  fs.writeFileSync(path.join(outDir, 'film.srt'), buildSrt(items), 'utf8');

  step(3, '字体与字幕');
  const { fontFamily, fontDirWsl } = prepareFonts(style);
  const titleDur = o.title ? Math.min(2.5, srcDur) : 0;
  const assHost = path.join(outDir, '_sub.ass');
  fs.writeFileSync(assHost, buildAss(items, {
    W, H, title: o.title, titleDur, fontFamily, style,
    segments: (sem && Array.isArray(sem.segments)) ? sem.segments : null, total: srcDur,
  }), 'utf8');
  ok(`字体族 ${fontFamily}，fontsdir=${fontDirWsl}`);
  const probeSub = await runWsl(`ffmpeg -hide_banner -filters 2>/dev/null | grep -E '^ .* (subtitles|ass) ' || true`, { name: 'dub-cap' });
  if (!/subtitles/.test(String(probeSub.stdout))) die('这个 ffmpeg 没编 libass（subtitles 滤镜缺失），无法烧字幕');

  step(4, '画面：素材原样 + 叠加字幕（不缩放/不裁切/不变速）');
  const CD = `cd ${shq(outWsl)} || { echo "cd 失败: ${outWsl}"; exit 1; }`;
  const vf = [`subtitles=_sub.ass:fontsdir=${fontDirWsl}`, 'format=yuv420p'].join(',');
  // ★ --keep-original-limit：只把音轨**限幅**到交付线（TARGET_PEAK_PCM），画面/时长/内容一律不动。
  //   口径与形态1 **完全一致**：alimiter=limit=…dB:level=disabled（level=disabled = 只压峰、不改电平）。
  //   ★ 音频滤镜**不能**另挂 -af —— 命令里已经有 -filter_complex（视频烧字幕），-af 会与之冲突；
  //     必须把音频链**并进同一个 -filter_complex**（`[0:a]alimiter…[a]`）并改 -map "[a]"。
  //   ★ 素材可能**没有音轨**（原先的 `-map 0:a?` 是可选映射）：此时不能往 filter_complex 里塞
  //     `[0:a]`（ffmpeg 会因 "matches no streams" 直接失败），退回到无音频滤镜的路径并**明说**。
  const limited = !!o.keepOriginalLimit;
  const hasAudio = !!p.acodec;
  const applyLimit = limited && hasAudio;
  if (limited && !hasAudio) {
    warn('--keep-original-limit 已给，但素材**没有音轨** —— 无音频可限幅，按无音轨原样出片');
  }
  const fc = applyLimit
    ? `[0:v]${vf}[v];[0:a]alimiter=limit=${TARGET_PEAK_PCM}dB:level=disabled[a]`
    : `[0:v]${vf}[v]`;
  const mux = [
    'ffmpeg -hide_banner -nostdin -y',
    `-i ${shq(srcWsl)}`,
    `-filter_complex ${shq(fc)}`,
    applyLimit ? '-map "[v]" -map "[a]"' : '-map "[v]" -map 0:a?',
    VARG,   // ★ 编码器唯一决策点（LEMO_VENC：未设⇒h264_nvenc / 显式 libx264⇒CPU / 其它⇒报错），见文件头
    '-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709',
    applyLimit ? '-c:a aac -b:a 192k' : '-c:a copy',
    '-movflags +faststart',
    'film.mp4',
  ].join(' ');
  const rMux = await runWsl(CD + '\n' + mux, { name: 'dub-ko-mux', echo: o.echo });
  if (rMux.code !== 0) die(`编码/混流失败:\n${rMux.stderr}`);
  ok(applyLimit
    ? `film.mp4 已生成（视频流重编以烧字幕；音频流**重编码 + 限幅**到 ${TARGET_PEAK_PCM} dBFS）`
    : 'film.mp4 已生成（视频流重编以烧字幕；音频流原样 copy）');

  // ── 自检 ──
  step(5, '自检');
  const fp = await probe(winToWsl(path.join(outDir, 'film.mp4')));
  say(`  分辨率 ${fp.w}x${fp.h} · 帧率 ${f3(fp.fps)} · 时长 ${f3(fp.dur)}s · 视频 ${fp.vcodec}`);
  say(`  音轨 ${fp.acodec} ${fp.sr}Hz ${fp.ach}ch · 音频时长 ${f3(fp.adur)}s`);
  say(`  素材时长 ${f3(srcDur)}s → 成片视频差 ${f3(Math.abs(fp.dur - srcDur))}s · 音频差 ${f3(Math.abs((fp.adur ?? 0) - srcDur))}s`);
  if (fp.w !== W || fp.h !== H) bad(`尺寸与素材不一致：${fp.w}x${fp.h} ≠ ${W}x${H}`);
  else ok('尺寸与素材一致');
  if (fp.fps !== null && Math.abs(fp.fps - (p.fps ?? fp.fps)) > 0.01) bad(`帧率与素材不一致：${f3(fp.fps)} ≠ ${f3(p.fps)}`);
  else ok('帧率与素材一致');
  if (Math.abs(fp.dur - srcDur) < 0.1) ok(`成片时长 = 素材时长（差 ${f3(Math.abs(fp.dur - srcDur))}s < 0.1s）`);
  else bad(`时长差超标：${f3(Math.abs(fp.dur - srcDur))}s`);

  // 音轨是否被换掉：把两条音轨都解成 PCM 比 md5（copy 的话应当逐字节相同）
  const ko = await runWsl([
    `ffmpeg -v error -y -i ${shq(srcWsl)} -vn -c:a pcm_s16le -ar 48000 -ac 2 -f wav /tmp/ko_a.wav`,
    `ffmpeg -v error -y -i ${shq(winToWsl(path.join(outDir, 'film.mp4')))} -vn -c:a pcm_s16le -ar 48000 -ac 2 -f wav /tmp/ko_b.wav`,
    `md5sum /tmp/ko_a.wav /tmp/ko_b.wav`,
    `echo '@@D@@'`,
    `ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/ko_a.wav /tmp/ko_b.wav`,
    `echo '@@P@@'`,
    `for f in /tmp/ko_a.wav /tmp/ko_b.wav; do ffmpeg -hide_banner -nostdin -i $f -af astats=measure_perchannel=none -f null - 2>&1 | grep -F 'Peak level dB' | tail -1; done`,
    `rm -f /tmp/ko_a.wav /tmp/ko_b.wav`,
  ].join('\n'), { name: 'dub-ko-audio' });
  const koTxt = String(ko.stdout);
  const [md5Part, durPart] = koTxt.split('@@P@@')[0].split('@@D@@');
  const peakPart = koTxt.split('@@P@@')[1] || '';
  const md5s = String(md5Part).trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const same = md5s.length >= 2 && md5s[0].split(/\s+/)[0] === md5s[1].split(/\s+/)[0];
  say(`  音频 PCM md5（素材 / 成片）：\n    ${md5s.join('\n    ')}`);
  if (limited) {
    // ★ 开了限幅 ⇒ 音轨被重编码，**本来就不该**逐字节相同 —— 这是**有意**的，不是失败/警告。
    ok(`音轨已被限幅重编码（--keep-original-limit）⇒ 与素材不再逐字节相同，这是**有意**的（只压峰；时长/画面/内容未动）`);
    if (same) warn('  但 PCM md5 竟然相同 —— 限幅似乎没生效？请查上面的混流命令');
  } else if (same) {
    ok('音轨与素材**逐字节相同**（PCM md5 一致 → 没有被 TTS 替换、没有被重编码）');
  } else {
    warn(`音轨 PCM 不完全一致（时长差或解码尾包差异）：${String(durPart).trim().split('\n').join(' / ')}`);
  }
  const pk = (String(peakPart).match(/Peak level dB:\s*(-?[\d.]+)/g) || []).map((s) => Number(/(-?[\d.]+)$/.exec(s)[1]));
  say(`  峰值(astats 6位) 素材/成片：${pk.length >= 2 ? `${pk[0].toFixed(6)} / ${pk[1].toFixed(6)}` : 'n/a'}`);

  const mf = await measure(winToWsl(path.join(outDir, 'film.mp4')));
  // ★ 2026-10-03：判据改用**真峰值**（`loudnorm input_tp`，4× 过采样）。
  //   原先拿 astats 的**采样峰值**当真峰值判达标，而实测全量 43 部里两者最大差 1.62 dB，
  //   会**漏报**（采样达标但真峰值超标）。`peak`（采样峰值）只作参考，不再当判据、也不标成「真峰值 dBTP」。
  const mfTP = mf.truePeak !== null ? mf.truePeak : mf.peak;
  say(`  ${C.b}成片实测：真峰值 ${f3(mf.truePeak)} dBTP · 采样峰值(astats) ${f3(mf.peak)} dBFS · 集成响度 ${mf.lufs === null ? 'n/a' : f3(mf.lufs)} LUFS${C.x}`);
  const ms = await measure(srcWsl);
  say(`  素材实测：真峰值 ${f3(ms.truePeak)} dBTP · 采样峰值 ${f3(ms.peak)} dBFS · 响度 ${ms.lufs === null ? 'n/a' : f3(ms.lufs)} LUFS`);
  if (mfTP === null) {
    warn('真峰值测不到（loudnorm 未给出 input_tp）—— 无法判定是否达标');
  } else if (mfTP <= HARD_PEAK_LIMIT) {
    ok(`真峰值 ${f3(mfTP)} ≤ ${HARD_PEAK_LIMIT} dBTP，达标${applyLimit ? '（限幅后）' : ''}`);
  } else if (limited) {
    // ★ 开了开关就**应该**达标；仍超 ⇒ 真失败（判据是开启后必须 ≤ 交付线）。
    bad(`真峰值 ${f3(mfTP)} > ${HARD_PEAK_LIMIT} dBTP —— 已开 --keep-original-limit 仍未达标，请调低限幅目标（TARGET_PEAK_PCM）`);
  } else {
    warn(`真峰值 ${f3(mfTP)} > ${HARD_PEAK_LIMIT} dBTP —— ★ 这是**素材自身**的峰值；--keep-original 明令不改声音，故不做归一（要达标只能不用 --keep-original，或先自行压素材，或用 --keep-original-limit 限幅）`);
  }

  // 抽帧：成片 vs 素材同时间点
  const verifyDir = path.join(CFG.outRoot, '_verify', path.basename(outDir));
  fs.mkdirSync(verifyDir, { recursive: true });
  const picks = [items[0], items[Math.floor(items.length / 2)], items[items.length - 1]];
  const frames = [];
  for (let i = 0; i < picks.length; i++) {
    const tt = (picks[i].sub0 + picks[i].sub1) / 2;
    for (const [tag, src] of [['film', winToWsl(path.join(outDir, 'film.mp4'))], ['src', srcWsl]]) {
      const name = `${tag}${i + 1}_t${tt.toFixed(2)}.png`;
      const r = await runWsl(
        `ffmpeg -hide_banner -nostdin -y -ss ${f3(tt)} -i ${shq(src)} -frames:v 1 -vf scale=540:-1 ${shq(winToWsl(path.join(verifyDir, name)))}`,
        { name: 'dub-frame' });
      if (r.code === 0 && tag === 'film') frames.push({ file: path.join(verifyDir, name), t: tt, text: picks[i].text });
    }
  }
  say(`  抽帧（成片/素材各 3 张）→ ${verifyDir}`);

  try {
    fs.rmSync(path.join(outDir, '_sub.ass'), { force: true });
  } catch { /* ignore */ }
  step(6, '交付');
  for (const f of ['film.mp4', 'film.srt', 'lines.json', 'timeline.json']) {
    const p2 = path.join(outDir, f);
    say(`  ${fs.existsSync(p2) ? '✓' : '✗'} ${f.padEnd(14)} ${fs.existsSync(p2) ? (fs.statSync(p2).size / 1024).toFixed(1) + ' KB' : '缺失'}`);
  }
  say(`\n${C.b}${C.g}完成${C.x}  ${path.join(outDir, 'film.mp4')}`);
  say(JSON.stringify({
    out: outDir, keepOriginal: true, srcDur, total: srcDur, align: alignMode, alignNote,
    style: style.id, peak: mf.peak, truePeak: mf.truePeak, srcPeak: ms.peak, srcTruePeak: ms.truePeak, audioIdentical: same,
    keepOriginalLimit: limited,
    lastSubEnd: lastIt.sub1, frames: frames.map((f) => f.file), verify: verifyDir,
  }));

  if (o.verifyTriple) await runTripleCheck({ filmHost: path.join(outDir, 'film.mp4'), scriptText: texts.join(''), outDir });
}

// ── 三者一致性校验门（规则 2 允许 7B 的唯一用途）─────────────────
// ★ 只有 --verify-triple 真正执行到这里才会 import 并调用；出片流程的其余**任何**分支
//   都不碰它 —— 保证 7B 不会被"顺手"拉起、常驻显存拖死 Index-TTS。
async function runTripleCheck({ filmHost, scriptText, outDir }) {
  step('V', '三者一致性校验（画面 / 字幕文本 / 语义）—— 唯一允许调用 7B 的地方');
  say(`  ${C.d}模型 qwen2.5-vl-7b-official（vlm，能读图）；只做对照检测，不做生成。用完自动卸载。${C.x}`);
  let mod;
  try { mod = await import('./lib/triple-check.mjs'); }
  catch (e) { die(`加载 lib/triple-check.mjs 失败：${e?.message || e}`); }
  let rep;
  try { rep = await mod.verifyTriple({ filmHost, scriptText, outDir }); }
  catch (e) { die(`三者一致性校验失败：${e?.message || e}`); }
  const cnt = (v) => rep.frames.filter((f) => f.verdict === v).length;
  say(`  总体结论：${rep.overall}（一致 ${cnt('一致')} / 不一致 ${rep.mismatches.length} / 存疑 ${cnt('存疑')}）`);
  for (const f of rep.frames) {
    say(`    #${String(f.i).padStart(2)} t=${String(f.t).padStart(6)}s ${String(f.verdict).padEnd(3)} ` +
      `字幕「${f.subtitle}」${f.imageText ? ` 画面读到「${f.imageText}」` : ''}${f.reason ? `  ${f.reason}` : ''}`);
  }
  for (const e of rep.errors) warn(e);
  say(`  显存 ${rep.vram.beforeMiB ?? 'n/a'} → ${rep.vram.afterMiB ?? 'n/a'} MiB  卸载=${rep.vram.unloadOk ? 'ok' : 'failed(仅 warning)'}`);
  say(`  报告 ${rep.report}`);
  return rep;
}

// ── 风格源码变更检测（约定一「自动纳入」机制的出片钩子）──────────
// 约定一要求：新增风格 / 已有风格代码变更时，必须能被**自动发现**并提示重新解析。
// 这里只做「发现」——真正的重新解析是另一步的工作，**不放在出片路径上**（会拖慢出片）。
// 检测本身读指纹文件 + 算哈希，失败只告警、绝不阻断出片。
async function warnStyleChanges() {
  if (process.env.LEMO_SKIP_STYLE_SCAN === '1') return;
  let r;
  try {
    const mod = await import('./scripts/style-scan.mjs');
    r = await mod.checkStyleChanges({ autoBaseline: true });
  } catch (e) {
    warn(`风格扫描跳过（加载扫描器失败，不影响出片）：${e?.message || e}`);
    return;
  }
  if (!r || !r.ok) { warn(`风格扫描跳过（不影响出片）：${r?.error || '未知错误'}`); return; }

  if (r.status === 'baseline') {
    say(`  ${C.d}风格扫描：首次建立基线，纳入 ${r.styleCount} 个风格（${r.ms}ms）${C.x}`);
    return;
  }
  if (r.status === 'no-baseline') {
    warn(`风格扫描：尚无指纹基线，请跑 node scripts/style-scan.mjs 建立（不影响出片）`);
    return;
  }
  if (r.status === 'no-change') {
    say(`  ${C.d}风格扫描：${r.styleCount} 个风格源码无变更（${r.ms}ms）${C.x}`);
    return;
  }
  // status === 'changed'
  const n = r.added.length + r.changed.length + r.removed.length;
  warn(`风格源码有 ${n} 处变更 —— 以下风格需要**重新解析**（style-dna / dub-visual）：`);
  for (const a of r.added) say(`  ${C.g}+ 新增风格${C.x} ${a.slug}（${a.fileCount} 个源码文件）`);
  for (const c of r.changed) {
    say(`  ${C.y}~ 变更${C.x} ${c.slug}  改动文件：${c.changedFiles.join(', ') || '(未定位)'}`);
  }
  for (const s of r.removed) say(`  ${C.r}- 消失${C.x} ${s}`);
  say(`  ${C.d}明细：node scripts/style-scan.mjs --check    基线：${r.fpFile}${C.x}`);
  say(`  ${C.d}（本次只提示、不阻断出片；重解析后再跑一次 style-scan.mjs 刷新基线）${C.x}`);
}

// ── 主 ──────────────────────────────────────────────────────────
async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { say(USAGE); return; }
  if (!o.script) die('缺 --script（文案文件路径，或 "-" 表示从 stdin 读）');
  if (!(o.speed >= 0.5 && o.speed <= 2.0)) die(`--speed 要在 0.5–2.0（给的是 ${o.speed}）`);
  if (!(o.gap >= 0 && o.gap <= 5)) die(`--gap 要在 0–5 秒（给的是 ${o.gap}）`);
  if (!['loop', 'trim', 'slow'].includes(o.fit)) die(`--fit 只能是 loop|trim|slow（给的是 ${o.fit}）`);
  // ── 风格「自动纳入」检测（约定一）──────────────────────────────
  // ★ 只做检测：读已有指纹文件 + 对 styles/ 算内容哈希（毫秒~百毫秒级），**不做重活**
  //   （绝不在这里重新解析风格 —— 那会拖慢出片）。
  // ★ 失败绝不阻断出片：任何异常都只告警。
  // ★ 跳过：设 LEMO_SKIP_STYLE_SCAN=1。
  await warnStyleChanges();
  // ── 输出尺寸：--ratio / --size，**缺省 9:16**（与风格链路 lemo-make.mjs 行为一致）──
  // 用户要求：「视频默认宽高比 9:16；可选 16:9 / 3:4 / 4:3 / 1:1 + 自定义尺寸；
  //            任务没有明确指定输出尺寸时，自动采用默认值 9:16 导出视频。」
  // ★ 比例→像素的换算**不在这里写第二份**：唯一来源是库里的 core/render/size.mjs
  //   （见上面的 loadSizeModule）。优先级 size（更具体）> ratio > DEFAULT_RATIO(9:16)。
  const SZ = await loadSizeModule();
  // ★ 两个都要独立校验，**不能只校验「胜出的那个」**：
  //   `--size 1080x1920 --ratio 7:5` 若只校验 size，会静默丢弃那个拼错的 7:5
  //   （退出码 0、一个字都不提）。⇒ 给了的都要合法；合法性判完再按 size > ratio 定优先级。
  for (const [flag, val] of [['--size', o.size], ['--ratio', o.ratio]]) {
    if (val == null || val === '') continue;
    if (!SZ.parseSizeSpec(val)) {
      die(`${flag} 取值非法：'${val}'。\n`
        + `  可用比例：${SZ.RATIOS.map((r) => r.id).join(' | ')}（默认 ${SZ.DEFAULT_RATIO}）\n`
        + `  或自定义像素：如 1080x1920（两个数都必须是 ${SZ.MIN_SIZE}–${SZ.MAX_SIZE} 的偶数）`);
    }
  }
  const outSize = SZ.resolveSize({ ratio: o.ratio, size: o.size });
  // ★ 走到这里说明**格式合法但范围不合法**（例如 64x64 格式没问题、但低于可渲染下限）。
  //   把可用范围与比例清单直接摆出来，不让用户自己去翻文档（也绝不吐裸 TypeError）。
  if (!outSize) {
    die(`--size / --ratio 的取值超出可用范围：ratio=${o.ratio ?? '(无)'} size=${o.size ?? '(无)'}。\n`
      + `  自定义像素的宽高都必须在 ${SZ.MIN_SIZE}–${SZ.MAX_SIZE} 之间、且为偶数`
      + `（下限 ${SZ.MIN_SIZE} 来自影片版面的可渲染约束，见 core/render/size.mjs 的注释）。\n`
      + `  可用比例：${SZ.RATIOS.map((r) => r.id).join(' | ')}（默认 ${SZ.DEFAULT_RATIO}）`);
  }
  const W = outSize.w, H = outSize.h;
  const form = o.video ? 'B' : 'A';

  // 文案
  let raw;
  if (o.script === '-') { try { raw = fs.readFileSync(0, 'utf8'); } catch (e) { die(`读 stdin 失败: ${e.message}`); } }
  else {
    const p = path.resolve(o.script);
    if (!fs.existsSync(p)) die(`文案文件不存在: ${p}`);
    raw = fs.readFileSync(p, 'utf8');
  }
  if (!raw.trim()) die('文案是空的');
  if (o.keepOriginal && !o.video) die('--keep-original 必须配 --video（要保留的就是那段口播素材）');
  // ★ --keep-original-limit 限的是「保持原样」那条音轨 —— 没走 --keep-original 就没有意义，
  //   直接拦住（而不是静默忽略：用户以为压了峰，成片其实没有）。
  if (o.keepOriginalLimit && !o.keepOriginal) {
    die('--keep-original-limit 只在 --keep-original 下有意义（它限的是"保持原样"的音轨）；\n'
      + '  请同时给 --keep-original，或去掉本开关。');
  }

  // ── 口播视频的「画面气质」（★ 2026-10-04 补：需求要求自动匹配时考虑它，此前完全没实现）──
  //   提取三样：画幅方向（竖/横/方）+ 平均亮度 + 平均色。前两样供风格匹配，
  //   第三样只作提示打印。★ 走**文件**而不是 stdout —— 二进制过 WSL stdout 会被损坏。
  const probeVisual = async () => {
    if (!o.video) return null;
    const vh = path.resolve(o.video);
    if (!fs.existsSync(vh)) return null;
    // ★ 这一步在 `outDir` 定义**之前**（analyze 早于它），所以用固定临时路径；
    //   命令里全是绝对路径 ⇒ 不需要 `cd`。
    const rawHost = path.join(CFG.outRoot, '_visual-tmp.raw');
    fs.mkdirSync(CFG.outRoot, { recursive: true });
    const r = await runWsl(
      `ffmpeg -hide_banner -nostdin -y -i ${shq(winToWsl(vh))} -vf "fps=1,scale=1:1" -frames:v 60 -f rawvideo -pix_fmt rgb24 ${shq(winToWsl(rawHost))} 2>/dev/null || true`,
      { name: 'dub-visual' });
    let buf = null;
    try { buf = fs.readFileSync(rawHost); } catch { return null; }
    try { fs.unlinkSync(rawHost); } catch { /* ignore */ }
    const n = Math.floor(buf.length / 3);
    if (!n) return null;
    let R = 0, G = 0, B = 0;
    for (let i = 0; i < n; i++) { R += buf[i * 3]; G += buf[i * 3 + 1]; B += buf[i * 3 + 2]; }
    R = Math.round(R / n); G = Math.round(G / n); B = Math.round(B / n);
    const p = await probe(winToWsl(vh));
    const w = p.w || 0, h = p.h || 0;
    const luma = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    return {
      w, h,
      orient: w && h ? (Math.abs(w / h - 1) < 0.08 ? '方' : (h > w ? '竖' : '横')) : null,
      luma: Math.round(luma * 10) / 10,
      bright: luma < 85 ? '暗' : (luma > 170 ? '亮' : '中'),
      rgb: `#${[R, G, B].map((x) => x.toString(16).padStart(2, '0')).join('')}`,
      samples: n,
    };
  };
  const visual = await probeVisual();
  if (visual) {
    say(`  口播画面气质：${visual.orient ?? '?'}屏 ${visual.w}x${visual.h} · 平均亮度 ${visual.luma}/255（${visual.bright}）· 平均色 ${visual.rgb}（${visual.samples} 帧采样）`);
  }

  // ── 语义解析（--analyze 干跑 / --style auto 选风格）──
  // ★ 通用语义推理由 **WorkBuddy 智能体**承担（见 lib/dub-semantic.mjs 顶部规则）：
  //   本工具自己**不调任何本机模型**。要注入外部结果就 --analysis <file>；
  //   不给 = 纯规则路（source='rules'）——这是**正常默认**，不是"降级"。
  let analysis = undefined;
  if (o.analysis) {
    const ap = path.resolve(o.analysis);
    if (!fs.existsSync(ap)) die(`--analysis 文件不存在: ${ap}`);
    try { analysis = JSON.parse(fs.readFileSync(ap, 'utf8')); }
    catch (e) { die(`--analysis 不是合法 JSON（${ap}）：${e.message}`); }
  }

  let sem = null;
  const runAnalyze = async () => {
    const mod = await loadSemantic();
    if (!mod || typeof mod.analyze !== 'function') {
      warn(`语义解析不可用（没找到可用的 lib/dub-semantic.mjs）—— 风格只能手写 --style <id>`);
      return null;
    }
    let r;
    try { r = await mod.analyze({ text: raw, styleIds: styleIdsFromRegistry(), analysis, visual }); }
    catch (e) { warn(`语义解析抛异常：${e?.message || e}`); return null; }
    sem = r;
    return r;
  };

  if (o.analyze) {
    step(0, `语义解析（--analyze 干跑${analysis ? ' · 外部结果 --analysis' : ' · 纯规则路'}）`);
    const r = await runAnalyze();
    if (!r) { die('语义解析不可用，--analyze 无法给出结果'); }
    say(`  source=${r.source}  model=${r.model ?? '-'}  用时 ${r.ms ?? '?'}ms  ok=${r.ok}`);
    if (r.error) warn(`error: ${r.error}`);
    say(`  theme:   ${Array.isArray(r.theme) ? r.theme.join(' / ') || '(空)' : '(空)'}`);
    say(`  emotion: ${r.emotion || '(空)'}   pace: ${r.pace || '(空)'}   scene: ${r.scene || '(空)'}`);
    say(`  styleId: ${r.styleId || '(空)'}   pickedBy: ${r.stylePickedBy || '-'}`);
    say(`  匹配维度：theme/emotion/scene/pace${visual ? ' + **visual（口播画面气质）**' : '（本次无口播视频 ⇒ 未启用 visual 维度）'}`);
    if (r.scores) say(`  scores:  ${JSON.stringify(r.scores)}`);
    say(`  segments(${Array.isArray(r.segments) ? r.segments.length : 0}):`);
    for (const s of (Array.isArray(r.segments) ? r.segments : [])) {
      say(`    ${String(s.i).padStart(3)}  [${String(s.role || '其他').padEnd(4)}]  ${s.text}`);
    }
    if (r.llmRaw) say(`  llmRaw:  ${String(r.llmRaw).slice(0, 300)}`);
    if (r.llmRawSeg) say(`  llmRawSeg:  ${String(r.llmRawSeg).slice(0, 300)}`);
    return;
  }

  // ── --verify-triple + --film：直接校验**已有成片**（不重新出片）──
  if (o.verifyTriple && o.film) {
    const filmHost = path.resolve(o.film);
    if (!fs.existsSync(filmHost)) die(`--film 不存在: ${filmHost}`);
    await runTripleCheck({ filmHost, scriptText: raw, outDir: path.dirname(filmHost) });
    return;
  }

  // ── 风格 ──
  let styleId = o.style || 'plain-dark';           // ★ 不给 = 基线（不是注册表 default）
  if (styleId === 'auto') {
    step(0, '语义解析（--style auto）');
    const r = await runAnalyze();
    styleId = (r && r.styleId) || 'plain-dark';
    if (!r) warn('语义解析不可用，--style auto 退回 plain-dark');
    else ok(`auto 选中风格：${styleId}（pickedBy=${r.stylePickedBy || '-'}，emotion=${r.emotion || '-'}，pace=${r.pace || '-'}）`);
  } else if (o.style) {
    const reg = loadStyleRegistry();
    if (!reg) warn(`读不到风格注册表 ${STYLES_FILE} —— 退回基线 plain-dark`);
    else if (styleId !== 'plain-dark' && !reg.styles.some((s) => s && s.id === styleId)) {
      warn(`注册表里没有风格 "${styleId}"，可用：${listStyles().join(', ')} —— 退回基线 plain-dark`);
    }
  }
  let style = resolveStyle(styleId);
  if (!style) { warn(`风格 "${styleId}" 解析失败，退回基线 plain-dark`); style = PLAIN_DARK; styleId = 'plain-dark'; }
  // ★★ 2026-10-04 补：语义解析此前**只在 `--analyze` / `--style auto` 时跑** ⇒ 用户**显式指定风格**时
  //   `sem` 恒为 `null`，后果有两条：
  //     ① 传进来的 `--analysis`（外部智能体给的语义）被**静默丢掉**；
  //     ② 该风格若开了 `overlay.chapterCards` / `lowerThird`，`buildAss` 收到的 `segments` 是 `null`
  //        ⇒ **永远不出章节卡**（角色的信息层级白算了）。
  //   需求写明「**无论用户指定还是系统自动匹配**，都要按最终风格规划信息呈现方式」⇒ 这两种情况都得解析。
  //   ★ 代价近乎零：规则路 10ms、不调任何本机模型（有外部结果时直接采用）。
  //   ★ 仍然**只在该用的时候跑**：既没给 `--analysis`、风格也没开章节卡/下三分 ⇒ 不跑，输出与改动前一致。
  if (!sem) {
    // ★ 2026-10-04 再加一条触发条件：**用户显式指定了风格**时也要解析。
    //   公共规则 2 写的是「**无论用户指定风格，还是系统自动匹配风格，都必须保证风格与自定义文案语义一致**」
    //   —— 指定风格时若不解析，就**无从判断一致性**（此前确实没判断）。
    //   代价：规则路 10ms、不调任何本机模型；只在**显式给 --style**（非 auto）时多跑一次。
    const explicitStyle = !!(o.style && o.style !== 'auto');
    const needSegs = !!o.analysis
      || explicitStyle
      || !!(style.overlay && (style.overlay.chapterCards || style.overlay.lowerThird));
    if (needSegs) {
      step(0, `语义解析（${o.analysis ? '外部结果 --analysis'
        : explicitStyle ? `为公共规则 2 的「风格 ↔ 文案语义一致性自检」`
        : `${styleId} 开了章节卡/下三分，需要角色信息层级`}）`);
      await runAnalyze();
    }
  }
  say(`  风格  ${style.id}（${style.cn || style.id}）${style.id === 'plain-dark' ? '· 基线：无叠加层、无动效' : ''}`);

  // ── 公共规则 2 的自检：用户指定的风格与文案语义贴不贴？ ──────────────
  // ★ **只警告、不改风格** —— 功能1/功能2 的规则 3 都写明「如果用户指定了风格，则以用户指定风格为准」。
  //   这里只把「你选的」与「按语义最贴的」摆在一起，让人一眼看出差多少；要不要换是人的决定。
  if (sem && o.style && o.style !== 'auto' && sem.scores && typeof sem.scores[styleId] === 'number') {
    const mine = sem.scores[styleId];
    const best = Object.entries(sem.scores).sort((a, b) => b[1] - a[1])[0];
    say(`  风格一致性自检（公共规则 2）：指定的 \`${styleId}\` 匹配度 ${mine}；按文案语义最高的是 \`${best[0]}\` ${best[1]}`);
    // 阈值 0.25：实测同一份文案下「最贴的」与「次贴的」差 ~0.40（0.58 vs 0.18），
    // 取 0.25 能抓住「明显不贴」又不至于对轻微差异聒噪。
    if (best[0] !== styleId && best[1] - mine >= 0.25) {
      warn(`你指定的风格 \`${styleId}\`（匹配度 ${mine}）与文案语义贴合度**偏低**；`
        + `按语义最贴的是 \`${best[0]}\`（${best[1]}）。`
        + `★ 规则 3 以你的指定为准，故**不擅自换风格** —— 若想跟随语义，改用 \`--style auto\`。`);
    }
  }

  // ── 风格 Skill 文档（style-skills）接入 ─────────────────────────
  // ★ 这是「选定风格后**优先调取该风格 Skill 文档**作为核心参考」在**程序侧**的落点：
  //   只要该风格已蒸馏出 `lib/style-skills/<slug>/SKILL.md`，就把它的位置、完整度、
  //   自检得分与「已知缺陷 / 素材缺口 / 能力限制」的条数打出来，让本次出片与下游智能体
  //   一眼看到「这个风格怎么做、坑在哪」。**只读 + 缺失即降级**：没蒸馏过就整块跳过，
  //   输出与改动前逐字节一致。
  // ★ 与上面 style-dna 的分工：dna 给**数值**（grain / 折行 / 响度），skill 给**方案**。
  const skillSum = summarizeStyleSkill(readStyleSkill(styleId));
  if (skillSum) {
    ok('风格 Skill 文档已就位（11 节制作方案）');
    for (const L of describeStyleSkill(skillSum)) say(`    · ${L}`);
  }

  // ── 风格特质档案（style-dna）接入 ────────────────────────────────
  // ★ 此前 lib/style-dna/ 的 43 份档案是「零消费者」：知识库答得出「怎么套用它的特质」，
  //   但没有任何流程会去问它。这里按 slug 读档案、折成可用数值挂到 style.dna 上，
  //   下游 buildAss（字幕折行）与响度归一（targetLufs）会真的用上。
  // ★ 只读 + 缺失即降级：readStyleDna 读不到就返回 null；plain-dark 无档案 → 本块整体跳过，
  //   输出与改动前逐字节一致（硬要求）。
  const dna = summarizeStyleDna(readStyleDna(styleId));
  let targetLufs = TARGET_LUFS;
  if (dna) {
    style = { ...style, dna };
    if (Number.isFinite(dna.targetLufs)) targetLufs = dna.targetLufs;
    ok(`风格特质已接入出片（来自 lib/style-dna/${dna.slug}.json）`);
    for (const L of describeStyleDna(dna)) say(`    · ${L}`);
    // 用与 buildAss 同一套算法报告「本次字幕折行是否被 DNA 收窄」
    const spD = styleSpec(style, { W, H });
    const basePerLine = charsPerLine(W - 2 * spD.marginL, spD.fontSize);
    const effPerLine = (Number.isFinite(dna.subtitleMaxChars) && dna.subtitleMaxChars < basePerLine)
      ? Math.max(2, dna.subtitleMaxChars) : basePerLine;
    say(`    · 字幕折行容量：通用 ${basePerLine} 字/行 → 本次 ${effPerLine} 字/行` +
      `${effPerLine < basePerLine ? '（DNA 已收窄）' : '（未触顶，与通用一致）'}`);
  }

  // 输出目录
  const baseName = o.script === '-'
    ? `stdin-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`
    : sanitizeName(path.basename(o.script, path.extname(o.script)));
  const outDir = o.out ? path.resolve(o.out) : path.join(CFG.outRoot, baseName);
  const outWsl = winToWsl(outDir);

  // 素材 / 背景存在性
  let videoHost = null, bgHost = null;
  if (o.video) {
    videoHost = path.resolve(o.video);
    if (!fs.existsSync(videoHost)) die(`素材不存在: ${videoHost}`);
  }
  if (o.bg) {
    bgHost = path.resolve(o.bg);
    if (!fs.existsSync(bgHost)) die(`背景图不存在: ${bgHost}`);
  }

  // ── 断句 ──
  const texts = splitSentences(raw, 40);
  if (!texts.length) die('断句后一句都没有');
  const lines = texts.map((t, i) => ({ id: `l${i + 1}`, text: t, voice: o.voice, speed: o.speed, lang: 'cmn' }));

  say(`${C.b}dub.mjs${C.x}  形态 ${form}${form === 'B' ? '（口播素材铺画面）' : '（生成背景）'}`);
  say(`  文案  ${raw.length} 字 → ${lines.length} 句`);
  say(`  输出  ${outDir}`);
  say(`  尺寸  ${W}x${H} · 帧率 30 · 音色 ${o.voice} · 语速 ${o.speed} · 句间 ${o.gap}s${form === 'B' ? ` · fit ${o.fit}` : ''}`);
  // ★ --keep-original 下 --size / --ratio **都不生效**（改尺寸/比例就是改画面）——
  //   与 --size 一致给提示。放在这里（而非 runKeepOriginal 里）是为了 --dry-run 也能看到。
  if (o.keepOriginal) {
    const asked = [];
    if (o.size) asked.push(`--size ${o.size}`);
    if (o.ratio) asked.push(`--ratio ${o.ratio}`);
    if (asked.length) say(`  ${C.d}${asked.join(' / ')} 在 --keep-original 下不生效（改尺寸/比例就是改画面；成片沿用素材尺寸）${C.x}`);
    // ★ 音轨：默认 -c:a copy（与素材逐字节相同）；--keep-original-limit 才会重编码 + 限幅。
    say(o.keepOriginalLimit
      ? `  ${C.d}音轨：--keep-original-limit 已开 → 重编码 + 限幅到 ${TARGET_PEAK_PCM} dBFS（只压峰；**不再是逐字节原声**）${C.x}`
      : `  ${C.d}音轨：默认 -c:a copy（与素材**逐字节相同**）；素材自身真峰值超标时加 --keep-original-limit 限幅到交付线${C.x}`);
  }

  step(1, `断句结果（${lines.length} 句，单句上限 40 字）`);
  for (const L of lines) say(`  ${C.d.padEnd ? '' : ''}${L.id.padStart(4)}  ${String(L.text.length).padStart(2)}字  ${L.text}`);

  // ── dry-run ──
  if (o.dryRun) {
    // 真实时长要跑 TTS 才知道；这里用标定过的字/秒估算，并明确标注是估算。
    const EST_CPS = 5.5;   // 实测标定（zh_kepu9, speed=1.0，见交付说明）
    const durs = lines.map((L) => Math.max(0.4, L.text.length / (EST_CPS * o.speed)));
    const { items, total } = buildTimeline(lines, durs, o.gap);
    const titleDur = o.title ? Math.min(2.5, durs[0]) : 0;
    step(2, `时间轴（${C.y}估算${C.x} —— 真实时长要跑完 TTS 才知道）`);
    say(`  ${'id'.padStart(4)}  ${'t0'.padStart(8)} ${'t1'.padStart(8)} ${'dur'.padStart(7)}   ${'字幕窗'.padEnd(19)} 文本`);
    for (const it of items) {
      say(`  ${it.id.padStart(4)}  ${f3(it.t0).padStart(8)} ${f3(it.t1).padStart(8)} ${f3(it.dur).padStart(7)}   ` +
        `${`${f3(it.sub0)}→${f3(it.sub1)}`.padEnd(19)} ${it.text}`);
    }
    say(`  ${C.b}总时长 ≈ ${f3(total)}s${C.x}${o.title ? `（片头标题 ${f2(titleDur)}s）` : ''}`);
    step(3, '将要做的事（未执行）');
    say(`  · 调 WSL 里的 Index-TTS 批量合成 ${lines.length} 句 → ${outDir}\\_tts\\`);
    say(`  · 拼时间轴 + 响度/真峰值归一（PCM 目标峰值 ${TARGET_PEAK_PCM} dBFS，响度 ${targetLufs} LUFS）`);
    if (form === 'B') say(`  · 素材 ${videoHost} 铺满 ${W}x${H}（保持比例居中裁切），fit=${o.fit}`);
    else say(`  · 生成 ${W}x${H} 深色渐变背景${bgHost ? `（改用 ${bgHost}）` : ''}`);
    say(`  · 烧中文字幕（底部安全区）+ 导出 film.srt → ${VENC} 编码 → film.mp4`);
    say(`  ${C.d}--dry-run 到此为止。${C.x}`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'lines.json'), JSON.stringify(lines, null, 1), 'utf8');

  // ── 功能2：--keep-original（不跑 TTS、不动素材）──
  if (o.keepOriginal) {
    return await runKeepOriginal({ o, outDir, outWsl, videoHost, lines, style, sem });
  }

  // ── 出片前显存预检 + 自动腾挪（★ 必须在 TTS **之前**）──
  //   为什么阈值用 INDEXTTS_MIN_FREE_MIB：core/tts/tts_indextts.py 的 VRAM_MIN_MIB 就是这个变量
  //   （默认 6700 = 本机最长参考音 13.5s 的实测峰值增量上界 6468 + 4% 余量）。
  //   这里用**同一个变量、同一个默认值**，两边口径天然一致 —— 设 0 两边都关（真关掉这道检查）。
  //   ★ 2026-10-05 修：该变量**已经能**传到 python —— 见下面 TTS 段里往 WSL 脚本 export 的那几行
  //     （外层 WSL python 读到 → 翻译成 argv → 内层）。所以这里与 python 两侧口径一致：
  //     设同一个值，两边都按它判，不再是「只放宽这一侧、python 仍按 6700 拦」。
  const vramRes = await ensureVramFree(Number(process.env.INDEXTTS_MIN_FREE_MIB ?? 6700),
    { label: 'TTS 合成', relaxEnv: 'INDEXTTS_MIN_FREE_MIB' });
  if (!vramRes.ok) die(vramRes.message);

  // ── 2. TTS ──
  // ★ lines.json / dur.json 是交付物，放 --out 里；逐句 wav 放 _tts 子目录，成功后再清。
  // ★ 为什么不用 WSL /tmp 放这些：TTS 的真正执行体是**Windows** 进程（脚本自重入到便携版 venv），
  //   让它去写 \\wsl.localhost\... 是把网络盘塞给 mkvirtualenv 级别的路径，得不偿失。
  //   编排用的 bash 脚本仍然落在 D:\WSL（非 C 盘），临时产物也都在非 C 盘。
  const linesHost = path.join(outDir, 'lines.json');
  const durHost = path.join(outDir, 'dur.json');
  const ttsOutHost = path.join(outDir, '_tts');
  fs.mkdirSync(ttsOutHost, { recursive: true });
  fs.writeFileSync(linesHost, JSON.stringify(lines, null, 1), 'utf8');

  step(2, `TTS 合成（Index-TTS 2.5 本地，${lines.length} 句一次进程批量）`);
  say(`  ${C.d}首次加载模型 1~2 分钟、每句约 30 秒，这是正常的，别因为"没动静"就中断。${C.x}`);
  const t0 = Date.now();
  // ★ TTS 的「内层读」配置必须**在 WSL 脚本里 export**（2026-10-05 修）。
  //   为什么：真正读这几项的是**内层**（Windows venv 的 python），而 WSL→Windows interop
  //   不传环境变量（实测）。core/tts/tts_indextts.py 的解法是让**外层**（WSL 里那个 python）
  //   读、再翻译成 `--engine=… --quant=… --device=… --min-free-mib=…` 交给内层
  //   （见该文件的 INNER_OPTS / apply_inner_argv）—— 即「外层 export 有效」。外层就是本脚本
  //   拉起的这段 bash。★ 而 Windows→WSL 也不传（实测：Windows 侧设了 INDEXTTS_MIN_FREE_MIB，
  //   `wsl.exe -e bash -lc 'echo $INDEXTTS_MIN_FREE_MIB'` 仍是空）⇒ 不在这里 export，
  //   这个变量从 dub 路径就**永远到不了** python（一个假逃生口）。
  //   ★ 清单必须与 tts_indextts.py 的 INNER_OPTS 保持一致；只导出**确实设了**的那些（不设就不导出，
  //     内层保持自己的默认值）。值一律经 shq() 转义（可能含引号/空格）。
  const ttsEnvLines = ['INDEXTTS_ENGINE', 'INDEXTTS_QUANT', 'INDEXTTS_DEVICE', 'INDEXTTS_MIN_FREE_MIB']
    .filter((k) => process.env[k] != null && process.env[k] !== '')
    .map((k) => `export ${k}=${shq(process.env[k])}`);
  const ttsScript = [
    ...ttsEnvLines,
    `cd ${shq(CFG.wslLib)} || { echo "找不到库 ${CFG.wslLib}"; exit 1; }`,
    `.venv/bin/python core/tts/tts_indextts.py ${shq(winToWsl(linesHost))} ${shq(winToWsl(ttsOutHost))}`,
    `rc=$?`,
    `[ $rc -ne 0 ] && { echo "TTS_FAIL rc=$rc"; exit $rc; }`,
    `echo "TTS_DONE"`,
  ].join('\n');
  const tts = await runWsl(ttsScript, { name: 'dub-tts', timeout: 3600_000, echo: o.echo });
  process.stdout.write(String(tts.stdout).replace(/\r/g, ''));
  if (tts.stderr) process.stderr.write(String(tts.stderr).replace(/\r/g, ''));
  if (tts.code !== 0 || !String(tts.stdout).includes('TTS_DONE')) {
    die(`TTS 失败（退出码 ${tts.code}）—— 上面最后几行是库侧的原始报错。产物目录保留：${outDir}`);
  }
  ok(`TTS 完成，用时 ${f2((Date.now() - t0) / 1000)}s`);

  // ★ 实测：tts_indextts.py 把 dur.json 写在**它自己的 out_dir** 里（= 这里的 _tts/），
  //   不是父目录。dur.json 是交付物，这里读出来后复制一份到 --out 根。
  const durSrcHost = fs.existsSync(path.join(ttsOutHost, 'dur.json')) ? path.join(ttsOutHost, 'dur.json') : durHost;
  if (!fs.existsSync(durSrcHost)) die(`TTS 说成功了但没找到 dur.json（找过 ${path.join(ttsOutHost, 'dur.json')} 和 ${durHost}）`);
  fs.copyFileSync(durSrcHost, durHost);
  const durJson = JSON.parse(fs.readFileSync(durSrcHost, 'utf8'));
  // dur.json 形状兼容：{id:秒} 或 [{id,dur}] 或 [{id,duration}]
  const durMap = new Map();
  if (Array.isArray(durJson)) {
    for (const d of durJson) durMap.set(String(d.id), Number(d.dur ?? d.duration ?? d.seconds));
  } else {
    for (const [k, v] of Object.entries(durJson)) durMap.set(String(k), Number(typeof v === 'object' ? (v.dur ?? v.duration) : v));
  }
  const durs = lines.map((L) => {
    const d = durMap.get(L.id);
    if (!Number.isFinite(d) || d <= 0) die(`dur.json 里没有 ${L.id} 的有效时长（读到 ${JSON.stringify(durMap.get(L.id))}）`);
    const w = path.join(ttsOutHost, `${L.id}.wav`);
    if (!fs.existsSync(w)) die(`缺少合成结果 ${w}`);
    return d;
  });

  // ── 3. 时间轴 ──
  const { items, total } = buildTimeline(lines, durs, o.gap);
  const titleDur = o.title ? Math.min(2.5, durs[0]) : 0;
  step(3, `时间轴（TTS 真实时长）`);
  say(`  ${'id'.padStart(4)}  ${'t0'.padStart(8)} ${'t1'.padStart(8)} ${'dur'.padStart(7)}   ${'字幕窗'.padEnd(19)} 文本`);
  for (const it of items) {
    say(`  ${it.id.padStart(4)}  ${f3(it.t0).padStart(8)} ${f3(it.t1).padStart(8)} ${f3(it.dur).padStart(7)}   ` +
      `${`${f3(it.sub0)}→${f3(it.sub1)}`.padEnd(19)} ${it.text}`);
  }
  say(`  ${C.b}总时长 ${f3(total)}s${C.x}${o.title ? `（片头标题 ${f2(titleDur)}s）` : ''}`);
  const lastIt = items[items.length - 1];
  if (lastIt.sub1 > total + 1e-6) die(`内部错误：末条字幕 ${f3(lastIt.sub1)} 越出片长 ${f3(total)}`);

  fs.writeFileSync(path.join(outDir, 'timeline.json'),
    JSON.stringify(items.map(({ id, text, t0, t1, dur }) => ({ id, text, t0, t1, dur })), null, 1), 'utf8');
  fs.writeFileSync(path.join(outDir, 'film.srt'), buildSrt(items), 'utf8');
  const assHost = path.join(outDir, '_sub.ass');
  // ── 字体（libass 不认 woff2，必须 ttf/otf/ttc）──
  step(4, '字体与字幕');
  const { fontFamily, fontDirWsl } = prepareFonts(style);
  fs.writeFileSync(assHost, buildAss(items, {
    W, H, title: o.title, titleDur, fontFamily, style,
    segments: (sem && Array.isArray(sem.segments)) ? sem.segments : null, total,
  }), 'utf8');
  ok(`字体族 ${fontFamily}，fontsdir=${fontDirWsl}`);
  const probeSub = await runWsl(`ffmpeg -hide_banner -filters 2>/dev/null | grep -E '^ .* (subtitles|ass) ' || true`, { name: 'dub-cap' });
  if (!/subtitles/.test(String(probeSub.stdout))) die('这个 ffmpeg 没编 libass（subtitles 滤镜缺失），无法烧字幕');
  ok('ffmpeg 带 libass，用 subtitles= 滤镜烧 ASS 字幕（含片头标题）');

  // ── 5. 配音轨拼装 ──
  // ★ 所有媒体命令都在 outDir 里跑（`cd` 进去），脚本内部一律用**相对路径**：
  //   ffmpeg 的 filtergraph 里 `:` 和 `'` 都是分隔符，绝对路径（尤其带空格/冒号的）写进去
  //   必然要转义；相对路径从根上避免这件事。用户给的外部素材仍用绝对路径，但由 bash 引号兜住。
  step(5, '配音轨拼装 + 响度/真峰值归一');
  const CD = `cd ${shq(outWsl)} || { echo "cd 失败: ${outWsl}"; exit 1; }`;
  const wavs = lines.map((L) => `_tts/${L.id}.wav`);
  const adelay = items.map((it, i) => `[${i}:a]aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo,adelay=delays=${Math.round(it.t0 * 1000)}:all=1[a${i}]`).join(';');
  const amixIn = items.map((_, i) => `[a${i}]`).join('');
  const buildRaw = [
    `ffmpeg -hide_banner -nostdin -y ${wavs.map((w) => `-i ${shq(w)}`).join(' ')}`,
    `-filter_complex ${shq(`${adelay};${amixIn}amix=inputs=${items.length}:normalize=0:duration=longest[out]`)}`,
    `-map "[out]" -t ${f3(total)} -ar 48000 -ac 2 -c:a pcm_s16le -y _program_raw.wav`,
  ].join(' ');

  // 素材原声（可选）：压到 -20 dB 当底噪。fit=slow 时素材被放慢，原声要同步 atempo。
  let srcDur = null;
  if (form === 'B') {
    const p = await probe(winToWsl(videoHost));
    srcDur = p.dur;
    if (!srcDur) warn(`探不到素材时长（ffprobe 没给），--fit 只能按 trim 处理`);
  }
  const atempoChain = (x) => {
    const parts = [];
    let v = x;
    while (v < 0.5 - 1e-9) { parts.push('atempo=0.5'); v /= 0.5; }
    while (v > 100) { parts.push('atempo=100'); v /= 100; }
    parts.push(`atempo=${v.toFixed(6)}`);
    return parts.join(',');
  };
  let programSrc = '_program_raw.wav';
  if (o.keepOriginalAudio && form === 'B') {
    let ratio = 1;
    if (o.fit === 'slow' && srcDur && srcDur < total) ratio = total / srcDur;
    const bgChain = ratio > 1.0001 ? `${atempoChain(1 / ratio)},` : '';
    const mix = [
      `ffmpeg -hide_banner -nostdin -y -i _program_raw.wav -i ${shq(winToWsl(videoHost))}`,
      `-filter_complex ${shq(`[1:a]aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo,${bgChain}volume=-20dB,atrim=0:${f3(total)},asetpts=N/SR/TB[bga];[0:a][bga]amix=inputs=2:duration=first:normalize=0[out]`)}`,
      `-map "[out]" -t ${f3(total)} -ar 48000 -ac 2 -c:a pcm_s16le _program_mix.wav`,
    ].join(' ');
    const r = await runWsl(CD + '\n' + buildRaw + '\n' + mix, { name: 'dub-mix', echo: o.echo });
    if (r.code !== 0) die(`配音/原声混合失败:\n${r.stderr}`);
    programSrc = '_program_mix.wav';
    ok('素材原声已压到 -20 dB 混入（--keep-original-audio）');
  } else {
    const r = await runWsl(CD + '\n' + buildRaw, { name: 'dub-audio', echo: o.echo });
    if (r.code !== 0) die(`配音轨拼装失败:\n${r.stderr}`);
  }

  const m0 = await measure(winToWsl(path.join(outDir, programSrc)));
  if (m0.peak === null) die('量不到拼装后音频的峰值');
  // ★ 这里量的是**拼装后的 PCM（WAV）**，纯增益缩放不会造出码间峰值 —— 码间峰值是 **AAC 编码**
  //   阶段引入的。实测（backrooms，形态 A）：PCM 的采样峰值与真峰值只差 **0.015 dB**
  //   （编码前 PCM 采样峰 −1.700 vs 成片真峰 −1.690），所以此处用采样峰值**可忽略误差**，
  //   刻意不改（改了会让增益变小、把响度推离目标，收益近零）。
  //   ★ 真正要小心的是**成片**（AAC）那一侧：那里采样峰值与真峰值实测最大差 **1.62 dB**，
  //     判据必须用 loudnorm 的 input_tp（见本文件下方两处 truePeak 判据）。
  const gainPeak = TARGET_PEAK_PCM - m0.peak;
  const gainLoud = m0.lufs === null ? Infinity : (targetLufs - m0.lufs);
  let gain = Math.min(gainPeak, gainLoud);
  // ★★ 2026-10-04 补：两个目标**冲突**时改走「按响度目标增益 + 峰值限幅」。
  //   由来（实测）：TTS 语音的**波峰因数高**，「取更保守的那个」会被**峰值上限**卡住 ——
  //   功能1 实跑 1080x1920 那条：拼装后 −30.3 LUFS / 峰值 −14.78 dBFS，
  //   gainPeak = +13.08、gainLoud = +16.30 ⇒ 取 13.08 ⇒ 成片响度只到 **−17.3 LUFS**，
  //   离风格声明的 **−14** 差 **3.3 LU**（听感明显偏轻）。
  //   纯增益在数学上**不可能**同时满足峰值与响度（这是 `audio-delivery-caliber` 那条结论）：
  //   要两个都满足，必须**限幅**（压掉峰值、把响度顶上去）。
  //   ⇒ 判据：只有当「峰值上限」比「响度目标」更保守、且差 > 1 LU 时才启用限幅；
  //     差距 ≤ 1 LU 时**保持原行为逐字节不变**（不动既有输出）。
  const LUFS_SHORTFALL_LIMIT = 1.0;
  let limiter = '';
  if (Number.isFinite(gainLoud) && gainPeak < gainLoud - LUFS_SHORTFALL_LIMIT) {
    gain = gainLoud;
    // `level=disabled` = 只压峰、**不改电平**（否则 alimiter 会自动抬电平，把响度又推走）
    limiter = `,alimiter=limit=${TARGET_PEAK_PCM}dB:level=disabled`;
  }
  say(`  拼装后 峰值 ${f3(m0.peak)} dBFS · 集成响度 ${m0.lufs === null ? 'n/a' : f3(m0.lufs)} LUFS`);
  say(`  施加增益 ${gain >= 0 ? '+' : ''}${f2(gain)} dB（峰值上限 ${TARGET_PEAK_PCM} dBFS / 响度目标 ${targetLufs} LUFS${targetLufs !== TARGET_LUFS ? '，来自风格特质' : ''}${limiter ? `；两者相差 ${f2(gainLoud - gainPeak)} dB ⇒ 按响度目标增益 + 峰值限幅 ${TARGET_PEAK_PCM} dBFS，两个目标同时满足` : '，取更保守的那个'}）`);
  const rGain = await runWsl(
    `${CD}\nffmpeg -hide_banner -nostdin -y -i ${shq(`./${programSrc}`)} -af ${shq(`volume=${gain.toFixed(4)}dB${limiter}`)} -ar 48000 -ac 2 -c:a pcm_s16le -y _program.wav`,
    { name: 'dub-gain', echo: o.echo });
  if (rGain.code !== 0) die(`增益失败:\n${rGain.stderr}`);
  const m1 = await measure(winToWsl(path.join(outDir, '_program.wav')));
  ok(`编码前 PCM：峰值 ${f3(m1.peak)} dBFS · 响度 ${m1.lufs === null ? 'n/a' : f3(m1.lufs)} LUFS`);

  // ── 6. 画面 ──
  const spec = styleSpec(style, { W, H });
  const bgExtra = form === 'B' ? '' : bgFilters(spec, { W, H, dur: total });   // plain-dark → ''
  step(6, form === 'B'
    ? `画面：素材铺满 ${W}x${H}（保持比例居中裁切，fit=${o.fit}）`
    : `画面：生成 ${W}x${H} 背景（风格 ${style.id}${bgExtra ? '：' + bgExtra : '：内置渐变，无附加滤镜'}）`);
  const subFilter = `subtitles=_sub.ass:fontsdir=${fontDirWsl}`;
  // ★ 画面几何只此一处：形态 B 的素材、形态 A 的 --bg 背景图**共用同一条**链
  //   （保持比例 + 居中裁切到 --size，绝不拉伸变形）。--bg 不是独立实现。
  const geom = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
  const fitFilter = (() => {
    if (form !== 'B') return '';
    if (o.fit === 'slow' && srcDur && srcDur < total - 0.05) {
      const ratio = total / srcDur;
      say(`  ${C.d}素材 ${f3(srcDur)}s < 配音 ${f3(total)}s → setpts=PTS*${f3(ratio)}（整体放慢，观感会变）${C.x}`);
      return `${geom},setpts=PTS*${ratio.toFixed(6)}`;
    }
    if (o.fit === 'trim') {
      if (srcDur && srcDur < total - 0.05) {
        say(`  ${C.d}素材 ${f3(srcDur)}s < 配音 ${f3(total)}s → trim 模式下用 tpad 冻结末帧补足（不循环）${C.x}`);
        return `${geom},tpad=stop_mode=clone:stop_duration=${f3(total - srcDur + 1)}`;
      }
      say(`  ${C.d}素材 ${f3(srcDur ?? NaN)}s ≥ 配音 ${f3(total)}s → trim 裁到 ${f3(total)}s${C.x}`);
      return geom;
    }
    // loop（默认）
    if (srcDur && srcDur < total - 0.05) say(`  ${C.d}素材 ${f3(srcDur)}s < 配音 ${f3(total)}s → -stream_loop -1 循环播放${C.x}`);
    else say(`  ${C.d}素材 ${f3(srcDur ?? NaN)}s ≥ 配音 ${f3(total)}s → 输出 -t 裁到 ${f3(total)}s${C.x}`);
    return geom;
  })();

  const inArgs = [];
  if (form === 'B') {
    if (o.fit === 'loop') inArgs.push('-stream_loop', '-1');
    inArgs.push('-i', winToWsl(videoHost));
  } else if (bgHost) {
    inArgs.push('-loop', '1', '-i', winToWsl(bgHost));
  } else {    // 内置背景：按风格的 bgRecipe 生成（plain-dark = 旧的深色三色渐变，seed 固定）
    // ★ seed 必须固定：gradients 默认 seed=-1（随机），不固定的话每次跑的底图都不一样，
    //   同一个文案两次出片画面不一致（实测踩到，排查时一度以为是色彩范围出了问题）。
    inArgs.push('-f', 'lavfi', '-i', bgSource(spec, { W, H, dur: total }));
  }
  inArgs.push('-i', '_program.wav');

  const vf = [
    form === 'B' ? fitFilter : (bgHost ? geom : ''),
    'fps=30',
    bgExtra,
    subFilter,
    'format=yuv420p',
  ].filter(Boolean).join(',');

  const mux = [
    'ffmpeg -hide_banner -nostdin -y',
    inArgs.map((s) => (s.startsWith('_') || s.startsWith('/') || s.startsWith('0x') || /^-/.test(s) ? s : shq(s))).join(' '),
    `-filter_complex ${shq(`[0:v]${vf}[v]`)}`,
    `-map "[v]" -map 1:a -t ${f3(total)}`,
    `${VARG} -r 30`,   // ★ 编码器唯一决策点（LEMO_VENC 三分支），见文件头；-r 30 是输出帧率，非编码器参数
    // ★ 显式打色彩标记：nvenc 默认不写 color_range，成片里是 "unknown"，
    //   播放器只能猜（猜成 full range 就会整体发灰）。标记成 tv/bt709 后解码路径唯一。
    '-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709',
    '-c:a aac -b:a 192k -ar 48000 -ac 2',
    '-movflags +faststart',
    'film.mp4',
  ].join(' ');
  const rMux = await runWsl(CD + '\n' + mux, { name: 'dub-mux', echo: o.echo });
  if (rMux.code !== 0) die(`编码/混流失败:\n${rMux.stderr}`);
  ok('film.mp4 已生成');

  // ── 7. 自检 ──
  step(7, '自检');
  const fp = await probe(winToWsl(path.join(outDir, 'film.mp4')));
  say(`  分辨率 ${fp.w}x${fp.h} · 帧率 ${fp.fps} · 时长 ${f3(fp.dur)}s · 视频 ${fp.vcodec}`);
  say(`  音轨 ${fp.acodec} ${fp.sr}Hz ${fp.ach}ch · 音频时长 ${f3(fp.adur)}s`);
  const dv = Math.abs(fp.dur - total), da = Math.abs(fp.adur - total);
  say(`  目标时长 ${f3(total)}s → 视频差 ${f3(dv)}s · 音频差 ${f3(da)}s`);
  if (fp.w !== W || fp.h !== H) bad(`尺寸不符：期望 ${W}x${H}`);
  else ok('尺寸正确');
  if (dv < 0.1 && da < 0.1) ok('音视频时长与目标对齐（<0.1s）');
  else bad(`时长差超标（视频 ${f3(dv)}s / 音频 ${f3(da)}s）`);

  const mf = await measure(winToWsl(path.join(outDir, 'film.mp4')));
  // ★ 2026-10-03：同上，判据用**真峰值**（loudnorm input_tp），不用 astats 采样峰值。
  const mfTP = mf.truePeak !== null ? mf.truePeak : mf.peak;
  say(`  ${C.b}成片实测：真峰值 ${f3(mf.truePeak)} dBTP · 采样峰值(astats) ${f3(mf.peak)} dBFS · 集成响度 ${mf.lufs === null ? 'n/a' : f3(mf.lufs)} LUFS${C.x}`);
  if (mfTP === null) bad('量不到成片峰值');
  else if (mfTP <= HARD_PEAK_LIMIT) ok(`真峰值 ${f3(mfTP)} ≤ ${HARD_PEAK_LIMIT} dBTP，达标`);
  else bad(`真峰值 ${f3(mfTP)} > ${HARD_PEAK_LIMIT} dBTP —— 超标，请把目标 PCM 峰值再降`);

  // 抽帧（写到 out 的兄弟目录，不污染交付目录）
  const verifyDir = path.join(CFG.outRoot, '_verify', path.basename(outDir));
  fs.mkdirSync(verifyDir, { recursive: true });
  const picks = [items[0], items[Math.floor(items.length / 2)], items[items.length - 1]];
  const frames = [];
  for (let i = 0; i < picks.length; i++) {
    const tt = (picks[i].sub0 + picks[i].sub1) / 2;
    const name = `frame${i + 1}_t${tt.toFixed(2)}.png`;
    const r = await runWsl(
      `ffmpeg -hide_banner -nostdin -y -ss ${f3(tt)} -i ${shq(winToWsl(path.join(outDir, 'film.mp4')))} -frames:v 1 -vf scale=540:-1 ${shq(winToWsl(path.join(verifyDir, name)))}`,
      { name: 'dub-frame' });
    if (r.code === 0) frames.push({ file: path.join(verifyDir, name), t: tt, text: picks[i].text });
    else warn(`抽帧失败 t=${f3(tt)}`);
  }
  say(`  抽帧 → ${verifyDir}`);

  // 清理中间产物（成功才清）
  try {
    fs.rmSync(ttsOutHost, { recursive: true, force: true });
    for (const f of ['_program_raw.wav', '_program_mix.wav', '_program.wav', '_sub.ass']) {
      fs.rmSync(path.join(outDir, f), { force: true });
    }
  } catch { /* ignore */ }

  step(8, '交付');
  for (const f of ['film.mp4', 'film.srt', 'lines.json', 'dur.json', 'timeline.json']) {
    const p = path.join(outDir, f);
    say(`  ${fs.existsSync(p) ? '✓' : '✗'} ${f.padEnd(14)} ${fs.existsSync(p) ? (fs.statSync(p).size / 1024).toFixed(1) + ' KB' : '缺失'}`);
  }
  say(`\n${C.b}${C.g}完成${C.x}  ${path.join(outDir, 'film.mp4')}`);
  say(JSON.stringify({ out: outDir, total, peak: mf.peak, truePeak: mf.truePeak, lufs: mf.lufs, frames: frames.map((f) => f.file), verify: verifyDir }));

  if (o.verifyTriple) await runTripleCheck({ filmHost: path.join(outDir, 'film.mp4'), scriptText: raw, outDir });
}

main().catch((e) => { bad(`未捕获异常: ${e?.stack || e}`); process.exit(1); });
