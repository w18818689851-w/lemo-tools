#!/usr/bin/env node
/**
 * scripts/check-resources.mjs —— 「通用资源检测适配模块」契约闸门
 *   （★ 写作时本仓的一个 `check-*` 闸门；序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 定位
 * ══════════════════════════════════════════════════════════════════════════════
 *   本闸门守 `lib/resources.mjs` 的**对外契约** —— 契约真值 = **仓内契约文档**
 *   `_distill/资源检测适配模块-接口规格-2026-10-09.md`（KINDS / STATES / 注册表 schema / 全部导出签名）。
 *   本模块是「环境 / 依赖 / 组件库 / 资源文件 / 本地模型 / 插件」的**唯一**扫描→版本校验→本地优先挂载→
 *   缺失提示→一键下载→自动配置→手动导入兜底入口；上层业务**不再自写**检测 / 下载逻辑（规格 §一）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 由来
 * ══════════════════════════════════════════════════════════════════════════════
 *   本模块的**对外契约**（导出名 / 两个常量字面量 / 注册表 schema / 纯函数真值 / 路径安全 / 非 C 盘）
 *   一旦漂移，**面板与全部调用方都会静默出错**：少一个导出 ⇒ 调用方 import 到 `undefined`；
 *   改了 `KINDS` / `STATES` 字面量 ⇒ 前端按状态渲染的分支全错；注册表 schema 破 ⇒ 扫描期才炸；
 *   `dirFor` 失去白名单 ⇒ **路径穿越**（能把文件写到规划目录外）。
 *   ⇒ 立此闸门，把「共享规格里的口头契约」变成**机器守卫**
 *     （本项目铁律：**新模块要有闸门守它的关键契约**）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 判据（**只做可机械判定的声称**；宁可少做几条，也不要误报）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★ 设计纪律：判据①/② 是**静态读码**（不 import —— 不引入副作用 / 不依赖网络），
 *     「代码体」一律用**剥注释（+字符串）后**的文本判（本项目反复治过「判据可被注释满足」的假绿）。
 *     判据③~⑥ **动态 import** 模块后读**运行时真值**（注册表 schema 合法 / 纯函数真值表 / 路径安全 / 非 C 盘）
 *     —— 因为这几条**必须**看运行期对象，静态猜文本会漏（如 RESOURCES 由工厂函数拼出）。
 *
 *   **判据① 导出齐全**：静态解析 `lib/resources.mjs` 源码（识别 `export (async) function|const|let|var|class
 *     <name>` / `export { … }`（含 `as`）/ `export default`），断言契约 §六 列出的**全部导出**都在：
 *     `KINDS` `STATES` `resourceRoot` `dirFor` `dirPlan` `RESOURCES` `scanAll` `scanOne`
 *     `classify` `satisfies` `planDownloads` `runDownload` `importResource` `mount`（**共 14 个**）
 *     ⇒ 缺谁**点名谁**。
 *
 *   **判据② 常量逐字**：从**剥注释（保留字符串）**的源码里切出 `KINDS` / `STATES` 的数组字面量，
 *     断言逐字等于契约 §二 / §四：
 *       · `KINDS`  = `['env','dep','model','asset','plugin']`
 *       · `STATES` = `['ready','missing','corrupt','version-mismatch','path-abnormal']`
 *     ⇒ 多一个 / 少一个 / 改一个字都 FAIL 并点名差额。
 *
 *   **判据③ 注册表 schema 合法**（★ **动态 import** 读 `RESOURCES` 真值）：`RESOURCES` 的**每条**必须：
 *       · `id` 匹配 `^[a-z0-9][a-z0-9._-]*$`（防路径穿越，规格 §九.4）；
 *       · `kind ∈ KINDS`；`bundled` 布尔；`required` 布尔；`label` 非空字符串；
 *       · `detect.via ∈ {'env','custom'}`；
 *     且 `id` **全局唯一**。⇒ 违规逐条点名（id + 违规项）。
 *
 *   **判据④ 纯函数真值表**（★ 动态 import 后断言）：
 *       · `classify({found:false}, {})            === 'missing'`
 *       · `classify({found:true,executable:true,version:'7.1'},{want:'>=6.0'}) === 'ready'`
 *       · `classify({found:true,executable:false},{}) === 'corrupt'`
 *       · `classify({found:true,executable:true,version:'5.0'},{want:'>=6.0'}) === 'version-mismatch'`
 *       · `classify({found:true,pathAbnormal:true},{}) === 'path-abnormal'`
 *       · `satisfies('7.1','>=6.0') === true` 且 `satisfies('5.0','>=6.0') === false`
 *     ⇒ 任一条不符即 FAIL 并点名（附实测值）。
 *
 *   **判据⑤ 路径安全**：`dirFor('dep','../../etc')` **必须抛**（防路径穿越，规格 §九.4）——
 *     不抛 ⇒ FAIL。★ 另抽查 `'..'` / `'a/b'`（同样应抛）。
 *
 *   **判据⑥ 非 C 盘**：`resourceRoot()` 的解析结果**不得**以 `C:` / `C:\` 开头（本项目硬规则 B）——
 *     命中 ⇒ FAIL 并打印实测根。
 *
 *   **判据⑦ 失明守卫（防空转绿灯）**：读不到 `lib/resources.mjs` / 剥注释后代码体为空 /
 *     `RESOURCES` 为空 ⇒ **FAIL 且明说「本闸门已失明」**，且失明时**不再输出判据①~⑥**（在失明的树上
 *     它们只会刷屏、且会被误读成「模块违约」）。★ 判据⑦ 是**失明守卫本身**，故不与①~⑥ 并列编号。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做语义理解**：判据全部基于**固定写法**的锚点（导出形态 / 数组字面量 / 运行时对象）。
 *   · **不判运行期行为**：`runDownload` / `importResource` / `mount` / `scanAll` 的**真实**下载 / 挂载 /
 *     起 WSL 行为**不测**（那要真下载、真起 WSL、有副作用）—— 由 `test/resources.test.mjs` 用桩 / 注入覆盖。
 *   · **不判** `ResourceStatus` 的每个字段（只判契约明列的关键项；宁可少判不误报）。
 *   · **已知盲区（如实写）**：
 *     ① 判据① 只看**静态导出形态** —— 若有人用 `export * from './x.mjs'` 间接导出，本闸门看不见（假阴）；
 *     ② 判据③ 若 `RESOURCES` 用**工厂函数在运行期拼表**、或动态 import 抛错 ⇒ 判据③~⑥ 无法执行，
 *        报 **FAIL**（`无法动态 import`）而非静默绿灯；
 *     ③ 判据④ 只验契约明列的**那几条**真值 —— 更细的版本语义（`^` 预发布号等）由 `test/` 覆盖；
 *     ④ 判据⑤ 只抽查 3 个穿越样本，不穷举全部非法 id 形态。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑤ 验证（**临时副本 + 覆盖点，全程不动真实模块**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**：真实 `lib/resources.mjs` ⇒ **exit 0**（判据①~⑥ 全过、无失明）。
 *   · **变异 A（判据①）**：删掉某导出（如把 `export function mount` 的 `export ` 去掉）⇒ **exit 1** 并点名 `mount`。
 *   · **变异 B（判据②）**：把 `STATES` 改一个字（如 `'ready'` → `'redy'`）⇒ **exit 1** 并点名差额。
 *   · **变异 C（判据③）**：给某条 `RESOURCES` 的 `kind` 改成 KINDS 外的值 ⇒ **exit 1** 并点名该 id。
 *   · **变异 D（判据⑤）**：让 `dirFor` 不再校验 id（直接 `path.join`）⇒ **exit 1** 并点名路径穿越。
 *   · **失明态**：模块文件缺失 / `RESOURCES` 为空 ⇒ **exit 1 + 「本闸门已失明」**，且不输出判据①~⑥。
 *   ★ 变异验证用 `LEMO_TOOLS_ROOT` 指向 `D:/lemo-tmp/res-mut/` 下的**整棵 lib 副本**（非破坏性）。
 *
 * 用法：node scripts/check-resources.mjs [--json]
 * 环境变量：
 *   LEMO_TOOLS_ROOT  工具仓根（默认 `<脚本>/..`，与 `check-llm-api` / `check-doc-coverage` /
 *                    `check-env-overrides` **同名同义**）—— 被测模块 = `<LEMO_TOOLS_ROOT>/lib/resources.mjs`，
 *                    供**非破坏性变异验证**（指向临时夹具树，绝不动真实模块）。
 * 退出码：0 = 全绿（判据①~⑥ 全过、无失明）；
 *         1 = 有 FAIL（契约不符），或**本闸门已失明**。
 *
 * ★ 本闸门**不产出「闸门自身异常」那个码**（契约里「前置不可用」的形态在此不存在：读不到模块 ⇒
 *   判据⑦ 失明、动态 import 抛错 ⇒ 判据③~⑥ FAIL，二者都归 1）⇒ 头注释只声明上面两个码，与实现一致
 *   （`check-gate-self-claims` 判据① 要求「声明 == 实际」，多声明一个从不出现的码会被它判 FAIL）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ★ 覆盖点：工具仓根（同名同义于 check-llm-api / check-doc-coverage / check-env-overrides）。 */
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
const MODULE_REL = 'lib/resources.mjs';
const MODULE = path.join(ROOT, 'lib', 'resources.mjs');
const JSON_MODE = process.argv.includes('--json');

