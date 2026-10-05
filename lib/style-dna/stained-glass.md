# 彩色玻璃窗（stained-glass）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Dragon of the East Window》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「从昏暗石厅里看一扇中世纪花窗」的片子：**光就是时钟、就是镜头、就是故事**。彩色玻璃切块由暗铅条连成一张平面网络，脸和衣褶用棕色彩绘（grisaille）画在玻璃上；玻璃自己不发亮，只有太阳在它背后时才发光，并把一张柔和的彩色影子投到石板地上。人物一块块地动、僵硬而分级。

**它不是**：加黑描边的矢量插画、万花筒或 Voronoi 滤镜、蒂芙尼新艺术、马赛克（马赛克反射，玻璃透射）。
（`STYLE.md:14`）

---

## 1. 材料与渲染的硬规则

一条公式管所有东西（WebGL 合成器），所以每个元素都坐在同一束光里：

```
glass   = tonemap( backlight(x,y,time) × transmittance × glass texture ) + weathering haze × room light
surface = albedo × (room ambient + glow spilled from lit panes + point lights)          // stone, lead, iron
floor   = flagstones × (ambient + projected colour-patch map, blurred + halo)            // perspective or top-down
+ additive light shafts with dust · bloom (bright glass eats into the lead: the "irradiation" effect)
```
（`comp.js:1-5`、`STYLE.md:20-25`）

| 规则 | 具体值（实测/文档） |
|---|---|
| **保色阶的色调映射** | 逐通道 `1-exp(-x)` 会把钴蓝洗成粉彩；主体用亮度守恒式 `h·(1-exp(-l))/l`，只在最亮处混到逐通道式——太阳盘烧成白色而蓝色仍是宝石蓝（`comp.js:106-112`）。 |
| **未点亮 vs 点亮** | 未点亮：弱天光 + 被室内照亮的陈化薄雾，人物幽灵般但可读。点亮：背光 ~2–3×，一条柔和略斜的移动光带边缘（`bandW` ≈ 窗宽 + 10，柔化 24，斜切）（`story.js:34`、`DEMO.md:76`）。 |
| **切块** | Catmull-Rom 平滑切口（无深凹角）；`softPoly` 把采石格角稍磨圆。**每块都有质感**（clip 内 multiply）：按块角度的条纹、色相漂移 ±10%、靠近铅条的更深老化边、厚度 ±9%；着色器再加籽泡/划痕/厚度云；<0.6× 缩放时小特征淡出（`glass.js:21-25`、`glass.js:110-153`、`comp.js:22-37`）。 |
| **铅条** | 近黑 `#1d1f23`，一张平面网络，小切块更细，圆角接头，淡灰法兰边，焊锡球；只在颜色相交处出现（一色 = 一块）（`glass.js:11`、`glass.js:154-163`）。 |
| **Grisaille** | 半透明深棕的锥形描线（宽从中部峰值收到两端 0.25）、matting（点状晕染 + 渐变影 + 铅条内柔和带）、**刮出高光**（沿褶线用该块自己的颜色刮一道细线——透射光唯一允许的高光）。图案（锁甲/鳞/板甲）都是 grisaille 的弧与带（`glass.js:61-74`、`glass.js:132-149`）。 |
| **脸** | 杏仁眼、厚重上眼睑、大瞳孔、眉毛流进鼻子。**表情活在眉与嘴上**；改表情靠**换脸块**，绝不形变（`STYLE.md:32`）。 |
| **背景** | 手工切的**菱形采石格**（抖动格 + 共享顶点 + 每格一个彩绘母题）；边框 = 彩色带配珠饰 + 白色嵌线配连续藤蔓（`glass.js:168-197`）。 |
| **房间** | 暖灰琢石、更亮的窗侧斜壁、竖棂；地面是大块**不规则石板**，绝不与墙同一种错缝砌法（`comp.js:59-66`）。 |
| **地面投影** | 模糊、约 20% 去饱和、被石面调制、带光晕、镜像（窗口顶部落在房间最远处）。**光柱**：加色 + 尘，窗口处近 0，向下约 40% 处最强（`scene.js:38-57`、`scene.js:58-89`）。 |

