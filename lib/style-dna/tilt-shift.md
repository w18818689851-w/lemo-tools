# 移轴微缩（tilt-shift）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Toy Town Rush Hour》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「从高空用移轴镜头 + 延时相机拍一个真实地方」的片子：**画面里只有一条水平的窄带是清晰的**，上下都融进模糊——眼睛把这读成微距拍小东西，于是整个世界变成了模型。另外两件事让这个把戏成立：**饱和的阳光色**（模型火车漆）和**延时**（车与人像发条玩具一样跳着快进）。

**它不是**：玩具或黏土渲染（世界是写实的，只有镜头与时钟把它变小）、游戏俯视图（没有 UI、没有干净平涂）、无人机航拍（虚化带、饱和度、跳帧是必须的）。
（`STYLE.md:10`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **机位** | 永远在高处。斜视约 45–55° 俯角、100–200m 距离、中长焦（垂直 FOV ~27–30°）；最像「棋盘游戏」时用垂直俯拍。真实移轴从不在街面高度拍——除非一个刻意的亲密时刻：在演员高度来一个真正的中景近景（`STYLE.md:14`、`DEMO.md:29`）。 |
| **虚化带** | 物理景深与屏幕空间上下虚化带**混合**：像素 CoC = `mix(aper·(1/focus − 1/z), sign(dy)·amp·(max(0,|dy|−w)/0.5)^1.2, mix)`，clamp ~30px（`post.js:27-43`）。带子放在主体上，主体动则每帧投影到屏幕并滑动；要亲密感就收窄。 |
| **gather** | 2× 超采样渲染后在输出分辨率做，128 个螺旋采样 + 逐像素随机旋转；★ **更远的样本不能糊到更近的清晰物体上**（`post.js:46-71`）。 |
| **调色** | 中性色调映射 + 强饱和（demo ×1.55）+ 柔和加对比（+0.42）+ 略暖高光 + 暗角（0.3）；夜里降饱和（`post.js:108-119`、`DEMO.md:46`）。 |
| **光** | 硬太阳 + 锐利阴影（每镜头拟合一张大 shadow map）、低半球填充带暖地面反弹（阴影保持蓝而不浑浊）、天光渐变环境贴图。★ **逐镜头骗太阳方位角**（`STYLE.md:17`、`DEMO.md:84`）。 |
| **模型感细节** | 立面多种窗型、1.6–3m 开间、深窗洞、世界空间污渍、反射天光的玻璃、越靠地面越暗的墙；屋顶杂物、遮阳篷与招牌；磨损标线与污迹；车有暗玻璃、柔和接触阴影与刹车灯；一切叠 AO（`STYLE.md:18`、`DEMO.md:49`）。 |
| **人** | 小彩色胶囊（模型火车小人）。近处演员要有有机身体 + 柔和 sheen 材质，并**放大 20–30%** 才读得出来（`STYLE.md:19`、`DEMO.md:45`）。demo 鸭子用 `MeshPhysicalMaterial`（roughness .92、sheen 1、sheenRoughness .55）（`ducks.js:20-22`）。 |

**关键取向**：`STYLE.md:18` 把「模型感细节」列成「拍出来的微缩」与「游戏 CG」的分界——世界必须是写实的，只有镜头与时钟把它变小。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位放松的旁白在看一个玩具城醒来。第三人称、现在时、短句、带一点玩味。demo 用 Kokoro `am_adam`，speed 0.9–0.95，5–6 句短话。

**长度（实测）**：单句 **24–36 字符**（约 5–7 英文词）。最短 `Every song needs a rest.`（24 字符），最长 `By eight, the whole town is playing.`（36 字符）。硬规则：字幕停留 ≥ `max(1.8s, 语音时长 + 0.6s)`（`STYLE.md:30`）。字幕属于**世界自己的标识系统**：一块用当地招牌语言的牌（路牌、站台牌、港口通告…），用 Overpass（OFL，Highway-Gothic 复兴），坐在下虚化带里（`STYLE.md:30`、`DEMO.md:55`）。★ 数字必须写成单词、把数字放进 `asr` 字段（`STYLE.md:66`）。

