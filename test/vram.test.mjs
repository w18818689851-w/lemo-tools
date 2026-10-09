// test/vram.test.mjs —— `lib/vram.mjs` 的**第一份**测试（零依赖 / 全离线 / 不碰真 GPU、不碰真 LM Studio）
//
// ★ 为什么必须有这一份：
//   `lib/vram.mjs` 是「出片前的显存预检 + 自动腾挪」，管的是**本项目的常态瓶颈**——显存。
//   它此前是**唯一既没有专门闸门、也没有专门测试**的模块（`grep vram test/*.mjs` 命中的全是注释 /
//   覆盖点登记，没有一条真在测它）。而它坏掉的形式是**静默挂起**：LM Studio 模型常驻把显存吃到
//   7GB 之后，Index-TTS 会**静默挂死一个多小时**（2026-10 真实事故）。⇒ 用本文件把它钉住。
//
// ★ 测什么（分三层）：
//   ① **纯函数**（`vramShortfallMessage`）—— 吃一个对象、吐一个字符串，**完全不碰 GPU**。
//      这是本模块最大的一块逻辑：不足文案的算术（还差多少 / 放行值 = 可用-300）、
//      「已腾挪 / 未腾挪 / 没得卸」三种分支、以及**占用者诊断段**（聚合 / 截断 / WDDM 说明）。
//      其中有一条**契约**：occupants 缺省 ⇒ 输出必须与「加这段之前**逐字节一致**」。
//   ② **真读 GPU 的部分**（`vramFreeMiB` / `gpuOccupants`）—— ★ 用**进程内桩 `spawn`** 驱动
//      （见下方「桩怎么做的」），喂**固定的** nvidia-smi 输出，断言解析结果。
//   ③ **单一职责接口**（`ensureVramFree`）—— 桩 spawn + **桩 LM Studio 服务**（本地 http，
//      随机端口），把「够用直接放行 / 只查不腾 / 腾挪成功 / 腾挪后仍不足 / 渲染的 soft 策略」
//      五条路径全部离线跑通。
//
// ★★ 桩怎么做的（关键：`spawn('nvidia-smi')` **没有**可覆盖的路径 / 命令入口）：
//   `lib/vram.mjs` 里写死 `spawn('nvidia-smi', ...)`（无路径覆盖点、无 env 覆盖点），
//   所以**不能**用「临时目录放个假 nvidia-smi」那一招 —— 实测（本机 Node v22.22.2 / Windows）：
//     · `nvidia-smi.cmd` / `.bat` 放 PATH 最前 **不会被命中** —— 该模块用的是**无 shell** 的
//       `spawn`，`CreateProcess` 只认 `.exe`，于是**穿透到真卡**（实测返回了真读数 `651, 8188`）；
//     · 显式传 `.cmd` 全路径 ⇒ `spawn EINVAL`。
//   ⇒ 改用**模块级钩子**：`module.registerHooks()` 把 `node:child_process` 的 `spawn` 换成桩
//     （★ 只拦 `nvidia-smi`，**其它命令一律转发给真 spawn**，对进程内其它模块完全透明）。
//     这样跑的是 `lib/vram.mjs` **真实的**解析 / 聚合 / 判据代码，只把「操作系统进程」换掉。
//   ★ 注意：真 child_process 必须用 **CJS `createRequire`** 取（不能用顶层 `import`）——
//     顶层 `import 'node:child_process'` 会**先把内置模块灌进 ESM 缓存**，之后钩子就再也拦不到了。
//
// ★★ 桩 LM Studio 服务：`LM_BASE` 由 `LEMO_LMSTUDIO_BASE` 在**模块求值期**读入 ⇒ 必须在
//   `import '../lib/vram.mjs'` **之前**把 env 指到本测试自己起的 `127.0.0.1:<随机端口>`。
//   于是 `unloadModel()` / `lmLoadedModels()` 发的 POST/GET 全部落到桩上 ——
//   **绝不碰真的 LM Studio（12345）**、**绝不真的卸载任何模型**。
//
// ★ 纪律：
//   · **不真腾显存、不真卸载模型**：所有「卸载」都打到桩服务，桩只改内存里的一个数字。
//   · **不碰 C 盘、不落任何文件**：本文件全程在内存里（故无需临时目录）；仅在报告阶段做
//     反向验证时才用 `D:/lemo-tmp/vt-*` 并递归删。
//   · **不测「显存不足时真的去杀别人的进程」**：本模块根本没有这个能力（只卸载 LM Studio 的
//     常驻模型），故无此分支可测 —— 见文件末「覆盖不到的」。
//
// 用法：node test/vram.test.mjs
// 退出码：全绿 0，有失败 1。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { registerHooks, createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

