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
 * ★ 纪律：
 *   · **零依赖、可离线**：桩服务一律用 `node:http` 监听 `127.0.0.1:0`（随机端口），**用完关闭**；
 *     ★ **不打真实外网**（连通性失败用「刚关闭的端口」造，而不是去连一个真域名）。
 *   · **不碰真实盘**：覆盖配置文件路径从 `CFG.exportDir` 派生 ⇒ 本测试在 import 之前把
 *     `LEMO_FILM_DIR` 指到 `D:/lemo-tmp/...` 临时目录（非 C 盘），跑完删除。
 *   · ★ **密钥绝不外泄**：用假 key 断言 `listProfiles()` / `validate()` 的**任何输出**都不含它。
 *
 * 覆盖：
 *   ① resolveConfig 优先级（★ 2026-10-08 修正后：显式 > env > **覆盖文件（面板）** > **运行时线索** > 内置默认；原序「运行时线索 > 覆盖文件」已按规格更正）+ 超时钳制 + 头合并；
 *   ② ★★ 容错 8 类（每类独立夹具）：unreachable / timeout / auth(401,403) / rate-limit(429) /
 *      http-error(500) / bad-json / bad-shape / empty-output；
 *   ③ chat() 成功路径（OpenAI 格式）、anthropic 路径、custom（自定义 path + extract）；
 *   ④ validate() 三步（reachable / auth / shape）各自失败一条 + 全通过一条；
 *   ⑤ ★ 密钥不外泄（假 key 不出现在 listProfiles()/validate() 输出里，且响应体回显也被脱敏）；
 *   ⑥ listModels() 成功 / 失败；覆盖文件读写（§八）。
 *   ⑦ ★ 多模态（2026-10-08 追加）：OpenAI 兼容 / Anthropic 两种图片块、`opts.images` 便利入参
 *      （本地文件 / base64 / dataURL）、体积守卫（单图 + 总请求体）、图片内容不外泄、
 *      以及 ★★ **纯文本请求体逐字节回归**（证明向后兼容）。
 *   ⑧ ★ 国产厂商内置预设（2026-10-08 追加）：豆包/火山方舟、通义/百炼、腾讯混元、DeepSeek、
 *      智谱 GLM、月之暗面 Kimi、硅基流动 —— 每家断言 `listProfiles()` 含它、`previewProfile()`
 *      出**脱敏**配置、`resolveConfig` 解析出 endpoint 与模型；并断言**默认 profile 仍是 `workbuddy`**。
 *      ★ 全部离线（不打外网）：只解析内置表，不发任何网络请求。
 *   ⑨ ★★ 接入对象类型 `target`（2026-10-08 追加）：`'model'`（默认，模型 API）| `'agent'`（智能体 API）。
 *      · agent ⇒ 请求体**不下发 model**（★ 2026-10-09 起**三种 kind 一律如此**，见 ⑫）；model（默认）⇒ **照旧带**（逐字节金标回归）；
 *      · agent ⇒ **缺 model 不报错**、`validate()` **不校验模型标识**；
 *      · `PROFILES.target` 判定：`workbuddy` = agent，其余 11 个 = model（按**端点性质**）；
 *      · `target` 覆盖优先级：显式 > 覆盖文件（面板） > 内置默认。
 *      ★ 全部离线（桩服务），不打真实外网。
 *   ⑫ ★★ 2026-10-09 追加（委托方澄清，见契约 §十五）：**取消「agent + anthropic 仍带 model」例外** ——
 *      `agent` 模式**绝不下发 model**（**不看 kind**，anthropic/openai-compatible/custom 三种都验）；
 *      ★ agent 模式探针**不带 model 探活**，端点若回 400/422「要求 model」⇒ 归一为明确的 `config` + 中文 hint
 *      （说明该端点更像「底层基础算力 API」），**绝不**把 model 自动加回去。
 *      ★ 全部离线（桩服务），不打真实外网。
 *
 * 用法：node test/llm-api.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// ── ★ 先把成片根指到临时目录（**必须在 import 模块之前**：CFG.exportDir 在 env.mjs 加载时定值）
const TMP = `D:/lemo-tmp/llm-api-test-${process.pid}-${Date.now().toString(36)}`;
fs.mkdirSync(TMP, { recursive: true });
process.env.LEMO_FILM_DIR = TMP;

// ★ 动态 import：让上面的 LEMO_FILM_DIR 先生效（静态 import 会被提升到文件顶部）。
const {
  PROFILES, listProfiles, resolveConfig, validate, chat, listModels, invoke,
  maskKey, overrideFilePath, readOverride, saveOverride, maskedConfig, previewProfile, IMAGE_LIMITS,
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
//   ★★ 2026-10-09 追加：`workbuddy`（默认 profile）的 `kind` 已是 `workbuddy-gateway` ⇒ 它的端点/口令
//     来自**宿主注入的网关 env**（`SERVER__HOST` / `SERVER__PORT` / `CODEBUDDY_GATEWAY_PASSWORD`）。
//     测试必须**一并隔离**这三个 —— 否则跑在本机（`SERVER__PORT=11760`）时，「干净环境」用例会
//     静默解析到**真实网关**（既非隔离、也可能真发请求）✓
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
function startStub(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.on('clientError', () => { /* 客户端中途 abort 是预期的，别让它把测试搞崩 */ });
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      resolve({
        base: `http://127.0.0.1:${port}`,
        port,
        close: () => new Promise((r) => {
          try { srv.closeAllConnections?.(); } catch { /* ignore */ }
          srv.close(() => r());
        }),
      });
    });
  });
}
/** 拿一个「确定没人监听」的端口基址（连通性失败夹具：**不去连真外网**）。 */
async function closedBase() {
  const srv = http.createServer(() => { /* never */ });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
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

// ── ★★ 2026-10-09 追加：本机智能体网关（`kind:'workbuddy-gateway'`）的**桩** ────────────
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

/** ★★ 统一的「失败但不抛」断言：夹具造好、调 chat()、逐条断言。 */
async function expectFail(name, base, kind, extra = {}) {
  let res;
  try {
    res = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'openai-compatible', baseUrl: base, apiKey: 'sk-test-1234567890', timeoutMs: 3000, ...extra });
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
  //   ★ 2026-10-08 修正：运行时线索**低于覆盖文件**（见下 ③ 与专门用例）—— 此处**没有**覆盖文件，
  //     故仍取 ANTHROPIC_*（断言不变）。
  await withEnv({ ...CLEAN, LEMO_LLM_PROFILE: 'anthropic',
    ANTHROPIC_API_KEY: 'sk-runtime-abcdefgh', ANTHROPIC_BASE_URL: 'http://rt.example',
    ANTHROPIC_MODEL: 'rt-model' }, async () => {
    const c = resolveConfig({});
    assert.equal(c.kind, 'anthropic');
    assert.equal(c.apiKey, 'sk-runtime-abcdefgh', 'anthropic 未显式给 key ⇒ 取 ANTHROPIC_API_KEY');
    assert.equal(c.baseUrl, 'http://rt.example', 'anthropic 未显式给 baseUrl ⇒ 取 ANTHROPIC_BASE_URL');
    assert.equal(c.model, 'rt-model', '★ anthropic 未显式给 model ⇒ 取 ANTHROPIC_MODEL（裁定 (a)）');
    // env（LEMO_LLM_KEY / LEMO_LLM_MODEL）压过运行时线索
    const d = resolveConfig({ apiKey: 'sk-explicit' });
    assert.equal(d.apiKey, 'sk-explicit');
    const e = await withEnv({ LEMO_LLM_MODEL: 'env-model' }, () => resolveConfig({}));
    assert.equal(e.model, 'env-model', 'LEMO_LLM_MODEL 应压过 ANTHROPIC_MODEL');
    assert.equal(resolveConfig({ model: 'explicit-model' }).model, 'explicit-model', '显式 model 应压过一切');
  });

  // ③ 覆盖文件（保存的配置 = 面板）压过运行时线索与内置默认；② env 压过覆盖文件
  //   ★ 必须清掉环境里的 `LEMO_LLM_*`（否则 env 会压过覆盖文件 —— 那是**预期**的优先级，② > ③）；
  //     ★ 2026-10-08 修正后 `ANTHROPIC_*` / `OPENAI_*` 已**低于**覆盖文件 ⇒ 留着也不再遮蔽面板
  //     （专门的对照用例见下一条 `★ resolveConfig：覆盖文件 > 运行时线索`）。
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
    assert.equal(g.model, '', '★ 默认**不得**硬写模型（裁定 (b)：跟随环境，否则留空）');
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

// ── ③ 成功路径 ──────────────────────────────────────────────
test('chat() 成功：桩返回 OpenAI 格式 ⇒ 取到文本 + usage', async () => {
  const stub = await startStub(async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/chat/completions', 'openai-compatible 应打 /chat/completions');
    const body = JSON.parse(await readBody(req));
    assert.equal(body.stream, false, 'body 应含 stream:false');
    assert.ok(Array.isArray(body.messages) && body.messages.length === 1);
    json200(res, { choices: [{ message: { content: '你好，世界' } }], usage: { total_tokens: 7 } });
  });
  try {
    const res = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(res.ok, true, `应当成功：${JSON.stringify(res.error || '')}`);
    assert.equal(res.text, '你好，世界');
    assert.deepEqual(res.usage, { total_tokens: 7 });
    assert.equal(res.meta.profile, 'openai-compatible');
    assert.equal(res.meta.httpStatus, 200);
  } finally { await stub.close(); }
});

