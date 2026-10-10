#!/usr/bin/env node
/**
 * test/resources.test.mjs —— `lib/resources.mjs` 的**纯逻辑 / 离线**测试（零依赖）
 *
 * ★ 为什么必须有这一份：
 *   本模块对外的**核心承诺**是「**本地优先、禁止重复下载**」——
 *   只有状态 `ready` 才**跳过下载**；`missing` / `corrupt` / `version-mismatch` / `path-abnormal`
 *   一律触发「缺失提示 + 一键下载 + 手动导入」（契约 §四）。这种承诺**只能靠测试钉住**：
 *   某次重构里 `planDownloads` 少写一个状态守卫，就会让**已就绪的资源被反复重下**。
 *   ⇒ 下面用**合成 scan 结果**演练每个分支，且**逐条断言**。
 *
 * ★ 纪律：
 *   · **零依赖、可离线**：不真下载、不打外网、**不起 WSL**（`scanAll` 用 `opts.envResult` 注入桩结果）。
 *   · **不碰真实盘**：在 import 之前把资源根 `LEMO_RES_DIR` 指到 `D:/lemo-tmp/...` 临时目录（非 C 盘），
 *     跑完递归删；**不碰真实 `D:\lemo-res`**。
 *   · 用 `node:test` + `node:assert/strict`。
 *
 * 覆盖：
 *   ① KINDS / STATES 常量逐字冻结；
 *   ② classify 五态真值表（missing / ready / corrupt / version-mismatch / path-abnormal）；
 *   ③ satisfies 的 `>=` / `^` / 精确 / `*`；
 *   ④ dirFor 正常落盘路径 + **路径穿越被拒**（抛）；
 *   ⑤ dirPlan() 结构；
 *   ⑥ planDownloads() 对合成 scan 的动作清单（★「ready 不产生下载动作」= 本地优先核心断言）；
 *   ⑦ scanAll({envResult}) **离线**跑通（注入桩 envResult，不起 WSL）；
 *   ⑧ RESOURCES 注册表 schema 自检；
 *   ⑨ mount **接线**：`runDownload` / `importResource` 的函数体里真的 `await mount(`（静态，
 *      不真下载），且导入成功返回带 `mount` / `mounted`（`opts.mount=false` ⇒ 跳过挂载）——
 *      堵「**有导出 ≠ 有功能**」的假绿（`mount` 曾被这两个入口完全无视，而导出检查一直是绿的）。
 *   ⑩ ★ **端到端（离线）**：资源就绪 ⇒ 导入后**真的挂载**（`mounted:true`）；资源不可用 ⇒ 导入本身仍
 *      `ok:true` 但 `mounted:false` 且 `detail` 说明「挂载失败」（★ **不把「挂载失败」混成「导入失败」**，
 *      否则会误触发重新下载）。⑨ 只证「调用了 mount」，⑩ 才证「**mount 真的跑对了**」——
 *      `mount(id, opts)` 把 opts 透传给 `scanOne` ⇒ 注入合成 `envResult` 即可离线判定状态，**不起 WSL**。
 *   ⑪ ★ **三条下载真路径（离线）**：`_dlHttp` 成功（本机 http ⇒ **先落 `_download/` → 校验 → 移入 `dirFor()`**、
 *      字节一致）、0 字节坏来源 ⇒ `state:'corrupt'` 且**留在 `_download/` 未移入**、sha256 不符 ⇒ 同左；
 *      `_dlExec`（**只用 `where:'win'`**）成功 ⇒ `ok:true`、`exit 1` ⇒ `ok:false` 且**不挂载**；
 *      `importResource` 的**目录分支**（整目录含子目录递归复制）。
 *      ★ 注册表条目 `Object.freeze` **不能运行时改** ⇒ 用「**整棵拷 `lib/` 到临时树 + 改副本源码 +
 *      import 副本**」的办法装下载源（先例见 `test/gate-blindness.test.mjs` 的 `fs.cpSync`）。**绝不改真实模块**。
 *   ★ **未覆盖（如实登记）**：`_dlGit`（`git clone` 需真联网 / 真仓库 ⇒ **无法离线**）与 `_dlExec` 的
 *      `where:'wsl'` 分支（会**真起 WSL** ⇒ 离线用例一律不碰）。
 *
 * 用法：node test/resources.test.mjs
 * 退出码：全绿 0，有失败 1。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ── ★ 先把资源根指到临时目录（**必须在 import 之前**：模块在求值期可能就解析了根）
const TMP = `D:/lemo-tmp/res-test-${process.pid}-${Date.now().toString(36)}`;   // ★ 非 C 盘
fs.mkdirSync(TMP, { recursive: true });
process.env.LEMO_RES_DIR = TMP;
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ } });

// ★ 动态 import：让上面的 LEMO_RES_DIR 先生效（静态 import 会被提升到文件顶部）。
const {
  KINDS, STATES, resourceRoot, dirFor, dirPlan, RESOURCES,
  classify, satisfies, planDownloads, scanAll, scanOne, mount, runDownload, importResource,
} = await import('../lib/resources.mjs');

test('KINDS / STATES 常量逐字冻结（契约 §二 / §四）', () => {
  assert.deepEqual([...KINDS], ['env', 'dep', 'model', 'asset', 'plugin'],
    `KINDS 必须逐字等于 ['env','dep','model','asset','plugin']，实测 ${JSON.stringify(KINDS)}`);
  assert.deepEqual([...STATES], ['ready', 'missing', 'corrupt', 'version-mismatch', 'path-abnormal'],
    `STATES 必须逐字等于 5 态，实测 ${JSON.stringify(STATES)}`);
});

test('classify：五态真值表（契约 §六）', () => {
  assert.equal(classify({ found: false }, {}), 'missing', '没找到 ⇒ missing');
  assert.equal(classify({ found: true, executable: true, version: '7.1' }, { want: '>=6.0' }), 'ready',
    '找到 + 可执行 + 版本满足 ⇒ ready（= 直接用，跳过下载）');
  assert.equal(classify({ found: true, executable: false }, {}), 'corrupt', '找到但不可执行 ⇒ corrupt');
  assert.equal(classify({ found: true, executable: true, version: '5.0' }, { want: '>=6.0' }), 'version-mismatch',
    '找到能跑但版本不满足 ⇒ version-mismatch');
  assert.equal(classify({ found: true, pathAbnormal: true }, {}), 'path-abnormal', '路径异常 ⇒ path-abnormal');
});

test('satisfies：`>=` 语义', () => {
  assert.equal(satisfies('7.1', '>=6.0'), true, '7.1 应满足 >=6.0');
  assert.equal(satisfies('6.0', '>=6.0'), true, '边界 6.0 应满足 >=6.0');
  assert.equal(satisfies('5.0', '>=6.0'), false, '5.0 不应满足 >=6.0');
});

test('satisfies：`^` / 精确 / `*`', () => {
  assert.equal(satisfies('7.5', '^7.0'), true, '^7.0 应接受 7.5（同主版本且 >=7.0）');
  assert.equal(satisfies('8.0', '^7.0'), false, '^7.0 应拒绝 8.0（主版本不同）');
  assert.equal(satisfies('7.1.2', '7.1.2'), true, '精确匹配相等版本');
  assert.equal(satisfies('7.1.3', '7.1.2'), false, '精确匹配不相等版本');
  assert.equal(satisfies('1.2.3', '*'), true, '`*` 接受任意版本');
  assert.equal(satisfies('0.0.1', '*'), true, '`*` 接受任意版本（含 0.x）');
});

test('dirFor：正常 id 落在 <root>/<kind>/<id>（契约 §三）', () => {
  const d = dirFor('dep', 'my-tool');
  assert.ok(path.isAbsolute(d), `dirFor 应返回绝对路径，实测 ${d}`);
  assert.equal(d, path.join(resourceRoot(), 'dep', 'my-tool'),
    `dirFor('dep','my-tool') 应等于 <root>/dep/my-tool，实测 ${d}`);
});

test('dirFor：路径穿越被拒（抛）（契约 §九.4）', () => {
  for (const bad of ['../../etc', '..', 'a/b', 'a\\b', '.hidden', '/abs']) {
    assert.throws(() => dirFor('dep', bad), `dirFor 应对非法 id ${JSON.stringify(bad)} 抛（防路径穿越）`);
  }
});

test('dirPlan：结构完整（契约 §三）', () => {
  const p = dirPlan();
  assert.ok(p && typeof p === 'object', 'dirPlan 应返回对象');
  for (const k of ['root', 'kinds', 'download', 'note']) {
    assert.ok(k in p, `dirPlan 应含字段 ${k}，实测键 ${Object.keys(p).join(',')}`);
  }
  for (const k of ['env', 'dep', 'model', 'asset', 'plugin']) {
    assert.ok(k in p.kinds, `dirPlan.kinds 应含 ${k}`);
  }
  assert.equal(p.root, resourceRoot(), 'dirPlan.root 应等于 resourceRoot()');
  assert.equal(typeof p.download, 'string', 'dirPlan.download 应是下载中转目录路径（字符串）');
});

test('planDownloads：ready 不产生动作、非 ready 产生（★ 本地优先核心断言）', () => {
  // 合成一份 scan 结果（5 条，覆盖全部状态）；只喂纯函数，不碰 IO。
  const scan = {
    resources: [
      { id: 'ready.one', kind: 'dep', state: 'ready', download: { url: 'u1' }, import: false, autoFixable: true },
      { id: 'miss.two', kind: 'dep', state: 'missing', download: { url: 'u2' }, import: false, autoFixable: true },
      { id: 'corrupt.three', kind: 'model', state: 'corrupt', download: null, import: true, autoFixable: false },
      { id: 'vmis.four', kind: 'asset', state: 'version-mismatch', download: { url: 'u4' }, import: false, autoFixable: true },
      { id: 'pabn.five', kind: 'plugin', state: 'path-abnormal', download: null, import: true, autoFixable: false },
    ],
  };
  const acts = planDownloads(scan);
  assert.ok(Array.isArray(acts), `planDownloads 应返回数组，实测 ${typeof acts}`);
  const blob = JSON.stringify(acts);
  assert.ok(!blob.includes('ready.one'),
    `★ ready 的资源**不得**产生任何下载 / 导入动作（本地优先，禁止重复下载）；实测动作：${blob}`);
  for (const id of ['miss.two', 'corrupt.three', 'vmis.four', 'pabn.five']) {
    assert.ok(blob.includes(id), `非 ready 资源 ${id} 应产生动作（缺失提示 / 一键下载 / 手动导入）`);
  }
});

test('scanAll：注入 envResult 后离线跑通（不起 WSL）', async () => {
  // 桩 envResult：形状对齐 lib/env.mjs 的 checkEnv() 返回，避免真起 WSL。
  const envResult = {
    groups: [{ title: 'stub', items: [{ id: 'win.ffmpeg', label: 'stub', status: 'ok', detail: 'stub' }] }],
    summary: { total: 1, ok: 1, warn: 0, fail: 0 },
    runnable: true, drift: [], checkedAt: new Date().toISOString(),
  };
  const res = await scanAll({ envResult, force: true });
  assert.ok(res && typeof res === 'object', 'scanAll 应返回对象');
  assert.ok(Array.isArray(res.resources), 'scanAll 应返回 resources 数组');
  assert.ok(res.summary && res.summary.total === res.resources.length,
    `summary.total 应等于 resources.length（实测 ${res.summary && res.summary.total} vs ${res.resources.length}）`);
  assert.ok(res.dirPlan && 'root' in res.dirPlan, 'scanAll 结果应带 dirPlan');
  assert.equal(typeof res.checkedAt, 'string', 'scanAll 结果应带 checkedAt 字符串');
  for (const r of res.resources) {
    assert.ok(STATES.includes(r.state), `资源 ${r.id} 的 state=${r.state} 应在 STATES 内`);
  }
});

// ── ⑬ ★ RISK-11：`_download/` 中转目录占用**可见**（只报，不删）───────────────
//   ★ 由来：`_dlHttp` 在校验不过（0 字节 / sha256 不符）时把失败件**留在 `_download/`** 并报 `corrupt`
//     （见本文件 ⑪ 的两条 corrupt 用例：断言失败件 `fs.existsSync(res.tmp) === true`）⇒ 反复失败会让
//     `_download/` **无上限增长**。
//   ★ 判据：**中转目录的写入者必须负责它的清理，或至少让它可见**。本模块选**后者**：`scanAll()` 结果里
//     如实给出 `downloadDir { dir, files, bytes }`，**绝不自动删除**（删文件不可逆 + 不擅动用户文件）。
//   ★ 这条用例钉住两件事：① 占用**真的被报出来**；② 扫描**不得删**任何中转文件。
test('★ RISK-11：scanAll 报出 _download/ 占用（files/bytes），且**绝不删**中转文件', async () => {
  const envResult = {
    groups: [{ title: 'stub', items: [{ id: 'win.ffmpeg', label: 'stub', status: 'ok', detail: 'stub' }] }],
    summary: { total: 1, ok: 1, warn: 0, fail: 0 },
    runnable: true, drift: [], checkedAt: new Date().toISOString(),
  };
  const dlDir = path.join(TMP, '_download');
  // ★ 先清空：前序 ⑪ 的 corrupt 用例会在 `_download/` 留下失败件（正是 RISK-11 的现象）⇒ 清掉以求确定性
  fs.rmSync(dlDir, { recursive: true, force: true });
  fs.mkdirSync(dlDir, { recursive: true });
  const f1 = path.join(dlDir, 'res-rv-risk11-a.bin');
  const f2 = path.join(dlDir, 'res-rv-risk11-b.bin');
  fs.writeFileSync(f1, Buffer.alloc(7, 1));
  fs.writeFileSync(f2, Buffer.alloc(5, 2));
  const res = await scanAll({ envResult, force: true });
  assert.ok(res.downloadDir && typeof res.downloadDir === 'object',
    `scanAll 结果应带 downloadDir 占用对象，实测 ${JSON.stringify(res.downloadDir)}`);
  assert.equal(res.downloadDir.dir, dlDir, `downloadDir.dir 应等于 <root>/_download，实测 ${res.downloadDir.dir}`);
  assert.equal(res.downloadDir.files, 2, `downloadDir.files 应报 2，实测 ${res.downloadDir.files}`);
  assert.equal(res.downloadDir.bytes, 12, `downloadDir.bytes 应报 12，实测 ${res.downloadDir.bytes}`);
  // ★ 扫描**不得删**：两个文件扫描后仍在（只报占用，不自动清）
  assert.ok(fs.existsSync(f1) && fs.existsSync(f2), '★ 扫描**不得**删除 _download/ 里的任何文件（只报占用）');
  fs.rmSync(f1, { force: true });
  fs.rmSync(f2, { force: true });
});

test('RESOURCES：注册表非空、id 唯一、schema 合法（契约 §五）', () => {
  const list = Array.isArray(RESOURCES) ? RESOURCES : Object.values(RESOURCES);
  assert.ok(Array.isArray(list) && list.length > 0, 'RESOURCES 应非空');
  const ids = list.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, `RESOURCES 的 id 应全局唯一，实测 ${ids.join(',')}`);
  for (const e of list) {
    assert.match(e.id, /^[a-z0-9][a-z0-9._-]*$/, `id ${JSON.stringify(e.id)} 应匹配白名单正则`);
    assert.ok(KINDS.includes(e.kind), `${e.id} 的 kind ${e.kind} 应在 KINDS 内`);
    assert.equal(typeof e.bundled, 'boolean', `${e.id} 的 bundled 应是布尔`);
    assert.equal(typeof e.required, 'boolean', `${e.id} 的 required 应是布尔`);
    assert.ok(typeof e.label === 'string' && e.label.trim() !== '', `${e.id} 的 label 应非空`);
    assert.ok(['env', 'custom'].includes(e.detect && e.detect.via), `${e.id} 的 detect.via 应是 env/custom`);
  }
});

// ── ⑨ mount 接线（堵「有导出 ≠ 有功能」的假绿）───────────────────────────────
//   ★ 静态：两个入口的**函数体**里必须真的出现 `await mount(`（不真下载、不起 WSL）。
//   ★ 行为：用 `opts.mount === false` 与失败路径验证**返回字段**与**不挂载**。

/** 取 `(export )?(async )?function <name>(` 起、到下一个顶层 `function` 前的**源码区间**（近似函数体）。 */
function fnRegion(src, name) {
  const m = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  if (!m) return null;
  const rest = src.slice(m.index);
  const next = /\n(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$]/.exec(rest.slice(1));
  return next ? rest.slice(0, next.index + 1) : rest;
}
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('runDownload / importResource 的函数体里真的 `await mount(`（静态；不下载、不起 WSL）', () => {
  const src = fs.readFileSync(new URL('../lib/resources.mjs', import.meta.url), 'utf8');
  for (const fn of ['runDownload', 'importResource']) {
    const region = fnRegion(src, fn);
    assert.ok(region, `应能切出 ${fn} 的源码区间`);
    assert.match(stripJsComments(region), /await\s+mount\s*\(/,
      `${fn} 的函数体里应有 \`await mount(\` 调用（★ 有导出 ≠ 有功能：光导出 mount 不算接线）`);
  }
});

test('importResource：成功返回带 mount / mounted（opts.mount=false ⇒ 跳过挂载、不真挂载）', async () => {
  const list = Array.isArray(RESOURCES) ? RESOURCES : Object.values(RESOURCES);
  const id = list[0].id;
  const src = path.join(TMP, 'cg-import-fixture.txt');   // ★ 只做文件复制，不下载 / 不起 WSL
  fs.writeFileSync(src, 'fixture');
  const res = await importResource(id, src, { mount: false });
  assert.equal(res.ok, true, `导入应成功（只做文件复制），实测 ${JSON.stringify(res)}`);
  assert.ok('mount' in res, `返回应含 mount 字段，实测键 ${Object.keys(res).join(',')}`);
  assert.ok('mounted' in res, `返回应含 mounted 字段，实测键 ${Object.keys(res).join(',')}`);
  assert.equal(res.mount, null, 'opts.mount=false ⇒ mount 应为 null（未挂载）');
  assert.equal(res.mounted, null, 'opts.mount=false ⇒ mounted 应为 null');
  assert.equal(res.mountSkipped, true, 'opts.mount=false ⇒ mountSkipped 应为 true');
});

test('runDownload：无下载配置 ⇒ ok:false 且不挂载（离线，不真下载）', async () => {
  const list = Array.isArray(RESOURCES) ? RESOURCES : Object.values(RESOURCES);
  const importOnly = list.find((e) => !e.download);   // import-only（download 为 null）资源
  assert.ok(importOnly, '注册表应至少有一条 import-only（download 为 null）资源');
  const res = await runDownload(importOnly.id);
  assert.equal(res.ok, false, `无下载配置应 ok:false，实测 ${JSON.stringify(res)}`);
  assert.notEqual(res.mounted, true, '下载未成功 ⇒ 不得挂载（mounted 不得为 true）');
});

// ── ⑩ ★ 端到端（**离线**）：导入成功 ⇒ **真的挂载** ──────────────────────────
//   ★ 为什么必须有这一条：⑨ 只做到「静态断言调用了 `mount`」+「opt-out / 失败路径」，
//     **没有任何一条测试证明「挂载这一步真的会跑、且跑对了」** —— 那正是「确认它存在 ≠ 证明它能工作」。
//   ★ 怎么做到**离线**：`mount(id, opts)` 现在把 `opts` 透传给 `scanOne(id, opts)` ⇒ 注入一份合成
//     `envResult` 即可决定该资源的状态，**完全不起 WSL**（这正是本批给 `mount` 加 opts 的主要理由：
//     既让成功路径可测，也让调用方能复用上游刚算好的那份 env 结果、免掉一次重复的全量探测）。
test('★ 端到端（离线）：资源就绪 ⇒ 导入后**真的挂载**；资源不可用 ⇒ 导入仍 ok 但 mounted=false', async () => {
  const list = Array.isArray(RESOURCES) ? RESOURCES : Object.values(RESOURCES);
  // 选一条 via:'env'、**无版本要求**、且**非端点挂载**的资源 ⇒ 状态完全由注入的 envResult 决定
  const e = list.find((x) => x.detect && x.detect.via === 'env'
    && !(x.version && x.version.want) && !(x.mount && x.mount.how === 'endpoint'));
  assert.ok(e, '注册表应至少有一条「via:env + 无版本要求 + 非端点挂载」的资源（用于离线演练挂载）');

  const envWith = (status) => ({
    groups: [{ title: 't', items: [{ id: e.detect.id, label: 'x', status, detail: '', fix: '' }] }],
    summary: { total: 1, ok: status === 'ok' ? 1 : 0, warn: 0, fail: status === 'ok' ? 0 : 1 },
    runnable: status === 'ok', drift: [], checkedAt: new Date().toISOString(),
  });

  // ① 就绪 ⇒ 导入成功后**必须真的挂载**（规格第 3 条「下载完自动完成配置并建立连接」的真跑通断言）
  const src1 = path.join(TMP, 'cg-e2e-ready.txt');
  fs.writeFileSync(src1, 'fixture');
  const r1 = await importResource(e.id, src1, { envResult: envWith('ok') });
  assert.equal(r1.ok, true, `导入本身应成功，实测 ${JSON.stringify(r1)}`);
  assert.equal(r1.mounted, true,
    `资源就绪 ⇒ **必须挂载成功**，实测 mount=${JSON.stringify(r1.mount)}（★ 只断言「函数体里有 mount(」是不够的）`);
  assert.equal(r1.mount.ok, true, 'mount.ok 应为 true');
  assert.ok(fs.existsSync(path.join(dirFor(e.kind, e.id), path.basename(src1))),
    `导入的文件应落在 dirFor(kind,id) 下：${dirFor(e.kind, e.id)}`);

  // ② 不可用 ⇒ 导入本身仍成功（ok:true），但**挂载失败**；★ 不得把 ok 改成 false（否则会误触发重新下载）
  const src2 = path.join(TMP, 'cg-e2e-bad.txt');
  fs.writeFileSync(src2, 'fixture');
  const r2 = await importResource(e.id, src2, { envResult: envWith('fail') });
  assert.equal(r2.ok, true, '导入本身成功 ⇒ ok 仍应是 true（★ 不得把「挂载失败」混成「导入失败」）');
  assert.equal(r2.mounted, false, `资源不可用 ⇒ 不应挂载成功，实测 ${JSON.stringify(r2.mount)}`);
  assert.match(String(r2.detail || ''), /挂载失败/, `detail 应说明「已导入但挂载失败」，实测 ${JSON.stringify(r2.detail)}`);
});

// ── ⑪ ★ 三条下载真路径（`_dlHttp` / `_dlExec` / 目录导入）—— **全部离线** ──────────────
//   ★ 为什么必须有这一批：`lib/resources.mjs` 的**三条下载真路径**此前**零覆盖** —— `_dlHttp`
//     （含 **sha256 校验** 与 **0 字节 ⇒ corrupt**）、`_dlGit`、`_dlExec` 在 test/ 下**搜不到函数名**；
//     现有用例只覆盖 `runDownload` 的「**无 download 规格**」分支。这正是「**有导出 ≠ 有功能**」的盲区：
//     `_dlHttp` 的「**先落 `_download/` → 校验 → 才移入 `dirFor()`**」是契约 §九.3 的硬承诺，必须钉死。
//   ★ 注册表条目是 `Object.freeze` 的、**不能运行时改** ⇒ 用「**整棵拷 `lib/` 到临时树 + 改副本源码 +
//     import 副本**」给某条资源装上 http / script 下载源（`test/gate-blindness.test.mjs` 有 `fs.cpSync`
//     整棵拷 `lib/` 的先例）。**绝不改真实模块**。
//   ★ 全部**不真下载外网、不起 WSL、不跑 apt**：http 源 = 本机 `node:http` 临时服务（只回已知字节）；
//     script 只用 `where:'win'` 的 `exit 0` / `exit 1`（`_dlExec` 的 `where:'wsl'` 会**真起 WSL** ⇒ 不碰）。
//   ★ 临时树建在 `TMP`（`D:/lemo-tmp/res-test-*`）之下、前缀 `rv-` ⇒ 随既有 `exit` 钩子递归删除。

const LIB_SRC = fileURLToPath(new URL('../lib', import.meta.url));

/** 整棵拷 `lib/` 到临时树 → 在副本 `resources.mjs` 的 `_entries` 末尾插入自定义条目 → 返回副本模块路径。 */
function copyLibWith(entriesSrc) {
  const root = path.join(TMP, `rv-tree-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(root, { recursive: true });
  fs.cpSync(LIB_SRC, path.join(root, 'lib'), { recursive: true });   // ★ 整棵拷（不动真实模块）
  const mod = path.join(root, 'lib', 'resources.mjs');
  const src = fs.readFileSync(mod, 'utf8');
  const anchor = '];\n\nexport const RESOURCES';                    // `_entries` 数组的收尾（唯一）
  assert.ok(src.includes(anchor), '副本变异锚点应存在（真实模块源码已变？）');
  fs.writeFileSync(mod, src.replace(anchor, `${entriesSrc}\n];\n\nexport const RESOURCES`), 'utf8');
  return mod;
}

/** 造一条 **http** 下载规格的临时资源条目（`sha256` 传 null 表示不校验）。 */
const httpEntrySrc = (id, url, sha256) => `  {
    id: ${JSON.stringify(id)}, kind: 'dep', label: 'rv http 夹具', bundled: false, required: false,
    dir: null, version: {}, detect: { via: 'custom', probe: async () => ({ found: false }) },
    download: { kind: 'http', url: ${JSON.stringify(url)}, sha256: ${sha256 ? JSON.stringify(sha256) : 'null'}, into: null },
    import: null, mount: { how: 'path', detail: 'rv 夹具' }, impact: '', fix: '',
  },`;

/** 造一条 **script** 下载规格的临时资源条目（**只用 `where:'win'`**，绝不碰 WSL）。 */
const scriptEntrySrc = (id, cmd) => `  {
    id: ${JSON.stringify(id)}, kind: 'dep', label: 'rv script 夹具', bundled: false, required: false,
    dir: null, version: {}, detect: { via: 'custom', probe: async () => ({ found: false }) },
    download: { kind: 'script', where: 'win', asRoot: false, into: null, sha256: null, estBytes: 0, cmd: ${JSON.stringify(cmd)} },
    import: null, mount: { how: 'path', detail: 'rv 夹具' }, impact: '', fix: '',
  },`;

/** 本机临时 http 服务：一律 200 + 给定字节。→ { url, close }。 */
function serveOnce(payload) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(payload);
    });
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      resolve({ url: `http://127.0.0.1:${port}/pkg.tar`, close: () => new Promise((r) => srv.close(r)) });
    });
  });
}

