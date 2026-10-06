---
name: lemo-style-stained-glass
description: 【lemo 风格 Skill · 彩色玻璃窗】需要「从昏暗石厅里看一扇中世纪花窗」的观感时用：彩色玻璃切块由暗铅条连成平面网络，脸与衣褶用棕色 grisaille 画在玻璃上，玻璃只有太阳在背后时才发光并把彩色影子投到石板地上，人物一块块僵硬地动。选定本风格做视频时，优先读本文件。
slug: stained-glass
name_zh: 彩色玻璃窗
category: 图形与排版
film: The Dragon of the East Window
---

# 彩色玻璃窗（`stained-glass`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/stained-glass/STYLE.md` · `styles/stained-glass/DEMO.md` · `styles/stained-glass/demo/build.sh` ·
> `lib/style-dna/stained-glass.json` · `lib/style-dna/stained-glass.md` · `lib/dub-styles.json#stained-glass` ·
> `styles/stained-glass/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部「从昏暗石厅里看一扇中世纪花窗」的片子——**光就是时钟、就是镜头、就是故事**。彩色玻璃切块由暗铅条 `#1d1f23` 连成一张平面网络，脸和衣褶用棕色彩绘（grisaille）画在玻璃上；玻璃自己不发亮，只有太阳在它背后时才发光，并把一张柔和的彩色影子投到石板地上；人物一块块地动、僵硬而分级（`STYLE.md:6-12`、`lib/style-dna/stained-glass.md:11`）。

**不是什么**（最容易做错的邻居风格）：不是加黑描边的矢量插画；不是万花筒或 Voronoi 滤镜（Voronoi 读起来像滤镜、平涂读起来像剪贴画）；不是蒂芙尼新艺术；不是马赛克（马赛克反射，玻璃透射）（`STYLE.md:14`、`STYLE.md:101`）。

**什么时候用它**：传说 / 文化遗产 / 节日故事——尤其适合「一件事按光的顺序一段段发生」的主题。一串按顺序被光走过的站点；把产品发布做成制作阶段、产品就是夜里发光的那一格；把一段人生放进四格，把那个选择做成那道裂缝；把历史做成一天里的各个时段（`DEMO.md:24`）。

**一句话内核**：**光即时间 + 人物 8fps 分级 + 裂开 / 上铅条**——这三条骨架不能拆（`STYLE.md:111-117`、`STYLE.md:91-95`）。

**边界**：这个风格**撑不起**快节奏、现代口语、第一人称抒情的内容。它的人物 8fps 步进，天生慢；它的语法要求「只有被照亮的窗格才是现在」，所以**画面必须有明确的受光顺序**，不能是均匀打光的一锅粥。题材必须**世俗**——不能出现十字架、圣徒、光环（借工艺，不借题材，`STYLE.md:12`）。它是重渲染风格（WebGL2 合成器 + 5 张画布），不适合需要极短交付周期的项目。

---

## 2. 画面构图

- **镜头数与画幅**：24 fps，原生 1920×1080（16:9），**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，见下）。样本片 1356 帧 / 56.5s。画面是「四格竖棂 + 上方一扇玫瑰窗」的固定建筑结构，镜头在这套结构里推拉摇移（`style.json:16-17`、出片日志 `MUX_OK 32354231 src_frames=1356`）。
- **主体位置与占比**：主体**很大**——特写约 **1.3–2.3× 一格竖棂宽**（`STYLE.md:76`）。窗格内人物沿对角线布置（样本：骑士左下、龙右上，`DEMO.md:50`）。被揭示的东西放画面中心、**≥ 画面宽的 1/8** 并带光晕。
- **负空间 / 留白**：**石墙与黑暗是留白**。帧 f04 整屏几乎全黑，只有第 I 格被一条刀锋般的黎明细光照亮、地面一块蓝色光斑；帧 f22 四格全暗，只有第 IV 格从内部暖亮。**没被照到的地方就是黑的**，这是构图的一半。
- **图层叠放顺序**（从底到顶）：① 石墙 / 斜壁 / 竖棂（`surface = albedo × (room ambient + 光格溢出的辉光 + 点光源)`）→ ② 玻璃画布 G（`tonemap(backlight × transmittance × 玻璃质感) + 陈化薄雾 × 室内光`）→ ③ 表面画布 S（铅条、铁鞍条、石）→ ④ 地面画布 P（石板 × (环境 + 投影色斑图，模糊 + 光晕 + 镜像)）→ ⑤ 光柱画布 R（加色 + 尘，窗口处近 0、向下约 40% 处最强）→ ⑥ 覆盖层 O → ⑦ bloom（亮玻璃「吃」进铅条 = 照射效应）+ 暗角（`STYLE.md:20-25`、`STYLE.md:35`）。
- **安全区**：字幕横幅贴底（中心约 (960, 968)，带宽 64，`subs.js:18`）；刻字（片名）在石带（string course）上，**必须推近到字高 ≥ 30 px 且把扫光停在字上**，否则夜里读不出来（`STYLE.md:48`、`STYLE.md:105`、`DEMO.md:112`）。
- **本风格不能出现的构图**：均匀打光（没有受光顺序）；Voronoi / 万花筒式随机切块；把铅条画成黑描边；十字架 / 圣徒 / 光环等宗教图像；地面投影是硬边的贴纸。

### 在 9:16（产品默认）下的表现

**已适配 9:16**（★ 2026-10-04 改造）——`FILM_META.aspects = ['16:9','9:16']`，字面量落在**新建的 `styles/stained-glass/demo/film.js`**（`film.js:15`）。改造点：`film.js` 导出 `NATIVE` 与 `setFrame(w,h)`（派生 `W/H/FX/FY/S = min(fx,fy)`，`film.js:12`）；`main.js` 首行读 `window.innerWidth/Height` 设 `cv.width/height` 再 `setFrame()`（`main.js:8-14`），G/S/R/O 四张画布与 WebGL 画布都跟着视口走；`scene.js` 的 `camMatrix()`（`scene.js:10`）与 `proj3()`（`scene.js:18`）把设计帧中心 `(960,540)` 换成 `(W/2,H/2)`，可见世界矩形 `hw/hh` 与 `clearRect` 一并派生（`scene.js:24-26`）；字幕绶带是**屏幕空间家什**，按「位置 ×FX/×FY、尺寸 ×S」重排（`subs.js:13`：`cx = 960*FX`、`cy = 968*FY`、`font = 44*S`、条高 `64*S`）。

★ **相机 zoom 不含 `S`**：世界按**原比例**居中（不拉伸、不重复乘 `FX/FY`），竖屏下自然看到更宽的纵向视野——这是本风格与「相机 `zoom *= S`」那类改造的关键差别（本风格的画面主体是**世界里的建筑**，拉伸会把玫瑰窗压成竖椭圆）。

