#!/usr/bin/env node
/**
 * scripts/check-render-venc.mjs —— 「渲染一律 GPU 优先」硬规则的**机器守卫**
 *
 * ★ ① 由来（2026-10-04，用户硬规则 + 一次只读审计）：
 *   用户硬规则（最高优先级）：「渲染必须用我的显卡 GPU 跑，整个项目只要涉及渲染都要 GPU 优先渲染」。
 *   审计发现**出片路径上的编码器决策点**此前是「未设 LEMO_VENC ⇒ 静默 libx264(CPU)」：
 *     · `core/render/video.mjs`（渲染分段）、`core/render/mux.sh`（混流）、
 *       9 个 `styles/<slug>/demo/tools/mux.sh`（被编排器挑中的混流脚本）。
 *   编排器 `lemo-make.mjs` 默认导出 `LEMO_VENC=h264_nvenc`（出片路径本来就走 GPU），
 *   但**手工构建**（`sh styles/<slug>/demo/build.sh`）不设该变量 ⇒ 改之前手工出片走 CPU。
 *   ⇒ 本闸门把「未设/非法 ⇒ 静默 CPU」钉死为 FAIL，防止这类**静默回落**再次溜回库里。
 *
 * ★ ② 判据（机械可解释）：
 *   A 类（**判 FAIL**）—— 出片路径上的编码器决策点：
 *     · `core/render/video.mjs`、`core/render/mux.sh`、以及**被编排器挑中的** `demo/tools/mux.sh`
 *       （挑选规则同 `check-mux-selection.mjs`：`demo/tools/mux.sh` → `demo/mux.sh`，门槛含 `A="$2"`，
 *        否则回退 `core/render/mux.sh`）。
 *     · 必须满足：**未设 LEMO_VENC ⇒ h264_nvenc**；**显式 libx264 ⇒ CPU**；**其它值 ⇒ 非静默（报错退出）**。
 *     · 任何「未设或非法 ⇒ 静默 libx264」判 FAIL，报出**文件 + 行号 + 实际写法**。
 *   B 类（**只列 backlog，不判 FAIL**）—— 不在出片路径上的 15 个手工脚本：
 *     · 列出「已支持 LEMO_VENC / 仍硬写 libx264」两类计数，供人工决定。符合本项目纪律
 *       （已记录积压不判 FAIL）。
 *   C. **两份副本一致性（判 FAIL）**：上述文件在 `D:/lemo-opuscar` 与 WSL `/home/lemo/lemo-opuscar`
 *     必须**逐字节一致**（比 md5）。
 *   D 类（**判 FAIL**）—— 文档/注释里的**过期声称**：
 *     · 在 `D:/lemo-opuscar` 与 `D:/lemo-tools` 的文档/注释（.md/.sh/.mjs/.js/.cjs/.py/.html/.txt/
 *       .json/.bat/.css 与 CREDITS/README/DEMO/STYLE… 等无扩展名文件）里，
 *       **断言「未设/默认 ⇒ libx264」** ⇒ 判 FAIL，报出**仓库 + 文件 + 行号 + 原文片段**。
 *     · 语义变了（2026-10-04）：以前「未设 ⇒ libx264(CPU)」，现在「未设 ⇒ h264_nvenc(GPU)」；
 *       任何还在说「默认是 libx264 / unset means libx264」的文字都成了**撒谎的文档**。
 *     · 判据（关键词/上下文，**不做语义理解**）：同一「小句」内同时出现
 *       (a) `libx264` (b) 默认/未设 类限定词（默认|缺省|不设|没设|未设|unset|default）
 *       (c) 编码上下文（LEMO_VENC|编码|encoder|venc|nvenc|ffmpeg|mux|转码）
 *       且**不**出现 (d) 显式/回退/硬写 等限定词（显式|指定|explicit|才走|才用|回退|回落|fallback|
 *       硬写|硬编码|写死|违反|违规|FAIL|此前|原来|原先|曾经|used to|previously|legacy|不再|
 *       断言|闸门|守卫 —— 末三者用来放行「描述本闸门判据自身」的文字）、
 *       也**不**出现 `h264_nvenc`、
 *       ★ **且满足 (e) 相邻性**（2026-10-06 修一个已确认的**假红**）：
 *       限定词必须**直接修饰** `libx264` —— 二者之间的文本只允许是
 *       「空白 / 标点（**不含表格竖线 `|`**）/ 连接词白名单（使用|用|走|选|是|为|的|时|值|
 *       选项|编码器|编码|器|情况|means|is|use|by|encoder|…|`LEMO_VENC`）」；
 *       且当限定词在 `libx264` **之后**时，其右侧还必须紧接「边界 / 标点 / 连接词」。
 *       ⇒ 才判 FAIL。
 *       「小句」切分符：`；;。，,` —— 避免「A；B」跨句误判
 *       （如正确写法「未设⇒h264_nvenc；显式 libx264⇒CPU」不会被误报）。
 *     · ★ 为什么要有 (e)：旧判据只要求「同一小句里同时出现」，于是
 *       `| libx264 | 默认安装即有的软件编码器，兼容性最好 |`
 *       被误判为「过期声称」—— 这里 `默认` 修饰的是「默认**安装**」，不是在说「编码器默认值」。
 *       纯关键词判据区分不了这种「限定词其实在修饰别的词」的情形。(e) 要求限定词**紧贴**编码器名：
 *       上例 `libx264` 与 `默认` 隔着表格竖线 `|`（竖线是单元格边界、不是连接文字）⇒ 判「不相邻」⇒ 不报；
 *       `libx264 是默认安装自带的软件编码器` 里 `默认` 右侧紧接实词「安装」⇒ 同样判「不相邻」⇒ 不报。
 *       而真正的过期声称（`默认使用 libx264 编码` / `libx264 是默认编码器` / `未设 LEMO_VENC 时使用 libx264`）
 *       限定词与编码器名之间只有连接词 ⇒ 仍**照旧判 FAIL**（实测见 test/README.md 条目）。
 *
 * ★ ③ 已知局限 / 会误报的边界：
 *   · 只做**文本/语法级**判定，不跑 ffmpeg —— 「未设时真的会调 h264_nvenc」是靠读代码确认的，不是实测编码。
 *   · 只认 `case "${LEMO_VENC:-}" in` 这一种 shell 写法与 `process.env.LEMO_VENC` 这一种 mjs 写法；
 *     若将来有人用别的写法（如 `if [ -z "$LEMO_VENC" ]`）本闸门会**看不见**（假阴性）。
 *   · 双副本一致性检查只在 `LEMO_OPUSCAR` 指向**规范路径** `D:/lemo-opuscar` 时进行
 *     （做变异测试时指向临时目录，WSL 侧无对应副本，故自动跳过；也可用 `--no-wsl` 强制跳过）。
 *   · **防空转绿灯**：解析出的「编码器决策点」为 0 ⇒ **判 FAIL 并明说「本闸门已失明」**
 *     —— 否则路径一变，本闸门会静默枚举到 0 个文件、报「0 处违规」并绿灯通过，比不检查更危险。
 *     D 类同理：**任一仓库**（opuscar / lemo-tools）扫到的文件数为 0 ⇒ 判 FAIL 并明说哪个仓库失明。
 *   · D 类**只做关键词/上下文判定，不做语义理解**，因此边界情况会**漏（假阴性）**：
 *     - 「默认走 CPU」这种**不点名 libx264** 的旧声称，D 类看不见；
 *     - 把旧声称改写成「默认 libx264，也可显式指定 h264_nvenc」这类**同时含显式词**的句子会被漏（(d) 误护）；
 *     - 旧声称拆成两行、或限定词与 `libx264` 隔了 `；。，` 的，会被漏；
 *     - 英文 "libx264 is used by default" 若同句含 `explicit`/`previously` 等词，会被漏。
 *     - ★ (e) 相邻性**自身**带来的新边界（有意取舍，非疏漏）：限定词与 `libx264` 之间若垫了
 *       **实词或整段说明**（如「默认情况下，编码器（用于分段渲染）走 `libx264`」中间的
 *       「编码器（用于分段渲染）走」），(e) 会判「不相邻」而**漏报**；表格里限定词与编码器名
 *       **分处两格**的真声称（如 `| libx264 | 默认 |`）也会被漏（(e) 视竖线为单元格边界）。
 *       理由：**同一形态也正是假红的来源**（`| libx264 | 默认安装… |`），纯文本判据无法两全；
 *       本闸门选择「宁漏不乱报」—— 漏报可由人工/其它闸门兜底，乱报会让整条守卫失去可信度。
 *       连接词白名单是**正向**的：不在表内的实词一律使 (e) 不成立（宁可判「不相邻」）。
 *   · D 类**有意不查**的形态（显式排除，非疏漏）：
 *     - 本闸门自身 `scripts/check-render-venc.mjs` 与配套 `scripts/patch-render-venc.mjs`
 *       —— 它们天然携带旧文本（判据说明 / 替换搜索键），扫它们只会产生恒定误报；
 *     - `*.orig-*` 等备份文件（不在出片路径，另见报告）与 `_superseded*` 归档目录；
 *     - `node_modules`/`.git`/`out`/`logs`/`ref`/`fonts`/`voices` 等产物或二进制目录。
 *     - 合法的「回退/显式」提及（如「回退 libx264」「显式 libx264 才走 CPU」）**故意不报**。
 *
 * ★ 路径**基于脚本自身位置推导**（`import.meta.url` → `../..`），**允许覆盖**：
 *   `LEMO_OPUSCAR`（默认 `<脚本>/../../lemo-opuscar`）、`LEMO_STYLES_ROOT`（默认 `<OPUSCAR>/styles`）。
 *   这样可以把 `core/` 与 `styles/` 一起拷到临时目录做**变异测试**，而不是改真实文件做反向测试。
 *
 * 用法：node scripts/check-render-venc.mjs [--json] [--no-wsl]
 * 退出码：A 类有违规、或 D 类有过期声称、或双副本不一致、或本闸门失明 → 1；否则 0（B 类不影响退出码）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** ★ `wsl.exe` 不能用 spawnSync（实测 `EBUSY`），必须用异步 spawn。 */
