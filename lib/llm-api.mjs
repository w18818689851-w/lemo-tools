// lib/llm-api.mjs —— **通用 AI 算力 API 接入模块**（不限厂商 / 部署 / 智能体 / **算力类型**）
//
// ★ 为什么需要它：本项目里 AI 算力的调用点散落在各处，各自硬编码「用哪个服务、什么路径、怎么取结果」，
//   于是「换一个模型 / 换一个服务商 / 换成本地私有化部署」都要改代码。本模块把这件事收成**一处**：
//   只要一个接口**通信正常、鉴权有效、能收发请求并返回合法结果**，就能接进来 ——
//   云端 API、本地私有化部署、本地推理接口、第三方中转**一视同仁**。
//
// ★ 两种接入形式（都覆盖）：
//   ① 智能体自身的服务 API（如 WorkBuddy 的服务端点）—— profile `workbuddy`；
//   ② 智能体底层搭载的**原生大模型 API**（Anthropic / OpenAI 兼容 / 厂商私有）—— 其余 profile。
//   ★★ 2026-10-09 订正（委托方指令）：上句里的「其余 profile」**已全部删除**（见下方「只接 WorkBuddy」段）
//      —— `PROFILES` 现在只剩 `workbuddy` 一个。
//
// ★★ **2026-10-09 委托方指令：本模块「智能体」接入**只接 WorkBuddy，其他 provider 一律彻底删除**
//    （委托方已在确认弹窗里选定「**彻底删除其他 11 个 provider**」）：
//    · **已删**（从 `PROFILES` 表移除，共 **11** 个内置 profile）：`anthropic`（原生 Anthropic）、
//      `openai-compatible`（OpenAI 兼容）、`doubao` / `qwen` / `hunyuan` / `deepseek` / `zhipu` /
//      `kimi` / `siliconflow`（7 家国产厂商预设）、`lmstudio`（本地推理）、`custom`（厂商私有接口出口）。
//      ⇒ `PROFILES` 现在**只剩 `workbuddy` 一个**（`listProfiles()` 只回 1 条），`DEFAULT_PROFILE` 仍是 `workbuddy`。
//    · **保留** `workbuddy`（`kind:'workbuddy-gateway'` / `target:'agent'`）与**全部四种适配器**
//      （`anthropic` / `openai-compatible` / `custom` / `workbuddy-gateway`）—— ★ 理由：适配器是**共享基础设施**，
//      **不是**「只为被删 profile 存在」：`lib/triple-check.mjs` 仍以 `kind:'openai-compatible'` 调 `chat()`
//      （画面/字幕/语义一致性校验的 VLM 调用），`invoke()` 的 image / audio / embedding / custom 四个 task
//      也仍要用它们 ⇒ 删适配器会**打断活调用点**（本次**只删 profile 条目**）。
//    · **不改**配置解析优先级（显式 → `LEMO_LLM_*` → 覆盖文件 → 运行时线索 → 内置默认）、**不改**导出名、
//      **不改** `LEMO_LLM_*` 覆盖点（仍恰 6 个，闸门判据⑤ 守着）。
//    · ★ **回退**：本文件在 2026-10-09 的提交里仍是 12 个 profile ⇒ 从 **git 历史**取回被删的 11 个条目
//      （`git log -- lib/llm-api.mjs` 找该提交，`git show <sha>:lib/llm-api.mjs` 取回那段 profile 表）即可。
//    ★★ 2026-10-10 订正（**保留上面原句**）：委托方**已推翻**「只接 WorkBuddy」⇒ 「再添加」**已落地**，
//      但**不是**加回内置 profile 条目，而是**新增「多套算力服务」层**（覆盖文件 + 六个新导出）——
//      见文件头「2026-10-10 追加（委托方新规格）」段。⇒ `PROFILES` 内置表**仍只剩 `workbuddy`**。
//
// ★★ **通用算力入口 `invoke()`** —— **2026-10-09 追加**（见契约 §十三）。★ 规格 v3 把本模块从
//   「LLM 专用」**泛化**为「通用 AI 算力 API 接入模块」：**算力类型不限**（LLM 文本推理 / 图像生成 /
//   语音 / 向量计算 …）。原模块对外**只有 `chat()`**（把「AI 算力」窄化成了「LLM 对话」）⇒ 新增
//   `invoke(task, params, opts)` 按 `task` 分发到不同算力形态；★ 文本推理 `task:'chat'` **委托给既有 `chat()`**
//   （那是文本推理的完整实现）—— `invoke` 只把它归一成通用返回形状。⇒ `chat()` 的既有结构 / 行为**逐字节不变**
//   （向后兼容硬指标，有单测金标钉住）。
//   · `task` 取值（本模块定义，见 `TASKS` 表）：`'chat'`（文本推理）/ `'image'`（图像生成）/
//     `'audio'`（语音合成）/ `'embedding'`（向量计算）/ `'custom'`（**通用出口**：自配 path+headers+extract）。
//   · 归一返回：成功 `{ok:true, task, result, raw, meta}`；失败 `{ok:false, task, error:{kind,message,…}, meta}`。
//     `result` 形状按 task 固定：chat→`{text}` / image→`{images:[…]}` / audio→`{audio,mime?}` /
//     embedding→`{vectors:[…]}` / custom→`{value}`。★ `invoke()` 与 `chat()` 同一条纪律：**永不抛**。
//   · ★★ **不确定的厂商形态一律走 `task:'custom'`**（自配 `path` + `headers` + `extract`）——
//     **不硬编造**各家私有格式（写错比没有更糟）。内置的各家形状只覆盖**公开且常见**的形态。
//   · ★ 每类算力「请求怎么拼 / 结果怎么取 / 怎么判合法性」= `TASKS` 表的 `build` / `extract` / 其内校验。
//
// ★★ **不探查、不读取智能体内部模型** —— **2026-10-09 追加（v3 硬约束，见契约 §十四）**：
//   · 接入**基础 AI 算力 API**（`target:'model'`）⇒ 模块**主动指定服务标识**（`model`），请求体**必带 `model`**，
//     准入**校验服务标识**（缺 ⇒ `config` 失败）；
//   · 接入**智能体 API**（`target:'agent'`）⇒ 模块**只负责建立通信链路**，**完全不去感知 / 查询 / 管控**
//     智能体内部实际调用的底层模型与算力。⇒ `agent` 模式下 **`cfg.model` 只可能来自「用户自己填的本地备注」**
//     （显式传参 / `LEMO_LLM_MODEL` / 覆盖文件（面板）），**绝不**从运行时线索（`ANTHROPIC_MODEL` / `OPENAI_MODEL`）
//     解析 —— 那正是「读取智能体内部正在使用的模型信息」，v3 明令禁止。
//   · ★★ **不向智能体下发任何 `model`**（**2026-10-09 委托方澄清**，见契约 §十五）：`target:'agent'` 时
//     请求体**绝不出现 `model`**（**不看 `kind`**，三种适配器一律如此）；准入探针也**不带 model 探活**。
//     ★ 若端点因「不带 model」而回 400/422「要求 model」⇒ **如实报错**（归一为 `config` + 中文 hint：
//       说明该端点更像**底层基础算力 API**，不是智能体 API），★ **绝不**把 model 偷偷加回去。
//   · ★★ **不发起任何「模型相关请求」**（**2026-10-09 委托方明令**，见契约 §十五）：`agent` 模式
//     **不调用 `/v1/models`**（或任何列举 / 查询模型的接口）⇒ `listModels()` 直接拒绝；
//     `validate()` 的可达性探针**跳过** `GET /v1/models`，连通性改由 **POST 探针**判定
//     ★（**不放宽**：POST 网络失败 ⇒ 仍归 `reachable` 红）。
//
// ★★ 接入对象类型（`target`）—— **2026-10-08 追加**（见契约 §十二）。本模块**第一次**把「接的是**什么**」
//   显式化 —— 这直接决定「要不要下发 `model`」「要不要校验 `model`」：
//   · `'model'`（★ **默认值**，未标注时按此 —— 保**向后兼容**：既有 profile 除智能体类外都是模型 API）：
//     **底层基础大模型 API** —— 模块作为调用方**主动指定模型标识**，直接向基础模型发起推理请求。
//     请求体**正常携带 `model`**；准入**校验模型标识**（缺失 ⇒ `config` 失败）。
//   · `'agent'`：**智能体 API**（WorkBuddy / Codex / ChatGPT / Claude Code / 豆包工作智能体 …）——
//     智能体是构建在基础大模型之上**封装好的服务**，**自带任务规划 / 工具调用 / 内部模型调度**。
//     本模块**仅打通智能体对外暴露的 API 接口**，**不感知、不指定、不干预**智能体内部在调度的底层基础模型。
//     面板填的模型名**仅作本地备注标记**；请求体**绝不下发 `model`**（防参数覆盖干扰智能体内部调度）；
//     准入**不校验智能体内部底层模型信息**，只校验**连通 / 鉴权 / 返回文本合法性**。
//   ★★ **2026-10-09 修正（委托方澄清，见契约 §十五）：取消「`agent + anthropic` 例外」。**
//     委托方明确定义：「模块**不向智能体下发任何 model 模型参数**，避免多余参数引发 HTTP 400」；
//     「只要智能体本身处于正常运行状态，模块只需保障连通」。
//     ⇒ 原先那条「不带 model ⇒ 400 ⇒ 仍带 model」的处置**被推翻**：那个 400 恰恰说明**该端点要求 model**
//       ⇒ 它的**性质是「模型 API」**，**不是智能体 API** ⇒ 正确处置是**如实报错**（`config` + 中文 hint，
//       见 `agentModelHint`），**而不是**偷偷把 model 带上去（那就等于违反定义）。
//   ★ `target` 的覆盖：与其它字段**同优先级**（显式 → 覆盖文件（面板） → 内置默认）；
//     ★ **刻意不新增** `LEMO_LLM_TARGET` 覆盖点 —— 契约 §二 仍恰 6 个（有闸门判据⑤ 守着）。
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
//   · `workbuddy-gateway`：★★ **2026-10-09 追加**（见契约 §十六）—— **本机智能体网关**的适配器。
//     两段式：① `POST {baseUrl}/api/v1/runs`（体 `{id,type:'message',text,sender:{id,name}}`，**无 model**）
//     → `202 {data:{runId}}`；② `GET {baseUrl}/api/v1/runs/{runId}/stream`（SSE）取文本。
//     ★ 端点/口令**运行时发现**（`SERVER__HOST`/`SERVER__PORT`/`CODEBUDDY_GATEWAY_PASSWORD`），**绝不硬编码端口**；
//     ★ 整段有界（`cfg.timeoutMs`），超时 ⇒ `timeout` 且**不抛**；★ `validate()` 只用**只读** `/api/v1/health` 探活。
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
//   ★★ 2026-10-10 订正（**保留上句**）：③ 的「用户覆盖文件」现在**含「当前生效的算力服务」**
//     （多套服务摊平成单份覆盖后参与解析，见文件头「2026-10-10 追加」段）——★ **顺序本身一字未改**
//     （闸门判据⑦ 守着），只是 ③ 的内容多了一层「服务」维度。
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
//   ★★ 2026-10-10 订正（**保留上句**）：该文件现在承载**多套算力服务** ——
//     `{ version, active, services:[…] }`（见文件头「2026-10-10 追加」段）；★ 老的单份覆盖
//     （上面那种平铺写法）**仍可读**（自动迁移为「一套服务」）⇒ 向后兼容。
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
//   ⑦ ★★ 2026-10-08 追加（**本批**，规格驱动 + 实测驱动）：新增**接入对象类型** `target`（`'model'` | `'agent'`）
//      —— 见上方「接入对象类型」段与契约 §十二。**核心后果**：`workbuddy` 标为 `agent` ⇒
//      `validate()` **不再校验模型标识**、`chat()` **不下发 model**。
//      ★★ 2026-10-09 更正（委托方澄清，见契约 §十五）：原 ⑦ 写的「`workbuddy` 的 `kind` 是 `anthropic`
//        ⇒ **仍带** model」**已取消** —— `agent` 模式**一律不下发 model**（不看 kind）；端点若因此 400/422
//        「要求 model」⇒ **如实报错**（`config` + 中文 hint），**不**偷偷带 model。
//      ★ **不改**解析优先级（判据⑦ 守着）、**不改**导出名、**不加** `LEMO_LLM_*` 覆盖点（仍恰 6 个，判据⑤ 守着）。
//   ⑧ ★★ 2026-10-09 追加（**本批**，委托方明令，见契约 §十五）：`validate()` 的可达性探针在 `agent` 模式下
//      **不再发 `GET /v1/models`**（那是「列举模型」= 模型相关请求）；连通性改由 **POST 探针**判定
//      ★ **判据不放宽**（POST 网络失败 ⇒ `reachable` 红）。★ `target:'model'` 的第 1 步 GET **照旧**。
//   ⑨ ★★ 2026-10-09 追加（**本批**，规格 §8「默认调用 WorkBuddy 智能体 API」真正落地，见契约 §十六）：
//      `workbuddy` 的 `kind` 由 `anthropic` 改为 **`workbuddy-gateway`**（本机智能体网关适配器）——
//      网关**没有** `/v1/messages`（全量路由已核对），且是「`POST /api/v1/runs` → `GET …/{runId}/stream`(SSE)」
//      **两段式**（`custom` 的单次 POST + 取路径表达不了）⇒ 单列一个 kind。
//      · baseUrl **运行时发现**（`SERVER__HOST` / `SERVER__PORT`；**绝不硬编码端口**）；
//        口令只从 `CODEBUDDY_GATEWAY_PASSWORD` 取（**绝不**落盘 / 进日志）。
//      · `validate()` 在网关 kind 下改用**只读** `GET /api/v1/health` 探活（★ **绝不**用 `POST /api/v1/runs`
//        探活 —— 那会真发起 Agent 执行、且落到用户当前会话）。
//      · ★ **不改**解析优先级（判据⑦ 守着）、**不改**导出名、**不加** `LEMO_LLM_*` 覆盖点（仍恰 6 个，判据⑤ 守着）。
//      ★ 回退方式：把 `workbuddy.kind` 改回 `'anthropic'` 并删掉 `chat()` / `validate()` 里的
//        `workbuddy-gateway` 分支即可（三处，彼此独立）。
//   ★ 这几处都写成**独立、可一行回退**的形式：把 64 改回 1、把 `empty-output` 分支改回
//     `step(false, …) + pushErr + return out(false, …)`、把缺 Key 的预拦加回、把 `rtModel` 去掉、
//     把 `temperature` 那一行删掉、把 `shouldSendModel` 改成恒 `true` 且 `needsModel` 改回原式、
//     把 `validate()` 的 `if (!isAgent) { …GET… }` 外壳去掉即可。

// ★★ **2026-10-10 追加（委托方新规格《通用 AI 算力 API 接入模块》）—— 这是「方向变更」，务必读完再读代码**：
//   委托方**推翻了 2026-10-09 的「只接 WorkBuddy，其他 provider 一律删除」指令**，改为要求本模块
//   **开放式、可插拔、不锁定**算力服务商 / 算力类型 / 部署方式：云端在线 API · 本地私有化部署 API ·
//   本地推理接口 · 第三方中转 API **均可**接入；**原生兼容国产各类开源 / 闭源 AI 算力服务**；
//   **同时支持 OpenAI 兼容格式与各厂商私有接口格式**；★ **准入不对品牌 / 版本做任何限制**，
//   唯一判准 = **接口通信正常、鉴权有效、能接收入参并返回合法结果**。
//   ★ 委托方原话：上一轮删掉的 provider「**后期需要用再添加**」⇒ **本期（2026-10-10）就是「再添加」**，
//     而且要求**更高**（开放式 + **多套保存 / 快速切换** + **容错 / 重试 / 降级**）。
//   ★ 好消息：上一轮**只删了内置 profile 条目**，**四种适配器（`anthropic` / `openai-compatible` /
//     `custom` / `workbuddy-gateway`）与全部底层能力都还在** ⇒ 本期**不重写适配器**，只加「多套服务」这层。
//
//   ★★ 本期（**Phase 1：只做后端能力与契约**；界面 / 面板归 Phase 3 —— 本文件**不碰** `web/`、
//     `server.mjs`、`test/`）交付四件事：
//     ① **多套「算力服务」的存储与 CRUD**（规格 §5 核心）：覆盖文件 `<成片根>/_llm-api.json` 由
//        「单份覆盖」升级为 `{ version, active:'<服务 id>', services:[ {id,label,kind,target,baseUrl,
//        model,headers,timeoutMs,path?,extract?} ] }`。★ 新增导出：`listServices`（脱敏列表）/
//        `getActiveService` / `setActiveService(id)`（★ 切换**全局实时生效**）/ `saveService(svc)` /
//        `deleteService(id)` / `serviceById(id)`。★ **不锁定任何服务**：允许 `services` 为空。
//        ★ `workbuddy`（本项目自己的智能体网关）**保留**，作为**其中一套出厂默认**，★ **可删 / 可改**（不锁死）。
//        ★★ **向后兼容**：老的单份覆盖（`{baseUrl,apiKey,model,…}`）读进来**自动迁移**为「一套服务」
//        （见 `normalizeOverride`）—— 既有单测（写旧格式、读回旧字段）**逐条仍过**（有实测，见报告）。
//     ② **「服务标识」参数**（规格 §1/§4）：`chat()` / `invoke()` / `validate()` / `listModels()` 可传
//        `opts.service='<服务 id>'` 按该服务调用。★ **解析优先级一字未动**（显式传参 → `LEMO_LLM_*` →
//        覆盖文件（**含「当前生效的服务」**）→ 运行时线索 → 内置默认）—— 那是本仓已验证的契约（闸门判据⑦ 守着）。
//     ③ **异常容错 / 自动重试 / 降级**（规格 §5）：★ **只对幂等且可重试**的错误重试
//        （网络错 / 超时 / 429 / 5xx）；★ **绝不重试** 4xx 鉴权 / 参数错（**不许把鉴权失败重试成「超时」**）；
//        ★★ **总耗时受 `cfg.timeoutMs` 约束**（重试**不把超时放大成 N 倍** —— 见 `httpRequestRetry` 的预算算法）；
//        ★ **降级** = `chat()` **永不抛**（本仓既有契约，**本期只加强、不放松**）+ 结构化 `{ok:false,error}`。
//        ★★ **重试「默认不叠加」**（`DEFAULT_RETRY = 0`）：本仓既有约定是**调用方持有重试**
//        （`lib/triple-check.mjs` 自带 1 次）⇒ 模块**默认**再重试会**请求放大**（实测 2 → 6 次）并打红
//        **本任务不许改**的 `test/triple-check-flow.test.mjs` ⑤/⑪（它们钉住「恰好 2 次 chat」）。
//        ⇒ 重试**内建且完全可配**（`opts.retry` / `opts.retryBackoffMs` / **服务对象字段**（落盘、面板可写）），
//        默认值 = **不叠加**；需要时一处开关即开启（Phase 3 面板可给「重试次数」输入框）。详见 `DEFAULT_RETRY` 处注释。
//     ④ **准入校验**（规格 §4）：`validate()` 的 `reachable` / `auth` / `shape` **三步语义不变**，
//        按新模型适配（服务标识存在性 + 配置完整性 + 网络连通 + 鉴权 + 返回格式合法性）。
//   ★★ **不加**任何 `LEMO_LLM_*` 覆盖点（仍**恰 6 个**，闸门判据⑤ 守着）⇒ 重试次数 / 退避**改由**
//     `opts.retry` / `opts.retryBackoffMs`（显式）与**服务对象字段**（落盘在覆盖文件里，面板 Phase 3 可写）配置。
//   ★ 与上面「只接 WorkBuddy」段的**关系**：那段是**历史**（保留原句，勿抹）；本段是**当前**口径。
//     两者不冲突的**机制保证**：`PROFILES` 内置表**仍只剩 `workbuddy`**（闸门判据③ / 单测钉住），
//     「多套服务」走的是**覆盖文件**（用户自建），**不是**内置表 ⇒ 「不锁定」与「内置表只剩 workbuddy」并存。
//
//   ★★ **2026-10-10 二次订正（用户可见文案与「开放式」面板对齐 —— 本批只改文案）**：
//     委托方实测：面板（`web/index.html` 的 `<option value="…">`）**真的提供** `openai-compatible` /
//     `anthropic` / `custom` / `workbuddy-gateway` **四个 kind 入口**，但本模块**用户可见串**（经
//     `hint` / `error.message` / `message` / `warnings[].detail` 外露）里仍写着「**本软件只接 WorkBuddy**」
//     ⇒ 与面板**直接矛盾**。已逐处改为**成立**的说法（「**所选的算力服务**」/「**当前生效的算力服务**」）：
//       · `hintFor()`（`validate().hint`，面板「测试连接」下方原样显示）：`unreachable` / `rate-limit` /
//         `http-error` / `bad-shape` / `empty-output` / `config` 六条；
//       · `invoke()` / `chat()` 的 config 错（缺 `baseUrl` / 缺 `model`），`validate()` 的（缺 `baseUrl` /
//         缺 `model` / 缺 `key` / `empty-output` warning）；
//       · `TASKS` 的 `image` / `audio` / `embedding` 三条 `message` 末尾原有「★ 2026-10-10 订正：本软件只接
//         WorkBuddy，面板已无 openai-compatible / custom 入口」**与面板矛盾** ⇒ **删该句**；其首句（anthropic
//         无该接口 ⇒ 改用 openai-compatible / custom）在新方向下**本来就对**，**保留**。
//     ★ 另有几处**注释**（**原句保留，不抹**）里的「面板无…输入框」也随面板重建而失效 —— 面板**已有**
//       `llmBaseUrl` / `llmKey` / `llmModel` 等输入框：即 `invoke()` / `chat()` 的「缺 baseUrl / 缺 model」
//       订正注释、`validate()` 的「缺 baseUrl」「缺 model」订正注释、以及「未配置密钥」处的订正注释。
//     ★ 本批**只改文案**：判据 / 分支 / 阈值 / 白名单 / 错误 kind **一律未动**。
//
// ★★ **2026-10-10 追加（P1：容错与协议正确性 —— 对照《通用 AI 算力 API 接入模块》参考实现 5 项）**：
//   委托方给了**建设标准**（参考件在 `D:/workbuddyAI/huancun999/zhuchirenshipin/`，★ **只读、一个字节都不许改**），
//   本期只做「**满足标准即可、超出不配置、核心能力不可删减**」的 **5** 项（其余留后续期）：
//     ① **跨服务降级**（标准 §8 `chat_with_fallback`）：`chatWithFallback(messages, opts)` —— 主服务失败
//        ⇒ 按 `opts.fallbacks`（**算力服务 id 列表**）**依次降级**；★ **永不抛**（与 `chat()` 同纪律），
//        返回的 `meta.tried` **如实列出试过哪几套、各自的错**。★ `chat()` 亦接受 `opts.fallbacks`
//        （非空时**委托**给它）—— ★ **不传则 `chat()` 行为逐字不变**。
//     ② **「只接受流式」/「首条必须 system」两个服务端硬约束**（标准 §11.5）：新增两个**服务配置字段**
//        `forceStream` / `ensureSystemPrompt`（★ 亦接受标准里的 snake_case 别名 `force_stream` /
//        `ensure_system_prompt`）——落盘 / 脱敏回显 / 可被 `opts` 覆盖；★ **默认关** ⇒ 现有调用逐字不变。
//        · `forceStream:true` ⇒ `chat()` **改由流式（SSE）聚合**（★ 仅 `openai-compatible` 有**真 SSE**）；
//        · `ensureSystemPrompt:true` ⇒ 首条非 `system` 时**自动补一条**默认 system；
//        · ★★ **兜底**：非流式被服务端以 `400 + code=11101` 拒绝 ⇒ **自动改走流式重试一次**（对用户透明）。
//        ★ **判定「被拒」同时覆盖两条路径**（标准 §11.5 明写的坑）：① 抛出的错（`httpStatus`/`rawSnippet`）
//          ② 拿到 `status==400` 后按 body 文本判定 —— 本模块 `httpRequest` 对非 2xx **不抛**（走 ②），
//          ① 为**防御式**覆盖（未来传输层若改成抛，也不漏判）。★ **只写 try/catch 会漏判**（参考方实测踩过）。
//     ③ **`stream()` 导出**（标准 §8）：`stream(messages, opts)` —— **异步生成器**，逐块产出
//        `{ok:true, delta, done, raw, meta}`；失败**不抛**而是产出**终止块** `{ok:false, error, meta}`
//        （★ 与 `chat()` 的「永不抛」**一致**——理由见该函数头注释）。★ 仅 `openai-compatible` 支持真 SSE；
//        其它 kind ⇒ **优雅报**「该适配器不支持流式」（★ 不硬加 —— `anthropic` 无真 SSE）。
//     ④ **URL 拼接去重版本段**（标准 §11.8）：新增 `joinUrl(base, path)` —— base 尾段与 path 首段**同名**
//        （典型 `/v1`）时**剥掉 path 首段**，避免 `/v1/v1/…`（任何真实 API 都不可能正确）；
//        ★ base 已含完整 path 时**不再重复拼接**。
//     ⑤ **§11.1 空值保护**（「留空 = 不修改」三处语义一致）：`saveService()` 里 `apiKey` 传**空串** ⇒
//        **沿用已有 Key**；`headers` 传**空 dict** ⇒ **沿用已有**；其余可选字段同「留空 ⇒ 不修改」。
//        ★ **显式清空**仍可达：`clearKey:true` / `clearHeaders:true`（面板「清除密钥」按钮即走 `clearKey`）。
//   ★★ 纪律：`chat()` **永不抛**不许破；`DEFAULT_RETRY` **不许动**；新开关**默认关**（默认行为逐字不变）；
//      注释**只追加日期订正、不抹原句**；参考件**只读**。

import fs from 'node:fs';
import path from 'node:path';

// ★ 成片根的**唯一**口径在 lib/env.mjs 的 `CFG.exportDir`（它认覆盖点 `LEMO_FILM_DIR`）。
//   本模块**不再自己算一份** —— 与 lib/store.mjs 的 `.console` 同一条纪律（见该文件里「本模块**不再自己算一份**」那句注释）。
//   import 方向：llm-api → { env, store } → env → styles-root，**无环**（store 不反向 import llm-api）。
import { CFG } from './env.mjs';
// ★★ 2026-10-10 追加（RISK-05 修）：覆盖文件的写**复用** lib/store.mjs 的既有跨进程写锁工具
//   （`acquireLock` / `releaseLock`），本模块**不另造一份锁实现**（本项目纪律：先在同仓找同类做法、照抄正确的那个）。
//   ★ 同一成片根 ⇒ 同一个锁文件（`<成片根>/.console/index.lock`）⇒ 与「任务索引」的写**共用同一把锁**：
//     比所需更粗，但只会**多**串行化、不会漏串行化（安全方向）。
import { acquireLock, releaseLock } from './store.mjs';

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

