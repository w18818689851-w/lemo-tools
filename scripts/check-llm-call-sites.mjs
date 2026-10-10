#!/usr/bin/env node
/**
 * scripts/check-llm-call-sites.mjs —— 「软件内 LLM 推理任务默认走 `lib/llm-api.mjs`」闸门
 *   （★ **写作时**本仓第 43 个 `check-*` 闸门；★ 序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 由来（委托方硬要求 + 已实测的现状）
 * ══════════════════════════════════════════════════════════════════════════════
 *   委托方要求：「**软件内所有涉及 LLM 推理的任务，默认使用 WorkBuddy 及其内置模型执行**；
 *   用户仍可在面板切换」。⇒ 要让它**真正成立**，必须**禁止新增旁路**：任何**直接 `fetch`
 *   打 LLM 端点**、而不走 `lib/llm-api.mjs` 的代码，都会让「默认走内置模型」变成一句空话。
 *   ★ 实测现状（2026-10-08，本仓）：扫描范围内**只有 2 个**「LLM 端点字面量 + HTTP 调用」共现的文件 ——
 *     · `lib/llm-api.mjs` —— **规范通路本身**（模块必须自己知道各家端点）⇒ 允许；
 *     · `lib/triple-check.mjs` —— **已登记的例外**（★ **推理调用已迁完**，剩余端点字面量只服务
 *       「模型生命周期」的预热 / 卸载；见 ② 与登记表）。
 *   而**没有任何闸门在守这件事**：谁新写一个 `fetch('https://api.openai.com/v1/chat/completions')`，
 *   不会有任何断言响 ⇒ 立此闸门。
 *   ★ 本闸门与 `check-llm-api.mjs` **正交**：后者守「模块**内部**的契约」（导出 / 不抛 / 默认 profile /
 *     密钥不外泄 / 覆盖点），本闸门守「**有没有人绕过这个模块**」（调用点这一维）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（每条都写清「真阳长什么样 / 误报长什么样」；宁可少做，也不要误报）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★ 设计纪律：本闸门是**静态读码**（不 import / 不发请求 —— 无副作用、不依赖网络）。
 *     凡「代码体」一律用**剥注释后**的文本判（本项目反复治过「判据可被注释满足」的假绿）。
 *     ★★ 剥注释**必须连正则字面量一起剥**（见 ⑤ 的实测：只剥注释的状态机被
 *     `scripts/check-ref-lines.mjs` 里一条**含反引号的正则字面量**带偏 ⇒ 该文件头注释里那句
 *     「127.0.0.1:12345」**没被剥掉** ⇒ 会**假阳**）。本闸门用两个状态机：
 *       · `maskNonCode()` —— 剥注释 + 正则，**保留字符串 / 模板串**（端点 URL 都在字符串里，必须看得见）；
 *       · `codeOnly()`   —— 剥注释 + 字符串 + 正则（HTTP 调用只在真代码里，字符串里的 `fetch(` 不算）。
 *
 *   **判据① LLM 端点直连检测**（真阳 = 一个新写的旁路）
 *     · 对每个扫描文件，在 `maskNonCode()` 文本里找**端点字面量**（见 ④ 的模式表），
 *       在 `codeOnly()` 文本里找**HTTP 调用**；**同文件共现**即「疑似直接打 LLM 端点」。
 *     · 该文件**既不是** `lib/llm-api.mjs`（规范通路）**也不在** `EXCEPTIONS` 登记表 ⇒ **FAIL**，
 *       逐处点名 `文件:行`（行号取端点字面量那一行）。
 *     · 真阳长什么样：`fetch('https://api.openai.com/v1/chat/completions', …)`。
 *     · 误报长什么样：**某文件同时**有「一句把端点当**说明文字**的字符串」（如
 *       `note: 'POST {baseUrl}/chat/completions …'`）**和**一处**与 LLM 无关**的 `fetch` ⇒ 会命中。
 *       ★ 这正是本闸门**宁可收窄**的地方：端点模式表**只收 LLM 专用**的字面量（见 ④），
 *       不认 `/api/v1/models` 这类**模型管理**端点（实测 `lib/vram.mjs` 就是「卸载 7B」的调用，
 *       **不是推理** ⇒ 有意不判）。
 *     · ★ **只列不判（ℹ）**：文件里**有端点字面量、但没有 HTTP 调用** ⇒ 只列 ℹ
 *       （多为「注释残留 / 纯文案」，如 `scripts/check-ref-lines.mjs` 那条；见 ⑤）。
 *
 *   **判据② 例外清单（两层语义）**
 *     · **已登记**（`EXCEPTIONS` 里的文件，带**理由**（「为什么还没迁」/「为什么不迁」）+ **归属批次**）⇒ **只列 ℹ、不判 FAIL**。
 *     · **没登记** ⇒ 判据① 的 FAIL（这就是「两层语义」的另一半）。
 *     · 当前登记 **2** 条：`lib/triple-check.mjs`（模型生命周期）、`lib/resources.mjs`（资源探活、非推理）
 *       （理由与批次见登记表注释）。
 *
 *   **判据③ 例外不得「失效」**（双向守卫的另一半，照 `check-env-overrides.mjs` 的思路）
 *     · 对 `EXCEPTIONS` 里**每一条**，断言它的文件**仍然**：(a) 存在；(b) 在 `maskNonCode()` 文本里
 *       **仍有**端点字面量；(c) 在 `codeOnly()` 文本里**仍有** HTTP 调用。
 *       任一不成立 ⇒ **FAIL**（「登记了但没了」—— 要么真迁走了该**删登记**，要么写法变了该**查**）。
 *     · 真阳：把 `lib/triple-check.mjs` 整个删掉 / 把它的端点字面量改成不认识的形式。
 *     · 误报长什么样：**没有** —— 登记的是「这个文件仍是个旁路」，文件不再是旁路时**本就应该**报。
 *     · ★ **只列不判（ℹ）**：登记时写下的**端点 kind** 若已不全在（换了写法）⇒ 只列 ℹ（供人复核）。
 *
 *   **判据④ 失明守卫（防空转绿灯）**
 *     · 下列任一 ⇒ **FAIL + 「本闸门已失明」**，且**失明时不再输出判据①②③**：
 *       扫描根读不到 / 收集到 **0 个**文件 / 规范通路 `lib/llm-api.mjs` 读不到 /
 *       规范通路里**抽不到端点字面量** / 规范通路里**抽不到 HTTP 调用** / `EXCEPTIONS` 登记表为空。
 *     · 为什么「模块里抽不到端点」也算失明：模块是本闸门的**参照物**；它一条端点都没有 ⇒
 *       要么检测坏了、要么模块形态变了 ⇒ 「0 处旁路」是**假的**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 误报率实测（**先在真实语料上跑一遍、逐条人读命中，再定稿**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · 首跑（**只剥注释**的状态机）实测：**3 个文件 / 12 处**端点字面量 —— `lib/llm-api.mjs`（规范通路，9 处）、
 *     `lib/triple-check.mjs`（已登记例外，2 处）、`scripts/check-ref-lines.mjs`（**1 处，假命中**）。
 *   · 逐条人读：第 3 个文件那处是**头注释里的一句举例**（讲「`地址:端口` 会被扩展名规则挡掉」时写了
 *     127.0.0.1:12345），**不是代码** ⇒ 假命中。根因：该文件里有一条**含反引号的正则字面量**
 *     （`` const re = /`+/g; ``），把「只剥注释」的状态机带进了「字符串态」⇒ **之后整段注释都没剥**。
 *   · ★ 诚实记一句：该文件**没有** HTTP 调用（实测 `grep -c` = **0**）⇒ 这处假命中当时只会落进
 *     「**只列不判（ℹ）**」桶、**不翻退出码**；但它是**假命中**（把注释当代码），且**只要该文件将来
 *     加一处 `fetch` 就会变成 FAIL 假阳** ⇒ 仍必须修。
 *   · **收窄**：换成「**剥注释 + 正则、保留字符串**」的状态机 ⇒ 该处消失，**3 个文件 / 12 处 → 2 个 / 11 处**
 *     （**真阳 2 / 误报 0**）。
 *     ★ **收窄改的是「误报形态」（剥法），不是放宽判据** —— 端点模式表一条没删、阈值一个没动。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 扫描范围与端点模式表（**含 / 不含的取舍，如实写明代价**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **纳入**：`lib/**`、`scripts/**`（递归）+ 仓根 `*.mjs`（非递归）—— 与 `check-env-overrides.mjs`
 *     的扫描范围**同口径**（后端 / CLI 源码）。
 *   · **不纳入 `test/**`**：那是**夹具 / 桩**（实测 `test/llm-api.test.mjs` 断言 `req.url === '/chat/completions'`、
 *     `test/gate-blindness.test.mjs` 的夹具字符串里就有 `api.anthropic.com`、`test/triple-check-flow.test.mjs`
 *     的桩路由写 `/v1/chat/completions`）⇒ 纳入会**大面积误报**，而它们**不做推理**。
 *   · **不纳入 `web/**`**：前端**不做推理**（它只调本机控制台的 `/api/llm/*`），且面板**合法地**把端点路径
 *     当 **UI 占位文字**（实测 `web/index.html` 里那个 baseUrl `placeholder` 就写着 `https://api.anthropic.com`、
 *     另一个 path `placeholder` 写着 `默认 /chat/completions`；★ 2026-10-09 改用**符号锚** ——
 *     原先写的行号已随界面新增「资源检测」区块而漂，行号引用是**结构性隐患**，见引用纪律第 12 条）
 *     ⇒ 若哪天这些文字落进一个**也有 `fetch`** 的 `.js`（`web/app.js`
 *     就有 `fetch`）⇒ 必误报。★ **2026-10-10 订正**：面板极简化后 `web/index.html` 里那两个 LLM 端点占位符**已删**（实测 `https://api.anthropic.com` / `chat/completions` 在 `web/` 下 **0 命中**）⇒ 上面「合法地把端点当 UI 占位文字」的**具体证据已失效**；但「**不纳入 `web/**`**」这条**取舍不变**（前端仍不做推理；且本闸门只收 `.mjs`，`web/**` 是 `.js`/`.html`，本就不在扫描集）—— 故这是**理由过时**，**不是**「排除该取消」。★ 原句保留作历史。
 *   ⇒ 两条**已知盲区**（如实登记）：`test/**` 与 `web/**` 里新写的旁路**本闸门看不见**。
 *   · **端点模式表**（`ENDPOINT_PATTERNS`，LLM 专用）：`chat/completions`、`/v1/messages`、
 *     `/v1/completions`、`api.anthropic.com`、`api.openai.com`、`<host>:12345`（LM Studio 默认端口）。
 *   · **HTTP 调用模式表**（`HTTP_PATTERNS`）：`fetch(`、`http(s).request(`、`http(s).get(`、`axios`、
 *     `XMLHttpRequest`、`undici`。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑤ 验证（**临时夹具树，全程不动真实仓**；同一套断言也写在
 *      `test/gate-blindness.test.mjs` 的 `check-llm-call-sites` 用例里）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · 夹具按「落点由脚本自身位置推导」的写法（见 ⑥）**整棵拷到临时目录**：把本闸门拷进
 *     `<tmp>/scripts/`，再往 `<tmp>/lib/` 放真 `llm-api.mjs` 与 `triple-check.mjs`。
 *   · **阴性对照** ⇒ exit 0 且不含失明文案。
 *   · **变异 A（判据①）**：`<tmp>/lib/bypass.mjs` 里写一处 `fetch('https://api.openai.com/v1/chat/completions')`
 *     ⇒ **exit 1** 并点名 `lib/bypass.mjs:<行>`。
 *   · **变异 B（判据③）**：删掉 `<tmp>/lib/triple-check.mjs` ⇒ **exit 1** 并报「登记的文件不存在」。
 *   · **失明两态**（空树 / 规范通路缺失）⇒ **exit 2 + 「本闸门已失明」**，且**不输出判据①②③**。
 *   · **★自证**：分别**短路**判据① 的比较、判据③ 的比较 ⇒ 对应变异**重新变绿**（证明判据**承重**）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑥ 已知盲区（如实写，不粉饰）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不判 `test/**` / `web/**`**（见 ④ 的取舍）。
 *   · **动态拼 URL 看不见**：`` `${host}${'/chat' + '/completions'}` `` 这类把端点拆成多段拼的写法，
 *     本闸门抽不到（正则只认**连写**的字面量）。
 *   · **同文件共现 ≠ 真的把端点喂给了 fetch**：判据是「同文件既有端点字面量又有 HTTP 调用」——
 *     不追踪数据流（`const u = '…/chat/completions'; fetch(other)` 也会命中）。这是**有意**的粗粒度：
 *     精确数据流要 AST，代价高且更脆；本闸门**宁可在这一维粗一点**，靠「端点模式表只收 LLM 专用字面量」
 *     把误报压住。
 *   · **只守 `.mjs`**：`.js` / `.ts` / `.py` 源码不在扫描内（本仓后端源码是 `.mjs`）。
 *   · 剥注释 / 正则 / 字符串是**启发式（非 AST）**：正则字面量靠「前一个有意义字符」判定 ⇒ 极端写法
 *     理论上会错位。**兜底**是判据③（真代码被误剥 ⇒ 登记表里会**当场**报「登记了但没了」，假红可见、一改就好）。
 *
 * 用法：node scripts/check-llm-call-sites.mjs [--json]
 * 退出码：0 = 扫描范围内没有未登记的 LLM 端点直连、且已登记例外都还在；
 *         1 = 有 FAIL（发现未登记的旁路 / 已登记例外失效）；
 *         2 = **本闸门已失明**（扫描根读不到 / 0 个文件被扫 / 规范通路读不到或抽不到端点 / 登记表为空）——
 *             「0 处旁路」是假的，别信这个绿。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/**
 * ★ 扫描根**按脚本自身位置推导**（`<脚本>/..`），**没有** env 覆盖点。
 *   理由：本闸门是「整仓策略」闸门（不是「读某个数据文件」的闸门），夹具用「**整棵拷到临时目录**」
 *   （同 `check-env-overrides.mjs` 的写法 / `test/gate-blindness.test.mjs` 的 `copyGate`），
 *   比 env 重定向更贴近真实调用形态，也**不必**在 `check-env-overrides.mjs` 的登记表里多记一个读者。
 */
