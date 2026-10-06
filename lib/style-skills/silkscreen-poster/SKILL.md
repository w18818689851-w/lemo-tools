---
name: lemo-style-silkscreen-poster
description: 【lemo 风格 Skill · 丝印旅行海报】要做「一张海报正在镜头前被印出来」的实用型片子时用：不透明平墨一层层刮印、阶梯色带代替渐变、纸白当一种颜色、套印错位留下露纸的月牙——适合路线指南、景点/活动海报、目的地系列。选定本风格做视频时，优先读本文件。
slug: silkscreen-poster
name_zh: 丝印旅行海报
category: 印刷与版画
film: Three Trails
---

# 丝印旅行海报（`silkscreen-poster`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/silkscreen-poster/STYLE.md` · `styles/silkscreen-poster/DEMO.md` · `styles/silkscreen-poster/demo/build.sh` ·
> `lib/style-dna/silkscreen-poster.md` · `lib/style-dna/silkscreen-poster.json` · `lib/dub-styles.json#silkscreen-poster` ·
> `lib/dub-visual.json#silkscreen-poster` · `styles/silkscreen-poster/style.json` · `demo/content.json` ·
> demo 源码（`film.js` / `engine/poster.js` / `engine/scenes.js` / `engine/silk.js` / `music/compose.py` / `mix.py`）· **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一张海报**正在镜头前被印出来**。每种颜色都是**不透明的墨**、由自己那一次刮印铺上去，**后印的墨完全盖住先印的墨**；一个形状的边缘就是一块平涂墨停下的地方。每层一个 `Path2D`；每层套印偏移 **1–3 px**（1080p），被镂空的形状留下一弯**露纸的月牙**；每层墨下方约 **2 u** 有一道很淡的乘算鬼影（叠印边）；墨有厚度（左上亮边、右下暗边，只作用于填色），新墨带一秒内变哑的湿光泽；纸是米黄卡纸带纤维，霉斑与针孔用纸色、只在墨面上看得见（STYLE.md:15-22、style-dna/silkscreen-poster.md:17-35）。整片的信息通路是**海报上的文字**——**没有旁白、没有字幕**（STYLE.md:49）。

**不是什么**（最容易做错的邻居风格）：**不是 risograph**（半透明荧光叠印 + 网点颗粒）；**不是浮世绘**（主版线描 + bokashi 晕染）；**不是木刻**（雕刻线）；**不是低多边形**（3D 小面）；**不是扁平矢量插画**（矢量没有套印误差、没有露纸月牙、没有墨的厚度与湿光泽、没有真实工作台）。这个风格是**不透明、无线条、平涂、色带式**的（STYLE.md:23）。

**什么时候用它**：`style.json` 的 `uses` 写的是 Trail & destination guides / Tourism promos / Event posters。它是个**场景风格**——能干一件实际工作（一份指南、一张活动海报、一个目的地系列），只要主题能拆成「**几个事实 + 一个地方/事件/产品**」。STYLE.md §11 给了 5 个用例与各自的信息顺序与时长（步道/景点指南 30–40 s、活动海报 15–20 s、目的地系列 20–30 s、产品发布 12–18 s、季节/营业时间 10–15 s）。

**一句话内核**：**一墨一拍（one ink, one beat）**——每次刮印对应一个音乐事件，眼睛被按顺序领过各层；**事实最后才印，而那正是它们被阅读的时刻**（STYLE.md:92）。

**边界**：这个风格**撑不起**没有「可印信息」的内容。它需要名字、数字、日期、难度、距离这类**能被印上去的事实**；纯情绪抒情、需要人物表演、需要旁白叙事、需要连续镜头语言（追车、对话）的题材都不适合。另外它**只有 1–4 个条目**的容量（`trails[]` 1–4）：超过 4 条，墙上的海报会小到读不了（DEMO.md:146）。**换 `content.json` 只是「验证引擎能重排」的技术检查，不是做片子的方式**（DEMO.md:176）——真正的做法是**为用户的主题重排时间线与镜头**。

---

## 2. 画面构图

- **镜头数与画幅**：全片按 6 类段落组织：`banner` / `press` / `quick` / `ascent` / `wall` / `end`（`film.js` 的 `timeline()`）。画幅 **1920×1080（16:9，原生；已适配 9:16，见本节末）**。构图是**「印刷品在真实工作台上」的双层关系**：外面是木桌（木板、木纹、木节、几块大的哑光墨渍、撕剩的胶带痕），里面是海报。海报模板单位是 **1000×1500 u**，**纸边 26 u**，画面区到 y=1140，场景整体上移 **50 u**（裁掉一点天空让出更高的信息带），底部深色**信息带 `BAND = [26, 1148, 948, 326]`**（即 y 1148–1474，用 `near` 墨），四周留 26 u 纸边（`engine/scenes.js:9`、`engine/poster.js:60`、DEMO.md:61）。**开场片名卡是一张 1800×440 u（约 4:1）的横版 banner**，撑满画宽（左右各约 5% 边距）、占画高约 40%（`engine/poster.js:183`、DEMO.md:67）。
- **主体位置与占比**：主角是**印刷品本身**。① banner 段：banner 居中、占画宽约 90%；② press/quick 段：整张海报**竖着**占据画面主体，锁死俯视整张纸（帧 f04 里能看到整张纸 + 网版框 + 四周木桌）；③ 信息带特写：推进 + 俯仰到信息带，**整条带留在画面里，左右各留 ≥5% 边距（1000 u 海报上 z ≤ 1.75）**（帧 f07/f11/f17 都完整保留了纸边与木桌）；④ ascent 段：镜头**在印刷品内部**爬升，画面被多层山脊填满；⑤ wall 段：三张海报并排挂在同一块木板上，上方再挂 banner。
- **负空间 / 留白**：**纸是一种颜色**——没印到的地方（水、雪、瀑布、一束光）是整张纸上**最亮的东西**。帧 f09 是这条规则最纯的一帧：整张纸大半是未印的米白卡纸（带霉斑与针孔），只有顶部几条蓝色阶梯条纹、一个太阳圆盘、一道蓝色山影与一排树线；**帧 f04 的网版抬起瞬间**，纸的上半已印出天空色带与太阳圆环、下半仍是完全空白的纸。天空与雾用**阶梯色带**（一个平色 → 变细的条纹 → 下一个颜色），这是**渐变被禁止**之后的替代（`engine/silk.js` 的 `bandSteps`、`poster.js` 的 `BANNER_BANDS = { sky2: [0,150], sky1: [150,300], far: [300,374] }` 就是分色刮的墨珠分段）。
- **图层叠放顺序**（从底到顶）：① 木桌（木板 + 木纹 + 木节 + 哑光墨渍 + 胶带痕）→ ② 纸（`paperSheet`）→ ③ 场景各层（按 `depth` 从远到近：sky1 → sky2 → far → mid → near，每层一个墨、硬边闭合路径）→ ④ 强调层（`sun` 墨：太阳、路线虚线、难度三角、CLIMB 数值）→ ⑤ 信息带（`near` 墨，最后印）→ ⑥ 纸面纹理（霉斑 55% + 针孔 75%）→ ⑦ 网版框（抬起时在前景，**投影必须是环 even-odd，绝不是整矩形**）→ ⑧ 刮板 / 墨珠 / 一截手柄（骑在刮印前沿上）。
- **安全区**：海报纸边（26 u）**不许被切出画面**（特写海报时必须保留纸边，否则观众只看到一片平色，DEMO.md:99）；信息带特写时**整条带 + 左右各 ≥5% 边距**必须在画面内；墙上三张海报的数值要 ≥30 px、标签 ≥18 px @1080p（DEMO.md:61）。
- **本风格**不能**出现的构图**：**任何渐变**；网点 / 荧光色 / 线描；用描边做边缘效果（会在合并路径上画出内部线——只用填充）；整矩形网版阴影；随机的彩色圆点当桌面（会读成纸屑或占位符，必须是真实工作台）；一条很粗的刮板横过特写把画面切成「两张图」（要倾斜刀口、藏起大部分手柄、保持几何连续）；照抄任何真实海报的构图 / 公园名 / 字体 / logo，也不点名任何真实机构。

