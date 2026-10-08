#!/usr/bin/env node
/**
 * scripts/check-distill-fields.mjs —— `_distill.json` **字段路径的「登记表 + 双向守卫」**闸门
 *
 * ★ ① 由来（2026-10-07）：`scripts/check-selfcheck-claims.mjs` 的头注释里写着一条**一次性人工审计**的结论 ——
 *   「43 份 `_distill.json` 的 `selfCheck` 去重后共 **283 条字段路径**，其中 **242 条没有任何闸门在读**
 *   （41 条有消费者）」。★ 问题：那个数字**没有任何机制保证它不再变** —— 将来给 `_distill.json`
 *   加一个新字段，谁也不会想起来「这个字段该不该有闸门」。这与 `check-env-overrides.mjs` 要解决的病
 *   **同型**（覆盖点无人守 ⇒ 静默过期）。本闸门把「每个字段有没有覆盖」变成**可核的登记**。
 *
 * ★★ ② 判据（双向，缺一不可）：
 *   ① **未登记 ⇒ FAIL**：枚举真实数据里出现的**所有字段路径**（顶层键 + 嵌套对象的子键；数组元素对象
 *      加 `[]` 后缀，如 `selfCheck.silenceWindows[].peakDb`），凡**不在** `FIELDS` 登记表里 ⇒ FAIL，
 *      并**点名「风格 slug + 字段路径」**。
 *   ② **登记了但闸门不在了 ⇒ FAIL**：登记表里每条声明 `coveredBy: '<闸门名>'` 的，`scripts/<闸门名>.mjs`
 *      必须**存在**，且其**剥注释后**的文本里出现该条声明的 token（`match`，缺省 = 字段路径的**叶名**）
 *      ⇒ 否则 FAIL，并列出受影响的所有字段路径。
 *      ★ 判据② 的语义是「**登记了但闸门不在了才红**」：字段本身从数据里消失**不**触发它
 *      （字段不存在 ≠ 闸门不在）—— 见 ⑦ 的**变异 C**。
 *   ③ **ℹ 登记为「无闸门」（`coveredBy: null` + `verifiability` + `reason`）只列、不判 FAIL**，
 *      但**按可核性分三档**输出（见 ③）；人读输出与 `--json` 都要能**一眼看到计数**：
 *      「N 条可核但无闸门 / M 条不可核」。
 *   ④ **失明守卫**：枚举到 **0 个风格** / **0 条字段路径** / **登记表为空** ⇒ **FAIL 并明说
 *      「本闸门已失明」**，且失明时**不再输出判据 ①②**（那只会刷屏且会被误读成「字段有问题」）。
 *   ⑤ **登记表自洽性 ⇒ FAIL**：每条 `coveredBy: null` 条目**必须**带合法 `verifiability`
 *      （`'value'` / `'claim'` / `'unverifiable'`）—— 否则三档计数会**静默失真**（新增的守卫，见 ③）。
 *   ⑥ **`selfCheck.loudness` 必须声明「读数测的是哪一份产物」⇒ 缺 / 枚举外 ⇒ FAIL**（★ 2026-10-08 新增，
 *      治第 113~116 批连续四批的**根因混淆**）：逐份核 `selfCheck.loudness.measuredFrom` **存在**且在
 *      枚举（`local-copy` / `published-film`）内，否则 FAIL 并点名 slug；`measuredPath` 若在须是非空字符串、
 *      且 `measuredFrom === 'local-copy'` 时须等于 `D:/lemo-films/<slug>/<slug>.mp4`。详见 ⑨。
 *
 * ★★ ③ 登记表的**三档语义**（★ 2026-10-08 从「两档」升级；`--json` 见下）：
 *   · `coveredBy: '<闸门名>'` ⇒ 判据② 守着它（闸门文件在 + 源码里有 token）。
 *   · `coveredBy: null` + `verifiability` + `reason` ⇒ 只列 ℹ、**不判 FAIL**，且按可核性分三档：
 *     - `'value'`       **可核·值级**：有**权威对照物**（实物 / 权威结构化字段 / 代码），只是**还没建闸门**
 *                       ⇒ **真缺口（该补）**。例：`selfCheck.ratio` 对 `generatedVideo.{width,height}` 派生。
 *     - `'claim'`       **可核·声称级**：是**散文 / 口径声明**，但能被**机械核**（对代码锚 / 权威字段 / 白名单）
 *                       ⇒ 该补闸门。例：`selfCheck.loudness.truePeakMethod` 对 `mux.sh` 实际命令。
 *     - `'unverifiable'` **不可核**：**根本没有权威对照物**（纯标识 / 时点 / 孤儿字段 / 运行时读数且记录
 *                       来源已被失败 run 覆盖 / 唯一「对照物」是自由散文）⇒ **如实标注「不可核」，不假装能覆盖**。
 *   ★ 纪律：**绝不为了让闸门变绿而瞎登记** —— 宁可多写 `null`，也不编一个假闸门名。
 *   ★★ 纪律：**不许把可核的偷偷标成不可核来省事**（那是自欺）；宁可多留几条「可核·待补闸门」。
 *   ★ 判可核性的口径（本闸门采用，逐条写进 `reason`）：**存在独立于该字段自身、且在仓内持久可得、
 *     可机械核（无需实跑 ffmpeg 重测、无需解析自由散文）的权威对照物** ⇒ 可核；否则 ⇒ 不可核。
 *
 * ★★ ④ `match` 字段（可选；判据② 要在闸门源码里找到的 token，缺省 = 叶名）—— **为什么需要它**：
 *   有些闸门是**按命名空间 / 按清单**覆盖一整棵子树的，此时**叶名根本不会出现在闸门源码里**：
 *     · `check-tp-prose.mjs` 的 json 散文白名单是 `/^audioEvidence\./`、`/^selfCheck\.audio\./` 这类
 *       **正则字面量** ⇒ 剥注释时**连正则一起被剥掉**（状态机把 `regex` 区替换成空格），叶名不可见；
 *     · `check-aspect-prose.mjs` 的 json 字段清单是**字符串数组** `JSON_FIELDS = ['limits', …]`
 *       ⇒ 字符串字面量同样被剥掉；
 *     · `check-skill-scores.mjs` 读 `scoreBreakdown[KEYS[i]]`，五个子键名在 `KEYS` 数组里（字符串）。
 *   ⇒ 对这些条目，`match` 指向**承载该覆盖的那段代码的 token**（`audioEvidence` / `selfCheck` /
 *     `JSON_FIELDS` / `scoreBreakdown` / `loudness` / `generatedVideo`），并在 `reason` 里写明依据。
 *   ★ **已知局限（如实写）**：`match` 只证明「**该闸门仍在处理这个命名空间 / 清单**」，
 *     **不**证明它真读了这一个叶字段（例如把 `limits` 从 `JSON_FIELDS` 里删掉，判据② **不会响**）。
 *     这是**假阴**、不是误报；判据② 的主要职责是「闸门被删 / 改名 / 换写法」。
 *
 * ★★ ⑤ 与既有闸门的重叠审计（**先读后写；结论：不重复**）：
 *   逐条读了 `check-doc-coverage.mjs` / `check-skill-artifacts.mjs` / `check-selfcheck-claims.mjs` /
 *   `check-tp-prose.mjs` 的扫描范围与判据：
 *   · `check-doc-coverage.mjs`：查「`scripts/*.mjs` 有没有被登记进**两份文档**」—— 对象是**脚本**，
 *     不是 `_distill.json` 的字段；本闸门查的是**字段路径**。**正交**。
 *   · `check-skill-artifacts.mjs`：查 `generatedVideo.*` 的**值**与磁盘实物是否一致（值级）。
 *   · `check-selfcheck-claims.mjs`：查 `selfCheck` 里**几个可核字段**的**值**与成片 / 权威字段是否一致（值级）。
 *   · `check-tp-prose.mjs`：查**散文里的读数**与实测是否一致（值级）。
 *   ⇒ 三条都是**值级**判据（「这个字段的值对不对」），**没有一条**问「这个字段**有没有人管**」。
 *     本闸门是**存在级 / 覆盖级**判据（「每个字段路径有没有一个明确的决定」）⇒ 与它们**正交**、不重复。
 *
 * ★★ ⑥ 误报率（**先跑一遍再定稿**；真实 43 份语料，快照 **2026-10-07 23:04**，
 *   同时 `hd-2d` / `cel-anime-80s` 正被另一个智能体改**散文内容（不增删字段）** ⇒ 不影响本闸门的字段枚举）：
 *   · 枚举到 **43 个风格 / 276 条去重字段路径**（★ 与 `check-selfcheck-claims.mjs` 头注释里那条
 *     一次性审计的「283 条」**口径不同**：那是**只看 `selfCheck` 子树**、且深度 / 数组展开规则未写明；
 *     本闸门的规则是「**整份 json**、对象递归、数组元素对象加 `[]`」，可复现 —— **以本闸门为准**）。
 *     ★ 2026-10-08 加判据⑥ 时给 43 份加了两条新路径（`selfCheck.loudness.{measuredFrom,measuredPath}`）
 *     ⇒ 现为 **278 条**（登记表同步 +2，见 ⑨）。
 *   · 登记 **278 条**（有闸门 **226** 条 / 无闸门 **52** 条 = **可核·待补闸门 5**〔值级 4 / 声称级 1〕
 *     **+ 不可核 47**）。★ 2026-10-08 复核时修正 **6 条过期条目**：`sources` 由「无闸门」**提升为有闸门**
 *     （`check-sources-paths.mjs`，2026-10-08 新建、读 `json.sources`）；`audioScoreBasis` / `selfCheck.ratio` /
 *     `selfCheck.clippedSamples` / `selfCheck.loudness.{truePeakMethod,lraMethod}` **5 条**由「可核·待补」
 *     **提升为有闸门**（`check-selfcheck-claims.mjs` 2026-10-08 新增**判据 G / H1 / H2 / F** 读了它们）
 *     ⇒ 无闸门由 58 → **52**（见 ⑧）。★ 同日加判据⑥ ⇒ 新登记 2 条 `selfCheck.loudness.{measuredFrom,measuredPath}`
 *     （`coveredBy: 'check-distill-fields.mjs'` 自指本闸门）⇒ 有闸门 224 → **226**。
 *   · 判据① 命中 **0**（真实语料 278 条**全部**已登记 —— 登记表就是照它建的）⇒ 真阳 0 / 误报 0。
 *   · 判据② 命中 **0**（226 条覆盖声明 = **184 条**用显式 `match`（归并为 **6 个 (闸门, token) 对**：
 *     `JSON_FIELDS` / `scoreBreakdown` / `audioEvidence` / `generatedVideo` / `loudness` / `selfCheck`）
 *     + **42 条**用**叶名** token（含 `sources` 与 2026-10-08 提升的 5 条 + 新增 2 条；归并为 **42 个 (闸门, 叶名) 对**），
 *     共 **48 个 (闸门, token) 对**，**逐个**在闸门**剥注释后**的源码里核对过 token 存在）⇒ 真阳 0 / 误报 0。
 *   · ★ 误报率的**真实检验**在 ⑦ 的变异与反向验证里（阴性对照 = 真实语料 **exit 0**）。
 *
 * ★★ ⑦ 验证（**临时副本 + 覆盖点，绝不动真实仓**）：
 *   · **阴性对照**（真实语料）⇒ **exit 0**。
 *   · **变异 A**（临时副本某份 `_distill.json` 加 `selfCheck.LEMO_ZZZ_PROBE`）⇒ **exit 1 且点名**。
 *   · **变异 B**（登记表某条 `coveredBy` 改成不存在的闸门名）⇒ **exit 1 且点名**。
 *   · **变异 C**（临时副本把**已登记为有闸门**的字段名从数据里删掉）⇒ **exit 0**
 *     —— 确认判据② 的语义是「登记了但闸门不在了才红」，不是「字段消失了就红」。
 *   · **变异 D**（2026-10-08 新增；判据⑤）：把某条「无闸门」条目的 `verifiability` 删掉 / 改非法 ⇒ **exit 1**。
 *   · **变异 E**（2026-10-08 新增；判据⑥）：临时副本删掉某份 `selfCheck.loudness.measuredFrom` ⇒ **exit 1 且点名**；
 *   · **变异 F**（2026-10-08 新增；判据⑥）：把某份 `measuredFrom` 改成**枚举外**的值（如 `'whatever'`）⇒ **exit 1 且点名**。
 *   · ★★ **反向验证**：分别**短路判据① / 判据② / 判据⑥** ⇒ 对应变异必须**重新变绿**（证明判据承重，不是摆设）。
 *   · **失明三态**（空风格树 / 数据里 0 字段 / 清空登记表）⇒ **均 exit 1 + 「本闸门已失明」**。
 *   ★ **实测退出码**（2026-10-08 复核；同一套断言也写在 `test/gate-blindness.test.mjs` 的
 *     `check-distill-fields` 用例里）：阴性对照 **0**；变异A **1**（点名 `art-deco` + `selfCheck.LEMO_ZZZ_PROBE`）；
 *     变异B **1**（点名 `check-zzz-not-exist.mjs`）；变异C **0**（275 条路径，判据② 未响）；
 *     短路判据① 后变异A **0**；短路判据② 后变异B **0**；
 *     变异E（删 `measuredFrom`）**1**（点名 slug）；变异F（枚举外值）**1**（点名 slug）；短路判据⑥ 后 E/F **均 0**；
 *     失明三态（空风格树 / 数据里 0 字段 / 空登记表）**均 1** 且都打「本闸门已**失明**」、且不输出判据①②。
 *
 * ★★ ⑨ 判据⑥ 的由来与设计（★ 2026-10-08 新增，治「读数测的是谁」的**根因混淆**）：
 *   · **病症**：`selfCheck.loudness` 里的读数（`truePeakDbtp` / `integratedLufs` / `lra` /
 *     `samplePeakDbfs` / `peakTargetMet` …）测的是**本地副本**（`D:/lemo-films/<slug>/<slug>.mp4`），
 *     而字段本身**完全没写这件事** —— `truePeakMethod` 只写 `ffmpeg -i <film> …`（`<film>` 是**歧义的**）。
 *     项目学说（`D:/lemo-opuscar/MAINTAINING.md`「The published film carries the pre-fix audio」）
 *     却规定**权威 artifact 是「已发布影片」**、不是本地副本 ⇒ 于是连续四批把本地读数当权威：
 *     撤错扣分 / 把已发布规格当陈旧「修」掉 / 拿本地读数判「达标」而发布片其实超标
 *     （已实测 **43 部发布片里 37 部真峰值 > −1.2 dBTP**，而 `selfCheck` 因读本地副本记 `peakTargetMet: true`）。
 *   · **修法**：给 `selfCheck.loudness` 加**声明产物来源**的两个字段（只加字段、**不改任何既有数值**）：
 *     `measuredFrom`（枚举 `local-copy` / `published-film`）+ `measuredPath`（可读路径）。
 *     ★ **为什么只声明来源、不写发布片读数**：写死发布片读数会**在替换后立刻过期**
 *     （第 116 批已修好 43 部发布片待上传 ⇒ 现在的发布片读数马上失效），而「来源」是**长期有效**的；
 *     且维护两套读数会**新增漂移面**、本闸门也无法在仓内复核发布片读数（要联网下载整片）。
 *   · **语义边界（如实写）**：判据⑥ 是**存在级 + 枚举级** —— 保证「来源**被声明了**且值合法」，
 *     **不**保证「声明为真」（读数到底出自哪个文件，仓内无机械对照物）。要判发布片是否达标，
 *     **必须另行实测发布片**（见 `_distill/AGENT-BRIEF.md` 的命令）。
 *
 * ★★ ⑧ 2026-10-08 的「可核性分类」升级（本闸门的 `coveredBy: null` 条目由「一档 reason」拆成**三档**）：
 *   · 起因：58 条 `coveredBy: null` 的 `reason` 原来**混着三种性质不同的东西**（值级可核 / 声称级可核 /
 *     不可核），读起来分不清 ⇒ 本次按**可核性**拆成 `verifiability: 'value' | 'claim' | 'unverifiable'`，
 *     并把 `reason` 写成「说清是哪一档 + 为什么」。★ 独立复核报告：`_distill/无闸门字段内容审计-2026-10-08.md`；
 *     逐条清单：`_distill/不可核字段清单-2026-10-08.md`。
 *   · ★ **同时修正 6 条过期条目**（登记表照 2026-10-07 快照建，之后新闸门/新判据上线 ⇒ 条目过期）：
 *     · `sources` —— 被 2026-10-08 新建的 `check-sources-paths.mjs` 覆盖（读 `json.sources`）⇒ 提升为有闸门；
 *     · `audioScoreBasis` / `selfCheck.ratio` / `selfCheck.clippedSamples` / `selfCheck.loudness.{truePeakMethod,lraMethod}`
 *       —— 被 `check-selfcheck-claims.mjs` 2026-10-08 新增的**判据 G / H1 / H2 / F** 读了 ⇒ 由「可核·待补」提升为有闸门。
 *     ⇒ 无闸门 **58 → 52**（可核·待补 **10 → 5**）。
 *   · ★ **同时修正一条 `reason` 事实错**：`masterPeak*` 的旧 reason 写「单风格特例（`hologram-hud`）」，
 *     实测**只出现在 `pixel-rpg`** ⇒ 已改。
 *
 * ★ 覆盖点（供非破坏变异验证；与既有闸门同名同义）：
 *   · `LEMO_DISTILL_ROOT` —— 风格技能树（默认 `<仓根>/lib/style-skills`；与 `check-skill-artifacts`
 *     / `check-selfcheck-claims` / `check-tp-prose` 同名同义）。
 *   · `LEMO_TOOLS_ROOT`   —— 本仓仓根（默认按脚本自身位置推导；与 `check-doc-coverage`
 *     / `check-redline-md5` / `check-line-endings` 同名同义）—— 判据② 找 `scripts/<闸门>.mjs` 用它。
 *
 * ★ 已知局限（如实写，不粉饰）：
 *   · `match` 只核「命名空间 / 清单仍在」（见 ④），核不了「叶字段仍在清单里」（**假阴**）。
 *   · 枚举规则**不是 AST**：只认「对象键 + 数组元素对象的**首元素**」；同一数组里不同元素结构不同时
 *     只取首元素的键（实测本库 43 份的数组元素对象结构一致 ⇒ 无影响）；**空数组**贡献 0 个子路径。
 *   · 只枚举 `_distill.json`；`SKILL.md` 的章节 / 字段不在范围内（由 `style-skill-check` / `check-tp-prose` 管）。
 *   · **叶名 token 若是通用词，判据② 会变弱**：`reason` / `path` / `width` / `size` / `script` / `fps`
 *     这类叶名在闸门源码里**很可能只是恰好同名**（不是真在读那个字段）⇒ 判据② 对这类条目**弱**
 *     （**假阴**）。它们真正的保障是**值级闸门本身**（`check-mux-parity` / `check-skill-artifacts` …）
 *     —— 本闸门只保证「那条**声明**没有悄悄失效」，不保证「那个值被核过」。
 *   · 登记表是**人工决定**的产物（哪条算「有闸门」是本闸门的判断）⇒ 它守的是「**决定不再悄悄过期**」，
 *     不保证决定本身最优。
 *   · **可核性分类也是人工判断**：`value` / `claim` / `unverifiable` 的界线由本闸门按 ③ 的口径逐条裁定，
 *     存在**边界个案**（如「唯一对照物是自由散文」「对照物是渲染产物不在本仓」）⇒ 已在各条 `reason` 写明依据，
 *     并允许**未来被推翻**（推翻时改 `verifiability` 即可，判据⑤ 会守住格式）。
 *
 * 用法：node scripts/check-distill-fields.mjs [--json]
 * 退出码：有未登记字段 / 覆盖声明失效 / 失明 / 登记表失格 / 读数来源未声明或非法 ⇒ 1；否则 0（判据③ 的 ℹ 不影响退出码）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ★ 仓根：覆盖点 `LEMO_TOOLS_ROOT`（与 `check-doc-coverage` / `check-redline-md5` / `check-line-endings` 同名同义）。 */
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
/** ★ 风格技能树：覆盖点 `LEMO_DISTILL_ROOT`（与 `check-skill-artifacts` / `check-selfcheck-claims` / `check-tp-prose` 同名同义）。 */
const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(ROOT, 'lib', 'style-skills'));
/** ★ `--json`：机器可读输出（与 `check-env-overrides.mjs` 同款）。 */
const JSON_OUT = process.argv.includes('--json');

