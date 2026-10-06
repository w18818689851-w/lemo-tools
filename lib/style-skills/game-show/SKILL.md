---
name: lemo-style-game-show
description: 【lemo 风格 Skill · 综艺节奏扁平】把题材拆成一局局「节奏关卡」的扁平矢量综艺——粗墨线玩具吉祥物踩着固定节拍蹦跳，每关以一个大号判定词收尾，适合讲发展史/年度回顾/榜单与对阵。选定本风格做视频时，优先读本文件。
slug: game-show
name_zh: 综艺节奏扁平
category: 游戏
film: Rhythm of AI, 1997 → 2026
---

# 综艺节奏扁平（`game-show`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/game-show/STYLE.md` · `styles/game-show/DEMO.md` ·
> `lib/style-dna/game-show.json` · `lib/style-dna/game-show.md` · `lib/dub-styles.json#game-show` ·
> `styles/game-show/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部「**节奏游戏式的综艺节目**」——玩具般的吉祥物（粗墨线描边）站在糖果色条纹与太阳 burst 上，每一次打击都落在**固定的速度网格**上，是「呼—应」的模式，每一局赢的时候弹出一个**判定词**（STYLE.md:3）。

**不是什么**（最容易做错的邻居风格）：不是微型游戏大杂烩（没有计时器、不是每 3s 换一种画风）；不是中世纪卡通（没有手绘质感背景、没有角色表演）；不是发布会（没有慢揭示、没有渐变）（STYLE.md:15）。

**什么时候用它**：讲**有阶段/有胜负/有年度**的题材——技术发展史、年度回顾、榜单对阵、A vs B 的比拼；格式从 **45s（三局）到约 3min（八局）**，旁白可选，可以只靠短呼喊和字幕撑起一部片（STYLE.md:6）。

**一句话内核**：一切都在网格上；每一关 = 一个可重复的动作 + 一个赢（STYLE.md:10,13）。

**边界**：撑不起需要细腻情绪、连续叙事、安静独白的内容——本风格是「亮、吵、机械精确」的，没有角色表演也没有慢揭示（style-dna/game-show.md:123）。

---

## 2. 画面构图

- **镜头数与画幅**：全片**无运镜旅行**，从头到尾是**正面、对称的舞台台口**，是画框自己在动（beat punch）（DEMO.md:31）。原生 **16:9（1920×1080）**；★ **2026-10-04 已声明多比例**（见下）。
- **主体位置与占比**：角色站在**地板带**上（y = 860–900，顶上一条约 8px 墨线）；横幅在**左上角**、判定词在**中央偏上**（STYLE.md:67, DEMO.md:61）。
- **负空间 / 留白**：布景是满幅饱和底 + 同色系图案，几乎没有留白；负空间靠**硬偏移阴影**制造图层感，而非柔光（STYLE.md:20）。
- **图层叠放顺序**（从底到顶）：饱和底色 → 同色系图案（斜条纹/波点/太阳burst）→ 更暗地板带 + 墨线 → 角色/道具 → 硬偏移阴影（描边色 +10~14px）→ telop 字幕/卡片/判定词。
- **安全区**：角色在地板带上；banner 左上 (x=56,y=44)；判定词中央偏上；字幕 telop 牌在底部。同时 punch 总和须 < ~0.06，否则露画框边缘（STYLE.md:67）。
- **本风格**不能**出现的构图**：慢揭示、渐变背景、柔阴影、脱离网格的运动、溶解叠化（STYLE.md:15, 104）。

**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。改造**没有**逐处改写绘制点（本风格是 1588 行内联脚本 + `#stage` SVG 与 `#paper`/`#fx` 两张 1920×1080 画布，逐处改必然静默错位），而是只改**一个页面外壳文件** `demo/index.html`：影片本体仍按**固定设计帧 1920×1080** 画（一字未改），当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧等比装入**（contain）并居中，留边露出页面底色 `#F4ECDD`（本风格的米色纸底）。声明在**新增的薄壳** `demo/film.js`（`FILM_META.aspects`，控制台按源码文本探测——它只扫 `demo/film*.js`，而本风格的影片本体是 `index.html` 的内联脚本，`main.js`/`main_b.js`/`main_v1.js`/`remix2026.js` 只是它的构建输入，都不在这个命名约定里）。`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`。

- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform、不改 body 尺寸）；改造前/后同参渲三帧（15%/50%/85%），**跨进程 md5 逐字节相同**。
- **9:16 不裁切**：整张台口（左上横幅、选手、记分牌、底部字幕牌）**全部在画面内**（实测：9:16 vs 16:9 中心裁切 SSIM 0.62–0.74，vs 理想等比装入 SSIM 0.986–0.994）。
- **已知代价**：① 竖屏下有效画面只占 1080×607，**分辨率按紧轴缩放**，满幅饱和底被缩到 56.25%；② 台口是满幅底色，上下留边是**米色纸底**（#F4ECDD），与台口满幅色之间是一条可见的纸边；③ 其它比例同理（3:4 / 4:3 / 1:1 已支持）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 墨线 | `#1B1B1B` | 所有描边 / 硬阴影 | DEMO.md:50 |
| 纸 | `#FFFFFF` / 奶油 `#FFF6E5` | 卡片、成绩单底 | DEMO.md:55 |
| 糖果主色 | `#FFD23F` 黄 / `#FF8C42` 橙 / `#FF5A5F` 红 / `#FF8FB1` 粉 | 布景、判定词 | DEMO.md:56 |
| 糖果主色 | `#5BD68A` 绿 / `#C6F16D` 青柠 / `#8ED1FC` 天蓝 / `#4D7CFE` 蓝 | 布景、角色 | DEMO.md:56 |
| 深布景 | `#6B4FBB`/`#46318F` 紫、`#3FB8AF`/`#2B8F88` 青、`#26264A` navy | 夜/终章布景 | DEMO.md:57 |
| 道具 | `#C98A52`/`#8E5530` 木、`#C3CAD9` 灰、`#FFD1A8` 肤色 | 讲台、木头 | DEMO.md:58 |

- **明度 / 对比规则**：**墨 + 纸 + 糖果**三件套；大词用白或黄 + 粗墨描边；判定词可粉可黄（STYLE.md:31）。
- **禁止出现的颜色**：渐变（任何形式）、柔和的低饱和色调、纹理色（STYLE.md:20）。
- **同一画面最多几个色相**：**一套布景 = 一个色相**（背景、图案、关卡卡同色相，卡片随布景换色）；相邻两关不共用色相；角色的身体色是它的身份、永不变，且**不与所站布景同色相**（STYLE.md:29-30）。

---

## 4. 转场规则

- **镜头之间怎么切**：**小节线硬切 + 很短的白色闪（约 0.08s）**——每次换关/换布景都是硬切在 bar 线上（STYLE.md:49, DEMO.md:36）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：只有**白闪**；**全片唯一的一次淡出**是结尾最后 0.8s 淡到 navy（STYLE.md:49, DEMO.md:38）。
- **硬切点怎么定**：关卡卡那一小节的首拍；demo 关卡卡小节全部登记在 `CUTS`（`main_b.js`）里（DEMO.md:134）。
- **转场时长与缓动**：白闪约 0.08s；punch 约 0.16s 衰减；出现用 back-ease、退出用 ease-in，**没有任何慢淡入**（东西要么就在、要么「啪」地弹出）（STYLE.md:47）。
- **绝对不要的转场**：溶解 / 叠化（STYLE.md:67）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | 中文 **Noto Sans SC 900**；拉丁展示 **Fredoka 700**；手写道具 **ZCOOL KuaiLe** |
| 字号（相对画面宽 / 高） | 标题「AI 进化节拍」200px（≈10.4% 画面宽）；判定词 120px；关卡名自适应到 720px 宽 |
| 颜色 / 描边 / 阴影 | 白或黄填充 + **约字号 14% 的墨色描边画在填充下面**（`paint-order: stroke`）（STYLE.md:37） |
| 位置 / 安全边距 | banner 左上 (56,44)；判定词中央偏上、−6° 斜角；字幕 telop 牌在底部 |
| 单行字数上限 / 最多行数 | 横幅一行 ≤ ~20 个 CJK 字；牌子 ≤ ~12 个 CJK 字（拉丁约宽 1.6×） |
| 出现与消失方式 | 标题**逐字构建**、每字弹出间隔 0.06s；打字机每 1/8 拍一个字、每 2 字一次键击；停留 ≥ max(1.8s, 语音 + 0.6s) |

