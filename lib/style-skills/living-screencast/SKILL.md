---
name: lemo-style-living-screencast
description: 【lemo 风格 Skill · 活体实机录屏】要做产品走查 / 功能发布 / 上手引导，想让成片「看起来像真录屏」但又完全可控时用。真 UI 全部重画 + 一个低分辨率像素吉祥物住在高清界面里，光标是用户、吉祥物是软件。选定本风格做视频时，优先读本文件。
slug: living-screencast
name_zh: 活体实机录屏
category: 信息与发布
film: Clawd Moves In
---

# 活体实机录屏（`living-screencast`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/living-screencast/STYLE.md` · `styles/living-screencast/DEMO.md` · `styles/living-screencast/demo/build.sh` ·
> `lib/style-dna/living-screencast.json` · `lib/style-dna/living-screencast.md` · `lib/dub-styles.json#living-screencast` ·
> `styles/living-screencast/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部**看起来像真录屏、其实每个像素都是重画的**产品走查片。所有窗口、菜单、diff 行、按钮都用 HTML/CSS/SVG 重绘，所以镜头想去哪就去哪、每个像素都可控、文字在任何缩放下都锐利。**一个由大方块像素组成的吉祥物**住在这个高分辨率界面里——**两种分辨率的对撞就是它的样子**（`STYLE.md:16-18`）。

**不是什么**（最容易做错的邻居风格）：不是暗色科技发布会 keynote（没有黑舞台、没有凭空发明的抽象 UI——这是真产品）；不是像素游戏（世界是高分辨率矢量 UI，只有吉祥物和它的道具是像素）；不是真录屏（没有一帧是截图）（`STYLE.md:24`）。

**什么时候用它**：产品教程、功能发布、上手引导、更新说明。只要「有真产品界面、有可被演出来的功能、有可以量出来的 UI 元素」它就能用。

**一句话内核**：**两个演员，绝不用手**——光标是用户，吉祥物是软件；软件的能动性被具象成一个会跑、会跳、会跺按钮的小人。

**边界**：撑不起没有真实界面的内容。抽象品牌片、纯情绪片、真人出镜、实拍场景都不适合；也不要拿它讲「产品还没有的功能」——**不在文档里的按钮就不在片子里**（`STYLE.md:99`）。

---

## 2. 画面构图

- **镜头数与画幅**：**屏幕内一镜到底**，只在章节转场时切（`STYLE.md:60`）；约 12 段镜头 / 4 个章节。原生 **16:9（1920×1080）**；影片已声明 `FILM_META.aspects = ['16:9','9:16']`（`demo/film.js:10`），即 16:9 与 9:16 都能正确构图。
- **主体位置与占比**：主体是**应用窗口**（浮在壁纸上，柔和阴影，永远不超出显示器）；吉祥物很小（18×10 像素网格），**只站在真实元素的顶边**上——输入框、菜单、文件行、diff 行、按钮、CI 条、标题的字母（`STYLE.md:30`）。
- **负空间 / 留白**：桌面壁纸就是留白；窗口占画面大部分但有边距；底部留出字幕胶囊的位置。
- **图层叠放顺序**（从底到顶）：壁纸（浅色层 / 暗色层双份，供主题切换）→ 应用窗口（程序化 HTML，含柔和阴影）→ 吉祥物与其像素道具（与相机同缩放、位置吸附半像素）→ HUD（章节胶囊 / 按键 HUD / 字幕胶囊 / 「▶▶ 4×」延时标签）→ 转场遮挡（像素块擦除 / 主题揭示圆）。
- **安全区**：字幕胶囊停在底部，**绝不压在被讨论的元素上、也绝不在吉祥物下面**（`STYLE.md:46`）；被讨论的元素与它的字幕不许重叠；**必须为吉祥物留一条无文字的通道**（`STYLE.md:101`）。
- **本风格不能出现的构图**：黑舞台 keynote；画面里出现手 / 手臂 / 手指；缩放超出屏幕（`zoom ≥ 1`）；对**要读的文字**做假景深；把运动模糊加在已变换的层上。

**在 9:16（产品默认）下的表现**：本风格**已适配 9:16**——影片声明 `FILM_META.aspects = ['16:9','9:16']`（`demo/film.js:10`）。这是「世界相机 + 全屏叠加」的混合风格，改造按两套坐标分头做（`demo/main.js:16-22`）：① **世界层**（相机里的桌面/窗口/Claude 应用/精灵/片尾卡）统一「中心对齐 + 紧轴缩放 S」装入当前帧——`#fit` 包住世界层（`index.html:30`），`main.js` 按视口算 `FX/FY/S` 与居中偏移后给它套 `translate(ox,oy) scale(S)`（`main.js:18-22`），相机 `tf` 不变；`A()` 每帧量到的 `getBoundingClientRect`（视口像素）先经这套装入变换还原回设计帧再反算世界坐标（`main.js:45-49`）。② **HUD 贴当前帧**：尺寸/字号/线宽按 `--s`、贴边位置按 `--fx/--fy`（`index.html:164-176` 的 `calc(… * var(--s|--fx|--fy))`），全屏叠加（划像/闪光/淡出/聚光）因此能盖满整帧——划像块阵改由视口算行列数（`main.js:122`），世界映射类的屏幕位置走 `scr()` 的「世界 → 当前帧」换算（`main.js:106`）。1080×1920 实测（`S = 0.5625`）：**不裁切**，横向桌面 + 横向窗口完整落在画面中段一条横带里（左右取景与 16:9 完全一致，只是上下多出主题色的壁纸留白；暗色段留白跟着翻暗，`main.js:37`），字幕胶囊落到**真正的画面底部**、章节签落到**真正的左上角**（不再是画面中段偏左），章节转场盖满整屏。代价是窗口只占画面高度约 32%，上下留白较大——竖版放不下横向界面，这是「不裁切」的必然结果。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 产品浅主题·墨 | `#1F1E1C` | 浅色主题正文与标题 | `DEMO.md:82` |
| 产品浅主题·黏土 | `#D97757`（重读版 `#BD5D3A`） | 强调、吉祥物主色、口号重读词斜体 | `DEMO.md:82` |
| 产品暗主题·墨 | `#EEEAE2` | 暗色主题正文 | `DEMO.md:82` |
| 产品暗主题·黏土 | `#E08565` | 暗色主题下的强调 | `DEMO.md:82` |
| 吉祥物本体 | `#D97757`，暗面 `#B85F40`，眼 `#2A2622` | 像素小人（品牌黏土色） | `DEMO.md:82`、`clawd.js` |
| 道具·铅笔黄 | `#F2C14E` | 像素铅笔等道具 | `DEMO.md:82` |
| 道具·心 / 对勾 | `#E0543A` / `#2F9E4F` | 心形、对勾 | `DEMO.md:82` |
| 叠加层 | 中性磨砂玻璃 + 至多一个取自产品的强调色 | 章节胶囊 / 按键 HUD / 字幕胶囊 | `STYLE.md:39` |

