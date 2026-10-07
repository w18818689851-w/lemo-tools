# 风格蒸馏 · 子智能体作业简报（每风格一份 Skill 文档）

> 这份简报是**长期循环**的作业标准：每次项目新增风格、或已有风格源码变更，
> 都按它重跑一遍。它只描述「怎么做」，不描述「本次做了哪些风格」。

---

## 你的交付物（两份，缺一不可）

1. `D:/lemo-tools/lib/style-skills/<slug>/SKILL.md`
   —— 人类可读的风格制作 Skill 文档，**严格按 11 节契约**（见下）。
2. `D:/lemo-tools/lib/style-skills/<slug>/_distill.json`
   —— 机器可读的自检记录（形状见下）。

---

## ★ 先搞清「四个件」与「唯一读取入口」的关系（别只知 check 不知 reader）

这套流水线**只有四个件**（不要再造第五个），外加**一个读取入口**：

| 件 | 职责 |
|---|---|
| `D:/lemo-tools/scripts/style-distill.mjs` | **顺序驱动**：`plan`（按**源码指纹**报出新增/变更风格）· `render`（顺序出片，可断点续跑，失败不阻断）· `frames`（24 帧 + 6×4 接触印样）· `status` |
| `D:/lemo-tools/scripts/style-skill-check.mjs` | **文档自检校验器**：11 节齐全 / 顺序 / 无占位符 / 每节 ≥80 字 / `_distill.json` 完整 |
| `D:/lemo-tools/lib/style-skill-reader.mjs` | ★ **Skill 文档的唯一读取入口**（三条生成通路共用；缺失即返回 null 降级，**绝不抛**）。导出 `readStyleSkill` / `hasStyleSkill` / `summarizeStyleSkill` / `describeStyleSkill` |
| `D:/lemo-tools/_distill/AGENT-BRIEF.md` | 本文件：**长期循环复用**的作业标准（新增风格按它重跑） |

**「自动纳入」怎么落地**：指纹判据复用 `scripts/style-scan.mjs` 的**内容哈希**（不是时间戳）；
`style-distill.mjs plan` 把它与 `_distill/state.json` 里「上次蒸馏时记下的指纹」比对 ⇒ 新增目录与源码变更都自己冒出来。
★ 注意：**指纹读 WIN 副本（`D:/lemo-opuscar`）、渲染读 WSL 副本** ⇒ 跑 `plan` 之前先用
`node D:/lemo-tools/scripts/check-dual-copy-sync.mjs` 确认两边一致，否则结论无效
（★ 2026-10-06 起它还会**参考级**报出「两侧 git 历史是否分叉」—— 若报「已分叉」，说明**文件虽同步、提交却在单侧**
（实测 WSL 侧看不到 WIN 的新提交）⇒ 别把 WSL 那份当权威，收敛方向由人定）。
★ 已知边界：`.py`（混音/TTS 源码）**不在**指纹范围内（见 `style-scan.mjs` 的排除说明）——
改混音源码不会触发重新蒸馏，需要时手工 `render --only <slug>`。

**三条通路怎么用它**：`lemo-make.mjs`（主题+风格）与 `dub.mjs`（文案+风格 / 文案+口播+风格）
都在选定风格后经 `lib/style-skill-reader.mjs` 读出该风格的方案并打印进日志/上下文（供人或下游智能体参考）。
★ 与 `lib/style-dna/` 的分工**不要合并**：`style-dna` = **原料**（可机器消费的数值：grain / 折行 / 响度目标）；
`style-skills` = **成品**（给人/智能体读的制作方案）。**先问 skill 要「方案」，再从 dna 取「数值」。**

---

## 第一步：先读资料（**优先用项目内的详细资料**）

按这个顺序读，**能读到哪份就用哪份**，不要跳过：

| 优先级 | 文件 | 里面有什么 |
|---|---|---|
| 1 | `D:/lemo-opuscar/styles/<slug>/STYLE.md` | 风格规范（硬规则、配色、字体、禁忌） |
| 2 | `D:/lemo-tools/lib/style-dna/<slug>.md` | **最详细**的创作逻辑档案（换主题仍成立的规则 + `file:line` 证据） |
| 3 | `D:/lemo-opuscar/styles/<slug>/DEMO.md` | 样本片《片名》是怎么做出来的 |
| 4 | `D:/lemo-opuscar/styles/<slug>/demo/build.sh` | **权威**的完整构建链（9 步：配音→声线→ASR→配乐→事件→混音→字幕→渲染→混流） |
| 5 | `D:/lemo-tools/lib/style-dna/<slug>.json` | 15 个结构化字段（essence / materials_and_rendering / sentence_patterns / narrative_rhythm / shot_logic / sound_palette / asset_contract / evidence …） |
| 6 | `D:/lemo-opuscar/styles/<slug>/style.json` | 元数据：片名、一句话主题、分类、时长、帧数 |
| 7 | `D:/lemo-tools/lib/dub-styles.json` 里的 `<slug>` 条目 | 「文案+风格」通路的参数：palette / bgRecipe / subtitle / tags |
| 8 | `D:/lemo-opuscar/styles/<slug>/demo/` 下的源码 | `film.js` / `main.js` / `engine/` / `subjects/` / `mix.py` / `music/*.py` / `tools/*` |
| 9 | `D:/lemo-tools/_distill/logs/<slug>.log` | **本次真实出片**的完整日志（含耗时、帧数、混流参数、任何警告） |

**若某风格确实没有任何详细资料** → 明确写「本风格无额外详细资料，以下结论来自成片逐帧拆解 + 源码」，
不要编造资料出处。

---

## 第二步：逐帧看片（**一帧一帧地分析**）

帧图在 `D:/lemo-tools/_distill/frames/<slug>/`：

- `_contact.jpg` —— 6×4 接触印样，**先看这张**，一眼看全片节奏与色走。
- `f01.jpg` … `f24.jpg` —— 等间隔 24 帧单图，**逐张看**，用来核对细节。

### ★★ 抽帧时刻的**权威公式**（2026-10-03 实测判定，别再猜）

**`frames/<slug>/fNN.jpg` 的内容对应影片的 `t(NN) = (NN − 0.5) × dur / 24`。**

- 即 f01 在 `0.5×dur/24`、f24 在 `23.5×dur/24` —— **区间中心**，不是 `NN×dur/24`，也不是 `(NN−1)×dur/24`。
- 例：`pictogram-motion`（dur=163.583333）→ f11 在 **71.568 s**。
- **判据怎么来的**（可复现）：拿项目配方 `-vf fps=<24/dur>` 抽出 24 帧，与「按候选公式直抽的帧」逐帧比 SSIM。
  在 `pictogram-motion` 上：`(k−0.5)·d/N` 平均 **0.959**，`(k−1)·d/N` 0.783，`k·d/N` 0.762。
  再以 k=11 细扫：t=71.57 → **0.9937**，两侧 70.72 → 0.914、72.42 → 0.815 **陡降** ⇒ 峰位唯一。
- ⚠️ **不要用 `-vf "fps=…,showinfo"` 的输出 PTS 去反推** —— 它印的是 `0, d/N, 2d/N…`，
  与内容的实际时刻**差半个区间**（这正是本轮三份证据互相矛盾的来源）。
- ⚠️ 也因此：**文档里引用 `fNN` 时，要么只描述「这一帧里是什么」（推荐），
  要么按上面的公式写时刻**。写 `NN×dur/24` 会系统性偏后半个区间。

**逐帧要真的看出东西**，至少回答：
- 画面元素怎么随时间变？有没有"不动"的段落？
- 配色在片内有没有推移（暗→亮 / 冷→暖）？
- 字幕什么时候出现、停在哪儿、单行几个字？
- 转场是硬切还是叠化？切点大致在哪些帧？
- 有没有明显的瑕疵帧（糊、闪、错位、字幕溢出、黑边）？

**这些观察必须写进 SKILL.md 的「逐帧拆解要点」，并作为 `_distill.json.evidenceFrames` 的记录。**

### ★ 关于输出比例（2026-10-03 的重要口径，别搞错）

- **样片是用 `--ratio 16:9`（1920×1080）渲的** —— 43 个风格全部按 1920×1080 绝对像素构图，
  多数没有 `aspects` 声明（= 只支持 16:9）。**抽帧就是 16:9 的**，这是「风格原本长什么样」的权威证据。
- **产品导出默认值是 9:16（1080×1920）**。把 16:9 风格硬渲成 9:16 时，画面会被 1:1 塞在左上角、
  右侧约 43.75% 丢失、下方整片黑 —— 这是**已知缺陷**，要在第 2 节（画面构图）里**单独写一小段**
  「在 9:16（产品默认）下的表现」，写清楚会丢什么、字幕会不会被切。
- 也就是说：**第 2 节的主体按 16:9 写**（风格的原生构图），9:16 只作为一个带缺陷说明的子段。

---

## 第三步：写 SKILL.md（11 节契约，**标题逐字一致**）

模板见 `D:/lemo-tools/lib/style-skills/_TEMPLATE/SKILL.md`。11 节标题**必须**是：

```
## 1. 风格说明
## 2. 画面构图
## 3. 配色体系
## 4. 转场规则
## 5. 字幕样式
## 6. BGM / 音效特征
## 7. 素材偏好
## 8. 镜头节奏
## 9. 制作参数清单
## 10. 编排规则
## 11. 当前短板与避坑要点
```

外加文末的 `## 蒸馏证据` 一节（不算在 11 节里）。

### 硬性要求

- **每节 ≥ 80 字实质内容**（校验器会数）。
- **不许留占位符**：`<slug>` / `<中文名>` / `___` / `…` 都不许残留。
- **参数必须具体**：写「字号 4.2% 画面宽」而不是「字号适中」；写 `#f1e8d2` 而不是「米黄」。
- **能追溯到证据**：关键结论后面挂来源，如 `（STYLE.md §2）` / `（style-dna/ascii-crt.md:41）` / `（帧 f07/f13）`。
- **第 11 节要诚实**：已知缺陷、素材缺口、能力限制、踩过的坑，**有什么写什么**，不许粉饰。
  特别要写清楚：**本次成片实际跑通了没有**、有没有走 `--skip-sync`、有没有用预生成配音、
  混流走的是 GPU 还是 CPU、有没有告警。
- **第 9 节要给可直接抄的命令**（以 `demo/build.sh` 为准）。
- **第 10 节要写清「换主题时要改哪些文件」** —— 这是三条生成通路复用本风格的关键。

### frontmatter

```yaml
---
name: lemo-style-<slug>
description: 【lemo 风格 Skill · <中文名>】<一句话：什么时候用、能交付什么观感>。选定本风格做视频时，优先读本文件。
slug: <slug>
name_zh: <中文名>
category: <分类>
film: <样本片名>
---
```

---

## 第四步：写 `_distill.json`

```json
{
  "slug": "<slug>",
  "nameZh": "<中文名>",
  "distilledAt": "<ISO 时间>",
  "matchScore": 0,
  "scoreBreakdown": {
    "palette": 0,
    "composition": 0,
    "typography": 0,
    "rhythm": 0,
    "audio": 0
  },
  "defects": [],
  "resolvedDefects": [],
  "assetGaps": [],
  "limits": [],
  "evidenceFrames": ["_contact.jpg", "f01.jpg"],
  "sources": ["styles/<slug>/STYLE.md", "lib/style-dna/<slug>.md"],
  "generatedVideo": {
    "path": "D:/lemo-films/<slug>/<slug>.mp4",
    "durSec": 0, "bytes": 0, "width": 0, "height": 0, "fps": 0, "frames": 0
  },
  "selfCheck": {
    "rendered": true,
    "usedPreGeneratedAudio": false,
    "muxEncoder": "nvenc",
    "warnings": [],
    "loudness": {
      "integratedLufs": 0, "truePeakDbtp": 0, "lra": 0,
      "peakDbtpTarget": -1.2, "peakTargetMet": true,
      "truePeakMethod": "ffmpeg … -af loudnorm=…:print_format=json 的 input_tp（4× 过采样）",
      "lraMethod": "ebur128=peak=true 的 LRA（项目口径）"
    }
  }
}
```

### ★★ 结构契约（**必填键，一个都不能少**）

`check-skill-scores.mjs` / `check-film-delivery.mjs` / `check-lra-caliber.mjs` 会逐项核。历史上有过 43 份字段漂移
（`resolvedDefects` 缺 22 份、`loudness.lra` 缺 23 份），已由 `scripts/normalize-skill-schema.mjs` 拉齐 ⇒ **别再漏**。

| 要求 | 说明 |
|---|---|
| `resolvedDefects` | **必须有**，没有已修缺陷时写 `[]`（不要省掉这个键） |
| `scoreBreakdown` 五键 | 必须是**数字**（`matchScore` == 五键之和，机械校验）。**不要**往里塞对象/旁注 |
| `selfCheck.loudness` | 七个键齐全（见上）。★ **真峰值/响度的权威位置就是这里**，不是 `generatedVideo` |
| `generatedVideo` | 除 path/durSec/bytes 外，`width/height/fps/frames` 也要写（下游要靠它免解析散文） |
| `matchScore` | == `scoreBreakdown` 五项之和（**上限 20/维**）；改任一维必须重算 |

**口径约定（别用错，历史上踩过四次）**：
- **真峰值** = `loudnorm` 的 **`input_tp`**（4× 过采样）。**不是** `astats` 的 `Peak level dB`（那是采样峰值，差最大 1.62 dB）。
- **LRA** = **`ebur128`** 的 `LRA`。**不是** `loudnorm` 的 `input_lra`（系统性偏大，实测同一片 6.0 vs 8.20）。
- **采样峰值**只作参考，不要拿来判达标。
- 交付线：真峰值 **≤ −1.2 dBTP**、响度 **≈ −14 LUFS**。

### ★ 「已修」约定（缺陷修好之后怎么写）

**原始观察一律保留**，在句末追加 `★ **<日期> 已修**：…原记录保留作历史`。
同时把该条从 `defects` **移入 `resolvedDefects`**，并把它的标签扣分**回补**到对应维度（上限 20）、重算 `matchScore`。
★ **改完一定要同步 SKILL.md 的自评分数行**（`check-skill-scores.mjs` 第 ③ 项会核「人读的分数 == json 的分数」）。

### `matchScore` 怎么给（0–100，**不许虚高**）

拿**成片抽帧**与 **`STYLE.md` / `style-dna` 里声明的风格特质**逐条对：
- 配色是否对得上声明的色值？（`palette` 20 分）
- 构图/负空间/图层顺序是否对得上？（`composition` 20 分）
- 字幕字体/字号/位置/折行是否对得上？（`typography` 20 分）
- 镜头节奏与全片时长是否落在声明区间？（`rhythm` 20 分）
- 配乐/拟音/响度是否对得上？（`audio` 20 分）

**每扣一分都要在 `defects` 里写出对应的具体缺陷。** 客观受限（素材缺、本机跑不通）就在
`limits` / `assetGaps` 里写明，并说明「最高可达分是多少、为什么达不到」。

### 「真峰值超标」怎么扣（2026-10-03 立，用于后续统一）

判据一律用 `loudnorm` 的 `input_tp`（4× 过采样），不用 astats 采样峰值。
- 真峰值为**正** ⇒ 实际削波 ⇒ 扣 **−4**（这是本项最重的一档）
- 真峰值为**负但超 −1.2 dBTP 交付线** ⇒ 未削波、仅超线 ⇒ 扣 **−2**
- 达标（≤ −1.2 dBTP）⇒ 不扣
- ★ **减半条款**（口径在此定死，别再各读各的）：若过冲的**根因在 mux/编码阶段** ——
  即该风格的 `mix.wav` 本身合规、越线是 **loudnorm 抬峰 + AAC 编码过冲**引入的、
  **不是它自己的混音链造成的** ⇒ 上述扣分**减半**，并在缺陷条目里注明「项目级既有缺陷，非本风格音频链所致」。
  ★ **不要按「走 core 还是走自带副本」来分**：`core/render/mux.sh`（**2026-10-03 起 `LN_TP` 默认已由 −1.7 改为 −3.5，且可被 `LEMO_LN_TP` 覆盖**；改前是 −1.7、0.5 dB 余量 —— 全量扫描证明那余量不够，过冲最高 +1.66 dB）　★★ **原记（2026-10-07 b84-a 订正）**：上面那句记的是 **2026-10-03 的当时状态**，**已过期** —— core 于 **2026-10-05 改回「`LN_TP` 起点 **−1.7** + 编码后复核闭环」**（不是 −3.5）：现值见 `D:/lemo-opuscar/core/render/mux.sh:94` = ``LN_TP="${LEMO_LN_TP:--1.7}"``，配套 `LN_TP_STEP=0.25`（`LEMO_LN_TP_STEP`）/ `LN_TP_TRIES=8`（`LEMO_LN_TP_TRIES`），闭环 = 「编一次 → 量成片真峰值（≤ −1.2 dBTP 且 −14±1 LU）→ 不达标按步长下调 TP 目标**只重编音频** → 最多 8 档」。★ 这四条口径由 `scripts/check-mux-parity.mjs` 的 `CORE_EXPECT` 守着（core 是 34 个风格共用的一份，一变全体跟随）；同日 `scripts/check-mux-selection.mjs` 守自带副本的四项口径。★ 保留原句是为了留下「为什么当初会收紧到 −3.5」的推理链（0.5 dB 余量不够、过冲最高 +1.66 dB），现值以本节为准。
  与各 demo 自带的 `mux.sh` 副本（多半写死 `TP=-1.2`，**零余量**）**都是项目提供的模板**，
  都不是该风格音频设计的锅 ⇒ **两类一律减半**。
  （2026-10-03 实测归属：`blueprint`/`dataviz` 走 core；`microgame`/`risograph`/`stained-glass`/`crayon-book`
  走自带副本 —— 两类都按减半处理。）
- ★ 该风格自己的 `STYLE.md` 若声明了更严上限（已知 3 家：`game-show:76` / `halftone-dossier:79` /
  `pictogram-motion:80` 都写「true peak ≤ −1 dB」），**按它的声明判达标**，并在文档里注明出处。

⚠️ 已知未统一（2026-10-03）：`game-show` audio −4、`halftone-dossier` −7、`pictogram-motion` −2
三家在真峰值项上的扣分与本规则不一致。**下一轮统一时，先逐份读它们的 `defects` 确认扣分构成**，
不要只看总分就改。

---

## ★★ 第 5 节「字幕样式」必须写清「两条通路」的字幕差异（2026-10-03 立）

★ **先说清一个容易搞混的编号**：
- **`STYLE.md` 的 §4** = "Type & subtitles"（原样本的风格声明）。
- **`SKILL.md` 的第 5 节** = 「字幕样式」（你要写的那一节）。
- `SKILL.md` 的 11 节顺序是：1 风格说明 / 2 画面构图 / 3 配色体系 / **4 转场规则** / **5 字幕样式** /
  6 BGM·音效特征 / 7 素材偏好 / 8 镜头节奏 / 9 制作参数清单 / 10 编排规则 / 11 当前短板与避坑要点。
  ★ 别把「STYLE.md §4」当成「SKILL.md 第 4 节」——第 4 节是**转场规则**，写错章节会被 `style-skill-check.mjs` 拦下。

★ **两条通路的字幕不是同一套实现，第 5 节要分别交代**：
1. **样板片通路**（`lemo-make.mjs` 驱动各风格自己的 `demo/`）：字幕由该风格 `demo/` 的 Canvas/DOM
   代码自己画（见 `lib/dub-visual.json` 的 `styles.<slug>.subtitleStyle`，有 `fn`/`file`/`line`/`band` 等实据）。
2. **「文案+风格」「文案+口播+风格」通路**（`dub.mjs` + `lib/dub-core.mjs` 的 `buildAss()`）：
   字幕走 ASS。★ 这里 2026-10-03 修了一个**长期存在但没人发现**的缺口 ——
   ASS 的 `BorderStyle=1` 下 **`BackColour` 不参与渲染**（只有 Outline + Shadow 生效），
   所以各风格 §4 声明的「底衬 / 胶囊 / 色带 / 字幕卡」在这条通路上**从来没画出来过**。
   现在按 `subtitle.plate` 分档：缺省 `'shadow'`（= 旧行为，逐字节不变）/ `'box'`（切 `BorderStyle=3`，
   此时 `Outline` 变成**盒内边距**、**`OutlineColour` 变成盒填充色** —— ★ 注意是 OutlineColour 不是 BackColour）/ `'none'`。
   目前 25 个风格开了 `'box'`，其余 18 个 + `plain-dark` 基线保持 `'shadow'`。

★ **写第 5 节时的硬要求**：
- 对开了 `plate='box'` 的风格，要写明：底衬形态（引 §4 原句）、`BorderStyle=3` / 盒内边距 10 / `Shadow=1`、
  `BackColour` 的具体值、**该值的来源**、以及**字色与有效底衬的 WCAG 对比度**。
  数据一律从 `lib/dub-styles.json`（实际配置）与 `lib/dub-visual.json` 的
  `styles.<slug>.subtitleStyle`（`plate` / `plateColor` / `plateContrast` / `plateSource` / `plateEvidence`）读，**不许自己编**。
- 若 `plateSource` 显示是**回退值**（不是 demo 的 band 真值），必须写明「底衬色为回退值」及原因
  （demo 的 band 色与该风格配置的 `palette.subtitle` 字色对比度不足），并在第 11 节补一条短板。
- 未开 `box` 的风格，要写明「本风格未开底衬」以及为什么（§4 明写 no box / demo 的底衬是手撕边等
  **非矩形**形状 ASS 画不了 / 底衬属于说话人名牌而非字幕行 / 与配置字色冲突）。

★ **box 模式下 `Shadow` 必须为 0**（2026-10-03 像素实测判定）：
`BorderStyle=3` 下 ASS 的阴影是一份**与底盒几乎完全重叠**的整盒副本，会把半透明底衬**二次合成**
（不透明度从 `a` 变成 `1−(1−a)²`）。实测 `hd-2d`：`Shadow=1` → 盒内 rgb(110,103,85)、对比度 3.18；
`Shadow=0` → rgb(158,148,124)、对比度 5.95（= 单层合成的理论值）。25 个风格里 18 个是半透明底衬。

★★ **底衬有「两个检查器」，改完两个都要跑**（缺一不可）：
- `node scripts/check-dub-styles.mjs` —— **模型级**：取值合法 / 显式色画不出来 / 对比度 ≥4.5 /
  STYLE.md 声明冲突 / 必须有 `dub-visual` 证据。**快，但只看模型。**
- `node scripts/check-plate-pixel.mjs` —— **像素级**：真实渲染一帧，用「品红标记色」验证
  底衬色**确实取自 `plateColor` 字段**，并实测字色对比度 ≥4.5。**慢（25 个风格约 1 分钟），但是真值。**
  ★ **2026-10-07 补（修「扫到 0 个对象却全绿」）**：**底衬差分 0 像素**（底盒没画出来 / 与背景同色 ⇒ 视觉上等于无底衬）
  判**真缺陷 FAIL**（旧版这一行**没有 `ok` 字段** ⇒ 被 `fails` 过滤漏掉 ⇒ 全库差分 0 时仍打「✓ 全部通过…」+ exit 0，
  **一个底衬色都没真正判过**；同型于 `check-dub-styles.mjs` 的 `skipped === dub.styles.length`）；并加计数式守卫：
  **全部**风格都差分 0 ⇒ 明说「一个底衬色都没真正判过」。**部分**差分 0 = 逐风格真缺陷 FAIL（不设阈值）。
  ★ 为什么必须有它：模型级检查器**漏报过** —— 底衬色被填错字段时它仍报 25/25 通过，
    而实际渲染 12/25 个风格对比度只有 1.00~1.43（字幕根本看不清）。
  ★ 它的绝对色差阈值只能当**粗筛**：渲染链有 YUV 往返，高饱和色会掉饱和（实测偏差与饱和度正相关：
    `backrooms` Δ0 → `risograph` Δ2 → `tilt-shift` Δ8 → `papercut-red` Δ17），
    所以**决定性判据是品红标记色测试，不是绝对色差**。

★ **踩过的坑（别重犯）**：
- **ASS 的 alpha 是「透明度」：`00` = 完全不透明，`FF` = 完全透明**（与 CSS 相反）。
  判「这个颜色画得出来吗」必须用 `isVisibleColor()`，**不能**写 `alphaOf(v) > 0`
  （那会把 `#00A8111F` 这种**不透明**色误判成不可用；也会误以为 `#00000000` 是全透明 ——
  它其实是不透明黑）。
