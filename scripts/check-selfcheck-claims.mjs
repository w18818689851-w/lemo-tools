#!/usr/bin/env node
/**
 * scripts/check-selfcheck-claims.mjs —— `_distill.json#selfCheck` 里**「对实物可核的声称」**的闸门
 *
 * ★ 由来（2026-10-07，补一个**已由独立审计实测确认的零覆盖区**）：
 *   一次只读审计统计：43 份 `_distill.json` 的 `selfCheck` 去重后共 **283 条字段路径**，
 *   其中 **242 条没有任何闸门在读**（41 条有消费者）。本条闸门专门接住其中**能对实物/权威字段核**的几条：
 *
 *   | 字段（43 份里的出现次数）        | 声称什么        | 真值来源（本闸门实测核过）                                   |
 *   |----------------------------------|-----------------|--------------------------------------------------------------|
 *   | `selfCheck.muxEncoder`（43/43）  | 成片用 nvenc 编 | ★★ **成片的编码器 tag**：`ffprobe -select_streams v:0`         |
 *   |                                  |                 | `-show_entries stream_tags=encoder`（实测 43/43 =               |
 *   |                                  |                 | `Lavc60.31.102 h264_nvenc`）                                    |
 *   | `selfCheck.fps`（3/43）          | 帧率            | `generatedVideo.fps`（同源；而 `generatedVideo.*` 已被          |
 *   | `selfCheck.frames`（3/43）       | 帧数            | `check-skill-artifacts.mjs` 对着成片核过 ⇒ 只需核「两者一致」） |
 *   | `selfCheck.size`（3/43）         | 分辨率 WxH      | `generatedVideo.{width,height}`（同上）                         |
 *   | `selfCheck.srtCues`（2/43）      | 字幕条数        | **成片同名 `.srt` 的实际 cue 数**（实测 2/2 一致）              |
 *   | `selfCheck.loudness.truePeakMethod` | 真峰值**怎么测的** | ★ 登记表（`CALIBER_REGISTRY`）：合法串 = 本片实跑的那条命令； |
 *   | `selfCheck.loudness.lraMethod`（43/43） | （口径声明）  | 未登记的偏离 ⇒ FAIL（见判据 F 与 §「为什么有两条合法写法」）    |
 *   | `audioScoreBasis`（9/43，**散文**）  | 「audio N/20」  | ★ **权威 `scoreBreakdown.audio`**（`check-skill-scores` 已钉）    |
 *   |                                  |                 | 不符 ⇒ 需「锚定权威值 + 更正/历史标记」，缺一 FAIL（见判据 G）  |
 *   | `selfCheck.ratio`（3/43）        | 画幅比          | `generatedVideo.{width,height}`（派生量，见判据 H）             |
 *   | `selfCheck.clippedSamples`（1/43）| 削波样本数      | 0 ⇒ `loudness.{samplePeakDbfs,truePeakDbtp}` 必须 ≤ 0（判据 H）  |
 *
 * ★★ 为什么 `muxEncoder` 这条最重要（本闸门存在的理由）：
 *   它声称「nvenc」，而此前**零读者** ⇒ 若哪天渲染回退成 `libx264`（违反项目第一硬规则
 *   「渲染一律 GPU 优先」），**没有任何闸门会响**：`check-render-venc.mjs` 核的是**脚本**里的
 *   编码器决策点（源码级，不看成片）、`check-mux-parity.mjs` 核的是两份 `mux.sh` 的**口径**、
 *   `check-skill-artifacts.mjs` 核的是 `generatedVideo.*` 的**数值**（不含编码器）。
 *   ⇒ 本条闸门是**那条硬规则在 `_distill.json` 侧的落点**：它判的是**成片实际用的编码器**。
 *
 * ★ 判据（八组，全部只核「能对实物/权威字段核」的字段；**不核散文** —— 那已由 `check-tp-prose.mjs` 管；
 *   ★ 判据 G 是**例外**：它读的正是**散文** `audioScoreBasis`，但**只核其中机器可辨的「audio N/20」分数**，
 *   且以**结构化权威字段** `scoreBreakdown.audio` 为准绳 —— 不是「核散文措辞」）：
 *   (A) `selfCheck.muxEncoder` 存在且非空 ⇒ 否则 FAIL（声称缺失 = 无凭据）。
 *   (B) ★ **达标**（不是「自洽」）：成片实际的视频流编码器 tag 必须含**期望编码器**
 *       —— 期望值 = `LEMO_VENC`（若设）否则 `h264_nvenc`。
 *       成片实际是 `libx264` ⇒ **FAIL**（那正是「静默走 CPU」）。
 *       ★ 为什么必须有一处真判达标（项目铁律）：只判「声称 == 实物」的话，
 *         一个「声称 libx264、实物 libx264」的成片会**绿灯通过** —— 而那违反第一硬规则。
 *   (C) **自洽**：`muxEncoder` 的声称值与成片 tag 必须对得上（声称归一化后是 tag 的子串）。
 *       声称 `nvenc` 而 tag 是 `libx264`（或反之）⇒ FAIL。
 *   (D) `selfCheck.{fps,frames,size}`（**有才核**）：与 `generatedVideo.{fps,frames,width,height}` 逐项一致
 *       （`size` 解析成 `WxH`）。同义 ⇒ 不重复跑 ffprobe（`generatedVideo.*` 已由 `check-skill-artifacts` 对实物核过）。
 *   (E) `selfCheck.srtCues`（**有才核**）：与**成片同名 `.srt`** 的实际 cue 数一致（实测 2/2 一致、误报 0）。
 *       字幕文件取 `generatedVideo.path` 换扩展名（`<slug>.mp4` → `<slug>.srt`）；`.srt` 不在则跳过（不判 FAIL）。
 *   (F) ★★ **口径声明登记表**（2026-10-08 新增，补另一个独立审计实测确认的零覆盖区）：
 *       `selfCheck.loudness.{truePeakMethod,lraMethod}`（43/43 都有）声明的是
 *       「本片真峰值 / LRA **是用哪条命令测出来的**」= **关于世界的声称** —— 此前**零闸门读**
 *       （`check-distill-fields.mjs` 登记为 `coveredBy: null`）。判据：
 *         · **正向**：语料里出现的每个声明串必须**已登记**（`CALIBER_REGISTRY`）⇒ 未登记 ⇒ FAIL 并**点名 slug + 实际串**。
 *         · **反向**：登记表里的每条必须**至少被一份真实 json 使用** ⇒ 否则 FAIL 并点名该登记项
 *           （「从未出现 ⇒ 登记表已腐化 / 该写法已被淘汰」）。
 *         · **失明**：0 个风格、或 **0 个口径声明字段**（43 份里 `truePeakMethod` 与 `lraMethod` 都没有）、
 *           或登记表为空 ⇒ FAIL 并明说「本闸门已失明」（**不静默放过**）。
 *
 * ★★ 为什么 `truePeakMethod` 有**两条**合法写法（已查证，非猜测）：
 *   ffmpeg 官方文档（本机随 ffmpeg 9.0.2 附带的 `doc/ffmpeg-filters.html` §8.97 loudnorm）写明
 *   `measured_TP` = **"Measured true peak of input file"**，而 `I` 是 **"Set integrated loudness target"**、
 *   `LRA` 是 **"Set loudness range target"**、`TP` 是 **"Set maximum true peak"**（目标 / 上限）
 *   ⇒ JSON 里的 `input_tp` 是**对输入信号的测量**，与 `I`/`TP`/`LRA` 三个**目标值无关**。
 *   本项目自己的 `core/render/mux.sh:145` 亦明写「测量值（I/TP/LRA/thresh）**与 TP 目标无关**」，
 *   且 `mux.sh:227` 的复核命令**恒用** `loudnorm=I=-14:TP=-1.7:LRA=11:…`。
 *   ⇒ 真实命令是 `loudnorm=I=-14:TP=-1.7:LRA=11:…`（`mux.sh:112/227`），其中 `:LRA=11` 是**目标**，
 *     写不写都**不改变 `input_tp` 的值** ⇒ 两种写法都登记为合法（实测 27 份带 `:LRA=11` / 16 份不带）。
 *   ★ 但**目标值本身**仍须写对：`engraving` 曾写 `I=-16:TP=-1.5`（那是 `check-lra-caliber.mjs:45` /
 *     `check-film-delivery.mjs:225` 的**探测**命令，不是本片实跑的 —— 本片实跑 `I=-14:TP=-1.7`，
 *     见 `_distill/logs/engraving.log:182`），2026-10-08 已按实跑改正 ⇒ **不进登记表**。
 *   ★ 误报率实测（真实 43 份逐条人读，**先测再定稿**）：
 *     判据 F 上线前，真实树 **命中 1 = 真阳 1（`engraving`）/ 误报 0**（43×2=86 个声明串里，85 个与登记表一致）；
 *     改正 `engraving` 后真实树 **命中 0 / 误报 0**（86 个声明串全部命中登记表、登记表 3 条全部被用到）。
 *
 *   (G) ★★ **`audioScoreBasis`（散文）里的分数 ↔ 权威 `scoreBreakdown.audio`**（2026-10-08 新增，
 *       补第三个独立审计实测确认的零覆盖区）：`audioScoreBasis` 是**散文**（43 份里 **9 份**有），
 *       里面常写「audio N/20」；**权威**是 `scoreBreakdown.audio`（`check-skill-scores.mjs` 判据①
 *       已钉住 `matchScore == sum(scoreBreakdown)` ⇒ breakdown 是权威）—— 此前**零闸门读**
 *       （`check-distill-fields.mjs` 登记为 `coveredBy: null`）。
 *       ★ 现状（实测，先测再定稿）：9 份里 **6 份**的首个「audio N/20」与权威**差 1**
 *         （`blueprint` 17/18、`crayon-book` 17/18、`dataviz` 15/16、`microgame` 17/18、
 *         `risograph` 18/19、`stained-glass` 17/18），但这 6 份**都已按 house style 追加了
 *         「★ 2026-10-08 更正」**（原句保留 + 句末更正、写明了现值）⇒ **不能简单判「首个 N 必须 == 权威」**
 *         （那会把 6 处 house-style 历史链**全判红**）。判据设计：
 *           · 首个「audio N/20」== 权威 ⇒ **通过**（真实 2 份：`cel-anime-80s`、`paper-popup`）；
 *           · 首个「audio N/20」**没有**（`brick-toy` 写「满分 20，扣 2 分」不写 N/20）⇒ 无分数声称、**不判**；
 *           · 不等 ⇒ **同时**要求：① **锚定权威值**（文中出现 `scoreBreakdown.audio = <权威>` 或
 *             「权威 …<权威>」形态）+ ② **有更正/历史标记**（`★ 20XX-XX-XX 更正` / `原句保留作历史` / `原记`）；
 *             两者缺一 ⇒ FAIL 并点名 slug + 实际「audio N/20」+ 权威值 + 缺哪一项。
 *       ★ **为什么用「锚定 + 标记」而不是「只要求文中出现权威值」**：只要求「文中出现权威数字」的话，
 *         `17/20` 这种**同一数字**会到处误命中（`audio 17/20`、日期、别的分数…）⇒ 判据会被**无关数字满足**
 *         （本项目反复治过的「匹配判据可被无关代码满足」）；`scoreBreakdown.audio = N` 是**显式绑定**，
 *         不会与散文里的裸数字混淆。★ **它挡不住什么**：把「更正」标记与锚定句**照抄**进去、而首句其实
 *         仍然错（**主动造假**不在守卫职责内）；也**不核**「更正后的现值是否真的等于成片实测」
 *         （那要跑 loudnorm，属 `check-tp-prose` / `check-film-delivery` 的活）。
 *       ★ 误报率实测（真实 43 份逐条人读，**先测再定稿**）：9 个 `audioScoreBasis` 里 8 个有「audio N/20」
 *         声称、6 个与权威不等 ⇒ **命中 6 / 真阳 0 / 误报 0**（6 个全带锚定 + 更正标记 ⇒ 全放行）。
 *         ★ 反向（`scoreBreakdown.audio` 被改坏 ⇒ 锚定句里的数字对不上权威）同判 FAIL —— 见下「双向」。
 *
 *   (H) ★ **派生量回归护栏**（2026-10-08 新增；本库**全对**，做护栏防将来漂）：两条「由别的字段派生、
 *       应当恒成立」的关系，实测 43 份**全对** ⇒ 做成护栏：
 *         · `selfCheck.ratio`（3/43，形如 `"16:9"`）↔ `generatedVideo.width` / `height`（比例一致，容差 0.01）；
 *         · `selfCheck.clippedSamples === 0`（1/43）⇒ `loudness.samplePeakDbfs ≤ 0` **且**
 *           `loudness.truePeakDbtp ≤ 0`（**物理不可能**：0 削波却峰值 > 0）。
 *       ★ **有意不加** `selfCheck.size` ↔ `generatedVideo.{width,height}`：**判据 (D) 已在做**
 *         （`selfCheck.size` 是**尺寸串** `"WxH"`、不是字节数；D 在 `hasFps` 分支里已逐项核过）⇒ 再加就是重复。
 *       ★ **为什么这是「真没被覆盖的」**：`check-distill-fields.mjs` 把 `selfCheck.ratio` 与
 *         `selfCheck.clippedSamples` 都登记为 `coveredBy: null`（零读者）—— 实测确认。
 *       ★ 误报率实测（真实 43 份逐条人读，**先测再定稿**）：`ratio` 命中 **3 处**（`one-line` /
 *         `papercut-red` / `pixel-rpg`，都是 `16:9` vs 1920×1080 = 1.7778 ⇒ 通过）、`clippedSamples`
 *         命中 **1 处**（`pixel-rpg` = 0，其 `samplePeakDbfs` −3.35 / `truePeakDbtp` −1.72 均 ≤ 0 ⇒ 通过）
 *         ⇒ **命中 0 / 真阳 0 / 误报 0**。
 *       ★ **它挡不住什么**：`ratio` 只在**同时**有 `generatedVideo.width/height` 时才比对（缺一边则跳过）；
 *         `clippedSamples` 只判「0 ⇒ 峰值必须 ≤ 0」这一条**物理不可能**关系，**不**判「>0 时峰值是否真的 >0」，
 *         也**不**核 `clippedSamples` 这个数**本身**是否等于成片实测（那要跑 ffmpeg 扫削波，本项目明令别把闸门做成分钟级）。
 *
 * ★ **有意不核的 `selfCheck` 字段（逐条给理由，非疏漏）**：
 *   · `loudness.{truePeakDbtp,integratedLufs,lra,peakDbtpTarget,peakTargetMet,samplePeakDbfs}`（43/43）
 *     —— **已被** `check-film-delivery.mjs`（A/B/C 类，对着成片实测核）+ `check-tp-prose.mjs`（json 数值自洽）
 *     + `check-lra-caliber.mjs` 覆盖 ⇒ 再核一遍是**重复**。
 *   · `rendered`（43/43）/ `usedPreGeneratedAudio` / `warnings[]` / 一切 `*note` / `audio.*` / `events` /
 *     `totalSec` / `renderSec` / `nativeResolution` / `grain` / `skipSync` / `preflight` …
 *     ★ `ratio` 与 `clippedSamples` **已从本清单移出** —— 2026-10-08 起由判据 (H) 覆盖（见上）。
 *     —— 要么是**散文**（已由 `check-tp-prose.mjs` 的 json pass 管）、要么**口径不明**
 *     （实测 `selfCheck.totalSec` 与 `generatedVideo.durSec` **本来就不同**：`one-line` 67.1 vs 47.5，
 *     说明它是**另一个量**、不是成片时长 ⇒ 拿 durSec 判它就是**凭猜收窄**）、
 *     要么**没有可对的真值**（`grain` 的「档位」只在 `lib/style-dna/*.json` 的**散文**里写着
 *     `grain = 0`，无结构化字段 ⇒ 核它等于核散文，与纪律冲突）。
 *   · `rendered === true` 的**真实性**由 (A)(B) 的「成片必须存在且可读」隐式覆盖（成片读不到 ⇒ 失明 FAIL）。
 *
 * ★ **失明守卫**（防空转绿灯；写法照 `check-skill-artifacts.mjs` 的两条 / `check-loudness-targets.mjs:64-79`）：
 *   ① 一个带 `_distill.json` 的风格都枚举不到 ⇒ FAIL 并明说「本闸门已失明」；
 *   ② **一个可核字段都没有**（43 份里 `muxEncoder` 与 `fps/frames/size` 全缺）⇒ FAIL 并明说「本闸门已失明」；
 *   ③ **一个成片文件都读不到**（`ffprobe` 一个都没成功）⇒ FAIL 并明说「本闸门已失明」；
 *   ④ **判据 F 失明**：一个口径声明字段都没读到、或登记表为空 ⇒ FAIL 并明说「本闸门已失明」；
 *   ⑤ **判据 G 失明**：一个 `audioScoreBasis` 都没读到 ⇒ FAIL 并明说「本闸门已失明」；
 *   ⑥ **判据 H 失明**：`ratio` 与 `clippedSamples` 一个都没读到 ⇒ FAIL 并明说「本闸门已失明」。
 *   ⇒ 否则「fails 为空」会打印「✓ 全部一致」—— 那是**假的**（一个东西都没核）。
 *
 * ★ 覆盖点（供非破坏变异验证；与既有闸门同名同义）：
 *   · `LEMO_DISTILL_ROOT` —— 风格技能树（默认 `<仓根>/lib/style-skills`；与 `check-skill-artifacts`
 *     / `check-film-delivery` / `check-tp-prose` 同名同义）。
 *   · `LEMO_FILM_DIR`     —— 成片根（默认 `D:/lemo-films`；与 `lib/env.mjs` / `fix-truepeak.mjs`
 *     / `prune-jobs.mjs` 同名同义）。**别名** `LEMO_FILMS_ROOT`（`check-film-aspect.mjs` 用的名字）
 *     也接受 —— 免得夹具按那个名字重定向时**静默地仍在读真库**（同型坑本项目踩过）。
 *   · `LEMO_FFPROBE`      —— ffprobe 路径（默认 `D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffprobe.exe`）。
 *   · `LEMO_VENC`         —— **期望编码器**（默认 `h264_nvenc`；与 `check-render-venc.mjs` 同名同义）。
 *
 * ★ 已知局限（如实登记，不粉饰）：
 *   · (B)(C) 认的是**视频流的 `encoder` tag** —— 那是**编码器自己写的**，不是「谁编的」的独立证明。
 *     拿一个 CPU 编的片再手工改 tag 就能骗过它（**主动造假不在守卫职责内**）。它能抓住的是
 *     「渲染路径**静默回落**成 CPU」这一真实形态（那时 tag 会变成 `Lavc… libx264`）。
 *   · tag 缺失（`stream_tags.encoder` 为空）⇒ 判 FAIL 并明说「无法核」—— **宁红勿绿**。
 *   · 只认 `stream_tags=encoder`；`format_tags=encoder` 是**封装器**版本（实测 `Lavf60.16.100`、
 *     不含 `h264_nvenc`）⇒ **不能用**它判（实测 43/43 都拿不到编码器名）。
 *   · (D) 只与 `generatedVideo.*` 比，**不**直接与成片比 —— 后者是 `check-skill-artifacts` 的活，
 *     且 `-count_frames` 会**分钟级**（本项目明令别把闸门做成分钟级）。
 *
 * 用法：node scripts/check-selfcheck-claims.mjs [--only a,b] [--json]
 * 退出码：有 FAIL 或失明 → 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(ROOT, 'lib', 'style-skills'));
const FILM_DIR = path.resolve(process.env.LEMO_FILM_DIR || process.env.LEMO_FILMS_ROOT || 'D:/lemo-films');
const FFPROBE = process.env.LEMO_FFPROBE || 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffprobe.exe';
/** ★ 期望编码器：未设 `LEMO_VENC` ⇒ `h264_nvenc`（项目第一硬规则「渲染一律 GPU 优先」）。 */
const EXPECTED = process.env.LEMO_VENC || 'h264_nvenc';