// ── 契约真值（改这里 = 改契约，须**先**改契约文档）──────────────────────────
const REQUIRED_EXPORTS = ['KINDS', 'STATES', 'resourceRoot', 'dirFor', 'dirPlan', 'RESOURCES',
  'scanAll', 'scanOne', 'classify', 'satisfies', 'planDownloads', 'runDownload', 'importResource', 'mount'];
const KINDS_EXPECTED = ['env', 'dep', 'model', 'asset', 'plugin'];
const STATES_EXPECTED = ['ready', 'missing', 'corrupt', 'version-mismatch', 'path-abnormal'];
/** 资源 id 白名单（防路径穿越，规格 §九.4）。 */
const ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
const DETECT_VIA = ['env', 'custom'];

// ── ★ 剥注释（**保留字符串字面量**）—— 状态机；行号不变 ─────────────────────
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

// ── ★ 剥注释 + 字符串（状态机；行号不变）—— 「代码体」用 ─────────────────────
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', '']);
const REGEX_PREV_WORD = ['return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'void', 'delete', 'instanceof', 'new', 'yield', 'await', 'throw'];
function codeOnly(src) {
  const out = src.split('');
  const n = src.length;
  const stack = [];
  const top = () => (stack.length ? stack[stack.length - 1].t : 'code');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0, prevSig = '', prevWord = '';
  while (i < n) {
    const c = src[i], c2 = src[i + 1], t = top();
    if (t === 'code' || t === 'expr') {
      if (c === "'") { stack.push({ t: 'sq' }); i++; continue; }
      if (c === '"') { stack.push({ t: 'dq' }); i++; continue; }
      if (c === '`') { stack.push({ t: 'tpl' }); i++; continue; }
      if (c === '/' && c2 === '/') { const s = i; while (i < n && src[i] !== '\n') i++; blank(s, i); continue; }
      if (c === '/' && c2 === '*') {
        const s = i; i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i = Math.min(n, i + 2); blank(s, i); continue;
      }
      if (c === '/' && (REGEX_PREV.has(prevSig) || REGEX_PREV_WORD.includes(prevWord))) { stack.push({ t: 'regex' }); i++; continue; }
      if (t === 'expr') {
        if (c === '{') stack[stack.length - 1].depth++;
        else if (c === '}') {
          if (stack[stack.length - 1].depth === 0) { stack.pop(); prevSig = '`'; i++; continue; }
          stack[stack.length - 1].depth--;
        }
      }
      if (/\s/.test(c)) { if (c === '\n') prevSig = ''; i++; continue; }
      prevSig = c;
      const wm = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
      prevWord = wm ? wm[0] : '';
      i++; continue;
    }
    if (t === 'sq' || t === 'dq') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if ((t === 'sq' && c === "'") || (t === 'dq' && c === '"')) { stack.pop(); prevSig = "'"; i++; continue; }
      blank(i, i + 1); i++; continue;
    }
    if (t === 'regex') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if (c === '[') { let j = i + 1; while (j < n && src[j] !== ']') { if (src[j] === '\\') j++; j++; } blank(i, Math.min(n, j + 1)); i = Math.min(n, j + 1); continue; }
      if (c === '/') { stack.pop(); prevSig = '/'; i++; continue; }
      blank(i, i + 1); i++; continue;
    }
    // tpl
    if (c === '\\') { blank(i, i + 2); i += 2; continue; }
    if (c === '`') { stack.pop(); prevSig = '`'; i++; continue; }
    if (c === '$' && c2 === '{') { blank(i, i + 2); stack.push({ t: 'expr', depth: 0 }); prevSig = '{'; i += 2; continue; }
    blank(i, i + 1); i++; continue;
  }
  return out.join('');
}

