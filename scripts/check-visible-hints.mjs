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
 *   ★★ **2026-10-10 三次订正（把 (c) 维度**加回** —— 上面「(c) 全部撤掉」的裁定**已不成立**）**：
 *     收窄后**只留**判据①（文案里的 `llm*` 控件 id 必须真实存在）—— ★★ **它抓不到本闸门立闸门时的
 *     目标缺陷类**：`hintFor()` 返回的那些**引导文案**（经 `validate().hint` → `web/app.js`
 *     **原样显示给用户**）里**一个 `llm*` token 都没有** ⇒ ★ **把 hint 改回旧的失效版本**
 *     （如「换用别的 `profile`」「请在面板补齐 <不存在的字段>」）**闸门照样 exit 0**
 *     ⇒ 用户被指去做**面板上做不到的事**。
 *     ⇒ **把 (c) 加回**，但**不照抄旧清单**（那会误报）：新判据锚「**已失效的操作**」而不是
 *     「**已删的名字**」—— 见 ② 的**判据③「面板操作锚点」**。★ 仍守**方向无关**：判据的**真值源**
 *     （面板词汇表）**每次从 `web/index.html` 现读**，面板怎么重建、词汇表跟着变，判据不用改。
 *     ★★ **先实测（本仓 2026-10-10）**：`grep web/index.html` 确认面板**现在真有** `#llmBaseUrl`
 *       （Endpoint）/ `#llmKey`（API-Key）/ `#llmModel`（model）三个输入框，且 `#llmKind` 下拉**真有**
 *       `openai-compatible` / `anthropic` / `custom` / `workbuddy-gateway` 四个选项
 *       ⇒ 旧句「请在面板补齐 Endpoint / Key / 模型名」「换 `kind=openai-compatible`」**现在是对的**，
 *       **不该**判违规；而「换用别的 `profile`」里的 `profile` **面板里没有**
 *       （面板口径是「**算力服务**」）⇒ **该判**。
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
 *   ★★ **判据③「面板操作锚点」（2026-10-10 加回；本闸门立闸门时的目标缺陷类就在这）**
 *     · **不变量**：**用户可见文案里「要求用户去操作的东西」必须能在面板里找到** —— 即文案的
 *       **操作目标**（字段 / 选项）必须在 `web/index.html` 的**面板词汇表**里**可解析**。
 *     · **面板词汇表 `PANEL_VOCAB`**（真值源，**每次现读** `web/index.html`）：剥注释 / `<script>` /
 *       `<style>` 后取 `id="…"` ∪ 可见文本 ∪ `title` / `placeholder` / `aria-label` ∪
 *       `<option value="…">` 的 value 与 option 文本，**小写、按非字母数字切词**（保留 len≥2 的词）。
 *     · **操作锚点两类**（从**已剥注释、已抹 `${…}`** 的用户可见串里抽）：
 *       (i) **祈使宾语**：`<祈使动词> [别的|其他|其它|另一个|某个|一个|该|新|旧] <ASCII 标识符>`
 *           —— 动词表 `C_VERBS`（填 / 填写 / 补齐 / 选 / 选择 / 勾选 / 换 / 改用 / 换用 / 换成 /
 *           切到 / 改 / 配置 / 指定 / 输入 / 设为 / 改为）；宾语 = 动词后**到下一个句读/括号**之间的
 *           ASCII 标识符（`A / B / C` 列表会被**逐个**抽出）；
 *       (ii) **`kind=<值>`**：同上按标识符处理（面板的 kind 下拉选项）。
 *       ⇒ 锚点**必须在 `PANEL_VOCAB` 里**（整词或其**全部子词**都在）—— 不在 ⇒ FAIL 并点名
 *       `<文件>:<行号> 文案指向面板里没有的「<token>」`。
 *     · **排除（防误报）**：`llm*` / `btnLlm*`（判据① 管）；`LEMO_*` / `CODEBUDDY_*`（环境变量）；
 *       **函数调用**（标识符后紧跟 `(`，如 `saveService()`）；**URL 片段**（标识符前是 `/`）。
 *     · **为什么不会误报**（实测见 ④）：文案里合法引用的面板词（`Endpoint` / `Key` / `model` /
 *       `kind` / `custom` / `extract` / `baseUrl` / `超时`…）**都在词汇表里**；而 `profile`（面板无此
 *       口径）、`apiSecret` 之类**面板里没有**的词才命中。★ 真值源是**页面本身** ⇒ 面板重建后
 *       旧文案若**重新成立**（如「补齐 Endpoint / Key / 模型名」），判据**自动放行**。
 *     · `ANCHOR_BACKLOG`（键 = `<文件>:<token>`）—— 与判据② 同型的两层语义出口（当前**空**）。
 *
 *   **判据④ 失明守卫（防空转绿灯）**（四态，任一即失明）
 *     · 一个待扫文件都没读到；或
 *     · **一个用户可见字符串都没提取到**；或
 *     · **`web/index.html` 的 id 集合为空**（判据① 的**参照集合**没了 ⇒ 判定无从谈起）；或
 *     · **面板词汇表为空**（判据③ 的**参照集合**没了）。
 *     ⇒ **FAIL 且明说「本闸门已失明」**，且失明时**不再输出判据①②③**。
 *
 *   **判据⑤ `--json`**（照 `check-no-sync-spawn.mjs`：JSON 模式下 stdout 只出 JSON，退出码同非 JSON）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做语义理解**：不解析 AST、不 import 被测模块；只按**固定抽取法**取串。
 *   · **不是全量「用户可见」**：JS 只认**含中文**的字符串字面量 ⇒ **纯英文**的用户可见串（本仓
 *     目前没有）**看不见**（假阴，如实写）；HTML 不扫 `<option value>` 等**非展示**属性。
 *   · **不判「文案好不好」**：只判「文案里的控件 id 是否**真实存在**」（判据①）与「文案要求的
 *     操作目标在不在面板里」（判据③）。
 *   · **不判适配器 kind / profile「名」本身**（★ 2026-10-10 订正，**有意收窄**）：新方向下
 *     `anthropic` / `openai-compatible` / `custom` 是**合法可选 kind**（`#llmKind` 下拉里真实存在）
 *     ⇒ 出现在用户可见文案里**不算违规**（初版的 (b) 维度在新方向下 100% 误报 ⇒ **撤掉**）。
 *     ★ 但**`kind=<值>` 的「值」由判据③ 管** —— 值必须能在面板词汇表里解析（`kind=foobar` 会命中）。
 *   · **判据③ 的已知盲区**（如实登记，本仓实测 0 命中）：
 *     - **纯域名**（`换成 other.example`，前面**没有** `/`）会被当锚点 ⇒ 可能误报（本仓无此文案）；
 *     - 动词表 `C_VERBS` 之外的祈使（如「替换 `foo`」「选用 `bar`」）**看不见**（假阴）；
 *     - 锚点只取「动词后到句读/括号」之间 ⇒ 跨句读的目标（「请补齐 Endpoint，以及 Key」的 `Key`）**漏**；
 *     - `PANEL_VOCAB` 取**整页**可见文本（不限该卡片）⇒ 别的卡片里出现过的词也算「面板里有」（假阴）。
 *   · **判据① 的已知盲区**：`${…}` 插值里**用字符串拼出来**的 id（`` `${'llm'+'Foo'}` ``）判不到（假阴）；
 *     **别名 / 拼接**出来的串（`'请在面板' + '补齐'`）判不到（假阴）；**动态创建**的 id
 *     （`app.js` 里 `el(...).id = …`）不在 `web/index.html` 的 id 集合里 ⇒ 若文案引用它会被
 *     **误报**（本仓当前无此情形，实测 0）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 验证（临时夹具 `D:/lemo-tmp/`，前缀 `p4c-`；全程不动真实仓）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**：真实仓 ⇒ **exit 0**（2026-10-10 实测：提取 **1162** 条用户可见串、参照 id
 *     **227** 个、面板词汇表 **357** 词；判据① 命中 **0**、判据③ 命中 **0**）。
 *   · **变异①（判据①）**：夹具里往某个用户可见串塞一个**不存在的 `llm*` id** ⇒ **exit 1 并点名**。
 *   · **变异③（判据③）**：夹具里塞一个「要求用户去填**面板没有的东西**」的用户可见串
 *     （如「配置不完整：请在面板补齐 Endpoint / Key / profile。」）⇒ **exit 1 并点名「profile」**。
 *     ★ **对照**：同一句若写「补齐 Endpoint / Key / 模型名」⇒ **exit 0**（面板**真有**这三个输入框）；
 *     若写「换 `kind=openai-compatible`」⇒ **exit 0**（`#llmKind` 真有该选项）；若写「换 `kind=foobar`」
 *     ⇒ **exit 1 并点名「foobar」**。
 *   · **反向诱惑**：同一句写进**注释**（**不是字符串**）⇒ **必须仍 exit 0**（证明「剥注释」生效）。
 *   · **失明**：夹具三个文件都在、但**一个用户可见串都没有** ⇒ **exit 1 +「本闸门已失明」**。
 *   · 同一套断言写在 `test/gate-blindness.test.mjs` 的 `check-visible-hints` 用例里
 *     （可用 `--only check-visible-hints` 只跑它）。
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

