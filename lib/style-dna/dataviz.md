# 数据叙事（dataviz）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《A Hundred Summers》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「**图表本身就是电影**」的片子：每一个标记都是一个真实的数，每一次运动都是一个有意义的图表操作；数据真实、开放授权、可追溯，你改的是取景，**永远不改数字**。

**它不是**：仪表盘（一次只讲一个想法）、带图表的发布会（没有幻灯片）、装饰。
（`STYLE.md:25`）

**让它成为故事的三层**：人的尺度（手写批注钉在标记上）、表演者（一支真的红蓝铅笔在画每一个标记）、可听化（每个标记是一个音高，趋势先被听到再被读到）。（`STYLE.md:23`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸** | 暖米色 `#F6F3EC`；固定种子纤维噪声 + 世界空间淡点阵 24px `#E4DDCF`。 |
| **墨** | 暖近黑 `#2B2723`（轴 1.4–1.6px、系列线 2.4px）；网格 `#DDD6C9` 1px；零线 `#BDB4A5` 1.3px；刻度 IBM Plex Mono 17–20px `#6E665C`。 |
| **标记** | 数据点 r=6px + 1.5px 墨环；落点 pop 0.25s（×1.55）+ 细涟漪；间隔 <0.1s 抑制涟漪。 |
| **手写** | Caveat 30px；逐字 ±1.7° 旋转、±2.5% 基线、16% 像素挖空做颗粒；引线是抖动曲线，末端一个**不闭合**的圈。 |
| **红蓝铅笔** | 六角笔身、蓝半/红半、削尖木锥 `#E3C79C`；只露笔尖、从右下角进来（35–58°）；抬起越高影子越远越软。 |
| **版面** | 固定在世界空间的绘图框（1500×520）；一个「记忆区」给早期批注；每条批注钉在**数据空间**（值 + 像素偏移）；底部 150px 给字幕。 |
| **颜色** | 只编码**一件事：值**。发散数据用以参照期均值为中心的对称色带（RdBu 家族）；无自然中心用单条顺序色带；浅值保持浅，**绝不拉伸色带来做大变化**。 |

**色带（实测）**：`u = (v − centre) / half`，`#2166AC → #4393C3 → #92C5DE → #D1E5F0 → #F2EEE8(中心) → #FDDBC7 → #F4A582 → #D6604D → #B2182B → #7A0F1E`；中心 = 1971–2000 均值 0.22°C，半跨度 0.85°C（`engine.js:15-16`、`engine.js:29`）。

**两色铅芯的含义**：**蓝 = 记忆与人**，**红 = 记录与警告**；换铅芯标记一次转折（`STYLE.md:39`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位克制的数据记者 / 纪录片旁白。第三人称、现在时为主，偶尔回到过去时讲一个人的一生。

**长度（实测）**：demo 5 行 **38–70 个字符**；最短 `The next summer hasn't been drawn yet.`（38 字符），最长 `This summer, she turned one hundred. It was the warmest ever measured.`（70 字符）。

**字幕就是图的图注**：Newsreader 42px、墨色、与图左对齐、≤2 行、上方一条发丝线、一个小号等宽 kicker 标出「目前画到的年份区间」；词按各自时间戳在纸色带上浮现；停留 ≥ `max(1.8s, 语音 + 0.6s)`。**签名式图表操作或静默上不排字幕**（`STYLE.md:44-46`）。

**句首类型**（示例性，不是抄原文）：
- 先定义标记：`Each dot is one summer: the whole planet's average temperature.`
- 用时间跨度起句：`For fifty years, her summers barely moved.`
- 转折推进：`Then the dots began to climb, and they never came back down.`
- 人的尺度 + 极值：`This summer, she turned one hundred. It was the warmest ever measured.`
- 关于未知的收束：`The next summer hasn't been drawn yet.`

**这个风格里不会出现的句式**：第一人称抒情；营销腔、`amazing`/`shocking` 式话术；在急速段/静默/变形上压旁白；念出超过画面所印的数字。

---

## 3. 叙事节奏

**信息投放顺序**：

```
冷开场在一个点上
  → 标题拉远（下垂线变成 x 轴，标题在图上排字）
  → 早年稀疏的点
  → 稳定的中段
  → 加速（批注变密、铅笔变快）
  → 破框（笔一顿、翻到红端）
  → 急速
  → 一切在半拍之前停住；全片唯一一次硬切，切进静默
  → 最后一个数据点单独出现
  → 整条系列在一个视图里
  → 变形为条纹
  → 更长的真实记录
  → 一个给未知值的空槽
  → 片尾卡住在这个空槽里
```

