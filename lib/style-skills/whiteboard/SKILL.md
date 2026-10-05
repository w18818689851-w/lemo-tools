---
name: lemo-style-whiteboard
description: 【lemo 风格 Skill · 白板讲解】做科普解释、在线课程、方法论讲解（60–120s）时用；交付「一整块光面白板上，干擦马克笔当场一笔笔把课写出来、悬浮笔没有手、镜头在板面上旅行而不切镜」的清楚、有条理、现场感。选定本风格做视频时，优先读本文件。
slug: whiteboard
name_zh: 白板讲解
category: 手绘与绘画
film: Einstein in Your Pocket
---

# 白板讲解（`whiteboard`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/whiteboard/STYLE.md` · `styles/whiteboard/DEMO.md` · `styles/whiteboard/demo/build.sh` ·
> `lib/style-dna/whiteboard.json` · `lib/style-dna/whiteboard.md` · `lib/dub-styles.json#whiteboard` ·
> `styles/whiteboard/style.json` · demo 源码（`film.js` / `engine/wb.js` / `mix.py` / `music.py`） · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一堂在**一整块光滑白板**上现场画出来的课。所有信息都用干擦马克笔**一笔一笔写出来**（不是动画字块），笔自己悬空移动、**没有手**，磁贴可以滑动/抬起/下沉，板擦可以把一条轨迹**倒着擦回去**，镜头在板面上旅行而不是切镜（`STYLE.md:3-4`、`style-dna/whiteboard.md:11`）。三条不可让步的硬规则：① **板即世界**——任何画面元素都必须能被解释成「白板 + 干擦马克笔 + 悬空道具」的某个环节；② **板是地图**——每个想法各占一个区域，板面上的距离 = 论证里的距离，镜头通常由笔带着走；③ **真马克笔**——墨在落笔处积色、有干擦斑点与短划、笔画会出界且不完全闭合、旧课残影还在、一道比板慢的斜向窗影反光；**每一笔都有声**（`STYLE.md:8-13`、`STYLE.md:12`）。

**不是什么**（最容易做错的邻居风格）：不是蓝图（没有蓝纸、没有制图规范，`blueprint`）、不是蜡笔绘本（没有蜡质感、不是童话，`crayon-book`）、不是动效字幕解释片（文字必须一笔笔写出来，绝不做成动画字块）（`STYLE.md:15`、`style-dna/whiteboard.md:13`）。

**什么时候用它**：科普 / 「X 是怎么工作的」解释片、在线课程、方法论讲解（`style.json:11-15` 的 `uses` 是 Explainers / Online courses / Science）。样片《Einstein in Your Pocket》讲「你的手机怎么知道你在哪：GPS、原子钟，和相对论每天多出的 38 微秒」（`style.json:9-10`）。

**一句话内核**：一块 8000×4500 世界单位的暖白板就是整个世界；每个想法在板上各占一个区域，笔画出线、镜头骑着线去下一个区域，直到最后一记拉远越过板框、看见整堂课作为一张图挂在墙上。

**边界**：它**撑不起**——需要真实质感/实拍/人物出镜的内容；纯情绪、无因果链的抒情片；以及「一句话塞多个并列信息点」的密集片（一条线只承担一个想法，`style-dna/whiteboard.md:51`）。它是**中速**的：`STYLE.md:6` 定位 **60–120s**，样片 111.0s（`style.json:17`）。

---

## 2. 画面构图

- **镜头数与画幅**：原生 **16:9 / 1920×1080**；底层是一块 **8000×4500 世界单位**的暖白渐变板面，2D 相机在板面上移动（位置、缩放按 **1/z** 插值让推镜像 dolly，带一点 roll）（`style-dna/whiteboard.md:24`、`STYLE.md:52`）。**板面上从不切镜**：要换区域就是一记**甩镜（whip）**。
- **主体位置与占比**：每个想法占板上一个独立区域（样片的布局常量有手机/屏幕/PIN/SAT/EQ/CLK/RUL/TRAIL/SEA，`style-dna/whiteboard.md:254`）。标题在板上 120–200px 字高，标签 30–70px（`STYLE.md:35`）。
- **负空间 / 留白**：板本身就是留白；区域之间靠空白分隔，镜头一次只装 1–2 个区域（分屏时拉到同时装得下两者，`STYLE.md:61`）。
- **图层叠放顺序**（从底到顶）：暖白渐变板面（`#fbfbf9 → #eeede9`）→ 极淡擦痕/细划痕平铺纹理（1024px tile，alpha ≤0.03）→ 几十条 5–10% 旧课残影（灰 `#9aa0a8` / 淡蓝 `#8aa0c8`，demo 46 条）→ **墨层（alpha 0.94，multiply 叠加，重叠处变深）**→ 干擦斑点/短划纹理（`destination-out` 从墨层减掉）→ 斜向窗影反光（白 10–16%，以约 0.35× 镜头速度漂移）→ 悬空道具（马克笔/板擦/磁贴）→ 屏幕层字幕（`style-dna/whiteboard.md:24-31`、`DEMO.md:61-67`）。
- **安全区**：**底部约 12% 的画面永远留给字幕**，每个镜头都要留（`STYLE.md:37`、`DEMO.md:39`）。标签在任何一个镜头里必须**全在或全不在**，推镜不能把标签切一半（`style-dna/whiteboard.md:154`）。
- **本风格不能出现的构图**：任何**画出来的手、手臂或光标**（`STYLE.md:13`）；在板面上切镜；镜头无来由地运动；需要阅读（方程/定义/清单）时镜头还在动（`style-dna/whiteboard.md:94-98`）。

