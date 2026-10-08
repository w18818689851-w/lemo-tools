#!/usr/bin/env node
/**
 * scripts/check-repro-form.mjs —— 「**编排器能不能复现已发布形态**」闸门（**写作时**第 39 个；★ 2026-10-08 复核：现共 **41** 个 `check-*.mjs`，原记 40）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 由来（一个**已登记的零覆盖区**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   `lemo-make.mjs`（**红线文件**，md5 受 `check-redline-md5` 守）的 `--q` 帮助文本明写：
 *     「`--q <k=v&k=v>` 页面参数，**只透传给渲染**（video.mjs）… **默认按 demo 的 `build.sh`
 *      渲染行取**（如 tilt-shift 的 noev），**取不到就不传**」
 *   ⇒ 对**没有 `build.sh` 的风格**，编排器**一个 `--q` 都取不到**（`qIntent()` 见 `lemo-make.mjs:1137-1155`）。
 *   ⇒ 若该风格的 `DEMO.md`「Build notes」里写着「渲染要带 `--q …`」，编排器就**复现不出已发布形态**。
 *   已确认两例（上一批已修，本闸门只**守**它们不再复发、**一个字节都不写库仓**）：
 *     · `hd-2d`：`DEMO.md:127` 渲染行带 `--q tilt=1` —— 没有它产的是 **plain DOF 版**，
 *       不是已发布的**移轴剪**（`demo/build.sh` 文件头与 `DEMO.md:133` 都写明「`?tilt=1` is what
 *       makes the tilt-shift cut … Without it you get the plain DOF version」）；
 *     · `pictogram-motion`：渲染要 EN-JP 版（`demo/scenes.js:6` 的 `EJ = get('lang')==='ej'`），
 *       没有它产**中文（ZH）版**、不是已发布的 **EN-JP 版**（该风格的「渲染行」用的是**自带的**
 *       `demo/render.mjs`，见 ⑦「已知盲区」——**本闸门看不见它**）。
 *   另有一类**存在性声称**的陈旧：`_distill.json` 的 `assetGaps` / `defects` / `resolvedDefects`
 *   等散文字段里仍写着「**没有 build.sh**」，而该风格**现在有了** —— 这类「文档说没有、实物有」
 *   的声称**没有任何闸门在读**（`check-distill-fields` 只看**字段路径**在不在登记表里、
 *   `check-sources-paths` 只看 `sources[]` 的**路径**存在性、`check-demo-header` 只看头部行规格）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（三条，同一主题：**复现能力**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   **判据①**：`DEMO.md` 渲染行的 `--q` 必须能被编排器取到。
 *     · 渲染行 = `DEMO.md` 的 **`## Build notes`** 段里**第一处含 `video.mjs`** 的行
 *       （`video.mjs` 与 `qIntent()` 的 needle **逐字相同**）；抽它的 `--q`（`mdQ`）。
 *     · 编排器侧 = 该风格 `demo/build.sh` 的 `qIntent()` 结果（`bsQ`，见 ③「同口径」）。
 *     · `mdQ` 有值（渲染行声明了页面参数）时：
 *       - **无 `build.sh`** ⇒ **FAIL**（编排器取不到任何 `--q`）；
 *       - 有 `build.sh` 但 `qIntent()` 取不到（`bsQ === null`）：
 *         ★ 若该风格的 `build.sh` 渲染行 `--q` **含 `$`**（如 `engraving` 的 `"content=$C"`、
 *           `hologram-hud` 的 `"$Q"`、`silkscreen-poster` 的 `${Q:+--q $Q}`）⇒ **只列 ℹ、不判 FAIL**
 *           —— `qIntent()` 对含 `$` 的值一律返回 `null`（它无法忠实重建 `build.sh` 自己的变量），
 *           而**页面默认恰等于 shipped**（上一批审计已确认）⇒ 不算复现失败；
 *         - 否则 ⇒ **FAIL**；
 *       - `bsQ` 有值 ⇒ ★ **按「参数名=值」逐项比**（`&` 拆分，**不整串比**）：`mdQ` 的每一项都必须在
 *         `bsQ` 里 ⇒ 缺哪一项就点名那一项（含「值不符」）。
 *     ★ 反向**不判**：`build.sh` 的 `--q` 比 `DEMO.md` 渲染行**多**参数（如 `paper-lantern` 的
 *       `content=script.json`）⇒ **不判 FAIL** —— `build.sh` 是编排器的**权威来源**，它多声明一个
 *       形态开关是**正确的**（这些 build.sh 的文件头都写了为什么）。
 *
 *   **判据②**：`build.sh` 存在 ⇒ `_distill.json` 不得**断言它不存在**（反向同理）。
 *     · 逐风格：`hasBuild = 存在 styles/<slug>/demo/build.sh`。
 *     · 扫该风格 `_distill.json` 的**全部字符串字段**（对象递归 + 数组元素；不扫 JSON 键），
 *       对每一处 `build.sh` 提及判「**存在性声称**」（见 ④ 的两条锚定规则）：
 *       - `hasBuild` 且字段**否定**其存在 ⇒ **FAIL**（点名 `slug + 字段路径 + 原句片段`）；
 *       - `!hasBuild` 且字段**肯定**其存在 ⇒ **FAIL**（反向，同点名）；
 *       - `!hasBuild` 且字段否定其存在 ⇒ **正确** ⇒ 只计入 ℹ 统计（**不判 FAIL**）。
 *     · ★★ **历史语境豁免**（见 ⑤）—— 命中**存在性声称**、但该字段带**历史/更正标记**的 ⇒
 *       **只列 ℹ、不判 FAIL**（项目 house style「**保留原句 + 加历史标记 + 补现值**」本身就是**正确形态**）。
 *
 *   **判据③**：失明守卫（防空转绿灯）。
 *     枚举到 **0 个风格** / **0 条 DEMO.md 渲染行** / **0 条 build.sh** / **0 份可读 `_distill.json`**
 *     ⇒ **FAIL 并明说「本闸门已失明」**，且**失明时不再输出判据①②**（在失明的树上它们只会刷屏）。
 *     ★ 第 4 条（`_distill.json` 侧）是本闸门**自己加的**：没有它，判据② 会在「一份 json 都读不到」
 *       时**静默空转**（那正是本项目反复治的「假绿」）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 与 `qIntent()` **同口径**（★ 不同口径就会造出「你以为能取到、实际取不到」的假绿）
 * ══════════════════════════════════════════════════════════════════════════════
 *   `build.sh` 侧的 `--q` 抽取**逐字照抄** `qIntent()` 的取值正则（`lemo-make.mjs:1147`；函数体在 1137–1155 行）：
 *     · 先按 `split('\n')` 且**滤掉 `^\s*#` 的整行注释**；
 *     · 再 `lines.find(l => l.includes('video.mjs'))`（**第一处**含 `video.mjs` 的行）；
 *     · 用 `/(?:^|[^-\w])--q\s+("[^"]*"|'[^']*'|\S+)/` 抽值，剥掉首尾引号；
 *     · **值含 `$` ⇒ 返回 `null`**（编排器取不到）。
 *   ★ 这三处细节**每一条都承重**（实测过）：
 *     · 「滤整行注释」⇒ `build.sh` 文件头那些「`--q lang=ej` 是形态开关…」的说明行**不算数**；
 *     · 「**第一处**含 `video.mjs`」⇒ `engraving` / `hologram-hud` / `silkscreen-poster` 的
 *       `G=""   # 整机渲染限流已在 core/render/video.mjs 里` 这行**排在真渲染行之前** ⇒ `qIntent()`
 *       取到的是**它**（没有 `--q`）⇒ 返回 `null` —— 与「值含 `$`」是**两个不同的原因**，
 *       但结果同为 `null`（本闸门两个原因都如实打出，见 ⑥ 实测）；
 *     · 「含 `$` ⇒ null」⇒ 见判据① 的 ℹ 分支。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 判据② 的「存在性声称」怎么认（★ 两条锚定规则 + 一条**刻意的不对称**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   只认**紧贴 `build.sh`** 的声称（前窗口 ~48 字符 / 后窗口 ~12 字符），**绝不**「整句含否定词就判」：
 *     · **否定·前置**：`(没有|无|缺乏|缺|不含|未提供|未随|不存在|尚无|并无|并没有)[任何/一个/该…]?[ \t]*(styles/<slug>/)?(demo/)?` **紧接** `build.sh`
 *       —— 覆盖实测的 5 种写法：`无 demo/build.sh`、`本风格没有 demo/build.sh`、`没有 build.sh`、
 *       `本 demo 目录没有 build.sh`、`无 styles/watercolor/demo/build.sh`。
 *     · **否定·后置**：`build.sh` **紧接** `(本身)?不存在`（只认「不存在」这一条无歧义的存在性否定）。
 *     · **肯定·前置**：`(有|含|自带|提供|存在|已有|带有)[…]?[ \t]*(styles/<slug>/)?(demo/)?` **紧接** `build.sh`；
 *       另有**路径引用**形态：字段本身就是一条 `…/demo/build.sh` 路径（如 `sources[]` 里的
 *       `styles/art-deco/demo/build.sh`）⇒ 也是「该文件存在」的声称。
 *   ★★ **为什么否定只认「前置」**（**刻意的不对称**，是本闸门最容易误报的地方）：
 *     本项目有一批**正确**的否定 ——「**有** `build.sh`，但**某一步**缺失」，实测 4 处：
 *     `scifi-toon` 的「`` `build.sh:14` 的 mux 命令末位未给 grain 参数 ``」（**×2**）、
 *     `engraving` 的「`build.sh` 第 1 步从 `content.json` 派生…」、`shadow-puppet` 的
 *     「`build.sh` 已内置 3 次重试」。它们的否定词（`未给` / `缺`）都出现在 `build.sh` **之后**、
 *     且**不是**「不存在」⇒ 前置锚定 + 后置只认「不存在」把它们**全部放行**。
 *     若改成「整句含否定词即判」，这 4 处会**全部误报**（那就是「为了让闸门抓得多而乱报」）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑤ 判据② 的**历史语境豁免**（★ 为什么它**不是**「为了让闸门变绿而放宽判据」）
 * ══════════════════════════════════════════════════════════════════════════════
 *   项目对「文档里的陈述过期了」有**成文 house style**：**保留原句 + 加历史/更正标记 + 补现值**
 *   （同型先例：`check-target-as-measured` 判据⑤、`check-selfcheck-claims` 判据 G 都按这个豁免）。
 *   ⇒ 一条**带历史标记**的「（原写）没有 build.sh」**不是**陈旧声称，而是**已如实归档的历史**；
 *     要求把它判红，等于要求**删掉历史**（本项目明令禁止）。
 *   本闸门的豁免规则（**字段级**）：字段里出现
 *     `已消解|已修复|已修|原记录|保留作历史|原为|原记|原先|原写|原句|曾是|曾为|修复前|已不适用|不再适用|撤销|撤回|kept as history`
 *   之一 ⇒ 该字段里的**存在性声称**一律只列 ℹ、不判 FAIL。
 *   ★★ **豁免是承重的、不是摆设**：实测（2026-10-08，见 ⑥）恰好有 **4 处** 命中落在历史语境里
 *     （`hd-2d`/`paper-lantern`/`pictogram-motion` 的 `assetGaps` 三条「已消解（原记录保留作历史）」+
 *     `paper-lantern` 的 `resolvedDefects[2]` 那条「★ 2026-10-08 撤销 / 原记录（保留作历史）」）
 *     —— 去掉豁免它们**立刻变 FAIL**（= 误报 4）；而**没有**历史标记的那一条
 *     （`pictogram-motion` 的 `defects[0]`，它是**当前**缺陷记录、把「没有 demo/build.sh」当**现存证据**用）
 *     仍然 **FAIL** ⇒ 证明豁免**没有**把「当前声称」一起放过（`test/gate-blindness.test.mjs` 的
 *     ★自证 ② 用短路豁免来钉这一点）。
 *     ★ **2026-10-08 12:38 复测**：`pictogram-motion.defects[0]` 已被并行智能体**整条重写**
 *       （现为 `【typography −1】派生通路…`、不再提 `build.sh`）⇒ 那条真阳**消失**（**原记录保留作历史**：
 *       12:30 快照时它确实是唯一真阳）；历史豁免也由 4 处变 **5 处**。⇒ 判据② 现为 **0 FAIL**，
 *       但**裸**声称仍会 FAIL（变异 C 钉住），**豁免本身没变**。
 *   ★ 已知局限（如实写）：字段级豁免**挡不住**「同一字段里既有历史标记、又有一条新的假声称」⇒ **假阴**；
 *     但那种情况在真实语料里**不存在**，且假阴方向**不会**制造误报。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑥ 误报率实测（**先跑真实语料、逐条人读命中**，再定稿）
 * ══════════════════════════════════════════════════════════════════════════════
 *   真实语料（快照 **2026-10-08 12:30**，库仓 `D:/lemo-opuscar`）：`styles/` **43 个风格**
 *   （排除 `_template`）/ **23 条** `DEMO.md` 渲染行 / **37 条** `build.sh` / **43 份**可读 `_distill.json`。
 *   · **判据①**：**命中 0 / 真阳 0 / 误报 0**（实际比对 **1 项**）。★ 逐条人读：43 份 `DEMO.md`
 *     的 Build notes 段里，**只有 `hd-2d` 一处**渲染行带 `--q`（`tilt=1`）—— 它与 `build.sh` 的
 *     `--q tilt=1` **逐项一致** ⇒ 0 命中（**这正是上一批修好的那两例的验收态**）。
 *     其余 42 份的渲染行**都没有 `--q`** ⇒ 无可比对项 ⇒ 不判。
 *   · **判据②**（**首测 2026-10-08 12:30**）：**命中 1 处（真阳 1）/ 误报 0**，另 **历史豁免 4 处（3 风格）**：
 *     - 真阳 1 = `pictogram-motion` `defects[0]`：**当前**缺陷记录里把「本风格没传 --grain、
 *       **没有 demo/build.sh**、…」当**现存证据**用，而该风格**已有** `build.sh` ⇒ 陈旧声称。
 *     - 历史豁免 4 = `hd-2d` `assetGaps[1]`、`paper-lantern` `assetGaps[0]`、`pictogram-motion`
 *       `assetGaps[4]`（三条均为「★ 2026-10-08 **已消解**（原记录保留作历史）：本条**原写**「没有 build.sh…」」）
 *       + `paper-lantern` `resolvedDefects[2]`（「★ 2026-10-08 **撤销** / **原记录（保留作历史）**」）。
 *       ★ 这 4 处**恰好是团队原描述里点名的 3 条 `assetGaps`** —— 我开工时它们还是**裸声称**
 *         （无历史标记）⇒ 本闸门判 **FAIL（真阳）**；**并行工作的另一智能体**在我实测途中把它们
 *         改成了 house-style 历史形态 ⇒ 依 ⑤ 转为 ℹ。**本闸门没有为此改动任何判据**
 *         （真阳→ℹ 的转变来自**文档被修好**，不是判据放宽 —— 见 `test/gate-blindness.test.mjs`
 *         的变异 C：**裸**声称仍然 FAIL）。
 *     - ★ 与团队给的「3 命中」不符：**按「(风格, 字段路径)」计**，团队说的那 3 条 `assetGaps`
 *       确实是 3；但**按「出现次数」计**另有 2 处（`pictogram-motion` `defects[0]`、
 *       `paper-lantern` `resolvedDefects[2]`）也命中 —— 本闸门按**出现次数**报（每一处都要修），
 *       并同时打出涉及**几个风格**。
 *   · ★★ **复测（2026-10-08 12:38，同一批并行智能体把上面那处真阳也修掉了）**：
 *     **判据② 命中 0（真阳 0）/ 误报 0**，历史豁免 **5 处（3 风格）**（新增 `pictogram-motion`
 *     `resolvedDefects[3]` 那条「★ 2026-10-08 撤销 / 原记录（保留作历史）」），如实否定 **5 个**
 *     （`brick-toy` / `game-show` / `halftone-dossier` / `paper-popup` / `watercolor`）。
 *     ⇒ **真阳 1 → 0** 同样来自**文档被修好**（`pictogram-motion.defects[0]` 已被**整条重写**成
 *     `【typography −1】…`、不再提 `build.sh`），**不是**判据放宽。★ 两处 FAIL 都只在**开工瞬间**
 *     （12:30 快照）存在，**没有**任何一条是本闸门「造」出来的（= 误报率 **0** 的可信依据）。
 *   · ★ 复测快照：判据① **命中 0 / 真阳 0 / 误报 0**（比对 **1 项**）不变；`$` 值类 **3 个**不变。
 *     `[闸门]` 计数行：风格 43 / 渲染行 23 / build.sh 37 / json 43 / 判据① 比对 1（FAIL 0）/
 *     判据② FAIL 0 / qIntent 取到 --q 4 个 / ℹ $ 3 / ℹ 历史豁免 5 / ℹ 如实否定 5。
 *   · **ℹ（`$` 值类）**：**3 个风格** —— `engraving`（`content=$C`）、`hologram-hud`（`$Q`）、
 *     `silkscreen-poster`（`${Q:+--q $Q}`）。★ 这三处 `qIntent()` 都返回 `null`（含 `$`，
 *     或**先被** `G="" # …video.mjs…` 那行截胡），但它们**都没有**在 `DEMO.md` 渲染行声明 `--q`
 *     ⇒ 判据① **不会**因此翻红；仍**单列 ℹ** 写清理由（页面默认 == shipped）。
 *     ★ 与团队给的「5 个风格」不符：**实测 3 个**。多出来的 2 个（`art-deco` 的
 *     `--q scene=frames.$s`、`midcentury-toon` 的 `--q "content=${CONTENT:-…}"`）**都在 `still.mjs` 行**
 *     —— `qIntent()` **只看 `video.mjs` 行** ⇒ 与编排器复现能力**无关**，故不计入。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑦ 已知盲区 / 局限（**如实登记，绝不粉饰**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · ★★ **判据① 只能守「渲染行字面带 `--q`」的风格**：实测只有 `hd-2d` 一处。像
 *     `pictogram-motion` 那样「渲染行用**自带** `render.mjs` + `LANGQ=ej` 默认值」的风格，
 *     `DEMO.md` 渲染行**不含 `--q`** ⇒ 判据① **看不见**（这正是团队原始描述里
 *     「`pictogram-motion` 的 `DEMO.md` 渲染行带 `?lang=ej`」与**实测不符**之处：实测渲染行是
 *     `node render.mjs video 12`，`?lang=ej` 只出现在**散文**与 `build.sh`）。⇒ **判据① 不能替代
 *     「逐风格人读渲染行」**，它只守**已经写成 `--q` 形态**的那一类（`hd-2d` 型）。
 *   · 渲染行抽取是**启发式**（第一处含 `video.mjs` 的非注释行）⇒ `paper-lantern` 的 Build notes 里
 *     文件清单行 `render/still.mjs video.mjs cues.mjs …` 会**先被选中**（它没有 `--q`，无害）；
 *     `engraving` 的散文 bullet 也会先被选中（同样无害）。**没有**做成「只认命令行」是**刻意的**：
 *     要与 `qIntent()` 的 needle 同口径（见 ③）。
 *   · 判据② 只认**紧贴 `build.sh`** 的存在性声称（见 ④）⇒ 远距离写法（「本风格…（中间一大段）…没有一键复现脚本」）**看不见**；
 *     「`build.sh` 后置 `尚未有` / `还没`」等**只认「不存在」**⇒ 假阴（宁可漏、不误报）。
 *   · 判据② **不判**「散文里说 `build.sh` 有某一步、而实际没有」（那是**步骤级**声称，不是**存在性**声称；
 *     判它会误伤 ④ 里那 4 处**正确**的否定）。
 *   · 历史豁免是**字段级**的（见 ⑤）⇒ 「同一字段里既有历史标记、又有一条新假声称」会**假阴**。
 *   · 判据① **不判** `build.sh` 的 `--q` 是否**真能改变成片**（那要真渲染对比，属另一类闸门）。
 *   · ★ **失明优先于判据①**：若**整棵树**一条 `build.sh` 都没有（实测真实语料有 37 条），判据③ 会
 *     直接报失明、**不输出**判据① —— 于是「某风格渲染行带 `--q` 却没有 `build.sh`」这类 FAIL
 *     在**全局退化**的树上**看不见**。这是**有意**的（先让人去查「为什么一条 `build.sh` 都没有」，
 *     而不是刷一屏 FAIL）；但它意味着**判据① 只在「库仓里还有别的 `build.sh`」时才可靠**
 *     （`test/gate-blindness.test.mjs` 的变异 A/D 因此必须带一个「有 `build.sh` 的锚」才测得到）。
 *   · 覆盖点 `LEMO_OPUSCAR` / `LEMO_DISTILL_ROOT` 指空 / 不存在 ⇒ 走失明守卫，**不静默回落**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑧ 验证（**临时副本 + 覆盖点，全程不动真实仓 / 不写库仓 / 不跑 ffmpeg**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**（合成 3 风格树：① 两边 `--q tilt=1` 一致；② 无 `build.sh` 且**如实**声称没有；
 *     ③ 有 `build.sh` + `sources[]` 路径引用 + 一条**带历史标记**的「原写：没有 build.sh」）⇒ **exit 0**
 *     且**不含**判据文案。
 *   · **变异 A**（`DEMO.md` 渲染行有 `--q tilt=1`、**无 `build.sh`**）⇒ **exit 1** 并点名 `slug`
 *     （判据①「编排器取不到」）。
 *   · **变异 B**（`DEMO.md` 渲染行 `--q 'a=1&b=2'`、`build.sh` 只给 `a=1`）⇒ **exit 1** 并点名
 *     **缺的那一项 `b=2`**（逐项比，不是整串比）。
 *   · **变异 C**（有 `build.sh`，`assetGaps` 写**裸**的「本 demo 目录没有 build.sh」）⇒ **exit 1**
 *     并点名 `slug + 字段路径`（判据② 正向）。
 *   · **变异 D**（**无** `build.sh`，`defects` 写「本风格有 demo/build.sh」）⇒ **exit 1** 并点名（反向）。
 *   · **反向验证**：短路判据① / 短路历史豁免 ⇒ 对应变异**重新变绿**（**exit 0**）。
 *   · **失明四态**（空风格树 / 0 条渲染行 / 0 条 `build.sh` / 0 份 `_distill.json`）⇒ **exit 1 +
 *     「本闸门已失明」**，且**不输出判据①②**。
 *   · **真实语料只读**：判据① 0 命中；判据② 的 FAIL 只允许落在 `pictogram-motion`（真阳）——
 *     若 json 已被并行智能体修好则 exit 0（两种结果都接受，**不接受**任何别的命中）。
 *
 * 覆盖点（便于非破坏变异验证，登记于 `test/README.md` 与 `_distill/AGENT-BRIEF.md`）：
 *   · `LEMO_OPUSCAR`      —— **库仓根**（默认 `<脚本>/../../lemo-opuscar`）。
 *     `DEMO.md` 源 = `<LEMO_OPUSCAR>/styles/<slug>/DEMO.md`；`build.sh` 源 =
 *     `<LEMO_OPUSCAR>/styles/<slug>/demo/build.sh`。★ **不硬编码 `D:/lemo-opuscar`**
 *     （与 `check-demo-header` / `check-ref-lines` / `check-target-as-measured` **同名同义**）。
 *   · `LEMO_DISTILL_ROOT` —— **风格技能树根**（默认 `<脚本>/../lib/style-skills`），
 *     `_distill.json` 源 = `<LEMO_DISTILL_ROOT>/<slug>/_distill.json`。
 *     与 `check-demo-header` / `check-tp-prose` / `check-skill-film-fields` **同名同义**。
 *
 * 用法：node scripts/check-repro-form.mjs
 * 退出码：0 = 编排器能复现所有已发布形态（或渲染行没声明 `--q`）、且 `build.sh` 的存在性声称与实际一致；
 *         1 = 有 FAIL，或**本闸门已失明**。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// ★ 覆盖点：库仓根（同名同义于 check-demo-header / check-ref-lines / check-target-as-measured）。
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || path.join(HERE, '..', '..', 'lemo-opuscar'));
const STYLES = path.join(OPUSCAR, 'styles');
// ★ 覆盖点：风格技能树（`_distill.json` 源），同名同义于 check-demo-header / check-tp-prose。
const DISTILL = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(HERE, '..', 'lib', 'style-skills'));

/** `qIntent()` 的 needle（`lemo-make.mjs:1144` 的 `l.includes(needle)`）——**逐字相同**，见 ③。 */
const Q_NEEDLE = 'video.mjs';
/** `qIntent()` 的取值正则（`lemo-make.mjs:1147`）——**逐字照抄**，见 ③。 */
const Q_RE = /(?:^|[^-\w])--q\s+("[^"]*"|'[^']*'|\S+)/;