// ── 多套「算力服务」+ 重试（★ 2026-10-10 追加）────────────────
/** 覆盖文件的**存储模型版本**（`{version, active, services[]}`；见文件头 2026-10-10 段）。 */
const OVERRIDE_VERSION = 1;
/** 新建服务时若未指定适配器 `kind` 的**默认值**（最通用的一种：OpenAI 兼容协议）。 */
const DEFAULT_SERVICE_KIND = 'openai-compatible';
/** 本模块支持的**适配器 kind**（与 `PROFILES` 内置表 / 闸门 `ADAPTER_KINDS` 同集合）。 */
const SERVICE_KINDS = Object.freeze(['anthropic', 'openai-compatible', 'custom', 'workbuddy-gateway']);
// ★★ 2026-10-10 追加（标准 §4）：算力服务「能力类型」的**合法值**。
//   ★★ 硬要求（标准 §11.11 的**实测教训**）：非法值**显式拒绝**（见 `saveService`），**绝不静默回落**
//     成 `llm` —— 参考方实测：前端写 `embed` ⇒ 被归一成 `llm` ⇒ 用户选了「向量计算」却**静默变文本推理**。
//   ★ 合法值 = `llm` / `image` / `speech` / `embedding`（★ 注意是 **embedding**，不是 `embed`）。
const SERVICE_CAPABILITIES = Object.freeze(['llm', 'image', 'speech', 'embedding']);
/** 出厂默认服务的 id（= 内置表里唯一那套；★ **可删可改**，不锁死）。 */
const DEFAULT_SERVICE_ID = DEFAULT_PROFILE;
/** 自动重试：默认**额外**重试次数（总尝试 = 1 + 该值）；★ **默认 0 = 不重试**（见下方注释）。 */
const DEFAULT_RETRY = 0;
/** 自动重试：默认退避基数（毫秒，指数退避 `base * 2^(n-1)`）。 */
const DEFAULT_RETRY_BACKOFF_MS = 200;
const MAX_RETRY = 5;
const MAX_RETRY_BACKOFF_MS = 10000;
// ★★ 2026-10-10 追加（标准 §11.5）：`ensureSystemPrompt` 为真且首条非 `system` 时补的**默认 system 提示**
//   （取自参考实现的兜底文案 `openai_compat.py` 的 `DEFAULT_SYSTEM_PROMPT`，逐字同句）。
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant. Be concise and helpful.';
/** **可重试**的 HTTP 状态码（幂等 / 瞬态）：408 超时、425 过早、429 限流、5xx 服务端错。★ 其余 4xx **不重试**。 */
const RETRYABLE_STATUS = Object.freeze([408, 425, 429, 500, 502, 503, 504]);
// ★★ 2026-10-10 订正（**实测驱动**）：`DEFAULT_RETRY` **刻意取 0（默认不叠加重试）**，理由三条：
//   ① **本仓既有约定是「调用方持有重试」**：`lib/triple-check.mjs` 自己就写了「带 1 次重试的调用：
//      冷启动 / 偶发 5xx 时兜一下」⇒ 模块若**默认**也重试，就变成**两层重试叠加**；
//   ② **实测放大**：`test/triple-check-flow.test.mjs` 的用例⑤（桩恒 500）**钉住「恰好 2 次 chat 请求
//      （1 次 + 调用方 1 次重试）」** —— 模块默认 `retry:2` 会让该桩收到 **6** 次（1×3×2）⇒ 直接打红
//      那个**本任务不许改**的测试文件，且是**真实的请求放大**（对非幂等 POST 尤其不该）；
//   ③ 规格要的是「**自带**容错 / 重试 / 降级**机制**」，不是「默认就对所有 POST 重发」⇒ 本模块把重试
//      做成**内建且完全可配**（`opts.retry` / `opts.retryBackoffMs`，以及**服务对象字段**（落盘、面板可写）），
//      默认值 = **不叠加**，需要时**一处开关**即可开启（含 Phase 3 面板的「重试次数」输入框）。
//   ★ 若将来要改成「默认开启」，把本常量改成 2 即可 —— 但**必须同时**改 `test/triple-check-flow.test.mjs`
//     的用例⑤ / ⑪（它们钉住「恰好 2 次 chat」）⇒ 那是**跨模块契约变更**，不在本期范围（已报 team-lead）。

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
//   ★★ 2026-10-09 订正（委托方指令「**只接 WorkBuddy，其他 provider 一律彻底删除**」）：
//     上面这批国产预设**连同** `anthropic` / `openai-compatible` / `lmstudio` / `custom`，共 **11 个内置
//     profile 已从下表删除** ⇒ `PROFILES` 现在**只剩 `workbuddy` 一个**。详见文件头「只接 WorkBuddy」段
//     与下表末尾的删除说明（含**回退**办法）。
export const PROFILES = Object.freeze({
  workbuddy: {
    // ★★ 2026-10-09 修正（本批，**实测/读码驱动**，见契约 §十六）：`kind` 从 `anthropic` 改为
    //   **本机智能体网关适配器** `workbuddy-gateway`。依据：
    //     · 本机网关（CodeBuddy Gateway，`gatewayMode:"local"`）**没有** `/v1/messages`（全量路由已核对）
    //       ⇒ 原 `anthropic` 适配器**打不通**（这正是「agent 模式准入失败」的根因）；
    //     · 它是**两段式**协议：`POST {base}/api/v1/runs` → `202 {data:{runId}}`，再
    //       `GET {base}/api/v1/runs/{runId}/stream`（SSE）取结果 —— `custom` 的「一次 POST + 取路径」
    //       表达不了第二段 ⇒ 单列一个适配器 kind。
    id: 'workbuddy', label: 'WorkBuddy（默认）', kind: 'workbuddy-gateway',
    // ★★ target:'agent' —— 2026-10-08 追加：WorkBuddy 是**智能体**（规格原文点名：「WorkBuddy、Codex、ChatGPT、
    //   Claude Code、豆包工作智能体都属于独立智能体」）⇒ 模块**不指定、不校验**它内部调度的底层模型；
    //   面板里的 model **仅作本地备注**。★ 依据**端点性质**判：它是**智能体对外暴露的服务端点**，不是
    //   「直接对接基础模型本体」的模型 API。
    //   ★★ 2026-10-09 更正：agent 模式**一律不下发 model**（**不看 kind**，见契约 §十五）——
    //     网关适配器同样如此（`shouldSendModel` 恒 false）。
    target: 'agent',
    // ★★ baseUrl **故意留空**（不给默认）：网关地址随**运行时**变化（端口来自宿主的 `SERVER__PORT`），
    //   本模块**不猜、不硬编码端口**。这样「未配置完整 ⇒ validate() 明确报『缺 baseUrl』」才**可达**
    //   （契约 §六 的硬要求），也**绝不静默回退**到别的 profile。
    //   ★ 实际取值顺序：显式 → LEMO_LLM_BASE → 覆盖文件（面板） → 运行时线索（网关 env） → 这里（空）。
    baseUrl: '',
    // ★★ model 也**故意留空**：agent 模式**不向智能体下发 model**（v3 硬约束，见契约 §十四/§十五），
    //   面板填的模型名**仅作本地备注** ⇒ 模块**不从运行时线索解析**它（`ANTHROPIC_MODEL` 不再被读）。
    //   ⇒ 取值顺序：显式 → LEMO_LLM_MODEL → 覆盖文件（面板） → 这里（空）。
    model: '', headers: {}, isDefault: true,
    // ★★ 2026-10-10 订正（「AI 算力配置」面板极简化：零输入控件）：本 note 原文写作
    //   「（或面板 / LEMO_LLM_BASE）」/「（或面板 / LEMO_LLM_KEY）」—— 面板已无这些输入框 ⇒ 已删去「面板 /」。
    //   ★ 若要覆盖：**只能**靠环境变量 `LEMO_LLM_BASE` / `LEMO_LLM_KEY`，或手改 `<成片根>/_llm-api.json`（界面无入口）。
    //   ★★ 2026-10-10 二次订正（**保留上面原句，不抹**）：面板**重建为开放式**后**已有** baseUrl / key 输入框
    //     ⇒ 上面「面板已无这些输入框 / 界面无入口」**已不成立**；note 里「端点与口令一律运行时注入，无需手工填写」
    //     这半句**只对默认服务成立** ⇒ 已改为「默认由运行时注入，也可在算力服务里填写覆盖」（见下 note 末句）。
    note: '软件内所有 LLM 推理任务默认走它（WorkBuddy 智能体 API）。★ 本模块不预置任何密钥 / 端点 / 模型'
      + '（也不硬编码端口）—— 一律「取自运行时环境」：端点从宿主的 SERVER__HOST / SERVER__PORT 动态解析'
      + '（或 LEMO_LLM_BASE）；口令从 CODEBUDDY_GATEWAY_PASSWORD 取（或 LEMO_LLM_KEY）；'
      + '都为空时 validate() 明确报缺，不猜。★ 2026-10-10 订正：端点与口令默认由运行时注入，'
      + '也可在算力服务里填写覆盖。',
  },
  // ── ★★ 2026-10-09 删除（委托方指令「只接 WorkBuddy，其他 provider 一律彻底删除」）──────────
  //   本表原有 **12** 个 profile，现**只剩 `workbuddy` 一个**（见文件头「只接 WorkBuddy」段）。
  //   已删 **11** 个内置 profile：`anthropic` / `openai-compatible` / `doubao` / `qwen` / `hunyuan` /
  //   `deepseek` / `zhipu` / `kimi` / `siliconflow` / `lmstudio` / `custom`
  //   （各自的原条目 + 注释见 git 历史，本处不保留副本，避免第二份真相）。
  //   ★ **只删了「内置 profile 条目」**，**没删适配器**（`anthropic` / `openai-compatible` / `custom` /
  //     `workbuddy-gateway` 全在）—— 理由见文件头：`lib/triple-check.mjs` 与 `invoke()` 仍在用它们。
  //   ★ **回退**：`git show <2026-10-09 的 sha>:lib/llm-api.mjs` 取回本段被删条目即可（删的是**条目**）。
  //   ★★ **2026-10-10 日期订正（**保留上面原句，不抹**）**：委托方按新规格《通用 AI 算力 API 接入模块》
  //      §3「原生兼容国产各类开源 / 闭源 AI 算力服务」**推翻**了「只接 WorkBuddy」⇒ 那 **7 家国产厂商预设**
  //      以**「模板」**形式**回归**（★ **不再进 `PROFILES`**）—— 见紧随本表之后的 `SERVICE_TEMPLATES` /
  //      `listServiceTemplates()`。★ `PROFILES` 内置表**仍只剩 `workbuddy`**（闸门判据③ / 单测钉住）。
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
 * ★★ 2026-10-10 追加（标准 §11.8）：把 base endpoint 与 path 拼成完整 URL，并做**单段去重**。
 *   · 容忍尾部斜杠（`…/v1/` + `/chat` **不**拼出双斜杠）；
 *   · base 尾段与 path 首段**同名**（典型版本段 `/v1`）⇒ **剥掉 path 首段**：
 *     `base="https://api.openai.com/v1"` + `path="/v1/chat/completions"` → `https://api.openai.com/v1/chat/completions`
 *     （★ 否则会拼成 `/v1/v1/…`，任何真实 API 都不可能正确）；
 *   · ★ base **已含完整 path**（`b.endsWith(p)`）⇒ **不再重复拼接**（直接返回 base）。
 *   ★ 只对「版本段」这一层生效（**单段**），不做递归去重。
 */
function joinUrl(base, path) {
  const b0 = String(base ?? '').trim();
  const p0 = String(path ?? '').trim();
  if (!b0) return p0;
  if (!p0) return stripSlash(b0);
  const b = stripSlash(b0);
  let p = p0.startsWith('/') ? p0 : `/${p0}`;
  if (b.endsWith(p)) return b;                         // base 已含目标 path ⇒ 不再重复拼接
  const tail = b.slice(b.lastIndexOf('/') + 1);        // base 尾段（版本段）
  if (tail && p.startsWith(`/${tail}/`)) p = p.slice(tail.length + 1);
  return b + p;
}

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

/** 是否是「朴素对象」（非 null / 非数组）—— 多套服务的入参 / 落盘校验用。 */
const isPlainObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/**
 * `String(v)`，但 **`undefined` / `null` → `''`**。
 * ★★ 为什么必须有它：`String(pick(...))` 在「所有候选都为空」时会得到**字符串 `"undefined"`**
 *   （`String(undefined) === 'undefined'`）—— 那是个**非空**字符串 ⇒ 会被当成合法值**落盘 / 参与查找**
 *   （实测踩过：覆盖文件里写出了 `"active": "undefined"`）。凡「可能全空」的地方一律用本函数。
 */
const strOr = (v) => (v === undefined || v === null ? '' : String(v));
/**
 * ★★ 2026-10-10 追加（标准 §5「extra 开放键包」/ 参考实现 `generic.py` 的 `dig`）：
 *   按**点号路径**取值（`a.b.0.c`）—— 供 `models_path` 在响应 JSON 里定位模型数组。
 *   ★ 数组下标也用点号（`data.0`）。路径空 / 走不通 ⇒ 返回 `undefined`（**不抛**）。
 */
function digPath(obj, path) {
  const p = String(path ?? '').trim();
  if (!p) return undefined;
  let cur = obj;
  for (const seg of p.split('.')) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[seg];
  }
  return cur;
}
/** 重试次数钳制到 0–`MAX_RETRY`（非法 ⇒ 默认）。 */
function clampRetry(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_RETRY;
  return Math.min(MAX_RETRY, Math.round(n));
}
/** 重试退避钳制到 0–`MAX_RETRY_BACKOFF_MS`（非法 ⇒ 默认）。 */
function clampBackoff(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_RETRY_BACKOFF_MS;
  return Math.min(MAX_RETRY_BACKOFF_MS, Math.round(n));
}
/** 等待 `ms` 毫秒（重试退避用）。★ 只在重试路径上 await，不会让正常路径多等。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

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

/**
 * ★★ 2026-10-10 追加（标准 §5/§6）：按 `extra.<key>` 指定的**环境变量名**取生效值。
 *   · `key` ∈ `api_key_env` / `endpoint_env` / `model_env`（照参考 `config.py` 的 `resolve_*`）。
 *   · 语义：`extra.<key>` 给出**变量名**（如 `ANTHROPIC_BASE_URL`）且该变量**有非空值** ⇒ 用它；
 *     否则返回 `undefined`（⇒ 调用方的 `pick(...)` 继续往下取，不静默改变其它来源的次序）。
 *   ★ 变量名本身**不是密钥**（可安全回显）；变量**值**只进内存、绝不落日志 / 响应。
 *   ★ 这里是**动态** `process.env[<变量名>]`（变量名由配置给），**不是**新增 `LEMO_LLM_*` 覆盖点
 *     ⇒ 契约 §二 的 `LEMO_LLM_*` 仍**恰 6 个**（闸门判据⑤ 守着）。
 */
function envFromExtra(extra, key) {
  const name = isPlainObj(extra) ? extra[key] : undefined;
  if (typeof name !== 'string' || !name.trim()) return undefined;
  const v = process.env[name.trim()];
  return (typeof v === 'string' && v.trim()) ? v.trim() : undefined;
}

// ── 落盘：用户覆盖（§八，**非 C 盘、不进仓库**）───────────────
/** 用户覆盖文件路径：`<成片根>/_llm-api.json`（认覆盖点 `LEMO_FILM_DIR`，见 lib/env.mjs）。 */
export function overrideFilePath() {
  return path.join(CFG.exportDir, OVERRIDE_BASENAME);
}

/** ★ 原子写的 tmp **序号**（照 lib/store.mjs 的 `saveIndex` / lib/dub.mjs 的 `saveIndex` 范式）：
 *  同进程连续写也不会撞同一个 tmp 名（名字 = `<file>.<pid>.<seq>.tmp`，见 `saveOverride`）。 */
let overrideWriteSeq = 0;
/** ★ 本进程是否**已持**跨进程写锁（可重入标记；见 `withOverrideLock`）。 */
let overrideLockHeld = false;

/**
 * ★ 内部：读覆盖文件的**原始**内容，并把三种结局**分开**（`readOverride()` 对外仍一律归成 `{}`）：
 *   · `missing`    —— 文件不存在（ENOENT）⇒ 「盘上本来就没有」，可安全新建；
 *   · `ok`         —— 读到且是合法 JSON 对象；
 *   · `read-error` —— 文件**存在但读不出**（权限 / 被占 / 半截）；
 *   · `bad-json`   —— 文件**存在但解析不了**（半截 / 外部工具手改坏 / 顶层不是对象）。
 * ★★ 为什么必须分开（RISK-05 的要害）：**读路径**把「不存在」与「坏」都归成 `{}`（视为「无覆盖」）没问题；
 *   但**写路径**若照此把 `{}` 与 patch 合并写回，就会把用户真实的覆盖文件（含**全部密钥**）**整份清空**
 *   —— 因为「读不到」被当成了「盘上本来就没有」。所以写路径必须先分辨结局（见 `saveOverride`）。
 * @returns {{outcome:'ok'|'missing'|'read-error'|'bad-json', data:object, error:string}}
 *   ★ 字段名用 `outcome` 而**不是** `kind` —— 本模块的 `kind` 一词已被「错误 kind / 适配器 kind」占用，
 *     闸门 `check-llm-api.mjs` 判据①(c) 会扫一切 `kind: '<字面量>'` ⇒ 借用它会误报「规格外的 kind」。
 */
function readOverrideRaw() {
  const file = overrideFilePath();
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return { outcome: 'missing', data: {}, error: '' };
    return { outcome: 'read-error', data: {}, error: (e && e.message) || String(e) };
  }
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('顶层不是对象');
    return { outcome: 'ok', data: obj, error: '' };
  } catch (e) {
    return { outcome: 'bad-json', data: {}, error: (e && e.message) || String(e) };
  }
}

/**
 * ★★ 把一段「读覆盖文件 → 改 → 写回」包成**跨进程互斥**的临界区。
 *   · **复用** lib/store.mjs 的 `acquireLock` / `releaseLock`（同一成片根 ⇒ 同一个锁文件）——
 *     本模块**不另造锁实现**（本项目纪律：先在同仓找同类做法、照抄正确的那个）。
 *   · **可重入**：`saveService` → `saveStore` → `saveOverride` 会**嵌套**进入；内层若再取一次锁，
 *     store 的 `acquireLock` 会把「holder === 本进程 pid」判成陈旧锁、**删掉自己那把**再重建
 *     ⇒ 反而在中间开一个窗口。故用 `overrideLockHeld` 标记：只有**最外层**取 / 放锁。
 *   · **拿不到锁的降级与 store.mjs 一致**（见其 `saveIndex` 里那句「拿不到也照常『重读 + 合并』」）：
 *     只 warn，**仍「重读 + 合并」后写** —— 绝不因锁失败让用户的保存整个失败。
 */
function withOverrideLock(fn) {
  const outer = !overrideLockHeld;
  let locked = false;
  if (outer) {
    locked = acquireLock();
    if (locked) overrideLockHeld = true;
    else warnOnce('保存 LLM 覆盖配置没拿到跨进程锁（另一写者正在写）→ 仍会「重读 + 合并」后写，但「读盘 → 原子写」之间有竞态窗口，对方的改动可能被覆盖');
  }
  try {
    return fn();
  } finally {
    if (outer && locked) {
      overrideLockHeld = false;
      releaseLock();
    }
  }
}

/**
 * 读用户覆盖。★ 读不到 / 解析失败 ⇒ 返回 `{}`（视为「无覆盖」），**不抛**（只 warn 一次）。
 * ★ 本函数只**读**，绝不回显文件内容（那里面可能有明文密钥）。
 */
export function readOverride() {
  const r = readOverrideRaw();
  if (r.outcome === 'read-error') warnOnce(`读 LLM 覆盖配置失败（${r.error}）→ 视为「无覆盖」`);
  else if (r.outcome === 'bad-json') warnOnce(`LLM 覆盖配置损坏（${r.error}）→ 视为「无覆盖」`);
  return r.outcome === 'ok' ? r.data : {};
}

/**
 * 保存用户覆盖（面板 POST /api/llm/config 落盘用）。与现有覆盖**合并**，原子写（tmp + rename）。
 * ★ 尽力而为：失败只返回 `{ok:false,error}`，**不抛**。★ 该文件是**唯一**允许含明文密钥的地方（§八）。
 * ★★ 2026-10-10 修（RISK-05，与 lib/store.mjs / lib/dub.mjs 同范式）：
 *   · **拿跨进程写锁**再 read-modify-write（复用 lib/store.mjs 的锁工具，见 `withOverrideLock`）；
 *   · tmp 名带 **pid + 单调序号** —— 两个进程**不共用**同一个 `.tmp`，不会互相 rename 抢 / 写坏；
 *   · ★★ **绝不因为「读到坏文件」就把盘上内容清空**：盘上**存在**覆盖文件却读不出 / 解析不了时
 *     （半截文件 / 外部工具手改坏），**拒绝写入**并返回结构化错误。判据 = `readOverrideRaw()` 的结局：
 *     `ok`（有合法内容）/ `missing`（**真的**没有）才写；`read-error` / `bad-json` ⇒ **拒写**。
 *     ★ 为什么用「读的结局」而不是「服务数 > 0 而写回空表」当判据：后者会把**合法**的
 *       「删光所有算力服务」（`deleteService` 删掉最后一套）也误判成清空 ⇒ 反而破坏既有功能。
 */
export function saveOverride(partial = {}) {
  try {
    const file = overrideFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const patch = partial && typeof partial === 'object' ? partial : {};
    return withOverrideLock(() => {
      const r = readOverrideRaw();
      if (r.outcome === 'read-error' || r.outcome === 'bad-json') {
        return {
          ok: false,
          error: {
            kind: 'config',
            message: `覆盖文件 ${file} 已存在但无法解析（${r.error}）：为避免把其中已保存的算力服务与密钥整份清空，本次拒绝写入。请先修复或删除该文件后重试。`,
          },
        };
      }
      const next = { ...r.data, ...patch };
      // ★★ 服务级「重读 + 合并」（照 lib/store.mjs 的 `saveIndex` 范式，规则①②，见下）：
      //   仅在 patch **带 services**（= 多套算力服务的写路径）时生效；老的单份覆盖（不带 services）
      //   仍走上面的浅合并 ⇒ 既有行为逐字不变。★ 单进程顺序写时两条规则都是**空操作**（盘上内容 == 上次
      //   读到的）⇒ 既有 104 条单测的语义不变。
      //   ★ 为什么需要（实测）：`lib/store.mjs` 的 `acquireLock` 在**高并发**下**不是严格互斥**的
      //     （它「先 `wx` 创建、再写入 pid」不是原子操作 ⇒ 另一进程能读到**刚创建的空锁文件**、把 holder
      //     解析成 NaN/0、命中它自己的 stale 规则而**删掉别人那把** ⇒ 两个持有者并存）。锁**大多数时候**
      //     能串行化，但不能只靠它 —— 这两条规则正是 `store.mjs` 的 `saveIndex` 用来「拿不到锁也不丢别人
      //     条目」的同一范式。
      if (Array.isArray(patch.services)) {
        const diskSvcs = normalizeOverride(r.data).services;   // 盘上**当前**的服务（刚重读的）
        const diskIds = new Set(diskSvcs.map((s) => s.id));
        const mineIds = new Set(patch.services.map((s) => s && s.id));
        // 规则①「别人删了，跟着删」：本进程**上次读到时还有**、这次仍持有、但盘上已没有 ⇒ 跟着删。
        //   （少了这条：一次整文件重写会把别人的**删除**写回去 ⇒ 服务「复活」。）
        let services = patch.services.filter((s) => !(s && lastServiceIds.has(s.id) && !diskIds.has(s.id)));
        // 规则②「别抹掉别人的服务」：盘上有、而本进程**从来就不认识**（既不在本进程的表、也不在快照里）
        //   ⇒ 另一个进程刚建的 ⇒ **保留**。（少了这条：并发保存时一次整文件重写会抹掉别人刚建的服务。）
        for (const d of diskSvcs) {
          if (!d || !d.id || mineIds.has(d.id) || lastServiceIds.has(d.id)) continue;
          services.push(d);
        }
        next.services = services;
      }
      // ★ tmp 名带 pid + 序号（照 lib/store.mjs 的 `saveIndex` 范式）：各写各的 tmp，不会互相踩。
      const tmp = `${file}.${process.pid}.${(overrideWriteSeq += 1)}.tmp`;
      try {
        fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
        fs.renameSync(tmp, file);      // Windows 上 Node 的 rename 会覆盖已存在的目标
      } catch (e) {
        try { fs.unlinkSync(tmp); } catch { /* 别留半个 tmp */ }
        throw e;
      }
      return { ok: true, path: file };
    });
  } catch (e) {
    return { ok: false, error: { kind: 'config', message: `保存 LLM 覆盖配置失败：${(e && e.message) || e}` } };
  }
}

// ── 配置解析（★ 优先级见文件头）─────────────────────────────
/**
 * 解析「当前生效」的 LLM 配置。
 * @param {object} [opts] 可含 profile / baseUrl / apiKey / model / headers / timeoutMs / kind / path / extract / models / target
 *   ★ 2026-10-10 追加：`service`（**算力服务 id**，见文件头「多套服务」）/ `retry` / `retryBackoffMs`。
 * @returns {{id:string,label:string,kind:string,target:string,baseUrl:string,apiKey:string,headers:object,timeoutMs:number,
 *            model:string,models:string[],path:(string|undefined),extract:(string|undefined),
 *            isDefault:boolean,unknownProfile:boolean,
 *            serviceId:string,servicesEmpty:boolean,retry:number,retryBackoffMs:number}}
 *   ★ 2026-10-10 追加字段：`serviceId` = 本次生效的服务 id（无 ⇒ `''`）；`servicesEmpty` = 覆盖文件**显式**
 *     声明「一套服务都没有」（⇒ 上层应**优雅报**「未配置任何算力服务」）；`retry` / `retryBackoffMs` = 重试策略。
 *   ★★ 2026-10-10 订正（`masked.id/label` 一致性）：选中「算力服务」时，`id` / `label` = **该服务**的
 *     id / label（此前回落默认 `workbuddy` ⇒ 与实际所选不一致）；未选服务时仍 = 原 profile 的 id / label。
 * ★ 返回值里**有 apiKey**（契约要求），调用方**必须**自行脱敏，别打进日志。
 * ★ `target`（2026-10-08 追加）：`'model'` | `'agent'` —— 决定「要不要下发 / 校验 model」，见文件头与契约 §十二。
 */