function sh(cmd, args) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { windowsHide: true });
    let o = '', e = '';
    c.stdout.on('data', (d) => { o += d; });
    c.stderr.on('data', (d) => { e += d; });
    c.on('close', (code) => resolve({ code, o, e }));
    c.on('error', (x) => resolve({ code: -1, o, e: String(x.message) }));
  });
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || path.join(HERE, '..', '..', 'lemo-opuscar'));
const STYLES = path.resolve(process.env.LEMO_STYLES_ROOT || path.join(OPUSCAR, 'styles'));
const CANON_WIN = path.resolve('D:/lemo-opuscar');
const WSL_ROOT = '/home/lemo/lemo-opuscar';
const DISTRO = 'Ubuntu-24.04';
const JSON_OUT = process.argv.includes('--json');
const NO_WSL = process.argv.includes('--no-wsl');

const rel = (p) => path.relative(OPUSCAR, p).replace(/\\/g, '/');
const read = (p) => fs.readFileSync(p, 'utf8');
const md5 = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');

// ── 被编排器挑中的混流脚本（复刻 lemo-make.mjs 的挑选规则）──────────────────
function pickMux(slug) {
  const d = path.join(STYLES, slug, 'demo');
  for (const c of [path.join(d, 'tools', 'mux.sh'), path.join(d, 'mux.sh')]) {
    if (!fs.existsSync(c)) continue;
    if (read(c).includes('A="$2"')) return { file: c, own: true };
    return { file: path.join(OPUSCAR, 'core', 'render', 'mux.sh'), own: false, skipped: c };
  }
  return { file: path.join(OPUSCAR, 'core', 'render', 'mux.sh'), own: false };
}

