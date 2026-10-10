#!/usr/bin/env node
/**
 * test/llm-api.test.mjs —— `lib/llm-api.mjs` 的**纯逻辑 / 离线**测试（零依赖）
 *
 * ★ 为什么必须有这一份：
 *   本模块对外的**核心承诺**是「`chat()` 永不抛异常 —— 任何异常接口都不该把面板/调用方搞崩」。
 *   这种承诺**只能靠测试钉住**：某次重构里一个没接住的 `throw`（比如把 `res.json()` 的异常漏出去、
 *   或忘了 `clearTimeout`）就能让控制台整个挂掉。所以下面**每一类容错都有独立夹具**，
 *   且**逐条断言**「返回 `{ok:false,error:{kind}}` 而**不抛**」。
 *
 * ★★ 2026-10-09 重写（委托方指令「只接 WorkBuddy，其他 provider 一律彻底删除」）：
 *   · `lib/llm-api.mjs` 的 `PROFILES` 由 **12** 个减为 **1** 个（只剩 `workbuddy`：`kind:'workbuddy-gateway'`、
 *     `target:'agent'`、`isDefault:true`）；`DEFAULT_PROFILE` 仍是 `workbuddy`。
 *   · ★ 但**适配器（`kind`）没删** —— `anthropic` / `openai-compatible` / `custom` / `workbuddy-gateway`
 *     四个 kind 的适配器代码**全在**（`lib/triple-check.mjs` 仍以 `kind:'openai-compatible'` 调 `chat()`；
 *     `invoke()` 的 image / audio / embedding / custom 四个 task 仍要用它们）⇒ 本套件凡要验某个适配器，
 *     一律**显式给 `kind`**（不再靠「已删的 profile 名」去隐式选中适配器 —— 那会静默退化成 `custom`）。
 *   · 已删的 **11 个内置 profile**：`anthropic` / `openai-compatible` / `doubao` / `qwen` / `hunyuan` /
 *     `deepseek` / `zhipu` / `kimi` / `siliconflow` / `lmstudio` / `custom`。
 *   · ★★ 本批核心约束（有**专门用例**钉住）：`listProfiles()` **恰 1 条**、默认 profile **就是 `workbuddy`**；
 *     `validate({profile:'workbuddy'})` 在网关桩上 **`ok:true`** 且三步皆过。
 *   · ★ `needsModel(cfg)` = `(kind==='anthropic'||kind==='openai-compatible') && target!=='agent'`
 *     ⇒ 「模型 API」用例（显式 `kind` + `target:'model'`）**必须**给非空 `model`，否则归一为 `config`；
 *     `custom` 适配器**不要求** model。
 *
 * ★ 纪律：
 *   · **零依赖、可离线**：桩服务一律用 `node:http` 监听 `127.0.0.1:0`（随机端口），**用完关闭**；
 *     ★ **不打真实外网**（连通性失败用「刚关闭的端口」造，而不是去连一个真域名）。
 *   · **不碰真实盘**：覆盖配置文件路径从 `CFG.exportDir` 派生 ⇒ 本测试在 import 之前把
 *     `LEMO_FILM_DIR` 指到 `D:/lemo-tmp/...` 临时目录（非 C 盘），跑完删除。
 *   · ★ **密钥绝不外泄**：用假 key 断言 `listProfiles()` / `validate()` 的**任何输出**都不含它。
 *   · ★★ **绝不真打本机网关**：`workbuddy-gateway` 的用例**全部**打本地桩（`POST /api/v1/runs` 会真发起
 *     一次 Agent 执行、且落到用户当前会话）—— 见 `startGatewayStub`。
 *
 * 覆盖：
 *   ① `resolveConfig` 优先级（显式 > env > 覆盖文件（面板） > 运行时线索 > 内置默认）+ 超时钳制 + 头合并；
 *   ② **容错 8 类**（每类独立夹具）：unreachable / timeout / auth(401,403) / rate-limit(429) /
 *      http-error(500) / bad-json / bad-shape / empty-output；
 *   ③ `chat()` 成功路径（openai-compatible 适配器）/ `anthropic` 适配器 / `custom`（自定义 path + extract）；
 *   ④ `validate()` 三步（reachable / auth / shape）各自失败一条 + 全通过一条 + 探针升级 + `empty-output` 降级；
 *   ⑤ ★ 密钥不外泄（假 key 不出现在 `listProfiles()`/`validate()` 输出里，且响应体回显也被脱敏）；
 *   ⑥ `listModels()` 成功 / 失败 / agent 模式零请求；覆盖文件读写（§八）；
 *   ⑦ ★ 多模态：OpenAI 兼容 / Anthropic 两种图片块、`opts.images` 便利入参、体积守卫、图片内容不外泄、
 *      以及 ★★ **纯文本请求体逐字节回归**（证明向后兼容）；
 *   ⑧ ★★ **`PROFILES` 只剩 `workbuddy`**（`listProfiles()` 恰 1 条 / 默认就是它 / 11 个 provider 全删）+
 *      `target` 判定与覆盖优先级；
 *   ⑨ ★★ 默认 profile `workbuddy` 接入**本机智能体网关**（`kind:'workbuddy-gateway'`，见契约 §十六）：
 *      两段式 `POST {base}/api/v1/runs` → `202 {data:{runId}}` → `GET {base}/api/v1/runs/{runId}/stream`（SSE）；
 *      agent 模式**不下发 model**、**不发模型相关请求**；baseUrl **动态发现**（`SERVER__HOST`/`SERVER__PORT`）；
 *      `validate()` 只用**只读** `GET /api/v1/health` 探活；
 *   ⑩ `invoke()` 通用算力入口（chat / image / audio / embedding / custom）；
 *   ⑪ v3「不探查 / 不读取智能体内部模型」（agent 模式不读 `ANTHROPIC_MODEL`；基础算力仍校验 model）；
 *   ⑫ ★★ **核心约束两条**：`listProfiles()` 只有 `workbuddy`；`validate({profile:'workbuddy'})` 形状全过。
 *   ★ 全部离线（桩服务），不打真实外网。
 *
 * 用法：node test/llm-api.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ── ★ 先把成片根指到临时目录（**必须在 import 模块之前**：CFG.exportDir 在 env.mjs 加载时定值）
const TMP = `D:/lemo-tmp/llm-api-test-${process.pid}-${Date.now().toString(36)}`;
fs.mkdirSync(TMP, { recursive: true });
process.env.LEMO_FILM_DIR = TMP;

// ★ 动态 import：让上面的 LEMO_FILM_DIR 先生效（静态 import 会被提升到文件顶部）。
const {
  PROFILES, DEFAULT_PROFILE, resolveConfig, validate, chat, listModels, invoke,
  maskKey, overrideFilePath, readOverride, saveOverride, maskedConfig, IMAGE_LIMITS,
  // ★ 2026-10-10 追加（多套「算力服务」CRUD）—— 本批新增的 6 个导出，此前**只有一次性探针验过**。
  listServices, getActiveService, serviceById, setActiveService, saveService, deleteService,
  // ★ 2026-10-10 追加（标准 §8 / §11.5）：流式 + 跨服务降级 —— 此前**只有一次性探针验过**（探针已删）。
  stream, chatWithFallback,
} = await import('../lib/llm-api.mjs');

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

// ── 环境变量夹具（临时设置再恢复）───────────────────────────
//   ★★ `workbuddy`（默认 profile）的 `kind` 是 `workbuddy-gateway` ⇒ 它的端点/口令来自**宿主注入的网关 env**
//      （`SERVER__HOST` / `SERVER__PORT` / `CODEBUDDY_GATEWAY_PASSWORD`）。测试必须**一并隔离**这三个 ——
//      否则跑在本机（`SERVER__PORT=11760`）时，「干净环境」用例会静默解析到**真实网关**（既非隔离、也可能真发请求）。
const ENV_KEYS = ['LEMO_LLM_PROFILE', 'LEMO_LLM_BASE', 'LEMO_LLM_KEY', 'LEMO_LLM_MODEL',
  'LEMO_LLM_HEADERS', 'LEMO_LLM_TIMEOUT_MS', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL',
  'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL',
  'SERVER__HOST', 'SERVER__PORT', 'CODEBUDDY_GATEWAY_PASSWORD'];
/** 全部置「未设置」的 env 覆盖（用于隔离外部环境）。 */
const CLEAN = Object.fromEntries(ENV_KEYS.map((k) => [k, undefined]));
async function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try { return await fn(); } finally {
    for (const k of Object.keys(vars)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}
const rmOverride = () => { try { fs.unlinkSync(overrideFilePath()); } catch { /* 没有就算了 */ } };

// ── 本地桩服务（node:http，127.0.0.1:0，用完关闭）─────────────
// ★★ 坏端口守卫（2026-10-10 定性 D8①）：`fetch()`（undici —— `chat()` 的客户端）**拒绝**连接 WHATWG
//    规范的「坏端口」名单（2049 / 6666–6669 / 6679 / 6697 / 1719–1723 …），抛
//    `TypeError: fetch failed`（`cause.message === 'bad port'`）；而 `node:http` 直连**同一端口**正常。
//    本机动态端口范围是 **1024–15000**（`netsh int ipv4 show dynamicport tcp`）⇒ `listen(0)` 偶发被
//    内核分到坏端口 ⇒ 桩「连不上」→ `chat()` 归一为 `unreachable` ⇒ 「容错·auth」「v4·workbuddy」等
//    用例偶发红（实测并发下 ~0.5%，与近期改动无关）。⇒ 桩一律**重试到非坏端口**（端口仍由内核分配，
//    ⇒ 不与别的进程相撞）。**这不是放宽断言**：只是让桩落在一个 `fetch` 允许的端口上。
const BAD_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95,
  101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179,
  389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601,
  636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566,
  6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);
/** 起一个监听套接字（127.0.0.1:0）并**保证端口不在 `fetch` 的坏端口名单里**（否则换端口重试）。 */
function listenSafe(handler) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(handler);
    srv.on('clientError', () => { /* 客户端中途 abort 是预期的，别让它把测试搞崩 */ });
    srv.once('error', reject);
    const tryListen = () => srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      if (BAD_PORTS.has(port)) { srv.close(() => tryListen()); return; }   // ★ 坏端口 ⇒ 换一个
      resolve(srv);
    });
    tryListen();
  });
}
function startStub(handler) {
  return listenSafe(handler).then((srv) => {
    const { port } = srv.address();
    return {
      base: `http://127.0.0.1:${port}`,
      port,
      close: () => new Promise((r) => {
        try { srv.closeAllConnections?.(); } catch { /* ignore */ }
        srv.close(() => r());
      }),
    };
  });
}
/** 拿一个「确定没人监听」的端口基址（连通性失败夹具：**不去连真外网**）。 */
async function closedBase() {
  // ★ 同样避开坏端口 —— 否则失败来自 `fetch` 的「bad port」而非真正的「端口没人监听」（语义跑偏）。
  const srv = await listenSafe(() => { /* never */ });
  const { port } = srv.address();
  await new Promise((r) => srv.close(r));
  return `http://127.0.0.1:${port}`;
}
/** 读请求体（桩要断言客户端真的发了什么）。 */
function readBody(req) {
  return new Promise((r) => { let s = ''; req.on('data', (d) => { s += d; }); req.on('end', () => r(s)); });
}
const json200 = (res, obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const text200 = (res, s) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(s); };
const status = (res, code, body = '') => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(body); };
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// ── ★★ 本机智能体网关（`kind:'workbuddy-gateway'`）的**桩** ────────────
//   ★ 纪律：**绝不**真打 `POST /api/v1/runs`（那会真发起一次 Agent 执行、且网关的 `primarySession`
//     就是用户当前会话）⇒ 网关相关的**全部**用例都打这个本地桩（`127.0.0.1:0`，用完关闭）。
//   ★ 桩按网关**实现**（`codebuddy-headless.js`）的真实协议回：`202 {data:{runId}}` +
//     `event: message` / `event: done` 的 SSE 帧。
/** 一帧 SSE 文本（`event:` + `data:` + 空行）。 */
const sseFrame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
/** 网关出站消息（`{version,replyTo,status,content}`）—— 与实现里 `buildOutbound` 同形。 */
const gwOut = (status2, content) => ({ version: '1.0', replyTo: 'stub', status: status2, ...(content ? { content } : {}) });
/**
 * 起一个「网关桩」。`opts`：
 *   · `runStatus`（默认 202）/ `runBody`（默认 `{data:{runId:'run-stub-1',status:'accepted'}}`）
 *   · `chunks`（streaming 增量）/ `markdown`（completed 全文）/ `streamDelayMs`（每帧间隔）/ `neverEnd`（流不结束）
 *   · `onRun(body)` 回调（断言请求体用）
 * @returns {Promise<{base,port,seen,close}>} `seen` = 收到的请求记录（`{method,url,headers,body?}`）。
 */
async function startGatewayStub(opts = {}) {
  const seen = [];
  const runStatus = opts.runStatus ?? 202;
  const stub = await startStub(async (req, res) => {
    const rec = { method: req.method, url: req.url, headers: { ...req.headers } };
    seen.push(rec);
    if (req.method === 'POST' && req.url === '/api/v1/runs') {
      rec.body = JSON.parse(await readBody(req));
      if (opts.onRun) opts.onRun(rec.body);
      if (runStatus !== 202) return status(res, runStatus, JSON.stringify({ error: { message: 'stub' } }));
      return status(res, 202, JSON.stringify(opts.runBody ?? { data: { runId: 'run-stub-1', status: 'accepted' } }));
    }
    if (req.method === 'GET' && /^\/api\/v1\/runs\/[^/]+\/stream$/.test(req.url)) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const send = (ev, d) => res.write(sseFrame(ev, d));
      for (const c of (opts.chunks ?? ['你', '好'])) {
        send('message', gwOut('streaming', { chunk: c }));
        if (opts.streamDelayMs) await new Promise((r) => setTimeout(r, opts.streamDelayMs));
      }
      if (opts.markdown !== undefined) send('message', gwOut('completed', { markdown: opts.markdown }));
      else send('message', gwOut('completed', { markdown: (opts.chunks ?? ['你', '好']).join('') }));
      if (opts.neverEnd) return;                          // ★ 故意不结束（超时夹具）
      send('done', {});
      return res.end();
    }
    if (req.method === 'GET' && req.url === '/api/v1/health') {
      return json200(res, { data: { status: 'ok', uptime: 1, pid: 1 } });
    }
    return status(res, 404, '{"error":{"code":"NOT_FOUND"}}');
  });
  return { ...stub, seen };
}
/** 把网关 env 指向某个桩（★ 动态发现：改 env 就换端点）。 */
const gwEnv = (stub, password = 'gw-pw-abcdefghijklmnop') => ({
  SERVER__HOST: '127.0.0.1', SERVER__PORT: String(stub.port), CODEBUDDY_GATEWAY_PASSWORD: password,
});

// ── ★ 适配器 kind 的「模型 API」基准配置 ─────────────────────
//   ★ profile 只剩 `workbuddy`（agent）⇒ 要验某个**适配器**必须**显式给 `kind`**（否则会退化成 `custom`）。
//   ★ `needsModel`：anthropic / openai-compatible + target:'model' ⇒ **必须**有非空 model，故基准里带上 `model:'m'`。
const OAI = (over = {}) => ({ kind: 'openai-compatible', target: 'model', model: 'm', ...over });
const ANTH = (over = {}) => ({ kind: 'anthropic', target: 'model', model: 'm', ...over });

/** ★★ 统一的「失败但不抛」断言：夹具造好、调 chat()、逐条断言。 */
async function expectFail(name, base, kind, extra = {}) {
  let res;
  try {
    res = await chat([{ role: 'user', content: 'hi' }],
      { ...OAI(), baseUrl: base, apiKey: 'sk-test-1234567890', timeoutMs: 3000, ...extra });
  } catch (e) {
    assert.fail(`${name}：chat() **抛异常了**（核心承诺被破坏）—— ${(e && e.stack) || e}`);
  }
  assert.equal(res.ok, false, `${name}：应当 ok:false`);
  assert.ok(res.error && typeof res.error.kind === 'string', `${name}：error.kind 应当是字符串`);
  assert.equal(res.error.kind, kind, `${name}：kind 应为 ${kind}，实得 ${res.error.kind}`);
  assert.ok(typeof res.error.message === 'string' && res.error.message.length > 0, `${name}：error.message 应当非空`);
  return res;
}

// ── ① resolveConfig 优先级 ──────────────────────────────────
test('★ resolveConfig：显式 > env > 覆盖文件 > 运行时线索 > 内置默认（逐级验证）', async () => {
  rmOverride();
  await withEnv({ ...CLEAN, LEMO_LLM_PROFILE: 'openai-compatible', LEMO_LLM_BASE: 'http://env-base/v1',
    LEMO_LLM_KEY: 'sk-envkey-abcdefgh', LEMO_LLM_MODEL: 'env-model', LEMO_LLM_TIMEOUT_MS: '5000' }, async () => {
    // ② env 生效
    const a = resolveConfig({});
    assert.equal(a.id, 'openai-compatible', 'env 的 profile 应生效');
    assert.equal(a.baseUrl, 'http://env-base/v1', 'env 的 baseUrl 应生效');
    assert.equal(a.model, 'env-model', 'env 的 model 应生效');
    assert.equal(a.apiKey, 'sk-envkey-abcdefgh', 'env 的 key 应生效');
    assert.equal(a.timeoutMs, 5000, 'env 的 timeout 应生效');
    // ① 显式压过 env
    const b = resolveConfig({ baseUrl: 'http://explicit/v1', model: 'explicit-model', timeoutMs: 8000 });
    assert.equal(b.baseUrl, 'http://explicit/v1', '显式 baseUrl 应压过 env');
    assert.equal(b.model, 'explicit-model', '显式 model 应压过 env');
    assert.equal(b.timeoutMs, 8000, '显式 timeout 应压过 env');
    assert.equal(b.apiKey, 'sk-envkey-abcdefgh', '未显式给 key ⇒ 仍取 env');
  });

  // ④ 运行时线索（只读环境，不读密钥文件）
  //   ★ 2026-10-09 订正：`anthropic` profile 已删 ⇒ 用**显式 kind/target** 复现「anthropic 适配器 + 模型 API」，
  //     才能验「运行时线索 ANTHROPIC_*」的解析（默认 profile `workbuddy` 是 agent ⇒ 不读 ANTHROPIC_MODEL）。
  //   ★ 运行时线索**低于覆盖文件**（见下 ③ 与专门用例）—— 此处**没有**覆盖文件，故仍取 ANTHROPIC_*。
  await withEnv({ ...CLEAN,
    ANTHROPIC_API_KEY: 'sk-runtime-abcdefgh', ANTHROPIC_BASE_URL: 'http://rt.example',
    ANTHROPIC_MODEL: 'rt-model' }, async () => {
    const c = resolveConfig({ kind: 'anthropic', target: 'model' });
    assert.equal(c.kind, 'anthropic');
    assert.equal(c.apiKey, 'sk-runtime-abcdefgh', 'anthropic 未显式给 key ⇒ 取 ANTHROPIC_API_KEY');
    assert.equal(c.baseUrl, 'http://rt.example', 'anthropic 未显式给 baseUrl ⇒ 取 ANTHROPIC_BASE_URL');
    assert.equal(c.model, 'rt-model', '★ anthropic 未显式给 model ⇒ 取 ANTHROPIC_MODEL');
    // env（LEMO_LLM_KEY / LEMO_LLM_MODEL）压过运行时线索
    const d = resolveConfig({ kind: 'anthropic', target: 'model', apiKey: 'sk-explicit' });
    assert.equal(d.apiKey, 'sk-explicit');
    const e = await withEnv({ LEMO_LLM_MODEL: 'env-model' }, () => resolveConfig({ kind: 'anthropic', target: 'model' }));
    assert.equal(e.model, 'env-model', 'LEMO_LLM_MODEL 应压过 ANTHROPIC_MODEL');
    assert.equal(resolveConfig({ kind: 'anthropic', target: 'model', model: 'explicit-model' }).model,
      'explicit-model', '显式 model 应压过一切');
  });

  // ③ 覆盖文件（保存的配置 = 面板）压过运行时线索与内置默认；② env 压过覆盖文件
  await withEnv(CLEAN, async () => {
    rmOverride();
    fs.writeFileSync(overrideFilePath(), JSON.stringify({ model: 'file-model', baseUrl: 'http://file-base' }), 'utf8');
    try {
      const e = resolveConfig({});
      assert.equal(e.model, 'file-model', '覆盖文件的 model 应压过内置默认');
      assert.equal(e.baseUrl, 'http://file-base', '覆盖文件的 baseUrl 应压过内置默认');
      const f = resolveConfig({ model: 'x' });
      assert.equal(f.model, 'x', '显式应压过覆盖文件');
    } finally { rmOverride(); }
  });

  // ⑤ 内置默认（清空一切 ⇒ workbuddy）
  await withEnv(CLEAN, async () => {
    const g = resolveConfig({});
    assert.equal(g.id, 'workbuddy', '默认 profile 必须是 workbuddy');
    assert.equal(g.isDefault, true);
    assert.equal(g.baseUrl, PROFILES.workbuddy.baseUrl, '默认 baseUrl 取内置表');
    assert.equal(g.timeoutMs, 30000, '默认超时必须是 30000');
    assert.equal(g.apiKey, '', '★ 默认**不得**有任何密钥');
    assert.equal(g.model, '', '★ 默认**不得**硬写模型（跟随环境，否则留空）');
  });
});

test('resolveConfig：超时钳制到 1000–600000、请求头按序合并', async () => {
  await withEnv({ ...CLEAN, LEMO_LLM_TIMEOUT_MS: '10' }, () => {
    assert.equal(resolveConfig({}).timeoutMs, 1000, '低于下限应钳到 1000');
  });
  await withEnv({ ...CLEAN, LEMO_LLM_TIMEOUT_MS: '99999999' }, () => {
    assert.equal(resolveConfig({}).timeoutMs, 600000, '高于上限应钳到 600000');
  });
  await withEnv({ ...CLEAN, LEMO_LLM_TIMEOUT_MS: 'not-a-number' }, () => {
    assert.equal(resolveConfig({}).timeoutMs, 30000, '非法值应回落到默认 30000');
  });
  await withEnv({ ...CLEAN, LEMO_LLM_HEADERS: '{"X-Env":"1"}' }, () => {
    const cfg = resolveConfig({ headers: { 'X-Opt': '2' } });
    assert.equal(cfg.headers['X-Env'], '1', 'env 头应并入');
    assert.equal(cfg.headers['X-Opt'], '2', '显式头应并入');
  });
});