**在 9:16（产品默认）下的表现**：★ **2026-10-04 已适配**（`aspects: ['16:9','9:16']`，`demo/film.js:42`）。`setup()` 首行按视口调 `setFrame(W,H)`（`film.js:51` → `film.js:19`），算出 `FX=W/1920`、`FY=H/1080`、`S=min(FX,FY)`；**机位不再写死俯仰缩放**，改由 `camZ()` 按「设计占比装进当前帧」重算（`film.js:25-37`，`F(w,h,z0)=z0·max(w/1920,h/1080)·min(W/w,H/h)`；1920×1080 时恒等于 `z0`）；墙面排版 `wallLayout()`（`film.js:302`）与片尾卡几何 `endShapes()`（`film.js:401`）的每个常量都乘 `FX/FY`（位置）或 `S`（尺寸/字号/线宽）；`main.js:7-10` 把 canvas 尺寸与 `W/H` 都跟视口走。
竖屏 1080×1920 实测（Read 看图确认）：**banner 段**横幅居中、占画宽约 90%、高约 12%（`3 TRAILS IN / GRANITE VALLEY` 两行完整，不再被从中间切断）；**press / quick 段**整张海报完整入画（纸边不丢；`quick` 段按画宽入画 → 竖屏下正好露出**整张纸**，宽约 65% 画宽），信息带各列（`LEVEL` / `DISTANCE` / `TIME`，以及 Summit Ridge 那张的 `CLIMB`）都在；**ascent 段**山景占满画面主体（上下各露出少量木桌）；**wall 段**banner + 三张海报完整可读（三张的纸边都不丢，Summit Ridge 的 `CLIMB ↑1,100 M` 也在）；**片尾卡**从横版重排成一张**竖版海报**（图区在上约 53%、深色信息带在下约 47%，5 行署名完整）。**16:9 逐字节零回归**（t=5.76 / 19.2 / 32.64 三点 md5 与改造前完全相同）；9:16 与「16:9 中心裁切」的 SSIM 实测 **0.53–0.74**（≈1 才表示没重排）⇒ 确为真重排、非裁切。**字幕不会被切**——因为本风格**根本没有字幕**（海报文字已印在画面里），故无字幕重排问题。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 纸 | `#F2E8D2` | 米黄卡纸；也是「最亮的一种颜色」（水、雪、瀑布、光） | `content.json` palette.paper |
| 天光 sky1 | `#F6CD98`（dawn） | 最浅的一层天空，通常是最远/最亮的一层 | `content.json` dawn |
| 深天 sky2 | `#EE9A73`（dawn） | 阶梯色带的第二段、分色刮的一条墨 | `content.json` dawn |
| 远 far | `#9A7FA8`（dawn） | 远山 | `content.json` dawn |
| 中 mid | `#3E7079`（dawn） | 中景山脊 | `content.json` dawn |
| 近 near | `#1E3B3F`（dawn） | 最近一层，**也是信息带的墨** | `content.json` dawn |
| 强调 sun | `#FBE6B4`（dawn） | **唯一的亮强调**：太阳、路线虚线、难度三角、编号、6 u 横线、CLIMB 数值 | `content.json` dawn / `engine/poster.js:137-139` |
| 亮面 glow（可选） | `#F0DFA6`（noon） | 山的受光小面 | `content.json` noon |
| 木桌 | 板 `#5E4432` / 沟 `#3F2C21` / 横档 `#8A6547` | 印刷台（**代码里唯一硬编码的默认色**） | `demo/film.js:280` |
| banner 分色刮 | `#F7C66B #E4683F #2F6F73 #1C2A33` | 片名横幅的三段墨 + 信息条 | `content.json` palette.banner |
| dub 通路派生 | bg `#F6CD98` / bg2 `#1E3B3F` / fg `#1E3B3F` / accent `#6D4E06` | 「文案 + 风格」通路取的是 **dawn** 那一套 | `lib/dub-styles.json#silkscreen-poster` |

- **五套调色板（每张海报一套，一场一色）**：`dawn` `#F6CD98 #EE9A73 #9A7FA8 #3E7079 #1E3B3F` + sun `#FBE6B4`；`noon` `#E4EEDC #86BCD0 #C2AE92 #4C8753 #1D4331` + sun `#F2C14A` / glow `#F0DFA6`；`golden` `#F7D787 #E9A94F #A57C68 #5E7A45 #2B3A28` + sun `#FFF1C4` / glow `#F4C065`；`dusk` `#F4B461 #D8613F #7C3E5F #43325A #1B1B2F` + sun `#FBE3A6` / glow `#E8683F`；`night` `#3D4B72 #27304F #4E5C82 #232B45 #12152A` + sun `#EDE6C8`（`content.json` palette）。本次成片用了 dawn（Lakeshore Loop）、noon（Cascade Falls）、dusk（Summit Ridge）三套，爬升段经 `golden` 从 noon 重印到 dusk。
- **★ 渐变被禁止（本风格在 44 个风格里独有的硬约束）**：天空与雾**必须是阶梯色带**——一个平色 → **变细的条纹** → 下一个颜色；`bgRecipe.type` 就是 **`bands`**，`stops` 是 5 级色带（`#F6CD98 → #EE9A73 → #9A7FA8 → #3E7079 → #1E3B3F`），**没有 `linear-gradient` 这一档**（`lib/dub-styles.json#silkscreen-poster.bgRecipe.type = "bands"`）。帧 f09 与片尾卡 f23 是这条规则最清楚的两帧：天空里能直接数出「平色 → 4–6 条越来越细的条纹 → 下一个平色」的台阶。**任何一层出现连续渐变（天空、雾、山体、水面、阴影、文字）都算破风格**——包括「只有一点点柔化」。
- **明度 / 对比规则**：**值从远（浅）到近（深）逐级下台阶**，**深度靠值、绝不靠模糊**（STYLE.md:38）。文字墨色**必须按 WCAG 对比度自动选**（`pickInk(bgs, cands, need)`，定义在 `engine/poster.js:57`、对比度函数 `contrast` 在 `:56`；调用点 `:124,136,148,153,216,222`），**绝不写死**——否则夜景调色板会吞掉页眉（DEMO.md:93）。实测：标签在 `near` 带上从 `[sky2, glow, far, sky1]` 里选（minRatio 3），数值从 `[sky1, sun, glow]` 或 `[sun, sky1]` 里选（minRatio 4.5）。
- **禁止出现的颜色**：荧光色；任何半透明叠印（那是 risograph）；网点色；固定的「文字专用色」（必须由对比度推导）；整片统一的纸色以外的底色（纸永远是 `#F2E8D2`）。
- **同一画面最多几个色相**：**一张海报最多 6 个墨**（sky1 / sky2 / far / mid / near / sun，可加一个可选的 `glow` 受光面）——**≥7 个就变成插画，不再是丝印**。强调色（`sun`）**要稀有**：太阳或光源、唯一的路线或产品、最重要的那个数字。

