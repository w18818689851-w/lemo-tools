# 蜡笔儿童绘本（crayon-book）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Moon Can't Sleep》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「**一页绘本在你眼前被画出来**」的片子：蜡笔只粘在纸纹的凸点上、笔压决定它压进凹处多深，涂色总是涂出轮廓，每条线因为每帧都是新画的一张而轻轻**沸腾**；水彩是最后刷上去、并且被蜡笔挡住的一层，负责揭示蜡笔早就藏好的东西。

**它不是**：加个蜡笔滤镜的可爱矢量图、白板讲解（没有马克笔和手）、水彩画（水彩是客、蜡笔是主）、黑板画。
（`STYLE.md:8`、`STYLE.md:10`）

---

## 1. 材料与渲染的硬规则

任何画面元素都必须能被解释成「蜡笔 / 纸 / 水彩 的某个物理环节」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸即世界** | 暖白画纸 `#f4efe3`；纸纹**锚定在页面上**（随镜头平移；缩放时两个八度交叉，颗粒屏幕上始终 ~1px）；三个八度值噪声（1.35 / 2.9 / 6.3 px）+ 横向纤维项；对比 `smoothstep(.16,.86)`；浮雕强度 ~0.55；低频斑驳 ±2%、暖暗角。 |
| **蜡的附着（核心）** | 每层是 Canvas2D，RGB=颜色、A=笔压；着色器在 `tooth > 1 − 1.22·pressure`（软边 ±0.07）处沉积蜡。轻压=点状凸峰，重压=几乎实心且略深 `×(1−0.10·p²)`。 |
| **笔触** | 带低频手抖（~1.7px）的飘带：宽度 ±15%、两端收尖（taper 0.25、收细段 ≤28px）、一条更密的中芯 + 1–2 条细条纹。角色/建筑轮廓最重（~7–8px），精细物件 4–5px。 |
| **涂色** | 来回之字形排线、看得见行距缺口：行距 ~10.5px、笔宽 ~11px、每趟笔压 0.72–1.14×、越界 0–7px；大面积再补交叉排线（40–50%）。 |
| **水彩** | 独立密度画布乘在页面上：颜料在边缘堆积（density − blur）、最深凹处颗粒化、噪声渲开；被蜡排斥 `× (1 − 0.93·smoothstep(.12,.55, wax))`。刷痕 = 宽条带 + 鬃毛条纹 + 移动时更深的湿前沿。 |
| **遮挡** | 前景形体内部擦掉后面的东西；角色身后「保留纸白」（knock-out：恢复纸面并重置蜡），像孩子先画人、再绕着人涂背景。 |
| **角色** | 熟练的大人模仿小孩：圆头（~2.5 头身）、点眼 + 白蜡高光、粉腮、管状四肢、连指手、大块头发；有脸的物件给大眼与眼皮。孩子式透视：山墙正面 + 斜侧墙；人比门大。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：书页上印着的文字。第三人称、过去时为主，简短、温柔、有节奏。允许拟人，但不解释、不评论。

**长度（实测）**：demo 7 行 **13–47 个字符**；最短是收尾句 `Night, night.`（13 字符），最长是数羊句 `It tossed, and it turned, and it counted sheep.`（47 字符）。字幕 Patrick Hand 54px、靛蓝蜡笔色、底部居中、一次一行；停留 ≥ `max(1.8s, 语音时长 + 0.6s)`（`film.js:24`），下一行到来前 0.25s 收；逐字写出约 0.35s。

**句首类型**（示例性，不是抄原文）：
- 主语 + 状态陈述：`The moon could not sleep.`
- 重复动作 / 叠词推进：`It tossed, and it turned, and it counted sheep.`
- 方位状语引出第二个角色：`Down below, someone else was awake, too.`
- 连续动词串一个小动作：`So she climbed up, up, up, onto the roof,`
- 极短的安抚收尾：`Night, night.`

**这个风格里不会出现的句式**：第一人称抒情；长复合句 / 从句套从句；营销腔、感叹号堆叠；抽象概念当主语。

---

## 3. 叙事节奏

**信息投放顺序**（一页绘本的完成过程）：

```
空白页（先看到纸）
  → 角色被画出来并醒过来（3s 内钩子）
  → 一个小而可笑的困难（数羊失败）
  → 第二个角色登场
  → 一个小勇敢的动作（爬梯，一级一级画出来）
  → 水彩揭示（情绪峰，无旁白）
  → 大家睡着
  → 拉出成书、翻页
  → 结束卡
```