test('★ runDownload/_dlHttp：本机 http 成功 ⇒ 先落 _download/ → 校验 → 移入 dirFor()，字节一致', async () => {
  const bytes = Buffer.from(`rv-http-payload-${'x'.repeat(80)}`, 'utf8');
  const { url, close } = await serveOnce(bytes);
  const id = 'rv-http-ok';
  const mod = copyLibWith(httpEntrySrc(id, url, null));
  try {
    const { runDownload: rd, dirFor: df, resourceRoot: rr } = await import(pathToFileURL(mod).href);
    const logs = [];
    const res = await rd(id, (m) => logs.push(m), { mount: false });   // ★ 不挂载 ⇒ 不起 WSL
    assert.equal(res.ok, true, `本机 http 下载应成功，实测 ${JSON.stringify(res)}`);
    assert.equal(res.kind, 'http', '应走 http 分派');
    assert.equal(res.bytes, bytes.length, `落盘字节数应等于服务端字节数（实测 ${res.bytes} vs ${bytes.length}）`);
    // ① 先落 _download/：日志里记的 tmp 就在 _download/ 下（★「先落中转目录」的唯一可观测点）
    assert.ok(logs.some((l) => l.includes('_download')),
      `日志应显示先落 _download/ 中转目录，实测 ${JSON.stringify(logs)}`);
    // ② 校验通过后移入 dirFor()
    const destDir = df('dep', id);
    assert.equal(path.dirname(res.path), destDir, `移入位置应是 dirFor('dep','${id}')，实测 ${res.path}`);
    assert.ok(fs.existsSync(res.path), `文件应已移入 dirFor()：${res.path}`);
    assert.deepEqual(fs.readFileSync(res.path), bytes, '落盘字节应与服务端字节逐字节一致');
    // ③ _download/ 不残留（= 真的「移入」而不是「另存一份」）
    const dlDir = path.join(rr(), '_download');
    const leftover = fs.existsSync(dlDir) ? fs.readdirSync(dlDir).filter((n) => n.includes(id)) : [];
    assert.deepEqual(leftover, [], `校验通过后 _download/ 不应残留该资源的临时文件，实测 ${JSON.stringify(leftover)}`);
  } finally { await close(); }
});

