#!/usr/bin/env node
/**
 * scripts/check-ref-lines.mjs —— **散文里的 `<路径>:<行号>` 引用会不会随行号漂移而失效**
 *
 * ★ 由来（2026-10-06，本会话**连撞三次**）：
 *   `scripts/check-film-aspect.mjs` 的两处注释引用 `` `scripts/style-distill.mjs:189` ``
 *   （`--ratio 16:9` 所在行）。我改了 `style-distill.mjs` 之后它漂到 `:305`，
 *   把三处（`check-film-aspect.mjs:66`、`:105`、`test/README.md:602`）改成 `:305`；
 *   **同一轮里**又改了一次，它漂到 `:331`，那三处**再次全部失效**。
 *   ⇒ 只要有人在被引文件**上方插删行**，所有 `<路径>:<行号>` 引用就**静默失效**，
 *   而**当时 28 个闸门没有一个看得见**。
 *   这正是本项目纪律第 ⑦ 条「凡『引用外部对象』的字段（路径/帧号/行号/md5）都要有闸门核它真的存在」
 *   一直空着的那一格。
 *
 * ── 判据（三层）─────────────────────────────────────────────────────────────
 *   引用形态：**反引号包裹**的 `` `<路径>:<行号>` ``，路径**带扩展名**；
 *   行号可写成 `N`、`N-M`、`N/M/…`，以及**逗号分隔的行号组** `N-M,K,…`
 *   （`story.js:1-6,66` ⇒ 拆成 `1-6` 与 `66` 两段，**每段都核**）。
 *   ★ 2026-10-06 补：逗号形态此前**整个不被识别**（旧正则 `((?:[-/]\d+)*)$` 里没有 `,`）
 *     ⇒ 这类引用**不计数、不核对**（实测 `scifi-toon/SKILL.md:76` 的 `` `story.js:1-6,66` ``）。
 *     先摸真实语料（`grep … | grep ','`）确认逗号在引用里**清一色**是行号分隔（
 *     `DEMO.md:52,80`、`STYLE.md:12,65`、`edit.py:1-4,27`…），**不是**别的语法
 *     ⇒ 才把 `,` 并进分隔符集合（仍锚 `^…$` 整串匹配，`a.js:1,b.js:2` 这类**不会**误吃）。
 *
 *   (a) **文件存在**：路径解析不到 ⇒ FAIL（报 出处 file:line + 原片段 + 试过的根）。
 *       ★ **路径感知**解析（**不做全仓 basename 模糊匹配** —— 那样会命中**错文件**，
 *         实测：`main.js:566` 曾被解析到另一个只有 11 行的 `main.js`，把真问题掩盖成「行号超范围」）：
 *       ① 文档**所属风格**的源码树（`<styles>/<slug>` 与其 `demo/`）；
 *       ② 文档自身目录；③ 仓根与常见子目录（`scripts/ lib/ test/ _distill/ core/ tools/`）；
 *       ④ 所属风格树内**按相对路径尾段**唯一命中（`plate.js` → `<slug>/demo/engine/plate.js`）；
 *       ⑤ `styles/` 全树尾段**唯一**命中。
 *       ★ 「全库」= **`styles/` 全树**，**不是整个仓** —— 按**文件名**找只搜 ①④⑤ 这几处，
 *         不搜 `core/`、`scripts/`、`tools/`（那些只在**带目录**的路径下被直接拼路径试过）。
 *         报错文案必须如实说这件事（见下 `missing` 分支），否则会让人去"找一个其实存在的文件"。
 *       · 风格级文档（SKILL.md / STYLE.md / DEMO.md）：本风格树内找不到 ⇒ **FAIL**
 *         （`styles/` 树里同名文件再多也**不属于本风格** —— 实测 `hd-2d` / `paper-lantern` 引用 `mux.sh`，
 *         而这两个风格**根本没有** `mux.sh`）。
 *       · 非风格级文档（`test/README.md` / `AGENT-BRIEF.md` / `MAINTAINING.md` 等）：
 *         `styles/` 树里多处同名且文档没给更多线索 ⇒ **不判 FAIL**，单列「引用不唯一，无法核对」
 *         （那是**文档写得太省**，不是引用失效）。
 *
 *   (b) **行号在范围内**：行号 > 该文件总行数 ⇒ FAIL。
 *
 *   (c) ★ **内容对得上**（本条误报率最高，**先测再收窄**，见下「误报率实测」）。
 *       仅当引用**所在小句内**、且**与引用字符距离 ≤ 40**处存在一个**高置信代码片段**时才判：
 *       要求该片段（或其**全部 token**）出现在**被引行区间**里；都出现不了 ⇒ FAIL。
 *       · 「高置信形态」（只认这四类，**不认**裸标识符单词）：`--flag[ value]`、`#rgb/#rrggbb`、
 *         `标识符 = 值` / `标识符: 值`、`名字(...)`。
 *       · 排除：引用自身、其它 `<路径>:<行号>` 引用、路径形态、含 CJK、含 `…`、纯风格 slug、长度 < 3。
 *       · 匹配用 **token 匹配**（按非字母数字切 token，长度 ≥2）：**全部 token 命中** ⇒ 通过；
 *         否则只要有一个**含数字的 token**（具体值，如 `1700` / `16:9` / `1d3a9c`）命中 ⇒ 也通过。
 *       · 小句里没有这样的片段 ⇒ **只做 (a)(b)**（**明确写进已知局限**，不是「悄悄退化」）。
 *
 * ── ★ 误报率实测（2026-10-06，真实语料 137 份文档 / **3652** 处引用）──────────────
 *   判据是**先跑再收窄**的，实测数据（每层都真的跑过）：
 *   · **(c) 初版**（「小句内任取一个反引号片段，要求它是被引行的子串」）：
 *     候选 98 / FAIL **46**，逐条人工核对后**误报约 60%**（`--ratio 16:9` 在源码里写作
 *     `'--ratio', '16:9'`、`type=='cap'` 在源码里写作 `e['type']=='cap'`、
 *     `dur 133.0` 在 json 里写作 `"dur": 133.0`、`COL.cobalt = …` 在源码里是**裸对象字面量**……）
 *     ⇒ **不可用**。
 *   · 收窄① 「距引用 ≤40 字符」**但不限小句**：候选暴涨到 **646** / FAIL **363**
 *     （把邻句的片段也捞进来）⇒ **否决**（小句约束是必需的）。
 *   · 收窄② 「只认高置信形态 + 先排除引用自身」：候选 **37** / FAIL **17**，逐条核对**误报 0**
 *     ⇒ **采用**。
 *   · 收窄③ 再把「子串匹配」换成「token 匹配」：又消掉 `type=='cap'`、`OUT='out/mix.wav'`、
 *     `COL.cobalt = '#1d3a9c'` 三处**已知误报**（见上）⇒ 最终候选 **37** / FAIL **14**。
 *   ★ **不收窄成「只查 (a)(b)」**：(c) 是唯一能抓住「行号对、但那一行已经不是它说的东西」的判据，
 *     恰恰是**本闸门要治的形态**（`style-distill.mjs:305` 的行号**在范围内**，只是内容不对）。
 *
 * ── ★ 豁免（只列 backlog、**不判 FAIL**）──────────────────────────────────────
 *   路径匹配 `(^|/)logs?/` 或 `.log$` 的引用 —— 运行期产物：`_distill/logs/*.log` 在**两个仓都被
 *   `.gitignore` 排除**（实测 `git check-ignore` 命中 `*.log` / `_distill/*`），**不随仓库分发**，
 *   且**每次跑都会重写** ⇒ 它的行号**天然会变**。判它 FAIL 会得到一个**永远红的噪声闸门**。
 *
 * ── ★ 两层语义（照本项目既有写法）────────────────────────────────────────────
 *   若**引用所在小句**内出现「已登记的失效」标记（`已失效|待修|已知失效|原为|原记|已登记|已废弃`），
 *   只列 backlog、**不判 FAIL**（同 `check-tp-prose.mjs` ④ 的历史语境豁免，但粒度收窄到**小句**）。
 *
 *   ★★ 2026-10-06 两次收紧（本判据先后犯过两次「匹配判据可被无关文本满足」）：
 *   ① **整行 → 小句**：旧版判据是**整行**粒度，于是一行里**恰好**出现标记词，就把**该行所有引用**
 *      整行豁免 —— 实测 `swiss-motion/SKILL.md:30` 只是**顺口**写了「禁止照抄任何**历史**海报的构图」，
 *      该行引用就被当成「已登记失效」只列不判。现要求标记**与引用同小句**（分隔符同 (c)：
 *      `。！？；，、（）()[]|`）—— 「历史海报」与 `（`STYLE.md:4`）` **不在同一小句** ⇒ 不再豁免。
 *      · 为什么是**小句**而不是「距引用 ≤40 字符」：小句足够紧（分隔符含 `，、（）`），
 *        且能保住**列举式登记**（「已登记待修的（`a.js:1`、`b.js:2`）」两句引用都该豁免）——
 *        距离判据会把这种合法形态误伤。
 *   ② **去掉泛词 `历史`、补 `已登记|已废弃`**：`历史` 是**普通词**（「公司历史」「历史海报」），
 *      与被引对象的失效**没有语义绑定**；豁免要求的是**明确的失效/登记标记**。
 *      （`原为|原记` 保留：它们是本仓「原文保留 + 追加更正」写法的固定用语。）
 *   ★ 词表守卫保留：同一小句里出现 **≥3 个不同标记** ⇒ 那是「标记词表」而不是「已登记失效」，
 *     **不豁免**（否则本闸门自己的说明文字会把自己永久豁免）。
 *
 * ── ★ 失明守卫（防空转绿灯）─────────────────────────────────────────────────
 *   ① 扫描范围内**一个 `<路径>:<行号>` 引用都没找到** ⇒ **FAIL 并明说「本闸门已失明」**；
 *   ② 一个引用都**解析不到文件**（解析成功数 = 0）⇒ 同样判失明（要么文档里的引用真的全坏、要么解析根配错了）。
 *   否则「0 处失效」会是一句**假话**（什么都没扫到）。
 *
 * ── 已知局限 ────────────────────────────────────────────────────────────────
 *   · **(c) 覆盖面窄**：真实语料 3652 处引用里只有 **37 处**落在 (c) 的判据内 —— 因为多数引用
 *     的小句里根本没有「高置信代码片段」（只有别的引用、路径、slug 或散文）。**这是有意的取舍**：
 *     宁可少判、不可乱报。(c) **不是**「所有引用都比对内容」。
 *   · 启发式（非 AST）：解析器只认**反引号包裹**的引用；写在正文里不加反引号的 `foo.js:12` **看不见**。
 *   · **多义引用**（非风格级文档里的 `demo/test.js:9`）**不判 FAIL**，只列出 —— 需要人读上下文。
 *   · 风格源码树里**被重构成多模块**的老文档（实测 `ascii-crt` / `one-line` / `scifi-toon` 等
 *     把 `main.js` 拆成了若干模块）会报大量「行号超范围」：那是**真失效**，但**修法是重写引用**，
 *     不是本闸门能自动做的。
 *   · ★ **按文件名查找只覆盖 `styles/` 全树**（+ 文档所属风格树），**不覆盖 `core/`**：
 *     裸文件名引用（`` `sfx.py:9` ``）若目标其实在 `core/` 下，会被判 (a) 失败。
 *     **不改判据**（扩到 `core/` 就要按文件名跨树命中，正是头注释里否决过的「basename 模糊匹配」
 *     —— 会命中错文件；且会让 `styles/` 之外的 40+ 个风格源码树的引用语义变松）
 *     ⇒ **只把报错文案改成如实说明范围**（见 `missing` 分支）。修法：文档把引用写成带目录的路径。
 *   · `logs/**` 豁免（见上）。
 *
 * 用法：node scripts/check-ref-lines.mjs [--list-backlog]
 * 退出码：有 FAIL（或失明）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';

// ── 覆盖点（供非破坏变异验证；命名照本项目既有闸门）─────────────────────────
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || 'D:/lemo-tools');
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || 'D:/lemo-opuscar');
const STYLES = path.resolve(process.env.LEMO_STYLES_ROOT || path.join(OPUSCAR, 'styles'));
const DISTILL = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(ROOT, 'lib', 'style-skills'));

const LIST_BACKLOG = process.argv.includes('--list-backlog');

// ── 扫描范围（★ 显式列表，不用「全仓 md」那种会拖进噪声的 glob）─────────────
const styleSlugs = (() => {
  try { return fs.readdirSync(STYLES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(); }
  catch { return []; }
})();
const skillSlugs = (() => {
  try { return fs.readdirSync(DISTILL, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(); }
  catch { return []; }
})();
const DOCS = [
  path.join(ROOT, 'test', 'README.md'),
  path.join(ROOT, '_distill', 'AGENT-BRIEF.md'),
  ...skillSlugs.map((s) => path.join(DISTILL, s, 'SKILL.md')),
  path.join(OPUSCAR, 'MAINTAINING.md'),
  path.join(OPUSCAR, 'TECHNIQUE.md'),
  path.join(OPUSCAR, 'core', 'README.md'),
  ...styleSlugs.flatMap((s) => [path.join(STYLES, s, 'STYLE.md'), path.join(STYLES, s, 'DEMO.md')]),
].filter((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });

// ── 引用形态 ────────────────────────────────────────────────────────────────
//   反引号包裹、路径带扩展名、`:行号`（可 `N` / `N-M` / `N/M/…` / 逗号分隔组 `N-M,K`）
//   ★ 锚 `^…$`：整串必须刚好是「路径:行号组」，`a.js:1,b.js:2` / `x.js:1, 'a'` 都不会被误吃。
const REF = /^([A-Za-z0-9_][A-Za-z0-9_./\\-]*\.[A-Za-z0-9_]+):(\d+)((?:[-/,]\d+)*)$/;
const TICKS = /`([^`\n]+)`/g;
/** 占位符 / 通配的路径不算引用（`styles/<slug>/demo`、`film*.js`） */
const isPlaceholder = (p) => /[<>*…]/.test(p);
const isLogRef = (p) => /(^|\/)logs?\//.test(p) || /\.log$/.test(p);
/**
 * 「已登记失效」标记 —— ★ 只收**明确的失效/登记**语义，**不收**泛词（`历史` 已剔除）。
 * 判据是**引用所在小句**粒度（见头注释「两层语义」的两次收紧）。
 */
