#!/usr/bin/env node
/**
 * scripts/check-film-aspect.mjs —— 「成片画幅」闸门（声明支持 vs 实际画幅 + 全库一致性）
 *
 * ★ ① 由来（2026-10-04 立）：
 *   今天重渲 10 个风格样板片，结果它们**从 1920×1080 变成了 1080×1920**。根因：
 *   `scripts/style-distill.mjs` 构造渲染命令时**没传 `--ratio`** ⇒ 落到编排器 `lemo-make.mjs`
 *   的**产品默认 9:16**（那是给「交付」用的，不等于风格样板片该用 9:16）。
 *   ★ 更关键：这 10 个风格里**只有 `engraving` 声明了 `FILM_META.aspects`**，其余 9 个**没有任何声明**；
 *   而本库语义是「**`FILM_META.aspects` 不写 = 只支持 16:9**」（见
 *   `styles/engraving/demo/film.js:35-43` 的注释 + `lib/aspects.mjs:14-15,29-31`）
 *   ⇒ 那 9 部被渲成了**该风格并不支持**的画幅（画面按 9:16 排不出来）。
 *   **当时的 21 个闸门全绿，没有一个能发现这件事** —— 本闸门把它做成机器守卫。
 *
 * ★ ② 判据（机械可解释，两类**都判 FAIL**）：
 *   A. **成片画幅必须被该风格声明支持**：
 *      对每个风格，取其**默认影片模块** `styles/<slug>/demo/film.js`（默认名 `film` 的判据见 ③ 证据），
 *      从源码文本里解析 `FILM_META.aspects`（复用库侧 `lib/aspects.mjs` 的 `parseAspects`，**读文本不 import**）；
 *      · **没有** `aspects` 声明 ⇒ 该风格**只支持 16:9**（本库语义）；
 *      · 从成片 json（`<distillRoot>/<slug>/_distill.json` 的 `generatedVideo.width/height`）
 *        算出实际比例（相对容差 2%，同 `lib/aspects.mjs` 的 `ASPECT_TOL`）；
 *      · **实际比例 ∉ 声明支持集合 ⇒ FAIL**，报出 slug + 实际画幅 + 声明了哪些。
 *   B. **样板片画幅应一致**：全库 43 部**应当同画幅**（原生 1920×1080）。
 *      · 取**众数画幅**为「基准」；**非基准的**列为「少数派」⇒ **FAIL**（这是今天那次回归的直接信号）。
 *      · ★ 若「一致地」全是 9:16（且每个风格都声明支持 9:16）就**不算违规** —— 判据是**一致性**，
 *        不是硬编码 16:9。
 *
 * ★ ③ 已知局限 / 会误报的边界：
 *   · **只读**：不跑渲染、不加载模型、不改任何风格源码 / 成片 json。只读源码文本与 json。
 *   · 「默认影片模块 = `film.js`」的判据（证据）：
 *       - `styles/engraving/demo/main.js:9` → `const mod = await import('./' + (q.get('film') || 'film') + '.js');`
 *       - `lemo-make.mjs:784` → 注释「默认 film.js = 仓库自带示例片」；`lemo-make.mjs:1334` → `const filmName = o.film || 'film';`
 *       - ⇒ 不传 `--film` 时页面加载的就是 `demo/film.js`。
 *     局限：只有 `engraving` 的 `main.js` 真的写了 `q.get('film')`；其余风格**根本没有 `film.js`**
 *     （它们不走影片模块约定）—— 对这些风格本闸门按「无 `film.js` ⇒ 无 `aspects` ⇒ 只支持 16:9」判，
 *     与 `lib/aspects.mjs:101-107`「文件不存在 = 只支持 16:9」的语义一致。
 *   · **不做语义理解**：`aspects` 靠正则读文本（`parseAspects`），写得不合法/藏在注释里都可能漏（假阴）。
 *   · **只判「声明 vs 实际」**：不判画面构图是否真的排得出来（那要人眼看成片）。
 *   · 比例注册表从库侧 `core/render/size.mjs` 读（经 `lib/sizes.mjs`）；**读不到库** ⇒ 比例 id 过滤会退化
 *     ⇒ 本闸门**判失明**（否则 `16:9` 会被误判成「未声明支持」）。
 *   · **防空转失明**：读到的风格数（有 `_distill.json` 的目录数）为 0、或风格源码根不存在、或库比例注册表
 *     读不到 ⇒ **判 FAIL 并明说失明**（不许静默 OK）。
 *   · 路径**基于脚本自身位置推导**，**允许覆盖**（供变异测试指向临时目录副本，绝不动真实文件）：
 *       `LEMO_DISTILL_ROOT`（默认 `<脚本>/../lib/style-skills`）、
 *       `LEMO_STYLES_ROOT`（默认 `D:/lemo-opuscar/styles`，可被 `LEMO_OPUSCAR` 推导）。
 *
 * ★ ⑤ 补强（2026-10-05 立）：**「样板片被覆盖」的盲区** ——
 *   本闸门此前**只读 `_distill.json` 的 `generatedVideo`（声明值）**，**从不读实际成片文件**。
 *   ⇒ 「声明说 1920×1080、实际文件是 1080×1920」这种损坏**本闸门看不见**。
 *   真实事故：`D:/lemo-films/art-deco/art-deco.mp4`（**样板片**）被环境里另一个**不带 `--out` 的
 *   并发 `lemo-make`** 覆盖成 **1080×1920（9:16）**，而本闸门当时**全绿**（只读 json，json 没被改）。
 *
 *   ★★ 核实（**不重复造判据**，如实说明既有覆盖）：
 *     `check-film-delivery.mjs:155-168` **确实读实际文件**（`ffprobe`），并把 `generatedVideo.width/height`
 *     与**实测值**比对 ⇒ 「**json 未被改写**」的场景它**已能抓到**（实测 art-deco 报
 *     `C width 不符 文档 1920 vs 实测 1080` + `C height 不符 文档 1080 vs 实测 1920`）。
 *     但那条判据的语义是「**文档 == 实测**」的**自洽**判据，留着一个真空：
 *     `refresh-style-skill.mjs:165-166` 会把**实际文件的 width/height 回填进 json**
 *     ⇒ 一旦 json 被刷新，文档 == 实测 ⇒ delivery 放行；而本闸门 A 类（实测 43 个风格**全都声明了
 *     `9:16`**）与 B 类（若**一致地**全变 9:16）**也放行** ⇒ **两个闸门同时失明**。
 *     外加 delivery 是**很晚、很贵**的闸门（43 部 × loudnorm + ebur128，实测 ~2 分钟）。
 *     ⇒ 故在本闸门（**成片画幅的家**、秒级）补一条**绝对**判据（**不是**重复 delivery 的自洽判据）。
 *
 * ★ ⑥ C 类判据（2026-10-05 补）：**样板片原生画幅**
 *   对每个风格，用 `ffprobe` 读**实际成片文件**的分辨率，要求**恰为 1920×1080**。
 *   依据：本项目约定**样板片一律 16:9**（`scripts/style-distill.mjs:189` 显式 `--ratio 16:9`），
 *   16:9 的原生像素即 1920×1080 ⇒ **实际文件不是 1920×1080 ⇒ FAIL**，
 *   报出 **slug + 实际值 + 期望值 + 文件 mtime**。
 *   · 文件路径：取 `_distill.json` 的 `generatedVideo.path` **相对默认根**（`D:/lemo-films`）的相对段，
 *     再挂到**可覆盖**的 `LEMO_FILMS_ROOT` 下（供变异测试指向临时树）；不在默认根下则退化为 `<slug>/<slug>.mp4`。
 *   · ★ **文件缺失 ⇒ 单列「缺失」，不判 FAIL**（有些风格可能没出过片）。
 *   · ★ **失明守卫**：`LEMO_FILMS_ROOT` 不存在 / 枚举到 **0 部**成片 / `ffprobe` 不存在
 *     ⇒ **FAIL 并明说「本闸门已失明」**（不许静默放过）。
 *   · 性能：43 次 `ffprobe`（每次 ~0.1s）—— 可接受。
 *
 * ★ ④ 退出码：A 类有违规、B 类有少数派、C 类有样板片画幅被改、或本闸门失明 ⇒ 1；否则 0。
 *
 * 用法：node scripts/check-film-aspect.mjs [--json]
 * 环境变量：`LEMO_FILMS_ROOT`（实际成片文件根，默认 `D:/lemo-films`）—— 供 C 类做**非破坏性**变异验证。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// ── 复用库侧唯一实现（比例探测 / 匹配 / 容差），不另抄一份 ──────────────────────
import {
  parseAspects, matchesAspect, DEFAULT_ASPECTS, ASPECT_TOL,
} from '../lib/aspects.mjs';
import { sizesRegistryError, sizeSource } from '../lib/sizes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DISTILL_ROOT = path.resolve(
  process.env.LEMO_DISTILL_ROOT || path.join(HERE, '..', 'lib', 'style-skills'));
const OPUSCAR = path.resolve(
  process.env.LEMO_OPUSCAR || path.join(HERE, '..', '..', 'lemo-opuscar'));
const STYLES_ROOT = path.resolve(
  process.env.LEMO_STYLES_ROOT || path.join(OPUSCAR, 'styles'));
const AS_JSON = process.argv.includes('--json');

// ── ★ C 类（2026-10-05 补）：实际成片文件的根 ────────────────────────────────
// 可覆盖（`LEMO_FILMS_ROOT`）—— 变异测试把数据源整体指向一棵**临时拷贝**，**绝不动真实成片**（见头注释 ⑥）。
const DEFAULT_FILMS_ROOT = 'D:/lemo-films';
const FILMS_ROOT = path.resolve(process.env.LEMO_FILMS_ROOT || DEFAULT_FILMS_ROOT);
/** 样板片原生像素：16:9 的原生尺寸（`scripts/style-distill.mjs:189` 的 `--ratio 16:9`）。 */
const NATIVE_W = 1920, NATIVE_H = 1080;
/** ffprobe（与 `check-film-delivery.mjs:60` 同一套路径约定）。 */
const FFPROBE = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffprobe.exe';