**句首类型**（示例性，不是抄原文）：
- 用时间起句：`Six a.m. One car. One note.`
- 用一个普遍规则起句：`Every green light adds a beat.`
- 用一个具体时刻 + 一个具体角色起句：`The seven-forty brings the bass.`
- 用「到某个时刻，整个地方…」起句：`By eight, the whole town is playing.`
- 结尾用一句「从头再来」的命令收束：`Then… take it from the top.`

**这个风格里不会出现的句式**：
- 第一人称抒情与内心独白（靠速度、虚化带和系统承载情节）
- 网络口播腔、感叹号堆叠、营销话术
- 长复合句（单句 >36 字符会盖过一次速度变化）
- 抽象概念当主语（只说能在这个地方被拍到的东西）

---

## 3. 叙事节奏

**信息投放顺序**：

```
安静（黎明一条光轨）
  → 系统醒来（演员变多、节奏建立）
  → 最大密度
  → 硬掉到真实速度（一个细节：鸭子一家过马路，失败一次再成功 = 喜剧拍）
  → 放行回到快进
  → 上升到一个尺度揭示（整座城变成电路板）
```

**时间挂在 120 BPM 网格上**：1 拍 = 0.5s，1 小节 = 2.0s（`story.js:4`）。

| 层 | 停留规则 |
|---|---|
| **延时跳帧** | 快进时整个世界以低速率更新、每个位置保持若干帧（8 Hz = 24fps 下 3 帧）；★ 选这个速率让每一次跳都落在音乐网格上（`STYLE.md:36`） |
| **跳帧速率分档** | 快进 8 Hz、×2 与 ×6 之间 12 Hz、×2 以下变平滑（`DEMO.md:50`） |
| **相机** | **每一帧都是平滑的**（`STYLE.md:36`） |
| **关键时刻** | rampDown=[22.5,24.0]（×40→×1）/ rampUp=[30.0,30.6] / hops=[24.8,25.6,26.4,27.1,27.8,29.4] / release=30.0 / finalChord=34.0（`story.js:6-16`） |
| **速度曲线** | t<22.5 → ×40；22.5–24.0 用 smoothstep 从 ×40 降到 ×1；24.0–30.0 → ×1；30.0–30.6 升回 ×40（`story.js:23-29`） |
| **镜头切分** | dawn/title/ix/train/jam/ducks/rise/end（`story.js:17-19`） |
| **字幕** | ≥ `max(1.8s, 语音时长 + 0.6s)`（`STYLE.md:30`） |

**总时长**：主 demo 38.0s（`story.js:5`；`style.json` dur=38.0，frame_sec=22.8）。

**静默怎么用**：静默是**真实时间到来的那一刻**：切掉音乐，只留一两个真实声音（`STYLE.md:65`、`DEMO.md:39`）。demo 的实时掉速是一个 **tape-stop**：varispeed 1 → 0.22，声部一个个退出，然后真静默；休止里每个故事事件只弹一个柔和的音，每次鸭子跳一级音阶（`DEMO.md:36`）。

---

## 4. 镜头逻辑

**镜头是什么**：一台从高处俯视的移轴相机：**清晰带就是它的「视线」**，它把注意力沿画面滑动、收窄或交给另一个主体；它永远保持高机位，只有在亲密时刻才降到演员高度。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 高空斜视广角 + 极慢滑动 | 一眼看整个系统 | 交代地点；日常；很多小演员 |
| 虚化带跟着一个主体横移 | 「就这一个」 | 一个通勤者；一次投递；一个走失的孩子 |
| 虚化带从一主体拉焦到另一主体 | 注意力易手 | 因果；一次交接；一次比较 |
| 缓慢推向路口/车站/货场 | 一个系统在升温 | 早高峰；一个节庆在布置；一条队伍 |
| 垂直俯拍、缓慢旋转 | 世界作为棋盘或机器 | 图案；物流；编排 |
| 从高空连续俯冲到演员高度并变速 | 那一件重要的小事 | 一个转折；一个笑点；一次相遇 |
| 虚化带收窄成一条缝 | 亲密 | 一次坦白；一次重逢；一个决定 |
| 对数高度的垂直上升 | 尺度、放手 | 余波；一个总结；系统变成图案 |
| 沿一条线（铁路/河/公路）横移 | 一个按顺序发生的过程 | 供应链；一次游行；一场比赛 |
| 锁死机位跨越数小时 | 时间就是演员 | 一次施工；一个集日；潮汐 |