**在 9:16（产品默认）下的表现**：本风格**已适配 9:16**——`FILM_META.aspects = ['16:9','9:16']`（`film.js:13`），`renderFilm` 从 `opts.W/opts.H` 经 `setFrame()`（`engine/wb.js:14`）派生 `FX/FY/S = min(fx,fy)`：板面上的世界内容仍由 2D 相机取景，相机经 `applyCam` 把**设计帧（1920×1080）等比装入**当前帧（`dXf`，`engine/wb.js:17,322`；中心对齐、紧轴缩放 S），屏幕空间家什（墙/墨层/反光/字幕/笔/磁贴/板擦）走同一套换算——墨层按实际帧建 `OffscreenCanvas(W,H)` 与清屏（`engine/wb.js:354,377`）、反光带 `±700*S`（`engine/wb.js:413`）、马克笔 `c.z*S`、板擦 `c.z*S`、磁贴 `c.z*S`（`engine/wb.js:440,474,488`）、字幕 `44*W.S / 1038*W.FY`（`film.js:370,379`）；`main.js` 读视口后 `setFrame(VW,VH)`（`main.js:9-10`）。1080×1920 实测（`S = 0.5625`）：**不裁切**，时钟/标尺/两支笔/方程都完整落在画面里，两侧是板面与墙的留白；代价是整块板面缩到 0.5625×，横向的区域布局被压成**竖向中段的一条横带**、上下各留大片板面空白，字幕按设计帧位置落在中段偏下（不溢出、不压被讨论的元素）。信息完整度与 16:9 一致，只是**版面更空、密度更低**。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 板（亮） | `#fbfbf9` | 板面渐变亮端 | `DEMO.md:61`、`style-dna/whiteboard.md:24` |
| 板（暗） | `#eeede9` | 板面渐变暗端 | `DEMO.md:61` |
| 残影·灰 | `#9aa0a8` | 5–10% 旧课残影 | `DEMO.md:61` |
| 残影·淡蓝 | `#8aa0c8` | 5–10% 旧课残影 | `DEMO.md:61` |
| 墨·黑 | `#23262c` | 事物与结构 | `STYLE.md:31`、`DEMO.md:62` |
| 墨·蓝 | `#2a5cb3` | 信号 / 光 / 测量 | `STYLE.md:31`、`DEMO.md:62` |
| 墨·橙 | `#d97757` | 你 / 时间 / 关键之物（每区一个强调色） | `STYLE.md:31`、`DEMO.md:62` |
| 字幕墨 | `#141414` | 字幕文字（通路派生，深字配米白标签） | `dub-styles.json#whiteboard` |
| 字幕底 | `#E6F5F2EC` | 米白圆角标签（约 90% 不透明） | `dub-styles.json#whiteboard`、`STYLE.md:37` |
| 道具·铝框/墙 | 墙 `#d8d3ca` | 只在最后一个大全景出现 | `DEMO.md:67` |

- **明度 / 对比规则**：墨 alpha **0.94**，用 **multiply** 合成，重叠处像真马克笔一样变深（`STYLE.md:20`、`DEMO.md:62`）。板是暖白高亮底，墨是低亮深色，字幕用米白标签 + 深字（light-card 形态，**不是深底衬**，`dub-styles.json#whiteboard.notes`）。
- **禁止出现的颜色**：板面与残影保持中性；**强调色（橙）不出现在道具上**，除了它自己的马克笔色环与那枚主角磁贴（`STYLE.md:30`）。通路 `subtitleOutline` 全透明（`#00000000`），即字幕**不加描边**。
- **同一画面最多几个色相**：**至多三种记号笔色**，每种语义全片固定（黑=结构、蓝=信号/测量、橙=关键之物，每区只允许一个强调色）。**单色变体**：全部用黑墨，只留一个元素用橙（`STYLE.md:28-30`）。

---

## 4. 转场规则

