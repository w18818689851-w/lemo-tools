#!/usr/bin/env node
/**
 * scripts/check-target-as-measured.mjs —— 抓「**把目标/参数值当成实测读数写进文档**」这一类错误。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 由来（为什么单独立一条闸门）
 * ══════════════════════════════════════════════════════════════════════════════
 * 文档（库仓 `styles/<slug>/DEMO.md` / `STYLE.md`、工具仓 `lib/style-skills/<slug>/SKILL.md`
 * 与 `_distill.json` 的散文）里会写**实测读数**（响度 / 真峰值 / 峰值电平）。有时写进去的
 * **不是实测、而是目标值或 mux 参数值**，读起来却像实测 —— 这是最隐蔽的一类文档错误：
 *   · **目标永远等于目标** ⇒ 它**永远不会「过期」** ⇒ 既有那几道「陈旧读数」闸门
 *     （`check-tp-prose` / `check-skill-film-fields` / `check-film-delivery`）**永远抓不到它**
 *     （它们判的是「声称 ≠ 实测」；把目标当实测时，声称 == 目标，与实测的偏差被当"陈旧"、
 *      甚至因为目标本身是"合理的交付值"而被各种排除词放行）。
 *   · 上一批审计（`_distill/库仓风格文档内容审计-2026-10-08.md` §3.2 / §5.4）明确点名：
 *     「**文档普遍把「目标」写成「实测」** …… 这是最值得单独做一条 lint 的模式」。
 *   · 已发现两例：
 *       - `styles/halftone-dossier/DEMO.md:62` 写 `−1.2 dBTP`（同句「measures」）
 *         —— 恰等于该风格的真峰值目标 `_distill.json#selfCheck.loudness.peakDbtpTarget`（= −1.2）；
 *       - `styles/watercolor/DEMO.md:60` 写 `−1.0 dBFS peak`（`→` 之后，读起来是输出读数）
 *         —— 恰等于**同一行** mux 命令里的参数 `TP=-1`。
 *
 * ★★ 核心洞察（可机械检测的信号）：
 *     「文档里一个处于**结果位**（`→` 结果列表 / 紧邻实测动词）的数值，**恰好等于**
 *      某处『目标 / 参数』值，**且不等于实测真值**」 ⇒ 它不可能是真实测量，只能是目标被写成了实测。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 口径：目标 / 参数值来源清单（`TARGETS`）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① 逐风格 `lib/style-skills/<slug>/_distill.json#selfCheck.loudness.*`：
 *        · `peakDbtpTarget`（交付真峰值上限；本库 **43/43 = −1.2**）
 *        · `targetLufsInStyleDna`（风格 DNA 里的响度目标；本库仅 `pixel-rpg` 有 = −14）
 *        · `masterPeakTargetDbfs`（母带峰值目标；本库仅 `pixel-rpg` 有 = −1.01）
 *   ② 逐风格库仓 `styles/<slug>/demo/` 下的 `.sh` / `.mjs` / `.js` / `.py` 里的渲染参数：
 *        `TP=<数>` / `LN_TP=<数>`（peak 族）、`loudnorm=I=<数>`（loudness 族）、`LRA=<数>`（lra 族）。
 *   ③ 共享脚本 `core/render/mux.sh` 的默认值（**对全部风格生效**）：
 *        `LEMO_LN_TP` 起点 **−1.7**、`loudnorm I=-14`、`LRA=11`
 *        （该文件头明写「loudnorm 的 TP 目标（起点 −1.7）比交付目标（−1.2）低 0.5 dB」）。
 *   ④ **文档行内**参数：同一行里写的 `TP=<数>` / `I=<数>` / `LN_TP=<数>`
 *        （watercolor 那例的目标来源就是**它自己那一行**的 `TP=-1`）。
 *   ★ 量族对齐（`KIND`）：`dBTP|dBFS|dB` → **peak**；`LUFS` → **loudness**；`LU` → **lra**。
 *     只有**同族**才比对（`−14 LUFS` 不会去比 `−1.2 dBTP`）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 判据（一条 `<数> <单位>` token 判 FAIL **当且仅当 ①–⑤ 全成立**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① **值 == 目标/参数值**：与 `TARGETS` 里**同族**的某个值**恰好相等**（`< 1e-9`）。
 *   ② **结果位**（"这是实测"的锚点，见下「为什么必须有这一条」）：
 *        (a) **箭头结果列表**：紧邻（只隔空白 / `*`）是 `→` 或 `,`，**且同一子句**内出现过 `→`；或
 *        (b) **实测动词**：紧前 30 字内、且**紧贴** token（动词与数值之间只有空白 / `*`）
 *            出现 `measures|measured|实测|量得|测得|landed at|lands at|came out at|stops at|sits at|reads|is at`。
 *   ③ **值 ≠ 实测真值**（这是「目标当实测」与「真实测量」的分水岭）：
 *        真值取 `_distill.json#selfCheck.loudness`（peak → `truePeakDbtp` / `samplePeakDbfs`；
 *        loudness → `integratedLufs`；lra → `lra`）。容差 peak/loudness **0.5**、lra **0.8**。
 *        **与实测相符 ⇒ 放行**（那是一次真实测量，只是**碰巧**等于目标 —— 见下「巧合」）。
 *   ④ **token 未标为目标**：紧贴位置（前置 ≤10 字 / 后置 ≤14 字）出现目标词
 *        （`目标|target|ceiling|天花板|上限|交付线|交付目标|判据|标准|不超过|不得超过|≤|<=|以内|之内|under|below|压回|压到|降到|delivery`），
 *        或紧前是**参数赋值**（`TP=` / `I=` / `LN_TP=` / `LRA=` / `TPK=`）⇒ 放行（它就是目标本身）。
 *   ⑤ **所在行无历史标记**：含历史标记（`已修|原为|原记|原先|曾是|曾为|历史|修复前|校正|撤回|不再适用|已不适用|kept as history|…`）
 *        且**不含**当前结论标记（`现状|当前结论|目前|仍然|依旧`）⇒ 归「历史（参考）」桶，**不判 FAIL**
 *        （项目做法是「保留原句 + 加历史标记 + 补现值」——那已是**正确形态**，判它等于惩罚正确写法）。
 *
 * ★★ **为什么必须有 ②（结果位）—— 实测（这是本闸门误报率的主承重墙）**
 *   目标值恰恰是**文档里出现频率最高**的那几个数（`−14 LUFS` 全库 ~80 处、`−1.2 dBTP` 多处）。
 *   只按 ① 扫 ⇒ 全库命中 **591** 处；逐条人读 ⇒ **真阳 2（1 处未修 + 1 处已修）/ 误报 589（99.7%）**。
 *   加上 ③（值≠实测）仍然不够：设计语汇「Mix to −14 LUFS」这类**本来就是目标**的句子，
 *   其值当然≠实测（如 `dark-keynote` 实测 −14.54）⇒ 只剩 ② 能把「目标陈述」与「结果声称」分开。
 *   ⇒ ② 是「按关系」的锚点（与 `check-tp-prose` 头注释 §5.3「锚点 A（动词）」同源），不是堆排除词。
 *
 * ★★ **为什么必须有 ③（值≠实测）—— 系统性「巧合」必须放行，否则误报率降不下来**
 *   本项目的 mux 把**响度归一化到 −14**、把 **loudnorm 的 TP 钉在 −1.7**，于是**成片的实测读数
 *   天然落在 −14.0 与 −1.7 附近** ⇒ 它们会**频繁地恰好等于目标**：
 *     · `−14.0 LUFS`（`art-deco` / `hologram-hud` 等）—— 实测 −14.1x，`ebur128` 印 1 位小数
 *       ⇒ **是真实读数**，不是目标当实测。★ 本库这类**走到结果位**的有 **4 处**（全部由 ③ 放行）；
 *     · `−1.7 dBFS/dBTP`（`paper-lantern` ×5）—— 实测 −1.68 印 1 位小数 ⇒ 同类巧合。
 *       ★ 但这 5 处**在 ② 就被挡住**（不在结果位），**没有走到 ③**（如实登记，免得高估 ③ 的覆盖面）。
 *   这两类**无法**用「目标词」排除（句子里根本没有目标词），只能靠 ③ 与实测真值对账放行。
 *   ⇒ 走到结果位的 6 处里：真阳 2（`watercolor` 未修 + `halftone-dossier` 已修）/ 巧合 4（全由 ③ 放行）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 误报率实测（真实语料，逐级收窄；每级都**逐条人读**判定真阳 / 误报）
 * ══════════════════════════════════════════════════════════════════════════════
 *   语料：**129 份文档**（43 `DEMO.md` + 43 `STYLE.md` + 43 `SKILL.md`）＋ 43 份 `_distill.json` 的 2511 个散文字段。
 *   **分母：2415 条 `<数> <单位>` 声称**（`dBTP|dBFS|LUFS|LU|dB`，单位族登记见 `KIND`；其中 json 散文 742 条）。
 *
 *   | 判据（逐级加严） | 命中 | 真阳(未修) | 真阳(已修) | 误报 | 误报率 |
 *   |---|---|---|---|---|---|
 *   | 只按 ①（值==目标，不管语境） | 591 | 1 | 1 | 589 | **99.7%** |
 *   | ＋② 结果位（`→` 结果列表 / 紧邻实测动词） | 6 | 1 | 1 | 4 | **66.7%** |
 *   | ＋③ 值≠实测（容差 peak/loudness 0.5、lra 0.8） | 2 | 1 | 1 | 0 | **0%** |
 *   | ＋④ token 紧贴无目标词 / 非参数赋值 | 2 | 1 | 1 | 0 | **0%** |
 *   | **最终（＋⑤ 非历史行）** | **1** | **1** | 0 | **0** | **0%** |
 *
 *   最终唯一的 FAIL = **真阳**（`watercolor/DEMO.md:60` 的 `−1.0 dBFS`，详见「已知真阳」）。
 *   ③ 放行的 4 处巧合（`art-deco/SKILL.md:99`、`hologram-hud/SKILL.md:110`、
 *   `hologram-hud/_distill.json:defects[3]`、`…:selfCheck.warnings[4]` 的 `−14.0 LUFS`）
 *   与 ⑤ 放行的 1 处历史（`halftone-dossier/DEMO.md:62` 的 `−1.2 dBTP`）**都显式列进 ℹ 桶**，
 *   **绝不静默丢弃**（本项目"假绿"大忌）。
 *
 *   ★ 每级都是**承重**的（少一级就回到高误报）：去掉 ② ⇒ 误报率回到 **95.5%**（22 命中里 21 误报，
 *     全是 `−14 LUFS` 设计语汇与 `−1.2 dBTP` 目标引用）；去掉 ③ ⇒ 回到 66.7%；
 *     去掉 ⑤ ⇒ 把项目**正确形态**（保留原句 + 历史标记 + 补现值）判红。
 *   ★ **没有为绿放宽任何判据**：以上五条都是"只抓 (a)、放过 (b)(c)"的收紧，不是排除词堆叠。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 已知真阳（本闸门当前在真实语料上 FAIL 的唯一一处；**库仓，本闸门一个字节都不写**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   `D:/lemo-opuscar/styles/watercolor/DEMO.md:60`：
 *     「Final loudness in `mux.sh`: single-pass `loudnorm=I=-14:TP=-1` → −14.2 LUFS, **−1.0 dBFS peak**.」
 *   · 值 `−1.0` == **同一行**的 mux 参数 `TP=-1`（目标来源 ④）⇒ 判 FAIL。
 *   · 实测（`_distill.json#selfCheck.loudness`）：`samplePeakDbfs = −3.350128`、`truePeakDbtp = −3.34`
 *     ⇒ 与 −1.0 差 **2.35 dB**，**不可能是真实测量**（③ 成立）。
 *   · 且 `watercolor/demo/mux.sh:19` 的 `LN_TP` 默认是 **−1.7**（不是 −1）⇒ 连那个参数本身也是陈旧的。
 *   · **修复方向**（属库仓，需另行授权；本闸门不改）：按项目做法把该句改为
 *     「… → −14.2 LUFS, **−3.35 dBFS peak**（★ 原记 `TP=-1` 目标值 −1.0 dBFS，非实测）」。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 失明守卫（防空转绿灯）
 * ══════════════════════════════════════════════════════════════════════════════
 *   任一成立 ⇒ **FAIL 并明说「本闸门已失明」**，且失明时**不再输出判据**（同 `check-demo-header` 口径）：
 *     · **0 条** `<数> <单位>` 声称（抽取形态变了 / 读错目录）；
 *     · **0 个**目标 / 参数值来源（`TARGETS` 为空 ⇒ 判据空转）；
 *     · 枚举到 **0 个风格**。
 *   ★ 单个风格读不到 `_distill.json` ⇒ 只进 ℹ 统计（该风格该量族的「值≠实测」无可比对 ⇒ 保守起见
 *     该风格的 token **只列 ℹ、不判 FAIL**，**绝不**因读不到真值而假绿）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 已知局限（如实登记，供下一轮）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **只覆盖有量纲的 token**（`dBTP|dBFS|LUFS|LU|dB`）。**无单位**的写法（`nb_frames=2922`、
 *     `duration=121.79`、`peak 0.89`）本闸门**看不见** —— 目标值里也有无单位的（`masterPeakTarget` = 0.89）。
 *   · **目标值来源不含 `style.json` / `styleboard/catalog.json` / `STYLE.md` 里写的目标**
 *     （那些是"已发布运行时"，本闸门只取 json + demo 参数 + mux 默认 + 行内参数）。
 *   · **`dB` 量族归入 peak** 是保守近似：`dB` 在文档里常是「闪避量 / 差值」（`ducked −9 dB`），
 *     实测这些**都不等于** peak 族目标值，故本轮**未产生误报**；但这是实测归纳，不是定义式。
 *   · **②(b) 的动词表**是实测归纳（本库用到的 8 个动词）；未登记的写法（如 `reports` / `gives`）
 *     ⇒ 该 token **漏判**（不是误报，是假阴）。登记表在 `MEASURED_NEAR`。
 *   · **③ 的容差 0.5 / 0.8** 覆盖「文档读数 vs 编排器重渲读数」的漂移（上一批审计实测二者不是同一次渲染）；
 *     若将来出现 >0.5 的重渲漂移且**恰好等于目标**，会误报（与 `check-tp-prose` 同型风险）。
 *   · **行内参数（目标来源 ④）只在「同一行」作用**：跨行的「上文写目标、下文写结果」形态本闸门抓不到。
 *   · **判据 ④（紧贴目标词 / 参数赋值）在真实语料上的边际效果 = 0**（走到 ② 的 6 处里没有一处带紧贴目标词）
 *     —— 它是**纵深防御**（synthetic 已证生效：`the film measures -1.2 dBTP under the ceiling.` ⇒ 进 ℹ 桶不判），
 *     不是承重墙；**如实登记，免得后来人以为它在真实语料上抓到了什么**。
 *
 * ★ 覆盖点（便于非破坏性变异验证）：
 *   · `LEMO_OPUSCAR`      —— **库仓根**（默认 `<脚本>/../../lemo-opuscar`），
 *     文档源 = `<库仓>/styles/<slug>/{DEMO.md,STYLE.md}`；demo 参数源 = `<库仓>/styles/<slug>/demo/`；
 *     mux 默认源 = `<库仓>/core/render/mux.sh`。与 `check-demo-header` / `check-ref-lines` **同名同义**。
 *   · `LEMO_DISTILL_ROOT` —— **风格技能树根**（默认 `<脚本>/../lib/style-skills`），
 *     文档源 = `<根>/<slug>/SKILL.md`；真值 + json 散文源 = `<根>/<slug>/_distill.json`。
 *     与 `check-tp-prose` / `check-demo-header` **同名同义**。
 *   把这两者指向**临时拷贝**即可构造「把目标当实测」样本，**绝不动真实文档**。
 *
 * 用法：node scripts/check-target-as-measured.mjs [--refs]
 * 退出码：0 = 没有「结果位数值 == 目标/参数值 且 ≠ 实测」的声称；
 *         1 = 有 FAIL，或**本闸门已失明**。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || path.join(HERE, '..', '..', 'lemo-opuscar'));
const STYLES = path.join(OPUSCAR, 'styles');
const DISTILL = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(HERE, '..', 'lib', 'style-skills'));
const MUX_SH = path.join(OPUSCAR, 'core', 'render', 'mux.sh');

// ── 量族登记（只有同族才比对）────────────────────────────────────────────────
const KIND = { dBTP: 'peak', dBFS: 'peak', dB: 'peak', LUFS: 'loudness', LU: 'lra' };
const UNIT_RE = /([+\u2212-]?\d+(?:\.\d+)?)\s*(dBTP|dBFS|LUFS|LU|dB)\b/g;
/** ③ 与实测真值的容差（覆盖"文档读数 vs 编排器重渲读数"的漂移；见头注释「已知局限」）。 */
const TOL = { peak: 0.5, loudness: 0.5, lra: 0.8 };