**允许的转场**：在拍点上硬切、速度坡（变速）、俯冲与上升。

**禁止**：溶解/叠化（会暴露假镜头）；低机位（除非是刻意的亲密时刻）；无来由的运镜；让相机跟着跳帧（相机每一帧都必须平滑）。

---

## 5. 表达习惯（idioms）

1. **速度掉落（×40 → ×1）**：时间在一个细节上砸回真实速度。
2. **虚化带当指针**：滑动或收窄那条清晰带，把视线引过去。
3. **上帝视角的系统**：地方作为音序器或机器。
4. **长曝光光轨**：黄昏时灯留下轨迹，在世界里画线。
5. **尺度揭示**：一直升到地方变成图案。
6. **云影扫过**：天气穿过模型。
7. **延时跳帧 = 灵魂**：世界以低速率跳步，相机保持平滑。
8. **失败的第一次**：一次没成功的尝试在成功之前——喜剧引擎。

---

## 6. 氛围

一个真实地方被从高空当成模型来看：阳光、饱和的漆色、干净的蓝影；清晰带之外一切都化开。整体是**明亮、有秩序、被时钟驱动、带一点玩味**的气质。

---

## 7. 声音

- **乐器**：**有音高的打击乐承载风格**——马林巴、钟琴、颤音琴、木鱼、卡林巴、钢片琴；脉冲式、极简（Reich 语法：相位、声部一个个加入、脉动和弦）；再加拨弦或小编制簧管。**不要**通用钢琴与弦乐（`STYLE.md:62`）。demo：采样极简马林巴合奏、120 BPM（8 Hz 延时跳帧正好是十六分音符）；**固定乐句骨架，城市事件决定哪些音发声**（`DEMO.md:33`）。
- **声音跟着速度走**：延时段以音乐为主，配很轻的「加速城市」颗粒底噪、轨道咔哒、变灯继电器；真实速度段世界突然变真——怠速引擎、远处车流、麻雀、细小的鸭叫与啾声、蹼掌拍柏油；放行时引擎轰鸣、上升段风起（`STYLE.md:64`、`mix.py:17-102`）。
- **混音规则**：人声放松、少数几句短话；音乐在人声下 duck ~8 dB（demo 实际 `1 − 0.6·vk`）；整体 −14 LUFS（`STYLE.md:66`、`mix.py:127-136`）。★ 技术选项：世界事件 gate 固定乐句骨架的音（有基础填充率保证乐句可听）；tape-stop（varispeed 下降、声部退出）进静默；两条相同线相位错开；最小尺度用八音盒版主题（`STYLE.md:63`）。demo 先把整体推到 RMS≈−17 dB 再限幅在 −1.5 dBFS，让 mux 的两遍 loudnorm 能线性增益到 −14 LUFS（`mix.py:134-136`）。

---

## 8. 变化空间（可自由发挥）

地点、系统、那个很小的演员、结构、开场、结尾、镜头路径、速度曲线，以及颜色逻辑之内的调色板。所有方向都必须远离 demo 的《Toy Town Rush Hour》：

- **结构**：**一天，从黎明到夜**（一个锁死机位，太阳与阴影扫过，只有一家店的灯最后熄）；**接力**（虚化带把注意力从一个演员交给下一个，每个把某样东西递给下一个）；**前后**（一个工地从空地延时到开业，每个阶段配一个实时时刻）。
- **开场**：**满密度地在喧嚣中开场**，带子已经落在一个怪东西上；**一个俯视图案**慢慢倾斜成一个地方；**先真实时间**：一个人在演员高度，然后镜头抬起、时间加速。
- **结尾**：**掉到真实时间并停在那里**（不拉回）；**灯一盏盏熄灭**从高空看；**镜头解除移轴**：带子放宽到全清晰，模型变回一个真实地方。

同时可换：那个「被发现的」饱和主体、速度曲线、地点（地中海港口/雪山小镇/沙漠集市）。★ 但「虚化带 + 延时跳帧 + 高机位」这三条骨架不能拆（`STYLE.md:95-101`、`DEMO.md:12`）。

---

## 9. 禁忌清单

