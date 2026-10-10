#!/usr/bin/env node
/**
 * scripts/check-visible-hints.mjs —— 「**用户可见文案**里出现的控件 id 必须**真实存在**」闸门
 *   （★ **写作时**本仓第 48 个 `check-*` 闸门；★ 序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 为什么需要它（本闸门的存在理由）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★★ **2026-10-10 初版原文（保留，勿抹 —— 这是本闸门的出身）**：
 *   委托方先后下达两条**减法**指令：
 *     · API 模块**只接 WorkBuddy** —— `lib/llm-api.mjs` 的 `PROFILES` 从 12 个砍到 **1 个**
 *       （删掉 11 个内置 profile：`anthropic` / `openai-compatible` / `doubao` / `qwen` /
 *        `hunyuan` / `deepseek` / `zhipu` / `kimi` / `siliconflow` / `lmstudio` / `custom`）；
 *     · 「AI 算力配置」面板**极简化** —— 28 控件 → 9 id、**零输入控件**（`web/index.html` 里
 *       那批 `llmProfile` / `llmKind` / `llmBaseUrl` / `llmKey` / `btnLlmSave` / … 控件全部删除）。
 *   ★ 但**删完之后，用户可见的引导文案仍在指向已删的东西**，而**没有任何闸门能发现**：
 *     · `hintFor()` 返回的文案经 `validate().hint` → **`web/app.js` 原样显示在「测试连接」下方**
 *       ⇒ 用户点「测试连接」失败时被指去**根本不存在的字段 / 选项**（「请在**面板**补齐
 *       Endpoint / Key / 模型名」、「换 `kind=openai-compatible` / `anthropic`」、
 *       「换用别的 **profile** / 模型」）；
 *     · `web/index.html` 的顶栏 **tooltip** 也写着「这里可切换」（指向已删控件）。
 *   ★ 这批文案**已修**（`lib/llm-api.mjs` 的 9 条 hint + tooltip 已改写；旧句**保留在注释里**
 *     + 加日期订正）—— 但**没有闸门守它** ⇒ 将来还会漂。⇒ 立此闸门，把「**用户可见文案不得
 *     引用已删控件 / 已删 profile / 已失效的操作**」从**约定**变成**机制**。
 *
 *   ★★ **2026-10-10 方向订正（本闸门被改造的由来 —— 逐条记下，别当无事发生）**：
 *     同日委托方又下发《通用AI算力API接入模块》规格 —— 要求**开放式、可插拔、不锁定服务商**。
 *     面板**已重建**（P3 交付：**41 个 `llm*` id**，含 `llmLabel` / `llmBaseUrl` / `llmKey` /
 *     `llmHeaders` / `llmTimeout` / `llmKind`（4 个 kind 的下拉）/ …）。⇒ **初版三个维度全部失效**：
 *       (a) **「已删控件 id」** —— 初版列的 25 个 id **大半被 P3 重新加回**（`llmBaseUrl` / `llmKey` /
 *           `llmTimeout` / `llmHeaders` / `llmTarget` / `llmModel` / `btnLlmSave` / … 实测均在
 *           `web/index.html` 里）⇒ 「这些 id 已删」这个**前提不再成立** ⇒ 该维度**整体撤掉**；
 *       (b) **「已删 profile 名」** —— `anthropic` / `openai-compatible` / `custom` 现在是**用户可选
 *           的「适配器类型 kind」**（`web/index.html:355-360` 的 `#llmKind` 下拉里真实存在）⇒
 *           它们是**合法 kind**，**不再是**「已删 profile 名」⇒ 该维度**整体撤掉**（否则 100% 误报）；
 *       (c) **「已删引导语」** —— 「请在面板补齐 Endpoint / Key」「换 kind=…」等，面板**现在真能填**
 *           （`llmBaseUrl` / `llmKey` / `llmKind` 等控件已回归）⇒ 这些引导语**变成成立的说法**
 *           ⇒ 逐条重新裁定后**全部撤掉**（裁定见报告）。
 *     ★★ 但**本闸门不该被删** —— 它守的是一个**方向无关的不变量**（见 ②）。故**换不变量**，
 *        而不是**取消守卫**（★ 铁律：不许为了让闸门变绿去**清空违禁表**）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据：**一个方向无关的不变量**
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★★ **不变量**：**用户可见文案里出现的每一个 `llm*` / `btnLlm*` 形态的控件 id，都必须在
 *      `web/index.html` 里真实存在**（即：它是页面上某个元素的 `id="…"`）。
 *   ★ 为什么**方向无关**：无论面板是「极简化（9 id、零输入控件）」还是「开放式（41 id、可插拔）」
 *     这条都成立 —— 它守的是「**文案与实际控件一致**」；而「**文案把用户指去一个不存在的控件**」
 *     正是本会话复盘出的**核心缺陷类**（用户被指去根本不存在的字段）。★ 它**不假设**任何 id
 *     该不该存在，只假设「**说了就得有**」⇒ **方向变了也不用改判据**。
 *
 *   ★ 抽取法（**保留初版的「先剥注释、只看字符串」机制**，并补一条：**剥模板串里的 `${…}` 插值**）：
 *     · 扫描范围 = 只扫「用户可见的字符串」（三个目标文件，逐个定抽取法）：
 *       · `lib/llm-api.mjs`（JS）：剥注释后取**含中文的字符串字面量**（本项目面向用户的文案一律是
 *         中文散文）—— 这**天然**排除了 `cfg.kind === 'anthropic'` 这类**代码里的**标识符（无中文），
 *         也排除了注释里的旧句。
 *       · `web/index.html`（HTML）：剥注释 / `<script>` / `<style>` 后取 `title=` / `placeholder=` /
 *         `aria-label=` 的**属性值** + **可见文本节点**。
 *       · `web/app.js`（JS）：同 `lib/llm-api.mjs`（含中文的字符串字面量）。
 *     · 从这些**用户可见串**里提取 `\b(?:btn)?[Ll]lm[A-Za-z]+\b` 形态的 token（例：`llmBaseUrl` /
 *       `btnLlmSave`），逐个断言它在 `web/index.html` 的 **id 集合**里；不在 ⇒ FAIL 并点名。
 *     · ★ **模板串插值**（`` `当前生效：${llmActiveLabel()}` ``）：`${…}` 里是**代码**不是散文 ⇒
 *       提取 token 前**先抹掉**（否则会把变量名 `llmActiveLabel` / `llmState` 误判成控件 id ——
 *       实测本仓有 3 处这样的假阳，见报告「误报率实测」）。
 *   ★ **参照 id 集合**：从 `web/index.html` 剥注释 / script / style 后取 `id="…"` 的属性值
 *     （实测本仓 224 个 id，其中 41 个是 `llm*` / `btnLlm*`）。
 *
 *   **判据② 两层语义（登记表 ⇒ 只列 ℹ；未登记 ⇒ FAIL 并点名）**
 *     · `BACKLOG`（键 = `<相对仓根路径>:<token>`，值 = 「为什么保留」）—— 命中只列 ℹ；
 *       未登记 ⇒ FAIL 并点名 `<文件>:<行号> 不存在的控件id「<token>」`。★ 当前**为空**，但留出口。
 *
 *   **判据③ 失明守卫（防空转绿灯）**（三态，任一即失明）
 *     · 一个待扫文件都没读到；或
 *     · **一个用户可见字符串都没提取到**；或
 *     · **`web/index.html` 的 id 集合为空**（判据① 的**参照集合**没了 ⇒ 判定无从谈起）。
 *     ⇒ **FAIL 且明说「本闸门已失明」**，且失明时**不再输出判据①②**。
 *
 *   **判据④ `--json`**（照 `check-no-sync-spawn.mjs`：JSON 模式下 stdout 只出 JSON，退出码同非 JSON）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做语义理解**：不解析 AST、不 import 被测模块；只按**固定抽取法**取串。
 *   · **不是全量「用户可见」**：JS 只认**含中文**的字符串字面量 ⇒ **纯英文**的用户可见串（本仓
 *     目前没有）**看不见**（假阴，如实写）；HTML 不扫 `<option value>` 等**非展示**属性。
 *   · **不判「文案好不好」**：只判「文案里的控件 id 是否**真实存在**」。
 *   · **不判适配器 kind / profile 名**（★ 2026-10-10 订正，**有意收窄**）：新方向下 `anthropic` /
 *     `openai-compatible` / `custom` 是**合法可选 kind**（`#llmKind` 下拉里真实存在）⇒ 出现在
 *     用户可见文案里**不算违规**。初版的 (b) 维度在新方向下 100% 误报 ⇒ **撤掉**。
 *   · **已知盲区**：`${…}` 插值里**用字符串拼出来**的 id（`` `${'llm'+'Foo'}` ``）判不到（假阴）；
 *     **别名 / 拼接**出来的串（`'请在面板' + '补齐'`）判不到（假阴）；**动态创建**的 id
 *     （`app.js` 里 `el(...).id = …`）不在 `web/index.html` 的 id 集合里 ⇒ 若文案引用它会被
 *     **误报**（本仓当前无此情形，实测 0）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 验证（临时夹具 `D:/lemo-tmp/`，前缀 `p4c-`；全程不动真实仓）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**：真实仓 ⇒ **exit 0**（实测提取 1114 条用户可见串、命中 0）。
 *   · **变异**：夹具里往某个用户可见串塞一个**不存在的 `llm*` id** ⇒ **exit 1 并点名**。
 *   · **反向诱惑**：同一句写进**注释**（**不是字符串**）⇒ **必须仍 exit 0**（证明「剥注释」生效）。
 *   · **失明**：夹具三个文件都在、但**一个用户可见串都没有** ⇒ **exit 1 +「本闸门已失明」**。
 *   · 同一套断言写在 `test/gate-blindness.test.mjs` 的 `check-visible-hints` 用例里。
 *
 * 用法：node scripts/check-visible-hints.mjs [--json]
 * 环境变量：LEMO_TOOLS_ROOT  工具仓根（默认 `<脚本>/..`，与 `check-no-sync-spawn` /
 *          `check-doc-coverage` / `check-lib-exports` **同名同义**）—— 供**非破坏**变异验证。
 * 退出码：0 = 全绿（无未登记的违规、无失明）；
 *         1 = 有 FAIL（未登记的违规），或**本闸门已失明**；
 *         2 = 前置不可用（三个目标文件**一个都不存在** ⇒ 无法开工）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ★ 覆盖点：工具仓根（同名同义于 check-no-sync-spawn / check-doc-coverage / check-lib-exports）。 */
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
const JSON_MODE = process.argv.includes('--json');