// ── ★★ 判据③「面板操作锚点」（2026-10-10 加回）───────────────────────────────
//   不变量：**用户可见文案里「要求用户去操作的东西」必须能在面板里找到**。
//   · 真值源 = `PANEL_VOCAB`（每次现读 `web/index.html`，见 panelVocab()）—— 方向无关。
//   · 锚点两类：(i) 祈使宾语（动词表见 C_VERBS）；(ii) `kind=<值>`（按标识符处理）。
const C_VERBS = ['换', '改', '填', '填写', '补齐', '选择', '勾选', '改用', '换用', '换成',
  '切到', '配置', '指定', '输入', '设为', '改为', '选'];
const C_VERB_RE = new RegExp(`(?:${C_VERBS.join('|')})\\s*(?:别的|其他|其它|另一个|某个|一个|该|新|旧)?\\s*`, 'g');
const C_TOKEN_RE = /[A-Za-z][A-Za-z0-9_.-]*/g;
const C_STOP_RE = /[。；;！？\n（）()]/;                 // 宾语短语的句读 / 括号边界
const C_LLM_ID_RE = /^(?:btn)?[Ll]lm[A-Za-z]+$/;        // 判据① 的活 ⇒ 判据③ 不重复
const C_ENV_RE = /^(?:LEMO_|CODEBUDDY_)/i;              // 环境变量名（不是控件）

