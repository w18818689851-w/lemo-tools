#!/usr/bin/env node
/**
 * scripts/check-lib-exports.mjs —— 「`lib/**` 可调用导出**零调用点**」闸门
 *   （★ 写作时本仓的一个 `check-*` 闸门；序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 为什么需要它（本闸门的存在理由）
 * ══════════════════════════════════════════════════════════════════════════════
 *   本会话刚抓到一个**真缺陷**：`lib/resources.mjs` 的 `mount()` **被导出、却零调用点**
 *   ⇒ 规格「下载 / 导入成功后自动建立连接」整体**没落地**，而当时所有闸门**全绿** ——
 *   因为判据只查「有没有被**导出**」，不查「有没有被**调用**」。
 *   这就是「**有导出 ≠ 有功能**」：导出只证明符号在，不证明任何入口真的用它。
 *   ★ 已修 `mount`、并给那条闸门加了「调用点」判据；但**同类病会再长出来** ——
 *     侦察（`_distill/新缺口狩猎-第4轮-2026-10-08.md` 面 4 / `总进度复盘…-2026-10-09.md` T1）
 *     发现 `lib/**` 里还有一批「**完全零调用**」的可调用导出（如 `dub-core.analyzeText`）。
 *   ⇒ 立此闸门，把「**lib 的导出到底有没有人调用**」从**人工 grep** 变成**机制**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（只做可机械判定的声称）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★ 设计纪律：一律**剥注释**（状态机，**保留字符串字面量**）后再数 —— 否则
 *     「注释里写一句 `foo()`」就满足它 ⇒ 判据恒真（= 摆设）。本项目反复治过这个病。
 *
 *   **判据① 逐个「可调用导出」数真实调用点**
 *     · 枚举 `lib/**​/*.mjs` 的**可调用导出**：`export (async) function <name>`、
 *       `export class <name>`、`export const <name> = (async)? (…) =>` / `= function`、
 *       `export { a, b as c }`。
 *       ★ **为什么只判「可调用」导出**：`export const KINDS = [...]` 这类**值**导出不存在
 *         「调用」形态 ⇒ 用 `name(` 判它必然恒假（假红）。值导出由别的闸门守
 *         （如 `check-resources` 判 `KINDS` / `STATES` 字面量）。
 *     · 对每个导出名，在**全部扫描根**里数调用点：正则 `\b<name>\s*\(`（**调用**形态）。
 *     · 扫描根 = `lib/**` + `scripts/**` + **仓根 `*.mjs`** + `web/**` + `test/**`。
 *       ★ 为什么要加「仓根 `*.mjs`」：`dub.mjs` / `lemo-make.mjs` 是本仓**真实调用方**
 *         （如 `buildTimeline` 只在仓根 `dub.mjs` 被调）；漏了它们会凭空多出 37 条假死导出。
 *     · ★ **只看调用，不看名字出现**（`mount` 当时名字出现 9 次、**一次都没被调用** —— 这正是
 *       本闸门存在的理由）：`mount: {...}` 是**属性键**、`opts.mount` 是**成员访问**，都不算调用点。
 *     · ★ **口径说明（与任务书的一处偏差，如实登记）**：任务书写「在 `lib/**`（排除它自己的
 *       **定义文件**）…数调用点」。本闸门实现为「**排除定义那一次出现**」（`function <name>(` /
 *       `async function <name>(`）而**不排除整个定义文件** —— 因为「仅在自身模块内被调用」的导出
 *       **不是死代码**：整文件排除会把 62 个这样的导出（如 `lib/dub-core.mjs:assColor`）误判为
 *       「死导出」，侦察报告也把这类明确称为「**过度导出**而非缺陷」。实测本口径恰好复现侦察的
 *       「7 条真死导出」（+1 条回调误报，见判据② 的 `BACKLOG` 末条）。
 *     · 调用点为 0 ⇒ 该导出是「零调用导出」。
 *     · ★ **本闸门不扫自己**（同 `check-ref-lines.mjs` 的纪律）：本文件里的 `BACKLOG` 键 / 理由都是
 *       **字符串字面量**，若参与扫描，理由文本里出现的 `<名字>(` 会把那条真死导出「洗活」（假阴）。
 *
 *   **判据② 两层语义（登记表 ⇒ 只列 ℹ；未登记 ⇒ FAIL 并点名）**
 *     · `BACKLOG` 登记表：已知的「零调用导出」逐条登记（每条带一句「为什么保留」）。
 *     · 落在 `BACKLOG` 里 ⇒ **只列 ℹ、不判 FAIL**；
 *     · **未登记**的零调用导出 ⇒ **FAIL 并点名 `<文件>:<导出名>`**。
 *     · ★ 这样**当前树可绿**（已知项都在表里），且**将来新长出来的**会被抓。
 *
 *   **判据③ 失明守卫（防空转绿灯）**
 *     · `lib/**` 读不到 / 解析到 **0 个**可调用导出 / **全部扫描根加起来一个调用点都没数到**
 *       / 扫描根一个文件都没有 ⇒ **FAIL 且明说「本闸门已失明」**，且失明时**不再输出判据①②**
 *       （在失明的树上它们只会刷屏、且会被误读成「模块违约」）。
 *     · ★ 为什么要有「一个调用点都没数到」这条：否则「枚举到 0 个导出」或「正则写坏」会让
 *       判据① 恒得空集 ⇒ 打印「零调用导出 0 条」+ exit 0（= 空集恒绿）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做语义理解**：只认固定写法（导出形态 / 调用形态），不解析 AST、不 import 被测模块
 *     （不引入副作用、不依赖网络）。
 *   · **不判运行期**：不保证调用点**真的会被执行到**（如写在永不进入的分支里）。
 *   · **不判值导出**（`export const X = …` 里的非函数值）—— 见判据① 的说明。
 *   · **已知盲区（如实写）**：
 *     ① **保留字符串** ⇒ 字符串字面量里出现 `name(` 也会被算作调用点（假阴：可能掩盖一条真死导出）；
 *     ② **对象方法简写 / 属性名**（`const o = { foo() {} }`）会被算作 `foo(` 调用点（同①，假阴）；
 *     ③ **`export { a as b }`** 无法从静态判断 `b` 是不是函数 ⇒ 一律当可调用导出判（本仓当前无此形态）；
 *     ④ **箭头函数 const** 用**启发式**识别（`= (…) =>` / `= async (…) =>` / `= function`）—— 写成别的
 *        包装形态可能漏枚举（假阴）；
 *     ⑤ **同名跨模块**：若 A 模块导出 `foo`、B 模块另有一个**非导出**的 `foo` 且被调用，会把 A 的
 *        `foo` 算作「有调用点」（假阴）。本仓当前无此形态。
 *     ⑥ ★ **回调式使用会被判成「零调用」（假阳）** —— 判据只看 `name(` 形态，所以把函数**当值传出去**
 *        （`slugs.map(styleDetail)` / `arr.filter(helper)` / `promise.then(handler)`）**不产生 `name(`** ⇒
 *        会被误报。★ 实测 249 个可调用导出里命中 **1 条**（`lib/briefs.mjs:styleDetail`），已按两层语义
 *        **补登进 `BACKLOG`**（附理由「以回调形式被使用」）。★ **将来再遇到同类** ⇒ 同样补登 `BACKLOG`，
 *        **不要**为了让闸门变绿去把判据放宽成「看名字出现」（那会把它最该抓的 `mount` 那种真死导出一起放过）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 验证（**临时树 + 覆盖点，全程不动真实仓**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**：真实仓 ⇒ **exit 0**（零调用导出全部已在 `BACKLOG` ⇒ 只列 ℹ）。
 *   · **变异**：临时树 `lib/` 里**新增一个谁都不调用的导出** ⇒ **exit 1** 并点名 `<文件>:<导出名>`。
 *   · **失明态**：`lib/` 读不到 / 0 个可调用导出 / 全根 0 个调用点 ⇒ **exit 1 +「本闸门已失明」**，
 *     且不输出判据①②。
 *   · 同一套断言写在 `test/gate-blindness.test.mjs` 的 `check-lib-exports` 用例里。
 *
 * 用法：node scripts/check-lib-exports.mjs [--json]
 * 环境变量：
 *   LEMO_TOOLS_ROOT  工具仓根（默认 `<脚本>/..`，与 `check-resources` / `check-llm-api` /
 *                    `check-doc-coverage` / `check-env-overrides` **同名同义**）—— 供**非破坏性**
 *                    变异验证（指向临时夹具树，绝不动真实仓）。
 * 退出码：0 = 全绿（无未登记的零调用导出、无失明）；
 *         1 = 有 FAIL（未登记的零调用导出），或**本闸门已失明**。
 *   ★ 本闸门**不产出「闸门自身异常」那个码**（读不到 `lib/` ⇒ 判据③ 失明、归 1）⇒ 头注释只声明
 *     上面两个码，与实现一致（`check-gate-self-claims` 判据① 要求「声明 == 实际」）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ★ 覆盖点：工具仓根（同名同义于 check-resources / check-llm-api / check-doc-coverage）。 */
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
const JSON_MODE = process.argv.includes('--json');