// ── 待扫文件（★ 只这三处：用户可见文案的三个出处）─────────────────────────────
const TARGETS = [
  { rel: 'lib/llm-api.mjs', kind: 'js' },
  { rel: 'web/index.html', kind: 'html' },
  { rel: 'web/app.js', kind: 'js' },
];

// ── ★★ 不变量（方向无关）：用户可见文案里的控件 id 必须真实存在 ────────────────
//   · 待判 token 形态：`llm*` / `btnLlm*`（例：`llmBaseUrl` / `btnLlmSave`）。
//   · 参照集合来源：`web/index.html` 的 `id="…"`（见 ID_SOURCE_REL）。
//   ★ 为什么形态取 `[Ll]lm` 而非 `llm`：本仓 id 里 `btnLlmAdd` 的 `Llm` 是大写 L。
//   ★ 为什么要 `[A-Za-z]+`（≥1 个字母）：避免把散文里裸写的「llm」当成控件 id。
const ID_TOKEN_RE = /\b(?:btn)?[Ll]lm[A-Za-z]+\b/g;
const ID_SOURCE_REL = 'web/index.html';
const ID_ATTR_RE = /\bid\s*=\s*("([^"]*)"|'([^']*)')/g;

// ── BACKLOG：已登记的违规（只列 ℹ、不判 FAIL）──────────────────────────────────
//   键 = `<相对仓根路径>:<token>`；值 = 「为什么保留」。
//   ★ 当前**为空**：改造后真实仓 0 命中。这是「留出口」—— 若将来确有一处**必须**保留的
//     悬空引用且经评估属有意为之，登进这里（只列 ℹ），而**不要**为了让闸门变绿去放宽判据。
const BACKLOG = new Map(Object.entries({
  // （空）
}));