---

## 4. 转场规则

- **镜头之间怎么切**：**层与层之间用刮板换**（`squeegee`）；**海报与海报之间穿过前景剪影换**（树、路灯、帆——`treeWipe`，在屏幕空间里以「前一张海报的 `near` 墨」画出的剪影）；**全片收尾用一次刮板把片尾卡的墨印出来**（`endpull`）。这三种都**来自媒介本身**（STYLE.md:77、style-dna/silkscreen-poster.md:103）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有叠化（dissolve）、没有裸露的硬切（bare cuts）**，也**没有任何淡入淡出**（STYLE.md:56「There is no fade anywhere」）。有的是：**刮印擦除**（`wipeRegion` / `wipeFront`，参差的刮板前沿作为 clip，约 **30 u** 拖尾）、**树影擦除**（`wipe{i}` 事件）、**换色重印**（`swap`：大刮板在 **0.35 s** 内以 **−12°** 斜着推过整张纸，刀口两侧几何**完全相同**、只有墨变了）、**网版抬起**（约 **0.4 s**，纵向压扁 + 影子长大）。树影擦除的**全遮挡只允许持续约 1 帧**（DEMO.md:95 记的是首版遮了 0.4 s 变成一块黑屏，修法是把剪影对准切换时刻）。
- **硬切点怎么定**：由 `film.js` 的 `timeline()` 一次性产出**画面段落 `secs` + 事件表 `ev`**，`ev` 驱动 `events.json`；所有卡点挂在 **100 BPM 网格**上（**1 拍 = 0.6 s**）。本次实测 **55 条事件**、`dur 38.4`。`tools/cuecheck.py` 逐条比对「混音起音 vs 事件」：**中位误差 4 ms，30/33 在 1 帧内**，本次有 **2 条超 10 ms**（`harm` +10.7 ms、`name2(口琴分轨)` +22.7 ms，DEMO.md:80 解释为「重叠事件 + 慢起音的口琴」）。
- **转场时长与缓动**：**刮印是线性匀速的**（刮板不会缓入缓出，STYLE.md:55）；网版抬起 0.4 s、换色重印 0.35 s、快速拉远用 ease-out 0.65 s（DEMO.md:29）；`info band` 逐项印是 **0.18 s/项、落在八分音符上**；**强调墨延迟半拍**（`sub: 1`）。
- **绝对不要的转场**：溶解；裸露的硬切；任何 fade；特写时把纸边切出画面；粗刮板把特写切成两张图。

---

## 5. 字幕样式

**本风格没有旁白、也没有字幕**——**海报上的文字本身就是信息**（STYLE.md:49）。`styles/silkscreen-poster/` 目录下**根本没有 `.srt` 文件**，也不存在字幕生成器（见第 11 节）。所谓「字幕样式」在本风格里就是**海报排版规格**：

| 项 | 值 |
|---|---|
| 字体 | **Big Shoulders Display**（压缩体，名字与数值；`demo/fonts/BigShouldersDisplay.ttf`）+ **Outfit**（几何无衬线，字距拉开的标签；`demo/fonts/Outfit.ttf`）；备选 League Gothic（`demo/fonts/LeagueGothic.ttf`）。三者均 OFL（STYLE.md:47） |
| 字号（模板单位 u，海报 1000 u 宽） | **页眉（地名/公园名）** `800 62px` + 字距 **14 px**，印在天空里、y=112；**主标题** 150 → 自动 170–60（单行）或两行平衡，字距 = 字号 × 0.02，≤34 字符；**步道/条目名** 自动 **122 → 60 u**（最大宽 690 u），≤22 字符；**编号 `01`–`04`** 122 u、右对齐 x=938、`sun` 墨；**数据标签** 38 u 起、最小 34 u（Outfit 600，字距 = 字号 × 0.1）；**数值** 68 u 起、最小 48 u（Big Shoulders 800，字距 = 字号 × 0.01）；**页脚** ≤45 字符一行（`engine/poster.js:123,134,137,152,171`、`statLayout`） |
| 颜色 / 描边 / 阴影 | **无描边、无阴影**（硬边平墨）；文字墨由 `pickInk` 按 WCAG 对比度自动选（见第 3 节）；信息带上的文字落在 `near` 墨上，取 `sun`/`sky1`/`glow` 等浅墨 |
| 位置 / 安全边距 | 页眉印在**天空里**（不是叠在画面上方）；信息带在 **y 1148–1474**，内部四行基线固定：名字 **y=1262**、6 u `sun` 横线 **y=1290**、标签 **y=1348**、数值 **y=1440**；列从 x=64 到 x=938，列间距 = 剩余空间 / (n−1)，**上限 140 u**（`engine/poster.js:61,139,140-176`） |
| 单行字数上限 / 最多行数 | `park` ≤22 字符；`title` ≤34 字符（banner 上分**两行平衡**）；`trails[].name` ≤22 字符；`footer` ≤45 字符**一行**；`trails[].time` ≤7 字符 |
| 出现与消失方式 | **逐项印出来**：整条带先印（`band{i}`），再印名字（`name{i}`），然后**逐项盖章**（`item{i,k}`，0.18 s/项、落在八分音符上）；每一层用参差的刮板前沿揭示，**没有淡入**（`motion.subtitleFadeIn: 0`） |
| 停留时长 | **每段文字在其「最后一项」落定后停留 ≥ `chars/12 + 1 s`（最少 1.5 s）**，有配音时 ≥ `max(1.8 s, 语音 + 0.6 s)`，并**向上取整到拍**（`engine/poster.js:27` 的 `readTime`）。本次实测：标题 3.2 s；信息带统计行在其最后一项后 ≥2.2–3.0 s；墙面落版静止 ≥3.6 s（DEMO.md:12,37,67） |

- **字幕与旁白的关系**：**没有旁白**。若有配音，字幕**必须是一条印出来的带（a band pull）**，**绝不是浮动的字幕条**（STYLE.md:49）。
- **本风格特有的字幕禁忌**：叙述性长句、从句、口语解说；花哨/手写装饰字体；用固定颜色键决定文字墨色（夜景调色板会吞掉页眉）；浮动的 caption；把信息带切出画面。
- **dub 通路派生值（注意落差）**：`lib/dub-styles.json#silkscreen-poster` 给的字幕是 **SimHei**、`fontSizeFactor 0.038`（≈41 px @1080）、`marginV 0.1`、`marginL 0.06`、`bold: true`、`align 2`（底部居中）；`overlay` 的 `chapterCards` / `lowerThird` / `accentRule` **全部打开**。这与本风格真实的 Big Shoulders / Outfit + **印在画面里的文字带**完全不是一回事——`lowerThird: true` 更是直接违反「字幕必须是一条印出来的带、不是浮动字幕条」。该条目的 `notes` 也自认「fontFamily 用 SimHei（§4:47 点名 Big Shoulders Display / League Gothic 压缩体，本机无）」。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「subtitles are a printed strip (a band pull), never a floating caption」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#19F6CD98`（AARRGGBB，落盘 ASS 为 `&H1998CDF6`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。**底衬色为回退值**：demo 侧底衬（demo poster.js:129 信息带 fill=pal.near）与该风格配置的 `palette.subtitle` 字色 #1E3B3F 对比度不足（<3.0），故改用该风格自身的地色/辅色（palette.bg #F6CD98 @0.90）；字色 #1E3B3F 与该底衬的 WCAG 对比度 **8.05**。