// ── A 类解析 ────────────────────────────────────────────────────────────────
/** 解析 shell 里的 `case "${LEMO_VENC:-}" in … esac`，返回各 pattern 分支（含行号）。 */
function parseShellVenc(text) {
  const m = text.match(/case "\$\{LEMO_VENC:-\}" in\n([\s\S]*?)\nesac/);
  if (!m) return null;
  const startLine = text.slice(0, m.index).split('\n').length; // `case` 所在行
  const pats = [];
  m[1].split('\n').forEach((l, i) => {
    if (!l.trim() || /^\s*#/.test(l)) return;
    const mm = l.match(/^\s*([^)]*)\)\s*(.*)$/);
    if (!mm) return;
    pats.push({ pattern: mm[1].trim(), body: mm[2], line: startLine + 1 + i });
  });
  return pats;
}

/** 判一个 shell 编码器决策点；返回 { ok, problems:[{line,msg}] }。 */
function judgeShell(text) {
  const pats = parseShellVenc(text);
  if (!pats) return { parsed: false, ok: false, problems: [{ line: 0, msg: '找不到 `case "${LEMO_VENC:-}" in` 块（写法变了？）' }] };
  const P = (x) => x.pattern.split('|').map((s) => s.trim());
  const unset = pats.filter((x) => P(x).includes("''"));
  const libx = pats.filter((x) => P(x).includes('libx264'));
  // ★ 兜底分支：`*)` 与 `*|libx264)` 都算（后者是「非法值静默走 CPU」的坏形态）。
  //   2026-10-04 修正：原先只认 `pattern === '*'`，于是 `*|libx264)` 会落进「没有 `*)` 兜底分支」
  //   这条 —— 措辞与事实不符（兜底是有的，只是它静默走 CPU），会误导修复者。
  const star = pats.filter((x) => P(x).includes('*'));
  const isNvenc = (x) => /h264_nvenc/.test(x.body);
  const isCpu = (x) => /libx264/.test(x.body) && !/h264_nvenc/.test(x.body);
  const nonSilent = (x) => /\bexit\b/.test(x.body) || /\bdie\b/.test(x.body);

  const problems = [];
  // 未设 ⇒ 必须 nvenc；若 unset 分支是 libx264 ⇒ 静默 CPU（FAIL）
  for (const x of unset) if (isCpu(x)) problems.push({ line: x.line, msg: `未设 LEMO_VENC ⇒ 静默 libx264（CPU）：${x.pattern}) ${x.body.slice(0, 60)}…` });
  if (!unset.length) problems.push({ line: 0, msg: '没有「未设（空串）」分支 —— 未设时行为未定义' });
  else if (!unset.some(isNvenc)) problems.push({ line: unset[0].line, msg: '「未设」分支没有走 h264_nvenc（GPU 优先）' });
  // 非法值 ⇒ 必须非静默；`*)` 分支若 libx264 ⇒ 静默 CPU（FAIL）
  for (const x of star) if (isCpu(x)) problems.push({ line: x.line, msg: `非法值（*）⇒ 静默 libx264（CPU）：${x.pattern}) ${x.body.slice(0, 60)}…` });
  if (!star.length) problems.push({ line: 0, msg: '没有 `*)` 兜底分支 —— 非法值不会被拦' });
  else if (!star.some(nonSilent)) problems.push({ line: star[0].line, msg: '`*)` 分支不报错退出（非法值会被静默处理）' });
  // 显式 libx264 ⇒ CPU
  if (!libx.some(isCpu)) problems.push({ line: 0, msg: '缺少「显式 libx264 ⇒ CPU」分支' });
  return { parsed: true, ok: problems.length === 0, problems, branches: pats.length };
}

