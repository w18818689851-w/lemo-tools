---
name: lemo-style-urban-sketch
description: 【lemo 风格 Skill · 钢笔淡彩】做旅行游记、城市肖像、生活方式品牌、"我发现的那一刻"这类观察式题材时用；交付「一页户外写生簿——会抖会出头的深褐钢笔线 + 略微错位的透明水彩 + 暖米冷压纸」的手作观感。选定本风格做视频时，优先读本文件。
slug: urban-sketch
name_zh: 钢笔淡彩
category: 手绘与绘画
film: Where the Wind Went
---

# 钢笔淡彩（`urban-sketch`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/urban-sketch/STYLE.md` · `styles/urban-sketch/DEMO.md` · `styles/urban-sketch/demo/build.sh` ·
> `lib/style-dna/urban-sketch.json` · `lib/style-dna/urban-sketch.md` · `lib/dub-styles.json#urban-sketch` ·
> `styles/urban-sketch/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一页在户外几分钟画成的写生簿。**两支笔、两层永远看得出是分开的**：① **墨**——一支 0.3–0.5 mm 的深褐细钢笔（`#2b2520`），线略抖、转角出头几像素、中途断笔，**只暗示不描述**（几笔窗纹代替一整片窗格，扇贝状碎片代替一整圈树冠轮廓）；② **淡彩**——透明水彩罩在上面，**与线错位 1–3 px**、有时溢出线外，高光与人物留成纸白（reserve），干后沿轮廓有一道更深的水痕，颜料沉进纸纹颗粒化（`STYLE.md:14-19`）。**纸本身是画面的一部分**：暖米 `#f5eede` 冷压纸带大尺度斑驳与细牙纹；什么都不画满边——画面碎成叶点大小的斑与白洞，留出页边写字（`STYLE.md:19`）。

**不是什么**（最容易做错的邻居风格）：不是水彩笔触（没有无线的湿画、没有不靠线的画家式边缘）、不是白板（没有马克笔、没有讲解图）、不是水墨（没有毛笔书法、没有单色墨阶）——**线 + 淡彩，两者必须同时在**（`STYLE.md:21`、`style-dna/urban-sketch.md:13`）。

**什么时候用它**：题材天然是「**被观察到的、手作的、当下的**」——旅行日记、城市肖像、一个地方的一天、「我注意到...」、切片生活、小人物轻喜剧（`DEMO.md:24`、`dub-styles.json#urban-sketch.tags`）。样片《Where the Wind Went》（32.4s，**无旁白**）是一片只作为线稿存在的公园，全页唯一有颜色的是**一顶草帽**；一阵风把帽子抢走，**风把帽子带到哪里，哪里就被上色**（`DEMO.md:10-12`）。

**一句话内核**：线先于色、颜色是「到达」、整页只有一个彩色物、页本身就是画框。

**边界**：它撑不起——需要写实立体与照片级材质的内容、快节奏高信息密度的解说（禁讲解图）、多色相并列的图表式内容（墨只有一种颜色、淡彩用色极省）、以及任何需要通用字幕框的场合（**文字必须是被「写」出来的**，`style-dna/urban-sketch.md:56`）。

---

## 2. 画面构图

