// 原创性审计器的**纯逻辑**部分（不碰网络 / 浏览器 / 子进程 / 文件系统，可单测）。
//
// 背景（用户硬规则 + 库自己的文档）：
//   「只保持选定风格一致；文案语句、案例素材、画面元素、镜头编排必须从零全新原创；
//     严禁套用模板、禁止沿用原文案框架、禁止简单改字拼接；产出无模板套用痕迹。」
//   `styles/engraving/STYLE.md`：换 `demo/content.json` 重跑「不是做片子的方式」。
//   `styles/engraving/DEMO.md`：「不要复用它的故事、叙事弧、镜头、道具或时长。」
//
// 这条规则之前只能靠人嘴说，于是出过一次事故：拿「换 content.json 的文字与配色」当交差。
// 所以这里把「有没有套模板」拆成一组**可计算、可复现、会失败**的判据。
//
// 设计原则：
//   1. 每条检查返回 { id, title, status, ok, metric, threshold, detail, evidence }。
//      status ∈ pass / fail / unknown。**unknown 不是通过** —— 素材缺失时不许默认放行。
//   2. 阈值全部是**具名导出常量**（见下方 THRESHOLDS），不散落在代码里；每条检查都接受
//      opt 覆盖，测试靠这个验证「阈值真的在起作用」（改小阈值 → 原本通过的样本变失败）。
//   3. 只写能算的东西。「这组部件换成一株植物的器官，语义上算不算换」这种判断工具做不了，
//      一律标 needsHuman 并把材料摆出来给人看，绝不假装判过。
//   4. **中文走自己的口径，且必须在报告里写明**。中文没有词边界、也没有可用的虚词表，
//      所以「最长公共连续词串」退化成「连续相同的**字**数」，「实词重合率」退化成
//      「**字符集合**重合率」—— 阈值都单独具名导出（NARRATION_*_CJK），不跟拉丁混用。
//      判据里哪一对文本涉及汉字，就整对切到中文口径。

// ── 阈值（具名常量；改这里就等于改判据）─────────────────────────
/** 旁白/版面文本：任意两行之间的**最长公共连续词串**长度必须 < 5。 */
export const NARRATION_NGRAM_MAX = 5;
/** 旁白/版面文本：任意两行的**实词集合包含率**必须 < 0.6（抓「改几个词保留原句框架」）。 */
export const NARRATION_OVERLAP_MAX = 0.6;
/** 两侧实词都至少这么多，才判包含率（太短的行噪音大，交给 n-gram 与整句相等判）。 */
export const NARRATION_OVERLAP_MIN_TOKENS = 4;
/**
 * 含中文的文本：任意两行之间的**最长公共连续字串**长度必须 < 5。
 * 中文没有词边界，`tokenize` 把汉字**逐字**当 token，所以同一条 `longestCommonRun` 对中文
 * 量出来的就是「连续相同的字数」。5 字连续相同基本等于抄句子；**4 字太松** —— 实测两段
 * 各自独立写作、只是都提到「十五世纪」的中文旁白就会撞上 4。
 */
export const NARRATION_NGRAM_MAX_CJK = 5;
/**
 * 含中文的文本：任意两行的**字符集合包含率**必须 < 0.75。
 * ★ **口径与拉丁不同，报告里必须写清**：拉丁那边是「**实词**集合」（有 STOPWORDS 词表可以
 *   去掉 the / of / a）；中文没有词表可去「的 / 是 / 一」，只能退到**字符集合**
 *   （CJK 逐字 + 拉丁按词，一个 token 都不去）。
 *   字符集合天然比实词集合重合得高，所以阈值必须放宽：实测两段独立写作的同题材中文旁白
 *   字符重合能到 0.72，沿用拉丁的 0.6 会**误判**；而真正的「改几个字」会顶到 1.0，0.75 仍抓得住。
 */
export const NARRATION_OVERLAP_MAX_CJK = 0.75;
/** details 的 name / latin / focus 与示例的重合个数必须 <= 0。 */
export const DETAIL_SHARED_MAX = 0;
/** subjects/*.js 之间**连续相同代码行**数必须 < 6。 */
export const CODE_RUN_MAX = 6;
/** 事件类型序列的最长公共子序列占比必须 < 0.9（=1.0 就是原样复用同一条时间线）。 */
export const TIMELINE_LCS_RATIO_MAX = 0.9;
/** 配色：colors[].region 集合不得与示例完全相同。 */
export const COLORS_IDENTICAL_ALLOWED = false;
/** 身份字段（title / latin / subject）不得与示例完全相同。 */
export const IDENTITY_IDENTICAL_ALLOWED = false;
/** 收尾（caption / end.film_title / end.credits 整表）不得与示例完全相同。 */
export const END_CARD_IDENTICAL_ALLOWED = false;

export const THRESHOLDS = Object.freeze({
  NARRATION_NGRAM_MAX,
  NARRATION_OVERLAP_MAX,
  NARRATION_OVERLAP_MIN_TOKENS,
  NARRATION_NGRAM_MAX_CJK,
  NARRATION_OVERLAP_MAX_CJK,
  DETAIL_SHARED_MAX,
  CODE_RUN_MAX,
  TIMELINE_LCS_RATIO_MAX,
  COLORS_IDENTICAL_ALLOWED,
  IDENTITY_IDENTICAL_ALLOWED,
  END_CARD_IDENTICAL_ALLOWED,
});

export const STATUS = Object.freeze({ PASS: 'pass', FAIL: 'fail', UNKNOWN: 'unknown' });

