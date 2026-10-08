// lib/llm-api.mjs —— 开放式 LLM API 配置与调用（**不限厂商 / 部署 / 智能体**）
//
// ★ 为什么需要它：本项目里 LLM 的调用点散落在各处，各自硬编码「用哪个服务、什么路径、怎么取文本」，
//   于是「换一个模型 / 换一个服务商 / 换成本地私有化部署」都要改代码。本模块把这件事收成**一处**：
//   只要一个接口**通信正常、鉴权有效、能收发提示词并返回合法 LLM 文本**，就能接进来 ——
//   云端 API、本地私有化部署、本地推理接口、第三方中转**一视同仁**。
//
// ★ 两种接入形式（都覆盖）：
//   ① 智能体自身的服务 API（如 WorkBuddy 的服务端点）—— profile `workbuddy`；
//   ② 智能体底层搭载的**原生大模型 API**（Anthropic / OpenAI 兼容 / 厂商私有）—— 其余 profile。
//
// ★★ 本模块的**核心承诺**：`chat()` **永不抛异常**。一切失败（超时 / 非 JSON / 缺字段 /
//   401 / 403 / 429 / 5xx / 网络不可达 / 配置不全）**归一**为
//   `{ok:false, error:{kind,message,httpStatus?,detail?}}`，`kind` 取值固定：
//   `'unreachable' | 'timeout' | 'auth' | 'rate-limit' | 'http-error' | 'bad-json' | 'bad-shape'
//     | 'empty-output' | 'config' | 'unknown'`。
//   理由：面板与调用方**都不该被一个异常接口搞崩** —— 一个 throw 就能让控制台整个挂掉。
//
// ★★ 纪律（别改）：
//   · **不预置任何真实密钥**。`workbuddy` 的 key 只从运行时线索 `ANTHROPIC_API_KEY`（或覆盖点
//     `LEMO_LLM_KEY`）取；本文件里**没有**任何密钥字面量。
//   · **任何输出 / 日志 / 文件里不得出现密钥明文**：`listProfiles()` 只回 `hasKey`；
//     `validate()` 的 `errors` / `hint` / `masked` 一律**脱敏**（只显示前 4 位 + `…`，见 maskKey）；
//     `chat()` 的 `error.detail` 会把**已知密钥**从响应片段里抹掉。
//   · **超时一律用 `AbortController`，且 `finally` 里 `clearTimeout`** —— 本项目踩过「定时器没清、
//     进程不退出」的坑（见 lib/vram.mjs 的 fetchT）。
//   · 响应体**先 `text()` 再 `JSON.parse`**，解析失败 ⇒ `bad-json`（**不让** `res.json()` 把异常抛出去）。
//   · 取不到文本路径 ⇒ `bad-shape`；取到空串 ⇒ `empty-output`。**都不抛**。
//
// ★ 适配器（`kind`）：
//   · `openai-compatible`：`POST {baseUrl}/chat/completions`，头 `Authorization: Bearer <key>`，
//     取文本 `choices[0].message.content`。
//   · `anthropic`：`POST {baseUrl}/v1/messages`，头 `x-api-key` + `anthropic-version: 2023-06-01`，
//     取文本 `content[0].text`。
//   · `custom`：`POST {baseUrl}{path}`（`path` 可配），头来自 `headers`，取文本按 `extract`
//     （点分路径，默认 `choices.0.message.content`）—— **厂商私有接口的通用出口**。
//
// ★ 多模态（图片输入）—— **2026-10-08 追加**（见契约 §十）。为什么需要：本项目唯一的真实 LLM 调用点
//   `lib/triple-check.mjs` 是**画面/字幕/语义三者一致性校验**，模型是 VLM（`qwen2.5-vl-7b-official`），
//   **必须**把「画面帧」喂进去 —— 纯文本 messages 喂不进来，这个调用点就迁不进本模块。
//   · 支持两种内容块写法（**都由调用方直接写进 `messages`**，本模块**原样透传**）：
//     - OpenAI 兼容：`content: [{type:'text',text:'…'}, {type:'image_url',image_url:{url:'data:image/png;base64,…'}}]`
//     - Anthropic：`content: [{type:'text',text:'…'}, {type:'image',source:{type:'base64',media_type:'image/png',data:'…'}}]`
//   · ★ **便利入参** `opts.images:[{path|base64|dataUrl, mediaType?}]`：由本模块**按 `kind` 自动转成上面两种格式**，
//     并注入**最后一条 user 消息** —— 调用方（`triple-check`）不必自己拼两种格式。`path` 由本模块读成 base64。
//   · ★ **体积守卫**：单图 > 12 MiB（解码后）或单请求体 > 32 MiB（序列化后）⇒ 归一为
//     `{ok:false,error:{kind:'bad-shape'|'config'}}`（**不抛**、**不让 `fetch` 因超大体崩掉**）。
//   · ★★ **纯文本路径完全不变**：`content` 是字符串时，请求体**逐字节**与追加前相同（有单测钉住）。
//
// ★ 配置解析优先级（**严格按此顺序**，见 resolveConfig）：
//   ① 显式传参 → ② 环境变量（LEMO_LLM_*） → ③ 用户覆盖文件（`<_llm-api.json>`，见 §落盘）
//   → ④ 运行时线索（ANTHROPIC_* / OPENAI_*，**只读环境**） → ⑤ 内置默认（PROFILES 表）。
//   ★ ③ 是**扩展**（契约只列了 ①②④⑤）：它就是「面板里保存的配置」，落在**非 C 盘**、**不进仓库**。
//   ★★ 2026-10-08 修正（team-lead 裁定；附规格依据）—— **只把「运行时线索」降到「覆盖文件」之下**：
//      · `ANTHROPIC_*` / `OPENAI_*` 是**别人环境里的第三方变量**，**不该**压过用户在本软件面板里的显式选择；
//      · `LEMO_LLM_*` 是**本项目自己的**约定（CI / 测试用）⇒ 保持最高（仅次于显式传参）。
//      · 由来（规格原文）：「用户仍可在 API 配置面板**手动切换**为其他 API 服务」+「模块配置修改会**全局生效**，
//        影响软件全部依赖大模型的功能」—— 面板改了却被 env 静默遮蔽 ⇒ **直接违反这两句**（已实测复现）。
//      · ★ 原顺序为 ①显式 → ②`LEMO_LLM_*` → ③运行时线索 → ④覆盖文件 → ⑤内置默认（旧注释已更正）。
//
// ★ 落盘（§八）：用户覆盖存 `<成片根>/_llm-api.json`（默认 `D:/lemo-films/_llm-api.json`，
//   与 `.console` / `_distill.json` **同源** —— 都从 lib/env.mjs 的 `CFG.exportDir` 派生，
//   因而认覆盖点 `LEMO_FILM_DIR`）。★ 明文密钥**只在这个文件里**；该路径在**仓库目录之外**，
//   不进 git。★ 读不到 / 解析失败 ⇒ 视为「无覆盖」、**不报错**（只 `warn` 一次）。
//
// ★ 默认 profile = `workbuddy`（`isDefault:true`）。`chat()` / `validate()` 不传 `profile` 时：
//   用 `LEMO_LLM_PROFILE`，没有则 `workbuddy`。
//   ★★ 若 `workbuddy` 未配置完整 ⇒ `validate()` **明确**报「缺 Key / 缺 baseUrl」，
//     **绝不静默回退**到别的 profile（静默回退会让用户以为在用 WorkBuddy）。

