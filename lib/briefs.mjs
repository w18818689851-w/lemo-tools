// lib/briefs.mjs —— 「主题工单」数据层（**非 C 盘** · 原子写 · 损坏降级 · 有上限）
//
// ★ 它解决什么问题：
//   用户想要「输入主题 → 选风格 → 出片」。但这个库（lemo-opuscar）的**画面主体是写死的**，
//   内容是可数据化的。43 个 demo 里只有 4 个是「内容驱动」（有 content.json，画面由数据决定）：
//
//     engraving         铜版画         content.json 的 subject 字段（库内标本表：bee / scallop）
//     hologram-hud      科幻全息界面    model 字段（models/volt.json，3D 模型文件）
//     midcentury-toon   50s 扁平卡通    product 字段（扫地机器人 Pip）
//     silkscreen-poster 丝印旅行海报    park 字段（步道）
//
//   ⇒ 能改「讲什么」（标题 / 文案 / 配色 / 细节 / 台词），**不能改「画什么」**（主体形状）。
//   所以本系统**只服务这 4 个风格**（白名单，见 BRIEF_STYLES）。
//
// ★ 本模块只做**数据**，不生成内容、不碰 demo 目录：
//   内容是**外部 LLM（WorkBuddy）**生成的 —— 它读 /api/briefs/processable 拿到
//   STYLE.md 全文 + content.json 样例 + lines.json 样例 + demo 路径，生成新内容，
//   然后把工单**回写**成 ready。控制台只负责「落工单 / 透传 runOpts / 起任务 / 记结果」。
//
// ★ 状态机（**这是核心，要严格**）：
//
//     pending  ← 控制台创建（等 WorkBuddy 处理）
//     ready    ← WorkBuddy 生成完内容、填好 contentRel / linesRel / runOpts
//     running  ← 控制台正在出片（起了 lemo-make 子进程）
//     done     ← 出片成功
//     failed   ← 出片失败（或控制台重启导致中断）
//
//   允许的迁移只有两条：pending → ready、failed → ready（重试）。
//   running → done/failed 由控制台内部写（不是外部能改的）；其余迁移一律 409。
//   ⚠️ 逃生口：外部直接改 JSON 文件时**绕过了**这里的校验（读的时候只看 status 合不合法）。
//      但出片那一刻会重新校验一次（只有 ready 才能出片），所以绕过也跑不出错片。
//
// ★ 语言版本（lang）：工单带一个 lang（'en' / 'zh'），取值来自库侧 core/lang/lang.mjs 的 LANGS
//   （控制台侧由 lib/langs.mjs 代理，不另造一套）。控制台只负责**存**它，并在出片时把「lang ≠ en」
//   翻译成命令里的 `--lang <code>`（en **不传**，于是英文版的命令行与改动前逐字一致）。
//   语言怎么影响画面与配音是库侧的事（内容文件的 "lang" 字段驱动字体/字距/圆号前缀/刻名/音色），
//   控制台不参与、也不复制那套逻辑。
//
// ★ 输出尺寸（ratio / size）：工单带一个 ratio（预设比例，**默认 '9:16'**）与一个可选的 size
//   （自定义像素，如 '1080x1920'）。比例清单与「比例 → 像素」的换算**唯一来源是库**：
//   D:\lemo-opuscar\core\render\size.mjs（控制台侧由 lib/sizes.mjs 代理，不另造一份比例表）。
//   控制台只负责**存**它，并在出片时**显式**把 `--ratio <code>`（或 `--size <WxH>`）传给编排器。
//   ★ 与语言的 `--lang en` **不传**不同：尺寸是**新功能、没有历史包袱**，所以默认值也显式传 ——
//     命令行自解释，且以后改默认值不会造成行为漂移。
//   ★ 旧工单（没有 ratio / size 字段）读的时候按 ratio='9:16' 处理（见 normalize），向后兼容。
//
// ★ 回写契约（WorkBuddy 二选一）：
//   ① 直接改文件：D:\lemo-films\.briefs\<id>.json（把 status 改成 ready，填 contentRel/linesRel/runOpts）
//   ② PATCH /api/briefs/<id>（走校验，推荐）
//
// ★ 为什么**每次读都从磁盘读、不缓存**（本模块最重要的设计决定）：
//   回写方式是「外部改文件」。只要内存里缓存一份，外部改完控制台就看不见 —— 工单会永远卡在 pending。
//   工单是小文件（~1KB）× 上限 200 张，一次 list 全读也就几毫秒，不值得为它引入缓存与失效逻辑。
//
// ★ 落盘纪律（沿用 lib/store.mjs 的做法）：
//   1. **原子写**：先写 `<id>.json.tmp` 再 rename（Windows 上 Node 的 rename 会覆盖已存在的目标）。
//   2. **损坏降级**：某个工单文件坏了 → warn + 跳过它，**服务照常起**（宁可丢一张工单，也不能让控制台起不来）。
//   3. **best-effort**：任何写失败只 warn，绝不抛出、绝不阻塞别的功能。
//   4. **必须有上限**：最多 CAPS.maxBriefs 张，超了从**最旧**的裁（正在出片的不裁）。
//   5. **不写 C 盘**：固定在 D:\lemo-films\.briefs（与成片同盘）。以 `.` 开头，所以
//      server.mjs 的 /api/films 扫描（跳过 `.` 开头的目录）不会把它当成风格目录。
//   6. **不落进 demo 目录、不动仓库**：D:\lemo-opuscar 是「库」，会被外部 LLM 改；控制台不往那儿写。

import fs from 'node:fs';
import path from 'node:path';

import { CFG } from './env.mjs';     // 只借常量（winLib / exportDir）；env.mjs 顶层无副作用
import * as langs from './langs.mjs'; // 「语言版本」注册表的只读代理（语言清单的权威来源在库侧）
import * as sizes from './sizes.mjs'; // 「输出尺寸」注册表的只读代理（比例清单的权威来源在库侧）
import * as aspects from './aspects.mjs'; // 「影片构图能力」的只读文本探测（影片模块的 aspects 声明）
// ★ 只借 jobOutDir 这一个**纯函数**来算「这次任务的独立输出目录」——
//   filmUrl 必须按实际产出的那一份拼，不能一律按样板片拼（见 normalize 里的说明）。
//   为什么不自己拼目录：`_jobs` 的落点判据只有一处（lib/jobs.mjs:jobOutDir），
//   自己再拼一份必然漂移（比如哪天目录改名）。
//   （`effectiveOutDir` 回答的是「任务被要求写到哪」，而这里要回答的是「文件**实际**在不在」——
//    后者才是 URL 该不该走 _jobs 路由的判据，见下面的 isJobFilm。）
import { jobOutDir } from './jobs.mjs';