/** 判一个 .mjs 编码器决策点；返回 { ok, problems:[{line,msg}] }。 */
function judgeMjs(text) {
  const problems = [];
  const lines = text.split('\n');
  const lineOf = (re) => { const i = lines.findIndex((l) => re.test(l)); return i < 0 ? 0 : i + 1; };
  const m = text.match(/process\.env\.LEMO_VENC\s*\|\|\s*'([^']+)'/);
  if (!m) return { parsed: false, ok: false, problems: [{ line: 0, msg: '找不到 `process.env.LEMO_VENC || …`（写法变了？）' }] };
  const def = m[1];
  if (def !== 'h264_nvenc') problems.push({ line: lineOf(/process\.env\.LEMO_VENC\s*\|\|/), msg: `未设 LEMO_VENC ⇒ '${def}'（应为 h264_nvenc，GPU 优先）` });
  const validates = /!==\s*'h264_nvenc'/.test(text) && /!==\s*'libx264'/.test(text) && /process\.exit|fail\(/.test(text);
  if (!validates) problems.push({ line: lineOf(/LEMO_VENC/), msg: '没有「非法值 ⇒ 报错退出」的校验（非法值会被静默处理）' });
  return { parsed: true, ok: problems.length === 0, problems };
}

// ── 收集 A 类决策点 ─────────────────────────────────────────────────────────
const CORE = path.join(OPUSCAR, 'core', 'render');
const aPoints = [];
const pushA = (file, kind, label) => {
  if (aPoints.some((p) => p.file === file)) return;
  aPoints.push({ file, kind, label });
};
pushA(path.join(CORE, 'video.mjs'), 'mjs', 'core 渲染（逐帧分段编码）');
pushA(path.join(CORE, 'mux.sh'), 'sh', 'core 混流（回退路径）');

