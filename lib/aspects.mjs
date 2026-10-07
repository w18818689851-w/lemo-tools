// lib/aspects.mjs —— 「影片构图能力」的**只读文本探测**（控制台侧）
//
// ★ 它解决什么问题（防呆）：
//   影片的画布布局是**逐风格**改造的。改造过的影片从视口（opts.W/opts.H）重排版面，竖屏是真的竖版
//   构图；**没改造过**的影片按 1920×1080 的绝对像素画，给别的尺寸会被**裁切**（不是重排、也不是留黑边）。
//   编排器现在**默认 9:16**，所以「用户在没改造的风格上出片 → 静默拿到一张被裁的片子」是真实风险。
//   这个模块让控制台在**出片之前**就知道某个风格的影片支持哪些比例，从而给出明确警告。
//
// ★ 为什么是**读源码文本**而不是 import：
//   影片模块（styles/<slug>/demo/film*.js）是**浏览器 ESM** —— 顶层 `await fetch`、用 canvas / DOMMatrix、
//   从 `/core/lib.js` 这种根绝对路径 import。node 里 import 它要么直接抛，要么留下半个模块。
//   所以这里只把源码当**文本**读，在 `FILM_META` 附近找 `aspects` 声明。★ 这是**文本探测**，不是求值。
//
// ★ 探测不到（文件不存在 / 没写 aspects / 写得不合法）时的语义：**只支持 16:9**
//   —— 也就是「这部影片没改造过，按 1920×1080 构图」。**绝不抛错、绝不阻断**出片。
//
// ★ 与 lib/langs.mjs / lib/sizes.mjs 同一条纪律：**只读** —— 本模块不往库里写任何东西。
//
// ★ 比例清单与像素换算的唯一来源仍是库侧 core/render/size.mjs（经 lib/sizes.mjs 代理），本模块不另抄一份。

import fs from 'node:fs';
import path from 'node:path';

import { CFG } from './env.mjs';
import { RATIOS, DEFAULT_RATIO, isRatioId, resolveSize, formatSize } from './sizes.mjs';

// ★ 覆盖点（供非破坏变异验证 / 反向测试）：`LEMO_STYLES_ROOT` 覆盖风格源码根。
//   不设时**逐字节等价于原实现** `path.join(CFG.winLib, 'styles')`（缺省走同一表达式，见下）。
//   设了就 `path.resolve` 它 —— 于是 `styleAspects()` 的**事实源**也可被指向假树，闸门可反向测试。
export const STYLES_DIR = process.env.LEMO_STYLES_ROOT
  ? path.resolve(process.env.LEMO_STYLES_ROOT)
  : path.join(CFG.winLib, 'styles');

/** 没声明 aspects 时的语义：这部影片只支持 16:9（= 没改造过）。 */
export const NATIVE_ASPECT = '16:9';
export const DEFAULT_ASPECTS = [NATIVE_ASPECT];

/** 探测方式，如实标注给调用方 / UI：读源码文本，不是 import 求值。 */
export const PROBE_KIND = 'text';

/** 比例比较的容差（相对值）。预设比例换算出来的像素是精确的，给 2% 是留给自定义尺寸的余量。 */
export const ASPECT_TOL = 0.02;

// FILM_META 之后多大一段里找 aspects 声明（够长到跨行，又不至于把整个文件都算进去）。
const META_WINDOW = 4000;

/**
 * 从影片模块源码里读出 `FILM_META` 的 `aspects` 声明。
 * @param {string} src 影片模块的源码文本
 * @returns {string[]|null} 去重后的比例 id 数组；没声明 / 写得不合法 → null（调用方按「只支持 16:9」处理）
 */