const ROOT = path.resolve(path.join(HERE, '..'));
/** ★ 本闸门**不扫自己**（否则它自己的模式表 / 举例会自己满足判据 ①）。 */
const SELF = 'check-llm-call-sites.mjs';
const JSON_OUT = process.argv.includes('--json');
/** ★ 规范通路（模块本身必须知道各家端点 ⇒ 它里面的端点字面量是**允许**的）。 */
const MODULE_REL = 'lib/llm-api.mjs';

// ── ★★ 端点模式表（**只收 LLM 专用**的字面量；见头注释 ④）────────────────────
const ENDPOINT_PATTERNS = [
  { kind: 'chat-completions', re: /chat\/completions/ },
  { kind: 'v1-messages', re: /\/v1\/messages/ },
  { kind: 'v1-completions', re: /\/v1\/completions/ },
  { kind: 'anthropic-host', re: /api\.anthropic\.com/ },
  { kind: 'openai-host', re: /api\.openai\.com/ },
  { kind: 'lmstudio-port', re: /(?:https?:\/\/)?(?:[\w.-]+|\[[0-9a-f:]+\]):12345/ },
];
// ── ★★ HTTP 调用模式表（在**剥注释+字符串+正则**后的代码体里找）──────────────
const HTTP_PATTERNS = [
  { kind: 'fetch', re: /\bfetch\s*\(/ },
  { kind: 'node-http', re: /\bhttps?\.(?:request|get)\s*\(/ },
  { kind: 'axios', re: /\baxios\b/ },
  { kind: 'xhr', re: /\bXMLHttpRequest\b/ },
  { kind: 'undici', re: /\bundici\b/ },
];

// ── ★★ 例外清单 · 「已登记的例外」（两层语义的第一层：只列 ℹ、不判 FAIL）──────
//   每条：rel（文件，相对仓根）/ why（**理由**：为什么还没迁 / 为什么不迁）/ batch（**归属批次**）/ kinds（登记时看到的端点 kind）。
//   ★ 已登记 ⇒ 只列；没登记 ⇒ 判据① 的 FAIL（**绝不为了让闸门变绿而放宽判据**）。
const EXCEPTIONS = [
  {
    rel: 'lib/triple-check.mjs',
    why: '★ **推理调用已迁完**（2026-10-08 迁移落地）：`askVlm()` 现经 `lib/llm-api.mjs` 的 `chat()`'
      + '（`import { chat }`，显式 `kind:openai-compatible` + `temperature:0` + `images[]`）。'
      + '★ 本文件里**剩下的端点字面量只服务「模型生命周期」**：`ensureModelLoaded()` 的 JIT 预热'
      + '（一次 `max_tokens:1` 的 `/v1/chat/completions`，用途是「逼模型进显存」、**不取回判定用文本**）'
      + '与 `unloadModel()` 的卸载、以及 `GET /api/v0/models/<id>` 的 `state` 轮询。'
      + '★ 按规格 `_distill/llm-api-接口规格-2026-10-08.md` §10.5 的边界，模型加载 / 卸载属 `lib/vram.mjs`，'
      + '**不并入** `lib/llm-api.mjs`（该模块只管「发一次对话、取回文本」）⇒ 这几处**有意保留**，不再计划迁移。',
    batch: '**不迁**（模型生命周期，按规格 §10.5 的边界**有意保留**）',
    kinds: ['lmstudio-port', 'chat-completions'],
  },
  {
    rel: 'lib/resources.mjs',
    why: '★ **不是推理调用，是资源探活**（2026-10-09 建）：该模块是「通用资源检测适配模块」，'
      + '其中 `model.lmstudio` 一项用 `LEMO_LMSTUDIO_URL`（默认 `http://127.0.0.1:12345`）做**只读探活** ——'
      + '只判「本机 LM Studio 服务在不在」，**不发送任何提示词、不取回任何文本**（等价于探端口）。'
      + '★ 按规格 `_distill/资源检测适配模块-接口规格-2026-10-09.md` §一 的边界：资源**探测**归本模块，'
      + 'LLM **调用**归 `lib/llm-api.mjs`（该模块只管「发一次对话、取回文本」）⇒ 此处**有意保留**。'
      + '★ 若日后要真正调用 LM Studio 做推理 ⇒ **必须**走 `lib/llm-api.mjs` 的 `chat()`，不得在此直连。',
    batch: '**不迁**（资源探活、非推理；按资源模块规格 §一 的边界有意保留）',
    kinds: ['lmstudio-port'],
  },
];

// ── ★ 剥注释 + 正则，**保留字符串 / 模板串**（状态机；行号不变）───────────────
//   见头注释 ② / ③：端点 URL 都在字符串里 ⇒ 必须看得见；但**注释与正则必须剥掉**。
//   ★ 顺序关键：先判注释 / 正则、再判引号 ⇒ 注释里的引号不会把状态机带偏；
//     而字符串里的 `/*` / `/x/` 也安全（进入字符串态后不再判注释 / 正则）。
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', '']);
const REGEX_PREV_WORD = ['return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'void', 'delete', 'instanceof', 'new', 'yield', 'await', 'throw'];
function maskNonCode(src) {
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
      if (c === '\\') { i += 2; continue; }                       // ★ 保留字符串内容
      if ((t === 'sq' && c === "'") || (t === 'dq' && c === '"')) { stack.pop(); prevSig = "'"; i++; continue; }
      i++; continue;                                              // ★ 保留字符串内容
    }
    if (t === 'regex') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if (c === '[') { let j = i + 1; while (j < n && src[j] !== ']') { if (src[j] === '\\') j++; j++; } blank(i, Math.min(n, j + 1)); i = Math.min(n, j + 1); continue; }
      if (c === '/') { stack.pop(); prevSig = '/'; i++; continue; }
      blank(i, i + 1); i++; continue;
    }
    // tpl：保留模板文本；`${…}` 里的代码切回 code 态（那里可能有正则 / 注释）
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { stack.pop(); prevSig = '`'; i++; continue; }
    if (c === '$' && c2 === '{') { stack.push({ t: 'expr', depth: 0 }); prevSig = '{'; i += 2; continue; }
    i++; continue;
  }
  return out.join('');
}