const slugs = fs.existsSync(STYLES)
  ? fs.readdirSync(STYLES, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name).sort()
  : [];
for (const slug of slugs) {
  const p = pickMux(slug);
  if (p.own) pushA(p.file, 'sh', `${slug} 被挑中的混流脚本`);
}

const aRows = aPoints.map((p) => {
  if (!fs.existsSync(p.file)) return { ...p, ok: false, problems: [{ line: 0, msg: '文件不存在' }], parsed: false };
  const j = p.kind === 'sh' ? judgeShell(read(p.file)) : judgeMjs(read(p.file));
  return { ...p, ...j };
});
const aParsed = aRows.filter((r) => r.parsed).length;
const aFails = aRows.filter((r) => !r.ok);

// ── B 类：15 个手工脚本（只列 backlog）───────────────────────────────────────
const B_FILES = [
  'styles/blueprint/demo/tools/video_range.mjs',
  'styles/game-show/demo/finish.sh',
  'styles/game-show/demo/render.mjs',
  'styles/halftone-dossier/demo/render.mjs',
  'styles/hd-2d/demo/tools/render_range.mjs',
  'styles/paper-lantern/demo/render/video.mjs',
  'styles/paper-popup/demo/mux.sh',
  'styles/paper-popup/demo/render.mjs',
  'styles/pictogram-motion/demo/mux.sh',
  'styles/pictogram-motion/demo/render.mjs',
  'styles/risograph/demo/tools/video_png.mjs',
  'styles/silent-film/demo/build.sh',
  'styles/watercolor/demo/mux.sh',
  'styles/watercolor/demo/render.mjs',
  'tools/web_cuts.sh',
];
const bRows = B_FILES.map((r) => {
  const f = path.join(OPUSCAR, r);
  if (!fs.existsSync(f)) return { rel: r, status: 'missing' };
  const t = read(f);
  if (!t.includes('LEMO_VENC')) return { rel: r, status: 'hardcoded' };
  // 已支持：再顺手判一下「未设 ⇒ nvenc」是否成立（只作参考信息）
  const j = r.endsWith('.mjs') ? judgeMjs(t) : judgeShell(t);
  return { rel: r, status: j.ok ? 'supported' : 'partial' };
});
const bSupported = bRows.filter((r) => r.status === 'supported').length;
const bPartial = bRows.filter((r) => r.status === 'partial').length;
const bHard = bRows.filter((r) => r.status === 'hardcoded').length;
const bMissing = bRows.filter((r) => r.status === 'missing').length;