**实测（1080×1920，`S = 0.5625`）**：**不裁切、无黑边**。8.5s 那帧整扇窗（四格竖棂 + 玫瑰 + 尖拱）连同地面光斑、石带刻字 `THE DRAGON OF THE EAST WINDOW` **完整入画**，构图比 16:9 更完整；28.25s / 41.0s 的字幕绶带缩到 `44×0.5625 ≈ 24.75px`、居中贴底（`968×1.7778 ≈ 1720`）、**不溢出画宽**（长句实测约 816px < 1080）；55.0s 结尾卡的四格窗与 `STAINED GLASS` 刻字完整可见。**真重排证据**：9:16 与「16:9 中心裁切」的 SSIM = **0.675 / 0.712 / 0.533**（8.475s / 28.25s / 48.025s；口径 `crop=607:1080:656:0` 后 `scale=1080:1920`，ffmpeg `ssim` 的 `All` 值），明显 < 1 ⇒ 不是裁切而是重排。**代价**：竖屏纵向视野更大，石带刻字在**特写帧**（2.0s / 48.0s）会**部分出画**（刻字是世界里的石带、非画面主体，片名揭示帧与结尾卡的刻字都完整）；本风格按 1920×1080 绝对像素构图的老结论（右侧丢 43.75%、下方整片黑）**已作废**。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 底（钴蓝，主导） | `#1d3a9c` | 采石格底、天空、画面主色 | `DEMO.md:74` |
| 深蓝 | `#142a70` | 暗部玻璃、夜间窗格 | `DEMO.md:74` |
| 红宝石 | `#a8101c` | 骑士披风、边框彩带、龙的翼 | `DEMO.md:74` |
| 金 | `#dc9a22` | 边框珠饰、光环状纹、正午光 | `DEMO.md:74` |
| 祖母绿 / 橄榄 | `#2f7f36` / `#6b7a22` | 草地、山丘、树 | `DEMO.md:74` |
| 紫红 / 灰白 | `#632a63` / `#cfdac6` | 小点缀 / 脸与嵌线 | `DEMO.md:74` |
| 肉色 | `#d2a288` | 人物脸与手（**比直觉更暗**） | `DEMO.md:74` |
| 余烬琥珀（故事光） | `#ff9a2a` | 龙守护的太阳余烬，全片唯一非玻璃光 | `DEMO.md:74` |
| 铅条 | `#1d1f23` | 玻璃之间的铅网络（6 单位，采石格 4.2） | `DEMO.md:77` |
| Grisaille 描线 | `rgba(44,26,12,.88)` | 眉 3.8 / 眼 3.0 / 褶 2.3–2.6 单位 | `DEMO.md:78` |
| 字幕（派生通路） | 字 `#F3E6C6` / 底带 `#E6F3E7C6` | 压在画面深底上的米白字 | `lib/dub-styles.json#stained-glass.subtitle` |
| 派生通路底 / 强调 | `#1d3a9c` → `#142a70` / `#dc9a22` | 钴蓝 → 深蓝渐变 + 强调金（★ 2026-10-06 修正：原 `#2a2a2e` 取自 `test.js:9` 的**模型页灰底**、非成片背景） | `lib/dub-styles.json#stained-glass.palette` |

- **明度 / 对比规则**：**两种色承载画面**（一种深、一种热），其余三到四种只作**小点缀**（Chartres 逻辑：钴蓝打底 + 红宝石 + 金 / 绿 / 紫红的点）。绿白色玻璃**省着用**（脸、嵌线、天空）。**肉色要比你以为的更暗**，否则背光下脸会烧成白（`STYLE.md:39-41`）。**太阳的颜色就是时钟**：蓝白黎明 → 近白正午（最亮）→ 金下午 → 深橙黄昏（**抬强度而不是加红**）→ 弱蓝月光；光斑长度跟着太阳高度走（`STYLE.md:42`、`DEMO.md:75`）。
- **禁止出现的颜色**：石与铅**只能从溢光或投影里拿颜色**，不能自己带彩（`STYLE.md:43`）。禁止把蓝色在红黄昏下压成泥——要保蓝、抬强度（`STYLE.md:100`）。除「故事光」（烛、灯、屏幕、余烬）外，不允许玻璃出现调色板以外的色相。
- **同一画面最多几个色相**：**2 个承载 + 3–4 个小点缀**（`STYLE.md:39`）。全片主色是钴蓝，热色随光序在红 / 金 / 橙之间走。

---

## 4. 转场规则

- **镜头之间怎么切**：转场**只能来自光与介质本身**——移动的光、光柱、一道裂缝、黑暗（`STYLE.md:76`）。最常用的是「随光带横向平移」（帧 f06 → f09 → f15 就是光带从第 I 格滑到第 II、第 IV 格）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有溶解、没有划像、没有翻页**（`STYLE.md:76`）。允许且有特色的两种：① **定格**——光离开某一格，那一格的人物**立刻冻结**（用 `min(t, t_lightLeft)` 实现，`story.js:53`）；② **裂缝**——9 条锯齿线在 **~0.28s** 内从受击点冲出，亮着光，**0.45s 白闪 + 2 帧抖动**（`story.js:79-89`、`story.js:203`）。
- **硬切点怎么定**：动作**落在拍上**（80 BPM，1 拍 = 0.75s）。样本片 31.8s 那一击之后**所有音乐硬切**（连混响尾巴都切掉，`DEMO.md:63`）。
- **转场时长与缓动**：光带移动是连续的（在 ones 上 24 fps 移动）；裂缝 0.28s 冲出；重新上铅条 `WELDS = [41.75, 42.5, 43.25, 44.0, 44.6]`，成组纸片**每拍滑一次**，每次以焊接火花收尾（`story.js:90`、`story.js:115-130`）。
- **绝对不要的转场**：溶解、划像、翻页等 UI 式转场；**任何元素的淡入**（东西是**被点亮**出现的，不是淡入的）；无来由的运镜；**让玻璃弯折或形变**（改表情只能换脸块，`STYLE.md:57`、`STYLE.md:126`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **IM Fell English**（约 44 px）；片名 / 刻字用 Cinzel 600（刻进石头里的罗马大写） |
| 字号（相对画面宽 / 高） | 44 px @1080 高 = **画面高 4.07% / 画面宽 2.29%**（`STYLE.md:47`）；派生通路 `fontSizeFactor: 0.04074` |
| 颜色 / 描边 / 阴影 | demo：米白绶带底（渐变 `#f3e6c6`→`#ecdcb6`→`#d9c497`）+ **深棕字** `#3a2412`（`subs.js:18`、`subs.js:26`）。**派生通路**取绶带底色 `#F3E6C6` 当字色压在画面深底上（对比度 11.4:1），`outlineFactor: 0`、`bold: false` |
| 位置 / 安全边距 | 底部横幅，中心约 **(960, 968)**，带宽 64；`marginLFactor: 0.06019`、`marginVFactor: 0.14537`、`align: 2` |
| 单行字数上限 / 最多行数 | **单行**；口播单句实测 **33–65 字符**（最短 `So the knight laid down his sword.` = 33，最长 `Then, in the red of evening, he saw what the dragon was guarding.` = 65） |
| 出现与消失方式 | **横幅从中心展开**（卷曲两端、轻微下垂、细边线）；文字只在展开到 **≥ 75%** 后才淡入；停留 ≥ `max(1.8s, 语音时长 + 0.6s)` 且不得撞上下一行（`STYLE.md:47`、`story.js:25`） |