- **字幕与旁白的关系**：**字幕就是 telop**——关卡卡、角贴横幅、标签、道具文字与判定词承载意义；**没有细的通用 caption**。样本片屏上全中文、声音只有短英文呼喊、**无旁白**（DEMO.md:8, STYLE.md:38）。
- **本风格特有的字幕禁忌**：不用长句/从句/书面语；一句不塞两个信息点；不要做成细描边 caption（style-dna/game-show.md:50）。

---

## 6. BGM / 音效特征

> 本风格成片音轨**已由「静音占位」修成真实混音**（见第 11 节）；以下为**实测**的声音设计与数字。

- **配乐**：**全部从画面事件合成**（`music.py` + `synth_lib.py`，纯 numpy/scipy **代码合成**，`demo/CREDITS` 明写 "No samples, no third-party music"）——软饱和正弦 kick、带通噪声军鼓与拍手、hats、slap bass、带关闭滤波的失谐锯齿 brass stab、带颤音方波主音、马林巴式拨弦、音乐盒铃、三角波 pad、方波琶音、牛铃（STYLE.md:71）。**明亮大调流行和声**在一条短和弦循环上：demo 是 **150 BPM**、一小节一个和弦、**F–G–Em–Am** 王道进行；每关有自己的味道（funk/quiz/electro/dream/heavy…），不是换一首新歌（DEMO.md:42）。
- **拟音（foley）**：玩具化、**带音高**——pop、plop + boing 落地、印章、打字机键击、蜂鸣器、叮、伺服嗡鸣、splat；带音高的 pip 可在人群降落时拼出旋律（STYLE.md:73）。`events.json` 的 **474 个事件**由 `music.py` 的事件循环逐条映射到音效。
- **旁白处理**：无旁白。**呼喊，不是句子**：1–3 个词（`Hey!`、一个数字、一个判定），放在拍点**前 20–30ms** 让辅音落在拍上；人群呼喊 = 好几个不同嗓音叠 5–6ms、pan −0.6…+0.6（DEMO.md:45）。**本次成片 40 条呼喊全部落地**：原设计用 macOS `say` 系统声线（`name|voice|rate|pitch|text`，如 `title|Samantha|190|1.18|A. I. Beat!`、`checkmate|Zarvox|200|1.0|Checkmate.`），本机改用项目自带**离线 Kokoro** 重建（`demo/make_voices_kokoro.py`，见第 11 节）；声线映射 Samantha→`af_heart`、Kathy→`af_bella`、Junior→`af_sky`、Fred→`am_michael`、Ralph→`am_fenrir`、Superstar→`am_puck`、Zarvox→`am_onyx`。
- **响度目标**：`−14 LUFS`，真峰 ≤ −1 dB；**软削波（tanh）而非硬限幅**（STYLE.md:76）。**成片实测 `I = −14.0 LUFS`、`LRA 4.2 LU`**；但真峰值 `input_tp = −0.22 dBTP`，**超出项目 −1.2 dBTP 交付目标 0.98 dB（削波，见第 11 节）**。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 −0.22 dBTP → **−2.09 dBTP**、已在 −1.2 dBTP 交付线内（达标）；原 −0.22 dBTP 记录保留为历史。
- **静音策略**：静默是**强度手段**之一（一小节只剩鼓然后一个大击，或一小节静默被一声呼喊打破），不当主结构（style-dna/game-show.md:81）。

---

## 7. 素材偏好