/** 配平方括号：`openIdx` 是 `[` 的下标，返回匹配 `]` 的下标（找不到 ⇒ -1）。 */
function matchBracket(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** 收集模块导出的名字（`export (async) function|const|… <name>` / `export { … }` / `export default`）。 */
function exportedNames(code) {
  const set = new Set();
  for (const m of code.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)) set.add(m[1]);
  for (const m of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      set.add((as[1] || as[0]).trim());
    }
  }
  for (const _ of code.matchAll(/export\s+default\b/g)) set.add('default');
  return set;
}

/**
 * 切出 `export const <name> = (包装调用)? [ … ]` 里数组字面量的**区间** `{start,end}`（`[` / `]` 的下标）。
 * ★ 在**剥注释+字符串**的代码体上跑（字符串已剥成空格 ⇒ `[` `]` 不会被串内字符带偏）；
 *   与 `noComment` 逐字符同长同下标 ⇒ 区间可直接去 `noComment` 上取**字符串字面量**。
 * 找不到 ⇒ `null`（交由失明守卫）。
 */
function arrayBounds(code, name) {
  const m = new RegExp(`export\\s+const\\s+${name}\\s*=`).exec(code);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < code.length && code[i] !== '[') {
    // 只允许跳过包装调用（标识符 / 点 / 括号 / 空白）；撞上别的字符说明形态不认识
    if (/[A-Za-z0-9_$.\s(]/.test(code[i])) { i++; continue; }
    return null;
  }
  if (i >= code.length) return null;
  const close = matchBracket(code, i);
  return close < 0 ? null : { start: i, end: close };
}