- **★ 本风格独有的字幕链（与其它风格不同）**：`stained-glass` 的字幕**不走 `core/render/srt.py`**，而是由 demo 自带的 **`demo/subs_export.py` 直接产出** `styles/stained-glass/stained-glass.srt`（本次出片日志第 112-115 行：`字幕生成器（demo 自带）…/demo/subs_export.py` → `8 cues` → `字幕已由 subs_export.py 直接重新生成`）。编排器在**第 3 步（导出事件与字幕）**探测不到自己支持的生成器（它只认 `tools/subs.mjs` / `subs.mjs` / `tools/export.mjs` / `tools/subs.py` / `subs.py` / `tools/cues.py` / `cues_export.py`），会**告警「字幕源不重新生成，.srt 将沿用仓库里已提交的旧文件」**（日志第 29-30 行）；直到**第 6 步（混流）**才由 demo 自带的 `subs_export.py` 真正重新生成。所以本风格的字幕**只保证在混流阶段是新的**，事件阶段的那份是旧的——排查字幕问题时必须看第 6 步。 ★ 2026-10-06 更正：编排器第 3 步字幕告警措辞已改（第五十三批，md5 65ddab44→dfa99004）——其中『告警误导 / 两处不一致』部分已消解，其余仍成立
- **字幕与旁白的关系**：字幕是**旁白的横幅化呈现**。旁白是一位温柔、匀速的讲古人：第三人称、过去时为主（讲一个老故事），偶用现在时陈述规则。Kokoro `bf_alice`，speed 0.86–0.88，「像修女在讲一个老故事」（`DEMO.md:70`）。样本 8 行，最短 2.217s（L7）、最长 3.799s（L5）。
- **本风格特有的字幕禁忌**：① **不做逐字打字机**——文字是横幅展开后整体淡入；② 不能用现代口语 / 俚语（语域必须是讲古人的书面语）；③ 一句不能塞两个以上并列信息点；④ 不用第一人称抒情与内心独白（靠光、换脸块和裂缝承载情节）；⑤ **刻字（片名）与字幕是两套东西**——刻字在石头上、由扫光揭示，不进字幕带（`STYLE.md:48`、`lib/style-dna/stained-glass.md:59-63`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「a parchment banderole near the bottom (curled ends)」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#00F3E6C6`（AARRGGBB，落盘 ASS 为 `&H00C6E6F3`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。**底衬色与字色取自 demo 的真实实现**：该风格 `STYLE.md §4` 明确规定了底衬与字色的深浅取向（见上方原句），而此前配置正好相反；现已把 `palette.subtitle` 与 `subtitle.plateColor` 一起换成 demo 那一对。字色 `#3a2412` 与该底衬 `#00F3E6C6` 的 WCAG 对比度 **11.76**。

---

## 6. BGM / 音效特征

- **配乐**：中世纪 / 素歌气质，**D 多利亚**（升六级 B♮ 给色彩），**80 BPM**（有节拍的 cue）。乐器：`recorder`（竖笛）、`organ_soft` / `organ` / `organ_pedal`（管风琴三档）、`harp`（竖琴）、`hand_chimes`（手铃）、`tubular_bells`（管钟）、`timpani`（定音鼓）、`glass`（水杯音 = **「那道光」**）、`glockenspiel`（尘的反光，稀有）。**不要**通用钢琴或弦乐（`STYLE.md:80`、`DEMO.md:54`）。
- **调式族**：教会调式（多利亚、混合利底亚、爱奥利亚、利底亚）、空五度、持续音、平行奥尔加农。样本 7 段 cue：C1 Incipit（自由拍，竖笛素歌 over 管风琴踏板 D2）/ C2 Dawn（80 BPM，竖琴 Dm–G）/ T1 Light moves（水杯滑音）/ C3 Noon / C4 Battle（管风琴八分音符 ostinato Dm–C–B♭–C + 定音鼓）/ C5 Ember（60 BPM，暖柔管风琴 + 稀疏手铃）/ C6 Bell（一记管钟 D，极长混响）/ C7 Nocturne（竖笛再现，收在 D–A 空五度）（`DEMO.md:56-66`）。
- **拟音（foley，材料优先，全部可合成）**：敲击玻璃 = 非谐分音 **`~1 : 2.32 : 4.25 : 6.63 : 9.38`**；裂缝 = 爆裂 + 窗板闷响 + 26 记叮当雨；铅条 = 粘滑吱呀；玻璃在铅槽里滑动 = 砂质带噪 + 微弱尖叫；焊锡 = 嘶声 + 滴答；空气推动光；石厅环境；拱顶鸽子；铁冷却时的滴答（`mix.py:22-76`、`STYLE.md:83`）。
- **旁白处理**：石厅 IR 2.6s + 房间 IR 1.1s；拟音 **38% 湿**、人声 **12% 湿**；重击避开词首（`mix.py:13-19`）。
- **响度目标**：`−14 LUFS`；**真峰值上限**：`−1.2 dBTP`。成片实测 **I: −14.1 LUFS / LRA 5.9 LU**（出片日志第 118-119 行），**真峰值 −1.12 dBTP**（判据 = `loudnorm` 的 `input_tp`，4× 过采样；2026-10-03 离线复测）——**超 −1.2 dBTP 交付线 0.08 dB**，真峰值为负、**未削波**（详见第 11 节）。音乐在人声下 **duck ≈ −9 dB**（demo 实际 `1 − 0.72·env`，`mix.py:117-130`）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 −1.12 dBTP → **−1.83 dBTP**、已在 −1.2 dBTP 交付线内（达标）；原 −1.12 dBTP 记录保留为历史。
- **静音策略**：静默是**硬切**，连混响尾巴都切掉，只留玻璃自身的余音或铅条吱呀；一记长混响的钟可以把它收掉（`STYLE.md:84`）。样本两处：**31.8–33.8s** 所有 stem `max abs = 0.0`（`drone/melody/harp_chimes/battle/bell_glass` 全零，出片日志第 76 行），房间底噪压到 0.45 倍（`mix.py:107`）；**44.6–47.2s** 除钟以外所有 stem 归零（日志第 77 行）。

---

## 7. 素材偏好