/** 默认影片模块名（判据见头注释 ③：`q.get('film') || 'film'`）。 */
const DEFAULT_FILM = 'film';

const read = (p) => fs.readFileSync(p, 'utf8');

/** 跑一个子进程收 stdout/stderr（`spawn` —— 不用 `spawnSync`/`execFileSync`）。 */
const run = (bin, args) =>
  new Promise((res) => {
    const p = spawn(bin, args);
    let o = '', e = '';
    p.stdout.on('data', (d) => (o += d));
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res({ c: -1, o, e: String(err.message) }));
    p.on('close', (c) => res({ c, o, e }));
  });

/**
 * 实际成片文件路径：以 `_distill.json` 的 `generatedVideo.path` 为准（相对默认根取相对段），
 * 再挂到**可覆盖**的 `FILMS_ROOT` 下 —— 这样变异测试能整体重定向，且默认行为与 delivery 一致。
 */
function filmFilePath(slug, jsonPath) {
  if (jsonPath && typeof jsonPath === 'string') {
    const rel = path.relative(DEFAULT_FILMS_ROOT, jsonPath);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return path.join(FILMS_ROOT, rel);
  }
  return path.join(FILMS_ROOT, slug, `${slug}.mp4`);
}

// ── 失明判据（防空转）────────────────────────────────────────────────────────
const blindReasons = [];
if (sizesRegistryError) blindReasons.push(`库比例注册表读不到（${sizeSource}）：${sizesRegistryError}`);
if (!fs.existsSync(STYLES_ROOT)) blindReasons.push(`风格源码根不存在：${STYLES_ROOT}`);
if (!fs.existsSync(DISTILL_ROOT)) blindReasons.push(`成片 json 根不存在：${DISTILL_ROOT}`);
// ★ C 类失明守卫（2026-10-05 补）：文件根不存在 / ffprobe 不存在 ⇒ 一部实际成片都读不到 ⇒ 必须明说失明。
if (!fs.existsSync(FILMS_ROOT)) blindReasons.push(`实际成片文件根不存在：${FILMS_ROOT}`);
if (!fs.existsSync(FFPROBE)) blindReasons.push(`ffprobe 不存在：${FFPROBE}`);

