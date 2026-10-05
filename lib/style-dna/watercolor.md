# 水彩笔刷（watercolor）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Follow the Rain》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一页**自己画出来**的手绘日记：暖色棉纸垫在底下（它是唯一的白，也是橡皮），一切由**一笔一笔的笔触**构成——变宽的半透明色带 + 断成虚线的飞白毛，交叉处像透明颜料一样变深；**没有矢量描边**。东西自己一笔一笔画进来（先结构后细节），上面还浮着一层手写注解。

**它不是**：水墨（有色、不是墨阶，没有书法式的一挥）、厚涂（没有厚颜料、没有刮刀）、儿童绘本（没有蜡笔、没有卡通描边）、矢量插画上叠一层水彩纹理。
（`STYLE.md:14`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「一支笔在纸上留下的东西」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸即世界** | 一张预生成的图（`paper.py`）：暖底 `#f1e9da`、三层平滑噪声 ±3.5%、约 2600 条短曲线纤维（±3.5% 明暗）、细颗粒、5% 暗角。**每一帧第一件事就是画它**。它同时是擦除用的雾（波浪上升的纸色边裁切 `PAPER_IMG`）。 |
| **一笔 = 色带 + 毛** | 宽度按轮廓走（`brush` 头粗尾收 / `leaf` 正弦鼓起 / `even` 平头短收 / `tip` 粗根细尖 / `trunk` 基部外扩、向上收 62%），带 ±22% 的 value-noise 粗糙；笔身按 `a×rib` 填（有毛时 rib≈0.62，是一层薄淡彩）；再加 3–9 条 30–85% 不透明的**毛**，每条有随机虚线（长段 18–90px、间隙最大 w/2）和随机提前结束——**这就是飞白**。 |
| **没有矢量线** | 形体侧面那条更重的边笔（`edgeOf`）是唯一的「线」。 |
| **淡彩积边** | 同一个多边形画 3 遍、顶点各自抖动，每遍 `a/3×1.6`，各遍不一致处边缘变深。 |
| **纸是白** | 永不画纯白；亮 = 未上色的纸。 |
| **深度靠图层** | 四层视差（0.25 / 0.55 / 1.0 / 1.55），越远越小、越淡、越不饱和；湿区在层间夹纸色雾带。 |
| **纯函数 + withSeed** | 一切是 `t` 的纯函数；`render(t)` 里现做的笔触必须包在 `withSeed(seed,…)` 里，否则并行 worker 不一致。 |
| **成品缓存** | 画完的对象缓存成 sprite；只有正在被画（进度<1）或正在燃烧的才逐笔绘制。 |

**关键取向**：`STYLE.md:19` 强调「painting-in 是主要运动」——一件东西的进度是它在屏幕上的位置的函数；`drawList` 把 N 笔按顺序分完进度（每笔占 `clamp(4/N,.12,.5)`），所以**干先来、叶团最后**。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位安静的博物学插画师在现场边画边讲。第三人称、现在时为主，暖而不急的纪录片口吻，一句一个想法。**数字是真的，标签是拉丁学名，配色跟着数据走**。

**长度（实测）**：旁白单行 1.7–7.4s；屏幕上排成居中的衬线斜体 36px、自动断成最多 2 行（宽上限 1400px），下面一条约 2/3 大小的中文行 24px。字幕停在纸上、不进盒子，停留 ≥ `max(1.8s, 语音时长+0.6s)`。数字在 TTS 里念全、在屏幕上写数字。

**句首类型**（示例性，不是抄原文）：
- 一句可验证的事实：`Australia is the driest inhabited continent.`
- 一个具体数字：`At the red centre, less than 250 millimetres falls in a year.`
- 祈使/邀请：`To understand its plants, follow the rain.`
- 因果连接：`A little more rain, and the acacias arrive.`
- 地点状语起句再落到主体：`In the wet mountains, …`

**这个风格里不会出现的句式**：
- 营销口播腔、感叹号堆叠、`amazing` / `you won't believe`
- 第一人称抒情（`I feel…`）——这是纪录片不是散文
- 抽象概念当主语（只谈可被画出来、可被测量的实物与数值）
- 一句塞两个以上信息点
- 把字幕做成通用字幕条（字幕必须坐在纸上、带纸色光晕）

---

## 3. 叙事节奏

**写生册顺序**：

