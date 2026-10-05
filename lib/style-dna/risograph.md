# 孔版印刷（risograph）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Sunday Ride》的具体剧情。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部看起来是**一张一张印在孔版印刷机上**的动画：两三块半透明专色，叠印在暖白纸上，网点、墨粒、以及永远对不齐的版。孔版机一次只印一个颜色——每个颜色是一块自己的模板（版）、自己的滚筒、自己的半透明油墨；这一条事实就决定了全部外观。

**它不是**：加了噪点滤镜的平面矢量画（每个颜色都必须来自版）；CMYK 波普半调（没有印刷色、没有 keyline）；丝网印刷海报（Riso 墨是半透明带颗粒的，不是不透明的）。
（`STYLE.md:6-16`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **分版画布** | 每帧画进一张 RGB 画布，**每个通道 = 一块版的浓度**（R=墨 1、G=墨 2、B=墨 3；0=不上墨、1=实地）。普通 `source-over` = 挖空；`over()` 里用 `'lighter'` = 只往指定通道加墨 = 叠印（`draw.js:1-2,32`）。 |
| **印刷 shader** | WebGL2：每版独立位移（px）+ 微旋转 → 套色错位；余弦网点函数铺旋转网格，1080p 周期约 6–8px；密度 ≥ ~0.9 印实地；网角相差 ≥ 15°（默认 15°/0°/75°）（`riso.js:17-39,85-86,135,141`）。 |
| **墨粒** | 静态部分跟纸走（每镜头一张纸），沸腾部分每「印一张」变一次、幅度小（uBoil 默认 0.35）；实地里有漏白点；墨色不均是**走纸方向条纹 + 大块浓淡 + 每张纸整体浓度**（`riso.js:88-101,140`）。 |
| **合成** | 纸白底上各版 multiply：`col *= mix(vec3(1.), uInk[i], c)`；纸带纤维（`riso.js:73-74,104`）。 |
| **网点锚在纸** | 网点锚在屏幕（纸）上，不锚物体：横移时图像在固定网屏下滑动，像每帧重印一次（`riso.js:77`）。 |
| **上版 / 刷墨** | 每版有 gate（是否上机）与 sweep（滚筒刷墨揭示，推进边缘一道偏浓墨带），让一块版在镜头中途到场（`riso.js:81-83,142-143`）。 |
| **纸白挖空描边** | 角色先画到透明层，再用 `brightness(0)` 沿一圈偏移盖 12 次（零墨 = 纸白）压出 halo（4–5px），最后盖图层；版在它周围错位 → 边缘沾彩色毛边（`draw.js:11-22`）。 |
| **字体也是印的** | 标题/字幕活在一块版上，跟着错位与带墨粒；标题可印两块版留可见偏移（Riso 双印）。Bricolage Grotesque 800 + Jost 500–700，READY 前预载（`main.js:10`；`STYLE.md:47-48`）。 |
| **构图** | 每区域**最多两块版、最多一块作淡色**；大块平涂 + 大量实地纸与实地墨；半调只用在分级带（20/40/60/100%）；一条地平线、一块大平场或圆盘、一个小人（`STYLE.md:29-34`）。 |
| **为单版负责** | 每个主色都含一点第一块版 → 单色帧仍读成完整剪影；刻意的例外是纸白留到它那块版到场才填上（一个揭示）（`STYLE.md:34`）。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一个冷静、观察式、略带温柔诗意的第三人称讲述者。

**长度（实测）**：字幕是**纸白挖空条上的一行**，单句约 **30–60 字符（约 6–12 个英文词）**，最多一行、绝不折行（挖空条宽 = 文字实测 +64px）；中文 14–30 字。停留 ≥ `max(1.8s, 语音 + 0.6s)`，并被下一句起点截断（`film.js:29-33,306-315`）。

**句首类型**（示例性，不是抄原文）：
- 时间/天气起句：`Sunday morning. The whole city is still blue.`
- 转折推进：`Then the bakery opens, and the day gets its first color.`
- 补充式发现：`The park adds pink. And, apparently, a passenger.`
- 总结式收束：`By the river, every color overlaps.`
- 回环收尾：`Same ride every Sunday. Never quite the same print.`

**这个风格里不会出现的句式**：
- 把颜色、版数、印刷术语写进字幕（颜色靠画面说，不靠旁白解释）。
- 营销腔、感叹号堆叠、网络口播腔。
- 一句里塞两个以上信息点或两个并列从句。
- 照抄任何真实 Riso 插画师的角色、构图或配色名。

---

