// lib/dub-core.mjs —— dub.mjs（「自定义文案 → 成片」主工具）的底层件
//
// ★ 为什么叫 dub-core 而不是 dub：`lib/dub.mjs` 这个名字已被**控制台侧**的智能体占用
//   （那是 server.mjs 用的服务端支撑模块，是另一条线）。两者职责完全不同，
//   撞名会导致 ESM 解析到错的文件（实测踩到：`does not provide an export named 'CFG'`）。
//   所以本文件是**主工具的私有底层件**，只被 dub.mjs import。
//
// 设计边界：本模块**只**做四件事 —— ① 起进程（Windows 侧 / WSL 侧）；② 断句；
//   ③ 时间轴；④ 字幕文件（ASS + SRT）。编排（谁调谁、产物落哪）全在 dub.mjs。
//
// ★ 为什么 ffmpeg 一律在 WSL 跑：Windows git-bash 里没有 ffmpeg（实测），
//   而 WSL 里是 6.1.1 且带 libass / h264_nvenc。所以这里所有媒体命令都是 WSL 命令，
//   路径用 /mnt/d/...。
// ★ 为什么脚本走「落盘 + bash <file>」而不是内联 bash -c：本项目反复踩过内联传参
//   被吃变量 / 错乱引号；文案里带 $、反引号、引号时必然出事。落盘后这些字符都伤不到命令。

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CFG as ENV_CFG } from './env.mjs';   // ★ 成片根唯一来源：env.mjs 的 CFG.exportDir（认 LEMO_FILM_DIR）。env.mjs 只依赖 node:* + ./styles-root.mjs ⇒ **无环**（核法 `grep -n "^import" lib/env.mjs`）。
// ── 与 lemo-make.mjs / lib/env.mjs 对齐的路径常量（漂移风险已知，故集中在此一处；成片根除外，见上）──
export const CFG = {
  wslDistro: 'Ubuntu-24.04',
  wslLib: '/home/lemo/lemo-opuscar',
  winLib: 'D:\\lemo-opuscar',
  tmpDir: 'D:\\WSL',                    // 编排脚本的落盘处（非 C 盘）
  outRoot: path.join(ENV_CFG.exportDir, 'dub'),   // ★ 成片根：从唯一来源派生；不设 LEMO_FILM_DIR 时 === 旧字面量 'D:\\lemo-films\\dub'（逐字节相同），设了就跟着走
  winFontsDir: 'C:\\Windows\\Fonts',
  wslFontsDir: '/mnt/c/Windows/Fonts',
  fontFamily: 'Microsoft YaHei',        // 首选；libass 走 fontconfig 找 fontsdir 里的它
};

// ── 视觉风格注册表 ──────────────────────────────────────────────
// ★ 冻结接口：lib/dub-styles.json（另一个智能体写）。本模块只**读**它。
// ★ plain-dark 是**基线风格**，它的所有渲染值都钉死在这里的硬编码常量上：
//   需求是「--style 不给 = 输出与旧版逐帧一致」，所以基线绝不能受注册表内容漂移影响。
//   注册表里的 plain-dark 条目只当作同一份值的镜像（用于展示 / 语义匹配）。
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STYLES_FILE = process.env.LEMO_DUB_STYLES || path.join(HERE, 'dub-styles.json');
// ★ 2026-10-06：加 `LEMO_DUB_STYLES` 覆盖点（**默认值即原硬编码值 ⇒ 不设变量时行为逐字节不变**）。
//   由来：这个变量原先**只有 4 个闸门**读，而渲染链路（本文件 / `lib/dub-semantic.mjs` / `dub.mjs`）
//   硬编码路径 ⇒ **闸门侧与渲染侧同名不同义**。危害：拿它做「配置项是否影响成片」的变异验证会得到
//   **假阴性**（配置明明不同、成片却是同一份）。现两侧同名同义（与 `LEMO_LIB_WIN` / `LEMO_MUX_SH` /
//   `LEMO_OPUSCAR` / `LEMO_DISTILL_ROOT` 等既有覆盖点一致：`LEMO_*` 一律**真的影响渲染**）。

export const PLAIN_DARK = {
  id: 'plain-dark',
  cn: '素净深色',
  desc: '基线：深色线性渐变底 + 白字黑边底部字幕，无叠加层、无动效。',
  tags: { theme: [], emotion: [], pace: [], scene: [] },
  palette: {
    bg: '0C1016', bg2: '18222D', fg: 'FFFFFF', accent: '7FA8D9',
    subtitle: 'FFFFFF', subtitleOutline: '101010', subtitleBack: '80000000',
  },
  bgRecipe: { type: 'gradient', stops: ['0C1016', '18222D', '101720'], texture: 'none', vignette: 0, seed: 0 },
  subtitle: {
    fontFamily: 'Microsoft YaHei', fontSizeFactor: 0.045, marginVFactor: 0.145,
    marginLFactor: 0.06, outlineFactor: 0.0033, bold: false, align: 2,
  },
  title: { fontSizeFactor: 0.082, showRole: false },
  overlay: { chapterCards: false, lowerThird: false, accentRule: false, progressBar: false },
  motion: { subtitleFadeIn: 0, chapterTransition: 'cut' },
  notes: '硬编码基线值，勿改：改了会让「不选风格」的输出与旧版不一致。',
};

let _regCache;
/** 读风格注册表（带缓存）。读不到 → null（调用方退回 PLAIN_DARK，工具绝不因此跑不起来）。 */
export function loadStyleRegistry() {
  if (_regCache !== undefined) return _regCache;
  try {
    const j = JSON.parse(fs.readFileSync(STYLES_FILE, 'utf8'));
    _regCache = j && Array.isArray(j.styles) ? j : null;
  } catch { _regCache = null; }
  return _regCache;
}

function deepMerge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined || v === null) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = deepMerge(base[k], v);
    else out[k] = v;
  }
  return out;
}

/**
 * 按 id 取风格。id 为空 = 不选风格 = plain-dark（不是注册表 default —— 冻结契约里
 * 「不给 = 现有行为完全不变」，所以这里不能依赖注册表的 default 字段）。
 * 找不到该 id（含注册表整个缺失）→ null，调用方决定报错还是退回基线。
 */
export function resolveStyle(id) {
  const wanted = id || 'plain-dark';
  if (wanted === 'plain-dark') return PLAIN_DARK;      // 基线钉死
  const reg = loadStyleRegistry();
  if (!reg) return null;
  const entry = reg.styles.find((s) => s && s.id === wanted);
  if (!entry) return null;
  const st = deepMerge(PLAIN_DARK, entry);
  st.id = entry.id;
  st.cn = entry.cn || entry.id;
  return st;
}