- **需要什么素材**：① 一份**旁白行** `lines.json`（每条 `{id, text, voice, speed, asr?}`，`asr` 存 whisper 的预期转写以避开同音误判——样本「knight」被听成「night」，`DEMO.md:70`）；② 一份**时间线** `story.js`（`DUR/LINES/SUBS/light()/lancetI..IV/camera()/WELDS/emberLit()/EV/state()`）；③ 一套**透射色板** `glass.js` 的 `COL`；④ **太阳颜色 × 强度**表；⑤ **窗与场景**参数 `window.js` 的 `LX/LW/ROSE/APEX/BOT/FLOOR`；⑥ **事件数组** `EV`。
- **不需要什么素材**：**不需要任何实拍、照片或视频素材**。整片由 Canvas2D 矢量玻璃 + WebGL2 合成器生成。但**需要 CC0 音源库**（样本用 FreePats / VSCO 2 CE / VCSL）与 OFL 字体（IM Fell English、Cinzel）。
- **取景 / 质感 / 比例偏好**：切块用 **Catmull-Rom 平滑切口**（无深凹角）；**每一块都有质感**（clip 内 multiply：按块角度的条纹、色相漂移 ±10%、靠近铅条的更深老化边、厚度 ±9%）；着色器再加籽泡 / 划痕 / 厚度云，**<0.6× 缩放时小特征淡出**否则会闪烁；铅条只在**颜色相交处**出现（一色 = 一块）；背景是手工切的**菱形采石格**（抖动格 + 共享顶点 + 每格一个彩绘母题）；边框 = 彩色带配珠饰 + 白色嵌线配连续藤蔓；房间是暖灰琢石 + 更亮的窗侧斜壁 + 竖棂，地面是**大块不规则石板**，绝不与墙同一种错缝砌法（`STYLE.md:29-35`、`glass.js:21-25`、`glass.js:168-197`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：① 缺 WebGL2 → 这套风格的核心是**同一束光里的统一着色**，降级成纯 Canvas2D 会丢掉 bloom 与光柱，**不建议降级**，宁可换风格；② 缺管风琴 / 竖笛音源 → 可用任何持续音类合成音替代踏板，但**不能换成钢琴或弦乐**（会立刻变成另一部片子）；③ 缺 grisaille 笔刷 → 用最简「锥形描线 + 点状 wash」两件套，但**刮出高光（用该块自己的颜色刮一道细线）不能省**，那是透射光唯一允许的高光（`STYLE.md:31`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 样本 15 镜：最短 S9 = 0.0s（定格一击）、S4 = 1.6s；最长 S11 = 7.5s、S7 = 6.0s（`DEMO.md:30-46`） |
| 全片时长 | **56.5s**（样本片）。★ **文档未声明时长区间**；style-dna 记录 demo 原计划 45s，因 L6 挪到 38.3s 避让 L5 的阅读时间而涨到 56.5s（`DEMO.md:113`、`lib/style-dna/stained-glass.md:99`） |
| 镜头数 | **15 镜**（S1–S15），跨 4 格竖棂 + 1 扇玫瑰窗，左→右 = 一天 |
| 信息投放节拍 | 80 BPM：1 拍 = **0.75s**，1 小节 = **3.0s**；时刻按**实测语音长度**设定（`DEMO.md:28`） |