```
冷纸
  → 地平线被一笔刷过
  → 朱红太阳像盖印一样「啪」地落下
  → 片名
  → 用刷子边缘的擦除揭开整个风景
  → 4–6 个区块（各带一个真实数值、一个主角标本、一只小动物、一件小事）
  → 纸色雾把一切洗回白纸
  → 海岸线被画出来
  → 地图被填色 → 「我们走过的路」箭头
  → 倒回 5000 万年前（全绿）→ 漂移、变干回到今天（干心绿边）
  → 片名在褪色地图上回来 + 版权页
```

**全片没有一次硬切**（`DEMO.md:44`）。demo 113.6s。

| 段落 | 时间 |
|---|---|
| 片头 | 0–10.9s |
| 横移 | 10.3–73s（`camXf` 单调三次插值，区块间加速、事件处减速） |
| 王桉竖摇 | 54.2–60.9s（抬 980px） |
| 雾 | 70.3–73.6s |
| 地图 | 73.2s 起 |
| 片尾 | 101.6s 起 |
| 音乐拍网格 | `BEAT0=11.865`、`BEAT=0.5805s`，袋鼠一跳两拍、落地卡拍 |

**总时长**：主 demo 113.6s（一镜到底的横移长卷）；结构上可以是短的「一件标本 + 一张注解」15–30s，也可以是「一年十二页」的合集；由主题决定。

**静默怎么用**：静默是「把笔抬起来」——音乐退场，只剩纸与房间，用来框住单独一个被画出来的瞬间。混音上旁白说话时音乐让开约 4dB（×0.62，0.3s 平滑包络）。

---

## 4. 镜头逻辑

**镜头是什么**：一台在**一整张画纸**上的相机——画面是一个连续的被画出来的世界，几乎不切；它沿着长卷横移、沿一件东西竖摇、或锁死在原地看它被画出来。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 沿连续世界的长横移 | 一个梯度；一段旅程；因果 | 一条样带；一条路线；一条时间线 |
| 沿一件东西竖摇 | 尺度；测量 | 一棵高树；一栋楼；一个深度 |
| 锁死一张纸、看东西被画进来 | 研究；专注 | 一页标本；一份菜谱；一张图 |
| 慢慢推向一个细节 | 观察者凑近 | 一颗种子；一只虫；一条手写注 |
| 拉远到一张地图或图 | 整体被重新框住 | 这一切发生在哪；一个系统 |
| 雾洗成空白纸 | 章节结束；时间流逝 | 一个季节；遗忘；一个新地方 |
| 翻页 / 新纸盖上来 | 日记里的新一页 | 新的一天；新物种；新案例 |
| 锁死机位但时间在变 | 生长；衰败；历史 | 一个季节循环；前后对比；深时间 |

**允许的转场**（必须来自纸与画本身）：刷子边缘的擦除（一条波浪竖裁切揭开整景）、纸色雾、翻页、连续不断的镜头运动。

**禁止**：硬视频切（全片是一张画纸）；两张不相关的画之间的溶解；任何元素的淡入/滑入（东西要么被画出来，要么被雾洗掉）；无来由的运镜。

---

## 5. 表达习惯（idioms）

1. **Painting-in 即揭示**：一件新东西在进入画面时被一笔一笔画出来；用 `burst` 让一整组（≤1s）同时炸开作为高潮。
2. **调色板即数据**：天、地、背景按一个可测的值混合；ramp 量化成 4–6 个色带读起来像颜料，连续 ramp 读起来像软件。
3. **标本 + 注**：一件主角物 + 手写标签 + 钢笔引线，引线从标注长到标本。
4. **雾擦除**：世界被纸色雾洗回白纸。
5. **地图上的时间**：一张被画的地图，填充随年份连续变化。
6. **画出来的变形**：物体交叉淡化到烧焦/泡湿/变旧的 sprite 再长回来。
7. **一个重音色**：一个朱红、一个雨蓝，留给一个反复出现的元素。

---

## 6. 氛围

一间安静的画室 / 一张摊开的工作台：纸的暖、颜料的凉、笔尖的沙沙。整体是**平静、好奇、精确**的气质——是纪录片不是童话；慢，但不拖。

---

## 7. 声音

- **乐器**：毛毡钢琴、指弹吉他、木管、轻弦乐、钟琴、卡林巴、软 pad。一首授权曲目可以用**对齐拍点的剪辑跳接**裁短，画面随后采用它的拍网格。
- **动作声（全部由场景的物质合成）**：画每一笔时的**纸上笔刷沙沙**（带通 1500–7000Hz 噪声 + 9Hz 轻颤音 + 声像横扫）；太阳盖印的一声闷响（90Hz 下滑 + 低通噪声 + 短混响）；沙漠风；虎皮鹦鹉叽喳；雨滴落在树上的 plink（与画面同步）；火的低吼 + 噼啪；渐大的雨；鞭鸟；雾起、海岸线笔刷、地图上的火。
- **混音规则**：旁白 → 48kHz、90Hz 高通、RMS 压缩（−24dB，3:1）；**Kokoro 峰均比约 17dB**，所以先跑一个 5ms 预读的峰值限制（天花板 = 语音 RMS + 11dB）再做电平匹配；说话时旁白 RMS = 音乐 RMS + 8dB，音乐让开 ×(1−0.38·duck) 约 −4dB、0.3s 平滑包络；混音峰值归一到 0.89，最终 loudnorm −14 LUFS / −1.0 dBFS。