**时间挂在 90 BPM、4/4 网格上**：1 拍 = 0.667s，1 小节 = 2.667s（`timeline.js:3`）。

**节奏用「细分拍子」加速，不改速度**（`timeline.js:8-15`）：7 个点在四分音符上 → 24 个在八分 → 40 个在十六分 → 27 个在三十二分（**每 2 帧一个点**）。

| 关键拍（k） | 事件 |
|---|---|
| 1 / [1.4,3.3] | 出生 / 写 1926 |
| [4,5.5] / [4.2,5.1] | 轴 / 标题 |
| [8.4,10] | 网格 |
| 40 / [40.0,40.5] / [40.5,41.0] | 破框 / 惊跳 / 翻红 |
| [41,41.5] | 重量程 |
| 46.5 | **停（半拍之前；全片唯一硬切）** |
| 48 / [48.75,50.75] | 2026 单独 / 写 2026 |
| [51,55] / [56,57] | 拉远 / 变形 |
| [60,64] | 尺度切换（加入更早记录） |
| [64,65] / [65,66] | 静默 / 空槽 |
| [68,75] | 片尾卡 |

**总时长**：`DUR = T(75) = 50.0s`（`timeline.js:36`、`style.json:17`）。

**静默怎么用**：最后一个点之前 **1.0s 真的数字静默**（所有层），空槽之前 0.67s 近静默。它们之后的第一声最重要——最后一个「嗒」加它的音符，然后是空槽的第一笔（`DEMO.md:46`）。

---

## 4. 镜头逻辑

**镜头是什么**：一台在**一整张纸**上移动的 2D 摄影机 `{x, y, zoom, roll}`。一部片就是一镜到底，硬切很少且有意义。

**词汇表**（用法由主题决定）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 极特写在一个标记上、跟引线 | 一个事实、一条命 | 单个案例；有名有姓的人 |
| 先给全图、再俯冲到标记 | 先看模式、再看个案 | 熟悉的趋势；要被纠正的误解 |
| 随轴从标记里长出来而拉远 | 框随单位一起到来 | 给度量命名；扩大断言 |
| 跟踪铅笔，最新点在 ~60% 宽 | 进度：过去在后、未来在前 | 时间序列；比赛；队列 |
| 随数据升高机位、荷兰角进来 | 升级、不安 | 失控增长；一笔债 |
| 2 帧内推近 + 衰减抖动 + 重量程一顿 | 意外、被打断的框 | 离群值；崩盘 |
| 快速拉出 + 侧倾 + 恒定震颤 | 一阵急冲 | 暴涨；连锁；恐慌 |
| 锁死机位 | 变形本身就是运动 | 变形；慢读 |
| 停在一个标记再拉远 | 整体里的那一部分 | 裁决；语境 |
| 拉远并平移加入更多真实数据 | 切换尺度 | 更长的记录；清单其余部分 |
| 横移过记忆区里的批注 | 回忆 | 生平；事件串 |

**取景**：关键瞬间主体填满 ≥1/3 画幅高度；真实轴滚出屏幕时，把刻度标签钉在画面边缘的纸带上（冻结窗格，`STYLE.md:74`）。

**允许的转场**：轴生长、拉远、重量程、变形、格子变宽成下一帧。

**禁止**：淡出到空白、溶解；不是图表操作的转场；在签名式图表操作或静默上压字幕；把旁白放在急速段/静默/变形上。

---

## 5. 表达习惯（idioms）

1. **一个标记 = 一个事实。**
2. **轴随故事生长**：y 轴在旁白第一次给单位命名时到来。
3. **钉住的批注**：内容与颜色承载叙事弧（蓝=记忆与人、红=记录与警告）。
4. **打破画框**：图表必须让出空间；撕裂的边缘留下伤疤。
5. **编码变形**：柱变成华夫图、地图变成排名、线变成斜率。
6. **尺度切换**：一个值 → 该系列 → 更长的真实记录，**绝不外推**。
7. **空的下一个格子**：一个虚线槽，留给没人知道的那个值。
8. **可听化即音乐**：音高 = 值、节奏 = 时间密度。

---

## 6. 氛围

一张铺在桌上的暖米色纸、一支红蓝铅笔、一堆手写便签：有纸和石墨的味道；安静、耐心、被认真对待。整体是**诚实、可追溯、有人的温度**的气质，而不是冷冰冰的仪表盘。

---

## 7. 声音

