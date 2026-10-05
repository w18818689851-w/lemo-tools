#!/usr/bin/env node
/**
 * test/consistency.test.mjs —— 「字幕 ↔ 语义 ↔ 画面」一致性校验门的**纯逻辑**测试（零依赖）
 *
 * 用法：node test/consistency.test.mjs
 *
 * ★ 为什么单独一个入口：
 *   这一层测的是 lib/consistency.mjs 的判定逻辑（不起浏览器、不碰库、不碰 WSL），
 *   与 smoke.mjs / setup.test.mjs / ui.test.mjs 各自一个数字，互不干扰。
 *   真正「加载页面取 PROBE」那一段由 consistency-check.mjs 负责，属于集成层，
 *   这里**故意不覆盖** —— 那部分只能在真片上验（见 D:\lemo-tools\creative\coffee\02-影片方案.md §6）。
 *
 * ★ 为什么这些用例必须存在：
 *   这条闸门是用户硬规则的落地：「全程保证字幕、语义、画面完全匹配统一」。
 *   如果判定逻辑本身写错（例如把「某一采样点不成立」判成通过），闸门就成了摆设，
 *   而它的失败**只在真实出片时才看得到**。所以把判定拆成纯函数，在这里逐条钉死。
 *
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';

import {
  ANCHOR_KINDS, checkAnchor, verdict, voiceWindowCheck, renderReport,
} from '../lib/consistency.mjs';

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
  b: (s) => (TTY ? `\x1b[1m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

/** 一个可控的假 PROBE：t → 状态。用来精确构造「某采样点失败」这类边界。 */
const fakeProbe = map => (t => {
  for (const [k, v] of Object.entries(map)) if (Math.abs(t - Number(k)) < 1e-9) return v;
  return null;
});

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

// ── ANCHOR_KINDS 契约自洽 ────────────────────────────────────
test('ANCHOR_KINDS：每种锚点都映射到 PROBE 的一个字段，且都有中文标签', () => {
  const kinds = Object.keys(ANCHOR_KINDS);
  assert.deepEqual(kinds.sort(), ['element', 'label', 'region', 'roundel', 'station', 'text']);
  for (const k of kinds) {
    assert.ok(typeof ANCHOR_KINDS[k].probe === 'string' && ANCHOR_KINDS[k].probe, `${k} 缺 probe 字段`);
    assert.ok(typeof ANCHOR_KINDS[k].label === 'string' && ANCHOR_KINDS[k].label, `${k} 缺 label`);
  }
});

// ── checkAnchor ─────────────────────────────────────────────
test('checkAnchor：命中 / 未命中 / 大小写与空白不敏感', () => {
  const p = { texts: ['MOCHA', ' COFFEA ARABICA '], stations: ['mocha'], roundels: [0, 2] };
  assert.equal(checkAnchor({ kind: 'text', value: 'mocha' }, p).ok, true, '应大小写不敏感命中');
  assert.equal(checkAnchor({ kind: 'text', value: '  Coffea arabica  ' }, p).ok, true, '应去空白后命中');
  assert.equal(checkAnchor({ kind: 'text', value: 'CONSTANTINOPLE' }, p).ok, false, '不在表里应未命中');
  assert.equal(checkAnchor({ kind: 'station', value: 'MOCHA' }, p).ok, true);
  assert.equal(checkAnchor({ kind: 'roundel', value: 2 }, p).ok, true);
  assert.equal(checkAnchor({ kind: 'roundel', value: 1 }, p).ok, false);
});

test('checkAnchor：region / element 同时接受字符串数组与 {name} 对象数组', () => {
  const p = {
    regions: ['sea', { name: 'cherry' }, { name: 'leaf' }],
    elements: [{ name: 'plant' }, 'chart'],
  };
  assert.equal(checkAnchor({ kind: 'region', value: 'cherry' }, p).ok, true, '对象形式的色区应认');
  assert.equal(checkAnchor({ kind: 'region', value: 'sea' }, p).ok, true, '字符串形式的色区应认');
  assert.equal(checkAnchor({ kind: 'region', value: 'land' }, p).ok, false);
  assert.equal(checkAnchor({ kind: 'element', value: 'plant' }, p).ok, true);
  assert.equal(checkAnchor({ kind: 'element', value: 'route' }, p).ok, false);
});