- **明度 / 对比规则**：**产品自己的浅 / 暗主题原样照搬**，不要另起一套调色（`STYLE.md:37`）。吉祥物保持产品品牌色，或用一个 **UI 里没有的饱和色**，保证在任何一帧最先被眼睛找到（`STYLE.md:38`）。**一次主题切换可以是剧情事件**——整片跟着变状态（`STYLE.md:40`）。
- **禁止出现的颜色**：凭空的品牌配色（必须来自真产品）；给字幕加彩色描边；暗色 keynote 的黑舞台底。
- **同一画面最多几个色相**：跟随产品 UI 自身；叠加层**最多一个**强调色。

---

## 4. 转场规则

- **镜头之间怎么切**：**只在章节转场时切**（`STYLE.md:60`）；章节之间是一段连续镜头内的推近 / 漂移 / 甩镜 / rack focus / 拉回，不是剪辑。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**有章节胶囊擦除**、**有像素块擦除**（32×18 个方块从左下扫到右上，中间一只奶油色小吉祥物跑过）、**有主题揭示圆**（暗色从一个按钮的位置扩散到整个应用与桌面）、**有聚光冻结**（推近 + 暗角冻结那个承载承诺的徽章）。**没有**溶解、没有划像、没有截图。
- **硬切点怎么定**：只落在章节转场（样片 `wipe1..4 = 10.2 / 19.2 / 27.0 / 35.4` 秒，全部落在 100 BPM 的拍上）；也可以在转场遮挡下换机位（`STYLE.md:73`）。
- **转场时长与缓动**：帧 f15 就是像素块擦除的中间态——**整屏被黏土色像素块覆盖**，章节标题「It checks its own work」与一只小吉祥物落在块上。主题揭示圆从按钮位置起、持续扩散并**不收回**（后半片一直是暗色），直到结尾最后一记跺脚从吉祥物脚下把光带回来（`DEMO.md:31`）。
- **绝对不要的转场**：溶解或截图；对要读的文字做假景深；缩放超出屏幕。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | 样片：**Inter**（UI）、**Newsreader**（编辑感标题与口号）、**JetBrains Mono**（代码），均为 OFL；dub 通路回退 **SimHei** |
| 字号（相对画面宽 / 高） | 样片：口号 **64 px**（Newsreader）；dub 通路 `fontSizeFactor` **0.03426** |
| 颜色 / 描边 / 阴影 | 样片：**磨砂玻璃胶囊**（半透明 + 模糊），墨色文字，**无描边**；dub 通路 `subtitleBack #B3000000`（深色半透明胶囊）、`outlineFactor 0` |
| 位置 / 安全边距 | **底部胶囊**；dub 通路 `marginVFactor 0.14537` / `marginLFactor 0.06019` / `align:2` |
| 单行字数上限 / 最多行数 | 单句 **11–77 字符**（约 2–15 英文词）；字幕一行，不折行 |
| 出现与消失方式 | 胶囊淡入；dub 通路 `subtitleFadeIn 0.16`；停留 ≥ `max(1.8s, 语音 + 0.6s)` |

