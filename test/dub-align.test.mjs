#!/usr/bin/env node
/**
 * test/dub-align.test.mjs —— 功能2（--keep-original）字幕时间轴对齐的**纯逻辑**测试（零依赖）
 *
 * ★ 为什么必须有这一份（2026-10-04 补）：
 *   `lib/dub-core.mjs` 的 `alignCuesToSentences(cues, sentences)` 决定了「文案 8 句」如何
 *   落到「口播素材自带 SRT 的 29 条 cue」上。它此前**一条测试都没有**，而它刚被发现有一个
 *   交付物级缺陷：**旧实现为每句只认一条最匹配的 cue，再只取那一条 cue 的窗口** ⇒
 *      · 一句 40 字横跨 3–4 条 cue，窗口却只覆盖其中一条 ⇒ 窗口太短（实测 34 字给 1.63s）；
 *      · 认不出的句子用「上一锚点末 ~ 下一锚点起」插值 ⇒ 句间出现几秒空档。
 *   这属于「输出照出、只是字幕与口播不同步」的静默缺陷，只能机械拦。
 *
 * 覆盖（全部合成 cue/句子，零文件 IO）：
 *   ① 正常：8 句 vs 29 cue ⇒ 区间**首尾相接、无空档、无重叠**，且每条窗口 ≥ 最短可读时长；
 *   ② ★ 最短可读时长：一句 34 字只分到 1.6s 的输入 ⇒ 修后**不得**再短于按字数算出的下界；
 *   ③ 无空档：相邻两条字幕 `end` 与下一条 `start` 差 ≤ 0.2s；
 *   ④ 认不出的句子：中间某句与任何 cue 都不匹配 ⇒ 仍有**合理区间**（不空档、不 0 长度）；
 *   ⑤ 边界：`cues` 为空 / 句子为空 ⇒ 返回安全空结果、**绝不抛**；
 *   ⑥ `hitRate` 语义 = 「认出锚点的句子数 / 句子总数」。
 *
 * 用法：node test/dub-align.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';

import { alignCuesToSentences, minReadableDur, SUB_MAX_CPS, SUB_MIN_DUR } from '../lib/dub-core.mjs';

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

// ── 合成工具 ────────────────────────────────────────────────
/** 把一段文本均分成 n 块（按字数，不丢字）。 */
function chunk(text, n) {
  const s = String(text).replace(/\s/g, '');
  const out = [];
  const size = Math.ceil(s.length / n);
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  while (out.length < n) out.push(out[out.length - 1].slice(-1));   // 极短句兜底
  return out.slice(0, n);
}

/**
 * 合成 29 条 cue：8 句按 [1,5,5,2,3,3,4,6] 条切开（合计 29），
 * 每条时长 ∝ 字数，条与条之间夹 `gap` 秒静默（模拟真实 SRT）。
 */
function synthCues(sentences, total = 42, gap = 0.12) {
  const pieces = [1, 5, 5, 2, 3, 3, 4, 6];
  const parts = [];
  sentences.forEach((s, i) => { for (const t of chunk(s, pieces[i])) parts.push(t); });
  const chars = parts.map((t) => t.length);
  const speech = total - gap * (parts.length - 1);
  const sum = chars.reduce((a, b) => a + b, 0);
  const cues = [];
  let t = 0;
  for (let i = 0; i < parts.length; i++) {
    const d = (chars[i] / sum) * speech;
    cues.push({ start: t, end: t + d, text: parts[i] });
    t += d + gap;
  }
  return cues;
}

const SENTENCES = [
  '今天分享的是 AI 某条玩法测评',
  '不是所有平台都靠粉丝吃饭有人发一篇文章次日就收米上百这不是玄学是 AI 带来的内容红利',
  '只用一部手机把网络上已有内容用 AI 技术复制转化成独一无二的新文案发布在字母 T 平台',
  '只要有阅读就能看见收米到账',
  '全程零拍摄零剪辑零经验新号直接上满一米就可提',
  '每周循环出米测试账号最快第二天到账三位数全靠 AI 一键复制',
  '现在卷的不是谁能写是谁能更快发别再围着绿泡泡打转了这才是真正的冷门风口',
  '全程仅需十分钟适合所有想突破天花板的人更多资料已整理好主页低调获取别让认知落后行动点个赞关注我别错过风口',
];

/** 断言一组 spans 首尾相接、无重叠、无空档。 */
function assertContiguous(spans, maxGap = 0.2) {
  for (let i = 0; i < spans.length; i++) {
    const [s, e] = spans[i];
    assert.ok(e > s, `第 ${i + 1} 条窗口应非 0 长度：${s}→${e}`);
    if (i > 0) {
      const gap = s - spans[i - 1][1];
      assert.ok(gap >= -1e-9, `第 ${i + 1} 条与上一条重叠 ${(-gap).toFixed(3)}s`);
      assert.ok(gap <= maxGap, `第 ${i + 1} 条与上一条之间有 ${gap.toFixed(3)}s 空档（> ${maxGap}s）`);
    }
  }
}