test('checkAnchor：未知 kind 判失败（不静默放过）', () => {
  const r = checkAnchor({ kind: 'not-a-kind', value: 'x' }, { texts: ['x'] });
  assert.equal(r.ok, false);
  assert.match(r.detail, /未知锚点种类/);
});

test('checkAnchor：PROBE 未实现（null / 非对象）判失败，而不是通过', () => {
  for (const p of [null, undefined, 0, 'x']) {
    const r = checkAnchor({ kind: 'text', value: 'x' }, p);
    assert.equal(r.ok, false, `probe=${String(p)} 应判失败`);
    assert.match(r.detail, /未实现契约/);
  }
});

test('checkAnchor：probe 里缺该字段时按空表处理（未命中，不抛）', () => {
  const r = checkAnchor({ kind: 'station', value: 'mocha' }, { texts: ['MOCHA'] });
  assert.equal(r.ok, false);
  assert.match(r.detail, /空/);
});

// ── verdict ─────────────────────────────────────────────────
const LINE = (id, t0, t1, anchors, text = 'x') => ({ id, t0, t1, text, anchors });

test('verdict：三个采样点全成立 → 通过', () => {
  const lines = [LINE('a', 0, 10, [{ kind: 'text', value: 'MOCHA' }])];
  const at = fakeProbe({ 2.5: { texts: ['MOCHA'] }, 5: { texts: ['MOCHA'] }, 7.5: { texts: ['MOCHA'] } });
  const r = verdict(lines, at, { samples: 3 });
  assert.equal(r.ok, true);
  assert.equal(r.total, 1);
  assert.equal(r.pass, 1);
  assert.deepEqual(r.rows[0].samples, [2.5, 5, 7.5]);
});

test('★ verdict：只在最后一个采样点失败 → 判该条失败（专抓「字幕还在、画面已切走」）', () => {
  const lines = [LINE('a', 0, 10, [{ kind: 'text', value: 'MOCHA' }])];
  const at = fakeProbe({ 2.5: { texts: ['MOCHA'] }, 5: { texts: ['MOCHA'] }, 7.5: { texts: [] } });
  const r = verdict(lines, at, { samples: 3 });
  assert.equal(r.ok, false, '任一采样点失败即必须判失败');
  assert.equal(r.rows[0].ok, false);
  assert.equal(r.rows[0].bad.length, 1);
  assert.equal(r.rows[0].bad[0].t, 7.5);
});

