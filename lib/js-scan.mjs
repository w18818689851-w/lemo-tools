/**
 * lib/js-scan.mjs —— 共享的「剥注释 / 剥字符串」扫描器（**零依赖**，纯 Node 内置）
 *
 * ★ 由来（2026-10-11）：`scripts/check-*.mjs` 里曾有 **9 份**各自复制的同族实现（4 个不同函数体：
 *   删注释保字符串 / 抹注释保字符串 / 删注释丢字符串 / 纯正则剥行注释）。它们**都不认正则字面量**
 *   （regex literal）⇒ 一旦正则里出现**裸引号**（如 `/['"]/`），状态机就会把引号当成字符串起始、
 *   误判「字符串开了没关」，**把该文件之后的代码整段吞掉**。实测事故：`server.mjs` 新增一个 API 块后，
 *   闸门 `check-llm-call-params` 报「本闸门已失明」（剥完只剩 19670/127511 字符、抽到 0 次模块调用）。
 *   ⇒ 本模块把 9 份抽成一份，并**认正则字面量**，根治该缺陷。
 *
 * ★ 判据（正则起点）：在**代码态**遇到 `/`（且不是 `//` / `/*`）时，看**前一个有效 token**：
 *   · 前一个有效 token ∈ {标识符字符、数字、`)`、`]`、`}`、字符串结束} ⇒ 视为**除法**（不消费）；
 *   · 否则（行首 / 运算符 / `(` / `[` / `{` / `,` / `;` / `:` / `=` … 之后）⇒ 视为**正则起点**；
 *   · ★ 例外（更正确，仍保守）：前一个 token 是**可作前缀的关键字**（`return` / `typeof` / `case` …）
 *     且**不是**属性访问（前面不是 `.`）⇒ 也视为正则起点（否则 `return /^a$/` 会被误判成除法）。
 *
 * ★ 消费正则时：消费到**未被转义**的 `/`；★ 正确跳过 `[...]` 字符类里的 `/`；★ 跳过 `\x` 转义；
 *   随后吞掉 flags。★ **宁可保守**：若在**本行内**找不到闭合 `/` ⇒ 判为除法（**不消费**），
 *   绝不把正常代码吞掉（这是本次事故的根因所在）。
 *
 * ★ 保持既有语义（**一个都不能变**）：`//` 行注释 / 块注释（`/` + `*` … `*` + `/`）/ `'` `"` `` ` `` 字符串 / 转义 /
 *   **行号保留**（换行一律原样留在输出里 ⇒ 报错仍能点名 `文件:行`）。
 *
 * ★ 三种返回口径（覆盖既有 9 个调用点，见 `opts`）：
 *   · `stripComments(src)`                          —— **抹**注释成空格（保长度）、**保留**字符串内容（主变体，5 份）；
 *   · `stripComments(src, { blank: false })`        —— **删**注释（保换行）、**保留**字符串内容（2 份）；
 *   · `stripComments(src, { blank: false, keepStrings: false })` —— **删**注释（保换行）、**丢**字符串内容只留换行（1 份）。
 *
 * 用法：import { stripComments } from '../lib/js-scan.mjs';
 */

/** 可作「前缀」的关键字：它们后面跟 `/` 时是正则起点，而不是除法。 */
const REGEX_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await', 'default',
]);

/** 标识符字符（含 `$`）。 */
function isIdentChar(c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === '$';
}

/**
 * 「值结尾」字符：出现在 `/` 之前 ⇒ 该 `/` 是**除法**（不可能是正则起点）。
 * 含标识符 / 数字 / `)` / `]` / `}` / 三种引号（字符串刚结束时把 lastSig 置为 `)`，此处只为完备）。
 */
function isValueEndChar(c) {
  return isIdentChar(c) || c === ')' || c === ']' || c === '}' || c === '"' || c === "'" || c === '`';
}

/**
 * 从 `src[i]`（必为 `/`）起尝试识别一个**正则字面量**。
 * 成功 ⇒ 返回闭合 `/`（含 flags）之后的下标；失败 ⇒ 返回 `-1`（调用方按除法处理）。
 * ★ 保守：正则不跨行 ⇒ 本行内找不到闭合 `/` 即失败。
 */