// ── ★ 剥注释 + 字符串（状态机；行号不变）────────────────────────────────────
//   ★★ **逐字照抄** `scripts/check-env-overrides.mjs` 的 `codeOnly()`（同一套 `REGEX_PREV` /
//   `REGEX_PREV_WORD`）—— 本项目为此踩过两处坑（见该闸门头注释 ③）：粗剥会吃掉真命中、
//   不剥字符串会把「补丁体字面量里的变量名」当成真读者。**不自己发明第二套写法**。
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', '']);
const REGEX_PREV_WORD = ['return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'void', 'delete', 'instanceof', 'new', 'yield', 'await', 'throw'];

function codeOnly(src) {
  const out = src.split('');
  const n = src.length;
  const stack = [];                                  // 帧：{t:'tpl'} | {t:'expr',depth} | {t:'sq'|'dq'|'regex'}
  const top = () => (stack.length ? stack[stack.length - 1].t : 'code');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0, prevSig = '', prevWord = '';
  while (i < n) {
    const c = src[i], c2 = src[i + 1], t = top();
    if (t === 'code' || t === 'expr') {
      if (c === "'") { stack.push({ t: 'sq' }); i++; continue; }
      if (c === '"') { stack.push({ t: 'dq' }); i++; continue; }
      if (c === '`') { stack.push({ t: 'tpl' }); i++; continue; }
      if (c === '/' && c2 === '/') { const s = i; while (i < n && src[i] !== '\n') i++; blank(s, i); continue; }
      if (c === '/' && c2 === '*') {
        const s = i; i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i = Math.min(n, i + 2); blank(s, i); continue;
      }
      if (c === '/' && (REGEX_PREV.has(prevSig) || REGEX_PREV_WORD.includes(prevWord))) { stack.push({ t: 'regex' }); i++; continue; }
      if (t === 'expr') {
        if (c === '{') stack[stack.length - 1].depth++;
        else if (c === '}') {
          if (stack[stack.length - 1].depth === 0) { stack.pop(); prevSig = '`'; i++; continue; }
          stack[stack.length - 1].depth--;
        }
      }
      if (/\s/.test(c)) { if (c === '\n') prevSig = ''; i++; continue; }
      prevSig = c;
      const wm = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
      prevWord = wm ? wm[0] : '';
      i++; continue;
    }
    if (t === 'sq' || t === 'dq') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if ((t === 'sq' && c === "'") || (t === 'dq' && c === '"')) { stack.pop(); prevSig = "'"; i++; continue; }
      blank(i, i + 1); i++; continue;
    }
    if (t === 'regex') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if (c === '[') { let j = i + 1; while (j < n && src[j] !== ']') { if (src[j] === '\\') j++; j++; } blank(i, Math.min(n, j + 1)); i = Math.min(n, j + 1); continue; }
      if (c === '/') { stack.pop(); prevSig = '/'; i++; continue; }
      blank(i, i + 1); i++; continue;
    }
    // tpl
    if (c === '\\') { blank(i, i + 2); i += 2; continue; }
    if (c === '`') { stack.pop(); prevSig = '`'; i++; continue; }
    if (c === '$' && c2 === '{') { blank(i, i + 2); stack.push({ t: 'expr', depth: 0 }); prevSig = '{'; i += 2; continue; }
    blank(i, i + 1); i++; continue;
  }
  return out.join('');
}