- **镜头数与画幅**：原生 **16:9 / 1920×1080**（本次出片即 `--ratio 16:9`，`logs/urban-sketch.log:1-2`）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:16`）。**一台 2D 相机在 5120×2880 的整页大纸上移动**（最后拉远到 0.375× 才 1:1 看见整页，`DEMO.md:34`）。
- **主体位置与占比**：**故事节拍上主体至少占画面高 1/3**；关键小物件（帽子）带一圈很淡的纸色 halo（reserve）以便在繁密树冠上读出来（`DEMO.md:37`、`film.js:351`）。
- **负空间 / 留白**：**纸白是最亮的值**，它是留白、靠 `reserve` 抬回纸色，**绝不画**（`STYLE.md:40`）。什么都没画满边——页边碎成色点，空白页边留给手写批注（`STYLE.md:106`）。
- **图层叠放顺序**（从底到顶）：暖米纸（两档 fbm 斑驳 + 512 px 平铺牙纹，乘法叠在一切之上、连人物一起）→ 淡彩（2–3 层噪声边乘法叠色，按「颜色到达时刻」经湿前沿揭示）→ 墨线（按每像素「落笔时刻」回放笔顺）→ 手写文字（写在页上、随相机移动）（`DEMO.md:58`、`engine.js:220-282`）。
- **安全区**：手写批注在**页角**（demo 左上 `Sun. 3:40 pm — windy`，1.55–2.35 s）；片名与版权页在**左下空白页边**（28.2–31.8 s）（`DEMO.md:74-78`）。
- **本风格不能出现的构图**：画到页边（会杀死写生簿感）、用包围盒/矩形裁剪颜色场留下直边或白缺口（要按真实噪声距离与真实阶梯轮廓裁）、把远景人群画成完整骨架（用胡萝卜人）（`STYLE.md:99-100`）。

**在 9:16（产品默认）下的表现**：本风格**已适配 9:16**——`FILM_META.aspects = ['16:9','9:16']`（`film.js:16`），`film.js` 从 canvas（= 视口）尺寸派生 `SW/SH/FX/FY/S = min(fx,fy)`（`film.js:13-14`、`film.js:203-204`），相机 `zoom × S`（`film.js:320`）把整页 5120×2880 按**紧轴**统一缩小、仍居中；属于「当前帧」的只有屏幕中心，取 `SW/2, SH/2`（`film.js:326`），纸纹覆盖范围取 `max(设计余量, 半帧)`（`film.js:358`），`main.js` 让 canvas 跟视口（`main.js:9`）。**世界坐标不再另乘 FX/FY**（相机已折入 S，否则会二次缩放）。1080×1920 实测（`S = 0.5625`）：**不裁切、无黑区**，主体（草帽 / 野餐 / 奔跑）、页角手写 `Sun. 3:40 pm — windy`、片名 `Where the wind went.` 与版权页全部落在画面内；代价是整页被压成**竖向中段的一条横带**、上下各留大片纸色空白（与 `dataviz` 同一取舍），近距离镜头的竖向视野变大、密度变低。与「16:9 中心裁切」的 SSIM 实测 0.58–0.71（≈1 才说明是裁切）⇒ 确为**重排**而非裁切。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 纸（冷压） | `#f5eede` | 暖米纸底（斑驳 fbm 0.0011 / 0.0062 cycles/px，±4.5%） | `DEMO.md:58`、`engine.js:11-12` |
| 墨（唯一） | `#2b2520` | 全片唯一墨色，覆盖约 96%，永不改 | `DEMO.md:59`、`engine.js:11` |
| 叶（由亮到暗） | `#d6d56f` → `#aabf57` → `#7fa04a` → `#56793c` → `#3f5d36` | 树冠叶点（按光向取色） | `DEMO.md:63` |
| 草坪 / 小径 | `#c3c96f` / `#dcd98b`；阴影 `#7f9c52`；路 `#d8ccb1` | 草地与小路 | `DEMO.md:66` |
| 天空 | `#9fbcd6` / `#86a6c8`（10–20% α）；云肚 `#b7b3c9` | 天空大软椭圆、云是留白 | `DEMO.md:64` |
| 建筑 | 石灰石 `#d8c6a0` / 赭 `#cfaa72` / 玻璃 `#98b1c8` / 砖 `#c49a7a` | 建筑局部色 | `DEMO.md:65` |
| 建筑阴影 / 远景 | 混 `#5a5f82`（45%）/ 混雾 `#b9c0cc`（50%） | 阴影侧与远景去饱和 | `DEMO.md:65` |
| 人物阴影 | 混紫 `#464873`（40%） | 人物暗面 | `DEMO.md:67` |
| 强调（唯一彩色物） | 草帽 `#e0b25c` 一族 | 全页唯一带色物件（主角） | 帧 f12/f17/f20、`DEMO.md:28-30` |
| 通路 accent | `#d97757` | dub 通路强调色 | `dub-styles.json#urban-sketch` |

- **明度 / 对比规则**：**墨只有一种颜色，永不改**；**淡彩是局部色、用得很轻**——少数颜料在纸上调开，阴影 = 局部色混向**同一个冷紫**，远景 = 混向**同一片雾**；**纸白是最亮的值**（`STYLE.md:38-40`）。颗粒 = 颜料 × `(0.82 + 0.36·fbm(p·0.21))`（`DEMO.md:61`）。
- **禁止出现的颜色**：第二种墨色、赛璐璐式平涂阴影、饱和的霓虹或高纯度渐变（`STYLE.md:21,38`）。
- **同一画面最多几个色相**：**极省**——一个画面通常只有局部色 + 共享冷紫阴影 + 共享雾。**颜色可以被扣留**：一整页可以是纯线稿，颜色作为一个**事件**到来（一个被点色的物件、一次「有原因」的上色）（`STYLE.md:41`）。样板三套配色：夏日公园（草 `#c3c96f`、叶 `#7fa04a`、天 `#9fbcd6`、石灰石 `#d8c6a0`）、港口清晨（海 `#7fa6b8`、船体 `#c9573f`、缆 `#c8a86b`）、冬日市集（屋顶 `#8b93a6`、灯 `#e2b04a`、篷 `#b8483e`、雪 = 纸）（`STYLE.md:42`）。

