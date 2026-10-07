#!/usr/bin/env node
/**
 * test/slot.test.mjs —— core/render/slot.mjs（整机渲染限流器）的行为测试（零依赖）
 *
 * 用法：node test/slot.test.mjs
 *   SLOT_MJS=<path>   被测模块路径（默认 D:/lemo-opuscar/core/render/slot.mjs）。
 *                     这个开关是给「故意破坏」验证用的：把 slot.mjs 复制到 D:/lemo-tmp/ 改坏，
 *                     再用 SLOT_MJS 指向副本，确认对应断言真的会变红。
 *   SLOT_ONLY=<子串>  只跑名字里含该子串的用例（跑破坏验证时省时间）。
 *   SLOT_TMP=<dir>    临时根目录（默认 D:/lemo-tmp）——必须是**非 C 盘**。
 *
 * ★ 为什么单独一个入口：
 *   slot.mjs 是**整机渲染限流器**：它被 core/render/video.mjs:39 调用、被
 *   styles/midcentury-toon/demo/build.sh:17 用来包住渲染。它坏掉的方式非常安静——
 *   「过期槽接管」判据写错 ⇒ 要么永久排队（整机卡死），要么多个渲染同时跑（显存爆）。
 *   这两种都不会抛异常，只会让整台机器慢慢不对劲。所以必须在这里逐条钉死。
 *
 * ★ 为什么必须用子进程：
 *   slot.mjs 的等待用的是 pause()（Atomics.wait，**同步阻塞**）。在同一个进程里连续
 *   调两次 acquire() 会把自己卡死，所以「槽位上限 / 排队」只能用**子进程并发**来验。
 *   同理，测试脚本自身只能用**异步 spawn**（本项目踩过 spawnSync/execFileSync ⇒ EBUSY 的坑）。
 *
 * ★ 为什么每个用例一个独立锁目录：
 *   默认锁目录是 os.tmpdir()/…（Windows 上是 C 盘）。用户硬规则禁止写 C 盘，
 *   所以每个用例显式把 RENDER_SLOT_DIR 指到 D:/lemo-tmp/slot-test/<case>/。
 *
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NODE = process.execPath;
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));          // D:/lemo-tools
const SLOT = path.resolve(process.env.SLOT_MJS || path.resolve(ROOT, '..', 'lemo-opuscar', 'core', 'render', 'slot.mjs'));
const TMP = path.resolve(process.env.SLOT_TMP || 'D:/lemo-tmp');
const SANDBOX = path.join(TMP, 'slot-test');

// 用户硬规则：禁止写 C 盘。宁可直接炸掉，也不要静默往 C 盘拉屎。
if (/^[a-zA-Z]:$/.test(path.parse(TMP).root) && /^[cC]:/.test(path.parse(TMP).root)) {
  throw new Error(`SLOT_TMP 落在 C 盘（${TMP}）——本项目禁止写 C 盘`);
}
if (!fs.existsSync(SLOT)) throw new Error(`被测模块不存在：${SLOT}`);

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
  b: (s) => (TTY ? `\x1b[1m${s}\x1b[0m` : s),
  yel: (s) => (TTY ? `\x1b[33m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

// ── 小工具 ────────────────────────────────────────────────────
const rmrf = p => { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} };
const slotDirs = dir => {
  try { return fs.readdirSync(dir).filter(n => /^slot\d+$/.test(n)).sort(); } catch { return []; }
};
const caseDir = name => path.join(SANDBOX, name);
const mtimeOf = p => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
const aged = ms => new Date(Date.now() - ms);

/** 造一个「确定不存在」的 pid：自己验一遍，别拿一个可能活着的数字去赌。 */
function deadPid() {
  for (const p of [999999, 999998, 888887, 777773, 666661]) {
    try { process.kill(p, 0); } catch (e) { if (e.code === 'ESRCH') return p; }
  }
  throw new Error('找不到一个确定不存在的 pid，无法构造「进程已死」的槽位');
}

