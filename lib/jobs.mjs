// lib/jobs.mjs —— 任务队列（串行执行 + 日志缓冲 + SSE 订阅 + 进程树取消）
//
// ★ 设计要点（勿轻易改）：
//   1. **串行**：GPU 只有一块，同时跑两个渲染会互相抢显存。编排器自己有「按 demo 的并发锁」
//      （D:\lemo-films\.<slug>.lock），但那只防同名，不同 demo 照样能撞。所以这里再加一层
//      全局串行队列 —— 同一时刻最多一个 lemo-make 子进程。
//      ★ 安装任务（kind='setup'）也走**同一个队列**：装依赖会写 .venv / 库目录，和渲染并行
//        必然互相踩。串行是这里唯一正确的选择，顺带让「安装中不许开渲染」自然成立。
//   2. **不碰编排器**：渲染任务只 spawn `node lemo-make.mjs <slug> <opts...>`，不改它的任何东西。
//   3. **异步 spawn**：本环境 child_process.spawnSync 对任何可执行文件都返回 EBUSY，一律异步。
//   4. **日志进内存 + 落盘**：内存里每任务最多 MAX_LOG_LINES 行（超出丢最旧）；
//      同时**尽力**写一份到 D:\lemo-films\.console（非 C 盘）。落盘失败只 warn，绝不让任务失败。
//      重启后由 loadHistory() 把历史任务读回内存（日志**惰性**加载，不占启动时间/内存）。
//   5. **中途接入**：subscribe() 先同步重放历史行、再挂实时回调。因为是单线程，重放期间不可能
//      插进新行 —— 历史与增量之间不会漏、不会重。带 from 参数时只补发 n > from 的行（SSE 续传）。
//   6. **取消要杀进程树**：编排器会再 spawn wsl.exe / node video.mjs，只 kill 父进程会留下
//      wsl.exe 孤儿继续占 GPU。Windows 下必须 `taskkill /PID <pid> /T /F`。
//   7. **绝不删并发锁**：`D:\lemo-films\.<slug>.lock` 的接管逻辑属于编排器；控制台只读它、
//      只提示。实测过：并发写 mux 会产出损坏的成片。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import * as store from './store.mjs';
import { runSteps } from './setup.mjs';
// ★ 成片根的**唯一**口径（认 `LEMO_FILM_DIR` 覆盖点）—— 见下面 FILM_DIR 的说明。
import { CFG } from './env.mjs';

const ORCH = 'D:\\lemo-tools\\lemo-make.mjs';
const ORCH_CWD = 'D:\\lemo-tools';
// ★ 成片根：唯一口径在 `lib/env.mjs` 的 `CFG.exportDir`（认 `LEMO_FILM_DIR`）。
//   本模块此前**硬编码** `'D:\\lemo-films'` —— 那是同一个成片根的第二份来源：设了覆盖点后，
//   `.console`（store.mjs，跟着走）与 `_jobs` 产物 / 样板片回落 / 并发锁（本模块，硬编码）会
//   **各看各的树**（实测：设 `LEMO_FILM_DIR` 后 `test/briefs.test.mjs` 的 ⑬/⑯ 必红）。
//   未设 `LEMO_FILM_DIR` 时 `CFG.exportDir === 'D:\\lemo-films'` ⇒ 与改动前**逐字节相同**。
//   import 方向：jobs → env → styles-root，**无环**（env.mjs 不反向 import jobs / store / setup）。
const FILM_DIR = CFG.exportDir;
// ★ 控制台出片的**独立输出目录根**（样板片在 FILM_DIR\<slug>\<slug>.mp4，两者从此不再重合）。
const JOBS_DIR = path.join(FILM_DIR, '_jobs');

const MAX_LOG_LINES = 20000;                        // 单任务日志（内存）上限
const MAX_JOBS = store.CAPS.maxPersistJobs;         // 内存里最多留多少个任务（只回收已结束的）
const KILL_GRACE_MS = 5000;                         // 取消后多久再补一刀
const LOCK_MAX_AGE_MS = 6 * 3600 * 1000;            // 与编排器一致：超过 6 小时的锁视为过期可接管

// ── 状态 ────────────────────────────────────────────────────
let seq = 0;
const jobs = new Map();   // id -> job
const order = [];         // id 列表，旧 → 新
const waiting = [];       // 排队中的 id
let runningId = null;

// ── 小工具 ──────────────────────────────────────────────────
// ANSI 颜色转义：编排器用 \x1b[2m / \x1b[32m 等硬编码上色，UI 自己做高亮，这里先剥干净。
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
const stripAnsi = (s) => s.replace(ANSI_RE, '');

function nowId() {
  seq += 1;
  return `j${Date.now().toString(36)}-${seq.toString(36)}`;
}

