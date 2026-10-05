# 低多边形等距小岛（lowpoly-island）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Island That Grew》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一个用**正交等距**镜头看的**微缩世界**：一切是平面着色的低多边形几何块（六边形地块柱、箱体房子、棱柱屋顶、锥体与二十面体树），浮在带面片的海面上；没有透视、没有地平线，远处融进屏幕纵向的天空渐变。**光就是唯一的时钟**，每一块出现的东西都带一次弹跳和一个音符。

**它不是**：体素游戏（方块的方块、像素贴图）；真实景物的移轴摄影（有透视、有照片细节）；平滑着色的 3D 卡通（圆滑法线、次表面散射）。
（`STYLE.md:8-10`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「一块被造出来的低多边形几何体 + 一盏会移动的光」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **几何基底** | 尖顶六边形柱 `CylinderGeometry(r, r, h, 6)`；轴向→世界 `x = √3·(q + r/2)`、`z = 1.5·r`。 |
| **高度即材质** | 沙滩 0.36–0.42、草地 0.74–0.9、丘陵 1.1–1.4、礁石顶 1.95。 |
| **防 z-fighting** | 侧柱顶面沉到顶帽之下 **0.1**；地块之间留 ~1.5% 缝，让 AO 画出接缝。 |
| **道具全图元** | Box（房体/烟囱/木板/夹扁船壳）、三棱柱双坡屋顶 + 山墙、低段圆柱/圆锥、`IcosahedronGeometry` detail 0（树冠/花/浮标灯）、3 边锥（棕榈叶）。发光件各自独立材质以便逐盏点亮。 |
| **材质统一** | `MeshStandardMaterial({ flatShading: true, roughness: .88, metalness: 0 })`，**全程无贴图**；每块地按 hash 抖动明度 ±4%。 |
| **海面** | 220×220 单位 / 200×200 段的非索引平面，顶点在 shader 里叠四组正弦位移（幅度 ~0.2），`flatShading` 让每个三角面各自反光；下方一层 5000 单位粗平面（y −0.55）供拉远。 |
| **浅水泻湖图** | 每帧用 Canvas2D 按已升起地块画模糊圆斑，`deep → shallow` 混色 + 一圈淡浪花边；覆盖范围 64 世界单位。每块地水线一条 0.99–1.12r 半透明环。 |
| **无地平线天空** | post 里先 `orthographicDepthToViewZ` 线性化深度，再按屏幕纵向渐变把远处像素融进天空色；雾起止 = frustum 高度 × cot(俯角)，保证任何缩放下地平线带都停在上三分之一。星星是哈希网格 + 闪烁，只在雾浓处出现。 |
| **后期链** | MSAA + 深度 → **GTAO**（强制：画地块接缝与屋檐下）→ 天空/雾 + 星 → 画面上下两端极轻移轴 → bloom（夜里更强）→ 粉彩调色/暗角/夜蓝抬升 → Neutral tone mapping。整片 2× 超采样。 |
| **光束** | 一条面向相机的 ribbon，横向高斯剖面、根部亮远端淡；再叠一条放宽 **2.4×**、强度 **0.32** 的 halo；被照到的水面由同角度亮带 + 逐面片高光闪烁点亮。 |

**关键取向**：`STYLE.md:8` 强调「距离溶进屏幕渐变，所以世界看起来像一块悬在颜色里的模型」——**没有任何一条边线描边、没有纯黑**，阴影与 AO 是唯一的暗。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一个安静的说书人，像在给孩子读绘本。第三人称，过去时为主（demo 用 `Once…` / `Then…` 的寓言时态）。

**长度（实测）**：极短。demo 5 句共 **27–47 字符**（`Once, the ocean knew only one note.` 34 字符；`Far away, another island hears its first note.` 47 字符）。字幕单行、居中、距底 118px、无底框；停留 ≥ `max(1.8s, 语音时长 + 0.6s)`，不得与下一句或片名重叠。

