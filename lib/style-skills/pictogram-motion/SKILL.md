---
name: lemo-style-pictogram-motion
description: 【lemo 风格 Skill · 象形运动图形】当要把一份「条目清单」（赛事大项 / 产品线 / 菜品 / 工序 / 物种）做成拍点锁定的快闪目录片时用本风格：一卡一条目、一章一色、几何象形小人做动作、巨型双语标题从遮罩上滑，所有切点落在鼓点上。选定本风格做视频时，优先读本文件。
slug: pictogram-motion
name_zh: 象形运动图形
category: 图形与排版
film: Aichi-Nagoya 2026 — All 43 Sports
---

# 象形运动图形（`pictogram-motion`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/pictogram-motion/STYLE.md` · `styles/pictogram-motion/DEMO.md` ·
> `styles/pictogram-motion/demo/mux.sh`（无 build.sh）· `lib/style-dna/pictogram-motion.json` ·
> `lib/style-dna/pictogram-motion.md` · `lib/dub-styles.json#pictogram-motion` ·
> `styles/pictogram-motion/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部**拍点锁定的闪卡目录片**。N 个条目一张一张地过，每张卡 = 一个几何象形小人做一个动作 + 一行巨型标题 + 一行第二语言 + 一个等宽编号「07 / N」。卡片按章节分组，每章独占一个色相，由一张满幅图案卡开场；每一次切都落在鼓点上。它只用三样东西搭：方形格阵的「核心图形」、圆头杆加圆盘头拼的几何图标、从遮罩里滑出的粗体双语大字（`STYLE.md:3-4`、`style-dna/pictogram-motion.json#essence`）。

**不是什么**（最容易做错的邻居风格）：不是等距信息图（没有深度、没有 3D、没有透视）；不是 `swiss-motion` 瑞士式动态排版（那里文字独扛全场，这里小人与图案和文字一样重）；不是卡通（小人一律无脸、不表情、不卖萌）；不是数据片（数字是标签与编号，不是图表）（`STYLE.md:18`）。

**什么时候用它**：一份 20–80 条的清单要被快速、整齐、有仪式感地过一遍——赛事大项、产品线、菜谱工序、工具清单、团队成员、楼层或站点。

**一句话内核**：把「清单」编成一份被设计过的目录——每个条目都被认真编号、认真配色、认真放在拍上；观众记住的是「编排过的秩序」。

**边界**：这个风格**撑不起**需要叙事弧线、人物情绪、实拍质感、数据图表、长解说的内容；也撑不起没有「一拍内读得懂的动作」的纯抽象条目。三件不能换的骨架是方格网格、整行错位的核心图形、象形小人（`style-dna/pictogram-motion.md:161`）。

---

## 2. 画面构图

- **镜头数与画幅**：样片 **79 个镜头**（7 章 70 卡 + 片头 / 片尾 / 章节卡 / 倒计时）（`DEMO.md`、`demo/music/report.txt:5`）。设计帧固定 **1920×1080（16:9）**；抽帧 `f01`–`f24` 与接触印样全部是 16:9（1920×1080 等比缩到 360×202），这是本风格原生构图的权威证据。**★ 2026-10-04 已支持多比例**：能力声明落在 `demo/film.js`（`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`），多比例靠 `demo/index.html` 的**页面外壳等比装入**实现（见本节末段）。
- **唯一网格**：`CELL = 180`（≈屏高 1/6），即 10.7 列 × 6 行。章节带 2 行高（360px），转场按 180px 行 / 240px 列切，片尾瓦墙 9×5（`demo/engine.js:68`、`DEMO.md`）。
- **主体位置与占比**：多数卡是「左文字栏 + 右舞台」——文字栏 x130、基线 610；**日盘**中心 x1290（横姿卡 1370），半径 **360–380px（≈画面高 2/3）**，小人站在盘上。B 版式把标题铺满 1760px 宽、小人压在标题之上；C 版式左侧一块 **820px 实色面板** + 90px 细线格，图案 / 日盘 / 小人移到右侧 x1370（`DEMO.md`「Card layouts」、`demo/scenes.js:151-201`）。抽帧 `f04`（SPRINT，A 版）、`f10`（BALL，B 版）、`f13`（JUDO，C 版）分别对上三种版式。
- **负空间 / 留白**：图案在卡片上以低对比铺底（`spread 0.42`）留出文字可读区，只有章节卡才上满对比（`spread 0.95`）；文字栏一侧始终是干净的平涂（`DEMO.md`「Palette & props」）。
- **图层叠放顺序**（从底到顶）：图案底 → 日盘 + 一道缓慢扫过的白光 → 小人（先远侧肢体混向背景 42% → 躯干 → 近侧肢体 → 圆头）→ 文字（遮罩上滑）→ 四角 HUD + 底部 N 刻度进度条（`demo/engine.js:227-233`、`demo/scenes.js:556-579`）。
- **安全区**：**文字与人形永不重叠**——人物层（水、栏架、坡道）画在自己的离屏缓冲里，用 `destination-in` + 线性渐变裁到文字栏之外，边缘 90–110px 柔化；HUD 恒在四角，刻度条贴底（`demo/scenes.js:52-91,167`）。
- **本风格不能出现的构图**：文字压到人物或人物环境上；未对齐网格的随机裁切；任何 3D / 透视 / 景深构图（`STYLE.md:96-101`）。
**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。本风格按 1920×1080 绝对像素构图（`engine.js` / `scenes.js` 大量绝对坐标 + 180px 网格），逐处改成 `layout(W, H)` 代价过高、且漏一处会**静默错位**，所以采用库侧 `MAINTAINING.md` 的「页面外壳等比装入」范式：**影片本体一字未改**（`#c` 画布的位图与 CSS 尺寸仍是 1920×1080），只在 `demo/index.html` 里加一层外壳——当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧**等比装入（contain）并居中，留边露出本风格的**米白底色 `#fbf6ec`**（palette 的 CREAM / 卡纸色，像把这张「卡」裱在米白纸上）。`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`。
- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform、不改底色）；改造前后三个时间点（24.54 / 81.80 / 139.06 s）**md5 逐字节相同**（跨进程，JPEG 亦一致 ⇒ 后处理确定）。
- **9:16 是装入不是裁切**：整张卡（标题栏、日盘、小人、四角 HUD、底部 N 刻度条）都在框内。实测 SSIM：9:16 vs **16:9 中心裁切** = 0.691 / 0.773 / 0.832（**明显 < 1**）；9:16 vs **理想等比装入**（pad 色 = 留边色 `#fbf6ec`）= 0.994 / 0.993 / 0.994（**接近 1**）。作为对照，同一帧改用**黑色 pad** 的理想装入只得 **0.536** —— 留边占竖屏面积 68%，色差会主导 SSIM，所以参照图的 pad 色必须等于实现的留边色。
- **代价（如实说）**：① **是等比装入、不是竖幅重排**——竖屏下有效画面只占 **1080×607**（约占框高 32%），上下各 656 px 米白留边；每张卡从满屏变成「裱在米白纸上的一条横卡」。② **全屏层留在设计框内**——四角 HUD 与底部刻度条只作用于设计帧，**不铺进留边**。③ 留边色是米白 `#fbf6ec`，与风格自身的卡纸色一致；深色相章节（墨底 / 红章）的上下留边对比最强。若将来要让竖屏有效画面提升到整屏，需要**重排**一版真正的竖版式（文字栏上、舞台下），而不是装入。