/** 列出注册表里的全部风格（注册表缺失时只有基线）。 */
export function listStyles() {
  const reg = loadStyleRegistry();
  const ids = reg ? reg.styles.filter((s) => s && s.id && s.id !== 'plain-dark').map((s) => s.id) : [];
  return ['plain-dark', ...ids];
}

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** `#RRGGBB` / `RRGGBB` / `AARRGGBB` / `&HAABBGGRR` → ASS 的 `&HAABBGGRR`（ASS 是 BGR 序） */
export function assColor(v, dflt) {
  const s = String(v ?? '').trim();
  if (!s) return dflt;
  const conv = (h) => (h.length === 6
    ? `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`          // RRGGBB → &H00BBGGRR
    : `&H${h.slice(0, 2)}${h.slice(6, 8)}${h.slice(4, 6)}${h.slice(2, 4)}`).toUpperCase();  // AARRGGBB → &HAABBGGRR
  if (/^&H[0-9A-Fa-f]{6}$/.test(s) || /^&H[0-9A-Fa-f]{8}$/.test(s)) return conv(s.slice(2));
  const hex = s.replace(/^#/, '');
  if (/^[0-9A-Fa-f]{6}$/.test(hex) || /^[0-9A-Fa-f]{8}$/.test(hex)) return conv(hex);
  return dflt;
}

/**
 * 取颜色串的 alpha 字节（0..255）。`RRGGBB`（6 位）= 不透明 255；`AARRGGBB`（8 位）取前两位。
 * 认不出 → 255（当作不可用）。
 * ★ **ASS 的 alpha 是「透明度」：0 = 完全不透明，255 = 完全透明**（与 CSS 相反）。
 *   所以「这个颜色画得出来吗」的判据是 `alphaOf(v) < 255`，不是 `> 0`。
 *   ★ 踩过的坑：一开始写成 `alphaOf(v) > 0` 判可用，于是 `#00A8111F`（AA=00，**不透明**红）
 *     被判成「不可用」而回退掉了；同时误以为 `#00000000` 是「全透明」——
 *     它其实是**不透明黑**。
 */
export function alphaOf(v) {
  const h = String(v ?? '').trim().replace(/^#/, '').replace(/^&H/i, '').replace(/^0x/i, '');
  if (/^[0-9A-Fa-f]{8}$/.test(h)) return parseInt(h.slice(0, 2), 16);
  if (/^[0-9A-Fa-f]{6}$/.test(h)) return 0;      // 6 位 = 无 alpha 字段 = 不透明
  return 255;                                    // 认不出 = 不可用
}

/** 颜色串是否「画得出来」（合法 6/8 位色串，且不是全透明）。 */
export function isVisibleColor(v) {
  const h = String(v ?? '').trim().replace(/^#/, '').replace(/^&H/i, '').replace(/^0x/i, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(h) && !/^[0-9A-Fa-f]{8}$/.test(h)) return false;
  return alphaOf(h) < 255;
}

/** 把 ASS 颜色 `&HAABBGGRR` 的 alpha 换成 `aa`（两位十六进制）。 */
export function withAlpha(ass, aa) {
  return String(ass).replace(/^&H[0-9A-Fa-f]{2}/, `&H${aa}`);
}

/** `RRGGBB` / `#RRGGBB` / `0xRRGGBB` → ffmpeg lavfi 的 `0xRRGGBB` */
export function ffColor(v, dflt) {
  const s = String(v ?? '').trim().replace(/^#/, '').replace(/^&H/i, '').replace(/^0x/i, '');
  const h = s.length === 8 ? s.slice(2) : s;
  return /^[0-9A-Fa-f]{6}$/.test(h) ? `0x${h.toUpperCase()}` : dflt;
}

/**
 * 网点（halftone）滤镜：**旋转点阵的真圆点**，用 `geq` 逐像素生成。
 *
 * ★ 为什么不用 `drawgrid`：它只能画**直线网格**，画不出圆点。而用到 `halftone` 的**两个**风格
 *   都把「网点」写成了定义性元素，且**两者规格不同**（所以必须按风格参数化，不能写死一个值）：
 *     · `halftone-dossier/STYLE.md:19`：「a rotated grid of **circles** … **step 20–26 px**；
 *       screen angle different per layer；**radius = density × step × k** with k 0.6–0.72」
 *       —— 与其 demo `demo/index.html:140` 的 `halftone()` 签名同参（调用处 step 20/22/24、angle 15~70）。
 *     · `risograph/STYLE.md:23`：「cosine spot function on a rotated grid, **period ~6–8 px at 1080p**,
 *       anti-aliased threshold；densities ≥ ~0.9 print solid；**screen angles ≥ 15° apart**」
 *   原先 `dub-core` 用的是 `grid(8, 8, 1, 0.10)` —— 一个 8px 的**方形线网格**，两种都不是。
 *
 * ★ **密度场已实现**（2026-10-03 第二轮）：半径不再固定，而是 `半径 = 密度场 f(X,Y) × step × maxK`，
 *   与 `demo/index.html:140` 的 `halftone()` 完全同构（那份实现里就是 `const s = clamp(f(x,y)); const r = s * step * maxK;`）。
 *   场函数按 demo 的两支实现：
 *     · `radial(cx, cy, R, pw)` = `pow(clamp(1 − hypot(x−cx, y−cy)/R), pw)`
 *     · `edge(R, pw)`           = `pow(clamp(hypot(x−960, y−540)/R − 0.35), pw) × 1.3`
 *   由 `bgRecipe.halftone.field = {type:'radial'|'edge', cx, cy, R, pw}` 指定；**不写 field 则退化为均匀密度**
 *   （半径 = k × step，等价于 f ≡ k/maxK 的常数场）。
 *
 * ★ **成本已优化**（2026-10-03）：原先对 r/g/b **各算一遍**逐像素表达式，实测 **0.0698 s/帧 @1080p**。
 *   改为**单通道求值 + 两色查表映射** ⇒ **0.0265 s/帧**，**快 2.6×**，只比 `drawgrid`（0.0089 s/帧）慢 3×。
 *   ★ 试过但**不采用**的两种写法（都实测过，记下来免得后人再试）：
 *     · `lutrgb` 用**表达式**形式（`r='val/255*a+(1-val/255)*b'`）⇒ **0.088 s/帧，比原写法还慢**
 *       （表达式形式每像素每通道求值，代价与它替换掉的 geq 相当）；
 *     · `pseudocolor=c0=…`：它的 `c0/c1/c2` 是**表达式**（默认 `val` 直通）**不是颜色** ——
 *       传颜色进去会被静默忽略、退化成默认黑→白渐变（我实测踩到，渲出了白点黑底）。
 *   最终用**显式 256 项查表**：掩码只有 0/255 两个值，查表两端取到「底色/网点色」。
 *
 * @param {number} step  网点周期（px）
 * @param {number} angleDeg 网屏角度（度）
 * @param {number} k     均匀密度下的半径系数（有 field 时改用 maxK 语义，见下）
 * @param {string} inkHex 网点颜色（`#RRGGBB`）
 * @param {string} bgHex  底色（`#RRGGBB`）
 * @param {object} [field] 密度场 `{type, cx, cy, R, pw, maxK}`；缺省 = 均匀密度
 */
export function halftoneExpr(step, angleDeg, k, inkHex, bgHex, field, frame = null) {
  const S = Math.max(3, Math.round(Number(step) || 22));
  const A = ((Number(angleDeg) || 15) * Math.PI) / 180;
  const ch = (hex, i) => {
    const h = String(hex || '').replace(/^#/, '').replace(/^0x/i, '');
    const six = h.length === 8 ? h.slice(2) : h;
    return /^[0-9A-Fa-f]{6}$/.test(six) ? parseInt(six.slice(i, i + 2), 16) : 255;
  };
  const ca = Math.cos(A).toFixed(10);
  const sa = Math.sin(A).toFixed(10);
  // 把坐标旋转 angle 后对 S 取模，得到「到最近网点中心的距离」
  const d = `hypot(mod((X*${ca}+Y*${sa})\\,${S})-${S / 2}\\,mod((-X*${sa}+Y*${ca})\\,${S})-${S / 2})`;

  // 半径表达式：有 field ⇒ 半径 = f(X,Y) × S × maxK；无 field ⇒ 常数 k × S
  let rExpr;
  const f = field && typeof field === 'object' ? field : null;
  if (f && (f.type === 'radial' || f.type === 'edge')) {
    const pw = Number(f.pw) || (f.type === 'edge' ? 1.6 : 1.2);
    const R = Number(f.R) || (f.type === 'edge' ? 900 : 560);
    const maxK = Number(f.maxK) || 0.62;
    // ★ 密度场中心默认取**画面中心**（frame.W/2, frame.H/2），不是写死的 1920×1080 中心 (960,540)。
    //   原来 `edge` 分支把 960/540 写死、`radial` 分支也以它们作默认 ⇒ 任何**非 1920×1080** 的输出
    //   （9:16 的 1080×1920、以及 1280×720）密度环都会偏离画面中心。
    //   由只读审计发现（halftone-dossier 的 edge 场在 9:16 下密度环偏向右上）。
    //   ★ `frame` 缺省 = 1920×1080 ⇒ 960/540，与旧值**逐字节相同**（既有样板片零回归）。
    const FW = Number(frame && frame.W) || 1920;
    const FH = Number(frame && frame.H) || 1080;
    const CX = Number(f.cx) || (FW / 2);
    const CY = Number(f.cy) || (FH / 2);
    const dens = f.type === 'radial'
      ? `pow(clip(1-hypot(X-${CX}\\,Y-${CY})/${R}\\,0\\,1)\\,${pw})`
      : `clip(pow(clip(hypot(X-${CX}\\,Y-${CY})/${R}-0.35\\,0\\,1)\\,${pw})*1.3\\,0\\,1)`;
    rExpr = `(${dens})*${S}*${maxK}`;
  } else {
    rExpr = String(Math.max(0.5, (Number(k) || 0.3) * S));
  }

  // 单通道求值（1 次 geq）→ 二值掩码（0=底 / 255=网点）→ 256 项查表两色映射
  // ★ 实测（ffmpeg 9.0.2, 1920×1080, 120 帧, libx264 ultrafast, 取 2 次最小值）：
  //     带密度场：1ch+lutrgb 0.0914 s/帧  vs  3ch geq 0.2656 s/帧  → 2.9×
  //     无密度场：1ch+lutrgb 0.0289 s/帧  vs  3ch geq 0.0712 s/帧  → 2.5×
  //   ★ 对比必须同口径：密度场表达式（hypot/pow/clip 逐像素）本身就占大头，
  //     拿「带密度场的本实现」去比「不带密度场的 3 通道 geq」会得出反向的错误结论。
  //   ★ 试过并否决的两种写法：
  //     ① `lutrgb=r='表达式'`（表达式形式）—— 比 3 通道 geq 还慢；
  //     ② `pseudocolor=c0=<色>:c1=<色>` —— 这两个参数是**表达式**不是颜色（val 透传），
  //        填色值进去等于 no-op，会渲染成黑底白点。
  const mask = `format=gray,geq=lum='if(lt(${d}\\,${rExpr})\\,255\\,0)'`;
  const table = (ink, bg) => {
    const out = new Array(256);
    for (let v = 0; v < 256; v++) out[v] = Math.round((v / 255) * ink + (1 - v / 255) * bg);
    return out.join(' ');
  };
  const map = ['r', 'g', 'b'].map((n, idx) => `${n}='${table(ch(inkHex, idx * 2), ch(bgHex, idx * 2))}'`).join(':');
  return `${mask},format=rgb24,lutrgb=${map}`;
}

/**
 * `RRGGBB` / `#RRGGBB` / `AARRGGBB`（与 ffColor 同序取色）→ WCAG 相对亮度（0..1）。
 * L = 0.2126·R + 0.7152·G + 0.0722·B，三个分量先做 sRGB→线性化（WCAG 2.x 定义）。
 * 拿不到合法 6 位色 → null（调用方决定兜底）。
 */
export function relativeLuminance(v) {
  const s = String(v ?? '').trim().replace(/^#/, '').replace(/^&H/i, '').replace(/^0x/i, '');
  const h = s.length === 8 ? s.slice(2) : s;
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return null;
  const lin = (i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}

/**
 * 把风格对象折算成**本次渲染用**的具体像素/颜色值。
 * ★ plain-dark 一律强制「叠加层/动效/纹理/暗角/角色标签」全部失效 —— 冻结契约里
 *   「不选风格时以上全部不生效」，所以基线路径不走注册表里可能被改动的这些开关。
 */
export function styleSpec(style, { W, H }) {
  const st = style || PLAIN_DARK;
  const plain = st.id === 'plain-dark';
  const sub = st.subtitle || {};
  const ttl = st.title || {};
  const ovr = plain ? PLAIN_DARK.overlay : (st.overlay || PLAIN_DARK.overlay);
  const mot = plain ? PLAIN_DARK.motion : (st.motion || PLAIN_DARK.motion);
  const bg = plain ? PLAIN_DARK.bgRecipe : (st.bgRecipe || PLAIN_DARK.bgRecipe);
  const pal = plain ? PLAIN_DARK.palette : (st.palette || PLAIN_DARK.palette);
  return {
    id: st.id, cn: st.cn || st.id, plain,
    fontSize: Math.round(W * num(sub.fontSizeFactor, 0.045)),
    outline: Math.max(2, Math.round(W * num(sub.outlineFactor, 0.0033))),
    marginV: Math.round(H * num(sub.marginVFactor, 0.145)),
    marginL: Math.round(W * num(sub.marginLFactor, 0.06)),
    align: num(sub.align, 2),
    bold: plain ? false : !!sub.bold,
    fontFamily: sub.fontFamily || CFG.fontFamily,
    titleSize: Math.round(W * num(ttl.fontSizeFactor, 0.082)),
    showRole: plain ? false : !!ttl.showRole,
    palette: pal, bgRecipe: bg,
    overlay: {
      chapterCards: plain ? false : !!ovr.chapterCards,
      lowerThird: plain ? false : !!ovr.lowerThird,
      accentRule: plain ? false : !!ovr.accentRule,
      progressBar: plain ? false : !!ovr.progressBar,
    },
    motion: {
      subtitleFadeIn: plain ? 0 : num(mot.subtitleFadeIn, 0),
      // 契约只要求 cut / fade；注册表里出现了 wipe/iris/bloom/expand 等，
      // 一律按「非 cut 即 0.3s 淡入淡出」处理，不因为多一个枚举值就崩掉。
      chapterTransition: plain ? 'cut' : String(mot.chapterTransition || 'cut'),
    },
    // ★ 字幕底衬（subtitle.plate）。取值：'shadow'（缺省 = 旧行为）/ 'box' / 'none'。
    //   ★ 为什么必须有这个字段：ASS 的 `BorderStyle=1` 下 **BackColour 不参与渲染**
    //     （只有 Outline + Shadow 生效），所以 STYLE.md §4 里为 25 个风格声明的
    //     「底衬 / 胶囊 / 色带 / 字幕卡」在这条通路上**从未画出来过**。
    //     要真画出来必须切 `BorderStyle=3`（不透明底盒）—— 那时 Outline 字段变成
    //     **盒内边距**、**OutlineColour 字段变成盒填充色**（不是 BackColour！依据见 buildAss 里
    //     `subOutlineCol` 处的说明），语义整个换掉。
    //   ★ 缺省 'shadow' 保证 plain-dark 与未声明风格的 ASS 逐字节不变。
    //   ★ plateColor 留空时按「该风格已有的 subtitleBack（画得出来时）→ palette.bg 加 CC α」取，
    //     这样风格不必逐个再写一遍颜色。
    //   ★ 注意 ASS 的 alpha 是**透明度**（0=不透明），判「画得出来」要用 isVisibleColor()，
    //     不能用 alphaOf(v) > 0 —— 后者会把 `#00A8111F` 这种不透明色误判为不可用。
    plate: plain ? 'shadow' : (['box', 'none'].includes(sub.plate) ? sub.plate : 'shadow'),
    plateColor: plain ? null : (sub.plateColor || null),
    platePad: Math.max(2, Math.round(H * num(sub.platePadFactor, 0.009))),
    // ★ 风格特质档案（style-dna）摘要：**可选**增强。调用方把 summarizeStyleDna() 的结果
    //   挂在 style.dna 上；没挂 = null = 与旧行为逐字节一致（buildAss 只在非 null 时收窄折行）。
    dna: st.dna || null,
  };
}

// ── 纹理名归一化（同义 / 拼写）───────────────────────────────────
// ★ 为什么要有这张表：`bgRecipe` 里有两个纹理字段 —— 粗粒度 `texture`（本模块的**主**权威源）
//   与细粒度 `textureRaw`（44/44 风格都声明；★ 2026-10-05 起本模块**只**在粗粒度落空时、
//   按下面 TEXTURE_RAW_FALLBACK 点名的少数几个名字读它，见那张表的判据）。
//   `textureRaw` 的取值里混进了同一物的不同写法（如 `dotgrid` vs `dot-grid`），
//   一旦这种写法被上游搬到 `texture`，就会掉进 `default` 分支
//   **静默丢掉纹理**。归一化把同义写法收进同一个 case，让「写法」不再影响「有没有纹理」。
//
// ★ 判据（往表里加一条必须**同时**满足，不满足就说明它不是同义，而是新纹理）：
//   ① 归一化后的目标名必须是下面 switch 里**已有的 case 标签**（否则只是把「落空」换成另一种「落空」）；
//   ② 源名与目标名的差异只在**书写**（连字符 / 单复数 / 大小写），指的是**同一种视觉纹理**；
//      若语义上更细、或根本是另一种质感（如 `paper-grain` / `film-grain` / `glass`），
//      那是「新增纹理」，必须走 switch 新分支，**不得**塞进本表。
//      （★ `film-grain` / `vhs-grain` 这类「更细的质感名落到已有分支」另立一表 —— 见下面的
//        TEXTURE_RAW_FALLBACK；两张表判据不同，不要互相搬条目。）
//   ③ 源名本身**不能**是 switch 里已有的 case 标签 —— 否则会把一个已能命中的名字改道。
//      （原先把 `scanline` 写成 `case 'scanlines': case 'scanline':` 两个标签，现统一收到本表，
//        保证「同义词只有这一处判据」，行为不变。）
//
// ★ 硬约束：本表**只对原本会落空的名字生效**。由 ③ 可推：任何已经能命中 switch 的 `texture`
//   取值，归一化后必然原样返回 ⇒ 既有 44 个风格的输出**逐字节不变**（见 switch 上方 tex 处说明）。
// ★ 向后兼容：新增同义词 = 加一条 `'写法': '规范名'`，switch 不动。
const TEXTURE_SYNONYMS = Object.freeze({
  dotgrid: 'dot-grid',    // 缺连字符。`dataviz.textureRaw = 'dotgrid'`（同风格的 `texture` 已是 'dot-grid'）
  scanline: 'scanlines',  // 单复数。原先靠 switch 里的第二个 case 标签兜住，现并入本表
});

/** 纹理名归一化：先 trim + 转小写，再查同义表；查不到 / 已规范 → 原样返回。 */
function normalizeTexture(name) {
  const s = String(name ?? 'none').trim().toLowerCase();
  return TEXTURE_SYNONYMS[s] || s;
}

// ── 细粒度纹理 `textureRaw` 的**最小**回退表 ──────────────────────────
// ★ 背景：`bgRecipe` 有两个纹理字段 —— 粗粒度 `texture`（本模块一直真读的）与细粒度
//   `textureRaw`（44/44 风格都声明，此前**全仓零读取**）。粗粒度落空（= `none`）时，
//   这里允许**仅对下表点名的名字**回退到 switch 里**已有的分支**，让「声明了、也确实
//   有对应能力」的细纹理不再静默落空（2026-10-05 用户拍板：只做低风险这几个，
//   其余 18 个细纹理**只标注不实现**，清单见 `lib/dub-styles.json._notes`）。
// ★ 判据（进本表必须**同时**满足）：
//   ① 目标是 switch 里**已有的 case 标签**（只复用已有分支，**不发明新参数**）；
//   ② 源名与目标分支指的是**同一种视觉质感** —— `film-grain` / `vhs-grain` 与 `grain`
//      都是「时变颗粒 / 噪点」，而 `noise=alls=14:allf=t` 就是它的实现；
//   ③ 只在**粗粒度 `texture` 落空**时才启用（见 `resolveTextureName`）⇒ 任何已经能命中的
//      粗粒度取值结果**逐字节不变**（含 `none` 之外的 8 个同名取值）。
// ★ 为什么不并进 TEXTURE_SYNONYMS：那张表管「同一名字的不同写法」，本表管「更细的质感名
//   落到已有分支」，性质不同（TEXTURE_SYNONYMS 判据 ② 已把 `film-grain` 明确排除）。
// ★ 为什么 `vhs-grain` 不再叠 `scanlines`：`scanlines` 分支是 `grid(W,4,1,0.22)` 的
//   **4px 横线**（是扫描线，不是颗粒）；而 backrooms 的 `STYLE.md:25` 明确写
//   「**No scanlines**, no RGB mask」⇒ 叠上去会直接违反该风格的红线，故只取「颗粒」那半边。
// ★ 未进本表的 `textureRaw` 取值一律**保持落空**（不猜参数、不发明分支），并已在
//   `lib/dub-styles.json` 的 `_notes` 里逐名登记「声明但未实现」，风格侧见各自 SKILL.md 第 11 节。
const TEXTURE_RAW_FALLBACK = Object.freeze({
  'film-grain': 'grain',   // rubber-hose / silent-film：胶片颗粒 → 已有 `grain` 分支（noise=alls=14:allf=t）
  'vhs-grain': 'grain',    // backrooms：VHS 磁带颗粒 → 同一 `grain` 分支（不叠 scanlines，理由见上）
});

/**
 * 本帧该用哪个纹理名。
 * ★ 口径：**粗粒度 `texture` 有声明就一律听粗粒度**（哪怕是未知值 —— 不猜、不改道）；
 *   只有粗粒度落空（`none`）时才查细粒度回退表，且表里没有的名字仍然原样返回 ⇒ 落空。
 */
function resolveTextureName(r) {
  const coarse = normalizeTexture(r.texture || 'none');
  if (coarse !== 'none') return coarse;
  return TEXTURE_RAW_FALLBACK[normalizeTexture(r.textureRaw || 'none')] || coarse;
}

/** 形态 A 的背景滤镜链（在 lavfi 源之后追加）。plain-dark → 返回 ''（= 旧行为）。 */
export function bgFilters(spec, { W, H, dur }) {
  const r = spec.bgRecipe || {};
  if (spec.plain) return '';
  const out = [];
  const vig = num(r.vignette, 0);
  if (vig > 0.001) out.push(`vignette=a=${(vig * Math.PI).toFixed(4)}`);
  // ★ 只读粗粒度 `texture` 作为**主**权威源（避免把 textureRaw 变成新的权威源而给未来数据改动
  //   埋雷）；只有当粗粒度落空（`none`）时，才允许 `TEXTURE_RAW_FALLBACK` 里点名的少数细纹理
  //   回退到已有分支（见 resolveTextureName 与上面那张表的判据）。先归一化再进 switch：
  //   同义写法落进同一分支，已能命中的名字结果**逐字节不变**。
  const tex = resolveTextureName(r);

  // ★ 网格族纹理的线色**随底色亮度自适应**（修复：原先硬编码 black，深底风格上黑线压黑底 = 该层完全丢失）。
  //   判据：WCAG 相对亮度 L（relativeLuminance，已做 sRGB 线性化），阈值 0.5 ——
  //     L < 0.5 视作暗底 ⇒ 白线；L ≥ 0.5 视作亮底 ⇒ 黑线。
  //   为什么 0.5：只需二分「线该用白还是黑」，0.5 是暗/亮的等分点（≈ 中灰 sRGB #777 的 L）；
  //     这里不追求精确对比度比，取等分点即可，且亮底（L≥0.5）仍得 black，与改动前逐字节一致 ⇒ 不回归。
  //   取色顺序与 bgSource 完全一致：bgRecipe.stops[0] → palette.bg → '0C1016'（同一兜底），
  //     保证「线色相对的那块底」就是 bgSource 实际画出来的那块底。
  const pal = spec.palette || PLAIN_DARK.palette;
  const bgBase = (Array.isArray(r.stops) && r.stops[0]) || pal.bg || '0C1016';
  const line = (relativeLuminance(bgBase) ?? 0) < 0.5 ? 'white' : 'black';
  const grid = (w, h, t, a) => `drawgrid=w=${w}:h=${h}:t=${t}:c=${line}@${a}`;
  switch (tex) {
    case 'paper': out.push('noise=alls=9:allf=t+u'); break;
    case 'rice-paper': case 'washi': out.push('noise=alls=6:allf=t+u'); break;
    case 'grain': out.push('noise=alls=14:allf=t'); break;
    case 'dot-grid': out.push(grid(24, 24, 1, 0.12)); break;
    // ★ hairline-grid：按 `dark-keynote/demo/engine.js:66-81` 的**原始实现**对齐（2026-10-03 查证后修正）。
    //   那份 grid() 的真实参数是：`module = 48`、**双向画线**（竖线 + 横线各一轮）、`lineWidth = 1`、
    //   白色，且**分两个 pass**：普通线 `rgba(255,255,255,0.032)`，每第 4 条（`i % major === 0`，`major = 4`）用 `0.06`。
    //   ⇒ 原先的 `grid(W, Math.max(8, Math.round(H / 48)), 1, 0.03)` 有**三处**与实现不符：
    //     ① 间距 23px（1080p 下 H/48）应为 **48px**；② `w = W` 使单元格宽 = 整幅宽 ⇒ **没有竖线**，应为**双向**；
    //     ③ 缺「每 4 条加粗」那一 pass（此前误判为「drawgrid 单 pass 做不到」—— 实现用的是**两条 drawgrid**）。
    //   ★ 「每 4 条更亮」怎么用 drawgrid 表达：drawgrid 每次只按一种间距铺满，所以叠**第二条** 4× 间距（4×48 = 192px）
    //     即可落在同样的位置。两条在同一位置复合，要让复合值等于声明的 0.06，第二条取 x 满足
    //     `1 − (1 − 0.032)(1 − x) = 0.06` ⇒ `x ≈ 0.029`。
    //   ★ 波及面：该纹理目前**仅 dark-keynote 使用**（已全量核对），故只影响 1 个风格。
    case 'hairline-grid':
      out.push(grid(48, 48, 1, 0.032));
      out.push(grid(192, 192, 1, 0.029));
      break;
    // ★ halftone：改用 `geq` 生成**真圆点**（原先是 `grid(8, 8, 1, 0.10)` = 8px 方形**线**网格，
    //   与两个用到它的风格的声明都不符）。参数按风格给（`bgRecipe.halftone = {step, angle, k, color}`），
    //   缺省 22px / 15° / k 0.3。两风格的声明差异与已知简化见 `halftoneExpr` 的注释。
    case 'halftone': {
      const hp = (r.halftone && typeof r.halftone === 'object') ? r.halftone : {};
      const ink = hp.color || pal.accent || pal.fg || '#FFFFFF';
      out.push(halftoneExpr(num(hp.step, 22), num(hp.angle, 15), num(hp.k, 0.3), ink, bgBase, hp.field, { W, H }));
      break;
    }
    // ★ 单数写法 `scanline` 已并入 TEXTURE_SYNONYMS 归一化（此处只留规范名，判据集中一处）。
    case 'scanlines': out.push(grid(W, 4, 1, 0.22)); break;
    default: break;   // none / 未知 → 不加
  }
  return out.join(',');
}

/**
 * 形态 A 的内置背景源（lavfi 描述串）。
 * type: gradient（默认）/ solid（单色）/ grid（单色底，纹理由 bgFilters 叠）。
 * seed 固定（不随机），否则每次出片底图都不一样。
 */
export function bgSource(spec, { W, H, dur }) {
  const r = spec.bgRecipe || {};
  const pal = spec.palette || PLAIN_DARK.palette;
  const type = String(r.type || 'gradient');
  const base = ffColor(pal.bg, '0x0C1016');
  let stops = (Array.isArray(r.stops) ? r.stops : []).map((c) => ffColor(c, null)).filter(Boolean);
  const d = Number(dur).toFixed(3);
  if (type === 'solid') return `color=c=${stops[0] || base}:s=${W}x${H}:d=${d}:r=30`;
  if (type === 'grid') return `color=c=${base}:s=${W}x${H}:d=${d}:r=30`;
  if (stops.length < 2) stops = [base, ffColor(pal.bg2, null) || base];
  stops = stops.slice(0, 3);
  const seed = Number.isFinite(Number(r.seed)) ? Math.trunc(Number(r.seed)) : 0;
  return [
    `gradients=s=${W}x${H}`,
    ...stops.map((c, i) => `c${i}=${c}`),
    `nb_colors=${stops.length}`, 'type=linear', 'speed=0.00001', `seed=${seed}`, `d=${d}`, 'r=30',
  ].join(':');
}

// ── 进程 ────────────────────────────────────────────────────────
// ★ 本环境 spawnSync 并发时会 EBUSY（编排器里记过），所以统一异步 spawn，串行 await。
export function run(exe, args, { timeout = 0, cwd } = {}) {
  return new Promise((resolve) => {
    let p;
    // ★ stdio 里 stdin 必须是 'ignore'（= /dev/null），不能用默认的 pipe：
    //   WSL 的 Windows 互操作（/init + python.exe）会去读 stdin，pipe 永远没有数据也没有 EOF，
    //   Index-TTS 的 Windows 侧进程就卡在「已启动、17MB、GPU 0%、CPU 0s」永不加载模型
    //   （实测：同一条命令在交互 shell 里能跑，从 Node spawn 就静默挂死）。
    try { p = spawn(exe, args, { windowsHide: true, cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WSL_UTF8: '1' } }); }
    catch (e) { return resolve({ code: -1, stdout: '', stderr: '', error: e }); }
    let stdout = '', stderr = '', timer = null, timedOut = false;
    if (timeout > 0) timer = setTimeout(() => { timedOut = true; try { p.kill(); } catch { /* ignore */ } }, timeout);
    p.stdout?.on('data', (d) => { stdout += d; });
    p.stderr?.on('data', (d) => { stderr += d; });
    p.on('error', (e) => { if (timer) clearTimeout(timer); resolve({ code: -1, stdout, stderr, error: e }); });
    p.on('close', (code) => { if (timer) clearTimeout(timer); resolve({ code: timedOut ? -2 : code, stdout, stderr, timedOut }); });
  });
}

export function winToWsl(p) {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(p);
  if (!m) return p.replace(/\\/g, '/');
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

let wslSeq = 0;

/**
 * 在 WSL 里跑一段 bash 脚本。脚本先落到 D:\WSL\，再执行 —— 不内联（内联会被吃变量/错乱引号）。
 *
 * ★ 实测踩到的坑：必须用 **login shell**（`bash -lc "bash <脚本>"`），
 *   直接 `bash <脚本>`（非登录、非交互）会让 Index-TTS 的 Windows 侧 python.exe
 *   卡在「已启动、只占 17MB、GPU 0%、CPU 0s」的状态，永远不加载模型
 *   （表现为整条流水线静默挂死）。改成 `-lc` 后模型立刻加载。
 *   代价只是脚本本体仍是文件，用户文本一个字都不进命令行 —— 引号风险没有回来。
 */
export async function runWsl(script, { name = 'dub', timeout = 0, echo = false } = {}) {
  fs.mkdirSync(CFG.tmpDir, { recursive: true });
  const uniq = `${name}-${process.pid}-${(wslSeq++).toString(36)}-${Date.now().toString(36)}`;
  const host = path.join(CFG.tmpDir, `${uniq}.sh`);
  fs.writeFileSync(host, `set -o pipefail\n${script.replace(/\r\n/g, '\n')}\n`, 'utf8');
  const wslPath = winToWsl(host);
  if (echo) process.stderr.write(`\n--- WSL script (${name}) ---\n${script}\n---------------------------\n`);
  try {
    return await run('wsl.exe',
      ['-d', CFG.wslDistro, '-e', 'bash', '-lc', `exec bash ${shq(wslPath)}`],
      { timeout });
  } finally {
    try { fs.unlinkSync(host); } catch { /* ignore */ }
  }
}

/** bash 单引号安全包裹（文案/路径里可能有单引号） */
export function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// ── 断句 ────────────────────────────────────────────────────────
const SENT_END = /[。！？；!?;]/;
const CLAUSE_END = /[，,、：:]/;

/**
 * 断句规则（按需求冻结）：
 *   1) 优先按换行（一行一句）；
 *   2) 没有换行时按中文句末标点（。！？；）切，**保留标点**（TTS 靠它断语气）；
 *   3) 单句 > maxLen 字再按「，」二次切，避免一行字幕挤满屏；
 *   4) 仍超长的（比如整段没有一个逗号）按 maxLen 硬切，保证不出现超长字幕；
 *   5) 去空行 / 首尾空白。
 */
export function splitSentences(text, maxLen = 40) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!src) return [];

  let first;
  if (src.includes('\n')) {
    first = src.split('\n');
  } else {
    // 保留分隔符：在句末标点之后切
    first = [];
    let buf = '';
    for (const ch of src) {
      buf += ch;
      if (SENT_END.test(ch)) { first.push(buf); buf = ''; }
    }
    if (buf.trim()) first.push(buf);
  }

  const out = [];
  for (const raw of first) {
    const p = raw.trim();
    if (!p) continue;
    if (p.length <= maxLen) { out.push(p); continue; }

    // 二次切：按逗号/顿号/冒号聚合，尽量凑到接近 maxLen
    const segs = [];
    let buf = '';
    for (const ch of p) {
      buf += ch;
      if (CLAUSE_END.test(ch)) { segs.push(buf); buf = ''; }
    }
    if (buf) segs.push(buf);

    let cur = '';
    for (const s of segs) {
      if (cur && cur.length + s.length > maxLen) { out.push(cur.trim()); cur = s; }
      else cur += s;
    }
    if (cur.trim()) out.push(cur.trim());
  }

  // ── 兜底硬切：优先在「自然边界」切，避免切在词/记号内部 ────────────────
  // ★★ 2026-10-04 改：原实现是 `for (i=0; i<t.length; i+=maxLen) final.push(t.slice(i,i+maxLen))`
  //   —— **盲目定长一刀切**，实测两个后果：
  //     ① **切在词/记号内部**：`…次日就收米|上百…`（CJK 词内）、`…全靠 AI |1键复制…`（Latin↔数字之间）；
  //     ② 切片**没 trim** ⇒ 字幕里会留**首尾空白**（实测 `…全靠 AI ` 末尾带一个空格）。
  //   现在：在 `[maxLen-W, maxLen+W]` 窗口内挑**优先级最高、且离 maxLen 最近**的切点 ——
  //     ① 标点之后（`SENT_END` / `CLAUSE_END`）—— 最自然；
  //     ② 空白处（任一侧是空白）—— 次自然；
  //     ③ **字符类变化处**（CJK / Latin / 数字 / 其它），**但排除「Latin↔数字」**
  //        （那是同一个 token 内部，如 `AI1`）；
  //     ④ 窗口内一个候选都没有（纯中文、无标点、无空白）⇒ 退回第 `maxLen` 字硬切。
  //   ★ **已知局限（如实记下，不假装解决）**：**纯中文且无标点时，任何定长切法都可能切在词内**
  //     —— 除非引入分词器，而本项目 Node 侧**有意不依赖 jieba**。这种情况走 ④，行为与改前一致。
  //   ★ 每次切片都 `trim()`（修上面第 ② 条）。
  const final = [];
  for (const s of out) {
    let rest = s.trim();
    while (rest.length > maxLen) {
      const p = pickBreakPoint(rest, maxLen);
      const head = rest.slice(0, p).trim();
      if (head) final.push(head);
      rest = rest.slice(p).trim();
    }
    if (rest) final.push(rest);
  }
  return final;
}

/** 在 `[maxLen-W, maxLen+W]` 内挑最佳切点；返回切点下标（`t.slice(0,p)` / `t.slice(p)`）。 */
const BREAK_WINDOW = 6;
/** 字符类：0=CJK/假名/谚文 · 1=Latin · 2=数字 · 3=其它（标点/空白/符号） */
const charClassOf = (ch) => {
  if (/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/.test(ch)) return 0;
  if (/[A-Za-z]/.test(ch)) return 1;
  if (/[0-9]/.test(ch)) return 2;
  return 3;
};
function pickBreakPoint(t, maxLen) {
  const lo = Math.max(1, maxLen - BREAK_WINDOW);
  const hi = Math.min(t.length - 1, maxLen + BREAK_WINDOW);
  let bestP = -1, bestRank = 99, bestDist = Infinity;
  for (let p = lo; p <= hi; p++) {
    const prev = t[p - 1], next = t[p];
    let rank = -1;
    if (SENT_END.test(prev) || CLAUSE_END.test(prev)) rank = 0;
    else if (/\s/.test(prev) || /\s/.test(next)) rank = 1;
    else {
      const a = charClassOf(prev), b = charClassOf(next);
      const letterDigit = (a === 1 && b === 2) || (a === 2 && b === 1);
      if (a !== b && !letterDigit) rank = 2;
    }
    if (rank < 0) continue;
    const dist = Math.abs(p - maxLen);
    if (rank < bestRank || (rank === bestRank && dist < bestDist)) { bestP = p; bestRank = rank; bestDist = dist; }
  }
  return bestP > 0 ? bestP : maxLen;
}

// ── 时间轴 ──────────────────────────────────────────────────────
/**
 * t0_1 = 0；t0_i = t0_{i-1} + dur_{i-1} + gap；总时长 = 末句 t1。
 * 字幕窗 [t0-0.1, min(t0+dur+0.6, 下一句 t0-0.2, 总时长)] —— 三个边界都夹住。
 */
export function buildTimeline(lines, durs, gap) {
  const items = [];
  let t = 0;
  for (let i = 0; i < lines.length; i++) {
    const d = durs[i];
    const t0 = t;
    const t1 = t0 + d;
    items.push({ id: lines[i].id, text: lines[i].text, t0, t1, dur: d });
    t = t1 + gap;
  }
  const total = items.length ? items[items.length - 1].t1 : 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const nextT0 = i + 1 < items.length ? items[i + 1].t0 : Infinity;
    const s = Math.max(0, it.t0 - 0.1);
    let e = Math.min(it.t0 + it.dur + 0.6, nextT0 - 0.2, total);
    if (!(e > s)) e = Math.min(it.t0 + it.dur, total);   // 退化兜底：至少覆盖这句
    if (!(e > s)) e = s + 0.2;
    it.sub0 = s;
    it.sub1 = e;
  }
  return { items, total };
}

// ── 时间格式 ────────────────────────────────────────────────────
export function srtTime(t) {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
  const s = Math.floor(ms % 60000 / 1000), x = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(x).padStart(3, '0')}`;
}

export function assTime(t) {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000), m = Math.floor(cs % 360000 / 6000);
  const s = Math.floor(cs % 6000 / 100), c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

export function buildSrt(items) {
  return items.map((it, i) => `${i + 1}\n${srtTime(it.sub0)} --> ${srtTime(it.sub1)}\n${it.text}\n`).join('\n');
}

function assEsc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\r?\n/g, '\\N');
}

/**
 * 按**渲染宽度**硬换行（中文没有空格，libass 的自动换行对 CJK 完全不生效）。
 *
 * ★ 这是实测踩到的硬坑：ASS 里 `WrapStyle: 0` 对纯中文句子不做任何换行，40 字的长句
 *   会横向铺满并**被裁掉两侧**（实测 cropdetect 报 crop=1080:1920，即内容顶到画幅两边）。
 *   所以必须自己按字数插 `\N`。
 * ★ 断点优先落在标点上（在每行容量的后 40% 里找最后一个标点，在其后断），比硬切好看。
 */
function wrapCJK(text, n) {
  const s = String(text).replace(/\r?\n/g, '');
  if (n < 2 || s.length <= n) return [s];
  const out = [];
  let rest = s;
  while (rest.length > n) {
    let cut = n;
    const lo = Math.max(1, Math.ceil(n * 0.6));
    // 优先断在标点后
    for (let i = n; i >= lo; i--) {
      if (/[，。！？；、：,.;:!?]/.test(rest[i - 1])) { cut = i; break; }
    }
    // ★ 不许留孤字：末行只剩 1~2 个字（典型是「。」单独占一行）时往回退，
    //   把断点前移，直到剩下的部分至少 3 个字。实测踩到过：19 字一句按 18 字/行切，
    //   第二行只剩一个句号，非常难看。
    while (cut > lo && rest.length - cut < 3) cut--;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out;
}

/** 每行能放几个全角字（按字号反推；1.06 = 字身 + 一点余量）。导出供出片侧报告「是否触顶」。 */
export function charsPerLine(usablePx, fontSize) {
  return Math.max(6, Math.floor(usablePx / (fontSize * 1.06)));
}

/**
 * 字幕单行容量：通用值按画幅算；若带了 style-dna 摘要且档案给了单行字符上限，
 * 则**只收窄、不放宽**（Math.min）——保证字幕永远不会比现在更宽，绝不会造成裁切。
 * ★ 没有 dna（= 不选风格 / 档案缺失）时返回值与改动前**完全一致**。
 */
function subtitlePerLine({ W, marginL, fontSize, dna }) {
  const base = charsPerLine(W - 2 * marginL, fontSize);
  const cap = dna && Number.isFinite(dna.subtitleMaxChars) ? dna.subtitleMaxChars : null;
  return cap == null ? base : Math.max(2, Math.min(base, cap));
}

/** 把一句字幕按行容量折成 ASS 文本（\N 连接） */
function toAssText(text, perLine) {
  return wrapCJK(text, perLine).map(assEsc).join('\\N');
}

/** 把角色序列摊到每句上（segments 与 items 条数一致时按序对，否则按归一化字数比例映射） */
function itemRoles(items, segments) {
  const roles = new Array(items.length).fill('其他');
  if (!Array.isArray(segments) || !segments.length || !items.length) return roles;
  if (segments.length === items.length) {
    segments.forEach((s, i) => { if (s && s.role) roles[i] = String(s.role); });
    return roles;
  }
  const total = items.reduce((a, it) => a + Math.max(1, it.text.length), 0);
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    const w = Math.max(1, items[i].text.length) / total;
    const j = Math.min(segments.length - 1, Math.floor((acc + w / 2) * segments.length));
    roles[i] = (segments[j] && segments[j].role) || '其他';
    acc += w;
  }
  return roles;
}

/** 连续同角色的段 → [[起句, 止句], ...] */
function roleRuns(roles) {
  const runs = [];
  let start = 0;
  for (let i = 1; i <= roles.length; i++) {
    if (i === roles.length || roles[i] !== roles[start]) { runs.push([start, i - 1]); start = i; }
  }
  return runs;
}

/**
 * 生成 ASS。字幕在底部（安全边距内），标题居中偏上、淡入淡出。
 * ★ 用 ASS 而不是 SRT：SRT 烧进去无法控制字号/边距/描边，底部安全区必然靠猜。
 *   标题与字幕分属两个 style，互不打架（标题在顶、字幕在底）。
 * ★ 风格化（叠加层 / 动效 / 角色标签）全部由 style 驱动；style 为 plain-dark 时
 *   这些开关被强制关掉，产出的 ASS 与旧版**逐字节相同**。
 * ★ 叠加层的摆放原则：只在「上沿 / 下沿」活动，绝不占画面中段 —— 形态 B 时中上部是人脸。
 */
export function buildAss(items, {
  W, H, title = '', titleDur = 0, fontFamily = null,
  style = PLAIN_DARK, segments = null, total = null,
} = {}) {
  const sp = styleSpec(style, { W, H });
  const fam = fontFamily || sp.fontFamily;
  const pal = sp.palette;
  const fs2 = sp.fontSize;                                // 1080 → 49
  const ov = sp.outline;                                  // 1080 → 4（描边）
  const marginV = sp.marginV;                             // 1920 → 278（底部安全区）
  const marginL = sp.marginL;                             // 1080 → 65
  const titleSize = sp.titleSize;                         // 1080 → 89
  const subPerLine = subtitlePerLine({ W, marginL, fontSize: fs2, dna: sp.dna });  // 1080 → 18 字/行（有 DNA 时可收窄）
  const titlePerLine = charsPerLine(W - 2 * marginL, titleSize);
  const totalDur = Number.isFinite(total) ? total
    : (items.length ? items[items.length - 1].sub1 : 0);

  const cSub = assColor(pal.subtitle, '&H00FFFFFF');
  const cOut = assColor(pal.subtitleOutline, '&H00101010');
  const cBack = assColor(pal.subtitleBack, '&H80000000');
  const cFg = assColor(pal.fg, '&H00FFFFFF');
  const cAccent = assColor(pal.accent, cFg);
  const cBg = assColor(pal.bg, '&H000C1016');

  // ★ 字幕底衬（详见 styleSpec 里 plate 的说明）。
  //   plate='box' ⇒ BorderStyle 1→3、Outline 从「描边宽」变成「盒内边距」、BackColour 变成盒填充色。
  //   颜色优先级：显式 plateColor → 该风格已有的 subtitleBack（α>0 才算数）→ palette.bg 加 CC α。
  const plateOn = sp.plate === 'box';
  //   ★ 显式 plateColor 若「画不出来」（全透明/非法），**不照用**而是降级到下面的回退链 ——
  //     否则会渲出一个看不见的底盒。这种配置错误由 check-dub-styles.mjs 硬红线 7 拦下。
  const cPlate = plateOn
    ? (isVisibleColor(sp.plateColor) ? assColor(sp.plateColor, null) : null)
      || (isVisibleColor(pal.subtitleBack) ? cBack : withAlpha(assColor(pal.bg, '&H000C1016'), 'CC'))
    : cBack;
  const subBorder = plateOn ? 3 : 1;
  const subOutline = plateOn ? Math.max(2, sp.platePad || ov) : ov;
  //   ★★ `Shadow` 在 box 模式下**必须为 0**（2026-10-03 像素实测判定）：
  //     libass 的盒阴影是一份**与盒几乎完全重叠**的整盒副本（盒越大重叠越多），
  //     于是半透明底衬被**二次合成** ⇒ 实际不透明度从 a 变成 1−(1−a)²。
  //     实测 `hd-2d`（底衬 #9E000000，a=0.38）：`Shadow=1` 盒内 rgb(110,103,85)、对比度 3.18；
  //     `Shadow=0` 盒内 rgb(158,148,124)、对比度 6.00 —— 后者正好等于「单层合成」的理论值，
  //     也就是 `check-dub-styles.mjs` 的对比度模型。⇒ 置 0 后实现与检查器口径一致，不再有偏差。
  //   ★ STYLE.md 里声明的「offset shadow」是 demo 侧的画法；ASS 的 1px 阴影既表达不了它，
  //     又会污染底衬不透明度，所以这里选择「不画」，并在 Skill 文档第 5 节如实说明。
  const subShadow = plateOn ? 0 : (sp.plate === 'none' ? 0 : 1);
  // ★★ 关键：`BorderStyle=3` 的底盒用的是 **OutlineColour（第 6 字段）**，不是 BackColour。
  //   依据：同文件 Role / Lower 样式写的就是 `Outline=cBg` + `BorderStyle=3`（`BackColour` 另给了
  //   `&H40101010` 作阴影），这就是「不透明底盒」在本项目里的既有写法。
  //   ★ 独立验证（红/绿对调实验）：OutlineColour=红+BackColour=绿 → 盒内模态色 rgb(253,0,0) 红；
  //     对调后 → rgb(0,254,0) 绿 ⇒ 盒色确实取 OutlineColour。
  //   ★ 踩过的坑：一开始把底衬色填进 BackColour，结果盒子画出来是 `subtitleOutline` 的颜色
  //     （好几个风格恰好是不透明黑）—— 光看 ASS 文本发现不了，**只有渲染出像素才看得出来**；
  //     当时 12/25 个风格实测对比度只有 1.00~1.43（不可读），而检查器按模型值报它们全部通过。
  const subOutlineCol = plateOn ? cPlate : cOut;

  const needRole = sp.showRole;
  const needLower = sp.overlay.lowerThird;
  const needRule = sp.overlay.accentRule;
  const needBar = sp.overlay.progressBar;
  const needCard = sp.overlay.chapterCards;
  const extra = needRole || needLower || needCard;
  const fadeMs = Math.round(sp.motion.subtitleFadeIn * 1000);

  const head = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // 字幕：白字 + 黑描边 + 轻投影，底部居中
    // ★ BorderStyle/Outline/OutlineColour 由 subtitle.plate 决定：缺省 = 1/ov/cOut（旧行为，逐字节不变）；
    //   'box' = 3/platePad，且 **OutlineColour 换成底衬色**（BorderStyle=3 下它是盒填充色）；
    //   'none' = 1/ov，Shadow=0（连投影也不画）。
    `Style: Sub,${fam},${fs2},${cSub},${cSub},${subOutlineCol},${cBack},${sp.bold ? -1 : 0},0,0,0,100,100,0,0,${subBorder},${subOutline},${subShadow},${sp.align},${marginL},${marginL},${marginV},1`,
    // 标题：顶部居中，字重加粗
    `Style: Title,${fam},${titleSize},${cFg},${cFg},${cOut},${cBack},-1,0,0,0,100,100,2,0,1,${Math.max(2, ov - 1)},1,8,${marginL},${marginL},${Math.round(H * 0.13)},1`,
  ];
  if (extra) {
    const pad = Math.max(2, Math.round(W / 320));
    const roleSize = Math.round(W * 0.036);
    const smallSize = Math.round(W * 0.030);
    const cardSize = Math.round(W * 0.075);
    const cardSubSize = Math.round(W * 0.042);
    // 角色小标签 / 左下常驻条：底衬用半透明底色，文字用 accent（BorderStyle=3 = 不透明底盒）
    head.push(`Style: Role,${fam},${roleSize},${cAccent},${cAccent},${cBg},&H40101010,0,0,0,0,100,100,1,0,3,${pad},0,7,0,0,0,1`);
    head.push(`Style: Lower,${fam},${smallSize},${cAccent},${cAccent},${cBg},&H40101010,0,0,0,0,100,100,1,0,3,${pad},0,7,0,0,0,1`);
    head.push(`Style: Card,${fam},${cardSize},${cFg},${cFg},${cBg},&H00101010,-1,0,0,0,100,100,2,0,1,${Math.max(2, ov - 1)},1,7,0,0,0,1`);
    head.push(`Style: CardSub,${fam},${cardSubSize},${cAccent},${cAccent},${cBg},&H00101010,0,0,0,0,100,100,1,0,1,${Math.max(2, ov - 2)},1,7,0,0,0,1`);
    head.push(`Style: Bar,${fam},${smallSize},${cAccent},${cAccent},${cBg},&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`);
  }
  head.push(
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  );

  const subLayer = sp.plain ? 0 : 3;      // 字幕压在所有叠加层之上（叠加层不得挡字幕）
  const titleLayer = sp.plain ? 1 : 4;
  const ev = [];
  if (title && titleDur > 0.2) {
    const fade = Math.min(0.45, titleDur / 3);
    ev.push(`Dialogue: ${titleLayer},${assTime(0)},${assTime(titleDur)},Title,,0,0,0,,{\\fad(${Math.round(fade * 1000)},${Math.round(fade * 1000)})}${toAssText(title, titlePerLine)}`);
  }

  const roles = itemRoles(items, segments);
  const runs = extra ? roleRuns(roles) : [];
  const maxLines = Math.max(1, ...items.map((it) => wrapCJK(it.text, subPerLine).length));
  const subBlock = Math.round(maxLines * fs2 * 1.25);
  const ruleH = Math.max(2, Math.round(H * 0.0028));
  const cardFade = sp.motion.chapterTransition === 'cut' ? '' : '\\fad(300,300)';
  const rect = (x, y, w, h, col, alpha) =>
    `{\\pos(${x},${y})\\p1\\bord0\\shad0\\c${col}\\alpha&H${alpha}&}m 0 0 l ${w} 0 l ${w} ${h} l 0 ${h}{\\p0}`;

  // 章节卡：role 变化处，整屏半透明色块 + role + 首句摘要（1.0~1.5s）
  if (needCard) {
    for (const [a] of runs) {
      if (a === 0) continue;
      const it = items[a];
      const c0 = Math.max(0, it.sub0 - 0.25);
      const c1 = Math.min(it.sub0 + 1.3, totalDur);
      if (c1 - c0 < 0.4) continue;
      const summary = wrapCJK(it.text, Math.max(8, Math.round((W - 2 * marginL) / (W * 0.042))))[0].slice(0, 16);
      ev.push(`Dialogue: 1,${assTime(c0)},${assTime(c1)},Bar,,0,0,0,,${cardFade}${rect(0, 0, W, H, cBg, 'E0')}`);
      ev.push(`Dialogue: 2,${assTime(c0)},${assTime(c1)},Card,,0,0,0,,{\\an5\\pos(${Math.round(W / 2)},${Math.round(H * 0.44)})${cardFade}}${assEsc(roles[a])}`);
      ev.push(`Dialogue: 2,${assTime(c0)},${assTime(c1)},CardSub,,0,0,0,,{\\an5\\pos(${Math.round(W / 2)},${Math.round(H * 0.52)})${cardFade}}${assEsc(summary)}`);
    }
  }
  // 角色小标签：每段开头 1.2s，放上沿左侧（不碰人脸）
  if (needRole) {
    for (const [a, b] of runs) {
      const t0 = Math.max(0, items[a].sub0 - 0.05);
      const t1 = Math.min(t0 + 1.2, items[b].sub1, totalDur);
      if (t1 - t0 < 0.3) continue;
      ev.push(`Dialogue: 2,${assTime(t0)},${assTime(t1)},Role,,0,0,0,,{\\pos(${marginL},${Math.round(H * 0.10)})}${assEsc(roles[a])}`);
    }
  }
  // 左下常驻条：当前段 role（放字幕块上方，避开下沿的字幕）
  if (needLower) {
    const y = Math.max(0, H - marginV - subBlock - Math.round(H * 0.055));
    for (const [a, b] of runs) {
      const t0 = Math.max(0, items[a].sub0 - 0.1);
      const t1 = Math.min(items[b].sub1, totalDur);
      if (t1 - t0 < 0.3) continue;
      ev.push(`Dialogue: 2,${assTime(t0)},${assTime(t1)},Lower,,0,0,0,,{\\pos(${marginL},${y})}${assEsc(roles[a])}`);
    }
  }
  // 字幕（本体）
  for (const it of items) {
    const pre = fadeMs > 0 ? `{\\fad(${fadeMs},0)}` : '';
    ev.push(`Dialogue: ${subLayer},${assTime(it.sub0)},${assTime(it.sub1)},Sub,,0,0,0,,${pre}${toAssText(it.text, subPerLine)}`);
  }
  // accentRule：字幕正上方一条细线
  if (needRule) {
    const y = Math.max(0, H - marginV - subBlock - Math.round(H * 0.018));
    ev.push(`Dialogue: 2,${assTime(0)},${assTime(totalDur)},Bar,,0,0,0,,${rect(marginL, y, W - 2 * marginL, ruleH, cAccent, '20')}`);
  }
  // progressBar：底部细进度条（60 段推进，够顺滑又不会把 ASS 撑爆）
  if (needBar) {
    const N = 60;
    const barH = Math.max(3, Math.round(H * 0.006));
    const y = H - barH;
    for (let i = 0; i < N; i++) {
      const t0 = totalDur * i / N, t1 = totalDur * (i + 1) / N;
      if (t1 - t0 <= 0) break;
      const fw = Math.max(1, Math.round(W * (i + 1) / N));
      ev.push(`Dialogue: 2,${assTime(t0)},${assTime(t1)},Bar,,0,0,0,,${rect(0, y, W, barH, cBg, '40')}{\\c${cAccent}\\alpha&H10&\\p1}m 0 0 l ${fw} 0 l ${fw} ${barH} l 0 ${barH}{\\p0}`);
    }
  }
  return head.concat(ev).join('\n') + '\n';
}

// ── 媒体探测 / 度量 ─────────────────────────────────────────────
/** ffprobe 视频流 + 音频流（WSL 侧）。返回 {w,h,fps,dur,vcodec,acodec,adur,ach,sr} */
export async function probe(fileWsl) {
  const out = await runWsl(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration -of json ${shq(fileWsl)}\n` +
    `echo '@@AUDIO@@'\n` +
    `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,duration -of json ${shq(fileWsl)}\n`,
    { name: 'probe' });
  const [vPart, aPart] = String(out.stdout).split('@@AUDIO@@');
  const r = { raw: out.stdout, w: null, h: null, fps: null, vcodec: null, dur: null, acodec: null, adur: null, ach: null, sr: null };
  try {
    const vj = JSON.parse(vPart);
    const s = (vj.streams || [])[0] || {};
    r.w = s.width ?? null; r.h = s.height ?? null; r.vcodec = s.codec_name ?? null;
    if (s.r_frame_rate && s.r_frame_rate !== '0/0') {
      const [n, d] = s.r_frame_rate.split('/').map(Number);
      r.fps = d ? n / d : null;
    }
    r.dur = vj.format?.duration ? Number(vj.format.duration) : null;
  } catch { /* ignore */ }
  try {
    const aj = JSON.parse(aPart);
    const s = (aj.streams || [])[0] || {};
    r.acodec = s.codec_name ?? null;
    r.adur = s.duration ? Number(s.duration) : r.dur;
    r.ach = s.channels ?? null;
    r.sr = s.sample_rate ? Number(s.sample_rate) : null;
  } catch { /* ignore */ }
  return r;
}

/**
 * 量一段音频：`astats` 的 **6 位小数**峰值 + `ebur128` 的集成响度 + `loudnorm` 的**真峰值**。
 * ★ 为什么三个都要（2026-10-03 修）：
 *   · `astats` 的 `Peak level dB` 是**采样峰值**，**不是真峰值** —— 实测全量 43 部成片里，
 *     两者最大差 **1.62 dB**（`pixel-rpg`：真 +0.08 / 采样 −1.536），有 5 部会因此被**漏报**。
 *   · `ebur128` 的 `Peak:` 虽然近似真峰值，但**只印 1 位小数**（`-1.17` 会印成 `-1.2`），
 *     精度不够当判据。
 *   ⇒ **真峰值一律取 `loudnorm` 的 `input_tp`（4× 过采样）**，就是返回里的 `truePeak`。
 *     `peak`（astats 采样峰值）保留作参考，**不要**拿它当达标判据、也不要标成「真峰值 dBTP」。
 */
export async function measure(fileWsl) {
  const out = await runWsl(
    `ffmpeg -hide_banner -nostdin -i ${shq(fileWsl)} -af astats=measure_perchannel=none -f null - 2>&1 | grep -F 'Peak level dB' | tail -1\n` +
    `echo '@@EBU@@'\n` +
    `ffmpeg -hide_banner -nostdin -i ${shq(fileWsl)} -af ebur128=peak=true -f null - 2>&1 | grep -E 'I: ' | tail -1\n` +
    `echo '@@TP@@'\n` +
    `ffmpeg -hide_banner -nostdin -i ${shq(fileWsl)} -af loudnorm=I=-14:TP=-1.7:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p'\n`,
    { name: 'measure' });
  const txt = String(out.stdout);
  const [aPart, rest] = txt.split('@@EBU@@');
  const [ePart, tPart] = String(rest || '').split('@@TP@@');
  const peak = Number((/Peak level dB:\s*(-?[\d.]+)/.exec(aPart || '') || [])[1]);
  const lufs = Number((/I:\s*(-?[\d.]+)\s*LUFS/.exec(ePart || '') || [])[1]);
  const truePeak = Number((/"input_tp"\s*:\s*"?(-?[\d.]+)"?/.exec(tPart || '') || [])[1]);
  return {
    peak: Number.isFinite(peak) ? peak : null,            // astats 采样峰值（参考）
    truePeak: Number.isFinite(truePeak) ? truePeak : null, // loudnorm input_tp（判据用这个）
    lufs: Number.isFinite(lufs) ? lufs : null,
    raw: txt,
  };
}

/** 真峰值目标（PCM 侧）：编码器（AAC）会把码间真峰值抬 0.08~0.22 dB，故留 0.5 dB 余量 */
export const TARGET_PEAK_PCM = -1.7;   // dBFS
export const TARGET_LUFS = -16;        // 社交视频常用
export const HARD_PEAK_LIMIT = -1.2;   // 成片实测必须 ≤ 此值

// ── 功能2：--keep-original 的字幕时间轴对齐 ─────────────────────
// 优先级：srt → asr → vad → even（前一个失败退下一个）。文案与素材内容一致，
// 所以**字幕文本一律用文案**，对齐手段只用来取时间。

/** 解析 SRT → [{start,end,text}] */
export function parseSrt(txt) {
  const cues = [];
  const blocks = String(txt ?? '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
  const t = (h, mi, s, ms) => (+h) * 3600 + (+mi) * 60 + (+s) + (+String(ms).padEnd(3, '0').slice(0, 3)) / 1000;
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim() !== '');
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const m = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/.exec(lines[ti]);
    if (!m) continue;
    cues.push({
      start: t(m[1], m[2], m[3], m[4]), end: t(m[5], m[6], m[7], m[8]),
      text: lines.slice(ti + 1).join(' ').trim(),
    });
  }
  return cues;
}

const CJK_RE = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
export function normCJK(s) {
  let out = '';
  for (const ch of String(s ?? '').normalize('NFKC').toLowerCase()) {
    if (/[0-9a-z]/.test(ch) || CJK_RE.test(ch)) out += ch;
  }
  return out;
}
/** 归一化后的 LCS 相似度（句子都很短，DP 足够快） */
export function lcsRatio(a, b) {
  if (!a || !b) return 0;
  const n = b.length;
  let prev = new Uint16Array(n + 1), cur = new Uint16Array(n + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    const t = prev; prev = cur; cur = t; cur.fill(0);
  }
  return prev[n] / Math.max(a.length, b.length);
}

/** 句子与「连续 cue 窗口」的最低 LCS 相似度（低于此值视为认不出，交给兜底分配）。 */
export const MIN_MATCH_RATIO = 0.34;

// ── 单条字幕的最短可读时长 ──────────────────────────────────────
// ★ 口径 = **最大阅读速度**（再快就看不清了），而不是「平均语速」：
//   本素材口播实测 ≈6.2 字/秒（261 字 / 42.1s），若拿 dub.mjs 的 EST_CPS=5.5（那是**口播语速**
//   标定，用来估 TTS 时长）当下限，则 261 字需 47.5s > 素材 42.4s —— **数学上不可行**，
//   必然有句子「读不完」。所以这里取「读」的上限而非「说」的平均。
export const SUB_MAX_CPS = 9.0;   // CJK 字幕最大阅读速度（字/秒）
export const SUB_MIN_DUR = 0.8;   // 任何一条字幕的绝对下限（秒）

/** 一句文案的最短可读时长（秒）：按去空白字数 / 最大阅读速度，加绝对下限兜底。 */
export function minReadableDur(sentence) {
  const chars = String(sentence ?? '').replace(/\s/g, '').length;
  return Math.max(SUB_MIN_DUR, chars / SUB_MAX_CPS);
}

/** 把 `total` 个整数按权重 `weights` 分配（最大余数法），保证 sum 恰好 = total。 */
function splitCounts(weights, total) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const cnt = raw.map((x) => Math.floor(x));
  let rem = total - cnt.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < rem && order.length; k++) cnt[order[k % order.length].i]++;
  return cnt;
}