// ── 控制台出片的独立输出目录（`D:\lemo-films\_jobs\<任务id>`）─────────
//
// ★ 为什么必须独立（2026-10-05 修的真缺陷）：
//   编排器 `main()` 里那行 `const outDir = o.out || path.join(CFG.exportDir, o.slug)`（锚在变量 `outDir` 上），
//   而控制台起任务时**从不传 `--out`**（`server.mjs` 里那条 `const opts = ['--skip-sync', ...b.runOpts]` 只拼 `--skip-sync <runOpts>`）⇒
//   成片直写**样板片路径** `D:\lemo-films\<slug>\<slug>.mp4`，把样板片覆盖掉
//   （实测：art-deco 的样板片被覆盖成 9:16）。
// ★ 目录名取 `_jobs`：本项目里 `_` 前缀是「非风格 / 内部产物」的既有约定
//   （`_archive` / `_audit` / `_tpfix` …），成片库的一级扫描本来就会跳过 `_` 前缀 ⇒
//   它不会混进「样板片」列表；成片库另开一条显式分支列出它（见 server.mjs:jobFilms）。
// ★ 任务 id 直接用 `job.id`（由 nowId() 生成、随 index.json 落盘、重启后原样恢复）⇒
//   目录名稳定可复现，且天然匹配成片库路由的白名单正则 `[A-Za-z0-9._-]+`。
/** 控制台出片的独立输出目录：`D:\lemo-films\_jobs\<任务id>`（绝对路径）。 */
export function jobOutDir(jobId) {
  return path.join(JOBS_DIR, String(jobId));
}

/** 用户自己填的 `--out` 值（编排器 `parseArgs()` 只认 `--out <值>` 这一种写法，见其中 `else if (a === '--out') o.out = next('--out')`）；没填 → null。 */
function outFlagValue(opts) {
  const list = Array.isArray(opts) ? opts : [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === '--out') return typeof list[i + 1] === 'string' && list[i + 1] ? list[i + 1] : null;
    if (typeof a === 'string' && a.startsWith('--out=')) return a.slice('--out='.length) || null;
  }
  return null;
}

/**
 * 这次任务**实际**的成片输出目录：用户自己填了 `--out` 就用它（保持既有自由度），否则用控制台分配的独立目录。
 * ★ 纯函数（只依赖 opts + id）⇒ 入队那一刻就能算出来，排队中也拿得到（供 summary/落盘/回查）。
 */
export function effectiveOutDir(opts, jobId) {
  return outFlagValue(opts) || jobOutDir(jobId);
}

/**
 * 把控制台出片的 `--out` 注入到命令行参数里。
 * ★ 尊重用户已填的 `--out`：已经带了就**原样返回**（绝不覆盖）。
 * ★ 只在**最靠近 spawn 的这一处**注入（startJob 用 buildOrchArgs 拼 argv）——
 *   `/api/run` 与 `/api/briefs/:id/run` 两个入口都汇到 enqueue → startJob，不会漏、不会漂移。
 */
export function injectOutDir(opts, jobId) {
  const list = Array.isArray(opts) ? opts.slice() : [];
  if (outFlagValue(list) !== null) return list;
  list.push('--out', jobOutDir(jobId));
  return list;
}

/**
 * 拼出真正 spawn 给编排器的 argv：`node lemo-make.mjs <slug> <opts…>`。
 * ★ `--out` 的注入只在这里发生一次 —— 别在 server.mjs 的各个入口各写一份。
 */
export function buildOrchArgs(slug, opts, jobId) {
  return [ORCH, slug, ...injectOutDir(opts, jobId)];
}

/**
 * 找这次任务的成片。
 * ★ 优先取**这次任务自己**的产物（独立输出目录）—— 控制台出片现在落在那儿，不再是样板片路径。
 * ★ 取不到才回落到样板片路径（与改动前一致：比如 `--dry-run` 没产物、或产物被清理过）。
 */
function findFilm(job) {
  const cands = [
    path.join(effectiveOutDir(job.opts, job.id), `${job.slug}.mp4`),
    path.join(FILM_DIR, job.slug, `${job.slug}.mp4`),
  ];
  for (const p of cands) {
    try { if (fs.existsSync(p)) return p; } catch { /* 单个候选出错不影响其它 */ }
  }
  return null;
}

function emit(job, ev) {
  for (const fn of job.subs) {
    try { fn(ev); } catch { /* 单个订阅者出错不影响其它 */ }
  }
}

function pushLine(job, stream, raw) {
  const line = stripAnsi(String(raw)).replace(/\s+$/, '');
  const rec = { type: 'line', n: (job.logSeq += 1), stream, line, t: Date.now() };
  job.logs.push(rec);
  if (job.logs.length > MAX_LOG_LINES) job.logs.splice(0, job.logs.length - MAX_LOG_LINES);
  job._logLines = (job._logLines || 0) + 1;
  // 落盘：best-effort（store 内部全 try/catch，失败只 warn）
  if (!job.restored) store.appendLog(job.id, { n: rec.n, stream, line, t: rec.t });
  emit(job, rec);
}

// ── 落盘（任务元数据）────────────────────────────────────────
//
// 只在「状态会变」的节点写索引（入队 / 开始 / 结束 / 取消），不做每行落盘 ——
// 索引是给「重启后还能看到任务」用的，不需要毫秒级新鲜度。
let persistTimer = null;