---

## 4. 转场规则

- **镜头之间怎么切**：**转场必须来自纸与画本身**——在页面上做镜头移动、翻页、或**颜色到达本身作为转场**（`STYLE.md:75`、`style-dna/urban-sketch.md:112`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有溶解/叠化**（`STYLE.md:75` 明确禁止）。有**颜色 bloom**（从一点以噪声圆 clip 绽开，人物用这个）、**到达场洇开**（世界用这个，带毛边湿前沿 + 暗潮线）、**笔顺画上**（任何「出现」的东西都按真实笔顺一笔笔画出）、**翻页**到新一跨（`DEMO.md:44`、`engine.js:196-214`）。
- **硬切点怎么定**：挂在 **150 BPM 的 3/4 拍网格**上：1 拍 = 0.4s、1 小节 = 1.2s（`film.js:18-19`、`score.py:12`）。关键锚点：手写批注 1.55–2.35、上色 1.8、起风 4.4、阵风 4.6、帽子离头 6.0、触地 8.4、车铃 9.55/9.95、绕灯 10.8、树炸色 12.0/13.2/14.4、到顶 19.2、**静默小节 20.4–21.58**、下坠 21.6、扑 23.55、接住 24.0、点水 24.02、片名 28.2–29.5、版权页 30.1–31.8（`film.js`、`logs/urban-sketch.log:26`）。
- **转场时长与缓动**：**设计好的运动用三次缓动**；**跟拍用临界阻尼弹簧追一个「提前量」目标**，所以镜头像手一样有滞后（demo stiffness 28，坠落段 70，dt 1/240）；冲击推入带 **0.35 s 抖动**（`DEMO.md:35`、`film.js:165-186`）。
- **绝对不要的转场**：溶解/叠化、划像等 UI 式转场、任何元素的淡入/滑入——**颜色只能从一点 bloom 或经到达场洇开，绝不 snap**、无来由的运镜（`style-dna/urban-sketch.md:114`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **全部文字都是写在页面上的手写体**——页角批注 Reenie Beanie、标题与版权页 Caveat 500–600（`STYLE.md:46`、`DEMO.md:74`）；本机无这两款，通路回退 **KaiTi**（`dub-styles.json#urban-sketch`） |
| 字号（相对画面宽 / 高） | 片名 **190 px**（`DEMO.md:78`）；通路 `fontSizeFactor 0.03704`（≈40 px）、`title.fontSizeFactor 0.086`（`dub-styles.json#urban-sketch`） |
| 颜色 / 描边 / 阴影 | 墨色 `#231c1a` 手写；通路 `subtitleOutline #FFFFFF`、`outlineFactor 0.00278`；`subtitleBack #00000000`（无底衬） |
| 位置 / 安全边距 | **写进页边**：批注在页角、片名与版权页在**左下空白页边**；通路 `marginVFactor 0.14537`、`marginLFactor 0.07963`（类别 paper-ink 默认：下边距 157 px / 左边距 76 px） |
| 单行字数上限 / 最多行数 | 单行 ≤ 约 **28 个汉字**；demo 3 条实测 22 / 19 / 79 字符（批注 `Sun. 3:40 pm — windy`、片名 `Where the wind went.`、版权页两行）（`style-dna/urban-sketch.md:43`、`subs.json`） |
| 出现与消失方式 | **写出来**（左到右 reveal + 笔声），**不是**淡入/滑入；通路 `motion.subtitleFadeIn 0`；停留 ≥ `max(1.8s, 语音时长 + 0.6s)`（`STYLE.md:47`） |

- **字幕与旁白的关系**：**本风格可以完全无旁白**——demo 就没有（`DEMO.md:5`、`logs/urban-sketch.log:36`）。若有旁白，字幕是**页边或下缘手写栏里的一行手写字**，**绝不套通用字幕框**（`STYLE.md:47`）。所有文字**留在世界里、随相机移动**，永远不是 overlay（`DEMO.md:76`）。
- **本风格特有的字幕禁忌**：不要通用字幕框、不要淡入/滑入的字幕条（文字必须被**写**出来）；不要营销口播腔与感叹号堆叠；不要抽象概念当主语（只谈能被画出来的实物、位置、天气）；一句只承担一层信息（`style-dna/urban-sketch.md:52-56`）。

---

## 6. BGM / 音效特征