/** 从一行里抽 `--q` 的值（剥首尾引号）；没有 ⇒ `null`。与 `qIntent()` 的 `pick()` 内层同口径。 */
function qFromLine(line) {
  if (!line) return null;
  const m = Q_RE.exec(line);
  if (!m) return null;
  return m[1].replace(/^["']|["']$/g, '');
}

/** `build.sh` 的非注释行（`qIntent()` 的第一道过滤：`filter(l => !/^\s*#/.test(l))`）。 */
function shellLines(buildSh) {
  return fs.readFileSync(buildSh, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l));
}

/**
 * `build.sh` 侧的 `--q` —— ★ **逐字照抄 `qIntent()`**（`lemo-make.mjs:1137-1155`），见头注释 ③。
 * 返回 `{ exists, line, raw, q }`：`raw` = 抽到的原值（**保留 `$`**，供诊断），`q` = 编排器**实际能拿到**的值
 * （含 `$` ⇒ `null`）。`exists=false` ⇒ 没有 `build.sh`。
 */
function qIntentRender(buildSh) {
  const out = { exists: false, line: null, raw: null, q: null };
  if (!fs.existsSync(buildSh)) return out;
  out.exists = true;
  const line = shellLines(buildSh).find((l) => l.includes(Q_NEEDLE)) || null;
  out.line = line;
  const raw = qFromLine(line);
  out.raw = raw;
  out.q = raw === null || raw.includes('$') ? null : raw;
  return out;
}

/**
 * 该 `build.sh` 的**任意** `video.mjs` 行上**含 `$`** 的 `--q` 值（⇒ `qIntent()` 必然取不到）；没有 ⇒ `null`。
 * ★ 单列出来是因为：`engraving` / `hologram-hud` / `silkscreen-poster` 的**真渲染行**含 `$`，
 *   而 `qIntent()` 的 `find()` 又**先**撞上它们文件头那行 `G="" # …video.mjs…` ⇒ 两个原因叠加，
 *   结果同为 `null`。本函数只看「值里有没有 `$`」这一维，并把**原值**报出来（ℹ 里可读）。
 */
function dollarQValue(buildSh) {
  if (!fs.existsSync(buildSh)) return null;
  for (const l of shellLines(buildSh)) {
    if (!l.includes(Q_NEEDLE)) continue;
    const v = qFromLine(l);
    if (v !== null && v.includes('$')) return v;
  }
  return null;
}

/** `DEMO.md` 的 `## Build notes` 段（从标题行**之后**到文末）。找不到 ⇒ `null`。 */
function buildNotesSection(md) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => /^#{1,6}\s*Build notes/i.test(l));
  return i < 0 ? null : lines.slice(i + 1);
}