const ROOT = path.join(CFG.exportDir, '.briefs');          // D:\lemo-films\.briefs
// ★ 风格源码根：**唯一**来源是 lib/aspects.mjs 的 STYLES_DIR（它由 lib/styles-root.mjs 解析，支持
//   `LEMO_STYLES_ROOT` 覆盖）。本模块**不再自己算一份** —— 否则同一文件里两条来源（本行的 STYLES_DIR
//   与 :154 走 aspects 的能力探测）会漂移：设了覆盖点，能力探测看假树、demoDir/styleDir 还在看真树。
//   ★ 本常量是 **export** 的，`server.mjs` 的 `/api/langs` 处理器在用它 ⇒ 转发（而不是删掉）以免打断那个消费者。
export const STYLES_DIR = aspects.STYLES_DIR;
const briefFile = (id) => path.join(ROOT, `${id}.json`);

export const CAPS = {
  maxBriefs: 200,        // 工单总数上限（超了裁最旧的）
  maxTopicLen: 500,      // 主题原文长度上限（防手滑粘贴一整篇文章）
  maxRunOpts: 40,        // runOpts 个数上限
};

export const STATUSES = ['pending', 'ready', 'running', 'done', 'failed'];

/** 状态机：外部（PATCH）允许的迁移。running → done/failed 由控制台内部写，不在此表。 */
export const TRANSITIONS = {
  pending: ['ready'],
  ready: [],        // 出片由 POST /run 处理，不是「改状态」
  running: [],
  done: [],
  failed: ['ready'],   // 「重试」= failed → ready
};

/**
 * 白名单：本系统**只服务这 4 个内容驱动风格**（画面主体固定，文案/配色/细节可数据化）。
 *
 * 中文名取自库内权威索引 D:\lemo-opuscar\styles\README.md 的表格（与侧栏显示的一致），
 * 不是我自己翻的。`subjectField` / `subjectNote` 是给外部 LLM 看的「什么能动、什么不能动」。
 */
export const BRIEF_STYLES = [
  {
    slug: 'engraving',
    cn: '铜版画',
    en: 'Copperplate Engraving',
    subjectField: 'subject',
    subjectNote: '画面主体是库内的博物志标本（现有可选：bee 蜜蜂 / scallop 扇贝，见 demo/subjects/）。'
      + '主题只改标题、拉丁名、细节三条、配色、图注与台词 —— 不要换主体形状。',
  },
  {
    slug: 'hologram-hud',
    cn: '科幻全息界面',
    en: 'Sci-fi Hologram HUD',
    subjectField: 'model',
    subjectNote: '画面主体是库内的 3D 模型文件（models/volt.json，一台城市电助力车）。'
      + '主题只改产品名/参数标注/文案/色相（hue / accent）与台词 —— 不要换模型。',
  },
  {
    slug: 'midcentury-toon',
    cn: '50s 扁平卡通',
    en: 'Mid-century Cartoon',
    subjectField: 'product',
    subjectNote: '画面主体是库内画好的产品角色（扫地机器人 Pip）与它扫过的房间平面图。'
      + '主题只改标题/三步说明/提示/结尾语/调色板与台词 —— 不要换角色。',
  },
  {
    slug: 'silkscreen-poster',
    cn: '丝印旅行海报',
    en: 'Silkscreen Travel Poster',
    subjectField: 'park',
    subjectNote: '画面主体是库内画好的山湖场景（按 scene 选 lake / waterfall / ridge 等）+ 丝印分层。'
      + '主题只改地名/标题/步道表/配色与页脚。'
      + '★ 该 demo **没有 lines.json**（无人声台词），所以 linesRel 留空即可。',
  },
];

const bySlug = new Map(BRIEF_STYLES.map((s) => [s.slug, s]));

export function styleBySlug(slug) { return bySlug.get(slug) || null; }
export function isBriefStyle(slug) { return bySlug.has(slug); }
export function styleSlugs() { return BRIEF_STYLES.map((s) => s.slug); }
export function styleList() {
  return BRIEF_STYLES.map((s) => ({
    slug: s.slug, cn: s.cn, en: s.en, subjectField: s.subjectField,
    // ★ 影片构图能力（只读文本探测，见 lib/aspects.mjs）：这个风格的影片**真的能正确构图**的比例。
    //   不写 aspects 声明 = 只支持 16:9（= 没改造过，给别的尺寸会被裁切）。
    //   UI 的「主题出片」表单据此在出片前警告 —— 但**不禁用**出片（用户有权坚持出，只是要知情）。
    aspects: (() => {
      const a = aspects.styleAspects(s.slug);
      return { supported: a.supported, declared: a.declared, probe: a.probe };
    })(),
  }));
}
export function unsupportedStyleMessage(slug) {
  const list = BRIEF_STYLES.map((s) => `${s.slug}（${s.cn}）`).join(' / ');
  return `不支持的风格 ${JSON.stringify(slug)}：本系统只服务 4 个「内容驱动」风格 —— ${list}。`
    + '其余 39 个 demo 的画面主体是写死的，主题改不动它们，所以不在白名单里。';
}

// id 形状：b<base36 时间戳>-<序号>。既当文件名也当 API 参数，所以必须严格到不可能穿越路径。
const ID_RE = /^b[A-Za-z0-9]+-[A-Za-z0-9]+$/;
export const isValidBriefId = (id) => ID_RE.test(String(id == null ? '' : id));

// ── 状态 ────────────────────────────────────────────────────
let ready = false;
let disabledReason = null;
const warned = new Set();

function warn(msg) {
  if (warned.has(msg) || warned.size >= 30) return;
  warned.add(msg);
  console.warn(`  ⚠️  [主题工单] ${msg}`);
}

export function briefsStatus() {
  return { ready, disabledReason, root: ROOT, caps: CAPS, statuses: STATUSES, styles: styleList() };
}

function ensureDir() {
  if (ready) return true;
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    ready = true;
    return true;
  } catch (e) {
    disabledReason = `无法创建 ${ROOT}：${e.message}`;
    warn(`${disabledReason}（工单功能本次不可用，控制台其余功能照常）`);
    return false;
  }
}

