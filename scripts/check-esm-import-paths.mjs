#!/usr/bin/env node
/**
 * scripts/check-esm-import-paths.mjs —— 动态 `import()` 传「运行时拼出来的绝对路径」的**跨平台闸门**
 *
 * ★① 由来（2026-10-05 实踩，Windows 下**直接崩**）：
 *   跑 `styles/hologram-hud/demo/tools/export.mjs` 报：
 *   ```
 *   Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data, and node
 *   are supported by the default ESM loader. On Windows, absolute paths must be valid file://
 *   URLs. Received protocol 'd:'
 *   ```
 *   根因：`await import(path.join(ROOT, 'core/render/page.mjs'))` —— Windows 下 `path.join`
 *   产出 `D:\...`，而 Node 的 ESM loader **只认 `file://` URL**（POSIX 下绝对路径可用，
 *   所以以前走 WSL 跑没暴露）。全库同款写法共 **6 处**（hologram-hud/export、silent-film 与
 *   art-deco 的 dump_timeline、midcentury-toon/cues、crayon-book/subs、blueprint/tools/subs）。
 *   正确写法：`import(pathToFileURL(p).href)`（`node:url` 的 `pathToFileURL`）——**跨平台**通用。
 *
 * ★② 判据：
 *   扫 `styles/<slug>/demo/**` 与 `core/**` 下的 `.mjs`/`.js`，找出**动态 `import(<arg>)`**，
 *   其中 `<arg>` 是**运行时拼出来的路径表达式**且**没有** `file://` / `pathToFileURL`：
 *     · `import(path.join(...))` / `import(path.resolve(...))` / `import(path.normalize(...))`
 *       —— 直接命中（这些产出 OS 绝对路径）；
 *     · `import(\`${...}\`)` / `import('…' + x + …)` —— 取**首个字面量片段**判断：
 *         以 `./` `../` `/` 或 `data:` `node:` `http:` `https:` `file:` 开头 ⇒ 合法（相对/URL 说明符，放行）；
 *         字面量片段为空（如 `` `${ROOT}/x.mjs` ``）或其它（如 `D:` 盘符）⇒ 命中。
 *   **命中 ⇒ FAIL**，报 `file:line` + 原始行。注释与字符串里的 `import(` 不计。
 *
 * ★③ 已知局限（**这是正则/状态机启发式，不是 AST**）：
 *     · 可能**漏**：路径来自**变量**（`const p=…; import(p)`）、`require`、`createRequire`、
 *       `import()` 的实参跨多语句拼装、`importmaps`/别名等 —— 一律看不见（假阴）。
 *     · 可能**误报**：把「运行时拼出但其实是相对路径」的写法算进去（若首片段不是 `./`/`../`），
 *       或把自定义 scheme（如 `bun:`）当违规。**命中时应人工确认，别自动改代码**。
 *     · 只扫 **WIN 侧** `D:/lemo-opuscar`（不扫 WSL 副本，也不扫 `creative/`、`web/`、`node_modules`）。
 *   退出码：**命中** 或 **扫描根失明**（根不存在 / 收集到 0 个文件）⇒ 1；否则 0。
 *   ★ 失明守卫：扫不到文件时**绝不静默绿灯**，会明说「本闸门已失明」。
 *
 * 用法：node scripts/check-esm-import-paths.mjs
 *   （可用环境变量 LEMO_OPUSCAR 覆盖扫描根，默认 D:/lemo-opuscar；变异测试用）
 */
import fs from 'node:fs';
import path from 'node:path';

const OPUSCAR = process.env.LEMO_OPUSCAR || 'D:/lemo-opuscar';
const SKIP = /node_modules|\.git\/|\.bak|\.orig-/;

// ── 收集：styles/*/demo/** + core/** 下的 .mjs/.js ──────────────────────────────
function collect(dir, out, depth = 0) {
  if (depth > 12) return out;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name).replace(/\\/g, '/');
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) collect(p, out, depth + 1);
    else if (/\.(mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

function collectTargets() {
  const out = [];
  // styles/<slug>/demo/**
  const stylesDir = path.join(OPUSCAR, 'styles');
  let slugs = [];
  try { slugs = fs.readdirSync(stylesDir, { withFileTypes: true }); } catch { /* 交给失明守卫 */ }
  for (const s of slugs) {
    if (!s.isDirectory()) continue;
    const demo = path.join(stylesDir, s.name, 'demo').replace(/\\/g, '/');
    if (fs.existsSync(demo)) collect(demo, out);
  }
  // core/**
  const core = path.join(OPUSCAR, 'core').replace(/\\/g, '/');
  if (fs.existsSync(core)) collect(core, out);
  return [...new Set(out)];
}

// ── 状态机：找出代码上下文里的动态 import(...)，跳过注释与字符串 ──────────────
function findDynamicImports(src) {
  const hits = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '"') {
      const q = c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (c === '`') { i = skipTemplate(src, i); continue; }
    if (src.startsWith('import', i)) {
      const prev = i > 0 ? src[i - 1] : ' ';
      if (!/[A-Za-z0-9_$.]/.test(prev)) {
        let j = i + 6;
        while (j < n && /\s/.test(src[j])) j++;
        if (src[j] === '(') {
          const end = matchParen(src, j);
          hits.push({ index: i, arg: src.slice(j + 1, end) });
          i = end + 1; continue;
        }
      }
    }
    i++;
  }
  return hits;
}

// 跳过模板字面量（含 ${...} 里的嵌套），返回闭合反引号后一位
function skipTemplate(src, start) {
  const n = src.length;
  let i = start + 1, depth = 0;
  while (i < n) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '`' && depth === 0) return i + 1;
    if (src[i] === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
    if (src[i] === '}' && depth > 0) { depth--; i++; continue; }
    i++;
  }
  return n;
}

