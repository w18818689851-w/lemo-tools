#!/usr/bin/env node
// style-scan.mjs —— 风格源码指纹扫描器（约定一「自动纳入」机制的检测端）
//
// 约定一（memory/MEMORY.md）要求：
//   项目里的 43 个内置风格 + 后续新增风格，都要**自动纳入**学习范围；
//   新增 styles/<slug>/ 或已有风格代码变更时，必须能被**自动发现并重新解析**，
//   不需要人工记得去跑；判据用**源码指纹**（内容哈希），**不是时间戳**。
//
// 本文件只做「检测」：遍历 → 算内容哈希 → 与上次基线比对 → 报告新增/变更/未变。
// **不做重活**（不去解析风格、不调模型），所以可以安全地挂在出片路径上（见 dub.mjs）。
//
// ── 指纹覆盖哪些文件，依据是什么 ────────────────────────────────
// 原则：决定「画面长什么样」的是**绘图代码 + 风格定义**，不是素材/音频/构建产物。
//   纳入：
//     · 全目录递归取代码与样式文本：.js .mjs .cjs .ts .html .htm .css
//       → 覆盖 demo/film.js、demo/index.html、demo/main.js、demo/engine/**、demo/subjects/**，
//         也覆盖 demo/scenes|poses|render|models|src/**（同样是 Canvas2D/WebGL 绘图代码）。
//         用「扩展名」而不是「目录白名单」，是因为各风格目录布局不统一（实测 405 个文件在
//         demo/ 顶层、31 在 demo/engine、20 在 demo/src/shots、14 在 demo/scenes…），
//         目录白名单一定会漏。
//     · 风格定义（不在 demo/ 下、也不是代码扩展名）：STYLE.md、DEMO.md、style.json
//   排除（依据：与「风格长什么样」无关，且多为生成物/素材，纳入只会造成误报）：
//     · 目录：node_modules .git .cache out dist build stills fonts voices voices_raw
//             assets music vendor audio tts crops posters thumbs
//     · 其它扩展名：.json（内容数据）/ .py（混音、TTS）/ .srt / .mp4 .wav .jpg .ttf .gltf …
//       ★ 特别是 demo/events.json、demo/lines.json、demo/content*.json 是**生成物**，
//         它们变了不代表风格变了（实测 events.json 的 mtime 比同目录源码新，正是这种噪声）。
//
// ── 用法 ────────────────────────────────────────────────────────
//   node scripts/style-scan.mjs           扫描 + 写指纹文件 + 打印变更报告
//   node scripts/style-scan.mjs --check   只检测不写盘（出片路径用的模式）
//   node scripts/style-scan.mjs --json    机器可读输出
//   node scripts/style-scan.mjs --quiet   只打印结论行
// 环境变量：
//   LEMO_STYLES_ROOT    风格根目录（默认 D:/lemo-opuscar/styles）
//   LEMO_STYLE_FP_FILE  指纹文件  （默认 D:/lemo-tools/lib/style-fingerprints.json）

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const SCANNER_VERSION = 1;
export const ALGORITHM = 'sha256';
export const DEFAULT_STYLES_ROOT = 'D:/lemo-opuscar/styles';
export const DEFAULT_FP_FILE = 'D:/lemo-tools/lib/style-fingerprints.json';

// 决定画面的代码/样式文本
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.html', '.htm', '.css']);
// 素材 / 生成物 / 第三方目录：整个子树跳过
const DENY_DIRS = new Set([
  'node_modules', '.git', '.cache', 'out', 'dist', 'build',
  'stills', 'fonts', 'voices', 'voices_raw', 'assets', 'music', 'vendor',
  'audio', 'tts', 'crops', 'posters', 'thumbs',
]);
// 根级显式纳入的风格定义（不是代码扩展名，但在 demo/ 之外、且确实定义风格）
const ROOT_EXTRAS = ['STYLE.md', 'DEMO.md', 'style.json'];
// 非风格目录：_template 是脚手架、README.md 是文档
const NON_STYLE = new Set(['_template', 'node_modules']);

export function resolveStylesRoot(v) {
  return v || process.env.LEMO_STYLES_ROOT || DEFAULT_STYLES_ROOT;
}
export function resolveFpFile(v) {
  return v || process.env.LEMO_STYLE_FP_FILE || DEFAULT_FP_FILE;
}