/**
 * SRT 路：把 cues 的文本与文案句子按相似度单调配对，**把 cue 序列切成互不重叠、
 * 首尾相接的区间**（每句一段），再用共享边界换算成时间窗。
 *
 * ★ 为什么不是「一句只认一条 cue」（旧实现，已修）：
 *   一句 40 字常横跨 3–4 条 cue，而单条 cue 只有 ~10 字 ⇒ 整句与任何单条 cue 的
 *   LCS 相似度都 < 0.34（`max(40,10)=40` 做分母），于是「认不出」+ 只取那一条 cue 的窗口
 *   ⇒ 窗口太短（34 字给 1.6s）、句间空档（几秒没有字幕）。改成对**连续窗口**匹配即根治。
 *
 * 返回 `{ spans, hitRate }`：`spans[i]=[start,end]`；`hitRate` = 认出锚点的句子数 / 总句数
 * （语义不变，仅作诊断）。`cues` 为空 / 句子为空 ⇒ 安全降级（绝不抛）。
 */
export function alignCuesToSentences(cues, sentences) {
  const S = Array.isArray(sentences) ? sentences : [];
  const N = S.length;
  if (!N) return { spans: [], hitRate: 0 };                      // 句子为空 → 空结果
  if (!Array.isArray(cues) || !cues.length) {                    // cues 为空 → 优雅降级
    return { spans: S.map(() => [0, 0]), hitRate: 0 };
  }
  const M = cues.length;
  const nc = cues.map((c) => normCJK(c.text));
  const ns = S.map((s) => normCJK(s));

  // ── 1) 单调配对：每句找「一段连续 cue」的最佳匹配窗口 [j,k] ──
  const win = new Array(N).fill(null);
  let j0 = 0, hits = 0;
  for (let i = 0; i < N; i++) {
    if (!ns[i]) continue;                                        // 空句 → 交给兜底
    // 窗口再长也不可能有 ratio ≥ MIN_MATCH_RATIO（分母是窗口长度）→ 超过就没必要试
    const cap = Math.max(2, Math.ceil(ns[i].length / MIN_MATCH_RATIO) + 1);
    let best = null;
    for (let j = j0; j < M; j++) {
      let acc = '';
      for (let k = j; k < M; k++) {
        acc += nc[k];
        if (acc.length > cap) break;
        const r = lcsRatio(ns[i], acc);
        if (!best || r > best.r + 1e-9 ||
            (Math.abs(r - best.r) <= 1e-9 && (k - j) < (best.k - best.j))) best = { j, k, r };
      }
    }
    if (!best || best.r < MIN_MATCH_RATIO) continue;             // 认不出 → 交给兜底
    win[i] = [best.j, best.k];
    hits++;
    j0 = best.k + 1;                                             // 下一句只能往后找（单调）
  }
  const hitRate = hits / N;

  // ── 2) 把 cue 下标切成互不重叠的区间（每句一段）──
  //   认出的句子占住自己的窗口；认不出的句子在「上一窗口末+1 ~ 下一窗口起-1」之间按字数分配。
  const lo = new Array(N).fill(0);
  for (let i = 0; i < N; i++) if (win[i]) lo[i] = win[i][0];
  let idx = 0, i = 0;
  while (i < N) {
    if (win[i]) { idx = win[i][1] + 1; i++; continue; }
    let j = i; while (j < N && !win[j]) j++;                     // 本段「认不出」的连续句 [i, j)
    const free = (j < N ? win[j][0] : M) - idx;                  // 可分配的空闲 cue 数
    const cnt = splitCounts(ns.slice(i, j).map((s) => Math.max(1, s.length)), Math.max(0, free));
    let cur = idx;
    for (let t = i; t < j; t++) { lo[t] = cur; cur += cnt[t - i]; }
    idx = cur;
    i = j;
  }
  const loEnd = lo.concat([M]);                                  // loEnd[N] = M（末句之后 = 素材末）
  // 边界时间：c 之前 → 素材头；c 之后 → 素材尾；否则取第 c 条 cue 的 start。
  // 用**共享边界**换算 ⇒ 相邻两句必然首尾相接（无空档、无重叠）。
  const tau = (c) => (c <= 0 ? cues[0].start : c >= M ? cues[M - 1].end : cues[c].start);
  const B = loEnd.map(tau);

  // ── 3) 最短可读时长：短于下界则向后借（把下一句起点后移）──
  //   借的上限 = 下一句的锚点 cue 的 start（认得出时）/ 下下个边界（认不出时）；
  //   ★ 认得出时锚点 start 就是当前边界 ⇒ 实际只在「下一句认不出」时才借，
  //     不会把一句已对齐好的字幕推离它的语音。
  for (let t = 0; t < N - 1; t++) {
    const want = B[t] + minReadableDur(S[t]);
    if (want <= B[t + 1]) continue;
    let cap = B[t + 2];
    if (win[t + 1]) cap = Math.min(cap, cues[win[t + 1][0]].start);
    B[t + 1] = Math.max(B[t + 1], Math.min(want, cap));
  }

  const spans = [];
  for (let t = 0; t < N; t++) spans.push([B[t], B[t + 1]]);
  return { spans, hitRate };
}