// ── 登记表里重复出现的长 reason，抽成常量（只为少写 200 遍；语义见头注释 ④）────────
/** 命名空间式覆盖：`check-tp-prose.mjs` 的 json 散文白名单按 `audioEvidence.` 前缀整体覆盖。 */
const R_NS_AE = '命名空间：`check-tp-prose.mjs` 的 json 散文白名单按 `audioEvidence.` 前缀整体覆盖 + 数值自洽 pass（叶名在正则字面量里、剥注释后不可见 ⇒ match 指向命名空间 token `audioEvidence`）';
/** 命名空间式覆盖：同上，但前缀是 `selfCheck.audio.`（token 用 `selfCheck`）。 */
const R_NS_SCA = '命名空间：`check-tp-prose.mjs` 的 json 散文白名单按 `selfCheck.audio.` 前缀整体覆盖 + 数值自洽 pass（叶名不可见 ⇒ match 指向命名空间 token `selfCheck`）';
// ★★ 判据③ 三档 reason 常量（见头注释 ③）：**必须说清是哪一档 + 为什么**。
/** `unverifiable` —— 运行时 / 流程读数：口径不明或无可对真值。 */
const R_UNV_RUNTIME = '**不可核**：运行时 / 流程读数（口径不明或无可对真值）；`check-selfcheck-claims.mjs` 头注释「有意不核」逐条给过理由；**全仓无闸门读**、也**无独立权威对照物** ⇒ 如实标注不可核';
/** `unverifiable` —— 测量值出自「被否决开工」的失败 run（日志已被覆盖）。 */
const R_UNV_FAILED = '**不可核**：测量值出自**「被否决开工」的失败 run**（`_distill/logs/<slug>.log` 已被失败运行覆盖 —— 见 `_distill/无闸门字段内容审计-2026-10-08.md` 观察①）⇒ 记录来源已失效、**无可对日志 / 实物复核**；要核**需实跑重测** ⇒ **不计为可补的真缺口**';
/** `unverifiable` —— 单风格特例；唯一「对照物」是自由散文或自身内部派生。 */
const R_UNV_SINGLE = '**不可核**：单风格特例读数；唯一「对照物」是 `lib/style-dna/*` 的**自由散文**（核它等于核散文）或**自身内部派生** ⇒ **无独立权威对照物**';
/** `unverifiable` —— 对照物是 `lines.json`（渲染产物、不在本仓）。 */
const R_UNV_NOLINES = '**不可核**：对照物是 `lines.json`（**渲染产物、不在本仓**）；本风格 run 日志已被失败运行覆盖 ⇒ 权威**不可持久获得**';

