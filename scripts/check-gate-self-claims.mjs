#!/usr/bin/env node
/**
 * scripts/check-gate-self-claims.mjs —— 「闸门自己的**头注释** ↔ 它的**实际实现**」闸门
 *   （★ **写作时**本仓第 40 个 `check-*` 闸门；★ 序号是快照，别当判据 —— 见 ⑤）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 由来（**已由一次人工审计实证**，不是假想）
 * ══════════════════════════════════════════════════════════════════════════════
 *   本项目 39 个 `scripts/check-*.mjs` **每个都有很长的头注释**（由来 / 判据 / 误报率实测 /
 *   已知盲区 / 验证方式）—— 那是**档案**，是后人读这个闸门时的**唯一说明书**。
 *   ★ 但**没有任何闸门在守这些注释**：谁改了判据、改了退出码，**注释不会跟着变** ⇒ 注释**静默撒谎**。
 *   上一批人工审计（`_distill/闸门自陈-审计-2026-10-08.md`，39/39 逐个把「头注释自陈」与
 *   「代码实际」对照）抓到 **4 条真不一致 + 10 条措辞不精确**（该文件 §2 / §3）。那 14 条**已被修掉**
 *   ⇒ 本闸门在**当前语料上应当 0 命中**（误报 0 是硬指标；见 ⑥ 的实测）。
 *   ⇒ 立此闸门，把「**一次人工审计**」变成「**持续机制**」。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（**只做可机械判定的声称**；宁可少做几条，也不要误报）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★ 设计纪律：注释是**自然语言**，机械比对极易误报 ⇒ 本闸门**只锚定有固定写法的声称**，
 *     每条判据都先**在真实语料上跑一遍看误报率**、再定稿（见 ⑥）。**误报 > 0 的判据要么收窄、
 *     要么如实登记为「只列不判」。**
 *
 *   **判据① 退出码声明 == 实际**（★ 本闸门的主判据，覆盖全部闸门）
 *     · 声明侧：取头注释里**规范声明行**（行首 = `退出码：` / `退出码语义：`，可带 `★ ④ ` 前缀）
 *       及其**续行**（直到空行 / `用法` / `环境变量` / `覆盖点` 行 / 最多 6 行）里的退出码集合。
 *       ★ **只认「贴着退出码语义」的写法**（`0 = …` / `⇒ 1` / `→ 1` / `否则 0` / `` `exit 2` ``），
 *       **不**把散文里的任何数字都当退出码 —— 这是防误报的关键（如 `第一节 3 条链路` 的 `3`）。
 *     · 实际侧：扫**代码体**（头注释块之后）的 `process.exit(<表达式>)` 与 `process.exitCode = <表达式>`，
 *       取出表达式里的**独立数字字面量**（`\b\d+\b` 且**前后不能是标识符字符** —— 否则 `fail2.length`
 *       的 `2` 会被误当退出码；实测踩过）。
 *     · **必须相等**（`declared === actual`）：
 *       - 声明 ⊂ 实际（漏声明，如 `exit 2` 未写）⇒ FAIL —— 这正是审计 §3 的 C5–C9 类；
 *       - 声明 ⊃ 实际（多声明一个从不出现的码）⇒ FAIL；
 *       - 头注释**完全没有** `退出码：` 声明行 ⇒ FAIL（缺声明，属「没写清」）。
 *     · ★ **排除「指向别处」的提及**：只读**规范声明段**，故 `check-audio-chain.mjs` 头里提到
 *       `lemo-make.mjs` 的退出码之类**不会**被当成本闸门的声明。
 *
 *   **判据② 代码输出的 `判据<序号>` 头注释都提过**（★ 收窄过的覆盖判据）
 *     · 代码侧（**剥注释后**的代码体）：所有 `判据①`/`判据②`/… 的序号集合（那些是**输出文案**里
 *       的标签，如 `` `✓ 判据①·…` ``）。
 *     · 头注释侧：出现的序号集合 = 字面 `判据<序号>` ∪ `X–Y` 区间展开 ∪ **头注释里任何位置出现的
 *       该序号**（裸序号也算 —— 因为有的闸门把头注释里的判据写成裸 `③ **ℹ 新读者未登记**`，
 *       而代码输出写 `判据③·…`；实测 `check-env-overrides` 正是这种写法，**不收「裸序号」就会误报**）。
 *     · 判据：**代码侧 ⊆ 头注释侧**（头注释可以多提，代码**不能**输出一个头注释从没提过的序号）。
 *     · ★ **单向**：反过来（头注释提了、代码没输出）**不判** —— 头注释用「`判据（三条）`」或区间
 *       写法时，字面标签本来就不全，反向判会大面积误报。
 *
 *   **判据③ 头注释称「失明」⇒ 代码里有失明线索**
 *     · 头注释含 `失明` ⇒ **剥注释后**的代码体必须含 `失明` 或 `blind`。
 *     · ★ **为什么要剥注释**：否则头注释自己的 `失明` 就满足它 ⇒ 判据**恒真**（= 摆设）。
 *       剥注释后仍要有 ⇒ 要求那条「失明」是**代码/输出文案**里的（实测 36/36 命中，
 *       `check-dub-styles` / `check-shell-structure` 的失明文案都在字符串里，故不会误报）。
 *     · ★ **单向**：反过来（代码有 `blind`、头注释没提失明）**不判** —— 实测 `check-config-notes` /
 *       `check-skill-scores` / `check-plate-pixel` 就是「代码有失明守卫、头注释没写」，那是**头注释
 *       写得不够**（真缺口），但**不是**「注释撒谎」；判它会**立刻打破「0 命中」**，属越界（本闸门只守
 *       「**注释说的，代码做到了没有**」，不替别的闸门补注释）。
 *
 *   **判据④ 失明守卫（本闸门自己的，防空转绿灯）**
 *     · `scripts/` 下扫到 **0 个** `check-*.mjs` ⇒ **FAIL 并明说「本闸门已失明」**；
 *     · **0 条**「退出码声明」被解析到 ⇒ **FAIL + 失明**（说明声明行写法变了 / 树不对）；
 *     · **0 个**「实际退出码」被解析到（所有闸门都没解析出 `process.exit*`）⇒ **FAIL + 失明**；
 *     · ★ **失明时不再输出判据①②③**（在失明的树上它们只会刷屏，且会被误读成「闸门有问题」）。
 *       —— 本项目反复踩过的「空集恒绿」正是这条要防的。
 *
 *   **判据⑤（ℹ 只列不判）「第 N 个 `check-*` 闸门」序号 vs 现值**
 *     · **头注释标题区**（前 6 行）里若写着「第 N 个 `check-*` 闸门」（N 与 `check-`/`闸门` 同句），
 *       而 N ≠ 实测闸门数 ⇒ **只列 ℹ、不判 FAIL**。
 *     · ★ **为什么不判 FAIL**：序号天生是**写作时的快照**（审计 §3 的 C1 把它列为「措辞不精确」
 *       而非「不一致」）—— 判死等于要求每个新闸门**回改所有旧闸门**，那是错的。
 *     · ★ **带「写作时 / 当时 / 建立时」等限定词的写法跳过**（它已如实说明是快照，不该刷屏）。
 *     · ★ **为什么只扫标题区**：`第 N 个` 的自陈就在标题里；扫全文会把正文举例里的序号也算进来
 *       （实测本闸门自己的 ⑥ 段举例 `第 39 个` 就被误列 ⇒ 收窄到标题区后消失）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 误报率实测（**先跑真实语料、逐条人读命中，再定稿**；见 ⑥ 的数）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **判据① 首测就踩了一个误报**：初版用 `/\d+/g` 取表达式里的数字 ⇒ `process.exitCode =
 *     (fail1.length || fail2.length || blind) ? 1 : 0` 里的标识符 `fail1` / `fail2` 贡献了 `1`/`2`
 *     ⇒ `check-repro-form` 被误报「实际 {0,1,2}」。**收窄为「独立数字字面量」**（前后不能是
 *     `[\w.$]`）后 ⇒ **误报 0**。
 *   · **判据② 首测踩了一个误报**：只收头注释里的 `判据<序号>` 字面 ⇒ `check-env-overrides` 的
 *     头注释把头注释侧的判据 ③ 写成**裸 `③`**（无 `判据` 前缀），而代码输出 `判据③·…`
 *     ⇒ 误报「代码输出的 ③ 头注释没提」。**收窄为「头注释里任何位置出现该序号都算」**后 ⇒ **误报 0**。
 *   · **判据③ 首测踩了一个误报**：初版在**原始**代码体里找 `失明` ⇒ `check-shell-structure` 的
 *     一条**注释**里写着「WIN 失明守卫」就满足了判据（= 判据可被**注释**满足 ⇒ 假绿）。
 *     **收窄为「剥注释后的代码体」**后 ⇒ 36/36 仍命中（那两家的失明文案都在字符串里）⇒ **误报 0**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做语义理解**：判据全部基于**固定写法**的锚点（声明行 / `判据<序号>` / `失明` 词）。
 *   · **不判**「头注释里的**实测数字**（误报率、条数、43/43…）是否可复现」—— 那要重跑每个闸门的
 *     语料/夹具，属**另一类闸门**（且那些数字按项目纪律是**快照**，见审计 §1 的 (B) 类）。
 *   · **不判**「头注释里的判据**措辞**与代码判据**语义**是否一致」（那是人读的活）。
 *   · **不判**「代码有 X、头注释没写 X」（反向）—— 见判据③ 的说明（越界 + 会打破 0 命中）。
 *   · ★ **判据② 的已知盲区**：只有当代码**输出**里带 `判据<序号>` 标签时才看得见（实测 6/40 个
 *     闸门有此形态，含本闸门）⇒ 它是**覆盖判据**、不是**全量判据**；其余闸门的「判据条数」本闸门**看不见**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑤ 序号是快照，不是判据
 * ══════════════════════════════════════════════════════════════════════════════
 *   本闸门自己的头注释也写了「写作时本仓第 40 个 `check-*` 闸门」—— 那是**写作时**的事实，
 *   加了「写作时」限定词 ⇒ 判据⑤ 跳过它（不会自我刷屏）。这就是本项目对序号的正解：
 *   **写清是哪一刻的序号**，而不是让它变成一条会过期的断言。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑥ 实测（快照 2026-10-08，库语料 = 本仓 `scripts/check-*.mjs`，共 39 个 + 本闸门 = 40）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **判据①**：40/40 都有规范 `退出码：` 声明行；**声明 == 实际 40/40** ⇒ **命中 0 / 误报 0**。
 *   · **判据②**：代码输出带 `判据<序号>` 的闸门 **6 个**（`check-distill-fields` / `check-env-overrides`
 *     / `check-repro-form` / `check-sources-paths` / `check-target-as-measured` + **本闸门自己**）；**代码侧
 *     ⊆ 头注释侧 6/6** ⇒ **命中 0 / 误报 0**。★ 本闸门**也扫自己**（它是 `check-*.mjs`、输出里带
 *     `判据① FAIL …` 标签）⇒ 计数**含它**才与实测相符；写作时曾按「旧 39 个」记成 5，那是不含自己的旧值。
 *   · **判据③**：头注释含 `失明` 的 **37 个**（旧 39 个里 36 + **本闸门自己**）；**剥注释后代码体仍有
 *     `失明`/`blind` 37/37** ⇒ **命中 0 / 误报 0**。
 *   · **判据⑤**：`check-repro-form` 头写「（第 39 个）」而现值 **40** ⇒ **ℹ 1 条**（只列不判）；
 *     `check-line-endings` 写「**写作时**本仓第 30 个」⇒ 带限定词，跳过。
 *   · 真实语料 **exit 0**（0 FAIL）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑦ 验证（**临时副本 + 覆盖点，全程不动真实仓**；同一套断言也写在
 *      `test/gate-blindness.test.mjs` 的 `check-gate-self-claims` 用例里）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**（合成 1 个合法夹具闸门：声明 `0/1`、代码 `ok ? 0 : 1`、头含 `失明`、
 *     代码含 `blind`）⇒ **exit 0** 且不含 FAIL 文案。
 *   · **变异 A（判据①）**：夹具头声明 `0/1`、代码另有 `process.exit(2)` ⇒ **exit 1** 并点名该闸门
 *     （报「声明 {0,1} / 实际 {0,1,2}」）。
 *   · **变异 B（判据① 反向）**：夹具头声明 `0/1/2`、代码只有 `? 1 : 0` ⇒ **exit 1**（多声明）。
 *   · **变异 C（判据① 缺声明）**：夹具头**没有** `退出码：` 行 ⇒ **exit 1**（缺声明）——
 *     ★ 但整棵树若**所有**闸门都缺声明 ⇒ 走判据④ 失明（见下），故夹具带一个**有声明**的锚。
 *   · **变异 D（判据②）**：夹具代码输出 `判据④·…` 而头注释从不提 `④` ⇒ **exit 1** 并点名。
 *   · **变异 E（判据③）**：夹具头含 `失明`、代码里**没有** `失明`/`blind` ⇒ **exit 1**。
 *   · **反向验证**：分别**短路**判据①②③ ⇒ 对应变异**重新变绿**（证明判据承重，不是摆设）。
 *   · **失明三态**：空 `scripts/` / 全部闸门缺 `退出码：` 声明 / 全部闸门无 `process.exit*`
 *     ⇒ **均 exit 1 + 「本闸门已失明」**，且**不输出判据①②③**。
 *
 * 用法：node scripts/check-gate-self-claims.mjs [--json]
 * 环境变量：
 *   LEMO_TOOLS_ROOT  工具仓根（默认 `<脚本>/..`，与 `check-doc-coverage` / `check-line-endings` /
 *                    `check-redline-md5` **同名同义**）—— 扫描根 = `<LEMO_TOOLS_ROOT>/scripts`，
 *                    供**非破坏性变异验证**（指向临时夹具树，绝不动真实仓）。
 * 退出码：0 = 所有闸门的头注释自陈与实现一致；
 *         1 = 有 FAIL（头注释自陈 ≠ 实现），或**本闸门已失明**；
 *         2 = 前置不可用（读不到 `scripts/` 目录）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// ★ 覆盖点：工具仓根（同名同义于 check-doc-coverage / check-line-endings / check-redline-md5）。
const TOOLS_ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
const SCRIPTS = path.join(TOOLS_ROOT, 'scripts');
const JSON_OUT = process.argv.includes('--json');

const ORD = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫';
const ordIdx = (ch) => ORD.indexOf(ch);

// ── 头注释块 / 代码体 切分 ───────────────────────────────────────────────────
/**
 * 切出「头注释块」与「代码体」。头注释块 = 第一处 `/**` 起、到 ` */` 止；代码体 = 其后的全部行。
 * 找不到 `/**` 或没有闭合 ⇒ `head=null`（该文件按「无头注释」处理：判据① 会报缺声明）。
 */
