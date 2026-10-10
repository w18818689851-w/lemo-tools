#!/usr/bin/env node
/**
 * scripts/check-llm-call-params.mjs —— 「**业务层不得用身份类显式配置压掉面板算力**」闸门
 *   （★ **写作时**本仓 `check-*` 闸门之一；★ 序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 由来（委托方规格 + 一次**实证**的违反）
 * ══════════════════════════════════════════════════════════════════════════════
 *   委托方规格原话：
 *     「AI算力板块内接入的**所有模型为项目全局可用**，项目里**全部业务功能都可以使用该算力**，
 *      **并非仅限单一业务场景**。**算力配置修改、模型切换之后，全局所有业务同步生效**。
 *      **底层调用复用【通用AI算力API接入模块】能力**。」
 *   ★★ 实测违反：`lib/triple-check.mjs` 的 `askVlm()` **确实走了** `chat()`（入口对），
 *     但给 `chat()` 传了**身份类显式配置**（`kind` / `baseUrl` / `model`）——
 *     而模块的解析优先级是 **① 显式传参 > ② `LEMO_LLM_*` > ③ 面板覆盖文件 > ④ 运行时线索 > ⑤ 内置默认**
 *     ⇒ **显式（①）把面板（③）整个压掉**。
 *   ★ 实证方式：起两个桩（一个当「面板当前生效」、一个当本机 LM Studio），面板里配好并 `setActiveService`
 *     ⇒ 照 `askVlm` 的真实 opts 形状调 `chat()` ⇒ **面板桩收到 0 条、LM 桩收到 1 条**
 *     ⇒ 面板里「当前生效」那套**一次都没被用到**。
 *
 *   ★★ **本闸门补的是三道既有闸门都覆盖不到的盲区**：
 *     · `check-llm-call-sites`（第 43 个）= 守「**有没有走模块**」（**入口**）
 *     · `check-llm-facade-only`（第 49 个）= 守「**有没有绕开模块自读配置**」（**配置读写**）
 *     · `check-llm-global-effect`（第 50 个）= 守「**改了配置全局是否生效**」（**模块内部行为**）
 *     ⇒ ★ **三道全绿，却漏了「走了模块、但传显式身份配置压掉面板」这一类** ——
 *       因为三道都只看**入口**与**模块内部**，没人看**业务传给模块的实参**。
 *     ★ 立闸门的教训：**「入口正确」与「参数正确」是两条独立验收线**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（四条，**全过才 PASS**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① **身份类实参检测** —— 在扫描集内每个文件的**剥注释后**代码体里，找出对**模块调用类导出**的调用
 *      （`chat` / `chatWithFallback` / `invoke` / `listModels` / `validate` / `resolveConfig`），
 *      **切出该调用的实参文本**（按圆括号**配平**，含嵌套对象字面量），
 *      若其中出现**身份类键**（`kind` / `baseUrl` / `model` / `target`）⇒ **FAIL 并点名 `文件:行`**。
 *      ★ **为什么这四类键 = 身份类**：它们决定「**往哪个端点、用什么适配器、用哪个模型发**」——
 *        正是面板要全局掌控的那组（模块里同一个概念叫 `LLM_IDENTITY_FIELDS`）。
 *      ★ 不算身份类的（**允许**）：`timeoutMs` / `maxTokens` / `temperature` / `images` / `messages` /
 *        `service`（**选择器**：从**已保存**的服务里挑一个，不是内联配置）/ `fallback` / `headers` 之类**任务参数**。
 *   ② **例外清单（两层语义）** —— 已登记 ⇒ **只列 ℹ**（带「为什么必须传显式配置」+ 归属批次）；
 *      未登记 ⇒ ① 的 FAIL。★ 当前登记 **1** 条：`lib/triple-check.mjs` 的**回落路径**（见 ④ 已知局限）。
 *   ③ **例外不得「失效」** —— 登记的文件必须**仍然**存在 + **仍然**含身份类实参；
 *      否则「登记了但没了」⇒ FAIL（★ 防「登记表变成化石」）。
 *   ④ **失明守卫** —— 扫描根读不到 / **0 个文件**被扫 / 规范通路不在扫描集 /
 *      **一次模块调用都没抽到**（解析失效 ⇒ 判据① 会**恒为空集**而假绿）⇒
 *      **exit 2 +「本闸门已失明」**，且**不再输出判据①②③**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 扫描范围与「为什么不扫别处」
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **纳入**：`lib/**`（递归）+ `server.mjs` + 仓根 `*.mjs`（非递归）—— 这三处 = **后端运行时全部入口**。
 *   · **不纳入** `scripts/**`：闸门自己会**写出**这些键当**判据举例**（纳进来会**自指**）。
 *   · **不纳入** `test/**`：夹具/桩**本来就要**造各种配置（含身份类键）当**输入**。
 *   · **不纳入** `web/**`：前端不做推理，只发 HTTP；它的身份类字段由**服务端**按白名单剥离。
 *   ⇒ 三条**已知盲区**，如实登记（见 ④）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 已知局限（**必须如实知悉**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **例外是「按文件」的，不是「按调用点」的** —— 登记 `lib/triple-check.mjs` 后，
 *     该文件**任何**调用点传身份类配置都**不会被本闸门拦**。
 *     ★ 这是**有意取舍**：按调用点判定需要「语义分析」（判断某次调用是不是「回落」），静态做不到，
 *       硬做会**误报**。★ 该文件的**行为**由 `test/triple-check-flow.test.mjs` 的
 *       「面板优先 / 回落」两条用例**行为级**钉住 ⇒ **静态闸门管「有没有新的违规文件」，
 *       行为用例管「已登记文件内部有没有回归」**，两者分工。
 *   · **不做别名追踪**：若调用方先把配置存进变量（`const o = {kind:…}; chat(m, o)`），
 *     本闸门**看不见**。★ 要覆盖它需要真正的 AST 分析（或 TS/ESLint 规则），
 *     本闸门**宁可漏报不误报**（本项目一贯取舍）。
 *   · **不判「选择器」**：`opts.service`（从已保存服务里挑一个）**不算**违规 ——
 *     它是**选择器**不是**配置体**（与 `check-llm-facade-only` 的「铁律」同一口径）。
 *
 * 用法：node scripts/check-llm-call-params.mjs [--json]
 * 退出码：0 = 四条判据全过；1 = 有 FAIL；2 = **本闸门已失明**。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(path.join(HERE, '..'));
const JSON_OUT = process.argv.includes('--json');

/** ★ 规范通路（业务层「应当」经它拿配置，而**不是**自己钉配置）。 */
const FACADE_REL = 'lib/llm-api.mjs';
/** ★ 模块的**调用类**导出（会在实参里带配置的那几个）。 */
const CALL_EXPORTS = ['chatWithFallback', 'chat', 'invoke', 'listModels', 'validate', 'resolveConfig'];
/** ★ **身份类键** —— 决定「往哪个端点、用什么适配器、用哪个模型发」。 */
const IDENTITY_KEYS = ['kind', 'baseUrl', 'model', 'target'];
/**
 * ★★ **模块调用数的下限**（失明守卫用；写作时实测 **7** 次，取下限 **5** 留余量）。
 *   ★ 为什么需要它：**「抽到几次」本身就是失明指标** —— 我第一版正则漏了 `mod.chat(` 形态，
 *     实测只抽到 3 次却照样报 ✓（见下方失明守卫段的注释）。
 */