/**
 * 加载被测模块的一个**新实例**。
 * RENDER_SLOT_DIR 是**模块加载时**读的 ⇒ 必须在 import 前设好；用 query 串绕开 ESM 缓存。
 * RENDER_SLOTS / RENDER_MIN_FREE 是**acquire() 调用时**读的 ⇒ 由各用例在调用前设，
 * 或者干脆走 acquire({slots, minFree}) 显式传参。
 */
let importSeq = 0;
async function loadSlot(dir) {
  fs.mkdirSync(dir, { recursive: true });
  process.env.RENDER_SLOT_DIR = dir;
  delete process.env.RENDER_SLOTS;
  delete process.env.RENDER_MIN_FREE;
  delete process.env.RENDER_SLOT_HELD;
  return import(`${pathToFileURL(SLOT).href}?case=${++importSeq}`);
}

/** 手工造一个槽位目录：pid + beat + 两个 mtime 都按需要指定。 */
function forgeSlot(dir, i, pid, { beatAgeMs = 0, dirAgeMs = beatAgeMs } = {}) {
  const d = path.join(dir, `slot${i}`);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'pid'), String(pid));
  fs.writeFileSync(path.join(d, 'beat'), '');
  if (beatAgeMs) fs.utimesSync(path.join(d, 'beat'), aged(beatAgeMs), aged(beatAgeMs));
  if (dirAgeMs) fs.utimesSync(d, aged(dirAgeMs), aged(dirAgeMs));
  return d;
}

/** acquire() 卡住时要能失败而不是把测试挂死。 */
function withTimeout(p, ms, desc) {
  let t;
  const guard = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`超时 ${ms}ms 仍未完成：${desc}`)), ms);
    t.unref();
  });
  return Promise.race([p, guard]).finally(() => clearTimeout(t));
}

async function waitFor(pred, ms, desc) {
  const t0 = Date.now();
  for (;;) {
    if (pred()) return true;
    if (Date.now() - t0 > ms) throw new Error(`超时 ${ms}ms：${desc}`);
    await new Promise(r => setTimeout(r, 100));
  }
}

/** 异步 spawn（绝不用 spawnSync/execFileSync）—— 等退出码 + 收 stdout/stderr。 */
function run(args, env, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const child = spawn(args[0], args.slice(1), {
      env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    const t = setTimeout(() => { try { child.kill(); } catch {} resolve({ code: null, out, err, timedOut: true }); }, timeoutMs);
    child.on('error', e => { clearTimeout(t); resolve({ code: null, out, err: err + e.message, spawnError: true }); });
    child.on('exit', (code, sig) => { clearTimeout(t); resolve({ code, signal: sig, out, err }); });
  });
}