- **配乐**：**150 BPM、F 调的 3/4 爵士华尔兹**（`score.py:1-2`）——Sneakybass 走三拍、合成刷子 + 踩镲、立式钢琴落在第 2–3 拍、单簧管主奏；弱音小号给城市段、拨弦固定音型、颤音琴与马林巴在树炸色处点彩；到顶处一个漂浮的 **D♭maj7♯11**，随后**整整一小节真静默**，静默后第一个声音是单簧管半音下行 + 定音鼓（`DEMO.md:51`）。可选家族：咖啡馆手风琴三重奏、独奏尼龙吉他、弦乐四重奏拨弦、铜管乐队（人群）——**一个区域一个色彩乐器**（`STYLE.md:83`）。本次 6 个音乐 stem：melody / bass / piano / drums / strings / color（`logs/urban-sketch.log:38`）。
- **拟音（foley）清单**：**纸上的钢笔**——带通噪声（约 **1.6–7.5 kHz**）+ 纤维幅度纹理 + 纸纤维颗粒，**每道真实笔触一声**（`STROKES[]` 把世界每一笔导出给拟音，所以笔声永远与画面同步），成千上万道叠成一片沙沙、快画时像踩镲，天际线笔画更亮读成 hi-hat；湿画洇开的「shhh」；风（带通布朗噪声，**J-cut 从右声道进来**）；草帽翻飞是纸质拍打（速率 `9+min(14, speed/120)` Hz、响度跟速度、**声像跟屏幕 x**）；脚步（草/石，落在拍上）、扑空、起跳、扑接的「啪」、点水 plop；车铃 **1760 Hz** + 2.76/5.4 分音（`DEMO.md:50`、`STYLE.md:80-82`）。环境三层：纸面房间音 → 公园鸟鸣（颜色到达后）→ 城市低鸣（天际线前一小节 J-cut 进来）（`DEMO.md:49`）。本次 6 个拟音 stem：pen / wash / wind / hat / body / amb（`logs/urban-sketch.log:41`）。
- **旁白处理**：本 demo **无旁白**。若有，音乐在人声下 duck；demo 里音乐给关键拟音让路——接住 24.0 s 压到 0.55、触地 8.4 s 压到 0.8、路灯 11.9 s 压到 0.85（`DEMO.md:52`、`mix.py:25-29`）。
- **响度目标**：`-14 LUFS`；**真峰值上限**：本次实测 **-1.5 dBFS**（达标 ≤ −1.2 dBTP，`logs/urban-sketch.log:122-125`）。★ 口径更正：上述 `-1.5 dBFS` 是 `ebur128` 的 1 位小数读数、口径不同，不能当真峰值引用；**成片真峰值 = `loudnorm` 的 `input_tp`，4× 过采样 = −1.54 dBTP**。总混 = `music×0.9 + foley`，60 Hz 以下轻切、峰值限 0.95；拟音整体高通 **90 Hz**（`style-dna/urban-sketch.md:140`）。
- **静音策略**：**静默是工具**——到顶（19.2 s）之后留**整整一小节真静默**（20.4–21.58 s），连环境底噪都收掉，只留纸面房间音，**静默期间画面里没有风**；实测静音窗 dBFS **−52.5**（`style-dna/urban-sketch.md:89`、`logs/urban-sketch.log:61,72`）。静默后的第一个声音就是下一个动作。

---

## 7. 素材偏好

- **需要什么素材**：**几乎全部在代码里程序化生成**，不依赖实拍/图库。需要——`engine.js` 的钢笔/淡彩/叶点/到达场/GL 合成器/人物骨架/帽子/自行车/手写/`sketchShape`；`world.js` 的静态页（天空、天际线按笔顺的墨线、树、草坪、小径、路灯、池塘、桥、人群、页边碎点）；`poses.js` 的造型表与姿势库；`film.js` 的时间线（帽子轨迹、相机、表演、颜色源、声音 cue）（`STYLE.md:110`、`DEMO.md:83-89`）。
- **不需要什么素材**：真实照片、通用字幕框、讲解图/示意图（那是白板）、无线的湿画水彩（`STYLE.md:21`）。
- **取景 / 质感 / 比例偏好**：纸的暖、墨的干、水彩刚干时的凉；**确定性**——同 seed → 同笔触，可逐帧离线渲染（`STYLE.md:34`、`style-dna/urban-sketch.md:132`）。人物是**正交投影的 3D 骨架**（躯干由横截面生成、四肢为有机锥形管、头发与头是一整块、**脸留空**只在侧脸画一笔鼻子）（`DEMO.md:67`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有复杂场景就用 `sketchShape(ctx, poly, col, {ink, wash, offset, color, p})` **一句话把任意闭合多边形画成「钢笔淡彩」**（`DEMO.md:120`）；缺手写字体时用楷体顶替 Reenie Beanie / Caveat 并保持「写在页上 + 左到右 reveal」，**不要引入黑体或圆体**；远景人群一律用**胡萝卜人**（一块色块 + 两条腿线 + 一个头点）降级（`STYLE.md:95`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 无固定区间，由故事决定；demo 用推、拉、弹簧横移跟拍、摇臂升起、甩摇 + 轻微侧滚、冲击推入 + 0.35 s 抖动、长拉远、倾入页边（`DEMO.md:36`） |
| 全片时长 | 32.4s（`style.json:17`、`film.js:18-19`）；本次成片 **32.42s / 778 帧**（视频实际 32.413411 s，音频 32.400 s 被补静音到 32.455 s，`logs/urban-sketch.log:113,127`） |
| 镜头数 | 单页速写；事件 **36** 条、字幕 **3** 条（`logs/urban-sketch.log:26`、`subs.json`） |
| 信息投放节拍 | 空白页 + 手写日期 → 钢笔按真实笔顺把主体一笔笔画出（线先于色）→ 颜色作为「到达」从源头洇开 → N 个被颜色点到的细节 → 到顶 / 静默 → 颜色扩散或收束 → 拉远成整页 → 收（`style-dna/urban-sketch.md:64-73`） |

