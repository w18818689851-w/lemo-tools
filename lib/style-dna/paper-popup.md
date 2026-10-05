# 纸片立体书（paper-popup）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Papervale》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一个真书桌上的立体书变成一个舞台：扁平的剪纸演员（带白边）在从书页弹起的纸布景前表演，在真实的灯光和真实的微距镜头下——一个画面里两个世界。

**它不是**：剪纸剪影片（没有单色蕾丝、没有背光）、3D 卡通（没有圆雕的东西）、黏土动画（纸是铰链、折、卷、滑，它从不被捏软）。
（`STYLE.md:3`、`STYLE.md:8-12`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「真实书桌上的纸」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **两个世界，一画面** | **真实世界**（人尺度）：HDRI 房间照亮的写实表面 + 真木/织物 + 几件 CC0 道具 + 一支微距镜头。**纸世界**：那房间里的一本精装书；打开时封面立起来当**背景**，下页是**地面**。 |
| **真实单位（米）** | 书页 0.3–0.5m 宽（demo 0.44 × 0.30），演员 3–5cm（Pip 高 0.036），相机近平面 0.004m。所以 HDRI、阴影、景深像真实微距拍摄。 |
| **剪纸收尾** | Canvas2D 美术 + 深墨描边；剪影被**膨胀**（在三个环 r、.66r、.33r 上多角度画、再 `source-in` 重上色）成一条略微下移（1.5px）的灰卡纸边 `#b9ad9c`（厚 border + 2.5px）和一条宽米白边 `#fffdf7`（12–16px；静态道具 14px、角色 16px，5200 px/m）；上面叠共享纸纹（512²、alpha .5–.85、`source-atop`）。 |
| **绘制** | 一种深棕墨 `#3a2a24`（**绝不是黑**），粗描边 9px（`LW`）+ 细细节线 5px（`LW2`），圆接头；明暗 = 一个硬**月牙**（填暗色、偏移后重填底色）；形状抖动（低谐波噪声），绝不用完美几何；脸简单（大黑椭圆眼 + 两个白高光、弯嘴、粉脸颊）。 |
| **弹起件** | 正面有美术、背面是素纸的平面（同一 alpha，背面用 `onBeforeCompile` 换成纸色）；`alphaTest .5` + `alphaToCoverage`；一个带 alpha 贴图的 `customDepthMaterial`，所以**影子就是剪纸的剪影**。任何「3D」都是几片扁平卡（前/后层、铰在龙骨上的三角）。 |
| **书是建模的** | 布面封面 + 烫金标题（roughness/metalness 贴图）、带边线的书页块、一张卷曲的书页（`setLeaf` 40 段条带、沿长度积分弯曲）。书脊在远端，封面向后翻到 90° 立起来当背景。 |
| **真实世界** | HDRI 环境（demo 用 lythwood_lounge_2k.hdr，模糊度 .22）+ 柔和模糊背景、真木或织物、几件 CC0 道具（台灯、茶杯、闹钟、铅笔、盆栽）。**Neutral tone mapping**（ACES 会移动纸的颜色）。 |
| **景深手工做** | `CoC = aperture × (1/focus − 1/z)`，螺旋 gather 让远处采样不落在锐利前景上（现成 bokeh 在这个尺度看起来很假）；然后轻 bloom、暗角、暖。 |

**关键取向**：卖点在**尺度和材料的错配**——扁平的、饱和的、描边的纸卡通在真实光照下投出剪纸形状的影子、在真实的镜头虚化里变软。保留纸的平面感，让光和镜头把它变真（`STYLE.md:16-22`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：第三人称的温暖说书人，图画书句子。角色气泡是第一人称短句。

**长度（实测）**：旁白字幕底部居中，约 40px，奶油色 + 粗深棕描边 + 柔和阴影，第二语言小一号在下面。停留 ≥ `max(1.8s, 语音 + 0.6s)`。demo 15 行旁白（2–9s），写成图画书的样子（`"The cardboard hills. The paper sun on its wooden stick."`）。气泡 **30 字符/秒**打字，隔一个字母一个 blip。

**句首类型**（示例性，不是抄原文）：
- 图画书式场景设定：`On a quiet desk, in a quiet room, …`
- 转折：`Until one evening… somebody did.`
- 介绍角色与地点：`Inside, in a land made entirely of paper, lived a little sprite named Pip.`
- 推进：`So Pip set off, through …`
- 直到：`until they reached the very last page.`
- 收尾：`The end? Or maybe… just the beginning.`