export function parseAspects(src) {
  const s = String(src || '');
  // 注释里也可能提到 FILM_META / aspects（本库的影片模块注释很密），所以对**每一处** FILM_META
  // 都往后扫一段，取**第一处能解析出合法比例 id** 的声明。这样注释里写个空例子不会把探测带偏。
  const at = [];
  for (let i = s.indexOf('FILM_META'); i >= 0; i = s.indexOf('FILM_META', i + 1)) at.push(i);
  if (!at.length) return null;
  for (const i of at) {
    const win = s.slice(i, i + META_WINDOW);
    const re = /aspects\s*:\s*\[([^\]]*)\]/g;
    for (let m = re.exec(win); m; m = re.exec(win)) {
      const ids = [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1].trim());
      const ok = [...new Set(ids)].filter((id) => isRatioId(id));
      if (ok.length) return ok;
    }
  }
  return null;
}

/** demo 目录下的影片模块名（`film*.js` → 去扩展名），`film` 排最前（它是页面默认选的那个）。 */
export function demoFilmModules(demoDir) {
  let names = [];
  try {
    names = fs.readdirSync(demoDir)
      .filter((n) => /^film[A-Za-z0-9_-]*\.js$/.test(n))
      .map((n) => n.slice(0, -'.js'.length));
  } catch { return []; }
  names.sort((a, b) => (a === 'film' ? -1 : b === 'film' ? 1 : a.localeCompare(b)));
  return names;
}

/** 从一串 CLI 选项里读出 `--film <name>`（没有 / 形状不对 → null = 页面默认的 `film`）。 */
export function filmFromOpts(opts) {
  if (!Array.isArray(opts)) return null;
  const i = opts.indexOf('--film');
  const v = i >= 0 ? opts[i + 1] : null;
  return (typeof v === 'string' && v.trim() && !v.startsWith('--')) ? v.trim() : null;
}

/**
 * 探测**一个**影片模块。
 * @param {string} demoDir styles/<slug>/demo
 * @param {string} [film] 模块名（不带 .js）；缺省 'film'
 * @returns {{film:string, file:string, exists:boolean, declared:boolean, aspects:string[], error:string|null}}
 */
export function filmModuleAspects(demoDir, film = 'film') {
  const name = String(film == null ? '' : film).trim().replace(/\.js$/i, '') || 'film';
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    return { film: name, file: null, exists: false, declared: false, aspects: DEFAULT_ASPECTS.slice(), error: `影片模块名非法：${JSON.stringify(film)}` };
  }
  const file = path.join(demoDir, `${name}.js`);
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch (e) {
    // 文件不存在**不是错误**：按「没声明 = 只支持 16:9」处理（其它读失败才记 error，但同样不抛）。
    return {
      film: name, file, exists: false, declared: false, aspects: DEFAULT_ASPECTS.slice(),
      error: e.code === 'ENOENT' ? null : `${file}：${e.message}`,
    };
  }
  const declared = parseAspects(src);
  return { film: name, file, exists: true, declared: !!declared, aspects: declared || DEFAULT_ASPECTS.slice(), error: null };
}

/**
 * 探测一个风格（或它指定的某一部影片）支持哪些比例。
 *
 * @param {string} slug 风格 slug（styles/<slug>/demo）
 * @param {{film?:string|null}} [opts] 给了 film 就只探这一部（**精确**）；不给就取该 demo 下所有
 *        `film*.js` 的**并集**（**乐观**：只说明「这个风格有改造过的影片」，不保证你选的那一部也改造过）
 * @returns {{
 *   slug:string, demoDir:string, mode:'film'|'style', probe:string, default:string[],
 *   supported:string[], declared:boolean, films:object[], source:string|null, error:string|null
 * }}
 */
