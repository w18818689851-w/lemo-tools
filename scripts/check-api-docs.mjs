#!/usr/bin/env node
/**
 * scripts/check-api-docs.mjs —— **HTTP 接口**的「路由 ↔ 文档」一致性闸门
 *
 * ★ ① 为什么需要它（真实由来，2026-10-04）：
 *   本项目反复踩「**文档先于实现**」—— 注释/文档承诺了一个能力，代码里根本没有。
 *   最近一次是 `/api/dub/analyze` 的注释写着「也可由外部注入结果（source:'external'）」，
 *   而 `server.mjs` 里**完全没有 `analysis` 字样**，2026-10-04 才补齐实现。
 *   这类缺陷**读起来像已完成**，只能靠机械比对拦住。
 *   `scripts/check-cli-docs.mjs` 已为**命令行参数**做了对称的闸门（它自己就写着
 *   「★ 防『文档先于实现』」）；但 **HTTP 侧一直缺一个**：`server.mjs` 有 40+ 条 `/api` 分发，
 *   而 `README.md` 长期**一条路由都没列成表**（只散落在正文里被顺带提及）。本闸门即其 HTTP 对称版。
 *
 * ★ ② 判据（机械、可解释）：
 *   ① 解析 `server.mjs` 的**分发块**（`http.createServer(...)` 起、到 `p.startsWith('/api/')`
 *      的 **404 兜底行**止，兜底不算路由）→ `{method, path}` 集合。支持两种写法：
 *        · `if (p === '/api/x' && m === 'GET') return ...;`
 *        · `mm = /^\/api\/x\/([^/]+)$/.exec(p);` 紧随其后 `if (mm && m === 'GET') ...`
 *   ② 解析 `README.md` 里 `## HTTP 接口清单` 表格的 `| 方法 | 路径 | ... |` 行 → 同形状集合。
 *   ③ **双向**比对（参数路由两边都归一化成 `:id` 再比）：
 *        · server 有而 README 没有 ⇒ **FAIL**（新接口没登记）；
 *        · README 有而 server 没有 ⇒ **FAIL**（文档撒谎）。
 *   ④ **写法覆盖率守卫（2026-10-10 追加 —— 堵住一个**已实测**的静默漏）**：分发块里
 *      「**像在按 `/api` 路径分发**」的行（含 `/api/` 且含 `p ===` / `p.startsWith(` / `.exec(p)`），
 *      若**既不是写法一、也不是写法二** ⇒ **解析器看不见它** ⇒ 它既不会进 `serverSet`、
 *      也不会进③的双向比对 ⇒ **静默漏**（★ 这是「**单条**路由换了写法」的入口，如字面量
 *      `'/api/x'` → 模板串 `` `/api/x` `` / `p.startsWith('/api/x')`）⇒ 逐行点名 ⇒ **FAIL**。
 *
 * ★ ③ 防空转绿灯（本项目硬纪律）：若**任一侧**解析出的集合为空 ⇒ **判 FAIL 并明说「本闸门已失明」**。
 *   绝不许因为「两边都空 ⇒ 无差异 ⇒ OK」。**检查器失明却报 OK，比不检查更危险。**
 *
 * ★ ④ 已知局限 / 会误报的边界：
 *   · 只做**存在性**比对，**不校验「用途」文字是否准确**（README 写错用途不会红）；
 *   · 正则解析对分发块的**写法**有假设（只认上面两种）—— 若**整块**改成路由表 / 数组 / 循环注册，
 *     本闸门会**失明**（解析出 0 条）⇒ 由③的防空转兜住（判 FAIL，而不是静默 OK）；
 *     ★ **单条**路由换了写法（其余仍用旧写法 ⇒ **不**触发③的「全空」失明）由**判据④ 覆盖率守卫**兜住；
 *   · 判据④ 的**误报边界**：它把「`p.startsWith('/api/…')` 前缀守卫」也算「像在分发」⇒ 若将来
 *     在分发块里**有意**加一条**前缀守卫**（不是路由），会被它点名 ⇒ 届时把该行移出分发块、
 *     或收窄本判据（本项目当前分发块实测 0 条这种行，见 ⑤）；
 *   · 参数路由归一化成 `:id` 后比较 ⇒ **不区分** `:id` 与 `:slug`（对「存在性」无影响）；
 *   · 只比 `{method, path}`，**不校验** handler 行为、请求/响应形状、状态码。
 *
 * ★ ⑤ 验证（临时夹具 `<tmp>/scripts/` + `<tmp>/server.mjs` + `<tmp>/README.md`，全程不动真实仓）：
 *   · **阴性对照**：真实仓 / 最小夹具 ⇒ **exit 0**。
 *   · **③ 全空失明**：server 侧 0 条 / README 侧 0 条 ⇒ **exit 1 +「本闸门已**失明**」**
 *     （同一套断言也写在 `test/gate-blindness.test.mjs` 的 `check-api-docs` 用例里）。
 *   · **④ 覆盖率守卫（2026-10-10 实测，堵静默漏）**：
 *     - **未登记 + 不受支持的写法**（在真实 `server.mjs` 副本里加
 *       `if (p.startsWith('/api/p4cNewRoute') && m === 'GET') …`）⇒ 加之前闸门 **exit 0**
 *       （★ 静默漏 —— 它既没进 serverSet，也没进 README ⇒ 双向比对发现不了）；
 *       加判据④ 后 ⇒ **exit 1 并点名该行**。
 *     - **已登记 + 不受支持的写法**（把 `p === '/api/llm/services'` 的字面量改成模板串）⇒
 *       不加判据④ 时也会 exit 1，但报的是「**README 有、server 没有（文档撒谎）**」——**误导**；
 *       加判据④ 后报的是**真因**（该行写法解析器认不出）。
 *
 * ★ 路径**基于脚本自身位置推导**（`import.meta.url` → `..`），**不写死 `D:/lemo-tools`**：
 *   这样才能把 `server.mjs` / `README.md` / `scripts/` 一起拷到临时目录做**变异测试**
 *   （本项目教训：直接改真实数据做反向测试、中途被打断，假数据留在库里）。
 *
 * 用法：node scripts/check-api-docs.mjs [--json]
 * 退出码：**0 = 通过**（两向都无差异、且两侧都没失明）；**1 = 发现问题**（有差异，或任一侧失明）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SERVER = path.join(ROOT, 'server.mjs');
const README = path.join(ROOT, 'README.md');
const JSON_OUT = process.argv.includes('--json');

// ── 归一化：`:word` → `:id`（两侧都做，参数名不一致也能对上）────────
const normPath = (p) => String(p).trim().replace(/`/g, '').replace(/:[A-Za-z0-9_]+/g, ':id');
const routeKey = (r) => `${r.method} ${normPath(r.path)}`;

// ── 把 JS 正则字面量转成路由路径 ────────────────────────────────
//   '/^\\/api\\/jobs\\/([^/]+)$/'  →  '/api/jobs/:id'
function regexToPath(re) {
  let s = re.slice(1, -1);                              // 去掉首尾 `/`
  s = s.replace(/^\^/, '').replace(/\$$/, '');          // 去掉 ^ 与 $
  s = s.replace(/\\\//g, '/');                          // \/ → /
  s = s.replace(/\(\[\^\/\]\+\)/g, ':id');              // ([^/]+) → :id
  return s;
}

// ── 从 server.mjs 的分发块解析路由 ──────────────────────────────
//   ★ 返回 `consumed`（被解析器「认领」的行下标）+ 块范围 `blockStart`/`blockEnd`/`lines`
//     —— 供**判据④ 写法覆盖率守卫**（2026-10-10 追加）逐行找「像路由分发却没被认领」的行。
function parseServerRoutes(src) {
  const lines = src.split(/\r?\n/);
  let start = lines.findIndex((l) => /http\.createServer/.test(l));
  if (start < 0) start = 0;
  // 分发块的**结尾**是 404 兜底行（`p.startsWith('/api/')`）—— 它不是路由，不参与解析。
  let end = lines.findIndex((l, i) => i > start && /p\.startsWith\('\/api\/'\)/.test(l));
  if (end < 0) end = lines.length;

  const out = [];
  const consumed = new Set();
  let curRe = null;
  for (let i = start; i < end; i++) {
    const line = lines[i];
    // 写法二之一：`let mm = /^\/api\/...$/.exec(p);`（记住当前正则，供紧随其后的 if 使用）
    const mRe = /(?:let\s+)?mm\s*=\s*(\/\^.*?\/)\.exec\(p\)/.exec(line);
    if (mRe) { curRe = mRe[1]; consumed.add(i); continue; }
    // 写法一：`if (p === '/api/x' && m === 'GET')`
    const m1 = /p\s*===\s*'(\/api\/[^']*)'\s*&&\s*m\s*===\s*'([A-Z]+)'/.exec(line);
    if (m1) { out.push({ method: m1[2], path: m1[1] }); consumed.add(i); continue; }
    // 写法二之二：`if (mm && m === 'GET')`（用上面记住的正则）
    const m2 = /if\s*\(\s*mm\s*&&\s*m\s*===\s*'([A-Z]+)'\s*\)/.exec(line);
    if (m2 && curRe) { out.push({ method: m2[1], path: regexToPath(curRe) }); consumed.add(i); continue; }
  }
  return { routes: out, consumed, blockStart: start, blockEnd: end, lines };
}

// ── 从 README 的接口表解析路由 ──────────────────────────────────
function parseReadmeRoutes(src) {
  const out = [];
  for (const line of src.split(/\r?\n/)) {
    // | GET | `/api/x/:id` | 用途 | 同步 |
    const m = /^\|\s*(GET|HEAD|POST|PUT|PATCH|DELETE)\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (m && /^`?\/api\//.test(m[2].trim())) out.push({ method: m[1], path: m[2].trim() });
  }
  return out;
}

// ── 主流程 ─────────────────────────────────────────────────────
const fails = [];
const blind = [];

let serverRoutes = [];
let serverParse = { consumed: new Set(), blockStart: 0, blockEnd: 0, lines: [] };
if (!fs.existsSync(SERVER)) {
  fails.push(`找不到 ${SERVER}`);
  blind.push('server.mjs（文件不存在）');
} else {
  serverParse = parseServerRoutes(fs.readFileSync(SERVER, 'utf8'));
  serverRoutes = serverParse.routes;
}

let readmeRoutes = [];
if (!fs.existsSync(README)) {
  fails.push(`找不到 ${README}`);
  blind.push('README.md（文件不存在）');
} else {
  readmeRoutes = parseReadmeRoutes(fs.readFileSync(README, 'utf8'));
}

const serverSet = new Set(serverRoutes.map(routeKey));
const readmeSet = new Set(readmeRoutes.map(routeKey));

// ★ 防空转绿灯：任一侧为 0 条 ⇒ 失明 ⇒ FAIL（绝不因「两边都空」而 OK）
if (!serverSet.size) {
  blind.push('server.mjs 的分发块（解析出 0 条 /api 路由 —— 写法可能已改，或 http.createServer 段没找到）');
}
if (!readmeSet.size) {
  blind.push('README.md 的 `## HTTP 接口清单` 表（解析出 0 条 —— 表可能被删、或列序被改）');
}

const missingInReadme = [...serverSet].filter((k) => !readmeSet.has(k)).sort();
const missingInServer = [...readmeSet].filter((k) => !serverSet.has(k)).sort();

// ── 判据④ 写法覆盖率守卫（防「单条路由换了写法 ⇒ 静默漏」，2026-10-10 追加）────────
//   分发块里「像在按 /api 路径分发」的行（含 /api/ 且含 `p ===` / `p.startsWith(` / `.exec(p)`），
//   若**没被解析器认领**（既不是写法一、也不是写法二）⇒ 它既不会进 serverSet、也不会进双向比对
//   ⇒ 静默漏。⇒ 逐行点名。（★ 先把 `\/` 还原成 `/`，好让正则写法 `\/api\/` 也命中本守卫。）
const unparsedDispatch = [];
{
  const { consumed, blockStart, blockEnd, lines } = serverParse;
  for (let i = blockStart; i < blockEnd; i++) {
    if (consumed.has(i)) continue;
    const norm = lines[i].replace(/\\\//g, '/');
    if (!/\/api\//.test(norm)) continue;
    if (!/(\bp\s*===|\bp\s*\.startsWith\s*\(|\.exec\s*\(\s*p\s*\))/.test(norm)) continue;
    unparsedDispatch.push(`${i + 1}: ${lines[i].trim()}`);
  }
}

const ok = !blind.length && !missingInReadme.length && !missingInServer.length && !unparsedDispatch.length;

// ── 输出 ───────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({
    server: { file: 'server.mjs', count: serverSet.size, routes: [...serverSet].sort() },
    readme: { file: 'README.md', count: readmeSet.size, routes: [...readmeSet].sort() },
    blind,
    missingInReadme,
    missingInServer,
    unparsedDispatch,
    ok,
  }, null, 2));
} else {
  console.log('HTTP 接口 · 路由 ↔ 文档 一致性\n');
  console.log(`  server.mjs 分发块：${serverSet.size} 条 /api 路由`);
  console.log(`  README.md 接口表：${readmeSet.size} 条\n`);

  if (blind.length) {
    console.log(`✘ 本闸门已**失明** —— 下列来源解析出 0 条，它的「无差异」结论是假的：`);
    for (const b of blind) console.log(`  ✘ ${b}`);
    console.log('  修法：确认该来源的写法/表格结构，或同步修改本闸门的解析；在此之前不要相信它的结论。\n');
  }

  if (unparsedDispatch.length) {
    console.log(`✘ 判据④·写法覆盖率守卫：分发块里有 ${unparsedDispatch.length} 行**像在按 /api 路径分发、`
      + '却没被解析器认出来**（写法一/二之外）⇒ 它既不会进双向比对、也可能是一条**静默漏**的路由：');
    for (const l of unparsedDispatch) console.log(`  ✘ server.mjs 第 ${l}`);
    console.log('  修法：把它改成写法一（`p === \'/api/x\' && m === \'GET\'`）或写法二（`mm = /^\\/api\\/x$/`）'
      + '；若它**不是**路由（如前缀守卫）⇒ 请移出分发块，或收窄本闸门的识别。\n');
  }

  if (missingInReadme.length) {
    console.log(`✘ server 有、README 没有（新接口没登记）${missingInReadme.length} 条：`);
    for (const k of missingInReadme) console.log(`  ✘ ${k}`);
    console.log('  修法：把这条补进 README 的 `## HTTP 接口清单` 表（方法 / 路径 / 用途 / 类型）。\n');
  }

  if (missingInServer.length) {
    console.log(`✘ README 有、server 没有（文档撒谎）${missingInServer.length} 条：`);
    for (const k of missingInServer) console.log(`  ✘ ${k}`);
    console.log('  修法：从 README 表里删掉它，或去 server.mjs 补上实现 —— 取决于哪边才是真需求。\n');
  }

  if (!blind.length && !missingInReadme.length && !missingInServer.length && !unparsedDispatch.length) {
    console.log('✓ 两边完全对应（server 的每条路由都在 README 表里，README 的每条也都真有实现）。\n');
  }

  console.log(`[闸门] HTTP 接口文档一致性：server ${serverSet.size} 条 / README ${readmeSet.size} 条；`
    + `缺登记 ${missingInReadme.length}、无实现 ${missingInServer.length}、失明源 ${blind.length}、`
    + `未认领分发 ${unparsedDispatch.length} ${ok ? 'OK' : '✘'}`);
}
process.exitCode = ok ? 0 : 1;
