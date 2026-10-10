#!/usr/bin/env node
/**
 * test/triple-check-flow.test.mjs —— `lib/triple-check.mjs` 的 **verifyTriple() 主流程**端到端测试
 * （零第三方依赖，桩 LM Studio，绝不加载真实 7B 模型）
 *
 * ★ 为什么必须有这一份：
 *   `test/triple-check.test.mjs` 只测了 5 个纯逻辑函数（buildPrompt / parseVerdict /
 *   sampleTimes / nearestCueText / decide），**verifyTriple() 主流程一条都没测** ——
 *   因为它依赖真模型（抽帧 → 调 VLM → 出报告），此前无法在无模型环境下跑。
 *   但 `LM_BASE` 是在模块加载时读 `process.env.LEMO_LMSTUDIO_BASE` 的，所以只要
 *   **在 import 之前**把环境变量指到一个**桩服务器**，就能端到端跑通整条主流程。
 *
 * ★★ 第一条纪律：绝不加载真实模型
 *   · 桩监听内核分配的空闲端口（listen(0)），**绝不**连 127.0.0.1:12345
 *     （那是用户真实的 LM Studio；本项目有过真实事故：7B 常驻显存 ⇒ Index-TTS 静默挂死一个多小时）。
 *   · `process.env.LEMO_LMSTUDIO_BASE` **必须在 `await import('../lib/triple-check.mjs')` 之前**设好。
 *     ESM 静态 import 会被提升，所以本文件**不**用顶层静态 import 引 triple-check，一律 `await import()`。
 *   · 用例 ② 与末行断言会把「模块实际用的 LM_BASE == 桩地址」钉死，作为「只打了桩端口」的证据。
 *
 * ★ 本测试用 WSL 的 ffmpeg 造一条极小的测试成片（3s / 320x240 / 纯色）+ 同目录 film.srt。
 *   若 WSL / ffmpeg 不可用 ⇒ **明确失败（退出码 1）并说明环境缺失**，绝不静默跳过。
 *
 * 用法：node test/triple-check-flow.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 输出 ────────────────────────────────────────────────────────
const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

// ── 桩 LM Studio 服务器 ─────────────────────────────────────────
// 端点契约（读 lib/triple-check.mjs 确认）：
//   POST /v1/chat/completions                        → {choices:[{message:{content}}]}（内容由 state.mode 控制）
//                                                      ★ mode='notext' / 'emptytext' 见下（用例⑪：取不到文本）
//   GET  /api/v0/models/qwen2.5-vl-7b-official       → {state:'loaded'}（让 ensureModelLoaded 立刻返回）
//   POST /api/v1/models/unload                       → 200 {}（主卸载路径，记录命中次数）
//   POST /api/v0/models/qwen2.5-vl-7b-official/unload→ 200 {}（兜底路径）
function startStub() {
  const state = {
    mode: 'consistent',        // 'consistent' | 'garbage' | 'http500'
    fixedText: '你好世界',      // 桩「从画面上读到」的字（= 真实烧录字幕，篡改用例里它保持不变）
    unloaded: false,           // GET state 的返回依据（true → 'not-loaded'，让 unloadModel 的复核通过）
    unloadV1FakeFail: false,   // true → v1 卸载返回 200 + {error:...}（假成功）⇒ 触发 v0 兜底
    frameRequests: 0,          // 真正的「每帧一次」chat 请求数（不含 ensureModelLoaded 的预热触发）
    chatBodies: [],            // 每次帧 chat 请求的**请求体**（供断言 2 张图 / 提示词含字幕）
    unloadV1: 0,
    unloadV0: 0,
    statePolls: 0,
    otherHits: [],
  };

  const readBody = (req) => new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => { b += d; });
    req.on('end', () => resolve(b));
  });
  const sendJson = (res, code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  const server = http.createServer(async (req, res) => {
    const p = String(req.url || '').split('?')[0];
    const m = req.method;

    if (m === 'GET' && p === '/api/v0/models/qwen2.5-vl-7b-official') {
      state.statePolls++;
      return sendJson(res, 200, { state: state.unloaded ? 'not-loaded' : 'loaded' });
    }
    if (m === 'POST' && p === '/api/v1/models/unload') {
      state.unloadV1++;
      await readBody(req);
      if (state.unloadV1FakeFail) return sendJson(res, 200, { error: 'Unexpected endpoint or method' });
      state.unloaded = true;
      return sendJson(res, 200, {});
    }
    if (m === 'POST' && p === '/api/v0/models/qwen2.5-vl-7b-official/unload') {
      state.unloadV0++;
      await readBody(req);
      state.unloaded = true;
      return sendJson(res, 200, {});
    }
    if (m === 'POST' && p === '/v1/chat/completions') {
      const raw = await readBody(req);
      let body = null;
      try { body = JSON.parse(raw); } catch { /* ignore */ }
      // 只把「帧请求」计入：askVlm 的 messages[1].content 是数组；ensureModelLoaded 的预热触发
      // 只有 messages[0]（content 是字符串 'ok'），必须排除掉。
      const isFrame = !!(body && Array.isArray(body.messages) && Array.isArray(body.messages[1]?.content));
      if (isFrame) { state.frameRequests++; state.chatBodies.push(body); }

      if (state.mode === 'http500') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('stub: simulated 500');
      }
      // ★ 用例⑪：200 但**取不到判定文本**。'notext' 模拟 LM Studio 那种「HTTP 200 + body 是
      //   {"error":…}」的**假成功**形状（`lib/llm-api.mjs` 的 chat() 归一为 bad-shape）；
      //   'emptytext' 是 200 + 空 content（归一为 empty-output）。二者都**必须**落成「存疑 + errors」。
      if (state.mode === 'notext') return sendJson(res, 200, { error: 'Unexpected endpoint or method' });
      if (state.mode === 'emptytext') return sendJson(res, 200, { choices: [{ message: { content: '   ' } }] });
      const content = state.mode === 'garbage'
        ? '我不知道'
        : JSON.stringify({ image_text: state.fixedText });
      return sendJson(res, 200, { choices: [{ message: { content } }] });
    }

    state.otherHits.push(`${m} ${p}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`stub: not found ${m} ${p}`);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, state }));
  });
}

// ── 起桩 → 设环境变量 → 动态 import（★ 顺序绝不能反）──────────────
const { server: STUB, port: STUB_PORT, state: STUB_STATE } = await startStub();
const STUB_ORIGIN = `http://127.0.0.1:${STUB_PORT}`;
// ★ 第二个桩：扮演「面板里当前生效的那套算力服务」（与本机 LM Studio 桩分开 ⇒ 能区分到底打到了谁）。
const { server: PANEL_STUB, port: PANEL_PORT, state: PANEL_STATE } = await startStub();
const PANEL_ORIGIN = `http://127.0.0.1:${PANEL_PORT}`;
process.env.LEMO_LMSTUDIO_BASE = STUB_ORIGIN;   // ★ 必须在 import triple-check 之前

// ★★ 成片根（= LLM 覆盖文件 `_llm-api.json` 所在）也必须在 import 之前指到临时树 ——
//   `askVlm()` 的「面板优先」会读「当前生效的算力服务」，若成片根还是默认的 `D:\lemo-films`，
//   就会去读用户**真实**的 `_llm-api.json`（含真实密钥）⇒ 既可能外泄、也可能真发请求。
//   ★ 每进程唯一（带 pid）：与下方 `TMP_ROOT` 同源；`prepareFixture()` 开头重建、末行清理。
const TMP_ROOT = path.join(ROOT, `.tmp-triple-flow-${process.pid}`);
process.env.LEMO_FILM_DIR = TMP_ROOT;
// ★ 清掉外部 LLM 覆盖点（若有），免得它们插在「覆盖文件」之上、把面板服务遮蔽掉。
for (const k of ['LEMO_LLM_PROFILE', 'LEMO_LLM_BASE', 'LEMO_LLM_KEY', 'LEMO_LLM_MODEL',
  'LEMO_LLM_HEADERS', 'LEMO_LLM_TIMEOUT_MS']) delete process.env[k];

const tc = await import('../lib/triple-check.mjs');
const { verifyTriple, sampleTimes, LM_BASE } = tc;
// ★ 面板服务的写入口（`askVlm()` 走的就是这套「当前生效的算力服务」）。
const llm = await import('../lib/llm-api.mjs');
const { saveService, setActiveService } = llm;
const dc = await import('../lib/dub-core.mjs');
const { runWsl, winToWsl, shq, parseSrt } = dc;

// ── 测试夹具（非 C 盘）───────────────────────────────────────────
// ★ `TMP_ROOT` 已在**上方 import 之前**定义（`LEMO_FILM_DIR` 要用它，必须先设）—— 此处只定义它的子路径。
//   ★ 根目录**按进程唯一**（带 `process.pid`）：`prepareFixture()` 开头 `rmSync(TMP_ROOT)` 重建、
//     末尾 `rmSync(TMP_ROOT)` 清理 ⇒ 写死共享路径时两个进程同时跑会互删对方成片/字幕
//     （实测并发：一进程 10/1 failed，单独跑 11 passed）。
const FILM = path.join(TMP_ROOT, 'film.mp4');
const SRT = path.join(TMP_ROOT, 'film.srt');
const OUT = path.join(TMP_ROOT, 'out');
const EMPTY_DIR = path.join(TMP_ROOT, 'empty');
const EMPTY_MP4 = path.join(EMPTY_DIR, 'empty.mp4');
const SRT_TEXT = '1\n00:00:00,000 --> 00:00:03,000\n你好世界\n';
const SCRIPT_TEXT = '你好世界，这是一个测试。';
const FIXED = '你好世界';

function resetStub({ mode = 'consistent', fixedText = FIXED, unloadV1FakeFail = false } = {}) {
  STUB_STATE.mode = mode;
  STUB_STATE.fixedText = fixedText;
  STUB_STATE.unloadV1FakeFail = unloadV1FakeFail;
  STUB_STATE.unloaded = false;          // ★ 每次都要复位：否则 ensureModelLoaded 会一直等到超时
  STUB_STATE.frameRequests = 0;
  STUB_STATE.chatBodies = [];
  STUB_STATE.unloadV1 = 0;
  STUB_STATE.unloadV0 = 0;
  STUB_STATE.statePolls = 0;
}

/** 复位「面板桩」到一致模式并清计数（用例⑫⑬ 用）。 */
function resetPanelStub() {
  PANEL_STATE.mode = 'consistent';
  PANEL_STATE.fixedText = FIXED;
  PANEL_STATE.unloaded = false;
  PANEL_STATE.frameRequests = 0;
  PANEL_STATE.chatBodies = [];
}

/**
 * 在临时成片根里写一套「当前生效」的算力服务并切过去 —— `askVlm()` 的「面板优先」路径就走它。
 * ★ 默认指向本机桩 `STUB`（既有用例①-⑪ 的桩断言因此保持不变）；用例⑫⑬ 会改成面板桩 / 不可达地址。
 * @param {string} baseUrl 该服务的 baseUrl（形如 `http://127.0.0.1:PORT/v1`）
 */
function setPanelService(baseUrl) {
  const r = saveService({ id: 'panel-svc', label: 'panel', kind: 'openai-compatible', target: 'model', baseUrl, model: 'qwen2.5-vl-7b-official', apiKey: 'sk-test', timeoutMs: 30000 });
  if (!r.ok) throw new Error(`saveService 失败：${JSON.stringify(r.error)}`);
  const a = setActiveService('panel-svc');
  if (!a.ok) throw new Error(`setActiveService 失败：${JSON.stringify(a.error)}`);
}

async function prepareFixture() {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(EMPTY_DIR, { recursive: true });
  fs.writeFileSync(SRT, SRT_TEXT, 'utf8');
  fs.writeFileSync(EMPTY_MP4, Buffer.alloc(0));   // 零字节：ffprobe 读不出时长，且同目录无 film.srt

  const cmd = `ffmpeg -hide_banner -nostdin -y -f lavfi -i color=c=0x223344:s=320x240:d=3:r=25 `
    + `-pix_fmt yuv420p -c:v libx264 -preset ultrafast ${shq(winToWsl(FILM))}`;
  const r = await runWsl(cmd, { name: 'triple-mkfilm' });
  if (r.code !== 0 || !fs.existsSync(FILM)) {
    throw new Error(`环境缺失：WSL ffmpeg 无法生成测试成片（exit=${r.code}）\n  ${String(r.stderr).slice(0, 400)}`);
  }
}

const closeStub = () => new Promise((r) => STUB.close(() => r()));
const closePanelStub = () => new Promise((r) => PANEL_STUB.close(() => r()));

/** 复现 verifyTriple 的抽帧计划（用它自己算出的 filmDur）—— 用于断言「帧数 == 计划数」。 */
function planOf(rep, maxFrames) {
  const cues = parseSrt(fs.readFileSync(SRT, 'utf8'));
  return sampleTimes({ cues, filmDur: rep.filmDur, maxFrames });
}

// ── 用例 ────────────────────────────────────────────────────────

test('★ 只打桩端口：模块实际使用的 LM_BASE 指向桩（绝不是 127.0.0.1:12345）', async () => {
  assert.equal(LM_BASE, STUB_ORIGIN, `★ triple-check 实际用的 LM_BASE 必须是桩地址，实得 ${LM_BASE}`);
  assert.ok(!/127\.0\.0\.1:12345|localhost:12345/.test(LM_BASE), '★ 绝不能指向用户真实的 LM Studio 端口');
});

test('① 全一致：桩回填该帧字幕 ⇒ overall=一致、errors 空、frames.length=计划数、每帧 verdict=一致', async () => {
  resetStub({ mode: 'consistent' });
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true });

  assert.equal(rep.overall, '一致', `overall 应为一致，实得 ${rep.overall}`);
  assert.deepEqual(rep.errors, [], `errors 应为空，实得 ${JSON.stringify(rep.errors)}`);
  assert.equal(rep.cueSource, 'film.srt', '★ 时间轴应来自同目录 film.srt');
  assert.ok(rep.frames.length >= 2, `帧数应 ≥2（保证非平凡），实得 ${rep.frames.length}`);

  const plan = planOf(rep, 8);
  assert.equal(rep.frames.length, plan.length, `★ frames.length 必须等于抽帧计划数 ${plan.length}`);
  for (const f of rep.frames) {
    assert.equal(f.verdict, '一致', `第 ${f.i} 帧应一致，实得 ${f.verdict}（${f.reason}）`);
    assert.equal(f.subtitle, FIXED, '该帧字幕应来自 film.srt 的 cue 文本');
    assert.equal(f.imageText, FIXED, 'imageText 应是桩回填的字幕');
  }
  assert.equal(rep.mismatches.length, 0);
  assert.equal(rep.doubtful.length, 0);
});

