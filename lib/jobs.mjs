// lib/jobs.mjs —— 任务队列（串行执行 + 日志缓冲 + SSE 订阅 + 进程树取消）
//
// ★ 设计要点（勿轻易改）：
//   1. **串行**：GPU 只有一块，同时跑两个渲染会互相抢显存。编排器自己有「按 demo 的并发锁」
//      （D:\lemo-films\.<slug>.lock），但那只防同名，不同 demo 照样能撞。所以这里再加一层
//      全局串行队列 —— 同一时刻最多一个 lemo-make 子进程。
//   2. **不碰编排器**：本模块只 spawn `node lemo-make.mjs <slug> <opts...>`，不改它的任何东西。
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

const ORCH = 'D:\\lemo-tools\\lemo-make.mjs';
const ORCH_CWD = 'D:\\lemo-tools';
const FILM_DIR = 'D:\\lemo-films';

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

function findFilm(slug) {
  const p = path.join(FILM_DIR, slug, `${slug}.mp4`);
  try { return fs.existsSync(p) ? p : null; } catch { return null; }
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
    slug: job.slug,
    opts: job.opts,
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
      slug: m.slug,
      opts: Array.isArray(m.opts) ? m.opts : [],
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
  runningId = job.id;
  job.status = 'running';
  job.startedAt = Date.now();
  persistSoon();

  const args = [ORCH, job.slug, ...job.opts];
  pushLine(job, 'meta', `$ node lemo-make.mjs ${[job.slug, ...job.opts].join(' ')}`.trim());

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
  else if (code === 0) { job.status = 'done'; job.film = findFilm(job.slug); }
  else job.status = 'failed';

  job.child = null;
  if (runningId === job.id) runningId = null;

  const tail = job.status === 'canceled'
    ? '—— 任务已取消 ——'
    : `—— 任务结束：${job.status}（退出码 ${code}）——`;
  pushLine(job, 'meta', tail);
  emit(job, { type: 'end', status: job.status, exitCode: code, error: job.error || null, film: job.film });

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

// ── 对外 API ────────────────────────────────────────────────
export function enqueue(slug, opts = []) {
  const job = {
    id: nowId(),
    slug,
    opts: opts.slice(),
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
  };
  jobs.set(job.id, job);
  order.push(job.id);
  waiting.push(job.id);
  persistSoon();
  trimJobs();
  pump();
  return job;
}

function summary(job) {
  return {
    id: job.id,
    slug: job.slug,
    opts: job.opts,
    status: job.status,
    pid: job.child ? job.child.pid : (job._lastPid || null),
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    exitCode: job.exitCode,
    error: job.error,
    film: job.film,
    lines: Math.max(job.logs.length, job._logLines || 0),
    restored: !!job.restored,        // true = 从磁盘恢复的历史任务（不是本次会话跑的）
    interrupted: !!job._interrupted, // true = 上次会话没跑完（控制台被关/被杀）
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
    onEvent({ type: 'end', status: job.status, exitCode: job.exitCode, error: job.error, film: job.film });
    return () => {};
  }

  job.subs.add(onEvent);
  return () => job.subs.delete(onEvent);
}

// ── 并发预检（只读，绝不删锁）───────────────────────────────
//
// ★ 判据必须与编排器 lemo-make.mjs:996-1019 **逐字对齐**：只有「pid 活着 且 锁龄 < 6 小时」
//   才会被它 fail 挡住；其余情况它会接管（覆盖锁）。控制台若在这里自己加戏（比如「锁存在就报警」），
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
    emit(job, { type: 'end', status: 'canceled', exitCode: null, error: null, film: null });
    persistNow();
    return { ok: true };
  }

  if (job.status === 'running' && job.child) {
    job._canceled = true;
    const pid = job.child.pid;
    pushLine(job, 'meta', `—— 正在终止进程树（pid ${pid}）——`);
    killTree(pid);
    // 兜底：5 秒后还没 close 就再补一刀（WSL 里的子孙进程有时反应慢）
    const t = setTimeout(() => {
      const j = jobs.get(id);
      if (j && j.status === 'running') killTree(pid);
    }, KILL_GRACE_MS);
    t.unref?.();
    return { ok: true };
  }

  return { ok: false, error: `任务状态为 ${job.status}，不可取消` };
}

/** 队列快照，给 UI 显示「有几个在等」。 */
export function queueState() {
  return {
    running: runningId ? getSummary(runningId) : null,
    waiting: waiting.map((id) => getSummary(id)).filter(Boolean),
  };
}
