---
name: lemo-style-hd-2d
description: 【lemo 风格 Skill · HD-2D 像素剧场】把一部片做成「会发光的桌面模型」——3D 微缩布景裹着像素贴图、扁平的 2D 像素立绘受光投影、高机位移轴镜头俯拍，光就是主角。适合游戏预告、幻想与旅程叙事、以及「把一件事做成一张可通关地图」的内容。选定本风格做视频时，优先读本文件。
slug: hd-2d
name_zh: HD-2D 像素剧场
category: 游戏
film: The Lampbearer
---

# HD-2D 像素剧场（`hd-2d`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/hd-2d/STYLE.md` · `styles/hd-2d/DEMO.md` · `styles/hd-2d/demo/`（无 `build.sh`，构建命令见 DEMO.md「Build notes」）·
> `lib/style-dna/hd-2d.json` · `lib/style-dna/hd-2d.md` · `lib/dub-styles.json#hd-2d` ·
> `styles/hd-2d/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。
> **本次成片**（2026-10-04 全量重渲后实测）：`1920×1080 / 24 fps / 1836 帧 / 76.500 s / 48,121,093 B`，音频 `I ≈ −14.0 LUFS`、真峰值 `−3.21 dBTP`（达标）。**原记**：2026-10-03 交付的是入库版「移轴剪」`60 fps / 4590 帧 / 71,454,034 B`（该版素材仍留在 `demo/out/video_tilt.mp4`）。移轴清晰带已逐帧确证存在（见第 2 节）。

---

## 1. 风格说明

**是什么**：一座「会发光的桌面模型」。盒子和圆柱搭成的 **3D 微缩布景**，表面裹着逐像素画的贴图，里面站着**扁平的 2D 像素立绘**——立绘本身受光、投影，却被一台**高位远景相机**透过一条**移轴清晰带**拍摄，于是整个世界读起来像一张沙盘。**光是主角**：实体灯把立绘的影子甩到地板上，雾、尘、雨悬在空气里，重辉光、重暗角；再叠一层小型 RPG 界面（章节卡、带名牌的对话框、衬线字幕）（`STYLE.md:3-4,8-12`）。

**不是什么**（最容易做错的邻居风格）：不是**体素游戏**（角色不能是方块堆的）；不是**纯 2D 像素 RPG**（布景必须是真 3D、真光照，不是平贴）；不是**真微缩模型的移轴摄影**（贴图是像素，不是材质）（`STYLE.md:12`）。也常被混同于 `pixel-rpg`：那个风格是 320×180 索引色帧缓冲、没有景深与泛光；本风格相反——**相机、光、粒子每帧平滑滑动，只有立绘在步进**（`STYLE.md:10`）。

**什么时候用它**：内容里有一个**能被一盏灯照到的地标**、一段**从暗走到亮的旅程**、或者一个**可以被读成地图的系统**——用户接入网络、村庄通电、新员工入职、按纪元讲的历史、分阶段的菜谱（`STYLE.md:76-81`、`style.json#uses`）。

**一句话内核**：立绘是扁的、低清、步进的，其余一切（相机 / 光 / 粒子 / 焦点）都是真 3D、每帧滑动——**这个反差就是风格本身**。

**边界**：撑不起**写实质感**内容（贴图是 24 px/m 的像素）、**现代都市对话剧**（本风格永远向下看世界，做不了平视特写）、**快节奏信息流**（单镜 5–14s、旁白慢速 .82–.90）、**需要大量并列数据**的内容（RPG UI 只适合承载「一屏一件事」）。

---

## 2. 画面构图

- **镜头数与画幅**：demo 76.5s / 8 段（card / harborWide / pier / forest / cliff / lamp / harborEnd / title），6 个镜头、每 1–2 镜一套布景、7 条旁白 + 1 条对话框台词（`DEMO.md:22-24`、`story.js:3-12`）。成片 **1920×1080（16:9）**；`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`（声明在 `demo/film.js`，**页面外壳等比装入**，见下）。
- **主体位置与占比**：立绘约画面高的 **1/12–1/8**（帧 34×50 px、`SPX = 1/30` 米/像素、约 1.67 m 高，`chars.js:5-6`），永远不居中到「英雄特写」——大全景里是一枚可被找到的小点，靠**全片唯一一套饱和色的衣服**（demo 是猩红斗篷）在冷蓝画面里被认出（`DEMO.md:52`、`STYLE.md:27`）。码头对话镜（f06–f08）是「中高位 3/4 近台」例外，两枚立绘占到画面高约 **1/6**，因为它们要在同一个舞台上被读成「两个人」。
- **负空间 / 留白**：留白由**雾与暗角**承担。每套布景拥有**一个雾色 + 一把光钥匙**（港镇 `#16223a`、森林 `#152a48`、风暴 `#1c2334`），所以一次切景就立刻读作「换了一个地方」（`DEMO.md:52`）。暗部是**暖墨色而非纯黑**（`#1a1016`），最亮处就是被辉光晕开的那个光源（`STYLE.md:25`）。
- **图层叠放顺序**（从底到顶）：天空穹顶（`sky()` 渐变 + 月亮光晕）→ 雾（`FogExp2`）→ 微缩布景几何（只用 `box` / `cylinder` + `worldUV` 保持 **24 px/m**）→ 公告板植被与道具（实例化）→ 受光立绘 + 其投射的镂空阴影 → 粒子 / 雨 / 光柱（`beamCard`）→ 加色 `glow` 光晕 → 后期链（2× 超采样 → 景深+移轴 → bloom → 暗角/调色 → ACES）→ Canvas2D 叠加层 UI（章节卡 / 对话框 / 字幕 / 片名）（`DEMO.md:54-58`、`main.js:24-56`）。
- **安全区**：旁白字幕居中压在 **y = H − 88**（1920×1080 里约底部 8%）的柔和暗带上，**单行制**；对话框 1180×210 px 底部居中，名牌骑在左上边缘；片名卡与章节卡居中。**立绘要留在暗带之上**，别让字幕盖住提灯那簇光。
- **本风格不能出现的构图**：平视机位（永远向下看世界）；划像 / 3D 旋转等花式转场；过冲回弹的镜头曲线；把移轴做成独立模糊 pass；让立绘在高光下被灯烧白（`STYLE.md:86`、`DEMO.md:149`）。

### ★ 移轴清晰带（本次重渲的核心，已逐帧确证）

**参数**：`?tilt=1` 是**渲染期后处理**（`post_ts.js`，不是对成片做二次处理），把移轴**折进景深的带符号 CoC**：`tiltAmt 17`、清晰带半宽 `tiltW .075`、羽化 `tiltF .3`（均为屏高比例）、`maxCoc ≥ 24`，并附带**饱和 ×1.16 / 对比 .28**。清晰带跟随主角的**投影屏幕高度**（夹 `.2–.8`）；**没有角色可跟的镜头用固定带高 `TILT_C`**（港镇全景 **34%**、结尾 **36%** 屏高）（`DEMO.md:58`、`main.js:33-56`、`harbor.js:179-181`）。

**怎么确证的**：把同一时刻的**非移轴版** `styles/hd-2d/demo/out/video_gpu.mp4`（24 fps / 1836 帧）与**移轴版** `styles/hd-2d/demo/out/video_tilt.mp4`（60 fps / 4590 帧）用帧精确抽取（`select=eq(n,…)`，同一时刻两版取同一帧号）做上下对照：

- **t = 8.0 s（港镇全景）**：非移轴版的**远处灯塔塔身、左侧山脊、近处水面波纹都清晰**；移轴版灯塔被糊成一团光斑、近水面糊掉，只剩压在画面中下段（房屋 + 栈桥）的**一条横带**实。
- **t = 30.5 s（夜林横移）**：非移轴版前景蕨草、树冠、地面都实；移轴版前景蕨草与树冠**整片糊成暗块**，只有 Wren 所站的那条带实。
- **t = 53.8 s（灯室）**：非移轴版屋顶、栏杆、地砖、立绘**全在焦内**；移轴版屋顶与底部栏杆明显糊，只剩立绘 + 透镜那一条实带。
- **同刻 SSIM（非移轴 vs 移轴）**：t = 8.0 → **0.881**、t = 30.5 → **0.917**、t = 53.8 → **0.865** —— 差异集中在**景深分布**而不是内容，正是移轴要的效果。移轴版另因饱和 ×1.16 / 对比 .28 而整体更暖、更「模型」。