**句首类型**（示例性，不是抄原文）：
- 寓言式开场：`Once, the …`（把世界放回时间之前）
- 下一步推进：`Then, the …`（一个新动作开始）
- 时间 + 集体名词：`By evening, every house …`（一整个群体一起变化）
- 转折句点出缺口：`But one … was still missing.`
- 尺度 / 回声式收尾：`Far away, another …`

**这个风格里不会出现的句式**：
- 数字清单式口播（生长本身已经在数数，话不必再数）
- 感叹号堆叠、营销话术
- 抽象概念当主语（只谈能被造出来的实物、部件、位置）
- 一句塞两个以上信息点（每句只承担一层）
- 与主题音同的字：片子讲音符时 `sea` 会被听成 `C`，所以旁白说 `ocean`（`DEMO.md:43`）

---

## 3. 叙事节奏

**情感弧**（demo 的读法，只是一种）：

```
空世界（只有一样东西）
  → 第一块地 / 第一个音
  → 加速生长（转盘 + 近景穿插）
  → 生活化的一天
  → 黄昏
  → 夜（缺口出现）
  → 最后一块点亮（高潮）
  → 纯正交拉远（尺度揭示 + 与开场同一音的回声）
```

**时间挂在 96 BPM 网格上**：1 拍 = 0.625s，1 小节 = 2.5s；律动第 0 小节从**第一块地升起（6.25s）**开始计。

| 层 | 规则 |
|---|---|
| 生长事件 | 按最小格排，**一块一格**：地块先 2 分音符 → 4 分 → 8 分；房子部件占 16 分格；细节接在下一个 16 分格、须在白天切换前收完 |
| 灯塔光束 | 一圈 **12 拍**（=3 小节），每拍扫过第 2 圈一格；每命中一格亮一盏窗、响一个音 |
| 转场 | 硬切；一天中的天色变化；穿过天空的缩放 |
| 字幕 | 停留 ≥ `max(1.8s, 语音 + 0.6s)` |
| 片尾 | 48.75s 起片尾卡，总长 53.0s |

**总时长**：主 demo 53.0s（`style.json`）。STYLE.md 未锁死区间——时长交给「生长事件数 × 网格密度」决定；事件越多、网格越密，片子越长。

**静默怎么用**：夜晚段降到一层低 pad 长音 + 海浪 + 蟋蟀，音乐几乎只剩持续音；高潮重拍之前，音乐总线最后半拍被压到**数字零**。静默不是停止，而是把节奏交给世界自己的事件。

---

## 4. 镜头逻辑

**镜头是什么**：一台**正交等距相机**——它不制造透视，frustum 高度就是变焦；它做的是「看一个模型」，把微缩世界悬在颜色里。相机永远离目标 ≥ **3× frustum 高度**，否则画面下缘会看到海面以下。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 转盘（方位角扫掠） | 从每一面看正在被造的东西 | 建造；检视；产品装配 |
| 纯正交缩放（改变 frustum） | 没有透视的尺度变化 | 语境中的细节；渺小；世界中的世界 |
| 改变俯角 | 低（20–25°）让天空带变宽；高（50°）像地图 | 夜与星；扫过整个世界；平面图 |
| 锁死 3/4 大全景 | 世界自己在活着 | 灯逐盏亮；延时；等待 |
| 对一次到位的近景 | 弹跳与水花 | 关键的一块；里程碑；包袱 |
| 侧角跟随移动体 | 横穿画面，永不冲向镜头 | 一次递送；出发；路线 |
| 沿一排地块横向移镜 | 一份清单、一个序列 | 步骤；时间线 |
| 相机不动、太阳扫过 | 光就是时间机器 | 一天；一季；历史 |

**允许的转场**：在拍点上硬切；一次天色变化；穿过天空的缩放。

