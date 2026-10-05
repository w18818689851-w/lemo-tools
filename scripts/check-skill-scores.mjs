#!/usr/bin/env node
/**
 * scripts/check-skill-scores.mjs —— 43 份风格 Skill 文档的**评分自洽性**校验
 *
 * ★ 为什么需要它（2026-10-03 立的由来）：
 *   `lib/dub-styles.json` 的配置被改过之后（palette 色值、`bgRecipe.texture` 等），
 *   文档里的 `defects` **不会自动跟着更新** —— 于是文档会**长期按已修好的问题扣分**，
 *   `matchScore` 被系统性低估，误导「按 Skill 文档决策」的下游生成。
 *   实测一次就查出 6 条已失效的扣分（涉及 5 个风格）。
 *
 * 查三件事：
 *   ① 每份 `_distill.json` 的 `matchScore` == `scoreBreakdown` 五项之和（palette/composition/typography/rhythm/audio）；
 *   ② `defects` 里不再有「能被当前配置值**直接证伪**」的条目；
 *   ③ `SKILL.md` 的「风格匹配度自评」== 同目录 `_distill.json` 的 `matchScore`（人读文档与机器数据**必须同源**）。
 *      ③ 的由来（2026-10-03 实踩）：拆完 `backrooms` 的混合缺陷、把 json 从 90 提到 91 后，
 *      **忘了同步 SKILL.md 的正文**，于是人读到 90、下游读 json 得到 91 —— 同一个数字两个答案。
 *      这类「改了一处忘了另一处」只能靠机械比对拦住。
 *
 * 「直接证伪」的机械判据（与校正口径一致）：
 *   条目点名了配置字段并引用了具体值（texture / fontFamily / palette 系 hex），
 *   若该值 ≠ 当前 `lib/dub-styles.json` 的实际值 ⇒ 该断言被证伪。
 *   · 条目里**所有**被抽取的配置值断言都被证伪 ⇒ 「全失效」（不该再留在 defects）→ FAIL；
 *   · 只有**部分**被证伪、且条目仍引用当前配置里存在的值 ⇒ 「混合条目」→ WARN，需人工复核。
 *
 * 用法：node scripts/check-skill-scores.mjs
 * 退出码：有 FAIL（①②③ 任一）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/lemo-tools';
const DIR = path.join(ROOT, 'lib', 'style-skills');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'dub-styles.json'), 'utf8'));
const bySlug = Object.fromEntries(cfg.styles.map((s) => [s.slug, s]));
const KEYS = ['palette', 'composition', 'typography', 'rhythm', 'audio'];

const TEXTURES = ['none', 'paper', 'grain', 'scanlines', 'halftone', 'rice-paper', 'dot-grid', 'hairline-grid', 'washi'];
const FONTS = ['SimHei', 'SimSun', 'KaiTi', 'DengXian', 'Microsoft YaHei', 'Consolas'];

// ★ 历史语境守卫（2026-10-03 加）：条目里**引用旧值**做历史叙述时（「原为 scanlines…已修」「移入 resolvedDefects」等），
//   那不是在**主张**当前配置 —— 不能算「被证伪的现行断言」，否则会永远误报。
//   判据：命中处 ±80 字符内出现下列词之一 ⇒ 视为历史提及，跳过。
const HIST_MARK = /已修|已改为|已改成|已移入|移入 resolvedDefects|原为|原记|原先|曾是|曾为|曾是值|校正|拆分/;
const around = (txt, m) => txt.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80);

const slugs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort();
let badScore = 0, fail = 0, mixed = 0, claims = 0, scoreMismatch = 0, scoreMissing = 0;

for (const slug of slugs) {
  const raw = fs.readFileSync(path.join(DIR, slug, '_distill.json'), 'utf8');
  const d = JSON.parse(raw);
  const sum = KEYS.reduce((a, k) => a + d.scoreBreakdown[k], 0);
  if (d.matchScore !== sum) { badScore++; console.log(`✘ ${slug} matchScore=${d.matchScore} ≠ 五项和 ${sum}`); }

  // ③ SKILL.md 自评匹配度 ↔ _distill.json#matchScore
  const mdPath = path.join(DIR, slug, 'SKILL.md');
  const md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
  const mSelf = md.match(/风格匹配度自评[\s\S]{0,40}?\*\*(\d+)\s*\/\s*100\*\*/);
  if (!mSelf) { scoreMissing++; console.log(`✘ ${slug} SKILL.md 未找到「风格匹配度自评 **N/100**」`); }
  else if (Number(mSelf[1]) !== d.matchScore) {
    scoreMismatch++;
    console.log(`✘ ${slug} SKILL.md 自评 ${mSelf[1]}/100 ≠ _distill.json matchScore ${d.matchScore}`);
  }

  const c = bySlug[slug] || {};
  const cfgText = JSON.stringify(c).toUpperCase();
  const texNow = c.bgRecipe && c.bgRecipe.texture;
  const fontNow = c.subtitle && c.subtitle.fontFamily;
  const palNow = c.palette || {};

  for (const txt of d.defects || []) {
    const falsified = [];
    // texture 断言
    for (const m of txt.matchAll(/texture\s*(?:=|:|是|为|写成|改成|取)\s*[`"']?([A-Za-z][\w-]*)/g)) {
      if (!TEXTURES.includes(m[1])) continue;
      claims++;
      if (texNow !== m[1] && !HIST_MARK.test(around(txt, m))) falsified.push(`texture "${m[1]}" ≠ 当前 "${texNow}"`);
    }
    // fontFamily 断言
    for (const m of txt.matchAll(/fontFamily\s*(?:=|:|是|为|被改成|回退到|回退)\s*[`"'\s]*([A-Za-z][A-Za-z ]+?)(?=[`"'\s，。；、）)]|$)/g)) {
      const v = m[1].trim();
      if (!FONTS.includes(v)) continue;
      claims++;
      if (fontNow !== v && !HIST_MARK.test(around(txt, m))) falsified.push(`fontFamily "${v}" ≠ 当前 "${fontNow}"`);
    }
    // palette 字段断言（xxx.bg = #hex / bg #hex / 字段为 bg #hex ...）
    for (const m of txt.matchAll(/\b(bg2?|fg|accent|subtitle)\b\s*(?:字段[为是]?|=|:|是|为)?\s*[`"']?(#[0-9A-Fa-f]{6,8})/g)) {
      const field = m[1] === 'bg' ? 'bg' : m[1];
      const hex = m[2];
      claims++;
      const cur = palNow[field];
      if (cur && String(cur).toUpperCase() !== hex.toUpperCase()) falsified.push(`${field} ${hex} ≠ 当前 ${cur}`);
    }

    if (!falsified.length) continue;
    // 条目里是否还引用了当前配置中存在的值（bg/fg/accent/stops 等）——用于区分「混合」与「全失效」
    const citesCurrent = [...txt.matchAll(/#[0-9A-Fa-f]{6,8}/g)].some((m) => cfgText.includes(m[0].toUpperCase()));
    if (citesCurrent) { mixed++; console.log(`⚠ 混合条目 ${slug}：${falsified.join('；')}（条目仍引用当前配置值，未整体证伪）|| ${txt.slice(0, 60)}`); }
    else { fail++; console.log(`✘ 仍存全失效条目 ${slug}：${falsified.join('；')} || ${txt.slice(0, 80)}`); }
  }
}

console.log(`\n[1] matchScore == scoreBreakdown 五项之和：${slugs.length - badScore}/${slugs.length} ${badScore ? '✘' : 'OK'}`);
console.log(`[2] defects 中被抽取的配置值断言共 ${claims} 条；「全失效」残留 ${fail} 条 ${fail ? '✘' : 'OK'}；「混合条目」${mixed} 条（人工复核，见报告）`);
console.log(`[3] SKILL.md 自评匹配度 == _distill.json matchScore：${slugs.length - scoreMismatch - scoreMissing}/${slugs.length} ${scoreMismatch || scoreMissing ? '✘' : 'OK'}${scoreMissing ? `（其中 ${scoreMissing} 份缺自评行）` : ''}`);
process.exitCode = badScore || fail || scoreMismatch || scoreMissing ? 1 : 0;