**字幕不在移轴带里**：字幕由 Canvas2D 叠加层在 `composer.render()` **之后**画（`main.js:43-56`），所以不受移轴 / 景深模糊影响。实测字幕区（y = 920–1070）的边缘能量：非移轴 **5.337** / 移轴 **5.339** —— 两者一致，字幕在移轴版里同样锐利。

**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。改造**没有**逐处改写绘制点（本风格是 three.js 微缩布景 + 2× 超采样 + 移轴后处理 + Canvas2D 叠加层的固定设计帧管线，`main.js` 的 `renderer.setSize(1920,1080)` 不跟视口走，逐处改必然静默错位），而是只改**一个页面外壳文件** `demo/index.html`：影片本体仍按**固定设计帧 1920×1080** 画（一字未改），当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧等比装入**（contain）并居中，留边露出页面底色 `#0b1526`（本风格**夜戏的深藏青**，取自场景夜空 `forest.js` 的 `#132540` 家族；**不是** dub 通路原来的浅底 `#fff0c8`——那会给夜戏套一圈亮框；该浅底已于 2026-10-05 修正为夜空 `#050818→#101d3e→#2c4262`）。声明在 `demo/film.js`（`FILM_META.aspects`，控制台按源码文本探测）。

- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform）；本风格 `render(t)` 跨调用**有状态**（同帧渲两次字节不同），故 md5 判据取**同参数跨进程**（改前/改后各渲同一 3 帧序列）——实测三帧 **md5 逐字节相同**；另做「先 9:16 往返、再首渲」对照，与纯 16:9 首渲**逐字节相同**（`291dc679…`）。
- **9:16 不裁切**：整幅 16:9 画面（含立绘、提灯那簇光与底部单行字幕）**全部在画面内**（实测：改后 9:16 vs 16:9 中心裁切 SSIM 0.70/0.73/0.75，vs 理想等比装入 SSIM 0.9930/0.9859/0.9931）。
- **已知代价**：① 竖屏下有效画面只占 1080×608，**分辨率按紧轴缩放**（本风格源为 2× 超采样，缩到 608 高后移轴带与 24px/m 的微缩细节损失可见），是「小图居中 + 大片留白」；本风格留边取夜戏深藏青 `#0b1526`，与夜空同色、几乎无缝，观感像「暗房里裱起的一格画面」；② **全屏层（暗角/调色/叠加层）留在设计框内**，上下留边无画面内容；③ 其它比例同理（3:4 / 4:3 / 1:1）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 天空（夜） | `#050818 → #101d3e → #2c4262`（地平线） | 渐变穹顶三段 | `DEMO.md:52` |
| 雾 | 港镇 `#16223a` / 森林 `#152a48` / 风暴 `#1c2334` | 每套布景一个雾色 = 一次切景 | `DEMO.md:52`、`harbor.js:12` |
| 环境主光 | 月光 `#8fa8e0`、半球 `#3a4c7a / #0a0a12` | 冷调环境钥匙 | `DEMO.md:52` |
| 主（暖实体光） | 火与窗 `#ff9d4a` `#ffae55` `#ff8c3a`、提灯 `#ffb050`、灯塔 `#fff0c8` | 故事由这些**实体灯**推动 | `DEMO.md:52` |
| 前置补光 | 冷色 `#9fb2e8` | 约 2 m 在主角前方的**必加**冷补光 | `DEMO.md:56`、`harbor.js:175` |
| 主角专属色 | 斗篷色带 `#2e0b14 … #c9503f`（猩红）、围巾金 `#b08424` | 全片唯一饱和色，让立绘可被找到 | `DEMO.md:52` |
| 墨 / 描边 | `#1a1016` | selout 描边压暗目标、暗部暖墨 | `px.js:39-48` |
| UI | 金 `#d8c28e / #e2c989 / #c9a863` + 纸白 `#f3ead6 / #f6f0e2` | 一金属 + 一纸白，压在深色半透明板上 | `DEMO.md:60` |
| 字幕 | `#f6f0e2`（纸白） | 衬线斜体，坐在深色渐变暗带上 | `DEMO.md:73` |

- **明度 / 对比规则**：**两种温度**——一个大面积的冷/淡/尘环境钥匙，对着一小簇暖或饱和的实体灯；**实体灯承载故事，环境承载情绪**（`STYLE.md:24`）。最暗值是暖墨，最亮值是光源本身被辉光晕开。除「必须变黑」的那一拍外，把环境中间调抬约 **×2–2.5** 以保证可读性（`DEMO.md:153`）。逐帧核对：f01 近黑藏青（章节卡）→ f03/f04 冷蓝雾 + 暖琥珀窗 → f09–f11 森林冷蓝绿 → f12/f13 风暴压到近单色 → f14 几乎全黑（`T.dark = 42.0`）→ f15 只留一点暖火 → f17/f18 灯室极暗 + 透镜白 → f19–f21 灯塔暖光扩散到海面 → f22–f24 片名金色。**冷 → 更冷 → 暖**的推移与「两种温度」逐条对上。
- **颜色来自色带 + 抖动**：3–6 个色阶按亮度选取，穿过很窄的 4×4 Bayer 抖动带——立绘 `dz ≈ .22`、贴图 `dz ≈ .45`，**再宽就到处是棋盘噪点**（`px.js:4-6,62`、`DEMO.md:148`）。
- **禁止出现的颜色**：胶片颗粒带来的灰噪（**像素画不许有颗粒**，mux 的 grain 必须为 0）；纯黑（暗部要暖墨）；把两套布景的雾色 / 光钥匙混着用（会毁掉「一景一色」的切景语法）。
- **同一画面最多几个色相**：一个环境温度 + 一个暖实体光 + 主角那一抹饱和色，共约 **3 个色相组**；UI 另加一金属 + 一纸白。

---

## 4. 转场规则

- **镜头之间怎么切**：换布景时走**短淡入淡出到黑**（`ui.js` 的 `FADES`、`blackout`），同布景内**硬切**；章节卡是一次换景的**正式分隔**；结尾回到开场机位是一次「押韵式」回切（`style-dna/hd-2d.md:52-56`、`ui.js:111-117`）。抽帧实测：pier → forest 的边界（25.5 s）确有一帧近乎全黑（f09 的抽帧落在 27.08 s 已进森林，25.5 s 处的源帧亮度骤降），与「换景黑场」一致。
- **有没有叠化 / 闪白 / 擦除 / 定格**：有**淡入淡出**与**硬切**；有**闪光曲线**——闪电按 `flash(t)` 的 150 ms 击 / 下凹 / 60 ms 再击 / 指数衰减，同时抬升半球光、一道 bolt 光、天空、云、海面与曝光（`cliff.js:181`、`DEMO.md:69`）。**没有划像、没有 3D 旋转、没有花式擦除。**
- **硬切点怎么定**：切点挂在 `story.js` 的 `SHOTS` 与事件表 `T` 上——灯塔闪→灭 11.5/12.35、点火棒 16.2、对话框进/出 17.3/24.0、狂风 40.6、火变小 41.3、几乎全黑 42.0、重燃 45.6、起身 47.6、倒火 52.6、点燃 53.5、光柱扫海 54.4、船灯逐一亮起 59.2（`story.js:13-21`）。**高潮点燃落在配乐的一个下拍上**（53.5，`score.wav` 实测起音 53.4963 s，误差 **−3.7 ms**，`CUES.md:37-42`）。
- **转场时长与缓动**：淡入淡出为短黑场；相机路径是 2–7 把键的**单调三次样条**（`track()`，**无过冲**）；焦点每帧从相机重算到主体（`DEMO.md:37`）。
- **绝对不要的转场**：划像 / 3D 旋转；过冲回弹的镜头曲线；把移轴当作一次独立 blur pass（必须折进景深的带符号 CoC，否则破坏遮挡，`STYLE.md:91`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **Cormorant Garamond italic 500**（旁白字幕 / 格言）；章节与片名用 **Cinzel 500/700**（宽字距的碑铭体大写）；对话框正文 Cormorant 500、名牌 Cormorant 600。全部 OFL（`DEMO.md:60,73-76`） |
| 字号（相对画面宽 / 高） | 旁白字幕 **50 px**（1920×1080 上约 **2.6% 画面宽 / 4.6% 画面高**）；章节卡章名 78 px、`CHAPTER I` 34 px；片名 118 px；对话框正文 44 px、名牌 34 px（`DEMO.md:73-76`）。`dub` 条目给的字号因子是 **0.0463**（≈50px @1080 高），与此一致 |
| 颜色 / 描边 / 阴影 | 字幕 `#f6f0e2`，**drop shadow 10 px**，坐在一条柔和水平暗带上（渐变，最大 alpha **.38**）；对话框是深蓝渐变 `rgba(14,18,34,.86) → rgba(6,8,18,.9)` + **2 px 金边** `rgba(214,190,130,.9)` + 内 1 px 细线 + 金菱形四角（`DEMO.md:73-74`） |
| 位置 / 安全边距 | 旁白字幕**居中压在 y = H − 88**（约底部 8%）；对话框 **1180×210 px 底部居中**，名牌骑在上边缘左侧；片名卡屏幕压暗 50% 后居中（`DEMO.md:73-76`）。`dub` 条目 `marginVFactor 0.14537`（≈157px）比 demo 的 88px 更低，需注意 |
| 单行字数上限 / 最多行数 | 旁白**一行制**、单句 16–76 字符（`style-dna/hd-2d.json#sentence_patterns.length`）。抽帧实证：最长的一句 71 字符（f03/f04 的 `For a hundred years, the lighthouse of Greywater never once went dark.`）在 1920 宽上仍是**完整一行**。对话框**一条台词一框**，文字在约 **92%** 的语音时长里逐字打完（`DEMO.md:74`） |
| 出现与消失方式 | 字幕在语音前 **~0.35s** 淡入、语音结束后 **0.45–0.8s** 淡出；对话框进场**上滑 14 px** + 柔和 chime，打字完显示闪烁的金色 ▼ 光标；章节卡 / 片名停留 **≥ max(1.8s, 语音 + 0.6s)**（`STYLE.md:34-36`、`DEMO.md:74`） |

