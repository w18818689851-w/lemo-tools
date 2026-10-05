# 装饰艺术（art-deco）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Midnight at the Starlight Hotel》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「金色细线在暖黑漆面上自己画出来」的 1930 年代海报电影：**金色关键线 + 硬边喷绘体积**，一切围绕**一条垂直中轴**组织，太阳纹是背景、阶梯拱是画框、仪表盘是进度条、灯泡招牌是一次揭示；运动是机械且对称的。

**它不是**：金箔幻灯片（东西会动、有体积）、新艺术（没有鞭形曲线和花）、平面矢量海报（体积是喷绘并带金边的）、60 年代间谍片头（没有平涂色块上的人物剪影）。
（`STYLE.md:6-10`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「一次金色印刷 + 一次喷绘上色 + 一次机械展开」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **暖黑漆面** | 底色 `#0d0b09`（最深 `#060504`），绝不中性灰；夜空 `#0a0e16` → 地平线祖母绿 `#10231f`。 |
| **金色 = 带式金属渐变** | `#6f5220` → `#c9a24b` → `#f3d98b` → `#fff4d2`；动画 `sheen` 0→1 即一次光扫。 |
| **签名描边 `gline`** | 暗色刻线（宽 +1.6px）+ 金色渐变主线 + 顶上极细高光；可选辉光与平行双线。**不加黑色卡通轮廓**。 |
| **体积 = 硬边喷绘** | 形内沿固定光向（默认左上 `dir=-2.3`）暗→亮线性渐变，受光侧一条细金边。 |
| **母题是结构件** | 太阳纹、阶梯拱/金字形、鱼鳞、人字纹、扇形、四角闪光、速度线、钟面、仪表盘——是背景/画框/转场，不是贴纸。 |
| **透视是真的** | 真一点透视（mode-7 地板）+ 针孔相机两点透视；推拉/俯仰改变透视而非缩放平面。 |
| **人物也是 deco** | 约 7 头身、锥形流线身体、棱面漆板、杏形/弧形眼、一笔鼻；1/4 画幅高度就能读出的剪影标记。 |
| **灯泡招牌** | 任意文本 → Zhang–Suen 细化 1px 骨架 → 交叉数判链 → 等距布点；每颗灯泡可独立点亮。 |

**关键取向**：中轴是构图里**唯一不能动**的东西（`STYLE.md:45`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位 1930 年代电台播音员。第三人称、现在时为主；可用第二人称对观众直呼。人声分两类：**广播员**（`bm_fable`，0.96–1.02）与**主角**（`am_puck`，0.86、pitch +4）。

**长度（实测）**：单句 **6–13 个英文词**（约 30–75 字符）。demo 最短是主角短反应（`Out... of order?`），最长是一条完整播报（76 字符）。硬规则：每行口播 ≤ 4.5s；字幕卡宽上限 1500px（Josefin Sans SemiBold 40px），最多两行。

**句首类型**（示例性，不是抄原文）：
- 时代播音式问候：`Good evening, America!` / `Live from …`
- 时间/倒计时钩子：`… it's five minutes to midnight.`
- 宣布式短句点题：`The band is ready, folks.`
- 主角短反应/疑问：`Out... of order?` / `Special delivery!`
- 结尾祝辞收束：`Happy New Year, from the Starlight Hotel.`

**这个风格里不会出现的句式**：
- 第一人称内心独白与抒情（情节由仪表盘/灯泡/时钟承载）
- 现代网络口播腔、感叹号堆叠、营销话术
- 抽象概念当主语（只说能被画成金色图形的东西）
- 一句塞两个以上并列信息点（让数字自己说话）

---

## 3. 叙事节奏

**信息投放顺序**（一次「有截止时刻的盛事」）：

```
开场金点爆成射线与阶梯拱
  → 标题条在管弦重击上绽开
  → 建立（极低角度仰拍：目标/难度/暗着的招牌）
  → 障碍（OUT OF ORDER 牌）
  → 静默中的特写
  → 签名段落一（剖面上升 + 圆形图章式落地）
  → 静默
  → 高潮（按点数亮的灯泡招牌）
  → 签名段落二（Busby Berkeley 俯拍万花筒）
  → 尺度揭示（拉远到整座塔与烟花）
  → 电梯门合上落版 → 片尾卡
```

**时间挂在 116 BPM 网格上**：1 拍 = 0.5172s，1 小节 = 2.069s；楼梯段 16 拍从 116 加速到 138 BPM；厨房/屋顶走 138（1 拍 = 0.4348s）。

