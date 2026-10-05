# 瑞士动态排版（swiss-motion）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Five Rules for a Poster》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「国际主义排版风格被做成了动效」的片子：**模块网格、一种字体、一种信号色**，运动像印刷机一样精确。平面纸、黑字与黑条、一种很浅的灰、以及唯一一种饱和的信号色；每个元素都吸附到网格上，每次运动都落在拍点上，什么都不回弹。它的魅力是**严谨中的唯一例外**——整幅画面服从一套系统，于是唯一不服从的那个元素就变成了角色。

**它不是**：keynote（没有渐变、发光、设备渲染图）、歌词视频的动感字（词不飞不转不弹）、数据可视化（条块作为图形有质量，而不是被画出的数量）、包豪斯基本形状的仿作。
（`STYLE.md:13`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **画面网格** | 1920×1080，12 列，两侧边距 ~96px，栏距 24px（列宽 122px），基线 24px。画面可当**跨页**：左页 = 程序（数字、规则文本、注释），右页 = 作品（`film.js:11`、`DEMO.md:79`）。 |
| **作品网格** | 由内容推导（Gerstner）。★ 要**选能让元素有质量的模块尺寸**——太多细列会让版面像图表（`STYLE.md:18`、`DEMO.md:80`）。demo 的海报 = 706×1008、7 列 × 91px、16 行 × 40px。 |
| **表面** | 页 `#EAE9E5`、纸 `#FFFFFF`、墨 `#111111`、信号红 `#E30613`、网格线三种浅灰（在页 `#CFCEC9` / 建造中 `#C9C8C2` / 在纸 `#E2E1DC`）。**无渐变、无阴影、无粒子、无颗粒**（封装 grain 0）（`film.js:6-9`、`DEMO.md:81`）。 |
| **条与块** | 平面矩形；同一单元的相邻格合并成一条，接缝处**多画 1px**（抗锯齿会露细线，尤其旋转/缩放后）（`STYLE.md:20`、`DEMO.md:89`）。 |
| **第二声部** | 压在黑色元素下的浅灰元素：不引入第二种颜色就得到纵深（`STYLE.md:21`）。 |
| **相机** | 一台 2D 相机矩阵（中心、缩放、旋转）驱动所有运动（`film.js:231-241`）。 |

**关键取向**：`STYLE.md:19` 明确「没有渐变、没有阴影、没有粒子、没有颗粒」——这是纯 2D 平面排版，任何质感都必须来自网格与留白本身。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位冷静的设计讲师在念一套程序。第二人称祈使 + 现在时，规则式短句。Kokoro `af_sarah`，speed 1.0（它的 3–8kHz 辅音能量约为 `af_kore` 的 7 倍，所以更清脆）。

**长度（实测）**：单句 **9–45 字符**（约 2–8 英文词）。最短 `Only one.`（9 字符），最长 `Same five rules. A different song every time.`（45 字符）。硬规则：字幕停留 ≥ `max(1.8s, 语音时长 + 0.6s)`，并在代码里 assert（`STYLE.md:35`）。字幕是**版面的一部分**，不是底部的条：每行坐在当前构图里某一列的起点（小号灰色导语 + 大号粗体陈述），每个词按 whisper 时间戳做 clip 揭示（`film.js:58-67`）。

**句首类型**（示例性，不是抄原文）：
- 编号 + 祈使的规则句：`Rule one. Build a grid.`
- 编号 + 单动词指令：`Rule three. Leave space.`
- 一句反讽的评语：`Perfect. And a little dull.`
- 一条打破规则的命令：`Rule five. Break one rule.`
- 结尾用「同一套系统、不同结果」收束：`Same five rules. A different song every time.`

**这个风格里不会出现的句式**：
- 第一人称抒情与内心独白（靠网格、条块和那一个例外承载情节）
- 网络口播腔、感叹号堆叠、营销话术
- 长复合句（一句一个规则；>45 字符会盖过一个乐句）
- 抽象概念当主语（只说能被排到网格上的东西）

---

## 3. 叙事节奏

**信息投放顺序**：