// ── ① 正常：8 句 vs 29 cue ──────────────────────────────────
test('正常：8 句 vs 29 cue ⇒ 区间首尾相接、无空档、无重叠，且每条 ≥ 最短可读时长', () => {
  const cues = synthCues(SENTENCES);
  assert.equal(cues.length, 29, '合成 cue 数应为 29');
  const { spans, hitRate } = alignCuesToSentences(cues, SENTENCES);
  assert.equal(spans.length, SENTENCES.length, 'spans 数应等于句数');
  assertContiguous(spans);
  assert.equal(hitRate, 1, '29 条 cue 完整覆盖 8 句 ⇒ 应全部认出');
  SENTENCES.forEach((s, i) => {
    const d = spans[i][1] - spans[i][0];
    assert.ok(d >= minReadableDur(s) - 1e-9,
      `第 ${i + 1} 条 ${d.toFixed(3)}s 短于可读下界 ${minReadableDur(s).toFixed(3)}s`);
  });
});

// ── ② ★ 最短可读时长：34 字只分到 1.6s ──────────────────────
test('★ 最短可读时长：一句 34 字只匹配到 1.6s 的 cue ⇒ 修后不得短于按字数的下界', () => {
  const LONG = '这是一句专门用来验证最短可读时长是否生效的比较长的中文文案句子';
  assert.ok(LONG.length >= 30, '样例句应够长');
  const cues = [
    { start: 0.0, end: 1.6, text: LONG },              // 只匹配到这一条（1.6s）
    { start: 1.6, end: 5.0, text: '占位填充词甲乙丙丁' },   // 中间句「认不出」，可被借走
    { start: 5.0, end: 8.0, text: '第三句文本内容' },
  ];
  const sentences = [LONG, '嗯嗯', '第三句文本内容'];
  const { spans } = alignCuesToSentences(cues, sentences);
  const need = minReadableDur(LONG);
  const got = spans[0][1] - spans[0][0];
  assert.ok(got >= need - 1e-9, `第 1 条 ${got.toFixed(3)}s 仍短于下界 ${need.toFixed(3)}s`);
  assert.ok(got > 1.6 + 1e-9, '应确实向后借了时间（不再是 1.6s）');
  assertContiguous(spans);
});

// ── ③ 无空档（阈值 0.2s）────────────────────────────────────
test('无空档：相邻两条 end 与下一条 start 差 ≤ 0.2s', () => {
  const cues = synthCues(SENTENCES, 42, 0.25);   // 故意把静默拉到 0.25s
  const { spans } = alignCuesToSentences(cues, SENTENCES);
  assertContiguous(spans, 0.2);
});

// ── ④ 认不出的句子 ──────────────────────────────────────────
test('认不出的句子：中间某句与任何 cue 都不匹配 ⇒ 仍有合理区间（不空档、不 0 长度）', () => {
  const cues = synthCues(SENTENCES);
  const sentences = SENTENCES.slice();
  sentences[3] = 'zzzz';                          // normCJK 后是纯拉丁噪声，与任何 CJK cue 都不匹配
  const { spans, hitRate } = alignCuesToSentences(cues, sentences);
  assert.equal(hitRate, 7 / 8, '应恰好有 7 句认出');
  assertContiguous(spans);
  const d = spans[3][1] - spans[3][0];
  assert.ok(d > 0.5, `认不出的那句仍应有合理时长，实际 ${d.toFixed(3)}s`);
});

// ── ⑤ 边界：空输入 ⇒ 安全降级，绝不抛 ──────────────────────
test('边界：cues 为空 / 句子为空 ⇒ 返回安全空结果，绝不抛', () => {
  const a = alignCuesToSentences([], ['甲', '乙']);
  assert.equal(a.hitRate, 0);
  assert.equal(a.spans.length, 2, 'cues 为空时仍返回与句数等长的退化窗口');
  assert.deepEqual(a.spans, [[0, 0], [0, 0]]);

  const b = alignCuesToSentences(synthCues(SENTENCES), []);
  assert.deepEqual(b, { spans: [], hitRate: 0 });

  // 非数组 / null 也不能抛
  assert.deepEqual(alignCuesToSentences(null, null), { spans: [], hitRate: 0 });
  assert.equal(alignCuesToSentences(null, ['甲']).spans.length, 1);
});

// ── ⑥ hitRate 语义 ──────────────────────────────────────────
test('hitRate = 认出锚点的句子数 / 句子总数', () => {
  const cues = [
    { start: 0, end: 1, text: '今天天气很好' },
    { start: 1, end: 2, text: '明天也要上班' },
    { start: 2, end: 3, text: '后天继续努力' },
  ];
  assert.equal(alignCuesToSentences(cues, ['今天天气很好', '明天也要上班', '后天继续努力']).hitRate, 1);
  assert.equal(alignCuesToSentences(cues, ['今天天气很好', 'zzzz', '后天继续努力']).hitRate, 2 / 3);
  assert.equal(alignCuesToSentences(cues, ['zzzz', 'qqqq']).hitRate, 0);
});

// ── 常量自洽 ────────────────────────────────────────────────
test('常量自洽：SUB_MAX_CPS / SUB_MIN_DUR 取值合理，minReadableDur 单调', () => {
  assert.ok(SUB_MAX_CPS > 0 && SUB_MAX_CPS <= 20, '最大阅读速度应在合理区间');
  assert.ok(SUB_MIN_DUR > 0 && SUB_MIN_DUR < 2, '绝对下限应在合理区间');
  assert.equal(minReadableDur(''), SUB_MIN_DUR, '空句 ⇒ 绝对下限');
  assert.ok(minReadableDur('字'.repeat(90)) > minReadableDur('字'.repeat(9)), '字数越多所需时长越长');
});

// ── 运行器 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/dub-align.test.mjs —— 功能2 字幕时间轴对齐 纯逻辑测试'));
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