test('② ★ 每帧喂 2 张图：messages[1].content 里有 2 个 image_url，且提示词带上了该帧字幕', async () => {
  resetStub({ mode: 'consistent' });
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true });

  assert.equal(STUB_STATE.frameRequests, rep.frames.length,
    `桩收到的帧请求数应等于帧数（每帧 1 次），实得 ${STUB_STATE.frameRequests} vs ${rep.frames.length}`);
  assert.ok(STUB_STATE.chatBodies.length >= 2, '至少应有 2 条帧请求体可供检查');

  for (const b of STUB_STATE.chatBodies) {
    const content = b.messages[1].content;
    const imgs = content.filter((c) => c.type === 'image_url');
    assert.equal(imgs.length, 2, `★ 每帧必须喂 2 张图（整帧 + 字幕条裁剪），实得 ${imgs.length}`);
    assert.ok(imgs[0].image_url.url.startsWith('data:image/png;base64,'), '附图应是 base64 png data URL');
    assert.notEqual(imgs[0].image_url.url, imgs[1].image_url.url, '两张附图内容必须不同（整帧 vs 裁剪）');

    const prompt = content[0].text;
    assert.ok(prompt.includes(`【该时刻字幕文本】${FIXED}`), '★ 提示词里必须带上该帧字幕文本');

    // ★ 迁移等价（2026-10-08）：请求体里的模型 / 采样参数 / 流式开关 / system 消息，必须与
    //   迁移前 `askVlm` 自拼的**逐字段相同**（迁移前硬编码的就是这一组值）。
    assert.equal(b.model, 'qwen2.5-vl-7b-official', '★ 只准用这个模型，不许换');
    assert.equal(b.temperature, 0, '★ temperature:0 必须保留（迁移前硬编码该值）');
    assert.equal(b.max_tokens, 400, '★ max_tokens:400 必须保留');
    assert.equal(b.stream, false, 'stream:false 必须保留');
    assert.equal(b.messages[0].role, 'system', 'system 消息必须仍在（迁移前同形）');
    assert.equal(b.messages[0].content,
      '你是严格的画面字幕抄录器，只输出 JSON 抄录结果，禁止任何创作、改写与判断。', 'system 文案必须逐字不变');
  }
});