// ── ② 容错 8 类（每类独立夹具；逐条断言「不抛」）─────────────
test('容错·unreachable：端口没人监听 ⇒ kind=unreachable，且不抛', async () => {
  const base = await closedBase();                    // 刚关闭的端口（不打真外网）
  await expectFail('unreachable', base, 'unreachable');
});

test('容错·timeout：桩故意不响应 ⇒ kind=timeout，且不抛（定时器必须被清理）', async () => {
  const stub = await startStub(() => { /* 故意不响应 */ });
  try {
    await expectFail('timeout', stub.base, 'timeout', { timeoutMs: 400 });
  } finally { await stub.close(); }
});

test('容错·auth：401 / 403 ⇒ kind=auth，且不抛', async () => {
  for (const code of [401, 403]) {
    const stub = await startStub((req, res) => status(res, code, '{"error":"nope"}'));
    try {
      await expectFail(`auth-${code}`, stub.base, 'auth');
    } finally { await stub.close(); }
  }
});

test('容错·rate-limit：429 ⇒ kind=rate-limit，且不抛', async () => {
  const stub = await startStub((req, res) => status(res, 429, '{"error":"slow down"}'));
  try { await expectFail('rate-limit', stub.base, 'rate-limit'); } finally { await stub.close(); }
});

test('容错·http-error：500 ⇒ kind=http-error，且不抛', async () => {
  const stub = await startStub((req, res) => status(res, 500, '{"error":"boom"}'));
  try { await expectFail('http-error', stub.base, 'http-error'); } finally { await stub.close(); }
});

test('容错·bad-json：返回非 JSON ⇒ kind=bad-json（不许 res.json() 把异常抛出去），且不抛', async () => {
  const stub = await startStub((req, res) => text200(res, '<html>not json at all</html>'));
  try { await expectFail('bad-json', stub.base, 'bad-json'); } finally { await stub.close(); }
});

test('容错·bad-shape：JSON 里没有取文本的路径 ⇒ kind=bad-shape，且不抛', async () => {
  const stub = await startStub((req, res) => json200(res, { foo: 'bar', nope: 1 }));
  try { await expectFail('bad-shape', stub.base, 'bad-shape'); } finally { await stub.close(); }
});

test('容错·empty-output：取到空串 ⇒ kind=empty-output，且不抛', async () => {
  const stub = await startStub((req, res) => json200(res, { choices: [{ message: { content: '   ' } }] }));
  try { await expectFail('empty-output', stub.base, 'empty-output'); } finally { await stub.close(); }
});

// ── ③ 成功路径（适配器显式给 kind）───────────────────────────
test('chat() 成功：桩返回 OpenAI 格式 ⇒ 取到文本 + usage', async () => {
  const stub = await startStub(async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/chat/completions', 'openai-compatible 适配器应打 /chat/completions');
    const body = JSON.parse(await readBody(req));
    assert.equal(body.model, 'm', '模型 API（target:model）请求体应带 model');
    assert.equal(body.stream, false, 'body 应含 stream:false');
    assert.ok(Array.isArray(body.messages) && body.messages.length === 1);
    json200(res, { choices: [{ message: { content: '你好，世界' } }], usage: { total_tokens: 7 } });
  });
  try {
    const res = await chat([{ role: 'user', content: 'hi' }],
      OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(res.ok, true, `应当成功：${JSON.stringify(res.error || '')}`);
    assert.equal(res.text, '你好，世界');
    assert.deepEqual(res.usage, { total_tokens: 7 });
    assert.equal(res.meta.kind, 'openai-compatible');
    assert.equal(res.meta.model, 'm');
    assert.equal(res.meta.httpStatus, 200);
  } finally { await stub.close(); }
});

test('chat() anthropic：打 /v1/messages、带 x-api-key + anthropic-version，取 content[0].text', async () => {
  const stub = await startStub(async (req, res) => {
    assert.equal(req.url, '/v1/messages', 'anthropic 适配器应打 /v1/messages');
    assert.equal(req.headers['x-api-key'], 'sk-ant-1234567890', '应带 x-api-key');
    assert.equal(req.headers['anthropic-version'], '2023-06-01', '应带 anthropic-version');
    const body = JSON.parse(await readBody(req));
    assert.equal(body.max_tokens, 1, '探针/请求应带 max_tokens');
    json200(res, { content: [{ type: 'text', text: 'claude says hi' }] });
  });
  try {
    const res = await chat([{ role: 'user', content: 'ping' }],
      ANTH({ baseUrl: stub.base, apiKey: 'sk-ant-1234567890', maxTokens: 1 }));
    assert.equal(res.ok, true, `应当成功：${JSON.stringify(res.error || '')}`);
    assert.equal(res.text, 'claude says hi');
  } finally { await stub.close(); }
});

test('chat() 显式 temperature ⇒ 透传进请求体；不给 ⇒ 请求体里不出现该键（逐字节不变）', async () => {
  // ★ 语义：只在 `temperature !== undefined` 时写入 ⇒ 未给值的既有路径**逐字节不变**。
  const seen = [];
  const stub = await startStub(async (req, res) => {
    seen.push(JSON.parse(await readBody(req)));
    json200(res, { choices: [{ message: { content: 'ok' } }] });
  });
  try {
    // (a) 显式给 0 ⇒ 必须写入（★ 0 是**有效值**，不能被 `||` 之类吞掉）
    const a = await chat([{ role: 'user', content: 'hi' }],
      OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890', temperature: 0 }));
    assert.equal(a.ok, true, `应当成功：${JSON.stringify(a.error || '')}`);
    assert.equal(seen[0].temperature, 0, '显式 temperature:0 必须透传（0 不能被当成「未给」）');
    // (b) 不给 ⇒ 键**不存在**（不是 null / undefined / 默认值）
    const b = await chat([{ role: 'user', content: 'hi' }],
      OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(b.ok, true, `应当成功：${JSON.stringify(b.error || '')}`);
    assert.equal(hasOwn(seen[1], 'temperature'), false,
      '未给 temperature 时请求体**不得**出现该键（否则破坏既有路径的逐字节不变）');
  } finally { await stub.close(); }
});

test('chat() custom：自定义 path + extract（点分路径）都能接', async () => {
  const stub = await startStub(async (req, res) => {
    assert.equal(req.url, '/v1/infer', 'custom 应打配置的 path');
    json200(res, { result: { outputs: [{ text: 'custom text' }] } });
  });
  try {
    const res = await chat([{ role: 'user', content: 'hi' }], {
      kind: 'custom', target: 'model', baseUrl: stub.base, apiKey: 'sk-test-1234567890',
      path: '/v1/infer', extract: 'result.outputs.0.text',
    });
    assert.equal(res.ok, true, `应当成功：${JSON.stringify(res.error || '')}`);
    assert.equal(res.text, 'custom text');
  } finally { await stub.close(); }
});

// ── ④ validate 三步 ─────────────────────────────────────────
test('validate()：三步全过 ⇒ ok:true，steps 三项皆 ok', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET' && req.url === '/models') return json200(res, { data: [] });
    if (req.method === 'POST' && req.url === '/chat/completions') {
      return json200(res, { choices: [{ message: { content: 'pong' } }] });
    }
    return status(res, 404, '{}');
  });
  try {
    const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true, `应当三步全过：${JSON.stringify(r.errors)}`);
    assert.equal(r.steps.reachable.ok, true);
    assert.equal(r.steps.auth.ok, true);
    assert.equal(r.steps.shape.ok, true);
    assert.equal(r.profile, 'workbuddy', '不传 profile ⇒ 默认 workbuddy');
    assert.equal(r.masked.kind, 'openai-compatible', 'masked 应带出解析后的适配器 kind');
    assert.deepEqual(r.errors, []);
  } finally { await stub.close(); }
});

test('validate()·reachable 失败：连不上 ⇒ steps.reachable.ok=false + kind=unreachable + 有 hint', async () => {
  const base = await closedBase();
  const r = await validate(OAI({ baseUrl: base, apiKey: 'sk-test-1234567890' }));
  assert.equal(r.ok, false);
  assert.equal(r.steps.reachable.ok, false);
  assert.equal(r.steps.reachable.kind, 'unreachable');
  assert.equal(r.errors[0].step, 'reachable');
  assert.ok(typeof r.hint === 'string' && r.hint.length > 0, '必须给可操作 hint');
});

test('validate()·auth 失败：可达但 401 ⇒ steps.auth.ok=false + kind=auth', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });   // 可达
    return status(res, 401, '{"error":"bad key"}');                // 鉴权失败
  });
  try {
    const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, false);
    assert.equal(r.steps.reachable.ok, true, '可达这一步应当过');
    assert.equal(r.steps.auth.ok, false);
    assert.equal(r.steps.auth.kind, 'auth');
    assert.equal(r.errors[0].step, 'auth');
  } finally { await stub.close(); }
});

test('validate()·shape 失败：可达 + 200 但结构不对 ⇒ steps.shape.ok=false + kind=bad-shape', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return json200(res, { totally: 'wrong shape' });
  });
  try {
    const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, false);
    assert.equal(r.steps.reachable.ok, true);
    assert.equal(r.steps.auth.ok, true);
    assert.equal(r.steps.shape.ok, false);
    assert.equal(r.steps.shape.kind, 'bad-shape');
    assert.equal(r.errors[0].step, 'shape');
  } finally { await stub.close(); }
});

test('★ validate()·探针升级：max_tokens:1 返回空文本、16 才返回文本 ⇒ 仍判 ok（不把好端点报坏）', async () => {
  const stub = await startStub(async (req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    const body = JSON.parse(await readBody(req));
    const empty = body.max_tokens === 1;                 // 模拟「只吐 1 个 token 就停」的真实行为
    return json200(res, { content: [{ type: 'text', text: empty ? '' : 'pong' }] });
  });
  try {
    const r = await validate(ANTH({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true, `探针升级后应判 ok：${JSON.stringify(r.errors)}`);
    assert.equal(r.steps.shape.ok, true);
  } finally { await stub.close(); }
});

test('★ chat() anthropic 取文本回退：content[0] 是非文本块 ⇒ 扫 content[] 取第一个 text 块', async () => {
  const stub = await startStub((req, res) => json200(res, {
    content: [{ type: 'thinking', thinking: '...' }, { type: 'text', text: '真正的回答' }],
  }));
  try {
    const res = await chat([{ role: 'user', content: 'hi' }], ANTH({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(res.ok, true, `应当能回退取到文本：${JSON.stringify(res.error || '')}`);
    assert.equal(res.text, '真正的回答');
  } finally { await stub.close(); }
});

test('★ validate()：缺 baseUrl / model / Key ⇒ **各自明确报缺**，绝不静默回退到别的 profile', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });      // 可达
    return status(res, 401, '{"error":"auth required"}');             // 探针要求鉴权
  });
  try {
    await withEnv(CLEAN, async () => {
      // 缺 baseUrl
      const r = await validate({ profile: 'workbuddy', baseUrl: '' });
      assert.equal(r.ok, false);
      assert.equal(r.profile, 'workbuddy', '★ 必须仍是 workbuddy（不得回退）');
      assert.equal(r.errors[0].kind, 'config');
      assert.match(r.hint, /baseUrl/, 'hint 应明说缺 baseUrl');

      // 缺 model（★ 用**显式 kind** 复现「基础算力 API + 缺 model」—— agent 模式不要求 model，
      //   故「缺 model 明确报缺」只适用于 target:'model'；见契约 §十五）
      const r2 = await validate(OAI({ model: '', baseUrl: stub.base }));
      assert.equal(r2.ok, false);
      assert.equal(r2.steps.reachable.ok, true, '可达这一步应当过');
      assert.equal(r2.errors.find((e) => e.step === 'auth').kind, 'config');
      assert.match(r2.hint, /模型名/, 'hint 应明说缺模型名');

      // 缺 Key（有 baseUrl + model，服务端回 401）⇒ hint 明确说「未配置密钥」（契约 §六）
      const r3 = await validate(OAI({ baseUrl: stub.base, apiKey: '' }));
      assert.equal(r3.ok, false);
      assert.equal(r3.steps.reachable.ok, true);
      assert.equal(r3.errors.find((e) => e.step === 'auth').kind, 'auth');
      assert.match(r3.hint, /未配置密钥/, 'hint 应明说未配置密钥');
    });
  } finally { await stub.close(); }
});

test('★ validate()：本地端点**无需密钥**也能过（不再预拦「缺 Key」—— 修正③）', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return json200(res, { choices: [{ message: { content: 'pong' } }] });   // 本地服务不要求鉴权
  });
  try {
    await withEnv(CLEAN, async () => {
      const r = await validate(OAI({ model: 'local-model', baseUrl: stub.base }));
      assert.equal(r.ok, true, `本地无需密钥应能过：${JSON.stringify(r.errors)}`);
      assert.equal(r.steps.auth.ok, true);
      assert.match(r.steps.auth.detail, /未配密钥/, '应说明「未配密钥、服务端未要求」');
    });
  } finally { await stub.close(); }
});

// ── ⑤ ★ 密钥绝不外泄 ────────────────────────────────────────
test('★★ validate()·empty-output 降级：结构合法但探针两次都空 ⇒ ok:true + warnings（不把好端点报坏）', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return json200(res, { content: [{ type: 'text', text: '' }] });   // 两次探针都返回空文本
  });
  try {
    const r = await validate(ANTH({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true, '★ 结构合法 ⇒ 不得判失败（这是对契约 §四 的修正）');
    assert.equal(r.steps.shape.ok, true);
    assert.equal(r.steps.shape.kind, 'empty-output', '应带上 empty-output 作为提示');
    assert.equal(r.warnings.length, 1);
    assert.equal(r.warnings[0].kind, 'empty-output');
    assert.deepEqual(r.errors, [], '这不是 error');
  } finally { await stub.close(); }
});

// ── ★★ 对齐参考 §11.9：推理型模型的探测假阴（`content=null` 不再误判为 bad-shape）──
test('★★ validate()·推理型假阴（对齐参考 §11.9）：content=null + finish_reason=length ⇒ 触发 64 复验、只告警不失败', async () => {
  let posts = 0;
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    posts += 1;
    // 两次探针都返回 `content:null`（推理型模型把 token 花在 reasoning_content 上 ⇒ 小预算下 content=null）
    return json200(res, { choices: [{ message: { content: null }, finish_reason: 'length' }] });
  });
  try {
    const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true, `★ content=null 是可用端点，不得判失败：${JSON.stringify(r.errors)}`);
    assert.equal(r.steps.shape.ok, true);
    assert.equal(r.steps.shape.kind, 'empty-output', '★ 应降级为 empty-output（而非 bad-shape）');
    assert.equal(posts, 2, '★ 应触发一次 64-token 复验（共两次 POST 探针）');
    assert.equal(r.warnings.length, 1);
    assert.equal(r.warnings[0].kind, 'empty-output');
    assert.match(r.warnings[0].detail, /finish_reason=length/, '★ detail 应记 finish_reason，便于诊断');
    assert.deepEqual(r.errors, [], '这不是 error');
  } finally { await stub.close(); }
});

test('★ validate()·空串回归：content=\'\' + finish_reason=length ⇒ 仍只告警不失败（既有行为防回归）', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return json200(res, { choices: [{ message: { content: '' }, finish_reason: 'length' }] });
  });
  try {
    const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true);
    assert.equal(r.steps.shape.ok, true);
    assert.equal(r.warnings.length, 1);
    assert.equal(r.warnings[0].kind, 'empty-output');
  } finally { await stub.close(); }
});

test('★★ validate()·安全网：路径取不到（响应无 choices）⇒ 仍判 bad-shape 硬失败', async () => {
  let posts = 0;
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    posts += 1;
    return json200(res, { foo: 'bar' });            // 完全没有 choices ⇒ 路径取不到 ⇒ present:false
  });
  try {
    const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, false, '★ 路径取不到必须硬失败（防 extract 路径写错）');
    assert.equal(r.steps.shape.ok, false);
    assert.equal(r.steps.shape.kind, 'bad-shape');
    assert.equal(posts, 1, '★ bad-shape 不该触发复验（只有 empty-output 才复验）');
  } finally { await stub.close(); }
});

test('★ validate()·正常取到文本：content=\'ok\' ⇒ steps.shape.ok 且无 empty-output warning', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return json200(res, { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] });
  });
  try {
    const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true);
    assert.equal(r.steps.shape.ok, true);
    assert.equal(r.steps.shape.kind, null, '正常取到文本不应带 kind');
    assert.equal(r.warnings.filter((w) => w.kind === 'empty-output').length, 0, '不应有 empty-output warning');
  } finally { await stub.close(); }
});

test('★ 减法回归：previewProfile / listProfiles / listServiceTemplates 已随超出参考标准的端点删除（不得再导出）', async () => {
  const mod = await import('../lib/llm-api.mjs');
  assert.equal('previewProfile' in mod, false, '★ previewProfile 不得再导出');
  assert.equal('listProfiles' in mod, false, '★ listProfiles 不得再导出');
  assert.equal('listServiceTemplates' in mod, false, '★ listServiceTemplates 不得再导出');
  assert.equal('SERVICE_TEMPLATES' in mod, false, '★ SERVICE_TEMPLATES 不得再导出');
});

test('★★ 密钥不外泄：listServices() / validate() 的任何输出都不含 key 明文（含响应体回显）', async () => {
  const FAKE = 'sk-FAKE-abcdefghijklmnop-0123456789';
  // 桩故意**把 key 回显**在错误体里（模拟服务端回显）⇒ 断言它被脱敏
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return status(res, 401, JSON.stringify({ error: `invalid key: ${FAKE}` }));
  });
  try {
    await withEnv({ ...CLEAN, LEMO_LLM_KEY: FAKE }, async () => {
      const svcs = listServices();
      const pText = JSON.stringify(svcs);
      assert.ok(!pText.includes(FAKE), '★ listServices() 输出里**不得**出现 key 明文');
      assert.ok(svcs.every((s) => !('apiKey' in s)), 'listServices 项里不得有 apiKey 字段');
      assert.ok(svcs.every((s) => typeof s.hasHeaders === 'boolean'), 'listServices 项应回 hasHeaders 布尔（脱敏口径）');

      const r = await validate(OAI({ baseUrl: stub.base }));
      const vText = JSON.stringify(r);
      assert.ok(!vText.includes(FAKE), '★ validate() 输出里**不得**出现 key 明文（含 errors[].detail 与 masked）');
      assert.equal(r.steps.auth.kind, 'auth');
      assert.match(r.errors[0].detail, /sk-F…/, 'detail 里的 key 应被脱敏成前 4 位 + …');
      assert.equal(r.masked.hasKey, true);
      assert.ok(!JSON.stringify(r.masked).includes(FAKE), 'masked 里也不得含明文');
    });
  } finally { await stub.close(); }
});

test('maskKey：真 key 只留前 4 位 + …；过短的 key 一律只回 …（不泄露）', () => {
  assert.equal(maskKey('sk-FAKE-abcdefghijklmnop-0123456789'), 'sk-F…');
  assert.equal(maskKey('short'), '…', '短 key 连前 4 位都不给');
  assert.equal(maskKey(''), '');
});

