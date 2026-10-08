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
 *   ① resolveConfig 优先级（显式 > env > 运行时线索 > 覆盖文件 > 内置默认）+ 超时钳制 + 头合并；
 *   ② ★★ 容错 8 类（每类独立夹具）：unreachable / timeout / auth(401,403) / rate-limit(429) /
 *      http-error(500) / bad-json / bad-shape / empty-output；
 *   ③ chat() 成功路径（OpenAI 格式）、anthropic 路径、custom（自定义 path + extract）；
 *   ④ validate() 三步（reachable / auth / shape）各自失败一条 + 全通过一条；
 *   ⑤ ★ 密钥不外泄（假 key 不出现在 listProfiles()/validate() 输出里，且响应体回显也被脱敏）；
 *   ⑥ listModels() 成功 / 失败；覆盖文件读写（§八）。
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
  PROFILES, listProfiles, resolveConfig, validate, chat, listModels,
  maskKey, overrideFilePath, readOverride, saveOverride, maskedConfig, previewProfile,
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
const ENV_KEYS = ['LEMO_LLM_PROFILE', 'LEMO_LLM_BASE', 'LEMO_LLM_KEY', 'LEMO_LLM_MODEL',
  'LEMO_LLM_HEADERS', 'LEMO_LLM_TIMEOUT_MS', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL',
  'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL'];
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
test('★ resolveConfig：显式 > env > 运行时线索 > 覆盖文件 > 内置默认（逐级验证）', async () => {
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

  // ③ 运行时线索（只读环境，不读密钥文件）
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

  // ④ 覆盖文件（保存的配置）压过内置默认；⑤ env 压过覆盖文件
  //   ★ 必须清掉环境（本机真实环境里就设了 ANTHROPIC_*，不清会让运行时线索压过覆盖文件 —— 那是**预期**的优先级）。
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

      // 缺 model（workbuddy 的 model 不再硬写 ⇒ 空 ⇒ 明确报缺）
      const r2 = await validate({ profile: 'workbuddy', baseUrl: stub.base, apiKey: 'sk-test-1234567890' });
      assert.equal(r2.ok, false);
      assert.equal(r2.profile, 'workbuddy');
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
    assert.equal(wb.kind, 'anthropic');
    assert.equal(wb.baseUrl, '', '干净环境下 workbuddy 的 baseUrl 应为空（不硬写）');
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