test('★ ②b profile 名不再影响 VLM 调用：LEMO_LLM_PROFILE 换成已删名 / 垃圾名，帧请求体逐字不变', async () => {
  // 回归（2026-10-09）：`askVlm()` 曾显式传 `profile:'lmstudio'`，而该内置 profile 已按委托方指令
  // 「只接 WorkBuddy」从 `PROFILES` 删除 ⇒ resolveConfig 走「未知 profile」兜底、名字**悬空**。
  // 现改为「不挂 profile、只钉 kind/baseUrl/model/target:'model'」的纯显式配置 ⇒
  // 本用例证明这次调用**完全不受 profile 名影响**（换任何 profile 名，请求体逐字相同）。
  // ★ 顺带钉死 `target:'model'` 的必要性：若漏给 target，id 会落到默认 profile workbuddy 的 'agent'
  //   ⇒ body 里的 model 被丢 ⇒ 下面的 `b.model` 断言会失败。
  const prev = process.env.LEMO_LLM_PROFILE;
  const run = async (val) => {
    if (val === undefined) delete process.env.LEMO_LLM_PROFILE; else process.env.LEMO_LLM_PROFILE = val;
    resetStub({ mode: 'consistent' });
    const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true, maxFrames: 1 });
    assert.equal(rep.frames.length, 1, 'maxFrames=1 ⇒ 恰好 1 帧');
    assert.equal(STUB_STATE.chatBodies.length, 1, '应恰好 1 条帧请求体');
    return JSON.stringify(STUB_STATE.chatBodies[0]);
  };
  try {
    const base = await run(undefined);        // 未设 ⇒ 内部落到默认 profile（workbuddy）
    const deleted = await run('lmstudio');    // 已删的内置 profile 名
    const junk = await run('__no_such_profile__');
    assert.equal(deleted, base, '★ LEMO_LLM_PROFILE=lmstudio（已删名）时帧请求体必须与默认逐字相同');
    assert.equal(junk, base, '★ 任意未知 profile 名都不得改变帧请求体');
    const b = JSON.parse(base);
    assert.equal(b.model, 'qwen2.5-vl-7b-official',
      '★ model 必须显式钉死（不随 profile 漂）—— 若这里为空说明 target 没钉成 model');
    assert.equal(b.temperature, 0, '★ temperature:0 必须保留');
    assert.equal(b.max_tokens, 400, '★ max_tokens:400 必须保留');
    assert.equal(b.stream, false, 'stream:false 必须保留');
  } finally {
    if (prev === undefined) delete process.env.LEMO_LLM_PROFILE; else process.env.LEMO_LLM_PROFILE = prev;
  }
});

