#!/usr/bin/env node
/**
 * test/dub-lexicon.test.mjs —— `lib/dub-lexicon.mjs` 的**纯逻辑**测试（零依赖）
 *
 * ★ 为什么必须有这一份（2026-10-04 补）：
 *   它是**规则兜底**用的中文词表，导出 `TAG_LEXICON`（tag → 触发词）与 `lexiconCoverage(tags)`
 *   （列出「风格声明了、但词表里没有 bucket」的 tag）。消费者是 `lib/dub-semantic.mjs`（规则路）与 `dub.mjs`。
 *   它对应的**静默缺陷**是：**新增风格时，风格 tags 用了词表里没有的新 tag ⇒ 规则路永远匹配不到它**
 *   —— 输出照出、只是永远选不中该风格。这类缺陷没人会去数，只能机械拦。
 *   ⇒ 本测试钉住 `lexiconCoverage` 的契约 + `TAG_LEXICON` 这份大词表的数据完整性。
 *
 * ★ 本次**实测发现、并与团队简报不符**的两点（已在下面用「真实行为」用例钉住）：
 *   ① `lexiconCoverage(null / undefined / 无参)` 原实现**会抛 TypeError**（直接 `tags[k]`，没兜底）。
 *      ★ 2026-10-04 已按项目房规（**缺失即优雅降级、绝不抛**，同 `lib/style-skill-reader.mjs`）
 *      改为**返回四维全空数组**，断言随之改为「优雅降级」——「断言某输入会抛」是坏钉子。
 *   ② 入参某维度**不是数组**时：字符串会被**按字符迭代**（`'通用'` ⇒ `['通','用']`），
 *      数字 / 普通对象则抛 `is not iterable`；`null` 因 `|| []` 而静默成空。三者行为**不一致**
 *      —— 这是**真实现状**，且无消费者会传这种值，故**如实断言、不改**。
 *
 * 覆盖：
 *   ① `lexiconCoverage` 契约：恒四键、漏登记命中、已登记不出现、多维度不串维；
 *   ② `lexiconCoverage` 边界：null/undefined 抛、非数组维度三种表现（**真实行为**）；
 *   ③ `TAG_LEXICON` 数据完整性：四维非空、值为非空字符串数组、无前后空白；
 *   ④ `TAG_LEXICON` 源文本**重复 tag 键**扫描（对象字面量重复键会静默覆盖，只能读源码文本查）；
 *   ⑤ 触发词重叠：跨 tag 共用（16/12/12/0 组）**现状冻结**（如实断言、只拦新增）；
 *      同 bucket 内重复**不许存在**（重复会被 `hits()` 重复计数、虚增命中数、影响 `rank()` 排序）。
 *
 * 用法：node test/dub-lexicon.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { TAG_LEXICON, lexiconCoverage } from '../lib/dub-lexicon.mjs';

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

const DIMS = ['theme', 'emotion', 'scene', 'pace'];
const sorted = (a) => a.slice().sort();

// ══════════════════════════════════════════════════════════════
// ① lexiconCoverage 契约
// ══════════════════════════════════════════════════════════════

test('lexiconCoverage：返回对象恒有 theme/emotion/scene/pace 四键（入参缺维度也补齐）', () => {
  for (const input of [{}, { theme: [] }, { scene: ['口播'] }, { theme: ['通用'], pace: ['中'] }]) {
    const r = lexiconCoverage(input);
    assert.deepEqual(Object.keys(r).sort(), sorted(DIMS), `入参 ${JSON.stringify(input)} 应恒返回四键`);
    for (const d of DIMS) assert.ok(Array.isArray(r[d]), `${d} 应当是数组`);
  }
});

test('lexiconCoverage：{} / 空维度 ⇒ 四维都为空数组', () => {
  assert.deepEqual(lexiconCoverage({}), { theme: [], emotion: [], scene: [], pace: [] });
  assert.deepEqual(lexiconCoverage({ theme: [], emotion: [], scene: [], pace: [] }),
    { theme: [], emotion: [], scene: [], pace: [] });
  // 未知维度键被忽略（不报错、也不出现在返回里）
  assert.deepEqual(lexiconCoverage({ foo: ['x'] }), { theme: [], emotion: [], scene: [], pace: [] });
});

test('lexiconCoverage：漏登记的 tag 进对应维度，已登记的 tag 不出现', () => {
  const miss = lexiconCoverage({ theme: ['通用', '不存在的主题'], emotion: ['平静'] });
  assert.deepEqual(miss.theme, ['不存在的主题'], '「通用」在词表里，不该出现；「不存在的主题」该出现');
  assert.deepEqual(miss.emotion, [], '「平静」在词表里，不该出现');
  assert.deepEqual(miss.scene, []);
  assert.deepEqual(miss.pace, []);
});

test('★ lexiconCoverage：多维度同时漏 ⇒ 各归各维、不串维', () => {
  const miss = lexiconCoverage({
    theme: ['漏T'],
    emotion: ['漏E', '漏E2'],
    scene: ['漏S'],
    pace: ['漏P'],
  });
  assert.deepEqual(miss.theme, ['漏T']);
  assert.deepEqual(miss.emotion, ['漏E', '漏E2']);
  assert.deepEqual(miss.scene, ['漏S']);
  assert.deepEqual(miss.pace, ['漏P']);
});

// ══════════════════════════════════════════════════════════════
// ② lexiconCoverage 边界 —— ★ 真实行为，与团队简报不符
// ══════════════════════════════════════════════════════════════

test('★ lexiconCoverage：null / undefined / 无参 ⇒ 优雅降级为四维全空，**绝不抛**（项目房规）', () => {
  // ★ 2026-10-04 修正：原实现直接 `tags[k]` ⇒ 抛 TypeError。但本项目房规是
  //   「缺失即优雅降级 ⇒ 绝不抛」（同 lib/style-skill-reader.mjs：summarize(null)→null、
  //   describe(null)→[]）；且「断言某个输入会抛」是**坏钉子** —— 哪天有人把它改成安全，
  //   这条会误报成回归。故实现与断言一起改为**优雅降级**。
  const empty = { theme: [], emotion: [], scene: [], pace: [] };
  for (const bad of [null, undefined]) {
    assert.deepEqual(lexiconCoverage(bad), empty, `入参 ${bad} 应返回四维全空，而不是抛`);
  }
  assert.deepEqual(lexiconCoverage(), empty, '无参同样优雅降级');
});

test('★ lexiconCoverage：某维度非数组 ⇒ 字符串按字符迭代、数字/对象抛「not iterable」', () => {
  // 字符串是可迭代的 ⇒ 逐字符当 tag 查，全部「漏登记」
  assert.deepEqual(lexiconCoverage({ theme: '通用' }).theme, ['通', '用'],
    "字符串 '通用' 会被按字符迭代 ⇒ ['通','用']（不是把整串当一个 tag）");
  // null 因 `tags[k] || []` 静默成空
  assert.deepEqual(lexiconCoverage({ theme: null }).theme, [], 'null 维度应静默成空数组');
  // 数字 / 普通对象不可迭代 ⇒ 抛
  assert.throws(() => lexiconCoverage({ theme: 42 }), TypeError, '数字维度应抛「not iterable」');
  assert.throws(() => lexiconCoverage({ theme: { a: 1 } }), TypeError, '对象维度应抛「not iterable」');
});

test('lexiconCoverage：数组里的非字符串项被**原样透传**（不做类型校验）', () => {
  // 实现只做 `!TAG_LEXICON[k][t]` 存在性判断，不校验 t 的类型 ⇒ 非字符串项原样进 miss。
  assert.deepEqual(lexiconCoverage({ theme: [123, null, { x: 1 }] }).theme, [123, null, { x: 1 }]);
});

// ══════════════════════════════════════════════════════════════
// ③ TAG_LEXICON 数据完整性
// ══════════════════════════════════════════════════════════════

test('TAG_LEXICON：四个维度都存在，且每个维度都是非空对象', () => {
  assert.deepEqual(Object.keys(TAG_LEXICON).sort(), sorted(DIMS), '顶层应恰有四维');
  for (const d of DIMS) {
    assert.ok(TAG_LEXICON[d] && typeof TAG_LEXICON[d] === 'object' && !Array.isArray(TAG_LEXICON[d]),
      `${d} 应当是对象`);
    assert.ok(Object.keys(TAG_LEXICON[d]).length > 0, `${d} 应当非空`);
  }
});

test('★ TAG_LEXICON：每个维度的每个值都是「非空字符串数组」，触发词非空且无前后空白', () => {
  for (const d of DIMS) {
    for (const [tag, words] of Object.entries(TAG_LEXICON[d])) {
      assert.ok(Array.isArray(words), `${d}.${tag} 的值应当是数组，实际 ${typeof words}`);
      assert.ok(words.length > 0, `${d}.${tag} 的触发词数组不应为空`);
      for (const w of words) {
        assert.equal(typeof w, 'string', `${d}.${tag} 的触发词应为字符串，实际 ${typeof w}`);
        assert.ok(w.length > 0, `${d}.${tag} 出现空触发词`);
        assert.equal(w, w.trim(), `${d}.${tag} 的触发词「${w}」有前后空白`);
      }
    }
  }
});

test('★ TAG_LEXICON：同一维度内不许有重复的 tag 键（读源文本扫描 —— 对象重复键会静默覆盖）', () => {
  // ★ 为什么读源码文本：JS 对象字面量里重复的键**不报错、静默取最后一个**，
  //   从 `TAG_LEXICON` 对象本身根本看不出「写了两遍」。只能扫 `../lib/dub-lexicon.mjs` 的源码文本。
  const src = fs.readFileSync(new URL('../lib/dub-lexicon.mjs', import.meta.url), 'utf8');
  // 抓每个维度块（值都是数组、无嵌套花括号，块尾是行首 `  }`）
  const blockRe = /^  (theme|emotion|scene|pace): \{([\s\S]*?)^  \}/gm;
  const found = new Map();
  let m;
  while ((m = blockRe.exec(src))) {
    const body = m[2];
    // 键行形如 `    通用: ['分享', ...],`（4 空格缩进 + 键 + `: [`）
    const keys = [...body.matchAll(/^    ([^\s/:][^:]*?): \[/gm)].map((x) => x[1]);
    found.set(m[1], keys);
  }
  assert.equal(found.size, 4, '源码里应能扫出四个维度块');
  for (const d of DIMS) {
    const keys = found.get(d);
    assert.ok(keys && keys.length > 0, `${d} 块应能扫出键`);
    const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
    assert.deepEqual([...new Set(dup)], [], `${d} 维度存在重复 tag 键：${dup.join('、')}`);
    // 源文本键数必须与对象键数一致 —— 若少，说明确实发生了静默覆盖
    assert.equal(keys.length, Object.keys(TAG_LEXICON[d]).length,
      `${d}：源文本键 ${keys.length} 个 vs 对象键 ${Object.keys(TAG_LEXICON[d]).length} 个（不等即发生了静默覆盖）`);
  }
});

// ══════════════════════════════════════════════════════════════
// ④ 触发词重叠现状冻结 —— ★ 如实断言现状，新增重叠会变红
// ══════════════════════════════════════════════════════════════

/**
 * 跨 tag 共用同一个触发词 ⇒ 一个词同时命中两个 tag，规则路分不清。
 * ★ 现状**确实存在**（下表为 2026-10-04 实测冻结），本用例**如实断言现状**：
 *   · 不假装它不存在；也不为了让它变绿去改真实词表（那是掩盖问题）。
 *   · 只保证「不再新增」—— 任何**新的**共享词会让本用例变红，逼人去决定归哪个 tag。
 */