- **镜头之间怎么切**：**没有硬切**。转场要么是「笔画的线即转场」（镜头骑着笔刚画出的那条线——轨道、信号线、轨迹——去下一个想法），要么是一记**甩镜（camera whip）**（`STYLE.md:66`、`style-dna/whiteboard.md:52-55`）。样片里甩镜的落点是 46.45s（管钟第一声把镜头甩到轨道钟），全板拉远在 101.5s（`style-dna/whiteboard.md:265`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有溶解、没有划像、没有闪白**。允许的动作是：笔飞入/飞出画框、板擦沿路径恒速擦除（留 10% 残影）、甩镜的运动模糊（`STYLE.md:64-66`）。
- **硬切点怎么定**：样片音乐挂在 **120 BPM** 网格（1 拍 = 0.5s），第一小节**强拍 = 标题**（`T0=10.0`）；画面事件跟着这条网格与旁白走（`film.js:7`、`style-dna/whiteboard.md:250`）。
- **转场时长与缓动**：相机运动 **>14px/帧** 时做 180° 运动模糊——渲染 **≤12 个子帧、子帧间隔 ≤4px** 后平均（子帧太少会让文字频闪，`STYLE.md:66`、`DEMO.md:38`）。跳笔抬起量 = 距离比例、上限为窗口的 **35%**；间隔 **>0.75s** 的笔飞到框外停车、并在下一笔前 **0.42s** 飞回（`DEMO.md:46`、`engine/wb.js:270-292`）。
- **绝对不要的转场**：在板面上切镜（要切只允许甩镜）；任何元素淡入/滑入（文字只能被写出来）；无来由的运镜（`style-dna/whiteboard.md:94-98`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | 板上文字用**单线（单笔画）手写体 EMS Tech**（OFL，Architects Daughter 的单笔画版）；烧入字幕用类手写体 Architects Daughter（`STYLE.md:35,37`、`DEMO.md:66`）。通路侧字体回退为 **KaiTi**（本机无该 OFL 字体，`dub-styles.json#whiteboard.subtitle`） |
| 字号（相对画面宽 / 高） | 板上标题 200/120px 字高，标签 30–70px；烧入字幕 **44px**（`DEMO.md:66`）。通路派生 `fontSizeFactor 0.04074`（≈44px/1080）、标题 `fontSizeFactor 0.11`（`dub-styles.json#whiteboard`） |
| 颜色 / 描边 / 阴影 | **米白圆角标签（约 90%）+ 深墨字**，左下角一条**短的强调色（橙）马克笔划**；无描边（`STYLE.md:37`、`dub-styles.json#whiteboard`） |
| 位置 / 安全边距 | 底部居中；通路 `marginVFactor 0.14537`（≈157px）、`marginLFactor 0.06019`（≈116px）、`align 2`；**每个镜头底部约 12% 必须留空**（`STYLE.md:37`、`DEMO.md:39`） |
| 单行字数上限 / 最多行数 | **每行 ≤44 字符**；短子句（<24 字符）与相邻子句合并，两行上限 90 字符；宽度 >1250px 时平衡成两行（`STYLE.md:37`、`style-dna/whiteboard.md:41`） |
| 出现与消失方式 | 在**子句处**拆分；每条保持 **≥ max(1.8s, 语音 + 0.6s)**；通路 `motion.subtitleFadeIn 0.12`（`STYLE.md:37`、`dub-styles.json#whiteboard`） |

- **字幕与旁白的关系**：旁白是一位边画边讲的老师（第二人称/泛指的现在时，平实直接、少形容词，`style-dna/whiteboard.md:39`）。**书写必须落在词上**——一个术语在旁白说出那一刻才写完（`STYLE.md:38`、`DEMO.md:22`）。字幕只是旁白的可读化，不承担信息，信息在板上。
- **本风格特有的字幕禁忌**：字幕**不能压在行动号召/标签上**；板上文字**绝不能做成动画字块淡入/滑入**；标签被推镜切一半算瑕疵；`dub-styles.json` 的 `subtitleOutline` 全透明，别再加描边（`style-dna/whiteboard.md:147,154`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「Burned subtitles: an off-white rounded label (~90 %)」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#00FDFCF8`（AARRGGBB，落盘 ASS 为 `&H00F8FCFD`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(253,252,248,1)）；字色 #141414 与该底衬的 WCAG 对比度 **17.95**。

---

## 6. BGM / 音效特征