---

## 8. 变化空间（可自由发挥）

主体、结构、画什么、调色板逻辑、是否测量、开场、结尾和镜头。

`STYLE.md:101-107` 给了远离 demo 的方向：
- **结构**：一年一本日记（每月锁一页，各自覆盖上一页）；一件东西的解剖（一个标本被拆成带标签的部件，每个部件一张画的近景）；一份菜谱或流程（步骤自上而下画在一张竖纸上，向下摇）。
- **开场**：一幅已经完成的画，然后倒着看它被画回第一笔、再正着画一遍；一坨湿颜料洇开的近景，拉远看它变成了什么；纸上一个手写的问题，被画出来的答案回答。
- **结尾**：这一页没画完（笔在笔画中途抬起）；一个细节的近景，其余褪回纸色；纸干了、被归进一叠别的页里。

demo 本身只用了澳洲降雨梯度这一条样带——故事、区块、道具、时长都不可复用。

---

## 9. 禁忌清单

- 矢量描边（形体只能靠更重的边笔和笔触叠压）。
- 厚涂 / 刮刀 / 不透明颜料。
- 把水彩纹理叠在矢量插画上（必须是笔触本身构成形体）。
- 画纯白（白 = 未上色的纸）。
- 给文字/边框铺底或做成通用字幕框。
- 硬切、溶解、淡入滑入。
- 照抄任何真实的植物志版、构图或排版。
- 复用示例的故事、叙事弧、镜头、道具或时长。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

VO 表（`scene.js:3-17`）每行 `[id, 开始, 时长, 英文, 中文]`，13 行、一行一个想法、1.7–7.4s；同一张表同时驱动字幕、SRT 与 `mix.py`（`mix.py:137` 用正则 `\['(v\d\d)', ([\d.]+),` 从 `scene.js` 里抠出开始时间——**行必须保持这个形式**）。

| 数据表 | 内容 |
|---|---|
| `RAINK` | 世界 x → 年降雨 mm（对数插值） |
| `ZONES` | 区块边界 |
| `ZCOL` | 每区 天/远山/中景/地面 的颜色 |
| `MSTOP` | 地图降雨 ramp |
| `BIOMES` | 区块卡文案 |
| `STN` | 地图降雨站点 |

### 10.2 新画面主体的契约

新标本 = `plants.js` 里的一个生成器函数，接收一个缩放 `sc`（可选参数），在**局部坐标**里工作、原点 `(0,0)` 在根部、`y` 向上为负，返回 `{S: strokes, …}`（`gum` 还返回 `woody`/`leaves`/`shoots`/`fork`；`mulga` 返回 `stems`；`ash`/`rfTree` 返回 `top`）。

用 `scene.js` 的 `add(layer, worldX, generator, scale, {dy, span, sway, args, extra})` 把它放进某一层并缓存 sprite。要用新的笔触轮廓就扩 `engine.js` 的 `mk`（`prof`）。

### 10.3 时间线契约

**页面契约**（`render.mjs` 依赖它）：`window.DUR`（秒）、`window.render(t)`（`t` 的纯函数，画整帧）、`window.READY=true`（字体、纸、`build()` 完成后）。画布 1920×1080，`ctx` 是 `main.js` 里的全局。

`render(t)` 顺序：画纸 → （`t<73.7`）风景+注解 → （`t>70.3`）雾 → （`t>73.2`）地图 → HUD → （`t<11`）片头 → 片尾 → 字幕。

### 10.4 事件词汇（时间常数）

事件不是 JSON 表而是**时间常数**，由各模块共用：

| 常数 | 含义 |
|---|---|
| `camXf` / `camYf` | 镜头路径（横移 / 竖摇） |
| `REV` | 上色扫描 |
| `FIRE.fireT0` / `regrowT0` | 火烧 / 萌发时刻 |
| `BEAT0` / `BEAT` | 袋鼠卡拍 |
| `mapTau` | 深时间 |
| `VO` 行 | 旁白 + 字幕 + 混音 |

