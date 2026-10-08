#!/usr/bin/env node
/**
 * scripts/check-aspect-declaration.mjs —— 「影片真实入口已自适应、但声明探测看不见」闸门
 *
 * ★ ① 为什么需要它（拦的陷阱 + 真实后果）：
 *   `lib/aspects.mjs` 是控制台判定「某风格真的能正确构图的比例」的**唯一判据源**
 *   （`styleAspects()` / `aspectCheck()`），而它**只探 `demo/film*.js`**（`demoFilmModules()`）。
 *   本库语义：**没声明 `FILM_META.aspects` = 只支持 16:9**（`lib/aspects.mjs:29-33`）。
 *   但**影片的真实入口不是 `film*.js`** —— 渲染器加载的是 `demo/index.html`
 *   （`core/render/page.mjs:16` 明确要求该文件存在），`index.html` 里的 `<script type="module">`
 *   再 `import(...)` 具体模块（很多风格是 `main.js`）。实测 43 个风格里**42 个有 `film*.js`**，
 *   仅 1 个（`pixel-rpg`）没有，走 `main.js` 或 `index.html` 内联脚本。
 *   ⇒ 陷阱：若有人照 `MAINTAINING.md` 的多比例范式改造了某风格的 `main.js`（读视口尺寸自适应），
 *   **控制台仍会报「只支持 16:9」**（因为 `film*.js` 不存在、探测看不到）。
 *   后果：用户看到**假的**「会被裁切」警告，并被「一键修复」按钮推向更差的比例。
 *
 * ★ ② 判据（机械、可解释）：
 *   枚举 `styles/<slug>/`（排除 `_template`），对每个风格：
 *     · 若有 `demo/film*.js`（复用 `lib/aspects.mjs` 的 `demoFilmModules()`，不另实现）⇒ **OK**（探测看得见它）；
 *     · 若**没有** `film*.js` ⇒ 检查它的**真实入口**是否表现出「可能已自适应」：
 *         - 解析 `demo/index.html`，找出它引用的**本地** `.js` 模块（`import('…')` / `import … from '…'` /
 *           `src="./x.js"` 等多种写法都认）；对每个**真实存在**的被引用 `.js`，逐行找视口读取
 *           `innerWidth` / `innerHeight` / `visualViewport`（demo 唯一能感知输出尺寸的途径 —— 渲染器把页面视口设成 W×H）；
 *         - 也检查 `index.html` 里的**内联** `<script>` 正文是否直接读了视口（如 `halftone-dossier` 那种内联入口）；
 *         - **命中 ⇒ FAIL**，报出 `styles/<slug>` + 命中的文件与行号 + 一句可操作建议。
 *   匹配前会**剔掉 `//` 行注释**（整行块注释 `*` / `/*` 开头也跳过），避免注释里提一句 `innerWidth` 就误报。
 *
 * ★ ③ 已知局限（★ 如实写明）：
 *   · **这是启发式** —— 「读了视口」**不等于**「一定自适应」。它也可能只是读来做别的（打印调试、统计），
 *     或读了之后仍按 1920×1080 绝对像素构图。**命中时应人工确认，别自动改代码**（本闸门只报不改）。
 *   · 判据只认这三个标识符：`innerWidth` / `innerHeight` / `visualViewport`。若某风格用别的途径感知尺寸
 *     （如 CSS 媒体查询、`ResizeObserver`、`screen.width`），本闸门**看不见**（假阴）。
 *   · 被引用的 `.js` 解析靠**字符串字面量**扫（`'…js'` / `"…js"` / `` `…js` ``），且**排除 `node_modules/`**
 *     （第三方依赖不算「风格自己的入口」）与根绝对路径（`/…`，如 importmap 的 `/node_modules/...`）。
 *     动态拼路径（`import('./' + name + '.js')`）或经 importmap 别名间接加载的模块**抓不到**（假阴）。
 *   · `//` 出现在字符串里（如 `'http://…'`）时，行内该处之后的内容会被当成注释剔掉 —— 可能漏（假阴）；
 *     已知边界，宁可漏也不误报。
 *   · **只读**：不跑渲染、不加载模型、不改任何风格源码。只读源码文本。
 *   · 路径**基于 `lib/aspects.mjs` 的 `STYLES_DIR`**（不另抄一份）；允许 `LEMO_STYLES_ROOT` 覆盖
 *     （仅供变异测试指向临时/不存在目录，绝不动真实文件）。
 *
 * ★ ④ 退出码语义：
 *   · `0` = 无异常（当前无风格处于该陷阱状态）；
 *   · `1` = 有 FAIL（命中入口读视口）**或本闸门失明**（风格目录不存在 / 枚举到 0 个风格）；
 *   · `2` = 读不到输入（风格目录存在却**列不出来**等非 ENOENT 的读取失败）。
 *
 * 用法：node scripts/check-aspect-declaration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

// ── 复用库侧唯一实现（styles 路径 + film*.js 枚举），不另抄一份 ─────────────────
import { STYLES_DIR, demoFilmModules } from '../lib/aspects.mjs';

/** 风格源码根：默认取 `lib/aspects.mjs` 的 STYLES_DIR（唯一来源），允许覆盖（仅变异测试用）。 */
const STYLES_ROOT = path.resolve(process.env.LEMO_STYLES_ROOT || STYLES_DIR);