// ── 校验小工具 ──────────────────────────────────────────────
const strOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isoOrNull = (v) => {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** contentRel / linesRel 只允许「demo 目录下的一个 .json 文件名」——不许有 ..、不许绝对路径、不许子目录。 */
export function isSafeContentRel(s) {
  if (typeof s !== 'string' || !s) return false;
  if (s.includes('..') || s.includes('/') || s.includes('\\') || s.includes(':')) return false;
  return /^[A-Za-z0-9._-]+\.json$/.test(s);
}

/** 工单的 runOpts 里有没有指定 `--film <name>`（有就按那一部影片判构图能力；没有 = 页面默认的 `film`）。 */
const filmOfRunOpts = aspects.filmFromOpts;

// 选项 token 的形状白名单。它挡的是「在 argv 里没有正当含义、却可能被下游工具当元字符」的字符：
// 空白 / 引号 / `;` `|` `&` `$` 反引号 / 通配符 `*` `?` / `<` `>` / `\` / 非 ASCII。
// ★ 它**不是**路径白名单（`/` 与 `.` 是放行的 —— `--out <绝对路径>` 是正当用法）。
const OPT_RE = /^[A-Za-z0-9._\-=/]+$/;
// ★ `--ratio` 的值是**唯一**允许含 `:` 的 token（形如 `9:16`，库侧 RATIOS 全是这种写法）。
//   为什么不把 `:` 直接加进 OPT_RE：那等于给**每一个** token 开 `:`（含 `--out` 的值），
//   把这道形状闸整体放宽一格 —— 「为了让一个参数通过而把整条校验放宽」正是要避免的。
//   这里只在 `--ratio` 的**值位**换用**更严**的判据：与编排器同源（lemo-make.mjs 对 `--ratio`
//   也是 parseSizeSpec + resolveSize）—— 必须是库侧预设比例，或合法的自定义像素（WxH、偶数、范围内）。
//   ⇒ 比字符白名单更精确：`--ratio 99:99` 这种「字符都合法、但不是比例」的写法会被拒。
// 值型选项不能是最后一个 token（否则编排器会以「缺少值」报错）。判据与 server.mjs 的 apiRun 一致。
export const NEEDS_VALUE = ['--fps', '--workers', '--out', '--venc', '--q', '--q-events', '--grain', '--manifest',
  '--lines', '--film', '--lang', '--ratio', '--size', '--voice', '--speed'];

/**
 * 校验一串 CLI 选项（出片时透传给编排器）。**判据只有这一处**，server.mjs 的 /api/run 与
 * /api/briefs/:id/run 都调它 —— 免得两处各写一遍然后漂移。
 * @param {string[]} opts
 * @param {string} [label] 报错里怎么称呼这串参数（'opts' / 'runOpts'）
 * @returns {{ok:boolean, error?:string}}
 */
export function validateOpts(opts, label = 'runOpts') {
  if (!Array.isArray(opts)) return { ok: false, error: `${label} 必须是字符串数组` };
  if (opts.length > CAPS.maxRunOpts) return { ok: false, error: `${label} 最多 ${CAPS.maxRunOpts} 项（收到 ${opts.length}）` };
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    if (typeof o !== 'string') return { ok: false, error: `${label} 必须是字符串数组` };
    // ★ `--ratio` 的**值**（形如 9:16，含 `:`）走语义判据，不走字符白名单 —— 见 OPT_RE 上面的说明。
    //   `!o.startsWith('--')`：值缺失时（`--ratio --dry-run`、或以 `--ratio` 结尾）这里**不算值**，
    //   让下面 NEEDS_VALUE 那一遍报出原本的「缺少值」文案，不抢它的错。
    if (i > 0 && opts[i - 1] === '--ratio' && !o.startsWith('--')) {
      if (!sizes.resolveSize({ ratio: o })) {
        return { ok: false, error: `${label} 里 --ratio 的取值非法：${o}`
          + `（可用比例 ${sizes.ratioIds().join(' / ')}，或自定义像素如 1080x1920）` };
      }
      continue;
    }
    if (!OPT_RE.test(o)) return { ok: false, error: `选项含非法字符：${o}` };
  }
  for (let i = 0; i < opts.length; i++) {
    if (NEEDS_VALUE.includes(opts[i]) && (opts[i + 1] === undefined || opts[i + 1].startsWith('--'))) {
      return { ok: false, error: `${opts[i]} 缺少值` };
    }
  }
  return { ok: true };
}

// ── 读 ──────────────────────────────────────────────────────
/** 只保留「落盘用」的规范字段（派生字段如 filmUrl 不落盘）。 */
function serialize(b) {
  return {
    id: b.id,
    topic: b.topic,
    slug: b.slug,
    // ★ 语言版本（'en' / 'zh'，键与库侧 core/lang/lang.mjs 的 LANGS 一致）。
    //   旧工单文件没有这个字段 → 读的时候按 'en' 处理（见 normalize），所以向后兼容。
    //   「选中文版」= 出片时给编排器补一个 `--lang zh`（编排器把它换成 content=X.zh.json）。
    lang: b.lang,
    // ★ 输出尺寸：ratio 是预设比例（默认 '9:16'），size 是自定义像素（如 '1080x1920'，可为 null）。
    //   旧工单文件没有这两个字段 → 读的时候按 ratio='9:16' / size=null 处理（见 normalize），向后兼容。
    ratio: b.ratio,
    size: b.size,
    status: b.status,
    createdAt: b.createdAt,
    processedAt: b.processedAt,
    contentRel: b.contentRel,
    linesRel: b.linesRel,
    runOpts: b.runOpts,
    notes: b.notes,
    // ── 以下由控制台写（外部 LLM 不必填，填了也会被出片流程覆盖）──
    jobId: b.jobId,
    startedAt: b.startedAt,
    endedAt: b.endedAt,
    error: b.error,
    film: b.film,
  };
}