- **需要什么素材**：**纯矢量**，全部由 SVG/canvas 路径在 1920×1080 现场绘制——**不需要任何外部图片/视频素材**；字体三个家族（Noto Sans SC / Fredoka / ZCOOL KuaiLe，本地 woff2 子集）（STYLE.md:19, DEMO.md:63）。
- **不需要什么素材**：不需要真实照片、不需要纹理贴图、不需要品牌 logo 或官方 UI；真实品牌只能以「名字写在小名牌上 + 原创吉祥物 + 松散配色呼应」的方式出现（DEMO.md:84）。
- **取景 / 质感 / 比例偏好**：平涂填充、一种描边色、圆角连接与端帽；角色与道具 8px 描边、小零件 5–7px；硬偏移阴影 +10px（贴纸/横幅）到 +14px（卡片）（STYLE.md:19-20）。
- **可替代方案**（缺素材时怎么降级而不破风格）：**macOS 系统声线（`say`）不可用时**，改用项目自带**离线 Kokoro**（`core/tts/tts.py`）重建呼喊（本风格已这么做，见第 11 节），而不是退回静音占位；字体缺失会导致 `measure()` 量错宽 → telop 溢出牌子，必须先加载字体再 `buildAll()`（STYLE.md:96）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 一关 = 1 小节关卡卡（1.6s）+ 8 小节玩法（12.8s），共 **9 小节 = 14.4s** |
| 全片时长 | **148.8s**（3571 帧 @24fps，93 小节 = 148.8s） |
| 镜头数 | 无传统镜头切换；结构为 4 + 7×9 + 1 + 16 + 9 = **93 小节** |
| 信息投放节拍 | 冷开场全员 + 报数（4 小节）→ 7 关（每关 9 小节，最后一拍 [第 7 小节第 3 拍] 是 slam + "Perfect!"）→ REMIX 卡 + 16 小节 remix → 结尾 9 小节（蛋 2 + "Hi!" 1 + 成绩单 3 + 信用卡 3，含 0.8s 淡出） |

- **加速 / 减速点**：每关前半建立模式、后半回应/升级；REMIX 关把近期事件堆到一块布景、缩略图缩进底部槽；结尾用**半速一小节**做揭示（STYLE.md:75, DEMO.md:25）。
- **留白与静音的位置**：大击前一小节只剩鼓；一小节静默被一声呼喊打破（STYLE.md:75）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/game-show/DEMO.md` 的 build notes 为准（本风格 demo 目录**没有 build.sh**）。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/game-show/demo --fps 24 --workers 6 --size 1920x1080 --out …`（demo 原用 `node render.mjs video 6`） |
| 帧率 | 24fps（内容按 150 BPM / 一小节 1.6s 网格排布） |
| 分辨率 / 比例 | 1920×1080 / 16:9（原生）；★ 2026-10-04 起支持 16:9 / 9:16 / 3:4 / 4:3 / 1:1（**页面外壳等比装入**，见第 2 节；纯 SVG DOM + Playwright + Chrome Headless Shell 截帧） |
| 混流 | `core/render/mux.sh`（→ nvenc） |
| 编码器 | `h264_nvenc`（本地 GPU） |
| 音频入口 | `mix.py`（编排器的混音步入口，2026-10-05 新增的薄壳：无参数、调既有 `music.py`、输出 `demo/mix.wav`）→ 实际合成仍是 `music.py`（score + events.json → SFX + shouts → ducked mix） + `synth_lib.py`；呼喊由 `make_voices_kokoro.py`（离线 Kokoro）生成到 `voices/` |
| 字幕入口 | `make_srt.py`（→ game-show.srt，只列英文呼喊）；屏上文字是 telop 本身 |
| 事件导出 | `node core/render/events.mjs styles/game-show/demo`（→ events.json，474 条） |
| 本风格专属参数 | ~~音频链**不在编排器内**（`lemo-make.mjs` 对本 demo 报 `STEP_FAIL`，见第 11 节），需手动跑 `music.py` → `core/render/mux.sh`~~ **★ 2026-10-05 起已并入编排器**（新增 `demo/mix.py` 后，`lemo-make.mjs game-show --ratio 9:16` 会自己跑「配乐 → 混音 → 混流」，无需 `--skip-audio`）；渲染 3571 帧 / 6 workers ≈ 75s |
| 一键复现 | 无 build.sh；按 DEMO.md 十步手动走，另加一步「`make_voices_kokoro.py` 重建 40 条呼喊」 |