/** ②(b) 实测动词（**紧贴** token；登记表见头注释「已知局限」）。 */
const MEASURED_NEAR = /(measures|measured|实测|量得|测得|landed at|lands at|came out at|stops at|sits at|reads|is at)\s*\**\s*$/i;
/** ④ 目标词（**紧贴** token 的前 10 / 后 8 字内）。 */
const TARGET_WORD = /(目标|target|ceiling|天花板|上限|交付线|交付目标|判据|标准|不超过|不得超过|≤|<=|以内|之内|under|below|压回|压到|降到|delivery)/i;
/** ④ 参数赋值（紧贴 token 之前）⇒ 它就是目标/参数本身，不是结果。 */
const PARAM_ASSIGN = /(TP|I|LN_TP|LRA|TPK)\s*=\s*\**\s*$/;
/** ⑤ 历史标记（整行判定；与 `check-tp-prose` 的 `HIST` 同源，补本库 json 时点词）。 */
const HIST = /(已修|原为|原记|原先|曾是|曾为|历史|修复前|校正|拆分|移入|resolvedDefects|撤回|不再适用|已不适用|kept as history)/;
/** ⑤ 当前结论标记（一行里同时有它 + 历史标记 ⇒ **不**豁免；机制同 `check-tp-prose` 的 `CUR`）。 */
const CUR = /(现状|当前结论|目前|仍然|依旧)/;