/** 从**剥注释（保留字符串）**的 `noComment` 的 `[start,end]` 区间里抽字符串字面量内容（数组项）。 */
function stringItemsIn(noComment, bounds) {
  const inner = noComment.slice(bounds.start + 1, bounds.end);
  return [...inner.matchAll(/['"]([^'"]*)['"]/g)].map((x) => x[1]);
}

/** 把注册表（数组 / 对象 map 两形态）归一为**条目数组**（对象 map ⇒ 用键补 `id`）。 */
function normalizeRegistry(reg) {
  if (Array.isArray(reg)) return reg.map((e) => (e && typeof e === 'object' ? e : {}));
  if (reg && typeof reg === 'object') {
    return Object.entries(reg).map(([k, v]) => (v && typeof v === 'object'
      ? (typeof v.id === 'string' ? v : { ...v, id: k })
      : { id: k }));
  }
  return null;
}

// ── 读被测模块 ───────────────────────────────────────────────────────────────
const fails = [];   // { crit, detail }
const blind = [];   // string[]
let raw = null;
try {
  raw = fs.readFileSync(MODULE, 'utf8');
} catch (e) {
  blind.push(`读不到被测模块 \`${MODULE}\`（${(e && e.message) || e}）⇒ 一条契约都没检查`);
}