// 从 '(' 开始找匹配的 ')'，跳过字符串/模板/注释；返回 ')' 的下标
function matchParen(src, open) {
  const n = src.length;
  let i = open + 1, depth = 1;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '"') { const q = c; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; continue; }
    if (c === '`') { i = skipTemplate(src, i); continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return i; }
    i++;
  }
  return n;
}

// ── 判据：这个 import 实参是不是「运行时拼的绝对路径」且没走 file:// ────────────
const SCHEME = /^(data|node|http|https|file|blob):/;
function classify(arg) {
  const a = arg.trim();
  if (/pathToFileURL/.test(a)) return { bad: false };          // 已修：显式转 file:// URL
  if (/file:\/\//.test(a)) return { bad: false };              // 直接给 file:// 串
  const isPathCall = /\bpath\s*\.\s*(join|resolve|normalize)\s*\(/.test(a);

  // ① 实参以**字面量**开头（字符串或模板）：由「首片段」判定 —— 这是最可靠的信号。
  //    注意：path.join 可能只是嵌套调用（如 import('data:…' + fs.readFileSync(path.join(…)))），
  //    此时首片段是 `data:` ⇒ 合法，path.join 并不构成 import 说明符。
  let lead = null;
  if (a[0] === '`') { const m = a.slice(1).match(/^[^`$]*/); lead = m ? m[0] : ''; }
  else if (a[0] === "'" || a[0] === '"') {
    const q = a[0]; let k = 1, s = '';
    while (k < a.length && a[k] !== q) { if (a[k] === '\\') k++; s += a[k]; k++; }
    lead = s;
  }
  if (lead !== null) {
    if (lead.startsWith('./') || lead.startsWith('../')) return { bad: false };  // 相对说明符
    if (lead.startsWith('/')) return { bad: false };                             // 根相对 URL 路径
    if (SCHEME.test(lead)) return { bad: false };                                // 显式 scheme
    // 无 ${ 的纯模板/纯串（静态说明符）且不是相对/scheme ⇒ 交给下面的 path 判定兜底
    if (!a.includes('${') && !a.includes('+') && !isPathCall) return { bad: false };
    return { bad: true, why: lead === '' ? '模板以 ${…} 开头（可能是绝对路径）' : `首片段「${lead}」不是相对/URL 说明符` };
  }

  // ② 实参以**调用/标识符**开头：只把 path.join/resolve/normalize 当违规（产出 OS 绝对路径）。
  if (isPathCall) return { bad: true, why: 'path.join/resolve/normalize 产出 OS 绝对路径' };
  return { bad: false };  // 纯变量等 ⇒ 看不见（已知局限）
}

function lineOf(src, index) { let l = 1; for (let k = 0; k < index && k < src.length; k++) if (src[k] === '\n') l++; return l; }

// ── 主流程 ─────────────────────────────────────────────────────────────────────
const files = collectTargets();
const fails = [];

if (files.length === 0) {
  console.log(`✘ 扫描根 ${OPUSCAR}/styles/*/demo/** 与 ${OPUSCAR}/core/** 下收集到 0 个 .mjs/.js 文件 ⇒ 本闸门已失明（根不存在或路径变了）`);
  console.log('\n[闸门] 扫描根失明 ✘');
  process.exitCode = 1;
} else {
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!src.includes('import')) continue;
    for (const h of findDynamicImports(src)) {
      const v = classify(h.arg);
      if (v.bad) {
        const ln = lineOf(src, h.index);
        const raw = src.split('\n')[ln - 1].trim();
        fails.push({ file: f, ln, why: v.why, raw });
      }
    }
  }
  console.log(`扫描 .mjs/.js：${files.length} 个（${OPUSCAR}）`);
  if (fails.length) {
    console.log(`\n✘ 发现 ${fails.length} 处「动态 import 传运行时绝对路径」：\n`);
    for (const x of fails) console.log(`  ${x.file}:${x.ln}\n    [${x.why}] ${x.raw}`);
    console.log('\n修法：把实参改成 `import(pathToFileURL(<原表达式>).href)`（`node:url` 的 pathToFileURL），跨平台通用。');
    console.log('★ 启发式命中：请人工确认（可能是误报，如自定义 scheme）。');
  } else {
    console.log('\n✓ 未发现「动态 import 传运行时绝对路径且未转 file://」的写法。');
  }
  console.log(`\n[闸门] 违规 ${fails.length} 处 ${fails.length ? '✘' : 'OK'}`);
  process.exitCode = fails.length ? 1 : 0;
}
