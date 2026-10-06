---
name: lemo-style-glass-product
description: 【lemo 风格 Skill · 玻璃质感产品】要做虚构产品的发布片 / 开箱特写 / 材质展示时用本风格：无限黑影棚里一个玻璃+金属+光的英雄物件，长灯条把透明玻璃勾成带彩虹边的细白轮廓，慢速爆炸图在重拍上啪地合拢并从内部亮起来。选定本风格做视频时，优先读本文件。
slug: glass-product
name_zh: 玻璃质感产品
category: 材质与 3D
film: Aura — Hear the Light
---

# 玻璃质感产品（`glass-product`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/glass-product/STYLE.md` · `styles/glass-product/DEMO.md` ·
> `styles/glass-product/demo/build.sh` · `lib/style-dna/glass-product.json` ·
> `lib/style-dna/glass-product.md` · `lib/dub-styles.json#glass-product` ·
> `styles/glass-product/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部在透明与磨砂玻璃里做产品渲染的发布片。一个由**玻璃、金属与光**构成的单一英雄物件悬浮在无限黑的影棚里；长灯条在它**背后与旁边**把透明玻璃变成一条带彩虹边的细白轮廓，内部像陈列柜一样透出来。材质与光才是主角（`STYLE.md:8`）。

**不是什么**（最容易做错的邻居风格）：不是白幕目录棚拍、不是线框 HUD（那是 `hologram-hud`）、不是发布会幻灯片（那是 `dark-keynote`）。判据很简单——画面里如果没有「光穿过材料」这件事，就不是本风格。

**什么时候用它**：产品发布会片、消费电子、美妆护肤、任何需要「高级、冷静、被认真打光」气质的单物件展示（`style.json` 的 `uses`：Product launches / Consumer tech / Beauty）。

**一句话内核**：找到「产品做的那个看不见的事」，让它在玻璃里变成光（`STYLE.md:75`）。demo 把「声音」变成导光条里的光脉冲。

**边界**：铁律是**物件永远虚构**——绝不复制真实产品剪影、品牌名、logo、字体或 UI（`STYLE.md:10`）。也撑不起：多人物、对话、数据表、清单式讲解、任何需要「文字阅读」的内容；它只讲一个物件的一件事。

---

## 2. 画面构图

- **镜头数与画幅**：原生 **16:9 / 1920×1080**，**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`demo/film.js`），见下方子段。demo 11 个镜位（`DEMO.md:22-33`），单镜平均约 2.9s，全片 32.0s。
- **主体位置与占比**：**一个英雄**，居中或压在强对角线上；宽景里**绝不被画框边缘切掉**（`STYLE.md:62`）。爆炸视图里零件沿轴散开跨度约 **80% 画幅**（`DEMO.md:28`）。
- **负空间 / 留白**：极大量。背景是黑 + 可选深灰径向 sweep（`#34383d → #16181b → #000`，0–1.1），**没有地平线**（`STYLE.md:21`）。地板是黑光泽模糊镜面，径向淡出。
- **图层叠放顺序**（从底到顶）：① 黑底 + 径向 sweep；② 地板镜面 + 程序化焦散 + 事件扩散环；③ 英雄物件（玻璃/磨砂/金属/导光条）；④ 灯条高光与色散（真几何，物理产生）；⑤ 磨砂玻璃字幕条；⑥ 标题 / kicker / 片尾卡。
- **安全区**：标题居中在**上三分之一**（`STYLE.md:34`）；字幕条居中偏下，实测 `marginVFactor 0.14537`（即下边距约 15.7% 画面高）。主体在宽景里留出四边余量。
- **本风格**不能**出现的构图**：白幕/亮底；把强调色用在非光的东西上（`style-dna:168`）；纯正侧面轮廓（会读成蘑菇、锅盖这类简单形状，`STYLE.md:90`——必须用 3/4 视角、盖子立在后方）；爆炸视图轴垂直于视线（会退化成几条线，轴应与视线约 40°，`STYLE.md:89`）。

### 在 9:16（产品默认）下的表现