const REGISTERED_MARK = /已失效|待修|已知失效|原为|原记|已登记|已废弃/g;
function isRegistered(seg) {
  const marks = new Set(seg.match(REGISTERED_MARK) || []);
  if (!marks.size) return false;
  return marks.size < 3;   // ≥3 个不同标记 ⇒ 那是「标记词表」，不是登记
}

// ── 路径解析 ────────────────────────────────────────────────────────────────
const SKIP_DIR = new Set(['node_modules', '.git', 'out', 'voices', 'voices_raw', 'stills', 'CREDITS', 'assets', 'fonts']);
const idxCache = new Map();
function treeIndex(root) {
  if (idxCache.has(root)) return idxCache.get(root);
  const byTail = new Map(), byFull = new Map();
  (function walk(d, rel) {
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (SKIP_DIR.has(e.name)) continue;
      const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else {
        if (!byTail.has(e.name)) byTail.set(e.name, []);
        byTail.get(e.name).push(p);
        if (!byFull.has(r)) byFull.set(r, p);
      }
    }
  })(root, '');
  const o = { byTail, byFull }; idxCache.set(root, o); return o;
}

/** 文档所属风格 slug（SKILL.md 在 `<DISTILL>/<slug>/`，STYLE|DEMO.md 在 `<STYLES>/<slug>/`） */
function slugOf(file) {
  const rel1 = path.relative(DISTILL, file);
  if (!rel1.startsWith('..') && !path.isAbsolute(rel1)) { const s = rel1.split(/[\\/]/)[0]; if (s && s !== rel1) return s; }
  const rel2 = path.relative(STYLES, file);
  if (!rel2.startsWith('..') && !path.isAbsolute(rel2)) { const s = rel2.split(/[\\/]/)[0]; if (s && s !== rel2) return s; }
  return null;
}