- 开底衬前**必须**算「字色 vs 有效底衬」的 WCAG 对比度。半透明底衬要先与该风格的有效背景合成
  （`bgRecipe.type='solid'` ⇒ 用 `stops[0]`，否则用 `palette.bg`）。已有实例：`silkscreen-poster`
  的字色与它自己的 `subtitleBack` **完全相同**，直接开 `box` 会让字幕整体消失。
  该检查已固化为 `node D:/lemo-tools/scripts/check-dub-styles.mjs` 的硬红线（对比度 < 3.0 直接 FAIL）。

---

## 第五步：自检（**必须做**）

**先跑这两个**（快、必过）：

```bash
node D:/lemo-tools/scripts/style-skill-check.mjs --only <slug>   # 11 节契约 + 无占位符 + 每节 ≥80 字
node D:/lemo-tools/scripts/check-skill-scores.mjs                # 评分自洽（3 项，含「正文自评 == json」）；★ **失明守卫（2026-10-06 补）**：注册表读不到 / 一个带 `_distill.json` 的风格都枚举不到 ⇒ **FAIL 并明说「本闸门已失明」**（旧版打印 `[1] 0/0 OK` = 静默假绿）；覆盖点 **`LEMO_DISTILL_ROOT`** + **`LEMO_DUB_STYLES`**；★★ **2026-10-06 收紧第 ② 项（修假绿）**：旧判据把「defect 仍引用当前配置值」实现成「在**整份配置条目文本**里搜 `#hex`」⇒ 引用**别的字段**的色也能满足 ⇒ 本该 FAIL 的「全失效」被降级成 WARN「混合条目」（exit 0）。新判据**复用同一次断言抽取**：逐条断言只要其引用值 == **它所涉字段**的当前值（texture / fontFamily / palette.\<field\>）就记一次 citesCurrent，`citesCurrent > 0` 才算混合。真实 43 份断言 22 条 / 有证伪 0 条 ⇒ 真实语料一次都没触发、输出逐字不变（exit 0）
```

必须输出 `✔` / `OK`。不通过就改到通过为止（常见：某节字数不足、占位符没清、`_distill.json` 字段缺、
`matchScore` 与五项之和对不上、SKILL.md 的自评分数与 json 不一致）。

**再跑这些**（全库级，确认你没把别的风格弄坏）：

```bash
node D:/lemo-tools/scripts/check-film-delivery.mjs     # 成片口径：文档声称值 vs 实测值 + 容器健康。★ 2026-10-06 补 **F 段「重渲窗口守卫」**：A/B/C/D 判的是「文档 vs 实测」，而**日批重渲成片**后文档要等批次跑完才回填 ⇒ 在「成片已重写、文档还没回填」的窗口里这些「不一致」**不是回归**（实证：本闸门曾报 exit 1 / 23 处 / 12 部，用改前 `mux.sh` 复跑**逐字节相同**、且 12 部全在当日 09:04–09:33 重渲名单里 ⇒ 是文档过期不是回归）⇒ 判据：**成片 mtime 新于 `_distill.json` mtime**（必要条件）**且**（成片 ≤15 min 内被写 / 该 slug 的并发锁活着（`<LEMO_LOCK_DIR>/.<slug>.lock`，判据逐字复用 `lemo-make.mjs:1559-1563`）/ `_distill` 的 `render-run-*.log`、`state.json`、`logs/*.log` 最新 mtime ≤10 min）⇒ **不判 FAIL**、报「疑似正在重渲，本次不判」并列出本会报的每一条；**真漂移照旧 FAIL**、E 类恒判不让位；成片/文档 mtime 拿不到即判「失明」并 FAIL。★ **排空后若仍红 ⇒ 那是真漂移或文档待回填**（先看有没有 `C 真峰值超标`/`C 响度偏离交付线`/D 类：没有就只是文档过期 ⇒ 跑 `refresh-style-skill.mjs`）。覆盖点：`LEMO_MUX_SH` / `LEMO_OPUSCAR` / **`LEMO_DISTILL_ROOT`** / **`LEMO_BATCH_DIR`** / **`LEMO_LOCK_DIR`**（供非破坏变异；`--json` 时 `[E]` 那行走 stderr，输出可 `JSON.parse`）。★★ **2026-10-07 补 F 段计数式失明守卫**：F 段让位是**有意的**（避免并发重渲误报，**不删**），但若**每一部**成片都让位 ⇒ `judged=0` ⇒ 旧版打印「✓ 被判的 **0** 部成片交付口径全部一致」+ **exit 0**（**一部都没判**、且每条本会报的错都被「若不是疑似重渲，本会报」吞掉）；现判据 **让位数 == 成片总数 ⇒ FAIL 并明说「一部成片都没判」**（写法照 `check-skill-artifacts` 的「全部 SKIP」）。★ **部分让位不判 FAIL**（让位是 per-slug 时序信号、有意按片判定；部分让位时其余片子仍被真判 ⇒ 闸门没空转；真实语料 43 部 **0 部**让位 ⇒ 误报率无样本可测、不设阈值）
node D:/lemo-tools/scripts/check-tp-prose.mjs          # SKILL.md **正文**里的真峰值声称 vs 实测（★ 2026-10-05 修结构性失明：旧「值 > −1.2 才查」把「已修/重渲后**已达标**」的值**全排除** ⇒ 现「关于成片的**当前结论句无论是否达标**，与实测差 > 0.15 dB 即 FAIL」；旧 ① 换成「阈值/交付线提及」排除（数值 == `peakDbtpTarget`，或阈值词紧贴）；★ 2026-10-05 **修 60 字窗假阴**：判据 ③ 由「匹配点前后 **60 字**内出现『成片』」放宽为「**整行**含『成片』」（实测旧窗假阴 8/8 = 100%；`hd-2d:120` 的『成片』离数值 **69** 字）；配合新增 **⑥ 非本片产物排除**（数值所在句出现 `mix.wav`/`score.wav`/`母带`/`中间产物`/`上游`/`样片`/`素材` ⇒ 那是上游读数、不是成片声称）把误报压到 **0**（不加 ⑥ 时误报 2/10 = 20%）；★ 实验行「多目标→多实测」排除；全部读不到真峰值即判失明；LEMO_DISTILL_ROOT / LEMO_TP_MEASURED_JSON 可覆盖，供非破坏变异；★★ **2026-10-05 泛化**：本闸门已从「只查 dBTP」变成「**成片读数这一类声明**」的通用闸门（同一套抽取/排除/对账流水线，量纲以 `DIMS` 登记项加入）—— 覆盖 **dBTP / LUFS / LRA / 字节数 / 分辨率 / 帧数（FAIL）+ 体积 MB / 时长（参考）**，真值复用 `check-film-delivery` 的实测结论；覆盖点新增 **`LEMO_READINGS_MEASURED_JSON`**（多量纲真值覆盖 `{slug:{dBTP,LUFS,LRA,bytes,durSec,width,height,frames,dBFS:{samplePeak,truePeak,ebur128Peak}}}`，指向 `{}` 即逐量纲失明）；★★ **2026-10-05 下半场再纳入 `dBFS`（第 9 类量纲）**：全库 149 个 `<数> dBFS` 此前无人对账，难点是**口径歧义**（混用 `ebur128 Peak` 1 位小数 / `astats` 采样峰值 6 位 / `loudnorm input_tp` 真峰值三个口径）⇒ 必须「**口径感知 + 多真值**」：真值取 `samplePeak`（json `samplePeakDbfs` / `audioEvidence.astatsPeak6dp`，43/43 都有）、`truePeak`（`truePeakDbtp`）、`ebur128Peak`（= `round(truePeak,1)`，实测 43/43 相等）；口径词按「所在句内离 token 最近」选（`astats|采样峰值` ⇒ 采样峰值容差 0.01；`ebur128|Peak` ⇒ 容差 0.001；`input_tp|真峰值|dBTP|TPK` ⇒ 0.15；`RMS` ⇒ 参考；**无口径词 ⇒ 参考、不判**）。**误报率逐级实测**：放宽 20 命中/误报 20（100%）→ 朴素单真值 4/100% → 口径「首个命中」8/100% → 最终 **0/0**。**另立第 ⑩ 类「物理约束」FAIL**（真峰值 ≥ 采样峰值 恒成立 ⇒ 「采样峰值 > 真峰值」物理不可能，不需口径判断）：数据级（json 自相矛盾）+ 声称级（同句），容差 0.1。**实测 dBFS 真陈旧 0、物理不可能 0 ⇒ 未改任何文档**；★ **2026-10-07 收紧 ⑤「历史语境豁免」（`CUR` 反向守卫）**：整行豁免留了个洞 —— 一行完全可能**既有历史叙述、又有当前结论**（「原先只走 `BorderStyle=1`，**现已切到** `BorderStyle=3`」），整行豁免会把行内的**当前读数**一起放过。现改为 **`HIST && !CUR` 才豁免**，`CUR = 现状|当前结论|目前|仍然|依旧|仍是只|仍只`（机制移植 `check-aspect-prose.mjs` 的 `CUR` 常量）。**实测（43 份正文）**：走到 ⑤ 的**量纲 token 350 个**（dBTP 191 / dBFS 54 / dur 34 / LUFS 23 / bytes 19 / frame 9 / LRA 8 / WxH 6 / MB 6；另 **297** 处是「物理约束」扫描的**行级**命中，合计 647），所在行同时命中 `CUR` 的 **26** 行（全在物理约束扫描段、**不含**任何量纲 token）⇒ 收紧后真实语料 **FAIL 0 / 参考 279 / 静音 11 / 实验行 1 / 交叉引用 6 逐字节不变（误报 0）**；反向验证（`LEMO_DISTILL_ROOT` 夹具）：`已修：真峰值原为 −1.2 dBTP，现状 −0.5 dBTP（本片成片实测）` **改前 exit 0 / 陈旧读数 0** ⇒ **改后 exit 1 / 陈旧读数 1（dBTP 1）**，同夹具里「只有 `HIST` 没有 `CUR`」的行**仍豁免**（1 而非 2））；★★ **2026-10-07 b83-a 收窄 ⑦/⑨（两处「判太宽」的洞）**：⑦「非本片产物排除」原按**整句**（`。！？`）判 ⇒ `engraving:179` 的「…`源文件`…（成片真峰值 −3.27 dBTP）」因同句有 `源文件` 被**整句放掉**；⑨「交叉引用单列」原按**整行**判 ⇒ `paper-popup:109/:173` 的陈旧 `−2.33 dBTP` 因同行（**不同子句**）提到 `pictogram-motion`/`game-show`/`halftone-dossier` 被**整行豁免**、静默漏判。**先测再定（43 份真实语料 + 还原 3 处已知陈旧读数，逐条人工判真阳性/误报）**：① ⑦ 收到**子句**（`。！？；;`）⇒ 命中 6 / 真阳性 2 / **误报 4（67%）**（`brick-toy:169` 的「**混音**的 −15.5 LUFS」、`woodcut:160` 的「文件 11232044 B」都是**上游读数**，只是证据词在**兄弟子句**）⇒ 否决；② 连 `，` 也拆 ⇒ 命中 14 / 真阳性 3 / **误报 11（79%）** ⇒ 否决；③ **交付做法 = ⑦ 保持整句作用域 + 新增「成片归因」例外**（`FILM_ATTR = 成片|全片|本片`，读数紧前方 **≤20 字**内出现即判它）⇒ 命中 **3 / 真阳性 3 / 误报 0**；⑨ 收到**同一子句**（`。！？；;`）⇒ ⑨ 退回整行时命中从 **3 掉到 1**（漏 2 真阳性）⇒ 收窄必要。⑨ 收窄**顺带暴露**既有 ⑧ 缺口：`art-deco:43` 的 `1080×1920`（9:16 变体，本片 1920×1080）原靠同行 `silent-film` 被 ⑨ 整行豁免 ⇒ 补 **WxH 朝向守卫**（token 横竖与成片相反 ⇒ 排除；去掉它当前语料**误报 2**）。**真实语料终态**：`[闸门] 陈旧读数 0 处（dBTP 0 / LUFS 0 / LRA 0 / bytes 0 / WxH 0 / frame 0 / dBFS 0）/ 物理不可能 0 处 / 阈值提及排除 321 处 / 参考 281 处 / 静音读数 11 处 / 实验行 1 处 / 交叉引用 0 处 / 失明 无 OK`，exit 0。**文档更正**（真阳性，只改正文不改判据）：`paper-popup` L107/L109/L173/L174/L193/L202/L251/L259 与 `engraving` L179 —— 按当前入库成片实测值改写、原句保留并加 `原记` 历史标记（L174/L259 的「原记/当前」原先写反，一并纠正）。**测试**：`test/gate-blindness.test.mjs` 新增 5 条（⑦ 正向/阴性、⑨ 正向/阴性、失明）+ 2 条自证（删掉 ⑦ 归因例外 / 把 ⑨ 退回整行 ⇒ 正向断言必须变红），基数 53 → **58**。**覆盖点**沿用 `LEMO_DISTILL_ROOT` / `LEMO_READINGS_MEASURED_JSON`。★★ **2026-10-07 b83-a2（第二轮：⑤ 收窄 + 可见化）**：① **⑤ `修复后` 移出 HIST**（**不是**移入 CUR）—— 实测「移入 CUR」⇒ 命中 13 = **4 真阳性 + 9 误报**（`修复后` 一进 CUR，**凡同时含 `修复后` 与 `原记` 的行**整体失去豁免，行内 `原记` 历史值被当陈旧：`paper-popup:107/:193/:259` 7 处 + `paper-lantern:202` 1 处，后者**已冻结**）；而「**直接删掉**」⇒ 命中 **4 / 真阳性 4 / 误报 0**（全是 `pictogram-motion:107` 的真陈旧读数）⇒ 采用。② **⑤ 保持整行、不收子句** —— 实测收到子句后命中从 4 暴涨到 **110**，其中 **106 处误报**（本库写法是「每行**一个**历史标记，行内其余读数不逐条标注」，`ascii-crt:95`/`backrooms:109` 等的 `历史`/`已修` 都在**兄弟子句**）；把历史词表扩到 `首版|原版|旧版|前版|重渲前|未达标|不达标` 也仍停在 **88** 处 ⇒ **子句粒度不可用**。③ **⑦ 归因窗实测表**（10/20/40 等价、7 字是语料实测最大归因距离、<7 字漏真阳性、**整句则 24 处误报**）⇒ 取 **20**；并把**物理约束段**的 ⑦ 由 `FILM_ATTR.test(sent)`（整句）统一到主循环的 `filmAttr(line, idx)`（20 字窗，逐 token）—— 消除两段口径分叉。④ **WxH 朝向守卫不再静默丢弃**：走这条路的 token 推入**「参考」桶**（`why = 画幅朝向与成片相反…`），真实语料 **2 处**（`art-deco:43` ×2），参考总数 287 → **289**。⑤ **文档更正**：`pictogram-motion/SKILL.md` 的 L107 / L145 / L171 / L202 / L214 / L221（陈旧响度声称 `TPK +0.3 dBFS` / `−0.0 dBFS` / `+0.28 dBTP` / `I = −14.0 LUFS` → 当前实测 `−1.63 dBTP` / `−14.5 LUFS` / LRA 4.3 LU / samplePeak `−1.643991`；原句保留 + 加 `原记`）。⑥ **测试夹具根修**：`check-plate-pixel` 的 4 个夹具只拷 `lib/dub-core.mjs`，而它新增 `import './env.mjs'`（→ `./styles-root.mjs`）⇒ `ERR_MODULE_NOT_FOUND`；新增 `copyDubCoreLib()` **按传递闭包拷 3 个文件并断言都到了**。⑦ `gate-blindness` 基数 58 → **60**（+1 ⑤ 用例 +1 ★自证），**60 passed / 0 failed**。**真实语料终态**：`[闸门] 陈旧读数 0 处（dBTP 0 / LUFS 0 / LRA 0 / bytes 0 / WxH 0 / frame 0 / dBFS 0）/ 物理不可能 0 处 / 阈值提及排除 325 处（== 交付线 297 + 紧贴阈值词 28）/ 参考 289 处 / 静音读数 11 处 / 实验行 1 处 / 交叉引用 0 处 / 失明 无 OK`，exit 0。★★ **2026-10-07 补 `_distill.json`「散文」pass（补一处实测确认的零覆盖区）**：本闸门此前只读 json 的**结构化键**（`loudness.*` / `audioEvidence.measuredInFilm.*` / `generatedVideo.*`），json 的**散文**字段（`selfCheck.loudness.peakNote` / `selfCheck.warnings[]` / `resolvedDefects[]` / `selfCheck.audio.*` / 一切 `*note`）**没有任何闸门在读** ⇒ 假值长期存活（实证：`halftone-dossier.peakNote` 曾写 `−3.26 dBTP`、实测 `−2.79`；`pixel-rpg.peakNote` 曾写 `0.08 dBTP`、实测 `−1.72` —— 见提交 `6cc328d` 的审计）。现把扫描面从「`SKILL.md` 正文」扩到「json 散文」，**复用同一套 `DIMS` / 阈值排除 / 成片语境 / 非本片产物 / 实验行 / 交叉引用 / 失明机制**，唯一分叉点是**历史豁免的粒度**。★ **为什么 json 不能沿用「整行」豁免**（这是本条纪律的姊妹条）：实测 **25 份 `peakNote` 全部只有 1 个物理行**（原句 + 历史标记 + 现值挤在同一行）⇒ 整行豁免会把**现值一起放掉**（闸门当场失明）。⇒ json pass 改用**关系粒度**：(J1) `X → Y` 的 **X**（更正前值）⇒ 参考、**Y 是现值 ⇒ 判**（★ 这正是第 13 条末段说「够不到」的那一类 —— 在 json 侧现在**够得到**了）；(J2) 更正记录里**不含箭头**的行 = 保留的原句 ⇒ 参考；(J3) **句子级**（token 所在句含 `HIST_JSON` 且不含 `CUR`）⇒ 参考；(J4) **值级**（同一值在字段别处紧邻历史标记）⇒ 参考 —— ★ J4 必须**归一负号**（正文 U+2212 `−` 与 ASCII `-` 混用，实测不归一就多 3 处误报）；(J5) **覆盖级**：`peakNote` 必须给出与权威 `truePeakDbtp` 一致的 dBTP 读数（交付线本身不算），否则 FAIL「未给出权威真峰值」。★ **字段白名单**：**判 FAIL** = `selfCheck.peakNote` / `selfCheck.loudness.peakNote` / `selfCheck.audio.*` / `audioEvidence.*` / 一切 `*note` / `generatedVideo.bytesNote`；**降级为参考**（时点记录 / 评分依据，按实测误报率）= `selfCheck.warnings[]` / `resolvedDefects[]` / `audioScoreBasis` / `audioEvidence.firstVersionDefect.*`。★ 另加 **json 数值自洽**（`selfCheck.audio.*` / `audioEvidence.*` 的 film 口径数值键 vs `loudness.*`）：跳过上游 / 中间产物路径（`mixWav` / `musicWav` / `measuredBeforeMux` / `firstVersionDefect`）与「有历史 `*Note` 兄弟键」的键（本库惯例 `truePeakDbtp` + `truePeakDbtpNote`，如 `game-show` 的 `-0.22` 由 note 标明是首版快照）。★ **误报率实测（43 份 json / 375 个散文字段 / 583 个可核读数，逐条人读）**：不加 (J1)–(J5) ⇒ 命中 **42**（真阳性 3 / **误报 39**）；加 (J1)(J2)(J3) ⇒ **10**；再加 (J4)（含负号归一）⇒ **7**；再把 `warnings[]` / `resolvedDefects[]` / `audioScoreBasis` 降级为参考 ⇒ **0 误报**。★ **真阳性 4 处（已用 `ffmpeg loudnorm input_tp` 逐部复核；`peakNote` 现值陈旧、json 侧未随 `SKILL.md` 同步）**：`blueprint`（`peakNote` 写 `−2.4`，实测/权威 `−1.42`）、`dataviz`（`−2.23` vs `−1.77`）、`microgame`（`−2.18` vs 实测 `−1.35` / json `−1.32`）、`shadow-puppet`（`peakNote` 写「超线 2.6 dB、已实际削波」，实测/权威 `−1.60` 达标）—— **本闸门只报不改，留人工处置**。★ **SKILL.md 路径未受影响**：把 json 源整体关闭后跑同一棵真实树，输出与改动前**逐字节一致**（`阈值 325 / 参考 289 / 静音 11 / 实验行 1 / 交叉引用 0`）。★ **四类验证（`LEMO_DISTILL_ROOT` 夹具树，非破坏）**：① **变异**：`halftone-dossier.peakNote` 现值 `−2.79` → `−9.99` ⇒ **exit 1 并点名**（基线单风格树 exit 0）；② **阴性对照**：全量真实树 + 把这 4 处现值改对 ⇒ **exit 0**；③ **反向验证**：把 json 源 + (J5) + 数值自洽**整段摘掉** ⇒ 变异**重新消失**（exit 0）；④ **失明**：`LEMO_DISTILL_ROOT` 指空树 ⇒ **exit 1 + 「本闸门已失明」**，另加「json 白名单散文里一个可核读数都没有 ⇒ 判 json 散文失明」。★ **真实语料现状**：`陈旧读数 3 处（dBTP 3）/ peakNote 覆盖 1 处 / json 数值 0 处 / json 散文 375 字段（可核读数 583 个）` ⇒ **exit 1**（= 上面那 4 处真阳性，待人工处置）。
node D:/lemo-tools/scripts/check-skill-film-fields.mjs # SKILL.md **正文**里的成片帧数/分辨率/时长 vs generatedVideo（★ 帧数=FAIL、分辨率=FAIL、时长=参考；全部读不到 generatedVideo 即判失明；★ **2026-10-07 收紧 ④「整行历史语境豁免」（`CUR` 反向守卫）**：原「整行含 `HIST` ⇒ 整行豁免」会把「既有历史叙述、又有当前结论」的行（「原先只走 X，**现已切到 Y**」）里的**当前读数**一起放过 ⇒ 改为 **`HIST && !CUR` 才豁免**，`CUR = 现状|当前结论|目前|仍然|依旧|仍是只|仍只`（与 `check-aspect-prose.mjs` 的 `CUR` 常量 逐字一致；帧数/分辨率/时长三处口径一并对齐）。**实测（43 份正文）**：走到 ④ 的 token **62** 个（帧数 7 / 分辨率 4 / 时长 51），被豁免 **22** 个，其中**同行匹配 `CUR` 的 0 个** ⇒ 真实语料**零误报**、改前改后输出**逐字节一致**（`0/0/40/失明 1`，exit 0）；反向验证（**新增覆盖点 `LEMO_DISTILL_ROOT`**，与 `check-tp-prose.mjs` 的 `LEMO_DISTILL_ROOT` 覆盖点同名同义）：夹具 `已修：成片帧数原为 100 帧，现状 999 帧。` **改前 exit 0 ⇒ 改后 exit 1、陈旧帧数 1**，同夹具「只有 `HIST` 没有 `CUR`」的行**仍豁免**）。★ **2026-10-07 b84-a 收窄 ⑨「交叉引用」作用域**：原按**整行**判 ⇒ 一行里任意位置出现别的风格名就把整行读数放掉（假绿）；现收到**同一子句**（`CLAUSE_SEP = /[。！？；;]/g`，与 `check-tp-prose.mjs` 逐字一致）。**实测（43 份正文）**：⑨ 当前**排除 0 个 token** ⇒ 真实语料改前改后输出**逐字节一致**（`0/0/39/失明 1`，exit 0）；合成夹具（真实树 + 注入「读数在前子句、风格名在后子句」）**改前 exit 0 / 改后 exit 1、陈旧帧数 1 + 陈旧分辨率 1、误报 0**；**反向证明**：只把 ⑨ 退回整行 ⇒ 夹具变绿。★ 同批补 **WxH 朝向守卫**（⑨ 收窄暴露的 ⑧ 缺口）：9:16 变体（竖画幅）⇒ **参考桶、不判 FAIL**（不静默丢弃），同朝向变体仍照判；真实语料该桶 0 处。★ 两闸门在同一合成夹具上结论逐项一致（`WxH 1 / frame 1 / 交叉引用 5`）。★ **未收敛重复实现**：删/薄封装会改动「闸门总数」（现 **32**），该数字散落在多处（`test/README.md` / 本简报 / `test/gate-blindness.test.mjs` 头注释 + 若干**带日期的历史复盘** `_distill/RETRO-*.md`，后者按纪律保留**其当时值**、不改）⇒ 留给能同时改齐的一批）
node D:/lemo-tools/scripts/check-lra-caliber.mjs       # 43 份的 lra 是否统一 ebur128 口径
node D:/lemo-tools/scripts/check-loudness-targets.mjs  # style-dna 能否解析出响度目标（防静默回落 −16）
node D:/lemo-tools/scripts/check-config-notes.mjs      # dub-styles.json 的 notes 与字段是否自相矛盾；★ **失明守卫（2026-10-06 补）**：注册表读不到 / `styles` 不是非空数组 ⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；覆盖点 **`LEMO_DUB_STYLES`**；★★ **失明守卫②（2026-10-07 补）**：`styles` 非空、但**没有一条带非空 notes** ⇒ 主循环把全部条目 `continue` 掉 ⇒ `fails=[]` ⇒ 假绿「✓ 未发现自相矛盾」+ **exit 0**（宣称检查过、实际一条 notes 都没读）；判据 = 真正读过 notes 的条目数为 0 且 `styles` 非空 ⇒ FAIL。实测（夹具 `{"styles":[{"slug":"a","notes":""},{"slug":"b"}]}` 经 `LEMO_DUB_STYLES` 注入）：加守卫前 `✓`+exit 0 ⇒ 加守卫后 `✘ 本闸门已失明：2 条配置里没有一条带 notes`+exit 1；真实语料（44 条 notes 全非空）改前改后**输出完全一致**（`0 处 OK；hex 参考 17 条`）
node D:/lemo-tools/scripts/check-config-vs-doc.mjs     # 配置底色是否在该风格 §3 配色体系里**以背景角色**出现。★★ **2026-10-06 补角色感知（修一个已确认的真实盲区）**：旧判据只做**集合包含**（`palette.bg` 在 §3 的任意 hex 里出现过就放行），而 `hd-2d` 的 `#fff0c8` 是**灯塔灯光色**、**确实**写在 §3 的 `| 主（暖实体光） | … 灯塔 \`#fff0c8\` | … |` 行 ⇒ 命中、放行，真错靠人工才发现。新判据：① 解析 §3 **表格行**（角色列=第 1 列）；② 候选色（`palette.bg` + `bgRecipe.stops`）的命中行**精确优先**（逐字节相同 ⇒ 用它 + `欧氏距离 ≤ NEAR_ROLE=12` 的近似行），**无精确才退回 `NEAR=26`**（保留旧容忍度 —— `brick-toy` 的 `#f4f4f1` vs 文档 `#F2F2EE`、`living-screencast` 的 `#0C1016` 都靠它才不误报）；③ 非背景标记 `/灯|光|发光|glow|emissive|强调|accent|描边|边框|高光|亮部/i` **只扫角色列**（用途列是散文，`risograph` 的合法背景行 `纸白（底）` 用途里就写着「描边光晕」、`ascii-crt` 的 `产品通路（dub）` 写着「accent」⇒ 扫用途列会误报；「字/前景」也不入表，否则 `pictogram-motion` 的合法底色 `米白 CREAM`（用途「深色相上的**前景字**与人、片尾底色」）会被误伤）；④ 命中行里有一行角色列**不含**标记 ⇒ 放行，否则（不在 §3，或**只**在非背景角色行）⇒ 判可疑。★ **为什么精确优先**：`NEAR=26` 会把 `#fff0c8`（暖奶油）算成 `#f3ead6`（UI 纸白，距离 **19.4**）这种**不同色** ⇒ 真阳性被放过。★ 语义不变：**文档第 11 节已记录的**只列 backlog、不判 FAIL，**没记录的**才 FAIL。★ **失明守卫**：`styles.length===0` 或全部进 `noSec` ⇒ FAIL 并明说「**本闸门已失明**」。★ 覆盖点（新增）**`LEMO_DISTILL_ROOT`**（SKILL.md 根，与 `check-skill-artifacts`/`check-skill-scores` 同名同义）+ **`LEMO_DUB_STYLES`**（注册表）。★ 验证：真阳性夹具（hd-2d 的 `palette.bg` 回退成事故前 `#fff0c8`）改后 **exit 1**〔★ 2026-10-06 订正：这只对「§11 **未记录**该冲突」的文档（最小夹具）成立；若用**真实 SKILL.md**（§11 明确记了 `#fff0c8`），夹具归 **backlog / exit 0**、`--all` 下才 exit 1〕 / 改前 HEAD **exit 0**；真阴性（真实 44 条）**未记录 0 / 积压 2（scifi-toon、tilt-shift，同批已清零 ⇒ 现为 0）/ exit 0**；失明（风格根指空目录）**exit 1 + 「本闸门已失明」**。★★ **2026-10-06 二次收紧（修残留盲区）**：原「**任一**候选色（`palette.bg` 或 `bgRecipe.stops`）以背景角色出现即放行」⇒ **一个正确的 `bg2` 会掩盖一个错误的 `bg`**（`stained-glass`：`bg #2a2a2e` 取自**测试文件** `styles/stained-glass/demo/test.js:9`、**不在 §3**，但 `stops` 里的 `#142a70` 是 §3「深蓝」行 ⇒ 放行）。现改为「**以 `palette.bg`（主底色）为准** —— `bg` **自身**必须命中背景角色行才放行；`stops` **仅当 `bg` 缺失/null 时**才看」。实测：真实语料 **0 未记录 / 0 积压 / exit 0**；`stained-glass` 改前态夹具 **判可疑**（**改前规则 exit 0**）；`hd-2d` 夹具仍 **exit 1**〔同订正：最小夹具成立；真实 SKILL.md ⇒ backlog/exit 0〕；失明仍 exit 1 且无 ✓。★ **两条已知局限的最终处置（2026-10-06）**：① 角色裁决是**黑名单**（`NONBG`）、**无正向白名单** ⇒ 只记录、不根治（判据不成立）。**可被绕过的具体构造**：同一个错底色 `#fff0c8` 写成 §3 **表格行** `| 派生通路底 | \`#fff0c8\` | … |` ⇒ **放行（exit 0）**；写成 §3 **散文 bullet** ⇒ **仍判可疑**（判据对格式与角色命名都敏感）。**为什么没换白名单**（题给 12 词 `底|背景|天空|纸|地面|环境|墙|幕|板|场景|布|底色`）：逐条核对 44 条真实 §3 角色列实测 —— ① 12 词 ⇒ **8 条误报**（`silkscreen-poster`〔`dub 通路派生`〕/`ascii-crt`〔`产品通路（dub）`〕/`brick-toy`〔`主`〕/`cel-anime-80s`〔`夜景主色`〕/`living-screencast`〔`产品浅主题·墨`〕/`paper-lantern`〔`房间黑`〕/`pictogram-motion`〔`米白 CREAM`〕/`swiss-motion`〔`页`〕）；② 补可辩护词 `通路|派生|夜|房间|页` ⇒ 降到 **3 条误报**；③ 再把 `主`/`米白`/`产品|主题|墨` 塞进白名单 ⇒ 真实 0 误报，但 `hd-2d` 真阳性夹具（命中行 `主（暖实体光）`）**同时被放行** ⇒ 拆掉闸门立身之本；④ 改「白名单 ∧ ¬黑名单」⇒ 真实 0 误报、`hd-2d` 仍被抓，但白名单必须常驻 `主/米白/产品/主题/墨` 这类**无背景语义**的词 ⇒ 已不是正向白名单，对上面的绕过构造**一点也拦不住**。**结论**：§3 角色列不是受控词表（混着角色名〔底/纸/幕〕、纯色名〔米白/主/墨〕、通路名〔dub 通路派生〕）⇒ 按 role 用词的白名单做不到「排除光/强调行」且「保住 44 条合法行」，按纪律「判据不成立时宁可只报不改」**保留黑名单**；本闸门只保证「底色的**角色归属**不是灯/光/强调一类」，**不保证**角色名与底色内容相符。② `docRecorded` 粗判据 ⇒ **2026-10-06 已根治**：旧判据（§11 同时出现 `dub-styles.json` 与 `palette|底色|配色` 即算「已记录」）会把「§11 记的其实是**另一条**冲突」误判成 backlog（`shadow-puppet`：§11 记的是 `textureRaw: backlit-leather` 未实现、自评行写着「palette −1」、另有一条「dub 通路的字幕位置…」⇒ 两个正则都命中）。现要求 §11 **指向本条**：出现该风格的 `palette.bg` 值（带 `#`、大小写不敏感、不匹配更长 hex 前缀）**或**明确写「底色」。★ 不用题给备选的 `§3`（§11 里的 `§3` 常在说**别的角色**：`engraving` §11 就用它解释 `accent` 的代理值）、也不用 `背景`（多是「背景带渐变 / 背景 sweep」这类风格描述）。**验证**：真实 44 条 **0 未记录 / 0 积压 / exit 0**；`shadow-puppet` 夹具（`bg #2a2a2e` + 真实 SKILL.md）改前 **backlog/exit 0** ⇒ 改后 **fresh/exit 1**；`hd-2d` 最小夹具 **fresh/exit 1**；`stained-glass` 夹具（真实 SKILL.md、`bg #2a2a2e` + `stops [#2a2a2e,#142a70]`）**判可疑**（真实 §11 确实记了本条 ⇒ backlog、`--all` 下 exit 1）；以上各夹具在**改前规则**（`6892c75`）下均 **exit 0**；失明夹具 **exit 1 + 「本闸门已失明」且无 ✓**。★ `shadow-puppet` 的真实底色 `#f4ead2`〔`demo/carve.js:7` `DYE.white`、`styles/shadow-puppet/STYLE.md:8`「a white cloth screen」〕已在同批补进 §3 行。★★ **2026-10-06 追加：`LEMO_DUB_STYLES` 已接通渲染链路** —— 此前**只有 4 个闸门读它**，而 `lib/dub-core.mjs` 的 `STYLES_FILE` 与 `lib/dub-semantic.mjs` 的 `STYLES_PATH` 都是**硬编码**路径 ⇒ **闸门侧与渲染侧同名不同义**（拿它做「配置是否影响成片」的变异验证会出**假阴性**）。现两处均为 `process.env.LEMO_DUB_STYLES || <原硬编码值>`，与 `LEMO_LIB_WIN`/`LEMO_MUX_SH`/`LEMO_OPUSCAR`/`LEMO_DISTILL_ROOT` 同语义（`LEMO_*` 一律真的影响渲染）；**不设变量时行为不变**（实测 `resolveStyle` 默认取真实值、设变量后取夹具值，渲帧主色随之改变）★★ **2026-10-06 第三次收紧（修「已修记录的回归盲区」）**：本仓约定「修好的缺陷 = **原文保留 + 追加更正**」（原文 `~~…~~` 划掉 + 后跟 `★ … 已修：…`）⇒ **已修**记录里必然写着**旧值**，`docRecorded` 只要搜到那个旧 hex 就判 backlog ⇒ **配置回退成旧值（真回归）也 exit 0**。实证：`stained-glass` §11 的 `~~派生通路的底色是深灰 #2a2a2e…~~ ★ 2026-10-06 已修：原 palette.bg = #2a2a2e … 由 #2a2a2e 改为 #1d3a9c`。现改为**先剔除「已修」更正单位、再判是否指向本条**（`stripFixed()`，三条机械规则）：① 去掉 `~~…~~` 划掉的 span（跨行）；② 反复去掉**最内层圆括号组**（`[^（()）]*`）——只要组内含 `已修`；③ 逐行删掉**含 `已修` 的 `★` 子句**（`★` → 下一个 `★` 或行尾）。★ 边界为何是「括号组 + ★ 子句」而**不是整行/整条 bullet**：`stained-glass` §11 的「自检发现的缺陷」一行里同时记着 `palette`（已修）与 `typography`/`audio`（**未结**）⇒ 按行删会漏报未结记录；②也是被迫的（同风格蒸馏证据表的 `（2026-10-06 校正：… dub 通路底色冲突已修 —— palette.bg #2a2a2e→#1d3a9c…）` 没有 `★`；「自检」那条的 hex 在 `★` **之前**，只做 ③ 删不掉）。★ **连带收紧 `pointsToThis`**：泛词 `底色` ⇒ `底色冲突`（被迫：剔除后 `stained-glass` §11 仍剩 `- **派生条目是近似值**：… 字幕颜色由 WCAG 对比度规则从底色推得 …`，含 `dub-visual.json` + `palette`/`配色` + `底色` 却**没在记冲突**，会抵消这次收紧）。★ **验证**：真实 44 条 **0 未记录 / 0 积压 / exit 0**（3 遍）；回归夹具（`stained-glass` 真实 SKILL.md + `bg` 回退 `#2a2a2e`）改后 **fresh / exit 1**、改前 HEAD **backlog / exit 0**；非回归对照（`bg #1d3a9c`）**exit 0**；三个正对照（已修标记改「本条未修」/§11 全去 `已修`/只写「底色冲突」不给 hex）**均 backlog / exit 0** ⇒ 剔除以「已修」为条件；`shadow-puppet` 夹具仍 **fresh / exit 1**；失明 **exit 1 且无 ✓**。★★ **存疑（已上报，不改）**：`hd-2d` 夹具（真实 SKILL.md + `bg` 回退 `#fff0c8`）由 **backlog / exit 0** 翻成 **fresh / exit 1**（其 §11 对这条冲突的每处提及都带「已修」）—— **不是误报**（文档写「已修」、配置却回到旧值 = 回归）。★ 若验收要求「`hd-2d` 仍归 backlog」，那是**期望与判据冲突**：`stained-glass` 的 `（2026-10-06 校正：… dub 通路底色冲突已修 …）` 与 `hd-2d` 的 `（2026-10-05 校正：dub 通路底色冲突已修 …）` **逐字同型**，不可能一个剔、一个留。
node D:/lemo-tools/scripts/check-derivation-caliber.mjs # ★ **派生口径闸门**（2026-10-06 新增）：`lib/dub-styles.json` 每条 entry 的 `derivation` 口径块 ↔ 本条字段 ↔ 该风格自己的 `SKILL.md` 三方一致。★ 由来：本注册表是「文案+风格」通路的**唯一可渲染消费入口**，但它的配色/字体**多数不是逐行真抽** —— 43 个真实风格的字幕字体一律是本机字体（`_notes[5]`，STYLE.md 点名的 OFL 字体本机都没有）、32 条派生条目的配色取自证据层 `lib/dub-visual.json`、字幕字号/颜色走「分类别默认 + WCAG」（`_notes[11]`）、3 条底色**落回 plain-dark**（`bgSameAsDefault:true`，`_notes[13]`）、若干条 accent 按 `_notes[10]②` 的「`accent/bg` 一律提到 ≥4.5」被换过 —— 这些口径此前**只写在散文里** ⇒ 下游读不出「哪个值是原文值、哪个是要替换的近似值」，漂移也没人拦。现给每条加 `derivation: {bg, font, subtitle, accent}`（**纯元数据、只增不改**；渲染侧一个字都不读它），判据写在 `_notes[19–23]`。★ **键名 `derivation`**：与既有的 `derived` / `derivedFrom` / `bgSameAsDefault` 同类并列、自解释。★ **它必须登记进 `check-dna-coverage.mjs` 的 `DUB_METADATA` 白名单**（本次已加一条，写明「为什么算元数据」+ 点明它是本闸门的输入）—— 那个闸门第二节枚举注册表全部字段路径，零读取且不在白名单的路径一律 FAIL（不登记就是 EXIT=1）；**白名单就是它为「新元数据字段」预留的人工入口**（头注释原话「改的是清单，不是判据」）⇒ 新增元数据字段 = 加一行登记，不改任何判据/阈值。★ 曾短暂用 `_notes` 承载（不登记也能过），**已否决**：顶层 `_notes` 是字符串数组、条目里若也叫 `_notes` 则是对象，属「同名不同层/不同型」的 schema 债务（项目刚为同型问题吃过亏：`LEMO_DUB_STYLES` 闸门侧与渲染侧同名不同义 ⇒ 变异验证假阴性）。★ 判据：① 四轴齐全 + 取值在枚举内；② **按 `_notes[20]` 的规则重算四个轴、与写着的值逐轴比对，不等即 FAIL**（`bg=fallback ⟺ bgSameAsDefault:true 或 palette.bg 为空`；`bg/accent = proxy/substituted ⟺ 与 dub-visual 的对应值不等（含证据层没抽到）`；`font=substituted ⟺ fontFamily 在本机字体表里且非合成基线`；`subtitle=derived ⟺ derived:true 且 notes 含 WCAG`；`accent=absent ⟺ palette.accent 为空`）；③ `fallback/proxy/substituted/derived` 的条目，其 `SKILL.md` 里**必须有对应口径说明**（缺则 FAIL 并点名该补哪份文档）。★ 分布：`bg` exact 37 / proxy 4 / fallback 3；`font` exact 1 / substituted 43；`subtitle` exact 13 / derived 31；`accent` exact 32 / substituted 7 / absent 5（`accent` 多一个 `absent` 取值：null 既非 exact 也非 substituted）。★ 失明守卫：注册表读不到 / `styles` 不是非空数组 / **证据层读不到或 `styles` 不是非空对象** / 一个 `SKILL.md` 都读不到 / `_notes` 里不再列全本机字体表 ⇒ **FAIL 并明说「本闸门已失明」**且不打分布统计与「✓」。★ 覆盖点 **`LEMO_DUB_STYLES`** + **`LEMO_DISTILL_ROOT`** + **`LEMO_DUB_VISUAL`**（新增）
node D:/lemo-tools/scripts/check-skill-artifacts.mjs   # json 记录的成片信息 vs 磁盘实物；★ **失明守卫 ①（2026-10-06 补）**：一个带 `_distill.json` 的风格都枚举不到（含 `--only` 拼错）⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；★★ **失明守卫 ②（2026-10-07 补，修「一个都没检查却全绿」）**：主循环 `!gv.path` 走 SKIP 时 `continue` ⇒ **「文档 vs 实物比对」与「evidenceFrames 检查」被一起跳过**；若**所有**风格都 SKIP（如 `generatedVideo.path` 集体缺失），`fails`/`blind` 双空 ⇒ 旧版打印「✓ 文档记录的成片信息与实物全部一致」+ **exit 0**（**一个东西都没检查**，已用 `LEMO_DISTILL_ROOT` 夹具复现）。现判据 **`skipped === slugs.length` ⇒ FAIL 并明说「一个都没比对」**（写法照 `check-dub-styles.mjs` 的 `skipped === dub.styles.length` / `check-config-vs-doc.mjs` 的 `noSec.length === styles.length` 同型守卫）。★ **部分 SKIP 不判 FAIL**（SKIP 是**设计允许**态：文件头写明「只校验文档确实记了的字段，没记的跳过」—— 新纳入、尚未出片的风格本来就没有 `path`；真实语料 **43/43 都有 path** ⇒ 部分 SKIP 的**误报率无样本可测**，此时设阈值＝凭猜收窄，违背「先测误报率再收窄」）⇒ 只打一行 `ℹ 有 N/M 个风格 SKIP（…没被比对、evidenceFrames 也没检查）`，免得那句 ✓ 被读成「全都检查过了」。★ **反向验证**（夹具在 `D:/lemo-tmp/agent-blindfix/`，覆盖点指夹具、**不动真实树**）：全部 SKIP ⇒ **改前 `exit 0` + 「✓ 全部一致」**（假绿）／**改后 `exit 1` + 「全部 2 个风格都 SKIP…一个都没比对」**；正常树 **仍 exit 0**（不误报）；**0 个风格 ⇒ 原守卫 ① 仍生效（exit 1）**；**部分 SKIP（1/2）⇒ exit 0 + ℹ 行**；真实树 **43/43 输出逐字节不变、exit 0**。覆盖点 **`LEMO_DISTILL_ROOT`**
node D:/lemo-tools/scripts/check-selfcheck-claims.mjs   # `_distill.json#selfCheck` 里**对实物可核的声称** vs 真值（★ 2026-10-07 新建，补一个已由独立审计实测确认的零覆盖区：43 份 json 的 `selfCheck` 去重 283 条字段路径，242 条**没有任何闸门在读**）。① **`selfCheck.muxEncoder`（43/43）** 声称「nvenc」，真值 = **成片的视频流编码器 tag**（`ffprobe -select_streams v:0 -show_entries stream_tags=encoder`；实测 43/43 = `Lavc60.31.102 h264_nvenc`）⇒ 判**达标**（成片实际必须含**期望编码器**，未设 `LEMO_VENC` ⇒ `h264_nvenc`；成片实际是 `libx264` ⇒ **FAIL** = 静默走 CPU）+ 判**自洽**（声称值归一化后须是 tag 的子串）。★★ 这是**项目第一硬规则「渲染一律 GPU 优先」在 `_distill.json` 侧的落点** —— 该字段此前零读者，渲染一旦回退成 CPU 没有任何闸门会响。② **`selfCheck.{fps,frames,size}`（3/43）** 与 `generatedVideo.{fps,frames,width,height}` 逐项一致（同义 ⇒ 不重复跑 ffprobe）；③ **`selfCheck.srtCues`（2/43）** 与成片同名 `.srt` 的实际 cue 数一致（实测 2/2、误报 0）。★ **有意不核**：`loudness.*`（已被 `check-film-delivery`/`check-tp-prose`/`check-lra-caliber` 覆盖）、一切 `*note`/`warnings[]`（散文，归 `check-tp-prose`）、`totalSec`/`renderSec`/`events`/`ratio`/`grain` 等（口径不明或无可对真值）。★ **失明守卫三条**：风格枚举不到 / 一个可核字段都没有 / 一个成片文件都读不到 ⇒ **FAIL 并明说「本闸门已失明」**。★ 真值来源是**实测选出来的**：`format_tags=encoder` 是封装器版本（`Lavf60.16.100`、不含 `h264_nvenc`）⇒ 用它判 43/43 假阳；`stream_tags=encoder` 才对。★ 误报率实测（真实 43 份）：命中 0 / 真阳性 0 / 误报 0。★ 四类验证（夹具树，非破坏）：声称改 `libx264` ⇒ exit 1；`fps` 改 60 ⇒ exit 1；`srtCues` 改 99 ⇒ exit 1；★ 造一部真 `libx264` 成片 ⇒ exit 1 且报「成片未走 h264_nvenc」（同片把声称也改 `libx264` ⇒ 仍 exit 1，证明「达标」判据承重）；短路达标/自洽判据 ⇒ 变异全部重新消失；空树/成片读不到/无可核字段 ⇒ exit 1 + 「本闸门已失明」。覆盖点 **`LEMO_DISTILL_ROOT`** / **`LEMO_FILM_DIR`**（别名 `LEMO_FILMS_ROOT`）/ **`LEMO_FFPROBE`** / **`LEMO_VENC`**
node D:/lemo-tools/scripts/check-shell-structure.mjs   # shell 脚本结构（续行被注释吃掉 / 判定块缺 exit 0）
node D:/lemo-tools/scripts/measure-truepeak.mjs --check # 43 部成片真峰值是否都 ≤ −1.2 dBTP
node D:/lemo-tools/scripts/check-dub-styles.mjs        # 纹理红线 + 字幕底衬（模型级）
node D:/lemo-tools/scripts/check-doc-coverage.mjs      # 你新增的脚本有没有登记进文档（本简报 + test/README.md）；★ **失明守卫（2026-10-06 补）**：`scripts/` 或 `test/` 扫到 **0 个** ⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；★★ **2026-10-06 收紧：登记判据由纯子串改为「行锚定」**（旧 `t.includes(f)` 只要脚本名在文档里**出现过**就算数 ⇒ 两行并成一行、名字只出现在句子中间都骗得过；实测本简报里 `check-render-venc.mjs` 的说明曾**粘着** `patch-render-venc.mjs` 那行、闸门照报 exit 0）⇒ 现在要求「**存在一行**按登记格式写下该脚本」：本简报 = 行首（可含 `-`/行内反引号）+ `node ` + `scripts/<name>`，`test/README.md` = 行首 `|` + 反引号包裹的路径；真实语料 **0 误报**、夹具「两行并一行 / 名字在句中」新判据 **FAIL** 而改前 **exit 0**；★★ **同型残留一并收紧（测试入口侧）**：`test/*.test.mjs` 的「已登记」判据原为裸子串 `readme.includes(f)` ⇒ 测试入口行被并掉时同样看不见；现改为行锚定（接受 `node test/<name>` 命令行块 与 `` | `test/<name>` `` 表行两种形态），**无「工具类只需一处」的豁免 ⇒ 并成一行必然翻退出码**；夹具「并成一行 / 名字在句中」新 **exit 1** 而改前 **exit 0**；★ 测试入口侧的**失明守卫早已存在**（`test/` 扫到 0 个 `*.test.mjs` ⇒ FAIL + 「本闸门已失明」，且此时**不会**打印「0 个都已登记」），无需新增；覆盖点 **`LEMO_TOOLS_ROOT`**；★★ **2026-10-07 修「失明守卫口径不一致」**：主循环只查 `isGate||isTool`，守卫却用**未过滤**的 `files.length === 0` ⇒ `scripts/` 有「其他类」脚本但**过滤集为 0** 时 `missing`/`blind` 双空 ⇒ 假绿「✓ 都已在文档里登记」+ **exit 0**（一个都没检查）；现改为按 `files.filter(isGate||isTool)` 的**实际检查集**守卫（同文件 test 侧本来就是这么守的）。实测（`LEMO_TOOLS_ROOT` 指向只含一个非闸门非工具的 `foo.mjs` 的假根）：改前 exit 0+`✓` ⇒ 改后 exit 1+「已失明」；真实语料改前改后一致（`未登记 0 个 OK`）
node D:/lemo-tools/scripts/check-dna-coverage.mjs      # 风格注册表的**字段消费覆盖**（三节）：① style-dna 的已接线链路没断（防风格特质静默失效）；② ★ lib/dub-styles.json 的**每条字段路径**要么「有消费者」、要么在**元数据白名单**/未实现清单里，否则 FAIL（防「注册表声明了、代码没人读」——44/44 声明 textureRaw 却零读取就是这么漏的；已剥注释，否则解释缺陷的注释会被当成消费者；排除 scripts/ 否则闸门读到自己；注册表读不到/枚举 0 条即判失明；LEMO_DUB_STYLES 可覆盖，供非破坏变异；★★ **2026-10-06 收紧：嵌套路径的消费者判据必须感知路径上下文（顶层键判据不动）** —— 由来：`derivation` 是**纯元数据对象**（`bg`/`font`/`subtitle`/`accent` 四轴，由 `check-derivation-caliber.mjs` 独占消费，**渲染侧一个字都不读**），但四条子路径**全靠叶名碰撞**被判「有消费者」⇒ **四条全是假绿**（`derivation.font` 最脆：唯一依据是 `server.mjs:136` 的 `'.woff2': 'font/woff2'` 这个 **MIME 串**）。新判据：顶层键不变；**嵌套路径**要求叶名命中的那个文件**还必须出现父键**（倒数第二段，如 `derivation.bg` 的 `derivation`），且父键必须是**代码 token**（已剥注释）。**邻域取「同文件」而非「同行/±N 行」**（先测误报率）：真实消费者的父对象常被**别名掉**（`const r = spec.bgRecipe` 后隔 18 行才 `r.halftone`；`subtitle` 写作 `sub.plateColor`/`sp.plateColor`）⇒ 实测误报 **同行 8 条 / ±5 行 4 条 / 同文件 0 条**，同文件且恰好杀掉 `derivation.*` 四条假绿（该父键在 28 个运行时代码文件里零出现）。**误报率**：真实注册表 67 条路径，判定变化**恰好 4 条**（全是 `derivation.*`），其余 63 条一字不变；这 4 条按「父键已声明为元数据 ⇒ 子键自然也非渲染字段」登记进 `DUB_METADATA`（只加行，不改既有条目/阈值/判据）⇒ **FAIL 0 / 误报 0**。**验证**：真阳性夹具（给每个风格的 `palette` 注入假字段 `font` —— 叶名只在 `server.mjs` 的 MIME 串里、该文件无 `palette`）**改后 exit 1 点名 `palette.font`**、**改前 HEAD exit 0（假绿）**；同型夹具 `derivation.plateColor` 同理；真阴性真实注册表 **exit 0**；失明三态仍 **exit 1 + 「本闸门已失明」**）；③ ★ **`bgRecipe.textureRaw` 的「取值级」实现状态**（2026-10-05 扩展，补的正是 ② 原先登记的「已知边界」）：**可解析名字集合 R** 从 `lib/dub-core.mjs` **源码抽**（`bgFilters()` 的 `switch (tex)` case + `TEXTURE_SYNONYMS` 键 + `TEXTURE_RAW_FALLBACK` 键 + `none`，不手抄）⇒ 判**双向**：(A) 声明但未标（值 ∉ R 而散文清单没登记）FAIL、(B) 标了但已实现（值 ∈ R 而散文清单仍列着）FAIL，另加 4 条防清单腐烂 + slug 级核对；**误报率**：原始判据首跑命中 2 名（`vignette`/`paper-grain`）**真 0 / 误 2（100%）** ⇒ 加豁免表 `TEXTURE_COVERED_BY_OTHER` 后 0/0（★ **「可解析 R」≠「已实现全集」**：31 个声明值 = R 内 11 + 未实现 18 + 豁免 2）；**失明守卫**尤其重要（判据依赖解析源码）：源码读不到/抽不到两张表/找不到 `bgFilters()` 或其 `switch (tex)`/R 为空/注册表为空/散文找不到「声明但未实现」条目 ⇒ 一律 FAIL 并明说「已失明」；覆盖点 **LEMO_DUB_CORE**（新增）+ `LEMO_DUB_STYLES`，均供非破坏变异）
node D:/lemo-tools/scripts/check-mux-selection.mjs     # 编排器实际挑中的那个 mux 脚本口径是否完整（★ 脚本存在 ≠ 会被采用）；★ **失明守卫（2026-10-06 补）**：`styles/` 读不到 / 扫到 **0 个风格** ⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；覆盖点 **`LEMO_OPUSCAR`**
node D:/lemo-tools/scripts/check-mux-parity.mjs        # ★ **各风格自带 `demo/mux.sh` ↔ `core/render/mux.sh` 的口径 parity**（2026-10-07 新增）：混流脚本的音频收尾口径在**两处各写一份**（core = **34 个走 core 的风格共用**；自带 `demo/mux.sh` 实测**只有 3 个**：`paper-popup`/`watercolor`/`pictogram-motion`），而此前**没有任何闸门在比这两份** ⇒ 漂移静默。判据（逐项与 core 比）：① `LN_TP` 默认值 −1.7 ② `LN_TP_STEP` 0.25 / `LN_TP_TRIES` 8 ③ **编码后复核 + 逐档下调重编**闭环（`TP_TRY`/`ATTEMPT` 循环 + 与 −1.2 的比较）④ **编码器守卫**（未设 `LEMO_VENC` ⇒ `h264_nvenc`；显式 `libx264` ⇒ CPU；其它值 ⇒ **报错退出**）⑤ 未设时不得静默走 CPU ⑥ `loudnorm=I=-14` 在。★★ **两层语义**（能「当前树 exit 0」而将来新漂移会红的关键）：**已记录积压只列不判 FAIL**，清单 `KNOWN_DIVERGENCES` 逐条写「为什么允许存在 / 待办」；当前只 1 条 —— `pictogram-motion` 的 `demo/mux.sh` 属**另一套音频架构**的手工入口（`music/music.py` 直出母带、**无 `mix.wav` 概念** ⇒ mux 阶段不做 loudnorm ⇒ 无 `LN_TP`/无闭环；依据 `lib/style-skills/pictogram-motion/SKILL.md:173`）⇒ 5 项登记为积压。★ 另有 **core 自身漂移**判据（core 的 ①② ≠ `CORE_EXPECT` ⇒ **FAIL**）：core 是 34 个风格共用那份，一变**全体跟随**（实证 `paper-lantern` 无自带 mux ⇒ 永远走 core ⇒ core 默认值 2026-10-03 收紧到 −3.5 / 10-05 改回「−1.7 起步 + 闭环」，它那版成片真峰值在 −1.68 与 −3.37 dBTP 间摆）。★ **失明守卫**：`core/render/mux.sh` 读不到 / `styles/` 读不到 / 0 个风格目录 / **一个自带 `demo/mux.sh` 都枚举不到** ⇒ **FAIL + 「本闸门已失明」**。★ **范围**：只查 `styles/*/demo/mux.sh`（3 个）；`demo/tools/mux.sh`（9 个）不在范围（由 `check-mux-selection` 守），输出里显式打出范围。★ 变异验证（`LEMO_OPUSCAR` 指夹具树、**不动真库**，8/8 PASS）：真阴性 exit 0；真阳性（`paper-popup` 的 `LN_TP`→`-2.5`）exit 1 点名；core 漂移 exit 1；编码器守卫被拆 exit 1；失明三态 exit 1 + 失明文案；★ **反向证明**（清空 `KNOWN_DIVERGENCES` ⇒ `pictogram-motion` 翻成 exit 1 / 未登记 5 项，证明清单**承重**）
node D:/lemo-tools/scripts/check-line-endings.mjs      # ★★ **行尾卫生闸门**（治 2026-10-06「库仓 38 个风格废掉 21 个」的**根因**：该仓**没有 `.gitattributes`** + 本机**系统级 `core.autocrlf=true`** ⇒ 新 clone **全仓 CRLF** ⇒ 两侧 `core/` 字节不一致 ⇒ **编排器拒绝开工**）。★ **每次开工前先跑它**（行尾坏了的后果是整批废掉，不是单点失败）。判据五条：**J1** `.gitattributes` 存在且 **git 实际生效**的 attr 对（14 个文本扩展名 + `.gitignore`/`.gitattributes` 逐个 `git check-attr text eol` ⇒ **`text ∈ {set,auto}` 且 `eol=lf`**；★ 只看 `eol` 会**假绿** —— 把 `*.js text eol=lf` 改成 `*.js binary` 后兜底行仍把 `eol` 报成 `lf`，实测 `x.bin` ⇒ `text: unset`/`eol: lf`）；**J2** `git ls-files --eol` 里被判为文本的路径不许 `w/crlf`（★ 按 `--eol` **标记**判、**不按字节扫**：jpg/bin/woff2/mp4 本来就可能含 0x0D）；**J3** ★ **字节级「隐形漂移」**（工作区字节 vs `git show HEAD:<path>` 字节，**去 CR 后相同、原样不同** ⇒ 报出 —— 就是 `git status` **看不见**的那种）；J3 **不按扩展名过滤**（对 `TEXT_EXT` 清单外的新文件**只有它看得见**），且**必须排除 `attr/eol=crlf` 的路径**（`*.bat`/`*.cmd` 的 CRLF 是**设计如此**，不排除会误报 2/10，已修）；**J4** 失明守卫（无 `.git` / 枚举到 **0 个**已跟踪文件 ⇒ **FAIL 并明说「本闸门已失明」**）；**J5** backlog 只列不判（**当前故意为空** —— 已知真阳性正在被别的智能体修，登记进去等于「为变绿而放宽判据」）。★ 覆盖**两个仓**：**`LEMO_OPUSCAR`**（默认 `D:/lemo-opuscar`）+ **`LEMO_TOOLS_ROOT`**（默认本仓根，与 `check-doc-coverage` 同名同义；该仓 `*.bat`/`*.cmd` 按 `eol=crlf` 判，且**只在该扩展名真的存在时**才要求）。★ 真实语料首跑：opuscar **0 违规**、tools **8 处真阳性**（`lib/style-dna/*.json`：工作区 CRLF / blob LF / `git status` **干净**）⇒ **误报 0**；夹具 `D:/lemo-tmp/agent-eolgate/`（`fx-ok` exit 0、`fx-noattr`/`fx-eolcrlf` exit 1、`fx-crlf-text` exit 1、**`fx-bin-cr`（二进制含 0x0D）exit 0 不误报**、`fx-hidden` exit 1、失明两态 exit 1、`fx-tools-ok` exit 0、`fx-bat-lf` exit 1）。★ 实现坑：本机 `spawnSync('git',…)` **一律 `EBUSY`** ⇒ 必须用**异步 spawn**（同 `check-dual-copy-sync` 的 `wsl.exe` 那条）
node D:/lemo-tools/scripts/check-mix-candidates.mjs    # 混音文件有没有「靠前的旧占位遮蔽靠后的真混音」（★ 真实发生过事故）；★ **失明守卫（2026-10-06 补）**：`styles/` 读不到 / 扫到 **0 个风格** ⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；★★ **失明守卫 ②（2026-10-07 补，修「一个都没检查却全绿」）**：主循环把「无候选」风格 `continue` **移出检查集** ⇒ 若**全部**风格都无候选（`multi=0 / fails=[] / blind=[]`）⇒ 旧版打印「✓ 所有多候选的混音都逐字节相同…」+ **exit 0**（**一个候选都没检查过**）；现判据 **无候选数 == 风格总数 ⇒ FAIL 并明说「一个都没判」**（写法照 `check-skill-artifacts` 的「全部 SKIP」）。★ **部分无候选不判 FAIL**（「无候选」是设计允许态：只意味着要重跑音频链；真实语料 43 风格里 **35 个**无候选、8 个有候选 ⇒ 部分无候选是**常态**、误报率无样本可测、不设阈值），但会打一行 `ℹ 一个候选都没有的 N 个`。覆盖点 **`LEMO_STYLES_ROOT`**
node D:/lemo-tools/scripts/check-cli-docs.mjs          # 命令行参数的用法块与实现是否对得上（★ 防「文档先于实现」）；★★ **2026-10-06 修一个已确认的假绿：用法块判据由「整份源码里任意缩进 ≥2 空格的 `--flag`」收紧成「锚点法」** —— 旧判据下一段**无关**模板/注释里缩进写个 `--flag` 就把「已实现但没写进用法块」的参数冒充成「已文档」。**夹具**（`fx-cli` vs `fx-cli-control`，差别只在另一段无关模板里多一行缩进的 `--beta`）：`--beta` 已实现却没写进 `USAGE` ⇒ 旧版 `fx-cli` **exit 0（假绿）**、新版 **exit 1 点名「代码处理了 `--beta`，但用法块没列」**。★ **不能改成「连续块/最长块/块大小阈值」**（实测确认「真实用法块不是连续块」成立）：`dub.mjs` 的用法块被空行/续行切成 **12 个碎段**（最长 4 行）、`lemo-make.mjs` **10 个**（最长 8 行）⇒ 误报（合法参数被判「代码有文档无」）**只认最长块 18/13 条、块长≥3 并集 10/9 条、块长≥2 并集 6/5 条、距小标题≤40 行 4/3 条（且杀不掉夹具假绿）、朴素反引号配对 0/21 条**。★ **新判据（机械可解释）**：用法块 = 「含**用法小标题**的那段**模板字符串**（或块注释）」；小标题 = 行尾的 `用法:`/`用法：`/`Usage`/`USAGE`/`选项`/`Options`；区域边界 = 由「未转义反引号数的奇偶」判断小标题在不在模板里，再取「上一个含反引号的行 ↔ 下一个含反引号的行」；**只有区域内的缩进 `--flag` 才算「已文档」**。★ **误报率**：真实语料各 22 个已文档 flag，**改动前后集合逐字相同（差集 0/0）**、闸门输出**逐字节一致**、**exit 0**。★ **已知局限**：启发式（非 AST）—— 小标题写成别的词、或用法块既非模板字符串也非块注释 ⇒ 识别不到区域 ⇒ `doc.size===0` 触发**失明守卫** FAIL（**不会**静默假绿）
node D:/lemo-tools/scripts/check-lexicon-coverage.mjs  # 风格 tags ↔ 规则词表双向对齐（★ 漏登记 = 规则路永远选不中该风格；schema 不符即判 FAIL）；★★ **失明守卫②（2026-10-07 补）**：`lexiconCoverage({})` 对「没有任何 tag」返回四维**空数组** ⇒ 若**全库没有一个风格声明 tag**，`missing=[]` ⇒ 假绿「✓ A 类·漏登记 0 处」+ **exit 0**（一个 tag 都没见过）；判据 = 全库四维实际声明的 tag 总数为 0 ⇒ FAIL。实测（夹具 `D:/lemo-tmp/lxfix/`，3 风格 tag 全空）：加守卫前 `✓`+exit 0 ⇒ 加守卫后 `✘ 本闸门已失明：3 个风格里没有一个声明了 tag`+exit 1；真实语料（44 风格）改前改后**输出完全一致**（`漏登记 0 处、死词条 backlog 0 个 OK`）。★ 顺带修：`--json` 原先尾部多一行中文 ⇒ stdout **不是纯 JSON**（`JSON.parse` 失败）；现按既有约定（`check-derivation-caliber.mjs:325-328`）把说明/汇总行走 **stderr**、补 `blind` 字段，stdout 保持纯 JSON
node D:/lemo-tools/scripts/check-api-docs.mjs          # server.mjs 路由 ↔ README 接口表双向对齐（★ 防「文档先于实现」；任一侧解析为 0 即判失明）
node D:/lemo-tools/scripts/check-render-venc.mjs       # ★ 渲染一律 GPU 优先（未设 LEMO_VENC ⇒ h264_nvenc；非法值 ⇒ 报错；双副本不一致 ⇒ FAIL）。★★ **2026-10-06 修一个已确认的假红：D 类判据加「相邻性」(e)** —— 旧**守卫**判据只要求「同一小句内同时出现 `libx264` + 默认类词 + 编码语境」；于是本**守卫**把表格里的 `| libx264 | 默认安装即有的软件编码器 |` 判成过期声称（`默认` 修饰「默认**安装**」而非「编码器默认值」）—— 假红 3/3；新判据 (e)：限定词必须**直接修饰** `libx264`（中间只能是空白/标点（不含表格竖线 `|`）/连接词白名单），且限定词在编码器名之后时右侧须紧接边界/标点/连接词。**验证**：假红夹具 **改后 exit 0 / 改前 exit 1**；真声称**守卫**夹具（7 形态，含「默认使用 `libx264` 编码」）**改后仍 exit 1、7 条全中**（**守卫没瞎**）；真实语料 1548 文件 **改前改后输出逐字节一致、exit 0**；★ 新局限（有意取舍）：限定词与编码器名之间垫实词/整段说明、或分处表格两格的真声称会被漏 —— 同形态也是假红来源，本**闸门**选「宁漏不乱报」）；★★ **2026-10-07 纳入第三个编码决策点 `D:/lemo-tools/dub.mjs`**（第三条通路「文案+口播+风格」的最终编码 —— 此前**两处混流命令硬编码 `-c:v h264_nvenc`**、**不读 `LEMO_VENC`**、且**不被本闸门登记** ⇒ 出片路径上唯一没被守住的决策点）⇒ A 类决策点 **11 → 12**、真实语料**新增误报 0**（D 类扫描集与命中数逐字不变）；变异验证（临时树 `D:/lemo-tmp/agent-dubvenc/mut/faketools/` + `LEMO_OPUSCAR` 覆盖点，**绝不动真实文件**）三形态（还原成修复前 / 未设时默认改成 CPU 软编 / 删掉非法值校验）**全部 exit 1 并点名**、对照组 **exit 0**；★ 该文件属 **lemo-tools 仓** ⇒ 展示路径加 `lemo-tools/` 前缀、**不参与 C 类双副本比对**（WSL 侧无副本）；★ 新局限：mjs 侧只判**文件级**的「VENC/VARG + 非法值校验」，**不核对每个调用点真的用了那个变量**；★★ **2026-10-07（b85-a）修两处盲区**：① **D 类②（无限定词的错claim）** —— 旧 D 类要求小句内有「默认/未设」限定词，**抓不到**「**示例**：demo 自带 `mux.sh` 用的是 `libx264 -preset slow -crf 17 -r 60`」这类**没有限定词**的写法；新判据 = 同一小句内 `libx264` + 编码上下文（**行级**）+ **脚本引用**（`mux.sh|render.mjs|build.sh|finish.sh|render/video|video_png|video_range|render_range|自带`），且无 `h264_nvenc`、无豁免词（旧 `D_EXPL` + `判据|原为|原记|曾写|已过期|已修|以前|不要|别写|别用|禁止|示例|命令|代码块|写法|语法|说成|写成|称作`）⇒ 判 FAIL。**误报率实测（先测再定稿，真实语料 1544 文件逐条人工分类）**：v1 命中 **16 = 真阳性 3 + 误报 13** → v2 命中 **7 = 3 + 4** → v3 命中 **5 = 3 + 2** → 定稿 命中 **3 = 真阳性 3 / 误报 0**；3 条真阳性 = `paper-popup/_distill.json:21`、`:128`、`silent-film/SKILL.md:147`，均已按「保留原句 + `原记` + 补现值」修正 ⇒ 修正后 **0 命中 / exit 0**。★ ② **B 类分类订正**：`styles/risograph/demo/tools/video_png.mjs` 已**在出片路径上**（编排器渲染段候选探测 `demoRenderRel`，`lemo-make.mjs:1484`）且已支持 `LEMO_VENC` ⇒ 从 `B_FILES`（15→**14**）挪进 **A 类**（A 12→**13**）；其余 14 项逐项核实**确不在出片路径**。测试：`test/gate-blindness.test.mjs` 补 D 类② 正/阴/**★自证**（69→**71** 条）
node D:/lemo-tools/scripts/patch-render-venc.mjs       # 按上述判据幂等回灌 26 个编码器决策点（双副本一起写）
node D:/lemo-tools/scripts/check-venc-args.mjs         # ★ 每个编码参数组合**真编 1 帧**证明 ffmpeg/nvenc 接受（32 组合，~4s；抽到 0 个即判失明）
node D:/lemo-tools/scripts/check-dual-copy-sync.mjs   # ★ 全仓两份副本同步（源文件漂移/单侧缺失 ⇒ FAIL；生成物与资产只列 backlog；WSL 不可达即判失明；★ 2026-10-06 补「git 历史一致性」**参考级**判据：报两侧 HEAD/分支/未提交条数/领先落后/「一侧看不到另一侧 HEAD」+ 后果，**一律不判 FAIL**（实测历史已分叉 —— WIN `b0de9e7` 领先 WSL `f3c590d` 1 个提交且 WSL 看不到该对象，而文件是同步的 ⇒ 旧版全绿；判 FAIL 会立刻打破全绿，且收敛要动仓库、本闸门只读）；失明（无 .git / 无 git / root 不存在）只明说、不 FAIL；★★ 2026-10-06 再补第 ②b 条「**无扩展名的控制文件**」判据：`.gitignore`/`.gitattributes`/`.editorconfig`/`.gitmodules`/`LICENSE-*` 按**同一份 glob 列表**喂给 WIN 匹配器与 WSL `find -name`（两侧由构造一致），漂移即 FAIL —— 旧版 `isText('.gitignore')=false` ⇒ 两侧 `.gitignore` 内容不同也**全绿**（实测 `a25c8d…` vs `96112b…`））
node D:/lemo-tools/scripts/check-film-aspect.mjs      # ★ 成片画幅：A 声明支持（未声明=只支持16:9）+ B 43 部画幅应一致（少数派即违规）+ ★C 用 ffprobe 读**实际成片文件**要求恰为 1920×1080（样板片一律 16:9；文件缺失只单列、0 部成片/文件根不存在/无 ffprobe 即判失明；`LEMO_FILMS_ROOT` 可覆盖，供非破坏变异）
node D:/lemo-tools/scripts/check-audio-chain.mjs      # ★ 音频链可跑性：哪些风格的混音步编排器跑不了（A 无路径/B 基线/Bnew 新增 ⇒ FAIL），把「只有真渲才发现」的缺口静态化
node D:/lemo-tools/scripts/check-redline-md5.mjs      # ★ **红线 md5 的「多处登记是否同步」闸门**（2026-10-07 新增）。★ 由来：项目第一红线是**编排器 `lemo-make.mjs` 不许被悄悄改**，它的 md5 被登记在**多处**（`test/cases.mjs` 的 `ORCH_MD5`、`test/README.md` 的验收判据表、`README.md` 的差异清单），本意是「任何一处对不上就说明红线被动过」；但**没有任何闸门在守** ⇒ `README.md:500` 那一处**已经漂了**（旧值 `314d7fc8…`，而另两处都已是 `6283aadb…`）—— **跨文档矛盾**，只能靠人工发现。判据：实测 `lemo-make.mjs` 的 md5，逐处按**锚定正则**抽出登记的 md5，必须**逐字相等**，不等即 FAIL 并点名。★★ **最大陷阱：绝不许「扫全文第一个 32 位 hex」** —— `test/README.md` 全文有 **26 处** 32 位 hex，多数是**带日期的历史链**（`故基线 md5 由 \`X\` → \`Y\`。`，如 `:66`/`:200`/`:239`/`:243`），**必须保留原值**（改了就是伪造历史）⇒ 抽取一律锚定具体形态；每次运行都**打印每处抽到的行号 + 行原文**供人工核对。★ 第 4 处 `_distill/AGENT-BRIEF.md`（`md5 \`<旧值…>\` → **\`<32hex>\`**`）**只列不判**：它与 `test/README.md:243` 是**同型的历史箭头**，红线将来**合法变更**后它理应仍是历史值，判 FAIL 会制造误报。★ **失明守卫**：任一判据处提取不到（文件缺失 / 正则不匹配 / 抓到空）或红线文件读不到 ⇒ **FAIL 并明说「本闸门已失明」**、且不打 `✓`。★ 覆盖点 **`LEMO_TOOLS_ROOT`**。★ 误报率（真实仓）：三处判据 + 1 处参考抽到的值**全是 `6283aadb…`、逐字一致、exit 0**；**锚定唯一性实测四处正则各命中 1 条**（历史链一处都没被抓到）。★ 变异验证（临时树 + 覆盖点）：夹具 A（`README.md` 错值）/ B（`test/README.md` 表行错值）/ B2（`test/cases.mjs` 的 `ORCH_MD5` 错值）**均 exit 1 并点名对应文件**；夹具 C（三处全空文件）/ D（登记处文件缺失）/ E（红线文件缺失）**均 exit 1 + 「本闸门已失明」**；★ 反向对照 夹具 F（**历史 md5 链被改动**）**仍 exit 0**（不误报）；阴性对照 exit 0
node D:/lemo-tools/scripts/check-env-overrides.mjs  # ★ **环境变量覆盖点的「登记表 + 双向守卫」闸门**（2026-10-07 新增，补一个已由多批实测确认的缺口）。★ 由来：本项目靠一批**覆盖点**（`LEMO_*`）把「闸门/测试夹具」重定向到**临时树**做**非破坏验证**，**但没有任何东西保证这些覆盖点还在** —— 谁把某处 `process.env.X` 删掉/改名，**没有任何断言会响**，夹具会**静默跑在真实仓上**（假绿 + 可能真破坏）。三处实证：① `test/cases.mjs` 的 `OVERRIDES` 表（约 `:866`）**就是这个守卫的雏形**，但只覆盖 4 个文件；② 2026-10-07 给 `lib/voices.mjs` 加 `LEMO_VOICE_TEST_TMP` 时**没有任何东西守着它**，只能手工补进那张表；③ `LEMO_FILM_DIR`（`lib/env.mjs` 的 `exportDir`）曾被硬编码 ⇒ 「同一成片根两套口径」+ 两个 `briefs.test.mjs` 互撞。判据**双向**：① **未登记 ⇒ FAIL**（扫 `lib/**` + `scripts/**` + 仓根 `*.mjs`，抽所有 `process.env.<NAME>`，不在登记表里即 FAIL，报 **文件:行 + 变量名**）；② **登记了但没了 ⇒ FAIL**（`OVERRIDES` 每条覆盖点的**每一个 reader 文件**都必须在**剥注释与字符串后**的文本里仍有**同名**的 `process.env.<VAR>`）。★★ **剥注释的核法（本项目两处坑都踩过）**：粗剥（`test/cases.mjs` 同款三步）在本仓会**吃掉 12 处真命中**（含 `dub.mjs:64` 的 `LEMO_VENC`、`lemo-make.mjs` 的 `INDEXTTS_MIN_FREE_MIB`、`style-scan.mjs` 的 `LEMO_STYLES_ROOT`/`LEMO_STYLE_FP_FILE`、`server.mjs:66-68` 三个 `LEMO_CONSOLE_*`）—— 根因是「注释里出现「斜杠+星号」被当块注释起点」与「字符串里的 `//` 截断整行」；本闸门改用**状态机**（字符串 / 模板串 `${}` 里的代码**保留**、注释 / 字符串字面量 / 正则字面量**替换成空格**、行号不变）。★ 连**字符串字面量**也剥：`check-render-venc.mjs:250` 的错误文案与 `patch-render-venc.mjs` 的 6 处**补丁体字面量**里都写着 `process.env.LEMO_VENC`，它们**不读**这个变量（真读者只有 `dub.mjs` 与 `check-selfcheck-claims.mjs`）—— 不剥就会凭空多 2 个「假读者」。★★ **两层语义**：`OVERRIDES`（本项目覆盖点）判双向 FAIL；`EXTERNAL`（外部约定/行为开关，如 `PATH`/`WHISPER_MODEL`/`LEMO_CONSOLE_PORT`）**只登记、只列，不判 FAIL**（它们消失不构成「夹具跑在真实仓上」）；另有 **ℹ 判据③「新读者未登记」只列不判**（给已登记变量**新增**读者时①②都不响 ⇒ 那条把它变显式可见）。★ **失明守卫**：扫到 0 个 `process.env.*` / 0 个 .mjs / `OVERRIDES` 为空 ⇒ **FAIL 并明说「本闸门已失明」**，且失明时**不再输出判据②③**（否则成片 ✘ 会被误读成「覆盖点被删了」）。★ **已知盲区（如实写）**：**动态取值看不见**（`process.env[k]` 不判；实测本仓 2 处：`dub.mjs:933-934`）；**不纳入**库仓 `D:/lemo-opuscar` 的 `core/**`、`tools/**`（那边 10 个变量是**渲染/编排的运行时旋钮**，不是重定向夹具的覆盖点；且跨仓成本高、归类含糊、其 `LEMO_VENC` 读者已由 `check-render-venc.mjs` 的 A 类守着）⇒ 输出里**显式打出**这条盲区。★ 本闸门**不扫自己**（否则登记表文本会自己满足判据①）；**没有** `LEMO_*` 覆盖点（扫描根按脚本自身位置推导，夹具用「整棵拷到临时目录」）。★ 实测（真实语料）：**75 个文件 / 106 处 / 47 个变量**；登记 **47 条（覆盖点 36 + 非覆盖点 11）/ (文件,变量) 对 100**，**差额 0**；剥前/剥后 **116 → 106 处**，被剥掉的 **10 处逐条人读全是注释/字符串、0 处真代码误剥**。★ 九项验证（临时副本，**不动真实仓**，9/9 符合预期）：阴性对照 exit 0；变异A（`lib/aspects.mjs` 加 `process.env.LEMO_ZZZ_PROBE`）**exit 1 并点名 `lib/aspects.mjs` 的**新增行**（`LEMO_ZZZ_PROBE`）**；变异B1（`check-venc-args.mjs` 的 `LEMO_OPUSCAR` 改名）exit 1 / 判据②「被删了 / 改名了」；变异B2（删成裸标识符 ⇒ **只**触发判据②）exit 1；★ 反向（分别短路判据①/②）⇒ 对应变异**重新消失**（exit 0）；失明（无 `process.env` 的树 / 空树 / 清空登记表）三态均 **exit 1 + 「本闸门已失明」**。★★ **2026-10-07 扩展：现在也覆盖库仓 `core/**` + `tools/**`**（补掉上面那条自己登记的盲区，**闸门数不变**）。**判据⑤（表 ↔ 代码，判 FAIL）**：库仓 `core/**` **与 `tools/**`** 里**代码真在读**的环境变量（`.mjs` 的 `process.env.<NAME>` + shell 的 `${NAME:-…}` / `${NAME:=…}` / `${NAME:?…}` / `${NAME:+…}` / 裸 `$NAME` + python 的 `os.environ.get('X')` / `os.environ['X']` / `os.getenv('X')`）**必须出现在 `core/README.md` 的 `## Environment variables` 表里** —— 本项目铁律「**文档声称值 vs 实测值**」在环境变量这一维的落点（早前审计实测那张表**漏了 15 个**代码真在读的变量、手工补齐后**照样没有闸门**）。**判据⑥**：表里列了但代码不读 ⇒ **只列 ℹ**（实测 4 个：`HF_ENDPOINT` 由 `huggingface_hub` 库自己读、`LEMO_OPUSCAR_HOME` 的读者在 `plugin/skills/lemo-opuscar/scripts/setup.sh`、`RENDER_MIN_FREE` 与 `INDEXTTS_MIN_FREE_MIB` 是**动态取值**看不见）。**判据⑦（2026-10-07 二次扩展：`tools/**` 并入判据⑤、同判 FAIL）**：原先把 `tools/**` 在读但表里没有的 **10 个**（`LEMO_LIB`/`FONT_CACHE`/`FONT_SUB_TMP`/`FONT_STAGE`/`FONT_STAGE_EXTRA`/`FONT_PY`/`FONT_REPORT`/`FONT_FAILED`/`FONT_OKLOG`/`ONLY_SLUGS`）**只列 ℹ、不判 FAIL** —— 那张表是 **core 作用域**（40 行里没有一行只被 `tools/**` 读）⇒ 缺的是 `tools/` 的文档、不是 core 的表。★ 但「只列不判」**挡不住下一次再漏** ⇒ 用户定案后**已补文档并把 `tools/**` 并入判据⑤**：`core/README.md` 新增 `### tools/ environment variables` 小节（10 条，逐条写清 **变量名 / 默认值 / 作用 / 读者 文件:行**；表格式照 core 那张表的 `| Variable | Meaning |` 两列），此后 **core/** 与 **tools/** 里真在读的变量同判 FAIL**（`lib.toolsOnly` 字段移除）。★ 既不进白名单、也不放宽判据（后者=为了让闸门变绿），而是把文档补到「判据⑤ 真的能核」。**判据⑧（库仓失明守卫）**：库仓**可达**却 0 个 env 读取点 / 表解析出 0 行 / 找不到 `## Environment variables` / **`tools/**` 扫到 0 个待扫文件** ⇒ **FAIL + 「本闸门已失明（库仓侧）」**（★ `tools/**` 只判「0 个文件」、**不判**「文件在但 0 个 env 变量」—— 后者可能是脚本真的不再读 env，判它会误报）；★ **库仓不可达**（`LEMO_OPUSCAR` 指空/目录不存在）⇒ **只打一行 ℹ、不判 FAIL**（同 `check-ref-lines` 对缺失数据文件）。★ 库仓根用覆盖点 **`LEMO_OPUSCAR`**、**不硬编码** `D:/lemo-opuscar`；本闸门自己也是它的读者、**已登记进 `OVERRIDES`**（判据②守着它），代价是 (文件,变量) 对差额显示 **-1**（不扫自己）。★ **误报率实测（逐条人读）**：库仓 **47 个变量**（core 37 + tools 11，`LEMO_VENC` 重合）；`.mjs` 11 处/10 个、shell 19 处/18 个、python 21 处/21 个 ⇒ **真阳 51 / 误报 0**。★ 收窄过两轮假阳：shell 只认「**全大写** + **本文件内无赋值** + 非内建」（滤掉 `CONT`/`DEC`/`tgt`）；「无赋值」**只看赋值值开头**是不是 `$NAME`（自引用默认值 `NAME="${NAME:-…}"` 不算赋值 —— 否则漏 `ONLY_SLUGS`；**不能看整行** —— `mux.sh:112` 的 `M=$(…) || die "…$M…"` 会把 `M`/`OUT` 误判成外部输入）。★ **2026-10-07 第三轮收窄（修一处**漏报**）**：「本文件内无赋值」**太宽** —— 把 **命令前缀赋值**（`NAME=值 命令 …`，**不持久**、只传给那个子进程）也当成了定义。反例 `tools/fetch-fonts.sh:379` 的 `LEMO_LIB="$LIB" FONT_CACHE="$CACHE" ONLY_SLUGS="$ONLY" bash …` ⇒ 滤掉 `FONT_CACHE` ⇒ **漏报** 同文件 `tools/fetch-fonts.sh:34` 的 `CACHE="${FONT_CACHE:-/opt/fontsrc-cache}"`。现改为**逐简单命令**判「赋值是不是该命令的唯一内容」（`NAME=值` / `export|local|readonly|declare [-x] NAME=值` / `A=1 B=2` / `NAME=值 2>/dev/null` ⇒ 定义；`NAME=值 命令 …` ⇒ **命令前缀、不算**）。**误报率实测**：core+tools 的变量/读者集合**唯一变化** = `FONT_CACHE` 多读者 `tools/fetch-fonts.sh:34`（**真阳**）⇒ **新变量 0、误报 0**。**局限**：**逐行判、不跨行** ⇒ `NAME=值 \` + 下一行命令的**续行**判不出来（本项目 6 个 `.sh` 无此形态）。★ **十项验证（临时副本，全程不动库仓，10/10）**：阴性 exit 0；**变异A**（副本 `core/README.md` 删 `LEMO_GPU` 行）exit 1 + 判据⑤点名；**变异B/B2/B3**（`browser.mjs` 加 `process.env.LEMO_ZZZ_PROBE` / `mux.sh` 加 `${LEMO_YYY_PROBE:-x}` / `asr_check.py` 加 `os.environ.get("LEMO_PPP_PROBE")`）均 exit 1 + 点名；★ **反向**（摘掉判据⑤⑥⑦⑧）⇒ 变异 A/B 与失明夹具**全部重新变绿**；**失明**（可达但 0 变量）exit 1 + 「已失明（库仓侧）」；**不可达** exit 0 + ℹ。★ **二次扩展（`tools/**` 并入判据⑤）验证（临时副本，6/6）**：阴性 exit 0；**变异A**（副本 `core/README.md` 删 `FONT_SUB_TMP` 行）exit 1 + 点名 `[tools] FONT_SUB_TMP`；**变异B**（副本 `tools/fetch-fonts.sh` 加 `: "${FONT_MIRROR_PROXY:-}"`）exit 1 + 点名 `[tools] FONT_MIRROR_PROXY`；★ **反向**（摘掉 `tools/**` 作用域）⇒ 两变异**重新变绿**；**失明**（`tools/` 在但 0 个待扫文件）exit 1 + 「已失明（库仓侧）」；**误报率**：删掉新小节后判据⑤ 命中 **10 条**，逐条人读**真阳 10 / 误报 0**。★ 库仓侧局限：**动态取值假阴**（`core/render/slot.mjs:24` 的 `envNum(name,…)` 读 `RENDER_MIN_FREE`、`core/tts/tts_indextts.py:96` 的 `_env_int('INDEXTTS_MIN_FREE_MIB')` —— 那 2 条 ℹ 的真相是「闸门看不见」而非「表里多写了」）；shell 小写 env 输入会漏；python 只看三种标准形态；**`_` 前缀=进程内自设**（`_LEMO_INDEXTTS_INNER`）⇒ 不判只列。
node D:/lemo-tools/scripts/check-aspect-declaration.mjs # ★ 影片入口画幅声明：没有 film*.js 的风格，其真实入口（index.html 引的本地 .js / 内联脚本）若读了视口 ⇒ FAIL（否则控制台会误报「只支持 16:9」）；风格目录不存在 / 0 风格即判失明
node D:/lemo-tools/scripts/check-aspect-prose.mjs     # ★ SKILL.md 画幅论述：§2/§9/§11 的「只支持 16:9 / 9:16 不可用 / 43.75%」类否定式声称 vs styleAspects() 的能力声明（双向；整行历史标记 + 引号/删除线豁免；「现状/当前」标记可推翻豁免；--ignore 排除在途风格；风格目录/事实源探不到即判失明）；★★ **2026-10-07**：`lib/aspects.mjs` 的 `STYLES_DIR` 原先**写死**、`LEMO_STYLES_ROOT` 只管失明探测 ⇒ 本闸门**无法反向测试**；现 `STYLES_DIR` 可覆盖（不设时逐字节等价，43 风格 dump 与 `declared=true` 计数 42 均不变）。★ **「方向级失明」实测未复现**：假树（有 `film*.js` 但都不写 `aspects`、文档写「已支持 9:16」）下闸门**判 152 条 FAIL + exit 1**（响亮的判错方向）；只有「事实源有且仅有一个支持 9:16 的风格、恰与 POS 锚点重合」这一子情形是静默假绿，与「文档集体撒谎」**文本不可区分** ⇒ **刻意不加守卫**（加了会把「闸门失明」换成「闸门说谎」）。★ 旁路只记不改：`lib/briefs.mjs` / `lib/env.mjs` 各自算 `CFG.winLib/styles`
node D:/lemo-tools/scripts/check-esm-import-paths.mjs # ★ 动态 import 传运行时绝对路径（Windows 下 path.join ⇒ 报 'd:' 崩，POSIX 走 WSL 不暴露）：import(path.join(…)) 无 pathToFileURL/file:// ⇒ FAIL，报 file:line；首片段 ./ ../ / scheme 放行；扫描根不存在 / 0 文件即判失明
node D:/lemo-tools/scripts/check-ref-lines.mjs       # ★ 散文/源码里的 `<路径>:<行号>` 引用会不会随行号漂移而失效。★★★ **扫描范围（2026-10-07 再扩：纳入源码文件）**：**180 份文档 + 791 份源码**（源码侧 = `lib/*.mjs` 21 份、工具仓根 `*.mjs` 5 份、`styles/*/demo/**` 733 份、`core/**` 24 份、`tools/**` 8 份；只收 `.mjs` / `.js` / `.py` / `.sh`；**排除 `vendor/`、`node_modules/`、`.git/`、`*.min.js`** —— 压缩产物里 `r.classId` / `r.length` 这类「标识符后跟冒号零」形态会被 `REF` 认成引用（`r.classId` 恰好长得像带扩展名的路径）⇒ 不排除就假红；夹具 t3 实测：同段内容放 `demo/vendor/lib.min.js` 被排除、放 `core/notmin.js` 则报 **2 处假 (a)**）。★ **为什么加源码**：源码注释里的同类引用此前**零覆盖** —— 实证 `lib/jobs.mjs`（3 处）与 `lib/vram.mjs`（2 处）的这类引用**全部已失效**（`lemo-make.mjs` 的 1158 / 743 / 996-1019 / 2428×2 行 ⇒ 真位置 1273 / 858 / 1559-1563 / 2716 行）。★ **判据不变**（(a)(b)(c)(d) 四条全跑；源码里的引用**目标也是别的文件**，与它写在哪种文件里无关）。★ **误报率实测（791 份源码 / 8 处引用，逐条人读）**：**命中 1（真失效）/ 误报 0 ⇒ 精度 100%** ⇒ **不做任何收窄**。那 1 处 = `lib/jobs.mjs` 第 61 行引 `server.mjs` 第 1675 行（1675 行是 `*/`；`--skip-sync` 实在 1674 行注释 / 1755 行那条 `const opts = …`）⇒ **(c) FAIL 真阳性**；另有 **有效 3 处**（`styles/art-deco/demo/frame.js` 第 11 行引 `STYLE.md` 第 45 行、`lib/dub-core.mjs` 第 169 行引 `halftone-dossier/STYLE.md` 第 19 行、第 172 行引 `risograph/STYLE.md` 第 23 行，逐条核过被引行内容与引文逐字一致）与 **只列不判 4 处**（多义：`demo/index.html` 第 140 行 ×2 全库 46 处同名、`STYLE.md` 第 25 行 44 处同名）。★ 排除项**在本轮真实语料上不承重**（带排除 791 份/8 处，关掉排除 792 份/**同样 8 处** —— 那个 `vendor/opentype.min.js` 里一个反引号都没有）⇒ 是**保险**而非修 bug，但**必须留**。★★ **第二层盲区（比「没扫源码」更深，务必知道）**：任务书那 5 处里**只有 1 处带反引号**，其余 4 处是**裸引用**（写作「见 lemo-make.mjs 第 743 行」这种形式）⇒ 本闸门**按设计就不认**，**扩了源码范围也照样看不见** —— 即「源码文件已纳入」**不等于**「源码里的引用都被管住」；修法是给裸引用**加反引号**（本轮那 5 处已顺带改成**符号名 / 代码锚**，不再依赖行号）。★ **失明守卫照旧生效**（夹具 t4：整棵树无引用 ⇒ exit 1 + 「本闸门已失明」）。★ **不纳入**：`node_modules/`、`vendor/`、生成物。★ **2026-10-07 订正**：`scripts/**` **已纳入**（实际扫到 44 份）—— 本行原写「`scripts/**`（本轮未要求）不纳入」，那是**上一批的旧状态**；★ 但**本闸门不扫自己**（头注释必须用反引号举「引用形态」的例子，拿它们当真引用核 = 结构性误报）。★★ **扫描范围（2026-10-07 前一次扩）**：**137 → 180 份** —— 加进了 **43 份 `lib/style-skills/*/_distill.json`**（此前 `DOCS` **只含 `.md`** ⇒ `.json` 里的引用**零覆盖**）：实测新增 **17** 处引用（3796→3813）、**0 FAIL**，逐条人读 **14 有效 / 2 真失效（弱）**。★ **口径** = 按**物理行**扫（与 `.md` 同口径），靠「`JSON.stringify` 把 `\n` 转义 ⇒ **1 字符串值 = 1 物理行**」（实测 **2510/2510**）保证与「按 JSON 字符串值判」**等价** ⇒ **不写第二套解析器**；**(a)(b)(c)(d) 对 `.json` 照样适用**（引用**目标是外部文件**、不是 JSON 自己；**反引号不是 JSON 转义字符**，故 `<路径>:<行号>` 在 JSON 里原样存在）。★ **不加反引号的「裸引用」明确不纳入**：`_distill.json` 里还有 **390** 处，按 (a)(b)(d) 判 **3 命中 / 误报 2**（盘符 `D:` 被正则吃掉；`sfx.py` 第 9 行属「按文件名不搜 `core/`」的已知局限；`mux.sh` 第 115 行解析到**同名错文件**）⇒ 精度 ≈**33%**，失败是**判据结构性**的（`siblingPaths` **只收反引号片段**）。★ 上面 3 处失效示例**故意写成「路径 + 第 N 行」**（不写 `路径:N`）—— 写成反引号包裹的 `路径:N` 会把**说明文字**变成**真引用**（实测第一版多报 (a) 2 + (b) 1）；即使**不加反引号**也不安全：本行反引号有 **328 个**（2026-10-07 起配对已按 CommonMark 等长配对），别人的 code span 仍可能**把你这段纯文本圈进去** ⇒ 落进去就**既不计入引用、也不进 backlog** ⇒ 唯一稳妥的写法是**把路径与行号拆开**。**由来**：2026-10-06 本会话连撞三次 —— `check-film-aspect.mjs` 与 `test/README.md` 引用 `scripts/style-distill.mjs:189`（`--ratio 16:9`），改了被引文件后漂到 `:305`、三处全改；同一轮再改一次漂到 `:331`，三处**再次全部失效**，而当时 28 个闸门没有一个看得见。**判据四层**：(a) 文件存在（解析不到 ⇒ FAIL）、(b) 行号在范围内（> 总行数 ⇒ FAIL）、(c) 内容对得上（引用**同小句**内、距引用 **≤40** 处若有**高置信代码片段**（`--flag` / `#hex` / `标识符 = 值` / `名字(...)`）则要求它出现在被引行区间；**token 匹配**，全部 token 命中或含数字的 token 命中即通过）、**(d) 被引行没有内容**（2026-10-06 补，治 (a)(b)(c) **三条全放行**的盲区 —— 被引行 `trim()` 后是**空行** / **`---`（或 `***` / `___`）** / **```` ``` ```` 围栏** / **行号 > 文件实际行数**（`split('\n')` 尾元素造成的**幻影行**，(b) 的 `> lines.length` 抓不到）⇒ FAIL；★ **只判单点引用**，区间引用（如 `a.js` 第 10-20 行）**不判**，因为区间**起点早一行**落空行是无害写法（实测 `art-deco/SKILL.md` 第 106 行、`shadow-puppet/SKILL.md` 第 101 行、`test/README.md` 第 581 行三处全是这种形态）⇒ **误报率：初版（不分单点/区间）命中 13 / 误报 3 ⇒ 精度 77%；定稿版（只判单点）命中 13 / 误报 0 ⇒ 精度 100%** ⇒ **判 FAIL 而非 backlog**（与 (c) 不同，(d) **没有误报机制**：「被引行是空行/分隔线/围栏/不存在」没有任何合法读法能解释成「我指的就是它」；降级条件写在脚本头注释里））。**路径感知**（不做全仓 basename 模糊匹配 —— 实测会把 `main.js:566` 命中到另一个 11 行的 `main.js`；同小句里出现带目录的同名路径时以它为准）。**误报率（先测再收窄）**：(c) 初版候选 98 / FAIL 46、**误报约 60%**（`--ratio 16:9` 源码写作 `'--ratio', '16:9'`、`type=='cap'` 写作 `e['type']=='cap'`、`dur 133.0` 写作 `"dur": 133.0`…）⇒ 否决；「距引用 ≤40 但**不限小句**」候选 646 / FAIL 363 ⇒ 否决；「只认高置信形态 + 先排除引用自身」候选 37 / FAIL 17、**误报 0** ⇒ 采用；子串匹配换 token 匹配 ⇒ 最终 **37 / 10**。**不收窄成只查 (a)(b)**：(c) 是唯一能抓「行号在范围内、但那一行已经不是它说的东西」的判据。**豁免（只列不判）**：`(^|/)logs?/` 或 `.log$` —— `_distill/logs/*.log` **两仓都被 `.gitignore` 排除**、每次跑都重写、行号天然会变。**两层语义**：**本引用所在小句**内含「已登记失效」标记 `已失效|待修|已知失效|原为|原记|已登记|已废弃` ⇒ 只列不判（同 `check-tp-prose` ④，粒度收到**小句**）；★ 同一小句里出现 **≥3 个不同标记** ⇒ 那是**词表**不是登记、**不豁免**（否则本闸门自己的说明行会把自己永久豁免 —— 「匹配判据可被无关文本满足」）；★★ **2026-10-06 两次收紧（同一形态的病犯了两次）**：① 整行 → 小句（旧版整行粒度下，一行只要顺口写了「禁止照抄任何**历史**海报的构图」就整行豁免 —— 实测 swiss-motion 的 SKILL.md 第 30 行；**故意不用「距引用 ≤40」**：小句已够紧、又能保住「已登记待修的（a.js 第 1 行、b.js 第 2 行）」这类**列举式登记**）；② 剔除泛词「历史」（普通词、与失效无语义绑定）、补「已登记/已废弃」（「原为/原记」保留 = 本仓「原文保留 + 追加更正」固定用语）。**夹具**：fx1a（行含「历史海报」但与引用无关）改前 backlog ⇒ 改后 **(b) FAIL**；fx1c（标记在**同行别的小句**）改前 backlog ⇒ 改后 **FAIL**；fx1b（标记与引用**同小句**）改前改后**都 backlog**（未误伤）。**真实语料**唯一被整行豁免的 hd-2d 的 SKILL.md 第 196 行（它说 mux.sh 第 60 行有 `LN_TP = -1.7`，而 `LN_TP` 实际在第 94 行）改前 backlog ⇒ 改后 **(c) FAIL**（该行「原记」指的是旧真峰值读数、不是这条引用 ⇒ 真阳性）。★ **(a) 报错文案订正**：旧版对裸文件名失败写「**全库也没有同名文件**」，而「全库」其实只有 `styles/` 树 —— 实测 scifi-toon 的 SKILL.md 引裸名「sfx.py 第 9 行」被判「全库没有」，而 `core/audio/sfx.py` **确实存在** ⇒ 现如实说「按**文件名**只搜过『本风格树 + `styles/` 全树』，**没有**按文件名搜 `core/`/`scripts/`/`tools/`」并给修法；**判据不扩到 `core/`**（扩了就是被否决过的 basename 跨树模糊匹配）。★ **引用形态补逗号组**：N / N-M / N/M / **N-M,K,…**（每段都核）—— 旧正则没有 `,` ⇒ 这类引用整个不被识别（scifi-toon 的 SKILL.md 第 76 行引 story.js 的 1-6 与 66）。**误报率（先测再收窄）**：先 `grep | grep ','` 摸语料，新增识别 **155 条**（本项目 DOCS 内 **142** 条）、形态 `N,N` 79 / `N-N,N-N` 17 / `N,N,N` 17 …，**155/155 全是行号组、0 误吃**；真实语料新增 FAIL = 0。**同一快照对照**：引用 3655 → **3797**、FAIL 0 → **1**（唯一新增即 hd-2d 那条）、只列不判 215 → 245（logs 198 → 229，全是逗号形态的日志行号组）。多义引用（`demo/test.js:9` 全库 9 处同名）与欠指明引用（`mux.sh:151`，本风格树里没有、全库 12 处）也只列不判。**失明守卫**：一个引用都没找到 ⇒ **FAIL 并明说「本闸门已失明」**；引用全解析不到也判失明。**验证（临时树 + 覆盖点）**：`fx-ok`（`:331` 的 `--ratio 16:9`）**exit 0**；`fx-b-range`（`:999`）**exit 1 + (b)**；`fx-b-file`（不存在）**exit 1 + (a)**；`fx-b-content`（`:305`，**行号在范围内但内容不对** = 本会话真实漂移形态）**exit 1 + (c)**；`fx-blind`（无引用）**exit 1 + 「已失明」**；`fx-registered`（超范围但整行写了「已登记待修」）**exit 0 + backlog**；**(d) 的 5 个夹具（2026-10-06 补）**：`fx-A`（指向**空行**）**exit 1 + (d)**、`fx-B`（指向 `---`）**exit 1 + (d)**、`fx-C`（行号 = 实际行数 + 1，**幻影行**）**exit 1 + (d)**、`fx-D`（**区间引用**起点落空行 = 那 3 处无害写法的形态）**exit 0**（**不许抓**）、`fx-E`（正常引用）**exit 0**；另验 `fx-F`（**0 引用**）**exit 1 + 「已失明」**（失明守卫未被 (d) 破坏）、`fx-G`（`***` / `___` / 围栏）**(d) 3 处**。同轮真实语料 (d) 命中 **13** 处、**逐条人读误报 0**（清单与「真内容在哪一行」见脚本头注释）。**真实语料首跑**：3652 处引用 / 3436 处解析到文件 ⇒ (a) **2**、(b) **24**、(c) **10**，只列不判 **217**（logs 198 / 多义 10 / 欠指明 6 / 已登记 4）—— 其中 `MAINTAINING.md:328` 的 `` `scripts/style-distill.mjs:189` `` 正是那次漂移的残留。**已知局限**：(c) 覆盖面窄（真实语料仅 **37/3652** 处落在判据内，**有意取舍：宁可少判不可乱报**）；启发式（非 AST），**不加反引号**的引用只列进 backlog 盲区、不被核对；风格源码被**重构成多模块**的老文档（`ascii-crt`/`one-line`/`scifi-toon` 把 `main.js` 拆成若干模块）会报大量「行号超范围」—— 那是真失效，但修法是重写引用。★ (d) 的已知局限：只管「**那一行有没有内容**」、不管「内容对不对」（被引行是正文但写的是别的东西 ⇒ (d) 看不见，那是 (c) 的活，而 (c) 只覆盖少数引用 ⇒ 两条合起来仍有缝）；**区间引用整个不判**（代价：区间型失效也放过）；「结构性行」只认 `-{3,}` / `*{3,}` / `_{3,}` / `` `{3,} ``（不认 `~~~`、不认 `#` 标题行）。覆盖点 `LEMO_TOOLS_ROOT` / `LEMO_OPUSCAR` / `LEMO_STYLES_ROOT` / `LEMO_DISTILL_ROOT`。★★ **2026-10-07 新增第三类 backlog「裸引用(未被核对)」**：本闸门**只认反引号包裹**的引用 ⇒ 正文里**不带反引号**的「路径 + 冒号 + 行号」此前**一条都不被核对**（不计入 `refCount`、不进 (a)(b)(c)(d)、**也不出现在任何输出里**）⇒ 后人会把「引用失效 0 处」误读成「引用已清零」。现照 `logs` 的写法把它们**列进 backlog**（**只计数 + 可 `--list-backlog` 逐条列出出处与原文片段**，**一律不判 FAIL、不影响退出码**），并在输出里**明说这是盲区**（原文：「别把『引用失效 0 处』读成『引用全对』」）。★ **判据一个字没动**（**不许**把裸引用纳入 (a)(b)(c)(d)）：按 (a)(b)(d) 判实测**精度仅 ≈33%**，且失败是**结构性**的（`siblingPaths` 只收反引号片段 ⇒ 只写 basename 的裸引用必然解析到**同名错文件**）。★★ **2026-10-07 订正（b84-b：上面「不许纳入」的结论被推翻）**：`lib/dub-styles.json` 纳入扫描范围后**重测**，裸引用**其实可判** —— 46 处按 (a)(b)(d) 判得**真阳性 20 / 失败 2 / 多义 24**；给数据文件按 `"id"` 分块喂**风格上下文**（`slugOf`/`rootsFor`/`resolveRef` 全部按 `lineNo` 取所在风格）后多义 58→29、暴露 **3 处真失效 + 1 处跨风格误报**。★ **收窄（先测再收窄）**：裸引用**不加锚**（嵌在正文里、不是整串），但**扩展名首字符须为字母**（一条规则挡「地址+端口」「数值比」两类假阳）；扫描前先把**反引号片段整段挖成等长空格**（与主判据共用 `codeSpans()`）⇒ 已核对的引用不会被重复算成裸引用 ⇒ **假阳 24 → 1**（唯一残留 = 跨风格同名，已按**写作侧**写全路径）。★ **两层语义照用**：新增 `BARE_KNOWN`（键 = `相对路径|片段`、**不含行号**以免漂移）登记存量；**未登记且 (a)(b)(d) 失败 ⇒ FAIL**。★ **口径代码**：`const BARE_REF = /((?:\.[A-Za-z][A-Za-z0-9_\-]*)|(?:[A-Za-z0-9_][A-Za-z0-9_./\\-]*\.[A-Za-z][A-Za-z0-9_]*)):(\d+)((?:[-/,]\d+)*)/g;`（对**挖洞后的行**跑 `matchAll`）；反引号引用走锚定版 `REF = /^((?:\.[A-Za-z][A-Za-z0-9_\-]*)|(?:[A-Za-z0-9_][A-Za-z0-9_./\\-]*\.[A-Za-z0-9_]+)):(\d+)((?:[-/,]\d+)*)$/`（★ 2026-10-07 起：两条正则都**新增「点开头 + 点后必须是字母」的非捕获二选一**，以认得「点开头控制文件 + 行号」这类引用（如 `.gitignore` 的第 63-64 行）—— 此前它们**一条都不被计入**；点后必须是**字母**是为了不误吃比值写法（如「.5」冒号「1」）。★ 本句**刻意把路径与行号拆开写**：写成反引号包裹的「路径 + 冒号 + 行号」会**当场变成一条真引用**，而它按工具仓解析会超范围 ⇒ 闸门立刻变红 —— 这正是本条纪律自身的演示）。★ **失明守卫加第 ③ 条**：`lib/dub-styles.json` 在、却 `dubRefCount===0` 或 `dubBareCount===0` ⇒ 判失明（**文件不在时不判** —— 否则 `test/gate-blindness.test.mjs` 的 `ref`/`ref2` 夹具树会误红；代价：数据文件被删**不**触发本条，靠「引用一个都没找到」兜）。★★ **2026-10-07 订正（b84-b 第三轮：把守卫②从「数据计数」换成「源码标记」，根治镜像脆弱点）**：上面「`dubBareCount===0` ⇒ 判失明」**已降级** —— ① 覆盖守卫改成**合计口径** `dubRefCount + dubBareCount === 0`（「把反引号引用也改成裸引用」正是本仓**推荐**的写作方向，旧口径会**假红** ⇒ 假红诱使后人**删掉守卫** ⇒ 判据静默丢失）；② `dubBareCount === 0` **不再判 FAIL**，只打一行 `ℹ`（「本次 0 处裸引用 —— 可能是已全部改写成反引号引用，那是合法方向」）；③ 取代它的是**源码标记守卫**：读**本闸门自己的源码**（先剔掉 `//`、`/*`、`*` 开头的注释行），要求裸引用判据的三个**自造标识符**标记**同时存在** —— `BARE_REF` 的正则定义 / `bPush(`（裸引用判 FAIL 的唯一出口）/ `bareChecked++`（真被 (a)(b)(d) 核过的计数），且三个标记**必须用字符串拼接写**（如 `'const BARE_' + 'REF = '`），免得守卫的**字符串字面量自己满足自己**（那会是一条**假守卫**，本项目踩过这个坑）；再用**内联探针**做一次**行为自证**（现役 `BARE_REF` 必须认得出探针（`__b84b_self_test__.mjs` 的第 12 行））⇒ 防「正则被收窄成匹配不到任何东西」。**为什么换**：**代码改动是显式可见的、数据改动是静默的**，守卫要钉在「不会偷偷变」的那一侧。④ 变异实测（`D:/lemo-tmp/b84-b/mutate2.mjs`，**4/4 ✓**）：摘掉裸引用判据整段 ⇒ **exit 1 且点名**（`裸引用判据的关键代码标记不见了`，语义未退化）；数据里 40 处裸引用全改成反引号引用 ⇒ **exit 0 + ℹ**（合法改写不再假红）；数据里 11 处反引号引用全改成裸引用 ⇒ **exit 0**（守卫① 合计口径仍成立）；b84-a 那种极简夹具树（无数据文件）⇒ **exit 0**（不误伤）。⑤ **残留洞（已如实登记在脚本头注释，不粉饰）**：把整段塞进 `if (false) { … }` 变成**死代码**时**挡不住**（标记还在文本里、只是不执行）；`/* … */` 块注释包整段同理；标记是**静态文本、不是 AST** ⇒ 后人**重命名** `bPush`/`bareChecked` 会**假红**（需同步改 `BARE_MARKERS` —— 这是刻意的取舍：假红显式可见、一改就好，比假绿静默丢判据好）。⑥ **自我攻击实测**（`self-attack.mjs`）：`//` 整段注释 ✓ 抓得住、正则收窄 ✓ 抓得住（内联探针）、只把 `bPush(` 调用点改名 ✓ 抓得住、`if (false)` ✘ **抓不住**、删段+塞 decoy ✘ 不抓（**主动造假**，不在守卫职责内，且标记是自造标识符 ⇒ **无关代码满足不了**）。★ **数据侧**：46 处裸引用逐条实测 —— **19 处原样保留**（实测已对）/ **21 处改正**（路径补全 / 行号按测量改 / 改指同名真文件）/ **6 处改成符号·片段形态**（不再依赖行号）。★ **实测**：`引用 4613 / 解析 4271 / 裸引用 48（已核 43 / 未进判据 5）/(a)(b)(c)(d) 全 0 / 退出码 0`。★ **数据文件缺失时不再静默**：`lib/dub-styles.json` 不在时打一行 `ℹ` 说清「这个已声明的覆盖目标本次一份都没检查」，表头明细也**按存在性**列它（保证「明细求和 == 总数」，不再出现「总数 181 / 明细 180」）；**不判 FAIL、不改退出码**（极简夹具树里允许缺它）。★ **正则与假阳收窄**：形态与 `REF` 同形但**不加锚**（裸引用嵌在正文里），且**扩展名必须以字母开头** —— 这一条同时挡掉「**地址 + 端口**」（回环地址那种）与「**数值比**」（对比度 2.5 比 1 那种）两类假阳；实测**宽松版 305 处 → 收窄后 295 处**，被挡掉的 10 处**全是**这两类、**零误伤**。★ **已知残留假阳（不修，只记）**：本闸门自己的「引用形态示例」被它的说明副本（`test/README.md` 那一行、本文件这一行）带进语料（**同步前**本行 6 + 那份 9；同步后 5 + 7），形态上没法区分。★★ **2026-10-07 更新（配对根修后）**：它们**不再落进裸引用 backlog**、而是**进了引用计数**（其中 3 处会造成 (a) 假红，已按**写作侧**改成非引用形态）；现在落在「**多义(无法核对)**」backlog（**只列不判、不产生假红**）。**取舍不变**：宁可多列，也不收窄到漏掉真引用。★★ **掩码口径（2026-10-07 根修：改为 CommonMark 等长配对）**：配对由「**顺序配对**」（找「反引号 … 下一个反引号」，**不要求长度相等**）换成 **CommonMark 的「等长反引号串配对」** —— 连续的 N 个反引号开启 code span、由**后面最近的、恰好 N 个**闭合；找不到等长闭合的开启串**不是 code span**（按普通文本处理）。★ 为什么必须换：一行里只要出现**双/四反引号**或**孤立（不成对）的反引号**，顺序配对就**整行错位**，后果**双向** —— ① 有的引用**漏出掩码**被**误列成裸引用**（假阳）；② 有的**被吃掉**（既不计入引用、也不进 backlog，假阴）。★ **实测（真实语料，同一台机同一时刻；两套配对的**全量 dump 逐条集合比对**）**：`test/README.md` 那份说明行有 **438 个反引号 = 424 段反引号串**（顺序配对 219 段 vs CommonMark 209 段），本文件这份是 328 个反引号 / 316 段（**164 vs 156**）；全语料 **引用 4548 → 4560（唯一键 +10）、解析到文件 4214 → 4219、进入 (c) 45 → 46、裸引用 20 → 8（−12）、多义 17 → 24、只列不判 354 → 349、(a)(b)(c)(d) 全 0 → 全 0、退出码 0 → 0**（★ 这是**文档同步后**、可**当场复现**的同一语料对照；文档同步**之前**同一比对为 **裸引用 23 → 8（−15）**，差的 3 处正是下面「写作侧同步」改掉的那 3 个示例引用）。★ **零丢失**（旧有新无 = **0 条**、新有旧无 = 10 条）、**零新增假阳**（裸引用新有旧无 = 0 条）。★★ **那批「被误报成裸引用」的**（**同步前**测 = `test/README.md` 那份 9 + 本文件这份 6，共 **15**；**同步后现测** = 那份 7 + 本文件 5，共 **12**）**逐条**全是「闸门说明行里的**引用形态示例**」；配对改对后它们**不再进裸引用 backlog**：其中 **12** 处**进了引用计数**（落到「多义(无法核对)」backlog，只列不判），另 **3** 处按**写作侧**改成**非引用形态**。★ **必须同时剥一层「引用一个 code span」的引号**（本仓固定写法）—— 纯 CommonMark 下那种写法内容**带反引号**、锚定的引用判据**不认**它 ⇒ 那条引用会**消失**；**不做这步会丢 2 条**，剥一层后旧有新无 = 0 条。★ **写作侧同步 3 处**：说明行里 3 个示例引用（两处 `foo.js` + 一处 `scripts/does-not-exist.mjs`，**都带行号**）改对配对后会变成 **(a) 假红**（它们**本来就不是真引用**）⇒ 按「正确修法是写作侧」改成**非引用形态**，改完 (a) **0 处**；其余 **12** 处落到「多义(无法核对)」backlog（**只列不判、不产生假红**）。★ **判据一个字没动**：(a)(b)(c)(d) 的内容、`REF`、`HIGH_CONF`、小句切分、token 匹配全部未改；改的只有**反引号片段的配对（掩码）口径**这一处（三处使用共用同一个函数）。★ **夹具（覆盖点指到临时树，绝不动真实仓；对照 = 改动前的副本）**：A（双反引号 code span + 真裸引用）改前 **引用 1 / 裸引用 3** ⇒ 改后 **引用 2 / 裸引用 2**（**真裸引用仍被列出**）；B（孤立反引号，整行 3 个）改前 **引用 3 / 裸引用 1** ⇒ 改后 **引用 2 / 裸引用 1**；C（空片段）与 D（正常行）改前后**逐字一致**；E（0 引用）改前后**都 exit 1 + 「本闸门已失明」**。。★ **夹具 `fx-bare`**：真裸引用（含一处**明显失效**的「文件不存在 + 行号超范围」）**被列出**、两类假阳**不被列**、且 **exit 0**（新类不影响退出码）。★★ **2026-10-07 逐条核过这 8 处盲区 —— 它们不是「8 条待核对的引用」，而是「8 条**结构上就不是点引用**的串」**：7 处在 `lemo-make.mjs` 的注释里（`audio/foley.py` 第 12 行、`music/score.py` 第 9 行、`mix.py` 第 9 行、`game-show/demo/music.py` 第 24 行、`living-screencast/demo/sound.py` 第 200 行、`main.js` 第 11 行、`main.js` 第 12 行），写法是**泛化的模式描述**（「WSL 侧 `audio/foley.py` 的直读输入」），**故意不点明是哪个风格** —— 而 `main.js` 全库 41 处同名、`build.sh` 35 处同名 ⇒ 补反引号只会把它们从「裸引用盲区」搬进「**多义(无法核对)**」backlog，**一条也不会被真核对**；第 8 处是 `_distill/AGENT-BRIEF.md` 里**明确标注**「这一串故意不加反引号」的**形态示例**。⇒ **实际盲区里「能被核对却没被核对」的真引用 = 0 条**，**不要把 8 这个数当 TODO 读**。★ 本段**刻意用「路径 + 第 N 行」**写这些路径：写成反引号包裹的「路径 + 冒号 + 行号」会把说明文字变成**真引用**（本项目踩过），不加反引号又会变成**新的裸引用** —— 把两者拆开是唯一稳妥的写法。
```

**★ 三条最容易漏的**：
1. **`check-tp-prose.mjs`** —— 你写在正文里的真峰值数字必须与实测一致。**只改 json 不改正文 = 文档撒谎**
   （实测漏过：正文写 `+0.08 dBTP`、json 已改 `−1.72`）。改完跑 `patch-tp-prose.mjs` 或
   `refresh-style-skill.mjs` 来补「已修」标注。
   ★ 例外：**逐档扫描/对照表**（一行里 ≥2 组「箭头 → 数值 dBTP」，如 `PLR 12.99 → +0.28 dBTP` ·
   `10.70 → −1.27 dBTP`）属**实验记录**，闸门把它单列「实验行」、不计 FAIL —— 但**交付声称**仍必须与实测一致。
   ★★ **2026-10-05 覆盖面变了**：判据由「值 > −1.2 才查」改成「**当前结论句无论是否达标都比对**」
   ⇒ 除「超标 → 达标」外，**「一直达标、但重渲/重混后实测值变了」也算 FAIL**（实测 3 处：
   `halftone-dossier:186` −2.79→−3.26、`hd-2d:299` −1.54→−3.21、`watercolor:105` −1.72→−3.34）。
   ★ **这一类没有工具会写**：`patch-tp-prose.mjs` 与 `refresh-style-skill.mjs` 的判据里都带「值 > −1.2」
   ⇒ 它们只补「超标 → 达标」，**「一直达标但值变了」只能人工按 `loudnorm input_tp` 实测改**
   （改法：**当前结论句**直接改成实测值、**不加**历史标记；**历史记录句**保留原句 + 加 `原记` + 补现值。
   ★★ **「只加标记不补现值」= 把闸门永久豁免**：④ 是**整行**粒度，行里出现 `已修` 就整行放行
   ⇒ 历史句**必须**同时补上当前实测值，否则那一行再也测不出来）。
   ★★ **2026-10-05 判据 ③ 放宽（60 字窗 ⇒ 整行）+ 新增 ⑥**：旧 60 字窗在「成片」离数值较远时**整类漏报**
   （对照树实测假阴 **8/8 = 100%**；`hd-2d:120` 的「成片」离 `−1.54` **69** 字、`watercolor:214` 离 **144** 字）。
   放宽到整行后命中 **10**（真陈旧 8 / **误报 2 = 20%** —— 两处都是**上游 `demo/mix.wav` 的真峰值**被连带捞进来）；
   加 **⑥ 非本片产物排除**（数值**所在句**出现 `mix.wav`/`score.wav`/`母带`/`中间产物`/`上游`/`样片`/`素材`）
   ⇒ 命中 **8** / 真陈旧 **8** / **误报 0**。★ ⑥ 必须排在 ⑤ 之后：实验行讲的正是「`mix.wav` 的波峰因子扫描」。
   ★ 也试过更窄的「同句（按 `。！？；` 分句）」：命中 **1**，但连 `hd-2d:120` 与 `watercolor:214` 一起漏掉 ⇒ **不采用**。
   ★ 放宽后**新覆盖**的 6 处真陈旧（此前被 60 字窗遮蔽，已按实测改正）：
   `paper-lantern:112/117/230/245/266`（正文 −1.66 / 实测 −3.37）、`paper-popup:215`（−1.65 / −2.33）。
2. **`check-config-vs-doc.mjs`** —— 若你在 §11 里指出「配置配色与本风格不符」，**§3 里必须给出可核对的色值**（hex），
   否则下游**没有依据**去改配置（凭猜就是编值）。★★ **2026-10-06 起，§11 那条记录必须「指向本条」才算「已记录」**
   （否则判 `fresh`/FAIL）：§11 段里要出现该风格的 `palette.bg` 值（带 `#`、大小写不敏感）**或**明确写「底色」——只写
   「palette −1」这种分数行不算（`shadow-puppet` 即此型）。★ 色值**优先从该风格自己的源码取**（`styles/<slug>/demo/*.js`），
   带 `file:line` 出处；★ 若该风格配色**本来就是参数化的**（如 HSL + hue 参数、源码里没有固定 hex），就**如实记参数表达式**并在 §3 写明「为什么没有 hex」，**不要为了格式整齐硬编一个 hex**。