---

## 3. 配色体系

五个色相 × 五阶（`t[0]` 最深 → `t[4]` 最浅，`t[2]` 为基准）+ 一个中性深色；一套米白与一套墨色服务全部色相。色值取自样片实测（`DEMO.md`「Palette」表、`demo/engine.js:43-56`）：

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 米白 CREAM | `#fbf6ec` | 深色相上的前景字与人、片尾底色 | `engine.js:43` |
| 墨 INK | `#15111c`（PAL 里 ink `t[2]=#1e1a27`） | 浅色相上的前景字与人、片头底色 | `engine.js:43,45-53` |
| 红（主强调） | `#e83220`（t[2]；t[0]`#c21d15` … t[4]`#f07a45`） | 片头、田径章、片尾红日 | `DEMO.md` |
| 紫 | `#4e3a93`（t[0]`#231a6e` … t[4]`#7a62a9`） | 水上章、片头图案 | `DEMO.md` |
| 绿 | `#079a3e`（t[0]`#006d35` … t[4]`#68b15d`） | 球类 / 山地章 | `DEMO.md` |
| 金 | `#d5b102`（t[0]`#b48900` … t[4]`#e7d16c`） | 球类章；**取深字 `#211904`** | `DEMO.md` |
| 赭 | `#c18e46`（t[0]`#946a2e` … t[4]`#e0bf84`） | 格斗章；**取深字 `#1e1409`** | `DEMO.md` |

- **明度 / 对比规则**：**浅色相（金、赭）取深字与深人**（`#211904` / `#1e1409`），它们的日盘用更浅的 `t[4]`；深色相与墨底取米白；墨底上的日盘必须用 `t[3]`（用 `t[1]` 会消失），其强调色是金。抽帧 `f09`/`f11`/`f12`（金章深字）与 `f16`/`f17`（墨章米白）分别验证了两条规则。
- **禁止出现的颜色**：描边色、除那道扫光外的高光、任何渐变（全片唯一渐变是日盘上缓慢扫过的 9% 白光带）；禁止借用任何真实赛事的色名。
- **同一画面最多几个色相**：卡片 = **1 个色相**（+ 米白 / 墨 + 一枚金色小强调）；章节卡满幅图案 = 1 个色相的五阶；片头 / 片尾 = 五个色相齐上（抽帧 `f02` 是五色齐上的满幅图案）。多色章节按 `G.CYCLE = ['red','purple','green','gold','ochre']` 逐卡轮换（`demo/engine.js:56`）。

---

## 4. 转场规则

- **镜头之间怎么切**：全部是**网格系硬转场**——`rows`（整行滑动，相邻行反向）、`cols`（8 列错相位落下）、`slide`（推镜，A 左退 B 右进、接缝压一道暗边）、`quarter`（每格从四个角之一长出圆盘）、`iris`（从上一帧小人位置开圆）、`flip`（11×6 瓦片绕竖轴翻面），由 `transType()` 按前后镜头类型与章节序号轮换（`demo/scenes.js:594-662`）。抽帧 `f10`/`f15`/`f20` 正好抓到 `cols` / `flip` 的中间态。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有溶解 / 叠化**，唯一例外是片尾最后 **1.3s 的全黑淡出**；没有闪白、没有随机擦除（`style-dna/pictogram-motion.md:120`）。
- **硬切点怎么定**：由 `edl.js` 的**整数拍**决定——镜头起始 `t0 = 累计拍数 × 0.4s`，天然落拍（`demo/edl.js:118`）。
- **转场时长与缓动**：窗口 = 切点前 **0.12s** 到后 **0.26s**（≈0.38s）；进场用 `E.oExp`（指数缓出），甩镜与擦除用 `E.ioExp`（指数进出）；`E.oBack` 全片只在片头第一枚圆点上用一次（`DEMO.md`「Motion, as built」）。
- **绝对不要的转场**：溶解 / 叠化、3D 相机运动、手持抖动、景深、变焦呼吸、任何未对齐网格的随机裁切。田径长镜头内部**没有转场**，靠相机每拍甩一屏（`STYLE.md:70`、`demo/scenes.js:262-275`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | 标题 Inter Tight **900**（几何无衬线）；第二语言 Noto Sans JP **900** / Noto Sans SC **900**；元信息 DM Mono **500**；HUD DM Mono **17px** |
| 字号（相对画面宽 / 高） | 标题 **170px**（≈画面宽 8.9%）/ B 版 **330px**（≈17.2%）/ C 版 150px / 跑道卡 160px；第二语言 **92px**（≈4.8% 宽）；元信息 **22px**（≈1.15% 宽）、字距 3px |
| 颜色 / 描边 / 阴影 | **无描边、无阴影**；前景随色相反转（浅色相深字、深色相米白）；B 版标题用 ghost 调 `t[1]`/`t[4]` 压在图案与小人上 |
| 位置 / 安全边距 | 文字栏左 x130、基线 610（M 版右对齐 1800）；C 版文字在 820px 面板上；HUD 恒在四角；N 刻度进度条贴底 |
| 单行字数上限 / 最多行数 | 标题 **1–4 个英文词、全大写、8–28 字符，绝不折行、不加句号**；中文大字 **2–8 字**；编号与家族名单独成行（形如 `ATHLETICS   01 / 43`） |
| 出现与消失方式 | **遮罩上滑**（`G.maskText`）：标题 0–0.5s、第二语言 +0.08s、tag +0.2s；元信息**打字机**（`G.typeText`，无光标）；2 拍快切卡所有时序 **×0.7** |

