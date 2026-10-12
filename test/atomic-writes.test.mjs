// test/atomic-writes.test.mjs —— 第八批审计 F2 / F3 / F7 的**仓内回归测试**（独立入口，零依赖）
//
// ★ 由来：2026-10-12 的第八批对抗性审计（`D:/lemo-tmp/align-audit/U1-第八批审计-数据完整性与持久化.md`）
//   找到三条**持久化**缺陷，修复的实证只在 `D:/lemo-tmp/lemo-f8/` 的探针里
//   （`f2-run.mjs` / `f3-run.mjs` / `f7-run.mjs`）。本文件把那些场景**转成仓内回归测试**。
//
// ★ 钉住的四件事（**「集合口径」与「一处漏改」**）：
//   · **F2（P1 · `lib/briefs.mjs` 的原子写）**：旧实现的 tmp 名是**固定的** `${file}.tmp`
//     ⇒ 两个写者共用同一个 `.tmp` 时，Windows 上 `renameSync`（MOVEFILE_REPLACE_EXISTING）**不是事务性的**
//     ⇒ 终态可以是「**两个文件都没了**」—— 不是丢一次更新，是**工单文件本身消失**（实测 10/10 轮消失）。
//     现 tmp 名带 **pid + 单调序号**（与 `lib/store.mjs` / `lib/dub.mjs` / `lib/llm-api.mjs` 同一范式）。
//   · **W1-4（P3 · 上一条修复的**残余** · 同一文件）**：tmp 名唯一化把「残留 tmp」从「1 个、且
//     `deleteBrief` 能清」变成「**N 个、谁都看不见**」—— 旧固定名自带「自愈」（下一次写同一张工单会覆盖它），
//     新名字每个都是全新的 ⇒ 一旦留下残留（硬杀 / 收尾 unlink 也失败）就**永远没人回收**。
//     现 `listBriefs` **发现**（超龄 ⇒ 点名 warn）+ `createBrief`/`deleteBrief` 按 **10s 年龄门槛回收**
//     （口径同 `lib/store.mjs` 的 `ORPHAN_GRACE_MS`）；★ 门槛内的（可能正被别的进程写）**一个都不动**。
//   · **F3（P2 · `lib/dub.mjs` 的上传登记表）**：旧 `readIndexFromDisk()` 对「读不到 / 解析不了 / 形状不认识」
//     一律返回 `null`，而 `loadIndex()` 把 `null` 当**空表** ⇒ 下一次上传**原子覆盖**原文件
//     ⇒ 一份**完整合法**但形状不认识的登记表被**静默销毁**（实测 427 字节 / 3 条 ⇒ 覆盖成 1 条、零 warn）。
//     现返回值是**三态**（`{ok:true,entries}` / `{ok:false,why}`）⇒ 读不出来就**告警 + 拒绝覆盖写**
//     （口径照 `lib/llm-api.mjs` 的 `saveOverride`：宁可不写，也不覆盖）。
//   · **F7（P3 · `scripts/prune-dub.mjs`）**：`--include-uploads --apply` **删文件但不摘登记表**
//     ⇒ 留下「文件没了、登记还在」的**幽灵条目**（`listUploads()` 按 `statSync` 过滤 ⇒ UI 上看不见 ⇒ 静默；
//     且永久占用 `MAX_UPLOADS = 200` 的额度）。现**同一把锁内**重读登记表 → 按 path 规范化相等或同名摘掉
//     → pid 化 tmp + rename 原子写回；dry-run **预告**将摘几条；登记表**读不出来** ⇒ 一个字节都不改、只 ⚠️。
//
// ★★ 隔离：全程只碰 `D:/lemo-tmp/atomic-writes-*` 临时树（非 C 盘），跑完递归删；
//   **绝不碰真实 `D:/lemo-films/.briefs` / `dub/_uploads` / `dub/` 产物**。
//   ★ 覆盖点：`LEMO_FILM_DIR`（工单根 `.briefs`、上传登记表 `dub/_uploads`、跨进程锁 `.console` 都从它派生）
//     + `scripts/prune-dub.mjs` 自己的 `--root <dir>`（**不新增环境变量** ⇒ 无需登记进 `check-env-overrides`）。
//   ★ 本机 `spawnSync`/`execFileSync` **一律 EBUSY** ⇒ 照 `test/prune-dub.test.mjs` 用**异步 `spawn`**。
//   ★ `LEMO_FILM_DIR` 必须在**第一次 import `lib/env.mjs` 之前**设好（`CFG.exportDir` 在模块求值期定死）。
//
// ★★ 「改前必红」：本文件 9 条里 8 条在**改前**（`git show HEAD:lib/briefs.mjs` /
//   `HEAD:lib/dub.mjs` / `HEAD:scripts/prune-dub.mjs`）是**红的**（F3-a 是**零行为变更**的阴性对照 ——
//   它证明「拒绝覆盖写」是**有条件**的，不是把所有上传都拦掉了）。逐条实测见报告。
//   ★ W1-4 那条的「改前」是**双重的**：在 `HEAD` 版（固定 tmp 名）与「已修 F2、未修 W1-4」那一版上
//     都红 —— 前者没有年龄门槛回收、后者 `listBriefs` 一个字都不提残留（W1 报告的原始实测）。

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PRUNE_DUB = path.join(REPO, 'scripts', 'prune-dub.mjs');
const TMP_BASE = process.env.LEMO_TMP || 'D:/lemo-tmp';   // ★ 非 C 盘
const DAY = 24 * 60 * 60 * 1000;

