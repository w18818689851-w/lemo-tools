// test/prune-jobs.test.mjs —— `scripts/prune-jobs.mjs` 的**并发写**回归测试（独立入口，零依赖）
//
// ★ 由来（2026-10-09 第 9 轮审计 A1）：`prune-jobs --apply` 摘 `.console/index.json` 条目时
//   **不走 `lib/store.mjs` 的跨进程写锁** ⇒ 与并发 console 的 `saveIndex` 之间没有串行化，
//   两种交错都会丢改动（新任务被旧快照盖掉 / 已被删的条目被复活）。修法：两者**共用同一把锁**，
//   且 prune 改成「**拿锁 → 重读 → 只摘本次真删了的 id → 原子写**」——不再是「用启动时的旧快照整文件盖写」。
//
// ★★ 本用例**必须带屏障**（否则两个写者可能自然串行 ⇒ 假绿，修前也过）：
//   ① **父进程先拿住跨进程写锁**（`acquireLock`，本批新增导出）⇒ prune 的「拿锁 → 重读 → 写」
//      那一段**一定**发生在父进程注入并发写入**之后**（prune 拿不到被父进程占着的锁，只能等）。
//   ② **父进程等 prune 打印「注册表共 2 条」**（prune 只有**读完**索引才会打印这行）⇒ 保证 prune 的
//      **启动快照**里**没有** `newJob` ⇒「修前（旧快照整文件盖写）必丢 `newJob`」这条断言真的会红。
//
// ★ 隔离：全程只碰 `D:/lemo-tmp/prune-lu-*` 临时树（非 C 盘），跑完递归删；**不碰真实 `.console`**。
// ★ 修前红 / 修后绿：把 `scripts/prune-jobs.mjs` 的写入段退回「启动快照整文件盖写」⇒ 本用例
//   `newJob` 丢失、断言变红；恢复「拿锁 + 重读」⇒ 全绿（实测见 `_distill/第9轮修复-2026-10-09.md`）。

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PRUNE = path.join(REPO, 'scripts', 'prune-jobs.mjs');
const TMP_BASE = process.env.LEMO_TMP || 'D:/lemo-tmp';   // ★ 非 C 盘

function runPrune(env, onData) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [PRUNE, '--apply', '--keep', '1'], {
      cwd: REPO, env: { ...process.env, ...env }, windowsHide: true,
    });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; onData && onData(out); });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

test('prune-jobs --apply 与并发 console 写共用同一把锁 ⇒ 不丢并发新增的任务', async () => {
  const prevFilmDir = process.env.LEMO_FILM_DIR;
  const dir = path.join(TMP_BASE, `prune-lu-${process.pid}-${Date.now().toString(36)}`);
  try {
    fs.mkdirSync(path.join(dir, '.console', 'logs'), { recursive: true });
    fs.mkdirSync(path.join(dir, '_jobs', 'dropme'), { recursive: true });
    fs.writeFileSync(path.join(dir, '_jobs', 'dropme', 'x.bin'), 'x', 'utf8');
    const INDEX = path.join(dir, '.console', 'index.json');
    // base 比 dropme 新 ⇒ `--keep 1` 保留 base、待清理 dropme
    const base = { id: 'base', slug: 's-base', status: 'done', endedAt: 1, createdAt: 2 };
    const dropme = { id: 'dropme', slug: 's-dropme', status: 'done', endedAt: 1, createdAt: 1 };
    fs.writeFileSync(INDEX, JSON.stringify({ version: 1, savedAt: 'seed', jobs: [dropme, base] }), 'utf8');

    // ★ 父进程把 store 绑到隔离根（`LEMO_FILM_DIR` 必须在 import 之前设好）
    process.env.LEMO_FILM_DIR = dir;
    const store = await import('../lib/store.mjs');

    const locked = store.acquireLock();       // ★ 屏障①：父进程占住锁（= 模拟「console 正在写」）
    assert.equal(locked, true, '父进程没能拿到跨进程写锁（夹具问题，不是被测代码的问题）');

    let onRead = null;
    const readBarrier = new Promise((res) => { onRead = res; });
    const child = runPrune({ LEMO_FILM_DIR: dir }, (out) => {
      if (out.includes('注册表共 2 条')) onRead();   // ★ 屏障②：prune 已读完索引（快照里没有 newJob）
    });

    let raceTimer = null;
    try {
      await Promise.race([
        readBarrier,
        new Promise((_, rej) => { raceTimer = setTimeout(() => rej(new Error('等 prune 读完索引超时（15s）')), 15000); }),
      ]);
      // 并发 console 写入：盘上多出 newJob（prune 的启动快照里**没有**它）
      const cur = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
      cur.jobs.push({ id: 'newJob', slug: 's-new', status: 'done', endedAt: 1, createdAt: 3 });
      fs.writeFileSync(INDEX, JSON.stringify(cur), 'utf8');
    } finally {
      if (raceTimer) clearTimeout(raceTimer);
      store.releaseLock();                    // ★ 放行 prune 的「拿锁 → 重读 → 写」
    }

    const r = await child;
    assert.equal(r.code, 0, `prune-jobs 退出码 ${r.code}\nstdout:\n${r.out}\nstderr:\n${r.err}`);

    const after = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
    const ids = after.jobs.map((j) => j.id).sort();
    assert.deepEqual(ids, ['base', 'newJob'],
      `并发写入后索引应为 base+newJob（dropme 被摘、newJob 不被旧快照盖掉），实际 ${ids.join(',')} —— `
      + '修前会丢 newJob（prune 用启动时的旧快照整文件盖写）');
  } finally {
    if (prevFilmDir === undefined) delete process.env.LEMO_FILM_DIR;
    else process.env.LEMO_FILM_DIR = prevFilmDir;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