**这个风格里不会出现的句式**：
- 长句、从句（每句都像图画书的一行）
- 抽象名词、说教
- 把同一批字做两遍（气泡里的字不做字幕）
- 发音与显示文本混为一谈（发音版放 `tts/lines.json`，显示版放 `story.js`）
- 中文字体子集漏字（要重新子集化，并把拉丁字体放进 font stack）

（`STYLE.md:35-39`、`story.js:2-49`）

---

## 3. 叙事节奏

**结构**：

```
真实书桌建立（10s）
  → 书打开
  → 第 1 章 家乡世界 + 主角的愿望（页外的光）
  → 第 2 章 一个障碍角色，被踩倒、然后被帮（抚平），变成同伴
  → 第 3 章 一段有笑点的旅程（鲸鱼喷彩纸）+ 一次日→夜翻板
  → 最终章：空白的最后一页、害怕、"Here goes!"
  → 同伴接住主角，他们飞出书页飞过书桌
  → 落地、揭示、"Hello, big world!"
  → 在桌上出片尾标题 "The End?"
```

**全部 on ones（60 fps，适合平滑的微距相机）**，一切都是 `t` 的纯函数。

| 层 | 停留/运动规则 |
|---|---|
| 弹起 | `back(seg(t, t0, t0+.55), 1.7)` |
| 每件的延迟 | `(.3 − z) × 1.2` 秒（在它跨页的 `RISE` 之后） |
| 弹起朝向 | 靠后的件向后躺（`dir −1`），其它的向前脸朝下折（`dir +1`） |
| 摇 | 绕底座 `sin(1.6t + phase) × sway`（0.01–0.08 rad） |
| 角色姿态 | **量化到 1/40**；眨眼每 3.7s |
| 走 | 腿 `sin(phase)` 摆、弹 `|sin(phase)| × 1.2mm`、手臂反摆；相位每半步前进 1.8cm |
| 翻页 | `book.setLeaf(u)`：40 段条带、`φ = θ·(1 − L·(s − ½))`、弯 `L = .55·sin(πu)`、用 `eio` 缓动 2.3s |
| 机关 | 四片天空翻板相隔 0.28s 翻；门用 `back()` 摆；河带每次旁白 "swish" 滑 ±12mm |

**总时长**：主 demo **133.0s**（`style.json` dur=133.0、frame_sec=26.6），1920×1080、60 fps。

**静默怎么用**：静默 = **书被按住不动、只剩房间底噪**；放在一次要紧的翻页之前，或一次犹豫。

（`STYLE.md:43-49`、`DEMO.md:44-51`、`style.json:16-17`）

---

## 4. 镜头逻辑

**镜头是什么**：一台虚拟**微距相机**，以 position / target / fov / aperture / focus 作为关键帧、用**单调三次插值**（`track`）；一份新的关键帧列表 = 一个硬切。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 平视微距轨道、浅景深 | 在演员的尺寸上置身故事里 | 一次行走；一段对话；一场追逐 |
| 拉起成跨页 3/4 视角 | 机关、地图 | 翻页；新场景；一个计划 |
| 从人高下降的 dolly | 进入书的尺度 | 一次抵达；推进到系统的一部分 |
| 推到脸上 | 感受 | 一个愿望；一次害怕；一个决定 |
| 从书内反向拍到模糊的房间 | 页外的世界很大 | 好奇；一个外部威胁；一个在读的人 |
| 纸 ↔ 真实物体的跟焦 | 纸与现实相触 | 因果；纸故事里的一件真实产品 |
| 跨页俯视 | 一个棋盘游戏、一张图解 | 一条路线；比较书沟两侧 |
| 拉杆上的锁定机位 | 机关就是事件 | 前后对比；一次计数 |
| 上升 crane 把书留小 | 尺度、距离 | 余韵；总结；时间流逝 |

**允许的转场**（必须来自书本身）：翻页、书合上再打开、落在纸声上的硬切。

**禁止**：在书内用视频溶解（dissolve）；甩镜（whip pan）；让近镜头前景的弹起件挡住镜头路径（会填满画面成一片模糊）。

（`STYLE.md:53-67`、`DEMO.md:29`、`DEMO.md:31-40`）

---

## 5. 表达习惯（idioms）

