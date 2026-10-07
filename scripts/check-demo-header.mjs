#!/usr/bin/env node
/**
 * scripts/check-demo-header.mjs —— 库仓 `styles/<slug>/DEMO.md` 的**头部行规格**（成片规格）
 *   是否与 `_distill.json#generatedVideo` 一致。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 为什么要新开一道闸门（一次只读审计的结论，2026-10-08）
 * ══════════════════════════════════════════════════════════════════════════════
 *   库仓每份 `styles/<slug>/DEMO.md` 的**头部行**（以 `Demo:` 开头，**43/43 都有**）里
 *   写着这部成片的**规格**，形如：
 *     Demo: *The Lampbearer* (76.5 s, 1920×1080, 24 fps（★ 2026-10-07 复核订正：原记 60 fps；
 *           随库成片实测 24 fps）) · `hd-2d.mp4` …
 *   它是**面向人**（也是 README / 风格索引）的「这片多长、多大、多少帧率」的**唯一声称**，
 *   却**零闸门覆盖**：
 *     · `check-tp-prose.mjs` 只扫**工具仓**的 `lib/style-skills/<slug>/SKILL.md` 正文 + `_distill.json` 散文；
 *     · `check-ref-lines.mjs` 只扫 `styles/<slug>/demo/**` 的源码引用；
 *     · 二者**都读不到库仓的 `DEMO.md`** ⇒ 头部行里的规格可以**静默陈旧**（本项目反复治过的那类病）。
 *
 *   ★ 实测（本次，43 份头部行 ↔ 43 份 `_distill.json#generatedVideo` 逐条人读）：
 *     · **时长**：43/43 抽得到；**1 处不符** —— `pictogram-motion` 头部写 **163.6 s**，
 *       成片 `durSec` = **161.58**（差 **2.0 s**，且与该文件自己的构建步骤 `9696 frames`（=161.6 s@60）
 *       **自相矛盾**）⇒ **真缺陷**（已按现值纪律改对为 `161.6 s`，见下「本轮改正」）。
 *     · `shadow-puppet` 头部写 **`(54 s)`**（整数、且无分辨率/帧率），成片 **54.42** ⇒ 差 **0.42**，
 *       属**四舍五入**（54.42 取整 = 54）⇒ **不算缺陷** ⇒ 判据必须给容差（见下）。
 *     · **帧率** 7/7 对（7 份头部写了 fps：`game-show` / `halftone-dossier` / `hd-2d` /
 *       `paper-popup` / `pictogram-motion` / `urban-sketch` / `watercolor`）；**分辨率** 7/7 对（同一批）。
 *     ⇒ 本闸门**预计误报 0**、真阳 **1**（修前）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 判据
 * ══════════════════════════════════════════════════════════════════════════════
 *   1) **只在头部行取值**：`demoMd.split(/\r?\n/).find((l) => l.startsWith('Demo:'))`
 *      （该行以 `Demo:` 开头；全仓 43/43 都有）。
 *   2) **时长**：行内第一个 `<数> s`（`\b` 收尾）形态。
 *   3) **帧率**：本行第一个 `<数> fps`。★ **必须取「第一个」** —— 头部行里常带历史标注
 *      （`24 fps（★ 2026-10-07 复核订正：原记 60 fps…）`），**当前值在前**、历史值（`原记 60 fps`）在后；
 *      取第一个才拿到现值（若取「最后一个」会把 `60` 当现值 ⇒ 7 份里 5 份误报）。
 *   4) **分辨率**：本行 `<W>×<H>`（★ 注意是**全角 ×**；也接受 ASCII `x`）。
 *   5) **比对**：`dur ↔ generatedVideo.durSec`、`fps ↔ generatedVideo.fps`、`res ↔ width/height`。
 *
 *   ★ **容差**：时长 **±0.5 s**；帧率 / 分辨率**精确**（整数，无口径歧义）。
 *     · 为什么时长必须给容差（**实测得出，不是拍脑袋**）：`shadow-puppet` 头部写 `54`、成片 `54.42`
 *       ⇒ 差 0.42 —— 头部写**整数秒**是**合法的写法**（是四舍五入，不是错误声称）。
 *       ★ 容差 0.5 恰好放行它（0.42 ≤ 0.5），又远小于真陈旧的量级（`pictogram-motion` 差 **2.02**，
 *       是容差的 **4 倍**）⇒ 不是「什么都不判」。实测：容差取 0.5 ⇒ 命中 1（真阳 1 / 误报 0）；
 *       取 0.4 ⇒ 会把 `shadow-puppet` 误报（2 处命中、1 处误报）⇒ **0.5 是实测下限**。
 *   ★ **`hdr` 里没有的项**（如 `shadow-puppet` 没写 fps/分辨率）⇒ **跳过那一项**，不判 FAIL
 *     —— **头部行规格是可选的**（只有时长是 43/43 都写的）。
 *   ★ **真值里没有的项**（json 缺 `fps` 等）⇒ 同样跳过（无法比对），单列 ℹ 统计。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 抽取正则的两处「必须这么写」（★ 都与审计给的写法不同，且都**跑命令核实过**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① **时长正则不能锚 `\(`**。审计给的写法是 `/\(([0-9]+(?:\.[0-9]+)?)\s*s\b/`（要求 `(` **紧贴**数字）——
 *      它在 **41/43** 份头部行上工作，却在**恰恰要抓的那一份**上**静默失明**：
 *      `pictogram-motion` 的头部是 `*…* (EN-JP version, 163.6 s, …`（`(` 与数字之间隔着 `EN-JP version, `）
 *      ⇒ `match` 返回 `undefined` ⇒ `Number(undefined) = NaN` ⇒ `Math.abs(NaN - 161.58) > 0.5` 为 **false**
 *      ⇒ **该风格被静默跳过**（实测：用锚 `\(` 的写法跑全量 ⇒ **命中 0**，真阳 1 被漏）。
 *      ⇒ 改为 `/…\s*s\b/`（不锚 `(`，只认「数字 + 空格 + 小写 `s` + 词边界」）。
 *      ★ 已核实**不引入误报**：43 份里 43/43 抽出的都是**头部行那一个时长**（见下「实测」表），
 *        且 `\b` 把 `43 Sports` / `70 sport` 这类**词内 `s`** 排除在外。
 *   ② **帧率必须取「第一个」**：`hdr.match(/…\s*fps/)`（**非全局**）天然只返回第一处 —— 见判据 3)。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 失明守卫（防空转绿灯）
 * ══════════════════════════════════════════════════════════════════════════════
 *   下列任一成立 ⇒ **FAIL 并明说「本闸门已失明」**，且**失明时不再输出判据**（同 `check-ref-lines` 口径）：
 *     · 枚举到 **0 个风格**（`<库仓>/styles` 不可达 / 没有任何带 `DEMO.md` 的风格目录）；
 *     · **0 份**头部行（`^Demo:` 一处都找不到 —— 抽取形态变了 / 读错目录）；
 *     · 真值侧 **0 份**可读的 `_distill.json#generatedVideo`（读不到成片规格 ⇒ 无可比对）。
 *   ★ 单个风格读不到真值 / 没写头部行 ⇒ 只进 ℹ 统计（其余风格仍判）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 本轮改正（2026-10-08，按项目「现值声称直接改对」纪律）
 * ══════════════════════════════════════════════════════════════════════════════
 *   `styles/pictogram-motion/DEMO.md` 头部：`163.6 s` → **`161.6 s`**（与成片 `durSec = 161.58` 一致；
 *   ★ 该行原有的「★ 2026-10-07 复核订正：原记 60 fps…」历史标注**原样保留**，只动时长数字）。
 *   ★ 已镜像到 WSL 副本（项目双副本纪律），`check-dual-copy-sync.mjs` 两侧 md5 一致。
 *   ★ 修后本闸门在真实语料上**命中 0**。
 *
 * ★ 覆盖点（便于非破坏性变异验证，登记于 `test/README.md` 与 `_distill/AGENT-BRIEF.md`）：
 *   · `LEMO_OPUSCAR`      —— **库仓根**（默认 `<脚本>/../../lemo-opuscar`，即 `D:/lemo-opuscar`）。
 *     头部行**源** = `<LEMO_OPUSCAR>/styles/<slug>/DEMO.md`。★ **不硬编码 `D:/lemo-opuscar`**
 *     （否则夹具没法重定向）。
 *   · `LEMO_DISTILL_ROOT` —— **风格技能树根**（默认 `<脚本>/../lib/style-skills`），真值**源** =
 *     `<LEMO_DISTILL_ROOT>/<slug>/_distill.json#generatedVideo`。与 `check-tp-prose` /
 *     `check-skill-film-fields` **同名同义**。
 *
 * 用法：node scripts/check-demo-header.mjs
 * 退出码：0 = 全部头部行规格与成片一致（或头部行**没写**该规格项）；
 *         1 = 有 FAIL，或**本闸门已失明**。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// ★ 覆盖点：库仓根（同名同义于 check-ref-lines / check-env-overrides / check-render-venc）。
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || path.join(HERE, '..', '..', 'lemo-opuscar'));
const STYLES = path.join(OPUSCAR, 'styles');
// ★ 覆盖点：风格技能树（真值源），同名同义于 check-tp-prose / check-skill-film-fields。
const DISTILL = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(HERE, '..', 'lib', 'style-skills'));

/** 时长容差（秒）—— 见头注释「判据·容差」的实测依据：0.5 放行 shadow-puppet 的 54 vs 54.42，仍抓得住 2.02 的真陈旧。 */
const DUR_TOL = 0.5;

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