- **字幕与旁白的关系**：旁白走**衬线斜体一行制字幕**；**屏幕上的说话人走对话框、不走字幕**（两条通路，`story.js` 的 `VO[].dlg` 决定走哪条）。逐帧实证：f06（17.52 s）对话框已进场但**框内还是空的**（`T.dlgIn = 17.3`，台词 17.8 s 起），f07（20.71 s）正文正在逐字打出（`Take the last flame, little Wren. Keep it clo`），f08（23.90 s）满文并已折成 **2 行**、整体在淡出（`T.dlgOut = 24.0`）。`.srt` 从同一份数据导出（`tools/srt.py`：`story.js` 的 `VO` + `voices/dur.json`，+0.5s hold，对话框台词前缀 `OLD KEEPER:`）。
- **移轴不会模糊字幕**：叠加层在后期链**之后**合成（见第 2 节的实测边缘能量 5.337 / 5.339），所以把清晰带调窄不会牺牲字幕可读性。
- **本风格特有的字幕禁忌**：不许把抽象概念当主语；不许第一人称抒情、网络口播腔、感叹号堆叠；一句只承担一个画面动作；**绝不许在片子里念出参照作品的名字**（只学语法，绝不点名，`STYLE.md:4`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「centred low on a soft dark gradient band」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#9E000000`（AARRGGBB，落盘 ASS 为 `&H9E000000`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(0,0,0,0.38)）；字色 `#f6f0e2`（纸白，取自 `ui.js:81` 的 `textColor`）与该底衬的 WCAG 对比度 **16.39**（★ 2026-10-05：底色由浅奶油 `#fff0c8` 修正为夜空后重测；像素级实测 16.52）。

---

## 6. BGM / 音效特征

- **配乐（本次真实入库）**：demo 走「**在一首授权曲内部剪开**」的路线——**Scott Buckley《Precipice》，CC BY 4.0（署名即可）**。源文件 `music/src/sb_precipice.mp3`（44.1 kHz 立体声 / **118.838 s** / 4,757,610 B），由 `music/edit.py` 剪成 **五段对齐画面**（`CUES.md:16-26`）：S1 0.30–11.60（原曲 P4.70–16.00，D 持续音垫当章节卡）→ **灯灭 0.8 s 停顿**（11.60–12.40，合成房间混响尾 RT60 1.5 s）→ S2 12.40–42.00（P18.486–48.086，码头→夜林→风暴连续渐强）→ **42.00 硬切进混响尾**（50 ms 余弦切断，只留约 −44 dBFS 持续音）→ S3 42.05–44.90（P6.20–9.05 片头 D 垫回来）→ S4 44.30–66.95（P70.546–93.195，**P79.746 的 D→G♭ 转调下拍 = 成片 53.500**，即灯塔点燃那一帧）→ S5 66.95–76.50（跳到 E♭ 终止和弦 P104.849，自然衰减）。原曲结构（librosa）：P0–12 D 持续音垫（约 −43 dB）→ P12–36 D/G/B♭ 大调第一乐段 → P36–49 渐强到 G → P50–76 转 D 小调/A 属持续紧张段 → P79.7 突然转 G♭、低音铜管进入（全曲高潮）→ P104.9 落 E♭（`CUES.md:14`）。**授权说明与署名文本在 `music/CREDITS.txt` 与 `demo/CREDITS`；片名卡底部也有一行授权小字**（抽帧 f24 可见 `Music "Precipice" by Scott Buckley — scottbuckley.com.au (CC BY 4.0) · Fonts: Cinzel, Cormorant (OFL)`）。
- **拟音（foley，全部由 `mix.py` + `core/audio/sfx.py` 合成，无采样）**：按微缩模型的材质分层——按表面分层的脚步（木 / 土 / 石 / 雪，`stepSoft`）、火的噼啪、布料、对话框与菜单的 **UI chime**、东西开启的小铃、每道闪电之后 0.25s 的雷、一次大点燃的**深低频轰鸣 + 高频微光**（`boom`：42 Hz drop + air + shimmer，落在 53.5）、船灯逐个亮的六记小铃；每个场景有各自的环境床（港镇浪 + 缆绳吱呀 / 火盆噼啪 / 夜林虫鸣 + 叶响 / 风暴雨 + 风）并交叉淡入淡出（`mix.py:22-40,44-82`、`DEMO.md:43`）。
- **旁白处理**：讲童话的旁白者（Kokoro `af_heart`，speed .82–.90，慢）；屏幕上的角色低通到 **~7 kHz**（`bm_george`，speed .84）好让他「在世界里」；发明的地名 / 人名写进 TTS 的 `asr` 字段（demo：`Graywater`、`Ren`、`whisper would`，`DEMO.md:41`）。本次 8 条人声（`voices/n1…n7` + `k1`）全部用 Kokoro **本地重生成**并过 `core/tts/asr_check.py`（faster-whisper）校对。
- **★ 实测响度与真峰值（本次成片）**：**成片 `I = −14.02 LUFS`**（目标 −14；另一次独立测量 −13.9，差在读数容差内）、**真峰值 `input_tp = −1.54 dBTP`**（交付目标 ≤ −1.2，**达标**）、`LRA 10.30 LU`。母带前的 `demo/mix.wav` 是 48 kHz / 32-bit float 立体声 / 76.5 s / 29,376,088 B，实测 `I = −15.90 LUFS` / 真峰值 `−2.49 dBTP`。★ 判据必须用 **`loudnorm` 的 `input_tp`**（4× 过采样），**不要**用 `astats` 的 `Peak level dB`（那是采样峰值，会误判）。
- **混音规则（原设计）**：总线电平定在人声 −17、音乐 −21、环境 −30、拟音 −27 dB RMS；音乐在旁白下再压约 **2.2 dB**，并做**逐句自动避让**（把人声窗口里的音乐 + 环境压到比人声低约 **10 dB，只压不抬**，脚本逐句打印实测差，demo 为 7–14 dB）；`tanh` 软削波；最终响度走 `core/render/mux.sh`（两遍 loudnorm −14 LUFS，loudnorm 的 TP 目标 **−1.7**，见第 11 节），**颗粒 0**（`STYLE.md:70`、`mix.py:104-115`）。
- **静音策略**：静默是工具。**灯灭处 0.8s 基本无音乐**（只留合成混响尾，11.60–12.40）；**火苗将熄 42.0 处硬切进 0.5s 抽空段**（只剩约 −44 dBFS 持续音），其间放**两记心跳**；火光重燃时才让音乐回来。抽空是「奖赏前的黑暗」，不是失误（`STYLE.md:67`、`CUES.md:20-26`）。抽帧侧对得上：f14（43.02 s）几乎是全黑 + 无字幕，f15（46.21 s，`T.relight = 45.6`）火已重燃、字幕 `But a flame held by careful hands does not go out.` 在画。

---

## 7. 素材偏好

