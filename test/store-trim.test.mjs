// test/store-trim.test.mjs —— 第八批审计 F1 / F4 / F5 / F6 的**仓内回归测试**（独立入口，零依赖）
//
// ★ 由来：2026-10-12 的第八批对抗性审计（`D:/lemo-tmp/align-audit/U1-第八批审计-数据完整性与持久化.md`）
//   找到三条**数据完整性**缺陷（F1/F4/F5；★ 同批的 F6 是**版本闸门**，见下「钉住的**四件事**」最后一条），
//   修复的实证只在 `D:/lemo-tmp/u1-fix/` 的探针里
//   （`f1-probe.mjs` / `f1-normal.mjs` / `f1-fresh.mjs` / `prune-probe.mjs`；F6 在 `D:/lemo-tmp/f6/probe.mjs`）。
//   本文件把那些场景**转成仓内回归测试**（本项目纪律：改核心逻辑必补测试）。
//
// ★ 钉住的**四件事**：
//   · **F1（P1 · `lib/store.mjs` 的日志总量裁剪）**：旧实现用 `totalLogBytes()`（**整个 `LOG_DIR`**）
//     判「超没超 64MB」，却只删**注册表列表里**的条目 ⇒ 盘上有、索引里没有的日志（孤儿）**永远删不掉**
//     ⇒ 总量**永远超限** ⇒ 每一轮都把列表里剩下的条目继续删光（实测 `index 条目 = 0`，连续 3 轮都是 0）。
//     一次触发即**永久丢光全部任务历史**，且此后永远修不好（越裁越空、越空越裁）。
//     ★★ 2026-10-12 对抗式验证（W1，`D:/lemo-tmp/align-audit/W1-第八批P1修复的对抗式验证.md`）
//     **证伪了第一版修复**：它把审计建议的「**排除 + 报告**」做成了「**主动删除孤儿日志**」——
//     而「孤儿」的来历恰恰就是 F1 自己列的触发路径（`index.json` 损坏降级 / 控制台在 `persistSoon()`
//     的 500ms 去抖窗口里被硬杀 ⇒ 日志已落盘、条目从未写成功，**那份日志是那次任务唯一的残留**）。
//     实测 65 个 1MB 老孤儿在 3 轮落盘后被永久删掉 7 个（继续跑就删光 65 个）。
//     ★ 现口径（本文件钉住的）：① 判据仍是**目录总量**；② 动作只动**本进程管得着的**（本列表里
//     **已结束**条目的日志）⇒ **索引外的孤儿日志一个字节都不动**（**不删、也不改名** —— `.orphan-<ts>`
//     归档会打断 `<id>.jsonl` 这个 id→文件映射，索引修好后 `loadLogs(id)` 就再也读不到它）；
//     ③ 只有「删得动的字节**够**」（`need ≤ deletable`）时才裁历史（**不放宽上限**、也不做「删了也压不回
//     上限」的破坏）；④ **报告不受抑制**：破坏性动作 / 长期超限走 `report()`（**每次都说**），
//     「有孤儿但不超限」走 `reportOnce()`（说一次）—— 都不受 `warn()` 的去重与 30 条预算限制；
//     ⑤ `disk === null`（读不到盘上索引）时文案必须**如实**说「读不到、无法确认这些日志是否还有主人」。
//   · **F4（P2 · `scripts/prune-jobs.mjs`）**：UI 的 `deleteJob` 只删注册表条目 + 日志、**不碰 `_jobs/<id>/`**
//     ⇒ 留下**永久不可发现**的孤儿产物目录（旧版脚本只遍历注册表 ⇒ 既不删也不报）。
//     现脚本**也扫 `_jobs/`**：没有注册表条目的目录 = 孤儿，dry-run 逐个列名 + 字节并计入汇总、
//     `--apply` 按同一把 `rmInside` 安全闸删；`--keep` 对它们**不适用**（它们不是任务）。
//   · **F5（P3 · `scripts/prune-jobs.mjs`）**：首次读注册表时 `JSON.parse` 在 try 之外
//     ⇒ 注册表一坏就抛**未捕获异常**（原始堆栈 + exit 1），这个「专门收拾 `_jobs/` 的运维命令」
//     在最需要它的时候**完全不可用**。现首次读也包在 try 内 ⇒ 读不到 / 形状不对 ⇒ **exit 2 拒绝执行**
//     （一个字节都不动）。★ 为什么**不能**「当成空注册表」：那样 `_jobs/` 下**每一个**产物目录
//     都会被判成孤儿 ⇒ `--apply` 会删光用户全部成片。
//   · **F6（P3 · `lib/store.mjs` 的索引版本闸门）**：`INDEX_VERSION` 只在 `saveIndex` 里被**写**，
//     **两个读者一个都不看 `obj.version`**（全仓没有 `migrat*`）⇒ ① 盘上是更新版写的
//     `{version:99, jobs:[…]}` ⇒ `loadIndex` 报「1 条、error=null」**一个字都不说**，随后
//     `saveIndex` 用 `version:1` 原子覆盖它 ⇒ 新版写的字段**静默消失**；② 盘上是**合法 JSON 但
//     `jobs` 换了名字** ⇒ 旧文案说「索引**损坏**」（它其实是**完全合法的 JSON**）⇒ 降级为空历史
//     ⇒ 下一次写入把那份**完好**的载荷原子覆盖掉、**不可恢复**。病根与 F1/F3/F5 同一个：
//     **把「读不懂」当成「空表」，然后覆盖它**。现口径照同仓既有那一套（`lib/dub.mjs` 的
//     `readIndexFromDisk` / `lib/llm-api.mjs` 的 `saveOverride`）：**读不出来 / 读不懂 ⇒ 告警 +
//     拒绝覆盖写**；`version` **缺失**视为 **0** ⇒ **能读 + 迁移到 1 + 打日志**；正常路径
//     （`version:1`）**零告警**。★ **边界**（有意区分）：文件**连 JSON 都不是**（硬杀截断）⇒
//     仍走文件头「4.」写的「降级 + 重建」自愈路径（若这里也拒绝，一次硬杀就让控制台**永远无法再落盘**）。
//
// ★★ 隔离：全程只碰 `D:/lemo-tmp/store-trim-*` 临时树（非 C 盘），跑完递归删；
//   **绝不碰真实 `D:/lemo-films/.console` 与 `D:/lemo-films/_jobs/`**。
//   ★ 覆盖点 = `LEMO_FILM_DIR`（`lib/store.mjs` 的 `.console` 与 `scripts/prune-jobs.mjs` 的 `_jobs/`
//     都从它派生 ⇒ 给两者设同一个变量，三处自动一致）；★ `LEMO_TMP` 只是本文件的临时树根。
//   ★ 本机 `spawnSync`/`execFileSync` **一律 EBUSY** ⇒ 照 `test/prune-jobs.test.mjs` 用**异步 `spawn`**。
//   ★ `LEMO_FILM_DIR` 必须在**第一次 import `lib/env.mjs` 之前**设好（`CFG.exportDir` 在模块求值期定死）。
//
// ★★ 「改前必红」（**实测**，2026-10-12 本轮；复跑法：把本文件拷进 `lib/` 的副本树 ——
//   `D:/lemo-tmp/w2/base-new`（= 第一版修复）/ `base-old`（= HEAD）—— 再 `node test/store-trim.test.mjs`）：
//   · 对 **HEAD** 版（`D:/lemo-tmp/w1/repo-old/lib/store.mjs` = 第八批修复**之前**）：**7 红 5 绿**
//     （红的：第 1/3/4 条 = F1 本体，第 5/6/7/8 条 = W1-1/W1-3/W1-2）；
//   · 对 **第一版修复**版（`D:/lemo-tmp/w1/repo-new/lib/store.mjs`，md5 `f82ccd0da205db7378008fb31f00e078`
//     = W1 验的那一版）：**5 红 7 绿** —— 红的正好是 W1-1/W1-2/W1-3 那 5 条（第 1/5/6/7/8 条）；
//   · 第 2 条（F1 正常路径**零行为变更**）是**阴性对照**：两个改前版与改后版**都绿** ——
//     它证明上面那些断言不是靠「把正常路径也改坏」换来的。
//   ★ 三处**实测**数字（改前 → 改后，都由本文件自己的断言打印）：
//     · W1-1（第 1 条，索引截断 + 65 个 1MB 老孤儿 × 3 轮）：孤儿剩 **58/65**（7 个被永久删）→ **65/65**；
//       第 5 条（索引**读得到**）：**62/65**（3 个被删）→ **65/65**（且没有 `.orphan-` 改名文件）。
//     · W1-3（第 6 条）：logs 里 **['a1','b2']**（b1 被删）→ **['a1','b1','b2']**。
//     · W1-2（第 7 条，稳定态连调 4 轮）：每轮 warn 数 **[1,0,0,0]** → **[1,1,1,1]**；
//       （第 8 条，先灌满 30 条无关 warn）：破坏性动作的 warn **[0 条]** → **[1 条]**。
//   ★ **F6（本轮新增，第 13–17 条）**（复跑法：`D:/lemo-tmp/f6/base-old` = HEAD 的 `lib/store.mjs`
//     （md5 `bb7af19dd26769a9f44fcc365301c6d4`）拷进 `lib/` 的副本树 + 本文件 ⇒ `node test/store-trim.test.mjs`）：
//     **4 红 1 绿** —— 红的正好是第 13/14/15/17 条（旧文件迁移日志 / version 更高 / version 非整数 /
//     形状不认识），第 16 条（正常路径**零行为变更**）是**阴性对照**：改前改后**都绿**。
//     ★ 对照探针 `D:/lemo-tmp/f6/probe.mjs`（**隔离闸**：写盘前先断言 `storeStatus().indexFile` 落在临时树里；
//       每个场景 `?case=` 拿全新模块实例）的**实测**（改前 → 改后）：
//       · `version:99`（更新版写的）⇒ warn **[] → 2 条**（「version 高于本模块」+「拒绝覆盖写」）、
//         `saveIndex` **true → false**、原文件 **被覆盖成 `version:1` 且 `futureField` 消失 → 逐字节不变**；
//       · `version` **缺失** ⇒ warn **[] → 1 条**（迁移日志；改前**一个字都不说**）；
//       · `version:"1"`（字符串）⇒ warn **[] → 2 条**、`saveIndex` **true → false**、原文件**逐字节不变**；
//       · 合法 JSON 但 `jobs` 换了名字 ⇒ 文案「**损坏**」→「**读不成任务注册表** + 合法 JSON + 拒绝覆盖写」、
//         `saveIndex` **true → false**、`entries` 载荷 **被覆盖 → 逐字节不变**；
//       · **不是**合法 JSON（硬杀截断）⇒ **两边都 true** —— 这是**有意**保留的自愈路径（文件头「4.」）。

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PRUNE = path.join(REPO, 'scripts', 'prune-jobs.mjs');
const TMP_BASE = process.env.LEMO_TMP || 'D:/lemo-tmp';   // ★ 非 C 盘
const MB = 1048576;

