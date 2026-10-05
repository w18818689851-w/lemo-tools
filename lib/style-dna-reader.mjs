// lib/style-dna-reader.mjs —— 风格特质档案（style-dna）的**唯一读取入口**
//
// 背景：`lib/style-dna/<slug>.json`（43 份，每份 15 字段）是「这个风格怎么做 / 怎么套用」
//   的知识库，但它此前是**零消费者**——没有任何代码读它。出片链路（dub.mjs）用的是
//   `lib/dub-styles.json` 的参数表（tags/palette…），不是这份特质档案。
//   本模块把 DNA 接进链路：**只读**、**缺失即优雅降级**（返回 null，绝不抛异常）。
//
// 设计纪律（与 lib/dub-core.mjs 的 loadStyleRegistry 对齐）：
//   · 路径解析集中在这一处：DNA 目录 = 本文件同级的 `style-dna/`（HERE 基准），
//     不各写一份路径，避免漂移。
//   · DNA 是**增强**不是**必需**：读不到 → null，调用方按「无 DNA」路径继续（与旧行为一致）。
//   · slug 直接就是风格注册表里的 id（43 个内置风格一一对应），故不需要另一张映射表。
//
// ★ 本模块**不做**任何渲染/媒体工作，纯读文件 + 解析，可安全挂在出片路径上。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DNA_DIR = path.join(HERE, 'style-dna');

// slug → 文件路径（只允许安全字符，挡住 `..` / 分隔符造成的目录穿越）
export function dnaPath(slug) {
  const s = String(slug ?? '').trim();
  if (!s || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s)) return null;
  return path.join(DNA_DIR, `${s}.json`);
}

const _cache = new Map();   // slug → dna|null

/**
 * 按 slug 读 `<slug>.json`，返回结构化对象；读不到 / 解析失败 → **null**（不抛）。
 * 结果带缓存（同一进程内重复调用零成本）。
 */
export function readStyleDna(slug) {
  const key = String(slug ?? '');
  if (_cache.has(key)) return _cache.get(key);
  let dna = null;
  try {
    const p = dnaPath(key);
    if (p && fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j && typeof j === 'object' && !Array.isArray(j) && j.slug) dna = j;
    }
  } catch { dna = null; }   // 坏 JSON / 权限问题一律当「没有」
  _cache.set(key, dna);
  return dna;
}

export function hasStyleDna(slug) { return !!readStyleDna(slug); }

// ── 字段解析：把散文特质折成**可用的数值** ──────────────────────
// DNA 里这些字段是人写的散文（如 art-deco：「旁白单句实测 6–13 个英文词（约 30–75 字符）…
// 字幕卡宽上限 1500px…最多两行。」）。下面用保守的正则抽取，抽不到就返回 null（= 不生效）。

const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/** sentence_patterns.length → 字幕**单行字符上限**（int 或 null） */
export function parseSubtitleMaxChars(sentencePatternsLength) {
  const s = String(sentencePatternsLength ?? '');
  if (!s) return null;
  // 优先「每行 / 一行 / 单行 … N 个字符」这种显式单行上限
  const explicit = [...s.matchAll(/(?:每行|一行|单行)[^0-9]{0,8}(\d+)\s*个?字符/g)].map((m) => +m[1]);
  if (explicit.length) return Math.max(...explicit);
  // 否则取所有「N 字符」的最大值（区间「30–75 字符」会命中上界 75）
  const all = [...s.matchAll(/(\d+)\s*个?字符/g)].map((m) => +m[1]);
  return all.length ? Math.max(...all) : null;
}

/** sentence_patterns.length → 字幕**最多几行**（int 或 null）。仅作提示，不强制。 */
export function parseSubtitleMaxLines(sentencePatternsLength) {
  const s = String(sentencePatternsLength ?? '');
  const m = /最多(?:约)?\s*([一二两三四五六七八九十\d]+)\s*行/.exec(s);
  if (!m) return null;
  const t = m[1];
  if (CN_NUM[t] != null) return CN_NUM[t];
  return Number.isFinite(+t) ? +t : null;
}

/** sound_palette.mix_rules → 该风格自述的**集成响度目标**（负数 dB，或 null） */
export function parseTargetLufs(mixRules) {
  const s = String(mixRules ?? '');
  if (!s) return null;
  // 注意 unicode 减号 − 与 en-dash –；取第一个落在合理区间的值
  for (const m of s.matchAll(/([-\u2212\u2013]?\s*\d+(?:\.\d+)?)\s*LUFS/gi)) {
    const v = Number(String(m[1]).replace(/[\s\u2212\u2013]/g, (c) => (c === ' ' ? '' : '-')));
    if (Number.isFinite(v)) {
      const signed = v > 0 ? -v : v;          // 只写了「14 LUFS」也按 -14 理解
      if (signed <= -8 && signed >= -30) return signed;
    }
  }
  return null;
}

const arrLen = (v) => (Array.isArray(v) ? v.length : 0);
const firstSentence = (v) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
};