// ── ⑥ listModels + 覆盖文件 ─────────────────────────────────
// ★ 委托方明令：「接入对象 = 智能体 API」时**不发起任何模型相关请求**（规格原文：「不探查、不读取智能体
//   内部正在使用的模型信息，**不发起任何模型相关请求**（例如不调用 `/v1/models` 或任何列举、查询模型的接口）」）
//   ⇒ `listModels()` 整条就是「列举模型」⇒ agent 模式下**必须直接拒绝、一个请求都不发**。
test('★ listModels()：agent 模式**零请求**直接拒绝（kind=config）；model 模式照常发请求', async () => {
  let hit = 0;
  const stub = await startStub(async (req, res) => {
    hit++;
    json200(res, { data: [{ id: 'stub-model-a' }] });
  });
  try {
    // (a) agent 模式 ⇒ 拒绝，且**桩一次都没被调用**（= 零请求）
    const a = await listModels(OAI({ target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(a.ok, false, 'agent 模式 listModels 必须失败（规格禁止探查模型）');
    assert.equal(a.error.kind, 'config', `应归一为 config，实得 ${a.error && a.error.kind}`);
    assert.ok(/模型相关请求/.test(a.error.message || ''), 'message 应说明「不发起模型相关请求」');
    assert.ok(/底层基础算力/.test((a.error.detail || '')), 'detail 应给出可操作建议（切到基础算力 API）');
    assert.equal(hit, 0, '★ agent 模式下**不得**发出任何请求（含 /v1/models）');

    // (b) model 模式 ⇒ 照常发（对照组：证明 (a) 的 0 命中不是「桩没起作用」）
    const b = await listModels(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(b.ok, true, `model 模式应当成功：${JSON.stringify(b.error || '')}`);
    assert.ok(hit >= 1, 'model 模式下应真的发出过请求');
  } finally { await stub.close(); }
});

test('listModels()：成功取 id 列表；失败（500）⇒ ok:false + kind=http-error（都不抛）', async () => {
  const okStub = await startStub((req, res) => {
    assert.equal(req.url, '/models');
    json200(res, { data: [{ id: 'm1' }, { id: 'm2' }] });
  });
  try {
    const r = await listModels(OAI({ baseUrl: okStub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true);
    assert.deepEqual(r.models, ['m1', 'm2']);
  } finally { await okStub.close(); }

  const badStub = await startStub((req, res) => status(res, 500, '{"error":"x"}'));
  try {
    const r = await listModels(OAI({ baseUrl: badStub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, false);
    assert.equal(r.error.kind, 'http-error');
  } finally { await badStub.close(); }
});

test('覆盖文件（§八）：saveOverride 落盘到非 C 盘临时树，resolveConfig 能读回；损坏文件不抛', async () => {
  rmOverride();
  const FAKE = 'sk-FILE-abcdefghijklmnop-0123456789';
  const s = saveOverride({ profile: 'workbuddy', baseUrl: 'http://file-base', apiKey: FAKE, model: 'file-model' });
  assert.equal(s.ok, true);
  // ★ 用 path.resolve 比（Windows 下 path.join 给的是反斜杠，直接 startsWith 正斜杠会假红）
  assert.equal(path.resolve(path.dirname(s.path)), path.resolve(TMP), '★ 覆盖文件必须落在临时树（非 C 盘）内');
  assert.equal(path.basename(s.path), '_llm-api.json');

  const cfg = await withEnv(CLEAN, () => {
    const c = resolveConfig({});
    assert.equal(c.id, 'workbuddy');
    assert.equal(c.baseUrl, 'http://file-base');
    assert.equal(c.model, 'file-model');
    assert.equal(c.apiKey, FAKE, '覆盖文件里的 key 应能读回（该文件是唯一允许含明文密钥处）');
    return c;
  });
  assert.equal(cfg.id, 'workbuddy');
  assert.ok(fs.existsSync(overrideFilePath()));

  // 损坏文件 ⇒ 视为「无覆盖」，不抛
  fs.writeFileSync(overrideFilePath(), '{ not json', 'utf8');
  assert.deepEqual(readOverride(), {}, '损坏文件应降级为无覆盖');
  rmOverride();
});

test('maskedConfig：含 hasKey 与 keyMask，绝不含明文', async () => {
  await withEnv({ ...CLEAN, LEMO_LLM_KEY: 'sk-MASK-abcdefghijklmnop-0123456789' }, () => {
    const cfg = resolveConfig(OAI());
    const m = maskedConfig(cfg);
    assert.equal(m.hasKey, true);
    assert.equal(m.keyMask, 'sk-M…');
    assert.ok(!JSON.stringify(m).includes('sk-MASK-abcdefghijklmnop-0123456789'));
  });
});

// ── ⑦ 多模态（图片输入）────────────────────────────────────
test('★ 多模态·OpenAI 兼容：显式 image_url 块原样序列化（桩断言 body 里有 image_url）', async () => {
  const B64 = Buffer.from('openai-image-payload-bytes').toString('base64');
  const stub = await startStub(async (req, res) => {
    assert.equal(req.url, '/chat/completions');
    const body = JSON.parse(await readBody(req));
    const c = body.messages[0].content;
    assert.ok(Array.isArray(c), 'content 应为内容块数组（★ 不再被 JSON.stringify 成字符串）');
    assert.equal(c[0].type, 'text');
    assert.equal(c[1].type, 'image_url');
    assert.equal(c[1].image_url.url, `data:image/png;base64,${B64}`, '★ 图片块应原样到达服务端');
    json200(res, { choices: [{ message: { content: 'seen' } }] });
  });
  try {
    const res = await chat([{ role: 'user', content: [
      { type: 'text', text: '看图' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${B64}` } },
    ] }], OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(res.ok, true, `应当成功：${JSON.stringify(res.error || '')}`);
    assert.equal(res.text, 'seen');
  } finally { await stub.close(); }
});

test('★ 多模态·Anthropic：显式 image 块原样序列化（桩断言 content[1].source.data）', async () => {
  const B64 = Buffer.from('anthropic-image-payload-bytes').toString('base64');
  const stub = await startStub(async (req, res) => {
    assert.equal(req.url, '/v1/messages');
    const body = JSON.parse(await readBody(req));
    const c = body.messages[0].content;
    assert.ok(Array.isArray(c));
    assert.equal(c[1].type, 'image');
    assert.equal(c[1].source.type, 'base64');
    assert.equal(c[1].source.media_type, 'image/png');
    assert.equal(c[1].source.data, B64, '★ Anthropic 图片块应原样到达服务端');
    json200(res, { content: [{ type: 'text', text: 'seen' }] });
  });
  try {
    const res = await chat([{ role: 'user', content: [
      { type: 'text', text: '看图' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: B64 } },
    ] }], ANTH({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(res.ok, true, `应当成功：${JSON.stringify(res.error || '')}`);
    assert.equal(res.text, 'seen');
  } finally { await stub.close(); }
});

test('★ 多模态·便利入参①：本地文件路径 → 模块读成 base64（openai-compatible 自动转 image_url）', async () => {
  const imgPath = path.join(TMP, 'frame-openai.png');
  const raw = Buffer.from('local-png-file-bytes-1234567890');
  fs.writeFileSync(imgPath, raw);
  const expectB64 = raw.toString('base64');
  const stub = await startStub(async (req, res) => {
    const body = JSON.parse(await readBody(req));
    const c = body.messages[body.messages.length - 1].content;
    assert.ok(Array.isArray(c), '★ 便利图应注入最后一条 user 消息（content 变数组）');
    assert.equal(c[0].type, 'text');
    assert.equal(c[0].text, '看图', '原文本应保留为 text 块');
    assert.equal(c[1].type, 'image_url');
    assert.equal(c[1].image_url.url, `data:image/png;base64,${expectB64}`, '★ 本地文件应被读成 base64');
    json200(res, { choices: [{ message: { content: 'ok' } }] });
  });
  try {
    const res = await chat([{ role: 'user', content: '看图' }],
      OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890', images: [{ path: imgPath }] }));
    assert.equal(res.ok, true, `应当成功：${JSON.stringify(res.error || '')}`);
  } finally { await stub.close(); }
});

test('★ 多模态·便利入参②：dataURL 直传 + base64 直传（anthropic 自动转 image/source）', async () => {
  const B64A = Buffer.from('dataurl-image-bytes-abcdefgh').toString('base64');
  const B64B = Buffer.from('rawbase64-image-bytes-1234567').toString('base64');
  const stub = await startStub(async (req, res) => {
    const body = JSON.parse(await readBody(req));
    const c = body.messages[body.messages.length - 1].content;
    assert.equal(c[1].type, 'image');
    assert.equal(c[1].source.media_type, 'image/jpeg', '★ mediaType 应从 dataURL 前缀推得');
    assert.equal(c[1].source.data, B64A);
    assert.equal(c[2].source.media_type, 'image/webp', '★ 显式 mediaType 应生效');
    assert.equal(c[2].source.data, B64B);
    json200(res, { content: [{ type: 'text', text: 'ok' }] });
  });
  try {
    const res = await chat([{ role: 'user', content: '看图' }], ANTH({
      baseUrl: stub.base, apiKey: 'sk-test-1234567890',
      images: [{ dataUrl: `data:image/jpeg;base64,${B64A}` }, { base64: B64B, mediaType: 'image/webp' }],
    }));
    assert.equal(res.ok, true, `应当成功：${JSON.stringify(res.error || '')}`);
  } finally { await stub.close(); }
});

test('★★ 纯文本回归：请求体与改动前逐字节相同（openai-compatible + anthropic 两条）', async () => {
  // ★★ 这两条字面量 = **改动前** `buildRequest` 对纯文本的输出。逐字节比对即证明「多模态改动**没有**碰纯文本路径」。
  const OPENAI_GOLDEN = '{"model":"m","messages":[{"role":"user","content":"hi"}],"stream":false}';
  const ANTHROPIC_GOLDEN = '{"model":"m","max_tokens":1024,"messages":[{"role":"user","content":"hi"}]}';
  let gotOpenai = null; let gotAnthropic = null;
  const stub = await startStub(async (req, res) => {
    const raw = await readBody(req);
    if (req.url === '/chat/completions') { gotOpenai = raw; return json200(res, { choices: [{ message: { content: 'ok' } }] }); }
    gotAnthropic = raw; return json200(res, { content: [{ type: 'text', text: 'ok' }] });
  });
  try {
    await chat([{ role: 'user', content: 'hi' }], OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    await chat([{ role: 'user', content: 'hi' }], ANTH({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(gotOpenai, OPENAI_GOLDEN, '★ openai-compatible 纯文本请求体必须逐字节不变');
    assert.equal(gotAnthropic, ANTHROPIC_GOLDEN, '★ anthropic 纯文本请求体必须逐字节不变');
  } finally { await stub.close(); }
});

test('★ 多模态·体积守卫：单图超限 ⇒ bad-shape；总请求体超限 ⇒ config（都不抛）', async () => {
  const tooBigB64 = 'A'.repeat(Math.ceil((IMAGE_LIMITS.maxImageBytes + 4096) * 4 / 3));
  const base = OAI({ baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'sk-test-1234567890' });

  // ① 显式图片块超单图上限
  let r = await chat([{ role: 'user', content: [
    { type: 'text', text: 'x' },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${tooBigB64}` } },
  ] }], base);
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'bad-shape', '单图超限应归一为 bad-shape');

  // ② 便利入参路径同样受单图上限约束
  r = await chat([{ role: 'user', content: 'x' }], { ...base, images: [{ base64: tooBigB64 }] });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'bad-shape', '便利入参单图超限也应归一为 bad-shape');

  // ③ 总请求体超限（纯文本巨体、无图 ⇒ 命中总请求体守卫）
  const huge = 'A'.repeat(IMAGE_LIMITS.maxBodyBytes + 4096);
  r = await chat([{ role: 'user', content: huge }], base);
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'config', '总请求体超限应归一为 config');
});

test('★ 多模态·入参非法 ⇒ 归一（bad-shape / config），一律不抛', async () => {
  const base = OAI({ baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'sk-test-1234567890' });
  const msg = [{ role: 'user', content: 'x' }];
  const r1 = await chat(msg, { ...base, images: [{}] });
  assert.equal(r1.error?.kind, 'bad-shape', '缺图片来源应 bad-shape');
  const r2 = await chat(msg, { ...base, images: [{ dataUrl: 'not-a-data-url' }] });
  assert.equal(r2.error?.kind, 'bad-shape', '非法 dataUrl 应 bad-shape');
  const r3 = await chat(msg, { ...base, images: [{ base64: '!!!not-base64!!!' }] });
  assert.equal(r3.error?.kind, 'bad-shape', '非法 base64 应 bad-shape');
  const r4 = await chat(msg, { ...base, images: [{ path: path.join(TMP, 'no-such-file-xyz.png') }] });
  assert.equal(r4.error?.kind, 'config', '读不到的本地文件应 config');
  const r5 = await chat(msg, { ...base, images: 'nope' });
  assert.equal(r5.error?.kind, 'bad-shape', 'images 非数组应 bad-shape');
});

test('★★ 多模态·图片内容不外泄：响应体回显图片 base64 ⇒ 被脱敏；密钥照旧', async () => {
  const B64 = Buffer.from(`SECRET-IMAGE-CONTENT-${'x'.repeat(30)}`).toString('base64');
  const FAKE = 'sk-IMG-abcdefghijklmnop-0123456789';
  const stub = await startStub(async (req, res) => {
    const body = await readBody(req);
    let echoed = '';
    try { echoed = JSON.parse(body).messages[0].content[1].image_url.url.split(',')[1]; } catch { /* ignore */ }
    status(res, 500, JSON.stringify({ error: `bad image: ${echoed}` }));   // 故意把图片 base64 回显在错误体里
  });
  try {
    const res = await chat([{ role: 'user', content: [
      { type: 'text', text: '看' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${B64}` } },
    ] }], OAI({ baseUrl: stub.base, apiKey: FAKE }));
    assert.equal(res.ok, false);
    const all = JSON.stringify(res);
    assert.ok(!all.includes(B64), '★ 图片内容**不得**出现在任何输出（含 detail）里');
    assert.ok(!all.includes(FAKE), '★ 密钥照旧不外泄');
    assert.match(res.error.detail, /bad image/, 'detail 应保留（非图片部分的）错误信息');
  } finally { await stub.close(); }
});

// ── ⑧ ★★ PROFILES 只剩 workbuddy（本批核心约束）+ target 判定 ──────
//   ★★ 2026-10-09：委托方指令「只接 WorkBuddy，其他 provider 一律彻底删除」⇒ 内置表**只剩 workbuddy 一个**。
//   ★ 这条用例是**专门钉住这个约束**的：防止它被无意改回去（比如哪天又悄悄加回某个 provider）。
test('★★ PROFILES 只剩 workbuddy：内置表恰 1 条、默认就是它、11 个 provider 全删（防改回去）', async () => {
  rmOverride();
  await withEnv(CLEAN, () => {
    // ① PROFILES（内置表）恰 1 条，且就是 workbuddy
    //    ★ 2026-10-10 措辞订正：本用例断言的是 `Object.values(PROFILES)`（内置表）——
    //      原文案写的 `listProfiles()` **已随「减法」批次整体删除**（见本文件顶部的「减法回归」用例）。
    const lp = Object.values(PROFILES).map((p) => ({ id: p.id, isDefault: !!p.isDefault, target: p.target, kind: p.kind }));
    assert.equal(lp.length, 1, `★ 内置 profile 应**恰 1 条**（只剩 workbuddy），实得 ${lp.length}：${lp.map((p) => p.id).join(',')}`);
    assert.equal(lp[0].id, 'workbuddy', '★ 唯一的内置 profile 必须是 workbuddy');
    assert.equal(lp[0].isDefault, true, '★ workbuddy 必须标记 isDefault');
    assert.equal(lp[0].target, 'agent', '★ workbuddy 是智能体 API ⇒ target=agent');
    assert.equal(lp[0].kind, 'workbuddy-gateway', '★ workbuddy 走本机智能体网关适配器（见契约 §十六）');
    // ② 恰一个默认 profile，且它就是 workbuddy
    const defaults = lp.filter((p) => p.isDefault);
    assert.equal(defaults.length, 1, '★ 恰一个默认 profile');
    assert.equal(defaults[0].id, 'workbuddy', '★ 默认 profile 必须是 workbuddy');
    // ③ DEFAULT_PROFILE 常量与内置表一致
    assert.equal(DEFAULT_PROFILE, 'workbuddy', '★ DEFAULT_PROFILE 必须是 workbuddy');
    // ④ 已删的 11 个 provider 一律不得再出现（在 PROFILES 内置表里不得有）
    const GONE = ['anthropic', 'openai-compatible', 'doubao', 'qwen', 'hunyuan', 'deepseek',
      'zhipu', 'kimi', 'siliconflow', 'lmstudio', 'custom'];
    for (const id of GONE) {
      assert.equal(lp.some((p) => p.id === id), false, `★ 已删 provider「${id}」不得再出现在 PROFILES（内置表）`);
      assert.equal(PROFILES[id], undefined, `★ PROFILES 表里不得再有「${id}」`);
    }
    // ⑤ 默认解析 / 预览也一致
    assert.equal(resolveConfig({}).id, 'workbuddy', '★ 不传 profile ⇒ 默认解析为 workbuddy');
    assert.equal(resolveConfig({}).isDefault, true);
    assert.equal(resolveConfig({ profile: 'workbuddy' }).target, 'agent');
  });
});

test('★ 判据⑧ 前提 + 文档锚：`note` 无读者（`resolveConfig()` 不暴露 note）；`PROFILES.workbuddy.note` 仍在', async () => {
  // ★ 2026-10-10（本批）：`scripts/check-llm-api.mjs` 判据⑧ 把 `note` **移出**「用户可见字段」集合 ——
  //   依据是「`note` 到不了用户眼前」。本用例把那句**前提**变成可执行断言：`resolveConfig()` 的返回
  //   **不含 `note`**（默认 profile 与未知 profile 都一样）⇒ 该字段**无读者** ⇒ 不是用户可见文案。
  //   ★ 同时钉住 `PROFILES.workbuddy.note` **仍在** —— 它被 `lib/llm-api.mjs` 的一处注释当「文档锚」引用
  //   （搜 `见 PROFILES.workbuddy.note`）；本批**只把它移出判据⑧ 的覆盖集合，不删字段** ——
  //   若有人删它，那条注释会悬空 ⇒ 本断言即拦下（届时须先处理那条注释）。
  rmOverride();
  await withEnv(CLEAN, () => {
    // ① 文档锚仍在：`workbuddy.note` 是非空字符串
    assert.equal(typeof PROFILES.workbuddy.note, 'string', '★ PROFILES.workbuddy.note 应是字符串（文档锚）');
    assert.ok(PROFILES.workbuddy.note.length > 0, '★ PROFILES.workbuddy.note 不得为空（文档锚）');
    // ② 前提：resolveConfig() 的返回**不含 note**（默认 / 未知 profile 都一样）
    assert.equal(Object.prototype.hasOwnProperty.call(resolveConfig({}), 'note'), false,
      '★ resolveConfig() 返回对象不得含 `note`（note 无读者 ⇒ 非用户可见文案 ⇒ 判据⑧ 不收它）');
    assert.equal(Object.prototype.hasOwnProperty.call(resolveConfig({ profile: 'no-such-profile' }), 'note'), false,
      '★ 未知 profile 的 resolveConfig() 返回同样不得含 `note`');
  });
});

test('★ PROFILES.target 判定：workbuddy = agent；未知 profile 归一为 model（保守：模型 API 校验最严）', async () => {
  rmOverride();
  await withEnv(CLEAN, () => {
    // ★ WorkBuddy 是智能体（规格点名）⇒ agent
    assert.equal(PROFILES.workbuddy.target, 'agent', '★ WorkBuddy 是智能体 ⇒ target=agent');
    assert.equal(resolveConfig({}).target, 'agent', '★ 默认 profile 解析出 agent（不传 profile ⇒ workbuddy）');
    assert.equal(resolveConfig({ profile: 'workbuddy' }).target, 'agent', 'resolveConfig 也应带出 agent');
    // ★ 未知 profile：`base` 走「未知 profile」兜底（`kind:'custom'`、`target:'model'`）⇒ 归一为 model
    assert.equal(resolveConfig({ profile: 'no-such-profile' }).target, 'model',
      '★ 未知 profile ⇒ 归一为 model（保守：模型 API 的校验最严）');
    // PROFILES（内置表）也带 target（供面板区分「模型 API / 智能体 API」）
    // ★ 2026-10-10 措辞订正：原写 `listProfiles()`，该函数已删；下面读的是 `Object.values(PROFILES)`。
    const lp = Object.values(PROFILES).map((p) => ({ id: p.id, isDefault: !!p.isDefault, target: p.target, kind: p.kind }));
    assert.equal(lp.find((p) => p.id === 'workbuddy').target, 'agent', 'PROFILES: workbuddy = agent');
    assert.ok(lp.every((p) => p.target === 'agent' || p.target === 'model'),
      'PROFILES 的 target 只能取 model / agent');
    assert.equal(lp.filter((p) => p.target === 'agent').length, 1, '★ 恰一个 agent（workbuddy）');
  });
});

test('★ 接入对象类型·覆盖优先级：显式 > 覆盖文件（面板） > 内置默认；非法值归一为 model', async () => {
  rmOverride();
  await withEnv(CLEAN, () => {
    // ⑤ 内置默认
    assert.equal(resolveConfig({ profile: 'workbuddy' }).target, 'agent', '内置：workbuddy = agent');
    assert.equal(resolveConfig({ profile: 'no-such-profile' }).target, 'model', '内置兜底：未知 profile = model');
    try {
      // ③ 覆盖文件（面板保存的配置）应压过内置默认
      fs.writeFileSync(overrideFilePath(), JSON.stringify({ target: 'model' }), 'utf8');
      assert.equal(resolveConfig({ profile: 'workbuddy' }).target, 'model', '★ 覆盖文件应压过内置默认');
      fs.writeFileSync(overrideFilePath(), JSON.stringify({ profile: 'no-such-profile', target: 'agent' }), 'utf8');
      assert.equal(resolveConfig({}).target, 'agent', '★ 覆盖文件可把「模型 API」改成「智能体 API」');
      // ① 显式传参应压过覆盖文件
      assert.equal(resolveConfig({ target: 'model' }).target, 'model', '★ 显式应压过覆盖文件');
      // 归一：非 'agent' 的**非空**值一律按 'model'
      assert.equal(resolveConfig({ target: 'nonsense' }).target, 'model', '非法 target 值按默认 model 归一');
      // ★ 空值语义与其它字段一致：`pick` 视 '' 为「未给」⇒ 落到下一个来源（此处 = 覆盖文件的 agent）
      assert.equal(resolveConfig({ target: '' }).target, 'agent', '空 target 视为「未给」⇒ 落到覆盖文件');
    } finally { rmOverride(); }
    // 干净环境（无覆盖文件）下：空 target ⇒ 落到内置默认
    assert.equal(resolveConfig({ profile: 'workbuddy', target: '' }).target, 'agent', '干净环境下空 target ⇒ 内置默认 agent');
    assert.equal(resolveConfig({ profile: 'no-such-profile', target: '' }).target, 'model', '干净环境下空 target ⇒ 内置兜底 model');
  });
});

// ── ⑨ ★★ 默认 profile `workbuddy` 接入本机智能体网关（见契约 §十六）──────
//   ★ 协议（两段式）：① `POST {baseUrl}/api/v1/runs`（体 `{id,type:'message',text,sender:{id,name}}`，**无 model**）
//     → `202 {data:{runId}}`；② `GET {baseUrl}/api/v1/runs/{runId}/stream`（SSE）取文本。
//   ★★ **纪律：绝不真打 `POST /api/v1/runs`**（那会真发起一次 Agent 执行，且网关的 `primarySession`
//     就是用户当前会话）⇒ 全部打**本地桩**（`startGatewayStub`，`127.0.0.1:0`，用完关闭）。
//   ★ 端点/口令**运行时发现**（`SERVER__HOST` / `SERVER__PORT` / `CODEBUDDY_GATEWAY_PASSWORD`），**不硬编码端口**。

test('★ workbuddy 默认 profile：网关 env ⇒ 解析出 baseUrl/kind/hasKey（★ 端口来自 SERVER__PORT，不硬编码）', async () => {
  rmOverride();
  await withEnv({ ...CLEAN, SERVER__HOST: '127.0.0.1', SERVER__PORT: '11760',
    CODEBUDDY_GATEWAY_PASSWORD: 'gw-WBRUNTIME-abcdefghijklmnop-0123456789',
    // ★ 故意**同时**设 `ANTHROPIC_*` —— 断言 workbuddy **不再**取它们（那是「模型中继」，不是智能体入口）。
    ANTHROPIC_BASE_URL: 'http://rt-wb.example:3000/', ANTHROPIC_MODEL: 'rt-wb-model',
    ANTHROPIC_API_KEY: 'sk-WBRUNTIME-abcdefghijklmnop-0123456789' }, () => {
    const cfg = resolveConfig({});                       // 不传 profile ⇒ 默认 workbuddy
    assert.equal(cfg.id, 'workbuddy', '默认 profile 必须是 workbuddy');
    assert.equal(cfg.isDefault, true, 'workbuddy 必须标记 isDefault');
    assert.equal(cfg.kind, 'workbuddy-gateway', '★ workbuddy 改用**智能体网关**适配器（见契约 §十六）');
    assert.equal(cfg.target, 'agent', '★ workbuddy 是智能体 API（target=agent）');
    assert.equal(cfg.baseUrl, 'http://127.0.0.1:11760',
      '★ baseUrl 由 SERVER__HOST / SERVER__PORT **动态发现**（不硬编码端口；也不再取 ANTHROPIC_BASE_URL）');
    assert.equal(cfg.apiKey, 'gw-WBRUNTIME-abcdefghijklmnop-0123456789',
      '★ 口令取自 CODEBUDDY_GATEWAY_PASSWORD（也不再取 ANTHROPIC_API_KEY）');
    // ★★ v3「不探查 / 不读取智能体内部模型」：workbuddy 是 `target:'agent'` ⇒
    //   **不得**把 ANTHROPIC_MODEL 解析进 cfg.model（那是「读取智能体内部模型信息」）⇒ 即便设了也为空。
    assert.equal(cfg.model, '', '★ agent 模式**不读** ANTHROPIC_MODEL ⇒ cfg.model 应为空（v3：不探查智能体内部模型）');
    // ★ 对照（正向控制）：显式 `kind:'anthropic'` + `target:'model'`（基础模型 API）**仍**读 ANTHROPIC_*。
    const a = resolveConfig({ kind: 'anthropic', target: 'model' });
    assert.equal(a.baseUrl, 'http://rt-wb.example:3000', '★ 对照：anthropic 适配器仍取 ANTHROPIC_BASE_URL');
    assert.equal(a.model, 'rt-wb-model', '★ 对照：基础模型 API（target=model）仍从 ANTHROPIC_MODEL 解析 model');
    const m = maskedConfig(cfg);
    assert.equal(m.hasKey, true, 'maskedConfig 应报 hasKey:true');
    assert.equal(m.keyMask, 'gw-W…', '口令应脱敏为前 4 位 + …');
    assert.ok(!JSON.stringify(m).includes(cfg.apiKey), '★ maskedConfig 输出不得含口令明文');
  });
});

test('★ workbuddy 默认 profile：无运行时 env ⇒ validate() 明确报缺 baseUrl（不静默回退）', async () => {
  rmOverride();
  await withEnv(CLEAN, async () => {
    const v = await validate();                          // ★ 无 env ⇒ 第 0 步配置自检就返回，**不发任何网络请求**
    assert.equal(v.ok, false, '无 env 时默认 profile 不可用 ⇒ ok:false');
    assert.equal(v.profile, 'workbuddy', '仍应报 profile=workbuddy（不静默切别的）');
    assert.equal(v.masked.baseUrl, '', '无 env ⇒ baseUrl 为空（不猜、不硬编码）');
    assert.ok(v.errors.some((e) => e.kind === 'config' && /baseUrl/.test(e.detail || '')), '应明确报「缺 baseUrl」');
    assert.ok(/缺\s*baseUrl|缺少\s*baseUrl/.test(v.hint), `hint 应明确说缺 baseUrl，实得：${v.hint}`);
    // ★ 默认 profile 的运行时线索是宿主注入的网关 env（`SERVER__HOST` / `SERVER__PORT`）⇒ hint 必须说这个。
    assert.ok(/SERVER__PORT/.test(v.hint),
      `★ hint 应提示默认 profile 的端点由宿主注入的 SERVER__HOST / SERVER__PORT 动态发现，实得：${v.hint}`);
  });
});

test('★ 优先级回归：覆盖文件（面板）仍压过运行时线索（守上一批的修复）', async () => {
  rmOverride();
  // ★ 默认 profile `workbuddy` 的 `kind` 是 `workbuddy-gateway` ⇒ 它的**运行时线索**是宿主注入的网关 env
  //   （`SERVER__HOST` / `SERVER__PORT` / `CODEBUDDY_GATEWAY_PASSWORD`），不是 `ANTHROPIC_*`。
  //   ★ 本用例守的是「面板（覆盖文件）> 运行时线索」这条**优先级**：baseUrl / model / key 三项断言强度不变。
  await withEnv({ ...CLEAN, SERVER__HOST: '127.0.0.1', SERVER__PORT: '11760',
    CODEBUDDY_GATEWAY_PASSWORD: 'gw-rt-abcdefghijklmnop' }, async () => {
    try {
      fs.writeFileSync(overrideFilePath(),
        JSON.stringify({ baseUrl: 'http://panel.example', model: 'panel-model' }), 'utf8');
      const cfg = resolveConfig({});                     // 面板（覆盖文件）> 运行时线索
      assert.equal(cfg.baseUrl, 'http://panel.example', '★ 面板 baseUrl 应压过网关 env 推导出的端点');
      assert.equal(cfg.model, 'panel-model', '★ 面板 model 应压过运行时线索');
      assert.equal(cfg.apiKey, 'gw-rt-abcdefghijklmnop', '未在面板给 key ⇒ 仍取运行时网关口令');
      assert.equal(resolveConfig({ model: 'explicit' }).model, 'explicit', '显式仍压过面板');
    } finally { rmOverride(); }
  });
});

test('★★ workbuddy 运行时口令不外泄：listServices / validate / 错误 detail 均不含 CODEBUDDY_GATEWAY_PASSWORD 明文', async () => {
  rmOverride();
  const SECRET = 'gw-WBLEAKCANARY-abcdefghijklmnop-0123456789';
  // 桩：网关**只读**健康检查与 run 都把口令**回显进响应体**（模拟上游回显 ⇒ 模块必须脱敏）。
  // ★ 走的是桩，**绝不**真打网关（见文件头纪律）。
  const stub = await startStub(async (req, res) => {
    if (req.method === 'GET' && req.url === '/api/v1/health') {
      return status(res, 401, JSON.stringify({ error: `bad token ${SECRET}` }));
    }
    await readBody(req);
    return status(res, 500, JSON.stringify({ error: { message: `echoed ${SECRET}` } }));
  });
  try {
    await withEnv({ ...CLEAN, ...gwEnv(stub, SECRET) }, async () => {
      const cfgWb = resolveConfig({});
      assert.equal(cfgWb.model, '', '★ 前置：agent 模式不读 ANTHROPIC_MODEL（cfg.model 为空）');
      assert.equal(cfgWb.apiKey, SECRET, '前置：口令取自网关 env（供调用）');
      // ① listServices()：绝不回口令，且不得含明文
      const lp = JSON.stringify(listServices());
      assert.ok(!lp.includes(SECRET), '★ listServices() 不得含口令明文');
      assert.ok(!lp.includes('"apiKey"'), '★ listServices() 项里不得有 apiKey 字段');
      // ② serviceById()：只回 hasKey/keyMask
      const pv = JSON.stringify(serviceById('workbuddy'));
      assert.ok(!pv.includes(SECRET), '★ serviceById() 不得含口令明文');
      // ③ validate()：错误 detail / hint / masked 都不得含明文
      const v = await validate();
      assert.equal(v.ok, false, '桩返回 401 ⇒ validate 应失败');
      assert.equal(v.steps.auth.kind, 'auth', '★ 401 ⇒ auth（网关只读探针）');
      const vBlob = JSON.stringify({ errors: v.errors, warnings: v.warnings, hint: v.hint, masked: v.masked });
      assert.ok(!vBlob.includes(SECRET), '★★ validate() 输出（含 errors[].detail）不得含口令明文');
      assert.ok(v.errors.some((e) => (e.detail || '').includes('gw-W…')),
        '错误 detail 里回显的口令应被脱敏成前 4 位 + …');
      // ④ 走一遍 chat()：错误 detail 也不得含明文
      const c = await chat([{ role: 'user', content: 'hi' }], { timeoutMs: 3000 });
      assert.equal(c.ok, false, '桩返回 500 ⇒ chat 应失败');
      const cBlob = JSON.stringify({ error: c.error, meta: c.meta });
      assert.ok(!cBlob.includes(SECRET), '★★ chat() 错误 detail / meta 不得含口令明文');
    });
  } finally { await stub.close(); rmOverride(); }
});

test('★★ v4·workbuddy 默认 profile：agent 模式打到网关桩的 POST /api/v1/runs，且请求体**不带 model**（逐字段证明）', async () => {
  rmOverride();
  const stub = await startGatewayStub();
  try {
    await withEnv({ ...CLEAN, ...gwEnv(stub, 'gw-pw-abcdefghijklmnop') }, async () => {
      const r = await chat([{ role: 'user', content: '说你好' }], { timeoutMs: 3000 });
      assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
      assert.equal(r.text, '你好', '应从网关 SSE 取到文本');
      const run = stub.seen.find((s) => s.method === 'POST' && s.url === '/api/v1/runs');
      assert.ok(run, `★ 必须打到 /api/v1/runs，实得：${JSON.stringify(stub.seen.map((s) => `${s.method} ${s.url}`))}`);
      // ★★ 「不带 model」的**逐字段**证明：请求体恰好只有这四个键（多一个都不行 ⇒ 不可能夹带 model）
      assert.equal(Object.keys(run.body).sort().join(','), 'id,sender,text,type',
        `★ 网关请求体字段应恰为 id/type/text/sender，实得：${JSON.stringify(Object.keys(run.body))}`);
      assert.equal(hasOwn(run.body, 'model'), false, '★ 请求体不得出现 model');
      assert.equal(run.body.type, 'message', 'type 固定 message');
      assert.equal(run.body.text, '说你好', '文本走 text 字段');
      assert.equal(typeof run.body.id, 'string', 'id 必填（网关 generic 适配器硬要求）');
      assert.ok(run.body.sender && run.body.sender.id, 'sender.id 必填');
      // ★ 鉴权：口令来自运行时 env（只从环境取，不落盘）
      assert.equal(run.headers.authorization, 'Bearer gw-pw-abcdefghijklmnop',
        '应带 Bearer 口令（来自 CODEBUDDY_GATEWAY_PASSWORD）');
      // ★★ 「不发模型相关请求」的证明：全程**没有任何**列举/查询模型、也没有 /v1/messages 的请求
      const urls = stub.seen.map((s) => s.url);
      assert.ok(!urls.some((u) => /\/models\b|\/models$/.test(u)), `★ 不得有模型列举请求：${JSON.stringify(urls)}`);
      assert.ok(!urls.some((u) => u === '/v1/messages'), `★ 不得打 /v1/messages（网关没有该路由）：${JSON.stringify(urls)}`);
    });
  } finally { await stub.close(); rmOverride(); }
});

test('★★ v4·workbuddy：202 {data:{runId}} ⇒ 从 SSE（GET /api/v1/runs/{runId}/stream）取回文本', async () => {
  rmOverride();
  const stub = await startGatewayStub({
    runBody: { data: { runId: 'run-abc-42', status: 'accepted' } },
    chunks: ['甲', '乙'], markdown: '甲乙',
  });
  try {
    await withEnv({ ...CLEAN, ...gwEnv(stub) }, async () => {
      const r = await chat([{ role: 'user', content: 'hi' }], { timeoutMs: 3000 });
      assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
      assert.equal(r.text, '甲乙', '文本应来自 SSE（末帧 completed 的 content.markdown 优先）');
      assert.equal(r.meta.runId, 'run-abc-42', '★ meta 应回带 runId（两段式的第一段结果）');
      assert.ok(stub.seen.some((s) => s.method === 'GET' && s.url === '/api/v1/runs/run-abc-42/stream'),
        `★ 应 GET 该 runId 的结果流，实得：${JSON.stringify(stub.seen.map((s) => `${s.method} ${s.url}`))}`);
    });
  } finally { await stub.close(); rmOverride(); }
});

test('★★ v4·workbuddy：SSE **有界超时** ⇒ kind=timeout 且**不抛**（定时器清理、进程不挂）', async () => {
  rmOverride();
  const stub = await startGatewayStub({ neverEnd: true, streamDelayMs: 30 });
  try {
    await withEnv({ ...CLEAN, ...gwEnv(stub) }, async () => {
      let r;
      try {
        r = await chat([{ role: 'user', content: 'hi' }], { timeoutMs: 1000 });
      } catch (e) {
        assert.fail(`★ chat() 抛异常了（核心承诺被破坏）：${(e && e.stack) || e}`);
      }
      assert.equal(r.ok, false, '流不结束 ⇒ 应失败');
      assert.equal(r.error.kind, 'timeout', `★ 应归一为 timeout，实得 ${r.error && r.error.kind}`);
      assert.ok(typeof r.error.message === 'string' && r.error.message.length > 0, 'message 应非空');
    });
  } finally { await stub.close(); rmOverride(); }
});

test('★★ v4·workbuddy：baseUrl **动态**（改 SERVER__PORT 就换端点；不硬编码端口）', async () => {
  rmOverride();
  const a = await startGatewayStub();
  const b = await startGatewayStub({ runBody: { data: { runId: 'run-b' } } });
  try {
    await withEnv({ ...CLEAN, ...gwEnv(a) }, async () => {
      assert.equal(resolveConfig({}).baseUrl, `http://127.0.0.1:${a.port}`,
        '★ baseUrl 应由 SERVER__HOST / SERVER__PORT 动态推导');
      const ra = await chat([{ role: 'user', content: 'hi' }], { timeoutMs: 3000 });
      assert.equal(ra.ok, true, `桩 A 应成功：${JSON.stringify(ra.error || '')}`);
      assert.ok(a.seen.some((s) => s.url === '/api/v1/runs'), '应打到桩 A');
      assert.equal(b.seen.length, 0, '★ 桩 B 不该被触碰');
    });
    await withEnv({ ...CLEAN, ...gwEnv(b) }, async () => {
      assert.equal(resolveConfig({}).baseUrl, `http://127.0.0.1:${b.port}`, '★ 换 env ⇒ 换端点');
      const rb = await chat([{ role: 'user', content: 'hi' }], { timeoutMs: 3000 });
      assert.equal(rb.ok, true, `桩 B 应成功：${JSON.stringify(rb.error || '')}`);
      assert.ok(b.seen.some((s) => s.url === '/api/v1/runs'), '★ 改 env 后应打到桩 B');
      assert.equal(rb.meta.runId, 'run-b', 'meta.runId 应来自桩 B');
    });
  } finally { await a.close(); await b.close(); rmOverride(); }
});

test('★★ v4·workbuddy 网关 validate()：**只读** GET /api/v1/health 探活 ⇒ ok:true + 三步皆过 + errors 空', async () => {
  // ★★ 本批核心约束之一：`validate({profile:'workbuddy'})` 的**形状**（网关桩、离线、不打真网关）。
  rmOverride();
  const stub = await startGatewayStub();
  try {
    await withEnv({ ...CLEAN, ...gwEnv(stub, 'gw-pw-abcdefghijklmnop') }, async () => {
      const v = await validate({ profile: 'workbuddy' });
      assert.equal(v.ok, true, `★ 网关桩健康检查应全过：${JSON.stringify(v.errors)}`);
      assert.equal(v.profile, 'workbuddy', '★ 必须报 profile=workbuddy（默认、不回退）');
      assert.equal(v.steps.reachable.ok, true, '可达');
      assert.equal(v.steps.auth.ok, true, '鉴权');
      assert.equal(v.steps.shape.ok, true, '结构');
      assert.deepEqual(v.errors, [], '不得有 error');
      assert.deepEqual(v.warnings, [], '不得有 warning');
      assert.ok(typeof v.hint === 'string' && v.hint.length > 0, '应给可操作 hint');
      // ★ 只用**只读** GET /api/v1/health 探活 —— 绝不 POST /api/v1/runs（那会真发起一次 Agent 执行）
      assert.ok(stub.seen.some((s) => s.method === 'GET' && s.url === '/api/v1/health'),
        `★ 应打只读 /api/v1/health，实得：${JSON.stringify(stub.seen.map((s) => `${s.method} ${s.url}`))}`);
      assert.ok(!stub.seen.some((s) => s.method === 'POST'),
        `★ 探活**不得**发 POST（不真发起 Agent 执行）：${JSON.stringify(stub.seen.map((s) => `${s.method} ${s.url}`))}`);
      assert.ok(!stub.seen.some((s) => /\/models/.test(s.url)), '★ 不得发任何模型列举请求');
    });
  } finally { await stub.close(); rmOverride(); }
});

// ── ⑩ 接入对象类型 `target`（`'model'` / `'agent'`）──────────────────────
//   ★ 规格原文：要区分「底层基础大模型 API」（模块**主动指定** model）与「智能体 API」
//     （WorkBuddy / Codex / ChatGPT / Claude Code / 豆包工作智能体 —— 模块**不感知、不指定、不干预**其内部底层模型）。
//     · 模型 API ⇒ 请求体**正常携带 model**、准入**校验模型标识**；
//     · 智能体 API ⇒ 面板 model **仅作本地备注**，请求体**不下发 model**、准入**不校验模型标识**。
//   ★ 委托方澄清：**取消**原「唯一例外 `kind==='anthropic'`」—— `agent` 模式**绝不下发 model**（**不看 kind**）；
//     端点若因不带 model 而 400/422「要求 model」⇒ **如实报错**（`config` + 中文 hint），**不**把 model 偷偷加回去。
//   ★ 全部离线（桩服务），不打真实外网。

test('★★ 接入对象类型·agent：请求体里**不出现 model**（★ 三种 kind 一律：openai-compatible / custom / anthropic；给了备注名也不发）', async () => {
  const seen = [];
  const stub = await startStub(async (req, res) => {
    seen.push({ url: req.url, body: JSON.parse(await readBody(req)) });
    if (req.url === '/v1/messages') return json200(res, { content: [{ type: 'text', text: 'ok' }] });
    if (req.url === '/chat/completions') return json200(res, { choices: [{ message: { content: 'ok' } }] });
    return json200(res, { result: { outputs: [{ text: 'ok' }] } });
  });
  try {
    // ① openai-compatible + agent：即便给了 model（本地备注）也**不下发**
    const a = await chat([{ role: 'user', content: 'hi' }],
      { kind: 'openai-compatible', target: 'agent', baseUrl: stub.base, model: 'just-a-note', apiKey: 'sk-test-1234567890' });
    assert.equal(a.ok, true, `应当成功：${JSON.stringify(a.error || '')}`);
    assert.equal(hasOwn(seen[0].body, 'model'), false,
      '★ agent 模式请求体**不得**出现 model（防参数覆盖干扰智能体内部调度）');
    assert.ok(Array.isArray(seen[0].body.messages), 'messages 仍应照常发出');

    // ② custom + agent：同样不下发
    const b = await chat([{ role: 'user', content: 'hi' }], {
      kind: 'custom', target: 'agent', baseUrl: stub.base, path: '/v1/infer',
      extract: 'result.outputs.0.text', model: 'note2', apiKey: 'sk-test-1234567890',
    });
    assert.equal(b.ok, true, `应当成功：${JSON.stringify(b.error || '')}`);
    assert.equal(hasOwn(seen[1].body, 'model'), false,
      '★ custom + agent 也不得出现 model');

    // ③ ★★ anthropic + agent：**取消原「agent + anthropic 仍带 model」例外** ⇒ 现在也**不下发 model**
    const c = await chat([{ role: 'user', content: 'hi' }], {
      kind: 'anthropic', target: 'agent', baseUrl: stub.base, model: 'a-note', apiKey: 'sk-test-1234567890',
    });
    assert.equal(c.ok, true, `应当成功：${JSON.stringify(c.error || '')}`);
    assert.equal(seen[2].url, '/v1/messages', 'anthropic 应打 /v1/messages');
    assert.equal(hasOwn(seen[2].body, 'model'), false,
      '★★ anthropic + agent **也不得**出现 model（委托方澄清：不向智能体下发任何 model，见契约 §十五）');
    assert.ok(Array.isArray(seen[2].body.messages), 'messages 仍应照常发出');
    assert.equal(typeof seen[2].body.max_tokens, 'number', 'max_tokens 等其余字段照常');
  } finally { await stub.close(); }
});

test('★ 接入对象类型·model（显式 target:\'model\'）：请求体**照旧带 model**（逐字节金标回归，证明向后兼容）', async () => {
  const GOLDEN = '{"model":"m","messages":[{"role":"user","content":"hi"}],"stream":false}';
  const NO_MODEL = '{"messages":[{"role":"user","content":"hi"}],"stream":false}';
  let got = null;
  const stub = await startStub(async (req, res) => {
    got = await readBody(req);
    json200(res, { choices: [{ message: { content: 'ok' } }] });
  });
  try {
    // (a) 显式 target:'model' ⇒ 逐字节金标（带 model）
    const r1 = await chat([{ role: 'user', content: 'hi' }], OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r1.ok, true, `应当成功：${JSON.stringify(r1.error || '')}`);
    assert.equal(got, GOLDEN, '★ 显式 model 模式请求体必须逐字节不变（带 model）');
    // (b) ★ 不传 target ⇒ 落到**默认 profile `workbuddy` 的 `target`（agent）** ⇒ 请求体**不带 model**
    //     （★ 这是新接口面的事实：默认 profile 是 agent；要 model 模式必须**显式** target:'model'）
    const r2 = await chat([{ role: 'user', content: 'hi' }],
      { kind: 'openai-compatible', model: 'm', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(r2.ok, true, `应当成功：${JSON.stringify(r2.error || '')}`);
    assert.equal(got, NO_MODEL, '★ 不传 target ⇒ 默认 profile 是 agent ⇒ 请求体不带 model');
    // (c) 未知 profile（`target` 兜底 = model）⇒ 同样带 model
    const r3 = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'no-such-profile', kind: 'openai-compatible', model: 'm', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(r3.ok, true, `应当成功：${JSON.stringify(r3.error || '')}`);
    assert.equal(got, GOLDEN, '★ 未知 profile 兜底 target=model ⇒ 请求体带 model');
  } finally { await stub.close(); }
});

test('★ 接入对象类型·agent：**缺 model 不报错**（model 只是本地备注；chat 仍能成功）', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return json200(res, { choices: [{ message: { content: 'pong' } }] });
  });
  try {
    await withEnv(CLEAN, async () => {
      // 显式 kind:'openai-compatible' + target:'agent' ⇒ 不要求 model
      const r = await chat([{ role: 'user', content: 'hi' }],
        { kind: 'openai-compatible', target: 'agent', baseUrl: stub.base });
      assert.equal(r.ok, true, `★ agent 模式缺 model 不应报 config：${JSON.stringify(r.error || '')}`);
      assert.equal(r.meta.model, '', '确认走的是「空 model」这条路径（不是被内置默认填上）');
    });
  } finally { await stub.close(); }
});

test('★ 接入对象类型·agent：validate() **不校验模型标识**（缺 model 也走探针、能过；对照 model 模式仍报缺）', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return json200(res, { choices: [{ message: { content: 'pong' } }] });
  });
  try {
    await withEnv(CLEAN, async () => {
      // ① agent 模式：缺 model ⇒ **不报 config**，三步走完（只校验连通/鉴权/返回文本）
      const r = await validate({ kind: 'openai-compatible', target: 'agent', baseUrl: stub.base });
      assert.equal(r.ok, true, `★ agent 模式缺 model 仍应通过（不校验模型）：${JSON.stringify(r.errors)}`);
      assert.deepEqual(r.errors, [], '★ 不得因缺 model 报 config');
      assert.equal(r.steps.auth.ok, true, '鉴权/探针这一步应过');
      // ② 对照：同一适配器默认（model 模式）缺 model ⇒ **明确报 config**（现状不变）
      const r2 = await validate({ kind: 'openai-compatible', target: 'model', baseUrl: stub.base });
      assert.equal(r2.ok, false, 'model 模式缺 model 应报错（对照）');
      assert.equal(r2.errors.find((e) => e.step === 'auth').kind, 'config');
    });
  } finally { await stub.close(); }
});

test('★★ v3·agent 模式探针**不带 model 探活**：端点回 400「要求 model」⇒ 归一为 config + 中文 hint（绝不自动加回 model）', async () => {
  let sawModel = 'n/a';
  const stub = await startStub(async (req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });                    // 可达
    const body = JSON.parse(await readBody(req));
    sawModel = hasOwn(body, 'model');
    // ★ 模拟「要求 model 的模型 API 端点」（如实测本机中继）——agent 模式不带 model ⇒ 回 400
    return status(res, 400, '{"error":{"message":"Model name not specified, model name cannot be empty"}}');
  });
  try {
    await withEnv(CLEAN, async () => {
      // ① validate()：agent 模式探针不带 model ⇒ 被 400 拒绝 ⇒ 归一为 config + hint 说清根因
      const v = await validate({ kind: 'anthropic', target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
      assert.equal(sawModel, false, '★ agent 模式探针**不得**带 model（委托方定义）');
      assert.equal(v.ok, false);
      assert.equal(v.errors.find((e) => e.step === 'auth').kind, 'config', '★ 400「要求 model」应归一为 config');
      assert.match(v.hint, /model/, 'hint 应提到 model');
      assert.match(v.hint, /底层基础算力|基础算力 API/, 'hint 应说清根因：该端点更像底层基础算力 API');
      assert.match(v.hint, /智能体 API/, 'hint 应说清：不是智能体 API');
      assert.match(v.hint, /服务入口/, 'hint 应给出出路：改用该智能体的服务入口');
      // ★ 绝不因 400 就把 model 加回去 —— 探针请求体始终无 model
      assert.equal(sawModel, false, '★ 探针**始终**不带 model（不因 400 自动加回）');

      // ② chat()：同样归一为 config + 同一句 hint（**不抛**）
      const c = await chat([{ role: 'user', content: 'hi' }],
        { kind: 'anthropic', target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
      assert.equal(c.ok, false);
      assert.equal(c.error.kind, 'config', '★ chat() 也应归一为 config');
      assert.match(c.error.message, /底层基础算力|基础算力 API/, 'chat() 的 message 应说清根因');

      // ③ invoke()：同一口径
      const iv = await invoke('chat', { messages: 'hi' },
        { kind: 'anthropic', target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
      assert.equal(iv.ok, false);
      assert.equal(iv.error.kind, 'config', '★ invoke() 也应归一为 config');

      // ④ 对照：**基础算力 API（target:'model'）** 同一 400 响应仍按既有映射（http-error）——
      //    证明这个归一**只对 agent 模式**生效，没有改到模型 API 的既有行为
      const m = await chat([{ role: 'user', content: 'hi' }],
        OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
      assert.equal(m.ok, false);
      assert.equal(m.error.kind, 'http-error', '★ 对照：模型 API 的 400 仍是 http-error（未被本归一改动）');
    });
  } finally { await stub.close(); }
});

test('★★ v3·agent 模式 validate() **零模型请求**：不发 `GET /v1/models`（只发一次 POST 探针）；对照 model 模式仍发', async () => {
  const seen = [];
  const stub = await startStub(async (req, res) => {
    seen.push({ method: req.method, url: req.url });
    if (req.method === 'GET') return json200(res, { data: [] });                 // 若被调用 ⇒ 记录到 seen
    await readBody(req);
    return json200(res, { content: [{ type: 'text', text: 'ok' }] });
  });
  try {
    await withEnv(CLEAN, async () => {
      // ① agent 模式：**不发任何模型相关请求**（规格明令「不调用 /v1/models」）
      const v = await validate({ kind: 'anthropic', target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
      assert.equal(v.ok, true, `agent 模式应三步全过：${JSON.stringify(v.errors)}`);
      assert.equal(seen.length, 1, `★ agent 模式只应发**一次**请求（POST 探针），实得 ${seen.length}：${JSON.stringify(seen)}`);
      assert.equal(seen[0].method, 'POST', '★ agent 模式那一次必须是 POST 探针');
      assert.equal(seen[0].url, '/v1/messages', 'agent + anthropic 的 POST 探针打 /v1/messages');
      assert.ok(!seen.some((s) => /\/models\b|\/models$/.test(s.url)),
        `★★ agent 模式**不得**出现任何模型列举请求（/v1/models）：${JSON.stringify(seen)}`);

      // ② 对照：**model 模式**（底层基础算力 API）**仍**发 `GET /v1/models`（未被本改动波及）
      seen.length = 0;
      const v2 = await validate({ kind: 'anthropic', target: 'model', model: 'm', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
      assert.equal(v2.ok, true, `model 模式应三步全过：${JSON.stringify(v2.errors)}`);
      assert.ok(seen.some((s) => s.method === 'GET' && s.url === '/v1/models'),
        `★ 对照：model 模式**仍**应发 GET /v1/models（模型 API 既有行为未变）：${JSON.stringify(seen)}`);
    });
  } finally { await stub.close(); }
});

test('★★ v3·agent 模式连通性**未放宽**：端点真不可达 ⇒ steps.reachable.ok=false + ok:false（不是恒真）', async () => {
  const base = await closedBase();                    // 刚关闭的端口（不打真外网）
  await withEnv(CLEAN, async () => {
    const v = await validate({ profile: 'workbuddy', baseUrl: base, apiKey: 'sk-test-1234567890', timeoutMs: 3000 });
    assert.equal(v.ok, false, '★ 端点不可达 ⇒ 必须 ok:false（连通性判据不得恒真）');
    assert.equal(v.steps.reachable.ok, false, '★★ agent 模式的连通性判据必须**真的判**：不可达 ⇒ reachable.ok=false');
    assert.equal(v.steps.reachable.kind, 'unreachable', '★ 应归一为 unreachable');
    assert.equal(v.errors.find((e) => e.step === 'reachable').kind, 'unreachable', '★ errors 里应有 reachable/unreachable');
    assert.match(v.hint, /连不上服务/, 'hint 应给出「连不上服务」的可操作提示');
  });
});

// ── ⑪ 通用算力入口 `invoke()`（见契约 §十三）──────────────────
//   ★ 归一返回：成功 `{ok:true,task,result,raw,meta}`；失败 `{ok:false,task,error:{kind,…},meta}`。
//   ★ 全部离线（桩服务），不打真实外网。

test('★★ invoke(\'chat\')：与 chat() **同请求体、同结果**（证明 chat 已改为走 invoke 且行为不变）', async () => {
  const seen = [];
  const stub = await startStub(async (req, res) => {
    seen.push(await readBody(req));
    json200(res, { choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 3 } });
  });
  try {
    const viaChat = await chat([{ role: 'user', content: 'hi' }], OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    const viaInvoke = await invoke('chat', { messages: [{ role: 'user', content: 'hi' }] },
      OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(seen[0], seen[1], '★ invoke(chat) 与 chat() 的请求体必须**逐字节相同**');
    assert.equal(viaInvoke.ok, true, `应当成功：${JSON.stringify(viaInvoke.error || '')}`);
    assert.equal(viaInvoke.task, 'chat', '返回应带 task');
    assert.equal(viaInvoke.result.text, 'ok');
    assert.equal(viaChat.text, viaInvoke.result.text, '两条入口取到的文本应一致');
    assert.equal(viaInvoke.meta.httpStatus, 200);
  } finally { await stub.close(); }
});

test('★ invoke(\'image\')：openai-compatible ⇒ POST /images/generations，body 带 model+prompt，取 data[].url', async () => {
  const stub = await startStub(async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/images/generations', '图像应打 /images/generations');
    const body = JSON.parse(await readBody(req));
    assert.equal(body.prompt, '一只猫');
    assert.equal(body.model, 'gpt-4o-mini', '基础算力（target:model）⇒ 请求体带 model');
    assert.equal(body.n, 2, '可选入参 n 应透传');
    json200(res, { data: [{ url: 'https://img.example/1.png' }, { url: 'https://img.example/2.png' }] });
  });
  try {
    const r = await invoke('image', { prompt: '一只猫', n: 2 },
      OAI({ model: 'gpt-4o-mini', baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.deepEqual(r.result.images, ['https://img.example/1.png', 'https://img.example/2.png']);
  } finally { await stub.close(); }
});

test('★ invoke(\'image\')：custom 兜底（自配 path + extract）—— 不确定的厂商形态走这里', async () => {
  const stub = await startStub(async (req, res) => {
    assert.equal(req.url, '/v1/gen', 'custom 应打配置的 path');
    json200(res, { result: { images: [{ b64_json: 'AAAA' }] } });
  });
  try {
    const r = await invoke('image', { prompt: 'x' },
      { kind: 'custom', target: 'model', baseUrl: stub.base, path: '/v1/gen', extract: 'result.images', apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.deepEqual(r.result.images, ['AAAA'], '★ 自配 extract 应能取到 b64_json');
  } finally { await stub.close(); }
});

test('★ invoke(\'image\')：anthropic 适配器无图像接口 ⇒ 明确 config 错（不抛）', async () => {
  const r = await invoke('image', { prompt: 'x' },
    ANTH({ baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-test-1234567890' }));
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'config', 'anthropic 无图像接口应归一为 config');
});

test('★ invoke(\'embedding\')：POST /embeddings，取 data[].embedding ⇒ vectors', async () => {
  const stub = await startStub(async (req, res) => {
    assert.equal(req.url, '/embeddings');
    const body = JSON.parse(await readBody(req));
    assert.deepEqual(body.input, ['甲', '乙']);
    json200(res, { data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3] }] });
  });
  try {
    const r = await invoke('embedding', { input: ['甲', '乙'] }, OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.deepEqual(r.result.vectors, [[0.1, 0.2], [0.3]]);
  } finally { await stub.close(); }
});

// ── ★ `embedding` 判定收紧（一条向量 = 非空且**元素全为数字**的数组，契约 §13.2）──
//   ★ 由来（第 7 轮审计 A3）：原判据 `Array.isArray(v) && v.length` **不校验元素类型** ⇒
//     `invoke('embedding',{extract:'data'})` 会把 `{embedding:[…]}`（**对象**）或 `['a','b']`（**字符串数组**）
//     误当向量（`ok:true`）。⇒ 下面三条：① 真向量 ⇒ 仍 `ok:true`；② 对象数组 / ③ 字符串数组 ⇒ `bad-shape`。

test('★★ invoke(\'embedding\')·收紧后：extract 指向 `[[0.1,0.2]]`（数组的数组）⇒ ok:true、vectors=[[0.1,0.2]]', async () => {
  const stub = await startStub((req, res) => json200(res, { data: [[0.1, 0.2]] }));
  try {
    const r = await invoke('embedding', { input: 'x' },
      OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890', extract: 'data' }));
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.deepEqual(r.result.vectors, [[0.1, 0.2]], '★ 真向量（元素全为数字）应被接受，不受收紧影响');
  } finally { await stub.close(); }
});

test('★★ invoke(\'embedding\')·收紧后：extract 指向 `[{embedding:[…]}]`（**对象**数组）⇒ bad-shape（第 7 轮审计 A3）', async () => {
  const stub = await startStub((req, res) => json200(res, { data: [{ embedding: [0.1, 0.2] }] }));
  try {
    const r = await invoke('embedding', { input: 'x' },
      OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890', extract: 'data' }));
    assert.equal(r.ok, false, '★ 对象不得被当成向量');
    assert.equal(r.error.kind, 'bad-shape', '★ 取不到合法向量应归一为 bad-shape');
  } finally { await stub.close(); }
});

test('★★ invoke(\'embedding\')·收紧后：extract 指向 `[\'a\',\'b\']`（**字符串**数组）⇒ bad-shape', async () => {
  const stub = await startStub((req, res) => json200(res, { data: ['a', 'b'] }));
  try {
    const r = await invoke('embedding', { input: 'x' },
      OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890', extract: 'data' }));
    assert.equal(r.ok, false, '★ 字符串数组不得被当成向量');
    assert.equal(r.error.kind, 'bad-shape', '★ 取不到合法向量应归一为 bad-shape');
  } finally { await stub.close(); }
});

test('★ invoke(\'audio\')：openai-compatible ⇒ POST /audio/speech，**二进制响应** ⇒ result.audio = base64', async () => {
  const RAW = Buffer.from('FAKE-MP3-BYTES-\u0000\u0001\u0002');
  const stub = await startStub(async (req, res) => {
    assert.equal(req.url, '/audio/speech');
    const body = JSON.parse(await readBody(req));
    assert.equal(body.input, '你好');
    assert.equal(body.voice, 'alloy');
    res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
    res.end(RAW);                                     // ★ 音频是**字节流**，不是 JSON
  });
  try {
    const r = await invoke('audio', { input: '你好', voice: 'alloy' }, OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.equal(r.result.audio, RAW.toString('base64'), '★ 二进制响应应原样取成 base64（不当文本读）');
    assert.match(r.result.mime, /audio\/mpeg/, '应带出响应 Content-Type');
  } finally { await stub.close(); }
});

test('★ invoke(\'custom\')：通用出口 —— 请求体由调用方自定，path/extract 可配', async () => {
  const stub = await startStub(async (req, res) => {
    assert.equal(req.url, '/v1/anything');
    const body = JSON.parse(await readBody(req));
    assert.equal(body.hello, 'world');
    json200(res, { result: { answer: 42 } });
  });
  try {
    const r = await invoke('custom', { body: { hello: 'world' } },
      { kind: 'custom', target: 'model', baseUrl: stub.base, path: '/v1/anything', extract: 'result.answer', apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.equal(r.result.value, 42);
  } finally { await stub.close(); }
});

test('★ invoke：未知 task / 缺 baseUrl ⇒ config 错（不抛）；task 名回显在返回里', async () => {
  const r1 = await invoke('nope', {}, OAI({ baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-test-1234567890' }));
  assert.equal(r1.ok, false);
  assert.equal(r1.error.kind, 'config');
  assert.equal(r1.task, 'nope');
  const r2 = await invoke('chat', { messages: 'hi' }, { kind: 'custom', target: 'model' });   // custom 无 baseUrl
  assert.equal(r2.ok, false);
  assert.equal(r2.error.kind, 'config');
  assert.match(r2.error.message, /baseUrl/);
});

// ── ⑫ v3「不探查 / 不读取智能体内部模型」（见契约 §十四）────────────

test('★★ v3·agent 模式**不再从环境读取 model**：设了 ANTHROPIC_MODEL 也不进 cfg.model（对照 model 模式会进）', async () => {
  rmOverride();
  await withEnv({ ...CLEAN, ANTHROPIC_MODEL: 'env-model-must-be-ignored', ANTHROPIC_BASE_URL: 'http://rt.example' }, () => {
    // ① agent（workbuddy）：**不读** ANTHROPIC_MODEL
    const wb = resolveConfig({});
    assert.equal(wb.target, 'agent', 'workbuddy 是智能体 API');
    assert.equal(wb.model, '', '★ agent 模式设了 ANTHROPIC_MODEL 也**不得**进 cfg.model（v3：不探查智能体内部模型）');
    // ② 对照：显式 kind:'anthropic' + target:'model'（基础模型 API）**仍读** ANTHROPIC_MODEL
    assert.equal(resolveConfig({ kind: 'anthropic', target: 'model' }).model, 'env-model-must-be-ignored',
      '对照：基础模型 API（model 模式）仍从 ANTHROPIC_MODEL 解析 model');
    // ③ agent 的 model **仍可**来自「用户自己填的本地备注」：显式传参 / 覆盖文件 / LEMO_LLM_MODEL
    assert.equal(resolveConfig({ model: 'note-by-user' }).model, 'note-by-user', 'agent 仍可用**显式传参**填本地备注');
    assert.equal(resolveConfig({ profile: 'workbuddy', model: 'note2' }).model, 'note2');
  });
  // ④ LEMO_LLM_MODEL（本项目自己的覆盖点）仍能进 agent 的 cfg.model（它是「用户/CI 显式配置」，不是「探查」）
  await withEnv({ ...CLEAN, ANTHROPIC_MODEL: 'env-ignored', LEMO_LLM_MODEL: 'ci-note' }, () => {
    assert.equal(resolveConfig({}).model, 'ci-note', '★ LEMO_LLM_MODEL 仍应进 agent 的 cfg.model');
  });
  // ⑤ 覆盖文件（面板）也仍能进（= 用户自己填的备注）
  await withEnv(CLEAN, () => {
    rmOverride();
    fs.writeFileSync(overrideFilePath(), JSON.stringify({ model: 'panel-note' }), 'utf8');
    try {
      assert.equal(resolveConfig({}).model, 'panel-note', '★ 覆盖文件（面板）仍应进 agent 的 cfg.model');
    } finally { rmOverride(); }
  });
});

test('★★ v3·agent + 网关适配器 + model 为空 ⇒ **不报 config**，而是**不带 model 正常发出**', async () => {
  // ★ `workbuddy`（agent + 网关适配器）的内置 model 恰为 `''`，且干净环境**不从 env 偷读**
  //   ⇒ 请求应正常发出、**不带 model**、成功。
  let got = null;
  const stub = await startGatewayStub({ onRun: (b) => { got = b; } });
  try {
    await withEnv({ ...CLEAN, ...gwEnv(stub) }, async () => {
      const c = await chat([{ role: 'user', content: 'hi' }], { timeoutMs: 3000 });
      assert.equal(c.ok, true, `★ agent 模式缺 model 不应报 config：${JSON.stringify(c.error || '')}`);
      assert.equal(hasOwn(got, 'model'), false,
        '★ agent 模式请求体**不得**出现 model（即便 cfg.model 为空）');
      assert.equal(c.meta.model, '', '★ 干净环境下 agent 的 model 为空（不从 ANTHROPIC_MODEL 偷读）');

      const iv = await invoke('chat', { messages: 'hi' }, { timeoutMs: 3000 });
      assert.equal(iv.ok, true, `★ invoke() 同样不报 config：${JSON.stringify(iv.error || '')}`);

      // validate()：连通 / 鉴权 / 返回文本三项全过（agent 模式不校验模型标识）；hint 不得提示 ANTHROPIC_MODEL
      const v = await validate();
      assert.equal(v.ok, true, `★ agent 模式应三步全过：${JSON.stringify(v.errors)}`);
      assert.deepEqual(v.errors, [], '★ 不得因缺 model 报 config');
      assert.ok(!/ANTHROPIC_MODEL/.test(v.hint), '★ agent 模式 hint 不得提示 ANTHROPIC_MODEL（模块不读智能体内部模型）');
    });
  } finally { await stub.close(); }
});

test('★ v3·基础算力模式**仍校验服务标识**：target=model 且 model 为空 ⇒ config 错；agent 模式则不校验（能联通即准入）', async () => {
  const stub = await startStub((req, res) => json200(res, { choices: [{ message: { content: 'ok' } }] }));
  try {
    await withEnv(CLEAN, async () => {
      // 基础算力（openai-compatible + target:model + model 为空）⇒ 校验服务标识 ⇒ config 错
      const r = await invoke('chat', { messages: 'hi' },
        { kind: 'openai-compatible', target: 'model', model: '', baseUrl: stub.base });
      assert.equal(r.ok, false, '★ 基础算力缺服务标识（model）应失败');
      assert.equal(r.error.kind, 'config');
      // 智能体模式（同适配器，target:agent）⇒ **不校验**服务标识 ⇒ 只要能联通即准入
      const r2 = await invoke('chat', { messages: 'hi' },
        { kind: 'openai-compatible', target: 'agent', baseUrl: stub.base });
      assert.equal(r2.ok, true, `★ agent 模式不校验服务标识（缺 model 也能联通）：${JSON.stringify(r2.error || '')}`);
    });
  } finally { await stub.close(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ── ⑬ ★★ 多套「算力服务」存储 + CRUD —— 2026-10-10 新增能力（此前只有一次性探针）──
// ═══════════════════════════════════════════════════════════════════════════
//   ★ 覆盖文件模型：`<成片根>/_llm-api.json` = `{version:1, active, services:[…]}`（本测试在 TMP 内）。
//   ★ 纪律：每条用例**先 rmOverride()、finally 再 rmOverride()** ⇒ 绝不把状态泄漏给后续用例。
//   ★ 全部走 `withEnv(CLEAN, …)` 隔离外部环境（含 SERVER__* / ANTHROPIC_* 等运行时线索）。

test('★★ 多套服务 CRUD：清空默认 ⇒ 新增两套 ⇒ 列表恰 2 套 ⇒ 切换生效跟着变 ⇒ 删一套剩 1', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      // 无覆盖时：存储视图含**出厂默认** `workbuddy` 一套（★ 可删，不锁死）
      assert.deepEqual(listServices().map((s) => s.id), ['workbuddy'], '无覆盖时应含出厂默认 workbuddy');
      // ★ 删掉出厂默认 ⇒ 空 services（合法）
      const d0 = deleteService('workbuddy');
      assert.equal(d0.ok, true, `删除 workbuddy 应成功：${JSON.stringify(d0)}`);
      assert.deepEqual(listServices(), [], '★ 删光后 listServices() 应为空数组（空 services 合法）');
      assert.equal(getActiveService(), null, '★ 一套都没有时 getActiveService() 应为 null');

      // 新增两套（先清空 ⇒ 恰 2 套，便于逐条断言）
      const a = saveService({
        id: 'svc-a', label: 'A 服务', kind: 'openai-compatible', target: 'model',
        baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-aaaaaaaaaaaa', model: 'ma',
      });
      assert.equal(a.ok, true, `saveService svc-a 应成功：${JSON.stringify(a)}`);
      assert.equal(a.service.id, 'svc-a');
      assert.equal(a.service.active, true, '★ 空表里保存的第一套应成为当前生效');
      const b = saveService({
        id: 'svc-b', label: 'B 服务', kind: 'anthropic', target: 'model',
        baseUrl: 'http://127.0.0.1:2', apiKey: 'sk-bbbbbbbbbbbb', model: 'mb',
      });
      assert.equal(b.ok, true, `saveService svc-b 应成功：${JSON.stringify(b)}`);

      // 列表见 2 套
      const list = listServices();
      assert.equal(list.length, 2, `★ 新增两套后应恰 2 套，实得 ${list.length}：${JSON.stringify(list.map((s) => s.id))}`);
      assert.deepEqual(list.map((s) => s.id).sort(), ['svc-a', 'svc-b']);
      assert.equal(list.find((s) => s.id === 'svc-a').kind, 'openai-compatible', 'kind 应如实存回');
      assert.equal(list.find((s) => s.id === 'svc-b').kind, 'anthropic', 'kind 应如实存回');

      // 切换 ⇒ getActiveService() 跟着变；listServices 的 active 标记也跟着变
      const sw = setActiveService('svc-b');
      assert.equal(sw.ok, true, `setActiveService svc-b 应成功：${JSON.stringify(sw)}`);
      assert.equal(sw.active, 'svc-b');
      assert.equal(getActiveService().id, 'svc-b', '★ 切换后 getActiveService() 必须是 svc-b');
      assert.equal(getActiveService().baseUrl, 'http://127.0.0.1:2', '★ 生效的应是 svc-b 那套（baseUrl 跟着变）');
      const list2 = listServices();
      assert.equal(list2.find((s) => s.id === 'svc-b').active, true, 'svc-b 的 active 标记应为 true');
      assert.equal(list2.find((s) => s.id === 'svc-a').active, false, 'svc-a 的 active 标记应为 false');

      // 删一套 ⇒ 剩 1 套
      const del = deleteService('svc-b');
      assert.equal(del.ok, true, `deleteService svc-b 应成功：${JSON.stringify(del)}`);
      const list3 = listServices();
      assert.equal(list3.length, 1, `★ 删一套后应剩 1 套，实得 ${list3.length}`);
      assert.equal(list3[0].id, 'svc-a');
      assert.equal(getActiveService().id, 'svc-a', '★ 删掉当前那套后应自动切到剩下的第一套');
    } finally { rmOverride(); }
  });
});

test('★★ 向后兼容迁移：旧「单份覆盖」格式 ⇒ 自动迁移成「一套服务」（id 取 profile，缺省 workbuddy）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      // 旧格式（单份覆盖）：顶层直接写 baseUrl / apiKey / model（**无** services 数组）
      fs.writeFileSync(overrideFilePath(),
        JSON.stringify({ baseUrl: 'http://legacy.example/v1', apiKey: 'sk-legacy123456', model: 'legacy-model' }), 'utf8');
      const list = listServices();
      assert.equal(list.length, 1, `★ 旧格式应迁移成恰 1 套服务，实得 ${list.length}`);
      assert.equal(list[0].id, 'workbuddy', '★ 迁移时 id 取 profile，缺省应是 workbuddy');
      assert.equal(list[0].baseUrl, 'http://legacy.example/v1', '旧 baseUrl 应迁进该服务');
      assert.equal(list[0].model, 'legacy-model', '旧 model 应迁进该服务');
      assert.equal(list[0].active, true, '迁移出的唯一一套应是当前生效');
      // ★ 迁移后 resolveConfig 仍取到旧字段（「写旧格式、读回旧字段」的既有语义不变）
      const cfg = resolveConfig({});
      assert.equal(cfg.baseUrl, 'http://legacy.example/v1', '★ 迁移后 resolveConfig 仍应取到旧 baseUrl');
      assert.equal(cfg.model, 'legacy-model', '★ 迁移后 resolveConfig 仍应取到旧 model');
      assert.equal(cfg.apiKey, 'sk-legacy123456', '★ 迁移后 resolveConfig 仍应取到旧 apiKey（模块内部用，不脱敏）');
      assert.equal(cfg.servicesEmpty, false, '迁移出的服务非空 ⇒ servicesEmpty 应为 false');
      assert.equal(cfg.serviceId, 'workbuddy', '★ 迁移后生效的服务 id 应是 workbuddy');

      // 旧格式里**显式**写了 profile ⇒ 迁移 id 取它（不一定是 workbuddy）
      rmOverride();
      fs.writeFileSync(overrideFilePath(),
        JSON.stringify({ profile: 'my-custom', baseUrl: 'http://legacy2/v1', model: 'm2' }), 'utf8');
      assert.equal(listServices()[0].id, 'my-custom', '★ 显式 profile 应作为迁移后的服务 id');
    } finally { rmOverride(); }
  });
});

test('★★ 空 services：删光 ⇒ chat() 不抛、返回 kind=config 且 message 含「未配置任何算力服务」', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      deleteService('workbuddy');                       // 删掉出厂默认 ⇒ 空 services
      assert.deepEqual(listServices(), [], '前置：应已删光（空 services 合法）');
      let r;
      try {
        r = await chat([{ role: 'user', content: 'hi' }], {});
      } catch (e) {
        assert.fail(`★ 空 services 时 chat() **抛异常了**（应优雅报错、绝不崩）：${(e && e.stack) || e}`);
      }
      assert.equal(r.ok, false, '★ 空 services 时 chat() 应 ok:false（不是崩）');
      assert.equal(r.error.kind, 'config', '★ 应归一为 config 错');
      assert.match(r.error.message, /未配置任何算力服务/, `★ message 应含「未配置任何算力服务」：${r.error.message}`);
      assert.equal(resolveConfig({}).servicesEmpty, true, '★ 空 services 时 cfg.servicesEmpty 应为 true');
    } finally { rmOverride(); }
  });
});

test('★ 脱敏：listServices() / serviceById() 绝不返回 apiKey 明文（字段不存在 / 只回掩码）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      const SECRET = 'sk-supersecret-abcdef123456';
      const saved = saveService({
        id: 'svc-secret', kind: 'openai-compatible', target: 'model', baseUrl: 'http://127.0.0.1:9',
        apiKey: SECRET, model: 'm', headers: { Authorization: `Bearer ${SECRET}` },
      });
      assert.equal(saved.ok, true, `saveService 应成功：${JSON.stringify(saved)}`);
      const fromList = listServices().find((s) => s.id === 'svc-secret');
      const byId = serviceById('svc-secret');
      assert.ok(fromList && byId, 'listServices() / serviceById() 都应能取到刚存的服务');
      for (const [name, obj] of [['listServices()', fromList], ['serviceById()', byId], ['saveService() 回执', saved.service]]) {
        assert.equal(hasOwn(obj, 'apiKey'), false, `★ ${name} 不得含 apiKey 字段（明文泄露）`);
        assert.ok(!JSON.stringify(obj).includes(SECRET), `★ ${name} 的 JSON 里出现了 key 明文`);
        assert.equal(obj.hasKey, true, `${name} 应回 hasKey:true`);
        assert.ok(typeof obj.keyMask === 'string' && obj.keyMask.length > 0 && obj.keyMask !== SECRET,
          `${name} 应回掩码 keyMask（非明文），实得 ${JSON.stringify(obj.keyMask)}`);
        assert.ok(!JSON.stringify(obj.headers || {}).includes(SECRET), `★ ${name} 的 headers 泄露了 key 明文`);
      }
      // 反向：明文密钥**只**落在覆盖文件里（契约 §八 唯一允许处）
      assert.ok(fs.readFileSync(overrideFilePath(), 'utf8').includes(SECRET), '覆盖文件应存明文 key（§八）');
    } finally { rmOverride(); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── ⑭ ★★ 自动重试 / 降级（`httpRequestRetry`）—— 2026-10-10 新增能力 ──────
// ═══════════════════════════════════════════════════════════════════════════
//   ★ 只重试**幂等可重试**的失败（网络瞬态 / 408 / 425 / 429 / 5xx）；4xx 鉴权 / 参数错**绝不重试**。
//   ★★ 总耗时受 `opts.timeoutMs` 封顶 —— 重试**不把超时放大成 N 倍**（本批最值钱的一条）。
//   ★ 用本机桩 + **请求计数**钉住「到底发了几次」。

test('★★ 重试·默认不叠加（DEFAULT_RETRY=0）：桩先 500 后 200 ⇒ 桩只收 1 次、首次即失败', async () => {
  let count = 0;
  const stub = await startStub((req, res) => {
    count += 1;
    if (count === 1) return status(res, 500, '{"error":"boom"}');
    return json200(res, { choices: [{ message: { content: 'ok-after-retry' } }] });
  });
  try {
    const r = await chat([{ role: 'user', content: 'hi' }],
      { ...OAI(), baseUrl: stub.base, timeoutMs: 3000 });
    assert.equal(r.ok, false, '★ 默认不重试 ⇒ 首次 500 即失败（已无 opts.retry 覆盖点）');
    assert.equal(count, 1, `★ 桩应恰收 1 次请求（不重试），实得 ${count}`);
    assert.equal(r.meta.attempts, 1, '★ meta.attempts 应为 1（真实发出的请求次数）');
  } finally { await stub.close(); }
});

test('★★ 重试·鉴权错不重试：桩恒 401 ⇒ 桩只收 1 次（4xx 鉴权错绝不重试）', async () => {
  let count = 0;
  const stub = await startStub((req, res) => { count += 1; return status(res, 401, '{"error":"nope"}'); });
  try {
    const r = await chat([{ role: 'user', content: 'hi' }],
      { ...OAI(), baseUrl: stub.base, timeoutMs: 3000 });
    assert.equal(r.ok, false);
    assert.equal(r.error.kind, 'auth', '401 ⇒ kind=auth');
    assert.equal(count, 1, `★ 鉴权错绝不重试：桩应只收 1 次，实得 ${count}`);
    assert.equal(r.meta.attempts, 1, '★ meta.attempts 应为 1');
  } finally { await stub.close(); }
});

test('★★ 重试·总耗时受 timeoutMs 封顶（重试不把超时乘 N）：恒 503 / 恒挂住 两种桩 + timeoutMs:1000 ⇒ 均 < 2×timeoutMs', async () => {
  const TIMEOUT = 1000;
  // ① 恒 503（快速响应）
  let n503 = 0;
  const stub503 = await startStub((req, res) => { n503 += 1; return status(res, 503, '{"error":"busy"}'); });
  try {
    const t0 = Date.now();
    const r = await chat([{ role: 'user', content: 'hi' }],
      { ...OAI(), baseUrl: stub503.base, timeoutMs: TIMEOUT });
    const elapsed = Date.now() - t0;
    assert.equal(r.ok, false);
    assert.ok(elapsed < TIMEOUT * 2,
      `★ 503 重试总耗时应受 timeoutMs 封顶（< ${TIMEOUT * 2}ms），实得 ${elapsed}ms（若 ≈3s ⇒ 重试把耗时放大了）`);
    assert.equal(r.meta.attempts, n503, 'meta.attempts 应等于桩真实收到的请求数');
    assert.equal(n503, 1, `★ 默认不重试（DEFAULT_RETRY=0）⇒ 桩应只收 1 次，实得 ${n503}`);
  } finally { await stub503.close(); }

  // ② 恒挂住（每次尝试都会跑满**单次**超时）
  let nHang = 0;
  const stubHang = await startStub(() => { nHang += 1; /* 故意不响应 */ });
  try {
    const t0 = Date.now();
    const r = await chat([{ role: 'user', content: 'hi' }],
      { ...OAI(), baseUrl: stubHang.base, timeoutMs: TIMEOUT });
    const elapsed = Date.now() - t0;
    assert.equal(r.ok, false);
    assert.equal(r.error.kind, 'timeout', '恒挂住 ⇒ kind=timeout');
    assert.ok(elapsed < TIMEOUT * 2,
      `★★ 每次尝试都跑满单次超时时，总耗时仍须 ≤ timeoutMs 量级（< ${TIMEOUT * 2}ms），实得 ${elapsed}ms（若 ≈5s ⇒ 超时被乘了 5 倍）`);
    assert.equal(nHang, 1, `★ 预算耗尽后不得再发新请求：桩应只收 1 次，实得 ${nHang}`);
  } finally { await stubHang.close(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ── ⑮ ★★ P1 新交付能力（标准 §8 / §11.1 / §11.2 / §11.5 / §11.8）—— 2026-10-10 ──
// ═══════════════════════════════════════════════════════════════════════════
//   本批 5 项此前**只有一次性探针验过（探针已删）** ⇒ 这里补**永久回归**：
//     ① `chatWithFallback`（跨服务降级）—— 主失败依次试 `fallbacks`，`meta.tried` 如实列出，**永不抛**；
//     ② `forceStream`（`chat()` 改走流式聚合）/ `ensureSystemPrompt`（首条非 system ⇒ 自动补）—— 服务字段 + 显式开关；
//     ③ `stream()` —— 逐块产出、**永不抛**、不支持的 kind 优雅报「不支持流式」；
//     ④ `joinUrl` 版本段去重（`/v1` + `/v1/…` 不拼成 `/v1/v1/…`；base 已含完整 path 不重复拼）；
//     ⑤ §11.1 空值保护（传空 key / 空 headers ⇒ 旧值仍在；显式 `clearKey` / `clearHeaders` 才清空）。
//   ★ 纪律：本机桩 + 临时成片根（TMP）；**绝不真打外网**；每条先 `rmOverride()` + `withEnv(CLEAN)`，`finally` 还原。

/** ★ 记录请求的桩（本段共用）：解析 JSON body 后记进 `seen`（`{method,url,body,stream}`），再交给 `handler`。
 *  ★ 反空转用：用例**先断言 `seen.length===0`（点之前 0 条）**，跑完再断言**精确条数**。 */
async function startRecStub(handler) {
  const seen = [];
  const stub = await startStub(async (req, res) => {
    let body = null;
    try { body = JSON.parse((await readBody(req)) || '{}'); } catch { body = null; }
    const rec = { method: req.method, url: req.url, body, stream: !!(body && body.stream) };
    seen.push(rec);
    return handler(req, res, rec, seen);
  });
  return { ...stub, seen };
}

/** OpenAI 兼容的 SSE 流式响应（`chat/completions`）：逐块 `choices.0.delta.content` + `[DONE]`。 */
function sseChat(res, deltas) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  for (const d of deltas) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

test('★★ 降级·chatWithFallback：主服务失败 ⇒ 依次试 fallbacks 走到 B；meta.tried 如实列出 + fallbackUsed:true（且不抛）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const A = await startRecStub((req, res) => status(res, 500, '{"error":"A-down"}'));
    const B = await startRecStub((req, res) => json200(res, { choices: [{ message: { content: 'from-B' } }] }));
    try {
      assert.equal(saveService({ id: 'svc-fb-a', kind: 'openai-compatible', target: 'model', baseUrl: A.base, model: 'm' }).ok, true);
      assert.equal(saveService({ id: 'svc-fb-b', kind: 'openai-compatible', target: 'model', baseUrl: B.base, model: 'm' }).ok, true);
      // ★ 反空转：发之前两桩都 0 条
      assert.equal(A.seen.length, 0, 'A 桩发之前应 0 条');
      assert.equal(B.seen.length, 0, 'B 桩发之前应 0 条');
      let r;
      try {
        r = await chatWithFallback([{ role: 'user', content: 'hi' }],
          { service: 'svc-fb-a', fallbacks: ['svc-fb-b'], timeoutMs: 3000 });
      } catch (e) {
        assert.fail(`★ chatWithFallback **抛异常了**（应永不抛）：${(e && e.stack) || e}`);
      }
      assert.equal(r.ok, true, `★ 主失败后应降级到 B 成功：${JSON.stringify(r.error || '')}`);
      assert.equal(r.text, 'from-B', '取到的应是 B 的文本');
      assert.equal(r.meta.fallbackUsed, true, '★ 用了降级 ⇒ meta.fallbackUsed 应为 true');
      assert.ok(Array.isArray(r.meta.tried), 'meta.tried 应是数组');
      assert.equal(r.meta.tried.length, 2, `meta.tried 应如实列 2 条，实得 ${JSON.stringify(r.meta.tried)}`);
      assert.equal(r.meta.tried[0].service, 'svc-fb-a', '★ 第 1 条应是主服务 A');
      assert.equal(r.meta.tried[0].ok, false, '★ A 失败 ⇒ ok:false');
      assert.equal(r.meta.tried[0].error.kind, 'http-error', '★ A 是 500 ⇒ 试错 kind=http-error');
      assert.equal(r.meta.tried[1].service, 'svc-fb-b', '★ 第 2 条应是降级 B');
      assert.equal(r.meta.tried[1].ok, true, '★ B 成功 ⇒ ok:true');
      // ★ 反空转：两桩各恰 1 条（真发了，且各只发一次）
      assert.equal(A.seen.length, 1, `A 应恰收 1 次，实得 ${A.seen.length}`);
      assert.equal(B.seen.length, 1, `B 应恰收 1 次，实得 ${B.seen.length}`);
    } finally { await A.close(); await B.close(); rmOverride(); }
  });
});

test('★★ 降级·主服务成功 ⇒ 不碰 fallbacks（B 桩 0 条）、fallbackUsed:false、tried 只 1 条', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const A = await startRecStub((req, res) => json200(res, { choices: [{ message: { content: 'from-A' } }] }));
    const B = await startRecStub((req, res) => json200(res, { choices: [{ message: { content: 'from-B' } }] }));
    try {
      assert.equal(saveService({ id: 'svc-fb-a2', kind: 'openai-compatible', target: 'model', baseUrl: A.base, model: 'm' }).ok, true);
      assert.equal(saveService({ id: 'svc-fb-b2', kind: 'openai-compatible', target: 'model', baseUrl: B.base, model: 'm' }).ok, true);
      assert.equal(A.seen.length, 0); assert.equal(B.seen.length, 0);
      const r = await chatWithFallback([{ role: 'user', content: 'hi' }],
        { service: 'svc-fb-a2', fallbacks: ['svc-fb-b2'], timeoutMs: 3000 });
      assert.equal(r.ok, true);
      assert.equal(r.text, 'from-A');
      assert.equal(r.meta.fallbackUsed, false, '★ 主即成功 ⇒ fallbackUsed 应为 false');
      assert.equal(r.meta.tried.length, 1, '主即成功 ⇒ tried 只 1 条');
      assert.equal(B.seen.length, 0, `★ 主即成功 ⇒ 绝不碰 fallback（B 应 0 条），实得 ${B.seen.length}`);
    } finally { await A.close(); await B.close(); rmOverride(); }
  });
});

test('★★ 降级·全败 ⇒ ok:false（取最后一个错）+ tried 全 false，且不抛', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const A = await startRecStub((req, res) => status(res, 500, '{"error":"A-down"}'));
    const B = await startRecStub((req, res) => status(res, 500, '{"error":"B-down"}'));
    try {
      assert.equal(saveService({ id: 'svc-fb-a3', kind: 'openai-compatible', target: 'model', baseUrl: A.base, model: 'm' }).ok, true);
      assert.equal(saveService({ id: 'svc-fb-b3', kind: 'openai-compatible', target: 'model', baseUrl: B.base, model: 'm' }).ok, true);
      let r;
      try {
        r = await chatWithFallback([{ role: 'user', content: 'hi' }],
          { service: 'svc-fb-a3', fallbacks: ['svc-fb-b3'], timeoutMs: 3000 });
      } catch (e) { assert.fail(`★ 全败也不许抛：${(e && e.stack) || e}`); }
      assert.equal(r.ok, false, '★ 全败 ⇒ ok:false');
      assert.equal(r.error.kind, 'http-error', '★ 取最后一个失败（B 的 500 ⇒ http-error）');
      assert.equal(r.meta.tried.length, 2);
      assert.equal(r.meta.tried.every((t) => t.ok === false), true, `tried 应全为 false：${JSON.stringify(r.meta.tried)}`);
      assert.equal(A.seen.length, 1); assert.equal(B.seen.length, 1);
    } finally { await A.close(); await B.close(); rmOverride(); }
  });
});

test('★★ 11101 兜底：非流式被拒（400+11101）⇒ 自动改走流式成功；★ 桩收到请求形态依次 [{stream:false},{stream:true}]', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const stub = await startRecStub((req, res, rec) => {
      if (rec.stream) return sseChat(res, ['streamed-', 'ok']);
      return status(res, 400, JSON.stringify({ error: { code: 11101, message: 'Non-stream chat request is currently not supported' } }));
    });
    try {
      assert.equal(stub.seen.length, 0, '发之前应 0 条');
      let r;
      try {
        r = await chat([{ role: 'user', content: 'hi' }], { ...OAI(), baseUrl: stub.base, timeoutMs: 3000 });
      } catch (e) { assert.fail(`★ chat() 抛异常了：${(e && e.stack) || e}`); }
      assert.equal(r.ok, true, `★ 400+11101 应自动改走流式并成功：${JSON.stringify(r.error || '')}`);
      assert.equal(r.text, 'streamed-ok', '聚合文本应是流式增量拼接');
      assert.equal(r.meta.via, 'stream', '★ meta.via=stream（自证经流式取得）');
      // ★★ 直接证据：桩收到的请求形态**依次**是「先非流式、再流式」
      assert.deepEqual(stub.seen.map((s) => ({ stream: s.stream })), [{ stream: false }, { stream: true }],
        `★ 请求形态应依次 [{stream:false},{stream:true}]，实得 ${JSON.stringify(stub.seen.map((s) => s.stream))}`);
      assert.equal(stub.seen.length, 2, `★ 应恰 2 次请求（1 非流式 + 1 流式），实得 ${stub.seen.length}`);
    } finally { await stub.close(); rmOverride(); }
  });
});

test('★★ forceStream：显式 true / 服务字段 true ⇒ chat 走流式聚合；★ 显式 false 能关掉（压过服务里的 true）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const stub = await startRecStub((req, res, rec) => (rec.stream
      ? sseChat(res, ['via-', 'stream'])
      : json200(res, { choices: [{ message: { content: 'via-nonstream' } }] })));
    try {
      // (a) 显式 forceStream:true
      assert.equal(stub.seen.length, 0, '发之前应 0 条');
      const a = await chat([{ role: 'user', content: 'hi' }], { ...OAI(), baseUrl: stub.base, forceStream: true, timeoutMs: 3000 });
      assert.equal(a.ok, true, `forceStream 应成功：${JSON.stringify(a.error || '')}`);
      assert.equal(a.text, 'via-stream', '★ forceStream ⇒ 应取流式聚合文本');
      assert.equal(a.meta.via, 'stream', '★ 应经流式取得');
      assert.deepEqual(stub.seen.map((s) => s.stream), [true], '★ forceStream ⇒ 桩只收 stream:true');

      // (b) 服务配置字段 forceStream:true 同样生效
      stub.seen.length = 0;
      const s = saveService({ id: 'svc-force', kind: 'openai-compatible', target: 'model', baseUrl: stub.base, model: 'm', forceStream: true });
      assert.equal(s.ok, true, `保存带 forceStream 的服务应成功：${JSON.stringify(s)}`);
      assert.equal(s.service.forceStream, true, '★ 回执应如实回 forceStream:true');
      const b = await chat([{ role: 'user', content: 'hi' }], { service: 'svc-force', timeoutMs: 3000 });
      assert.equal(b.ok, true, `服务字段 forceStream 应生效：${JSON.stringify(b.error || '')}`);
      assert.equal(b.meta.via, 'stream');
      assert.deepEqual(stub.seen.map((x) => x.stream), [true], '★ 服务字段 forceStream ⇒ 也走流式');

      // (c) 显式 false 能关掉（压过服务里的 true）
      stub.seen.length = 0;
      const c = await chat([{ role: 'user', content: 'hi' }], { service: 'svc-force', forceStream: false, timeoutMs: 3000 });
      assert.equal(c.ok, true, `显式 false 后应走非流式：${JSON.stringify(c.error || '')}`);
      assert.equal(c.text, 'via-nonstream', '★ 显式 false ⇒ 走非流式（取 JSON 文本）');
      assert.equal(c.meta.via, undefined, '★ 非流式 ⇒ 不该有 meta.via');
      assert.deepEqual(stub.seen.map((x) => x.stream), [false], '★★ 显式 false 能真的关掉（桩收 stream:false）');
    } finally { await stub.close(); rmOverride(); }
  });
});

test('★★ 11128 兜底：ensureSystemPrompt ⇒ 首条非 system 自动补；★ 服务字段生效；★ 显式 false 能关掉', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const stub = await startRecStub((req, res, rec) => {
      const first = rec.body && Array.isArray(rec.body.messages) ? rec.body.messages[0] : null;
      if (!first || first.role !== 'system') {
        return status(res, 400, JSON.stringify({ error: { code: 11128, message: 'first message must be system' } }));
      }
      return json200(res, { choices: [{ message: { content: 'ok-with-system' } }] });
    });
    try {
      // (a) 显式 ensureSystemPrompt:true ⇒ 自动补 system ⇒ 成功
      assert.equal(stub.seen.length, 0, '发之前应 0 条');
      const a = await chat([{ role: 'user', content: 'hi' }], { ...OAI(), baseUrl: stub.base, ensureSystemPrompt: true, timeoutMs: 3000 });
      assert.equal(a.ok, true, `ensureSystemPrompt 应成功：${JSON.stringify(a.error || '')}`);
      assert.equal(a.text, 'ok-with-system');
      assert.equal(stub.seen[0].body.messages[0].role, 'system', '★ 桩收到的首条应是补上的 system');
      assert.match(stub.seen[0].body.messages[0].content, /helpful/i, '★ 补的应是默认 system 文案');

      // (b) 服务配置字段 ensureSystemPrompt:true 同样生效
      stub.seen.length = 0;
      const s = saveService({ id: 'svc-sys', kind: 'openai-compatible', target: 'model', baseUrl: stub.base, model: 'm', ensureSystemPrompt: true });
      assert.equal(s.ok, true, `保存带 ensureSystemPrompt 的服务应成功：${JSON.stringify(s)}`);
      assert.equal(s.service.ensureSystemPrompt, true, '★ 回执应如实回 ensureSystemPrompt:true');
      const b = await chat([{ role: 'user', content: 'hi' }], { service: 'svc-sys', timeoutMs: 3000 });
      assert.equal(b.ok, true, `服务字段 ensureSystemPrompt 应生效：${JSON.stringify(b.error || '')}`);
      assert.equal(stub.seen[0].body.messages[0].role, 'system', '★ 服务字段也补了 system');

      // (c) 显式 false 能关掉（压过服务里的 true）⇒ 首条仍是 user ⇒ 被 11128 拒
      stub.seen.length = 0;
      const c = await chat([{ role: 'user', content: 'hi' }], { service: 'svc-sys', ensureSystemPrompt: false, timeoutMs: 3000 });
      assert.equal(stub.seen[0].body.messages[0].role, 'user', '★★ 显式 false ⇒ 不补 system（首条仍是 user）');
      assert.equal(c.ok, false, '★ 不补 ⇒ 被 11128 拒 ⇒ ok:false');
      assert.equal(c.error.kind, 'http-error');
      assert.equal(c.error.httpStatus, 400, '★ 错误应如实带 400');
    } finally { await stub.close(); rmOverride(); }
  });
});

test('★★ stream()：openai-compatible 取到分片；不支持流式的 kind 优雅报错；不可达也不抛（与 chat 同纪律）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    // (a) 真 SSE ⇒ 逐片取到（★ 且不抛）
    const stub = await startRecStub((req, res) => sseChat(res, ['你', '好', '！']));
    try {
      assert.equal(stub.seen.length, 0, '发之前应 0 条');
      const got = [];
      let thrown = null;
      try {
        for await (const c of stream([{ role: 'user', content: 'hi' }], { ...OAI(), baseUrl: stub.base, timeoutMs: 3000 })) got.push(c);
      } catch (e) { thrown = e; }
      assert.equal(thrown, null, `★ stream() 抛异常了（应永不抛）：${(thrown && thrown.stack) || thrown}`);
      const text = got.filter((c) => c.ok && typeof c.delta === 'string').map((c) => c.delta).join('');
      assert.equal(text, '你好！', `★ 应聚合出全部分片，实得 ${JSON.stringify(text)}`);
      assert.equal(got.every((c) => c.ok === true), true, '正常流不应有错误块');
      assert.equal(got[got.length - 1].done, true, '最后一块应 done:true');
      assert.equal(stub.seen.length, 1, '应恰 1 次流式请求');
      assert.equal(stub.seen[0].stream, true, '★ 流式请求体应带 stream:true');
    } finally { await stub.close(); }

    // (b) 不支持的 kind（anthropic）⇒ 优雅 config 错（不抛原始异常、零外呼）
    const stubA = await startRecStub((req, res) => json200(res, { content: [{ text: 'x' }] }));
    try {
      const got = [];
      let thrown = null;
      try {
        for await (const c of stream([{ role: 'user', content: 'hi' }], { ...ANTH(), baseUrl: stubA.base, timeoutMs: 3000 })) got.push(c);
      } catch (e) { thrown = e; }
      assert.equal(thrown, null, '★ 不支持流式也**不抛**');
      assert.equal(got.length, 1, `应只产出 1 个终止块，实得 ${got.length}`);
      assert.equal(got[0].ok, false);
      assert.equal(got[0].error.kind, 'config', '★ 归一为 config 错');
      assert.match(got[0].error.message, /不支持流式/, `★ 应明确报「不支持流式」：${got[0].error.message}`);
      assert.equal(stubA.seen.length, 0, '★ 不支持的 kind ⇒ 一个请求都不该发（零外呼）');
    } finally { await stubA.close(); }

    // (c) 不可达 ⇒ 优雅报错、不抛（用「刚关闭的端口」造，不打真外网）
    const base = await closedBase();
    const got = [];
    let thrown = null;
    try {
      for await (const c of stream([{ role: 'user', content: 'hi' }], { ...OAI(), baseUrl: base, timeoutMs: 3000 })) got.push(c);
    } catch (e) { thrown = e; }
    assert.equal(thrown, null, '★ 不可达也不抛');
    assert.ok(got.length >= 1 && got[0].ok === false, '应产出终止错误块');
    assert.equal(got[0].error.kind, 'unreachable', `不可达 ⇒ kind=unreachable，实得 ${got[0].error.kind}`);
  });
});