const norm = (t) => Number(String(t).replace('\u2212', '-'));
const isNum = (x) => Number.isFinite(x);

// ── 目标 / 参数值来源（`TARGETS`）──────────────────────────────────────────────
const TARGETS = [];                       // { v, kind, why }
/** ★ 去重（同族同值只留**第一个**来源）：`−14 LUFS` / `−1.2 dBTP` 这类值会在几十处重复出现，
 *  保留首个来源（**mux 默认在最前** ⇒ 报出来的是最通用的那个来源，而不是某个风格的 demo），
 *  并累计出现次数 `n`（显示成 `… 等 N 处`，免得读者以为只是某一个风格的目标）。 */
const addTarget = (v, kind, why) => {
  if (!isNum(v)) return;
  const ex = TARGETS.find((t) => t.kind === kind && Math.abs(t.v - v) < 1e-9);
  if (ex) { ex.n++; return; }
  TARGETS.push({ v, kind, why, n: 1 });
};
const targetWhy = (t) => `${t.why}${t.n > 1 ? ` 等 ${t.n} 处` : ''}`;

// ③ 共享脚本 `core/render/mux.sh` 的默认值（**对全部风格生效** ⇒ 最先登记，作为最通用的来源）
let muxTxt = '';
try { muxTxt = fs.readFileSync(MUX_SH, 'utf8'); } catch { muxTxt = ''; }
{
  const lnTp = muxTxt.match(/LN_TP="\$\{LEMO_LN_TP:-(-?[0-9.]+)\}"/);
  if (lnTp) addTarget(Number(lnTp[1]), 'peak', 'core/render/mux.sh:LEMO_LN_TP 起点');
  const iDef = muxTxt.match(/loudnorm=I=(-?[0-9.]+):/);
  if (iDef) addTarget(Number(iDef[1]), 'loudness', 'core/render/mux.sh:loudnorm I');
  const lraDef = muxTxt.match(/LRA=([0-9.]+):/);
  if (lraDef) addTarget(Number(lraDef[1]), 'lra', 'core/render/mux.sh:LRA');
}