function scanRegex(src, i) {
  const n = src.length;
  let j = i + 1;
  let inClass = false;      // 是否在 `[...]` 字符类里（类里的 `/` 不闭合正则）
  let closed = false;
  while (j < n) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }          // 跳过 `\x` 转义（含 `\/`）
    if (c === '\n' || c === '\r') return -1;       // ★ 正则不跨行 ⇒ 判不准 ⇒ 当除法
    if (inClass) { if (c === ']') inClass = false; j++; continue; }
    if (c === '[') { inClass = true; j++; continue; }
    if (c === '/') { closed = true; j++; break; }
    j++;
  }
  if (!closed) return -1;
  while (j < n && isIdentChar(src[j])) j++;        // 吞 flags（gimsuy…）
  return j;
}

/**
 * 剥注释 / 字符串。见文件头「三种返回口径」。
 * @param {string} src 源码
 * @param {{ blank?: boolean, keepStrings?: boolean }} [opts]
 *   · `blank`（默认 `true`）：`true` ⇒ 注释**抹成空格**（输出长度 = 输入长度）；
 *     `false` ⇒ 注释**整段删掉**（仅保留换行）。
 *   · `keepStrings`（默认 `true`）：`true` ⇒ **保留**字符串字面量内容；`false` ⇒ **丢**内容、只留换行。
 * @returns {string} 剥完的文本（**换行一律保留** ⇒ 行号与原文一致）
 */
export function stripComments(src, opts = {}) {
  const blank = opts.blank !== false;
  const keepStrings = opts.keepStrings !== false;
  const n = src.length;
  let out = '';
  let i = 0;
  let state = 'code';     // code | line | block | str
  let quote = null;       // 字符串态的引号
  let lastSig = null;     // 上一个**非空白**代码字符（正则起点判定）
  let word = '';          // 尾部标识符（关键字判定）
  let wordPrev = null;    // 该标识符起始前的那个非空白字符（判 `.` 属性访问）

  // 注释字符的出口：换行照留；其余按 blank 抹空格 / 删掉。
  const putComment = (c) => { if (c === '\n') out += '\n'; else if (blank) out += ' '; };
  // 字符串字符的出口：保留 / 只留换行。
  const putString = (c) => { if (keepStrings) out += c; else if (c === '\n') out += '\n'; };

  while (i < n) {
    const c = src[i];

    if (state === 'code') {
      // ① 注释（先判注释 ⇒ 注释里的引号 / 反引号不会把状态机带偏）
      if (c === '/' && src[i + 1] === '/') { putComment('/'); putComment('/'); state = 'line'; i += 2; continue; }
      if (c === '/' && src[i + 1] === '*') { putComment('/'); putComment('*'); state = 'block'; i += 2; continue; }

      // ② 正则字面量（本次根治点）
      if (c === '/') {
        const prev = lastSig;
        const isKw = wordPrev !== '.' && REGEX_KEYWORDS.has(word);
        const regexAllowed = prev === null || !isValueEndChar(prev) || isKw;
        if (regexAllowed) {
          const end = scanRegex(src, i);
          if (end > 0) { out += src.slice(i, end); lastSig = ')'; word = ''; wordPrev = null; i = end; continue; }
        }
        // 判不准 / 识别失败 ⇒ 落到下面按「除法」处理（不消费）
      }

      // ③ 字符串起始
      if (c === "'" || c === '"' || c === '`') { putString(c); quote = c; state = 'str'; i++; continue; }

      // ④ 普通代码字符
      out += c;
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
        // 空白不改变 lastSig / word（`return /re/` 里关键字与 `/` 之间常有空白）
      } else if (isIdentChar(c)) {
        if (word === '') wordPrev = lastSig;
        word += c;
        lastSig = c;
      } else {
        word = ''; wordPrev = null; lastSig = c;
      }
      i++;
      continue;
    }

    if (state === 'line') {
      putComment(c);
      if (c === '\n') state = 'code';
      i++;
      continue;
    }

    if (state === 'block') {
      if (c === '*' && src[i + 1] === '/') { putComment('*'); putComment('/'); state = 'code'; i += 2; continue; }
      putComment(c);
      i++;
      continue;
    }

    // state === 'str'
    if (c === '\\') {                 // 转义：整对跳过（`\'` 不闭合字符串）
      putString(c);
      if (i + 1 < n) putString(src[i + 1]);
      i += 2;
      continue;
    }
    putString(c);
    if (c === quote) { state = 'code'; quote = null; lastSig = ')'; word = ''; wordPrev = null; }
    i++;
  }
  return out;
}