---

## 6. BGM / 音效特征

- **配乐**：**原声、手弹的乐器**——本次成片是**美式户外民谣**：**100 BPM、D 大调、开放 D 调弦（DADF#AD）**，配器为钢弦民谣吉他（物理建模扫弦/耙弦/分解和弦/空弦单音）、滑棒吉他（numpy 合成：连续滑音相位积分 + 钢弦谐波 + 琴体共振滤波 + 滑棒摩擦噪声 + 颤音）、**口琴**（VCSL，CC0）、立式贝斯（Karoryfer Sneakybass，CC0）、**cajon** 当底鼓 + 刷子（VCSL snare2 taps / shaker，CC0）、镲刷渐强（VSCO 2 CE sus_cymbal，CC0），混响用 `sampler.room()`（`music/compose.py:1-20`）。**每条步道换一个乐器家族**（STYLE.md:81：民谣、冲浪、bossa、铜管乐队都成立）。
- **一刮一击（核心机制）**：**每次刮印 = 一个音乐事件**；**用细分而不是改速度来加速**（中间那张海报从四分音符变成八分音符）；**四层刮印 = D–D/F#–G–A**，和声随层走近而爬升（`music/compose.py:123-124`）；**一次套准（clack）是片中最响的重拍**。
- **拟音（foley）清单**（按材料分层，`DEMO.md:46`）：**刮板在网纱上**（带 **220–280 Hz** 网格颗粒的中高频带通噪声，**刮得越快越亮**）、**湿墨的「咕」声**（下行正弦 + 黏稠噪声）、**铝网框卡嗒 + 铰链吱呀**、**纸张盖章**（逐项数据）、**虚线路线的十六分点声**、**纸的嘶声**（层滑动）、**木质与金属的套准夹具声**。
- **环境来自「印刷品内部」**：**台面下有房间底噪**；一张完成的场景可以**「醒来」**（海报 1 的湖在网版抬起时淡入、瀑布 **J-cut 早 0.9 s** 进、山风 **J-cut 进静音窗 / L-cut 出到墙上**、游客中心的低语 + 一扇门 + 脚步声）（STYLE.md:82、DEMO.md:47）。
- **旁白处理**：**无旁白**。混音只有「配乐 + 拟音 + 环境」三层；**音乐在拟音下压 2.5 dB**（快起慢放，`mix.py:159-164` 的 `duck = 1 − .25 × clip(...)`），**爬升段配乐 +3 dB**。
- **响度目标**：`−14 LUFS`；**真峰值上限**：`−1.2 dBTP`（**项目级交付线**，判据见 `core/render/mux.sh`；本风格 `STYLE.md:86` 未额外声明更严上限）。本次实测 **−14.5 LUFS / LRA 7.6 LU**（`ebur128`，`_distill/logs/silkscreen-poster.log:113-116`）、**真峰值 −1.40 dBTP**（`loudnorm` `input_tp`，4× 过采样；`ebur128` `Peak` −1.4 dBFS 仅作参考），真峰值在交付线内。素材链里 `mix.wav peak −2.6 dBFS`、配乐 `peak −1.50 dBFS`。
- **静音策略**：**两处静音窗**，且**必须是真的零**——静音窗里配乐与拟音**严格为零**，环境**只留规定的那一种**：① **18.0–19.20 s**（音乐关掉；瀑布尾巴淡到约 −59 dBFS；静音后第一个声音是**一段长长的上滑音**）→ 本次实测 `rms −59.6 dBFS`；② **23.40–24.00 s**（**只留山风**；静音后第一个声音是**套准卡嗒 + 全乐队**）→ 本次实测 `rms −42.0 dBFS`（就是那阵山风）。谱面里 `silence{dur, pre?}` 事件由 `mix.py:168-179` 据此归零，`pre` 时环境压到 35%（style-dna/silkscreen-poster.md:227、`film.js:65,81`）。

---

## 7. 素材偏好