/** 把磁盘上的一坨 JSON 规范成内部形状。字段缺失一律给安全默认值（**不因为缺字段就丢掉整张工单**）。 */
function normalize(id, o) {
  const style = styleBySlug(o.slug);
  const status = STATUSES.includes(o.status) ? o.status : 'pending';
  if (o.status !== undefined && !STATUSES.includes(o.status)) {
    warn(`工单 ${id} 的 status=${JSON.stringify(o.status)} 不认识 → 按 pending 处理（请改成 ${STATUSES.join(' / ')}）`);
  }
  const film = strOrNull(o.film);
  // ★ 语言版本：缺失（旧工单）或不是注册表里的键 → 一律按 en（**不因为缺字段就丢掉整张工单**）。
  const lang = langs.isLangCode(o.lang) ? o.lang : langs.DEFAULT_LANG;
  if (o.lang !== undefined && !langs.isLangCode(o.lang)) {
    warn(`工单 ${id} 的 lang=${JSON.stringify(o.lang)} 不在语言注册表（${langs.langCodes().join(' / ')}）→ 按 ${langs.DEFAULT_LANG} 处理`);
  }
  // ★ 输出尺寸：缺失（旧工单）或不是预设比例 → 按默认比例；size 不合法 → 丢弃（只 warn，不丢工单）。
  if (o.ratio !== undefined && o.ratio !== null && o.ratio !== '' && !sizes.isRatioId(o.ratio)) {
    warn(`工单 ${id} 的 ratio=${JSON.stringify(o.ratio)} 不在预设比例（${sizes.ratioIds().join(' / ')}）→ 按 ${sizes.DEFAULT_RATIO} 处理`);
  }
  if (o.size !== undefined && o.size !== null && o.size !== ''
    && !(typeof o.size === 'string' && sizes.resolveSize({ size: o.size.trim() }))) {
    warn(`工单 ${id} 的 size=${JSON.stringify(o.size)} 不是合法的自定义尺寸（要写成 宽x高，如 1080x1920）→ 已丢弃，按 ratio 处理`);
  }
  const ratio = sizes.isRatioId(o.ratio) ? o.ratio : sizes.DEFAULT_RATIO;
  const size = (typeof o.size === 'string' && o.size.trim() && sizes.resolveSize({ size: o.size.trim() }))
    ? o.size.trim() : null;
  const b = {
    id,
    topic: String(o.topic == null ? '' : o.topic).replace(/\s+/g, ' ').trim().slice(0, CAPS.maxTopicLen),
    slug: o.slug,
    lang,
    ratio,
    size,
    status,
    createdAt: isoOrNull(o.createdAt) || new Date(0).toISOString(),
    processedAt: isoOrNull(o.processedAt),
    contentRel: isSafeContentRel(o.contentRel) ? o.contentRel : null,
    linesRel: isSafeContentRel(o.linesRel) ? o.linesRel : null,
    runOpts: Array.isArray(o.runOpts) ? o.runOpts.filter((x) => typeof x === 'string') : [],
    notes: typeof o.notes === 'string' ? o.notes : '',
    jobId: strOrNull(o.jobId),
    startedAt: isoOrNull(o.startedAt),
    endedAt: isoOrNull(o.endedAt),
    error: strOrNull(o.error),
    film,
  };
  const si = sizes.sizeInfo(b);   // 尺寸摘要（派生，不落盘）：UI 显示 + 命令预览共用
  // ★ 影片构图能力核对（派生，不落盘）：工单选的尺寸落不落在这个风格影片**真的能正确构图**的比例上。
  //   有 `--film <name>` 就按那一部影片判（精确）；没有就按该风格 demo 下所有影片模块的并集（乐观）。
  //   探测是**读源码文本**（影片模块是浏览器 ESM，node 不能 import）；探测不到 = 只支持 16:9。
  //   这里只**给警告**，不拦出片 —— 用户有权坚持出，只是要知情。
  const ac = aspects.aspectCheck({ slug: b.slug, ratio: b.ratio, size: b.size, film: filmOfRunOpts(b.runOpts) });
  // ★ 成片 URL（派生，不落盘）：**按这次任务实际产出的那一份**拼，不能一律按样板片目录拼。
  //   控制台出片的产物落在 `_jobs\<任务id>\<slug>.mp4`（见 lib/jobs.mjs:jobOutDir —— 由
  //   jobs.injectOutDir 在 spawn 前注入 `--out`），它由 `/api/films/_jobs/:jobId/:file` 发字节。
  //   旧的 `/api/films/<slug>/<file>` 指的是**样板片**目录 ⇒ 会打开样板片而不是本次产物（上一轮的真缺陷）。
  // ★ 判据 = 产物**在不在** `_jobs\<任务id>\` 下（复用 lib/jobs.mjs 的目录函数，不自己拼目录）。
  //   这与 lib/jobs.mjs:findFilm 同源：它也是「先看这次任务的独立输出目录，取不到才回落样板片」，
  //   而 b.film 记的正是它的结果 ⇒ 两者不会各说各话。
  //   ⚠️ 光看「任务配了 `--out _jobs\<id>`」不够：`--dry-run` / 产物被清理时那个文件**并不存在**，
  //      此时 b.film 指的是**样板片**（findFilm 的第二候选），必须退回样板片路由 —— 否则链接会 404。
  //   ⚠️ 用户自带 `--out <别处>` 时产物不在 `_jobs` 下、那条路由够不着 ⇒ 同样退回旧拼法
  //      （与改动前一致，调用方不会因为拿不到 URL 而崩）。
  const isJobFilm = !!(film && b.jobId && fs.existsSync(path.join(jobOutDir(b.jobId), film)));
  const filmUrl = !film ? null
    : isJobFilm ? `/api/films/_jobs/${encodeURIComponent(b.jobId)}/${encodeURIComponent(film)}`
      : `/api/films/${encodeURIComponent(b.slug)}/${encodeURIComponent(film)}`;
  return {
    ...b,
    styleCn: style ? style.cn : '',
    styleEn: style ? style.en : '',
    langCn: langs.langLabel(b.lang),     // 派生字段（不落盘）：给 UI 显示「中文版 / 英文版」
    // ★ 输出尺寸的派生字段（不落盘）：sizeDisplay 是「落进命令行的那个值」
    //   —— 有自定义像素就是像素（如 1080x1920），否则是比例（如 9:16）。
    sizeInfo: si,
    sizeDisplay: si.display,
    sizeLabel: si.ratioLabel,
    // ★ 影片构图能力（派生字段，不落盘）：aspectFits=false 时 aspectWarning 是给 UI 的短提示，
    //   aspectWarningDetail 是完整说明（tooltip 用）。UI 只读这几个字段，不自己判。
    aspectFits: ac.fits,
    aspectWarning: ac.warning,
    aspectWarningDetail: ac.detail,
    aspectsSupported: ac.supported,
    aspectsMode: ac.mode,
    aspectsProbe: ac.probe,
    demoDir: path.join(STYLES_DIR, b.slug, 'demo'),
    // 前端要的成片链接。**两种形状**：job 产物 → `/api/films/_jobs/:jobId/:file`；
    // 样板片 → `/api/films/:slug/:file`（与 server.mjs 的对应路由一致）。
    filmUrl,
  };
}

