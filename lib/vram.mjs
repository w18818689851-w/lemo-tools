// lib/vram.mjs —— 「出片前的显存预检 + 自动腾挪」
//
// ★ 为什么需要（2026-10 真实事故，背景见 lib/triple-check.mjs 头部与 core/tts/tts_indextts.py）：
//   LM Studio 的模型会**常驻显存**（实测 qwen2.5-vl-7b 常驻 ≈7.6GB / 8GB 卡）。它把显存吃到 7GB 之后，
//   Index-TTS 会**静默挂死一个多小时**、整套流水线停摆。项目**既有**的腾挪能力是
//   lib/triple-check.mjs 的 unloadModel()（实测 7286 MiB → 444 MiB），但它**只在 --verify-triple
//   收尾**跑 —— 出片前没人调用。
//   于是「从 dub 路径唯一的出路是人工腾显存」：dub.mjs 的 TTS 在 **WSL** 里跑，
//   INDEXTTS_MIN_FREE_MIB 传不进那个 Windows python（WSL→Windows 不传环境变量，已实测），
//   tts_indextts.py 把 TTS 拦下来之后**没有任何自动出路**。
//
//   本模块补上这一环：出片链路在**真正吃显存之前**问一句「够不够」；不够就先自动腾挪、再问一次；
//   还是不够才明确失败。目标是让通路**不依赖人工腾显存**。
//
// ★ 纪律（别改）：
//   · **只在不足时才动**别人的模型：显存本来就够时一个字都不打，更不会去卸载 —— 见 ensureVramFree()。
//   · **成功路径零噪声**：够用时默认静默（要看读数设 LEMO_VRAM_DEBUG=1）。
//   · **真腾挪了必须打出来**（腾了什么、腾出多少）—— 自动动作必须可回溯。
//   · **检查本身绝不能成为新的失败点**：拿不到显存读数就跳过并说明（与 tts_indextts.py 同一条纪律），
//     不因为没有 nvidia-smi 就把出片卡死。
//
// ★ 两个消费者对「仍然不足」的处理**故意不同**（见 ensureVramFree 的 onShort）：
//   · dub.mjs 的 TTS 前：**硬拦**（onShort:'require'）。TTS 是「显存不够就静默挂死一个多小时」的那一步。
//   · core/render/video.mjs 的渲染前：**只腾挪、不中止**（onShort:'continue'）。理由：编排器
//     lemo-make.mjs:2428 把「音频链（含 Index-TTS）」与「渲染」用 Promise.all **并行**跑，
//     TTS 占着 6.9GB 时可用显存本来就只有几百 MiB ⇒ 硬拦会把**主题通路**整个打断；而渲染
//     （实测峰值增量 ~1.5GB）不是会静默挂死的那一步。
//
// ★ 显存读数：只走 `nvidia-smi --query-gpu=memory.used,memory.total`（设备级真相，与
//   tts_indextts.py 的 _free_vram_mib() 同一个判据）。**不**用：
//     · `nvidia-smi -lms`（本机不支持）；
//     · `--query-compute-apps` 的 used_memory（本机全是 [N/A]）；
//     · torch.cuda.mem_get_info()（WDDM 下无论别人占多少都回同一个数，拿它当判据这道检查
//       永远不会触发 —— 推导见 tts_indextts.py 的 precheck_vram()）。
//
// ★ 阈值由**调用方**给（needMiB），本模块不自己定阈值：
//     · dub.mjs 的 TTS 预检：INDEXTTS_MIN_FREE_MIB（默认 6700）—— 与 core/tts/tts_indextts.py 的
//       VRAM_MIN_MIB **同一个变量名、同一个默认值**，所以两边口径天然一致；设 0 两边都关。
//     · core/render/video.mjs 的渲染预检：LEMO_RENDER_MIN_FREE_MIB（默认 3000，推导见该文件）。
//
// ★ 环境变量：
//   LEMO_NO_VRAM_FREE=1   只查不腾（跳过自动卸载）—— 见 ensureVramFree()。
//   LEMO_VRAM_DEBUG=1     够用时也打一行读数（默认零噪声）。
//   LEMO_LMSTUDIO_BASE    LM Studio 服务地址（默认 http://127.0.0.1:12345，与 triple-check 同源）。
//
// 用法（CLI，手工排障/自测）：
//   node lib/vram.mjs --need 6700 [--label TTS] [--relax INDEXTTS_MIN_FREE_MIB]
//   → 打印一行结果；够用 exit 0，不够 exit 1（并把可操作文案打到 stderr）。

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unloadModel, LM_BASE, VLM_MODEL } from './triple-check.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const debugOn = () => process.env.LEMO_VRAM_DEBUG === '1';
const noFree = () => process.env.LEMO_NO_VRAM_FREE === '1';
/** 腾挪后等显存真正回落的上限：卸载是**异步释放**的，立刻读可能还有残留（见 unloadModel 注释）。 */
const SETTLE_MS = 15000;
const SETTLE_STEP_MS = 1500;
const HTTP_TIMEOUT_MS = 3000;

