#!/usr/bin/env node
/**
 * scripts/check-demo-header.mjs —— 库仓 `styles/<slug>/DEMO.md` 的**头部行规格**（成片规格）
 *   是否与**已发布运行时**（`styles/<slug>/style.json#dur`）一致。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 项目口径：**本地样片副本 ≠ 已发布影片**（2026-10-08 订正本闸门的真值来源）
 * ══════════════════════════════════════════════════════════════════════════════
 *   `MAINTAINING.md:339-347` 明写：
 *     「**A local sample copy can be re-rendered to the wrong length — `dur` follows the
 *       *published* film, not the copy.**」
 *   并给出实例：`D:/lemo-films/pictogram-motion/pictogram-motion.mp4` 是**被错误重渲的本地副本**
 *   （**161.6 s / 24 fps / 3878 frames**），而**已发布影片**（`films` release asset）是
 *   **163.6 s / 60 fps / 9816 frames** —— 「which is what `demo/mux.sh`、`DEMO.md`（"163.6 s, 9816 frames"）
 *   and `style.json`'s `"dur": 163.6` all say」，且明令「**do not "fix" `style.json` to match it**」。
 *
 *   ⇒ **本闸门的真值来源必须是「已发布运行时」`style.json#dur`，而不是 `_distill.json#generatedVideo.durSec`。**
 *     · `style.json#dur` 是**画廊展示值**（`styleboard/catalog.json` 由它构建；`MAINTAINING.md:343-344`
 *       「`style.json.dur` is the runtime the gallery shows」）。★ 已核实 **43/43** 与
 *       `styleboard/catalog.json#dur` **逐字一致**（0 处不符）—— 它是比 `generatedVideo` 更权威的
 *       「已发布」来源。
 *     · `generatedVideo.durSec` 是**对本地文件的一次测量**（它的 `path` 就写着
 *       `D:/lemo-films/pictogram-motion/pictogram-motion.mp4`）—— 本地副本一旦被错误重渲，
 *       它就**不再是已发布规格**。★ 实测：全量 43 份里 `|generatedVideo.durSec − style.json#dur|`
 *       **只有 `pictogram-motion` 超过 0.1 s（2.02 s）**，其余 42 份最大 0.03 s。
 *
 *   ★★ 上一批（2026-10-08）本闸门**用错了真值**，并据此做了一处**错误"修复"**：
 *     它拿 `generatedVideo.durSec`（本地副本读数 161.58）当真值，报「`pictogram-motion` 头部
 *     `163.6 s` 不符」，于是把**库仓头部改成了 `161.6 s`**（库仓提交 `378cb5b`）——
 *     ★ 这**恰好做了 `MAINTAINING.md` 明令禁止的事**（把"已发布规格"改成"本地副本的读数"）。
 *     `generatedVideo` 本身**没错**（它如实测的是本地文件）；错的是**把它当真值**。
 *     ⇒ 本批把真值改回 `style.json#dur`，并加「已登记例外」机制把 `pictogram-motion` 登记下来
 *       （见下「已登记例外」），**库仓头部的撤回由另一条线做（本闸门一个字节都不写库仓）**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 判据（三维：时长判、分辨率判、帧率**只报不判**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   1) **只在头部行取值**：`demoMd.split(/\r?\n/).find((l) => l.startsWith('Demo:'))`（43/43 都有）。
 *   2) **时长**：行内第一个 `<数> s`（`\b` 收尾）。真值 = `style.json#dur`（已发布运行时）。**容差 ±0.5 s**。
 *   3) **分辨率**：本行 `<W>×<H>`（★ 全角 ×；也接受 ASCII `x`）。真值 = `generatedVideo.width/height`。**精确**。
 *      · 为什么这一维可以用 `generatedVideo`：`MAINTAINING.md:321`「The sample films are always
 *        16:9 / 1920×1080」—— 已发布与本地副本**都应是 1920×1080**（实测 43/43 都是），
 *        分辨率**不随重渲改变** ⇒ 这一维**没有**"本地 vs 已发布"的分叉（时长才有）。
 *   4) **帧率**：★ **只报不判**（理由见下「为什么帧率不判」）。
 *
 *   ★ **时长容差 0.5 s 的依据**（实测得出，不是拍脑袋）：`shadow-puppet` 头部写 `54`（整数秒）、
 *     `style.json#dur` = 54.4 ⇒ 差 0.4 —— 头部写**整数秒**是**合法写法**（四舍五入，不是错误声称），
 *     必须放行；容差 0.5 恰好放行它，又远小于真陈旧的量级（`pictogram-motion` 头部若被写成
 *     本地副本的 `161.6` ⇒ 与已发布 163.6 差 2.0，是容差的 4 倍）⇒ 不是「什么都不判」。
 *   ★ **`hdr` 里没有的项**（如 `shadow-puppet` 没写 fps/分辨率）⇒ **跳过那一项**，不判 FAIL
 *     —— **头部行规格是可选的**（只有时长是 43/43 都写的）。
 *   ★ **真值里没有的项** ⇒ 同样跳过（无法比对），单列 ℹ 统计。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 为什么帧率**不判**（★ 这一维天然有歧义；判它必须先能区分「原生」与「成片」—— 本闸门做不到）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · `style.json` **没有** fps 字段 ⇒ **没有「已发布」fps 来源**（这正是"时长有、帧率没有"的那一维）。
 *   · 唯一能拿到的 fps 是 `generatedVideo.fps` = **本地副本的读数** —— 恰恰是 `MAINTAINING.md:339-347`
 *     说**会错**的那个来源（`pictogram-motion` 本地 24 fps vs 已发布 60 fps）。
 *   · 头部行里的 fps 是**成片读数**（`24 fps（★ … 随库成片实测 24 fps）`），而 DEMO.md 的**构建步骤**
 *     写的是**原生 fps**（`hd-2d`「4590 frames at 60 fps」、`watercolor`「6816 frames at 60 fps」，
 *     4590/60 = 76.5 s = 成片时长）⇒ 同一份 DEMO.md 里出现「60 fps」**不一定是陈旧值**，
 *     机械抽取**无法区分**它是"原生帧率"还是"成片帧率"。
 *   · ⇒ 判据不成立时**宁可只报不改**（本项目纪律）：帧率**只作为 ℹ 列出**（头部值 ↔ 本地副本值），
 *     **不判 FAIL**。若将来有了「已发布 fps」的权威来源（如给 `style.json` 加 `fps`），再把它纳入判据。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 已登记例外（两层语义，照 `check-mux-parity.mjs` 的 `KNOWN_DIVERGENCES` 写法）
 * ══════════════════════════════════════════════════════════════════════════════
 *   本闸门另有一条**独立判据**：**本地样片副本 ↔ 已发布运行时**
 *   （`generatedVideo.durSec` ↔ `style.json#dur`，容差 ±0.5 s）。
 *   两者一旦分叉，就说明**本地副本是被错误重渲的**（`MAINTAINING.md:339-347` 描述的那种）。
 *   · **已登记 ⇒ 只列 ℹ、不判 FAIL**；**没登记 ⇒ FAIL**
 *     （新出现的"被错误重渲的本地副本"必须被抓到 —— 否则它会继续骗后来人）。
 *   · 登记表 = `KNOWN_EXCEPTIONS`，每条写清「为什么允许存在 / 依据」。
 *     ★ 清单是**承重的、不是摆设**：清空它，`pictogram-motion` 立刻从 ℹ 变 FAIL（变异验证已证）。
 *   · ★★ **必须显式打出「已登记例外 N 条」** —— 绝不让例外**静默通过**（那是本项目的"假绿"大忌）。
 *   · ★ **反向判据**：登记过的例外若**已不再需要**（本地副本被正确重渲 ⇒ `generatedVideo.durSec`
 *     回到 `style.json#dur`）⇒ 只列 ℹ 提示可删（**不判 FAIL** —— 陈旧的登记是文档卫生问题，
 *     不是正确性缺陷；判 FAIL 会让"某天本地副本修好了"意外翻红，那会把守门的闸门变成噪音源）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 抽取正则的两处「必须这么写」（★ 都与审计给的写法不同，且都**跑命令核实过**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① **时长正则不能锚 `\(`**。审计给的写法是 `/\(([0-9]+(?:\.[0-9]+)?)\s*s\b/`（要求 `(` **紧贴**数字）——
 *      它在 **41/43** 份头部行上工作，却在**恰恰要抓的那一份**上**静默失明**：
 *      `pictogram-motion` 的头部是 `*…* (EN-JP version, 163.6 s, …`（`(` 与数字之间隔着 `EN-JP version, `）
 *      ⇒ `match` 返回 `undefined` ⇒ `Number(undefined) = NaN` ⇒ `Math.abs(NaN - …) > 0.5` 为 **false**
 *      ⇒ **该风格被静默跳过**（实测：用锚 `\(` 的写法跑全量 ⇒ **命中 0**，真阳被漏）。
 *      ⇒ 改为 `/…\s*s\b/`（不锚 `(`，只认「数字 + 空格 + 小写 `s` + 词边界」）。
 *      ★ 已核实**不引入误报**：43 份里 43/43 抽出的都是**头部行那一个时长**，
 *        且 `\b` 把 `43 Sports` / `70 sport` 这类**词内 `s`** 排除在外。
 *   ② **帧率必须取「第一个」**：`hdr.match(/…\s*fps/)`（**非全局**）天然只返回第一处 —— 头部行里常带历史标注
 *      （`24 fps（★ … 原记 60 fps…）`），**现值在前**、历史值在后；取第一个才拿到现值。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 失明守卫（防空转绿灯）
 * ══════════════════════════════════════════════════════════════════════════════
 *   下列任一成立 ⇒ **FAIL 并明说「本闸门已失明」**，且**失明时不再输出判据**（同 `check-ref-lines` 口径）：
 *     · 枚举到 **0 个风格**（`<库仓>/styles` 不可达 / 没有任何带 `DEMO.md` 的风格目录）；
 *     · **0 份**头部行（`^Demo:` 一处都找不到 —— 抽取形态变了 / 读错目录）；
 *     · **0 份**可读的 `style.json#dur`（**已发布运行时**真值缺失 ⇒ 时长判据无可比对）；
 *     · **0 份**可读的 `_distill.json#generatedVideo`（分辨率判据 + 本地副本判据无可比对）。
 *   ★ 单个风格读不到真值 / 没写头部行 ⇒ 只进 ℹ 统计（其余风格仍判）。
 *
 * ★ 覆盖点（便于非破坏性变异验证，登记于 `test/README.md` 与 `_distill/AGENT-BRIEF.md`）：
 *   · `LEMO_OPUSCAR`      —— **库仓根**（默认 `<脚本>/../../lemo-opuscar`，即 `D:/lemo-opuscar`）。
 *     头部行**源** = `<LEMO_OPUSCAR>/styles/<slug>/DEMO.md`；**已发布运行时真值源** =
 *     `<LEMO_OPUSCAR>/styles/<slug>/style.json#dur`。★ **不硬编码 `D:/lemo-opuscar`**
 *     （否则夹具没法重定向）。
 *   · `LEMO_DISTILL_ROOT` —— **风格技能树根**（默认 `<脚本>/../lib/style-skills`），**本地副本读数源** =
 *     `<LEMO_DISTILL_ROOT>/<slug>/_distill.json#generatedVideo`。与 `check-tp-prose` /
 *     `check-skill-film-fields` **同名同义**。
 *
 * 用法：node scripts/check-demo-header.mjs
 * 退出码：0 = 全部头部行规格与**已发布运行时**一致（或头部行**没写**该规格项）、且本地副本分叉均已如实登记；
 *         1 = 有 FAIL，或**本闸门已失明**。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// ★ 覆盖点：库仓根（同名同义于 check-ref-lines / check-env-overrides / check-render-venc）。
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || path.join(HERE, '..', '..', 'lemo-opuscar'));
const STYLES = path.join(OPUSCAR, 'styles');
// ★ 覆盖点：风格技能树（本地副本读数源），同名同义于 check-tp-prose / check-skill-film-fields。
const DISTILL = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(HERE, '..', 'lib', 'style-skills'));

/** 头部行 ↔ **已发布运行时**（`style.json#dur`）的时长容差（秒）—— 见头注释「时长容差 0.5 s 的依据」。 */
const DUR_TOL = 0.5;
/** **本地副本** ↔ **已发布运行时** 的时长容差（秒）—— 判"本地副本是否被错误重渲"。 */
const LOCAL_TOL = 0.5;

