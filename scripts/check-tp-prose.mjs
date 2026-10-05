#!/usr/bin/env node
/**
 * scripts/check-tp-prose.mjs —— SKILL.md **正文**里的「**成片读数**」声称是否与实测一致
 *   （★ 文件名是历史遗留：本闸门 2026-10-03 立档时只查「真峰值（dBTP）」；
 *     2026-10-05 起它是**「成片读数」这一类声明**的通用闸门，见下「抽象」一节。）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 为什么要抽象成「一类」而不是「一种数值一条判据」
 * ══════════════════════════════════════════════════════════════════════════════
 * 根因（2026-10-05 复盘）：闸门按**某一种数值**写（dBTP），而文档是**散文** ——
 *   ① 于是**非 dBTP 的成片读数**（响度 / LRA / 字节数 / 分辨率 / 帧数 / 时长）**没有任何闸门管**，
 *      实测残留：`paper-popup:215` 的行内 `93,346,551 B`（实测 93,293,467）、
 *      `watercolor:190/192/214` 的 `51,107,756 字节`（实测 51,106,197）、
 *      `blueprint:163` 的 `LRA 4.5 LU`（实测 ebur128 3.4）、`watercolor:105` 的 `LRA 6.8`（实测 6.6）……
 *   ② 更糟的是**每加一种数值就要加一条判据** —— 抽取、排除、对账三件事会被重写 N 遍，
 *      永远追不上（`check-skill-film-fields.mjs` 就是「帧数/分辨率/时长」那一次的手工复制）。
 * ⇒ 正解：把「成片读数」抽成**一类声明** —— **同一套**「抽取 → 值域合理性 → 阈值排除 → 与真值对账
 *   → 成片语境 → 历史豁免 → 实验行排除 → 非本片产物排除 → 交叉引用」流水线，
 *   量纲只以**登记项**（`DIMS`）形式加进来：`{ 抽取正则 / 真值取值器 / 容差 / 值域 / 交付线 }`。
 *   **加一种量纲 = 加一条登记，不再加一条判据。**
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 真值来源（复用既有测量，不另造一套）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · 逐风格 `lib/style-skills/<slug>/_distill.json` 的
 *       `generatedVideo.{bytes,durSec,width,height,fps,frames}` 与
 *       `selfCheck.loudness.{truePeakDbtp,integratedLufs,lra,peakDbtpTarget}`。
 *   · ★ **为什么可以拿 json 当真值**：`scripts/check-film-delivery.mjs` 已经把 json 的
 *     这几项与**成片实测**（`ffprobe` 的 `width/height/fps/frames/duration/字节`、
 *     `loudnorm` 的 `input_tp`/`input_i`、`ebur128` 的 `LRA`）逐项比对过 ——
 *     本闸门**复用那份测量的结论**（json == 实测），不自己再跑一遍 ffmpeg
 *     （否则本闸门会从「秒级」变成「分钟级」，且与 delivery 的结论可能分叉）。
 *     ★ 口径对齐（与 `check-film-delivery.mjs` 逐字一致）：
 *       - 真峰值 = `loudnorm` 的 `input_tp`（4× 过采样），容差 0.15 dB；
 *       - 响度   = `loudnorm` 的 `input_i`，容差（见 LUFS 登记项）；
 *       - LRA    = `ebur128` 的 `LRA`（项目口径；`loudnorm` 的 `input_lra` 系统性偏大）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 判据（**只认「关于本片成片」的声称**，逐条说明它挡掉什么 —— 这是从旧版继承的资产）
 * ══════════════════════════════════════════════════════════════════════════════
 * 对每个登记量纲的每个 `<数> <单位>` token，按下列**同一顺序**过筛；任一步「排除」即不进 FAIL：
 *   ① **值域合理性**（`plaus`，逐量纲）：值落在交付量纲的物理可行域之外 ⇒ 它不是对成片的交付声称。
 *      · 帧数 < 100（`(\d{3,5})帧` 已保证，保留同义守卫）；
 *      · **响度 ≤ −50 LUFS ⇒ 这是「静音 / 占位文件」的读数**（交付线 −14±1，正常成片不可能这么低）
 *        ⇒ 单列「静音读数（参考）」。★ 实测：本库 4 个 `−70.0 LUFS` token 全属此类
 *        （`brick-toy:105/168/209`、`game-show:206`，都是「首版数字静音」的历史记录）。
 *   ② **阈值 / 交付线提及排除**（阈值不是对成片的声称）：
 *      (a) 数值 == 该风格的**交付线**（逐量纲的 `target`）：
 *          · dBTP：`selfCheck.loudness.peakDbtpTarget`（本库 43/43 = −1.2）；
 *          · LUFS：项目交付线 **−14**（与 `check-film-delivery.mjs` 的 `LUFS_LINE` 同源）。
 *          ⇒ 这是在引用「线」本身，不是在报告实测。
 *      (b) 或阈值词**紧贴**该数值（分隔符「，。；、｜|」不得跨越，两侧各 ≤6 字）——
 *          前置：`交付线|交付上限|交付目标|交付判据|上限|目标|天花板|判据|标准|不超过|不得超过|≤|<=`；
 *          后置：`交付线|上限|以内|之内|天花板`。
 *          ★ 用「紧贴 + 不跨分隔符」而不是「整行含阈值词」：后者会把
 *          `成片真峰值 −1.86 dBTP，交付线 −1.2 dBTP` 这类**真陈旧**一起放掉（改瞎闸门）。
 *          ★ 实测（43 份正文 / 452 个 `<数> dBTP`）：只放宽旧 ①（不加阈值排除）⇒ 命中 21 处，
 *            其中 18 处是 `−1.2 dBTP` 交付线本身（**误报率 86%**）；加 (a) ⇒ 命中 3、误报 0。
 *   ③ **与实测一致 ⇒ 放行**（逐量纲容差 `tol`；LRA 还看口径，见该登记项）。
 *   ④ **成片语境**：匹配点所在**整行**必须出现「成片 / 全片 / 本片」（帧数另认「帧数/帧率/入库版」、
 *      分辨率另认「交付/输出」—— 逐量纲 `ctx`，与 `check-skill-film-fields.mjs` 同源）。
 *      ★ 2026-10-05 修假阴：旧版是「匹配点前后 **60 字**窗」，`hd-2d:120` 的「成片」离数值 **69** 字、
 *        `watercolor:214` 离 **144** 字 ⇒ **闸门整类漏报**（不是判据坏，是窗口太窄）。
 *        实测：60 字窗下命中 0 ⇒ 8 处真陈旧**全部漏报**（假阴率 100%）。
 *   ⑤ **历史语境豁免**（`HIST`，看**整行**）：`已修|原为|原记|原先|曾是|曾为|历史|修复前|修复后|校正|拆分|移入|resolvedDefects`。
 *      ★ 项目习惯是「保留原句 + 加历史标记 + **补现值**」——**只加标记不补现值 = 把闸门永久豁免**（项目踩过）。
 *   ⑥ **实验 / 扫描行排除**（看**整行**）：整行出现 **≥2 处「箭头 → 数值 + 单位」**
 *      ⇒ 这是「**多个目标 → 多个实测值**」的对照串（逐档扫描波峰因子的实验记录），**不是单一交付声称**
 *      ⇒ **该行上的所有量纲 token 都不计 FAIL**，单列「实验行」供参考。
 *      ★ 旧版只认 dBTP 箭头；现按「已登记单位（dBTP/LUFS/LU/dBFS）」统一识别，
 *        并把「实验行」提升为**行级**属性 —— 实测 `pictogram-motion:174` 一行的 dBTP 是扫描记录，
 *        同一行的 `−14.09 LUFS`（成片响度）也是该扫描的**中间档读数**，必须同进同出。
 *   ⑦ **非本片产物排除**（`NONFILM`，看该数值**所在句**，按 `。！？` 分句）：该句讲的是
 *      上游 / 中间产物 / 素材的读数，不是对成片的声称：
 *      `mix.wav`（含裸 `mix`，如 `mix integrated −18.0 LUFS`）/ `score.wav` / `母带` / `中间产物` /
 *      `上游` / `样片` / `素材` / `源文件` / 音频素材扩展名（`.mp3|.wav|.flac|.m4a`）。
 *      ★ **必须排在 ⑥ 之后**：实验行讲的正是「`mix.wav` 的波峰因子扫描」，不该被 ⑦ 吞掉。
 *      ★ 实测（旧版只放宽 ③、不加 ⑦）：命中 10 ⇒ 真陈旧 8 / **误报 2（20%）**，两处误报同型
 *        （`hd-2d:120` 的 `−2.49`、`brick-toy:105` 的 `−0.1`，都是**上游 `demo/mix.wav` 的真峰值**）；
 *        加 ⑦ 后 ⇒ 命中 8 / 真陈旧 8 / **误报 0**。
 *      ★ 2026-10-05 扩量纲时 ⑦ 又各抓一次同型误报：`hd-2d:117` 的 `4,757,610 B` 是**配乐源文件**
 *        `music/src/sb_precipice.mp3` 的大小、`engraving:184` 的 `−18.0 LUFS` 是 `mix integrated`
 *        ⇒ 二者都由 ⑦（`源文件|.mp3` / 裸 `mix`）挡下。
 *   ⑧ **逐量纲附加排除**（`exclude`，继承自 `check-skill-film-fields.mjs` 的实测结论）：
 *      · 帧数 / 分辨率：`原生|样片|demo|DEMO|入库前|未渲|设计稿|风格声明|on ones`（设计期 / 他版尺寸）；
 *      · 分辨率另加「非假设语境」：`硬渲|渲成|裁|塞在|竖屏|内部|内含|超采样|世界|场景|片门|模板|画布|渲染|若|如果|帧缓冲|索引|缓冲`
 *        —— ★ `check-skill-film-fields.mjs` 实测：分辨率 328 处 `W×H` 里 107 处与成片尺寸不符，
 *        不加这两道守卫就是 **100% 噪声**。
 *   ⑨ **交叉引用单列**：行内出现**别的风格名**的，说明是在引用他片的旧值当先例，属另一类 ⇒ 不计 FAIL。
 *   ⑩ ★ **物理约束单列一类 FAIL**（2026-10-05 加）：**真峰值 ≥ 采样峰值 恒成立**（真峰值 = 4× 过采样峰值，
 *      采样峰值是它的下界）⇒ 「采样峰值 > 真峰值」是**物理不可能**的。这一类**不需要口径判断**（定义使然）
 *      ⇒ 是本闸门最可靠的一类。两种形式都查：
 *        (a) **数据级**：json 自相矛盾 —— `samplePeakDbfs > truePeakDbtp`；
 *        (b) **声称级**：同一句里同时给出「采样峰值」与「真峰值」，且采样峰值 > 真峰值。
 *      容差 **0.1 dB**（不是 0）：`loudnorm input_tp` 只印 2 位小数（舍入 ≤ 0.005）、`ebur128 Peak` 只印
 *      1 位小数（舍入 ≤ 0.05）⇒ 舍入伪影最大 0.05。★ 实测本库 43 部里「采样峰值 > input_tp」的 **5 部
 *      全部是舍入伪影**（Δ ≤ 0.004：`risograph` +0.004、`ascii-crt` +0.003、`backrooms`/`paper-popup`/
 *      `rubber-hose` +0.001）⇒ 取 0.1 恰好压掉伪影，又远小于真陈旧的量级（≥ 0.5）。实测本库该类命中 **0**。
 *   ★ 另单列「失明」（读不到真值的风格 / 量纲）与「静音读数 / 参考」项，供人工判断。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 各量纲的「误报率实测 → 收窄/降级」中间数据（2026-10-05，43 份正文 / 全量实测）
 * ══════════════════════════════════════════════════════════════════════════════
 * 实测口径 = `ffprobe`（分辨率/帧率/帧数/时长/字节）+ `loudnorm` 的 `input_tp`/`input_i`/`input_lra`
 *   + `ebur128` 的 `LRA`，逐风格与 json 逐项核对：**43/43 全部一致**（json 可当真值）。
 *
 *  · **dBTP（真峰值）**：沿用旧判据（容差 0.15）。命中 0 / 真陈旧 0 / 误报 0。
 *    ★ 旧版 3 处真陈旧（`halftone-dossier:186` −2.79/实测 −3.26、`hd-2d:299` −1.54/−3.21、
 *      `watercolor:105` −1.72/−3.34）已于上一轮按实测改正。
 *  · **LUFS（响度）**：244 个 token ⇒ 阈值 18 / 无成片语境 20 / 历史 33 / 非本片产物 9 ⇒
 *    **初版命中 7**，逐条人工过：**真陈旧 0 / 误报 7（100%）**。
 *    7 条误报的型（全部由本闸门新加的守卫挡下）：
 *      (i) `−70.0 LUFS` ×4（`brick-toy:105/168/209`、`game-show:206`）= 首版**数字静音**读数
 *          ⇒ ①值域（≤ −50 ⇒ 静音读数，单列参考）；
 *      (ii) `engraving:106` 的 `−14` = 引用 `STYLE.md:69` 的**交付目标** ⇒ ②(a)（== 交付线 −14）；
 *      (iii) `engraving:184` 的 `−18.0` = `mix integrated`（混音产物）⇒ ⑦（裸 `mix`）；
 *      (iv) `pictogram-motion:174` 的 `−14.09` = 逐档扫描实验行的**中间档读数** ⇒ ⑥（行级实验行）。
 *    ⇒ 全部挡下后**命中 0 / 误报 0**。
 *    ★★ **容差必须「按关系」——用非对称带**（这是本量纲的第二个口径问题，实测得出）：
 *      正文里的响度读数有两种口径 —— `loudnorm` 的 `input_i`（json 存的、也是本闸门真值）与
 *      `ebur128` 的 `I`（正文常引用）。**实测 43 部**：`ebur128 I − loudnorm input_i` ∈ **[0, 0.30]**
 *      （单调非负；p100 = 0.30，如 `spy-titles` −13.9 vs −14.2、`one-line` −14.2 vs −14.48）。
 *      ⇒ 若用对称容差 0.15，`blueprint:163`（−13.9，ebur128 实测就是 −13.9）、`rubber-hose:102`
 *        （同）、`silkscreen-poster:244`（−14.5，ebur128 实测 −14.5）会被误报 ⇒ 实测 **3 真陈旧 / 3 误报（50%）**。
 *      ⇒ 改用**非对称带 `[−0.15, +0.30]`**（下界 = 读数精度，上界 = 实测口径差上界）：
 *        **命中 1 / 真陈旧 1（`risograph:169` 的 −13.9，实测 −14.5，Δ0.6）/ 误报 0**。
 *      ⇒ 落在**带内上侧 (0.15, 0.30]** 的 token 单列「**口径带内**」参考桶（不判 FAIL，供人工复核）——
 *        实测 3 例：`silkscreen-poster:244`（Δ0.17，经 ebur128 复核 **−14.5 完全吻合 ⇒ 合法**）、
 *        `crayon-book:176`（Δ0.20，ebur128 实测 −14.3 / loudnorm −14.3 ⇒ **两个口径都不符 ⇒ 真陈旧**）、
 *        `paper-popup:215`（Δ0.30，ebur128 −14.3 / loudnorm −14.34 ⇒ **真陈旧**）。后两条已按实测改正。
 *  · **LRA**：88 个 token ⇒ 成片语境 & 非历史 & 非本片产物 **34** 个。
 *    ★ **口径感知**（本量纲必须「按关系」的地方）：正文**自己声明**口径时才判 ——
 *      声明 `ebur128` 的 11 个 token，**Δ 分布 max 0.2 / p90 0 / p50 0**（同一文件同一命令，可复现）
 *      ⇒ 用**紧容差 0.1**：命中 **1**（`watercolor:105` 的 `LRA 6.8`，实测 6.6）**真陈旧 1 / 误报 0**。
 *    ★ **未声明口径 ⇒ 降级为「参考」**（实测依据）：LRA 两种口径系统性相差很大 ——
 *      实测 43 部里 `loudnorm input_lra − ebur128 LRA` 最大 **1.4 LU**（`risograph` 5.4 vs 4.0、
 *      `art-deco` 4.9 vs 3.5），而 json **只存 ebur128 一个口径** ⇒ 未声明口径的读数**没有可比对的第二个真值**。
 *      实测 3 例未声明口径的 LRA：`risograph:169` 的 `5.3`（loudnorm 实测 5.4 ⇒ **合法**，ebur128 4.0 会误报；
 *        本轮已按 loudnorm 实测改正为 `5.4`，仍是参考桶成员）、
 *      `hd-2d:120` 的 `10.30`（ebur128 8.8 / loudnorm 9.8，**两个口径都对不上 ⇒ 存疑**，如实登记不判）、
 *      `blueprint:163` 的 `4.5`（ebur128 3.4 / loudnorm 3.1 ⇒ **真陈旧**，已按实测改正为 `3.4`）。
 *      ⇒ 若强行按 ebur128 单口径判，误报率 **1/3 = 33%** ⇒ 按纪律降级为「参考」。
 *      ⇒ ★ **声明 `loudnorm` 口径**的样本实测 **0 例**；该分支同样无真值来源，单列参考（覆盖缺口）。
 *    ★ 抽取正则**必须要求 `LRA` 字面量在前**（`LRA\s*[=:：]?\s*<数>`）：裸 `<数> LU` 是噪声源 ——
 *      实测 23 个裸 token 里 10 个是「**比目标高/低 X LU**」这类**差值**（`blueprint:163`/`cel-anime-80s:102`/
 *      `crayon-book:176`/`silkscreen-poster:244` 的 `0.1/0.08/0.5 LU`）或「**大于同批其他风格（3.5 / 4.6 LU）**」
 *      （`midcentury-toon:170`），不这么收窄则误报率 ≥ 90%。
 *    ★ 另需排除**`loudnorm` 的参数写法**：`loudnorm I=-14:TP=-1.2:LRA=11` 里的 `LRA=11` 是**参数**不是读数
 *      （实测误报 `paper-popup:196`）⇒ 该 token 前 80 字内出现 `loudnorm` 即排除。
 *  · **字节数（B / 字节，带千分位）**：62 个 token ⇒ 无成片语境 13 / 历史 10 / 非本片产物 13 ⇒
 *    **命中 13**，逐条人工过：**真陈旧 12 / 误报 1（7.7%）**。
 *    唯一误报 `hd-2d:117` 的 `4,757,610 B` = **配乐源文件** `music/src/sb_precipice.mp3` 的大小
 *    ⇒ ⑦ 补 `源文件|.mp3|.wav|.flac|.m4a` 后 **命中 12 / 误报 0**。
 *    ★ 容差 0（整数字节，精确对账）。
 *  · **dBFS（峰值电平，2026-10-05 纳入）**：全库 **149 个** `<数> dBFS`。
 *    ★★ **本量纲的难点是「口径歧义」——同一串数字有三个口径**（实测口径词分布，按 token 邻窗 ±45 字）：
 *      `ebur128 Peak`（32）/ `astats|采样峰值|sample peak`（39）/ `loudnorm input_tp|真峰值|dBTP|TPK`（42）/
 *      `RMS`（9）/ **无口径词**（27）。⇒ 必须「**口径感知 + 多真值**」才谈得上对账（与 LRA 同型问题）。
 *    ★ 真值（**双真值 + 一个派生真值**，全部来自既有 json 字段，不另跑 ffmpeg）：
 *      · `samplePeak` = `audioEvidence.measuredInFilm.{samplePeakDbfs,astatsPeak6dp}` ??
 *        `selfCheck.loudness.samplePeakDbfs`（**43/43 都有**）；实测与 `astats` 逐片一致（43/43）。
 *      · `truePeak`   = `selfCheck.loudness.truePeakDbtp`（= `loudnorm input_tp`，**已有 dBTP 量纲在管**）。
 *      · `ebur128Peak`= **`round(truePeak, 1)`** —— ★ **实测 43/43 逐个相等**（`ebur128=peak=true` 的 `Peak`
 *        只印 1 位小数，而它与 `input_tp` 是同一部片的两个真峰值估计，1 位小数下完全一致）。
 *        ⇒ 不引入新的测量来源，也不新增 json 字段，就能把「1 位小数口径」判起来。
 *    ★ 口径词 → 真值（**在「所在句」内取离 token 最近的口径词**，±45 字内）：
 *      `astats|采样峰值|sample peak` ⇒ `samplePeak`（容差 **0.01**，见下「夹取伪影」）；
 *      `ebur128|Peak` ⇒ `ebur128Peak`（容差 **0.001**：真值已舍入到 1 位，与文档 1 位读数应精确相等）；
 *      `input_tp|真峰值|dBTP|TPK` ⇒ `truePeak`（容差 0.15，与 dBTP 量纲同源）；
 *      `RMS` ⇒ **参考**（电平不是峰值读数，本闸门无 RMS 真值）；
 *      **无口径词** ⇒ ★ **最保守**：与**任一**真值相符（±0.15）即放行，否则**单列参考、不判 FAIL**。
 *    ★★ **误报率实测（逐级收窄，全部在真实树上跑、逐条人工过）** —— 这是「先测误报率再定判据」的铁律：
 *      | 判据 | 命中 | 真陈旧 | 误报 | 误报率 |
 *      |---|---|---|---|---|
 *      | 放宽（无值域 / 无口径感知 / 成片语境恒真） | 20 | 0 | 20 | **100%** |
 *      | 朴素单真值（= `input_tp`，容差 0.15） | 4 | 0 | 4 | **100%** |
 *      | ＋口径感知（**「窗口内首个命中」选口径**） | 8 | 0 | 8 | **100%** |
 *      | 最终判据 −「历史引用」降级 | 1 | 0 | 1 | **100%** |
 *      | **最终判据** | **0** | **0** | **0** | **0%** |
 *      ⇒ 每一级都**必须**收窄，少一级就回到 100% 误报。三处关键收窄：
 *      ① **值域**：`≤ −100 dBFS` ⇒ 数字零 / 静默段读数（实测 4 个 `−240 dBFS` token）；
 *      ② **口径按「最近」而不是「窗口内首个」**：实测 `tilt-shift:104` 的 `Peak -1.6 dBFS`（ebur128 1 位读数）
 *         后面 20 字处才提 `astats 采样峰值 −1.588653`，用「首个命中」会把它误判成采样峰值 ⇒ 8 条误报全是
 *         这一型（`dark-keynote:103`/`engraving:106`/`lowpoly-island:98`/`midcentury-toon:102`/`paper-lantern:117`/
 *         `tilt-shift:104`/`whiteboard:101`/`woodcut:95`）；
 *      ③ **「历史引用」降级**（`mismatchWhy`）：数值被明确标注为**旧版本读数**时单列参考 —— 实测
 *         `watercolor:105` 的 `−1.716 dBFS` 是「（`−1.716380` 是**重渲前版本的读数，已不适用**）」的历史引用，
 *         该行同时给出当前值 `−3.350128`（**已符合**项目「保留原句 + 历史标记 + 补现值」的形态）⇒ 不降级即误报。
 *      ④ **采样峰值容差 0.01（不是 0）**：`fix-truepeak.mjs` 会把 `samplePeakDbfs` **夹到** `truePeakDbtp` 以内
 *         （后者只存 2 位小数 ⇒ 夹取伪影 ≤ 0.005，见该脚本头注释的「精度陷阱」）⇒ 正文写 6 位
 *         `−3.106276`、json 存夹取后的 `−3.11`（Δ 0.0037）。0.01 覆盖该伪影，仍远小于真陈旧量级（≥ 0.03）。
 *    ★ 本库实测**真陈旧 0 处**（上一轮已按实测把 `paper-lantern` 的 `TPK −1.7 dBFS`→`−3.4` 等人工穷举修掉）
 *      ⇒ 本轮 dBFS **未改任何文档**；闸门价值在于**此后不再失明**。
 *    ★ 变异验证（临时树 + `LEMO_DISTILL_ROOT`，**不动真实文档**）：
 *      ① dBFS 真阳性（`paper-lantern:117` 的 `astats` 采样峰值 `−3.385`→`−3.35`）⇒ **FAIL 1 并点名**；
 *      ② 口径感知（`whiteboard:101` 的 `ebur128 Peak −1.6`→`−1.7`，差 **1 位小数**）⇒ **FAIL 1**；
 *        同一句若只差 0.02（与 `input_tp` 的纯舍入）⇒ **不报**（证明是**按 1 位小数口径**比，不是拿 `input_tp` 苛求）；
 *      ③ 物理约束（声称级 + 数据级）⇒ **FAIL 各 1**；阴性对照（采样峰值 < 真峰值）⇒ **0**；
 *      ④ 失明（真值来源 `{}` / 空树 / 坏 JSON）⇒ 逐量纲报「已失明」exit 1。
 *  · **MB（体积）**：87 个 token ⇒ **命中 11**，逐条人工过：**真陈旧 0 / 误报 11（100%）**。
 *    11 条全是「**首版成片** / `video_gpu.mp4`（混流前中间产物） / x264 实验（900 MB、280 MB）」
 *    这类他版或中间产物读数（`paper-lantern:219`、`watercolor:190`、`pictogram-motion:196`、
 *    `risograph:172`、`scifi-toon:187`、`silent-film:204`、`silkscreen-poster:209`、`woodcut:158`）。
 *    ★ 要压到 0 误报必须再加 `首版|旧版|video_gpu|x264|crf` 一串排除词，而**排除词越长、假阴风险越大**
 *      （如「首版成片 45.2 MB，修复后 51.1 MB」同句会被整句放掉）⇒ **按纪律降级为「参考」**，不进退出码。
 *      ★ MB 本就是**四舍五入的近似值**（`59,360,035 B ≈ 56.6 MiB`），精确对账由 **B（整数字节）**承担。
 *  · **时长（`<数>s`）**：1836 个 token ⇒ 无成片语境 1433 / 历史 27 / 非本片产物 15 ⇒ **命中 65**，
 *    逐条人工过：**真陈旧 0 / 误报 65（100%）** —— 全是**出片耗时 / 片段时长 / 静帧超时 / 音频链耗时**
 *    （`lowpoly-island:143` 的 `207s`/`213.9s`/`237.2s`、`microgame:149` 的 `28s`/`46.2s`/`70.4s`、
 *    `urban-sketch:165` 的 `still waiting ... after 20 s`、`engraving:184` 的 `7.538s/2.585s/15.955s`）。
 *    ⇒ **降级为「参考」**，不进退出码（与 `check-skill-film-fields.mjs` 的实测结论一致）。
 *  · **分辨率（`W×H`）**：435 个 token ⇒ 与成片 1920×1080 不符的 163 个**全部**落在不含「成片/全片/本片」
 *    的行上 ⇒ 加 ④（整行成片语境）后 **命中 0**。★ 但「整行成片语境 + 容差 0」仍抓到 **2 处误报**，
 *    必须再加**位置守卫**（实测得出，`check-skill-film-fields` 的 HYPO 表挡不住这两条）：
 *      (i) `engraving:46` 的 `1080×1920` = 「**9:16 = 1080×1920 时** `fx=…`」的画幅**推导**（`=` 紧贴在前）
 *          ⇒ 守卫「紧贴前置 `=`」；
 *      (ii) `silkscreen-poster:37` 的 `1800×440` = **场景单位**的元素尺寸（「一张 1800×440 **u** 的横版 banner」）
 *          ⇒ 守卫「紧贴后置 `u`（场景单位，不是像素）」。
 *    ⇒ 加这两条后 **命中 0 / 真陈旧 0 / 误报 0**；容差 0。
 *    ★ 逐量纲 `exclude`（⑧，HYPO）在本库实测**零边际**，作为 `check-skill-film-fields.mjs`
 *      实测必要的守卫**继承**（纵深防御）。
 *  · **帧数（`<数>帧`）**：命中 **0**（含 `exclude` ⑧ 后）。容差 0。★ 旧版由
 *    `check-skill-film-fields.mjs` 承担（它当初为压掉「demo 原生 900 帧 / 样片 7980 帧」那类误报，
 *    实测最宽判据误报率 57.7%，收窄后 0），本闸门把它**并入同一套流水线**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 本轮（2026-10-05）按实测改正的真陈旧读数（穷举，不只是首轮闸门报的那几条）
 * ══════════════════════════════════════════════════════════════════════════════
 *   口径：真峰值/响度 = `loudnorm` 的 `input_tp`/`input_i`（4× 过采样）；LRA = `ebur128`；
 *         采样峰值 = `astats`；字节 = 磁盘 stat；分辨率/帧率/帧数/时长 = `ffprobe`。
 *   · **字节数 12 处**（现值句直接换实测值）：`art-deco:191` 43,844,155→43,828,408、
 *     `backrooms:222` 30,386,381→30,403,182、`blueprint:202` 46,063,127→46,060,737、
 *     `crayon-book:219` 36,912,520→36,904,027、`game-show:196` 91,187,233→91,211,840、
 *     `stained-glass:223` 32354231→32346602、`watercolor:190/192/214` 51,107,756→51,106,197、
 *     `paper-lantern:219/266` 59,657,832→59,360,035、`paper-popup:215` 93,346,551→93,293,467。
 *   · **响度**：`risograph:169` −13.9→−14.5（loudnorm 实测；ebur128 −14.4）、
 *     `crayon-book:176` −14.1→−14.3、`paper-popup` 的 `−14.04`→`−14.34`（5 行）。
 *   · **LRA**：`watercolor:105` 6.8→6.6（ebur128）、`blueprint:163` 4.5→3.4。
 *   · **真峰值 / 采样峰值（dBFS，本闸门**不覆盖**的 dBFS 量纲，人工穷举）**：
 *     `paper-lantern` 的 `TPK −1.7 dBFS`→`−3.4`（8 处）、`LRA 3.4`→`3.2`（4 处）、
 *     `astats −1.668`→`−3.385`（3 处）、`−1.668024`→`−3.384677`、`−1.706245`→`−3.428516`、
 *     `−1.66 dBTP`→`−3.37`、`过冲 +0.03/+0.032 dB`→**未过冲（低 1.67 dB）**、
 *     `121.750000`→`121.791667`、`nb_frames=2922`→`2923`（该片 2026-10-04 多比例重渲）。
 *   · **`paper-popup` 真峰值**：`−1.65 dBTP`→`−2.33`（6 处）。
 *   · ★★ **本轮（2026-10-05 下半场）把 `dBFS` 纳入后，实测真陈旧 0 处 ⇒ 未改任何文档**
 *     （上一轮已按实测人工穷举修掉 `paper-lantern` 的 `TPK −1.7 dBFS`→`−3.4` 等）；本轮的产出是
 *     **把这个量纲接进闸门**（此后不再失明），不是改数值。
 *   · **risograph / blueprint 的「已修」链**（`−1.96` / `−1.74`）本身也已陈旧 ⇒ 按项目做法
 *     **保留原句 + 加 `原记` + 补现值**（实测 `−3.11` / `−2.40`；两片均于 2026-10-04 多比例重渲）。
 *   · **`_distill.json` 的散文 / 旁证字段**（本闸门只读结构化字段，不覆盖这些）：
 *     `paper-lantern.audioEvidence.measuredInFilm`（lra 3.4→3.2 / truePeakDbfs −1.7→−3.4 /
 *     astatsPeak6dp −1.668024→−3.384677 / 分道 / overshoot 0.032→−1.68）+ `peakNote` 的 `-1.66`→`-3.37`；
 *     `watercolor.audioEvidence.measuredInFilm.lra` 6.8→6.6；`samplePeakDbfs` **5 份陈旧**
 *     （`risograph`/`blueprint`/`dataviz`/`microgame`/`papercut-red`，旧值甚至 > 同片 `truePeakDbtp`）。
 *   ★ 变异验证（临时树 + `LEMO_DISTILL_ROOT` / `LEMO_READINGS_MEASURED_JSON`，**不动真实文档**）：
 *     ①新量纲真阳性（bytes/LRA/LUFS 各改一处 ⇒ FAIL 3 并点名）；②旧量纲仍有效（dBTP 改超线 ⇒ FAIL 1）；
 *     ③阈值/交付线提及不误报（注入 `−1.2 dBTP`/`−14 LUFS` 行 ⇒ FAIL 0，阈值桶 +2）；
 *     ④失明（真值来源 `{}` ⇒ 逐量纲报「已失明」exit 1；坏 JSON / 空风格树 ⇒ 报「本闸门已失明」exit 1）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 仍**未覆盖 / 仍存疑**的量纲与表面（如实登记，供下一轮）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · ★ **dBFS 已于 2026-10-05 纳入**（见上「各量纲的误报率实测」里的 dBFS 一节）；本轮实测**真陈旧 0**。
 *     仍**未覆盖 / 仍存疑**的 dBFS 表面（如实登记，供下一轮）：
 *     (a) **`mix.wav` / `score.wav` / 素材的 dBFS 读数**：按设计由 ⑦ 排除、**不判 FAIL** —— 它们陈旧与否没有闸门管
 *         （实测约 25 个 token 属此类，如 `pixel-rpg:119` 的 `mix.wav −1.0122 dBFS`、`engraving:108` 的限幅前峰值）；
 *     (b) **无口径词的 dBFS**：按纪律降级为「参考」（不判 FAIL）⇒ 实测本库这类 token 全被 ④/⑦/① 先挡下，
 *         **参考桶里 0 例**（等于该分支目前无实据可依，属保守留白）；
 *     (c) **RMS / 差分 RMS 口径**：`−32.6 dBFS`（`lowpoly-island:122`）等，无 RMS 真值 ⇒ 参考；
 *     (d) **`ebur128Peak = round(input_tp, 1)` 这条派生规则本身**：实测 43/43 成立，但**不是物理恒等式**
 *         （两个真峰值估计量各自实现）⇒ 若未来某片落在 1 位小数的舍入边界两侧（`ebur128` 印 −3.1 而
 *         `input_tp` 为 −3.15），会误报。**届时的正解是给 json 补一个实测 `ebur128Peak` 字段**，不是放宽容差；
 *     (e) **`≤ −100 dBFS` 值域阈值**是实测归纳（本库 4 个 `−240 dBFS` 全是数字零），不是定义式。
 *   · **`nb_frames=` 这类「非『数+单位』写法」**：正则要求 `<数>帧`，`nb_frames=2922` **看不见**
 *     （实测 `paper-lantern:186/266` 就是这样漏掉的，已人工修）。同类还有 `duration=`、`bitrate=`。
 *     ★ dBFS 同理：`astats` 的 6 位读数在正文里常**不带单位**（`astats 采样峰值 −1.638909 是下界`）
 *     ⇒ 这类写法**本闸门看不见**（实测 `dark-keynote:103`/`whiteboard:101` 等 8 处）。
 *   · **`_distill.json` 的散文 / 旁证字段**（`peakNote` / `audioEvidence.*` / `samplePeakDbfs`）：
 *     本闸门只读结构化字段（见上「真值来源」）⇒ 由**人工穷举**修。
 *     ★ 2026-10-05 实测发现：`fix-truepeak.mjs` 会按设计把 `samplePeakDbfs` **夹到** `truePeakDbtp` 以内
 *     （2 位小数精度陷阱）⇒ json 里的 `samplePeakDbfs` 对 5 片（`ascii-crt`/`backrooms`/`paper-popup`/
 *     `risograph`/`rubber-hose`）**不等于** `astats` 实测的 6 位值（差 ≤ 0.004）。这是**有意为之**的
 *     自洽化，不是缺陷，但会让「json == 实测」在本字段上**不成立**（见下方 dBFS 容差 0.01 的处理）。
 *   · **存疑**：`hd-2d:120` 的 `LRA 10.30`（ebur128 8.8 / loudnorm 9.8，两个口径都对不上）
 *     —— 如实登记为「参考」，不判。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 与 `check-skill-film-fields.mjs` 的关系（**必须说清，避免两套判据分叉**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · 帧数 / 分辨率 / 时长 三类此前由 `check-skill-film-fields.mjs` 单独承担（它是 `check-tp-prose`
 *     思路的一次手工复制）。本闸门把这三类**并入统一登记表**（判据逐条继承，见 ⑧ 与各登记项）。
 *   · ★ 该脚本**不在本次可改范围**（`scripts/` 下只允许改本文件），所以两闸门**暂时重叠** ——
 *     实测两者结论一致（均为 0 FAIL），不存在分叉。**建议后续把它退化为本闸门的登记项**
 *     （删除重复实现），本次不做（越界）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 失明守卫（与 `check-film-delivery.mjs` / `check-skill-film-fields.mjs` 同源）
 * ══════════════════════════════════════════════════════════════════════════════
 *   本闸门的**真值来源**是逐风格 `_distill.json`。旧版对「读不到真值」是**静默跳过**
 *   （`Math.abs(v - undefined)` = `NaN` ⇒ 永不 `continue` 的「不符」分支也进不去 ⇒ 假绿）。
 *   现改为**逐量纲**判定：
 *     · 某个量纲在**全部**风格上都读不到真值 ⇒ FAIL 并明说「**<量纲> 已失明**」；
 *     · 一个风格都枚举不到 ⇒ FAIL 并明说「**本闸门已失明**」；
 *     · 单个风格读不到某量纲的真值 ⇒ 单列「失明」统计（其余量纲仍判）。
 *
 * ★ 变异覆盖点（便于非破坏性验证，登记于 `test/README.md` 与 `_distill/AGENT-BRIEF.md`）：
 *   · `LEMO_DISTILL_ROOT` —— 风格技能树根（**正文源 + 真值源**），默认 `<脚本>/../lib/style-skills`。
 *     把整棵树指向**临时拷贝**即可构造「真陈旧声称」样本，**绝不动真实文档**。
 *   · `LEMO_READINGS_MEASURED_JSON` —— 真值来源整体覆盖：一个 JSON 文件
 *     `{ "<slug>": { "dBTP":数, "LUFS":数, "LRA":数, "bytes":数, "durSec":数, "width":数, "height":数, "frames":数,
 *                    "dBFS":{ "samplePeak":数, "truePeak":数, "ebur128Peak":数 } } }`。
 *     一旦设置，真值**只**取自该文件（缺字段 ⇒ 该风格该量纲失明；`dBFS` 的**三个口径全缺**才算该风格失明）。
 *     指向 `{}` 即可验证失明守卫。
 *   · `LEMO_TP_MEASURED_JSON` —— 旧覆盖点（**保留兼容**）：`{ "<slug>": 数 }`，只覆盖 dBTP。
 *
 * 用法：node scripts/check-tp-prose.mjs
 * 退出码：0 = 无「陈旧且非历史语境」的成片读数声称（实验行/交叉引用/参考/失明项不影响退出码）；
 *         1 = 有 FAIL，或**某个量纲已失明 / 本闸门已失明**（枚举不到风格）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(HERE, '..', 'lib', 'style-skills'));
const MEASURED_JSON = process.env.LEMO_READINGS_MEASURED_JSON
  ? path.resolve(process.env.LEMO_READINGS_MEASURED_JSON) : '';
const TP_MEASURED_JSON = process.env.LEMO_TP_MEASURED_JSON
  ? path.resolve(process.env.LEMO_TP_MEASURED_JSON) : '';

// ── 共享机制（**一套**，所有量纲复用） ────────────────────────────────────────
/** ⑤ 历史语境标记（整行判定；这些行很长，`已修` 子句常在行尾） */
const HIST = /已修|原为|原记|原先|曾是|曾为|历史|修复前|修复后|校正|拆分|移入|resolvedDefects/;
/** ⑦ 非本片产物（该数值**所在句**判定；上游 / 中间产物 / 素材的读数不是对成片的声称） */
const NONFILM = /(?:mix(?:\.wav)?|score\.wav|母带|中间产物|上游|样片|素材|源文件|\.mp3|\.wav|\.flac|\.m4a)/;
/** ④ 成片语境（默认整行） */
const CTX = /成片|全片|本片/;
/** ⑥ 实验 / 扫描行签名：整行 ≥2 组「箭头 → 数值 + 已登记单位」 */
const SCAN = /(?:→|⇒|->)[^→⇒\n]{0,12}?[+−-]?\d+(?:\.\d+)?\s*(?:dBTP|LUFS|LU|dBFS)/g;
/** ② 阈值词「紧贴」数值：两侧各 ≤6 字，且**分隔符不得跨越** */
const SEP = '[^，。；、｜|]';
const THRESH_BEFORE = new RegExp(`(?:交付线|交付上限|交付目标|交付判据|上限|目标|天花板|判据|标准|不超过|不得超过|≤|<=)${SEP}{0,6}$`);
const THRESH_AFTER = new RegExp(`^${SEP}{0,6}(?:交付线|上限|以内|之内|天花板)`);
/** 取「包含下标 idx 的那一句」—— ⑦ 用它判定「这个读数是不是上游/中间产物的」 */
const sentenceOf = (line, idx) => {
  const marks = [...line.matchAll(/[。！？]/g)].map((x) => x.index);
  let a = 0;
  for (const k of marks) { if (k < idx) a = k + 1; else break; }
  const tail = line.slice(a);
  const e = tail.search(/[。！？]/);
  return e === -1 ? tail : tail.slice(0, e + 1);
};
/** 同上，但返回**句子的 [起, 止) 下标**（口径词要按「离 token 最近」选，需要绝对位置） */
const sentenceBounds = (line, idx) => {
  const marks = [...line.matchAll(/[。！？]/g)].map((x) => x.index);
  let a = 0;
  for (const k of marks) { if (k < idx) a = k + 1; else break; }
  const rest = line.slice(a);
  const e = rest.search(/[。！？]/);
  return [a, e === -1 ? line.length : a + e + 1];
};
/** ⑧ 逐量纲附加排除（继承 `check-skill-film-fields.mjs` 的实测结论） */
const NATIVE = /原生|样片|demo|DEMO|入库前|未渲|设计稿|风格声明|on ones/;
const HYPO = /硬渲|渲成|裁|塞在|竖屏|内部|内含|超采样|世界|场景|片门|模板|画布|渲染|若|如果|原生|帧缓冲|索引|缓冲/;