// ── BACKLOG：已登记的「零调用导出」（只列 ℹ、不判 FAIL）──────────────────────
//   键 = `<相对仓根的路径>:<导出名>`；值 = 「为什么保留」。
//   ★ 7 条来自侦察（`_distill/总进度复盘与剩余任务计划-2026-10-09.md` T1）；
//     末 1 条（`styleDetail`）是本闸门**复核补登**：它实际以**回调**形式被使用。
const BACKLOG = new Map(Object.entries({
  'lib/dub-core.mjs:analyzeText': '★ 已登记（侦察 C2）：文本分析链路预留接口，当前无调用方；保留为对外能力。',
  'lib/style-skill-reader.mjs:clearStyleSkillCache': '★ 已登记（侦察 C2）：缓存失效接口，供测试 / 将来热重载；当前无调用方。',
  'lib/dub.mjs:isAllowedExt': '★ 已登记：扩展名白名单判定，当前无调用方（保留为校验 API）。',
  'lib/dub.mjs:isAllowedUploadExt': '★ 本批新登记（此前从未登记）：上传扩展名白名单判定，当前无调用方。',
  'lib/setup.mjs:indexActions': '★ 本批新登记（此前从未登记）：安装计划按 id 建索引，当前无调用方。',
  'lib/style-dna-reader.mjs:hasStyleDna': '★ 本批新登记（此前从未登记）：风格 DNA 存在性判定，当前无调用方。',
  'lib/voices.mjs:voicesStatus': '★ 本批新登记（此前从未登记）：音色库状态汇总，当前无调用方。',
  'lib/briefs.mjs:styleDetail': '★ 复核补登：以**回调**形式 `slugs.map(styleDetail)` 被使用（不是「直接调用」形态）⇒ 实际在用，仅调用形态判据看不见。',
}));

