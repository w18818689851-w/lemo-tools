#!/usr/bin/env node
/**
 * scripts/check-llm-api.mjs —— 「LLM 配置契约」闸门
 *   （★ **写作时**本仓第 42 个 `check-*` 闸门；★ 序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 由来
 * ══════════════════════════════════════════════════════════════════════════════
 *   本批新增开放式 LLM 配置模块 `lib/llm-api.mjs`（不限厂商 / 部署 / 智能体，只要接口能调用即可接入）。
 *   它的**对外契约**写在共享规格 `D:/lemo-tmp/llm-api-spec.md` §一（导出与返回结构）/ §二（环境变量）：
 *     · 必须导出 `PROFILES` / `listProfiles` / `resolveConfig` / `validate` / `chat` / `listModels`；
 *     · `chat()` **永不抛异常** —— 一切失败归一为 `{ok:false,error:{kind,...}}`，`kind` 取值固定枚举；
 *     · **默认 profile = `workbuddy`**（恰一个 `isDefault:true` 且其 id 是 `workbuddy`）；
 *     · **密钥绝不外泄**（日志 / 文件 / errors / hint 里不得出现 key 明文）；
 *     · 覆盖点恰为规格 §二 那 6 个 `LEMO_LLM_*`。
 *   ★ 但**没有任何闸门在守这些契约**：谁改了导出名 / 往 `chat` 里塞一个 `throw` / 把默认 profile 挪走 /
 *     顺手 `console.log(apiKey)` / 加一个规格外的 `LEMO_LLM_*`，**都不会有任何断言响** —— 而面板
 *     （`server.mjs` 的 `/api/llm/*`）与调用方**全都假定这些契约成立**。
 *   ⇒ 立此闸门，把「共享规格里的口头契约」变成**机器守卫**（本项目铁律：**新模块要有闸门守它的关键契约**）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（**只做可机械判定的声称**；宁可少做几条，也不要误报）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★ 设计纪律：本闸门是**静态读码**（不 import 被测模块 —— 不引入副作用 / 不依赖网络），
 *     凡「代码体」一律用**剥注释后**的文本判（本项目反复治过「判据可被注释满足」的假绿）。
 *     每条判据都先**在真实模块上跑一遍看误报率**、再定稿（见 ③）。
 *
 *   **判据① 契约一致（导出 + 返回结构 + kind 枚举）**
 *     · ①(a) 导出：`PROFILES` / `listProfiles` / `resolveConfig` / `validate` / `chat` / `listModels`
 *       六者**全部**是导出（识别 `export (async) function|const|let|var <name>`、`export { … }`（含 `as`）、
 *       `export default`）⇒ 缺谁点名谁。
 *     · ①(b) `chat()` 返回结构含 `ok` 字段：代码体里出现 `ok: true` / `ok: false`。
 *     · ①(c) `error.kind` 取值在规格 §一 枚举内：代码体里所有 `kind: '<字面量>'` / `.kind = '<字面量>'`
 *       的值必须 ∈ 枚举 ∪ 适配器 kind（`anthropic` / `openai-compatible` / `custom`）；**出现枚举外的
 *       取值** ⇒ FAIL 并点名。★ 为什么要带上适配器 kind：本模块 `kind` 一词**两义** —— 既是
 *       **错误 kind**（`'auth'`…）又是**适配器 kind**（`'anthropic'`…），静态分不开 ⇒ 二者都算合法取值，
 *       本判据抓的是「**出现一个两义之外的新 kind 字面量**」（真·枚举漂移）。
 *     · ①(d) 枚举**完整**：规格 §一 那 10 个 error kind **每个**都在代码里以字符串字面量出现
 *       （模块必须能产出每一类失败）⇒ 缺谁点名谁。
 *
 *   **判据② `chat()` 永不抛**：从**剥注释后**的代码体里切出 `chat` 的函数体（花括号配平），
 *     断言体内**没有** `throw`。★ 剥注释是硬要求：注释里写一句「不抛」会自己满足判据（= 摆设）。
 *
 *   **判据③ 默认 profile 是 `workbuddy`**：从代码体切出 `PROFILES` 的对象字面量，按**顶层逗号**切成
 *     条目；断言 **恰有一个**条目含 `isDefault: true`，且那个条目**就是 `workbuddy`**（键名 `workbuddy`）。
 *     ★ 兼容 `PROFILES` 是数组（`[{id:'workbuddy',…}]`）或对象（`{ workbuddy: {…} }`）两种写法
 *     （都按顶层逗号切，两种形态的条目边界一致）。
 *
 *   **判据④ 密钥不外泄**：代码体里所有 `console.<m>( … )` 调用的**参数**里**不得出现**密钥类标识符
 *     （`apiKey` / `api_key` / `apikey` / `key` / `secret` / `token` / `password` / `passwd` /
 *     `credential` / `accessKey` / `secretKey` / `authKey`，**整标识符匹配**）⇒ 命中点名该 console 调用。
 *     ★ 只认**整标识符**：`hasKey` / `monkey` 不算（`key` 前面还有字母 ⇒ 不是独立标识符），免得误报。
 *     ★ 已知边界：只查**本文件里的 `console.*` 直接调用** —— 经本地 helper 间接打印的看不见（见 ⑥）。
 *
 *   **判据⑤ 环境变量与规格一致**：代码体里出现的 `process.env.<NAME>` / `process.env['<NAME>']`
 *     中 `NAME` 以 `LEMO_LLM_` 开头的**集合**，必须**逐字等于**规格 §二 那 6 个
 *     （`LEMO_LLM_PROFILE` / `LEMO_LLM_BASE` / `LEMO_LLM_KEY` / `LEMO_LLM_MODEL` /
 *      `LEMO_LLM_HEADERS` / `LEMO_LLM_TIMEOUT_MS`）—— **多一个 / 少一个都 FAIL** 并点名差额。
 *
 *   **判据⑥ 失明守卫（防空转绿灯）**：读不到 `lib/llm-api.mjs` / 代码体为空 / 一个导出都没抽到 /
 *     一个 `LEMO_LLM_*` 都没抽到 / 一条 `kind:` 字面量都没抽到 / 切不出 `chat` 函数体 /
 *     切不出 `PROFILES` 字面量 ⇒ **FAIL 并明说「本闸门已失明」**，且**失明时不再输出判据①~⑤**
 *     （在失明的树上它们只会刷屏，且会被误读成「模块违约」）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 误报率实测（**先在真实模块上跑一遍、逐条人读命中，再定稿**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **判据①**：真实 `lib/llm-api.mjs` 导出 **12** 个符号（含 6 个契约符号）⇒ 6/6 命中、**缺 0**；
 *     `ok: true` / `ok: false` 都在；`kind:` 字面量 **7 个**（`anthropic` / `openai-compatible` /
 *     `custom` / `config` / `bad-json` / `bad-shape` / `unknown`）**全部合法**；10 个 error kind
 *     字面量**全部出现** ⇒ **命中 0 / 误报 0**。
 *   · **判据②**：`chat` 函数体里**没有** `throw`（只有 `try/catch` + `return fail(...)`）⇒ **命中 0**。
 *   · **判据③**：`PROFILES` 恰一个 `isDefault: true`（在 `workbuddy` 条目里）⇒ **命中 0**。
 *   · **判据④**：全模块只有一处 `console.*`（`warnOnce` 里的 `console.warn(…${msg})`），参数是 `msg`，
 *     **不是**密钥类标识符 ⇒ **命中 0 / 误报 0**。
 *   · **判据⑤**：`LEMO_LLM_*` 集合恰为那 6 个 ⇒ **命中 0**。
 *   · 真实模块上 **exit 0**（0 FAIL）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做语义理解**：判据全部基于**固定写法**的锚点（导出形态 / `kind:` 字面量 / `throw` / console 参数）。
 *   · **不 import 被测模块**：不做「真的调一次 `chat()` 看它抛不抛」的**运行期**验证 —— 那要起服务、
 *     有副作用；本闸门是**静态**契约守卫（运行期行为由 `test/llm-api.test.mjs` 覆盖）。
 *   · **不判** `validate()` / `listModels()` 的返回结构（只判规格 §一 明列的那几项；宁可少判不误报）。
 *   · **不判**「密钥是否真的没写进**文件**」（`saveOverride` 的落盘属 §八，是**允许**含明文密钥的那一处）。
 *   · **已知盲区（如实写）**：① 判据② 只看 `chat` **函数体内**的 `throw` —— 它调用的**别处** helper 里
 *     若有 `throw` 且没被 catch，本闸门看不见（假阴）；② 判据④ 只看**本文件的 `console.*`**，
 *     经本地 helper 间接打印、或写进文件的密钥看不见；③ 判据③ 依赖「`PROFILES` 条目按顶层逗号可切」——
 *     若有人用**工厂函数**在运行期拼表，本闸门会切不出 `isDefault` ⇒ 报失明（**宁可报失明，不误报**）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑤ 验证（**临时副本 + 覆盖点，全程不动真实模块**；同一套断言也写在
 *      `test/gate-blindness.test.mjs` 的 `check-llm-api` 用例里）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**（真实 `lib/llm-api.mjs` 整棵拷进夹具树）⇒ **exit 0** 且不含失明文案。
 *   · **变异 A（判据①）**：删掉 `export` 关键字（`export async function chat` → `async function chat`）
 *     ⇒ **exit 1** 并点名 `chat`。
 *   · **变异 B（判据②）**：在 `chat` 函数体里塞一行 `throw new Error('boom')` ⇒ **exit 1** 并点名 `chat`。
 *   · **变异 C（判据③）**：把 `workbuddy` 条目的 `isDefault: true` 挪到 `anthropic` 条目 ⇒ **exit 1**。
 *   · **变异 D（判据④）**：加一行 `console.log(apiKey)` ⇒ **exit 1** 并点名。
 *   · **变异 E（判据⑤）**：加一行 `process.env.LEMO_LLM_ZZZ` ⇒ **exit 1** 并点名差额。
 *   · **变异 F（判据①(c)）**：把某个 `kind:` 字面量改成枚举外的值 ⇒ **exit 1** 并点名。
 *   · **失明两态**（模块文件缺失 / 模块里一条 `LEMO_LLM_*` 都没有）⇒ **exit 1 + 「本闸门已失明」**，
 *     且**不输出判据①~⑤**。
 *   · **★自证**：分别**短路**判据①/②/③ 的比较 ⇒ 对应变异**重新变绿**（证明判据**承重**，不是摆设）。
 *
 * 用法：node scripts/check-llm-api.mjs
 * 环境变量：
 *   LEMO_TOOLS_ROOT  工具仓根（默认 `<脚本>/..`，与 `check-doc-coverage` / `check-env-overrides` /
 *                    `check-gate-self-claims` **同名同义**）—— 被测模块 = `<LEMO_TOOLS_ROOT>/lib/llm-api.mjs`，
 *                    供**非破坏性变异验证**（指向临时夹具树，绝不动真实模块）。
 * 退出码：0 = `lib/llm-api.mjs` 满足契约（判据①~⑤ 全过）；
 *         1 = 有 FAIL（契约不符），或**本闸门已失明**。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ★ 覆盖点：工具仓根（同名同义于 check-doc-coverage / check-env-overrides / check-gate-self-claims）。 */
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
const MODULE_REL = 'lib/llm-api.mjs';
const MODULE = path.join(ROOT, 'lib', 'llm-api.mjs');

