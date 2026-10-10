// lib/triple-check.mjs
// 「画面 / 字幕文本 / 语义（原文案）三者一致性校验门」—— **规则 2 唯一允许调用千问 2.5 7B 的地方**。
//
// ★★★ 模型路由规则（用户下达，优先级最高，任何子 prompt / 子 agent 都不能覆盖）★★★
//   1) 主业务推理（生成 / 对话 / 逻辑）一律由 **WorkBuddy 当前生效模型**承担 —— 见 lib/dub-semantic.mjs。
//   2) 「画面 / 字幕文本 / 语义三者是否匹配的对照检测校验」（就是本文件）**默认走「当前生效的
//      算力服务」**（面板 / 覆盖文件，见 `askVlm()`）；该服务调不通、**或不是多模态 VLM**
//      （判据：成功却没读出 `image_text`，见 `askVlm()` 的 RISK-01 配套）时，
//      **回落到本机 LM Studio 的千问 2.5 7B（qwen2.5-vl-7b-official）**（见 `VLM_MODEL`）。
//      ❌ 千问 7B **只准**用于这条校验（回落用），禁止它承担通用生成 / 回答 / 逻辑运算 / 文案创作。
//   3) 二者各司其职，不能混用、不能互相抢占任务。
//
// ★ 本文件是**校验器**，不是生成器：
//   - 提示词里写死「只做对照检测，禁止创作 / 总结 / 改写 / 润色」；
//   - 输出只有判定（一致 / 不一致 / 存疑）+ 位置 + 原因，没有新文案。
//
// ★ 它是 **vlm**（能读图），所以能把「帧图」和「该时刻字幕文本」「原文案」放在一起比对。
//   ★ 实测教训：只喂整帧时，1080x1920 竖屏会被模型内部降采样，**底部字幕读不出来** →
//     会误报「画面上没有字幕」。所以每帧喂**两张图**：
//       附图 1 = 整帧（画面上下文）；附图 2 = 画面底部 32% 的放大裁剪（专门读烧录字幕）。
//     加了附图 2 之后字幕读取稳定。
//   ★ 判定策略 = 「模型负责读字 + 代码负责逐字比对」：
//     模型把画面上的字幕读成文本，**一致/不一致/存疑的结论全部由本文件用归一化字符串比对得出**
//     （OCR 文本 == 字幕文本；字幕文本 ∈ 原文案）。模型自报的 frame_verdict **不参与 verdict**
//     —— 实测它会拿单句字幕去跟整篇原文案比而误判（假阳性），且该误报在 temp=0 下**确定性复现**
//     （6/6 轮 raw 输出逐字节相同，误报「存疑」率 6/48=12.5%，恒定落在同一帧），属系统性误报而非抖动。
//     这样既不会"只会说一致"（确定性比对照样能抓出改字/错位），也不会被模型的过度解读污染。
//
// ★★ 显存红线（真实事故，别踩）：
//   LM Studio 的模型会**常驻显存**（实测 qwen2.5-vl-7b 常驻 ≈7.6GB / 8GB 卡）。此前它把显存吃到
//   7GB，Index-TTS 因此**静默挂死一个多小时**、整套流水线停摆。所以本文件**用完必须卸载** 7B：
//     POST {BASE}/api/v1/models/unload   body {"instance_id":"qwen2.5-vl-7b-official"}  ← 实测可用
//     （任务书写的 POST /api/v0/models/<id>/unload 在本机返回 200 + {"error":"Unexpected endpoint
//       or method"}，**并不真的卸载**，见 unloadModel() 里的说明；这里作为兜底再打一次。）
//   Content-Type 必须 application/json（不带返回 415）。
//   卸载失败**只打一行 warning，绝不抛异常**（校验结果本身仍然有效）。
//
// ★ 出片流程（--style / --analyze / 普通出片）**不得**有任何会自动走到本文件的分支；
//   7B 只在 --verify-triple 真正执行时才会被加载。
//
// ★ 环境约束：本环境 spawnSync 会 EBUSY（dub-core.mjs 里记过），所以一律用异步 spawn
//   （run / runWsl），不用 execFileSync。
//
// 用法（CLI，可独立跑已有成片）：
//   node lib/triple-check.mjs --film <mp4> [--script <file|->] [--srt <file>]
//        [--out <dir>] [--max-frames 8] [--tamper <i>:<文本>] [--quiet]
//   --tamper <i>:<文本>  自测用：把第 i 帧（1 基）喂给模型的「字幕文本」换成 <文本>，
//                        画面上烧录的字幕不动 → 若校验器正常，必须判「不一致」。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, runWsl, shq, winToWsl, parseSrt, normCJK } from './dub-core.mjs';
// ★ 2026-10-08 迁移：本文件**不再自己发 HTTP 对话请求** —— 「发一次对话、取回文本」交给
//   `lib/llm-api.mjs` 的 `chat()`（落实「软件内 LLM 推理任务默认走模块」）。
//   ★ 仍留在本文件里的**不是**对话：`ensureModelLoaded`（JIT 预热触发 + `state` 轮询）与
//     `unloadModel`（LM Studio 私有管理接口）—— 那是**模型生命周期**，属 `lib/vram.mjs` 的边界，
//     **不**并入 `lib/llm-api.mjs`（见 `lib/llm-api.mjs` 文件头 §十 与迁移报告）。
import { chat } from './llm-api.mjs';