3. **`_distill.json` 自身的散文 / 旁证字段没有任何闸门覆盖** —— 闸门只读**结构化字段**
   （`generatedVideo.*` 与 `selfCheck.loudness.{truePeakDbtp,integratedLufs,lra,peakDbtpTarget}`）
   与 **`SKILL.md` 正文**。实测踩过（2026-10-05 穷举发现）：
   · `selfCheck.loudness.samplePeakDbfs` 曾有 **5 份陈旧**（`risograph` −1.107324→−3.106276、
     `blueprint` −1.611899→−2.754564、`dataviz` −1.372202→−2.401433、`microgame` −0.856469→−2.291309、
     `papercut-red` 0.33→−2.189661），旧值甚至 **> 同片 `truePeakDbtp`（物理不可能：采样峰值必 ≤ 真峰值）**；
     根因：`fix-truepeak.mjs` 只回写 `truePeakDbtp/integratedLufs/lra/peakTargetMet`，**不回写 `samplePeakDbfs`**。
     ★ **2026-10-05 已从工具侧修掉**：`fix-truepeak.mjs` 现在用**同一次 ffmpeg 测量**（`astats,loudnorm` 串联）
     一起产出真峰值与采样峰值，并**对已达标成片做纯元数据对账**（只改 json、成片零改动、只在内容真变时落盘）
     ⇒ 该字段不再会陈旧。全库复扫 **43/43** 满足 `samplePeakDbfs ≤ truePeakDbtp`；
     其中 **25 份原本根本没有该字段**，已由工具按实测补上（补字段前这条约束在它们身上**根本不可检**）。
     ★ **精度陷阱**：`truePeakDbtp` 只存 2 位小数（loudnorm 口径）、`astats` 给 6 位 ⇒ 真峰值被**向下**舍入时
     采样峰值会「看起来」更高（实测 5 片：`ascii-crt`/`backrooms`/`paper-popup`/`rubber-hose`/`risograph`，
     差 0.0008–0.0037 dB，纯伪影、物理上并不违反）⇒ 工具落盘时把采样峰值**夹到真峰值以内**。
   · `selfCheck.loudness.peakNote` 与 `audioEvidence.measuredInFilm.*` 同样会陈旧（`paper-lantern` 的
     `lra 3.4 / truePeakDbfs −1.7 / astatsPeak6dp −1.668024`、`watercolor` 的 `lra 6.8` 已按实测更正）。
   ⇒ **重渲 / 重混后必须连这些字段一起复测**（`refresh-style-skill.mjs` 也不写它们）；
   改法与正文同源：**当前读数直接换实测值；历史读数保留原句 + 加 `原记` + 补现值**。
   ★ 另有两类**语法盲区**：`nb_frames=2922`（正则要求「数+帧」，等号写法看不见）、
   `mix.wav` 等**非本片产物**读数（按设计排除，不判 FAIL）。

