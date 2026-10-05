# 蓝图 / 工程制图（blueprint）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Patent Pending: The Cloud Catcher》的具体内容（那台接云机、那朵云、那朵花都不是风格）。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一整部片子发生在一张铺在深色绘图桌上的**晒图纸**上：普鲁士蓝的纸、白得发亮的线条，用**制图顺序**一笔笔把自己画出来；全片是 2D 线条语言（正投影 + 斜二测），绝不做 3D 渲染。

**它不是**：全息 HUD（发光线框 + 3D 环绕）、白板（白底马克笔）、铜版画（雕刀排线当主视觉）、渲染出的实物。
**干巴巴的工程规范与一点顽皮互相较劲**；而全片只允许**一个画出来的符号**违反规则变成真的。
（`STYLE.md:16`、`DEMO.md:12`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「晒图纸上的一个制图环节」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸即世界** | 3200×2200 纸面单位，对折成四份。普鲁士蓝在 *纸面坐标* 的 WebGL 片元着色器里程序生成（任意缩放都清晰）：低频 fbm 在 `#18336B`→`#2A58A6`、横向涂布刷痕、从左到右轻微褪色、纸纤维高频噪声 + 稀疏纤维丝、十字折痕（亮边+暗边+折线磨白）、不规则漂白边角、零星小污点。纸外是深色绘图桌布 `#0D1116` + 纸的落影。 |
| **线只有一种色** | 淡蓝白 `#E7F0F9`，略软（mipmap 晕开），带一点纸纹驱动的墨迹断续。 |
| **四级线宽** | 纸面单位：轮廓 3.2 / 细节 2.0 / 细 1.25 / 发丝 0.9。 |
| **线宽随缩放** | **屏幕线宽 = 纸面线宽 × zoom^0.65**——近景不涨成香肠、远景不消失。不缩放 = 失败。 |
| **虚线约定** | 中心线 `[34,7,6,7]`（长短）、隐藏线 `[11,7]`、幻影/剖切面 `[30,6,5,6,5,6]`，全部随缩放缩放（图案留在纸上）。 |
| **遮挡靠画家顺序** | 每个实体先用「纸」（ink 缓冲的黑）填掉再描轮廓。 |
| **斜二测挤出** | 在 N 个深度步上以 2× 线宽描轮廓，再用纸填同样的 N 步 → 活下来一条半宽的干净剪影；正视图与可见顶点连线画在最上层。 |
| **三张画布合成** | ink（灰度，白 = 曝光的线）、fx（R=阴影压暗 / G=湿度 / B=印章红，`lighter` 叠加）、overlay（字幕最后叠）。阴影也压暗线条——这是「被抬起的物体」证明自己离开纸的方式。 |
| **剖面线** | 细线阴影法，45°，间距 8–14 纸面单位。 |
| **晒图纸与水** | 一滴水晕开更深的蓝 + 一道浅色潮线，水渍里的白线变软；签名上的水滴会洇开。 |
| **唯一真实物** | 一个离开制图语言的符号获得柔和体积、跨整个形状的单一渐变、辉光，以及一道落在纸上线条上的影子；离开后原地留一块浅色「未曝光印子」。 |
| **图纸家具是画面** | 双线图框 + 8×5 分格刻度、页眉、标题栏、零件表、GENERAL NOTES 注释栏——都是画面的一部分，不是 UI 浮层。 |

**关键取向**：`STYLE.md:92-100` 列了这媒介的陷阱——主图形贴边会露桌面、向上的爆炸会撞页眉、字幕画在 ink 缓冲会随纸跑掉、逐瓣着色读起来像葡萄、重叠加色圆会冒泡。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位**干幽默的英国工程师**在念自己的设计笔记（Kokoro `bm_daniel`，`en-gb`，speed 0.9）。第一人称单数、现在时。克制、精确，不煽情。

**长度（实测）**：单句 **25–72 字符**（约 5–15 英文词），全片只有 **5–6 行**。最短是公文体短句（`So, I issued a revision.`），最长是带数词的部件清单句。字幕是「图纸注释框」：宽上限 **880px**（短句用 600），框高 ~110–150px，每行停留 **≥ max(1.8s, 语音 + 0.6s)**，下一句前 0.1s 撤下。