**禁止**：溶解/叠化、划像等 UI 式转场；透视甩镜；改变 fov 或透视（**投影永不变**）。

---

## 5. 表达习惯（idioms）

1. **建岛即作曲**：每个落地的部件奏一个音；后面的光束按空间顺序把这些音重放成完整主题。
2. **程序化生长**：地块升起、楼层堆叠、树「啵」地弹出，全部带到位曲线。
3. **纯缩放做尺度**：一个物体占满画面，然后世界缩成一个点（或反过来）。
4. **转盘**：围绕正在被造的东西持续旋转，边转边长大。
5. **光作为时钟**：影子扫过、面片重新上色，用光讲时间而不切换场景。
6. **暗处的发光块**：灯一盏盏亮、光束像钟表指针扫过全岛。
7. **一件东西当一个动机**：一个由世界拥有的声音（钟/铃/号）在片尾以变化的形态回来。

---

## 6. 氛围

一块**悬在颜色里的微缩模型**：平静、通透、粉彩、大量留白。白天轻快凉爽，黄昏把地平线染暖，夜里除发光块以外一切都褪向蓝紫。整体是「耐心的、可爱的、可以一直看下去」的气质，而不是戏剧性或紧张。

---

## 7. 声音

- **乐器**：音高打击乐（marimba、kalimba、woodblock、bells、vibraphone、celesta、steel drum）；底下一层软 pad、一条温柔的 ostinato、轻 shaker 或软 kick；五声或调式材料，保证任何音符顺序都协和。**无钢琴、无弦乐。**
- **动作声（按材料分层，全部可合成）**：升起地块 = 气泡扫掠 + 水花 + 水滴嗒（越大越低）；楼层 = 木块敲 + 更轻的回弹敲（demo 第二次敲在首次后 0.21s）；屋顶 = 陶瓷咔嗒；码头木板 = 空敲；石块 = 闷响；灯室玻璃 = 叮；任何「开启」= 低频 whump + 电流嗡。环境床：低通棕噪海浪、海鸥（下滑 FM 啾声）、木料吱呀、夜里蟋蟀或风。
- **混音规则**：人声压缩、比音乐高约 10 dB；音乐在人声下 duck **−8 dB**；整体 **−14 LUFS**；**grain 0**（平坦色块会因颗粒闪烁）。配乐是**事件驱动**的：页面导出的每条生长事件都带 MIDI 音高，score 脚本在精确时刻合成它——**画面写出旋律**。

---

## 8. 变化空间（可自由发挥）

世界是什么（小岛、小镇、果园、工厂地面、一颗行星）、什么在长或变、色板（在颜色逻辑之内：一个地面族 + 一个中性岩石 + 一组重复的墙色/屋顶色）、开场、结尾、镜头路径、节奏。

`STYLE.md:102-106` 给了远离 demo 的方向：
- **结构**：**侵蚀**（先给完成的世界，再一块块失去，每次移除是一个下坠的音，直到只剩必要的一块）；**两个世界**（并排隔着空隙互相交换部件，直到连起来）；**一年四季**（世界固定不动，靠调色关键帧和光讲完一整年）。
- **开场**：**半建成**（忙碌的半成品，许多部件已在落）；**从上方**（俯视地图向下倾入等距）；**先给完整世界**再推进到其中一块地。
- **结尾**：最后一块部件落地的**近景、不回拉**；**世界被收走**（部件飞起叠进一个盒子）；**天亮**（晨光淹没世界，音乐在第一个被照亮的面上解决）。

三条铁律在任何变体里都成立：每件出现的东西都带一次弹跳和一个音；一块网格里只落一件东西；投影永不变。

---

## 9. 禁忌清单

