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
 *   ⑧ RESOURCES 注册表 schema 自检。
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
  classify, satisfies, planDownloads, scanAll,
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