// ── ★ 剥注释 + 字符串 + 正则（状态机；行号不变）—— 逐字照抄 `check-llm-api.mjs` 的 `codeOnly` ──
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
    if (c === '\\') { blank(i, i + 2); i += 2; continue; }
    if (c === '`') { stack.pop(); prevSig = '`'; i++; continue; }
    if (c === '$' && c2 === '{') { blank(i, i + 2); stack.push({ t: 'expr', depth: 0 }); prevSig = '{'; i += 2; continue; }
    blank(i, i + 1); i++; continue;
  }
  return out.join('');
}

/** 逐行在 `text` 里找 `pats` 的命中 ⇒ `[{line, kind}]`。 */
function findPatterns(text, pats) {
  const rows = [];
  text.split('\n').forEach((l, i) => {
    for (const p of pats) if (p.re.test(l)) rows.push({ line: i + 1, kind: p.kind });
  });
  return rows;
}

// ── 收集待扫文件（lib/** + scripts/** 递归；仓根 *.mjs 非递归；见头注释 ④）────
const SKIP_SEG = /^(node_modules|\.git|out|logs|ref|_superseded.*|_tmp_.*|_tmp.*)$/;
function collect() {
  const out = [];
  const walk = (dir, recursive) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (recursive && !SKIP_SEG.test(e.name)) walk(p, true); continue; }
      if (!e.isFile() || !e.name.endsWith('.mjs')) continue;
      if (e.name === SELF) continue;                            // ★ 不扫自己
      out.push(p);
    }
  };
  walk(path.join(ROOT, 'lib'), true);
  walk(path.join(ROOT, 'scripts'), true);
  walk(ROOT, false);                                            // 仓根：非递归
  return [...new Set(out)].sort();
}