- **配乐**：**钟表式极简（clockwork minimalism）**——**120 BPM、D 大调 / B 小调**：马林巴 8 分音型、大提琴/低音提琴拨弦（pizz）、木鱼每拍一下、钟琴（glockenspiel）主题，沙锤/拍手只在响段出现。科技题材可换合成器琶音 / kalimba / 拨弦。任何「两个量发散」的时刻跑**同一音型两种速度**（phase，样片第二台马林巴 ×140/130.5），修正时 **snap 成齐奏**（`DEMO.md:56`、`style-dna/whiteboard.md:122-125`、`music.py:1-4`）。
- **拟音（每一笔都有声）**：带通毛毡擦玻璃噪声（嘶声 **2.2–7.5kHz** + 身体 **0.5–1.5kHz**），用**笔画自身的速度曲线**做包络；起笔一声 **4ms** 笔尖「嗒」；随机粘滑颗粒；约 **28%** 的长笔画带**干擦尖叫**（1.5–2.6kHz 正弦 + 7–13Hz 颤音）；蓝笔稍暗、橙笔稍亮；**pan = 笔画的屏幕 x**，镜头越近越响。道具：磁贴吸钢面 = click + 金属模态（**830/1370/2210/3120Hz**）+ **140Hz** 板体闷响；板擦 = **250–2600Hz** 毛毡摩擦、被锯齿路径调制；笔托 = 塑料弹跳 + 铝环；笔帽开/合；落水 plop + 水滴。房间：低频底噪 + **一只墙上挂钟在走地面钟的秒**（`STYLE.md:70-72`、`DEMO.md:53-55`、`mix.py:25-108`）。
- **旁白处理**：Kokoro `bm_george`（**en-gb**），压缩、轻房间感，压在混音最上层（`DEMO.md:57`、`build.sh:8`）。
- **响度目标**：`-14 LUFS`；**交付真峰值上限**：`-1.2 dBTP`（项目级交付线；本风格 `STYLE.md:75` 只写 −14 LUFS，未额外声明更严上限）。本次成片实测 **I = −14.0 LUFS / LRA 3.4 LU（`ebur128`）/ 真峰值 −1.62 dBTP（`loudnorm` `input_tp`，4× 过采样）—— 真峰值在交付线内，余量 0.42 dB、未削波**（`logs/whiteboard.log:147-150` 只印了 `ebur128` 的 `Peak -1.6 dBFS`——那是 1 位小数读数，`astats` 采样峰值 −1.638909 是下界，两者都不能当真峰值用）。混音声明的平衡是「配乐比 VO RMS 低 **6.5dB** 并在说话时再 duck **9dB**、foley 比 VO 低 **11dB**」（`DEMO.md:57`）。
- **静默策略**：静默是叙事工具——在讲「时间本身」之前留 **43.55–46.42s**（约 2.9s）静默，音乐按 0.35s 淡出后归零，**全片只剩墙上挂钟走秒**；然后 46.45s 用管钟敲下第一个音把镜头甩到轨道钟（`style-dna/whiteboard.md:68`、`mix.py:183-187`）。

---

## 7. 素材偏好

- **需要什么素材**：一份 `lines.json`（每行旁白 `{id, text}`，id 形如 `v01 / v02a`）与 `voices/words.json`（每个词在每行里的起止时间，供 `at(id, word)` 把画面钉在说出的词上）；一个单线手写字体（demo 用 **EMS Tech**，由 `demo/tools/svgfont2json.py` 转成 JSON）；一支可用的 Kokoro 音色（样片 `bm_george` / en-gb）。**核心内容字段**：主题对象、一个惊人的数字、一条能走过去的过程、一个后果、一个修正（`style-dna/whiteboard.md:168`）。
- **不需要什么素材**：图库照片、实拍、3D 模型、扁平 UI 组件、任何现代图标、任何贴图（一切都要能被画成 Stroke）。
- **取景 / 质感 / 比例偏好**：**板即世界**，所有图形按板面世界坐标摆放；线宽绘图 **6–11px**、写字宽 ≈ 字高 **13%**；笔画要重采样（每 ~0.6×线宽）、带低频手抖（±2.6px，波长 ~220px）+ 细颤、凿形笔尖按方向调制宽度（0.8–1.0）、起笔压力斜坡（0.72→1）收笔收 12%、圆越过闭合处、矩形四笔四角小出界、长笔画起笔内侧一个积墨点（`STYLE.md:21`、`DEMO.md:64`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有新图形素材时，直接用引擎造形函数现场造（`W.line / curve / poly / arc / circle / rect / roundRect / arrow / dashed / hatch` 或 `W.text`，`DEMO.md:100-103`）；缺的字符（`μ ≈ → × − ✓ ² ↓ ° ± .`）在引擎里**手工定义**字形（`engine/wb.js:181-193`）；字体缺失时退到任一**单笔画**手写体，不要用普通矢量字体（等宽/几何字体会立刻破风格）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 不是「镜」而是**相机段**：一次停留/一次推拉/一次甩镜。**标题落笔 ~3s**、一个标签 **0.3–0.8s**、一整颗卫星 **~1s**（`DEMO.md:49`） |
| 全片时长 | **111.0s**（`style.json:17`、`logs/whiteboard.log:26` 的 `dur 111`）；文档定位 60–120s（`STYLE.md:6`） |
| 镜头数 | 24fps / **2664 帧**（`logs/whiteboard.log:121,151`）；**999 条事件**、**25 条字幕**（`logs/whiteboard.log:26-27`）；相机**从不切镜**，全程 1 个连续镜头（只有甩镜改变区域） |
| 信息投放节拍 | 钩子落在极小物件（别针）→ 尺度揭示 → 标题落在第一拍强拍 → 分 3 步讲机制 → **静默 + 一句转折** → 用「视觉二重奏」解释转折 → 一个展示后果的玩笑 → 板擦倒擦 → 修正、对齐 → 拉远越过板框 → 在标题下方写结尾卡（`DEMO.md:30`） |

