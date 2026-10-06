#!/usr/bin/env node
/**
 * scripts/check-derivation-caliber.mjs —— 「派生口径」的**机器可读 + 有闸门守**校验
 *
 * ★ 由来（2026-10-06）：`lib/dub-styles.json` 是「文案 + 风格」通路的**唯一可渲染消费入口**
 *   （43 个真实风格 + 1 个合成基线 `plain-dark`）。它的配色/字体**多数不是逐行真抽**：
 *   · 34+ 个风格的 `subtitle.fontFamily` 填的是**本机 Windows 真实存在的字体**（Microsoft YaHei /
 *     SimHei / SimSun / KaiTi / DengXian / Consolas），而 STYLE.md 原本点名的 OFL 字体只写在 `notes` 里
 *     （`_notes[5]`）；
 *   · 派生条目（`derived:true`，32 条）的配色取自**证据层** `lib/dub-visual.json`，字幕字号/颜色走
 *     「分类别默认 + WCAG 对比度规则」（`_notes[11]`）；
 *   · 有 3 条的底色**落回 plain-dark 默认**（`bgSameAsDefault:true`，`_notes[13]`）；
 *   · 有若干条的 accent 按 `_notes[10]②` 的「`accent/bg` 一律提到 ≥4.5」被**换过**。
 *   这些口径此前**只写在散文里**（顶层 `_notes` 18 条 + 每条自己的 `notes`）⇒ 下游智能体**读不出**
 *   「哪个值是原文值、哪个是要替换的近似值」，一旦配置漂移也**没人拦得住**。
 *   本闸门把口径变成**每条 entry 自己的 `derivation` 对象**（机器可读）+ 机械判据（可校验）。
 *
 * ── 被校验的字段（**纯元数据，渲染侧不读**；顶层 `_notes` 第 19–23 条是它的判据说明）─────────
 *   每条 entry 一个对象，四个轴各取一个枚举值：
 *     "derivation": {
 *       "bg":       "exact" | "proxy" | "fallback",
 *       "font":     "exact" | "substituted",
 *       "subtitle": "exact" | "derived",
 *       "accent":   "exact" | "substituted" | "absent"
 *     }
 *   ★ **`derivation` 已登记进 `check-dna-coverage.mjs` 的 `DUB_METADATA` 白名单**（那条白名单就是该
 *     闸门为「**新元数据字段**」预留的人工入口，其头注释原话「**改的是清单，不是判据**」）。不登记会
 *     怎样：该闸门第二节会枚举注册表的**全部字段路径**（顶层键 + 每风格键 + 二级 + 三级），凡「全仓
 *     零读取 ∧ 不在白名单里」的路径**一律 FAIL** —— 实测 `✘ derivation：44/44 个风格声明了它，但全仓
 *     零读取 ⇒ 要么接线、要么加进 DUB_METADATA / DUB_UNIMPLEMENTED`，EXIT=1。（有意思的是嵌套的
 *     `derivation.bg` / `.font` / `.subtitle` / `.accent` **反而放行**：该闸门的消费者判据是**叶名匹配**，
 *     `.bg`/`.subtitle` 等叶名在运行时代码里撞得到 —— 也就是说它**只卡顶层键名**。）
 *   ★ **为什么不用 `_notes` 承载**（曾短暂用过的方案）：顶层 `_notes` 是**字符串数组**、而条目里若也叫
 *     `_notes` 就是**对象** —— 这正是「**同名不同层/不同型**」的 schema 债务。本项目刚为同型问题吃过亏
 *     （`LEMO_DUB_STYLES` 闸门侧与渲染侧同名不同义 ⇒ 变异验证出**假阴性**）⇒ 不值得为省一行白名单登记
 *     去背。`derivation` 与既有的 `derived` / `derivedFrom` / `bgSameAsDefault` **同类并列、自解释**。
 *   `exact` = 该值是本风格文档/代码的**原文值**；`proxy`/`substituted`/`derived` = 该值**不是**
 *   原文值（代理取色 / 本机字体替代 / 规则推得），知识库更新时应**优先替换**；`fallback` = 落回
 *   plain-dark 默认；`absent` = 本风格**没有**该值（`palette.accent` 为 null，不是「被替换」）。
 *   ★ `accent` 比题给的形状多一个 `absent`：null 既非 exact 也非 substituted，机器必须能区分 ——
 *     否则「没有强调色」会被读成「强调色是原文值」，那是**假的**。
 *
 * ── 判据（**只重算、不看散文**；全部只看本条自己的现有字段 + 证据层 dub-visual.json）────────
 *   ① **合法**：每条 entry 都有 `derivation` 对象，四个轴**齐全**、类型是字符串、取值在上述枚举内。
 *   ② **不自相矛盾**：把四个轴**按下面的规则重算一遍**，与文件里写着的值**逐轴比对**，不等即 FAIL。
 *      也就是说「矛盾」不是靠几条零散不变量抓的，而是「**与机械推导不一致**」一律 FAIL。
 *      · `bg = fallback` ⟺ `bgSameAsDefault === true` 或 `palette.bg` 为空；
 *        否则 `bg = proxy` ⟺ 非合成基线 ∧ notes 不含「已修（配色）」∧
 *                              `palette.bg` ≠ `lib/dub-visual.json` 里该风格的 `palette.bg`（归一化后）；
 *        否则 `exact`。
 *      · `font = substituted` ⟺ `subtitle.fontFamily` 在本机字体表（`_notes[5]` 的六个）里 ∧ 非合成基线；
 *        否则 `exact`。
 *      · `subtitle = derived` ⟺ `derived === true` ∧ notes 里出现 `WCAG`；否则 `exact`。
 *      · `accent = absent` ⟺ `palette.accent` 为空；
 *        否则 `substituted` ⟺ 非「已修（配色）」∧ `palette.accent` ≠ dub-visual 里该风格的 `palette.accent`；
 *        否则 `exact`。
 *      ★ **为什么 bg/accent 用「与 dub-visual 不等」**：`lib/dub-visual.json` 是本注册表的**证据层**
 *        （`_notes[8]`：本文件是唯一可渲染消费入口，dub-visual 只做证据与技法层）。两者**不等**就说明
 *        这个色**不是**从 demo 代码逐字来的那一个 —— 或来自 STYLE.md 的示例色板（silkscreen-poster /
 *        blueprint）、或从 `bg2` 提升（microgame）、或按 `_notes[10]②` 的 `accent/bg ≥ 4.5` 规则调过
 *        （7 条：engraving / midcentury-toon / game-show / halftone-dossier / paper-popup / spy-titles /
 *        woodcut）—— 三种都属「**需人工/知识库复核、应优先替换**」的一路。这不是猜：那 7 条的
 *        `accent/bg` 对比度**全部落在 5.02–5.26**（规则目标 ≥4.5），而被替换掉的 demo 原值是 1.35–3.84。
 *   ③ **文档守门**：凡 `fallback` / `proxy` / `substituted` / `derived` 的条目，其
 *      `lib/style-skills/<slug>/SKILL.md` 里**必须有对应口径说明**（只读风格文档的人也不能被误导）：
 *      · `bg = fallback`  ⇒ 文档含（`兜底|回退`）∧（`底色|背景|palette`）；
 *      · `bg = proxy`     ⇒ 文档含该 `palette.bg` 的 hex ∧（`代理|派生|示例色板|§3|demo|dub-visual`）
 *                            ∧（`底色|背景|palette`）；
 *      · `font = substituted` ⇒ 文档含 `subtitle.fontFamily` 的字面值（读者要知道**实际用的**是哪个字体）；
 *      · `subtitle = derived` ⇒ 文档含（`派生|WCAG`）；
 *      · `accent = substituted` ⇒ 文档含该 `palette.accent` 的 hex ∧（`代理|派生|对比|替换|调整|提亮|压暗|可见`）。
 *      缺哪一条 ⇒ FAIL 并**点名该补哪一份文档**。
 *
 * ── 已知局限（如实记录，不粉饰）─────────────────────────────────────────────────────────
 *   · 四个轴只区分「**是不是原文值**」，**不**度量偏差大小，也不判断这个近似值够不够好。
 *   · `bg` / `accent` 的判据依赖 `lib/dub-visual.json` 的对应值 ⇒ **证据层一改，本字段可能变旧**
 *     （这正是本闸门要抓的漂移：要么更新 `derivation`，要么更新证据层）。
 *     判据是「归一化后**严格不等**」，没有容差 ⇒ 一个只差 1/255 的写法差异也会翻成 `proxy`。
 *     实测：真实语料里不等的情况**只有**「完全相等」与「差 ≥16.5」两档（后者即上面那 7 条 + 3 条底色），
 *     **没有**落在中间地带的 ⇒ 目前零误报；若将来出现中间档，应加容差并在此登记。
 *   · `font = substituted` 对**全部 43 个真实风格**成立（`_notes[5]` 规定一律填本机字体）——
 *     它表达的是「字体一律是替代品」，不是「只有部分风格被替代」；合成基线 plain-dark 的字体
 *     就是现网硬编码值，故记 `exact`。
 *   · ③ 的文档判据是**存在性**判据（关键词 + 值是否出现），**不**判断说明写得对不对、够不够。
 *     它是「补文档」的提醒，不是文档质量评分。
 *   · `_notes[11]` 说「11 条逐行真抽、32 条派生」，与本闸门的 `subtitle` 轴（exact 13 / derived 31）
 *     **口径不同**：本闸门看的是**字幕参数**这一路，`one-line` 虽 `derived:true`，但其 notes 有
 *     「整体取错已修正、已按源码真值改回」的记录且**不含 WCAG** ⇒ 记 `exact`。
 *
 * ★ 覆盖点（供**非破坏性**变异/夹具验证，不改真文件）：
 *   · `LEMO_DUB_STYLES`    注册表路径（默认 `D:/lemo-tools/lib/dub-styles.json`）
 *                          —— 与 `check-config-notes` / `check-config-vs-doc` / `check-dna-coverage` 同名同义。
 *   · `LEMO_DISTILL_ROOT`  SKILL.md 根（默认 `D:/lemo-tools/lib/style-skills`）
 *                          —— 与 `check-config-vs-doc` / `check-skill-scores` / `check-skill-artifacts` 同名同义。
 *   · `LEMO_DUB_VISUAL`    证据层路径（默认 `D:/lemo-tools/lib/dub-visual.json`）—— 本闸门新增。
 *
 * ★ 失明守卫（防空转绿灯；写法照 `check-config-vs-doc.mjs` 头注释的「★ 失明守卫」段 / `blind[]` 块、
 *   `check-lexicon-coverage.mjs` 的同型守卫）：下列任一成立 ⇒ 判 FAIL 并**明说「本闸门已失明」**，
 *   且**不再打印**分布统计与「✓」那两句（否则失明看起来像通过；非失明路径的输出保持逐字节不变）：
 *   ① 注册表读不到 / 解析失败；② `styles` 不是**非空数组**；③ 证据层 `dub-visual.json` 读不到 /
 *   解析失败 / `styles` 不是非空对象（`bg`/`accent` 两轴的判据全靠它，读不到就等于没检查）；
 *   ④ 一个 SKILL.md 都读不到（③ 文档守门整条失效）；⑤ `_notes[5]` 里不再出现本机字体表（判据前提变了）。
 *   ★ 正常态输出与「无此闸门」等价：本闸门只读文件、只打印自己的结论，不改任何既有输出/退出码。
 *
 * 用法：node scripts/check-derivation-caliber.mjs [--json]
 * 退出码：有 FAIL（①/②/③ 任一，或失明）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const CFG = process.env.LEMO_DUB_STYLES || path.join(ROOT, 'lib', 'dub-styles.json');
const VIS = process.env.LEMO_DUB_VISUAL || path.join(ROOT, 'lib', 'dub-visual.json');
const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(ROOT, 'lib', 'style-skills'));
const JSON_OUT = process.argv.includes('--json');

/** 口径块的键名（**单一常量**：将来若要改名只改这一行）。
 *  ★ 为什么是 `derivation`：与既有的 `derived` / `derivedFrom` / `bgSameAsDefault` 同类并列、自解释；
 *    它已登记进 `check-dna-coverage.mjs` 的 `DUB_METADATA` 白名单（见文件头）。 */
