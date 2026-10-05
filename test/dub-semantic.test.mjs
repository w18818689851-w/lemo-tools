#!/usr/bin/env node
/**
 * test/dub-semantic.test.mjs —— `lib/dub-semantic.mjs`（语义解析 + 风格匹配）的**纯逻辑**测试（零依赖）
 *
 * ★ 为什么必须有这一份（2026-10-04 补）：
 *   新增的两条输入流程（仅文案 / 文案+口播）里，「风格自动匹配」与「段落信息层级」全靠这个模块，
 *   但它此前**一条测试都没有**（`grep matchStyle test/*.mjs` 零命中）。
 *   而本轮刚给它加了第 5 个匹配维度 `visual`（口播画面气质）——**改核心打分逻辑却没有回归测试**，
 *   等于把「向后兼容」这件事交给运气。
 *
 * 覆盖：
 *   ① `matchStyle` 的四维打分（theme/emotion/scene/pace）与「无命中回退 default」；
 *   ② ★ **`visual` 维度的向后兼容**：不传 ⇒ 打分与改动前**逐字节一致**；传 ⇒ 真的参与打分；
 *      并用**构造的两个同分风格**证明它能在语义打平时决定胜负（不依赖真实风格表）；
 *   ③ `analyzeByRules` 的结构契约（theme/emotion/pace/scene/segments + 合法 role）；
 *   ④ `analyze()` 的**外部注入**（`analysis`）与它的硬判据 —— segments 拼回**必须等于原文**，
 *      否则拒收并记「疑似改字」（这是 `--analysis` / 控制台注入那条路的守门人）；
 *   ⑤ `userFixed`：白名单只给一个风格时 `stylePickedBy='user'`。
 *
 * 用法：node test/dub-semantic.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';

import { matchStyle, analyzeByRules, analyze, ROLES } from '../lib/dub-semantic.mjs';

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

/** 构造一个风格条目（只填 matchStyle 会读的字段）。 */
const mk = (id, tags, palette = {}) => ({ id, tags, palette });

// ── ① matchStyle 的四维打分 ──────────────────────────────────
test('matchStyle：命中的维度越多分越高；同分时注册表靠前的胜出', () => {
  const styles = [
    mk('a', { theme: ['AI'], emotion: ['温暖'], scene: ['评测'], pace: ['中'] }),
    mk('b', { theme: ['AI'], emotion: ['冷峻'], scene: ['风景'], pace: ['慢'] }),
    mk('c', { theme: ['美食'], emotion: ['温暖'], scene: ['厨房'], pace: ['慢'] }),
  ];
  const r = matchStyle({ theme: ['AI'], emotion: '温暖', pace: '中', scene: '评测' }, styles);
  assert.equal(r.matched, true);
  assert.equal(r.styleId, 'a', '四维全中应当选');
  assert.ok(r.scores.a > r.scores.b, 'a 比只中主题的 b 高');
  assert.ok(r.scores.a > r.scores.c, 'a 比只中情绪/节奏的 c 高');

  // 同分 → 严格大于才替换 ⇒ 靠前的胜出
  const tie = matchStyle({ theme: ['AI'] }, [mk('x', { theme: ['AI'] }), mk('y', { theme: ['AI'] })]);
  assert.equal(tie.styleId, 'x', '同分应取注册表靠前的');
});

test('matchStyle：一个维度都没命中 ⇒ matched=false（交由调用方回退 default）', () => {
  const r = matchStyle({ theme: ['量子'], emotion: '暴怒', pace: '极快', scene: '深海' },
    [mk('a', { theme: ['AI'], emotion: ['温暖'], scene: ['评测'], pace: ['中'] })]);
  assert.equal(r.matched, false, '无命中应 matched=false');
  assert.equal(r.scores.a, 0);
});