/** 把 [start,end] 序列变成带字幕窗的 items；★ 末条绝不越出素材时长 */
export function buildItemsFromSpans(lines, spans, totalDur) {
  const items = [];
  let floor = 0;
  for (let i = 0; i < lines.length; i++) {
    const sp = spans[i] || [0, 0];
    let s = Math.min(totalDur, Math.max(0, sp[0]));
    let e = Math.min(totalDur, Math.max(s + 0.2, sp[1]));
    let sub0 = Math.max(floor, s - 0.12);
    let sub1 = Math.min(totalDur, e + 0.25);
    if (!(sub1 > sub0)) sub1 = Math.min(totalDur, sub0 + 0.3);
    if (!(sub1 > sub0)) { sub0 = Math.max(0, totalDur - 0.3); sub1 = totalDur; }
    sub0 = Math.min(sub0, Math.max(0, totalDur - 0.05));
    sub1 = Math.min(sub1, totalDur);                       // ★ 末条字幕不得越出素材
    items.push({ id: lines[i].id, text: lines[i].text, t0: s, t1: e, dur: Math.max(0, e - s), sub0, sub1 });
    floor = sub1;
  }
  return items;
}

/** 按字数比例把句子摊到若干「有声区间」上（vad / even 两路都用它） */
export function distributeByProportion(intervals, sentences, totalDur) {
  let list = (Array.isArray(intervals) ? intervals : [])
    .map(([a, b]) => [Math.max(0, Math.min(totalDur, a)), Math.max(0, Math.min(totalDur, b))])
    .filter(([a, b]) => b - a > 0.02)
    .sort((x, y) => x[0] - y[0]);
  if (!list.length) list = [[0, totalDur]];
  const totalSpeech = list.reduce((a, [s, e]) => a + (e - s), 0);
  const chars = sentences.map((t) => Math.max(1, String(t).replace(/\s/g, '').length));
  const totalChars = chars.reduce((a, b) => a + b, 0);
  const posToTime = (p) => {
    let acc = 0;
    for (const [s, e] of list) {
      const d = e - s;
      if (p <= acc + d) return s + Math.max(0, p - acc);
      acc += d;
    }
    return list[list.length - 1][1];
  };
  let acc = 0;
  return sentences.map((_, i) => {
    const w = chars[i] / totalChars * totalSpeech;
    const r = [posToTime(acc), posToTime(acc + w)];
    acc += w;
    return r;
  });
}