### ★ 出片/重渲之后：反向更新文档

**这是长期循环的闭环，别忘**：

```bash
node D:/lemo-tools/scripts/refresh-style-skill.mjs --only <slug>   # 或 --all
```

它按**实测**回填 `generatedVideo` + `selfCheck.loudness`，并在**真峰值由超标变达标**时
自动在 SKILL.md 标「已修」。★ 反向情况（旧达标、新超标）它**只告警不自动写** ——
那需要你新增一条缺陷并定扣分档，属人工判断。

### ★ 控制台的注册表 / `_jobs/` 会跨运行累积：定期跑 `prune-jobs.mjs`（2026-10-07 立）

**为什么需要它**：控制台每出一个任务，就同时往三处落一份 —— 产物目录 `D:/lemo-films/_jobs/<任务id>/`、
注册表条目 `D:/lemo-films/.console/index.json`、日志 `.console/logs/<id>.jsonl`。这三处
**没有任何自动化在清**（核法见本条末），⇒ **只增不减**。后果不只是占盘：**注册表会被依赖它的测试读回来**
（`test/ui.test.mjs` 启动时 `loadHistory()` 读它、B7 又往它写批次标记）⇒ 积多了测试就**变脆**
（`test/ui.test.mjs` 的 B7 用例注释自述「失败的 B7 会把自己刚建的批次标记**留在 `.console/index.json` 里**，
成为下一次运行的毒点」—— 即「越跑越红」的自我投毒路径；本次审计实测注册表积到 **78** 条时该套转红、清到 **10** 条即转绿）。