function splitHead(src) {
  const L = src.split('\n');
  const i = L.findIndex((l) => /^\s*\/\*\*/.test(l));
  if (i < 0) return { head: null, body: src };
  for (let j = i + 1; j < L.length; j++) {
    if (/^\s*\*\/\s*$/.test(L[j])) return { head: L.slice(i + 1, j).join('\n'), body: L.slice(j + 1).join('\n') };
  }
  return { head: null, body: src };
}

/** 去掉「头注释行的 ` * ` 前缀」，得到纯文本（保留行内内容，含行首 `★` 等）。 */
const stripStar = (l) => l.replace(/^[\s*]+/, '');

/**
 * 剥掉**代码体**里的注释（块注释 + 行注释）。★ 判据②③ 必须用它 —— 否则头注释/代码注释
 * 里的 `判据①` / `失明` 会自己满足判据（实测踩过，见头注释 ③）。
 */
function stripComments(s) {
  let t = s.replace(/\/\*[\s\S]*?\*\//g, '');
  t = t.replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
  return t;
}

// ── 判据①：退出码声明 / 实际 ────────────────────────────────────────────────
/** 规范声明行：行首（剥 ` * ` 后）= 可选的 `★ ④ ` 前缀 + `退出码` / `退出码语义` + `:` / `：`。 */
const DECL_RE = /^(?:★\s*[①-⑳0-9]+\s*)?退出码(?:语义)?\s*[:：]/;

/** 取「规范声明段」：声明行 + 续行（到空行 / `用法`·`环境变量`·`覆盖点` 行 / 最多 6 行）。没有 ⇒ `null`。 */
function declRegion(head) {
  if (!head) return null;
  const L = head.split('\n');
  const i = L.findIndex((l) => DECL_RE.test(stripStar(l)));
  if (i < 0) return null;
  const out = [stripStar(L[i])];
  for (let j = i + 1; j < L.length && out.length < 6; j++) {
    const c = stripStar(L[j]);
    if (c === '') break;
    if (/^(用法|环境变量|覆盖点)/.test(c)) break;
    out.push(c);
  }
  return out.join('\n');
}

/** 从声明段抽退出码集合 —— **只认贴着退出码语义的写法**（防把散文里的数字当退出码）。 */
function declaredCodes(head) {
  const r = declRegion(head);
  if (r === null) return null;
  const t = r.replace(/[`*]/g, '');
  const set = new Set();
  for (const m of t.matchAll(/(\d)\s*[=＝]/g)) set.add(m[1]);      // `0 = …`
  for (const m of t.matchAll(/[⇒→]\s*(\d)/g)) set.add(m[1]);      // `⇒ 1` / `→ 1`
  for (const m of t.matchAll(/否则\s*(\d)/g)) set.add(m[1]);      // `否则 0`
  for (const m of t.matchAll(/exit\s*(\d+)/g)) set.add(m[1]);     // `` `exit 2` ``
  return set;
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

/** 表达式里的**独立数字字面量**（前后不能是标识符字符 —— 否则 `fail2.length` 的 `2` 会被误取）。 */
const INDEP_NUM = /(?<![\w.$])(\d+)(?![\w])/g;
const nums = (expr) => [...expr.matchAll(INDEP_NUM)].map((m) => m[1]);

/** 从代码体抽「实际退出码」集合：`process.exit(<表达式>)` + `process.exitCode = <表达式>`。 */
function actualCodes(body) {
  const set = new Set();
  for (const m of body.matchAll(/process\.exit\s*\(/g)) {
    const open = body.indexOf('(', m.index);
    const close = matchParen(body, open);
    const arg = close < 0 ? body.slice(open + 1) : body.slice(open + 1, close);
    for (const n of nums(arg)) set.add(n);
  }
  for (const m of body.matchAll(/process\.exitCode\s*=/g)) {
    let depth = 0, end = body.length;
    for (let i = m.index + m[0].length; i < body.length; i++) {
      const ch = body[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ';' && depth === 0) { end = i; break; }
    }
    for (const n of nums(body.slice(m.index + m[0].length, end))) set.add(n);
  }
  return set;
}

// ── 判据②：代码输出的「判据<序号>」标签 vs 头注释 ──────────────────────────
const labelOrdinals = (s) => {
  const set = new Set();
  for (const m of s.matchAll(/判据\s*([①②③④⑤⑥⑦⑧⑨⑩⑪⑫])/g)) set.add(m[1]);
  return set;
};
/** 头注释侧的序号集合：字面 `判据<序号>` ∪ `X–Y` 区间展开 ∪ **任何位置**出现的该序号（裸序号也算）。 */
function headOrdinals(head) {
  const set = new Set();
  for (const m of (head || '').matchAll(/判据\s*([①②③④⑤⑥⑦⑧⑨⑩⑪⑫])/g)) set.add(m[1]);
  for (const m of (head || '').matchAll(/([①②③④⑤⑥⑦⑧⑨⑩⑪⑫])\s*[–—\-~]\s*([①②③④⑤⑥⑦⑧⑨⑩⑪⑫])/g)) {
    const a = ordIdx(m[1]), b = ordIdx(m[2]);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(ORD[i]);
  }
  for (const ch of (head || '')) if (ORD.includes(ch)) set.add(ch);
  return set;
}

// ── 判据⑤（ℹ）：头注释里的「第 N 个 check-* 闸门」序号 vs 现值 ──────────────
const SNAPSHOT_WORDS = /(写作时|当时|建立时|本批|那时|新立时)/;
/**
 * 返回 `[{n, line}]`：**头注释标题区**（前 6 行 —— 闸门自我描述的那一段）里带序号、
 * 且与 `check-`/`闸门` 同句、且**未**带快照限定词的声称。
 * ★ 只扫标题区是**刻意的**：`第 N 个` 的自陈就在标题里；扫全文会把「正文里举例提到某个序号」
 *   也算进来（实测本闸门自己的 ⑥ 段举例 `第 39 个` 就被误列 ⇒ 收窄到标题区后消失）。
 */
function ordinalClaims(head) {
  if (!head) return [];
  const out = [];
  for (const raw of head.split('\n').slice(0, 6)) {
    const line = stripStar(raw);
    const m = line.match(/第\s*(\d+)\s*个/);
    if (!m) continue;
    if (!/(check-|闸门)/.test(line)) continue;        // 必须与「闸门」同句，避免散文里的「第 3 个」
    if (SNAPSHOT_WORDS.test(line)) continue;          // 已如实说明是快照 ⇒ 不刷屏
    out.push({ n: Number(m[1]), line: line.trim().slice(0, 120) });
  }
  return out;
}

// ── 扫描 ─────────────────────────────────────────────────────────────────────
let files = [];
try {
  files = fs.readdirSync(SCRIPTS).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
} catch {
  // ★ 前置不可用 ⇒ exit 2（本项目惯例：2 = 前置不可用）。
  console.error(`✘ 读不到 \`${SCRIPTS}\`（目录不存在 / 不可读）⇒ 无法开工`);
  process.exit(2);
}

const fails = [];     // { gate, kind, detail }
const infos = [];     // { gate, kind, detail }  —— 只列不判
let declParsed = 0;   // 解析到「退出码声明」的闸门数
let actualParsed = 0; // 解析到「实际退出码」的闸门数

for (const f of files) {
  const full = path.join(SCRIPTS, f);
  let src;
  try { src = fs.readFileSync(full, 'utf8'); } catch { fails.push({ gate: f, kind: 'read', detail: `读不到文件：${full}` }); continue; }
  const { head, body } = splitHead(src);
  const bodyNC = stripComments(body);

  // ── 判据① ──
  const D = declaredCodes(head);
  const A = actualCodes(body);
  if (A.size) actualParsed++;
  if (D === null) {
    fails.push({ gate: f, kind: 'exit-decl-missing', detail: '头注释里**没有**规范 `退出码：` 声明行（写法变了 / 忘写）' });
  } else {
    declParsed++;
    const ds = [...D].sort().join(','), as = [...A].sort().join(',');
    if (ds !== as) {
      const miss = [...A].filter((x) => !D.has(x));
      const extra = [...D].filter((x) => !A.has(x));
      const bits = [];
      if (miss.length) bits.push(`实际有而声明没有：{${miss.join(',')}}`);
      if (extra.length) bits.push(`声明有而实际没有：{${extra.join(',')}}`);
      fails.push({ gate: f, kind: 'exit-codes',
        detail: `头注释声明 {${ds}} / 代码实际 {${as}}（${bits.join('；')}）` });
    }
  }

  // ── 判据② ──
  const C = labelOrdinals(bodyNC);
  if (C.size) {
    const H = headOrdinals(head);
    const unclaimed = [...C].filter((o) => !H.has(o));
    if (unclaimed.length) {
      fails.push({ gate: f, kind: 'criteria-label',
        detail: `代码输出里有 判据${unclaimed.join('、判据')}，但头注释**从没提过** ${unclaimed.join('、')}` });
    }
  }

  // ── 判据③ ──
  if (/失明/.test(head || '')) {
    if (!/失明/.test(bodyNC) && !/\bblind\b/.test(bodyNC)) {
      fails.push({ gate: f, kind: 'blind-guard',
        detail: '头注释称「失明」，但**剥注释后**的代码体里既没有 `失明` 也没有 `blind`（失明守卫可能已被删/改名）' });
    }
  }

  // ── 判据⑤（ℹ）──
  for (const c of ordinalClaims(head)) {
    if (c.n !== files.length) {
      infos.push({ gate: f, kind: 'ordinal',
        detail: `头注释称「第 ${c.n} 个 check-* 闸门」，实测 ${files.length} 个：${c.line}` });
    }
  }
}

// ── 判据④ 失明守卫（防空转绿灯；失明时**不再输出判据①②③**）────────────────
const blindReasons = [];
if (files.length === 0) {
  blindReasons.push(`\`${SCRIPTS}\` 下扫到 **0 个** \`check-*.mjs\`（路径 / 过滤变了？）⇒ 判据①②③ 一条都没跑`);
} else {
  if (declParsed === 0) {
    blindReasons.push(`扫到 ${files.length} 个闸门，但**一条** \`退出码：\` 声明都没解析到 ⇒ 判据① 空转（声明行写法变了？）`);
  }
  if (actualParsed === 0) {
    blindReasons.push(`扫到 ${files.length} 个闸门，但**一个** \`process.exit*\` 都没解析到 ⇒ 判据① 的实际侧空转`);
  }
}
const blind = blindReasons.length > 0;
const ok = !blind && fails.length === 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({
    scripts: SCRIPTS,
    gates: files.length,
    parsed: { declared: declParsed, actual: actualParsed },
    fails: fails.map((f) => ({ gate: f.gate, kind: f.kind, detail: f.detail })),
    infos: infos.map((i) => ({ gate: i.gate, kind: i.kind, detail: i.detail })),
    blind: blindReasons,
    counts: { fails: fails.length, infos: infos.length, blind: blindReasons.length },
    ok,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

console.log('闸门自陈闸门 —— 守「`scripts/check-*.mjs` 的**头注释** ↔ 它的**实际实现**」');
console.log('  判据: ① 退出码声明 == 实际 | ② 代码输出的 判据<序号> 头注释都提过 | ③ 头注释称「失明」⇒ 代码里有失明线索 |');
console.log('        ④ 失明守卫（0 闸门 / 0 声明 / 0 实际 ⇒ 失明）| ⑤「第 N 个」序号只列不判');
console.log(`  扫描: ${SCRIPTS}（${files.length} 个闸门）`);
console.log('');

if (blind) {
  console.log('✘ 本闸门已失明：');
  for (const r of blindReasons) console.log(`  ✘ ${r}`);
} else {
  if (fails.length) {
    console.log(`✘ 头注释自陈与实现不符 ${fails.length} 处：\n`);
    const groups = [
      ['exit-codes', '判据① 退出码声明 ≠ 实际'],
      ['exit-decl-missing', '判据① 头注释缺 `退出码：` 声明'],
      ['criteria-label', '判据② 代码输出的判据序号头注释没提'],
      ['blind-guard', '判据③ 头注释称「失明」但代码里没有失明线索'],
      ['read', '读不到文件'],
    ];
    for (const [kind, title] of groups) {
      const g = fails.filter((x) => x.kind === kind);
      if (!g.length) continue;
      console.log(`  ── ${title}（${g.length} 处）──`);
      for (const x of g) console.log(`    · ${x.gate.padEnd(34)} ${x.detail}`);
      console.log('');
    }
  } else {
    console.log('✓ 所有闸门的头注释自陈与实现一致（退出码声明 == 实际；代码输出的判据序号头注释都提过；称「失明」的都有失明线索）。');
  }

  if (infos.length) {
    console.log(`\nℹ 判据⑤（**只列不判**）「第 N 个 check-* 闸门」序号已陈旧 ${infos.length} 条（序号天生是快照 ⇒ 不判 FAIL；带上「写作时 / 当时」等限定词的写法已跳过）：`);
    for (const i of infos) console.log(`    · ${i.gate.padEnd(34)} ${i.detail}`);
  }

  console.log(`\n[闸门] 闸门 ${files.length} 个 / 退出码声明解析 ${declParsed} / 实际退出码解析 ${actualParsed}`
    + ` / 判据① FAIL ${fails.filter((x) => x.kind === 'exit-codes' || x.kind === 'exit-decl-missing').length}`
    + ` / 判据② FAIL ${fails.filter((x) => x.kind === 'criteria-label').length}`
    + ` / 判据③ FAIL ${fails.filter((x) => x.kind === 'blind-guard').length}`
    + ` / ℹ 序号陈旧 ${infos.length} ${ok ? 'OK' : '✘'}`);
}
process.exitCode = ok ? 0 : 1;