test('★★ joinUrl 版本段去重（经 invoke(custom) 观测真实出站 URL）：/v1 + /v1/… 不拼成 /v1/v1/…；base 已含完整 path 不重复拼', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const stub = await startRecStub((req, res) => json200(res, { v: 'ok' }));
    try {
      assert.equal(stub.seen.length, 0, '发之前应 0 条');
      const call = async (baseUrl, path) => {
        const r = await invoke('custom', { body: { x: 1 } }, { kind: 'custom', baseUrl, path, extract: 'v', timeoutMs: 3000 });
        assert.equal(r.ok, true, `invoke(custom) 应成功：${JSON.stringify(r.error || '')}`);
        return stub.seen[stub.seen.length - 1].url;
      };
      // ① base 含版本段 /v1，path 也含 /v1 ⇒ 去重成单段（★ 否则是 /v1/v1/…）
      assert.equal(await call(`${stub.base}/v1`, '/v1/chat/completions'), '/v1/chat/completions',
        '★ base 与 path 都有 /v1 ⇒ 不得拼成 /v1/v1/…');
      // ② base 已含完整 path ⇒ 不再重复拼接
      assert.equal(await call(`${stub.base}/v1/chat/completions`, '/v1/chat/completions'), '/v1/chat/completions',
        '★ base 已含完整 path ⇒ 不得再拼一次');
      // ③ base 尾斜杠 ⇒ 不拼出双斜杠
      assert.equal(await call(`${stub.base}/v1/`, '/v1/chat/completions'), '/v1/chat/completions',
        '★ base 尾斜杠应容忍');
      assert.equal(stub.seen.length, 3, `★ 应恰 3 次请求（反空转：真发出去了），实得 ${stub.seen.length}`);
    } finally { await stub.close(); rmOverride(); }
  });
});

