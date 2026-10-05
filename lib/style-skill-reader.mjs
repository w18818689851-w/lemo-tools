// lib/style-skill-reader.mjs —— 风格 Skill 文档（style-skills）的**唯一读取入口**
//
// 背景：`lib/style-skills/<slug>/SKILL.md` 是「这个风格怎么做」的成品知识（11 节：风格说明 /
//   画面构图 / 配色体系 / 转场规则 / 字幕样式 / BGM音效 / 素材偏好 / 镜头节奏 /
//   制作参数清单 / 编排规则 / 当前短板与避坑要点），由 `scripts/style-distill.mjs` 那条
//   顺序蒸馏流水线生成，随 `_distill.json` 一起落盘。
//
// 与 `lib/style-dna-reader.mjs` 的分工（**不要混用，也不要合并**）：
//   · style-dna   = **原料**：从风格源码里抽出来的、可机器消费的**数值**（grain / 折行 / 响度目标）
//   · style-skills = **成品**：给人和智能体读的**制作方案**（怎么构图、怎么切、参数抄哪份）
//   两条通路（lemo-make / dub.mjs）都应先问 style-skills 要「方案」，再从 style-dna 取「数值」。
//
// 设计纪律（与 style-dna-reader 对齐）：
//   · 路径解析只在这一处（HERE 基准的 `style-skills/`），不各写一份，避免漂移。
//   · **缺失即优雅降级**：读不到 → null，调用方按「无 Skill 文档」继续，绝不抛、绝不阻断出片。
//   · 只读，不做任何渲染/媒体工作，可安全挂在出片路径上。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILLS_DIR = path.join(HERE, 'style-skills');

/** 11 节契约（顺序固定）。与 scripts/style-skill-check.mjs 的 SECTIONS 必须一致。 */
export const SKILL_SECTIONS = [
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

/** slug → 目录路径（只允许安全字符，挡住 `..` / 分隔符造成的目录穿越） */
export function skillDir(slug) {
  const s = String(slug ?? '').trim();
  if (!s || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s)) return null;
  return path.join(SKILLS_DIR, s);
}

const _cache = new Map();   // slug → {md, json, dir}|null

/**
 * 按 slug 读 Skill 文档。读不到 / 解析失败 → **null**（不抛）。结果带缓存。
 * @returns {{slug:string, dir:string, mdPath:string, md:string, json:object|null, sections:string[], missingSections:string[]}|null}
 */
export function readStyleSkill(slug) {
  const key = String(slug ?? '');
  if (_cache.has(key)) return _cache.get(key);
  let out = null;
  try {
    const dir = skillDir(key);
    const mdPath = dir && path.join(dir, 'SKILL.md');
    if (mdPath && fs.existsSync(mdPath)) {
      const md = fs.readFileSync(mdPath, 'utf8');
      let json = null;
      const jp = path.join(dir, '_distill.json');
      try { if (fs.existsSync(jp)) json = JSON.parse(fs.readFileSync(jp, 'utf8')); } catch { json = null; }
      const sections = [...md.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1].trim());
      const missingSections = SKILL_SECTIONS.filter((s) => !sections.includes(s));
      out = { slug: key, dir, mdPath, md, json, sections, missingSections };
    }
  } catch { out = null; }
  _cache.set(key, out);
  return out;
}

export function hasStyleSkill(slug) { return !!readStyleSkill(slug); }

/** 清缓存（蒸馏流水线写完新文档后，长驻进程要能读到新的）。 */
export function clearStyleSkillCache() { _cache.clear(); }

/**
 * 折成「出片路径用得上的最小集合」。
 * 全部字段缺失即 null —— 调用方按「无 Skill 文档」继续。
 *
 * ★ 2026-10-03 扩面：此前只暴露 9 个字段（完整度 / 匹配度 / 三个**条数**），
 *   三条通路连「这个风格的真峰值/响度是多少」「成片多大画幅多少帧」「已知缺陷**说了什么**」都读不到 ——
 *   于是「优先读 Skill 文档作为核心参考」实际只剩一句指针，**方案本身没进决策**。
 *   现在把**机器可读的口径**与**缺陷正文**一并暴露（缺陷正文是「避坑」知识的载体，
 *   只给条数等于没给）。全部字段仍是**只读 + 缺失即 null**，不新增任何抛错路径。
 */