- **加速 / 减速点**：**人物以 12 fps 抖（boil）**——线抖与淡彩 seed 每 1/12 s 换一次；**静态的页不抖**（它是一张真纸）；**相机每帧平滑移动**（`STYLE.md:52`、`film.js:179-197`）。跑步循环两拍一步（`ph=(t-6.95)·TAU/(BEAT·2)`），每一步落在拍上（`style-dna/urban-sketch.md:79`）。**风被画出来**：每拍生一道「~@」形墨线，0.4 s 画出、再从尾巴擦掉（`DEMO.md:43`）。
- **留白与静音的位置**：静默小节落在 20.4–21.58 s（到顶之后、下坠之前）；开场 0–2.4 s **只有笔声**且推大（`style-dna/urban-sketch.md:85,140`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/urban-sketch/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs $D --fps 24 --workers 4 --out $D/out/video24.mp4`（`build.sh:11`）；本次编排器实跑为 `--workers 6 --size 1920x1080`（`logs/urban-sketch.log:35`） |
| 帧率 | 24 fps（778 帧 = 32.4s；画面内人物分级 12 fps，`logs/urban-sketch.log:113`、`STYLE.md:52`） |
| 分辨率 / 比例 | 原生 1920×1080 / 16:9（`logs/urban-sketch.log:2`）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:16`），由 `film.js` 按 canvas/视口尺寸派生 `SW/SH/FX/FY/S` 重排（`film.js:203-204`）：相机 `zoom × S`（`film.js:320`）、屏幕中心取 `SW/2, SH/2`（`film.js:326`）、纸纹覆盖整帧（`film.js:358`）；16:9 时 `fx=fy=S=1` 逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh $D/out/video24.mp4 $D/audio/mix.wav styles/urban-sketch/urban-sketch.mp4 24 2`（−14 LUFS / **颗粒 2**，`build.sh:12`） |
| 编码器 | `h264_nvenc`（本地 GPU；本次 `nvenc`，`logs/urban-sketch.log:7`） |
| 音频入口 | `demo/audio/score.py`（150 BPM 3/4 爵士华尔兹）+ `demo/audio/foley.py`（全程序化拟音）+ `demo/audio/mix.py`（混音与静默 gate） |
| 字幕入口 | `node $D/tools/export_cues.mjs`（导 `subs.json`）+ `core/render/srt.py $D/subs.json styles/urban-sketch/urban-sketch.srt`（`build.sh:7,13`） |
| 事件导出 | `node core/render/events.mjs $D`（本次 events 36 dur 32.4，`build.sh:6`、`logs/urban-sketch.log:26`） |
| 本风格专属参数 | 静帧调试 `node core/render/still.mjs styles/urban-sketch/demo 0`（`logs/urban-sketch.log:76`）；无 `--q` 专属开关 |
| 一键复现 | `sh styles/urban-sketch/demo/build.sh`（8 步：events → cues → 配乐 → 拟音 → 混音 → 渲染 778 帧 → mux → srt，`build.sh:1-14`） |
| 本次编排器调用 | `node lemo-make.mjs urban-sketch --skip-sync --no-preflight --ratio 16:9`（`logs/urban-sketch.log:1`） |

**★ 关于本风格的入口差异（重要）**：本 demo **没有 `lines.json`**，只有 `events.json`（36 条）。因此编排器在第 3 步明确跳过 TTS 与 whisper（`[配音] 该 demo 无 lines.json，跳过`，`logs/urban-sketch.log:36`），并在第 4 步对字幕生成器报警：**本编排器不支持该 demo 的字幕生成器**，`.srt` 沿用仓库里已提交的旧文件、未重新生成（`logs/urban-sketch.log:29,119`）。字幕时间线来自 `demo/subs.json`（3 条），由 `tools/export_cues.mjs` 产出；**音频链路没有旁白轨**。换主题时若要加旁白，需自建 `lines.json` 并确认编排器能否识别你的字幕生成器。

---

## 10. 编排规则

- **内容文件字段契约**：`film.js` 是**唯一时间真值**，导出 `BPM/BEAT/BAR/DUR`（demo `BPM=150`、`DUR=32.4`，`film.js:18-19`）与页面契约 `window.render(t)` / `window.DUR` / `window.EV` / `window.TRACK` / `window.STROKES`，并置 `window.READY=true`（`style-dna/urban-sketch.md:198`）。内容侧字段：`title`（片名，手写）、`note`（页角批注：日期 + 天气 + 地点）、`credits[]`（版权页几行）、`colors[]`（每个色块的 `[r,g,b]`）、`sources[]`（颜色到达源 `{x,y,t,v,R,sy,mask}`）、`EV[]`（声音事件）、`STROKES[]`（世界每一笔 `[t0,dur,L,group]`，供拟音逐笔发声）、`TRACK()`（帽子轨迹 `[t,速度,屏幕x][]`，供翻飞声）（`style-dna/urban-sketch.md:175-184`）。`render(t)` 里先 `comp(cam,t)` 合成整页，再按世界坐标 `setTransform` 画动态层，**人物按 y 深度从远到近排序**（`style-dna/urban-sketch.md:199`）。
- **事件词汇表**：`hatColor`（唯一彩色物上色）/ `windIn` / `gust` / `hatLift` / `bounce` / `miss` / `jump` / `bell` / `lampSpin` / `tree`（树炸色）/ `apex`（到顶）/ `silence` / `fall` / `dive` / `catch` / `splash` / `step{surf}`（`grass`|`stone`）/ `writeTitle{d}` / `writeCredits{d}` / `writeNote{d}`（`style-dna/urban-sketch.md:203-219`）。全部由 `film.js` 里 `EV.push` 产生，再经 `core/render/events.mjs` 序列化成 `events.json`（本次 36 条）。
- **时间线契约**：`film.js` 导出上表并置 `window.READY`；`world.js` 建静态页；`film.js` 管时间线（帽子轨迹、相机、表演、颜色源、声音 cue）（`style-dna/urban-sketch.md:228-234`）。**关键机制**：颜色到达场（`arrivalField`）把「上色」变成一个**可被事件驱动**的量——任何「颜色该在什么时候到哪」的故事都能复用同一套引擎；`STROKES` 把世界里的每一笔导出给拟音，所以笔声永远与画面同步（`style-dna/urban-sketch.md:238`）。
- **新增主体怎么接入**：新主体是 `engine.js` 里的一个函数或一支笔触库，必须能返回 `drawPrims` 认得的图元列表——`k='knock'`（纸色遮挡 poly）/ `k='wash'`（淡彩 poly + col + a + dx/dy 错位）/ `k='ink'`（墨线 `st = penStroke(...)`）/ `k='fn'`（自定义）；`sketchShape(ctx, poly, col, {ink, wash, offset, color, p})` 可一句话把任意闭合多边形画成「钢笔淡彩」。新角色造型放进 `poses.js` 的 `LOOK` 表，新姿势用 `V(x,y,z)` 身体坐标写（`style-dna/urban-sketch.md:186-194`）。
- **换主题时要改哪些文件**：① `demo/film.js`（`BPM/BEAT/BAR/DUR`、帽子轨迹、相机、表演、颜色源、`EV` / `TRACK` / `STROKES`）；② `demo/world.js`（静态页：天空、天际线、树、草坪、小径、路灯、池塘、桥、人群、页边碎点）；③ `demo/poses.js`（`LOOK` 造型表与姿势库）；④ `demo/engine.js` 的 `PAL`/`INK`/`PAPER` 与 `LEAF` 调色板；⑤ `demo/subs.json`（手写批注/片名/版权页文案与时刻）。音频改 `demo/audio/score.py` / `foley.py` / `mix.py`。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里可生效的参数有 `palette`（bg `#f5eede` / bg2 `#9fbcd6` / fg `#231c1a` / accent `#d97757` / subtitle `#231c1a` / subtitleOutline `#FFFFFF` / subtitleBack `#00000000`）、`bgRecipe`（type=gradient、stops `#f5eede`→`#9fbcd6`、texture **paper**、vignette 0.08、textureRaw `pen-wash`）、`subtitle`（**KaiTi** / 0.03704 / 0.14537 / 0.07963 / outline 0.00278 / bold false / align 2）、`title.fontSizeFactor 0.086`、`motion.subtitleFadeIn 0`、`motion.chapterTransition cut`、`overlay` 全关（`dub-styles.json#urban-sketch`）。**注意**：这是 `derived:true` 的派生条目，字幕字号/位置取自类别默认（paper-ink：40px / 下边距 157px / 左边距 76px），非 demo 逐行手抽；通路不承载「手写 reveal + 页边」这一核心形态，只给一个楷体字幕位。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **编排器不认本 demo 的字幕生成器**：第 3 步报警「本编排器不支持该 demo 的字幕生成器」，`.srt` **沿用仓库里已提交的旧文件、未重新生成**（`logs/urban-sketch.log:29,119`）。字幕时间线真值是 `demo/subs.json`（3 条），换主题后 `.srt` 不会自动更新。 ★ 2026-10-06 复核：编排器第 3 步字幕告警措辞已改（第五十三批，md5 65ddab44→dfa99004）——『告警误导』部分已消解；但**本条主张的是「`.srt` 真旧」**：本 demo 无编排器认得的 srt 生成器，`demo/subs.json` 为静态文件、`tools/export_cues.mjs` 只写 `audio/cues.json`（不在第 6 步「本次新写出的字幕源」候选里）⇒ 第 6 步混流同样不重生成，成片旁挂的 `D:/lemo-films/urban-sketch/urban-sketch.srt`（221 B）与仓库旧文件同源 ⇒ **本条不消解、仍成立**，评分不变。
- **字体回退**：demo 全片文字是手写体（Reenie Beanie + Caveat 500–600），本机无这两款，通路回退 **KaiTi**（楷体），手写感有损（`dub-styles.json#urban-sketch.notes`）。
- **静帧生成超时告警**：本次出片日志里 `still.mjs` 反复报 `still waiting for window.READY after 20 s`（共 7 次，`logs/urban-sketch.log:74-94`），说明页面在 headless 下未及时置 `window.READY`；本次成片渲染最终完成，但**海报/风格帧步骤可能未产出**。
- **音视频时长微差**：视频 32.413411 s 长于音频 32.400 s，mux 补静音到 32.455 s 以免 `-shortest` 切掉最后一帧（`logs/urban-sketch.log:127`）；成片时长按 32.42 s 记。
- **9:16 曾不适配（★ 2026-10-04 已修）**：原记「无 `aspects` 声明，只按 1920×1080 绝对像素构图，硬渲 9:16 会丢失右侧约 43.75% 并留下方黑区」。**2026-10-04** 已改造 `styles/urban-sketch/demo/`：`film.js` 导出 `NATIVE` 并声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:13,16`），由 canvas（= 视口）尺寸派生 `SW/SH/FX/FY/S`（`film.js:203-204`），相机 `zoom × S`（`film.js:320`）、屏幕中心取 `SW/2, SH/2`（`film.js:326`）、纸纹覆盖整帧（`film.js:358`），`main.js` 让 canvas 跟视口（`main.js:9`）。**16:9 逐字节未变**（`fx=fy=S=1` 时每个表达式退化成它替换掉的那个数字，三帧 md5 与改造前完全一致）；9:16 实测不裁切、主体与页边手写全部在画面内（见第 2 节）。
- **细纹理 `textureRaw: pen-wash` 声明了但渲染未实现**：`lib/dub-styles.json#urban-sketch.bgRecipe.textureRaw` 是 `pen-wash`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `paper` ⇒ 纸纹噪点（`noise=alls=9:allf=t+u`）），**不读** `textureRaw` ⇒ `pen-wash` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `pen-wash` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口
- 无外部实拍/图库依赖（几乎全部代码生成；配乐/拟音采样是 CC0，本次用 Karoryfer / Versilian 系列，`logs/urban-sketch.log:39`）。真正的缺口是 **Reenie Beanie / Caveat 手写字体文件**（需装进 `demo/fonts/`）与**新主题的世界资产**（不能沿用《Where the Wind Went》的公园、草帽、桥）。