- **需要什么素材**：① **事实数据**——名字、编号、难度、距离、时间、爬升，以及单位制（`units.distance` / `units.elevation`）；② **一组调色板**（每张海报一套 5–6 墨 + 纸 + 木桌 + banner）；③ **场景层**——`engine/scenes.js` 内置 5 种（`lake` / `waterfall` / `ridge` / `forest` / `coast`），每层带 `{id, depth, side?, parts:[{ink, path}]}`，可重排或扩展；④ **字体**（Big Shoulders Display / Outfit / League Gothic，已随包，OFL）；⑤ **真实工作台**（木板、木纹、木节、几块大的哑光墨渍、撕剩的胶带痕——**不是随机彩点**）。
- **不需要什么素材**：**不需要任何照片 / 视频素材**（一切由 `Path2D` 画出来）；**不需要旁白配音**（`build.sh` 明确「无旁白，不需要 TTS」）；**不需要字幕文件**（海报文字就是信息）；**不需要转场素材**（刮板 / 树影 / 换色都在引擎里）。
- **取景 / 质感 / 比例偏好**：**4:1 左右的横幅**（banner 1800×440 u）——**7:1 的横幅在 16:9 里就是一条细缝**（约 1/5 画高、大片空桌），必须做到约 4:1 才能撑满画宽 + 约 40% 画高（DEMO.md:97）；竖版海报 1000×1500 u（2:3）；质感关键词是「**不透明平墨 + 米黄卡纸 + 木质印刷台**」，**不是**「复古滤镜」。
- **可替代方案**（缺素材时怎么降级而不破风格）：① 缺场景层 → 用**最少的 3 层**（一条阶梯色带天空 + 一道山脊 + 一片平涂水/纸白），**只要保证每层一个墨、硬边、无渐变**，风格就立得住；② 缺真木桌 → 用**一块纯色木板 + 2–3 块哑光墨渍 + 1 条胶带痕**（宁可少，也**不能**用随机彩点）；③ 缺压缩体字体 → 用任何**窄体无衬线**（保持字距拉开），但**不能用衬线体或手写体**；④ 缺 5 套调色板 → 只用 2 套（一浅一深）也成立，**但同一张海报内绝不混用两套**；⑤ 只有 1–2 个条目 → `trails[]` 支持 1–2（1 = 只印不爬、2 = 印 + 爬），片长收到 15–20 s。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 挂在 **100 BPM 网格**上，**1 拍 = 0.6 s**。印法分三档：**`press`（第一张，慢）**——摇镜 1 拍 → 四层各间隔 1 拍、每层刮 **0.45 s** → **5 拍**抬网版 → 推 **2 拍** → **6 拍**印带 → **7 拍**印名 → 从 **8 拍**起每半拍一项；**`quick`（中间张，快）**——四层各间隔半拍、每层刮 **0.26 s** → **2 拍**拉回 → **2.5 拍**印带 → **3 拍**印名 → 从 **3.5 拍**起每半拍一项；**`ascent`（最后一张，一镜到底）**——爬升 **7 拍** → **8 拍**卡嗒套准 → 8–9.5 拍俯摇到信息带 → **9 拍**印带 → **9.5 拍**印名 → 从 **10 拍**起每半拍一项（`film.js:41-57`） |
| 全片时长 | **38.4 s**（`events.json` 的 `dur 38.4`；**922 帧 @24fps = 38.42 s**）。3 条步道落在 STYLE.md §11 声明的 **30–40 s** 区间内。⚠️ **配乐总长比画面长 1.5 s**：`compose.py` 里 `TOT = DUR + 1.5`，实测 `mix.wav 39.90 s`，混流后成片时长由画面决定（922 帧），这 1.5 s 尾巴被截掉 |
| 镜头数 | 6 类段落：`banner`（8 拍 = 4.8 s）→ `press`（海报 1）→ `quick`（海报 2）→ `ascent`（海报 3，19.2–23.4 s）→ `wall`（29.4–30.6 s 拉远 + 静止）→ `end`（片尾 6 拍，34.8 s 起） |
| 信息投放节拍 | **信息顺序 = 印出来的顺序**：页眉 → 场景逐层 → 步道名 → 难度 → 距离 → 时间 → 爬升 → 页脚。**每段时长 `need = max(名字 + readTime(名字), 最后一项 + readTime(数值串))`**，向上取整到拍（ascent 段不额外加一拍，`film.js:70-71`）；墙面落版：拉远 **2 拍** → 静止 `ceil(max(3.6, readTime(页脚))/B)` 拍 → 片尾 **6 拍**（`film.js:76-79`） |
| 加速 / 减速点 | 加速：`press`（0.45 s/层、1 拍间隔）→ `quick`（0.26 s/层、半拍间隔）；**海报 2 整体加倍到八分音符**。减速：`ascent` 段爬升 7 拍后**在 24.0 s 停一拍等套准卡嗒**（「这是全片唯一一次在最重要的事实之前停下来」，DEMO.md:20）→ 墙面落版静止 ≥3.6 s |
| 留白与静音的位置 | 留白：**帧 f09 的整张半空白纸**（「白的就是瀑布」）、帧 f04 的网版抬起瞬间（纸的下半完全空白）、墙面落版的静止。静音：**18.0–19.20 s**（瀑布尾巴 −59.6 dBFS，静音后接长上滑音）与 **23.40–24.00 s**（只留山风 −42.0 dBFS，静音后接套准卡嗒 + 全乐队） |

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/silkscreen-poster/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/silkscreen-poster/demo --fps 24 --workers 2 --out styles/silkscreen-poster/demo/out/video24.mp4`（build.sh 第 6 步；本次批量出片走 `lemo-make.mjs` 时是 `--fps 24 --workers 6 --size 1920x1080`） |
| 帧率 | **24 fps**（922 帧 = 38.42 s）；时间网格是 **100 BPM / 1 拍 0.6 s**（`film.js:6`） |
| 分辨率 / 比例 | **16:9（1920×1080）与 9:16（1080×1920）均已适配**（`aspects: ['16:9','9:16']`，`demo/film.js:42`）。版面从视口重推：`setFrame()`（`film.js:19`）算 `FX/FY/S`，机位由 `camZ()`（`film.js:25-37`）按设计占比装进当前帧，墙面 `wallLayout()`（`film.js:302`）与片尾卡 `endShapes()`（`film.js:401`）的位置 ×FX/FY、尺寸/字号/线宽 ×S；`demo/main.js:7-10` 让 canvas 与 `W/H` 跟视口走。1920×1080 时 `FX=FY=S=1` ⇒ **16:9 逐字节不变**（实测 md5 相同）。海报模板单位仍为 **1000×1500 u**，纸边 26 u，信息带 `[26, 1148, 948, 326]`，banner **1800×440 u** |
| 混流 | `sh core/render/mux.sh <video> <mix.wav> <out> 24 3`（第 5 个参数 **24 = 帧率**，第 6 个 **3 = mux 颗粒**；本风格的纹理预算是「纸纹 + 霉斑 55% + 针孔 75% + **grain 3**」，再多就读成 risograph 了） |
| 编码器 | 混流走 **`h264_nvenc`**（本地 GPU，`_distill/logs/silkscreen-poster.log:109`）；`build.sh` 里没有额外的 `-tune grain` 重编码步骤（与 silent-film 不同） |
| 音频入口 | `demo/music/compose.py`（读 `events.json` → `music/score.wav` + stems）→ `demo/mix.py`（环境 + 拟音 + 配乐让路 + 静音窗 → `mix.wav`）；自检 `demo/tools/cuecheck.py`（混音起音 ↔ 事件） |
| 字幕入口 | **无**（没有 `lines.json`、没有字幕生成器、没有 `.srt`）——海报文字即信息；`film.js` 里没有文案（`DEMO.md:139`：「All text, data and colour come from demo/content.json」） |
| 事件导出 | `node core/render/events.mjs styles/silkscreen-poster/demo`（本次输出 `events 55 dur 38.4`） |
| 时间线真值 | `node styles/silkscreen-poster/demo/tools/timeline.mjs [content.json]` 打印由 `content.json` 推出的时间线；`film.js` 的 `timeline()` 同时产出画面段落 `secs` 与事件表 `ev` |
| 本风格专属参数 | **颗粒 3**（mux）；`duck` 系数 **−2.5 dB**（`mix.py:163`）；爬升段配乐 **+3 dB**；静音窗 `silence` 事件在 `film.js:65`（`climb[1] → clack`）与 `film.js:81`（`asc.t0 − 2B`，`pre: 1`）；`sub: 1`（强调墨延迟半拍）；换内容用 `--q content=content_alt.json` |
| 一键复现 | `sh styles/silkscreen-poster/demo/build.sh`（8 步：timeline → events → 配乐 → 混音 → cuecheck → 渲染 → 混流 → 静帧；约 1 分钟渲染） |
| 换内容复现 | `CONTENT=content_alt.json sh styles/silkscreen-poster/demo/build.sh`（已验证：`demo/stills/alt_1_title.jpg` / `alt_2_band.jpg` / `alt_3_ascent_night.jpg` / `alt_4_wall.jpg`） |
| 本次实际命令 | `node lemo-make.mjs silkscreen-poster --skip-sync --no-preflight --ratio 16:9`（`_distill/logs/silkscreen-poster.log:1`） |

---

## 10. 编排规则

- **内容文件字段契约**（`demo/content.json`，**唯一真值**；`film.js` 里没有任何文案）：
  `park`（≤22 字符，页眉字距 62 u，超长会溢出天空宽度）、`title`（≤34 字符，banner 上自动 132→60 u，**分两行平衡**）、`kicker`（副题）、`footer`（≤45 字符一行）、`units.distance` / `units.elevation`、`trails[]`（**1–4 条**）、`trails[].name`（≤22 字符，自动 122→60 u）、`trails[].difficulty`（`easy`/`moderate`/`hard`/`expert`，未知值显示 1 个实心三角）、`trails[].distance`（印成 `3.2 KM`）、`trails[].time`（≤7 字符，如 `1 h`/`45 min`；该列变宽时所有数值一起缩，最小 48 u）、`trails[].elevation`（number 或 null，null 隐藏 CLIMB 列；显示为 `↑1,100 M`、用 `sun` 墨）、`trails[].scene`（`lake`/`waterfall`/`ridge`/`forest`/`coast`，未知 → `lake`）、`trails[].time_of_day`（`dawn`/`noon`/`golden`/`dusk`/`night`，缺省 → `noon`；爬升段从上一条经 `golden` 重印到这条）、`palette.<time>` = `{sky1, sky2, far, mid, near, sun, glow?}`、`palette.paper` / `palette.wall` / `banner_time`。
- **事件词汇表**（`type` → 消费者，本次 **55 条**）：`squeegee{dur,ink}`（刮板在网纱上 → 带网格颗粒的带通噪声）、`section{kind,t1,time_of_day}`、`lift{i}`（抬网版 → 卡嗒 + 铰链吱呀 + 弹簧点声）、`title`、`tilt{i}` / `tiltdown{i}`（摇镜 / 俯摇）、`pull{i,layer,n,dur,quick?}`（每一层刮印 → 网格嘶声 + 湿墨咕声）、`wipe{i}`（树影转场）、`pullback{i}`、`band{i}` / `name{i}`（印信息带 / 印名字）、`item{i,k,last,climb}`（逐项印数据 → 盖章 + 点声）、`ascent{i,dur}`（爬升 → 十六分音符点声）、`part{i,layer}`（层让开 → 刮擦 + 咕声）、`swap{i,k,dur}`（换色重印 → 刮擦 + 咕声）、`silence{dur,pre?}`（静音窗 → `mix.py` 据此归零，`pre` 时环境压到 35%）、`clack{i}`（套准卡嗒 → 金属夹具 + 低频闷响，**片中最响重拍**）、`wallpull` / `land{dur}`（拉到墙 / 墙面落定 → 图钉点声）、`endcard{dur}` / `endpull{dur}`（片尾卡 / 片尾刮）。
- **时间线契约**：`film.js` 导出 **`setup(content, canvas)`**（返回 TL）、**`render(t)`**、**`getTL()`**；`TL = {secs, ev, dur}`。页面契约：`window.DUR` / `window.EV` / `window.TL`（段落 kind+t0+t1）/ `window.render(t)` / `window.READY`。**改内容只改 `content.json` 一处**，时间线由它推出；因为**没有旁白**，音乐与混音从 `events.json` **完全自动重排**——这是本风格与其他风格最大的机制差异。
- **新增主体怎么接入**：新场景层用 `engine/scenes.js` 的 `buildScene('lake'|'waterfall'|'ridge'|'forest'|'coast')`，返回一组**层（planes）**，每层 `{id, depth, side?, parts:[{ink, path}]}`，可重排或扩展。层必须满足：**每层只用一个调色板角色的墨**；路径是**闭合的 `Path2D`（硬边）**；`depth` 用于爬升视差 `(camTopY − camY) × (depth − 1) × 0.42`，每道山梁在镜头经过时向两侧让开（**Gaussian bump，190 u × depth**），到顶后回位。新海报用 `engine/poster.js` 的 `buildPoster(content, trail, i, n)` → `drawPoster(ctx, P, {pal, T, prog, off, reg, sep, swap, items})`。
- **换主题时要改哪些文件**：
  1. `demo/content.json` —— 改 `park` / `title` / `kicker` / `footer` / `units` / `trails[]` / `palette`（**这是唯一必改的文件**）。
  2. 若主题需要**新的场景形状** → `demo/engine/scenes.js`（加一个 `buildScene` 分支，每层一个墨、硬边闭合路径）。
  3. 若主题需要**不同的海报张数或段落节奏** → `demo/film.js` 的 `timeline()`（`press` / `quick` / `ascent` / `wall` 的拍点表）。
  4. 若主题需要**新的排版密度** → `demo/engine/poster.js` 的 `statLayout`（列宽与数值缩放下限）与 `drawBanner`（标题折行）。
  5. 重跑 `sh styles/silkscreen-poster/demo/build.sh`（**不需要 TTS**）。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里能生效的参数是 `lib/dub-styles.json#silkscreen-poster` 给的 `palette`（`bg #F6CD98` / `bg2 #1E3B3F` / `fg #1E3B3F` / `accent #6D4E06`）、**`bgRecipe.type: "bands"`**（`stops` = dawn 的 5 级色带 `#F6CD98 → #EE9A73 → #9A7FA8 → #3E7079 → #1E3B3F`，`texture: paper`，`vignette 0`）、`subtitle`（SimHei / 3.8% / 底部居中）、`overlay`（`chapterCards` / `lowerThird` / `accentRule` 全开）、`motion.chapterTransition`。**注意三点落差**：① 该条目 `derived: false` 且**取的是 dawn 那一套**，而真实成片的配色是**内容驱动、一张海报一套**（dawn/noon/dusk 三套都用到了），单套 recipe 只能复现其中一张；② `subtitle` 的 SimHei + 底部浮动 caption 与本风格「文字印在画面里、字幕必须是一条印出来的带」直接冲突；③ `motion.chapterTransition` 字段值是 **`cut`**，而同一份 `notes` 的文字写的是 **wipe（squeegee pull）**——**条目内部自相矛盾**，实现时应以「刮印擦除」为准（STYLE.md:77 禁止 bare cuts）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **片尾卡的署名带密度超标**：帧 f23（片尾横版小海报）的深色信息带里塞了 **5 行**小字（`SILKSCREEN TRAVEL POSTER` / `LEMO-OPUSCAR` / `LEMOLAB × CLAUDE OPUS 5.5` / 字体署名 / 采样署名），而 STYLE.md:50 的页脚规则是 **≤45 字符、一行**。这是一个「现代署名块」被印进了海报的语法里。