**关键取向**：一色 = 一块玻璃；铅条只在颜色相交处出现，且是一张**平面**网络，不能读成描边（`STYLE.md:30`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位温柔、匀速的讲古人。第三人称、过去时为主（讲一个老故事），偶用现在时陈述规则。Kokoro `bf_alice`，speed 0.86–0.88，「像修女在讲一个老故事」（`DEMO.md:70`）。

**长度（实测）**：单句 **33–65 字符**（约 7–14 英文词）。最短 `So the knight laid down his sword.`（33 字符），最长 `Then, in the red of evening, he saw what the dragon was guarding.`（65 字符）。硬规则：字幕停留 ≥ `max(1.8s, 语音时长 + 0.6s)`，且不得撞上下一行（`story.js:25`）。字幕是一条羊皮纸**横幅（banderole）**放底部（卷曲两端、轻微下垂、细边线），IM Fell English 44px，从**中心展开**；文字只在展开到 ≥75% 后才淡入（`subs.js:3-27`）。

**句首类型**（示例性，不是抄原文）：
- 以「这扇窗」为主语陈述规则：`This window only tells its story where the sun falls.`
- 以时间/光线状语起句：`At dawn, …` / `He crossed the hills and rivers in the white noon light.`
- 以「然后 / 于是」推进：`Then, in the red of evening, …` / `So the knight laid down his sword.`
- 用名词短语点出被守护之物：`The last ember of the sun, kept warm until morning.`
- 结尾用「从那天起」的时间跨度收束：`And every night since, …`

**这个风格里不会出现的句式**：
- 第一人称抒情与内心独白（靠光、换脸块和裂缝承载情节）
- 网络口播腔、感叹号堆叠、营销话术
- 现代口语/俚语（语域必须是讲古人的书面语）
- 一句塞两个以上并列信息点

---

## 3. 叙事节奏

**信息投放顺序**：

```
开场黑暗里一条刀锋般的黎明细光从上到下点亮第一格
  → 拉远到整扇窗（一帧教会「只有被照到的窗格才是活的」）
  → 推近第一格（角色在拍点上一个个摆姿势）
  → 光带向右滑，前一格定格
  → 正午 → 下午
  → 战斗在地面光斑里演（俯拍石板）
  → 回到窗上，红光落在末格
  → 一击（两帧定格）→ 窗格裂开
  → 静止（尘埃在红光里落）
  → 揭示（翼片沿铅条滑开，露出琥珀余烬）→ 换脸块（惊愕）
  → 重新上铅条（成组纸片按拍滑入跪姿，每拍一个焊接火花）
  → 最后一焊 = 一记钟
  → 夜（所有窗格转灰蓝，只有末格从内部暖亮）
  → 结尾卡刻在石带上
```

**时间挂在 80 BPM 网格上**：1 拍 = 0.75s，1 小节 = 3.0s；时刻按实测语音长度设定（`DEMO.md:28`）。

| 层 | 停留规则 |
|---|---|
| **人物** | 以 **8 fps 分级步进**（`story.js:10-11`） |
| **光/镜头/光柱/尘** | 24 fps 移动（`STYLE.md:52`） |
| **冻结规则** | 一格里的角色用 `min(t, t_lightLeft)`，光离开即定格（`story.js:53`） |
| **裂缝** | 9 条锯齿线在 ~0.28s 内冲出，亮着光，0.45s 白闪 + 2 帧抖动（`story.js:79-89`、`story.js:96-105`、`story.js:203`） |
| **重新上铅条** | `WELDS = [41.75, 42.5, 43.25, 44.0, 44.6]`，成组纸片每拍滑一次，每次以焊接火花收尾（`story.js:90`、`story.js:115-130`） |
| **字幕** | ≥ `max(1.8s, 语音时长 + 0.6s)`，避让下一行（`story.js:25`） |

**总时长**：主 demo 56.5s（`story.js:8`；`style.json` dur=56.5，frame_sec=40.68）。demo 原计划 45s，因 L6 挪到 38.3s 避让 L5 的阅读时间而涨到 56.5s（`DEMO.md:113`）。

