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
 *
 * ★ ③ 防空转绿灯（本项目硬纪律）：若**任一侧**解析出的集合为空 ⇒ **判 FAIL 并明说「本闸门已失明」**。
 *   绝不许因为「两边都空 ⇒ 无差异 ⇒ OK」。**检查器失明却报 OK，比不检查更危险。**
 *
 * ★ ④ 已知局限 / 会误报的边界：
 *   · 只做**存在性**比对，**不校验「用途」文字是否准确**（README 写错用途不会红）；
 *   · 正则解析对分发块的**写法**有假设（只认上面两种）—— 若改成路由表 / 数组 / 循环注册，
 *     本闸门会**失明**（解析出 0 条）⇒ 由③的防空转兜住（判 FAIL，而不是静默 OK）；
 *   · 参数路由归一化成 `:id` 后比较 ⇒ **不区分** `:id` 与 `:slug`（对「存在性」无影响）；
 *   · 只比 `{method, path}`，**不校验** handler 行为、请求/响应形状、状态码。
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
function parseServerRoutes(src) {
  const lines = src.split(/\r?\n/);
  let start = lines.findIndex((l) => /http\.createServer/.test(l));
  if (start < 0) start = 0;
  // 分发块的**结尾**是 404 兜底行（`p.startsWith('/api/')`）—— 它不是路由，不参与解析。
  let end = lines.findIndex((l, i) => i > start && /p\.startsWith\('\/api\/'\)/.test(l));
  if (end < 0) end = lines.length;

  const out = [];
  let curRe = null;
  for (let i = start; i < end; i++) {
    const line = lines[i];
    // 写法二之一：`let mm = /^\/api\/...$/.exec(p);`（记住当前正则，供紧随其后的 if 使用）
    const mRe = /(?:let\s+)?mm\s*=\s*(\/\^.*?\/)\.exec\(p\)/.exec(line);
    if (mRe) { curRe = mRe[1]; continue; }
    // 写法一：`if (p === '/api/x' && m === 'GET')`
    const m1 = /p\s*===\s*'(\/api\/[^']*)'\s*&&\s*m\s*===\s*'([A-Z]+)'/.exec(line);
    if (m1) { out.push({ method: m1[2], path: m1[1] }); continue; }
    // 写法二之二：`if (mm && m === 'GET')`（用上面记住的正则）
    const m2 = /if\s*\(\s*mm\s*&&\s*m\s*===\s*'([A-Z]+)'\s*\)/.exec(line);
    if (m2 && curRe) { out.push({ method: m2[1], path: regexToPath(curRe) }); continue; }
  }
  return out;
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
if (!fs.existsSync(SERVER)) {
  fails.push(`找不到 ${SERVER}`);
  blind.push('server.mjs（文件不存在）');
} else {
  serverRoutes = parseServerRoutes(fs.readFileSync(SERVER, 'utf8'));
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
const ok = !blind.length && !missingInReadme.length && !missingInServer.length;

// ── 输出 ───────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({
    server: { file: 'server.mjs', count: serverSet.size, routes: [...serverSet].sort() },
    readme: { file: 'README.md', count: readmeSet.size, routes: [...readmeSet].sort() },
    blind,
    missingInReadme,
    missingInServer,
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

  if (!blind.length && !missingInReadme.length && !missingInServer.length) {
    console.log('✓ 两边完全对应（server 的每条路由都在 README 表里，README 的每条也都真有实现）。\n');
  }

  console.log(`[闸门] HTTP 接口文档一致性：server ${serverSet.size} 条 / README ${readmeSet.size} 条；`
    + `缺登记 ${missingInReadme.length}、无实现 ${missingInServer.length}、失明源 ${blind.length} ${ok ? 'OK' : '✘'}`);
}
process.exitCode = ok ? 0 : 1;