- 在共享 post 代码里用 `perspectiveDepthToViewZ`——正交相机必须用 `orthographicDepthToViewZ`。
- 任何贴图、位图纹理或体素堆叠。
- 平滑着色（圆滑法线、次表面散射）。
- 边线描边、纯黑（阴影与 AO 是唯一的暗）。
- 一个网格格里落两件东西（会糊掉旋律）。
- GTAO 把 sprite 与半透明物体当实心方块渲染——必须在 AO pass 里隐藏它们。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容需要驱动的东西

影片标题（片名/副题/片尾卡文字）、旁白行（`{id, text}`，单行 ≤ ~50 字符，配 voice/speed）、世界参数（岛形/道具清单/调色板）、生长日程（事件时刻 + MIDI 音高）、天色关键帧、镜头段表、credits。

demo 里这些分别由 `story.js` 的 `T/VO/CHORDS/SKY/SHOTS/CREDITS`、`world.js` 的 `EVS`、`lines.json` 提供。

### 10.2 新「世界 / 主体」模块的契约

必须提供三样：
- **布局函数**：返回地块数组，每块含 `{q, r, x, z, h, type}`（对照 `buildLayout`）。
- **道具工厂**：返回 `{ root, parts[] }`，每个 part 带自己的 `t0`（到位时刻）与 `kind`（`floor`/`roof`…）（对照 `makeHouse`）。
- **生长日程 `EVS`**：每条 `{ t, type, note?, ... }`，且每件可动件必须有 `t0` 与一条到位曲线（`dropY`/`popS`）。

### 10.3 时间线契约

时间线模块（`story.js`）必须导出 `DUR`、`BPM/BEAT/BAR`、`bar(n)/beat(n)`、`G0`、`T`（段落秒表）、`VO`、`SHOTS`、`shotAt(t)`。

页面契约由 `main.js` 暴露 `window.render(t)` / `window.DUR` / `window.EV` / `window.READY`。渲染入口 `render(t)` 负责插值天色、算相机、更新海面 uniform、调 `world.update` 与 post、最后画 HUD。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者 |
|---|---|---|
| `rise` | 地块升起 | 配乐（带 note）+ 水花 foley |
| `pop` | 树/灯/细节弹出 | 配乐 |
| `floor` / `roof` | 楼层落下 / 屋顶落定 | 木块敲 / 陶瓷咔嗒 |
| `plank` | 码头木板落水 | 空敲 |
| `splash` | 小船落水 | 水花 |
| `window` | 窗点亮 | 配乐（软 kalimba） |
| `ring` / `lamproom` | 灯塔环 / 灯室 | 石块闷响 / 玻璃叮 |
| `ignite` | 灯塔点亮 | 低频 whump + 电流嗡 |
| `beamhit` | 光束扫到一格 | kalimba 主音 + marimba 八度 + 铃 |
| `boatbell` / `bell` | 船答铃 / 浮标钟 | 钟铃（单一动机音） |
| `chord` / `sparkle` | 和弦 / 花点缀 | 配乐 |
| `vo` | 人声 | 加载 voices/<id>.wav |
| `amb{what,d}` | 环境床（waves/gulls/mill/crickets） | 环境声 |
| `title` / `endcard` / `cue{name}` | 片名 / 片尾 / 段落提示 | HUD / 编排 |

配乐脚本按 `note` 在精确时刻合成；`check.py` 用 librosa 比对音频起音与音高是否与事件一致。

---

## 11. 构建链（复用机制）

```
styles/lowpoly-island/demo/
  story.js  时间线（96 BPM 网格）、VO、和弦、天色关键帧、shots
  world.js  六边形布局、全部道具、生长日程 → EV（带音高）、逐帧动画
  sea.js    面片波 shader、浅水泻湖图、光束照水
  post.js   正交后期：GTAO → 天空/雾 + 星 → 移轴 → bloom → 调色
  main.js   渲染器、灯光、逐段相机、HUD（片名/字幕/片尾）、EV 导出
  music/score.py  事件驱动配乐（+ check.py：librosa 起音/音高比对）
  mix.py    foley + 环境 + 人声 + ducking     subs.py  字幕 cue
  build.sh  一键重建
```