const MIN_EXPECTED_CALLS = 5;

/**
 * ★ **例外清单**（两层语义：已登记 ⇒ 只列 ℹ；未登记 ⇒ 判据① 的 FAIL）。
 *   ★ 每条必须写清「**为什么必须传显式配置**」—— 否则它会变成「为了让它绿而加的白名单」。
 */
const EXCEPTIONS = [
  {
    rel: 'lib/triple-check.mjs',
    why: '★★ **多模态画面校验的「本机回落」路径**：`askVlm()` **优先**走面板（只传任务参数），'
      + '**仅当面板那套不可用/失败时**才回落本机 LM Studio VLM（那里必须显式给 `kind`/`baseUrl`/`model`）。'
      + '★ 依据：帧校验需要「多模态图片输入」，而面板可能配的是纯文本模型；委托方另有明令「核心能力不可删减」。'
      + '★ 该回落**不静默**（返回里带 `via` 与面板侧失败原因）。'
      + '★ **行为**由 `test/triple-check-flow.test.mjs` 的「面板优先 / 回落」两条用例钉住。',
    batch: '2026-10-10「AI算力板块全局性」批次',
  },
];

// ── 工具：剥注释 **与字符串内容**（★ 行号必须保留 —— 报错要点名 `文件:行`） ────────────
/**
 * ★★ 为什么要**连字符串一起剥**（第一版没剥，实测**假阳性**）：
 *   `server.mjs` 里有一句**提示文案**写着 `…invoke()（另一个智能体在实现）…` ——
 *   那是**字符串**，不是调用；不剥字符串就会被当成一次「模块调用」。
 *   ★ 而**身份类键名**（`kind:` / `baseUrl:` …）是**代码里的对象键**、不在字符串里
 *     ⇒ 剥字符串**不会**让判据① 失明（这点与 `check-llm-call-notes` 那类「键名写在字符串里」的闸门**相反**，
 *     别照搬它们的口径）。
 *   ★ 换行**一律保留**（含模板字符串里的跨行），否则行号会漂。
 */
