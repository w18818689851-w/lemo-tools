// lib/store.mjs —— 任务历史与日志落盘（**尽力而为**，失败只 warn）
//
// ★ 为什么需要它：一个 3D 任务要跑 7 分钟。跑完重启控制台，任务记录和几万行日志
//   全没了 —— 这是真实的数据丢失，不是「体验问题」。
//
// ★ 设计要点（勿轻易改）：
//   1. **落盘是尽力而为**：任何一次写失败都只 warn 一次，绝不抛出、绝不让任务失败。★ 例外（2026-10-12 修 W1-2）：「日志总量 / 孤儿」这一类（**破坏性动作**、**长期超限**）走 `report()` / `reportOnce()` —— **不受** `warn()` 的全字符串去重与 30 条全局预算限制（见文件末尾）。
//      控制台的价值是「把 CLI 包起来」；磁盘问题不该反过来把它搞挂。
//   2. **不写 C 盘**：默认固定在 D:\lemo-films\.console（与成片同盘；根可由 `LEMO_FILM_DIR` 改）。以 `.` 开头，
//      所以 server.mjs 的 /api/films 扫描（跳过 `.` 开头）不会把它当成风格目录。
//   3. **必须有上限**：日志可能很大（3D 渲染 7 分钟）。单任务日志 4MB（超了截断、保最新一半）、
//      全部日志 64MB（超了丢最旧的任务）、索引最多 120 条。**绝不无限增长**（★ 例外，2026-10-12 修 W1-1：**索引外的孤儿日志不由本模块删除** —— 它们可能正是用户那次任务唯一的残留，只报告不删，见 `trimLogsToCap` ② 段）。
//   4. **启动加载必须能降级**：index.json 损坏 / JSON 非法 → 空历史 + warn，服务照常起。
//      宁可丢历史，也不能让控制台起不来。
//   5. **同步 appendFileSync，每行一次**：7 分钟 2 万行 ≈ 2 万次系统调用，摊在几分钟里可忽略。
//      换来的是「无缓冲、无竞态、进程被杀不丢已写行」—— 用写流反而会在崩溃时丢掉尾部缓冲。
//   6. **索引写入是「跨进程读-改-写」，不是「把内存里的列表整个盖上去」**（2026-10-09 补）：
//      控制台**只在启动时读一次**索引（lib/jobs.mjs:loadHistory），之后整个进程生命周期都拿
//      内存副本写盘 ⇒ 与另一个实例（或 `scripts/prune-jobs.mjs --apply`）的写之间**没有任何串行化**，
//      这是教科书式的 lost update（实测：两个并发写入只剩一个）。所以 `saveIndex` 现在：
//        · 先拿一把**跨进程写锁**（**拿不到也照常「重读 + 合并」**、只多一条 warn —— 绝不阻塞任务；
//          代价：「读盘 → 原子写」之间有竞态窗口，对方的改动**可能**被覆盖）；
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
//   拿不到就**带 warn 继续写**（**仍然「重读 + 合并」** —— 合并总比丢掉别人的条目更安全）——
//   本模块的纪律是「绝不阻塞任务」，宁可有竞态也不能让出片卡住。
// ★ 陈旧锁自动接管（持锁进程已死 / 持锁超过 LOCK_STALE_MS）：崩溃不会把锁永久留下。
//
// ★★ 2026-10-10 修（D7 —— 修 RISK-05 时发现的**新缺陷**）：旧实现用
//   `writeFileSync(LOCK_FILE, 内容, {flag:'wx'})` 建锁。`wx` 是 **先 O_CREAT|O_EXCL 建出空文件、再写内容**，
//   于是存在一个「**锁文件已存在、但内容还没写进去**」的窗口：此刻另一进程 `readFileSync` 读到空串
//   ⇒ `Number('') = NaN` ⇒ 旧判据 `!(Number.isInteger(holder) && holder>0)` 把锁判成**陈旧** ⇒ `unlinkSync`
//   删掉**赢家**的锁 ⇒ 两个进程都自认持锁（实测 8 子进程里最多 2~3 个同时「拿锁成功」）。
//   根因修法（★ 原子创建，创建与内容**一体**）：先把内容写进**私有 tmp**，再 `linkSync(tmp, LOCK_FILE)`——
//   `link` 是原子的，目标已存在必 `EEXIST`，且「锁文件出现」与「内容就位」是同一步，**不存在空文件窗口**。
//   配套（★ 两道一起上）：判陈旧前**必须先能读出 holder**；读不出（空/被删）**一律不判陈旧**，
//   只堵「误删」还不够（不堵两个都自认持有），故**原子创建 + 不判空文件陈旧**两者都要。
const LOCK_FILE = path.join(ROOT, 'index.lock');
const LOCK_WAIT_MS = 300;
const LOCK_STALE_MS = 30 * 1000;
let writeSeq = 0;
let lockSeq = 0;             // 锁 tmp 名的单调序号（与 pid 合起来保证唯一）
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
 * 拿跨进程写锁（同步、有界）。true = 拿到了；false = 超时/不可写（调用方**仍会「重读 + 合并」**后写，只是多一条 warn）。
 * ★ **导出**（2026-10-09 第 9 轮修）：`scripts/prune-jobs.mjs --apply` 也写同一个 `index.json`，
 *   它必须用**同一把锁**（同一 root ⇒ 同一个 `index.lock`）才能与 `saveIndex` 真正串行化。
 *   详见文件头「6.」的 ★★ 补充。
 */