**已适配**（`FILM_META.aspects = ['16:9','9:16']`，`demo/film.js`）。本风格是 **three.js 影棚片**：画面本体（影棚 / 灯条 / 物件 / 地板焦散）与 HUD（片名 / 磨砂玻璃字幕条 / 片尾卡）**都按设计帧 1920×1080 构图**，且含多帧全屏覆盖（开场淡入、片尾淡黑）；因此改造走的是「**设计帧整体等比装入当前帧 + 同色留白**」这一档：`main.js:223-225` 把 3D 画布与 `#ov` 一起按 `S = min(FX, FY)` 缩放、居中（`transform: translate(OX,OY) scale(S)`），设计帧外留背景色 `#000`——无限黑影棚，**留白与画面同色，看不出黑边**，不裁切、不变形。1080×1920 实测（`S = 0.5625`）：整张 16:9 画面等比装入居中的 1080×607.5，**主体（盒子 / 耳机 / 爆炸视图）与文字完整**；字幕「Nothing to hide.」（t=9.5s）与「Every part, in plain sight.」（t=13.5s）都在帧内、未被裁，片名与片尾卡同理。**16:9 逐字节未变**：`S = 1`、偏移 0 ⇒ 不套变换，3 帧 md5 与改造前完全相同（本风格 WebGL 渲染逐字节可复现，md5 判据可用）。**9:16 与「16:9 中心裁切」的 SSIM 仅 0.35–0.44**（≠ 裁切）。代价：画面只占竖屏中段、主体像素尺寸 = 16:9 的 **0.5625 倍**——这是「宽 1920 必须完整装进 1080」的必然结果；**本轮没有做相机重取景那一档**（要动地板 Reflector、背景 sweep 与焦散的屏幕采样，收益只是把本就不可见的黑边换成更多影棚地面），也**没有做「真竖版重排」**（重排物件机位与字幕安全区）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 底 | `#000000` | 无限黑影棚底 | `dub-styles.json#glass-product.palette.bg` |
| 背景 sweep | `#34383d → #16181b → #000` | 深灰径向，把玻璃边缘从黑里分离出来 | `DEMO.md:54` |
| 主（中性） | `#ffffff` / 灰阶 | 灯条反射的白、金属自身色、玻璃衰减 | `dub-styles.json#glass-product.palette.fg` |
| 强调（只给光） | `#62dcff` → `#A98BFF` | 冰蓝→淡紫，用于自发光、焦散环、字幕顶线 | `dub-styles.json` accent + `DEMO.md:49` |
| 玻璃衰减色 | `#f3f8fb` @160mm | 透明玻璃 attenuation | `DEMO.md:51` |
| 磨砂玻璃 tint | `#eef2f5` | 磨砂玻璃本体色 | `DEMO.md:51` |
| 导光条本体 | `#15181b` | 抛光亚克力底 | `DEMO.md:53` |
| 字幕 | `#ffffff`（10% 冷白叠在模糊画面上） | 磨砂条内的字 | `STYLE.md:33` |

- **明度 / 对比规则**：世界是**中性**的——黑、灰、灯条反射的白、金属自身的色调；**只有一个强调色族，且保留给光**（自发光、焦散环、UI 上的色散线），可以随年龄或能量在两个相邻色相间漂移（`STYLE.md:26-27`）。
- **禁止出现的颜色**：品牌色（必须从「产品做什么」里选，不能从品牌里选）；彩色自发光塞进磨砂玻璃内部（会把整件染上色，demo 实测青色灯条把整个壳体染成青绿，`DEMO.md:89`）；色散彩虹**只能出现在厚玻璃边缘和焦散里**，绝不能做成表面或字体上的渐变（`STYLE.md:29`）。
- **同一画面最多几个色相**：中性（黑白灰）+ 1 个强调色相族，共 2 类。demo 全片即黑 + 冰蓝/淡紫。

---

## 4. 转场规则