/**
 * ★★ 已登记例外 —— 两层语义的「清单」（照 `check-mux-parity.mjs` 的 `KNOWN_DIVERGENCES` 写法）。
 *   形态 `slug → { <字段 id>: '<为什么允许存在 / 依据>' }`。
 *   命中的分叉**只列 ℹ、不判 FAIL**；清单外的分叉 ⇒ FAIL。★ 清单是**承重的**（清空它 `pictogram-motion` 立刻变红）。
 *   ★ 本闸门当前唯一登记的字段 id 是 `dur` = **本地副本 ↔ 已发布运行时** 的时长分叉
 *     （不是头部 ↔ 已发布；头部与已发布必须一致，那一维**不**豁免）。
 */
const KNOWN_EXCEPTIONS = {
  'pictogram-motion': {
    dur: '本地样片副本 `D:/lemo-films/pictogram-motion/pictogram-motion.mp4` 是**被错误重渲的副本**'
      + '（**161.6 s / 24 fps / 3878 frames**），而**已发布影片**（`films` release asset）是'
      + ' **163.6 s / 60 fps / 9816 frames**。依据 `MAINTAINING.md:339-347`'
      + '（"A local sample copy can be re-rendered to the wrong length — `dur` follows the *published* film,'
      + ' not the copy"，并明令「do not "fix" `style.json` to match it」）。'
      + '⇒ `_distill.json#generatedVideo.durSec`（161.58，**对本地副本的测量**）与 `style.json#dur`'
      + '（163.6，**已发布运行时**）相差 **2.02 s**。**这是本地副本的问题，不是头部/已发布规格的问题**：'
      + '头部与已发布运行时一致（163.6 = 163.6）即算过；本地副本被正确重渲后本登记即可删。',
  },
};