/** 长驻子进程：可以边跑边看输出。 */
function startChild(script, env) {
  const child = spawn(NODE, [script], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const st = { child, out: '', err: '', code: null, exited: false };
  child.stdout.on('data', d => { st.out += d; });
  child.stderr.on('data', d => { st.err += d; });
  child.on('exit', c => { st.code = c; st.exited = true; });
  return st;
}

/** 子进程：占一个槽 → 打印 ACQUIRED → 等到释放文件出现再干净地 release()。 */
const CHILD_SRC = `// 由 test/slot.test.mjs 生成：占一个槽并常驻，直到出现释放文件
const fs = await import('node:fs');
const mod = await import(process.env.SLOT_MODULE_URL);
const release = await mod.acquire({ slots: Number(process.env.CHILD_SLOTS), minFree: 0 });
console.log('ACQUIRED ' + process.pid);
const rel = process.env.CHILD_RELEASE_FILE;
const t = setInterval(() => {
  if (rel && fs.existsSync(rel)) { clearInterval(t); release(); console.log('RELEASED'); process.exit(0); }
}, 100);
`;

/**
 * 子进程：只调一次 tryTake 并把结果打出来。
 * ★ 为什么必须另起进程：tryTake 是**同步**的，卡在互斥锁上时会用 Atomics.wait 把整个
 *   事件循环钉死 —— 放在主进程里测，一旦判据坏掉就是测试永久挂起，而不是断言变红。
 */
const TRYTAKE_SRC = `// 由 test/slot.test.mjs 生成：单次 tryTake，结果打到 stdout
const mod = await import(process.env.SLOT_MODULE_URL);
try {
  const d = mod.tryTake(1, 100, 30);
  console.log('RESULT ' + (d ? 'took' : 'null'));
} catch (e) { console.log('THREW ' + (e && e.code)); }
`;

// ── 用例 ──────────────────────────────────────────────────────
const cases = [];
const test = (name, fn) => cases.push({ name, fn });

// ── 1. acquire / release 往返 ────────────────────────────────
test('acquire/release 往返：拿到槽 → release 清掉 → 能再拿到同一个槽', async () => {
  const dir = caseDir('roundtrip');
  const m = await loadSlot(dir);
  const s0 = path.join(dir, 'slot0');

  const r1 = await withTimeout(m.acquire({ slots: 2, minFree: 0 }), 5000, '第一次 acquire');
  assert.ok(fs.existsSync(s0), 'acquire() 应创建 slot0');
  assert.equal(fs.readFileSync(path.join(s0, 'pid'), 'utf8').trim(), String(process.pid), 'pid 文件里应是本进程 pid');
  assert.ok(fs.existsSync(path.join(s0, 'beat')), '应同时创建 beat 心跳文件');
  assert.deepEqual(slotDirs(dir), ['slot0'], '只占一个槽时应恰好是 slot0');

  r1();
  assert.ok(!fs.existsSync(s0), '★ release() 必须把槽位目录删掉（否则整机槽位会被慢慢吃光）');
  assert.deepEqual(slotDirs(dir), [], 'release 后不应残留任何槽位');

  const r2 = await withTimeout(m.acquire({ slots: 2, minFree: 0 }), 5000, '释放后第二次 acquire');
  assert.ok(fs.existsSync(s0), '★ release 后必须能再次拿到槽（否则限流器一次用完就死锁）');
  r2();
  assert.ok(!fs.existsSync(s0), '第二次 release 也要清干净');
});

// ── 2. 槽位上限 / 排队（必须子进程并发） ──────────────────────
test('★ 槽位上限：RENDER_SLOTS=2 时第 3 个子进程必须排队，别人释放后才拿到', async () => {
  const dir = caseDir('cap');
  fs.mkdirSync(dir, { recursive: true });
  const script = path.join(dir, 'child.mjs');
  fs.writeFileSync(script, CHILD_SRC);

  const base = {
    RENDER_SLOT_DIR: dir,
    RENDER_SLOT_HELD: '',                       // 显式清掉，避免被别的用例污染成"外层已占槽"
    SLOT_MODULE_URL: pathToFileURL(SLOT).href,
    CHILD_SLOTS: '2',
  };
  const kids = [];
  try {
    const a = startChild(script, { ...base, CHILD_RELEASE_FILE: path.join(dir, 'rel-a') });
    const b = startChild(script, { ...base, CHILD_RELEASE_FILE: path.join(dir, 'rel-b') });
    kids.push(a, b);
    await waitFor(() => a.out.includes('ACQUIRED') && b.out.includes('ACQUIRED'), 10000,
      'A/B 两个子进程应各占一个槽');
    assert.deepEqual(slotDirs(dir), ['slot0', 'slot1'], 'RENDER_SLOTS=2 时应恰好有 slot0/slot1 两个槽');

    const c = startChild(script, { ...base, CHILD_RELEASE_FILE: path.join(dir, 'rel-c') });
    kids.push(c);
    await waitFor(() => c.out.includes('waiting for a render slot'), 6000, 'C 应打印排队提示（说明它真的没拿到槽）');
    await new Promise(r => setTimeout(r, 2500));
    assert.ok(!c.out.includes('ACQUIRED'), '★ 满槽时第 3 个 acquire() 必须排队，绝不能直接返回');
    assert.equal(slotDirs(dir).length, 2, '★ 排队期间不得凭空多出第 3 个槽位（否则限流形同虚设）');

    fs.writeFileSync(path.join(dir, 'rel-a'), '');
    await waitFor(() => c.out.includes('ACQUIRED'), 15000, '★ A 释放后 C 必须拿到槽（排队要能真正解除）');
    assert.deepEqual(slotDirs(dir).sort(), ['slot0', 'slot1'], 'C 应该接管 A 让出来的槽，槽位数仍是 2');
  } finally {
    for (const k of kids) { try { k.child.kill(); } catch {} }
    await new Promise(r => setTimeout(r, 300));
  }
});

// ── 3. 过期槽接管 ────────────────────────────────────────────
test('过期槽接管 (a)：pid 是不存在的进程 ⇒ 必须接管（不能永久排队）', async () => {
  const dir = caseDir('stale-deadpid');
  const m = await loadSlot(dir);
  const bad = deadPid();
  // 心跳是**新鲜**的（200ms 前刚动过）：这样只有「进程不在了」这一条判据能解释接管，
  // 把 alive() 判据单独钉死（心跳过期那条由下面 (c) 负责）。
  const s0 = forgeSlot(dir, 0, bad, { beatAgeMs: 200, dirAgeMs: 200 });

  const t0 = Date.now();
  const r = await withTimeout(m.acquire({ slots: 1, minFree: 0 }), 8000,
    '★ 占用者进程已死时 acquire() 必须接管，而不是永久等待');
  assert.ok(Date.now() - t0 < 8000, '接管应是立即的');
  assert.equal(fs.readFileSync(path.join(s0, 'pid'), 'utf8').trim(), String(process.pid),
    '★ 死进程留下的槽必须被本进程接管（pid 被改写）');
  assert.equal(slotDirs(dir).length, 1, '接管后槽位数不变，只是换了持有者');
  r();
  assert.ok(!fs.existsSync(s0), 'release 后应清掉接管来的槽');
});

test('过期槽接管 (b)：pid 是活着的进程 + 心跳新鲜 ⇒ 绝不接管（进程存活判据）', async () => {
  const dir = caseDir('stale-alivepid');
  const m = await loadSlot(dir);
  // pid = 本进程（一定活着）；心跳 200ms 前刚动过（新鲜，且**确实落在过去** —— 设成"此刻"
  // 时文件系统 mtime 可能落到未来 1ms，会把 STALE_AFTER 判据测糊）；目录 mtime 故意做得很旧
  // ⇒ 只有「进程还活着 + 心跳新鲜」能解释"不接管"，同时证明心跳优先于目录 mtime。
  const s0 = forgeSlot(dir, 0, process.pid, { beatAgeMs: 200, dirAgeMs: 600000 });

  const got = m.tryTake(1, 100, 30);      // tryTake 是同步的，不会等待
  assert.equal(got, null, '★ 占用者还活着 ⇒ 不能接管（哪怕目录 mtime 很旧）');
  assert.equal(fs.readFileSync(path.join(s0, 'pid'), 'utf8').trim(), String(process.pid), '原槽位的 pid 不得被改写');
  assert.ok(fs.existsSync(s0), '原槽位目录必须还在');
  assert.equal(mtimeOf(path.join(s0, 'beat')) > Date.now() - 60000, true, '心跳文件不该被动过');
});

test('过期槽接管 (c)：pid 活着但心跳超过 STALE_AFTER ⇒ 按源码 OR 语义会被接管', async () => {
  const dir = caseDir('stale-beat');
  const m = await loadSlot(dir);
  // 这条记录的是**实现的真实语义**（见 slot.mjs:7 注释的"或"）：
  // 「进程不在」**或**「心跳超时」任一条成立 ⇒ 槽位过期。心跳冻结 120s 的活进程会被赶走。
  const s0 = forgeSlot(dir, 0, process.pid, { beatAgeMs: 120000, dirAgeMs: 120000 });

  const got = m.tryTake(1, 100, 30);
  assert.equal(got, s0, '★ 心跳超过 STALE_AFTER(90s) ⇒ 即使进程还活着也算过期、可被接管');
  assert.equal(fs.readFileSync(path.join(s0, 'pid'), 'utf8').trim(), String(process.pid), '接管后 pid 是本进程');
});

test('过期槽接管：槽位目录存在但 pid 缺失/损坏 ⇒ 超过 GRACE 后按过期处理', async () => {
  const dir = caseDir('stale-badpid');
  const m = await loadSlot(dir);
  const s0 = path.join(dir, 'slot0');
  fs.mkdirSync(s0, { recursive: true });
  fs.writeFileSync(path.join(s0, 'pid'), 'not-a-pid');
  fs.utimesSync(s0, aged(600000), aged(600000));      // 早于 GRACE(10s)

  const got = m.tryTake(1, 100, 30);
  assert.equal(got, s0, '★ pid 损坏 + 目录早已建好 ⇒ 必须能接管，不能把坏槽位永久占死');
});

test('tryTake 的前置条件：DIR 不存在时直接抛 ENOENT（导出 API 的隐性约束）', async () => {
  const dir = caseDir('nodir');
  const m = await loadSlot(dir);                      // loadSlot 会 mkdir(dir)，模拟 acquire() 的先行步骤
  assert.ok(typeof m.tryTake === 'function', 'tryTake 应导出（源码注明"仅供测试"）');
  rmrf(dir);                                          // 现在把 DIR 抽掉：acquire() 之外的调用者不会得到这个 mkdir
  assert.throws(() => m.tryTake(1, 100, 30), /ENOENT/,
    '记录：tryTake 假设 DIR 已存在（只有 acquire() 会 mkdir），单独调它会 ENOENT');
});

test('互斥锁：残留的 .mutex 超过 GRACE ⇒ 必须能清掉继续，不能永久自旋', async () => {
  const dir = caseDir('mutex-stale');
  fs.mkdirSync(dir, { recursive: true });
  const mx = path.join(dir, '.mutex');
  fs.mkdirSync(mx, { recursive: true });
  fs.utimesSync(mx, aged(60000), aged(60000));       // 模拟"上一个持有者崩在锁里了"

  const script = path.join(dir, 'trytake.mjs');
  fs.writeFileSync(script, TRYTAKE_SRC);
  const r = await run([NODE, script],
    { RENDER_SLOT_DIR: dir, SLOT_MODULE_URL: pathToFileURL(SLOT).href }, 8000);

  assert.ok(!r.timedOut, '★ 残留的 .mutex 超过 GRACE(10s) 后必须被清掉，否则整机永久卡在锁上');
  assert.match(r.out, /RESULT took/, `应能照常拿到槽（stdout=${JSON.stringify(r.out)} stderr=${JSON.stringify(r.err)}）`);
});

// ── 4. RENDER_SLOT_HELD ─────────────────────────────────────
test('RENDER_SLOT_HELD=1 ⇒ acquire() 直接放行、不建目录、不占槽（且只认 "1"）', async () => {
  const dir = caseDir('held');
  const m = await loadSlot(dir);
  rmrf(dir);                                        // 连 DIR 都删掉，看它会不会去建
  process.env.RENDER_SLOT_HELD = '1';
  try {
    // minFree=100 + slots=1：正常情况下必然被内存门槛挡住 ⇒ 只有 HELD 短路才能立刻返回
    const r = await withTimeout(m.acquire({ slots: 1, minFree: 100 }), 4000,
      '★ RENDER_SLOT_HELD=1 时必须直接放行');
    assert.equal(typeof r, 'function', 'acquire() 必须返回一个 release 函数');
    assert.ok(!fs.existsSync(path.join(dir, 'slot0')), '★ HELD 时不得创建槽位');
    assert.ok(!fs.existsSync(dir), '★ HELD 时应完全短路，连锁目录都不建');
    r();                                            // 必须是无害的 no-op
    r();                                            // 重复调用也不能炸
  } finally { delete process.env.RENDER_SLOT_HELD; }

  // 只认字符串 '1'：写成 '0' / 'true' 不能被误当成"外层已占槽"，否则限流会被静默关掉
  process.env.RENDER_SLOT_HELD = '0';
  try {
    const r3 = await withTimeout(m.acquire({ slots: 1, minFree: 0 }), 5000,
      'RENDER_SLOT_HELD=0 不该短路');
    assert.ok(fs.existsSync(path.join(dir, 'slot0')),
      '★ RENDER_SLOT_HELD 只认 "1"，"0" 必须照常占槽（否则限流被静默关掉）');
    r3();
  } finally { delete process.env.RENDER_SLOT_HELD; }
});

// ── 5. freePct ──────────────────────────────────────────────
test('freePct()：返回 0–100 之间的有限数（探测不到时按 100 处理）', async () => {
  const dir = caseDir('freepct');
  const m = await loadSlot(dir);
  for (let i = 0; i < 3; i++) {
    const v = m.freePct();
    assert.equal(typeof v, 'number', 'freePct() 必须返回 number');
    assert.ok(Number.isFinite(v), `freePct() 必须是有限数，得到 ${v}`);
    assert.ok(v >= 0 && v <= 100, `freePct() 必须落在 0–100，得到 ${v}`);
  }
});

// ── 6. CLI 模式 ─────────────────────────────────────────────
test('CLI：能跑通命令并透传退出码（0 / 7），退出后释放槽位', async () => {
  const dir = caseDir('cli');
  fs.mkdirSync(dir, { recursive: true });
  const env = { RENDER_SLOT_DIR: dir, RENDER_SLOTS: '3', RENDER_SLOT_HELD: '' };

  const r0 = await run([NODE, SLOT, '--', NODE, '-e', 'process.exit(0)'], env);
  assert.equal(r0.code, 0, `exit 0 应透传为 0（stderr: ${r0.err}）`);
  assert.deepEqual(slotDirs(dir), [], '★ CLI 退出后必须释放槽位（否则每次渲染都漏一个槽）');

  const r7 = await run([NODE, SLOT, '--', NODE, '-e', 'process.exit(7)'], env);
  assert.equal(r7.code, 7, '★ 子命令的退出码必须原样透传（7 不能变成 0）');
  assert.deepEqual(slotDirs(dir), [], '失败退出也要释放槽位');
});

test('CLI：没给 `--` 时打印用法并以 2 退出', async () => {
  const dir = caseDir('cli-usage');
  fs.mkdirSync(dir, { recursive: true });
  const r = await run([NODE, SLOT], { RENDER_SLOT_DIR: dir, RENDER_SLOTS: '3' });
  assert.equal(r.code, 2, '无 `--` 应以 2 退出');
  assert.match(r.err, /usage/, '应打印用法');
});

test('CLI：命令不存在时以 127 退出且不泄漏槽位', async () => {
  const dir = caseDir('cli-enoent');
  fs.mkdirSync(dir, { recursive: true });
  const r = await run([NODE, SLOT, '--', 'lemo-no-such-cmd-xyz', 'a'], { RENDER_SLOT_DIR: dir, RENDER_SLOTS: '3' });
  assert.equal(r.code, 127, '命令起不来应返回 127');
  assert.deepEqual(slotDirs(dir), [], '起不来也要把槽位还回去');
});

test('CLI：RENDER_SLOT_HELD=1 时直接跑命令、不占槽', async () => {
  const dir = caseDir('cli-held');
  fs.mkdirSync(dir, { recursive: true });
  const r = await run([NODE, SLOT, '--', NODE, '-e', 'process.exit(0)'],
    { RENDER_SLOT_DIR: dir, RENDER_SLOTS: '1', RENDER_SLOT_HELD: '1' });
  assert.equal(r.code, 0, 'HELD 时命令应正常跑完');
  assert.deepEqual(slotDirs(dir), [], '★ HELD 时不得创建槽位（外层已经占过了）');
});

// ── 7. 非法 env 回落 ────────────────────────────────────────
test('非法 env 回落：RENDER_SLOTS=abc ⇒ 有警告 + 回落到 3（真能拿到第 3 个槽）', async () => {
  const dir = caseDir('env-slots');
  const m = await loadSlot(dir);
  forgeSlot(dir, 0, process.pid, { beatAgeMs: 200 });   // 占掉 slot0
  forgeSlot(dir, 1, process.pid, { beatAgeMs: 200 });   // 占掉 slot1

  const errs = [];
  const orig = console.error; console.error = (...a) => errs.push(a.join(' '));
  let r;
  try {
    process.env.RENDER_SLOTS = 'abc';
    r = await withTimeout(m.acquire({ minFree: 0 }), 6000,
      '★ RENDER_SLOTS=abc 应回落到默认 3，从而能拿到 slot2（若回落到 1 会永久排队）');
  } finally { console.error = orig; delete process.env.RENDER_SLOTS; }

  assert.match(errs.join('\n'), /ignoring RENDER_SLOTS/, '非法值应产生一次警告');
  assert.ok(fs.existsSync(path.join(dir, 'slot2')),
    '★ 只有回落成 3 才拿得到 slot2 —— 这条把"警告了但没用默认值"也一起抓住');
  r();
});

test('非法 env 回落：RENDER_MIN_FREE=999 ⇒ 有警告 + 回落 30（不因内存门槛卡死）', async () => {
  const dir = caseDir('env-minfree');
  const m = await loadSlot(dir);
  const free = m.freePct();
  if (!(free >= 30)) {
    return skip(`本机空闲内存 ${free.toFixed(1)}% < 30%，无法区分"回落到 30"与"真用了 999"`);
  }
  forgeSlot(dir, 0, process.pid, { beatAgeMs: 200 });   // 占掉 slot0，让内存门槛真正生效

  const errs = [];
  const orig = console.error; console.error = (...a) => errs.push(a.join(' '));
  let r;
  try {
    process.env.RENDER_MIN_FREE = '999';
    r = await withTimeout(m.acquire({ slots: 2 }), 6000,
      '★ RENDER_MIN_FREE=999 应回落到 30，从而能拿到 slot1（若真用 999 会永久排队）');
  } finally { console.error = orig; delete process.env.RENDER_MIN_FREE; }

  assert.match(errs.join('\n'), /ignoring RENDER_MIN_FREE/, '非法值应产生一次警告');
  assert.ok(fs.existsSync(path.join(dir, 'slot1')),
    '★ 只有回落成 30（< 本机空闲内存）才拿得到 slot1');
  r();
});

// ── 跑 ──────────────────────────────────────────────────────
const skips = new Map();                 // name -> 原因
function skip(reason) { throw { __skip: reason }; }

async function main() {
  rmrf(SANDBOX);
  fs.mkdirSync(SANDBOX, { recursive: true });

  const only = process.env.SLOT_ONLY || '';
  const picked = only ? cases.filter(c => c.name.includes(only)) : cases;

  log(C.b(`\ncore/render/slot.mjs —— 整机渲染限流器测试（${picked.length} 条${only ? `，筛选 "${only}"` : ''}）`));
  log(C.dim(`  被测：${SLOT}`));
  log(C.dim(`  沙箱：${SANDBOX}`));
  log('');

  const t0 = Date.now();
  const results = [];
  for (const c of picked) {
    const s = Date.now();
    try {
      await c.fn();
      results.push({ name: c.name, ok: true });
      log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
    } catch (e) {
      if (e && e.__skip) {
        skips.set(c.name, e.__skip);
        results.push({ name: c.name, skipped: true });
        log(`  ${C.yel('SKIP')}  ${c.name} ${C.dim(`— ${e.__skip}`)}`);
      } else {
        results.push({ name: c.name, ok: false, err: e });
        log(`  ${C.bad('FAIL')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
        for (const line of String((e && e.message) || e).split('\n')) log(`        ${line}`);
      }
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok && !r.skipped);
  const nSkip = results.filter(r => r.skipped).length;
  log('');
  log('─'.repeat(64));
  const tail = `${passed} passed, ${failed.length} failed${nSkip ? `, ${nSkip} skipped` : ''}`;
  if (failed.length) {
    log(C.bad(`  ${tail}`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
    for (const f of failed) log(C.bad(`  ✗ ${f.name}`));
  } else {
    log(C.ok(`  ${tail}`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
  }
  log('─'.repeat(64));
  log('');

  rmrf(SANDBOX);
  const code = failed.length ? 1 : 0;
  process.exitCode = code;
  // 兜底：如果某个 acquire() 还在后台死等（例如破坏验证把判据改坏），
  // 它自己的 setTimeout 会吊住事件循环 ⇒ 这个 unref 定时器会把它一起带走。
  setTimeout(() => process.exit(code), 300).unref();
}

main().catch(e => {
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
  setTimeout(() => process.exit(2), 300).unref();
});
