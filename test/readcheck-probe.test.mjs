#!/usr/bin/env node
// test/readcheck-probe.test.mjs —— 上游 `core/render/readcheck.mjs` 三个退出码的**端到端**回归
//
// ★ 为什么必须有这一份（这条缺口被反复登记、始终没关闭）：
//   编排器第 6 步「阅读时长自检」调上游三道机器门禁之一的 `readcheck`，而 `lemo-make.mjs` 的
//   退出码语义**全靠 `0 / 1 / 2` 三档分开报**（`2` = 「无从检查」，原文 "This is not a pass."，
//   **绝不能**被当成通过、也不能被当成不达标）。
//   但全库 43 个风格**一个都没实现 `window.TEXTS`**（实测 grep 命中 0）⇒ 编排器的**廉价预判**
//   （`demoHasTexts()`）必然跳过，真跑也必然只返回 `2`。结果：**`exit 0` 与 `exit 1` 两条分支
//   从来没有被端到端实跑过** —— 三档语义里的两档是「读码推断」而不是「实测」。
//   ⇒ 本文件用**库仓之外的最小夹具**把三个退出码各钉一条，从此不再依赖「某个风格哪天实现了 TEXTS」。
//
// ★ 夹具能放库仓之外（本测试成立的前提，已读码确认 + 实测）：
//   `core/render/page.mjs:22-26` 的 `pageURL()` 对**仓库外**目录走 `/@film/` 挂载分支
//   （`core/render/serve.mjs:10,22-26`）⇒ 传绝对路径的夹具目录照样能开页。
//   ★ 于是本测试**绝不依赖库仓里存在某个风格**（全库变了也不会红），也**绝不往库仓写任何文件**。
//
// ★ 隔离：
//   · 夹具只写在 `D:/lemo-tmp/` 下（本项目硬规则：产物/缓存一律非 C 盘），`after()` 里清掉。
//   · 只**读**库仓（`core/render/readcheck.mjs` 及其依赖），不写、不改。
//   · 本机 `spawnSync` / `execFileSync` **一律 EBUSY** ⇒ 只用异步 `spawn`（同 review.test.mjs）。
//   · 会起一次无头 Chromium（占显存）：每次跑完由 readcheck 自己 `browser.close()`；本文件不额外常驻。
//
// 用法：node test/readcheck-probe.test.mjs
// 退出码：全绿 0，有失败 1。
//
// ★ 口径出处（逐字核对过）：
//   · 契约：`core/render/readcheck.mjs:1-9` 头注释（`window.TEXTS(t) → [{id,text,x0,y0,x1,y1}]`）。
//   · 判据：`core/render/readcheck.mjs:44` —— `need = max(MIN, cjk/CJK + other/LATIN + PAD)`，
//     默认 `--cjk-cps 4.5` / `--latin-cps 15` / `--pad 1.5` / `--min 1.5`。
//   · `2` 的三个文案分支：`core/render/readcheck.mjs:38-41`（无 `TEXTS` / `DUR` 非正 / 整片无文字）。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const LIB = process.env.LEMO_LIB_WIN || 'D:/lemo-opuscar';
const READCHECK = path.join(LIB, 'core', 'render', 'readcheck.mjs');
const FX = 'D:/lemo-tmp/readcheck-probe.test-fx';        // 本测试的临时夹具根（绝不碰库仓）

// ── 夹具：三个最小页面，只实现 readcheck 真正会读的 render / DUR / TEXTS / READY ──
// 判据（出处见本文件头注释的「口径出处」段）：need = max(1.5, cjk/4.5 + other/15 + 1.5)
//   DUR = 4 ⇒ 循环 t = 0…4 步进 0.04，最后一段的 run ≈ 4.00 s（实测两端一致）。
const PAGE = (head, body) =>
  `<!doctype html>\n<html><head><meta charset="utf-8"><title>${head}</title></head>\n<body>\n<script>\n${body}\n</script>\n</body></html>\n`;

const FIXTURES = {
  // ① exit 2 —— 故意**不**实现 window.TEXTS（= 全库 43 个风格当前的形态）
  'no-texts': PAGE('probe NOT CHECKED', [
    'window.DUR = 4;',
    'window.render = function (t) { window.__t = t; };',
    'window.READY = true;',
  ].join('\n')),
  // ② exit 0 —— 5 个拉丁字符 ⇒ need = 5/15 + 1.5 = 1.83 s ≤ run 4.00 s
  ok: PAGE('probe OK', [
    'window.DUR = 4;',
    'window.render = function (t) { window.__t = t; };',
    "window.TEXTS = function (t) { return [{ id: 'title', text: 'Hello', x0: 100, y0: 100, x1: 500, y1: 200 }]; };",
    'window.READY = true;',
  ].join('\n')),
  // ③ exit 1 —— 120 个拉丁字符 ⇒ need = 120/15 + 1.5 = 9.50 s > run 4.00 s ⇒ BAD
  bad: PAGE('probe BAD', [
    'window.DUR = 4;',
    'window.render = function (t) { window.__t = t; };',
    "window.TEXTS = function (t) { return [{ id: 'long-line', text: new Array(121).join('A'), x0: 100, y0: 100, x1: 1800, y1: 200 }]; };",
    'window.READY = true;',
  ].join('\n')),
};