## 3. 叙事节奏

**信息投放顺序**（一次「日常巡游」，版 = 叙事）：

```
bell 0–2（开场特写：铃）
  → street 2–8（世界是蓝的；片名只印在蓝版上，2.0 刷出、5.5 撤下）
  → bakery 8–16（黄版到场 = 一天有了第一个颜色）
  → park 16–19（静止大全景，人小景大）
  → pigeons 19–21.5（鸽群起飞：叠印混色出现）
  → passenger 21.5–24（乘客落座）
  → sun 24–26（粉色圆长大吞没画面，再缩回成河上的太阳）
  → stop 26–29（河边停下）
  → share 29–32（面包撕开，与鸽子分享）
  → pull 32–36（拉远揭示：这其实是一张印出来的纸）
  → end 36–40（片尾卡，片名三版分别印、各自错位）
（demo/film.js:9-12,82-87,276-291）
```

**时间挂在 120 BPM、1 小节 = 2s 上**（所有时间对齐 0.5s 拍点）：

| 层 | 规则 |
|---|---|
| 角色 | **按二拍（on twos，12fps）表演**（`step(t) = floor(t*12)/12`） |
| 相机 | **按一拍（24fps）运动**——步进相机读起来会抖 |
| 输出 | 24fps |
| 套色跳点 | KICKS：2/5.5/8/12/16/20/24/30/31/36/38 秒（幅度 4–14px） |

**总时长**：demo **40s**；短片通常 30–90s，由镜头数决定。

**静默怎么用**：静默 = 一小节，**混响尾巴被切掉**，最多留环境声或一个远处的声音；它和一次**套色漂移**配对（三块版慢慢漂开），28.0 的「咔」套准把一切带回来（`film.js:45-50`；`STYLE.md:82`）。

---

## 4. 镜头逻辑

**镜头是什么**：一台**印刷机的眼光**——平、稳、构图讲究，大量留白与实地；运动简单，能量来自叠印、套色跳点与滚筒刷墨。

**词汇表**：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 宽幅横移、小人、空天 | 旅行、日常、空间 | 通勤；一条流水线；一个标题 |
| 静止大全景、主体横穿画面 | 尺度的喜剧（塔蒂式） | 一个笑点；一次抵达；一群人 |
| 锁定构图（地平线、圆盘、小人） | 静止、敬畏 | 一个决定；一次揭示；全片唯一的一次停顿 |
| 地面低机位、前景大形状 | 能量、丰盛 | 一次爆发；一次收获；一次上线 |
| 中景双人、停住看 | 反应 | 一个笑点落地；一笔交易；一次争执 |
| 正上方俯拍、长影 | 图案、地图 | 一份日程；一张平面图；一个棋盘 |
| 推入半调场直到网点变成形状 | 进入这张印刷品 | 细看一组数据；一段记忆；一个细胞 |
| 拉远揭示纸张 | 原来是一张纸 | 一个系列；一份档案；一次总结 |
| 用一块平形状做匹配剪辑 | 靠形延续 | 一次时间跳跃；因果；前后 |

**允许的转场**：叠印生长；滚筒刷墨；形状匹配剪辑；按拍硬切。

**禁止**：交叉溶解、柔和的数字擦除；每帧抖动套色；把满彩场景事后叠噪点当印刷质感；CMYK 波普网点、实心不透明墨、keyline 描边。

---

## 5. 表达习惯（idioms）

1. **版 = 叙事**：世界在每个转折点获得一块新墨。
2. **两墨一第三色**：两块版只在交叠处生出第三种颜色。
3. **叠印转场**：一块墨的形状长过画面，再缩成下一场的关键形状。
4. **套色即节奏与情绪**：重音上「跳一下」，停住的时刻慢慢「漂开」，强拍上「咔」地对齐。
5. **倒影 = 分离的版**：每块版按自己的相位摆动（`riso.js:53-66`）。
6. **挖空揭示**：一个只由「缺失的墨」构成的形状，它那块版稍后才到场。
7. **半调尺度**：推近时网点长大成形状。
8. **它是一张纸**：印品可被叠、折、裁、钉；墨粒像翻页动画一样沸腾。
9. **分层像分版**：每块新版带来一件乐器，也可以一件件离开（`STYLE.md:80`）。
10. **套色不每帧抖**：每镜头一套固定偏移（±1–3px），只在重音上跳、在停顿时漂（`film.js:36-52`）。

---

## 6. 氛围

