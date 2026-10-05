# 丝印旅行海报（silkscreen-poster）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**，不收录示例《Three Trails》的具体内容（那个虚构公园、那三条步道都不是风格）。
> 证据见文末。

---

## 0. 一句话

一张海报正在镜头前被印出来：每种颜色都是**不透明的墨**、由自己那一次刮印铺上去，后印的墨完全盖住先印的墨，形状的边缘就是一块平涂墨停下的地方。

**它不是**：risograph（半透明荧光叠印 + 网点颗粒）、浮世绘（主版线描 + bokashi 晕染）、木刻（雕刻线）、低多边形（3D 小面）。这个风格是**不透明、无线条、平涂、色带式**的。（`STYLE.md:23`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值 |
|---|---|
| **每层一个 Path2D** | 在当前变换的单位里填充；镂空是路径里的洞。任意形状都能被印。 |
| **套印误差** | 每层偏移 1–3px（1080p）；被镂空的形状留下一弯露纸的月牙。 |
| **叠印边** | 每层墨下方约 2u 有一道很淡的乘算鬼影，墨压墨处留下更深的缝。 |
| **墨的厚度** | 左上亮边、右下暗边，**只作用于填色**；新墨有湿光泽，一秒内变哑。 |
| **纸** | 米黄卡纸带纤维；霉斑与针孔用纸色，只在墨面上看得见。 |
| **刮印揭示** | 一道参差的刮板前沿作为 clip（约 30u 拖尾）；刀刃、墨珠、一截手柄骑在它上面。 |
| **墨珠** | 圆管状：受光半边、暗下缘、滚动亮点、黏稠丝；分色刮把几种颜色放进同一颗墨珠。 |
| **网版** | 带铰链的框，有网纱、感光胶、胶带；**投影必须是环（even-odd），绝不是整矩形**（否则网纱下面全变浑）。 |
| **形状** | 山脊带参差受光小面；松树是一整条下垂层次的外轮廓 + 短干；水是平涂身体 + 水平反光条。到处是硬边。 |
| **海报模板** | 1000×1500 u：纸边 26u、画面区到 y=1140、底部深色**信息带**（y 1148–1474）放名字/编号/一条线/一行数据；列宽由内容决定。 |
| **纹理预算** | 细纸纹瓦片（0.6 u/texel）、霉斑乘算 55%、针孔 75%、ffmpeg grain 3。**再多就读成 risograph 了。** |
| **印刷台** | 必须是真的：木板、木纹、木节、几块大的哑光墨渍、撕剩的胶带痕——随机的彩色圆点会读成纸屑或占位符。 |

**渐变被禁止**：天空和雾是**阶梯色带**（一个平色 → 变细的条纹 → 下一个颜色）。

---

## 2. 文字（这个风格没有旁白、没有字幕）

**海报上的文字本身就是信息。**没有叙述者，语气完全由排版和印刷动作承担。

| 文字类型 | 规格 |
|---|---|
| 页眉（地名/公园名） | 字距拉开 62u，印在天空里 |
| 主标题 | ≤34 字符，banner 上自动 132→60 u，分成两行平衡 |
| 步道/条目名 | ≤22 字符，自动 122→60 u |
| 数据标签 | 34–38 u（几何无衬线 Outfit 600，字距拉开） |
| 数值 | 48–68 u（condensed display Big Shoulders 800） |
| 页脚 | ≤45 字符，一行 |

**读取规则**：每段文字在其**最后一项**落定后停留 ≥ `chars/12 + 1s`（最少 1.5s），有配音时 ≥ `max(1.8s, 语音 + 0.6s)`，并向上取整到拍。（`STYLE.md:50`、`poster.js:27`）

**不会出现的**：叙述性长句、从句、口语解说；浮动的字幕条（若有配音，字幕必须是**印出来的一条带**）；花哨/手写装饰字体；用固定颜色键决定文字墨色（必须按 WCAG 对比度自动选墨——否则夜景调色板会吞掉页眉）。