test('verdict：多锚点里任一未成立即失败，且 bad 里能看到是哪一条', () => {
  const lines = [LINE('a', 0, 10, [
    { kind: 'roundel', value: 1 }, { kind: 'label', value: 'drupa' },
  ])];
  const at = () => ({ roundels: [1], labels: [] });
  const r = verdict(lines, at, { samples: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.rows[0].bad.length, 1);
  assert.equal(r.rows[0].bad[0].kind, 'label');
});

test('verdict：没有声明锚点 → 失败（「无法证明图文相符」不等于通过）', () => {
  const r = verdict([LINE('a', 0, 10, [])], () => ({ texts: ['x'] }));
  assert.equal(r.ok, false);
  assert.match(r.rows[0].error, /没有声明任何语义锚点/);
});

test('verdict：没有字幕条目 → 0/0 且判不通过（不做空集真值）', () => {
  const r = verdict([], () => null);
  assert.equal(r.total, 0);
  assert.equal(r.ok, false, '空集不能算通过');
});

test('verdict：非法时间窗 / 空文本 / 缺 id 都单独报错，不互相污染', () => {
  const lines = [
    LINE('ok1', 0, 2, [{ kind: 'text', value: 'A' }]),
    { id: 'badwin', t0: 5, t1: 5, text: 'x', anchors: [{ kind: 'text', value: 'A' }] },
    LINE('badtext', 0, 2, [{ kind: 'text', value: 'A' }], '   '),
    { t0: 0, t1: 2, text: 'x', anchors: [{ kind: 'text', value: 'A' }] },
  ];
  const r = verdict(lines, () => ({ texts: ['A'] }), { samples: 1 });
  assert.equal(r.total, 4);
  assert.equal(r.pass, 1);
  const errs = r.rows.map(x => x.error).filter(Boolean).join(' | ');
  assert.match(errs, /时间窗非法/);
  assert.match(errs, /字幕文本为空/);
  assert.match(errs, /缺 id/);
});

test('verdict：samples 参数真的改变采样点数', () => {
  const lines = [LINE('a', 0, 100, [{ kind: 'text', value: 'A' }])];
  const r1 = verdict(lines, () => ({ texts: ['A'] }), { samples: 1 });
  const r5 = verdict(lines, () => ({ texts: ['A'] }), { samples: 5 });
  assert.equal(r1.rows[0].samples.length, 1);
  assert.equal(r5.rows[0].samples.length, 5);
  assert.deepEqual(r5.rows[0].samples, [16.67, 33.33, 50, 66.67, 83.33]);
});

// ── voiceWindowCheck ────────────────────────────────────────
test('voiceWindowCheck：容差内通过 / 超出容差失败 / 缺时长失败', () => {
  const lines = [LINE('a', 0, 3.0, []), LINE('b', 10, 14.0, []), LINE('c', 20, 22, [])];
  const dur = { a: 3.2, b: 14.9 };            // a 差 0.2（在 ±0.35 内）；b 差 0.9（超）；c 缺
  const r = voiceWindowCheck(lines, dur, { tolerance: 0.35 });
  assert.equal(r.ok, false);
  assert.equal(r.rows[0].ok, true);
  assert.equal(r.rows[1].ok, false);
  assert.equal(r.rows[2].ok, false);
  assert.match(r.rows[2].detail, /没有该行的配音时长/);
  assert.equal(r.tolerance, 0.35);
});

test('voiceWindowCheck：全相符时 ok=true（边界值恰好等于容差也算过）', () => {
  const lines = [LINE('a', 0, 3.0, [])];
  assert.equal(voiceWindowCheck(lines, { a: 3.35 }, { tolerance: 0.35 }).ok, true);
  assert.equal(voiceWindowCheck(lines, { a: 3.36 }, { tolerance: 0.35 }).ok, false);
});

// ── renderReport ────────────────────────────────────────────
test('renderReport：结论、逐条表、配音表、抽帧、备注都出现在报告里', () => {
  const lines = [LINE('title', 6.4, 9.0, [{ kind: 'text', value: 'MOCHA' }], 'Plate one.')];
  const rep = {
    demo: 'styles/engraving/demo', q: 'film=film_coffee', film: 'coffee',
    generatedAt: '2026-10-02T00:00:00.000Z',
    verdict: verdict(lines, () => ({ texts: [] }), { samples: 1 }),
    voice: voiceWindowCheck(lines, { title: 2.6 }, { tolerance: 0.35 }),
    frames: [{ id: 'title', t: 7.7, file: 'D:/x/title@7.7s.png' }],
    notes: ['示例备注'],
  };
  const md = renderReport(rep);
  assert.match(md, /一致性校验报告（字幕 ↔ 语义 ↔ 画面）/);
  assert.match(md, /\*\*不通过\*\*/);
  assert.match(md, /`title`/);
  assert.match(md, /Plate one\./);
  assert.match(md, /字幕窗 ↔ 配音时长/);
  assert.match(md, /title@7\.7s\.png/);
  assert.match(md, /示例备注/);
});

test('renderReport：通过时报告写「通过」，且没有备注段时不生成空段', () => {
  const lines = [LINE('a', 0, 2, [{ kind: 'text', value: 'A' }])];
  const md = renderReport({
    demo: 'd', q: '', generatedAt: 'x',
    verdict: verdict(lines, () => ({ texts: ['A'] }), { samples: 1 }),
  });
  assert.match(md, /\*\*通过\*\*/);
  assert.doesNotMatch(md, /## 备注/);
});

// ── 跑 ──────────────────────────────────────────────────────
async function main() {
  log(C.b(`\nlib/consistency.mjs —— 一致性校验门纯逻辑测试（${cases.length} 条）\n`));
  const t0 = Date.now();
  const results = [];
  for (const c of cases) {
    const s = Date.now();
    try {
      await c.fn();
      results.push({ name: c.name, ok: true });
      log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
    } catch (e) {
      results.push({ name: c.name, ok: false, err: e });
      log(`  ${C.bad('FAIL')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
      for (const line of String((e && e.message) || e).split('\n')) log(`        ${line}`);
    }
  }
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  log('');
  log('─'.repeat(64));
  if (failed.length) {
    log(C.bad(`  ${passed} passed, ${failed.length} failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
    for (const f of failed) log(C.bad(`  ✗ ${f.name}`));
  } else {
    log(C.ok(`  ${passed} passed, 0 failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
  }
  log('─'.repeat(64));
  log('');
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(e => {
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