- **需要什么素材**：几乎**不需要外部素材**——所有画面都是代码生成（three.js 场景 + 程序化像素贴图 + 逐像素画的人物，`CREDITS:4-6`）。要产出的是：**内容文件**（`story.js` 的 `DUR`/`SHOTS`/`T`/`VO`、`lines.json`、`vo_times.json`、`sfx_events.json`）；**每套布景一个模块**（导出 `build<Name>() → { scene, update }`）；**角色姿势表**（`chars.js` 的 `WREN`/`KEEP`，姿势即数据，新增姿势 = 新增一条表项）；以及**配乐**（一首弧线吻合的曲子，或原创）。字体需 Cinzel + Cormorant Garamond 的 OFL woff2（`fonts/`）。
- **不需要什么素材**：不需要照片、实拍、3D 资产包、AI 生成图（`CREDITS:6`）；不需要胶片颗粒插件（**必须 grain 0**）；不需要划像 / 3D 转场插件；**绝不需要、也不许使用**参照作品的角色、地点、标志、UI 饰件或音乐（`STYLE.md:4`）。
- **取景 / 质感 / 比例偏好**：**24 px/m** 恒定纹理密度（`worldUV` 按法线做平面投影，`kit.js:7-16`）；`NearestFilter`、无 mip 模糊；立绘 34×50 px + 1 px **selout** 镂空描边（朝墨色压暗 `#1a1016`，`px.js:39-48`）；建筑只用盒子 + 圆柱，植被 / 远船 / 山脊用公告板；窗户是自发光像素窗格（emissiveIntensity 2.2），火是 **6 帧像素图集按 ~10 fps** 步进的公告板，海面是自写 shader（量化波纹 + 浪脊带 + 倒影条 + 碎光）。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有授权曲就写**原创室内幻想乐**（竖琴 / 钢片琴 / 弦乐 / 圆号），或先跑**静音占位**把画面链验证完；没有原创角色就**减少姿势数、复用同一套骨骼**，但**绝不能**把立绘换成平滑插画或加抗锯齿；没有 24 px/m 贴图就**降低布景复杂度**（少道具、多公告板），但**绝不能**放弃 `NearestFilter` 或用线性插值——那会立刻变成「低模卡通」而不是 HD-2D。
- **配乐源不进 git 是既有设计**：`.gitignore:58-59` 排除 `styles/*/demo/**/*.mp3` 与 `*.wav`，所以 `music/src/sb_precipice.mp3`、`voices/*.wav`、`score.wav`、`mix.wav` 只落本地。新机器上要按 `DEMO.md:107` 的直链重新 `curl` 才能重跑 `edit.py`。**这不是版权缺口**（CC BY 4.0，署名即可），别当成缺素材处理。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 5.5–14s（demo 最短 5.5s 章节卡、最长 14s 风暴石阶；每 1–2 镜一套布景）（`DEMO.md:28-35`、`story.js:3-12`） |
| 全片时长 | **76.5s**（`style.json` dur 76.5、`story.js:2` `DUR = 76.5`、frame_sec 55.08）；本风格按「章节数 × 每章一套布景」伸缩 |
| 帧率 | **24 fps / 1836 帧**（2026-10-04 全量重渲后成片实测）。`DEMO.md:125` 的入库规格是 60 fps，2026-10-03 的「移轴剪」版（`demo/out/video_tilt.mp4`）曾按此实渲——用 `mpdecimate` 复核它，去重后仍留 **3791 / 4590** 帧（≈83%），证明是**真逐帧运动**而不是 24 → 60 的复制帧（若是复制，去重后只会剩 ≈1836 帧 / 40%） |
| 镜头数 | 6 个镜头 / 8 段；7 条旁白 + 1 条对话框台词（`DEMO.md:24`） |
| 信息投放节拍 | 章节卡（0–5.5）→ 地标立起且**失效**（5.5–15）→ 对话框交接（15–25.5）→ 旅行（25.5–35.5）→ 试炼（35.5–49.5）→ 高潮点燃（49.5–58）→ 回到开场且已变（58–67）→ 片名 + 格言（67–76.5） |