function persistMeta(job) {
  return {
    id: job.id,
    kind: job.kind || 'render',        // 'render' | 'setup'
    title: job.title || null,          // 仅 setup 任务有（渲染任务用 slug 显示）
    actionId: job.actionId || null,    // 仅 setup 任务有：对应 lib/setup.mjs 的动作 id
    slug: job.slug,
    opts: job.opts,
    batchId: job.batchId || null,        // 批次标记（重启后 UI 仍要能看出「这几条是一批的」）
    batchIndex: Number.isInteger(job.batchIndex) ? job.batchIndex : null,
    batchTotal: Number.isInteger(job.batchTotal) ? job.batchTotal : null,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    exitCode: job.exitCode,
    signal: job.signal,
    error: job.error,
    film: job.film,
    lines: Math.max(job.logs.length, job._logLines || 0),
    logSeq: job.logSeq,
    interrupted: !!job._interrupted,
    restored: !!job.restored,
    // ★ 归属控制台实例的 pid（见 isJobOwnedByLiveConsole）：
    //   多实例共用 .console 时，靠它区分「别的实例正在跑的任务」和「上次崩溃留下的僵尸」。
    //   restored 的任务必须**原样保留**它原有的归属，绝不能改写成自己 —— 否则会偷走别人的任务。
    ownerPid: job.restored ? (job.ownerPid || null) : process.pid,
  };
}

function persistNow() {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  store.saveIndex(order.map((id) => jobs.get(id)).filter(Boolean).map(persistMeta));
}

/** 500ms 去抖：短时间内多次状态变化只写一次盘。 */
function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => { persistTimer = null; persistNow(); }, 500);
  persistTimer.unref?.();
}

/** 立刻落盘（退出前用，别让去抖定时器把最后一次状态变化吞掉）。 */
export function flushPersist() { persistNow(); }

// ── 启动时加载历史 ──────────────────────────────────────────
//
// ★ 加载失败必须**降级为空历史**：store.loadIndex() 内部已把所有异常吞成 warn。
// ★ 日志**不在这里读**：120 个任务 × 4MB 会把启动拖垮。改成第一次看日志时才读（ensureLogs）。
const TERMINAL = new Set(['done', 'failed', 'canceled']);

function loadHistory() {
  const { jobs: hist, error, ready } = store.loadIndex();
  if (error) console.warn(`  ⚠️  [历史落盘] 历史加载失败，按空历史启动：${error}`);
  for (const m of hist) {
    // 上次会话没跑完的任务：状态不可能是 queued/running 了 —— 统一标成 ended（已结束），
    // 否则 UI 上会出现一个「运行中」的僵尸任务。
    const interrupted = !TERMINAL.has(m.status);
    const job = {
      id: m.id,
      kind: m.kind === 'setup' ? 'setup' : 'render',
      title: m.title || null,
      actionId: m.actionId || null,
      steps: [],
      slug: m.slug,
      opts: Array.isArray(m.opts) ? m.opts : [],
      batchId: typeof m.batchId === 'string' && m.batchId ? m.batchId : null,
      batchIndex: Number.isInteger(m.batchIndex) ? m.batchIndex : null,
      batchTotal: Number.isInteger(m.batchTotal) ? m.batchTotal : null,
      status: interrupted ? 'ended' : m.status,
      createdAt: m.createdAt || Date.now(),
      startedAt: m.startedAt || null,
      endedAt: m.endedAt || (interrupted ? Date.now() : null),
      exitCode: Number.isFinite(m.exitCode) ? m.exitCode : null,
      signal: m.signal || null,
      error: m.error || (interrupted ? '控制台重启，任务未跑完' : null),
      film: m.film || null,
      logs: [],
      logSeq: Number.isFinite(m.logSeq) ? m.logSeq : 0,
      subs: new Set(),
      child: null,
      _outBuf: '',
      _errBuf: '',
      _canceled: false,
      _finished: true,
      _logLines: Number.isFinite(m.lines) ? m.lines : 0,
      _logsLoaded: false,
      restored: true,
      _interrupted: interrupted,
      ownerPid: Number.isInteger(m.ownerPid) && m.ownerPid > 0 ? m.ownerPid : null,
    };
    jobs.set(job.id, job);
    order.push(job.id);
  }
  if (hist.length) {
    console.log(`  已加载 ${hist.length} 条历史任务（${ready ? store.storeStatus().root : '落盘不可用'}）`);
  }
}

/** 惰性把某任务的日志从磁盘读回内存（只读一次）。 */
function ensureLogs(job) {
  if (job._logsLoaded) return;
  job._logsLoaded = true;
  if (!job.restored) return;
  const recs = store.loadLogs(job.id);
  if (!recs.length) return;
  job.logs = recs.slice(-MAX_LOG_LINES);
  job._logLines = recs.length;
  const last = recs[recs.length - 1];
  if (last && Number.isFinite(last.n)) job.logSeq = Math.max(job.logSeq, last.n);
}

loadHistory();

function flushBuf(job, stream) {
  const key = stream === 'stderr' ? '_errBuf' : '_outBuf';
  if (job[key]) { pushLine(job, stream, job[key]); job[key] = ''; }
}

// 分块 → 按行。\r 也算行界：渲染进度条用 \r 原地刷新，不拆开的话 UI 上看不到任何进度。
function feed(job, stream, chunk) {
  const key = stream === 'stderr' ? '_errBuf' : '_outBuf';
  const text = job[key] + chunk;
  const parts = text.split(/\r\n|\r|\n/);
  job[key] = parts.pop();
  for (const p of parts) pushLine(job, stream, p);
}

