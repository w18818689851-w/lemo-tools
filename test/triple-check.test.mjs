#!/usr/bin/env node
/**
 * test/triple-check.test.mjs —— `lib/triple-check.mjs` 的**纯逻辑**测试（零依赖）
 *
 * ★ 为什么必须有这一份（2026-10-04 补）：
 *   `lib/triple-check.mjs` 是「画面 / 字幕文本 / 原文案语义 三者是否一致」的校验门，
 *   是**全项目唯一允许调用本地 7B 视觉模型**（qwen2.5-vl-7b-official）的地方，557 行、
 *   承担核心判定 —— 但此前**一条测试都没有**。
 *   它的对外契约里有两条是硬要求，必须用测试钉死，否则某次重构就能悄悄毁掉：
 *     ① **模型负责读字、代码负责下结论**：一致 / 不一致 / 存疑**只能**由本文件的确定性
 *        字符串比对得出，模型自报的 frame_verdict **绝不能**参与 verdict（实测 temp=0 下它会
 *        确定性误报）；模型没读出字时**必须**判「存疑」，**绝不**能兜底成「一致」。
 *     ② **解析模型回复绝不抛**：模型回复脏（非 JSON / 夹废话 / 类型错）时只能优雅降级。
 *
 * ★ 本测试**只 import 纯函数**，不碰 run / runWsl / fetch / ffmpeg / 显存：
 *   `triple-check.mjs` 的 `main()` 有 `process.argv[1] === import.meta.url` 守卫，import 时不会执行，
 *   所以引入它不会加载 7B、不会起服务、不会读成片。零依赖、零文件写入、零网络、零 WSL、零 GPU。
 *
 * 用法：node test/triple-check.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';

import {
  buildPrompt, parseVerdict, sampleTimes, nearestCueText, decide,
} from '../lib/triple-check.mjs';

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

const J = (x) => JSON.stringify(x);

// ── ① parseVerdict：容错解析模型回复 ─────────────────────────
test('parseVerdict：干净 JSON / ```json 代码块 / 前后废话，都能抠出 image_text', () => {
  assert.equal(parseVerdict('{"image_text":"你好"}').imageText, '你好', '干净 JSON');
  assert.equal(parseVerdict('```json\n{"image_text":"你好"}\n```').imageText, '你好', '代码块包裹');
  assert.equal(parseVerdict('好的，结果如下：{"image_text":"你好"}').imageText, '你好', '前置废话');
});

test('★ parseVerdict：完全不是 JSON ⇒ 兜底对象，reason 有前缀，绝不抛', () => {
  const r = parseVerdict('我不知道');
  assert.equal(r.modelVerdict, null, '解析不了 ⇒ modelVerdict 必须 null');
  assert.equal(r.imageText, '', '解析不了 ⇒ imageText 必须空串');
  assert.ok(r.reason.startsWith('模型未返回可解析 JSON：'), `reason 应以固定前缀开头，实得：${r.reason}`);
  assert.ok(r.reason.includes('我不知道'), 'reason 应把原文带上（便于回溯模型说了啥）');
});

test('parseVerdict：入参 null / undefined / 空串 ⇒ 不抛（返回兜底对象）', () => {
  for (const bad of [null, undefined, '']) {
    const r = parseVerdict(bad);
    assert.equal(r.modelVerdict, null);
    assert.equal(r.imageText, '');
    assert.ok(r.reason.startsWith('模型未返回可解析 JSON：'), `入参 ${J(bad)} 应走兜底`);
  }
});

test('★ parseVerdict：frame_verdict 非法值 ⇒ modelVerdict 必须 null（不得原样透传）', () => {
  // 模型偶尔会自造词（"差不多" / "match" …）。原样透传会把脏值带进报告 JSON。
  assert.equal(parseVerdict('{"frame_verdict":"差不多","image_text":"x"}').modelVerdict, null);
  assert.equal(parseVerdict('{"frame_verdict":true,"image_text":"x"}').modelVerdict, null);
  assert.equal(parseVerdict('{"frame_verdict":null,"image_text":"x"}').modelVerdict, null);
  assert.equal(parseVerdict('{"image_text":"x"}').modelVerdict, null, '缺字段也必须 null');
  // 合法值才保留（供回溯）
  assert.equal(parseVerdict('{"frame_verdict":"不一致","image_text":"x"}').modelVerdict, '不一致');
});

test('parseVerdict：image_text 非字符串（数字 / null / 缺字段）⇒ 一律空串', () => {
  assert.equal(parseVerdict('{"image_text":123}').imageText, '');
  assert.equal(parseVerdict('{"image_text":null}').imageText, '');
  assert.equal(parseVerdict('{"image_text":{}}').imageText, '');
  assert.equal(parseVerdict('{}').imageText, '');
});

// ★ 这条是「先探明真实行为再断言」的产物：任务书怀疑「JSON 里某个字符串值含 }」会被
//   indexOf('{')+lastIndexOf('}') 截坏 —— **实测不会**：真实闭合的 `}` 永远在该值之后，
//   lastIndexOf 取到的仍是它，所以 `{"image_text":"前}后"}` 解析完全正确。
//   真正会翻车的是另外三种：① 两个 JSON 对象；② 前言里混进一个 `{`；③ 对象之后又有 `}`。
//   这里把**真实行为**钉下来（而不是我以为的行为），免得后人照着错的直觉去"修"。
test('★ parseVerdict：字符串值含 `}` 是安全的；真会翻车的是多对象 / 前言混 `{` / 尾部多余 `}`', () => {
  // 安全：值里含 `}`，解析正常
  assert.equal(parseVerdict('{"image_text":"前}后"}').imageText, '前}后', '值含 } 应安全');
  assert.equal(parseVerdict('{"image_text":"a}b"} 尾巴').imageText, 'a}b', '对象后跟无括号废话也应安全');
  assert.equal(parseVerdict('{"image_text":"a{b"}').imageText, 'a{b', '值含 { 也应安全');
  // 翻车：取到的子串不是合法 JSON ⇒ 走兜底（不抛），这是**已知的宽容代价**，不是 bug 修复点
  assert.equal(parseVerdict('{"a":1}{"image_text":"二"}').imageText, '', '两个对象 ⇒ 取子串失败 ⇒ 兜底');
  assert.equal(parseVerdict('{提示} {"image_text":"x"}').imageText, '', '前言混 { ⇒ 子串从错位置起 ⇒ 兜底');
  assert.equal(parseVerdict('{"image_text":"a}b"} 结果如下 }').imageText, '', '尾部多余 } ⇒ 子串被拉长 ⇒ 兜底');
});

// ── ② sampleTimes：抽帧计划 ─────────────────────────────────
const CUE = (start, end, text = 'x') => ({ start, end, text });

test('sampleTimes：每个 cue 取中点；filmDur 为假（0/null）时只出 cue 帧', () => {
  const cues = [CUE(0, 2), CUE(2, 4)];
  assert.deepEqual(sampleTimes({ cues, filmDur: 0, maxFrames: 8 }).map((p) => p.t), [1, 3]);
  assert.deepEqual(sampleTimes({ cues, filmDur: null, maxFrames: 8 }).map((p) => p.t), [1, 3],
    'filmDur 为 null 时同样不该塞首/中/尾');
  assert.deepEqual(sampleTimes({ cues, filmDur: 10, maxFrames: 8 }).map((p) => p.t), [0.15, 1, 3],
    'filmDur=10 时 0.15 落在 cue[0,2] 窗内 ⇒ 应作为 head 纳入');
});

test('sampleTimes：两个时刻相差 < 0.25s 只留一个（去重）', () => {
  // 中点 0.1 与 0.4 相差 0.3 > 0.25 ⇒ 都留；再补一对 0.9 / 1.0 相差 0.1 ⇒ 只留前者
  const cues = [CUE(0, 0.2), CUE(0.3, 0.5), CUE(0.8, 1.0), CUE(0.9, 1.1)];
  const ts = sampleTimes({ cues, filmDur: 0, maxFrames: 8 }).map((p) => p.t);
  assert.deepEqual(ts, [0.1, 0.4, 0.9], '相差 <0.25 的 0.9/1.0 应合并');
});

test('★ sampleTimes：片头 0.15 / 中点 / 片尾 dur-0.3 只有**正好落在字幕窗内**才纳入', () => {
  // 这是「避免在无字幕帧上误报」的刻意设计：整片 10s，但字幕窗只覆盖局部时，
  // 落在窗外的首/中/尾时刻**必须被丢弃**，否则会拿一帧无字幕画面去误报「画面上没字幕」。
  const onlyTail = sampleTimes({ cues: [CUE(6, 10)], filmDur: 10, maxFrames: 8 });
  assert.deepEqual(onlyTail.map((p) => p.t), [8, 9.7], '中点在窗外 ⇒ 丢；尾 9.7 在窗内 ⇒ 留');
  assert.equal(onlyTail[1].why, 'tail', 'why 应标 tail');

  const onlyHead = sampleTimes({ cues: [CUE(0.1, 4)], filmDur: 10, maxFrames: 8 });
  assert.deepEqual(onlyHead.map((p) => p.t), [0.15, 2.05], '头 0.15 在窗内 ⇒ 留；中点 5 在窗外 ⇒ 丢');
  assert.equal(onlyHead[0].why, 'head', 'why 应标 head');

  const onlyMid = sampleTimes({ cues: [CUE(4.5, 5.5)], filmDur: 10, maxFrames: 8 });
  assert.deepEqual(onlyMid.map((p) => p.t), [5], '头/尾都在窗外 ⇒ 只剩中点（与 cue 中点重合）');
});

test('sampleTimes：超出片长（t > dur-0.05）与负时刻被丢弃', () => {
  // cue 中点 9.96 > 10-0.05 ⇒ 丢；负时刻（start+end<0）⇒ 丢
  assert.deepEqual(sampleTimes({ cues: [CUE(9.92, 10.0)], filmDur: 10, maxFrames: 8 }), [],
    '中点 9.96 超出 dur-0.05=9.95 ⇒ 丢弃');
  assert.deepEqual(sampleTimes({ cues: [CUE(-2, -1)], filmDur: 10, maxFrames: 8 }), [], '负时刻 ⇒ 丢弃');
  // ★ 边界：判定是严格 `>`，所以 9.95 本身**保留**、9.94 也保留（只丢 > 9.95 的）
  assert.deepEqual(sampleTimes({ cues: [CUE(9.9, 10.0)], filmDur: 10, maxFrames: 8 }).map((p) => p.t), [9.95],
    '恰好 9.95 不满足严格 > ⇒ 保留（边界含）');
  assert.deepEqual(sampleTimes({ cues: [CUE(9.8, 10.0)], filmDur: 10, maxFrames: 8 }).map((p) => p.t), [9.9]);
});

test('★ sampleTimes：picks 超 maxFrames 时降采样到**恰好 maxFrames** 个，且首尾保留', () => {
  const many = Array.from({ length: 20 }, (_, i) => CUE(i, i + 0.4));
  const ds = sampleTimes({ cues: many, filmDur: 0, maxFrames: 5 });
  assert.equal(ds.length, 5, '必须恰好 5 个');
  const all = sampleTimes({ cues: many, filmDur: 0, maxFrames: 100 });
  assert.equal(ds[0].t, all[0].t, '首个必须是原首帧');
  assert.equal(ds[ds.length - 1].t, all[all.length - 1].t, '末个必须是原末帧');
  // 时刻单调递增
  for (let i = 1; i < ds.length; i++) assert.ok(ds[i].t > ds[i - 1].t, '降采样后仍须递增');
});

test('sampleTimes：cues 为空 ⇒ 返回空数组（不抛）', () => {
  assert.deepEqual(sampleTimes({ cues: [], filmDur: 10, maxFrames: 8 }), []);
});

// ★ 已修 bug（原：maxFrames=1 时 step=(n-1)/(1-1)=Infinity ⇒ round(0*Infinity)=NaN ⇒ picks[NaN]=undefined）。
//   修法见 lib/triple-check.mjs 里 `if (maxFrames === 1) …`：1 帧取**中位那一帧**（比首/尾更能代表全片；
//   maxFrames:2 的既有语义是「首+尾」，1 帧即取两者之中）。用**奇数个 pick** 的样例才能真验到中位。
test('★ sampleTimes：maxFrames=1 ⇒ 唯一一帧是「中位那一帧」（不再是 undefined）', () => {
  // 5 个 cue 中点 = 1,3,5,7,9（filmDur 为假 ⇒ 不掺首/中/尾）⇒ 中位下标 floor(4/2)=2 ⇒ t=5
  const five = Array.from({ length: 5 }, (_, i) => CUE(i * 2, i * 2 + 2));
  const r = sampleTimes({ cues: five, filmDur: 0, maxFrames: 1 });
  assert.equal(r.length, 1, '必须恰好 1 个');
  assert.equal(typeof r[0], 'object', '元素必须是对象，不是 undefined');
  assert.ok(Number.isFinite(r[0].t), `t 必须是有限数，实得 ${J(r[0])}`);
  assert.equal(r[0].t, 5, '★ 必须是中位那一帧（t=5），不是首帧 1、也不是尾帧 9');
  assert.equal(r.filter((x) => x === undefined).length, 0, '★ 数组里绝不许出现 undefined');
});

// ★ 可达性回归：这不是理论边界 —— `--max-frames 1` 经 lib/triple-check.mjs 的
//   `Math.max(1, Number(o.maxFrames) || DEFAULT_MAX_FRAMES)` 夹取后正好 === 1，
//   而 :406-409 的抽帧循环会对每个 pick 取 `p.t.toFixed(2)` ⇒ 元素为 undefined 时**直接抛**。
test('★ sampleTimes：maxFrames=1 是**可达输入**（--max-frames 1）⇒ 每个元素都必须有有限 t', () => {
  const cues = [CUE(0, 2, '一'), CUE(2, 4, '二'), CUE(4, 6, '三')];
  const r = sampleTimes({ cues, filmDur: 6, maxFrames: 1 });
  assert.ok(r.length >= 1, '至少 1 帧（否则 verifyTriple 会抛「抽帧计划为空」）');
  for (const p of r) {
    assert.ok(p && typeof p === 'object', `元素必须是对象，实得 ${J(p)}`);
    assert.ok(Number.isFinite(p.t), `每个元素必须有有限 t（否则 p.t.toFixed 会抛），实得 ${J(p)}`);
  }
  // 模拟 verifyTriple 的消费方式：绝不能抛
  assert.doesNotThrow(() => r.map((p) => p.t.toFixed(2)), '抽帧循环消费方式下不得抛');
  assert.deepEqual(r.map((p) => p.t.toFixed(2)), ['3.00'], '3 个 cue 的样例中位即 t=3');
});

// 保留原行为：maxFrames:0 ⇒ []（修 bug 时不得改掉它）
test('sampleTimes：maxFrames=0 ⇒ []（修 maxFrames=1 时不得改掉这条既有行为）', () => {
  const cues = [CUE(0, 2, '一'), CUE(2, 4, '二'), CUE(4, 6, '三')];
  assert.deepEqual(sampleTimes({ cues, filmDur: 6, maxFrames: 0 }), []);
  assert.deepEqual(sampleTimes({ cues: [], filmDur: null, maxFrames: 0 }), [], '空 cues + 0 也不得抛');
  assert.deepEqual(sampleTimes({ cues: [], filmDur: null, maxFrames: 1 }), [],
    '空 cues + maxFrames=1 也必须返回 []（不能返回 [undefined]）');
});

// ── ③ nearestCueText：阈值 2.0s ─────────────────────────────
test('nearestCueText：t 落在 cue 窗内 ⇒ 距离 0，返回该 cue 文本', () => {
  assert.equal(nearestCueText([CUE(1, 2, 'X'), CUE(5, 6, 'Y')], 1.5), 'X');
  assert.equal(nearestCueText([CUE(1, 2, 'X'), CUE(5, 6, 'Y')], 2.0), 'X', '落在窗的右端点上也算窗内');
});

test('nearestCueText：窗外 1.0s ⇒ 返回最近那条', () => {
  assert.equal(nearestCueText([CUE(1, 2, 'X')], 3.0), 'X', '距窗右端 1.0s，仍在阈值内');
});

test('★ nearestCueText：阈值恰好 2.0s 含、>2.0s 不含（太远就不该拿它当该时刻字幕）', () => {
  assert.equal(nearestCueText([CUE(0, 1, 'X')], 2.9999), 'X');
  assert.equal(nearestCueText([CUE(0, 1, 'X')], 3.0), 'X', '★ 恰好 2.0s 是边界，含');
  assert.equal(nearestCueText([CUE(0, 1, 'X')], 3.0001), '', '>2.0s ⇒ 空串（宁缺毋滥）');
});

test('nearestCueText：cues 为空 ⇒ 空串', () => {
  assert.equal(nearestCueText([], 1), '');
});

// ── ④ decide：核心判定矩阵 ──────────────────────────────────
test('decide①：OCR 文本 ≠ 字幕文本 ⇒ 不一致，且 reason 同时出现两个文本', () => {
  const d = decide({ subtitle: '你好', scriptRef: '你好世界', v: { imageText: '你坏' } });
  assert.equal(d.verdict, '不一致');
  assert.ok(d.reason.includes('你坏') && d.reason.includes('你好'), `reason 应含两文本：${d.reason}`);
  assert.equal(d.subtitleMatch, false);
});

test('decide②：字幕文本不在原文案里 ⇒ 不一致（reason 提示疑似改字/错位）', () => {
  const d = decide({ subtitle: '你好', scriptRef: '完全不同的文案', v: { imageText: '你好' } });
  assert.equal(d.verdict, '不一致');
  assert.ok(/改字|错位/.test(d.reason), `reason 应提示改字/错位：${d.reason}`);
  assert.equal(d.semanticMatch, false);
});

test('★ decide③：模型没读出字 ⇒ 存疑，**绝不许**是「一致」（必须保留的兜底）', () => {
  for (const imageText of ['', '   ', '\n']) {
    const d = decide({ subtitle: '你好', scriptRef: '你好世界', v: { imageText, reason: '看不清' } });
    assert.equal(d.verdict, '存疑', `imageText=${J(imageText)} 必须存疑`);
    assert.notEqual(d.verdict, '一致', '★ 读不到字绝不能兜底成一致');
    assert.equal(d.subtitleMatch, null);
  }
});

test('decide④：OCR == 字幕 且 字幕 ∈ 原文案 ⇒ 一致，且 reason 给出代码算出来的依据', () => {
  const d = decide({ subtitle: '你好', scriptRef: '你好世界', v: { imageText: '你好', reason: '模型说ok' } });
  assert.equal(d.verdict, '一致');
  assert.equal(d.subtitleMatch, true);
  assert.equal(d.semanticMatch, true);
  assert.ok(/逐字相同/.test(d.reason), `reason 应是代码算出的依据：${d.reason}`);
  assert.ok(/逐字出现在原文案中/.test(d.reason), `reason 应含语义依据：${d.reason}`);
  assert.ok(d.reason.includes('模型说ok'), '模型自述应降级为括注保留');
});

test('decide⑤：无原文案（scriptRef 空）时 OCR == 字幕 ⇒ 一致，reason 说明未做语义比对', () => {
  const d = decide({ subtitle: '你好', scriptRef: '', v: { imageText: '你好' } });
  assert.equal(d.verdict, '一致');
  assert.equal(d.semanticMatch, null, '无原文案 ⇒ semanticMatch 为 null（不是 false）');
  assert.ok(/未做语义比对/.test(d.reason), `reason 应说明未做语义比对：${d.reason}`);
});

test('★ decide⑥：modelVerdict 无论填什么（含「不一致」）都不得影响 verdict', () => {
  // 实测模型在 temp=0 下会**确定性**误报，所以代码刻意不采信它。这条是本文件的核心策略，
  // 一旦被"顺手恢复"，误报就会重新污染结论 —— 必须钉死。
  for (const mv of ['不一致', '存疑', '一致', null, '差不多']) {
    const d = decide({ subtitle: '你好', scriptRef: '你好世界', v: { imageText: '你好', modelVerdict: mv } });
    assert.equal(d.verdict, '一致', `modelVerdict=${J(mv)} 时 verdict 仍须为「一致」`);
  }
});

test('★ decide：CJK 归一化后相等即算一致（全角 / 半角 / 空白 / 标点都被抹平）', () => {
  // normCJK = NFKC + 小写 + 只留 [0-9a-z] 与 CJK。所以标点、空白被丢弃，全角数字/字母被折成半角。
  const d = decide({ subtitle: '你好，世界', scriptRef: '你好，世界！', v: { imageText: '你好 世界' } });
  assert.equal(d.verdict, '一致', '标点/空白差异不该判不一致');
  assert.equal(d.subtitleMatch, true);
  const d2 = decide({ subtitle: '第１集', scriptRef: '第1集', v: { imageText: '第1集' } });
  assert.equal(d2.verdict, '一致', '全角 １ 与半角 1 归一化后相等');
  // 反向：归一化后仍不同 ⇒ 必须能抓出（证明归一化不是"什么都放行"）
  const d3 = decide({ subtitle: '第1集', scriptRef: '第1集', v: { imageText: '第2集' } });
  assert.equal(d3.verdict, '不一致');
});

// ── ⑤ buildPrompt：提示词 ───────────────────────────────────
test('buildPrompt：含「严禁创作/改写/润色」约束句；★ 且**不得**把 subtitle / scriptRef 写进提示词（RISK-01）', () => {
  const p = buildPrompt({ subtitle: '该时刻字幕', scriptRef: '原文案内容' });
  assert.ok(/严禁创作/.test(p) && /改写/.test(p) && /润色/.test(p), '必须写死「只做对照检测」的约束');
  // ★★ RISK-01：答案（该时刻字幕 / 原文案）**绝不能**进提示词 —— 否则一个看不到图的纯文本模型
  //   只要把这两行照抄进 image_text，`decide()` 的确定性比对就会判「一致」⇒ 画面没被读、质检却
  //   报通过（静默产坏结论）。判据：模型只能从附图里读字（blind transcription）。
  assert.ok(!p.includes('该时刻字幕'), '★ 提示词不得含该时刻字幕文本（答案泄漏 ⇒ 质检空转）');
  assert.ok(!p.includes('原文案内容'), '★ 提示词不得含原文案（答案泄漏）');
  assert.ok(!/【该时刻字幕文本】/.test(p) && !/【原文案（语义基准）】/.test(p),
    '★ 那两行答案行必须已从提示词删除');
});

test('★ buildPrompt：不得出现「读不到就写空」这类给模型台阶的措辞', () => {
  // 文件头 :127 记着这个坑：旧措辞写了「读不到就写空串」→ 模型照着占位符输出空串再编理由自圆其说。
  const p = buildPrompt({ subtitle: 's', scriptRef: 'r' });
  assert.ok(!/读不到|为空|无法读取|留空/.test(p), `提示词里不许有"读不到就写空"的台阶：${p}`);
  // 示例值必须是像真结果的合法值，不能是占位符
  assert.ok(p.includes('{"image_text":"画面上烧录的字幕原文"}'), '示例应是像真结果的合法值');
});

// ★ 任务书说 buildPrompt「返回字符串数组」「scriptRef 超长被截到 SCRIPT_REF_CAP」——
//   实测**两条都不对**：它 return [...].join('\n')，是 **string**；
//   而 SCRIPT_REF_CAP 的截断发生在**上游 verifyTriple**（.slice(0, SCRIPT_REF_CAP)）。
//   ★ RISK-01 修复后 scriptRef 已**完全不进**提示词（「不截断」这条随之失去意义），
//     故本用例改为钉「类型仍是 string + scriptRef 无论多长都绝不出现」。
test('★ buildPrompt：真实类型是 string（不是数组），且**绝不**把 scriptRef 拼进提示词（RISK-01）', () => {
  const p = buildPrompt({ subtitle: 's', scriptRef: 'r' });
  assert.equal(typeof p, 'string', '★ 实测返回 string（内部 join 过），不是字符串数组');
  assert.equal(Array.isArray(p), false);
  const huge = '甲'.repeat(3000);
  assert.ok(!buildPrompt({ subtitle: 's', scriptRef: huge }).includes(huge),
    '★ RISK-01：无论 scriptRef 多长都**不得**出现在提示词里（答案不进提示词）');
});

// ── 运行器 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/triple-check.test.mjs —— 画面/字幕/语义三者校验门 纯逻辑测试'));
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
