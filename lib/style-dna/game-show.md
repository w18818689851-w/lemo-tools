# 综艺节奏扁平（game-show）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《AI 进化节拍 / Rhythm of AI 1997 → 2026》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「**节奏游戏式的综艺节目**」：玩具般的吉祥物（粗墨线描边）站在糖果色条纹与太阳burst上，每一次打击都落在固定的速度网格上，是「呼—应」的模式，每一局赢的时候弹出一个判定词。

**它不是**：微型游戏大杂烩（没有计时器、不是每 3s 换一种画风）、中世纪卡通（没有手绘质感背景、没有角色表演）、发布会（没有慢揭示、没有渐变）。
（`STYLE.md:15`）

**格式长度**：从 **45s（三局）到约 3min（八局）**；**旁白可选**——这个风格可以只靠短促的呼喊和字幕撑起一部片（`STYLE.md:6`）。

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **纯矢量** | SVG / canvas 路径 1920×1080：平涂填充、一种描边色（近黑 `#1B1B1B`）、角色与道具 **8px** 描边、小零件 5–7px、圆角连接与端帽。 |
| **无渐变/模糊/纹理/柔阴影** | 景深是**硬偏移阴影**：同形状用描边色平移 ~10px（贴纸/横幅）到 ~14px（卡片），彩色形状盖在上面。 |
| **布景** | 一个饱和底色 + 同色系浅一档的图案：斜条纹（常缓慢滚动）、错位波点（~20% 白）、或旋转太阳burst；一条更暗地板带 + 顶上一条墨线。 |
| **角色** | 圆豆身体、短粗手臂 + 连指手、椭圆眼 + 高光、会换成张开的嘴；人类共用构造；老机器靠更方剪影读。 |
| **UI 套件** | 圆卡片、角贴横幅、判定词、burst（星 + 环 + 速度线）、记分牌。 |
| **纯函数渲染** | `render(t)` 是 `t` 的纯函数：每个元素状态从 `t` 重算，**绝不从上一帧继承**。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：无旁白（或极简）。语气由**呼喊**与**字幕（telop）**承担。

**长度（实测）**：文本是字幕式，不是句子——横幅一行 **≤ ~20 个 CJK 字**，牌子 **≤ ~12 个 CJK 字**（拉丁文约宽 1.6×）；呼喊是 **1–3 个词**（`Hey!`、一个数字、一个判定）。demo 屏上全中文、声音只有短的英文呼喊、**没有旁白**（`DEMO.md:8`）。

**字幕就是 telop**：白或黄填充 + 约字号 14% 的墨色描边画在填充**下面**（`paint-order: stroke`）；标题逐字构建以便每个字弹出。**没有细的通用 caption**（`STYLE.md:37-38`）。

**停留**：每段文字 ≥ `max(1.8s, 语音 + 0.6s)`；判定词可更短（一眼读完）。

**句首类型**（示例性）：
- 报数式：`One! Two! Three! Four!`
- 关卡卡：GAME N + 关卡名 + 年份区间
- 一声呼喊打断：`Hey!` / `Question!`
- 判定词先出现：`Perfect!`
- 年份横幅从左边滑进来

**这个风格里不会出现的句式**：长句/从句/书面语；旁白式解说；把字幕做成细 caption；一句塞两个信息点。

---

## 3. 叙事节奏

**信息投放顺序**：

```
冷开场在全员 + 报数（4 小节）
  → 若干关卡（每关 = 1 小节关卡卡 + 8 小节玩法；
     前半建立模式、后半回应/升级，
     最后一拍[第 7 小节第 3 拍]是 slam + "Perfect!" 判定）
  → remix 关（所有近期事件堆到一块布景，
     顶部月份时间带、底部停着每个已完成片段的缩小缩略图）
  → 结尾（蛋里孵出新角色 → 打字机成绩单 + Superb! 星 → 信用卡）
```

**时间挂在「一个固定快速速度」上**。demo 出厂值 **150 BPM**（`DEMO.md:31`：B = 0.4s、BARL = 1.6s；`assemble.py:5` 把 `main_v1.js` 的 BPM=140 改成 150、END_BAR=61 改成 93）。

**demo 形状**（`DEMO.md:25`）：4 + 7×9 + 1 + 16 + 9 = **93 小节 = 148.8s**。

| 强度 | 值 |
|---|---|
| 打击量 tick / hit / slam | 0.008 / 0.02 / 0.03–0.05 |
| 关卡卡那一小节 | 硬切 + 0.08s 白闪 |
| 打字机 | 每 1/8 拍一个字符，每 2 个字符一次键击 |
| 结尾淡出 | 最后 0.8s 到 navy（**全片唯一淡出**） |