test('★ runDownload/_dlHttp：0 字节坏来源 ⇒ ok:false、state:corrupt、留在 _download/、未移入', async () => {
  const { url, close } = await serveOnce(Buffer.alloc(0));
  const id = 'rv-http-empty';
  const mod = copyLibWith(httpEntrySrc(id, url, null));
  try {
    const { runDownload: rd, dirFor: df } = await import(pathToFileURL(mod).href);
    const res = await rd(id, () => {}, { mount: false });
    assert.equal(res.ok, false, `0 字节应失败，实测 ${JSON.stringify(res)}`);
    assert.equal(res.state, 'corrupt', `0 字节 ⇒ state 应为 'corrupt'，实测 ${res.state}`);
    assert.ok(String(res.tmp || '').includes('_download'), `失败文件应留在 _download/，实测 tmp=${res.tmp}`);
    assert.ok(fs.existsSync(res.tmp), '0 字节文件应仍留在 _download/（便于排查 / 重下）');
    assert.equal(fs.existsSync(df('dep', id)), false, '校验不通过**不得**污染规划目录 dirFor()');
  } finally { await close(); }
});

test('★ runDownload/_dlHttp：sha256 不符 ⇒ ok:false、state:corrupt、留在 _download/、未移入', async () => {
  const bytes = Buffer.from('rv-sha-payload', 'utf8');
  const { url, close } = await serveOnce(bytes);
  const id = 'rv-http-sha';
  const wrongSha = 'f'.repeat(64);   // 真实哈希不可能全 f ⇒ 必错
  const mod = copyLibWith(httpEntrySrc(id, url, wrongSha));
  try {
    const { runDownload: rd, dirFor: df } = await import(pathToFileURL(mod).href);
    const res = await rd(id, () => {}, { mount: false });
    assert.equal(res.ok, false, `sha256 不符应失败，实测 ${JSON.stringify(res)}`);
    assert.equal(res.state, 'corrupt', `sha256 不符 ⇒ state 应为 'corrupt'，实测 ${res.state}`);
    assert.match(String(res.detail || ''), /校验和/, `detail 应说明校验和不符，实测 ${JSON.stringify(res.detail)}`);
    assert.ok(String(res.tmp || '').includes('_download'), `失败文件应留在 _download/，实测 tmp=${res.tmp}`);
    assert.equal(fs.existsSync(df('dep', id)), false, '校验不通过**不得**污染规划目录 dirFor()');
  } finally { await close(); }
});