- **环境声跟随批注唤起的地点**（J-cut 进、L-cut 出）：房间底噪 → 傍晚蟋蟀 → 海（在 `1933` 前 J-cut、后 L-cut）→ 随温度更响更密的蝉（爬升前 J-cut）→ 静默后的开阔风声 → 房间底噪（`DEMO.md:42`）。
- **可听化就是音乐**：`midi = 62 + (v + 0.4) × 17`；低于中心的音吸附到 D 大调五声；只在最后 ~15 个点上失谐（5→45 音分）；静默前最后一个音最不协和（最大失谐 + 小二度影子），静默后最后一个点是全片最干净最高的音（`score.py:33-34`、`score.py:70-71`）。
- **拟音**：石墨、纸与木头——笔尖「嗒」、手写刮擦、画轴尺子嘶声、破框时纸张被戳破、翻笔木头咔哒、重量程棘轮齿、变形纸张扫过（`mix.py:31-54`）。
- **床**：失谐锯齿 pad、软 kick、噪声沙锤、低通 hat、正弦 sub、采样保持 blip、drone；和声随数据变暗或变亮。
- **静默是工具**：数据应被单独听到处用真数字静默（所有层）。
- **混音**：音乐在人声下压 ~−11 dB、蝉声 −6 dB；旁白在 300–4000Hz 的 SNR 8.6–16 dB；整体 −14 LUFS、无颗粒。旁白绝不在急速段/静默/变形上说话。

---

## 8. 变化空间（可自由发挥）

数据集、图表类型、人的尺度、批注、开场、结尾、镜头路径、节奏与静默。

`STYLE.md:115-117` 给了远离 demo 的方向：
- **结构**：一场排名赛（柱子往上爬并互相超越；一根柱子是主角；一个新手从下方破框而入）；一张地图变成一个计数（点随事件聚到地图上，然后在一个变形里落成一张人数单位图）；之前→之后的对话（两年以斜率图面对面，一条线留着没画完）。
- **开场**：一张已经画完的图（整个模式已画好，片子倒着讲）；先给物件再给轴（铅笔画出被测量的东西——一张票、一只鞋——它变成第一个标记）；先给问题（一张只有单位和一句手写问题的空图，铅笔悬着）。
- **结尾**：一个标记、很近（落在一个单独的值和它的批注上，绝不给全图）；回到物件（图表折成它所测量的那个东西的画）；改标题（铅笔划掉标题里的一个词、写上正确的那个）。

---

## 9. 禁忌清单

- 仪表盘（一次只讲一个想法）。
- 带图表的发布会（没有幻灯片）。
- 纯装饰（每个标记必须是真实的数）。
- 改数字来制造戏剧性（只改取景）。
- 把色带拉伸来把变化做大。
- 外推（尺度切换只能切到更长的真实记录）。
- 淡出到空白、溶解等非图表操作的转场。
- 照抄任何真实图表、版面或字体。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

- **真实数据集**（开放授权、可追溯；demo 用 NASA GISTEMP v4 的 `JJA` 列，按**表头名**取列而非索引）。
- `timeline.js`：90 BPM 网格、年份→拍映射、每个关键拍、图表几何（**唯一真值**）。
- `lines.json`：每行 `{id, t, text, voice, speed, asr?, hold?}`，demo 用 `af_alloy`、speed 0.92、5 行；whisper 把数字写成阿拉伯数字，故 `asr` 写 `For 50 years…`。
- 批注（内容 + 颜色 + 数据空间锚点）；强调色（可绕过色带，给非数据标记）。
- ⚠️ **打印旁白声称的每一个事实**（`DEMO.md:77`、`STYLE.md:98`）。

### 10.2 新画面元素的契约

用引擎画：
- 任意折线 `pencilStroke(g, pts, {color,width,progress,seed,wobble,passes,grain})`（铅笔 + 写入手感，返回笔尖）。
- 任意闭合形状 `inkShape(g, path, {fill|value, hatch, progress})`。
- 任意路径采成点线序列 `plotShape`；填成条纹 `stripesFill`。
- 手写 `handText`；印刷字 `setType`；数据点 `dataDot`；点→条纹变形 `morphMark`。
- 批注几何 `leader / ringPath / wavePath / heartPath / bracketPath / sparklePath / quadPath`。
- 空槽 `dashedCell`；铅笔 `drawPencil`；字幕 `caption`。
- ⚠️ `pencilStroke` / `dashedCell` / `dataDot` 会自己设 `globalAlpha`（`DEMO.md:83`）。

### 10.3 时间线契约

`timeline.js` 是**唯一真值**：导出 `BPM/B/BAR/T`、`LIFE0/LIFE1`、`yearK(y)`、`lifeYears()`、关键拍 `K`、`DUR`、图表几何 `U/X/BOX/BAND`。
`film.js` 导出 `setData(d)`、`setCaptions(lines,dur,words)`、`subs()`、`renderFilm(g,t,opt)`、`buildEvents()`；页面契约 `window.READY / window.render(t) / window.DUR / window.EV`。