let code = '';        // 剥注释+字符串后的代码体
let noComment = '';   // 只剥注释（保留字符串）
if (raw !== null) {
  code = codeOnly(raw);
  noComment = stripComments(raw);
  if (code.trim() === '') blind.push('`lib/resources.mjs` 剥注释/字符串后是**空的**（写法变了？）⇒ 本闸门已失明');
}

let exportsFound = [];
let resourcesCount = 0;
let rootResolved = null;

// ── 判据①：导出齐全 ─────────────────────────────────────────────────────────
if (blind.length === 0) {
  const exported = exportedNames(code);
  exportsFound = [...exported];
  const missing = REQUIRED_EXPORTS.filter((n) => !exported.has(n));
  if (missing.length) {
    fails.push({
      crit: '①',
      detail: `契约 §六 要求的导出缺失：${missing.join(' / ')}（★ 应导出全部 ${REQUIRED_EXPORTS.length} 个：`
        + `${REQUIRED_EXPORTS.join(', ')}；当前导出：${exportsFound.join(', ') || '（无）'}）`,
    });
  }
}

// ── 判据②：常量逐字 ─────────────────────────────────────────────────────────
if (blind.length === 0) {
  for (const [name, expected] of [['KINDS', KINDS_EXPECTED], ['STATES', STATES_EXPECTED]]) {
    const b = arrayBounds(code, name);
    if (b === null) { blind.push(`切不出 \`${name}\` 的数组字面量（写法变了？）⇒ 判据② 空转`); continue; }
    const got = stringItemsIn(noComment, b);
    if (got.join('|') !== expected.join('|')) {
      fails.push({
        crit: '②',
        detail: `\`${name}\` 与契约不一致：\n     · 契约：${JSON.stringify(expected)}\n     · 实测：${JSON.stringify(got)}`,
      });
    }
  }
}

// ── 动态 import（判据③~⑥ 的真值来源）────────────────────────────────────────
let mod = null;
let importErr = null;
if (blind.length === 0) {
  try {
    mod = await import(pathToFileURL(MODULE).href);
  } catch (e) {
    importErr = e;
  }
  if (importErr) {
    fails.push({
      crit: '③~⑥',
      detail: `无法动态 import 被测模块 \`${MODULE}\`（${(importErr && importErr.message) || importErr}）`
        + ' ⇒ 注册表 schema / 纯函数真值表 / 路径安全 / 非 C 盘**无法验证**',
    });
  }
}