// ── 剥注释（**保留字符串字面量**）—— 状态机；行号不变 ───────────────────────
//   ★ 与 `check-no-sync-spawn.mjs` / `check-lib-exports.mjs` 的剥注释实现同源。
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

/** 该下标所在行号（1-based）。剥注释保留 `\n` ⇒ 行号与原文件一致。 */
function lineOf(text, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (text[i] === '\n') n++;
  return n;
}

/** 含中文（汉字 / 中文标点 / 全角）⇒ 判为「面向用户的散文」候选。 */
const hasCJK = (s) => /[\u3000-\u9fff\uff00-\uffef]/.test(s);

/** ★ 把模板串里的 `${…}`（**代码插值**）抹成空格 —— 只留散文，免得把变量名当控件 id。 */
function stripInterpolations(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '$' && raw[i + 1] === '{') {
      let depth = 1; i += 2;
      while (i < raw.length && depth > 0) {
        if (raw[i] === '{') depth++;
        else if (raw[i] === '}') depth--;
        if (depth === 0) break;
        i++;
      }
      out += ' ';
      continue;
    }
    out += raw[i];
  }
  return out;
}

/** 从**已剥注释**的 JS 文本里取字符串字面量（`'` `"` `` ` ``），含行号。 */
function jsStrings(text) {
  const out = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      const start = i; i++;
      while (i < n) {
        const d = text[i];
        if (d === '\\') { i += 2; continue; }
        if (d === c) { i++; break; }
        if (c !== '`' && d === '\n') break;      // 普通字符串不跨行
        i++;
      }
      out.push({ raw: text.slice(start, i), line: lineOf(text, start) });
    } else i++;
  }
  return out;
}