| 锚点 | 值 |
|---|---|
| 第一声钟 STRIKE1 | 35.86s（= 接住信） |
| 12 声钟 | 每声间隔 1 拍 |
| 主题曲首次完整奏出 TUTTI | STRIKE1 + 12 拍 |
| 舞厅 / 拉远 / 终版 | TUTTI + 1/2/3 小节；FINAL = PULL0 + 2 小节 |
| 电梯门 / 片尾卡 | DOORS0/1 = FINAL + 2/3 拍；CARD0 = DOORS1 |
| 总时长 | DUR = CARD0 + 4.4s（demo 58.4s） |
| 字幕停留 | `max(1.8s, 语音时长 + 0.6s)`；提前 0.05s 上、滞后 0.25s 下 |
| 门扇展开 | eio 缓动，约 0.35–0.5s |

**总时长**：主 demo 58.4s（`style.json`）；用例区间 30–60s（产品发布 30–60s、博览会式 45–60s、邮轮式 40–60s）。

**静默怎么用**：静默是「最重的一声之前的清场」——钟敲 XII 后只留风声与飘落的信，下一个声音就是全片最重要的一声（第一记钟）；第 12 记钟后留一拍屏息再进 tutti。规则：在任何最重要的声音之前，降到只剩一个小的画内声（钟摆滴答、风），再用那个声音单独切回来（`STYLE.md:71`）。

---

## 4. 镜头逻辑

**镜头是什么**：一台被**机械对称**驱动的舞台摄影机——中轴是神圣的，门沿接缝裂开，俯拍把人变成图案，推近仪表盘让数字成为情节。它表达的是一个「有刻度、有节拍、正在倒计时」的世界。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 对称裂开（门扇铰外缘甩开 / 旋转门擦除） | 跨过一道门槛 | 新地点；新章节；门面后的揭示 |
| 门扇在实时画面上合拢 | 对某个时刻关门 | 离开；已做的决定；时代结束 |
| 极低角度 Cassandre 仰拍 | 尺度与抱负 | 远在上方的目标；塔、火箭、纪念碑 |
| 建筑剖面（拉远到整楼切面） | 在一个结构里的进程 | 攀爬、下降、分阶段流程 |
| Busby Berkeley 俯拍镜像旋转 | 人变成图案 | 团队、发布、庆典、零件系统 |
| 推向仪表盘/圆章/时钟 | 数字就是情节 | 截止时刻；计数；里程碑 |
| 按形状匹配剪辑（圆→圆） | 两个地方，一个韵脚 | 部门/城市/年代跳转 |
| 沿招牌低角度斜掠 | 光逐字行进 | 名字揭示；发布；分数被数出来 |
| 从细节拉远到天际线 | 这一刻在世界中的位置 | 余波；全城影响；尺度 |

**允许的转场**（必须来自机械/建筑本身）：对称裂开、旋转门擦除、门扇合拢、形状匹配剪辑。

**禁止**：通用溶解/淡入淡出；无来由的运镜；让中轴漂移；情绪峰值不给人物足够画幅（< 1/3 高度）。

---

## 5. 表达习惯（idioms）

1. **计数的光**：灯泡招牌每拍/每事件亮一个字，让观众能数。
2. **门槛之门**：每一次场景转换都是一道沿接缝裂开的门。
3. **机械万花筒**：人或物变成镜像旋转图案，最后锁成一个符号（扇形 → 钟面）。
4. **仪表盘承载情节**：楼层指示器、时钟、量表自己动，替代旁白。
5. **建筑剖面**：拉远到整楼成为切面，主角变成一个带速度线的彩色小点。
6. **光扫 / 描线**：光在重击上扫过金色物件；金线按滑音速度自己刻出来。
7. **唯一色**：整个金色世界里只有一个元素保留自己的颜色（`drawShape` 的 `color` 门）。
8. **标题即建筑**：阶梯金标题条压在拱或太阳纹上，先以金色画出、再扫一次光。

---

## 6. 氛围

一间有刻度、有钟表、正在倒计时的华丽场所（饭店大堂、屋顶招牌、舞厅）：金、暖黑、象牙白；光从左上斜进来，尘埃与灯泡在光里。整体是**隆重、精确、机械、被仪式驱动**的气质，而不是阴郁或戏剧化的。

---

## 7. 声音