function validShape(id, o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return '不是一个 JSON 对象';
  if (typeof o.slug !== 'string' || !isBriefStyle(o.slug)) return `slug ${JSON.stringify(o.slug)} 不在白名单（${styleSlugs().join(' / ')}）`;
  if (typeof o.topic !== 'string') return 'topic 不是字符串';
  return null;
}

/**
 * 读一张工单。**任何异常都返回 null**（调用方跳过它，服务照常）。
 * @returns {object|null}
 */
export function readBrief(id) {
  if (!isValidBriefId(id)) return null;
  if (!ensureDir()) return null;
  let raw;
  try {
    raw = fs.readFileSync(briefFile(id), 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') warn(`读工单 ${id}.json 失败：${e.message}`);
    return null;
  }
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    // ★ 损坏降级：跳过这一张，其它工单与服务不受影响
    warn(`工单 ${id}.json 损坏（${e.message}）→ 已跳过它（其它工单与服务照常，删掉或修好这个文件即可）`);
    return null;
  }
  const bad = validShape(id, obj);
  if (bad) { warn(`工单 ${id}.json 字段不合法（${bad}）→ 已跳过它`); return null; }
  return normalize(id, obj);
}

/** 列出全部工单（新 → 旧）。损坏的会被跳过并 warn。 */
export function listBriefs() {
  if (!ensureDir()) return [];
  let names = [];
  try {
    names = fs.readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.json') && !d.name.endsWith('.tmp'))
      .map((d) => d.name.slice(0, -'.json'.length));
  } catch (e) {
    warn(`读工单目录失败（${e.message}）→ 按空列表处理`);
    return [];
  }
  const out = [];
  for (const id of names) {
    if (!isValidBriefId(id)) { warn(`工单目录里有个文件名不像工单：${id}.json → 已跳过`); continue; }
    const b = readBrief(id);
    if (b) out.push(b);
  }
  out.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    || String(b.id).localeCompare(String(a.id)));
  return out;
}

export function getBrief(id) { return readBrief(id); }

export function countByStatus(list = listBriefs()) {
  const c = {};
  for (const s of STATUSES) c[s] = 0;
  for (const b of list) c[b.status] = (c[b.status] || 0) + 1;
  return c;
}

// ── 写 ──────────────────────────────────────────────────────
/** 原子写：先 .tmp 再 rename。失败只 warn，返回 false。 */
function writeBrief(b) {
  if (!ensureDir()) return false;
  const file = briefFile(b.id);
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(serialize(b), null, 2), 'utf8');
    fs.renameSync(tmp, file);       // Windows 上 Node 的 rename 会覆盖已存在的目标
    return true;
  } catch (e) {
    warn(`写工单 ${b.id} 失败：${e.message}`);
    try { fs.unlinkSync(tmp); } catch { /* 没有就算了 */ }
    return false;
  }
}