function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let st = null;            // null | "'" | '"' | '`' | '//' | '/*'
  while (i < n) {
    const c = src[i];
    const c2 = src.slice(i, i + 2);
    if (st === null) {
      if (c2 === '//') { st = '//'; i += 2; continue; }
      if (c2 === '/*') { st = '/*'; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { st = c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (st === '//') { if (c === '\n') { st = null; out += c; } i += 1; continue; }
    if (st === '/*') { if (c === '\n') out += c; if (c2 === '*/') { st = null; i += 2; } else i += 1; continue; }
    // 字符串态：**丢内容、留换行**；转义对跳过
    if (c === '\\') { if (c2[1] === '\n') out += '\n'; i += 2; continue; }
    if (c === st) { st = null; i += 1; continue; }
    if (c === '\n') out += c;
    i += 1;
  }
  return out;
}

/** ★ 从 `(` 起按**圆括号配平**切出实参文本（含嵌套对象/数组/函数体）；切不出 ⇒ `null`。 */
function sliceArgs(code, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < code.length; i += 1) {
    const c = code[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return { text: code.slice(openIdx + 1, i), end: i };
    }
  }
  return null;
}

/** ★ 收集扫描集（**显式列举**，不靠全仓遍历）。 */
function scanSet() {
  const rels = [];
  const walk = (dir, rel) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (e.name.endsWith('.mjs')) rels.push(r);
    }
  };
  walk(path.join(ROOT, 'lib'), 'lib');
  for (const f of ['server.mjs']) if (fs.existsSync(path.join(ROOT, f))) rels.push(f);
  let rootEnts = [];
  try { rootEnts = fs.readdirSync(ROOT, { withFileTypes: true }); } catch { /* 见失明守卫 */ }
  for (const e of rootEnts) {
    if (e.isFile() && e.name.endsWith('.mjs') && !rels.includes(e.name)) rels.push(e.name);
  }
  return [...new Set(rels)].sort();
}

// ── 主流程 ─────────────────────────────────────────────────────────────────
const rels = scanSet();
const blind = [];
const hits = [];        // { rel, line, key, call, text }
let callCount = 0;