- 玩具或黏土渲染（世界必须写实，只有镜头与时钟把它变小）。
- 游戏俯视图（没有 UI、没有干净平涂）。
- 无人机航拍（虚化带、饱和度、跳帧是必须的）。
- 低机位（除非是刻意的亲密时刻）。
- 溶解/叠化（会暴露假镜头）。
- 让相机跟着跳帧。
- 一个固定太阳（会让半部片子背光发灰）。
- 照抄任何真实地点、地标、品牌或 logo。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

| 要素 | 说明 |
|---|---|
| **时间线** | `story.js` 的 `BPM/BEAT/BAR/DUR/T/SHOTS/shotAt`、`WINDOWS`（每个时间窗有自己的城市时钟起点 `clock0` 与倍率函数 `rate(t)`）、`clockAt/fmtClock` |
| **旁白** | `story.js` 的 `VO`，每条 `{id, t, text}`，5–6 句；数字写成单词、数字放 `asr` |
| **地点与系统** | `city.js` 程序化城镇 + 立面着色器 + 招牌、`geo.js` 合并几何、`sky.js` 时钟→太阳/天空/雾/环境图 |
| **交通** | `traffic.js` 车道/灯/IDM 仿真/车队/光轨/行人 |
| **英雄演员** | `ducks.js` 车削鸭子 + 跳跃编排 |
| **调色与虚化带** | `post.js` 的 `TiltPass` 参数与 grade |
| **音效事件** | events.json |

### 10.2 新画面元素的契约

用 `geo.js`（合并几何构建器）+ `city.js`（程序化城镇/立面着色器/招牌）搭；动态系统用 `traffic.js`（车道、灯、IDM 跟车仿真、车队、光轨、行人）与 `train.js`；有生命的英雄演员参考 `ducks.js` 的车削（`LatheGeometry` 身体 + `MeshPhysicalMaterial` sheen 绒毛 + 接触阴影 blob）与 `duckState` 编排（过街/跳路沿的预备压缩→起跳拉伸→落地压缩→回弹，失败一次再成功）。虚化带用 `makePost` 返回的 `dof.band = {y,w,amp,mix,tilt,pow}` 控制。

### 10.3 时间线契约

`story.js` 是唯一时间真值：导出 `BPM/BEAT/BAR/DUR/T/SHOTS/shotAt`、`WINDOWS/windowAt/clockAt/fmtClock`（把成片秒数映射到「城市时钟」，每个窗口一个倍率曲线，用 1ms 步长预积分保证确定性）、`VO`、`TITLE`。`main.js` 负责相机、跳帧（stepping）、人群、HUD 与事件；`mix.py` 读 events.json 做环境/拟音/人声/配乐；`subs.mjs` 导出字幕。页面契约（`main.js`）：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 |
|---|---|
| `light{win}` | 变灯继电器（按窗口区分） |
| `carriage{k}` | 列车车厢过钢轨接缝的咔—嗒 |
| `duckStep{i}` | 蹼掌拍柏油 |
| `hop` / `hopFail` | 跳 / 跳失败 |
| `quack{soft}` / `peep{happy}` | 鸭叫 / 小鸭啾声 |
| `splash` | 入水 |
| `vo{id}` | 人声（mix.py 从 voices/<id>.wav 读） |

另有一批**硬编码在 mix.py 里的**同步拟音：`.5` 的红车驶过、`2.98` 绿灯、`16.2–18.4` 的列车进站（squeal/hiss/chime）、`19.3–22.3` 的堵车喇叭、`22.45` 的 tape-stop、`29.85` 的放行引擎（`mix.py:87-102`）。

---

## 11. 构建链（复用机制）

```
styles/tilt-shift/demo/
  post.js   移轴景深（带 + 物理）+ 调色      city.js  程序化城镇、立面着色器、招牌
  geo.js    合并几何构建器                   sky.js   时钟 → 太阳/天空/雾/环境图、黎明辉光
  traffic.js 车道、灯、IDM 仿真、车队、光轨、行人   train.js 通勤列车
  ducks.js  车削鸭子 + 跳跃编排               story.js  120 BPM 时间线、时间窗、倍率曲线
  main.js   相机、跳帧、人群、HUD、事件        mix.py   环境 + 拟音 + 人声 + 配乐
  music/score.py  采样马林巴配乐（骨架 + 事件 gate）   subs.mjs  字幕导出
```