// ── 常量 ────────────────────────────────────────────────────────
export const LM_BASE = process.env.LEMO_LMSTUDIO_BASE || 'http://127.0.0.1:12345';
export const VLM_MODEL = 'qwen2.5-vl-7b-official';   // ★ 校验回落用的本机 VLM，不许换（面板优先，见 askVlm）
const CHAT_URL = `${LM_BASE}/v1/chat/completions`;
const UNLOAD_URL_V1 = `${LM_BASE}/api/v1/models/unload`;                     // ★ 实测可用
const UNLOAD_URL_V0 = `${LM_BASE}/api/v0/models/${VLM_MODEL}/unload`;        // 任务书给的写法
const MODEL_STATE_URL = `${LM_BASE}/api/v0/models/${VLM_MODEL}`;

const DEFAULT_MAX_FRAMES = 8;
const DEFAULT_TIMEOUT_MS = 300000;   // 单次 VLM 请求超时（冷启动 1~3 分钟，给足）
const FRAME_SCALE = 720;      // 整帧宽度（画面上下文够用，base64 也不大）
const STRIP_SCALE = 1080;     // 底部字幕条宽度（原生宽度，保证 OCR）
const STRIP_FRAC = 0.32;      // 底部裁多少（相对帧高）
const SCRIPT_REF_CAP = 1200;  // 原文案塞进提示词的上限

const say = (...a) => console.log(...a);
const warn = (s) => console.log(`⚠ ${s}`);

// ── 显存读数（异步 spawn；spawnSync 在本环境会 EBUSY）─────────────
/** 读当前 GPU 显存占用（MiB）。读不到返回 null —— 绝不让它把校验流程搞崩。 */
export async function vramUsedMiB() {
  const r = await run('nvidia-smi', ['--query-gpu=memory.used', '--format=csv,noheader,nounits'], { timeout: 20000 });
  if (r.code !== 0) return null;
  const n = Number(String(r.stdout).trim().split('\n')[0]);
  return Number.isFinite(n) ? n : null;
}

// ── 模型卸载 ────────────────────────────────────────────────────
/**
 * 把 7B 从显存卸掉。**失败只打 warning，不抛异常。**
 *
 * ★ 实测（本机 LM Studio 构建，2026-10）：
 *   - 任务书给的 `POST /api/v0/models/<id>/unload`（Content-Type: json + body `{}`）**不生效** ——
 *     它返回 HTTP 200 但 body 是 `{"error":"Unexpected endpoint or method. ..."}`，
 *     模型**仍留在显存里**（实测 7.9GB 不降）。**光看 HTTP 状态码会被骗。**
 *   - 真正可用的是 `POST /api/v1/models/unload`，body `{"instance_id":"<模型 key>"}`。
 *   - 卸载是**异步释放**的：立刻读显存可能还有残留，几秒后才落回基线。
 * 所以这里：先打 v1（主），再打 v0（兼容任务书写法），最后用
 * `GET /api/v0/models/<id>` 的 `state` **复核**是否真的 not-loaded。
 *
 * ★★ RISK-14（判据：**「复核做不了」≠「卸载成功」**）：只有**确实读到** `state === 'not-loaded'`
 *   时才可声称卸载成功；复核那次请求**自己失败**（fetch 抛错 / HTTP 非 2xx / 取不到 state 字符串）
 *   一律属**「无法复核」** ⇒ 必须 warn 明确原因并 `return false`，**绝不**乐观 `return true`
 *   （否则调用方以为显存已释放 ⇒ 后续 TTS / 渲染静默挂死 —— 本项目踩过这个坑）。
 */
export async function unloadModel() {
  const attempts = [
    { url: UNLOAD_URL_V1, body: { instance_id: VLM_MODEL }, tag: 'v1' },
    { url: UNLOAD_URL_V0, body: {}, tag: 'v0' },
  ];
  const errs = [];
  for (const a of attempts) {
    try {
      const r = await fetch(a.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },   // ★ 不带 → 415（实测）
        body: JSON.stringify(a.body),
      });
      const txt = await r.text();
      let j = null; try { j = JSON.parse(txt); } catch { /* ignore */ }
      if (r.ok && !(j && j.error)) break;                  // 200 + {"error":...} 是假成功
      errs.push(`${a.tag}: HTTP ${r.status} ${txt.slice(0, 120)}`);
    } catch (e) { errs.push(`${a.tag}: ${e?.message || e}`); }
  }
  // 复核：真的从显存退了吗
  // ★★ RISK-14：收尾**不得**是「catch 吞掉 + return true」—— 那正是「复核做不了」被当成
  //    「卸载成功」的假成功。只有**确实读到** `state === 'not-loaded'` 才算成功；下面三条都
  //    属**无法复核** ⇒ warn 明确原因 + return false（保持既有 boolean 返回类型不变）：
  //      ① 复核那次 fetch 自己抛错（典型：LM Studio 已不可用 / 已退出 / 端口不通）；
  //      ② 复核接口 HTTP 非 2xx；③ 200 但响应里取不到 state 字符串。
  try {
    const r = await fetch(MODEL_STATE_URL);
    if (!r.ok) {
      warn(`无法复核 ${VLM_MODEL} 卸载结果（state 接口 HTTP ${r.status}）${errs.length ? `（${errs.join(' | ')}）` : ''}`);
      return false;
    }
    const j = await r.json();
    if (!(j && typeof j.state === 'string')) {
      warn(`无法复核 ${VLM_MODEL} 卸载结果（state 接口未返回 state 字符串）${errs.length ? `（${errs.join(' | ')}）` : ''}`);
      return false;
    }
    if (j.state !== 'not-loaded') {
      warn(`卸载 ${VLM_MODEL} 后 state=${j.state}，显存可能未释放${errs.length ? `（${errs.join(' | ')}）` : ''}`);
      return false;
    }
  } catch (e) {
    warn(`无法复核 ${VLM_MODEL} 卸载结果（复核请求失败，LM Studio 可能已不可达：${e?.message || e}）${errs.length ? `（${errs.join(' | ')}）` : ''}`);
    return false;
  }
  return true;
}

