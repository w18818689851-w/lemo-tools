// test/store-lock.test.mjs —— `lib/store.mjs` **未拿到跨进程写锁**时的降级路径（独立入口，零依赖）
//
// ★ 由来（2026-10-09）：审计发现 `saveIndex` 的**头部注释 / `acquireLock` JSDoc / warn 文案**共 6 处
//   都声称「拿不到锁 ⇒ **降级为不合并地写**」，但**实现从来不是这样** —— 合并分支（规则①②）**没有
//   `locked` 守卫**，无论拿没拿到锁都**照常「重读 + 合并」**。即「声称 vs 实现」不符。
//   ⇒ 本批**订正表述**（实现正确：合并总比丢掉别人的条目更安全），并用本用例把该行为**钉住**，
//     防止以后有人「照注释去改代码」、把合并守卫起来反而制造丢失更新。
//
// ★★ 怎么**可靠地**让 `acquireLock()` 返回 false：把 `index.lock` 做成一个**目录** ——
//   `writeFileSync(..., {flag:'wx'})` 必 `EEXIST`；读它取不到 pid（`EISDIR`）⇒ 判为「陈旧」⇒
//   试图 `unlinkSync` 一个目录**必失败** ⇒ 200 次重试后返回 `false`。全程不依赖「另一个进程恰好持锁」。
//
// ★★ 断言为什么能区分「合并」与「不合并」：
//   盘上有 `a,b`（本进程**从未见过** ⇒ `lastIds` 为空），本进程只持有 `c`。
//   · 若**合并**（实际行为）⇒ 规则②保留 a,b ⇒ 结果 `a,b,c`。
//   · 若**不合并**（旧注释所声称的行为）⇒ 整份盖写 ⇒ 只剩 `c` ⇒ 本断言**必红**。
//
// ★ 隔离：全程只碰 `D:/lemo-tmp/store-lock-*` 临时树（非 C 盘），跑完递归删；**不碰真实 `.console`**。

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const TMP_BASE = process.env.LEMO_TMP || 'D:/lemo-tmp';   // ★ 非 C 盘
const dir = path.join(TMP_BASE, `store-lock-${process.pid}-${Date.now().toString(36)}`);

fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, '.console'), { recursive: true });
process.env.LEMO_FILM_DIR = dir;               // ★ 必须在 import store 之前设好（ROOT 在模块求值期算出）
const store = await import('../lib/store.mjs');
store.loadIndex();                             // 建目录 + ready=true；盘上无 index ⇒ lastIds 为空
// 把锁做成**目录** ⇒ acquireLock() 必失败（见文件头）
fs.mkdirSync(path.join(dir, '.console', 'index.lock'), { recursive: true });
process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

const INDEX = path.join(dir, '.console', 'index.json');
const writeDisk = (jobs) => fs.writeFileSync(INDEX, JSON.stringify({ version: 1, savedAt: 'seed', jobs }), 'utf8');
const readDisk = () => JSON.parse(fs.readFileSync(INDEX, 'utf8'));

test('未拿到跨进程写锁时，saveIndex 仍「重读 + 合并」—— 不丢别人的条目、且返回 true', () => {
  // 夹具自检：确认「拿不到锁」这个前提真的成立（否则本用例白测）
  assert.equal(store.acquireLock(), false,
    '夹具问题：acquireLock 竟然拿到了锁（index.lock 应已是一个目录）⇒ 本用例前提不成立');

  // 盘上放「另一个实例」的条目 a,b（本进程从未见过）
  writeDisk([{ id: 'a', slug: 's-a' }, { id: 'b', slug: 's-b' }]);

  // 捕获降级 warn（本进程首次触发，不会被去重吞掉）
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => { warns.push(a.join(' ')); };
  let ok;
  try {
    ok = store.saveIndex([{ id: 'c', slug: 's-c' }]);   // 本进程只持有 c
  } finally {
    console.warn = orig;
  }

  assert.equal(ok, true, '未拿到锁不该让写入失败（best-effort：宁可有竞态，也不阻塞任务）');
  const ids = readDisk().jobs.map((j) => j.id).sort();
  assert.deepEqual(ids, ['a', 'b', 'c'],
    `未拿到锁时仍应「重读 + 合并」⇒ 盘上别人的 a,b 被保留。实际 ${ids.join(',')} —— `
    + '若只剩 c，说明代码真的「不合并地写」了（与订正后的表述不符）');
  assert.ok(warns.some((w) => w.includes('没拿到跨进程锁') && w.includes('仍会') && w.includes('合并')),
    `应有一条说明「仍会重读+合并、但有竞态窗口」的降级 warn，实际捕获：${JSON.stringify(warns)}`);
});

test('saveIndex 写出的 savedAt 是 ISO 字符串（与 prune-jobs / clean-test-residue 同一类型）', () => {
  writeDisk([]);
  assert.equal(store.saveIndex([{ id: 'z', slug: 's-z' }]), true);
  const { savedAt } = readDisk();
  assert.equal(typeof savedAt, 'string', `savedAt 应为字符串（ISO），实际 ${typeof savedAt}`);
  assert.match(savedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    `savedAt 应是 ISO 8601（如 2026-10-09T00:00:00.000Z），实际 ${savedAt}`);
});