1. `sh styles/tilt-shift/demo/build.sh` 从零重建全部：TTS → whisper → events → 字幕 → 配乐 → 混音 → 912 帧渲染（M 系 GPU 3 worker 约 60–80s）→ mux（−14 LUFS，grain 1）→ styleframe 与 poster。
2. 迭代用 `node core/render/still.mjs styles/tilt-shift/demo <t…> --q noev`（`noev` 跳过事件扫描）。调试开关：`nohud`、`nodof`、`nostep`、`az=<deg>`、`cam=x,y,z,lx,ly,lz,fov`、`aper=`、`bamp=`、`bmix=`。

（`DEMO.md:59-72`）

---

## 12. 证据

```
styles/tilt-shift/STYLE.md:6-10           本质 + 不是什么
styles/tilt-shift/STYLE.md:12-19          材料与渲染（机位/虚化带公式/调色/骗太阳/模型感细节/人）
styles/tilt-shift/STYLE.md:21-26          颜色逻辑
styles/tilt-shift/STYLE.md:28-32          字体与字幕（世界标识系统/延时时钟）
styles/tilt-shift/STYLE.md:34-39          运动质量（延时跳帧/8Hz=3帧/相机平滑/英雄定时/压缩拉伸）
styles/tilt-shift/STYLE.md:41-58          镜头语法 + 构图 + 转场
styles/tilt-shift/STYLE.md:60-66          声音
styles/tilt-shift/STYLE.md:68-77          六个 native moves
styles/tilt-shift/STYLE.md:79-89          媒介陷阱
styles/tilt-shift/STYLE.md:95-101         变化空间
styles/tilt-shift/DEMO.md:3               不要复用故事/弧线/镜头/道具/时长
styles/tilt-shift/DEMO.md:5-6             demo 38s
styles/tilt-shift/DEMO.md:8-16            故事 + 改编配方 + 38s 弧线 + native powers
styles/tilt-shift/DEMO.md:18-29           逐镜表 + 近景/斜视具体数值
styles/tilt-shift/DEMO.md:31-41           配乐（马林巴/事件 gate/tape-stop/声音设计/人声）
styles/tilt-shift/DEMO.md:43-51           调色板与道具（grade/虚化带/光/立面/交通/英雄演员）
styles/tilt-shift/DEMO.md:53-57           字幕/延时时钟/片尾卡
styles/tilt-shift/DEMO.md:59-72           构建链
styles/tilt-shift/demo/story.js:4-5            BPM 120 / DUR 38
styles/tilt-shift/demo/story.js:6-16           关键时刻表 T
styles/tilt-shift/demo/story.js:17-20          SHOTS + shotAt
styles/tilt-shift/demo/story.js:23-29          jamRate ×40→×1→×40
styles/tilt-shift/demo/story.js:30-36          WINDOWS 五个时间窗
styles/tilt-shift/demo/story.js:38-42          1ms 预积分
styles/tilt-shift/demo/story.js:44-49          clockAt / fmtClock
styles/tilt-shift/demo/story.js:51-59          VO 6 行 + TITLE
styles/tilt-shift/demo/post.js:27-43           CoC（物理 + 屏幕空间虚化带混合）
styles/tilt-shift/demo/post.js:46-71           gather 128 采样 + 不糊到近清晰物体
styles/tilt-shift/demo/post.js:73-106          TiltPass
styles/tilt-shift/demo/post.js:108-119         grade
styles/tilt-shift/demo/post.js:121-129         makePost
styles/tilt-shift/demo/ducks.js:20-22          fuzzMat 绒毛材质
styles/tilt-shift/demo/ducks.js:24-50          makeDuck 车削
styles/tilt-shift/demo/ducks.js:60-76          pose 摇摆步态 + 接触阴影
styles/tilt-shift/demo/ducks.js:98-111         hop 预备/拉伸/落地回弹
styles/tilt-shift/demo/ducks.js:112-121        失败一次再成功
styles/tilt-shift/demo/mix.py:17-43            环境床
styles/tilt-shift/demo/mix.py:45-102           拟音与同步事件
styles/tilt-shift/demo/mix.py:110-136          配乐闪避 + 推电平
styles/tilt-shift/style.json:16-17             frame_sec 22.8 / dur 38.0
```