- **加速 / 减速点**：**减速**在 C1 Incipit（自由拍、只有竖笛与管风琴踏板）与 C5 Ember（60 BPM / 自由拍）；**加速**在 C4 Battle（管风琴八分音符 ostinato + 定音鼓，三次相击落在 24.75 / 26.25 / 27.75s，滚奏 30.0–31.8s）。全片唯一的「瞬间」是 31.8s 的一击 + 裂缝。
- **动画节奏（关键）**：**人物以 8 fps 分级步进**（`story.js:10-11`）；**光、镜头、光柱、尘在 ones（24 fps）上移动**——阶梯式的光会读成闪烁，所以光必须连续（`STYLE.md:52`）。人物用刚性纸片的 2D FK（`setTransform(base · T(part))`，自由绘制顺序）；长身体是分段纸片的脊链。**冻结规则**：一格里的角色用 `min(t, t_lightLeft)`，光离开即定格。
- **留白与静音的位置**：31.8–33.8s 全 stem 归零（只留裂缝自己的混响 + 铅条吱呀 + 玻璃摩擦）；44.6–47.2s 除钟以外全归零。开场 0–0.5s 是黑暗里的一层薄尘。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/stained-glass/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/stained-glass/demo --fps 24 --workers 3`（本次出片编排器实际用 `--workers 6 --size 1920x1080`） |
| 帧率 | 24 fps（人物层 8 fps 分级步进） |
| 分辨率 / 比例 | 原生 1920×1080（16:9）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，字面量在 `styles/stained-glass/demo/film.js:15`）。由 `main.js` 读视口 → `film.js` 的 `setFrame()`（`film.js:12`）重排：相机矩阵 / 透视投影的中心改 `(W/2,H/2)`（`scene.js:10`、`scene.js:18`，**zoom 不含 S**、世界不拉伸），字幕绶带按 `FX/FY/S`（`subs.js:13`）；16:9 时 `fx=fy=S=1` 逐字节退化成设计帧 |
| 混流 | `CRF=22 sh styles/stained-glass/demo/tools/mux.sh <video> <mix.wav> <out.mp4> 24 4`（响度 −14 LUFS / TP −1.2，**颗粒 4**） |
| 编码器 | `h264_nvenc`（本地 GPU；`LEMO_VENC=h264_nvenc`，mux.sh 走 `-preset p5 -profile high -rc vbr -cq 26 -b:v 0`） |
| 音频入口 | `python demo/music/score.py`（D 多利亚原创配乐）→ `python demo/mix.py`（玻璃 / 铅条拟音 + 混响 + duck） |
| 字幕入口 | **★ `python demo/subs_export.py`**（demo 自带，直接产出 `styles/stained-glass/stained-glass.srt`，8 cues）——**不走 `core/render/srt.py`** |
| 事件导出 | `node core/render/events.mjs styles/stained-glass/demo` → `events.json`（本次 62 条 / dur 56.5s） |
| 本风格专属参数 | 混流 `CRF=22` / `grain 4`；审片 `--q nosub=1`；模型页 `?test=sheet` / `?test=knight` / `?test=dragon`；风格帧 `?frame=...` |
| 一键复现 | `sh styles/stained-glass/demo/build.sh` |

完整 9 步链（`build.sh:6-17`）：① `core/tts/tts.py lines.json voices` → ② `core/tts/asr_check.py`（本次 mismatches: 0）→ ③ `core/render/events.mjs` → ④ `music/score.py` → ⑤ `mix.py` → ⑥ `subs_export.py` → ⑦ `core/render/video.mjs`（1356 帧）→ ⑧ `mux.sh` → ⑨ 两张 still（poster 8.2s = 标题揭示 / styleframe 40.6s）。

**本次出片实测耗时**：渲染 1356 帧 **98s**（6 workers，Windows GPU）；音频与渲染并行合计 **104.4s**；混流阶段总 **131.3s**（出片日志第 106-121 行）。

---

## 10. 编排规则

- **内容文件字段契约**（`content_fields`）：`lines.json` 每条 `{id, text, voice, speed, asr?}`（样本 8 行 `bf_alice` 0.86–0.88）；`story.js` 导出 `DUR/LINES/SUBS/light()/lancetI..IV/camera()/WELDS/emberLit()/EV/state()`；`glass.js` 的 `COL` 是透射色板；`window.js` 的 `LX/LW/ROSE/APEX/BOT/FLOOR` 定窗与场景；`story.js:28` 的 `DAWN/NOON/AFT/DUSK/VIOLET/MOON` 是太阳颜色 × 强度（`lib/style-dna/stained-glass.md:187-194`）。
- **事件词汇表**（`type` → 消费者，共 18 类）：`beam`（开场黎明细光）、`title`（标题扫光）、`tink`（敲玻璃）、`move`（光带移动呼啸）、`step`（角色步进）、`wings`（鸽翅 / 翼）、`clash`（剑盾相击）、`creak`（铅条吱呀）、`crack`（裂缝）、`grind`（玻璃在铅槽里磨）、`ignite`（余烬点燃）、`slide`（纸片沿铅条滑动）、`weld`（焊接火花）、`bell`（最后一焊的钟）、`dusk` / `dawnwink`（入夜 / 结尾那道晨光）、`voice{id}`（人声，mix.py 从 `voices/<id>.wav` 读）、`sub{t1,text}`（字幕条）、`endcard`（结尾卡）。全部由 `story.js:173-184` 的 `EV.push` 产生，`core/render/events.mjs` 序列化成 `events.json`。
- **时间线契约**：`story.js` 是**唯一时间真值**——导出 `DUR`、`LINES`、`SUBS`、`light(t)`（太阳位置 / 颜色 / 强度 / 光带宽度 / 斜切）、`lancetI..IV(t)`（每格内容）、`camera(t)`、`WELDS`、`emberLit(t)`、`EV`（按时间排序）、`state(t)`（合成一个完整帧状态，含 `cam/floorMode/floor/topCam/sweep/inscription/pts`）。`scene.js` 的 `renderScene(Lc, L, comp, st)` 把状态画成 **5 张画布**（G 玻璃 / S 表面 / R 光柱 / P 投影图 / O 覆盖层），交给 `comp.js` 的 WebGL2 合成器。页面契约（`main.js`）：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。
- **新增主体怎么接入**：用 `glass.js` 的 `Pass` 画——一个 `Pass(g, s, mode)` 把**同一份几何同时画进玻璃画布（透射色）与表面画布（铅、铁、石）**。切块：`smooth(pts, closed, k)`（Catmull-Rom，点带第三分量 1 = 硬角）或 `softPoly(pts, r)`。画一块玻璃：`pass.piece(path, color, {id, vary, body, edge, paint, mat, wash, shade, lead, erase})`（自动做保色变体、条纹 multiply、色相漂移、老化边、matting、点状 wash，`paint` 回调里用 `g.__col` 刮高光）。上铅条 `pass.lead(path, w)`、焊锡球 `pass.solder(x,y,r)`、石 / 铁 `pass.surf(path, fill)`。笔触 `brush(ctx, pts, w, {w0,w1})`；采石格 `voronoi(seeds, box)` + `seedsIn(box, n, rnd)`。刚性骨架参考 `knight.js`（`POSE/lerpPose/fk`）与 `dragon.js`（`DPOSE/lerpD/spine`，脊链分背 / 腹带）。
- **换主题时要改哪些文件**：① `demo/lines.json`（重写旁白 + `asr` 预期转写）；② `demo/voices/`（重新 TTS 声线）；③ `demo/story.js` 的 `light()`（重排光序）、`lancetI..IV(t)`（每格内容）、`camera()`、`WELDS`（重新上铅条的拍点）、`EV`；④ `demo/window.js` 的 `LX/LW/ROSE/APEX/BOT/FLOOR`（换窗的形制：玫瑰窗 / 圆章 / 高侧窗）；⑤ `demo/glass.js` 的 `COL`（换主导色——**两种色承载画面**）；⑥ `demo/knight.js` / `demo/dragon.js`（换题材的刚性骨架）；⑦ `demo/music/score.py` 的调式与乐器。**不用改**：`comp.js` 的着色器与色调映射、`glass.js` 的切块 / 质感 / 铅条 / grisaille 算法、`scene.js` 的地面投影与光柱、`subs.js` 的横幅。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里是**派生条目**（`derived: true`，`derivedFrom: palette@lib/dub-visual.json / subtitle-px@STYLE.md §4 / contrast-rule(WCAG)`）。生效参数：`palette`（bg `#1d3a9c`〔★ 2026-10-06 由 `#2a2a2e` 修正，见第 3 / 11 节〕、bg2 `#142a70`、fg `#F3E6C6`、accent `#dc9a22`、subtitle `#F3E6C6`、subtitleBack `#E6F3E7C6`）、`bgRecipe`（gradient + `texture: none` + vignette 0.35）、`subtitle`（SimSun、`fontSizeFactor 0.04074`、`marginVFactor 0.14537`、`marginLFactor 0.06019`、`outlineFactor 0`、`align 2`）、`title.fontSizeFactor 0.09`、`overlay.chapterCards: true`、`motion.subtitleFadeIn 0.14` / `chapterTransition: "cut"`。**★ 注意这条 notes 里记录的一次关键更正**：字幕配色曾误按 light-strip（深条 + 浅字）派生，后改判为 **light-card（浅卡 + 深墨字）**——因为 STYLE.md §4 写的是「羊皮纸带 + 深墨字」。但 **ASS 的 Sub 样式是 `BorderStyle=1`（只有描边 + 阴影、没有底带）**，字幕直接压在画面底色上，所以**不能照搬 demo 的深棕字**（深棕 `#3a2412` 压画面深底 `#2a2a2e` 只有 1.5:1，会看不见）；派生条目取**绶带底色 `#f3e6c6` 当字色**，对比度 11.4:1（`lib/dub-styles.json#stained-glass.notes`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **9:16 曾不可用（★ 2026-10-04 已修）**：原记「本风格无 `aspects` 声明，按 1920×1080 绝对像素构图；9:16 导出丢右侧 43.75%、下方整片黑，切掉的正好是 III / IV 两格与玫瑰右半，石带片名刻字与底部字幕横幅被下方黑边吞掉，属架构级缺陷」。**2026-10-04** 已改造 `styles/stained-glass/demo/`：新建 `film.js` 导出 `NATIVE`/`setFrame(W,H)`（派生 `W/H/FX/FY/S`）并声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:12-15`）；`main.js` 读视口尺寸并让画布跟视口（`main.js:8-14`）；`scene.js` 的 `camMatrix()`（`scene.js:10`）与 `proj3()`（`scene.js:18`）把中心改 `(W/2,H/2)`（**相机 zoom 不含 S**，世界按原比例居中）；字幕绶带按 `FX/FY/S` 重排（`subs.js:13`）。**16:9 逐字节未变**（8.475 / 28.25 / 48.025 三帧 md5 与改造前相同）；9:16 实测**不裁切、无黑边**，整扇窗完整入画，与「16:9 中心裁切」的 SSIM = 0.675 / 0.712 / 0.533（明显 < 1 ⇒ 真重排）。详见第 2 节。
- **★ 成片真峰值 −1.12 dBTP，超 −1.2 dBTP 交付线 0.08 dB（本次新补记）**：判据用 `loudnorm` 的 `input_tp`（4× 过采样，2026-10-03 离线复测），**不是** `astats` 的采样峰值、也不是 `ebur128` 的 `Peak`（只 1 位小数）。真峰值为**负**（−1.12）⇒ **未削波**，属「仅超线」而非「削波」。**根因在下游 AAC 编码余量**：本风格走自带补丁副本 `demo/tools/mux.sh`，其 loudnorm 目标写死 `TP=-1.2`（`demo/tools/mux.sh:6,8`）、**未采用 core 版的 `LN_TP=-1.7`**（留 0.5 dB 编码余量），AAC 编码的过冲把成片真峰值顶到 −1.12。属**项目级既有缺陷，非本风格音频链所致**（本片 `mix.wav` 链本身合规）。此前 §6 只写了上限 −1.2、未记实测值，本次补记。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 −1.12 dBTP → **−1.83 dBTP**，已在 −1.2 dBTP 交付线内；音频评分回补 +1（见第 10 节）。
- **★ 字幕链在两处不一致**：编排器第 3 步（导出事件与字幕）**探测不到本 demo 的字幕生成器**，会告警「字幕源不重新生成，.srt 将沿用仓库里已提交的旧文件」（日志第 29-30 行）；真正重新生成发生在**第 6 步（混流）**，由 demo 自带的 `demo/subs_export.py` 完成（日志第 112-115 行）。后果：如果只看第 3 步的产物，字幕是**旧文件**；排查字幕必须看第 6 步。这是本风格**独有的字幕链**，与其它走 `core/render/srt.py` 的风格不同。 ★ 2026-10-06 已修：编排器第 3 步字幕告警措辞已改（第五十三批，md5 65ddab44→dfa99004）——『告警误导 / 两处不一致』部分已消解
- **派生通路字体与 demo 不符**：`lib/dub-styles.json#stained-glass.subtitle.fontFamily` 是 **SimSun**（中文文案用），demo 用的是 **IM Fell English**（英文）。字幕几何（`fontSizeFactor 0.04074` / `marginVFactor 0.14537`）一致，但字体气质差异明显。
- **~~派生通路的底色是深灰 `#2a2a2e`、而 demo 画面主色是钴蓝 `#1d3a9c`~~ ★ 2026-10-06 已修**：原 `palette.bg = #2a2a2e`（及 `bgRecipe.stops[0]`）取自 `styles/stained-glass/demo/test.js:9` 的 `S.fillStyle = '#2a2a2e'` —— 那是 `knightTest` / `dragonTest` **模型页（lightbox 测试页）**的灰底，**不是成片的背景**（全库扫描：`#2a2a2e` 仅在 `test.js` 1 处命中）。成片的画面主色是**钴蓝**：`glass.js:7` `COL.cobalt = '#1d3a9c'`、`window.js:45` 采石格（quarries）默认用 `COL.cobalt`（`STYLE.md:33`「Backgrounds: hand-cut lozenge quarries」、`STYLE.md:39`「cobalt ground」、`DEMO.md:74`「cobalt `#1d3a9c` (dominant)」、本文件 §3「底（钴蓝，主导）」）。已把 `palette.bg` 与 `bgRecipe.stops[0]` 由 `#2a2a2e` 改为 `#1d3a9c`（`bg2 #142a70` 不变——它本来就是 §3 记录的「暗部玻璃 / 夜间窗格」深蓝）；`lib/dub-visual.json#stained-glass.palette.bg` 同步修正。底色仍是**暗底**（相对亮度 **0.057** ≤ 0.5）⇒ 由 WCAG 规则推得的 `fg` / `subtitle` 取向**不变**（仍亮字），无需连带改动。**渲帧实测**（同一条 dub 背景管线，270×480，vignette 0.35）：改前 4×4 主色 `#000000 #000105 #000204 #000000 / #001142 #0c1e4f #0d204d #00123f / …`（中性深灰蓝），改后 `#000011 #000418 #000419 #000012 / #001142 #0d1f50 #0d1f50 #011243 / …`（**饱和钴蓝**，顶行由纯黑转出蓝相）；整帧观感由「深灰蓝」变为「彩色玻璃钴蓝」。palette 18→19、matchScore 95→96。
- **派生条目是近似值**：`notes` 明说「配色来自 lib/dub-visual.json 的 palette（demo 代码抽取）；字幕字号 / 位置取自 STYLE.md §4 的 px 值（÷1080 归一）；字幕颜色由 WCAG 对比度规则从底色推得」。知识库更新时应**优先用代码抽取值替换本条的派生值**。
- **派生条目 `overlay.chapterCards: true` 与 demo 实际不符**：demo 没有独立章节卡层——它的「章节」就是四格竖棂本身，故事直接画进玻璃里。打开章节卡会多出一层与风格无关的叠加。
- **成片响度 I: −14.1 LUFS**，相对 −14 目标偏高 0.1 LU；LRA 5.9 LU（在容差内，仅记录）。**真峰值 −1.83 dBTP，在 −1.2 交付线内（★ 原记·首版 −1.12 dBTP 曾超线 0.08 dB，该缺陷已修，见上上条）。**
- **细纹理 `textureRaw: glass` 声明了但渲染未实现**：`lib/dub-styles.json#stained-glass.bgRecipe.textureRaw` 是 `glass`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `none` ⇒ 落空（该风格粗粒度没有纹理层）），**不读** `textureRaw` ⇒ `glass` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `glass` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口
- **没有 CC0 音源库就无法复现配乐**：`score.py` 依赖 FreePats / VSCO 2 CE / VCSL 三个采样库（`DEMO.md:54`、出片日志第 79 行）。缺库时配乐会整体缺失或退化。
- **字体是 OFL 但需自带**：IM Fell English（字幕横幅）与 Cinzel 600（刻字）必须随 demo 复制；缺字体则横幅与刻字退化。
- **题材骨架只有两套**：`knight.js`（玻璃骑士 + 可换脸块 stern / astonished）与 `dragon.js`（翼龙脊链 + 折叠 / 展开翼 + 余烬）。换题材必须新写刚性骨架。
- **没有现成的玫瑰窗 / 高侧窗 / 圆章变体**：`window.js` 里只有样本这一套「四格竖棂 + 玫瑰」，STYLE.md §11 列出的另外三种形制要自己搭。

