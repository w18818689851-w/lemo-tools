// lib/sizes.mjs —— 「输出尺寸」注册表的**只读代理**（控制台侧）
//
// ★ 为什么要有这个文件：控制台要显示「9:16 / 16:9 / 3:4 / 4:3 / 1:1 + 自定义」，
//   但**比例清单与换算的权威来源是库** —— D:\lemo-opuscar\core\render\size.mjs 的
//   RATIOS / DEFAULT_RATIO / parseSizeSpec / resolveSize。
//   控制台绝不自己维护一份比例表，否则库里改了比例、控制台还认老的 —— 判据写在两处必然漂移。
//   所以这里**动态 import 那个文件**，把它的导出原样拿来用（size.mjs 是纯注册表 + 纯函数，顶层无副作用）。
//
// ★ 与 lib/langs.mjs 同一条纪律：**只读** —— 本模块不往库里写任何东西。
//
// ★ 读不到库（老库 / 路径不对）时降级：只认默认比例 9:16，并把原因放在 registryError 里如实上报。
//   控制台其余功能照常；出片流程仍会显式传 --ratio 9:16（编排器自己也有同一份库文件）。
//
// ★ 注意：这里的默认是 **9:16**（用户要求：任务没指定尺寸时按 9:16 导出）。
//   低层渲染工具 takeSize 的默认仍是 1920x1080 —— 见库侧 size.mjs 文件头的解释，控制台不参与那件事。

import { pathToFileURL } from 'node:url';
import path from 'node:path';

import { CFG } from './env.mjs';

const SIZE_MJS = path.join(CFG.winLib, 'core', 'render', 'size.mjs');

// 降级用：读不到库时只留默认项。**故意只留一条** —— 不在控制台里另抄一份完整比例表。
const FALLBACK_RATIOS = [{ id: '9:16', label: '9:16 竖屏（默认）' }];
const FALLBACK_DEFAULT = '9:16';

let lib = null;
let registryError = null;
try {
  const mod = await import(pathToFileURL(SIZE_MJS).href);
  if (mod && Array.isArray(mod.RATIOS) && mod.RATIOS.length && typeof mod.resolveSize === 'function') {
    lib = mod;
  } else {
    registryError = `${SIZE_MJS} 里没有导出 RATIOS / resolveSize`;
  }
} catch (e) {
  registryError = `读不到 ${SIZE_MJS}：${e.message}`;
}

/** 预设比例清单（第一条即默认项）。读不到库时只剩默认的 9:16。 */
export const RATIOS = lib ? lib.RATIOS : FALLBACK_RATIOS;
/** 默认比例：任务没明确指定尺寸时用它（9:16）。 */
export const DEFAULT_RATIO = (lib && lib.DEFAULT_RATIO) || FALLBACK_DEFAULT;
export const sizesRegistryError = registryError;
export const sizeSource = SIZE_MJS;

// 自定义像素的上下限 —— **同样从库侧 size.mjs 读**（MIN_SIZE / MAX_SIZE），控制台不另立一份。
// ★ 库侧下限不是 16 而是 96：16 是编造的，实测 ≤72 必崩（渲染器圆窗半径缩成负数，未捕获的
//   IndexSizeError）。推导见库侧 core/render/size.mjs 的 MIN_SIZE 注释。
// 读不到库时降级用 96 / 8192（与库当前值一致）；此时控制台本来也只剩默认比例可用，这只是给
// 错误文案一个合理的数字，避免打印 undefined。
export const MIN_SIZE = lib && Number.isInteger(lib.MIN_SIZE) ? lib.MIN_SIZE : 96;
export const MAX_SIZE = lib && Number.isInteger(lib.MAX_SIZE) ? lib.MAX_SIZE : 8192;

const RATIO_IDS = new Set(RATIOS.map((r) => r.id));

/** 是不是预设比例（'9:16' / '16:9' …）。 */
export function isRatioId(id) {
  return typeof id === 'string' && RATIO_IDS.has(id);
}

export function ratioLabel(id) {
  const r = RATIOS.find((x) => x.id === id);
  return r ? r.label : String(id == null ? '' : id);
}

export function ratioIds() { return RATIOS.map((r) => r.id); }

/**
 * 解析尺寸写法：'9:16'（预设比例）或 '1080x1920'（自定义像素）。非法返回 null。
 * 读不到库时退化成「只认默认比例」。
 */
export function parseSizeSpec(s) {
  if (lib) return lib.parseSizeSpec(s);
  const v = String(s ?? '').trim();
  return v === DEFAULT_RATIO ? { ratio: DEFAULT_RATIO } : null;
}

/**
 * 把「比例 or 自定义尺寸」解析成 { w, h }（偶数、MIN_SIZE–MAX_SIZE）。非法返回 null。
 * 优先级 size > ratio > DEFAULT_RATIO。读不到库时只支持默认比例（按长边 1920 推导）。
 */
export function resolveSize(opts = {}) {
  if (lib) return lib.resolveSize(opts);
  const spec = opts.size ?? opts.ratio;
  const base = opts.base || 1920;
  if (spec != null && spec !== '' && spec !== DEFAULT_RATIO) return null;   // 降级态只认默认比例
  const [a, b] = DEFAULT_RATIO.split(':').map(Number);
  const s = base / Math.max(a, b);
  const even = (n) => 2 * Math.round(n / 2);
  return { w: even(a * s), h: even(b * s) };
}

/** { w: 1080, h: 1920 } → '1080x1920'（日志 / UI 用）。 */
export function formatSize(d) {
  if (lib) return lib.formatSize(d);
  return d && d.w != null && d.h != null ? `${d.w}x${d.h}` : '';
}

/**
 * 一条工单的尺寸摘要（给 UI / API 看）。字段缺失或非法一律按默认比例处理（**不抛**）。
 *
 * @param {{ratio?:string, size?:string|null}} b 工单（或任何带 ratio / size 的对象）
 * @returns {{ratio:string, size:string|null, w:number|null, h:number|null, display:string,
 *            ratioLabel:string, isCustom:boolean, valid:boolean, error:string|null}}
 */
export function sizeInfo(b = {}) {
  // 自定义像素（size）优先；它合法时工单的 ratio 只作记录用。
  const rawSize = (typeof b.size === 'string' && b.size.trim()) ? b.size.trim() : null;
  if (rawSize) {
    const wh = resolveSize({ size: rawSize });
    if (wh) {
      return {
        ratio: isRatioId(b.ratio) ? b.ratio : DEFAULT_RATIO,
        size: rawSize,
        w: wh.w, h: wh.h,
        display: formatSize(wh),
        ratioLabel: '自定义',
        isCustom: true,
        valid: true,
        error: null,
      };
    }
    return {
      ratio: isRatioId(b.ratio) ? b.ratio : DEFAULT_RATIO,
      size: rawSize,
      w: null, h: null,
      display: rawSize,
      ratioLabel: '自定义',
      isCustom: true,
      valid: false,
      error: `自定义尺寸 ${JSON.stringify(rawSize)} 不合法（要写成 宽x高，两边都是 ${MIN_SIZE}–${MAX_SIZE} 的偶数，如 1080x1920）`,
    };
  }
  const ratio = isRatioId(b.ratio) ? b.ratio : DEFAULT_RATIO;
  const wh = resolveSize({ ratio });
  return {
    ratio,
    size: null,
    w: wh ? wh.w : null, h: wh ? wh.h : null,
    display: ratio,
    ratioLabel: ratioLabel(ratio),
    isCustom: false,
    valid: !!wh,
    error: wh ? null : `比例 ${JSON.stringify(ratio)} 换算不出合法像素`,
  };
}