**静默怎么用**：静默是**硬切**，连混响尾巴都切掉，只留玻璃自身的余音或铅条吱呀；一记长混响的钟可以把它收掉（`STYLE.md:84`）。demo 在 31.8s 一击后所有音乐硬切（`DEMO.md:63`）；`mix.py` 把 31.8–33.6s 的房间底噪压到 0.45 倍（`mix.py:107`）。

---

## 4. 镜头逻辑

**镜头是什么**：一束沿窗移动的光——镜头跟着太阳的光带走，**被照到的窗格才是「现在」**，没被照到的定格在过去；它把画面从玻璃带到地面（光斑），再带回来。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 随光带横向平移 | 时间流逝、故事向前 | 一串步骤；一天；章节 |
| 锁死一格窗的近景 | 这一格就是「现在」 | 被读出的一行；一个决定；一个细节 |
| 拉远到整扇窗 | 规则，或整段故事一次给出 | 学会系统；一个总结；余波 |
| 沿光柱下摇到地面，再俯拍 | 画面离开玻璃、变成光 | 装不进窗格的事件；一个梦；一段记忆 |
| 在裂缝中保持不切 | 事件就是介质本身在破裂 | 一个转折点；一次失去；一次揭示 |
| 缓慢推向一个小光源 | 注意力收窄到一个源 | 一次发现；一个秘密；希望 |
| 上摇到玫瑰窗或窗花格 | 窗格之上有东西在管着它们 | 一个钟；一个周期；一个总览 |
| 在两格之间拉焦（一亮一暗） | 过去与现在并置 | 前后对比；两条人生；因果 |
| 沿斜壁低角度掠射玻璃 | 窗作为建筑、尺度 | 敬畏；一个机构；一段长历史 |
| 在新光下回到早先的构图 | 韵脚让人看见变化 | 成长；入夜；修复 |

**允许的转场**（必须来自光与介质本身）：移动的光、光柱、一道裂缝、黑暗。

**禁止**：溶解、划像、翻页等 UI 式转场；任何元素的淡入（东西是**被点亮**出现的）；无来由的运镜；让玻璃弯折或形变（改表情只能换脸块）。

---

## 5. 表达习惯（idioms）

1. **光就是时间，也是镜头**：只有被照亮的窗格是活的，光一走人物就定格。
2. **玻璃把画面投到石头上**：关键戏在地面光斑里演，太阳下沉时光斑越拉越长。
3. **玻璃裂开、铅条修补**：成组纸片沿铅条滑成一张新画，留下疤痕。
4. **一扇窗自己有光**：夜里某一格从故事内部的某个源亮着。
5. **窗作为图表**：竖棂是柱、玫瑰窗是轮或表盘、边框是时间轴。
6. **换脸块而非形变**：表情靠替换整块脸玻璃实现。
7. **刮出的高光**：每条褶线旁用该块自己的颜色刮一道细线——透射光唯一允许的高光。
8. **开场伤口 = 收尾接缝**：开场刀锋般的黎明细光与结尾卡上那道细蓝晨光弹同一个玻璃音（`DEMO.md:22`）。

---

## 6. 氛围

一座昏暗的石厅、一扇厚重的斜壁窗：暖灰琢石、冷玻璃、光柱里的尘；一天的光从蓝白黎明走到金下午再到深橙黄昏，夜里只剩一格暖光。整体是**古老、庄严、被光驱动**的气质，而不是恐怖或说教（世俗题材：没有十字架、圣徒、光环）。

---

## 7. 声音