/** 生成一个不撞车的 id（b<base36 时间戳>-<序号>）。 */
function newId() {
  const ts = Date.now().toString(36);
  for (let i = 1; i <= 9999; i++) {
    const id = `b${ts}-${i}`;
    if (!fs.existsSync(briefFile(id))) return id;
  }
  return `b${ts}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 容量上限：超了就裁最旧的（**正在出片的不裁**）。 */
function trimCapacity() {
  const all = listBriefs();                       // 新 → 旧
  if (all.length <= CAPS.maxBriefs) return 0;
  let n = 0;
  for (const b of all.slice(CAPS.maxBriefs)) {
    if (b.status === 'running') continue;
    try { fs.unlinkSync(briefFile(b.id)); n++; } catch { /* 删不掉就算了 */ }
  }
  if (n) warn(`工单超过 ${CAPS.maxBriefs} 张上限，已裁掉最旧的 ${n} 张`);
  return n;
}

/**
 * 建工单（控制台入口）。**只做校验 + 落盘**，不生成任何内容。
 *
 * ★ lang（语言版本，可选，默认 'en'）：值必须是库侧 core/lang/lang.mjs 的 LANGS 的键（en / zh）。
 *   这里**不**校验「该风格有没有这个语言的内容文件」—— 内容还没生成，本来就可能还没有那个文件；
 *   出片那一刻会给一条「找不到 <base>.<lang>.json」的警告（见 server.mjs:apiBriefRun）。
 *
 * ★ ratio / size（输出尺寸，可选）：ratio 是预设比例，**不填 = '9:16'**（用户要求：任务没指定尺寸时按 9:16 导出）。
 *   size 是自定义像素（如 '1080x1920'），填了就以它为准（优先级 size > ratio）。两者都非法 → 400 并列出可用比例。
 *   合法值直接存进工单；出片时由 server.mjs 显式拼成 `--ratio <code>` / `--size <WxH>`。
 * @returns {{ok:true, brief:object} | {ok:false, code:number, error:string}}
 */
export function createBrief({ topic, slug, lang, ratio, size } = {}) {
  if (typeof slug !== 'string' || !slug.trim()) {
    return { ok: false, code: 400, error: '缺少 slug' };
  }
  const s = slug.trim();
  if (!isBriefStyle(s)) return { ok: false, code: 400, error: unsupportedStyleMessage(s) };

  if (typeof topic !== 'string') return { ok: false, code: 400, error: '缺少 topic（主题必须是字符串）' };
  const t = topic.replace(/\s+/g, ' ').trim();
  if (!t) return { ok: false, code: 400, error: '主题不能为空' };
  if (t.length > CAPS.maxTopicLen) {
    return { ok: false, code: 400, error: `主题太长（${t.length} 字，上限 ${CAPS.maxTopicLen} 字）—— 写一句话即可` };
  }

  // 语言版本：不填 = en（与改动前行为一致）。填了就必须是注册表里的键，否则 400。
  let lg = langs.DEFAULT_LANG;
  if (lang !== undefined && lang !== null && lang !== '') {
    if (!langs.isLangCode(lang)) {
      return {
        ok: false, code: 400,
        error: `语言版本 ${JSON.stringify(lang)} 不在语言注册表里（可选：${langs.langCodes().join(' / ')}）`
          + ` —— 清单来自库侧 ${langs.langSource} 的 LANGS`,
      };
    }
    lg = lang;
  }

  // 输出尺寸：ratio 不填 = 默认比例 9:16；填了必须是预设比例。size 填了必须是合法的 'WxH'。
  //   两者都非法 → 400，并把可用比例列出来（清单来自库侧，不在控制台里另抄一份）。
  let rt = sizes.DEFAULT_RATIO;
  if (ratio !== undefined && ratio !== null && ratio !== '') {
    if (!sizes.isRatioId(ratio)) {
      return {
        ok: false, code: 400,
        error: `输出比例 ${JSON.stringify(ratio)} 不是预设比例（可选：${sizes.ratioIds().join(' / ')}）`
          + ` —— 清单来自库侧 ${sizes.sizeSource} 的 RATIOS。自定义像素请用 size 字段（如 "1080x1920"）。`,
      };
    }
    rt = ratio;
  }
  let sz = null;
  if (size !== undefined && size !== null && size !== '') {
    const raw = String(size).trim();
    const wh = sizes.resolveSize({ size: raw });
    if (!wh) {
      return {
        ok: false, code: 400,
        error: `自定义尺寸 ${JSON.stringify(size)} 不合法：要写成 宽x高，两边都是 ${sizes.MIN_SIZE}–${sizes.MAX_SIZE} 的偶数（如 "1080x1920"）。`
          + ` 也可改用预设比例（${sizes.ratioIds().join(' / ')}）。`,
      };
    }
    sz = sizes.formatSize(wh);
  }

  if (!ensureDir()) return { ok: false, code: 503, error: disabledReason };

  const id = newId();
  const b = {
    id, topic: t, slug: s, lang: lg, ratio: rt, size: sz, status: 'pending',
    createdAt: new Date().toISOString(), processedAt: null,
    contentRel: null, linesRel: null, runOpts: [], notes: '',
    jobId: null, startedAt: null, endedAt: null, error: null, film: null,
  };
  if (!writeBrief(b)) return { ok: false, code: 500, error: `工单落盘失败（${ROOT}）` };
  trimCapacity();
  return { ok: true, brief: normalize(id, serialize(b)) };
}

/**
 * 改工单（外部 LLM 回写通道，走状态机校验）。
 * @param {string} id
 * @param {object} patch 允许：status / contentRel / linesRel / runOpts / notes / processedAt / ratio / size
 * @param {{internal?:boolean}} opts internal=true 时跳过状态机（控制台自己写 running→done/failed 用）
 * @returns {{ok:true, brief:object, warning?:string} | {ok:false, code:number, error:string}}
 */
export function patchBrief(id, patch = {}, { internal = false } = {}) {
  const cur = readBrief(id);
  if (!cur) {
    return isValidBriefId(id)
      ? { ok: false, code: 404, error: `工单不存在：${id}` }
      : { ok: false, code: 400, error: `工单 id 非法：${id}` };
  }

  const next = serialize(cur);      // 只保留规范字段

  // ① 状态机
  if (patch.status !== undefined) {
    const want = patch.status;
    if (!STATUSES.includes(want)) {
      return { ok: false, code: 400, error: `status 只能是 ${STATUSES.join(' / ')}（收到 ${JSON.stringify(want)}）` };
    }
    if (want !== cur.status) {
      const allowed = TRANSITIONS[cur.status] || [];
      if (!internal && !allowed.includes(want)) {
        return {
          ok: false, code: 409,
          error: `状态机不允许 ${cur.status} → ${want}`
            + (allowed.length ? `（${cur.status} 只允许 → ${allowed.join(' / ')}）` : `（${cur.status} 是终态/由出片流程自己推进）`),
        };
      }
      next.status = want;
      if (want === 'ready' && !next.processedAt) next.processedAt = new Date().toISOString();
    }
  }

  // ② 内容路径
  for (const k of ['contentRel', 'linesRel']) {
    if (patch[k] === undefined) continue;
    if (patch[k] === null || patch[k] === '') { next[k] = null; continue; }
    if (!isSafeContentRel(patch[k])) {
      return { ok: false, code: 400, error: `${k} 只能是 demo 目录下的一个 .json 文件名（不含路径分隔符、不含 ..）：${JSON.stringify(patch[k])}` };
    }
    next[k] = patch[k];
  }

  // ③ runOpts
  if (patch.runOpts !== undefined) {
    const v = validateOpts(patch.runOpts);
    if (!v.ok) return { ok: false, code: 400, error: v.error };
    next.runOpts = patch.runOpts.slice();
  }

  // ③b 输出尺寸（ratio / size）—— 与建工单同一条校验规则。
  //     外部 LLM 一般不动它，但允许改（用户想给一张 failed 的工单换尺寸重出）。
  //     size 传 null / '' 表示「不用自定义尺寸，回到 ratio」。
  if (patch.ratio !== undefined) {
    if (patch.ratio === null || patch.ratio === '') {
      next.ratio = sizes.DEFAULT_RATIO;
    } else if (!sizes.isRatioId(patch.ratio)) {
      return {
        ok: false, code: 400,
        error: `输出比例 ${JSON.stringify(patch.ratio)} 不是预设比例（可选：${sizes.ratioIds().join(' / ')}）`,
      };
    } else {
      next.ratio = patch.ratio;
    }
  }
  if (patch.size !== undefined) {
    if (patch.size === null || patch.size === '') {
      next.size = null;
    } else {
      const raw = String(patch.size).trim();
      const wh = sizes.resolveSize({ size: raw });
      if (!wh) {
        return {
          ok: false, code: 400,
          error: `自定义尺寸 ${JSON.stringify(patch.size)} 不合法：要写成 宽x高，两边都是 ${sizes.MIN_SIZE}–${sizes.MAX_SIZE} 的偶数（如 "1080x1920"）。`,
        };
      }
      next.size = sizes.formatSize(wh);
    }
  }

  // ④ 其它
  if (patch.notes !== undefined) {
    if (typeof patch.notes !== 'string') return { ok: false, code: 400, error: 'notes 必须是字符串' };
    next.notes = patch.notes.slice(0, 2000);
  }
  if (patch.processedAt !== undefined && patch.processedAt !== null) {
    next.processedAt = isoOrNull(patch.processedAt) || new Date().toISOString();
  }

  // ⑤ 控制台自填字段（jobId / startedAt / endedAt / error / film）—— **只允许内部写**。
  //    这些字段 UI 会照着用（拿 jobId 去挂日志、拿 film 去播成片），让外部随便写等于给 UI 喂假值。
  //    ⚠️ 曾经漏了这一段：/run 传进来的 jobId 被静默丢掉，工单转 done 后 jobId 是 null，
  //       UI 上「看日志」就再也点不动了（测试 ⑥ 抓到的就是这个）。
  if (internal) {
    if (patch.jobId !== undefined) next.jobId = strOrNull(patch.jobId);
    if (patch.startedAt !== undefined) next.startedAt = isoOrNull(patch.startedAt);
    if (patch.endedAt !== undefined) next.endedAt = isoOrNull(patch.endedAt);
    if (patch.error !== undefined) next.error = strOrNull(patch.error);
    if (patch.film !== undefined) next.film = strOrNull(patch.film);
  }

  if (!writeBrief(next)) return { ok: false, code: 500, error: `工单落盘失败（${ROOT}）` };

  let warning;
  if (next.status === 'ready' && next.runOpts.length === 0) {
    // 不拦（有可能 WorkBuddy 是直接覆盖 content.json，本来就不需要 --q），但必须说清楚后果。
    warning = 'runOpts 是空的：出片只会跑 `lemo-make <slug> --skip-sync`，'
      + '也就是**用库里的默认 content.json**。如果你生成的内容在别的文件里，请填 runOpts（如 ["--q","content=content_<id>.json"]）。';
  }
  return { ok: true, brief: readBrief(id), warning };
}

/** 删工单。**running 不允许删**（那个 lemo-make 子进程还在跑）。 */
export function deleteBrief(id) {
  const b = readBrief(id);
  if (!b) {
    return isValidBriefId(id)
      ? { ok: false, code: 404, error: `工单不存在：${id}` }
      : { ok: false, code: 400, error: `工单 id 非法：${id}` };
  }
  if (b.status === 'running') {
    return { ok: false, code: 409, error: `工单 ${id} 正在出片（status=running），不能删 —— 先去任务列表取消那个任务，等它结束后再删。` };
  }
  try {
    fs.unlinkSync(briefFile(id));
  } catch (e) {
    if (e.code !== 'ENOENT') return { ok: false, code: 500, error: `删工单失败：${e.message}` };
  }
  try { fs.unlinkSync(`${briefFile(id)}.tmp`); } catch { /* 没有就算了 */ }
  return { ok: true, id };
}

/**
 * 启动时收敛：上次会话残留的 running 工单 → failed。
 *
 * ★ 为什么必须做：控制台退出时会把 lemo-make 子进程一起收掉（见 server.mjs 的 SIGINT 处理），
 *   但工单文件里的 status 还写着 running。不收敛的话，UI 上会永远挂着一张「出片中」的僵尸工单，
 *   而且它既不能删（running 不许删）也不能重试。
 * @param {(jobId:string|null)=>boolean} isJobAlive 判断那个任务现在是否真的还在跑
 * @returns {string[]} 被收敛的工单 id
 */
export function reconcileRunning(isJobAlive) {
  const done = [];
  for (const b of listBriefs()) {
    if (b.status !== 'running') continue;
    let alive = false;
    try { alive = !!isJobAlive(b.jobId); } catch { alive = false; }
    if (alive) continue;
    const r = patchBrief(b.id, {
      status: 'failed',
      endedAt: new Date().toISOString(),
      error: '控制台重启，出片未完成（那个 lemo-make 子进程已随控制台一起结束）。点「重试」可重新出片。',
    }, { internal: true });
    if (r.ok) done.push(b.id);
  }
  if (done.length) warn(`启动收敛：${done.length} 张 running 工单改成 failed（控制台重启导致中断）—— ${done.join(', ')}`);
  return done;
}

// ── processable：给外部 LLM 读的「素材包」──────────────────────
//
// ★ 这个接口存在的唯一理由：让外部 LLM（WorkBuddy）**不需要猜**就能生成内容。
//   所以它必须包含四样东西：风格不变量（STYLE.md 全文）、内容结构模板（content.json 样例）、
//   台词结构模板（lines.json 样例）、以及这些文件在磁盘上的**真实路径**。
//   ★ 少了任何一样，LLM 就只能编 —— 编出来的字段名对不上，出片时画面就崩了。

const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const readJson = (p) => {
  const t = readText(p);
  if (t === null) return { text: null, json: null };
  try { return { text: t, json: JSON.parse(t) }; } catch { return { text: t, json: null }; }
};

/** 一个风格的完整素材：STYLE.md 全文 + content.json / lines.json 样例 + 真实路径。 */
export function styleDetail(slug) {
  const meta = styleBySlug(slug);
  if (!meta) return null;
  const styleDir = path.join(STYLES_DIR, slug);
  const demoDir = path.join(styleDir, 'demo');
  const stylePath = path.join(styleDir, 'STYLE.md');
  const contentPath = path.join(demoDir, 'content.json');
  const linesPath = path.join(demoDir, 'lines.json');
  const content = readJson(contentPath);
  const lines = readJson(linesPath);

  let assetDirs = [];
  try {
    assetDirs = fs.readdirSync(demoDir, { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch { /* demo 目录读不到就算了 */ }

  const contentSample = content.json && typeof content.json === 'object' && !Array.isArray(content.json) ? content.json : null;
  return {
    slug,
    cn: meta.cn,
    en: meta.en,
    styleDir,
    demoDir,
    stylePath,
    contentPath,
    linesPath,
    hasStyle: readText(stylePath) !== null,
    styleMd: readText(stylePath),                 // 风格不变量（全文，不截断）
    hasContent: content.text !== null,
    contentSample,                                 // 结构模板（已解析；解析失败为 null）
    contentKeys: contentSample ? Object.keys(contentSample) : [],
    hasLines: lines.text !== null,
    linesSample: Array.isArray(lines.json) ? lines.json : null,   // 台词结构模板（silkscreen-poster 没有 → null）
    lineKeys: Array.isArray(lines.json) && lines.json[0] ? Object.keys(lines.json[0]) : [],
    assetDirs,                                     // demo 下的子目录（subjects/ models/ music/ …）—— 告诉 LLM 库里有什么
    subjectField: meta.subjectField,               // 「画面主体」是哪个字段
    subjectNote: meta.subjectNote,                 // 什么能动、什么不能动
    contentAltPath: fs.existsSync(path.join(demoDir, 'content_alt.json')) ? path.join(demoDir, 'content_alt.json') : null,
  };
}

const HOW_TO = {
  readMe: `工单目录 ${ROOT}\\<id>.json（一张一个文件）。工单的 status=pending 表示「等外部 LLM 生成内容」。`
    + '本接口把 pending 工单 + 对应风格的完整素材一起给你，你不需要猜任何字段名。',
  steps: [
    '① 读本响应 briefs[] 里每张 pending 工单的 topic（用户输入的主题原文）。',
    '② 读 styles[] 里对应 slug 的 styleMd（**风格不变量**：构图、配色逻辑、字体、质感、镜头语言 —— 必须遵守）。',
    '③ 以 contentSample 为**结构模板**改写文案 / 标题 / 细节 / 配色 / 图注；以 linesSample 为台词结构模板改写台词。',
    '④ 画面主体（subjectField 指向的那个字段）**不要换成库里没有的东西** —— 见 subjectNote。'
      + 'assetDirs 列出了该 demo 下真实存在的资源目录，先看一眼再决定能引用什么。',
    '⑤ 语言版本看工单的 lang（en / zh）：内容文件里要写同样的 "lang" 字段（它驱动字体、字距、'
      + '圆窗编号前缀、站点刻名与配音音色）。**中文版（lang=zh）的内容文件必须命名成 `<base>.zh.json`**'
      + '（例：content_coffee.zh.json），而 runOpts 里的 content= 填**基名** `<base>.json`（例：content_coffee.json）'
      + '—— 控制台出片时会补 --lang zh，由编排器把基名换成 <base>.zh.json。命名不符会在出片时明确报错。',
    '⑥ 把新内容写成 demoDir 下的**新文件**（如 content_<id>.json），**不要覆盖 content.json**（那是库的原始样片）。',
    '⑦ 回写工单：status=ready、contentRel=<新 content 文件名>、linesRel=<新 lines 文件名或 null>、'
      + 'runOpts（出片时透传给编排器的参数，如 ["--q","content=content_<id>.json"]）、processedAt=<ISO 时间>。',
    '⑧ 回写方式二选一：直接改那个 JSON 文件，或 PATCH /api/briefs/<id>（走状态机校验，推荐）。',
    '⑨ 之后用户在控制台点「出片」，控制台会跑 `node lemo-make.mjs <slug> --skip-sync <runOpts> [--lang <code>] '
      + '[--ratio <比例> | --size <WxH>]`。',
  ],
  writeBack: {
    file: `${ROOT}\\<id>.json`,
    patch: 'PATCH /api/briefs/<id>',
    body: {
      status: 'ready',
      contentRel: 'content_<id>.json',
      linesRel: 'lines_<id>.json',
      runOpts: ['--q', 'content=content_<id>.json'],
      notes: '可选：给用户看的一句话说明',
    },
    allowedTransitions: Object.entries(TRANSITIONS)
      .filter(([, v]) => v.length)
      .map(([k, v]) => `${k} → ${v.join(' / ')}`),
    note: '直接改文件会绕过状态机校验；但出片那一刻控制台会重新校验（只有 ready 能出片），所以绕过也跑不出错片。',
  },
  runCommand: 'node lemo-make.mjs <slug> --skip-sync <runOpts> [--lang <code>] [--ratio <比例> | --size <WxH>]',
  runOptsNote: 'runOpts 由你决定，控制台只负责透传 —— 控制台不发明参数。'
    + 'contentRel / linesRel 是「相对 demoDir 的文件名」（不含路径分隔符），控制台只把它们写进工单、不会去读或改它们。',
  langNote: '工单的 lang（en / zh）决定**语言版本**。控制台出片时：lang=en 不传 --lang（用 content= 指定的那个文件）；'
    + 'lang=zh 追加 `--lang zh`，编排器据此把 content=<base>.json 换成 <base>.zh.json，'
    + '并同时送到渲染 / 事件表 / 字幕源 / 配音行（即「换语言 = 换全套」）。'
    + '所以中文版内容文件请命名为 <base>.zh.json，runOpts 的 content= 填基名 <base>.json。',
  sizeNote: '工单的 ratio（默认 9:16）与 size（可选自定义像素）决定**输出尺寸**。控制台出片时**总是显式**传一个尺寸参数：'
    + '有 size 就传 `--size <WxH>`（优先级最高），否则传 `--ratio <比例>`（连默认的 9:16 也显式传，'
    + '让命令行自解释、以后改默认值也不漂移）。**你不必把 --ratio / --size 写进 runOpts** —— 控制台会自己拼；'
    + '清单与「比例 → 像素」换算来自库侧 core/render/size.mjs。'
    + '★ 注意：影片布局的自适应是**逐风格**做的。影片模块可以在 FILM_META 里声明 `aspects`（它真的能正确构图的'
    + '比例清单）；没声明 = 只支持 16:9，给别的尺寸会被**裁切**。控制台会**读影片源码文本**探测这个声明，'
    + '并在出片前给出警告（不拦出片）——见 GET /api/aspects。详见使用手册 §7。',
};

