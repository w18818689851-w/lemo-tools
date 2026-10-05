#!/usr/bin/env node
/**
 * scripts/patch-render-venc.mjs —— 把「渲染一律 GPU 优先」硬规则回灌到所有**编码器决策点**
 *
 * ★ 用户硬规则（最高优先级）：
 *     「渲染必须用我的显卡 GPU 跑，整个项目只要涉及渲染都要 GPU 优先渲染」
 *
 * ★ 统一判据（凡决定「用哪个视频编码器」的地方）：
 *     未设 LEMO_VENC ⇒ h264_nvenc（GPU 优先）；
 *     显式 libx264  ⇒ 才走 CPU；
 *     其它任何值    ⇒ 报错退出（**绝不静默走 CPU** —— 把 h264_nvenc 打成 h264_nven
 *                     会以为在用显卡、实际走 CPU，这类静默回落是本规则最危险的破口）。
 *
 * 背景：`core/render/video.mjs` / `core/render/mux.sh` / 9 个 `styles/<slug>/demo/tools/mux.sh`
 *   原来都是「未设 ⇒ 静默 libx264(CPU)」；B 类 15 个手工脚本则硬写 libx264。
 *   编排器 `lemo-make.mjs` 默认导出 LEMO_VENC=h264_nvenc（出片路径本来就走 GPU），
 *   但**手工构建**（`sh styles/<slug>/demo/build.sh`）不设该变量 ⇒ 改之前手工出片走 CPU。
 *
 * ★ 本脚本幂等：每个变换先判「是否已是新形态」，是则跳过；否则做精确替换。
 * ★ 两份副本一起写：`D:/lemo-opuscar` 与 WSL `/home/lemo/lemo-opuscar`（写前 `tr -d "\r"`）。
 * ★ 自检：shell 过 `sh -n`、`.mjs` 过 `node --check`（两侧都查）。
 *
 * 用法：node scripts/patch-render-venc.mjs [--dry] [--only rel1,rel2]
 * 退出码：任一步失败 → 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WIN = process.env.LEMO_OPUSCAR_WIN || path.resolve(HERE, '..', '..', 'lemo-opuscar');
const WSL = '/home/lemo/lemo-opuscar';
const DISTRO = 'Ubuntu-24.04';
const NODE = process.env.LEMO_NODE || 'C:/Users/Admin/.workbuddy-ai/binaries/node/versions/22.22.2-3/node.exe';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const only = (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

const ERR_MSG =
  "LEMO_VENC must be h264_nvenc or libx264, or unset (which means h264_nvenc, the GPU encoder), got '$LEMO_VENC'. " +
  'Not falling back to the CPU encoder silently: a typo would look like GPU encoding while libx264 does the work.';

// ─────────────────────────────────────────────────────────────────────────────
// 变换函数（每个都幂等）
// ─────────────────────────────────────────────────────────────────────────────

/** 9 个 styles/<slug>/demo/tools/mux.sh：把 `*|libx264)` 静默回落改成 GPU 优先 + 非法报错。 */
const STYLE_CASE = `case "\${LEMO_VENC:-}" in
  ''|h264_nvenc) VARG="-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq $(awk -v c="$CRF" 'BEGIN{printf "%d",(c+0)+4}') -b:v 0";;
  libx264) VARG="-c:v libx264 -preset slow -crf $CRF $TUNE";;
  *) echo "mux.sh: ${ERR_MSG}" >&2; exit 1;;
esac
`;

function patchStyleMux(text) {
  if (text.includes("''|h264_nvenc)")) return { text, changed: false, why: '已是 GPU 优先形态' };
  const re = /case "\$\{LEMO_VENC:-\}" in\n[\s\S]*?\nesac\n/;
  if (!re.test(text)) return { text, changed: false, why: '找不到 LEMO_VENC case 块' };
  let out = text.replace(re, STYLE_CASE);
  out = out.replace(
    '#   ② 编码器跟随 LEMO_VENC（编排器默认导出 h264_nvenc）—— 硬规则：合成渲染走本地 GPU',
    '#   ② 编码器 **GPU 优先**：未设 LEMO_VENC ⇒ h264_nvenc；显式 libx264 才走 CPU；其它值报错退出（硬规则：渲染/合成一律本地 GPU）');
  return { text: out, changed: true, why: '未设/非法不再静默回落 CPU' };
}