- **字幕与旁白的关系**：卡片上的字**就是**文字层（样片无旁白）。若有旁白，字幕是叠在章节色**实色带**上的**等宽单行**、贴底、**绝不压标题**；停留 ≥ `max(1.8s, 语速+0.6s)`，需要读清的规格卡 ≥1.6s。旁白可选、每章至多一句，允许全片无旁白（`STYLE.md:41`）。
- **本风格特有的字幕禁忌**：不用逗号 / 书名号 / 感叹号，并列只用中圆点「·」与斜杠「/」；不做完整主谓句（只做标签不做解说）、不用情绪词、不用问句或第二人称（`style-dna/pictogram-motion.json#sentence_patterns`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「captions are a mono line on a solid band in the chapter hue」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#19FBF6EC`（AARRGGBB，落盘 ASS 为 `&H19ECF6FB`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。**底衬色为回退值**：demo 的 band 未定位到绘制函数，无法取 demo 真值，也就无法核验 demo 底衬与本配置字色的对比度是否达标（<3.0），故改用该风格自身的地色/辅色（palette.bg #fbf6ec @0.90）；字色 #15111C 与该底衬的 WCAG 对比度 **17.27**。

---

## 6. BGM / 音效特征

- **配乐**：**全程序合成**（numpy + scipy，**无采样**），「和太鼓 × 电子」，**150 BPM 4/4**，**D 都节音阶**（D Eb G A Bb）压在 D 小调和声上，**101 小节 = 161.6s + 2s 尾响**。鼓组是脊椎：odaiko / nagado / shime 太鼓、`ka` 边击、底鼓、拍手、军鼓、踩镲、沙锤、大镲；色彩层：三味线与筝的 Karplus-Strong 拨弦、音槌、失真锯齿和弦、合成贝斯、pad、riser、drone（`DEMO.md`「Score structure」、`demo/music/music.py:5`）。
- **拟音（foley）清单**：每次镜头起始按**章节材质**选一击——`splash` / `pok` / `clank` / `crack` / `whoosh` / `sizzle` / `tick`；sfx RMS 比鼓组低约 **6 dB**，让音效读得出「这一章的物性」而不抢拍（`music.py:236-292`）。
- **画面锁定**：`music.py` 读 `music/timeline.json`，把重音精确放在每个 onset 上，并逐条做 **±15ms** 校验（样片 **79/79 通过**，偏移 ≤0.2ms）（`music.py:876-886,1591-1603`）。
- **旁白处理**：样片无旁白；若加，是冷静策展人口吻、每章至多一句、说完即停。
- **响度目标**：`−14 LUFS`；**真峰值上限**：`≤ −1 dBTP`（样片实测 `−14.11 LUFS / −1.12 dBTP`）。母带链 = 2:1 胶水压缩 → 响度迭代 → 真峰限制器（`music.py:1531-1539`、`music/report.txt:8`）。
- **静音策略**：**静音是乐器**——大击之前把鼓与贝斯静掉半拍（样片 **11 处 pre-hit gap**）；倒数卡下把整小节剥到只剩一个 tick 声；片头「各就各位 — 预备 —（静音）— 砰」用一次全静换冲击（`music.py:1610`、`report.txt:5`）。
- **本次成片实际状态（音频链修复后）**：配乐已重新生成并混入成片——`demo/music/report.txt` 记录 **79/79 个镜头 onset 全部通过**（偏移 ≤0.2ms，阈值 ±15ms）、**11 处 pre-hit gap**、母带 `−14.11 LUFS / TP −1.12 dBTP`；成片 `ebur128` 实测 **I = −14.0 LUFS**（与声明目标 `−14 LUFS` 一致）。唯一不达标处是**真峰**：成片实测 `TPK +0.3 dBFS`（左 −0.5 / 右 +0.3），`volumedetect` 采样峰值 `−0.0 dBFS`，**超过声明上限 `≤ −1 dBTP` 约 1.3 dB 并触及满刻度**（见第 11 节）。★ 口径更正：上述 `TPK +0.3 dBFS` 是 `ebur128` 的 1 位小数读数、口径不同，不能当真峰值引用；**成片真峰值 = `loudnorm` 的 `input_tp`，4× 过采样 = +0.28 dBTP**。

---

## 7. 素材偏好