/**
 * ★★ 口径声明登记表（判据 F）—— `selfCheck.loudness.{truePeakMethod,lraMethod}` 的**合法取值全集**。
 *   见头注释「为什么 `truePeakMethod` 有两条合法写法」：`input_tp` 是**对输入信号的测量**，
 *   与 `I`/`TP`/`LRA` 三个目标值无关（ffmpeg 文档 `measured_TP` = "Measured true peak of input file"；
 *   `core/render/mux.sh:145` 亦明写「测量值…与 TP 目标无关」）⇒ `:LRA=11` 写不写都不改变值，两条都合法。
 *   ★ 登记项若**从未被任何风格使用** ⇒ 判 FAIL（登记表腐化 / 该写法已淘汰），逼登记表随语料一起收敛。
 *   ★ 加一条合法写法 = 往这里加一个字符串；**别把错的写法登记进来**（engraving 那条 `I=-16:TP=-1.5` 已改正、不登记）。
 */
const CALIBER_REGISTRY = {
  truePeakMethod: [
    'ffmpeg -i <film> -af loudnorm=I=-14:TP=-1.7:LRA=11:print_format=json -f null - 的 input_tp（4× 过采样）',
    'ffmpeg -i <film> -af loudnorm=I=-14:TP=-1.7:print_format=json -f null - 的 input_tp（4× 过采样）',
  ],
  lraMethod: [
    'ebur128=peak=true 的 LRA（项目口径；loudnorm 的 input_lra 系统性偏大）',
  ],
};
/** 登记表里的字段名（顺序固定，输出可复现）。 */
const CALIBER_FIELDS = ['truePeakMethod', 'lraMethod'];