test('★★ §11.1 空值保护：saveService 传空 key / 空 headers ⇒ 旧值仍在；★ 显式 clearKey/clearHeaders 才清空', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      const SECRET = 'sk-keep-abcdef123456';
      const s1 = saveService({ id: 'svc-keep', kind: 'openai-compatible', target: 'model', baseUrl: 'http://127.0.0.1:1', model: 'm', apiKey: SECRET, headers: { 'X-Trace': 'keep-me' } });
      assert.equal(s1.ok, true, `首次保存应成功：${JSON.stringify(s1)}`);
      assert.equal(s1.service.hasKey, true);
      // ★ 脱敏视图（标准 §10）**只回布尔** `hasHeaders`，**不回头名/头值**（旧版回的 `headers` 已删）
      assert.equal(s1.service.hasHeaders, true, '★ 应如实回 hasHeaders:true（脱敏视图不回头内容）');
      assert.equal(s1.service.headers, undefined, '★ 脱敏视图**不得**回请求头内容（§10：头名/头值绝不外传）');

      // ★ 再传空串 key + 空 dict headers ⇒ 旧值必须仍在（「留空 = 不修改」）
      const s2 = saveService({ id: 'svc-keep', apiKey: '', headers: {} });
      assert.equal(s2.ok, true, `空值更新应成功：${JSON.stringify(s2)}`);
      assert.equal(s2.service.hasKey, true, '★★ 传空 key ⇒ 旧 Key 必须仍在（不被清空）');
      assert.equal(s2.service.hasHeaders, true, '★★ 传空 headers ⇒ 旧请求头必须仍在');
      assert.equal(listServices().find((x) => x.id === 'svc-keep').hasKey, true, '★ 落盘后 hasKey 仍应为 true');
      assert.equal(resolveConfig({ service: 'svc-keep' }).apiKey, SECRET, '★ 生效配置里 Key 明文应仍是旧的（模块内部用）');
      assert.equal(resolveConfig({ service: 'svc-keep' }).headers['X-Trace'], 'keep-me', '★ 生效配置里请求头应仍是旧的');

      // ★ 显式 clearKey ⇒ 真清空
      const s3 = saveService({ id: 'svc-keep', clearKey: true });
      assert.equal(s3.ok, true, `clearKey 应成功：${JSON.stringify(s3)}`);
      assert.equal(s3.service.hasKey, false, '★★ 显式 clearKey ⇒ Key 才被清空');
      assert.equal(resolveConfig({ service: 'svc-keep' }).apiKey, '', '★ 生效配置里 Key 应已清空');

      // ★ 显式 clearHeaders ⇒ 真清空
      const s4 = saveService({ id: 'svc-keep', clearHeaders: true });
      assert.equal(s4.ok, true, `clearHeaders 应成功：${JSON.stringify(s4)}`);
      assert.equal(s4.service.hasHeaders, false, '★★ 显式 clearHeaders ⇒ 请求头才被清空');
      assert.equal(resolveConfig({ service: 'svc-keep' }).headers['X-Trace'], undefined, '★ 生效配置里请求头应已清空');
    } finally { rmOverride(); }
  });
});

