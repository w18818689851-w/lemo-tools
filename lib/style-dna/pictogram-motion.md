# 几何象形动态目录片（pictogram-motion）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《ASIAD 2026》的具体条目内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部**拍点锁定的闪卡目录片**：N 个条目一张一张地过，每张卡 = 一个几何象形小人做一个动作 + 一行巨型标题 + 一行第二语言 + 一个等宽编号「07 / N」。卡片按章节分组，每章独占一个色相，由一张满幅图案卡开场；每一次切都落在鼓点上。

**它不是**：等距信息图（没有深度、没有 3D、没有透视）；瑞士式动态图形（这里的小人与图案和文字一样重，不只是排字）；卡通（小人永远没有五官、不做表情、不卖萌）；数据片（数字是标签与编号，不是图表）。
（`STYLE.md:6-18`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「在 1920×1080 平框里、由方格网格组织起来的一块平涂」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **平涂 Canvas2D** | 画布固定 1920×1080；无 3D、无透视、无景深；颗粒只在成片 mux 阶段叠（`noise=c0s=4`），画面本身干净（`engine.js:4`、`mux.sh:12`）。 |
| **唯一网格** | `CELL = 180`（约屏高 1/6）；所有条带、转场、墙面都对齐它；网格隐形但一切都在它上面（`engine.js:68`）。 |
| **核心图形** | 先中间调铺底 → 格点上随机落跨 2×2 宏格的整格大圆/半圆 → 约 42%–50% 的格子放一枚纹样（14 种：四分之一圆、半圆、圆+小圆、条纹夕阳、青海波鳞、圆点鳞、三角鳞、同心弧、日轮齿轮、方格、月牙、S 波、渐变四分之一圆、横条渐隐），按 90° 整数倍旋转（`engine.js:71-146`）。 |
| **整行错位（签名）** | 图案画布比屏宽 3 格；绘制时逐行取偏移 `offs(row)`，相邻行反向、幅度 clamp 在 ±1 格；章节卡上还在拍点上整行跳四分之一格（`engine.js:161,184-194`；`scenes.js:226-230`）。 |
| **图案缓存** | 按 (色系\|种子\|对比度\|密度\|格宽) 缓存，**上限 10 张**、超限删最旧——并行渲染器防爆内存的硬约束（`engine.js:150-156`）。 |
| **象形小人** | 骨骼驱动圆头火柴人：单位=身高、原点=髋；参数 rot/torso/head + 两臂两腿各 2 个绝对角；先画远侧肢体（混向背景约 42%）、再躯干、再近侧、最后圆头；全部圆头圆角、无描边、无面部（`engine.js:202-233`；`scenes.js:22-31`）。 |
| **小人组装入场** | 不是淡入，是把小人层按 **54px** 横条切片、左右交替滑进寄存器，`asm` 0→1（`scenes.js:52-91`）。 |
| **人物层离屏 + 遮罩** | 水/栏架/坡道画在小人自己的离屏缓冲；用 `destination-in` + 线性渐变把它裁到文字栏之外，边缘约 90–110px 柔化 → 文字与人形永不重叠（`scenes.js:54-81,167`）。 |
| **日盘 + 一道光** | 舞台 = 一枚纯色大圆（色相取邻调），盘上只有一道缓慢扫过的白光带——全片唯一的渐变（`scenes.js:202-211`）。 |
| **文字即建筑** | 标题 900 字重几何无衬线（Inter Tight）150–330px、负字距、按 maxW 自适应；第二语言同族 900；角落元信息等宽（DM Mono）约 22px、宽字距；标题「遮罩上滑」入场、元信息打字机入场（`engine.js:275-313`；`scenes.js:121-127`）。 |
| **字体加载** | 四个 @font-face：Inter Tight / Noto Sans SC / Noto Sans JP / DM Mono；页面等字体 load 完再 `window.READY = true`（`index.html:4-7,31`）。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位冷静的策展人在给一份目录编号。第三人称、现在时、无主语直陈。只做标签，不做解说。