```bash
node D:/lemo-tools/scripts/prune-jobs.mjs              # 默认**只报告（dry-run）**，不删任何东西
node D:/lemo-tools/scripts/prune-jobs.mjs --apply      # 确认无误后才真删（目录 + 注册表条目 + 日志）
node D:/lemo-tools/scripts/prune-jobs.mjs --keep 20    # 换保留条数（默认保留最新 10 个已结束任务）
```

语义（判据机械、可解释）：
- **只处理已结束的任务**（`endedAt` 有值，或 `status ∈ done/failed/canceled`），**绝不动 running/queued**；
- 按 `createdAt` 从新到旧，**保留最新 `--keep N` 个**（默认 10），其余为待清理；产物目录不存在时仍清注册表+日志；
- **三处一起清** —— 只删一处会留下「点进去 404」的僵尸任务或孤儿目录；
- ★ **安全闸**：待清理目录必须落在 `_jobs/` 内、且 `lstat` 判定**不是 junction / 符号链接**，
  否则跳过并 **exit 1**（本机踩过「junction 的 `rm -rf` 会穿透删真实目标」）；
- ★ **覆盖点 `LEMO_FILM_DIR`**（默认 `D:/lemo-films`，与 `lib/store.mjs` 的注册表根**同义**：
  注册表根 = `<LEMO_FILM_DIR>/.console`）⇒ 设它即可在**临时树**上非破坏地演练 `--apply`。