**总时长**：demo **148.8s**（`style.json:17`）。

**静默怎么用**：静默是强度手段之一（一小节只有鼓、然后一个大击；或一小节静默被一声呼喊打破），不当主结构。

---

## 4. 镜头逻辑

**镜头是什么**：一个正面、对称的舞台台口；**是画框自己在动**（beat punch），没有运镜旅行。

**词汇表**（用法由主题决定）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| Beat punch（zoom 0.8–5%，~0.16s 衰减） | 被画框感觉到的打击 | 任何重音；猛击；报数 |
| 一小节里打好几次 punch | 画框随音乐呼吸 | 副歌；升级的模式 |
| 锁死正面宽景 | 整个舞台就是一块游戏盘 | 建立模式；人群；记分牌 |
| 小节线上硬切 + 白闪 | 新一关、新布景 | 章节切换；之前/之后 |
| 分屏舞台（两半、两套布景） | 两边互相应答 | 对抗；人 vs 机器；旧 vs 新 |
| 缩成缩略图 | 记忆、累积 | 回顾；"然后这一切都发生了" |
| 布景竖直滚动（地板到天空） | 升高的赌注或尺度 | 排行榜；成长；一叠东西 |
| 啪地推近一个道具（硬切 2×、下一小节回来） | 这个细节就是笑点 | 价签；数字；反应的脸 |

**允许的转场**：小节线硬切 + 短白闪；淡出只留到最末尾；缩略图缩进底部槽位。

**禁止**：溶解；脱离网格的运动；同时 punch 总和超过 ~0.06（否则会露出画框边缘）；慢慢淡入（东西要么就在、要么「啪」地弹出）。

---

## 5. 表达习惯（idioms）

1. **带卡的关卡**：1 小节卡片（关号 + 名字 + 一个标签）跟着 jingle 飞进来，然后开玩。
2. **呼—应**：任何有「轮次」的东西都变成节奏模式；把模式加速（四分→八分）**就是**剧情。
3. **判定词**：一个大的描边词在关卡最后一击上斜着弹出。
4. **统计当游戏 UI**：数字变成领奖台分数、冲向目标的计数器、被锤的价签、按拍生长的柱状图。
5. **Remix 板**：一块布景 + 一条时间带；每个条目在中央拿几小节，然后缩进底部一个槽；终章里所有槽一起弹。
6. **人群降落**：很多选手一拍一个落进来，每个带一个音高化的 pip。
7. **下一关预告**：有东西孵化或解锁。
8. **成绩单**：一张打字机打出来的回顾 + 一个等级印章。

---

## 6. 氛围

一个亮、吵、糖果色的综艺舞台：饱和底色、会滚动的条纹、旋转的太阳burst、踩拍蹦跳的玩具角色；热闹、有弹性、永远在数拍。整体是**欢乐、机械精确、玩具感**的气质，而不是细腻或安静的。

---

## 7. 声音

- **全部从画面事件合成**：软饱和正弦 kick、带通噪声军鼓与拍手、hats、slap bass、带关闭滤波的失谐锯齿 brass stab、带颤音方波主音、马林巴式拨弦、音乐盒铃、三角波 pad、方波琶音、牛铃。
- **明亮大调流行和声**在一条短和弦循环上，一小节一个和弦；每关有自己的味道（funk/quiz/electro/dream/heavy…），**不是换一首新歌**（demo：`F–G–Em–Am` 王道进行，`music.py:1`）。
- **拟音玩具化、带音高**：pop、plop + boing 落地、印章、打字机键击、蜂鸣器、叮、伺服嗡鸣、splat；带音高的 pip 可在人群降落时拼出一段旋律。
- **呼喊，不是句子**：1–3 个词，放在拍点**前 20–30ms**，让辅音落在拍上；人群呼喊 = 好几个不同嗓音叠几 ms、在立体声场里铺开（demo：`v:crowd` 用六个嗓音叠 5–6ms、pan −0.6…+0.6）。
- **强度选项**：每关一个 jingle（crash + 上升 brass + 军鼓滚）；终章升调；大击前一小节只剩鼓；揭示用半速一小节；一小节静默被一声呼喊打破。
- **混音**：人声与拟音走自己的 bus；音乐由那个 bus 的 12Hz 包络 duck 最多 40%；**软削波而非硬限幅**；−14 LUFS、真峰 ≤ −1 dB。

---