**长度（实测）**：
- 主标题 **1–4 个英文词、全大写、8–28 字符**，不断行、不加句号（`SPRINT` / `MIDDLE & LONG` / `ARTISTIC SWIMMING`）。
- 中文大字 **2–8 字**（短跑 / 中长跑 / 花样游泳）。
- 编号与家族名单独成行，形如 `ATHLETICS   01 / 43`（`scenes.js:118-119`）。
- 旁白：**每章至多一句，12–34 字**，一句只讲一个条目，说完即停。

**断句规则**：标题按词边界断，不按字符断；标点只允许中圆点「·」与斜杠「/」连接并列项，不用逗号、不用书名号、不用感叹号（`edl.js:27` 的 `跳远 · 三级跳远`）。

**句首类型**（示例性，不是抄原文）：
- 编号开场：`01 / 43   ATHLETICS`
- 名词直给：`SPRINT  短跑`
- 规格直给：`SHOT PUT   7.26 KG`
- 家族归并：`GYMNASTICS   ARTISTIC`
- 章节开场：`CHAPTER 03   ·   BALL GAMES`

**这个风格里不会出现的句式**：
- 完整主谓句（「这个项目需要很强的爆发力」）——只做标签，不做解说。
- 形容词堆叠与情绪词（「精彩绝伦的」「令人震撼」）。
- 问句、感叹句、第二人称号召（「你能跑多快？」）。
- 任何真实赛事专有名词、口号、吉祥物名、色名。

---

## 3. 叙事节奏

**信息投放顺序**：

```
intro（片头：心跳脉冲 → 五色环 → 标题铺满 → 三个大数上冲 → 各就各位/预备/静音/砰）
  → chapter 章节卡（换色信号，满幅图案 + 中间实色带 + 空心章节号）
    → card 项目卡（A/B/C 三版式轮换，一张一条目）
      → 同族快切子项（2 拍一张，一串快速跑）
  → finale（片尾：43 张卡翻成瓦墙 → 收拢成一点 → 红日 + 五色环 + 口号 + 结尾卡）
（`scenes.js:353-457` 片头、`222-259` 章节卡、`151-201` 项目卡、`461-553` 片尾）
```

**时间挂在 150 BPM、4/4 网格上**：1 拍 = 0.4s，1 小节 = 4 拍 = 1.6s。

| 层 | 停留规则（`edl.js`） |
|---|---|
| intro | 48 拍（12 小节） |
| chapter 章节卡 | 8 拍（2 小节） |
| card 项目卡（默认） | 4 拍（1 小节） |
| 同族快切 / 持拍类 | 2 拍（半小节） |
| finale | 48 拍 |
| 镜头起始 t0 | 一律 `累计拍数 × 0.4`，天然落拍（`edl.js:118`） |

**总时长**：全片 101 小节 ≈ **161.6s**（约 2 分 42 秒）；渲染片段 ≈ 163.6s（多 2s 尾垫）（`music/report.txt:3`、`mux.sh:12`）。条目数 N 决定长度。

**静默怎么用**：静默是乐器。大击之前把鼓与贝斯静掉半拍（demo 里 11 处 pre-hit gap）；倒数卡下把整小节剥到只剩一个 tick 声；片头「各就各位 — 预备 —（静音）— 砰」用一次全静换来冲击（`music/report.txt:5`、`music.py:1610`、`scenes.js:438-456`）。

---

## 4. 镜头逻辑

**镜头是什么**：绝大多数时候是一台**锁死的平机位**。能量来自整行错位、转场和人物动作，不来自运镜。一旦动，就沿网格动。

**词汇表**：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 锁定平框 | 把卡片当海报读 | 任何条目；需要读清的规格 |
| 横向长镜头 + 每拍单屏甩镜 | 一个连续的家族、动量 | 一条产线；一条路线；一排站点 |
| 沿行慢漂 | 浏览感、平静 | 画廊；菜单；较慢的章节 |
| 按格纵滚 | 排名、深度、下潜 | 十佳；楼层；海深 |
| 推入一枚纹样格直到它成为下一帧 | 放大局部 | 菜里的一味料；地图里的一座城 |
| 拉回成条目瓦墙 | 一次看全 | 总结；「全部」；对比 |
| 瓦片收拢成一点 | 多归一 | 合并；共同目标；计数归零 |
| 沿网格线分屏 | 两两并列 | 对阵；前后；两版对照 |