// ★★ 对契约（`_distill/llm-api-接口规格-2026-10-08.md`）的**两处修正**（都有真实实测依据，**已报 team-lead**）：
//   ① `validate()` 的探针**升级**：契约 §四 说探针用 `max_tokens:1`；但实测真实端点对 `max_tokens:1`
//      返回 `content:[{type:'text',text:''}]`、`stop_reason:'max_tokens'`（模型只吐 1 个 token 就停）
//      ⇒ 先按契约发 1，**空文本时**再用 `max_tokens:64` 复验一次（避免「1 token」这个探针假象）。
//   ② `validate()` 的 `empty-output` **降级为提示（不改 `ok`）**：契约 §四 说「取到空串 ⇒ empty-output」
//      （隐含判失败）。但**结构合法**（路径解析出了字符串）只是内容为空 ⇒ 那是**模型行为**，不是
//      连通/鉴权/结构的问题。实测：本机已配置的真实端点对 `ping` 在 max_tokens=1/16/32 都返回空文本，
//      而同一个端点 `chat()` **能正常取到文本** ⇒ 判它「坏」是**假阴**（会把可用端点挡在门外，
//      直接违背「接口通信正常、鉴权有效、能收发提示词并返回合法 LLM 文本」这一唯一准入标准）。
//      ⇒ `steps.shape.ok = true` + `kind:'empty-output'`，并进 `warnings[]`；`bad-shape`（结构确实不对）
//      **仍是硬失败**。★ `chat()` 的 `empty-output` **不变**（调用方要的就是文本，空串就是失败）。
//   ③ `validate()` 的「缺 Key」**不再预拦**：契约 §四 的映射是「401/403 ⇒ auth」，而**本地推理接口**
//      （LM Studio / Ollama）**本来就不需要 Key** ⇒ 原先「没配 Key 就先判 config 失败」会把可用端点
//      挡在门外（假阴）。现改为**照常发探针**：真需要鉴权的端点会回 401/403 ⇒ 仍归一为 `auth`，
//      且此时 hint 会**明确说「未配置密钥」**（契约 §六 的「明确报缺 Key」照样满足）。
//   ④ 运行时线索**补** `ANTHROPIC_MODEL` / `OPENAI_MODEL`（裁定：否则「环境里有可用模型、面板却报
//      model_not_found」⇒ 达不到「默认优先、开箱即用」）；`workbuddy` 的 `model` **不再硬写**
//      `claude-sonnet-4-5`（实测真实中转没有它 ⇒ 会让默认 profile 一开就失败），改为「跟随环境，否则留空
//      并由 `validate()` 明确报缺 model」。
//   ⑤ ★ 2026-10-08 追加（**本批唯一的能力补充**，为迁移 `lib/triple-check.mjs` 的 VLM 调用而加）：
//      `chat()` / `buildRequest()` 支持可选 `temperature` 透传 —— **只在显式给值时**写入请求体
//      （不给 ⇒ 逐字节不变）。**由来**：`triple-check` 迁移前硬编码 `temperature:0`（实测该值下模型
//      行为确定性可复现，见 `lib/triple-check.mjs` 的注释），若不透传就会**静默丢掉**这个语义
//      ⇒ 迁移不再「行为等价」。★ 属契约 §三 允许的「实现方可扩充」：**不改**任何导出名/字段名，
//      **不新增** `LEMO_LLM_*` 覆盖点（契约 §二 仍恰 6 个），**不读**覆盖文件。
//   ⑥ ★ 2026-10-08 追加（**本批**，实测驱动）：`workbuddy`（默认 profile）的 baseUrl / model / key
//      **一律取自运行时环境**（`ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL` / `ANTHROPIC_API_KEY`），
//      **绝不硬编码**；已**端到端实测**通过（`validate()` 三步全绿、`chat()` 取到文本）。★ 裁定
//      **不接** `CODEBUDDY_CURRENT_MODEL_ID`：实测其原值在本机中转上**不可直接路由**（HTTP 503，
//      `/v1/models` 里只有带命名空间的 `deepseek-ai/deepseek-v4.1-flash`），且读新 env 须登记进
//      `scripts/check-env-overrides.mjs`（归 `register-llm-api`，越界）⇒ 以运行时**可路由**的
//      `ANTHROPIC_MODEL` 为权威「内置模型」。★ **不改**优先级、**不改**导出名、**不加**覆盖点。
//   ★ 这几处都写成**独立、可一行回退**的形式：把 64 改回 1、把 `empty-output` 分支改回
//     `step(false, …) + pushErr + return out(false, …)`、把缺 Key 的预拦加回、把 `rtModel` 去掉、
//     把 `temperature` 那一行删掉即可。

import fs from 'node:fs';
import path from 'node:path';

// ★ 成片根的**唯一**口径在 lib/env.mjs 的 `CFG.exportDir`（它认覆盖点 `LEMO_FILM_DIR`）。
//   本模块**不再自己算一份** —— 与 lib/store.mjs 的 `.console` 同一条纪律（见 store.mjs:25）。
//   import 方向：llm-api → env → styles-root，**无环**。
import { CFG } from './env.mjs';

// ── 常量 ────────────────────────────────────────────────────
/** 默认 profile：软件内所有 LLM 推理任务默认走它。 */
export const DEFAULT_PROFILE = 'workbuddy';
const DEFAULT_TIMEOUT_MS = 30000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 600000;
/** `validate()` 的「可达性」探针上限：连不上时别让面板等满 30s。 */
const PROBE_TIMEOUT_CAP_MS = 15000;
/** `error.detail` 里响应片段**截断到 200 字**（脱敏后）。 */
const DETAIL_MAX = 200;
/** 脱敏时「短密钥」一律只回 `…`（前 4 位也会泄露真值，见 maskKey）。 */
const MASK_MIN_LEN = 12;
const OVERRIDE_BASENAME = '_llm-api.json';

// ── 多模态（图片输入）体积守卫上限（★ 值写进契约 §十）────────────
/** 单张图片上限（**解码后**字节数）：12 MiB。超限 ⇒ `bad-shape`。 */
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
/** 单次请求体上限（**序列化后** UTF-8 字节数）：32 MiB。★ 防 `fetch` 因超大体崩掉。超限 ⇒ `config`。 */
const MAX_BODY_BYTES = 32 * 1024 * 1024;
/** 图片 mediaType 缺省值（拿不准时按 png）。 */
const DEFAULT_IMAGE_MEDIA = 'image/png';
/** 扩展名 → mediaType（`opts.images[].path` 未给 mediaType 时按扩展名推）。 */
const EXT_MEDIA = Object.freeze({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp',
});
/** ★ 导出体积上限（供调用方/测试构造刚好超限的负载；**只读**）。 */
export const IMAGE_LIMITS = Object.freeze({
  maxImageBytes: MAX_IMAGE_BYTES, maxBodyBytes: MAX_BODY_BYTES,
});