// ── 收集某个风格参与指纹的文件（返回相对路径数组，已排序）────────
export function collectStyleFiles(styleDir) {
  const rels = [];
  const seen = new Set();
  const add = (rel) => { if (!seen.has(rel)) { seen.add(rel); rels.push(rel); } };

  for (const e of ROOT_EXTRAS) {
    try { if (fs.statSync(path.join(styleDir, e)).isFile()) add(e); } catch { /* 不存在就算了 */ }
  }

  const walk = (relDir) => {
    let ents;
    try { ents = fs.readdirSync(path.join(styleDir, relDir), { withFileTypes: true }); }
    catch { return; }
    for (const ent of ents) {
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        if (DENY_DIRS.has(ent.name)) continue;
        walk(rel);
      } else if (ent.isFile()) {
        if (CODE_EXT.has(path.extname(ent.name).toLowerCase())) add(rel);
      }
    }
  };
  walk('');

  rels.sort();
  return rels;
}

// ── 单个风格的指纹：sha256(每个文件 sha256 的拼接) ───────────────
// 既保存总指纹（快比），也保存逐文件哈希（报告能指出**哪个文件**变了）。
export function fingerprintStyle(styleDir) {
  const files = collectStyleFiles(styleDir);
  const fileHashes = {};
  const parts = [];
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(styleDir, rel));
    const h = crypto.createHash(ALGORITHM).update(buf).digest('hex');
    fileHashes[rel] = h;
    parts.push(`${rel}\u0000${h}`);
  }
  const hash = crypto.createHash(ALGORITHM).update(parts.join('\n')).digest('hex');
  return { hash, fileCount: files.length, files: fileHashes };
}

// ── 全量扫描 ────────────────────────────────────────────────────
export function scanStyles({ stylesRoot } = {}) {
  const root = resolveStylesRoot(stylesRoot);
  const slugs = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.') && !NON_STYLE.has(n))
    .sort();

  const styles = {};
  const errors = [];
  for (const slug of slugs) {
    try { styles[slug] = fingerprintStyle(path.join(root, slug)); }
    catch (e) { errors.push(`${slug}: ${e?.message || e}`); }
  }
  return { stylesRoot: path.resolve(root), styles, errors };
}

// ── 指纹文件读写 ────────────────────────────────────────────────
export function loadFingerprintFile(fpFile) {
  const f = resolveFpFile(fpFile);
  if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!j || typeof j !== 'object' || !j.styles || typeof j.styles !== 'object') return null;
  return j;
}

export function writeFingerprintFile(fpFile, scan) {
  const f = resolveFpFile(fpFile);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const now = new Date().toISOString();
  let prev = null;
  try { prev = loadFingerprintFile(f); } catch { /* 旧文件坏了就当没有 */ }
  const doc = {
    scanner: 'style-scan',
    scannerVersion: SCANNER_VERSION,
    algorithm: ALGORITHM,
    stylesRoot: scan.stylesRoot,
    generatedAt: prev?.generatedAt || now,   // 首次建立基线的时间，后续保持不变
    lastScanAt: now,                          // 上次扫描时间
    styleCount: Object.keys(scan.styles).length,
    styles: scan.styles,
  };
  fs.writeFileSync(f, JSON.stringify(doc, null, 1), 'utf8');
  return doc;
}

// ── 差异比对 ────────────────────────────────────────────────────
export function diffScans(cur, prev) {
  const added = [], changed = [], removed = [], unchanged = [];
  for (const slug of Object.keys(cur.styles)) {
    const c = cur.styles[slug];
    const p = prev?.styles?.[slug];
    if (!p) {
      added.push({ slug, hash: c.hash, fileCount: c.fileCount, changedFiles: Object.keys(c.files) });
      continue;
    }
    if (p.hash !== c.hash) {
      const all = new Set([...Object.keys(p.files || {}), ...Object.keys(c.files || {})]);
      const cf = [];
      for (const rel of [...all].sort()) {
        const a = p.files?.[rel], b = c.files?.[rel];
        if (a === b) continue;
        if (b == null) cf.push(`${rel} (删除)`);
        else if (a == null) cf.push(`${rel} (新增)`);
        else cf.push(rel);
      }
      changed.push({ slug, from: p.hash, to: c.hash, changedFiles: cf });
    } else unchanged.push(slug);
  }
  if (prev?.styles) {
    for (const slug of Object.keys(prev.styles)) if (!cur.styles[slug]) removed.push(slug);
  }
  return { added, changed, removed, unchanged };
}