// ── 隔离树（进程内 F1 场景共用一个成片根：`CFG.exportDir` 一个进程只算一次）─────────────
const BASE = path.join(TMP_BASE, `store-trim-${process.pid}-${Date.now().toString(36)}`);
const FILM = path.join(BASE, 'film');
fs.rmSync(BASE, { recursive: true, force: true });
fs.mkdirSync(path.join(FILM, '.console', 'logs'), { recursive: true });
process.env.LEMO_FILM_DIR = FILM;      // ★ 必须在 import lib/store.mjs 之前
process.on('exit', () => { try { fs.rmSync(BASE, { recursive: true, force: true }); } catch { /* ignore */ } });

const CONSOLE_DIR = path.join(FILM, '.console');
const LOGS = path.join(CONSOLE_DIR, 'logs');
const INDEX = path.join(CONSOLE_DIR, 'index.json');

// ★ 上游口径（**不另抄一份数字**）：`CAPS.totalLogBytes` 变了 ⇒ 本文件的夹具尺寸（65MB / 70MB）
//   必须跟着重算 ⇒ 用一条断言把这件事说出来，而不是让夹具悄悄失准。
const storeBase = await import('../lib/store.mjs');
const CAP = storeBase.CAPS.totalLogBytes;
assert.equal(CAP, 64 * MB,
  `CAPS.totalLogBytes 实测 ${CAP}（本文件夹具按 64MB 设计：65 × 1MB 的孤儿 / 70MB 的刚出现孤儿）`
  + ' —— 改这个上限就必须同批重算本文件的夹具与断言');

// ★ 每个 F1 场景用**全新的 store 模块实例**（query 串破 ESM 缓存）⇒ `ready` / `warned` / `sizes` /
//   `lastIds` 都从零开始，场景之间不串味。`lib/env.mjs` **不带** query ⇒ 仍是同一个实例
//   （成片根只有一个口径，见 lib/store.mjs 文件头「成片根的唯一口径」）。
let seq = 0;
const freshStore = () => import(`../lib/store.mjs?case=${process.pid}-${++seq}`);

/** 清空 `.console`（每个 F1 场景开始前调用）。 */
function wipeConsole() {
  fs.rmSync(CONSOLE_DIR, { recursive: true, force: true });
  fs.mkdirSync(LOGS, { recursive: true });
}

const dirBytes = (d) => fs.readdirSync(d).reduce((s, f) => {
  try { return s + fs.statSync(path.join(d, f)).size; } catch { return s; }
}, 0);

/** 读注册表里的 id 列表；解析失败返回 null（**不抛**）。 */
function readIds() {
  try {
    const o = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
    const a = Array.isArray(o) ? o : o.jobs;
    return Array.isArray(a) ? a.map((j) => j.id) : null;
  } catch { return null; }
}

/** 捕获 `console.warn`（`lib/store.mjs` 的 warn 走它）—— 用来断言「删了东西必须说话」。 */
function captureWarns() {
  const out = [];
  const orig = console.warn;
  console.warn = (...a) => { out.push(a.join(' ')); };
  return { out, restore: () => { console.warn = orig; } };
}

/** 写一个 1MB/2MB 级的日志文件（内容无所谓，只占字节）。 */
const writeLog = (name, mb, byte) => fs.writeFileSync(path.join(LOGS, name), Buffer.alloc(mb * MB, byte));

const indexRaw = () => fs.readFileSync(INDEX, 'utf8');
const writeIndex = (jobs) => fs.writeFileSync(INDEX, JSON.stringify({ version: 1, savedAt: 'seed', jobs }), 'utf8');

// ══════════════════════════════════════════════════════════════════════════════
// F1 —— `lib/store.mjs` 的日志总量裁剪
// ══════════════════════════════════════════════════════════════════════════════