// ── 内置 profile 表 ─────────────────────────────────────────
//   ★ `workbuddy` 是**默认**（isDefault:true）。★ 本表**不含任何密钥**（key 一律从环境/覆盖点取）。
//   ★ 这是「表」：id → profile 定义。对外用 `listProfiles()` 拿数组。
//   ★ 2026-10-08 追加：**国产厂商内置预设**（豆包/火山方舟、通义/百炼、腾讯混元、DeepSeek、
//     智谱 GLM、月之暗面 Kimi、硅基流动）—— 复用 `openai-compatible` 适配器；默认 profile **仍是
//     `workbuddy`**（新增预设一律 `isDefault:false`）。详见下方该段注释与契约 §十一。
export const PROFILES = Object.freeze({
  workbuddy: {
    id: 'workbuddy', label: 'WorkBuddy（默认）', kind: 'anthropic',
    // ★★ baseUrl **故意留空**（不给默认）：WorkBuddy 的服务端点不是公共 Anthropic 地址，本模块**不知道**
    //   它是什么 ⇒ 不猜、不硬编码。这样「未配置完整 ⇒ validate() 明确报『缺 baseUrl』」才**可达**
    //   （契约 §六 的硬要求），也**绝不静默回退**到别的 profile。
    //   ★ 实际取值顺序：显式 → LEMO_LLM_BASE → 覆盖文件（面板） → 运行时线索 ANTHROPIC_BASE_URL → 这里（空）。
    baseUrl: '',
    // ★★ model 也**故意留空**（2026-10-08 team-lead 裁定）：**不硬写** `claude-sonnet-4-5` ——
    //   实测本机真实中转**没有**这个模型（`model_not_found`），硬写会让**默认 profile 一开就失败**。
    //   ⇒ 取值顺序：显式 → LEMO_LLM_MODEL → 覆盖文件（面板） → 运行时线索 ANTHROPIC_MODEL → 这里（空）。
    //   全空时 `validate()` **明确报「缺 model」**（不猜、不静默用别的模型）。
    model: '', headers: {}, isDefault: true,
    note: '软件内所有 LLM 推理任务默认走它。★ 本模块不预置任何密钥 / 端点 / 模型 —— 一律「取自运行时环境、'
      + '以运行时配置为准」：baseUrl 从 ANTHROPIC_BASE_URL / LEMO_LLM_BASE / 面板取；key 从 ANTHROPIC_API_KEY / '
      + 'LEMO_LLM_KEY / 面板取；model 从 ANTHROPIC_MODEL / LEMO_LLM_MODEL / 面板取（都为空时 validate() 明确报缺，'
      + '不猜、不硬编码）。',
  },
  anthropic: {
    id: 'anthropic', label: 'Anthropic（Claude 原生）', kind: 'anthropic',
    // ★ 2026-10-08 裁定：本 profile 的 `model` **保留**字面默认 `claude-sonnet-4-5` —— 它指向**官方**
    //   `api.anthropic.com`（与 `workbuddy` 的**未知中转**不同），该模型名在**官方端点上确实有效**。
    //   ★ 覆盖文件（面板）/ 运行时线索 `ANTHROPIC_MODEL` **都会覆盖**它；`LEMO_LLM_MODEL` / 显式参数再压过它们。
    //   ★ 若日后官方改名 —— 改这里（那才是该改的地方），**不提前猜**。
    baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5', headers: {},
    note: '原生大模型 API：POST {baseUrl}/v1/messages，头 x-api-key + anthropic-version: 2023-06-01，'
      + '取文本路径 content[0].text。★ 默认 model `claude-sonnet-4-5` 是「官方端点上的已知有效模型名」，'
      + '会被运行时线索 ANTHROPIC_MODEL 覆盖。',
  },
  'openai-compatible': {
    id: 'openai-compatible', label: 'OpenAI 兼容（云端 / 中转）', kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', headers: {},
    note: 'POST {baseUrl}/chat/completions，头 Authorization: Bearer <key>，取文本 choices[0].message.content。'
      + '多数中转 / 兼容服务（含 DeepSeek、vLLM、Ollama 的 /v1 等）都走这个形状。',
  },
  // ── ★ 2026-10-08 追加：国产厂商内置预设（**原生兼容国内主流大模型生态**）──────
  //   规格要求「原生兼容国内主流智能体与大模型生态，包含但不限于豆包 / 通义千问 / 腾讯系列」。
  //   原先**没有任何国产厂商预设** ⇒ 用户要接豆包/通义，必须自己查 endpoint 再手填 ⇒ 不算「原生兼容」。
  //   ⇒ 这里内置常用的国产厂商：**选一家、填 Key 即可**（不必自己查 endpoint 与模型名）。
  //   ★ 纪律：
  //     · 每家只写**已核实**的 endpoint 与模型名；没把握的厂商**不写**（写错比没有更糟）。
  //     · 全部复用既有适配器 kind `openai-compatible`（**不新增** kind 字面量、**不改**解析逻辑）。
  //     · ★ **不预置任何密钥**：key 一律从面板 / `LEMO_LLM_KEY` / 覆盖文件取（与既有 profile 同一条纪律）。
  //     · ★ **不新增任何 `LEMO_LLM_*` 覆盖点**（契约 §二 仍恰 6 个）。
  //     · `models[]` 供面板多模型切换；`model` 是常用默认值；`note` 里写清「去哪拿 Key」的控制台名。
  //     · ★ 厂商模型名/端点会迭代 ⇒ note 里统一提示「以官方控制台当列为准」，并可用面板「拉取模型列表」核对。
  doubao: {
    id: 'doubao', label: '豆包 / 火山方舟（字节跳动）', kind: 'openai-compatible',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-251015',
    models: ['doubao-seed-1-6-251015', 'doubao-seed-2-0-pro-260215',
      'doubao-seed-2-0-lite-260215', 'doubao-seed-2-0-mini-260215'],
    headers: {},
    note: '火山方舟 OpenAI 兼容端点（POST {baseUrl}/chat/completions，头 Authorization: Bearer <key>）。'
      + 'Key 在「火山引擎 · 方舟控制台 → API Key 管理」创建；★ 每个模型要先去「开通管理」开通才能调'
      + '（未开通会报模型不存在）。★ 模型 ID 常带日期后缀、随版本迭代，请以方舟控制台「模型广场」当列为准，'
      + '可用面板「拉取模型列表」核对。★ 模型名可能随厂商迭代变化；可用面板「拉取模型」刷新。',
  },
  qwen: {
    id: 'qwen', label: '通义千问 / 阿里云百炼（DashScope）', kind: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus',
    models: ['qwen-plus', 'qwen-flash', 'qwen3-max', 'qwen3-vl-plus'],
    headers: {},
    note: '阿里云百炼的 OpenAI 兼容模式（中国大陆版端点）。Key 在「阿里云百炼控制台（Model Studio）→ API-KEY 管理」创建；'
      + '★ 国际版端点请改用 https://dashscope-intl.aliyuncs.com/compatible-mode/v1（在面板覆盖 baseUrl）。'
      + '模型名以百炼「模型列表」当列为准。★ 模型名可能随厂商迭代变化；可用面板「拉取模型」刷新。',
  },
  hunyuan: {
    id: 'hunyuan', label: '腾讯混元（Tencent Hunyuan）', kind: 'openai-compatible',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', model: 'hunyuan-turbos-latest',
    models: ['hunyuan-turbos-latest', 'hunyuan-turbo', 'hunyuan-lite', 'hunyuan-vision',
      'hunyuan-functioncall'],
    headers: {},
    note: '腾讯混元「提供 OpenAI 兼容端点」（本预设用它与 OpenAI 兼容的那一套；混元另也提供 Anthropic 兼容端点）。'
      + 'Key 在「腾讯云 · 混元大模型控制台 → API Key 管理」创建；model 填混元模型名。'
      + '★ 混元相关能力在逐步迁移，模型名请以控制台当列为准。★ 模型名可能随厂商迭代变化；可用面板「拉取模型」刷新。',
  },
  deepseek: {
    id: 'deepseek', label: 'DeepSeek（深度求索）', kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
    headers: {},
    note: 'DeepSeek 官方 OpenAI 兼容端点（POST {baseUrl}/chat/completions）。'
      + 'Key 在「DeepSeek 开放平台 → API keys」创建。★ 模型名以官方文档当列为准'
      + '（旧名如 deepseek-chat / deepseek-reasoner 可能已下线），可用面板「拉取模型列表」核对。'
      + '★ 模型名可能随厂商迭代变化；可用面板「拉取模型」刷新。',
  },
  zhipu: {
    id: 'zhipu', label: '智谱 GLM（智谱开放平台）', kind: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3',
    models: ['glm-5.3', 'glm-5.3-flash', 'glm-5.2'],
    headers: {},
    note: '智谱开放平台 OpenAI 兼容端点（POST {baseUrl}/chat/completions）。'
      + 'Key 在「智谱开放平台 → API Keys」创建；★ 模型名以平台模型列表当列为准。'
      + '★ 模型名可能随厂商迭代变化；可用面板「拉取模型」刷新。',
  },
  kimi: {
    id: 'kimi', label: '月之暗面 Kimi（Moonshot）', kind: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.7',
    models: ['kimi-k2.7', 'kimi-k2.6', 'kimi-k2.5', 'moonshot-v1-128k'],
    headers: {},
    note: '月之暗面按量 OpenAI 兼容端点（中国区；全球入口为 https://api.moonshot.ai/v1）。'
      + 'Key 在「Kimi 开放平台 → API Key 管理」创建；★ 模型名以平台模型列表当列为准'
      + '（旧名 kimi-k2 已停服）。★ 模型名可能随厂商迭代变化；可用面板「拉取模型」刷新。',
  },
  siliconflow: {
    id: 'siliconflow', label: '硅基流动 SiliconFlow（国产模型聚合）', kind: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3',
    models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen3-8B'],
    headers: {},
    note: '硅基流动（国内模型聚合平台）OpenAI 兼容端点：一个 Key 可调多家开源 / 国产模型。'
      + 'Key 在「硅基流动控制台 → API 密钥」创建；★ 模型名「必须带命名空间前缀」'
      + '（如 deepseek-ai/…、Qwen/…），少写前缀会报模型不存在。'
      + '★ 模型名可能随厂商迭代变化；可用面板「拉取模型」刷新。',
  },
  lmstudio: {
    id: 'lmstudio', label: 'LM Studio（本地推理）', kind: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:12345/v1', model: '', headers: {},
    note: '本地推理接口（OpenAI 兼容），默认无需密钥。地址与 lib/triple-check.mjs 的 LM_BASE 同源；'
      + 'model 请填 LM Studio 里实际加载的模型 id。',
  },
  custom: {
    id: 'custom', label: '自定义（厂商私有接口）', kind: 'custom',
    baseUrl: '', model: '', path: '/chat/completions', extract: 'choices.0.message.content', headers: {},
    note: '★ 通用出口：配好 baseUrl + path + headers + extract，「任何返回 JSON 的接口都能接」。'
      + 'extract 是点分路径（如 result.outputs.0.text）。',
  },
});

// ── 小工具 ──────────────────────────────────────────────────
const warned = new Set();
/** 每个消息只 warn 一次（避免刷屏）；warn 绝不抛、绝不含密钥。 */
function warnOnce(msg) {
  if (warned.has(msg) || warned.size >= 20) return;
  warned.add(msg);
  console.warn(`  ⚠️  [llm-api] ${msg}`);
}

const isBlank = (v) => v === undefined || v === null || v === '';
/** 取第一个「非空」值（★ 空串 / null / undefined 都算「没给」）。 */
const pick = (...vals) => vals.find((v) => !isBlank(v));
/** 去掉尾部斜杠（`…/v1/` + `/chat/completions` 会拼出双斜杠）。 */
const stripSlash = (s) => String(s ?? '').replace(/\/+$/, '');