一间安静的印刷工作室 / 周日清晨的城：纸的暖白、墨的半透明、滚筒的油味；画面里大量留白，小人很小，天很大。整体是**手工、耐心、可复制又每张不同**的气质。

---

## 7. 声音

- **乐器**：温暖、干燥、手工、略 lo-fi——立式或电贝斯、颤音琴或马林巴、尼龙吉他、口哨或哼唱旋律、Rhodes、玩具钢琴、刷子鼓组、沙锤与 rim clave、经磁带饱和的小鼓机；**分层像分版**，每块新版带来一件乐器（`STYLE.md:79-80`）。
- **拟音（机器是标志）**：进纸「唰」+ 滚筒「咔嚓—咚」（在版到场时响，按版左右摆 pan）、马达嗡、纸落到纸堆、裁刀切纸；其他拟音干燥、贴近、带纸感（`mix.py:23-25,81-87,114`）。
- **混音规则**：干燥、贴近；音乐在人声下闪避约 **−8 dB**；两遍 loudnorm 到 **−14 LUFS / TP −1.2**；成片 mux **不加颗粒**（颗粒在印里），视频用 crf 15 + `-tune grain`，且必须用 **PNG 帧进 yuv444 无损中间片**（JPEG 4:2:0 会吃掉粉/蓝网点）。旁白放松、口语、短句（`mix.py:145`；`tools/mux.sh:2,7-10`；`tools/video_png.mjs:1,15-16`）。

---

## 8. 变化空间（可自由发挥）

你要决定：用哪几块墨、每块版代表什么、结构、角色（或没有角色）、开场、结尾、镜头路径与节奏。全部远离 demo。

- **结构**：**两墨对话**（两个主体交替出镜、只在最后交叠，生出第三种颜色）；**减法**（从满叠印开始，每次失去就少一块版，最后只剩一块墨）；**一本 zine**（每个镜头翻一页，每页一种两块版配对）。
- **开场**：**一个挖空**（满彩场里一个空白形状，几秒后被它那块版填上）；**先看网点**（半调极端特写，拉远成一张图）；**鬼影汇聚**（三块彩色鬼影漂到一起，在第一拍上「咔」地对齐）。
- **结尾**：**只剩一块墨**（版一块块揭走，最后一行字站在一种颜色里）；**印品贴在墙上**（最后一帧变成一张海报，贴回它自己展示过的世界）；**一张折起来的纸**（折成故事需要的东西：船、信封、车票）。
- **色板**：Teal + 荧光橙；Federal Blue + Red + Sunflower；但都必须**自选墨色**，绝不借用真实 Riso 品牌色名或任何插画师的配色。
- **可换不可换**：墨数、结构、角色都可换；但**分版浓度画布（通道=版）、叠印相乘混色、套色错位 + 网点**三件不能换，换掉任何一件就不再是这个风格。

---

## 9. 禁忌清单

- 一块区域叠三块半调版 = 一团泥（必须两块版、一块作淡色）。
- 用 `fract(p*vec2(233.34,851.73))` 这类哈希（1080p 下会在实地上画出竖条纹）。
- 每帧抖动套色 + 纸张噪点（会闪、会撑爆体积）。
- 用 JPEG（4:2:0）截图（会抹掉饱和网点）。
- 挖空描边层忘了复制画布变换（缩放镜头会把主体画错尺度）。
- 在透明图层里用叠加式 `over()`（叠印必须在分版画布上做）。
- 主色里不含第一块版（单色帧里会飘着）。
- 用 `evenodd` 填拱形（会填实；要反向描内缘）。
- 在成片阶段加颗粒（颗粒在印里）。
- 显示 Riso 品牌、logo 或机器外观；把油墨名当作品牌名。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `ink(b,y,p)` | fn | 三版浓度 → 颜色字符串（0..1） |
| `over(fn)` | fn | 只加墨不挖空（叠印） |
| `layer(fn, halo)` | fn | 角色纸白挖空描边 |
| `S.mask` | `[3]` | 全局版遮罩（设定表逐版演示） |
| 颜色 | `[b,y,p]` | 三版浓度数组（`draw.js:1-2,24-32`） |
| 印刷参数 | object | `{seed, sheet, off, rot, period, grain, gate, sweep, water, inks, paper, boil}`（`riso.js:126-153`；`film.js:326-331`） |
| `SHOTS` | `[name,t0,t1][]` | 镜头表（`film.js:9-12`） |
| `EV` | object[] | 声音事件（`film.js:16-25`） |
| `KICKS` | `[秒,幅度][]` | 套色跳点（`film.js:13-14`） |

### 10.2 新画面主体的契约

