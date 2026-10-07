// lib/store.mjs —— 任务历史与日志落盘（**尽力而为**，失败只 warn）
//
// ★ 为什么需要它：一个 3D 任务要跑 7 分钟。跑完重启控制台，任务记录和几万行日志
//   全没了 —— 这是真实的数据丢失，不是「体验问题」。
//
// ★ 设计要点（勿轻易改）：
//   1. **落盘是尽力而为**：任何一次写失败都只 warn 一次，绝不抛出、绝不让任务失败。
//      控制台的价值是「把 CLI 包起来」；磁盘问题不该反过来把它搞挂。
//   2. **不写 C 盘**：默认固定在 D:\lemo-films\.console（与成片同盘；根可由 `LEMO_FILM_DIR` 改）。以 `.` 开头，
//      所以 server.mjs 的 /api/films 扫描（跳过 `.` 开头）不会把它当成风格目录。
//   3. **必须有上限**：日志可能很大（3D 渲染 7 分钟）。单任务日志 4MB（超了截断、保最新一半）、
//      全部日志 64MB（超了丢最旧的任务）、索引最多 120 条。**绝不无限增长**。
//   4. **启动加载必须能降级**：index.json 损坏 / JSON 非法 → 空历史 + warn，服务照常起。
//      宁可丢历史，也不能让控制台起不来。
//   5. **同步 appendFileSync，每行一次**：7 分钟 2 万行 ≈ 2 万次系统调用，摊在几分钟里可忽略。
//      换来的是「无缓冲、无竞态、进程被杀不丢已写行」—— 用写流反而会在崩溃时丢掉尾部缓冲。
//
// 目录结构：
//   D:\lemo-films\.console\index.json          任务元数据（数组，旧 → 新）
//   D:\lemo-films\.console\logs\<id>.jsonl     每任务一行一条 JSON 记录

import fs from 'node:fs';
import path from 'node:path';

// ★ 成片根的**唯一**口径在 lib/env.mjs 的 `CFG.exportDir`（它认 `LEMO_FILM_DIR` 覆盖点）。
//   本模块**不再自己算一份** —— 否则 `.console`（本模块）与 `.briefs` / `_jobs` / `dub`
//   （都从 `CFG.exportDir` 派生）就是「同一个成片根、两套来源」，设了覆盖点会各看各的树。
//   import 方向：store → env → styles-root，**无环**（env.mjs 的依赖闭包只有 styles-root.mjs，
//   而它只依赖 node:path、不反向 import store；env.mjs 也不 import store）。
//   未设 `LEMO_FILM_DIR` 时 `CFG.exportDir === 'D:\\lemo-films'` ⇒ 本行与原表达式**逐字节相同**。
import { CFG } from './env.mjs';

const ROOT = path.join(CFG.exportDir, '.console');
const LOG_DIR = path.join(ROOT, 'logs');
const INDEX_FILE = path.join(ROOT, 'index.json');
const INDEX_VERSION = 1;

// ★ 覆盖点（2026-10-07）：`LEMO_FILM_DIR` = **成片根目录**（默认 `D:/lemo-films`），
//   注册表根 = `<LEMO_FILM_DIR>/.console`（即上面那行 ROOT）。★ 变量名与默认值与
//   `scripts/prune-jobs.mjs` 的 FILM_DIR **逐字相同**（同义：prune-jobs 的 `_jobs/` 产物目录、
//   注册表 `.console/index.json`、日志 `.console/logs/<id>.jsonl` 都从同一个根派生）
//   ⇒ 给两者设同一个变量，三处**自动一致**。未设变量时路径与改动前**逐字节相同**。
//   由来：ROOT 此前是硬编码字面量 ⇒ **任何测试都无法在临时树上非破坏地验证「注册表相关」行为**
//   （实测 `test/cases.mjs` 的 ⑧ 会往**真实**共享存储写约 80MB 并覆写整个 index.json）。

export const CAPS = {
  perJobLogBytes: 4 * 1024 * 1024,    // 单任务日志文件上限
  compactToBytes: 2 * 1024 * 1024,    // 超限后截断到这个大小（保最新）
  totalLogBytes: 64 * 1024 * 1024,    // 全部日志文件总上限
  maxPersistJobs: 120,                // index.json 最多留多少条（也是内存里最多留多少条）
};