// ── D 类：文档/注释里的「未设/默认 ⇒ libx264」过期声称（判 FAIL）──────────────
// ★ 只做**关键词 + 上下文**判定，不做语义理解（局限见头注释 ③）。
const D_EXT = new Set(['.md', '.sh', '.mjs', '.js', '.cjs', '.py', '.html', '.htm', '.txt', '.json', '.bat', '.ps1', '.css']);
const D_NAMES = new Set(['CREDITS', 'README', 'DEMO', 'STYLE', 'PRODUCTION_LOG', 'AGENT-BRIEF', 'NOTES', 'LICENSE']);
const D_SKIP_SEG = /^(node_modules|\.git|\.venv|out|logs|ref|fonts|voices|dist|build|_superseded.*)$/;
const D_SKIP_FILE = /\.orig-|\.orig$|\.tmp$|\.log$/;
// ★ 有意不查：本闸门自身与配套 patch 脚本（天然携带旧文本：判据说明 / 替换搜索键）。
const D_SKIP_BASE = new Set(['check-render-venc.mjs', 'patch-render-venc.mjs']);
const D_QUAL = /(默认|缺省|不设|没设|未设|unset|default)/i;
const D_EXPL = /(显式|指定|explicit|才走|才用|回退|回落|fallback|硬写|硬编码|写死|违反|违规|判\s*FAIL|FAIL|此前|原来|原先|曾经|历史上|used to|previously|legacy|已弃用|不再|断言|闸门|守卫)/i;
const D_CTX = /(LEMO_VENC|编码|encoder|venc|nvenc|ffmpeg|mux|转码|transcod)/i;

// ★ D 类「相邻性」(e) 辅助（2026-10-06 修假红）—— 详见头注释 ② (e) / ③。
//   连接词白名单：允许垫在「限定词」与 `libx264` 之间的**连接性**文字（长词在前，避免半截匹配）。
const D_CONN = [
  'LEMO_VENC', '情况下', '编码器', '情况', '选项', '选择', '指定', '采用', '使用', '编码',
  'encoder', 'codec', 'means', 'uses', 'used', 'use', 'is', 'are', 'be', 'by', 'the', 'to', 'of', 'in', 'as', 'for', 'that', 'which', 'an', 'a',
  '走', '选', '是', '为', '的', '时', '值', '器', '用',
];
// gap 里允许出现的「非文字」字符（空白 + 标点/符号）。★ 故意**不含**表格竖线 `|`/`｜`。
const D_GAP_PUNCT = /[\s\u3000：:＝=~～\-—–>＞⇒→/\\*()（）\[\]【】「」『』《》〈〉“”"'‘’`·、．.]+/g;
// 限定词右侧若以这些字符开头，视为「已到边界 / 后接标点」。
const D_TAIL_PUNCT = /^[\s\u3000：:＝=~～\-—–>＞⇒→/\\*()（）\[\]【】「」『』《》〈〉“”"'‘’`·、．.]/;

/** 去掉「空白 + 标点 + 连接词」后为空 ⇒ 该 gap 只含连接性文字（不是实义内容）。 */
function dGapConnective(gap) {
  let s = gap.replace(D_GAP_PUNCT, '');
  for (let pass = 0; pass < 6; pass++) {
    const before = s;
    for (const w of D_CONN) s = s.split(w).join('');
    if (s === before) break;
  }
  return s.length === 0;
}

/** 限定词右侧是否「紧接边界 / 标点 / 连接词」（用于限定词落在 `libx264` 之后的情形）。 */
function dTailOk(rest) {
  const t = rest.replace(/^\s+/, '');
  if (t === '') return true;
  if (D_TAIL_PUNCT.test(t)) return true;
  return D_CONN.some((w) => t.startsWith(w));
}

/** (e) 相邻性：小句 `c` 内是否存在一对「限定词 ↔ `libx264`」彼此直接修饰。 */
function dQualModifiesX264(c) {
  const xs = [...c.matchAll(/libx264/gi)].map((m) => ({ i: m.index, n: m[0].length }));
  const qs = [...c.matchAll(/(默认|缺省|不设|没设|未设|unset|default)/gi)].map((m) => ({ i: m.index, n: m[0].length }));
  for (const q of qs) {
    for (const x of xs) {
      if (q.i + q.n <= x.i) {                 // 限定词在 libx264 之前：中间只能是连接性文字
        if (dGapConnective(c.slice(q.i + q.n, x.i))) return true;
      } else if (x.i + x.n <= q.i) {          // 限定词在 libx264 之后：中间连接性 + 右侧是边界/标点/连接词
        if (dGapConnective(c.slice(x.i + x.n, q.i)) && dTailOk(c.slice(q.i + q.n))) return true;
      }
    }
  }
  return false;
}

function scanD(root, tag) {
  const hits = [];
  const stack = [root];
  let files = 0;
  while (stack.length) {
    const d = stack.pop();
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (D_SKIP_SEG.test(e.name)) continue;
        stack.push(p);
      } else if (e.isFile()) {
        if (D_SKIP_FILE.test(e.name) || D_SKIP_BASE.has(e.name)) continue;
        const ext = path.extname(e.name).toLowerCase();
        if (!D_EXT.has(ext) && !D_NAMES.has(e.name)) continue;
        let text;
        try { text = read(p); } catch { continue; }
        files++;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!/libx264/.test(line) || !D_CTX.test(line)) continue;
          for (const c of line.split(/[；;。，,]/)) {
            if (!/libx264/.test(c) || !D_QUAL.test(c) || D_EXPL.test(c) || /h264_nvenc/i.test(c)) continue;
            // ★ (e) 相邻性：限定词必须**直接修饰** libx264（详见头注释 ②(e)）——
            //   挡掉「限定词其实在修饰别的词」的假红（如表格里 `默认` 修饰「默认安装」）。
            if (!dQualModifiesX264(c)) continue;
            hits.push({ repo: tag, file: path.relative(root, p).replace(/\\/g, '/'), line: i + 1, text: line.trim().slice(0, 200) });
            break;
          }
        }
      }
    }
  }
  return { hits, files };
}