```
开场（锁死全画幅，一个手势：一条红线横划，网格列从它身上按十六分音符长出来）
  → 建规则（锁死跨页，读者读「因[左页规则] → 果[右页作品]」）
  → 秩序完成（正确但有点乏味——说出来）
  → 犹豫（红元素抖动一下又吸附回去）
  → 打破（全片唯一一次线性、不吸附的运动；鼓组退出）
  → 其他元素在它周围重排，变得更好（全乐队回来）
  → 揭示（网格意味着什么：海报就是乐谱）
  → 尺度揭示（同一套系统，很多产出：海报墙）
  → 回到主角作品与片尾卡
```

**时间挂在 120 BPM 网格上**：1 拍 = 0.5s，1/8 音符 = 0.25s，1/16 = 0.125s，1 小节 = 2.0s（`ease.js:18`）。

| 层 | 停留规则 |
|---|---|
| **吸附** | 提前一个音符时值起步、**落在拍点**：`snap(t, t1, d=E8)`（`ease.js:21`） |
| **关键时刻** | circleIn=20.0 / pageOut=24.5 / fly0=24.5 / land=26.0 / reflow=26.125 / gridOff=27.5 / rot=30.0（旋转 1.5 拍）/ labels=30.5 / sweep=32.0 / wall=37.0 / cut=39.0 / home=40.0（`film.js:19-23`） |
| **网格线** | 列/行按十六分音符逐个长出（`film.js:197-204`） |
| **大数字** | `steps(t, a, b, 4)` 分 4 级升起（「一格一格」）（`ease.js:25-29`） |
| **字幕** | ≥ `max(1.8s, 语音时长 + 0.6s)`（`STYLE.md:35`） |

**总时长**：主 demo 44.0s（`film.js:5`；`style.json` dur=44.0，frame_sec=31.68）。文档给 30–60s 区间（`DEMO.md:30`）。

**静默怎么用**：静默是「一切在下拍上硬停」，下一个吸附读起来就像一个事件（`STYLE.md:72`）。demo 在「打破」那一小节**撤掉鼓组**，落位时回来；在揭示前加一小节近乎无声（贝斯踏板 + 四分音符滴答）；揭示期间只留 kick + bass + melody（`DEMO.md:62`）。

---

## 4. 镜头逻辑

**镜头是什么**：一台被精确缓动驱动的 2D 排版机位（中心、缩放、旋转）：它只在拍点上动，把画面当成一本可翻的册页——先读「因」在左、再看「果」在右。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 锁死跨页 | 因（左）→ 果（右） | 一条规则被应用；前后对比；比较 |
| 按一页或一列硬摇 | 系统里的下一步 | 一个序列；一份目录；一条时间线 |
| 旋转 90° 然后停住 | 同一件东西换一种读法 | 海报当作乐谱；图表当作地图 |
| 拉远到一面作品墙 | 一个程序，很多产出 | 品牌系统；产品线；一个系列 |
| 推进一个模块 | 细节；系统的单元 | 一个像素；一个字母；一个数据点 |
| 网格延伸出页面 | 系统比作品更大 | 尺度；野心；一次对约束的突破 |
| 把画面切成等分格 | 并列的多个案例 | 选项；变体；团队成员 |
| 沿一列纵向滚动 | 阅读；一份清单 | 一份宣言；一张规格表；一份时刻表 |

**允许的转场**：划像、刀切（一条线穿过元素，元素向中线塌缩）、相机运动、重排。

**禁止**：溶解/淡入淡出；任何元素的淡入（入场必须是划像或 clip 揭示）；回弹/弹簧/过冲；无来由的运镜。

---

## 5. 表达习惯（idioms）

1. **网格意味着什么**：列与行变成一个数量（音符、小时、楼层、年份）。
2. **吸附 = 拍点**：每一次到达都是一记打击乐。
3. **程序（programme）**：规则被一条条应用到一个作品上，然后同一套程序生成很多。
4. **极端尺度对比**：巨大的元素当章节卡，旁边是极小的技术注释。
5. **唯一例外**：一个元素线性、不吸附地打破网格。
6. **刀切**：元素被一条线删掉。
7. **重排**：其余元素围着一次变化重排，最近优先。
8. **唯一信号色**：只有一件东西是红的，所以红就是主角；也是唯一被允许不精确的东西。
9. **乐谱即画面**：图与乐共享同一份数据文件（列→音高、行→起点）。