test('★F1/W1-1 审计的原始最小复现：65 个老孤儿 + 索引截断 ⇒ 历史不再被删光，**孤儿日志也一个都不少**（改前：条目 0/0/0 + 零告警；第一版修复：删掉 7 个孤儿）', async () => {
  wipeConsole();
  // 夹具：65 个 1MB 孤儿日志（mtime 拨回 1 小时前 ⇒ 老于 ORPHAN_GRACE_MS 的 10 秒门槛）
  const past = new Date(Date.now() - 3600 * 1000);
  for (let i = 1; i <= 65; i++) {
    const f = path.join(LOGS, `old-${i}.jsonl`);
    fs.writeFileSync(f, Buffer.alloc(MB, 0x6f));      // 'o' × 1MB
    fs.utimesSync(f, past, past);
  }
  // index.json **截断到 55%** ⇒ loadIndex 降级为空历史 ⇒ 上面 65 个日志全成「盘上有、索引里没有」的孤儿。
  //   ★ 这不是极端构造：控制台自己的正常稳态就把日志压在 64MB 上限附近，此时**任何一次索引损坏**
  //     （`loadIndex` 明确预期并处理的那种）都会把旧日志全变成孤儿。
  const full = JSON.stringify({ version: 1, savedAt: 'seed', jobs: [{ id: 'jlost-1', slug: 's', status: 'done' }] });
  fs.writeFileSync(INDEX, full.slice(0, Math.floor(full.length * 0.55)), 'utf8');

  const store = await freshStore();
  const w = captureWarns();
  const counts = [];
  const roundWarns = [];
  try {
    const loaded = store.loadIndex();
    assert.equal(loaded.jobs.length, 0, `前置：截断的索引应降级为空历史（实测 ${loaded.jobs.length} 条）`);
    assert.ok(loaded.error, '前置：降级应带 error（否则「索引损坏」这个前提不成立）');

    const mine = [];
    for (let round = 1; round <= 3; round++) {
      const id = `n${round}`;
      writeLog(`${id}.jsonl`, 2, 0x6e);                // 'n' × 2MB：本轮的「新任务」日志
      mine.push({ id, slug: `s-${id}`, status: 'done', endedAt: 1, createdAt: round });
      const before = w.out.length;
      store.saveIndex(mine);                          // = lib/jobs.mjs 的 persistNow() 那一句
      counts.push((readIds() || []).length);
      roundWarns.push(w.out.slice(before));
    }
  } finally { w.restore(); }

  assert.deepEqual(counts, [1, 2, 3],
    '每轮落盘后索引应保留**已落盘的全部条目**（1 → 2 → 3）。'
    + `实际 ${JSON.stringify(counts)} —— 改前是 [0,0,0]：**一次触发即永久丢光全部任务历史**，`
    + '而且此后每一轮都继续丢（越裁越空、越空越裁，人工不清 logs/ 就永远修不好）');

  // ★★ W1-1（2026-10-12）：判据从「总量压回上限」改成「**用户的日志一个字节都没少**」——
  //   索引读不到时，那 65 个孤儿日志正是「盘上有、索引里没有」的用户数据（**可能是那些任务唯一的残留**）。
  //   审计的建议是「**排除 + 报告**」，不是「删掉」；W1 实测第一版修复在这里**永久删掉了 7 个**（继续跑删光 65 个）。
  const orphansLeft = fs.readdirSync(LOGS).filter((f) => /^old-\d+\.jsonl$/.test(f)).sort();
  assert.equal(orphansLeft.length, 65,
    `索引外的 65 个老孤儿日志**必须一个都不少**（改前实测：3 轮落盘后永久删掉 7 个、继续跑就删光 65 个；`
    + `**删掉是不可恢复的数据损失**）。实际剩 ${orphansLeft.length}/65`);
  for (const f of orphansLeft) {
    assert.equal(fs.statSync(path.join(LOGS, f)).size, MB,
      `${f} 的字节数被改了（孤儿日志必须逐字节不动）`);
  }
  assert.equal(fs.readdirSync(LOGS).filter((f) => f.includes('.orphan-')).length, 0,
    '★ 也**不许改名归档**：`.orphan-<ts>` 会打断 `<id>.jsonl` 这个 id→文件映射'
    + '（索引一旦修好/从备份找回，`loadLogs(id)` 就再也读不到那份日志）—— 「可找回」不能只靠人去 logs/ 里翻');
  // 孤儿字节**不可回收**（不删就不腾空间）⇒ 目录总量停在「上限 + 孤儿字节」，这是「不删用户数据」的必然结果
  assert.equal(dirBytes(LOGS), 65 * MB + 3 * 2 * MB,
    `logs 目录总量应恰好 = 65MB 老孤儿 + 3×2MB 新任务日志（**一个字节都没被删**）；`
    + `实际 ${(dirBytes(LOGS) / MB).toFixed(1)}MB`);

  for (let i = 0; i < roundWarns.length; i++) {
    assert.ok(roundWarns[i].some((m) => m.includes('孤儿')),
      `第 ${i + 1} 轮**超限却没说话**（F1 的第二宗罪就是「静默」）：本轮 warn = ${JSON.stringify(roundWarns[i])}`);
    assert.ok(roundWarns[i].some((m) => m.includes('一个字节都没动')),
      `第 ${i + 1} 轮的报告必须点名「孤儿**一个字节都没动**」（否则读者会以为它被清了）：`
      + `本轮 warn = ${JSON.stringify(roundWarns[i])}`);
  }
  // ★ W1-3：索引**读不到**时的文案必须诚实 —— 不能说「没有任何任务记录引用它们」
  //   （有任务记录引用它们，只是本进程读不到那个文件）。
  assert.ok(roundWarns.flat().some((m) => m.includes('读不到')),
    `索引读不到时必须如实说「本进程读不到盘上索引，无法确认这些日志是否还有主人」，`
    + `实际 ${JSON.stringify(roundWarns.flat())}`);
});

test('F1 正常路径**零行为变更**：无孤儿时，不超限一条不裁 / 超限只裁最旧到刚好回到上限（阴性对照）', async () => {
  const store = await freshStore();

  // ── 场景 A：目录总量远低于上限 ⇒ 一条都不该裁（索引与日志逐字节不变，除 savedAt）──
  wipeConsole();
  const A = [];
  for (let i = 1; i <= 5; i++) {
    const id = `a${i}`;
    fs.writeFileSync(path.join(LOGS, `${id}.jsonl`), 'a'.repeat(1024), 'utf8');
    A.push({ id, slug: 's-a', status: 'done', endedAt: 1, createdAt: i });
  }
  writeIndex(A);
  const aSeed = indexRaw();
  const aLogsBefore = fs.readdirSync(LOGS).sort().map((f) => `${f}:${fs.statSync(path.join(LOGS, f)).size}`);
  store.loadIndex();
  store.saveIndex(A);
  const norm = (s) => s.replace(/"savedAt":"[^"]*"/, '"savedAt":"<ISO>"');
  assert.deepEqual(readIds(), ['a1', 'a2', 'a3', 'a4', 'a5'], '场景 A：不该裁掉任何条目');
  assert.equal(norm(indexRaw()), norm(aSeed), '场景 A：索引除 savedAt 外应逐字节不变');
  assert.deepEqual(fs.readdirSync(LOGS).sort().map((f) => `${f}:${fs.statSync(path.join(LOGS, f)).size}`),
    aLogsBefore, '场景 A：日志文件应一个字节都没动');

  // ── 场景 B：40 × 2MB = 80MB > 64MB，**无孤儿** ⇒ 从最旧开始裁到刚好 ≤ 上限 ──
  wipeConsole();
  const B = [];
  for (let i = 1; i <= 40; i++) {
    const id = `b${String(i).padStart(3, '0')}`;
    writeLog(`${id}.jsonl`, 2, 0x62);
    B.push({ id, slug: 's-b', status: 'done', endedAt: 1, createdAt: i });
  }
  writeIndex(B);
  store.loadIndex();
  store.saveIndex(B);
  const kept = readIds();
  const gone = B.map((j) => j.id).filter((id) => !kept.includes(id));
  assert.deepEqual(kept, B.map((j) => j.id).slice(gone.length),
    '场景 B：留下的必须是**最新的那一段**（严格等于原列表的后缀）');
  for (const id of gone) {
    assert.equal(fs.existsSync(path.join(LOGS, `${id}.jsonl`)), false, `场景 B：被裁掉的 ${id} 的日志文件应真的被删`);
  }
  for (const id of kept) {
    assert.ok(fs.existsSync(path.join(LOGS, `${id}.jsonl`)), `场景 B：保留的 ${id} 的日志文件必须还在`);
  }
  const totalB = dirBytes(LOGS);
  assert.ok(totalB <= CAP, `场景 B：裁剪后应 ≤ ${CAP / MB}MB，实际 ${(totalB / MB).toFixed(1)}MB`);
  assert.ok(totalB + 2 * MB > CAP,
    `场景 B：裁得**刚刚够**（再少裁一个就该超限）—— 实际 ${(totalB / MB).toFixed(1)}MB，`
    + `若 ≤ ${(CAP / MB) - 2}MB 说明多裁了（老行为是「够用即停」）`);
});