/** 头部行（以 `Demo:` 开头的那一行；43/43 都有）。找不到返回 undefined。 */
const headerOf = (md) => md.split(/\r?\n/).find((l) => l.startsWith('Demo:'));

/**
 * 从头部行抽「时长 / 帧率 / 分辨率」。缺项返回 `null`（**规格项可选** ⇒ 不判 FAIL）。
 * ★ 三处形态都跑命令核实过，见头注释「抽取正则的两处必须这么写」。
 */
function extract(hdr) {
  const dm = hdr.match(/([0-9]+(?:\.[0-9]+)?)\s*s\b/);              // ① 不锚 `\(`（见头注释）
  const fm = hdr.match(/([0-9]+(?:\.[0-9]+)?)\s*fps/);             // ② 第一个 `N fps`（现值）
  const rm = hdr.match(/([0-9]{3,4})\s*[×x]\s*([0-9]{3,4})/);      // ③ 全角 × / ASCII x
  return {
    dur: dm ? Number(dm[1]) : null,
    fps: fm ? Number(fm[1]) : null,
    res: rm ? [Number(rm[1]), Number(rm[2])] : null,
  };
}

// ── 枚举风格（带 DEMO.md 的风格目录；排除 `_template`）────────────────────────
let styleDirs = [];
try {
  styleDirs = fs.readdirSync(STYLES, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '_template'
      && fs.existsSync(path.join(STYLES, e.name, 'DEMO.md')))
    .map((e) => e.name).sort();
} catch { styleDirs = []; }