test('③ 篡改必被抓：tamper 第 1 帧 ⇒ 该帧 不一致 + tampered，overall=不一致、mismatches 非空', async () => {
  resetStub({ mode: 'consistent' });   // 桩仍回填「真实烧录字幕」，与被篡改的「字幕文本」不同
  const rep = await verifyTriple({
    filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true,
    tamper: { i: 1, text: '完全不同的字幕' },
  });

  const f1 = rep.frames.find((f) => f.i === 1);
  assert.ok(f1, '第 1 帧应存在');
  assert.equal(f1.tampered, true, '第 1 帧应标记 tampered');
  assert.equal(f1.subtitle, '完全不同的字幕', '喂给模型的字幕文本应是篡改后的文本');
  assert.equal(f1.verdict, '不一致', `第 1 帧应判不一致，实得 ${f1.verdict}`);
  assert.equal(rep.overall, '不一致');
  assert.ok(rep.mismatches.length >= 1, 'mismatches 应非空');
  assert.ok(rep.mismatches.some((m) => m.i === 1), 'mismatches 应含第 1 帧');
});

test('④ 桩返回垃圾（"我不知道"）⇒ 该帧 存疑（parseVerdict 兜底，绝不判一致）、overall=存疑', async () => {
  resetStub({ mode: 'garbage' });
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true });

  assert.ok(rep.frames.length >= 1);
  for (const f of rep.frames) {
    assert.equal(f.verdict, '存疑', `★ 读不到字必须判存疑，实得 ${f.verdict}`);
    assert.notEqual(f.verdict, '一致', '★ 绝不许兜底成一致');
    assert.equal(f.imageText, '', '解析不了 ⇒ imageText 必须空串');
  }
  assert.equal(rep.overall, '存疑', `overall 应为存疑，实得 ${rep.overall}`);
  assert.ok(rep.doubtful.length >= 1, 'doubtful 应非空');
});