- **乐器**：管风琴（踏板持续音、柔音栓、全奏）、竖琴、手铃、管钟、竖笛或一条类圣咏的人声、水杯音、定音鼓；也可用轮擦提琴持续音、萨尔特里琴、便携式管风琴。**不要**通用钢琴或弦乐（`STYLE.md:80`）。
- **调式族**：教会调式（多利亚、混合利底亚、爱奥利亚、利底亚）、空五度、持续音、平行奥尔加农。demo 用 **D 多利亚**（升六级 B♮ 给色彩）、80 BPM；水杯音 = 「那道光」（`DEMO.md:54`）。
- **动作声（材料优先，全部可合成）**：敲击玻璃 = 非谐分音 `~1 : 2.32 : 4.25 : 6.63 : 9.38`；裂缝 = 爆裂 + 窗板闷响 + 26 记叮当雨；铅条 = 粘滑吱呀；玻璃在铅槽里滑动 = 砂质带噪 + 微弱尖叫；焊锡 = 嘶声 + 滴答；空气推动光；石厅环境；拱顶鸽子；铁冷却时的滴答（`mix.py:22-76`、`STYLE.md:83`）。
- **混音规则**：大而混响（石厅 IR 2.6s、房间 IR 1.1s，拟音 38% 湿、人声 12% 湿）；重击避开词首；音乐在人声下 duck ≈ −9 dB（demo 实际 `1 − 0.72·env`）；整体 −14 LUFS（`mix.py:13-19`、`mix.py:117-130`）。人声：温柔匀速的讲古人，少数几句短话。

---

## 8. 变化空间（可自由发挥）

窗的形制（竖棂、玫瑰窗、圆章、高侧窗）、题材、光序、开场、结尾、镜头路径与节奏。所有方向都必须远离 demo 的《The Dragon of the East Window》：

- **结构**：**玫瑰窗当表盘**（花瓣像钟点依次点亮，中心是答案）；**一格高竖棂从下往上读**（沿一段人生或一个流程上摇，一个圆章一件事）；**两扇相对的窗**（上午太阳照亮一边、傍晚照亮另一边，两窗之间的地板承载它们的相遇）。
- **开场**：**先给地板**（石上只有一块彩色光斑，上摇去找来源）；**夜里从外面看一扇亮窗**（人影走过发光窗格，然后我们进到里面）；**玻璃匠的工作台**（切一块、上一条铅，它成为整幅画的第一块）。
- **结尾**：**云遮住太阳**（所有窗格同时转灰，只剩一行字停留）；**新铅条补进一格**（空竖棂被最后一幕填满）；**镜头从门离开**（窗在后面变小，光斑还留在地上）。

同时可换：主导色（两种色承载画面，其余只作小点缀）、太阳的颜色序列、人物与题材（世俗）。★ 但「光即时间 + 人物 8fps 分级 + 裂开/上铅条」这三条骨架不能拆（`STYLE.md:111-117`、`STYLE.md:91-95`）。

---

## 9. 禁忌清单

- 带黑描边的矢量插画。
- 万花筒或 Voronoi 滤镜（Voronoi 读起来像滤镜、平涂读起来像剪贴画）。
- 蒂芙尼新艺术（Tiffany Art Nouveau）。
- 马赛克（马赛克反射，玻璃透射）。
- 十字架、圣徒、光环等宗教图像（世俗：借工艺，不借题材）。
- 溶解、划像、翻页等 UI 式转场。
- 让玻璃弯折或形变（改表情只能换脸块）。
- 照抄任何真实花窗的题材、构图、人物或音乐。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

| 要素 | 说明 |
|---|---|
| 旁白行（`lines.json`） | 每条 `{id, text, voice, speed, asr?}`；demo 8 行 bf_alice 0.86–0.88；`asr` 存 whisper 的预期转写以避开同音误判（"knight"→"night"） |
| 时间线（`story.js`） | `DUR/LINES/SUBS/light()/lancetI..IV/camera()/WELDS/emberLit()/EV/state()` |
| 色板（`glass.js` 的 `COL`） | cobalt/deepblue/ruby/gold/green/olive/purple/flesh/white/sky/brown/amber/steel… |
| 太阳颜色 × 强度 | `story.js:28` 的 DAWN/NOON/AFT/DUSK/VIOLET/MOON |
| 窗与场景（`window.js`） | `LX/LW/ROSE/APEX/BOT/FLOOR` |
| 事件数组 | `EV`（`story.js:173-184`） |

### 10.2 新画面元素的契约