const num = (t) => Number(String(t).replace('−', '-'));

// ── ★ 量纲登记表：**加一种量纲 = 加一条登记**（不再加一条判据） ─────────────────
//   mode='fail' 判 FAIL；mode='ref' 只列「参考」不进退出码（依据见头注释的误报率实测）。
//   tolUp（可选）= 非对称上界（口径差实测上界），落在 (tol, tolUp] 的 token 单列「口径带内」参考桶。
//   nearExclude（可选）= 位置相关排除（用「按关系」的方式，不堆字面量）。
const DIMS = [
  {
    key: 'dBTP', label: '真峰值', unit: 'dBTP', mode: 'fail', tol: 0.15,
    re: /([+−-]?\d+(?:\.\d+)?)\s*dBTP/g,
    truth: (j) => j?.selfCheck?.loudness?.truePeakDbtp,
    target: (j) => j?.selfCheck?.loudness?.peakDbtpTarget,   // 交付线（本库 43/43 = −1.2）
    num,
  },
  {
    key: 'LUFS', label: '响度', unit: 'LUFS', mode: 'fail', tol: 0.15, tolUp: 0.30,
    re: /([+−-]?\d+(?:\.\d+)?)\s*LUFS/g,
    truth: (j) => j?.selfCheck?.loudness?.integratedLufs,
    target: () => -14,                                        // 项目交付线（与 check-film-delivery 同源）
    num,
    // ① 值域：交付成片的整合响度不可能 ≤ −50 LUFS ⇒ 那是「静音 / 占位文件」的读数
    plaus: (v) => (v <= -50 ? '静音 / 占位读数（≤ −50 LUFS，非交付声称）' : null),
  },
  {
    key: 'LRA', label: 'LRA', unit: 'LU', mode: 'fail', tol: 0.8,
    // ★ 抽取**必须要求 `LRA` 字面量在前**：裸 `<数> LU` 全是「比目标高 X LU」这类**差值**（实测 23 个里 10 个误报）
    re: /LRA\s*[=:：]?\s*([+−-]?\d+(?:\.\d+)?)/g,
    truth: (j) => j?.selfCheck?.loudness?.lra,                 // 口径 = ebur128（见 json 的 lraMethod）
    num,
    // ★ 口径感知：正文**自己声明**口径时才判；未声明/声明 loudnorm ⇒ 参考（json 只有 ebur128 一个口径）
    //   声明 ebur128 ⇒ 紧容差 0.1（同一文件同一命令，实测 Δ 分布 p90=0 / max=0.2）
    tolFor: (cal) => (cal === 'ebur128' ? 0.1 : 0.8),
    caliber: (line, idx, len) => {
      const near = line.slice(Math.max(0, idx - 14), idx + len + 14);
      if (/ebur128/.test(near)) return 'ebur128';
      if (/loudnorm|input_lra/.test(near)) return 'loudnorm';
      return null;
    },
    // `loudnorm I=-14:TP=-1.2:LRA=11` 里的 `LRA=11` 是**参数**不是读数
    nearExclude: (line, idx) => /loudnorm[^\n]{0,80}$/.test(line.slice(Math.max(0, idx - 80), idx)),
  },
  {
    key: 'bytes', label: '字节数', unit: 'B', mode: 'fail', tol: 0,
    re: /([0-9][0-9,]{4,})\s*(?:B\b|字节)/g,
    truth: (j) => j?.generatedVideo?.bytes,
    num: (t) => Number(String(t).replace(/,/g, '')),
  },
  {
    key: 'WxH', label: '分辨率', unit: '', mode: 'fail', tol: 0,
    re: /(\d{3,4})\s*[×x]\s*(\d{3,4})/g,
    truth: (j) => (Number.isFinite(j?.generatedVideo?.width) && Number.isFinite(j?.generatedVideo?.height)
      ? `${j.generatedVideo.width}×${j.generatedVideo.height}` : undefined),
    num: (t) => t,
    ctx: /成片|全片|本片|交付|输出/,                            // 与 check-skill-film-fields 同源
    exclude: HYPO,
    // 位置守卫：(i) 紧贴前置 `=` ⇒ 画幅推导（`9:16 = 1080×1920 时`）；
    //           (ii) 紧贴后置 `u` ⇒ 场景单位（`1800×440 u` 的 banner），不是像素画幅
    nearExclude: (line, idx, len) => /=\s*$/.test(line.slice(Math.max(0, idx - 3), idx))
      || /^\s*u\b/.test(line.slice(idx + len, idx + len + 3)),
  },
  {
    key: 'frame', label: '帧数', unit: ' 帧', mode: 'fail', tol: 0,
    re: /(\d{3,5})\s*帧/g,
    truth: (j) => j?.generatedVideo?.frames,
    num: Number,
    ctx: /成片|全片|本片|帧数|帧率|入库版/,                      // 与 check-skill-film-fields 同源
    exclude: NATIVE,
  },
  {
    // ★★ dBFS（2026-10-05 纳入）：文档里的 dBFS **混用三个口径**（实测），必须「口径感知 + 双真值」。
    //   真值来源：json 同时给三个口径的峰值真值（见 `truths`）——
    //     · samplePeak   = `selfCheck.loudness.samplePeakDbfs`（astats 采样峰值；17/43 有）
    //                      / `audioEvidence.measuredInFilm.samplePeakDbfs` 优先；
    //     · truePeak     = `selfCheck.loudness.truePeakDbtp`（= loudnorm input_tp，4× 过采样，项目口径）；
    //     · ebur128Peak  = **`round(truePeak, 1)`** —— ★ 实测 43/43：`ebur128` 的 `Peak`（只印 1 位小数）
    //                      与 `round(input_tp, 1)` **逐个相等**（依据见头注释「dBFS 口径」一节）。
    //   口径词 → 真值：`astats|采样峰值|sample peak` ⇒ samplePeak；`ebur128|Peak` ⇒ ebur128Peak；
    //     `input_tp|真峰值|dBTP|TPK` ⇒ truePeak；`RMS` ⇒ 参考（电平不是峰值）；**缺口径词 ⇒ 参考**（最保守）。
    key: 'dBFS', label: '峰值电平(dBFS)', unit: 'dBFS', mode: 'fail', tol: 0.15,
    re: /([+−-]?\d+(?:\.\d+)?)\s*dBFS/g,
    truths: (j) => {
      const tp = j?.selfCheck?.loudness?.truePeakDbtp;
      const ae = j?.audioEvidence?.measuredInFilm || {};
      return {
        // astats 采样峰值：`samplePeakDbfs`（selfCheck / audioEvidence）与 `astatsPeak6dp` 两个既有字段名
        samplePeak: ae.samplePeakDbfs ?? ae.astatsPeak6dp ?? j?.selfCheck?.loudness?.samplePeakDbfs,
        truePeak: tp,
        ebur128Peak: Number.isFinite(tp) ? Number(tp.toFixed(1)) : undefined,
      };
    },
    num,
    // ① 值域：≤ −100 dBFS ⇒ 数字零 / 静默段读数（实测本库 4 个 `−240 dBFS` token 全属此类）
    plaus: (v) => (v <= -100 ? '数字零 / 静默段读数（≤ −100 dBFS，非交付峰值声称）' : null),
    // 口径感知：在**所在句**内找口径词，取**离 token 最近**的一个（±45 字内）。
    //   ★ 必须「最近」而不是「首个命中」：实测 `tilt-shift:104` 的 `Peak -1.6 dBFS`（ebur128 1 位读数）
    //     后面 20 字处才提 `astats 采样峰值 −1.588653`，用「窗口内首个命中」会把它误判成采样峰值 ⇒ 误报。
    caliber: (line, idx, len) => {
      const [a, b] = sentenceBounds(line, idx);
      const sent = line.slice(a, b), off = idx - a;
      const W = [
        [/astats|采样峰值|sample\s*peak|\bPeak level dB/gi, 'samplePeak'],
        [/ebur128|\bPeak\b/gi, 'ebur128'],
        [/input_tp|真峰值|dBTP|\bTPK\b/gi, 'truePeak'],
        [/\bRMS\b|\brms\b/gi, 'rms'],
      ];
      let best = null;
      for (const [re, name] of W) {
        for (const m of sent.matchAll(re)) {
          const d = Math.abs(m.index - off);
          if (d > 45) continue;
          if (!best || d < best.d) best = { d, name };
        }
      }
      return best ? best.name : null;
    },
    // ★ 失配降级：数值被**明确标注为旧版本读数**时，单列参考而非 FAIL（「保留原句 + 历史标记 + 补现值」
    //   是项目既有做法，这类行**已经**是正确形态）。用词比全局 HIST 更窄，且必须**紧邻 token**。
    //   实测依据：`watercolor:105` 的 `−1.716 dBFS` 是「（−1.716380 是**重渲前版本的读数，已不适用**）」
    //   ——该行同时给出当前值 `−3.350128`；不降级则误报。
    mismatchWhy: (line, idx, len) => {
      const near = line.slice(Math.max(0, idx - 80), idx + len + 80);
      const m = near.match(/(重渲前|已不适用|原记|原先|原为|曾是|曾为|旧版|旧读数|此前)/);
      return m ? `历史引用（紧邻「${m[1]}」，是旧版本读数的引用，非当前声称）` : null;
    },
    // 按口径选真值。返回 {truth,tol} 比对，或 {ref} 单列参考（无真值 / 口径不可判）。
    pick: (cal, tr, v) => {
      if (cal === 'samplePeak') {
        if (!Number.isFinite(tr.samplePeak)) return { ref: '本风格 json 无采样峰值真值（samplePeakDbfs）' };
        // ★ 容差 0.01（不是 0）：`fix-truepeak.mjs` 会把 `samplePeakDbfs` **夹到** `truePeakDbtp` 以内
        //   （后者只存 2 位小数 ⇒ 夹取伪影 ≤ 0.005，见该脚本头注释的「精度陷阱」）——
        //   实测 `risograph` 正文写 6 位 `−3.106276`、json 存夹取后的 `−3.11`（Δ 0.0037）。
        //   0.01 恰好覆盖该伪影，仍远小于真陈旧的量级（≥ 0.03）。
        return { truth: tr.samplePeak, tol: 0.01 };
      }
      if (cal === 'ebur128') {
        if (!Number.isFinite(tr.ebur128Peak)) return { ref: '本风格无真峰值真值，ebur128 口径无法派生' };
        return { truth: tr.ebur128Peak, tol: 0.001 };   // 真值已舍入到 1 位 ⇒ 与文档 1 位读数精确相等
      }
      if (cal === 'truePeak') {
        if (!Number.isFinite(tr.truePeak)) return { ref: '本风格无真峰值真值' };
        return { truth: tr.truePeak, tol: 0.15 };
      }
      if (cal === 'rms') return { ref: 'RMS 口径（电平不是峰值读数，本闸门无 RMS 真值）' };
      // ★ 缺口径词 ⇒ **最保守**：与任一真值相符（±0.15）即放行；否则单列参考（**不判 FAIL**）。
      const any = [tr.samplePeak, tr.truePeak, tr.ebur128Peak].filter((x) => Number.isFinite(x));
      if (any.some((x) => Math.abs(v - x) <= 0.15)) return { truth: tr.truePeak ?? any[0], tol: 0.15 };
      return { ref: `未声明口径（本库 dBFS 混用 ebur128 1 位 / astats 采样峰值 / loudnorm input_tp 三个口径，`
        + `无口径词无法判定；三真值 ${any.map((x) => x.toFixed(3)).join(' / ')}）` };
    },
  },
  {
    key: 'MB', label: '体积(MB)', unit: 'MB', mode: 'ref', tol: 0.15,
    re: /([0-9]+(?:\.[0-9]+)?)\s*MB/g,
    truth: (j) => (Number.isFinite(j?.generatedVideo?.bytes)
      ? Number((j.generatedVideo.bytes / 1048576).toFixed(2)) : undefined),
    num: Number,
  },
  {
    key: 'dur', label: '时长', unit: 's', mode: 'ref', tol: 1,
    re: /(?<![\w.\-])(\d+(?:\.\d+)?)\s*s\b/g,
    truth: (j) => j?.generatedVideo?.durSec,
    num: Number,
  },
];