★ **核法**（本条断言「没有自动化在跑它」）：`ls .github .gitlab-ci.yml .circleci`（空）、
`ls package.json`（无）、`ls .git/hooks/ | grep -v .sample`（空）、
`Get-ScheduledTask | ? { $_.Actions.Arguments -match 'lemo|prune' }`（计划任务 **196** 个、命中 **0**）。
★ 现状：**需人工定期跑**（未挂任何自动触发；合适的挂载点需人工拍板，不擅自挂）。

### ★★ 重蒸馏之前：先过三道前置检查（2026-10-06 立，治「越修越坏」）

★ **病根**：`plan` 报出「待处理」**不等于**「该重渲」。本轮实测 33 个「待处理」里 **21 个是误标**
（产物齐全、只是台账 `fp` 为 null），真待办只有 12 个；而这 12 个若直接重渲，还会踩到
`dur.json` 缺失这个**更贵**的坑。⇒ 重渲**会覆盖已发布样板片**，动之前先把下面三道过完。

**① 先判「这次源码变更**是否影响画面**」—— 非视觉变更**不需要**重渲**

`plan` 的「源码已变更」是**内容哈希**判出来的，它**不知道**改的是什么。先看**改了哪一类文件**再决定：

- **进**指纹的（`scripts/style-scan.mjs` 的 `CODE_EXT` + `ROOT_EXTRAS`，核法 `grep -n "CODE_EXT\|ROOT_EXTRAS" scripts/style-scan.mjs`）：
  绘图代码 `.js/.mjs/.cjs/.ts/.html/.htm/.css` + 风格定义 `STYLE.md` / `DEMO.md` / `style.json`。