/** ffmpeg silencedetect → 有声区间（VAD 路的输入） */
export async function detectSpeech(fileWsl, dur, { echo = false } = {}) {
  const r = await runWsl(
    `ffmpeg -hide_banner -nostdin -i ${shq(fileWsl)} -af silencedetect=noise=-32dB:d=0.25 -f null - 2>&1 | grep -E 'silence_(start|end)' || true`,
    { name: 'vad', echo });
  const evs = [];
  for (const line of String(r.stdout).split('\n')) {
    let m = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (m) { evs.push({ t: Number(m[1]), k: 's' }); continue; }
    m = /silence_end:\s*(-?[\d.]+)/.exec(line);
    if (m) evs.push({ t: Number(m[1]), k: 'e' });
  }
  evs.sort((a, b) => a.t - b.t);
  const iv = [];
  let start = 0, inSil = false;
  for (const e of evs) {
    if (e.k === 's' && !inSil) { if (e.t > start + 0.05) iv.push([start, Math.min(dur, e.t)]); inSil = true; }
    else if (e.k === 'e' && inSil) { start = Math.max(0, e.t); inSil = false; }
  }
  if (!inSil && dur > start + 0.05) iv.push([start, dur]);
  return iv;
}

// ★ ASR 只借它的**时间**，不用它的转写文本。复用本机已有的 faster-whisper
//   （/home/lemo/lemo-opuscar/.venv 里已装 1.2.1，HF 缓存有 base / base.en），不另装一套。
// ★ 离线优先（口径与主题通路的 core/tts/asr_check.py **完全一致**，不另立一套）：
//   huggingface.co 在本机解析到不可路由的 IPv6 ⇒ 每次取模型都先联网校验、一路 SYN-SENT
//   到超时才回退本地缓存（实测这条 dub 路径 **148.8s**，其中绝大部分是白等）。
//   模型已在本地 HF 缓存 ⇒ 在 `import faster_whisper` **之前**设 HF_HUB_OFFLINE=1，不再联网。
//   缓存里没有 ⇒ 明确提示后回退联网（不许静默挂）。开关 LEMO_ASR_OFFLINE：auto（默认）/1 强制离线/0 强制联网。
export const ASR_ALIGN_PY = String.raw`
import sys, json, unicodedata, difflib, os, glob

def _hub_cache_dir():
    """HF 的 hub 缓存根（口径与 huggingface_hub 默认一致：HUGGINGFACE_HUB_CACHE > HF_HOME/hub > ~/.cache/huggingface/hub）"""
    return (os.environ.get('HUGGINGFACE_HUB_CACHE')
            or os.path.join(os.environ.get('HF_HOME') or os.path.expanduser('~/.cache/huggingface'), 'hub'))

def _cached_locally(name):
    """模型是否已经在本地 HF 缓存里 —— 这就是「能不能离线跑」的判据。"""
    if os.path.isdir(name):
        return True                                   # 本地目录：永远不需要联网
    repo = name if '/' in name else 'Systran/faster-whisper-' + name
    for snap in glob.glob(os.path.join(_hub_cache_dir(), 'models--' + repo.replace('/', '--'), 'snapshots', '*')):
        for f in ('model.bin', 'model.safetensors'):
            p = os.path.join(snap, f)
            if os.path.exists(p) and os.path.getsize(p) > 0:
                return True
    return False

def go_offline_if_possible(name):
    """离线优先：模型已在本地 ⇒ 设 HF_HUB_OFFLINE=1（与 asr_check.py 同一口径）。
    ★ 必须在 "from faster_whisper import WhisperModel" **之前**调用（huggingface_hub 在 import 时读这个变量）。
    本地没有 ⇒ **明确提示**再回退联网（不因设了离线就崩，也不静默挂）。
    开关 LEMO_ASR_OFFLINE：auto（默认）/ 1 强制离线（缓存缺失即快速失败）/ 0 强制联网。"""
    pref = (os.environ.get('LEMO_ASR_OFFLINE') or 'auto').strip().lower()
    if pref in ('0', 'false', 'no', 'online'):
        return 'online'
    if _cached_locally(name):
        os.environ['HF_HUB_OFFLINE'] = '1'            # faster-whisper 只走 huggingface_hub，这一个就够
        print(f"dub-asr: model '{name}' is in the local cache → offline (HF_HUB_OFFLINE=1), no network", file=sys.stderr)
        return 'offline'
    if pref in ('1', 'true', 'yes', 'on', 'offline'):
        print(f"dub-asr: LEMO_ASR_OFFLINE=1 but the model '{name}' is not in the local cache "
              f"({_hub_cache_dir()}). Download it once, or pass --model /path/to/model-dir.", file=sys.stderr)
        sys.exit(2)
    print(f"dub-asr: the model '{name}' is NOT in the local cache ({_hub_cache_dir()}) → fetching it from "
          f"huggingface.co now (needs a working network, and can take a while if that host is blocked).\n"
          f"  To avoid this next time: pre-download it, pass --model /path/to/model-dir, or set "
          f"HF_ENDPOINT=https://hf-mirror.com", file=sys.stderr)
    return 'online'

def norm(s):
    s = unicodedata.normalize('NFKC', str(s)).lower()
    return ''.join(ch for ch in s if ch.isalnum() or 0x3400 <= ord(ch) <= 0x9fff)

def main():
    audio, inp, outp, model = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    d = json.load(open(inp, encoding='utf-8'))
    sents = d['sentences']
    go_offline_if_possible(model)                      # ★ 必须在下面那行 import 之前（见函数注释）
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device='cpu', compute_type='int8')
    segs, info = m.transcribe(audio, beam_size=5, language='zh', word_timestamps=True,
                              condition_on_previous_text=False,
                              initial_prompt='以下是普通话的句子。')
    words = []
    for s in segs:
        for w in (s.words or []):
            words.append((w.word, float(w.start), float(w.end)))
    chars, cst, cen = [], [], []
    for w, a, b in words:
        n = norm(w)
        if not n:
            continue
        L = len(n)
        for k, ch in enumerate(n):
            chars.append(ch)
            cst.append(a + (b - a) * k / L)
            cen.append(a + (b - a) * (k + 1) / L)
    res = {'ok': True, 'model': model, 'lang': getattr(info, 'language', 'zh'),
           'words': len(words), 'chars': len(chars), 'mode': 'match'}
    if len(chars) < 8:
        res['ok'] = False; res['error'] = 'ASR 字符太少（%d），判定失败' % len(chars)
        json.dump(res, open(outp, 'w', encoding='utf-8'), ensure_ascii=False); return
    qs = [norm(s) for s in sents]
    spans, matched, totalq, pos = [], 0, 0, 0
    for q in qs:
        totalq += len(q)
        if not q:
            spans.append(None); continue
        hi = min(len(chars), pos + max(60, int(len(q) * 3)))
        win = ''.join(chars[pos:hi])
        sm = difflib.SequenceMatcher(None, q, win, autojunk=False)
        bl = [b for b in sm.get_matching_blocks() if b.size > 0]
        if not bl:
            spans.append(None); continue
        matched += sum(b.size for b in bl)
        s0 = cst[min(len(cst) - 1, pos + bl[0].b)]
        e1 = cen[min(len(cen) - 1, pos + bl[-1].b + bl[-1].size - 1)]
        pos = min(len(chars), pos + bl[-1].b + bl[-1].size)
        spans.append([s0, e1])
    rate = matched / max(1, totalq)
    res['rate'] = rate
    if rate < 0.5:
        # 转写与文案字形对不上（繁体/同音/听错）→ 退成「按累计字数比例」映射 ASR 时间轴。
        # 仍然用的是 ASR 的真实语音时间，只是不再逐字匹配。
        res['mode'] = 'prop'
        totalq = sum(len(q) for q in qs) or 1
        acc = 0
        spans = []
        for q in qs:
            w = len(q) / totalq
            i0 = int(round(acc * len(chars)))
            i1 = int(round((acc + w) * len(chars)))
            i0 = max(0, min(len(chars) - 1, i0)); i1 = max(i0 + 1, min(len(chars), i1))
            spans.append([cst[i0], cen[i1 - 1]])
            acc += w
    res['segments'] = spans
    json.dump(res, open(outp, 'w', encoding='utf-8'), ensure_ascii=False)

try:
    main()
except Exception as e:
    import traceback
    sys.stderr.write(traceback.format_exc()[-1500:])
    try:
        json.dump({'ok': False, 'error': '%s: %s' % (type(e).__name__, e)},
                  open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False)
    except Exception:
        pass
    sys.exit(2)
`;