const slugs = fs.existsSync(DISTILL)
  ? fs.readdirSync(DISTILL).filter((s) => fs.existsSync(path.join(DISTILL, s, '_distill.json'))).sort()
  : [];

/** 逐风格的实测真值（③ 用）与 json 散文源。 */
const MEAS = new Map();                   // slug → { peak:[..], loudness:[..], lra:[..] }
const jsonProse = [];                     // { slug, field, text }

for (const slug of slugs) {
  let j = null;
  try { j = JSON.parse(fs.readFileSync(path.join(DISTILL, slug, '_distill.json'), 'utf8')); } catch { j = null; }
  const l = j?.selfCheck?.loudness || {};
  MEAS.set(slug, {
    peak: [l.truePeakDbtp, l.samplePeakDbfs].filter(isNum),
    loudness: [l.integratedLufs].filter(isNum),
    lra: [l.lra].filter(isNum),
  });
  // ① json 目标
  if (isNum(l.peakDbtpTarget)) addTarget(l.peakDbtpTarget, 'peak', `${slug}#selfCheck.loudness.peakDbtpTarget`);
  if (isNum(l.targetLufsInStyleDna)) addTarget(l.targetLufsInStyleDna, 'loudness', `${slug}#selfCheck.loudness.targetLufsInStyleDna`);
  if (isNum(l.masterPeakTargetDbfs)) addTarget(l.masterPeakTargetDbfs, 'peak', `${slug}#selfCheck.loudness.masterPeakTargetDbfs`);
  // ② 本风格 demo 参数
  const demo = path.join(STYLES, slug, 'demo');
  if (fs.existsSync(demo)) {
    for (const f of fs.readdirSync(demo)) {
      if (!/\.(sh|mjs|js|py)$/.test(f)) continue;
      let txt = ''; try { txt = fs.readFileSync(path.join(demo, f), 'utf8'); } catch { continue; }
      // ★ `LN_TP` 的抽取只认两种**赋值**形态（本库实测只有这两种），**绝不**用宽窗口向后找数字
      //   —— 宽窗口会跨行吃到无关的数字（实测曾把 `LN_TP_TRIES` 后面的 43 / 11 / 0 当成 TP 目标）：
      //     · `LN_TP="${LEMO_LN_TP:-<数>}"`（**本库 3/3 都是这一形态**；注意负号在 `:-` 之后，
      //        不能把 `-` 当分隔符吃掉 —— 否则 `−3.5` 会变成 `+3.5`）；
      //     · `LN_TP=<数>`（普通赋值）。
      //   `LN_TP_STEP` / `LN_TP_TRIES` 由 `(?!_[A-Z])` 挡住。
      for (const m of txt.matchAll(/(?:^|[^A-Za-z_])TP=(-?[0-9.]+)/g)) addTarget(Number(m[1]), 'peak', `${slug}/demo/${f}:TP=`);
      for (const m of txt.matchAll(/LN_TP(?!_[A-Z])\s*=\s*"\$\{LEMO_LN_TP:-(-?[0-9.]+)\}"/g)) addTarget(Number(m[1]), 'peak', `${slug}/demo/${f}:LN_TP`);
      for (const m of txt.matchAll(/LN_TP(?!_[A-Z])\s*=\s*"?(-?[0-9.]+)"?(?![\d.])/g)) addTarget(Number(m[1]), 'peak', `${slug}/demo/${f}:LN_TP`);
      for (const m of txt.matchAll(/loudnorm=I=(-?[0-9.]+)/g)) addTarget(Number(m[1]), 'loudness', `${slug}/demo/${f}:I=`);
      for (const m of txt.matchAll(/LRA=([0-9.]+)/g)) addTarget(Number(m[1]), 'lra', `${slug}/demo/${f}:LRA=`);
    }
  }
  // json 散文（逐字段字符串）
  const walk = (o, p) => {
    if (typeof o === 'string') { jsonProse.push({ slug, field: p, text: o }); return; }
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, `${p}[${i}]`)); return; }
    if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], p ? `${p}.${k}` : k);
  };
  if (j) walk(j, '');
}