**句首类型**（示例性，不是抄原文）：
- 图号 + 指认式开场：`Figure one. An apparatus for catching clouds.`
- 数词 + 部件清单：`Thirteen parts, one bellows, and a rather optimistic net.`
- 先给结论再反转：`It works beautifully. Except, there are no clouds on this sheet.`
- 公文体修订语：`So, I issued a revision.`
- 状态字段式收束：`Status: works. Slightly damp.`

**这个风格里不会出现的句式**：
- 第一人称复数/营销腔、感叹号堆叠（`revolutionary`、`you won't believe`）
- 抽象概念当主语（只谈可被画出来的零件、尺寸、位置、动作）
- 一句塞两个以上并列信息点（每句只承担一层）
- 煽情或抒情（情绪由机器姿态、配乐与静默承担，不由旁白承担）

---

## 3. 叙事节奏

**信息投放顺序**（工程师的作图顺序）：

```
纸卷甩开铺平 → 页眉（标题 + PATENT PENDING）
  → 中心线 → 轮廓 → 细节 → 剖面线 → 尺寸 → 气球 → 标注（主体一帧帧「长」出来）
  → FIG. 1 画完
  → 爆炸视图（FIG. 2：斜二测把平面「转」出厚度，零件沿深度轴飞出、活尺寸数字跟着变）
  → 运转（FIG. 3：齿轮咬合、链条带动）
  → 缺陷（一切完美，但纸上没有云；配乐 ritardando → 真静默）
  → 手影拿笔修订（REV. 1，只加一朵云）
  → 符号成真（修订云线鼓起成真的云；悬置和弦、无旁白）
  → 接住 → 下雨 → 回报（雨后开花，逐笔画出）
  → 印章（红橡皮章 WORKS，全片唯一非蓝色）
  → 标题栏最后一行 lettered in（片尾卡）
```

**时间挂在 108 BPM 网格上**：1 拍 = 0.5556s，1 小节 = 2.222s，十六分 = 0.139s。

| 层 | 停留规则 |
|---|---|
| 总长 | `DUR = B(22)` = 21 小节 = **46.667s** |
| 旁白时刻 | v1..v6 = 5.2 / 12.2 / 21.9 / 26.1 / 35.0 / 40.7s |
| 爆炸 | 零件每 **~0.055 进度**放出一个（落在八分音符上，eased）；回来时每八分音符组回一个（带黄铜咔哒） |
| 齿轮 | 每八分音符前进 **7.5°**（`TAU/48` = 一齿），带 0.35 拍 ease-out；啮合相位算准让齿真的互锁 |
| 风箱 | 每拍呼吸一次 |
| 失效 | 约 **1.5s**（齿轮减速 + 风箱泄气 1.0s + 吊臂下垂） |
| 喜悦 | 风标弹正、指针 overshoot 到 1 |
| 字幕 | 提前 0.1s 上、滞后 0.2s 下，停留 ≥ max(1.8s, 语音 + 0.6s) |
| 每个图层 | 都在一个拍点上开始 |

**总时长**：主 demo 46.7s（`style.json`，1120 帧 @24fps）；STYLE.md 明确该风格适合 **30–60s**。

**静默怎么用**：静默是**真实存在的一整段**，不是空。缺陷揭示后（24.6s）留 4.4s 的「房间」——只把房间底噪留到极低；修订段（25.0–28.7s 手影画云）除了一串笔尖刮擦和一支三音疑问动机外几乎全静；奇迹段（`B(14)`）只有两口气的纸「噗」声 + 1.1s 噪声渐强，旁白要等到 35.0s 才回来。**静默里只允许纸的声音**（`STYLE.md:76`）。

---

## 4. 镜头逻辑

**镜头是什么**：一只**读图纸的眼睛**——镜头在纸面上移动、平移、推近，像在阅读一张图。没有 3D 环绕、没有实物渲染。它只负责把视线引到该看的地方，并在需要时让平面「转」出厚度。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 整张纸铺在桌上 | 尺度；图纸作为一件物品 | 开场；判决；一叠图纸 |
| 主体中景（约占画面高 80%，一侧留空白天空） | 正在被画出来的设计 | 制图；讲解某个零件 |
| 沿一条力的路径推移（链条、管道、电线、梁） | 因果；它如何运作 | 运作原理；一串操作 |
| 在强拍上切到 2× 特写 | 机械的心脏 | 齿轮咬合；一个阀门；一个关节 |
| 锁死机位、停一拍 | 斟酌 | 手在修改；一个决定 |
| 斜二测深度因子 0 → 0.5 | 平面图「转」过来、获得厚度 | 从平面到实物；揭示深度 |
| 剖面线扫过 | 内与外 | 剖切；隐藏结构 |
| 沿 Fig.1 → Fig.2 → Fig.3 横向平移 | 版本、步骤、时间 | 修订；施工阶段 |
| 缓慢推近、无旁白 | 惊奇 | 那个唯一真实的东西 |