// ── 出片路径用的轻量检测（**只检测，不写盘除首次基线外**）────────
// 返回对象永不抛异常；调用方（dub.mjs）据此打印告警，绝不阻断出片。
export async function checkStyleChanges(opts = {}) {
  const t0 = Date.now();
  const stylesRoot = resolveStylesRoot(opts.stylesRoot);
  const fpFile = resolveFpFile(opts.fpFile);
  const autoBaseline = opts.autoBaseline !== false;
  try {
    if (!fs.existsSync(stylesRoot)) {
      return { ok: false, status: 'error', error: `风格根目录不存在: ${stylesRoot}`, fpFile, ms: Date.now() - t0 };
    }
    const prev = loadFingerprintFile(fpFile);
    const cur = scanStyles({ stylesRoot });
    const styleCount = Object.keys(cur.styles).length;

    if (!prev) {
      if (autoBaseline) {
        try { writeFingerprintFile(fpFile, cur); }
        catch (e) {
          // ★ 写基线失败**必须可见**（2026-10-09 修 D3）：
          //   此前这里返回 `ok:true, status:'baseline'` + 一个 `writeError`，而那个 writeError
          //   **全仓 0 处消费** ⇒ 消费方（`dub.mjs` 的 `warnStyleChanges`）照打绿字
          //   「首次建立基线，纳入 N 个风格」，可基线**其实没落盘** ⇒ 之后每次出片都 `!prev`
          //   ⇒ 永远停在 baseline 分支、永不进 changed ⇒ **风格漂移检测永久失明**，而用户只看到成功提示。
          // ★ 仍守本模块纪律「**永不抛、不阻断出片**」（见文件头 190-191 行）：不 throw，只把
          //   `ok` 置 false + 用 status/error **如实反映失败**。消费方的 `if (!r.ok) warn(...)` 分支
          //   据此打出**可见警告**（不再走绿字成功话术）。
          const msg = e?.message || String(e);
          return {
            ok: false, status: 'baseline-write-failed', styleCount, fpFile,
            writeError: msg,
            error: `写指纹基线失败（${fpFile}）：${msg} —— 基线未落盘，本次及后续风格漂移检测不可用`,
            ms: Date.now() - t0,
          };
        }
        return { ok: true, status: 'baseline', styleCount, fpFile, ms: Date.now() - t0 };
      }
      return { ok: true, status: 'no-baseline', styleCount, fpFile, ms: Date.now() - t0 };
    }

    const d = diffScans(cur, prev);
    const status = (d.added.length || d.changed.length || d.removed.length) ? 'changed' : 'no-change';
    return {
      ok: true, status, styleCount, fpFile,
      baselineAt: prev.lastScanAt || prev.generatedAt || null,
      ...d, ms: Date.now() - t0,
    };
  } catch (e) {
    return { ok: false, status: 'error', error: e?.stack || String(e), fpFile, ms: Date.now() - t0 };
  }
}

