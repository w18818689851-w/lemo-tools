// test/host-scripts.test.mjs —— `lib/host-scripts.mjs` 的**不可逆清扫阈值**两道防护（独立入口，零依赖）
//
// ★ 由来（2026-10-12）：本批把「锁过期 6h」收成单一来源 `lib/lock.mjs` 的 `LOCK_MAX_AGE_MS`，
//   而**第四处同数值**的 `lib/host-scripts.mjs` 的 `STALE_MS`（宿主临时脚本的 mtime 兜底）**没有纳入**。
//   独立仲裁员（V1）裁决「**不该共用**」（报告 `D:/lemo-tmp/align-audit/V1-STALE_MS该不该共用的仲裁.md`）：
//     · 锁 = `alive && ageMs < X`（**合取**：pid 与 mtime 两个信号，超窗动作是**接管**、可逆）；
//     · 宿主 .sh 清扫 = `now - mtimeMs > X`（**纯 mtime 的析取项**：一个信号，超窗动作是 `unlinkSync` **删文件**、不可逆）。
//   ⇒ 数值相同是**巧合**（同属「6h 无生命迹象 ⇒ 必然已死」这一口径），不是同一判据 ⇒ **保留两个独立常量**。
//
// ★ 本用例钉住 V1 的两条防护（都是**加强**，不放宽任何既有判据）：
//   ① **下界守卫**：`STALE_MS` 不得小于 60_000 —— 它守的是**唯一有正确性后果**的那个方向。
//   ② **同值冻结**：两处当前同值 ⇒ 用**机械判据**钉住「同值 ≠ 同判据」这句注释承诺：
//      谁改了任一处、另一处没同批改，本用例**必红**（要么把数值改回一致、要么同批改本用例并写明为何解耦）。
//
// ★★ 本用例**绝不**碰 `D:\WSL`（宿主 .sh 一律造在 `D:/lemo-tmp/` 的本次专属子树里），
//   也**绝不**改真实 `lib/host-scripts.mjs`（下界守卫那一条只对**副本**动手，并在 `finally` 里核对真文件逐字节未变）。
//
// ★ 危险窗口的**独立复验数字**（本机实测，探测脚本 `D:/lemo-tmp/windowprobe.mjs`；VM 先热身以免冷启动干扰）：
//   · 有 `sed` 预读的形态（复刻 `lemo-make.mjs` / `lib/env.mjs` 的 `runWsl`）：t+5s 删 ⇒ `code=0`（不破坏在飞调用）、
//     t+15ms 删 ⇒ `code=2`（`sed: can't read …: No such file or directory`）；
//   · 无预读的形态（复刻 `lib/dub-core.mjs` 的 `runWsl`，`exec bash <file>`）：t+15ms 删 ⇒ `code=127`、
//     t+150ms 删 ⇒ `code=0`、t+5s 删 ⇒ `code=0`。
//   ⇒ 窗口的**上界**远小于 1 s（与 V1 报告「≈ 0–300ms」一致），故 60 s 下界的裕度是 **≥200×**。
//   ★ 这一段只作**注释**保留、不在本文件里真跑 WSL：本用例必须能在一台**没装 WSL**的机器上跑出结论。

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripComments } from '../lib/js-scan.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const HS = path.join(ROOT, 'lib', 'host-scripts.mjs');
const LK = path.join(ROOT, 'lib', 'lock.mjs');
const TMP_BASE = process.env.LEMO_TMP || 'D:/lemo-tmp';   // ★ 非 C 盘
const DIR = path.join(TMP_BASE, `host-scripts-${process.pid}-${Date.now().toString(36)}`);

/** 从源码里取出 `const <name> = <表达式>;` 的**表达式原文**（`export` 前缀可选；取不到 ⇒ 判据失明，直接红）。 */
function declOf(file, name) {
  const src = fs.readFileSync(file, 'utf8');
  const m = new RegExp(`^(?:export\\s+)?const ${name} = (.+?);$`, 'm').exec(src);
  assert.ok(m, `${path.basename(file)} 里找不到 \`const ${name} = …;\` 声明 ⇒ 本判据已失明（声明形态变了）`);
  return m[1].trim();
}

/** 把常量表达式**求值**（两处都是 `6 * 3600 * 1000` 这种纯算术；求值前先确认它只含算术字符）。 */
function valueOf(expr) {
  assert.match(expr, /^[\d\s*+()_]+$/, `常量表达式 \`${expr}\` 不是纯算术 ⇒ 本判据拒绝盲求值`);
  const v = Number(new Function(`return (${expr});`)());
  assert.ok(Number.isFinite(v) && v > 0, `\`${expr}\` 求值不是正有限数（得到 ${v}）`);
  return v;
}

/** 子进程加载一个模块，回报 `{code, out, err}`（★ 本机 `spawnSync`/`execFileSync` 一律 EBUSY ⇒ 用异步 `spawn`）。 */
function loadInChild(target) {
  fs.mkdirSync(DIR, { recursive: true });
  const driver = path.join(DIR, 'load-driver.mjs');
  if (!fs.existsSync(driver)) {
    fs.writeFileSync(driver, [
      "import { pathToFileURL } from 'node:url';",
      'await import(pathToFileURL(process.argv[2]).href);',
      "process.stdout.write('LOADED\\n');",
      '',
    ].join('\n'), 'utf8');
  }
  return new Promise((res) => {
    const p = spawn(process.execPath, [driver, target], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => res({ code, out, err }));
    p.on('error', (e) => res({ code: null, out, err: String(e && e.message) }));
  });
}