// ── 提示词（纯读字，禁止生成 / 禁止自评）──────────────────────────
// ★ 措辞是调过的，别随手改：
//   1) 早先的版本在 JSON 示例里写了 `"image_text":"……（读不到就写空串）"` —— 模型会**照着
//      占位符输出**：image_text 直接给空串，然后编一句「画面为空」来自圆其说。
//      实测（同一张图、同一时刻）：旧措辞 → image_text=""；现在这版 → 逐字读对。
//      所以示例值必须是**像真结果的合法值**，且不给任何"读不到就写空"的台阶。
//   2) 本提示词**只要求模型输出 image_text**（画面 OCR），不再要求 frame_verdict /
//      subtitle_match / semantic_match —— 后三者代码要么不消费、要么只会引入系统性误报
//      （见文件头 :20 与 decide() 的说明）。模型不再被要求「下结论」，只负责「读字」。
//   3) ★★ RISK-01（2026-10-10 修复，判据：**答案不能在提示词里**）：
//      本函数**曾**把两行答案直接写进提示词 —— `【该时刻字幕文本】<subtitle>` 与
//      `【原文案（语义基准）】<scriptRef>`。危害：一个**看不到图的纯文本模型**（面板那套若配的是
//      文本模型，`askVlm()` 的「面板优先」就会把它请来）只要把这两行**照抄**进 `image_text`，
//      `decide()` 的确定性比对（`ni === ns` / `nscript.includes(ns)`）就会判「一致」——
//      **画面根本没被读，质检却报通过**（静默产坏结论）。
//      ★ 关键事实：比对**本来就在代码里做**（见 `decide()`），模型**只负责抄录**、且本提示词明确
//        要求它「严禁判断/评价」⇒ 那两行对模型**毫无用处**，纯属**答案泄漏**。
//      ⇒ 已删除，改为 **blind transcription**：模型**只能从附图里读字**，无从照抄。
//      ★ 形参 `subtitle` / `scriptRef` **有意保留但不参与拼装**（调用点与既有签名不变）；
//        **绝不允许**把它们插回提示词 —— 答案一旦进提示词，本校验门就退化成空转。
export function buildPrompt({ subtitle, scriptRef }) {
  return [
    '你是「画面烧录字幕的抄录器」。你的唯一职责是把画面上的字幕**逐字抄下来**。',
    '严禁创作、改写、润色、总结、扩写、翻译，也严禁做任何判断或评价。你只输出抄录结果。',
    '',
    '你要读的画面（见附图）：',
    '【画面】见附图 1（成片该时刻的整帧）。',
    '【字幕区域放大】见附图 2（画面底部裁剪放大，用来读画面上烧录的字幕）。',
    '',
    '请执行：',
    '把附图 2（必要时结合附图 1）里画面上烧录的字幕原文**一字不差地**抄下来，填进 image_text。',
    '不要做任何判断、评价或结论，只做抄录。',
    '',
    '只输出一个 JSON 对象，不要 markdown 代码块：',
    '{"image_text":"画面上烧录的字幕原文"}',
  ].join('\n');
}

// ── 调 VLM ──────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 确保模型已在显存里（LM Studio 是 JIT 加载：冷启动那次请求要 1~3 分钟，且会把首帧请求拖到超时）。
 * 做法：先发一个极小的请求触发加载，再轮询 `/api/v0/models/<id>` 的 state 直到 loaded。
 * 失败只 warning —— 正式请求仍会照发。
 */