新增一个主体 = 用分版浓度画（普通绘制挖空、`over()` 叠印）；角色必须包在 `layer(fn, halo)` 里以获得纸白描边。
新增一块版 = 在 `INK` 里给一个专色 + 在 shader 里占一个通道（R/G/B）+ 给它一个网角。
一套骨骼用 2 骨 IK 出所有姿势（`draw.js:60-83`；`riso.js:7-12`）。
新增一个镜头 = 在 `SHOTS` 加一行并在 `SHOT` 对象里加一个绘制函数（`film.js:9-12,69-292`）。

### 10.3 时间线契约

- 页面契约：`window.render(t)` / `window.DUR` / `window.EV` / `window.SUBS` / `window.READY`（`main.js:14-15,56`）。
- `film.js` 是唯一时间真相：`DUR`/`SHOTS`/`EV`/`KICKS`/`plates(t)` 都从它导出；字幕区间由 `setLines` 与 `tools/subs.py` 用**同一规则**算出（`film.js:8-33`；`tools/subs.py:8`）。
- 字幕区间：`t1 = min(下一句起点 − 0.05, max(t + 语音时长 + 0.7, t + 1.8), 36)`。

### 10.4 事件词汇（`EV` → `mix.py`）

| type | 含义 |
|---|---|
| `drum{plate}` | 版到场：进纸「唰」+ 滚筒「咔嚓—咚」（按版摆 pan） |
| `bell{n,gain}` | 车铃 |
| `titlehit` | 片名印上 |
| `doorchime` / `church` | 门铃 / 教堂钟 |
| `catch` / `snap` / `crunch` | 接住 / 掰断 / 咀嚼 |
| `flock` / `flap` / `land` / `coo` / `peck` | 鸽群 / 振翅 / 落地 / 咕咕 / 啄 |
| `whoosh` / `brake` | 掠过 / 刹车 |
| `paperout` / `paperland` | 出纸 / 纸落堆 |
| `amb{kind,t1}` | 环境床（street/bakery/park/river） |
| `ride{t1,v}` | 车轮区间 |
| `vo{id}` | 人声 |

---

## 11. 构建链（复用机制）

```
sh styles/risograph/demo/build.sh
  # 1. lines.json / voices/dur.json → film.js 的 setLines → subs.py → out/subs.json
  # 2. film.js 的 EV → mix.py（拟音 + 配乐 + duck −8dB）→ mix.wav
  # 3. tools/video_png.mjs（PNG 帧 → yuv444 无损中间片）→ tools/mux.sh（crf 15 -tune grain + loudnorm −14 LUFS）→ 成片
```

**关键机制**：`film.js` 是唯一真值——画面、字幕、拟音、配乐 cue 全从它导出；改时间只改一处。`sheet.js?sheet=1` 用同一套分版引擎印出角色设定表（连设定表也是三版印出来的）（`sheet.js:1`）。

---

## 12. 证据