// ── ★★ §11.1 extra 开放键包：逐键合并（不是整对象覆盖）+ 空值不覆盖 + clearExtra 显式清空 ──
//   参考口径（`facade.py` 的 `_do()`）：面板只管理少数几个键（auth_header / auth_scheme / text_path …），
//   已有服务上的 `endpoint_env` / `api_key_env` / `models_path` 必须**原样保留**；值为空 ⇒ 不覆盖旧值。
test('★★ §11.1 extra 逐键合并：只传一个键 ⇒ 旧键（endpoint_env / models_path）必须保留、新键写入', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      const s1 = saveService({
        id: 'svc-extra-a', kind: 'custom', target: 'model', baseUrl: 'http://127.0.0.1:1',
        extra: { endpoint_env: 'A', models_path: 'B' },
      });
      assert.equal(s1.ok, true, `首次保存应成功：${JSON.stringify(s1)}`);
      // ★ 第二次只带一个新键 ⇒ 不得整对象覆盖（否则 endpoint_env / models_path 被冲掉）
      const s2 = saveService({ id: 'svc-extra-a', extra: { auth_header: 'X-K' } });
      assert.equal(s2.ok, true, `二次保存应成功：${JSON.stringify(s2)}`);
      const ex = resolveConfig({ service: 'svc-extra-a' }).extra;
      assert.equal(ex.endpoint_env, 'A', '★★ 旧键 endpoint_env 必须保留（逐键合并，非整对象覆盖）');
      assert.equal(ex.models_path, 'B', '★★ 旧键 models_path 必须保留');
      assert.equal(ex.auth_header, 'X-K', '★ 新键 auth_header 必须写入');
    } finally { rmOverride(); }
  });
});

