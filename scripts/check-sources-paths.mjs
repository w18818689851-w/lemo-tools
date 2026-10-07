#!/usr/bin/env node
/**
 * scripts/check-sources-paths.mjs —— `_distill.json#sources` 的**路径引用存在性**闸门
 *
 * ★ ① 由来（2026-10-08）：43 份 `lib/style-skills/<slug>/_distill.json` 各有一个 `sources` 数组
 *   （**共 585 条**，其中**路径样条目 583 条**、叙述性 2 条），内容是**纯路径引用、不带行号**
 *   ⇒ `scripts/check-ref-lines.mjs` **一条都不管**（它只认 `path:line` 形态）⇒ 这一维**零闸门覆盖**。
 *   实测已确认一条**真缺陷**：`scifi-toon` 的 `logs/scifi-toon.log` 漏了 `_distill/` 前缀
 *   （另外 41 份都写 `_distill/logs/<slug>.log`），而 `D:/lemo-tools/_distill/logs/scifi-toon.log` **确实存在**
 *   ⇒ 引用指向一个**不存在的路径**。本闸门把「sources 里的路径真的存在吗」变成机械判据。
 *
 * ★★ ② 判据（三条，缺一不可）：
 *   ① **路径不存在、且不是已登记的生成物模式 ⇒ FAIL**，点名「风格 slug + 该条 source 原文 +
 *      解析到哪个绝对路径（逐个列出试过的候选根）」。
 *   ② **「生成物模式」有一张显式的登记表 `GEN_REGISTRY`**（见下），命中就**只列 ℹ、不判 FAIL**，
 *      并写清「为什么容忍」。★ 登记表**有依据**：逐条抄自库仓 `D:/lemo-opuscar/.gitignore` 第 138–142 行
 *      的真实规则（不是编的）；且本闸门在库仓可达时**逐条核那条 gitignore 规则行仍在**
 *      （见 ④ 一致性判据）—— 依据一旦被删，容忍就失效。
 *   ③ **失明守卫**：枚举到 **0 个风格** / **0 条 source** / **0 条路径样条目** / **库仓根不可达**
 *      ⇒ **FAIL 并明说「本闸门已失明」**，且失明时**不再输出判据 ①②**（那只会刷屏、被误读成「路径有问题」）。
 *
 * ★★ ③ 路径解析规则（覆盖真实写法；**先把规则写死，再拿真实语料复核**）：
 *   · 一条 `sources` 条目先取**首个路径 token**：允许盘符前缀（`D:/…`），在首个**空白 / `（` / `(` / `：`**
 *     处截断。⇒ `styles/hd-2d/demo/out/video_tilt.mp4（移轴版 …）` 取到 `styles/hd-2d/demo/out/video_tilt.mp4`；
 *     `lemo-make.mjs (LEMO_VENC 导出)` 取到 `lemo-make.mjs`。
 *   · 含 `#` 的条目（如 `lib/dub-styles.json#art-deco`）⇒ 取 `#` **之前**的文件部分当路径。
 *     ★ 局限：`#` 之后的**片段（JSON 键）不校验**（见 ⑦）。
 *   · 首个 token **不像路径**（既无 `/` `\`，也无 `文件名.扩展名` 形态）⇒ **跳过**，只列 ℹ。
 *     实测命中的是**叙述性条目**：`ffprobe / volumedetect / …`（首个 token `ffprobe`）、
 *     `对照实验（我自己生成、已清理）：…`（首个 token `对照实验`）。
 *   · **解析根（按序试，命中即止，并把命中的根打进输出）**：
 *       ① **仓根** `LEMO_TOOLS_ROOT`（默认 `D:/lemo-tools`）—— 覆盖 `lib/…`、`_distill/…`、`lemo-make.mjs` 等；
 *       ② **库仓根** `LEMO_OPUSCAR`（默认 `D:/lemo-opuscar`）—— 覆盖 `styles/…`、`core/…` 等；
 *       ③ **风格自身目录** `<库仓根>/styles/<slug>/` —— 覆盖风格相对的写法（实测 `paper-lantern` 的
 *          `demo/vo/dur.json` 只有落在这一根下才存在，`<库仓根>/styles/paper-lantern/demo/vo/dur.json` **确实存在**）。
 *     盘符绝对路径（`D:/lemo-films/…`）**直接按绝对路径判**，不进这三根。
 *
 * ★★ ④ 登记表 ↔ `.gitignore` 一致性判据（**依据不能悄悄失效**；与项目「文档声称值 vs 实测值」同一纪律）：
 *   库仓可达时，逐条核 `GEN_REGISTRY` 里引用的 `.gitignore:<行号>` 那一行**确实还是那条规则**
 *   （行内容逐字比）。核不到 ⇒ FAIL 并点名「哪条登记的依据没了」。
 *   ★ 库仓**不可达**时（另一台机器）⇒ 只打 ℹ、**不判 FAIL**（与 `check-env-overrides.mjs` 对库仓不可达的口径一致）。
 *   ★★ 但库仓不可达**同时**触发判据③ 失明（本闸门 585 条里 **368 条**挂在库仓根下，见下）—— 这是**故意**的：
 *     没有库仓，本闸门多数判据无对象，**不许打印假 OK**。
 *
 * ★★ ⑤ 误报率（**先跑一遍再定稿**；真实语料快照 **2026-10-08**）：
 *   · 枚举到 **43 个风格 / 585 条 source**，其中**路径样 583 条**、**跳过 2 条**（叙述性 / 非路径）。
 *     命中解析根分布（**修 `scifi-toon` 前**）：库仓根 **365**、仓根 **210**、盘符绝对路径 **3**、风格目录 **1**
 *     （合计 579 = 583 条路径样 − 4 条解析不到的；★ 修完后仓根变 **211**、合计 580）。
 *   · **解析不到的条目共 4 条**，逐条人读后：**判据① FAIL = 1（真阳 1、误报 0）**、**判据② ℹ = 3**：
 *       - **真阳 1**：`scifi-toon` 的 `logs/scifi-toon.log` —— 漏了 `_distill/` 前缀（另 41 份都写
 *         `_distill/logs/<slug>.log`），而 `D:/lemo-tools/_distill/logs/scifi-toon.log` **确实存在**
 *         ⇒ 引用指向不存在的路径。★ **已在本批修成 `_distill/logs/scifi-toon.log`**。
 *       - 判据② ℹ 3 条（命中生成物登记表，**不是缺陷**）：
 *       - `brick-toy`  `styles/brick-toy/demo/music/score.json`    ← 库仓 `.gitignore` 第 140 行
 *       - `hd-2d`      `styles/hd-2d/demo/voices/dur.json`        ← 库仓 `.gitignore` 第 138 行
 *       - `watercolor` `styles/watercolor/demo/voices/dur.json`   ← 库仓 `.gitignore` 第 138 行
 *     ★ 实测这 3 条**不是缺陷**：它们是**被 `.gitignore` 排除的生成物**（本地没跑 TTS / 配乐就没生成）。
 *       佐证：**0 个风格**本地有 `styles/<slug>/demo/voices/dur.json`（全仓扫过）。
 *   · ⇒ **命中 4 / 真阳 1 / 误报 0**（修完 `scifi-toon` 后：命中 0 / 真阳 0 / 误报 0，登记表 3 处 ℹ 不变）。
 *   · 判据④ 命中 **0**（5 条 `.gitignore` 依据行逐字都在）。
 *
 * ★★ ⑥ 验证（**临时副本 + 覆盖点，绝不动真实仓**）：
 *   · **阴性对照**（真实语料）⇒ **exit 0**。
 *   · **变异 A**（临时副本 `art-deco/_distill.json` 加 `lib/style-dna/__NOPE__art-deco.md`）⇒ **exit 1 且点名**。
 *   · **变异 B**（临时副本把 `scifi-toon` 那条**改回** `logs/scifi-toon.log`）⇒ **exit 1 且点名**。
 *   · **判据④ 变异**（合成库仓把 `.gitignore` 第 138 行规则改掉）⇒ **exit 1 且点名「登记表依据失效」**。
 *   · ★ **反向验证**：短路判据①（`else fails.push(...)` → 空块）⇒ 变异 A/B **重新变绿（exit 0）**。
 *   · **失明四态**（空风格树 / 0 条 source / 0 条路径样条目 / 库仓根不可达）⇒ **exit 1 + 「本闸门已失明」**。
 *   ★ **实测退出码**（2026-10-08，同一套断言也写在 `test/gate-blindness.test.mjs` 的 `check-sources-paths` 用例里）：
 *     阴性对照 **0**；变异A **1**（点名 `art-deco` + `lib/style-dna/__NOPE__art-deco.md`）；
 *     变异B **1**（点名 `scifi-toon` + `logs/scifi-toon.log`）；判据④ 阴性 **0** / 变异 **1**（点名库仓 `.gitignore` 第 138 行）；
 *     短路判据① 后变异A/B **均 0**；失明四态 **均 1** 且都打「本闸门已**失明**」、且不输出判据①②。
 *
 * ★★ ⑦ 已知局限（如实写，不粉饰）：
 *   · `#` 之后的**片段**（`lib/dub-styles.json#art-deco` 的 `art-deco`）**不校验** —— 只核文件在不在。
 *     键被改名 / 删掉本闸门**看不见**（**假阴**）。
 *   · 「首个 token」是**启发式**：叙述性条目里**后面**提到的路径**不检查**（如
 *     `ffprobe / … 对 D:/lemo-films/paper-lantern/paper-lantern.mp4 与 demo/mix.wav …` 里的三条路径
 *     —— 该条整条被跳过）。宁可漏，不误报。
 *   · 只判**存在性**，不判「引用对不对」：路径存在但指向错的文件（如引用了别风格的产物）本闸门**看不见**。
 *   · 生成物登记表是**启发式**（按路径 glob）：若某**真源码**恰好落进登记模式 ⇒ 会被当生成物**漏判**（假阴）。
 *     ⇒ 输出里**列出**命中登记表的每一条，供人工核对。
 *   · **只读**：不跑 ffmpeg、不跑渲染、不改任何 `_distill.json` / 风格源码。
 *
 * ★ 覆盖点（供非破坏变异验证；与既有闸门同名同义）：
 *   · `LEMO_TOOLS_ROOT` —— 本仓仓根（默认按脚本自身位置推导；与 `check-doc-coverage` / `check-distill-fields`
 *     / `check-redline-md5` / `check-line-endings` 同名同义）。
 *   · `LEMO_DISTILL_ROOT` —— 风格技能树（默认 `<仓根>/lib/style-skills`；与 `check-distill-fields`
 *     / `check-skill-artifacts` / `check-selfcheck-claims` / `check-tp-prose` 同名同义）。
 *   · `LEMO_OPUSCAR` —— 库仓根（默认 `<仓根>/../lemo-opuscar`；与 `check-env-overrides` / `check-audio-chain`
 *     / `check-dual-copy-sync` / `check-ref-lines` 同名同义）。
 *
 * 用法：node scripts/check-sources-paths.mjs
 * 退出码：有 FAIL（路径解析不到 / 登记依据失效）**或本闸门失明** ⇒ 1；否则 0（判据② 的 ℹ 不影响退出码）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ★ 仓根：覆盖点 `LEMO_TOOLS_ROOT`（同名同义）。 */
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
/** ★ 风格技能树：覆盖点 `LEMO_DISTILL_ROOT`（同名同义）。 */
const SKILLS = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(ROOT, 'lib', 'style-skills'));
/** ★ 库仓根：覆盖点 `LEMO_OPUSCAR`（同名同义）。 */
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || path.join(ROOT, '..', 'lemo-opuscar'));