声音侧 `mix.py` 直接按秒摆放 sfx（brush/stamp/wind/chirp/plink/fire/rain/whipbird/swell/airy），全部程序合成。

---

## 11. 构建链（复用机制）

```
styles/watercolor/demo/
  index.html      loads fonts.css + aus.js, engine.js, plants.js, scene.js, main.js (classic scripts, one global scope)
  engine.js       RNG/easing/noise, monotone spline, colours, the stroke engine (mk, drawS, drawList, sprite, clump, edgeOf)
  plants.js       plant & prop generators (spinifex, desertOak, mulga, saltbush, wattle, tussock, gum, ash, treeFern,
                  groundFern, rfTree, fanPalm, vine, farTree, uluru, cloud, shrub)
  scene.js        VO table, layers, zones, camera, world build, wash strips, landscape drawing, animals, fire, rain, notes
  main.js         canvas, map (deep time), mist, HUD, subtitles, title/end card, render(t), async init → READY
  aus.js          coastline rings   paper.jpg (paper.py)   fonts/ + fonts.css (fetch_fonts.mjs)
  tts/ · voices/  voice script + Kokoro + whisper check     music/  analyze.py · jump.py · edit.py → score.wav
  mix.py          SFX + voice + music → mix.wav      render.mjs  stills / video / part     mux.sh  → ../watercolor.mp4
```

**关键机制**：镜头路径（`monotone`）、上色扫描（`REV`）和地图深时间（`mapTau`）是三条**互相独立的时间轨道**——所以「在空间里走一遍」可以被同一张引擎改写为「在时间里走一遍」。这正是「换主题重跑」在本风格里的实现方式。

---

## 12. 证据