// ══════════════════════════════════════════════════════════════════════════
//  一、桩：把 `spawn('nvidia-smi')` 换成「读内存里的固定读数」
// ══════════════════════════════════════════════════════════════════════════

const hasHooks = typeof registerHooks === 'function';   // Node ≥ 22.15；旧版则跳过 GPU 相关用例
const req = createRequire(import.meta.url);
const realCp = req('node:child_process');               // ★ CJS require：**不**污染 ESM 缓存

/** 桩的全部可变状态（每个用例前重置自己关心的那几个字段）。 */
const state = {
  gpu: { used: 400, total: 8192 },   // --query-gpu 读到的 used/total
  gpuOkReads: Infinity,              // 允许成功读到的次数；超出后一律返回「读不到」（null）
  gpuReads: 0,
  gpuUsedAfterUnload: null,          // 收到卸载 POST 后把 used 改成这个值（模拟显存回落）
  computeApps: '',                   // --query-compute-apps 的原始输出
  spawnCalls: 0,
};

/** 造一个「像 ChildProcess」的东西：EventEmitter + stdout/stderr 流 + kill()。 */
function fakeProc({ out = '', code = 0, err = null } = {}) {
  const p = new EventEmitter();
  p.stdout = new Readable({ read() {} });
  p.stderr = new Readable({ read() {} });
  p.kill = () => {};
  setImmediate(() => {
    if (err) { p.emit('error', err); return; }
    p.stdout.push(out);
    p.stdout.push(null);
    // ★ close 放到**再下一跳**，确保 'data' 已先冲刷（否则读到的 o 会是空串）
    setImmediate(() => p.emit('close', code));
  });
  return p;
}

/** 桩 spawn：**只拦 nvidia-smi**，其它命令原样转发给真 spawn（对进程内其它模块透明）。 */
function stubSpawn(cmd, args = [], opts) {
  const name = String(cmd);
  if (!/nvidia-smi(\.exe)?$/i.test(name)) return realCp.spawn(cmd, args, opts);
  state.spawnCalls++;
  const q = String(args[0] ?? '');
  if (q.startsWith('--query-gpu=')) {
    const n = state.gpuReads++;
    if (n >= state.gpuOkReads) return fakeProc({ out: '', code: 1 });   // 模拟 nvidia-smi 失败
    return fakeProc({ out: `${state.gpu.used}, ${state.gpu.total}\n` });
  }
  if (q.startsWith('--query-compute-apps=')) return fakeProc({ out: state.computeApps, code: 0 });
  return fakeProc({ out: '', code: 1 });
}
globalThis.__vtRealCp = realCp;
globalThis.__vtSpawn = stubSpawn;

if (hasHooks) {
  // 生成一个「转出真模块全部命名导出 + 只把 spawn 换掉」的替身模块源码
  const names = Object.keys(realCp).filter((k) => k !== 'spawn' && /^[A-Za-z_$][\w$]*$/.test(k));
  const SRC = [
    'const real = globalThis.__vtRealCp;',
    `const { ${names.join(', ')} } = real;`,
    `export { ${names.join(', ')} };`,
    // ★ 转发在**调用时**读 globalThis.__vtSpawn —— 用例里才能临时换一份桩
    'export const spawn = (...a) => (globalThis.__vtSpawn || real.spawn)(...a);',
    'export default real;',
  ].join('\n');
  registerHooks({
    resolve(spec, ctx, next) {
      return spec === 'node:child_process'
        ? { url: 'node:child_process', format: 'module', shortCircuit: true }
        : next(spec, ctx);
    },
    load(url, ctx, next) {
      return url === 'node:child_process'
        ? { format: 'module', source: SRC, shortCircuit: true }
        : next(url, ctx);
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  二、桩 LM Studio 服务（本地 127.0.0.1 随机端口；**不是**真的 12345）
// ══════════════════════════════════════════════════════════════════════════

const VLM = 'qwen2.5-vl-7b-official';
const ALL_MODELS = [VLM, 'other-model'];
const lm = { loaded: new Set(), unloadIds: [] };

const json = (res, code, obj) => {
  const b = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(b),
    Connection: 'close',                       // ★ 不留 keep-alive，避免进程不退出
  });
  res.end(b);
};
const readBody = (rq) => new Promise((resolve) => {
  let s = '';
  rq.on('data', (d) => { s += d; });
  rq.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } });
});