- **需要什么素材**：① 一份**条目清单**（20–80 条），每条一个「一拍内读得懂」的动词（身体动作，或道具动作如齿轮转、杯子倒）；② 5–7 个**章节分组**；③ 每章一个**色相 ×5 阶**；④ 每个动作用一个**骨骼姿势定义**（`poses/*.js`）；⑤ 四款 OFL 字体（Inter Tight / Noto Sans JP / Noto Sans SC / DM Mono）；⑥ 一段**程序合成配乐**（`music.py` 读剪辑表）。
- **不需要什么素材**：实拍视频、照片、3D 模型、贴图、外部音频采样（配乐全合成）；也**绝不需要**任何真实赛事的象形图 / 会徽 / 口号 / 纹样 / 色名——`demo/ref/` 里的官方参考图只作参考、**永不入画、不可分发**（`DEMO.md`「Rights note」）。
- **取景 / 质感 / 比例偏好**：纯平涂 Canvas2D、无描边、无渐变（除日盘上一道白光）、无纹理（除 mux 阶段 `noise=c0s=4` 的轻颗粒）；比例 **16:9**。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有对应姿势定义时，用 `G.P` 道具（`ball` / `racket` / `stick` / `ground` / `speed` / `arc`）把动作「物化」，不要退回成静态图标；缺某个色相时按「5 阶 + fg + dim/deep」新建，**禁止只给一个颜色**；缺配乐时宁可整片无旁白，但**鼓组不可省**——节奏是风格的脊椎（`style-dna/pictogram-motion.json#asset_contract`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 默认卡 **4 拍 = 1.6s**；同族快切卡 **2 拍 = 0.8s**；章节卡 **8 拍 = 3.2s**；片头 / 片尾各 **48 拍 = 19.2s** |
| 全片时长 | 样片 **101 小节 ≈ 161.6s**；成片实测 **161.58s**（= 3878 帧 @24fps。**原记** 163.58s = 3878 帧 + **2s 克隆尾垫**，2026-10-04 全量重渲后尾垫丢失），配乐 `mix.wav` 163.6s，与 demo 声明的 163.6s 一致 |
| 镜头数 | 样片 **79 个镜头**（7 章 70 卡 + 片头 / 片尾 / 章节卡 / 倒计时） |
| 信息投放节拍 | **150 BPM、4/4**，1 拍 = 0.4s、1 小节 = 1.6s；镜头起始 `t0 = 累计拍数 × 0.4`，天然落拍 |

- **加速 / 减速点**：第二个速度感来自「**把拍对半切**」（4 拍卡 → 2 拍快切串），**绝不改 BPM**。样片里游泳四姿、自行车四项、球拍类都走 2 拍（`pictogram-motion.srt` 第 24–27 / 72–75 条即 0.8s 卡）。
- **留白与静音的位置**：大击前 **0.2s（半拍）** 静音；倒数卡下整小节只留一个 tick；片头起跑前三连（各就各位 / 预备 / 静音）。
- **节奏阶梯与长镜头**：一个「英雄家族」做横向长镜头——样片田径 14 站一屏一站、每拍甩镜（`demo/scenes.js:266-338`）；其余章节一律锁定平框，能量来自整行错位、转场与人物动作（`STYLE.md:57`）。
- **收尾的 2s 尾垫（实测）**：片尾淡黑后是 **48 帧 = 2.000s 的全黑定格**（亮度 YAVG：160.5s `213.8` → 161.0s `70.3` → 161.5s `16.0` → 之后恒 `16.0003` 至片尾；末三帧 `SSIM 1.000000 / PSNR inf`，逐像素相同）。这 2s 是**故意的**——demo 的 `mux.sh` 用 `tpad=stop_duration=2:stop_mode=clone` 克隆末帧，为的是让配乐的余响播完：161.583–162.083s `RMS −24.82`、162.083–162.583 `−31.96`、163.083–163.583 `−59.06 dB`，平滑衰减到静音；**没有这 2s 就会在 161.58s 处 −22 dB 硬切**。`cropdetect` 三处均为 `crop=1920:1080:0:0`，**全片无黑边**。

---

## 9. 制作参数清单

> 可直接抄的参数表。**本 demo 没有 `build.sh`**，命令入口以 `DEMO.md`「Build notes」与 `demo/mux.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node render.mjs video 12`（12 workers；共用机器用 2–3）→ `out_ej/seg_*.mp4` + `list.txt` |
| 帧率 | 风格原生 **60 fps**（demo：9696 帧 / 9816 帧含尾）；**本次编排器出片 24 fps** |
| 分辨率 / 比例 | 设计帧 **1920×1080（16:9）**；`render.mjs:19` 固定 1920×1080 视口（demo 自带 build 链，影片本体一字未改）；**★ 2026-10-04 已支持多比例**：`demo/film.js` 的 `FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`，靠 `demo/index.html` 的页面外壳等比装入（留边 `#fbf6ec`） |
| 混流 | `sh mux.sh`（demo 自带）或回退 `core/render/mux.sh`；demo 版 = `tpad=stop_duration=2:stop_mode=clone,noise=c0s=4:c0f=t+u` + `libx264 -preset slow -crf 14 -r 60 -g 120` + `aac 320k -ar 48000 -shortest -movflags +faststart`（**颗粒声明值 = 4**）；**本次成片实际** = 3878 帧无声视频（**原记** 2026-10-03 交付版带 2s 克隆尾垫 → 3926 帧 / 163.58s；2026-10-04 全量重渲后为 3878 帧 / 161.58s）+ `mix.wav`(163.6s) + loudnorm → `−14.0 LUFS`，AAC 48kHz 立体声，**颗粒取回退脚本默认 2（≠ 声明 4，见第 11 节）** |
| 编码器 | demo `mux.sh` 用 `libx264`；**本次编排器用 `h264_nvenc`** |
| 音频入口 | `../../../.venv/bin/python music/music.py`（先 `node music/export_timeline.cjs` 生成 `music/timeline.json`） |
| 字幕入口 | `node srt.cjs`（从 EDL 生成标题卡 `.srt`） |
| 事件导出 | `node core/render/events.mjs styles/pictogram-motion/demo`（→ `events.json`，本次输出 `dur 161.6`） |
| 本风格专属参数 | 先 `node music/export_timeline.cjs`；姿势检查 `node lab.mjs out.png "p=sprint,hurdles&n=8&beats=4&pal=red"`；中文版 `LANGQ=zh node render.mjs video 12` + `OUTDIR=out ./mux.sh` |
| 一键复现 | **无 build.sh**，按 `DEMO.md`「Build notes」5 步手跑（导出 timeline → 配乐 → 姿势/静帧 → 渲染 + mux → srt/海报） |

---

## 10. 编排规则