- **同一个标题在 banner 段与片尾卡上折行不一致**：banner 段（帧 f02/f03）是**两行平衡**（`3 TRAILS IN` / `GRANITE VALLEY`，符合 STYLE.md:48 与 DEMO.md:67），片尾卡（帧 f23）却是**一行**（`engine/poster.js:210-212` 的 `if (lines.length === 1)` 分支）。同一句片名在全片里出现两种排版。
- **墙面上 banner 与海报行宽度不齐**：`film.js:306` 里三张海报按 `maxW = 1700` 排（`gap 54`），而 banner 是 **1800 u** 宽居中——帧 f20/f22 上能看到上方的 banner 比下方的海报行**左右各宽约 50 u**，形成轻微的上宽下窄。
- **爬升段的深度主要靠视差**：帧 f13/f14 里层与层之间有米色**纸缝**（3 u）与纸厚阴影（9 u @28%），但抽帧上纸厚阴影几乎看不出来，「层在动」主要靠视差——这正是 STYLE.md:106 警告的「Parallax alone reads as *the mountains are moving*」的边界情形（DEMO 记录修法是「松脱时给纸缝和纸厚阴影、套准时一声响归零」，已实现但幅度偏弱）。
- **2 条卡点超出 10 ms 阈值**：`cuecheck` 报 `cues >10ms: 2`——`harm` **+10.7 ms**、`name2(口琴分轨)` **+22.7 ms**。DEMO.md:80 的解释是「重叠事件 + 慢起音的口琴」，但 22.7 ms（约 0.55 帧）已经是本风格「一刮一击」精度的下限。
- **配乐比画面长 1.5 s**：`compose.py` 的 `TOT = DUR + 1.5`，实测 `mix.wav 39.90 s` vs 画面 `38.42 s`；混流后成片时长由画面决定，这 1.5 s 尾巴（原意是给最后一次刮印留余量）**在成片里被截掉**。
- **实测响度偏目标 0.5 LU 且动态偏大**：`−14.5 LUFS`（目标 −14）、`LRA 7.6 LU`、`真峰值 −1.40 dBTP`（`loudnorm` `input_tp`，在 −1.2 dBTP 交付线内）。LRA 偏大意味着两处静音窗与配乐强段的落差在手机外放时会更明显。
- **9:16 下信息带右列必然被切** —— ★ **2026-10-04 已修**：机位改由 `camZ()` 从当前帧重推、墙面/片尾卡几何乘 FX/FY/S（`film.js:25,302,401`），9:16 实测信息带各列都在（含 Summit Ridge 那张的 `CLIMB` 列）、左右纸边不丢（见第 2 节）。
- **`dub-styles` 条目与风格本体冲突**：SimHei 字幕 + 底部浮动 caption + `lowerThird: true`，与「海报文字就是信息、字幕必须是一条印出来的带」直接冲突；且 `motion.chapterTransition` 字段值与 `notes` 文字自相矛盾（见第 10 节）。
- **dub 派生配色只能复现一张海报**：`bgRecipe.stops` 固定为 dawn 的 5 级色带，而真实成片是「一张海报一套调色板」（本次用到 dawn/noon/dusk 三套 + 爬升段的 golden 过渡）。
- **字幕底衬色为回退值**：目前用风格自身地色/辅色替代（回退原因见第 5 节）；若要完全对齐 demo，需先统一 `palette.subtitle` 与 demo 的 `textColor`。