---

## 6. 氛围

一张摊开的瑞士设计册页放在桌上：白纸、黑墨、浅灰网格线、一点信号红；没有阴影也没有质感，只有排版的空间。整体是**冷静、精确、理性、带一点冷幽默**的气质。

---

## 7. 声音

- **乐器**：音乐自带一套网格——一条稳定脉冲，其细分给出吸附时长。可选：motorik/krautrock 鼓组与贝斯、极简 techno、马林巴或颤音琴音型、机械钢琴固定音型、鼓机 + 钟琴；每加一条新规则就加一件乐器 = 一次清晰的 build。demo：Motorik 120 BPM、A 多利亚；逐条加层——只有 hi-hat → + 全套鼓组 → + 电贝斯八分根音 → + 锯齿琶音十六分 → + 钟琴（`DEMO.md:55-60`）。
- **动作声（跟印刷材料走，干、近、不加混响）**：铅字 clack（金属瞬态 + 3.3/5.1kHz 共振 + 木质托盘低频）、钢尺划线「嘶」、裁纸刀（带通扫频上升 + 金属 snick）、纸铺/纸滑、数字「咚」（每级一次）、条块吸附咔哒、红圆落地（58Hz 毡垫闷响）（`STYLE.md:70`、`mix.py:17-74`）。
- **混音规则**：人声压缩、比音乐高 ≥ 6 dB；音乐在人声下 duck ~−10 dB（demo 实际 `1 − 0.68·vad`，闪避包络提前 80ms 压下、释放 250ms）；整体 −14 LUFS（`STYLE.md:73`、`mix.py:89-96`）。★ 画面与音乐**共享同一个数据文件**（`score.json`：列→音高、行→起点、长度→时值），所以「海报就是乐谱」在代码里是真的（`score.json:22`）。**唯一例外是唯一会唱的元素**（一条跟随其位置的滑音）。

---

## 8. 变化空间（可自由发挥）

系统是什么、网格意味着什么、例外（或没有例外）、信号色、开场与结尾。所有方向都必须远离 demo 的《Five Rules for a Poster》：

- **结构**：**一份时刻表**（24 行小时的网格填满主题的一天，一拍一行）；**一套字母表**（A 到 Z，每个字母是主题的一个模块，网格像标本页一样完成）；**一次比较**（两套系统并排在一个跨页上，直到一个元素越过中缝）。
- **开场**：**一个单点**落在页面上，网格从它长出；**已完成的作品**被拆解回它的规则；**一个巨大的数字**填满画面，最后揭示它只是一个小版面里的一个细节。
- **结尾**：**空网格**（每个元素都被切走后）；**一个单词**齐左地待在角落；**例外离开画面**，系统合上它留下的空位。

同时可换：信号色（红/橙/群青/绿，选一个就不再加第二个）、作品网格的行列含义、字体族（OFL 新怪诞）。★ 但「吸附落拍 + 只有两种曲线 + 唯一信号色」这三条骨架不能拆（`STYLE.md:103-109`、`DEMO.md:18-28`）。

---

## 9. 禁忌清单

- keynote 式（渐变、发光、设备渲染图）。
- 歌词视频的动感字（词不飞不转不弹）。
- 数据可视化（条块作为图形有质量，不是被画出的数量）。
- 包豪斯基本形状的仿作。
- 溶解/淡入淡出等 UI 式转场。
- 回弹/弹簧/过冲（只有精确缓动与线性两种曲线）。
- 照抄任何历史海报的构图（不从 Müller-Brockmann 那里搬同心圆或扇形版式）。
- 使用 Helvetica 或 Akzidenz 字体文件。
- 在海报上写任何真实机构的名字。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