- **内容文件字段契约**：`card` 需 `n`（大项编号，用于 `NN / 43` 与 HUD 刻度）、`en` / `zh` / `jp`、`pose`（对应 `poses/*.js` 的键）、`sub`、`beats`（默认 4），可选 flags `fam` / `water` / `racket` / `track`；`chapter` 需 `no`（两位章节号）、`en` / `zh` / `jp`、`pal`（色系键）；`PAL` 每个色系必须给 **5 阶 + fg + dim/deep**，`base = t[2]`；`G.CYCLE` 是多色章节的轮换顺序（`style-dna/pictogram-motion.md:184-195`、`demo/engine.js:45-56`）。
- **事件词汇表**：`intro` / `chapter` / `card` / `finale`（镜头类型）、`onset`（镜头起始，重音锚点）、`pre-hit gap`（大击前鼓贝斯静音窗）、`pace-ladder run`（双倍速快切串）、`grid-step`（章节卡上每拍整行跳四分之一格）、`assembly`（小人横条组装）。
- **时间线契约**：`edl.js` 是**唯一时间真相**——导出 `{BPM,BEAT,BAR,shots,beats,DUR}`，`BPM=150`、`BEAT=0.4` 为常量，每条 shot 由 `beats` 累计出 `b0/t0/dur`，**禁止手写秒数**，镜头起始必须落在整数拍；配乐与字幕都从它导出（`demo/edl.js:116-127`）。
- **新增主体怎么接入**：新增条目 = 在剪辑表加一行 `card(...)` 并给一个**已存在**的 `pose` 键；若该动作没有骨骼定义，则在 `poses/<章>.js` 新增一个姿势函数，遵循「单位 = 身高、原点 = 髋、面向 +x、角度按 垂直向下 = 0°」的姿势契约；新增色系 = 在 `PAL` 加一项（5 阶 + fg + dim/deep）；新增章节 = 加 `chapter(...)`，其 `pal` 指向已有色系或用 `'multi'` 走轮换（`demo/engine.js:196-204`）。
- **换主题时要改哪些文件**：① `edl.js`——条目表、章节表、计数（「/ 43」与 43 刻度应从 `CARDS` 派生而非硬编码）；② `engine.js` 的 `PAL`——换成自创 5 色相 ×5 阶（浅色相保留深字规则）；③ `poses/*.js`——新动词的骨骼与道具；④ `scenes.js`——换掉赛事名 / 口号 / 会徽 mark（`rings()`）与硬编码的 43 / 469 / 16；⑤ `music/music.py` 的 `EXPECTED` + `compose()`——按新章节小节重写（把 `timeline.json` 交给音乐子智能体，保留 `card_accent` / `big_hit` / `report`）；⑥ `cover.html` / `cover34.html` 的海报文字；⑦ 删掉 `finaleScene` 里的 LemoLab credit 行。**保留不变的语法**：方格网格、整行错位核心图形、象形小人、双语遮罩上滑、HUD 编号 + 刻度、拍点锁定 + 节奏阶梯、一个长镜头、图标墙片尾（`DEMO.md`「Replacing the event elements」）。
- **与 `dub.mjs` 通路的关系**：`dub-styles.json#pictogram-motion` 只抽到**派生字幕形态**（`SimHei` / `fontSizeFactor 0.03148` / `marginVFactor 0.14537` / `marginLFactor 0.06019`）+ 类目默认深色底板 + WCAG 对比规则，palette 取本风格的 `bg #fbf6ec` / `accent #c21d15` / `fg #15111c`。也就是说「文案 + 风格」通路**只覆盖字幕与配色**，本风格真正的核心（网格图案、象形小人、拍点节奏）在该通路里**不生效**（`lib/dub-styles.json#pictogram-motion`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- ~~**9:16（产品默认）不可用**~~ **★ 2026-10-04 已修**：改用「页面外壳等比装入」（见第 2 节末段）——`demo/index.html` 把整张设计帧等比装入并居中，留边米白 `#fbf6ec`，**整张卡（含四角 HUD 与底部刻度条）都在框内**；`demo/film.js` 声明 `aspects` 含 9:16。残留代价：竖屏有效画面只占 1080×607、全屏层不铺进留边（见第 2 节）。
- **成片颗粒强度与声明不符（palette −1）**：声明值是 **4**——`DEMO.md:96` 明写「**Grain**: added only at mux time（`noise=c0s=4:c0f=t+u`）」、`demo/mux.sh:12` 同样写死 `noise=c0s=4`、`STYLE.md` §1 的 mood 也说「light grain」；成片实际是 **2**（日志第 8 行「grain（脚本默认）」）。按编排器的取值链 `--grain > demo 的 build.sh > 档案 > mux.sh 默认 2`（`lemo-make.mjs` 的 `const grain = o.grain ?? intent.grain ?? dnaGrain`）：本风格没传 `--grain`、**没有 `demo/build.sh`**、`lib/style-dna/pictogram-motion.json` 的 `sound_palette.mix_rules` 里**没有显式 grain**（`dnaGrainFromMixRules` 只认显式 `grain N`/`颗粒 N`，见 `lemo-make.mjs`）→ 三级全空 → `core/render/mux.sh:23` 的 `GR="${5:-2}"` 取 **2**。即成片颗粒 **2 < 声明 4**，比声明更轻。★ 这是**参数偏离、不是可见的画面损坏**：这一档差异在成片里肉眼不可辨（libx264 会把该量级噪声在平坦区吃掉，同批 `watercolor`/`paper-lantern` 的复核也证实抽帧看不出颗粒），故按与 `watercolor`（声明 0 / 实际 2）、`paper-lantern`（声明 0 / 实际 2）**同一口径**扣 1。
- **真峰超出声明上限（音频唯一不达标处）**：`STYLE.md §7` 声明真峰 `≤ −1 dBTP`，母带 `music.wav` 也做到了（`TP −1.12 dBTP`、内部 4× 表 `−1.30 dBTP`），但**成片** `ebur128` 实测 `TPK +0.3 dBFS`（左 −0.5 / 右 +0.3），`volumedetect` 采样峰值 `−0.0 dBFS`——**超上限约 1.3 dB 且触及满刻度**，最响的几下鼓点有削波风险。集成响度 `I = −14.0 LUFS` 与声明目标完全一致，问题出在混流阶段的 loudnorm 抬峰，不在配乐本身。（口径更正：`TPK +0.3 dBFS` 是 `ebur128` 的 1 位小数读数、口径不同，真峰值以 `loudnorm` 的 `input_tp`、4× 过采样 **+0.28 dBTP** 为准） ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 TPK +0.3 dBFS → **−1.65 dBTP**，已在 −1.2 dBTP 交付线内；音频评分回补 +2（见第 10 节）。
- **音频链曾整体缺失（已修复）**：首次出片带 `--skip-audio`，当时成片实测 `I −70.0 LUFS / Peak −inf`、volumedetect `−91.0 dB`（数字静音）。本次蒸馏期内由音频链修复任务重新生成配乐并重混流，成片现已带完整配乐（`report.txt`：79/79 onset 通过、11 处 pre-hit gap）。
- **★ 走不了编排器音频链（原缺陷，2026-10-05 已修）**：本 demo 的音频是**另一套架构**——配乐由 `music/music.py` 直出 `music/music.wav`、成片由自带 `mux.sh` 直混那份 wav，**从来没有 `mix.wav` 这个概念**；而编排器的混音步只在 `$D/mix.py` / `$D/sound.py` / `$D/audio/mix.py` 三个名字里找脚本（`lemo-make.mjs` 的 `MIX` 候选行），一个都没有时报 `STEP_FAIL 该 demo 没有 mix.py / sound.py / audio/mix.py —— 它用的是另一套音频架构` 并 `exit 1`（`lemo-make.mjs` 的混音步）⇒ 本风格**只能 `--skip-audio` 复用旧混音**（`scripts/check-audio-chain.mjs` 把它登记为 B 类「已知另一套音频架构」）。**修法**（不改红线 `lemo-make.mjs`，只在风格侧补壳）：新增 `demo/mix.py`，**不接受任何命令行参数**、所有路径按 `__file__` 解析（编排器以 `.venv/bin/python "$MIX"` 调用，工作目录是**库根**、不是 `demo/`），按本 demo 自己的构建顺序跑三步：① `node music/export_timeline.cjs`（`edl.js` → `music/timeline.json`；★ 编排器**不会**自动跑这一步，而 `music.py` 一 import 就读它，少了它会按上一次的剪辑表锁拍）→ ② `.venv/bin/python music/music.py`（→ `music/music.wav` 母带）→ ③ ffmpeg 4× 过采样 + `alimiter` 做**交付口径的真峰值收口** → `demo/mix.wav`。母带一字未改、仍在 `music/music.wav`；第 ③ 步只决定交给混流的交付电平。**实测（2026-10-05）**：`node lemo-make.mjs pictogram-motion --ratio 9:16 --skip-sync --out D:/lemo-films/_mixfix/pictogram-motion` → `MIX_OK 47116902 …/demo/mix.wav`、`MUX_OK 38681336 src_frames=out_frames=3878`；成片 `1080×1920 / 24 fps / 3878 帧 / 161.583 s / AAC 48 kHz 立体声`，实测 **I = −14.09 LUFS、真峰值 −2.90 dBTP** ⇒ **两条交付线（−14±1 LU、≤ −1.2 dBTP）双双达标**（真峰值余量 1.70 dB）。双副本 `mix.py` md5 一致（`98ce6abb01f8037e83bbd32f989d26c5`，`check-dual-copy-sync` 通过）。
  - **★ 第 ③ 步的依据（实测，非猜测）**：本片是打击乐极重素材（母带 PLR = TP − I = **12.99 dB**）；`core/render/mux.sh` 的 loudnorm 出口把电平钉在 −14 LUFS（gain = −14 − I ≈ +0.1 dB），于是编码器入口真峰值≈母带 TP，而 **AAC 256k 对这种素材的过冲实测 1.6~2.3 dB**，远超 mux.sh 预留的 0.5 dB 余量（该文件头自己登记「pictogram-motion 要 TP≈−3.2/−4.5 才过，而那时响度已掉出 −14±1」）。用**真实** `core/render/mux.sh`（WSL ffmpeg 6.1.1）逐档扫描 mix.wav 的波峰因子：`PLR 12.99 → 成片 +0.28 dBTP`（超线）· `PLR 10.70 → −1.27 dBTP`（余量仅 0.07 dB，太薄）· **`PLR 9.22（限幅 −6.5 dBFS）→ −2.90 dBTP`**（安全平台区起点）· `PLR 8.61 → −2.77 dBTP`（再压不再变好）。四档的成片响度**恒为 −14.09 LUFS**。⇒ 取 −6.5 dBFS 是把成片真峰值推进安全平台区的**最小**干预；**它解开的正是 mux.sh 登记为「两条交付线无法同时满足」的那个 case**——靠降**波峰因子**，而不是下调 loudnorm 的 TP 目标（后者会掉响度）。