/**
 * ★★ 判据 G 的形态（`audioScoreBasis` 散文里的分数 ↔ 权威 `scoreBreakdown.audio`）。
 *   · `AUDIO_SCORE_RE`：散文里的**首个**「audio N/20」分数声称（大小写不敏感）。
 *   · `anchorAudio()`：该散文是否**显式锚定**了权威值 —— 两种合法锚定形态：
 *     ① `scoreBreakdown.audio = <N>`（`=` 两侧允许空格 / 反引号）；② 「权威 …<N>」（`权威` 后 ≤4 字符内出现该数字）。
 *     ★ 用「显式绑定」而非「文中出现该数字」：后者会被同一数字的**无关出现**满足（见头注释「匹配判据可被无关代码满足」）。
 *   · `AUDIO_FIX_MARKS`：house style 的**更正 / 历史**标记（原句保留 + 句末更正）。
 *     ★ 只认「日期 + 更正」或 `原句保留作历史` / `原记` —— **不许放宽到「只要有个日期就行」**。
 */
const AUDIO_SCORE_RE = /audio\s*(\d+)\s*\/\s*20/i;
const anchorAudio = (text, n) =>
  new RegExp('scoreBreakdown\\.audio\\s*=\\s*' + n).test(text) ||
  new RegExp('权威\\s*.{0,4}' + n).test(text);