### 10.4 事件词汇

事件由 `buildEvents()` 产生（供 mix.py）：每个数据点一个 `dot_{year}`（落点「嗒」+ 可听化音符）、`tap2026`（最干净最干的「嗒」）、`celltap`（空槽第一笔）、破框/惊跳/翻红/重量程/变形/静默等命名事件。
`tools/cuecheck.py` 用 **107 个 cue** 对配乐校点（最大偏差 0.03ms）。

---

## 11. 构建链（复用机制）

```
1. 下载数据集并写抽取器；打印旁白将声称的每个事实。
2. 先写 timeline.js（网格 + 年份→拍映射），再动笔。
3. 建 engine.js，再建 film.js，从真引擎渲 gate 帧（still.mjs --range）。
4. sh demo/build.sh 约 2 分钟重建全部：
   extract → TTS → whisper → words → events → score → cuecheck（107 cues，max 0.03ms）
   → mix → 字幕 → render（1200 帧）→ mux（−14 LUFS，grain 0）→ styleframe / poster
5. 复审：最终 mp4 的 1s 接触表两遍（错开 0.25s）、破框/硬切/变形的 0.1s 帧条、
   逐行 whisper、采样级静默检查。
```
（`DEMO.md:77-81`）

---

## 12. 证据

```
styles/dataviz/STYLE.md:8            本质
styles/dataviz/STYLE.md:12-21        按数据选图表
styles/dataviz/STYLE.md:23           三层：人的尺度/表演者/可听化
styles/dataviz/STYLE.md:25           不是什么
styles/dataviz/STYLE.md:29-33        材料与渲染
styles/dataviz/STYLE.md:37-40        颜色逻辑
styles/dataviz/STYLE.md:44-46        字体与字幕
styles/dataviz/STYLE.md:50-54        运动质量
styles/dataviz/STYLE.md:58-74        镜头语法表 + 取景
styles/dataviz/STYLE.md:78-82        声音
styles/dataviz/STYLE.md:88-94        native moves
styles/dataviz/STYLE.md:113-117      变化空间
styles/dataviz/DEMO.md:3             不要复用故事/叙事弧/镜头/道具/时长
styles/dataviz/DEMO.md:8             NASA GISTEMP v4 JJA
styles/dataviz/DEMO.md:14            故事形状
styles/dataviz/DEMO.md:16            101 点/3 蓝批注/2 红批注/一次破框/最后一个点给静默
styles/dataviz/DEMO.md:20-32         逐拍镜头表
styles/dataviz/DEMO.md:38            运动数值
styles/dataviz/DEMO.md:42-49         配乐结构
styles/dataviz/DEMO.md:53-60         调色板与道具
styles/dataviz/demo/timeline.js:3            BPM 90
styles/dataviz/demo/timeline.js:8-15         yearK 加速
styles/dataviz/demo/timeline.js:19-35        关键拍 K
styles/dataviz/demo/timeline.js:36           DUR = T(75) = 50.0s
styles/dataviz/demo/timeline.js:39-42        图表几何
styles/dataviz/demo/engine.js:9-13           调色板 P
styles/dataviz/demo/engine.js:15-16          RAMP 色带
styles/dataviz/demo/engine.js:29             valueColor
styles/dataviz/demo/engine.js:78             drawPaper
styles/dataviz/demo/engine.js:102            pencilStroke
styles/dataviz/demo/engine.js:137            ringPath
styles/dataviz/demo/engine.js:177            handText
styles/dataviz/demo/engine.js:210            dataDot
styles/dataviz/demo/engine.js:231            morphMark
styles/dataviz/demo/engine.js:244            dashedCell
styles/dataviz/demo/engine.js:279            drawPencil
styles/dataviz/demo/engine.js:322            caption
styles/dataviz/demo/engine.js:380            inkShape
styles/dataviz/demo/film.js:68-79            trackPose
styles/dataviz/demo/film.js:80-117           camAt
styles/dataviz/demo/film.js:130-131          右对齐批注的跳
styles/dataviz/demo/film.js:298              renderFilm
styles/dataviz/demo/film.js:453              buildEvents
styles/dataviz/demo/music/score.py:33-34     pitch 公式
styles/dataviz/demo/music/score.py:70-71     失谐只在最后 15 个点
styles/dataviz/demo/mix.py:1-3               三层 / 音乐 ~−8 dB / 两处真静默
styles/dataviz/demo/mix.py:31-54             铅笔/手写/尺子/破框/木头
styles/dataviz/demo/mix.py:102-115           房间/蟋蟀/海/蝉/风
styles/dataviz/style.json:16-17              frame_sec 42.0 / dur 50.0
```