const CROSS_TAG_SHARED = {
  theme: ['原理', '文化', '传统', '技术', '续航', '接口', '训练', '健康', '习俗', '意义', '独立', '设计', '方案', '指标', '调试', '装配'],
  emotion: ['安静', '慢下来', '静下来', '客观', '标准', '实测', '大气', '克制', '留白', '治愈', '清幽', '闲适'],
  scene: ['版画', '木刻', '清单', '拆开', '结构', '组成', '步骤', '跟着做', '教学', '教你', '回家', '剖面'],
  pace: [],
};

test('★ TAG_LEXICON：跨 tag 共用触发词 —— 现状冻结（theme 16 / emotion 12 / scene 12 / pace 0）', () => {
  for (const d of DIMS) {
    const w2t = new Map();
    for (const [tag, words] of Object.entries(TAG_LEXICON[d])) {
      for (const w of words) {
        if (!w2t.has(w)) w2t.set(w, new Set());
        w2t.get(w).add(tag);
      }
    }
    const shared = [...w2t.entries()].filter(([, s]) => s.size > 1).map(([w]) => w);
    assert.deepEqual(sorted(shared), sorted(CROSS_TAG_SHARED[d]),
      `${d} 维度的跨 tag 共享触发词与冻结基线不符（新增/删除了共享词，需人工决定归哪个 tag）`);
  }
});