// ── 剥注释（**保留字符串字面量**）—— 状态机；行号不变 ───────────────────────
//   ★ 顺序关键：**先判注释、再判引号** ⇒ 注释里的引号 / 反引号不会把状态机带偏。
function stripComments(src) {
  const out = src.split('');
  const n = src.length;
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0, q = null;
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (q) {
      if (c === '\\') { i += 2; continue; }
      if (c === q) { q = null; i++; continue; }
      i++; continue;
    }
    if (c === '/' && c2 === '/') { const s = i; while (i < n && src[i] !== '\n') i++; blank(s, i); continue; }
    if (c === '/' && c2 === '*') {
      const s = i; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(n, i + 2); blank(s, i); continue;
    }
    if (c === "'" || c === '"' || c === '`') { q = c; i++; continue; }
    i++;
  }
  return out.join('');
}

/** 递归收集 `dir` 下后缀属于 `exts` 的文件（`dir` 不存在 ⇒ 空数组）。 */
function walk(dir, exts, out = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

/** 仓根**非递归**的 `*.mjs`（`dub.mjs` / `lemo-make.mjs` / `server.mjs` / …）。 */
function rootMjs() {
  try {
    return fs.readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.mjs'))
      .map((e) => path.join(ROOT, e.name));
  } catch { return []; }
}

/** 该下标处的 `<name>(` 是否是**定义**（`function <name>(` / `async function <name>(`）。 */
function isDefinition(t, idx) {
  const before = t.slice(0, idx);
  const wm = /([A-Za-z_$][A-Za-z0-9_$]*)\s*$/.exec(before);
  if (!wm) return false;
  if (wm[1] === 'function') return true;
  if (wm[1] === 'async') {
    const wm2 = /([A-Za-z_$][A-Za-z0-9_$]*)\s*$/.exec(before.slice(0, before.length - wm[0].length));
    if (wm2 && wm2[1] === 'function') return true;
  }
  return false;
}

/** 枚举「可调用导出」的名字（`export (async) function|class`、箭头/函数表达式 const、`export {}`）。 */
function callableExports(code) {
  const set = new Set();
  for (const m of code.matchAll(/export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)) set.add(m[1]);
  for (const m of code.matchAll(/export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/g)) set.add(m[1]);
  for (const m of code.matchAll(/export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?function\b/g)) set.add(m[1]);
  for (const m of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      set.add((as[1] || as[0]).trim());
    }
  }
  return set;
}