---

## 3. 叙事节奏

**信息投放顺序（= 印出来的顺序）**：

```
标题横幅（分色刮一刮填满画面）
  → 逐张海报按层印：天空 → 远 → 中 → 近 → 抬网版 → 印信息带 → 印名字 → 逐项印数据 → 读 → 停
  → 最后一张沿步道一镜爬升（层松脱、换色重印）→ 卡嗒套准
  → 拉远看墙（所有海报挂在一起）→ 片尾（最后一刮把片尾信息印成横版小海报）
```

**时间挂在 100 BPM 网格上**：1 拍 = 0.6s。

| 印法 | 节拍 |
|---|---|
| 横幅段 | 8 拍 = 4.8s |
| **press**（第一张，慢） | 摇镜 1 拍 → 四层各间隔 1 拍、每层刮 0.45s → 5 拍抬网版 → 推 2 拍 → 6 拍印带 → 7 拍印名 → 从 8 拍起每半拍一项 |
| **quick**（中间张，快） | 四层各间隔半拍、每层刮 0.26s → 2 拍拉回 → 2.5 拍印带 → 3 拍印名 → 从 3.5 拍起每半拍一项 |
| **ascent**（最后一张，一镜到底） | 爬升 7 拍 → 8 拍卡嗒套准 → 8–9.5 拍俯摇到信息带 → 9 拍印带 → 9.5 拍印名 → 从 10 拍起每半拍一项 |
| 每段时长 | `need = max(名字 + readTime(名字), 最后一项 + readTime(数值串))`，向上取整到拍（ascent 段不额外加一拍） |
| 墙面落版 | 拉远 2 拍 → 静止 `ceil(max(3.6, readTime(页脚))/B)` 拍 → 片尾 6 拍 |
| **信息项** | 每项 0.18s、落在**八分音符**上 |
| **强调墨** | 延迟半拍（`sub: 1`） |

**总时长**：主 demo 38.4s。用例区间：步道/景点指南 30–40s、活动海报 15–20s、目的地系列 20–30s、产品发布 12–18s、季节/营业时间 10–15s。4 条步道约 45s。

**静默怎么用**：两处。**18.0–19.2s**（音乐关掉；瀑布尾巴淡到约 −59 dBFS；静默后第一个声音是一段长长的上滑音）和 **23.4–24.0s**（只留山风；静默后第一个声音是套准卡嗒 + 全乐队）。静音窗里配乐与拟音必须**严格为零**，环境只留规定的（瀑布尾巴 / 山风），另加一声很轻的松针擦过（进入签名段的树影转场）。

---

## 4. 镜头逻辑

**镜头是什么**：没有隐喻式角色——它是一套**印刷车间里的观看方式**。词汇，不是路线；开场与结尾由主题决定。

| 运动 | 表达 | 可服务 |
|---|---|---|
| 跟着刮板横移、轻微侧倾、画面里保留画框边缘 | 印刷这个动作；颜色正在到来 | 钩子；分色刮的天空 |
| 锁死俯视整张纸 | 层一层层叠成一张画 | 看一张海报长出来；对比 |
| 在网版抬起时快速拉远 | 一整层完成后的揭示 | 一个场景完成；一个标题 |
| 推进 + 俯仰到信息带 | 阅读 | 事实；日期；价格 |
| 在屏幕空间里穿过前景剪影（树、路灯、帆） | 进入下一张海报 | 海报之间的转场 |
| 穿过松脱的层（多层视差） | 深度、在印刷品内部的一段旅程 | 一条路线；一次爬升；一条街 |
| 沿一排印刷品缓慢横移 | 一个系列 | 系列墙；配色变体 |
| 推进网纱直到看见织纹 | 工艺、媒介的颗粒 | 亲密的一拍；一个细节 |
| 对数拉远到墙或窗 | 海报在真实世界里的样子 | 最终落版（停留 ≥3s） |