const lmServer = http.createServer(async (rq, rs) => {
  const url = rq.url || '';
  if (rq.method === 'GET' && url === '/api/v0/models') {
    return json(rs, 200, {
      data: ALL_MODELS.map((id) => ({ id, state: lm.loaded.has(id) ? 'loaded' : 'not-loaded' })),
    });
  }
  if (rq.method === 'POST' && /\/models\/unload$/.test(url)) {
    const b = await readBody(rq);
    const id = String(b.instance_id ?? (url.match(/\/models\/([^/]+)\/unload$/)?.[1] ?? ''));
    if (id) lm.unloadIds.push(id);
    if (id) lm.loaded.delete(id);
    if (state.gpuUsedAfterUnload !== null) state.gpu.used = state.gpuUsedAfterUnload;
    return json(rs, 200, {});
  }
  if (rq.method === 'GET' && /^\/api\/v0\/models\/[^/]+$/.test(url)) {
    const id = decodeURIComponent(url.split('/').pop());
    return json(rs, 200, { id, state: lm.loaded.has(id) ? 'loaded' : 'not-loaded' });
  }
  return json(rs, 404, { error: 'stub: unexpected endpoint or method' });
});
await new Promise((r) => lmServer.listen(0, '127.0.0.1', r));
lmServer.unref();
const LM_PORT = lmServer.address().port;
assert.notEqual(LM_PORT, 12345, '桩服务不得占用真 LM Studio 的端口');
process.env.LEMO_LMSTUDIO_BASE = `http://127.0.0.1:${LM_PORT}`;   // ★ 必须在 import 之前
after(() => { try { lmServer.closeAllConnections?.(); lmServer.close(); } catch { /* ignore */ } });

// ★ 动态 import：让上面的 env / 钩子先生效
const vram = await import('../lib/vram.mjs');

/** 每个用例前重置桩状态。 */
function resetStub(over = {}) {
  Object.assign(state, {
    gpu: { used: 400, total: 8192 },
    gpuOkReads: Infinity,
    gpuReads: 0,
    gpuUsedAfterUnload: null,
    computeApps: '',
    spawnCalls: 0,
  }, over);
  lm.loaded = new Set();
  lm.unloadIds = [];
}

/** 捕获 console.log（本模块的「腾挪了必须打出来」都走它）。 */
async function captureLogs(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...a) => { logs.push(a.map(String).join(' ')); };
  try { return { logs, value: await fn() }; } finally { console.log = orig; }
}