- **镜头之间怎么切**：**只在拍上硬切**（尽量落在小节线），产品片**不需要镜头间的空间连续性**——每一镜都是它自己的展示台，可以藏起或移走任何不为它服务的东西（`STYLE.md:62`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：允许的只有两种——**拍上硬切**与**一道光扫穿过黑场**（`STYLE.md:62`）。光扫是本风格的标志性转场：真几何灯条在镜头背后（方位角 = 镜头 + π）扫过，高光/折射/色散随之物理移动。
- **硬切点怎么定**：挂在 **120 BPM** 网格上，1 拍 = 0.5s、1 小节 = 2s（`story.js:2`）。demo 的切点全部落在小节线上，例如 16.0s 的合拢（drop）就是一个小节头。
- **转场时长与缓动**：光扫不是瞬时切换，是一条真几何在 0.5–1.2s 内扫过（demo 开场两道扫 [0.5,1.7] 与 [2.0,3.2]）。爆炸合拢是 **0.25s ease-in** 精确落在 drop 的 downbeat 上（`DEMO.md:37`）。
- **绝对不要的转场**：**溶解与划像**（`STYLE.md:62` 明确禁止）；非拍点剪辑；手持晃动式转场。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | Inter Tight（licence-free grotesk），light 300（`STYLE.md:33`）；dub 通路回退 `DengXian`（本机无 Inter Tight） |
| 字号（相对画面宽 / 高） | 40px @1080 高 = **3.704% 画面高**（`dub-styles.json#glass-product.subtitle.fontSizeFactor = 0.03704`） |
| 颜色 / 描边 / 阴影 | 字 `#ffffff`；无描边（`outlineFactor: 0`）；底是一条**磨砂玻璃条**：76px 高、radius 38、`filter: blur(18px) brightness(1.25)` + 10% 冷白、1.2px 渐变描边、蓝→紫顶线（`DEMO.md:56`）。dub 通路近似为 `subtitleBack: #B3000000` |
| 位置 / 安全边距 | 居中（`align: 2`），下边距 **14.537% 画面高**（157px @1080）、左边距 **6.019%** |
| 单行字数上限 / 最多行数 | demo 实测每行 **10–27 个字符**，共 4 行（`style-dna:40`）。单行，不折行 |
| 出现与消失方式 | 淡入（dub 通路 `subtitleFadeIn: 0.16`），停留 ≥ `max(1.9s, 语音 + 0.7s)`（`DEMO.md:56`）；出片实测 cues：`Nothing to hide.` [8.55,10.494]、`Every part, in plain sight.` [12.45,14.966]、`Meet Aura.` [24.5,26.4]、`Hear the light.` [25.8,27.7] |

- **字幕与旁白的关系**：字幕即旁白逐字稿，克制、低沉、极短。demo 用 Kokoro `am_michael`，speed 0.86–0.88（`DEMO.md:45`）。句式是无主语/祈使式的产品宣言，现在时。
- **本风格特有的字幕禁忌**：① **绝不单独念产品名**——ASR 和观众都会听错（demo 的 `Aura.` 被听成 Laura / Dora，改成 `Meet Aura.` 才过，`DEMO.md:45`）；② 不要长句/从句/书面语；③ 产品名与 slogan 是**标题卡**，不是字幕行（`STYLE.md:35`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「a centred rounded bar filled with the live frame blurred」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#E6D2E1F0`（AARRGGBB，落盘 ASS 为 `&HE6F0E1D2`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(210,225,240,0.1)）；字色 #ffffff 与该底衬的 WCAG 对比度 **17.99**。

---

## 6. BGM / 音效特征