用 `glass.js` 的 `Pass` 画：一个 `Pass(g, s, mode)` 把同一份几何同时画进玻璃画布（透射色）与表面画布（铅、铁、石）。
- 切块：`smooth(pts, closed, k)`（Catmull-Rom，点带第三分量 1 = 硬角）或 `softPoly(pts, r)`。
- `pass.piece(path, color, {id, vary, body, edge, paint, mat, wash, shade, lead, erase})` 画一块玻璃（自动做保色变体、条纹 multiply、色相漂移、老化边、matting、点状 wash、`paint` 回调里用 `g.__col` 刮高光）。
- `pass.lead(path, w)` 上铅条、`pass.solder(x,y,r)` 焊锡球、`pass.surf(path, fill)` 画石/铁。
- 笔触：`brush(ctx, pts, w, {w0,w1})` 锥形描线；采石格：`voronoi(seeds, box)` + `seedsIn(box, n, rnd)`。
- 刚性骨架参考 `knight.js`（`POSE/lerpPose/fk`）与 `dragon.js`（`DPOSE/lerpD/spine`，脊链分背/腹带）。

### 10.3 时间线契约

`story.js` 是唯一时间真值：导出 `DUR`、`LINES`、`SUBS`、`light(t)`（太阳位置/颜色/强度/光带宽度/斜切）、`lancetI..IV(t)`（每格内容）、`camera(t)`、`WELDS`、`emberLit(t)`、`EV`（按时间排序）、`state(t)`（合成一个完整帧状态，含 `cam/floorMode/floor/topCam/sweep/inscription/pts`）。`scene.js` 的 `renderScene(Lc, L, comp, st)` 把状态画成 5 张画布（G 玻璃 / S 表面 / R 光柱 / P 投影图 / O 覆盖层），交给 `comp.js` 的 WebGL2 合成器。页面契约（`main.js`）：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 |
|---|---|
| `beam` | 开场黎明细光 |
| `title` | 标题扫光 |
| `tink` | 敲玻璃 |
| `move` | 光带移动的呼啸 |
| `step` | 角色步进 |
| `wings` | 鸽翅 / 翼 |
| `clash` | 剑盾相击 |
| `creak` | 铅条吱呀 |
| `crack` | 裂缝 |
| `grind` | 玻璃在铅槽里磨 |
| `ignite` | 余烬点燃 |
| `slide` | 纸片沿铅条滑动 |
| `weld` | 焊接火花 |
| `bell` | 最后一焊的钟 |
| `dusk` / `dawnwink` | 入夜 / 结尾那道晨光 |
| `voice{id}` | 人声（mix.py 从 voices/<id>.wav 读） |
| `sub{t1,text}` | 字幕条 |
| `endcard` | 结尾卡 |

全部由 `story.js:173-184` 的 `EV.push` 产生，`tools/events.mjs` 序列化成 events.json。

---

## 11. 构建链（复用机制）

```
styles/stained-glass/demo/
  glass.js   切块、质感、铅条、grisaille 笔触、采石格      comp.js   WebGL2 合成器（玻璃/石/地面/光柱/bloom）
  knight.js  玻璃骑士骨架 + 姿势 + 脸块                     dragon.js 翼龙骨架（脊带、头、折叠/展开翼、余烬）
  window.js  竖棂、玫瑰窗、边框、场景、石墙、刻字            scene.js  相机、地面投影、光柱、尘 → 合成器
  story.js   时间线：光、镜头、窗格状态、裂缝、重新上铅条、事件、字幕
  subs.js    横幅字幕     test.js 模型页（?test=sheet|knight|dragon）   frames.js 风格帧（?frame=...）
  lines.json 旁白   music/score.py 原创配乐   mix.py 拟音 + 混音   subs_export.py → .srt   build.sh 一键重建
```

1. `node core/render/still.mjs styles/stained-glass/demo 36 --q nosub=1` — 审片（`?test=sheet` 看模型页）。
2. `core/tts/tts.py lines.json voices` → `asr_check.py`。
3. `node core/render/events.mjs` → `music/score.py` → `mix.py` → `subs_export.py`。
4. `node core/render/video.mjs styles/stained-glass/demo --fps 24 --workers 3`（1356 帧，约 3–4 分钟；Canvas2D 矢量玻璃 + WebGL 合成器）。
5. `CRF=22 sh demo/tools/mux.sh out/video24.mp4 mix.wav stained-glass.mp4 24 4`（grain 4）。或直接 `sh styles/stained-glass/demo/build.sh`。

（`DEMO.md:91-107`）

---

## 12. 证据