// ── ANCHOR_BACKLOG：判据③ 已登记的违规（只列 ℹ、不判 FAIL）────────────────────
//   键 = `<文件>:<token>`；值 = 「为什么保留」。★ 当前**为空**（真实仓 0 命中），留出口。
const ANCHOR_BACKLOG = new Map(Object.entries({
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

/**
 * ★ 判据③ 的**真值源**：从 `web/index.html` 抽「面板词汇表」—— 页面上**真实存在的**
 *   控件 id ∪ 可见文本 ∪ title/placeholder/aria-label ∪ `<option value>` 的 value 与 option 文本，
 *   统一**小写、按非字母数字切词**（保留 len≥2 的词）。
 *   ★ 语义：**一个词只要能在页面里找到，用户就有办法在面板里操作它** ⇒ 文案引用它不算违规。
 *   ★ 每次**现读**页面 ⇒ 面板重建后旧文案若重新成立，判据自动放行（方向无关）。
 */
function panelVocab(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  let text = src.replace(/<!--[\s\S]*?-->/g, blank);
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, blank);
  const rawVals = [];
  for (const m of text.matchAll(ID_ATTR_RE)) rawVals.push(m[2] !== undefined ? m[2] : m[3]);
  for (const m of text.matchAll(/\b(?:title|placeholder|aria-label|value)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    rawVals.push(m[2] !== undefined ? m[2] : m[3]);
  }
  rawVals.push(text.replace(/<[^>]*>/g, ' '));        // 可见文本节点
  const vocab = new Set();
  for (const v of rawVals) {
    if (!v) continue;
    for (const w of String(v).split(/[^A-Za-z0-9]+/)) if (w.length >= 2) vocab.add(w.toLowerCase());
  }
  return vocab;
}

/** 一个锚点标识符是否**可在面板词汇表里解析**（整词或其**全部子词**都在）。 */
function anchorResolvable(tok, vocab) {
  if (C_LLM_ID_RE.test(tok)) return true;             // 判据① 管
  if (C_ENV_RE.test(tok)) return true;                // 环境变量名
  const parts = tok.split(/[^A-Za-z0-9]+/).filter((p) => p.length >= 2);
  if (parts.length === 0) return true;                // 全短词（如 `K`）⇒ 不当锚点
  return parts.every((p) => vocab.has(p.toLowerCase()));
}

/**
 * 从**已剥注释、已抹 `${…}`** 的用户可见串里抽「操作锚点」，返回**不可解析**的那些。
 *   锚点 = 祈使动词后的 ASCII 标识符（`A / B / C` 列表逐个抽）。
 *   排除：函数调用（后跟 `(`）、URL 片段（前是 `/`）。
 */
function badPanelAnchors(prose, vocab) {
  const out = [];
  C_VERB_RE.lastIndex = 0;
  let m;
  while ((m = C_VERB_RE.exec(prose)) !== null) {
    const from = m.index + m[0].length;
    const tail = prose.slice(from);
    const stop = tail.search(C_STOP_RE);
    const span = stop >= 0 ? tail.slice(0, stop) : tail;
    for (const t of span.matchAll(C_TOKEN_RE)) {
      const tok = t[0];
      const abs = from + t.index;
      if (prose[abs + tok.length] === '(') continue;  // 函数调用（saveService()）
      if (prose[abs - 1] === '/') continue;           // URL / 路径片段
      if (anchorResolvable(tok, vocab)) continue;
      out.push(tok);
    }
    if (C_VERB_RE.lastIndex <= m.index) C_VERB_RE.lastIndex = m.index + 1;   // 防空转
  }
  return [...new Set(out)];
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
let panelVocabSet = new Set();
for (const t of TARGETS) {
  const abs = path.join(ROOT, t.rel);
  let raw;
  try { raw = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  scanRead++;
  if (t.rel === ID_SOURCE_REL) { idSet = htmlIds(raw); panelVocabSet = panelVocab(raw); }   // ★ 判据①/③ 的参照集合
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

// ── 判据③ 不变量：文案要求的**操作目标**必须在**面板词汇表**里可解析 ─────────────
const anchorFindings = [];   // { file, line, token, excerpt }
const seenA = new Set();
for (const s of strings) {
  const prose = stripInterpolations(s.text);
  for (const tok of badPanelAnchors(prose, panelVocabSet)) {
    const key = `${s.file}|${s.line}|${tok}`;
    if (seenA.has(key)) continue;
    seenA.add(key);
    anchorFindings.push({ file: s.file, line: s.line, token: tok, excerpt: s.text.replace(/\s+/g, ' ').slice(0, 90) });
  }
}

// ── 判据④ 失明守卫（防空转绿灯）─────────────────────────────────────────────
const blind = [];
if (scanRead === 0) blind.push(`枚举到 ${TARGETS.length} 个待扫文件，却**一个都没读成功**（路径变了？）`);
else if (strings.length === 0) {
  blind.push(`扫了 ${scanRead} 个文件，却**一个用户可见字符串都没提取到** ⇒ 判据① 恒为空集（本闸门已失明）`);
}
if (idSet.size === 0) {
  blind.push(`\`${ID_SOURCE_REL}\` 里**一个 \`id="…"\` 都没解析到** ⇒ 判据① 的**参照集合**为空（本闸门已失明）`);
}
if (panelVocabSet.size === 0) {
  blind.push(`\`${ID_SOURCE_REL}\` 里**一个面板词汇都解析不到** ⇒ 判据③ 的**参照集合**为空（本闸门已失明）`);
}

// ── 判据②/③ 两层语义 ────────────────────────────────────────────────────────
const registered = [];     // { key, why, where }
const unregistered = [];   // { key, where }
const anchorRegistered = [];
const anchorUnregistered = [];
if (blind.length === 0) {
  for (const f of findings) {
    const key = `${f.file}:${f.token}`;
    const where = `${f.file}:${f.line} 不存在的控件id「${f.token}」 —— ${f.excerpt}`;
    if (BACKLOG.has(key)) registered.push({ key, why: BACKLOG.get(key), where });
    else unregistered.push({ key, where });
  }
  for (const f of anchorFindings) {
    const key = `${f.file}:${f.token}`;
    const where = `${f.file}:${f.line} 文案指向面板里没有的「${f.token}」 —— ${f.excerpt}`;
    if (ANCHOR_BACKLOG.has(key)) anchorRegistered.push({ key, why: ANCHOR_BACKLOG.get(key), where });
    else anchorUnregistered.push({ key, where });
  }
  registered.sort((a, b) => (a.where < b.where ? -1 : 1));
  unregistered.sort((a, b) => (a.where < b.where ? -1 : 1));
  anchorRegistered.sort((a, b) => (a.where < b.where ? -1 : 1));
  anchorUnregistered.sort((a, b) => (a.where < b.where ? -1 : 1));
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
if (anchorUnregistered.length) {
  fails.push({
    crit: '③',
    detail: `**判据③·未登记的违规** ${anchorUnregistered.length} 处（用户可见文案**要求用户去操作面板里没有的东西**`
      + ` ⇒ 用户被指去做**面板上做不到的事**）：\n`
      + anchorUnregistered.map((u) => `     ✘ ${u.where}`).join('\n')
      + `\n     · 修法：把该目标改成 \`${ID_SOURCE_REL}\` 里**真实存在**的控件/字段/选项（或把该控件补进页面）。`
      + `\n     · 若**确属有意保留** ⇒ 登进本闸门的 \`ANCHOR_BACKLOG\`（键 = \`<文件>:<token>\`，值 = 一句「为什么保留」）。`,
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
    panelVocabSize: panelVocabSet.size,
    findings: findings.length,
    anchorFindings: anchorFindings.length,
    registered: registered.map((r) => r.where),
    unregistered: unregistered.map((u) => u.where),
    anchorRegistered: anchorRegistered.map((r) => r.where),
    anchorUnregistered: anchorUnregistered.map((u) => u.where),
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
} else {
  console.log('「用户可见文案里的控件 id / 操作目标必须真实存在」闸门 —— 方向无关的不变量（文案 ↔ 实际控件一致）');
  console.log('  判据: ① 剥注释后**只取用户可见字符串**（JS=含中文的串，先抹 `${…}` 插值 / HTML=title·placeholder·aria-label + 可见文本），');
  console.log('        逐个断言其中的 `llm*` / `btnLlm*` token 在 web/index.html 的 id 集合里真实存在 |');
  console.log('        ② 两层语义（BACKLOG ⇒ 只列 ℹ；未登记 ⇒ FAIL） |');
  console.log('        ③ 面板操作锚点（祈使宾语 / `kind=<值>` 必须在 web/index.html 的**面板词汇表**里可解析）|');
  console.log('        ④ 失明守卫（0 文件 / 0 用户可见串 / 0 参照 id / 0 面板词汇 ⇒ 失明） | ⑤ `--json`');
  console.log(`  被测: ${ROOT}`);
  console.log(`  扫描: ${scanRead} 个文件；提取用户可见字符串 ${strings.length} 条；参照 id 集合 ${idSet.size} 个；面板词汇 ${panelVocabSet.size} 词`);
  console.log(`        判据① 命中**不存在的控件 id** ${findings.length} 处；判据③ 命中**不可解析的操作锚点** ${anchorFindings.length} 处`);
  console.log('');

  if (blindGuard) {
    console.log('✘✘ 本闸门已失明：');
    for (const b of blind) console.log(`   ✘ ${b}`);
    console.log('   ⇒ 「0 处违规」是假的，别信这个绿。请先修路径 / 抽取逻辑，再信本闸门的结论。');
    console.log('   ⇒ 已失明 ⇒ 判据①②③ 本次**不输出**（判据④ 是失明守卫本身）。');
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
    if (anchorRegistered.length) {
      console.log(`  ℹ 判据③·已登记的违规 ${anchorRegistered.length} 处（只列、不判 FAIL）：`);
      for (const r of anchorRegistered) console.log(`     ℹ ${r.where} —— ${r.why}`);
    } else {
      console.log('  ✓ 判据③·已登记的违规 0 处');
    }
    if (fails.length) {
      for (const f of fails) console.log(`\n   ✘ 判据${f.crit}  ${f.detail}`);
    } else {
      console.log(`  ✓ 判据①·未登记的违规 0 处（扫 ${strings.length} 条用户可见串、0 命中）`);
      console.log(`  ✓ 判据③·未登记的违规 0 处（扫 ${strings.length} 条用户可见串、0 命中）`);
    }
    console.log(`\n[闸门] 用户可见文案：扫描 ${scanRead} 个文件 · 用户可见串 ${strings.length} 条`
      + ` · 参照 id ${idSet.size} 个 · 面板词汇 ${panelVocabSet.size} 词`
      + ` · 判据① 命中 ${findings.length} 处（已登记 ${registered.length} / 未登记 ${unregistered.length}）`
      + ` · 判据③ 命中 ${anchorFindings.length} 处（已登记 ${anchorRegistered.length} / 未登记 ${anchorUnregistered.length}）`
      + ` · 违约 ${fails.length} 处 ${ok ? 'OK' : '✘'}`);
    process.exitCode = ok ? 0 : 1;
  }
}