export function resolveConfig(opts = {}, _file) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const rawFile = _file === undefined ? readOverride() : _file;
  // ★★ 2026-10-10 追加（多套「算力服务」）：把「当前生效的服务」（或 `o.service` 指定的那套）摊平成
  //   **单份覆盖**，再喂给下面那条**一字未动**的 `pick(...)` 链 ⇒ 「显式 → env → 覆盖文件（含当前服务）
  //   → 运行时线索 → 内置默认」这条**已验证的优先级**（闸门判据⑦ 守着）**保持不变**。
  //   ★ 旧格式（单份覆盖）⇒ `selectService` 把 `file` 原样返回（**向后兼容**，既有单测仍过）。
  const picked = selectService(rawFile, o.service);
  const file = picked.file;

  // ★★ 2026-10-10 追加（标准 §5「extra 开放键包」）：把生效服务的 `extra` 摊出来（显式 `o.extra` 优先，
  //   否则用服务/覆盖文件里的 `extra`）。本模块**识别**的键（按适配器解释，其余原样保留）：
  //     · config 层：`api_key_env` / `endpoint_env` / `model_env`（指定读哪个环境变量，见 §6）
  //     · `anthropic_version`（覆盖 `anthropic-version` 头）
  //     · `custom`（我方 generic 等价物）：`method` / `auth_header` / `auth_scheme` / `body_template` / `text_path`
  //     · 模型列表：`models_path` / `models_url_path` / `model_id_key`
  //   ★ `path` / `extract` 仍是**顶层字段**（保留历史，老配置照旧能读）——`text_path` 会折进 `extract`（见下）。
  const extra = isPlainObj(o.extra) ? o.extra : (isPlainObj(file.extra) ? file.extra : {});
  // ★ 按 `extra.*_env` 指定的**环境变量名**取生效值（非空才生效；否则 undefined ⇒ pick 继续往下）。
  const epEnv = envFromExtra(extra, 'endpoint_env');
  const keyEnv = envFromExtra(extra, 'api_key_env');
  const mdlEnv = envFromExtra(extra, 'model_env');

  // ★★ 2026-10-10 修复（`masked.id/label` 显示一致性）：把「生效的算力服务」的 **id / label** 作为本次
  //   解析的**身份**（下方 `id` / `label`）—— 此前服务被摊平后 `file` 里**没有 `profile` 字段** ⇒ `id`
  //   回落默认 `workbuddy` ⇒ `validate().masked.id/label` **恒显示** `workbuddy` / `WorkBuddy（默认）`，
  //   与**实际所选那一套**不一致（`service` 字段却是对的）。★ `known` / `base`（内置表兜底）仍按**原
  //   profile id** 查（`profileId`），以免改变 kind / target / isDefault 等兜底语义
  //   （服务自带字段已摊进 `file`，优先于 `base`）。
  const profileId = String(pick(o.profile, process.env.LEMO_LLM_PROFILE, file.profile, DEFAULT_PROFILE));
  const known = PROFILES[profileId];
  const base = known || {
    id: profileId, label: `${profileId}（未知 profile）`, kind: 'custom', target: 'model', baseUrl: '', model: '', headers: {},
    note: '未知 profile：请检查 profile 名（可用 listProfiles() 看有哪些）。',
  };
  // ★ 生效身份：选中服务 ⇒ 用**该服务**的 id / label；否则 ⇒ 原 profile 的 id / label（向后兼容）。
  const id = picked.serviceId || profileId;
  const label = picked.serviceId ? (strOr(file.label).trim() || picked.serviceId) : base.label;
  const kind = String(pick(o.kind, file.kind, base.kind, 'custom'));
  // ★★ 接入对象类型（`target`）—— 2026-10-08 追加（见契约 §十二 与文件头「接入对象类型」）。
  //   · 取值：`'model'`（底层基础大模型 API）| `'agent'`（智能体 API）。
  //   · **默认 `'model'`**：未标注时按模型 API 处理 ⇒ **向后兼容**（既有 profile 除智能体类外都是模型 API）。
  //   · 覆盖优先级与其它字段**同一条链**：显式 → 覆盖文件（面板） → 内置默认。
  //     ★ **刻意无 env 覆盖点**：契约 §二 仍**恰 6 个** `LEMO_LLM_*`（闸门判据⑤ 守着）⇒ 这里**不**读 `LEMO_LLM_TARGET`。
  //   · 归一：**只有恰为 `'agent'`** 才算智能体；其余（未给 / 拼错）一律按 `'model'`（保守 —— 模型 API 的校验最严）。
  const target = String(pick(o.target, file.target, base.target, 'model')) === 'agent' ? 'agent' : 'model';

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
  //   ★★ 2026-10-09 追加（本批）：`kind:'workbuddy-gateway'`（智能体网关）的运行时线索 = 宿主注入的
  //     网关 env（`SERVER__HOST` / `SERVER__PORT` / `CODEBUDDY_GATEWAY_PASSWORD`）—— 见契约 §十六。
  //     ★ 端点与口令**都在「通信链路」这一维**（不是模型/算力信息）⇒ 与 `ANTHROPIC_*` 同类，读它**不违反** v3。
  const rtBase = kind === 'anthropic' ? process.env.ANTHROPIC_BASE_URL
    : kind === 'openai-compatible' ? process.env.OPENAI_BASE_URL
      : kind === 'workbuddy-gateway' ? gatewayBaseFromEnv() : undefined;
  const rtKey = kind === 'anthropic' ? process.env.ANTHROPIC_API_KEY
    : kind === 'openai-compatible' ? process.env.OPENAI_API_KEY
      : kind === 'workbuddy-gateway' ? gatewayKeyFromEnv() : undefined;
  // ★★ 2026-10-09 修正（v3「不探查 / 不读取智能体内部模型」—— 见文件头与契约 §十四）：
  //   `target === 'agent'`（智能体 API）⇒ **不读**运行时模型线索（`ANTHROPIC_MODEL` / `OPENAI_MODEL`）——
  //   读它 = 「读取智能体内部正在使用的模型信息」，v3 明令禁止（模块不感知 / 不查询 / 不管控智能体内部算力）。
  //   ⇒ agent 模式下 `cfg.model` **只可能**来自「用户自己填的本地备注」（显式 / `LEMO_LLM_MODEL` / 覆盖文件/面板）。
  //   ★ `rtBase` / `rtKey` **不变**：它们是「通信链路」的端点与鉴权，**不是**模型/算力信息（规格只禁止探查**模型/算力**）。
  //   ★ 解析**优先级次序不变**（判据⑦ 守着）：`rtModel` 仍是下方 `pick(...)` 的第 4 个来源，只是 agent 时为 undefined。
  const rtModel = target === 'agent' ? undefined
    : kind === 'anthropic' ? process.env.ANTHROPIC_MODEL
      : kind === 'openai-compatible' ? process.env.OPENAI_MODEL : undefined;

  // ★★ 取值顺序（2026-10-08 修正后，与文件头一致）：
  //   ① 显式传参 → ② LEMO_LLM_* → ③ 覆盖文件（面板） → ④ 运行时线索 → ⑤ 内置默认。
  // ★★ 2026-10-10 追加（标准 §6）：在链中插入 `extra.*_env` 指定的**环境变量值**（非空才生效）——
  //   位置照参考 `config.py`：`endpoint_env` / `model_env` **压过**服务里的字面值（宿主注入的「活链接」）；
  //   `api_key_env` 则排在**字面 key 之后**（显式凭据优先）。★ 插入的实参是**变量名**（`epEnv`/`keyEnv`/
  //   `mdlEnv`），不被闸门判据⑦ 的来源归一识别 ⇒ 已识别来源的**相对次序不变**（explicit→env→override→runtime→builtin）。
  const baseUrl = stripSlash(pick(o.baseUrl, process.env.LEMO_LLM_BASE, epEnv, file.baseUrl, rtBase, base.baseUrl, ''));
  const apiKey = String(pick(o.apiKey, process.env.LEMO_LLM_KEY, file.apiKey, keyEnv, rtKey, '') ?? '');
  const model = String(pick(o.model, process.env.LEMO_LLM_MODEL, mdlEnv, file.model, rtModel, base.model, '') ?? '');
  const headers = mergeHeaders(base.headers, file.headers, envHeaders(), o.headers);
  const timeoutMs = clampTimeout(pick(o.timeoutMs, process.env.LEMO_LLM_TIMEOUT_MS, file.timeoutMs, DEFAULT_TIMEOUT_MS));
  // ★★ 2026-10-10 追加（标准 §5 / §12.2）：`extra.path`（openai_compat / generic 的请求路径覆盖）折进 `path`
  //   —— 二者同义（我方顶层 `path` 即参考的 `extra.path`），顶层显式给值优先、`extra.path` 兜底；
  //   参考 §12.2 的 WorkBuddy 官方配方即把请求路径写在 `extra.path` 里。
  const p = pick(o.path, file.path, extra.path, base.path);
  // ★★ 2026-10-10 追加（标准 §5）：`extra.text_path`（generic/custom 的取文本路径）折进 `extract`
  //   —— 二者同义（我方顶层 `extract` 即参考的 `text_path`），`extract` 显式给值优先。
  const ex = pick(o.extract, file.extract, extra.text_path, base.extract);
  const models = toStrArray(pick(o.models, file.models, base.models));
  // ★★ 2026-10-10 追加（标准 §11.5）：两个布尔服务开关 —— **同一套来源链**（显式 → 服务对象（覆盖文件）→ 默认关）。
  //   ★ 同时接受标准里的 snake_case 别名（`force_stream` / `ensure_system_prompt`）。
  //   ★ `pick` 把 `false` 当**非空**值 ⇒ 「显式 false」能压过服务对象里的 true（§11.2 的「能关掉」）。
  //   ★★ 2026-10-10 追加（标准 §5 / §12.2）：链尾再兜 `extra.force_stream` / `extra.ensure_system_prompt`
  //     —— 参考 §12.2 的 WorkBuddy 官方配方正是把这两个开关写在 `extra` 里（openai_compat 的两个硬约束：
  //     非流式 ⇒ 400 `code=11101`、首条非 system ⇒ 400 `code=11128`）；顶层显式给值仍优先，`extra` 兜底。
  const forceStream = !!pick(o.forceStream, o.force_stream, file.forceStream, file.force_stream, extra.force_stream);
  const ensureSystemPrompt = !!pick(o.ensureSystemPrompt, o.ensure_system_prompt, file.ensureSystemPrompt, file.ensure_system_prompt, extra.ensure_system_prompt);

  return {
    id, label, kind, target, baseUrl, apiKey, headers, timeoutMs, model, models,
    path: p === undefined ? undefined : String(p),
    extract: ex === undefined ? undefined : String(ex),
    isDefault: !!base.isDefault,
    unknownProfile: !known,
    // ★★ 2026-10-10 追加（多套服务 / 重试）：`serviceId` = 本次生效的服务 id（无 ⇒ ''）；
    //   `servicesEmpty` = 覆盖文件**显式声明**「一套服务都没有」（⇒ 上层应优雅报「未配置任何算力服务」）。
    serviceId: picked.serviceId, servicesEmpty: !!picked.servicesEmpty,
    // ★ 2026-10-10 追加（标准 §11.5）：两个布尔服务开关（默认 false ⇒ 既有调用逐字不变）。
    forceStream, ensureSystemPrompt,
    // ★★ 2026-10-10 追加（标准 §5）：生效服务的 `extra` 开放键包（供适配器按 kind 解释）。
    extra,
  };
}

/** 脱敏后的配置视图（**绝不含密钥明文**）—— 面板 GET /api/llm/config 可直接用。
 *
 * ★★ 2026-10-10 订正（标准 §10「安全与信息边界」）：**请求头内容绝不外传** —— 原来这里把整个
 *   `headers` 对象回给前端（只对「键名含 authorization/x-api-key/api-key/token/secret/key」的**值**
 *   打码，其余**原样**），⇒ 自定义头（如 `X-Custom-Auth` / `Cookie`）会**明文外传**。
 *   ⇒ 现在**只回一个布尔** `hasHeaders`（= 是否已配置请求头），**不再回任何头名 / 头值**。
 *   ★ 前端回显因此会变空 —— 这是**标准的有意设计**：配合「留空 = 不修改」（见 `saveService`）保证
 *     编辑保存时**不会误清空**既有请求头。★ 前端 `renderLlmForm` 由**另一路**改造，本模块不动它。
 *   ★ 原句（**保留，不抹**）：`headers` = 脱敏后的请求头对象（键名敏感 ⇒ 值打码）。
 */
