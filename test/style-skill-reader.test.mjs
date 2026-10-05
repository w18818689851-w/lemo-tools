#!/usr/bin/env node
/**
 * test/style-skill-reader.test.mjs —— `lib/style-skill-reader.mjs` 的**纯逻辑**测试（零依赖）
 *
 * ★ 为什么必须有这一份（2026-10-04 补）：
 *   它是三条生成通路读风格 Skill 文档的**唯一入口**，且本日刚给它**扩面**（补了 `scoreBreakdown` /
 *   `audio` / `video` / `defects` 正文等字段）—— 但此前**一条测试都没有**。
 *   它的对外契约里有一条是硬要求：**「缺失即优雅降级 ⇒ 返回 null，绝不抛」**（读不到文档不能阻断出片），
 *   这种契约**必须用测试钉住**，否则某次重构里一个 `throw` 就能让没蒸馏过的风格直接出不了片。
 *
 * 覆盖：
 *   ① 目录穿越防护（`skillDir` 只放行安全字符）；
 *   ② 缺失即降级：不存在的 slug ⇒ `readStyleSkill` 返回 null、`summarizeStyleSkill(null)` 返回 null、
 *      `describeStyleSkill(null)` 返回空数组（**三处都不抛**）；
 *   ③ 真实文档：能读出 11 节、json、以及**扩面后的机器可读字段**；
 *   ④ 扩面字段与 json 的**自洽**：`audio.truePeakDbtp` 与 json 一致、`peakTargetMet` 与交付线一致、
 *      `video` 的画幅/帧率/帧数与 json 一致、`defects` 是**正文**（不是条数）；
 *   ⑤ `describeStyleSkill` 的输出里确实出现「评分明细 / 成片音频口径 / 缺陷摘录」这几行（人真的看得到）。
 *
 * 用法：node test/style-skill-reader.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  readStyleSkill, summarizeStyleSkill, describeStyleSkill,
  skillDir, hasStyleSkill, SKILLS_DIR, SKILL_SECTIONS,
} from '../lib/style-skill-reader.mjs';

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

/** 取一个真实存在、且有已修缺陷的 slug 当样本（扩面字段最全）。 */
const SAMPLE = 'papercut-red';

// ── ① 目录穿越防护 ───────────────────────────────────────────
test('skillDir：只放行安全字符，目录穿越一律拒绝', () => {
  assert.equal(skillDir('../etc'), null, '`..` 必须被拒');
  assert.equal(skillDir('a/b'), null, '路径分隔符必须被拒');
  assert.equal(skillDir('a\\b'), null, 'Windows 分隔符必须被拒');
  assert.equal(skillDir(''), null, '空串必须被拒');
  assert.equal(skillDir(null), null, 'null 必须被拒');
  assert.equal(skillDir('   '), null, '纯空白必须被拒');
  const ok = skillDir('papercut-red');
  assert.ok(ok && ok.startsWith(SKILLS_DIR), '正常 slug 应拼到 style-skills 目录下');
});

// ── ② 缺失即降级：三处都不抛 ─────────────────────────────────
test('★ 缺失即降级：不存在的风格 ⇒ null，且三处都不抛（这是硬契约）', () => {
  assert.equal(hasStyleSkill('nonexistent-xyz'), false);
  assert.equal(readStyleSkill('nonexistent-xyz'), null, '读不到应返回 null 而不是抛');
  assert.equal(readStyleSkill(''), null);
  assert.equal(readStyleSkill(null), null);
  assert.equal(summarizeStyleSkill(null), null, 'summarize(null) 应返回 null');
  assert.deepEqual(describeStyleSkill(null), [], 'describe(null) 应返回空数组');
});

// ── ③ 真实文档能读全 ─────────────────────────────────────────
test('readStyleSkill：能读出 11 节 + json', () => {
  const s = readStyleSkill(SAMPLE);
  assert.ok(s, `${SAMPLE} 应当能读到`);
  assert.ok(typeof s.md === 'string' && s.md.length > 1000, 'md 应当是完整正文');
  assert.ok(s.json && typeof s.json === 'object', 'json 应当解析出来');
  assert.deepEqual(s.missingSections, [], `11 节应当齐全，缺：${JSON.stringify(s.missingSections)}`);
  assert.equal(s.sections.filter((x) => SKILL_SECTIONS.includes(x)).length, 11, '应当数出 11 节');
});