test('chat() anthropic：打 /v1/messages、带 x-api-key + anthropic-version，取 content[0].text', async () => {
  const stub = await startStub(async (req, res) => {
    assert.equal(req.url, '/v1/messages', 'anthropic 应打 /v1/messages');
    assert.equal(req.headers['x-api-key'], 'sk-ant-1234567890', '应带 x-api-key');
    assert.equal(req.headers['anthropic-version'], '2023-06-01', '应带 anthropic-version');
    const body = JSON.parse(await readBody(req));
    assert.equal(body.max_tokens, 1, '探针/请求应带 max_tokens');
    json200(res, { content: [{ type: 'text', text: 'claude says hi' }] });
  });
  try {
    const res = await chat([{ role: 'user', content: 'ping' }],
      { profile: 'anthropic', baseUrl: stub.base, apiKey: 'sk-ant-1234567890', maxTokens: 1 });
    assert.equal(res.ok, true, `应当成功：${JSON.stringify(res.error || '')}`);
    assert.equal(res.text, 'claude says hi');
  } finally { await stub.close(); }
});

test('chat() 显式 temperature ⇒ 透传进请求体；不给 ⇒ 请求体里不出现该键（逐字节不变）', async () => {
  // ★ 2026-10-08 补（由来：`lib/triple-check.mjs` 迁移时发现「迁移清单 M1 的建议漏了 temperature:0」——
  //   照抄会**不等价**；模块为此追加了 temperature 透传，但**当时没有模块侧单测**）。
  //   ★ 语义：只在 `temperature !== undefined` 时写入 ⇒ 未给值的既有路径**逐字节不变**。
  const seen = [];
  const stub = await startStub(async (req, res) => {
    seen.push(JSON.parse(await readBody(req)));
    json200(res, { choices: [{ message: { content: 'ok' } }] });
  });
  try {
    // (a) 显式给 0 ⇒ 必须写入（★ 0 是**有效值**，不能被 `||` 之类吞掉）
    const a = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890', temperature: 0 });
    assert.equal(a.ok, true, `应当成功：${JSON.stringify(a.error || '')}`);
    assert.equal(seen[0].temperature, 0, '显式 temperature:0 必须透传（0 不能被当成「未给」）');
    // (b) 不给 ⇒ 键**不存在**（不是 null / undefined / 默认值）
    const b = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(b.ok, true, `应当成功：${JSON.stringify(b.error || '')}`);
    assert.equal(Object.prototype.hasOwnProperty.call(seen[1], 'temperature'), false,
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
      profile: 'custom', baseUrl: stub.base, apiKey: 'sk-test-1234567890',
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
    const r = await validate({ profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true, `应当三步全过：${JSON.stringify(r.errors)}`);
    assert.equal(r.steps.reachable.ok, true);
    assert.equal(r.steps.auth.ok, true);
    assert.equal(r.steps.shape.ok, true);
    assert.equal(r.profile, 'openai-compatible');
    assert.deepEqual(r.errors, []);
  } finally { await stub.close(); }
});

test('validate()·reachable 失败：连不上 ⇒ steps.reachable.ok=false + kind=unreachable + 有 hint', async () => {
  const base = await closedBase();
  const r = await validate({ profile: 'openai-compatible', baseUrl: base, apiKey: 'sk-test-1234567890' });
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
    const r = await validate({ profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
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
    const r = await validate({ profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
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
    const r = await validate({ profile: 'anthropic', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true, `探针升级后应判 ok：${JSON.stringify(r.errors)}`);
    assert.equal(r.steps.shape.ok, true);
  } finally { await stub.close(); }
});

test('★ chat() anthropic 取文本回退：content[0] 是非文本块 ⇒ 扫 content[] 取第一个 text 块', async () => {
  const stub = await startStub((req, res) => json200(res, {
    content: [{ type: 'thinking', thinking: '...' }, { type: 'text', text: '真正的回答' }],
  }));
  try {
    const res = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'anthropic', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
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

      // 缺 model（★ 2026-10-09 更正：改打 **target:'model'** 的端点 ——
      //   原用例打 workbuddy（agent）；委托方澄清后 agent 模式**不再要求 model**（不下发 model），
      //   故「缺 model 明确报缺」这条语义现在只适用于**基础算力 API**，见契约 §十五。
      //   ★ lmstudio 是 model 模式且内置 model 为空 ⇒ 干净环境下 model==='' ⇒ 明确报缺）
      const r2 = await validate({ profile: 'lmstudio', baseUrl: stub.base });
      assert.equal(r2.ok, false);
      assert.equal(r2.profile, 'lmstudio');
      assert.equal(r2.steps.reachable.ok, true, '可达这一步应当过');
      assert.equal(r2.errors.find((e) => e.step === 'auth').kind, 'config');
      assert.match(r2.hint, /模型名/, 'hint 应明说缺模型名');

      // 缺 Key（有 baseUrl + model，服务端回 401）⇒ hint 明确说「未配置密钥」（契约 §六）
      const r3 = await validate({ profile: 'openai-compatible', baseUrl: stub.base, model: 'm', apiKey: '' });
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
      const r = await validate({ profile: 'lmstudio', baseUrl: stub.base, model: 'local-model' });
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
    const r = await validate({ profile: 'anthropic', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true, '★ 结构合法 ⇒ 不得判失败（这是对契约 §四 的修正）');
    assert.equal(r.steps.shape.ok, true);
    assert.equal(r.steps.shape.kind, 'empty-output', '应带上 empty-output 作为提示');
    assert.equal(r.warnings.length, 1);
    assert.equal(r.warnings[0].kind, 'empty-output');
    assert.deepEqual(r.errors, [], '这不是 error');
  } finally { await stub.close(); }
});

test('★ previewProfile(id)：面板预览专用 —— 显式 id（不依赖 LEMO_LLM_PROFILE）、不读覆盖文件、不发网络、脱敏', async () => {
  await withEnv({ ...CLEAN, LEMO_LLM_PROFILE: 'lmstudio' }, async () => {
    // ① 显式 id 压过 LEMO_LLM_PROFILE
    const wb = previewProfile('workbuddy');
    assert.equal(wb.id, 'workbuddy', '★ 必须看显式 id，不看 LEMO_LLM_PROFILE');
    assert.equal(wb.isDefault, true);
    assert.equal(wb.kind, 'workbuddy-gateway', '★ workbuddy 已改用智能体网关适配器（见契约 §十六）');
    assert.equal(wb.baseUrl, '', '干净环境下 workbuddy 的 baseUrl 应为空（不硬写、不硬编码端口）');
    assert.equal(wb.model, '', '干净环境下 workbuddy 的 model 应为空（不硬写）');
    assert.equal(wb.hasKey, false);
    assert.equal(wb.unknownProfile, false);
    assert.ok(wb.note.length > 0, 'note 应带出来（面板要显示）');

    // ② 不传 / 传空 ⇒ 默认 profile
    assert.equal(previewProfile().id, 'workbuddy');
    assert.equal(previewProfile('').id, 'workbuddy');

    // ③ 未知 id 要能识别（面板可据此提示）
    const unk = previewProfile('no-such-profile');
    assert.equal(unk.unknownProfile, true);
    assert.equal(unk.id, 'no-such-profile');

    // ④ ★ 不读覆盖文件（与 resolveConfig 的差异就在这里）
    rmOverride();
    fs.writeFileSync(overrideFilePath(),
      JSON.stringify({ profile: 'custom', baseUrl: 'http://file-base', model: 'file-model' }), 'utf8');
    try {
      assert.equal(previewProfile('workbuddy').baseUrl, '', '★ previewProfile **不读**覆盖文件');
      assert.equal(resolveConfig({}).baseUrl, 'http://file-base', '而 resolveConfig 会读（对照）');
    } finally { rmOverride(); }

    // ⑤ 脱敏：预览输出绝不含 key 明文
    const FAKE = 'sk-PREVIEW-abcdefghijklmnop-0123456789';
    await withEnv({ LEMO_LLM_KEY: FAKE }, () => {
      const p = previewProfile('openai-compatible');
      assert.equal(p.hasKey, true);
      assert.equal(p.keyMask, 'sk-P…');
      assert.ok(!JSON.stringify(p).includes(FAKE), '★ 预览输出不得含 key 明文');
    });
  });
});

test('★★ 密钥不外泄：listProfiles() / validate() 的任何输出都不含 key 明文（含响应体回显）', async () => {
  const FAKE = 'sk-FAKE-abcdefghijklmnop-0123456789';
  // 桩故意**把 key 回显**在错误体里（模拟服务端回显）⇒ 断言它被脱敏
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return status(res, 401, JSON.stringify({ error: `invalid key: ${FAKE}` }));
  });
  try {
    await withEnv({ ...CLEAN, LEMO_LLM_KEY: FAKE }, async () => {
      const profiles = listProfiles();
      const pText = JSON.stringify(profiles);
      assert.ok(!pText.includes(FAKE), '★ listProfiles() 输出里**不得**出现 key 明文');
      assert.equal(profiles.find((p) => p.id === 'workbuddy').hasKey, true, '应只回 hasKey:true');
      assert.ok(profiles.every((p) => !('apiKey' in p)), 'listProfiles 项里不得有 apiKey 字段');

      const r = await validate({ profile: 'openai-compatible', baseUrl: stub.base });
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
// ★ 2026-10-09 追加（委托方明令）：「接入对象 = 智能体 API」时**不发起任何模型相关请求**
//   （规格原文：「不探查、不读取智能体内部正在使用的模型信息，**不发起任何模型相关请求**
//   （例如不调用 `/v1/models` 或任何列举、查询模型的接口）」）
//   ⇒ `listModels()` 整条就是「列举模型」⇒ agent 模式下**必须直接拒绝、一个请求都不发**。
//   ★ 这条是**机制性**保证（模块自己挡住），不依赖「前端不去点」✓
test('★ listModels()：agent 模式**零请求**直接拒绝（kind=config）；model 模式照常发请求', async () => {
  let hit = 0;
  const stub = await startStub(async (req, res) => {
    hit++;
    json200(res, { data: [{ id: 'stub-model-a' }] });
  });
  try {
    // (a) agent 模式 ⇒ 拒绝，且**桩一次都没被调用**（= 零请求）
    const a = await listModels({ profile: 'workbuddy', kind: 'openai-compatible', target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(a.ok, false, 'agent 模式 listModels 必须失败（规格禁止探查模型）');
    assert.equal(a.error.kind, 'config', `应归一为 config，实得 ${a.error && a.error.kind}`);
    assert.ok(/模型相关请求/.test(a.error.message || ''), 'message 应说明「不发起模型相关请求」');
    assert.ok(/底层基础算力/.test((a.error.detail || '')), 'detail 应给出可操作建议（切到基础算力 API）');
    assert.equal(hit, 0, '★ agent 模式下**不得**发出任何请求（含 /v1/models）');

    // (b) model 模式 ⇒ 照常发（对照组：证明 (a) 的 0 命中不是「桩没起作用」）
    const b = await listModels({ profile: 'openai-compatible', kind: 'openai-compatible', target: 'model', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
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
    const r = await listModels({ profile: 'openai-compatible', baseUrl: okStub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.models, ['m1', 'm2']);
  } finally { await okStub.close(); }

  const badStub = await startStub((req, res) => status(res, 500, '{"error":"x"}'));
  try {
    const r = await listModels({ profile: 'openai-compatible', baseUrl: badStub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, false);
    assert.equal(r.error.kind, 'http-error');
  } finally { await badStub.close(); }
});

test('覆盖文件（§八）：saveOverride 落盘到非 C 盘临时树，resolveConfig 能读回；损坏文件不抛', async () => {
  rmOverride();
  const FAKE = 'sk-FILE-abcdefghijklmnop-0123456789';
  const s = saveOverride({ profile: 'custom', baseUrl: 'http://file-base', apiKey: FAKE, model: 'file-model' });
  assert.equal(s.ok, true);
  // ★ 用 path.resolve 比（Windows 下 path.join 给的是反斜杠，直接 startsWith 正斜杠会假红）
  assert.equal(path.resolve(path.dirname(s.path)), path.resolve(TMP), '★ 覆盖文件必须落在临时树（非 C 盘）内');
  assert.equal(path.basename(s.path), '_llm-api.json');

  const cfg = await withEnv(CLEAN, () => {
    const c = resolveConfig({});
    assert.equal(c.id, 'custom');
    assert.equal(c.baseUrl, 'http://file-base');
    assert.equal(c.model, 'file-model');
    assert.equal(c.apiKey, FAKE, '覆盖文件里的 key 应能读回（该文件是唯一允许含明文密钥处）');
    return c;
  });
  assert.equal(cfg.id, 'custom');
  assert.ok(fs.existsSync(overrideFilePath()));

  // 损坏文件 ⇒ 视为「无覆盖」，不抛
  fs.writeFileSync(overrideFilePath(), '{ not json', 'utf8');
  assert.deepEqual(readOverride(), {}, '损坏文件应降级为无覆盖');
  rmOverride();
});

test('maskedConfig：含 hasKey 与 keyMask，绝不含明文', async () => {
  await withEnv({ ...CLEAN, LEMO_LLM_KEY: 'sk-MASK-abcdefghijklmnop-0123456789' }, () => {
    const cfg = resolveConfig({ profile: 'openai-compatible' });
    const m = maskedConfig(cfg);
    assert.equal(m.hasKey, true);
    assert.equal(m.keyMask, 'sk-M…');
    assert.ok(!JSON.stringify(m).includes('sk-MASK-abcdefghijklmnop-0123456789'));
  });
});

// ── ⑦ 多模态（图片输入）—— 2026-10-08 追加 ────────────────────
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
    ] }], { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
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
    ] }], { profile: 'anthropic', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
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
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890', images: [{ path: imgPath }] });
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
    const res = await chat([{ role: 'user', content: '看图' }], {
      profile: 'anthropic', baseUrl: stub.base, apiKey: 'sk-test-1234567890',
      images: [{ dataUrl: `data:image/jpeg;base64,${B64A}` }, { base64: B64B, mediaType: 'image/webp' }],
    });
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
    await chat([{ role: 'user', content: 'hi' }], { profile: 'openai-compatible', baseUrl: stub.base, model: 'm', apiKey: 'sk-test-1234567890' });
    await chat([{ role: 'user', content: 'hi' }], { profile: 'anthropic', baseUrl: stub.base, model: 'm', apiKey: 'sk-test-1234567890' });
    assert.equal(gotOpenai, OPENAI_GOLDEN, '★ openai-compatible 纯文本请求体必须逐字节不变');
    assert.equal(gotAnthropic, ANTHROPIC_GOLDEN, '★ anthropic 纯文本请求体必须逐字节不变');
  } finally { await stub.close(); }
});

test('★ 多模态·体积守卫：单图超限 ⇒ bad-shape；总请求体超限 ⇒ config（都不抛）', async () => {
  const tooBigB64 = 'A'.repeat(Math.ceil((IMAGE_LIMITS.maxImageBytes + 4096) * 4 / 3));
  const base = { profile: 'openai-compatible', baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'sk-test-1234567890' };

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
  const base = { profile: 'openai-compatible', baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'sk-test-1234567890' };
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
    ] }], { profile: 'openai-compatible', baseUrl: stub.base, apiKey: FAKE });
    assert.equal(res.ok, false);
    const all = JSON.stringify(res);
    assert.ok(!all.includes(B64), '★ 图片内容**不得**出现在任何输出（含 detail）里');
    assert.ok(!all.includes(FAKE), '★ 密钥照旧不外泄');
    assert.match(res.error.detail, /bad image/, 'detail 应保留（非图片部分的）错误信息');
  } finally { await stub.close(); }
});

// ── ⑧ 国产厂商内置预设（2026-10-08 追加）───────────────────────
//   ★ 规格要求「原生兼容国内主流智能体与大模型生态，包含但不限于豆包 / 通义千问 / 腾讯系列」。
//   ★ 断言三件套（每家）：`listProfiles()` 含它 / `previewProfile()` 出脱敏配置 /
//     `resolveConfig` 解析出 endpoint 与模型。★ 全部离线（不打外网）。
//   ★ 这里列的是「**内置表里的默认值**」—— 断言的是「预设确实带了可用的 endpoint 与常用模型名」。
const VENDOR_PRESETS = [
  { id: 'doubao', kind: 'openai-compatible', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-251015' },
  { id: 'qwen', kind: 'openai-compatible', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'hunyuan', kind: 'openai-compatible', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', model: 'hunyuan-turbos-latest' },
  { id: 'deepseek', kind: 'openai-compatible', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  { id: 'zhipu', kind: 'openai-compatible', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3' },
  { id: 'kimi', kind: 'openai-compatible', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.7' },
  { id: 'siliconflow', kind: 'openai-compatible', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
];

test('★ 国产厂商内置预设：每家都能 listProfiles / previewProfile / resolveConfig（脱敏、离线）', async () => {
  rmOverride();                                        // 干净环境：不读覆盖文件（只看内置表 + 环境）
  await withEnv(CLEAN, () => {
    const profiles = listProfiles();
    const byId = new Map(profiles.map((p) => [p.id, p]));
    for (const v of VENDOR_PRESETS) {
      // ① listProfiles() 含它（且 kind / baseUrl / model 与内置表一致）
      const listed = byId.get(v.id);
      assert.ok(listed, `listProfiles() 应含内置预设「${v.id}」`);
      assert.equal(listed.kind, v.kind, `${v.id}: kind 应为 ${v.kind}`);
      assert.equal(listed.baseUrl, v.baseUrl, `${v.id}: listProfiles 的 baseUrl 应为内置预设值`);
      assert.equal(listed.model, v.model, `${v.id}: listProfiles 的 model 应为内置预设默认值`);
      assert.equal(listed.isDefault, false, `${v.id}: ★ 不得是默认 profile（默认必须仍是 workbuddy）`);
      assert.ok(typeof listed.note === 'string' && listed.note.length > 0, `${v.id}: note 应非空（面板要显示「去哪拿 Key」）`);
      assert.equal(listed.hasKey, false, `${v.id}: 干净环境下不应有 key`);

      // ② previewProfile() 出**脱敏**配置（显式 id、不读覆盖文件、不发网络）
      const pv = previewProfile(v.id);
      assert.equal(pv.id, v.id);
      assert.equal(pv.kind, v.kind);
      assert.equal(pv.baseUrl, v.baseUrl, `${v.id}: previewProfile 的 baseUrl`);
      assert.equal(pv.model, v.model, `${v.id}: previewProfile 的 model`);
      assert.equal(pv.hasKey, false, `${v.id}: 干净环境下不应有 key`);
      assert.equal(pv.unknownProfile, false, `${v.id}: 不应是未知 profile`);
      assert.ok(Array.isArray(pv.models) && pv.models.length >= 1, `${v.id}: 应有可选模型列表（供面板多模型切换）`);
      assert.ok(pv.models.includes(v.model), `${v.id}: models[] 应含默认模型`);
      assert.ok(!('apiKey' in pv), `${v.id}: ★ 预览输出不得含 apiKey 字段`);
      assert.ok(!JSON.stringify(pv).includes('"apiKey"'), `${v.id}: ★ 预览输出序列化后也不得出现 apiKey`);

      // ③ resolveConfig 能解析出 endpoint 与模型
      const cfg = resolveConfig({ profile: v.id });
      assert.equal(cfg.kind, v.kind, `${v.id}: resolveConfig 的 kind`);
      assert.equal(cfg.baseUrl, v.baseUrl, `${v.id}: resolveConfig 的 baseUrl`);
      assert.equal(cfg.model, v.model, `${v.id}: resolveConfig 的 model`);
      assert.ok(cfg.models.includes(v.model), `${v.id}: resolveConfig 的 models[] 应含默认模型`);
      assert.equal(cfg.apiKey, '', `${v.id}: ★ 内置预设**不得**带任何密钥`);
    }

    // ★★ 默认 profile 仍是 workbuddy（规格硬要求；新增预设一律不得抢默认）
    const defaults = profiles.filter((p) => p.isDefault);
    assert.equal(defaults.length, 1, '★ 恰一个默认 profile');
    assert.equal(defaults[0].id, 'workbuddy', '★ 默认 profile 必须仍是 workbuddy');
  });
});

test('★ 国产厂商内置预设：key 经环境注入 ⇒ 逐家预览都脱敏（前 4 位 + …），绝不含明文', async () => {
  rmOverride();
  const FAKE = 'sk-VENDOR-abcdefghijklmnop-0123456789';
  await withEnv({ ...CLEAN, LEMO_LLM_KEY: FAKE }, () => {
    for (const v of VENDOR_PRESETS) {
      const pv = previewProfile(v.id);
      assert.equal(pv.hasKey, true, `${v.id}: 应识别到 key（hasKey:true）`);
      assert.equal(pv.keyMask, 'sk-V…', `${v.id}: key 应脱敏为前 4 位 + …`);
      assert.ok(!JSON.stringify(pv).includes(FAKE), `★ ${v.id}: 预览输出不得含 key 明文`);
      // 走一遍 resolveConfig：apiKey 能解析到（供真实调用），但**绝不进 listProfiles() 的输出**
      assert.equal(resolveConfig({ profile: v.id }).apiKey, FAKE, `${v.id}: resolveConfig 应取到 key（调用用）`);
    }
    const pText = JSON.stringify(listProfiles());
    assert.ok(!pText.includes(FAKE), '★ listProfiles() 输出里不得出现 key 明文');
    assert.ok(!pText.includes('"apiKey"'), '★ listProfiles() 项里不得有 apiKey 字段');
  });
});

// ── ⑧ ★★ 2026-10-08 追加：workbuddy 默认 profile 的运行时解析（实测驱动，全部用假 env，不打真实端点）──
//   规格：「软件内所有涉及 LLM 推理的任务，默认使用 WorkBuddy 及其内置模型执行；用户仍可在 API 配置面板
//   手动切换为其他 API 服务。」⇒ 默认 profile 必须**从运行时环境解析** baseUrl / model / key，且面板压过它。
//   ★ 实测裁定（见 lib/llm-api.mjs 内联注释）：`workbuddy` 的 model **只认 `ANTHROPIC_MODEL`** ——
//     实测 `CODEBUDDY_CURRENT_MODEL_ID` 原值在本机中转上不可直接路由（HTTP 503）⇒ 不接入（不猜、不硬编码）。
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
    assert.equal(cfg.kind, 'workbuddy-gateway', '★ 2026-10-09：workbuddy 改用**智能体网关**适配器（见契约 §十六）');
    assert.equal(cfg.target, 'agent', '★ workbuddy 是智能体 API（target=agent）');
    assert.equal(cfg.baseUrl, 'http://127.0.0.1:11760',
      '★ baseUrl 由 SERVER__HOST / SERVER__PORT **动态发现**（不硬编码端口；也不再取 ANTHROPIC_BASE_URL）');
    assert.equal(cfg.apiKey, 'gw-WBRUNTIME-abcdefghijklmnop-0123456789',
      '★ 口令取自 CODEBUDDY_GATEWAY_PASSWORD（也不再取 ANTHROPIC_API_KEY）');
    // ★★ 2026-10-09（v3「不探查 / 不读取智能体内部模型」）：workbuddy 是 `target:'agent'` ⇒
    //   **不得**把 ANTHROPIC_MODEL 解析进 cfg.model（那是「读取智能体内部模型信息」）⇒ 即便设了也为空。
    assert.equal(cfg.model, '', '★ agent 模式**不读** ANTHROPIC_MODEL ⇒ cfg.model 应为空（v3：不探查智能体内部模型）');
    // ★ 对照（正向控制）：`anthropic`（target:'model'，基础模型 API）**仍**读 ANTHROPIC_*。
    const a = resolveConfig({ profile: 'anthropic' });
    assert.equal(a.baseUrl, 'http://rt-wb.example:3000', '★ 对照：anthropic 仍取 ANTHROPIC_BASE_URL');
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
    // ★★ 2026-10-09 更正：`workbuddy` 的运行时线索**不再是** `ANTHROPIC_BASE_URL`（那是模型中继）——
    //   而是宿主注入的网关 env（`SERVER__HOST` / `SERVER__PORT`）⇒ hint 必须改说这个（见契约 §十六）。
    assert.ok(/SERVER__PORT/.test(v.hint),
      `★ hint 应提示默认 profile 的端点由宿主注入的 SERVER__HOST / SERVER__PORT 动态发现，实得：${v.hint}`);
  });
});

test('★ 优先级回归：覆盖文件（面板）仍压过运行时线索（守上一批的修复）', async () => {
  rmOverride();
  // ★★ 2026-10-09 更正（见契约 §十六）：默认 profile `workbuddy` 的 `kind` 已是 `workbuddy-gateway`
  //   ⇒ 它的**运行时线索不再是 `ANTHROPIC_*`**（那是模型中继），而是宿主注入的网关 env
  //   （`SERVER__HOST` / `SERVER__PORT` / `CODEBUDDY_GATEWAY_PASSWORD`）。
  //   ★ **不是放宽**：本用例守的是「面板（覆盖文件）> 运行时线索」这条**优先级**；只把「运行时线索」
  //     换成默认 profile 现在**真正**读的那一组 env ⇒ baseUrl / model / key 三项断言强度**不变**。
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

test('★★ workbuddy 运行时口令不外泄：listProfiles / validate / 错误 detail 均不含 CODEBUDDY_GATEWAY_PASSWORD 明文', async () => {
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
      // ★★ 2026-10-09：workbuddy 是 `target:'agent'` + 网关适配器 ⇒ 口令来自 `CODEBUDDY_GATEWAY_PASSWORD`。
      const cfgWb = resolveConfig({});
      assert.equal(cfgWb.model, '', '★ 前置：agent 模式不读 ANTHROPIC_MODEL（cfg.model 为空）');
      assert.equal(cfgWb.apiKey, SECRET, '前置：口令取自网关 env（供调用）');
      // ① listProfiles()：绝不回口令，且不得含明文
      const lp = JSON.stringify(listProfiles());
      assert.ok(!lp.includes(SECRET), '★ listProfiles() 不得含口令明文');
      assert.ok(!lp.includes('"apiKey"'), '★ listProfiles() 项里不得有 apiKey 字段');
      // ② previewProfile()：只回 hasKey/keyMask
      const pv = JSON.stringify(previewProfile('workbuddy'));
      assert.ok(!pv.includes(SECRET), '★ previewProfile() 不得含口令明文');
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

// ── ⑬ ★★ 2026-10-09 追加：默认 profile `workbuddy` 接入**本机智能体网关**（见契约 §十六）──────
//   ★ 协议（两段式）：① `POST {baseUrl}/api/v1/runs`（体 `{id,type:'message',text,sender:{id,name}}`，**无 model**）
//     → `202 {data:{runId}}`；② `GET {baseUrl}/api/v1/runs/{runId}/stream`（SSE）取文本。
//   ★★ **纪律：绝不真打 `POST /api/v1/runs`**（那会真发起一次 Agent 执行，且网关的 `primarySession`
//     就是用户当前会话）⇒ 全部打**本地桩**（`startGatewayStub`，`127.0.0.1:0`，用完关闭）。
//   ★ 端点/口令**运行时发现**（`SERVER__HOST` / `SERVER__PORT` / `CODEBUDDY_GATEWAY_PASSWORD`），**不硬编码端口**。

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
      assert.equal(Object.prototype.hasOwnProperty.call(run.body, 'model'), false, '★ 请求体不得出现 model');
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

// ── ⑨ ★★ 2026-10-08 追加：接入对象类型 `target`（`'model'` / `'agent'`）──────────────
//   ★ 由来（规格原文）：要区分「底层基础大模型 API」（模块**主动指定** model）与「智能体 API」
//     （WorkBuddy / Codex / ChatGPT / Claude Code / 豆包工作智能体 —— 模块**不感知、不指定、不干预**其内部底层模型）。
//     · 模型 API ⇒ 请求体**正常携带 model**、准入**校验模型标识**；
//     · 智能体 API ⇒ 面板 model **仅作本地备注**，请求体**默认不下发 model**、准入**不校验模型标识**
//       （只校验连通 / 鉴权 / 返回文本合法性）。
//   ★★ **2026-10-09 更正（委托方澄清，见契约 §十五）**：**取消**原「唯一例外 `kind==='anthropic'`」——
//     `agent` 模式**绝不下发 model**（**不看 kind**）；端点若因不带 model 而 400/422「要求 model」
//     ⇒ **如实报错**（`config` + 中文 hint），**不**把 model 偷偷加回去。
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
      { profile: 'openai-compatible', target: 'agent', baseUrl: stub.base, model: 'just-a-note', apiKey: 'sk-test-1234567890' });
    assert.equal(a.ok, true, `应当成功：${JSON.stringify(a.error || '')}`);
    assert.equal(Object.prototype.hasOwnProperty.call(seen[0].body, 'model'), false,
      '★ agent 模式请求体**不得**出现 model（防参数覆盖干扰智能体内部调度）');
    assert.ok(Array.isArray(seen[0].body.messages), 'messages 仍应照常发出');

    // ② custom + agent：同样不下发
    const b = await chat([{ role: 'user', content: 'hi' }], {
      profile: 'custom', target: 'agent', baseUrl: stub.base, path: '/v1/infer',
      extract: 'result.outputs.0.text', model: 'note2', apiKey: 'sk-test-1234567890',
    });
    assert.equal(b.ok, true, `应当成功：${JSON.stringify(b.error || '')}`);
    assert.equal(Object.prototype.hasOwnProperty.call(seen[1].body, 'model'), false,
      '★ custom + agent 也不得出现 model');

    // ③ ★★ anthropic + agent：**这是 2026-10-09 取消的例外** —— 现在也**不下发 model**
    //   ★★ 2026-10-09 更正（见契约 §十六）：`workbuddy` 已改走**网关适配器**（kind='workbuddy-gateway'）
    //     ⇒ 它**不再**是 anthropic 端点。本段验的是「agent + **anthropic kind**」的性质 ⇒ 改用
    //     `anthropic` profile（原意 = anthropic 端点 + agent 目标），断言一字不改。
    const c = await chat([{ role: 'user', content: 'hi' }], {
      profile: 'anthropic', target: 'agent', baseUrl: stub.base, model: 'a-note', apiKey: 'sk-test-1234567890',
    });
    assert.equal(c.ok, true, `应当成功：${JSON.stringify(c.error || '')}`);
    assert.equal(seen[2].url, '/v1/messages', 'anthropic 应打 /v1/messages');
    assert.equal(Object.prototype.hasOwnProperty.call(seen[2].body, 'model'), false,
      '★★ anthropic + agent **也不得**出现 model（委托方澄清：不向智能体下发任何 model，见契约 §十五）');
    assert.ok(Array.isArray(seen[2].body.messages), 'messages 仍应照常发出');
    assert.equal(typeof seen[2].body.max_tokens, 'number', 'max_tokens 等其余字段照常');
  } finally { await stub.close(); }
});

test('★ 接入对象类型·model（默认）：请求体**照旧带 model**（逐字节金标回归，证明向后兼容）', async () => {
  const GOLDEN = '{"model":"m","messages":[{"role":"user","content":"hi"}],"stream":false}';
  let got = null;
  const stub = await startStub(async (req, res) => {
    got = await readBody(req);
    json200(res, { choices: [{ message: { content: 'ok' } }] });
  });
  try {
    // (a) 不传 target ⇒ 默认 'model' ⇒ 与既有行为逐字节相同
    const r1 = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'openai-compatible', baseUrl: stub.base, model: 'm', apiKey: 'sk-test-1234567890' });
    assert.equal(r1.ok, true, `应当成功：${JSON.stringify(r1.error || '')}`);
    assert.equal(got, GOLDEN, '★ 默认（model）请求体必须逐字节不变');
    // (b) 显式 target:'model' 亦然
    const r2 = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'openai-compatible', target: 'model', baseUrl: stub.base, model: 'm', apiKey: 'sk-test-1234567890' });
    assert.equal(r2.ok, true, `应当成功：${JSON.stringify(r2.error || '')}`);
    assert.equal(got, GOLDEN, '★ 显式 model 模式同样逐字节不变');
  } finally { await stub.close(); }
});

test('★ 接入对象类型·agent：**缺 model 不报错**（model 只是本地备注；chat 仍能成功）', async () => {
  const stub = await startStub((req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });
    return json200(res, { choices: [{ message: { content: 'pong' } }] });
  });
  try {
    await withEnv(CLEAN, async () => {
      // lmstudio 内置 model 为空 ⇒ 干净环境下 model===''；再显式标 target:'agent'
      const r = await chat([{ role: 'user', content: 'hi' }],
        { profile: 'lmstudio', target: 'agent', baseUrl: stub.base });
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
      const r = await validate({ profile: 'lmstudio', target: 'agent', baseUrl: stub.base });
      assert.equal(r.ok, true, `★ agent 模式缺 model 仍应通过（不校验模型）：${JSON.stringify(r.errors)}`);
      assert.deepEqual(r.errors, [], '★ 不得因缺 model 报 config');
      assert.equal(r.steps.auth.ok, true, '鉴权/探针这一步应过');
      // ② 对照：同一 profile 默认（model 模式）缺 model ⇒ **明确报 config**（现状不变）
      const r2 = await validate({ profile: 'lmstudio', baseUrl: stub.base });
      assert.equal(r2.ok, false, 'model 模式缺 model 应报错（对照）');
      assert.equal(r2.errors.find((e) => e.step === 'auth').kind, 'config');
    });
  } finally { await stub.close(); }
});