const fails = [];          // 判 FAIL（未登记的分叉）
const backlog = [];        // ★ 已登记例外（本次生效，只列 ℹ）
const resolved = [];       // ★ 登记了但已不再需要（只列 ℹ）
const noTruth = [];        // ℹ：读不到本地副本读数（`generatedVideo`）
const noStyleDur = [];     // ℹ：读不到已发布运行时（`style.json#dur`）
const noHeader = [];       // ℹ：没有头部行的风格
const skipped = [];        // ℹ：头部行没写 / 真值缺项 ⇒ 该字段跳过
const fpsInfo = [];        // ℹ：帧率（**只报不判**）
const localCompared = new Set();   // 本地副本 ↔ 已发布 实际比对过的 slug（供反向判据用）
let headerCount = 0, styleDurCount = 0, gvCount = 0, cmpCount = 0;

for (const slug of styleDirs) {
  let md = '';
  try { md = fs.readFileSync(path.join(STYLES, slug, 'DEMO.md'), 'utf8'); } catch { continue; }
  const hdr = headerOf(md);
  if (!hdr) { noHeader.push(slug); continue; }
  headerCount++;

  const h = extract(hdr);

  // ── 真值①：**已发布运行时** `style.json#dur`（时长判据的权威来源）──
  let styleDur = null;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(STYLES, slug, 'style.json'), 'utf8'));
    if (Number.isFinite(j.dur)) styleDur = j.dur;
  } catch { /* 读不到 ⇒ 下面只 ℹ */ }
  if (styleDur === null) noStyleDur.push(slug); else styleDurCount++;

  // ── 真值②：**本地副本读数** `_distill.json#generatedVideo`（分辨率判据 + 本地副本判据）──
  let gv = null;
  try { gv = JSON.parse(fs.readFileSync(path.join(DISTILL, slug, '_distill.json'), 'utf8')).generatedVideo || null; } catch { gv = null; }
  if (!gv) noTruth.push(slug); else gvCount++;

  // ── 时长：头部 ↔ **已发布运行时**（`style.json#dur`）──
  if (h.dur === null) skipped.push({ slug, field: '时长', why: '头部行未写' });
  else if (styleDur === null) skipped.push({ slug, field: '时长', why: '已发布运行时 style.json#dur 读不到' });
  else {
    cmpCount++;
    if (Math.abs(h.dur - styleDur) > DUR_TOL) {
      fails.push({ slug, field: '时长', got: `${h.dur} s`, truth: `${styleDur} s`,
        d: (h.dur - styleDur).toFixed(2), hdr });
    }
  }
  // ── 分辨率：头部 ↔ `generatedVideo.width/height`（精确；已发布与本地都是 1920×1080）──
  if (h.res === null) skipped.push({ slug, field: '分辨率', why: '头部行未写' });
  else if (!gv || !Number.isFinite(gv.width) || !Number.isFinite(gv.height)) {
    skipped.push({ slug, field: '分辨率', why: '本地副本读数缺 width/height' });
  } else {
    cmpCount++;
    if (h.res[0] !== gv.width || h.res[1] !== gv.height) {
      fails.push({ slug, field: '分辨率', got: `${h.res[0]}×${h.res[1]}`, truth: `${gv.width}×${gv.height}`, d: '', hdr });
    }
  }
  // ── 帧率：★ **只报不判**（见头注释「为什么帧率不判」）—— 只在**头部行写了 fps** 时列一行 ──
  if (h.fps !== null) {
    fpsInfo.push({ slug, hdrFps: h.fps, gvFps: gv && Number.isFinite(gv.fps) ? gv.fps : null });
  }

  // ── ★ 独立判据：**本地副本 ↔ 已发布运行时**（两层语义的落点）──
  if (gv && Number.isFinite(gv.durSec) && styleDur !== null) {
    localCompared.add(slug);
    const delta = gv.durSec - styleDur;
    if (Math.abs(delta) > LOCAL_TOL) {
      const reg = (KNOWN_EXCEPTIONS[slug] || {}).dur;
      if (reg) {
        backlog.push({ slug, got: `${gv.durSec} s`, truth: `${styleDur} s`, d: delta.toFixed(2), reg });
      } else {
        fails.push({ slug, field: '本地副本', got: `${gv.durSec} s`, truth: `${styleDur} s`, d: delta.toFixed(2), hdr,
          note: '本地副本读数 `generatedVideo.durSec` ≠ 已发布运行时 `style.json#dur` ⇒ 本地副本很可能是被错误重渲的'
            + '（`MAINTAINING.md:339-347`）。★ 若确认属实，请把它登记进本闸门的 `KNOWN_EXCEPTIONS`'
            + '（**不要**去改头部 / `style.json` 迁就本地副本）' });
      }
    }
  }
}