export async function ensureModelLoaded(timeoutMs = 300000) {
  // 触发 JIT 加载（不 await 它，加载中该请求自己会挂很久）
  fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VLM_MODEL, temperature: 0, max_tokens: 1, stream: false,
      messages: [{ role: 'user', content: 'ok' }],
    }),
  }).catch(() => { /* 触发用，失败无所谓 */ });

  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(MODEL_STATE_URL);
      if (r.ok) {
        const j = await r.json();
        if (j && j.state === 'loaded') return true;
      }
    } catch { /* ignore */ }
    await sleep(2000);
  }
  warn(`等待 ${VLM_MODEL} 加载超时（${Math.round(timeoutMs / 1000)}s），仍继续尝试判定`);
  return false;
}
// ★★ 2026-10-10 重设计（**面板优先 + 本机回落**）—— 落实委托方规格：
//   「AI 算力板块内接入的**所有模型为项目全局可用**，项目里**全部业务功能都可以使用该算力**，
//    并非仅限单一业务场景。**算力配置修改、模型切换之后，全局所有业务同步生效**。
//    底层调用复用【通用 AI 算力 API 接入模块】能力。」
//   ⇒ 本函数的调用**默认走「当前生效的算力服务」**（`lib/llm-api.mjs` 的覆盖文件 / 面板），
//     即 `chat()` 解析优先级里的第 ③ 层（显式 → `LEMO_LLM_*` → **覆盖文件（面板）** → 运行时线索 → 内置默认）。
//   · ★ 为什么此前会坏：早先 `askVlm` 给 `chat()` 传了 `target/kind/baseUrl/model`（显式 = 优先级 ①）
//     ⇒ 把面板（③）**整个压掉**。**实测**：面板里存 `panel-svc`（`model=panel-model-x`）并
//     `setActiveService('panel-svc')`，再照旧形状调 `chat()` ⇒ 面板桩收到 **0** 条、本机 LM 桩收到 1 条
//     ⇒ 面板里「当前生效」那套一次都没被用到，直接违反上面「全局所有业务同步生效」。
//   ⇒ 现在：**只传任务参数**（`timeoutMs` / `maxTokens` / `temperature` / `images`），
//     **不传** `target` / `kind` / `baseUrl` / `model` —— 连 `target` 也去掉：面板那套服务是
//     `agent` 还是 `model` 由**面板**决定，不由本函数钉。
//   · ★★ 回落（**不许静默**）：若「面板路径」失败（`r.ok === false`）⇒ **再试一次**「本机 LM Studio
//     VLM」路径（显式 `kind:'openai-compatible'` + `baseUrl:${LM_BASE}/v1` + `model:VLM_MODEL`
//     + `target:'model'`）。理由：**画面校验需要「多模态图片输入」**，而面板那套可能是**纯文本模型**；
//     委托方另有明令「**核心能力不可删减**」⇒ 不能让帧校验因为面板配了文本模型就直接坏掉。
//   · ★★ RISK-01 配套（**本批新增，绝不静默**）：面板路径**成功但没读出字**（解析其回复得到的
//     `image_text` 为空串）时**也回落**本机 VLM 一次 —— 因为「成功却没读出字」多半说明面板那套
//     **看不到图**（纯文本模型），此时本机 VLM 才是唯一能真读画面的一条路。
//     ★ 为什么不静默：回落成功时额外带 `panelNoImageText: true`（= **为什么回落**），让「面板那套
//       看不到图」这件事**在报告里可见**（与 `panelError` 同型，都是如实标注）。
//     ★ 语义红线（**必须写清**）：**画面校验必须有「能看图」的模型**；面板那套若看不到图 ⇒ 要么
//       **回落本机 VLM**、要么判**「存疑」**，**绝不允许**判「一致」（答案不进提示词 + 空 `image_text`
//       会被 `decide()` 兜成「存疑」，见 `decide()` 的 `subtitleMatch === null` 分支）。
//   · ★★ 返回**如实标注**走了哪条路（**增量**字段，上层不受影响）：
//       `via: 'panel'`（面板路径成功且读出了字）/ `'local-vlm'`（回落成功）/ `'none'`（两条都失败）；
//     回落成功时额外带**回落原因**：面板**失败** ⇒ `panelError`（形如 `<kind>: <message>`）；
//     面板**成功但没读出字** ⇒ `panelNoImageText: true`。
//   · ★ 两条都失败 ⇒ `{ok:false, error}`，且 `error` 里**同时**含面板侧与本地侧的原因（**绝不静默**）。
//   · ★ 既有字段名与语义（`ok` / `text` / `error`）**保持不变** ⇒ `verifyTriple` 的消费方式不变。
//   · `baseUrl` = `${LM_BASE}/v1` 仍读覆盖点 `LEMO_LMSTUDIO_BASE`（`LM_BASE` 见文件头常量），
//     故该覆盖点**照旧有效**；本模块**不**把 `LEMO_LMSTUDIO_BASE` 塞进 `lib/llm-api.mjs`
//     （那是**另一个模块**的覆盖点，`scripts/check-env-overrides.mjs` 里登记的唯一读者就是本文件）。
//   · 画面帧走 `opts.images`（多模态便利入参）：由模块按 `kind` 自动转成 `image_url` 内容块，
//     注入**最后一条 user 消息**（整帧在前、字幕条在后，顺序不变）。
//   · `temperature:0` / `maxTokens:400` 与迁移前**逐字相同**。
//   · ★★ 与重试的关系（最终语义，务必知悉）：`askVlm()` 内部做「面板 → 失败 → 本机」；
//     `askVlmRetry()` 保持「整体再来一遍」的外层语义 ⇒ **单帧最坏情况 2×2 = 4 次** HTTP 调用
//     （面板失败 → 本机失败，再整体重试一遍）。这是**有意**的：两者兜的是不同的抖动
//     （回落兜「面板那套不是 VLM」，重试兜「冷启动 / 偶发 5xx」）。
async function askVlm({ images, subtitle, scriptRef, timeoutMs }) {
  const messages = [
    { role: 'system', content: '你是严格的画面字幕抄录器，只输出 JSON 抄录结果，禁止任何创作、改写与判断。' },
    { role: 'user', content: buildPrompt({ subtitle, scriptRef }) },
  ];
  const imgs = images.map((b64) => ({ base64: b64 }));
  // ① 面板优先：**只传任务参数** ⇒ `chat()` 走「当前生效的算力服务」（解析优先级 ③）。
  const panel = await chat(messages, { timeoutMs, maxTokens: 400, temperature: 0, images: imgs });
  // ★★ RISK-01 配套：面板路径**成功**时，还要看它**到底有没有从画面读出字**（`image_text` 非空）。
  //   ★ 只有「成功 **且** 读出了字」才算真走了面板（`via:'panel'`）；「成功但 `image_text` 为空」
  //     多半说明面板那套**看不到图**（纯文本模型）⇒ 与「面板失败」一样**回落**本机 VLM（绝不静默）。
  const panelImageText = panel.ok ? String(parseVerdict(panel.text).imageText || '').trim() : '';
  if (panel.ok && panelImageText) return { ok: true, text: panel.text, via: 'panel' };
  // 走到这里 = 面板**失败**，或面板**成功却没读出字** ⇒ 回落本机 LM Studio 的视觉模型（见上方说明）。
  // ★ 面板侧原因如实区分：失败 ⇒ `panelError`；成功但无字 ⇒ `panelNoImageText`。
  const panelError = panel.ok ? null : `${panel.error.kind}: ${panel.error.message}`;
  const panelNoImageText = panel.ok ? true : false;
  // ② 回落本机 VLM（`target:'model'` **必须显式给**：不传时会落到默认 profile `workbuddy`
  //    （其 `target:'agent'`）⇒ `shouldSendModel()` 恒 false ⇒ **请求体里的 `model` 会被丢掉**，
  //    请求形状就变了）。
  const local = await chat(messages, {
    target: 'model',
    kind: 'openai-compatible',
    baseUrl: `${LM_BASE}/v1`,
    model: VLM_MODEL,
    timeoutMs,
    maxTokens: 400,
    temperature: 0,
    images: imgs,
  });
  if (local.ok) {
    return {
      ok: true, text: local.text, via: 'local-vlm',
      ...(panelError ? { panelError } : {}),
      ...(panelNoImageText ? { panelNoImageText: true } : {}),
    };
  }
  // ③ 两条都失败 ⇒ 两个错误都要能看见（绝不静默）。
  // ★★ `chat()` **永不抛** —— 一切失败（超时 / 非 JSON / **取不到文本** / HTTP 非 2xx / 网络不可达）
  //   都归一为 `{ok:false,error:{kind,message}}`。★ **取不到判定文本 = 失败**：`kind` 会是
  //   `bad-shape`（200 但响应里取不到文本路径）或 `empty-output`（取到空串）—— 二者都落到这里
  //   ⇒ 上层记 `errors[]` + 该帧 `verdict='存疑'`，**绝不**被静默当成「一致」。
  //   （见 `test/triple-check-flow.test.mjs` 用例⑪：桩回 200 + `{"error":…}` ⇒ 该帧判「存疑」。）
  const panelWhy = panelNoImageText ? 'panel-ok-but-no-image_text' : panelError;
  return {
    ok: false,
    error: `panel(${panelWhy}) | local-vlm(${local.error.kind}: ${local.error.message})`,
    via: 'none',
    ...(panelError ? { panelError } : {}),
    ...(panelNoImageText ? { panelNoImageText: true } : {}),
  };
}