/** 模板目录不算风格。 */
const TEMPLATE = '_TEMPLATE';

/**
 * ★★ 生成物模式登记表（判据②）—— 命中 ⇒ 只列 ℹ、**不判 FAIL**。
 * 依据 = 库仓 `.gitignore` 的真实规则行（逐条抄，不编）；`cite` 写死行号供判据④ 复核。
 * 每条匹配的是**条目里写的相对路径**（已把 `\` 归一成 `/`）。
 */
const GEN_REGISTRY = [
  {
    re: /^styles\/[^/]+\/demo\/voices\/[^/]+\.json$/,
    cite: '138',
    rule: 'styles/*/demo/voices/*.json',
    why: 'TTS 实测时长 / 词表（`core/tts/tts.py` / `tts_zh.py` / `tts_indextts.py` 生成）—— 本地没跑 TTS 就没有',
  },
  {
    re: /^styles\/[^/]+\/demo\/voices_raw\/[^/]+\.json$/,
    cite: '139',
    rule: 'styles/*/demo/voices_raw/*.json',
    why: 'whisper 逐词时间戳（`core/tts/asr_check.py` 生成）',
  },
  {
    re: /^styles\/[^/]+\/demo\/music\/score\.json$/,
    cite: '140',
    rule: 'styles/*/demo/music/score.json',
    why: '配乐谱面（`styles/<slug>/demo/music/score.py` 生成）—— ★ 只 ignore `music/` 下那一个，`demo/score.json` 是手写源码',
  },
  {
    re: /^styles\/[^/]+\/[^/]+\.srt$/,
    cite: '141',
    rule: 'styles/*/*.srt',
    why: '字幕（`core/render/srt.py` 生成；已发布的 `.srt` 刻意入库，新风格的不会被 `git add` 带上）',
  },
  {
    re: /^styles\/[^/]+\/demo\/music\/timing_report[^/]*\.txt$/,
    cite: '142',
    rule: 'styles/*/demo/music/timing_report*.txt',
    why: '卡点校验报告（`styles/<slug>/demo/music/score.py` 生成）',
  },
];