// ── 收集扫描根文件 ───────────────────────────────────────────────────────────
const SELF_NAME = 'check-lib-exports.mjs';   // ★ 本闸门**不扫自己**（同 check-ref-lines 的纪律）
const LIB_FILES = walk(path.join(ROOT, 'lib'), ['.mjs']);
const SCAN_FILES = [...new Set([
  ...LIB_FILES,
  ...walk(path.join(ROOT, 'scripts'), ['.mjs']),
  ...rootMjs(),
  ...walk(path.join(ROOT, 'web'), ['.js', '.mjs', '.html']),
  ...walk(path.join(ROOT, 'test'), ['.mjs']),
])].filter((f) => path.basename(f) !== SELF_NAME);

const blind = [];   // string[]
const fails = [];   // { crit, detail }

// ── 判据③ 前置：读 lib/**、枚举导出 ─────────────────────────────────────────
const exportsByFile = new Map();   // absFile -> Set<name>
let exportTotal = 0;
if (LIB_FILES.length === 0) {
  blind.push(`\`${path.join(ROOT, 'lib')}\` 下读不到任何 \`.mjs\` ⇒ 一个导出都没枚举到`);
} else {
  for (const f of LIB_FILES) {
    const names = callableExports(stripComments(fs.readFileSync(f, 'utf8')));
    if (names.size) { exportsByFile.set(f, names); exportTotal += names.size; }
  }
  if (exportTotal === 0) blind.push(`扫了 ${LIB_FILES.length} 个 \`lib/**/*.mjs\`，却**枚举到 0 个**可调用导出（写法变了？）`);
}

// ── 判据① 数据：单遍数「调用点」────────────────────────────────────────────
const CALL_RE = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
const callCount = new Map();   // name -> count（不含定义那一次出现）
let totalCalls = 0;
let scanRead = 0;
for (const f of SCAN_FILES) {
  let txt;
  try { txt = stripComments(fs.readFileSync(f, 'utf8')); } catch { continue; }
  scanRead++;
  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(txt)) !== null) {
    if (isDefinition(txt, m.index)) continue;
    callCount.set(m[1], (callCount.get(m[1]) || 0) + 1);
    totalCalls++;
  }
}
if (blind.length === 0) {
  if (scanRead === 0) blind.push('全部扫描根加起来**一个文件都没读到**（路径变了？）');
  else if (totalCalls === 0) blind.push(`扫了 ${scanRead} 个文件，却**一个调用点都没数到**（\`name(\` 正则失效？）`);
}