test('★ runDownload/_dlExec：本机 script 成功 ⇒ ok:true；exit 1 ⇒ ok:false 且不挂载', async () => {
  const idOk = 'rv-script-ok', idBad = 'rv-script-bad';
  const mod = copyLibWith(`${scriptEntrySrc(idOk, 'exit 0')}\n${scriptEntrySrc(idBad, 'exit 1')}`);
  const { runDownload: rd } = await import(pathToFileURL(mod).href);
  // ① where:'win' 的 script 跑通 ⇒ ok:true（★ 绝不碰 where:'wsl'，那会真起 WSL）
  const r1 = await rd(idOk, () => {}, { mount: false });
  assert.equal(r1.ok, true, `where:'win' 的 script 应成功，实测 ${JSON.stringify(r1)}`);
  assert.equal(r1.kind, 'script', '应走 script 分派');
  assert.equal(r1.code, 0, '退出码应为 0');
  // ② exit 1 ⇒ ok:false，且**不挂载**。★ 故意**不传** opts.mount:false —— 失败必须在 mount **之前**短路；
  //    若它竟去 mount，就会真起 WSL（用例会暴露，而不是悄悄变绿）。
  const r2 = await rd(idBad);
  assert.equal(r2.ok, false, `exit 1 应失败，实测 ${JSON.stringify(r2)}`);
  assert.notEqual(r2.mounted, true, '脚本失败 ⇒ 不得挂载');
  assert.equal('mount' in r2, false, `失败结果应是分派原样返回（不含 mount 字段），实测键 ${Object.keys(r2).join(',')}`);
});