// ── 文档源 ────────────────────────────────────────────────────────────────────
const docs = [];                          // { slug, src, lines }
for (const slug of slugs) {
  for (const fn of ['DEMO.md', 'STYLE.md']) {
    const p = path.join(STYLES, slug, fn);
    if (fs.existsSync(p)) docs.push({ slug, src: fn, lines: fs.readFileSync(p, 'utf8').split(/\r?\n/) });
  }
  const p = path.join(DISTILL, slug, 'SKILL.md');
  if (fs.existsSync(p)) docs.push({ slug, src: 'SKILL.md', lines: fs.readFileSync(p, 'utf8').split(/\r?\n/) });
}
for (const jp of jsonProse) docs.push({ slug: jp.slug, src: `_distill.json:${jp.field}`, lines: jp.text.split(/\r?\n/), json: true });

// ── 扫描 ──────────────────────────────────────────────────────────────────────
const fails = [], histRefs = [], coincide = [], targetMarked = [], blindSlug = new Set();
let nClaims = 0, nEqTarget = 0, nResultPos = 0, nJsonClaims = 0;

for (const D of docs) {
  // ④ 行内参数（**同一行**）
  const inline = [];
  for (let i = 0; i < D.lines.length; i++) {
    for (const m of D.lines[i].matchAll(/(?:^|[^A-Za-z_])(TP|I|LN_TP)=(-?[0-9.]+)/g)) {
      inline.push({ ln: i + 1, v: Number(m[2]), kind: m[1] === 'I' ? 'loudness' : 'peak', why: `${D.slug}/${D.src}:${i + 1} 行内参数 ${m[1]}=` });
    }
  }
  const pool = [...TARGETS, ...inline];
  const M = MEAS.get(D.slug) || { peak: [], loudness: [], lra: [] };
  const truthKnown = M.peak.length + M.loudness.length + M.lra.length > 0;

  for (let i = 0; i < D.lines.length; i++) {
    const line = D.lines[i];
    for (const m of line.matchAll(UNIT_RE)) {
      nClaims++;
      if (D.json) nJsonClaims++;
      const v = norm(m[1]);
      const kind = KIND[m[2]];
      // ① 值 == 目标 / 参数值（同族）
      const hit = pool.find((t) => t.kind === kind && Math.abs(t.v - v) < 1e-9);
      if (!hit) continue;
      nEqTarget++;
      const head = line.slice(0, m.index).split(/[。！？；;]/).pop();
      const before = line.slice(Math.max(0, m.index - 30), m.index);
      const after = line.slice(m.index + m[0].length, m.index + m[0].length + 14);
      // ② 结果位
      const listPos = /(→|,)\s*\**\s*$/.test(before) && /→/.test(head);
      const verbPos = MEASURED_NEAR.test(before);
      if (!listPos && !verbPos) continue;
      nResultPos++;
      const rec = {
        slug: D.slug, src: D.src, ln: i + 1, v: m[1], unit: m[2],
        why: hit.n === undefined ? hit.why : targetWhy(hit),
        truth: kind === 'peak' ? M.peak : kind === 'loudness' ? M.loudness : M.lra,
        line, json: !!D.json,
      };
      // ③ 与实测相符 ⇒ 真实测量（巧合），放行
      const nearActual = rec.truth.some((x) => isNum(x) && Math.abs(x - v) <= TOL[kind]);
      if (nearActual) { coincide.push(rec); continue; }
      // ④ 紧贴目标词 / 参数赋值 ⇒ 它就是目标本身，放行
      if (PARAM_ASSIGN.test(before) || TARGET_WORD.test(before.slice(-10)) || TARGET_WORD.test(after.slice(0, 14))) {
        targetMarked.push(rec); continue;
      }
      // ★ 真值缺失 ⇒ 保守起见只列 ℹ、不判 FAIL（**绝不**因读不到真值而假绿）
      if (!truthKnown) { blindSlug.add(D.slug); coincide.push({ ...rec, why: `${rec.why}；★ 本风格读不到 _distill.json#selfCheck.loudness 真值 ⇒ 只列不判` }); continue; }
      // ⑤ 历史行（含历史标记且无当前结论标记）⇒ 参考，不判
      if (HIST.test(line) && !CUR.test(line)) { histRefs.push(rec); continue; }
      fails.push(rec);
    }
  }
}

