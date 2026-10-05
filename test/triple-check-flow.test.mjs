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
process.env.LEMO_LMSTUDIO_BASE = STUB_ORIGIN;   // ★ 必须在 import triple-check 之前

const tc = await import('../lib/triple-check.mjs');
const { verifyTriple, sampleTimes, LM_BASE } = tc;
const dc = await import('../lib/dub-core.mjs');
const { runWsl, winToWsl, shq, parseSrt } = dc;

// ── 测试夹具（非 C 盘）───────────────────────────────────────────
const TMP_ROOT = path.join(ROOT, '.tmp-triple-flow');
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

test('⑤ 桩连续 500 ⇒ 该帧 errors 有记录、verdict=存疑、ok=false；且桩收到 2 次 chat（重试真的发生）', async () => {
  resetStub({ mode: 'http500' });
  const rep = await verifyTriple({ filmHost: FILM, scriptText: SCRIPT_TEXT, outDir: OUT, quiet: true, maxFrames: 1 });

  assert.equal(rep.frames.length, 1, 'maxFrames=1 ⇒ 恰好 1 帧');
  const f = rep.frames[0];
  assert.equal(f.verdict, '存疑');
  assert.ok(f.error, '失败帧应记录 error');
  assert.equal(rep.ok, false, '有 errors ⇒ ok=false');
  assert.ok(rep.errors.length >= 1, 'errors 应有记录');
  assert.equal(STUB_STATE.frameRequests, 2, `★ 应恰好 2 次 chat 请求（1 次 + 1 次重试），实得 ${STUB_STATE.frameRequests}`);

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

// ── 运行器 ──────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/triple-check-flow.test.mjs —— verifyTriple() 主流程端到端（桩 LM Studio）'));
  log(C.dim(`  桩地址 ${STUB_ORIGIN}   （★ 绝不连 127.0.0.1:12345）`));
  log('');

  try {
    await prepareFixture();
  } catch (e) {
    log(C.bad(`  ✗ 环境缺失，无法继续：${e.message}`));
    log(C.bad('  本测试需要 WSL + ffmpeg/ffprobe。请先确认 `wsl -d Ubuntu-24.04 -- ffmpeg -version` 可用。'));
    await closeStub();
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