- **字幕与旁白的关系**：**信息层只有这四样**——章节胶囊（01–04）、KeyCastr 风格的按键 HUD、磨砂玻璃字幕胶囊、可选的「▶▶ 4×」延时标签，**屏幕上不叠别的**（`STYLE.md:44-45`）。字幕里被强调的词用**黏土色**：样片里 `@`、`diff`、`Plan`、`session`、`Ship it.` 都是黏土色（帧 f06 / f12 / f09 / f18 / f23-f24）。
- **本风格特有的字幕禁忌**：字幕不许压在被讨论的元素上；不许落在吉祥物下面；不许盖住要读的代码；标题如果出现必须是**叙境内（diegetic）**的——作为 UI 的一部分出现（空状态标题、窗口标题、通知），不是浮层（`STYLE.md:47`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「frosted-glass caption pills」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#4C000000`（AARRGGBB，落盘 ASS 为 `&H4C000000`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。**底衬色为回退值**：demo 的 band 未定位到绘制函数，无法取 demo 真值，也就无法核验 demo 底衬与本配置字色的对比度是否达标（<3.0），故改用该风格自身的地色/辅色（palette.subtitleBack #B3000000）；字色 #FFFFFF 与该底衬的 WCAG 对比度 **20.39**。

---

## 6. BGM / 音效特征

- **配乐**：**两个分辨率的配乐**——高保真层（钢琴、立式 / 电贝斯、鼓刷或紧实鼓组、钟琴、真采样）是「世界」；**chiptune 方波是吉祥物**；两者可交替、二重奏或融合（`STYLE.md:77`）。样片约 **104 BPM**（`DEMO.md:68`）。结构：吉祥物落到标题上时乐队进入；每个章节转场一个 tom fill + crash；最后一章**撤掉鼓**制造紧张；暗色模式那一跺把整个乐队交叉淡入成低通「夜晚」版本；分屏变成左右二重奏（钢琴在左、chiptune 在右）；片尾口号每个词是一个 chiptune 音（**C5 E5 G5 C6**），最后一跺打开滤波器给出一个大九和弦（`DEMO.md:58-64`）。
- **拟音（foley）清单**：键盘（thock + click，**带人手时值抖动**）、触控板点击、窗格 swish、浮层 pop、通知铃声、CI tick、截图快门；**吉祥物的走 / 跳 / 落地是 8-bit 的**（`STYLE.md:79`）。
- **旁白处理**：样片 Kokoro `am_michael`、speed 1.0（其他声线会把 Claude 读成 Clod），**一功能一句**，产品名用 whisper 验证；**效果声必须避开词的首音**——样片里一记按键落在「Start」上把那个词盖住了（`DEMO.md:66`、`STYLE.md:105`）。音乐在人声下压（ducking 由 `sound.py` 做）。
- **响度目标**：`−14 LUFS`（`STYLE.md:81`）；真峰值上限 **−1.2 dBTP**。**本次成片略未达标**：实测 **−14.2 LUFS / 真峰值 −0.94 dBTP**（口径 = `loudnorm` 的 `input_tp`，4× 过采样；mux 告警里印的 `peak -1.110876 dB` 是 `astats` 的**采样峰值**、不是真峰值），超 −1.2 dBTP 交付线 **0.26 dB**，见第 11 节。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 −0.94 dBTP → **−2.14 dBTP**、已在 −1.2 dBTP 交付线内（达标）；原 −0.94 dBTP 记录保留为历史。
- **静音策略**：**在关键承诺之前**把音乐降到只剩房间底噪，让那句最重要的话落地（`STYLE.md:80`）；样片用的是聚光冻结 + 承诺徽章。