export function styleAspects(slug, { film = null } = {}) {
  const demoDir = path.join(STYLES_DIR, String(slug == null ? '' : slug), 'demo');
  const out = {
    slug: String(slug == null ? '' : slug),
    demoDir,
    mode: 'style',
    probe: PROBE_KIND,
    default: DEFAULT_ASPECTS.slice(),
    supported: DEFAULT_ASPECTS.slice(),
    declared: false,
    films: [],
    source: null,
    error: null,
  };

  if (film) {
    const one = filmModuleAspects(demoDir, film);
    out.mode = 'film';
    out.films = [one];
    out.supported = one.aspects.slice();
    out.declared = one.declared;
    out.source = one.file;
    out.error = one.error;
    return out;
  }

  const films = demoFilmModules(demoDir).map((m) => filmModuleAspects(demoDir, m));
  const set = new Set(DEFAULT_ASPECTS);                      // 16:9 永远成立（原生构图）
  for (const f of films) if (f.declared) for (const a of f.aspects) set.add(a);
  out.films = films;
  // 按库侧注册表的顺序输出（稳定、与 UI 下拉一致），而不是声明的先后
  out.supported = RATIOS.map((r) => r.id).filter((id) => set.has(id));
  out.declared = films.some((f) => f.declared);
  const hit = films.find((f) => f.declared);
  out.source = (hit && hit.file) || (films[0] && films[0].file) || path.join(demoDir, 'film.js');
  return out;
}

/** 一组像素是否落在某个比例上（相对容差）。 */
export function matchesAspect(w, h, ratioId, tol = ASPECT_TOL) {
  if (!w || !h || !isRatioId(ratioId)) return false;
  const [a, b] = ratioId.split(':').map(Number);
  const want = a / b;
  return Math.abs(w / h - want) / want <= tol;
}

/**
 * 出片前的能力核对：这个风格 + 这个尺寸，会不会被裁？
 *
 * @param {{slug:string, ratio?:string, size?:string|null, film?:string|null}} q
 * @returns {object} styleAspects(...) 的全部字段 + {ratio, size, w, h, pixels, fits, warning, detail}
 *   · fits=true 表示该尺寸落在影片声明支持的某个比例上（或尺寸本身不合法 —— 那由 sizes.sizeInfo 报错）；
 *   · fits=false 时 warning 是一句给 UI 的短提示，detail 是完整说明（tooltip 用）。
 *   **任何异常都不抛**：探测不到就按「只支持 16:9」判。
 */
export function aspectCheck({ slug, ratio, size, film = null } = {}) {
  const info = styleAspects(slug, { film });
  const rawSize = (typeof size === 'string' && size.trim()) ? size.trim() : null;
  const rt = isRatioId(ratio) ? ratio : DEFAULT_RATIO;
  const wh = rawSize ? resolveSize({ size: rawSize }) : resolveSize({ ratio: rt });
  const out = {
    ...info,
    ratio: rt,
    size: rawSize,
    w: wh ? wh.w : null,
    h: wh ? wh.h : null,
    pixels: wh ? formatSize(wh) : null,
    fits: true,
    warning: null,
    detail: null,
  };
  if (!wh) return out;                     // 尺寸本身不合法 → 交给 sizes.sizeInfo 报错，这里不重复
  out.fits = info.supported.some((id) => matchesAspect(wh.w, wh.h, id));
  if (!out.fits) {
    const sup = info.supported.join(' / ');
    const what = rawSize ? `自定义尺寸 ${wh.w}×${wh.h}` : `比例 ${rt}（${wh.w}×${wh.h}）`;
    const who = info.mode === 'film'
      ? `工单指定的影片模块 ${info.films[0].film}`
      : `风格 ${info.slug}`;
    out.warning = `${who} 未适配 ${what}：出这个尺寸画面会被裁切，建议用 ${sup}`
      + (info.declared ? '' : '（该影片没写 aspects 声明 = 只支持 16:9）');
    out.detail = `${who} 未声明支持 ${what}。影片按 1920×1080 的绝对像素构图，`
      + `出这个尺寸会被**裁切**（不是重排、也不是留黑边）。已知支持：${sup}。`
      + `能力来自影片文件里的 aspects 声明（${PROBE_KIND} 探测${info.source ? `：${info.source}` : ''}）；`
      + `没声明 = 只支持 16:9。要让影片支持多比例，见库侧 MAINTAINING.md「让影片支持多比例」。`;
  }
  return out;
}