test('⑤ 桩连续 500 ⇒ 该帧 errors 有记录、verdict=存疑、ok=false；且桩收到 4 次 chat（(面板+回落)×重试）', async () => {
  resetStub({ mode: 'http500' });
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true, maxFrames: 1 });

  assert.equal(rep.frames.length, 1, 'maxFrames=1 ⇒ 恰好 1 帧');
  const f = rep.frames[0];
  assert.equal(f.verdict, '存疑');
  assert.ok(f.error, '失败帧应记录 error');
  assert.equal(rep.ok, false, '有 errors ⇒ ok=false');
  assert.ok(rep.errors.length >= 1, 'errors 应有记录');
  // ★ 请求数已随「面板优先 + 回落」变成 4：每次 `askVlm` = 面板(1) + 失败后回落本机(1) = 2；
  //   `askVlmRetry` 再整体重试一遍 ⇒ 2×2 = 4。★ 这是**新语义**（见 lib/triple-check.mjs 的 askVlm 注释），
  //   不是放宽断言 —— 仍钉死精确次数，只是口径从「1+1」变成「(1+1)×2」。
  assert.equal(STUB_STATE.frameRequests, 4, `★ 应恰好 4 次 chat 请求（(面板1+回落1)×重试2），实得 ${STUB_STATE.frameRequests}`);

  // ★ 全部帧都失败时，卸载仍必须被调用（verifyTriple 里 unloadModel 在循环之后、无论成败都执行）
  assert.ok(STUB_STATE.unloadV1 >= 1, '★ 全部帧失败时 unload 也必须被调用');
});