**允许的转场**（必须来自制图本身）：强拍硬切；**Fig 编号改写**（旧号划掉、写上新号）；剖面线 A–A 扫过。

**禁止**：溶解/叠化（`no dissolves`）；3D 渲染 / 3D 环绕；把主图形放到会被取景的图纸边缘；无来由的运镜。

---

## 5. 表达习惯（idioms）

1. **制图顺序即动画**：中心线 → 轮廓 → 细节 → 剖面线 → 尺寸 → 气球 → 标注，每图层落在一个拍点上，按弧长一笔笔「画」出来，笔尖是个发光小点。
2. **活标注**：尺寸线测量正在运动的零件、数字跟着变（齿轮转速 `n = … RPM`）；气球跟着爆炸的零件飞；剖面线扫过机体露出内部。
3. **Fig 编号当转场**：旧号被划掉、写上新号，配一行小字（EXPLODED VIEW / IN OPERATION）。
4. **投影即镜头**：斜二测深度因子从 0 动画到 0.5，线条图「转」过来获得厚度——不用 3D 渲染器。
5. **一个符号成真**（全片唯一、放情绪最高点）：修订云线变成真的雨云。规则：这是全片唯一离开制图语言的东西。
6. **晒图纸与水**：雨打在纸上，每滴晕开更深的蓝 + 浅色潮线；签名上的一滴水让它洇开。
7. **标题栏当故事**：STATUS 字段 = 片子的判决；修订行 = 历史；片尾卡 = 标题栏最后一行被写上去。
8. **机械按擒纵机构走网格**：齿轮每八分音符前进一齿，啮合相位算准；链条跟着链轮走。
9. **机器靠姿态演戏**：角度、下垂、体积、指针就是它的脸。

---

## 6. 氛围

一张铺在深色绘图桌上的晒图纸：普鲁士蓝、纸纤维、折痕、漂白的边角、铅笔与针管笔的沙沙。整体是「**耐心、精确、一本正经里藏着顽皮**」的气质——不是戏剧性，而是「一件被认真画出来的东西，忽然自己动了」。

---

## 7. 声音

- **乐器**：羽管键琴 + 巴松（staccato，比主题低两个八度做模仿）+ 弦乐 spiccato（「齿轮在咬」）+ 竖琴（雨段分解和弦）；可选钢片琴、音乐盒、clavichord、小编制管乐。
- **配器逻辑**：**模仿式对位**（创意曲/卡农/赋格托）像咬合的部件；一段短重复动机就是那个「齿轮」。
- **动作声（按材料分层）**：纸（卷纸噼啪 + 拍纸、丁字尺木滑、针管笔刮纸 2–6kHz 颗粒且长度 = 笔画长度、写字是一串短笔画、圆规吱、排线 13 笔/s、橡皮擦、描图纸沙沙）；黄铜与木（部件咔哒 3.1/5.2kHz 共振、擒纵 tick、链条哗啦、弹簧嘣、按 ×1.35 几何减速的泄气 tick）；水（每滴柔和 damped pat + 轻雨底）；橡皮章闷响、笔帽咔哒。
- **混音规则**：音乐在人声下 duck 到 **0.36**（0.25s uniform filter 平滑，避免抽吸），拟音再让一半；whoosh 低通 **2.5kHz**（否则盖住「bellows」辅音）；最终 `mix = M*1.0 + FX*.55 + VO*.7`，限幅 0.95、归一化 0.89；**−14 LUFS**；mux grain 4（纸纹已在画面里）。

---

## 8. 变化空间（可自由发挥）