### 素材缺口
- **没有 `lines.json`**（设计如此：本风格无旁白，STYLE.md:49「海报上的文字就是字幕」）。文案通路是 `content.json` / `content_alt.json` 的字段，**不是** lines 数组。
- **没有字幕生成器**：`tools/` 下只有 `timeline.mjs` 与 `cuecheck.py`，**没有 `subs.mjs` / `subs.py` / `cues.mjs` / `export.mjs`**。因此 `lemo-make.mjs` 第 3 步与第 6 步都报同一条告警：「该 demo 没有本编排器支持的字幕生成器 —— 字幕源不重新生成，`.srt` 将沿用仓库里已提交的旧文件」（log:29-30, 110）。 ★ 2026-10-06 更正：编排器第 3 步字幕告警措辞已改（第五十三批，md5 65ddab44→dfa99004）——其中『告警误导 / 两处不一致』部分已消解，其余仍成立
- **但那条告警的文案与实际不符**：`styles/silkscreen-poster/` 目录下**根本没有 `.srt` 文件**（只有 `DEMO.md` / `STYLE.md` / `demo/` / `poster.jpg` / `style.json`）。所以「沿用旧文件」实际是「**无字幕文件**」，成片**没有字幕轨**——这在语义上与本风格一致（文字已印在画面里），但告警文案是错的，会误导下游以为存在一份可用的旧 `.srt`。 ★ 2026-10-06 已修：编排器第 3 步字幕告警措辞已改（第五十三批，md5 65ddab44→dfa99004）——『告警误导 / 两处不一致』部分已消解
- 字体**无缺口**：`demo/fonts/` 下 Big Shoulders Display / Outfit / League Gothic 三个 `.ttf` 与三份 OFL 授权文件齐全。

### 能力限制
- **只有 1–4 个条目**：`trails[]` 超过 4 条，墙上的海报会小到读不了（DEMO.md:146）。4 条塞进 40 s 的三种压缩办法见 DEMO.md:159-162（并排印同一台面 / 中间张改成十六分音符 / 跳过中间张的信息带特写并延长墙面停留 2 s）。
- **本风格已声明 `aspects: ['16:9','9:16']`**（`demo/film.js:42`，**字面量**——控制台按源码文本探测，见 `D:\lemo-tools\lib\aspects.mjs`）：16:9 逐字节零回归、9:16 为真重排（非裁切），详见第 2 / 9 节。
- **必须有「可印的事实」**：没有名字/数字/日期的题材（纯情绪、纯叙事）无处安放，风格会退化成一张会动的插画。
- **文字墨色不能写死**：必须走 `pickInk` 的 WCAG 对比度推导，否则夜景调色板会吞掉页眉（DEMO.md:93）。
- **纹理预算有上限**：纸纹 0.6 u/texel + 霉斑 55% + 针孔 75% + grain 3；**再加就变 risograph**（STYLE.md:33、DEMO.md:63）。

### 踩过的坑（本机实测）
- **首跑 events.mjs 失败、重跑通过（瞬时故障）**：2026-10-03 首次批量出片时导出步骤失败（退出码 1），同一命令手工重跑即通过——本次日志里 `events.mjs → events 55 dur 38.4 → events.json` 一次成功（`_distill/logs/silkscreen-poster.log:26`），判定为**瞬时故障**，非代码缺陷。**遇到该条直接重跑，不要改 `film.js` 或 `events.mjs`。**
- **本次没有走 TTS、没有用预生成配音**：日志第 [4] 步「音频链路」为空，因为该 demo **无 `lines.json`，跳过配音**（log:36）；配乐与混音由 demo 自己的 `compose.py` + `mix.py` 现场生成。命令行确实带了 `--skip-sync`，但**没有使用任何预生成配音**。
- **本次成片实际跑通了**：渲染 `922 frames` / 29 s / 6 workers → `video_gpu.mp4 39.6 MB`；混流走 **nvenc**，`MUX_OK 26452481 src_frames=922 out_frames=922`，最终 **25.2 MB / 总耗时 54.1 s**（log:58-123）。**告警 2 条**：一条是上面说的「无字幕生成器」（log:29-30 与 log:110 各报一次）。
- **描边做边缘效果会在合并路径上画出内部线**：一片由松树**并集**画成的森林会显出每棵树的轮廓——光泽与叠印必须**只用填充**（先填一次，再在 clip 里偏移填一次），（DEMO.md:87）。
- **整矩形网版阴影会把整张印刷品弄浑**：投影必须是**环（even-odd）**（DEMO.md:88、`engine/silk.js` 的 `screenFrame` + `ringPath`）。
- **花岗岩上的冷色阴影面会读成水**：阴影面留在 `near` 墨里、放在瀑布旁边的**内侧面**（DEMO.md:89）。
- **粗刮板横过特写会把画面切成「两张图」**：要**倾斜刀口**、藏起大部分手柄、保持几何连续（DEMO.md:90）。
- **参差三角状的墨珠会读成纸边**：墨珠必须**圆**（受光半边、暗下缘、滚动亮点、黏稠丝）（DEMO.md:91）。
- **湿光泽梯度卡在刮印末尾**（条件 `p < 1.02` 永远成立）——要按时间淡出（DEMO.md:94）。
- **树影转场遮了 0.4 s** 变成一块黑屏——把剪影**对准切换时刻**，全遮挡只允许约 1 帧（DEMO.md:95）。
- **7:1 的横幅在 16:9 里是一条细缝**——必须做到约 4:1（DEMO.md:97）。
- **随机彩色圆点会被读成纸屑或占位符**——要做一个**真实工作台**（DEMO.md:98）。