**允许的转场**（全部来自网格，由 `transType()` 按前后镜头类型/章节序号轮换，`scenes.js:594-602`）：
- 整行滑动 `rows`（相邻行反向，`606-613`）
- 整列落下 `cols`（8 列错相位，`614-621`）
- 推镜 `slide`（A 左退、B 右进，接缝一道暗边，`622-626`）
- 格角四分之一圆 `quarter`（每格从四角之一长出圆盘，`627-642`）
- 虹膜 `iris`（从上一帧小人位置开圆，`643-648`）
- 翻牌 `flip`（11×6 瓦片绕竖轴翻面，`649-662`）

**禁止**：溶解/叠化（唯一例外是片尾最后 1.3s 全黑淡出，`scenes.js:550`）；3D 相机运动、手持抖动、景深、变焦呼吸；文字与人形重叠；任何未对齐网格的随机裁切。

---

## 5. 表达习惯（idioms）

1. **一卡一条目**：条目数就是钩子（「ALL N」），一个条目 = 一个可读动作。
2. **一章一色**：家族变成色相，观众永远知道自己在哪一段。
3. **一物一动词**：一个身体动作或一个道具动作，一拍内读得懂。
4. **节奏阶梯**：同族子项用双倍速快切跑一串（第二个速度来自「把拍对半切」，绝不改 BPM）。
5. **跑道长镜头**：站点一屏一站，每次切点相机甩一次（`scenes.js:266-338`）。
6. **数字上冲**：一个大数在一小节内滚到它的值（`scenes.js:426-431`）。
7. **图标墙**：所有象形图回来排成网格并转成同一色（`scenes.js:460-523`）。
8. **角标 HUD**：每卡恒有等宽元信息 + 一条 **43 刻度**进度条，当前刻度最高、已完成变暗、未到最淡（`scenes.js:556-579`）。
9. **日盘与一道光**：小人永远站在一枚日盘上，盘上一道缓慢扫过的白光（`scenes.js:203-211`）。
10. **运动模糊只在动的地方**：转场窗口与甩镜窗内做 5 帧子帧平均（快门 0.5/60），静止帧只渲一次（`scenes.js:699-717`）。

---

## 6. 氛围

冷调的展馆气息：平涂色块在拍点上被整齐推开，象形小人不带表情地完成一个又一个动作，巨型标题像建筑一样压在场地上；唯一的柔光是扫过日盘的那道白光。整体是「被编排过的秩序」——干净、准点、有仪式感、信息密度高。

---

## 7. 声音

- **乐器**：鼓组是脊椎——和太鼓（taiko）主律动，配拍手、军鼓、踩镲、沙锤、大镲；色彩乐器有三味线拨弦（Karplus-Strong）、筝（koto）琶音、音槌、失真锯齿和弦、合成贝斯、pad、riser、drone；调式 D 都节（D Eb G A Bb）压在 D 小调和声上（`music.py:5`）。
- **动作声（按章节材质分层）**：每次转场选一击——splash / pok / clank / crack / whoosh / sizzle / tick；sfx RMS 比鼓组低约 6 dB（`music/report.txt`、`music.py:236-292`）。
- **混音规则**：母带链 = 胶水压缩（2:1）→ 响度迭代到 **−14 LUFS** → 真峰限制器（天花板约 −1.3 dBTP）。旁白可选。所有镜头起始都从剪辑表读时间、把重音精确放上去，并逐条做 **±15ms** 的 onset 校验，未过即报 miss（`music.py:876-886,1531-1539,1591-1603`；`report.txt:8`）。

---

## 8. 变化空间（可自由发挥）

条目、分组、动词、色板、章节顺序、是否要长镜头、节奏阶梯、开场、收尾、音乐与旁白，全部由你定，且都离 demo 很远。