/** core/render/mux.sh：同上，但 nvenc 的 cq 用 LEMO_NVENC_CQ，报错用其自带 die()。 */
const CORE_CASE = `# 视频编码器：**未设 LEMO_VENC ⇒ 走 GPU 的 h264_nvenc**（用户硬规则：渲染/合成一律 GPU 优先）；
# 显式 libx264 才走 CPU；其它值**报错退出**，绝不静默回落 libx264
# （否则把 h264_nvenc 打成 h264_nven 会以为在用显卡、实际走 CPU）。
# NVENC 的 cq 数值越小画质越高、体积越大（LEMO_NVENC_CQ 可调，默认 23）：
#   cq 23 ≈ 对齐上游 libx264 -crf 19（实测体积 0.99x、画质持平、约快 2.7x）
#   cq 19 画质更高（SSIM +0.002 / PSNR +3.4 dB）但体积约 1.85x
case "\${LEMO_VENC:-}" in
  ''|h264_nvenc) VARG="-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq \${LEMO_NVENC_CQ:-23} -b:v 0";;
  libx264) VARG="-c:v libx264 -preset slow -crf 19";;
  *) die "${ERR_MSG}";;
esac
`;

function patchCoreMux(text) {
  if (text.includes("''|h264_nvenc)")) return { text, changed: false, why: '已是 GPU 优先形态' };
  const re = /# 视频编码器：默认与上游完全一致（libx264 crf19 slow）；LEMO_VENC=h264_nvenc 换成 NVENC\n[\s\S]*?\nesac\n/;
  if (!re.test(text)) return { text, changed: false, why: '找不到旧编码器注释 + case 块' };
  return { text: text.replace(re, CORE_CASE), changed: true, why: '未设不再静默 libx264；非法值保持报错' };
}

/** core/render/video.mjs：默认值 libx264 → h264_nvenc，并加「非法值报错退出」。 */
function patchCoreVideo(text) {
  if (text.includes("process.env.LEMO_VENC || 'h264_nvenc'")) return { text, changed: false, why: '已是 GPU 优先形态' };
  const old =
    "  // 编码器可选：LEMO_VENC=h264_nvenc 用 NVIDIA 硬件编码（GPU 出片），默认 libx264（CPU）。\n" +
    "  const VENC = process.env.LEMO_VENC || 'libx264';\n";
  if (!text.includes(old)) return { text, changed: false, why: '找不到旧默认值块' };
  const neu =
    '  // 编码器：**未设 LEMO_VENC ⇒ 走 GPU 的 h264_nvenc**（用户硬规则：渲染一律 GPU 优先）；\n' +
    "  // 显式 libx264 才走 CPU；其它值报错退出，绝不静默回落 CPU\n" +
    '  // （把 h264_nvenc 打成 h264_nven 会以为在用显卡、实际走 CPU）。\n' +
    "  const VENC = process.env.LEMO_VENC || 'h264_nvenc';\n" +
    "  if (VENC !== 'h264_nvenc' && VENC !== 'libx264') fail(`LEMO_VENC must be h264_nvenc or libx264, or unset (which means h264_nvenc, the GPU encoder), got '${VENC}'. Refusing to fall back to the CPU encoder silently.`);\n";
  return { text: text.replace(old, neu), changed: true, why: "默认 'libx264' → 'h264_nvenc' + 非法值 fail()" };
}

// ── B 类：手工脚本（不在编排器出片路径上，但「整个项目」都要 GPU 优先）──