export function acquireLock() {
  // ★ 锁目录可能还不存在：本模块被 `lib/llm-api.mjs` 复用时，调用方未必走过 `loadIndex()`/`ensureDirs()`
  //   ⇒ 先确保 `<root>/.console` 在（否则私有 tmp 写入 ENOENT ⇒ 恒返回 false ⇒ 恒降级为「无锁」）。
  try { fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true }); } catch { /* 建不了 ⇒ 交给下面写入失败降级 */ }
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (let attempt = 0; attempt < 200; attempt++) {
    // ★ 原子创建（见上方「★★ 2026-10-10 修（D7）」）：内容先进私有 tmp，再 link 到锁路径。
    const tmp = `${LOCK_FILE}.${process.pid}.${(lockSeq += 1)}.tmp`;
    let created = false;
    try {
      fs.writeFileSync(tmp, `${process.pid}\n${Date.now()}\n`, { flag: 'wx' });
      created = true;
      fs.linkSync(tmp, LOCK_FILE);            // ★ 原子：目标已存在 ⇒ EEXIST；成功即「内容已就位」
      return true;
    } catch (e) {
      if (!created) return false;             // 连私有 tmp 都建不了（目录不可写等）→ 降级
      if (e.code !== 'EEXIST') return false;  // 不支持硬链接等 → 降级（拿不到锁，调用方仍「重读 + 合并」）
      // e.code === 'EEXIST' ⇒ 锁被别人持有，落到下面判陈旧
    } finally {
      // link 成功后 tmp 只是同一 inode 的多余名字，删掉它；失败路径也要清掉 tmp。
      if (created) { try { fs.unlinkSync(tmp); } catch { /* ignore */ } }
    }
    let holder = NaN; let ageMs = 0; let readable = false;
    try {
      const st = fs.statSync(LOCK_FILE);
      ageMs = Date.now() - st.mtimeMs;
      const first = fs.readFileSync(LOCK_FILE, 'utf8').split('\n')[0];
      holder = Number(first);
      readable = Number.isInteger(holder) && holder > 0;
    } catch { /* 读不到（已被删 / 权限）⇒ readable=false */ }
    // ★ 只有**能读出合法 holder** 时才允许判陈旧/接管；读不出绝不判陈旧（否则会误删刚建立、内容尚未可见的锁）。
    const stale = readable && (holder === process.pid || !pidAlive(holder) || ageMs > LOCK_STALE_MS);
    if (stale) { try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ } continue; }
    if (Date.now() >= deadline) return false;
    sleepSync(10);
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
    warn(`历史索引损坏（${e.message}）→ **降级为空历史**，服务照常启动（下次写入会覆盖它）${orphanNote()}`);
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
  if (!locked) warn('写索引没拿到跨进程锁（另一实例正在写）→ 仍会「重读 + 合并」后写，但「读盘 → 原子写」之间有竞态窗口，对方的改动可能被覆盖');
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

    // ── ④ 日志总字节上限（★ 2026-10-12 修 F1，同日再修 W1-1/W1-2/W1-3：判据与动作**同源** —— 见 trimLogsToCap）──
    //    判据 = **目录总量**（真正占盘的就是它）；动作 = 只动「本进程管得着的」= 本列表里**已结束**条目的日志。
    //    旧实现用目录总量判、却只删列表条目 ⇒ 盘上有索引里没有的日志（孤儿）时，「删不动」的字节
    //    把整个列表拖下水：每轮都把历史删光、总量还压不回上限（越裁越空、越空越裁，自我持续）。
    //    ★ W1-1：**索引外的孤儿日志一个字节都不动**（不删也不改名）—— 它们可能正是用户那次任务唯一的
    //    残留；只在下面这条 `report` 里**点名报警**（② 段还带 `need ≤ deletable` 的守卫，不做无意义的破坏）。
    const trimmed = trimLogsToCap(list, disk);
    if (trimmed.over > 0) {
      report(trimReport(trimmed, list.length));   // ★ 类别告警通道（W1-2）：不受 `warn` 的去重与 30 条预算限制
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

// ── 日志总量裁剪（`saveIndex` ④ 段的**全部**逻辑）★ 2026-10-12 修 F1，同日再修 W1-1/W1-2/W1-3 ────
//
// ★ 缺陷（第八批审计 F1，P1，实测）：旧实现用 `totalLogBytes()`（**整个 `LOG_DIR`**）判「超没超上限」，
//   却只删**注册表列表里**的条目 ⇒ 盘上有、索引里没有的日志（孤儿）**永远删不掉** ⇒ 总量**永远超限**
//   ⇒ 每一轮都把列表里剩下的条目继续删光（实测 `index 条目 = 0`，连续 3 轮都是 0，而磁盘仍超限）。
//   一次触发即**永久丢光全部任务历史**，且此后**永远修不好**（越裁越空、越空越裁）。
//   触发前提**不是极端条件**：日志总量被 64MB 上限常年压在接近上限，此时**任何一次 `index.json`
//   损坏**（`loadIndex` 明确预期并处理的那种）就把旧日志全变成孤儿。
//
// ★★ 对抗式验证（W1，2026-10-12）**证伪了第一版修复**（`D:/lemo-tmp/align-audit/W1-第八批P1修复的对抗式验证.md`）：
//   第一版**把「排除孤儿字节」做成了「主动删除孤儿日志」** —— 而「孤儿」的来历恰恰就是 F1 自己列的
//   两条可达路径：① `index.json` 损坏 ⇒ `loadIndex` 降级为空历史；② 控制台在 `persistSoon()` 的 500ms
//   去抖窗口里被 `taskkill /F` ⇒ 日志已同步落盘、注册表条目**从未写成功**。
//   **后一种情形下那个日志文件是用户那次任务唯一的残留**（实测：65 个 1MB 老孤儿在 3 轮落盘后
//   被永久删掉 7 个，继续跑就会删光 65 个；改前版一个都没删）。审计的原文是「**排除 + 报告**」
//   （把孤儿字节排除出判据、**报告**它们存在），不是「删掉它们」。
//
// ★★★ 现口径（四条，逐条对应 W1 的三条发现）：
//   ① **判据 = 目录总量**（真正占盘的就是它，上限要管的也是它）；**动作 = 只动「本进程管得着的」**：
//      只有**本列表里已结束**条目的日志会被删（③ 段）。★ W1-1：**索引外的孤儿日志一个字节都不动**
//      —— 不删，**也不改名**（`.orphan-<ts>` 那种归档虽然可逆，却会**打断 `<id>.jsonl` 这个
//      id→文件映射**：索引一旦恢复/修好，`loadLogs(id)` 就再也读不到那份日志）。它们只被**报告**（② 段）。
//   ② **不做「删了也白删」的破坏**：孤儿字节**不可回收**（既不删、就不腾空间）⇒ 只有当「删得动的」
//      字节**够**（`need ≤ deletable`）时才裁历史；否则**一条都不裁**，把数字与原因交给调用方报警。
//      ★ 这道守卫才是 F1「越裁越空、越空越裁」本体的补丁（旧实现没有它）。
//   ③ **报告不受抑制**（W1-2）：破坏性动作（裁了历史）与长期超限状态走 `report()`（每次都说）/
//      `reportOnce()`（同类状态说一次）—— **不受** `warn()` 的全字符串去重与 30 条全局预算限制。
//      实测旧通道：稳定态连调 4 轮只有第 1 轮说话；先灌 30 条互不相同的无关 warn 之后，
//      删掉 40MB 孤儿时**一条 warn 都没有**。★ 代价：长期超限时**每轮一条**（有意为之 ——
//      「不静默」优先于「少刷屏」；调用方 `lib/jobs.mjs` 的 `persistSoon()` 有 500ms 去抖 ⇒ 上界约 2 条/秒）。
//   ④ **读不到盘上索引 ⇒ 更保守、且文案必须诚实**（W1-3）：`disk === null` 时连「哪些日志有主人」
//      都判不了（另一个实例正在写的日志也会被算成「孤儿」）⇒ 报告文案必须说「本进程**读不到**
//      盘上索引，无法确认这些日志是否还有主人」，**绝不**说「没有任何任务记录引用它们」。
//      （旧文案在 `disk === null` 时是**不成立的** —— 有任务记录引用它们，只是本进程读不到那个文件。）
//   ★ 明令禁止的两件事都没做：**不放宽上限**（`CAPS.totalLogBytes` 一字未动）、
//     **不改成「静默不裁」**（该裁的照裁，只是不再把「删不动的东西」算到列表头上、也不动用户的日志）。
//
// ★ 定义在 `saveIndex` 之后是**有意**的：`lib/briefs.mjs` 按行号引用了 `saveIndex` 的原子写那行
//   （`` `lib/store.mjs:404` ``）⇒ 本文件**新增的常量与函数一律放在文件末尾**、不动前面的行号。
const ORPHAN_GRACE_MS = 10 * 1000;   // 孤儿日志的**年龄门槛**：只用来把「刚出现的」与老孤儿分开说
//
//   ★ 为什么要这道门槛：「盘上有、索引里没有」的日志才是孤儿，但**刚出现**的孤儿可能是
//     **另一个控制台实例**刚建、还没写进 `index.json` 的任务（`lib/jobs.mjs` 的 `persistSoon()`
//     有 500ms 去抖）⇒ 报告里必须把它们与老孤儿**分开说**（门槛 = 去抖窗口的 20 倍）。
//   ★ 门槛**不再**是「删/不删」的分界（本函数已不删孤儿），只影响报告措辞与 `orphansFresh` 计数。
//
// @param {object[]} list 合并后、即将写盘的条目（旧 → 新）—— 本函数会**原地 splice** 它。
// @param {object[]|null} disk ① 段重读到的盘上索引（`null` = 读不到 ⇒ 不能拿它认领日志）。
// @returns {{total:number, over:number, entries:number, trimmedBytes:number, orphans:number, orphanBytes:number, orphansFresh:number, diskReadable:boolean}}
//   `over` = **复核后**仍超出的字节数（> 0 ⇒ 调用方必须报警）。
function trimLogsToCap(list, disk) {
  const diskReadable = Array.isArray(disk);     // false = 读不到盘上索引（损坏 / EBUSY / EPERM）
  const listIds = new Set();
  const isEnded = (m) => !(m && (m.status === 'running' || m.status === 'queued'));
  for (const m of list) if (m && m.id) listIds.add(m.id);
  // ★ 盘上索引里的 id 也算「有人认领」：另一个实例已删的条目，其日志文件可能还在 —— 保守起见不当孤儿。
  //   ★ W1-3：`disk === null` 时**一个盘上 id 都认领不了** ⇒ 被算成「孤儿」的日志里可能就有另一个
  //     实例正在写的任务 ⇒ 本函数对孤儿**只报告、不动手**（② 段），且文案必须如实说「读不到索引」。
  const claimed = new Set(listIds);
  if (diskReadable) for (const d of disk) if (d && d.id) claimed.add(d.id);

  // ── ① 盘点：目录总量 / 「删得动的」（本列表里已结束条目的日志）/ 孤儿（索引外的日志）──
  let dirTotal = 0, deletable = 0, orphanBytes = 0, orphansFresh = 0;
  const orphans = [];
  const endedIds = new Set(list.filter((m) => m && m.id && isEnded(m)).map((m) => m.id));
  let ents = [];
  try { ents = fs.readdirSync(LOG_DIR, { withFileTypes: true }); } catch { /* 读不到 ⇒ 按空算 */ }
  const now = Date.now();
  for (const ent of ents) {
    if (!ent.isFile()) continue;
    const full = path.join(LOG_DIR, ent.name);
    let size = 0, mtimeMs = 0;
    try { const st = fs.statSync(full); size = st.size; mtimeMs = st.mtimeMs; } catch { continue; }
    dirTotal += size;
    const id = ent.name.replace(/\.jsonl$/, '');
    if (endedIds.has(id)) { deletable += size; continue; }    // 已结束条目的日志 ⇒ ③ 删得动（判据与动作同源）
    if (claimed.has(id)) continue;                            // 本列表里进行中的 / 盘上索引里有 ⇒ 不是孤儿
    orphanBytes += size;                                      // 盘上有、索引里没有 ⇒ 孤儿（★ 只报告）
    if (now - mtimeMs < ORPHAN_GRACE_MS) orphansFresh += 1;   // 刚出现的：可能正是另一个实例正在跑的任务
    orphans.push({ full, size, mtimeMs });
  }
  let need = dirTotal - CAPS.totalLogBytes;                   // 要让目录总量回到上限，必须腾出这么多
  if (need <= 0) {
    // 不超限 ⇒ 一步都不做。★ 但孤儿仍然**报告一次**（审计的「报告」那一半：让用户知道该清哪个目录）。
    if (orphans.length) reportOnce(orphanReport(orphans.length, orphanBytes, orphansFresh, diskReadable));
    return { total: dirTotal, over: 0, entries: 0, trimmedBytes: 0, orphans: orphans.length, orphanBytes, orphansFresh, diskReadable };
  }

  // ── ② 索引外的孤儿：★ **一个字节都不动**（2026-10-12 修 W1-1），只报告 ──
  //    ★ 为什么不删：见文件头「★★★ ①」（孤儿可能正是用户那次任务唯一的残留）。
  //    ★ 为什么**也不改名**：`.orphan-<ts>` 归档虽然可逆，却会打断 `<id>.jsonl` 这个 id→文件映射
  //      —— 索引一旦恢复（用户手工修好 / 从备份找回），`loadLogs(id)` 就再也读不到那份日志。
  //    ★ 注意：孤儿字节**不可回收**（不删就不腾空间）⇒ `need` **不因它们减少**，下面的 ③ 段仍按
  //      **目录总量**与 `deletable` 的差额决定要不要裁历史（判据与动作同源，**不放宽上限**）。
  //      ⇒ 本段**没有**任何 fs 写调用（不 unlink、不 rename），这是 W1-1 的可测判据。
  const orphanCount = orphans.length;                          // （孤儿只被计数与报告）

  // ── ③ 还超 ⇒ 从最旧开始丢「已结束」的条目（老行为：running/queued 一律不动）。
  //    ★ 只在**删得动**（`need ≤ deletable`）时才删：删了也压不回上限时不做无意义的破坏。──
  let trimmed = 0, trimmedBytes = 0;
  if (need > 0 && need <= deletable) {
    for (let i = 0; i < list.length && need > 0; i++) {
      const m = list[i];
      if (!isEnded(m)) continue;
      const size = sizeOf(m.id);
      dropLog(m.id);
      list.splice(i, 1);
      i--;
      need -= size;
      trimmed += 1;
      trimmedBytes += size;
    }
  }
  // ★ 删了东西就**必须说话**（F1 的第二宗罪是「静默」）。★ W1-2 实测：旧通道下这条会被前面 30 条
  //   互不相同的无关 warn 挤掉 ⇒ 这里走 `report()`：**不受**去重与 30 条预算限制，**每次都报**。
  if (trimmed) {
    report(`日志总量 ${mb(dirTotal)} 超过上限 ${mb(CAPS.totalLogBytes)} ⇒ 已按「最旧优先」裁掉 ${trimmed} 条**已结束**任务（连同其日志 ${mb(trimmedBytes)}；running/queued 一律不动）${orphanTail(orphanCount, orphanBytes, orphansFresh, diskReadable)}`);
  }

  // ── ④ 复核：总量真的降下来了吗（★ 不静默：仍超限时调用方按返回值报警）──
  const total = totalLogBytes();
  return {
    total, over: Math.max(0, total - CAPS.totalLogBytes), entries: trimmed, trimmedBytes,
    orphans: orphanCount, orphanBytes, orphansFresh, diskReadable,
  };
}

// ── 索引降级时给孤儿日志**点名**（★ 2026-10-12 修 F1 的第二处：消「静默」）─────────────
//
// ★ 旧行为：`loadIndex` 降级只说「下次写入会覆盖它」，对 `logs/` 里那批「盘上有、索引没有」的日志
//   **一个字都不说** —— 用户既不知道它们存在，也不知道它们是下一步「越裁越空」的燃料。
// ★ 返回一段可直接拼进 warn 的说明（没有孤儿 ⇒ 空串），**不抛**（本模块的纪律：失败只 warn）。
// ★★ W1-1 订正（2026-10-12）：原文案承诺「下次落盘在总量超限时会把它们清掉」—— 那句话现在是**假的**，
//   而且它正是「把用户日志删掉」的那条路。现如实说：**本模块不会删它们**，请人工确认后再清理。
function orphanNote() {
  let n = 0, bytes = 0;
  try {
    for (const ent of fs.readdirSync(LOG_DIR, { withFileTypes: true })) {
      if (!ent.isFile()) continue;
      try { bytes += fs.statSync(path.join(LOG_DIR, ent.name)).size; n += 1; } catch { /* ignore */ }
    }
  } catch { return ''; }
  if (!n) return '';
  return `；★ 另：logs/ 里还有 ${n} 个日志文件（${mb(bytes)}）现在是「盘上有、索引里没有」的孤儿 —— 索引已降级为空，本进程没有任何任务记录会引用它们。★ 但本模块**不会删它们**（2026-10-12 修 W1-1：它们可能正是用户那次任务唯一的残留，只是索引读不到）⇒ 请人工确认后再清理；下次落盘只会在**总量超限**时点名报警，一个字节都不动`;
}

// ── 告警通道（★ 2026-10-12 修 W1-2）────────────────────────────────────────────
//
// ★ 病灶（W1 实测，两条都复现了）：`warn()` 是「**全字符串去重** + **30 条全局预算**」⇒
//   · 稳定态连调 4 轮 ⇒ 只有第 1 轮说话（第 2/3/4 轮**彻底静默**）—— 而「状态稳定」恰恰就是
//     「磁盘长期超限」的定义；
//   · 先灌 30 条互不相同的无关 warn（磁盘真出问题时 `写日志失败 <id>` 按 id 各不相同，很容易攒满）
//     ⇒ 之后**删掉 40MB 孤儿时一条 warn 都没有** —— 最该报的那条报警在最需要它的时刻消失。
// ★ 修法：给「日志总量 / 孤儿」这一类单开两条**不受 `warned` 集合与 30 条预算限制**的通道：
//   · `report(msg)`     —— **每次都报**：用于**破坏性动作**（裁了历史）与**长期超限**状态。
//   · `reportOnce(msg)` —— 同类状态**说一次**（按文案去重，**不**受 30 条预算限制）：用于
//     「有孤儿但不超限」这类**信息**（不至于每 500ms 刷一条）。
//   ★ 为什么不做「同类 N 分钟内一条」：W1 的实测 A 就是**同一状态连调 4 轮**（毫秒级），
//     任何时间窗都会把它压回「只有第 1 轮说话」⇒ 治不了那条实测。故长期超限状态**每轮都报**。
//   ★ 代价如实记下：长期超限时每轮一条（调用方 `lib/jobs.mjs` 的 `persistSoon()` 有 500ms 去抖
//     ⇒ 上界约 2 条/秒）。「不静默」是本模块的既定纪律，这里选择它优先于「少刷屏」。
//   ★ 两者都放在**文件末尾**：见上方「定义在 `saveIndex` 之后是有意的」（行号引用）。
const onceReported = new Set();
function report(msg) {
  console.warn(`  ⚠️  [历史落盘] ${msg}`);
}
function reportOnce(msg) {
  if (onceReported.has(msg)) return;
  onceReported.add(msg);
  report(msg);
}

const mb = (n) => `${(n / 1048576).toFixed(1)}MB`;

/** 孤儿日志的**报告文案**（★ 只报告、不动手：W1-1；★ `disk === null` 时文案必须诚实：W1-3）。 */
function orphanReport(n, bytes, fresh, diskReadable) {
  const why = diskReadable
    ? '它们不属于任何任务记录（多半是 `index.json` 损坏降级、或控制台在 500ms 去抖窗口里被硬杀时留下的**那次任务唯一的残留**）⇒ **请人工确认后再清理**'
    : '★ 本进程**读不到**盘上索引（损坏 / 被占用）⇒ **无法确认这些日志是否还有主人**（也可能是另一个控制台实例正在跑、还没落盘的任务）';
  const freshNote = fresh ? `；其中 ${fresh} 个是刚出现的（${ORPHAN_GRACE_MS / 1000} 秒内）—— 很可能正是另一个实例正在跑的任务` : '';
  return `logs/ 里有 ${n} 个**索引外的孤儿日志**（${mb(bytes)}）：${why}${freshNote}。★ 本模块**一个字节都没动**（不删、不改名）`;
}

/** 拼在「裁了历史」那条报告末尾的孤儿说明（没有孤儿 ⇒ 空串）。 */
function orphanTail(n, bytes, fresh, diskReadable) {
  if (!n) return '';
  const freshNote = fresh ? `（其中 ${fresh} 个是刚出现的）` : '';
  const why = diskReadable ? '' : ' —— ★ 本进程读不到盘上索引，**无法确认它们是否还有主人**';
  return `；★ 另有 ${n} 个索引外的孤儿日志 / ${mb(bytes)}${freshNote}**一个字节都没动**${why}`;
}

/** 「裁剪后仍超限」那条报告（★ 由 `saveIndex` ④ 段调用；**每次都报**）。 */
function trimReport(t, kept) {
  const parts = [`日志总量裁剪后仍 ${mb(t.total)} > 上限 ${mb(CAPS.totalLogBytes)}`];
  if (t.entries) parts.push(`（本轮已裁掉最旧的 ${t.entries} 条已结束任务 / ${mb(t.trimmedBytes)}）`);
  if (t.orphans) {
    const freshNote = t.orphansFresh ? `（其中 ${t.orphansFresh} 个是刚出现的）` : '';
    const why = t.diskReadable
      ? '，它们不属于任何任务记录、请人工确认后再清理'
      : ' —— ★ 本进程**读不到**盘上索引，**无法确认这些日志是否还有主人**';
    parts.push(`；仍剩 ${t.orphans} 个索引外的孤儿日志 / ${mb(t.orphanBytes)}${freshNote}**一个字节都没动**${why}`);
  }
  parts.push(`；⇒ 已保留 ${kept} 条任务历史、不再做「删了也压不回上限」的破坏。请人工看 ${LOG_DIR}`);
  return parts.join('');
}