function trimJobs() {
  while (order.length > MAX_JOBS) {
    const id = order[0];
    const j = jobs.get(id);
    // 只回收「已结束」的；排队/运行中的一律不动
    if (j && (j.status === 'queued' || j.status === 'running')) break;
    order.shift();
    if (j) { j.subs.clear(); jobs.delete(id); store.dropLog(id); }   // 连同落盘日志一起清，避免孤儿文件
  }
}

// ── 队列 ────────────────────────────────────────────────────
function pump() {
  if (runningId) return;
  while (waiting.length) {
    const id = waiting.shift();
    const job = jobs.get(id);
    if (!job || job.status !== 'queued') continue;
    startJob(job);
    return;
  }
}

function startJob(job) {
  if (job.kind === 'setup') return startSetupJob(job);

  runningId = job.id;
  job.status = 'running';
  job.startedAt = Date.now();
  persistSoon();

  // ★ 控制台出片一律写进独立输出目录（`_jobs\<任务id>`），绝不覆盖样板片 ——
  //   `--out` 的注入只发生在 buildOrchArgs 这一处（用户自带 `--out` 则原样尊重）。
  const args = buildOrchArgs(job.slug, job.opts, job.id);
  job.outDir = effectiveOutDir(job.opts, job.id);
  pushLine(job, 'meta', `$ node lemo-make.mjs ${args.slice(1).join(' ')}`.trim());

  // 启动前并发预检（②：这里再兜一次底 —— UI 已经提示过，但直接打 API 的客户端也该看到）
  const lk = checkLock(job.slug);
  if (lk.locked) {
    pushLine(job, 'meta',
      `[控制台] ⚠️ 检测到已有另一个 lemo-make 在跑同一个 demo（pid ${lk.pid}，锁创建于 ${Math.round(lk.ageMs / 1000)} 秒前）。`
      + '并发跑会往同一批文件写，mux 交错写会产出损坏的成片。若编排器判定它仍活着，本次会直接失败。');
  } else if (lk.stale) {
    pushLine(job, 'meta',
      `[控制台] 发现陈旧并发锁（pid ${lk.pid ?? '?'} 已不在，锁龄 ${Math.round(lk.ageMs / 1000)} 秒）——编排器会自动接管，属正常。`);
  }

  let child;
  try {
    child = spawn(process.execPath, args, {
      cwd: ORCH_CWD,
      windowsHide: true,
      // 编排器不认 NO_COLOR（它硬编码 ANSI），但传了无害；真正去色靠上面的 stripAnsi
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
  } catch (e) {
    return finishJob(job, -1, e);
  }

  job.child = child;
  job._lastPid = child.pid;
  child.stdout?.on('data', (d) => feed(job, 'stdout', d.toString('utf8')));
  child.stderr?.on('data', (d) => feed(job, 'stderr', d.toString('utf8')));
  child.on('error', (e) => finishJob(job, -1, e));
  child.on('close', (code, signal) => finishJob(job, code, null, signal));
}

// ── 安装任务（kind='setup'）─────────────────────────────────
//
// ★ 为什么复用同一个队列而不是另起一套：
//   1. 装依赖会写 .venv / 库目录 / Windows 库，和渲染并行必然互相踩 —— 串行队列天然解决。
//   2. SSE 日志、断线续传、取消、落盘、历史恢复全部**直接复用**，一行都不用重写。
//   3. 代价只是给 job 加一个 kind 字段 —— 渲染路径的代码一个字符没动。
//
// ★ 步骤执行器在 lib/setup.mjs（runSteps）：它只认步骤描述、不做决策；
//   决策（该不该装、装什么）在 setup.mjs 的 planActions —— 纯函数，可单测、可演练。
function startSetupJob(job) {
  runningId = job.id;
  job.status = 'running';
  job.startedAt = Date.now();
  persistSoon();

  pushLine(job, 'meta', `$ [安装] ${job.title || job.actionId}`);
  pushLine(job, 'meta', `  动作 ${job.actionId} · ${job.steps.length} 个步骤 · 由控制台在后台执行`);
  if (job.estBytes) pushLine(job, 'meta', `  预计下载体积：约 ${(job.estBytes / 1e6).toFixed(0)} MB`);

  runSteps(job.steps, {
    onLine: (line, stream) => pushLine(job, stream === 'stderr' ? 'stderr' : 'stdout', line),
    // 每一步都换子进程 —— 取消要靠这个钩子拿到**当前**那一步的 pid
    onSpawn: (child) => { job.child = child; job._lastPid = child.pid; },
    aborted: () => job._canceled,
  }).then((r) => {
    job.child = null;
    if (runningId === job.id) runningId = null;
    job._finished = true;
    job.endedAt = Date.now();

    if (job._canceled) {
      job.status = 'canceled';
      job.exitCode = null;
    } else if (r.ok) {
      job.status = 'done';
      job.exitCode = 0;
    } else {
      job.status = 'failed';
      job.exitCode = Number.isFinite(r.exitCode) ? r.exitCode : -1;
      // ★ 失败必须**可区分**：网络 / 权限 / 磁盘 / 超时 各给各的话（见 setup.mjs:classifyFailure）
      job.error = `[${r.kind}] ${r.hint}${r.evidence ? `（命中：${r.evidence}）` : ''}`;
      pushLine(job, 'meta', `✗ 失败类型：${r.kind} —— ${r.hint}`);
      if (r.evidence) pushLine(job, 'meta', `  命中特征：${r.evidence}`);
      if (Number.isFinite(r.failedStep)) pushLine(job, 'meta', `  失败在第 ${r.failedStep + 1}/${job.steps.length} 步`);
    }

    const tail = job.status === 'canceled'
      ? '—— 安装已取消 ——'
      : job.status === 'done'
        ? `—— 安装完成（${((Date.now() - job.startedAt) / 1000).toFixed(1)}s）——`
        : `—— 安装失败（退出码 ${job.exitCode}）——`;
    pushLine(job, 'meta', tail);
    emit(job, { type: 'end', status: job.status, exitCode: job.exitCode, error: job.error || null, film: null, kind: 'setup' });

    persistNow();
    trimJobs();
    pump();
  }).catch((e) => {
    // runSteps 自己不会抛；这里纯属兜底，避免队列卡死（runningId 不复位 = 整个队列停摆）
    job.child = null;
    if (runningId === job.id) runningId = null;
    job._finished = true;
    job.status = 'failed';
    job.exitCode = -1;
    job.endedAt = Date.now();
    job.error = `[INTERNAL] 安装任务异常：${String((e && e.message) || e)}`;
    pushLine(job, 'meta', `✗ ${job.error}`);
    emit(job, { type: 'end', status: 'failed', exitCode: -1, error: job.error, film: null, kind: 'setup' });
    persistNow();
    trimJobs();
    pump();
  });
}

function finishJob(job, code, error, signal) {
  // 防重入：error 与 close 可能都触发
  if (job._finished) return;
  job._finished = true;

  flushBuf(job, 'stdout');
  flushBuf(job, 'stderr');

  job.exitCode = code;
  job.endedAt = Date.now();
  job.signal = signal || null;
  if (error) job.error = String(error.message || error);

  if (job._canceled) job.status = 'canceled';
  else if (code === 0) { job.status = 'done'; job.film = findFilm(job); }
  else job.status = 'failed';

  job.child = null;
  if (runningId === job.id) runningId = null;

  const tail = job.status === 'canceled'
    ? '—— 任务已取消 ——'
    : `—— 任务结束：${job.status}（退出码 ${code}）——`;
  pushLine(job, 'meta', tail);
  emit(job, { type: 'end', status: job.status, exitCode: code, error: job.error || null, film: job.film, kind: job.kind || 'render' });

  persistNow();     // 终态立刻落盘：重启后状态才是准的
  trimJobs();
  pump();
}

// ── 取消 ────────────────────────────────────────────────────
function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    // /T 连子进程（wsl.exe、node video.mjs…）一起杀；只杀父进程会留下占 GPU 的孤儿。
    try { spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }); } catch { /* ignore */ }
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ } }
  }
}