- **帧率降到 24 fps**：风格原生 60 fps（demo 约 9696 帧），成片为 **24 fps / 3878 帧**（2026-10-04 全量重渲后尾垫丢失；**原记** 3926 帧 = 3878 帧 + 48 帧尾垫）；拍点时长不变（视频段 161.58s ≈ EDL 161.6s），但时间采样更粗。注意本次**视频未重渲**——`demo/out/video_gpu.mp4` 仍是修复前那份 3878 帧 / 24 fps 的无声段，只换了音轨。
- **demo 自带的 `mux.sh` 未被编排器采用**：编排器判定其接口不是 `V A O [fps] [grain]`，回退 `core/render/mux.sh`；首次出片因此无 2s 尾垫（`src_frames=out_frames=3878`），音频修复后的重混流则补上了尾垫（成片 163.58s = 161.58 + 2s），说明回退脚本的 `tpad` 分支在「有音轨」时才走到；`noise=c0s=4` 轻颗粒是否与 demo 声明等同仍**未确认**。
- **`.srt` 未重新生成**：编排器未找到它支持的字幕生成器（demo 用的是自带的 `srt.cjs`），成片旁挂的 `.srt` 是**仓库里已提交的旧文件**（内容与样片一致，但非本次产出）。
- **`.srt` 卡片时长与 `edl.js` 的整数拍**一致（1.6s / 0.8s / 3.2s），可作节奏旁证。
- **字幕底衬色为回退值**：目前用风格自身地色/辅色替代（回退原因见第 5 节）；若要完全对齐 demo，需先统一 `palette.subtitle` 与 demo 的 `textColor`。
- **细纹理 `textureRaw: flat` 声明了但渲染未实现**：`lib/dub-styles.json#pictogram-motion.bgRecipe.textureRaw` 是 `flat`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `none` ⇒ 落空（该风格粗粒度没有纹理层）），**不读** `textureRaw` ⇒ `flat` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `flat` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口
- `demo/ref/` 是真实赛事官方参考图，**只作参考、永不入画、不可分发**；任何新片必须**自创 mark、口号、色名**。
- 配乐是**全程序合成**，无采样库；缺 `.venv` / numpy / scipy 环境则整条配乐链跑不通。
- 四款字体（Inter Tight / Noto Sans JP / Noto Sans SC / DM Mono）必须随 demo 复制，缺字重会让 330px / 170px / 92px / 22px 的字号层级塌陷。