**时间挂在 3/4 拍、72 BPM 网格上**：1 拍 = 0.833s，1 小节 = 2.5s（`film.js:12`）。

| 层 | 停留规则 |
|---|---|
| 片名 | 2.6s 起逐字写出 |
| 数羊 | 5 拍（10.0s 起每拍一只，`film.js:47`） |
| 失败后的静默 | 整整 1 拍（13.95–14.95s） |
| 爬梯 | 8 级横档从 20.3s 起每 0.45s 一级（`film.js:52`） |
| 水彩 | 三道刷痕 27.9–34.7s（`world.js:132-136`） |
| 拉出成书 | 46.0s；翻页 47.6s |
| 字幕 | 提前 0.1s 上、至少停 1.8s、下一行前 0.25s 收 |

**总时长**：主 demo **52.0s**（`style.json:17`、`film.js:11`）；DEMO 给的故事弧是 **45–55s**（`DEMO.md:14`）。

**静默怎么用**：静默是一个真实的拍子，不是空。数羊失败后留整整一拍（`film.js:49` 的 `silence` 事件），唱歌前再留 0.3s 呼吸。无旁白的唱歌 / 水彩段落让音乐自己讲——音乐在人声下压 −7 dB、在无词段落抬 +4 dB。

---

## 4. 镜头逻辑

**镜头是什么**：一台在「一页大画纸」上移动的摄影机。它不制造情绪，只是「看」，把视线引到一处再让位给画面；一镜到底横跨一页，最后才拉出去揭示「这是一本书」。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 锁死全页 | 画画之前的纸；整幅图 | 从无到有；静止画面；需要整页的揭示 |
| 推向角色 | 「就是这一个」 | 片名让位；情绪到来 |
| 锁死中近景 | 替换姿势在表演 | 喜剧；一个决定；一次小失败 |
| 沿视线俯仰 | 我们看到他们看到的 | 发现；渴望；某个巨大的东西 |
| 紧跟随 | 世界在主体前面自己画出来 | 勇敢的动作；一条路；建造 |
| 刷子移动时保持大远景 | 材质本身即运动 | 水彩揭示；天气；昼夜降临 |
| 缓慢横移过页面 | 从左到右阅读 | 清单；序列；一家人 |
| 拉出越过页面边缘 | 这页是一个物件 | 桌上的书；冰箱上的画 |
| 翻页 | 新章节、时间跳跃 | 之前/之后；第二天 |

**允许的转场**：画出来、涂上去、水彩刷过、横移或翻页。

**禁止**：溶解/叠化等非手绘转场；**让蜡笔淡入淡出**（片名只能靠镜头移开、翻页或被涂掉来离开）；无来由的运镜；在无旁白段落排字幕。

---

## 5. 表达习惯（idioms）

1. **白蜡抵抗（wax resist）**：白蜡笔在水彩刷过之前几乎看不见——把彩蛋藏在第一帧的光天化日之下。
2. **现场画出来（drawn live）**：世界在主角前面一级一级地画出来。
3. **涂色即动作**：被涂上颜色「就是」在做那件事（涂上外套=穿上、粉色乱涂=脸红、水彩=夜幕降临）。
4. **沸腾（boil）**：被定住的一帧仍然活着；把它调静，片子就安静下来（demo 在 44.4s 后降到 0.55 倍，`film.js:157`）。
5. **孩子逻辑**：错误透视、物件长脸、数字写在天空里。
6. **它是一本书**：拉出到物件本身；翻页。
7. **一镜到底解释书页**：整片一镜到底，最后拉出成书。
8. **逐字写出**：片名与字幕按字符 reveal。

---

## 6. 氛围

一张铺开的暖白画纸、一盒蜡笔、一杯水彩：有纸的味道、蜡的哑光、水彩洇开的湿边；安静、缓慢、被照顾。整体是**耐心、温柔、值得被贴在冰箱上**的气质，而不是精致或戏剧化的。

---

## 7. 声音