设计的是什么（机器/物件/建筑/方案）、它有哪些图（Fig 数量与顺序）、缺陷或转折（有无）、旁白、那个「唯一真实的东西」（或干脆没有）、镜头路径、开场、结尾与长度。

`STYLE.md:111-114` 给了远离 demo 的方向：
- **结构**：一座城市穿过多次修订（同一张总平面 REV.1 到 REV.6，每版十年，标题栏填满日期）；两张图、一张桌子（两个设计并行画出、最后发现能拼在一起）；倒着拆解（图纸一开始是满的，零件被一件件擦掉，只剩想法的那条中心线）。
- **开场**：一条中心线在第一拍横穿空白的纸；印章先落（REJECTED 先盖下，再看到被拒的是什么）；把描图纸从一张完成的图上揭起来，露出下面空白的纸。
- **结尾**：纸沿折痕折成口袋大小的方块；一个咖啡杯印落在标题栏上，潮线变成设计的最后一个圆；灯灭了，白线在暗纸上微微发亮。

---

## 9. 禁忌清单

- 3D 渲染、3D 环绕（只允许正投影与斜二测/等轴测）。
- 任何第三种颜色：蓝与白之外，全片只能有**一次**非蓝色（橡皮章墨）。
- 溶解/叠化等 UI 式转场。
- 线宽不随缩放缩放。
- 让物体被自己的影子压暗。
- 逐瓣着色（读起来像葡萄/气泡膜）——一个形状只用一个跨整体的渐变。
- 用重叠加色圆填云（会冒泡）——并集要按一条路径 `nonzero` 填。
- 把主图形放到会被取景的图纸边缘，或让向上的爆炸撞到页眉。
- 把字幕画在 ink 缓冲上——必须用单独的 overlay。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`lines.json`）

本风格**没有单独的 `content.json`**——文案与语音由 `lines.json` 驱动：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 惯例 `v1`..`v6`（对应时间轴里的 VO 时刻） |
| `voice` / `speed` / `lang` | string / number / string | 例：`bm_daniel` / `0.9` / `en-gb` |
| `text` | string | 单行旁白；实测 25–72 字符，5–6 行 |
| `asr` | string（可选） | 告诉 whisper 该听到什么（如把 `Figure one` 校对成 `Figure 1`） |

语音时长由 `voices/dur.json` 提供。机器/场景几何写死在 `machine.js`（`G` 地面线、`X` 桅杆轴、`M` 各枢轴、`EXP` 爆炸偏移、`ORDER`/`EXSEQ` 爆炸顺序）与 `sheet.js`（`PARTS` 零件表）；页眉/标题栏文字（标题、PATENT PENDING、日期、DWG NO.、SCALE、SHEET、签名、片尾 STYLE/DRAWN BY）也写在 `sheet.js` 里。

> ⚠️ 换 `lines.json` 重跑只是「验证引擎能重排」的技术检查，**不是做片子的方式**。真片子有自己的 treatment、结构、镜头路径与时间线。

### 10.2 新画面主体的契约

一个新主体 = 一个新模块（参考 `demo/machine.js`）：
- 导出一组**正立面几何**（纸面坐标，y 向下）+ 一个 `drawMachine(P)` 绘制函数。
- `P` 携带状态：`E`（爆炸进度）、`gear`（齿轮角）、`boom`（吊臂角）、`bellows`、`vane`、`gauge`、`section`（剖切线扫过的 x）、`pr`（各图层的画入进度 `c/o/g/d/h/b`）。
- 几何用 `draw.js` 的原语：`solid`（斜二测挤出）、`hatch`（剖面线）、`gearPts`（齿轮齿形）、`circ`/`ell`/`rect`/`xf`。
- 爆炸偏移与顺序写在模块里（`EXP`/`ORDER`/`EXSEQ`），啮合相位由 `meshAngle()` 算。
- **所有几何都是折线**，便于按弧长「画」出来。

### 10.3 时间线契约