// ── 条目解析（判据③ 的解析规则；见头注释 ③）──────────────────────────────────
/**
 * 从一条 `sources` 条目里抽出「待核的路径」。
 * @returns {{kind:'path', path:string, frag:string|null, raw:string}
 *         | {kind:'skip', why:string, raw:string}}
 */
function parseEntry(raw) {
  if (typeof raw !== 'string') return { kind: 'skip', why: '不是字符串', raw: String(raw) };
  const s = raw.trim();
  if (!s) return { kind: 'skip', why: '空串', raw: s };
  // 首个 token：允许盘符前缀（`D:/…`，`:` 只在盘符后合法），在首个空白 / 全角（ / 半角 ( / 全角：处截断。
  const m = s.match(/^(?:[A-Za-z]:)?[^\s（(：]+/);
  if (!m) return { kind: 'skip', why: '取不到首个 token', raw: s };
  let head = m[0];
  let frag = null;
  const hash = head.indexOf('#');
  if (hash >= 0) { frag = head.slice(hash + 1); head = head.slice(0, hash); }
  if (!head) return { kind: 'skip', why: '只有 # 片段、没有文件部分', raw: s };
  // 路径样性：含 `/` 或 `\`，或形如 `文件名.扩展名`。
  const pathLike = /[\\/]/.test(head) || /\.[A-Za-z0-9]{1,6}$/.test(head);
  if (!pathLike) return { kind: 'skip', why: '首个 token 不像路径（叙述性条目）', raw: s };
  return { kind: 'path', path: head, frag, raw: s };
}

/** 盘符绝对路径（`D:/…` / `C:\…`）—— 直接按绝对路径判，不进三根。 */
const isDriveAbs = (p) => /^[A-Za-z]:[\\/]/.test(p);

/**
 * 按序把相对路径解析到三根之一；命中返回命中的根名与绝对路径，全不命中返回 null。
 * @returns {{root:string, abs:string}|null}
 */
function resolvePath(rel, slug) {
  if (isDriveAbs(rel)) {
    const abs = path.resolve(rel);
    return fs.existsSync(abs) ? { root: '盘符绝对路径', abs } : null;
  }
  const cands = [
    { root: '仓根(LEMO_TOOLS_ROOT)', dir: ROOT },
    { root: '库仓根(LEMO_OPUSCAR)', dir: OPUSCAR },
    { root: '风格目录', dir: path.join(OPUSCAR, 'styles', slug) },
  ];
  for (const c of cands) {
    const abs = path.resolve(c.dir, rel);
    if (fs.existsSync(abs)) return { root: c.root, abs };
  }
  return null;
}

/** 列出「试过、但都不存在」的候选绝对路径（供 FAIL 点名）。 */
function triedPaths(rel, slug) {
  if (isDriveAbs(rel)) return [path.resolve(rel)];
  return [
    path.resolve(ROOT, rel),
    path.resolve(OPUSCAR, rel),
    path.resolve(path.join(OPUSCAR, 'styles', slug), rel),
  ];
}

// ── 失明守卫（判据③，防空转绿灯）─────────────────────────────────────────────
const blind = [];
const notes = [];
let slugs = [];

if (!fs.existsSync(SKILLS)) {
  blind.push(`风格技能树不存在：${SKILLS}（\`LEMO_DISTILL_ROOT\` 指空 / 目录被移走？）`);
} else {
  let entries;
  try {
    entries = fs.readdirSync(SKILLS, { withFileTypes: true });
  } catch (e) {
    console.error(`读不到输入：无法列出风格技能树 ${SKILLS}：${e.message}`);
    process.exit(2);
  }
  slugs = entries
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => n !== TEMPLATE && !n.startsWith('.') && !n.startsWith('_'))
    .filter((n) => fs.existsSync(path.join(SKILLS, n, '_distill.json')))
    .sort();
  if (slugs.length === 0) blind.push(`枚举到 0 个风格（${SKILLS} 下没有带 _distill.json 的目录）：路径 / 过滤变了？`);
}