### 能力限制
- 纯 Canvas2D 平涂：无 3D、无透视、无景深、无阴影 / 渐变 / 粒子（唯一渐变是日盘上那道扫光）。
- 小人**无脸无表情**，不能承载情绪表演；数字只能是标签 / 编号，**不能做图表**。
- 必须有一个「一拍内读得懂的动作」，纯抽象条目撑不起来。
- 图案画布必须 **LRU 限量（≤10 张）**，并行渲染器下无上限缓存会爆内存（`demo/engine.js:150-156`）。
- **最高可达分**：palette 因成片颗粒 2 ≠ 声明 4 扣 1、audio 只余真峰超限（−2）、rhythm 因 24 fps 而非原生 60 fps（−1）、composition 的 9:16 项已于 2026-10-04 修复（**2026-10-05 已回补 composition +2，总分 95→97**）；若把颗粒按声明给到 4、真峰压回 ≤ −1 dBTP、按 60 fps 渲染、且产品只用 16:9，本风格可到 **≈99/100**；本次实得 **93**（见文末「蒸馏证据」）。

### 踩过的坑（本机实测）
- 出片与配乐**均非本智能体执行**（GPU / Index-TTS 独占，纪律禁止起渲染）；以上数据全部转录自 `_distill/logs/pictogram-motion.log`、`demo/music/report.txt`、`ffprobe` / `ebur128` / `volumedetect` 与逐帧观察。
- 首次出片走 `--skip-sync --no-preflight --ratio 16:9 --skip-audio`，WSL / Windows 双份库**未做同步校验**，且**整条音轨缺失**；配乐链（`export_timeline.cjs` → `music.py` → `mix.wav` → 重混流）由音频链修复任务补齐。★ **2026-10-05**：这条链现在能在**编排器内一键跑通**了——新增 `demo/mix.py` 壳（双副本同步），`node lemo-make.mjs pictogram-motion --ratio 9:16 --skip-sync --out <dir>` 直接走到 `MIX_OK` / `MUX_OK`，不再需要 `--skip-audio`（见第 11 节「走不了编排器音频链」）。
- 环境：Windows Node v22.22.2 + ffmpeg 9.0.2 + WSL Ubuntu-24.04；首轮渲染 37s、混流 90.3s、成片 53.3 MB（静音）；配乐渲染 72s，重混流后成片 163.58s / 58.0 MB。
- 日志里有两条 `!` 告警：①「本 demo 没有本编排器支持的字幕生成器 → `.srt` 沿用旧文件」；②「demo 自带 `mux.sh` 接口不匹配 → 回退 `core/render/mux.sh`」。两条都未阻断出片。
- 逐帧分析所用的抽帧取自**修复前的无声成片**；因视频段未重渲（`out/video_gpu.mp4` 仍是 3878 帧原样），画面结论对修复后的成片**同样成立**。

### 下次迭代优先补什么
1. **把成片真峰从 `+0.3 dBFS` 压回 `≤ −1 dBTP`**：母带是达标的，问题在混流 loudnorm 抬峰——给混流加一级真峰限制（或直接混入已达标的 `music.wav` 而不再做二次 loudnorm）。（口径更正：`+0.3 dBFS` 是 `ebur128` 的 1 位小数读数，真峰值以 `loudnorm input_tp` 4× 过采样 **+0.28 dBTP** 为准） ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 **→ −1.65 dBTP**、已在 −1.2 dBTP 交付线内；本条判语为**修复前**状态，保留作历史。
2. 按 **60 fps** 渲染以对齐 demo 原生，或在文档里明确「24 fps 为产品档」。
3. 给 demo 补一个编排器能识别的 `build.sh` 接口，并在其中把 **grain 4** 写进去——这样颗粒才会走「build.sh」这一级而不是落到默认 2，同时也避免 `mux.sh` 回退与 `.srt` 不重生成（本风格正是「三级全空 → 默认 2」的典型）。
4. ~~若产品需要竖屏，**另做 9:16 版式**（文字栏上、舞台下），不要靠硬渲 16:9。~~ **★ 2026-10-04 已完成多比例支持**：竖屏下整张卡都在框内（页面外壳等比装入，见第 2 节）。若要让竖屏有效画面从 1080×607 提升到整屏，仍需**重排**一版真正的竖版式（文字栏上、舞台下）——那是重排，不是装入。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/pictogram-motion/pictogram-motion.mp4`（161.58s / 61,248,100 B ≈ 58.4 MB / 1920×1080 @ 24 fps / 3878 帧 / 3.03 Mbps / AAC 48kHz 立体声 `I −14.0 LUFS`、`TPK +0.3 dBFS`（该值为 `ebur128` 1 位小数读数；真峰值 = `loudnorm input_tp` 4× 过采样 **+0.28 dBTP**）；全片无黑边；**原记** 2026-10-03 交付版另含 48 帧 = 2.000s 全黑定格尾垫，故为 163.58s / 3926 帧） |
| 抽帧 | `D:/lemo-tools/_distill/frames/pictogram-motion/`（24 帧 `f01`–`f24` + `_contact.jpg` 接触印样，16:9）——canonical 集，取自修复前的无声成片；因视频段未重渲，逐帧内容与最终成片一致。新片抽帧另存 `D:/lemo-tools/_distill/frames/pictogram-motion_163/`（24 fps 下采样落在 `t = k·dur/24`，整体后移 1.2–1.9s，`f15`/`f16` 会落到不同章节，故**不作 canonical**） |
| 风格匹配度自评 | **96/100**（2026-10-05 校正：原 97，新增「textureRaw 细纹理未实现」缺陷，palette −1）（2026-10-05 校正：原 95，9:16 画幅缺陷已修并回补 composition +2）（2026-10-03 校正：原 93，音频真峰值缺陷已修，audio +2） |
| 详细资料 | **有**：`styles/pictogram-motion/STYLE.md`、`styles/pictogram-motion/DEMO.md`（含 `:96` 的 grain 声明）、`styles/pictogram-motion/style.json`、`styles/pictogram-motion/demo/mux.sh`（无 build.sh）、`styles/pictogram-motion/demo/music/report.txt`、`lib/style-dna/pictogram-motion.md` 与 `.json`、`lib/dub-styles.json#pictogram-motion`、`_distill/logs/pictogram-motion.log` |