test('★ ⑥ 卸载必被调用（显存红线）：正常用例 unload v1 命中 ≥1 且复核 unloadOk=true', async () => {
  resetStub({ mode: 'consistent' });
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true });

  assert.ok(STUB_STATE.unloadV1 >= 1, `★ POST /api/v1/models/unload 命中次数应 ≥1，实得 ${STUB_STATE.unloadV1}`);
  assert.equal(rep.vram.unloadOk, true, '卸载后复核应通过（桩 GET state 返回 not-loaded）');
});

test('★ ⑩ 兜底：v1 卸载返回「200 + {"error":...}」假成功 ⇒ 回落到 v0 卸载端点', async () => {
  resetStub({ mode: 'consistent', unloadV1FakeFail: true });
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true });

  assert.ok(STUB_STATE.unloadV1 >= 1, 'v1 端点应被打过');
  assert.ok(STUB_STATE.unloadV0 >= 1, `★ v1 假成功 ⇒ 必须回落 v0，实得 unloadV0=${STUB_STATE.unloadV0}`);
  assert.equal(rep.vram.unloadOk, true);
});

test('★ ⑪ 取不到判定文本（200 + {"error":…} 的「假成功」形状 / 200 + 空 content）⇒ 该帧 存疑 + errors、ok=false（**绝不**静默当成一致）', async () => {
  // ★ 这条钉的是「迁移不得把『取不到文本当失败』这个坑带丢」：
  //   迁移前 askVlm 自己看 HTTP 码（200 就以为成功）；迁移后由 `lib/llm-api.mjs` 的 chat() 归一为
  //   `bad-shape`（200 但响应里取不到文本路径）/ `empty-output`（取到空串）—— 二者都**必须**
  //   在 verifyTriple 里落成「存疑 + errors[]」，**不得**变成「一致」。
  //   ★ 与显存红线里那个实测坑同型：LM Studio 的端点会「HTTP 200 但 body 是 {"error":…}」⇒ 光看状态码会被骗。
  for (const mode of ['notext', 'emptytext']) {
    resetStub({ mode });
    const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true, maxFrames: 1 });

    assert.equal(rep.frames.length, 1, `${mode}: maxFrames=1 ⇒ 恰好 1 帧`);
    const f = rep.frames[0];
    assert.equal(f.verdict, '存疑', `★ ${mode}: 取不到文本必须判「存疑」，实得 ${f.verdict}`);
    assert.notEqual(f.verdict, '一致', `★ ${mode}: 绝不许把「取不到文本」静默当成「一致」`);
    assert.ok(!f.imageText, `${mode}: 取不到文本 ⇒ 该帧不得有 OCR 文本（imageText 应为空/缺省）`);
    assert.ok(f.error, `${mode}: 失败帧应记录 error`);
    assert.match(f.error, /bad-shape|empty-output/,
      `★ ${mode}: error 应来自 llm-api 的归一化（bad-shape / empty-output），实得 ${f.error}`);
    assert.equal(rep.ok, false, `${mode}: 有 errors ⇒ ok=false`);
    assert.ok(rep.errors.length >= 1, `${mode}: errors 应有记录`);
    assert.equal(rep.overall, '存疑', `${mode}: overall 应为存疑，实得 ${rep.overall}`);
    // ★ 同用例⑤：面板(1)+回落本机(1) × 重试(2) = 4（新语义，非放宽）。
    assert.equal(STUB_STATE.frameRequests, 4, `★ ${mode}: 应恰好 4 次 chat（(面板1+回落1)×重试2），实得 ${STUB_STATE.frameRequests}`);
  }
});