function rootsFor(file) {
  const slug = slugOf(file), out = [];
  if (slug) out.push(path.join(STYLES, slug), path.join(STYLES, slug, 'demo'));
  out.push(path.dirname(file));
  out.push(ROOT, path.join(ROOT, 'scripts'), path.join(ROOT, 'lib'), path.join(ROOT, 'test'),
    path.join(ROOT, '_distill'), path.join(ROOT, '_distill', 'logs'));
  out.push(OPUSCAR, path.join(OPUSCAR, 'core'), path.join(OPUSCAR, 'tools'), STYLES);
  return [...new Set(out)];
}

/**
 * 解析结果：{p} 命中 ｜ {ambiguous:[…]} 多义 ｜ {how:'underspec'} 欠指明 ｜ null 解析不到
 * @param siblingPaths 同小句里出现的**带目录的路径**片段（如 `` `core/render/mux.sh` ``）——
 *   若某个的 basename 与本引用相同，则本引用就是它（★ 路径感知：实测 `hd-2d` 的
 *   「core/render/mux.sh … `mux.sh:152-162`」指的就是 core 那个，不是本风格自带的）。
 */
function resolveRef(file, refPath, siblingPaths = []) {
  const tail = refPath.split(/[\\/]/).pop();
  if (!refPath.includes('/')) {
    for (const sp of siblingPaths) {
      if (sp.split(/[\\/]/).pop() !== tail) continue;
      for (const r of rootsFor(file)) {
        const p = path.resolve(r, sp);
        try { if (fs.statSync(p).isFile()) return { p, how: 'sibling-path' }; } catch {}
      }
      for (const r of [OPUSCAR, STYLES, ROOT]) {
        const p = path.resolve(r, sp);
        try { if (fs.statSync(p).isFile()) return { p, how: 'sibling-path' }; } catch {}
      }
    }
  }
  for (const r of rootsFor(file)) {
    const p = path.resolve(r, refPath);
    try { if (fs.statSync(p).isFile()) return { p, how: 'root' }; } catch {}
  }
  const slug = slugOf(file);
  if (slug) {
    const ix = treeIndex(path.join(STYLES, slug));
    if (refPath.includes('/') && ix.byFull.has(refPath)) return { p: ix.byFull.get(refPath), how: 'slug-full' };
    const c = ix.byTail.get(tail);
    if (c && c.length === 1) return { p: c[0], how: 'slug-tail' };
    if (c && c.length > 1) return { p: null, ambiguous: c, how: 'slug-ambig' };
    // ★ 本风格树里没有：`styles/` 全树也没有同名 ⇒ 真的不在 styles 里（FAIL）；
    //   `styles/` 全树有同名 ⇒ 文档**欠指明**（只列不判）。★ 注意这里**没有**搜 `core/`（见 known limits）。
    const g = treeIndex(STYLES).byTail.get(tail) || [];
    return { p: null, ambiguous: g, how: g.length ? 'underspec' : 'missing' };
  }
  const g = treeIndex(STYLES).byTail.get(tail);
  if (g && g.length === 1) return { p: g[0], how: 'global-tail' };
  if (g && g.length > 1) return { p: null, ambiguous: g, how: 'global-ambig' };
  return null;
}