export function maskedConfig(cfg) {
  return {
    id: cfg.id, label: cfg.label, kind: cfg.kind, target: cfg.target, baseUrl: cfg.baseUrl, model: cfg.model,
    hasKey: !!cfg.apiKey, keyMask: maskKey(cfg.apiKey), timeoutMs: cfg.timeoutMs,
    path: cfg.path, extract: cfg.extract, models: cfg.models,
    // ★★ 2026-10-10（标准 §10）：**只回布尔**，请求头内容（头名与头值）**绝不外传**。
    hasHeaders: !!(cfg.headers && Object.keys(cfg.headers).length > 0),
    // ★ 2026-10-10 追加（标准 §11.5）：两个布尔服务开关的**脱敏回显**（布尔非密钥，直接如实回）。
    forceStream: !!cfg.forceStream, ensureSystemPrompt: !!cfg.ensureSystemPrompt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── ★★ 多套「算力服务」的存储与 CRUD —— 2026-10-10 追加（委托方新规格 §5）──
// ═══════════════════════════════════════════════════════════════════════════
//   ★ 存储模型（覆盖文件 `<成片根>/_llm-api.json`，★ 与 `.console` 同源、**非 C 盘、不进仓库**）：
//     `{ version:1, active:'<服务 id>', services:[ {id,label,kind,target,baseUrl,model,headers,
//        timeoutMs,path?,extract?,retry?,retryBackoffMs?} ] }`
//   ★★ **向后兼容（硬指标）**：老格式（单份覆盖，如 `{baseUrl,apiKey,model}`）读进来**不崩**，并由
//     `normalizeOverride` **迁移**为「一套服务」（id 取 `profile`，缺省 = `workbuddy`）——
//     既有单测「写旧格式、读回旧字段」**逐条仍过**（见报告的真实输出）。
//   ★★ **不锁定任何服务**：`services` 允许为空 ⇒ 空时 `chat()` / `invoke()` 等**优雅报**
//     「未配置任何算力服务」（结构化 `{ok:false,error:{kind:'config'}}`），**不是崩**。
//   ★ `workbuddy`（本项目自己的智能体网关）是**出厂默认服务**（由内置表 `PROFILES.workbuddy` 派生），
//     ★ **可删 / 可改**（不锁死）—— 删光 ⇒ `services` 为空 ⇒ 上述「未配置」路径。
//   ★★ **脱敏纪律**：本段所有**对外**返回（`listServices` / `getActiveService` / `serviceById` / CRUD 回执）
//     一律走 `maskedService`（**绝不含 key 明文**，只回 `hasKey` / `keyMask` / 脱敏 headers）；
//     **明文密钥只落覆盖文件**（契约 §八 —— 那是唯一允许含明文处）。

/** 内置表里那套「出厂默认服务」（`workbuddy`）—— ★ 只在覆盖文件**没有** services 时兜底，**可被删**。 */
function builtinDefaultService() {
  const p = PROFILES[DEFAULT_SERVICE_ID] || {};
  return {
    id: DEFAULT_SERVICE_ID, label: p.label || DEFAULT_SERVICE_ID,
    kind: p.kind || DEFAULT_SERVICE_KIND, target: p.target || 'model',
    baseUrl: p.baseUrl || '', model: p.model || '', headers: {}, isDefault: true,
  };
}

/**
 * 归一**一套服务**（★ 只保留**已知字段** —— 不把 `services` / `active` / `version` 之类元字段带进
 * 「单份覆盖」层，否则会污染 `resolveConfig` 的 `file.*` 取值）。
 * ★★ **关键**：**不给 `kind` / `target` 填默认值** —— 缺省时**不写入**，好让 `resolveConfig` 回落到
 *   内置表（`base.kind` / `base.target`）⇒ 老覆盖文件（如只写了 `target:'model'`）**不会**被莫名
 *   改成别的适配器（★ 这是「向后兼容」的要害，实测钉住）。
 */
function normService(raw) {
  if (!isPlainObj(raw)) return null;
  const id = strOr(pick(raw.id, raw.serviceId, raw.name)).trim();
  if (!id) return null;
  const out = { id };
  const kind = String(raw.kind ?? '');
  if (SERVICE_KINDS.includes(kind)) out.kind = kind;
  const target = String(raw.target ?? '');
  if (target === 'agent' || target === 'model') out.target = target;
  if (!isBlank(raw.label)) out.label = String(raw.label);
  if (!isBlank(raw.baseUrl)) out.baseUrl = stripSlash(raw.baseUrl);
  if (!isBlank(raw.model)) out.model = String(raw.model);
  if (isPlainObj(raw.headers)) out.headers = mergeHeaders(raw.headers);
  if (!isBlank(raw.timeoutMs)) out.timeoutMs = clampTimeout(raw.timeoutMs);
  if (!isBlank(raw.path)) out.path = String(raw.path);
  if (!isBlank(raw.extract)) out.extract = String(raw.extract);
  if (raw.models !== undefined) out.models = toStrArray(raw.models);
  if (!isBlank(raw.apiKey)) out.apiKey = String(raw.apiKey);
  // ★★ 2026-10-10 追加（标准 §11.5）：两个布尔服务开关 —— ★ 用 `!== undefined` 判定（**显式 `false` 必须存下**，
  //   否则「取消勾选」会被「留空 = 不修改」的合并语义吃掉，见标准 §11.2）。★ 亦接受标准里的 snake_case 别名。
  const fsVal = raw.forceStream !== undefined ? raw.forceStream : raw.force_stream;
  if (fsVal !== undefined) out.forceStream = !!fsVal;
  const espVal = raw.ensureSystemPrompt !== undefined ? raw.ensureSystemPrompt : raw.ensure_system_prompt;
  if (espVal !== undefined) out.ensureSystemPrompt = !!espVal;
  // ★★ 2026-10-10 追加（标准 §5）：`extra` 开放键包 —— 原样浅拷贝落盘（语义由 `resolveConfig` /
  //   请求构造**按适配器**解释；本模块识别的键见 `resolveConfig` 里 `extra` 段的说明）。
  //   ★ 与参考一致：`extra` 是**开放**包（不在此处裁剪未知键，避免第二份「哪些键合法」的真相）。
  if (isPlainObj(raw.extra)) out.extra = { ...raw.extra };
  // ★★ 2026-10-10 追加（标准 §4）：`enabled`（是否启用）—— ★ 用 `!== undefined` 判定（**显式 `false`
  //   必须存下**，默认启用）。`enabled:false` 的服务在 active **回落**时会被跳过（见 `pickActiveId`）。
  if (raw.enabled !== undefined) out.enabled = !!raw.enabled;
  // ★★ 2026-10-10 追加（标准 §4）：`capability`（llm/image/speech/embedding）—— ★ 只如实存字符串，
  //   **不在此归一**（非法值的**显式拒绝**在写入路径 `saveService`；读取路径**不静默回落**成 `llm`）。
  if (!isBlank(raw.capability)) out.capability = String(raw.capability);
  if (raw.isDefault === true) out.isDefault = true;
  return out;
}

/** 覆盖文件的**旧格式字段**（判断「这份覆盖是不是老的单份覆盖」用）。 */
const LEGACY_OVERRIDE_KEYS = ['profile', 'kind', 'target', 'baseUrl', 'apiKey', 'model', 'headers',
  'timeoutMs', 'path', 'extract', 'models'];
function hasLegacyFields(o) {
  return LEGACY_OVERRIDE_KEYS.some((k) => !isBlank(o[k]));
}

/**
 * 归一覆盖文件 → `{ version, active, services, explicitEmpty }`。三种输入：
 *   ① 新格式（有 `services` 数组）⇒ 直接用（★ **services 一旦存在就是权威**：删光 ⇒ 显式空）；
 *   ② **显式空**（`services: []`）⇒ 空表（`explicitEmpty:true` ⇒ 上层可判「未配置任何算力服务」）；
 *   ③ 老格式（单份覆盖）⇒ **迁移**为「一套服务」（**向后兼容**，不崩）。
 */
function normalizeOverride(raw) {
  const o = isPlainObj(raw) ? raw : {};
  if (Array.isArray(o.services)) {
    const services = o.services.map(normService).filter(Boolean);
    return {
      version: OVERRIDE_VERSION, services, explicitEmpty: services.length === 0,
      active: strOr(pick(o.active, services[0] && services[0].id)),
    };
  }
  if (hasLegacyFields(o)) {
    // ★ 迁移时若 `id` 命中内置表（如 `workbuddy`）⇒ **继承**其 `kind` / `target`（★ 老覆盖文件通常只写了
    //   `baseUrl` / `apiKey` / `model`；不继承的话该服务的 `kind` 会留空，面板看起来像「没配适配器」）。
    //   ★ 显式写了的 `kind` / `target` **仍然优先**（`...o` 在后）⇒ 与迁移前的解析结果**完全一致**。
    const id = strOr(pick(o.profile, DEFAULT_SERVICE_ID));
    const bp = PROFILES[id] || {};
    const svc = normService({ kind: bp.kind, target: bp.target, ...o, id });
    if (svc) return { version: OVERRIDE_VERSION, active: svc.id, services: [svc], explicitEmpty: false };
  }
  return { version: OVERRIDE_VERSION, active: strOr(pick(o.active)), services: [], explicitEmpty: false };
}

/** 「生效的服务表」：有服务 ⇒ 用它；★ 显式空 ⇒ 空表；否则 ⇒ 出厂默认那一套（`workbuddy`，**可删**）。 */
function effectiveServices(norm) {
  if (norm.services.length) return norm.services;
  return norm.explicitEmpty ? [] : [builtinDefaultService()];
}

/**
 * ★★ 跨进程「重读 + 合并」的**上次同步快照**（照 lib/store.mjs 的 `saveIndex` 范式）：
 *   = 本进程**上一次从盘上读到的**服务 id 集（在 `loadStore()` 里刷新）。
 *   ★ 用途：写回时区分「盘上没有的条目」是**别人删的**（跟着删）还是**本进程刚建的**（保留），
 *     从而在**锁偶然没互斥住**时也不丢别人的改动（见 `saveStore`）。
 */
let lastServiceIds = new Set();

/** 读覆盖文件 → 归一后的**存储视图**（`services` 已含出厂默认兜底）。★ 只读，不抛。 */
function loadStore() {
  const raw = readOverride();
  const norm = normalizeOverride(raw);
  // ★ 记下「本进程这次从盘上读到哪些服务」—— `saveOverride` 判「谁删了谁 / 谁建了谁」的依据。
  lastServiceIds = new Set(norm.services.map((s) => s.id));
  return { raw, version: OVERRIDE_VERSION, active: norm.active, services: effectiveServices(norm), explicitEmpty: norm.explicitEmpty };
}

/**
 * 把**存储视图**写回覆盖文件（原子写；★ 尽力而为，失败只回 `{ok:false}`，**不抛**）。
 * ★ 实际的「拿锁 + 重读 + 按服务粒度合并（规则①②）」全在 `saveOverride` 里（单一写入口）——
 *   本函数只负责把存储视图拼成 patch（`services` 带上 ⇒ 触发那边的服务级合并）。
 */
function saveStore(store) {
  const services = store.services.map(normService).filter(Boolean);
  const active = strOr(pick(store.active, services[0] && services[0].id));
  const next = { ...(isPlainObj(store.raw) ? store.raw : {}), version: OVERRIDE_VERSION, active, services };
  return saveOverride(next);
}

/**
 * ★ 内部：从**服务表**里挑「生效的服务 id」—— 显式 `active` 命中**且该服务启用** ⇒ 用它；
 *   否则取**第一套启用**的服务；一套都没启用（全禁用）⇒ 退回 `active` / 第一套（**仍给一个，不返空**）。
 * ★★ 2026-10-10 追加（标准 §4）：`enabled:false` 的服务**不应被选中** —— active **回落**时必须**跳过**它。
 *   ★ 显式选中的那套若被禁用，也按「回落」处理（换第一套启用的）—— 与「不被选中」的意图一致。
 *   ★ 全禁用是边界（用户把每套都关了）：此时没有「更好的选择」⇒ 仍退回一个（否则 `getActiveService()`
 *     会莫名返回 `null`，把「全禁用」误当成「一套都没有」）。
 */
function pickActiveId(services, active) {
  const list = Array.isArray(services) ? services : [];
  const a = strOr(active);
  const hit = list.find((s) => s && s.id === a);
  if (hit && hit.enabled !== false) return a;
  const firstEnabled = list.find((s) => s && s.enabled !== false);
  if (firstEnabled) return firstEnabled.id;
  return strOr(pick(a, list[0] && list[0].id));
}

/** ★ 内部：**实际生效**的服务 id —— 显式 `active` 优先；否则退回**生效服务表的第一套**。
 *  ★ 为什么必须有它（2026-10-10 订正）：`loadStore().active` 在「**无覆盖 / 覆盖里没写 active**」时
 *    是 `''`，而 `getActiveService()` 会**兜底**返回 `services[0]` ⇒ 若脱敏视图仍用 `s.id === st.active`
 *    判「当前」，就会出现自相矛盾：**顶层 `active='workbuddy'`（`GET /api/llm/services` 返回的是
 *    `getActiveService().id`），而 `services[]` 里 workbuddy 那条的 `active` 标记却是 `false`**。
 *  ★ 口径与写入侧 `saveStore()` 的 `strOr(pick(store.active, services[0] && services[0].id))` **同源**
 *    （避免第二份「谁是当前」的真相）。
 *  ★ 只影响**读取视图**（`listServices` / `getActiveService`）；**写入路径**仍读 `loadStore().active`
 *    的**原值** ⇒ 「空覆盖下保存第一套服务会把它设为当前」这条既有语义**不变**（向后兼容，单测钉着）。
 *  ★★ 2026-10-10 订正（标准 §4）：改为走 `pickActiveId` ⇒ **跳过 `enabled:false` 的服务**。 */
function effectiveActiveId(st) {
  return pickActiveId(st.services, st.active);
}

/** ★★ 2026-10-10 追加（标准 §10「安全与信息边界」）：`extra` 回显的**允许清单**（只回非密钥项）。
 *   ★ **允许清单**语义（不是排除清单）：**只回列出的键**，清单**外**的键**一律不回**（未知键可能是密钥）。
 *   ★ 值为**对象 / 数组**的键（如 `body_template`）**不回**（避免夹带密钥）。
 *   ★ `api_key_env` / `endpoint_env` / `model_env` 只回**环境变量名**，**绝不回其值**（同 §10 的 `credential_source`）。
 *   ★ 值为 `undefined` / `null` 的键**不写进结果**（保持结果干净）；`extra` 为空 ⇒ 返回 `undefined`（不回该字段）。 */
const EXTRA_ECHO_KEYS = [
  'path', 'auth_header', 'auth_scheme', 'force_stream', 'ensure_system_prompt',
  'api_key_env', 'endpoint_env', 'model_env', 'text_path', 'method',
  'models_path', 'models_url_path', 'model_id_key', 'anthropic_version',
];
function maskedExtra(extra) {
  if (!isPlainObj(extra)) return undefined;
  const out = {};
  for (const k of EXTRA_ECHO_KEYS) {
    const v = extra[k];
    if (v === undefined || v === null) continue;        // ★ 空值键不写进结果
    if (isPlainObj(v) || Array.isArray(v)) continue;    // ★ 对象 / 数组值不回（可能夹带密钥）
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 脱敏的服务视图（★ **绝不含 key 明文**；复用 `maskedConfig` 的脱敏口径，避免第二份真相）。 */
function maskedService(s, active) {
  const cfg = {
    id: s.id, label: s.label || s.id, kind: s.kind || '', target: s.target || '',
    baseUrl: s.baseUrl || '', model: s.model || '', apiKey: s.apiKey || '', headers: s.headers || {},
    timeoutMs: s.timeoutMs ?? DEFAULT_TIMEOUT_MS, path: s.path, extract: s.extract, models: s.models || [],
    forceStream: s.forceStream, ensureSystemPrompt: s.ensureSystemPrompt,   // ★ 2026-10-10（§11.5）如实回显
  };
  const extra = maskedExtra(s.extra);   // ★ 2026-10-10（§10）只回白名单内的非密钥项；空 ⇒ undefined
  return {
    ...maskedConfig(cfg),
    // ★★ 2026-10-10 追加（标准 §4）：如实回显 `enabled` / `capability`（**非密钥**，可安全回传）。
    enabled: s.enabled !== false, capability: s.capability || 'llm',
    isDefault: !!s.isDefault, active: !!active,
    // ★★ 2026-10-10 追加（标准 §10）：`extra` 白名单回显（**仅非密钥项**）——空 ⇒ **不返回该字段**
    //   （保持既有调用方逐字不变）。
    ...(extra ? { extra } : {}),
  };
}

/** ★ 内部：把「当前生效的服务」（或 `sid` 指定的那套）摊平成 `resolveConfig` 用的**单份覆盖**层。
 *  ★★ 2026-10-10 订正（标准 §4）：未显式指定时，生效项由 `pickActiveId` 选（**跳过 `enabled:false`**）。 */
function selectService(raw, sid) {
  const base = isPlainObj(raw) ? raw : {};
  const norm = normalizeOverride(raw);
  if (!norm.services.length) return { file: base, serviceId: '', servicesEmpty: norm.explicitEmpty };
  const want = strOr(pick(sid, pickActiveId(norm.services, norm.active), norm.services[0].id));
  const svc = norm.services.find((s) => s.id === want)
    || norm.services.find((s) => s.id === strOr(norm.active)) || norm.services[0];
  return { file: { ...base, ...svc }, serviceId: svc.id, servicesEmpty: false };
}

/**
 * ★★ **算力服务列表**（★ **脱敏**）。★ 与 `listProfiles()` **不是一回事**、**如实并存**：
 *   · `listProfiles()` = **内置 profile 表**（本仓**仍只剩 `workbuddy`**，闸门判据③ / 单测守着）；
 *   · `listServices()` = **用户保存的「算力服务」**（覆盖文件里那几套；无覆盖时含出厂默认 `workbuddy`）。
 *   ★ 任务书曾建议「`listProfiles()` 基于 `listServices()` 实现」—— **不可行**（会把 `listProfiles()`
 *     从「恰 1 条」变成「N 条」，直接打红单测）⇒ 两者**各司其职**（详见报告）。
 * @returns {{id,label,kind,target,baseUrl,model,hasKey,keyMask,timeoutMs,path,extract,headers,
 *            retry,retryBackoffMs,isDefault,active}[]} ★ **绝不含 key 明文**。
 */
export function listServices() {
  const st = loadStore();
  const activeId = effectiveActiveId(st);      // ★ 空覆盖时也把**实际生效**的那套标成 active（见该函数注释）
  return st.services.map((s) => maskedService(s, s.id === activeId));
}

/** 取**当前生效**的算力服务（脱敏）；一套都没有 ⇒ `null`。
 *  ★★ 2026-10-10 订正（标准 §4）：生效项由 `effectiveActiveId`（= `pickActiveId`）决定 ⇒
 *    `enabled:false` 的服务在**回落**时被跳过。 */
export function getActiveService() {
  const st = loadStore();
  const activeId = effectiveActiveId(st);
  const s = st.services.find((x) => x.id === activeId) || st.services[0] || null;
  return s ? maskedService(s, s.id === activeId) : null;
}

/** 按 id 取一套算力服务（脱敏）；不存在 ⇒ `null`。★ 基于 `listServices()` 实现（避免第二份口径）。 */
export function serviceById(id) {
  const key = String(id ?? '');
  return listServices().find((s) => s.id === key) || null;
}

/**
 * ★★ **切换当前算力服务**（★ **全局实时生效**：切换后所有 `chat()` / `invoke()` / `validate()` 立即走它）。
 * @returns {{ok:true,active:string}|{ok:false,error:{kind,message}}} ★ **永不抛**。
 */
export function setActiveService(id) {
  try {
    const key = String(id ?? '');
    // ★★ 2026-10-10 修（RISK-05）：整个「读 → 改 → 写」放进跨进程临界区（见 `withOverrideLock`）
    //   —— 否则并发保存时两个进程会各自读到**同一份旧快照**、再各自整份盖写 ⇒ 丢失更新。
    return withOverrideLock(() => {
      const svc = serviceById(key);                      // ★ 复用 serviceById：不存在 ⇒ 明确报错，**不静默**
      if (!svc) {
        return { ok: false, error: { kind: 'config', message: `找不到算力服务「${key}」：请先用 listServices() 查看已保存的服务 id` } };
      }
      const st = loadStore();
      const r = saveStore({ ...st, active: key });
      if (!r.ok) return { ok: false, error: r.error || { kind: 'config', message: '切换算力服务失败' } };
      return { ok: true, active: key };
    });
  } catch (e) {
    return { ok: false, error: { kind: 'unknown', message: `切换算力服务失败：${(e && e.message) || e}` } };
  }
}

/**
 * ★★ 生成一个**新的算力服务 id**（★ 2026-10-10 追加：修「面板 POST 不带 id ⇒ 真后端 HTTP 400
 *   `保存算力服务需要 id（服务标识）`」的**契约 bug**）。
 *   · **唯一**：`svc-<base36 时间戳>-<进程内单调计数器 base36>` —— 计数器**每次调用必增**
 *     ⇒ 即使**同一毫秒**内连续新建两套，时间戳相同而计数器不同 ⇒ **不撞**（★ 这是防撞的**机制**，
 *     不是「概率上不撞」）；
 *   · **URL-safe**：只含 `[0-9a-z-]`（base36 + 连字符）⇒ 可安全放进 URL / 表单 / 文件名；
 *   · **稳定**：生成后**随服务落盘**，之后不再变（更新走「带 id」那条路，**绝不重生成**）；
 *   · ★ **兜底去重**：再对 `taken`（既有服务 id 集合）避让 —— 防「手工造了个同形 id」这种极端。
 * @param {Iterable<string>} [taken] 已存在的服务 id（生成时避让）。
 */
let serviceIdSeq = 0;
function newServiceId(taken) {
  const used = new Set(taken || []);
  const ts = Date.now().toString(36);
  for (;;) {
    serviceIdSeq += 1;
    const cand = `svc-${ts}-${serviceIdSeq.toString(36)}`;
    if (!used.has(cand)) return cand;
  }
}

/**
 * ★★ **新增或更新一套算力服务**（按 `id` upsert）。★ `svc.active === true` ⇒ **同时**切换为当前。
 * ★★ 2026-10-10 修复（id 契约 bug）：`svc` **不带 id** ⇒ 后端**自动生成**一个（唯一 / URL-safe / 稳定，
 *   见 `newServiceId`）并**随返回值给出**（`service.id` / `active`）—— **不再报 400**；★ 带 id ⇒ 走
 *   「更新那一套」（下方 `idx >= 0` 分支，行为不变）。
 * ★ 新建（该 id 不存在）时，`kind` 缺省 = `DEFAULT_SERVICE_KIND`、`target` 缺省 = `'model'`。
 * @param {object} svc `{id?,label?,kind?,target?,baseUrl?,apiKey?,model?,headers?,timeoutMs?,path?,extract?,retry?,retryBackoffMs?,forceStream?,ensureSystemPrompt?,extra?,active?}`
 *   ★ `id` **可缺省**（缺省 ⇒ 后端生成；返回值 `service.id` 即新 id，供面板选中 / 编辑新服务）。
 *   ★★ 2026-10-10 追加（标准 §11.1 / §11.2）：`apiKey` **空串** ⇒ 沿用已有 Key；`headers` **空 dict** ⇒ 沿用已有；
 *     `extra` **逐键合并**（空值键跳过 ⇒ 沿用旧值，见 `saveService` 内注释）。显式清空走
 *     `clearKey:true` / `clearHeaders:true` / `clearExtra:['<键名>']`（★ 三者皆控制字段、不落盘）。
 *     两个布尔开关接受 `forceStream` / `ensureSystemPrompt`
 *     （或 snake_case 别名 `force_stream` / `ensure_system_prompt`），★ **显式 `false` 能关掉**。
 * @returns {{ok:true,service:object,active:string}|{ok:false,error:{kind,message}}} ★ **永不抛**。
 */
export function saveService(svc) {
  try {
    if (!isPlainObj(svc)) return { ok: false, error: { kind: 'config', message: 'saveService 需要一个服务对象' } };
    const rawKind = String(svc.kind ?? '');
    if (rawKind && !SERVICE_KINDS.includes(rawKind)) {
      return { ok: false, error: { kind: 'config', message: `kind「${rawKind}」不是本模块支持的适配器类型` } };
    }
    // ★★ 2026-10-10 追加（标准 §4 / §11.11）：`capability` **显式校验** —— 非法值**显式拒绝**，
    //   **绝不静默回落**成 `llm`（参考方实测：`embed` 被归一成 `llm` ⇒ 用户选了「向量计算」却**静默变文本推理**）。
    //   ★ 合法值 = `llm` / `image` / `speech` / `embedding`（★ 注意是 **embedding**，不是 `embed`）。
    //   ★ 缺省（未给 / 空串）⇒ 合法（回落 `llm`，见下方 merged）——「没选」不是「选错」。
    const rawCap = svc.capability !== undefined && svc.capability !== null ? String(svc.capability).trim() : '';
    if (rawCap && !SERVICE_CAPABILITIES.includes(rawCap)) {
      return {
        ok: false,
        error: {
          kind: 'config',
          message: `capability「${rawCap}」非法：只能是 ${SERVICE_CAPABILITIES.join(' / ')}（★ 注意是 embedding，不是 embed）`,
        },
      };
    }
    // ★★ 2026-10-10 修（RISK-05）：整个「读 → 改 → 写」放进**跨进程临界区**（见 `withOverrideLock`）。
    //   否则并发保存时两个进程会各自读到**同一份旧快照**、再各自整份盖写 ⇒ 丢失更新（服务与密钥丢）。
    return withOverrideLock(() => {
      const st = loadStore();
      // ★★ 2026-10-10 修复（id 契约 bug）：body **无 id** ⇒ 后端**生成**一个（唯一 / URL-safe / 稳定），
      //   **不再报 400**；★ 带 id ⇒ `givenId` 即它，走「更新那一套」（`idx >= 0`，行为不变）。
      const givenId = strOr(pick(svc.id, svc.serviceId, svc.name)).trim();
      const id = givenId || newServiceId(st.services.map((x) => x.id));
      const idx = st.services.findIndex((x) => x.id === id);
      const prev = idx >= 0 ? st.services[idx] : {};
      // ★★ 2026-10-10 追加（标准 §11.1「留空 = 不修改」三处语义一致）：
      //   `saveService` 用 `{...prev, ...svc}`（**省略** ⇒ 保留），但**传空串 / 空 dict** 会经 `normService`
      //   把旧值**清空**（blank 被丢弃 ⇒ 覆盖成空）⇒ **不满足标准**。这里在合并前把「空值」从 patch 里
      //   **摘掉**（= 不修改旧值）：
      //     · `apiKey` 空串 / 缺省 ⇒ **沿用已有 Key**（前端编辑时无需回填密钥）；
      //     · `headers` 空 dict / 缺省 ⇒ **沿用已有请求头**（避免误清空鉴权头）；
      //   ★ **显式清空**仍可达（否则面板的「清除密钥」按钮就废了）：`clearKey:true` ⇒ 清 Key；
      //     `clearHeaders:true` ⇒ 清请求头。★ 二者只是**控制字段**，**不落盘**（`normService` 只留已知字段）。
      //   ★ 其余可选字段（path / extract / retry / retryBackoffMs / forceStream / ensureSystemPrompt …）本就
      //     「留空 ⇒ `normService` 不写入 ⇒ `...prev` 的值保留」，与上面两处**同一条语义**。
      const patch = { ...svc };
      if (patch.clearKey === true) patch.apiKey = '';
      else if (typeof patch.apiKey !== 'string' || patch.apiKey.trim() === '') delete patch.apiKey;
      if (patch.clearHeaders === true) patch.headers = {};
      else if (!isPlainObj(patch.headers) || Object.keys(patch.headers).length === 0) delete patch.headers;
      // ★★ 2026-10-10 追加（对齐参考 §11.1）：`extra` 开放键包**逐键合并**（**不是**整对象覆盖）。
      //   参考口径（`facade.py` 的 `_do()`）：表单只管理少数几个键（如 `auth_header` / `auth_scheme` /
      //   `text_path`），已有服务上的 `endpoint_env` / `api_key_env` / `models_path` 等必须**原样保留** ——
      //   若把传入的 `extra` 整对象盖上去，面板只填一个键就会**冲掉**其余旧键。
      //   合并顺序：① 以 `prev.extra` 打底；② 应用 `patch.extra` 里**非空**的键（值为 `undefined` / `null` /
      //   纯空白字符串 ⇒ **跳过**，同「留空 = 不修改」）；③ 最后按 `clearExtra`（**字符串数组**）删键。
      //   ★ `clearExtra` 只是**控制字段、不落盘**（与 `clearKey` / `clearHeaders` 同范式）——没有它，
      //     合并语义下传空串不生效，用户误填的键将**永远无法清除**（死路）。
      const prevExtra = isPlainObj(prev.extra) ? prev.extra : {};
      const incomingExtra = isPlainObj(patch.extra) ? patch.extra : {};
      const mergedExtra = { ...prevExtra };
      for (const [k, v] of Object.entries(incomingExtra)) {
        if (v === undefined || v === null) continue;              // ★ 空值 ⇒ 不覆盖旧值
        if (typeof v === 'string' && v.trim() === '') continue;   // ★ 纯空白串 ⇒ 不覆盖旧值
        mergedExtra[k] = v;
      }
      if (Array.isArray(patch.clearExtra)) {                      // ★ 显式清空：只删列出的键名
        for (const k of patch.clearExtra) if (typeof k === 'string') delete mergedExtra[k];
      }
      patch.extra = mergedExtra;                                  // ★ 合并结果整体交给 normService（浅拷贝落盘）
      delete patch.clearExtra;                                    // ★ 控制字段不落盘（normService 只留已知字段）
      // ★ 布尔开关的 snake_case 别名归一为 camelCase（★ 显式 `false` 也照样带过去，见标准 §11.2）。
      if (patch.forceStream === undefined && patch.force_stream !== undefined) patch.forceStream = patch.force_stream;
      if (patch.ensureSystemPrompt === undefined && patch.ensure_system_prompt !== undefined) patch.ensureSystemPrompt = patch.ensure_system_prompt;
      delete patch.force_stream;
      delete patch.ensure_system_prompt;
      const merged = normService({
        ...prev, ...patch, id,
        kind: pick(rawKind, prev.kind, DEFAULT_SERVICE_KIND),   // ★ 新建给默认适配器；更新时保留原值
        target: pick(svc.target, prev.target, 'model'),
        // ★★ 2026-10-10 追加（标准 §4）：`capability`（已显式校验；缺省回落 `llm`）与 `enabled`（缺省 true）。
        capability: pick(rawCap, prev.capability, 'llm'),
        enabled: (patch.enabled !== undefined ? !!patch.enabled
          : (prev.enabled !== undefined ? prev.enabled : true)),
      });
      const services = st.services.slice();
      if (idx >= 0) services[idx] = merged; else services.push(merged);
      const active = strOr(pick(st.active, id));
      const r = saveStore({ ...st, services, active });
      if (!r.ok) return { ok: false, error: r.error || { kind: 'config', message: '保存算力服务失败' } };
      if (svc.active === true) {                          // ★ 「保存并设为当前」⇒ 复用**切换**入口（单一写 active 处）
        const a = setActiveService(id);
        if (!a.ok) return a;
        return { ok: true, service: maskedService(merged, true), active: id };
      }
      return { ok: true, service: maskedService(merged, merged.id === active), active };
    });
  } catch (e) {
    return { ok: false, error: { kind: 'unknown', message: `保存算力服务失败：${(e && e.message) || e}` } };
  }
}

/**
 * ★★ **删除一套算力服务**。★ 删的若是**当前生效**的那套 ⇒ 自动切到剩下的第一套（都删光 ⇒ 空）。
 * @returns {{ok:true,deleted:string,active:string}|{ok:false,error:{kind,message}}} ★ **永不抛**。
 */
export function deleteService(id) {
  try {
    const key = String(id ?? '');
    // ★★ 2026-10-10 修（RISK-05）：整个「读 → 改 → 写」放进跨进程临界区（见 `withOverrideLock`）。
    return withOverrideLock(() => {
      const st = loadStore();
      if (!st.services.some((x) => x.id === key)) {
        return { ok: false, error: { kind: 'config', message: `找不到算力服务「${key}」` } };
      }
      const services = st.services.filter((x) => x.id !== key);
      const cur = getActiveService();                     // ★ 复用 getActiveService：判断删的是不是当前那套
      // ★★ 2026-10-10 订正（标准 §4）：删掉当前那套后，改由 `pickActiveId` 选（**跳过 `enabled:false`**）。
      const active = (cur && cur.id === key) ? pickActiveId(services, '') : st.active;
      const r = saveStore({ ...st, services, active });
      if (!r.ok) return { ok: false, error: r.error || { kind: 'config', message: '删除算力服务失败' } };
      return { ok: true, deleted: key, active };
    });
  } catch (e) {
    return { ok: false, error: { kind: 'unknown', message: `删除算力服务失败：${(e && e.message) || e}` } };
  }
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
  applyAuthHeader(h, cfg);
  if (cfg.kind === 'anthropic') h['anthropic-version'] = h['anthropic-version'] || anthropicVersion(cfg);
  return h;
}

/**
 * ★★ 2026-10-10 追加（标准 §5）：`anthropic` 适配器要用的 `anthropic-version` 头值。
 *   `extra.anthropic_version` 显式给值优先，否则缺省 `2023-06-01`（照参考 `anthropic.py`）。
 */
function anthropicVersion(cfg) {
  return strOr(cfg.extra && cfg.extra.anthropic_version).trim() || '2023-06-01';
}

/**
 * ★★ 2026-10-10 追加（标准 §5）：`custom`（我方 generic 等价物）的鉴权头名 / 前缀。
 *   · `auth_header` 缺省 `Authorization`；
 *   · `auth_scheme` 缺省 `"Bearer "`；★ 显式设 `""` ⇒ **原样发 key**（不加前缀）。
 */
function customAuth(cfg) {
  const ex = isPlainObj(cfg.extra) ? cfg.extra : {};
  const header = strOr(ex.auth_header).trim() || 'Authorization';
  const scheme = ex.auth_scheme === undefined ? 'Bearer ' : String(ex.auth_scheme);
  return { header, scheme };
}

/**
 * 给请求头加鉴权：`anthropic` 用 `x-api-key`；`custom` 支持 `extra.auth_header` / `extra.auth_scheme`；
 * 其余（openai-compatible / workbuddy-gateway）用 `Authorization: Bearer <key>`。
 * ★ 逐字保留既有行为：`anthropic` 覆盖 `x-api-key`；openai-compatible 覆盖 `Authorization`；
 *   `custom` 仅在目标头**未被用户显式设置**时写入（与改前 `!headers.Authorization` 同义）。
 */
function applyAuthHeader(headers, cfg) {
  if (cfg.kind === 'anthropic') {
    if (cfg.apiKey) headers['x-api-key'] = cfg.apiKey;
    return headers;
  }
  if (cfg.apiKey) {
    if (cfg.kind === 'custom') {
      const { header, scheme } = customAuth(cfg);
      if (!headers[header]) headers[header] = `${scheme}${cfg.apiKey}`;
    } else {
      headers.Authorization = `Bearer ${cfg.apiKey}`;
    }
  }
  return headers;
}

/**
 * ★★ 2026-10-10 追加（标准 §5）：`custom` 的**请求方法** —— `extra.method`（大写化）优先，缺省 `POST`。
 *   ★ 非 `custom` 适配器**恒 `POST`**（其协议固定）⇒ 既有行为逐字不变。
 */
function requestMethod(cfg) {
  if (cfg.kind !== 'custom') return 'POST';
  return strOr(cfg.extra && cfg.extra.method).trim().toUpperCase() || 'POST';
}

/** 取最后一条 user 消息的**文本**（`{{prompt}}` 占位符用；数组内容拼接其中的 text 块）。 */
function lastUserTextOf(msgs) {
  for (let i = (msgs || []).length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m && m.role === 'user') return contentTextOf(m.content);
  }
  return '';
}

/** 拼接全部 system 消息文本（`{{system}}` 占位符用）。 */
function systemTextOf(msgs) {
  const parts = [];
  for (const m of (msgs || [])) {
    if (m && m.role === 'system') { const t = contentTextOf(m.content); if (t) parts.push(t); }
  }
  return parts.join('\n\n');
}

/** 内容块 → 文本（字符串原样；数组拼接其中 `text` 块）。 */
function contentTextOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((b) => (b && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('');
  }
  return '';
}

/**
 * ★★ 2026-10-10 追加（标准 §5）：按 `extra.body_template` 渲染 `custom` 请求体。
 *   占位符（照参考 `generic.py`）：`{{model}}` / `{{messages}}` / `{{prompt}}` / `{{system}}` ——
 *   既作「整值」（`{{messages}}` ⇒ 替换为消息数组），也可内嵌在字符串里（仅标量 model/prompt/system）。
 */
function renderBodyTemplate(tpl, ctx) {
  if (Array.isArray(tpl)) return tpl.map((x) => renderBodyTemplate(x, ctx));
  if (isPlainObj(tpl)) {
    const out = {};
    for (const [k, v] of Object.entries(tpl)) out[k] = renderBodyTemplate(v, ctx);
    return out;
  }
  if (typeof tpl === 'string') {
    const s = tpl.trim();
    if (s === '{{messages}}') return JSON.parse(JSON.stringify(ctx.messages || []));
    if (s === '{{model}}' || s === '{{prompt}}' || s === '{{system}}') return ctx[s.slice(2, -2)];
    let out = tpl;
    for (const tok of ['model', 'prompt', 'system']) out = out.split(`{{${tok}}}`).join(strOr(ctx[tok]));
    return out;
  }
  return tpl;
}

/**
 * ★★ **该请求体要不要带 `model`**（由「接入对象类型 `target`」决定；见文件头与契约 §十二 / §十五）。
 *   · `target === 'model'`（底层基础算力 API）⇒ **恒 `true`** —— 模块**主动指定**服务标识，请求体**必带 `model`**。
 *   · `target === 'agent'`（智能体 API）⇒ ★★ **恒 `false`（不看 `kind`）** —— 面板填的模型名**仅作本地备注**，
 *     **绝不下发 `model`**，以免参数覆盖**干扰智能体内部的模型调度逻辑**（规格原文）。
 *     ★★ **2026-10-09 修正（委托方澄清，见契约 §十五）**：**取消**原先的「`agent + anthropic` 例外」——
 *        委托方明确定义「本模块**不向智能体下发任何 model 模型参数**，避免多余参数引发 HTTP 400」，
 *        ★ **只要智能体本身处于正常运行状态，模块只需保障连通**，不需要模块指定模型。
 *        ⇒ 那个「不带 model 就 400」的端点，其**性质是模型 API**（要求 model）⇒ 正确处置是
 *        **如实报错「该端点不接受智能体模式」**（见 `isModelRequiredError` / `agentModelHint`），
 *        **而不是**「偷偷把 model 带上去」（那就等于违反定义）。
 */
function shouldSendModel(cfg) {
  return cfg.target !== 'agent';              // 智能体 API：**绝不下发** model（不看 kind）；模型 API：必带
}

/**
 * ★★ 2026-10-09 追加（委托方澄清）：**判断端点的拒绝是否属于「要求 `model`」**。
 *   · 只在 **400 / 422** 上判定（其余状态码走既有 `httpErrorKind` 归一，不动）。
 *   · 命中特征（各家中继 / 网关的常见措辞，中英都收）：
 *     `Model name not specified` / `model name cannot be empty` / `model is required` / `missing model` /
 *     `模型不能为空` / `未指定模型` / `缺少 model` …
 *   ★ 用途：`agent` 模式下探针**不带 model** 若被端点以「要求 model」拒绝 ⇒ 归一为明确的 `config` 错 +
 *     中文 hint（说明「该端点更像底层基础算力 API，不是智能体 API」），**绝不**把 model 自动加回去。
 */
const MODEL_REQUIRED_RE = /model\s*name\s*(?:not\s+specified|is\s+required|required|cannot\s+be\s+empty|must\s+not\s+be\s+empty)|model\s+(?:is\s+)?(?:required|missing|not\s+specified|not\s+provided|must\s+be\s+provided)|(?:missing|no)\s+model|(?:缺少|未指定|未提供|必须提供|不能为空).{0,8}model|model.{0,8}(?:不能为空|必填|必须|缺失|未指定)/i;
function isModelRequiredError(status, text) {
  if (status !== 400 && status !== 422) return false;
  return MODEL_REQUIRED_RE.test(String(text || ''));
}

/**
 * ★★ 2026-10-09 追加（委托方澄清）：`agent` 模式被端点以「要求 `model`」拒绝时的**中文 hint**。
 *   ★ 根因说清：要求 `model` 的端点**性质是底层基础算力 API**（模块必须主动指定服务标识），
 *     **不是智能体 API**（智能体自带内部模型调度，模块不该指定）。
 *   ★ 出路两条：改用该智能体的**服务入口**；或把接入对象 `target` 改成「底层基础算力 API」。
 */
function agentModelHint(status) {
  return `该端点要求 model（HTTP ${status}）⇒ 它更像「底层基础算力 API」，不是「智能体 API」；`
    + '请改用该智能体的服务入口，或把接入对象改成「底层基础算力 API」。';
}

// ═══════════════════════════════════════════════════════════════════════════
// ── ★★ 智能体网关适配器（`kind:'workbuddy-gateway'`）—— 2026-10-09 追加（见契约 §十六）──
// ═══════════════════════════════════════════════════════════════════════════
//   ★ 为什么单列一个 kind（而不是复用 `custom` / `anthropic`）：
//     · 本机网关（CodeBuddy Gateway，`gatewayMode:"local"`）**没有** `/v1/messages`（全量路由已核对）
//       ⇒ `anthropic` 适配器**打不通**；
//     · 它是**两段式**：① `POST {base}/api/v1/runs` → `202 {"data":{"runId":…,"status":"accepted"}}`；
//       ② `GET {base}/api/v1/runs/{runId}/stream`（SSE）→ 增量文本。
//       `custom` 只做「一次 POST + 按点分路径取值」，**表达不了第二段** ⇒ 需要独立适配器。
//   ★★ 端点与口令**一律运行时发现**（`gatewayBaseFromEnv` / `gatewayKeyFromEnv`），**绝不硬编码端口**：
//     端口来自宿主注入的 `SERVER__PORT`（本机 11760），主机来自 `SERVER__HOST`（缺省 127.0.0.1）。
//   ★★ 口令（`CODEBUDDY_GATEWAY_PASSWORD`）**只从环境取** —— **绝不**写进代码 / 日志 / 文件（契约 §四）。
//   ★★ 「不向智能体下发 model」「不发起任何模型相关请求」照旧成立：
//     · 请求体**绝不出现 `model`**（`shouldSendModel` 恒 false，agent 模式不看 kind）；
//     · 适配器**只打** `/api/v1/runs*` 与 `/api/v1/health`，**绝不**试探 `/v1/models` 之类。
//   ★ 取文本：SSE `event: message` 帧的 `data` 是「Gateway Protocol 出站消息」
//     （`{version,replyTo,status,content}`）——`status:'streaming'` 带 `content.chunk`（增量），
//     末帧 `status:'completed'` 带 `content.markdown`（全文）⇒ **优先** markdown，缺则拼接 chunk。
//   ★ 有界：run + 流**共用** `cfg.timeoutMs`（`AbortController` + `finally` 里 `clearTimeout`）；
//     超时 ⇒ 归一为 `timeout`，**不抛**（与 `chat()` 同纪律）。
/** 网关「发起执行」的路径（结果流 = 该路径 + `/{runId}/stream`）。 */
const GATEWAY_RUN_PATH = '/api/v1/runs';
/** 网关**只读**健康检查路径（准入探针用 —— ★ **绝不**用 `POST /api/v1/runs` 探活：那会真发起 Agent 执行）。 */
const GATEWAY_HEALTH_PATH = '/api/v1/health';
/**
 * 调用方身份（网关协议要求 `sender.id` 必填）。★ **稳定常量**（不随机）：网关按它做限流键，
 * 稳定才可复现、也才是「同一个调用方」的语义。★ 这里**不含任何密钥**。
 */
const GATEWAY_SENDER = Object.freeze({ id: 'lemo-tools', name: 'lemo-tools' });

/**
 * ★ 网关 baseUrl 的**运行时发现**（★ 绝不硬编码端口）。
 * 端口 = `SERVER__PORT`（宿主注入；★ 缺失 ⇒ 返回 undefined ⇒ 上层明确报「缺 baseUrl」）；
 * 主机 = `SERVER__HOST`（缺省 `127.0.0.1`）。
 */
function gatewayBaseFromEnv() {
  const port = process.env.SERVER__PORT;
  if (isBlank(port)) return undefined;
  const host = isBlank(process.env.SERVER__HOST) ? '127.0.0.1' : String(process.env.SERVER__HOST);
  return `http://${host}:${port}`;
}
/** ★ 网关口令：**只从环境取**（契约 §四：绝不写进代码 / 日志 / 文件）。 */
function gatewayKeyFromEnv() {
  const v = process.env.CODEBUDDY_GATEWAY_PASSWORD;
  return isBlank(v) ? undefined : String(v);
}

/**
 * ★★ **该配置是否要求 `model` 非空**（= 模块会把 `model` 写进请求体、且适配器需要它）。
 *   · 定义 = `(kind === 'anthropic' || kind === 'openai-compatible') && shouldSendModel(cfg)`：
 *     - ★★ **`target === 'agent'`（智能体 API）⇒ 恒 `false`（不看 kind）** —— 委托方定义：模块**不向智能体
 *       下发任何 model**（`shouldSendModel` 恒 false）⇒ **取消**原「`agent + anthropic` 例外」（见契约 §十五）。
 *     - `anthropic` / `openai-compatible` 且 `target === 'model'`（底层基础算力 API）⇒ **要求非空**；
 *     - `custom`：**不要求** —— 它是「厂商私有接口」的通用出口，请求体由调用方自定（`custom` 的内置 `model` 为 `''`，
 *       既有单测「chat() custom：自定义 path + extract」即**不带 model** 也能接）。
 *   ★ 与 `validate()` 原先内联的 `needsModel` **逐字同义** ⇒ 本批把它提为函数，**消除两份口径**（防止漂移）。
 *   ★ 用途：`validate()` 的「缺 model」预检 + `invoke()` / `chat()` 的「基础算力缺服务标识」明确报错，**共用同一条判定**。
 */
function needsModel(cfg) {
  if (cfg.kind !== 'anthropic' && cfg.kind !== 'openai-compatible') return false;
  return shouldSendModel(cfg);
}

/** 按 kind 构造一次对话请求。
 *  ★ 2026-10-08 追加 `temperature`（本批**唯一**对模块的能力补充；见文件头「对契约的修正」与
 *    `lib/triple-check.mjs` 的迁移报告）：把调用方**显式给**的 `temperature` 透传进请求体。
 *    ★ **只在 `temperature !== undefined` 时写入** ⇒ 未给值的既有路径（纯文本 / validate 探针）
 *      请求体**逐字节不变**（`test/llm-api.test.mjs` 的「纯文本回归」金标仍逐字节相等）。
 *    ★ **不**新增任何 `LEMO_LLM_*` 环境变量、**不**读覆盖文件 —— 以免动到契约 §二 的 6 个覆盖点。
 *  ★★ 2026-10-08 追加 `target`（见契约 §十二）：`target === 'agent'` 时，**请求体里不出现 `model`**
 *    （`shouldSendModel`；★ 2026-10-09 起**三种 kind 一律如此**，取消 anthropic 例外，见契约 §十五）；
 *    ★ `target === 'model'`（默认）时**逐字节不变**（有单测钉住）。 */
function buildRequest(cfg, messages, { maxTokens, temperature } = {}) {
  const headers = { 'Content-Type': 'application/json', ...cfg.headers };
  const withModel = shouldSendModel(cfg);             // ★ agent 模式绝不下发 model（三种 kind 一律）
  const method = requestMethod(cfg);                  // ★ 2026-10-10（§5）：custom 可用 extra.method；其余恒 POST
  let url;
  let body;
  if (cfg.kind === 'anthropic') {
    url = joinUrl(cfg.baseUrl, '/v1/messages');       // ★ 2026-10-10（§11.8）：改走 joinUrl（去重版本段）
    applyAuthHeader(headers, cfg);
    // ★ 2026-10-10（§5）：`anthropic-version` 可由 `extra.anthropic_version` 覆盖（缺省 2023-06-01）。
    headers['anthropic-version'] = headers['anthropic-version'] || anthropicVersion(cfg);
    body = withModel
      ? { model: cfg.model, max_tokens: maxTokens ?? 1024, messages }
      : { max_tokens: maxTokens ?? 1024, messages };
  } else if (cfg.kind === 'custom') {
    url = joinUrl(cfg.baseUrl, cfg.path || '/chat/completions');   // ★ 2026-10-10（§11.8）
    // ★ 2026-10-10（§5）：custom 支持 `extra.auth_header` / `extra.auth_scheme`（缺省 Authorization / Bearer）。
    applyAuthHeader(headers, cfg);
    // ★ 2026-10-10（§5）：`extra.body_template` 给了对象 ⇒ 按模板渲染（占位符 {{model}}/{{messages}}/
    //   {{prompt}}/{{system}}）；否则用既有默认体（逐字节不变）。
    const tpl = cfg.extra && cfg.extra.body_template;
    if (isPlainObj(tpl)) {
      const ctx = { model: cfg.model, messages, prompt: lastUserTextOf(messages), system: systemTextOf(messages) };
      const rendered = renderBodyTemplate(tpl, ctx);
      body = isPlainObj(rendered) ? rendered : {};
      if (!withModel) delete body.model;              // ★ agent 模式：模板里即便有 model 也删掉
      if (maxTokens) body.max_tokens = maxTokens;
    } else {
      body = withModel ? { model: cfg.model, messages, stream: false } : { messages, stream: false };
      if (maxTokens) body.max_tokens = maxTokens;
    }
  } else {                                            // openai-compatible
    url = joinUrl(cfg.baseUrl, '/chat/completions');   // ★ 2026-10-10（§11.8）
    applyAuthHeader(headers, cfg);
    body = withModel ? { model: cfg.model, messages, stream: false } : { messages, stream: false };
    if (maxTokens) body.max_tokens = maxTokens;
  }
  if (temperature !== undefined) body.temperature = temperature;   // ★ 仅在显式给值时写入（见函数头注释）
  return { url, headers, body: JSON.stringify(body), method };
}

/**
 * 底层 HTTP：带超时的 fetch。★ 超时用 `AbortController`，`finally` 里**必须** `clearTimeout`。
 * ★★ 2026-10-09 追加 `binary`（供 `invoke('audio', …)` 取**音频字节流**）：`binary:true` 且响应 2xx 时，
 *   用 `arrayBuffer()` 取**原始字节**（`bytes`），不 `text()`（二进制当文本读会损坏）；**非 2xx 时仍读文本**
 *   （错误体通常是 JSON / 文本，要留作 `detail`）。★ `binary` 默认 `false` ⇒ 既有调用路径**逐字节不变**。
 * @returns {Promise<{net:true,status:number,resOk:boolean,text:string,bytes?:Buffer,contentType?:string,ms:number}
 *                  | {net:false,timedOut:boolean,error:any,ms:number}>}
 */
async function httpRequest(url, { method = 'POST', headers = {}, body = null, timeoutMs = DEFAULT_TIMEOUT_MS, binary = false } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1, timeoutMs));
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method, headers, body: body == null ? undefined : body, signal: ac.signal });
    if (binary && res.ok) {                           // ★ 二进制响应（音频等）：取原始字节，不按文本读
      const bytes = Buffer.from(await res.arrayBuffer());
      return { net: true, status: res.status, resOk: res.ok, text: '', bytes, contentType: res.headers.get('content-type') || '', ms: Date.now() - t0 };
    }
    const text = await res.text();                    // ★ 先 text() 再自己 JSON.parse（不让 res.json() 抛出去）
    return { net: true, status: res.status, resOk: res.ok, text, ms: Date.now() - t0 };
  } catch (e) {
    const timedOut = ac.signal.aborted || (e && e.name === 'AbortError');
    return { net: false, timedOut, error: e, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);                              // ★★ 不清理定时器 ⇒ 进程挂住（本项目踩过）
  }
}