test('★F1 刚出现的孤儿（mtime = 现在）**一个都不删**：不误伤别的实例正在跑的任务、也不删光历史', async () => {
  wipeConsole();
  // 夹具：35 个**刚刚**出现的索引外日志（70MB，模拟另一个控制台实例刚建、还没落盘的任务：
  //   `lib/jobs.mjs` 的 `persistSoon()` 有 500ms 去抖）+ 3 条已结束任务（各 2MB）= 76MB > 64MB。
  for (let i = 1; i <= 35; i++) writeLog(`fresh-${i}.jsonl`, 2, 0x66);   // ★ mtime = 现在
  const mine = [];
  for (let i = 1; i <= 3; i++) {
    const id = `k${i}`;
    writeLog(`${id}.jsonl`, 2, 0x6b);
    mine.push({ id, slug: 's-k', status: 'done', endedAt: 1, createdAt: i });
  }
  writeIndex(mine);

  const store = await freshStore();
  const w = captureWarns();
  try {
    store.loadIndex();
    store.saveIndex(mine);
  } finally { w.restore(); }

  assert.deepEqual(readIds(), ['k1', 'k2', 'k3'],
    '刚出现的孤儿**不能**被当成「可删的垃圾」⇒ 任务历史必须原样保留（改前是 []）');
  const freshLeft = fs.readdirSync(LOGS).filter((f) => f.startsWith('fresh-')).length;
  assert.equal(freshLeft, 35,
    `刚出现的孤儿**一个都不许删**（可能正是另一个实例在跑的任务）—— ★ 现在连**老**孤儿也不删了（W1-1），`
    + `这条钉的是「绝不误伤另一个实例正在跑的任务」这个方向；实际剩 ${freshLeft}/35`);
  assert.ok(dirBytes(LOGS) > CAP,
    '本场景总量本来就压不回上限（删了也白删）⇒ 如实保留超限状态，由报警交给人工');
  assert.ok(w.out.some((m) => m.includes('刚出现的')),
    `必须明确报警并**点出原因**（有几个是刚出现的、为什么没动），实际 warn = ${JSON.stringify(w.out)}`);
});

test('★F1 「删了也压不回上限」时**不做无意义的破坏**：`need > 删得动的` ⇒ 不裁历史（running 一律不动）', async () => {
  wipeConsole();
  // 夹具：1 条 running 任务（70MB 日志，**绝不动**）+ 1 条已结束任务（2MB）= 72MB。
  //   `need = 72 - 64 = 8MB`，而「删得动的」（只有那条已结束的）只有 2MB ⇒ 8 > 2
  //   ⇒ 按新口径**不裁**（删了也压不回上限，只会白丢用户历史）。
  writeLog('r1.jsonl', 70, 0x72);
  writeLog('e1.jsonl', 2, 0x65);
  const jobs = [
    { id: 'e1', slug: 's-e', status: 'done', endedAt: 1, createdAt: 1 },
    { id: 'r1', slug: 's-r', status: 'running', createdAt: 2 },
  ];
  writeIndex(jobs);

  const store = await freshStore();
  const w = captureWarns();
  try {
    store.loadIndex();
    store.saveIndex(jobs);
  } finally { w.restore(); }

  assert.deepEqual(readIds(), ['e1', 'r1'],
    '`need > deletable` 时应**一条都不裁**（改前会把 e1 删掉、只剩 r1）—— 「删了也白删」的破坏必须停手');
  assert.ok(fs.existsSync(path.join(LOGS, 'e1.jsonl')), '已结束任务的日志也不该在这时被删（它删了也压不回上限）');
  assert.ok(fs.existsSync(path.join(LOGS, 'r1.jsonl')), 'running 任务的日志**永远不动**（老行为，不能因本次修复而丢）');
  assert.ok(w.out.some((m) => m.includes('不再做')),
    `必须明确报警说明「已停手、不再做删了也压不回上限的破坏」，实际 warn = ${JSON.stringify(w.out)}`);
});

test('★W1-1 索引**读得到**时的老孤儿：同样一个字节都不动（不删、也不改名归档），历史一条不丢', async () => {
  wipeConsole();
  // 夹具：65 个 1MB 老孤儿（mtime 拨回 1 小时）+ 1 条已结束任务（k1 / 2MB，索引里**有**它）
  //   ⇒ index.json **完好** ⇒ `disk` 读得到（与上面那条「索引截断」的用例走的是不同分支）。
  //   `need = 67 - 64 = 3MB`，而「删得动的」只有 k1 的 2MB ⇒ 3 > 2 ⇒ **不裁历史**。
  //   ★ 这一条是 W1-1 的**核心判据**：第一版修复正是在这里删掉最旧的 3 个孤儿（并因此「压回上限」）。
  const past = new Date(Date.now() - 3600 * 1000);
  for (let i = 1; i <= 65; i++) {
    const f = path.join(LOGS, `old-${i}.jsonl`);
    fs.writeFileSync(f, Buffer.alloc(MB, 0x6f));
    fs.utimesSync(f, past, past);
  }
  writeLog('k1.jsonl', 2, 0x6b);
  const mine = [{ id: 'k1', slug: 's-k1', status: 'done', endedAt: 1, createdAt: 1 }];
  writeIndex(mine);

  const store = await freshStore();
  const w = captureWarns();
  try {
    store.loadIndex();
    store.saveIndex(mine);
  } finally { w.restore(); }

  assert.deepEqual(readIds(), ['k1'], '任务历史必须原样保留（k1 不该被裁掉）');
  const left = fs.readdirSync(LOGS).filter((f) => /^old-\d+\.jsonl$/.test(f)).sort();
  assert.equal(left.length, 65,
    `★ 索引**读得到**时也不许动孤儿（第一版修复会在这里删掉最旧的 3 个、把总量「压回上限」）。`
    + `实际剩 ${left.length}/65 —— 那 3 个日志可能是用户任务的唯一残留，删掉不可恢复`);
  for (const f of left) assert.equal(fs.statSync(path.join(LOGS, f)).size, MB, `${f} 被改过（必须逐字节不动）`);
  assert.equal(fs.readdirSync(LOGS).filter((f) => f.includes('.orphan-')).length, 0,
    '★ 也不许「改名归档」：`.orphan-<ts>` 会打断 `<id>.jsonl` 的 id→文件映射（索引修好后 loadLogs(id) 读不到它）');
  assert.ok(fs.existsSync(path.join(LOGS, 'k1.jsonl')), 'k1 的日志必须还在（它是本列表里已结束的条目，但本轮删不动/不该删）');
  assert.ok(w.out.some((m) => m.includes('孤儿') && m.includes('一个字节都没动')),
    `报告必须点名「N 个索引外的孤儿日志**一个字节都没动**」，实际 warn = ${JSON.stringify(w.out)}`);
  // ★ W1-3 的文案是**条件句**：索引读得到时不许说「读不到盘上索引」
  assert.ok(w.out.some((m) => m.includes('请人工确认后再清理')),
    `索引读得到时应说「它们不属于任何任务记录、请人工确认后再清理」，实际 ${JSON.stringify(w.out)}`);
  assert.ok(!w.out.some((m) => m.includes('读不到盘上索引')),
    `索引**读得到**时不许说「读不到盘上索引」（文案必须与事实一致），实际 ${JSON.stringify(w.out)}`);
});