test('★ importResource：目录 srcPath ⇒ 整目录（含子目录）递归复制到 dirFor()（离线，不起 WSL）', async () => {
  const list = Array.isArray(RESOURCES) ? RESOURCES : Object.values(RESOURCES);
  const e = list.find((x) => x.detect && x.detect.via === 'env');
  assert.ok(e, '注册表应至少有一条 via:env 资源（用于目录导入演练）');
  const srcDir = path.join(TMP, 'rv-import-src', 'bundle');
  fs.mkdirSync(path.join(srcDir, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'a.txt'), 'A');
  fs.writeFileSync(path.join(srcDir, 'sub', 'b.txt'), 'B');
  const res = await importResource(e.id, srcDir, { mount: false });   // ★ 不挂载 ⇒ 不起 WSL
  assert.equal(res.ok, true, `目录导入应成功，实测 ${JSON.stringify(res)}`);
  const dest = path.join(dirFor(e.kind, e.id), 'bundle');
  assert.equal(res.path, dest, `导入落点应是 dirFor(kind,id)/bundle，实测 ${res.path}`);
  assert.equal(fs.readFileSync(path.join(dest, 'a.txt'), 'utf8'), 'A', '顶层文件应被复制');
  assert.equal(fs.readFileSync(path.join(dest, 'sub', 'b.txt'), 'utf8'), 'B', '★ 子目录文件应一并复制（递归）');
});

