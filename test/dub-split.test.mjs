#!/usr/bin/env node
/**
 * test/dub-split.test.mjs —— `lib/dub-core.mjs` 的 `splitSentences`（断句）**纯逻辑**测试（零依赖）
 *
 * ★ 为什么必须有这一份（2026-10-04 补）：
 *   它是**出片路径上的断句唯一真相源**（`server.mjs` → `dub.mjs:744` → 本函数），
 *   却**一条测试都没有**。而它有一个**会切在词/记号内部**的兜底硬切 —— 实测后果：
 *     · `…次日就收米|上百…`（CJK 词内切开）
 *     · `…全靠 AI |1键复制…`（在 Latin 与数字之间切开）
 *     · 切片**没 trim** ⇒ 字幕里留**首尾空白**（实测 `…全靠 AI ` 末尾带一个空格）
 *
 * ★ 本次改动（`lib/dub-core.mjs` 的兜底硬切）：改成在 `[maxLen−6, maxLen+6]` 窗口内挑
 *   **优先级最高、且离 maxLen 最近**的切点 —— ① 标点之后 → ② 空白处 →
 *   ③ 字符类变化处（**但排除「Latin↔数字」**，那是同一 token 内部）→ ④ 都没有则退回定长硬切。
 *
 * ★★ **已知局限（本测试把它钉住，不假装解决）**：**纯中文且无标点时，任何定长切法都可能切在词内**
 *   —— 除非引入分词器，而本项目 Node 侧**有意不依赖 jieba**。这种情况走 ④，行为与改前一致。
 *
 * 用法：node test/dub-split.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';

import { splitSentences } from '../lib/dub-core.mjs';

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

const MAX = 40;
const strip = (s) => String(s).replace(/\s+/g, '');
const J = (x) => JSON.stringify(x);

// ── ① 基本契约 ───────────────────────────────────────────────
test('基本：空串 / 纯空白 ⇒ []；短句 ⇒ 原样一条（不抛）', () => {
  assert.deepEqual(splitSentences(''), []);
  assert.deepEqual(splitSentences('   \n  '), []);
  assert.deepEqual(splitSentences('今天分享一个玩法。'), ['今天分享一个玩法。']);
  assert.deepEqual(splitSentences(null), []);
  assert.deepEqual(splitSentences(undefined), []);
});

test('按换行优先：多行输入 ⇒ 每行一句（行数 == 句数）', () => {
  const r = splitSentences('第一句\n第二句\n第三句');
  assert.deepEqual(r, ['第一句', '第二句', '第三句']);
});

test('按句末标点切（无换行时）', () => {
  const r = splitSentences('第一句。第二句！第三句？');
  assert.deepEqual(r, ['第一句。', '第二句！', '第三句？']);
});

// ── ② ★ 兜底硬切：不在「Latin↔数字」之间切 ──────────────────
test('★ 硬切：**不得**切在 Latin 与数字之间（`AI1` 是同一个 token）', () => {
  // 构造：让 `AI1` 落在窗口 [34,46] 内
  const src = '甲'.repeat(35) + 'AI1键复制' + '乙'.repeat(20);
  const r = splitSentences(src, MAX);
  assert.ok(r.length >= 2, `应当被切成多条，实得 ${r.length}`);
  for (const p of r) assert.ok(p.length <= MAX, `每条不得超 ${MAX} 字：${J(p)}`);
  // 逐条检查「切点」：相邻两条之间不得是 Latin↔数字
  for (let i = 1; i < r.length; i++) {
    // 注意：切点两侧的字符要看**原文**顺序；这里用「上一条结尾」与「下一条开头」近似判定
    const a = r[i - 1].slice(-1), b = r[i][0];
    const badPair = (/[A-Za-z]/.test(a) && /[0-9]/.test(b)) || (/[0-9]/.test(a) && /[A-Za-z]/.test(b));
    assert.ok(!badPair, `不得在 Latin↔数字 之间切：${J(a)} | ${J(b)}（全文：${J(r)}）`);
  }
});

test('★ 硬切：优先在**空白处**切（构造得让旧代码必然切在 Latin 词内）', () => {
  // ★ 这条输入是**刻意设计来区分新旧**的：
  //   字符位：0-34 = 甲×35、35 = 空格、36-43 = 'ABCDEFGH'、44 = 空格、45+ = 乙
  //   窗口 [34,46] 内有两个空白（35 与 44）：44 离 40 更近 ⇒ 新代码应切在 44
  //   ⇒ 第一条应以 'ABCDEFGH' 结尾；而**旧代码**固定切在 40（= 甲×35 + ' ABCD'）⇒ 会切在 Latin 词内。
  const src = '甲'.repeat(35) + ' ' + 'ABCDEFGH' + ' ' + '乙'.repeat(20);
  const r = splitSentences(src, MAX);
  assert.ok(r.length >= 2, `应当被切成多条，实得 ${r.length}`);
  // 窗口内有两个空白（Latin 串**前**一个、**后**一个），离 40 都是 4 ⇒ 取先遇到的（串前那个）也合法。
  // ⇒ 断言「切点必须是空白」而不是「必须是哪一个空白」：
  //   ✓ 允许 `甲×35`（切在串前空格）或 `甲×35 + ' ABCDEFGH'`（切在串后空格）
  //   ✗ 禁止 `甲×35 + ' ABCD'`（**旧代码**固定切在 40 ⇒ 切在 Latin 词内）
  const ok1 = r[0] === '甲'.repeat(35);
  const ok2 = r[0] === '甲'.repeat(35) + ' ABCDEFGH';
  assert.ok(ok1 || ok2,
    `第一条必须切在**空白**处（不许切在 ABCDEFGH 内部，旧代码会得到 '甲×35 + " ABCD"'）：${J(r[0])}`);
  assert.ok(!r[0].endsWith('ABCD') && !/^[A-H]$/.test(r[0].slice(-1)),
    `不得切在 Latin 词内：${J(r[0])}`);
});

// ── ③ ★ 切片必须 trim（修「字幕留首尾空白」的 cosmetic bug）──
test('★ 每条切片**无首尾空白**（改前 `…全靠 AI ` 末尾带一个空格）', () => {
  const src = '甲'.repeat(36) + ' AI 1键复制' + '乙'.repeat(20);
  for (const p of splitSentences(src, MAX)) {
    assert.equal(p, p.trim(), `切片不应有首尾空白：${J(p)}`);
  }
});

// ── ④ 不丢字：拼回 == 原文（去空白）────────────────────────
test('★ 拼回（去空白）== 原文（去空白）—— 硬切最大的风险是丢字/多字', () => {
  const samples = [
    '甲乙丙丁戊己庚辛壬癸'.repeat(6),                                   // 60 字纯中文、无标点
    '甲'.repeat(35) + 'AI1键复制' + '乙'.repeat(20),
    '甲'.repeat(36) + ' AI 1键复制' + '乙'.repeat(20),
    '今天分享的是 AI 某条玩法测评不是所有平台都靠粉丝吃饭有人发一篇文章次日就收米上百这不是玄学是 AI 带来的内容红利',
    '甲'.repeat(20) + '，' + '乙'.repeat(20) + '丙'.repeat(20),
    '一。'.repeat(30),
  ];
  for (const s of samples) {
    const r = splitSentences(s, MAX);
    assert.equal(strip(r.join('')), strip(s), `拼回应等于原文（去空白）：\n原文 ${J(s)}\n实得 ${J(r)}`);
    for (const p of r) assert.ok(p.length <= MAX, `每条不得超 ${MAX} 字：${J(p)}（原文 ${J(s)}）`);
  }
});

// ── ⑤ 既有行为不许被改坏 ────────────────────────────────────
test('含逗号的超长句：仍**优先按逗号**切（既有行为不变）', () => {
  const src = '甲'.repeat(20) + '，' + '乙'.repeat(20) + '，' + '丙'.repeat(20);
  const r = splitSentences(src, MAX);
  assert.ok(r[0].endsWith('，'), `第一条应以逗号结尾（按逗号切），实得 ${J(r[0])}`);
  for (const p of r) assert.ok(p.length <= MAX, `每条不得超 ${MAX} 字：${J(p)}`);
});

test('★ 已知局限：纯中文无标点的超长句**仍会被定长硬切**（如实钉住，不假装解决）', () => {
  // 这条是「已知局限」的**显式记录**：无分词器时无法避免词内切开。
  const src = '甲乙丙丁戊己庚辛壬癸'.repeat(6);   // 60 字，无标点无空白
  const r = splitSentences(src, MAX);
  assert.equal(r.length, 2, '60 字应切成 2 条');
  assert.equal(r[0].length, MAX, `第一条应为定长 ${MAX}（窗口内没有任何「自然边界」候选）`);
  assert.equal(r[1].length, 20, '第二条应为余下 20 字');
  assert.equal(strip(r.join('')), strip(src), '拼回应等于原文');
});

test('★ 硬切循环：远超 2 倍上限的输入也能切成多条且不丢字', () => {
  const src = '甲乙丙丁戊己庚辛壬癸'.repeat(20);   // 200 字
  const r = splitSentences(src, MAX);
  assert.equal(r.length, 5, `200 字 / ${MAX} 应切成 5 条，实得 ${r.length}`);
  assert.equal(strip(r.join('')), strip(src), '拼回应等于原文');
  for (const p of r) assert.ok(p.length <= MAX);
});

// ── 运行器 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/dub-split.test.mjs —— 断句（splitSentences）纯逻辑测试'));
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