// ── 枚举成片 json（有 _distill.json 的风格）──────────────────────────────────
let slugs = [];
if (fs.existsSync(DISTILL_ROOT)) {
  slugs = fs.readdirSync(DISTILL_ROOT)
    .filter((s) => fs.existsSync(path.join(DISTILL_ROOT, s, '_distill.json')))
    .sort();
}
if (slugs.length === 0) blindReasons.push(`成片 json 扫到 0 个（${DISTILL_ROOT}）：路径/过滤变了？`);

// ── 逐风格：声明能力 vs 实际画幅 ─────────────────────────────────────────────
const rows = [];
const fails = [];
const bad = (slug, kind, msg) => fails.push({ slug, kind, msg });

for (const slug of slugs) {
  const filmFile = path.join(STYLES_ROOT, slug, 'demo', `${DEFAULT_FILM}.js`);
  let declared = null, filmExists = false;
  if (fs.existsSync(filmFile)) {
    filmExists = true;
    try { declared = parseAspects(read(filmFile)); } catch { declared = null; }
  }
  const supported = declared || DEFAULT_ASPECTS.slice();   // 未声明 ⇒ 只支持 16:9

  let w = null, h = null, actual = null, jsonPath = null;
  try {
    const g = JSON.parse(read(path.join(DISTILL_ROOT, slug, '_distill.json'))).generatedVideo || {};
    jsonPath = typeof g.path === 'string' ? g.path : null;
    w = Number(g.width); h = Number(g.height);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) actual = `${w}x${h}`;
  } catch { /* 下面按「画幅未知」处理 */ }

  const row = { slug, film: `demo/${DEFAULT_FILM}.js`, filmExists, declared, supported, w, h, actual, jsonPath };
  rows.push(row);

  if (actual === null) {
    bad(slug, 'A 画幅未知', `_distill.json 的 generatedVideo.width/height 缺失或非法（w=${w} h=${h}）`);
    continue;
  }
  const fits = supported.some((id) => matchesAspect(w, h, id));
  if (!fits) {
    const decl = declared
      ? `声明支持 [${declared.join(', ')}]`
      : `未声明 aspects = 只支持 16:9`;
    bad(slug, 'A 画幅不被声明支持',
      `实际 ${actual}（${(w / h).toFixed(4)}）不在 ${decl} 里`);
  }
}