- **乐器**：小件木质与金属齿乐器，**不用弦乐与三角钢琴**：尤克里里/尼龙吉他、单簧管/巴松、音乐盒（可「发条松掉」）、钟琴/钢片琴（每颗揭示的星星一个音）、玩具钢琴（每数一样东西一个音）、长笛/竖笛当歌唱的嗓音、沙锤与木鱼。一个主题可以一直藏着，到最后完整听一次。
- **动作声（按材料分层）**：蜡笔=粘滑摩擦（带通噪声 × 不规则颗粒调制，颗粒随笔画速度变密变亮；涂色=每趟一个短刮擦）；湿刷子=柔软低通噪声 + 鬃毛颗粒、随笔画声像移动；毡子噗、布料嗖声、卷笔刀、蜡笔放下、翻页（提起/呼啸/扑动）；底噪=极轻蟋蟀/鸟、房间底噪、远处钟声。
- **混音规则**：音乐在人声下压 −7 dB、无词段落抬 +4 dB；音乐盒与钟琴 stem +3 dB 并给 3–7kHz 轻抬；整体 −14 LUFS。人声链：高通 75Hz → **先压缩**（thr 0.2、2.5:1、8ms/140ms）→ 低架 +1.5dB@220Hz、−2dB 陷波@3.2kHz、高架 −4dB@6kHz → 分频去齿音（4.8–10kHz、4:1）→ 逐行 RMS 匹配 → 暖近场混响（12ms 预延迟、0.7s 低通尾巴、湿声约 −17dB）；人声比底噪高 7–10dB。

---

## 8. 变化空间（可自由发挥）

结构、角色（或没有角色）、是哪一页、开场、结尾、镜头路径、节奏、蜡笔盒、有没有水彩。

`STYLE.md:101-103` 给了远离 demo 的方向：
- **结构**：一本涂色书（所有轮廓第一帧就在，每个想法涂一块）；翻过好几页（每页一个阶段，用翻页串起来）；两个孩子、一页（两种蜡笔颜色先争辩、再合流）。
- **开场**：一张画好的页被擦掉重新开始；蜡笔尖的极大特写正在画、然后拉开；一张被揉皱的纸被抹平。
- **结尾**：这页被贴在冰箱上、旁边还有别的画；最后一笔乱涂用一种颜色填满画面；一滴溅开的水找到白蜡写的留言。

---

## 9. 禁忌清单

- 加个蜡笔滤镜的可爱矢量图（质感必须来自材质物理）。
- 白板讲解（没有马克笔、没有手、没有手写字幕框）。
- 水彩画（水彩是客、蜡笔是主）。
- 黑板画。
- 让蜡笔淡入淡出。
- 用纯黑做轮廓（用靛蓝/深棕/梅子色）。
- 屏幕固定的纸纹（必须锚定，否则文件膨胀：190MB → 74MB）。
- 照抄任何真实绘本的角色、歌或画面。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

- `lines.json`：每行 `{id, text, voice, speed}`，demo 用 `af_heart`、speed 0.80–0.90，共 6–8 短行（`lines.json:1-9`）。
- 字幕：由 `LINES` 生成，`t0 = 语音起点 − 0.1s`，`t1 = max(t0+1.8, t+时长+0.7)` 且不晚于下一行前 0.25s（`film.js:24`）。
- 事件表 `events.json`：`{dur, ev[]}`，由 `film.js` 的 `EV.push` 产生。
- 配乐 cues（A–G 段落）、蜡笔盒（`pal.js` 12 支色）、水彩透射色、片名/结束卡文案。

### 10.2 新画面主体的契约

用蜡笔引擎画：
- 线 `line(L, pts, {col,w,p,seed,wob,boil,taper,draw,streak})`——飘带 + 收尖 + 条纹 + 沸腾。
- 面 `fill(L, poly, {col,p,ang,gap,w,over,draw,cross})`——之字排线 + 出界 + 可选交叉。
- 小面积 `dab`；形状 `ellipse / handCircle / bez / smooth / xf`；字 `text(L,str,x,y,{size,font,reveal})`。
- 角色用 `rig.js` 的 `part/group` 做遮挡 + knock-out、管状四肢。**先画角色的 model sheet（`sheet.js`）再进任何镜头。**

### 10.3 时间线契约