/** 证据条目在报告里最多列这么多条（多的折叠成一行，避免 md 变长篇小说）。 */
export const MAX_EVIDENCE = 20;

// ── 小工具 ───────────────────────────────────────────────────
const arr = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const uniq = (a) => [...new Set(a)];
const pct = (n) => `${(n * 100).toFixed(1)}%`;

function check(id, title, status, metric, threshold, detail, evidence = [], needsHuman = false) {
  return { id, title, status, ok: status === STATUS.PASS, metric, threshold, detail, evidence, needsHuman };
}

function capEvidence(list) {
  const l = arr(list);
  if (l.length <= MAX_EVIDENCE) return l;
  return [...l.slice(0, MAX_EVIDENCE), `… 另有 ${l.length - MAX_EVIDENCE} 条同类证据，见 originality.json`];
}

// ── 文本切词 / 比较 ──────────────────────────────────────────
/**
 * 切词：拉丁字母与数字成串算一个词；中日韩汉字**逐字**算一个词（这样中文的「连续词串」
 * 就是连续字符，和英文的 n-gram 语义一致）；其余（标点、空白）一律是分隔符。
 * 大小写一律归并 —— 判据明确要求「忽略大小写与标点」。
 */
export function tokenize(text) {
  const out = [];
  const src = s(text).toLowerCase();
  const re = /[a-z0-9]+|[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const tok = m[0];
    if (/^[a-z0-9]+$/.test(tok)) out.push(tok);
    else for (const ch of tok) out.push(ch);
  }
  return out;
}

/** 规范化文本：小写、去标点、空白折叠。整句相等判据用的就是它。 */
export function normalizeText(text) {
  return tokenize(text).join(' ');
}

/**
 * 功能词表：**只**用于「实词重合率」这一条判据（n-gram 判据不丢任何词）。
 * 目的：避免两段真无关的文本因为 the / of / a 这种词凑出虚高的重合率。
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'nor', 'but', 'so', 'yet', 'of', 'to', 'in', 'on', 'at', 'by',
  'for', 'with', 'from', 'into', 'onto', 'upon', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'am', 'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they', 'them',
  'his', 'her', 'hers', 'their', 'theirs', 'we', 'us', 'you', 'your', 'i', 'me', 'my', 'mine',
  'not', 'no', 'nor', 'if', 'then', 'than', 'there', 'here', 'when', 'where', 'which', 'who',
  'whom', 'whose', 'what', 'all', 'any', 'some', 'each', 'every', 'both', 'own', 'such', 'very',
  'just', 'also', 'too', 'only', 'same', 'other', 'another', 'more', 'most', 'much', 'many',
  'up', 'out', 'off', 'over', 'under', 'again', 'once', 'can', 'could', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'do', 'does', 'did', 'done', 'have', 'has', 'had', 'having',
  'while', 'about', 'after', 'before', 'between', 'during', 'through', 'because', 'against',
  'one', 'two', 'three', 'first', 'second', 'next', 'last', 'down', 'away', 'back', 'still',
]);

/** 实词集合（去功能词、去重、保序不保证）。 */
export function contentTokens(text) {
  return uniq(tokenize(text).filter((t) => !STOPWORDS.has(t)));
}

/** 汉字（含扩展 A 区与兼容区）。用来决定一条判据走拉丁口径还是中文字符口径。 */
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
export function hasCJK(text) {
  return CJK_RE.test(s(text));
}

/**
 * 字符集合：`tokenize` 之后**不去功能词**，一个 token 都不丢。
 * 中文走这条 —— 没有中文词表，去不掉「的 / 是 / 一」，硬按实词算只会虚高。
 * 注意它对拉丁部分是「按词」、对汉字是「逐字」，所以准确说法是**字符/词集合**。
 */
export function overlapTokens(text) {
  return uniq(tokenize(text));
}

/**
 * 最长公共**连续**词串（longest common substring over token arrays）。
 * 返回 { len, aStart, bStart, phrase }。这是「最长公共词序列（n-gram）」判据的核心。
 */
export function longestCommonRun(A, B) {
  const a = arr(A), b = arr(B);
  if (!a.length || !b.length) return { len: 0, aStart: -1, bStart: -1, phrase: '' };
  const dp = new Array(b.length + 1).fill(0);
  let best = 0, aStart = -1, bStart = -1;
  for (let i = 1; i <= a.length; i++) {
    for (let j = b.length; j >= 1; j--) {          // 倒序：dp[j-1] 还是上一行的值
      if (a[i - 1] === b[j - 1]) {
        dp[j] = dp[j - 1] + 1;
        if (dp[j] > best) { best = dp[j]; aStart = i - best; bStart = j - best; }
      } else dp[j] = 0;
    }
  }
  return { len: best, aStart, bStart, phrase: a.slice(aStart, aStart + best).join(' ') };
}