```
styles/risograph/STYLE.md:3-4           一句话本质 + 参考只借语法
styles/risograph/STYLE.md:6-16          本质五条 + 不是什么（非矢量加噪/非 CMYK/非丝网）
styles/risograph/STYLE.md:18-34         材料与渲染（分版画布/印刷 shader/网点锚纸/上版刷墨/挖空描边/构图/单版负责）
styles/risograph/STYLE.md:36-43         颜色逻辑（2–3 专色/叠印/纸白也是颜色/示例墨组）
styles/risograph/STYLE.md:45-50         字体与字幕（活在一块版上/纸白挖空条/印品不淡出）
styles/risograph/STYLE.md:52-57         运动质量（角色 on twos/相机 on ones/固定偏移+跳+漂/墨粒沸腾）
styles/risograph/STYLE.md:59-75         镜头语法表 + 转场 + 禁止溶解
styles/risograph/STYLE.md:77-83         声音（乐器/机器拟音/静音配对漂移/−14 LUFS 不加颗粒）
styles/risograph/STYLE.md:85-96         原生动作八条
styles/risograph/STYLE.md:98-107        媒介陷阱
styles/risograph/STYLE.md:113-119       变化空间（结构/开场/结尾）
styles/risograph/demo/riso.js:1-6       印刷合成器头注释（通道=版 / 挖空 / 叠印）
styles/risograph/demo/riso.js:7-12      INK 三专色 + PAPER
styles/risograph/demo/riso.js:17-39     shader uniforms
styles/risograph/demo/riso.js:41        混合良好的 hash
styles/risograph/demo/riso.js:50-68     dens（含倒影分版相位）
styles/risograph/demo/riso.js:70-107    main（纸纤维/gate/刷墨/网点/墨粒/漏白/条纹/乘算）
styles/risograph/demo/riso.js:73        纸纤维
styles/risograph/demo/riso.js:81-83     滚筒刷墨揭示
styles/risograph/demo/riso.js:85-86     余弦网点
styles/risograph/demo/riso.js:89-91     墨粒沸腾（uSeed/uBoil）
styles/risograph/demo/riso.js:94        实地
styles/risograph/demo/riso.js:96-97     漏白点
styles/risograph/demo/riso.js:99-101    走纸条纹 + 浓淡
styles/risograph/demo/riso.js:104       乘算合成
styles/risograph/demo/riso.js:109-153   makeRiso WebGL2
styles/risograph/demo/riso.js:135       默认网角 15°/0°/75°
styles/risograph/demo/riso.js:140       boil 默认 0.35
styles/risograph/demo/riso.js:141       网点周期 7px
styles/risograph/demo/draw.js:1-2       通道=版浓度 / over() 叠印
styles/risograph/demo/draw.js:11-22     layer 纸白挖空描边
styles/risograph/demo/draw.js:24        S.mask 全局版遮罩
styles/risograph/demo/draw.js:26        ink 三版浓度
styles/risograph/demo/draw.js:32        over → lighter
styles/risograph/demo/draw.js:60-72     limb 胶囊 + 条纹
styles/risograph/demo/draw.js:74-83     2 骨 IK
styles/risograph/demo/draw.js:87-92     text
styles/risograph/demo/film.js:1         120 BPM，1 小节 2s，对齐拍点
styles/risograph/demo/film.js:8         DUR 40
styles/risograph/demo/film.js:9-12      SHOTS 镜头表
styles/risograph/demo/film.js:13-14     KICKS 套色跳点
styles/risograph/demo/film.js:16-25     EV 声音事件
styles/risograph/demo/film.js:29-33     setLines 字幕区间规则
styles/risograph/demo/film.js:36-52     regist 固定偏移 + 跳 + 漂/套准
styles/risograph/demo/film.js:37        每镜头一套固定错位
styles/risograph/demo/film.js:40-44     重音 kick 衰减
styles/risograph/demo/film.js:45-50     漂开 + 28.0 咔
styles/risograph/demo/film.js:53-60     plates gate/sweep
styles/risograph/demo/film.js:64        step 角色 on twos
styles/risograph/demo/film.js:82-87     片名只印蓝版，刷出/撤下
styles/risograph/demo/film.js:158-165   鸽群叠印
styles/risograph/demo/film.js:188-200   粉色圆叠印吞画面
styles/risograph/demo/film.js:224-252   中景分享（锁定构图）
styles/risograph/demo/film.js:254-274   拉远揭示纸张
styles/risograph/demo/film.js:276-291   片尾卡三版错位 + 套准十字
styles/risograph/demo/film.js:306-315   字幕纸白挖空条 + 蓝版字
styles/risograph/demo/film.js:318-331   renderFilm 返回印刷参数
styles/risograph/demo/main.js:1-14      setup + 字体预载 + DUR/EV/SUBS
styles/risograph/demo/main.js:10        字体在 READY 前预载
styles/risograph/demo/main.js:14        window.DUR/EV/SUBS
styles/risograph/demo/main.js:21        单版（gate [1,0,0]）示例
styles/risograph/demo/sheet.js:1        设定表也是三版印出来的
styles/risograph/demo/sheet.js:5        BL/YE/PK 三版常量
styles/risograph/demo/tools/mux.sh:2    crf 15 + -tune grain
styles/risograph/demo/tools/mux.sh:7-9  两遍 loudnorm −14 LUFS / TP −1.2
styles/risograph/demo/tools/mux.sh:10   grain（GR=0 用于矢量）
styles/risograph/demo/tools/video_png.mjs:1  PNG 而非 JPEG，yuv444
styles/risograph/demo/tools/video_png.mjs:15-16 PNG → yuv444p qp0
styles/risograph/demo/tools/subs.py:8   字幕区间规则
styles/risograph/demo/mix.py:23-25      riso_drum 进纸 + 滚筒
styles/risograph/demo/mix.py:81-87      paper_out 马达 / paper_land
styles/risograph/demo/mix.py:114        版到场 drum 按版摆 pan
styles/risograph/demo/mix.py:145        配乐 + 旁白闪避 −8 dB
styles/risograph/demo/lines.json:2      五句旁白（示例）
```