- **结构**：**倒计时**（条目从 N 排到 1，相机沿行向下滚，列表越短节奏越快）；**象形图里的一天**（同一个小人，一小时一张卡，色板从黎明暖调平移到夜色冷调）；**装配**（每张卡给角落里同一台象形机器加一个零件，最后成整机）。
- **开场**：一枚纹样格填满画面再裂成网格；第一个小人已经在跑、标题才砸进来；空白网格先用细线在拍点上画出格子再上色。
- **收尾**：最后一卡长时间停住、图案行逐行停下；最后一个小人走出画框、HUD 刻度逐格熄灭；反向拆解——网格散成一行行滑出屏幕，只留米白。
- **色板随题材换**：节庆暖调、海岸、厨房……但都要**自创色名**，绝不借用任何真实赛事的色名（`STYLE.md:34`）。
- **可换不可换**：BPM 可换、鼓族可换、旁白可有可无；但**方格网格、整行错位的核心图形、象形小人**三件不能换，换掉任何一件就不再是这个风格。

---

## 9. 禁忌清单

- 把核心图形画成等距信息图或 3D 立体（风格是纯平面、无深度、无透视）。
- 让小人有表情、有五官、会卖萌（象形小人一律无脸、不表演情绪）。
- 把数字做成图表/数据可视化（这里的数字是标签与编号，不是统计图）。
- 在浅色相上用米白字、在深墨底上让日盘消失（必须按色相反转前景与日盘调，`STYLE.md:97-98`）。
- 临摹任何真实赛事的象形图、会徽、口号、纹样或色名。
- 图案画布无上限缓存（并行渲染器会爆内存，必须 LRU 限量）。
- 文字压到人物或人物环境上（必须离屏缓冲 + 渐变遮罩切开）。
- 复用示例的故事、条目表、章节顺序、色名或时长。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`edl.js` 为唯一真值）

| 字段 | 类型 | 说明 |
|---|---|---|
| `BPM` | number | 150；`BEAT = 60/BPM = 0.4`；`BAR = BEAT*4 = 1.6`（`edl.js:4`） |
| `shots[]` | object[] | 每条含 `kind`(intro/chapter/card/finale)、`beats`、累计出的 `b0/t0/dur`（`edl.js:118`） |
| card 字段 | — | `n`（大项编号，用于 `NN / 43` 与 HUD 刻度）、`en/zh/jp`、`pose`、`sub`、`beats`、flags `fam/water/racket/track`（`edl.js:13,37,58`） |
| chapter 字段 | — | `no`（两位章节号）、`en/zh/jp`、`pal`（色系键）（`edl.js:12`） |
| `PAL` | object | 每个色系：`t[0..4]` 由深到浅五阶 + `fg`/`dim`/`deep`；`base = t[2]`（`engine.js:45-53`） |
| `G.CYCLE` | array | 多色章节的轮换顺序（`engine.js:56`） |

### 10.2 新画面主体的契约

新增一个条目 = 在剪辑表加一行 `card(...)` 并给一个**已存在**的 pose 键；若该动作没有骨骼定义，则在 `poses/<章>.js` 新增一个姿势函数，遵循「单位=身高、原点=髋、面向 +x、角度按 垂直向下=0°」的姿势契约（`engine.js:196-204`）。
新增一个色系 = 在 `PAL` 加一项，必须给出 **5 个由深到浅的色阶 + fg + dim/deep**，禁止只给一个颜色。
新增章节 = 加 `chapter(...)`，其 `pal` 指向已有色系（或用 `multi` 走轮换）。

### 10.3 时间线契约

- 页面契约（`index.html`）：`window.render(t)`、`window.DUR`、`window.READY`；脚本按 `edl.js → engine.js → poses/* → scenes.js` 顺序加载（`index.html:13-27`）。
- 剪辑表是唯一时间真相：`edl.js` 导出 `{BPM,BEAT,BAR,shots,beats,DUR}`；禁止手写秒数；镜头起始必须落在整数拍（`edl.js:116-127`）。
- `render.mjs` 以 1920×1080 视口渲染，配乐与字幕都从剪辑表导出（`render.mjs:19`）。

