# 50s 扁平卡通（midcentury-toon）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**，不收录示例《Meet Pip》的具体内容（那台扫地机、June、那三步都不是风格）。
> 证据见文末。

---

## 0. 一句话

一部 1950 年代教育片式的「跟着做」指南：扁平印刷色的形体配一条永不合拢的呼吸墨线，**每一块填色都是单独一张「赛璐璐」、印得比线偏几个像素并在二拍上重印**，于是画面像手工套印的颜料一样微微抖动。

**它不是**：1930 年代橡皮管卡通（没有黑白、没有弹跳的世界、没有热爵士）；也不是白板讲解——它教的是**「怎么做」而不是「为什么」**，画面是**印出来的**，不是画上去的。（`STYLE.md:14`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值 |
|---|---|
| **套印偏移** | 填色相对其线偏移几个像素（右下），偏移量在二拍（12fps）上抖动。demo 实测偏移 `(6,4)`px、抖动 ±1.6px。**一切都要带，文字也包括**；只有清晰图解才关。 |
| **线** | 3–5px 墨带，宽度 ±40% 呼吸、12–25% 断口。角色 ~4px、道具 3–4.5px、平面图里的墙 6–7px 且更断。 |
| **手** | 手掌与手指的并集只描**一条** 6px 外轮廓，手指之间用 2.4px 细线分隔。 |
| **明暗** | 一个平涂深色面裁在形状内部，**永不用渐变**。投影 = 形状副本、右下偏移 `(12,12)`、纸色阴影、50%。 |
| **装饰** | 4 角原子星、8–18 角星芒、放射光束（30 楔形、55% alpha）、回旋镖与腰子形、波点。 |
| **颗粒** | 轻（mux grain 4）+ 纸纹叠加；观感是印刷而非胶片。 |
| **定格身体** | 主讲人的身体是一张定格画，**只有手臂、手、眼睛、嘴在动**。 |
| **房间** | 不「画」房间：一个场景 = 一个色面 + 一条地面带 + 一条带缺口的水平线 + 一两个道具。 |
| **几何人物** | 蛋形/豆形头，**鼻子是脸部轮廓的一部分**（用一条从鼻梁绕过颅骨、在鼻尖闭合的开放样条，不能是贴上去的楔子）。 |
| **配色** | 暖纸底 `#F4EAD5`、暖近黑墨 `#2B2420`；**一场景一底色**（墙用更浅的 tint(col,.45)、地面用更深的 shade(col,.16)）；**产品全片一色到底**，强调色是另一个色相；产品绝不放自己的颜色上，主讲人绝不放自己的强调色上。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：冷静的课堂权威（calm classroom authority）。第三人称/祈使混合、现在时，直接对观众说。

**长度（实测）**：单句 **23–40 字符**（很短）。字幕宽上限 1280px（42px 字），最多一行。停留 ≥ max(1.8s, 语音 + 0.6s, **字符数/12 + 1s**)。

**句首类型**：
- 打招呼式钩子：`Meet X.`
- 编号式开场：`Step one. …`（步号 + 一个祈使从句）
- 以动作起句：`Open the app and add …`
- 提示句式：`Tip: …`
- 结尾用计数收束：`Three steps. That's it.`

**不会出现的句式**：解释原理的长句（只教「怎么做」）、多重从句/嵌套句（一行只放一个从句）、第一人称品牌腔（`we've engineered`）、形容词堆砌的营销话术。

---

## 3. 叙事节奏

**信息投放顺序**（产品安装指南）：

```
钩子揭示（产品名 + 一句介绍）
  → 逐步循环：步骤标题（编号徽章 + 标题）→ 广景 + 圆形放大特写 → 该步数据落在动作拍 → 一个手势
  → 回报（把功能变成装饰：一条真实流程逐区画出来，退后一看像原子时代织物）
  → 提示 → 海报落版（各步变成编号勋章）→ 虹膜收束到产品 → 片尾卡
```

**时间挂在 132 BPM 网格上**：1 拍 ≈ 0.4545s，1 小节 ≈ 1.818s。

| 层 | 停留规则 |
|---|---|
| hook | 4 小节 |
| 每个 step | **≥ 3 小节**（由语音时长决定：`max(3, ceil((语音 + 1.6)/BAR))`） |
| 最后一步 | 2 小节 |
| payoff | 3 小节 |
| tip | 2 小节 |
| lockup | 3 小节 |
| end | 2 小节 |
| 步数 | **2–5**（每步增加 ≥3 小节 = 5.45s） |
| 标题停留 | ≥4s |
| 步骤标题 | 覆盖整个 step |
| 细节数据停留 | ≥ chars/12 + 1s |
| 总结画面 | 干净停留 ≥3s |
| 圆形特写弹出 | 0.32s（back-ease 1.5） |
| 勋章盖章弹出 | 0.24s |
| 标签弹出 | 0.26–0.3s（overshoot 1.9） |
| 字幕淡入 | 0.16s + 上移 10px |