---

## 7. 素材偏好

- **需要什么素材**：**不需要任何外部素材**。UI 由 `demo/ui.js` 把状态转成 HTML（`film.js` 里的时间线驱动），吉祥物与道具由 `demo/clawd.js` 用像素网格画成 SVG，HUD / 暗角 / 运动模糊 / 像素擦除在 `demo/main.js`。唯一需要「真东西」的是**产品自身的界面知识**：每个标签、模式名、快捷键都要和真产品一致。
- **不需要什么素材**：**不要截图、不要录屏、不要 lorem ipsum**（`STYLE.md:28`）；不要实拍、不要真人手部；不要黑舞台背景板。
- **取景 / 质感 / 比例偏好**：窗口浮在壁纸上、柔和阴影；像素网格**边缘锐利（`crispEdges`）**、位置吸附半像素；深度只用 rack focus 与暗角；运动模糊只用在甩镜。
- **可替代方案**（缺素材时怎么降级而不破风格）：缺真产品 → **必须先把界面按文档重画**，宁可少做一个功能，也不能编。缺品牌吉祥物 → 用**原创像素角色**（`STYLE.md:114` 明确允许「the product's own, or an original pixel character」）。缺 Inter / Newsreader / JetBrains Mono → 用任何 OFL 无衬线 + 等宽替代，但**等宽必须真的含 CJK**（dub 通路就是因为 Consolas 不含中文字形而回退 SimHei）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | **屏幕内一镜到底**；章节内一段约 4–10 s，共约 12 段 |
| 全片时长 | **59.4 s**（`style.json:17`）；本风格通常 **45–75 s**（`STYLE.md:12`） |
| 镜头数 | 约 12 段 / 4 个章节（01 Just say it / 02 Plan first / 03 Review / 04 Checks its own work） |
| 信息投放节拍 | 挂在 **100 BPM 网格**上（1 拍 0.6 s，段落切点都落在拍上） |

- **加速 / 减速点**：**累积靠动作不靠转场**——章节切点 10.2 / 19.2 / 27.0 / 35.4 s 各来一个 tom fill + crash；长活儿用 **4× 延时 + 闪烁标签 + rack focus**（读文件那一段）；最后一章**撤鼓**减速；聚光冻结是最强的减速点（承诺之前）。
- **留白与静音的位置**：关键承诺之前降到房间底噪；吉祥物的 idle 呼吸（每一拍一次轻微压扁）与不规则眨眼是「应用还活着」的节拍器。
- **吉祥物表演数值**（可直接抄，`DEMO.md:70-76`）：蓄力下蹲 **0.14 s**（压扁 **0.28**）→ 起跳拉伸 → 空中收腿 → 落地压扁 **0.22 s** + 阻尼回弹 + 尘土；行走 **9 步/秒**、方向翻转靠 sprite 镜像；每 **2.9 s** 眨一次眼（不规则）；眼睛状态 `n/l/r/u/d/wide/happy/shut/blink`，手臂 `down/up/wave`。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/living-screencast/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/living-screencast/demo --fps 24 --workers 6 --out …/out/video_gpu.mp4` |
| 帧率 | 样片声明 **30 fps**（UI on ones，吉祥物位置步进到像素网格，`STYLE.md:51`）；本次出片实测 **24 fps** |
| 分辨率 / 比例 | 原生 **1920×1080 / 16:9**（本次出片实测 `--ratio 16:9`，1920x1080）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`demo/film.js:10`），由 `main.js` 读视口算 `FX/FY/S` 后重排：世界层经 `#fit` 中心装入（`main.js:18-22`、`index.html:30`）、HUD 按 `--s/--fx/--fy` 贴当前帧（`index.html:164-176`）；16:9 时 `FX=FY=S=1` 逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh <video> <mix.wav> styles/living-screencast/living-screencast.mp4 24 0`（−14 LUFS / **grain 0**） |
| 编码器 | `h264_nvenc`（本地 GPU，日志实测 `nvenc`） |
| 音频入口 | `demo/sound.py` **同时兼任配乐与混音**（日志：`[配乐] sound.py 同时兼任配乐与混音，只在混音步骤跑一次`），从 `events.json` 造配乐 + foley + VO（含 ducking）；配音走 `core/tts/tts.py`，校对走 `demo/tools/asr_check.py`，另可 `sh demo/build.sh --vo` 只跑语音 |
| 字幕入口 | `node demo/tools/subs.mjs`（字幕 → `out/subs.json`）+ `core/render/srt.py`（本次实测 `17 cues`，已重新生成） |
| 事件导出 | `node core/render/events.mjs styles/living-screencast/demo`（实测输出 `events 303 dur 59.4`） |
| 混音自检 | `demo/tools/mixcheck.py` |
| 本风格专属参数 | `--vo`（只跑语音链路）；预生产稿在 `storyboard/`；`build.sh` 另出风格帧（40.9 s）与海报（8.9 s） |
| 一键复现 | `sh styles/living-screencast/demo/build.sh`（全渲染约 30 s；本次实测全片 56.3 s） |