/** 临时设 env，跑完还原。 */
async function withEnv(kv, fn) {
  const saved = {};
  for (const k of Object.keys(kv)) saved[k] = process.env[k];
  Object.assign(process.env, kv);
  try { return await fn(); } finally {
    for (const k of Object.keys(kv)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  三、① 纯函数 vramShortfallMessage（离线；不碰 GPU）
// ══════════════════════════════════════════════════════════════════════════

/** 造一份 vramShortfallMessage 的入参（与 ensureVramFree 里 r 的形状一致）。 */
const msgIn = (over = {}) => ({
  freeMiB: 292, totalMiB: 8192, needMiB: 6700, label: 'TTS',
  relaxEnv: 'INDEXTTS_MIN_FREE_MIB', attempted: false, freedMiB: 0, ...over,
});

test('vramShortfallMessage：口径与 tts_indextts.py 对齐（当前可用 / 需要 / 差额）', () => {
  const m = vram.vramShortfallMessage(msgIn());
  assert.match(m, /显存不足，拒绝继续TTS/, `首行应点名 label，实测首行：${m.split('\n')[0]}`);
  assert.match(m, /当前可用显存: 292 MiB \/ 共 8192 MiB/,
    '应报「当前可用 / 共」（来自 nvidia-smi）');
  assert.match(m, /需要至少:\s+6700 MiB（还差 6408 MiB）/,
    '差额必须是 needMiB - freeMiB = 6700-292 = 6408（★ 不是把 freeMiB 当差额）');
  assert.doesNotMatch(m, /还差 292 MiB/, '★ 反向判别：差额若写成 freeMiB 必红');
});

test('vramShortfallMessage：放行值 = max(0, 可用-300)，且带调用方给的 env 名', () => {
  assert.match(vram.vramShortfallMessage(msgIn({ freeMiB: 1000 })),
    /② 显式放行（自担风险）：设 INDEXTTS_MIN_FREE_MIB=700/,
    '放行值应为 1000-300=700');
  // 边界：可用 < 300 ⇒ 放行值夹到 0（不得为负）
  assert.match(vram.vramShortfallMessage(msgIn({ freeMiB: 120 })),
    /设 INDEXTTS_MIN_FREE_MIB=0/, '可用 120 MiB（<300）时放行值应夹到 0');
  // 渲染链路用的是另一个 env 名，必须原样透传
  assert.match(vram.vramShortfallMessage(msgIn({ relaxEnv: 'LEMO_RENDER_MIN_FREE_MIB', label: '渲染' })),
    /设 LEMO_RENDER_MIN_FREE_MIB=/, 'relaxEnv 应逐字透传（渲染链路用 LEMO_RENDER_MIN_FREE_MIB）');
});

test('vramShortfallMessage：三种「腾挪」分支各自成句', () => {
  // ① 根本没腾（LEMO_NO_VRAM_FREE=1）
  assert.match(vram.vramShortfallMessage(msgIn({ attempted: false })),
    /未自动腾挪:\s+LEMO_NO_VRAM_FREE=1（只查不腾）/);
  // ② 腾了，但一个模型都没有可卸
  assert.match(vram.vramShortfallMessage(msgIn({ attempted: true, tried: [], freedMiB: 0 })),
    /已自动腾挪:\s+无 —— LM Studio 没有常驻模型可卸/);
  // ③ 真卸了东西、且报了腾出多少
  assert.match(vram.vramShortfallMessage(msgIn({ attempted: true, tried: ['m-a', 'm-b'], freedMiB: 1024 })),
    /已自动腾挪:\s+卸载 m-a、m-b，腾出 1024 MiB（仍不够）/);
});

test('vramShortfallMessage：stillLoaded 非空才追加那一行', () => {
  assert.match(vram.vramShortfallMessage(msgIn({ attempted: true, tried: ['a'], stillLoaded: ['m-x', 'm-y'] })),
    /LM Studio 仍常驻: m-x、m-y/);
  assert.doesNotMatch(vram.vramShortfallMessage(msgIn({ attempted: true, tried: ['a'], stillLoaded: [] })),
    /LM Studio 仍常驻/, 'stillLoaded 为空数组时不得出现该行');
});

test('★ 契约：occupants 缺省 / null / 形状非法 ⇒ 输出逐字节退回原文案', () => {
  const base = msgIn({ attempted: true, tried: ['a'], freedMiB: 10 });
  const noOcc = vram.vramShortfallMessage(base);
  // ★ 关键：不能只拿「两个都被改坏的输出」互比（那等于空断言）——
  //   必须正面断言「一个字都没加」，否则 occupantLines 退化成「总是吐一行」也测不出来。
  assert.doesNotMatch(noOcc, /GPU 占用者/,
    '★ occupants 缺省时**一个字都不能加**（不得出现诊断段标题）');
  assert.doesNotMatch(noOcc, /没有列出任何计算进程/, 'occupants 缺省时不得出现「没列出进程」那句');
  // 四种「拿不到清单」的形态必须**彼此逐字节一致**（都退回原文案）
  for (const occ of [null, undefined, { list: 'not-an-array' }, {}, { list: null }]) {
    assert.equal(vram.vramShortfallMessage({ ...base, occupants: occ }), noOcc,
      `occupants=${JSON.stringify(occ)}（拿不到清单的形状）必须与缺省**逐字节一致**`);
  }
});

test('vramShortfallMessage：occupants 有清单 ⇒ 追加「占用者」诊断段（名字 × 个数 + 示例 pid）', () => {
  const m = vram.vramShortfallMessage(msgIn({
    occupants: {
      list: [
        { name: 'chrome.exe', count: 3, pid: 111 },
        { name: 'lmstudio.exe', count: 1, pid: 333 },
      ],
      total: 4,
      memKnown: false,
    },
  }));
  assert.match(m, /GPU 占用者/, '应出现占用者诊断段');
  assert.match(m, /· chrome\.exe × 3\s+\(示例 pid 111\)/, '应按「名字 × 个数」+ 示例 pid 输出');
  assert.match(m, /· lmstudio\.exe × 1\s+\(示例 pid 333\)/);
  assert.match(m, /WDDM 不报每进程显存/, 'memKnown=false 时必须明说「不报每进程显存」');
  assert.doesNotMatch(m, /MiB\s*×/, '★ 绝不得报「每进程 MiB」（本机一律 [N/A]，报了就是编）');
  assert.match(m, /不要杀它/, '应保留「别的项目的进程不要杀」的运维提醒');
});

test('vramShortfallMessage：occupants 空清单 ⇒ 明说「没列出任何计算进程」', () => {
  const m = vram.vramShortfallMessage(msgIn({ occupants: { list: [], total: 0, memKnown: false } }));
  assert.match(m, /没有列出任何计算进程/,
    '空清单要明说（WDDM 下桌面/浏览器的图形占用本来就不进这张表）');
  assert.doesNotMatch(m, /另有 \d+ 个进程未列出/, '空清单不得出现「另有 N 个」');
});

test('vramShortfallMessage：occupants 超过 6 项 ⇒ 截断并报「另有 N 个（共 M 个）」', () => {
  const list = Array.from({ length: 8 }, (_, i) => ({ name: `p${i}.exe`, count: 1, pid: 100 + i }));
  const m = vram.vramShortfallMessage(msgIn({
    occupants: { list, total: 8, memKnown: true },
  }));
  assert.match(m, /· p0\.exe × 1/, '前 6 项应列出');
  assert.match(m, /· p5\.exe × 1/);
  assert.doesNotMatch(m, /· p6\.exe/, '★ 第 7 项起应被截断（最多列 6 行）');
  assert.match(m, /… 另有 2 个进程未列出（共 8 个）/, '被截断的个数要如实报');
  assert.doesNotMatch(m, /WDDM 不报每进程显存/, 'memKnown=true 时不该出现那句说明');
});

test('vramShortfallMessage：pid 为 null ⇒ 不硬编「示例 pid」', () => {
  const m = vram.vramShortfallMessage(msgIn({
    occupants: { list: [{ name: 'x.exe', count: 2, pid: null }], total: 2, memKnown: false },
  }));
  assert.match(m, /· x\.exe × 2/);
  assert.doesNotMatch(m, /示例 pid/, 'pid 为 null（解析不到）时不得输出「示例 pid」');
});

// ══════════════════════════════════════════════════════════════════════════
//  四、② 桩 spawn 驱动：vramFreeMiB / gpuOccupants（真跑模块的解析代码）
// ══════════════════════════════════════════════════════════════════════════

test('vramFreeMiB：从 nvidia-smi 的 "used, total" 算出 free（且走的是桩）', { skip: !hasHooks }, async () => {
  resetStub({ gpu: { used: 7900, total: 8192 } });
  const r = await vram.vramFreeMiB();
  assert.equal(state.spawnCalls, 1, '应恰好 spawn 一次 nvidia-smi（证明真的走了被桩住的那条路）');
  assert.deepEqual(r, { freeMiB: 292, usedMiB: 7900, totalMiB: 8192 },
    `应算出 free = total - used = 292，实测 ${JSON.stringify(r)}`);
});

test('★ 反向验证：桩的读数一变，vramFreeMiB 的断言跟着变（证明测试真在读数）', { skip: !hasHooks }, async () => {
  resetStub({ gpu: { used: 7900, total: 8192 } });
  const a = await vram.vramFreeMiB();
  resetStub({ gpu: { used: 400, total: 8192 } });
  const b = await vram.vramFreeMiB();
  assert.equal(a.freeMiB, 292);
  assert.equal(b.freeMiB, 7792);
  assert.notEqual(a.freeMiB, b.freeMiB, '换一份桩数据结果必须跟着变，否则断言是空的');
});

test('vramFreeMiB：读不到就返回 null（绝不把出片流程搞崩）', { skip: !hasHooks }, async () => {
  resetStub({ gpuOkReads: 0 });                      // 退出码非 0
  assert.equal(await vram.vramFreeMiB(), null, 'nvidia-smi 非 0 退出 ⇒ null');

  resetStub();                                        // 输出不可解析
  const orig = globalThis.__vtSpawn;
  globalThis.__vtSpawn = (cmd, args, o) => (/nvidia-smi/.test(String(cmd)) && String(args[0]).startsWith('--query-gpu=')
    ? fakeProc({ out: '[N/A], [N/A]\n' }) : orig(cmd, args, o));
  try { assert.equal(await vram.vramFreeMiB(), null, '解析不出数字 ⇒ null（不得抛、不得瞎编）'); }
  finally { globalThis.__vtSpawn = orig; }
});

test('gpuOccupants：按 basename 聚合、按个数降序、WDDM 下 memKnown=false', { skip: !hasHooks }, async () => {
  resetStub({
    computeApps: [
      '111, C:\\Program Files\\Google\\Chrome\\chrome.exe, [N/A]',
      '222, C:\\Program Files\\Google\\Chrome\\chrome.exe, [N/A]',
      '333, C:/tools/lmstudio.exe, [N/A]',
      '',
    ].join('\n') + '\n',
  });
  const occ = await vram.gpuOccupants();
  assert.deepEqual(occ.list, [
    { name: 'chrome.exe', count: 2, pid: 111 },
    { name: 'lmstudio.exe', count: 1, pid: 333 },
  ], `应按进程名（basename）聚合、按 count 降序，实测 ${JSON.stringify(occ.list)}`);
  assert.equal(occ.total, 3, 'total 应为进程总数（不是种类数）');
  assert.equal(occ.memKnown, false, '本机 WDDM：used_memory 一律 [N/A] ⇒ memKnown=false');
});

test('gpuOccupants：真报了每进程 MiB（Linux 形状）⇒ memKnown=true', { skip: !hasHooks }, async () => {
  resetStub({ computeApps: '42, /usr/bin/python3, 4096 MiB\n' });
  const occ = await vram.gpuOccupants();
  assert.equal(occ.memKnown, true, 'used_memory 是真数字时应置 memKnown=true');
  assert.deepEqual(occ.list, [{ name: 'python3', count: 1, pid: 42 }]);
});

test('gpuOccupants：查不到 / 空清单 ⇒ 返回可判别的结果（诊断绝不成为新的失败点）', { skip: !hasHooks }, async () => {
  resetStub({ computeApps: '' });
  const empty = await vram.gpuOccupants();
  assert.deepEqual(empty, { list: [], total: 0, memKnown: false },
    `nvidia-smi 没列出任何进程 ⇒ 空清单（调用方据此明说「没有计算进程」），实测 ${JSON.stringify(empty)}`);

  const orig = globalThis.__vtSpawn;
  globalThis.__vtSpawn = () => fakeProc({ out: '', code: 1 });   // 模拟 nvidia-smi 失败
  try {
    assert.equal(await vram.gpuOccupants(), null,
      'nvidia-smi 失败 ⇒ null（调用方一个字都不加，逐字退回原文案）');
  } finally { globalThis.__vtSpawn = orig; }
});

// ══════════════════════════════════════════════════════════════════════════
//  五、③ ensureVramFree：短路 + 五条策略路径（桩 spawn + 桩 LM Studio）
// ══════════════════════════════════════════════════════════════════════════

test('ensureVramFree：needMiB<=0 / 非数 ⇒ 跳过（调用方关掉了这道检查），且**一次都不碰 GPU**', async () => {
  resetStub();
  for (const need of [0, -5, NaN, undefined]) {
    const r = await vram.ensureVramFree(need);
    assert.equal(r.ok, true, `need=${need} 应 ok:true`);
    assert.equal(r.skipped, true, `need=${need} 应 skipped:true`);
  }
  assert.equal(state.spawnCalls, 0, '★ 关掉检查时**不得**去读 GPU（连 nvidia-smi 都不该起）');
});

test('ensureVramFree：拿不到显存读数 ⇒ 跳过但说一声（检查绝不成为新的失败点）', { skip: !hasHooks }, async () => {
  resetStub({ gpuOkReads: 0 });
  const { logs, value } = await captureLogs(() => vram.ensureVramFree(6700, { label: 'TTS' }));
  assert.equal(value.ok, true, '没有 nvidia-smi 的机器不得被这道检查卡死');
  assert.equal(value.skipped, true);
  assert.equal(value.freeMiB, null);
  assert.ok(logs.some((l) => l.includes('显存预检已跳过') && l.includes('nvidia-smi 不可用')),
    `应打印一行「已跳过 + 原因」，实际：${JSON.stringify(logs)}`);
});

test('ensureVramFree：本来就够 ⇒ 直接放行、**零输出**、**绝不卸载**', { skip: !hasHooks }, async () => {
  resetStub({ gpu: { used: 400, total: 8192 } });    // free 7792 ≥ 6700
  lm.loaded = new Set([VLM]);
  const { logs, value } = await captureLogs(() => vram.ensureVramFree(6700));
  assert.equal(value.ok, true);
  assert.equal(value.freeMiB, 7792);
  assert.equal(value.attempted, false, '够用时不得进入腾挪');
  assert.equal(lm.unloadIds.length, 0, '★ 够用时一个字都不打、更不会去动别人的模型');
  assert.deepEqual(logs, [], `成功路径默认零噪声（要看读数才设 LEMO_VRAM_DEBUG=1），实际：${JSON.stringify(logs)}`);
  assert.equal(state.spawnCalls, 1, '只应读一次显存');
});

test('ensureVramFree：LEMO_NO_VRAM_FREE=1 ⇒ 只查不腾（含占用者诊断段）', { skip: !hasHooks }, async () => {
  resetStub({
    gpu: { used: 7900, total: 8192 },
    computeApps: '111, C:\\x\\chrome.exe, [N/A]\n222, C:\\x\\chrome.exe, [N/A]\n',
  });
  lm.loaded = new Set([VLM]);
  const r = await withEnv({ LEMO_NO_VRAM_FREE: '1' },
    () => vram.ensureVramFree(6700, { label: 'TTS' }));
  assert.equal(r.ok, false, '仍然不足 ⇒ 如实报告 ok:false（调用方据此硬拦）');
  assert.equal(r.attempted, false, 'LEMO_NO_VRAM_FREE=1 ⇒ 不得尝试腾挪');
  assert.equal(r.freeMiB, 292);
  assert.equal(lm.unloadIds.length, 0, '★ 只查不腾：一个模型都不许卸');
  assert.match(String(r.message), /未自动腾挪:\s+LEMO_NO_VRAM_FREE=1（只查不腾）/);
  assert.match(String(r.message), /GPU 占用者/, '不足文案应带上占用者诊断');
  assert.match(String(r.message), /chrome\.exe × 2/, '占用者诊断应聚合出「chrome.exe × 2」');
});

test('ensureVramFree：不足 ⇒ 自动卸载常驻模型、腾挪后够用 ⇒ ok:true 且打出来', { skip: !hasHooks }, async () => {
  resetStub({ gpu: { used: 7900, total: 8192 }, gpuUsedAfterUnload: 400 });   // 卸完落到 400 ⇒ free 7792
  lm.loaded = new Set([VLM, 'other-model']);

  const { logs, value: r } = await captureLogs(() => vram.ensureVramFree(6700, { label: 'TTS' }));

  assert.equal(r.ok, true, `腾挪后 7792 ≥ 6700 ⇒ 应放行，实测 ${JSON.stringify(r)}`);
  assert.equal(r.attempted, true, '不足时必须尝试过腾挪');
  assert.deepEqual(r.tried, [VLM, 'other-model'],
    'tried 应是「腾挪前就常驻」的那些模型（用来打「腾了什么」）');
  assert.equal(r.freedMiB, 7500, `腾出应为 7792-292=7500，实测 ${r.freedMiB}`);
  assert.equal(r.freeMiB, 7792);
  assert.deepEqual(lm.unloadIds.sort(), [VLM, 'other-model'].sort(),
    '★ 项目既有的 unloadModel（VLM）与「其余常驻模型」两条路都要走到');
  assert.equal(lm.loaded.size, 0, '桩服务里两个模型都应已被卸掉');
  assert.ok(logs.some((l) => l.includes('已卸载 LM Studio 常驻模型') && l.includes('腾出 7500 MiB')),
    `真腾挪了必须打出来（自动动作可回溯），实际：${JSON.stringify(logs)}`);
  assert.equal(r.message, undefined, '够用时不该带失败文案');
});

test('ensureVramFree：腾挪后仍不足 ⇒ ok:false + 完整可操作文案；settle 会重试等待', { skip: !hasHooks }, async () => {
  resetStub({ gpu: { used: 7900, total: 8192 } });   // 卸了也不回落（模拟别人占着卡）
  lm.loaded = new Set([VLM]);
  const t0 = Date.now();
  const { logs, value: r } = await captureLogs(() => vram.ensureVramFree(6700, { label: 'TTS' }));
  const ms = Date.now() - t0;

  assert.equal(r.ok, false, '仍然不足 ⇒ 硬拦（TTS 是「显存不够就静默挂死」的那一步）');
  assert.equal(r.attempted, true);
  assert.deepEqual(r.tried, [VLM]);
  assert.equal(r.freedMiB, 0, '一点都没腾出来 ⇒ freedMiB 应为 0');
  assert.equal(r.freeMiB, 292, 'after 回落失败 ⇒ 保持原读数');
  assert.ok(state.gpuReads >= 3,
    `★ settle 应重试等显存真正回落（before 1 次 + settle ≥2 次），实测只读了 ${state.gpuReads} 次`);
  assert.ok(ms >= 2500, `★ settle 真的等了（异步释放），实测只用了 ${ms}ms`);
  assert.match(String(r.message), /显存不足，拒绝继续TTS/);
  assert.match(String(r.message), /已自动腾挪:\s+卸载 qwen2\.5-vl-7b-official，腾出 0 MiB（仍不够）/);
  assert.ok(logs.some((l) => l.includes('尝试自动腾挪')), `应打出「正在尝试腾挪」，实际：${JSON.stringify(logs)}`);
});

test('ensureVramFree：onShort:"continue"（渲染链路）⇒ 仍如实报 ok:false，但**不打拒绝文案、不刷日志**', { skip: !hasHooks }, async () => {
  resetStub({ gpu: { used: 7900, total: 8192 }, gpuOkReads: 1 });   // 只让「腾挪前」那一次读到
  lm.loaded = new Set([VLM]);
  const { logs, value: r } = await captureLogs(
    () => vram.ensureVramFree(6700, { label: '渲染', onShort: 'continue' }));
  assert.equal(r.ok, false, '仍如实报告 ok:false（不粉饰）');
  assert.equal(r.message, undefined,
    '★ soft 策略下不得产出「拒绝继续」文案（渲染与 TTS 并行跑，硬拦会打断主题通路）');
  assert.deepEqual(logs, [], `soft 且没真腾出显存时应当完全安静，实际：${JSON.stringify(logs)}`);
});

test('ensureVramFree：onShort:"continue" 且真腾出了显存 ⇒ ok:true、只留一行可回溯的腾挪记录', { skip: !hasHooks }, async () => {
  resetStub({ gpu: { used: 7900, total: 8192 }, gpuUsedAfterUnload: 400 });
  lm.loaded = new Set([VLM]);
  const { logs, value: r } = await captureLogs(
    () => vram.ensureVramFree(6700, { label: '渲染', onShort: 'continue' }));
  assert.equal(r.ok, true, '腾挪后够用 ⇒ 渲染可继续');
  assert.equal(r.freedMiB, 7500);
  assert.equal(logs.length, 1,
    `soft 策略下只应留一行「真腾挪了」的记录（自动动作可回溯），实际 ${logs.length} 行：${JSON.stringify(logs)}`);
  assert.match(logs[0], /已卸载 LM Studio 常驻模型.*腾出 7500 MiB/);
  assert.doesNotMatch(logs[0], /拒绝继续|显存不足/,
    'soft 策略不得出现「拒绝继续」那套文案（渲染与 TTS 并行跑，硬拦会打断主题通路）');
});

// ══════════════════════════════════════════════════════════════════════════
//  六、覆盖不到的（如实登记，不粉饰）
// ══════════════════════════════════════════════════════════════════════════
//
//  · **真 GPU / 真 nvidia-smi 的读数**：本文件全程用桩，故「本机 nvidia-smi 的真实输出格式」
//    未被验证 —— 但那是**设备事实**，不是本模块的逻辑；本模块逻辑（解析 / 聚合 / 判据）已全覆盖。
//  · **真 LM Studio 的卸载接口**：桩服务只保证「本模块发出的请求形状正确」（POST /api/v1/models/unload
//    + {"instance_id":...}）。真接口是否 200 + 无 error，只有真机才能证 —— 且**绝不能在测试里真卸**。
//  · **spawn 挂起 20s 超时分支**（vramFreeMiB 的 `setTimeout → kill`）：需要真让一个子进程挂 20s，
//    会让本文件从秒级变 20s+，且与本模块的核心判据无关 ⇒ 不测。
//  · **`vramUsedMiB`（triple-check.mjs 的导出）**：不属本文件边界，由 triple-check 的测试覆盖。