- **加速 / 减速点**：手速曲线 `u − sin(2πu)/2π × 0.8`（慢落、快中、慢收），笔画被排进**时间窗口**并解出速度（`by:` 模式），所以书写总能准时落在词上（`STYLE.md:43`）。**加速**：甩镜、笔飞回、磁贴下落（0.3s）；**减速**：读方程/定义/清单时**必须停住不动**（`STYLE.md:61`）。
- **留白与静音的位置**：**43.55–46.42s** 约 2.9s 静默（只有挂钟走秒），放在「But, there's a catch.」之前；结尾卡写在标题下方（demo 从 **103.3s** 起、**107.3s** 落笔帽），让片子结束在它开始的地方（`style-dna/whiteboard.md:68`、`DEMO.md:74`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/whiteboard/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/whiteboard/demo --fps 24 --workers 5 --out $D/out/video24.mp4`（`build.sh:15`）；**本次编排器实际调用**为 `--fps 24 --workers 6 --size 1920x1080 --out D:\lemo-opuscar\styles\whiteboard\demo\out\video_gpu.mp4`（`logs/whiteboard.log:36`） |
| 帧率 | **24 fps**（2664 帧 / 111.0s，`logs/whiteboard.log:121`） |
| 分辨率 / 比例 | 原生 **1920×1080 / 16:9**（`logs/whiteboard.log:2`）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:13`），由 `setFrame()`（`engine/wb.js:14`）按实际帧重排：相机经 `dXf` 把设计帧等比装入（`engine/wb.js:17,322`）、屏幕家什按 `FX/FY/S`（`engine/wb.js:413,440,474,488`、`film.js:370,379`）；16:9 时 `FX=FY=S=1` 逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $OUT/whiteboard.mp4 24 2`（**−14 LUFS，grain 2**）（`build.sh:16`、`logs/whiteboard.log:8`） |
| 编码器 | **`h264_nvenc`（本地 GPU）**（`logs/whiteboard.log:7` 显示 `nvenc`） |
| 音频入口 | `demo/music.py`（钟表式极简配乐，读 `events.json`）+ `demo/mix.py`（逐事件 foley + VO + ducked score）（`build.sh:13-14`） |
| 字幕入口 | `node $D/tools/subs.mjs && $PY core/render/srt.py $D/out/subs.json $OUT/whiteboard.srt`（`build.sh:17`） |
| 事件导出 | `node core/render/events.mjs styles/whiteboard/demo`（本次 **events 999 dur 111**，`logs/whiteboard.log:26`） |
| 本风格专属参数 | `$D/tools/cuecheck.py`（配乐重音 ↔ 画面事件对齐检查，`build.sh:12`）；剧照 `node core/render/still.mjs $D 53.1 --q nosubs=1`（`build.sh:18-20`） |
| 一键复现 | `sh styles/whiteboard/demo/build.sh [--vo]`（`--vo` 会重做 TTS + ASR 词时间）（`build.sh:1-21`） |
| 本次编排器调用 | `node lemo-make.mjs whiteboard --skip-sync --no-preflight --ratio 16:9`（`logs/whiteboard.log:1`，**走了 `--skip-sync`**） |

---

## 10. 编排规则