fs.rmSync(DIR, { recursive: true, force: true });
process.on('exit', () => { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

// ── 防护②：同值冻结（**同值 ≠ 同判据**）+ 「不许合并」的机械冻结 ────────────────
test('防护②·同值冻结：STALE_MS 与 LOCK_MAX_AGE_MS 数值相同，但必须各自持有（不许合并）', () => {
  const hsExpr = declOf(HS, 'STALE_MS');
  const lkExpr = declOf(LK, 'LOCK_MAX_AGE_MS');
  const hs = valueOf(hsExpr);
  const lk = valueOf(lkExpr);

  assert.equal(hs, lk,
    `两处当前同值：STALE_MS = ${hs}、LOCK_MAX_AGE_MS = ${lk}。★ 这是**冻结断言**：改任一处就**必须同批**评估另一处 —— `
    + '要么把数值改回一致，要么同批改本用例并在两侧注释里写明「为何解耦」（V1 裁决：不该共用 ⇒ 只能解耦、不能静默漂）');
  assert.equal(hs, 6 * 3600 * 1000,
    `STALE_MS 当前是 6h（${6 * 3600 * 1000}ms），实际 ${hs} —— 若这是有意的改动，请同批改本用例并写明理由`);

  // ★ 「不许合并成同一个常量」的机械冻结：`lib/host-scripts.mjs` 的**代码**里不得出现 `LOCK_MAX_AGE_MS`，
  //   也不得 import `lib/lock.mjs`（注释里提到它是**允许且要求**的 —— 故先剥注释再判）。
  const code = stripComments(fs.readFileSync(HS, 'utf8'));
  assert.doesNotMatch(code, /LOCK_MAX_AGE_MS/,
    '★ 不许把两处合并成同一个常量（V1 裁决：判据不同、可逆性不同）—— `lib/host-scripts.mjs` 的代码里出现了 `LOCK_MAX_AGE_MS`');
  assert.doesNotMatch(code, /^\s*import\b[^\n]*lock\.mjs/m,
    '★ `lib/host-scripts.mjs` 不得 import `lib/lock.mjs`（那正是「合并成单一来源」的形态，V1 已裁决不该共用）');
});

// ── 防护①：下界守卫**有牙**（副本改 1000 ⇒ 必告警；且**不抛异常**带崩编排器）────────
test('防护①·下界守卫有牙：副本里 STALE_MS = 1000 ⇒ 加载即告警，且**不抛异常**（真文件逐字节未变）', async () => {
  const before = fs.readFileSync(HS);
  assert.equal(valueOf(declOf(HS, 'STALE_MS')), 6 * 3600 * 1000,
    '夹具问题：真文件当前不是 6h ⇒ 「正常值不告警」那半白测（先把它改回来再跑本用例）');

  fs.mkdirSync(DIR, { recursive: true });
  const src = before.toString('utf8');
  const mutated = src.replace(/^const STALE_MS = .+;$/m, 'const STALE_MS = 1000;');
  assert.notEqual(mutated, src, '变异没生效（找不到 `const STALE_MS = …;` 那一行？）⇒ 本用例前提不成立');
  const mutant = path.join(DIR, 'host-scripts-mutant.mjs');
  fs.writeFileSync(mutant, mutated, 'utf8');

  try {
    const m = await loadInChild(mutant);
    assert.match(m.out, /LOADED/, `副本应能正常加载完（实际 out: ${JSON.stringify(m.out)}）`);
    assert.equal(m.code, 0,
      '★ 越界只该**告警**、不该抛异常 —— 本模块被编排器（红线）与 lib/env.mjs / lib/dub-core.mjs 静态 import，'
      + `加载期 throw 会把编排器整趟带崩。实际 exit=${m.code}、stderr=${JSON.stringify(m.err)}`);
    assert.match(m.err, /\[host-scripts\]/, `★ 守卫**没有牙**：STALE_MS = 1000 却没有告警。stderr=${JSON.stringify(m.err)}`);
    assert.match(m.err, /STALE_MS = 1000ms/, '告警必须**点出实际值**（否则看日志的人不知道被改成了多少）');
    assert.match(m.err, /60000ms/, '告警必须**点出下界**（60_000ms）');
    assert.match(m.err, /200×/, '告警必须说明**为什么**是这个下界（危险窗口 ≈ 0–300ms 的 200× 裕度）');
  } finally {
    assert.ok(before.equals(fs.readFileSync(HS)),
      '★ 红线：本用例只许动**副本** —— 真实 `lib/host-scripts.mjs` 必须逐字节未变');
  }
});

// ── 防护①的阴性对照：正常值（6h）下加载**零输出**（不打扰编排器）──────────────
test('防护①·阴性对照：真模块（STALE_MS = 6h）加载 ⇒ stderr **零字节**、exit 0', async () => {
  const r = await loadInChild(HS);
  assert.match(r.out, /LOADED/, `真模块应能正常加载（实际 out: ${JSON.stringify(r.out)}）`);
  assert.equal(r.code, 0, `真模块加载应 exit 0（实际 ${r.code}、stderr=${JSON.stringify(r.err)}）`);
  assert.equal(r.err, '',
    `★ 正常路径必须**零输出**（本模块被编排器与多个模块 import，不该在正常值下刷告警）。实际 stderr=${JSON.stringify(r.err)}`);
});