// ── 状态 ────────────────────────────────────────────────────
let ready = false;
let disabledReason = null;
const warned = new Set();
const sizes = new Map();     // id -> 日志文件字节数（惰性 stat）

function warn(msg) {
  if (warned.has(msg) || warned.size >= 30) return;
  warned.add(msg);
  console.warn(`  ⚠️  [历史落盘] ${msg}`);
}

export function storeStatus() {
  return { ready, disabledReason, root: ROOT, logDir: LOG_DIR, indexFile: INDEX_FILE, caps: CAPS };
}

// ── 初始化 ──────────────────────────────────────────────────
function ensureDirs() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    return true;
  } catch (e) {
    disabledReason = `无法创建 ${LOG_DIR}：${e.message}`;
    warn(`${disabledReason}（本次运行不落盘，任务照常跑）`);
    return false;
  }
}

function validMeta(m) {
  return m && typeof m === 'object'
    && typeof m.id === 'string' && m.id
    && typeof m.slug === 'string' && m.slug;
}

/**
 * 读历史索引。
 * ★ 任何异常都**降级为空历史**，绝不抛出 —— 控制台必须能起来。
 * @returns {{jobs: object[], error: string|null, ready: boolean}}
 */
export function loadIndex() {
  if (!ready) {
    ready = ensureDirs();
    if (!ready) return { jobs: [], error: disabledReason, ready: false };
  }
  let raw;
  try {
    raw = fs.readFileSync(INDEX_FILE, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') warn(`读历史索引失败（${e.message}）→ 按空历史启动`);
    return { jobs: [], error: e.code === 'ENOENT' ? null : e.message, ready: true };
  }
  try {
    const obj = JSON.parse(raw);
    const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.jobs) ? obj.jobs : null);
    if (!arr) throw new Error('index.json 里没有 jobs 数组');
    const jobs = arr.filter(validMeta);
    if (jobs.length !== arr.length) warn(`历史索引里有 ${arr.length - jobs.length} 条记录字段不全，已跳过`);
    return { jobs, error: null, ready: true };
  } catch (e) {
    warn(`历史索引损坏（${e.message}）→ **降级为空历史**，服务照常启动（下次写入会覆盖它）`);
    return { jobs: [], error: e.message, ready: true };
  }
}

// ── 日志文件 ────────────────────────────────────────────────
const logFile = (id) => path.join(LOG_DIR, `${id}.jsonl`);

function sizeOf(id) {
  if (sizes.has(id)) return sizes.get(id);
  let n = 0;
  try { n = fs.statSync(logFile(id)).size; } catch { /* 没写过 */ }
  sizes.set(id, n);
  return n;
}

/** 追加一条日志记录。best-effort：任何失败只 warn，不抛。 */
export function appendLog(id, rec) {
  if (!ready) return;
  let line;
  try { line = JSON.stringify(rec) + '\n'; } catch { return; }   // 环形引用等
  const file = logFile(id);
  try {
    fs.appendFileSync(file, line, 'utf8');
  } catch (e) {
    warn(`写日志失败 ${id}：${e.message}（该任务后续日志不再落盘，不影响任务本身）`);
    return;
  }
  const n = Buffer.byteLength(line, 'utf8');
  const total = sizeOf(id) + n;
  sizes.set(id, total);
  if (total > CAPS.perJobLogBytes) rotate(id);
}

/**
 * 轮转/截断：保留文件**最新的** compactToBytes 字节，前面补一条标记行。
 * 读写在同一个同步块里完成 —— 没有写流，所以不存在「截断后又被缓冲写回」的竞态。
 */