const FIELD = 'derivation';
const AXES = ['bg', 'font', 'subtitle', 'accent'];
const ENUM = {
  bg: ['exact', 'proxy', 'fallback'],
  font: ['exact', 'substituted'],
  subtitle: ['exact', 'derived'],
  accent: ['exact', 'substituted', 'absent'],
};

/** 本机字体表 —— 判据前提，直接对齐 `_notes[5]`（失明守卫 ⑤ 会核对它没被改）。 */
const LOCAL_FONTS = ['Microsoft YaHei', 'SimHei', 'SimSun', 'KaiTi', 'DengXian', 'Consolas'];
const LOCAL_FONT_SET = new Set(LOCAL_FONTS);
/** 「本条配色已按源码真值替换」的标记（cel-anime-80s / impasto 的 notes 里有）。 */
const COLOR_FIXED = /已修（配色）|已修\(配色\)/;

const norm = (h) => String(h == null ? '' : h).toUpperCase().replace(/^#/, '');
const hex6 = (h) => /^[0-9A-F]{6}$/.test(norm(h));

// ── 读文件 ────────────────────────────────────────────────────────────────
const blind = [];
let cfg = null;
try { cfg = JSON.parse(fs.readFileSync(CFG, 'utf8')); }
catch (e) { blind.push(`注册表读不到 / 不是 JSON：${CFG}（${(e && e.message) || e}）`); }
if (cfg && (!Array.isArray(cfg.styles) || !cfg.styles.length)) {
  const got = cfg.styles === undefined ? 'undefined（缺字段）'
    : Array.isArray(cfg.styles) ? '空数组' : `${typeof cfg.styles}（疑似改了 schema？）`;
  blind.push(`注册表的 \`styles\` 不是**非空数组**（实得：${got}）⇒ 一条 entry 都没检查过`);
}

let vis = null;
try { vis = JSON.parse(fs.readFileSync(VIS, 'utf8')); }
catch (e) { blind.push(`证据层读不到 / 不是 JSON：${VIS}（${(e && e.message) || e}）`); }
if (vis && (!vis.styles || typeof vis.styles !== 'object' || Array.isArray(vis.styles) || !Object.keys(vis.styles).length)) {
  blind.push(`证据层的 \`styles\` 不是**非空对象** ⇒ \`bg\`/\`accent\` 两轴的判据失去依据`);
}

// ★ 这里是**顶层** `_notes`（字符串数组，= 文件内文档 / 判据说明）；每条 entry 的 `derivation` 是**口径块对象**（见 `FIELD`）。
const topNotes = cfg && Array.isArray(cfg._notes) ? cfg._notes : [];
const fontNote = topNotes.find((n) => /fontFamily\s*一律填本机/.test(String(n))) || null;
if (!blind.length && !fontNote) blind.push('`_notes` 里找不到「fontFamily 一律填本机…」那条 ⇒ 判据前提（本机字体表）失据');
else if (fontNote && LOCAL_FONTS.some((f) => !String(fontNote).includes(f))) {
  blind.push('`_notes` 的「本机字体」那条不再列全本闸门的本机字体表 ⇒ 判据前提变了，请同步 `LOCAL_FONTS`');
}

const styles = cfg && Array.isArray(cfg.styles) ? cfg.styles : [];
const mdCache = new Map();
let mdRead = 0;
for (const e of styles) {
  const slug = e.slug || e.id;
  const p = path.join(DIR, slug, 'SKILL.md');
  const t = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  mdCache.set(slug, t);
  if (t !== null) mdRead++;
}
if (!blind.length && mdRead === 0) {
  blind.push(`\`${DIR}\` 下一个 SKILL.md 都读不到（${styles.length} 个风格全缺）⇒ ③ 文档守门整条失效，什么都没检查`);
}

if (blind.length) {
  // 失明时**只**打这一段：不打分布统计、也不打「✓」（否则失明看起来像通过）。
  // ★ `--json` 时：人读的失明说明走 **stderr**、机器读的 JSON 走 **stdout**（stdout 保持纯 JSON）。
  const out = JSON_OUT ? console.error : console.log;
  out(`\n✘ 本闸门已失明：`);
  for (const b of blind) out(`  ✘ ${b}`);
  out(`\n[闸门] 派生口径 **已失明** ✘`);
  if (JSON_OUT) console.log(JSON.stringify({ blind, ok: false }, null, 2));
  process.exit(1);
}

// ── 机械重算：由本条自己的字段 + 证据层推出四个轴（判据见文件头）──────────────
function derive(e) {
  const n = String(e.notes || '');
  const vs = (vis.styles && vis.styles[e.slug || e.id]) || {};
  const vPal = vs.palette || {};
  const synthetic = e.synthetic === true;
  const cfix = COLOR_FIXED.test(n);

  let bg;
  if (e.bgSameAsDefault === true || !e.palette || !e.palette.bg) bg = 'fallback';
  else if (!synthetic && !cfix && norm(e.palette.bg) !== norm(vPal.bg)) bg = 'proxy';
  else bg = 'exact';

  const font = (!synthetic && LOCAL_FONT_SET.has(e.subtitle && e.subtitle.fontFamily)) ? 'substituted' : 'exact';
  const subtitle = (e.derived === true && /WCAG/.test(n)) ? 'derived' : 'exact';

  let accent;
  if (!e.palette || !e.palette.accent) accent = 'absent';
  else if (!cfix && hex6(vPal.accent) && norm(e.palette.accent) !== norm(vPal.accent)) accent = 'substituted';
  else accent = 'exact';

  return { bg, font, subtitle, accent };
}

/** ③ 文档守门判据（判据见文件头；只做**存在性**判定）。 */
function docOk(axis, value, e, md) {
  const hex = (h) => new RegExp(`#${norm(h).toLowerCase()}(?![0-9a-f])`, 'i').test(md);
  if (axis === 'bg' && value === 'fallback') return /兜底|回退/.test(md) && /底色|背景|palette/.test(md);
  if (axis === 'bg' && value === 'proxy') return hex(e.palette.bg) && /代理|派生|示例色板|§3|demo|dub-visual/.test(md) && /底色|背景|palette/.test(md);
  if (axis === 'font') return md.includes(e.subtitle.fontFamily);
  if (axis === 'subtitle') return /派生|WCAG/.test(md);
  if (axis === 'accent') return hex(e.palette.accent) && /代理|派生|对比|替换|调整|提亮|压暗|可见/.test(md);
  return true;
}

const NEED_DOC = {
  bg: (v) => v === 'fallback' || v === 'proxy',
  font: (v) => v === 'substituted',
  subtitle: (v) => v === 'derived',
  accent: (v) => v === 'substituted',
};

const fails = [];
const dist = {};
for (const a of AXES) dist[a] = {};
const rows = [];

for (const e of styles) {
  const slug = e.slug || e.id || '(未命名)';
  const want = derive(e);
  // ★ 分布统计按**机械重算**的值计（与文件里写着的值无关）⇒ 即使 ①② 失败，统计仍然完整、可读。
  for (const a of AXES) dist[a][want[a]] = (dist[a][want[a]] || 0) + 1;
  rows.push({ slug, ...want });

  // ① 合法
  const blk = e[FIELD];
  if (!blk || typeof blk !== 'object' || Array.isArray(blk)) {
    fails.push(`① ${slug}：缺 \`${FIELD}\` 块（或不是对象）`);
    continue;
  }
  const extra = Object.keys(blk).filter((k) => !AXES.includes(k));
  if (extra.length) fails.push(`① ${slug}：\`${FIELD}\` 里有未登记的轴 ${extra.map((x) => `\`${x}\``).join('、')}（只允许 ${AXES.join(' / ')}）`);
  let shapeBad = false;
  for (const a of AXES) {
    const v = blk[a];
    if (typeof v !== 'string' || !ENUM[a].includes(v)) {
      fails.push(`① ${slug}：\`${FIELD}.${a}\` 取值非法（实得 ${JSON.stringify(v)}；合法：${ENUM[a].join(' | ')}）`);
      shapeBad = true;
    }
  }
  if (shapeBad) continue;

  // ② 不自相矛盾（= 与机械重算逐轴一致）
  for (const a of AXES) {
    if (blk[a] !== want[a]) {
      fails.push(`② ${slug}：\`${FIELD}.${a}\` = "${blk[a]}"，但按本条字段机械推得 "${want[a]}"`
        + `（${reason(a, want[a], e, vis)}）⇒ 两者必有一个是错的`);
    }
  }

  // ③ 文档守门
  const md = mdCache.get(slug);
  const mdPath = path.join(DIR, slug, 'SKILL.md');
  for (const a of AXES) {
    if (!NEED_DOC[a](want[a])) continue;
    if (md === null) { fails.push(`③ ${slug}：\`${a}=${want[a]}\`，但**没有** \`${mdPath}\` ⇒ 请补文档`); continue; }
    if (!docOk(a, want[a], e, md)) {
      fails.push(`③ ${slug}：\`${a}=${want[a]}\`，但 \`${mdPath}\` 里**没有对应口径说明** ⇒ 请在该文档补一句`);
    }
  }
}