---

## 10. 编排规则

- **内容文件字段契约**（`content_fields`）：`SECT`（每个关卡卡的首小节，`main_b.js`）、`CUTS`（白闪小节线）、`END_BAR`（由 `assemble.py` 字符串替换设定）；关卡卡 `card(bar0, num, name, years, col, col2, icon)`；年份横幅 `banner(g, year, name, sub, col)`；`music.py` 的 `PLAN[bar]` 与 `span(a,b,mode)`；呼喊行 `voices/lines*.txt`（`name|voice|rate|pitch|text`）（style-dna/game-show.md:166-168）。
- **事件词汇表**：画面里每个 `ev(t,name,{f,i})` 都导出到 `events.json`（demo 474 个）。`music.py` 映射：`tock/bleep`（象棋）、`stone`（围棋）、`ding/boop/buzz`（答题）、`land`（plop+boing）、`pip`（带音高 pop，用 `f`）、`slam/bigslam`、`stamp`、`type`、`crack/hatch`、`servo`、`liftoff`、`swish`、`clap`、`drop`、`blip`、`kickhit`、`splat`、`denoise`、`cheer`；呼喊是 `v:<name>` 事件，播放 `voices/<name>.wav`；未知名字被静默忽略（DEMO.md:44）。
- **时间线契约**：`frame_head.html` 基础助手（`el/txt/tf/op/E/chars/charsPop/measure/bg`）；`main_v1.js` 速度网格（`at(bar,beat)`/`B`/`BARL`/`frac`）+ `ev`/`punch`/`hopY`/`hitSq` + 字幕/布景/爆发/判定/横幅；`main_b.js` 角色 + `scene(t0,t1,build)` + `card` + `render(t)` + `init()`。**契约**：`scene()` 只建一次节点、返回 `update(t)`，`update` 只设属性（DEMO.md:143）。
- **新增主体怎么接入**：角色用 `bean(parent,{color,belly,antenna,name,kind,...})` + `pose(c,{hey,open,sq,lean,face,blink,...})` / `poseAny`；人类 `human(...)`；道具 `podium/taskIcon/smallBot`；`CAST` 有 16 个现成选手（gpt/claude/gemini/llama/deepseek/ernie/qwen/mistral/kimi/grok/bert/dalle/mj/sd/sora/baby）（DEMO.md:160-165）。
- **换主题时要改哪些文件**：`main_b.js`（`SECT` / `CUTS` / 关卡卡文本 / 道具文字 / 成绩单 / 信用卡）+ `main_v1.js`（调色板 `K`）+ `music.py`（`PLAN`/`VO`）+ `voices/lines*.txt`；然后 `assemble.py → build.py`。**`main.js` 与 `index.html` 是生成物，直改会被覆盖**（DEMO.md:131）。
- **与 `dub.mjs` 通路的关系**：`lib/dub-styles.json#game-show` 生效参数——palette（bg `#FFF6E5` / bg2 `#6B4FBB` / fg `#1B1B1B` / accent `#816300`）、bgRecipe（gradient 双色）、subtitle（SimHei 粗体、fontSizeFactor 0.04444、marginV 0.14537、描边 0.0062）、title（fontSizeFactor 0.1）、overlay（chapterCards + accentRule + progressBar 开）。**注意该条为 `derived:true` 派生条目**，不是逐行手抽：配色取自 `lib/dub-visual.json` 的 demo 代码抽取；字幕字号/位置走「分类别默认」（类别 dark-glow + 厚描边，`STYLE.md §4` 只给字幕形态、没给 px）；字幕颜色由 **WCAG 对比度规则**从底色 `#FFF6E5` 推得（亮底→深字）。**字体口径**：通路按 `_notes[5]` 把 `subtitle.fontFamily` 填成**本机字体** `SimHei`（黑体，含 CJK）—— 样片用的是 Noto Sans SC 900 / Fredoka 700 / ZCOOL KuaiLe，本机都没有。**accent 口径**：`#816300` 不是 demo 的 `#FFD23F`，而是按 `_notes[10]②`「`accent/bg` 一律提到 ≥4.5」调整过的**替换值**（实测 `#816300` 压 `#FFF6E5` = 5.26，而 demo 的 `#FFD23F` 只有 1.35，肉眼看不见）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **★ 成片真峰值削波（超出交付目标 0.98 dB）**：成片实测真峰值 **`input_tp = −0.22 dBTP`**，而项目交付目标是 **≤ −1.2 dBTP**，超出 **0.98 dB**。根因是 **AAC 256k 对本风格这种打击乐素材过冲 +1.48 dB**，远超 `core/render/mux.sh` 为编码预留的 0.5 dB 余量（`LN_TP = −1.2 − 0.5 = −1.7`）。**这是项目级既有缺陷、不是本风格音频链造成的**——全 43 片实测有 **19 个**真峰值超 −1.2 dBTP，其中 6 个为正。★ **真峰值必须用 `ffmpeg -af loudnorm=I=-14:TP=-1.7:print_format=json` 的 `input_tp`（4× 过采样）判读**；`astats` 的 `Peak level dB` 是采样峰值、不是真峰值（本片 astats 读 −0.383280，真峰值 −0.22）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 −0.22 dBTP → **−2.09 dBTP**，已在 −1.2 dBTP 交付线内；音频评分回补 +2（见第 10 节）。
  - ★ **不要用手工压限来「腾」这 0.98 dB**：实测反而更差（原 mix.wav → +0.248；预压 TP=−2.0 → +0.445；预压 TP=−4.2 → +0.879）。原因是 `mux.sh` 的 loudnorm 动态模式总会把响度拉回 −14 LUFS，真正决定过冲的是**波峰因数**。正解在 `mux.sh` 的 `LN_TP` 余量（需项目级统一调整）。