---

## 10. 编排规则

- **内容文件字段契约**：配音文本在 `demo/lines.json`：`[{id, text, voice, speed, lang, asr?}]`（样片 `am_michael` / 1.0 / en-us）；时间线 `demo/film.js` 的 `VO` 是 `{id: 起点秒}`；字幕里用 `{}` 包住要强调的词（会被渲染成黏土色）。
- **事件词汇表**（`type` → 消费者 `sound.py`，含 ducking）：`vo{id}`、`step{v}` / `jump{d}` / `land{v,big}`、`key{v,sp}` / `tkey` / `tenter`、`blip{n}` / `blink` / `morph`、`winopen` / `hit`、`click` / `pop` / `enter` / `chip` / `send`、`pane` / `whoosh{d}` / `read{i}` / `tick`、`write` / `dash` / `tool` / `count` / `rkey{v}`、`boing` / `stomp` / `darkon` / `shutter`。
- **时间线契约**：`demo/film.js` 是**唯一时间线**——导出 `BPM/B/DUR/VO/EV`、`W(id,word,n)` / `WE(id,word,n)`（**把画面节拍挂到被说出的词上**）、`camAt(t)`、`build(words)`、`frame(t)`。页面契约：`window.READY` / `render(t)` / `DUR` / `EV` / `SUBS` / `T`。UI 状态由 `demo/ui.js` 转成 HTML；吉祥物在 `demo/clawd.js`；层 / 锚点 / 模糊 / HUD 在 `demo/main.js`。
- **新增主体怎么接入**：吉祥物按 `clawd.js` 的契约替换——`grid({eyes,arms,legs})` 返回 `[[c,r,kind]]`（1 身体 / 2 眼睛）、`sprite({...pose})` 渲染 SVG、`pixels(o)` 给像素爆散、`pixart(rows,o)` 画任意像素图；道具共享同一网格。**新 UI 元素必须在 `ui.js` 里给一个稳定的 DOM 锚点**，吉祥物的落点靠 `main.js` 的 `A()` 每帧量 `getBoundingClientRect` 反算世界坐标——**绝不手写坐标**。
- **换主题时要改哪些文件**：① `demo/film.js`（时间线：VO 时刻、`W()` 挂词、镜头运动、`Actor` 段、`Cursor`、事件）；② `demo/lines.json`（配音文本与声线）；③ `demo/ui.js`（新产品的界面状态 → HTML）；④ `demo/clawd.js`（换成自己产品的吉祥物或原创像素角色）；⑤ `demo/main.js`（HUD、转场、主题层）；⑥ `demo/sound.py`（配乐 + foley）。**片尾卡里的 `LemoLab × Claude Opus 5.5` 署名属于本库 demo，改成用户片子时必须删掉**（`DEMO.md:88`）。**不要**改 `core/`。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里生效的参数是 `dub-styles.json#living-screencast`——`palette`（`bg #0C1016` / `fg #FFFFFF` / `accent #f2c14e` / `subtitle #FFFFFF` / `subtitleBack #B3000000`）、`bgRecipe`（solid `#0C1016` + `vignette 0.35`）、`subtitle`（`SimHei` / `fontSizeFactor 0.03426` / `marginVFactor 0.14537` / `outlineFactor 0` / `align 2`）、`title.fontSizeFactor 0.082`、`overlay`（`chapterCards:true` / `accentRule:true`）、`motion`（`subtitleFadeIn 0.16` / `chapterTransition: cut`）。**⚠ 该条目是 `derived:true` 的派生条目且 `bgSameAsDefault:true`**：`bg` 是**兜底值**（`dub-visual` 没抽到 demo 的程序化底色，按 plain-dark 兜底），因此**与 demo 的浅色主题观感不一致**——抽帧复核时要特别盯这一条（见第 11 节）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **ASR 校验未通过（本次唯一 mismatch）**。出片日志：`DIFF v05 | Point at a file with the at sign, → Point at a file with the head sign.`，随后 `STEP_WARN asr_check 未通过（继续）`、`mismatches: 1`。即旁白里的 **「at sign」被 whisper 听成「head sign」**——这是本风格最该防的一类错（`STYLE.md:106` 明写「TTS mispronounces the product name → try voices and spellings, verify with whisper」）。成片未因此阻断，但这条校验没过。
- **成片响度 / 峰值略未达标**。`mux.sh` 告警：`missed the target (-14 LUFS, true peak <= -1.2 dB): measured -14.2 LUFS, peak -1.110876 dB (ebur128 1-decimal readout -0.9 dB)`。**注意口径**：`peak -1.110876 dB` 是 `astats` 的**采样峰值**、不是真峰值；同一行括号里的 ebur128 读值 `-0.9` 才接近真峰值。本次复测**真峰值 = `loudnorm` 的 `input_tp` = −0.94 dBTP（4× 过采样），超 −1.2 dBTP 交付线 0.26 dB**。比 iso-infographic 轻微（那里真峰值 **+1.20 dBTP**，已过 0 dBFS），但同样越过了 −1.2 dBTP 上限。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 −0.94 dBTP → **−2.14 dBTP**，已在 −1.2 dBTP 交付线内；音频评分回补 +2（见第 10 节）。
- **按键 HUD 会压到应用窗口的下缘**。帧 f09（Plan 模式那一段）左下角的按键 HUD 胶囊与窗口底边重叠；`STYLE.md:45` 只规定「屏幕上不叠别的」，没规定 HUD 与窗口的间距，属于规则空白带来的实际瑕疵。
- **dub 通路与 demo 观感不一致**。`dub-styles.json#living-screencast` 的 `bg #0C1016` 是**兜底值**（`bgSameAsDefault:true`），渲染出来是「暗底 + 白字 + 强暗角（vignette 0.35）」的通用暗色板；而 demo 是**浅色主题的桌面录屏**。也就是说走「文案 + 风格」通路时，**画面底与 demo 完全不是一回事**——这一条是已知的、条目自带的缺陷（其 `notes` 里也写了「⚠ 本条目 dub-visual 未抽到 palette.bg，已按 plain-dark 底色兜底」）。
- **字幕底衬色为回退值**：目前用风格自身地色/辅色替代（回退原因见第 5 节）；若要完全对齐 demo，需先统一 `palette.subtitle` 与 demo 的 `textColor`。