/**
 * ★★ **自动重试的「该不该重试」判据** —— 2026-10-10 追加（规格 §5）。
 *   · **网络层失败** ⇒ 看是否**瞬态**：**超时 / 连接被重置 / socket 层错** ⇒ **可重试**；
 *     ★ **地址 / 路由 / 服务未起**类（`ECONNREFUSED` / `ENOTFOUND` / `EAI_AGAIN` / `EHOSTUNREACH` /
 *     `ENETUNREACH`）⇒ **不重试** —— 那几类**重发无益**，只会把「连不上」拖成更久的等待，
 *     而用户**此刻就需要**这条明确错误（★ 与「不许让重试掩盖真错误」同一纪律）。
 *   · **HTTP 非 2xx** ⇒ **只**重试 `RETRYABLE_STATUS`（408 / 425 / 429 / 5xx —— 瞬态 / 服务端错）；
 *   · ★★ **4xx 鉴权 / 参数错（401 / 403 / 400 / 404 / 422 …）⇒ 一律不重试** —— 重试只会把
 *     「鉴权失败」拖成「超时」，**掩盖真错误**（规格明令：**不许**让重试掩盖真错误）。
 *   ★ 只判「拿到 HTTP 响应之前 / 之时」；`bad-json` / `bad-shape` / `empty-output` 是**已成功拿到 2xx
 *     响应之后**的语义判定 ⇒ **不重试**（重试改变不了结果，只会白等）。
 */
function netErrorRetryable(e, timedOut) {
  if (timedOut) return true;                          // 超时 ⇒ 可重试
  const cause = e && e.cause;
  const code = (cause && cause.code) || (e && e.code);
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) return false;
  const msg = String((e && e.message) || e || '');
  if (/getaddrinfo|ENOTFOUND|EAI_AGAIN/i.test(msg)) return false;
  return true;                                        // 其余网络失败（连接重置 / socket / 未知）⇒ 可重试
}
function shouldRetryResult(r) {
  if (r.net) return r.resOk ? false : RETRYABLE_STATUS.includes(r.status);
  return netErrorRetryable(r.error, r.timedOut);      // 网络层失败 ⇒ 只重试**瞬态**那几种
}

/**
 * ★★ **带自动重试的 HTTP 请求** —— 2026-10-10 追加（规格 §5）。
 * ★★ **总耗时受 `opts.timeoutMs` 约束**（★ 关键：重试**不把超时放大成 N 倍**）——
 *   预算算法：`deadline = now + timeoutMs`（**整段**，含所有重试与退避）；每次尝试的**单次**超时
 *   = `min(timeoutMs, deadline - now)`；退避也**夹在**剩余预算内；预算耗尽 ⇒ 立即返回最后一次结果
 *   （或一个合成的 `timeout` 结果）⇒ **无论重试几次，总耗时 ≤ `timeoutMs`（+ 微秒级开销）**。
 * ★ 退避 = 指数 `backoffMs * 2^(n-1)`（`n` 从 1 起），上限夹到剩余预算。
 * ★ 只重试**幂等可重试**的失败（见 `shouldRetryResult`）；**不重试** 4xx 鉴权 / 参数错。
 * @returns {Promise<object>} 与 `httpRequest` 同形，另带 `attempts`（**真实发出的请求次数**，供观测 / 自证）。
 */