/**
 * ASR 强制对齐（faster-whisper 词级时间 → 文案句子）。
 * 返回 { ok, mode:'match'|'prop', rate, spans, model } 或 { ok:false, error }
 */
export async function alignByAsr({ srcWsl, sentences, dur, model, echo = false, timeoutMs = 900000 }) {
  const tag = `asralign-${process.pid}-${Date.now().toString(36)}`;
  const pyHost = path.join(CFG.tmpDir, `${tag}.py`);
  const inHost = path.join(CFG.tmpDir, `${tag}.in.json`);
  const outHost = path.join(CFG.tmpDir, `${tag}.out.json`);
  const wav = `/tmp/${tag}.wav`;
  const mdl = model || process.env.WHISPER_MODEL || 'base';
  fs.mkdirSync(CFG.tmpDir, { recursive: true });
  fs.writeFileSync(pyHost, ASR_ALIGN_PY, 'utf8');
  fs.writeFileSync(inHost, JSON.stringify({ sentences, dur }), 'utf8');
  const py = `${CFG.wslLib}/.venv/bin/python`;
  // ★ LEMO_ASR_OFFLINE 的 Windows→WSL 传递：WSL **不**继承 Windows 环境变量（实测 `wsl.exe -e bash -lc 'echo $X'` 为空），
  //   而 dub.mjs 是在 Windows 侧跑的 —— 不显式带过去，这个开关在 dub 路径上就是死的。
  //   不设时整条命令与改动前**逐字相同**（脚本内默认 auto）。
  const offlinePref = process.env.LEMO_ASR_OFFLINE;
  const envPrefix = offlinePref ? `LEMO_ASR_OFFLINE=${shq(offlinePref)} ` : '';
  const script = [
    `ffmpeg -hide_banner -nostdin -y -i ${shq(srcWsl)} -vn -ac 1 -ar 16000 -c:a pcm_s16le -y ${shq(wav)} || { echo ASR_FAIL_EXTRACT; exit 2; }`,
    `${envPrefix}${shq(py)} ${shq(winToWsl(pyHost))} ${shq(wav)} ${shq(winToWsl(inHost))} ${shq(winToWsl(outHost))} ${shq(mdl)} || { echo ASR_FAIL_RUN; exit 3; }`,
    `rm -f ${shq(wav)}`,
    `echo ASR_DONE`,
  ].join('\n');
  try {
    const r = await runWsl(script, { name: 'dub-asr', echo, timeout: timeoutMs });
    if (!fs.existsSync(outHost)) return { ok: false, error: `ASR 未产出结果（退出码 ${r.code}）\n${String(r.stderr).slice(-600)}` };
    const j = JSON.parse(fs.readFileSync(outHost, 'utf8'));
    if (!j.ok) return { ok: false, error: j.error || 'ASR 失败' };
    return { ok: true, mode: j.mode, rate: Number(j.rate) || 0, spans: j.segments, model: j.model, words: j.words };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally {
    for (const f of [pyHost, inHost, outHost]) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
  }
}

// ── 语义解析桥（lib/dub-semantic.mjs 是另一个智能体的冻结接口）──────
// ★ 动态 import + 缓存：文件还没落地 / 写坏时，工具**不能**整体崩掉，只能退化成
//   「无语义」的朴素路径（单段 role=其他、风格取用户给的那个）。
let _semCache;
export async function loadSemantic() {
  if (_semCache !== undefined) return _semCache;
  try { _semCache = await import('./dub-semantic.mjs'); }
  catch { _semCache = null; }
  return _semCache;
}

/** 语义里带的候选风格 id（供 --style auto 的候选集用）；注册表缺失时给 null。 */
export function styleIdsFromRegistry() {
  const reg = loadStyleRegistry();
  return reg ? reg.styles.filter((s) => s && s.id).map((s) => s.id) : null;
}