// ── B 类：全库画幅一致性（众数为基准，非基准 = 少数派）───────────────────────
const groups = new Map();   // "WxH" -> [slug...]
for (const r of rows) {
  if (r.actual === null) continue;
  if (!groups.has(r.actual)) groups.set(r.actual, []);
  groups.get(r.actual).push(r.slug);
}
let base = null;
if (groups.size) {
  const sorted = [...groups.entries()].sort((a, b) => (b[1].length - a[1].length) || a[0].localeCompare(b[0]));
  base = sorted[0][0];
  const tie = sorted.length > 1 && sorted[1][1].length === sorted[0][1].length;
  for (const [k, list] of sorted) {
    if (k === base) continue;
    bad(list.join(' '), 'B 画幅不一致（少数派）',
      `${list.length} 部是 ${k}，基准（众数）是 ${base}${tie ? '（★ 众数并列，基准为并列中字典序最小者，请人工确认）' : ''}`);
  }
}

// ── ★ C 类：**实际成片文件**的原生画幅（2026-10-05 补）────────────────────────
// 由来与「不重复造判据」的核实见头注释 ⑤；判据形式见 ⑥。
// A/B 读的是 `_distill.json` 的**声明值** ⇒ 「声明 1920×1080、实际文件 1080×1920」看不见。
// 这里用 ffprobe 读**实际文件**，要求**恰为 1920×1080**（样板片一律 16:9）。
const filmRows = [];
for (const r of rows) {
  const file = filmFilePath(r.slug, r.jsonPath);
  let st = null;
  try { st = fs.statSync(file); } catch { /* 缺失 —— 下面单列，不判 FAIL */ }
  const rec = { slug: r.slug, file, exists: !!st, mtime: st ? st.mtime.toISOString() : null, w: null, h: null };
  if (st) {
    const { o } = await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'json', file]);
    try {
      const s = (JSON.parse(o).streams || [])[0] || {};
      rec.w = Number(s.width) || null;
      rec.h = Number(s.height) || null;
    } catch { /* 下面按「读不出画幅」处理 */ }
  }
  filmRows.push(rec);
  if (!rec.exists) continue;                                  // ★ 缺失 ⇒ 单列，不判 FAIL
  if (rec.w === null || rec.h === null) {
    bad(r.slug, 'C 成片文件读不出画幅', `${file}：ffprobe 无 width/height`);
    continue;
  }
  if (!(rec.w === NATIVE_W && rec.h === NATIVE_H)) {
    const is169 = matchesAspect(rec.w, rec.h, '16:9');
    bad(r.slug, 'C 样板片画幅被改',
      `实际文件 ${rec.w}x${rec.h}（期望 ${NATIVE_W}x${NATIVE_H}${is169 ? '；仍是 16:9 但像素非原生' : ''}）`
      + ` · 文件 ${file} · mtime ${rec.mtime}`);
  }
}
const filmsFound = filmRows.filter((r) => r.exists).length;
const filmsMissing = filmRows.filter((r) => !r.exists);
/** 缺失列表只列前几个（43 个全列会把输出淹没）。 */
const missBrief = (n = 6) => filmsMissing.slice(0, n).map((r) => r.slug).join(' ')
  + (filmsMissing.length > n ? ` …（共 ${filmsMissing.length} 部）` : '');