- **加速 / 减速点**：加速在**风暴石阶**（35.5–49.5，四段相机：俯冲 / 停 / 起身 / 拉远，`cliff.js:185-190`）与**点燃爆发**（曝光按 `exp(-(t-53.5)/.22)` 冲一下，`cliff.js:255-265`）；减速在**章节卡**（0–5.5）与**片名收束**（67–76.5）。抽帧侧：f12（36.65 s）是崖体的大远景、立绘小到只剩一个红点，f13（39.83 s）已俯冲到石阶上的跪姿，f17（52.58 s）进灯室、f18（55.77 s）光柱已扫海——四段的「俯冲 / 停 / 起身 / 拉远」在 3.19 s 一帧的采样下清晰可辨。
- **留白与静音的位置**：两处结构性留白——**灯灭 0.8s**（11.60–12.40，音乐呼出一口气）与**火苗将熄 42.0 的 0.5s 抽空**（两记心跳，只剩约 −44 dBFS 持续音）；此外「片名 + 格言」段近静止收尾（`CUES.md:20-26`）。
- **运动质量**：**立绘步进、其余一切滑动**——走路 4 帧循环按 **6–10 fps**（demo 森林用 9 fps，`['w0','w1','w2','w3'][Math.floor(t*9)%4]`）、待机 2 帧约 1.4 Hz 交替、每几秒眨一次眼、姿势**瞬间硬切**；相机、光、粒子、光柱、焦点**每帧 60 fps 更新**（`STYLE.md:40`、`DEMO.md:64`）。**灯在呼吸**：每个火焰用三正弦叠加闪动约 **±20%**，一个灯的 `lit` 值同时驱动立绘里火苗的大小、点光强度（∝ `lit^1.3`）、辉光不透明度与尺度（`fx.js:5`、`DEMO.md:66`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。**本风格没有 `demo/build.sh`**，权威命令在 `styles/hd-2d/DEMO.md` 的「Build notes」（`DEMO.md:103-131`）。下表同时给出**本次成片实际执行过的**命令与实测值。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/hd-2d/demo --fps 60 --workers 2 --q tilt=1 --out styles/hd-2d/demo/out/video_tilt.mp4`（**4590 帧 @60fps；本次实测 190 s**） |
| 前置：ffmpeg 进 PATH | `export PATH="/d/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin:/d/Feijian/_internal:$PATH"`（**不设会报 "ffmpeg is not installed"**） |
| 帧率 | **24 fps / 1836 帧**（2026-10-04 全量重渲后实测；**原记** 60 fps / 4590 帧，是 2026-10-03「移轴剪」版，见第 8 节 `mpdecimate` 复核） |
| 分辨率 / 比例 | **1920×1080（16:9）**；内部 2× 超采样 = 3840×2160；`FILM_META.aspects` 支持 16:9 / 9:16 / 3:4 / 4:3 / 1:1（页面外壳等比装入，见第 2 节） |
| 混流 | `cd /mnt/d/lemo-opuscar && LEMO_VENC=h264_nvenc sh core/render/mux.sh styles/hd-2d/demo/out/video_tilt.mp4 styles/hd-2d/demo/mix.wav /mnt/d/lemo-films/hd-2d/hd-2d.mp4 60 0`（末位 **0 = grain 0**，像素画不许有颗粒；**走 GPU 的 nvenc**） |
| 编码器 | `h264_nvenc`（`LEMO_VENC=h264_nvenc`；core/render/mux.sh **未设 LEMO_VENC ⇒ h264_nvenc（GPU 优先）**，**显式 libx264 才走 CPU**，传错值报错退出而不是静默回落，`core/render/mux.sh:180-190`） |
| 音频入口 | `python styles/hd-2d/demo/mix.py`（环境 + 拟音 + 人声 + 避让 → `mix.wav`）；配乐 `(cd styles/hd-2d/demo/music && ../../../../.venv/bin/python edit.py)`（读顶部 CONFIG 的 `T_CAESURA`/`T_SILENCE`/`T_HIT`/`NARRATION` → `score.wav` + `CUES.md` + `measure.json`）；配音 `python core/tts/tts.py styles/hd-2d/demo/lines.json styles/hd-2d/demo/voices`。★ 跑 `edit.py` / `mix.py` **前必须限制 BLAS 线程数**（见第 11 节） |
| 字幕入口 | `python styles/hd-2d/demo/tools/srt.py`（**demo 自带**，从 `story.js` 的 `VO` + `voices/dur.json` 导出） |
| 事件导出 | `node core/render/events.mjs styles/hd-2d/demo`（本次 **events 0 条**、dur 76.5） |
| 本风格专属参数 | 渲染期后处理开关 `?tilt=1`（**移轴版**，在 `post_ts.js` 里，不是二次处理）；另有 `ss=1`（不超采样）、`only=harbor\|forest\|cliff`、`nobloom`、`nodof`、`noglow`、`nocredit=1` |
| 审片剧照 | `node core/render/still.mjs styles/hd-2d/demo 8 16.9 30.5 42.8 53.8 62 71 --q tilt=1 --out styles/hd-2d/demo/out/review` |
| 一键复现 | **无 build.sh**；按 `DEMO.md:103-131` 的 7 步依次执行（TTS → ASR 检查 → 配乐剪辑 → 混音 → 字幕 → 渲染移轴版 → 封装） |
| 流水线入口 | `node lemo-make.mjs hd-2d --ratio 16:9`（编排器通路；**本次入库版不是它跑的**，是「`video.mjs --q tilt=1` → `mux.sh 60 0`」两条手跑命令，见上） |
| 成片 | `D:/lemo-films/hd-2d/hd-2d.mp4` —— **48,121,093 B / 76.500 s / 1836 帧 / 1920×1080 / 24 fps**（**原记** 2026-10-03 入库版「移轴剪」为 71,454,034 B / 4590 帧 / 60 fps） |

---

## 10. 编排规则

- **内容文件字段契约**：`story.js` 是**唯一事实源**，导出——`DUR`（总秒数 76.5）；`SHOTS[]`（`{id, a, b}` 按秒的镜头表，`shotAt(t)` 取镜）；`T`（事件时间表：`lhFlicker`/`lhOut`/`light`/`dlgIn`/`dlgOut`/`gust`/`dim`/`dark`/`relight`/`pour`/`ignite`/`beams`/`ships`…）；`VO[]`（`{id, t, sub, dlg?, who?, title?}`，`t` 为开始时间、`dur` 取自 `voices/dur.json`，有 `dlg` 走对话框、否则走字幕、有 `title` 走片名卡）。另有三份从属文件：`lines.json`（TTS 行 `{id, text, voice, speed, asr?}`，发明的地名 / 人名写进 `asr`）、`vo_times.json`（每条人声起始秒——**`mix.py` 读它、不读 `story.js`**）、`sfx_events.json`（各场景脚步时间与两记雷）（`style-dna/hd-2d.json#asset_contract.content_fields`）。本次 `vo_times.json` 实测为 `n1 6.8 / n2 12.6 / k1 17.8 / n3 27.0 / n4 36.3 / n5 44.3 / n6 59.5 / n7 69.3`。
- **事件词汇表**（画面事件 → 声音，`mix.py` 的 `place()`）：`lhFlicker`/`lhOut` → `fwoomp`（灯灭：低频吸气 + 噪声收尾）；`light` → `strike`（划火）+ `chime`；`dlgIn` → `chime`（对话框 UI 提示音）；`pierSteps`/`forestSteps`/`cliffSteps`/`lampSteps` → `stepSoft`（木 / 土 / 石）；`gust` → `whoosh`；`dim`/`dark` → `fwoomp` 压小 + `heartbeat`；`relight` → `strike`（轻）；`pour`/`ignite` → `strike` + `boom`；`beams`/`ships` → `bell`（船灯逐个亮的小铃）；闪电由 `cliff.js` 的 `flash(t)` 曲线驱动，`mix.py` 在每道闪后 **0.25s** 放 `thunder`。
- **时间线契约**：页面契约（`main.js`）暴露 `window.render(t)` / `window.READY` / `window.DUR`。`render(t)`：`shotAt(t)` 取镜 → `SET_OF` 映射到布景 → 把 DOF pass 指向该布景的 `scene` → 重置后期默认值（bloom .55/.85、曝光 1.15、warm .1、sat 1.05、vig .62）→ 调 `set.update(t, shot, camera, post, renderer)` → 若 `?tilt` 则套移轴（`tiltAmt 17`、`tiltC = tiltCenter`、`tiltW .075`、`tiltF .3`、`maxCoc ≥ 24`）→ `composer.render()` → `drawOverlay(t, shot)`。所有布景共用一台 `PerspectiveCamera(32, 16/9, .3, 2000)`，由每个布景每帧自己设 fov / 位置 / lookAt（`main.js:17,43-56`）。**`drawOverlay` 在 `composer.render()` 之后**——这是字幕不被移轴模糊的原因（第 2 节实测）。
- **新增主体怎么接入**：一套新布景 = 一个模块，导出 `build<Name>() → { scene, update }`。`scene` 里建：雾（`FogExp2`）、天空（`sky()` 的 mesh）、灯光组（一盏投影主光 + 半球补光 + 实体点光 + **一盏约 2 m 在主角前方的冷色前置补光**）、几何（只用 `box`/`cylinder` + `worldUV` 保持 24 px/m）、公告板植被与道具、粒子 / 雨 / 光柱。`update(t, shot, cam, post, renderer)` 每帧：用 `core/lib.js` 的 `track()` 设相机位与 `lookAt`、设 `fov` 并 `updateProjectionMatrix()`、设 `post.dof.focus/aper/maxCoc`、按需覆盖 bloom 强度 / 阈值、曝光与 `vig` 的 `amt/warm/sat/contrast/fade`。角色用 `makeChar('wren'|'keeper', extraPoses)` 得到 `{ root, mesh, frame(name), face(cam, flip), lanternPos(name, flip) }`，**`root.userData.char` 就是移轴追踪器要找的标记**。注册：`main.js` 的 `sets.xxx` + `SET_OF.xxx` + `story.js` 的 `SHOTS` 加一段（`DEMO.md:189-228`）。
- **换主题时要改哪些文件**：**先改 `story.js`**（`DUR`/`SHOTS`/`T`/`VO`），再把语音起始时间抄进 `vo_times.json`（`mix.py` 读它），让 `sfx_events.json` 的脚步与布景的走路帧对齐，并挪动 `music/edit.py` 顶部的 cue 常量（`T_CAESURA`/`T_SILENCE`/`T_HIT`/`NARRATION`）（`DEMO.md:144`）。布景层改 `harbor.js`/`forest.js`/`cliff.js` 与 `chars.js` 的姿势表；`px.js`/`kit.js`/`fx.js`/`post_ts.js`/`ui.js` 的**引擎层不动**——这是本风格最关键的复用机制：**换故事与布景，渲染引擎与后期链不变**。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里是 `derived:true` 条目，`derivedFrom:["palette@lib/dub-visual.json","subtitle-px@STYLE.md §4","contrast-rule(WCAG)"]`。**能生效的参数**：`palette`（bg `#101d3e`、bg2 `#2c4262`、fg `#f6f0e2`、accent `#d8c28e`、subtitle `#f6f0e2`、subtitleBack `#B3000000`；★ 2026-10-05 由原 bg `#fff0c8`/fg `#2e0b14`/accent `#995500`/subtitle `#2E0B14` 修正）、`bgRecipe`（type **gradient**、stops `#050818 #101d3e #2c4262`、texture **none**、vignette 0.08；★ 2026-10-05 由原 type solid / stops `#fff0c8` 修正）、`subtitle`（fontFamily **SimSun**、fontSizeFactor 0.0463、marginVFactor 0.14537、outlineFactor **0**、bold false、align 2）、`title`（fontSizeFactor 0.086）、`overlay`（**chapterCards true**，其余 false）、`motion`（subtitleFadeIn 0.12、chapterTransition **cut**）。⚠ 该条目有 **3 处直接违反本风格硬规则**，详见第 11 节。

---

## 11. 当前短板与避坑要点

### 已知缺陷

