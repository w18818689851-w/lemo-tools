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
 *
 * 用法：node test/resources.test.mjs
 * 退出码：全绿 0，有失败 1。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ── ★ 先把资源根指到临时目录（**必须在 import 之前**：模块在求值期可能就解析了根）
const TMP = `D:/lemo-tmp/res-test-${process.pid}-${Date.now().toString(36)}`;   // ★ 非 C 盘
fs.mkdirSync(TMP, { recursive: true });
process.env.LEMO_RES_DIR = TMP;
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ } });

// ★ 动态 import：让上面的 LEMO_RES_DIR 先生效（静态 import 会被提升到文件顶部）。
const {
  KINDS, STATES, resourceRoot, dirFor, dirPlan, RESOURCES,
  classify, satisfies, planDownloads, scanAll, runDownload, importResource,
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