// ── 扫 ───────────────────────────────────────────────────────────────────────
const files = collect();
const moduleAbs = path.join(ROOT, 'lib', 'llm-api.mjs');
const byRel = new Map();          // rel -> { rel, ep:[{line,kind}], hc:[{line,kind}] }
const blind = [];

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  let raw;
  try { raw = fs.readFileSync(f, 'utf8'); } catch (e) {
    blind.push(`读不到扫描范围内的 \`${rel}\`（${(e && e.message) || e}）⇒ 该文件未被检查`);
    continue;
  }
  const ep = findPatterns(maskNonCode(raw), ENDPOINT_PATTERNS);
  if (!ep.length) continue;                                     // 没有端点字面量 ⇒ 不是嫌疑文件
  const hc = findPatterns(codeOnly(raw), HTTP_PATTERNS);
  byRel.set(rel, { rel, ep, hc });
}

const moduleEntry = byRel.get(MODULE_REL) || { rel: MODULE_REL, ep: [], hc: [] };
const regRels = new Set(EXCEPTIONS.map((e) => e.rel));
const bypass = [...byRel.values()].filter((x) => x.rel !== MODULE_REL && !regRels.has(x.rel));
const registered = [...byRel.values()].filter((x) => regRels.has(x.rel));
const infoOnly = [...byRel.values()].filter((x) => x.rel !== MODULE_REL && !regRels.has(x.rel) && x.hc.length === 0);
const bypassReal = bypass.filter((x) => x.hc.length > 0);

