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
  ★ **不要按「走 core 还是走自带副本」来分**：`core/render/mux.sh`（**2026-10-03 起 `LN_TP` 默认已由 −1.7 改为 −3.5，且可被 `LEMO_LN_TP` 覆盖**；改前是 −1.7、0.5 dB 余量 —— 全量扫描证明那余量不够，过冲最高 +1.66 dB）
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
node D:/lemo-tools/scripts/check-film-delivery.mjs     # 成片口径：文档声称值 vs 实测值 + 容器健康。★ 2026-10-06 补 **F 段「重渲窗口守卫」**：A/B/C/D 判的是「文档 vs 实测」，而**日批重渲成片**后文档要等批次跑完才回填 ⇒ 在「成片已重写、文档还没回填」的窗口里这些「不一致」**不是回归**（实证：本闸门曾报 exit 1 / 23 处 / 12 部，用改前 `mux.sh` 复跑**逐字节相同**、且 12 部全在当日 09:04–09:33 重渲名单里 ⇒ 是文档过期不是回归）⇒ 判据：**成片 mtime 新于 `_distill.json` mtime**（必要条件）**且**（成片 ≤15 min 内被写 / 该 slug 的并发锁活着（`<LEMO_LOCK_DIR>/.<slug>.lock`，判据逐字复用 `lemo-make.mjs:1559-1563`）/ `_distill` 的 `render-run-*.log`、`state.json`、`logs/*.log` 最新 mtime ≤10 min）⇒ **不判 FAIL**、报「疑似正在重渲，本次不判」并列出本会报的每一条；**真漂移照旧 FAIL**、E 类恒判不让位；成片/文档 mtime 拿不到即判「失明」并 FAIL。★ **排空后若仍红 ⇒ 那是真漂移或文档待回填**（先看有没有 `C 真峰值超标`/`C 响度偏离交付线`/D 类：没有就只是文档过期 ⇒ 跑 `refresh-style-skill.mjs`）。覆盖点：`LEMO_MUX_SH` / `LEMO_OPUSCAR` / **`LEMO_DISTILL_ROOT`** / **`LEMO_BATCH_DIR`** / **`LEMO_LOCK_DIR`**（供非破坏变异；`--json` 时 `[E]` 那行走 stderr，输出可 `JSON.parse`）
node D:/lemo-tools/scripts/check-tp-prose.mjs          # SKILL.md **正文**里的真峰值声称 vs 实测（★ 2026-10-05 修结构性失明：旧「值 > −1.2 才查」把「已修/重渲后**已达标**」的值**全排除** ⇒ 现「关于成片的**当前结论句无论是否达标**，与实测差 > 0.15 dB 即 FAIL」；旧 ① 换成「阈值/交付线提及」排除（数值 == `peakDbtpTarget`，或阈值词紧贴）；★ 2026-10-05 **修 60 字窗假阴**：判据 ③ 由「匹配点前后 **60 字**内出现『成片』」放宽为「**整行**含『成片』」（实测旧窗假阴 8/8 = 100%；`hd-2d:120` 的『成片』离数值 **69** 字）；配合新增 **⑥ 非本片产物排除**（数值所在句出现 `mix.wav`/`score.wav`/`母带`/`中间产物`/`上游`/`样片`/`素材` ⇒ 那是上游读数、不是成片声称）把误报压到 **0**（不加 ⑥ 时误报 2/10 = 20%）；★ 实验行「多目标→多实测」排除；全部读不到真峰值即判失明；LEMO_DISTILL_ROOT / LEMO_TP_MEASURED_JSON 可覆盖，供非破坏变异；★★ **2026-10-05 泛化**：本闸门已从「只查 dBTP」变成「**成片读数这一类声明**」的通用闸门（同一套抽取/排除/对账流水线，量纲以 `DIMS` 登记项加入）—— 覆盖 **dBTP / LUFS / LRA / 字节数 / 分辨率 / 帧数（FAIL）+ 体积 MB / 时长（参考）**，真值复用 `check-film-delivery` 的实测结论；覆盖点新增 **`LEMO_READINGS_MEASURED_JSON`**（多量纲真值覆盖 `{slug:{dBTP,LUFS,LRA,bytes,durSec,width,height,frames,dBFS:{samplePeak,truePeak,ebur128Peak}}}`，指向 `{}` 即逐量纲失明）；★★ **2026-10-05 下半场再纳入 `dBFS`（第 9 类量纲）**：全库 149 个 `<数> dBFS` 此前无人对账，难点是**口径歧义**（混用 `ebur128 Peak` 1 位小数 / `astats` 采样峰值 6 位 / `loudnorm input_tp` 真峰值三个口径）⇒ 必须「**口径感知 + 多真值**」：真值取 `samplePeak`（json `samplePeakDbfs` / `audioEvidence.astatsPeak6dp`，43/43 都有）、`truePeak`（`truePeakDbtp`）、`ebur128Peak`（= `round(truePeak,1)`，实测 43/43 相等）；口径词按「所在句内离 token 最近」选（`astats|采样峰值` ⇒ 采样峰值容差 0.01；`ebur128|Peak` ⇒ 容差 0.001；`input_tp|真峰值|dBTP|TPK` ⇒ 0.15；`RMS` ⇒ 参考；**无口径词 ⇒ 参考、不判**）。**误报率逐级实测**：放宽 20 命中/误报 20（100%）→ 朴素单真值 4/100% → 口径「首个命中」8/100% → 最终 **0/0**。**另立第 ⑩ 类「物理约束」FAIL**（真峰值 ≥ 采样峰值 恒成立 ⇒ 「采样峰值 > 真峰值」物理不可能，不需口径判断）：数据级（json 自相矛盾）+ 声称级（同句），容差 0.1。**实测 dBFS 真陈旧 0、物理不可能 0 ⇒ 未改任何文档**）
node D:/lemo-tools/scripts/check-skill-film-fields.mjs # SKILL.md **正文**里的成片帧数/分辨率/时长 vs generatedVideo（★ 帧数=FAIL、分辨率=FAIL、时长=参考；全部读不到 generatedVideo 即判失明）
node D:/lemo-tools/scripts/check-lra-caliber.mjs       # 43 份的 lra 是否统一 ebur128 口径
node D:/lemo-tools/scripts/check-loudness-targets.mjs  # style-dna 能否解析出响度目标（防静默回落 −16）
node D:/lemo-tools/scripts/check-config-notes.mjs      # dub-styles.json 的 notes 与字段是否自相矛盾；★ **失明守卫（2026-10-06 补）**：注册表读不到 / `styles` 不是非空数组 ⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；覆盖点 **`LEMO_DUB_STYLES`**
node D:/lemo-tools/scripts/check-config-vs-doc.mjs     # 配置底色是否在该风格 §3 配色体系里**以背景角色**出现。★★ **2026-10-06 补角色感知（修一个已确认的真实盲区）**：旧判据只做**集合包含**（`palette.bg` 在 §3 的任意 hex 里出现过就放行），而 `hd-2d` 的 `#fff0c8` 是**灯塔灯光色**、**确实**写在 §3 的 `| 主（暖实体光） | … 灯塔 \`#fff0c8\` | … |` 行 ⇒ 命中、放行，真错靠人工才发现。新判据：① 解析 §3 **表格行**（角色列=第 1 列）；② 候选色（`palette.bg` + `bgRecipe.stops`）的命中行**精确优先**（逐字节相同 ⇒ 用它 + `欧氏距离 ≤ NEAR_ROLE=12` 的近似行），**无精确才退回 `NEAR=26`**（保留旧容忍度 —— `brick-toy` 的 `#f4f4f1` vs 文档 `#F2F2EE`、`living-screencast` 的 `#0C1016` 都靠它才不误报）；③ 非背景标记 `/灯|光|发光|glow|emissive|强调|accent|描边|边框|高光|亮部/i` **只扫角色列**（用途列是散文，`risograph` 的合法背景行 `纸白（底）` 用途里就写着「描边光晕」、`ascii-crt` 的 `产品通路（dub）` 写着「accent」⇒ 扫用途列会误报；「字/前景」也不入表，否则 `pictogram-motion` 的合法底色 `米白 CREAM`（用途「深色相上的**前景字**与人、片尾底色」）会被误伤）；④ 命中行里有一行角色列**不含**标记 ⇒ 放行，否则（不在 §3，或**只**在非背景角色行）⇒ 判可疑。★ **为什么精确优先**：`NEAR=26` 会把 `#fff0c8`（暖奶油）算成 `#f3ead6`（UI 纸白，距离 **19.4**）这种**不同色** ⇒ 真阳性被放过。★ 语义不变：**文档第 11 节已记录的**只列 backlog、不判 FAIL，**没记录的**才 FAIL。★ **失明守卫**：`styles.length===0` 或全部进 `noSec` ⇒ FAIL 并明说「**本闸门已失明**」。★ 覆盖点（新增）**`LEMO_DISTILL_ROOT`**（SKILL.md 根，与 `check-skill-artifacts`/`check-skill-scores` 同名同义）+ **`LEMO_DUB_STYLES`**（注册表）。★ 验证：真阳性夹具（hd-2d 的 `palette.bg` 回退成事故前 `#fff0c8`）改后 **exit 1**〔★ 2026-10-06 订正：这只对「§11 **未记录**该冲突」的文档（最小夹具）成立；若用**真实 SKILL.md**（§11 明确记了 `#fff0c8`），夹具归 **backlog / exit 0**、`--all` 下才 exit 1〕 / 改前 HEAD **exit 0**；真阴性（真实 44 条）**未记录 0 / 积压 2（scifi-toon、tilt-shift，同批已清零 ⇒ 现为 0）/ exit 0**；失明（风格根指空目录）**exit 1 + 「本闸门已失明」**。★★ **2026-10-06 二次收紧（修残留盲区）**：原「**任一**候选色（`palette.bg` 或 `bgRecipe.stops`）以背景角色出现即放行」⇒ **一个正确的 `bg2` 会掩盖一个错误的 `bg`**（`stained-glass`：`bg #2a2a2e` 取自**测试文件** `styles/stained-glass/demo/test.js:9`、**不在 §3**，但 `stops` 里的 `#142a70` 是 §3「深蓝」行 ⇒ 放行）。现改为「**以 `palette.bg`（主底色）为准** —— `bg` **自身**必须命中背景角色行才放行；`stops` **仅当 `bg` 缺失/null 时**才看」。实测：真实语料 **0 未记录 / 0 积压 / exit 0**；`stained-glass` 改前态夹具 **判可疑**（**改前规则 exit 0**）；`hd-2d` 夹具仍 **exit 1**〔同订正：最小夹具成立；真实 SKILL.md ⇒ backlog/exit 0〕；失明仍 exit 1 且无 ✓。★ **两条已知局限的最终处置（2026-10-06）**：① 角色裁决是**黑名单**（`NONBG`）、**无正向白名单** ⇒ 只记录、不根治（判据不成立）。**可被绕过的具体构造**：同一个错底色 `#fff0c8` 写成 §3 **表格行** `| 派生通路底 | \`#fff0c8\` | … |` ⇒ **放行（exit 0）**；写成 §3 **散文 bullet** ⇒ **仍判可疑**（判据对格式与角色命名都敏感）。**为什么没换白名单**（题给 12 词 `底|背景|天空|纸|地面|环境|墙|幕|板|场景|布|底色`）：逐条核对 44 条真实 §3 角色列实测 —— ① 12 词 ⇒ **8 条误报**（`silkscreen-poster`〔`dub 通路派生`〕/`ascii-crt`〔`产品通路（dub）`〕/`brick-toy`〔`主`〕/`cel-anime-80s`〔`夜景主色`〕/`living-screencast`〔`产品浅主题·墨`〕/`paper-lantern`〔`房间黑`〕/`pictogram-motion`〔`米白 CREAM`〕/`swiss-motion`〔`页`〕）；② 补可辩护词 `通路|派生|夜|房间|页` ⇒ 降到 **3 条误报**；③ 再把 `主`/`米白`/`产品|主题|墨` 塞进白名单 ⇒ 真实 0 误报，但 `hd-2d` 真阳性夹具（命中行 `主（暖实体光）`）**同时被放行** ⇒ 拆掉闸门立身之本；④ 改「白名单 ∧ ¬黑名单」⇒ 真实 0 误报、`hd-2d` 仍被抓，但白名单必须常驻 `主/米白/产品/主题/墨` 这类**无背景语义**的词 ⇒ 已不是正向白名单，对上面的绕过构造**一点也拦不住**。**结论**：§3 角色列不是受控词表（混着角色名〔底/纸/幕〕、纯色名〔米白/主/墨〕、通路名〔dub 通路派生〕）⇒ 按 role 用词的白名单做不到「排除光/强调行」且「保住 44 条合法行」，按纪律「判据不成立时宁可只报不改」**保留黑名单**；本闸门只保证「底色的**角色归属**不是灯/光/强调一类」，**不保证**角色名与底色内容相符。② `docRecorded` 粗判据 ⇒ **2026-10-06 已根治**：旧判据（§11 同时出现 `dub-styles.json` 与 `palette|底色|配色` 即算「已记录」）会把「§11 记的其实是**另一条**冲突」误判成 backlog（`shadow-puppet`：§11 记的是 `textureRaw: backlit-leather` 未实现、自评行写着「palette −1」、另有一条「dub 通路的字幕位置…」⇒ 两个正则都命中）。现要求 §11 **指向本条**：出现该风格的 `palette.bg` 值（带 `#`、大小写不敏感、不匹配更长 hex 前缀）**或**明确写「底色」。★ 不用题给备选的 `§3`（§11 里的 `§3` 常在说**别的角色**：`engraving` §11 就用它解释 `accent` 的代理值）、也不用 `背景`（多是「背景带渐变 / 背景 sweep」这类风格描述）。**验证**：真实 44 条 **0 未记录 / 0 积压 / exit 0**；`shadow-puppet` 夹具（`bg #2a2a2e` + 真实 SKILL.md）改前 **backlog/exit 0** ⇒ 改后 **fresh/exit 1**；`hd-2d` 最小夹具 **fresh/exit 1**；`stained-glass` 夹具（真实 SKILL.md、`bg #2a2a2e` + `stops [#2a2a2e,#142a70]`）**判可疑**（真实 §11 确实记了本条 ⇒ backlog、`--all` 下 exit 1）；以上各夹具在**改前规则**（`6892c75`）下均 **exit 0**；失明夹具 **exit 1 + 「本闸门已失明」且无 ✓**。★ `shadow-puppet` 的真实底色 `#f4ead2`〔`demo/carve.js:7` `DYE.white`、`styles/shadow-puppet/STYLE.md:8`「a white cloth screen」〕已在同批补进 §3 行。★★ **2026-10-06 追加：`LEMO_DUB_STYLES` 已接通渲染链路** —— 此前**只有 4 个闸门读它**，而 `lib/dub-core.mjs` 的 `STYLES_FILE` 与 `lib/dub-semantic.mjs` 的 `STYLES_PATH` 都是**硬编码**路径 ⇒ **闸门侧与渲染侧同名不同义**（拿它做「配置是否影响成片」的变异验证会出**假阴性**）。现两处均为 `process.env.LEMO_DUB_STYLES || <原硬编码值>`，与 `LEMO_LIB_WIN`/`LEMO_MUX_SH`/`LEMO_OPUSCAR`/`LEMO_DISTILL_ROOT` 同语义（`LEMO_*` 一律真的影响渲染）；**不设变量时行为不变**（实测 `resolveStyle` 默认取真实值、设变量后取夹具值，渲帧主色随之改变）★★ **2026-10-06 第三次收紧（修「已修记录的回归盲区」）**：本仓约定「修好的缺陷 = **原文保留 + 追加更正**」（原文 `~~…~~` 划掉 + 后跟 `★ … 已修：…`）⇒ **已修**记录里必然写着**旧值**，`docRecorded` 只要搜到那个旧 hex 就判 backlog ⇒ **配置回退成旧值（真回归）也 exit 0**。实证：`stained-glass` §11 的 `~~派生通路的底色是深灰 #2a2a2e…~~ ★ 2026-10-06 已修：原 palette.bg = #2a2a2e … 由 #2a2a2e 改为 #1d3a9c`。现改为**先剔除「已修」更正单位、再判是否指向本条**（`stripFixed()`，三条机械规则）：① 去掉 `~~…~~` 划掉的 span（跨行）；② 反复去掉**最内层圆括号组**（`[^（()）]*`）——只要组内含 `已修`；③ 逐行删掉**含 `已修` 的 `★` 子句**（`★` → 下一个 `★` 或行尾）。★ 边界为何是「括号组 + ★ 子句」而**不是整行/整条 bullet**：`stained-glass` §11 的「自检发现的缺陷」一行里同时记着 `palette`（已修）与 `typography`/`audio`（**未结**）⇒ 按行删会漏报未结记录；②也是被迫的（同风格蒸馏证据表的 `（2026-10-06 校正：… dub 通路底色冲突已修 —— palette.bg #2a2a2e→#1d3a9c…）` 没有 `★`；「自检」那条的 hex 在 `★` **之前**，只做 ③ 删不掉）。★ **连带收紧 `pointsToThis`**：泛词 `底色` ⇒ `底色冲突`（被迫：剔除后 `stained-glass` §11 仍剩 `- **派生条目是近似值**：… 字幕颜色由 WCAG 对比度规则从底色推得 …`，含 `dub-visual.json` + `palette`/`配色` + `底色` 却**没在记冲突**，会抵消这次收紧）。★ **验证**：真实 44 条 **0 未记录 / 0 积压 / exit 0**（3 遍）；回归夹具（`stained-glass` 真实 SKILL.md + `bg` 回退 `#2a2a2e`）改后 **fresh / exit 1**、改前 HEAD **backlog / exit 0**；非回归对照（`bg #1d3a9c`）**exit 0**；三个正对照（已修标记改「本条未修」/§11 全去 `已修`/只写「底色冲突」不给 hex）**均 backlog / exit 0** ⇒ 剔除以「已修」为条件；`shadow-puppet` 夹具仍 **fresh / exit 1**；失明 **exit 1 且无 ✓**。★★ **存疑（已上报，不改）**：`hd-2d` 夹具（真实 SKILL.md + `bg` 回退 `#fff0c8`）由 **backlog / exit 0** 翻成 **fresh / exit 1**（其 §11 对这条冲突的每处提及都带「已修」）—— **不是误报**（文档写「已修」、配置却回到旧值 = 回归）。★ 若验收要求「`hd-2d` 仍归 backlog」，那是**期望与判据冲突**：`stained-glass` 的 `（2026-10-06 校正：… dub 通路底色冲突已修 …）` 与 `hd-2d` 的 `（2026-10-05 校正：dub 通路底色冲突已修 …）` **逐字同型**，不可能一个剔、一个留。
node D:/lemo-tools/scripts/check-derivation-caliber.mjs # ★ **派生口径闸门**（2026-10-06 新增）：`lib/dub-styles.json` 每条 entry 的 `derivation` 口径块 ↔ 本条字段 ↔ 该风格自己的 `SKILL.md` 三方一致。★ 由来：本注册表是「文案+风格」通路的**唯一可渲染消费入口**，但它的配色/字体**多数不是逐行真抽** —— 43 个真实风格的字幕字体一律是本机字体（`_notes[5]`，STYLE.md 点名的 OFL 字体本机都没有）、32 条派生条目的配色取自证据层 `lib/dub-visual.json`、字幕字号/颜色走「分类别默认 + WCAG」（`_notes[11]`）、3 条底色**落回 plain-dark**（`bgSameAsDefault:true`，`_notes[13]`）、若干条 accent 按 `_notes[10]②` 的「`accent/bg` 一律提到 ≥4.5」被换过 —— 这些口径此前**只写在散文里** ⇒ 下游读不出「哪个值是原文值、哪个是要替换的近似值」，漂移也没人拦。现给每条加 `derivation: {bg, font, subtitle, accent}`（**纯元数据、只增不改**；渲染侧一个字都不读它），判据写在 `_notes[19–23]`。★ **键名 `derivation`**：与既有的 `derived` / `derivedFrom` / `bgSameAsDefault` 同类并列、自解释。★ **它必须登记进 `check-dna-coverage.mjs` 的 `DUB_METADATA` 白名单**（本次已加一条，写明「为什么算元数据」+ 点明它是本闸门的输入）—— 那个闸门第二节枚举注册表全部字段路径，零读取且不在白名单的路径一律 FAIL（不登记就是 EXIT=1）；**白名单就是它为「新元数据字段」预留的人工入口**（头注释原话「改的是清单，不是判据」）⇒ 新增元数据字段 = 加一行登记，不改任何判据/阈值。★ 曾短暂用 `_notes` 承载（不登记也能过），**已否决**：顶层 `_notes` 是字符串数组、条目里若也叫 `_notes` 则是对象，属「同名不同层/不同型」的 schema 债务（项目刚为同型问题吃过亏：`LEMO_DUB_STYLES` 闸门侧与渲染侧同名不同义 ⇒ 变异验证假阴性）。★ 判据：① 四轴齐全 + 取值在枚举内；② **按 `_notes[20]` 的规则重算四个轴、与写着的值逐轴比对，不等即 FAIL**（`bg=fallback ⟺ bgSameAsDefault:true 或 palette.bg 为空`；`bg/accent = proxy/substituted ⟺ 与 dub-visual 的对应值不等（含证据层没抽到）`；`font=substituted ⟺ fontFamily 在本机字体表里且非合成基线`；`subtitle=derived ⟺ derived:true 且 notes 含 WCAG`；`accent=absent ⟺ palette.accent 为空`）；③ `fallback/proxy/substituted/derived` 的条目，其 `SKILL.md` 里**必须有对应口径说明**（缺则 FAIL 并点名该补哪份文档）。★ 分布：`bg` exact 37 / proxy 4 / fallback 3；`font` exact 1 / substituted 43；`subtitle` exact 13 / derived 31；`accent` exact 32 / substituted 7 / absent 5（`accent` 多一个 `absent` 取值：null 既非 exact 也非 substituted）。★ 失明守卫：注册表读不到 / `styles` 不是非空数组 / **证据层读不到或 `styles` 不是非空对象** / 一个 `SKILL.md` 都读不到 / `_notes` 里不再列全本机字体表 ⇒ **FAIL 并明说「本闸门已失明」**且不打分布统计与「✓」。★ 覆盖点 **`LEMO_DUB_STYLES`** + **`LEMO_DISTILL_ROOT`** + **`LEMO_DUB_VISUAL`**（新增）
node D:/lemo-tools/scripts/check-skill-artifacts.mjs   # json 记录的成片信息 vs 磁盘实物；★ **失明守卫（2026-10-06 补）**：一个带 `_distill.json` 的风格都枚举不到（含 `--only` 拼错）⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；覆盖点 **`LEMO_DISTILL_ROOT`**
node D:/lemo-tools/scripts/check-shell-structure.mjs   # shell 脚本结构（续行被注释吃掉 / 判定块缺 exit 0）
node D:/lemo-tools/scripts/measure-truepeak.mjs --check # 43 部成片真峰值是否都 ≤ −1.2 dBTP
node D:/lemo-tools/scripts/check-dub-styles.mjs        # 纹理红线 + 字幕底衬（模型级）
node D:/lemo-tools/scripts/check-doc-coverage.mjs      # 你新增的脚本有没有登记进文档（本简报 + test/README.md）；★ **失明守卫（2026-10-06 补）**：`scripts/` 或 `test/` 扫到 **0 个** ⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；★★ **2026-10-06 收紧：登记判据由纯子串改为「行锚定」**（旧 `t.includes(f)` 只要脚本名在文档里**出现过**就算数 ⇒ 两行并成一行、名字只出现在句子中间都骗得过；实测本简报里 `check-render-venc.mjs` 的说明曾**粘着** `patch-render-venc.mjs` 那行、闸门照报 exit 0）⇒ 现在要求「**存在一行**按登记格式写下该脚本」：本简报 = 行首（可含 `-`/行内反引号）+ `node ` + `scripts/<name>`，`test/README.md` = 行首 `|` + 反引号包裹的路径；真实语料 **0 误报**、夹具「两行并一行 / 名字在句中」新判据 **FAIL** 而改前 **exit 0**；★★ **同型残留一并收紧（测试入口侧）**：`test/*.test.mjs` 的「已登记」判据原为裸子串 `readme.includes(f)` ⇒ 测试入口行被并掉时同样看不见；现改为行锚定（接受 `node test/<name>` 命令行块 与 `` | `test/<name>` `` 表行两种形态），**无「工具类只需一处」的豁免 ⇒ 并成一行必然翻退出码**；夹具「并成一行 / 名字在句中」新 **exit 1** 而改前 **exit 0**；★ 测试入口侧的**失明守卫早已存在**（`test/` 扫到 0 个 `*.test.mjs` ⇒ FAIL + 「本闸门已失明」，且此时**不会**打印「0 个都已登记」），无需新增；覆盖点 **`LEMO_TOOLS_ROOT`**
node D:/lemo-tools/scripts/check-dna-coverage.mjs      # 风格注册表的**字段消费覆盖**（三节）：① style-dna 的已接线链路没断（防风格特质静默失效）；② ★ lib/dub-styles.json 的**每条字段路径**要么「有消费者」、要么在**元数据白名单**/未实现清单里，否则 FAIL（防「注册表声明了、代码没人读」——44/44 声明 textureRaw 却零读取就是这么漏的；已剥注释，否则解释缺陷的注释会被当成消费者；排除 scripts/ 否则闸门读到自己；注册表读不到/枚举 0 条即判失明；LEMO_DUB_STYLES 可覆盖，供非破坏变异；★★ **2026-10-06 收紧：嵌套路径的消费者判据必须感知路径上下文（顶层键判据不动）** —— 由来：`derivation` 是**纯元数据对象**（`bg`/`font`/`subtitle`/`accent` 四轴，由 `check-derivation-caliber.mjs` 独占消费，**渲染侧一个字都不读**），但四条子路径**全靠叶名碰撞**被判「有消费者」⇒ **四条全是假绿**（`derivation.font` 最脆：唯一依据是 `server.mjs:136` 的 `'.woff2': 'font/woff2'` 这个 **MIME 串**）。新判据：顶层键不变；**嵌套路径**要求叶名命中的那个文件**还必须出现父键**（倒数第二段，如 `derivation.bg` 的 `derivation`），且父键必须是**代码 token**（已剥注释）。**邻域取「同文件」而非「同行/±N 行」**（先测误报率）：真实消费者的父对象常被**别名掉**（`const r = spec.bgRecipe` 后隔 18 行才 `r.halftone`；`subtitle` 写作 `sub.plateColor`/`sp.plateColor`）⇒ 实测误报 **同行 8 条 / ±5 行 4 条 / 同文件 0 条**，同文件且恰好杀掉 `derivation.*` 四条假绿（该父键在 28 个运行时代码文件里零出现）。**误报率**：真实注册表 67 条路径，判定变化**恰好 4 条**（全是 `derivation.*`），其余 63 条一字不变；这 4 条按「父键已声明为元数据 ⇒ 子键自然也非渲染字段」登记进 `DUB_METADATA`（只加行，不改既有条目/阈值/判据）⇒ **FAIL 0 / 误报 0**。**验证**：真阳性夹具（给每个风格的 `palette` 注入假字段 `font` —— 叶名只在 `server.mjs` 的 MIME 串里、该文件无 `palette`）**改后 exit 1 点名 `palette.font`**、**改前 HEAD exit 0（假绿）**；同型夹具 `derivation.plateColor` 同理；真阴性真实注册表 **exit 0**；失明三态仍 **exit 1 + 「本闸门已失明」**）；③ ★ **`bgRecipe.textureRaw` 的「取值级」实现状态**（2026-10-05 扩展，补的正是 ② 原先登记的「已知边界」）：**可解析名字集合 R** 从 `lib/dub-core.mjs` **源码抽**（`bgFilters()` 的 `switch (tex)` case + `TEXTURE_SYNONYMS` 键 + `TEXTURE_RAW_FALLBACK` 键 + `none`，不手抄）⇒ 判**双向**：(A) 声明但未标（值 ∉ R 而散文清单没登记）FAIL、(B) 标了但已实现（值 ∈ R 而散文清单仍列着）FAIL，另加 4 条防清单腐烂 + slug 级核对；**误报率**：原始判据首跑命中 2 名（`vignette`/`paper-grain`）**真 0 / 误 2（100%）** ⇒ 加豁免表 `TEXTURE_COVERED_BY_OTHER` 后 0/0（★ **「可解析 R」≠「已实现全集」**：31 个声明值 = R 内 11 + 未实现 18 + 豁免 2）；**失明守卫**尤其重要（判据依赖解析源码）：源码读不到/抽不到两张表/找不到 `bgFilters()` 或其 `switch (tex)`/R 为空/注册表为空/散文找不到「声明但未实现」条目 ⇒ 一律 FAIL 并明说「已失明」；覆盖点 **LEMO_DUB_CORE**（新增）+ `LEMO_DUB_STYLES`，均供非破坏变异）
node D:/lemo-tools/scripts/check-mux-selection.mjs     # 编排器实际挑中的那个 mux 脚本口径是否完整（★ 脚本存在 ≠ 会被采用）；★ **失明守卫（2026-10-06 补）**：`styles/` 读不到 / 扫到 **0 个风格** ⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；覆盖点 **`LEMO_OPUSCAR`**
node D:/lemo-tools/scripts/check-line-endings.mjs      # ★★ **行尾卫生闸门**（治 2026-10-06「库仓 38 个风格废掉 21 个」的**根因**：该仓**没有 `.gitattributes`** + 本机**系统级 `core.autocrlf=true`** ⇒ 新 clone **全仓 CRLF** ⇒ 两侧 `core/` 字节不一致 ⇒ **编排器拒绝开工**）。★ **每次开工前先跑它**（行尾坏了的后果是整批废掉，不是单点失败）。判据五条：**J1** `.gitattributes` 存在且 **git 实际生效**的 attr 对（14 个文本扩展名 + `.gitignore`/`.gitattributes` 逐个 `git check-attr text eol` ⇒ **`text ∈ {set,auto}` 且 `eol=lf`**；★ 只看 `eol` 会**假绿** —— 把 `*.js text eol=lf` 改成 `*.js binary` 后兜底行仍把 `eol` 报成 `lf`，实测 `x.bin` ⇒ `text: unset`/`eol: lf`）；**J2** `git ls-files --eol` 里被判为文本的路径不许 `w/crlf`（★ 按 `--eol` **标记**判、**不按字节扫**：jpg/bin/woff2/mp4 本来就可能含 0x0D）；**J3** ★ **字节级「隐形漂移」**（工作区字节 vs `git show HEAD:<path>` 字节，**去 CR 后相同、原样不同** ⇒ 报出 —— 就是 `git status` **看不见**的那种）；J3 **不按扩展名过滤**（对 `TEXT_EXT` 清单外的新文件**只有它看得见**），且**必须排除 `attr/eol=crlf` 的路径**（`*.bat`/`*.cmd` 的 CRLF 是**设计如此**，不排除会误报 2/10，已修）；**J4** 失明守卫（无 `.git` / 枚举到 **0 个**已跟踪文件 ⇒ **FAIL 并明说「本闸门已失明」**）；**J5** backlog 只列不判（**当前故意为空** —— 已知真阳性正在被别的智能体修，登记进去等于「为变绿而放宽判据」）。★ 覆盖**两个仓**：**`LEMO_OPUSCAR`**（默认 `D:/lemo-opuscar`）+ **`LEMO_TOOLS_ROOT`**（默认本仓根，与 `check-doc-coverage` 同名同义；该仓 `*.bat`/`*.cmd` 按 `eol=crlf` 判，且**只在该扩展名真的存在时**才要求）。★ 真实语料首跑：opuscar **0 违规**、tools **8 处真阳性**（`lib/style-dna/*.json`：工作区 CRLF / blob LF / `git status` **干净**）⇒ **误报 0**；夹具 `D:/lemo-tmp/agent-eolgate/`（`fx-ok` exit 0、`fx-noattr`/`fx-eolcrlf` exit 1、`fx-crlf-text` exit 1、**`fx-bin-cr`（二进制含 0x0D）exit 0 不误报**、`fx-hidden` exit 1、失明两态 exit 1、`fx-tools-ok` exit 0、`fx-bat-lf` exit 1）。★ 实现坑：本机 `spawnSync('git',…)` **一律 `EBUSY`** ⇒ 必须用**异步 spawn**（同 `check-dual-copy-sync` 的 `wsl.exe` 那条）
node D:/lemo-tools/scripts/check-mix-candidates.mjs    # 混音文件有没有「靠前的旧占位遮蔽靠后的真混音」（★ 真实发生过事故）；★ **失明守卫（2026-10-06 补）**：`styles/` 读不到 / 扫到 **0 个风格** ⇒ **FAIL 并明说「本闸门已失明」**（旧版静默假绿）；覆盖点 **`LEMO_STYLES_ROOT`**
node D:/lemo-tools/scripts/check-cli-docs.mjs          # 命令行参数的用法块与实现是否对得上（★ 防「文档先于实现」）；★★ **2026-10-06 修一个已确认的假绿：用法块判据由「整份源码里任意缩进 ≥2 空格的 `--flag`」收紧成「锚点法」** —— 旧判据下一段**无关**模板/注释里缩进写个 `--flag` 就把「已实现但没写进用法块」的参数冒充成「已文档」。**夹具**（`fx-cli` vs `fx-cli-control`，差别只在另一段无关模板里多一行缩进的 `--beta`）：`--beta` 已实现却没写进 `USAGE` ⇒ 旧版 `fx-cli` **exit 0（假绿）**、新版 **exit 1 点名「代码处理了 `--beta`，但用法块没列」**。★ **不能改成「连续块/最长块/块大小阈值」**（实测确认「真实用法块不是连续块」成立）：`dub.mjs` 的用法块被空行/续行切成 **12 个碎段**（最长 4 行）、`lemo-make.mjs` **10 个**（最长 8 行）⇒ 误报（合法参数被判「代码有文档无」）**只认最长块 18/13 条、块长≥3 并集 10/9 条、块长≥2 并集 6/5 条、距小标题≤40 行 4/3 条（且杀不掉夹具假绿）、朴素反引号配对 0/21 条**。★ **新判据（机械可解释）**：用法块 = 「含**用法小标题**的那段**模板字符串**（或块注释）」；小标题 = 行尾的 `用法:`/`用法：`/`Usage`/`USAGE`/`选项`/`Options`；区域边界 = 由「未转义反引号数的奇偶」判断小标题在不在模板里，再取「上一个含反引号的行 ↔ 下一个含反引号的行」；**只有区域内的缩进 `--flag` 才算「已文档」**。★ **误报率**：真实语料各 22 个已文档 flag，**改动前后集合逐字相同（差集 0/0）**、闸门输出**逐字节一致**、**exit 0**。★ **已知局限**：启发式（非 AST）—— 小标题写成别的词、或用法块既非模板字符串也非块注释 ⇒ 识别不到区域 ⇒ `doc.size===0` 触发**失明守卫** FAIL（**不会**静默假绿）
node D:/lemo-tools/scripts/check-lexicon-coverage.mjs  # 风格 tags ↔ 规则词表双向对齐（★ 漏登记 = 规则路永远选不中该风格；schema 不符即判 FAIL）
node D:/lemo-tools/scripts/check-api-docs.mjs          # server.mjs 路由 ↔ README 接口表双向对齐（★ 防「文档先于实现」；任一侧解析为 0 即判失明）
node D:/lemo-tools/scripts/check-render-venc.mjs       # ★ 渲染一律 GPU 优先（未设 LEMO_VENC ⇒ h264_nvenc；非法值 ⇒ 报错；双副本不一致 ⇒ FAIL）。★★ **2026-10-06 修一个已确认的假红：D 类判据加「相邻性」(e)** —— 旧**守卫**判据只要求「同一小句内同时出现 `libx264` + 默认类词 + 编码语境」；于是本**守卫**把表格里的 `| libx264 | 默认安装即有的软件编码器 |` 判成过期声称（`默认` 修饰「默认**安装**」而非「编码器默认值」）—— 假红 3/3；新判据 (e)：限定词必须**直接修饰** `libx264`（中间只能是空白/标点（不含表格竖线 `|`）/连接词白名单），且限定词在编码器名之后时右侧须紧接边界/标点/连接词。**验证**：假红夹具 **改后 exit 0 / 改前 exit 1**；真声称**守卫**夹具（7 形态，含「默认使用 `libx264` 编码」）**改后仍 exit 1、7 条全中**（**守卫没瞎**）；真实语料 1548 文件 **改前改后输出逐字节一致、exit 0**；★ 新局限（有意取舍）：限定词与编码器名之间垫实词/整段说明、或分处表格两格的真声称会被漏 —— 同形态也是假红来源，本**闸门**选「宁漏不乱报」）
node D:/lemo-tools/scripts/patch-render-venc.mjs       # 按上述判据幂等回灌 26 个编码器决策点（双副本一起写）
node D:/lemo-tools/scripts/check-venc-args.mjs         # ★ 每个编码参数组合**真编 1 帧**证明 ffmpeg/nvenc 接受（32 组合，~4s；抽到 0 个即判失明）
node D:/lemo-tools/scripts/check-dual-copy-sync.mjs   # ★ 全仓两份副本同步（源文件漂移/单侧缺失 ⇒ FAIL；生成物与资产只列 backlog；WSL 不可达即判失明；★ 2026-10-06 补「git 历史一致性」**参考级**判据：报两侧 HEAD/分支/未提交条数/领先落后/「一侧看不到另一侧 HEAD」+ 后果，**一律不判 FAIL**（实测历史已分叉 —— WIN `b0de9e7` 领先 WSL `f3c590d` 1 个提交且 WSL 看不到该对象，而文件是同步的 ⇒ 旧版全绿；判 FAIL 会立刻打破全绿，且收敛要动仓库、本闸门只读）；失明（无 .git / 无 git / root 不存在）只明说、不 FAIL；★★ 2026-10-06 再补第 ②b 条「**无扩展名的控制文件**」判据：`.gitignore`/`.gitattributes`/`.editorconfig`/`.gitmodules`/`LICENSE-*` 按**同一份 glob 列表**喂给 WIN 匹配器与 WSL `find -name`（两侧由构造一致），漂移即 FAIL —— 旧版 `isText('.gitignore')=false` ⇒ 两侧 `.gitignore` 内容不同也**全绿**（实测 `a25c8d…` vs `96112b…`））
node D:/lemo-tools/scripts/check-film-aspect.mjs      # ★ 成片画幅：A 声明支持（未声明=只支持16:9）+ B 43 部画幅应一致（少数派即违规）+ ★C 用 ffprobe 读**实际成片文件**要求恰为 1920×1080（样板片一律 16:9；文件缺失只单列、0 部成片/文件根不存在/无 ffprobe 即判失明；`LEMO_FILMS_ROOT` 可覆盖，供非破坏变异）
node D:/lemo-tools/scripts/check-audio-chain.mjs      # ★ 音频链可跑性：哪些风格的混音步编排器跑不了（A 无路径/B 基线/Bnew 新增 ⇒ FAIL），把「只有真渲才发现」的缺口静态化
node D:/lemo-tools/scripts/check-aspect-declaration.mjs # ★ 影片入口画幅声明：没有 film*.js 的风格，其真实入口（index.html 引的本地 .js / 内联脚本）若读了视口 ⇒ FAIL（否则控制台会误报「只支持 16:9」）；风格目录不存在 / 0 风格即判失明
node D:/lemo-tools/scripts/check-aspect-prose.mjs     # ★ SKILL.md 画幅论述：§2/§9/§11 的「只支持 16:9 / 9:16 不可用 / 43.75%」类否定式声称 vs styleAspects() 的能力声明（双向；整行历史标记 + 引号/删除线豁免；「现状/当前」标记可推翻豁免；--ignore 排除在途风格；风格目录/事实源探不到即判失明）
node D:/lemo-tools/scripts/check-esm-import-paths.mjs # ★ 动态 import 传运行时绝对路径（Windows 下 path.join ⇒ 报 'd:' 崩，POSIX 走 WSL 不暴露）：import(path.join(…)) 无 pathToFileURL/file:// ⇒ FAIL，报 file:line；首片段 ./ ../ / scheme 放行；扫描根不存在 / 0 文件即判失明
node D:/lemo-tools/scripts/check-ref-lines.mjs       # ★ 散文/源码里的 `<路径>:<行号>` 引用会不会随行号漂移而失效。★★★ **扫描范围（2026-10-07 再扩：纳入源码文件）**：**180 份文档 + 791 份源码**（源码侧 = `lib/*.mjs` 21 份、工具仓根 `*.mjs` 5 份、`styles/*/demo/**` 733 份、`core/**` 24 份、`tools/**` 8 份；只收 `.mjs` / `.js` / `.py` / `.sh`；**排除 `vendor/`、`node_modules/`、`.git/`、`*.min.js`** —— 压缩产物里 `r.classId` / `r.length` 这类「标识符后跟冒号零」形态会被 `REF` 认成引用（`r.classId` 恰好长得像带扩展名的路径）⇒ 不排除就假红；夹具 t3 实测：同段内容放 `demo/vendor/lib.min.js` 被排除、放 `core/notmin.js` 则报 **2 处假 (a)**）。★ **为什么加源码**：源码注释里的同类引用此前**零覆盖** —— 实证 `lib/jobs.mjs`（3 处）与 `lib/vram.mjs`（2 处）的这类引用**全部已失效**（`lemo-make.mjs` 的 1158 / 743 / 996-1019 / 2428×2 行 ⇒ 真位置 1273 / 858 / 1559-1563 / 2716 行）。★ **判据不变**（(a)(b)(c)(d) 四条全跑；源码里的引用**目标也是别的文件**，与它写在哪种文件里无关）。★ **误报率实测（791 份源码 / 8 处引用，逐条人读）**：**命中 1（真失效）/ 误报 0 ⇒ 精度 100%** ⇒ **不做任何收窄**。那 1 处 = `lib/jobs.mjs` 第 61 行引 `server.mjs` 第 1675 行（1675 行是 `*/`；`--skip-sync` 实在 1674 行注释 / 1755 行那条 `const opts = …`）⇒ **(c) FAIL 真阳性**；另有 **有效 3 处**（`styles/art-deco/demo/frame.js` 第 11 行引 `STYLE.md` 第 45 行、`lib/dub-core.mjs` 第 169 行引 `halftone-dossier/STYLE.md` 第 19 行、第 172 行引 `risograph/STYLE.md` 第 23 行，逐条核过被引行内容与引文逐字一致）与 **只列不判 4 处**（多义：`demo/index.html` 第 140 行 ×2 全库 46 处同名、`STYLE.md` 第 25 行 44 处同名）。★ 排除项**在本轮真实语料上不承重**（带排除 791 份/8 处，关掉排除 792 份/**同样 8 处** —— 那个 `vendor/opentype.min.js` 里一个反引号都没有）⇒ 是**保险**而非修 bug，但**必须留**。★★ **第二层盲区（比「没扫源码」更深，务必知道）**：任务书那 5 处里**只有 1 处带反引号**，其余 4 处是**裸引用**（写作「见 lemo-make.mjs 第 743 行」这种形式）⇒ 本闸门**按设计就不认**，**扩了源码范围也照样看不见** —— 即「源码文件已纳入」**不等于**「源码里的引用都被管住」；修法是给裸引用**加反引号**（本轮那 5 处已顺带改成**符号名 / 代码锚**，不再依赖行号）。★ **失明守卫照旧生效**（夹具 t4：整棵树无引用 ⇒ exit 1 + 「本闸门已失明」）。★ **不纳入** `scripts/**`（本轮未要求；29 个闸门自身带**大量**行号引用，含本闸门**自己的头注释**）、`node_modules/`、`vendor/`、生成物。★★ **扫描范围（2026-10-07 前一次扩）**：**137 → 180 份** —— 加进了 **43 份 `lib/style-skills/*/_distill.json`**（此前 `DOCS` **只含 `.md`** ⇒ `.json` 里的引用**零覆盖**）：实测新增 **17** 处引用（3796→3813）、**0 FAIL**，逐条人读 **14 有效 / 2 真失效（弱）**。★ **口径** = 按**物理行**扫（与 `.md` 同口径），靠「`JSON.stringify` 把 `\n` 转义 ⇒ **1 字符串值 = 1 物理行**」（实测 **2510/2510**）保证与「按 JSON 字符串值判」**等价** ⇒ **不写第二套解析器**；**(a)(b)(c)(d) 对 `.json` 照样适用**（引用**目标是外部文件**、不是 JSON 自己；**反引号不是 JSON 转义字符**，故 `<路径>:<行号>` 在 JSON 里原样存在）。★ **不加反引号的「裸引用」明确不纳入**：`_distill.json` 里还有 **390** 处，按 (a)(b)(d) 判 **3 命中 / 误报 2**（盘符 `D:` 被正则吃掉；`sfx.py` 第 9 行属「按文件名不搜 `core/`」的已知局限；`mux.sh` 第 115 行解析到**同名错文件**）⇒ 精度 ≈**33%**，失败是**判据结构性**的（`siblingPaths` **只收反引号片段**）。★ 上面 3 处失效示例**故意写成「路径 + 第 N 行」**（不写 `路径:N`）—— 写成反引号包裹的 `路径:N` 会把**说明文字**变成**真引用**（实测第一版多报 (a) 2 + (b) 1）；即使不加反引号，`TICKS` 顺序配对也会让纯文本 `路径:N` 落到别人的反引号之间被当成引用 ⇒ 必须把路径与行号**拆开**。**由来**：2026-10-06 本会话连撞三次 —— `check-film-aspect.mjs` 与 `test/README.md` 引用 `scripts/style-distill.mjs:189`（`--ratio 16:9`），改了被引文件后漂到 `:305`、三处全改；同一轮再改一次漂到 `:331`，三处**再次全部失效**，而当时 28 个闸门没有一个看得见。**判据四层**：(a) 文件存在（解析不到 ⇒ FAIL）、(b) 行号在范围内（> 总行数 ⇒ FAIL）、(c) 内容对得上（引用**同小句**内、距引用 **≤40** 处若有**高置信代码片段**（`--flag` / `#hex` / `标识符 = 值` / `名字(...)`）则要求它出现在被引行区间；**token 匹配**，全部 token 命中或含数字的 token 命中即通过）、**(d) 被引行没有内容**（2026-10-06 补，治 (a)(b)(c) **三条全放行**的盲区 —— 被引行 `trim()` 后是**空行** / **`---`（或 `***` / `___`）** / **```` ``` ```` 围栏** / **行号 > 文件实际行数**（`split('\n')` 尾元素造成的**幻影行**，(b) 的 `> lines.length` 抓不到）⇒ FAIL；★ **只判单点引用**，区间引用（如 `a.js` 第 10-20 行）**不判**，因为区间**起点早一行**落空行是无害写法（实测 `art-deco/SKILL.md` 第 106 行、`shadow-puppet/SKILL.md` 第 101 行、`test/README.md` 第 581 行三处全是这种形态）⇒ **误报率：初版（不分单点/区间）命中 13 / 误报 3 ⇒ 精度 77%；定稿版（只判单点）命中 13 / 误报 0 ⇒ 精度 100%** ⇒ **判 FAIL 而非 backlog**（与 (c) 不同，(d) **没有误报机制**：「被引行是空行/分隔线/围栏/不存在」没有任何合法读法能解释成「我指的就是它」；降级条件写在脚本头注释里））。**路径感知**（不做全仓 basename 模糊匹配 —— 实测会把 `main.js:566` 命中到另一个 11 行的 `main.js`；同小句里出现带目录的同名路径时以它为准）。**误报率（先测再收窄）**：(c) 初版候选 98 / FAIL 46、**误报约 60%**（`--ratio 16:9` 源码写作 `'--ratio', '16:9'`、`type=='cap'` 写作 `e['type']=='cap'`、`dur 133.0` 写作 `"dur": 133.0`…）⇒ 否决；「距引用 ≤40 但**不限小句**」候选 646 / FAIL 363 ⇒ 否决；「只认高置信形态 + 先排除引用自身」候选 37 / FAIL 17、**误报 0** ⇒ 采用；子串匹配换 token 匹配 ⇒ 最终 **37 / 10**。**不收窄成只查 (a)(b)**：(c) 是唯一能抓「行号在范围内、但那一行已经不是它说的东西」的判据。**豁免（只列不判）**：`(^|/)logs?/` 或 `.log$` —— `_distill/logs/*.log` **两仓都被 `.gitignore` 排除**、每次跑都重写、行号天然会变。**两层语义**：**本引用所在小句**内含「已登记失效」标记 `已失效|待修|已知失效|原为|原记|已登记|已废弃` ⇒ 只列不判（同 `check-tp-prose` ④，粒度收到**小句**）；★ 同一小句里出现 **≥3 个不同标记** ⇒ 那是**词表**不是登记、**不豁免**（否则本闸门自己的说明行会把自己永久豁免 —— 「匹配判据可被无关文本满足」）；★★ **2026-10-06 两次收紧（同一形态的病犯了两次）**：① 整行 → 小句（旧版整行粒度下，一行只要顺口写了「禁止照抄任何**历史**海报的构图」就整行豁免 —— 实测 swiss-motion 的 SKILL.md 第 30 行；**故意不用「距引用 ≤40」**：小句已够紧、又能保住「已登记待修的（a.js 第 1 行、b.js 第 2 行）」这类**列举式登记**）；② 剔除泛词「历史」（普通词、与失效无语义绑定）、补「已登记/已废弃」（「原为/原记」保留 = 本仓「原文保留 + 追加更正」固定用语）。**夹具**：fx1a（行含「历史海报」但与引用无关）改前 backlog ⇒ 改后 **(b) FAIL**；fx1c（标记在**同行别的小句**）改前 backlog ⇒ 改后 **FAIL**；fx1b（标记与引用**同小句**）改前改后**都 backlog**（未误伤）。**真实语料**唯一被整行豁免的 hd-2d 的 SKILL.md 第 196 行（它说 mux.sh 第 60 行有 `LN_TP = -1.7`，而 `LN_TP` 实际在第 94 行）改前 backlog ⇒ 改后 **(c) FAIL**（该行「原记」指的是旧真峰值读数、不是这条引用 ⇒ 真阳性）。★ **(a) 报错文案订正**：旧版对裸文件名失败写「**全库也没有同名文件**」，而「全库」其实只有 `styles/` 树 —— 实测 scifi-toon 的 SKILL.md 引裸名「sfx.py 第 9 行」被判「全库没有」，而 `core/audio/sfx.py` **确实存在** ⇒ 现如实说「按**文件名**只搜过『本风格树 + `styles/` 全树』，**没有**按文件名搜 `core/`/`scripts/`/`tools/`」并给修法；**判据不扩到 `core/`**（扩了就是被否决过的 basename 跨树模糊匹配）。★ **引用形态补逗号组**：N / N-M / N/M / **N-M,K,…**（每段都核）—— 旧正则没有 `,` ⇒ 这类引用整个不被识别（scifi-toon 的 SKILL.md 第 76 行引 story.js 的 1-6 与 66）。**误报率（先测再收窄）**：先 `grep | grep ','` 摸语料，新增识别 **155 条**（本项目 DOCS 内 **142** 条）、形态 `N,N` 79 / `N-N,N-N` 17 / `N,N,N` 17 …，**155/155 全是行号组、0 误吃**；真实语料新增 FAIL = 0。**同一快照对照**：引用 3655 → **3797**、FAIL 0 → **1**（唯一新增即 hd-2d 那条）、只列不判 215 → 245（logs 198 → 229，全是逗号形态的日志行号组）。多义引用（`demo/test.js:9` 全库 9 处同名）与欠指明引用（`mux.sh:151`，本风格树里没有、全库 12 处）也只列不判。**失明守卫**：一个引用都没找到 ⇒ **FAIL 并明说「本闸门已失明」**；引用全解析不到也判失明。**验证（临时树 + 覆盖点）**：`fx-ok`（`:331` 的 `--ratio 16:9`）**exit 0**；`fx-b-range`（`:999`）**exit 1 + (b)**；`fx-b-file`（不存在）**exit 1 + (a)**；`fx-b-content`（`:305`，**行号在范围内但内容不对** = 本会话真实漂移形态）**exit 1 + (c)**；`fx-blind`（无引用）**exit 1 + 「已失明」**；`fx-registered`（超范围但整行写了「已登记待修」）**exit 0 + backlog**；**(d) 的 5 个夹具（2026-10-06 补）**：`fx-A`（指向**空行**）**exit 1 + (d)**、`fx-B`（指向 `---`）**exit 1 + (d)**、`fx-C`（行号 = 实际行数 + 1，**幻影行**）**exit 1 + (d)**、`fx-D`（**区间引用**起点落空行 = 那 3 处无害写法的形态）**exit 0**（**不许抓**）、`fx-E`（正常引用）**exit 0**；另验 `fx-F`（**0 引用**）**exit 1 + 「已失明」**（失明守卫未被 (d) 破坏）、`fx-G`（`***` / `___` / 围栏）**(d) 3 处**。同轮真实语料 (d) 命中 **13** 处、**逐条人读误报 0**（清单与「真内容在哪一行」见脚本头注释）。**真实语料首跑**：3652 处引用 / 3436 处解析到文件 ⇒ (a) **2**、(b) **24**、(c) **10**，只列不判 **217**（logs 198 / 多义 10 / 欠指明 6 / 已登记 4）—— 其中 `MAINTAINING.md:328` 的 `` `scripts/style-distill.mjs:189` `` 正是那次漂移的残留。**已知局限**：(c) 覆盖面窄（真实语料仅 **37/3652** 处落在判据内，**有意取舍：宁可少判不可乱报**）；启发式（非 AST），**不加反引号**的 `foo.js:12` 看不见；风格源码被**重构成多模块**的老文档（`ascii-crt`/`one-line`/`scifi-toon` 把 `main.js` 拆成若干模块）会报大量「行号超范围」—— 那是真失效，但修法是重写引用。★ (d) 的已知局限：只管「**那一行有没有内容**」、不管「内容对不对」（被引行是正文但写的是别的东西 ⇒ (d) 看不见，那是 (c) 的活，而 (c) 只覆盖少数引用 ⇒ 两条合起来仍有缝）；**区间引用整个不判**（代价：区间型失效也放过）；「结构性行」只认 `-{3,}` / `*{3,}` / `_{3,}` / `` `{3,} ``（不认 `~~~`、不认 `#` 标题行）。覆盖点 `LEMO_TOOLS_ROOT` / `LEMO_OPUSCAR` / `LEMO_STYLES_ROOT` / `LEMO_DISTILL_ROOT`
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
   最近一次有意改动：**2026-10-06** 补上 art-deco 漏跑的变调步 `tools/pitch.py`（`dfa990…` → `caab495…`），
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