### 素材缺口
- **无外部素材缺口**：UI、吉祥物、道具、HUD 全部程序化。
- **字体缺口**：样片用 Inter / Newsreader / JetBrains Mono（OFL），dub 通路回退 **SimHei**。条目 `notes` 解释了原因：原按等宽映射到 Consolas，但 `consola.ttf` 只有 448 KB、**不含中文字形**，中文会 tofu，所以改用含 CJK 的 SimHei。**若后续接入真正含 CJK 的等宽字体（思源黑体 Mono / NSimSun），应换回等宽并更新该条目。**
- **吉祥物缺口**：样片用的是**非官方同人片**里的 Claude Code 吉祥物（`DEMO.md:84` 自己声明「Unofficial fan film」）。用户片子**必须换成本产品的吉祥物或原创像素角色**，不能沿用。

### 能力限制
- **9:16 曾不适配（★ 2026-10-04 已修）**。原记「`style.json` 无 `aspects`；横向桌面 + 横向窗口是所有风格里对竖版最不友好的构图之一，9:16 下丢右侧 43.75% 且字幕会落到画面中段偏左」。**2026-10-04** 已改造 `styles/living-screencast/demo/`：`film.js` 声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:10`）、`main.js` 读视口派生 `FX/FY/S`（`main.js:18-22`）、世界层经 `#fit` 中心装入（`index.html:30`）、HUD 改按 `--s/--fx/--fy` 贴当前帧（`index.html:164-176`、`main.js:106,122`）。**16:9 逐字节未变**（19 帧实测 md5 相同）；9:16 实测不裁切、窗口完整（见第 2 节）。
- **通常 45–75 s**（`STYLE.md:12`）。要讲清一条完整工作流需要这个体量；太短则章节铺不开，太长则同一套镜头语法会重复。
- **强依赖真产品的界面知识**：每个按钮、模式名、快捷键都要对文档，**不在文档里的功能不能进片子**。这是本风格最大的前置成本，也是它最大的可信度来源。
- 依赖 DOM 每帧测量（`main.js` 的 `A()`）。**任何手写坐标都会让吉祥物浮空或漂离元素**，这是本风格最容易犯且最显眼的错（`STYLE.md:100`）。