// ── 真值来源：默认逐风格 _distill.json；可用 LEMO_READINGS_MEASURED_JSON 整体替换（变异用） ──
const readOverride = (p, what) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
    console.log(`✘ 本闸门已失明：${what} \`${p}\` 读不到 / 不是 JSON（${e.message}）。`);
    process.exit(1);
  }
};
const override = MEASURED_JSON ? readOverride(MEASURED_JSON, '实测值来源') : null;
const tpOverride = TP_MEASURED_JSON ? readOverride(TP_MEASURED_JSON, '真峰值实测值来源') : null;

const slugs = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort()
  : [];

// 逐风格的 json + 逐量纲的真值
const docs = new Map(), truths = new Map();
for (const slug of slugs) {
  let j = null;
  try { j = JSON.parse(fs.readFileSync(path.join(DIR, slug, '_distill.json'), 'utf8')); } catch { j = null; }
  docs.set(slug, j);
  const t = {};
  for (const D of DIMS) {
    let v = D.truths ? D.truths(j) : D.truth(j);
    if (override) {
      const o = override[slug];
      v = (o && typeof o === 'object') ? o[D.key] : (D.key === 'dBTP' && typeof o === 'number' ? o : undefined);
    }
    if (tpOverride && D.key === 'dBTP') v = tpOverride[slug];
    t[D.key] = v;
  }
  truths.set(slug, t);
}