/** 带 1 次重试的调用：冷启动 / 偶发 5xx 时兜一下，避免把抖动记成「存疑」。
 *  ★ 外层语义 = 「整体再来一遍」：即把 `askVlm`（面板 → 失败 → 本机）**整条**再跑一次
 *    ⇒ 单帧最坏 4 次 HTTP 调用（见 `askVlm` 顶部「与重试的关系」）。 */
async function askVlmRetry(args) {
  let last = await askVlm(args);
  if (last.ok) return last;
  await sleep(1500);
  last = await askVlm(args);
  return last;
}

/** 从模型回复里抠出 JSON（容忍代码块 / 前后废话）。 */
export function parseVerdict(txt) {
  const s = String(txt ?? '');
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) {
    try {
      const o = JSON.parse(s.slice(i, j + 1));
      return {
        // ★ 非判定字段（仅供回溯）：模型已不再被要求回 frame_verdict，缺省 / 非法一律记 null，不报错。
        modelVerdict: ['一致', '不一致', '存疑'].includes(o.frame_verdict) ? o.frame_verdict : null,
        imageText: typeof o.image_text === 'string' ? o.image_text : '',
        // ★ 曾在此解析模型的 subtitle_match / semantic_match 两个自报字段，已删除：
        //   全文件（decide / frames.push / report / CLI）从未引用它们 —— 输出 JSON 里也从来没有，
        //   删除不改变输出结构。且模型的"自报布尔"本就不可信（实测它会拿单句字幕去跟整篇原文案比），
        //   真正的 subtitleMatch / semanticMatch 一律由 decide() 用归一化字符串确定性算出。
        //   ★ 2026-10：提示词也已不再要求模型回这两个字段（连同 frame_verdict 一起去掉），
        //     故 o.frame_verdict 缺省 → modelVerdict 记为 null。解析对缺字段始终宽容，不报错。
        reason: typeof o.reason === 'string' ? o.reason : '',
      };
    } catch { /* fallthrough */ }
  }
  return {
    modelVerdict: null, imageText: '',
    reason: `模型未返回可解析 JSON：${s.slice(0, 120)}`,
  };
}

// ── 抽帧计划 ────────────────────────────────────────────────────
// ★ 只在**字幕确实应该出现的时刻**抽帧（= 字幕窗中点），避免在片头/片尾无字幕帧上误报。
//   若首/中/尾时刻正好落在某条字幕窗内，也一并纳入（上下文帧）。
export function sampleTimes({ cues, filmDur, maxFrames }) {
  const inside = (t) => cues.some((c) => t >= c.start && t <= c.end);
  const picks = [];
  const push = (t, why) => {
    if (!Number.isFinite(t) || t < 0) return;
    if (filmDur && t > filmDur - 0.05) return;
    if (picks.some((p) => Math.abs(p.t - t) < 0.25)) return;
    picks.push({ t, why });
  };
  for (const c of cues) push((c.start + c.end) / 2, 'cue');
  if (filmDur) {
    for (const [t, why] of [[0.15, 'head'], [filmDur / 2, 'mid'], [filmDur - 0.3, 'tail']]) {
      if (inside(t)) push(t, why);
    }
  }
  picks.sort((a, b) => a.t - b.t);
  // ★ maxFrames === 1 时下面的 step 分母为 0 ⇒ Infinity ⇒ picks[NaN] === undefined。
  //   `--max-frames 1` 经 verifyTriple:392 的 Math.max(1, …) 夹取后**可达**，会让抽帧循环
  //   对 undefined 取 .t 直接抛。1 帧时取**中位那一帧**作唯一代表（比首/尾更能代表全片；
  //   maxFrames:2 的既有语义是「首+尾」，1 帧即取两者之中）。
  if (maxFrames < 1) return [];
  if (maxFrames === 1) return picks.length ? [picks[Math.floor((picks.length - 1) / 2)]] : [];
  if (picks.length > maxFrames) {
    const step = (picks.length - 1) / (maxFrames - 1);
    const out = [];
    for (let k = 0; k < maxFrames; k++) out.push(picks[Math.round(k * step)]);
    return out;
  }
  return picks;
}

