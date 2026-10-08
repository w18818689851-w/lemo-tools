#!/usr/bin/env node
/**
 * test/originality.test.mjs —— 「从零原创」审计器的纯逻辑测试（零依赖）
 *
 * 用法：node test/originality.test.mjs
 *
 * ★ 为什么这些用例必须存在：
 *   这个工具存在的唯一理由，是让「有没有套模板」从**嘴说**变成**会失败的检查**。
 *   上一轮就是这么翻车的：拿「换 content.json 的文字与配色」当交差，而库文档明说那不是做片子。
 *   所以本文件里最关键的几条是：
 *     · 完全抄示例的文本 → **必须判失败**
 *     · 只改几个词、保留原句框架 → **必须判失败**（用户明确禁止「简单改字拼接」）
 *     · 大段照抄主体代码 → **必须判失败**
 *   如果哪天有人把判据改松了，这几条会先红。
 *
 * ★ 阈值敏感性用例：
 *   每条判据都接受 opt 覆盖阈值。用例会**把阈值调紧**，确认原本通过的样本变成失败 ——
 *   证明「常量真的在参与判定」，而不是写了一堆没人用的数字。
 *
 * ★ 中文用例（㉟–㊷）：
 *   中文没有词边界、也没有可用的虚词表，所以判据走的是**另一套口径**（汉字逐字 n-gram +
 *   字符集合重合率，阈值见 NARRATION_*_CJK）。这几条锁住的是：
 *     · 中文新片 vs 中文示例 → 通过（不能把「都讲同一件史实」误判成抄）
 *     · 中文旁白 vs 英文示例、英文旁白机翻成中文 → 通过（跨语言不是套模板）
 *     · 中文示例改几个字 → **必须判失败**（这是用户明确禁止的「简单改字拼接」）
 *     · 报告里必须写明口径换了（标题/detail/阈值都要是中文那套，不许退回「实词重合率」）
 *   改动前用拉丁阈值（0.6）跑中文会**误判**：同题材独立写作的两段中文字符重合能到 0.72。
 *
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import {
  THRESHOLDS, STATUS,
  NARRATION_NGRAM_MAX, NARRATION_OVERLAP_MAX, CODE_RUN_MAX, TIMELINE_LCS_RATIO_MAX,
  NARRATION_NGRAM_MAX_CJK, NARRATION_OVERLAP_MAX_CJK,
  tokenize, normalizeText, contentTokens, overlapTokens, hasCJK, longestCommonRun, lcsLength, setStats,
  textUnits, voiceUnits, plateUnits,
  checkTextOriginality, checkDetails, checkIdentity, checkColors, checkEndCard,
  codeLines, objectLiteralKeys, extractRegionKeys, extractFocusKeys,
  checkCodeSimilarity, checkSubjectKeys,
  eventTypeSequence, infoSequence, checkTimeline,
  auditAll, renderMarkdown,
} from '../lib/originality.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// ★ 硬规则：禁止写 C 盘。`os.tmpdir()` 在 Windows 上就是 C 盘，所以临时根显式落在非 C 盘
//   （默认 D:/lemo-tmp，可用 LEMO_TMP 覆盖；若解析到 C 盘则**直接炸**，不静默往 C 盘拉屎）。
const TMP_ROOT = path.resolve(process.env.LEMO_TMP || 'D:/lemo-tmp');
if (/^[cC]:/.test(path.parse(TMP_ROOT).root)) {
  throw new Error(`临时根落在 C 盘（${TMP_ROOT}）——本项目禁止写 C 盘`);
}
fs.mkdirSync(TMP_ROOT, { recursive: true });

const TTY = process.stdout.isTTY;
const C = {
  ok: (x) => (TTY ? `\x1b[32m${x}\x1b[0m` : x),
  bad: (x) => (TTY ? `\x1b[31m${x}\x1b[0m` : x),
  dim: (x) => (TTY ? `\x1b[2m${x}\x1b[0m` : x),
  b: (x) => (TTY ? `\x1b[1m${x}\x1b[0m` : x),
};
const log = (x = '') => process.stdout.write(`${x}\n`);

// ── 合成素材 ────────────────────────────────────────────────
// 示例片（= 库自带 demo 的《The Honeybee》的等价副本）
const REF = {
  title: 'The Honeybee', latin: 'Apis mellifera', subject: 'bee',
  details: [
    { name: 'Compound Eye', latin: 'oculus compositus', note: 'Some six thousand facets, each one a lens.', focus: 'eye' },
    { name: 'Wing Hooks', latin: 'hamuli', note: 'A row of tiny hooks locks both wings as one.', focus: 'hamuli' },
    { name: 'Pollen Basket', latin: 'corbicula', note: 'A fringed hollow that carries pollen home.', focus: 'corbicula' },
  ],
  colors: ['abdomen', 'thorax', 'head', 'eyes', 'wings', 'legs', 'pollen'].map((region) => ({ region })),
  caption: 'See the living hive in Gallery 4',
  end: {
    film_title: 'The Honeybee, Plate VII', style_name: 'Copperplate Engraving',
    credits: ['Voice · Kokoro TTS (Apache-2.0)', 'Type · Bodoni Moda · Pinyon Script', 'Score & sound · written in code'],
  },
  voice: {
    lines: [
      { id: 'title', text: 'Plate seven. The honeybee: Apis mellifera.' },
      { id: 'd1', text: 'Each eye is built from some six thousand facets, and every one of them is a lens.' },
      { id: 'd2', text: 'In flight, a row of tiny hooks locks the two wings into one.' },
      { id: 'd3', text: 'And on the hind leg, a basket, for carrying pollen home.' },
      { id: 'close', text: 'A lifetime of such work makes a twelfth of a teaspoon of honey.' },
    ],
  },
};

// 新片（= 真·咖啡片，与示例无关）
const NEW = {
  title: 'The Coffee Plant', latin: 'Coffea arabica', subject: 'coffee',
  details: [
    { name: 'The Flower', latin: 'corolla', note: 'White, five petals, jasmine-scented. Open two days.', focus: 'flower' },
    { name: 'The Cherry', latin: 'drupa', note: 'Red when ripe, after six to eleven months.', focus: 'cherry' },
    { name: 'The Seeds', latin: 'semina', note: 'Two seeds, flat face to flat face. The bean is a seed.', focus: 'seed' },
    { name: 'The Port of Mocha', latin: 'Mocha', note: 'For two hundred years, the only door.', focus: 'harbour' },
  ],
  colors: ['sea', 'cherry', 'leaf'].map((region) => ({ region })),
  caption: 'Trade route of the coffee seed, 1400–1900',
  end: {
    film_title: 'Coffea arabica', style_name: 'Copperplate Engraving',
    credits: ['Botany · Coffea arabica L.', 'Route · Kaffa to Mocha to the world', 'Voice · Kokoro TTS (Apache-2.0)'],
  },
  voice: {
    lines: [
      { id: 'title', text: 'Plate one. Coffea arabica, the plant that travelled.' },
      { id: 'd1', text: 'The flower opens white, smells of jasmine, and lasts two days.' },
      { id: 'd2', text: 'The fruit ripens red, and takes six to eleven months to do it.' },
      { id: 'd3', text: 'Inside lie two seeds, flat face to flat face. The bean is a seed.' },
      { id: 'd4', text: 'Yemen drank it by the fifteenth century. One port, Mocha, was the only door.' },
      { id: 's1', text: 'In fifteen fifty-four, two merchants opened a coffee house in Constantinople.' },
      { id: 's2', text: 'Venice by sixteen forty-five, London by sixteen fifty-two.' },
      { id: 's3', text: 'Java, Martinique, Brazil. By seventeen twenty-seven it was everywhere.' },
      { id: 's4', text: 'Six hundred years after it left, the plant came home to Kenya.' },
    ],
  },
};

const REF_CODE = `import * as B from '../engine/burin.js';
const { ring, outline, hatch, stroke, RNG } = B;
const L = { x: -0.55, y: -0.62, z: 0.56 };
export function buildBee({ x = 960, y = 606, s = 1, seed = 12 } = {}) {
  const ink = new B.Ink();
  const regions = {}, add = (name, sh) => { (regions[name] ||= []).push(sh); };
  add('abdomen', 1);
  add('thorax', 2);
  add('head', 3);
  add('eyes', 4);
  add('wings', 5);
  add('legs', 6);
  add('pollen', 7);
  const focus = { eye: 1, hamuli: 2, corbicula: 3 };
  return { ink, regions, focus };
}
`;

const NEW_CODE = `import * as B from '../engine/burin.js';
const { ring, outline, hatch, stroke, RNG, ellipsePts } = B;
const LIGHT = { x: -0.5, y: -0.6, z: 0.62 };
export function buildCoffee({ x = 900, y = 640, s = 1.1, seed = 31 } = {}) {
  const ink = new B.Ink();
  const regions = { leaf: 1, cherry: 2, soil: 3 };
  const focus = { flower: 1, cherry: 2, seed: 3 };
  const stem = [];
  for (let i = 0; i < 40; i++) stem.push(i);
  return { ink, regions, focus, stem };
}
`;

// 大段照抄：只改了函数名与结尾的 focus 一行，中间 9 行与 REF_CODE 逐行相同
const COPY_CODE = `import * as B from '../engine/burin.js';
const { ring, outline, hatch, stroke, RNG } = B;
const L = { x: -0.55, y: -0.62, z: 0.56 };
export function buildScallop({ x = 960, y = 606, s = 1, seed = 12 } = {}) {
  const ink = new B.Ink();
  const regions = {}, add = (name, sh) => { (regions[name] ||= []).push(sh); };
  add('abdomen', 1);
  add('thorax', 2);
  add('head', 3);
  add('eyes', 4);
  add('wings', 5);
  add('legs', 6);
  add('pollen', 7);
  const focus = { eye: 1 };
  return { ink, regions, focus };
}
`;

// 只有零散相同行：与 REF_CODE 最长连续相同 2 行
const SCATTER_CODE = `import * as B from '../engine/burin.js';
const { ring, outline, hatch, stroke, RNG } = B;
const ANCHOR = { x: 0.1, y: 0.2 };
export function buildHarbour({ x = 100, y = 200, s = 2, seed = 5 } = {}) {
  const quay = 3;
  const basins = { inner: 1, outer: 2 };
  const focus = { mole: 1, basin: 2, warehouse: 3 };
  return { quay, basins, focus };
}
`;

const REF_EV = { ev: ['burin', 'lift', 'press', 'peel', 'hatch', 'title', 'vo', 'push', 'ring', 'drop', 'landing'].map((type) => ({ type })) };
const NEW_EV = { ev: ['trace', 'cut', 'vo', 'wipe', 'sail', 'anchor'].map((type) => ({ type })) };

// ── 中文素材 ────────────────────────────────────────────────
// 示例片的**中文版**：把 REF 的英文旁白逐句意译过来（这就是「机翻」的样子）
const REF_ZH = {
  voice: { lines: [
    { id: 'title', text: '第七图版。蜜蜂：西方蜜蜂。' },
    { id: 'd1', text: '每只眼睛由大约六千个小眼组成，每一个都是一枚透镜。' },
    { id: 'd2', text: '飞行时，一排小钩把两片翅膀锁成一片。' },
    { id: 'd3', text: '后足上还有一只篮子，用来把花粉带回家。' },
    { id: 'close', text: '一生这样的劳作，只酿出十二分之一茶匙的蜜。' },
  ] },
};
// 新片的**中文版**（咖啡片，与蜜蜂无关）
const NEW_ZH = {
  voice: { lines: [
    { id: 'title', text: '图版一。阿拉比卡咖啡，那株会旅行的植物。' },
    { id: 'd1', text: '花开时是白的，闻起来像茉莉，只开两天。' },
    { id: 'd2', text: '果实成熟转红，要花六到十一个月。' },
    { id: 'd3', text: '里面是两粒种子，平面相抵。咖啡豆是一枚种子。' },
    { id: 'd4', text: '十五世纪的也门已经在喝它。唯一的门，是摩卡港。' },
  ] },
};
// 把**中文**示例旁白改几个字：句子骨架还在（用户明确禁止「简单改字拼接」）
const REF_ZH_TWEAKED = {
  voice: { lines: [
    { id: 'd1', text: '每只眼睛大约由六千个小眼构成，每一个都是一枚透镜。' },
    { id: 'd2', text: '飞行的时候，一排小钩把两片翅膀锁成一片。' },
  ] },
};

const evSeq = (types) => ({ ev: types.map((type) => ({ type })) });

function byId(checks, id) { const c = checks.find((x) => x.id === id); assert.ok(c, `没有找到检查 ${id}（实得 ${checks.map((x) => x.id).join(', ')}）`); return c; }
function allChecks(input) { return auditAll(input).checks; }
const runOf = (text, ref) => longestCommonRun(tokenize(text), tokenize(ref));

// ── 用例 ────────────────────────────────────────────────────
const CASES = [
  {
    name: '① 完全照抄示例旁白 → 必须判失败（最长公共词串 + 整句相同）',
    run: () => {
      const [ng] = checkTextOriginality(voiceUnits(REF), voiceUnits(REF));
      assert.strictEqual(ng.status, STATUS.FAIL, `照抄竟然通过了：${ng.detail}`);
      assert.ok(ng.metric >= NARRATION_NGRAM_MAX, `指标 ${ng.metric} 没有触到阈值 ${NARRATION_NGRAM_MAX}`);
      assert.ok(ng.evidence.some((e) => e.includes('整句相同')), '没有报出整句相同');
    },
  },
  {
    name: '② 完全照抄示例旁白 → 必须判失败（实词重合率）',
    run: () => {
      const [, ov] = checkTextOriginality(voiceUnits(REF), voiceUnits(REF));
      assert.strictEqual(ov.status, STATUS.FAIL, `照抄竟然通过了：${ov.detail}`);
      assert.ok(ov.metric >= NARRATION_OVERLAP_MAX, `重合率 ${ov.metric} 没有触到阈值 ${NARRATION_OVERLAP_MAX}`);
    },
  },
  {
    name: '③ 改几个词但保留原句框架 → 必须判失败（用户明确禁止「简单改字拼接」）',
    run: () => {
      const tweaked = { voice: { lines: [
        { id: 'd1', text: 'Each eye is made from about six thousand facets, and every one of them is a lens.' },
      ] } };
      const [ng, ov] = checkTextOriginality(voiceUnits(tweaked), voiceUnits(REF));
      assert.ok(ng.status === STATUS.FAIL || ov.status === STATUS.FAIL,
        `「改几个词」竟然通过了：ngram=${ng.status}/${ng.metric}，overlap=${ov.status}/${ov.metric}`);
    },
  },
  {
    name: '④ 只换同义词、句子骨架还在 → 仍必须判失败（靠实词重合率抓）',
    run: () => {
      const reshuffled = { voice: { lines: [
        { id: 'd2', text: 'In flight, tiny hooks lock the two wings as one.' },
      ] } };
      const [ng, ov] = checkTextOriginality(voiceUnits(reshuffled), voiceUnits(REF));
      assert.ok(ng.metric < NARRATION_NGRAM_MAX, `这条用例的前提是 n-gram 抓不到（实得 ${ng.metric}）`);
      assert.strictEqual(ov.status, STATUS.FAIL, `实词重合率没抓住改字拼接：${ov.detail}`);
    },
  },
  {
    name: '⑤ 真正无关的新文本 → 通过',
    run: () => {
      const [ng, ov] = checkTextOriginality(voiceUnits(NEW), voiceUnits(REF));
      assert.strictEqual(ng.status, STATUS.PASS, ng.detail);
      assert.strictEqual(ov.status, STATUS.PASS, ov.detail);
    },
  },
  {
    name: '⑥ 边界：空文本 / 空数组 → 判「无法判定」而不是通过',
    run: () => {
      for (const pair of [[[], voiceUnits(REF)], [voiceUnits(NEW), []], [[], []]]) {
        const [ng, ov] = checkTextOriginality(pair[0], pair[1]);
        assert.strictEqual(ng.status, STATUS.UNKNOWN, `空素材应判 unknown，实得 ${ng.status}`);
        assert.strictEqual(ov.status, STATUS.UNKNOWN);
        assert.strictEqual(ng.ok, false, 'unknown 的 ok 必须是 false（不许默认放行）');
      }
      const empty = { voice: { lines: [{ id: 'x', text: '' }, { id: 'y', text: '   ' }] } };
      const [ng] = checkTextOriginality(voiceUnits(empty), voiceUnits(REF));
      assert.strictEqual(ng.status, STATUS.UNKNOWN, '全空行应判 unknown');
    },
  },
  {
    name: '⑦ 边界：只有标点 → 无有效词，判 unknown；切词不产出空 token',
    run: () => {
      assert.deepStrictEqual(tokenize('—— ，。！？ … " " ;;;'), []);
      assert.strictEqual(normalizeText('  ,,,  '), '');
      const punct = { voice: { lines: [{ id: 'x', text: '…—？！,.;' }] } };
      const [ng] = checkTextOriginality(voiceUnits(punct), voiceUnits(REF));
      assert.strictEqual(ng.status, STATUS.UNKNOWN);
    },
  },
  {
    name: '⑧ 边界：大小写与标点差异视为「整句相同」→ 判失败',
    run: () => {
      const shout = { voice: { lines: [
        { id: 'd3', text: 'AND ON THE HIND LEG, A BASKET, FOR CARRYING POLLEN HOME!!!' },
      ] } };
      const [ng] = checkTextOriginality(voiceUnits(shout), voiceUnits(REF));
      assert.strictEqual(ng.status, STATUS.FAIL, '大小写/标点变体没被识破');
      assert.ok(ng.evidence.some((e) => e.includes('整句相同')));
    },
  },
  {
    name: '⑨ 边界：单字 / 短句不会跟长句误判（短行靠整句相等判，不靠包含率）',
    run: () => {
      const short = { voice: { lines: [{ id: 'x', text: 'Honey.' }] } };
      const [ng, ov] = checkTextOriginality(voiceUnits(short), voiceUnits(REF));
      assert.strictEqual(ng.status, STATUS.PASS, ng.detail);
      assert.strictEqual(ov.status, STATUS.PASS, ov.detail);
      // 单字抄单字仍然要抓住
      const twin = { voice: { lines: [{ id: 'x', text: 'HONEY' }] } };
      const ref1 = { voice: { lines: [{ id: 'y', text: 'honey' }] } };
      assert.strictEqual(checkTextOriginality(voiceUnits(twin), voiceUnits(ref1))[0].status, STATUS.FAIL);
    },
  },
  {
    name: '⑩ 边界：中英文混排切词正确（汉字逐字、拉丁成串、数字保留）',
    run: () => {
      assert.deepStrictEqual(tokenize('咖啡 Coffea 1400 年'), ['咖', '啡', 'coffea', '1400', '年']);
      assert.strictEqual(runOf('咖啡从埃塞俄比亚走向世界', '咖啡从埃塞俄比亚走向世界').len, 12); // 12 个汉字
      assert.strictEqual(runOf('咖啡从埃塞俄比亚走向世界', '茶叶从中国走向世界').len, 4); // 「走向世界」
    },
  },
  {
    name: '⑪ longestCommonRun / lcsLength 的基本行为',
    run: () => {
      const r = longestCommonRun(tokenize('alpha beta gamma delta epsilon'), tokenize('x alpha beta gamma delta zeta'));
      assert.strictEqual(r.len, 4);
      assert.strictEqual(r.phrase, 'alpha beta gamma delta');
      assert.strictEqual(longestCommonRun([], [1, 2]).len, 0);
      assert.strictEqual(longestCommonRun(['a'], ['b']).len, 0);
      assert.strictEqual(lcsLength(['a', 'b', 'c', 'd'], ['a', 'c', 'd']), 3);
      assert.strictEqual(lcsLength(['a', 'b'], ['b', 'a']), 1);
      assert.strictEqual(lcsLength([], ['a']), 0);
      assert.deepStrictEqual(setStats(['a', 'b'], ['b', 'c']).inter, ['b']);
      assert.strictEqual(setStats(['a', 'b'], ['b', 'c']).containment, 0.5);
    },
  },
  {
    name: '⑫ details 抄示例（name/latin/focus 重合）→ 判失败',
    run: () => {
      const c = checkDetails(REF, REF);
      assert.strictEqual(c.status, STATUS.FAIL, c.detail);
      assert.ok(c.metric >= 9, `重合数只有 ${c.metric}，判据漏了字段`);
      const partial = { details: [{ name: 'Wing Hooks', latin: 'zzz', focus: 'zzz' }] };
      assert.strictEqual(checkDetails(partial, REF).status, STATUS.FAIL, '只重合一个 name 也要抓住');
    },
  },
  {
    name: '⑬ details 全不同 → 通过；缺 details → unknown',
    run: () => {
      assert.strictEqual(checkDetails(NEW, REF).status, STATUS.PASS);
      assert.strictEqual(checkDetails({}, REF).status, STATUS.UNKNOWN);
      assert.strictEqual(checkDetails(NEW, {}).status, STATUS.UNKNOWN);
    },
  },
  {
    name: '⑭ 身份字段（title/latin/subject）与示例完全相同 → 判失败',
    run: () => {
      assert.strictEqual(checkIdentity(REF, REF).status, STATUS.FAIL);
      assert.strictEqual(checkIdentity(NEW, REF).status, STATUS.PASS);
      assert.strictEqual(checkIdentity({}, REF).status, STATUS.UNKNOWN);
    },
  },
  {
    name: '⑮ 配色 region 集合与示例完全相同 → 判失败；不同 → 通过',
    run: () => {
      const same = checkColors(REF, REF);
      assert.strictEqual(same.status, STATUS.FAIL, same.detail);
      assert.strictEqual(same.metric, 7);
      const shuffled = { colors: [...REF.colors].reverse() };
      assert.strictEqual(checkColors(shuffled, REF).status, STATUS.FAIL, '顺序不同但集合相同，仍应判失败');
      assert.strictEqual(checkColors(NEW, REF).status, STATUS.PASS);
      assert.strictEqual(checkColors({}, REF).status, STATUS.UNKNOWN);
    },
  },
  {
    name: '⑯ 收尾 caption / end card 与示例相同 → 判失败',
    run: () => {
      const c = checkEndCard(REF, REF);
      assert.strictEqual(c.status, STATUS.FAIL, c.detail);
      assert.ok(c.metric >= 3, `只报了 ${c.metric} 处，caption+film_title+credits 应都命中`);
      assert.strictEqual(checkEndCard({ ...NEW, caption: REF.caption }, REF).status, STATUS.FAIL, '只抄 caption 也要抓住');
      assert.strictEqual(checkEndCard(NEW, REF).status, STATUS.PASS);
      assert.strictEqual(checkEndCard({}, REF).status, STATUS.UNKNOWN);
    },
  },
  {
    name: '⑰ 主体代码大段照抄 → 判失败',
    run: () => {
      const c = checkCodeSimilarity([{ name: 'scallop.js', text: COPY_CODE }], [{ name: 'bee.js', text: REF_CODE }]);
      assert.strictEqual(c.status, STATUS.FAIL, c.detail);
      assert.ok(c.metric >= CODE_RUN_MAX, `连续相同 ${c.metric} 行，没触到阈值 ${CODE_RUN_MAX}`);
      const verbatim = checkCodeSimilarity([{ name: 'bee.js', text: REF_CODE }], [{ name: 'bee.js', text: REF_CODE }]);
      assert.strictEqual(verbatim.status, STATUS.FAIL);
    },
  },
  {
    name: '⑱ 主体代码只有零散相同行（连续 < 6）→ 通过',
    run: () => {
      const c = checkCodeSimilarity([{ name: 'harbour.js', text: SCATTER_CODE }], [{ name: 'bee.js', text: REF_CODE }]);
      assert.strictEqual(c.status, STATUS.PASS, c.detail);
      assert.ok(c.metric < CODE_RUN_MAX, `连续相同 ${c.metric} 行`);
      assert.strictEqual(checkCodeSimilarity([{ name: 'coffee.js', text: NEW_CODE }], [{ name: 'bee.js', text: REF_CODE }]).status, STATUS.PASS);
    },
  },
  {
    name: '⑲ 主体代码相似度：缺素材 → unknown（不放行）',
    run: () => {
      assert.strictEqual(checkCodeSimilarity([], [{ name: 'bee.js', text: REF_CODE }]).status, STATUS.UNKNOWN);
      assert.strictEqual(checkCodeSimilarity([{ name: 'a.js', text: NEW_CODE }], []).status, STATUS.UNKNOWN);
    },
  },
  {
    name: '⑳ region / focus 键名集合完全相同 → 判失败；不同 → 通过',
    run: () => {
      const same = checkSubjectKeys([{ name: 'bee.js', text: REF_CODE }], [{ name: 'bee.js', text: REF_CODE }]);
      assert.strictEqual(same.status, STATUS.FAIL, same.detail);
      assert.ok(same.metric >= 2, 'region 与 focus 都该命中');
      const diff = checkSubjectKeys([{ name: 'coffee.js', text: NEW_CODE }], [{ name: 'bee.js', text: REF_CODE }]);
      assert.strictEqual(diff.status, STATUS.PASS, diff.detail);
      assert.deepStrictEqual(extractRegionKeys(REF_CODE), ['abdomen', 'eyes', 'head', 'legs', 'pollen', 'thorax', 'wings']);
      assert.deepStrictEqual(extractFocusKeys(REF_CODE), ['corbicula', 'eye', 'hamuli']);
      assert.deepStrictEqual(extractRegionKeys(NEW_CODE), ['cherry', 'leaf', 'soil']);
      assert.deepStrictEqual(objectLiteralKeys('const a = { x: 1, y: { z: 2 }, w: 3 };', 'a'), ['x', 'y', 'w']);
    },
  },
  {
    name: '㉑ 时间线事件类型序列与示例完全相同 → 判失败（「换 content.json 重跑」的指纹）',
    run: () => {
      const c = checkTimeline(REF_EV, REF_EV);
      assert.strictEqual(c.status, STATUS.FAIL, c.detail);
      assert.strictEqual(c.metric, 1);
      const seq = eventTypeSequence(REF_EV);
      assert.deepStrictEqual(seq, ['burin', 'lift', 'press', 'peel', 'hatch', 'title', 'vo', 'push', 'ring', 'drop', 'landing']);
    },
  },
  {
    name: '㉒ 时间线不同 → 通过；缺 events.json → unknown',
    run: () => {
      assert.strictEqual(checkTimeline(NEW_EV, REF_EV).status, STATUS.PASS);
      assert.strictEqual(checkTimeline(null, REF_EV).status, STATUS.UNKNOWN);
      assert.strictEqual(checkTimeline(evSeq([]), REF_EV).status, STATUS.UNKNOWN);
      assert.strictEqual(checkTimeline(evSeq([]), REF_EV).ok, false, 'unknown 不许 ok');
    },
  },
  {
    name: '㉓ 时间线：只有极少数事件不同、LCS 占比 ≥ 阈值 → 仍判失败（近亲时间线）',
    run: () => {
      const near = evSeq([...eventTypeSequence(REF_EV).slice(0, 10), 'brandnew']);
      const c = checkTimeline(near, REF_EV);
      assert.ok(c.metric >= TIMELINE_LCS_RATIO_MAX, `LCS 占比 ${c.metric} 低于阈值 ${TIMELINE_LCS_RATIO_MAX}，用例前提不成立`);
      assert.strictEqual(c.status, STATUS.FAIL, c.detail);
      // 阈值调紧后，原本通过的也应变失败
      const looser = checkTimeline(evSeq(['a', 'b', 'vo', 'c', 'd']), evSeq(['a', 'b', 'x', 'c', 'd']), { maxRatio: 0.4 });
      assert.strictEqual(looser.status, STATUS.FAIL, '调紧阈值后应判失败');
    },
  },
  {
    name: '㉔ 阈值敏感性：n-gram 阈值调小 → 原本通过的样本变失败',
    run: () => {
      const refLine = { voice: { lines: [{ id: 'x', text: 'alpha beta gamma delta epsilon zeta' }] } };
      const newLine = { voice: { lines: [{ id: 'x', text: 'one two alpha beta gamma delta omega' }] } };
      const before = checkTextOriginality(voiceUnits(newLine), voiceUnits(refLine));
      assert.strictEqual(before[0].status, STATUS.PASS, `前提不成立：${before[0].detail}`);
      assert.strictEqual(before[0].metric, 4);
      const after = checkTextOriginality(voiceUnits(newLine), voiceUnits(refLine), { ngramMax: 4 });
      assert.strictEqual(after[0].status, STATUS.FAIL, '把 ngramMax 调到 4 后应判失败 —— 阈值没在起作用');
    },
  },
  {
    name: '㉕ 阈值敏感性：实词重合率阈值调小 → 原本通过的样本变失败',
    run: () => {
      const refLine = { voice: { lines: [{ id: 'x', text: 'alpha beta gamma delta epsilon zeta eta theta' }] } };
      const newLine = { voice: { lines: [{ id: 'x', text: 'alpha beta gamma delta iota kappa lambda mu' }] } };
      const before = checkTextOriginality(voiceUnits(newLine), voiceUnits(refLine));
      assert.strictEqual(before[1].status, STATUS.PASS, `前提不成立：${before[1].detail}`);
      assert.strictEqual(before[1].metric, 0.5);
      const after = checkTextOriginality(voiceUnits(newLine), voiceUnits(refLine), { overlapMax: 0.5 });
      assert.strictEqual(after[1].status, STATUS.FAIL, '把 overlapMax 调到 0.5 后应判失败');
    },
  },
  {
    name: '㉖ 阈值敏感性：代码连续行阈值调小 → 原本通过的样本变失败',
    run: () => {
      const four = 'a\nb\nc\nd\ne\n';
      const newFour = 'z\na\nb\nc\nd\ny\n';
      assert.strictEqual(checkCodeSimilarity([{ name: 'n.js', text: newFour }], [{ name: 'r.js', text: four }]).status, STATUS.PASS);
      assert.strictEqual(checkCodeSimilarity([{ name: 'n.js', text: newFour }], [{ name: 'r.js', text: four }], { maxRun: 4 }).status, STATUS.FAIL);
    },
  },
  {
    name: '㉗ 阈值常量本身可读且自洽（导出、冻结、值合理）',
    run: () => {
      assert.ok(Object.isFrozen(THRESHOLDS), 'THRESHOLDS 应被冻结，防止运行期被悄悄改');
      assert.strictEqual(THRESHOLDS.NARRATION_NGRAM_MAX, NARRATION_NGRAM_MAX);
      assert.strictEqual(THRESHOLDS.CODE_RUN_MAX, CODE_RUN_MAX);
      assert.ok(NARRATION_NGRAM_MAX >= 2 && NARRATION_NGRAM_MAX <= 10);
      assert.ok(NARRATION_OVERLAP_MAX > 0 && NARRATION_OVERLAP_MAX < 1);
      assert.ok(CODE_RUN_MAX >= 3);
      assert.ok(TIMELINE_LCS_RATIO_MAX > 0 && TIMELINE_LCS_RATIO_MAX <= 1);
      assert.strictEqual(THRESHOLDS.COLORS_IDENTICAL_ALLOWED, false);
      assert.strictEqual(THRESHOLDS.END_CARD_IDENTICAL_ALLOWED, false);
    },
  },
  {
    name: '㉘ 汇总：真·咖啡片（缺时间线）→ 文本/主体/配色全通过，但 timeline 判 unknown，总结论不通过',
    run: () => {
      const rep = auditAll({ newContent: NEW, refContent: REF, newFiles: [{ name: 'coffee.js', text: NEW_CODE }], refFiles: [{ name: 'bee.js', text: REF_CODE }], newEvents: null, refEvents: REF_EV });
      assert.strictEqual(rep.summary.fail, 0, `不该有 fail：${rep.checks.filter((c) => c.status === STATUS.FAIL).map((c) => `${c.id}:${c.detail}`).join(' | ')}`);
      assert.strictEqual(byId(rep.checks, 'timeline.order').status, STATUS.UNKNOWN);
      assert.strictEqual(rep.summary.ok, false, '有 unknown 时总结论必须不通过');
      assert.ok(rep.summary.total >= 9, `检查条数只有 ${rep.summary.total}`);
    },
  },
  {
    name: '㉙ 汇总：整套照抄示例 → 大量 fail，总结论不通过',
    run: () => {
      const rep = auditAll({ newContent: REF, refContent: REF, newFiles: [{ name: 'bee.js', text: REF_CODE }], refFiles: [{ name: 'bee.js', text: REF_CODE }], newEvents: REF_EV, refEvents: REF_EV });
      assert.strictEqual(rep.summary.fail, rep.summary.total, `应全部失败，实得 ${rep.summary.fail}/${rep.summary.total}`);
      assert.strictEqual(rep.summary.ok, false);
    },
  },
  {
    name: '㉚ 纯函数性：同样输入跑两次，结果完全一致（报告可复现）',
    run: () => {
      const mk = () => auditAll({ newContent: NEW, refContent: REF, newFiles: [{ name: 'coffee.js', text: NEW_CODE }], refFiles: [{ name: 'bee.js', text: REF_CODE }], newEvents: NEW_EV, refEvents: REF_EV });
      const a = mk(), b = mk();
      const strip = (r) => JSON.stringify({ ...r, generatedAt: null });
      assert.strictEqual(strip(a), strip(b));
      assert.strictEqual(a.summary.ok, true, `这套素材应全部通过：${a.checks.filter((c) => c.status !== STATUS.PASS).map((c) => `${c.id}:${c.detail}`).join(' | ')}`);
    },
  },
  {
    name: '㉛ 报告：renderMarkdown 出的是能直接给人看的 md（含逐条结论、证据、人工复核清单）',
    run: () => {
      const rep = auditAll({ newContent: NEW, refContent: REF, newFiles: [{ name: 'coffee.js', text: NEW_CODE }], refFiles: [{ name: 'bee.js', text: REF_CODE }], newEvents: NEW_EV, refEvents: REF_EV });
      const md = renderMarkdown(rep);
      assert.match(md, /# 原创性审计报告/);
      assert.match(md, /## 汇总/);
      assert.match(md, /## 逐条证据/);
      assert.match(md, /## 本工具判不了、必须人工看的维度/);
      assert.match(md, /时间线（两份事件序列，供人工比对）/);
      assert.ok(md.includes('Coffea arabica'), 'md 里应出现新片的真实素材');
      assert.ok(md.split('\n').length > 40, 'md 太短，可能没渲染全');
    },
  },
  {
    name: '㉜ textUnits / infoSequence 抽取正确（旁白与图版文字分开）',
    run: () => {
      const u = textUnits(NEW);
      assert.ok(u.every((x) => x.path && x.text));
      assert.strictEqual(voiceUnits(NEW).length, 9);
      assert.ok(plateUnits(NEW).some((x) => x.path === 'details[0].note'));
      assert.ok(!plateUnits(NEW).some((x) => x.path.startsWith('voice.')));
      // credits 不进 n-gram 比对池（工具署名允许共用），但收尾检查会整表比对
      assert.ok(!u.some((x) => x.path.startsWith('end.credits')));
      assert.ok(infoSequence(NEW).includes('title:The Coffee Plant'));
      assert.ok(infoSequence(NEW).includes('detail1:flower'));
      assert.ok(infoSequence(NEW).some((x) => x.endsWith('[section]')));
    },
  },
  {
    name: '㉝ CLI 端到端：真·原创 → 退出码 0，产物齐全；整套照抄 → 退出码 1',
    run: async () => {
      const tmp = fs.mkdtempSync(path.join(TMP_ROOT, 'lemo-orig-'));
      try {
        const mk = (name, content, code, events) => {
          const d = path.join(tmp, name);
          fs.mkdirSync(path.join(d, 'subjects'), { recursive: true });
          fs.writeFileSync(path.join(d, 'content.json'), JSON.stringify(content, null, 2));
          fs.writeFileSync(path.join(d, 'subjects', name === 'ref' ? 'bee.js' : 'coffee.js'), code);
          fs.writeFileSync(path.join(d, 'events.json'), JSON.stringify(events));
          return d;
        };
        const refDir = mk('ref', REF, REF_CODE, REF_EV);
        const newDir = mk('new', NEW, NEW_CODE, NEW_EV);
        const copyDir = mk('copy', REF, REF_CODE, REF_EV);
        const outDir = path.join(tmp, 'out');

        const args = (nd, rd, od) => ['originality-audit.mjs',
          '--new-content', path.join(nd, 'content.json'), '--new-subjects', path.join(nd, 'subjects'),
          '--ref-content', path.join(rd, 'content.json'), '--ref-subjects', path.join(rd, 'subjects'),
          '--out', od];

        const okRun = await runNode(args(newDir, refDir, outDir));
        assert.strictEqual(okRun.code, 0, `原创片退出码 ${okRun.code}\n${okRun.stdout}\n${okRun.stderr}`);
        for (const f of ['originality.json', 'originality.md']) {
          assert.ok(fs.existsSync(path.join(outDir, f)), `没有产出 ${f}`);
          assert.ok(fs.statSync(path.join(outDir, f)).size > 200, `${f} 太小`);
        }
        const parsed = JSON.parse(fs.readFileSync(path.join(outDir, 'originality.json'), 'utf8'));
        assert.strictEqual(parsed.summary.ok, true);
        assert.ok(parsed.checks.length >= 9);

        const copyRun = await runNode(args(copyDir, refDir, path.join(tmp, 'out2')));
        assert.strictEqual(copyRun.code, 1, `照抄片应退出 1，实得 ${copyRun.code}\n${copyRun.stdout}`);

        // 缺素材：新片 subjects 目录不存在 → unknown → 退出 1（不许默认通过）
        const bareDir = path.join(tmp, 'bare');
        fs.mkdirSync(bareDir, { recursive: true });
        fs.writeFileSync(path.join(bareDir, 'content.json'), JSON.stringify(NEW, null, 2));
        const bareRun = await runNode(['originality-audit.mjs',
          '--new-content', path.join(bareDir, 'content.json'), '--new-subjects', path.join(bareDir, 'subjects'),
          '--ref-content', path.join(refDir, 'content.json'), '--ref-subjects', path.join(refDir, 'subjects'),
          '--out', path.join(tmp, 'out3')]);
        assert.strictEqual(bareRun.code, 1, `缺素材应退出 1，实得 ${bareRun.code}`);
        const bareJson = JSON.parse(fs.readFileSync(path.join(tmp, 'out3', 'originality.json'), 'utf8'));
        assert.ok(bareJson.summary.unknown >= 2, `缺素材时 unknown 太少：${bareJson.summary.unknown}`);
        assert.strictEqual(bareJson.summary.ok, false);

        // 用法错误 → 退出 2
        const badRun = await runNode(['originality-audit.mjs', '--new-content', 'x.json']);
        assert.strictEqual(badRun.code, 2, `用法错误应退出 2，实得 ${badRun.code}`);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  },
  {
    name: '㉞ 真库素材回归：咖啡片 vs 库自带 demo，文本/身份/配色/收尾应通过',
    run: () => {
      const demo = path.resolve(ROOT, '..', 'lemo-opuscar', 'styles', 'engraving', 'demo');
      const refPath = path.join(demo, 'content.json');
      const newPath = path.join(demo, 'content_coffee.json');
      assert.ok(fs.existsSync(refPath), `示例素材不存在：${refPath}`);
      assert.ok(fs.existsSync(newPath), `咖啡素材不存在：${newPath}`);
      const refC = JSON.parse(fs.readFileSync(refPath, 'utf8'));
      const newC = JSON.parse(fs.readFileSync(newPath, 'utf8'));
      const checks = allChecks({ newContent: newC, refContent: refC, newFiles: [], refFiles: [], newEvents: null, refEvents: null });
      for (const id of ['text.voice.ngram', 'text.voice.overlap', 'text.plate.ngram', 'text.plate.overlap', 'details.naming', 'identity', 'colors.regions', 'end.card']) {
        assert.strictEqual(byId(checks, id).status, STATUS.PASS, `${id} 未通过：${byId(checks, id).detail}`);
      }
      assert.strictEqual(byId(checks, 'subjects.code').status, STATUS.UNKNOWN, '没给主体模块时应判 unknown');
      assert.strictEqual(byId(checks, 'timeline.order').status, STATUS.UNKNOWN, '没给时间线时应判 unknown');
    },
  },

  // ── 中文口径（见 lib/originality.mjs 的设计原则 4）─────────────
  {
    name: '㉟ 中文新片 vs 中文示例（各自独立写作）→ 通过',
    run: () => {
      const [ng, ov] = checkTextOriginality(voiceUnits(NEW_ZH), voiceUnits(REF_ZH));
      assert.strictEqual(ng.status, STATUS.PASS, ng.detail);
      assert.strictEqual(ov.status, STATUS.PASS, ov.detail);
    },
  },
  {
    name: '㊱ 中文旁白 vs 示例**英文**旁白（跨语言）→ 通过，且重合率为 0',
    run: () => {
      const [ng, ov] = checkTextOriginality(voiceUnits(NEW_ZH), voiceUnits(REF));
      assert.strictEqual(ng.status, STATUS.PASS, ng.detail);
      assert.strictEqual(ov.status, STATUS.PASS, ov.detail);
      assert.strictEqual(ov.metric, 0, `跨语言不该有字符重合，实得 ${ov.metric}`);
      // ★ 回归：指标恒为 0 时，报告**仍然**必须按中文口径描述（曾经这里会退回拉丁的「词 / 60%」）
      assert.ok(ng.title.includes('字串'), `标题应按中文口径：${ng.title}`);
      assert.ok(ng.detail.includes('字串'), `detail 应按中文口径：${ng.detail}`);
      assert.strictEqual(ng.threshold, NARRATION_NGRAM_MAX_CJK, `中文判据的阈值应是中文的：${ng.threshold}`);
      assert.ok(ov.title.includes('字符集合'), `标题应写明「字符集合」：${ov.title}`);
      assert.ok(ov.detail.includes('字符集合'), `detail 应写明口径：${ov.detail}`);
      assert.strictEqual(ov.threshold, NARRATION_OVERLAP_MAX_CJK, `中文判据的阈值应是中文的：${ov.threshold}`);
    },
  },
  {
    name: '㊲ 英文旁白逐句机翻成中文 → 不判抄（翻译不是套模板）',
    run: () => {
      // REF_ZH 就是把示例英文旁白逐句机翻过来的结果；它对着示例英文判，不能算抄
      const [ng, ov] = checkTextOriginality(voiceUnits(REF_ZH), voiceUnits(REF));
      assert.strictEqual(ng.status, STATUS.PASS, `机翻被判抄了：${ng.detail}`);
      assert.strictEqual(ov.status, STATUS.PASS, `机翻被判抄了：${ov.detail}`);
      // 但同一段中文对着**同一段中文**必须判失败 —— 否则上面那条 PASS 就是假绿
      const [ng2] = checkTextOriginality(voiceUnits(REF_ZH), voiceUnits(REF_ZH));
      assert.strictEqual(ng2.status, STATUS.FAIL, '中文照抄中文竟然通过，说明中文判据整体失效');
    },
  },
  {
    name: '㊳ 把**中文**示例旁白改几个字 → 必须判失败',
    run: () => {
      const [ng, ov] = checkTextOriginality(voiceUnits(REF_ZH_TWEAKED), voiceUnits(REF_ZH));
      assert.ok(ng.status === STATUS.FAIL || ov.status === STATUS.FAIL,
        `中文「改几个字」竟然通过了：ngram=${ng.status}/${ng.metric}，overlap=${ov.status}/${ov.metric}`);
      assert.strictEqual(ng.status, STATUS.FAIL, `连续相同的中文字串没被 n-gram 抓到：${ng.detail}`);
      assert.ok(ng.evidence.some((e) => e.includes('连续') && e.includes('字')),
        `证据里应写明「连续 N 字」：${JSON.stringify(ng.evidence)}`);
    },
  },
  {
    name: '㊴ 中文口径必须写进标题与 detail（不能让人以为还是「实词重合率」）',
    run: () => {
      const [ng, ov] = checkTextOriginality(voiceUnits(NEW_ZH), voiceUnits(REF_ZH));
      assert.ok(ng.title.includes('字串'), `中文 n-gram 标题应说明按「字」：${ng.title}`);
      assert.ok(ov.title.includes('字符集合'), `中文重合率标题应写明「字符集合」：${ov.title}`);
      assert.ok(!ov.title.includes('实词'), `中文不能沿用拉丁的实词口径标题：${ov.title}`);
      assert.ok(ov.detail.includes('字符集合') && ov.detail.includes('不是'), `detail 要写清口径换了什么：${ov.detail}`);
      assert.strictEqual(ov.threshold, NARRATION_OVERLAP_MAX_CJK, '中文应使用中文专用阈值');
      // 拉丁样本不能被带偏，仍是实词口径
      const [ngEn, ovEn] = checkTextOriginality(voiceUnits(NEW), voiceUnits(REF));
      assert.ok(ovEn.title.includes('实词'), `拉丁样本应仍是实词口径：${ovEn.title}`);
      assert.strictEqual(ovEn.threshold, NARRATION_OVERLAP_MAX, '拉丁样本应使用拉丁阈值');
    },
  },
  {
    name: '㊵ 假阳性回归：同题材但各自独立写作的中文 → 必须通过（拉丁的 0.6 会误判）',
    run: () => {
      const a = { voice: { lines: [{ id: 'x', text: '十五世纪的也门已经在喝它，唯一的门是摩卡港。' }] } };
      const b = { voice: { lines: [{ id: 'y', text: '也门的摩卡港曾是唯一的出口，十五世纪时商队由此北上。' }] } };
      const [, ov] = checkTextOriginality(voiceUnits(a), voiceUnits(b));
      assert.strictEqual(ov.status, STATUS.PASS, `同题材独立写作被误判成抄：${ov.detail}`);
      assert.ok(ov.metric > NARRATION_OVERLAP_MAX,
        `这条用例的前提是字符重合确实高于拉丁阈值 0.6（实得 ${ov.metric}）`);
      assert.strictEqual(ov.threshold, NARRATION_OVERLAP_MAX_CJK, '应使用放宽后的中文字符集合阈值');
      // 阈值敏感性：压回拉丁的 0.6，同一条样本必须翻成失败 —— 证明 0.75 真的在起作用
      const [, ov2] = checkTextOriginality(voiceUnits(a), voiceUnits(b), { overlapMaxCJK: NARRATION_OVERLAP_MAX });
      assert.strictEqual(ov2.status, STATUS.FAIL, '把中文阈值压到 0.6 后本应误判，说明这条用例没有区分力');
    },
  },
  {
    name: '㊶ 中文边界：纯标点 / 单字 / 中英混排 → 不抛错且判得对',
    run: () => {
      // 纯标点：tokenize 后为空 ⇒ 没有可比 token，判 unknown 而不是放行
      const punct = { voice: { lines: [{ id: 'p', text: '，。、；：？！——……' }] } };
      assert.deepStrictEqual(tokenize('，。、；：？！——……'), [], '中文标点必须全是分隔符，不能变成 token');
      const [ngP] = checkTextOriginality(voiceUnits(punct), voiceUnits(REF_ZH));
      assert.strictEqual(ngP.status, STATUS.UNKNOWN, '纯标点没有可比 token，应判 unknown');
      // 单字：太短，n-gram 抓不到、重合率也被 minTokens 挡掉 ⇒ 不误判
      const one = { voice: { lines: [{ id: 'c', text: '咖' }] } };
      const [ng1, ov1] = checkTextOriginality(voiceUnits(one), voiceUnits(REF_ZH));
      assert.strictEqual(ng1.status, STATUS.PASS, ng1.detail);
      assert.strictEqual(ov1.status, STATUS.PASS, ov1.detail);
      // 中英混排：汉字逐字 + 拉丁按词，一个 token 都不能丢
      const mix = '配音 · Kokoro 本地合成';
      assert.ok(hasCJK(mix), '含汉字的混排应判为中文口径');
      assert.deepStrictEqual(overlapTokens(mix), ['配', '音', 'kokoro', '本', '地', '合', '成']);
      // 中文口径**不去功能词**：拉丁的 STOPWORDS 在中文口径下不生效（否则就不是「字符集合」了）
      const mixedStop = 'A study of the 蜜蜂';
      assert.deepStrictEqual(overlapTokens(mixedStop), ['a', 'study', 'of', 'the', '蜜', '蜂']);
      assert.deepStrictEqual(contentTokens(mixedStop), ['study', '蜜', '蜂'], '拉丁口径仍应去功能词');
      // 混排里连续相同的拉丁词串 + 中文字串，都要被抓到
      const copied = { voice: { lines: [{ id: 'm', text: 'Coffea arabica，学名是阿拉比卡咖啡。' }] } };
      const refMix = { voice: { lines: [{ id: 'r', text: 'Coffea arabica 的学名是阿拉比卡咖啡。' }] } };
      const [ngM] = checkTextOriginality(voiceUnits(copied), voiceUnits(refMix));
      assert.strictEqual(ngM.status, STATUS.FAIL, `混排里连续相同的字串没被抓到：${ngM.detail}`);
      assert.ok(ngM.metric >= NARRATION_NGRAM_MAX_CJK, `混排指标 ${ngM.metric} 没触到中文阈值`);
    },
  },
  {
    name: '㊷ 阈值敏感性：中文 n-gram 阈值调紧 → 原本通过的中文样本变失败',
    run: () => {
      const [ng] = checkTextOriginality(voiceUnits(NEW_ZH), voiceUnits(REF_ZH));
      assert.strictEqual(ng.status, STATUS.PASS, `前提不成立：${ng.detail}`);
      assert.ok(ng.metric > 0 && ng.metric < NARRATION_NGRAM_MAX_CJK,
        `前提：最长公共连续字串应落在 0 与阈值之间（实得 ${ng.metric}）`);
      const [tight] = checkTextOriginality(voiceUnits(NEW_ZH), voiceUnits(REF_ZH), { ngramMaxCJK: 2 });
      assert.strictEqual(tight.status, STATUS.FAIL, '把中文 n-gram 阈值压到 2 后应变失败');
    },
  },
];

// ── 子进程工具（照 setup.test.mjs 的写法）──────────────────────
function runNode(args, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT, windowsHide: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    let stdout = '', stderr = '', done = false;
    const timer = setTimeout(() => {
      if (done) return; done = true;
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error(`子进程超时：node ${args.join(' ')}`));
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); reject(e); });
    child.on('close', (code) => { if (done) return; done = true; clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

// ── 主流程 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.b('lemo 原创性审计器 · 纯逻辑测试'));
  log(C.dim(`  项目 ${ROOT}`));
  log(C.dim(`  用例 ${CASES.length} 条 · 全部不需要网络 / 浏览器 / 真影片`));
  log('');

  const results = [];
  for (const c of CASES) {
    const s = Date.now();
    try {
      await c.run();
      results.push({ name: c.name, ok: true });
      log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
    } catch (e) {
      results.push({ name: c.name, ok: false, err: e });
      log(`  ${C.bad('FAIL')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
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