const dWin = scanD(OPUSCAR, 'opuscar');
const dTools = scanD(path.resolve(HERE, '..'), 'lemo-tools');
const dHits = [...dWin.hits, ...dTools.hits];
const dFiles = dWin.files + dTools.files;
// ★ 失明判据**按仓库**：任一仓库扫到 0 个文件即失明 —— 否则 lemo-tools 恒非空会把守卫架空。
const dBlindRoots = [dWin.files === 0 ? 'opuscar' : null, dTools.files === 0 ? 'lemo-tools' : null].filter(Boolean);
const dBlind = dBlindRoots.length > 0;

// ── C. 两份副本一致性（比 md5）──────────────────────────────────────────────
const dual = { checked: false, files: 0, mismatches: [] };
const isCanon = path.resolve(OPUSCAR) === CANON_WIN;
if (isCanon && !NO_WSL) {
  const files = [...aRows.map((r) => rel(r.file)), ...bRows.filter((r) => r.status !== 'missing').map((r) => r.rel)];
  const uniq = [...new Set(files)];
  const winMd5 = {};
  for (const f of uniq) { const p = path.join(OPUSCAR, f); if (fs.existsSync(p)) winMd5[f] = md5(p); }
  const cmd = `cd ${WSL_ROOT} && md5sum ${uniq.map((f) => `'${f}'`).join(' ')}`;
  const r = await sh('wsl.exe', ['-d', DISTRO, '-e', 'bash', '-lc', cmd]);
  const out = String(r.o || '');
  const wslMd5 = {};
  for (const line of out.split('\n')) {
    const m = line.match(/^([0-9a-f]{32})\s+(.+)$/);
    if (m) wslMd5[m[2].trim()] = m[1];
  }
  dual.checked = true;
  dual.files = uniq.length;
  for (const f of uniq) {
    const w = winMd5[f], l = wslMd5[f];
    if (!w) { dual.mismatches.push({ rel: f, why: 'WIN 侧缺失' }); continue; }
    if (!l) { dual.mismatches.push({ rel: f, why: 'WSL 侧缺失（或 md5sum 读不到）' }); continue; }
    if (w !== l) dual.mismatches.push({ rel: f, why: `md5 不一致 WIN=${w} WSL=${l}` });
  }
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
const blind = aParsed === 0;
const ok = !blind && !dBlind && aFails.length === 0 && dHits.length === 0 && dual.mismatches.length === 0;

if (JSON_OUT) {
  console.log(JSON.stringify({
    opuscar: OPUSCAR,
    aClass: { points: aPoints.length, parsed: aParsed, fails: aFails.map((r) => ({ file: rel(r.file), label: r.label, problems: r.problems })) },
    bClass: { total: bRows.length, supported: bSupported, partial: bPartial, hardcoded: bHard, missing: bMissing, rows: bRows },
    dClass: { files: dFiles, filesByRepo: { opuscar: dWin.files, 'lemo-tools': dTools.files }, blind: dBlind, blindRoots: dBlindRoots, hits: dHits },
    dual,
    blind,
    ok,
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
  process.exit();
}

console.log(`仓库：${OPUSCAR}`);
console.log(`A 类·出片路径编码器决策点 ${aPoints.length} 个（成功解析 ${aParsed} 个）`);
for (const r of aRows) {
  const tag = r.ok ? '✓' : '✘';
  console.log(`  ${tag} ${rel(r.file)}   [${r.label}]`);
  for (const pr of r.problems) console.log(`      ✘ L${pr.line}：${pr.msg}`);
}
if (blind) {
  console.log('\n✘✘ 本闸门已**失明**：解析出的编码器决策点为 0 —— 路径或写法变了，');
  console.log('    「0 处违规」是假的。请先修路径/写法，再信本闸门的结论。');
}
if (aFails.length) {
  console.log(`\n✘ A 类有 ${aFails.length} 个决策点未满足「未设⇒GPU / 非法⇒非静默 / libx264⇒CPU」：`);
  for (const r of aFails) console.log(`  ✘ ${rel(r.file)}`);
  console.log('\n修法：`node scripts/patch-render-venc.mjs`（幂等、双副本、带 sh -n / node --check 自检）。');
}

console.log(`\nℹ B 类·手工脚本（不在出片路径，仅参考，不判 FAIL）${bRows.length} 个：`);
console.log(`   已支持 LEMO_VENC 且未设⇒GPU ${bSupported}；已含 LEMO_VENC 但口径不全 ${bPartial}；仍硬写 libx264 ${bHard}${bMissing ? `；缺失 ${bMissing}` : ''}`);
for (const r of bRows) if (r.status !== 'supported') console.log(`   · [${r.status}] ${r.rel}`);

console.log(`\nℹ D 类·文档/注释「未设/默认 ⇒ libx264」过期声称（扫 ${dFiles} 个文件：opuscar ${dWin.files} + lemo-tools ${dTools.files}）`);
if (dBlind) {
  console.log(`  ✘✘ D 类已**失明**：仓库 [${dBlindRoots.join(', ')}] 扫到的文件数为 0 —— 路径或扩展名过滤变了，「0 处过期声称」是假的。`);
} else if (dHits.length) {
  console.log(`  ✘ ${dHits.length} 处过期声称（应改成「未设 ⇒ h264_nvenc（GPU 优先）；显式 libx264 才走 CPU」）：`);
  for (const h of dHits) console.log(`     ✘ [${h.repo}] ${h.file}:${h.line}  ${h.text}`);
} else {
  console.log('  ✓ 未发现「未设/默认 ⇒ libx264」的过期声称');
}

console.log(`\nℹ C 类·两份副本一致性：${dual.checked ? `已比 ${dual.files} 个文件` : '跳过（非规范路径或 --no-wsl）'}`);
if (dual.mismatches.length) {
  console.log(`  ✘ ${dual.mismatches.length} 处不一致：`);
  for (const m of dual.mismatches) console.log(`     ✘ ${m.rel}：${m.why}`);
} else if (dual.checked) {
  console.log('  ✓ 两侧逐字节一致');
}

console.log(`\n[闸门] 渲染编码器 GPU 优先：A 类违规 ${aFails.length} 个、D 类过期声称 ${dHits.length} 处、双副本不一致 ${dual.mismatches.length} 处${blind ? '、**A 类已失明**' : ''}${dBlind ? '、**D 类已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exitCode = ok ? 0 : 1;