const fails = new Map(DIMS.map((D) => [D.key, []]));
const refs = new Map(DIMS.map((D) => [D.key, []]));
const scanLines = [], xref = [], thresholds = [], silent = [], blind = new Map(DIMS.map((D) => [D.key, []]));

for (const slug of slugs) {
  const md = fs.readFileSync(path.join(DIR, slug, 'SKILL.md'), 'utf8');
  const lines = md.split('\n');
  const T = truths.get(slug), j = docs.get(slug);
  const others = slugs.filter((s) => s !== slug);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isScan = [...line.matchAll(SCAN)].length >= 2;   // ⑥ 行级实验/扫描行

    for (const D of DIMS) {
      const truth = T[D.key];
      if (truth === undefined || truth === null) continue;   // 失明（该风格该量纲）——统一在末尾统计
      // ★ 多真值量纲（dBFS）：三个口径真值**全**读不到才算失明
      if (D.truths && !Object.values(truth).some((x) => x !== undefined && x !== null)) continue;
      for (const m of line.matchAll(D.re)) {
        const raw = m[1] !== undefined && D.key === 'WxH' ? `${m[1]}×${m[2]}` : m[1];
        if (raw === undefined || raw === null) continue;
        const v = D.num(raw);
        const rec = { slug, ln: i + 1, v: raw, truth, line };

        // ① 值域合理性 ⇒ 非交付声称，单列「静音读数 / 参考」
        if (D.plaus) {
          const why = D.plaus(v);
          if (why) { (D.key === 'LUFS' ? silent : refs.get(D.key)).push({ ...rec, why }); continue; }
        }
        // ② 阈值 / 交付线提及 ⇒ 放行
        const tgt = D.target ? D.target(j) : undefined;
        const eqTarget = Number.isFinite(tgt) && Math.abs(v - tgt) < 1e-9;
        const kwAdjacent = THRESH_BEFORE.test(line.slice(0, m.index))
          || THRESH_AFTER.test(line.slice(m.index + m[0].length));
        if (eqTarget || kwAdjacent) { thresholds.push({ ...rec, by: eqTarget ? 'eqTarget' : 'kw' }); continue; }
        // ③ 与实测一致 ⇒ 放行（口径感知；非对称上界 tolUp 处理「口径差」，带内上侧单列参考）
        const cal = D.caliber ? D.caliber(line, m.index, m[0].length) : null;
        let tol = D.tolFor ? D.tolFor(cal) : D.tol;
        let tolUp = D.tolUp === undefined ? tol : Math.max(D.tolUp, tol);
        const EPS = 1e-9;   // 浮点余量：−14.04 − (−14.34) 在 IEEE754 下 = 0.3000000000000007
        let bandWhy = null, refWhy = null, cmp = truth;
        // ★ 多真值量纲（dBFS）：先按口径选真值；选不出（无真值 / RMS / 缺口径词）⇒ 单列参考
        if (D.pick) {
          const p = D.pick(cal, truth, v);
          if (p.ref) refWhy = p.ref;
          else {
            cmp = p.truth;
            if (p.tol !== undefined) { tol = p.tol; tolUp = Math.max(D.tolUp ?? tol, tol); }
          }
        }
        if (!refWhy) {
          if (typeof cmp === 'string') {
            if (String(v) === cmp) continue;
          } else if (Number.isFinite(v) && Number.isFinite(cmp)) {
            const d = v - cmp;
            if (d >= -tol - EPS && d <= tolUp + EPS) {
              if (Math.abs(d) > tol + EPS) bandWhy = `口径带内（Δ ${d > 0 ? '+' : ''}${d.toFixed(2)}；本库 ebur128-vs-loudnorm 响度口径差实测 ≤ 0.30）`;
              if (!bandWhy) continue;
            }
          }
        }
        // ★ 逐量纲的「失配降级」（如 dBFS 的历史引用）⇒ 单列参考而非 FAIL
        if (!refWhy && !bandWhy && D.mismatchWhy) refWhy = D.mismatchWhy(line, m.index, m[0].length);
        // ★ LRA：正文未声明口径 / 声明 loudnorm ⇒ 无第二个真值来源 ⇒ 单列参考，不判 FAIL
        const lraNoTruth = D.key === 'LRA' && cal !== 'ebur128' && !bandWhy;
        // ④ 成片语境（整行）
        if (!(D.ctx || CTX).test(line)) continue;
        // ⑤ 历史语境（整行）
        if (HIST.test(line)) continue;
        // ⑥ 实验 / 扫描行 ⇒ 该行所有量纲都不计 FAIL
        if (isScan) {
          if (!scanLines.some((s) => s.slug === slug && s.ln === i + 1)) {
            scanLines.push({ slug, ln: i + 1, line });
          }
          continue;
        }
        // ⑦ 非本片产物（该数值所在句）—— 必须排在 ⑥ 之后
        if (NONFILM.test(sentenceOf(line, m.index))) continue;
        // ⑧ 逐量纲附加排除 + 位置守卫
        if (D.exclude && D.exclude.test(line.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60))) continue;
        if (D.nearExclude && D.nearExclude(line, m.index, m[0].length)) continue;
        // ⑨ 交叉引用 ⇒ 单列
        const isXref = others.some((o) => line.includes(o));
        const rec2 = { ...rec, cal };
        if (isXref) xref.push(rec2);
        else if (refWhy) refs.get(D.key).push({ ...rec2, why: refWhy });
        else if (bandWhy) refs.get(D.key).push({ ...rec2, why: bandWhy });
        else if (lraNoTruth) refs.get(D.key).push({ ...rec2, why: cal === 'loudnorm'
          ? '口径为 loudnorm（本闸门真值只有 ebur128 口径）'
          : '未声明口径（两口径实测相差最多 1.4 LU，无法判定）' });
        else if (D.mode === 'fail') fails.get(D.key).push(rec2);
        else refs.get(D.key).push({ ...rec2, why: '本量纲按实测误报率降级为参考' });
      }
    }
  }
}