```
styles/stained-glass/STYLE.md:6-14         本质 + 不是什么
styles/stained-glass/STYLE.md:16-25        一条公式管所有元素
styles/stained-glass/STYLE.md:27-35        材料与渲染（色调映射/点亮/切块质感/铅条/grisaille/脸/采石格/房间/投影）
styles/stained-glass/STYLE.md:37-43        颜色逻辑
styles/stained-glass/STYLE.md:45-48        字体与字幕（banderole）
styles/stained-glass/STYLE.md:50-57        运动质量（8fps/24fps/冻结/裂缝/上铅条）
styles/stained-glass/STYLE.md:59-76        镜头语法 + 构图 + 转场
styles/stained-glass/STYLE.md:78-85        声音
styles/stained-glass/STYLE.md:87-95        五个 native moves
styles/stained-glass/STYLE.md:97-105       媒介陷阱
styles/stained-glass/STYLE.md:111-117      变化空间
styles/stained-glass/DEMO.md:3             不要复用故事/弧线/镜头/道具/时长
styles/stained-glass/DEMO.md:5-6           demo 56.5s
styles/stained-glass/DEMO.md:8-24          故事结构 + 光序 + native moves 落点与韵脚
styles/stained-glass/DEMO.md:26-48         逐镜表 S1–S15 + 80 BPM
styles/stained-glass/DEMO.md:52-70         配乐（D 多利亚/乐器/逐 cue/硬切/duck）
styles/stained-glass/DEMO.md:72-81         调色板与道具
styles/stained-glass/demo/story.js:8             DUR = 56.5
styles/stained-glass/demo/story.js:10-11         人物 8fps 分级步进
styles/stained-glass/demo/story.js:15-25         LINES + SUBS 停留规则
styles/stained-glass/demo/story.js:28-48         light() 太阳/颜色/强度/光带
styles/stained-glass/demo/story.js:79-89         CRACKS 9 条裂缝
styles/stained-glass/demo/story.js:90            WELDS
styles/stained-glass/demo/story.js:96-105        裂缝长出与修补
styles/stained-glass/demo/story.js:115-130       重新上铅条
styles/stained-glass/demo/story.js:134           emberLit
styles/stained-glass/demo/story.js:157-170       camera()
styles/stained-glass/demo/story.js:173-184       EV 全部 type
styles/stained-glass/demo/story.js:186-213       state()
styles/stained-glass/demo/glass.js:6-13          COL + LEAD/INK/MAT
styles/stained-glass/demo/glass.js:21-25         vary ±9%
styles/stained-glass/demo/glass.js:28-42         smooth Catmull-Rom 切口
styles/stained-glass/demo/glass.js:61-74         brush 锥形描线
styles/stained-glass/demo/glass.js:110-153       Pass.piece 质感与彩绘
styles/stained-glass/demo/glass.js:154-163       lead + solder
styles/stained-glass/demo/glass.js:168-197       voronoi 采石格
styles/stained-glass/demo/glass.js:199-208       softPoly
styles/stained-glass/demo/comp.js:8-105          MAIN 着色器
styles/stained-glass/demo/comp.js:106-112        TONE 保色阶色调映射
styles/stained-glass/demo/comp.js:121-138        COMP bloom/暗角/抖动
styles/stained-glass/demo/comp.js:157-191        WebGL2 渲染管线
styles/stained-glass/demo/scene.js:11-14         lancetLit
styles/stained-glass/demo/scene.js:38-57         地面投影色斑图
styles/stained-glass/demo/scene.js:58-89         光柱 + 尘粒
styles/stained-glass/demo/subs.js:3-27           banderole
styles/stained-glass/demo/mix.py:22-28           glass_tink 非谐分音
styles/stained-glass/demo/mix.py:29-37           glass_crack
styles/stained-glass/demo/mix.py:38-49           lead_creak / grind
styles/stained-glass/demo/mix.py:103-111         石厅环境/鸽子/余烬/压底噪
styles/stained-glass/demo/mix.py:117-130         配乐 stem + duck + 限幅
styles/stained-glass/demo/lines.json:1-52        8 行旁白实测
styles/stained-glass/style.json:16-17            frame_sec 40.68 / dur 56.5
```