// ── 隔离树 ────────────────────────────────────────────────────────────────────
const BASE = path.join(TMP_BASE, `atomic-writes-${process.pid}-${Date.now().toString(36)}`);
const F3_FILM = path.join(BASE, 'f3-film');
fs.rmSync(BASE, { recursive: true, force: true });
fs.mkdirSync(path.join(F3_FILM, 'dub', '_uploads'), { recursive: true });
process.env.LEMO_FILM_DIR = F3_FILM;   // ★ 必须在 import lib/dub.mjs / lib/briefs.mjs 之前
process.on('exit', () => { try { fs.rmSync(BASE, { recursive: true, force: true }); } catch { /* ignore */ } });

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);

/** 捕获 `console.warn`（`lib/dub.mjs` / `lib/briefs.mjs` 的 warn 都走它）。 */
function captureWarns() {
  const out = [];
  const orig = console.warn;
  console.warn = (...a) => { out.push(a.join(' ')); };
  return { out, restore: () => { console.warn = orig; } };
}

function tmpDir(tag) {
  return path.join(TMP_BASE, `atomic-writes-${tag}-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// F2 —— `lib/briefs.mjs` 的原子写 tmp 名必须**pid 化**（并发写不许把工单文件本身搞没）
// ══════════════════════════════════════════════════════════════════════════════
//
// ★ 为什么必须**两个进程**：这条缺陷的根因是「两个写者**共用同一个 `.tmp` 路径**」
//   （`lib/briefs.mjs:401-403` 的注释记着：猴补 `fs` 抓到过「P1 的 rename 报 EPERM → 去 unlink tmp，
//   而 dst 跟着没了」与「P2 的 rename 返回成功、dst 却不存在」的终态）。同进程内串行调用**撞不上**。
// ★ 起跑线（barrier）：两个子进程 import 完之后都先等同样长的时间 ⇒ 让两次写循环**重叠**。
// ★ 写什么：每次 patch `notes` 为 1900 字符（把工单文件撑到 ~2KB ⇒ `writeFileSync` 的窗口更长、更容易撞上）。

const SEED_BRIEF = () => ({
  id: 'bseed-1', topic: '并发写回归', slug: 'engraving', lang: 'en', ratio: '9:16', size: null,
  status: 'pending', createdAt: new Date().toISOString(), processedAt: null,
  contentRel: null, linesRel: null, runOpts: [], notes: '',
  jobId: null, startedAt: null, endedAt: null, error: null, film: null,
});
const NOTES = 'n'.repeat(1900);

const F2_CHILD = path.join(BASE, 'f2-writer.mjs');
fs.writeFileSync(F2_CHILD, [
  "import { pathToFileURL } from 'node:url';",
  'const [, , briefsPath, id, iters, barrierMs] = process.argv;',
  'const briefs = await import(pathToFileURL(briefsPath).href);',
  'const sleep = (ms) => new Promise((r) => setTimeout(r, ms));',
  'await sleep(Number(barrierMs || 0));',
  `const NOTES = 'n'.repeat(${NOTES.length});`,
  'let oks = 0, errs = 0; const codes = {};',
  'for (let i = 0; i < Number(iters); i++) {',
  '  let r;',
  "  try { r = briefs.patchBrief(id, { notes: NOTES }); } catch (e) { r = { ok: false, code: 'throw', error: e.message }; }",
  '  if (r && r.ok) oks += 1;',
  "  else { errs += 1; codes[r && r.code] = (codes[r && r.code] || 0) + 1; }",
  '}',
  "process.stdout.write(JSON.stringify({ oks, errs, codes }));",
  '',
].join('\n'), 'utf8');

/** 跑一个写者子进程；`LEMO_FILM_DIR` 指到本轮自己的临时成片根（工单落在它下面 `.briefs/`）。 */
function runF2Writer(briefsPath, film, iters, barrierMs) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [F2_CHILD, briefsPath, 'bseed-1', String(iters), String(barrierMs)], {
      cwd: BASE, env: { ...process.env, LEMO_FILM_DIR: film }, windowsHide: true,
    });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

test('★F2 两个写者并发 patchBrief 同一张工单 ⇒ 工单文件**不许消失**、内容不许坏（改前 10/10 轮消失）', async () => {
  const briefsPath = fileURLToPath(new URL('../lib/briefs.mjs', import.meta.url));
  const ROUNDS = 6;
  const ITERS = 30;
  const lostRounds = [];

  try {
    for (let round = 1; round <= ROUNDS; round++) {
      const film = path.join(BASE, `f2-r${round}`, 'film');
      const briefDir = path.join(film, '.briefs');
      fs.mkdirSync(briefDir, { recursive: true });
      const file = path.join(briefDir, 'bseed-1.json');
      fs.writeFileSync(file, JSON.stringify(SEED_BRIEF(), null, 2), 'utf8');

      const [a, b] = await Promise.all([
        runF2Writer(briefsPath, film, ITERS, 400),
        runF2Writer(briefsPath, film, ITERS, 400),
      ]);
      for (const [i, r] of [a, b].entries()) {
        assert.equal(r.code, 0, `第 ${round} 轮：写者 ${i + 1} 非零退出（stderr: ${r.err}）`);
      }
      const stats = [a, b].map((r) => { try { return JSON.parse(r.out); } catch { return null; } });
      assert.ok(stats.every(Boolean), `第 ${round} 轮：写者没有输出可解析的统计（${a.out} / ${b.out}）`);
      const oks = stats.reduce((s, x) => s + (x.oks || 0), 0);
      assert.ok(oks > 0,
        `第 ${round} 轮：**两个写者一次都没成功**（oks=${oks}，codes=${JSON.stringify(stats.map((x) => x.codes))}）`
        + ' ⇒ 本轮是**空转**，下面的「文件还在」不能算通过（那只是种子文件没被动过）');

      if (!fs.existsSync(file)) { lostRounds.push(round); continue; }
      const o = JSON.parse(fs.readFileSync(file, 'utf8'));
      const bad = [];
      if (o.id !== 'bseed-1') bad.push('id');
      if (o.slug !== 'engraving') bad.push('slug');
      if (o.topic !== '并发写回归') bad.push('topic');
      if (o.status !== 'pending') bad.push('status');
      if (!Array.isArray(o.runOpts)) bad.push('runOpts');
      if (!(typeof o.notes === 'string' && o.notes.length === NOTES.length)) bad.push('notes(未落盘)');
      assert.deepEqual(bad, [],
        `第 ${round} 轮：工单文件还在但**内容坏了 / 根本没写进去**（丢了：${bad.join(', ')}）`);
      // 附带不变量：pid 化 tmp 名之后，正常路径**不该留任何 `.tmp`**（旧固定名版本会互相留）
      const tmps = fs.readdirSync(briefDir).filter((n) => n.endsWith('.tmp'));
      assert.deepEqual(tmps, [], `第 ${round} 轮：.briefs/ 里留下了 tmp 文件 ${JSON.stringify(tmps)}`);
    }
  } finally {
    fs.rmSync(path.join(BASE, 'f2-r1'), { recursive: true, force: true });
  }

  assert.deepEqual(lostRounds, [],
    `★ 工单文件在 ${lostRounds.length}/${ROUNDS} 轮里**消失了**（第 ${lostRounds.join('、')} 轮）—— `
    + '这不是「丢一次更新」，是**整张工单文件没了**（改前实测 10/10 轮消失；根因 = 两个写者共用固定的 '
    + '`${file}.tmp`，Windows 上 rename 不是事务性的）');
});

// ══════════════════════════════════════════════════════════════════════════════
// F2 残余（W1-4）—— 残留 tmp 必须**可发现 + 可回收**，而**刚出现的** tmp 一个都不许动
// ══════════════════════════════════════════════════════════════════════════════
//
// ★ 由来：第八批 P1 修复的**对抗式验证**（`D:/lemo-tmp/align-audit/W1-第八批P1修复的对抗式验证.md`
//   的 **W1-4** 段）。tmp 名带 pid + 序号之后，旧固定名那份「**自愈**」没了 ——
//   旧版下一次写同一张工单会 `writeFileSync` 覆盖掉残留、`deleteBrief` 也会顺手清；
//   新版一旦留下残留（进程在 `writeFileSync`/`renameSync` 之间被**硬杀**，或 catch 里那次
//   `unlinkSync` **也**失败），就**没有任何路径回收它**：`listBriefs` 按后缀过滤掉 `.tmp`（看不见）、
//   `deleteBrief` 有意只清旧固定名（清不到）、`scripts/clean-test-residue.mjs` 只收 `*.json`（也不收）。
//   ⇒ ★ W1 的故障注入实测：**改前 3 次写共用 1 个 tmp、`deleteBrief` 后残留 0 → 改后 3 个各不相同的
//     tmp、`deleteBrief` 后残留 3（谁都看不见、谁都清不掉）**。
// ★ 修法（`lib/briefs.mjs` 文件尾）：① `listBriefs` 里**发现**（超龄 ⇒ 点名 warn，**只报不删**）；
//   ② `createBrief` / `deleteBrief` 里按**年龄门槛**（`TMP_GRACE_MS = 10s`，口径同
//   `lib/store.mjs` 的 `ORPHAN_GRACE_MS`）**回收**。
//
// ★★ 这条用例钉住四件事，缺一不可（后三件是**安全性**，比第一件更重要）：
//   ① 超龄的残留 tmp **必须**被回收（改前：永远回收不了）；
//   ② 超龄的残留 tmp **必须**被**点名**（改前：零告警 —— 这正是 W1-4 说的「谁都看不见」）；
//   ③ ★ **刚出现的**（< 10s 门槛）**必须**原样保留 —— 那可能正是**另一个进程此刻在写**的 tmp，
//      删了它随后的 `renameSync` 会 ENOENT（白白失败一次）。**光看名字挡不住**（名字长得一样），
//      能挡住的只有时间 ⇒ 这条用例就是「年龄门槛真的生效」的证据。
//   ④ 目录里**别的** `*.tmp`（不是工单 tmp，如用户手放的 `notes.tmp`）**一个都不许碰**。
//   ★ 另钉一条**读路径不改盘**：`listBriefs()` 只统计 + 告警，**不删**（删只发生在建/删工单时）。
//
// ★ 为什么工单根是 `F3_FILM/.briefs` 而不是本用例自己新造的树：`CFG.exportDir` 在
//   `lib/env.mjs` **模块求值那一刻**就定死了（见文件头「隔离树」段）⇒ 本进程内改
//   `process.env.LEMO_FILM_DIR` **无效**。`F3_FILM/.briefs` 是全进程唯一那个工单根，
//   而 F3 的用例只动 `F3_FILM/dub/_uploads` ⇒ 两者不相交（不会互相踩）。

const W14_BRIEFS = path.join(F3_FILM, '.briefs');
const W14_GRACE_MS = 10 * 1000;   // 与 `lib/briefs.mjs` 的 `TMP_GRACE_MS` 同值（★ 夹具**独立**写死，不 import）

test('★W1-4 残留 tmp：超龄的被**发现 + 回收**；刚出现的 / 非工单 tmp **一个都不动**（改前：零告警 + 永不回收）', async () => {
  fs.rmSync(W14_BRIEFS, { recursive: true, force: true });
  fs.mkdirSync(W14_BRIEFS, { recursive: true });

  /** 造一个 tmp：`ageMs` 前「出现」（mtime 拨回去）。 */
  const mkTmp = (name, ageMs, bytes) => {
    const p = path.join(W14_BRIEFS, name);
    fs.writeFileSync(p, 'x'.repeat(bytes), 'utf8');
    const t = new Date(Date.now() - ageMs);
    fs.utimesSync(p, t, t);
    return p;
  };

  fs.writeFileSync(path.join(W14_BRIEFS, 'bseed-1.json'), JSON.stringify(SEED_BRIEF(), null, 2), 'utf8');
  // 三个**超龄**残留（> 10s 门槛）：两个现写法 + 一个**旧固定名**（改前那版留下的）
  const stale1 = mkTmp('bseed-1.json.99999.1.tmp', 3600 * 1000, 4096);
  const stale2 = mkTmp('bseed-2.json.99999.2.tmp', 600 * 1000, 2048);
  const stale3 = mkTmp('bseed-1.json.tmp', 3600 * 1000, 1024);
  // 两个**不许动**的：刚出现的（= 另一个进程正在写）+ 名字不是工单 tmp 的外来文件
  const fresh = mkTmp('bseed-3.json.99999.3.tmp', 0, 512);
  const alien = mkTmp('notes.tmp', 3600 * 1000, 256);
  const staleBytes = 4096 + 2048 + 1024;

  // ★ 全新的 briefs 模块实例（query 破 ESM 缓存）⇒ `warned` 去重集合从零开始（否则抓不到告警）
  const briefs = await import(`../lib/briefs.mjs?w14=${process.pid}-${Date.now().toString(36)}`);
  const w = captureWarns();
  let listed = null, discovery = [], created = null, reclaim = [];
  let staleStillAfterList = [];
  try {
    listed = briefs.listBriefs();
    discovery = w.out.slice();
    // ★ 读路径**只报不删**：`listBriefs()` 之后那三个超龄残留**必须还在**
    staleStillAfterList = [stale1, stale2, stale3].filter((p) => fs.existsSync(p)).length;
    const n0 = w.out.length;
    created = briefs.createBrief({ topic: 'W1-4：建工单顺手回收残留 tmp', slug: 'engraving' });
    reclaim = w.out.slice(n0);
  } finally { w.restore(); }

  // ① 前置：正常工单仍在列表里（证明 `listBriefs` 本身没坏）
  assert.ok(listed.some((b) => b.id === 'bseed-1'), `前置：bseed-1 应在列表里，实际 ${JSON.stringify(listed.map((b) => b.id))}`);
  // ② 发现（改前：`discovery` 是**空数组**）
  assert.ok(discovery.some((m) => m.includes('残留 tmp')),
    `★ 超龄残留必须被**点名**（W1-4 的病就是「谁都看不见」）：实际 ${JSON.stringify(discovery)}`);
  assert.ok(discovery.some((m) => m.includes('3 个') && m.includes(`${staleBytes} 字节`)),
    `告警要点出**个数与字节**（3 个 / ${staleBytes} 字节）：实际 ${JSON.stringify(discovery)}`);
  // ③ 读路径不改盘
  assert.equal(staleStillAfterList, 3,
    '★ `listBriefs()` 是**读**路径 ⇒ 只统计 + 告警，**不删**任何东西（删只发生在建 / 删工单时）');
  // ④ 回收（改前：一个都回收不了）
  assert.ok(created && created.ok, `建工单应成功：${JSON.stringify(created)}`);
  assert.equal(fs.existsSync(stale1), false, '★ 超龄残留 tmp（现写法 #1）必须被回收（改前永远回收不了）');
  assert.equal(fs.existsSync(stale2), false, '★ 超龄残留 tmp（现写法 #2）必须被回收');
  assert.equal(fs.existsSync(stale3), false, '★ 超龄残留 tmp（**旧固定名**）必须被回收');
  assert.ok(reclaim.some((m) => m.includes('回收了 3 个')),
    `回收必须**说话**（点名回收了几个）：实际 ${JSON.stringify(reclaim)}`);
  // ⑤ ★★ 安全性（比回收更重要）：刚出现的 / 非工单 tmp 一个都不许动
  assert.ok(fs.existsSync(fresh),
    '★ 刚出现（< 10s 门槛）的 tmp **必须保留** —— 那可能正是**另一个进程此刻在写**的 tmp，'
    + '删了它随后的 `renameSync` 会 ENOENT（这正是 `deleteBrief` 那条「有意保留」注释要挡的事）');
  assert.ok(fs.existsSync(alien),
    '★ 名字不是「工单 tmp」的文件（`notes.tmp`）**绝不许碰** —— 判据不该建立在「这个目录里只有我们的文件」上');
  // ⑥ 回收后目录恰好剩：正常工单 + 新建的那张 + 那两个不许动的
  const left = fs.readdirSync(W14_BRIEFS).sort();
  const tmpsLeft = left.filter((n) => n.endsWith('.tmp')).sort();
  assert.deepEqual(tmpsLeft, ['bseed-3.json.99999.3.tmp', 'notes.tmp'],
    `★ 回收后目录里只该剩那两个「不许动」的 tmp，实际 ${JSON.stringify(left)}`);
  assert.ok(left.includes('bseed-1.json'), '正常工单文件不许被回收连累');

  fs.rmSync(W14_BRIEFS, { recursive: true, force: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// F3 —— `lib/dub.mjs` 的上传登记表：**读不出来 ⇒ 拒绝覆盖写**（不静默销毁）
// ══════════════════════════════════════════════════════════════════════════════

let dubSeq = 0;
// ★ 每个场景用**全新的 dub 模块实例**（query 串破 ESM 缓存）⇒ `indexCache` / `warned` 从零开始。
//   `lib/env.mjs` 与 `lib/store.mjs` **不带** query ⇒ 仍是同一个实例（成片根与锁只有一个口径）。
const freshDub = () => import(`../lib/dub.mjs?case=${process.pid}-${++dubSeq}`);

const uploadsDir = () => path.join(F3_FILM, 'dub', '_uploads');
const entryOf = (dir, t) => ({ token: t, name: `${t}.mp4`, size: 4096, path: path.join(dir, `${t}.mp4`), at: 1000, kind: 'video' });

/** 一个场景：写一份登记表（三种形状之一）+ 一次 `registerUpload` ⇒ 看登记表有没有被静默覆盖。 */
async function f3Scenario(tag, rawFor) {
  const uploads = uploadsDir();
  fs.rmSync(path.join(F3_FILM, 'dub'), { recursive: true, force: true });
  fs.mkdirSync(uploads, { recursive: true });
  const THREE = ['t1', 't2', 't3'].map((t) => entryOf(uploads, t));
  for (const t of ['t1', 't2', 't3']) fs.writeFileSync(path.join(uploads, `${t}.mp4`), 'x'.repeat(4096), 'utf8');
  const index = path.join(uploads, 'index.json');
  fs.writeFileSync(index, rawFor(THREE), 'utf8');
  const before = { sha: sha256(index), raw: fs.readFileSync(index, 'utf8') };

  const dub = await freshDub();
  const w = captureWarns();
  let listedBefore = null;
  let listedAfter = null;
  try {
    listedBefore = dub.listUploads().map((e) => e.token).sort();
    fs.writeFileSync(path.join(uploads, 'tNEW.mp4'), 'y'.repeat(64), 'utf8');
    dub.registerUpload({
      token: 'tNEW', name: 'new.mp4', size: 64, path: path.join(uploads, 'tNEW.mp4'), at: Date.now(), kind: 'video',
    });
    listedAfter = dub.listUploads().map((e) => e.token).sort();
  } finally { w.restore(); }

  const after = { sha: sha256(index), raw: fs.readFileSync(index, 'utf8') };
  const tokens = (() => { try { const j = JSON.parse(after.raw); return Array.isArray(j) ? j.map((e) => e && e.token) : null; } catch { return null; } })();
  return { tag, uploads, index, before, after, warns: w.out, listedBefore, listedAfter, tokens };
}

test('F3 阴性对照（登记表**完好**）：一次上传正常落盘、且**一条告警都没有**（证明「拒绝覆盖」是有条件的）', async () => {
  const r = await f3Scenario('array', (three) => JSON.stringify(three, null, 2));
  assert.deepEqual(r.tokens, ['t1', 't2', 't3', 'tNEW'],
    `完好的登记表（裸数组）下，一次上传应把新条目**追加**进去（不是覆盖掉旧的）：实际 ${JSON.stringify(r.tokens)}`);
  assert.notEqual(r.after.sha, r.before.sha, '正常路径应该真的重写了登记表');
  assert.deepEqual(r.warns, [],
    `正常路径必须**零告警**（否则「拒绝覆盖写」那条告警就失去意义了）：实际 ${JSON.stringify(r.warns)}`);
});

test('★F3 登记表**形状不认识**（`{version, uploads}`）⇒ 告警 + 拒绝覆盖写（原字节一个都不动）', async () => {
  const r = await f3Scenario('object', (three) => JSON.stringify({ version: 1, uploads: three }, null, 2));
  assert.equal(r.after.sha, r.before.sha,
    '★ 读不懂的登记表**一个字节都不许改**（改前：427 字节 / 3 条被原子覆盖成 1 条，旧素材文件成孤儿）');
  assert.equal(r.after.raw, r.before.raw, '原字节必须逐字节相同（这是「可人工恢复」的唯一保证）');
  assert.ok(r.warns.some((m) => m.includes('拒绝覆盖')),
    `必须明确告警说「拒绝覆盖登记表」（改前**全程零 warn**、静默销毁）：实际 ${JSON.stringify(r.warns)}`);
  // 已登记的素材文件仍在盘上（被覆盖的只是登记表；文件不该被连带删）
  for (const t of ['t1', 't2', 't3']) {
    assert.ok(fs.existsSync(path.join(r.uploads, `${t}.mp4`)), `原素材 ${t}.mp4 必须还在盘上`);
  }
  assert.ok(fs.existsSync(path.join(r.uploads, 'tNEW.mp4')), '本次上传的文件本身照样落盘（不写登记表 ≠ 不落盘）');
});

test('★F3 登记表**JSON 解析失败**（截断）⇒ 告警 + 拒绝覆盖写（原字节一个都不动）', async () => {
  const r = await f3Scenario('corrupt', (three) => JSON.stringify(three, null, 2).slice(0, 60));
  assert.equal(r.after.sha, r.before.sha, '★ 坏 JSON 的登记表一个字节都不许改（改前被静默覆盖）');
  assert.equal(r.after.raw, r.before.raw, '原字节必须逐字节相同');
  assert.ok(r.warns.some((m) => m.includes('拒绝覆盖')),
    `必须明确告警说「拒绝覆盖登记表」：实际 ${JSON.stringify(r.warns)}`);
  assert.ok(r.warns.some((m) => m.includes('解析失败')),
    `告警要点出**具体原因**（不是笼统的「坏了」）：实际 ${JSON.stringify(r.warns)}`);
});

// ══════════════════════════════════════════════════════════════════════════════
// F7 —— `scripts/prune-dub.mjs --include-uploads --apply` 删文件后**同锁内摘登记**
// ══════════════════════════════════════════════════════════════════════════════

function runPruneDub(filmRoot, args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [PRUNE_DUB, ...args], {
      cwd: REPO, windowsHide: true,
      env: { ...process.env, LEMO_FILM_DIR: filmRoot },   // ★ 锁落在临时树里（`<filmRoot>/.console/index.lock`）
    });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

/**
 * F7 夹具：`<root>/dub/_uploads/` 下「**文件在、登记也在**」的一对（`tokAAA`），
 * mtime 拨回 3 天前（`--older-than 1` 会选中它）。
 * @param {(uploads:string)=>string} [rawFor] 自定义登记表原文（不给 = 默认一条合法登记）
 */
function f7Fixture(tag, rawFor) {
  const root = tmpDir(`f7-${tag}`);
  const uploads = path.join(root, 'dub', '_uploads');
  fs.mkdirSync(uploads, { recursive: true });
  const file = path.join(uploads, 'tokAAA.mp4');
  fs.writeFileSync(file, 'a'.repeat(4096), 'utf8');
  const index = path.join(uploads, 'index.json');
  fs.writeFileSync(index, rawFor
    ? rawFor(uploads)
    : JSON.stringify([{ token: 'tokAAA', name: 'a.mp4', size: 4096, path: file, at: 1000, kind: 'video' }], null, 2), 'utf8');
  const old = new Date(Date.now() - 3 * DAY);
  for (const p of [uploads, file, index]) fs.utimesSync(p, old, old);
  return { root, uploads, file, index, dubRoot: path.join(root, 'dub') };
}

/** 登记表里的 token 列表；非数组 / 坏 JSON 时返回可读的标记。 */
const f7Tokens = (indexFile) => {
  try {
    const j = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    return Array.isArray(j) ? j.map((e) => e && e.token) : '(非数组)';
  } catch { return '(坏 JSON)'; }
};

test('★F7 dry-run 会**预告**将摘几条（一个字节都不动、文件也不删）', async () => {
  const f = f7Fixture('dry');
  try {
    const raw = fs.readFileSync(f.index, 'utf8');
    const r = await runPruneDub(f.root, ['--root', f.dubRoot, '--older-than', '1', '--include-uploads']);
    assert.equal(r.code, 0, `退出码应为 0\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    assert.match(r.out, /将摘掉 1 条/,
      `dry-run 必须**预告**将摘几条（不许等 --apply 才知道）：\n${r.out}`);
    assert.equal(fs.readFileSync(f.index, 'utf8'), raw, 'dry-run ⇒ 登记表一个字节都不许动');
    assert.ok(fs.existsSync(f.file), 'dry-run ⇒ 素材文件不许删');
    assert.ok(/用户上传的素材/.test(r.out), '启用 --include-uploads 时必须醒目提示「这是用户上传的素材」');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('★F7 `--apply` 删掉文件后**同一把锁内摘掉对应登记条目**（不留幽灵条目）', async () => {
  const f = f7Fixture('apply');
  try {
    const r = await runPruneDub(f.root, ['--root', f.dubRoot, '--older-than', '1', '--include-uploads', '--apply']);
    assert.equal(r.code, 0, `退出码应为 0\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    assert.equal(fs.existsSync(f.file), false, '--include-uploads --apply ⇒ 超龄素材文件应被删除（这是显式开关）');
    assert.deepEqual(f7Tokens(f.index), [],
      '★ 文件删了、登记也必须一起摘掉（改前只删文件 ⇒ 留下「文件没了、登记还在」的幽灵条目：'
      + '`listUploads()` 按 `statSync` 过滤 ⇒ UI 上看不见 ⇒ 静默，且永久占 MAX_UPLOADS 额度）');
    assert.match(r.out, /已摘掉 1 条/, `输出要点名摘了几条（不许静默）：\n${r.out}`);
    assert.ok(fs.existsSync(f.index), '`_uploads/index.json` 的**文件本身永远保留**（只摘条目、不删文件）');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('★F7 登记表**读不出来**时：文件照删（显式开关），但登记表**一个字节都不改**、只 ⚠️', async () => {
  const variants = [
    ['形状不认识', () => '{}'],
    ['截断 JSON', () => '[{"token":"tokAAA","path":"x"'],
  ];
  for (const [name, mk] of variants) {
    const f = f7Fixture(`bad-${name === '形状不认识' ? 'shape' : 'trunc'}`, mk);
    try {
      const raw = fs.readFileSync(f.index, 'utf8');
      const r = await runPruneDub(f.root, ['--root', f.dubRoot, '--older-than', '1', '--include-uploads', '--apply']);
      assert.equal(r.code, 0, `${name}：退出码应为 0\nstdout:\n${r.out}\nstderr:\n${r.err}`);
      assert.equal(fs.readFileSync(f.index, 'utf8'), raw,
        `${name}：★ 读不懂的登记表**一个字节都不许改**（绝不许把它当空表后覆盖）`);
      assert.equal(fs.existsSync(f.file), false,
        `${name}：素材文件仍应被删（--include-uploads --apply 是显式的破坏性开关）`);
      assert.ok(/一个字节都没改它/.test(r.out),
        `${name}：必须明确 ⚠️ 说「一个字节都没改它」：\n${r.out}`);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('★F7 `--json` 里带 `uploadsRegistry` 字段（机器可读地报出登记表同步结果）', async () => {
  const f = f7Fixture('json');
  try {
    const r = await runPruneDub(f.root, ['--root', f.dubRoot, '--older-than', '1', '--include-uploads', '--apply', '--json']);
    assert.equal(r.code, 0, `退出码应为 0\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    const j = JSON.parse(r.out);                       // stdout 只出 JSON
    assert.ok(j.uploadsRegistry, `--json 输出里必须有 uploadsRegistry 字段（改前没有）：${r.out.slice(0, 400)}`);
    assert.equal(j.uploadsRegistry.status, 'pruned', `登记表同步状态应为 pruned，实际 ${JSON.stringify(j.uploadsRegistry)}`);
    assert.equal(j.uploadsRegistry.removed, 1, '应如实报出摘掉了 1 条');
    assert.equal(j.uploadsRegistry.left, 0, '摘完应剩 0 条');
    assert.deepEqual(f7Tokens(f.index), [], '`--json` 路径也要真的写回（不能只报不写）');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