const AUDIO_FIX_MARKS = [
  /★[^★\n]{0,12}\d{4}-\d{2}-\d{2}\s*更正/,
  /原句保留作历史/,
  /原记/,
];
const hasAudioFixMark = (text) => AUDIO_FIX_MARKS.some((re) => re.test(text));

/** 解析 `selfCheck.ratio`（`"16:9"`）→ 数值比；解析不出返回 null。 */
function parseRatio(s) {
  const m = String(s).match(/^\s*(\d+(?:\.\d+)?)\s*[:：\/xX×*]\s*(\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const b = Number(m[2]);
  return b === 0 ? null : Number(m[1]) / b;
}

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const only = (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

// ★ 本机 spawnSync/execFileSync 一律 EBUSY（项目里多处记过）⇒ 用异步 spawn
const run = (cmd, args) => new Promise((res) => {
  const p = spawn(cmd, args, { windowsHide: true });
  let o = '', e = '';
  p.stdout.on('data', (d) => { o += d; });
  p.stderr.on('data', (d) => { e += d; });
  p.on('close', (code) => res({ code, o, e }));
  p.on('error', (x) => res({ code: -1, o, e: String(x.message) }));
});

/** 归一化：只留字母数字 + 小写（`h264_nvenc` → `h264nvenc`）。 */
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** 只读头部、不逐帧解码（实测 43 部 ≈ 5 s）⇒ 取视频流的 `encoder` tag。 */
async function probeEncoder(film) {
  const { code, o, e } = await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name:stream_tags=encoder', '-of', 'json', film]);
  if (code !== 0) return { err: (e || 'ffprobe 失败').slice(0, 160) };
  try {
    const j = JSON.parse(o);
    const s = (j.streams || [])[0] || {};
    return { codec: s.codec_name || null, tag: ((s.tags || {}).encoder || null) };
  } catch (x) { return { err: 'ffprobe 输出解析失败: ' + x.message }; }
}

/** 解析 `selfCheck.size`（`"1920x1080"`）→ `{ w, h }`；解析不出返回 null。 */
function parseSize(s) {
  const m = String(s).match(/^\s*(\d+)\s*[xX×*]\s*(\d+)\s*$/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

if (!fs.existsSync(FFPROBE)) { console.error(`找不到 ffprobe: ${FFPROBE}`); process.exit(2); }

let slugs = [];
try {
  slugs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort();
} catch { /* ★ 目录读不到 ⇒ 交给下面的失明守卫（不裸抛） */ }
if (only.length) slugs = slugs.filter((s) => only.includes(s));

const rows = [];
const fails = [];
let filmsRead = 0;      // ffprobe 成功读到的成片数
let compared = 0;       // 真正做过的「声称 vs 真值」比对次数
let caliberSeen = 0;    // ★ 判据 F：真实语料里出现过的口径声明串数（slug × 字段）
const caliberUsed = new Set();   // ★ 判据 F：被真实语料用到的登记项（用于反向守卫）
let audioBasisSeen = 0; // ★ 判据 G：读到的 audioScoreBasis 字段数
let audioClaimSeen = 0; // ★ 判据 G：其中带「audio N/20」分数声称的数
let hSeen = 0;          // ★ 判据 H：读到的派生量护栏字段数（ratio / clippedSamples）

for (const slug of slugs) {
  const p = path.join(DIR, slug, '_distill.json');
  let j;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (x) { fails.push(`${slug}: _distill.json 解析失败 —— ${x.message}`); rows.push({ slug, status: 'FAIL', why: 'json 解析失败' }); continue; }
  const sc = j.selfCheck || {};
  const gv = j.generatedVideo || {};

  const claim = sc.muxEncoder;
  const hasFps = sc.fps != null || sc.frames != null || sc.size != null;
  const hasSrtCues = sc.srtCues != null;
  // ★ 判据 F 的字段（`selfCheck.loudness.{truePeakMethod,lraMethod}`）：43/43 都有
  const hasCaliber = !!sc.loudness && CALIBER_FIELDS.some((k) => sc.loudness[k] != null);
  // ★ 判据 G 的字段（散文 `audioScoreBasis`，9/43 有）与权威 `scoreBreakdown.audio`
  const hasAudioBasis = j.audioScoreBasis != null;
  const authoritativeAudio = (j.scoreBreakdown || {}).audio;
  // ★ 判据 H 的字段（派生量护栏）：`selfCheck.ratio`（3/43）/ `selfCheck.clippedSamples`（1/43）
  const hasRatio = sc.ratio != null;
  const hasClip = sc.clippedSamples != null;

  if (claim == null && !hasFps && !hasSrtCues && !hasCaliber && !hasAudioBasis && !hasRatio && !hasClip) {
    rows.push({ slug, status: 'SKIP', why: 'selfCheck 里没有一个可核字段（muxEncoder / fps / frames / size / srtCues / loudness.*Method / ratio / clippedSamples 全缺，且无 audioScoreBasis）' });
    continue;
  }

  const bad = [];

  // ── (A)(B)(C) `selfCheck.muxEncoder` vs 成片的编码器 tag ──────────────────
  if (claim == null) {
    bad.push('selfCheck.muxEncoder 缺失（声称无凭据）');
  } else if (typeof claim !== 'string' || !claim.trim()) {
    bad.push(`selfCheck.muxEncoder 不是非空字符串：${JSON.stringify(claim)}`);
  } else {
    const film = gv.path || path.join(FILM_DIR, slug, `${slug}.mp4`);
    if (!fs.existsSync(film)) {
      bad.push(`成片不存在，无法核 muxEncoder 声称 —— ${film}`);
    } else {
      const real = await probeEncoder(film);
      if (real.err) {
        bad.push(`ffprobe 读不出成片的编码器 —— ${real.err}`);
      } else {
        filmsRead++;
        const tag = real.tag;
        // (B) ★ 达标：成片实际编码器必须含期望值（未设 LEMO_VENC ⇒ h264_nvenc）。
        if (!tag) {
          bad.push(`成片没有视频流 encoder tag（codec=${real.codec || '?'}）⇒ 无法核「用 nvenc 编」`);
        } else if (!norm(tag).includes(norm(EXPECTED))) {
          bad.push(`★ 成片未走 ${EXPECTED}（GPU 优先铁律）：实际 encoder tag = "${tag}"`);
        }
        // (C) 自洽：声称值必须对得上成片 tag。
        if (tag && !norm(tag).includes(norm(claim))) {
          bad.push(`muxEncoder 声称 "${claim}" 与成片实际 "${tag}" 不符`);
        }
        compared++;
      }
    }
  }

  // ── (D) `selfCheck.{fps,frames,size}` vs `generatedVideo.*`（有才核）────────
  if (hasFps) {
    const cmpNum = (k, doc, act, tol) => {
      if (doc == null || act == null) return;
      compared++;
      if (Math.abs(doc - act) > tol) bad.push(`selfCheck.${k} ${doc} vs generatedVideo.${k} ${act}`);
    };
    cmpNum('fps', sc.fps, gv.fps, 0.01);
    cmpNum('frames', sc.frames, gv.frames, 0);
    if (sc.size != null) {
      const sz = parseSize(sc.size);
      if (!sz) bad.push(`selfCheck.size 解析不出 WxH：${JSON.stringify(sc.size)}`);
      else if (gv.width != null && gv.height != null) {
        compared++;
        if (sz.w !== gv.width || sz.h !== gv.height) {
          bad.push(`selfCheck.size ${sz.w}x${sz.h} vs generatedVideo ${gv.width}x${gv.height}`);
        }
      }
    }
  }

  // ── (E) `selfCheck.srtCues` vs 成片同名 `.srt` 的实际 cue 数（有才核）────────
  let srtSkip = '';
  if (hasSrtCues) {
    const srt = (gv.path || path.join(FILM_DIR, slug, `${slug}.srt`)).replace(/\.mp4$/i, '.srt');
    if (!fs.existsSync(srt)) {
      srtSkip = `selfCheck.srtCues 有声称，但字幕文件不在（${srt}）⇒ 没核`;
    } else {
      const cues = (fs.readFileSync(srt, 'utf8').match(/^\s*\d+\s*$/gm) || []).length;
      compared++;
      if (cues !== sc.srtCues) bad.push(`selfCheck.srtCues ${sc.srtCues} vs ${path.basename(srt)} 实际 ${cues} 条`);
    }
  }

  // ── (F) ★ 口径声明登记表：`loudness.{truePeakMethod,lraMethod}`（有才核）──────
  //   正向：语料里的串必须已登记（未登记 ⇒ FAIL + 点名 slug + 实际串）。
  //   反向（登记表腐化）：登记项若从未被任何风格使用 ⇒ FAIL（在循环外统一判）。
  if (hasCaliber) {
    for (const k of CALIBER_FIELDS) {
      const v = sc.loudness[k];
      if (v == null) continue;
      caliberSeen++;
      if (typeof v !== 'string' || !v.trim()) {
        bad.push(`selfCheck.loudness.${k} 不是非空字符串：${JSON.stringify(v)}`);
        continue;
      }
      const reg = CALIBER_REGISTRY[k] || [];
      if (reg.includes(v)) {
        caliberUsed.add(`${k}\u0000${v}`);
      } else {
        bad.push(`★ selfCheck.loudness.${k} 未登记（声称的测量命令与项目实跑的那条不符）：${JSON.stringify(v)}`);
      }
    }
  }

  // ── (G) ★ `audioScoreBasis`（散文）里的分数 ↔ 权威 `scoreBreakdown.audio` ─────
  //   首个「audio N/20」== 权威 ⇒ 通过；无分数声称 ⇒ 不判；
  //   不等 ⇒ 必须「显式锚定权威值」+「有更正/历史标记」，缺一 FAIL（见头注释 §判据 G）。
  if (hasAudioBasis) {
    audioBasisSeen++;
    const basis = j.audioScoreBasis;
    if (typeof basis !== 'string' || !basis.trim()) {
      bad.push(`audioScoreBasis 不是非空字符串：${JSON.stringify(basis)}`);
    } else if (authoritativeAudio == null || !Number.isFinite(Number(authoritativeAudio))) {
      bad.push(`权威 scoreBreakdown.audio 缺失 / 非数值（${JSON.stringify(authoritativeAudio)}）⇒ 无法核 audioScoreBasis`);
    } else {
      const m = basis.match(AUDIO_SCORE_RE);
      if (m) {
        audioClaimSeen++;
        compared++;
        const claimed = Number(m[1]);
        const auth = Number(authoritativeAudio);
        // ★ 短路点（供 gate-blindness 的「改坏判据必须变红」自证精确替换，见 test/gate-blindness.test.mjs）。
        if (claimed !== auth) {
          if (!anchorAudio(basis, auth)) {
            bad.push(`★ audioScoreBasis 首个「audio ${claimed}/20」与权威 scoreBreakdown.audio = ${auth} 不符，且**未锚定权威值**（缺 \`scoreBreakdown.audio = ${auth}\` 之类）`);
          }
          if (!hasAudioFixMark(basis)) {
            bad.push(`★ audioScoreBasis 首个「audio ${claimed}/20」与权威 scoreBreakdown.audio = ${auth} 不符，且**无更正/历史标记**（缺 \`★ 20XX-XX-XX 更正\` / \`原句保留作历史\` / \`原记\`）`);
          }
        }
      }
      // 无「audio N/20」⇒ 无分数声称，不判（真实 1 份：`brick-toy` 写「满分 20，扣 2 分」）。
    }
  }

  // ── (H) ★ 派生量回归护栏（本库全对，做护栏防将来漂）─────────────────────────
  //   (H1) `selfCheck.ratio` ↔ `generatedVideo.width / height`（容差 0.01）
  //   (H2) `selfCheck.clippedSamples === 0` ⇒ `loudness.{samplePeakDbfs,truePeakDbtp}` 必须 ≤ 0（物理不可能）
  //   ★ `selfCheck.size` ↔ `generatedVideo.{width,height}` **有意不加** —— 判据 (D) 已在做（见头注释 §判据 H）。
  if (hasRatio) {
    hSeen++;
    const r = parseRatio(sc.ratio);
    if (r == null) {
      bad.push(`selfCheck.ratio 解析不出 W:H：${JSON.stringify(sc.ratio)}`);
    } else if (gv.width != null && gv.height != null && gv.height !== 0) {
      compared++;
      const actual = gv.width / gv.height;
      if (Math.abs(r - actual) > 0.01) {
        bad.push(`selfCheck.ratio ${JSON.stringify(sc.ratio)} 与 generatedVideo ${gv.width}x${gv.height}（比值 ${actual.toFixed(4)}）比例不符`);
      }
    }
  }
  if (hasClip) {
    hSeen++;
    if (sc.clippedSamples === 0) {
      compared++;
      const sp = sc.loudness && sc.loudness.samplePeakDbfs;
      const tp = sc.loudness && sc.loudness.truePeakDbtp;
      if (typeof sp === 'number' && sp > 0) {
        bad.push(`selfCheck.clippedSamples=0 但 loudness.samplePeakDbfs=${sp} > 0（物理不可能：0 削波却采样峰值超 0 dBFS）`);
      }
      if (typeof tp === 'number' && tp > 0) {
        bad.push(`selfCheck.clippedSamples=0 但 loudness.truePeakDbtp=${tp} > 0（物理不可能：0 削波却真峰值超 0 dBTP）`);
      }
    }
  }

  if (bad.length) { fails.push(`${slug}: ${bad.join('；')}`); rows.push({ slug, status: 'FAIL', why: bad.join('；') }); }
  else if (srtSkip) rows.push({ slug, status: 'SKIP', why: srtSkip });
  else rows.push({ slug, status: 'PASS', why: '' });
}

// ── ★ 失明守卫（防空转绿灯）────────────────────────────────────────────────
const blind = [];
if (slugs.length === 0) {
  blind.push(`\`${DIR}\` 下一个带 _distill.json 的风格都没枚举到（路径 / \`--only\` / 过滤变了？）⇒ 一份声称都没核过`);
}
if (slugs.length > 0 && compared === 0) {
  blind.push(`${slugs.length} 个风格里**一个可核字段都没核到**（muxEncoder 与 fps/frames/size/srtCues / ratio / clippedSamples / audioScoreBasis 全缺，或全 SKIP）⇒ 本闸门什么都没检查`);
}
if (slugs.length > 0 && filmsRead === 0) {
  blind.push(`**一个成片文件都读不到**（ffprobe 成功 0 部；成片根 = \`${FILM_DIR}\`）⇒ 「成片实际编码器」这一维已失明`);
}
// ★ 判据 F 的失明守卫（2026-10-08 补）：口径声明这一维自己也要防空转绿灯
const caliberTotal = CALIBER_FIELDS.reduce((a, k) => a + (CALIBER_REGISTRY[k] || []).length, 0);
if (slugs.length > 0 && caliberSeen === 0) {
  blind.push(`**一个口径声明字段都没读到**（${slugs.length} 份里 \`selfCheck.loudness.{${CALIBER_FIELDS.join(',')}}\` 全缺）⇒ 「口径声明」这一维已失明`);
}
if (caliberTotal === 0) {
  blind.push('口径声明登记表为空（`CALIBER_REGISTRY` 一条都没登记）⇒ 判据 F 无判据可依');
}
// ★ 判据 G 的失明守卫（2026-10-08 补）：`audioScoreBasis` 这一维自己也要防空转绿灯
if (slugs.length > 0 && audioBasisSeen === 0) {
  blind.push(`**一个 \`audioScoreBasis\` 都没读到**（${slugs.length} 份里全缺）⇒ 「散文分数 ↔ 权威 scoreBreakdown.audio」这一维已失明`);
}
// ★ 判据 H 的失明守卫（2026-10-08 补）：派生量护栏这一维自己也要防空转绿灯
if (slugs.length > 0 && hSeen === 0) {
  blind.push(`**一个派生量护栏字段都没读到**（${slugs.length} 份里 \`selfCheck.ratio\` 与 \`selfCheck.clippedSamples\` 全缺）⇒ 「派生量护栏」这一维已失明`);
}

// ── ★ 判据 F 反向守卫：登记项必须至少被一份真实 json 使用（否则登记表腐化 / 该写法已淘汰）──
//   ★ 只在**全量**跑（无 `--only`）时判 —— `--only a,b` 只读子集，此时「别的登记项没用上」是**必然**、不是缺陷。
if (!only.length) {
  for (const k of CALIBER_FIELDS) {
    for (const v of (CALIBER_REGISTRY[k] || [])) {
      if (!caliberUsed.has(`${k}\u0000${v}`)) {
        fails.push(`登记表条目**从未被任何风格使用**（登记表已腐化 / 该写法已被淘汰，请从 \`CALIBER_REGISTRY\` 删掉）⇒ ${k}：${JSON.stringify(v)}`);
      }
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ ffprobe: FFPROBE, distillRoot: DIR, filmDir: FILM_DIR, expected: EXPECTED, slugs: slugs.length, filmsRead, compared, caliberSeen, caliberTotal, audioBasisSeen, audioClaimSeen, hSeen, caliberUsed: [...caliberUsed].map((x) => x.replace('\u0000', ' → ')), caliberRegistry: CALIBER_REGISTRY, rows, fails, ...(blind.length ? { blind } : {}) }, null, 2));
} else {
  console.log('check-selfcheck-claims —— `_distill.json#selfCheck` 里对实物可核的声称 vs 真值');
  console.log(`  ffprobe    : ${FFPROBE}`);
  console.log(`  风格树     : ${DIR}`);
  console.log(`  成片根     : ${FILM_DIR}   期望编码器: ${EXPECTED}`);
  console.log(`  风格数 ${slugs.length}   成片读到 ${filmsRead}   比对 ${compared} 处   口径声明 ${caliberSeen} 处（登记表 ${caliberTotal} 条）   audioScoreBasis ${audioBasisSeen} 份（分数声称 ${audioClaimSeen} 处）   派生量护栏 ${hSeen} 处`);
  console.log('');
  for (const r of rows) {
    const mark = r.status === 'PASS' ? '  ok ' : r.status === 'SKIP' ? ' skip' : ' FAIL';
    console.log(`${mark}  ${String(r.slug).padEnd(22)} ${r.why || ''}`);
  }
  console.log('');
  if (blind.length) {
    console.log('✘ 本闸门已失明：');
    for (const b of blind) console.log(`  ✘ ${b}`);
    console.log('');
  }
  if (fails.length) { console.log(`✗ ${fails.length} 条声称与真值不符：`); for (const f of fails) console.log(`  - ${f}`); }
  else if (!blind.length) console.log(`✓ ${slugs.length} 个风格的 selfCheck 声称（muxEncoder ${EXPECTED} + fps/frames/size + srtCues + loudness.{truePeakMethod,lraMethod} 口径声明 + audioScoreBasis 分数 ↔ 权威 scoreBreakdown.audio + ratio/clippedSamples 派生量护栏）与真值全部一致。`);
}
process.exit((fails.length || blind.length) ? 1 : 0);
