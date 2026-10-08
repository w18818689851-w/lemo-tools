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
//   6. **索引写入是「跨进程读-改-写」，不是「把内存里的列表整个盖上去」**（2026-10-09 补）：
//      控制台**只在启动时读一次**索引（lib/jobs.mjs:loadHistory），之后整个进程生命周期都拿
//      内存副本写盘 ⇒ 与另一个实例（或 `scripts/prune-jobs.mjs --apply`）的写之间**没有任何串行化**，
//      这是教科书式的 lost update（实测：两个并发写入只剩一个）。所以 `saveIndex` 现在：
//        · 先拿一把**跨进程写锁**（拿不到就降级为不合并地写 + warn —— 绝不阻塞任务）；
//        · **重读**盘上的索引（`D`）；
//        · 以本进程的列表 `M` 为基准合并两条规则：
//          ① **盘上没有、而本进程上次同步时还有、这次仍持有** ⇒ **别人删了** ⇒ 跟着删。
//             （少了这条：一个持内存副本的实例会把别人的摘除**写回去** ⇒ 任务历史残留。）
//          ② **盘上有、而本进程从来就不认识**（既不在 `M`、也不在上次同步的快照里）⇒
//             **另一个实例建的** ⇒ 保留。
//             （少了这条：一次整文件重写会抹掉别人刚建的任务。）
//      ⇒ 合起来就是 `最终 = (M − 规则①) ∪ (D − 上次同步快照)`。
//      ★ 为什么不是「无脑 union」：union 会把**别人已删**的条目复活 ⇒ 反而加重「残留」。
//        规则①把「盘上没有」当作删除信号，所以**不需要**墓碑、也不改 `index.json` 格式。
//      ★ 判据与实测见 `_distill/store丢失更新-2026-10-09.md`。
//      ★★ **补充（2026-10-09 第 9 轮修）**：上面把 `scripts/prune-jobs.mjs --apply` 也列为并发写者，
//        但当时那把锁是**单边**的 —— `prune-jobs` 写索引**完全不走锁**（它的取锁函数还是模块私有、想用也用不到）
//        ⇒ 「锁也保护 prune」这句**当时不成立**（实测两种交错都会丢改动，见第 9 轮审计 A1）。
//        现 `acquireLock` / `releaseLock` **已导出**，且 `prune-jobs --apply` 改为「**拿同一把锁 → 重读 → 只摘本次
//        真删了的 id → 原子写**」⇒ 两个写者现在**共用同一把锁**（同一 root ⇒ 同一个 `index.lock`），这句才真正成立。
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

// ── 跨进程写锁 + 「上次同步」快照（见文件头「6.」）──────────────
//
// ★ 锁只护住「重读 → 合并 → 原子写」这一小段（几个同步 fs 调用，毫秒级）。
//   拿不到就**降级为不合并地写**并 warn —— 本模块的纪律是「绝不阻塞任务」，
//   宁可有竞态也不能让出片卡住。
// ★ 陈旧锁自动接管（持锁进程已死 / 持锁超过 LOCK_STALE_MS）：崩溃不会把锁永久留下。
const LOCK_FILE = path.join(ROOT, 'index.lock');
const LOCK_WAIT_MS = 300;
const LOCK_STALE_MS = 30 * 1000;
let writeSeq = 0;
let lastIds = new Set();     // 本进程「上次同步」时持有的 id 集（判「谁删了谁」的依据）

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function sleepSync(ms) {
  // ★ 注释与实现对齐（2026-10-09 第 9 轮修）：主路径是 **同步阻塞睡眠**（`Atomics.wait`），
  //   **不是**「自旋/忙等」。catch 体**什么都不做** ⇒ 环境不支持时本函数**立即返回（不睡）**；
  //   此时调用方 `acquireLock` 的 `for(attempt<200)` 会**连续重试**、整体退化成忙等。措辞别再含糊。
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* 环境不支持 Atomics.wait ⇒ 本函数立即返回（不睡）；忙等发生在调用方的重试循环里 */ }
}

/**
 * 拿跨进程写锁（同步、有界）。true = 拿到了；false = 超时/不可写（调用方降级为不合并地写）。
 * ★ **导出**（2026-10-09 第 9 轮修）：`scripts/prune-jobs.mjs --apply` 也写同一个 `index.json`，
 *   它必须用**同一把锁**（同一 root ⇒ 同一个 `index.lock`）才能与 `saveIndex` 真正串行化。
 *   详见文件头「6.」的 ★★ 补充。
 */
export function acquireLock() {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      fs.writeFileSync(LOCK_FILE, `${process.pid}\n${Date.now()}\n`, { flag: 'wx' });
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') return false;        // 目录不可写等 → 降级
      let holder = NaN; let ageMs = 0;
      try {
        const st = fs.statSync(LOCK_FILE);
        ageMs = Date.now() - st.mtimeMs;
        holder = Number(fs.readFileSync(LOCK_FILE, 'utf8').split('\n')[0]);
      } catch { /* 读不到内容 ⇒ 按陈旧处理 */ }
      const stale = !(Number.isInteger(holder) && holder > 0) || holder === process.pid
        || !pidAlive(holder) || ageMs > LOCK_STALE_MS;
      if (stale) { try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ } continue; }
      if (Date.now() >= deadline) return false;
      sleepSync(10);
    }
  }
  return false;
}

/** 释放锁。★ 只删「还是自己那把」的锁 —— 若锁已被别的进程接管（极端：本进程卡了 > LOCK_STALE_MS），
 *  绝不能去删别人的锁。★ **导出**（与 `acquireLock` 成对，供 `scripts/prune-jobs.mjs --apply` 共用）。 */