// ── ⑫ ★ 5 个探针/解析函数的**间接**覆盖（零导出 ⇒ 只能靠它们服务的资源来打）──────────────
//   ★ 为什么必须有这一批：`probeEndpoint` / `probeIndexTts` / `probeStyleSkills` / `probeDir` /
//     `resolveProbe` 在 test/ 下**零引用**（它们**未导出**，只能间接通过 `scanAll` / `scanOne` 打到）。
//     覆盖点（模块级常量，**import 期求值** ⇒ 必须在 import 之前设好环境变量）：
//       · `model.index-tts`  看 `LEMO_INDEX_TTS_DIR`（探目录）
//       · `model.lmstudio`   看 `LEMO_LMSTUDIO_URL`（探 HTTP 端点）
//       · `plugin.style-skills` 看 `lib/style-skills/`（真实树，只读）
//   ★ 怎么拿到「不同环境变量下的独立模块实例」：给 import 的 file: URL 挂**唯一 query** 击穿 ESM 缓存
//     （`fileURLToPath` 会丢掉 query ⇒ 模块内部的 `import.meta.url` 仍解析到真实路径；已实测）。
//   ★ 全部**离线**：不真下载、不起 WSL（`scanOne`/`mount` 一律注入桩 `envResult`）、不碰真实 `D:\lemo-res`。
//   ★ **未覆盖（如实登记）**：`resolveProbe` 的 `d.via` 既非 env 也非 custom 的兜底分支（返回
//     `{found:false,_detail:'未配置探测方式'}`）—— 注册表里**没有任何**这样的条目，且 `_entries` 是冻结的、
//     又无法在不改真实模块的前提下注入（能注入的只有「新增条目」，改不了现有条目的 via）⇒ 不硬凑。