1. **书打开**：吱呀、封面摆上去、世界从后到前弹起。
2. **翻页 = 换场**：旧件折下、新件弹上；书内没有剪切。
3. **拉杆机关**：翻转板条、棍上的太阳、滑动的条、铰链门、线上的件。
4. **纸作为角色**：皱、抚平、重折、撕、贴。
5. **页的边缘**：在纸与房间之间穿越，两个方向都行。
6. **真实物体演一个角色**：台灯当太阳、杯子当塔。
7. **打字气泡和评分**。

（`STYLE.md:83-89`、`DEMO.md:14-21`）

---

## 6. 氛围

一个安静的、被台灯照亮的书桌，旁边一本打开的立体书；纸的颜色饱和、温暖，真实世界略暖而自然。整体是「睡前故事、玩具、微缩世界」的温暖与好奇，而不是戏剧性。

（`STYLE.md:26-31`、`DEMO.md:64-92`）

---

## 7. 声音

- **乐器**：玩闹的、原声或玩具般的——音乐盒、拨弦弦乐、单簧管、钟琴、尤克里里、玩具钢琴、刷子。选项：真实房间里用更暖的 cue；把一段库曲做**小节对齐的内部剪辑**，让它的结尾落在画面事件上；拉杆的咔哒设一个 cue 的脉冲。
- **纸 foley 是招牌**：翻页 swish、卡纸 thump、弹起 snap（短正弦扫频 + crinkle）、折与皱、拉杆 slide、脚步是小 tap + crinkle、板条 flap、落线 tink；书脊吱呀与合上闷响。全部从页面事件表合成。角色声音 = **打字 blip**（每个角色一个波形与音高范围，隔一个字母一个 blip）。环境床：房间底噪与一个时钟给房间，每个跨页一个床给纸世界。
- **混音规则**：人声高通、压缩、远高于音乐；音乐在语音下 duck、平滑释放；每通道限制 SFX；整体 **−14 LUFS**。静默 = 书被按住不动、只剩房间底噪。

（`STYLE.md:71-77`、`DEMO.md:55-60`）

---

## 8. 变化空间（可自由发挥）

你决定书、房间、角色（或没有）、跨页与机关、开场、结尾、镜头路径、每个跨页的色板。

`STYLE.md:109-113` 给了远离 demo 的三个方向：

- **结构**：其一「黄历」——每月或每阶段一个跨页，每个拉杆被留着一只动，书越翻越满；其二「两本面对面的书」——角色隔着缝交换物件；其三「一个跨页被反复拉」——每次拉是某个东西怎么做的一步。
- **开场**：翻到一半（一页已经在卷，我们落在第三章）；书沟里（沿折缝低看，第一件从镜头上方升起）；一个机关独自（一个拉杆在任何人出现前自己滑动）。
- **结尾**：书合上（件反向折回、一阵空气、静止）；一件留着（除了那张重点卡其它都折回）；书架（相机在这本书和许多书之间找到它）。

所有这些都必须守住同一条铁律：**扁平的纸卡 + 真实的灯与镜头**——让光与镜头把它变真，绝不用圆雕去假装真实。

---

## 9. 禁忌清单

- 用 `rotation.y` 转身——会让卡片侧面朝上、露出空白背面；用 `scale.x` 翻转。负缩放也会交换前/后材质 → 改画镜像道具。
- 单平面容器会藏住它的内容 → 后卡 + 前卡，内容夹在中间。
- 近镜头前景的弹起件会填满画面成一片模糊 → 移开或收小光圈。
- 矩形影子会毁掉错觉 → 每张卡用 alpha-mapped depth material；紧的 shadow bias + 大 shadow map 对抗薄卡片的 acne。
- 翻页时背光的一面会变黑 → `emissive map = colour map`。
- ACES 会移动纸的颜色 → 用 Neutral。
- headless Chrome 会退回软件 WebGL → GPU ANGLE flags；ES modules 需要 HTTP。
- 每帧重画角色画布 → 只在姿态变化（量化到 1/40）时重画。
- 中文字体子集漏掉新字与拉丁字形 → 重新子集化；把拉丁字体放进 font stack。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

（`STYLE.md:93-101`、`DEMO.md:102-109`）

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

新内容需要驱动：`story.js`（DUR、VO 旁白、BUB 气泡、CHAPTERS、CREDITS、OPEN、TURNS 的**唯一真值**）、`voices/dur.json`（每句时长）、`tts/lines.json`（发音版文本）。demo 里分别由 `story.js:2-49`、`voices/dur.json`、`tts/lines.json` 提供。

### 10.2 新画面主体的契约