**总时长**：主 demo 40.0s（3 步 = 22 小节）。用例区间：产品安装 30–40s、安全/规则卡 20–40s、食谱 30–45s、App 引导 20–30s、门店通知 15–25s。4 步 ≈ 45s（要 ≤40s 就砍提示或片尾卡）。

**静默怎么用**：静默是工具，三处。
- **A**（0–1.36s）：没有音乐，只有盒子。
- **B**（按下按钮前的最后一拍，demo 实测 20.909–21.80s）：**一切关掉、连环境音也关**，所以静默之后第一个声音（开始咔哒）就是那一步。
- **C**（落版之前，demo 实测 30.2–30.905s）：只留房间底噪，静默后第一个声音就是第一枚勋章盖章。

---

## 4. 镜头逻辑

**镜头是什么**：「支架」（the stand）——**永不用手持**。只做推、横移、俯仰、拉远，是一套词汇而非固定路线。

| 运动 | 表达 | 可服务 |
|---|---|---|
| 慢推（几个百分点） | 把视线收拢 | 舞台上的产品；一个结果落定 |
| 穿过勋章的虹膜 | 编号本身就是那扇门 | 换步骤；换规则 |
| 带引线的圆形特写（call-out） | 同时给出语境与细节 | 一个手部动作；一块屏幕；一个小零件 |
| 跟着指点的手指俯仰 | 手指引导画面 | 最重要的那一个动作 |
| 推入设备、沿信号环横移 | 人 → 界面 → 设备 | 配对；连接 |
| 从一个圆形物体虹膜进入顶视图 | 圆到圆、功能到平面图 | 一个按钮启动一项工作；开盖；旋钮 |
| 拉远 + 反向旋转，从细节到平面图 | 一条车道变成一片图案 | 路线、日程、花园、平面图 |
| 色块擦除（侧向 / 自下而上） | 翻动手册的下一页 | 一个提示；一段总结；一张新卡片 |
| 双色块分割画面 | 对 vs 错、之前 vs 之后 | 一条安全规则；一次升级 |
| 完全静止 ≥3s | 「这一帧是拿来截图的」 | 总结；行动号召；二维码 |
| 虹膜收到一个物体上 | 最后一个圆 | 收束在产品、logo、结果上 |

**允许的转场**（必须来自媒介本身）：圆（虹膜 / 穿过勋章）、色块擦除（侧向、自下而上）、落在拍点上的切换。

**禁止**：溶解（dissolve）；手持镜头；在下一场景开始前就把它画出来（过渡里要把局部时间夹到起点之后）；让关键主体小于画面高度 1/3 或落进底部 140px 的字幕带。

---

## 5. 表达习惯（idioms）

1. **套印偏移**让一张扁平信息卡显得手工、温暖。
2. **有限动画引导视线**：身体不动时手是唯一在动的东西，而那只手**就是**这一步；每个步骤一个手部动作，带预备（回拉/上抬，20–60px）→ 快动作（0.15–0.25s，缓出）→ 跟随（回弹 6–10px、落定、抬起），并精确落在拍上。
3. **圆形特写**就是特写：广景保留语境，手在圆里变大；该步数据落在圆内或圆上、落在动作拍，**绝不做成幻灯片**。
4. **编号勋章**既是层级标记也是门：盖在退场场景的主体上，镜头穿过它进入下一步。
5. **回报把功能变成装饰**：一条真实流程逐区画出来，退后一看像一块原子时代织物。
6. **弹出（pop-in）**：勋章、标签、标题用 back-ease 缩放入场（~0.25s，强过冲 1.9）。
7. **够到地面**：用 2 骨 IK 的跪姿让手留在物体上（demo：髋部下沉 150 单位），**绝不在站立姿态里拉伸手臂**。
8. **写字**：手写体从左到右用 clip「写」出来；标题在二拍上滑入。

---

## 6. 氛围

温暖的家庭/课堂空间：一张暖纸底、柔和的原子时代互补色、安静的房间底噪与座钟滴答。整体是**友善、清楚、可复制**的气质——观众看完就能动手做。

---

## 7. 声音