test('★W1-3 索引**读不到**时，另一个实例正在写的日志**不许被当孤儿处理**（改前：40MB 的 b1 被删掉）', async () => {
  wipeConsole();
  // 夹具（照 W1 的 p6-crossinstance）：logs/ 下 b1 / b2 各 40MB、mtime 拨回 1 小时
  //   = 「另一个控制台实例的两个任务」—— 它们的条目**只在盘上索引里**，本进程自己的列表里没有。
  //   本进程自己只有 a1（2MB，running）。
  const past = new Date(Date.now() - 3600 * 1000);
  for (const id of ['b1', 'b2']) {
    const f = path.join(LOGS, `${id}.jsonl`);
    fs.writeFileSync(f, Buffer.alloc(40 * MB, 0x62));
    fs.utimesSync(f, past, past);
  }
  writeLog('a1.jsonl', 2, 0x61);
  // index.json **截断** ⇒ 闸门读到 `bad-json` ⇒ `disk === null`（★ F6 起该函数叫 `readIndexGate`；
  //   截断 = **不是合法 JSON** ⇒ 仍按旧口径「跳过合并 + 降级重建」，见 F6 的**边界**）
  //   ⇒ `claimed` 只剩本进程的 list（`{a1}`）⇒ b1/b2 会被判成「孤儿」。
  //   ★ 改前的代码就在这里把 b1 删了，而 warn 还宣称「**没有任何任务记录引用它们**」——
  //     那句话在 `disk === null` 时**不成立**：有任务记录引用它们，只是**本进程读不到那个文件**。
  const full = JSON.stringify({
    version: 1, savedAt: 'seed',
    jobs: [{ id: 'b1', slug: 's-b1', status: 'done', endedAt: 1, createdAt: 1 },
      { id: 'b2', slug: 's-b2', status: 'done', endedAt: 1, createdAt: 2 }],
  });
  fs.writeFileSync(INDEX, full.slice(0, Math.floor(full.length * 0.55)), 'utf8');

  const store = await freshStore();
  const w = captureWarns();
  try {
    const loaded = store.loadIndex();
    assert.equal(loaded.jobs.length, 0, `前置：截断的索引应降级为空历史（实测 ${loaded.jobs.length} 条）`);
    assert.ok(loaded.error, '前置：降级应带 error');
    store.saveIndex([{ id: 'a1', slug: 's-a1', status: 'running', createdAt: 9 }]);
  } finally { w.restore(); }

  assert.deepEqual(fs.readdirSync(LOGS).sort(), ['a1.jsonl', 'b1.jsonl', 'b2.jsonl'],
    '★ 索引读不到 ⇒ **无法确认 b1/b2 是否还有主人** ⇒ 一个都不许删、也不许改名'
    + '（改前实测：b1 被删掉、logs 里只剩 a1 与 b2 —— 而 b2 的内存列表还在，之后还会把条目写回去 ⇒ 条目在、日志没了）');
  for (const id of ['b1', 'b2']) {
    assert.equal(fs.statSync(path.join(LOGS, `${id}.jsonl`)).size, 40 * MB, `${id} 的字节数不许变`);
  }
  assert.ok(w.out.some((m) => m.includes('孤儿') && m.includes('读不到')),
    `报告必须如实说「本进程**读不到**盘上索引，无法确认这些日志是否还有主人」`
    + `（旧文案「没有任何任务记录引用它们」此时是**不诚实**的），实际 warn = ${JSON.stringify(w.out)}`);
  assert.ok(!w.out.some((m) => m.includes('没有任何任务记录引用')),
    `索引读不到时**禁止**出现「没有任何任务记录引用它们」这种断言式文案，实际 ${JSON.stringify(w.out)}`);
});

test('★W1-2 稳定超限态连调 4 轮：**每轮都要说话**（改前实测 [1,0,0,0]：去重把稳定态压成静默）', async () => {
  wipeConsole();
  // 夹具（照 W1 的 p1 S9-repeat-warn）：1 条 running 任务（30MB，绝不动）+ 1 个**刚出现**的 40MB 孤儿
  //   ⇒ 稳定 70MB > 64MB，且「删得动的」为 0 ⇒ **每轮状态完全一样**。
  //   ★ 而「状态稳定」恰恰就是「磁盘长期超限」的定义 ⇒ 静默正好发生在最该说话的时候。
  writeLog('k1.jsonl', 30, 0x6b);
  writeLog('ghost.jsonl', 40, 0x67);         // mtime = 现在 ⇒ 刚出现的孤儿
  const mine = [{ id: 'k1', slug: 's-k1', status: 'running', createdAt: 1 }];
  writeIndex(mine);

  const store = await freshStore();
  const w = captureWarns();
  const perRound = [];
  try {
    store.loadIndex();
    for (let r = 0; r < 4; r++) {
      const before = w.out.length;
      store.saveIndex(mine);                 // = lib/jobs.mjs 的 persistSoon() 那一句（500ms 去抖）
      perRound.push(w.out.length - before);
    }
  } finally { w.restore(); }

  assert.deepEqual(perRound, [1, 1, 1, 1],
    '同一状态连调 4 轮 ⇒ **每轮都该有 1 条告警**（改前实测 [1,0,0,0]：`warn` 的全字符串去重'
    + `让第 2/3/4 轮彻底静默）。实际 ${JSON.stringify(perRound)}`);
  assert.ok(w.out.some((m) => m.includes('刚出现的')),
    `报告要点出「有几个是刚出现的（可能是另一个实例在跑的任务）」，实际 ${JSON.stringify(w.out)}`);
});

test('★W1-2 灌满 30 条无关 warn 之后，**破坏性动作仍然说话**（改前实测：删了 40MB 孤儿也一条都不说）', async () => {
  wipeConsole();
  // 手法（照 W1 的 p5-warnbudget）：在 logs/ 下建 30 个**目录** `bad-N.jsonl` ⇒ `appendLog` 写它必失败
  //   ⇒ 每失败一次产生一条**互不相同**的 warn（文案里带 id）⇒ 把 `warned` 的去重集合 + 30 条全局预算灌满。
  //   ★ 这不是人为极端：磁盘真出问题时 `写日志失败 <id>` 按 id 各不相同，很容易攒满 30 条。
  for (let i = 1; i <= 30; i++) fs.mkdirSync(path.join(LOGS, `bad-${i}.jsonl`), { recursive: true });
  // 夹具：1 条已结束任务（k1 / 30MB，在列表里、删得动）+ 1 个 40MB **老孤儿**（索引里没有）= 70MB > 64MB
  const past = new Date(Date.now() - 3600 * 1000);
  const ghost = path.join(LOGS, 'ghost.jsonl');
  fs.writeFileSync(ghost, Buffer.alloc(40 * MB, 0x67));
  fs.utimesSync(ghost, past, past);
  writeLog('k1.jsonl', 30, 0x6b);
  const mine = [{ id: 'k1', slug: 's-k1', status: 'done', endedAt: 1, createdAt: 1 }];
  writeIndex(mine);

  const store = await freshStore();
  const w = captureWarns();
  let fillWarns = 0; let actionWarns = [];
  try {
    store.loadIndex();
    for (let i = 1; i <= 30; i++) store.appendLog(`bad-${i}`, { n: i, stream: 'stdout', line: 'x' });
    fillWarns = w.out.length;
    assert.equal(fillWarns, 30,
      `前置：应恰好灌满 30 条互不相同的 warn（旧通道的**全局预算**），实际 ${fillWarns} —— 前提不成立则本用例白测`);
    const before = w.out.length;
    store.saveIndex(mine);
    actionWarns = w.out.slice(before);
  } finally { w.restore(); }

  assert.ok(actionWarns.length >= 1,
    `★ 预算被无关 warn 灌满之后，**裁了历史 / 长期超限仍然必须说话**`
    + `（改前实测：0 条 —— 最该报的那条报警在最需要它的时刻消失）。实际 ${JSON.stringify(actionWarns)}`);
  assert.ok(actionWarns.some((m) => m.includes('裁掉') && m.includes('孤儿')),
    `那条报告要**同时**点名「裁掉了几条已结束任务」与「仍剩几个孤儿 / 一个字节都没动」，`
    + `实际 ${JSON.stringify(actionWarns)}`);
  assert.ok(fs.existsSync(ghost), '孤儿日志必须还在（一个字节都不动）');
  assert.equal(fs.statSync(ghost).size, 40 * MB, '孤儿的字节数不许变');
});