- **新增一个跨页** = 页面美术（`sets.js` 的 `pages()`）+ 一块 `popper` 调用（新 spread 索引）+ 扩展 `RISE/FOLD/TURNS`。
- **新增一个角色** = 在 `art.js` 里画 + 在 `actors.js` 里加一个 `makeX`（返回 `{root, pose(p)}` 之类的接口）。
- 所有弹起件用 `cutMesh(item, {s, backCol, shadow, tex})`（`cutmesh.js:18-26`）。

### 10.3 时间线契约

`story.js` 是时间线唯一真值；页面契约 `window.READY` / `window.render(t)`（逐帧确定）/ `window.DUR` / `window.EV`（`main.js:442`、`main.js:448`、`main.js:553`）。`render.mjs events` 把 EV 导出成 `events.json` 供 `mix.py`。

### 10.4 事件词汇（`type` → 消费者）

demo 导出 **250 条**事件。在 `mix.py` 的 `G` 表里逐类增益：

| type | 含义 |
|---|---|
| `creak` | 书脊吱呀 |
| `thump` | 合上闷响 |
| `pop` | 弹起 snap |
| `swish` | 翻页 |
| `door` | 门吱呀 |
| `boing` / `hop` / `roll` | 弹跳/跳/滚 |
| `footstep` | 小 tap + crinkle |
| `bang` | "!" |
| `stomp` | 跺 |
| `nice` / `great` | arpeggio |
| `sparkle` | 铃 |
| `poof` / `fold` / `whoosh` | 烟/折纸/掠风 |
| `splash` / `spout` | 水花/鲸喷 |
| `clack` / `tink` | 板条/星落线 |
| `switch` | 台灯 |
| `chord` | 暖和弦 |
| `skid` | 落地滑 |

（`DEMO.md:163-229`）

---

## 11. 构建链（复用机制）

```
story.js（时间线唯一真值：DUR / VO / BUB / CHAPTERS / CREDITS / OPEN / TURNS）
  → render.mjs events        # EV → events.json
  → mix.py                   # 事件 → 分轨声音（纸 foley / blip / 环境床 / 音乐 duck）
  → make_srt.mjs             # 字幕 srt
  → mux.sh                   # 出帧 → mux 到 −14 LUFS
  → shot.mjs / stills        # 剧照与海报
```

**关键机制**：一切运动都是 `t` 的纯函数（`window.render(t)` 逐帧确定），所以同一个 `t` 永远给出同一帧——这让「换一套 story.js + sets.js + art.js 重跑」成为可能，而不必改引擎。

（`DEMO.md:114-158`、`DEMO.md:163-229`）

---

## 12. 证据