- **不进**指纹的（`DENY_DIRS` + 非代码扩展名）：`voices/**`（含 `dur.json`）、`*.json` 数据、`*.py`、`*.srt`、
  字体/素材 ⇒ 改这些**根本不会**让 `plan` 报变更。
- ★ **两类「进了指纹但不影响画面」**（实测遇到）：
  · **行尾归一**（`.gitattributes` 的 `* text=auto eol=lf`）⇒ **所有**被覆盖文件的哈希**一起**变
    ⇒ 看到「**全库 43 个一起变**」就是这一类，**不是**视觉变更；
  · `STYLE.md` / `DEMO.md` **纯文档**改动（进指纹，但只改文字）。

⇒ 判法：`node D:/lemo-tools/scripts/style-scan.mjs --json` 读 `changed[].changedFiles` 的**逐文件名单**，
只对**绘图代码**的重渲。

**② 重渲前必须确认 `demo/voices/dur.json` 存在 —— 否则出的是「兜底时长」片，是**倒退**不是修复**

`demo/*.js` 对它是**静默兜底**（实测 **34** 个风格文件出现该串，例 `styles/woodcut/demo/film.js:25`）：
```js
try { const r = await fetch('voices/dur.json'); if (r.ok) DURS = await r.json(); } catch (e) { }   // 未构建时留空表，用默认时长
```
它由 TTS 步产出（`core/tts/tts.py:56`、`core/tts/tts_indextts.py`，写 `out_dir/dur.json`），是**生成物、被 gitignore**。
⇒ `dur.json` 不在时重渲，整片按**默认时长**排时间轴 ⇒ **时长 / 字幕时间窗全变**，
新成片与已发布样板片**不一致**（**倒退**）。

★ 核法 + 实测（2026-10-06）：
```bash
ls D:/lemo-opuscar/styles/<slug>/demo/voices/dur.json
```
⇒ 全库 **43/43 都没有**这个文件（不是只有那 21 个缺）⇒ **当前任何风格重渲都会踩这个坑** ——
先把 `dur.json` 构建出来，再谈重渲。

**③ `fp:null` ≠ 未蒸馏 —— 它只说明「上次出片失败」**

`fp` 只在**渲染成功**时写（`scripts/style-distill.mjs` 的 `doRender`）⇒ 判「有没有蒸馏过」只能看**产物存在性**：
`lib/style-skills/<slug>/SKILL.md` + `_distill.json`（`plan` 已按此分流）。
★ 实测：43 个风格里 **21 个产物齐全而 `fp:null`** ⇒ 归「已蒸馏 · 台账缺指纹（上次出片失败）」、**未决（无法判定源码是否变更）**；
旧版把它们印成「未蒸馏（新纳入）」⇒ **凭空多报 21 个待办**。
★ 同源陷阱：`plan --backfill` 写的是**当前**指纹 ⇒ 会把「源码已变更」**洗白**成「已蒸馏且未变」
（真实变更从此在 `plan` 里消失）⇒ 它**默认拒绝**，要显式 `--force` 才写。

---

## ★★ 动「两侧副本共享的文件」（尤其 `core/`）之前：先查有没有并发批量作业（2026-10-06 真实事故）

★ **事故**：09:02 起**每日 09:00 的自动化批量出片**（`style-distill.mjs render --force`，38 个风格）正在跑，我**没查**就派子智能体去改 `core/render/mux.sh` 的 **WIN 侧** ⇒ 09:37:48 两侧 `core/` 分叉（WIN `e20a1230` 26506B / WSL `b8d9e683` 25632B）⇒ 编排器的「两侧 `core/` 一致」闸门**拒绝开工** ⇒ **该批 21 个风格全废**（19 个 A 类硬拒 + 2 个音频链被并发会话 SIGTERM）。根因：**派活前没看环境**。

**① 怎么查（改共享文件之前先跑）**
```bash
ls -lat D:/lemo-tools/_distill/render-run-*.log | head -2   # 批量总日志（日批写这里）
ls -lat D:/lemo-tools/_distill/logs/*.log | head -5         # 逐风格日志的最新 mtime
ls -la  D:/lemo-films/.*.lock                              # 编排器并发锁（锁名 = .<slug>.lock）
tasklist //FI "IMAGENAME eq ffmpeg.exe"                    # 有没有 ffmpeg 在跑
```
★ **判据**：**日志 mtime 在几分钟内** / **有 `.lock`** / **有 `ffmpeg.exe`** ⇒ 一律**判定「有并发作业」，不许动共享文件**。
（★ 坑：控制台端口文件在 `D:/lemo-tools/.console-port`，**不是** `D:/lemo-films/`；且它**退出时不删** ⇒ 存在 ≠ 在跑，
要确认真在跑用 `netstat -ano | grep <文件里的端口号>`。）

**② 判定「有并发作业」之后**
- **优先：等它排空** —— `_distill` 的批量**可断点续跑**（`render` 只重试未完成项），等它跑完零代价；★ 今天就是「不等」才废 21 个。
- **若必须现在动**：**改完立刻同步两侧**（改一侧 = 分叉 = 阻塞出片，**留窗口期就是直接废片**）：
```bash
cp /mnt/d/lemo-opuscar/core/render/mux.sh /home/lemo/lemo-opuscar/core/render/mux.sh
md5sum /mnt/d/lemo-opuscar/core/render/mux.sh /home/lemo/lemo-opuscar/core/render/mux.sh   # 两侧必须一致
```
  ⇒ ★★ 理由：编排器**要求两侧 `core/` 逐字节一致**（`lemo-make.mjs:1624` 核 `core/render`+`core/tts`+`core/lang`），不一致即打印 `两侧 core/ 不一致（N 处），已拒绝开工`。

**③ 已经分叉了怎么恢复**：★ **别自创修法** —— 编排器**自己会打印处方**（`lemo-make.mjs:1680-1683`）：
`find . -type f \( -name \*.py -o -name \*.mjs -o … \) | while read f; do tr -d "\r" < "$f" > /home/lemo/lemo-opuscar/core/"$f"; done` —— **照它打印的处方逐字做**，重跑即可。

★ **教训**：**「派活前先看环境」和「改完立刻验证」是同一件事的两半**。

---

## ★★ 派活前：任务书里的「环境事实」必须附核法（2026-10-06 立，治「凭印象写环境事实」）

★ **病根**：派活的人在任务书里写「环境事实」时凭印象，而不是先跑一条命令核实 —— 最近三轮错 **3 次**（都被子智能体纠正、没造成损失）；更早一轮的同类错误（**没查并发作业**就派人改 `core/`）**直接废掉 21 个风格**（事故形态见 `:417-444`）。

★ **判据**：任务书里凡出现 **文件路径 / 行号 / 函数名 / 进程 / 端口 / 存在与否 / 谁读谁** 这类断言 ⇒ 一律算「环境事实」，**必须写明「用哪条命令核出来的」**；★ **反例**（不算环境事实、不必核）：**设计意图**、**要求**、**判断标准**、**已知的通用知识**。

**照抄这一格（写进任务书）**
```markdown
【事实核实记录】每条环境事实 = 断言 + 核法 + 实测
  断言：`measure_film` 在 `core/render/mux.sh:226`
  核法：grep -n measure_film core/render/mux.sh
  实测：226:measure_film() {          ← 贴真实输出，不是「应该在哪」
```
★ 若环境事实含「**有没有并发作业**」⇒ 核法见 `:417-444`（4 条命令 + 判据），**不在此重抄**。
（`:417-444` 自身可核：`grep -n '两侧副本共享的文件' _distill/AGENT-BRIEF.md` ⇒ `417:`）

**反例 → 正例（今天真实错的这三条，核法都跑过）**

| 错的写法（凭印象） | 核过之后的写法（断言 + 核法 + 实测） |
|---|---|
| 读 `voices` 的是 `hologram-hud` | 读取者不止一个，**别点名**：`grep -rl "voices" --include=*.py D:/lemo-opuscar/styles/*/demo/` ⇒ **84** 个 .py（同一条 `-rn` 出行号：`game-show/demo/music.py:24`、`living-screencast/demo/sound.py:200`） |
| 控制台端口文件在 `D:/lemo-films/.console-port` | 在 `D:/lemo-tools/.console-port`：`grep -n console-port server.mjs` ⇒ `60:const PORT_FILE = path.join(__dirname, '.console-port');` |
| 该文件存在 ⇒ 控制台在跑 | **存在 ≠ 在跑**：`grep -n 不删 server.mjs` ⇒ `2070` 明写「这两个文件退出时**不删**」（另 `:52` 注释同旨）⇒ 判在跑只能看监听：`cat D:/lemo-tools/.console-port` ⇒ `3764`、`netstat -ano \| grep ":3764 "` 命中 **0** |

★ **教训**：任务书里的每个 `file:line` 都会被下游当**事实**用 —— **没核法的断言 = 让子智能体把时间花在纠错上**（今天这三条全是这么被纠回来的）。

---

## 纪律（红线）

1. **不许编造**：任何参数、色值、耗时、帧号都要来自你读过的文件或帧图。写不出来就写「未知」。
2. **不许逐帧复刻的承诺**：目标是**对齐特质、复用制作思路 / 视觉元素 / 编排手法**，不是还原样本画面。
3. **不改** `lemo-make.mjs`（红线：编排器不能被改）、不改 `D:/lemo-opuscar` 下的源码
   （除非你在第 11 节里明确记录了「为补齐短板做了什么」并且改动极小、可回滚）。
   ★ **这条拦的是「悄悄改编排器」，不是「编排器永远不许变」**：若确实**有意**给编排器加了正式功能，
   `test/cases.mjs` 的 `ORCH_MD5` 与 `test/README.md` 那张表**两处必须一起更新**（否则下一个人会以为红线坏了）。
   最近一次有意改动：**2026-10-07** 接上 risograph 的 `tools/video_png.mjs`（**换渲染器**：PNG 无损中间片，
   网点色不被 JPEG 4:2:0 吃掉；做法 = 先给该脚本补 `--size`（照 `core/render/page.mjs` 的 `takeSize` 同源），
   再在编排器渲染段做候选探测 `demoRenderRel`（**不写死 slug**）；另补一处**副本漂移**：
   `video_png.mjs` 的拼接 `execFileSync` 漏传 `stdio:['ignore','inherit','inherit']`（core 版有），
   而本机 `spawnSync` 走 pipe 一律 EBUSY ⇒ 不改就 960 帧全渲完在拼接处 exit 1；
   同步 `runs[]` 加该项、`ORCH_SKIP_STEPS` 移除该项，
   `58e2bcbae682b4167444f0dd66445771` → `315887dd9e38702bb057e02f38a97b54`）。
   ★ **2026-10-07 再改一次**（纯注释）：`lemo-make.mjs` 里引 `core/tts/asr_check.py:116` 的那句**是失效引用**
   （`:116` 实为 `return 'offline'`；真正写 `words.json` 的 `json.dump` 在 **`:168`**）⇒
   按引用纪律第 12 条**改成符号锚**，从此不再随行号漂。md5 `315887dd…` → **`6283aadb98433b16ea2a35c2a754cd30`**。
   再上一次：**2026-10-06** 补上 art-deco 漏跑的变调步 `tools/pitch.py`（`dfa990…` → `caab495…`），
   并把「build.sh 有、编排器不跑」的步骤做成起飞前检查可报的 `ORCH_SKIP_STEPS` 登记表。
   ★ **若你确实动了 `D:/lemo-opuscar` 下任何文件 ⇒ 改完立刻同步两侧**（改一侧 = 分叉 = 阻塞出片，
   **留窗口期就是直接废片**）：
   ```bash
   cp /mnt/d/lemo-opuscar/core/render/mux.sh /home/lemo/lemo-opuscar/core/render/mux.sh
   md5sum /mnt/d/lemo-opuscar/core/render/mux.sh /home/lemo/lemo-opuscar/core/render/mux.sh   # 两侧必须一致
   ```
   ⇒ ★★ 理由：编排器**要求两侧 `core/` 逐字节一致**，不一致即拒绝开工、直接阻塞出片
   （事故形态与排查/恢复法见 `:417-444`）。
4. **不并发**：不要自己起渲染或 TTS（GPU / Index-TTS 都是独占资源）；★ **改共享文件之前也要先查有没有别人在跑**
   （见 `:417-444` 的「动两侧副本共享的文件之前」—— 今天就是没查，废了 21 个风格）。
5. 只写 `<slug>` 自己的目录，不碰别人的。
6. ★ **不要再写「硬编码 slug 表」的一次性补丁脚本** —— 历史上 `sync-tp-docs.mjs`（写死 18 个 slug）与
   `patch-tp-prose.mjs`（写死 7 个锚点）就是这样，**换个风格就得手改**。
   通用入口是 **`refresh-style-skill.mjs`**：要改「出片后回填 + 标已修」的逻辑就改它一个。
7. ★ **改过成片之后，LRA 也会变**（压限会收窄动态，实测 `shadow-puppet` 9.1 → 7.1）
   ⇒ 重混/重渲后**必须重测 LRA**，不能只更新真峰值。跑 `refresh-style-skill.mjs` 会自动做。
8. ★ **出片前会先查显存，不够会自动腾挪**（`lib/vram.mjs`，插在 `dub.mjs` 的 TTS 之前与
   `core/render/video.mjs` 的渲染之前）。它只在**不足时**才动别人的模型，够用时**零输出**；
   真腾挪了会打 `[vram] ...` 日志（腾了什么、腾出多少）。相关环境变量（详见 `test/README.md`）：
   `INDEXTTS_MIN_FREE_MIB`（默认 6700，与 `core/tts/tts_indextts.py` 同一个变量，`0` = 两边都关）、
   `LEMO_RENDER_MIN_FREE_MIB`（默认 3000）、`LEMO_NO_VRAM_FREE=1`（只查不腾）、
   `LEMO_VRAM_DEBUG=1`（够用时也打读数）。★ 你**自己不要去起渲染或 TTS**（见第 4 条），
   所以正常情况下看不到这些日志；看到 `显存不足，拒绝继续…` 就说明**真的缺显存**，
   按它给的「两条出路」办（别设 `LEMO_NO_VRAM_FREE=1` 绕过 —— 那只会把静默挂死还回来）。
   ★ **2026-10-07 更新：不足文案里多一段 `GPU 占用者:` best-effort 诊断**（`gpuOccupants()`，跑 `nvidia-smi --query-compute-apps=pid,process_name,used_memory`，按**进程名**聚合成「名字 × 个数」，最多 6 行、附一个示例 pid）。**由来**：原先只说「差多少 MiB」+「LM Studio 没有常驻模型可卸」，运维必须**手工**跑 `nvidia-smi` + `tasklist` 才知道真相 —— 当天实测是**另一个项目**的 3 个 `chrome-headless-shell` + 桌面浏览器占着，而原文案里「最常占的是浏览器」只是**猜**的。★ **只报名字与个数、绝不报 MiB**：本机是 **WDDM**，`used_memory` 一律 `[N/A]`（实测），报 MiB 就是编；文案里也印了这句说明，免得读者以为这是完整信息。★ 并明确提示「若其中有**别的项目**的进程（不是 lemo 的）**不要杀** —— 要么等它跑完、要么用 ② 显式放行」。★ **纯诊断、零判据改动**：门槛 / `relax` / `onShort` / 通过-拒绝判定 / 函数签名**全部未动**；**够用时输出逐字节不变**（实测 md5 相同，带不带 `LEMO_VRAM_DEBUG` 都比过）；`nvidia-smi` 查询失败 / 超时（5s）/ 退出码非 0 / 解析不了 ⇒ 这一段**整段消失、逐字退回原文案**，**不抛异常、不改退出码**。★ 这是**有意给编排器通路加可运维性**，`lemo-make.mjs` 本身**未动**。
9. ★ **Index-TTS 的四个「内层读」配置走 argv，不是环境变量**（2026-10-05 实测）。
   `core/tts/tts_indextts.py` 是两层结构（外层 + 内层 Windows venv python），而
   **WSL→Windows interop 完全不传环境变量** ⇒ 外层把 `INDEXTTS_ENGINE` / `INDEXTTS_QUANT` /
   `INDEXTTS_DEVICE` / `INDEXTTS_MIN_FREE_MIB` 翻译成 `--engine=` / `--quant=` / `--device=` /
   `--min-free-mib=` 交给内层（映射表 `INNER_OPTS`）。在 **WSL 里 export** 或设 **Windows 环境变量**
   都有效；生效值打在内层 `内层配置 —— …` 行上（一眼可核对）。非法值**明确报错**：
   `ENGINE` 只认 `v2_5`/`v2`，`MIN_FREE_MIB` 非整数或为负 ⇒ 非 0 退出（不静默回落）。
   `HOME`/`APP`/`PYTHON`/`REF_DIR`/`VOICE_LIB`/`TIMEOUT`/`STALL_TIMEOUT`/`LOCK*` 则是**外层读**，
   在 WSL 里 export 即有效。
10. ★ **机制性断言必须先证存在、再写进文档**（2026-10-06 立，治「凭印象写机制」）。凡在 `SKILL.md` 或
   `_distill.json` 里声称某个**机制存在**（「页面外壳等比装入、不裁切」「已实渲复核确认 X」「某函数做了 Y」），
   都算**环境事实** ⇒ 必须先用 `grep` / `git log` / 实渲探针**证其存在**，并把**核法命令 + 实测输出**
   一并写进该处（写证据，不是只写结论）。★ 事故：`lib/style-skills/pixel-rpg/SKILL.md` 曾声称
   「页面外壳等比装入（contain）不裁切」，而该外壳**从未实现** —— 核法
   `grep -n "viewport\|resize\|aspect" styles/<slug>/index.html`（0 命中 ⇒ 无外壳）+
   `git -C D:/lemo-opuscar log --oneline -- styles/<slug>/index.html`（单笔 ⇒ 无后续适配提交）即证伪；
   实渲探针另证 9:16 下左上 1080×1080 裁切与 16:9 **逐字节相同**（= 裁切，非 contain）。
   ★ 判据：**没有核法的机制断言 = 编造**（同第 1 条）。
