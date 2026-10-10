#!/usr/bin/env node
/**
 * scripts/check-visible-hints.mjs —— 「**用户可见文案**里不许引用**已删的东西**」闸门
 *   （★ **写作时**本仓第 48 个 `check-*` 闸门；★ 序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 为什么需要它（本闸门的存在理由）
 * ══════════════════════════════════════════════════════════════════════════════
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
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（只做一件窄而准的事）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★ 设计纪律：**先剥注释、只看字符串**（与 `check-no-sync-spawn.mjs` **正好相反** —— 它剥注释、
 *     **保留字符串**、找**实调用**；本闸门复用它的**剥注释状态机**，但**只取字符串字面量**）。
 *     理由：本仓把**旧句 + 日期订正**正当保留在**注释**里（如 `lib/llm-api.mjs:1492-1499` 的
 *     7 条旧 hint）—— 那必须放行；只看字符串才不会假阳。
 *
 *   **扫描范围 = 只扫「用户可见的字符串」**（三个目标文件，逐个定抽取法）：
 *     · `lib/llm-api.mjs`（JS）：剥注释后取**含中文的字符串字面量**（本项目面向用户的文案一律是
 *       中文散文）—— 这**天然**排除了 `cfg.kind === 'anthropic'` 这类**代码里的**适配器名（无中文），
 *       也排除了注释里的旧句。
 *     · `web/index.html`（HTML）：剥注释 / `<script>` / `<style>` 后取 `title=` / `placeholder=` /
 *       `aria-label=` 的**属性值** + **可见文本节点**。
 *     · `web/app.js`（JS）：同 `lib/llm-api.mjs`（含中文的字符串字面量）。
 *
 *   **判据① 违禁词三个维度**（用户可见串里出现即违规）：
 *     (a) **已删控件 id**（25 个：`llmProfile` / `llmKind` / `llmBaseUrl` / `llmKey` / `btnLlmSave`…）
 *         —— 核法：`grep` `web/index.html` 确认这些 id **确实已不存在**（实测 0 处）。
 *     (b) **已删 profile 名**（11 个：`anthropic` / `openai-compatible` / `doubao` / … / `custom`）
 *         —— 核法：`lib/llm-api.mjs` 的 `PROFILES` 现只剩 `workbuddy`（实测 1 条）。
 *         ★★ **怎么区分「推荐给用户」与「适配器名仍在用」**：适配器名（`anthropic` /
 *           `openai-compatible` / `custom`）**仍存在且在用**（如 `cfg.kind === 'anthropic'`）——
 *           那是**代码**、**不含中文** ⇒ 被 (JS) 抽取法**天然排除**；只有写进**用户可见串**才算
 *           「推荐」。★ 大小写**敏感**（`Anthropic 协议…` / `ANTHROPIC_API_KEY` 是**别的东西**、
 *           不是 profile id ⇒ 不判）。
 *         ★ **日期订正豁免**：串内自带订正标记（`订正` / `本软件只接 WorkBuddy` / `面板已无`）
 *           ⇒ 视为「保留原句 + 日期订正」的**已修形态**（本仓惯例）⇒ 该串的 profile 名**不判**
 *           （实测 `lib/llm-api.mjs:1053/1074/1095` 三条 `message` 即此形态）。
 *     (c) **已删「引导语」**（面板零输入控件后**做不到**的操作）—— 每条都是**被替换掉的旧 hint**
 *         的片段：`请在面板补齐` / `面板补齐` / `请在面板填写` / `面板填写` / `在面板填` /
 *         `补齐 Endpoint` / `确认 Endpoint` / `检查 Endpoint` / `填 Endpoint` / `换 kind=` /
 *         `换用别的` / `请填 Key` / `请核对 Key`。
 *
 *   **判据② 两层语义（登记表 ⇒ 只列 ℹ；未登记 ⇒ FAIL 并点名）**
 *     · `BACKLOG`（键 = `<相对仓根路径>:<违禁词>`，值 = 「为什么保留」）—— 命中只列 ℹ；
 *       未登记 ⇒ FAIL 并点名 `<文件>:<行号> <违禁词>`。★ 当前**为空**（刚修完），但留出口。
 *
 *   **判据③ 失明守卫（防空转绿灯）**
 *     · 一个待扫文件都没读到 / **一个用户可见字符串都没提取到** ⇒ **FAIL 且明说「本闸门已失明」**，
 *       且失明时**不再输出判据①②**。理由：抽取逻辑坏了 ⇒ 恒空集 ⇒ 假绿。
 *
 *   **判据④ `--json`**（照 `check-no-sync-spawn.mjs`：JSON 模式下 stdout 只出 JSON，退出码同非 JSON）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做语义理解**：不解析 AST、不 import 被测模块；只按**固定抽取法**取串。
 *   · **不是全量「用户可见」**：JS 只认**含中文**的字符串字面量 ⇒ **纯英文**的用户可见串（本仓
 *     目前没有）**看不见**（假阴，如实写）；HTML 不扫 `<option value>` 等**非展示**属性。
 *   · **不判「文案好不好」**：只判「有没有引用已删的东西」。
 *   · **已知盲区**：模板串 `${}` 里的**代码**不单独剔除（本仓 `hintFor` 的 `${cfg.id}` /
 *     `${rtHint}` 都不含违禁词）；**别名 / 拼接**出来的串（`'请在' + '面板补齐'`）判不到（假阴）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 验证（临时夹具 `D:/lemo-tmp/`，前缀 `vh-`；全程不动真实仓）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**：真实仓 ⇒ **exit 0**（实测提取 N 条用户可见串、命中 0）。
 *   · **变异**：夹具 `hintFor` 某 case 的返回串塞「请在面板补齐 Endpoint」⇒ **exit 1 并点名**。
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

// ── 违禁词（三个维度）────────────────────────────────────────────────────────
//   (a) 已删控件 id —— 核法：grep web/index.html 确认这些 id 已不存在（实测 0 处）。
const DELETED_IDS = [
  'llmProfile', 'llmProfileBadge', 'llmProfileHint', 'llmKind', 'llmKindHint',
  'llmBaseUrl', 'llmTarget', 'llmModel', 'llmModelSelect', 'llmModelList', 'llmModelHint',
  'llmTimeout', 'llmKey', 'llmKeyState', 'llmCustomRows', 'llmPath', 'llmExtract',
  'llmHeaders', 'llmHeadersHint', 'llmTask', 'llmTryText', 'llmTryOut',
  'btnLlmModels', 'btnLlmSave', 'btnLlmClearKey',
];
//   (b) 已删 profile 名 —— 核法：lib/llm-api.mjs 的 PROFILES 现只剩 workbuddy（实测 1 条）。
//   ★ 大小写敏感：Anthropic 协议 / ANTHROPIC_API_KEY 是**别的东西**，不是 profile id。
const DELETED_PROFILES = [
  'anthropic', 'openai-compatible', 'doubao', 'qwen', 'hunyuan', 'deepseek',
  'zhipu', 'kimi', 'siliconflow', 'lmstudio', 'custom',
];
//   (c) 已删「引导语」—— 面板零输入控件后**做不到**的操作；每条都是**被替换掉的旧 hint** 的片段
//       （见 lib/llm-api.mjs:1492-1499 保留的旧句）。
const DELETED_AFFORDANCES = [
  '请在面板补齐', '面板补齐', '请在面板填写', '面板填写', '在面板填',
  '补齐 Endpoint', '确认 Endpoint', '检查 Endpoint', '填 Endpoint',
  '换 kind=', '换用别的', '请填 Key', '请核对 Key',
];
//   ★ 日期订正豁免：串内自带订正标记 ⇒ 该串的 profile 名不判（本仓「保留原句 + 日期订正」惯例）。
const CORRECTION_RE = /订正|本软件只接\s*WorkBuddy|面板已无/;

// ── BACKLOG：已登记的违规（只列 ℹ、不判 FAIL）──────────────────────────────────
//   键 = `<相对仓根路径>:<违禁词>`；值 = 「为什么保留」。
//   ★ 当前**为空**：刚修完（hintFor 9 条 + tooltip）。这是「留出口」—— 若将来确有一处**必须**
//     保留的旧文案且经评估属有意为之，登进这里（只列 ℹ），而**不要**为了让闸门变绿去放宽判据。
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

// ── 前置不可用（exit 2）：三个目标文件**一个都不存在** ⇒ 无法开工 ──────────────
const existing = TARGETS.filter((t) => fs.existsSync(path.join(ROOT, t.rel)));
if (existing.length === 0) {
  const dirs = [...new Set(TARGETS.map((t) => path.dirname(path.join(ROOT, t.rel))))];
  console.error(`✘ 读不到任何一个待扫文件（${TARGETS.map((t) => t.rel).join(' / ')}；`
    + `在 \`${dirs.join('`、`')}\` 下）⇒ 无法开工`);
  process.exit(2);
}

// ── 抽取「用户可见字符串」────────────────────────────────────────────────────
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const CONTROL_RE = new RegExp('\\b(' + DELETED_IDS.join('|') + ')\\b', 'g');
const PROFILE_RE = new RegExp('\\b(' + DELETED_PROFILES.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g');

const strings = [];   // { file, line, text }
let scanRead = 0;
for (const t of TARGETS) {
  const abs = path.join(ROOT, t.rel);
  let raw;
  try { raw = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  scanRead++;
  const stripped = t.kind === 'html' ? raw : stripComments(raw);
  const found = t.kind === 'html' ? htmlStrings(stripped) : jsStrings(stripped);
  for (const s of found) {
    if (!hasCJK(s.raw)) continue;                    // ★ 只认「中文散文」= 用户可见文案
    strings.push({ file: rel(abs), line: s.line, text: s.raw });
  }
}

// ── 判据① 违禁词三维度（扫每个用户可见串）────────────────────────────────────
const findings = [];   // { file, line, dim, token, excerpt }
const seen = new Set();
const record = (file, line, dim, token, text) => {
  const key = `${file}|${line}|${dim}|${token}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({ file, line, dim, token, excerpt: text.replace(/\s+/g, ' ').slice(0, 90) });
};
for (const s of strings) {
  for (const m of s.text.matchAll(CONTROL_RE)) record(s.file, s.line, '已删控件id', m[1], s.text);
  for (const a of DELETED_AFFORDANCES) if (s.text.includes(a)) record(s.file, s.line, '已删引导语', a, s.text);
  if (!CORRECTION_RE.test(s.text)) {                 // ★ 日期订正豁免（仅 profile 维）
    for (const m of s.text.matchAll(PROFILE_RE)) record(s.file, s.line, '已删profile名', m[1], s.text);
  }
}

// ── 判据③ 失明守卫（防空转绿灯）─────────────────────────────────────────────
const blind = [];
if (scanRead === 0) blind.push(`枚举到 ${TARGETS.length} 个待扫文件，却**一个都没读成功**（路径变了？）`);
else if (strings.length === 0) {
  blind.push(`扫了 ${scanRead} 个文件，却**一个用户可见字符串都没提取到** ⇒ 判据① 恒为空集（本闸门已失明）`);
}

// ── 判据② 两层语义 ──────────────────────────────────────────────────────────
const registered = [];     // { key, why, where }
const unregistered = [];   // { key, where }
if (blind.length === 0) {
  for (const f of findings) {
    const key = `${f.file}:${f.token}`;
    const where = `${f.file}:${f.line} ${f.dim}「${f.token}」 —— ${f.excerpt}`;
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
    detail: `**未登记的违规** ${unregistered.length} 处（用户可见文案引用了**已删的东西** ⇒ 会误导用户）：\n`
      + unregistered.map((u) => `     ✘ ${u.where}`).join('\n')
      + `\n     · 修法：把文案改成**成立**的说法（本软件只接 WorkBuddy；端点与口令由运行时注入，无需手工填写；旧句**保留在注释里** + 加日期订正）。`
      + `\n     · 若**确属有意保留** ⇒ 登进本闸门的 \`BACKLOG\`（键 = \`<文件>:<违禁词>\`，值 = 一句「为什么保留」）。`,
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
    findings: findings.length,
    registered: registered.map((r) => r.where),
    unregistered: unregistered.map((u) => u.where),
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
} else {
  console.log('「用户可见文案不得引用已删控件 / 已删 profile / 已失效操作」闸门 —— 守两条减法指令留下的文案债');
  console.log('  判据: ① 剥注释后**只取用户可见字符串**（JS=含中文的串 / HTML=title·placeholder·aria-label + 可见文本），扫违禁词三维度 |');
  console.log('        ② 两层语义（BACKLOG ⇒ 只列 ℹ；未登记 ⇒ FAIL） | ③ 失明守卫（0 文件 / 0 用户可见串 ⇒ 失明） | ④ `--json`');
  console.log(`  被测: ${ROOT}`);
  console.log(`  扫描: ${scanRead} 个文件；提取用户可见字符串 ${strings.length} 条；命中违禁词 ${findings.length} 处`);
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
      + ` · 命中 ${findings.length} 处（已登记 ${registered.length} / 未登记 ${unregistered.length}）`
      + ` · 违约 ${fails.length} 处 ${ok ? 'OK' : '✘'}`);
    process.exitCode = ok ? 0 : 1;
  }
}