fs.rmSync(FX, { recursive: true, force: true });
for (const [name, html] of Object.entries(FIXTURES)) {
  fs.mkdirSync(path.join(FX, name), { recursive: true });
  fs.writeFileSync(path.join(FX, name, 'index.html'), html);
}

after(() => {
  try { fs.rmSync(FX, { recursive: true, force: true }); } catch { /* 清不掉也不影响结论 */ }
});

// ── 依赖：库仓里的 readcheck + 它要用的 playwright-core（缺一 ⇒ 显式 skip，不假装通过）──
const MISSING = !fs.existsSync(READCHECK) ? `库仓里没有 ${READCHECK}`
  : !fs.existsSync(path.join(LIB, 'node_modules', 'playwright-core', 'package.json')) ? `${LIB} 里没有 node_modules/playwright-core`
  : null;
// ★ 必须**条件传参**、不能写死 `{ skip: MISSING }`：本机 Node 22.22.2 实测把 `{ skip: null }`
//   判成 SKIP —— 而且**函数体照样执行**（断言跑了、结果却报 SKIP）⇒ 那是一个「失败被吞掉」的假绿陷阱。
//   实测：`test('a', { skip: null }, () => console.log('BODY RAN a'))` 打印了 BODY RAN a，TAP 却是 `ok 1 - a # SKIP`。
const OPTS = MISSING ? { skip: MISSING } : {};

/** 异步子进程（★ spawnSync / execFileSync 在本机一律 EBUSY）。 */
function run(args, opts = {}) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, args, { windowsHide: true, ...opts });
    let out = '', err = '';
    c.stdout?.on('data', (d) => { out += d; });
    c.stderr?.on('data', (d) => { err += d; });
    c.on('error', (e) => resolve({ code: -1, out, err: String(e.message) }));
    c.on('close', (code) => resolve({ code, out, err }));
  });
}

/** 跑 readcheck（cwd = 库仓根，与 `lemo-make.mjs` 第 6 步的调用口径一致）。 */
const readcheck = (fixture) =>
  run([path.join('core', 'render', 'readcheck.mjs'), path.join(FX, fixture), '--size', '1920x1080'], { cwd: LIB });

// ── ① exit 2 = NOT CHECKED（不是通过、也不是不达标）────────────────────────
test('无 window.TEXTS ⇒ exit 2 + NOT CHECKED（全库 43 个风格的当前形态）', OPTS, async () => {
  const r = await readcheck('no-texts');
  assert.equal(r.code, 2, `期望 exit 2，实际 ${r.code}\n${r.err.slice(-1500)}`);
  assert.match(r.err, /NOT CHECKED/);
  assert.match(r.err, /no window\.TEXTS\(t\)/);
  assert.match(r.err, /This is not a pass\./);
  assert.equal(r.out.trim(), '', 'NOT CHECKED 时不该打印任何 OK/BAD 行');
});

// ── ② exit 0 = 全部达标 ────────────────────────────────────────────────────
test('文字足够少 ⇒ exit 0 + OK 行（need 1.83s ≤ got 4.00s）', OPTS, async () => {
  const r = await readcheck('ok');
  assert.equal(r.code, 0, `期望 exit 0，实际 ${r.code}\n${r.err.slice(-1500)}`);
  assert.match(r.out, /^OK\s+title\b/m, `应有 OK 行，实际输出：${r.out}`);
  assert.match(r.out, /need 1\.83s/);
  assert.doesNotMatch(r.out, /^BAD\b/m);
});

// ── ③ exit 1 = 有不达标 ───────────────────────────────────────────────────
test('文字明显过多 ⇒ exit 1 + BAD 行（need 9.50s > got 4.00s）', OPTS, async () => {
  const r = await readcheck('bad');
  assert.equal(r.code, 1, `期望 exit 1，实际 ${r.code}\n${r.err.slice(-1500)}`);
  assert.match(r.out, /^BAD\s+long-line\b/m, `应有 BAD 行，实际输出：${r.out}`);
  assert.match(r.out, /120 chars/);
  assert.match(r.out, /need 9\.50s/);
  assert.doesNotMatch(r.out, /^OK\b/m);
});