/** 模板目录不算风格。 */
const TEMPLATE = '_template';

/** demo 唯一能感知输出尺寸的途径（渲染器把页面视口设成 W×H）。 */
const VIEWPORT_RE = /\b(?:innerWidth|innerHeight|visualViewport)\b/;

/** 剔掉行尾 `//` 注释（启发式：从第一个 `//` 起截断）。 */
function stripLineComment(line) {
  const i = line.indexOf('//');
  return i >= 0 ? line.slice(0, i) : line;
}

/**
 * 在一段源码文本里逐行找视口读取。
 * @returns {{line:number, snippet:string}[]} 行号从 1 起
 */
function findViewportHits(text) {
  const hits = [];
  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;   // 块注释行
    if (VIEWPORT_RE.test(stripLineComment(raw))) hits.push({ line: i + 1, snippet: trimmed });
  }
  return hits;
}

/**
 * 从 index.html 里抽出它引用的**本地** `.js` 模块路径（多种写法都认）。
 * 认：`import('…')` / `import … from '…'` / `export … from '…'` / `<script src="…">` / 内联脚本里的字符串字面量。
 * 排除：带 scheme（http:/data:/blob:…）、协议相对（//）、根绝对（/…）、含 `node_modules/` 的第三方依赖。
 */
function localJsRefs(html) {
  const refs = new Set();
  const re = /['"`]([^'"`\r\n]+?\.js)['"`]/g;
  let m;
  while ((m = re.exec(html))) {
    let ref = m[1].trim();
    if (!ref) continue;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref)) continue;      // 有 scheme
    if (ref.startsWith('/')) continue;                         // 根绝对路径（含协议相对 `//…`）
    ref = ref.split(/[?#]/)[0];                                // 去 query / hash
    if (!ref) continue;
    if (ref.split('/').includes('node_modules')) continue;     // 第三方依赖不算风格自己的入口
    refs.add(ref);
  }
  return [...refs];
}

/** 抽出 index.html 里的**内联** `<script>` 正文（跳过外链 src 脚本），附大致起始行号。 */
function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;                    // 外链脚本，正文为空
    const body = m[2] || '';
    if (!body.trim()) continue;
    const startLine = html.slice(0, m.index).split('\n').length;  // `<script>` 所在行
    out.push({ attrs, body, startLine });
  }
  return out;
}

/** 把引用解析成 demo 目录内的真实路径；逃出 demo 目录 / 非法则返回 null。 */
function resolveRef(demoDir, ref) {
  const p = path.resolve(demoDir, ref);
  const rel = path.relative(demoDir, p);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return p;
}

// ── 失明守卫（防空转绿灯）────────────────────────────────────────────────────
const blindReasons = [];
const notes = [];
let slugs = [];

if (!fs.existsSync(STYLES_ROOT)) {
  blindReasons.push(`风格目录不存在：${STYLES_ROOT}`);
} else {
  let entries;
  try {
    entries = fs.readdirSync(STYLES_ROOT, { withFileTypes: true });
  } catch (e) {
    console.error(`读不到输入：无法列出风格目录 ${STYLES_ROOT}：${e.message}`);
    process.exit(2);
  }
  slugs = entries
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => n !== TEMPLATE && !n.startsWith('.'))
    .sort();
  if (slugs.length === 0) blindReasons.push(`枚举到 0 个风格（${STYLES_ROOT}）：路径/过滤变了？`);
}