| 要素 | 说明 |
|---|---|
| **布局系统** | 画面网格（`film.js` 的 `FM/FG/FC/fx()`）+ 作品网格（`PW/PH/PMX/CW/RH/NC`）+「行列意味着什么」这个设计决定 |
| **共享数据文件** | `score.json`：`bpm/key/cols/midi/stiff/final`——列→音高、行→起点、长度→时值、`bleed` 出血 |
| 台词 | `lines.json`，每条 `{id, t, text, asr?, voice, speed}`；demo 8 行 af_sarah |
| 调色板 | `film.js` 的 `C`：page/paper/ink/red/grid/pgrid/bass/mute/col/wall |
| 规则表 | `film.js` 的 `RULES` 与 `NOTES` |
| 字体 | 一种 OFL 新怪诞，多字重；画前必须 `document.fonts.load` |
| 音效事件 | `buildEvents()` |

### 10.2 新画面元素的契约

用 `film.js` 画：
- 文本一律走 `font(g, weight, size, fam)`（≥90px 自动 −2.2% 字距）+ `revealText(g, s, x, y, size, p, q)`（从基线下方 clip 揭示、向上翻走）。
- 条块用 `rectOf(c, r, first, last, bar)` + `g.fillRect`（同单元相邻格多画 1px 消除接缝）。
- 网格线用 `gridState(t)` + `drawPosterGrid/drawGridExt`。
- 机位用 `posterMatrix(t)`（由 `CAM = track([...])` 驱动）。
- 吸附/线性/分级一律用 `ease.js` 的 `snap/lin/steps/track/E`。

### 10.3 时间线契约

`ease.js` 提供时间原语（`BPM/BEAT/E8/E16/BAR`、`cubicBezier`、`E`、`snap`、`lin`、`steps`、`track`）。`film.js` 导出 `W/H/DUR/C/fx/PW/PH/px/py/T`、`setScore/setWords/setLines`、`subs()`、`flight/circleState/posterMatrix`、`renderFilm(g, t, opt)`（`opt.nosub` 关字幕、`opt.poster` 出海报版片尾）、`buildEvents()`。`main.js` 加载字体、score.json、lines.json 与 whisper 词时（`tools/words.py`），暴露 `window.READY / window.render(t) / window.DUR / window.EV`。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 |
|---|---|
| `knife` | 裁纸刀（刀切/删元素） |
| `rule` | 钢尺划线（网格线长出） |
| `clack` / `clackBig` | 铅字 clack（文字落位/换字体） |
| `paper` | 纸铺上 |
| `thunk` | 大数字每级升起 |
| `slide` | 纸面滑动（重排） |
| `snap` | 条块吸附 |
| `thump` | 红圆落地/进场 |
| `tick` | 犹豫抖动 / 标签 |
| `swish` | 旋转/拉远的呼啸 |
| `voice{id}` | 人声（mix.py 从 voices/<id>.wav 读） |

全部由 `film.js:502-532` 的 `ev.push` 产生，`core/render/events.mjs` 序列化成 events.json。

---

## 11. 构建链（复用机制）

```
styles/swiss-motion/demo/
  score.json  网格 = 乐谱：呆板/最终主音、贝斯、红圆、出血、时间线
  ease.js     cubic-bezier(.7,0,.2,1)、snap(t, t_arrive, dur)、steps()、track()
  film.js     布局系统、规则、海报、红圆、揭示、海报墙、片尾卡、拟音事件
  main.js     加载字体、score、lines、whisper 词时；?nosub=1, ?poster=1
  lines.json  旁白（af_sarah）        tools/words.py  词时 → 字幕揭示
  music/score.py  从 score.json 生成的 motorik 配乐   mix.py  拟音 + 闪避人声 + 音乐
  tools/subs.py   字幕区间（asserted）→ srt     build.sh  一键重建
```

1. 先设计布局系统：画面网格、作品网格、行列意味着什么。写 `score.json`。
2. `node core/render/still.mjs styles/swiss-motion/demo --range 0.5:43.5:1 --out …` 然后 `sheet.py`。审 1s 概览 + 打破点与每个转场周围的 0.25s 密集条。
3. `tts.py` → `asr_check.py`（0 处不匹配）→ `tools/words.py`。
4. `music/score.py`（起点来自 `score.json`；检查扫过起点 ≤ 5ms）→ `events.mjs` → `mix.py`（逐行打印 voice/music/foley dB）。
5. `video.mjs --workers 3`（1056 帧约 12s）→ `mux.sh … 24 0`。或直接 `sh styles/swiss-motion/demo/build.sh`（从零约 55s）。