### 能力限制
- 原生 16:9，**已适配 9:16**（见第 2 节）；必须 **WebGL2**（`comp.js` 的着色器、bloom、暗角、抖动都在这条管线里），无 WebGL2 的环境跑不起来；渲染成本高——本机 1356 帧用了 **98s**（6 workers），比同长度的 Canvas2D 风格慢很多。
- **「光即时间」要求受光顺序与时间线严格同源**：`light(t)` 同时驱动太阳位置、颜色、强度、光带宽度与斜切，也驱动「哪一格是活的」。若外部替换 BGM 或改动剪辑点，受光顺序会与音乐错位，风格核心因果断裂。
- 人物只能 8 fps 分级步进（这是风格要求，不是性能妥协），做不了流畅动作戏。
- 题材必须世俗：不能出现十字架、圣徒、光环（`STYLE.md:12`）。

### 踩过的坑（本机实测）
- **折叠翼用展开翼骨架拼会读成一堆棍子** → 必须做**专用的折叠轮廓**（指节朝上、褶片向后扫），并把远侧翼藏起来（`DEMO.md:110`）。
- **转折点的揭示在 v1 里读不出来**：骑士填满画面、龙被竖棂边缘切掉 → 在最终推近时**重新调度**：两个形象都缩小、余烬移到画面中心（≥ 画面宽 1/8 并带光晕）、骑士在左三分之一看着它、龙完整留在格里，然后拉远（`DEMO.md:111`、`DEMO.md:50`）。
- **夜里的刻字结尾卡在广角下读不出来** → 推近 + **把扫光停在字上**（`STYLE.md:105`、`DEMO.md:112`）。
- **时长从计划的 45s 涨到 56.5s**：L6 挪到 38.3s 以免与 L5 的阅读时间相撞，结尾卡加了推近以保可读（`DEMO.md:113`）。
- **隐藏的铅条会从前景块透出来** → 描每块的铅条前先**擦掉该块下面的表面**（`STYLE.md:99`）。
- **色调映射用逐通道 `1-exp(-x)` 会把钴蓝洗成粉彩** → 主体用亮度守恒式 `h·(1-exp(-l))/l`，只在最亮处混到逐通道式，这样太阳盘烧成白色而蓝色仍是宝石蓝（`comp.js:106-112`、`STYLE.md:100`）。
- **锐利的地面光斑看起来像贴纸** → 模糊、去饱和约 20%、被石面调制、加光晕；**光柱在窗口处全强度会把窗格洗白**，必须窗口处近 0、向下约 40% 处最强（`STYLE.md:102`）。
- **俯拍投影是镜像翻转的** → 把墙放在画幅**底部**，人物才会站正（`STYLE.md:103`）。
- **色斑图画布尺寸与代码不一致会画到纹理角落** → 用一个常量尺寸（`STYLE.md:104`）。
- **★ `demo/tools/mux.sh` 原先硬写 `libx264`**（CPU 编码，违反「合成渲染走本地 GPU」硬规则），且**缺「音频比画面短时补静音」**——音频短于画面时 `-shortest` 会切掉末帧，编排器判 `MUX_FAIL 帧数不符`。2026-10-03 已把 `core/render/mux.sh` 里这两处**最小外科回灌**到本副本（脚本 `D:/lemo-tools/scripts/patch-style-mux.mjs`）：① 音频短于画面时 `apad=whole_dur=画面长度+一帧`；② 编码器跟随 `LEMO_VENC`。回灌后本副本第 10-24 行可见注释与 `case "${LEMO_VENC:-}"`。**本次出片未触发补静音分支**——`mix.wav` 与画面同为 56.5s（音频 `2712000` 采样 / 48000 Hz = 56.5s，画面 1356/24 = 56.5s），所以 `MUX_OK 32354231 src_frames=1356 out_frames=1356` 帧数一致；编码器分支已生效（日志第 7 行 `编码 nvenc`、第 111 行 `混流（WSL mux.sh · nvenc）`）。