/** 给 ② 的失败信息补一句「为什么这么推」（可解释性；不参与判据）。 */
function reason(axis, v, e, visObj) {
  const vs = (visObj.styles && visObj.styles[e.slug || e.id]) || {};
  const vPal = vs.palette || {};
  if (axis === 'bg') {
    if (v === 'fallback') return `bgSameAsDefault=${JSON.stringify(e.bgSameAsDefault)}、palette.bg=${JSON.stringify(e.palette && e.palette.bg)}`;
    if (v === 'proxy') return `derived=${JSON.stringify(e.derived)}、palette.bg=${e.palette && e.palette.bg} ≠ dub-visual 的 ${JSON.stringify(vPal.bg)}`;
    return `derived=${JSON.stringify(e.derived)}、已修（配色）=${COLOR_FIXED.test(String(e.notes || ''))}、palette.bg=${e.palette && e.palette.bg} = dub-visual`;
  }
  if (axis === 'font') return v === 'substituted'
    ? `fontFamily="${e.subtitle && e.subtitle.fontFamily}" 是本机字体表之一、且非合成基线`
    : `synthetic=${JSON.stringify(e.synthetic)}、fontFamily="${e.subtitle && e.subtitle.fontFamily}"`;
  if (axis === 'subtitle') return v === 'derived'
    ? `derived=true 且 notes 含 WCAG`
    : `derived=${JSON.stringify(e.derived)}、notes 含 WCAG=${/WCAG/.test(String(e.notes || ''))}`;
  return v === 'absent' ? `palette.accent=${JSON.stringify(e.palette && e.palette.accent)}`
    : v === 'substituted' ? `palette.accent=${e.palette && e.palette.accent} ≠ dub-visual 的 ${JSON.stringify(vPal.accent)}`
      : `palette.accent=${e.palette && e.palette.accent} = dub-visual`;
}

