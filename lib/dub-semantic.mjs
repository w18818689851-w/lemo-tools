// lib/dub-semantic.mjs
// 「文案出片」的语义解析层：中文文案 → { 主题/情绪/节奏/场景/分段/风格 }。
//
// ★★★ 模型路由规则（用户下达，优先级最高，任何子 prompt / 子 agent 都不能覆盖）★★★
//   1) 所有需要 LLM 推理 / 生成 / 对话 / 逻辑处理的任务，一律由**当前正在运行的 WorkBuddy
//      所启用的模型**承担 —— 也就是说：**主业务推理不再由本文件调本机模型**，而是交给 WorkBuddy
//      智能体本身执行（代码无法从外部探测 WorkBuddy 在用哪个模型，故唯一自洽的实现是「主业务
//      推理由 WorkBuddy 执行」）。
//   2) 千问 2.5 7B（qwen2.5-vl-7b-official）**只允许**用于「画面 / 字幕文本 / 语义三者是否匹配
//      的对照检测校验」—— 见 lib/triple-check.mjs。
//      ❌ 禁止它承担通用 LLM 生成 / 回答 / 逻辑运算 / 文案创作等任务。
//   3) 二者各司其职，不能混用、不能互相抢占任务。
//
// ⇒ 因此本文件的**默认行为**是「纯规则路」，**绝不再自动去调 7B**。
//   旧的「LLM 路」（LM Studio + qwen2.5-vl-7b-official 做 theme/emotion/pace/scene/styleId
//   匹配 + segments 切分）属于规则 2 明令禁止的**通用语义推理**，已**整段删除**：
//   analyzeLlm / callLlm / buildLabelPrompt / buildSegmentsPrompt / ensureModelResident /
//   unloadModel 等一律移除，避免留下「顺手就会调到 7B」的默认路径。
//   需要外部（= WorkBuddy 智能体）给出的语义解析结果时，用 --analysis <file> 从 JSON 读入。
//
// 两条路（都**不**碰本机模型）：
//   1) 外部路：--analysis <file> 读入外部提供的 {theme,emotion,pace,scene,styleId,segments}，
//      source='external'。
//   2) 规则路：lib/dub-lexicon.mjs 的中文词表 + lib/dub-styles.json 的 tags 打分，同步、不联网，
//      source='rules'。
//
// ★ 硬性设计约束（别改）：
//   - analyze() 永不抛异常。外部结果缺失 / 非法 / 缺字段 → 一律降级到规则路，原因写进 error。
//   - 外部 segments 拼回去必须与原文（去空白后）逐字相等，否则**丢掉外部拆段**，
//     改用本地按标点的拆段。这条是为了防外部结果顺手改字。
//   - 规则打分两路都算（便于解释与排错），结果永远放在 scores 里。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAG_LEXICON } from './dub-lexicon.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const STYLES_PATH = path.join(HERE, 'dub-styles.json');

// 允许出现的 role（冻结）
export const ROLES = ['开场', '背景', '论点', '例证', '转折', '结论', '行动号召', '其他'];
// 打分权重：主题 > 情绪 > 场景 > 节奏
const W = { theme: 3, emotion: 2, scene: 1.5, pace: 0.5, visual: 1.0 };

// ── 口播视频的「画面气质」维度（2026-10-04 补）────────────────────
// ★ 由来：需求里写明「未指定风格时，按文案主题、情绪、节奏、**口播视频画面气质**匹配」，
//   但此前 `matchStyle` 的四个维度**全部来自文案**（`dub.mjs` 只传 text）⇒ 这一项**没实现**。
// ★ 为什么权重给 1.0（低于 scene 1.5、高于 pace 0.5）：画面气质是**重要但不应压过语义**的维度 ——
//   它只在语义接近时起决定作用，不会把一篇讲 AI 的稿子配成完全不相干的风格。
// ★ 打分口径：**字幕在这段画面上读不读得清**（可比、可解释）。
//   取该风格的字幕**底衬色**（有底衬）或**字幕色**（无底衬）与视频平均亮度的**对比度**：
//   对比度越高越适合；低于 WCAG 大字阈值（3.0）记 0 分。
const VIS_MIN_CONTRAST = 3.0;   // WCAG 大字（≥18pt）最低对比度
const VIS_GOOD_CONTRAST = 7.0;  // 达到即满分