**允许的转场**（必须来自媒介本身）：层与层用刮板换；海报与海报穿过前景剪影（树）换；全片用一次刮板把片尾卡的墨印出来收尾。

**禁止**：溶解；裸露的硬切；特写海报时把纸边切出画面；特写信息带时不把整条带留在画面里（需左右各留 ≥5% 边距，1000u 海报上 z ≤ 1.75）；一条很粗的刮板横过特写把画面切成「两张图」（要倾斜刀口、藏起大部分手柄、保持几何连续）。

---

## 5. 表达习惯（idioms）

1. **一墨一拍（One ink, one beat）**：每次刮印对应一个音乐事件，眼睛被按顺序领过各层；事实最后才印，而那正是它们被阅读的时刻。
2. **分色刮（Split fountain）**：一次刮印里放几种墨，一刮就填满画面颜色。
3. **换色重印（Palette re-ink）**：同一张海报换一套调色板重印 = 时间流逝、季节、变体；大刮板约 0.35s 斜着推过整张纸，刀口两侧几何完全相同、只有墨变了。
4. **套印松脱 → 卡嗒套准**：松脱的层带露纸的缝和纸厚阴影，在关键事实之前用一声响卡进套准位。
5. **纸是一种颜色**：没印到的地方是整张纸上最亮的东西（水、雪、一束光）。
6. **路线作为印出来的一层**：强调色的虚线一段段盖印出来。
7. **系列墙**：每张印刷品最后一起挂上墙作为终版落版。
8. 刮印是**线性匀速**的（刮板不会缓入缓出）；网版抬起约 0.4s（纵向压扁 + 影子长大）；**任何地方都没有淡入淡出**。

---

## 6. 氛围

一个真实的手作印刷车间：木板台面、哑光墨渍、撕剩的胶带、纸的干燥气味；印刷品是主角，世界在印刷品之外（最后挂上游客中心的墙）。整体是**克制、精确、值得带走一张**的气质。

---

## 7. 声音

- **乐器**：原声、手弹的乐器——扫弦吉他、滑棒吉他、口琴、立式贝斯、cajon 或刷子、班卓、提琴、手风琴、簧风琴、尤克里里。按地点选家族（民谣、冲浪、bossa、铜管乐队都成立）。
- **动作声（按材料分层）**：刮板在网纱上（带 220–280Hz 网格颗粒的中高频带通噪声，刮得越快越亮）、湿墨的「咕」声、铝网框卡嗒 + 铰链吱呀、纸张盖章、虚线路线的十六分音符点声、纸的嘶声、木质与金属的套准夹具声。
- **环境来自「印刷品内部」**：一个完成的场景可以「醒来」（海浪、街道、人群），J-cut 进、L-cut 出；台面下有房间底噪。
- **混音规则**：音乐在拟音下压约 **2.5dB**。**一刮一击**：每次刮印落在一个音乐事件上；用细分而不是改速度来加速。一次套准是片中最响的重拍。总输出 **−14 LUFS**。

---

## 8. 变化空间

主题、场景及其层、调色板（在颜色逻辑内）、海报张数、镜头路径、开场、结尾、乐器家族、长度。

`STYLE.md:128-132` 给了远离 demo 的方向：
- **结构**：一张海报多次重印（每一晚阵容都变）；一条街的一次多层横移（路过每家店就印出它的招牌）；一个错版的故事（套印一路漂移直到最后一次刮印在日期上落准）。
- **开场**：空网版（光穿过空白网纱，一张网版正在曝光）；先印强调色（裸纸上一个亮墨的孤立产品）；夜里的成品墙，再回到台面。
- **结尾**：晾干架（一排夹着的印刷品在轻轻摇）；海报在使用中（贴在公交候车亭上，开始下雨）；最后一刮是纸（刮板刮干了，留下一个白色剪影）。

---

## 9. 禁忌清单