`film.js` 导出：
- `renderFilm(t)` → `{ cam, roll, sheet, seed, wetBlur, fade }`（交给 `paper.js` 的合成器）。
- `DUR`（总时长）、`EV`（按时间排序的音效事件数组）、`subs()`（字幕条）、`setLines(lines, dur)`。
- 页面契约（`main.js`）：`window.render(t)` / `window.DUR` / `window.EV` / `window.SUBS` / `window.READY`；`?frame=1|2|3` 出静帧、`?nosub`、`?poster`。
- 渲染用 `core/render/video.mjs`（Canvas2D + WebGL2，24fps）。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者（mix.py） |
|---|---|---|
| `unroll` | 纸卷甩开 | 纸噼啪 + 低滚 |
| `slap` | 拍纸 | thump + 高频咔 |
| `tsquare` / `tsquare_off` | 丁字尺木滑 | 低通噪声 + 细颤 |
| `pen{d,v}` | 针管笔刮纸 | 2–6kHz 颗粒 |
| `letter{d,v}` | 写字 | 一串短笔画 |
| `hatch` | 排线 | 13 笔/s |
| `compass` | 圆规 | 笔 + 2.6kHz 吱 |
| `scratch` / `turn` | 划痕 / 转身 | pen / whoosh |
| `whoosh{d,v,pan}` | 呼啸 | 低通 2.5kHz |
| `section` | 剖面 | 轻刮 |
| `click` | 黄铜咔哒 | brass |
| `tick` | 擒纵 | tick |
| `bellows` | 风箱 | 低通呼吸 |
| `chain` | 链条 | 一串 brass |
| `swing` | 吊臂 | 吱呀 + whoosh |
| `gaugetwitch` / `gaugeping` | 指针 | brass / ding |
| `winddown` / `deflate` | 泄气 | ×1.35 减速 tick / 风箱衰减 |
| `room` | 房间底噪 | brown 低通 ×.02 |
| `puff` / `swell` | 纸噗 / 渐强 | paperpuff / bp 渐强 |
| `catch` | 接住 | 纸噗 + whoosh |
| `drop{v,pan}` | 水滴 | damped pat |
| `rainbed` | 雨底 | bp 1.5–7kHz |
| `grow` | 生长 | 轻 letter |
| `stampair` / `stamp` | 印章空气 / 落章 | whoosh / rubberstamp |
| `cap` | 笔帽 | 高频咔 + 2.4kHz |
| `vo{id}` | 人声 | 加载 `voices/<id>.wav` |

---

## 11. 构建链（复用机制）

```
sh styles/blueprint/demo/build.sh
  # 1. node core/render/still.mjs … --range 0:46:1.5 → sheet.py 逐段审
  # 2. core/tts/tts.py lines.json voices → asr_check.py（6/6 OK）
  # 3. node core/render/events.mjs → music/score.py → mix.py → tools/check_mix.py
  # 4. node core/render/video.mjs --fps 24 --workers 3（1120 帧）
  # 5. sh core/render/mux.sh out/video24.mp4 mix.wav blueprint.mp4 24 4
```

**关键机制**：`film.js` 里 `EV` 由 `ev()` 逐条 `push`，经 `core/render/events.mjs` 序列化成 `events.json`，同时喂给 `mix.py`（声音）与 `music/score.py`（配乐）；所以**换内容时配乐与拟音都会跟着新事件重排**（`DEMO.md:59-77`）。

---

## 12. 证据