test('★ TAG_LEXICON：同 bucket 内**不许有**重复触发词（重复会被 hits() 重复计数、虚增命中数）', () => {
  // ★ 2026-10-04 修正：此前把 3 处重复（历史:朝代 / 博物:图谱 / 开阔:辽阔）冻结为「已知现状」，
  //   并注释成「冗余，**无功能危害**」—— **这句不成立**：
  //     lib/dub-semantic.mjs:165-174 的 hits(text, words) 是**逐词 n++**；
  //     lib/dub-semantic.mjs:178-183 的 rank() 排序第一键就是 `b.n - a.n`。
  //   ⇒ 同一个词写两遍会给该 tag **虚增 +1 命中**（实测「讲一讲清朝的历史，那个朝代的故事」时
  //     theme.历史 的 n = 3（含重复）/ 2（去重）），在命中数接近的竞争里足以翻盘 top-5 主题排序。
  //   故已删掉这 3 处重复词，本用例从「冻结现状」升级为**硬不变量：不许存在、也不许新增**。
  for (const d of DIMS) {
    const dup = [];
    for (const [tag, words] of Object.entries(TAG_LEXICON[d])) {
      const seen = new Set();
      for (const w of words) {
        if (seen.has(w)) dup.push(`${tag}:${w}`);
        seen.add(w);
      }
    }
    assert.deepEqual(dup, [], `${d} 维度同 bucket 内存在重复触发词：${dup.join('、')}（会被 hits() 重复计数）`);
  }
});

// ── 运行器 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/dub-lexicon.test.mjs —— 规则词表 TAG_LEXICON / lexiconCoverage 纯逻辑测试'));
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