- 渐变（天空与雾必须是阶梯色带）。
- 网点、荧光色、线描。
- 用描边做边缘效果（会在合并路径上画出内部线——只用填充，先填一次，再在 clip 里偏移填一次）。
- 整矩形网版阴影（必须用环形阴影）。
- 冷色阴影面贴在水边（阴影用 `near` 墨，放在瀑布旁边的内侧面）。
- 参差三角状的墨珠（墨珠必须圆）。
- 只靠视差表现深度（松脱时要给纸缝和纸厚阴影，套准时用一声响归零）。
- 把文字墨色写死（必须按对比度选墨）。
- 随机的彩色圆点（要做一个真实的工作台）。
- 照抄任何真实海报的构图、公园名、字体或 logo，也不点名任何真实机构。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`content.json`）

| 字段 | 类型 | 范围 | 越界后果 |
|---|---|---|---|
| `park` | string | ≤22 字符 | 页眉字距 62u，超长溢出天空宽度 |
| `title` | string | ≤34 字符 | banner 上自动 132→60 u，低于 60 u 太小读不了 |
| `footer` | string | ≤45 字符 | 一行；墙面停留时间随其阅读时长增长 |
| `trails[]` | array | **1–4** | 1=只印、2=印+爬、3=印、快、爬、4=印、快、快、爬（约 45s）；>4 墙上海报小到读不了 |
| `trails[].name` | string | ≤22 字符 | 自动 122→60 u |
| `trails[].difficulty` | enum | `easy`/`moderate`/`hard`/`expert` | 未知值显示 1 个实心三角 |
| `trails[].distance` | number | 任意 | 印成 `3.2 KM`（单位取自 `units.distance`） |
| `trails[].time` | string | ≤7 字符（`1 h`/`45 min`） | 该列变宽、所有数值一起缩（最小 48 u） |
| `trails[].elevation` | number \| null | null 隐藏 CLIMB 列 | 显示为 `↑1,100 M`，用 `sun` 墨 |
| `trails[].scene` | enum | `lake`/`waterfall`/`ridge`/`forest`/`coast` | 未知 → `lake` |
| `trails[].time_of_day` | key | `dawn`/`noon`/`golden`/`dusk`/`night` | 缺省 → `noon`；爬升段从上一条经 `golden` 重印到这条 |
| `palette.<time>` | object | `{sky1,sky2,far,mid,near,sun,glow?}` 十六进制 | 文字对比度自动检查 |
| `palette.paper` / `palette.wall` / `banner_time` | hex / object / key | — | — |

> ⚠️ `DEMO.md:176` 明确：换 content 只是「验证引擎能重排的技术检查」，不是做片子的方式。

**「4 条步道塞进 40s」的三种办法**（按偏好排序，`DEMO.md:159-162`）：
1. 把两张中间海报**并排放在同一张台面上、用同几次刮印**（一个 quick 段、两条带、一起读）。
2. 中间海报的逐项盖章间距从八分音符改成十六分音符。
3. 跳过中间海报的信息带特写，让它们在最终墙上被读（墙面停留延长 2s）。

### 10.2 新画面主体的契约

要新画一个场景层，用 `demo/engine/scenes.js` 的 `buildScene('lake'|'waterfall'|'ridge'|'forest'|'coast')`，它返回一组**层（planes）**，每层带 `{id, depth, side?, parts:[{ink, path}]}`，可以重排或扩展。

层必须满足：
- 每层只用一个调色板角色（sky1/sky2/far/mid/near/sun/glow）的墨；
- 路径是闭合的 `Path2D`（硬边）；
- 深度 `depth` 用于爬升视差：`(camTopY − camY) × (depth − 1) × 0.42`；每道山梁在镜头经过它时向两侧让开（Gaussian bump，190 u × depth），到顶后回位。