- **内容文件字段契约**：`lines.json` 提供每一行旁白 `{id, text}`（id 形如 `v01 / v02a`），**逐行即一句**、按子句拆成字幕；`voices/words.json` 提供每个词在每行里的起止时间（供 `at(id, word)` / `atS` / `atE` 把画面钉在说出的词上）。片子的「内容字段」是：主题对象（样片=别针/手机）、一个惊人的数字（20,000km、38μs、11km）、一条能走过去的过程（信号→延迟→距离→三边定位）、一个后果（每天漂一格）、一个修正（发射前调慢）。颜色语义在 `STYLE.md:28` 固定：黑=结构、蓝=信号/测量、橙=你/时间/关键之物（`style-dna/whiteboard.md:99`、`film.js:20-24`）。
- **事件词汇表**（`type` → 消费者）：`stroke | write | dash`（`{pen,dur,len,x,y,pan,z,on}` → `mix.py` 记号笔声，`write` 稍轻；`pan`=屏幕 x、`z`=远近、`on=0` 时压低 9dB）/ `tap`（笔尖小嗒）/ `magnet`（`{big}` 磁贴吸板）/ `magnetOff` / `erase`（`{len}` 板擦摩擦）/ `rewind`（`{dur}` 摩擦用 9Hz 调制）/ `splash` / `tray`（`{pen}`）/ `trayEraser` / `cap` / `capOn` / `ping`（`{k}` 广播涟漪→钟琴 ping）/ `tickG{i}` / `tickO{i}` / `tickFix{i}` / `day{d}` / `vo`（`{id}`）/ `cues`（音乐锚点包）（`style-dna/whiteboard.md:193-214`）。
- **时间线契约**：`demo/film.js` 导出 `build()` → `{ dur, render, ev, subs, cam, tl, VO, cues }`。`render(ctx,t)` 逐帧绘制（含 >14px/帧时的 180° 运动模糊、≤12 子帧、间隔 ≤4px）；`dur` 总时长（样片 `END=111`）；`ev` 是按时间排序的事件数组（供 `events.mjs` 导出 `events.json` 驱动声音，并附加 `pan/z/on`）；`subs` 是字幕条（子句拆分、≤44 字符/行、每条至少保持 1.4s）；`cam` 是键控相机；`cues` 是音乐锚点（`T0/BEAT/duet0/fix0/dayT`）。页面契约由 `main.js` 暴露 `window.READY / window.render(t) / window.DUR / window.EV`（`style-dna/whiteboard.md:101`）。
- **新增主体怎么接入**：新主体 = 一组用引擎造形函数画出的 `Stroke`，交给某支笔在时间窗口内画完。必须做三件事：① 用 `W.line / curve / poly / arc / circle / rect / roundRect / arrow / dashed / hatch` 或 `W.text(str, x, y, {h, align, color})` 生成 `Stroke[]`；② 用 `tl.draw(pen, shapes, t, {by, minGap, maxGap})` 排进窗口（`by:` 让引擎解手速、保证准时写完；虚线自带更小底线、需要时用另一支笔）；③ 需要移动的实体**只交给磁贴**（`W.drawPinMagnet`），需要擦除/倒带用 `tl.erase(path, t, dur, {width, strength})`。给标签留出「全在或全不在」的余量，避开推镜的切边（`style-dna/whiteboard.md:100`、`DEMO.md:104-110`）。
- **换主题时要改哪些文件**：① `demo/lines.json`（旁白）→ 跑 `core/tts/tts.py` + `demo/tools/asr_check.py` 得新的 `voices/words.json`；② `demo/film.js`（板面区域布局常量、VO 起句时间、把画面用 `at(id,word)` 挂到说出的词上、笔、相机关键帧、字幕拆分）；③ 新图形直接用 `engine/wb.js` 的造形函数写进 `film.js`，**引擎本身不用改**；④ 配乐 `music.py` 读同一份 `events.json`，一般不用改。**关键**：先写 treatment 再据此产出素材，不要靠改内容文件硬凑（`DEMO.md:78-83`）。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里可生效的参数有 `palette`（bg `#e9ebee` / bg2 `#9aa0a8` / fg `#23262c` / accent `#d97757` / subtitle `#141414` / subtitleOutline 全透明 / subtitleBack `#E6F5F2EC`）、`bgRecipe`（type=gradient，stops `#e9ebee → #9aa0a8`，texture none，vignette 0.08）、`subtitle`（KaiTi / 0.04074 / 0.14537 / 0.06019 / 描边 0 / align 2）、`title.fontSizeFactor 0.11`、`motion.subtitleFadeIn 0.12` / `chapterTransition cut`、`overlay.accentRule true`（章节卡与 lowerThird 保守关闭）（`dub-styles.json#whiteboard`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **ASR 校对未通过 2 条**：本次 `mismatches: 2 (lang=en, model=base.en)`，日志有 `STEP_WARN asr_check 未通过（继续）`。两处 `DIFF` 是 `v08 | Two, at one of two points.` 被转成 `Two and one of two points.`、`v18 | So before launch, engineers tune the satellite clocks to tick slightly slow.` 被转成 `So, before launch, engineers tune the satellite clocks to take slightly slow.`（`logs/whiteboard.log:115,128,130-131`）。ASR 失败只警告不致命，但这两句的可听性存疑。`STYLE.md:98` 的既定对策是**语言码要配嗓音**并用 ASR 核对（英式嗓音配 `en-us` 音素会把 clocks 读成 Clarks）。
- **混音三段平衡与声明不完全一致**：本次实测 `rms vo/music/foley -20.1 -28.9 -20.9 peak 0.95`（`logs/whiteboard.log:136`）。配乐比 VO 低 **8.8dB**（声明 6.5dB，稍保守）；foley 与 VO 的整段 RMS 只差 **0.8dB**，与声明的「foley 比 VO 低 11dB」差距明显——可能是整段 RMS 把 VO 的静默间隙算进去导致的度量口径差异，但**该处平衡需要复核**，别直接照抄成结论。成片真峰值 = `loudnorm` `input_tp`（4× 过采样）**−1.62 dBTP**，在 −1.2 dBTP 交付线内（余量 0.42 dB）、未削波——`mix.wav` 的 peak 0.95 经两遍 loudnorm 后安全落地。
- **通路配色是派生近似，不是原文色**：`dub-styles.json#whiteboard` 标了 `derived: true`，`bg #e9ebee / bg2 #9aa0a8` 是从 demo 代码抽的**代理值**，与 `STYLE.md` / `DEMO.md` 的板面 `#fbfbf9 → #eeede9` 不是同一组；字幕字体回退 **KaiTi**（本机无 Architects Daughter / EMS Tech 的 OFL 文件）。用通路出片时颜色会比样片更冷更灰。
- **9:16 曾不适配（★ 2026-10-04 已修）**：原记「无 `aspects` 声明，区域布局与底部 12% 字幕带都是按 16:9 定死的，竖屏会丢掉右侧约 43.75% 与底部字幕」。**2026-10-04** 已改造 `styles/whiteboard/demo/`：`film.js` 声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:13`）、`engine/wb.js` 加 `setFrame(W,H)` 派生 `FX/FY/S`（`engine/wb.js:14`）与 `dXf` 设计帧等比装入（`engine/wb.js:17`），相机 `applyCam` 与屏幕家什（墙/墨层/反光/字幕/笔/磁贴/板擦）都从实际帧重排（`engine/wb.js:322,354,377,413,440,474,488`；`film.js:370,379`），`main.js` 读视口后 `setFrame(VW,VH)`（`main.js:9-10`）。**16:9 逐字节未变**（`FX=FY=S=1` 时每个表达式都退化成它替换掉的那个数字）；9:16 实测不裁切、板面完整（见第 2 节）。
- **细纹理 `textureRaw: whiteboard` 声明了但渲染未实现**：`lib/dub-styles.json#whiteboard.bgRecipe.textureRaw` 是 `whiteboard`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `none` ⇒ 落空（该风格粗粒度没有纹理层）），**不读** `textureRaw` ⇒ `whiteboard` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `whiteboard` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口
- 依赖**单线手写字体**（demo 用 EMS Tech，需经 `svgfont2json.py` 转 JSON）；换题材若没有同类单笔画字体，手写感会塌。
- 依赖**可用的 Kokoro 音色**（样片 `bm_george`）；换语言要自带对应音色并重跑 ASR 核对。
- 引擎手工补的字符集有限（`μ ≈ → × − ✓ ² ↓ ° ± .`，`engine/wb.js:181-193`）；中文题材需要另建字形表。