/** 从 HTML 源里取用户可见串：`title`/`placeholder`/`aria-label` 属性值 + 可见文本节点。 */
function htmlStrings(src) {
  const out = [];
  const blank = (m) => m.replace(/[^\n]/g, ' ');   // 保留换行 ⇒ 行号不变
  let text = src.replace(/<!--[\s\S]*?-->/g, blank);
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, blank);
  const attrRe = /\b(?:title|placeholder|aria-label)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = attrRe.exec(text)) !== null) {
    const val = m[2] !== undefined ? m[2] : m[3];
    if (val && val.trim()) out.push({ raw: val, line: lineOf(text, m.index) });
  }
  const visible = text.replace(/<[^>]*>/g, blank);   // 去标签，保留文本
  visible.split('\n').forEach((s, k) => { if (s.trim()) out.push({ raw: s, line: k + 1 }); });
  return out;
}

/** 从 HTML 源里取**真实存在的元素 id 集合**（剥注释 / script / style，只看标记里的 `id="…"`）。 */
function htmlIds(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  let text = src.replace(/<!--[\s\S]*?-->/g, blank);
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, blank);
  const ids = new Set();
  for (const m of text.matchAll(ID_ATTR_RE)) {
    const v = m[2] !== undefined ? m[2] : m[3];
    if (v && v.trim()) ids.add(v.trim());
  }
  return ids;
}

// ── 前置不可用（exit 2）：三个目标文件**一个都不存在** ⇒ 无法开工 ──────────────
const existing = TARGETS.filter((t) => fs.existsSync(path.join(ROOT, t.rel)));
if (existing.length === 0) {
  const dirs = [...new Set(TARGETS.map((t) => path.dirname(path.join(ROOT, t.rel))))];
  console.error(`✘ 读不到任何一个待扫文件（${TARGETS.map((t) => t.rel).join(' / ')}；`
    + `在 \`${dirs.join('`、`')}\` 下）⇒ 无法开工`);
  process.exit(2);
}

// ── 抽取「用户可见字符串」+ 参照 id 集合 ─────────────────────────────────────
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

const strings = [];   // { file, line, text }
let scanRead = 0;
let idSet = new Set();
for (const t of TARGETS) {
  const abs = path.join(ROOT, t.rel);
  let raw;
  try { raw = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  scanRead++;
  if (t.rel === ID_SOURCE_REL) idSet = htmlIds(raw);   // ★ 判据① 的**参照集合**
  const stripped = t.kind === 'html' ? raw : stripComments(raw);
  const found = t.kind === 'html' ? htmlStrings(stripped) : jsStrings(stripped);
  for (const s of found) {
    if (!hasCJK(s.raw)) continue;                    // ★ 只认「中文散文」= 用户可见文案
    strings.push({ file: rel(abs), line: s.line, text: s.raw });
  }
}

// ── 判据① 不变量：文案里的控件 id 必须真实存在 ────────────────────────────────
const findings = [];   // { file, line, token, excerpt }
const seen = new Set();
const record = (file, line, token, text) => {
  const key = `${file}|${line}|${token}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({ file, line, token, excerpt: text.replace(/\s+/g, ' ').slice(0, 90) });
};
for (const s of strings) {
  const prose = stripInterpolations(s.text);          // ★ 先抹 `${…}`（代码）再取 token
  for (const m of prose.matchAll(ID_TOKEN_RE)) {
    if (!idSet.has(m[0])) record(s.file, s.line, m[0], s.text);
  }
}

// ── 判据③ 失明守卫（防空转绿灯）─────────────────────────────────────────────
const blind = [];
if (scanRead === 0) blind.push(`枚举到 ${TARGETS.length} 个待扫文件，却**一个都没读成功**（路径变了？）`);
else if (strings.length === 0) {
  blind.push(`扫了 ${scanRead} 个文件，却**一个用户可见字符串都没提取到** ⇒ 判据① 恒为空集（本闸门已失明）`);
}
if (idSet.size === 0) {
  blind.push(`\`${ID_SOURCE_REL}\` 里**一个 \`id="…"\` 都没解析到** ⇒ 判据① 的**参照集合**为空（本闸门已失明）`);
}