const RES_MOD_URL = new URL('../lib/resources.mjs', import.meta.url).href;
let _rv2seq = 0;
/** 取一个**全新求值**的 resources.mjs 实例（query 击穿缓存 ⇒ 重新读取当前环境变量）。 */
const freshRes = (tag) => import(`${RES_MOD_URL}?rv2=${tag}-${++_rv2seq}`);
/** 桩 envResult：形状对齐 lib/env.mjs 的 checkEnv()，`scanAll` 拿到它就不起 WSL。 */
const rv2EnvStub = () => ({
  groups: [], summary: { total: 0, ok: 0, warn: 0, fail: 0 },
  runnable: true, drift: [], checkedAt: new Date().toISOString(),
});
/** 本机临时 http 服务：按给定 handler 响应。→ { port, close }。 */
function rv2Listen(handler) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(handler);
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => resolve({
      port: srv.address().port,
      close: () => new Promise((r) => srv.close(r)),
    }));
  });
}
/** 一个**确定没人监听**的本机端口（先 bind 0 拿到号再立刻关掉）。 */
function rv2ClosedPort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
/** 设 / 还原一个环境变量（模块级常量在 import 期求值 ⇒ 用例结束必须还原，免得污染后续用例）。 */
function rv2WithEnv(name, value, fn) {
  const saved = process.env[name];
  if (value == null) delete process.env[name]; else process.env[name] = value;
  return Promise.resolve().then(fn).finally(() => {
    if (saved == null) delete process.env[name]; else process.env[name] = saved;
  });
}

test('★ 探针·model.index-tts（间接）：临时目录逼出 missing / corrupt / ready / path-abnormal 四态', async () => {
  const root = path.join(TMP, `rv2-idx-${process.pid}-${Date.now().toString(36)}`);
  fs.mkdirSync(root, { recursive: true });
  const stub = rv2EnvStub();
  try {
    // ① 目录**不存在** ⇒ missing（probeDir 的 catch 分支）
    const missDir = path.join(root, 'nope-v2.5');
    assert.equal(fs.existsSync(missDir), false, '前置：该目录确实不存在');
    let st = await rv2WithEnv('LEMO_INDEX_TTS_DIR', missDir, async () => {
      const m = await freshRes('idx-miss');
      return m.scanOne('model.index-tts', { envResult: stub });
    });
    assert.equal(st.state, 'missing', `目录不存在 ⇒ missing，实测 ${JSON.stringify(st)}`);

    // ② 目录存在但**为空** ⇒ corrupt
    //   ★ 以实现的真实判定为准：`probeIndexTts` 只把「目录为空（0 项）」判 corrupt，
    //     **并不**检查「缺哪些关键权重文件」（那属实现未做之事，不能按猜测断言）。
    const emptyDir = path.join(root, 'empty-v2.5');
    fs.mkdirSync(emptyDir, { recursive: true });
    st = await rv2WithEnv('LEMO_INDEX_TTS_DIR', emptyDir, async () => {
      const m = await freshRes('idx-empty');
      return m.scanOne('model.index-tts', { envResult: stub });
    });
    assert.equal(st.state, 'corrupt', `空目录 ⇒ corrupt，实测 ${JSON.stringify(st)}`);
    assert.match(String(st.detail || ''), /为空/, `detail 应说明目录为空，实测 ${JSON.stringify(st.detail)}`);

    // ③ 目录存在且**非空** ⇒ ready（版本从目录名 basename 抽：'full-v2.5' ⇒ 2.5，满足 >=2.0）
    const fullDir = path.join(root, 'full-v2.5');
    fs.mkdirSync(fullDir, { recursive: true });
    fs.writeFileSync(path.join(fullDir, 'config.yml'), 'x');
    st = await rv2WithEnv('LEMO_INDEX_TTS_DIR', fullDir, async () => {
      const m = await freshRes('idx-full');
      return m.scanOne('model.index-tts', { envResult: stub });
    });
    assert.equal(st.state, 'ready', `非空目录 ⇒ ready，实测 ${JSON.stringify(st)}`);
    assert.equal(st.version, '2.5', `版本应从目录名 basename 抽到 2.5，实测 ${JSON.stringify(st.version)}`);

    // ④ 该位置是**文件**（应目录却是文件）⇒ path-abnormal（probeDir 的 expectDir 分支）
    const asFile = path.join(root, 'afile-v2.5');
    fs.writeFileSync(asFile, 'x');
    st = await rv2WithEnv('LEMO_INDEX_TTS_DIR', asFile, async () => {
      const m = await freshRes('idx-file');
      return m.scanOne('model.index-tts', { envResult: stub });
    });
    assert.equal(st.state, 'path-abnormal', `应目录却是文件 ⇒ path-abnormal，实测 ${JSON.stringify(st)}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('★ 探针·model.lmstudio（间接）：本机桩端点逼出 ready / corrupt / missing 三态（离线，不真连 LM Studio）', async () => {
  const stub = rv2EnvStub();
  const ok = await rv2Listen((_q, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'm1' }, { id: 'm2' }] }));
  });
  const bad = await rv2Listen((_q, res) => { res.writeHead(500); res.end('boom'); });
  const dead = await rv2ClosedPort();
  try {
    // ① 200 + JSON ⇒ ready（probeEndpoint 成功分支，detail 带上模型数）
    let st = await rv2WithEnv('LEMO_LMSTUDIO_URL', `http://127.0.0.1:${ok.port}/v1/models`, async () => {
      const m = await freshRes('lm-ok');
      return m.scanOne('model.lmstudio', { envResult: stub });
    });
    assert.equal(st.state, 'ready', `200 ⇒ ready，实测 ${JSON.stringify(st)}`);
    assert.match(String(st.detail || ''), /2 个模型/, `detail 应带上模型数，实测 ${JSON.stringify(st.detail)}`);

    // ② 500 ⇒ corrupt（找到但不可用）
    st = await rv2WithEnv('LEMO_LMSTUDIO_URL', `http://127.0.0.1:${bad.port}/v1/models`, async () => {
      const m = await freshRes('lm-bad');
      return m.scanOne('model.lmstudio', { envResult: stub });
    });
    assert.equal(st.state, 'corrupt', `500 ⇒ corrupt，实测 ${JSON.stringify(st)}`);
    assert.match(String(st.detail || ''), /HTTP 500/, `detail 应说明 HTTP 500，实测 ${JSON.stringify(st.detail)}`);

    // ③ 端口**不监听** ⇒ fetch 拒绝 ⇒ missing（★ 实测确认：Node 的 fetch 不走 http_proxy，本机端口直连）
    st = await rv2WithEnv('LEMO_LMSTUDIO_URL', `http://127.0.0.1:${dead}/v1/models`, async () => {
      const m = await freshRes('lm-dead');
      return m.scanOne('model.lmstudio', { envResult: stub });
    });
    assert.equal(st.state, 'missing', `端点不可达 ⇒ missing，实测 ${JSON.stringify(st)}`);
  } finally {
    await ok.close();
    await bad.close();
  }
});