// ── 判据①② 输出 ─────────────────────────────────────────────────────────────
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const registered = [];     // { key, why }
const unregistered = [];   // key
if (blind.length === 0) {
  for (const [f, names] of exportsByFile) {
    for (const name of names) {
      if (name === 'default') continue;
      if ((callCount.get(name) || 0) > 0) continue;
      const key = `${rel(f)}:${name}`;
      if (BACKLOG.has(key)) registered.push({ key, why: BACKLOG.get(key) });
      else unregistered.push(key);
    }
  }
  registered.sort((a, b) => (a.key < b.key ? -1 : 1));
  unregistered.sort();
  if (unregistered.length) {
    fails.push({
      crit: '②',
      detail: `**未登记的零调用导出** ${unregistered.length} 条（\`lib/**\` 里被导出、却在全仓**零调用点**）：\n`
        + unregistered.map((k) => `     ✘ ${k}`).join('\n')
        + `\n     · ★ 有导出 ≠ 有功能：这些符号没人调用，重构时会被当成「在用」。`
        + `\n     · 若**确属有意保留** ⇒ 登进本闸门的 \`BACKLOG\`（键 = \`<文件>:<导出名>\`，值 = 一句「为什么保留」）；`
        + `\n       否则请删掉导出、或把它接进真实调用点。`,
    });
  }
}

// ── 判据③ 失明守卫 ──────────────────────────────────────────────────────────
const blindGuard = blind.length > 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
if (JSON_MODE) {
  console.log(JSON.stringify({
    gate: 'check-lib-exports',
    root: ROOT,
    ok: !blindGuard && fails.length === 0,
    blind: blindGuard,
    blindReasons: blind,
    fails,
    callableExports: exportTotal,
    scanFiles: scanRead,
    totalCallSites: totalCalls,
    registered: registered.map((r) => r.key),
    unregistered,
  }, null, 2));
  process.exitCode = (blindGuard || fails.length) ? 1 : 0;
} else {
  console.log('lib/** 可调用导出「零调用点」闸门 —— 守 `lib/**` 的导出是否真的有人调用（★ 有导出 ≠ 有功能）');
  console.log('  判据: ① 逐导出数真实调用点（`\\b<name>\\s*\\(`，剥注释） | ② 两层语义（BACKLOG ⇒ 只列 ℹ；未登记 ⇒ FAIL） |');
  console.log('        ③ 失明守卫（防空转绿灯）');
  console.log(`  被测: ${ROOT}`);
  console.log(`  扫描: lib/**/*.mjs = ${exportTotal} 个可调用导出；扫描根 = ${scanRead} 个文件、合计 ${totalCalls} 个调用点`);
  console.log('');

  if (blindGuard) {
    console.log('✘✘ 本闸门已失明：');
    for (const b of blind) console.log(`   ✘ ${b}`);
    console.log('   ⇒ 「0 处违约」是假的，别信这个绿。请先修路径 / 写法，再信本闸门的结论。');
    console.log('   ⇒ 已失明 ⇒ 判据①② 本次**不输出**（判据③ 是失明守卫本身）。');
    console.log('');
    console.log('[闸门] lib 导出零调用点：已失明 ⇒ 一条判据都没可信地跑过 ✘');
    process.exitCode = 1;
  } else {
    if (registered.length) {
      console.log(`  ℹ 判据①·已登记的零调用导出 ${registered.length} 条（只列、不判 FAIL）：`);
      for (const r of registered) console.log(`     ℹ ${r.key} —— ${r.why}`);
    } else {
      console.log('  ✓ 判据①·零调用导出 0 条');
    }
    if (fails.length) {
      for (const f of fails) console.log(`\n   ✘ 判据${f.crit}  ${f.detail}`);
    } else {
      console.log(`  ✓ 判据②·未登记的零调用导出 0 条（可调用导出 ${exportTotal} 个，零调用 ${registered.length} 条已全部登记）`);
    }
    console.log(`\n[闸门] lib 导出零调用点：可调用导出 ${exportTotal} 个 · 零调用 ${registered.length + unregistered.length} 条`
      + `（已登记 ${registered.length} / 未登记 ${unregistered.length}） · 违约 ${fails.length} 处 ${fails.length ? '✘' : 'OK'}`);
    process.exitCode = fails.length ? 1 : 0;
  }
}
