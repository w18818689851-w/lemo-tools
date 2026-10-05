// lib/langs.mjs —— 「语言版本」注册表的**只读代理**（控制台侧）
//
// ★ 为什么要有这个文件：控制台要显示「中文版 / 英文版」，但**语言清单的权威来源是库** ——
//   D:\lemo-opuscar\core\lang\lang.mjs 的 LANGS（「加一种语言 = 在 LANGS 里加一条」）。
//   控制台绝不自己维护一份语言表，否则库里加了 ja、控制台还只认 en/zh —— 判据写在两处必然漂移。
//   所以这里**动态 import 那个文件**，把 LANGS 原样拿来用（lang.mjs 是纯注册表，顶层无副作用）。
//
// ★ 「这个风格有没有某语言版本」的判据也只有一处：编排器 lemo-make.mjs 的 --lang 规则是
//   「把 content=X.json 换成 X.<code>.json」。所以判据 = demo 目录下**有没有 content*.<code>.json**。
//   这里就按这条规则扫目录，不另立判据（前端只消费本模块的结果，不自己判）。
//
// ★ 读不到库（老库 / 路径不对）时降级：只认 en，并把原因放在 registryError 里如实上报。
//   控制台其余功能照常 —— 语言选择退化成「只有英文版」，出片命令行与改动前逐字一致。
//
// ★ 只读：本模块不往库里写任何东西（与 lib/briefs.mjs 同一条纪律）。

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { CFG } from './env.mjs';

const LANG_MJS = path.join(CFG.winLib, 'core', 'lang', 'lang.mjs');

/** 默认语言：**不带语言后缀的内容文件**（content.json / content_<id>.json）就是这一版。 */
export const DEFAULT_LANG = 'en';

/**
 * UI 默认选中的语言。用户是中文用户，且这个功能就是为中文版做的 —— 所以默认「中文版」。
 * ★ 只是**界面偏好**，不是判据：该风格没有 zh 内容文件时自动退回 DEFAULT_LANG（见 langsForDemoDir）。
 */
const PREFERRED_LANG = 'zh';

/** 显示名（纯 UI 文案）。语言**标识**一律用 LANGS 的键，不用这里的字。 */
const CN_LABEL = { en: '英文版', zh: '中文版' };

let registry = null;
let registryError = null;
try {
  const mod = await import(pathToFileURL(LANG_MJS).href);
  if (mod && mod.LANGS && typeof mod.LANGS === 'object' && Object.keys(mod.LANGS).length) {
    registry = mod.LANGS;
  } else {
    registryError = `${LANG_MJS} 里没有导出 LANGS`;
  }
} catch (e) {
  registryError = `读不到 ${LANG_MJS}：${e.message}`;
}

/** 语言注册表（读不到库时退化成只认 en）。键就是 --lang 的值。 */
export const LANGS = registry || { en: { id: 'en', name: 'English' } };
export const langsRegistryError = registryError;
export const langSource = LANG_MJS;

export function langCodes() { return Object.keys(LANGS); }

/** 是不是注册表里的语言键（**不**接受 'zh-CN' 这类别名 —— 别名归一化是库侧 langOf 的职责）。 */
export function isLangCode(c) {
  return typeof c === 'string' && Object.prototype.hasOwnProperty.call(LANGS, c);
}

export function langLabel(code) {
  const L = LANGS[code];
  if (!L) return String(code == null ? '' : code);
  return CN_LABEL[code] || L.name || String(code);
}

/** 一条语言记录（给 UI 看的摘要；字体/字距那些细节是库侧影片模块的事，控制台不碰）。 */
export function langInfo(code) {
  if (!isLangCode(code)) return null;
  const L = LANGS[code] || {};
  return {
    code,
    label: langLabel(code),
    name: L.name || '',
    labelPrefix: L.labelPrefix || '',   // 圆窗编号前缀：FIG. / 图
    tts: L.tts || null,                 // 配音音色：{ lang, voice, speed }
  };
}

/** 文件名 → 它是哪个语言版本（content_x.zh.json → 'zh'）；不是语言版本则 null。 */
function langOfFile(name) {
  const low = String(name).toLowerCase();
  for (const code of langCodes()) {
    if (code === DEFAULT_LANG) continue;
    if (low.endsWith(`.${code.toLowerCase()}.json`)) return code;
  }
  return null;
}

/**
 * 扫一个 demo 目录，得出「这个风格有哪些语言版本可以出片」。
 *
 * @param {string} demoDir 该风格的 demo 目录（由调用方给 —— 判据只有一处，见 lib/briefs.mjs:styleDetail）
 * @returns {{
 *   demoDir:string, langs:object[], codes:string[], default:string,
 *   unavailable:object[], contentFiles:string[], registryError:string|null,
 *   registrySource:string,
 * }}
 */
export function langsForDemoDir(demoDir) {
  let files = [];
  try {
    files = fs.readdirSync(demoDir, { withFileTypes: true })
      .filter((d) => d.isFile() && /^content.*\.json$/i.test(d.name))
      .map((d) => d.name)
      .sort();
  } catch { files = []; }

  const byCode = new Map();
  for (const f of files) {
    const code = langOfFile(f);
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(f);
  }

  const langs = [];        // 可选的（真的有内容文件，出得了片）
  const unavailable = [];  // 注册表里有、但这个风格还没有对应内容文件
  for (const code of langCodes()) {
    const info = langInfo(code);
    if (code === DEFAULT_LANG) {
      // 英文版 = 不带语言后缀的内容文件，永远算可用（库内默认 content.json 就是它）
      langs.push({ ...info, available: true, files: files.filter((f) => !langOfFile(f)) });
      continue;
    }
    const own = byCode.get(code);
    if (own && own.length) langs.push({ ...info, available: true, files: own });
    else unavailable.push({ ...info, available: false, files: [] });
  }

  const codes = langs.map((l) => l.code);
  const pick = codes.includes(PREFERRED_LANG) ? PREFERRED_LANG
    : (codes.includes(DEFAULT_LANG) ? DEFAULT_LANG : (codes[0] || DEFAULT_LANG));

  return {
    demoDir,
    langs,
    codes,
    default: pick,
    unavailable,
    contentFiles: files,
    registryError,
    registrySource: LANG_MJS,
  };
}