- **合成音色**：颤音琴（主角：和弦、琶音、滑音、电机式颤音）；长笛（旋律）；低音提琴拨弦（walking）；刷子鼓（swirl + 2/4 拍；回报段用 ride 鼓棒）；钢片琴做色彩。**不是 ragtime、不是间谍大乐队、不是钢琴加弦乐。**
- **动作声（按材料分层）**：纸板（吱嘎、盒盖砰击、纸纤维拍打）、家电塑料（敲击、咔哒）、地面刮擦、玻璃与陶瓷叮、倾倒、阻尼橡胶图章（盖章）、纸的唰声（擦除）、滑哨（尺寸箭头）、上行 pip（「已连接」）、笔尖刮擦（画路线）、虹膜的「shhk」。环境：暖房间底噪（低通棕噪、约 −42dB）、半拍网格上的极轻座钟滴答；设备工作时其电机嗡鸣可以接管。
- **混音规则**：三层始终在场 + 环境。J/L-cut：台词比它的虹膜早半拍开始，尾音继续响。旁白压缩后压在最上，**音乐在人声下压 ~8dB，拟音不压**，−14 LUFS、真峰 −1.2。静默按段落闸门。
- **节奏弧**：正常 → 回报段加倍（升一个全音）→ 提示段减半（换气）→ 落版恢复正常。
- **可选做法**（`STYLE.md:69`）：**给每一步一个自己的颤音琴和弦**，在总结里逐个带回；用「减半/加倍感觉」而不是改速度；回报段升一个音级。

---

## 8. 变化空间

教的是什么、有没有主讲人、哪些步骤及顺序、开场、结尾、镜头路径、颜色、节奏、音乐。

`STYLE.md:114-116` 给了远离 demo 的方向：
- **结构**：无产品的规则卡（每条规则一个定格人物 + 一枚勋章）；桌面视角的食谱（结尾转顶视）；do / don't 双色块分割（每条规则演两遍）。
- **开场**：先给成品，再说「这是怎么做的」；用一个手势给出问题（手在跟线缆较劲）；先盖章式列出编号清单，再逐条展开。
- **结尾**：自己打勾的清单；手在成品旁静止；星芒中纹丝不动的二维码。

---

## 9. 禁忌清单

- 渐变的明暗（只能平涂深色面）。
- 把套印偏移关掉（除清晰图解外）——它必须出现在一切东西上，文字也包括。
- 溶解转场。
- 手持镜头。
- 让产品落在它自己的颜色上，或让主讲人落在自己的强调色上。
- 把关键主体放进底部 140px 的字幕带，或让它小于画面高度 1/3。
- 在静默窗口里留任何声音（连环境音也不行）。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`content.json`）

| 字段 | 类型 | 范围 | 越界后果 |
|---|---|---|---|
| `product` | string | 1–12 字符 | 挤进盒标签（`maxW`） |
| `kind` | string | 自由 | 仅供你自己参考 |
| `title` / `subtitle` | string | ≤36 / ≤24 字符 | title 在钩子里换 2 行、落版缩到 50px |
| `hook.kicker` / `hook.line` | string | ≤14 字符 / 一句话 | kicker 挤到 760px；line 成为第一条字幕 |
| `steps[]` | array | **2–5** | 每步增加 ≥3 小节 = 5.45s；落版行超过 3 步时重排距（R 104 → 88px）；4 步 ≈ 45s |
| `steps[].title` | string | ≤22 字符 | 标题缩到 40px、落版换 2 行 |
| `steps[].detail` | string | ≤30 字符 | 换 2 行，须在窗口内可读（chars/12+1s） |
| `steps[].icon` | enum | 18 个图标名 | 未知 → `spark` |
| `steps[].action` | enum | `place` / `tap` / `press` / 其他 | `place`=推向墙 + 间距图解；`tap`=手机配对 + 信号环；`press`=手指 + 保持环；其他 → `show` |
| `steps[].measure` | string | 如 `"50 cm"` | 仅 `place`；空 = 无标签箭头 |
| `steps[].line` | string | 一句短句 | 配音 + 字幕；长句会拉长该步 |
| `payoff.caption` | string | ≤40 字符 | 缩到 26px |
| `payoff.plan` | object | `y0,y1`、`dock[x,y]`、`zones[]`（name,x0,x1,color,checks）、`rug`、`items[]`（shape: sofa/kidney/boomerang/chair/plant/table/bed; x,y,s,rot,color,accent），单位 1920×1080 平面像素 | 窄于 400px 的区只做沿墙环路；物品自动成为流场障碍 |
| `tip.label/text/icon/line` | string | text ≤40 | 表头缩小、缎带加宽 |
| `outro.line` / `outro.cta` | string | cta ≤48 | CTA 缩到 20px |
| `palette` | object | `paper,ink,product,productDark,accent,hook,steps[],tip` | 缺键回退到 demo 配色 |
| `voice` | object | Kokoro `id`/`speed` | — |
| `film` | object | `name,style,credits` | 片尾卡 |