// ── 逐风格：没有 film*.js 的，查它的真实入口 ──────────────────────────────────
const fails = [];
let withFilm = 0;
let withoutFilm = 0;
let scannedFiles = 0;

for (const slug of slugs) {
  const demoDir = path.join(STYLES_ROOT, slug, 'demo');

  // 有 film*.js ⇒ 探测看得见它 ⇒ OK（不判它是否真的声明了 aspects，那是另一个问题）
  if (demoFilmModules(demoDir).length > 0) { withFilm++; continue; }
  withoutFilm++;

  const htmlFile = path.join(demoDir, 'index.html');
  if (!fs.existsSync(htmlFile)) {
    notes.push(`styles/${slug}：无 demo/index.html，无法判定真实入口（跳过）`);
    continue;
  }
  let html;
  try {
    html = fs.readFileSync(htmlFile, 'utf8');
  } catch (e) {
    notes.push(`styles/${slug}：demo/index.html 读取失败（${e.message}）`);
    continue;
  }

  // ① 内联 <script> 正文直接读视口（如 halftone-dossier 那种内联入口）
  for (const sc of inlineScripts(html)) {
    for (const h of findViewportHits(sc.body)) {
      fails.push({
        slug,
        where: `demo/index.html:${sc.startLine + h.line - 1}`,
        kind: '内联脚本直接读视口',
        snippet: h.snippet,
      });
    }
  }

  // ② 被引用的本地 .js 模块读了视口
  for (const ref of localJsRefs(html)) {
    const file = resolveRef(demoDir, ref);
    if (!file || !fs.existsSync(file)) continue;
    scannedFiles++;
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch (e) {
      notes.push(`styles/${slug}：demo/${ref} 读取失败（${e.message}）`);
      continue;
    }
    // 展示路径用「相对风格目录」算，避免 `./main.js` 这类引用拼出 `demo/./main.js`
    const shown = path.relative(path.join(STYLES_ROOT, slug), file).split(path.sep).join('/');
    for (const h of findViewportHits(src)) {
      fails.push({
        slug,
        where: `${shown}:${h.line}`,
        kind: '入口模块读视口',
        snippet: h.snippet,
      });
    }
  }
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
const blind = blindReasons.length > 0;
const ok = !blind && fails.length === 0;

console.log('影片入口画幅声明闸门 —— 没有 film*.js 的风格，真实入口是否已自适应视口（而控制台探测看不见）');
console.log(`  风格源码: ${STYLES_ROOT}`);
console.log(`  风格 ${slugs.length} 个：有 film*.js ${withFilm} 个（探测可见 ⇒ OK）、`
  + `无 film*.js ${withoutFilm} 个（查真实入口，扫了 ${scannedFiles} 个被引用的本地 .js）\n`);

if (fails.length) {
  console.log(`✘ 发现 ${fails.length} 处「入口疑似已自适应，但控制台探测不到」：\n`);
  for (const f of fails) {
    console.log(`  styles/${String(f.slug).padEnd(20)} ${f.where.padEnd(24)} [${f.kind}] ${f.snippet}`);
    console.log(`      建议：请新建 demo/film.js 承载 FILM_META.aspects 声明`
      + `（见 MAINTAINING.md「让影片支持多比例」），否则控制台会误报『只支持 16:9』`);
  }
  console.log('');
}

if (notes.length) {
  console.log('\n备注（不影响结论）：');
  for (const n of notes) console.log(`   · ${n}`);
}

if (blind) {
  console.log('\n✘✘ 本闸门已**失明**，结论不可信：');
  for (const r of blindReasons) console.log(`   ✘ ${r}`);
} else if (fails.length === 0) {
  console.log(`✓ 无 film*.js 的 ${withoutFilm} 个风格，其真实入口都没有出现视口读取（探测看不见的风险当前不存在）`);
}

console.log(`\n[闸门] 影片入口画幅声明：风格 ${slugs.length} 个、无 film*.js ${withoutFilm} 个、`
  + `疑似自适应 ${fails.length} 处${blind ? '、**已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exit(ok ? 0 : 1);