// ── ④ 扩面字段与 json 自洽 ───────────────────────────────────
test('★ 扩面字段（audio / video / scoreBreakdown / defects 正文）与 json 自洽', () => {
  const sum = summarizeStyleSkill(readStyleSkill(SAMPLE));
  const j = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, SAMPLE, '_distill.json'), 'utf8'));

  // scoreBreakdown：五项都是数字，且和 == matchScore
  assert.ok(sum.scoreBreakdown, 'scoreBreakdown 应当暴露');
  const keys = ['palette', 'composition', 'typography', 'rhythm', 'audio'];
  const s2 = keys.reduce((a, k) => a + sum.scoreBreakdown[k], 0);
  assert.equal(s2, sum.matchScore, '五项之和应当等于 matchScore');

  // audio：真峰值/响度/是否达标，与 json 的权威位置一致
  assert.ok(sum.audio, 'audio 口径应当暴露');
  assert.equal(sum.audio.truePeakDbtp, j.selfCheck.loudness.truePeakDbtp, '真峰值应与 json 一致');
  assert.equal(sum.audio.integratedLufs, j.selfCheck.loudness.integratedLufs, '响度应与 json 一致');
  assert.equal(sum.audio.peakTargetMet, sum.audio.truePeakDbtp <= -1.2,
    'peakTargetMet 应当与「真峰值 ≤ −1.2」一致');

  // video：画幅/帧率/帧数
  assert.ok(sum.video, 'video 口径应当暴露');
  assert.equal(sum.video.width, j.generatedVideo.width, '宽应与 json 一致');
  assert.equal(sum.video.height, j.generatedVideo.height, '高应与 json 一致');
  assert.equal(sum.video.fps, j.generatedVideo.fps, '帧率应与 json 一致');
  assert.equal(sum.video.frames, j.generatedVideo.frames, '帧数应与 json 一致');

  // defects：必须是**正文**（只给条数等于没给），且与 json 条数一致
  assert.ok(Array.isArray(sum.defects), 'defects 应当是数组');
  assert.equal(sum.defects.length, j.defects.length, 'defects 条数应与 json 一致');
  assert.ok(sum.defects.every((x) => typeof x === 'string' && x.length > 10),
    'defects 应当是**正文**（非空字符串），不是只有条数');
  assert.equal(sum.resolvedDefectCount, (j.resolvedDefects || []).length, '已修条数应与 json 一致');
});

// ── ④b 子字段缺失 ⇒ 该块为 null（真实样本字段齐全，验不到这条）────
// 用**合成对象**驱动，零文件 IO：真实样本 selfCheck/generatedVideo 全都有，
// 所以「缺哪块 ⇒ 哪块为 null」这条降级契约只能靠合成输入来钉。
test('★ 子字段缺失即降级：无 selfCheck ⇒ audio 为 null；无 generatedVideo ⇒ video 为 null', () => {
  const base = { slug: 'synthetic', sections: SKILL_SECTIONS, missingSections: [] };

  // 空 json：所有块都该是 null，但**对象本身不能是 null、不能抛**
  const empty = summarizeStyleSkill({ ...base, json: {} });
  assert.ok(empty, 'json 为空时仍应返回摘要对象（不是 null）');
  assert.equal(empty.audio, null, '无 selfCheck.loudness ⇒ audio 应为 null');
  assert.equal(empty.video, null, '无 generatedVideo ⇒ video 应为 null');
  assert.equal(empty.scoreBreakdown, null);
  assert.equal(empty.matchScore, null);
  assert.equal(empty.defectCount, null, '无 defects ⇒ 条数应为 null（而不是 0）');
  assert.equal(empty.defects, null, '无 defects ⇒ 正文应为 null');
  assert.deepEqual(describeStyleSkill(empty).length > 0, true, '摘要对象非空 ⇒ 仍应产出行（只是内容少）');

  // json 为 null（_distill.json 解析失败）同样不抛
  const noJson = summarizeStyleSkill({ ...base, json: null });
  assert.ok(noJson && noJson.audio === null && noJson.video === null, 'json 为 null 时应静默降级');

  // 非字符串的 defects 项要被过滤掉（json 里混进 null / 数字不能让下游炸）
  const mixed = summarizeStyleSkill({
    ...base,
    json: { defects: ['这是一条足够长的真实缺陷正文，长度超过十个字符', null, 42, ''], resolvedDefects: ['修好了某处口径'] },
  });
  assert.equal(mixed.defects.length, 1, '非字符串项应被过滤，只留字符串');
  assert.equal(mixed.defectCount, 4, '条数仍按 json 原始长度算（与 defects 正文数组分开）');
  assert.deepEqual(mixed.resolvedDefectTexts, ['修好了某处口径']);
});

// ── ⑤ 人看得到 ───────────────────────────────────────────────
test('★ describeStyleSkill：输出里真的出现「评分明细 / 成片音频口径 / 缺陷摘录」', () => {
  const lines = describeStyleSkill(summarizeStyleSkill(readStyleSkill(SAMPLE)));
  const text = lines.join('\n');
  assert.match(text, /评分明细/, '应当打印评分明细（哪一维是短板）');
  assert.match(text, /成片音频口径/, '应当打印成片音频口径');
  assert.match(text, /真峰值/, '音频口径里应当含真峰值');
  assert.match(text, /出片前必读|已知缺陷/, '应当打印缺陷（避坑知识）');
  assert.match(text, /优先读这份文档/, '应当保留「优先读这份文档」的指引');
  // 缺失时不该产出任何行（调用方据此「整块不打印」，保证未蒸馏风格的输出逐字节不变）
  assert.deepEqual(describeStyleSkill(null), []);
});

// ── 运行器 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.dim('test/style-skill-reader.test.mjs —— 风格 Skill 文档读取入口 纯逻辑测试'));
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