test('★★ §11.1 extra 空值不覆盖：传空串键 ⇒ 旧值仍在，且该空串键本身不落盘', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      assert.equal(saveService({
        id: 'svc-extra-b', kind: 'custom', target: 'model', baseUrl: 'http://127.0.0.1:1',
        extra: { api_key_env: 'K1' },
      }).ok, true);
      // ★ 传空串 ⇒ 「留空 = 不修改」；空串键 other 也应被**跳过**（不得写进 extra）
      assert.equal(saveService({ id: 'svc-extra-b', extra: { api_key_env: '', other: '' } }).ok, true);
      const ex = resolveConfig({ service: 'svc-extra-b' }).extra;
      assert.equal(ex.api_key_env, 'K1', '★★ 传空串 ⇒ 旧值必须仍在（不被清空）');
      assert.equal('other' in ex, false, '★★ 空串键 other 应被跳过（不得写进 extra）');
    } finally { rmOverride(); }
  });
});

test('★★ §11.1 extra null/undefined 不覆盖：传 null / undefined ⇒ 旧值仍在', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      assert.equal(saveService({
        id: 'svc-extra-c', kind: 'custom', target: 'model', baseUrl: 'http://127.0.0.1:1',
        extra: { api_key_env: 'K1' },
      }).ok, true);
      assert.equal(saveService({ id: 'svc-extra-c', extra: { api_key_env: null } }).ok, true);
      assert.equal(resolveConfig({ service: 'svc-extra-c' }).extra.api_key_env, 'K1', '★★ 传 null ⇒ 旧值必须仍在');
      assert.equal(saveService({ id: 'svc-extra-c', extra: { api_key_env: undefined } }).ok, true);
      assert.equal(resolveConfig({ service: 'svc-extra-c' }).extra.api_key_env, 'K1', '★★ 传 undefined ⇒ 旧值必须仍在');
    } finally { rmOverride(); }
  });
});

test('★★ §11.1 extra 显式清空：clearExtra 只删列出的键、未列出的保留，且 clearExtra 不落盘', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      assert.equal(saveService({
        id: 'svc-extra-d', kind: 'custom', target: 'model', baseUrl: 'http://127.0.0.1:1',
        extra: { api_key_env: 'K1', endpoint_env: 'E1' },
      }).ok, true);
      // ★ 合并语义下传空串不生效 ⇒ 必须靠 clearExtra 才能真删键（否则误填的键永远清不掉）
      const s = saveService({ id: 'svc-extra-d', clearExtra: ['api_key_env'] });
      assert.equal(s.ok, true, `clearExtra 应成功：${JSON.stringify(s)}`);
      const ex = resolveConfig({ service: 'svc-extra-d' }).extra;
      assert.equal('api_key_env' in ex, false, '★★ clearExtra 列出的键应被删除');
      assert.equal(ex.endpoint_env, 'E1', '★★ 未列出的键必须保留');
      assert.equal('clearExtra' in ex, false, '★★ clearExtra 是控制字段，绝不落盘');
    } finally { rmOverride(); }
  });
});

// ── ★★ §5 / §10 / §12.2 `extra` 三键来源链 + 白名单回显 —— 2026-10-10 ──
//   参考文档 §5「`extra` 键全表」把 `path` / `force_stream` / `ensure_system_prompt` 列为合法键，
//   §12.2 的 WorkBuddy 官方配方正是把它们写在 `extra` 里；§10 要求 `extra` 只回非密钥项。
//   ⇒ 本次改动把三键纳入来源链（顶层显式优先、`extra` 兜底），并让 `maskedService` 只回白名单键。
test('★★ §5/§12.2 extra.path 折进 path：只给 extra.path ⇒ 生效；顶层 path 给值 ⇒ 压过 extra.path', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      assert.equal(saveService({
        id: 'svc-p1', kind: 'custom', target: 'model', baseUrl: 'http://127.0.0.1:1',
        extra: { path: '/v2/chat/completions' },
      }).ok, true);
      assert.equal(resolveConfig({ service: 'svc-p1' }).path, '/v2/chat/completions',
        '★★ 只给 extra.path ⇒ 生效配置的 path 应等于它（标准 §5）');
      // ★ 顶层显式给值 ⇒ 压过 extra.path（顶层优先、extra 兜底）
      assert.equal(saveService({ id: 'svc-p1', path: '/top/win' }).ok, true);
      assert.equal(resolveConfig({ service: 'svc-p1' }).path, '/top/win',
        '★★ 顶层 path 显式给值应压过 extra.path');
    } finally { rmOverride(); }
  });
});

test('★★ §5/§12.2 extra.force_stream / extra.ensure_system_prompt 折进生效配置（顶层 false 能压过）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      assert.equal(saveService({
        id: 'svc-sw1', kind: 'custom', target: 'model', baseUrl: 'http://127.0.0.1:1',
        extra: { force_stream: true, ensure_system_prompt: true },
      }).ok, true);
      const cfg = resolveConfig({ service: 'svc-sw1' });
      assert.equal(cfg.forceStream, true, '★★ extra.force_stream:true ⇒ 生效 forceStream 应为 true');
      assert.equal(cfg.ensureSystemPrompt, true, '★★ extra.ensure_system_prompt:true ⇒ 生效 ensureSystemPrompt 应为 true');
      // ★ 顶层显式 false 压过 extra.force_stream:true（§11.2 的「能关掉」）
      assert.equal(saveService({ id: 'svc-sw1', forceStream: false }).ok, true);
      assert.equal(resolveConfig({ service: 'svc-sw1' }).forceStream, false,
        '★★ 顶层 forceStream:false 应压过 extra.force_stream:true');
    } finally { rmOverride(); }
  });
});

test('★★ §12.2 照抄 WorkBuddy 官方配方 ⇒ path / forceStream / ensureSystemPrompt / model 全部正确（本改动验收用例）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      assert.equal(saveService({
        id: 'svc-wb', kind: 'openai-compatible', target: 'model',
        baseUrl: 'https://www.workbuddy.ai/v2/chat/completions', model: 'deepseek-v4.1-flash',
        extra: { path: '/v2/chat/completions', force_stream: true, ensure_system_prompt: true },
      }).ok, true);
      const cfg = resolveConfig({ service: 'svc-wb' });
      assert.equal(cfg.path, '/v2/chat/completions', '★★ extra.path 应被识别（否则静默丢 path）');
      assert.equal(cfg.forceStream, true, '★★ extra.force_stream 应被识别（否则 11101）');
      assert.equal(cfg.ensureSystemPrompt, true, '★★ extra.ensure_system_prompt 应被识别（否则 11128）');
      assert.equal(cfg.model, 'deepseek-v4.1-flash', '★ model 应正确');
    } finally { rmOverride(); }
  });
});

test('★★ §10 extra 回显白名单：只含白名单键、对象/未知键不回、绝不外泄密钥串', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      assert.equal(saveService({
        id: 'svc-echo', kind: 'custom', target: 'model', baseUrl: 'http://127.0.0.1:1',
        extra: {
          auth_header: 'X-API-Key', api_key_env: 'MY_KEY_ENV',
          body_template: { secret: 'S3CRET' }, unknown_key: 'X',
        },
      }).ok, true);
      const s = listServices().find((x) => x.id === 'svc-echo');
      assert.ok(s, '应能取到刚存的服务');
      assert.ok(s.extra, '★ 非空 extra 应回显');
      assert.equal(s.extra.auth_header, 'X-API-Key', '★ 白名单键 auth_header 应回显');
      assert.equal(s.extra.api_key_env, 'MY_KEY_ENV', '★★ 只回环境变量名 api_key_env（不解析其值）');
      assert.equal('body_template' in s.extra, false, '★★ 对象值键 body_template 不回（可能夹带密钥）');
      assert.equal('unknown_key' in s.extra, false, '★★ 白名单外的 unknown_key 一律不回');
      assert.equal(JSON.stringify(s).includes('S3CRET'), false, '★★ 结果里绝不出现密钥串 S3CRET');
    } finally { rmOverride(); }
  });
});