### 10.4 事件词汇（配乐与动效共用）

| 词 | 含义 |
|---|---|
| `intro/chapter/card/finale` | 镜头类型 |
| `onset` | 镜头起始，重音锚点（±15ms 校验） |
| `pre-hit gap` | 大击前的鼓贝斯静音窗 |
| `pace-ladder run` | 双倍速快切串 |
| `grid-step` | 章节卡上每拍整行跳四分之一格 |
| `assembly` | 小人横条组装 |

---

## 11. 构建链（复用机制）

```
sh styles/pictogram-motion/demo/build.sh
  # 1. edl.js → timeline.json（给配乐）
  # 2. render.mjs video [workers] → out*/seg_*.mp4 + list.txt（无声分段）
  # 3. music/music.py（读剪辑表，per-shot accents + onset 校验）→ music.wav + report.txt
  # 4. mux.sh（concat + 轻颗粒 noise=c0s=4 + aac）→ 成片
```

**关键机制**：`edl.js` 是唯一真值——画面、字幕、拟音、配乐 cue 全部从它导出；改时间只改一处。`music.py` 读剪辑表，所以任意条目数、任意章节数都能配到乐（`mux.sh:11-14`、`music.py:876-886`）。

---

## 12. 证据

```
styles/pictogram-motion/STYLE.md:3-4        一句话本质 + 参考只借语法
styles/pictogram-motion/STYLE.md:6-18       本质四条 + 不是什么
styles/pictogram-motion/STYLE.md:20-26      材料与渲染（方格网格/图案模型/人物模型/舞台/离屏缓冲）
styles/pictogram-motion/STYLE.md:28-34      颜色逻辑（五色相×五阶/明暗反转/自创色名）
styles/pictogram-motion/STYLE.md:36-42      字体与字幕（900 字重/双语句式/HUD 刻度/停留）
styles/pictogram-motion/STYLE.md:44-53      运动质量（拍点锁定/节奏阶梯/遮罩上滑/横条组装/转场）
styles/pictogram-motion/STYLE.md:55-70      镜头语法表 + 转场 + 禁止溶解/3D/抖动
styles/pictogram-motion/STYLE.md:72-80      声音（鼓组脊椎/色彩乐器/画面锁定 ±15ms/−14 LUFS）
styles/pictogram-motion/STYLE.md:82-92      原生动作七条
styles/pictogram-motion/STYLE.md:94-101     媒介陷阱
styles/pictogram-motion/STYLE.md:107-113    变化空间（结构/开场/结尾）
styles/pictogram-motion/demo/edl.js:1       150 BPM，1 拍 0.4s，所有镜头落拍点
styles/pictogram-motion/demo/edl.js:4       BPM/BEAT/BAR 常量
styles/pictogram-motion/demo/edl.js:10-13   intro/chapter/card 时长（48/8/4 拍）
styles/pictogram-motion/demo/edl.js:37,58   快切卡 2 拍
styles/pictogram-motion/demo/edl.js:113     finale 48 拍
styles/pictogram-motion/demo/edl.js:118     累计拍数 → t0/dur（落拍）
styles/pictogram-motion/demo/edl.js:123-124 fam → title/family 字段
styles/pictogram-motion/demo/engine.js:4    画布 1920×1080
styles/pictogram-motion/demo/engine.js:11-23 缓动函数集
styles/pictogram-motion/demo/engine.js:24-32 种子随机 rng
styles/pictogram-motion/demo/engine.js:43   CREAM/INK 两色通用
styles/pictogram-motion/demo/engine.js:45-53 五色系 × 五阶 + base=t[2]
styles/pictogram-motion/demo/engine.js:56   多色章节轮换顺序
styles/pictogram-motion/demo/engine.js:60-63 disc/seg/ring/poly 画布工具
styles/pictogram-motion/demo/engine.js:68   CELL=180
styles/pictogram-motion/demo/engine.js:71-146 14 种纹样
styles/pictogram-motion/demo/engine.js:90-98 青海波鳞纹
styles/pictogram-motion/demo/engine.js:150-156 图案 LRU 缓存（上限 10）
styles/pictogram-motion/demo/engine.js:161  图案画布比屏宽 3 格
styles/pictogram-motion/demo/engine.js:184-194 drawPattern 整行错位
styles/pictogram-motion/demo/engine.js:202-204 骨骼长度/宽度表
styles/pictogram-motion/demo/engine.js:212-224 joints 解算
styles/pictogram-motion/demo/engine.js:227-233 drawFigure（远侧先画）
styles/pictogram-motion/demo/engine.js:246-256 keyPose 关键帧
styles/pictogram-motion/demo/engine.js:258-268 runCycle 跑步循环
styles/pictogram-motion/demo/engine.js:275-280 字体族
styles/pictogram-motion/demo/engine.js:282-287 fitFont 自适应缩号
styles/pictogram-motion/demo/engine.js:289-305 maskText 遮罩上滑
styles/pictogram-motion/demo/engine.js:307-313 typeText 打字机
styles/pictogram-motion/demo/scenes.js:22-31 colorsFor（far=mix(fg,bg,0.42)）
styles/pictogram-motion/demo/scenes.js:52-91 stageFigure 横条组装 + 遮罩
styles/pictogram-motion/demo/scenes.js:94-98 patBg 整行错位 + sin
styles/pictogram-motion/demo/scenes.js:145-150 layoutOf 版式轮换
styles/pictogram-motion/demo/scenes.js:151-201 cardScene 三版式 A/B/C
styles/pictogram-motion/demo/scenes.js:169-184 L=B 标题铺满 + 底部信息条
styles/pictogram-motion/demo/scenes.js:203-211 sun 日盘 + 一道光
styles/pictogram-motion/demo/scenes.js:222-259 chapterScene
styles/pictogram-motion/demo/scenes.js:226-230 每拍整行跳四分之一格
styles/pictogram-motion/demo/scenes.js:262-275 甩镜窗口 + 匀速漂移 + trackCam
styles/pictogram-motion/demo/scenes.js:276-338 trackScene 田径长镜头
styles/pictogram-motion/demo/scenes.js:556-579 HUD 43 刻度进度条
styles/pictogram-motion/demo/scenes.js:594-602 transType 转场选择
styles/pictogram-motion/demo/scenes.js:606-613 rows 转场
styles/pictogram-motion/demo/scenes.js:614-621 cols 转场
styles/pictogram-motion/demo/scenes.js:622-626 slide 转场
styles/pictogram-motion/demo/scenes.js:627-642 quarter 转场
styles/pictogram-motion/demo/scenes.js:643-648 iris 转场
styles/pictogram-motion/demo/scenes.js:649-662 flip 转场
styles/pictogram-motion/demo/scenes.js:667-697 shotAt/frame 分发
styles/pictogram-motion/demo/scenes.js:699-717 isFast + 运动模糊（5 帧子帧平均）
styles/pictogram-motion/demo/index.html:4-7  四个 @font-face
styles/pictogram-motion/demo/index.html:13-27 脚本顺序 + window.render/DUR
styles/pictogram-motion/demo/render.mjs:19  1920×1080 视口
styles/pictogram-motion/demo/mux.sh:12      concat + 轻颗粒 noise=c0s=4
styles/pictogram-motion/demo/music/music.py:23  assert beat 0.4 / bpm 150
styles/pictogram-motion/demo/music/music.py:876-886 per-shot accents from locked edit
styles/pictogram-motion/demo/music/music.py:1531-1539 母带 glue → loudness → limiter −14 LUFS
styles/pictogram-motion/demo/music/music.py:1591-1603 onset 校验 ±15ms
styles/pictogram-motion/demo/music/music.py:1610 pre-hit gaps 鼓贝斯静音
styles/pictogram-motion/demo/music/report.txt:3  150 BPM / 101 小节 / 161.6s
styles/pictogram-motion/demo/music/report.txt:5  79 shots / 11 gaps
styles/pictogram-motion/demo/music/report.txt:8  −14.11 LUFS / TP −1.12 dBTP
```