- ~~**【composition −2】9:16（产品默认）不可用**：本风格按 1920×1080 绝对像素构图、无 `aspects` 声明，硬渲成 1080×1920 时右侧约 **43.75%（≈840px）丢失**、下方 840px 整片黑。后果：居中单行字幕**右半句被切**并掉进黑区；章节卡（f01/f02）与片名卡（f22–f24）右半文字被切；对话框 1180px 宽的右端与 ▼ 光标被切；**横向的移轴清晰带在竖屏下彻底失效**——这是本风格最核心的读法。**正确做法是把相机与构图改成竖向**（重设 `fov`、把主体与 UI 收进 1080 宽内），不是裁切。本次**未实渲 9:16 复核**，按既有 1:1 左上角塞入口径推导。~~ **★ 2026-10-04 已修**：`demo/index.html` 加「设计帧等比装入」外壳 + `demo/film.js` 声明 `aspects`（5 个比例全支持），9:16 下整幅画面（含立绘、提灯与底部单行字幕）都在、不裁切（见第 2 节）。残留代价：竖屏有效画面只占 1080×608、移轴带与 24px/m 微缩细节缩到 608 高后有可见损失、留边无全屏层内容。**注意**：这是**装入**（等比缩放，构图不变），不是「把相机与构图改成竖向」的原生竖版方案——若产品要原生竖构图，仍需另做版式。
- ~~**【palette −1】`lib/dub-styles.json#hd-2d` 的 palette 与本风格冲突**：(1) `palette.bg = #fff0c8`（**浅奶油底**）——本风格是**夜景片**，底色应是 `#050818`–`#16223a` 的冷蓝，浅底会让整片读成白天的纸片；(2) `bgRecipe.texture = "grain"`——本风格明确要求 **grain 0、「没有胶片颗粒」**（`STYLE.md:20`、`DEMO.md:129`）。这 2 条使「文案 + 风格」通路的底色与质感与本风格几乎无法对齐。~~ **★ 2026-10-05 已修**：`palette.bg` 由 `#fff0c8` 改为夜空 `#101d3e`、`bgRecipe` 由 `solid` 改为 `gradient`（stops `#050818 #101d3e #2c4262`，取自 `harbor.js:14` / `DEMO.md:52`），并连带把由「亮底→深字」WCAG 规则推得的 `fg` / `subtitle` 改回 `#f6f0e2`（纸白，`ui.js:81`）、`accent` 改 `#d8c28e`（§3 UI 金）；`lib/dub-visual.json#hd-2d.palette` 同步修正（原抽取把 `cliff.js:161` 的**灯光色**当成了背景色）。渲帧实测：底色由浅奶油 → 夜空；字幕对比度 **6.00 → 16.39**（模型级）/ **16.52**（像素级，品红标记测试通过）。palette 18→19、matchScore 97→98。（`bgRecipe.texture` 那一半早在 2026-10-03 已修为 `none`。）
- **【typography −1】同一条目的字幕参数是「套默认」而不是「抽取」**：`subtitle.fontFamily = "SimSun"`——本风格要求 **Cormorant Garamond italic**（衬线斜体）+ Cinzel，宋体会立刻破掉「碑铭 + 老式衬线」的 UI 语法；`marginVFactor 0.14537`（≈157 px）也比 demo 的 `y = H − 88`（≈8% / 86 px）更低。字号因子 0.0463（≈50px @1080 高）这一项倒是与 demo 一致。
- **【−0，附带】`events` 导出为 0 条**：`story.js` 的 `T` 画面事件表**没有被导出成 events**，拟音落点全靠 `mix.py:68-82` 内部硬编码。下游若想用编排器的事件通路驱动拟音，会拿到空表（`events.json` 只有 20 字节）。
- **【−0，附带】字幕走旁路**：编排器告警「本 demo 没有本编排器支持的字幕生成器 —— 字幕源不重新生成」，随后由 demo 自带 `tools/srt.py` 重新生成。即**字幕轨是本次生成的**，但走的是旁路；下游若改动 `VO` 需确认这条旁路仍被调用。 ★ 2026-10-06 已修：编排器第 3 步字幕告警措辞已改（第五十三批，md5 65ddab44→dfa99004）——『告警误导 / 两处不一致』部分已消解
- **【−0，附带】仓库元数据错标**：`D:/lemo-tools/scripts/unblock-placeholder-audio.mjs:42` 把本风格标成 `placeholder: true, missing: 'music/src/sb_precipice.mp3（商业版权曲，仓库不含）'`。**这是错的**：该曲是 **CC BY 4.0（署名即可）**，不是商业版权曲，也不是「仓库不含素材」的缺口（只是按 `.gitignore` 的既有设计只落本地）。这条错标会误导下游以为配乐有版权障碍。以 `demo/music/CREDITS.txt` 与 `demo/CREDITS` 为准。
- **【audio −0，附带 · 项目级既有风险】`core/render/mux.sh` 的 AAC 编码余量对打击乐素材不足**：`core/render/mux.sh:94` 的 `LN_TP = -1.7`（= 交付线 −1.2 减 0.5 dB 的 AAC 余量）。**本片达标**——PCM 落在 −1.7，成片实测真峰值 **−3.21 dBTP**（**原记**：重渲前读数 −1.54 dBTP，当时过冲 **+0.16 dB**），稳稳落在 0.5 dB 余量内。但**同管线其它风格已经出现削波**：`pictogram-motion` 成片真峰值 **+0.28 dBTP**（超出满刻度）、`game-show` **−0.22 dBTP**，相对 −1.7 的 PCM 目标过冲达 **+1.4 ~ +2.0 dB**，远超 0.5 dB 余量。这是**项目级风险**而不是本片的缺陷。★ **正解在 `mux.sh` 的 `LN_TP` 余量**（核心共享文件，本次未擅自改动）；★ **不要用手工压限去补**——实测反而更差：原 `mix.wav` → 成片 **+0.248**；预压 TP −2.0 → **+0.445**；预压 TP −4.2 → **+0.879**。原因是 `loudnorm` 总会把响度拉回 −14 LUFS，**真正起作用的是波峰因数**，上游电平怎么改都改变不了成片峰值（`core/render/mux.sh:70-72` 也记了同一结论）。 ★ **2026-10-03 已修（全库）**：本行引用的他片先例均已用 `scripts/fix-truepeak.mjs` 音频重混达标 —— `pictogram-motion` **+0.28 → −1.65 dBTP**、`game-show` **−0.22 → −2.09 dBTP**（全库 43/43 现均 ≤ −1.2 dBTP）；旧值保留作历史（当时确实超标）。
- **细纹理 `textureRaw: pixel-post` 声明了但渲染未实现**：`lib/dub-styles.json#hd-2d.bgRecipe.textureRaw` 是 `pixel-post`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `none` ⇒ 落空（该风格粗粒度没有纹理层）），**不读** `textureRaw` ⇒ `pixel-post` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `pixel-post` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口

- **`music/src/sb_precipice.mp3` 只落本地、不进 git**（`.gitignore:58-59` 排除 `styles/*/demo/**/*.mp3|wav`）——这是**仓库既有设计，不是遗漏**；但新机器上要按 `DEMO.md:107` 的直链重新 `curl` 才能重跑 `edit.py`。同样被排除的还有 `voices/*.wav`、`score.wav`、`mix.wav`。
- **没有 `demo/build.sh`**：本风格的构建步骤只存在于 `DEMO.md` 的「Build notes」（`DEMO.md:103-131`），没有可一键复现的脚本（对比 `pixel-rpg`/`scifi-toon` 都有 `build.sh`）。下游复现时需手工按 7 步执行。
- **每套布景都要为新主题重画**：`harbor.js`（含海面 shader 调用）/ `forest.js` + `forest_art.js` / `cliff.js` 是人力最重的一块；`chars.js` 的姿势表也要为新角色重写。
- **字体只有 demo 那一套 woff2 子集**：Cinzel（500/700）与 Cormorant Garamond（italic 500 / 500 / 600），`fonts/` 下为 Google Fonts latin 子集 + OFL 文本；没有第二套字面。

### 能力限制

- 立绘只有 34×50 px，**脸部表演只能靠姿势切换与火苗大小**；细腻表情做不了。
- 相机**永远向下看世界**，做不了平视特写与主观镜头——这是硬规则，不是偏好。
- 单镜 5–14s、旁白 speed .82–.90，**做不了快节奏信息流**；RPG UI 只适合承载「一屏一件事」。
- 后期链是渲染期的（`post_ts.js`），**移轴 / 景深 / 辉光不能对成片做二次处理**。
- **多比例已支持（页面外壳等比装入）**：`FILM_META.aspects` 含 16:9 / 9:16 / 3:4 / 4:3 / 1:1；竖屏靠「设计帧等比装入」实现（整幅 16:9 画面不裁切地缩进竖屏），**不是**原生竖版构图——若要「把相机与构图改成竖向、主体与 UI 收进 1080 宽」的原生方案，仍需**另做版式**（见「下次迭代优先补什么」）。
- **最高可达分与原因**：palette 因「textureRaw 细纹理未实现」扣 1、typography 因 dub 通路字体与边距扣 1；其余（9:16 构图已于 2026-10-04 用页面外壳等比装入修复、移轴清晰带、逐帧运动、响度与真峰值、授权配乐与卡点、字幕与卡片）都已实测达标。★ 2026-10-05：dub 通路底色冲突（原 palette −1）已修（`palette.bg` `#fff0c8`→`#101d3e`、`bgRecipe` `solid`→夜空渐变、`fg`/`subtitle`→`#f6f0e2`），palette 18→19、matchScore 97→98；若再把 typography 的字体/边距与 textureRaw 细纹理两处补齐，本风格最高可达 **100/100**。本次实得 **98**。