// ── 判据③：例外不得「失效」────────────────────────────────────────────────────
const stale = [];      // {rel, why}
const kindDrift = [];  // {rel, missing:[kind]}
for (const ex of EXCEPTIONS) {
  const abs = path.join(ROOT, ex.rel);
  if (!fs.existsSync(abs)) { stale.push({ rel: ex.rel, why: '登记的文件**不存在**（被删了 / 改名了 / 挪走了）' }); continue; }
  let raw;
  try { raw = fs.readFileSync(abs, 'utf8'); } catch (e) { stale.push({ rel: ex.rel, why: `读不到（${(e && e.message) || e}）` }); continue; }
  const ep = findPatterns(maskNonCode(raw), ENDPOINT_PATTERNS);
  const hc = findPatterns(codeOnly(raw), HTTP_PATTERNS);
  if (!ep.length) { stale.push({ rel: ex.rel, why: '文件里已找不到**任何** LLM 端点字面量（写法变了 / 调用点已迁走）' }); continue; }
  if (!hc.length) { stale.push({ rel: ex.rel, why: '文件里已找不到**任何** HTTP 调用（调用点已迁走？）' }); continue; }
  const kinds = new Set(ep.map((e) => e.kind));
  const missing = (ex.kinds || []).filter((k) => !kinds.has(k));
  if (missing.length) kindDrift.push({ rel: ex.rel, missing });
}