/**
 * 脱敏：**只显示前 4 位 + `…`**（契约 §四）。
 * ★ 短密钥（< 12 位）连前 4 位都不显示 —— 否则「前 4 位」本身就是真值的大半（会泄露）。
 */
export function maskKey(k) {
  const s = String(k ?? '');
  if (!s) return '';
  return s.length >= MASK_MIN_LEN ? `${s.slice(0, 4)}…` : '…';
}
/** 把已知密钥从任意文本里抹掉（响应片段回显密钥时兜底）。 */
function redact(s, secrets = []) {
  let out = String(s ?? '');
  for (const sec of secrets) {
    const v = String(sec ?? '');
    if (v.length < 4) continue;
    out = out.split(v).join(maskKey(v));
  }
  return out;
}
/** 单行化 + 截断到 DETAIL_MAX（契约 §五）。 */
function clip(s, n = DETAIL_MAX) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}
const toStrArray = (v) => (Array.isArray(v) ? v.map((x) => (x == null ? '' : String(x))).filter(Boolean) : []);

function clampTimeout(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(n)));
}

/** 合并请求头（后面的覆盖前面的）；值统一转字符串。 */
function mergeHeaders(...objs) {
  const out = {};
  for (const o of objs) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined || v === null) continue;
      out[String(k)] = String(v);
    }
  }
  return out;
}

/** 读环境变量 `LEMO_LLM_HEADERS`（JSON 字符串）→ 对象；非法 ⇒ 忽略并 warn 一次。 */
function envHeaders() {
  const raw = process.env.LEMO_LLM_HEADERS;
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === 'object' && !Array.isArray(o)) return o;
    warnOnce('LEMO_LLM_HEADERS 不是 JSON 对象 → 已忽略');
  } catch {
    warnOnce('LEMO_LLM_HEADERS 不是合法 JSON → 已忽略');
  }
  return {};
}

// ── 落盘：用户覆盖（§八，**非 C 盘、不进仓库**）───────────────
/** 用户覆盖文件路径：`<成片根>/_llm-api.json`（认覆盖点 `LEMO_FILM_DIR`，见 lib/env.mjs）。 */
export function overrideFilePath() {
  return path.join(CFG.exportDir, OVERRIDE_BASENAME);
}

/**
 * 读用户覆盖。★ 读不到 / 解析失败 ⇒ 返回 `{}`（视为「无覆盖」），**不抛**（只 warn 一次）。
 * ★ 本函数只**读**，绝不回显文件内容（那里面可能有明文密钥）。
 */
export function readOverride() {
  const file = overrideFilePath();
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code !== 'ENOENT') warnOnce(`读 LLM 覆盖配置失败（${(e && e.message) || e}）→ 视为「无覆盖」`);
    return {};
  }
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('顶层不是对象');
    return obj;
  } catch (e) {
    warnOnce(`LLM 覆盖配置损坏（${(e && e.message) || e}）→ 视为「无覆盖」`);
    return {};
  }
}

/**
 * 保存用户覆盖（面板 POST /api/llm/config 落盘用）。与现有覆盖**合并**，原子写（tmp + rename）。
 * ★ 尽力而为：失败只返回 `{ok:false,error}`，**不抛**。★ 该文件是**唯一**允许含明文密钥的地方（§八）。
 */
export function saveOverride(partial = {}) {
  try {
    const next = { ...readOverride(), ...(partial && typeof partial === 'object' ? partial : {}) };
    const file = overrideFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return { ok: true, path: file };
  } catch (e) {
    return { ok: false, error: { kind: 'config', message: `保存 LLM 覆盖配置失败：${(e && e.message) || e}` } };
  }
}

// ── 配置解析（★ 优先级见文件头）─────────────────────────────
/**
 * 解析「当前生效」的 LLM 配置。
 * @param {object} [opts] 可含 profile / baseUrl / apiKey / model / headers / timeoutMs / kind / path / extract / models
 * @returns {{id:string,label:string,kind:string,baseUrl:string,apiKey:string,headers:object,timeoutMs:number,
 *            model:string,models:string[],path:(string|undefined),extract:(string|undefined),
 *            isDefault:boolean,unknownProfile:boolean}}
 * ★ 返回值里**有 apiKey**（契约要求），调用方**必须**自行脱敏，别打进日志。
 */
export function resolveConfig(opts = {}, _file) {
  const file = _file === undefined ? readOverride() : _file;
  const o = opts && typeof opts === 'object' ? opts : {};

  const id = String(pick(o.profile, process.env.LEMO_LLM_PROFILE, file.profile, DEFAULT_PROFILE));
  const known = PROFILES[id];
  const base = known || {
    id, label: `${id}（未知 profile）`, kind: 'custom', baseUrl: '', model: '', headers: {},
    note: '未知 profile：请检查 profile 名（可用 listProfiles() 看有哪些）。',
  };
  const kind = String(pick(o.kind, file.kind, base.kind, 'custom'));

  // ④ 运行时线索（★ 只读**环境**，不读任何密钥文件）—— ★★ 2026-10-08 修正：**降到「覆盖文件」之下**。
  //   ★ 为什么降：`ANTHROPIC_*` / `OPENAI_*` 是**别人环境里的第三方变量**，**不该**压过用户在本软件
  //     面板里的显式选择（规格：「用户仍可在 API 配置面板**手动切换**为其他 API 服务」+「模块配置修改会
  //     **全局生效**」）—— 原顺序下「面板改了却被 env 静默遮蔽」，直接违反这两句（已实测复现）。
  //   ★ `LEMO_LLM_*` 是**本项目自己的**约定（CI / 测试用）⇒ 仍**高于**覆盖文件（见下 pick 顺序）。
  //   ★ 2026-10-08 裁定（team-lead，**保留**）：`ANTHROPIC_MODEL` / `OPENAI_MODEL` 也纳入 —— 否则
  //     「环境里明明有可用模型、面板却报 model_not_found」⇒ 达不到「默认优先、开箱即用」。
  //   ★★ 2026-10-08 追加（本批，**实测驱动**）：anthropic 形状的 model 线索**只认 `ANTHROPIC_MODEL`**，
  //     **刻意不接** `CODEBUDDY_CURRENT_MODEL_ID` —— 两条独立理由：
  //       ① **实测**（本机真实中转 `http://43.139.159.106:3000`）：`ANTHROPIC_MODEL`
  //          （`nvidia/nemotron-3-super-120b-a12b`）**可路由**（`chat()` 取到文本、HTTP 200）；
  //          而 `CODEBUDDY_CURRENT_MODEL_ID` 原值（`deepseek-v4.1-flash`）**不可直接路由**（HTTP 503），
  //          `/v1/models`（85 个模型）里只有**带命名空间**的 `deepseek-ai/deepseek-v4.1-flash`。
  //          ⇒ 若把它当 model，会让**默认 profile 一开就 503**（比「明确报缺 model」更糟）。
  //       ② **登记归属**：读一个**新** `process.env.*` 必须登记进 `scripts/check-env-overrides.mjs` 的
  //          `OVERRIDES`/`EXTERNAL`（该文件归 `register-llm-api`，**不是**本模块作者的改动范围）⇒ 越界。
  //     ⇒ 结论：`workbuddy` 的「内置模型」= 运行时**可路由**的 `ANTHROPIC_MODEL`；两者都为空 ⇒ 回落内置表
  //       （`workbuddy` 为 `''`）⇒ `validate()` 明确报「缺 model」（不猜、不静默用别的模型）。
  //     ★ 优先级**未变**：显式 → LEMO_LLM_* → 覆盖文件（面板） → 运行时线索（本处） → 内置默认。
  const rtBase = kind === 'anthropic' ? process.env.ANTHROPIC_BASE_URL
    : kind === 'openai-compatible' ? process.env.OPENAI_BASE_URL : undefined;
  const rtKey = kind === 'anthropic' ? process.env.ANTHROPIC_API_KEY
    : kind === 'openai-compatible' ? process.env.OPENAI_API_KEY : undefined;
  const rtModel = kind === 'anthropic' ? process.env.ANTHROPIC_MODEL
    : kind === 'openai-compatible' ? process.env.OPENAI_MODEL : undefined;

  // ★★ 取值顺序（2026-10-08 修正后，与文件头一致）：
  //   ① 显式传参 → ② LEMO_LLM_* → ③ 覆盖文件（面板） → ④ 运行时线索 → ⑤ 内置默认。
  const baseUrl = stripSlash(pick(o.baseUrl, process.env.LEMO_LLM_BASE, file.baseUrl, rtBase, base.baseUrl, ''));
  const apiKey = String(pick(o.apiKey, process.env.LEMO_LLM_KEY, file.apiKey, rtKey, '') ?? '');
  const model = String(pick(o.model, process.env.LEMO_LLM_MODEL, file.model, rtModel, base.model, '') ?? '');
  const headers = mergeHeaders(base.headers, file.headers, envHeaders(), o.headers);
  const timeoutMs = clampTimeout(pick(o.timeoutMs, process.env.LEMO_LLM_TIMEOUT_MS, file.timeoutMs, DEFAULT_TIMEOUT_MS));
  const p = pick(o.path, file.path, base.path);
  const ex = pick(o.extract, file.extract, base.extract);
  const models = toStrArray(pick(o.models, file.models, base.models));

  return {
    id, label: base.label, kind, baseUrl, apiKey, headers, timeoutMs, model, models,
    path: p === undefined ? undefined : String(p),
    extract: ex === undefined ? undefined : String(ex),
    isDefault: !!base.isDefault,
    unknownProfile: !known,
  };
}