### 下次迭代优先补什么
1. ~~给本风格补一个 `aspects` 声明或一套 9:16 重排版式（四格竖棂改上下四层堆叠），否则产品默认导出路径永远不可用。~~ **★ 2026-10-04 已完成**：已补 `FILM_META.aspects = ['16:9','9:16']` 并由 `setFrame()` 重排相机与字幕（见第 2 节）；四格竖棂的上下堆叠变体仍可另做（可让 9:16 更密）。
2. **把 `demo/subs_export.py` 接进编排器第 3 步的字幕生成器探测名单**（或补一个 `tools/subs.mjs` 薄壳），消除「第 3 步告警 + 第 6 步才生成」的不一致。
3. 把 `lib/dub-styles.json#stained-glass` 从派生值改为代码直抽（尤其 `fontFamily`、`overlay.chapterCards`）。
4. 补玫瑰窗 / 高侧窗 / 圆章三种窗形变体与第三人骨架。
5. 把 CC0 采样库（FreePats / VSCO 2 CE / VCSL）纳入风格自带资产清单，避免换机复现时配乐缺失。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/stained-glass/stained-glass.mp4`（56.50s / 30.9MB，32346602 字节） |
| 抽帧 | `D:/lemo-tools/_distill/frames/stained-glass/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **96/100**（2026-10-06 校正：原 95，dub 通路底色冲突已修 —— `palette.bg` `#2a2a2e`→`#1d3a9c`〔原值取自 `test.js:9` 模型页灰底〕，palette 18→19）（2026-10-05 校正：原 96，新增「textureRaw 细纹理未实现」缺陷，palette −1）（2026-10-05 校正：原 95，9:16 画幅缺陷已修并回补 composition +1）（2026-10-03 校正：原 94，音频真峰值缺陷已修，audio +1） |
| 详细资料 | **有**：`STYLE.md`、`DEMO.md`、`demo/build.sh`、`demo/tools/mux.sh`、`style.json`、`lib/style-dna/stained-glass.md`、`lib/dub-styles.json#stained-glass`、`_distill/logs/stained-glass.log` |