// ── 失明守卫 ──────────────────────────────────────────────────────────────────
const blindReasons = [];
if (slugs.length === 0) blindReasons.push(`\`${DISTILL}\` 下一个带 _distill.json 的风格都找不到`);
if (nClaims === 0) blindReasons.push(`扫了 ${docs.length} 份文档，**0 条** \`<数> <单位>\` 声称（dBTP|dBFS|LUFS|LU|dB）⇒ 抽取形态变了 / 读错目录`);
if (TARGETS.length === 0) blindReasons.push('**0 个**目标 / 参数值来源（json 目标 + demo 参数 + mux 默认全空）⇒ 判据空转');
const blind = blindReasons.length > 0;

// ── 输出 ──────────────────────────────────────────────────────────────────────
const SHOW_REFS = process.argv.includes('--refs');
const where = (r) => `${r.slug}/${r.src}:${r.ln}`;
const fmt = (r) => `  ${where(r).padEnd(38)}  ${r.v} ${r.unit}  == ${r.why}`
  + `${r.truth && r.truth.length ? `  （实测 ${r.truth.map((x) => x).join(' / ')}）` : ''}\n      ${r.line.trim().slice(0, 220)}`;

if (process.argv.includes('--targets')) {
  console.log(`目标 / 参数值来源 ${TARGETS.length} 个（去重后；\`n\` = 该值被登记了几次）：`);
  for (const t of TARGETS) console.log(`  [${t.kind.padEnd(8)}] ${String(t.v).padStart(7)}  ← ${targetWhy(t)}`);
  console.log('');
}