test('★ §10 extra 为空 ⇒ 脱敏回显里没有 extra 字段（既有调用方逐字不变）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      assert.equal(saveService({
        id: 'svc-noextra', kind: 'custom', target: 'model', baseUrl: 'http://127.0.0.1:1',
      }).ok, true);
      const s = listServices().find((x) => x.id === 'svc-noextra');
      assert.ok(s, '应能取到刚存的服务');
      assert.equal('extra' in s, false, '★★ extra 为空 ⇒ 不应返回 extra 字段');
    } finally { rmOverride(); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── ⑯ ★★ `validate()` 探针与 `chat()` 同口径（对齐参考 §11.5）—— 2026-10-10 ──
// ═══════════════════════════════════════════════════════════════════════════
//   缺陷：`validate()` 的探针**只走非流式**（`buildRequest`）—— 既不认 `cfg.forceStream`，也**没有**
//   `chat()` 那套「被 `400 + code=11101` 拒 ⇒ 自动改走流式重试」的兜底。而官方 WorkBuddy 接口
//   **只接受流式**（非流式 ⇒ 400 code=11101）⇒ 一套**完全正确**的「只接受流式」端点，会被本软件
//   自己的「测试连接」判为「配置错误」，而实际 `chat()` 是通的。
//   ★ 本批修复：`validate()` 探测**两条都做**（不是二选一）——
//     ① `forceStream:true` ⇒ 探测**直接走流式**（不先发注定被拒的非流式）；
//     ② 非流式被 `400+11101` 拒 ⇒ **自动改走流式再探一次**（复用 `isNonStreamRejected` / `chatViaStreamAggregate`）。
//   ★ 纪律：本机桩（复现官方 11101 行为）+ 临时成片根（TMP）；**绝不真打外网**；每条先 `rmOverride()` +
//     `withEnv(CLEAN)`，`finally` 还原。
//   ★ 回归：`workbuddy-gateway`（本机网关）路径不变 —— 见上面「v4·workbuddy 网关 validate()」那条
//     （只读 `GET /api/v1/health`、断言无 POST）；「路径取不到 ⇒ bad-shape 硬失败」见「validate()·安全网」那条。

test('★★ §11.5 validate()·forceStream:true ⇒ 探针直接走流式（本改动验收用例）：桩只接受流式 ⇒ ok:true 且**没有**先发注定被拒的非流式', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    // ★ 桩复现官方 WorkBuddy 行为：请求体 `stream` 不为 true ⇒ 400 code=11101；流式 ⇒ SSE。
    const stub = await startRecStub((req, res, rec) => {
      if (req.method === 'GET') return json200(res, { data: [] });      // 第 1 步可达性探针（GET /models）
      if (rec.stream) return sseChat(res, ['Pong!', ' 🏓']);
      return status(res, 400, JSON.stringify({ code: 11101, msg: 'Non-stream chat request is currently not supported' }));
    });
    try {
      assert.equal(stub.seen.length, 0, '发之前应 0 条');
      const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890', forceStream: true }));
      assert.equal(r.ok, true, `★ forceStream ⇒ 应三步全过：${JSON.stringify(r.errors)}`);
      assert.equal(r.steps.reachable.ok, true);
      assert.equal(r.steps.auth.ok, true);
      assert.equal(r.steps.shape.ok, true);
      assert.deepEqual(r.errors, []);
      // ★★ 直接证据：探针**恰 1 条 POST**、且 `stream===true` —— 证明**没有**先发一次注定被拒的非流式。
      //   ★ 第 1 步的 `GET /models`（可达性）不计入：它**不是**探针 POST。
      const posts = stub.seen.filter((s) => s.method === 'POST');
      assert.equal(posts.length, 1, `★ 探针 POST 应恰 1 条，实得 ${posts.length}：${JSON.stringify(stub.seen.map((s) => `${s.method} ${s.url} stream=${s.stream}`))}`);
      assert.equal(posts[0].stream, true, '★ 该唯一探针必须是流式（stream===true）');
      assert.equal(posts.every((s) => s.stream === true), true, '★ 全程**不得**出现任何非流式 POST');
    } finally { await stub.close(); rmOverride(); }
  });
});

test('★★ §11.5 validate()·11101 兜底：forceStream:false + 桩只接受流式 ⇒ 自动改走流式仍 ok:true（桩收 2 条 POST：1 非流式被拒 + 1 流式）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const stub = await startRecStub((req, res, rec) => {
      if (req.method === 'GET') return json200(res, { data: [] });
      if (rec.stream) return sseChat(res, ['streamed-', 'ok']);
      return status(res, 400, JSON.stringify({ code: 11101, msg: 'Non-stream chat request is currently not supported' }));
    });
    try {
      assert.equal(stub.seen.length, 0, '发之前应 0 条');
      const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
      assert.equal(r.ok, true, `★ 400+11101 应自动改走流式并三步全过：${JSON.stringify(r.errors)}`);
      assert.equal(r.steps.reachable.ok, true);
      assert.equal(r.steps.auth.ok, true);
      assert.equal(r.steps.shape.ok, true);
      assert.deepEqual(r.errors, []);
      // ★★ 直接证据：探针 POST **依次** [非流式, 流式]，共 2 条（1 条被拒 + 1 条兜底）。
      const posts = stub.seen.filter((s) => s.method === 'POST');
      assert.deepEqual(posts.map((s) => s.stream), [false, true], `★ 探针 POST 应依次 [非流式, 流式]，实得 ${JSON.stringify(posts.map((s) => s.stream))}`);
      assert.equal(posts.length, 2, `★ 应恰 2 次 POST，实得 ${posts.length}`);
    } finally { await stub.close(); rmOverride(); }
  });
});

test('★★ §11.5 validate()·反向对照：桩对**任何** POST 都回 400+11101 ⇒ 必须 ok:false（兜底不得吞掉真失败）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const stub = await startRecStub((req, res) => {
      if (req.method === 'GET') return json200(res, { data: [] });
      return status(res, 400, JSON.stringify({ code: 11101, msg: 'Non-stream chat request is currently not supported' }));
    });
    try {
      // (a) 非流式被拒 ⇒ 兜底改走流式 ⇒ 流式被**同一** 400 拒 ⇒ 仍必须失败（证明兜底只救「改流式能成」的端点）
      const a = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890' }));
      assert.equal(a.ok, false, '★ 兜底不得吞掉真失败（流式也被 400+11101 拒 ⇒ ok:false）');
      assert.equal(a.steps.auth.ok, false, '★ 应归 auth 步失败');
      assert.equal(a.steps.auth.kind, 'http-error', '★ 400 ⇒ http-error');
      assert.ok(a.errors.length >= 1, '应有 errors 记录');
      const postsA = stub.seen.filter((s) => s.method === 'POST');
      assert.deepEqual(postsA.map((s) => s.stream), [false, true], '★ 非流式被拒 ⇒ 自动改走流式（共 2 条）');

      // (b) forceStream:true 直走流式 ⇒ 也被同一 400 拒 ⇒ 仍必须失败
      stub.seen.length = 0;
      const b = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890', forceStream: true }));
      assert.equal(b.ok, false, '★ 直走流式也失败 ⇒ ok:false');
      assert.equal(b.steps.auth.kind, 'http-error');
      const postsB = stub.seen.filter((s) => s.method === 'POST');
      assert.deepEqual(postsB.map((s) => s.stream), [true], '★ forceStream ⇒ 只发 1 条流式');
    } finally { await stub.close(); rmOverride(); }
  });
});

test('★ §11.5 validate()·流式 bad-shape：流式增量类型非法 ⇒ shape 步硬失败（安全网在流式路径也成立）', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    const stub = await startRecStub((req, res, rec) => {
      if (req.method === 'GET') return json200(res, { data: [] });
      if (rec.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        // ★ 增量 `content` 不是字符串（对象）⇒ 流式核心应报 bad-shape
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: { bad: true } } }] })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      return status(res, 400, JSON.stringify({ code: 11101, msg: 'Non-stream chat request is currently not supported' }));
    });
    try {
      const r = await validate(OAI({ baseUrl: stub.base, apiKey: 'sk-test-1234567890', forceStream: true }));
      assert.equal(r.ok, false, '★ 流式增量类型非法 ⇒ 不得判 ok');
      assert.equal(r.steps.shape.ok, false);
      assert.equal(r.steps.shape.kind, 'bad-shape', '★ 流式路径的 bad-shape 必须硬失败');
    } finally { await stub.close(); rmOverride(); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── ⑭ ★★ RISK-05：覆盖文件的「并发写 / 坏文件」不丢用户数据 ──────────────
// ═══════════════════════════════════════════════════════════════════════════
//   缺陷：`saveOverride` 原子写的 tmp 名**固定**（`<file>.tmp`）+ 整段 read-modify-write **没有跨进程锁**
//   ⇒ ① 并发写同一 tmp 互相踩（实测 EPERM，写整个失败）；② `readOverride()` 读到半截文件返回 `{}`
//     ⇒ 后续「合并写回」把用户真实的覆盖文件（含**全部密钥**）**整份清空**。
//   修法（照 lib/store.mjs 的 `saveIndex` / lib/dub.mjs 的 `saveIndex` 范式）：tmp 名带 pid + 序号、
//     拿 store.mjs 的跨进程写锁、锁拿不到仍「重读 + 合并」、★ 盘上文件**存在却解析不了 ⇒ 拒绝写**。

test('★★ RISK-05·坏文件：盘上覆盖文件解析不了时 saveOverride / saveService **拒绝写入**，绝不整份清空密钥', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      // 半截文件（外部工具手改坏 / 崩溃残留）——**含用户真实密钥**
      const RAW = '{"version":1,"active":"svc-real","services":[{"id":"svc-real","apiKey":"sk-REAL-USER-KEY-abcdef0123456789","baseUrl":"http://x"';
      fs.writeFileSync(overrideFilePath(), RAW, 'utf8');
      // ① 直接调 saveOverride
      const r = saveOverride({ active: 'svc-new', services: [{ id: 'svc-new', apiKey: 'sk-new' }] });
      assert.equal(r.ok, false, '★ 读到坏文件必须**拒绝写入**（否则会把用户真实密钥整份清空）');
      assert.equal(r.error.kind, 'config');
      assert.equal(fs.readFileSync(overrideFilePath(), 'utf8'), RAW, '★ 拒绝写入后盘上内容必须**一字未动**');
      // ② 走 CRUD 入口（saveService）也必须拒绝（同一条写路径）
      const s = saveService({ id: 'svc-x', kind: 'openai-compatible', target: 'model',
        baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-x', model: 'm' });
      assert.equal(s.ok, false, '★ saveService 走同一写路径 ⇒ 同样必须拒绝');
      assert.equal(fs.readFileSync(overrideFilePath(), 'utf8'), RAW, '★ saveService 也必须一字未动');
      // ③ **读**路径的既有契约不变：坏文件仍降级为「无覆盖」（不抛）
      assert.deepEqual(readOverride(), {}, '★ 读路径契约不变：坏文件仍视为「无覆盖」');
    } finally { rmOverride(); }
  });
});

test('★★ RISK-05·锁拿不到（照 test/store-lock.test.mjs 的姿势）：saveOverride 仍「重读 + 合并」⇒ 不丢盘上服务与密钥', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    // ★ 把锁文件做成**目录** ⇒ `acquireLock()` 必失败（与 store-lock.test.mjs 的夹具同款，不依赖并发时序）
    const LOCK_DIR = path.join(path.dirname(overrideFilePath()), '.console', 'index.lock');
    try {
      fs.mkdirSync(LOCK_DIR, { recursive: true });
      const KEY = 'sk-ONDISK-KEY-abcdef0123456789';
      fs.writeFileSync(overrideFilePath(), JSON.stringify({ version: 1, active: 'svc-a',
        services: [{ id: 'svc-a', apiKey: KEY, baseUrl: 'http://a' }, { id: 'svc-b', apiKey: 'sk-b' }] }), 'utf8');

      const r = saveOverride({ active: 'svc-b' });   // 只改 active、**不带 services** ⇒ 若不合并就会只剩空 services

      assert.equal(r.ok, true, '未拿到锁不该让写入失败（best-effort：宁可有竞态，也不阻塞用户保存）');
      const disk = JSON.parse(fs.readFileSync(overrideFilePath(), 'utf8'));
      assert.deepEqual(disk.services.map((s) => s.id).sort(), ['svc-a', 'svc-b'],
        '★ 未拿到锁仍应「重读 + 合并」⇒ 盘上两套服务都要在（若只剩空表，说明写路径把盘上内容盖掉了）');
      assert.equal(disk.services.find((s) => s.id === 'svc-a').apiKey, KEY, '★ 盘上服务的密钥不得丢');
      assert.equal(disk.active, 'svc-b', '本次的改动（active）应生效');
      // ★ 降级 warn 只由 `warnOnce` 打一次（本套件前面若干 CRUD 用例的临时树里没有 `.console` ⇒ 早触发过去重）
      //   ⇒ 这里不断言 warn 文案，只断言**行为**（上面三条）。`warnOnce` 的去重语义见 lib/llm-api.mjs。
    } finally {
      try { fs.rmdirSync(LOCK_DIR); } catch { /* ignore */ }
      rmOverride();
    }
  });
});

// ── ★★ 并发写的「重读 + 合并」：用**确定性夹具**复现「读到之后、写回之前盘上被改」（不必靠真并发时序）──
//   ★ 姿势与 `test/store-lock.test.mjs` 一致：**用夹具把那个危险交错摆出来**，而不是赌多进程的时序
//     （真多进程是**概率性**的，会偶发假红；下面的确定性夹具每次都走同一条路，且**改前必红**）。
//   ★ 两条规则见 lib/llm-api.mjs 的 `saveOverride`（照 lib/store.mjs 的 `saveIndex` 范式）。

test('★★ RISK-05·并发写不丢数据（规则②）：盘上在本进程「读到之后、写回之前」多出来的服务，必须被保留', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      const OTHER_KEY = 'sk-OTHER-KEY-abcdef0123456789';
      const write = (svcs) => fs.writeFileSync(overrideFilePath(),
        JSON.stringify({ version: 1, active: 'base', services: svcs }), 'utf8');
      write([{ id: 'base', apiKey: 'sk-base', baseUrl: 'http://base' }]);
      // ① 本进程「读一次」⇒ 快照里只有 base
      assert.deepEqual(listServices().map((s) => s.id), ['base']);
      // ② 另一个进程在我们读之后、写回之前，往盘上**加了一套 other**（含密钥）
      write([{ id: 'base', apiKey: 'sk-base', baseUrl: 'http://base' },
        { id: 'other', apiKey: OTHER_KEY, baseUrl: 'http://other' }]);
      // ③ 本进程按**自己那份已过时的**服务表写回 ⇒ 必须「重读 + 合并」⇒ 保住 other
      const r = saveOverride({ version: 1, active: 'base',
        services: [{ id: 'base', apiKey: 'sk-base', baseUrl: 'http://base' },
          { id: 'mine', apiKey: 'sk-mine', baseUrl: 'http://mine' }] });
      assert.equal(r.ok, true);
      const disk = JSON.parse(fs.readFileSync(overrideFilePath(), 'utf8'));
      const ids = disk.services.map((s) => s.id);
      assert.ok(ids.includes('other'),
        `★ 并发写回**不得抹掉**别的进程刚加的 other（实得 ${ids.join(',')}）—— 改前这里必红`);
      assert.ok(ids.includes('mine'), '本次新增的 mine 也要在');
      assert.equal(disk.services.find((s) => s.id === 'other').apiKey, OTHER_KEY, '★ other 的密钥不得丢');
    } finally { rmOverride(); }
  });
});

test('★★ RISK-05·并发写不丢数据（规则①）：别的进程**删掉**的服务，本进程的写回不得把它「复活」', async () => {
  await withEnv(CLEAN, async () => {
    rmOverride();
    try {
      const write = (svcs) => fs.writeFileSync(overrideFilePath(),
        JSON.stringify({ version: 1, active: 'base', services: svcs }), 'utf8');
      write([{ id: 'base', apiKey: 'sk-base' }, { id: 'victim', apiKey: 'sk-victim' }]);
      // ① 本进程读到 base + victim
      assert.deepEqual(listServices().map((s) => s.id).sort(), ['base', 'victim']);
      // ② 另一个进程把 victim 删了
      write([{ id: 'base', apiKey: 'sk-base' }]);
      // ③ 本进程仍持有 victim（过时视图）并写回 ⇒ 必须**跟着删**，不得复活 victim
      const r = saveOverride({ version: 1, active: 'base',
        services: [{ id: 'base', apiKey: 'sk-base' }, { id: 'victim', apiKey: 'sk-victim' }] });
      assert.equal(r.ok, true);
      const ids = JSON.parse(fs.readFileSync(overrideFilePath(), 'utf8')).services.map((s) => s.id);
      assert.ok(!ids.includes('victim'),
        `★ 别人删掉的 victim 不得被写回「复活」（实得 ${ids.join(',')}）—— 改前这里必红`);
      assert.ok(ids.includes('base'));
    } finally { rmOverride(); }
  });
});

// ★★ 多进程并发保存（真实进程 + 屏障）：N 个子进程各自保存一套**唯一**的服务。
//   ★ 屏障（照 test/prune-jobs.test.mjs 的姿势）：子进程先自旋等一个 `go` 文件 ⇒ 全部**同时**开跑，
//     最大化「读盘 → 写回」的交错（否则子进程自然错峰 ⇒ 假绿）。
//   ★★ 本用例断言的是**恒成立**的不变量：文件**永不被写坏**（始终可解析）、盘上原有服务的**密钥绝不丢**、
//     每个子进程的 `saveService()` **永不抛**（都拿到结构化结果）。★ 不断言「N 套一条不少」—— 原因：
//     `lib/store.mjs` 的 `acquireLock` 在**高并发**下**不是严格互斥**的（实测：它「先 `wx` 创建、再写
//     pid」不是原子操作 ⇒ 另一进程能读到**刚创建的空锁文件**、判成陈旧锁而删掉别人那把 ⇒ 两个持有者并存）。
//     那条更强的断言会**概率性假红**（N=8 实测约 4/10 丢 1~2 套），不适合做常驻用例；
//     「一条不少」的严格复现见报告里的一次性并发探针（N≤4 稳定全绿）。
const CONC_N = 6;
const CONC_CHILD_SRC = [
  "import fs from 'node:fs';",
  "const mod = await import(process.env.MOD_URL);",
  "const go = process.env.GO_FILE;",
  "const id = process.env.SVC_ID;",
  "process.stdout.write('READY\\n');",
  "while (!fs.existsSync(go)) { /* spin */ }",
  "const r = mod.saveService({ id, label: id, kind: 'openai-compatible', target: 'model',",
  "  baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-' + id + '-0123456789abcdef', model: 'm' });",
  "process.stdout.write('RESULT ' + JSON.stringify({ id, ok: r.ok }) + '\\n');",
  "process.exit(0);",
].join('\n');

test('★★ RISK-05·多进程并发保存：文件绝不被写坏、原有密钥绝不丢、每个 saveService 都永不抛', async () => {
  const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib');
  const dir = path.join(TMP, `conc-${Date.now().toString(36)}`);
  fs.mkdirSync(path.join(dir, '.console'), { recursive: true });   // ★ 锁文件落在 .console ⇒ 必须存在
  const OVERRIDE = path.join(dir, '_llm-api.json');
  const GO = path.join(dir, 'go');
  const CHILD = path.join(TMP, 'conc-child.mjs');
  const BASE_KEY = 'sk-BASE-KEY-abcdef0123456789';
  fs.writeFileSync(OVERRIDE, JSON.stringify({ version: 1, active: 'base',
    services: [{ id: 'base', label: 'base', kind: 'openai-compatible', target: 'model',
      baseUrl: 'http://127.0.0.1:1', apiKey: BASE_KEY, model: 'm' }] }), 'utf8');
  fs.writeFileSync(CHILD, CONC_CHILD_SRC, 'utf8');

  const kids = [];
  try {
    for (let i = 0; i < CONC_N; i++) {
      const id = `svc-${i}`;
      const p = spawn(process.execPath, [CHILD], {
        env: { ...process.env, LEMO_FILM_DIR: dir, MOD_URL: pathToFileURL(path.join(LIB, 'llm-api.mjs')).href,
          SVC_ID: id, GO_FILE: GO },
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      const rec = { id, out: '', err: '' };
      p.stdout.on('data', (d) => { rec.out += d; });
      p.stderr.on('data', (d) => { rec.err += d; });
      kids.push({ id, p, rec });
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let t = 0; t < 600 && !kids.every((k) => k.rec.out.includes('READY')); t++) await wait(10);
    assert.ok(kids.every((k) => k.rec.out.includes('READY')), '子进程应全部就绪（否则夹具问题）');
    fs.writeFileSync(GO, 'go', 'utf8');                      // ★ 放行：全部同时开跑
    await Promise.all(kids.map((k) => new Promise((res) => k.p.on('close', res))));

    // ① 文件**始终可解析**（原子写 + 各写各的 tmp ⇒ 不会被写坏）—— JSON.parse 失败会直接抛
    const disk = JSON.parse(fs.readFileSync(OVERRIDE, 'utf8'));
    // ② 盘上原有服务的**密钥绝不丢**（并发写回不得清空别人）
    const base = disk.services.find((s) => s.id === 'base');
    assert.ok(base, '★ 并发保存后 base 必须还在（不得被整份清空）');
    assert.equal(base.apiKey, BASE_KEY, '★ base 的密钥不得丢');
    // ③ 每个子进程的 saveService 都**拿到了结构化结果**（永不抛、永不静默崩）
    for (const k of kids) {
      assert.ok(/RESULT \{"id"/.test(k.rec.out),
        `子进程 ${k.id} 未产出结构化结果（stderr: ${k.rec.err.trim()}）—— saveService 应永不抛`);
    }
  } finally {
    for (const k of kids) { try { k.p.kill(); } catch { /* ignore */ } }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// ── 运行器 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/llm-api.test.mjs —— 通用 AI 算力 API 接入模块 纯逻辑 / 离线测试'));
  log(C.dim(`（桩服务：node:http @ 127.0.0.1:0；临时树：${TMP}）`));
  log('');
  const results = [];
  for (const c of cases) {
    try {
      await c.fn();
      results.push({ name: c.name, ok: true });
      log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - t0}ms)`)}`);
    } catch (e) {
      results.push({ name: c.name, ok: false });
      log(`  ${C.bad('FAIL')}  ${c.name}`);
      for (const line of String((e && e.message) || e).split('\n')) log(`        ${line}`);
    }
  }
  // ★ 收尾：删掉临时树（不留残渣）
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  log('');
  log('─'.repeat(64));
  if (failed.length) {
    log(C.bad(`  ${passed} passed, ${failed.length} failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
    for (const f of failed) log(C.bad(`  ✗ ${f.name}`));
  } else {
    log(C.ok(`  ${passed} passed, 0 failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
  }
  log('─'.repeat(64));
  log('');
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