// ── ② ★ visual 维度：向后兼容 + 真的参与打分 ──────────────────
test('★ visual 缺省 ⇒ 打分与「完全不传该维度」逐字节一致（向后兼容）', () => {
  const styles = [
    mk('a', { theme: ['AI'], emotion: ['温暖'], scene: ['评测'], pace: ['中'] }, { subtitle: '#FFFFFF' }),
    mk('b', { theme: ['AI'], emotion: ['温暖'], scene: ['评测'], pace: ['中'] }, { subtitle: '#000000' }),
  ];
  const q = { theme: ['AI'], emotion: '温暖', pace: '中', scene: '评测' };
  const withoutKey = matchStyle(q, styles);
  const withUndef = matchStyle({ ...q, visual: undefined }, styles);
  const withNull = matchStyle({ ...q, visual: null }, styles);
  const withBad = matchStyle({ ...q, visual: { luma: NaN } }, styles);
  assert.deepEqual(withUndef.scores, withoutKey.scores, 'visual:undefined 应与不传完全一致');
  assert.deepEqual(withNull.scores, withoutKey.scores, 'visual:null 应与不传完全一致');
  assert.deepEqual(withBad.scores, withoutKey.scores, 'visual 非法（luma 非数）应与不传完全一致');
});

test('★ visual 参与打分：语义打平时，由「字幕在暗画面上读不读得清」决定胜负', () => {
  // 两个风格**语义完全相同**（tags 一样）⇒ 只看 visual
  const white = mk('white-sub', { theme: ['AI'] }, { subtitle: '#FFFFFF' });   // 白字：暗画面可读
  const black = mk('black-sub', { theme: ['AI'] }, { subtitle: '#000000' });   // 黑字：暗画面读不清
  const q = { theme: ['AI'] };
  // 不带 visual：同分 ⇒ 靠前的胜出
  assert.equal(matchStyle(q, [white, black]).styleId, 'white-sub');
  assert.equal(matchStyle(q, [black, white]).styleId, 'black-sub', '同分时顺序决定，证明此时 visual 未参与');

  // 带 visual（暗画面 luma=20）⇒ 白字风格该赢，**无论顺序**
  const dark = { luma: 20 };
  assert.equal(matchStyle({ ...q, visual: dark }, [white, black]).styleId, 'white-sub');
  assert.equal(matchStyle({ ...q, visual: dark }, [black, white]).styleId, 'white-sub',
    '暗画面下白字风格应当选（即使它在注册表后面）—— 这是 visual 维度真的在打分的证据');

  // 亮画面则反过来
  const bright = { luma: 235 };
  assert.equal(matchStyle({ ...q, visual: bright }, [white, black]).styleId, 'black-sub',
    '亮画面下黑字风格应当选');
});

test('★ visual：底衬色优先于字幕色（有底衬时按底衬算可读性）', () => {
  // 字幕色都是黑，但一个有不透明底衬（白），一个没有
  const withPlate = mk('plate', { theme: ['AI'] }, { subtitle: '#000000', subtitleBack: '#FFFFFF' });
  const noPlate = mk('no-plate', { theme: ['AI'] }, { subtitle: '#000000' });
  const r = matchStyle({ theme: ['AI'], visual: { luma: 20 } }, [withPlate, noPlate]);
  assert.equal(r.styleId, 'plate', '暗画面下，有白底衬的风格应当选（底衬才是压在画面上的那层）');
});

// ── ③ analyzeByRules 的结构契约 ───────────────────────────────
test('analyzeByRules：结构契约（字段齐全、role 合法、segments 拼回等于原文）', () => {
  // ★ 每一行都写够长（≥12 字）——规则路会把**短行合并进上一段**（`< 8` 字就并），
  //   行太短会全被并成一段、看不到逐行的角色判定。这是**规则路的已知粗粒度**（见下一条测试），
  //   不是缺陷：权威的段落/角色划分本来就该由智能体用 `--analysis` 给出。
  const text = '今天聊聊 AI 写作这件事。\n首先，它能帮你省下大量时间。\n比如写一份周报只要两分钟。\n总之，这类工具值得一试。\n点个赞关注我，别错过。\n';
  const r = analyzeByRules({ text });
  for (const k of ['theme', 'emotion', 'pace', 'scene', 'segments', 'styleId', 'scores']) {
    assert.ok(k in r, `缺字段 ${k}`);
  }
  assert.ok(Array.isArray(r.segments) && r.segments.length > 0, 'segments 不能为空');
  for (const s of r.segments) {
    assert.ok(ROLES.includes(s.role), `role 非法：${s.role}`);
    assert.ok(typeof s.text === 'string' && s.text.trim(), 'segment.text 不能为空');
  }
  const strip = (s) => String(s).replace(/\s+/g, '');
  assert.equal(strip(r.segments.map((s) => s.text).join('')), strip(text),
    'segments 拼回必须等于原文（这是外部注入的同一硬判据）');
  // 规则路应当认得出「首先 → 论点」「比如 → 例证」「点个赞 → 行动号召」
  const roles = r.segments.map((s) => s.role);
  assert.ok(roles.includes('论点'), `「首先」应被认成论点，实际角色=${JSON.stringify(roles)}`);
  assert.ok(roles.includes('例证'), `「比如」应被认成例证，实际角色=${JSON.stringify(roles)}`);
  assert.ok(roles.includes('行动号召'), `「点个赞」应被认成行动号召，实际角色=${JSON.stringify(roles)}`);
});