/** 脱敏后的配置视图（**绝不含密钥明文**）—— 面板 GET /api/llm/config 可直接用。 */
export function maskedConfig(cfg) {
  const headers = {};
  for (const [k, v] of Object.entries(cfg.headers || {})) {
    const lk = k.toLowerCase();
    headers[k] = (lk === 'authorization' || lk === 'x-api-key' || lk === 'api-key'
      || lk.includes('token') || lk.includes('secret') || lk.includes('key'))
      ? maskKey(v) : redact(v, [cfg.apiKey]);
  }
  return {
    id: cfg.id, label: cfg.label, kind: cfg.kind, baseUrl: cfg.baseUrl, model: cfg.model,
    hasKey: !!cfg.apiKey, keyMask: maskKey(cfg.apiKey), timeoutMs: cfg.timeoutMs,
    path: cfg.path, extract: cfg.extract, models: cfg.models, headers,
  };
}

/**
 * ★ **面板专用：只预览、不生效** —— 看「某个 profile 自己会解析成什么」。
 *
 * 语义（★ 关键三条）：
 *   · **不依赖当前 `LEMO_LLM_PROFILE`**：`profile` 是**显式**参数 ⇒ 永远压过环境变量（下拉框切谁就看谁）；
 *   · **不发任何网络请求**：纯本地解析（`resolveConfig` 不做 IO、只读环境与内置表）；
 *   · **不读覆盖文件**：第二个参数传 `{}` ⇒ 预览的是「内置默认 + 环境/运行时线索」，**不含**面板保存过的覆盖
 *     （★ 与面板方原本自己调的 `resolveConfig(opts, {})` **逐字同语义** ⇒ 换成本函数**零行为变化**）。
 *
 * ★ 实现是 `resolveConfig` + `maskedConfig` 的**薄封装** —— **绝不**另造一套解析（否则两份口径必然漂移；
 *   本批面板方已因「自己写了一套落盘读写」删掉重来过一次）。
 * ★ 输出**绝不含 key 明文**（`maskedConfig` 已用 `maskKey` 脱敏，含 header 里的密钥类字段）。
 *
 * @param {string} id profile id（空 / 不传 ⇒ 用默认 profile `workbuddy`）
 * @returns {{id,label,kind,baseUrl,model,hasKey,keyMask,timeoutMs,path,extract,models,headers,
 *            note,isDefault,unknownProfile}}
 *          ★ 比契约多出 `keyMask`/`path`/`extract`/`models`/`unknownProfile`（都是面板切 profile 时要显示的）。
 */
export function previewProfile(id) {
  const key = String(pick(id, DEFAULT_PROFILE));           // ★ 空/未传 ⇒ 默认 profile（**不**落到 LEMO_LLM_PROFILE）
  const cfg = resolveConfig({ profile: key }, {});         // ★ 显式 profile + 不读覆盖文件
  return {
    ...maskedConfig(cfg),
    note: (PROFILES[key] && PROFILES[key].note) || '',
    isDefault: !!cfg.isDefault,
    unknownProfile: !!cfg.unknownProfile,
  };
}

/**
 * 内置 profile 列表（★ 脱敏：**绝不含 key 明文**，只回 `hasKey`）。
 * @returns {{id,label,kind,baseUrl,model,hasKey,isDefault,note}[]}
 */
export function listProfiles() {
  const file = readOverride();                       // 只读一次（5 个 profile 共用）
  return Object.values(PROFILES).map((p) => {
    const cfg = resolveConfig({ profile: p.id }, file);
    return {
      id: p.id, label: p.label, kind: cfg.kind, baseUrl: cfg.baseUrl, model: cfg.model,
      hasKey: !!cfg.apiKey, isDefault: !!p.isDefault, note: p.note || '',
    };
  });
}

// ── 请求构造 ────────────────────────────────────────────────
/** 取文本的点分路径（契约 §三）。 */
function extractPath(cfg) {
  if (cfg.extract) return cfg.extract;
  return cfg.kind === 'anthropic' ? 'content.0.text' : 'choices.0.message.content';
}

/** 鉴权头（可达性探针 / listModels 共用）。 */
function authHeaders(cfg) {
  const h = { ...cfg.headers };
  if (cfg.kind === 'anthropic') {
    if (cfg.apiKey) h['x-api-key'] = cfg.apiKey;
    h['anthropic-version'] = h['anthropic-version'] || '2023-06-01';
  } else if (cfg.apiKey) {
    h.Authorization = `Bearer ${cfg.apiKey}`;
  }
  return h;
}

/** 按 kind 构造一次对话请求。
 *  ★ 2026-10-08 追加 `temperature`（本批**唯一**对模块的能力补充；见文件头「对契约的修正」与
 *    `lib/triple-check.mjs` 的迁移报告）：把调用方**显式给**的 `temperature` 透传进请求体。
 *    ★ **只在 `temperature !== undefined` 时写入** ⇒ 未给值的既有路径（纯文本 / validate 探针）
 *      请求体**逐字节不变**（`test/llm-api.test.mjs` 的「纯文本回归」金标仍逐字节相等）。
 *    ★ **不**新增任何 `LEMO_LLM_*` 环境变量、**不**读覆盖文件 —— 以免动到契约 §二 的 6 个覆盖点。 */
function buildRequest(cfg, messages, { maxTokens, temperature } = {}) {
  const headers = { 'Content-Type': 'application/json', ...cfg.headers };
  let url;
  let body;
  if (cfg.kind === 'anthropic') {
    url = `${cfg.baseUrl}/v1/messages`;
    if (cfg.apiKey) headers['x-api-key'] = cfg.apiKey;
    headers['anthropic-version'] = headers['anthropic-version'] || '2023-06-01';
    body = { model: cfg.model, max_tokens: maxTokens ?? 1024, messages };
  } else if (cfg.kind === 'custom') {
    url = `${cfg.baseUrl}${cfg.path || '/chat/completions'}`;
    if (cfg.apiKey && !headers.Authorization) headers.Authorization = `Bearer ${cfg.apiKey}`;
    body = { model: cfg.model, messages, stream: false };
    if (maxTokens) body.max_tokens = maxTokens;
  } else {                                            // openai-compatible
    url = `${cfg.baseUrl}/chat/completions`;
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    body = { model: cfg.model, messages, stream: false };
    if (maxTokens) body.max_tokens = maxTokens;
  }
  if (temperature !== undefined) body.temperature = temperature;   // ★ 仅在显式给值时写入（见函数头注释）
  return { url, headers, body: JSON.stringify(body) };
}

/**
 * 底层 HTTP：带超时的 fetch。★ 超时用 `AbortController`，`finally` 里**必须** `clearTimeout`。
 * @returns {Promise<{net:true,status:number,resOk:boolean,text:string,ms:number}
 *                  | {net:false,timedOut:boolean,error:any,ms:number}>}
 */
async function httpRequest(url, { method = 'POST', headers = {}, body = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1, timeoutMs));
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method, headers, body: body == null ? undefined : body, signal: ac.signal });
    const text = await res.text();                    // ★ 先 text() 再自己 JSON.parse（不让 res.json() 抛出去）
    return { net: true, status: res.status, resOk: res.ok, text, ms: Date.now() - t0 };
  } catch (e) {
    const timedOut = ac.signal.aborted || (e && e.name === 'AbortError');
    return { net: false, timedOut, error: e, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);                              // ★★ 不清理定时器 ⇒ 进程挂住（本项目踩过）
  }
}

/** 网络层错误 → kind。 */
function netErrorKind(e, timedOut) {
  if (timedOut) return 'timeout';
  const cause = e && e.cause;
  const code = (cause && cause.code) || (e && e.code);
  const msg = String((e && e.message) || e || '');
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE',
    'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(code)) {
    return 'unreachable';
  }
  if (/fetch failed|network|socket|ECONN|getaddrinfo|ENOTFOUND|EAI_AGAIN|terminated/i.test(msg)) return 'unreachable';
  return 'unknown';
}