// ── 判据③：注册表 schema 合法（动态 import 读 RESOURCES 真值）────────────────
if (mod) {
  const list = normalizeRegistry(mod.RESOURCES);
  if (list === null) {
    blind.push('动态 import 后取不到 `RESOURCES`（不是数组 / 对象 map）⇒ 判据③ 空转');
  } else if (list.length === 0) {
    blind.push('`RESOURCES` **为空**（注册表没有一条资源）⇒ 判据③ 空转（防空转绿灯）');
  } else {
    resourcesCount = list.length;
    const seen = new Map();
    const bad = [];
    for (const e of list) {
      const id = e && e.id;
      const probs = [];
      if (typeof id !== 'string' || !ID_RE.test(id)) probs.push(`id 不合法（须匹配 ${ID_RE}，实测 ${JSON.stringify(id)}）`);
      if (!KINDS_EXPECTED.includes(e && e.kind)) probs.push(`kind 不在 KINDS 内（实测 ${JSON.stringify(e && e.kind)}）`);
      if (typeof e.bundled !== 'boolean') probs.push('bundled 不是布尔');
      if (typeof e.required !== 'boolean') probs.push('required 不是布尔');
      if (typeof e.label !== 'string' || e.label.trim() === '') probs.push('label 非空字符串不满足');
      const via = e && e.detect && e.detect.via;
      if (!DETECT_VIA.includes(via)) probs.push(`detect.via 不在 {'env','custom'} 内（实测 ${JSON.stringify(via)}）`);
      if (probs.length) bad.push(`     · ${id || '(无 id)'}：${probs.join('；')}`);
      if (typeof id === 'string') seen.set(id, (seen.get(id) || 0) + 1);
    }
    const dup = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
    if (dup.length) bad.push(`     · id 不唯一（重复 ${dup.length} 个）：${dup.join(' / ')}`);
    if (bad.length) {
      fails.push({
        crit: '③',
        detail: `\`RESOURCES\` 有 ${bad.length} 处 schema 违规（契约 §五）：\n${bad.join('\n')}`,
      });
    }
  }
}

// ── 判据④：纯函数真值表 ─────────────────────────────────────────────────────
if (mod) {
  const mism = [];
  const check = (label, fn, expect) => {
    let got;
    try { got = fn(); } catch (e) { got = `(抛: ${(e && e.message) || e})`; }
    if (got !== expect) mism.push(`     · ${label} ⇒ 期望 ${JSON.stringify(expect)}，实测 ${JSON.stringify(got)}`);
  };
  if (typeof mod.classify !== 'function') mism.push('     · classify 不是函数');
  if (typeof mod.satisfies !== 'function') mism.push('     · satisfies 不是函数');
  if (typeof mod.classify === 'function') {
    check("classify({found:false},{})", () => mod.classify({ found: false }, {}), 'missing');
    check("classify({found:true,executable:true,version:'7.1'},{want:'>=6.0'})",
      () => mod.classify({ found: true, executable: true, version: '7.1' }, { want: '>=6.0' }), 'ready');
    check("classify({found:true,executable:false},{})", () => mod.classify({ found: true, executable: false }, {}), 'corrupt');
    check("classify({found:true,executable:true,version:'5.0'},{want:'>=6.0'})",
      () => mod.classify({ found: true, executable: true, version: '5.0' }, { want: '>=6.0' }), 'version-mismatch');
    check('classify({found:true,pathAbnormal:true},{})', () => mod.classify({ found: true, pathAbnormal: true }, {}), 'path-abnormal');
  }
  if (typeof mod.satisfies === 'function') {
    check("satisfies('7.1','>=6.0')", () => mod.satisfies('7.1', '>=6.0'), true);
    check("satisfies('5.0','>=6.0')", () => mod.satisfies('5.0', '>=6.0'), false);
  }
  if (mism.length) {
    fails.push({ crit: '④', detail: `纯函数真值表不符（契约 §六）：\n${mism.join('\n')}` });
  }
}

// ── 判据⑤：路径安全（dirFor 穿越必须抛）──────────────────────────────────────
if (mod) {
  const trav = ['../../etc', '..', 'a/b'];
  const leaked = [];
  for (const id of trav) {
    if (typeof mod.dirFor !== 'function') { leaked.push(`     · dirFor 不是函数`); break; }
    let threw = false, got;
    try { got = mod.dirFor('dep', id); } catch { threw = true; }
    if (!threw) leaked.push(`     · dirFor('dep', ${JSON.stringify(id)}) **没抛** ⇒ 返回 ${JSON.stringify(got)}（路径穿越风险）`);
  }
  if (leaked.length) {
    fails.push({ crit: '⑤', detail: `\`dirFor\` 未拒绝非法 id（规格 §九.4 要求白名单正则 + 抛）：\n${leaked.join('\n')}` });
  }
}