// ── 规格 §一 / §二 的常量（契约真值；改这里 = 改契约，须先改规格）──────────────
const REQUIRED_EXPORTS = ['PROFILES', 'listProfiles', 'resolveConfig', 'validate', 'chat', 'listModels'];
const KIND_ENUM = ['unreachable', 'timeout', 'auth', 'rate-limit', 'http-error', 'bad-json',
  'bad-shape', 'empty-output', 'config', 'unknown'];
const ADAPTER_KINDS = ['anthropic', 'openai-compatible', 'custom'];
const ENV_EXPECTED = ['LEMO_LLM_PROFILE', 'LEMO_LLM_BASE', 'LEMO_LLM_KEY', 'LEMO_LLM_MODEL',
  'LEMO_LLM_HEADERS', 'LEMO_LLM_TIMEOUT_MS'];
/** 密钥类标识符（**整标识符**匹配；`hasKey` / `monkey` 不算 —— `key` 前还有字母）。 */
const KEY_IDENT = new Set(['apikey', 'api_key', 'key', 'secret', 'token', 'password', 'passwd',
  'credential', 'accesskey', 'secretkey', 'authkey', 'privatekey']);

// ── ★ 剥注释（**保留字符串字面量**）—— 状态机；行号不变 ─────────────────────
//   ★ 顺序关键：**先判注释、再判引号** ⇒ 注释里的引号 / 反引号不会把状态机带偏；
//     而字符串里的 `/*` 也安全（进入字符串态后不再判注释）。
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