if (blind) {
  console.log('✘ 本闸门已失明：');
  for (const r of blindReasons) console.log(`  ✘ ${r}`);
} else {
  if (fails.length) {
    console.log(`✘ 「结果位数值 == 目标/参数值，且与实测不符」${fails.length} 处（判据 ①–⑤ 全成立）：\n`);
    for (const r of fails) console.log(fmt(r));
    console.log('\n  ⇒ 这些数值读起来是**实测读数**，却恰好等于某处**目标 / 参数值**、且与 `_distill.json` 实测差得很远');
    console.log('    ⇒ 只可能是**把目标/参数写成了实测**。修法（项目做法）：保留原句 + 加历史标记 + 补实测现值。');
  } else {
    console.log('✓ 未发现「结果位数值 == 目标/参数值 且 ≠ 实测」的声称。');
  }
  const dumpRefs = (title, list, note) => {
    if (!list.length) return;
    console.log(`\nℹ ${title} ${list.length} 处 —— 不计 FAIL，供人工判断${note ? `（${note}）` : ''}：`);
    const bySlug = {};
    for (const r of list) bySlug[r.slug] = (bySlug[r.slug] || 0) + 1;
    console.log('  ' + Object.entries(bySlug).map(([k, n]) => `${k} ${n}`).join(' / '));
    if (SHOW_REFS || list.length <= 12) for (const r of list) console.log(fmt(r));
    else console.log('  （>12 处，明细用 `--refs` 打印）');
  };
  dumpRefs('巧合（值==目标 但**与实测相符** ⇒ 是真实测量，只是碰巧等于目标）', coincide);
  dumpRefs('已标为目标（紧贴目标词 / 参数赋值 ⇒ 它本来就是目标）', targetMarked);
  dumpRefs('历史行（含历史标记且无当前结论标记 ⇒ 项目"保留原句+补现值"的正确形态）', histRefs);
  if (blindSlug.size) console.log(`\nℹ 读不到 \`_distill.json#selfCheck.loudness\` 真值的风格 ${blindSlug.size} 个（该风格 token 只列不判）：${[...blindSlug].join('、')}`);

  const jsonDocCount = docs.filter((d) => d.json).length;
  console.log(`\n[闸门] 文档 ${docs.length - jsonDocCount} 份（DEMO.md + STYLE.md + SKILL.md）`
    + ` + \`_distill.json\` 散文 ${jsonDocCount} 字段`
    + ` / 扫到 \`<数> <单位>\` 声称 ${nClaims} 条（其中 json 散文 ${nJsonClaims}）`
    + ` / 值==目标 ${nEqTarget} 条 / 结果位 ${nResultPos} 条`
    + ` / 目标来源 ${TARGETS.length} 个`
    + ` / FAIL ${fails.length} 处 / 巧合 ${coincide.length} / 已标为目标 ${targetMarked.length} / 历史 ${histRefs.length}`
    + ` ${blind ? '、**已失明**' : ''} ${fails.length ? '✘' : 'OK'}`);
}
process.exitCode = (fails.length || blind) ? 1 : 0;