### 踩过的坑（本机实测）
- 本次出片走的是 **`--skip-sync --no-preflight --ratio 16:9`**（日志首行），跳过两份库同步与预检。
- **接管了一个过期锁**：日志第 2 行 `! 接管过期锁（无 pid 10292，已不在）`——上一轮运行留下的 `.living-screencast.lock` 是死锁，本次直接接管。属环境噪声，不影响成片，但说明**并发锁可能残留**，重跑前值得看一眼。
- 混流走 **WSL 侧 `core/render/mux.sh` + `h264_nvenc`**（GPU），实测 `MUX_OK src_frames=1426 out_frames=1426`，帧数一致。
- 渲染 **1426 帧**耗时 **19s**（6 workers），音频链路与渲染并行共 **39.9s**，全片总耗时 **56.3s**。
- 配音是**本次真实 TTS 生成**的（非预生成），17 行全部产出；ASR 复核 16 条 OK、1 条 DIFF（见上）。
- 本次字幕**已重新生成**：`demo/tools/subs.mjs → subs 17`，混流阶段 `living-screencast.srt 17 cues 字幕已从 subs.json 重新生成`。
- `DEMO.md:104-106` 的 don'ts（换产品时最容易再踩）：不要让吉祥物浮在空处 / 盖住要读的文字 / 坐在字幕下面；不要用截图、不要对要读的文字做假景深、不要缩放出屏幕；画面上不要出现手 / 手臂 / 手指——**光标就是用户**。

### 下次迭代优先补什么
- **修「at sign」这一条 ASR mismatch**：换一个把 `at` 咬得更清楚的声线或改写句子（如 `Point at a file with the at-sign`），并用 whisper 复核到 0 mismatch。
- **修响度**：把 `mix.wav` 整体降约 0.5–1 dB，让成片回到 −14 LUFS / ≤ −1.2 dBTP。
- **给按键 HUD 定一个与窗口的避让规则**（例如 HUD 恒定停在窗口外或固定左下角安全区内），把 `STYLE.md:45` 的「不叠别的」细化成可校验的间距。
- **修 dub 条目的底色**：为 living-screencast 抽一个真实的浅色桌面底色（或加一层「桌面 + 窗口」的程序化底），避免走文案通路时退化成通用暗色板。
- ~~给编排器补 `aspects` 声明，或对 16:9-only 风格**直接拒绝 9:16 导出**~~ ★ 2026-10-04 已完成：影片声明 `FILM_META.aspects` 并按实际帧重排（见第 2 / 11 节）。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/living-screencast/living-screencast.mp4`（59.42s / 14.9MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/living-screencast/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **92/100**（2026-10-03 校正：原 90，音频真峰值缺陷已修，audio +2） |
| 详细资料 | 有：`styles/living-screencast/STYLE.md`、`DEMO.md`、`demo/build.sh`、`lib/style-dna/living-screencast.md`、`lib/style-dna/living-screencast.json`、`lib/dub-styles.json#living-screencast`、`styles/living-screencast/style.json`、`_distill/logs/living-screencast.log` |