// ── ★★ 登记表（`FIELDS`）—— 详见头注释 ②③④⑧ ────────────────────────────────
//   每条：字段路径 → { coveredBy, match?, verifiability?, reason }。
//     · `coveredBy: '<闸门名>'` ⇒ 判据② 守着它（`scripts/<闸门名>.mjs` 必须在，且**剥注释后**有 token）。
//     · `coveredBy: null` + `verifiability` + `reason` ⇒ 判据③ **只列 ℹ、不判 FAIL**（=「本闸门认了：没有闸门读它」）；
//       `verifiability` 三档：`'value'` 值级可核 / `'claim'` 声称级可核 / `'unverifiable'` 不可核（判据⑤ 守住格式）。
//     · `match` 缺省 = 字段路径的**叶名**；命名空间 / 清单式覆盖时指向承载覆盖的 token（见头注释 ④）。
//   ★ 登记表是**照真实数据建的**（`_distill.json` 里出现的每条路径都在此有且仅有一个决定）。
const FIELDS = {
  'assetGaps': { coveredBy: 'check-aspect-prose.mjs', match: 'JSON_FIELDS', reason: '`check-aspect-prose.mjs` 的 `JSON_FIELDS` 清单（含 `limits` / `defects` / `assetGaps` / `resolvedDefects` / `selfCheck.warnings`）扫它；★ 字段名以**字符串字面量**出现（剥注释时被剥掉）⇒ match 指向承载该清单的 token `JSON_FIELDS`' },
  'audioEvidence': { coveredBy: 'check-tp-prose.mjs', reason: '命名空间：json 散文白名单 `/^audioEvidence\\./` + 数值自洽 pass' },
  'audioEvidence.alignment': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.caliberNote': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.changed': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.changed[].diffSec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.changed[].id': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.changed[].new': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.changed[].old': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.conclusion': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.maxDiffFrames24': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.maxDiffSec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.maxDiffSecUpperBound': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.reference': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.totalLines': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.alignment.zeroDiffLines': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.firstVersionDefect': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.firstVersionDefect.cause': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.firstVersionDefect.filmAacMeanMaxDb': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.firstVersionDefect.fixedAt': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.firstVersionDefect.integratedLufs': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.firstVersionDefect.mixWavMeanMaxDb': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.firstVersionDefect.peak': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.firstVersionDefect.peakDbfs': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.firstVersionDefect.rms': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.foley': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.astatsPeak6dp': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.astatsPeakPerChannel': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.clippingCriterion': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.integratedLufs': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.lra': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.note': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.overshootVsLnTpDb': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.samplePeakDbfs': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.truePeakDbfs': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.truePeakDbtp': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.measuredInFilm.truePeakMethod': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.bytes': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.channels': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.codec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.durSec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.maxVolumeDb': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.md5': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.meanVolumeDb': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.measuredBeforeMux': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.measuredBeforeMux.integratedLufs': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.measuredBeforeMux.lra': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.measuredBeforeMux.peakDbfs': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.note': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.path': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mix.sampleRate': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.beatGridCheck': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.jump': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.jump.aSec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.jump.bSec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.jump.chromaSimilarity': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.jump.lagSec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.license': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.mp3': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.mp3.bytes': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.mp3.md5': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.mp3.path': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.nbeats': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.scoreWav': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.scoreWav.bytes': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.scoreWav.channels': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.scoreWav.codec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.scoreWav.durSec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.scoreWav.sampleRate': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.source': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.sourceUrlInPrepSh': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.tempo': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.track': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.tracks': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wf48Wav': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wf48Wav.bytes': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wf48Wav.channels': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wf48Wav.durSec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wf48Wav.sampleRate': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wildflowersWav': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wildflowersWav.bytes': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wildflowersWav.channels': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wildflowersWav.durSec': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.music.wildflowersWav.sampleRate': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mux': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mux.encoder': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mux.loudnorm': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mux.script': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.mux.videoUnchanged': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.issue': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.measuredOvershootDb': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.measuredOvershootDb.brick-toy': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.measuredOvershootDb.game-show': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.measuredOvershootDb.paper-lantern': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.measuredOvershootDb.paper-popup': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.measuredOvershootDb.pictogram-motion': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.measuredOvershootDb.watercolor': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.note': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.projectLevelRisk.source': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.voice': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.voice.asrCheck': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.voice.durationCheck': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.voice.engine': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.voice.files': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.voice.generator': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.voice.lines': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioEvidence.voice.wasEngine': { coveredBy: 'check-tp-prose.mjs', match: 'audioEvidence', reason: R_NS_AE },
  'audioScoreBasis': { coveredBy: 'check-selfcheck-claims.mjs', reason: '★ 2026-10-08 更新：**已被 `check-selfcheck-claims.mjs` 判据 G 覆盖** —— 散文里**首个**「audio N/20」↔ 权威 `scoreBreakdown.audio`；不等时要求「显式锚定权威值 + 更正/历史标记」，缺一 FAIL（token = 叶名 `audioScoreBasis`，出现在该闸门代码 `j.audioScoreBasis`）。★ 此前本表标 `coveredBy: null`（可核·值级·待补）**已过期**。★ 该字段里的 `input_tp` 读数仍是时点参考（`check-tp-prose.mjs` 降级为参考）—— 那一层不核' },
  'defects': { coveredBy: 'check-skill-scores.mjs', reason: '判据② `defects` 里不得有「能被当前配置值直接证伪」的条目' },
  'distilledAt': { coveredBy: null, verifiability: 'unverifiable', reason: '**不可核**：蒸馏时间戳（**时点**）；仅 `lib/style-skill-reader.mjs` 透传（**非闸门**）⇒ 无独立权威对照物可核该时点' },
  'evidenceFrames': { coveredBy: 'check-skill-artifacts.mjs', reason: '帧图文件必须真的存在（逐帧分析的凭据）' },
  'generatedVideo': { coveredBy: 'check-skill-artifacts.mjs', reason: '命名空间' },
  'generatedVideo.bytes': { coveredBy: 'check-skill-artifacts.mjs', reason: '与磁盘 `size` 比对（±1024 B）' },
  'generatedVideo.bytesNote': { coveredBy: 'check-tp-prose.mjs', match: 'generatedVideo', reason: 'json 散文白名单（`/^generatedVideo\\.bytesNote$/`；正则字面量 ⇒ match 指向命名空间）' },
  'generatedVideo.durSec': { coveredBy: 'check-skill-artifacts.mjs', reason: '与 ffprobe `format.duration` 比对（±0.05 s）' },
  'generatedVideo.fps': { coveredBy: 'check-skill-artifacts.mjs', reason: '与 ffprobe `r_frame_rate` 比对（±0.01）' },
  'generatedVideo.frames': { coveredBy: 'check-skill-artifacts.mjs', reason: '与 ffprobe `-count_frames` 比对' },
  'generatedVideo.height': { coveredBy: 'check-skill-artifacts.mjs', reason: '与 ffprobe 视频流高比对' },
  'generatedVideo.path': { coveredBy: 'check-skill-artifacts.mjs', reason: '成片路径：存在性 + 后续全部实测比对的前提' },
  'generatedVideo.width': { coveredBy: 'check-skill-artifacts.mjs', reason: '与 ffprobe 视频流宽比对' },
  'limits': { coveredBy: 'check-aspect-prose.mjs', match: 'JSON_FIELDS', reason: '同 assetGaps：在 `check-aspect-prose.mjs` 的 `JSON_FIELDS` 清单里（`limits` 的论述句与画幅能力声明对账）' },
  'matchScore': { coveredBy: 'check-skill-scores.mjs', reason: '判据① `matchScore == scoreBreakdown` 五项之和 + ③ 与 `SKILL.md` 自评一致' },
  'muxPatch': { coveredBy: 'check-mux-parity.mjs', reason: '第二段：`muxPatch` 声称 ↔ 文件现状' },
  'muxPatch.appliedAt': { coveredBy: 'check-mux-parity.mjs', reason: '打补丁时间（只列 note）' },
  'muxPatch.patchedFile': { coveredBy: 'check-mux-parity.mjs', reason: '被补丁文件路径（存在性 + 已打补丁特征）' },
  'muxPatch.reason': { coveredBy: 'check-mux-parity.mjs', reason: '补丁原因（只列 note）' },
  'muxPatch.revert': { coveredBy: 'check-mux-parity.mjs', reason: '回退方式（只列 note）' },
  'muxPatch.script': { coveredBy: 'check-mux-parity.mjs', reason: '被补丁脚本路径（存在性 + 现状复核）' },
  'muxPatch.verifiedAfter': { coveredBy: 'check-mux-parity.mjs', reason: '补丁后成功读数（只列 note）' },
  'muxPatch.verifiedBefore': { coveredBy: 'check-mux-parity.mjs', reason: '补丁前失败读数（只列 note）' },
  'nameZh': { coveredBy: null, verifiability: 'unverifiable', reason: '**不可核**：纯人读中文名，全仓无读者、**无独立权威对照物**' },
  'resolvedDefects': { coveredBy: 'check-aspect-prose.mjs', match: 'JSON_FIELDS', reason: '在 `check-aspect-prose.mjs` 的 `JSON_FIELDS` 清单里（另 `check-tp-prose.mjs` 的 json 散文 REF 白名单也读作「参考」）' },
  'scoreBreakdown': { coveredBy: 'check-skill-scores.mjs', reason: '五项求和的载体' },
  'scoreBreakdown.audio': { coveredBy: 'check-skill-scores.mjs', match: 'scoreBreakdown', reason: '五项之一（键名在 `KEYS` 字符串数组里 ⇒ 叶名被剥掉）' },
  'scoreBreakdown.composition': { coveredBy: 'check-skill-scores.mjs', match: 'scoreBreakdown', reason: '五项之一（键名在 `KEYS` 字符串数组里 ⇒ 叶名被剥掉）' },
  'scoreBreakdown.palette': { coveredBy: 'check-skill-scores.mjs', match: 'scoreBreakdown', reason: '五项之一（键名在 `KEYS` 字符串数组里 ⇒ 叶名被剥掉）' },
  'scoreBreakdown.rhythm': { coveredBy: 'check-skill-scores.mjs', match: 'scoreBreakdown', reason: '五项之一（键名在 `KEYS` 字符串数组里 ⇒ 叶名被剥掉）' },
  'scoreBreakdown.typography': { coveredBy: 'check-skill-scores.mjs', match: 'scoreBreakdown', reason: '五项之一（键名在 `KEYS` 字符串数组里 ⇒ 叶名被剥掉）' },
  'selfCheck': { coveredBy: 'check-selfcheck-claims.mjs', reason: '命名空间（该闸门核 `selfCheck` 里「对实物可核的声称」）' },
  'selfCheck.asrMismatches': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_NOLINES },
  'selfCheck.asrNote': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_NOLINES },
  'selfCheck.audio': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: '命名空间：json 散文白名单 `/^selfCheck\\.audio\\./` + 数值自洽 pass' },
  'selfCheck.audio.astatsPeakDb': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.beats': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.bpm': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.deliveryTargetDbtp': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.eventHitRate': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.events': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.filmLra': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.filmLufs': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.filmSamplePeakDbfs': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.filmTruePeakDbtp': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.finalHit': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.integratedLufs': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.loudnessTargetLufs': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.loudnormPasses': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.loudnormTpTarget': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.lra': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.measuredBy': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixLra': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixLufs': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixMd5': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixPyMd5': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixPyRollback': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixTruePeakDbfs': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixTruePeakDbtp': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixWav': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixWav.bytes': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixWav.channels': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixWav.durSec': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixWav.lufs': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixWav.rate': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixWav.truePeakDbtp': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.mixWavBytes': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicLicense': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicTracks': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicWav': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicWav.astatsPeakDb': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicWav.bytes': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicWav.channels': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicWav.durSec': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicWav.lufs': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicWav.rate': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.musicWav.truePeakDbtp': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.note': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.oldAudioLufs': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.overByDb': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.peakNote': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.repriseDownbeatSong': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.scoreWavBytes': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.titleFix': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.truePeakDbtp': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.truePeakDbtpNote': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.truePeakJudge': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.truePeakLimitDbtp': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.truePeakMethod': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.voiceChain': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.voices': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.voices.channels': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.voices.count': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.voices.durRangeSec': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.voices.peakRange': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.voices.rate': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.voicesAsrOk': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audio.voicesWav': { coveredBy: 'check-tp-prose.mjs', match: 'selfCheck', reason: R_NS_SCA },
  'selfCheck.audioRenderParallelSec': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_RUNTIME },
  'selfCheck.clippedSamples': { coveredBy: 'check-selfcheck-claims.mjs', reason: '★ 2026-10-08 更新：**已被 `check-selfcheck-claims.mjs` 判据 H2 覆盖** —— `=== 0` ⇒ `loudness.{samplePeakDbfs,truePeakDbtp}` 必须 ≤ 0（物理不可能关系）；token = 叶名 `clippedSamples`（该闸门代码 `sc.clippedSamples`）。此前标 `coveredBy: null`（可核·值级·待补）**已过期**' },
  'selfCheck.events': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_RUNTIME },
  'selfCheck.fps': { coveredBy: 'check-selfcheck-claims.mjs', reason: '与 `generatedVideo.fps` 一致' },
  'selfCheck.frames': { coveredBy: 'check-selfcheck-claims.mjs', reason: '与 `generatedVideo.frames` 一致' },
  'selfCheck.grain': { coveredBy: null, verifiability: 'value', reason: '**可核·值级**：**对 mux 调用的末位参数**（`_distill/logs/<slug>.log` 的 `混流 … grain N` 行 + `SKILL.md` 记录的 mux 命令）可机械核；**尚无闸门核** ⇒ **真缺口（待补）**；实测本库全对' },
  'selfCheck.loudness': { coveredBy: 'check-film-delivery.mjs', reason: '命名空间（A/B/C 类音频口径）' },
  'selfCheck.loudness.ebur128PeakDbfs': { coveredBy: null, verifiability: 'value', reason: '**可核·值级**：**派生自 `selfCheck.loudness.truePeakDbtp`**（`round(truePeakDbtp,1)`）可机械核；`check-tp-prose.mjs` 的 `JSON_NUM_DIM` 虽含此名，但数值 pass 只扫 `selfCheck.audio.*` / `audioEvidence.*` ⇒ **当前无闸门读** ⇒ **真缺口（待补）**；实测 pixel-rpg `−1.7 == round(−1.72,1)`' },
  'selfCheck.loudness.integratedLufs': { coveredBy: 'check-film-delivery.mjs', reason: 'A 类：与实测 `input_i` 比对 + C 类：实测必须落在 −14 LUFS ± 容差' },
  'selfCheck.loudness.lra': { coveredBy: 'check-film-delivery.mjs', reason: 'A 类：与 ebur128 / loudnorm 两来源之一匹配（另 `check-lra-caliber.mjs` 专核口径）' },
  'selfCheck.loudness.lraMethod': { coveredBy: 'check-selfcheck-claims.mjs', reason: '★ 2026-10-08 更新：**已被 `check-selfcheck-claims.mjs` 判据 F 覆盖** —— 口径声明串必须命中 `CALIBER_REGISTRY.lraMethod`（本片实跑口径的白名单），未登记 ⇒ FAIL + 点名 slug + 实际串；token = 叶名 `lraMethod`（该闸门 `CALIBER_REGISTRY` 的**对象键**）。此前标 `coveredBy: null`（可核·声称级·待补）**已过期**' },
  'selfCheck.loudness.masterPeakMatched': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_SINGLE + '（实际只出现在 `pixel-rpg`，且其 run 是失败 run）' },
  'selfCheck.loudness.masterPeakTarget': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_SINGLE + '（只出现在 `pixel-rpg`）' },
  'selfCheck.loudness.masterPeakTargetDbfs': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_SINGLE + '（只出现在 `pixel-rpg`）' },
  'selfCheck.loudness.measuredFrom': { coveredBy: 'check-distill-fields.mjs', reason: '★ 2026-10-08 新增：**读数测的是哪一份产物**的声明（枚举 `local-copy` / `published-film`）。判据⑥ 逐份核「存在 + 值在枚举内」，缺 / 枚举外 ⇒ FAIL 并点名 slug（token = 叶名 `measuredFrom`，出现在本闸门判据⑥ 代码 `L.measuredFrom`）。★ 由来：第 113~116 批连续四批把**本地副本读数**当**权威 artifact（已发布影片）** ⇒ 撤错扣分 / 把已发布规格当陈旧「修」掉' },
  'selfCheck.loudness.measuredPath': { coveredBy: 'check-distill-fields.mjs', reason: '★ 2026-10-08 新增：来源**路径**（可读值；local-copy 时为 `D:/lemo-films/<slug>/<slug>.mp4`）。判据⑥：若在，须是非空字符串；且 measuredFrom === local-copy 时须等于 `D:/lemo-films/<slug>/<slug>.mp4`（防「随便写个字符串」；token = 叶名 `measuredPath`，出现在本闸门判据⑥ 代码 `L.measuredPath`）' },
  'selfCheck.loudness.mixWavPeak': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED + '（上游 `mix.wav` 读数）' },
  'selfCheck.loudness.peakDbtpTarget': { coveredBy: 'check-tp-prose.mjs', reason: '交付线本身（用于排除「阈值提及」误报）' },
  'selfCheck.loudness.peakNote': { coveredBy: 'check-tp-prose.mjs', match: 'loudness', reason: 'json 散文白名单（`/^selfCheck\\.loudness\\.peakNote$/`）+ (J5) 覆盖级自洽；正则字面量 ⇒ match 指向命名空间 `loudness`' },
  'selfCheck.loudness.peakTargetMet': { coveredBy: 'check-film-delivery.mjs', reason: 'B 类：布尔必须与实测「是否 ≤ 交付线」一致' },
  'selfCheck.loudness.samplePeakDbfs': { coveredBy: 'check-tp-prose.mjs', reason: 'dBFS 量纲真值之一 + 物理约束（采样峰值 ≤ 真峰值）' },
  'selfCheck.loudness.targetLufsInStyleDna': { coveredBy: null, verifiability: 'value', reason: '**可核·值级**：**跨文件对 `lib/style-dna-reader.mjs` 解析出的 `targetLufs`** 可机械核（`check-loudness-targets.mjs` 已证 43/43 可解析 −14）；**尚无闸门核本字段** ⇒ **真缺口（待补）**；实测 pixel-rpg 现值 `null` 与现状不符' },
  'selfCheck.loudness.targetLufsNote': { coveredBy: null, verifiability: 'claim', reason: '**可核·声称级**：跨文件**散文**，可对 style-dna 现状（`lib/style-dna-reader.mjs` 解析结果）机械核；**尚无闸门读它** ⇒ **真缺口（待补）**；实测 pixel-rpg 现值与现状不符' },
  'selfCheck.loudness.truePeakDbtp': { coveredBy: 'check-film-delivery.mjs', reason: 'A 类：与实测 `input_tp` 比对 + C 类：实测必须 ≤ −1.2 dBTP' },
  'selfCheck.loudness.truePeakMethod': { coveredBy: 'check-selfcheck-claims.mjs', reason: '★ 2026-10-08 更新：**已被 `check-selfcheck-claims.mjs` 判据 F 覆盖** —— 口径声明串必须命中 `CALIBER_REGISTRY.truePeakMethod`（本片实跑命令的白名单），未登记 ⇒ FAIL + 点名 slug + 实际串；token = 叶名 `truePeakMethod`（该闸门 `CALIBER_REGISTRY` 的**对象键**）。此前标 `coveredBy: null`（可核·声称级·待补）**已过期**' },
  'selfCheck.muxEncoder': { coveredBy: 'check-selfcheck-claims.mjs', reason: '★ 项目第一硬规则「渲染一律 GPU 优先」在 json 侧的落点：声称 vs 成片 `encoder` tag（**达标** + 自洽）' },
  'selfCheck.nativeResolution': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_SINGLE + '（只出现在 `pixel-rpg`；唯一对照物是 `SKILL.md` 的散文「原生 320×180 ×6 最近邻」）' },
  'selfCheck.onsetErrorsMs': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.onsetErrorsMs.32.0': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.onsetErrorsMs.32.25': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.onsetErrorsMs.32.5': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.onsetErrorsMs.32.75': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.onsetErrorsMs.33.0': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.onsetErrorsMs.33.25': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.onsetErrorsMs.33.5': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.onsetErrorsMs.33.75': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.preflight': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_RUNTIME },
  'selfCheck.ratio': { coveredBy: 'check-selfcheck-claims.mjs', reason: '★ 2026-10-08 更新：**已被 `check-selfcheck-claims.mjs` 判据 H1 覆盖** —— ↔ `generatedVideo.{width,height}` 比例（容差 0.01；缺一边则跳过）；token = 叶名 `ratio`（该闸门代码 `sc.ratio`）。此前标 `coveredBy: null`（可核·值级·待补）**已过期**' },
  'selfCheck.renderSec': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_RUNTIME + '（**孤儿字段**：全仓无生产者、无读者）' },
  'selfCheck.rendered': { coveredBy: null, verifiability: 'unverifiable', reason: '**不可核**：**流程声称**「已渲染」；成片存在只证明「有片子」、**不证明本次 run 渲过** ⇒ 无独立权威对照物（真实性由 `check-skill-artifacts` 的成片存在性**隐式**覆盖，无独立读者）' },
  'selfCheck.sectionHfRelDb': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.sectionHfRelDb.A_savepoint': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.sectionHfRelDb.B_village': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.sectionHfRelDb.C_campfire': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.sectionHfRelDb.D_battle': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.sectionHfRelDb.E_lament_drain': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.sectionHfRelDb.F_present': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.sectionHfRelDb.G_lastdoor': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.sectionHfRelDb.H_coda': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.sectionHfRelDb.encounter': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.silenceWindowSec': { coveredBy: null, verifiability: 'value', reason: '**可核·值级**：**对 `_distill/logs/one-line.log` 的 `score.wav … \'silence\': […]` 行**（持久日志）可机械核；**尚无闸门核** ⇒ **真缺口（待补）**；实测 `[24.6,26.85]` 与日志逐字一致' },
  'selfCheck.silenceWindows': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.silenceWindows[].note': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.silenceWindows[].peakDb': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.silenceWindows[].range': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.size': { coveredBy: 'check-selfcheck-claims.mjs', reason: '解析 `WxH` 后与 `generatedVideo.width/height` 一致' },
  'selfCheck.skipSync': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_RUNTIME },
  'selfCheck.spriteFps': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.srtCues': { coveredBy: 'check-selfcheck-claims.mjs', reason: '与成片同名 `.srt` 的实际 cue 数一致' },
  'selfCheck.totalSec': { coveredBy: null, verifiability: 'unverifiable', reason: '**不可核**：**口径不明**（实测与 `generatedVideo.durSec` **本来就不同**：`one-line` 67.1 vs 47.5）⇒ 拿 `durSec` 判它是**凭猜收窄**；且**全仓无生产者、无读者**（孤儿字段）' },
  'selfCheck.ttsRan': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_RUNTIME },
  'selfCheck.usedPreGeneratedAudio': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_RUNTIME + '（流程声称）' },
  'selfCheck.voiceBedDiffDb': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_FAILED },
  'selfCheck.voiceLineNote': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_NOLINES },
  'selfCheck.voiceLines': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_NOLINES },
  'selfCheck.warnings': { coveredBy: 'check-aspect-prose.mjs', match: 'JSON_FIELDS', reason: '在 `check-aspect-prose.mjs` 的 `JSON_FIELDS` 清单里（`selfCheck.warnings[]` 的论述句扫画幅声称）；另 `check-tp-prose.mjs` 的 json 散文 REF 白名单也读作「参考」' },
  'selfCheck.workers': { coveredBy: null, verifiability: 'unverifiable', reason: R_UNV_RUNTIME },
  'slug': { coveredBy: null, verifiability: 'unverifiable', reason: '**不可核**：风格标识，与**目录名同义**（闸门按目录名枚举、`lib/style-skill-reader.mjs` 也只认目录名）⇒ **无独立权威对照物**（核它 = 核目录名自身，冗余、无消费者）' },
  'sources': { coveredBy: 'check-sources-paths.mjs', match: 'sources', reason: '★ 2026-10-08 **修正过期条目**：本字段**已被闸门 `check-sources-paths.mjs` 覆盖**（读 `json.sources`、逐条核引用的路径是否真实存在；实测 585 条 / exit 0）。此前登记为 `coveredBy: null` 是**过期**——该闸门 2026-10-08 00:40 才建，晚于本登记表的 2026-10-07 23:18 快照（`check-aspect-prose.mjs`「不扫 sources」的旧理由已被这条专门闸门取代）' },
};