// ── 判据② 两层语义 ──────────────────────────────────────────────────────────
const registered = [];     // { key, why, where }
const unregistered = [];   // { key, where }
if (blind.length === 0) {
  for (const f of findings) {
    const key = `${f.file}:${f.token}`;
    const where = `${f.file}:${f.line} 不存在的控件id「${f.token}」 —— ${f.excerpt}`;
    if (BACKLOG.has(key)) registered.push({ key, why: BACKLOG.get(key), where });
    else unregistered.push({ key, where });
  }
  registered.sort((a, b) => (a.where < b.where ? -1 : 1));
  unregistered.sort((a, b) => (a.where < b.where ? -1 : 1));
}
const fails = [];
if (unregistered.length) {
  fails.push({
    crit: '②',
    detail: `**未登记的违规** ${unregistered.length} 处（用户可见文案引用了**不存在的控件 id** ⇒ 会把用户指去不存在的字段）：\n`
      + unregistered.map((u) => `     ✘ ${u.where}`).join('\n')
      + `\n     · 修法：把文案里的 id 改成 \`${ID_SOURCE_REL}\` 里**真实存在**的那个（或把该控件补进页面）。`
      + `\n     · 若**确属有意保留** ⇒ 登进本闸门的 \`BACKLOG\`（键 = \`<文件>:<token>\`，值 = 一句「为什么保留」）。`,
  });
}

// ── 判据③ 失明守卫（结果）───────────────────────────────────────────────────
const blindGuard = blind.length > 0;
const ok = !blindGuard && fails.length === 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
if (JSON_MODE) {
  console.log(JSON.stringify({
    gate: 'check-visible-hints',
    root: ROOT,
    ok,
    blind: blindGuard,
    blindReasons: blind,
    fails,
    scanFiles: scanRead,
    userVisibleStrings: strings.length,
    idSetSize: idSet.size,
    findings: findings.length,
    registered: registered.map((r) => r.where),
    unregistered: unregistered.map((u) => u.where),
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
} else {
  console.log('「用户可见文案里的控件 id 必须真实存在」闸门 —— 方向无关的不变量（文案 ↔ 实际控件一致）');
  console.log('  判据: ① 剥注释后**只取用户可见字符串**（JS=含中文的串，先抹 `${…}` 插值 / HTML=title·placeholder·aria-label + 可见文本），');
  console.log('        逐个断言其中的 `llm*` / `btnLlm*` token 在 web/index.html 的 id 集合里真实存在 |');
  console.log('        ② 两层语义（BACKLOG ⇒ 只列 ℹ；未登记 ⇒ FAIL） | ③ 失明守卫（0 文件 / 0 用户可见串 / 0 参照 id ⇒ 失明） | ④ `--json`');
  console.log(`  被测: ${ROOT}`);
  console.log(`  扫描: ${scanRead} 个文件；提取用户可见字符串 ${strings.length} 条；参照 id 集合 ${idSet.size} 个；命中不存在的控件 id ${findings.length} 处`);
  console.log('');

  if (blindGuard) {
    console.log('✘✘ 本闸门已失明：');
    for (const b of blind) console.log(`   ✘ ${b}`);
    console.log('   ⇒ 「0 处违规」是假的，别信这个绿。请先修路径 / 抽取逻辑，再信本闸门的结论。');
    console.log('   ⇒ 已失明 ⇒ 判据①② 本次**不输出**（判据③ 是失明守卫本身）。');
    console.log('');
    console.log('[闸门] 用户可见文案：已失明 ⇒ 一条判据都没可信地跑过 ✘');
    process.exitCode = 1;
  } else {
    if (registered.length) {
      console.log(`  ℹ 判据②·已登记的违规 ${registered.length} 处（只列、不判 FAIL）：`);
      for (const r of registered) console.log(`     ℹ ${r.where} —— ${r.why}`);
    } else {
      console.log('  ✓ 判据②·已登记的违规 0 处');
    }
    if (fails.length) {
      for (const f of fails) console.log(`\n   ✘ 判据${f.crit}  ${f.detail}`);
    } else {
      console.log(`  ✓ 判据①·未登记的违规 0 处（扫 ${strings.length} 条用户可见串、0 命中）`);
    }
    console.log(`\n[闸门] 用户可见文案：扫描 ${scanRead} 个文件 · 用户可见串 ${strings.length} 条`
      + ` · 参照 id ${idSet.size} 个 · 命中 ${findings.length} 处（已登记 ${registered.length} / 未登记 ${unregistered.length}）`
      + ` · 违约 ${fails.length} 处 ${ok ? 'OK' : '✘'}`);
    process.exitCode = ok ? 0 : 1;
  }
}