- **配乐**：**极简电子，绝不用钢琴加弦乐**（`STYLE.md:66`）。demo 是 numpy 原创合成：**120 BPM、F 小调、32.0s**（`music/score.py:2`）。音色清单：弓奏玻璃/湿指音、颗粒水晶云、玻璃铃与 FM 玻璃拨弦、滤波 tick 网格、暖 pad、sub drone、软短 kick 与拍手、808 低音（正弦 + 音高包络、软饱和、滑音）、噪声与锯齿 riser、一声高玻璃叮。结构：暗开场 sub drone + 玻璃微光 → 构建段 FM 玻璃拨弦琶音 + 低通打开 → 微距段每拍软短 kick → 爆炸段噪声/锯齿 riser → drop 前**半小节完全静默** → 808 drop + 切分 bass `[0, .75, 1, 1.5]`/小节 → 2、4 拍 clap → 四音玻璃铃动机 → 收束高玻璃叮（`DEMO.md:41`）。出片日志实测分段响度：A 0-4s −25.33 / B 4-8 −24.92 / C 8-12 −20.17 / D 12-15.5 −21.23 / **silence 15.5-16 = −999.0**（真静默）/ E 16-24 −13.92 / F 24-28 −16.97 / G 28-32 −25.69 dB。
- **拟音（foley）清单**：按材质来——光扫用**玻璃微光**（带通噪声 + 非谐泛音，声像随灯条移动）；移动盖子用**玻璃-金属摩擦**；**磁吸 click**（<2ms 瞬态 + 3–5kHz 金属共振 + 低频闷响）；移动零件用**气流噗**；合拢 = **一串相隔几毫秒的 click + 一个非谐玻璃和弦**（泛音 ×2.76、×5.4；demo 是 6 个 click 相隔 15ms，`mix.py:89-90`）；玻璃碰玻璃的 tick。事件词汇由 `story.js` 声明：`sweep / slide / tock / click / lift / puff / slowwhoosh / revwhoosh / snap`。
- **旁白处理**：Kokoro TTS 直出（本 demo **没有** `voice_fx.py` / `voice.py`，按它自己 build.sh 的写法直接输出，见出片日志 [配音 1/1] 行）。**音乐在人声下压 ~12 dB、拟音 ~6 dB**（`STYLE.md:71`）。
- **响度目标**：`−14 LUFS`；**真峰值上限**：`−1.2 dBTP`（**项目级交付线**，判据见 `core/render/mux.sh`；本风格 `STYLE.md:71` 未额外声明更严上限）。出片实测 **−13.7 LUFS / LRA 6.6**（`ebur128`）、**真峰值 −1.62 dBTP**（`loudnorm` `input_tp`，4× 过采样；`ebur128` `Peak` −1.6 dBFS 仅作参考），与目标差 0.3 LU，可接受但略偏响；真峰值在交付线内。
- **静音策略**：**静默是工具**——释放前一小段完全静默（连混响尾巴都切掉），里面最多放一条反向呼啸（demo 15.55s 一条 0.45s 的 `revwhoosh`，零件被吸回）。静默后第一声最重要（`STYLE.md:68`）。实测 `silence_rms 0.0`，确实做到了真静默。

---

## 7. 素材偏好

- **需要什么素材**：**几乎不需要外部素材**。影棚（灯条、地板镜面、焦散）、物件几何、材质、配乐、拟音全部由 demo 引擎程序化生成（`studio.js` / `product.js` / `music/score.py` / `mix.py`）。唯一的外部依赖是**字体**（Inter Tight，在 `demo/fonts`）与 TTS 声线。
- **不需要什么素材**：不需要实拍视频、不需要照片、不需要外部 HDRI——`STYLE.md:16` 明确要求**影棚 = 灯条场景，不是 HDRI**（摄影棚 HDRI 里的窗户和杂物会在玻璃上印成乱七八糟的条纹）。
- **取景 / 质感 / 比例偏好**：微距距离 **25–45 mm**；浅景深物理 DoF，微距光圈 700–900、爆炸视图 70、宽景 160–300（`DEMO.md:55`）。物件在 mm 单位下建模，近裁面 1（`STYLE.md:22`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：换物件只需替换 `product.js` 里的几何（例如把玻璃圆柱 + 盘绕导光条），**保留材质与 `studio.js`**（`STYLE.md:96`）。若本机跑不动每帧 PMREM 或 transmission，宁可降分辨率/降帧率，也不要改成贴图假高光——那会直接毁掉本风格的核心。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 约 2.0–4.0s；爆炸视图是唯一的例外，被拉长到 **17.0s**（`DEMO.md:35`） |
| 全片时长 | **32.0s**（`style.json:17`；DEMO 给的故事弧是 30–40s，`DEMO.md:14`） |
| 镜头数 | 11 个镜位（`DEMO.md:22-33`） |
| 信息投放节拍 | 挂在 120 BPM：1 拍 0.5s / 1 小节 2s |