// ── ★★ 物理约束单列一类 FAIL：**真峰值 ≥ 采样峰值 恒成立** ⇒ 「采样峰值 > 真峰值」物理不可能 ──
//   这一类**不需要口径判断**（真峰值在定义上就 ≥ 采样峰值：真峰值 = 4× 过采样的峰值，采样峰值是它的下界）
//   ⇒ 是本闸门最可靠的一类。两种形式都查：
//     (a) **数据级**：json 自相矛盾 —— `samplePeakDbfs > truePeakDbtp`；
//     (b) **声称级**：同一句里同时给出「采样峰值」与「真峰值」，且采样峰值 > 真峰值。
//   ★ 容差 0.1 dB 的由来（实测）：`loudnorm input_tp` 只印 **2 位小数**（舍入 ≤ 0.005）、
//     `ebur128 Peak` 只印 **1 位小数**（舍入 ≤ 0.05）⇒ 舍入伪影最大 0.05。实测本库 43 部里
//     「采样峰值 > input_tp」的 5 部**全部是舍入伪影**（Δ ≤ 0.004：`risograph` +0.004、`ascii-crt` +0.003、
//     `backrooms` / `paper-popup` / `rubber-hose` +0.001）⇒ 取 0.1 恰好压掉伪影，又远小于真陈旧的量级（≥ 0.5）。
const PHYS_EPS = 0.1;
const DBFS_D = DIMS.find((D) => D.key === 'dBFS');
const DBTP_D = DIMS.find((D) => D.key === 'dBTP');
const splitSentences = (line) => {
  const out = []; let a = 0;
  for (const m of line.matchAll(/[。！？]/g)) { out.push(line.slice(a, m.index + 1)); a = m.index + 1; }
  if (a < line.length) out.push(line.slice(a));
  return out;
};
const physFails = [];
for (const slug of slugs) {
  const T = truths.get(slug), j = docs.get(slug);
  const dbfsT = T.dBFS || {}, dbtpT = T.dBTP;
  // (a) 数据级：json 自相矛盾
  if (Number.isFinite(dbfsT.samplePeak) && Number.isFinite(dbtpT) && dbfsT.samplePeak > dbtpT + PHYS_EPS) {
    physFails.push({ slug, ln: 0, kind: '数据自相矛盾', line: '_distill.json（selfCheck.loudness）',
      msg: `json 声明 samplePeakDbfs ${dbfsT.samplePeak} > truePeakDbtp ${dbtpT}` });
  }
  // (b) 声称级：同一句里「采样峰值」> 「真峰值」
  const tgt = DBTP_D?.target ? DBTP_D.target(j) : undefined;
  const lines = fs.readFileSync(path.join(DIR, slug, 'SKILL.md'), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (HIST.test(line)) continue;                        // ⑤ 历史句
    if ([...line.matchAll(SCAN)].length >= 2) continue;   // ⑥ 实验行
    for (const sent of splitSentences(line)) {
      if (NONFILM.test(sent)) continue;                   // ⑦ 非本片产物
      const samples = [], tps = [];
      for (const m of sent.matchAll(DBFS_D.re)) {
        const cal = DBFS_D.caliber(sent, m.index, m[0].length);
        const v = DBFS_D.num(m[1]);
        if (cal === 'samplePeak') samples.push({ v, raw: m[1] });
        else if (cal === 'truePeak') tps.push({ v, raw: m[1] });
      }
      for (const m of sent.matchAll(DBTP_D.re)) {
        const v = DBTP_D.num(m[1]);
        if (Number.isFinite(tgt) && Math.abs(v - tgt) < 1e-9) continue;              // 交付线本身不是读数
        if (THRESH_BEFORE.test(sent.slice(0, m.index)) || THRESH_AFTER.test(sent.slice(m.index + m[0].length))) continue;
        tps.push({ v, raw: m[1] });
      }
      for (const s of samples) for (const t of tps) {
        if (s.v > t.v + PHYS_EPS) {
          physFails.push({ slug, ln: i + 1, kind: '声称自相矛盾', line: line.trim().slice(0, 150),
            msg: `同句「采样峰值 ${s.raw} dBFS」> 「真峰值 ${t.raw} dBTP」（真峰值 ≥ 采样峰值 恒成立）` });
        }
      }
    }
  }
}