export function summarizeStyleSkill(skill) {
  if (!skill) return null;
  const j = skill.json || {};
  const sc = j.selfCheck || {};
  const L = sc.loudness || {};
  const g = j.generatedVideo || {};
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    slug: skill.slug,
    mdPath: skill.mdPath,
    sectionCount: skill.sections.filter((s) => SKILL_SECTIONS.includes(s)).length,
    complete: skill.missingSections.length === 0,
    missingSections: skill.missingSections,
    matchScore: Number.isFinite(j.matchScore) ? j.matchScore : null,
    defectCount: Array.isArray(j.defects) ? j.defects.length : null,
    assetGapCount: Array.isArray(j.assetGaps) ? j.assetGaps.length : null,
    limitCount: Array.isArray(j.limits) ? j.limits.length : null,
    distilledAt: j.distilledAt || null,

    // ── 评分明细（哪一维扣了分）──
    scoreBreakdown: j.scoreBreakdown && typeof j.scoreBreakdown === 'object' ? j.scoreBreakdown : null,

    // ── 音频交付口径（来自 selfCheck.loudness，权威位置）──
    audio: (L.truePeakDbtp !== undefined || L.integratedLufs !== undefined)
      ? {
        integratedLufs: num(L.integratedLufs),
        truePeakDbtp: num(L.truePeakDbtp),
        lra: num(L.lra),
        peakDbtpTarget: num(L.peakDbtpTarget),
        peakTargetMet: typeof L.peakTargetMet === 'boolean' ? L.peakTargetMet : null,
      }
      : null,

    // ── 成片技术口径（画幅 / 帧率 / 时长 / 体积）──
    video: (g.width !== undefined || g.fps !== undefined || g.path)
      ? {
        path: g.path || null,
        durSec: num(g.durSec),
        bytes: num(g.bytes),
        width: num(g.width),
        height: num(g.height),
        fps: num(g.fps),
        frames: num(g.frames),
      }
      : null,

    // ── 缺陷正文（「避坑」知识的载体；只给条数等于没给）──
    // ★ 过滤条件含 `x.trim()`：空串会渲染成一条**空 bullet**（比没有更糟，会让人以为「这条缺陷没说」）。
    //   实测 43 份 json 的 263 条缺陷项全为非空字符串 ⇒ 收紧对真实数据零影响。
    defects: Array.isArray(j.defects) ? j.defects.filter((x) => typeof x === 'string' && x.trim()) : null,
    resolvedDefectCount: Array.isArray(j.resolvedDefects) ? j.resolvedDefects.length : null,
    // 已修缺陷的**结局**也带上：下游不必再猜「这条到底修没修」
    resolvedDefectTexts: Array.isArray(j.resolvedDefects)
      ? j.resolvedDefects.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.split('\n')[0])
      : null,
  };
}

/** 把一条缺陷正文压成一行短提示（去掉换行、截断）。 */
const headline = (s, n = 88) => {
  const one = String(s).replace(/\s*\n\s*/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n)}…` : one;
};

/** 生成可读的一行行提示（供出片链路打印；不含 ANSI 色码）。 */
export function describeStyleSkill(sum) {
  if (!sum) return [];
  const out = [`本风格 Skill 文档：${sum.mdPath}`];
  out.push(`  11 节完整度 ${sum.sectionCount}/11${sum.complete ? '' : `（缺 ${sum.missingSections.join('、')}）`}`
    + `${sum.matchScore == null ? '' : ` · 风格匹配度 ${sum.matchScore}/100`}`);

  // 评分明细：让人一眼看出「哪一维是短板」
  if (sum.scoreBreakdown) {
    const b = sum.scoreBreakdown;
    out.push(`  评分明细：` + ['palette', 'composition', 'typography', 'rhythm', 'audio']
      .filter((k) => Number.isFinite(b[k]))
      .map((k) => `${k} ${b[k]}/20`)
      .join(' · '));
  }

  // 音频口径：★ 这是「本风格成片该长什么样」的**机器可读**交付指标
  if (sum.audio) {
    const a = sum.audio;
    const parts = [];
    if (a.integratedLufs != null) parts.push(`响度 ${a.integratedLufs} LUFS`);
    if (a.truePeakDbtp != null) parts.push(`真峰值 ${a.truePeakDbtp} dBTP`);
    if (a.lra != null) parts.push(`LRA ${a.lra} LU`);
    if (a.peakTargetMet != null) parts.push(a.peakTargetMet ? '真峰值达标' : `真峰值**未达标**（线 ${a.peakDbtpTarget ?? -1.2}）`);
    if (parts.length) out.push(`  成片音频口径：${parts.join(' · ')}`);
  }

  // 成片技术口径
  if (sum.video && (sum.video.width || sum.video.fps)) {
    const v = sum.video;
    const parts = [];
    if (v.width && v.height) parts.push(`${v.width}×${v.height}`);
    if (v.fps) parts.push(`${v.fps} fps`);
    if (v.frames) parts.push(`${v.frames} 帧`);
    if (v.durSec) parts.push(`${v.durSec}s`);
    if (v.bytes) parts.push(`${(v.bytes / 1048576).toFixed(1)} MB`);
    if (parts.length) out.push(`  成片技术口径：${parts.join(' · ')}`);
  }

  const bits = [];
  if (sum.defectCount != null) bits.push(`已知缺陷 ${sum.defectCount} 条`);
  if (sum.resolvedDefectCount != null && sum.resolvedDefectCount > 0) bits.push(`已修 ${sum.resolvedDefectCount} 条`);
  if (sum.assetGapCount != null) bits.push(`素材缺口 ${sum.assetGapCount} 条`);
  if (sum.limitCount != null) bits.push(`能力限制 ${sum.limitCount} 条`);
  if (bits.length) out.push(`  ${bits.join(' · ')}（详见第 11 节）`);

  // ★ 缺陷**正文**：只给条数等于没给 —— 「避坑」知识全在这几行里
  if (sum.defects && sum.defects.length) {
    out.push('  ★ 出片前必读（第 11 节「已知缺陷」摘录）：');
    for (const d of sum.defects.slice(0, 3)) out.push(`    · ${headline(d)}`);
    if (sum.defects.length > 3) out.push(`    · …另有 ${sum.defects.length - 3} 条，见文档第 11 节`);
  }

  out.push('  ★ 选定本风格创作时，**优先读这份文档**作为核心参考；无需逐帧复刻，对齐特质即可。');
  return out;
}