```
styles/paper-popup/STYLE.md:3          一句话定义（立体书变舞台、剪纸演员 + 弹起布景 + 真灯真微距）
styles/paper-popup/STYLE.md:4          参考语汇与不可复制项
styles/paper-popup/STYLE.md:8-12       两个世界、尺度错配、不是什么
styles/paper-popup/STYLE.md:16-22      真实单位/剪纸收尾/绘制/弹起件/书/真实世界/手工景深
styles/paper-popup/STYLE.md:26-31      颜色逻辑（每跨页一个色族、强调色缝书、未完成页去色）
styles/paper-popup/STYLE.md:35-39      字体、字幕、气泡、纸标题、动作词、中文子集
styles/paper-popup/STYLE.md:43-49      运动质量（on ones、从后到前弹起、摇、姿态量化、scale.x 翻转、翻页、房间不动）
styles/paper-popup/STYLE.md:53-67      镜头词汇表、framing、转场（书内不溶解）
styles/paper-popup/STYLE.md:71-77      纸 foley、打字 blip、说书人、音乐、环境床、静默、混音
styles/paper-popup/STYLE.md:83-89      七个 native move
styles/paper-popup/STYLE.md:93-101     媒介陷阱（rotation.y/单平面/前景模糊/矩形影/ACES/headless/重画/子集）
styles/paper-popup/STYLE.md:109-113    变化空间（黄历/两本书/反复拉 + 开场/结尾）
styles/paper-popup/DEMO.md:3           不要复用它的故事/叙事弧/镜头/道具/时长
styles/paper-popup/DEMO.md:5           demo 名与 133.0s / 60fps / 引擎
styles/paper-popup/DEMO.md:10          一句话故事
styles/paper-popup/DEMO.md:14-21       六个 native power 的故事用法表
styles/paper-popup/DEMO.md:23          demo 故事形状
styles/paper-popup/DEMO.md:25          当时建议的改编方式
styles/paper-popup/DEMO.md:29          单虚拟微距相机 + 单调三次插值 + 新列表=硬切
styles/paper-popup/DEMO.md:31-40       逐拍镜头表（建立/开书/书内/翻页/情绪近景/页边缘反向/飞出/结尾）
styles/paper-popup/DEMO.md:44-51       运动数值（弹起/摇/角色姿态/跳/翻页/机关）
styles/paper-popup/DEMO.md:55-60       旁白/角色 blip/音乐（含小节对齐剪辑）/音效/环境床/混音
styles/paper-popup/DEMO.md:64-92       尺度、书桌、剪纸收尾、绘制、色表、弹起件、字体、标题字幕
styles/paper-popup/DEMO.md:96-98       片尾卡与签名
styles/paper-popup/DEMO.md:102-109     实测坑（单平面船/前景模糊/混音 bug/阴影设置/headless/Poly Haven/字体子集/重画）
styles/paper-popup/DEMO.md:114-158     模块图与构建步骤
styles/paper-popup/DEMO.md:163-229     引擎参考（坐标/API 表/页面契约/最小跨页示例/换片步骤）
styles/paper-popup/demo/story.js:2-49        DUR=133.0、VO 15 行、BUB 6 条、CHAPTERS 4 章、CREDITS、OPEN、TURNS
styles/paper-popup/demo/lib.js:3-44          clamp/lerp/seg/ss/eio/eo/ei/back/spring/mulberry/hash/vnoise/TAU
styles/paper-popup/demo/lib.js:18-36         monotone() 单调三次插值（Fritsch–Carlson）
styles/paper-popup/demo/lib.js:38-42         track() 多维关键帧（相机、飞行路径）
styles/paper-popup/demo/lib.js:44            env() 0→1→0 包络
styles/paper-popup/demo/cutmesh.js:6-15      mats() 前/后/深度三材质（背面换纸色）
styles/paper-popup/demo/cutmesh.js:18-26     cutMesh() 剪纸网格（原点=锚点）
styles/paper-popup/demo/cutmesh.js:30-39     blobShadow() 软圆影子贴片
styles/paper-popup/demo/cutmesh.js:42-45     thread() 细线（挂云/星星）
styles/paper-popup/demo/cutmesh.js:48-64     particles() 实例化粒子
styles/paper-popup/demo/paper.js:3           INK 深棕墨 #3a2a24
styles/paper-popup/demo/paper.js:8-21        makeGrain()/GRAIN 纸纤维纹理
styles/paper-popup/demo/paper.js:24-33       paperFill() 大面积纸张（颜色 + 斑驳 + 纤维）
styles/paper-popup/demo/paper.js:36-50       finishCut() 外扩白边 + 纸板灰边 + 纸纹
styles/paper-popup/demo/paper.js:53-56       sh() 描边帮手
styles/paper-popup/demo/paper.js:58-68       blob() 抖动椭圆路径
styles/paper-popup/demo/paper.js:70-80       smoothClosed()/smoothOpen()
styles/paper-popup/demo/paper.js:82-87       crescent() 月牙阴影
styles/paper-popup/demo/book.js:6-8          BW/BD/BT/HB/PG 尺寸
styles/paper-popup/demo/book.js:10-14        texOf() 画布→贴图
styles/paper-popup/demo/book.js:25-55        coverCanvases() 布面封面 + 烫金标题 + roughness/metalness
styles/paper-popup/demo/book.js:57-124       makeBook() 书（封面/书脊/页块/地面页/背景页/卷曲页/setOpen/setLeaf）
styles/paper-popup/demo/book.js:104-120      setLeaf() 40 段弯曲翻页
styles/paper-popup/demo/book.js:122          setOpen()
styles/paper-popup/demo/book.js:126-133      gutter() 书沟弯曲
styles/paper-popup/demo/main.js:188-193      walk()/arc() 位移与抛物线
styles/paper-popup/demo/main.js:196-339      pipState()/crumpleState()/foldState() 编排
styles/paper-popup/demo/main.js:344-403      SH 相机关键帧与 SHOTS（track 插值）
styles/paper-popup/demo/main.js:404-410      camAt()
styles/paper-popup/demo/main.js:411-426      lightsAt()
styles/paper-popup/demo/main.js:427-442      EV 事件表 + window.EV/DUR
styles/paper-popup/demo/main.js:448-550      window.render(t)
styles/paper-popup/demo/main.js:551-553      window.DBG / render(0) / READY
styles/paper-popup/style.json:16-17          frame_sec 26.6 / dur 133.0
```