// ── 失明统计（逐量纲） ──
//   ★ 多真值量纲（dBFS）：三个口径真值**全**读不到才算该风格失明（部分缺 → 该口径的 token 单列参考）
const isBlind = (v) => v === undefined || v === null
  || (typeof v === 'object' && !Object.values(v).some((x) => x !== undefined && x !== null));
for (const slug of slugs) {
  const T = truths.get(slug);
  for (const D of DIMS) if (isBlind(T[D.key])) blind.get(D.key).push(slug);
}

// ── 输出 ──
/** 真值可能是标量（单真值量纲）或对象（多真值量纲，如 dBFS 的三个口径） */
const fmtTruth = (t) => (t && typeof t === 'object'
  ? Object.entries(t).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}=${v}`).join(' / ')
  : String(t));
const dump = (list) => {
  for (const s of list) {
    console.log(`  ${s.slug.padEnd(20)} L${String(s.ln).padStart(4)}  正文 ${s.v}${''} / 实测 ${fmtTruth(s.truth)}${s.cal ? `（口径 ${s.cal}）` : ''}\n      ${s.line.trim().slice(0, 150)}`);
  }
};
const totalFail = [...fails.values()].reduce((a, b) => a + b.length, 0);
if (totalFail) {
  console.log(`✘ 疑似「陈旧且非历史语境」的正文成片读数声称 ${totalFail} 处：\n`);
  for (const D of DIMS) {
    const list = fails.get(D.key);
    if (!list.length) continue;
    console.log(`── ${D.label}（${D.key}）${list.length} 处 ──`);
    dump(list);
    console.log('');
  }
}
if (physFails.length) {
  console.log(`✘ 物理不可能（真峰值 ≥ 采样峰值 恒成立，**不需要口径判断**）${physFails.length} 处：\n`);
  for (const p of physFails) {
    console.log(`  ${p.slug.padEnd(20)} L${String(p.ln).padStart(4)}  [${p.kind}] ${p.msg}\n      ${p.line}`);
  }
  console.log('');
}
// ── 输出（参考桶条目多时只列计数，`--refs` 打印全量明细，避免刷屏） ──
const SHOW_REFS = process.argv.includes('--refs');
for (const D of DIMS) {
  const list = refs.get(D.key);
  if (!list.length) continue;
  console.log(`\nℹ 参考：${D.label}（${D.key}）${list.length} 处 —— 不计 FAIL，供人工判断：`);
  const bySlug = {};
  for (const r of list) bySlug[r.slug] = (bySlug[r.slug] || 0) + 1;
  for (const [k, v] of Object.entries(bySlug)) console.log(`  ${k.padEnd(20)} ${v} 处`);
  if (list.length > 20 && !SHOW_REFS) { console.log(`  （>20 处，明细用 \`--refs\` 打印）`); continue; }
  for (const r of list) console.log(`  ${r.slug.padEnd(20)} L${String(r.ln).padStart(4)}  ${r.v} vs 实测 ${fmtTruth(r.truth)}  ${r.why ? `（${r.why}）` : ''}`);
}
if (silent.length) {
  console.log(`\nℹ 静音 / 占位读数（响度 ≤ −50 LUFS，非对成片的交付声称）${silent.length} 处 —— 不计 FAIL：`);
  for (const s of silent) console.log(`  ${s.slug.padEnd(20)} L${String(s.ln).padStart(4)}  ${s.v} LUFS  （${s.why}）`);
}
if (scanLines.length) {
  console.log(`\nℹ 实验行（同行 ≥2 组「箭头 → 数值 + 单位」= 多目标→多实测的扫描记录，非单一交付声称）${scanLines.length} 处 —— 不计 FAIL，供人工判断：`);
  for (const s of scanLines) console.log(`  ${s.slug.padEnd(20)} L${String(s.ln).padStart(4)}  ${s.line.trim().slice(0, 120)}`);
}
if (xref.length) {
  console.log(`\nℹ 交叉引用（行内提到别的风格，引用其旧值当先例）${xref.length} 处 —— 不计 FAIL，供人工判断：`);
  const bySlug = {};
  for (const x of xref) bySlug[x.slug] = (bySlug[x.slug] || 0) + 1;
  for (const [k, v] of Object.entries(bySlug)) console.log(`  ${k.padEnd(20)} ${v} 处`);
}