// ★ 库仓不可达 ⇒ 失明（585 条里 368 条挂在库仓根下，没有它本闸门多数判据无对象）。
if (!blind.length && !fs.existsSync(OPUSCAR)) {
  blind.push(`库仓根不可达：${OPUSCAR}（\`LEMO_OPUSCAR\` 指空 / 目录不存在？）⇒ 挂在库仓根下的 styles/… 与 core/… 全都没法判`);
}

// ── 逐风格枚举 sources（失明时不做）───────────────────────────────────────────
const fails = [];       // 判据①
const genHits = [];     // 判据②（ℹ）
const skips = [];       // 非路径 / 叙述性（ℹ）
const rootTally = new Map(); // 命中的解析根 → 计数
let total = 0;
let pathLikeN = 0;

if (!blind.length) {
  for (const slug of slugs) {
    const file = path.join(SKILLS, slug, '_distill.json');
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      fails.push({ slug, raw: file, why: `_distill.json 读不动 / JSON 坏：${e.message}`, tried: [] });
      continue;
    }
    const srcs = Array.isArray(json.sources) ? json.sources : [];
    if (!Array.isArray(json.sources)) notes.push(`styles/${slug}：没有 sources 数组（跳过该风格）`);
    for (const raw of srcs) {
      total++;
      const p = parseEntry(raw);
      if (p.kind === 'skip') { skips.push({ slug, raw: p.raw, why: p.why }); continue; }
      pathLikeN++;
      const hit = resolvePath(p.path, slug);
      if (hit) {
        rootTally.set(hit.root, (rootTally.get(hit.root) || 0) + 1);
        continue;
      }
      // 解析不到 ⇒ 判据②（生成物登记表）优先，命中只列 ℹ；否则判据① FAIL。
      const norm = p.path.split('\\').join('/');
      const reg = GEN_REGISTRY.find((g) => g.re.test(norm));
      if (reg) genHits.push({ slug, raw: p.raw, path: norm, reg });
      else fails.push({ slug, raw: p.raw, path: p.path, tried: triedPaths(p.path, slug), why: null });
    }
  }
}