```
styles/watercolor/STYLE.md:6-14        本质四条 + 不是什么
styles/watercolor/STYLE.md:16-23       材料与渲染（纸/笔触/淡彩/图层/sprite/纯函数）
styles/watercolor/STYLE.md:25-32       颜色逻辑（纸是白/透明叠色/重音色）
styles/watercolor/STYLE.md:34-39       字体与字幕
styles/watercolor/STYLE.md:41-48       运动质量
styles/watercolor/STYLE.md:50-65       镜头词汇表 + 转场
styles/watercolor/STYLE.md:67-73       声音 + 混音 −14 LUFS
styles/watercolor/STYLE.md:75-85       原生招式
styles/watercolor/STYLE.md:87-95       媒介陷阱
styles/watercolor/STYLE.md:97-99       引擎文件清单
styles/watercolor/STYLE.md:101-107     变化空间
styles/watercolor/DEMO.md:5            demo 113.6s 1920×1080 60fps
styles/watercolor/DEMO.md:12-16        纸/笔触/无矢量线/注解层/语气
styles/watercolor/DEMO.md:20-27        原生力量表
styles/watercolor/DEMO.md:29           故事形状
styles/watercolor/DEMO.md:33-44        逐拍镜头表 + 全片无切
styles/watercolor/DEMO.md:46-52        painting-in / 摆动 / 擦除 / 卡拍 / 事件 / 地图
styles/watercolor/DEMO.md:54-60        旁白 / 音乐 / 拟音 / 混音
styles/watercolor/DEMO.md:62-84        纸/墨/重音/区块调色板/笔触/图层/字体
styles/watercolor/DEMO.md:86-91        片头/字幕/区块卡/仪表/片尾
styles/watercolor/DEMO.md:93-104       实际踩过的陷阱
styles/watercolor/DEMO.md:106-150      构建链
styles/watercolor/DEMO.md:152-198      页面契约 + 引擎函数表 + 最小示例
styles/watercolor/demo/scene.js:2              DUR=113.6
styles/watercolor/demo/scene.js:3-17           VO 表 13 行
styles/watercolor/demo/scene.js:20-25          LAY 四层视差
styles/watercolor/demo/scene.js:26-28          ZONES / zoneOf / zoneJit
styles/watercolor/demo/scene.js:29-31          camXf / camYf / REV
styles/watercolor/demo/scene.js:32-33          RAINK / rainAt
styles/watercolor/demo/scene.js:34-36          FIRE / fireT0 / regrowT0
styles/watercolor/demo/scene.js:41-48          add()
styles/watercolor/demo/scene.js:49-117         build()
styles/watercolor/demo/scene.js:120-129        山脊振幅
styles/watercolor/demo/scene.js:130-141        ZCOL / zoneGrad
styles/watercolor/demo/scene.js:142-155        mkStrip / washPoly
styles/watercolor/demo/scene.js:156-188        buildStrips
styles/watercolor/demo/scene.js:189-196        buildHorizon
styles/watercolor/demo/scene.js:199-210        drawStripAt（刷边揭开）
styles/watercolor/demo/scene.js:211-216        plantP / burst
styles/watercolor/demo/scene.js:217-236        drawPlants
styles/watercolor/demo/scene.js:243-267        drawSky（太阳盖印）
styles/watercolor/demo/scene.js:268-281        drawHorizon / mistBand
styles/watercolor/demo/scene.js:284-347        BEAT0/BEAT + 动物
styles/watercolor/demo/scene.js:348-405        flame/drawFire/drawAsh/drawRain
styles/watercolor/demo/scene.js:407-431        hand/leader/note/scr
styles/watercolor/demo/scene.js:433-460        drawNotes
styles/watercolor/demo/scene.js:461-490        tinyHuman / mulgaRain
styles/watercolor/demo/scene.js:492-526        drawLandscape
styles/watercolor/demo/main.js:4-7             MAPC / STN
styles/watercolor/demo/main.js:12-17           MSTOP / mmColor
styles/watercolor/demo/main.js:18-50           buildMap
styles/watercolor/demo/main.js:51-56           mapTau
styles/watercolor/demo/main.js:57-71           drawMapFill
styles/watercolor/demo/main.js:72-126          drawMap
styles/watercolor/demo/main.js:129-137         drawMist
styles/watercolor/demo/main.js:140-166         BIOMES / drawHUD
styles/watercolor/demo/main.js:169-187         wrap / drawSubs
styles/watercolor/demo/main.js:190-215         titleBlock / drawTitle / drawEnd
styles/watercolor/demo/main.js:219-239         render(t) + async init → READY
styles/watercolor/demo/engine.js:3-17          RNG/缓动/vnoise/fbm
styles/watercolor/demo/engine.js:20-37         monotone
styles/watercolor/demo/engine.js:40-44         PAPER/INK/INK2 + 颜色工具
styles/watercolor/demo/engine.js:47-58         qcurve/qctrl/polar
styles/watercolor/demo/engine.js:61-85         mk
styles/watercolor/demo/engine.js:87-106        drawS
styles/watercolor/demo/engine.js:109-114       drawList
styles/watercolor/demo/engine.js:116-126       bbox / sprite
styles/watercolor/demo/engine.js:129-137       clump
styles/watercolor/demo/engine.js:139-142       edgeOf
styles/watercolor/demo/plants.js:2-14          COL 植物色表
styles/watercolor/demo/plants.js:16-28         spinifex
styles/watercolor/demo/plants.js:30-42         desertOak
styles/watercolor/demo/plants.js:44-55         mulga
styles/watercolor/demo/plants.js:59-65         wattle
styles/watercolor/demo/plants.js:67-74         tussock
styles/watercolor/demo/plants.js:77-103        gum
styles/watercolor/demo/plants.js:105-120       ash
styles/watercolor/demo/plants.js:122-138       frond / treeFern / groundFern
styles/watercolor/demo/plants.js:140-156       rfTree
styles/watercolor/demo/plants.js:158-181       fanPalm / vine
styles/watercolor/demo/plants.js:184-216       farTree / uluru / cloud / shrub
styles/watercolor/demo/mix.py:9                SR / DUR
styles/watercolor/demo/mix.py:30-34            混响 IR / verb
styles/watercolor/demo/mix.py:42-49            brush
styles/watercolor/demo/mix.py:52-56            stamp
styles/watercolor/demo/mix.py:59-65            wind
styles/watercolor/demo/mix.py:67-74            chirp
styles/watercolor/demo/mix.py:76-80            plink
styles/watercolor/demo/mix.py:82-89            fire
styles/watercolor/demo/mix.py:91-100           rain
styles/watercolor/demo/mix.py:102-114          whipbird
styles/watercolor/demo/mix.py:116-128          swell / airy
styles/watercolor/demo/mix.py:136-147          VO 解析 + 摆放 + duck
styles/watercolor/demo/mix.py:149-159          电平匹配 + 限幅
styles/watercolor/demo/mix.py:160-164          合成 + 峰值归一
styles/watercolor/demo/paper.py:3-12           纸底 + 三层噪声
styles/watercolor/demo/paper.py:14-27          纤维 + 颗粒 + 暗角
styles/watercolor/demo/render.mjs:12-27        stills/events/video/part + READY
styles/watercolor/demo/render.mjs:44-67        多 worker 出帧
styles/watercolor/style.json:16-17             frame_sec 68.16 / dur 113.6
```