海报模板在 `demo/engine/poster.js`：`buildPoster(content, trail, i, n)` 产出 `P`（含 `items` 数据项、`sc` 场景、`trail` 折线）；`drawPoster(ctx, P, opts)` 按 `prog`（每层刮印进度）、`band/name/items`（信息带印出进度）、`off/reg/sep/swap` 绘制。文字墨用 `pickInk(under, candidates, minRatio)` 按 WCAG 对比度自动选。

### 10.3 时间线契约

`film.js` 导出 **`setup(content, canvas)`**（返回 TL）、**`render(t)`**、**`getTL()`**：
- `TL = {secs, ev, dur}`：`secs` 段落表（banner/press/quick/ascent/wall/end），每段带自己的相机与印层时间；`ev` 按时间排序的事件数组；`dur` 总时长。
- 页面契约（`main.js`）：`window.DUR` / `window.EV` / `window.TL`（段落 kind+t0+t1）/ `window.render(t)` / `window.READY`。
- 工具 `tools/timeline.mjs` 用无头浏览器打印时间线；`core/render/events.mjs` 导出 `events.json`。
- **没有 TTS**：音乐与混音从 `events.json` 自我重排。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者（mix.py） |
|---|---|---|
| `squeegee{dur,ink}` | 刮板在网纱上 | 带网格颗粒的带通噪声 |
| `section{kind,t1,time_of_day}` | 段落标记 | — |
| `lift{i}` | 抬网版 | 卡嗒 + 铰链吱呀 + 弹簧点声 |
| `title` | 片名 | — |
| `tilt{i}` / `tiltdown{i}` | 摇镜 / 俯摇 | — |
| `pull{i,layer,n,dur,quick?}` | 每一层刮印 | 网格嘶声 + 湿墨咕声 |
| `wipe{i}` | 树影转场 | — |
| `pullback{i}` | 拉回 | — |
| `band{i}` / `name{i}` | 印信息带 / 印名字 | — |
| `item{i,k,last,climb}` | 逐项印数据 | 盖章 + 点声 |
| `ascent{i,dur}` | 爬升 | 十六分音符点声 |
| `part{i,layer}` | 层让开 | 刮擦 + 咕声 |
| `swap{i,k,dur}` | 换色重印 | 刮擦 + 咕声 |
| `silence{dur,pre?}` | 静音窗 | mix.py 据此归零（`pre` 时环境压到 35%） |
| `clack{i}` | 套准卡嗒 | 金属夹具 + 低频闷响（片中最响重拍） |
| `wallpull` / `land{dur}` | 拉到墙 / 墙面落定 | 图钉点声 |
| `endcard{dur}` / `endpull{dur}` | 片尾卡 / 片尾刮 | 刮擦 + 咕声 |

---

## 11. 构建链（复用机制）

```
sh styles/silkscreen-poster/demo/build.sh          # 从零重现
CONTENT=content_alt.json sh .../build.sh           # 换内容
  # 1. tools/timeline.mjs：打印由 content.json 推出的时间线
  # 2. core/render/events.mjs → events.json（每一次刮印/抬版/印带/印名/印项/擦除/换色/让层/静音/卡嗒）
  # 3. music/compose.py 读 events.json → score.wav + stems
  # 4. mix.py → mix.wav（环境 + 拟音 + 让路 + 静音窗）
  # 5. tools/cuecheck.py：混音起音 vs 事件（中位误差 4 ms；30/33 在 1 帧内）
  # 6. 逐帧渲染 → mux（−14 LUFS，颗粒 3）
```
（`build.sh:1-17`）

**关键机制**：`film.js` 的 `timeline()` 同时产出画面段落 `secs` 与事件表 `ev`；`ev` 驱动 `events.json` → `compose.py`（配乐）与 `mix.py`（拟音/静音）。因为**没有旁白**，换内容时音乐与混音完全自动重排——这是本风格与前三个风格最大的机制差异。

---

## 12. 证据