> ⚠️ `DEMO.md:149` 明确：换 content 只是「验证引擎能重排的技术检查」，不是做片子的方式。
> ⚠️ 配乐是按 22 小节写的；步数一变长度就变，要重跑音乐子智能体（`DEMO.md:133`）。

### 10.2 新画面主体的契约

主体通过引擎的三个模块来画：
- **`demo/engine/toon.js`**（风格本体）：`setClock(t)` 设二拍抖动时钟；`shape(ctx, pts, o)` 画**任意形状**（套印填色 + 纸牙 + 断墨线，参数 `fill/line/off/grain/breaks/shade/seed`）；`ink` 墨带；`plane` 无线的地面；`text` 双色板文字；`fit` 换行后缩到合适；`arrow` 会动的手册箭头；`star/sparkle/rays/atom/kidney/boomerang` 装饰；全局套印 `REG = {dx:6, dy:4, jit:1.6, on:true}`。
- **`demo/engine/chars.js`**（人物与产品）：`drawOwner(ctx, pose, t)`（x,y,s,dir,view/face/armF/armB/handF/handB/kneel/blink/look/prop）、`drawHand(ctx, x, y, angle, kind, side, scale)`（四指手套：open/flat/point/grip）、`drawPip(ctx, x, y, o)`（view: side/top）。
- **`demo/engine/icons.js`**：18 个图标（dock, phone, start, cable, wifi, plug, water, beans, cup, filter, box, clock, check, leaf, key, bulb, spark, gear）。

所有函数都在当前 canvas 变换里作画。

### 10.3 时间线契约

`film.js` 导出 **`setup(content, durs)`**、**`DUR()`**、**`events()`**、**`srtCues()`**、**`renderFilm(ctx, t, Q)`**、**`section(t)`**：
- `setup` 从 content.json 的步数与语音时长重建时间线（**始终落在 132 BPM 网格**），生成配音表 `T.V`、字幕 `subs()` 与事件表 `EVS`。
- 页面契约（`main.js`）：`window.DUR` / `window.EV` / `window.SRT` / `window.render(t)` / `window.READY`。
- 工具 `tools/cues.mjs` 直接从 `film.js` 导出字幕 `cues.json`（不需要无头浏览器）。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 备注 |
|---|---|---|
| `creak` / `box_thump{pan,pitch}` / `box_fall` | 开盒 | 纸板拟音 |
| `ding{gain}` | 叮 | — |
| `pen_write{dur}` | 写字 | — |
| `plastic_land` / `plastic_thock` | 塑料落地/撞击 | — |
| `wood_tick` / `wood_block` | 木声 | 座钟也用 wood_tick |
| `stamp{gain}` | 勋章盖章 | 阻尼橡胶图章 |
| `whoosh{dur}` | 过渡 | — |
| `slide{gain}` / `scrape{dur,gain}` | 滑动/刮擦 | 地面刮擦 |
| `pop{gain}` | 弹出 | — |
| `plug_click` / `flip` | 插头/翻页 | — |
| `whistle{pan,up}` | 尺寸箭头滑哨 | — |
| `tap` / `beep{n}` | 点击 / 上行 pip | 配对信号 |
| `btn_soft` / `hold{dur}` | 软按钮 / 保持 | 按开始 |
| `motor{dur}` | 电机嗡鸣 | payoff 接管环境 |
| `click_big` | 大咔哒 | payoff 起点 |
| `zone{n}` | 路线逐区画 | 笔尖刮擦 |
| `dock` | 回座 | — |
| `paper_swish{gain}` | 纸的唰声 | 擦除/换页 |
| `grab` / `peel{dur}` | 抓取 / 剥离 | 墨线揭离纸面 |
| `roll{dur}` | 滚动 | — |
| `iris{dur}` | 虹膜 | 「shhk」 |
| `vo{id}` | 人声 | 加载 `voices/<id>.wav` |

> **静默不写进事件表**：在 `mix.py` 里用 `gate()` 按绝对秒数硬编码（B: 20.909–21.80 真静音；C: 30.2–30.905 只留房间底噪）。这是本风格与 engraving / hologram-hud 不同的机制——换内容时静音窗口不会自动跟着重排。

---

## 11. 构建链（复用机制）