export function releaseLock() {
  try {
    const holder = Number(fs.readFileSync(LOCK_FILE, 'utf8').split('\n')[0]);
    if (holder === process.pid) fs.unlinkSync(LOCK_FILE);
  } catch { /* 没锁 / 读不到就算了 */ }
}

/**
 * 读盘上的 jobs 数组。★ 读失败 / 解析失败返回 `null` —— 调用方据此**跳过合并**，
 * 绝不把「读不到」误判成「盘上是空的」而删掉别人的任务。
 */
function readIndexJobs() {
  let raw;
  try { raw = fs.readFileSync(INDEX_FILE, 'utf8'); }
  catch (e) { return e.code === 'ENOENT' ? [] : null; }
  try {
    const obj = JSON.parse(raw);
    const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.jobs) ? obj.jobs : null);
    return arr ? arr.filter(validMeta) : null;
  } catch { return null; }
}

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
    lastIds = new Set();                 // 空历史 ⇒ 「上次同步」也是空的（saveIndex 据此不会误删别人的）
    return { jobs: [], error: e.code === 'ENOENT' ? null : e.message, ready: true };
  }
  try {
    const obj = JSON.parse(raw);
    const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.jobs) ? obj.jobs : null);
    if (!arr) throw new Error('index.json 里没有 jobs 数组');
    const jobs = arr.filter(validMeta);
    if (jobs.length !== arr.length) warn(`历史索引里有 ${arr.length - jobs.length} 条记录字段不全，已跳过`);
    lastIds = new Set(jobs.map((m) => m.id));   // ★ 记下「本进程这次读了哪些」——saveIndex 判「谁删了谁」的依据
    return { jobs, error: null, ready: true };
  } catch (e) {
    warn(`历史索引损坏（${e.message}）→ **降级为空历史**，服务照常启动（下次写入会覆盖它）`);
    lastIds = new Set();
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
 * 写索引（★ 跨进程安全：拿锁 → 重读 → 合并 → 原子写，见文件头「6.」）。
 * 同时执行两条**总量上限**：条数上限、日志总字节上限 —— 超了从**最旧**开始丢。
 * @param {object[]} metas 旧 → 新（★ 契约：必须是本进程**当前持有的完整列表**，
 *   不是「本次新增的那几条」—— 合并要靠「上次同步有、这次没有」来识别删除）
 */
export function saveIndex(metas) {
  if (!ready) return false;
  const mine = Array.isArray(metas) ? metas.slice() : [];
  const mineIds = new Set(mine.filter((m) => m && m.id).map((m) => m.id));

  const locked = acquireLock();
  if (!locked) warn('写索引没拿到跨进程锁（另一实例正在写）→ 本次不合并地写，对方的改动可能被覆盖');
  try {
    // ── ① 重读盘上的索引（拿锁之后再读，读到的才是「当前」的）──
    const disk = readIndexJobs();       // null = 读失败 ⇒ 跳过合并（保持旧行为，绝不误删）

    // ── ② 合并（两条规则见文件头「6.」）──
    let list = mine;
    if (disk) {
      const diskIds = new Set(disk.filter((m) => m && m.id).map((m) => m.id));
      // 规则①「别人删了，跟着删」：本进程**上次同步时还有**、这次仍持有，但盘上已经没有了。
      list = mine.filter((m) => !(m && lastIds.has(m.id) && !diskIds.has(m.id)));
      // 规则②「别抹掉别人的任务」：盘上有、而本进程**从来就不认识**的条目 ⇒ 另一个实例建的 ⇒ 保留。
      //   （本进程认识、这次不再持有的，是**本进程自己删的**，不在此列。）
      for (const d of disk) {
        if (!d || !d.id || mineIds.has(d.id) || lastIds.has(d.id)) continue;
        list.push(d);
      }
    }

    // ── ③ 条数上限（只丢已结束的，运行/排队中的一律保留）──
    while (list.length > CAPS.maxPersistJobs) {
      const i = list.findIndex((m) => m.status !== 'running' && m.status !== 'queued');
      if (i < 0) break;
      dropLog(list[i].id);
      list.splice(i, 1);
    }

    // ── ④ 日志总字节上限 ──
    let total = totalLogBytes();
    for (let i = 0; i < list.length && total > CAPS.totalLogBytes; i++) {
      const m = list[i];
      if (m.status === 'running' || m.status === 'queued') continue;
      total -= sizeOf(m.id);
      dropLog(m.id);
      list.splice(i, 1);
      i--;
    }

    // ── ⑤ 原子写 ──
    // ★ tmp 名带 pid + 序号：两个进程若共用同一个 `.tmp`，会互相 rename 抢 —— 实测一方抛
    //   `EPERM: operation not permitted, open '...index.json.tmp'`，那一方的写**整个失败**、
    //   改动静默丢失（best-effort 只 warn）。带 pid 后各写各的 tmp，至少不会互相打断。
    const tmp = `${INDEX_FILE}.${process.pid}.${(writeSeq += 1)}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify({ version: INDEX_VERSION, savedAt: new Date().toISOString(), jobs: list }), 'utf8');
      fs.renameSync(tmp, INDEX_FILE);      // Windows 上 Node 的 rename 会覆盖已存在的目标
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }   // 别留半个 tmp
      throw e;
    }
    lastIds = mineIds;                     // ★ 记下「本进程这次持有哪些」
    return true;
  } catch (e) {
    warn(`写历史索引失败：${e.message}`);
    return false;
  } finally {
    if (locked) releaseLock();
  }
}