const MJS_HEAD =
  '// 编码器：**未设 LEMO_VENC ⇒ 走 GPU 的 h264_nvenc**（用户硬规则：渲染一律 GPU 优先）；\n' +
  '// 显式 libx264 才走 CPU；其它值报错退出，绝不静默回落 CPU（把 h264_nvenc 打错会以为在用显卡、实际走 CPU）。\n' +
  "const VENC = process.env.LEMO_VENC || 'h264_nvenc';\n" +
  "if (VENC !== 'h264_nvenc' && VENC !== 'libx264') { console.error(`LEMO_VENC must be h264_nvenc or libx264, or unset (which means h264_nvenc, the GPU encoder), got '${VENC}'. Refusing to fall back to the CPU encoder silently.`); process.exit(1); }\n" +
  '// 编码参数：nvenc 的 cq ≈ 原 libx264 的 crf + 5；显式 libx264 时保持原参数。\n' +
  "const vencArgs = (crf, preset = 'medium') => VENC === 'h264_nvenc'\n" +
  "  ? ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', String(crf + 5), '-b:v', '0']\n" +
  "  : ['-c:v', 'libx264', '-preset', preset, '-crf', String(crf)];\n";

const MJS_HEAD_444 =
  '// 编码器：**未设 LEMO_VENC ⇒ 走 GPU 的 h264_nvenc**（用户硬规则：渲染一律 GPU 优先）；\n' +
  '// 显式 libx264 才走 CPU；其它值报错退出，绝不静默回落 CPU。\n' +
  '// ⚠️ 本脚本是**无损中间片**（qp 0 / yuv444p）：nvenc 分支用 constqp 0 + high444p，见下方风险说明。\n' +
  "const VENC = process.env.LEMO_VENC || 'h264_nvenc';\n" +
  "if (VENC !== 'h264_nvenc' && VENC !== 'libx264') { console.error(`LEMO_VENC must be h264_nvenc or libx264, or unset (which means h264_nvenc, the GPU encoder), got '${VENC}'. Refusing to fall back to the CPU encoder silently.`); process.exit(1); }\n" +
  "const VARG444 = VENC === 'h264_nvenc'\n" +
  "  ? ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'constqp', '-qp', '0', '-profile', 'high444p']\n" +
  "  : ['-c:v', 'libx264', '-preset', 'medium', '-qp', '0'];\n";

/** 在最后一个顶层 import 之后注入编码器块（这些 .mjs 都有 import 头）。 */
function injectAfterImports(text, block) {
  const lines = text.split('\n');
  let last = -1;
  for (let i = 0; i < lines.length; i++) if (/^import\b/.test(lines[i])) last = i;
  if (last < 0) return null;
  lines.splice(last + 1, 0, '', block.replace(/\n$/, ''));
  return lines.join('\n');
}

/** B 类 .mjs：注入 VENC 块 + 把硬写的 libx264 token 换成 ...vencArgs(crf[, preset])。
 *  ★ 顺序必须是「先换 token、再注入」——否则注入块自带的 libx264 字面量会被自己的 token 误伤。 */
function patchMjs(rep) {
  return (text) => {
    if (text.includes('const VENC = process.env.LEMO_VENC')) return { text, changed: false, why: '已是 GPU 优先形态' };
    if (!rep.tokens.some((t) => text.includes(t.from))) return { text, changed: false, why: '找不到 libx264 token' };
    let out = text;
    for (const t of rep.tokens) out = out.split(t.from).join(t.to);
    out = injectAfterImports(out, rep.head || MJS_HEAD);
    if (out == null) return { text, changed: false, why: '找不到 import 头，无法注入' };
    return { text: out, changed: true, why: rep.why || '注入 VENC + 替换 libx264 token' };
  };
}

/** B 类 shell：把硬写的 libx264 token 换成 $VARG，再在 anchor 之后注入 case 块。
 *  ★ 同样「先换 token、再注入」，避免注入块的 libx264 分支被自己的 token 误伤。 */