11. ★ **行号引用优先写「符号名 / 节标题」，不写 `<文件>:<行号>`**（2026-10-06 立，治「散文里插一段 ⇒ 后面行号全废」）。
   本会话**连撞三次**同一形态：只要有人在被引文件**上方插/删行**，所有指向它的 `<文件>:<行号>` 就**静默失效**。
   ★ 尤其**散文**（`DEMO.md` / `STYLE.md` / `MAINTAINING.md`）——**插一段就整体下移**：实测
   `styles/art-deco/DEMO.md` 插了 2 行 ⇒ `lib/style-skills/art-deco/SKILL.md` 的 5 处 pitfall 引用
   （`:61 :164 :171 :175 :176`）**全部错位**，而**修之前 5 个闸门全是 exit 0**。
   ★ 写法：优先引**节标题**（`` `DEMO.md` 的「Pitfalls tied to this demo's props」段 ``）或**函数名/符号名**
   （`` `engine/wb.js` 的 `INK` ``、`` `scr()` ``、`` `measure_film()` ``）—— 这类锚**不随行号漂**。
   ★ 若确实要写行号：**改完被引文件必须回头 grep 一遍所有指向它的行号引用**（不是只 grep 你刚改的那处）：
   `grep -rn "DEMO\.md:[0-9]" D:/lemo-tools/lib D:/lemo-tools/_distill D:/lemo-opuscar --include=*.md`，
   再逐条 `sed -n '<n>p' <被引文件>` **看内容对不对**。★ **别机械按「插了几行」加减**：实测同一批引用的
   真实位移与「插入行数」可以差 1，而**差一行的引用照样指向另一句读得通的话** ⇒ 最难发现。
   ★ **别把 `check-ref-lines.mjs` 当充分判据**：实测它扫 **3795 处**引用，其中只有 **38 处（≈1%）**
   进入 (c) 内容比对，其余只查「文件在不在 / 行号超没超范围 / **那一行有没有内容**（(d)，2026-10-06 补）」⇒
   **「行号移位但仍在范围内」这一类它只抓得到「漂到空行 / `---` / 围栏 / 幻影行」那个子类**
   （(d) 实测抓出 **13 处**、逐条人读**全是真失效**），**漂到另一段正文上的它仍然一处都抓不到**。它只筛「明显失效」，
   不是「引用正确」的证明。
   ★★ **2026-10-07 补两条实操策略**（治「明明知道这条纪律，还是踩了」）：
   · **① 顺序要反过来：先查、再改**。改任何「被其它文档按行号引用」的文件**之前**，先拿到引用清单：
     `grep -rn "<被改文件名>:[0-9]" D:/lemo-tools/lib D:/lemo-tools/_distill D:/lemo-opuscar --include=*.md`
     —— **清单为空才敢随便加行**。实测 `styles/paper-popup/DEMO.md` 被 `lib/style-skills/paper-popup/SKILL.md`
     **按行号引用了 17 处**（`:29 :31-40 :46 :50 :68 :70 :74-77 :79 :80 :82 :84 :87-90 :89 :135-158 :163`）⇒
     给它**加 3 行**说明，本闸门**立刻 exit 1**（报 `SKILL.md` 的 `:38` 引的那个 `DEMO.md` 行号变成空行）。
     ★ 注意本条**刻意只写 `:NNN`、不写文件名**：本文件也在扫描范围内，写全「文件名+行号」会**当场变成一条真引用**
     （2026-10-07 实测：写全后本闸门 exit 1，因为裸 `DEMO.md` 相对库根解析不到）。**要写就写完整可解析路径**。
   · **② 首选「单行内联」，不要「另起几行」**。同一处改动的两种写法，代价完全不同：
     加 3 行 ⇒ 17 处引用全要重算；**压成 1 行内联** ⇒ **行数不变、引用零漂移、闸门直接绿**。
     ⇒ 遇到「想在散文里补一段说明」时，**先问能不能塞进原行**（用 `——`/`；`/`（…）` 接在原句后面）。
     只有**确实必须加行**时才动结构，并且**当轮就把那 17 处引用一起改完**。
12. ★ **凡写 `<文件>:<行号>`，一律「反引号包裹 + 带目录的完整路径」，两个条件缺一不可**（2026-10-07 立，
   治「裸引用 ⇒ 闸门看不见 ⇒ 静默漂移」）。第 11 条讲「优先写符号名」，**这一条是它的兜底**：
   确实要写行号时，写成 `` `core/render/mux.sh:36` `` 这种形态（反引号 + 目录）。
   ★ **为什么必须加反引号**：`check-ref-lines.mjs` 的解析器是**启发式**的，**只认反引号包裹**的引用
   （见该闸门「已知局限」第 2 条）—— 写在正文里不加反引号的 foo.js:12（**这一串故意不加反引号**，
   闸门就真的看不见它）**一律不被计数、不被核对**。实测（2026-10-07，43 份 `_distill.json`）：
   **裸引用 378 处**，而闸门当时只看得见 **17 处**（**23 倍**之差）⇒ 那一大片引用**长期零覆盖**。
   ★ **补上反引号当场就现形**：378 处逐批补反引号（每批都跑闸门贴前后对照），**暴露 10 处「行号漂移」的真失效**
   （逐条 `sed -n '<n>p' <被引文件>` 核过被引行内容；另有 1 处只补了目录、**内容仍对不上**，已单列上报），例如 `pictogram-motion/_distill.json` 的
   `core/render/mux.sh:23`（`GR="${5:-2}"` 实在 **36**）、`demo/mux.sh:12`（`noise=c0s=4` 实在 **19**）、
   `hd-2d/_distill.json` 的 `mux.sh:60`（`LN_TP=…-1.7` 实在 **94**）、
   `paper-lantern/_distill.json` 的 `lib/style-dna/paper-lantern.md:34`（「镜头表 20 段」实在 **280**）。
   ★★ **这四条判据一条都抓不到它们**：行号**在范围内**、被引行**也有内容**，只是**内容不是它说的东西**
   （正是第 11 条末尾说的那个缝）。**是「补反引号」这一步让它们现形的**，不是闸门变聪明了。
   ★ **为什么必须带目录**：只写 basename 时闸门会按**文件名**解析到**同名的错文件**。实测
   只写 basename 的 `mux.sh:115` 就被解析到**本风格 demo 里的那份**（22 行）⇒ 假报「行号超范围」，
   而正主是**同一段上文自己写了全路径**的 `core/render/mux.sh`（`noise=c0s` 在 **173**）。
   **同名多义 ⇒ 必须带目录消歧义**（`styles/<slug>/demo/` 下几乎每个风格都有一份 `mux.sh`）。
   ★ **盘符绝对路径（`D:/…`）连反引号也救不了**：闸门正则是**锚定**的，实测
   `D:/lemo-tools/scripts/x.mjs:52` 判 **NOT-RECOGNIZED** ⇒ 补了反引号**依然不被计数**（还是静默）。
   ⇒ 引用**只写仓内相对路径**（`scripts/unblock-placeholder-audio.mjs:52`），**别写盘符**。
   ★★ **别指望闸门直接把裸引用纳入 —— 这条路已实测否决，别再试**：按 (a)(b)(d) 判
   命中 3 / **误报 2（精度 ≈ 33%）**，且失败是**结构性**的 —— 裸引用拿不到「同小句路径感知」
   （`siblingPaths` **只收反引号片段**）⇒ 只写 basename 的裸引用必然解析到错文件。
   **所以「让引用可见」只能靠写作侧统一**（就是本条），**改判据没用**。
   ★ 自查：写完 `_distill.json` / `SKILL.md` 后把候选引用列出来，逐条看**有没有落在反引号外的** ——
   `grep -rnoE '[A-Za-z0-9_/.-]+\.[a-z]+:[0-9]+' <你改的目录>`，在反引号外的就是漏网的裸引用。
   ★★ **2026-10-07 又一例（#7，`lib/dub-visual.json`）——「闸门只筛明显失效」的实测量化**：
   把**第二个数据文件**（证据层）纳入扫描后，**16 处引用**首跑命中 **10 处 FAIL**（(b) 6 + (d) 4）、
   **误报 0 ⇒ 精度 100%**；而**同一份文件里还有 7 处闸门根本抓不到**的真失效 —— **6 个 `injectionApi` 的
   `evidence` 系统性指到「行号在范围内、那一行也有内容」的任意行**（**不是**该注入 API 的 setter 定义行），
   外加 1 个 ukiyoe 的 `cartouche` 指到 `print.js` 的**注释行**。
   ⇒ ★★ **「引用失效 0 处」永远不等于「引用全对」**：`(a)(b)(c)(d)` 只覆盖「明显失效」那一层，
   「**漂到另一段正文上**」的那一层**只能靠人读 + 符号锚**。**每纳入一个新语料，都要留出人工读的预算** ——
   这 7 处就是这么读出来的（10 : 7，**闸门漏掉的比例接近一半**）。
   ★ 同轮还实测到**第二个形态**：「路径指到 **12–21 行**的页面契约加载器 `main.js`、**真身在 `film.js`**」
   （4 个 demo 共 6 处）—— 这类闸门**抓得到**（行号超范围），但**根因是文档作者把 `main.js` 当成了影片本体**；
   ⇒ 修引用时**别只改行号，要连路径一起改对**（`main.js` → `film.js` 才是真目标）。

13. ★★ **「补现值」必须**真换行**——只追加不换行 = 假绿**（2026-10-07 实测，`pictogram-motion`）。
   `scripts/check-tp-prose.mjs` 的 ⑤ 历史语境豁免（`HIST && !CUR`，`:409`）看的是**物理行**。
   ⇒ 你在带「原记 / 已修 / 修复前」的行里**只追加**一句「当前入库成片实测 `−1.63 dBTP`」而**不换行**，
   该行**仍然带 HIST** ⇒ **整行照样被豁免** ⇒ **新补的值一次都不会被核**。
   ★ **变异测试实证**：把 `pictogram-motion` 那 6 处里的 `−1.63` 改成 `−9.63`（复制到夹具树、跑**真闸门**）⇒
   输出 `陈旧读数 0 处` —— **一处都没抓到**。⇒ 那份「补现值」**白补**。
   （对照：`blueprint` / `risograph` / `halftone-dossier` / `watercolor` / `engraving` 的**真拆行**同样手法扰动 ⇒ 分别抓到 3 / 2 / 1 / 1 / 2 处 ⇒ **那些是真生效的**。）
   ★ **正确姿势**（原句一字不改 + **当前值单独占一行**、且该行**不含任何 HIST 词**）：
   ```
   …原句（带「原记/已修」）…
   > ★ 2026-10-07 复测当前入库成片真峰值 **−X.XX dBTP**（`loudnorm` 的 `input_tp`，4× 过采样；核法见 `_distill.json` 的 `selfCheck.loudness.truePeakDbtp`）。
   ```
   ★★ **自证法（必做）**：把新值**临时改错** ⇒ 跑闸门 ⇒ **必须报出它** ⇒ 再还原。**不报 = 假绿 = 没修**。
   ★ 表格行拆不了（拆了就坏表）⇒ 改在**表格下方的正文**补一行，并在那行写清是哪个表的哪个值。
   ★ 仍有一类**够不到**：当前值嵌在「**已修：X → Y**」子句**中间**时，拆在 Y 前仍带「已修」、拆在 Y 后会把历史值 X 暴露成假阳性
   ⇒ 这类**只能**用上面「原句不动 + 另起一行」的手法。


---

## ★ 孤儿脚本审计的口径与判据（2026-10-07 立，供以后每批复用）

**一句话**：判活只认「**全路径语义引用 ∪ 库语义段 ∪ `lib/**` 代码**」这三条**硬证据**，外加「**外部文档 / 编排器 / 同风格构建链**」三条；**`style-fingerprints.json` 只列不判**；「脚本头自述」是**弱证据**，单独立「**自述入口**」一类。

### 一、判据清单：六条「活着」证据（任一命中 ⇒ 活）

| # | 证据 | 核法（要点） | 为什么 |
|---|---|---|---|
| E1 | **全路径语义引用** | **代码里**（★ **排除注释**，见 §五 陷阱⑥）按 `styles/<slug>/demo/<rel>` 全路径出现（`import` / `require` / `execFileSync` / `<script src=` / 动态 `?scene=` 分派） | 最硬：有人真的加载它 |
| E2 | **库语义段引用** | `lib/dub-visual.json` / `lib/dub-styles.json` 的 `sourceFiles` / `evidence` / `notes` 里按全路径或语义提到它 | 主线给下游的「视觉 / 风格」契约，删了就断链 |
| E3 | **`lib/**` 代码引用** | 同上但目标是 `lib/**` 的**任意类型**（★ **含 `.json`**） | 见 §五 陷阱① |
| E4 | **外部文档提及** | `styles/<slug>/DEMO.md`、`styles/<slug>/STYLE.md`、`lib/style-skills/<slug>/SKILL.md`、`lib/style-dna/<slug>.md` 或同名 `.json` | 「**他证**」：别人写下来了 |
| E5 | **编排器引用** | `lemo-make.mjs` 的 `runs[]` / `ORCH_SKIP_STEPS`（按**相对路径**匹配，**不含 slug**） | 编排器认得 ⇒ 已知的可选步 |
| E6 | **同风格构建链** | 同风格 `build.sh` / `mux.sh` / `mix.py` / `render.mjs` 调它 | 出片链上的一环 |

★ **E6 的延伸：「约定式引用」必须显式处理**（否则**系统性误判**）。有的「引用」不是字面路径，而是**命名约定**：
- `lib/aspects.mjs` 扫 `demo/film*.js` ⇒ **每个风格的 `film.js` 都活**（哪怕页面根本不 import 它 —— 它只放 `FILM_META` 画幅声明）；
- `lib/originality.mjs` 扫 `subjects/*.js`；`lib/style-skills/impasto/SKILL.md` 与 `lib/style-dna/impasto.md` 声明 `scenes/*.js`；
  `pictogram-motion` 的 `poses/*.js`；`paper-lantern` 的 `src/shots/sNN_*.js`；
- `scripts/check-mux-parity.mjs` 扫 `styles/*/demo/mux.sh` 与 `styles/*/demo/tools/mux.sh`。
  ★ **第二段（2026-10-07 补）：`lib/style-skills/<slug>/_distill.json` 的 `muxPatch`**（实测**只有 `backrooms` 有**；7 条字段路径此前**零覆盖**）：
  判 `script`（补丁脚本）与 `patchedFile`（被补丁的文件）**存在** ＋ `patchedFile` **仍带补丁标记**（容忍写法：认 `本地补丁（…回灌 core/render/mux.sh）──`）
  与**补丁体**（`apad=whole_dur` / note / `h264_nvenc -preset p5 -profile high -rc vbr`）⇒ 未被静默回退。
  `reason` / `appliedAt` / `revert` / `verifiedBefore` / `verifiedAfter` **只列不判**（实测 `verifiedAfter` **是散文、不是校验值**）。
  覆盖点 `LEMO_DISTILL_ROOT`。**已知（只列不判）**：`backrooms/demo/tools/mux.sh:40` 的标记被手改成含「保留，」，
  与补丁脚本 `const MARK` 不一致 ⇒ **其幂等判定 `applyPatch` 在该文件上失效**（实测因找不到 `libx264` 片段而跳过、不写坏文件）。
⇒ **只做字面 token 匹配会把这批全判成「无引用」**（实测：不做约定匹配 ⇒ **90 条假「无引用」**；做了 ⇒ 只剩 **50 条**真候选 = 45 已声明入口 + 5 自述入口）。

### 二、两条弱证据（单独**不足以**判活）

| # | 弱证据 | 处置 |
|---|---|---|
| W1 | **脚本头自述**（`usage` / docstring / `# 用法：…`） | ⇒ **自述入口**：保留，但**强制标注「无外部引用」** |
| W2 | **仅注释引用**（只在别的脚本的 `//` / `#` 里被提到） | ⇒ 同上，按自述入口处理 |

★ **为什么必须把 W1 单独立类**：实测「**配乐自检**」子类（`music/analyze.py`、`music/check.py`）**确实有用**，但它们**没进任何外部文档** ⇒ 收紧成「只有外部文档提及才算」会**误杀**；反之「**一次性调试草稿**」子类（两个 `vo_try.py`）放宽口径时又会**漏**。⇒ **四分类**就是这两个方向误差的折中。

### 三、★ 指纹降级：`lib/style-fingerprints.json` **只列不判**

它是**全树 hash 登记**（按 slug 分组，逐个文件记 sha256），**不是「使用引用」**。实测登记率（2026-10-07）：
`.mjs` **54/54 = 100%**、`.js` **440/444 ≈ 99%**、`.cjs` **1/3 = 33%**、`.py` **0/175 = 0%**、`.sh` **0/57 = 0%**。

⇒ 若把「被它登记」当成「有引用 ⇒ 活」，会**自动豁免整个 JS 类**（≈99%），而**孤儿恰恰多在 JS 页面模块里**。
⇒ **判活只认 E1∪E2∪E3；指纹命中只在清单里当「参考列」列出，不进判据。**
★ 实测复核：本批 733 条里「**仅靠指纹才活**」的 = **0 条**（降级后判据没塌）。

### 四、「手工入口」四分类口径（★ 已采纳）

`活 / 已声明入口 / 自述入口（保留但强制标注）/ 孤儿`，把「**自述入口**」**排除在「已声明」之外**。

| 分类 | 判据 | 处置 |
|---|---|---|
| **活** | E1–E6（含约定式）任一 | 保留 |
| **已声明入口** | **他证**：E4 外部文档提及 | 保留 |
| **自述入口** | **自证**：仅脚本头 usage/docstring 自述，**无外部文档提及**、无代码/数据引用 | 保留 + **强制标注「无外部引用」** |
| **孤儿** | 三者皆无 | 只登记，**删不删由人决定** |

★ **若收紧成「只有外部文档提及才算」⇒ 新产生 5 条孤儿**（实测，误报全集中在「**配乐自检**」子类）：
`cel-anime-80s/demo/music/analyze.py`、`dark-keynote/demo/music/check.py`、`hologram-hud/demo/music/check.py`、
`living-screencast/demo/tools/vo_try.py`、`whiteboard/demo/tools/vo_try.py`（后两条是「**一次性调试草稿**」子类，放宽口径就会漏）。

### 五、★ 结构性陷阱（不处理就会系统性判错）

**① 判据盲区：库级引用必须扫 `lib/**` 全类型（含 `.json`）。**
上一批的「库级引用」用 `--include=*.mjs` ⇒ **`lemo-tools/lib/*.json` 一个都没进判据**。受害者实测 **2 个**：
`styles/pixel-rpg/demo/pixel.js`（被 `lib/dub-visual.json` 的 `sourceFiles` 全路径 + `evidence` 引用）、
`styles/microgame/demo/frames.js`（同上，被 `styles.microgame.sourceFiles` 引用）。
⇒ 核法**必须**带 `--include=*.json --include=*.mjs --include=*.js --include=*.py --include=*.sh --include=*.html`，**别只写 `.mjs`**。

**② 同名不同物 ⇒ 任何按文件名统计的结论都不可信。**
`words.py` 全库 **4 份**（行数 21 / 19 / 7 / 21、语义各不相同）、`check.py` **3 份**（2 份配乐自检 + 1 份 161 行的另一物），
`sheet.py` / `sheet.sh` / `probe.mjs` / `shot.mjs` / `frames.js` / `subs.py` / `subs.mjs` / `final_asr.py` / `score.py` / `mix.py` **全都有多份**。
⇒ **只按 basename 匹配会串味**；**必须**「全路径 ∪ 同风格作用域」双条件。
★ 附带的结构性事实：**8 个风格没有 `build.sh`**（`brick-toy` / `cel-anime-80s` / `game-show` / `halftone-dossier` / `hd-2d` / `paper-popup` / `pictogram-motion` / `watercolor`）⇒「同风格 shell 调用」这条判据对它们**结构性失效**，**必须**靠 E1–E5 兜底。

**③ 相对路径 import 必须解析**（否则**成批**误判）。
`import { SHOTS } from './shots/index.js'` 里的 token 是 `shots/index.js`，而脚本的相对路径是 `src/shots/index.js` ⇒ **不解析就匹配不上**。实测受害者成批：
`styles/paper-lantern/demo/src/shots/index.js`、`styles/paper-lantern/demo/src/people.js`、`styles/paper-lantern/demo/src/props.js`（被 `src/shots/*.js` 以 `../people.js` 引用）。
⇒ 建索引时**必须**对以 `./` / `../` 开头的 token 做「相对所在文件目录」的解析，再把**解析后的仓内相对路径**当键。

**④ Python 的 `import` 不带扩展名**。
`game-show/demo/music.py` 写 `import synth_lib as S` ⇒ token 是 `synth_lib`（**没有 `.py`**），而脚本是 `synth_lib.py` ⇒ **不专门处理就漏判**（实测 `styles/game-show/demo/synth_lib.py` 就这样被漏成「无引用」）。
⇒ 建索引时**必须**对 `.py` 文件额外抽 `^\s*(from|import)\s+<mod>` 并**补一条 `<mod>.py`**（含相对目录解析）。

**⑤ shell 变量前缀会被吃进 token**。
`node "$D/tools/dump_timeline.mjs"` 里的 token 是 `D/tools/dump_timeline.mjs`（`$` 不在 token 字符集内，`D` 被当成了首段）⇒ **整批 `build.sh` 调用都匹配不上**。
实测受害者：`styles/impasto/demo/tools/dump_timeline.mjs`（`build.sh` 明写 `node "$D/tools/dump_timeline.mjs"`）等**多个风格的同名脚本**。
⇒ 建索引时**必须**对「首段 ≤3 字符且全大写」的 token **补一条去掉首段的键**（`D/tools/x.py` → `tools/x.py`）。

**⑥ 「被别的脚本注释提到」≠「有引用」**（必须做**近似注释剔除**）。
`lemo-make.mjs` 的**注释**里裸提 `words.py`（`:507` 附近的候选说明、`:2506` 的小节标题）⇒ 若不做注释剔除，**每个**风格的根级 `words.py` 都会被误判成「编排器引用 ⇒ 活」。
实测受害者：`styles/paper-lantern/demo/words.py`、`styles/paper-popup/demo/words.py`（真身是**一次性调试草稿**，编排器只探 `tools/words.py`）。
⇒ 判据**必须**区分「代码里出现」与「注释里出现」：**只有代码里出现才算 E1/E5**；注释里出现的降级成 **W2**（`comment-only` ⇒ 自述入口）。

### 六、可直接复制的核法

```bash
# 0) 枚举（基线 733；排除产物目录）
find D:/lemo-opuscar/styles/*/demo -type f \( -name "*.py" -o -name "*.mjs" -o -name "*.js" -o -name "*.cjs" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" -not -path "*/out/*" -not -path "*/stills/*" | wc -l

# 1) E1+E3 全路径语义引用（★ 必须全类型、含 .json —— 见陷阱①）
grep -rn "styles/<slug>/demo/<rel>" D:/lemo-tools/lib D:/lemo-opuscar \
  --include=*.json --include=*.mjs --include=*.js --include=*.py --include=*.sh --include=*.html

# 2) E2 库语义段
grep -rn "<rel>\|<base>" D:/lemo-tools/lib/dub-visual.json D:/lemo-tools/lib/dub-styles.json

# 3) E4 外部文档（他证）
grep -rn "<rel>\|<base>" D:/lemo-opuscar/styles/<slug>/DEMO.md D:/lemo-opuscar/styles/<slug>/STYLE.md \
  D:/lemo-tools/lib/style-skills/<slug>/SKILL.md D:/lemo-tools/lib/style-dna/<slug>.md

# 4) E5 编排器
grep -n "<rel>" D:/lemo-tools/lemo-make.mjs

# 5) 指纹（★ 只列不判）
grep -n "demo/<rel>" D:/lemo-tools/lib/style-fingerprints.json
```

★ **上面 5 条 `grep` 只是「最小核法」**：它们**看不出** §五 的 ③④⑤⑥（相对 import / Python 无扩展名 import / shell 变量前缀 / 注释剔除）——
要得到本批那份 733 行清单，需要**一个能解析相对路径 + 抽 Python import + 补 shell 变量键 + 近似剔除注释**的小脚本（本批用 Node 写了约 120 行；口径就是本节 §一–§五）。

★ **2026-10-07 基线**（供回归对比）：**733 条 ⇒ 活 683 / 已声明入口 45 / 自述入口 5 / 孤儿 0**。
完整清单见 `_distill/孤儿脚本清单-2026-10-07.md` + 同名 `.tsv`（机器可核对）。
★ 重跑前**先比对** `lib/dub-visual.json` / `lib/style-fingerprints.json` 的 md5 —— 这两份会被别的作业改（清单里记了快照 md5）。