// ── ★ 枚举：整份 json、对象递归、数组元素对象加 `[]` 后缀 ────────────────────
//   ★ 规则**与生成登记表时逐字一致**（否则登记表与真实数据会漂移成两套口径）。
//   ★ 不是 AST：只认「对象键 + 数组元素对象的**首元素**」；空数组贡献 0 个子路径（见头注释「已知局限」）。
function walk(obj, prefix, out) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return;
  for (const k of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    out.add(p);
    if (Array.isArray(v)) { if (v.length && v[0] !== null && typeof v[0] === 'object') walk(v[0], `${p}[]`, out); }
    else if (v !== null && typeof v === 'object') walk(v, p, out);
  }
}

/** 枚举风格树下的所有 slug（只认「目录里真有 `_distill.json`」的目录；同 `check-selfcheck-claims.mjs`）。 */
const slugs = [];
try {
  for (const e of fs.readdirSync(DIR, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (!fs.existsSync(path.join(DIR, e.name, '_distill.json'))) continue;
    slugs.push(e.name);
  }
} catch { /* `DIR` 不存在 ⇒ `slugs` 为空 ⇒ 走失明守卫（见判据④） */ }
slugs.sort();

/** 真实数据里的字段路径 → 出现在哪些 slug（`Map<path, Set<slug>>`）。 */
const real = new Map();
/** 解析好的 json（`slug → json`）—— 供判据⑥ 复用，避免二次读盘（坏的进 `badJson`、不在这里）。 */
const parsed = new Map();
const badJson = [];                                    // ℹ：读不到 / JSON 坏的（会让 real 变小 ⇒ 输出里显式列出）
for (const slug of slugs) {
  const f = path.join(DIR, slug, '_distill.json');
  let txt;
  try { txt = fs.readFileSync(f, 'utf8'); } catch (e) { badJson.push({ slug, why: `读不到（${(e && e.message) || e}）` }); continue; }
  let json;
  try { json = JSON.parse(txt); } catch (e) { badJson.push({ slug, why: `JSON 解析失败（${(e && e.message) || e}）` }); continue; }
  parsed.set(slug, json);
  const set = new Set();
  walk(json, '', set);
  for (const p of set) { if (!real.has(p)) real.set(p, new Set()); real.get(p).add(slug); }
}

// ── 判据 ①：未登记 ⇒ FAIL ──────────────────────────────────────────────────
const unregistered = [...real.keys()].filter((p) => !FIELDS[p]).sort();

// ── 判据 ②：登记了但闸门不在了 ⇒ FAIL ──────────────────────────────────────
//   ★ 语义（头注释 ② 的「变异 C」）：**只看闸门在不在、token 在不在** ——
//     字段本身从数据里消失**不**触发它（字段不存在 ≠ 闸门不在）。
//   ★ token 用**标识符边界**判（不是 `includes`）：否则 `loudness` 会被 `loudnessX` 骗过（同
//     `check-env-overrides.mjs` 判据② 的收窄理由）。
const LEAF = (p) => p.split('.').pop().replace(/\[\]$/, '');
const tokenRe = (t) => new RegExp(`(?<![A-Za-z0-9_$])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_$])`);
const gateCache = new Map();
/** 读 `scripts/<name>.mjs` 并**剥注释 / 字符串**；返回 `{ok, code}` 或 `{ok:false, why}`。 */
const readGateCode = (name) => {
  if (gateCache.has(name)) return gateCache.get(name);
  const p = path.join(ROOT, 'scripts', name);
  let v;
  if (!fs.existsSync(p)) v = { ok: false, why: `\`scripts/${name}\` **不存在**` };
  else {
    try { v = { ok: true, code: codeOnly(fs.readFileSync(p, 'utf8')) }; }
    catch (e) { v = { ok: false, why: `\`scripts/${name}\` 读不到（${(e && e.message) || e}）` }; }
  }
  gateCache.set(name, v);
  return v;
};
const gone = [];                                       // {path, gate, tok, why}
for (const [p, ent] of Object.entries(FIELDS)) {
  if (!ent || !ent.coveredBy) continue;                // `coveredBy: null` ⇒ 判据③ 那一档
  const name = ent.coveredBy;
  const tok = ent.match || LEAF(p);
  const g = readGateCode(name);
  if (!g.ok) { gone.push({ path: p, gate: name, tok, why: g.why }); continue; }
  if (!tokenRe(tok).test(g.code)) {
    gone.push({ path: p, gate: name, tok,
      why: `\`scripts/${name}\` 的**剥注释 / 字符串后**文本里已找不到 token \`${tok}\``
        + '（**闸门被删 / 改名 / 换了写法**，或它已不再处理这个命名空间 / 清单）' });
  }
}

// ── 判据 ③：登记为「无闸门」⇒ 只列 ℹ（不判 FAIL）；★ 按**可核性**分三档 ──────
//   ★★ 三档（见头注释 ③）：`value` / `claim` = **可核但尚无闸门**（= 真缺口，该补）；
//      `unverifiable` = **根本没有权威对照物**（如实标注，不假装能覆盖）。
const noGate = Object.entries(FIELDS).filter(([, e]) => !e || !e.coveredBy);
const TIER = { value: '可核·值级', claim: '可核·声称级', unverifiable: '不可核' };
const valueNoGate = noGate.filter(([, e]) => e && e.verifiability === 'value');
const claimNoGate = noGate.filter(([, e]) => e && e.verifiability === 'claim');
const unverifiable = noGate.filter(([, e]) => e && e.verifiability === 'unverifiable');
const verifiableNoGate = [...valueNoGate, ...claimNoGate];
/** ★ 判据⑤（登记表自洽性）：每条「无闸门」条目**必须**带合法 `verifiability`（否则三档计数会静默失真）。 */
const badTier = noGate.filter(([, e]) => !(e && TIER[e.verifiability]));

// ── 判据 ⑥：`selfCheck.loudness` 必须声明**读数测的是哪一份产物**（第 113~116 批的根因混淆）──
//   ★ 由来：`selfCheck.loudness` 的读数测的是**本地副本**（`D:/lemo-films/<slug>/<slug>.mp4`），
//     而项目学说（`D:/lemo-opuscar/MAINTAINING.md`「The published film carries the pre-fix audio」）
//     的**权威 artifact 是已发布影片**；字段本身不写这件事 ⇒ 把本地读数当权威 ⇒ 撤错扣分 /
//     把已发布规格当陈旧「修」掉 / 拿本地读数判「达标」而发布片其实超标（已实测 37/43 发布片 > −1.2 dBTP）。
//   ★ 判据（逐份）：① `selfCheck.loudness` 必须存在且是对象；② 必须带 `measuredFrom`；
//     ③ `measuredFrom` 必须在 `MEASURED_FROM_ENUM` 内（枚举外 ⇒ FAIL，防「随便写个字符串糊过去」）；
//     ④ `measuredPath` 若在 ⇒ 须是非空字符串，且 `measuredFrom === 'local-copy'` 时须等于
//        `D:/lemo-films/<slug>/<slug>.mp4`（防路径写错 / 乱写）。
//   ★ 语义边界（如实写）：这是**存在级 + 枚举级**判据 —— 它保证「来源**被声明了**且值合法」，
//     **不**保证「声明为真」（读数到底出自哪个文件，仓内无法机械复核 —— 见头注释「已知局限」）。
const MEASURED_FROM_ENUM = ['local-copy', 'published-film'];
const measuredFails = [];                              // {slug, why}
for (const slug of slugs) {
  const json = parsed.get(slug);
  if (!json) continue;                                 // 读不到 / JSON 坏 ⇒ 已在 `badJson` 列过
  const L = json.selfCheck && json.selfCheck.loudness;
  if (!L || typeof L !== 'object' || Array.isArray(L)) {
    measuredFails.push({ slug, why: '`selfCheck.loudness` 缺失 / 不是对象 ⇒ 无法声明读数测的是哪一份产物' });
    continue;
  }
  const mf = L.measuredFrom;
  if (mf === undefined) { measuredFails.push({ slug, why: '缺 `selfCheck.loudness.measuredFrom`（读数测的是哪一份产物？）' }); continue; }
  if (!MEASURED_FROM_ENUM.includes(mf)) {
    measuredFails.push({ slug, why: `\`measuredFrom\` = ${JSON.stringify(mf)} **不在枚举** ${JSON.stringify(MEASURED_FROM_ENUM)} 内` });
    continue;
  }
  if (L.measuredPath !== undefined) {
    if (typeof L.measuredPath !== 'string' || L.measuredPath === '') {
      measuredFails.push({ slug, why: `\`measuredPath\` 必须是非空字符串，实为 ${JSON.stringify(L.measuredPath)}` });
    } else if (mf === 'local-copy') {
      const want = `D:/lemo-films/${slug}/${slug}.mp4`;
      if (L.measuredPath !== want) {
        measuredFails.push({ slug, why: `\`measuredFrom: 'local-copy'\` 但 \`measuredPath\` = ${JSON.stringify(L.measuredPath)} ≠ \`${want}\`` });
      }
    }
  }
}

// ── 判据 ④：失明守卫（防空转绿灯）──────────────────────────────────────────
const blind = [];
if (slugs.length === 0) blind.push(`\`${DIR}\` 下一个风格都没枚举到（路径 / 过滤变了？）⇒ 一个字段都没检查过`);
if (real.size === 0) blind.push('真实数据里一条字段路径都没枚举到（枚举规则 / json 结构变了？）⇒ 判据①② 都会**空转**');
if (Object.keys(FIELDS).length === 0) blind.push('`FIELDS` 登记表为空 ⇒ 判据① 会把全部字段报成未登记、判据② 一条都没检查');

// ── 输出 ────────────────────────────────────────────────────────────────────
const nCov = Object.keys(FIELDS).length - noGate.length;
const ok = unregistered.length === 0 && gone.length === 0 && blind.length === 0 && badTier.length === 0 && measuredFails.length === 0;

if (JSON_OUT) {
  console.log(JSON.stringify({
    root: ROOT,
    distillRoot: DIR,
    scope: { styles: slugs.length, fieldPaths: real.size, registered: Object.keys(FIELDS).length,
      covered: nCov, noGate: noGate.length, badJson: badJson.length },
    verdict: { value: valueNoGate.length, claim: claimNoGate.length,
      verifiableNoGate: verifiableNoGate.length, unverifiable: unverifiable.length, badTier: badTier.length,
      measuredFromFails: measuredFails.length },
    unregistered,
    gone,
    measuredFails,
    verifiableNoGate: verifiableNoGate.map(([p, e]) => ({ path: p, verifiability: e.verifiability, tier: TIER[e.verifiability], reason: e.reason })),
    unverifiable: unverifiable.map(([p, e]) => ({ path: p, verifiability: e.verifiability, reason: e.reason })),
    badTier: badTier.map(([p, e]) => ({ path: p, verifiability: (e && e.verifiability) || null })),
    blind,
    ok,
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
  process.exit();
}

console.log(`风格树 : ${DIR}`);
console.log(`仓根   : ${ROOT}（判据② 找 \`scripts/<闸门>.mjs\`；剥注释 / 字符串的状态机照抄 \`check-env-overrides.mjs\`）`);
console.log('范围   : 每份 `<slug>/_distill.json` 的**全部**字段路径（对象递归；数组元素对象加 `[]` 后缀）');
console.log(`       实测 ${slugs.length} 个风格 / ${real.size} 条去重字段路径 / 登记 ${Object.keys(FIELDS).length} 条`
  + `（有闸门 ${nCov} / 无闸门 ${noGate.length}）`);
if (badJson.length) {
  console.log(`ℹ 有 ${badJson.length} 份 \`_distill.json\` 没读进来（会让上面「实测」偏小）：`);
  for (const b of badJson) console.log(`   · ${b.slug} —— ${b.why}`);
}
console.log('');

// ★ 失明消息**放在最前**（否则会被下面成片的 ✘ 淹没；失明时「0 条未登记」是假的）。
if (blind.length) {
  console.log('✘✘ 本闸门已**失明**：');
  for (const b of blind) console.log(`   ✘ ${b}`);
  console.log('   ⇒ 「0 条未登记」是**假的**，别信这个绿。请先修路径 / 枚举规则 / 登记表，再信本闸门的结论。');
  console.log('   ⇒ 已失明 ⇒ 判据①② 本次**不输出**：在失明的树上它们只会刷屏，且会被误读成「字段有问题」。');
  console.log('');
  console.log('[闸门] _distill.json 字段登记：**已失明** ⇒ 一条判据都没可信地跑过 ✘');
  process.exitCode = 1;
  process.exit();
}

if (unregistered.length) {
  console.log(`✘ 判据①·有 ${unregistered.length} 条**未登记**的字段路径（新字段要登记进 \`FIELDS\`）：`);
  for (const p of unregistered) console.log(`   ✘ ${p}   ←  出现在 ${[...real.get(p)].sort().join(', ')}/_distill.json`);
  console.log('   ↳ 修法：给它一个**明确的决定** —— 有闸门读它 ⇒ `coveredBy: \'<scripts 里的闸门名>\'`（必要时加 `match`）；');
  console.log('     确实没有 ⇒ `coveredBy: null` + **`verifiability`** + `reason`（**只列 ℹ、不判 FAIL**）——');
  console.log('     `verifiability` 三档：`\'value\'` 值级可核 / `\'claim\'` 声称级可核 / `\'unverifiable\'` 不可核（见头注释 ③）。★ **别编一个假闸门名、也别把可核的偷标成不可核**。');
} else {
  console.log(`✓ 判据①·真实数据里 ${real.size} 条字段路径**全部**已在登记表里`);
}

if (gone.length) {
  console.log(`\n✘ 判据②·有 ${gone.length} 条**覆盖声明失效**（登记了 \`coveredBy\` 但闸门不在了）：`);
  for (const g of gone) console.log(`   ✘ ${g.path}  →  coveredBy: ${g.gate}（token \`${g.tok}\`）—— ${g.why}`);
  console.log('   ↳ 修法：把闸门补回来 / 改回登记表里的名字；若该闸门**确实**不再读它 ⇒ 改成 `coveredBy: null` + `reason`。');
  console.log('     ★ 本条**只**看「闸门在不在、token 在不在」—— 字段本身从数据里消失**不**触发它。');
} else {
  console.log(`✓ 判据②·${nCov} 条覆盖声明全部仍在（闸门文件在 + 剥注释后源码里有 token）`);
}

if (noGate.length) {
  console.log(`\nℹ 判据③·登记为「无闸门」（\`coveredBy: null\`）的 ${noGate.length} 条 = `
    + `**可核·待补闸门 ${verifiableNoGate.length} 条**（值级 ${valueNoGate.length} / 声称级 ${claimNoGate.length}）`
    + ` + **不可核 ${unverifiable.length} 条**（**只列，不判 FAIL**）：`);
  if (verifiableNoGate.length) {
    console.log(`   ▲ **可核·待补闸门**（有权威对照物、只是**还没建闸门** ⇒ **真缺口，该补**）—— ${verifiableNoGate.length} 条：`);
    for (const [p, e] of verifiableNoGate) console.log(`   ▲ [${TIER[e.verifiability]}] ${p} —— ${e.reason}`);
  }
  if (unverifiable.length) {
    console.log(`   · **不可核**（**没有权威对照物** ⇒ 如实标注，不假装能覆盖）—— ${unverifiable.length} 条：`);
    for (const [p, e] of unverifiable) console.log(`   · [${TIER[e.verifiability]}] ${p} —— ${e.reason}`);
  }
}

if (badTier.length) {
  console.log(`\n✘ 判据⑤·有 ${badTier.length} 条「无闸门」条目**缺 / 非法 \`verifiability\`**（会让三档计数静默失真）：`);
  for (const [p, e] of badTier) console.log(`   ✘ ${p} —— verifiability = ${(e && e.verifiability) || '（缺）'}`);
  console.log('   ↳ 修法：给该条补 `verifiability: \'value\' | \'claim\' | \'unverifiable\'`（语义见头注释 ③）。');
}

if (measuredFails.length) {
  console.log(`\n✘ 判据⑥·有 ${measuredFails.length} 份 \`selfCheck.loudness\` **没声明（或声明非法）读数测的是哪一份产物**：`);
  for (const m of measuredFails) console.log(`   ✘ ${m.slug} —— ${m.why}`);
  console.log(`   ↳ 修法：在 \`selfCheck.loudness\` 里加 \`"measuredFrom": "local-copy"\`（枚举 ${JSON.stringify(MEASURED_FROM_ENUM)}）`);
  console.log('     并加 `"measuredPath": "D:/lemo-films/<slug>/<slug>.mp4"`。★ 本地副本读数**不是**权威 artifact ——');
  console.log('     要判「已发布影片是否达标」必须**另行实测发布片**（见 `_distill/AGENT-BRIEF.md`）。');
} else {
  console.log(`✓ 判据⑥·${slugs.length} 份 \`selfCheck.loudness\` **全部**声明了读数来源（值在枚举 ${JSON.stringify(MEASURED_FROM_ENUM)} 内）`);
}

console.log(`\n[闸门] _distill.json 字段登记：${slugs.length} 个风格 / ${real.size} 条字段路径 · `
  + `登记 ${Object.keys(FIELDS).length} 条（有闸门 ${nCov} / 无闸门 ${noGate.length} = `
  + `可核·待补 ${verifiableNoGate.length}〔值级 ${valueNoGate.length} / 声称级 ${claimNoGate.length}〕+ 不可核 ${unverifiable.length}）· `
  + `未登记 ${unregistered.length} 条 · 覆盖声明失效 ${gone.length} 条 · 登记表失格 ${badTier.length} 条 · `
  + `来源未声明/非法 ${measuredFails.length} 条`
  + `${blind.length ? '、**已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exitCode = ok ? 0 : 1;