/**
 * 杀掉一个任务当前正在跑的东西。
 *
 * ★ 为什么不能只 taskkill /T：WSL2 里的进程跑在虚拟机里，**不是** wsl.exe 的 Windows 子进程。
 *   实测（见简报「测试 D」）：只 taskkill 的话，取消一个 `sleep 40` 之后 Linux 侧的 sleep
 *   仍然活着跑到自然结束 —— 换成 6 GB 的 git clone 就是「点了取消还在后台下载」。
 *   lib/setup.mjs 的安装步骤会在 child 上挂 `_lemoKillExtra`（按进程组杀 WSL 侧），这里调它。
 * ★ 渲染任务（node lemo-make.mjs）没有这个钩子，行为与本批之前完全一致。
 */
function killJobChild(child) {
  if (!child) return null;
  const pid = child.pid;
  if (typeof child._lemoKillExtra === 'function') {
    try { child._lemoKillExtra(); } catch { /* 尽力而为，失败不影响 Windows 侧清理 */ }
  }
  killTree(pid);
  return pid;
}

// ── 对外 API ────────────────────────────────────────────────
export function enqueue(slug, opts = [], meta = {}) {
  const job = {
    id: nowId(),
    slug,
    opts: opts.slice(),
    // ── 批次（第四批：批量入队）────────────────────────────
    // ★ 只存「属于哪一批 / 第几个 / 共几个」，**队列语义一个字没改** —— 批量入队就是
    //   连着调 N 次 enqueue()，串行队列天然按顺序跑（GPU 只有一块，本来就该串行）。
    // ★ 落盘 + 历史恢复都要带上，否则重启后 UI 上看不出这几条是同一批。
    batchId: typeof meta.batchId === 'string' && meta.batchId ? meta.batchId : null,
    batchIndex: Number.isInteger(meta.batchIndex) ? meta.batchIndex : null,
    batchTotal: Number.isInteger(meta.batchTotal) ? meta.batchTotal : null,
    status: 'queued',
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
    exitCode: null,
    signal: null,
    error: null,
    film: null,
    logs: [],
    logSeq: 0,
    subs: new Set(),
    child: null,
    _outBuf: '',
    _errBuf: '',
    _canceled: false,
    _finished: false,
    _logLines: 0,
    _logsLoaded: true,      // 新任务：日志本来就在内存里
    restored: false,
    _interrupted: false,
    ownerPid: process.pid,
  };
  jobs.set(job.id, job);
  order.push(job.id);
  waiting.push(job.id);
  persistSoon();
  trimJobs();
  pump();
  return job;
}