test('★ 探针·plugin.style-skills（间接）：真实 lib/style-skills 树 ⇒ ready（只读，不落盘）', async () => {
  const st = await scanOne('plugin.style-skills', { envResult: rv2EnvStub() });
  assert.ok(st, 'scanOne(plugin.style-skills) 应有结果');
  assert.equal(st.state, 'ready', `真实风格包树应 ready，实测 ${JSON.stringify(st)}`);
  assert.match(String(st.detail || ''), /个风格包/, `detail 应报告风格包数，实测 ${JSON.stringify(st.detail)}`);
  const n = Number((String(st.detail).match(/(\d+)\s*个风格包/) || [])[1]);
  assert.ok(n >= 1, `风格包数应 >= 1，实测 ${JSON.stringify(st.detail)}`);
});

/** 造一条 **endpoint 挂载** 的临时资源条目：自定义探针恒 ready（不做网络），mount.how='endpoint'。 */
const rv2EndpointEntrySrc = (id, url) => `  {
    id: ${JSON.stringify(id)}, kind: 'model', label: 'rv2 endpoint 夹具', bundled: false, required: false,
    dir: ${JSON.stringify(id)}, version: {}, detect: { via: 'custom', probe: async () => ({ found: true, executable: true, path: ${JSON.stringify(url)} }) },
    download: null, import: null, mount: { how: 'endpoint', detail: ${JSON.stringify(url)} }, impact: '', fix: '',
  },`;

/** 整棵拷 `lib/` 到 `rv2-` 临时树 → 在副本 `_entries` 末尾插入条目 → 返回副本模块路径。 */
function copyLibWithRv2(entriesSrc) {
  const root = path.join(TMP, `rv2-tree-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(root, { recursive: true });
  fs.cpSync(LIB_SRC, path.join(root, 'lib'), { recursive: true });   // ★ 整棵拷（不动真实模块）
  const mod = path.join(root, 'lib', 'resources.mjs');
  const src = fs.readFileSync(mod, 'utf8');
  const anchor = '];\n\nexport const RESOURCES';
  assert.ok(src.includes(anchor), '副本变异锚点应存在（真实模块源码已变？）');
  fs.writeFileSync(mod, src.replace(anchor, `${entriesSrc}\n];\n\nexport const RESOURCES`), 'utf8');
  return mod;
}

test('★ mount 的 endpoint 分支（lib/resources.mjs 的 mount() 里 endpoint 分支）：端点可达 ⇒ ok:true；端点不可达 ⇒ ok:false 且 detail 说明「端点不可达」', async () => {
  const live = await rv2Listen((_q, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: [] }));
  });
  const deadPort = await rv2ClosedPort();
  const idLive = 'rv2-ep-live', idDead = 'rv2-ep-dead';
  const liveUrl = `http://127.0.0.1:${live.port}/v1/models`;
  const deadUrl = `http://127.0.0.1:${deadPort}/v1/models`;
  const mod = copyLibWithRv2(`${rv2EndpointEntrySrc(idLive, liveUrl)}\n${rv2EndpointEntrySrc(idDead, deadUrl)}`);
  try {
    const { scanOne: so, mount: mt } = await import(pathToFileURL(mod).href);
    const stub = rv2EnvStub();
    // 前置：两条都 ready（自定义探针恒 ready、不做网络）—— 这样 mount 才会**越过** state 检查、
    //   真的走到「endpoint 复探」那一段（否则只会返回「当前状态 X，未挂载」）。
    assert.equal((await so(idLive, { envResult: stub })).state, 'ready', '前置：live 夹具应 ready');
    assert.equal((await so(idDead, { envResult: stub })).state, 'ready', '前置：dead 夹具应 ready（探针不做网络）');

    // ① 端点可达 ⇒ 挂载成功
    const r1 = await mt(idLive, { envResult: stub });
    assert.equal(r1.ok, true, `端点可达 ⇒ ok:true，实测 ${JSON.stringify(r1)}`);
    assert.equal(r1.how, 'endpoint', `how 应为 endpoint，实测 ${r1.how}`);

    // ② 端点不可达 ⇒ ok:false，且 detail 说明「端点不可达」（★ 而不是「当前状态 … 未挂载」）
    const r2 = await mt(idDead, { envResult: stub });
    assert.equal(r2.ok, false, `端点不可达 ⇒ ok:false，实测 ${JSON.stringify(r2)}`);
    assert.equal(r2.how, 'endpoint', `how 应为 endpoint，实测 ${r2.how}`);
    assert.match(String(r2.detail || ''), /端点不可达/, `detail 应说明「端点不可达」，实测 ${JSON.stringify(r2.detail)}`);
  } finally { await live.close(); }
});