**逐帧拆解要点**：
- **f01**：**冷开场**——浅色壁纸上浮着一个终端窗口，提示符是 `~/tomato-timer $ claude`（已打出，光标在末尾）；窗口有柔和阴影、圆角、红黄绿三颗窗控点。全片第一个「真 UI」证据。
- **f03**：终端里出现 **Claude Code / Opus 5.5 / ~/tomato-timer** 与一行 `> Try "add a dark mode toggle"`，左侧有一个**虚线方框轮廓**（吉祥物爬出后留下的轮廓）；**黏土色像素吉祥物站在终端窗口的顶边上**，头顶一个黑色像素道具。底部字幕胶囊「Meet Clawd.」（部分可见）。
- **f06**：**章节 01**（左上角章节胶囊「01 Just say it」）；吉祥物站在输入框顶边；输入框内容「Add a dark mode toggle to ▊」；下方模型芯片「Manual · Opus 5.5」；底部字幕「Point at a file with the **@** sign.」——`@` 是黏土色。
- **f09**：**章节 02**（「02 Plan first」）；吉祥物站在输入框顶边；输入框占位符「Describe a task, or type / for commands」；底部字幕「Not sure yet? Switch to **Plan** mode.」——`Plan` 是黏土色斜体；**左下角有一个按键 HUD 胶囊，与窗口下缘重叠**（本次记录到的瑕疵）。
- **f12**：**章节 03**（「03 Review every change」）；应用窗口显示「Plan approved. Building it now…」与一行 `Edit src/timer.ts +12 −1`；底部字幕「Every edit shows up as a **diff**.」——`diff` 黏土色。**这是「因果」段落：软件的动作真的改变了 UI 状态。**
- **f15**：**像素块擦除转场**——整屏被黏土色像素方块覆盖，章节标题「It checks its own work」以衬线字落在块上，一只**很小的白色吉祥物**在块中间跑。这是本风格最标志性的转场帧。
- **f18**：**暗色模式已接管整片**——应用窗口是暗主题，番茄钟显示 **25:00**，吉祥物在顶栏；底部字幕「Got more to do? Start another **session**.」——`session` 黏土色。证明「片子本身改变状态」这条 native move 真的被用满了。
- **f19 / f20**：**分屏**（章节胶囊「Side by side」），左右两个会话并排；f20 里**左右各有一只吉祥物**（细胞分裂），右下角是 CI 绿点与测试输出；字幕「They work side by side.」。
- **f21 / f22**：片尾卡在**暗色**里淡入——「Claude Code」大字 + 吉祥物，随后口号逐词跳出（f22 停在「Say it. Plan it.」）。
- **f23 / f24**：**最后一记跺脚把光带回来**——同一张片尾卡变成浅色：`Claude Code` / `Say it. Plan it. Review it. Ship it.`（**`Ship it.` 是黏土色斜体**）/ 副行 `Claude Code · in the Claude app` / 底部小字版权行。吉祥物站在 `Ship it.` 上。
- **整体色走**：全片有一次**大状态切换**——从浅色主题（f01–f17）经像素擦除与主题揭示圆翻到**暗色主题**（f18–f22），最后在 f23 由吉祥物脚下的跺脚**翻回浅色**。这不是渐变，是「剧情事件」；吉祥物始终是同一块黏土色 `#D97757`，在所有帧里都是最先被找到的那一小块颜色。
- **节奏观察**：没有一帧是静态的——即使「安静」的段落，吉祥物也在按拍呼吸、不规则眨眼，应用窗口的插入符在闪。字幕胶囊始终在底部、始终不压被讨论的元素。

**自检发现的缺陷**：ASR 1 条 mismatch（`at sign` → `head sign`）；成片真峰值 −0.94 dBTP（`loudnorm` `input_tp`，4× 过采样）越过 −1.2 dBTP 交付线 0.26 dB；按键 HUD 与窗口下缘重叠；dub 通路底色是兜底暗色板、与 demo 浅色主题不一致。 ★ 2026-10-03：成片真峰值已修（−0.94 dBTP → −2.14 dBTP，音频重混），见第 11 节。

**本次为补齐短板做了什么**：**未改动 `lemo-make.mjs`、未改动 `styles/living-screencast/` 下任何源码**。仅完成本 Skill 文档与 `_distill.json` 的蒸馏；上述短板已全部记录在第 11 节，留给下一轮迭代。