- **加速 / 减速点**：节奏弧是「慢 → 更慢 → 爆发 → 收」：开场 0–4s 极慢推（环境近零，只看轮廓）→ 4–8s 缓慢 40° 环绕开盖 → 8–12s 微距（每拍一道短光扫）→ 12–16s 爆炸视图并**拉长 17.0s 段**做悬念，合拢前 0.5 小节完全静默 → **16.0s 合拢（drop）**后 0.9s 内镜头推进约 40% + 两帧微震 → 20–28s 自信的中速节奏（第二只耳机在 downbeat 飞入）→ 28–32s 缓慢拉远给片尾字留位置（`DEMO.md:37`）。
- **留白与静音的位置**：合拢前 [15.5, 16.0] 半小节完全静默（实测 −999.0 dB）；全片首尾各一道光扫做呼应——开场用一道光扫揭示黑暗的物件，结尾用**同一道**光扫扫过已经自己发光的它（`DEMO.md:16`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/glass-product/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/glass-product/demo --fps 24 --workers 3 --out $D/out/video24.mp4`（`build.sh:15`）；本次实际出片用 `--workers 6 --size 1920x1080` |
| 帧率 | 24 fps（`style.json:16` 的 `frame_sec` 19.2 是「每帧秒数」口径下的换算值） |
| 分辨率 / 比例 | 原生 **1920×1080 / 16:9**（本次出片命令行显式 `--ratio 16:9`）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`demo/film.js`）——3D 画布与 `#ov` 一起按 `S = min(FX, FY)` 等比装入当前帧、设计帧外留背景色 `#000`（`main.js:223-225`），16:9 时 `S = 1`、逐字节不变 |
| 混流 | `sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav styles/glass-product/glass-product.mp4 24 0`（末位 0 = 颗粒 grain 0） |
| 编码器 | `h264_nvenc`（本地 GPU；日志 [5] 段确认 nvenc，fps 24，workers 6） |
| 音频入口 | `python demo/music/score.py`（numpy 原创配乐）→ `python demo/mix.py`（拟音 + 人声 + ducking） |
| 字幕入口 | `python demo/subs.py` + `python core/render/srt.py demo/cues.json styles/glass-product/glass-product.srt` |
| 事件导出 | `node core/render/events.mjs styles/glass-product/demo`（本次导出 events 31 条 / dur 32） |
| 本风格专属参数 | 2× 超采样；每帧 `pmrem.fromScene(env,0,1,1000)`（销毁上一张 RT）；`Neutral` 色调映射（**不能用 AgX**，会把强调色洗白）、exposure 1.1；bloom 0.16–0.3 且只在 >1.1 时生效；grain 0 |
| 一键复现 | `sh styles/glass-product/demo/build.sh`（6 步：TTS+ASR → 配乐 → 事件+混音 → 渲染 → 混流+字幕 → 成片自检） |

---

## 10. 编排规则