/** 带超时的 fetch（LM Studio 没起时别让预检挂住）。 */
async function fetchT(url, init = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

/**
 * 读当前 GPU 显存。读不到返回 null（**绝不让它把出片流程搞崩**）。
 * @returns {Promise<{freeMiB:number, usedMiB:number, totalMiB:number}|null>}
 */
export async function vramFreeMiB() {
  const { spawn } = await import('node:child_process');   // 一律异步 spawn（本环境 spawnSync 会 EBUSY）
  const out = await new Promise((resolve) => {
    let p;
    try {
      p = spawn('nvidia-smi', ['--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { return resolve(null); }
    let o = '', done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const t = setTimeout(() => { try { p.kill(); } catch { /* ignore */ } fin(null); }, 20000);
    p.stdout.on('data', (d) => { o += d; });
    p.on('error', () => { clearTimeout(t); fin(null); });
    p.on('close', (code) => { clearTimeout(t); fin(code === 0 ? o : null); });
  });
  if (!out) return null;
  const [used, total] = String(out).trim().split('\n')[0].split(',').map((s) => Number(s.trim()));
  if (!Number.isFinite(used) || !Number.isFinite(total)) return null;
  return { freeMiB: Math.max(0, total - used), usedMiB: used, totalMiB: total };
}

/** LM Studio 当前**常驻**（state=loaded）的模型。服务没起 / 读不到 → []（不抛）。 */
export async function lmLoadedModels() {
  try {
    const r = await fetchT(`${LM_BASE}/api/v0/models`);
    if (!r.ok) return [];
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : []);
    return arr
      .filter((m) => m && m.state === 'loaded')
      .map((m) => String(m.id ?? m.modelKey ?? m.path ?? ''))
      .filter(Boolean);
  } catch { return []; }
}

/** 按 instance_id 卸载一个 LM Studio 模型。成功返回 true。 */
async function unloadById(instanceId) {
  try {
    const r = await fetchT(`${LM_BASE}/api/v1/models/unload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },   // ★ 不带 → 415（实测）
      body: JSON.stringify({ instance_id: instanceId }),
    });
    const j = await r.json().catch(() => null);
    return r.ok && !(j && j.error);                    // 200 + {"error":...} 是假成功
  } catch { return false; }
}

/**
 * 腾挪：先复用 triple-check 的 unloadModel()，再把 LM Studio 报为常驻的其余模型一并卸掉。
 * 返回**腾挪前**就常驻的那些模型（用来打「腾了什么」，也用来判断「到底有没有可腾的」）。
 */
async function freeVram() {
  const wasLoaded = await lmLoadedModels();
  // ① 项目既有能力（实测 7286 → 444 MiB）；没加载时它是幂等的 no-op（state=not-loaded → true）
  await unloadModel();
  // ② ① 只覆盖 7B。别的模型常驻时它救不了 —— 把 LM Studio 报为 loaded 的其余模型也卸一遍。
  const rest = (await lmLoadedModels()).filter((id) => id !== VLM_MODEL);
  for (const id of rest) await unloadById(id);
  return { wasLoaded };
}

/** 等显存回落到够用（卸载是异步释放）。连续两次不再涨就提前收手，不空等到超时。 */
async function settle(needMiB) {
  let cur = await vramFreeMiB();
  if (!cur) return null;
  const t0 = Date.now();
  let prev = cur.freeMiB, flat = 0;
  while (cur.freeMiB < needMiB && Date.now() - t0 < SETTLE_MS) {
    await sleep(SETTLE_STEP_MS);
    const n = await vramFreeMiB();
    if (!n) break;
    flat = n.freeMiB > prev ? 0 : flat + 1;
    cur = n; prev = n.freeMiB;
    if (flat >= 2) break;
  }
  return cur;
}

/**
 * 不足时的可操作文案。★ 口径与 core/tts/tts_indextts.py 的 precheck_vram() **逐条对齐**
 * （当前可用 / 需要 / 差额 / 两条出路），别在这里另发明一套说法。
 */
export function vramShortfallMessage(r) {
  const { freeMiB, totalMiB, needMiB, label, relaxEnv, attempted, freedMiB, stillLoaded, tried } = r;
  const lines = [
    `显存不足，拒绝继续${label}（否则 Index-TTS / 渲染会静默挂死或失败）。`,
    `  当前可用显存: ${freeMiB} MiB / 共 ${totalMiB} MiB（来自 nvidia-smi）`,
    `  需要至少:     ${needMiB} MiB（还差 ${needMiB - freeMiB} MiB）`,
  ];
  lines.push(attempted
    ? (tried?.length
      ? `  已自动腾挪:   卸载 ${tried.join('、')}，腾出 ${freedMiB} MiB（仍不够）`
      : `  已自动腾挪:   无 —— LM Studio 没有常驻模型可卸（服务未启动，或模型本来就没加载）`)
    : `  未自动腾挪:   LEMO_NO_VRAM_FREE=1（只查不腾）`);
  if (stillLoaded?.length) lines.push(`  LM Studio 仍常驻: ${stillLoaded.join('、')}`);
  lines.push(
    '  两条出路：',
    '    ① 腾显存（推荐）：关掉正在用这张卡的程序再重跑。最常占的是浏览器、控制台页面、',
    '       LM Studio 常驻的大模型 —— 在 LM Studio 里卸载模型、或把模型配成 num_gpu=0',
    '       走 CPU 内存即可。跑 `nvidia-smi` 能看到当前占用与剩余。',
    `    ② 显式放行（自担风险）：设 ${relaxEnv}=${Math.max(0, freeMiB - 300)}`,
    `       （= 当前可用 ${freeMiB} MiB 再留 300 MiB）后重跑。放行后若显存真的不够，`,
    '       Index-TTS 会**静默挂死**——正是这道检查要防的事。',
  );
  return lines.join('\n');
}

/**
 * ★ 本模块的单一职责接口：给定「需要多少 MiB 空闲显存」，返回「是否可用」。
 *
 * 行为（顺序固定）：
 *   1) 读当前空闲显存；不够 ⇒ 2)；够 ⇒ 直接返回 ok（**零输出**）。
 *   2) 自动腾挪（unloadModel() + LM Studio 报为常驻的其余模型）；**腾挪后重新读一次**。
 *   3) 仍然不够 ⇒ ok:false，并把可操作文案放在 result.message 里交给调用方打印。
 *
 * 何时**不**腾：显存本来就够（第 1 步就返回）、或 LEMO_NO_VRAM_FREE=1（只查不腾）、
 *             或 needMiB<=0（调用方把这道检查关了）。
 * 何时**跳过**（不算失败）：needMiB<=0、或拿不到显存读数（没有 nvidia-smi 的机器）。
 *
 * ★ onShort 是**调用方的策略**，不是本模块的判据（本模块只如实报告）：
 *   · 'require'（默认，dub.mjs 的 TTS 用）：仍然不足 ⇒ ok:false + 完整可操作文案，
 *     调用方据此中止。TTS 是「显存不够就**静默挂死**」的那一步，必须硬拦。
 *   · 'continue'（core/render/video.mjs 用）：仍然不足 ⇒ 同样 ok:false（如实报告），
 *     但**不打那套「拒绝继续」文案**、也不把日志刷出来 —— 因为渲染**不是**会静默挂死的那一步，
 *     而且编排器（lemo-make.mjs:2428）的「音频链（含 Index-TTS）」与「渲染」是**并行**跑的，
 *     TTS 跑着时可用显存本来就只有几百 MiB ⇒ 硬拦会把主题通路整个打断。此时只在**真腾出**了
 *     显存时打一行（自动动作可回溯），否则完全安静。
 *
 * @param {number} needMiB 需要多少 MiB **空闲**显存
 * @param {{label?:string, relaxEnv?:string, onShort?:'require'|'continue'}} [opts]
 *        label 用于文案；relaxEnv 是「放行」那个环境变量名
 * @returns {Promise<{ok:boolean, skipped?:boolean, needMiB:number, freeMiB:number|null, totalMiB:number|null,
 *                    freedMiB:number, attempted:boolean, tried?:string[], message?:string}>}
 */
export async function ensureVramFree(needMiB, { label = '出片', relaxEnv = 'INDEXTTS_MIN_FREE_MIB', onShort = 'require' } = {}) {
  const need = Number(needMiB);
  const soft = onShort === 'continue';
  const base = { needMiB: need, freeMiB: null, totalMiB: null, freedMiB: 0, attempted: false };
  if (!Number.isFinite(need) || need <= 0) return { ...base, ok: true, skipped: true };   // 调用方关了这道检查

  const before = await vramFreeMiB();
  if (!before) {
    // ★ 检查本身绝不能成为新的失败点：没有 nvidia-smi 就跳过，但要说一声。
    console.log(`[vram] 显存预检已跳过 —— 拿不到显存信息（nvidia-smi 不可用），继续${label}`);
    return { ...base, ok: true, skipped: true };
  }
  const { freeMiB, totalMiB } = before;
  if (freeMiB >= need) {
    if (debugOn()) console.log(`[vram] 可用 ${freeMiB} MiB ≥ 需要 ${need} MiB，继续${label}`);
    return { ...base, ok: true, freeMiB, totalMiB };
  }

  const r = { ...base, freeMiB, totalMiB };
  if (noFree()) {
    if (soft) return { ...r, ok: false };
    r.message = vramShortfallMessage({ ...r, label, relaxEnv, attempted: false });
    return { ...r, ok: false };
  }

  // —— 不足 ⇒ 自动腾挪 ——
  if (!soft) console.log(`[vram] 显存不足（可用 ${freeMiB} MiB < 需要 ${need} MiB，差 ${need - freeMiB} MiB）→ 尝试自动腾挪`);
  r.attempted = true;
  const { wasLoaded } = await freeVram();
  const after = await settle(need);
  const nowFree = after ? after.freeMiB : freeMiB;
  const freed = Math.max(0, nowFree - freeMiB);
  r.tried = wasLoaded;
  r.freedMiB = freed;
  r.freeMiB = nowFree;
  r.totalMiB = after ? after.totalMiB : totalMiB;
  if (freed > 0) {
    console.log(wasLoaded.length
      ? `[vram] 已卸载 LM Studio 常驻模型：${wasLoaded.join('、')}；腾出 ${freed} MiB（可用 ${freeMiB} → ${nowFree} MiB）`
      : `[vram] 自动腾挪：腾出 ${freed} MiB（可用 ${freeMiB} → ${nowFree} MiB）`);
  } else if (!soft) {
    console.log(`[vram] 自动腾挪：LM Studio 没有常驻模型可卸（服务未启动、或模型本来就没加载）；可用 ${freeMiB} → ${nowFree} MiB`);
  }

  if (nowFree >= need) {
    if (!soft) console.log(`[vram] 腾挪后可用 ${nowFree} MiB ≥ 需要 ${need} MiB，继续${label}`);
    return { ...r, ok: true };
  }
  // 仍然不足
  if (soft) return { ...r, ok: false };          // 如实报告；调用方（渲染）选择继续
  const stillLoaded = await lmLoadedModels();
  r.message = vramShortfallMessage({ ...r, label, relaxEnv, stillLoaded });
  return { ...r, ok: false };
}

// ── CLI（仅当被直接执行时跑；被 import 时不跑）──────────────────────
function cliArgs(argv) {
  const o = { need: null, label: '出片', relax: 'INDEXTTS_MIN_FREE_MIB' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error(`${a} 需要一个值`); return argv[++i]; };
    switch (a) {
      case '--need': o.need = Number(next()); break;
      case '--label': o.label = next(); break;
      case '--relax': o.relax = next(); break;
      case '-h': case '--help': o.help = true; break;
      default: throw new Error(`未知参数: ${a}`);
    }
  }
  return o;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = cliArgs(process.argv.slice(2));
  if (o.help || !Number.isFinite(o.need)) {
    console.log(`vram.mjs —— 出片前的显存预检 + 自动腾挪

用法:
  node lib/vram.mjs --need <MiB> [--label 出片] [--relax INDEXTTS_MIN_FREE_MIB]

  --need   需要多少 MiB **空闲**显存（必填）
  --label  用于文案，如 TTS / 渲染
  --relax  文案里「显式放行」提到的环境变量名
环境变量:
  LEMO_NO_VRAM_FREE=1  只查不腾   LEMO_VRAM_DEBUG=1  够用时也打一行读数`);
    process.exit(Number.isFinite(o.need) ? 0 : 1);
  }
  const res = await ensureVramFree(o.need, { label: o.label, relaxEnv: o.relax });
  if (res.message) console.error(res.message);
  console.log(`ok=${res.ok} skipped=${!!res.skipped} need=${res.needMiB} free=${res.freeMiB} freed=${res.freedMiB}`);
  process.exit(res.ok ? 0 : 1);
}