- **乐器**：交响爵士（1920–30 年代，不是 60 年代大乐队）——钢琴、单簧管（颤音/变速重采样滑音）、弦乐（震音/上行冲刺/拨弦）、弱音小号、长号与萨克斯组、行走拨弦贝斯、鼓刷/鼓棒、管钟、竖琴滑音、班卓琴、木琴、钢片琴。节奏型：狐步/查尔斯顿/探戈/火炬歌谣/新闻片号角。
- **动作声（按材料分层）**：黄铜咔哒、青铜牌当啷+铁链、铁踏步、大理石鞋跟、银托盘、木门+弹簧吱呀、纸的扑动、刀闸「chunk」+ 灯丝嗡鸣、继电器滴答、电梯叮、香槟塞。每个点亮的字母 = 一次刀闸 chunk + 灯丝嗡鸣。
- **混音规则**：音乐在人声下 duck ≈ −9 dB（时期播音员下只 −6 dB）；铺底 −6 dB；整体 −14 LUFS、grain 3。**距离自动化**是核心：乐队在 30 楼——街上低通 2.5kHz、门厅 1.2kHz、爬楼逐步打开、屋顶全频且干。播音员走五个声学空间（街角喇叭→桌上收音机→楼梯间 PA→厨房收音机→现场麦），让观众听见主角在靠近声源。J/L-cut 承载建筑：下一个房间的声音在门开之前一小节就进来。

---

## 8. 变化空间（可自由发挥）

结构、人物（或无人）、场景、开场、结尾、镜头路径、节奏、**强调色**、以及**「什么被计数」**。

`STYLE.md:104-106` 给了远离 demo 的方向：
- **结构**：世界博览会五个展馆（每扇门后主题的一个侧面）；一艘远洋邮轮（轮机舱到舞厅三层，每层一声汽笛）；颁奖之夜（提名者作太阳纹板，获奖者在光里揭晓）。
- **开场**：机房（金色齿轮与活塞推向第一拍）；刻在版上的地图（一条金路线横穿大陆）；电报（纸带打出前提）。
- **结尾**：熄灯（字母倒序熄灭只剩一颗灯泡）；黎明（漆黑暖成淡天）；海报（最后一镜压平成一张带日期的印刷海报）。

---

## 9. 禁忌清单

- 金箔幻灯片式的静态堆叠（东西必须会动、有体积）。
- 新艺术的鞭形曲线与花卉。
- 平面矢量海报（体积必须喷绘并带金边）。
- 60 年代间谍片头的平涂剪影。
- 通用溶解/淡入淡出转场。
- 让中轴漂移。
- 照抄任何真实海报版式、真实建筑、角色、字体设计或旋律（`STYLE.md:4`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容要素

| 要素 | 说明 |
|---|---|
| 剧本节拍表 | 每个节拍标注「门槛 / 截止时刻 / 计数揭示 / 被解锁之物」 |
| 台词 `lines.json` | `{id, text, voice, speed, pitch?, sub?, asr?}`，单行 ≤ 4.5s；人声分 radio/boy |
| 时间网格 `timeline.js` | `BPM/B/小节` + 命名同步点 `T` |
| 调色板 | 暖黑 + 金四阶 + 象牙白 + 一个强调色（可选宝石色） |
| 招牌文本 | 任意文本 → `buildSign` 生成灯泡招牌 |
| 数字道具 | 楼层号、时钟时间、年份徽章 |

> ⚠️ `DEMO.md:3` 明确：不要复用 demo 的故事、叙事弧、镜头、道具或时长。

### 10.2 新画面元素的契约

任意路径走 `D.drawShape(g, pts, {color, halo, trail, glints, part})`：喷绘金填充（或 `color` 单色）+ 金关键线 + 可选太阳纹光晕/速度线尾/闪光。母题用 `sunburst / archFrame / fan / fishScale / chevrons / sparkle / speedLines`。招牌用 `B.buildSign(text)` → `B.drawSign(g, sign, x, y, scale, {lit})`。镜头用 `cam.js` 的 `makeCam` + `cardTransform`。

### 10.3 时间线契约

`timeline.js` 是**唯一真值**：导出 `BPM/B/BAR/K_BPM`、段表 `SEC`、命名同步点 `T`、台词起点 `LINES`；`tools/dump_timeline.mjs` 导出 `timeline.json` 供 Python 配乐/混音/校点脚本读取。`film.js` 导出 `renderFilm(g,t,Q)`、`DUR`、`SHOTS`（`[t0,t1,fn,name]`）、`TR`（转场表）、`subs()`、`events()`。页面契约：`window.READY / window.render(t) / window.DUR / window.EV`。

### 10.4 事件词汇（`type` → 消费者）

| 事件 | 来源 | 消费者 |
|---|---|---|
| `shot{name}` | `film.js` 镜头切换 | 声音分层 |
| `vo{id}` | 台词起点 | mix.py 从 `voices/<id>.wav` 读 |
| 材料拟音 | `T` 里的命名时刻 | 黄铜/青铜/铁/银/木/纸/刀闸/继电器/电梯叮/烟花哨 |
| 校点 | `T` 的 53 个画面同步点 | `tools/cuecheck.py` 对 `music/score.json`（最大偏差 0.5ms） |

---