const fails = [];          // 判 FAIL
const noTruth = [];        // ℹ：读不到真值的风格
const noHeader = [];       // ℹ：没有头部行的风格
const skipped = [];        // ℹ：头部行没写 / 真值缺项 ⇒ 该字段跳过
let headerCount = 0, truthCount = 0, cmpCount = 0;

for (const slug of styleDirs) {
  let md = '';
  try { md = fs.readFileSync(path.join(STYLES, slug, 'DEMO.md'), 'utf8'); } catch { continue; }
  const hdr = headerOf(md);
  if (!hdr) { noHeader.push(slug); continue; }
  headerCount++;

  const h = extract(hdr);

  let gv = null;
  try { gv = JSON.parse(fs.readFileSync(path.join(DISTILL, slug, '_distill.json'), 'utf8')).generatedVideo || null; } catch { gv = null; }
  if (!gv) { noTruth.push(slug); continue; }
  truthCount++;

  // ── 时长（±0.5 s）──
  if (h.dur === null) skipped.push({ slug, field: '时长', why: '头部行未写' });
  else if (!Number.isFinite(gv.durSec)) skipped.push({ slug, field: '时长', why: '真值缺 durSec' });
  else {
    cmpCount++;
    if (Math.abs(h.dur - gv.durSec) > DUR_TOL) {
      fails.push({ slug, field: '时长', got: `${h.dur} s`, truth: `${gv.durSec} s`,
        d: (h.dur - gv.durSec).toFixed(2), hdr });
    }
  }
  // ── 帧率（精确）──
  if (h.fps === null) skipped.push({ slug, field: '帧率', why: '头部行未写' });
  else if (!Number.isFinite(gv.fps)) skipped.push({ slug, field: '帧率', why: '真值缺 fps' });
  else {
    cmpCount++;
    if (h.fps !== gv.fps) {
      fails.push({ slug, field: '帧率', got: `${h.fps} fps`, truth: `${gv.fps} fps`, d: '', hdr });
    }
  }
  // ── 分辨率（精确）──
  if (h.res === null) skipped.push({ slug, field: '分辨率', why: '头部行未写' });
  else if (!Number.isFinite(gv.width) || !Number.isFinite(gv.height)) skipped.push({ slug, field: '分辨率', why: '真值缺 width/height' });
  else {
    cmpCount++;
    if (h.res[0] !== gv.width || h.res[1] !== gv.height) {
      fails.push({ slug, field: '分辨率', got: `${h.res[0]}×${h.res[1]}`, truth: `${gv.width}×${gv.height}`, d: '', hdr });
    }
  }
}