// ── 判据④：失明守卫 ─────────────────────────────────────────────────────────
if (files.length === 0) blind.push(`\`${ROOT}\` 下扫到 **0 个** \`.mjs\`（路径 / 过滤变了？）⇒ 一个文件都没检查过`);
if (!fs.existsSync(moduleAbs)) blind.push(`规范通路 \`${MODULE_REL}\` **不存在**（\`${moduleAbs}\`）⇒ 没有参照物，判据① 无从谈起`);
else if (moduleEntry.ep.length === 0) blind.push(`规范通路 \`${MODULE_REL}\` 里**一条端点字面量都抽不到**（模块形态变了 / 检测坏了？）⇒ 本闸门已失明`);
else if (moduleEntry.hc.length === 0) blind.push(`规范通路 \`${MODULE_REL}\` 里**一个 HTTP 调用都抽不到**（模块形态变了？）⇒ 本闸门已失明`);
if (EXCEPTIONS.length === 0) blind.push('`EXCEPTIONS` 登记表为空 ⇒ 判据③ 一条都没检查（已知至少 1 个例外，见头注释 ①）');

// ── 判据①：LLM 端点直连检测（FAIL）─────────────────────────────────────────
const fails = [];
const bypassDetail = bypassReal.map((b) => b.ep.map((e) => `     - ${b.rel}:${e.line}  [${e.kind}]  同文件 HTTP 调用：${[...new Set(b.hc.map((h) => h.kind))].join('/')}`).join('\n')).join('\n');
if (bypassReal.length) fails.push({ crit: '①', detail: `发现 ${bypassReal.length} 个文件**直接打 LLM 端点**却没走 \`${MODULE_REL}\`（也不在例外清单里）：\n${bypassDetail}` });