**逐帧拆解要点**：接触印样一眼看全片色走——`f01` 墨底 + 红点心跳脉冲（片头冷开场，全片唯一一处 `E.oBack`）→ `f02` 五色齐上的满幅图案 + 巨型米白标题「AICHI-NAGOYA 2026」砸下（紫 / 绿 / 红三段图案，中间压一条墨色实带）→ `f03` 绿色满幅图案 + 巨型「16」+ DAYS（数字上冲，本章只有一枚色相）→ `f04`–`f07` 红章田径：A 版式「左文字栏 + 右日盘小人」，标题 `SPRINT` / `STEEPLECHASE` / `LONG & TRIPLE JUMP` / `JAVELIN` 米白压红，第二语言中文在下方，底部一条深红跑道带 + 米白跑道线 + 贴在跑道上的 ghost 规格字（`100M` / `3000MSC` / `800G`）→ `f08` 紫章 B 版式「BUTTERFLY」巨型 ghost 标题铺满、小人横姿游过 → `f09` 金章章节卡「03 BALL GAMES」满幅金图案 + 实色带，金章**深字**（对比规则成立）→ `f10`–`f12` 金章 B 版式（`BALL` / `CRICKET` / `SQUASH`）深色小人压在 ghost 标题上，`f10` 抓到 `cols` 转场中间态 → `f13`–`f15` 赭章 C 版式（`JUDO` / `WRESTLING` / `MMA`）左侧 820px 实色面板 + 细线格 + 20% 透明大号 ghost 编号（`18` / `22`），`f15` 抓到 `flip` 中间态 → `f16`–`f17` 墨章（`ARCHERY` 米白字 + 金弓；`MODERN PENTATHLON` 五环点中一枚填金）→ `f18`–`f19` 绿章（`CANOE` / `TRACK` 米白字）→ `f20` 红章 `KARATE` 撞五色 `flip` 转场 → `f21` 赭章 `SPORT CLIMBING` → `f22` 片尾图标墙（9×5 小格，金 / 赭为主、内嵌红「2026」格与紫格）→ `f23` 米白底红日 + 同心环 mark → `f24` 片尾卡（mark + `AICHI-NAGOYA 2026` + 五色条 + 署名）。**节奏**：接触印样每格都停在完整画面上、无糊帧 / 无溢出 / 无黑边，说明切点干净地落在拍点上；**字幕**：标题恒在左文字栏（B 版铺满），中文大字在其下，四角恒有等宽元信息（`THE 20TH ASIAN GAMES / AICHI-NAGOYA 2026`、`01 / 43 ATHLETICS`），底部刻度条贯穿全宽。

**自检发现的缺陷**：① 成片**真峰超声明上限**（`TPK +0.3 dBFS` / 采样峰 `−0.0 dBFS`，声明为 `≤ −1 dBTP`；该 `TPK` 为 `ebur128` 1 位小数读数，真峰值 = `loudnorm input_tp` 4× 过采样 **+0.28 dBTP**）——响度与画面锁定均达标，唯独这一项越界；② 成片**颗粒 2 ≠ 声明 4**（参数偏离，肉眼损失未定）；③ **24 fps** 而非风格原生 60 fps（视频段未重渲）；④ ~~**9:16 架构缺陷**（无 `aspects`，右 43.75% 会丢）~~ **★ 2026-10-04 已修**（页面外壳等比装入，9:16 下整张卡在框内）；⑤ demo 自带 `mux.sh` 被编排器回退，颗粒因此落到默认 2；⑥ `.srt` 未重新生成。 ★ 2026-10-03：成片真峰值已修（TPK +0.3 dBFS → −1.65 dBTP，音频重混），见第 11 节。

**本次为补齐短板做了什么**：**未改动任何源码**（红线：不改 `lemo-make.mjs`、不改 `D:/lemo-opuscar` 下源码），也未起渲染或 TTS（GPU / Index-TTS 独占）。首轮交付后，音频链缺失这一最大短板由音频链修复任务补齐（重新生成 `music.wav` / `mix.wav` 并重混流，成片从静音 161.58s 变为带配乐 163.58s），本智能体据此回填第 6 / 8 / 9 / 11 节，把 `audio` 从 0 修正为 18、总分 76 → 94。随后在同批风格的**跨文档独立复核**中，采纳 `distill-paper-lantern` 提出的更硬判据（**「档案/构建链有没有声明 grain」而非「有没有叠在纸纹之上」**），复查本风格并**自曝**了颗粒 2 ≠ 声明 4 这条遗漏，palette 20 → 19、总分 94 → **93**。全部结论均可追溯，无编造。