（`DEMO.md:112-129`）

---

## 12. 证据

```
styles/swiss-motion/STYLE.md:6-13        本质 + 不是什么
styles/swiss-motion/STYLE.md:15-22       材料与渲染（网格/作品网格/表面/条块/第二声部/相机）
styles/swiss-motion/STYLE.md:24-29       颜色逻辑
styles/swiss-motion/STYLE.md:31-36       字体与字幕
styles/swiss-motion/STYLE.md:38-46       运动质量（两种曲线/音符时值/入场/刀切/涟漪/例外/24fps）
styles/swiss-motion/STYLE.md:48-63       镜头语法 + 构图 + 转场
styles/swiss-motion/STYLE.md:65-74       声音
styles/swiss-motion/STYLE.md:76-86       七个 native moves
styles/swiss-motion/STYLE.md:88-97       媒介陷阱
styles/swiss-motion/STYLE.md:103-109     变化空间
styles/swiss-motion/DEMO.md:3            不要复用故事/弧线/镜头/道具/时长
styles/swiss-motion/DEMO.md:5-8          demo 44s / 30–60 秒 / Archivo
styles/swiss-motion/DEMO.md:10-16        纯 2D 网格 + 唯一例外
styles/swiss-motion/DEMO.md:18-28        五个 native powers + 改编法
styles/swiss-motion/DEMO.md:30           情绪弧
styles/swiss-motion/DEMO.md:32-51        逐拍镜头表 + 两种曲线 + 音符时值 + 例外
styles/swiss-motion/DEMO.md:53-75        配乐（Motorik/逐条加层/撤鼓/共享 JSON/拟音/人声/duck）
styles/swiss-motion/DEMO.md:77-90        网格/调色板/字体/构图/条块即音符
styles/swiss-motion/DEMO.md:112-129      构建链
styles/swiss-motion/demo/ease.js:6-16          cubicBezier + 唯一缓动 E
styles/swiss-motion/demo/ease.js:18            BPM 120 / E8 / E16 / BAR
styles/swiss-motion/demo/ease.js:21            snap 提前一个八分音符
styles/swiss-motion/demo/ease.js:25-29         steps 分级上升
styles/swiss-motion/demo/ease.js:31-43         track 多段吸附
styles/swiss-motion/demo/film.js:5-9           DUR=44 + 调色板
styles/swiss-motion/demo/film.js:11-16         画面网格 + 海报 706×1008 / 7×91 / 16×40
styles/swiss-motion/demo/film.js:19-23         关键时刻表 T
styles/swiss-motion/demo/film.js:29-37         字幕版面定位 + subs()
styles/swiss-motion/demo/film.js:46-52         revealText clip 揭示
styles/swiss-motion/demo/film.js:85-119        海报文字五条规则 + 刀切
styles/swiss-motion/demo/film.js:124-150       乐谱单元合并 + 涟漪按距离
styles/swiss-motion/demo/film.js:166           flight 例外走线性
styles/swiss-motion/demo/film.js:194-226       网格线长出/收起/延伸
styles/swiss-motion/demo/film.js:231-241       CAM track + posterMatrix
styles/swiss-motion/demo/film.js:245-292       大数字 4 级 + 光学左对齐 + 注释
styles/swiss-motion/demo/film.js:315-368       海报墙五个变体 + 展签
styles/swiss-motion/demo/film.js:486-498       on grid → off grid 读数
styles/swiss-motion/demo/film.js:502-532       buildEvents() 全部 type
styles/swiss-motion/demo/mix.py:17-74          拟音
styles/swiss-motion/demo/mix.py:89-96          人声压缩 + duck 0.68
styles/swiss-motion/demo/lines.json:1-10       8 行旁白实测
styles/swiss-motion/demo/score.json:1-22       图与乐共享数据文件
styles/swiss-motion/style.json:16-17           frame_sec 31.68 / dur 44.0
```