// ══════════════════════════════════════════════════════════════════════════════
// F4 / F5 —— `scripts/prune-jobs.mjs`
// ══════════════════════════════════════════════════════════════════════════════

/** 异步跑 CLI，返回 { code, out, err }。 */
function runPrune(env, args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [PRUNE, ...args], {
      cwd: REPO, env: { ...process.env, ...env }, windowsHide: true,
    });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

function tmpDir(tag) {
  return path.join(TMP_BASE, `store-trim-${tag}-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
}

/**
 * F4/F5 夹具：注册表 = `jkeep`（已结束）｜`_jobs/` = `jkeep` + **`jorphan`（孤儿：有条目才算任务，它没有）**。
 * ★ 与 `D:/lemo-tmp/u1-fix/prune-probe.mjs` 的 `seed()` 同形（jkeep 1.9MB mp4 + srt，jorphan 同）。
 */
function jobsFixture(dir) {
  const consoleDir = path.join(dir, '.console');
  const jobs = path.join(dir, '_jobs');
  fs.mkdirSync(path.join(consoleDir, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(consoleDir, 'index.json'), JSON.stringify({
    version: 1, savedAt: 'seed',
    jobs: [{ id: 'jkeep', slug: 's-keep', status: 'done', endedAt: 1, createdAt: 2 }],
  }), 'utf8');
  fs.writeFileSync(path.join(consoleDir, 'logs', 'jkeep.jsonl'), 'k'.repeat(1024), 'utf8');
  for (const id of ['jkeep', 'jorphan']) {
    fs.mkdirSync(path.join(jobs, id), { recursive: true });
    fs.writeFileSync(path.join(jobs, id, 's.mp4'), 'v'.repeat(Math.floor(1.9 * MB)), 'utf8');
    fs.writeFileSync(path.join(jobs, id, 's.srt'), 's'.repeat(1024), 'utf8');
  }
  return {
    index: path.join(consoleDir, 'index.json'),
    log: path.join(consoleDir, 'logs', 'jkeep.jsonl'),
    keepDir: path.join(jobs, 'jkeep'),
    orphanDir: path.join(jobs, 'jorphan'),
  };
}

test('★F4 dry-run 也**认领** `_jobs/` 里的孤儿目录：逐个列名 + 字节并计入汇总（不删任何东西）', async () => {
  const dir = tmpDir('f4dry');
  try {
    const f = jobsFixture(dir);
    const r = await runPrune({ LEMO_FILM_DIR: dir }, ['--keep', '1']);
    assert.equal(r.code, 0, `退出码应为 0\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    assert.ok(r.out.includes('jorphan'),
      `孤儿目录必须**被点名**（旧版脚本只遍历注册表 ⇒ 它既不删也不报、永久不可发现）：\n${r.out}`);
    assert.ok(/孤儿/.test(r.out), '输出里要出现「孤儿」这个词（说清它为什么被列出来）');
    assert.ok(/1\.9MB/.test(r.out), '要报出孤儿的**字节数**（只报个数不够）');
    assert.match(r.out, /孤儿目录 1 个/, '汇总行要把孤儿目录单独计一项（不能混进「待清理任务」里）');
    // dry-run：一个字节都不许动
    assert.ok(fs.existsSync(f.orphanDir), 'dry-run 后孤儿目录必须还在');
    assert.ok(fs.existsSync(f.keepDir), 'dry-run 后保留任务的产物目录必须还在');
    assert.equal(readIdsIn(f.index), 'jkeep', 'dry-run 后注册表必须原样');
    assert.ok(fs.existsSync(f.log), 'dry-run 后日志必须还在');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('★F4 `--apply` 删掉孤儿目录，而 `--keep` **对孤儿不适用**（保留的任务原封不动）', async () => {
  const dir = tmpDir('f4apply');
  try {
    const f = jobsFixture(dir);
    const r = await runPrune({ LEMO_FILM_DIR: dir }, ['--keep', '1', '--apply']);
    assert.equal(r.code, 0, `退出码应为 0\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    assert.equal(fs.existsSync(f.orphanDir), false, '--apply 应把孤儿目录删掉（这正是 F4 要修的那半件事）');
    // ★ `--keep 1` 下 jkeep 是「保留」的 ⇒ 它那条链（目录 + 注册表 + 日志）必须**一个都不动**
    assert.ok(fs.existsSync(f.keepDir), '保留的任务产物目录必须原封不动（孤儿清理不能顺手删任务）');
    assert.equal(readIdsIn(f.index), 'jkeep', '保留的任务注册表条目必须原样');
    assert.ok(fs.existsSync(f.log), '保留的任务日志必须原样');
    assert.match(r.out, /实删目录 1（其中孤儿 1）/,
      `汇总应把「实删目录」里属于孤儿的算出来（否则读者分不清删的是任务还是垃圾）：\n${r.out}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('★F5 注册表**截断损坏** ⇒ exit 2 拒绝执行（一个字节不动），不再抛原始堆栈', async () => {
  const dir = tmpDir('f5trunc');
  try {
    const f = jobsFixture(dir);
    const full = fs.readFileSync(f.index, 'utf8');
    fs.writeFileSync(f.index, full.slice(0, Math.floor(full.length * 0.55)), 'utf8');
    const corrupt = fs.readFileSync(f.index, 'utf8');

    const r = await runPrune({ LEMO_FILM_DIR: dir }, ['--keep', '1']);
    assert.equal(r.code, 2, `损坏注册表应 exit 2（改前是未捕获 SyntaxError + exit 1）\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    assert.match(r.err, /拒绝执行/, `错误信息要明说「拒绝执行」：\n${r.err}`);
    assert.match(r.err, /exit 2/, '错误信息要点名退出码 2（让人知道这不是崩溃）');
    assert.ok(!/SyntaxError/.test(r.out + r.err),
      `不该再把原始堆栈丢给用户（旧行为）：\n${r.out}\n${r.err}`);
    assert.equal(fs.readFileSync(f.index, 'utf8'), corrupt, '拒绝执行 ⇒ 注册表**一个字节都不许动**');
    assert.ok(fs.existsSync(f.keepDir), '拒绝执行 ⇒ 产物目录不许动');
    assert.ok(fs.existsSync(f.orphanDir), '拒绝执行 ⇒ 孤儿目录也不许动（先修注册表，别急着删）');
    assert.ok(fs.existsSync(f.log), '拒绝执行 ⇒ 日志不许动');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('★F5 注册表**顶层是数组**（形状不对）⇒ 同样 exit 2 拒绝执行（绝不「当成空注册表」）', async () => {
  const dir = tmpDir('f5shape');
  try {
    const f = jobsFixture(dir);
    // 本仓写的是 {version, savedAt, jobs} 形状 ⇒ 顶层裸数组属于「形状不对」。
    //   ★ 为什么**不能**降级成空表：那样 `_jobs/` 下**每一个**产物目录都会被判成孤儿 ⇒
    //     `--apply` 会删光用户全部成片 —— 这正是「拒绝执行」而不是「尽力而为」的理由。
    fs.writeFileSync(f.index, JSON.stringify([{ id: 'jkeep', slug: 's-keep', status: 'done', endedAt: 1, createdAt: 2 }]), 'utf8');
    const raw = fs.readFileSync(f.index, 'utf8');

    const r = await runPrune({ LEMO_FILM_DIR: dir }, ['--keep', '1', '--apply']);
    assert.equal(r.code, 2, `形状不对应 exit 2\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    assert.match(r.err, /顶层是数组/, `错误信息要点出**具体**哪里不对（不是笼统的「损坏」）：\n${r.err}`);
    assert.equal(fs.readFileSync(f.index, 'utf8'), raw, '拒绝执行 ⇒ 注册表一个字节都不许动');
    assert.ok(fs.existsSync(f.orphanDir), '拒绝执行 ⇒ 孤儿目录必须还在（否则就是「把读不懂当空表」的灾难）');
    assert.ok(fs.existsSync(f.keepDir), '拒绝执行 ⇒ 任务产物目录必须还在');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/** 读某个注册表文件里的 id（逗号串），解析失败返回 '(解析失败)'。 */
function readIdsIn(indexFile) {
  try {
    const o = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    const a = Array.isArray(o) ? o : o.jobs;
    return a.map((j) => j.id).join(',');
  } catch { return '(解析失败)'; }
}

// ══════════════════════════════════════════════════════════════════════════════
// F6 —— `lib/store.mjs` 的**索引版本闸门**（读时校验 + 读不懂就拒绝覆盖写）
// ══════════════════════════════════════════════════════════════════════════════
//
// ★ 由来：第八批审计 **F6**（P3）。`INDEX_VERSION` 只在 `saveIndex` 里被**写**，**两个读者一个都不看
//   `obj.version`**（全仓没有 `migrat*`）⇒ 实测 `u18-version.mjs`：
//     · 盘上 `{version:99, jobs:[…]}`（更新版控制台写的）⇒ `loadIndex` 报「1 条、error=null」——
//       **一个字都不说**，随后 `saveIndex` 用 `version:1` 原子覆盖它 ⇒ 新版写的字段**静默消失**；
//     · 盘上是**合法 JSON 但 jobs 换了名字** ⇒ 旧文案说「历史索引**损坏**」（它其实是**完全合法的
//       JSON**）⇒ 降级为空历史 ⇒ 下一次写入把那份**完好**的载荷原子覆盖掉，**不可恢复**。
//   ⇒ 病根与 F1/F3/F5 同一个：**把「读不懂」当成「空表」，然后覆盖它**。
//
// ★★ 钉住的四条（照同仓既有口径，`lib/dub.mjs` 的 `readIndexFromDisk` / `lib/llm-api.mjs` 的
//   `saveOverride`：**读不出来 / 读不懂 ⇒ 告警 + 拒绝覆盖写**）：
//   ① `version` **缺失**（旧文件）⇒ 视为 **0** ⇒ **能读 + 迁移到 1 + 打日志**（绝不静默）；
//   ② `version` **高于**当前 ⇒ 告警 + **拒绝覆盖写**（原文件**逐字节不变**）；
//   ③ `version` **不是非负整数**（字符串 / 小数 / 负数）⇒ 告警 + **拒绝覆盖写**；
//   ④ 正常路径（`version: 1`）⇒ **零告警 + 除 `savedAt` 外逐字节不变**（**阴性对照**）。
//   ★ 另钉一条**边界**（有意区分、不许被将来改掉）：文件**连 JSON 都不是**（硬杀截断）⇒ **仍然重建**
//     —— 那是文件头「4. 启动加载必须能降级」写的自愈路径，也是 F1 第 1 条用例的前提
//     （若这里也拒绝，一次硬杀就让控制台**永远无法再落盘**）。
//   ★ 以及审计 §3.4 的措辞：**不许**再把「形状不同」说成「损坏」。
//
// ★★ 「改前必红」（实测见报告）：② ③ 两条 + 形状那条在**改前**（`git show HEAD:lib/store.mjs`）是**红**的
//   （改前：零告警 + `saveIndex` 返回 true + 原文件被覆盖）；① 也是红的（改前**一个字都不说**、没有迁移日志）；
//   ④ 是**阴性对照** —— 改前改后**都绿**，它证明上面那些红不是靠「把正常路径也改坏」换来的。

/** 造一条已结束的任务元数据（本段用例统一用它，避免各处字段不全）。 */
const meta = (id, createdAt = 1) => ({ id, slug: `s-${id}`, status: 'done', endedAt: 1, createdAt });

test('★F6 旧文件（`version` **缺失** ⇒ 视为 0）⇒ **能读 + 迁移到 1 + 打日志**（改前：一个字都不说）', async () => {
  // 两种历史形状都验：① `{savedAt, jobs}`（有 jobs、没有 version）；② **顶层裸数组**（文件头「目录结构」写的「数组，旧 → 新」）。
  const shapes = [
    ['{savedAt, jobs}（缺 version）', (jobs) => JSON.stringify({ savedAt: 'seed', jobs })],
    ['顶层裸数组', (jobs) => JSON.stringify(jobs)],
  ];
  for (const [name, raw] of shapes) {
    const jobs = [meta('g1', 1), meta('g2', 2)];
    wipeConsole();
    for (const j of jobs) writeLog(`${j.id}.jsonl`, 1, 0x67);
    fs.writeFileSync(INDEX, raw(jobs), 'utf8');

    const store = await freshStore();
    const w = captureWarns();
    let loaded = null; let okWrite = null;
    try {
      loaded = store.loadIndex();
      okWrite = store.saveIndex(jobs);          // = lib/jobs.mjs 的 persistNow() 那一句
    } finally { w.restore(); }

    assert.deepEqual(loaded.jobs.map((m) => m.id), ['g1', 'g2'],
      `${name}：★ 必须**能读出来**（不许当成空表 —— 那正是 F6 的病根）`);
    assert.equal(loaded.error, null, `${name}：已知形状的旧文件不该带 error（实测 ${loaded.error}）`);
    assert.ok(w.out.some((m) => m.includes('迁移')),
      `${name}：★ 必须**打日志**说明「按已知形状迁移到 1」（改前**一个字都不说**）：实际 ${JSON.stringify(w.out)}`);
    assert.equal(okWrite, true, `${name}：旧文件是**已知形状** ⇒ 允许写入（写入即完成迁移）`);
    const after = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
    assert.equal(after.version, 1,
      `${name}：★ 迁移后盘上必须是 version:1（实测 ${JSON.stringify(after.version)}）`);
    assert.deepEqual(after.jobs.map((m) => m.id), ['g1', 'g2'], `${name}：迁移**不许丢条目**`);
  }
});

test('★F6 `version` **高于**当前 ⇒ 告警 + **拒绝覆盖写**（原文件逐字节不变；改前：静默覆盖、新版字段消失）', async () => {
  wipeConsole();
  for (const j of [meta('j1', 1), meta('j2', 2)]) writeLog(`${j.id}.jsonl`, 1, 0x6a);
  const disk = [meta('j1', 1), meta('j2', 2)];
  // 模拟「更新版控制台写的」索引：version 更高 + 一个本模块不认识的字段。
  fs.writeFileSync(INDEX, JSON.stringify({ version: 99, savedAt: 'seed', jobs: disk, futureField: '更新版写的' }), 'utf8');
  const before = indexRaw();

  const store = await freshStore();
  const w = captureWarns();
  let loaded = null; let okWrite = null;
  try {
    loaded = store.loadIndex();
    okWrite = store.saveIndex([meta('new1', 3)]);
  } finally { w.restore(); }

  assert.deepEqual(loaded.jobs.map((m) => m.id), ['j1', 'j2'],
    '★ version 更高**也不许**当成空表（条目仍要读出来）—— 这是「不静默降级」的另一半');
  assert.ok(w.out.some((m) => m.includes('version=99') && m.includes('高于')),
    `★ 必须明确告警说「version 高于本模块」（改前**一个字都不说**）：实际 ${JSON.stringify(w.out)}`);
  assert.ok(w.out.some((m) => m.includes('拒绝覆盖写')),
    `★ 必须告警说「拒绝覆盖写」：实际 ${JSON.stringify(w.out)}`);
  assert.equal(okWrite, false, '★ 读不懂版本的索引 ⇒ `saveIndex` **必须拒绝覆盖写**（返回 false）');
  assert.equal(indexRaw(), before,
    '★ 原文件必须**逐字节不变**（改前实测：被 `version:1` 原子覆盖 ⇒ 新版写的字段静默消失、不可恢复）');
});

test('★F6 `version` **不是非负整数**（字符串 / 小数 / 负数）⇒ 告警 + **拒绝覆盖写**（改前：静默覆盖）', async () => {
  for (const [name, bad] of [['字符串 "1"', '1'], ['小数 1.5', 1.5], ['负数 -1', -1]]) {
    wipeConsole();
    writeLog('k1.jsonl', 1, 0x6b);
    fs.writeFileSync(INDEX, JSON.stringify({ version: bad, savedAt: 'seed', jobs: [meta('k1', 1)] }), 'utf8');
    const before = indexRaw();

    const store = await freshStore();
    const w = captureWarns();
    let okWrite = null;
    try {
      store.loadIndex();                        // 必须先读（`saveIndex` 在 ready=false 时直接返回 false，那样验不到东西）
      okWrite = store.saveIndex([meta('k1', 1)]);
    } finally { w.restore(); }

    assert.equal(okWrite, false, `${name}：★ version 不是非负整数 ⇒ **拒绝覆盖写**（实际返回 ${okWrite}）`);
    assert.equal(indexRaw(), before, `${name}：★ 原文件必须**逐字节不变**`);
    assert.ok(w.out.some((m) => m.includes('拒绝覆盖写')),
      `${name}：必须告警说「拒绝覆盖写」：实际 ${JSON.stringify(w.out)}`);
    assert.ok(w.out.some((m) => m.includes('不是非负整数')),
      `${name}：告警要点出**具体**原因（不是笼统的「坏了」）：实际 ${JSON.stringify(w.out)}`);
  }
});

test('F6 正常路径（`version: 1`）**零行为变更**：**零告警** + 除 `savedAt` 外逐字节不变（阴性对照）', async () => {
  wipeConsole();
  const jobs = [];
  for (let i = 1; i <= 3; i++) {
    const id = `v${i}`;
    writeLog(`${id}.jsonl`, 1, 0x76);
    jobs.push(meta(id, i));
  }
  writeIndex(jobs);                            // = `{version:1, savedAt:'seed', jobs}`
  const seed = indexRaw();
  const logsBefore = fs.readdirSync(LOGS).sort().map((f) => `${f}:${fs.statSync(path.join(LOGS, f)).size}`);

  const store = await freshStore();
  const w = captureWarns();
  let loaded = null; let okWrite = null;
  try {
    loaded = store.loadIndex();
    okWrite = store.saveIndex(jobs);
  } finally { w.restore(); }

  assert.deepEqual(w.out, [],
    `★ 正常路径（version:1）**一条告警都不许有** —— 版本校验若在正常路径误报，这条立刻红：实际 ${JSON.stringify(w.out)}`);
  assert.deepEqual(loaded.jobs.map((m) => m.id), ['v1', 'v2', 'v3'], '正常路径必须原样读出全部条目');
  assert.equal(loaded.error, null, '正常路径不该带 error');
  assert.equal(okWrite, true, '★ version:1 的索引必须照常可写（拒绝覆盖写是**有条件**的，不是把所有写都拦掉）');
  const norm = (s) => s.replace(/"savedAt":"[^"]*"/, '"savedAt":"<ISO>"');
  assert.equal(norm(indexRaw()), norm(seed),
    '★ 除 `savedAt`（每次写入必然不同）外，索引必须**逐字节相同** —— 这就是「正常路径零行为变更」的实测证据');
  assert.deepEqual(fs.readdirSync(LOGS).sort().map((f) => `${f}:${fs.statSync(path.join(LOGS, f)).size}`), logsBefore,
    '正常路径不许动任何日志文件');
});

test('★F6 合法 JSON 但**没有 jobs 数组**（形状不认识）⇒ 告警 + **拒绝覆盖写**，且**不许说「损坏」**（改前：载荷被覆盖）', async () => {
  // ① 形状不认识（审计 F6 的 `renamed` 场景）：**合法 JSON**、条目**完好**，只是 `jobs` 换了名字。
  wipeConsole();
  for (const j of [meta('e1', 1), meta('e2', 2)]) writeLog(`${j.id}.jsonl`, 1, 0x65);
  fs.writeFileSync(INDEX,
    JSON.stringify({ version: 1, savedAt: 'seed', entries: [meta('e1', 1), meta('e2', 2)] }, null, 2), 'utf8');
  const before = indexRaw();

  const store = await freshStore();
  const w = captureWarns();
  let okWrite = null;
  try {
    store.loadIndex();
    okWrite = store.saveIndex([meta('e3', 3)]);
  } finally { w.restore(); }

  assert.equal(okWrite, false,
    '★ 形状不认识 ⇒ **拒绝覆盖写**（改前：降级为空历史后把它原子覆盖 ⇒ 那份**完好**的载荷不可恢复）');
  assert.equal(indexRaw(), before, '★ 原文件必须**逐字节不变**（那是「可人工恢复」的唯一保证）');
  assert.ok(w.out.some((m) => m.includes('拒绝覆盖写')),
    `必须告警说「拒绝覆盖写」：实际 ${JSON.stringify(w.out)}`);
  assert.ok(w.out.some((m) => m.includes('合法 JSON')),
    `告警要点出**具体**原因（它是**合法 JSON**，只是形状不认识）：实际 ${JSON.stringify(w.out)}`);
  assert.ok(!w.out.some((m) => m.includes('损坏')),
    `★ 不许再把「形状不同」说成「损坏」（审计 §3.4：文件是完全合法 JSON，说「损坏」会带偏排查方向）：`
    + `实际 ${JSON.stringify(w.out)}`);

  // ② ★ 边界（**有意**区分，不许被将来改掉）：文件**连 JSON 都不是**（硬杀截断）⇒ **仍然重建**。
  //    理由：文件头「4. 启动加载必须能降级」写的就是这条自愈路径；若这里也拒绝，一次硬杀会让
  //    控制台**永远无法再落盘**（`saveIndex` 恒 false）—— 比「丢历史」更糟。这也是 F1 第 1 条用例的前提。
  wipeConsole();
  writeLog('e1.jsonl', 1, 0x65);
  const full = JSON.stringify({ version: 1, savedAt: 'seed', jobs: [meta('e1', 1), meta('e2', 2)] });
  fs.writeFileSync(INDEX, full.slice(0, Math.floor(full.length * 0.55)), 'utf8');

  const store2 = await freshStore();
  const w2 = captureWarns();
  let okWrite2 = null;
  try {
    store2.loadIndex();
    okWrite2 = store2.saveIndex([meta('e9', 1)]);
  } finally { w2.restore(); }

  assert.equal(okWrite2, true,
    '★ **边界**：不是合法 JSON（硬杀截断）⇒ 必须保留「降级 + 重建」的自愈路径'
    + '（改前的行为，也是文件头「4.」写明的口径）—— 这与上面「合法 JSON 就拒绝」是**有意**区分的');
  assert.deepEqual(readIds(), ['e9'], '截断的索引应被重建为「本进程的列表」');
});