export function nearestCueText(cues, t) {
  if (!cues.length) return '';
  let best = null, bestD = Infinity;
  for (const c of cues) {
    const d = t < c.start ? c.start - t : (t > c.end ? t - c.end : 0);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best && bestD <= 2.0 ? best.text : '';
}

async function filmDuration(filmWsl) {
  const r = await runWsl(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${shq(filmWsl)}`, { name: 'triple-probe' });
  const n = Number(String(r.stdout).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── 判定合成（模型负责读字，代码负责逐字比对）────────────────────
// ★ 分工是刻意的：7B 的强项是「把画面上的字读出来」，弱项是「下最终结论」——
//   实测它会拿单句字幕去跟**整篇**原文案比，然后判「不一致」并编理由（假阳性）。
//   所以：
//     · 一致 / 不一致 / 存疑的**结论全部只由本文件的确定性比对给出**（OCR 文本 vs 字幕文本；字幕文本 ∈ 原文案）；
//     · 模型自报的 frame_verdict **完全不参与 verdict** —— 曾用它把「一致」升级到「存疑」，
//       2026-10 实测证明它在 temp=0 下会确定性误报（系统性假警报，非抖动），故已移除该影响；
//       字段仍写进 JSON（modelVerdict），仅供事后回溯模型当时说了什么。
export function decide({ subtitle, scriptRef, v }) {
  const ns = normCJK(subtitle);
  const ni = normCJK(v.imageText);
  const nscript = normCJK(scriptRef);

  // 1) 画面烧录字幕 vs 该时刻字幕文本（确定性比对，模型只负责读）
  const subtitleMatch = ni ? (ni === ns) : null;          // null = 模型没读出字，无法判定
  // 2) 该时刻字幕文本 vs 原文案（确定性：字幕句必须逐字出现在原文案里）
  const semanticMatch = (nscript && ns) ? nscript.includes(ns) : null;

  let verdict, reason;
  if (subtitleMatch === false) {
    verdict = '不一致';
    reason = `画面烧录字幕「${v.imageText}」≠ 该时刻字幕文本「${subtitle}」`;
  } else if (semanticMatch === false) {
    verdict = '不一致';
    reason = `该时刻字幕「${subtitle}」在原文案里找不到（疑似改字/错位）`;
  } else if (subtitleMatch === null) {
    // ★ 兜底（**必须保留**）：模型没从画面读出字 → 无法判定 → 「存疑」，绝不误判为「一致」。
    verdict = '存疑';
    reason = `模型没能从画面读出字幕${v.reason ? `（${v.reason}）` : ''}`;
  } else {
    // ★ 模型自报的 frame_verdict **不再参与 verdict**（2026-10 实测：temp=0 下它会**确定性**
    //   误报「不一致」，6/6 轮 raw 输出逐字节相同、恒定发生在同一帧，误报「存疑」率 6/48=12.5%；
    //   而该分支的触发前提已是 subtitleMatch===true && semanticMatch===true，即它**只能**把
    //   「一致」降级成「存疑」、**从不**制造「不一致」→ 纯系统性假警报，故移除该影响）。
    //   字段仍由 parseVerdict 解析、由 frames.push 写进 JSON（modelVerdict），仅供回溯观察。
    verdict = '一致';
    // ★ 展示修正（只改理由的呈现，不碰上面的 verdict 赋值）：
    //   先给**代码算出来的确定性依据**，模型自述降级为括注 —— 因为实测模型会自相矛盾
    //   （frame_verdict 写「一致」、reason 却写「不完全匹配」），裸透传会把矛盾直接甩给用户。
    //   依据严格对应上面两个判定条件：subtitleMatch=true ⇒ OCR 文本 == 字幕文本；
    //   semanticMatch=true ⇒ 字幕文本 ∈ 原文案。
    const basis = semanticMatch === true
      ? '画面烧录字幕与字幕文本逐字相同，且字幕文本逐字出现在原文案中'
      : '画面烧录字幕与字幕文本逐字相同（无原文案，未做语义比对）';
    reason = v.reason ? `${basis}（模型自述：${v.reason}）` : basis;
  }
  return { verdict, reason, subtitleMatch, semanticMatch };
}

// ── 主入口 ──────────────────────────────────────────────────────
/**
 * 画面 / 字幕文本 / 语义 三者一致性校验。
 * @param {object} o
 *   filmHost   成片 mp4 的 Windows 路径（必填）
 *   scriptText 原文案（语义基准）
 *   cues       [{start,end,text}] 字幕时间轴；不给则自动从 film.srt / timeline.json 找
 *   outDir     报告与抽帧落盘目录；默认 = 成片同目录
 *   maxFrames  最多抽几帧（默认 8）
 *   tamper     {i, text} 自测用：替换第 i 帧（1 基）的字幕文本
 *   timeoutMs  单次 VLM 请求超时（默认 180s —— 首次请求含模型加载）
 *   quiet      少打印
 * @returns {Promise<object>} 机器可读报告
 */
export async function verifyTriple(o = {}) {
  const t0 = Date.now();
  const filmHost = path.resolve(o.filmHost);
  if (!fs.existsSync(filmHost)) throw new Error(`成片不存在: ${filmHost}`);
  const filmWsl = winToWsl(filmHost);
  const outDir = o.outDir ? path.resolve(o.outDir) : path.dirname(filmHost);
  const frameDir = path.join(outDir, '_triple');
  fs.mkdirSync(frameDir, { recursive: true });

  // 字幕时间轴：显式 cues > 同目录 film.srt > 同目录 timeline.json
  let cues = Array.isArray(o.cues) ? o.cues : null;
  let cueSource = cues ? 'explicit' : null;
  if (!cues) {
    const srtHost = path.join(path.dirname(filmHost), 'film.srt');
    if (fs.existsSync(srtHost)) { cues = parseSrt(fs.readFileSync(srtHost, 'utf8')); cueSource = 'film.srt'; }
  }
  if (!cues || !cues.length) {
    const tlHost = path.join(path.dirname(filmHost), 'timeline.json');
    if (fs.existsSync(tlHost)) {
      try {
        const arr = JSON.parse(fs.readFileSync(tlHost, 'utf8'));
        cues = arr.map((x) => ({ start: Number(x.t0), end: Number(x.t1), text: String(x.text || '') }));
        cueSource = 'timeline.json';
      } catch { /* ignore */ }
    }
  }
  cues = (cues || []).filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start);

  const scriptRef = String(o.scriptText ?? '').replace(/\s+/g, ' ').trim().slice(0, SCRIPT_REF_CAP);
  const filmDur = await filmDuration(filmWsl);
  const maxFrames = Math.max(1, Number(o.maxFrames) || DEFAULT_MAX_FRAMES);
  const picks = sampleTimes({ cues, filmDur, maxFrames });
  if (!picks.length) throw new Error('抽帧计划为空（拿不到时长也拿不到字幕时间轴）');

  const vramBefore = await vramUsedMiB();
  const frames = [];
  const errors = [];
  const tamper = o.tamper && Number.isFinite(Number(o.tamper.i)) ? { i: Number(o.tamper.i), text: String(o.tamper.text ?? '') } : null;

  // 预热：LM Studio 是 JIT 加载，冷启动那次请求要 1~3 分钟（会把首帧拖到超时）；
  // 先确认模型已进显存，再逐帧判。
  if (!o.quiet) say(`  预热 ${VLM_MODEL}（首次加载可能要 1~3 分钟）…`);
  await ensureModelLoaded(Number(o.timeoutMs) || DEFAULT_TIMEOUT_MS);

  for (let k = 0; k < picks.length; k++) {
    const p = picks[k];
    const i = k + 1;
    const fullHost = path.join(frameDir, `frame${i}_t${p.t.toFixed(2)}.png`);
    const stripHost = path.join(frameDir, `frame${i}_t${p.t.toFixed(2)}_strip.png`);
    const ff = [
      `ffmpeg -hide_banner -nostdin -y -ss ${p.t.toFixed(3)} -i ${shq(filmWsl)} -frames:v 1 -vf scale=${FRAME_SCALE}:-2 ${shq(winToWsl(fullHost))}`,
      `ffmpeg -hide_banner -nostdin -y -ss ${p.t.toFixed(3)} -i ${shq(filmWsl)} -frames:v 1 -vf ${shq(`crop=iw:ih*${STRIP_FRAC}:0:ih*${1 - STRIP_FRAC},scale=${STRIP_SCALE}:-2`)} ${shq(winToWsl(stripHost))}`,
    ].join('\n');
    const r = await runWsl(ff, { name: 'triple-frame' });
    if (r.code !== 0 || !fs.existsSync(fullHost) || !fs.existsSync(stripHost)) {
      errors.push(`第 ${i} 帧抽帧失败 t=${p.t.toFixed(2)}`);
      continue;
    }

    let subtitle = p.text || nearestCueText(cues, p.t) || '';
    let tampered = false;
    if (tamper && tamper.i === i) { subtitle = tamper.text; tampered = true; }

    const images = [fs.readFileSync(fullHost).toString('base64'), fs.readFileSync(stripHost).toString('base64')];
    const res = await askVlmRetry({ images, subtitle, scriptRef, timeoutMs: Number(o.timeoutMs) || DEFAULT_TIMEOUT_MS });
    if (!res.ok) {
      errors.push(`第 ${i} 帧 VLM 调用失败：${res.error}`);
      // ★ 如实标注走了哪条路（`via` = 'none' = 面板与本机 VLM 两条都失败）；`panelError` / `panelNoImageText` 让面板侧原因可见。
      frames.push({ i, t: Number(p.t.toFixed(2)), why: p.why, subtitle, tampered, frame: fullHost, strip: stripHost, verdict: '存疑', error: res.error, via: res.via, ...(res.panelError ? { panelError: res.panelError } : {}), ...(res.panelNoImageText ? { panelNoImageText: true } : {}) });
      continue;
    }
    const v = parseVerdict(res.text);
    const d = decide({ subtitle, scriptRef, v });
    frames.push({
      i, t: Number(p.t.toFixed(2)), why: p.why, subtitle, tampered,
      frame: fullHost, strip: stripHost,
      verdict: d.verdict, imageText: v.imageText,
      subtitleMatch: d.subtitleMatch, semanticMatch: d.semanticMatch,
      modelVerdict: v.modelVerdict, reason: d.reason,
      raw: String(res.text).slice(0, 600),
      // ★★ 如实标注走了哪条路：`via` = 'panel'（面板优先，且真读出了字）/ 'local-vlm'（回落本机 VLM）；
      //   回落时带**回落原因**：面板失败 ⇒ `panelError`；面板成功但没读出字 ⇒ `panelNoImageText:true`。
      //   ★ 增量字段，既有消费方（overall / mismatches / doubtful / errors）不受影响。
      via: res.via,
      ...(res.panelError ? { panelError: res.panelError } : {}),
      ...(res.panelNoImageText ? { panelNoImageText: true } : {}),
    });
    if (!o.quiet) say(`  [${i}/${picks.length}] t=${p.t.toFixed(2)}s → ${d.verdict}${d.reason ? `  （${d.reason}）` : ''}`);
  }

  // 卸载（无论成败都卸，且不抛）
  const unloadOk = await unloadModel();
  const vramAfter = await vramUsedMiB();

  const bad = frames.filter((f) => f.verdict === '不一致');
  const doubt = frames.filter((f) => f.verdict === '存疑');
  const overall = bad.length ? '不一致' : (doubt.length ? '存疑' : '一致');

  const report = {
    ok: errors.length === 0,
    model: VLM_MODEL,
    film: filmHost,
    cueSource,
    cues: cues.length,
    filmDur,
    frames,
    overall,
    mismatches: bad.map((f) => ({ i: f.i, t: f.t, subtitle: f.subtitle, imageText: f.imageText, reason: f.reason })),
    doubtful: doubt.map((f) => ({ i: f.i, t: f.t, reason: f.reason })),
    errors,
    vram: { beforeMiB: vramBefore, afterMiB: vramAfter, unloadOk },
    ms: Date.now() - t0,
  };
  const repHost = path.join(outDir, 'triple-check.json');
  fs.writeFileSync(repHost, JSON.stringify(report, null, 1), 'utf8');
  report.report = repHost;
  report.frameDir = frameDir;
  return report;
}

// ── CLI ─────────────────────────────────────────────────────────
function cliArgs(argv) {
  const o = { maxFrames: DEFAULT_MAX_FRAMES, timeoutMs: DEFAULT_TIMEOUT_MS, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error(`${a} 需要一个值`); return argv[++i]; };
    switch (a) {
      case '--film': o.film = next(); break;
      case '--script': o.script = next(); break;
      case '--srt': o.srt = next(); break;
      case '--out': o.out = next(); break;
      case '--max-frames': o.maxFrames = Number(next()); break;
      case '--timeout': o.timeoutMs = Number(next()); break;
      case '--tamper': {
        const v = next();
        const c = v.indexOf(':');
        if (c < 0) throw new Error('--tamper 形如 <i>:<文本>');
        o.tamper = { i: Number(v.slice(0, c)), text: v.slice(c + 1) };
        break;
      }
      case '--quiet': o.quiet = true; break;
      case '-h': case '--help': o.help = true; break;
      default: throw new Error(`未知参数: ${a}`);
    }
  }
  return o;
}

async function main() {
  const o = cliArgs(process.argv.slice(2));
  if (o.help || !o.film) {
    say(`triple-check —— 画面 / 字幕文本 / 语义 三者一致性校验（唯一允许调用 ${VLM_MODEL} 的地方）

用法:
  node lib/triple-check.mjs --film <mp4> [--script <file|->] [--srt <file>]
       [--out <dir>] [--max-frames 8] [--timeout 300000] [--tamper <i>:<文本>] [--quiet]

  --film        成片 mp4（必填）
  --script      原文案；不给则试同目录 script.txt / lines.json
  --srt         字幕时间轴；不给则自动用同目录 film.srt → timeline.json
  --out         报告与抽帧目录，默认成片同目录
  --tamper      自测：把第 i 帧喂给模型的字幕文本换成 <文本>（画面不动）→ 应判「不一致」
`);
    process.exit(o.film ? 0 : 1);
  }
  let scriptText = '';
  if (o.script) {
    scriptText = o.script === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(o.script), 'utf8');
  } else {
    const dir = path.dirname(path.resolve(o.film));
    for (const f of ['script.txt', 'lines.json']) {
      const p = path.join(dir, f);
      if (!fs.existsSync(p)) continue;
      if (f.endsWith('.json')) {
        try { scriptText = JSON.parse(fs.readFileSync(p, 'utf8')).map((x) => x.text).join(''); } catch { /* ignore */ }
      } else scriptText = fs.readFileSync(p, 'utf8');
      if (scriptText) break;
    }
  }
  const cues = o.srt ? parseSrt(fs.readFileSync(path.resolve(o.srt), 'utf8')) : null;

  say(`triple-check  model=${VLM_MODEL}  film=${o.film}`);
  say(`  显存(前) ${(await vramUsedMiB()) ?? 'n/a'} MiB`);
  const rep = await verifyTriple({ filmHost: o.film, scriptText, cues, outDir: o.out, maxFrames: o.maxFrames, tamper: o.tamper, timeoutMs: o.timeoutMs, quiet: o.quiet });

  say('');
  say(`总体结论：${rep.overall}   （一致 ${rep.frames.filter((f) => f.verdict === '一致').length} / 不一致 ${rep.mismatches.length} / 存疑 ${rep.doubtful.length}）`);
  for (const f of rep.frames) {
    say(`  #${String(f.i).padStart(2)} t=${String(f.t).padStart(6)}s ${f.verdict.padEnd(3)} 字幕「${f.subtitle}」${f.tampered ? '（★ 已篡改）' : ''}`);
    if (f.imageText) say(`        画面读到：「${f.imageText}」`);
    if (f.reason) say(`        ${f.reason}`);
  }
  if (rep.errors.length) { say(''); for (const e of rep.errors) warn(e); }
  say('');
  say(`  显存(后) ${rep.vram.afterMiB ?? 'n/a'} MiB  卸载=${rep.vram.unloadOk ? 'ok' : 'failed(仅 warning)'}  用时 ${rep.ms}ms`);
  say(`  报告 ${rep.report}`);
  process.exit(rep.overall === '不一致' ? 2 : 0);
}

// 仅当被直接执行时跑 CLI（被 dub.mjs import 时不跑）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { warn(`triple-check 失败：${e?.stack || e}`); process.exit(1); });
}