- **内容文件字段契约**：`demo/story.js` 是**唯一真值**，导出 `BPM / BEAT / BAR / DUR`、`T`（关键时间点）、`SHOTS / shotAt`、`KICKS`、`MACRO_SWEEPS`、`VO`、`SFX`；`demo/lines.json` 每行 `{id, text, voice, speed}`（demo 用 `am_michael`、speed 0.86–0.88、4 短行）；`demo/cues.json` 供自检。页面契约 `window.READY / window.render(t) / window.DUR`（`style-dna:191`）。
- **事件词汇表**：`sweep{d,pan,v}` / `slide{d,v}`（玻璃翻盖摩擦）/ `tock`（翻盖到位）/ `click{v,pan}`（磁吸）/ `lift{d,v,pan}`（浮起）/ `puff{v,pan}`（零件气流）/ `slowwhoosh{d,v}` / `revwhoosh{d,v}`（静默里的反向呼啸）/ `snap{v}`（合拢 = click 簇 + 玻璃和弦）。全部由 `story.js` 的 `SFX` 声明，再由 `core/render/events.mjs` 序列化成 `events.json`（`style-dna:195`）。
- **时间线契约**：`story.js` 的 `frame(t)` 在 `main.js` 里按 `shotAt(t)` 分镜布景、相机、光与脉冲、磨砂字幕、标题、片尾卡。**配乐与渲染器共用同一份 kick / hit list**——先写 cue 表再动手（`DEMO.md:80`）。
- **新增主体怎么接入**：替换 `product.js` 里的几何，保留材质工厂（`glass({...})` / `frosted({...})` / `metal(color,rough,{...})` / `guideMat(wrap)`）与 `explode(bud,e,spin)`，保留 `studio.js` 的 `makeStudio(renderer,scene)`（`style-dna:183-186`）。
- **换主题时要改哪些文件**：① `demo/product.js` —— 换物件几何（唯一必须动的）；② `demo/story.js` —— 换 BPM 网格上的镜头表 / kick 表 / 光扫表 / `VO` / `SFX`；③ `demo/lines.json` —— 换旁白文案与声线；④ `demo/music/score.py` —— 若要改调性/音色（demo 是 120 BPM / F 小调）；⑤ 强调色族定义（demo 在 `product.js:6-7` 与 `studio.js` 的强调色卡）——冰蓝 `#62DCFF` → 淡紫 `#A98BFF`。**不需要动** `studio.js` 的影棚骨架、`mix.py` 的拟音骨架、`main.js` 的分镜调度骨架。
- **与 `dub.mjs` 通路的关系**：`dub-styles.json#glass-product` 是**派生条目**（`derived: true`，从 `lib/dub-visual.json` 的 palette + `STYLE.md §4` 的字幕 px + WCAG 对比度规则推出），能生效的参数有：`palette`（bg `#000000` / fg `#ffffff` / accent `#62dcff`）、`bgRecipe`（`solid`，`texture: pbr-glass`，vignette 0.35）、`subtitle`（DengXian、字号因子 0.03704、marginV 0.14537、marginL 0.06019、无描边、居中）、`title.fontSizeFactor 0.12`、`overlay.accentRule: true` / `progressBar: false`、`motion.subtitleFadeIn 0.16` / `chapterTransition: "expand"`。**注意**：这是派生值，字号/位置由 px÷1080 归一而来，知识库更新时应优先用代码抽取值替换。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **响度微偏**：实测 −13.7 LUFS（`ebur128`）、真峰值 −1.62 dBTP（`loudnorm` `input_tp`），与 mux 目标 −14 LUFS 差 0.3 LU（真峰值 −1.62 dBTP 在 −1.2 dBTP 交付线内）。原因是 808 峰值留白不足——demo 自己踩过这个坑：808 峰值让 loudnorm 掉进 dynamic 模式（−13.7 LUFS），在混音里把 drop 峰值限掉 ~3 dB 才修好（`DEMO.md:45`）。
- **【已修】9:16 曾不可用**：原记「`style.json` 无 `aspects` 声明，只有 16:9。产品默认 9:16 下会丢右侧 43.75% + 下方整片黑，标题与字幕居中锚点全部跑偏（详见第 2 节末段）」。**2026-10-04 已修**：新增 `demo/film.js` 声明 `FILM_META.aspects = ['16:9','9:16']`；`main.js` 把 3D 画布与 `#ov` 一起按 `S = min(FX, FY)` 等比装入当前帧（设计帧外留背景色 `#000`，黑影棚 ⇒ 看不出黑边）。3 帧 16:9 md5 与改造前完全相同；9:16 实测不裁切、不变形，主体与字幕完整（见第 2 节子段）。
- **`.srt` 与成片可能不同步**：本次字幕走的是 `demo/subs.py` + `core/render/srt.py` 从 `cues.json` 重新生成，日志显示「字幕已从 cues.json 重新生成」，这一步是通的；但注意 `dub.mjs` 通路走的是另一套字幕生成器，两条通路产出的 `.srt` 不保证一致。
- **本 demo 无 `voice_fx.py` / `voice.py`**：出片日志 [配音 1/1] 明确写「该 demo 无 voice_fx.py/voice.py，按它自己 build.sh 的写法直接输出」——即旁白是 TTS 直出，没有做 EQ / 压缩 / 空间化处理。换主题若需要「发布片级」的旁白质感，需要自己补一层。
- **细纹理 `textureRaw: pbr-glass` 声明了但渲染未实现**：`lib/dub-styles.json#glass-product.bgRecipe.textureRaw` 是 `pbr-glass`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `none` ⇒ 落空（该风格粗粒度没有纹理层）），**不读** `textureRaw` ⇒ `pbr-glass` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `pbr-glass` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口
- **无外部图像/视频素材缺口**：影棚、物件、材质、配乐、拟音全部程序化生成。
- **字体缺口**：`STYLE.md:33` 点名 Inter Tight，本机无此字体；`dub-styles.json#glass-product` 回退 `DengXian`（等线）。等线是几何无衬线，接近但**不是** Inter Tight 的 ultra-thin 气质，标题的 200 字重与 56–64px 宽字距会明显失真。
- **字体文件位置**：demo 自带 `demo/fonts`（`DEMO.md:65` 提到 `demo/fonts` 与 `demo/CREDITS`），换机器需确认这两个目录跟着走。