## 11. 构建链（复用机制）

```
sh styles/art-deco/demo/build.sh
  # 1. 先写 tempo grid + cue 表（timeline.js）→ dump_timeline.mjs → timeline.json
  # 2. TTS → pitch → whisper 检查
  # 3. music/score.py（读 timeline.json 的 cue，任何细节数都能配到乐）→ stems + score.json
  # 4. cuecheck.py → mix.py（五空间人声 + 拟音 + 铺底 + ducking）→ srt
  # 5. core/render/video.mjs 出帧（1401 帧 ≈15s）→ mux（−14 LUFS, grain 3）→ stills
```

**关键机制**：`timeline.js` 是单一真值，画面、配乐、拟音、字幕、校点全部读同一份命名同步点（`DEMO.md:47`）。这是「可换内容重跑」在各层的实现方式。

---

## 12. 证据

```
styles/art-deco/STYLE.md:3-4        本质与「参考只借语法」
styles/art-deco/STYLE.md:6-10       本质三条 + 不是什么
styles/art-deco/STYLE.md:12-20      材料与渲染（暖黑/金色渐变/gline/airbrush/母题/真透视/deco 人物）
styles/art-deco/STYLE.md:22-28      颜色逻辑（三常量 + 一个强调色 + 单色例外 + 六位 hex）
styles/art-deco/STYLE.md:30-35      字体与字幕（Limelight/Poiret One/Josefin/Italiana；字幕卡从中心展开）
styles/art-deco/STYLE.md:37-45      运动质量（12fps 人物 / 24fps 镜头、中心展开、灯泡点火过冲、中轴不动）
styles/art-deco/STYLE.md:47-63      镜头语法表 + 构图 + 转场
styles/art-deco/STYLE.md:65-73      声音（交响爵士/技巧/拟音/静默/J-L cut/−14 LUFS）
styles/art-deco/STYLE.md:75-85      母题清单
styles/art-deco/STYLE.md:87-94      媒介陷阱
styles/art-deco/STYLE.md:100-106    变化空间
styles/art-deco/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/art-deco/DEMO.md:12-14       demo 故事与 58.4s
styles/art-deco/DEMO.md:30-43       逐拍镜头表
styles/art-deco/DEMO.md:47-55       配乐结构（距离自动化/五空间/静默/J-L cut）
styles/art-deco/DEMO.md:59-64       调色板与道具
styles/art-deco/DEMO.md:101-118     引擎参考
styles/art-deco/demo/timeline.js:3          BPM 116 / K_BPM 138
styles/art-deco/demo/timeline.js:6-16       楼梯加速 / STRIKE1=35.86 / 12 声钟 / DUR
styles/art-deco/demo/timeline.js:20-32      段落表 SEC
styles/art-deco/demo/timeline.js:35-43      命名同步点 T
styles/art-deco/demo/timeline.js:46-54      台词起点 LINES
styles/art-deco/demo/film.js:16-37          SHOTS 镜头表
styles/art-deco/demo/film.js:41-47          TR 转场表
styles/art-deco/demo/film.js:52-71          splitOpen 门扇甩开
styles/art-deco/demo/film.js:72-89          revolve 旋转门
styles/art-deco/demo/film.js:118-129        subs 停留与字幕卡参数
styles/art-deco/demo/engine/deco.js:16-31   调色板 C
styles/art-deco/demo/engine/deco.js:46-58   goldGrad 带式金属渐变
styles/art-deco/demo/engine/deco.js:101-123 gline 签名描边
styles/art-deco/demo/engine/deco.js:133-152 airbrush 硬边喷绘
styles/art-deco/demo/engine/deco.js:156-191 sunburst
styles/art-deco/demo/engine/deco.js:212-227 archFrame 阶梯拱
styles/art-deco/demo/engine/deco.js:230-241 fan 扇形
styles/art-deco/demo/engine/deco.js:324-339 drawShape + 单色门
styles/art-deco/demo/engine/type.js:36-90  titleBar 中心展开
styles/art-deco/demo/engine/type.js:135-161 dial 楼层指示器
styles/art-deco/demo/engine/type.js:164-194 clockFace
styles/art-deco/demo/engine/type.js:199-224 subtitleCard
styles/art-deco/demo/engine/bulbs.js:82-112 buildSign 骨架→灯泡
styles/art-deco/demo/engine/bulbs.js:180-188 litSequence 点火过冲
styles/art-deco/demo/lines.json:1-49        7 行旁白实测
styles/art-deco/demo/mix.py:9               从 timeline.json 读时序
styles/art-deco/demo/mix.py:29-48           乐队距离自动化
styles/art-deco/style.json:16-17            frame_sec 17.52 / dur 58.4
```