test('⑦ 报告落盘：<outDir>/triple-check.json 存在、可 JSON.parse、含必需字段', async () => {
  resetStub({ mode: 'consistent' });
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true });

  assert.equal(rep.report, path.join(OUT, 'triple-check.json'), 'report 路径应是 <outDir>/triple-check.json');
  assert.ok(fs.existsSync(rep.report), '报告文件应存在');
  const j = JSON.parse(fs.readFileSync(rep.report, 'utf8'));
  for (const k of ['overall', 'frames', 'mismatches', 'doubtful', 'errors', 'vram', 'ms']) {
    assert.ok(k in j, `报告应含字段 ${k}`);
  }
  assert.ok(Array.isArray(j.frames) && j.frames.length >= 1);
  assert.equal(typeof j.ms, 'number');
  assert.ok(j.vram && 'beforeMiB' in j.vram && 'afterMiB' in j.vram && 'unloadOk' in j.vram);
});

test('⑧ 成片不存在 ⇒ verifyTriple 抛错（消息含「成片不存在」）', async () => {
  await assert.rejects(
    () => verifyTriple({ filmHost: path.join(TMP_ROOT, 'does-not-exist.mp4'), quiet: true }),
    /成片不存在/,
  );
});

test('⑨ 抽帧计划为空 ⇒ verifyTriple 抛错（消息含「抽帧计划为空」）', async () => {
  // 零字节 mp4（ffprobe 读不出时长）+ 同目录无 film.srt / timeline.json ⇒ 拿不到时长也拿不到时间轴
  await assert.rejects(
    () => verifyTriple({ filmHost: EMPTY_MP4, outDir: path.join(EMPTY_DIR, 'out'), quiet: true }),
    /抽帧计划为空/,
  );
});