/**
 * 入队一个**安装任务**（走同一个串行队列，见 startSetupJob 的说明）。
 *
 * @param {object} spec
 * @param {string} spec.actionId  lib/setup.mjs 的动作 id（UI 靠它回查指引）
 * @param {string} spec.title     人话标题
 * @param {object[]} spec.steps   步骤描述（见 lib/setup.mjs 的 wsl / wsl-file / exe）
 * @param {number} [spec.estBytes]
 */
export function enqueueSetup(spec) {
  const job = {
    id: nowId(),
    kind: 'setup',
    title: spec.title || spec.actionId,
    actionId: spec.actionId,
    steps: Array.isArray(spec.steps) ? spec.steps : [],
    estBytes: spec.estBytes || 0,
    batchId: null,          // 安装任务不参与批次（只有渲染任务能批量入队）
    batchIndex: null,
    batchTotal: null,
    slug: '__setup__',      // 只为兼容 summary/persist 的字段形状；setup 任务不查锁、不找成片
    opts: [],
    status: 'queued',
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
    exitCode: null,
    signal: null,
    error: null,
    film: null,
    logs: [],
    logSeq: 0,
    subs: new Set(),
    child: null,
    _outBuf: '',
    _errBuf: '',
    _canceled: false,
    _finished: false,
    _logLines: 0,
    _logsLoaded: true,
    restored: false,
    _interrupted: false,
    ownerPid: process.pid,
  };
  jobs.set(job.id, job);
  order.push(job.id);
  waiting.push(job.id);
  persistSoon();
  trimJobs();
  pump();
  return job;
}

// ── 预计剩余时间（ETA）──────────────────────────────────────
//
// ★ 数据从哪来：**历史任务的真实起止时间**。`job.startedAt` / `job.endedAt` 本来就在内存里，
//   落盘后由 lib/store.mjs 的 index.json 带回来（字段名就是 startedAt / endedAt，见 store.mjs
//   的 persistMeta 写入端在 lib/jobs.mjs:persistMeta）。**不引入任何新落盘格式。**
//
// ★ 为什么必须按参数分组：同一个 slug，`--audio-only`（复用已有视频，只重跑音频链路）
//   和全跑（同步库 + 渲染 + 混流）耗时可差 5–10 倍。混在一起取中位数 = 编造。
//   所以先算一个「阶段键」，只在**同 slug + 同阶段键**的样本里统计。
//
// ★ 只信「真的跑完且成功」的样本（status==='done' && exitCode===0）：
//   失败/取消的任务往往很早就断了，拿它的耗时当基准会**系统性低估**。
//
// ★ 不确定就说不确定：同参数样本 ≥2 才给中位数 + 区间（confidence:'ok'）；
//   只有 1 条 → 'low'（前端会写「仅 1 次历史」）；一条都没有但有**其它参数**的历史 → 'coarse'
//   （前端写「该风格其它参数的历史，仅供粗估」）；全都没有 → 'none'，**前端不显示**。
const DURATION_FLAGS = ['--dry-run', '--audio-only', '--render-only', '--skip-render', '--skip-sync'];

/**
 * 参数分组键：只取**明显改变耗时阶段**的几个开关，按固定顺序拼接。
 * ★ 故意**不**把 --fps / --workers / --venc 算进来：它们是连续量，分组会把样本打得太碎
 *   （碎到每组 1 条反而更不准）。代价是同一组内的这些差异体现不到估计里 —— 前端 tooltip 里
 *   如实写明「未按 fps/workers/venc 分组」。
 */
export function phaseKey(opts) {
  const set = new Set(Array.isArray(opts) ? opts : []);
  const hit = DURATION_FLAGS.filter((f) => set.has(f));
  return hit.length ? hit.join(' ') : 'default';
}