// ── 判据③：例外失效（FAIL）────────────────────────────────────────────────
if (stale.length) fails.push({ crit: '③', detail: `有 ${stale.length} 个**已登记的例外失效**（登记了但没了）：\n     - ${stale.map((s) => `${s.rel} —— ${s.why}`).join('\n     - ')}` });

const blindMode = blind.length > 0;
const ok = !blindMode && fails.length === 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({
    root: ROOT,
    scope: {
      files: files.length,
      filesWithEndpoints: byRel.size,
      bypass: bypassReal.map((b) => ({ file: b.rel, at: b.ep.map((e) => `${e.line}:${e.kind}`), http: [...new Set(b.hc.map((h) => h.kind))] })),
      registered: registered.map((b) => ({ file: b.rel, at: b.ep.map((e) => `${e.line}:${e.kind}`) })),
      infoOnly: infoOnly.map((b) => ({ file: b.rel, at: b.ep.map((e) => `${e.line}:${e.kind}`) })),
    },
    module: { rel: MODULE_REL, endpoints: moduleEntry.ep.length, http: moduleEntry.hc.length },
    exceptions: EXCEPTIONS.map((e) => ({ rel: e.rel, why: e.why, batch: e.batch, kinds: e.kinds })),
    kindDrift,
    stale,
    fails: fails.map((f) => ({ crit: f.crit, detail: f.detail })),
    blind,
    ok,
    exit: blindMode ? 2 : (fails.length ? 1 : 0),
  }, null, 2));
  process.exitCode = blindMode ? 2 : (fails.length ? 1 : 0);
  process.exit();
}

console.log('LLM 调用点闸门 —— 守「软件内 LLM 推理任务默认走 `lib/llm-api.mjs`」（禁新增旁路）');
console.log('  判据: ① LLM 端点直连检测 | ② 例外清单（两层语义）| ③ 例外不得失效 | ④ 失明守卫（防空转绿灯）');
console.log(`  仓根 : ${ROOT}`);
console.log(`  范围 : lib/** + scripts/**（递归）+ 仓根 *.mjs（非递归）；★ 不扫自己（${SELF}）`);
console.log(`         ★ 已知盲区：**不纳入** test/**（夹具/桩）与 web/**（前端不做推理、且面板合法地把端点当 UI 占位文字）—— 见头注释 ④ ★ 2026-10-10 订正：面板极简化后 web/ 已无端点占位符（实测 0 命中）⇒「把端点当 UI 占位文字」这条具体理由已失效；「不纳入 web/**」不变（前端不做推理，且本闸门只收 .mjs）`);
console.log(`         实测 ${files.length} 个 .mjs / 其中含端点字面量 ${byRel.size} 个`);
console.log(`  规范 : ${MODULE_REL}（端点字面量 ${moduleEntry.ep.length} 处 / HTTP 调用 ${moduleEntry.hc.length} 处 —— **允许**，它就是通路本身）`);
console.log('');