```
sh demo/build.sh
  # 1. still.mjs 出总览图 → sheet.py 迭代
  # 2. TTS → asr_check 直到全 OK
  # 3. events.mjs → score.py → check.py → mix.py
  # 4. video.mjs --fps 24 --workers 3（2× SSAA + GTAO）
  # 5. mux.sh 封装
```

**关键机制**：配乐脚本**读页面导出的 `EV`**——每个生长事件都带 `note`，`score.py` 在它的精确时刻合成。所以**任意数量的生长事件都能得到匹配的配乐**：换一个世界（新的布局 + 新的日程），音乐自动跟着变。这是「可换内容重跑」在音乐层的实现方式。

---

## 12. 证据

```
styles/lowpoly-island/STYLE.md:8-10        本质三条硬规则 + 不是什么
styles/lowpoly-island/STYLE.md:14-20       几何/道具/材质/水/无地平线天空/后期链/光束
styles/lowpoly-island/STYLE.md:24-29       颜色逻辑（粉彩/天色关键帧/夜里只剩自发光）
styles/lowpoly-island/STYLE.md:33-36       字体与字幕规则
styles/lowpoly-island/STYLE.md:41-46       运动质量（三条到位曲线/网格/投影不变）
styles/lowpoly-island/STYLE.md:50-63       镜头词汇表 + 允许转场
styles/lowpoly-island/STYLE.md:67-73       声音分层/乐器/单一动机音/foley/静默/−14 LUFS
styles/lowpoly-island/STYLE.md:79-84       六个 native move
styles/lowpoly-island/STYLE.md:88-94       媒介陷阱
styles/lowpoly-island/STYLE.md:102-106     变化空间（侵蚀/两个世界/一年四季 + 开场/结尾）
styles/lowpoly-island/DEMO.md:5            demo 名与 53s
styles/lowpoly-island/DEMO.md:10-18        故事/情感弧/建岛即作曲（光束一圈 12 拍、第 2 圈 12 格）
styles/lowpoly-island/DEMO.md:22-33        逐段镜头表与相机参数
styles/lowpoly-island/DEMO.md:37-44        配乐结构/静默/foley/叙述者
styles/lowpoly-island/DEMO.md:48-57        地形/道具/色值/天色/海面/到位数值/post/光束
styles/lowpoly-island/DEMO.md:86           小船位置由光束角速度反推
styles/lowpoly-island/demo/story.js:2-6    DUR/BPM/BEAT/BAR/G0/bar()/beat()
styles/lowpoly-island/demo/story.js:8-29   T 段落秒表
styles/lowpoly-island/demo/story.js:31-37  5 行旁白
styles/lowpoly-island/demo/story.js:40-48  CHORDS/chordAt/noteAt
styles/lowpoly-island/demo/story.js:50-62  SKY 天色关键帧
styles/lowpoly-island/demo/story.js:64-79  SHOTS 12 段 + shotAt()
styles/lowpoly-island/demo/world.js:8-9    hex2w / hdist
styles/lowpoly-island/demo/world.js:13-18  mat()/jit()
styles/lowpoly-island/demo/world.js:21-28  PAL 调色板
styles/lowpoly-island/demo/world.js:31-36  布局注释 + REMOVE/FIRST/DOCK/BEAM_NOTES
styles/lowpoly-island/demo/world.js:38-53  buildLayout()
styles/lowpoly-island/demo/world.js:58-65  hexPrism() 侧柱下沉 0.1
styles/lowpoly-island/demo/world.js:66-76  gable()/gableEnds()
styles/lowpoly-island/demo/world.js:78-101 makeHouse() parts/t0
styles/lowpoly-island/demo/world.js:122-137 makeMill()
styles/lowpoly-island/demo/world.js:139-152 makeBoat()
styles/lowpoly-island/demo/world.js:154-166 makeLighthouse()
styles/lowpoly-island/demo/world.js:169-187 beamMats() 高斯 ribbon + 海面光斑
styles/lowpoly-island/demo/world.js:211-229 EVS 生长日程（2/4/8 分格，每块带 note）
styles/lowpoly-island/demo/world.js:231-252 第 2 圈房子/风车/树 + 16 分格部件
styles/lowpoly-island/demo/world.js:255-269 树与 pop 事件
styles/lowpoly-island/demo/world.js:275-284 码头 4 块木板
styles/lowpoly-island/demo/world.js:356-366 细节日程（D16）与白天前收完断言
styles/lowpoly-island/demo/world.js:368-385 黄昏亮窗/灯塔环/ignite/光束命中/浮标 bell
styles/lowpoly-island/demo/world.js:389-394 dropY()/popS()
styles/lowpoly-island/demo/world.js:396-406 boatAt()
styles/lowpoly-island/demo/world.js:415-433 地块升起 0.5s + 水花环 + 14 水滴
styles/lowpoly-island/demo/world.js:440-448 房子落下与窗点亮/光束闪烁
styles/lowpoly-island/demo/world.js:462-479 小船随波 + 灯塔点亮 + 光束旋转
styles/lowpoly-island/demo/world.js:481-490 浮标 bob/铃响、海鸥绕飞
styles/lowpoly-island/demo/sea.js:6-14     waveH 与 WAVE_GLSL
styles/lowpoly-island/demo/sea.js:16-27    SHALLOW_SPAN 与海面 uniforms
styles/lowpoly-island/demo/sea.js:50-60    光束照水 + 逐面片高光
styles/lowpoly-island/demo/sea.js:64-66    近/远两层海面
styles/lowpoly-island/demo/sea.js:68-81    drawShallow()
styles/lowpoly-island/demo/post.js:1-2     正交后期说明
styles/lowpoly-island/demo/post.js:29      orthographicDepthToViewZ
styles/lowpoly-island/demo/post.js:33-36   天空渐变 + 雾起止
styles/lowpoly-island/demo/post.js:37-49   星星只在雾浓处
styles/lowpoly-island/demo/post.js:61-64   GTAO 参数
styles/lowpoly-island/demo/post.js:68-70   AO pass 隐藏 sprite/半透明
styles/lowpoly-island/demo/post.js:77-93   移轴模糊
styles/lowpoly-island/demo/post.js:95-106  粉彩调色
styles/lowpoly-island/demo/post.js:108-117 makePost() 链组装
styles/lowpoly-island/demo/main.js:10-13   SSAA 2× / NeutralToneMapping
styles/lowpoly-island/demo/main.js:18      OrthographicCamera
styles/lowpoly-island/demo/main.js:25-30   半球光 + 平行光
styles/lowpoly-island/demo/main.js:32-41   skyAt()
styles/lowpoly-island/demo/main.js:43-86   cam() 逐段相机
styles/lowpoly-island/demo/main.js:78      相机距离 ≥ 3× frustum 高度
styles/lowpoly-island/demo/main.js:82-84   camDist / hz0 / hz1 / 移轴
styles/lowpoly-island/demo/main.js:94-105  hexIcon()/iconTop()
styles/lowpoly-island/demo/main.js:112-130 titleBlock() 片名逐字升起
styles/lowpoly-island/demo/main.js:131-158 hud() 片名/字幕/片尾卡
styles/lowpoly-island/demo/main.js:161-181 render() 逐帧
styles/lowpoly-island/demo/main.js:184-194 events()
styles/lowpoly-island/demo/main.js:196-200 远方浮标反投影
styles/lowpoly-island/demo/main.js:201-207 window 契约
styles/lowpoly-island/demo/lines.json:1-7  5 行旁白
styles/lowpoly-island/style.json:16-17     frame_sec 21.2 / dur 53.0
```