// ── 输出 ──────────────────────────────────────────────────────────────────
const show = (a) => ENUM[a].map((v) => `${v} ${dist[a][v] || 0}`).join(' / ');
if (JSON_OUT) {
  console.log(JSON.stringify({ styles: styles.length, field: FIELD, dist, rows, fails, ok: !fails.length }, null, 2));
} else {
  console.log(`派生口径校验 —— lib/dub-styles.json 的 \`${FIELD}\` 块`);
  console.log(`  注册表 : ${CFG}`);
  console.log(`  证据层 : ${VIS}`);
  console.log(`  文档根 : ${DIR}（读到 ${mdRead}/${styles.length} 份 SKILL.md）`);
  console.log(`  风格数 : ${styles.length}；口径轴：${AXES.join(' / ')}`);
  console.log('');
  for (const a of AXES) console.log(`  ${a.padEnd(9)} ${show(a)}`);
  console.log('');
  if (fails.length) {
    console.log(`✘ 派生口径失败 ${fails.length} 条：`);
    for (const f of fails) console.log(`  ${f}`);
  } else {
    console.log(`✓ 每条 entry 的 \`${FIELD}\` 都合法、与字段机械推导一致，且需说明的口径都在各自 SKILL.md 里有说明。`);
  }
}

// ★ `--json` 时把汇总行走 **stderr**，stdout 保持**纯 JSON**（可 `JSON.parse`）—— 与
//   `check-film-delivery.mjs` 的 `[E]` 行同一约定（否则管道里多一行中文汇总就解析失败）。
const summary = `[闸门] 派生口径：失败 ${fails.length} 条、失明 0 处 ${fails.length ? '✘' : 'OK'}`;
if (JSON_OUT) console.error(`\n${summary}`); else console.log(`\n${summary}`);
process.exitCode = fails.length ? 1 : 0;