- ~~**编排器不支持本 demo 的音频链**：`lemo-make.mjs` 的混音步明确写「game-show / halftone-dossier / pictogram-motion 没有 `mix.py`，用的是另一套音频架构 → `STEP_FAIL`」，并提示「它自带 `finish.sh`，请直接跑那个脚本」。这是当初只能 `--skip-audio` 的**结构性原因**，不只是缺 macOS `say`；本风格音频需手动跑 `demo/music.py` → `core/render/mux.sh`。~~ **★ 2026-10-05 已修**：新增薄壳 `demo/mix.py`（**不接受任何命令行参数**、用同一个解释器 `sys.executable` 调既有 `music.py`、把它的输出路径指向契约要求的 `demo/mix.wav`；**不重写任何配乐/混音逻辑、不碰视频**、幂等），编排器混音步已命中本风格。实测走标准「主题出片」通路（`node lemo-make.mjs game-show --ratio 9:16 --skip-sync --out D:/lemo-films/_mixfix/game-show`）：`MIX_OK 26248368 …/styles/game-show/demo/mix.wav`、`MUX_OK 98990393 src_frames=3571 out_frames=3571`，成片 1080×1920 / 148.79 s / 真峰值 **−1.39 dBTP** / 响度 **−14.06 LUFS**（两条交付口径都达标）。★ 这条缺陷原本**没有**独立扣分项（`_distill.json#defects` 里没有 `【audio −N】`），故 `scoreBreakdown` / `matchScore` 不变。
- **Zarvox（机器人/AI 播报）音色是近似**：Kokoro **没有真正的机器人声线**，`am_onyx` 只额外叠了一层 55 Hz、深度 0.35 的幅度调制（`aeval=val(0)*(0.65+0.35*sin(2*PI*55*t))`）来近似原 macOS `Zarvox` 的质感——**听感比原声线更「人」**，是本风格核心特质上的一处已知差距。
- ~~**9:16 硬渲会丢画面**：无 `aspects` 声明，产品默认 9:16 导出时右侧约 43.75% 丢失、下方黑边；对称台口被破坏。~~ **★ 2026-10-04 已修**：`demo/index.html` 加「设计帧等比装入」外壳 + 新增薄壳 `demo/film.js` 声明 `aspects`（5 个比例全支持），9:16 下整张台口都在（见第 2 节）。残留代价：竖屏有效画面只占 1080×607、留边为米色纸底。
- **本 demo 没有 `build.sh`**，一键复现只能照 DEMO.md 十步手动走（外加 Kokoro 呼喊重生成一步）。