/** HTTP 状态码 → kind（契约 §四）。 */
function httpErrorKind(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate-limit';
  return 'http-error';                               // 5xx 与其它非 2xx
}

/** 按点分路径取子值（`choices.0.message.content` / `content.0.text`）。 */
function getPath(obj, p) {
  if (!p) return undefined;
  let cur = obj;
  for (const seg of String(p).split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/**
 * 按适配器取文本。返回 `{text, path}`（`text` 非字符串 ⇒ 视为取不到）。
 * ★ 扩充（2026-10-08 **真实实测**，不改契约字段名）：`anthropic` 形状的响应可能把
 *   **非文本块**（如 `thinking`）放在 `content[0]`，此时契约的 `content.0.text` 取不到字符串。
 *   ⇒ 退一步扫 `content[]`，取**第一个带字符串 `text` 的块**。实测命中：某中转对
 *   `max_tokens:1` 返回 `content:[{type:'text',text:''}]`（空文本，见 validate 的探针升级）。
 */
function extractText(cfg, json) {
  const p = extractPath(cfg);
  const v = getPath(json, p);
  if (typeof v === 'string') return { text: v, path: p };
  if (cfg.kind === 'anthropic' && json && Array.isArray(json.content)) {
    const blk = json.content.find((b) => b && typeof b === 'object' && typeof b.text === 'string');
    if (blk) return { text: blk.text, path: `${p}（回退 content[].text）` };
  }
  return { text: undefined, path: p };
}

/** 归一化 messages：字符串 → 单条 user；对象保留 role/content；非法项丢弃。
 *  ★ 2026-10-08 追加（多模态）：`content` 是**数组**时**原样保留**（多模态内容块）—— 不再 `JSON.stringify`
 *    ⇒ 这是「支持图片输入」的关键改动。★ `content` 是**字符串**（纯文本）时**行为逐字节不变**（有单测钉住）。 */
function normalizeMessages(messages) {
  if (typeof messages === 'string') return [{ role: 'user', content: messages }];
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => {
      if (typeof m === 'string') return { role: 'user', content: m };
      if (!m || typeof m !== 'object') return null;
      const content = (typeof m.content === 'string' || Array.isArray(m.content))
        ? m.content
        : JSON.stringify(m.content ?? '');
      return { role: String(m.role || 'user'), content };
    })
    .filter(Boolean);
}

// ── 多模态（图片输入）辅助 ──────────────────────────────────
/** base64 字符串 → **解码后**字节数（不真解码，按长度估算；够体积守卫用）。 */
function base64DecodedBytes(b64) {
  const s = String(b64 ?? '').replace(/\s+/g, '');
  if (!s) return 0;
  let pad = 0;
  if (s.endsWith('==')) pad = 2;
  else if (s.endsWith('=')) pad = 1;
  return Math.max(0, Math.floor((s.length * 3) / 4) - pad);
}

/**
 * 便利入参里的**一张图** → 内容块（按 `kind` 选格式）。★ 失败归一为 `{ok:false,error:{kind,message}}`，**不抛**。
 * @param {{path?:string,base64?:string,dataUrl?:string,mediaType?:string}} item
 * @param {string} kind 适配器 kind
 * @param {number} i 下标（报错定位用）
 */
function toImageBlock(item, kind, i) {
  const tag = `opts.images[${i}]`;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, error: { kind: 'bad-shape', message: `${tag} 不是对象（需 {path|base64|dataUrl, mediaType?}）` } };
  }
  let mediaType = typeof item.mediaType === 'string' && item.mediaType ? item.mediaType : '';
  let data;
  if (!isBlank(item.dataUrl)) {                       // ① 已给的 dataURL
    const m = /^data:([^;,]+)?;base64,(.*)$/is.exec(String(item.dataUrl).trim());
    if (!m) return { ok: false, error: { kind: 'bad-shape', message: `${tag}.dataUrl 不是合法的 data:<mime>;base64,<数据> URL` } };
    if (m[1] && !mediaType) mediaType = m[1];
    data = m[2];
  } else if (!isBlank(item.base64)) {                 // ② 已给的 base64
    data = String(item.base64);
  } else if (!isBlank(item.path)) {                   // ③ 本地文件路径（本模块读成 base64）
    const p = String(item.path);
    try {
      data = fs.readFileSync(p).toString('base64');
    } catch (e) {
      return { ok: false, error: { kind: 'config', message: `${tag} 读取本地图片失败：${(e && e.message) || e}` } };
    }
    if (!mediaType) mediaType = EXT_MEDIA[path.extname(p).toLowerCase()] || DEFAULT_IMAGE_MEDIA;
  } else {
    return { ok: false, error: { kind: 'bad-shape', message: `${tag} 缺少图片来源（需 path / base64 / dataUrl 之一）` } };
  }
  data = String(data ?? '').replace(/\s+/g, '');
  if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return { ok: false, error: { kind: 'bad-shape', message: `${tag} 的 base64 内容非法` } };
  }
  const bytes = base64DecodedBytes(data);
  if (bytes > MAX_IMAGE_BYTES) {
    return { ok: false, error: { kind: 'bad-shape', message: `${tag} 图片过大（${bytes} 字节 > 上限 ${MAX_IMAGE_BYTES} 字节）` } };
  }
  if (!mediaType) mediaType = DEFAULT_IMAGE_MEDIA;
  const block = kind === 'anthropic'
    ? { type: 'image', source: { type: 'base64', media_type: mediaType, data } }
    : { type: 'image_url', image_url: { url: `data:${mediaType};base64,${data}` } };
  return { ok: true, block };
}

/**
 * 把 `opts.images` 转成内容块并注入**最后一条 user 消息**（没有则补一条）。
 * ★ `custom` 按 OpenAI 兼容形状转（它的默认 `extract` 就是 `choices.0.message.content`）。
 */
function injectImages(msgs, images, kind) {
  if (!Array.isArray(images)) {
    return { ok: false, error: { kind: 'bad-shape', message: 'opts.images 必须是数组（[{path|base64|dataUrl, mediaType?}]）' } };
  }
  if (!images.length) return { ok: true };
  const blocks = [];
  for (let i = 0; i < images.length; i++) {
    const r = toImageBlock(images[i], kind, i);
    if (!r.ok) return r;
    blocks.push(r.block);
  }
  let idx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === 'user') { idx = i; break; } }
  if (idx === -1) { msgs.push({ role: 'user', content: blocks }); return { ok: true }; }
  const cur = msgs[idx].content;
  msgs[idx] = Array.isArray(cur)
    ? { ...msgs[idx], content: [...cur, ...blocks] }
    : { ...msgs[idx], content: [{ type: 'text', text: String(cur ?? '') }, ...blocks] };
  return { ok: true };
}

/**
 * 走一遍 messages 里的图片块：① 单图体积守卫；② 收集 base64 负载（供错误 `detail` 脱敏 —— 图片内容不外泄）。
 * ★ **纯文本消息（`content` 是字符串）直接跳过** ⇒ 既有路径零影响。
 * @returns {{ok:true,count:number,payloads:string[]}|{ok:false,kind:string,message:string}}
 */
function scanImages(msgs) {
  const payloads = [];
  let count = 0;
  for (const m of msgs) {
    const c = m && m.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (!b || typeof b !== 'object') continue;
      let b64 = null;
      if (b.type === 'image_url' && b.image_url && typeof b.image_url.url === 'string') {
        const mm = /^data:[^;,]*;base64,(.*)$/is.exec(b.image_url.url.trim());
        if (!mm) { count++; continue; }               // 远程 URL（非 data:）⇒ 体积由服务端管，不拦
        b64 = mm[1];
      } else if (b.type === 'image' && b.source && typeof b.source === 'object'
        && b.source.type === 'base64' && typeof b.source.data === 'string') {
        b64 = b.source.data;
      } else {
        continue;                                     // 非图片块 / 不认识 ⇒ 不拦（交给服务端判）
      }
      b64 = b64.replace(/\s+/g, '');
      count++;
      const bytes = base64DecodedBytes(b64);
      if (bytes > MAX_IMAGE_BYTES) {
        return { ok: false, kind: 'bad-shape', message: `单张图片过大（${bytes} 字节 > 上限 ${MAX_IMAGE_BYTES} 字节）` };
      }
      if (b64.length >= 8) payloads.push(b64);        // 供错误脱敏
    }
  }
  return { ok: true, count, payloads };
}