/** sRGB 相对亮度（与 `lib/dub-core.mjs#relativeLuminance` 同口径；此处内联以保持本模块零依赖）。 */
function relLum(rgb) {
  const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
const hexToRgb = (h) => {
  const s = String(h || '').replace(/^#/, '').slice(-6);   // 去掉可能的 AA 前缀（ASS 用 AARRGGBB）
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const contrast = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** 该风格在给定画面亮度下的**字幕可读性**得分（0..1）。 */
function visualScore(style, visual) {
  if (!visual || !Number.isFinite(visual.luma)) return null;
  const pal = style.palette || {};
  const plate = hexToRgb(pal.subtitleBack);
  const text = hexToRgb(pal.subtitle);
  // 有**不透明底衬**就按底衬算（底衬才是压在画面上的那一层）；否则按字幕色算
  const front = plate || text;
  if (!front) return null;
  const bgLum = Math.max(0, Math.min(255, visual.luma));
  const c = contrast(front, [bgLum, bgLum, bgLum]);
  if (c < VIS_MIN_CONTRAST) return 0;
  return Math.min(1, (c - VIS_MIN_CONTRAST) / (VIS_GOOD_CONTRAST - VIS_MIN_CONTRAST));
}

// ── 注册表 ──────────────────────────────────────────────────────
let _cache = null;
let _cacheMtime = 0;

/** 读风格注册表（带缓存，按 mtime 失效）。读不到就抛——这是配置错误，不该静默。 */
export function loadStyles() {
  const st = fs.statSync(STYLES_PATH);
  if (_cache && _cacheMtime === st.mtimeMs) return _cache;
  const j = JSON.parse(fs.readFileSync(STYLES_PATH, 'utf8'));
  if (!Array.isArray(j.styles) || !j.styles.length) throw new Error('dub-styles.json: styles 为空');
  if (!j.styles.some((s) => s.id === j.default)) throw new Error(`dub-styles.json: default="${j.default}" 不在 styles 里`);
  _cache = j;
  _cacheMtime = st.mtimeMs;
  return j;
}

function pickStyles(styleIds) {
  const reg = loadStyles();
  if (!Array.isArray(styleIds) || !styleIds.length) return reg.styles;
  const allow = new Set(styleIds);
  const hit = reg.styles.filter((s) => allow.has(s.id));
  return hit.length ? hit : reg.styles;   // 全是不认识的 id → 退回全集
}

// ── 打分 ────────────────────────────────────────────────────────
// 命中判定：双向子串。这样外部路与规则路都能用同一套判据——
//   规则路的 scene 是一个 tag（如 "纸张"），外部路的 scene 是一句自由文本（如 "评测笔记本的参数和使用体验"），
//   双向子串让 "评测" 这种 tag 在一句话里也能命中。
function hasTag(tags, q) {
  if (!q) return false;
  for (const tag of tags || []) {
    if (!tag) continue;
    if (q.includes(tag) || tag.includes(q)) return true;
  }
  return false;
}

/**
 * 把 {theme,emotion,pace,scene} 与每个风格的 tags 做加权打分。
 * 每个命中的主题词 +3，情绪 +2，场景 +1.5，节奏 +0.5（权重 W）。
 * 再除以「本次输入理论上能拿到的满分」→ 0..1 的 scores（即对输入的召回率）。
 * 没有任何命中时返回 default 风格（matched:false）。
 */
export function matchStyle({ theme, emotion, pace, scene, visual } = {}, styles) {
  const list = styles || loadStyles().styles;
  const themes = Array.isArray(theme) ? theme.filter(Boolean) : (theme ? [theme] : []);
  // ★ `visual` 缺省时**不把 W.visual 计入分母** ⇒ 没有口播视频时（功能1 / 纯文案）
  //   打分与改动前**逐字节一致**，不回归。
  const useVisual = !!(visual && Number.isFinite(visual.luma));
  const denom = W.theme * themes.length + W.emotion + W.scene + W.pace + (useVisual ? W.visual : 0);

  const scores = {};
  let bestId = null;
  let bestRaw = 0;
  for (const s of list) {
    const t = s.tags || {};
    let raw = 0;
    for (const th of themes) if (hasTag(t.theme, th)) raw += W.theme;
    if (hasTag(t.emotion, emotion)) raw += W.emotion;
    if (hasTag(t.scene, scene)) raw += W.scene;
    if (hasTag(t.pace, pace)) raw += W.pace;
    if (useVisual) raw += W.visual * (visualScore(s, visual) ?? 0);
    scores[s.id] = denom > 0 ? Math.round((raw / denom) * 100) / 100 : 0;
    if (raw > bestRaw) { bestRaw = raw; bestId = s.id; }   // 严格大于 → 同分时注册表靠前的胜出
  }

  if (!bestId) {
    const def = loadStyles().default;
    return { styleId: def, scores, matched: false };
  }
  return { styleId: bestId, scores, matched: true };
}

// ── 规则路 ──────────────────────────────────────────────────────
function stripWs(s) { return String(s ?? '').replace(/\s+/g, ''); }

/** 统计触发词命中：n = 命中的触发词个数，first = 最早命中位置（用于同分时定序）。 */
function hits(text, words) {
  let n = 0;
  let first = Infinity;
  for (const w of words) {
    if (!w) continue;
    const i = text.indexOf(w);
    if (i >= 0) { n++; if (i < first) first = i; }
  }
  return { n, first };
}

/** 排序：命中数多的优先；同分时「先出现的」优先（开头提到的多半就是主题）。
 *  这样能避免一堆 n=1 的噪声词按注册表顺序把真主题挤出前 5。 */
function rank(hitList, cap) {
  return hitList
    .sort((a, b) => (b.n - a.n) || (a.first - b.first) || a.tag.localeCompare(b.tag))
    .slice(0, cap)
    .map((x) => x.tag);
}

/** 按中文标点切句，再把过短的句子并进前一句。 */
function splitByPunct(text) {
  const clean = String(text ?? '').replace(/\r/g, '').trim();
  if (!clean) return [];
  const parts = clean
    .split(/(?<=[。！？!?；;…\n])/)
    .map((s) => s.trim())
    .filter(Boolean);
  // 合并：短于 8 字的句子并进前一句（避免「好。」单独成段）
  const out = [];
  for (const p of parts) {
    if (out.length && (p.length < 8 || out[out.length - 1].length < 8)) out[out.length - 1] += p;
    else out.push(p);
  }
  return out.length ? out : [clean];
}

const ROLE_RULES = [
  [/行动号召|点赞|关注|收藏|转发|评论区|试试看|行动起来|下单|预约|来一?起/ , '行动号召'],
  [/总结|总之|最后|综上|所以|因此|说到底|归根结底/, '结论'],
  [/但是|然而|不过|可是|其实|反过来|话说回来/, '转折'],
  [/例如|比如|举例|举个|拿.{0,6}来说|以.{0,6}为例|譬如/, '例证'],
  [/首先|其次|然后|接着|第一|第二|第三|一方面|另一方面|另外/, '论点'],
  [/随着|如今|现在|当下|这些年|这几年|一直以来|背景/, '背景'],
];

function roleOf(text, idx, total) {
  for (const [re, role] of ROLE_RULES) if (re.test(text)) return role;
  if (idx === 0) return '开场';
  if (idx === total - 1 && total >= 3) return '结论';
  return '其他';
}

/** 纯规则解析：同步、不联网、不调任何本机模型。pace 一律给 '中' 占位（真节奏由 TTS 时长算）。 */
export function analyzeByRules({ text, styleIds, visual } = {}) {
  const t = String(text ?? '');
  const list = pickStyles(styleIds);

  // 主题：对每个 tag 统计触发词命中数
  const themeHits = [];
  for (const s of list) for (const tag of s.tags?.theme || []) {
    const h = hits(t, TAG_LEXICON.theme[tag] || []);
    if (h.n > 0) themeHits.push({ tag, ...h });
  }
  const theme = rank(dedupeByKey(themeHits, (x) => x.tag), 5);   // 取前 5，与外部路的 3-6 个对齐

  // 情绪：取命中最多的一档
  const emoHits = [];
  for (const s of list) for (const tag of s.tags?.emotion || []) {
    const h = hits(t, TAG_LEXICON.emotion[tag] || []);
    if (h.n > 0) emoHits.push({ tag, ...h });
  }
  const emotion = rank(dedupeByKey(emoHits, (x) => x.tag), 1)[0] || '中性';

  // 场景：同理
  const scHits = [];
  for (const s of list) for (const tag of s.tags?.scene || []) {
    const h = hits(t, TAG_LEXICON.scene[tag] || []);
    if (h.n > 0) scHits.push({ tag, ...h });
  }
  const scene = rank(dedupeByKey(scHits, (x) => x.tag), 1)[0] || '';

  const pace = '中';   // ★ 规则不判节奏，占位；真节奏由 TTS 时长算

  const parts = splitByPunct(t);
  const segments = parts.map((s, i) => ({ i: i + 1, text: s, role: roleOf(s, i, parts.length) }));

  const { styleId, scores, matched } = matchStyle({ theme, emotion, pace, scene, visual }, list);

  return {
    ok: true,
    source: 'rules',
    model: null,
    ms: 0,
    segments,
    theme,
    emotion,
    pace,
    scene,
    styleId,
    stylePickedBy: matched ? 'rules' : 'default',
    scores,
    llmRaw: null,
    error: null
  };
}

function dedupeByKey(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    const cur = m.get(k);
    if (!cur || x.n > cur.n) m.set(k, x);
  }
  return [...m.values()];
}

// ── 外部路（--analysis）─────────────────────────────────────────
// 形状与 analyze() 的返回一致：{theme, emotion, pace, scene, styleId, segments}。
// 只做**校验 + 归一**，不做任何生成 —— 生成是 WorkBuddy 智能体那边的事。
//
// 校验策略：逐字段「能用就用，不能用就退回规则路的那一项」，并把原因累积到 error。
//   · theme       必须是字符串数组（过滤空串），否则退回规则的 theme
//   · emotion     必须是非空字符串，否则退回规则
//   · pace        必须是 快/中/慢，否则退回 '中'
//   · scene       必须是非空字符串，否则退回规则
//   · styleId     必须在候选白名单里，否则退回规则打分
//   · segments    必须是 [{text,role}]，且**拼回原文（去空白）逐字相等**；否则退回本地按标点拆段
// 只要有任何一项用了外部值，source='external'；若全部退回，source='rules'（等于没用上外部结果）。
function normalizeExternal(ext, { text, styleIds, rules, visual }) {
  const list = pickStyles(styleIds);
  const allow = new Set(list.map((s) => s.id));
  const notes = [];
  let used = false;

  if (!ext || typeof ext !== 'object' || Array.isArray(ext)) {
    return { ...rules, error: '外部解析结果不是对象，已降级规则' };
  }

  // theme
  let theme = rules.theme;
  if (Array.isArray(ext.theme)) {
    const t = ext.theme.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).slice(0, 6);
    if (t.length) { theme = t; used = true; }
    else notes.push('theme 为空数组');
  } else if (ext.theme !== undefined) notes.push('theme 非数组');

  // emotion
  let emotion = rules.emotion;
  if (typeof ext.emotion === 'string' && ext.emotion.trim()) { emotion = ext.emotion.trim(); used = true; }
  else if (ext.emotion !== undefined) notes.push('emotion 非字符串');

  // pace
  let pace = rules.pace;
  if (['快', '中', '慢'].includes(ext.pace)) { pace = ext.pace; used = true; }
  else if (ext.pace !== undefined) notes.push(`pace 非法（${JSON.stringify(ext.pace)}）`);

  // scene
  let scene = rules.scene;
  if (typeof ext.scene === 'string' && ext.scene.trim()) { scene = ext.scene.trim(); used = true; }
  else if (ext.scene !== undefined) notes.push('scene 非字符串');

  // segments
  let segments = null;
  if (Array.isArray(ext.segments) && ext.segments.length) {
    const segs = ext.segments
      .map((s) => ({
        text: typeof s?.text === 'string' ? s.text : '',
        role: ROLES.includes(s?.role) ? s.role : '其他'
      }))
      .filter((s) => s.text);
    if (!segs.length) {
      notes.push('segments 全为空文本');
    } else if (stripWs(segs.map((s) => s.text).join('')) !== stripWs(text)) {
      notes.push('segments 拼回与原文不一致（疑似改字）');
    } else {
      segments = segs.map((s, i) => ({ i: i + 1, text: s.text, role: s.role }));
      used = true;
    }
  } else if (ext.segments !== undefined) {
    notes.push('segments 缺失或非法');
  }

  // styleId
  const rulePick = matchStyle({ theme, emotion, pace, scene, visual }, list);
  let styleId = rulePick.styleId;
  let stylePickedBy = rulePick.matched ? 'rules' : 'default';
  if (typeof ext.styleId === 'string' && allow.has(ext.styleId.trim())) {
    styleId = ext.styleId.trim();
    stylePickedBy = 'external';
    used = true;
  } else if (ext.styleId !== undefined) {
    notes.push(`styleId="${ext.styleId}" 不在候选里`);
  }

  if (!segments) segments = rules.segments;

  if (!used) {
    return { ...rules, error: `外部解析结果全部字段不可用（${notes.join('；') || '无有效字段'}），已降级规则` };
  }
  return {
    ok: true,
    source: 'external',
    model: null,
    ms: 0,
    segments,
    theme,
    emotion,
    pace,
    scene,
    styleId,
    stylePickedBy,
    scores: rulePick.scores,
    llmRaw: null,
    error: notes.length ? `部分字段退回规则：${notes.join('；')}` : null
  };
}

// ── 主入口 ──────────────────────────────────────────────────────
/**
 * 语义解析 + 风格匹配。永不抛异常、永不调本机模型。
 * @param {{text:string, styleIds?:string[], timeoutMs?:number, analysis?:object}} o
 *   analysis —— 可选。外部（WorkBuddy 智能体）提供的语义解析结果，形状
 *               {theme, emotion, pace, scene, styleId, segments}。给了就用，source='external'。
 *   styleIds —— 可选风格白名单（= 用户允许的范围）。**长度为 1 时视为用户显式指定**，
 *               此时 stylePickedBy='user'，跳过一切挑选。
 *   timeoutMs —— 保留参数（纯规则路同步执行，不再有网络等待；仅为兼容旧调用方）。
 */
export async function analyze(o = {}) {
  const { text, styleIds, analysis, visual } = o;
  const txt = String(text ?? '');
  const t0 = Date.now();
  try {
    const rules = analyzeByRules({ text: txt, styleIds, visual });

    // 用户显式指定（白名单只有一个 id）→ 直接采用，其余字段仍走规则/外部
    const list = pickStyles(styleIds);
    const userFixed = Array.isArray(styleIds) && styleIds.length === 1 && list.length === 1;

    let r;
    if (analysis !== undefined && analysis !== null) {
      r = normalizeExternal(analysis, { text: txt, styleIds, rules, visual });
    } else {
      r = rules;
    }
    if (userFixed) r = { ...r, styleId: list[0].id, stylePickedBy: 'user' };
    return { ...r, ms: Date.now() - t0 };
  } catch (e) {
    // 规则路本身出错（例如注册表损坏）也不抛：给一个最小可用的兜底结果。
    return {
      ok: false, source: 'rules', model: null, ms: Date.now() - t0,
      segments: [{ i: 1, text: txt, role: '其他' }],
      theme: [], emotion: '中性', pace: '中', scene: '',
      styleId: 'plain-dark', stylePickedBy: 'default', scores: {},
      llmRaw: null, error: String((e && e.message) || e)
    };
  }
}