### 素材缺口
- 无外部图片/视频素材需求（纯矢量）；三个字体家族（Noto Sans SC 900 / Fredoka 700 / ZCOOL KuaiLe）需本地 woff2 子集就位，否则 telop 量宽溢出。
- macOS `say` 系统声线（Samantha/Fred/Zarvox/Junior/Kathy/Ralph/Superstar）本机不可用，已用离线 Kokoro 替代；若要还原原声线仍需 macOS 环境。

### 能力限制
- 依赖 Playwright + Chrome Headless Shell 截帧；3571 帧 / 6 workers ≈ 75s。渲染约 145MB 中间片再混流。
- `render(t)` **必须是 `t` 的纯函数**——曾经 remix 缩略图只在 `t < t1+0.01` 更新，6-worker 冷启动时显示初始状态（v3 成片 124.0–131.2s 底部缩略图是错的，已修）（DEMO.md:130）。
- `synth_lib.py` 分配固定 `DUR = 150.0s` 缓冲，更长的片子会切尾（DEMO.md:135）。

### 踩过的坑（本机实测）
- 原 `demo/make_voices.sh` 依赖 macOS `say`，本机没有 macOS ⇒ 40 个 wav 一个都没有 ⇒ `music.py` 直接 `FileNotFoundError: voices/title.wav` 崩掉。改用 `core/tts/tts.py`（离线 Kokoro）+ 新增 `demo/make_voices_kokoro.py` 重建，**没有改原 `make_voices.sh`**（两侧 md5 仍为 `57f0900bbfea7360f5a98e0a5b3bdb2c`）。
- **修了一处既有缺陷（1 行，可回滚）**：`demo/music.py:279` `else: addv(VO[v], t - 0.03, 0.85)` → `else: addv(VO[v], max(0.0, t - 0.03), 0.85)`。原因：`events.json` 第 1 个声音事件是 `{"t":0,"s":"v:title"}`，而 `addv` 里 `i = int(-0.03*44100) = -1323 < 0` 会直接 `return` ⇒ **开场呼喊 "A. I. Beat!" 从来没进过混音**。复验（差分法）：`title` 窗口差分 RMS 从 **−64.6 dBFS → −23.09 dBFS**；79 个 `v:` 事件从 **78/79 → 79/79** 全部命中。回滚：`cd styles/game-show/demo && git checkout -- music.py`。
- 混流走 `core/render/mux.sh`（`LEMO_VENC=h264_nvenc`，**GPU**），**不是** demo 自带的 `finish.sh`（那个写死 `-c:v libx264` = CPU，违反「一律本地 GPU」硬规则）。
- 音频链产物实测：`demo/mix.wav` 28,569,682 B / 48 kHz 立体声 / 148.800021 s / `I = −15.5 LUFS`、真峰值 `−1.6 dBTP`；`demo/music.wav` 26,248,368 B / 44.1 kHz 立体声 / 148.800023 s / `I = −15.5 LUFS`、真峰值 `−1.7 dBTP`、采样峰值 astats `−1.780786 dB`；`demo/voices/*.wav` 40 条 / 44.1 kHz 单声道 / 非静音（peak 0.270–1.000）/ 时长 0.455–1.395 s。（★ 2026-10-05：新增 `demo/mix.py` 后 `demo/mix.wav` 改由它重写为 `music.py` 的 44.1 kHz 输出 —— 26,248,368 B / 44.1 kHz / 148.800023 s / `I = −15.53 LUFS` / 真峰值 `−1.72 dBTP` / LRA 4.20；上面那份 48 kHz 的旧 `mix.wav` 是此前手工重采样的产物，保留作历史。）