test('★★ PROFILES.target 判定：workbuddy = agent；其余 11 个 = model（按**端点性质**判）', async () => {
  rmOverride();
  await withEnv(CLEAN, () => {
    // ★ WorkBuddy 是智能体（规格点名）⇒ agent
    assert.equal(PROFILES.workbuddy.target, 'agent', '★ WorkBuddy 是智能体 ⇒ target=agent');
    assert.equal(resolveConfig({}).target, 'agent', '★ 默认 profile 解析出 agent（不传 profile ⇒ workbuddy）');
    assert.equal(previewProfile('workbuddy').target, 'agent', 'previewProfile 也应带出 agent');
    // ★ 其余一律 model —— 依据：它们都**直接对接基础模型本体**（请求体带 model 指定具体模型）
    const expectModel = ['anthropic', 'openai-compatible', 'doubao', 'qwen', 'hunyuan',
      'deepseek', 'zhipu', 'kimi', 'siliconflow', 'lmstudio', 'custom'];
    for (const id of expectModel) {
      assert.equal(PROFILES[id].target, 'model', `${id}: 应判为 model（端点性质 = 直接对接基础模型的模型 API）`);
      assert.equal(resolveConfig({ profile: id }).target, 'model', `${id}: resolveConfig 的 target`);
      assert.equal(previewProfile(id).target, 'model', `${id}: previewProfile 的 target`);
    }
    // listProfiles() 也带 target（供面板区分「模型 API / 智能体 API」）
    const lp = listProfiles();
    assert.equal(lp.find((p) => p.id === 'workbuddy').target, 'agent', 'listProfiles: workbuddy = agent');
    assert.ok(lp.every((p) => p.target === 'agent' || p.target === 'model'),
      'listProfiles 的 target 只能取 model / agent');
    assert.equal(lp.filter((p) => p.target === 'agent').length, 1, '★ 恰一个 agent（workbuddy）');
    assert.equal(lp.length, 12, '内置 profile 总数应为 12');
  });
});