## 8. 变化空间（可自由发挥）

关卡及其动词、演员阵容、布景与颜色、有没有旁白、速度、开场、结尾与长度——**网格、绘画套件与字幕语言保持不变**（`STYLE.md:106`）。

`STYLE.md:110-112` 给了远离 demo 的方向：
- **结构**：淘汰赛对阵表（每关两名选手、胜者晋级、决赛是分屏舞台）；一个超长关卡（单一模式从四分一路升级到十六分，作为剧情压力）；三名选手的答题秀（每问一个事实，记分牌就是论点）。
- **开场**：先给判定（空舞台弹出 `Perfect!`，然后倒回它是怎么挣来的）；一个选手独自在光地上蹦到人群落进来；记分牌先给最终数字，再倒数回零。
- **结尾**：一张合影（蹦到一半定住、闪光、变成拍立得）；一张选关地图（每个完成的关卡是一个亮节点）；一块幕布一小节一小节落下、最后一声呼喊在幕布下面。

---

## 9. 禁忌清单

- 微型游戏大杂烩（没有计时器、不是每 3s 换画风）。
- 中世纪卡通（没有手绘质感背景、没有角色表演）。
- 发布会（没有慢揭示、没有渐变）。
- 渐变、模糊、纹理、柔和阴影（景深必须是硬偏移阴影）。
- 溶解转场。
- 脱离速度网格的运动。
- 有状态的逐帧更新（`render(t)` 必须只依赖 `t`）。
- 照抄任何真实游戏/综艺的角色、UI、关卡或音乐。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

- `SECT`（每个关卡卡的首小节，`main_b.js:243`）、`CUTS`（白闪小节线，`main_b.js:1171`）、`END_BAR`（由 `assemble.py:5` 字符串替换设定）。
- 关卡卡文本 `card(bar0, num, name, years, col, col2, icon)`；年份横幅 `banner(g, year, name, sub, col)`；remix 条目与月份带；道具文本。
- `music.py` 的 `PLAN[bar]` 与 `span(a,b,mode)`；`voices/lines*.txt`（呼喊行：`name|voice|rate|pitch|text`）。

### 10.2 新画面元素的契约

用 SVG 助手画：`el/txt` 建节点，`tf/op/show` 变换，`gtext(...)` 描边字幕，`chars(...)` + `charsPop` 逐字弹出标题，`stripes/dots/raysEl/starPath` 布景图案，`burst/judge/banner` 返回 `f(t)`。
角色用 `bean(parent,{color,belly,antenna,name,kind,...})` + `pose(c,{hey,open,sq,lean,face,blink,...})` / `poseAny`；人类 `human(...)`；道具 `podium/taskIcon/smallBot`。
**契约**：`scene(t0,t1,build)` 只建一次节点、返回 `update(t)`，`update` 只设属性（`main_b.js:158`）。

### 10.3 时间线契约

- `frame_head.html`：基础助手（`el/txt/tf/op/E/chars/charsPop/measure/bg`）。
- `main_v1.js`：速度网格 `at(bar,beat)/B/BARL/frac`、`ev(t,name,{f,i})`、`punch(t,a)`、`hopY/hitSq`、字幕/布景/爆发/判定/横幅。
- `main_b.js`：角色、`scene(t0,t1,build)`、`card(...)`、`render(t)`、`init()`。
- `assemble.py` 组装出 `main.js`，`build.py` 把 `frame_head.html` + `main.js` 变成 `index.html`。`render.mjs events` 导出 `events.json`。

### 10.4 事件词汇

画面里每个 `ev(t,name,{f,i})` 都被导出到 `events.json`（demo **474 个事件**），`music.py` 把每个事件名映射到一个声音：
`tock/bleep`（象棋）、`stone`（围棋）、`ding/boop/buzz`（答题）、`land`（plop+boing）、`pip`（带音高 pop，用 `f`）、`slam/bigslam`、`stamp`、`type`、`crack/hatch`、`servo`、`liftoff`、`swish`、`clap`、`drop`、`blip`、`kickhit`、`splat`、`denoise`、`cheer`；未知名字被静默忽略。呼喊是 `v:<name>` 事件，播放 `voices/<name>.wav`。

---

## 11. 构建链（复用机制）