// ── ★ 剥注释 + 字符串（状态机；行号不变）—— 逐字照抄 check-env-overrides 的 codeOnly ──
//   用途：判据①(a)(b) / ② / ④ / ⑤ 的「代码体」。
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

/** 配平括号：`openIdx` 是 `(` 的下标，返回匹配 `)` 的下标（找不到 ⇒ -1）。 */
function matchParen(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
/** 配平花括号：`openIdx` 是 `{` 的下标，返回匹配 `}` 的下标（找不到 ⇒ -1）。 */
function matchBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/**
 * 从**剥注释+字符串后**的代码体里切出 `name` 的函数体（`{ … }`）。
 * 支持 `(export) (async) function name(...) { … }` 与 `(export) const|let|var name = (...) => { … }`。
 * 找不到 ⇒ `null`（交由失明守卫）。
 */
function bodyOf(code, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${esc}\\b`).exec(code);
  if (m) {
    let i = m.index + m[0].length;
    while (i < code.length && code[i] !== '(') i++;
    const close = matchParen(code, i);
    if (close < 0) return null;
    let j = close + 1;
    while (j < code.length && /\s/.test(code[j])) j++;
    if (code[j] !== '{') return null;
    const end = matchBrace(code, j);
    return end < 0 ? null : code.slice(j, end + 1);
  }
  m = new RegExp(`(?:export\\s+)?(?:const|let|var)\\s+${esc}\\s*=`).exec(code);
  if (m) {
    let i = m.index + m[0].length;
    while (i < code.length && /\s/.test(code[i])) i++;
    if (code[i] === '(') { const c = matchParen(code, i); if (c < 0) return null; i = c + 1; while (i < code.length && /\s/.test(code[i])) i++; }
    if (code[i] !== '{') return null;                   // 表达式体（无花括号）⇒ 本闸门不切（交由失明）
    const end = matchBrace(code, i);
    return end < 0 ? null : code.slice(i, end + 1);
  }
  return null;
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

/** 抽出 `PROFILES` 的对象/数组字面量文本（跳过 `Object.freeze(` 之类的包装调用）⇒ 找不到返回 null。 */
function profilesLiteral(code) {
  const m = /export\s+const\s+PROFILES\s*=\s*/.exec(code);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < code.length && code[i] !== '{' && code[i] !== '[') {
    // 只允许跳过包装调用（标识符 / 点 / 括号 / 空白）；撞上别的字符说明形态不认识
    if (/[A-Za-z0-9_$.\s(]/.test(code[i])) { i++; continue; }
    return null;
  }
  if (i >= code.length) return null;
  const close = code[i] === '{' ? matchBrace(code, i) : matchBracket(code, i);
  return close < 0 ? null : code.slice(i, close + 1);
}
/** 配平方括号。 */
function matchBracket(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
/** 把字面量按**顶层逗号**切成条目（追踪 `{}` `[]` `()` 深度）。 */
function topLevelSegments(literal) {
  const segs = [];
  let depth = 0, start = 0;
  for (let i = 0; i < literal.length; i++) {
    const c = literal[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ',' && depth === 1) { segs.push(literal.slice(start, i)); start = i + 1; }
  }
  segs.push(literal.slice(start));
  return segs;
}

/** 从 `console.<m>( … )` 调用里抽参数文本（剥注释+字符串后的代码体）。 */
function consoleCalls(code) {
  const out = [];
  for (const m of code.matchAll(/\bconsole\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\(/g)) {
    const open = code.indexOf('(', m.index);
    const close = matchParen(code, open);
    out.push({ at: m.index, args: close < 0 ? code.slice(open + 1) : code.slice(open + 1, close) });
  }
  return out;
}
/** 参数文本里的**整标识符**。 */
function identifiers(text) {
  const set = new Set();
  for (const m of text.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) set.add(m[0]);
  return set;
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
let noComment = '';   // 只剥注释（保留字符串）—— 判据①(c)(d) 用
if (raw !== null) {
  code = codeOnly(raw);
  noComment = stripComments(raw);
  if (code.trim() === '') blind.push('`lib/llm-api.mjs` 剥注释/字符串后是**空的**（写法变了？）⇒ 本闸门已失明');
}

// ── 判据①：契约一致 ─────────────────────────────────────────────────────────
if (raw !== null && code.trim() !== '') {
  // ①(a) 导出
  const exported = exportedNames(code);
  const missing = REQUIRED_EXPORTS.filter((n) => !exported.has(n));
  if (missing.length) {
    fails.push({ crit: '①(a)', detail: `规格 §一 要求的导出缺失：${missing.join(' / ')}（当前导出：${[...exported].join(', ') || '（无）'}）` });
  }
  // ①(b) ok 字段
  if (!/\bok\s*:\s*(?:true|false)\b/.test(code)) {
    fails.push({ crit: '①(b)', detail: '代码体里找不到 `ok: true` / `ok: false` ⇒ `chat()` 的返回结构可能不含 `ok` 字段（契约 §一）' });
  }
  // ①(c) kind 字面量取值合法
  const kindLits = [];
  for (const m of noComment.matchAll(/\bkind\s*:\s*['"]([^'"]+)['"]/g)) kindLits.push(m[1]);
  for (const m of noComment.matchAll(/\.kind\s*=\s*['"]([^'"]+)['"]/g)) kindLits.push(m[1]);
  const legal = new Set([...KIND_ENUM, ...ADAPTER_KINDS]);
  const badKinds = [...new Set(kindLits)].filter((k) => !legal.has(k));
  if (kindLits.length === 0) blind.push('代码体里**一条** `kind: \'…\'` 字面量都没抽到（写法变了？）⇒ 判据①(c) 空转');
  else if (badKinds.length) {
    fails.push({ crit: '①(c)', detail: `出现了规格外的 kind 字面量：${badKinds.join(' / ')}（合法取值 = 规格 §一 的 10 个 error kind ∪ 适配器 kind ${ADAPTER_KINDS.join('/')}）` });
  }
  // ①(d) error kind 枚举完整
  const absent = KIND_ENUM.filter((k) => !(noComment.includes(`'${k}'`) || noComment.includes(`"${k}"`)));
  if (absent.length) {
    fails.push({ crit: '①(d)', detail: `规格 §一 的 error kind 枚举有 ${absent.length} 个没在代码里出现：${absent.join(' / ')}（模块可能漏产某一类失败）` });
  }
}

// ── 判据②：chat 永不抛 ──────────────────────────────────────────────────────
if (raw !== null && code.trim() !== '') {
  const chatBody = bodyOf(code, 'chat');
  if (chatBody === null) blind.push('切不出 `chat` 的函数体（写法变了？）⇒ 判据② 空转');
  else if (/\bthrow\b/.test(chatBody)) {
    fails.push({ crit: '②', detail: '`chat()` 的函数体里出现裸露的 `throw` ⇒ 违反「chat 永不抛」（契约 §一 / §五）' });
  }
}

// ── 判据③：默认 profile = workbuddy ─────────────────────────────────────────
if (raw !== null && code.trim() !== '') {
  const lit = profilesLiteral(code);
  if (lit === null) blind.push('切不出 `PROFILES` 的字面量（写法变了？）⇒ 判据③ 空转');
  else {
    const segs = topLevelSegments(lit);
    const withDefault = segs.filter((s) => /isDefault\s*:\s*true\b/.test(s));
    const withWorkbuddy = segs.filter((s) => /\bworkbuddy\b/.test(s));
    if (withDefault.length === 0) {
      fails.push({ crit: '③', detail: '`PROFILES` 里**没有** `isDefault: true` ⇒ 没有默认 profile（契约 §六 要求 `workbuddy` 是默认）' });
    } else if (withDefault.length > 1) {
      fails.push({ crit: '③', detail: `\`PROFILES\` 里有 ${withDefault.length} 个 \`isDefault: true\` ⇒ 默认 profile 不唯一（应恰一个，且是 \`workbuddy\`）` });
    } else if (withWorkbuddy.length === 0) {
      fails.push({ crit: '③', detail: '`PROFILES` 里找不到 `workbuddy` 条目（契约 §六：默认 profile 必须是 `workbuddy`）' });
    } else if (!/isDefault\s*:\s*true\b/.test(withWorkbuddy[0])) {
      fails.push({ crit: '③', detail: '`isDefault: true` 不在 `workbuddy` 条目里 ⇒ 默认 profile 不是 `workbuddy`（契约 §六）' });
    }
  }
}

// ── 判据④：密钥不外泄 ───────────────────────────────────────────────────────
if (raw !== null && code.trim() !== '') {
  const leaks = [];
  for (const call of consoleCalls(code)) {
    const hit = [...identifiers(call.args)].filter((id) => KEY_IDENT.has(id.toLowerCase()));
    if (hit.length) {
      const line = code.slice(0, call.at).split('\n').length;
      leaks.push(`行 ${line}：console 调用的参数里出现密钥类标识符 ${[...new Set(hit)].join('/')}`);
    }
  }
  if (leaks.length) fails.push({ crit: '④', detail: `疑似把密钥写进日志（契约 §四：绝不把密钥写进日志）：\n     - ${leaks.join('\n     - ')}` });
}

// ── 判据⑤：环境变量与规格一致 ───────────────────────────────────────────────
let envFound = new Set();
if (raw !== null && code.trim() !== '') {
  for (const m of code.matchAll(/process\.env\.(LEMO_LLM_[A-Za-z0-9_]*)/g)) envFound.add(m[1]);
  for (const m of code.matchAll(/process\.env\s*\[\s*['"](LEMO_LLM_[A-Za-z0-9_]*)['"]\s*\]/g)) envFound.add(m[1]);
  const expect = new Set(ENV_EXPECTED);
  const extra = [...envFound].filter((n) => !expect.has(n));
  const miss = ENV_EXPECTED.filter((n) => !envFound.has(n));
  if (envFound.size === 0) blind.push('代码体里**一个** `process.env.LEMO_LLM_*` 都没抽到（写法变了？）⇒ 判据⑤ 空转');
  else if (extra.length || miss.length) {
    const bits = [];
    if (extra.length) bits.push(`多出 ${extra.join(' / ')}`);
    if (miss.length) bits.push(`缺少 ${miss.join(' / ')}`);
    fails.push({ crit: '⑤', detail: `\`LEMO_LLM_*\` 覆盖点集合 ≠ 规格 §二 那 6 个（${bits.join('；')}）` });
  }
}

// ── 判据⑥：失明守卫 ─────────────────────────────────────────────────────────
const blindGuard = blind.length > 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
console.log('LLM 配置契约闸门 —— 守 `lib/llm-api.mjs` 与规格（`D:/lemo-tmp/llm-api-spec.md` §一/§二）的契约');
console.log('  判据: ① 导出契约 + ok 字段 + error.kind 枚举 | ② chat 永不抛 | ③ 默认 profile = workbuddy |');
console.log('        ④ 密钥不外泄 | ⑤ 环境变量集合 == 6 | ⑥ 失明守卫（防空转绿灯）');
console.log(`  被测: ${MODULE}`);
console.log(`  扫描: 剥注释+字符串后 ${code.split('\n').length} 行代码体；剥注释（留字符串）后 ${noComment.split('\n').length} 行`);
console.log('');

if (blindGuard) {
  console.log('✘✘ 本闸门已失明：');
  for (const b of blind) console.log(`   ✘ ${b}`);
  console.log('   ⇒ 「0 处违约」是假的，别信这个绿。请先修路径 / 剥注释写法，再信本闸门的结论。');
  console.log('   ⇒ 已失明 ⇒ 判据①~⑤ 本次**不输出**（在失明的树上它们只会刷屏）。');
  console.log('');
  console.log('[闸门] LLM 契约：已失明 ⇒ 一条判据都没可信地跑过 ✘');
  process.exitCode = 1;
  process.exit();
}

if (fails.length) {
  console.log(`✘ 判据①~⑤·契约不符 ${fails.length} 处：\n`);
  for (const f of fails) console.log(`   ✘ 判据${f.crit}  ${f.detail}`);
  console.log('\n   ↳ 修法：让 `lib/llm-api.mjs` 满足规格（`D:/lemo-tmp/llm-api-spec.md` §一/§二）；');
  console.log('     若**规格本身**要改，请先改规格、再同步改本闸门的常量（改常量 = 改契约）。');
} else {
  console.log('✓ 判据①~⑤·`lib/llm-api.mjs` 满足契约（导出齐全、chat 不抛、默认 profile = workbuddy、密钥不外泄、环境变量恰为规格那 6 个）');
}

console.log(`\n[闸门] LLM 契约：导出 ${REQUIRED_EXPORTS.length} 符号 · kind 枚举 ${KIND_ENUM.length} 个 · `
  + `环境变量 ${ENV_EXPECTED.length} 个 · 违约 ${fails.length} 处 ${fails.length ? '✘' : 'OK'}`);
process.exitCode = fails.length ? 1 : 0;