### 能力限制
- **算力很贵**：768 帧含 2× SSAA + transmission + 每帧 PMREM + 地板镜像，`DEMO.md:84` 给的是 M 系列 Mac 上 **30–45 s/帧**；本机实测 333s 渲完 768 帧（6 workers，nvenc），即约 0.43 s/帧——因为渲染跑的是 Windows GPU 路径而不是 WSL 的 CPU 路径。**不要并发起两个渲染**。
- 只适合 30–40s 单物件短片；信息密度撑不起数据表、多栏文字、多角色。
- 每帧重建 PMREM 是硬要求，删掉它玻璃的高光/折射就不会物理移动，风格立刻塌。

### 踩过的坑（本机实测）
- 出片命令是 `node lemo-make.mjs glass-product --skip-sync --no-preflight --ratio 16:9`——**跳过了两份库同步与预检**，所以 `--ratio 16:9` 是手动补的；如果漏掉这个参数，产品默认会渲成 9:16 并踩上面那条缺陷。
- 日志 [2] 段显示 `--skip-sync` 下 `styles/paper-popup/demo/node_modules` 走的是 junction 指向 `D:\lemo-opuscar\node_modules`——**跨风格共享 node_modules**，动它会影响别的风格。
- 音频与渲染是**并行**完成的（日志：340.0s），总耗时 355.4s。
- ASR 校对：4 行全部 OK，`mismatches: 0 (lang=en, model=base.en)`。注意 `Every part, in plain sight.` 被 ASR 回读成 `Every part in plain sight.`（丢了逗号）仍判 OK——**ASR 对英文标点不敏感**。
- demo 道具层的具体坑（`DEMO.md:88-93`）：青色灯条塞进磨砂底座会把整个壳体染成青绿 → 改成冷白暗碟；光纹的 idle 辉光被透镜穹顶放大成淡蓝团；悬浮耳机正面看像蘑菇、盖子平放像锅盖 → 改 3/4 视角 + 盖子立在后方；第二只耳机原本「从地板下升起」会穿过可见地板 → 改成从侧面飞入。

### 下次迭代优先补什么
1. 把 drop 段的 808 峰值再限 1–2 dB，把实测响度压回 −14.0 LUFS。
2. 竖屏（9:16）**已适配**（设计帧等比装入 + 同色留白，见第 2 节子段）；若要更满的画面，可补**相机重取景**那一档——需同时处理地板 Reflector、背景 sweep 与焦散的屏幕采样。
3. 补 `voice_fx.py`，给旁白加低切 + 轻压缩 + 一点短混响，贴近「发布片旁白」质感。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/glass-product/glass-product.mp4`（32.00s / 19.6MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/glass-product/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **91/100**（2026-10-05 校正：原 92，新增「textureRaw 细纹理未实现」缺陷，palette −1） |
| 详细资料 | 有：`styles/glass-product/STYLE.md`、`DEMO.md`、`demo/build.sh`、`style.json`、`lib/style-dna/glass-product.md`、`lib/style-dna/glass-product.json`、`lib/dub-styles.json#glass-product`、`_distill/logs/glass-product.log`、demo 源码（`story.js` / `studio.js` / `product.js` / `main.js` / `music/score.py` / `mix.py`） |

**逐帧拆解要点**（24 帧覆盖 32.0s，约 1.33s/帧）：