/** 统一失败对象（契约 §五：`{kind,message,httpStatus?,detail?}`）。★ detail 已脱敏 + 截断。
 *  ★ `secrets` 可为单个值或数组（第 5 参兼容旧调用）—— 除密钥外，**图片 base64 负载也一并抹掉**（图片内容不外泄）。 */
function fail(kind, message, meta, detail, secrets) {
  const error = { kind, message: String(message) };
  if (meta && meta.httpStatus !== undefined) error.httpStatus = meta.httpStatus;
  if (detail !== undefined && detail !== null) {
    const list = Array.isArray(secrets) ? secrets : [secrets];
    error.detail = clip(redact(detail, list));
  }
  return { ok: false, error, meta };
}

// ── chat：唯一的对话入口（★ 永不抛）─────────────────────────
/**
 * 发一次对话，取回文本。★ **永不抛**：任何失败都归一为 `{ok:false,error:{kind,...}}`。
 * @param {Array|string} messages `[{role,content}]`（或单个字符串，按 user 处理）
 *   ★ `content` 可为**字符串**（纯文本）或**内容块数组**（多模态，见文件头「多模态」）。
 * @param {object} [opts] 同 resolveConfig，另可含 `maxTokens`（可选，透传 `max_tokens`）与
 *   `temperature`（★ 2026-10-08 追加，**仅在显式给值时**透传；见 `buildRequest`）；
 *   ★ 多模态便利入参 `opts.images:[{path|base64|dataUrl, mediaType?}]`（按 kind 自动转格式并注入最后一条 user）。
 * @returns {Promise<{ok:true,text:string,raw:any,usage:any,meta:object}
 *                  | {ok:false,error:{kind,message,httpStatus?,detail?},meta:object}>}
 */
export async function chat(messages, opts = {}) {
  const meta = { at: new Date().toISOString() };
  try {
    const cfg = resolveConfig(opts);
    meta.profile = cfg.id;
    meta.kind = cfg.kind;
    meta.model = cfg.model;
    meta.baseUrl = cfg.baseUrl;

    if (!cfg.baseUrl) {
      return fail('config', `profile「${cfg.id}」缺少 baseUrl（请在面板填写，或设 LEMO_LLM_BASE）`, meta);
    }
    const msgs = normalizeMessages(messages);
    if (!msgs.length) return fail('config', 'messages 为空：至少需要一条 {role, content}', meta);

    // ★ 多模态：便利入参 `opts.images` → 图片内容块（按 kind 自动转 OpenAI / Anthropic 格式）
    if (opts.images !== undefined) {
      const inj = injectImages(msgs, opts.images, cfg.kind);
      if (!inj.ok) return fail(inj.error.kind, inj.error.message, meta);
    }
    // ★ 多模态：单图体积守卫 + 收集图片负载（供错误 detail 脱敏 —— 图片内容不外泄）
    const scan = scanImages(msgs);
    if (!scan.ok) return fail(scan.kind, scan.message, meta);

    const { url, headers, body } = buildRequest(cfg, msgs, { maxTokens: opts.maxTokens, temperature: opts.temperature });
    // ★ 多模态：总请求体体积守卫 —— ★ 防 `fetch` 因超大体崩掉（归一为 config，**不抛**）
    const bodyBytes = Buffer.byteLength(body, 'utf8');
    if (bodyBytes > MAX_BODY_BYTES) {
      return fail('config', `请求体过大（${bodyBytes} 字节 > 上限 ${MAX_BODY_BYTES} 字节）`, meta);
    }
    const secrets = [cfg.apiKey, ...scan.payloads];   // ★ 密钥 + 图片负载一并脱敏
    const r = await httpRequest(url, { method: 'POST', headers, body, timeoutMs: cfg.timeoutMs });
    meta.ms = r.ms;
    if (!r.net) {
      return fail(netErrorKind(r.error, r.timedOut),
        r.timedOut ? `请求超时（${cfg.timeoutMs}ms）：${cfg.baseUrl}` : `无法连接 ${cfg.baseUrl}`,
        meta, null, secrets);
    }
    meta.httpStatus = r.status;
    if (!r.resOk) {
      return fail(httpErrorKind(r.status), `HTTP ${r.status}`, meta, r.text, secrets);
    }

    let json;
    try {
      json = JSON.parse(r.text);
    } catch {
      return fail('bad-json', '响应不是合法 JSON', meta, r.text, secrets);
    }
    const ex = extractText(cfg, json);
    if (typeof ex.text !== 'string') return fail('bad-shape', `响应里取不到文本（路径 ${ex.path}）`, meta, r.text, secrets);
    if (!ex.text.trim()) return fail('empty-output', '模型返回了空文本', meta, r.text, secrets);

    return { ok: true, text: ex.text, raw: json, usage: (json && json.usage) || null, meta };
  } catch (e) {
    // ★ 兜底：连解析配置 / 构造请求都可能意外抛 ⇒ 这里收口，绝不让异常冒出去。
    return fail('unknown', `未预期异常：${(e && e.message) || e}`, meta);
  }
}

// ── validate：三步探针（★ 面板逐步显示）──────────────────────
/** 按 kind 给一句**可操作**的中文建议（契约 §四）。 */
function hintFor(kind, status) {
  switch (kind) {
    case 'unreachable': return '连不上服务：确认 Endpoint 是否正确、服务是否已启动、网络/防火墙是否放行。';
    case 'timeout': return '请求超时：确认服务是否响应；必要时把超时调大（LEMO_LLM_TIMEOUT_MS）。';
    case 'auth': return '鉴权失败：密钥无效或权限不足，请核对 Key（或换一个）。';
    case 'rate-limit': return '触发限流（429）：稍后重试，或换用别的 profile / 模型。';
    case 'http-error': return `服务返回 HTTP ${status ?? '错误'}：检查 Endpoint 路径、模型名是否正确，或看 detail。`;
    case 'bad-json': return '返回体不是 JSON：该地址可能不是 LLM 接口（或返回了 HTML 错误页）。';
    case 'bad-shape': return '返回体里找不到文本：换 kind=openai-compatible/anthropic，或在 custom 里配 extract 路径。';
    case 'empty-output': return '模型返回空文本：换模型或稍后重试。';
    case 'config': return '配置不完整：请在面板补齐 Endpoint / Key / 模型名。';
    default: return '未知错误：请查看 errors[].detail。';
  }
}

const step = (ok, kind = null, detail = null) => ({ ok, kind, detail });

/**
 * 连通性 + 鉴权 + 返回结构 三步校验（★ 任一步失败 ⇒ `ok:false` + 可操作 `hint`）。
 * @param {object} [opts] 同 resolveConfig（可传临时配置，不必先保存）
 * @returns {{ok:boolean, profile:string, steps:{reachable:object,auth:object,shape:object},
 *            errors:{step:string,kind:string,detail?:string}[],
 *            warnings:{step:string,kind:string,detail:string}[], hint:string, masked:object}}
 * ★ `warnings` 是**扩充**字段：装「不判失败但值得看」的提示（当前只有 `empty-output`）。
 */