function median(sorted) {
  const n = sorted.length;
  if (!n) return null;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/**
 * 估一个 (slug, opts) 的耗时。
 * @returns {{key:string, basis:'same-params'|'other-params'|'none', confidence:'ok'|'low'|'coarse'|'none',
 *            n:number, medianMs:number|null, minMs:number|null, maxMs:number|null}}
 */
export function etaFor(slug, opts) {
  const key = phaseKey(opts);
  const same = [];
  const other = [];

  for (const id of order) {
    const j = jobs.get(id);
    if (!j || j.slug !== slug) continue;
    if ((j.kind || 'render') !== 'render') continue;                       // 安装任务不算
    if (j.status !== 'done' || j.exitCode !== 0) continue;                  // 只信跑完且成功的
    if (!Number.isFinite(j.startedAt) || !Number.isFinite(j.endedAt)) continue;
    const ms = j.endedAt - j.startedAt;
    if (!(ms > 0)) continue;
    (phaseKey(j.opts) === key ? same : other).push(ms);
  }

  const pack = (arr, basis, confidence) => {
    const s = arr.slice().sort((a, b) => a - b);
    return { key, basis, confidence, n: s.length, medianMs: median(s), minMs: s[0] ?? null, maxMs: s[s.length - 1] ?? null };
  };

  if (same.length >= 2) return pack(same, 'same-params', 'ok');
  if (same.length === 1) return pack(same, 'same-params', 'low');
  if (other.length >= 2) return pack(other, 'other-params', 'coarse');
  return { key, basis: 'none', confidence: 'none', n: 0, medianMs: null, minMs: null, maxMs: null };
}

function summary(job) {
  return {
    id: job.id,
    kind: job.kind || 'render',
    title: job.title || null,
    actionId: job.actionId || null,
    slug: job.slug,
    opts: job.opts,
    batchId: job.batchId || null,
    batchIndex: Number.isInteger(job.batchIndex) ? job.batchIndex : null,
    batchTotal: Number.isInteger(job.batchTotal) ? job.batchTotal : null,
    status: job.status,
    pid: job.child ? job.child.pid : (job._lastPid || null),
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    exitCode: job.exitCode,
    error: job.error,
    film: job.film,
    // ★ 这次任务的成片输出目录（控制台分配的 `_jobs\<任务id>`，或用户自带的 `--out`）。
    //   纯函数算得 ⇒ 排队中也拿得到；UI/测试据此能直接看出「产物写到哪儿」。
    outDir: (job.kind === 'setup') ? null : effectiveOutDir(job.opts, job.id),
    lines: Math.max(job.logs.length, job._logLines || 0),
    restored: !!job.restored,        // true = 从磁盘恢复的历史任务（不是本次会话跑的）
    interrupted: !!job._interrupted, // true = 上次会话没跑完（控制台被关/被杀）
    // ★ 预计剩余时间（第四批 ②）：只给「排队中 / 运行中」算 —— 已结束的任务再报 ETA 没有意义。
    //   数据来自历史任务的实际起止时间（见 lib/store.mjs 落盘的 startedAt/endedAt），
    //   没有历史样本时 etaFor() 返回 confidence:'none'，前端据此**不显示**（绝不瞎猜）。
    eta: (job.status === 'queued' || job.status === 'running') ? etaFor(job.slug, job.opts) : null,
  };
}

export function listJobs() {
  return order.map((id) => jobs.get(id)).filter(Boolean).map(summary).reverse(); // 新 → 旧
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function getSummary(id) {
  const j = jobs.get(id);
  return j ? summary(j) : null;
}

/**
 * 盘上那条任务是不是**另一个还活着的控制台实例**在跑？
 *
 * ★ 为什么需要它：loadHistory 会把盘上残留的 running/queued 一律标成 'ended'
 *   （见上面的 interrupted），所以 getSummary 的 status **分不出**
 *   「上次崩溃留下的僵尸」和「另一个实例正在跑的任务」。
 *   server.mjs 的启动收敛若只看 status，第二个实例一启动就会把第一个实例
 *   正在出片的工单收敛成 failed（实测复现）。
 * ★ 只对 restored 且盘上非终态的任务判；pid 死了（或本来就是自己 = pid 复用）→ false，照常收敛。
 */
export function isJobOwnedByLiveConsole(id) {
  const j = jobs.get(id);
  if (!j || !j._interrupted) return false;              // 盘上已是终态（或本会话新建）→ 不适用
  if (!j.ownerPid || j.ownerPid === process.pid) return false;
  try { process.kill(j.ownerPid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/**
 * 订阅：先同步重放历史行，再挂实时回调。返回取消订阅函数（job 不存在返回 null）。
 *
 * ★ SSE 断线续传：`opts.from` = 客户端已收到的最大序号（来自 Last-Event-ID）。
 *   - from <= 0（默认）→ **全量重放**，行为与本批之前完全一致。
 *   - from > 0        → 只发 n > from 的行。
 *   - 若 from 之后的行已经被内存/磁盘裁剪掉（中间有洞）→ 先发一条 `gap` 事件说明缺口，
 *     再发剩下的，绝不让客户端以为「中间没丢」。
 *   ★ 序号 n 由 job.logSeq 单调递增；历史任务的 logSeq 从磁盘恢复，所以**跨重启也稳定**。
 */
export function subscribe(id, onEvent, opts = {}) {
  const job = jobs.get(id);
  if (!job) return null;

  ensureLogs(job);

  const from = Number(opts.from) || 0;
  const logs = job.logs.slice();

  if (from > 0 && logs.length) {
    const firstN = logs[0].n;
    if (Number.isFinite(firstN) && firstN > from + 1) {
      onEvent({ type: 'gap', from: from + 1, to: firstN - 1, dropped: firstN - from - 1 });
    }
  }
  for (const rec of logs) if (rec.n > from) onEvent(rec);

  const finished = job.status === 'done' || job.status === 'failed'
    || job.status === 'canceled' || job.status === 'ended';
  if (finished) {
    onEvent({ type: 'end', status: job.status, exitCode: job.exitCode, error: job.error, film: job.film, kind: job.kind || 'render' });
    return () => {};
  }

  job.subs.add(onEvent);
  return () => job.subs.delete(onEvent);
}

// ── 并发预检（只读，绝不删锁）───────────────────────────────
//
// ★ 判据必须与编排器 `main()` 里那条 `if (alive && ageMs < 6 * 3600 * 1000)` **逐字对齐**：
//   只有「pid 活着 且 锁龄 < 6 小时」才会被它 fail 挡住；其余情况它会接管（覆盖锁）。控制台若在这里自己加戏（比如「锁存在就报警」），
//   就会对**陈旧锁**误报 —— 那是编排器明确支持的正常路径。
// ★ 这里**只读**。删锁属于编排器的接管逻辑，控制台去删可能造成并发写（实测会产出损坏成片）。
export function checkLock(slug) {
  const lockPath = path.join(FILM_DIR, `.${slug}.lock`);
  let st = null;
  try { st = fs.statSync(lockPath); } catch {
    return { locked: false, stale: false, lockPath, pid: null, alive: false, ageMs: 0, lockAgeSec: 0 };
  }

  let pid = NaN;
  try { pid = Number(fs.readFileSync(lockPath, 'utf8').split('\n')[0]); } catch { /* 读不到内容 */ }
  const ageMs = Date.now() - st.mtimeMs;

  let alive = false;
  if (Number.isInteger(pid) && pid > 0) {
    try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
  }
  const locked = alive && ageMs < LOCK_MAX_AGE_MS;
  return {
    locked,                       // true = 编排器会拒绝启动（真冲突）
    stale: !locked,               // true = 陈旧锁，编排器会自动接管，**不要报警**
    lockPath,
    pid: Number.isInteger(pid) && pid > 0 ? pid : null,
    alive,
    ageMs,
    lockAgeSec: Math.round(ageMs / 1000),
  };
}

export function cancelJob(id) {
  const job = jobs.get(id);
  if (!job) return { ok: false, error: '任务不存在' };

  if (job.status === 'queued') {
    job.status = 'canceled';
    job.endedAt = Date.now();
    job._canceled = true;
    job._finished = true;
    const i = waiting.indexOf(id);
    if (i >= 0) waiting.splice(i, 1);
    pushLine(job, 'meta', '—— 任务已取消（排队中，未启动）——');
    emit(job, { type: 'end', status: 'canceled', exitCode: null, error: null, film: null, kind: job.kind || 'render' });
    persistNow();
    return { ok: true };
  }

  // ★ 安装任务也要能取消：它的子进程是一步一换的，取消的瞬间 child 可能正好为 null
  //   （两步之间）。这时不返回失败，只置 _canceled，runSteps 会在下一个步骤边界退出。
  if (job.status === 'running' && (job.child || job.kind === 'setup')) {
    job._canceled = true;
    const child = job.child;
    const pid = child ? child.pid : null;
    pushLine(job, 'meta', pid ? `—— 正在终止进程树（pid ${pid}）——` : '—— 正在取消（当前无运行中的子进程）——');
    if (child) killJobChild(child);
    // 兜底：5 秒后还没 close 就再补一刀（WSL 里的子孙进程有时反应慢）
    if (child) {
      const t = setTimeout(() => {
        const j = jobs.get(id);
        if (j && j.status === 'running') killJobChild(child);
      }, KILL_GRACE_MS);
      t.unref?.();
    }
    return { ok: true };
  }

  return { ok: false, error: `任务状态为 ${job.status}，不可取消` };
}

/**
 * 删除一条**已结束**的任务记录（从内存 + 落盘索引 + 日志文件里一并移除）。
 *
 * ★ 「取消」与「删除」是两件事，别混：
 *   · queued / running → 用 cancelJob()「取消」（中止还在跑的任务）；
 *   · 终态（done / failed / canceled / ended）→ 用本函数「删除记录」（从列表里抹掉）。
 *   对一条已经结束的任务「取消」在语义上是错的，用户真正想要的是「把这条历史清掉」。
 *
 * ★ 安全边界：排队中 / 运行中的任务**绝不删** —— 必须仍走 cancelJob，
 *   否则会把占着 GPU 的子进程变成无人管的孤儿（同 lib/briefs.mjs:deleteBrief 的 running 拒删）。
 * ★ id 序列不受影响：id 由 nowId() 的单调 seq 生成，与 order 数组无关，
 *   从 order 里移除一条不会让后续 id 重复或跳号。
 */
export function deleteJob(id) {
  const job = jobs.get(id);
  if (!job) return { ok: false, code: 404, error: `任务不存在：${id}` };
  if (job.status === 'queued' || job.status === 'running') {
    return {
      ok: false, code: 409,
      error: `任务 ${id} 正在${job.status === 'running' ? '运行' : '排队'}，不能删除 —— 请先「取消」它。`,
    };
  }
  const oi = order.indexOf(id);
  if (oi >= 0) order.splice(oi, 1);
  const wi = waiting.indexOf(id);
  if (wi >= 0) waiting.splice(wi, 1);
  job.subs.clear();
  jobs.delete(id);
  store.dropLog(id);   // 连同落盘日志一起清，避免孤儿文件（与 trimJobs 一致）
  persistNow();        // 立刻重写 index.json —— 删掉的记录要真的从盘上消失
  return { ok: true, id };
}

/** 队列快照，给 UI 显示「有几个在等」。 */
export function queueState() {
  return {
    running: runningId ? getSummary(runningId) : null,
    waiting: waiting.map((id) => getSummary(id)).filter(Boolean),
  };
}