async function httpRequestRetry(url, opts = {}) {
  const retry = clampRetry(DEFAULT_RETRY);
  const backoffMs = clampBackoff(DEFAULT_RETRY_BACKOFF_MS);
  const budgetMs = Math.max(1, Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const deadline = Date.now() + budgetMs;
  let attempt = 0;
  let last = null;
  for (;;) {
    const remain = deadline - Date.now();
    if (remain <= 0) break;                            // ★ 预算耗尽 ⇒ 不再发新请求（总耗时**有界**）
    last = await httpRequest(url, { ...opts, timeoutMs: Math.min(budgetMs, remain) });
    attempt += 1;
    if (attempt > retry || !shouldRetryResult(last)) break;
    const wait = Math.min(backoffMs * (2 ** (attempt - 1)), Math.max(0, deadline - Date.now()));
    if (wait > 0) await sleep(wait);
  }
  if (last) return { ...last, attempts: attempt };
  return {
    net: false, timedOut: true, ms: budgetMs, attempts: attempt,
    error: new Error(`请求超时（${budgetMs}ms，重试预算已耗尽）`),
  };
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
 * 按适配器取文本。返回 `{text, path, present}`（`text` 非字符串 ⇒ 视为取不到文本）。
 * ★ 扩充（2026-10-08 **真实实测**，不改契约字段名）：`anthropic` 形状的响应可能把
 *   **非文本块**（如 `thinking`）放在 `content[0]`，此时契约的 `content.0.text` 取不到字符串。
 *   ⇒ 退一步扫 `content[]`，取**第一个带字符串 `text` 的块**。实测命中：某中转对
 *   `max_tokens:1` 返回 `content:[{type:'text',text:''}]`（空文本，见 validate 的探针升级）。
 * ★ 扩充（2026-10-10，**对齐参考 §11.9**）：新增 `present` —— 路径**是否取到了有定义的值**。
 *   `text` / `path` 的既有含义**不变**（既有调用方仍按原样用）。
 */
function extractText(cfg, json) {
  const p = extractPath(cfg);
  const v = getPath(json, p);
  // ★ 对齐参考 §11.9：`present` = 路径**是否取到了一个「有定义」的值**。
  //   · 取到字符串 ⇒ present:true；
  //   · 取到 `null`（或其它有定义但非字符串的值）⇒ present:true（★ 这是推理型模型小预算下的典型形态）；
  //   · 路径取不到（`undefined`）⇒ present:false。
  //   ★ 严格用 `v !== undefined` 判定，**绝不能写 `!v`** —— 那会把 `null` / `0` / `''` 都误算成「取不到」。
  const present = v !== undefined;
  if (typeof v === 'string') return { text: v, path: p, present: true };
  if (cfg.kind === 'anthropic' && json && Array.isArray(json.content)) {
    const blk = json.content.find((b) => b && typeof b === 'object' && typeof b.text === 'string');
    if (blk) return { text: blk.text, path: `${p}（回退 content[].text）`, present: true };
  }
  return { text: undefined, path: p, present };
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

// ═══════════════════════════════════════════════════════════════════════════
// ── ★★ 通用算力入口（invoke）—— 2026-10-09 追加（见契约 §十三）─────────────
// ═══════════════════════════════════════════════════════════════════════════
//   ★ 本模块原先只有 `chat()`（把「AI 算力」窄化成「LLM 对话」）⇒ v3 要求泛化为「通用 AI 算力 API 接入」。
//   ⇒ 新增 `invoke(task, params, opts)`，按 `task` 分发；`chat()` 内部改为走 `invoke('chat', …)`。
//   ★ `TASKS` 表 = 「每类算力：请求怎么拼（build）/ 结果怎么取（extract）/ 怎么判合法性（其内校验）」。
//   ★★ **不确定的厂商形态**：一律走 `task:'custom'`（自配 `path` + `headers` + `extract`），**不硬编造**私有格式。
//      内置的 image / audio / embedding 形状**只覆盖公开且常见**的形态（OpenAI 公开文档形状 / Anthropic 无对应接口）。

/** 请求头（按 kind 加鉴权；invoke 的各 task 共用）。★ 与 `buildRequest` 同义，但**不复用**它以免动到 chat 的逐字节金标。
 *  ★★ 2026-10-10（标准 §5）：`custom` 支持 `extra.auth_header` / `extra.auth_scheme`；
 *     `anthropic` 的 `anthropic-version` 可由 `extra.anthropic_version` 覆盖。其余逐字不变。 */
function baseHeaders(cfg) {
  const headers = { 'Content-Type': 'application/json', ...cfg.headers };
  if (cfg.kind === 'anthropic') {
    if (cfg.apiKey) headers['x-api-key'] = cfg.apiKey;
    headers['anthropic-version'] = headers['anthropic-version'] || anthropicVersion(cfg);
  } else if (cfg.kind === 'custom') {
    if (cfg.apiKey) {
      const { header, scheme } = customAuth(cfg);
      if (!headers[header]) headers[header] = `${scheme}${cfg.apiKey}`;
    }
  } else if (cfg.apiKey && !headers.Authorization) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }
  return headers;
}

/** `image` 的结果：从 `data[]` / `images[]` / `cfg.extract` 里取图（`url` / `b64_json` / `base64`）。 */
function extractImages(cfg, json) {
  let arr = null;
  if (cfg.extract) {
    const v = getPath(json, cfg.extract);
    if (Array.isArray(v)) arr = v;
    else if (typeof v === 'string' && v.trim()) return { ok: true, result: { images: [v] } };
  }
  if (!arr) {
    for (const key of ['data', 'images', 'output', 'outputs']) {
      if (Array.isArray(json && json[key])) { arr = json[key]; break; }
    }
  }
  if (!arr) {
    const one = (json && json.data) || json || {};
    const u = one && (one.url || one.b64_json || one.base64);
    if (typeof u === 'string' && u.trim()) return { ok: true, result: { images: [u] } };
    return { ok: false, kind: 'bad-shape', message: '响应里取不到图像结果（期望 data[] / images[] 里的 url / b64_json）' };
  }
  const images = arr.map((it) => {
    if (typeof it === 'string') return it;
    if (it && typeof it === 'object') return it.url || it.b64_json || it.base64 || it.data;
    return undefined;
  }).filter((s) => typeof s === 'string' && s.trim());
  if (!images.length) return { ok: false, kind: 'bad-shape', message: '响应里的图像数组为空 / 元素非法' };
  return { ok: true, result: { images } };
}

/** `embedding` 的结果：从 `data[].embedding` / `cfg.extract` 里取向量（数组的数组）。
 *  ★ 2026-10-09 收紧：一条「向量」= **非空**且**元素全为数字**的数组（契约 §13.2）——
 *    原判据只查 `Array.isArray(v) && v.length`，会把 `{embedding:[…]}` 这样的**对象**或
 *    `['a','b']` 这样的**字符串数组**误当向量（第 7 轮审计 A3）。**不**校验维度相等（契约未要求，会误伤真实厂商）。 */
function extractVectors(cfg, json) {
  const isVec = (v) => Array.isArray(v) && v.length && v.every((x) => typeof x === 'number');
  let arr = null;
  if (cfg.extract) {
    const v = getPath(json, cfg.extract);
    if (Array.isArray(v)) arr = (v.length && Array.isArray(v[0])) ? v : [v];
  }
  if (!arr && Array.isArray(json && json.data)) {
    arr = json.data.map((d) => (d && typeof d === 'object' ? d.embedding : d));
  }
  if (!arr) return { ok: false, kind: 'bad-shape', message: '响应里取不到向量（期望 data[].embedding）' };
  const vectors = arr.filter(isVec);
  if (!vectors.length) return { ok: false, kind: 'bad-shape', message: '向量数组为空 / 元素非法' };
  return { ok: true, result: { vectors } };
}

/** `audio`（JSON 模式）的结果：取 `cfg.extract`（默认 `data.0.url`）或常见的 audio/url/b64 字段。 */
function extractAudio(cfg, json) {
  const p = cfg.extract || 'data.0.url';
  const v = getPath(json, p);
  if (typeof v === 'string' && v.trim()) return { ok: true, result: { audio: v } };
  for (const key of ['audio', 'url', 'b64_json', 'base64', 'data']) {
    const x = json && json[key];
    if (typeof x === 'string' && x.trim()) return { ok: true, result: { audio: x } };
  }
  return { ok: false, kind: 'bad-shape', message: `响应里取不到音频（路径 ${p}）` };
}

/** `custom`（通用出口）的结果：取 `cfg.extract`（默认 `choices.0.message.content`）指向的任意值。 */
function extractValue(cfg, json) {
  const p = cfg.extract || 'choices.0.message.content';
  const v = getPath(json, p);
  if (v === undefined) return { ok: false, kind: 'bad-shape', message: `响应里取不到值（路径 ${p}）` };
  return { ok: true, result: { value: v } };
}

/**
 * ★★ 通用算力任务表（task → { build, extract }）。★ 新增算力类型只需在此加一项（**不改** `invoke` 主流程）。
 *   · `build(cfg, params, opts)` → `{ok:true,url,headers,body,secrets?,binary?}` | `{ok:false,kind,message}`；
 *   · `extract(cfg, json)` → `{ok:true,result}` | `{ok:false,kind,message}`（`result` 形状见各函数）。
 *   ★ **`chat` 不在此表**：文本推理的**完整实现**在 `chat()`（多模态预处理 / 错误归一**一字未动**）——
 *     `invoke('chat', …)` 只是把它归一成通用返回形状（见 `invoke` 的 `chat` 分支）。
 */
const TASKS = Object.freeze({
  // ① 图像生成 —— openai-compatible：POST /images/generations，取 data[].url / b64_json（公开形状）；
  //    custom：自配 path + extract（**不确定的厂商一律走这里**）；anthropic：无此接口 ⇒ config 错。
  //    ★★ 2026-10-10 二次订正（**保留原句**）：模块已按《通用 AI 算力 API 接入模块》规格重建为**开放式** ——
  //       面板**现提供** `openai-compatible` / `anthropic` / `custom` / `workbuddy-gateway` 四个 kind 入口
  //       ⇒ 下面三处 `message` 末尾原有的「本软件只接 WorkBuddy，面板已无 openai-compatible / custom 入口」
  //       与面板**直接矛盾**，已删；首句（anthropic 无该接口 ⇒ 改用 openai-compatible / custom）在新方向下**本来就对**，保留。
  image: {
    build(cfg, params) {
      if (cfg.kind === 'anthropic') {
        return { ok: false, kind: 'config', message: 'anthropic 适配器没有图像生成接口：图像请用 openai-compatible（/images/generations）或 custom（自配 path + extract）。' };
      }
      const prompt = params.prompt ?? params.input;
      if (isBlank(prompt)) return { ok: false, kind: 'config', message: 'image 任务缺少 prompt' };
      const body = {};
      if (shouldSendModel(cfg) && cfg.model) body.model = cfg.model;   // ★ 空 model 不写入（custom 等 model 可选的适配器）
      body.prompt = String(prompt);
      if (params.n !== undefined) body.n = params.n;
      if (params.size !== undefined) body.size = params.size;
      if (params.responseFormat !== undefined) body.response_format = params.responseFormat;
      const url = cfg.kind === 'custom'
        ? joinUrl(cfg.baseUrl, cfg.path || '/images/generations') : joinUrl(cfg.baseUrl, '/images/generations');
      return { ok: true, url, headers: baseHeaders(cfg), body: JSON.stringify(body) };
    },
    extract: extractImages,
  },
  // ③ 语音合成 —— openai-compatible：POST /audio/speech，响应是**音频字节流**（binary）⇒ result.audio = base64；
  //    custom：默认按 JSON 取（`cfg.extract`），可 `opts.binary:true` 改走字节流；anthropic：无此接口 ⇒ config 错。
  audio: {
    build(cfg, params, opts) {
      if (cfg.kind === 'anthropic') {
        return { ok: false, kind: 'config', message: 'anthropic 适配器没有语音接口：语音请用 openai-compatible（/audio/speech）或 custom（自配 path + extract）。' };
      }
      const input = params.input ?? params.text;
      if (isBlank(input)) return { ok: false, kind: 'config', message: 'audio 任务缺少 input（或 text）' };
      const body = {};
      if (shouldSendModel(cfg) && cfg.model) body.model = cfg.model;   // ★ 空 model 不写入（custom 等 model 可选的适配器）
      body.input = String(input);
      if (params.voice !== undefined) body.voice = params.voice;
      if (params.format !== undefined) body.response_format = params.format;
      const url = cfg.kind === 'custom'
        ? joinUrl(cfg.baseUrl, cfg.path || '/audio/speech') : joinUrl(cfg.baseUrl, '/audio/speech');
      // ★ OpenAI /audio/speech 返回的是**音频字节流**（非 JSON）⇒ openai-compatible 默认走 binary；custom 默认 JSON。
      const binary = opts.binary !== undefined ? !!opts.binary : cfg.kind === 'openai-compatible';
      return { ok: true, url, headers: baseHeaders(cfg), body: JSON.stringify(body), binary };
    },
    extract: extractAudio,
  },
  // ④ 向量计算 —— openai-compatible：POST /embeddings，取 data[].embedding；custom：自配 path + extract。
  embedding: {
    build(cfg, params) {
      if (cfg.kind === 'anthropic') {
        return { ok: false, kind: 'config', message: 'anthropic 适配器没有向量接口：向量请用 openai-compatible（/embeddings）或 custom（自配 path + extract）。' };
      }
      const input = params.input ?? params.text;
      if (input === undefined || input === null) return { ok: false, kind: 'config', message: 'embedding 任务缺少 input' };
      const body = {};
      if (shouldSendModel(cfg) && cfg.model) body.model = cfg.model;   // ★ 空 model 不写入（custom 等 model 可选的适配器）
      body.input = input;
      const url = cfg.kind === 'custom'
        ? joinUrl(cfg.baseUrl, cfg.path || '/embeddings') : joinUrl(cfg.baseUrl, '/embeddings');
      return { ok: true, url, headers: baseHeaders(cfg), body: JSON.stringify(body) };
    },
    extract: extractVectors,
  },
  // ⑤ 通用出口 —— 请求体由调用方自定（`params.body`，缺省用 `params` 本身）；`opts.path` / `cfg.path` 定路径；
  //    `cfg.extract` 定取值路径。★ **任何返回 JSON 的算力接口都能接**（不确定的厂商形态走这里）。
  custom: {
    build(cfg, params, opts) {
      const raw = params.body !== undefined ? params.body : params;
      const body = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const p = opts.path || cfg.path || params.path || '/chat/completions';
      // ★★ 2026-10-10 追加（标准 §5）：`custom` 出口也认 `extra.method`（非 custom 恒 POST，行为不变）。
      return { ok: true, url: joinUrl(cfg.baseUrl, p), headers: baseHeaders(cfg), body, method: requestMethod(cfg) };
    },
    extract: extractValue,
  },
});

/** `invoke` 的失败对象（与 `fail` 同形，另带 `task`）。 */
function invFail(task, kind, message, meta, detail, secrets) {
  const f = fail(kind, message, meta, detail, secrets);
  return { ok: false, task, error: f.error, meta };
}

/**
 * ★★ **通用 AI 算力入口**（2026-10-09 追加，见契约 §十三）。★ **永不抛**：任何失败归一为 `{ok:false,…}`。
 * @param {'chat'|'image'|'audio'|'embedding'|'custom'} task 算力类型（未知 ⇒ `config` 失败）
 * @param {object} [params] 该类型对应的入参：
 *   · `chat`      `{ messages, images?, maxTokens?, temperature? }`
 *   · `image`     `{ prompt, n?, size?, responseFormat? }`
 *   · `audio`     `{ input|text, voice?, format? }`（`opts.binary` 可强制字节流 / JSON）
 *   · `embedding` `{ input }`（字符串或字符串数组）
 *   · `custom`    `{ body }`（原样作为请求体；缺省用 `params` 本身）
 * @param {object} [opts] 同 `resolveConfig`（profile / baseUrl / apiKey / model / headers / timeoutMs / kind /
 *   path / extract / target / …），另可含 `binary`（audio 用）。
 * @returns {Promise<{ok:true,task,result,raw,meta}|{ok:false,task,error:{kind,message,httpStatus?,detail?},meta}>}
 *   `result` 形状按 task：chat→`{text}` / image→`{images:[…]}` / audio→`{audio,mime?}` /
 *   embedding→`{vectors:[…]}` / custom→`{value}`。
 */
export async function invoke(task, params = {}, opts = {}) {
  const taskName = String(task);
  const meta = { at: new Date().toISOString(), task: taskName };
  const p = params && typeof params === 'object' ? params : {};
  const o = opts && typeof opts === 'object' ? opts : {};
  // ★ task='chat' 委托给 `chat()`（文本推理的**完整实现**在 chat()；invoke 只把它归一成通用返回形状）。
  //   ★ 这样 `chat()` 的既有结构 / 错误归一 / 多模态预处理**一字未动** ⇒ 对外行为**逐字节不变**（向后兼容硬指标）。
  if (taskName === 'chat') {
    const c = await chat(p.messages, {
      ...o,
      images: p.images !== undefined ? p.images : o.images,
      maxTokens: p.maxTokens !== undefined ? p.maxTokens : o.maxTokens,
      temperature: p.temperature !== undefined ? p.temperature : o.temperature,
    });
    if (c.ok) return { ok: true, task: 'chat', result: { text: c.text }, raw: c.raw, meta: { ...c.meta, task: 'chat' } };
    return { ok: false, task: 'chat', error: c.error, meta: { ...c.meta, task: 'chat' } };
  }
  try {
    const spec = TASKS[taskName];
    if (!spec) {
      return invFail(taskName, 'config', `未知算力类型 task「${taskName}」（可用：chat / ${Object.keys(TASKS).join(' / ')}）`, meta);
    }
    const cfg = resolveConfig(o);
    Object.assign(meta, { profile: cfg.id, kind: cfg.kind, target: cfg.target, model: cfg.model, baseUrl: cfg.baseUrl });
    if (cfg.serviceId) meta.service = cfg.serviceId;    // ★ 2026-10-10：生效的「算力服务」id（无 ⇒ 不写）

    // ★★ 2026-10-10 追加（规格 §1/§4）：**按服务标识调用** —— 显式指定的服务必须**存在**（否则明确 config 错）。
    const wantService = String((o && o.service != null) ? o.service : '');
    if (wantService && !serviceById(wantService)) {
      return invFail(taskName, 'config', `找不到算力服务「${wantService}」：请先用 listServices() 查看已保存的服务 id`, meta);
    }
    // ★★ 2026-10-10 追加（多套服务）：覆盖文件**显式**声明「一套服务都没有」⇒ **优雅报错**（不是崩）。
    if (cfg.servicesEmpty) {
      return invFail(taskName, 'config', '未配置任何算力服务：请先用 saveService() 新增一套（Endpoint + API-Key + 服务标识），或设 LEMO_LLM_* 覆盖点。', meta);
    }
    if (!cfg.baseUrl) {
      // ★★ 2026-10-10 订正：原句「（请在面板填写，或设 LEMO_LLM_BASE）」里的「请在面板填写」已不成立（面板无该输入框）。
      //   ★★ 2026-10-10 二次订正（**保留上面原句，不抹**）：面板重建为开放式后已有 baseUrl 输入框 ⇒
      //      「无需手工填写」**只对默认服务成立** ⇒ 改为「默认由运行时注入，也可在本服务里填写覆盖」。
      return invFail(taskName, 'config', `profile「${cfg.id}」缺少 baseUrl（端点默认由运行时注入，也可在本服务里填写覆盖；如需覆盖可用 LEMO_LLM_BASE）`, meta);
    }
    // ★★ v3：基础算力（target:'model'）⇒ **校验服务标识（model）**；智能体（target:'agent'）⇒ **不校验**
    //   （`needsModel` 已排除 agent —— ★ 2026-10-09 起**不看 kind**，见契约 §十五）。
    //   ★ 此处 `model` 为空 ⇒ **明确 config 错**（不偷偷从环境读 —— 那正是 v3 禁止的「探查」）。
    if (needsModel(cfg) && !cfg.model) {
      const protoNote = cfg.kind === 'anthropic' ? '（Anthropic 协议请求体必带非空 model）' : '';
      // ★★ 2026-10-10 订正：原句「请在面板填写」已不成立（面板无 model 输入框）。
      return invFail(taskName, 'config', `该端点要求 model（模型由所选算力服务决定，请为该服务指定服务标识）${protoNote}`, meta);
    }

    const built = spec.build(cfg, p, o);
    if (!built.ok) return invFail(taskName, built.kind, built.message, meta);

    const bodyBytes = Buffer.byteLength(built.body, 'utf8');
    if (bodyBytes > MAX_BODY_BYTES) {
      return invFail(taskName, 'config', `请求体过大（${bodyBytes} 字节 > 上限 ${MAX_BODY_BYTES} 字节）`, meta);
    }
    const secrets = [cfg.apiKey, ...(built.secrets || [])];   // ★ 密钥 + 图片负载一并脱敏
    // ★★ 2026-10-10：改走 `httpRequestRetry` —— 只对**幂等可重试**的失败重试（网络 / 超时 / 429 / 5xx），
    //   总耗时受 `cfg.timeoutMs` 约束；4xx 鉴权 / 参数错**不重试**（见 `shouldRetryResult`）。
    const r = await httpRequestRetry(built.url, {
      method: built.method || 'POST', headers: built.headers, body: built.body,
      timeoutMs: cfg.timeoutMs, binary: !!built.binary,
    });
    meta.ms = r.ms;
    meta.attempts = r.attempts;                         // ★ 真实请求次数（重试自证 / 观测用）
    if (!r.net) {
      return invFail(taskName, netErrorKind(r.error, r.timedOut),
        r.timedOut ? `请求超时（${cfg.timeoutMs}ms）：${cfg.baseUrl}` : `无法连接 ${cfg.baseUrl}`, meta, null, secrets);
    }
    meta.httpStatus = r.status;
    if (!r.resOk) {
      // ★★ 2026-10-09 追加（委托方澄清，见契约 §十五）：agent 模式**不带 model** 若被端点以「要求 model」
      //   拒绝（400/422）⇒ 归一为明确的 `config` + 中文 hint（**绝不**把 model 自动加回去）。
      if (cfg.target === 'agent' && isModelRequiredError(r.status, r.text)) {
        return invFail(taskName, 'config', agentModelHint(r.status), meta, r.text, secrets);
      }
      return invFail(taskName, httpErrorKind(r.status), `HTTP ${r.status}`, meta, r.text, secrets);
    }

    // ★ 二进制响应（audio 的字节流）：直接取 base64（**不当文本读**）
    if (built.binary) {
      const bytes = r.bytes || Buffer.alloc(0);
      if (!bytes.length) return invFail(taskName, 'empty-output', '音频响应为空', meta);
      return { ok: true, task: taskName, result: { audio: bytes.toString('base64'), mime: r.contentType || undefined }, raw: null, meta };
    }

    let json;
    try {
      json = JSON.parse(r.text);
    } catch {
      return invFail(taskName, 'bad-json', '响应不是合法 JSON', meta, r.text, secrets);
    }
    const ex = spec.extract(cfg, json);
    if (!ex.ok) return invFail(taskName, ex.kind, ex.message, meta, r.text, secrets);
    return { ok: true, task: taskName, result: ex.result, raw: json, meta };
  } catch (e) {
    // ★ 兜底：连解析配置 / 构造请求都可能意外抛 ⇒ 这里收口，绝不让异常冒出去（与 chat 同一纪律）。
    return invFail(taskName, 'unknown', `未预期异常：${(e && e.message) || e}`, meta);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── ★★ 智能体网关：一次对话（两段式 run + SSE）—— 2026-10-09 追加（见契约 §十六）──
// ═══════════════════════════════════════════════════════════════════════════
/** 网关请求头（`Content-Type` + 面板/覆盖来的头 + `Authorization: Bearer <口令>`）。 */
function gatewayHeaders(cfg) {
  const headers = { 'Content-Type': 'application/json', ...cfg.headers };
  if (cfg.apiKey && !headers.Authorization) headers.Authorization = `Bearer ${cfg.apiKey}`;
  return headers;
}
/** 网关的消息 id（★ 网关的 generic 适配器 `parseInbound` **要求** `id` + `type`）。 */
function gatewayMessageId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `lemo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
/** 把归一化后的 `messages` 拍成**一段文本**（网关协议的 `text` 是一个字符串）。 */
function gatewayPromptText(msgs) {
  const parts = [];
  for (const m of msgs) {
    const c = m && m.content;
    const t = typeof c === 'string' ? c
      : Array.isArray(c) ? c.map((b) => (b && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('')
        : '';
    if (t && t.trim()) parts.push(t);
  }
  return parts.join('\n');
}
/**
 * ★ 解析一帧 SSE（`event:` / `data:` 行；`data` 尝试 `JSON.parse`）。空帧 ⇒ `null`。
 * ★ 只用标准 SSE 语法（`:` 开头是注释、字段名后可选一个空格），不臆造私有格式。
 */
function parseSseFrame(frame) {
  let event = 'message';
  const dataLines = [];
  for (const raw of String(frame).split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line || line.startsWith(':')) continue;
    const i = line.indexOf(':');
    const field = i < 0 ? line : line.slice(0, i);
    const value = i < 0 ? '' : line.slice(i + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }
  const rawData = dataLines.join('\n');
  if (!rawData && event === 'message') return null;
  let data = null;
  if (rawData) { try { data = JSON.parse(rawData); } catch { data = null; } }
  return { event, data, rawData };
}
/**
 * ★★ 读网关的**结果流**（`GET {base}/api/v1/runs/{runId}/stream`，SSE）—— **有界**、**永不抛**。
 *   取文本：末帧 `status:'completed'` 的 `content.markdown` **优先**（全文），否则拼接 `status:'streaming'`
 *   的 `content.chunk`（增量）。`event: done` ⇒ 正常收尾；`event: error` / `status:'error'` ⇒ 归一为失败。
 * @returns {Promise<{ok:true,text:string,raw:object}|{ok:false,kind:string,message:string,detail?:any}>}
 */
async function streamGatewayRun(cfg, runId) {
  const url = `${cfg.baseUrl}${GATEWAY_RUN_PATH}/${encodeURIComponent(runId)}/stream`;
  const headers = { ...gatewayHeaders(cfg), Accept: 'text/event-stream' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1, cfg.timeoutMs));
  let reader = null;
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: ac.signal });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, kind: httpErrorKind(res.status), message: `HTTP ${res.status}（结果流）`, detail: t };
    }
    reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;
    if (!reader) return { ok: false, kind: 'bad-shape', message: '结果流没有可读的响应体（SSE）' };
    const dec = new TextDecoder();
    const chunks = [];
    let full = '';
    let errMsg = null;
    let buf = '';
    let ended = false;
    while (!ended) {
      const { done, value } = await reader.read();       // ★ 超时由 ac.abort() 打断（⇒ 抛 AbortError）
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const ev = parseSseFrame(buf.slice(0, idx));
        buf = buf.slice(idx + 2);
        if (!ev) continue;
        if (ev.event === 'done') { ended = true; break; }
        if (ev.event === 'error') { errMsg = (ev.data && ev.data.error) || '结果流返回 error 事件'; ended = true; break; }
        if (ev.event !== 'message' || !ev.data || typeof ev.data !== 'object') continue;
        const d = ev.data;
        if (d.status === 'error') { errMsg = (d.error && d.error.message) || '智能体执行失败'; ended = true; break; }
        if (d.content && typeof d.content.chunk === 'string') chunks.push(d.content.chunk);
        if (d.content && typeof d.content.markdown === 'string') full = d.content.markdown;
      }
    }
    if (errMsg) return { ok: false, kind: 'http-error', message: `智能体执行失败：${errMsg}`, detail: errMsg };
    const text = full.trim() ? full : chunks.join('');
    return { ok: true, text, raw: { markdown: full, chunks: chunks.length } };
  } catch (e) {
    const timedOut = ac.signal.aborted || (e && e.name === 'AbortError');
    return {
      ok: false,
      kind: netErrorKind(e, timedOut),
      message: timedOut ? `结果流超时（${cfg.timeoutMs}ms）：${cfg.baseUrl}` : `结果流读取失败：${cfg.baseUrl}`,
      detail: (e && e.message) || null,
    };
  } finally {
    clearTimeout(timer);                                 // ★★ 不清理定时器 ⇒ 进程挂住（本项目踩过）
    try { if (reader) await reader.cancel(); } catch { /* 流已结束 / 已中止 ⇒ 忽略 */ }
  }
}
/**
 * ★★ 网关适配器的**一次对话**（两段式：`POST /api/v1/runs` → `GET …/stream`）。★ **永不抛**。
 * ★ 请求体 = `{id, type:'message', text, sender:{id,name}}`：
 *   · `text` / `sender` 是**网关 OpenAPI 文档**里的字段；
 *   · `id` / `type` 是**网关实现**（generic 适配器 `parseInbound`）**硬要求**的字段 —— 只发 `{text,sender}`
 *     会被 `400 Invalid generic message format` 拒（**文档与实现不符**，见报告）。
 *   ★ **绝不出现 `model`**（agent 模式硬约束）。
 * @returns {Promise<{ok:true,text,raw,usage,meta}|{ok:false,error,meta}>}
 */
async function chatViaGateway(cfg, msgs, meta, opts = {}) {
  const secrets = [cfg.apiKey];
  try {
    if (opts.images !== undefined) {
      return fail('config', '智能体网关适配器暂不支持图片输入（opts.images）：网关协议只收文本', meta);
    }
    const text = gatewayPromptText(msgs);
    if (!text.trim()) return fail('config', 'messages 里没有可发送的文本', meta);
    const body = JSON.stringify({
      id: gatewayMessageId(),                            // ★ 实现必需（见函数头注释）
      type: 'message',
      text,                                              // ★ 文档字段
      sender: { ...GATEWAY_SENDER },                     // ★ 文档字段（sender.id 必填）
    });
    const r = await httpRequest(`${cfg.baseUrl}${GATEWAY_RUN_PATH}`, {
      method: 'POST', headers: gatewayHeaders(cfg), body, timeoutMs: cfg.timeoutMs,
    });
    meta.ms = r.ms;
    if (!r.net) {
      return fail(netErrorKind(r.error, r.timedOut),
        r.timedOut ? `请求超时（${cfg.timeoutMs}ms）：${cfg.baseUrl}` : `无法连接 ${cfg.baseUrl}`, meta, null, secrets);
    }
    meta.httpStatus = r.status;
    if (!r.resOk) return fail(httpErrorKind(r.status), `HTTP ${r.status}`, meta, r.text, secrets);
    let json;
    try {
      json = JSON.parse(r.text);
    } catch {
      return fail('bad-json', '发起执行的响应不是合法 JSON', meta, r.text, secrets);
    }
    const runId = pick(getPath(json, 'data.runId'), getPath(json, 'runId'));
    if (typeof runId !== 'string' || !runId.trim()) {
      return fail('bad-shape', '发起执行的响应里取不到 runId（期望 {data:{runId}}）', meta, r.text, secrets);
    }
    meta.runId = runId;
    const s = await streamGatewayRun(cfg, runId);
    if (!s.ok) return fail(s.kind, s.message, meta, s.detail, secrets);
    if (!s.text.trim()) return fail('empty-output', '智能体返回了空文本', meta, null, secrets);
    return { ok: true, text: s.text, raw: s.raw, usage: null, meta };
  } catch (e) {
    return fail('unknown', `未预期异常：${(e && e.message) || e}`, meta);
  }
}

// ── chat：文本推理入口（★ 永不抛）—— ★ 2026-10-09 起 `invoke('chat', …)` 委托给它 ──────
/**
 * 发一次对话，取回文本。★ **永不抛**：任何失败都归一为 `{ok:false,error:{kind,...}}`。
 * ★★ 2026-10-09：本函数是文本推理的**完整实现**（`invoke('chat', …)` 会委托到这里，并归一成通用返回形状）。
 *   ⇒ 既有结构 / 错误归一 / 多模态预处理**一字未动**，对外返回结构 / 行为**逐字节不变**（有单测金标钉住）。
 * @param {Array|string} messages `[{role,content}]`（或单个字符串，按 user 处理）
 *   ★ `content` 可为**字符串**（纯文本）或**内容块数组**（多模态，见文件头「多模态」）。
 * @param {object} [opts] 同 resolveConfig，另可含 `maxTokens`（可选，透传 `max_tokens`）与
 *   `temperature`（★ 2026-10-08 追加，**仅在显式给值时**透传；见 `buildRequest`）；
 *   ★ 多模态便利入参 `opts.images:[{path|base64|dataUrl, mediaType?}]`（按 kind 自动转格式并注入最后一条 user）。
 *   ★★ 2026-10-10 追加（标准 §8 / §11.5）：`opts.fallbacks:['svc-a','svc-b']` ⇒ **跨服务降级**（委托
 *     `chatWithFallback`）；服务字段 `forceStream` / `ensureSystemPrompt`（或 `opts` 同名，默认关）⇒
 *     「只接受流式」/「首条必须 system」两个硬约束的适配（非流式被 400+11101 拒绝 ⇒ **自动改走流式重试一次**）。
 *     ★ 不传 `fallbacks` / 两个开关保持默认关 ⇒ **行为逐字不变**（有单测金标钉住）。
 * @returns {Promise<{ok:true,text:string,raw:any,usage:any,meta:object}
 *                  | {ok:false,error:{kind,message,httpStatus?,detail?},meta:object}>}
 */
export async function chat(messages, opts = {}) {
  const meta = { at: new Date().toISOString() };
  try {
    // ★★ 2026-10-10 追加（标准 §8）：**跨服务降级** —— `opts.fallbacks` 非空时**委托**给 `chatWithFallback`
    //   （★ 不传 ⇒ **逐字走原路径**，默认行为不变）。★ 降级版同样**永不抛**（返回 `{ok:false,…}`）。
    if (Array.isArray(opts && opts.fallbacks) && opts.fallbacks.length) {
      return await chatWithFallback(messages, opts);
    }
    const cfg = resolveConfig(opts);
    meta.profile = cfg.id;
    meta.kind = cfg.kind;
    meta.model = cfg.model;
    meta.baseUrl = cfg.baseUrl;
    if (cfg.serviceId) meta.service = cfg.serviceId;    // ★ 2026-10-10：生效的「算力服务」id（无 ⇒ 不写）

    // ★★ 2026-10-10 追加（规格 §1/§4）：**按服务标识调用** —— 显式指定的服务必须**存在**（否则明确 config 错）。
    const wantService = String((opts && opts.service != null) ? opts.service : '');
    if (wantService && !serviceById(wantService)) {
      return fail('config', `找不到算力服务「${wantService}」：请先用 listServices() 查看已保存的服务 id`, meta);
    }
    // ★★ 2026-10-10 追加（多套服务）：覆盖文件**显式**声明「一套服务都没有」⇒ **优雅报错**（**不抛**）。
    if (cfg.servicesEmpty) {
      return fail('config', '未配置任何算力服务：请先用 saveService() 新增一套（Endpoint + API-Key + 服务标识），或设 LEMO_LLM_* 覆盖点。', meta);
    }
    if (!cfg.baseUrl) {
      // ★★ 2026-10-10 订正：原句「（请在面板填写，或设 LEMO_LLM_BASE）」里的「请在面板填写」已不成立（面板无该输入框）。
      //   ★★ 2026-10-10 二次订正（**保留上面原句，不抹**）：面板重建为开放式后已有 baseUrl 输入框 ⇒
      //      「无需手工填写」**只对默认服务成立** ⇒ 改为「默认由运行时注入，也可在本服务里填写覆盖」。
      return fail('config', `profile「${cfg.id}」缺少 baseUrl（端点默认由运行时注入，也可在本服务里填写覆盖；如需覆盖可用 LEMO_LLM_BASE）`, meta);
    }
    // ★★ 基础算力（`target:'model'`）**要求 model 非空**；缺 ⇒ **明确 config 错**（见契约 §十三 / §十四）。
    //   ★★ 2026-10-09 修正（委托方澄清，见契约 §十五）：**智能体 API（`target:'agent'`）不在此列** ——
    //     模块**不向智能体下发任何 model**（`needsModel` 恒 false，**不看 kind**）⇒ 取消原「`agent + anthropic` 例外」。
    //   ★★ **绝不**从运行时线索（`ANTHROPIC_MODEL` 等）偷读一个 —— 那正是 v3 禁止的「探查智能体内部模型」。
    if (needsModel(cfg) && !cfg.model) {
      const protoNote = cfg.kind === 'anthropic' ? '（Anthropic 协议请求体必带非空 model）' : '';
      // ★★ 2026-10-10 订正：原句「请在面板填写」已不成立（面板无 model 输入框）。
      return fail('config', `该端点要求 model（模型由所选算力服务决定，请为该服务指定服务标识）${protoNote}`, meta);
    }
    const msgs = normalizeMessages(messages);
    if (!msgs.length) return fail('config', 'messages 为空：至少需要一条 {role, content}', meta);

    // ★★ 2026-10-09 追加（见契约 §十六）：智能体网关适配器是**两段式**（POST run → SSE 取结果），
    //   不是「一次 POST + 取文本」⇒ 单独走 `chatViaGateway`。★ 其余三种 kind 的路径**逐字节不变**。
    if (cfg.kind === 'workbuddy-gateway') return chatViaGateway(cfg, msgs, meta, opts);

    // ★ 多模态：便利入参 `opts.images` → 图片内容块（按 kind 自动转 OpenAI / Anthropic 格式）
    if (opts.images !== undefined) {
      const inj = injectImages(msgs, opts.images, cfg.kind);
      if (!inj.ok) return fail(inj.error.kind, inj.error.message, meta);
    }
    // ★ 多模态：单图体积守卫 + 收集图片负载（供错误 detail 脱敏 —— 图片内容不外泄）
    const scan = scanImages(msgs);
    if (!scan.ok) return fail(scan.kind, scan.message, meta);

    // ★★ 2026-10-10 追加（标准 §11.5）：`ensureSystemPrompt` ⇒ 首条非 `system` 时**自动补一条**默认 system。
    //   ★ 默认关 ⇒ `finalMsgs === msgs` ⇒ 请求体**逐字节不变**（有单测金标钉住）。
    const finalMsgs = applyEnsureSystemPrompt(cfg, msgs);

    // ★★ 2026-10-10 追加（标准 §11.5）：`forceStream` ⇒ `chat()` **改由流式（SSE）聚合**。
    //   ★ 仅 `openai-compatible` 有**真 SSE**；其它 kind 的 `forceStream` **不生效**（不硬加，见文件头）。
    if (cfg.forceStream && cfg.kind === 'openai-compatible') {
      return await chatViaStreamAggregate(cfg, finalMsgs, opts, meta, scan.payloads);
    }

    const { url, headers, body, method } = buildRequest(cfg, finalMsgs, { maxTokens: opts.maxTokens, temperature: opts.temperature });
    // ★ 多模态：总请求体体积守卫 —— ★ 防 `fetch` 因超大体崩掉（归一为 config，**不抛**）
    const bodyBytes = Buffer.byteLength(body, 'utf8');
    if (bodyBytes > MAX_BODY_BYTES) {
      return fail('config', `请求体过大（${bodyBytes} 字节 > 上限 ${MAX_BODY_BYTES} 字节）`, meta);
    }
    const secrets = [cfg.apiKey, ...scan.payloads];   // ★ 密钥 + 图片负载一并脱敏
    // ★★ 2026-10-10：改走 `httpRequestRetry`（只重试幂等可重试的失败；总耗时受 `cfg.timeoutMs` 约束）。
    // ★★ 2026-10-10 追加（标准 §11.5 路径①）：本模块 `httpRequest` 对非 2xx **不抛**（走下方 status+text 路径②），
    //   此处 `try/catch` 为**防御式**覆盖 —— 若将来传输层改成「非 2xx 直接抛」，同样按 400+11101 特征改走流式。
    let r;
    try {
      r = await httpRequestRetry(url, { method, headers, body, timeoutMs: cfg.timeoutMs });
    } catch (e) {
      if (cfg.kind === 'openai-compatible' && isNonStreamRejectedError(e)) {
        return await chatViaStreamAggregate(cfg, finalMsgs, opts, meta, scan.payloads);
      }
      return fail('unknown', `未预期异常：${(e && e.message) || e}`, meta);
    }
    meta.ms = r.ms;
    meta.attempts = r.attempts;                       // ★ 真实请求次数（重试自证 / 观测用）
    if (!r.net) {
      return fail(netErrorKind(r.error, r.timedOut),
        r.timedOut ? `请求超时（${cfg.timeoutMs}ms）：${cfg.baseUrl}` : `无法连接 ${cfg.baseUrl}`,
        meta, null, secrets);
    }
    meta.httpStatus = r.status;
    if (!r.resOk) {
      // ★★ 2026-10-10 追加（标准 §11.5 路径②）：**非流式被拒（400 + code=11101）** ⇒ **自动改走流式重试一次**
      //   （对用户透明）。★ 判定在「拿到 status+body」这条路径上做 —— 只写 try/catch 会**漏判**（参考方实测）。
      if (cfg.kind === 'openai-compatible' && isNonStreamRejected(r.status, r.text)) {
        return await chatViaStreamAggregate(cfg, finalMsgs, opts, meta, scan.payloads);
      }
      // ★★ 2026-10-09 追加（委托方澄清，见契约 §十五）：agent 模式**不带 model** 若被端点以「要求 model」
      //   拒绝（400/422）⇒ 归一为明确的 `config` + 中文 hint（**绝不**把 model 自动加回去）。
      if (cfg.target === 'agent' && isModelRequiredError(r.status, r.text)) {
        return fail('config', agentModelHint(r.status), meta, r.text, secrets);
      }
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

// ═══════════════════════════════════════════════════════════════════════════
// ── ★★ 2026-10-10 追加（标准 §8 / §11.5）：流式（SSE）+ 跨服务降级 ──────────
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ★★ 判「服务端是否明确**拒绝非流式**请求」（标准 §11.5）。
 *   实测特征：HTTP **400** 且 body 含 `code=11101` / `Non-stream chat request is currently not supported`。
 *   ★ 同时供**两条路径**使用：① 抛出的错（见 `isNonStreamRejectedError`）② 拿到的 `(status, text)`（本函数）。
 */
function isNonStreamRejected(status, text) {
  if (Number(status) !== 400) return false;
  const blob = String(text || '').toLowerCase();
  if (blob.includes('11101')) return true;
  return blob.includes('stream') && (blob.includes('non-stream') || blob.includes('not supported'));
}
/** 路径①：异常对象带 `httpStatus` / `rawSnippet` 时的同款判定（本模块 `httpRequest` 对非 2xx **不抛** ⇒ 防御式）。 */
function isNonStreamRejectedError(e) {
  if (!e) return false;
  const status = (e.httpStatus !== undefined ? e.httpStatus : e.status);
  return isNonStreamRejected(status, String(e.rawSnippet || e.message || ''));
}

/**
 * ★ 2026-10-10 追加（标准 §11.5）：`ensureSystemPrompt` 为真且首条非 `system` ⇒ **自动补一条**默认 system。
 *   ★ 关（默认）⇒ **原样返回**（引用不变）⇒ 请求体逐字节不变。
 */
function applyEnsureSystemPrompt(cfg, msgs) {
  if (!cfg.ensureSystemPrompt) return msgs;
  const first = msgs && msgs[0];
  if (first && String(first.role || '') === 'system') return msgs;
  return [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }, ...msgs];
}

/**
 * ★★ `openai-compatible` 的**真 SSE** 流式核心（标准 §8 / §11.5）。★ **永不抛**：失败产出**终止错误块**。
 *   yield 形状：`{ok:true, delta, done, raw}`（增量 / 收尾）| `{ok:false, error:{kind,message,detail?}}`（终止）。
 *   ★ 解析口径照参考实现：只认 `data:` 行；`[DONE]` 收尾；增量 = `choices.0.delta.content`（非字符串 ⇒ 报错，
 *     缺失 / null ⇒ 跳过）；流在 `[DONE]` 前结束：**已有文本** ⇒ 标记 `interrupted` 收尾，**无文本** ⇒ 报错。
 *   ★ 超时用 `AbortController`，`finally` 里 `clearTimeout`（本项目踩过「定时器没清、进程不退出」的坑）。
 *   ★ 流式**不叠加**自动重试（`retry`）：流已部分产出，重发会重复渲染 ⇒ 保持「一次流」。
 */
async function* streamOpenAICompat(cfg, msgs, { maxTokens, temperature } = {}) {
  const url = joinUrl(cfg.baseUrl, '/chat/completions');
  const headers = { 'Content-Type': 'application/json', ...cfg.headers, Accept: 'text/event-stream' };
  if (cfg.apiKey && !headers.Authorization) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const body = {};
  if (shouldSendModel(cfg)) body.model = cfg.model;    // 与 buildRequest 同口径（agent 模式不带 model）
  body.messages = msgs;
  body.stream = true;
  if (maxTokens !== undefined) body.max_tokens = maxTokens;
  if (temperature !== undefined) body.temperature = temperature;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1, cfg.timeoutMs));
  let reader = null;
  let got = false;
  let done = false;
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      yield { ok: false, error: { kind: httpErrorKind(res.status), message: `HTTP ${res.status}`, httpStatus: res.status, detail: clip(redact(t, [cfg.apiKey])) } };
      return;
    }
    reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;
    if (!reader) { yield { ok: false, error: { kind: 'bad-shape', message: '流式响应没有可读的响应体（SSE）' } }; return; }
    const dec = new TextDecoder();
    let buf = '';
    while (!done) {
      const step = await reader.read();
      if (step.done) break;
      buf += dec.decode(step.value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const rawLine = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        if (!line || line.startsWith(':') || !line.startsWith('data:')) continue;   // 空行 / 注释 / 非 data 行 ⇒ 忽略
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') { done = true; break; }
        let obj;
        try { obj = JSON.parse(payload); } catch { continue; }                      // 单行坏 JSON ⇒ 跳过
        if (!obj || typeof obj !== 'object') continue;
        const delta = getPath(obj, 'choices.0.delta.content');
        if (delta === undefined || delta === null) continue;                        // 无增量 ⇒ 跳过
        if (typeof delta !== 'string') {
          yield { ok: false, error: { kind: 'bad-shape', message: '流式增量内容类型非法（应为字符串）' } };
          return;
        }
        if (delta) { got = true; yield { ok: true, delta, done: false, raw: obj }; }
      }
    }
    if (done) {
      if (!got) { yield { ok: false, error: { kind: 'empty-output', message: '模型返回空文本（流已正常结束）' } }; return; }
      yield { ok: true, delta: '', done: true, raw: { done: true } };
      return;
    }
    if (got) { yield { ok: true, delta: '', done: true, raw: { interrupted: true } }; return; }   // 保留已渲染文本
    yield { ok: false, error: { kind: 'unreachable', message: '流在收到 [DONE] 之前中断' } };
  } catch (e) {
    const timedOut = ac.signal.aborted || (e && e.name === 'AbortError');
    yield {
      ok: false,
      error: {
        kind: netErrorKind(e, timedOut),
        message: timedOut ? `请求超时（${cfg.timeoutMs}ms）` : '流式请求失败',
        detail: (e && e.message) || undefined,
      },
    };
  } finally {
    clearTimeout(timer);                                // ★★ 不清理定时器 ⇒ 进程挂住（本项目踩过）
    try { if (reader) await reader.cancel(); } catch { /* 流已结束 / 已中止 ⇒ 忽略 */ }
  }
}

/**
 * ★★ **流式对话**（标准 §8）：`stream(messages, opts)` → **异步生成器**，逐块产出
 *   `{ok:true, delta, done, raw, meta}`；失败产出**终止块** `{ok:false, error:{kind,message,detail?}, meta}`。
 *
 * ★★ 为什么**不抛**（与 `chat()` 一致 —— 这是本模块的核心承诺）：`chat()` 已把一切失败归一为
 *   `{ok:false,error}`；若 `stream()` 改成抛异常，就出现**两套口径** —— 同一个失败，走 `chat()` 是
 *   `{ok:false}`、走 `stream()` 却要 `try/catch` ⇒ 调用方（含面板）多一处崩点。⇒ `stream()` **同样永不抛**，
 *   错误以**终止块**产出，调用方只需检查 `chunk.ok`（★ 与 `chat()` 的差异**仅**在于「返回的是流而非单值」）。
 *
 * ★ 仅 `openai-compatible`（**有真 SSE**）支持；其它 kind ⇒ 产出 `{ok:false, error:{kind:'config'}}`（优雅报）。
 *   ★ `anthropic` / `workbuddy-gateway` **不硬加流式**（前者无真 SSE；后者是两段式，另有其读流实现）。
 * @param {Array|string} messages 同 `chat()`
 * @param {object} [opts] 同 `resolveConfig`（可含 `maxTokens` / `temperature`）
 * @returns {AsyncGenerator<{ok:boolean,delta?:string,done?:boolean,raw?:any,error?:object,meta:object}>}
 */
export async function* stream(messages, opts = {}) {
  const meta = { at: new Date().toISOString() };
  try {
    const cfg = resolveConfig(opts);
    Object.assign(meta, { profile: cfg.id, kind: cfg.kind, model: cfg.model, baseUrl: cfg.baseUrl });
    if (cfg.serviceId) meta.service = cfg.serviceId;
    const wantService = String((opts && opts.service != null) ? opts.service : '');
    if (wantService && !serviceById(wantService)) {
      yield { ok: false, error: { kind: 'config', message: `找不到算力服务「${wantService}」：请先用 listServices() 查看已保存的服务 id` }, meta };
      return;
    }
    if (cfg.servicesEmpty) {
      yield { ok: false, error: { kind: 'config', message: '未配置任何算力服务：请先用 saveService() 新增一套（Endpoint + API-Key + 服务标识），或设 LEMO_LLM_* 覆盖点。' }, meta };
      return;
    }
    if (!cfg.baseUrl) {
      yield { ok: false, error: { kind: 'config', message: `profile「${cfg.id}」缺少 baseUrl（端点默认由运行时注入，也可在本服务里填写覆盖；如需覆盖可用 LEMO_LLM_BASE）` }, meta };
      return;
    }
    if (cfg.kind !== 'openai-compatible') {
      yield { ok: false, error: { kind: 'config', message: `该适配器（${cfg.kind}）不支持流式：本模块的真 SSE 仅 openai-compatible 提供` }, meta };
      return;
    }
    if (needsModel(cfg) && !cfg.model) {
      yield { ok: false, error: { kind: 'config', message: '该端点要求 model（模型由所选算力服务决定，请为该服务指定服务标识）' }, meta };
      return;
    }
    let msgs = normalizeMessages(messages);
    if (!msgs.length) { yield { ok: false, error: { kind: 'config', message: 'messages 为空：至少需要一条 {role, content}' }, meta }; return; }
    msgs = applyEnsureSystemPrompt(cfg, msgs);
    for await (const c of streamOpenAICompat(cfg, msgs, { maxTokens: opts.maxTokens, temperature: opts.temperature })) {
      yield { ...c, meta };
    }
  } catch (e) {
    yield { ok: false, error: { kind: 'unknown', message: `未预期异常：${(e && e.message) || e}` }, meta };
  }
}

/**
 * ★★ 2026-10-10 追加（标准 §11.5）：把 `stream()` 的增量**聚合**成一次非流式语义结果
 *   （`forceStream` / 被 `400+11101` 拒绝后自动重试 **都用它**）。★ **永不抛**（内部消费 `stream()`，
 *   其错误以**终止块**产出）。
 *   ★ 成功时在 `meta.via = 'stream'` 上**留痕**，供调用方 / 探针自证「本结果确实经流式取得」。
 */
async function chatViaStreamAggregate(cfg, msgs, opts, meta, payloads) {
  const secrets = [cfg.apiKey, ...(payloads || [])];
  let text = '';
  let failed = null;
  try {
    for await (const c of stream(msgs, { ...opts, images: undefined })) {
      if (c && c.ok === false) { failed = c.error || { kind: 'unknown', message: '流式失败' }; break; }
      if (c && typeof c.delta === 'string') text += c.delta;
    }
  } catch (e) {
    return fail('unknown', `未预期异常：${(e && e.message) || e}`, meta);
  }
  if (failed) return fail(failed.kind, failed.message, meta, failed.detail, secrets);
  if (!text.trim()) return fail('empty-output', '模型返回了空文本（流式聚合）', meta);
  meta.via = 'stream';                                  // ★ 自证：本结果**经流式**取得
  return { ok: true, text, raw: { via: 'stream' }, usage: null, meta };
}

/**
 * ★★ **跨服务降级对话**（标准 §8 `chat_with_fallback`）。★ **永不抛**（与 `chat()` 同纪律）。
 *   主服务（`opts.service`，缺省 = **当前生效服务**）失败 ⇒ 依次尝试 `opts.fallbacks`（**算力服务 id 列表**）。
 *   ★ 返回**第一个成功**的结果；**全败** ⇒ 返回**最后一个**失败（`ok:false`）。
 *   ★ 返回的 `meta.tried` **如实列出试过哪几套、各自的结果**（成功那套 ⇒ `ok:true`）；`meta.fallbackUsed`
 *     标明是否用到了降级（主服务即成功 ⇒ `false`）。
 * @param {Array|string} messages 同 `chat()`
 * @param {object} [opts] 同 `chat()`，另含 `fallbacks:string[]` 与可选 `onError(err, serviceId)`（回调异常被吞）。
 * @returns {Promise<{ok:true,text,raw,usage,meta}|{ok:false,error,meta}>}
 */
export async function chatWithFallback(messages, opts = {}) {
  const o = isPlainObj(opts) ? opts : {};
  try {
    const chain = [];
    const seen = new Set();
    const push = (v) => { const k = String(v ?? ''); if (!seen.has(k)) { seen.add(k); chain.push(k); } };
    const main = getActiveService();
    const mainId = (o.service !== undefined && o.service !== null && o.service !== '') ? o.service : ((main && main.id) || '');
    push(mainId);
    for (const f of (Array.isArray(o.fallbacks) ? o.fallbacks : [])) push(f);
    const cb = (typeof o.onError === 'function') ? o.onError : (typeof o.on_error === 'function' ? o.on_error : null);
    const tried = [];
    let last = null;
    for (const sid of chain) {
      const r = await chat(messages, { ...o, service: sid === '' ? undefined : sid, fallbacks: undefined });
      tried.push(r.ok ? { service: sid, ok: true } : { service: sid, ok: false, error: r.error });
      if (r.ok) return { ...r, meta: { ...r.meta, tried, fallbackUsed: sid !== chain[0] } };
      last = r;
      if (cb) { try { cb(r.error, sid); } catch { /* 回调异常不影响降级流程 */ } }
    }
    const err = (last && last.error) || { kind: 'config', message: '没有可尝试的算力服务' };
    return { ok: false, error: err, meta: { ...((last && last.meta) || { at: new Date().toISOString() }), tried } };
  } catch (e) {
    return fail('unknown', `未预期异常：${(e && e.message) || e}`, { at: new Date().toISOString() });
  }
}


// ── validate：三步探针（★ 面板逐步显示）──────────────────────
/**
 * 按 kind 给一句**可操作**的中文建议（契约 §四）。
 * ★★ 2026-10-10 订正（「AI 算力配置」面板极简化：28 控件 → 9 id、**零输入控件**）：
 *   本函数原有若干句把用户指去**已删的控件 / 已删的 provider / 已删的 kind** —— 这些文案经 `validate()`
 *   的 `hint` 字段**原样显示在「测试连接」按钮下方**（`web/app.js`）⇒ 用户点「测试连接」失败时会被误导。
 *   现全部改为**成立**的说法：**本软件只接 WorkBuddy**；其**端点与口令由运行时注入，无需手工填写**；
 *   真要覆盖**只能**靠环境变量 `LEMO_LLM_BASE` / `LEMO_LLM_KEY` 或手改 `<成片根>/_llm-api.json`（界面无入口）。
 *   ★ 保留原句（历史，勿抹）—— 2026-10-10 之前的旧文案：
 *     · unreachable：'连不上服务：确认 Endpoint 是否正确、服务是否已启动、网络/防火墙是否放行。'
 *     · auth：'鉴权失败：密钥无效或权限不足，请核对 Key（或换一个）。'
 *     · rate-limit：'触发限流（429）：稍后重试，或换用别的 profile / 模型。'
 *     · http-error：'服务返回 HTTP …：检查 Endpoint 路径、模型名是否正确，或看 detail。'
 *     · bad-shape：'返回体里找不到文本：换 kind=openai-compatible/anthropic，或在 custom 里配 extract 路径。'
 *     · empty-output：'模型返回空文本：换模型或稍后重试。'
 *     · config：'配置不完整：请在面板补齐 Endpoint / Key / 模型名。'
 *   ★ 本批**只改文案**：分支 / kind / 判据一律未动。
 *   ★★ 2026-10-10 二次订正（**保留上面原句**）：委托方同日又下发《通用 AI 算力 API 接入模块》规格 ⇒ 模块
 *      **重建为开放式**（面板**现提供** `openai-compatible` / `anthropic` / `custom` / `workbuddy-gateway`
 *      四个 kind 入口；面板**也已有** baseUrl / key / model 等输入框）⇒ 上面「**本软件只接 WorkBuddy**」
 *      这个**断言已不成立**、「面板无输入框」也已不成立 ⇒ 下方 hint 里该断言**已改为**「**所选的算力服务**」/
 *      「**当前生效的算力服务**」；★ 其余「端点/口令由运行时注入，无需手工填写」**仍然成立**，保留。
 *      ★ 本批仍**只改文案**：分支 / kind / 判据 / 阈值一律未动。
 *   ★★ 2026-10-10 三次订正（**保留上面原句，不抹**）：上面那句「端点/口令由运行时注入，**无需手工填写**」
 *      **只对默认服务成立** —— 开放式面板**已有** baseUrl / key / model 输入框，用户可**在所选算力服务里
 *      自行填写覆盖** ⇒ 该半句**已不准确**，本批改为「**默认**由运行时注入，**也可在所选算力服务里填写覆盖**」
 *      （保留「所选的算力服务」口径）。★ 仍**只改文案**：分支 / kind / 判据 / 阈值一律未动。
 */
function hintFor(kind, status) {
  switch (kind) {
    case 'unreachable': return '连不上服务：确认服务是否已启动、网络/防火墙是否放行（端点默认由运行时注入，也可在所选算力服务里填写覆盖）。';
    case 'timeout': return '请求超时：确认服务是否响应；必要时把超时调大（LEMO_LLM_TIMEOUT_MS）。';
    case 'auth': return '鉴权失败：运行时口令无效或权限不足（口令由宿主注入 CODEBUDDY_GATEWAY_PASSWORD；如需覆盖可用 LEMO_LLM_KEY）。';
    case 'rate-limit': return '触发限流（429）：稍后重试（如仍限流，可在面板改用别的算力服务）。';
    case 'http-error': return `服务返回 HTTP ${status ?? '错误'}：确认服务是否正常，或看 detail（端点默认由运行时注入，也可在所选算力服务里填写覆盖）。`;
    case 'bad-json': return '返回体不是 JSON：该地址可能不是 LLM 接口（或返回了 HTML 错误页）。';
    case 'bad-shape': return '返回体里找不到文本：请确认所选算力服务的返回结构与所选 kind 相符，或改用 custom（自配 extract 路径）。';
    case 'empty-output': return '模型返回空文本：稍后重试（模型由所选算力服务决定，本软件不指定）。';
    case 'config': return '配置不完整：端点与口令默认由运行时注入，也可在所选算力服务里填写覆盖。';
    default: return '未知错误：请查看 errors[].detail。';
  }
}

const step = (ok, kind = null, detail = null) => ({ ok, kind, detail });

/**
 * 连通性 + 鉴权 + 返回结构 三步校验（★ 任一步失败 ⇒ `ok:false` + 可操作 `hint`）。
 * ★★ 2026-10-09 追加（委托方明令，见契约 §十五）：`target === 'agent'` 时**不发任何「模型相关请求」** ——
 *   第 1 步的 `GET {baseUrl}(/v1)/models` **整段跳过**；`steps.reachable` 改由**第 2 步的 POST 探针**判定
 *   （「请求正常发送、结果正常接收」）★ **判据不放宽**：POST 网络失败 ⇒ `reachable.ok=false` + `ok:false`。
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
  const out = (ok, hint) => ({ ok, profile: cfg.id, service: cfg.serviceId, steps, errors, warnings, hint, masked: maskedConfig(cfg) });
  const pushErr = (s, kind, detail) => {
    errors.push({ step: s, kind, detail: detail == null ? undefined : clip(redact(detail, [cfg.apiKey])) });
  };
  // ★★ 2026-10-10 追加：探针改走 `httpRequestRetry`（只重试幂等可重试的失败；总耗时受 `probeMs` 约束）。

  // ★★ 2026-10-10 追加（规格 §4：准入校验应覆盖「**服务标识**」）—— 显式指定的服务必须**存在**。
  const wantService = String((opts && opts.service != null) ? opts.service : '');
  if (wantService && !serviceById(wantService)) {
    steps.reachable = step(false, 'config', `找不到算力服务「${wantService}」`);
    pushErr('reachable', 'config', `找不到算力服务「${wantService}」`);
    return out(false, `找不到算力服务「${wantService}」：请先用 listServices() 查看已保存的服务 id。`);
  }
  // ★★ 2026-10-10 追加（多套服务）：覆盖文件**显式**声明「一套服务都没有」⇒ 明确报「未配置任何算力服务」。
  if (cfg.servicesEmpty) {
    steps.reachable = step(false, 'config', '未配置任何算力服务');
    pushErr('reachable', 'config', '未配置任何算力服务');
    return out(false, '未配置任何算力服务：请先用 saveService() 新增一套（Endpoint + API-Key + 服务标识）。');
  }

  // 0) 配置自检：baseUrl 必须有（★ 不得静默回退）
  if (!cfg.baseUrl) {
    steps.reachable = step(false, 'config', '未配置 baseUrl');
    pushErr('reachable', 'config', '未配置 baseUrl');
    // ★ 2026-10-08 追加：默认 profile `workbuddy` 的端点是**运行时**给的（见 PROFILES.workbuddy.note）
    //   ⇒ hint 与 model 的 hint 对称，**明说**它也能从运行时环境取（免得用户以为只能手填 / 以为默认坏了）。
    //   ★★ 2026-10-09 更正：`workbuddy` 的 kind 已是 `workbuddy-gateway`（网关适配器）⇒ 运行时线索是
    //     宿主注入的 `SERVER__HOST` / `SERVER__PORT`（**不是** `ANTHROPIC_BASE_URL` —— 那是模型中继）。
    const rtHint = cfg.kind === 'anthropic' ? ' / ANTHROPIC_BASE_URL'
      : cfg.kind === 'openai-compatible' ? ' / OPENAI_BASE_URL'
        : cfg.kind === 'workbuddy-gateway' ? '（或由宿主注入 SERVER__HOST / SERVER__PORT 动态发现）' : '';
    // ★★ 2026-10-10 订正（面板极简化：零输入控件）—— 原句为
    //   `profile「…」缺少 baseUrl：请在面板填写，或设 LEMO_LLM_BASE${rtHint}。`
    //   ⇒ 「请在面板填写」已不成立（面板无该输入框）；改为「端点由运行时注入，无需手工填写」。
    //   ★ 仍保留 `baseUrl` 字样与 `${rtHint}`（网关分支含 SERVER__PORT —— 测试锚点）。
    //   ★★ 2026-10-10 二次订正（**保留上面原句，不抹**）：面板**重建为开放式**后**已有** baseUrl 输入框
    //     ⇒ 「无需手工填写」**只对默认服务成立**、已不准确 ⇒ 改为「**默认**由运行时注入，**也可在本服务里
    //     填写覆盖**」。★ 仍保留 `baseUrl` 字样与 `${rtHint}`（测试锚点）。
    return out(false, `profile「${cfg.id}」缺少 baseUrl：端点默认由运行时注入，也可在本服务里填写覆盖；如需覆盖可用 LEMO_LLM_BASE${rtHint}。`);
  }

  const probeMs = Math.min(cfg.timeoutMs, PROBE_TIMEOUT_CAP_MS);

  // ★★ 2026-10-09 追加（见契约 §十六）：智能体网关适配器的准入探针 —— **只读、零副作用**。
  //   规格明令「不发起任何模型相关请求」⇒ 既不 `GET /v1/models`，也**绝不** `POST /api/v1/runs` 探活
  //   （那会**真的发起一次 Agent 执行**，且网关的 `primarySession` 就是用户当前会话 ⇒ 会干扰用户任务）
  //   ⇒ 用**只读** `GET /api/v1/health` 判「连通 + 鉴权 + 返回结构」。
  //   ★ **判据不放宽**：连不上 ⇒ `reachable.ok=false` + `ok:false`；401/403 ⇒ `auth.ok=false`。
  if (cfg.kind === 'workbuddy-gateway') {
    const hr = await httpRequestRetry(`${cfg.baseUrl}${GATEWAY_HEALTH_PATH}`,
      { method: 'GET', headers: authHeaders(cfg), timeoutMs: probeMs });
    if (!hr.net) {
      const k = netErrorKind(hr.error, hr.timedOut);
      steps.reachable = step(false, k, hr.timedOut ? `超时 ${probeMs}ms` : '连接失败');
      pushErr('reachable', k, steps.reachable.detail);
      return out(false, hintFor(k));
    }
    steps.reachable = step(true, null, `HTTP ${hr.status}（可达）`);
    if (!hr.resOk) {
      const k = httpErrorKind(hr.status);
      steps.auth = step(false, k, `HTTP ${hr.status}`);
      pushErr('auth', k, hr.text);
      const hint = (k === 'auth' && !cfg.apiKey)
        ? `未配置口令：网关要求鉴权（HTTP ${hr.status}）。请由宿主注入环境变量 CODEBUDDY_GATEWAY_PASSWORD。`
        : hintFor(k, hr.status);
      return out(false, hint);
    }
    let hj;
    try {
      hj = JSON.parse(hr.text);
    } catch {
      steps.shape = step(false, 'bad-json', '响应不是合法 JSON');
      pushErr('shape', 'bad-json', hr.text);
      return out(false, hintFor('bad-json'));
    }
    const st = getPath(hj, 'data.status');
    if (typeof st !== 'string') {
      steps.shape = step(false, 'bad-shape', '路径 data.status 取不到字符串');
      pushErr('shape', 'bad-shape', hr.text);
      return out(false, hintFor('bad-shape'));
    }
    steps.auth = step(true, null, cfg.apiKey ? `HTTP ${hr.status}（鉴权通过）` : `HTTP ${hr.status}（未配口令，网关未要求）`);
    steps.shape = step(true, null, `网关健康检查通过（data.status=${st}）`);
    return out(true, '连通、鉴权、返回结构三项均正常（网关只读健康检查 /api/v1/health）。');
  }

  // ★★ 2026-10-09 追加（委托方明令，见契约 §十五）：**agent 模式不发任何「模型相关请求」** ——
  //   规格原文：「不探查、不读取智能体内部正在使用的模型信息，**不发起任何模型相关请求**
  //   （例如**不调用 `/v1/models`** 或任何**列举、查询模型**的接口）」。
  //   ⇒ 原第 1 步的可达性探针 `GET {baseUrl}(/v1)/models` 正是「列举模型」⇒ agent 模式**跳过它**；
  //     连通性改由**第 2 步的 POST 探针**判定 —— 那才是规格说的「**请求正常发送、结果正常接收**」。
  //   ★★ **不放宽连通性判据**：agent 模式下 POST 探针若**网络失败**（DNS / 拒连 / 超时）⇒ 仍归
  //     `reachable` 步并 `ok:false`（见下）⇒ 「端点真不可达时仍然红」，不是恒真。
  const isAgent = cfg.target === 'agent';

  // 1) reachable（★ **仅非 agent**）：GET {baseUrl}(/v1)/models —— ★ 任何 HTTP 响应都算「可达」
  //   ★ agent 模式**整段跳过**（不发任何模型相关请求）；其连通性由第 2 步 POST 探针判定。
  if (!isAgent) {
    const reachUrl = cfg.kind === 'anthropic' ? joinUrl(cfg.baseUrl, '/v1/models') : joinUrl(cfg.baseUrl, '/models');
    const rr = await httpRequestRetry(reachUrl, { method: 'GET', headers: authHeaders(cfg), timeoutMs: probeMs });
    if (!rr.net) {
      const k = netErrorKind(rr.error, rr.timedOut);
      steps.reachable = step(false, k, rr.timedOut ? `超时 ${probeMs}ms` : '连接失败');
      pushErr('reachable', k, steps.reachable.detail);
      return out(false, hintFor(k));
    }
    steps.reachable = step(true, null, `HTTP ${rr.status}（可达）`);
  }

  // 2) auth：发一次**极小**探针（先按契约 `max_tokens:1`，prompt 固定 'ping'）
  //   ★ 2026-10-08 修正③（见文件头）：**不再**「没配 Key 就先拦下」，改为**照常发探针**、让服务端自己判：
  //     本地推理接口（LM Studio / Ollama 等）**本来就不需要 Key** ⇒ 预先拦下会把可用端点挡在门外（假阴）；
  //     而真需要鉴权的端点会回 401/403 ⇒ 仍归一为 `auth`（契约 §四 的映射就是「401/403 ⇒ auth」）。
  //   ★ 缺 **model** 时**先**明确报「缺 model」（裁定 (b)：不硬写模型、也不静默用别的模型）。
  //   ★★ 2026-10-08 追加（接入对象类型 `target`，见契约 §十二）：**智能体 API（agent）不校验模型标识** ——
  //     规格原文「接入智能体 API：**不校验智能体内部底层模型信息**，仅校验网络连通、鉴权合法性、返回文本结果合法性」
  //     ⇒ `target === 'agent'` 时**跳过**「缺 model」预检（model 只是本地备注，缺失不报错、不校验）。
  //   ★★ 2026-10-09 修正（委托方澄清，见契约 §十五）：**取消**原「`agent + anthropic` 例外」——
  //     `needsModel(cfg)` 现在**不看 kind**，`target === 'agent'` 恒为 false ⇒ agent 模式**不带 model 探活**；
  //     若端点因此以 400/422「要求 model」拒绝 ⇒ 见下方 `isModelRequiredError` 分支（归一为 config + 中文 hint）。
  //   ★★ 2026-10-09 修正（v3「不探查」）：agent 模式**不再**提示 `ANTHROPIC_MODEL` —— 模块**不读**智能体内部模型信息。
  //     判定改用统一的 `needsModel(cfg)`（与 `invoke()` / `chat()` 共用同一条口径，见其定义处）。
  if (needsModel(cfg) && !cfg.model) {
    steps.auth = step(false, 'config', '未配置模型名');
    pushErr('auth', 'config', '未配置模型名');
    const rtHint = cfg.kind === 'anthropic' ? ' / ANTHROPIC_MODEL' : ' / OPENAI_MODEL';
    // ★★ 2026-10-10 订正：原句 `未配置模型名：请在面板填写 model，或设 LEMO_LLM_MODEL${rtHint}。` 里的
    //   「请在面板填写」已不成立（面板无 model 输入框）⇒ 改为「本软件只接 WorkBuddy（模型由其内部调度）」。
    //   ★★ 2026-10-10 二次订正（**保留上面原句**）：面板重建为开放式后**已有** model 输入框，且模块**不再**
    //      「只接 WorkBuddy」⇒ 上方「改为…」那句与下方 hint 已再改（现为「该算力服务要求指定服务标识（model）」）。
    //   ★ 仍保留「模型名」字样（测试锚点）。
    return out(false, `未配置模型名：该算力服务要求指定服务标识（model）；请在面板填写 model，或设 LEMO_LLM_MODEL${rtHint}。`);
  }
  // ★★ 2026-10-10 追加（对齐参考 §11.5）：探测**与 `chat()` 同一口径** —— **两条都做**（不是二选一）：
  //   ① `forceStream:true`（且 `openai-compatible`）⇒ 探测**直接走流式**（**不**先发一次注定被拒的非流式）；
  //   ② 非流式探测若被 `400 + code=11101` 拒 ⇒ **自动改走流式再探一次**（复用 `isNonStreamRejected` /
  //      `chatViaStreamAggregate` —— 与 `chat()` 的兜底**同源**，**不写第二份判定**）。
  //   ★★ 流式聚合产出的是**纯文本**（`chatViaStreamAggregate` / `stream()` 的产出），**不是 JSON**
  //      ⇒ 流式这条路**跳过 JSON 解析**，把聚合文本**直接当作 `ex.text`**（`present:true`）⇒
  //      下方 `shape` 步的判定表（`ok` / `empty-output` / `bad-shape`）**逐字不变**地继续工作。
  //   ★ `steps.reachable` 语义**不变**：`openai-compatible` 下「收到任何 HTTP 响应 ⇒ 可达」；
  //     `target:'agent'` 下仍由**这一次探针**（非流式 POST 或流式 SSE）判定可达。
  /**
   * ★★ 流式探测（与 `chat()` 同口径）：**复用** `chatViaStreamAggregate`（`chat()` 的 `forceStream` /
   *   `11101` 兜底两条路都走它；它内部消费 `stream()`，**永不抛**）。
   *   返回：① 成功 / 语义失败（`empty-output` / `bad-shape`）⇒ `{ ex }`（交给下方**同一张**判定表）；
   *         ② 其余失败（网络 / 鉴权 / HTTP / 限流 / config）⇒ `{ terminal }`（一个已定论的 `out(...)`）。
   *   ★ `empty-output` 归一为 `{ text:'', present:true }` ⇒ 判定表判 `empty-output`（**只告警**）；
   *     `bad-shape` 归一为 `{ text:undefined, present:false }` ⇒ 判定表判 `bad-shape`（**硬失败**，保住安全网）。
   */
  const streamProbe = async () => {
    const r = await chatViaStreamAggregate(cfg, [{ role: 'user', content: 'ping' }], { ...opts, maxTokens: 1 }, {}, []);
    if (r.ok) {
      // ★ agent 模式：流式探针**已收到响应** ⇒ 连通性成立（与非流式 POST 探针同口径，非恒真）。
      if (isAgent) steps.reachable = step(true, null, '流式探针已收到响应（可达）');
      steps.auth = step(true, null, cfg.apiKey ? '流式探针通过（鉴权通过）' : '流式探针通过（未配密钥，服务端未要求）');
      return { ex: { text: r.text, path: '(流式聚合)', present: true } };
    }
    const k = (r.error && r.error.kind) || 'unknown';
    if (k === 'empty-output') return { ex: { text: '', path: '(流式聚合)', present: true } };
    if (k === 'bad-shape') return { ex: { text: undefined, path: '(流式聚合)', present: false } };
    const detail = (r.error && r.error.detail) || (r.error && r.error.message);
    // 其余失败 ⇒ 归 auth（agent 模式归 reachable，与非流式 POST 探针同口径）。
    if (isAgent) {
      steps.reachable = step(false, k, r.error && r.error.message);
      pushErr('reachable', k, detail);
      return { terminal: out(false, hintFor(k)) };
    }
    steps.auth = step(false, k, r.error && r.error.message);
    pushErr('auth', k, detail);
    return { terminal: out(false, hintFor(k)) };
  };

  let ex;                 // `shape` 步的输入（★ 非流式 = `extractText(...)`；流式 = 聚合文本）
  let rawText = '';       // 诊断用（`bad-json` / `bad-shape` 的 detail）
  let parsed = null;      // 仅非流式路径：解析出的 JSON（供 `finishReasonOf` 诊断）
  let streamed = false;   // 本次探针是否经**流式**取得（★ 决定是否跳过 JSON 解析 / 64 复验）

  if (cfg.forceStream && cfg.kind === 'openai-compatible') {
    // ① `forceStream:true` ⇒ 探测**直接走流式**（不先发注定被拒的非流式）
    const sr = await streamProbe();
    if (sr.terminal) return sr.terminal;
    ex = sr.ex; streamed = true;
  } else {
    // ② 先发非流式探针；被 `400 + code=11101` 拒 ⇒ 自动改走流式（复用同一判据 / 同一聚合）
    const { url, headers, body, method } = buildRequest(cfg, [{ role: 'user', content: 'ping' }], { maxTokens: 1 });
    let ar = null;
    let fromStream = false;
    try {
      ar = await httpRequestRetry(url, { method, headers, body, timeoutMs: cfg.timeoutMs });
    } catch (e) {
      // ★ 路径①（与 `chat()` 同款，防御式）：传输层若「非 2xx 直接抛」⇒ 同样按 `400+11101` 特征改走流式。
      if (cfg.kind === 'openai-compatible' && isNonStreamRejectedError(e)) {
        const sr = await streamProbe();
        if (sr.terminal) return sr.terminal;
        ex = sr.ex; streamed = true; fromStream = true;
      } else {
        const k = netErrorKind(e, false);
        if (isAgent) {
          steps.reachable = step(false, k, '连接失败');
          pushErr('reachable', k, '连接失败');
          return out(false, hintFor(k));
        }
        steps.auth = step(false, k, '连接失败');
        pushErr('auth', k, '连接失败');
        return out(false, hintFor(k));
      }
    }
    if (!fromStream) {
      if (!ar.net) {
        const k = netErrorKind(ar.error, ar.timedOut);
        // ★★ agent 模式：连通性**由本 POST 探针判定**（已跳过 `/v1/models`）⇒ 网络失败归到 `reachable` 步。
        //   ★ 判据**未放宽**：端点真不可达（DNS / 拒连 / 超时）⇒ `steps.reachable.ok = false` + `ok:false`。
        if (isAgent) {
          steps.reachable = step(false, k, ar.timedOut ? `超时 ${cfg.timeoutMs}ms` : '连接失败');
          pushErr('reachable', k, steps.reachable.detail);
          return out(false, hintFor(k));
        }
        steps.auth = step(false, k, ar.timedOut ? `超时 ${cfg.timeoutMs}ms` : '连接失败');
        pushErr('auth', k, steps.auth.detail);
        return out(false, hintFor(k));
      }
      // ★ agent 模式：POST 探针**已收到 HTTP 响应** ⇒ 连通性成立（这就是「请求收发正常」的证据，非恒真）。
      if (isAgent) steps.reachable = step(true, null, `HTTP ${ar.status}（可达）`);
      if (!ar.resOk && cfg.kind === 'openai-compatible' && isNonStreamRejected(ar.status, ar.text)) {
        // ★ 路径②（拿到 `(status, text)`）：非流式被拒（`400 + code=11101`）⇒ 自动改走流式再探一次（对用户透明）。
        const sr = await streamProbe();
        if (sr.terminal) return sr.terminal;
        ex = sr.ex; streamed = true;
      } else if (!ar.resOk) {
        // ★★ 2026-10-09 追加（委托方澄清，见契约 §十五）：**agent 模式探针不带 model** —— 若端点回 400/422
        //   「要求 model」⇒ 归一为明确的 `config` 错 + 中文 hint（说明该端点更像底层基础算力 API），
        //   ★ **绝不**因探针 400 就把 model 自动加回去（那就等于违反「不向智能体下发 model」的定义）。
        if (cfg.target === 'agent' && isModelRequiredError(ar.status, ar.text)) {
          steps.auth = step(false, 'config', `HTTP ${ar.status}（端点要求 model）`);
          pushErr('auth', 'config', ar.text);
          return out(false, agentModelHint(ar.status));
        }
        const k = httpErrorKind(ar.status);
        steps.auth = step(false, k, `HTTP ${ar.status}`);
        pushErr('auth', k, ar.text);
        // ★ 没配 Key 而服务端要求鉴权 ⇒ hint 说得更具体（契约 §六 的「明确报缺 Key」）。
        const keyHint = cfg.kind === 'anthropic' ? ' / ANTHROPIC_API_KEY'
          : cfg.kind === 'openai-compatible' ? ' / OPENAI_API_KEY' : '';
        const hint = (k === 'auth' && !cfg.apiKey)
          // ★★ 2026-10-10 订正：原句「未配置密钥：…请填 Key，或设 LEMO_LLM_KEY…」里的「请填 Key」已不成立
          //   （面板无 key 输入框）⇒ 改为「口令由运行时注入…；如需覆盖可用 LEMO_LLM_KEY」；保留「未配置密钥」字样（测试锚点）。
          //   ★★ 2026-10-10 二次订正（**保留上面原句，不抹**）：面板重建为开放式后已有 key 输入框 ⇒ 改为
          //      「口令默认由运行时注入，也可在所选算力服务里填写覆盖」（保留「所选的算力服务」口径）。
          ? `未配置密钥：服务要求鉴权（HTTP ${ar.status}）。口令默认由运行时注入，也可在所选算力服务里填写覆盖；如需覆盖可用 LEMO_LLM_KEY${keyHint}。`
          : hintFor(k, ar.status);
        return out(false, hint);
      } else {
        steps.auth = step(true, null, cfg.apiKey ? `HTTP ${ar.status}（鉴权通过）` : `HTTP ${ar.status}（未配密钥，服务端未要求）`);
        rawText = ar.text;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          steps.shape = step(false, 'bad-json', '响应不是合法 JSON');
          pushErr('shape', 'bad-json', rawText);
          return out(false, hintFor('bad-json'));
        }
        ex = extractText(cfg, parsed);
      }
    }
  }

  // 3) shape：结构校验（★ 探针升级 + `empty-output` 降级 —— 见文件头「对契约的两处修正」）。
  //   `bad-shape`（路径解析不出字符串）⇒ **硬失败**；`empty-output`（解析出字符串但为空）⇒ **只作提示**。
  // ★★ 2026-10-10（**对齐参考 §11.9**）：判定同时看 `text` 与 `present`，把「路径存在但值为 null」
  //   （推理型模型小预算下的典型形态：token 花在 `reasoning_content` 上 ⇒ `content=null`）纳入
  //   `empty-output`（⇒ 可复验 + 只告警），而**不是** `bad-shape` 硬失败 —— 这是参考要防的**假阴**。
  //   判定表：
  //     · `text` 非空字符串                              ⇒ ok
  //     · `text` 空串 / 纯空白                            ⇒ empty-output
  //     · `text` 非字符串 **且 present===true**（如 null）⇒ empty-output（★ 新增）
  //     · `text` 非字符串 **且 present===false**（路径取不到）⇒ bad-shape（★ 保持硬失败，防 extract 路径写错）
  const judgeShape = (ex) => {
    if (typeof ex.text === 'string') return ex.text.trim() ? 'ok' : 'empty-output';
    return ex.present ? 'empty-output' : 'bad-shape';
  };
  // ★ 取 `finish_reason` / `stop_reason`（若响应里有）——只用于诊断，不参与判定。
  const finishReasonOf = (j) => {
    const fr = getPath(j, 'choices.0.finish_reason');
    if (typeof fr === 'string' && fr) return fr;
    const sr = (j && typeof j === 'object') ? j.stop_reason : undefined;
    if (typeof sr === 'string' && sr) return sr;
    return undefined;
  };
  // ★ 探针升级：`max_tokens:1` 的**空文本**常是假象（模型只吐 1 个 token 就停，或推理型模型
  //   把 token 全用在思考上）⇒ 再用 64 复验一次。
  //   ★★ 触发条件**有意放宽**（偏离参考 §11.9「仅当 finish_reason=="length"」）：只要判到 `empty-output`
  //     就复验。理由：① 我们的 `empty-output` **本来就只告警、不失败** ⇒ 一次多余的复验**无害**（只是多一个请求）；
  //     ② 收紧条件会让**不带 `finish_reason` 信号**的端点**丢掉**复验机会（如某些中转/自建端点不返回该字段）。
  //   ★★ 2026-10-10（对齐参考 §11.5）：**流式探针不做 64 复验** —— 流式聚合无 `finish_reason`，
  //     且 `empty-output` 本就只告警；对「只接受流式」的端点再发一次非流式复验只会白挨一次 11101。
  if (!streamed && judgeShape(ex) === 'empty-output') {
    const b2 = buildRequest(cfg, [{ role: 'user', content: 'ping' }], { maxTokens: 64 });
    const r2 = await httpRequestRetry(b2.url, { method: 'POST', headers: b2.headers, body: b2.body, timeoutMs: cfg.timeoutMs });
    if (r2.net && r2.resOk) {
      try {
        const j2 = JSON.parse(r2.text);
        const e2 = extractText(cfg, j2);
        if (typeof e2.text === 'string') { parsed = j2; ex = e2; rawText = r2.text; }
      } catch { /* 保持首次判定 */ }
    }
  }
  const verdict = judgeShape(ex);
  if (verdict === 'bad-shape') {
    steps.shape = step(false, 'bad-shape', `路径 ${ex.path} 取不到文本`);
    pushErr('shape', 'bad-shape', rawText);
    return out(false, hintFor('bad-shape'));
  }
  if (verdict === 'empty-output') {
    // ★★ 修正契约 §四（有实测依据，见文件头）：**结构合法**（路径存在，只是取到空文本 / 非字符串值如 null），
    //   不是连通/鉴权/结构的问题，而是**模型行为**（推理型模型把 token 全用在思考上 ⇒ `content=null`）。
    //   实测：本机已配置的真实端点对 `ping` 在 max_tokens=1/16/32 都返回 `content:[{text:''}]`、
    //   `stop_reason:'max_tokens'`，但同一个端点 `chat()` 能正常取到文本 ⇒ 判它「坏」是**假阴**。
    //   ⇒ 这里 `steps.shape.ok = true` 但带 `kind:'empty-output'`，并进 `warnings`（**不改 ok**）。
    //   ★ 对齐参考 §11.9：把 `finish_reason` / `stop_reason`（若响应里有）记进 detail，便于诊断
    //     （如 `finish_reason=length` ⇒ 多为预算不足 / 推理型模型把 token 花在思考上）。
    const fr = finishReasonOf(parsed);
    const frNote = fr
      ? `finish_reason=${fr}${fr === 'length' ? '（多为预算不足 ⇒ 推理型模型把 token 花在思考上）' : ''}`
      : '响应未带 finish_reason';
    steps.shape = step(true, 'empty-output', '结构合法，但探针返回空文本（max_tokens 1/64 两次都空）');
    warnings.push({
      step: 'shape', kind: 'empty-output',
      // ★★ 2026-10-10 订正：原句含「用面板「试一句」」—— 该控件已随面板极简化删除
      //   ⇒ 改为「稍后重试 / 调大 max_tokens」（模型由 WorkBuddy 内部调度，本软件不指定）。
      //   ★★ 2026-10-10 二次订正（**保留上面原句**）：模块已重建为开放式 ⇒ 上面「模型由 WorkBuddy 内部调度」
      //      已不成立，下方 detail 已改为「模型由所选算力服务决定」。
      detail: `探针返回空文本：多为推理型模型把 token 都用在思考上 ⇒ 稍后重试，或调大 max_tokens 复验（模型由所选算力服务决定）。${frNote}。`,
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
    if (cfg.serviceId) meta.service = cfg.serviceId;    // ★ 2026-10-10：生效的「算力服务」id（无 ⇒ 不写）
    // ★★ 2026-10-10 追加（规格 §1/§4）：**按服务标识调用** —— 显式指定的服务必须**存在**。
    const wantService = String((opts && opts.service != null) ? opts.service : '');
    if (wantService && !serviceById(wantService)) {
      return { ok: false, error: { kind: 'config', message: `找不到算力服务「${wantService}」：请先用 listServices() 查看已保存的服务 id` }, meta };
    }
    // ★★ 2026-10-10 追加（多套服务）：覆盖文件**显式**声明「一套服务都没有」⇒ 明确报「未配置任何算力服务」。
    if (cfg.servicesEmpty) {
      return { ok: false, error: { kind: 'config', message: '未配置任何算力服务：请先用 saveService() 新增一套（Endpoint + API-Key + 服务标识）。' }, meta };
    }
    // ★★ 2026-10-09 追加（委托方明令）：**接入对象 = 智能体 API 时，不得发起任何「模型相关请求」**
    //   —— 规格原文：「不探查、不读取智能体内部正在使用的模型信息，**不发起任何模型相关请求**
    //   （例如不调用 `/v1/models` 或任何列举、查询模型的接口）」✓
    //   ⇒ ★ 本函数**整条**就是「列举模型」⇒ agent 模式下**直接拒绝，不发请求** ✓
    //   ★ 这条是**机制性**保证（模块自己挡住），不依赖「前端不去点」✓
    if (cfg.target === 'agent') {
      return {
        ok: false,
        error: {
          kind: 'config',
          message: '智能体 API 模式下不发起模型相关请求（规格禁止探查/列举智能体内部模型）',
          detail: '接入对象为「智能体 API」时，模块仅负责链路连通与请求收发；'
            + '列举模型属于探查智能体内部算力信息，规格明确禁止。'
            + '如需拉取模型清单，请把接入对象切换为「底层基础算力 API」。',
        },
        meta,
      };
    }
    if (!cfg.baseUrl) return { ok: false, error: { kind: 'config', message: '缺少 baseUrl' }, meta };
    // ★★ 2026-10-10 追加（标准 §5 / 参考实现 `generic.py` 的 `list_models`）：`custom`（我方 generic 等价物）的
    //   模型列表**全靠 `extra`**：`models_path`（响应里数组的点号路径）/ `models_url_path`（请求路径）/
    //   `model_id_key`（条目取 id 的键）。
    //   ★ **不配 `models_path` ⇒ 明确「不支持列举模型」**（与参考实现一字对应：`return []`）。
    const extra = isPlainObj(cfg.extra) ? cfg.extra : {};
    const modelsPath = strOr(extra.models_path).trim();
    if (cfg.kind === 'custom' && !modelsPath) {
      return { ok: false, error: { kind: 'config', message: '当前适配器未配置模型列表路径（extra.models_path）⇒ 不支持列举模型' }, meta };
    }
    // 列表请求路径：`models_url_path` 优先 → `path` → 按 kind 内置默认（照参考实现的回落次序）。
    const urlPath = strOr(extra.models_url_path).trim() || strOr(cfg.path).trim()
      || (cfg.kind === 'anthropic' ? '/v1/models' : '/models');
    const url = joinUrl(cfg.baseUrl, urlPath);
    const r = await httpRequestRetry(url, { method: 'GET', headers: authHeaders(cfg), timeoutMs: cfg.timeoutMs });
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
    // ★ `models_path` 显式给 ⇒ 严格按它取；否则回落到内置形状（`data[]` / `models[]` / 顶层数组）。
    const arr = modelsPath ? digPath(json, modelsPath)
      : Array.isArray(json) ? json
        : Array.isArray(json?.data) ? json.data
          : Array.isArray(json?.models) ? json.models : null;
    if (!Array.isArray(arr)) return { ok: false, error: { kind: 'bad-shape', message: '响应里没有模型列表（期望 data[] / models[] 或 extra.models_path 指向的数组）' }, meta };
    const idKey = strOr(extra.model_id_key).trim() || 'id';
    const models = arr
      .map((m) => (typeof m === 'string' ? m : (m && (m[idKey] ?? m.id ?? m.name ?? m.model ?? m.modelKey))))
      .filter(Boolean).map(String);
    return { ok: true, models, meta };
  } catch (e) {
    return { ok: false, error: { kind: 'unknown', message: `未预期异常：${(e && e.message) || e}` } };
  }
}