test('analyzeByRules：★ 规则路的**已知粗粒度** —— 短行会被并进上一段（这是设计，不是缺陷）', () => {
  // 记录这条行为，免得后人以为「切段错了」：
  //   `splitSentences` 之后的合并逻辑是「上一段 < 8 字 或 本段 < 8 字 就并」，
  //   所以短句密集的口播稿会被并成很少的几段；且角色取**第一处命中**的规则。
  //   ⇒ 精细的段落/信息层级**必须靠智能体的 `--analysis`**（规则路只是兜底，且代码注释如此声明）。
  const short = '甲句。\n乙句。\n丙句。\n';
  const r = analyzeByRules({ text: short });
  assert.ok(r.segments.length < 3, `短行应当被合并（实际切出 ${r.segments.length} 段）`);
  assert.equal(String(r.segments.map((s) => s.text).join('')).replace(/\s+/g, ''),
    short.replace(/\s+/g, ''), '合并后仍必须等于原文');
});

// ── ④ analyze()：外部注入 + 硬判据 ────────────────────────────
test('★ analyze：外部注入被采纳（source=external），且 segments 可决定 role', async () => {
  const text = '第一句。\n第二句。\n';
  const r = await analyze({
    text,
    analysis: {
      theme: ['AI'], emotion: '温暖', pace: '中', scene: '评测',
      segments: [{ text: '第一句。', role: '开场' }, { text: '第二句。', role: '结论' }],
    },
  });
  assert.equal(r.source, 'external');
  assert.deepEqual(r.segments.map((s) => s.role), ['开场', '结论']);
});

test('★ analyze：segments 拼回**不等于原文** ⇒ 拒收该字段并说明原因（「疑似改字」）', async () => {
  const r = await analyze({
    text: '原文是这样。\n',
    analysis: { segments: [{ text: '原文被改过了。', role: '开场' }] },
  });
  // ★ 原因走 `error` 字段（`normalizeExternal` 把 notes 拼进了 error）——
  //   不是静默失败：调用方能看出「为什么这份外部结果没被采纳」。
  assert.match(String(r.error || ''), /疑似改字/,
    `应在 error 里说明「疑似改字」，实际 error=${JSON.stringify(r.error)}`);
  assert.notDeepEqual(r.segments.map((s) => s.text), ['原文被改过了。'], '被拒的 segments 不该上屏');
});

test('★ analyze：非法 role 被归一成「其他」（不静默放行任意字符串）', async () => {
  const r = await analyze({
    text: '甲。\n',
    analysis: { segments: [{ text: '甲。', role: '这是瞎写的角色' }] },
  });
  assert.deepEqual(r.segments.map((s) => s.role), ['其他']);
});

// ── ⑤ userFixed ──────────────────────────────────────────────
test('analyze：白名单只给一个风格 ⇒ stylePickedBy=user（不参与打分挑选）', async () => {
  const r = await analyze({ text: '随便一段文案。\n', styleIds: ['plain-dark'] });
  assert.equal(r.stylePickedBy, 'user');
  assert.equal(r.styleId, 'plain-dark');
});

// ── 运行器 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/dub-semantic.test.mjs —— 语义解析 / 风格匹配 纯逻辑测试'));
  log('');
  const results = [];
  for (const c of cases) {
    try {
      await c.fn();
      results.push({ name: c.name, ok: true });
      log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - t0}ms)`)}`);
    } catch (e) {
      results.push({ name: c.name, ok: false });
      log(`  ${C.bad('FAIL')}  ${c.name}`);
      for (const line of String((e && e.message) || e).split('\n')) log(`        ${line}`);
    }
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
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

main().catch((e) => {
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