`film.js` 导出：`DUR`、`frame(comp,t)`（≥46.0s 交给 `end.js`）、`drawPage(comp,t,cam,{subs,vig})`、`LINES`、`SUBS`、`EV`、`camT`（世界中心 + 缩放的单调三次插值）。
页面契约（`main.js`）：`window.READY / window.render(t) / window.DUR`。
**合成顺序固定**：paper → knock → crayon(f/l) → wash → 角色（水彩**之后**）→ knock 字幕底 → 字幕 → finish（`film.js:210-221`）。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 |
|---|---|
| `voice{id}` | 人声 |
| `scratch{dur,pan}` / `write{dur}` / `scribble{dur}` | 蜡笔刮纸 / 写字 / 涂色 |
| `pop` / `paper` | 弹出 / 纸 |
| `toss` / `hop{i}` / `baa{i}` / `number{i}` | 翻身 / 羊跳 / 羊叫 / 数字 |
| `silence{dur}` / `cricket` / `wave` | 静默 / 蟋蟀 / 挥手 |
| `rung{i}` / `hopout` / `climbover` / `step` / `sit` | 爬梯 |
| `brush{dur,dir}` / `dip` / `glint{pan}` | 刷子 / 蘸水 / 星星闪 |
| `cap` / `yawn{who}` / `quilt` / `tuck` / `liedown` | 睡前动作 |
| `room` / `page{dur}` / `cue{id}` | 房间底噪 / 翻页 / 配乐段 |

全部由 `film.js` 里 `EV.push` 产生，再由 `core/render/events.mjs` 序列化成 `events.json`。

---

## 11. 构建链（复用机制）

```
node core/render/still.mjs styles/crayon-book/demo 0.5 --q 'test=model&page=girl'   # 先做 model sheet
core/tts/tts.py lines.json voices → asr_check.py                                    # 直到全部 OK
# 在 film.js 里搭时间线；用 still.mjs --range + sheet.py 复审（至少两轮）
node core/render/events.mjs → music/score.py（72 BPM 网格、glint 事件驱动钟琴）→ mix.py
node core/render/video.mjs styles/crayon-book/demo --fps 24 --workers 3             # 1248 帧
CRF=26 sh demo/tools/mux.sh out/video24.mp4 mix.wav crayon-book.mp4 24 0            # 不加颗粒，纸就是颗粒
```
（`DEMO.md:89-94`）

---

## 12. 证据

```
styles/crayon-book/STYLE.md:8          本质
styles/crayon-book/STYLE.md:10         不是什么
styles/crayon-book/STYLE.md:14-20      材料与渲染
styles/crayon-book/STYLE.md:24-27      颜色逻辑
styles/crayon-book/STYLE.md:31-32      字体与字幕
styles/crayon-book/STYLE.md:36-40      运动质量
styles/crayon-book/STYLE.md:46-58      镜头语法表 + 转场
styles/crayon-book/STYLE.md:62-66      声音
styles/crayon-book/STYLE.md:72-77      native moves
styles/crayon-book/STYLE.md:99-103     变化空间
styles/crayon-book/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/crayon-book/DEMO.md:12          demo 用尽六个 native moves
styles/crayon-book/DEMO.md:14          故事弧 45–55s
styles/crayon-book/DEMO.md:31-43       逐拍镜头表
styles/crayon-book/DEMO.md:51-57       配乐 / 静默 / 混音
styles/crayon-book/DEMO.md:63-68       调色板与道具
styles/crayon-book/demo/film.js:11-12          DUR=52 / 72 BPM
styles/crayon-book/demo/film.js:15-24          LINES 与 SUBS 停留规则
styles/crayon-book/demo/film.js:27-32          camT 镜头表
styles/crayon-book/demo/film.js:36-67          EV 全部事件
styles/crayon-book/demo/film.js:151-154        frame / endFrame
styles/crayon-book/demo/film.js:157            BOIL.amp
styles/crayon-book/demo/film.js:210-221        合成顺序
styles/crayon-book/demo/film.js:237-246        subTo
styles/crayon-book/demo/gl.js:65-80            FS_CRAYON 蜡附着
styles/crayon-book/demo/gl.js:83-109           FS_WASH 水彩 + 蜡防水
styles/crayon-book/demo/gl.js:112-135          FS_FINAL 浮雕/暗角/台灯
styles/crayon-book/demo/crayon.js:35-70        line
styles/crayon-book/demo/crayon.js:80-141       fill
styles/crayon-book/demo/crayon.js:198-222      text
styles/crayon-book/demo/pal.js:2-19            12 支蜡笔 + 水彩
styles/crayon-book/demo/world.js:132-136       BANDS 三道水彩
styles/crayon-book/demo/music/score.py:1-2     3/4 72 BPM F 大调 52.0s
styles/crayon-book/demo/mix.py:22-28           蜡笔刮纸
styles/crayon-book/style.json:16-17            frame_sec 43.68 / dur 52.0
```