/**
 * `DEMO.md` 侧的渲染行 —— 与 `qIntent()` 同 needle（`video.mjs`）、同样**滤整行注释**。
 * 返回 `{ found, noSection, line, q }`；`q` 是渲染行**声明**的页面参数（`$` **不**置 null：它是规格）。
 */
function demoRenderLine(md) {
  const seg = buildNotesSection(md);
  if (seg === null) return { found: false, noSection: true, line: null, q: null };
  const line = seg.find((l) => l.includes(Q_NEEDLE) && !/^\s*#/.test(l)) || null;
  if (!line) return { found: false, noSection: false, line: null, q: null };
  return { found: true, noSection: false, line, q: qFromLine(line) };
}

/** `k=v&k=v` → `Map`（★ **逐项**比用，见判据①）；无 `=` 的裸开关按 `null` 值记。 */
function params(q) {
  const out = new Map();
  if (!q) return out;
  for (const part of String(q).split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq < 0) out.set(part, null);
    else out.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return out;
}

// ── 判据② 的「存在性声称」锚定规则（见头注释 ④）────────────────────────────────
/** 否定·前置：否定词 + 可选量词 + 可选 `styles/<slug>/` + 可选 `demo/`，**紧接** `build.sh`。 */
const NEG_BEFORE = /(?:没有提供|没有对应|并没有|尚无|并无|未提供|不存在|缺乏|不含|未随|没有|無|无|缺)(?:任何|一个|这个|该|此)?[ \t]*(?:styles\/[A-Za-z0-9_.-]+\/)?(?:demo\/)?$/;
/** 否定·后置：`build.sh` **紧接** `(本身)?不存在`（只认这一条无歧义的**存在性**否定）。 */
const NEG_AFTER = /^(?:本身)?[ \t]*不存在/;
/** 肯定·前置：肯定词 + 可选量词 + 可选路径，**紧接** `build.sh`。 */
const POS_BEFORE = /(?:有|含|自带|提供|存在|已有|带有)(?:任何|一个|这个|该|此)?[ \t]*(?:styles\/[A-Za-z0-9_.-]+\/)?(?:demo\/)?$/;
/** 路径引用形态：字段本身就是一条 `…/demo/build.sh` 路径（`sources[]` 那种）⇒ 也是存在性声称。 */
const PATH_RE = /(?:^|[^A-Za-z0-9_.-])(?:styles\/[A-Za-z0-9_.-]+\/)?demo\/build\.sh(?![\w.-])/;

/** ★ 历史/更正标记（见头注释 ⑤）—— 命中即把该字段里的存在性声称归「历史」、只列 ℹ。 */
const HIST_RE = /(已消解|已修复|已修|原记录|保留作历史|原为|原记|原先|原写|原句|曾是|曾为|修复前|已不适用|不再适用|撤销|撤回|kept as history)/;

/** 对一段散文判「有没有关于 `build.sh` **存在性**的声称」：`'neg'` / `'pos'` / `null`。 */
function existenceClaim(text) {
  const needle = 'build.sh';
  let neg = false, pos = false;
  let i = text.indexOf(needle);
  while (i >= 0) {
    const before = text.slice(Math.max(0, i - 48), i);
    const after = text.slice(i + needle.length, i + needle.length + 12);
    if (NEG_BEFORE.test(before) || NEG_AFTER.test(after)) neg = true;
    else if (POS_BEFORE.test(before)) pos = true;
    i = text.indexOf(needle, i + 1);
  }
  if (neg) return 'neg';                        // ★ 否定优先：`无 demo/build.sh` 同时命中 PATH_RE，须归「否定」
  if (pos) return 'pos';
  if (PATH_RE.test(text)) return 'pos';
  return null;
}

/** 递归收集 JSON 里的全部字符串字段（对象键不算；数组元素加 `[i]`）。 */
function walkStrings(o, prefix, out) {
  if (o === null || o === undefined) return;
  if (typeof o === 'string') { out.push([prefix, o]); return; }
  if (Array.isArray(o)) { o.forEach((v, i) => walkStrings(v, `${prefix}[${i}]`, out)); return; }
  if (typeof o === 'object') {
    for (const k of Object.keys(o)) walkStrings(o[k], prefix ? `${prefix}.${k}` : k, out);
  }
}

// ── 枚举风格（排除 `_template`）──────────────────────────────────────────────
let styleDirs = [];
try {
  styleDirs = fs.readdirSync(STYLES, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '_template')
    .map((e) => e.name).sort();
} catch { styleDirs = []; }

const fail1 = [];          // 判据① FAIL
const fail2 = [];          // 判据② FAIL
const histNeg = [];        // ℹ：判据② 命中但带历史标记 ⇒ 只列
const dollarList = [];     // ℹ：build.sh 渲染行 --q 含 `$`（qIntent 取不到，但页面默认 == shipped）
const correctNeg = [];     // ℹ：无 build.sh 且**如实**声称没有
const noMd = [];           // ℹ：没有 DEMO.md
const noBuildNotes = [];   // ℹ：没有 `## Build notes` 段
const noRenderLine = [];   // ℹ：Build notes 段里没有含 `video.mjs` 的行
const noDistill = [];      // ℹ：读不到 `_distill.json`
let mdLineCount = 0;       // DEMO.md 渲染行条数（失明守卫用）
let bsCount = 0;           // build.sh 条数（失明守卫用）
let distillCount = 0;      // 可读 `_distill.json` 份数（失明守卫用）
let cmpCount = 0;          // 判据① 实际比对过的项数
let bsQCount = 0;          // qIntent 能取到 `--q` 的风格数

for (const slug of styleDirs) {
  const demoMd = path.join(STYLES, slug, 'DEMO.md');
  const buildSh = path.join(STYLES, slug, 'demo', 'build.sh');
  const distillJson = path.join(DISTILL, slug, '_distill.json');

  // ── 编排器侧（判据① 的 `build.sh` 来源 + `$` 值类 ℹ）── 与「有没有渲染行」**无关**
  const bs = qIntentRender(buildSh);
  let dollarRaw = null;
  if (bs.exists) {
    bsCount++;
    if (bs.q !== null) bsQCount++;
    dollarRaw = dollarQValue(buildSh);
    if (dollarRaw !== null) dollarList.push({ slug, raw: dollarRaw });
  }

  // ── 判据① ────────────────────────────────────────────────────────────────
  let md = null;
  try { md = fs.readFileSync(demoMd, 'utf8'); } catch { noMd.push(slug); }
  if (md !== null) {
    const rl = demoRenderLine(md);
    if (rl.noSection) noBuildNotes.push(slug);
    else if (!rl.found) noRenderLine.push(slug);
    else {
      mdLineCount++;
      const mdQ = rl.q;
      if (mdQ) {                              // ★ 只有「渲染行**声明了** --q」才要求编排器能取到
        if (!bs.exists) {
          fail1.push({ slug, why: 'DEMO.md 渲染行声明了 --q，但本风格**没有 demo/build.sh** ⇒ 编排器取不到任何 --q（qIntent 直接返回 null）',
            detail: `渲染行：${rl.line.trim().slice(0, 160)}\n        --q：${mdQ}` });
        } else if (bs.q === null) {
          if (dollarRaw !== null) {
            /* ℹ：含 `$` ⇒ qIntent 必然取不到，但页面默认 == shipped ⇒ 不判 FAIL（见头注释 ②/⑥）；已在 dollarList */
          } else {
            fail1.push({ slug, why: 'build.sh 存在，但它的 video.mjs 行**取不到 --q**（该行没有 --q）⇒ 编排器取不到',
              detail: `DEMO.md 渲染行声明 --q：${mdQ}\n        build.sh 里 qIntent 选中的行：${(bs.line || '(无)').trim().slice(0, 160)}` });
          }
        } else {
          cmpCount++;
          const want = params(mdQ), got = params(bs.q);
          const missing = [...want.keys()].filter((k) => !got.has(k));
          const mismatch = [...want.keys()].filter((k) => got.has(k) && got.get(k) !== want.get(k));
          if (missing.length || mismatch.length) {
            const bits = [];
            if (missing.length) bits.push(`缺：${missing.map((k) => (want.get(k) === null ? k : `${k}=${want.get(k)}`)).join('、')}`);
            if (mismatch.length) bits.push(`值不符：${mismatch.map((k) => `${k}=${want.get(k)}（build.sh 是 ${k}=${got.get(k)}）`).join('、')}`);
            fail1.push({ slug, why: `DEMO.md 渲染行的 --q 与 build.sh 的 --q **逐项**不一致（${bits.join('；')}）`,
              detail: `DEMO.md：${mdQ}\n        build.sh：${bs.q}` });
          }
        }
      }
    }
  }

  // ── 判据② ────────────────────────────────────────────────────────────────
  let json = null;
  try { json = JSON.parse(fs.readFileSync(distillJson, 'utf8')); } catch { noDistill.push(slug); }
  if (json !== null) {
    distillCount++;
    const hasBuild = fs.existsSync(buildSh);
    const fields = [];
    walkStrings(json, '', fields);
    const negs = [], poss = [];
    for (const [p, s] of fields) {
      const c = existenceClaim(s);
      if (c === 'neg') negs.push([p, s]);
      else if (c === 'pos') poss.push([p, s]);
    }
    if (hasBuild && negs.length) {
      for (const [p, s] of negs) {
        if (HIST_RE.test(s)) histNeg.push({ slug, path: p, snippet: s.slice(0, 140) });   // ★ 历史语境 ⇒ ℹ
        else fail2.push({ slug, path: p, why: 'build.sh **存在**，但该字段**断言它不存在**（否定性存在声称）', snippet: s.slice(0, 180) });
      }
    } else if (!hasBuild && poss.length) {
      for (const [p, s] of poss) {
        if (HIST_RE.test(s)) histNeg.push({ slug, path: p, snippet: s.slice(0, 140) });   // ★ 历史语境 ⇒ ℹ
        else fail2.push({ slug, path: p, why: 'build.sh **不存在**，但该字段**断言它存在**（肯定性存在声称）', snippet: s.slice(0, 180) });
      }
    } else if (!hasBuild && negs.length) {
      correctNeg.push({ slug, n: negs.length });
    }
  }
}

// ── 失明守卫（防空转绿灯；失明时**不再输出判据①②**）──────────────────────────
const blindReasons = [];
if (styleDirs.length === 0) {
  blindReasons.push(`\`${STYLES}\` 下扫到 **0 个**风格目录（库仓根不可达 / 目录变了？）⇒ 判据①② 一条都没跑`);
} else {
  if (mdLineCount === 0) {
    blindReasons.push(`扫到 ${styleDirs.length} 个风格，但 **0 条** \`DEMO.md\` 渲染行（\`## Build notes\` 段里含 \`video.mjs\` 的行一处都没有 —— 抽取形态变了 / 读错目录？）⇒ 判据① 空转`);
  }
  if (bsCount === 0) {
    blindReasons.push(`扫到 ${styleDirs.length} 个风格，但 **0 条** \`demo/build.sh\` ⇒ 编排器侧没有任何可读的 \`--q\` 来源，判据① 空转`);
  }
  if (distillCount === 0) {
    blindReasons.push(`\`${DISTILL}\` 下**一份可读的 _distill.json 都没有** ⇒ 判据②（存在性声称）空转`);
  }
}
const blind = blindReasons.length > 0;

// ── 输出 ────────────────────────────────────────────────────────────────────
if (blind) {
  console.log('✘ 本闸门已失明：');
  for (const r of blindReasons) console.log(`  ✘ ${r}`);
} else {
  const totalFail = fail1.length + fail2.length;
  if (totalFail) {
    console.log(`✘ 编排器复现形态不符 ${totalFail} 处（判据① ${fail1.length} / 判据② ${fail2.length}）：\n`);
    if (fail1.length) {
      console.log(`  ── 判据① DEMO.md 渲染行的 --q 编排器取不到（${fail1.length} 处）──`);
      for (const f of fail1) console.log(`    · ${f.slug.padEnd(20)} ${f.why}\n        ${f.detail}`);
      console.log('');
    }
    if (fail2.length) {
      console.log(`  ── 判据② build.sh 的存在性声称与实际不符（${fail2.length} 处）──`);
      for (const f of fail2) console.log(`    · ${f.slug.padEnd(20)} [${f.path}] ${f.why}\n        ${f.snippet}`);
      console.log('');
    }
  } else {
    console.log('✓ 编排器复现形态一致（DEMO.md 渲染行声明的 --q 编排器都取得到；build.sh 的存在性声称与实际一致）。');
  }

  if (noMd.length) console.log(`\nℹ 没有 DEMO.md 的风格 ${noMd.length} 个（不计 FAIL，判据① 跳过）：${noMd.join('、')}`);
  if (noBuildNotes.length) console.log(`\nℹ 没有 \`## Build notes\` 段的风格 ${noBuildNotes.length} 个（不计 FAIL，判据① 跳过）：${noBuildNotes.join('、')}`);
  if (noRenderLine.length) console.log(`\nℹ Build notes 段里没有含 \`video.mjs\` 的行的风格 ${noRenderLine.length} 个（不计 FAIL，判据① 跳过）：${noRenderLine.join('、')}`);
  if (noDistill.length) console.log(`\nℹ 读不到 _distill.json 的风格 ${noDistill.length} 个（不计 FAIL，判据② 跳过）：${noDistill.join('、')}`);
  if (correctNeg.length) {
    console.log(`\nℹ 无 build.sh 且**如实**声称「没有」的风格 ${correctNeg.length} 个（正确形态，不判 FAIL）：`);
    for (const c of correctNeg) console.log(`    · ${c.slug.padEnd(20)} ${c.n} 处否定性声称，与实际一致`);
  }
  // ★★ 历史豁免必须**显式**打印（绝不让例外静默通过）
  if (histNeg.length) {
    const slugs = [...new Set(histNeg.map((h) => h.slug))];
    console.log(`\nℹ 判据② 命中但**带历史/更正标记**的 ${histNeg.length} 处（${slugs.length} 个风格）⇒ 只列、**不判 FAIL**（house style「保留原句 + 历史标记 + 补现值」）：`);
    for (const h of histNeg) console.log(`    · ${h.slug.padEnd(20)} [${h.path}] ${h.snippet}`);
  }
  // ★★ `$` 值类必须**显式**打印（绝不让「编排器取不到」被静默放过）
  if (dollarList.length) {
    console.log(`\nℹ build.sh 渲染行 --q **含 \`$\`** 的风格 ${dollarList.length} 个（qIntent 取不到 ⇒ 编排器不传该参数；`
      + `页面默认恰等于 shipped，故**不判 FAIL**）：`);
    for (const d of dollarList) console.log(`    · ${d.slug.padEnd(20)} --q ${d.raw}`);
  }

  console.log(`\n[闸门] 风格 ${styleDirs.length} 个 / DEMO.md 渲染行 ${mdLineCount} 条 / build.sh ${bsCount} 条 / _distill.json ${distillCount} 份`
    + ` / 判据① 比对 ${cmpCount} 项（FAIL ${fail1.length}） / 判据② FAIL ${fail2.length} 处`
    + ` / qIntent 取到 --q 的风格 ${bsQCount} 个 / ℹ $ 值类 ${dollarList.length} 个 / ℹ 历史豁免 ${histNeg.length} 处 / ℹ 如实否定 ${correctNeg.length} 个`
    + `${blind ? '、**已失明**' : ''} ${totalFail ? '✘' : 'OK'}`);
}
process.exitCode = (fail1.length || fail2.length || blind) ? 1 : 0;