function patchShell(rep) {
  return (text) => {
    if (text.includes('LEMO_VENC')) return { text, changed: false, why: '已含 LEMO_VENC（跳过）' };
    if (!text.includes(rep.anchor)) return { text, changed: false, why: '找不到注入锚点' };
    if (!rep.tokens.some((t) => text.includes(t.from))) return { text, changed: false, why: '找不到 libx264 token' };
    let out = text;
    for (const t of rep.tokens) out = out.split(t.from).join(t.to);
    out = out.replace(rep.anchor, `${rep.anchor}\n${rep.block}`);
    return { text: out, changed: true, why: rep.why || '注入 VARG + 替换 libx264 token' };
  };
}

/** 生成一个 shell 的 case 块。 */
function shBlock({ nvenc, libx264, tag = 'mux.sh' }) {
  return `# 视频编码器：**未设 LEMO_VENC ⇒ 走 GPU 的 h264_nvenc**（用户硬规则：渲染一律 GPU 优先）；
# 显式 libx264 才走 CPU；其它值报错退出，绝不静默回落 CPU。
case "\${LEMO_VENC:-}" in
  ''|h264_nvenc) VARG="${nvenc}";;
  libx264) VARG="${libx264}";;
  *) echo "${tag}: ${ERR_MSG}" >&2; exit 1;;
esac`;
}

const SHELL_ERR_TAG = 'mux.sh';

// ── 一次性修复：本脚本第一版「先注入、后换 token」把注入块自带的 libx264 字面量
//    也替换掉了（4 个文件）。这里把它们还原成正确的 libx264 分支（幂等，不存在则无操作）。──
const REPAIRS = {
  'styles/risograph/demo/tools/video_png.mjs': (t) =>
    t.replace("  : [...VARG444];", "  : ['-c:v', 'libx264', '-preset', 'medium', '-qp', '0'];"),
  'styles/pictogram-motion/demo/mux.sh': (t) =>
    t.replace('  libx264) VARG="$VARG";;', '  libx264) VARG="-c:v libx264 -preset slow -crf 14 -profile:v high";;'),
  'styles/silent-film/demo/build.sh': (t) =>
    t.replace('  libx264) VARG="$VARG";;', '  libx264) VARG="-c:v libx264 -preset slow -crf 25 -tune grain";;'),
  'tools/web_cuts.sh': (t) =>
    t.replace('  libx264) VARG="$VARG";;', '  libx264) VARG="-c:v libx264 -preset slow -crf 24 -maxrate 2M -bufsize 4M";;'),
};

// ─────────────────────────────────────────────────────────────────────────────
// 目标表
// ─────────────────────────────────────────────────────────────────────────────
const NINE = ['backrooms', 'crayon-book', 'cel-anime-80s', 'microgame', 'spy-titles',
  'shadow-puppet', 'risograph', 'stained-glass', 'woodcut'];

const SPECS = [];

// ── A 类 ──
SPECS.push({ rel: 'core/render/video.mjs', kind: 'mjs', apply: patchCoreVideo });
SPECS.push({ rel: 'core/render/mux.sh', kind: 'sh', apply: patchCoreMux });
for (const slug of NINE) SPECS.push({ rel: `styles/${slug}/demo/tools/mux.sh`, kind: 'sh', apply: patchStyleMux });

// ── B 类 · .mjs ──
const T14 = [{ from: "'-c:v', 'libx264', '-preset', 'medium', '-crf', '14'", to: '...vencArgs(14)' }];
const T12 = [{ from: "'-c:v', 'libx264', '-preset', 'medium', '-crf', '12'", to: '...vencArgs(12)' }];