function rotate(id) {
  const file = logFile(id);
  try {
    const buf = fs.readFileSync(file);
    let start = Math.max(0, buf.length - CAPS.compactToBytes);
    while (start < buf.length && buf[start] !== 0x0a) start++;   // 对齐到下一行首，丢掉半行
    if (start < buf.length) start++;

    const dropped = start;
    const kept = buf.subarray(start);
    // 标记行的 n 取「第一条保留行的 n - 1」，这样按 n 过滤（SSE 续传）时它排在正确位置。
    let markerN = 0;
    try {
      const firstLine = kept.toString('utf8', 0, Math.min(kept.length, 4096)).split('\n')[0];
      const o = JSON.parse(firstLine);
      if (o && Number.isFinite(o.n)) markerN = Math.max(0, o.n - 1);
    } catch { /* 拿不到就 0 */ }
    const marker = JSON.stringify({
      n: markerN, stream: 'meta', t: Date.now(),
      line: `[落盘] 日志超过 ${(CAPS.perJobLogBytes / 1048576).toFixed(0)}MB 上限，已丢弃最旧的 ${dropped} 字节（保最新）`,
    }) + '\n';
    const head = Buffer.from(marker, 'utf8');
    fs.writeFileSync(file, Buffer.concat([head, kept]));
    sizes.set(id, head.length + kept.length);
  } catch (e) {
    warn(`轮转日志失败 ${id}：${e.message}`);
  }
}

/**
 * 读某任务的日志记录（最多 CAPS.perJobLogBytes）。失败返回 []。
 *
 * ★ 落盘时**不存 type**（冗余），但读回来必须补上 `type:'line'` —— 内存里/SSE 上
 *   的记录形状是 `{type:'line', n, stream, line, t}`，前端靠 `rec.type === 'line'` 分派。
 *   少了这个字段，恢复出来的日志会被前端**静默丢弃**（表现为：历史任务日志一片空白）。
 *   这是实测踩到的坑，别再省这个字段。
 */
export function loadLogs(id) {
  if (!ready) return [];
  let raw;
  try { raw = fs.readFileSync(logFile(id), 'utf8'); } catch { return []; }
  const out = [];
  for (const ln of raw.split('\n')) {
    if (!ln) continue;
    try {
      const o = JSON.parse(ln);
      if (o && typeof o.line === 'string') {
        out.push({ type: 'line', n: o.n, stream: o.stream || 'stdout', line: o.line, t: o.t || 0 });
      }
    } catch { /* 半行 / 损坏行：跳过，不影响其它行 */ }
  }
  return out;
}

/** 删掉某任务的日志文件（用于总量裁剪 / 内存回收时同步清理）。 */
export function dropLog(id) {
  try { fs.unlinkSync(logFile(id)); } catch { /* 没有就算了 */ }
  sizes.delete(id);
}

function totalLogBytes() {
  let sum = 0;
  try {
    for (const ent of fs.readdirSync(LOG_DIR, { withFileTypes: true })) {
      if (!ent.isFile()) continue;
      try { sum += fs.statSync(path.join(LOG_DIR, ent.name)).size; } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return sum;
}

// ── 索引落盘 ────────────────────────────────────────────────
/**
 * 写索引（原子：先写 .tmp 再 rename）。
 * 同时执行两条**总量上限**：条数上限、日志总字节上限 —— 超了从**最旧**开始丢。
 * @param {object[]} metas 旧 → 新
 */
export function saveIndex(metas) {
  if (!ready) return false;
  let list = metas.slice();

  // ① 条数上限（只丢已结束的，运行/排队中的一律保留）
  while (list.length > CAPS.maxPersistJobs) {
    const i = list.findIndex((m) => m.status !== 'running' && m.status !== 'queued');
    if (i < 0) break;
    dropLog(list[i].id);
    list.splice(i, 1);
  }

  // ② 日志总字节上限
  let total = totalLogBytes();
  for (let i = 0; i < list.length && total > CAPS.totalLogBytes; i++) {
    const m = list[i];
    if (m.status === 'running' || m.status === 'queued') continue;
    total -= sizeOf(m.id);
    dropLog(m.id);
    list.splice(i, 1);
    i--;
  }

  try {
    const tmp = INDEX_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ version: INDEX_VERSION, savedAt: new Date().toISOString(), jobs: list }), 'utf8');
    fs.renameSync(tmp, INDEX_FILE);      // Windows 上 Node 的 rename 会覆盖已存在的目标
    return true;
  } catch (e) {
    warn(`写历史索引失败：${e.message}`);
    return false;
  }
}