```
styles/blueprint/STYLE.md:8-16       本质与不是什么
styles/blueprint/STYLE.md:18-27      材料与渲染（纸/线/线宽/缩放/虚线/消隐/剖面线/水/唯一真实物）
styles/blueprint/STYLE.md:29-34      颜色逻辑
styles/blueprint/STYLE.md:36-42      字体与字幕
styles/blueprint/STYLE.md:44-51      运动质量（ones/draw-on/制图顺序/爆炸/擒纵/演戏）
styles/blueprint/STYLE.md:53-69      镜头语法表 + 转场
styles/blueprint/STYLE.md:71-78      声音（乐器/foley/静默/mix）
styles/blueprint/STYLE.md:80-90      原生手法
styles/blueprint/STYLE.md:92-100     媒介陷阱
styles/blueprint/STYLE.md:106-114    变化空间
styles/blueprint/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/blueprint/DEMO.md:12          一整张纸 / 2D 语言 / 绝不 3D
styles/blueprint/DEMO.md:20-28       原生能力表
styles/blueprint/DEMO.md:32          情绪弧
styles/blueprint/DEMO.md:36-49       逐镜镜头表
styles/blueprint/DEMO.md:51-57       运动数值
styles/blueprint/DEMO.md:59-77       配乐结构 / foley / 叙述者 / mix
styles/blueprint/DEMO.md:79-98       调色与道具全部数值
styles/blueprint/DEMO.md:100-106     字幕是注释框 / GENERAL NOTES 栏
styles/blueprint/DEMO.md:108-110     片尾卡 = 标题栏最后一行
styles/blueprint/demo/film.js:12              BEAT=60/108
styles/blueprint/demo/film.js:14              DUR = B(22) = 46.667
styles/blueprint/demo/film.js:26-31           CAMS 分段（段间硬切）
styles/blueprint/demo/film.js:35-37           VO / SUBPOS / NOTETEXT
styles/blueprint/demo/film.js:39-41           subs() 时机
styles/blueprint/demo/film.js:42-63           图纸注释框字幕
styles/blueprint/demo/film.js:65-74           eighths / gearAt（7.5°/八分）
styles/blueprint/demo/film.js:85-115          EV 全部事件
styles/blueprint/demo/film.js:125             proj.k 斜二测 0→0.5
styles/blueprint/demo/film.js:167             活标注 n = … RPM
styles/blueprint/demo/film.js:170             (NO CLOUDS ON SHEET)
styles/blueprint/demo/film.js:255-310         修订云线 → 真云
styles/blueprint/demo/film.js:341-368         雨后主花逐笔画出
styles/blueprint/demo/draw.js:11              LW 四级线宽
styles/blueprint/demo/draw.js:13-14           zp = zoom^0.65
styles/blueprint/demo/draw.js:45              DASH
styles/blueprint/demo/draw.js:53-65           line() 按弧长 draw-on
styles/blueprint/demo/draw.js:72-92           solid() 斜二测挤出
styles/blueprint/demo/draw.js:99-114          hatch() 45° 剖面线
styles/blueprint/demo/draw.js:154-177         dim() 尺寸线
styles/blueprint/demo/draw.js:183-196         balloon() 零件号
styles/blueprint/demo/draw.js:198-207         nibs() / fxShadow / fxWet / fxUnshadow
styles/blueprint/demo/sheet.js:5              SW=3200 / SH=2200
styles/blueprint/demo/sheet.js:10-20          border() 图框
styles/blueprint/demo/sheet.js:21-28          header() 页眉
styles/blueprint/demo/sheet.js:31-60          titleBlock()
styles/blueprint/demo/sheet.js:61-80          PARTS 零件表
styles/blueprint/demo/sheet.js:87-101         notes() GENERAL NOTES
styles/blueprint/demo/sheet.js:104-122        cloudLobes()
styles/blueprint/demo/sheet.js:143-228        revCloud() 修订云线 → 云
styles/blueprint/demo/sheet.js:236-248        rain()
styles/blueprint/demo/sheet.js:250-268        handShadow()
styles/blueprint/demo/sheet.js:270-280        stamp() 橡皮章
styles/blueprint/demo/paper.js:18-46          paper() 着色器
styles/blueprint/demo/paper.js:66-83          湿 / 潮线 / 白线变软
styles/blueprint/demo/paper.js:88-93          红印章颗粒
styles/blueprint/demo/paper.js:94-104         纸卷甩开
styles/blueprint/demo/mix.py:17-22            pen() 2–6kHz
styles/blueprint/demo/mix.py:29-33            hatchs() 13 笔/s
styles/blueprint/demo/mix.py:56-59            brass() 共振
styles/blueprint/demo/mix.py:71-75            winddown() ×1.35
styles/blueprint/demo/mix.py:76-78            rubberstamp()
styles/blueprint/demo/mix.py:137-142          duck 0.36 + 0.25s 平滑
styles/blueprint/demo/mix.py:145              mix 电平
styles/blueprint/demo/music/score.py:1-4      108 BPM / G 大调 / 47.5s
styles/blueprint/demo/music/score.py:22-23    主题 16 个十六分音符
styles/blueprint/demo/music/score.py:50-54    终止 → 装配和弦
styles/blueprint/demo/machine.js:16-31        gearAngles / meshAngle / EXP / ORDER / EXSEQ
styles/blueprint/demo/main.js:107-108         window 页面契约
styles/blueprint/demo/lines.json:1-46         六行旁白原文
styles/blueprint/style.json:16-17             frame_sec 33.62 / dur 46.7
```
