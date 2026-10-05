#!/usr/bin/env node
/**
 * scripts/style-skill-check.mjs —— 风格 Skill 文档的**自检校验器**
 *
 * 用途：每生成一份 `lib/style-skills/<slug>/SKILL.md` 就过一遍它，防止
 * 「模板占位符没填」「11 节缺节」「自检记录缺失」这三类最常见的糊弄式交付。
 *
 * 用法：
 *   node scripts/style-skill-check.mjs [--only a,b] [--quiet]
 *
 * 退出码：全部合规 0；有不合规 1。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SKILLS = path.join(ROOT, 'lib', 'style-skills');
const STYLES_DIR = 'D:/lemo-opuscar/styles';

const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const only = (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const quiet = argv.includes('--quiet');

// 11 节契约（顺序固定；标题里的中文名必须逐字一致）
export const SECTIONS = [
  '1. 风格说明',
  '2. 画面构图',
  '3. 配色体系',
  '4. 转场规则',
  '5. 字幕样式',
  '6. BGM / 音效特征',
  '7. 素材偏好',
  '8. 镜头节奏',
  '9. 制作参数清单',
  '10. 编排规则',
  '11. 当前短板与避坑要点',
];

// 模板占位符残留（出现即视为「没填」）
const PLACEHOLDER_PATTERNS = [
  { re: /<slug>/g, what: '<slug>' },
  { re: /<中文名>/g, what: '<中文名>' },
  { re: /<样本片名>/g, what: '<样本片名>' },
  { re: /<分类[^>]*>/g, what: '<分类…>' },
  { re: /<一句话[^>]*>/g, what: '<一句话…>' },
  { re: /_{3,}/g, what: '连续下划线占位（___）' },
  { re: /`_+\s*LUFS`/g, what: '响度占位' },
];

export function checkOne(slug) {
  const dir = path.join(SKILLS, slug);
  const md = path.join(dir, 'SKILL.md');
  const dj = path.join(dir, '_distill.json');
  const errs = [];

  if (!fs.existsSync(md)) return { slug, ok: false, errs: ['缺 SKILL.md'] };
  // ★ 先把 CRLF 归一成 LF：子智能体/编辑器写出的文件行尾不可控，而下面所有正则都按 LF 写。
  //   不归一的话会误报「缺 YAML frontmatter」「缺章节」——这是假红，比漏报更浪费时间。
  const text = fs.readFileSync(md, 'utf8').replace(/\r\n?/g, '\n');

  // ① 11 节齐全（按二级标题）
  const heads = [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1].trim());
  for (const s of SECTIONS) {
    if (!heads.includes(s)) errs.push(`缺章节「${s}」`);
  }
  // ② 顺序必须一致
  const got = heads.filter((h) => SECTIONS.includes(h));
  if (got.join('|') !== SECTIONS.join('|') && got.length === SECTIONS.length) {
    errs.push('11 节顺序与契约不一致');
  }
  // ③ 无占位符残留
  for (const p of PLACEHOLDER_PATTERNS) {
    const m = text.match(p.re);
    if (m) errs.push(`占位符未填：${p.what}（${m.length} 处）`);
  }
  // ④ 每节都有实质内容（≥ 80 字）
  for (const s of SECTIONS) {
    const i = text.indexOf(`## ${s}`);
    if (i < 0) continue;
    const rest = text.slice(i + s.length + 3);
    const next = rest.search(/^##\s/m);
    const body = (next < 0 ? rest : rest.slice(0, next)).replace(/[#>*`|\-\s]/g, '');
    if (body.length < 80) errs.push(`章节「${s}」内容过薄（${body.length} 字，要求 ≥80）`);
  }
  // ⑤ frontmatter
  if (!/^---\n[\s\S]*?\n---\n/.test(text)) errs.push('缺 YAML frontmatter');
  if (!/^name:\s*lemo-style-/m.test(text)) errs.push('frontmatter 缺 name: lemo-style-<slug>');

  // ⑥ 自检记录
  if (!fs.existsSync(dj)) {
    errs.push('缺 _distill.json（自检记录）');
  } else {
    let d = null;
    try { d = JSON.parse(fs.readFileSync(dj, 'utf8')); } catch (e) { errs.push(`_distill.json 不是合法 JSON：${e.message}`); }
    if (d) {
      if (!Number.isFinite(d.matchScore) || d.matchScore < 0 || d.matchScore > 100) errs.push('matchScore 缺失或越界（要求 0–100）');
      for (const k of ['defects', 'assetGaps', 'limits']) {
        if (!Array.isArray(d[k])) errs.push(`_distill.json 缺数组字段 ${k}`);
      }
      if (!Array.isArray(d.evidenceFrames) || d.evidenceFrames.length === 0) errs.push('_distill.json 缺 evidenceFrames（逐帧证据）');
      if (d.slug !== slug) errs.push(`_distill.json 的 slug=${d.slug} 与目录 ${slug} 不一致`);
    }
  }

  // ⑦ 样本必须有对应风格目录
  if (!fs.existsSync(path.join(STYLES_DIR, slug))) errs.push(`styles/${slug} 不存在（幽灵风格）`);

  return { slug, ok: errs.length === 0, errs, matchScore: (() => { try { return JSON.parse(fs.readFileSync(dj, 'utf8')).matchScore; } catch { return null; } })() };
}

// ── main ──
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('style-skill-check.mjs')) {
  const all = fs.readdirSync(STYLES_DIR).filter((n) => n !== '_template' && fs.existsSync(path.join(STYLES_DIR, n, 'demo'))).sort();
  const list = only.length ? all.filter((s) => only.includes(s)) : all;
  const results = list.map(checkOne);
  const okN = results.filter((r) => r.ok).length;
  if (!quiet) {
    for (const r of results) {
      if (r.ok) console.log(`  ✔ ${r.slug.padEnd(20)} 匹配度 ${r.matchScore ?? '--'}`);
      else { console.log(`  ✘ ${r.slug.padEnd(20)}`); for (const e of r.errs) console.log(`      · ${e}`); }
    }
  }
  console.log(`\nSkill 文档自检：${okN}/${list.length} 合规\n`);
  process.exitCode = okN === list.length ? 0 : 1;
}