if (!blind.length && total === 0) {
  blind.push(`枚举到 0 条 source（${slugs.length} 个风格里没有一条 sources 条目）：数据 / 路径 / 过滤变了？`);
} else if (!blind.length && pathLikeN === 0) {
  blind.push(`枚举到 0 条**路径样** source（${slugs.length} 个风格、${total} 条 source 全被当叙述性跳过）：解析规则变了？`);
}

// ── 判据④：登记表 ↔ .gitignore 一致性（库仓可达才核）────────────────────────
const regStale = [];
if (!blind.length && fs.existsSync(OPUSCAR)) {
  const giFile = path.join(OPUSCAR, '.gitignore');
  if (!fs.existsSync(giFile)) {
    regStale.push(`库仓可达但读不到 \`.gitignore\`：${giFile} ⇒ 登记表 5 条的依据无法复核`);
  } else {
    const lines = fs.readFileSync(giFile, 'utf8').split(/\r?\n/);
    for (const g of GEN_REGISTRY) {
      const ln = Number(g.cite);
      const actual = lines[ln - 1];
      if (actual !== g.rule) {
        regStale.push(`登记表依据失效：\`.gitignore:${g.cite}\` 现为 ${JSON.stringify(actual)}，登记表声称应为 ${JSON.stringify(g.rule)}`);
      }
    }
  }
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
const isBlind = blind.length > 0;
const ok = !isBlind && fails.length === 0 && regStale.length === 0;

console.log('_distill.json#sources 路径闸门 —— sources 里引用的路径是否真的存在');
console.log(`  语料: ${SKILLS}（${slugs.length} 个风格）`);
console.log(`  解析根: ① 仓根 ${ROOT}  ② 库仓根 ${OPUSCAR}  ③ 风格目录 ${path.join(OPUSCAR, 'styles', '<slug>')}`);
console.log(`  生成物登记表: ${GEN_REGISTRY.length} 条模式（依据 ${path.join(OPUSCAR, '.gitignore')}:${GEN_REGISTRY.map((g) => g.cite).join(',')}）`);
if (!isBlind) {
  console.log(`  source 共 ${total} 条：路径样 ${pathLikeN} 条、跳过 ${skips.length} 条`);
  const tally = [...rootTally.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('、');
  console.log(`  命中解析根: ${tally || '（无）'}\n`);
}

if (!isBlind && fails.length) {
  console.log(`✘ 发现 ${fails.length} 处「路径解析不到、也不属于已登记生成物」：\n`);
  for (const f of fails) {
    console.log(`  ${String(f.slug).padEnd(18)} ${f.raw}`);
    if (f.why) console.log(`      ${f.why}`);
    else {
      console.log(`      试过（均不存在）：`);
      for (const t of f.tried) console.log(`        ${t}`);
    }
    console.log(`      建议：核对 _distill.json#sources 的写法（多数相对仓根 ${ROOT}，styles/ 与 core/ 相对库仓根 ${OPUSCAR}）。`);
  }
  console.log('');
}

if (!isBlind && genHits.length) {
  console.log(`ℹ 命中生成物登记表（不判 FAIL）${genHits.length} 处 —— 引用的是 .gitignore 排除的生成物，本地没生成就必然不存在：\n`);
  for (const g of genHits) {
    console.log(`  ${String(g.slug).padEnd(18)} ${g.path}`);
    console.log(`      ← .gitignore:${g.reg.cite}  \`${g.reg.rule}\`  —— ${g.reg.why}`);
  }
  console.log('');
}

if (!isBlind && skips.length) {
  console.log(`ℹ 跳过 ${skips.length} 条「非路径 / 叙述性」条目（首个 token 不像路径，不核）：\n`);
  for (const s of skips) console.log(`  ${String(s.slug).padEnd(18)} [${s.why}] ${s.raw}`);
  console.log('');
}

if (!isBlind && notes.length) {
  console.log('备注（不影响结论）：');
  for (const n of notes) console.log(`   · ${n}`);
  console.log('');
}

if (!isBlind && regStale.length) {
  console.log(`✘ 生成物登记表的依据失效 ${regStale.length} 处：`);
  for (const r of regStale) console.log(`  ✘ ${r}`);
  console.log('  修法：把 `GEN_REGISTRY` 的 `rule`/`cite` 对齐库仓 `.gitignore`（或删掉已失效的那条登记）。\n');
}

if (isBlind) {
  console.log('\n✘✘ 本闸门已失明，结论不可信（判据①② 未执行）：');
  for (const b of blind) console.log(`   ✘ ${b}`);
} else if (ok) {
  console.log(`✓ ${pathLikeN} 条路径样 source 全部解析到存在的路径（或属已登记生成物 ${genHits.length} 条）；登记表 ${GEN_REGISTRY.length} 条依据均在。`);
}

console.log(`\n[闸门] sources 路径：风格 ${slugs.length} 个、source ${total} 条、路径样 ${pathLikeN} 条、`
  + `解析不到 ${fails.length} 处、生成物 ℹ ${genHits.length} 处、跳过 ${skips.length} 条、`
  + `登记依据失效 ${regStale.length} 处${isBlind ? '、**已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exit(ok ? 0 : 1);