### 能力限制
- 骨架不可拆：**线 + 淡彩两者必须同时在**，且**什么都没画满边**（`STYLE.md:19,21`），因此撑不起满版实拍质感、写实光影、高密度信息图。
- 墨只有一种颜色，天然不支持「用颜色区分多个并列品类」。
- 颜色只能「到达」，不能 snap，快切式信息投放与它相性差。

### 踩过的坑（本机实测，`DEMO.md:95-101`）
- **颜色场出现直边**：源的包围盒忽略了纵向拉伸（`sy`），超出半径的慢渗被方框裁掉 → **按真实（噪声）距离裁，不用 bbox**。
- **退台高塔周围出现白色缺口**：矩形遮罩留下的 → **用真实的阶梯轮廓**（分段、尖顶、金字塔顶、水箱）遮罩。
- **角色跑进未上色区就掉色** → 到达时刻**只在角色起点采样一次**（或绑定到给它上色的事件），**绝不在当前位置采样**。
- **静态墨线无法被后来的淡彩遮挡** → 远景人群改用**胡萝卜人**；建筑墨线在画更近的建筑与树冠之前**先擦掉**。
- **混合坐→站姿势时 IK 脚被钉住导致劈腿** → 把脚的目标**混向胯下位置**。
- **正面脸画成秃头** → 总是**先画头发整块，再从下半部擦出脸**。
- **大画布在 headless Chrome 里**：5120² 的墨/时刻/颜色/页面画布没问题，但要**自己把墨与时刻打包成 RGBA 字节纹理**（`getImageData`），并把到达场以 **`R16F`（可滤波）** 上传。