test('★★ 接入对象类型·agent + anthropic：**不下发 model**（★ 2026-10-09 取消原「仍带 model」例外；见契约 §十五）', async () => {
  let got = null;
  const stub = await startStub(async (req, res) => {
    got = JSON.parse(await readBody(req));
    json200(res, { content: [{ type: 'text', text: 'ok' }] });
  });
  try {
    // 端点**不要求** model（真智能体入口）⇒ agent 模式不带 model 也能正常收发
    // ★★ 2026-10-09 更正（见契约 §十六）：`workbuddy` 已改走网关适配器 ⇒ 验「anthropic kind + agent」
    //   改用 `anthropic` profile（断言不变）。
    const r = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'anthropic', target: 'agent', baseUrl: stub.base, model: 'a-model', apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.equal(Object.prototype.hasOwnProperty.call(got, 'model'), false,
      '★★ 委托方澄清：agent 模式**绝不**下发 model（即便面板填了备注名 a-model）；原「anthropic 例外」已取消');
    assert.ok(Array.isArray(got.messages), 'messages 照常发出');
  } finally { await stub.close(); }
});

test('★★ v3·agent 模式探针**不带 model 探活**：端点回 400「要求 model」⇒ 归一为 config + 中文 hint（绝不自动加回 model）', async () => {
  let sawModel = 'n/a';
  const stub = await startStub(async (req, res) => {
    if (req.method === 'GET') return json200(res, { data: [] });                    // 可达
    const body = JSON.parse(await readBody(req));
    sawModel = Object.prototype.hasOwnProperty.call(body, 'model');
    // ★ 模拟「要求 model 的模型 API 端点」（如实测本机中继）——agent 模式不带 model ⇒ 回 400
    return status(res, 400, '{"error":{"message":"Model name not specified, model name cannot be empty"}}');
  });
  try {
    await withEnv(CLEAN, async () => {
      // ① validate()：agent 模式探针不带 model ⇒ 被 400 拒绝 ⇒ 归一为 config + hint 说清根因
      // ★★ 2026-10-09 更正（见契约 §十六）：`workbuddy` 已改走网关适配器 ⇒ 验「agent + anthropic」
      //   改用 `anthropic` profile + 显式 target:'agent'（原意不变，断言不变）。
      const v = await validate({ profile: 'anthropic', target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
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
        { profile: 'anthropic', target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
      assert.equal(c.ok, false);
      assert.equal(c.error.kind, 'config', '★ chat() 也应归一为 config');
      assert.match(c.error.message, /底层基础算力|基础算力 API/, 'chat() 的 message 应说清根因');

      // ③ invoke()：同一口径
      const iv = await invoke('chat', { messages: 'hi' },
        { profile: 'anthropic', target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
      assert.equal(iv.ok, false);
      assert.equal(iv.error.kind, 'config', '★ invoke() 也应归一为 config');

      // ④ 对照：**基础算力 API（target:'model'）** 同一 400 响应仍按既有映射（http-error）——
      //    证明这个归一**只对 agent 模式**生效，没有改到模型 API 的既有行为
      const m = await chat([{ role: 'user', content: 'hi' }],
        { profile: 'openai-compatible', target: 'model', baseUrl: stub.base, model: 'm', apiKey: 'sk-test-1234567890' });
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
      // ★★ 2026-10-09 更正（见契约 §十六）：`workbuddy` 已改走网关适配器 ⇒ 验「agent + anthropic」
      //   改用 `anthropic` profile + 显式 target:'agent'（断言不变）。
      const v = await validate({ profile: 'anthropic', target: 'agent', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
      assert.equal(v.ok, true, `agent 模式应三步全过：${JSON.stringify(v.errors)}`);
      assert.equal(seen.length, 1, `★ agent 模式只应发**一次**请求（POST 探针），实得 ${seen.length}：${JSON.stringify(seen)}`);
      assert.equal(seen[0].method, 'POST', '★ agent 模式那一次必须是 POST 探针');
      assert.equal(seen[0].url, '/v1/messages', 'agent + anthropic 的 POST 探针打 /v1/messages');
      assert.ok(!seen.some((s) => /\/models\b|\/models$/.test(s.url)),
        `★★ agent 模式**不得**出现任何模型列举请求（/v1/models）：${JSON.stringify(seen)}`);

      // ② 对照：**model 模式**（底层基础算力 API）**仍**发 `GET /v1/models`（未被本改动波及）
      seen.length = 0;
      const v2 = await validate({ profile: 'anthropic', target: 'model', baseUrl: stub.base, model: 'm', apiKey: 'sk-test-1234567890' });
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

test('★ 接入对象类型·覆盖优先级：显式 > 覆盖文件（面板） > 内置默认；非法值归一为 model', async () => {
  rmOverride();
  await withEnv(CLEAN, () => {
    // ⑤ 内置默认
    assert.equal(resolveConfig({ profile: 'workbuddy' }).target, 'agent', '内置：workbuddy = agent');
    assert.equal(resolveConfig({ profile: 'openai-compatible' }).target, 'model', '内置：openai-compatible = model');
    try {
      // ③ 覆盖文件（面板保存的配置）应压过内置默认
      fs.writeFileSync(overrideFilePath(), JSON.stringify({ target: 'model' }), 'utf8');
      assert.equal(resolveConfig({ profile: 'workbuddy' }).target, 'model', '★ 覆盖文件应压过内置默认');
      fs.writeFileSync(overrideFilePath(), JSON.stringify({ profile: 'lmstudio', target: 'agent' }), 'utf8');
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
    assert.equal(resolveConfig({ profile: 'openai-compatible', target: '' }).target, 'model', '干净环境下空 target ⇒ 内置默认 model');
  });
});

// ── ⑩ ★★ 2026-10-09 追加：通用算力入口 `invoke()`（见契约 §十三）──────────────────
//   ★ 由 v3 规格：「模块名从 LLM-API 配置模块 改为 通用 AI 算力 API 接入模块；算力类型不限
//     （LLM 文本推理、图像生成、语音、向量计算等各类 AI 算力）」⇒ 新增通用入口 `invoke(task, params, opts)`。
//   ★ 归一返回：成功 `{ok:true,task,result,raw,meta}`；失败 `{ok:false,task,error:{kind,…},meta}`。
//   ★ 全部离线（桩服务），不打真实外网。

test('★★ invoke(\'chat\')：与 chat() **同请求体、同结果**（证明 chat 已改为走 invoke 且行为不变）', async () => {
  const seen = [];
  const stub = await startStub(async (req, res) => {
    seen.push(await readBody(req));
    json200(res, { choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 3 } });
  });
  try {
    const viaChat = await chat([{ role: 'user', content: 'hi' }],
      { profile: 'openai-compatible', baseUrl: stub.base, model: 'm', apiKey: 'sk-test-1234567890' });
    const viaInvoke = await invoke('chat', { messages: [{ role: 'user', content: 'hi' }] },
      { profile: 'openai-compatible', baseUrl: stub.base, model: 'm', apiKey: 'sk-test-1234567890' });
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
    assert.equal(body.model, 'gpt-4o-mini', '基础算力 ⇒ 请求体带 model（内置默认）');
    assert.equal(body.n, 2, '可选入参 n 应透传');
    json200(res, { data: [{ url: 'https://img.example/1.png' }, { url: 'https://img.example/2.png' }] });
  });
  try {
    const r = await invoke('image', { prompt: '一只猫', n: 2 },
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
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
      { profile: 'custom', baseUrl: stub.base, path: '/v1/gen', extract: 'result.images', apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.deepEqual(r.result.images, ['AAAA'], '★ 自配 extract 应能取到 b64_json');
  } finally { await stub.close(); }
});

test('★ invoke(\'image\')：anthropic 适配器无图像接口 ⇒ 明确 config 错（不抛）', async () => {
  const r = await invoke('image', { prompt: 'x' },
    { profile: 'anthropic', baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-test-1234567890' });
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
    const r = await invoke('embedding', { input: ['甲', '乙'] },
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.deepEqual(r.result.vectors, [[0.1, 0.2], [0.3]]);
  } finally { await stub.close(); }
});

// ── ★★ 2026-10-09 追加：`embedding` 判定收紧（一条向量 = 非空且**元素全为数字**的数组，契约 §13.2）──
//   ★ 由来（第 7 轮审计 A3）：原判据 `Array.isArray(v) && v.length` **不校验元素类型** ⇒
//     `invoke('embedding',{extract:'data'})` 会把 `{embedding:[…]}`（**对象**）或 `['a','b']`（**字符串数组**）
//     误当向量（`ok:true`）。★ 契约原只要求「至少 1 条**非空数组**」⇒ **严格未违约**，但**判定不自洽**。
//   ★ 下面三条：① 真向量（数组的数组）⇒ 仍 `ok:true`；② 对象数组 / ③ 字符串数组 ⇒ 归一为 `bad-shape`。

test('★★ invoke(\'embedding\')·收紧后：extract 指向 `[[0.1,0.2]]`（数组的数组）⇒ ok:true、vectors=[[0.1,0.2]]', async () => {
  const stub = await startStub((req, res) => json200(res, { data: [[0.1, 0.2]] }));
  try {
    const r = await invoke('embedding', { input: 'x' },
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890', extract: 'data' });
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.deepEqual(r.result.vectors, [[0.1, 0.2]], '★ 真向量（元素全为数字）应被接受，不受收紧影响');
  } finally { await stub.close(); }
});

test('★★ invoke(\'embedding\')·收紧后：extract 指向 `[{embedding:[…]}]`（**对象**数组）⇒ bad-shape（第 7 轮审计 A3）', async () => {
  const stub = await startStub((req, res) => json200(res, { data: [{ embedding: [0.1, 0.2] }] }));
  try {
    const r = await invoke('embedding', { input: 'x' },
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890', extract: 'data' });
    assert.equal(r.ok, false, '★ 对象不得被当成向量');
    assert.equal(r.error.kind, 'bad-shape', '★ 取不到合法向量应归一为 bad-shape');
  } finally { await stub.close(); }
});

test('★★ invoke(\'embedding\')·收紧后：extract 指向 `[\'a\',\'b\']`（**字符串**数组）⇒ bad-shape', async () => {
  const stub = await startStub((req, res) => json200(res, { data: ['a', 'b'] }));
  try {
    const r = await invoke('embedding', { input: 'x' },
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890', extract: 'data' });
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
    const r = await invoke('audio', { input: '你好', voice: 'alloy' },
      { profile: 'openai-compatible', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
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
      { profile: 'custom', baseUrl: stub.base, path: '/v1/anything', extract: 'result.answer', apiKey: 'sk-test-1234567890' });
    assert.equal(r.ok, true, `应当成功：${JSON.stringify(r.error || '')}`);
    assert.equal(r.result.value, 42);
  } finally { await stub.close(); }
});

test('★ invoke：未知 task / 缺 baseUrl ⇒ config 错（不抛）；task 名回显在返回里', async () => {
  const r1 = await invoke('nope', {}, { profile: 'openai-compatible', baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-test-1234567890' });
  assert.equal(r1.ok, false);
  assert.equal(r1.error.kind, 'config');
  assert.equal(r1.task, 'nope');
  const r2 = await invoke('chat', { messages: 'hi' }, { profile: 'custom' });   // custom 内置 baseUrl 为空
  assert.equal(r2.ok, false);
  assert.equal(r2.error.kind, 'config');
  assert.match(r2.error.message, /baseUrl/);
});

// ── ⑪ ★★ 2026-10-09 追加：v3「不探查 / 不读取智能体内部模型」（见契约 §十四）────────────

test('★★ v3·agent 模式**不再从环境读取 model**：设了 ANTHROPIC_MODEL 也不进 cfg.model（对照 model 模式会进）', async () => {
  rmOverride();
  await withEnv({ ...CLEAN, ANTHROPIC_MODEL: 'env-model-must-be-ignored', ANTHROPIC_BASE_URL: 'http://rt.example' }, () => {
    // ① agent（workbuddy）：**不读** ANTHROPIC_MODEL
    const wb = resolveConfig({});
    assert.equal(wb.target, 'agent', 'workbuddy 是智能体 API');
    assert.equal(wb.model, '', '★ agent 模式设了 ANTHROPIC_MODEL 也**不得**进 cfg.model（v3：不探查智能体内部模型）');
    // ② 对照：anthropic（target:'model'，基础模型 API）**仍读** ANTHROPIC_MODEL
    assert.equal(resolveConfig({ profile: 'anthropic' }).model, 'env-model-must-be-ignored',
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

test('★★ v3·agent + 网关适配器（原 anthropic）+ model 为空 ⇒ **不再报 config**，而是**不带 model 正常发出**（★ 2026-10-09：见契约 §十五 / §十六）', async () => {
  // ★★ 2026-10-09 更正（见契约 §十六）：`workbuddy` 已改走**网关适配器**（kind='workbuddy-gateway'）
  //   ⇒ 原「拿 `workbuddy` 当 anthropic 端点」的前提已不成立。但本用例的**核心前提是「model 为空」**
  //   （`workbuddy` 的内置 model 恰为 `''`；而 `anthropic` 内置 model 非空 ⇒ 换过去「model 为空」这个前提就没了）
  //   ⇒ **保留 `workbuddy`**，只把桩从「anthropic 直返」换成「网关两段式（POST runs + SSE）」。断言一字不改。
  let got = null;
  const stub = await startGatewayStub({ onRun: (b) => { got = b; } });
  try {
    await withEnv({ ...CLEAN, ...gwEnv(stub) }, async () => {
      // workbuddy(agent)+网关，model 为空（干净环境 ⇒ 也不从 env 偷读）⇒ **发请求**、**不带 model**、成功
      const c = await chat([{ role: 'user', content: 'hi' }], { timeoutMs: 3000 });
      assert.equal(c.ok, true, `★ agent 模式缺 model 不应报 config：${JSON.stringify(c.error || '')}`);
      assert.equal(Object.prototype.hasOwnProperty.call(got, 'model'), false,
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
      // 基础算力（openai-compatible + target:model + 内置 model 为空 = lmstudio）⇒ 校验服务标识 ⇒ config 错
      const r = await invoke('chat', { messages: 'hi' }, { profile: 'lmstudio', baseUrl: stub.base });
      assert.equal(r.ok, false, '★ 基础算力缺服务标识（model）应失败');
      assert.equal(r.error.kind, 'config');
      // 智能体模式（同 profile，target:agent）⇒ **不校验**服务标识 ⇒ 只要能联通即准入
      const r2 = await invoke('chat', { messages: 'hi' }, { profile: 'lmstudio', target: 'agent', baseUrl: stub.base });
      assert.equal(r2.ok, true, `★ agent 模式不校验服务标识（缺 model 也能联通）：${JSON.stringify(r2.error || '')}`);
    });
  } finally { await stub.close(); }
});

// ── 运行器 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/llm-api.test.mjs —— 开放式 LLM API 模块 纯逻辑 / 离线测试'));
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