/** 最长公共**子序列**长度（不要求连续）。时间线判据用。 */
export function lcsLength(A, B) {
  const a = arr(A), b = arr(B);
  if (!a.length || !b.length) return 0;
  const dp = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;                                   // 上一行 dp[j-1]
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** 集合统计：交、并、Jaccard、包含率（inter / min(|A|,|B|)）。 */
export function setStats(A, B) {
  const a = uniq(arr(A)), b = uniq(arr(B));
  const sa = new Set(a), sb = new Set(b);
  const inter = a.filter((x) => sb.has(x));
  const union = uniq([...a, ...b]);
  const min = Math.min(a.length, b.length);
  return {
    inter, union,
    jaccard: union.length ? inter.length / union.length : 0,
    containment: min ? inter.length / min : 0,
    aSize: a.length, bSize: b.length,
  };
}

// ── 从 content.json 抽出「文本单元」────────────────────────────
/**
 * content.json 里所有给人看的文本，带路径标签（旁白、注释、图版文字、收尾）。
 * ★ `end.credits` **故意不进**这个池子：署名行（工具署名 / 字体署名）本来就该在风格内复用，
 *   拿它做 n-gram 比对会把每一部合规的新片都误判成抄袭。credits 的整表相等由 checkEndCard 负责。
 */
export function textUnits(content) {
  const c = content || {};
  const out = [];
  const push = (path, text) => { if (s(text).trim()) out.push({ path, text: s(text) }); };
  push('title', c.title);
  push('latin', c.latin);
  push('caption', c.caption);
  arr(c.details).forEach((d, i) => {
    push(`details[${i}].name`, d && d.name);
    push(`details[${i}].latin`, d && d.latin);
    push(`details[${i}].note`, d && d.note);
  });
  push('end.film_title', c.end && c.end.film_title);
  arr(c.voice && c.voice.lines).forEach((l, i) => push(`voice.${(l && l.id) || i}`, l && l.text));
  return out;
}

/** 只取旁白行（voice.lines）。 */
export function voiceUnits(content) {
  return textUnits(content).filter((u) => u.path.startsWith('voice.'));
}

/** 只取图版上的文字（注释 / 名称 / 收尾 / 图注），不含旁白。 */
export function plateUnits(content) {
  return textUnits(content).filter((u) => !u.path.startsWith('voice.'));
}

// ── 检查 1/2：文本原创性（n-gram + 实词/字符重合率）─────────────
/**
 * 文本原创性。返回**两条**检查：
 *   <id>.ngram   最长公共连续词/字串 < NARRATION_NGRAM_MAX（中文用 NARRATION_NGRAM_MAX_CJK）
 *   <id>.overlap 实词（中文：字符）集合包含率 < NARRATION_OVERLAP_MAX（中文 0.75）
 *
 * ★ **中文口径**：只要这一对文本里**任一侧含汉字**，就切到中文口径 ——
 *   · n-gram：`tokenize` 对汉字本来就是逐字的，所以同一条最长公共**连续**子串算出来的
 *     就是「连续相同的**字**数」，阈值用 NARRATION_NGRAM_MAX_CJK。
 *   · 重合率：拉丁用 contentTokens（**实词**，去了功能词）；中文用 overlapTokens
 *     （**字符/词集合**，一个 token 都不去）—— 因为中文没有词表可去虚词。
 *     阈值相应放宽到 NARRATION_OVERLAP_MAX_CJK，否则同题材独立写作会被误判。
 *   报告的标题与 detail 都会写明当前用的是哪个口径，不会让人以为中文还在按实词算。
 */
export function checkTextOriginality(newUnits, refUnits, opt = {}) {
  const idBase = opt.id || 'text';
  const label = opt.label || '文本';
  const ngramMax = opt.ngramMax ?? NARRATION_NGRAM_MAX;
  const overlapMax = opt.overlapMax ?? NARRATION_OVERLAP_MAX;
  const minTokens = opt.overlapMinTokens ?? NARRATION_OVERLAP_MIN_TOKENS;
  const ngramMaxCJK = opt.ngramMaxCJK ?? NARRATION_NGRAM_MAX_CJK;
  const overlapMaxCJK = opt.overlapMaxCJK ?? NARRATION_OVERLAP_MAX_CJK;

  const nUnits = arr(newUnits).filter((u) => u && tokenize(u.text).length);
  const rUnits = arr(refUnits).filter((u) => u && tokenize(u.text).length);

  if (!nUnits.length || !rUnits.length) {
    const why = !nUnits.length
      ? `新片没有可比对的${label}（缺失，或全是空串/纯标点）`
      : `示例片没有可比对的${label}`;
    return [
      check(`${idBase}.ngram`, `${label} · 最长公共连续词串`, STATUS.UNKNOWN, null, ngramMax, `${why} —— 素材缺失，无法判定`),
      check(`${idBase}.overlap`, `${label} · 实词重合率`, STATUS.UNKNOWN, null, overlapMax, `${why} —— 素材缺失，无法判定`),
    ];
  }

  const worstRun = { len: 0, phrase: '', nPath: '', rPath: '', max: null, cjk: null };
  const worstOv = { ratio: 0, inter: [], nPath: '', rPath: '', nText: '', rText: '', max: null, cjk: null };
  let worstRunViol = null, worstOvViol = null, cjkMode = false;
  const exactHits = [];
  const runHits = [];
  const ovHits = [];

  for (const n of nUnits) {
    const nt = tokenize(n.text);
    const nCJK = hasCJK(n.text);
    for (const r of rUnits) {
      const rt = tokenize(r.text);
      const cjk = nCJK || hasCJK(r.text);          // 任一侧是中文 ⇒ 整对按中文口径
      if (cjk) cjkMode = true;
      const ngMax = cjk ? ngramMaxCJK : ngramMax;
      const ovMax = cjk ? overlapMaxCJK : overlapMax;
      const bag = cjk ? overlapTokens : contentTokens;
      const unitName = cjk ? '字' : '词';

      if (nt.join(' ') === rt.join(' ')) {
        exactHits.push(`整句相同（忽略大小写与标点）：新 ${n.path}「${n.text}」 ≡ 例 ${r.path}「${r.text}」`);
      }
      const run = longestCommonRun(nt, rt);
      // 中文的 token 是单个汉字，拼起来读更顺：把 join(' ') 塞进去的空格去掉
      const phrase = cjk ? run.phrase.replace(/ /g, '') : run.phrase;
      if (run.len > worstRun.len) {
        Object.assign(worstRun, { len: run.len, phrase, nPath: n.path, rPath: r.path, max: ngMax, cjk });
      }
      if (run.len >= ngMax) {
        runHits.push(`新 ${n.path} × 例 ${r.path}：连续 ${run.len} ${unitName}「${phrase}」`);
        if (!worstRunViol || run.len > worstRunViol.len) {
          worstRunViol = { len: run.len, phrase, nPath: n.path, rPath: r.path, max: ngMax, cjk };
        }
      }
      const nc = bag(n.text), rc = bag(r.text);
      if (nc.length >= minTokens && rc.length >= minTokens) {
        const st = setStats(nc, rc);
        const rec = { ratio: st.containment, inter: st.inter, nPath: n.path, rPath: r.path, nText: n.text, rText: r.text, max: ovMax, cjk };
        if (st.containment > worstOv.ratio) Object.assign(worstOv, rec);
        if (st.containment >= ovMax) {
          const what = cjk ? '字符' : '实词';
          ovHits.push(`新 ${n.path} × 例 ${r.path}：${what}重合 ${pct(st.containment)}（${st.inter.length}/${Math.min(st.aSize, st.bSize)}）→ 共用 ${st.inter.slice(0, 12).join(', ')}`);
          if (!worstOvViol || st.containment > worstOvViol.ratio) worstOvViol = rec;
        }
      }
    }
  }

  // 一对都没量到时（例如跨语言，最长公共串恒为 0），worstRun / worstOv 还是初始值。
  // 按语言口径补齐 —— 否则报告会拿拉丁的「词 / 60%」去描述一条中文判据，正好违反「必须写清口径」。
  if (worstRun.max === null) { worstRun.max = cjkMode ? ngramMaxCJK : ngramMax; worstRun.cjk = cjkMode; }
  if (worstOv.max === null) { worstOv.max = cjkMode ? overlapMaxCJK : overlapMax; worstOv.cjk = cjkMode; }

  // 指标、阈值、标题、detail 全部取自**同一对**样本：有违规就报最严重的那对，否则报全局最高。
  // （否则会出现「指标 72% / 上限 75%」却 FAIL 的自相矛盾）
  const shownRun = worstRunViol || worstRun;
  const shownOv = worstOvViol || worstOv;
  const ngramFail = exactHits.length > 0 || !!worstRunViol;
  const ovFail = !!worstOvViol;
  const runKind = shownRun.cjk ? '字' : '词';
  const ovKind = shownOv.cjk ? '字符集合' : '实词';

  const ngramDetail = exactHits.length
    ? `有 ${exactHits.length} 处整句与示例相同；最长公共连续${runKind}串 ${shownRun.len} ${runKind}（上限 <${shownRun.max}${shownRun.cjk ? '，中文按字' : ''}）`
    : `最长公共连续${runKind}串 ${shownRun.len} ${runKind}（上限 <${shownRun.max}${shownRun.cjk ? '，中文按字' : ''}）` +
      (shownRun.len ? `：「${shownRun.phrase}」（新 ${shownRun.nPath} × 例 ${shownRun.rPath}）` : '');
  const ngramEvidence = [...exactHits, ...runHits];

  // 中文口径必须在报告里写死，否则读报告的人会以为这条还是拉丁那边的「实词重合率」
  const ovNote = shownOv.cjk
    ? '；★ 中文口径：没有词表可去虚词，这条按**字符集合**算（CJK 逐字 + 拉丁按词，一个 token 都不去），阈值也因此放宽 —— 与拉丁的「实词重合率」不是同一个指标'
    : '';
  const ovDetail = ovFail
    ? `最高${ovKind}重合率 ${pct(shownOv.ratio)}（上限 <${pct(shownOv.max)}）：「${s(shownOv.nText).slice(0, 60)}」× 「${s(shownOv.rText).slice(0, 60)}」共用 ${shownOv.inter.slice(0, 12).join(', ')}${ovNote}`
    : `最高${ovKind}重合率 ${pct(shownOv.ratio)}（上限 <${pct(shownOv.max)}）${ovNote}`;

  return [
    check(`${idBase}.ngram`, `${label} · 最长公共连续${runKind}串`,
      ngramFail ? STATUS.FAIL : STATUS.PASS, shownRun.len, shownRun.max, ngramDetail, capEvidence(ngramEvidence)),
    check(`${idBase}.overlap`, `${label} · ${ovKind}重合率`,
      ovFail ? STATUS.FAIL : STATUS.PASS, Number(shownOv.ratio.toFixed(4)), shownOv.max, ovDetail, capEvidence(ovHits)),
  ];
}

// ── 检查 3：details 命名 ────────────────────────────────────
const DETAIL_FIELDS = ['name', 'latin', 'focus'];

export function checkDetails(newContent, refContent, opt = {}) {
  const maxShared = opt.maxShared ?? DETAIL_SHARED_MAX;
  const n = arr(newContent && newContent.details);
  const r = arr(refContent && refContent.details);
  if (!n.length || !r.length) {
    const why = !n.length ? '新片没有 details' : '示例片没有 details';
    return check('details.naming', '细节命名 · name/latin/focus', STATUS.UNKNOWN, null, maxShared,
      `${why} —— 素材缺失，无法判定`);
  }
  const ev = [];
  let shared = 0;
  for (const f of DETAIL_FIELDS) {
    const nv = n.map((d) => s(d && d[f]).trim().toLowerCase()).filter(Boolean);
    const rv = r.map((d) => s(d && d[f]).trim().toLowerCase()).filter(Boolean);
    const st = setStats(nv, rv);
    shared += st.inter.length;
    if (st.inter.length) {
      for (const x of st.inter) ev.push(`${f} 与示例重合：「${x}」（示例侧有 ${rv.filter((v) => v === x).length} 处）`);
    }
  }
  const ok = shared <= maxShared;
  return check('details.naming', '细节命名 · name/latin/focus',
    ok ? STATUS.PASS : STATUS.FAIL, shared, maxShared,
    ok
      ? `name/latin/focus 与示例零重合（新 ${n.length} 条 vs 例 ${r.length} 条）`
      : `与示例重合 ${shared} 处（上限 ${maxShared}）—— 细节命名沿用示例`,
    capEvidence(ev));
}

// ── 检查 4：身份字段 ────────────────────────────────────────
export function checkIdentity(newContent, refContent, opt = {}) {
  const allowed = opt.allowed ?? IDENTITY_IDENTICAL_ALLOWED;
  const c = newContent || {}, r = refContent || {};
  if (!c.title && !c.latin && !c.subject) {
    return check('identity', '身份 · title/latin/subject', STATUS.UNKNOWN, null, '不得相同',
      '新片没有 title/latin/subject —— 素材缺失，无法判定');
  }
  const same = [];
  for (const f of ['title', 'latin', 'subject']) {
    const a = normalizeText(c[f]), b = normalizeText(r[f]);
    if (a && b && a === b) same.push(`${f}：新「${c[f]}」 ≡ 例「${r[f]}」`);
  }
  const ok = allowed || same.length === 0;
  return check('identity', '身份 · title/latin/subject',
    ok ? STATUS.PASS : STATUS.FAIL, same.length, '不得相同',
    ok ? `title/latin/subject 均与示例不同（${['title', 'latin', 'subject'].map((f) => `${f}=${s(c[f]) || '—'}`).join('，')}）`
       : `${same.length} 个身份字段与示例完全相同`,
    same);
}

// ── 检查 5：配色 region 集合 ────────────────────────────────
export function checkColors(newContent, refContent, opt = {}) {
  const allowed = opt.allowed ?? COLORS_IDENTICAL_ALLOWED;
  const n = arr(newContent && newContent.colors).map((x) => s(x && x.region).trim().toLowerCase()).filter(Boolean);
  const r = arr(refContent && refContent.colors).map((x) => s(x && x.region).trim().toLowerCase()).filter(Boolean);
  if (!n.length || !r.length) {
    const why = !n.length ? '新片没有 colors[].region' : '示例片没有 colors[].region';
    return check('colors.regions', '配色 · region 集合', STATUS.UNKNOWN, null, '不得完全相同',
      `${why} —— 素材缺失，无法判定`);
  }
  const st = setStats(n, r);
  const identical = n.length === r.length && st.inter.length === n.length;
  const ok = allowed || !identical;
  const ev = [];
  if (st.inter.length) ev.push(`与示例共用的色区名：${st.inter.join(', ')}（重合率 ${pct(st.containment)}）`);
  ev.push(`新片色区：${uniq(n).join(', ')}`);
  ev.push(`示例色区：${uniq(r).join(', ')}`);
  return check('colors.regions', '配色 · region 集合',
    ok ? STATUS.PASS : STATUS.FAIL, st.inter.length, '不得完全相同',
    ok
      ? `新片色区集合与示例不同（新 ${uniq(n).length} 个 vs 例 ${uniq(r).length} 个，重合 ${st.inter.length} 个）` +
        (st.inter.length ? '；共用的名字建议人工确认是否合理' : '')
      : `色区集合与示例完全相同（${uniq(n).join(', ')}）`,
    capEvidence(ev), st.inter.length > 0);
}

// ── 检查 6：收尾 / 图注 ─────────────────────────────────────
export function checkEndCard(newContent, refContent, opt = {}) {
  const allowed = opt.allowed ?? END_CARD_IDENTICAL_ALLOWED;
  const c = newContent || {}, r = refContent || {};
  const same = [];
  const cn = normalizeText(c.caption), rn = normalizeText(r.caption);
  if (cn && rn && cn === rn) same.push(`caption 与示例相同：「${c.caption}」`);

  const ftN = normalizeText(c.end && c.end.film_title), ftR = normalizeText(r.end && r.end.film_title);
  if (ftN && ftR && ftN === ftR) same.push(`end.film_title 与示例相同：「${c.end.film_title}」`);

  const crN = arr(c.end && c.end.credits).map(normalizeText).filter(Boolean);
  const crR = arr(r.end && r.end.credits).map(normalizeText).filter(Boolean);
  if (crN.length && crR.length && crN.join('|') === crR.join('|')) {
    same.push(`end.credits 整表与示例相同（${crN.length} 条）`);
  }

  if (!cn && !ftN && !crN.length) {
    return check('end.card', '收尾 · caption / end card', STATUS.UNKNOWN, null, '不得相同',
      '新片没有 caption / end card —— 素材缺失，无法判定');
  }
  const ok = allowed || same.length === 0;
  const ev = [];
  const sharedCredits = setStats(crN, crR).inter;
  if (sharedCredits.length) ev.push(`与示例共用的 credit 行（署名/工具署名通常允许，需人工确认）：${sharedCredits.join(' ｜ ')}`);
  return check('end.card', '收尾 · caption / end card',
    ok ? STATUS.PASS : STATUS.FAIL, same.length, '不得相同',
    ok ? `caption 与 end card 均与示例不同（credits 与示例共用 ${sharedCredits.length} 行）`
       : `${same.length} 处收尾内容与示例完全相同`,
    capEvidence([...same, ...ev]));
}

// ── 检查 7/8：主体代码 ──────────────────────────────────────
/** 代码行规范化：去行首尾空白、内部空白折叠、**丢掉空行**（空行不该把连续段断开）。 */
export function codeLines(text) {
  return s(text).split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, ' ')).filter((l) => l.length > 0);
}