```
styles/silkscreen-poster/STYLE.md:13-23      本质与不是什么
styles/silkscreen-poster/STYLE.md:27-33      每层一个 Path2D / 刮印 / 墨珠 / 网版 / 模板 / 纹理预算
styles/silkscreen-poster/STYLE.md:37-43      颜色逻辑
styles/silkscreen-poster/STYLE.md:47-51      字体 / 海报文字即字幕 / 读取规则
styles/silkscreen-poster/STYLE.md:55-59      线性刮印 / 无淡入 / 抬版 0.4s / 换色 0.35s / 套准
styles/silkscreen-poster/STYLE.md:63-77      相机词汇表与转场规则
styles/silkscreen-poster/STYLE.md:81-86      乐器 / 一刮一击 / 拟音 / 环境 / 静默 / 混音
styles/silkscreen-poster/STYLE.md:90-98      原生手法分工
styles/silkscreen-poster/STYLE.md:100-110    媒介陷阱
styles/silkscreen-poster/STYLE.md:120-134    用例表与变化空间
styles/silkscreen-poster/STYLE.md:134        换 content 只是技术检查
styles/silkscreen-poster/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/silkscreen-poster/DEMO.md:10-22       结构 / 信息顺序 / 停留 / 五种手法用法
styles/silkscreen-poster/DEMO.md:26-41       镜头表与运动数值
styles/silkscreen-poster/DEMO.md:45-49       配乐 / 拟音 / 环境 / 静音 / duck / −14 LUFS
styles/silkscreen-poster/DEMO.md:53-63       调色板纪律 / 四套配色 / 模板尺寸 / 纹理预算
styles/silkscreen-poster/DEMO.md:67          无旁白无字幕 / 4:1 横幅 / 读取规则
styles/silkscreen-poster/DEMO.md:103-135     引擎参考与最小示例
styles/silkscreen-poster/DEMO.md:139-157     content.json 字段表
styles/silkscreen-poster/DEMO.md:159-162     「4 条步道塞进 40s」
styles/silkscreen-poster/demo/film.js:6                  BPM=100/B=0.6
styles/silkscreen-poster/demo/film.js:29-86              timeline()
styles/silkscreen-poster/demo/film.js:41-57              press/quick/ascent 拍点
styles/silkscreen-poster/demo/film.js:70-71              need = max(名字, 最后一项) + readTime
styles/silkscreen-poster/demo/film.js:76-79              墙面 hold + 片尾
styles/silkscreen-poster/demo/film.js:160-205            banner 段
styles/silkscreen-poster/demo/film.js:216-242            press 段
styles/silkscreen-poster/demo/film.js:245-254            treeWipe
styles/silkscreen-poster/demo/film.js:299-342            ascent 段
styles/silkscreen-poster/demo/film.js:372-412            endCard
styles/silkscreen-poster/demo/engine/poster.js:27        readTime
styles/silkscreen-poster/demo/engine/poster.js:183-184   BW/BH / BANNER_ART / 分色刮
styles/silkscreen-poster/demo/mix.py:1-20                材质说明
styles/silkscreen-poster/demo/mix.py:159-165             duck −2.5dB / 爬升 +3dB
styles/silkscreen-poster/demo/mix.py:168-179             静音窗归零
styles/silkscreen-poster/demo/music/compose.py:1-20      100 BPM / D 大调 / 开放 D / 配器
styles/silkscreen-poster/demo/music/compose.py:123-124   四层刮印 = D–D/F#–G–A
styles/silkscreen-poster/demo/tools/timeline.mjs:1-9     打印时间线
styles/silkscreen-poster/demo/tools/cuecheck.py:1-15     卡点自检
styles/silkscreen-poster/demo/build.sh:1-17              构建链
styles/silkscreen-poster/demo/content.json:1-47          示例内容字段与配色
styles/silkscreen-poster/demo/events.json:1              事件表实测
styles/silkscreen-poster/style.json:16-17                frame_sec 34.0 / dur 38.4
```