if (blindMode) {
  console.log('✘✘ 本闸门已失明：');
  for (const b of blind) console.log(`   ✘ ${b}`);
  console.log('   ⇒ 「0 处旁路」是**假的**，别信这个绿。请先修路径 / 剥注释写法 / 登记表，再信本闸门的结论。');
  console.log('   ⇒ 本闸门已失明 ⇒ 判据①②③ 本次**不输出**（在失明的树上它们只会刷屏）。');
  console.log('');
  console.log('[闸门] LLM 调用点：**已失明** ⇒ 一条判据都没可信地跑过 ✘');
  process.exitCode = 2;
  process.exit();
}

if (bypassReal.length) {
  console.log(`✘ 判据①·有 ${bypassReal.length} 个文件**直接打 LLM 端点**却没走 \`${MODULE_REL}\`（也不在例外清单里）：`);
  for (const b of bypassReal) {
    for (const e of b.ep) console.log(`   ✘ ${b.rel}:${e.line}  [${e.kind}]  同文件 HTTP 调用：${[...new Set(b.hc.map((h) => h.kind))].join('/')}`);
  }
  console.log('   ↳ 修法：改走 `lib/llm-api.mjs`（`chat()` / `listModels()`）；确实迁不动的（如模型生命周期：预热 / 卸载），');
  console.log('     请登记进本闸门的 `EXCEPTIONS`（**必须**写清「为什么还没迁」+ 归属批次）。');
} else {
  console.log(`✓ 判据①·扫描范围内**没有**未登记的 LLM 端点直连（${files.length} 个文件里，只有规范通路与已登记例外含端点字面量）`);
}

if (EXCEPTIONS.length) {
  console.log(`\nℹ 判据②·已登记例外 ${EXCEPTIONS.length} 条（**只列 ℹ、不判 FAIL**）：`);
  for (const ex of EXCEPTIONS) {
    const hit = registered.find((r) => r.rel === ex.rel);
    const at = hit ? hit.ep.map((e) => `${e.line}:${e.kind}`).join(', ') : '（本文件不在「含端点字面量」名单里 —— 见判据③）';
    console.log(`   · ${ex.rel}  ←  端点 ${at}`);
    console.log(`       理由：${ex.why}`);
    console.log(`       归属批次：${ex.batch}`);
  }
  if (kindDrift.length) {
    console.log('   ℹ 端点 kind 漂移（登记时的 kind 已不全在，**只列不判**，供人复核）：');
    for (const k of kindDrift) console.log(`      · ${k.rel} 缺：${k.missing.join(' / ')}`);
  }
} else {
  console.log('\nℹ 判据②·例外清单为空');
}

if (stale.length) {
  console.log(`\n✘ 判据③·有 ${stale.length} 个**已登记的例外失效**（「登记了但没了」）：`);
  for (const s of stale) console.log(`   ✘ ${s.rel} —— ${s.why}`);
  console.log('   ↳ 修法：若它**真的**不再是旁路（已迁进模块）⇒ 把这条登记**删掉**；');
  console.log('     若只是写法变了 ⇒ 把调用点补回来（或同步改登记表的 `kinds`）。');
} else {
  console.log(`\n✓ 判据③·${EXCEPTIONS.length} 条已登记例外的调用点**都还在**（文件存在 + 仍有端点字面量 + 仍有 HTTP 调用）`);
}

if (infoOnly.length) {
  console.log(`\nℹ 判据①·只列不判（有端点字面量、但**无 HTTP 调用**）${infoOnly.length} 个文件：`);
  for (const b of infoOnly) for (const e of b.ep) console.log(`   · ${b.rel}:${e.line}  [${e.kind}]`);
  console.log('   ↳ 多为「注释残留 / 纯文案」，不是旁路 ⇒ **不判 FAIL**。');
}

console.log(`\n[闸门] LLM 调用点：扫描 ${files.length} 个文件 · 含端点字面量 ${byRel.size} 个（规范 ${moduleEntry.ep.length ? 1 : 0} + 登记 ${registered.length} + 未登记旁路 ${bypassReal.length} + 只列 ${infoOnly.length}）`
  + ` · 例外 ${EXCEPTIONS.length} 条（失效 ${stale.length}） · FAIL ${fails.length} 处 ${fails.length ? '✘' : 'OK'}`);
process.exitCode = fails.length ? 1 : 0;