### 能力限制
- 中速讲解风格：**60–120s**、一条论证链、一条线一个想法；撑不起快节奏、强情绪、真人出镜或并列多观点的密集片。
- **没有手**是硬约束：所有移动只能由悬浮笔、磁贴、板擦完成。
- 板面上不允许切镜，只能甩镜；换区域要靠「画一条线走过去」。

### 踩过的坑（本机实测）
- **一支笔安排太多活**：单支笔一笔接一笔地往后漂（样片里卫星晚了 12s）。每张图必须给一个时间窗口（`by:`），重叠的活交给另一支笔（`DEMO.md:87`）。
- **虚线用统一的最小笔画时长**：60 段虚线 × 0.09s 底线 = 6s，虚线要有自己的更小底线（`DEMO.md:88`）。
- **积墨点比笔画起点还大** → 每个字母都晕出灰边，要把点收在笔画内（`DEMO.md:89`）。
- **标点消失**（字体的句点是 1px 笔画）→ 小于线宽的笔画要渲染成点（`DEMO.md:90`）。
- **推镜把标签切一半**很难看；**子帧太少的运动模糊会让文字频闪**（子帧间隔必须 ≤4px）；**板擦路径会擦过想保留的标签**（曾把 "orbit" 擦掉一半）（`DEMO.md:91-94`）。
- 本次为出片**走了 `--skip-sync`**（`logs/whiteboard.log:1`），即没有做双份库同步；混流走的是 **WSL 侧 `core/render/mux.sh` + `nvenc`**，日志有 `STEP_WARN asr_check 未通过（继续）` 一条告警，其余步骤全绿（`logs/whiteboard.log:131`）。渲染 + 音频并行共 **75.0s**，全流程 **115.8s**（`logs/whiteboard.log:140,158`）。