// ── 「编排手法」六字段：折成一行可读文本 + **硬截断** ──────────────────────
// ★ 由来（2026-10-05 审计）：`narrative_rhythm / shot_logic / atmosphere / tone / taboos /
//   asset_contract` 这六项在改动前是**零读取** —— 既不进渲染、也不被任何打印函数提到，
//   连编排智能体都看不到它们。而它们恰恰是最像「编排手法（节奏/镜头逻辑/氛围/语气/禁忌/
//   素材契约）」的一类 ⇒ 是知识库里最被浪费的部分。这里把它们折成一行、附上限，交给出片日志。
// ★ 为什么要截断：这六项是长篇散文 / 嵌套对象（实测最长的 `asset_contract` 达 2315 字、
//   `narrative_rhythm` 1187 字）。原样打印会给日志凭空加 5KB 以上 —— 而整条 `dub.mjs --dry-run`
//   日志实测只有约 7.9KB（88 行）。故每字段硬截到 100 字：够让编排智能体读到「这一项讲什么」，
//   又不至于淹没日志。六字段 ⇒ 合计 ≤ 6×100 = 600 字（**构造上封顶**，无需再跑一次预算裁剪）。
export const DNA_AGENT_FIELD_CAP = 100;

/** 递归折平任意形状：数组按 ` | ` 连接；对象按 `键: 值`（**保留子键名**，否则编排智能体不知道每段在讲什么） */
function flattenDna(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(flattenDna).filter(Boolean).join(' | ');
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, x]) => { const s = flattenDna(x); return s ? `${k}: ${s}` : ''; })
      .filter(Boolean).join(' | ');
  }
  return String(v);
}

/** 折成一行、压空白、截断到 cap 字；**空/缺失 → ''**（调用方据此跳过，不留空行噪声） */
function clipDnaField(v, cap = DNA_AGENT_FIELD_CAP) {
  const s = flattenDna(v).replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > cap ? `${s.slice(0, cap)}…` : s;
}

/**
 * 把原始 DNA 折成**出片链路要用的最小集合**。所有数值字段缺失即 null（= 该特质不生效）。
 * 不含任何渲染逻辑，纯数据。
 */
export function summarizeStyleDna(dna) {
  if (!dna || typeof dna !== 'object') return null;
  const sp = dna.sentence_patterns || {};
  const snd = dna.sound_palette || {};
  return {
    slug: dna.slug,
    nameZh: dna.name_zh || dna.slug,
    // ── 会对出片产生实际影响的字段 ──
    subtitleMaxChars: parseSubtitleMaxChars(sp.length),   // → 字幕折行（画面）
    subtitleMaxLines: parseSubtitleMaxLines(sp.length),   // → 提示用（不强制）
    targetLufs: parseTargetLufs(snd.mix_rules),           // → 响度归一目标（音频）
    // ── 供下游智能体参考的提示（打印，不改画面）──
    essence: firstSentence(dna.essence),
    idioms: Array.isArray(dna.idioms) ? dna.idioms.length : 0,
    materials: arrLen(dna.materials_and_rendering),
    variationSpace: firstSentence(dna.variation_space),
    // ── 「编排手法」六项：改动前**零读取**（不进渲染、也不被打印）⇒ 现在至少打印给编排智能体 ──
    //    ★ 纯提示：只进日志。渲染侧只读 subtitleMaxChars（见 lib/dub-core.mjs:668 subtitlePerLine），
    //      这六个键**没有任何渲染消费者**，故不改变成片（零副作用）。
    //    ★ 每项截到 DNA_AGENT_FIELD_CAP 字；缺项 → ''（describeStyleDna 会跳过）。
    narrativeRhythm: clipDnaField(dna.narrative_rhythm),
    shotLogic: clipDnaField(dna.shot_logic),
    atmosphere: clipDnaField(dna.atmosphere),
    tone: clipDnaField(dna.tone),
    taboos: clipDnaField(dna.taboos),
    assetContract: clipDnaField(dna.asset_contract),
  };
}

/** 生成「本次用到了哪些 DNA 特质」的可读行（供 dub.mjs 打印；不含 ANSI 色码）。 */
export function describeStyleDna(sum) {
  if (!sum) return [];
  const out = [];
  const src = `style-dna/${sum.slug}.json`;
  const capTxt = sum.subtitleMaxChars == null
    ? '（档案未给单行字符上限 → 沿用通用折行）'
    : `${sum.subtitleMaxChars} 字符/行`;
  out.push(`sentence_patterns.length → 字幕单行上限 ${capTxt}（来自 ${src}）`);
  if (sum.targetLufs != null) out.push(`sound_palette.mix_rules → 响度目标 ${sum.targetLufs} LUFS（来自 ${src}）`);
  const bits = [];
  if (sum.idioms) bits.push(`母题 ${sum.idioms} 条`);
  if (sum.materials) bits.push(`材料/渲染 ${sum.materials} 条`);
  if (bits.length) out.push(`${bits.join(' · ')}（供下游智能体；不直接改画面）`);
  // ── 编排手法六项：改动前**零读取**（不进渲染、也不被打印）⇒ 这里显式打给编排智能体 ──
  //    ★ 只打印、零副作用：渲染只读 subtitleMaxChars（lib/dub-core.mjs:668），这六项无人消费。
  //    ★ 空/缺失的项直接跳过 —— 不留空行噪声；每项已由 summarizeStyleDna 截到
  //      DNA_AGENT_FIELD_CAP 字（六项合计 ≤ 600 字，构造上封顶）。
  const craft = [
    ['narrative_rhythm', sum.narrativeRhythm],
    ['shot_logic', sum.shotLogic],
    ['atmosphere', sum.atmosphere],
    ['tone', sum.tone],
    ['taboos', sum.taboos],
    ['asset_contract', sum.assetContract],
  ].filter(([, v]) => v);
  if (craft.length) {
    out.push(`编排手法 ${craft.length} 项（供下游智能体；不直接改画面；每项截断到 ${DNA_AGENT_FIELD_CAP} 字）`);
    for (const [k, v] of craft) out.push(`${k} → ${v}（来自 ${src}）`);
  }
  return out;
}