```
sh styles/midcentury-toon/demo/build.sh           # 从零重现
CONTENT=content_alt.json sh .../build.sh stills   # 换内容测试（三张静帧，不需音频）
  # 1. python3 tools/lines.py content.json lines.json（配音行；步号 one→1 供 ASR）
  # 2. Kokoro 配音（am_michael）→ voices/ + dur.json
  # 3. whisper 逐句校对（每行必须 OK）
  # 4. music/score.py：原创冷爵士 → score.wav + stems + hits.json
  # 5. core/render/events.mjs：画面事件 → events.json（同一批时间驱动拟音）
  # 6. tools/cuecheck.py：画面卡点 vs 半拍网格 + 配乐
  # 7. mix.py：拟音 + 人声 + 闪避 + 三处静音 → mix.wav
  # 8. tools/cues.mjs → cues.json → srt
  # 9. 逐帧渲染 → mux（−14 LUFS，轻颗粒 grain 4）
```
（`build.sh:1-21`）

**关键机制**：`film.js` 的 `buildEvents()` 产出的 `type` 表同时喂给 `mix.py`（声音）与 `cuecheck.py`（卡点自检）；`setup()` 从 content 重建整条时间线。但**静音窗口与配乐小节数不自动重排**——这是它与前两个风格不同的地方。

---

## 12. 证据

```
styles/midcentury-toon/STYLE.md:10-14      本质与不是什么
styles/midcentury-toon/STYLE.md:18-22      套印/线/明暗/装饰/颗粒
styles/midcentury-toon/STYLE.md:26-29      颜色逻辑
styles/midcentury-toon/STYLE.md:33-36      字体/字幕卡/步骤头/细节标签
styles/midcentury-toon/STYLE.md:40-44      二拍/定格身体动手/弹出/2 骨 IK/写字
styles/midcentury-toon/STYLE.md:48-64      相机词汇表与允许的转场
styles/midcentury-toon/STYLE.md:68-74      音乐/静默/拟音/环境/混音/配音
styles/midcentury-toon/STYLE.md:80-84      原生手法分工
styles/midcentury-toon/STYLE.md:104-118    用例表与变化空间
styles/midcentury-toon/STYLE.md:118        换 content 只是技术检查
styles/midcentury-toon/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/midcentury-toon/DEMO.md:12          demo 结构
styles/midcentury-toon/DEMO.md:27-43       镜头表/圆转场语法/时间线（22 小节 = 40.0s）
styles/midcentury-toon/DEMO.md:49-56       配乐/静默/J-L-cut/环境/拟音/混音/叙述者
styles/midcentury-toon/DEMO.md:60-82       调色板与全部数值
styles/midcentury-toon/DEMO.md:108-149     content.json 字段表
styles/midcentury-toon/DEMO.md:151-186     引擎参考与最小示例
styles/midcentury-toon/demo/film.js:3                     132 BPM 网格
styles/midcentury-toon/demo/film.js:10                    BPM/BEAT/BAR
styles/midcentury-toon/demo/film.js:19-41                 setup 建时间线
styles/midcentury-toon/demo/film.js:43                    语音兜底 words/2.9+0.2
styles/midcentury-toon/demo/film.js:47-52                 subs() 停留规则
styles/midcentury-toon/demo/film.js:62                    pop 过冲 1.9
styles/midcentury-toon/demo/film.js:67-105                字幕卡与细节标签
styles/midcentury-toon/demo/film.js:107-125               圆形特写与编号勋章
styles/midcentury-toon/demo/film.js:615-620               payoff 相机 2.6×→1.0×
styles/midcentury-toon/demo/film.js:817-854               转场块
styles/midcentury-toon/demo/film.js:857-889               buildEvents() 全部 type
styles/midcentury-toon/demo/mix.py:1-6                    三层结构/duck 8dB/静音说明
styles/midcentury-toon/demo/mix.py:127-132                房间底噪 + 半拍网格座钟
styles/midcentury-toon/demo/mix.py:139-150                duck −8dB、gate 静音窗口
styles/midcentury-toon/demo/music/score.py:1-19           132 BPM/F→G/摇摆 60%
styles/midcentury-toon/demo/music/score.py:135-145        和弦表
styles/midcentury-toon/demo/build.sh:1-21                 构建链与换内容
styles/midcentury-toon/demo/tools/lines.py:1-8            content → lines.json
styles/midcentury-toon/demo/tools/cues.mjs:1-8            直接导出字幕
styles/midcentury-toon/demo/content.json:1-147            示例内容字段
styles/midcentury-toon/demo/events.json:1                 事件表实测
styles/midcentury-toon/style.json:16-17                   frame_sec 3.2 / dur 40.0
```