export async function validate(opts = {}) {
  const cfg = resolveConfig(opts);
  const errors = [];
  const warnings = [];
  const steps = { reachable: step(false), auth: step(false), shape: step(false) };
  const out = (ok, hint) => ({ ok, profile: cfg.id, steps, errors, warnings, hint, masked: maskedConfig(cfg) });
  const pushErr = (s, kind, detail) => {
    errors.push({ step: s, kind, detail: detail == null ? undefined : clip(redact(detail, [cfg.apiKey])) });
  };

  // 0) 配置自检：baseUrl 必须有（★ 不得静默回退）
  if (!cfg.baseUrl) {
    steps.reachable = step(false, 'config', '未配置 baseUrl');
    pushErr('reachable', 'config', '未配置 baseUrl');
    // ★ 2026-10-08 追加：默认 profile `workbuddy` 的端点是**运行时中转**（见 PROFILES.workbuddy.note）
    //   ⇒ hint 与 model 的 hint 对称，**明说**它也能从运行时环境取（免得用户以为只能手填 / 以为默认坏了）。
    const rtHint = cfg.kind === 'anthropic' ? ' / ANTHROPIC_BASE_URL'
      : cfg.kind === 'openai-compatible' ? ' / OPENAI_BASE_URL' : '';
    return out(false, `profile「${cfg.id}」缺少 baseUrl：请在面板填写，或设 LEMO_LLM_BASE${rtHint}。`);
  }

  const probeMs = Math.min(cfg.timeoutMs, PROBE_TIMEOUT_CAP_MS);

  // 1) reachable：GET {baseUrl}(/v1)/models —— ★ 任何 HTTP 响应都算「可达」
  const reachUrl = cfg.kind === 'anthropic' ? `${cfg.baseUrl}/v1/models` : `${cfg.baseUrl}/models`;
  const rr = await httpRequest(reachUrl, { method: 'GET', headers: authHeaders(cfg), timeoutMs: probeMs });
  if (!rr.net) {
    const k = netErrorKind(rr.error, rr.timedOut);
    steps.reachable = step(false, k, rr.timedOut ? `超时 ${probeMs}ms` : '连接失败');
    pushErr('reachable', k, steps.reachable.detail);
    return out(false, hintFor(k));
  }
  steps.reachable = step(true, null, `HTTP ${rr.status}（可达）`);

  // 2) auth：发一次**极小**探针（先按契约 `max_tokens:1`，prompt 固定 'ping'）
  //   ★ 2026-10-08 修正③（见文件头）：**不再**「没配 Key 就先拦下」，改为**照常发探针**、让服务端自己判：
  //     本地推理接口（LM Studio / Ollama 等）**本来就不需要 Key** ⇒ 预先拦下会把可用端点挡在门外（假阴）；
  //     而真需要鉴权的端点会回 401/403 ⇒ 仍归一为 `auth`（契约 §四 的映射就是「401/403 ⇒ auth」）。
  //   ★ 缺 **model** 时**先**明确报「缺 model」（裁定 (b)：不硬写模型、也不静默用别的模型）。
  const needsModel = cfg.kind === 'anthropic' || cfg.kind === 'openai-compatible';
  if (needsModel && !cfg.model) {
    steps.auth = step(false, 'config', '未配置模型名');
    pushErr('auth', 'config', '未配置模型名');
    return out(false, `未配置模型名：请在面板填写 model，或设 LEMO_LLM_MODEL${cfg.kind === 'anthropic' ? ' / ANTHROPIC_MODEL' : ' / OPENAI_MODEL'}。`);
  }
  const { url, headers, body } = buildRequest(cfg, [{ role: 'user', content: 'ping' }], { maxTokens: 1 });
  const ar = await httpRequest(url, { method: 'POST', headers, body, timeoutMs: cfg.timeoutMs });
  if (!ar.net) {
    const k = netErrorKind(ar.error, ar.timedOut);
    steps.auth = step(false, k, ar.timedOut ? `超时 ${cfg.timeoutMs}ms` : '连接失败');
    pushErr('auth', k, steps.auth.detail);
    return out(false, hintFor(k));
  }
  if (!ar.resOk) {
    const k = httpErrorKind(ar.status);
    steps.auth = step(false, k, `HTTP ${ar.status}`);
    pushErr('auth', k, ar.text);
    // ★ 没配 Key 而服务端要求鉴权 ⇒ hint 说得更具体（契约 §六 的「明确报缺 Key」）。
    const keyHint = cfg.kind === 'anthropic' ? ' / ANTHROPIC_API_KEY'
      : cfg.kind === 'openai-compatible' ? ' / OPENAI_API_KEY' : '';
    const hint = (k === 'auth' && !cfg.apiKey)
      ? `未配置密钥：服务要求鉴权（HTTP ${ar.status}）。请填 Key，或设 LEMO_LLM_KEY${keyHint}。`
      : hintFor(k, ar.status);
    return out(false, hint);
  }
  steps.auth = step(true, null, cfg.apiKey ? `HTTP ${ar.status}（鉴权通过）` : `HTTP ${ar.status}（未配密钥，服务端未要求）`);

  // 3) shape：结构校验（★ 探针升级 + `empty-output` 降级 —— 见文件头「对契约的两处修正」）。
  //   `bad-shape`（路径解析不出字符串）⇒ **硬失败**；`empty-output`（解析出字符串但为空）⇒ **只作提示**。
  const judge = (t) => (typeof t !== 'string' ? 'bad-shape' : (t.trim() ? 'ok' : 'empty-output'));
  let rawText = ar.text;
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    steps.shape = step(false, 'bad-json', '响应不是合法 JSON');
    pushErr('shape', 'bad-json', rawText);
    return out(false, hintFor('bad-json'));
  }
  let ex = extractText(cfg, parsed);
  // ★ 探针升级：`max_tokens:1` 的**空文本**常是假象（模型只吐 1 个 token 就停）⇒ 再用 64 复验一次。
  if (judge(ex.text) === 'empty-output') {
    const b2 = buildRequest(cfg, [{ role: 'user', content: 'ping' }], { maxTokens: 64 });
    const r2 = await httpRequest(b2.url, { method: 'POST', headers: b2.headers, body: b2.body, timeoutMs: cfg.timeoutMs });
    if (r2.net && r2.resOk) {
      try {
        const j2 = JSON.parse(r2.text);
        const e2 = extractText(cfg, j2);
        if (typeof e2.text === 'string') { parsed = j2; ex = e2; rawText = r2.text; }
      } catch { /* 保持首次判定 */ }
    }
  }
  const verdict = judge(ex.text);
  if (verdict === 'bad-shape') {
    steps.shape = step(false, 'bad-shape', `路径 ${ex.path} 取不到文本`);
    pushErr('shape', 'bad-shape', rawText);
    return out(false, hintFor('bad-shape'));
  }
  if (verdict === 'empty-output') {
    // ★★ 修正契约 §四（有实测依据，见文件头）：**结构合法**（路径解析出了字符串），只是探针拿到空文本
    //   —— 这不是连通/鉴权/结构的问题，而是**模型行为**（推理型模型把 token 全用在思考上）。
    //   实测：本机已配置的真实端点对 `ping` 在 max_tokens=1/16/32 都返回 `content:[{text:''}]`、
    //   `stop_reason:'max_tokens'`，但同一个端点 `chat()` 能正常取到文本 ⇒ 判它「坏」是**假阴**。
    //   ⇒ 这里 `steps.shape.ok = true` 但带 `kind:'empty-output'`，并进 `warnings`（**不改 ok**）。
    steps.shape = step(true, 'empty-output', '结构合法，但探针返回空文本（max_tokens 1/64 两次都空）');
    warnings.push({
      step: 'shape', kind: 'empty-output',
      detail: '探针返回空文本：多为推理型模型把 token 都用在思考上 ⇒ 换模型，或用面板「试一句」/调大 max_tokens 复验。',
    });
    return out(true, '连通、鉴权、返回结构三项均正常（探针返回空文本，见 warnings）。');
  }
  steps.shape = step(true, null, '已取到文本');
  return out(true, '连通、鉴权、返回结构三项均正常。');
}

// ── listModels：列可用模型（★ 永不抛）───────────────────────
/**
 * 拉取服务端可用模型列表（OpenAI 兼容 `/models`，Anthropic `/v1/models`）。
 * @returns {Promise<{ok:true,models:string[],meta:object}|{ok:false,error:{kind,message,httpStatus?,detail?},meta?:object}>}
 */
export async function listModels(opts = {}) {
  try {
    const cfg = resolveConfig(opts);
    const meta = { profile: cfg.id, kind: cfg.kind, baseUrl: cfg.baseUrl };
    if (!cfg.baseUrl) return { ok: false, error: { kind: 'config', message: '缺少 baseUrl' }, meta };
    const url = cfg.kind === 'anthropic' ? `${cfg.baseUrl}/v1/models` : `${cfg.baseUrl}/models`;
    const r = await httpRequest(url, { method: 'GET', headers: authHeaders(cfg), timeoutMs: cfg.timeoutMs });
    if (!r.net) {
      return {
        ok: false,
        error: {
          kind: netErrorKind(r.error, r.timedOut),
          message: r.timedOut ? `请求超时（${cfg.timeoutMs}ms）` : `无法连接 ${cfg.baseUrl}`,
        },
        meta,
      };
    }
    if (!r.resOk) {
      return {
        ok: false,
        error: { kind: httpErrorKind(r.status), message: `HTTP ${r.status}`, httpStatus: r.status, detail: clip(redact(r.text, [cfg.apiKey])) },
        meta,
      };
    }
    let json;
    try {
      json = JSON.parse(r.text);
    } catch {
      return { ok: false, error: { kind: 'bad-json', message: '响应不是合法 JSON', detail: clip(redact(r.text, [cfg.apiKey])) }, meta };
    }
    const arr = Array.isArray(json) ? json
      : Array.isArray(json?.data) ? json.data
        : Array.isArray(json?.models) ? json.models : null;
    if (!arr) return { ok: false, error: { kind: 'bad-shape', message: '响应里没有模型列表（期望 data[] / models[]）' }, meta };
    const models = arr
      .map((m) => (typeof m === 'string' ? m : (m && (m.id ?? m.name ?? m.model ?? m.modelKey))))
      .filter(Boolean).map(String);
    return { ok: true, models, meta };
  } catch (e) {
    return { ok: false, error: { kind: 'unknown', message: `未预期异常：${(e && e.message) || e}` } };
  }
}