- **f01**（≈0.7s）：几乎全黑，只有底部一条极暗的物件剪影和右上一道细弧光——正是「开场只看轮廓、不看内容」。画面 90% 以上是黑，符合无限黑影棚。
- **f03**（≈2.7s）：`AURA` 超细字重标题 + `A GLASS PRODUCT FILM` 小号全大写 kicker 出现在上三分之一；物件仍在暗处，标题是唯一亮物。标题与物件同框但层次分明。
- **f05**（≈4.0s）：开盖镜位。盖子掀起、两只耳机躺在黑色壳体里，整体仍是暗部；只有灯条在盖沿和壳体边缘拉出细白轮廓线——**没有地平线**，壳体下缘直接融进黑里。
- **f07**（≈6.7s）：微距。耳机镜面朝镜头，同心纹理 + 厚玻璃边缘的**彩虹色散**清晰可见；画面下方出现磨砂玻璃字幕条 `Nothing to hide.`——单行 16 字符，居中，条身是模糊画面填充的圆角矩形。
- **f09**（≈9.3s）：3/4 视角耳机，蓝→紫的边缘光开始出现；字幕已消失（该行在 10.494s 结束，本帧接近尾）。背景仍是纯黑，只有左侧一条极暗的深灰径向 sweep 把玻璃边缘从黑里托出来。
- **f11**（≈12.0s）：**爆炸视图**。零件沿一条约 40° 的对角轴散开，近大远小，跨度约 80% 画幅，形成明显的斜向纵深。字幕 `Every part, in plain sight.`（27 字符，全片最长的一行）出现在下方。
- **f13**（≈14.7s）：单只耳机悬在黑色中，紫/蓝边缘光最饱和的一帧；下方地平位置已能看到焦散环的弧。此处接近爆炸段末尾，静默即将开始（15.5–16.0s 实测 −999.0 dB）。
- **f15**（≈17.3s）：**drop 之后的微距**。螺旋导光通道几乎填满画幅，中心是一个白色高亮点——「声音变成光」这件事第一次被看清楚。蓝紫光纹从中心向外辐射，是「在同一个机位里因果同时发生」的那一帧。
- **f17**（≈19.3s）：两只耳机并排悬浮，**地板焦散环**清晰：多圈同心扩散环 + 扭曲的细丝纹理。字幕无。这是 `DEMO.md:32` 说的「最值得记住的镜头：声音在地面上扩散」。
- **f19**（≈21.3s）：正面英雄镜。两只耳机都亮着，壳体磨砂底座开始发亮（看起来偏浅灰/白），上方已能看到很淡的 `AURA` 与 kicker 在浮出——标题与物件同框的过渡帧。
- **f21**（≈23.3s）：`AURA` + `Hear the light.` 完整标题卡，两只耳机各自带蓝/紫光晕，底座白亮，地板焦散环仍在。
- **f24**（≈32.0s）：片尾卡。标题保留，底部叠出 `GLASS PRODUCT RENDER / LemoLab × Claude Opus 5.5` 小字，画面边缘压着柔和暗渐变——对应 `DEMO.md:61` 的「镜头拉远给 credits 让位，最后 0.6s 淡到黑」。

**全片色走**：从 f01 的纯黑 → f05 的黑 + 白轮廓 → f07/f09 引入冰蓝 `#62DCFF` → f13 漂到淡紫 `#A98BFF` → f15 蓝紫饱和峰值 → f21/f24 回落到黑 + 冷白标题。**冷色相在片内单调递增再回落**，与「暗→亮→暗」的弧线一致。中性色（黑白灰）全程不变。

**节奏观察**：f01–f05（0–4s）三帧几乎无位移，是刻意的「慢」；f07–f15（6.7–17.3s）每帧画面都在大变，是信息密度最高的一段；f17–f24（19.3–32s）回到稳定构图，只有光和字幕在动。**没有一帧是锁死机位**——每一帧的透视角度都不同。

**自检发现的缺陷**：① 实测 −13.7 LUFS 与目标 −14 差 0.3 LU；② 9:16 无适配（★ 2026-10-04 已修，见下）；③ 本机无 Inter Tight，dub 通路回退 DengXian；④ 本 demo 无 `voice_fx.py`，旁白为 TTS 直出。

**本次为补齐短板做了什么**：**画幅上做了一处改动**——新增 `demo/film.js` 并改 `demo/main.js`，把影片改造为支持 9:16（设计帧整体等比装入当前帧 + 同色留白；16:9 逐字节未变），见第 2 / 9 / 11 节。**其余源码未动**；响度与 `voice_fx.py` 两条短板仍如实记录在第 11 节，留给下一轮迭代。