```
1. 在网格上规划：填 SECT（每关卡首小节）、经 assemble.py 的替换设 END_BAR、把关卡卡小节加进 CUTS、写 cue 表。
2. 呼喊：往 voices/lines3.txt 加行 → sh make_voices.sh out/voices_new → 听 → 收进 voices/ → 加进 music.py 的 VO。
3. 建页面：$PY assemble.py && $PY build.py
4. 看：STILLS_DIR=out/check node render.mjs stills 5.5 20.4 45 78.3 116.5 145
5. 事件：node render.mjs events → events.json（demo 474 事件，dur 148.80）
6. 配乐+混音：$PY music.py → music.wav（约 2s，确定性，seed 7）
7. 渲染：node render.mjs video 2 → out/seg_0..1.mp4（demo 用 6 worker，共 120s）
8. 收尾：sh finish.sh out/test.mp4（concat → loudnorm → x264 slow crf 16 + AAC 256k 48kHz）
9. 字幕：$PY make_srt.py → ../game-show.srt
10. 复审：ffmpeg 接触表 + 每个 slam 附近的静帧
```
（`DEMO.md:117-126`）

**关键机制**：`render(t)` 必须是纯函数——remix 缩略图曾因「只在 `t < t1+0.01` 时更新」而在 6-worker 冷启动时显示初始状态；修法是每帧都在 `t1 − 0.001` 处重算缩略图（`DEMO.md:130`）。

---

## 12. 证据

```
styles/game-show/STYLE.md:3          一句话
styles/game-show/STYLE.md:6          45s–3min；旁白可选
styles/game-show/STYLE.md:10-13      本质四条
styles/game-show/STYLE.md:15         不是什么
styles/game-show/STYLE.md:19-24      材料与渲染
styles/game-show/STYLE.md:28-32      颜色逻辑
styles/game-show/STYLE.md:36-39      字体与字幕
styles/game-show/STYLE.md:43-50      运动质量
styles/game-show/STYLE.md:54-67      镜头语法表 + punch 上限
styles/game-show/STYLE.md:71-76      声音
styles/game-show/STYLE.md:82-89      native moves
styles/game-show/STYLE.md:110-112    变化空间
styles/game-show/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/game-show/DEMO.md:5           纯 SVG DOM + 纯 render(t)
styles/game-show/DEMO.md:8           全中文屏上文本 + 英文短呼喊 + 无旁白
styles/game-show/DEMO.md:12          故事结构
styles/game-show/DEMO.md:18-23       六个 native moves 的用法
styles/game-show/DEMO.md:25          demo 形状 93 小节 = 148.8s
styles/game-show/DEMO.md:31          正面台口 / BPM 150 / B 0.4 / BARL 1.6
styles/game-show/DEMO.md:35-38       逐段镜头表
styles/game-show/DEMO.md:42-46       配乐 / 474 事件 / 呼喊 / 混音
styles/game-show/DEMO.md:50-73       调色板 / 布景 / 字体 / 角色 / UI / 运动数值
styles/game-show/DEMO.md:130         render(t) 必须是纯函数
styles/game-show/demo/main_v1.js:5            调色板 K
styles/game-show/demo/main_v1.js:13-14        OW=8 / SO
styles/game-show/demo/main_v1.js:16           BPM=140（被改成 150）
styles/game-show/demo/main_v1.js:18-19        END_BAR=61（被改成 93）/ window.DUR
styles/game-show/demo/main_v1.js:24-25        ev / punch
styles/game-show/demo/main_v1.js:34           gtext
styles/game-show/demo/main_v1.js:40-60        stripes/dots/raysEl/starPath
styles/game-show/demo/main_v1.js:66           burst
styles/game-show/demo/main_v1.js:81           judge
styles/game-show/demo/main_v1.js:92           banner
styles/game-show/demo/main_b.js:2             bean
styles/game-show/demo/main_b.js:63            pose
styles/game-show/demo/main_b.js:81-82         poseAny / CAST
styles/game-show/demo/main_b.js:103           human
styles/game-show/demo/main_b.js:146-147       dropY / heyAt
styles/game-show/demo/main_b.js:158           scene(t0,t1,build)
styles/game-show/demo/main_b.js:166           card
styles/game-show/demo/main_b.js:242-243       buildAll / SECT
styles/game-show/demo/main_b.js:1171-1172     CUTS / render
styles/game-show/demo/assemble.py:5           字符串替换 BPM/END_BAR
styles/game-show/demo/music.py:1              150 BPM / F–G–Em–Am
styles/game-show/demo/music.py:113-115        CH / MA / MB
styles/game-show/demo/music.py:142            jingle
styles/game-show/demo/music.py:149-162        PLAN / span
styles/game-show/demo/music.py:330            tanh 软削波
styles/game-show/style.json:16-17             frame_sec 74.4 / dur 148.8
```