/** 找出 `varName = { ... }` 字面量里的顶层键名。 */
export function objectLiteralKeys(src, varName) {
  const re = new RegExp(`\\b${varName}\\s*=\\s*\\{`);
  const m = re.exec(src);
  if (!m) return [];
  const open = src.indexOf('{', m.index);
  const close = findMatchingBrace(src, open);
  if (close < 0) return [];
  const body = src.slice(open + 1, close);
  const keys = [];
  let depth = 0, segStart = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < body.length && body[i] !== q) { if (body[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '/' && body[i + 1] === '/') { while (i < body.length && body[i] !== '\n') i++; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ',' && depth === 0) {
      const km = /^\s*(?:['"`]?)([A-Za-z_$][\w$]*)\1?\s*:/.exec(body.slice(segStart, i));
      if (km) keys.push(km[1]);
      segStart = i + 1;
    }
  }
  const tail = /^\s*(?:['"`]?)([A-Za-z_$][\w$]*)\1?\s*:/.exec(body.slice(segStart));
  if (tail) keys.push(tail[1]);
  return uniq(keys);
}

function findMatchingBrace(src, openIdx) {
  if (openIdx < 0) return -1;
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** 主体模块导出的 region 键名（支持 `regions = {a,b}`、`add('a',…)`、`regions['a']=`）。 */
export function extractRegionKeys(src) {
  const keys = uniq([
    ...objectLiteralKeys(src, 'regions'),
    ...[...s(src).matchAll(/\badd\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...s(src).matchAll(/regions\[\s*['"`]([^'"`]+)['"`]\s*\]/g)].map((m) => m[1]),
  ]);
  return keys.sort();
}

/** 主体模块导出的 focus 键名。 */
export function extractFocusKeys(src) {
  return uniq(objectLiteralKeys(src, 'focus')).sort();
}

/**
 * 主体代码相似度：任意 (新 × 例) 文件对的**最长连续相同代码行**必须 < CODE_RUN_MAX。
 * files: [{ name, text }]
 */
export function checkCodeSimilarity(newFiles, refFiles, opt = {}) {
  const maxRun = opt.maxRun ?? CODE_RUN_MAX;
  const nf = arr(newFiles).filter((f) => f && f.text && codeLines(f.text).length);
  const rf = arr(refFiles).filter((f) => f && f.text && codeLines(f.text).length);
  if (!nf.length || !rf.length) {
    const why = !nf.length ? '新片主体模块缺失或为空' : '示例主体模块缺失或为空';
    return check('subjects.code', '画面主体 · 连续相同代码行', STATUS.UNKNOWN, null, maxRun,
      `${why} —— 素材缺失，无法判定`);
  }
  const ev = [];
  let worst = { len: 0, nName: '', rName: '', line: '' };
  for (const n of nf) {
    const nl = codeLines(n.text);
    for (const r of rf) {
      const rl = codeLines(r.text);
      const run = longestCommonRun(nl, rl);
      if (run.len > worst.len) worst = { len: run.len, nName: n.name, rName: r.name, line: nl[run.aStart] || '' };
      if (run.len >= maxRun) {
        ev.push(`${n.name} × ${r.name}：连续 ${run.len} 行完全相同，起于「${s(nl[run.aStart]).slice(0, 90)}」`);
      }
    }
  }
  const ok = worst.len < maxRun;
  return check('subjects.code', '画面主体 · 连续相同代码行',
    ok ? STATUS.PASS : STATUS.FAIL, worst.len, maxRun,
    ok
      ? `最长连续相同代码行 ${worst.len} 行（上限 <${maxRun}）` +
        (worst.len ? `，出现在 ${worst.nName} × ${worst.rName}` : '')
      : `最长连续相同代码行 ${worst.len} 行（上限 <${maxRun}）：${worst.nName} × ${worst.rName}`,
    capEvidence(ev));
}

/** region / focus 键名集合不得与示例完全相同。 */
export function checkSubjectKeys(newFiles, refFiles) {
  const nf = arr(newFiles).filter((f) => f && f.text);
  const rf = arr(refFiles).filter((f) => f && f.text);
  if (!nf.length || !rf.length) {
    return check('subjects.keys', '画面主体 · region/focus 键名', STATUS.UNKNOWN, null, '不得完全相同',
      '主体模块缺失 —— 素材缺失，无法判定');
  }
  const ev = [];
  let hits = 0, comparable = 0;
  for (const n of nf) {
    const nr = extractRegionKeys(n.text), nfo = extractFocusKeys(n.text);
    for (const r of rf) {
      const rr = extractRegionKeys(r.text), rfo = extractFocusKeys(r.text);
      if (nr.length && rr.length) {
        comparable++;
        if (nr.join('|') === rr.join('|')) { hits++; ev.push(`region 键名集合完全相同：${n.name} [${nr.join(', ')}] ≡ ${r.name} [${rr.join(', ')}]`); }
      }
      if (nfo.length && rfo.length) {
        comparable++;
        if (nfo.join('|') === rfo.join('|')) { hits++; ev.push(`focus 键名集合完全相同：${n.name} [${nfo.join(', ')}] ≡ ${r.name} [${rfo.join(', ')}]`); }
      }
    }
  }
  if (!comparable) {
    return check('subjects.keys', '画面主体 · region/focus 键名', STATUS.UNKNOWN, null, '不得完全相同',
      '两侧都没有可解析的 region/focus 字面量（或只有一侧有）—— 无法比对',
      arr(nf).map((f) => `${f.name}：region=[${extractRegionKeys(f.text).join(', ')}] focus=[${extractFocusKeys(f.text).join(', ')}]`));
  }
  const ok = hits === 0;
  return check('subjects.keys', '画面主体 · region/focus 键名',
    ok ? STATUS.PASS : STATUS.FAIL, hits, '不得完全相同',
    ok ? `比较了 ${comparable} 组键名集合，没有一组与示例完全相同`
       : `${hits} 组键名集合与示例完全相同 —— 主体结构沿用示例`,
    capEvidence(ev));
}

// ── 检查 9：时间线的信息顺序 ─────────────────────────────────
/** events.json → 事件类型序列（按时间顺序）。 */
export function eventTypeSequence(events) {
  const ev = arr(events && events.ev);
  return ev.map((e) => s(e && e.type)).filter(Boolean);
}

/** content.json → 信息单元序列（给人看的，供人工比对「信息编排」）。 */
export function infoSequence(content) {
  const c = content || {};
  const out = [];
  if (c.title) out.push(`title:${c.title}`);
  arr(c.details).forEach((d, i) => out.push(`detail${i + 1}:${s(d && (d.focus || d.name))}`));
  arr(c.voice && c.voice.lines).forEach((l) => {
    const id = s(l && l.id);
    const kind = id === 'title' ? 'title' : /^d\d+$/.test(id) ? 'detail' : /^s\d+$/.test(id) ? 'section' : id === 'close' ? 'close' : 'other';
    out.push(`${id || '(无 id)'}[${kind}]`);
  });
  return out;
}

/**
 * 时间线：事件类型序列的最长公共子序列占比必须 < TIMELINE_LCS_RATIO_MAX。
 * 换 content.json 重跑时影片代码没动 → 事件类型序列原样 → 占比 1.0 → 判失败。
 * 素材缺失（没有 events.json）→ unknown，**不放行**。
 */
export function checkTimeline(newEvents, refEvents, opt = {}) {
  const maxRatio = opt.maxRatio ?? TIMELINE_LCS_RATIO_MAX;
  const n = eventTypeSequence(newEvents);
  const r = eventTypeSequence(refEvents);
  if (!n.length || !r.length) {
    const why = !n.length ? '新片没有事件时间线（events.json 缺失或 ev 为空）' : '示例片没有事件时间线';
    return check('timeline.order', '时间线 · 事件类型序列', STATUS.UNKNOWN, null, maxRatio,
      `${why} —— 素材缺失，无法判定`, []);
  }
  const lcs = lcsLength(n, r);
  const ratio = lcs / Math.min(n.length, r.length);
  const identical = n.join('|') === r.join('|');
  const ok = !identical && ratio < maxRatio;
  const ev = [
    `新片事件类型序列（${n.length}）：${n.join(' → ')}`,
    `示例事件类型序列（${r.length}）：${r.join(' → ')}`,
    `LCS=${lcs}，占比=${pct(ratio)}（分母 min(${n.length},${r.length})）`,
  ];
  return check('timeline.order', '时间线 · 事件类型序列',
    ok ? STATUS.PASS : STATUS.FAIL, Number(ratio.toFixed(4)), maxRatio,
    identical
      ? `事件类型序列与示例**逐项完全相同**（${n.length} 个事件）—— 这是「换 content.json 重跑」的指纹`
      : ok
        ? `事件类型序列与示例不同（LCS 占比 ${pct(ratio)} < ${pct(maxRatio)}）`
        : `事件类型序列与示例高度重合（LCS 占比 ${pct(ratio)} ≥ ${pct(maxRatio)}）`,
    ev, !identical && ratio >= 0.7);
}

// ── 汇总 ───────────────────────────────────────────────────
/**
 * 跑全部检查。
 * @param {{newContent:object, refContent:object, newFiles:Array, refFiles:Array, newEvents?:object, refEvents?:object, meta?:object}} input
 */
export function auditAll(input) {
  const i = input || {};
  const checks = [
    ...checkTextOriginality(voiceUnits(i.newContent), voiceUnits(i.refContent), { id: 'text.voice', label: '旁白' }),
    ...checkTextOriginality(plateUnits(i.newContent), plateUnits(i.refContent), { id: 'text.plate', label: '图版文字' }),
    checkDetails(i.newContent, i.refContent),
    checkIdentity(i.newContent, i.refContent),
    checkColors(i.newContent, i.refContent),
    checkEndCard(i.newContent, i.refContent),
    checkCodeSimilarity(i.newFiles, i.refFiles),
    checkSubjectKeys(i.newFiles, i.refFiles),
    checkTimeline(i.newEvents, i.refEvents),
  ];
  const pass = checks.filter((c) => c.status === STATUS.PASS).length;
  const fail = checks.filter((c) => c.status === STATUS.FAIL).length;
  const unknown = checks.filter((c) => c.status === STATUS.UNKNOWN).length;
  return {
    generatedAt: new Date().toISOString(),
    meta: i.meta || {},
    checks,
    summary: { total: checks.length, pass, fail, unknown, ok: fail === 0 && unknown === 0 },
    sequences: {
      newInfo: infoSequence(i.newContent),
      refInfo: infoSequence(i.refContent),
      newEvents: eventTypeSequence(i.newEvents),
      refEvents: eventTypeSequence(i.refEvents),
    },
    needsHuman: checks.filter((c) => c.needsHuman).map((c) => c.id),
  };
}

// ── 报告 ───────────────────────────────────────────────────
const ICON = { pass: '✅', fail: '❌', unknown: '⚠️' };

/** 出 markdown 报告（直接给人看）。 */
export function renderMarkdown(rep) {
  const r = rep || {};
  const s0 = r.summary || { total: 0, pass: 0, fail: 0, unknown: 0, ok: false };
  const L = [];
  L.push('# 原创性审计报告（从零原创 · 会失败的自动检查）');
  L.push('');
  L.push(`- 生成时间：${r.generatedAt || '?'}`);
  const m = r.meta || {};
  if (m.newContent) L.push(`- 新片 content：\`${m.newContent}\``);
  if (m.newSubjects) L.push(`- 新片 subjects：\`${m.newSubjects}\``);
  if (m.refContent) L.push(`- 示例 content：\`${m.refContent}\``);
  if (m.refSubjects) L.push(`- 示例 subjects：\`${m.refSubjects}\``);
  if (m.newEvents) L.push(`- 新片 events：\`${m.newEvents}\``);
  if (m.refEvents) L.push(`- 示例 events：\`${m.refEvents}\``);
  L.push(`- 结论：**${s0.ok ? '全部通过' : '不通过'}** —— 通过 ${s0.pass} / 失败 ${s0.fail} / 无法判定 ${s0.unknown}（共 ${s0.total}）`);
  L.push('');
  if (s0.unknown > 0) {
    L.push('> ⚠️ 「无法判定」**不等于通过**。素材缺失时本工具拒绝放行，请补齐素材后重跑。');
    L.push('');
  }
  L.push('## 汇总');
  L.push('');
  L.push('| # | 检查 | 结果 | 指标 | 阈值 | 结论 |');
  L.push('|---|---|---|---|---|---|');
  (r.checks || []).forEach((c, k) => {
    L.push(`| ${k + 1} | ${c.title} | ${ICON[c.status] || '?'} ${c.status} | ${fmt(c.metric)} | ${fmt(c.threshold)} | ${esc(c.detail)} |`);
  });
  L.push('');
  L.push('## 逐条证据');
  L.push('');
  for (const c of r.checks || []) {
    L.push(`### ${ICON[c.status] || '?'} ${c.title} \`${c.id}\``);
    L.push('');
    L.push(`- 结论：${esc(c.detail)}`);
    L.push(`- 指标 \`${fmt(c.metric)}\` / 阈值 \`${fmt(c.threshold)}\``);
    if (c.needsHuman) L.push('- ⚠️ **需人工复核**：这一条带有语义判断成分，工具只保证数字层面。');
    if (arr(c.evidence).length) {
      L.push('- 证据：');
      for (const e of c.evidence) L.push(`  - ${esc(e)}`);
    }
    L.push('');
  }
  const q = r.sequences || {};
  if (arr(q.newEvents).length || arr(q.refEvents).length) {
    L.push('## 时间线（两份事件序列，供人工比对）');
    L.push('');
    L.push(`- 新片（${arr(q.newEvents).length}）：${arr(q.newEvents).join(' → ') || '（无）'}`);
    L.push(`- 示例（${arr(q.refEvents).length}）：${arr(q.refEvents).join(' → ') || '（无）'}`);
    L.push('');
  }
  if (arr(q.newInfo).length || arr(q.refInfo).length) {
    L.push('## 信息单元序列（供人工比对「信息编排」）');
    L.push('');
    L.push(`- 新片：${arr(q.newInfo).join(' → ') || '（无）'}`);
    L.push(`- 示例：${arr(q.refInfo).join(' → ') || '（无）'}`);
    L.push('');
  }
  L.push('## 本工具判不了、必须人工看的维度');
  L.push('');
  for (const t of [
    '细节段讲的是不是**同一类东西**（示例是「同一只蜜蜂的一组部件」；新片若是「一株植物的器官 + 一个港口内嵌图」则是换了内容，但这是语义判断，工具只输出两份序列）。',
    '画面元素是否真的换了（工具只比代码文本与键名；「画的是不是同一只虫子」要看图）。',
    '镜头编排的**动机**是否相同（工具只比事件类型序列，比不出「为什么这样切」）。',
    '案例素材是否属于公共知识（工具判不了事实对错与来源）。',
    '**跨语言的照译**：把示例的英文旁白逐句翻译成中文（或反之）在字符/词层面几乎零重合，本工具判通过 —— 这是原理性的盲区，不是判据失效。翻译不是「套模板」，但**翻译示例的文案**确实是复用，需要人看一眼两版的**信息编排**是否同源（报告里的「信息单元序列」就是给你比这个的）。',
    '「无模板套用痕迹」的最终观感（人眼一遍）。',
  ]) L.push(`- ${t}`);
  L.push('');
  return L.join('\n');
}

function fmt(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v).replace(/\|/g, '\\|');
}
function esc(v) { return s(v).replace(/\|/g, '\\|').replace(/\n/g, ' '); }