### 下次迭代优先补什么
- 在 `mux.sh` 层面把 AAC 过冲余量纳入考虑（提高 `LN_TP` 余量），把本片真峰值压回 −1.2 dBTP 以内——这是 19/43 片共有的项目级问题。
- ~~让编排器识别本风格的手动音频链（`music.py` → `mux.sh`），免去 `--skip-audio`。~~ **★ 2026-10-05 已完成**：新增薄壳 `demo/mix.py`（见第 11 节），编排器已能自己跑「配乐 → 混音」，本风格走标准「主题出片」通路、不再需要 `--skip-audio`。
- 若要在意 Zarvox 音色，接入真正带机器人质感的已清权 TTS，替换 `am_onyx + AM` 的近似。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03（音轨修复后回填） |
| 成片 | `D:/lemo-films/game-show/game-show.mp4`（148.79s / 91,221,830 B / 1920×1080 / 24 fps / 3571 帧） |
| 音频实测 | `I = −14.0 LUFS` · `LRA 4.2 LU` · 真峰值 `input_tp = −2.00 dBTP`（在 −1.2 dBTP 目标内） |
| 抽帧 | `D:/lemo-tools/_distill/frames/game-show/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **94/100**（2026-10-05 校正：原 92，9:16 画幅缺陷已修并回补 composition +2）（2026-10-03 校正：原 90，音频真峰值缺陷已修，audio +2）（音频分项 6 → 16，见 `_distill.json`） |
| 详细资料 | 有（STYLE.md / DEMO.md / style-dna md+json / dub-styles / style.json / voices/lines*.txt / demo/CREDITS / demo/music.py / demo/make_voices_kokoro.py / game-show.log） |

**逐帧拆解要点**：f01 开场标题集——黄色太阳 burst 底 + 中央白字「AI 进化节拍」26px 墨描边 + Fredoka 副标题「RHYTHM OF AI · 1997 → 2026」，下方一排彩色豆形吉祥物踩拍蹦跳。f05 关卡「2011 IBM Watson」——深蓝底 + 左上年份横幅贴纸，中央白底墨框面板问「π 的前三位？」，下方三个讲台记分牌（KEN/BRAD $0、WATSON $12,000）。f08 关卡「2018–2020 GPT-1/2/3」——青绿底 + 斜条纹，绿色 GPT-3 大脸豆与黄色机器人，右上「1750 亿参数」黄字墨描边。f13 关卡「2023 百模大战」——紫底，满场彩色豆角色 + 名字小牌，前排一排。f17 关卡「2025 智能体」——薄荷底 + 波点，三个讲台各站一个豆角色举臂。f20 REMIX 集——紫底太阳 burst + 顶部月份带（1月…12月）、中央「3.8 Flash / 2026 · 9月」卡片、底部一排缩小缩略图 + 「Gemini 连续升级」。f23 成绩单——navy 底，奶油色圆角卡片「AI 进化史 · 成绩单」打字机逐字打出。f24 信用卡——navy 底，奶油卡「LemoLab × Claude Opus 5.5 / 本片由 Claude Opus 5.5 全程代码生成 / 下一关：正在训练中……」。全程硬切 + 白闪、无渐变、无柔阴影、无运镜；色相每关换一套、相邻关不同色。

**自检发现的缺陷**：成片真峰值 −0.22 dBTP 超 −1.2 dBTP 目标 0.98 dB（AAC 过冲，项目级）；编排器不支持本 demo 音频链；Zarvox 音色为近似；9:16 不支持；无 build.sh。 ★ 2026-10-03：成片真峰值已修（−0.22 dBTP → −2.09 dBTP，音频重混），见第 11 节。

**本次为补齐短板做了什么**：① 用离线 Kokoro（`core/tts/tts.py` + 新增 `demo/make_voices_kokoro.py`）重建 40 条呼喊，替换 macOS `say`（原 `make_voices.sh` 未改，md5 不变）；② 修复 `music.py:279` 一行缺陷，让 `t=0` 的开场呼喊进入混音（79/79 命中）；③ 走 `core/render/mux.sh`（GPU nvenc）重新混流，成片音轨从 −70.0 LUFS 静音变为 `I = −14.0 LUFS` 真实混音。**本次文档回填只写 `lib/style-skills/game-show/`；未改 `lemo-make.mjs`，未改 `lemo-opuscar` 下其它源码。**