// ── ★ 反向判据：登记了、但本地副本已与已发布一致 ⇒ 该登记已不再需要（只列 ℹ，不判 FAIL）──
for (const slug of Object.keys(KNOWN_EXCEPTIONS)) {
  if (!KNOWN_EXCEPTIONS[slug].dur) continue;
  if (!localCompared.has(slug)) continue;      // 没实际比对过（风格不在语料 / 读不到）⇒ 不判"已消解"
  if (!backlog.some((b) => b.slug === slug)) resolved.push(slug);
}

// ── 失明守卫（防空转绿灯）──
const blindReasons = [];
if (styleDirs.length === 0) {
  blindReasons.push(`\`${STYLES}\` 下扫到 **0 个**带 DEMO.md 的风格目录（库仓根不可达 / 目录变了？）⇒ 一个头部行都没检查过`);
} else if (headerCount === 0) {
  blindReasons.push(`扫到 ${styleDirs.length} 个风格，但**一份头部行（^Demo:）都没有**（抽取形态变了？）⇒ 判据一条都没跑`);
}
if (styleDirs.length > 0 && headerCount > 0 && styleDurCount === 0) {
  blindReasons.push(`扫到 ${headerCount} 份头部行，但 \`${STYLES}\` 下**一份可读的 style.json#dur 都没有**`
    + ' ⇒ 没有任何**已发布运行时**可比对（时长判据空转）');
}
if (styleDirs.length > 0 && headerCount > 0 && gvCount === 0) {
  blindReasons.push(`扫到 ${headerCount} 份头部行，但 \`${DISTILL}\` 下**一份可读的 _distill.json#generatedVideo 都没有**`
    + ' ⇒ 没有任何**本地副本读数**可比对（分辨率 / 本地副本判据空转）');
}
const blind = blindReasons.length > 0;