SPECS.push({ rel: 'styles/blueprint/demo/tools/video_range.mjs', kind: 'mjs', apply: patchMjs({ tokens: T14 }) });
SPECS.push({ rel: 'styles/hd-2d/demo/tools/render_range.mjs', kind: 'mjs', apply: patchMjs({ tokens: T14 }) });
SPECS.push({ rel: 'styles/paper-lantern/demo/render/video.mjs', kind: 'mjs', apply: patchMjs({ tokens: T12 }) });
SPECS.push({ rel: 'styles/paper-popup/demo/render.mjs', kind: 'mjs', apply: patchMjs({ tokens: T14 }) });
SPECS.push({ rel: 'styles/pictogram-motion/demo/render.mjs', kind: 'mjs', apply: patchMjs({ tokens: T12 }) });
SPECS.push({
  rel: 'styles/game-show/demo/render.mjs', kind: 'mjs',
  apply: patchMjs({ tokens: [{ from: "'-c:v', 'libx264', '-preset', 'slow', '-crf', '12'", to: "...vencArgs(12, 'slow')" }] }),
});
SPECS.push({
  rel: 'styles/halftone-dossier/demo/render.mjs', kind: 'mjs',
  apply: patchMjs({
    tokens: [
      { from: "'-c:v', 'libx264', '-preset', 'slow', '-crf', '16'", to: "...vencArgs(16, 'slow')" },
      { from: "'-c:v', 'libx264', '-preset', 'slow', '-crf', '12'", to: "...vencArgs(12, 'slow')" },
    ],
  }),
});
SPECS.push({
  rel: 'styles/watercolor/demo/render.mjs', kind: 'mjs',
  apply: patchMjs({ tokens: T12 }),
});
SPECS.push({
  rel: 'styles/risograph/demo/tools/video_png.mjs', kind: 'mjs',
  apply: patchMjs({ head: MJS_HEAD_444, tokens: [{ from: "'-c:v', 'libx264', '-preset', 'medium', '-qp', '0'", to: '...VARG444' }] }),
});