// ── CLI ─────────────────────────────────────────────────────────
function report(scan, d, prev, fpFile, { quiet, json, check }) {
  const total = Object.keys(scan.styles).length;
  const nAdd = d.added.length, nChg = d.changed.length, nRem = d.removed.length;

  if (json) {
    console.log(JSON.stringify({
      stylesRoot: scan.stylesRoot, fpFile, scannerVersion: SCANNER_VERSION, algorithm: ALGORITHM,
      styleCount: total, mode: check ? 'check' : 'scan',
      firstRun: !prev,
      added: d.added, changed: d.changed, removed: d.removed,
      unchangedCount: d.unchanged.length, errors: scan.errors,
    }, null, 1));
    return;
  }

  const t = (s) => `\x1b[1m${s}\x1b[0m`;
  const y = (s) => `\x1b[33m${s}\x1b[0m`;
  const g = (s) => `\x1b[32m${s}\x1b[0m`;
  const r = (s) => `\x1b[31m${s}\x1b[0m`;
  const dim = (s) => `\x1b[2m${s}\x1b[0m`;

  if (!prev) {
    console.log(`${t('style-scan')} 首次运行 —— 建立基线`);
    console.log(`  风格根目录  ${scan.stylesRoot}`);
    console.log(`  扫描到风格  ${t(String(total))} 个`);
    console.log(`  指纹文件    ${fpFile}`);
    console.log(`  算法        ${ALGORITHM}（内容哈希，非时间戳）`);
    const fc = Object.values(scan.styles).reduce((a, s) => a + s.fileCount, 0);
    console.log(`  覆盖源码    ${fc} 个文件（均 ${(fc / Math.max(1, total)).toFixed(1)} 个/风格）`);
    if (scan.errors.length) { console.log(y(`  ⚠ ${scan.errors.length} 个风格扫描出错：`)); for (const e of scan.errors) console.log(`      ${e}`); }
    if (!check) console.log(g(`  ✓ 已写入基线（下次运行将据此报告变更）`));
    return;
  }

  if (nAdd + nChg + nRem === 0) {
    if (quiet) { console.log(`${g('无变更')}  风格 ${total} 个`); return; }
    console.log(`${t('style-scan')} 无变更   ${g('✓')}`);
    console.log(`  风格 ${total} 个全部与基线一致（未变 ${d.unchanged.length}）`);
    console.log(`  ${dim(`基线 ${prev.lastScanAt || prev.generatedAt}  ·  ${fpFile}`)}`);
    if (scan.errors.length) { console.log(y(`  ⚠ ${scan.errors.length} 个风格扫描出错：`)); for (const e of scan.errors) console.log(`      ${e}`); }
    return;
  }

  console.log(`${t('style-scan')} ${y(`发现 ${nAdd + nChg + nRem} 处变更`)}`);
  console.log(`  风格根目录  ${scan.stylesRoot}`);
  console.log(`  扫描到风格  ${total} 个（未变 ${d.unchanged.length}）`);
  if (nAdd) {
    console.log(`\n  ${g('＋ 新增风格')}（${nAdd}）—— 需要**首次解析**并纳入学习范围：`);
    for (const a of d.added) console.log(`     ${g(a.slug)}  ${a.fileCount} 个源码文件`);
  }
  if (nChg) {
    console.log(`\n  ${y('～ 指纹变更')}（${nChg}）—— 需要**重新解析**：`);
    for (const c of d.changed) {
      console.log(`     ${y(c.slug)}  ${dim(`${c.from.slice(0, 10)}… → ${c.to.slice(0, 10)}…`)}`);
      for (const f of c.changedFiles) console.log(`        · ${f}`);
    }
  }
  if (nRem) {
    console.log(`\n  ${r('－ 消失')}（${nRem}）：${d.removed.join(', ')}`);
  }
  if (scan.errors.length) { console.log(y(`\n  ⚠ ${scan.errors.length} 个风格扫描出错：`)); for (const e of scan.errors) console.log(`      ${e}`); }
  if (!check) console.log(g(`\n  ✓ 已用本次结果刷新基线`));
}

async function cliMain() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const json = argv.includes('--json');
  const quiet = argv.includes('--quiet');
  const stylesRoot = resolveStylesRoot();
  const fpFile = resolveFpFile();

  if (!fs.existsSync(stylesRoot)) {
    console.error(`✗ 风格根目录不存在: ${stylesRoot}（可用 LEMO_STYLES_ROOT 覆盖）`);
    process.exit(2);
  }

  let prev = null;
  try { prev = loadFingerprintFile(fpFile); }
  catch (e) { console.error(`⚠ 指纹文件损坏，按首次运行处理：${e?.message || e}`); prev = null; }

  const scan = scanStyles({ stylesRoot });
  const d = prev ? diffScans(scan, prev)
    : { added: Object.keys(scan.styles).map((s) => ({ slug: s, hash: scan.styles[s].hash, fileCount: scan.styles[s].fileCount, changedFiles: Object.keys(scan.styles[s].files) })), changed: [], removed: [], unchanged: [] };

  report(scan, d, prev, fpFile, { quiet, json, check });

  if (!check) {
    try { writeFingerprintFile(fpFile, scan); }
    catch (e) { console.error(`✗ 写指纹文件失败：${e?.message || e}`); process.exit(3); }
  }
  // 退出码：0 = 正常；--check 且有变更时仍返回 0（出片路径不能因为"有变更"就当成失败）
  process.exit(0);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  cliMain().catch((e) => { console.error(`✗ style-scan 未捕获异常: ${e?.stack || e}`); process.exit(1); });
}