// ── 输出 ──
const fmt = (f) => `  ${f.slug.padEnd(20)} ${f.field}  头部 ${f.got} / 真值 ${f.truth}`
  + `${f.d ? `（Δ ${f.d > 0 ? '+' : ''}${f.d}）` : ''}\n      ${f.hdr.trim().slice(0, 160)}`
  + `${f.note ? `\n      ↳ ${f.note}` : ''}`;

if (blind) {
  console.log(`✘ 本闸门已失明：`);
  for (const r of blindReasons) console.log(`  ✘ ${r}`);
} else {
  if (fails.length) {
    console.log(`✘ 头部行规格与**已发布运行时**（style.json#dur）不符 ${fails.length} 处`
      + `（时长容差 ±${DUR_TOL} s；分辨率精确；帧率不判）：\n`);
    for (const f of fails) console.log(fmt(f));
    console.log('');
  } else {
    console.log('✓ DEMO.md 头部行规格逐项一致（时长 ↔ 已发布运行时 `style.json#dur`；分辨率 ↔ `generatedVideo`；帧率不判）。');
  }
  if (noHeader.length) console.log(`\nℹ 没有头部行的风格 ${noHeader.length} 个（不计 FAIL）：${noHeader.join('、')}`);
  if (noStyleDur.length) console.log(`\nℹ 读不到已发布运行时（style.json#dur）的风格 ${noStyleDur.length} 个（不计 FAIL，该风格时长无可比对）：${noStyleDur.join('、')}`);
  if (noTruth.length) console.log(`\nℹ 读不到本地副本读数（_distill.json#generatedVideo）的风格 ${noTruth.length} 个（不计 FAIL，该风格分辨率 / 本地副本无可比对）：${noTruth.join('、')}`);
  // ★ 帧率：只报不判（仅列**头部行写了 fps** 的那些；43 份里实测 7 份）
  if (fpsInfo.length) {
    console.log(`\nℹ 帧率（**只报不判** —— 无「已发布」fps 来源，且「原生 fps」与「成片 fps」在本闸门不可机械区分，`
      + `见头注释）：${fpsInfo.length} 份头部行写了 fps（头部值 ↔ 本地副本读数）`);
    for (const f of fpsInfo) {
      const tag = (f.hdrFps !== null && f.gvFps !== null && f.hdrFps !== f.gvFps) ? '  ⚠ 头部与本地副本读数不同（不判 FAIL）' : '';
      console.log(`    · ${f.slug.padEnd(20)} 头部 ${f.hdrFps ?? '—'} fps / 本地副本 ${f.gvFps ?? '—'} fps${tag}`);
    }
  }
  const byField = {};
  for (const s of skipped) byField[s.field] = (byField[s.field] || 0) + 1;
  const skipStat = Object.entries(byField).map(([k, v]) => `${k} ${v}`).join(' / ') || '无';
  console.log(`\n[闸门] 头部行 ${headerCount} 份 / 真值 ${styleDurCount} 份 / 本地副本读数 ${gvCount} 份 / 已比对项 ${cmpCount} 个`
    + ` / 不符 ${fails.length} 处 / 跳过（未写或真值缺项）${skipped.length} 处（${skipStat}）`
    + ` / 已登记例外 ${backlog.length} 条生效（登记表 ${Object.keys(KNOWN_EXCEPTIONS).length} 个风格）`
    + `${resolved.length ? ` / 待删登记 ${resolved.length} 条` : ''} ${blind ? '、**已失明**' : ''} ${fails.length ? '✘' : 'OK'}`);
  // ★★ 已登记例外**显式**打印（绝不让例外静默通过）
  if (backlog.length) {
    console.log(`\nℹ 已登记例外 ${backlog.length} 条（只列、**不判 FAIL**；清单在 \`KNOWN_EXCEPTIONS\`）：`);
    for (const b of backlog) {
      console.log(`  · ${b.slug}  本地副本 ${b.got} / 已发布 ${b.truth}（Δ ${b.d > 0 ? '+' : ''}${b.d}）`);
      console.log(`      ↳ 已登记：${b.reg}`);
    }
  } else {
    console.log(`\nℹ 已登记例外 0 条（登记表里有 ${Object.keys(KNOWN_EXCEPTIONS).length} 个风格，本次均未命中分叉）。`);
  }
  if (resolved.length) {
    console.log(`\nℹ 待删登记 ${resolved.length} 条（登记的分叉**已消解** —— 本地副本已与已发布运行时一致）⇒ 可从 \`KNOWN_EXCEPTIONS\` 删掉：`);
    for (const s of resolved) console.log(`  · ${s}`);
  }
}
process.exitCode = (fails.length || blind) ? 1 : 0;