// ── B 类 · shell ──
SPECS.push({
  rel: 'styles/paper-popup/demo/mux.sh', kind: 'sh',
  apply: patchShell({
    anchor: 'LN_TP="${LEMO_LN_TP:--3.5}"',
    block: shBlock({ nvenc: '-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq 22 -b:v 0', libx264: '-c:v libx264 -preset slow -crf 17' }),
    tokens: [{ from: '-c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p', to: '$VARG -pix_fmt yuv420p' }],
  }),
});
SPECS.push({
  rel: 'styles/pictogram-motion/demo/mux.sh', kind: 'sh',
  apply: patchShell({
    anchor: 'OUT="${1:-$DEF}"',
    block: shBlock({ nvenc: '-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq 19 -b:v 0', libx264: '-c:v libx264 -preset slow -crf 14 -profile:v high' }),
    tokens: [{ from: '-c:v libx264 -preset slow -crf 14 -profile:v high', to: '$VARG' }],
  }),
});
SPECS.push({
  rel: 'styles/watercolor/demo/mux.sh', kind: 'sh',
  apply: patchShell({
    anchor: 'LN_TP="${LEMO_LN_TP:--3.5}"',
    block: shBlock({ nvenc: '-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq 21 -b:v 0', libx264: '-c:v libx264 -preset slow -crf 16' }),
    tokens: [{ from: '-c:v libx264 -preset slow -crf 16 -g 120', to: '$VARG -g 120' }],
  }),
});
SPECS.push({
  rel: 'styles/game-show/demo/finish.sh', kind: 'sh',
  apply: patchShell({
    anchor: 'O="${1:-../game-show.mp4}"',
    block: shBlock({ nvenc: '-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq 21 -b:v 0', libx264: '-c:v libx264 -preset slow -crf 16' }),
    tokens: [{ from: '-c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p', to: '$VARG -pix_fmt yuv420p' }],
  }),
});
SPECS.push({
  rel: 'styles/silent-film/demo/build.sh', kind: 'sh',
  apply: patchShell({
    anchor: 'PY=.venv/bin/python; D=styles/silent-film/demo; O=styles/silent-film',
    block: shBlock({ nvenc: '-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq 30 -b:v 0', libx264: '-c:v libx264 -preset slow -crf 25 -tune grain' }),
    tokens: [{ from: '-c:v libx264 -preset slow -crf 25 -tune grain', to: '$VARG' }],
  }),
});
SPECS.push({
  rel: 'tools/web_cuts.sh', kind: 'sh',
  apply: patchShell({
    anchor: 'fail=0',
    block: shBlock({ tag: 'web_cuts.sh', nvenc: '-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq 29 -b:v 0', libx264: '-c:v libx264 -preset slow -crf 24 -maxrate 2M -bufsize 4M' }),
    tokens: [{ from: '-c:v libx264 -preset slow -crf 24 -maxrate 2M -bufsize 4M', to: '$VARG' }],
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 执行
// ─────────────────────────────────────────────────────────────────────────────
function sh(cmd, args) {
  return new Promise((r) => {
    const c = spawn(cmd, args, { windowsHide: true });
    let o = '', e = '';
    c.stdout.on('data', (d) => { o += d; });
    c.stderr.on('data', (d) => { e += d; });
    c.on('close', (code) => r({ code, o, e }));
    c.on('error', (x) => r({ code: -1, o, e: String(x.message) }));
  });
}

const list = SPECS.filter((s) => !only.length || only.includes(s.rel));
console.log(`\n${DRY ? '[dry] ' : ''}GPU 优先回灌：${list.length} 个编码器决策点\n`);

let nChanged = 0, nSkip = 0, nFail = 0;
for (const s of list) {
  const winPath = path.join(WIN, s.rel);
  if (!fs.existsSync(winPath)) { console.log(`  ✘ ${s.rel}：WIN 侧不存在`); nFail++; continue; }
  const raw = fs.readFileSync(winPath, 'utf8').replace(/\r/g, '');
  const src = REPAIRS[s.rel] ? REPAIRS[s.rel](raw) : raw;
  const r = s.apply(src);
  const repairedOnly = !r.changed && src !== raw;
  if (!r.changed && !repairedOnly) { console.log(`  · ${s.rel}：跳过（${r.why}）`); nSkip++; continue; }
  const out = (r.changed ? r.text : src).replace(/\r/g, '');
  const why = r.changed ? r.why : '修复第一版误伤（libx264 分支被 token 替换）';

  if (DRY) { console.log(`  ~ ${s.rel}  ${why}`); nChanged++; continue; }

  fs.writeFileSync(winPath, out, 'utf8');

  // WIN 自检
  const chk = s.kind === 'mjs' ? await sh(NODE, ['--check', winPath]) : await sh('sh', ['-n', winPath]);
  const winOk = chk.code === 0;

  // WSL 写 + 自检
  const b64 = Buffer.from(out, 'utf8').toString('base64');
  const wslCmd =
    `printf %s '${b64}' | base64 -d > ${WSL}/${s.rel} && tr -d "\\r" < ${WSL}/${s.rel} > ${WSL}/${s.rel}.tmp && mv ${WSL}/${s.rel}.tmp ${WSL}/${s.rel} && ` +
    (s.kind === 'mjs' ? `node --check ${WSL}/${s.rel}` : `sh -n ${WSL}/${s.rel}`) + ' && echo WSL_OK';
  const wr = await sh('wsl.exe', ['-d', DISTRO, '-u', 'root', '-e', 'bash', '-c', wslCmd]);
  const wslOk = String(wr.o).includes('WSL_OK');

  const ok = winOk && wslOk;
  console.log(`  ${ok ? '✔' : '✘'} ${s.rel}  ${why}  WIN=${winOk ? 'ok' : 'FAIL'} WSL=${wslOk ? 'ok' : 'FAIL'}`);
  if (!ok) {
    nFail++;
    if (!winOk) console.log(`      WIN: ${JSON.stringify(String(chk.o + chk.e).slice(0, 300))}`);
    if (!wslOk) console.log(`      WSL: ${JSON.stringify(String(wr.o + wr.e).slice(0, 300))}`);
  } else nChanged++;
}
console.log(`\n汇总：改动 ${nChanged}，跳过 ${nSkip}，失败 ${nFail}\n`);
process.exitCode = nFail ? 1 : 0;