### 踩过的坑（本机实测）

- ★ **跑 `music/edit.py` / `mix.py` 前必须限制 BLAS 线程数，否则会「假卡死」**：`edit.py` 在 12 核机器上因 OpenBLAS 起满线程 + 多任务并发，**35 分钟不结束**（519% CPU / 34 线程 / `nonvoluntary_ctxt_switches` 14 万）；加上环境变量后 **14 秒完成**。判据：`cat /proc/loadavg` 远大于 `nproc`。
  ```sh
  export PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 \
         NUMEXPR_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 BLIS_NUM_THREADS=1
  ```
- ★ **渲染前必须把 ffmpeg 放进 PATH**：`export PATH="/d/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin:/d/Feijian/_internal:$PATH"`，不设会报 `ffmpeg is not installed`。
- ★ **真峰值判据要用 `loudnorm` 的 `input_tp`**（4× 过采样），**不要**用 `astats` 的 `Peak level dB`（采样峰值，会误判达标与否）。
- **混流走 `core/render/mux.sh`（WSL 侧）+ `LEMO_VENC=h264_nvenc`（GPU）**；**fps 传 60、grain 传 0**（本风格档案要求 grain 0，无胶片颗粒）。本次渲染 4590 帧用 **190 s**（2 workers）。
- **媒介坑（`DEMO.md:146-158`）**：抖动带过宽 → 到处棋盘噪点（`dz` 必须 .22/.45）；点光坐在公告板平面上把立绘烧白（灯要往镜头方向挪 **0.42–0.45 m**，并在 shader 里封顶 `outgoingLight = min(outgoingLight, diffuse × 1.35 + emissive)`）；公告板只有正面法线、背后打光是黑的（**必加前置补光**）；圆柱光柱正对相机产生 **NaN**、被辉光摊成黑块（改用 `beamCard` 公告板光条）；海面倒影条除零（用 `max(.35, …)` 夹住）；风暴太暗读不出（在「必须变黑」那一拍之外把环境中间调抬约 **×2–2.5**）；远处船光被雾挡（`depthTest = false` + `renderOrder 5`）；无角色的镜头移轴追踪器没东西可跟（用固定带高 `TILT_C`）；点燃爆发以 **0.22 s** 时间常数衰减，所以 53.8 s 的静帧与相邻 60 fps 帧肉眼可见地不同（**这是预期，不是 bug**）；Node 渲染脚本在 `done` 后可能不退出（静态服务器 keep-alive，脚本末尾 `process.exit(0)`；打印 `done` 即文件已完整）。
- **同族风格的已知处理方式（不是本片的缺陷）**：配乐比画面长时，`mux.sh` 的 `-shortest` 会硬切在音乐还有余响的地方。`pictogram-motion` 遇到「配乐长于画面、画面没有尾巴」的同类问题时，用 **GPU 预处理补 `tpad` 定格尾巴**解决。**`hd-2d` 本次不触发**：它的 `score.wav` 与 `mix.wav` 都已经是 **76.5 s**，画面也是 76.5 s，三者等长。记录在此供同族风格参考。

### 下次迭代优先补什么

- ~~**校正 `dub-styles.json#hd-2d` 的 3 处冲突**（把浅奶油底改成夜蓝、去掉 grain、字体换成 Cormorant Garamond italic 并把 `marginVFactor` 对齐 `y = H − 88`）~~ ★ **2026-10-06 更新（3 处里 2 处已修）**：**底色**（浅奶油 `#fff0c8` → 夜空 `#101d3e`，见「已知缺陷」与第 3 节）与 **grain**（已改 `texture: none`）**已修**；**字体**一处**仍待** —— 本机无 Cormorant Garamond，派生通路按项目约定一律填本机真实存在的字体（见第 5 / 11 节），`marginVFactor` 亦未对齐 `y = H − 88`。
- **给 `core/render/mux.sh` 的 `LN_TP` 加余量**（项目级，影响所有风格；`pictogram-motion` 与 `game-show` 已实测削波/超线）。
- **修 `unblock-placeholder-audio.mjs:42` 对 `hd-2d` 的错误标注**（CC BY 4.0，不是商业版权曲）。
- **补一个 `demo/build.sh`**，把 `DEMO.md` 的 7 步固化成一键复现。
- **补 9:16 的原生竖向方案**（重设相机 `fov` 与构图，把主体与 UI 收进 1080 宽），而不是裁切。
- **让 `story.js` 的 `T` 事件表真正导出成 events**（本次为 0 条），把拟音落点从 `mix.py` 硬编码里解放出来。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03（本次为**移轴重渲后的回填**，原版蒸馏见同日更早一次） |
| 成片 | `D:/lemo-films/hd-2d/hd-2d.mp4` —— **76.500 s / 48,121,093 B（45.9 MB）/ 1920×1080 / 24 fps / 1836 帧**；音频 `I = −14.02 LUFS`、真峰值 `input_tp = −3.21 dBTP`（**原记** 2026-10-03 入库版「移轴剪」为 71,454,034 B / 60 fps / 4590 帧） |
| 抽帧 | `D:/lemo-tools/_distill/frames/hd-2d/`（24 帧 + `_contact.jpg` 6×4 接触印样）。工具：`node scripts/style-distill.mjs frames --only hd-2d --force`，等间隔 **3.1875 s**；实测映射 **t_k ≈ 1.583 + (k−1) × 3.1875 s**（用 `select=eq(n,…)` 帧精确反查，13 帧 SSIM = 1.000000 命中） |
| 旧帧备份 | `D:/lemo-tools/_distill/frames/hd-2d.bak-24fps/`（来自已作废的 24 fps 非移轴版，仅存档） |
| 风格匹配度自评 | **98/100**（2026-10-05 校正：dub 通路底色冲突已修，palette 18→19）（2026-10-05 原记：曾为 97 —— 新增「textureRaw 细纹理未实现」缺陷 palette −1；更早原 96，9:16 画幅缺陷已修并回补 composition +2） |
| 详细资料 | 有：`styles/hd-2d/STYLE.md`、`styles/hd-2d/DEMO.md`、`styles/hd-2d/style.json`、`lib/style-dna/hd-2d.md`、`lib/style-dna/hd-2d.json`、`lib/dub-styles.json#hd-2d`、`styles/hd-2d/hd-2d.srt`、demo 源码（`story.js`/`main.js`/`px.js`/`kit.js`/`fx.js`/`chars.js`/`harbor.js`/`forest.js`/`cliff.js`/`ui.js`/`post_ts.js`/`mix.py`/`music/edit.py`/`music/CUES.md`/`music/CREDITS.txt`/`CREDITS`）。**无 `demo/build.sh`** |

**抽帧时刻表**（本次逐帧核对用的坐标）：

| 帧 | t（s） | 画面内容 |
|---|---|---|
| f01 | 1.58 | 章节卡：近黑藏青底 + `CHAPTER I`（Cinzel 金）+ 章名**淡入中**（几乎不可见）+ 飘过的像素火星 |
| f02 | 4.77 | 章节卡：章名 `Wren, the Lampbearer` 已显（Cormorant italic 78px） |
| f03 | 7.96 | 港镇全景（`harborWide`）；字幕 n1 `For a hundred years, the lighthouse of Greywater never once went dark.` |
| f04 | 11.15 | 港镇全景，镜头已缓推近；n1 字幕仍在（灯塔即将熄灭） |
| f05 | 14.33 | 港镇；字幕 n2 `Tonight, it did.` |
| f06 | 17.52 | 码头对话镜：**对话框已进场但框内还是空的**，名牌 `Old Keeper` 骑左上边（`T.dlgIn = 17.3`） |
| f07 | 20.71 | 码头：对话框正文**逐字打出** `Take the last flame, little Wren. Keep it clo` |
| f08 | 23.90 | 码头：对话框**满文并折成 2 行**、整体淡出中（`T.dlgOut = 24.0`） |
| f09 | 27.08 | 夜林横移；字幕 n3 `Through the Whisperwood, where even the moon loses its way,` |
| f10 | 30.27 | 夜林，镜头更近；n3 仍在 |
| f11 | 33.46 | 夜林：走过前景树干（树干糊成大暗块）；**无字幕**（n3 已结束） |
| f12 | 36.65 | 风暴崖**大远景**：远处灯塔只剩剪影、雨段横扫、立绘小成一个红点；字幕 n4 `up the Gale Steps, where the storm tried to take it from her.` |
| f13 | 39.83 | 风暴石阶：已俯冲到石阶上的跪姿，提灯火苗缩成一点；n4 仍在 |
| f14 | 43.02 | **近乎全黑**（`T.dark = 42.0` 之后）；无字幕 |
| f15 | 46.21 | 火光重燃（`T.relight = 45.6`）；字幕 n5 `But a flame held by careful hands does not go out.` |
| f16 | 49.40 | 风暴中远景，Wren 提灯很小；无字幕 |
| f17 | 52.58 | 灯室：点燃前（`T.ignite = 53.5`），立绘与透镜同框 |
| f18 | 55.77 | 灯塔已点亮，**光柱扫海**（`T.beam = 54.4`），从外看塔 |
| f19 | 58.96 | 回到港镇（`harborEnd`），灯塔已亮；无字幕 |
| f20 | 62.15 | 港镇 + 海上**船灯逐一亮起**（`T.ships = 59.2`）；字幕 n6 `And far out at sea, every lost ship found its way home.` |
| f21 | 65.33 | 港镇，船灯仍在；无字幕 |
| f22 | 68.52 | 片名卡 `THE LAMPBEARER`（屏幕压暗 50% 叠在港镇之上）；**格言尚未出现** |
| f23 | 71.71 | 片名 + 饰线 + 格言 `Every path begins with a single light.` + 署名 `LEMOLAB × CLAUDE OPUS 5.5` |
| f24 | 74.90 | 同 f23，另加底部一行授权小字 `Music "Precipice" by Scott Buckley — scottbuckley.com.au (CC BY 4.0) · Fonts: Cinzel, Cormorant (OFL)` |