### 下次迭代优先补什么
- 把 Reenie Beanie / Caveat 装进 `demo/fonts/`，消除字体回退。
- 修 `window.READY` 超时（仍报 20 s 超时）以恢复海报/风格帧产出。
- 给本 demo 接一个编排器认得的字幕生成器（或把 `subs.json` 纳入编排器），让 `.srt` 能随主题自动重建。
- **（已完成 2026-10-04）** 9:16 适配：已给 `film.js` 补 `FILM_META.aspects = ['16:9','9:16']`（`film.js:16`）并由 `film.js` 按 canvas/视口尺寸重排版面（相机 `zoom × S`，`film.js:320`）。★ 声明落在影片模块 `film.js` 的 `FILM_META`，**不是 `style.json`**——探测方 `lib/aspects.mjs` 读的就是 `film.js` 源码文本。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/urban-sketch/urban-sketch.mp4`（32.42s / 33.4MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/urban-sketch/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **90/100**（2026-10-05 校正：原 91，新增「textureRaw 细纹理未实现」缺陷，palette −1）（2026-10-05 校正：原 90，9:16 画幅缺陷已修并回补 composition +1） |
| 详细资料 | 有（STYLE.md / DEMO.md / style.json / build.sh / style-dna .md+.json / dub-styles.json#urban-sketch / demo 源码 engine.js+world.js+poses.js+film.js+audio / subs.json / events.json / 出片日志） |

**逐帧拆解要点**：f01 **近乎空白的一页暖米纸**——只有一处刚起笔的钢笔线（一个坐着的人）与页角手写批注 `Sun. 3:40 pm — windy`（开场「线先于色」，只有笔声）；f06 野餐场景——**颜色作为「到达」**从一块噪声边的绿斑洇开，人物仍是定格线稿，周围大片留白；f12 天际线——淡彩云与建筑已到、**草帽是全页唯一带色的物件**（在天空中部偏右）；f17 摩天楼段——建筑线稿 + 冷紫阴影、**风的墨线「~@」curl 在天上画出**、草帽在楼间飘；f20 接住——女孩举起帽子（24.0 s 全奏），草坪绿色淡彩、石桥、池塘；f22 **拉远到整页**——整张速写（草坪、树、天际线、小路、人群）露出，页边碎成色点，左下页边开始手写片名 `Where the w...`；f24 **片尾卡**——左下页边 Caveat 手写 `Where the wind went.` + 版权页 `Urban Sketch · Pen & Wash — a Lemo-Opuscar style` / `LemoLab × Claude Opus 5.5` / 采样与字体 credits，纸边碎成白洞与彩点。**配色无推移**（墨单色不变），靠**颜色到达的范围**（从一块绿斑 → 整页上色）与**拉远的尺度**制造起伏；转场全是颜色 bloom / 到达场洇开 / 笔顺画上 / 拉远，**无叠化**。**无瑕疵帧**（无糊、闪、错位、字幕溢出）；页边碎点与留白是刻意设计，不是黑边。

**自检发现的缺陷**：编排器不认本 demo 字幕生成器（`.srt` 未重建）；字体回退 KaiTi（demo 是 Reenie Beanie / Caveat）；`still.mjs` 报 `window.READY` 20 s 超时 7 次（海报/风格帧可能未产出）；音视频时长微差需补静音；无 9:16 适配（★ 2026-10-04 已修：`FILM_META.aspects` + 相机 `zoom × S` 重排，见第 2、11 节）。

**本次为补齐短板做了什么**：★ 2026-10-04 改造 `D:/lemo-opuscar/styles/urban-sketch/demo/`（`film.js` + `main.js`）使其支持 9:16，并同步 WSL 副本；16:9 三帧逐字节未变，9:16 实测不裁切（详见第 2、11 节）。其余短板（字幕生成器、字体回退、`window.READY` 超时、时长微差）如实记录在第 11 节，留给后续迭代。