**逐帧拆解要点**：
- **f01（~2.3s）**：第 I 格被**刀锋般的黎明细光**从顶到底点亮（`bandW` 18 → 310），钴蓝采石格 + 红边框 + 金珠饰，骑士披红披风持盾站在城垛上，盾上有一个太阳纹章；上方小圆章里有「吞日之龙」的民俗误解图案（红龙 + 金太阳）。底部已出现**米白绶带横幅**字幕（卷曲两端、轻微下垂）。右侧两格仍是暗的。→ 印证「只有被照到的窗格才是活的」。
- **f03（~7.0s）**：**拉远到整扇窗**——四格竖棂 + 上方玫瑰窗全部可见，但只有第 I 格被点亮、其余三格暗蓝；地面上一块**蓝色光斑**（模糊、去饱和、被石面调制）。画面右侧有一条斜的光柱。→ 这就是「一帧教会规则」的那一镜（DEMO.md S2）。
- **f04（~9.4s）**：整屏几乎全黑，只有第 I 格的一小块被照亮、玫瑰窗轮廓勉强可辨，地面光斑更小。**石墙与黑暗占了画面 80% 以上**。
- **f06（~14.1s）**：推近第 I 格，骑士举剑；字幕「At dawn, a knight was sent to slay the dragon that ate the sun.」占满底部横幅。**单行、33–65 字符**的规格在这里可见。
- **f09（~21.2s）**：**正午**——底色由暗蓝转**白亮蓝**（采石格变亮），骑士在绿色草地上行进，背景有山丘与树。字幕「He crossed the hills and rivers in the white noon light.」。
- **f12（~28.3s）**：**地面战斗**——画面主体是石板上一条**斜长彩色光斑**（骑士与龙在光斑里交战），模糊、去饱和、带光晕；**镜头已离开玻璃**（DEMO.md S7「the subject is light」）。字幕「All afternoon they fought, and the shadows grew longer.」。
- **f15（~35.4s）**：回到窗上，**红光落在第 IV 格**（深橙黄昏），骑士举剑、龙蜷曲，红边框配金珠饰；地面有暖色光斑。字幕「Then, in the red of evening, he saw what the dragon was guarding.」。
- **f18（~42.5s）**：**裂缝已出现**——第 IV 格上有多条白色锯齿裂纹穿过采石格；骑士已放下剑、龙完整（绿鳞、红翼），胸口一个**琥珀色余烬**发光。边框是红底金珠。字幕「The last ember of the sun, kept warm until morning.」。
- **f20（~47.2s）**：**重新上铅条**——骑士跪姿、剑平放在地，龙在旁，裂纹变成**修补的铅条**（新的铅线留在画面里当疤痕）。字幕「So the knight laid down his sword.」。
- **f22（~51.9s）**：**夜**——四格全部转**灰蓝**，只有第 IV 格从**内部暖亮**（余烬的光）；玫瑰窗在上方暗着。字幕「And every night since, one pane of glass keeps its own light.」。
- **f24（~56.5s）**：**结尾卡**——四格竖棂在暗处，石带（string course）上刻着 `STAINED GLASS`（Cinzel 刻字 + 金），扫光停在字上；地面有彩色光斑的余韵。→ 印证「刻字必须推近 + 停光」。
- **色走**：暗蓝白黎明 → 白亮正午 → 金下午 → 深橙红黄昏 → 紫 / 月光夜（只有一格暖亮）。**光的颜色就是时钟**，这是全片唯一的时间指示器。
- **不动的段落**：31.8–33.8s（一击后完全静止，只有尘埃在红光里落）；44.6–47.2s（只有一记钟）；开场 0–0.5s（黑暗 + 薄尘）。
- **字幕节拍**：8 条字幕全部底部**绶带横幅**、单行，每条约 2.2–3.8s 停留；**没有任何一条撞上下一行**。
- **瑕疵帧**：抽帧 24 张**未见**糊、闪、错位、字幕溢出或黑边。玻璃质感（条纹、籽泡、厚度云）在静帧上清晰可见；地面光斑的模糊与去饱和处理正确，不读成贴纸。

**自检发现的缺陷**：本次**新补记 1 条硬缺陷**——成片真峰值 **−1.12 dBTP**（`loudnorm` 的 `input_tp`，4× 过采样），超 −1.2 dBTP 交付线 **0.08 dB**；真峰值为负 ⇒ **未削波**，根因在下游 AAC 编码余量（本风格副本 `demo/tools/mux.sh` 的 loudnorm 目标写死 `TP=-1.2`，未采用 core 版 `LN_TP=-1.7`），属**项目级既有缺陷、非本风格链所致**。扣 6 分的原因见下：`palette` −1（派生通路的底 `#2a2a2e` 是「深灰」而 demo 的画面主色是钴蓝 `#1d3a9c`，两者只在 bg2 上对上；★ **2026-10-06 已修**：`palette.bg` 与 `bgRecipe.stops[0]` 由 `#2a2a2e` 改为钴蓝 `#1d3a9c`，palette 18→19、matchScore 95→96）、`typography` −1（派生通路 `fontFamily: SimSun` 与 demo 的 IM Fell English 不同）、`composition` −0（9:16 不可用是架构缺陷；★ 2026-10-04 已修、**2026-10-05 已回补 composition +1**）、`audio` −3（**真峰值超线 −1**：按 `D:/lemo-tools/_distill/AGENT-BRIEF.md`「真峰值超标怎么扣」——真峰值为负但超线取 **−2** 档，根因在下游 AAC 编码余量故**减半 = −1**；另 −2 为既有的「响度偏高 0.1 LU + 配乐依赖外部 CC0 采样库」）、`rhythm` −0（56.5s 与 `story.js:8` 的 `DUR = 56.5` 完全一致，15 镜与 DEMO.md 逐镜表逐条对上；但因文档**未声明时长区间**，无法做区间符合性判断，这一点已在第 8 节如实写明）。**当前 96/100**，受限于派生通路参数的偏差与项目级 AAC 编码余量不足（9:16 架构缺陷已于 2026-10-04 修、2026-10-05 回补分数）。 ★ 2026-10-03：成片真峰值已修（−1.12 dBTP → −1.83 dBTP，音频重混），见第 11 节。

**本次为补齐短板做了什么**：把 `core/render/mux.sh` 的两处修正（① 音频短于画面时 `apad=whole_dur=画面+一帧`；② 编码器跟随 `LEMO_VENC`，默认 `h264_nvenc`）**最小外科回灌**到 `styles/stained-glass/demo/tools/mux.sh` 副本（脚本 `D:/lemo-tools/scripts/patch-style-mux.mjs`）。改动极小、可回滚（只动第 10-24 行），且不触碰 `lemo-make.mjs` 与 `D:/lemo-opuscar` 下的其他源码。本次出片**未触发**补静音分支（音画同为 56.5s），但编码器分支已生效——日志第 7 行 `编码 nvenc`、第 111 行 `混流（WSL mux.sh · nvenc）`。**字幕链未做改动**：`subs_export.py` 是 demo 自带的原始设计，本次只如实记录「第 3 步告警 / 第 6 步生成」这一独有现象，未越权修改。