// ── 判据⑥：非 C 盘 ──────────────────────────────────────────────────────────
if (mod) {
  let root;
  try { root = mod.resourceRoot(); } catch (e) { root = `(抛: ${(e && e.message) || e})`; }
  rootResolved = root;
  if (typeof root !== 'string' || /^[cC]:/.test(root)) {
    fails.push({
      crit: '⑥',
      detail: `\`resourceRoot()\` 解析到 C 盘（本项目硬规则 B：资源根必须在非 C 盘）⇒ 实测 ${JSON.stringify(root)}`,
    });
  }
}

// ── 判据⑦：失明守卫 ─────────────────────────────────────────────────────────
const blindGuard = blind.length > 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
if (JSON_MODE) {
  console.log(JSON.stringify({
    gate: 'check-resources',
    module: MODULE,
    ok: !blindGuard && fails.length === 0,
    blind: blindGuard,
    blindReasons: blind,
    fails,
    exports: exportsFound,
    resourcesCount,
    root: rootResolved,
  }, null, 2));
  process.exitCode = (blindGuard || fails.length) ? 1 : 0;
} else {
  console.log('通用资源检测适配模块契约闸门 —— 守 `lib/resources.mjs` 与仓内契约 `_distill/资源检测适配模块-接口规格-2026-10-09.md`');
  console.log('  判据: ① 导出齐全（14 个） | ② 常量逐字（KINDS/STATES） | ③ 注册表 schema 合法（动态 import 读 RESOURCES） |');
  console.log('        ④ 纯函数真值表（classify/satisfies） | ⑤ 路径安全（dirFor 穿越必须抛） | ⑥ 非 C 盘（resourceRoot） |');
  console.log('        ⑦ 失明守卫（防空转绿灯）');
  console.log(`  被测: ${MODULE}`);
  console.log(`  扫描: 剥注释+字符串后 ${code.split('\n').length} 行代码体；剥注释（留字符串）后 ${noComment.split('\n').length} 行`);
  console.log('');

  if (blindGuard) {
    console.log('✘✘ 本闸门已失明：');
    for (const b of blind) console.log(`   ✘ ${b}`);
    console.log('   ⇒ 「0 处违约」是假的，别信这个绿。请先修路径 / 写法，再信本闸门的结论。');
    console.log('   ⇒ 已失明 ⇒ 判据①~⑥ 本次**不输出**（在失明的树上它们只会刷屏；判据⑦ 是失明守卫本身）。');
    console.log('');
    console.log('[闸门] 资源检测适配模块：已失明 ⇒ 一条判据都没可信地跑过 ✘');
    process.exitCode = 1;
  } else {
    if (fails.length) {
      console.log(`✘ 判据①~⑥·契约不符 ${fails.length} 处：\n`);
      for (const f of fails) console.log(`   ✘ 判据${f.crit}  ${f.detail}`);
      console.log('\n   ↳ 修法：让 `lib/resources.mjs` 满足契约（仓内契约 `_distill/资源检测适配模块-接口规格-2026-10-09.md`）；');
      console.log('     若**契约本身**要改，请先改契约文档、再同步改本闸门的常量（改常量 = 改契约）。');
    } else {
      console.log('✓ 判据①~⑥·`lib/resources.mjs` 满足契约（导出齐全、常量逐字、注册表 schema 合法、');
      console.log('   纯函数真值表正确、dirFor 拒绝路径穿越、resourceRoot 在非 C 盘）');
    }
    console.log(`\n[闸门] 资源检测适配模块：导出 ${REQUIRED_EXPORTS.length} 符号 · 注册表 ${resourcesCount} 条 · `
      + `根 ${rootResolved === null ? '(未取)' : rootResolved} · 违约 ${fails.length} 处 ${fails.length ? '✘' : 'OK'}`);
    process.exitCode = fails.length ? 1 : 0;
  }
}