// ★ 失明守卫（逐量纲）：某个量纲**全部**风格都读不到真值 ⇒ 该量纲已失明 ⇒ FAIL
const blindDims = DIMS.filter((D) => blind.get(D.key).length > 0 && blind.get(D.key).length === slugs.length);
const allBlind = slugs.length === 0;
for (const D of DIMS) {
  const b = blind.get(D.key);
  if (b.length && b.length !== slugs.length) {
    console.log(`\nℹ 失明（${D.label}）：读不到真值的风格 ${b.length} 个（不计 FAIL，但统计）：`);
    console.log('  ' + b.join('、'));
  }
}
if (allBlind) {
  console.log(`\n✘ 本闸门已失明：\`${DIR}\` 下一个带 _distill.json 的风格都找不到，没有任何可比对的真值。`);
}
for (const D of blindDims) {
  console.log(`\n✘ 本闸门已失明：${slugs.length} 个风格**全部**读不到 ${D.key} 的真值（${D.label}）—— 该量纲没有任何可比对的真值。`);
}

const fail = totalFail + physFails.length + blindDims.length + (allBlind ? 1 : 0);
if (!fail) console.log('✓ 未发现「陈旧且非历史语境」的正文成片读数声称。');
const per = DIMS.filter((D) => D.mode === 'fail').map((D) => `${D.key} ${fails.get(D.key).length}`).join(' / ');
const thrEq = thresholds.filter((t) => t.by === 'eqTarget').length;
const blindStat = DIMS.filter((D) => blind.get(D.key).length).map((D) => `${D.key} ${blind.get(D.key).length}`).join(' ') || '无';
console.log(`\n[闸门] 陈旧读数 ${totalFail} 处（${per}）/ 物理不可能 ${physFails.length} 处 / 阈值提及排除 ${thresholds.length} 处（== 交付线 ${thrEq} + 紧贴阈值词 ${thresholds.length - thrEq}）/ 参考 ${[...refs.values()].reduce((a, b) => a + b.length, 0)} 处 / 静音读数 ${silent.length} 处 / 实验行 ${scanLines.length} 处 / 交叉引用 ${xref.length} 处 / 失明 ${blindStat} ${fail ? '✘' : 'OK'}`);
process.exitCode = fail ? 1 : 0;