// ── ★★ 本批验收用例（「算力全局可用 / 面板优先」）───────────────────────────
test('★ ⑫ 面板优先：面板那套可达 ⇒ 只打面板桩、本机 LM 桩 0 条、frame.via=panel', async () => {
  // 由来（委托方规格）：「AI 算力板块内接入的所有模型为项目全局可用，项目里全部业务功能都可以使用该算力……
  //   算力配置修改、模型切换之后，全局所有业务同步生效」。⇒ `askVlm()` 必须**面板优先**。
  //   改前：`askVlm` 给 `chat()` 传显式 target/kind/baseUrl/model（优先级①）⇒ 把面板（③）压掉 ⇒ 本用例必红。
  resetStub({ mode: 'consistent' });
  resetPanelStub();
  setPanelService(`${PANEL_ORIGIN}/v1`);      // 面板当前生效 → 面板桩
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true, maxFrames: 1 });

  assert.equal(rep.frames.length, 1, 'maxFrames=1 ⇒ 恰好 1 帧');
  assert.equal(PANEL_STATE.frameRequests, 1, `★ 面板桩应收到 1 条帧请求，实得 ${PANEL_STATE.frameRequests}`);
  assert.equal(STUB_STATE.frameRequests, 0, `★ 面板可达时**不得**打本机 LM 桩，实得 ${STUB_STATE.frameRequests}`);
  assert.equal(rep.frames[0].via, 'panel', `★ via 应为 panel（走了面板路径），实得 ${rep.frames[0].via}`);
  assert.equal(rep.frames[0].verdict, '一致', '面板桩回填该帧字幕 ⇒ 应判一致');
  setPanelService(`${STUB_ORIGIN}/v1`);       // 复位，避免影响后续用例
});

test('★ ⑬ 回落：面板那套不可达 ⇒ 回落本机 LM 桩、frame.via=local-vlm、带回面板侧失败原因', async () => {
  // 理由：画面校验需要「多模态图片输入」，面板那套可能是纯文本模型；委托方明令「核心能力不可删减」
  //   ⇒ 面板路径失败时**必须**回落本机 VLM，且**如实标注**走了哪条路（绝不静默）。
  resetStub({ mode: 'consistent' });
  resetPanelStub();
  setPanelService('http://127.0.0.1:1/v1');   // 没人监听 ⇒ 连接被拒（不可达）
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true, maxFrames: 1 });

  assert.equal(rep.frames.length, 1, 'maxFrames=1 ⇒ 恰好 1 帧');
  assert.equal(PANEL_STATE.frameRequests, 0, '面板不可达 ⇒ 面板桩不应收到帧请求');
  assert.equal(STUB_STATE.frameRequests, 1, `★ 应回落到本机 LM 桩 1 次，实得 ${STUB_STATE.frameRequests}`);
  assert.equal(rep.frames[0].via, 'local-vlm', `★ via 应为 local-vlm（回落成功），实得 ${rep.frames[0].via}`);
  assert.ok(rep.frames[0].panelError, '★ 回落时必须带回面板侧失败原因（绝不静默）');
  assert.match(String(rep.frames[0].panelError), /unreachable|无法连接|connect/i,
    `面板侧失败原因应可读，实得 ${rep.frames[0].panelError}`);
  setPanelService(`${STUB_ORIGIN}/v1`);       // 复位
});

// ── 运行器 ──────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/triple-check-flow.test.mjs —— verifyTriple() 主流程端到端（桩 LM Studio）'));
  log(C.dim(`  本机桩 ${STUB_ORIGIN} / 面板桩 ${PANEL_ORIGIN}   （★ 绝不连 127.0.0.1:12345）`));
  log(C.dim(`  临时成片根 ${TMP_ROOT}（LLM 覆盖文件也在此，★ 绝不碰 D:\\lemo-films\\_llm-api.json）`));
  log('');

  try {
    await prepareFixture();
    // ★ 写「当前生效」的算力服务（默认指向本机桩）—— `askVlm()` 的「面板优先」路径从此打到桩。
    setPanelService(`${STUB_ORIGIN}/v1`);
  } catch (e) {
    log(C.bad(`  ✗ 环境缺失，无法继续：${e.message}`));
    log(C.bad('  本测试需要 WSL + ffmpeg/ffprobe。请先确认 `wsl -d Ubuntu-24.04 -- ffmpeg -version` 可用。'));
    await closeStub();
    await closePanelStub();
    process.exitCode = 1;
    return;
  }
  log(C.dim(`  测试成片 ${FILM}`));
  log('');

  const results = [];
  try {
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
  } finally {
    await closeStub();
    await closePanelStub();
    try { fs.rmSync(TMP_ROOT, { recursive: true, force: true }); } catch { /* ignore */ }
  }

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
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