// ★ 失明守卫：枚举到 0 部实际成片 ⇒ 「全部一致」的结论是假的 ⇒ FAIL（不许静默放过）。
if (filmsFound === 0)
  blindReasons.push(`实际成片扫到 0 部（${FILMS_ROOT}）：路径/枚举变了？本闸门的 C 类判据已失明`);

// ── 汇总 ────────────────────────────────────────────────────────────────────
const blind = blindReasons.length > 0;
const ok = !blind && fails.length === 0;
const declaredCount = rows.filter((r) => r.declared).length;

if (AS_JSON) {
  console.log(JSON.stringify({
    stylesRoot: STYLES_ROOT,
    distillRoot: DISTILL_ROOT,
    defaultFilm: DEFAULT_FILM,
    aspectTol: ASPECT_TOL,
    counts: {
      slugs: slugs.length,
      withFilmJs: rows.filter((r) => r.filmExists).length,
      declaredAspects: declaredCount,
      unknown: rows.filter((r) => r.actual === null).length,
      groups: Object.fromEntries([...groups.entries()].map(([k, v]) => [k, v.length])),
      filmsFound,
      filmsMissing: filmsMissing.map((r) => r.slug),
    },
    base,
    native: `${NATIVE_W}x${NATIVE_H}`,
    filmsRoot: FILMS_ROOT,
    fails,
    rows,
    filmRows,
    blind,
    blindReasons,
    ok,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

// ── 文本输出 ────────────────────────────────────────────────────────────────
console.log('成片画幅闸门 —— 声明支持 vs 实际画幅 + 全库一致性 + 样板片实际文件画幅');
console.log(`  风格源码: ${STYLES_ROOT}`);
console.log(`  成片 json: ${DISTILL_ROOT}`);
console.log(`  实际成片文件: ${FILMS_ROOT}`);
console.log(`  默认影片模块: demo/${DEFAULT_FILM}.js（q.get('film') || 'film'）· 容差 ${(ASPECT_TOL * 100).toFixed(0)}%`);
console.log(`  成片 ${slugs.length} 部：有 film.js ${rows.filter((r) => r.filmExists).length} 部、`
  + `声明 aspects ${declaredCount} 部；画幅分布 ${[...groups.entries()].map(([k, v]) => `${k}×${v.length}`).join(' / ') || '（无）'}`);
console.log(`  ★ C 类（实际文件）：读到 ${filmsFound} 部实际成片`
  + `${filmsMissing.length ? `、缺失 ${filmsMissing.length} 部（不判 FAIL）：${missBrief()}` : ''}`
  + `；要求恰为 ${NATIVE_W}×${NATIVE_H}\n`);

if (fails.length) {
  console.log(`✘ 发现 ${fails.length} 处画幅违规：\n`);
  for (const f of fails) console.log(`  ${String(f.slug).padEnd(24)} [${f.kind}] ${f.msg}`);
} else {
  console.log(`✓ 全部成片画幅一致（${base}），每个风格的画幅都被其声明支持`
    + (filmsFound ? `，且 ${filmsFound} 部实际成片文件均为 ${NATIVE_W}×${NATIVE_H}` : ''));
}

if (blind) {
  console.log('\n✘✘ 本闸门已**失明**，结论不可信：');
  for (const r of blindReasons) console.log(`   ✘ ${r}`);
}

console.log(`\n[闸门] 成片画幅：成片 ${slugs.length} 部、实际文件 ${filmsFound} 部、画幅违规 ${fails.length} 处、`
  + `基准画幅 ${base || '—'}${blind ? '、**已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exit(ok ? 0 : 1);