// ── (c) 的片段判据 ──────────────────────────────────────────────────────────
const isRefLike = (s) =>
  REF.test(s) ||
  /^[\w.-]+\.(js|mjs|py|sh|md|json|html|css|txt|log|srt)(#[\w.-]+)?$/.test(s) ||
  /^[\w.-]+:\d+([-,/]\d+)*$/.test(s) ||
  /^[\w.-]+:[\d,/-]+$/.test(s);
const HIGH_CONF = [
  // CLI 选项：`--flag[ value]`，或**单个短选项** `-x`。
  // ★ 不收 `-rn` 这类「多个短选项合并」—— 实测 `AGENT-BRIEF.md:517` 的 `-rn` 是 **grep 的选项**，
  //   与被引的 `game-show/demo/music.py:24` 毫无关系（同一小句里出现了另一个命令）⇒ 假红。
  /^--[A-Za-z][\w-]*([ =]\S+)?$/,
  /^-[A-Za-z]([ =]\S+)?$/,
  /^#[0-9a-fA-F]{3,8}$/,                              // 色值
  /^[A-Za-z_$][\w$.\[\]]*\s*[=:]\s*\S+$/,             // 赋值 / 键值
  /^[A-Za-z_$][\w$.]*\([^)]*\)$/,                     // 调用
];
const isHighConf = (s) => HIGH_CONF.some((re) => re.test(s));
function okSnippet(s, slug) {
  const t = s.trim();
  if (t.length < 3) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;
  if (t.includes('…')) return false;
  if (slug && t === slug) return false;
  if (isRefLike(t)) return false;
  return isHighConf(t);
}
const tokensOf = (s) => s.split(/[^A-Za-z0-9#.]+/).map((t) => t.replace(/^[.#]+|[.#]+$/g, '')).filter((t) => t.length >= 2 && /[A-Za-z0-9]/.test(t));
/** token 匹配：全部 token 命中 ⇒ 通过；否则只要有一个**含数字的 token**命中 ⇒ 也通过 */
function snippetMatches(snip, targetText) {
  const tk = tokensOf(snip);
  if (!tk.length) return targetText.includes(snip);
  const low = targetText.toLowerCase();
  const hit = (t) => low.includes(t.toLowerCase());
  if (tk.every(hit)) return true;
  return tk.some((t) => /\d/.test(t) && hit(t));
}

// ── 主循环 ──────────────────────────────────────────────────────────────────
const linesOf = new Map();
const getLines = (p) => { if (!linesOf.has(p)) linesOf.set(p, fs.readFileSync(p, 'utf8').split('\n')); return linesOf.get(p); };

const fails = [];      // {kind, file, docLine, ref, snippet?, detail}
const backlog = [];    // 豁免 / 多义 / 已登记
let refCount = 0, resolvedCount = 0, cApplied = 0;

for (const file of DOCS) {
  const slug = slugOf(file);
  const docLines = fs.readFileSync(file, 'utf8').split('\n');
  docLines.forEach((line, i) => {
    const lineNo = i + 1;
    for (const m of line.matchAll(TICKS)) {
      const inner = m[1].trim();
      const r = inner.match(REF);
      if (!r) continue;
      const [, refPath, firstLine, rest] = r;
      if (isPlaceholder(refPath)) continue;
      refCount++;

      const nums = [Number(firstLine), ...[...rest.matchAll(/\d+/g)].map((x) => Number(x[0]))];
      const maxN = Math.max(...nums);
      const where = `${path.relative('D:/', file).replace(/\\/g, '/')}:${lineNo}`;
      const fragment = `\`${inner}\``;

      // ── 小句与「同小句里的路径片段」（供路径感知解析 / (c) / 豁免 用）──
      const start = m.index, end = m.index + m[0].length;
      const parts = line.split(/(?<=[。！？；，、（）()\[\]|])/);
      let segStart = 0, segEnd = line.length, acc = 0;
      for (const s of parts) { if (acc <= start && start < acc + s.length) { segStart = acc; segEnd = acc + s.length; break; } acc += s.length; }
      const seg = line.slice(segStart, segEnd);

      // 两层语义：**本引用所在小句**里有「已登记失效」标记（≥3 个标记的词表不算）
      const registered = isRegistered(seg);

      const push = (kind, detail, extra = {}) => {
        const rec = { kind, where, fragment, detail, ...extra };
        (registered ? backlog : fails).push(registered ? { ...rec, kind: kind + '(已登记)' } : rec);
      };

      const spans = [...line.matchAll(TICKS)].map((x) => ({ t: x[1].trim(), i: x.index, e: x.index + x[0].length }))
        .filter((x) => x.i >= segStart && x.e <= segEnd && x.t !== inner);
      const siblingPaths = spans.map((x) => x.t).filter((t) => /[\\/]/.test(t) && /\.[A-Za-z0-9]+$/.test(t) && !isPlaceholder(t));

      // ── 豁免：运行期日志 ──
      if (isLogRef(refPath)) { backlog.push({ kind: 'logs(运行期产物)', where, fragment, detail: '被 .gitignore 排除、不随仓库分发，行号每次运行都会变' }); continue; }

      const res = resolveRef(file, refPath, siblingPaths);
      if (!res || !res.p) {
        if (res && res.how === 'global-ambig') {
          backlog.push({ kind: '多义(无法核对)', where, fragment, detail: `全库 ${res.ambiguous.length} 处同名：${res.ambiguous.map((p) => path.relative(OPUSCAR, p).replace(/\\/g, '/')).join('、')}` });
        } else if (res && res.how === 'underspec') {
          // ★ 2026-10-06 文案订正（与下面 `missing` 分支**同因**，判据一律不动）：旧版只写
          //   「全库有 N 处同名」，而这里的「全库」**只有 `styles/` 全树**（`treeIndex(STYLES)`）
          //   —— 实测 `hd-2d/SKILL.md` 引 `` `mux.sh:152-162` `` 时列出的候选**全在 `styles/` 下**，
          //   而正确答案是 `core/render/mux.sh`（同一段上文自己就写了这条全路径）⇒ 候选名单里
          //   **根本没有正主**，照候选去挑会挑错。现如实说明**搜索范围**（同头注释 known limits）。
          backlog.push({ kind: '欠指明(只列不判)', where, fragment, detail: `本风格树（styles/${slug}/）里没有 \`${refPath}\`，全库有 ${res.ambiguous.length} 处同名（${res.ambiguous.map((p) => path.relative(OPUSCAR, p).replace(/\\/g, '/')).join('、')}）—— 文档没说清指哪一个。★ **本计数只覆盖 \`styles/\` 全树**（按文件名找）；\`core/\`、\`scripts/\`、\`tools/\` 等树**不在内** —— 所以「候选名单里没有」**不等于**「仓里没有」（若该文件其实在 \`core/\` 下，请把引用写成**带目录**的路径，如 \`core/render/mux.sh\`）` });
        } else if (res && res.how === 'slug-ambig') {
          push('(a) 文件不存在', `本风格树（styles/${slug}/）里有 ${res.ambiguous.length} 处同名、无法定位：${res.ambiguous.map((p) => path.relative(OPUSCAR, p).replace(/\\/g, '/')).join('、')}`, { refPath });
        } else if (res && res.how === 'missing') {
          // ★ 2026-10-06 文案订正：旧版写「全库也没有同名文件」，但「全库」其实只有 `styles/` 树
          //   （`treeIndex(STYLES)`）—— 实测 `scifi-toon` 引 `` `sfx.py:9` `` 时被判「全库没有」，
          //   而 `D:/lemo-opuscar/core/audio/sfx.py` **确实存在**（同一段上文自己就写了全路径）
          //   ⇒ 让人去找一个其实存在的文件。现如实说明**搜索范围**与**怎么修**。
          push('(a) 文件不存在', `本风格树（styles/${slug}/）里没有 \`${refPath}\`。★ 本闸门按**文件名**只搜过两处：` +
            `「本风格树 + styles/ 全树（${styleSlugs.length} 个风格）」；**没有**按文件名搜 \`core/\`、\`scripts/\`、\`tools/\` 等树` +
            `（只有**带目录**的路径才会直接拼到这些根上试）—— 所以「styles 树里没有」**不等于**「仓里没有」。` +
            `若该文件其实在 \`core/\` 下，请把引用写成**带目录**的路径（如 \`core/audio/sfx.py:9\`）`, { refPath });
        } else {
          push('(a) 文件不存在', `路径解析不到：\`${refPath}\`（试过 ${rootsFor(file).length} 个根：${rootsFor(file).map((x) => path.relative('D:/', x).replace(/\\/g, '/')).slice(0, 4).join('、')}…）`, { refPath });
        }
        continue;
      }
      resolvedCount++;
      const target = res.p;
      const lines = getLines(target);
      const shown = path.relative('D:/', target).replace(/\\/g, '/');

      // ── (b) 行号在范围内 ──
      if (maxN > lines.length) {
        push('(b) 行号超范围', `\`${refPath}\` 指到第 ${maxN} 行，而 ${shown} 只有 ${lines.length} 行`, { refPath, target: shown });
        continue;
      }

      // ── (c) 内容对得上（收窄后：小句内 + 距引用 ≤40 + 高置信片段）──
      const snips = spans
        .filter((x) => Math.min(Math.abs(x.e - start), Math.abs(end - x.i)) <= 40)
        .map((x) => x.t)
        .filter((t) => okSnippet(t, slug));
      if (!snips.length) continue;                                        // 没有可用片段 ⇒ 只做 (a)(b)
      cApplied++;
      const text = nums.map((n) => lines[n - 1] ?? '').join('\n');
      if (!snips.some((s) => snippetMatches(s, text))) {
        const at = nums.map((n) => `第 ${n} 行 = ${JSON.stringify((lines[n - 1] ?? '').trim().slice(0, 90))}`).join('；');
        push('(c) 内容对不上', `引的是 \`${refPath}\` 的 ${snips.map((s) => `\`${s}\``).join(' / ')}，但 ${shown} ${at}`, { refPath, target: shown, snippet: snips });
      }
    }
  });
}

// ── ★ 失明守卫 ──────────────────────────────────────────────────────────────
const blind = [];
if (refCount === 0) blind.push(`扫描范围内（${DOCS.length} 份文档）**一个 \`<路径>:<行号>\` 引用都没找到** ⇒ 一个引用都没检查过`);
if (refCount > 0 && resolvedCount === 0) blind.push(`找到 ${refCount} 处引用，但**一处都解析不到文件** ⇒ 要么文档里的引用真的全坏、要么解析根配错了（先核对下面的 (a) 清单）`);

// ── 输出 ────────────────────────────────────────────────────────────────────
const byKind = (k) => fails.filter((f) => f.kind.startsWith(k));
console.log('散文里的 `<路径>:<行号>` 引用闸门\n');
console.log(`扫描：${DOCS.length} 份文档（test/README.md、_distill/AGENT-BRIEF.md、${skillSlugs.length} 份 SKILL.md、`);
console.log(`      MAINTAINING/TECHNIQUE/core/README、${styleSlugs.length}×2 份 STYLE|DEMO.md）`);
console.log(`引用：${refCount} 处；解析到文件 ${resolvedCount} 处；其中 ${cApplied} 处进入 (c) 内容比对\n`);

const SHOW = { '(a)': '(a) 文件不存在', '(b)': '(b) 行号超范围', '(c)': '(c) 内容对不上' };
for (const k of ['(a)', '(b)', '(c)']) {
  const list = byKind(k);
  console.log(`  ${list.length ? '✘' : '✓'} ${SHOW[k]}：${list.length} 处`);
}
for (const k of ['(a)', '(b)', '(c)']) {
  const list = byKind(k);
  if (!list.length) continue;
  console.log(`\n✘ ${SHOW[k]}（${list.length} 处）：`);
  for (const f of list) console.log(`  · ${f.where}  ${f.fragment}\n      ${f.detail}`);
}

if (backlog.length) {
  console.log(`\n○ 只列不判 FAIL（${backlog.length} 处）：`);
  const g = {};
  for (const b of backlog) (g[b.kind] ||= []).push(b);
  for (const [k, v] of Object.entries(g)) console.log(`  · ${k}：${v.length} 处`);
  if (LIST_BACKLOG) for (const b of backlog) console.log(`      ${b.where}  ${b.fragment}\n        ${b.detail}`);
  else console.log('  （加 `--list-backlog` 逐条列出）');
}

if (blind.length) {
  console.log('\n✘ 本闸门已失明：');
  for (const b of blind) console.log(`  ✘ ${b}`);
}

console.log(`\n[闸门] 引用失效 ${fails.length} 处（a ${byKind('(a)').length} / b ${byKind('(b)').length} / c ${byKind('(c)').length}）、只列不判 ${backlog.length} 处${blind.length ? '、**已失明**' : ''} ${(fails.length || blind.length) ? '✘' : 'OK'}`);
process.exitCode = (fails.length || blind.length) ? 1 : 0;