### 下次迭代优先补什么
- 修 ASR 两处 `DIFF`（调整断句或给 checker 一个 plain spelling），把 `STEP_WARN` 清掉。
- 复核 foley 与 VO 的实际响度关系，确认是度量口径还是真的偏响。
- ~~给 `style.json` 补 `aspects` 或提供 9:16 重排方案（区域布局 + 字幕带）~~ ★ 2026-10-04 已完成：影片声明 `FILM_META.aspects` 并按实际帧重排（见第 2 / 11 节）。
- 把 `dub-styles.json#whiteboard` 的派生 `bg/bg2` 换成从 demo 代码抽出的真实板面色。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/whiteboard/whiteboard.mp4`（**111.00s / 63.0MB**，2664 帧 / 24fps） |
| 抽帧 | `D:/lemo-tools/_distill/frames/whiteboard/`（**24 帧 + 接触印样**） |
| 风格匹配度自评 | **92/100**（2026-10-05 校正：原 93，新增「textureRaw 细纹理未实现」缺陷，palette −1）（2026-10-05 校正：原 92，9:16 画幅缺陷已修并回补 composition +1） |
| 详细资料 | 有（STYLE.md / DEMO.md / style.json / build.sh / lines.json / style-dna .md+.json / dub-styles.json#whiteboard / demo 源码 engine+film+mix+music / 出片日志） |

**逐帧拆解要点**：
- **f01** 开场：暖白板上先画出橙色地图别针（主角磁贴），一支黑马克笔正写「you are here」；底部米白圆角字幕标签（深字 + 左下角一小段橙色强调划）「Right now, your phone knows where you are, to within a few metres.」。**板面无边框、无墙面**，纯白板世界。
- **f02–f03** 拉远看到手机屏幕（灰描边圆角矩形）与手绘地图网格，橙色别针 + 蓝色圆（15m）+ 蓝色斜线（信号）；镜头由笔带着走。
- **f04** 尺度段：一条**橙色虚线弧**（轨道）横跨画面，一颗卫星在右、一支蓝马克笔在右下角；字幕「About thirty satellites circle twenty thousand kilometres above us.」——说明轨道用橙色（= 关键之物）。
- **f05–f06** 卫星成形：橙色马克笔在画卫星中心的一个**橙圈**（原子钟），两侧太阳能板用黑线；字幕「Each one carries an atomic clock.」。
- **f07** 一段几乎全空的板（只有一条蓝色虚线、一个橙色小物体、一支灰笔淡出）——**这是运动中/甩镜的过渡帧**，画面元素最少。
- **f08–f10** 手机地图特写：黑线画街网、蓝线画三边定位圆弧、橙色别针居中；f10 中黑马克笔在写字，左侧手写注解「+1 more satellite / fixes the phone's / own cheap clock」；f10/f02 的字幕是「It works it out by listening」/「Two, at one of two points.」。
- **f11** **视觉二重奏**：左边黑描边时钟标 "ground"、右边橙描边时钟标 "orbit"，两支笔（黑+橙）在下方各画一条水平线；字幕「Up there, time itself runs at a different speed.」。
- **f13–f14** 相对论细节：橙色刻度尺（orbit）横贯上方，黑笔写「speed ≡ slows it」、黑笔写「gravity」，右侧写「-7 μs」/「+45 μs」；字幕「Moving fast slows the orbiting clock.」/「Weaker gravity speeds it up by forty-five.」——**方程逐项出现，正好在旁白说出时写完**。
- **f16–f17** 复用第一方程：黑笔写「delay × speed of light = distance」+「0.067 s × c ≈ 20,000 km」，f17 再补「38 μs × c ≈ 11 km」，橙笔在等号右侧下加**橙色强调下划线**。f17 无字幕（让观众读）。
- **f18–f19** 后果段：橙色虚线轨迹带 Tue/Wed 标签，别针磁贴沿轨迹漂移（f18），f19 别针**落进蓝色波浪（sea）**，板上有 Sat/Sun 标签、两支笔（黑+蓝）；字幕「By next week, you'd be somewhere out at sea.」。
- **f20–f21** 修正段：上下两条刻度尺（ground 黑 / orbit 橙），黑笔写「tuned slow before launch」，橙笔重画轨道刻度（板擦倒擦后再画）；字幕「So before launch engineers tune the satellite clocks to tick slightly slow.」。
- **f22** **全板揭示**：镜头拉远到越过板框，整块白板连同**铝框、笔托、暖灰墙 `#d8d3ca`** 一起入画——之前所有区域（手机地图、方程、两座钟、两条刻度尺、卫星、海）同时可见；右侧边缘可见笔托。
- **f23–f24** 结尾卡：在标题「EINSTEIN / IN YOUR POCKET」下方用同一支手写体写「how GPS really works」「Whiteboard Explainer」「Lemo-Opuscar」（橙）「LemoLab × Claude Opus 5.5」+ 小字 credits（voice Kokoro bm_george / lettering EMS Tech / samples VSCO 2 CE, VCSL, FreePats），笔在 107.3s 落帽。
- **整体观察**：全片**板面色恒定**（无暗→亮/冷→暖推移，起伏靠墨的疏密与镜头远近制造）；字幕**只在底部米白标签里**、出现在旁白句首之后；**没有硬切**——所有区域变化都靠相机平移/推拉/甩镜，f07 那种「近乎空板」的帧就是甩镜中的过渡；未见糊帧、黑边或字幕溢出。

**自检发现的缺陷**：ASR 2 处 `DIFF`（v08 / v18）并触发 `STEP_WARN`；实测混音三段 RMS（vo/music/foley −20.1 / −28.9 / −20.9）与声明的 6.5/9/11dB 规则不完全吻合；`dub-styles.json#whiteboard` 的 `bg/bg2` 是派生代理色且字幕字体回退 KaiTi；~~无 9:16 适配~~ ★ 2026-10-04 已适配 9:16（见第 2 / 11 节）。

**本次为补齐短板做了什么**：**未改动** `D:/lemo-opuscar` 下任何源码，**未起渲染或 TTS**，只新增本目录两份交付物。本次成片走上游既有链路：`node lemo-make.mjs whiteboard --skip-sync --no-preflight --ratio 16:9` → 1920×1080 / 24fps / 6 workers / `nvenc`，混流 `core/render/mux.sh <video24.mp4> <mix.wav> <out.mp4> 24 2`（grain 2），输出 `MUX_OK 66057960 src_frames=2664 out_frames=2664`，`-14.0 LUFS / LRA 3.4 LU / Peak -1.6 dBFS`（`logs/whiteboard.log:1,7,36,151,147-149`）。上面第 11 节已把 ASR 与混音平衡两处疑点如实记录，供后续迭代。