### 下次迭代优先补什么
1. **把片尾卡的署名带瘦身**（`film.js` 的 `endCard`）：只保留风格名 + 一行署名，把字体/采样署名移出海报语法（对应第 11 节第 1 条）。
2. **统一 banner 段与片尾卡的标题折行规则**（`engine/poster.js` 的 `drawBanner` / `endCard` 共用同一套折行），消除「同一片名两种排版」。
3. **对齐墙面 banner 与海报行宽度**（`film.js:306` 的 `maxW 1700` 与 `poster.js:183` 的 `BW 1800` 取同一值）。
4. **把爬升段的纸厚阴影从 9 u @28% 提到可辨水平**，让「松脱」不靠视差也读得出来。
5. **修那 2 条超 10 ms 的卡点**（`harm` / `name2`），把 `name2` 的口琴起音对齐到事件上。
6. **把配乐长度与画面拉齐**（`compose.py` 的 `TOT = DUR + 1.5` 改为在混流时保留这段尾巴，或把尾巴收进 DUR）。
7. **修 `dub-styles` 条目**：把 `subtitle` 从「SimHei 浮动 caption」改成「印在 `near` 信息带上的米色字」，关掉 `lowerThird`，并把 `motion.chapterTransition` 的字段值与 `notes` 文字统一为「刮印擦除」。
8. **给 `bgRecipe` 补上 5 套色板**（而不是只给 dawn 一套），或明确标注「单套 recipe 只能复现同色系海报」。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/silkscreen-poster/silkscreen-poster.mp4`（38.42 s / 25.2 MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/silkscreen-poster/`（24 帧 + 接触印样，等间隔 **1.6 s**） |
| 风格匹配度自评 | **92/100** |
| 详细资料 | 有 —— `styles/silkscreen-poster/STYLE.md`（11 节全文）· `DEMO.md`（含 Engine reference、content.json 字段表、Pitfalls）· `demo/build.sh`（8 步）· `demo/content.json` · `demo/film.js` · `demo/engine/poster.js` · `demo/engine/scenes.js` · `demo/music/compose.py` · `demo/mix.py` · `style.json` · `lib/style-dna/silkscreen-poster.md` · `lib/style-dna/silkscreen-poster.json` · `lib/dub-styles.json#silkscreen-poster` · `lib/dub-visual.json#silkscreen-poster` · `_distill/logs/silkscreen-poster.log` |

**逐帧拆解要点**：24 帧等间隔 **1.6 s** 采样，帧号与出片日志的事件时间**逐条对得上**（这本身是强证据）。① **f01（≈0 s）**：开场——刮板横移带轻微侧倾（−1.7°），分色刮的墨珠把橙/青/深蓝三段墨一次铺进横幅，画面里保留木桌与画框边缘；② **f02（≈1.6 s）**：片名横幅印完——`3 TRAILS IN` / `GRANITE VALLEY` **两行平衡**印在**阶梯色带天空**里（橙色平色 → 几条变细的条纹 → 青绿 → 深蓝），下方深色信息条里一行小字 `FREE TRAIL MAPS AT THE VISITOR CENTER`；四周是**木桌**（可见木纹、木节、几块哑光墨渍、撕剩的胶带），**没有渐变**；③ **f03（≈3.2 s）**：banner 段的另一视角，横幅被推近；④ **f04（≈4.8 s，对应 `lift1 7.80` 之前的**网版抬起**）**：一张**铰链网版框**（网纱、感光胶、胶带、**环形投影**）压在纸上——纸的上半已印出天空色带与太阳圆环、**下半仍是完全空白的米黄卡纸**（能看到霉斑与针孔），这是「纸是一种颜色」与「抬版揭示」两件事同框；⑤ **f07（≈9.6 s，对应 `name0 9.00` / `item0.0 9.60`）**：信息带特写——`LAKESHORE LOOP`（Big Shoulders 900）+ 右侧 `sun` 墨编号 `01`，一条 6 u `sun` 横线，下面一行 `LEVEL ⛰ EASY / DISTANCE 3.2 KM / TIME 1 H`（标签 38 u Outfit 字距拉开、数值 64 u 窄体），带子完整在画面里、左右保留纸边、下方露出木凳；上方天空里有一条 `sun` 墨的**虚线路线**；⑥ **f09（≈12.8 s）**：**全片最能说明「禁止渐变」的一帧**——整张纸大半是**未印的米白卡纸**（带霉斑与针孔），顶部是**蓝色阶梯条纹**（一条平色 → 4–6 条越来越细的条纹），一个 `sun` 圆盘，一道 `sky2` 蓝色的平涂山影 + 一排树线 + 虚线路线——**瀑布/水就是那块没印到的纸**；⑦ **f11（≈16.0 s，对应 `name1 15.00`）**：`CASCADE FALLS TRAIL 02` 的信息带特写，noon 调色板（绿/蓝），上方是下垂层次的松树与阶梯色带瀑布；⑧ **f13（≈19.2 s，对应 `ascent 19.20`）**：**签名镜头**——一镜到底的多层视差爬升，画面被巨大的**松脱层**填满（米色**纸缝**夹在绿色山脊之间、松树是一整条下垂层次的外轮廓 + 短干），画面底部一条虚线路线与一个黄色的爬升标记；⑨ **f17（≈25.6 s，对应 `clack 24.00` 之后）**：`SUMMIT RIDGE 03` 的信息带特写，**dusk 调色板**（深紫/深蓝），四列 `LEVEL ⛰⛰⛰ HARD / DISTANCE 14 KM / TIME 7 H / CLIMB ↑1,100 M`——CLIMB 列用 `sun` 墨，编号 `03` 也是 `sun`；⑩ **f20（≈30.4 s，对应 `land 30.60`）**：**系列墙落版**——banner 挂在最上方，下面三张海报并排挂在同一块木板上（Lakeshore Loop / Cascade Falls Trail / Summit Ridge），三张各是 dawn / noon / dusk 三套色板；⑪ **f22（≈33.6 s）** 与 **f23（≈35.2 s，对应 `endcard 34.80`）**：片尾——最后两次刮印把片尾卡印成一张**横版小海报**（阶梯色带夕阳天空 + 山脊 + 虚线 + 太阳圆盘 + 片名一行），下方深色信息带里是风格名与署名。**转场全部来自媒介本身**：层与层用刮板、海报与海报穿过前景树影（`wipe` 在 13.2 s 与 19.2 s）、片尾用最后一次刮板印出；**没有一处叠化或 fade**。**瑕疵帧**：f23 的署名带密度（5 行小字）、f23 标题单行 vs f02/f03 标题两行、f13 纸厚阴影偏弱。

**自检发现的缺陷**：见第 11 节「已知缺陷」10 条。扣分对应：`palette` −1（dub 派生 `bgRecipe.stops` 只有 dawn 一套，只能复现同色系海报，而真实成片是内容驱动的多套）、`composition` −1（墙面上 banner 1800 u 与海报行 1700 u 宽度不齐）、`typography` −3（片尾卡署名带 5 行超出「页脚 ≤45 字符一行」、同一片名在 banner 段两行/片尾卡一行、dub 派生字幕 SimHei 与真实 Big Shoulders/Outfit 不符）、`rhythm` −2（`cuecheck` 有 2 条超 10 ms、配乐比画面长 1.5 s 被截）、`audio` −1（实测 −14.5 LUFS 比目标低 0.5 LU、LRA 7.6 LU 偏大）。合计 **92/100**。

**本次为补齐短板做了什么**：**没有改动 `D:/lemo-opuscar` 下的任何源码**（红线）。本次只做「读资料 + 逐帧拆解 + 写文档」，全部缺陷**如实记录**在第 11 节，修复方案列为「下次迭代优先补什么」的第 1–8 条，留给后续实现。