// ── 失明守卫（防空转绿灯）──
const blindReasons = [];
if (styleDirs.length === 0) blindReasons.push(`\`${STYLES}\` 下扫到 **0 个**带 DEMO.md 的风格目录（库仓根不可达 / 目录变了？）⇒ 一个头部行都没检查过`);
else if (headerCount === 0) blindReasons.push(`扫到 ${styleDirs.length} 个风格，但**一份头部行（^Demo:）都没有**（抽取形态变了？）⇒ 判据一条都没跑`);
if (styleDirs.length > 0 && headerCount > 0 && truthCount === 0) {
  blindReasons.push(`扫到 ${headerCount} 份头部行，但 \`${DISTILL}\` 下**一份可读的 _distill.json#generatedVideo 都没有** ⇒ 没有任何可比对的成片规格`);
}
const blind = blindReasons.length > 0;

// ── 输出 ──
const fmt = (f) => `  ${f.slug.padEnd(20)} ${f.field}  头部 ${f.got} / 成片 ${f.truth}${f.d ? `（Δ ${f.d > 0 ? '+' : ''}${f.d}）` : ''}\n      ${f.hdr.trim().slice(0, 160)}`;

if (blind) {
  console.log(`✘ 本闸门已失明：`);
  for (const r of blindReasons) console.log(`  ✘ ${r}`);
} else {
  if (fails.length) {
    console.log(`✘ 头部行规格与成片不符 ${fails.length} 处（时长容差 ±${DUR_TOL} s；帧率 / 分辨率精确）：\n`);
    for (const f of fails) console.log(fmt(f));
    console.log('');
  } else {
    console.log('✓ DEMO.md 头部行规格与 _distill.json#generatedVideo 逐项一致（时长 / 帧率 / 分辨率）。');
  }
  if (noHeader.length) console.log(`\nℹ 没有头部行的风格 ${noHeader.length} 个（不计 FAIL）：${noHeader.join('、')}`);
  if (noTruth.length) console.log(`\nℹ 读不到 _distill.json#generatedVideo 的风格 ${noTruth.length} 个（不计 FAIL，该风格无可比对）：${noTruth.join('、')}`);
  const byField = {};
  for (const s of skipped) byField[s.field] = (byField[s.field] || 0) + 1;
  const skipStat = Object.entries(byField).map(([k, v]) => `${k} ${v}`).join(' / ') || '无';
  console.log(`\n[闸门] 头部行 ${headerCount} 份 / 真值 ${truthCount} 份 / 已比对项 ${cmpCount} 个 / 不符 ${fails.length} 处 / 跳过（未写或真值缺项）${skipped.length} 处（${skipStat}）${blind ? '、**已失明**' : ''} ${fails.length ? '✘' : 'OK'}`);
}
process.exitCode = (fails.length || blind) ? 1 : 0;