if (rels.length === 0) blind.push('扫描集为空（`lib/**` + `server.mjs` + 仓根 `*.mjs` 一个都没读到）');
if (!rels.includes(FACADE_REL)) blind.push(`规范通路 ${FACADE_REL} **不在**扫描集里 ⇒ 判据失去参照`);

for (const rel of rels) {
  if (rel === FACADE_REL) continue;            // ★ 模块本体自己当然会用这些键（它就是实现）
  let src = '';
  try { src = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
  const code = stripCommentsAndStrings(src);
  for (const name of CALL_EXPORTS) {
    // ★★ 正则要点（**我第一版栽在这里，如实记下**）：必须同时覆盖两种真实形态 ——
    //   · **裸调用**：`chat(messages, opts)`（`lib/triple-check.mjs` 用 `import { chat }`）
    //   · **带属性前缀的调用**：`mod.validate(buildLlmOpts(body))`（`server.mjs` 用 `await import`）
    //   ⇒ 第一版写的是 `(?<![\w.$])chat\s*\(`，那个 `$` 把 **`mod.chat(` 整个排除了** ⇒
    //     实测只抽到 3 次调用（真实有 30+ 处）⇒ **闸门近乎失明却仍报 ✓**。
    //   ★ 教训：**「抽到的调用数」本身就是失明指标**，必须打出来并设下限（见判据④）。
    const re = new RegExp(`(?:[\\w$]+\\.)?${name}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(code)) !== null) {
      // ★ 排除**函数定义**（`function chat(` / `async function chat(`）—— 那不是「调用」。
      const before = code.slice(Math.max(0, m.index - 40), m.index);
      if (/(?:^|[^\w$])(?:async\s+)?function\s+$/.test(before)) continue;
      const openIdx = m.index + m[0].length - 1;
      const sl = sliceArgs(code, openIdx);
      if (!sl) continue;
      callCount += 1;
      const line = code.slice(0, m.index).split('\n').length;
      for (const key of IDENTITY_KEYS) {
        const kre = new RegExp(`(?<![\\w$.'"\`])${key}\\s*:`);
        if (kre.test(sl.text)) hits.push({ rel, line, key, call: name, text: sl.text.slice(0, 160).replace(/\s+/g, ' ') });
      }
    }
  }
}

if (callCount === 0) blind.push('**一次模块调用都没抽到** ⇒ 判据① 会恒为空集而**假绿**（解析失效？）');
// ★★ **调用数下限**（smoke floor）—— 这是本闸门**最要紧的失明守卫**。
//   ★ 由来（**我第一版实测栽过**）：正则写成 `(?<![\w.$])chat\s*\(` 时，`mod.chat(` 形态被整体排除，
//     实测只抽到 **3** 次（真实 7 次）—— 而闸门**照样打印 ✓**。⇒ ★ **「抽到几次」本身就是失明指标**，
//     不能只看「有没有 0 次」。⇒ 设一个**写作时实测值的下限**：
//     ★ 写作时（2026-10-10）实测 **7** 次（`lib/triple-check.mjs` 2 + `server.mjs` 5）；
//       取 **5** 作为下限（留 2 次余量，容忍正常的重构/合并）。
//     ★ 若项目**有意**缩减到低于此 ⇒ 请**同步下调本常量**并在报告里说明（★ 别默默放过）。
if (callCount > 0 && callCount < MIN_EXPECTED_CALLS) {
  blind.push(`只抽到 **${callCount}** 次模块调用（下限 ${MIN_EXPECTED_CALLS}）`
    + ' ⇒ 极可能是**解析失效**（正则/剥注释剥字符串出错）而非项目真的缩了 ⇒ 判据① 的结论不可信');
}

const regRels = new Set(EXCEPTIONS.map((e) => e.rel));
const registered = hits.filter((h) => regRels.has(h.rel));
const unregistered = hits.filter((h) => !regRels.has(h.rel));
const stale = EXCEPTIONS.filter((e) => {
  if (!fs.existsSync(path.join(ROOT, e.rel))) return true;
  return !hits.some((h) => h.rel === e.rel);
});

const blindMode = blind.length > 0;
const fails = [];
for (const h of unregistered) fails.push({ crit: '①', detail: `${h.rel}:${h.line} 调 ${h.call}(…) 时传了身份类键「${h.key}」⇒ 会压掉面板配置` });
for (const s of stale) fails.push({ crit: '③', detail: `登记的文件「${s.rel}」已不存在或已不含身份类实参 ⇒ 登记失效` });
const ok = !blindMode && fails.length === 0;

if (JSON_OUT) {
  console.log(JSON.stringify({
    gate: 'check-llm-call-params', root: ROOT, scanned: rels.length, calls: callCount,
    hits, registered, unregistered, stale, blind, ok, exit: blindMode ? 2 : (ok ? 0 : 1),
  }, null, 2));
  process.exitCode = blindMode ? 2 : (ok ? 0 : 1);
  process.exit();
}

console.log('算力调用参数闸门 —— 守「业务层不得用身份类显式配置压掉面板算力」');
console.log(`  判据: ① 身份类实参检测 | ② 例外清单（两层语义）| ③ 例外不得失效 | ④ 失明守卫`);
console.log(`  仓根 : ${ROOT}`);
console.log(`  范围 : lib/**（递归）+ server.mjs + 仓根 *.mjs；★ 不扫 scripts/**（自指）/ test/**（夹具）/ web/**（前端不做推理）`);
console.log(`  身份类键: ${IDENTITY_KEYS.join(' / ')}（★ 选择器 \`service\` 与任务参数不算）`);
console.log('');

if (blindMode) {
  console.log('✘✘ 本闸门已失明：');
  for (const b of blind) console.log(`   ✘ ${b}`);
  console.log('   ⇒ 「业务层没有压掉面板配置」这个结论**不可信**。');
  console.log('[闸门] 算力调用参数：**已失明** ⇒ 判据没可信地跑过 ✘');
  process.exitCode = 2;
  process.exit();
}

console.log(`  实测：扫 ${rels.length} 个 .mjs / 抽到 ${callCount} 次模块调用 / 命中身份类实参 ${hits.length} 处`);
console.log(`       其中已登记例外 ${registered.length} 处、未登记 ${unregistered.length} 处`);
console.log('');
if (unregistered.length === 0) console.log('✓ 判据①·**没有未登记的身份类实参**（业务层都在用面板配置）');
else {
  console.log(`✘ 判据①·有 ${unregistered.length} 处未登记的身份类实参：`);
  for (const h of unregistered) console.log(`   ✘ ${h.rel}:${h.line} —— 调 \`${h.call}(…)\` 传了 \`${h.key}\`\n        ${h.text}`);
  console.log('   ↳ 修法：**去掉身份类键**，只传任务参数（`timeoutMs`/`maxTokens`/`temperature`/`images`…），'
    + '让模块按面板（③ 覆盖文件）解析；★ 若确有「必须钉死」的理由 ⇒ 登记进本闸门的 `EXCEPTIONS` 并写清理由。');
}
console.log('');
if (registered.length) {
  console.log(`ℹ 判据②·已登记例外（**只列不判**）${registered.length} 处：`);
  for (const e of EXCEPTIONS) {
    const n = registered.filter((h) => h.rel === e.rel).length;
    if (n) console.log(`   · ${e.rel}（${n} 处）—— ${e.batch}`);
  }
}
for (const s of stale) console.log(`✘ 判据③·登记失效：${s.rel} —— ${s.why.slice(0, 60)}…`);

console.log(`\n[闸门] 算力调用参数：${fails.length ? `违约 ${fails.length} 处 ✘` : '违约 0 处 OK'}`);
process.exitCode = ok ? 0 : 1;