**逐帧拆解要点**（从 24 张抽帧里真正看到的）：

- **色走**：f01 近黑藏青 → f03/f04 冷蓝雾 + 暖琥珀窗 → f09–f11 森林冷蓝绿 → f12/f13 风暴压到近单色 → f14 几乎全黑 → f15 只留一点暖火 → f17/f18 灯室极暗 + 透镜白 → f19–f21 灯塔暖光扩散到海面 → f22–f24 片名金色。**冷 → 更冷 → 暖**的推移与「两种温度」的声明逐条对上；每套布景的雾色 / 光钥匙都不同，切景一眼可辨。
- **★ 移轴清晰带**：24 帧里**每一帧都能看到**上下虚、中段实的带。最明显的三处是 f06–f08（码头：前景木板与背景整片糊，清晰带压在两枚立绘上）、f11（夜林：前景树干糊成暗块，只有 Wren 那条带实）、f17/f18（灯室：屋顶与底部栏杆糊，只剩立绘 + 透镜一条带）。见第 2 节的三组同刻 A/B 与 SSIM。
- **立绘的可找到性**：f12 里 Wren 小到只剩画面高约 1/12 的一个红点，仍能在近单色的风暴画面里一眼认出——「全片唯一饱和色」这条规则在成片里成立。
- **字幕节奏**：f01/f02 与 f22–f24 是卡片（无字幕）；f03–f05、f09–f10、f12–f13、f15、f20 是旁白字幕（一行制、居中压底）；f06–f08 是对话框（进场空框 → 打字 → 满文折 2 行 → 淡出）。字幕**只在有语音时出现**，卡片与片名段干净。
- **瑕疵**：24 张抽帧里**没有发现糊帧（非设计内的）、错位、黑边或字幕溢出**；像素边缘干净、无抗锯齿（符合 `NearestFilter` + selout 的声明）。f14 的近乎全黑是设计里的 `T.dark` 拍点，不是缺陷。**唯一"看着可疑但已排除"的是移轴**：已用同刻非移轴版对照 + 逐条带实测确认清晰带存在（第 2 节），不再记为缺陷。

**自检发现的缺陷**：
- ~~**9:16（产品默认）下右侧约 43.75% 丢失、下方整片黑**，居中字幕/卡片/对话框右端与横向移轴带一起失效（按口径推导，本次未实渲复核）。~~ **★ 2026-10-04 已修**：页面外壳等比装入（`demo/index.html`）+ `demo/film.js` 声明 aspects，9:16 下整幅画面不裁切（见第 2 节）。
- ~~**`dub-styles.json#hd-2d` 的 3 处冲突**：浅奶油底（应为夜蓝）、`texture: grain`（应为 grain 0）、`fontFamily: SimSun`（应为 Cormorant Garamond italic）。~~ ★ **2026-10-06 更新**：前两处（**浅奶油底 → 夜空**、**`texture: grain` → `none`**）**已修**；`fontFamily: SimSun` **仍待**（本机无 Cormorant，派生通路按约定用本机字体）。
- **`events` 导出 0 条**（画面事件表未接入编排器事件通路）。
- **字幕走旁路**（demo 自带 `tools/srt.py`，编排器不接管）。
- **`unblock-placeholder-audio.mjs:42` 错标**本风格的配乐为「商业版权曲」（实为 CC BY 4.0）。
- **`mux.sh` 的 AAC 余量不足**（项目级；本片达标，`pictogram-motion` +0.28 dBTP / `game-show` −0.22 dBTP 已超线）。 ★ **2026-10-03 已修（全库）**：本行引用的他片先例均已用 `scripts/fix-truepeak.mjs` 音频重混达标 —— `pictogram-motion` **+0.28 → −1.65 dBTP**、`game-show` **−0.22 → −2.09 dBTP**（全库 43/43 现均 ≤ −1.2 dBTP）；旧值保留作历史（当时确实超标）。
- **无 `demo/build.sh`**（构建链只在 DEMO.md 里）。

**本次为补齐短板做了什么**：
- **没有改动 `lemo-make.mjs`、没有改动 `D:/lemo-opuscar` 下的任何源码**（纪律红线）；**没有起任何渲染、TTS 或混流**（成片与音频链由 team-lead 的音频修复任务完成）；只**重抽了帧**（允许的操作）并写本目录两份文档。
- 把旧的 24 帧抽帧**先备份**到 `_distill/frames/hd-2d.bak-24fps/` 再重抽，没有直接覆盖。
- **用同刻 A/B 把「移轴是否生效」这条从「存疑缺陷」改判为「已确证达标」**：拿 `demo/out/video_gpu.mp4`（24 fps 非移轴）与 `demo/out/video_tilt.mp4`（60 fps 移轴）做帧精确对照（t = 8.0 / 30.5 / 53.8，SSIM 0.881 / 0.917 / 0.865），并把 `composition` 的 −5 撤销。
- **独立复测了音频**（`loudnorm` 4× 过采样）：成片 `I = −14.02 LUFS` / 真峰值 `−1.54 dBTP` / LRA 10.30；`mix.wav` 48 kHz 32-bit float / 76.5 s / `I = −15.90 LUFS` / 真峰值 `−2.49 dBTP`。据此把 `audio` 从 0 分改评为 20/20。（★ **原记**：上述 −1.54 dBTP 是**重渲前**的读数；该片已于 2026-10-04 全量重渲（24 fps / 1836 帧 / 48,121,093 B），当前成片实测真峰值 **−3.21 dBTP**（`loudnorm` `input_tp`，4× 过采样）、达标。）
- **独立复测了「60 fps 是否真逐帧运动」**（`mpdecimate`：去重后仍留 3791 / 4590 帧），把 `rhythm` 从 19 提到 20。
- **独立复测了缺陷 B 的两个先例**：`pictogram-motion` 成片真峰值 **+0.28 dBTP**、`game-show` **−0.22 dBTP**，并核对了 `core/render/mux.sh:60-94` 的 `LN_TP = −1.7` 余量设计，据此把它写成**项目级风险**而不是本片的缺陷。 ★ **2026-10-03 已修（全库）**：本行引用的他片先例均已用 `scripts/fix-truepeak.mjs` 音频重混达标 —— `pictogram-motion` **+0.28 → −1.65 dBTP**、`game-show` **−0.22 → −2.09 dBTP**（全库 43/43 现均 ≤ −1.2 dBTP）；旧值保留作历史（当时确实超标）。
- **更正了配乐时长的口径**：`sb_precipice.mp3` 实测 **118.838 s**（不是某些记录里的 161.6 s），`score.wav` 与 `mix.wav` 都已是 76.5 s，因此本片**不触发** `-shortest` 硬切尾巴的问题；该机制作为同族风格 `pictogram-motion` 的已知处理方式记录在第 11 节。
- **更正了旧文档的抽帧时刻**：旧文档写 f01 ≈ 0.0 s / f24 ≈ 76.5 s，实测应为 **f01 = 1.58 s / f24 = 74.90 s**（本页「抽帧时刻表」为帧精确反查结果）。