/**
 * 组装 processable 响应。
 * @param {{slug?:string|null}} opts 指定 slug 时只给这一个风格的素材（默认只给 pending 工单用到的；没有 pending 就给全部 4 个）
 */
export function buildProcessable({ slug = null } = {}) {
  const all = listBriefs();
  const pending = all.filter((b) => b.status === 'pending');
  const wanted = slug ? [slug] : [...new Set(pending.map((b) => b.slug))];
  const slugs = wanted.length ? wanted : styleSlugs();
  const styles = slugs.map(styleDetail).filter(Boolean);
  return {
    generatedAt: new Date().toISOString(),
    briefsRoot: ROOT,
    count: pending.length,
    pending: pending.map((b) => ({
      id: b.id,
      topic: b.topic,
      slug: b.slug,
      lang: b.lang,           // ★ 该工单要哪个语言版本（en / zh）—— 内容文件与它的 "lang" 字段都要对上
      langCn: b.langCn,
      ratio: b.ratio,         // ★ 该工单的输出比例（默认 9:16）—— 出片命令会带 --ratio <它>
      size: b.size,           // ★ 自定义像素（如 1080x1920），有它就以它为准（--size）；没有就是 null
      sizeDisplay: b.sizeDisplay,   // 「落进命令行的那个值」：自定义像素 or 比例
      styleCn: b.styleCn,
      createdAt: b.createdAt,
      demoDir: b.demoDir,
      briefFile: briefFile(b.id),
    })),
    styles,
    howTo: HOW_TO,
    counts: countByStatus(all),
  };
}
