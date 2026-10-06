---
name: lemo-style-woodcut
description: 【lemo 风格 Skill · 木刻版画】做民间传说、工艺/匠人品牌溯源、绘本与书预告（40–60s）时用；交付「每一镜都是一块黑木板、光只存在于刀刻掉的地方、最多一种颜色只给那个在燃烧的东西、图像是被一刀刀刻出来的」的沉、耐心、手工观感。选定本风格做视频时，优先读本文件。
slug: woodcut
name_zh: 木刻版画
category: 印刷与版画
film: The Bell Founder
---

# 木刻版画（`woodcut`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/woodcut/STYLE.md` · `styles/woodcut/DEMO.md` · `styles/woodcut/demo/build.sh` ·
> `styles/woodcut/demo/tools/mux.sh` · `lib/style-dna/woodcut.json` · `lib/style-dna/woodcut.md` ·
> `lib/dub-styles.json#woodcut` · `styles/woodcut/style.json` · demo 源码（`engine/` / `shots.js` / `shots2.js` / `mix.py` / `music/score.py`） · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部「版自己刻出来」的**凸版印刷**片。每一镜都是**一块黑木板**——黑墨印在手工帘纹纸上，四周留一圈纸边（`STYLE.md:8`）。三条不可让步的硬规则：① **黑是木、白是刀刻掉的**——亮部是许多宽刻，暗部是没动过的木头，光是被「刻」出来的；② **图像是被刻出来的**——没有任何东西淡入，刻痕沿着形体一刀刀长出来，先粗凿后细线；③ **版是镜像**——字母在被揭起之前是反的，这次反转本身就是风格的转场（`STYLE.md:10-12`、`style-dna/woodcut.md:11`）。此外还有一条颜色铁律：**最多一块色版**，且只印在刻白处，所以它从刻痕里发光、绝不落在黑上，只给那个「在燃烧」的东西（`STYLE.md:36`）。

**不是什么**（最容易做错的邻居风格）：不是铜版画（没有白底上鼓胀的雕线、不是从白地垒起的交叉线，`engraving`）、不是亚麻油毡海报（没有平涂色块，`linocut`）、不是把黑白照片跑一遍阈值滤镜（**刻痕必须顺着形体走**）（`STYLE.md:14`）。

**什么时候用它**：民间传说与寓言、匠人 / 工艺品牌溯源、绘本与书预告（`style.json:11-15` 的 `uses` 是 Folk tales / Craft brands / Book trailers）。样片《The Bell Founder》讲「村子用一整个冬天铸一口钟，钟声第一次响起，雪停了」（`style.json:9-10`）。

**一句话内核**：一位沉默的雕版师讲一个民间传说——**刀就是镜头**，纸边永远不动，图像一刀刀被刻出来，唯一的颜色只给熔铜，最后钟声一响，雪停下来听。

**边界**：它**撑不起**——快节奏、强情绪外放、真人出镜、实拍、现代扁平 UI，以及需要「一次讲很多并列信息」的密集片（一句只承担一层，`style-dna/woodcut.md:52`）。它是**慢**的：`DEMO.md:8` 记录该 demo 是照「**40–60 秒**的木刻版画片」这个 brief 做的，样片 58.5s（`style.json:17`）。

---

## 2. 画面构图

- **镜头数与画幅**：原生 **16:9 / 1920×1080**；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:16`）。**印框**：画面区 `36, 36, 1848×912`，四周留纸边，**底边 132px 纸边放图注**（`DEMO.md:60`、`style-dna/woodcut.md:24`）。**画面边缘 = 版边**：墨迹毛糙、有崩口，**绝不是干净矩形**（`STYLE.md:18`）。
- **主体位置与占比**：主体是**黑剪影 + 白刀晕**，压在刻白的纸面上；形体只在受光边做掠射排线（光 z ≈ 0.2，平面保持黑）（`STYLE.md:29`）。构图上要么**黑块压白**、要么**白压未刻的黑**，**绝不允许灰对灰**（`STYLE.md:71`）。
- **负空间 / 留白**：白不是「填白」，是**被刀刻掉的地方**；纸边是唯一始终不动的留白（`STYLE.md:53`）。底边纸边同时是字幕带。
- **图层叠放顺序**（从底到顶）：暖米色纸（带木纹/纸纹）→ **掩膜**（黑 = 未刻的版，白 = 刻掉）→ 可选**唯一色版**（alpha = 色版密度，只在掩膜刻白处显色）→ WebGL2 印刷合成器（刀口毛刺、±6% 上墨不匀、木纹条痕、没吃上墨的斑点、**固定 3px 色版套印错位**）→ 纸边里的活字图注（`STYLE.md:31`、`DEMO.md:60`、`engine/print.js:11-101`）。block 模式（只在展示版本身时）：着墨的有光泽木面 + 纹理反光，凹槽里是浅色木 `#D8C29C`。
- **安全区**：图注**只能活在纸边里**、绝不压画面；纸边（含底边 132px）是安全区，任何元素都不许侵入或移动它（`style-dna/woodcut.md:96`）。
- **本风格不能出现的构图**：**灰对灰**；把文字放进画面里（文字只能在纸边）；让纸边动；白刻白（白记号刻在白色区域上看不见，stab 刀痕背后必须有暗块）（`STYLE.md:97`）。

**在 9:16（产品默认）下的表现**：本风格**已适配 9:16**——`FILM_META.aspects = ['16:9','9:16']`（`film.js:16`），`stage.js` 导出 `NATIVE`（`stage.js:12`）与 `setFrame(w,h)`（`stage.js:21`），由 `main.js` 按视口尺寸调用（`main.js:14-15`）派生 `W/H/FX/FY/S = min(fx,fy)`（`stage.js:22`）。两条独立的轴：① **印框（纸边 + 底边字幕栏）按轴拉伸铺满整帧**——`IMG.x=36*FX / y=36*FY / w=1848*FX / h=912*FY`（`stage.js:23`，`IMG` 是可变字段，`shots.js`/`shots2.js` 加载期已解构，所以只改字段不换对象），掩膜/彩版画布与打印机也跟着帧走（`stage.js:24-25`）；② **相机 `z = cam.z × S`**（`stage.js:30`）把整块木刻版（`PW×PH`）按**紧轴**等比缩小、仍居中（`ox/oy = IMG 中心`，`stage.js:31`）——木刻版本身不拉伸（刻痕是刻在硬木上的，拉伸会毁掉刀痕），缩小的后果是版外多出「未刻之墨」的暗边，与画面顶部的夜空 / 底部前景同色，接得上。图注是**当前帧**的家什：位置随 `IMG`（底边字幕栏）走、字号 `44×S`（`stage.js:55`）——否则 9:16 上一行字比画面还宽。1080×1920 实测（`S = 0.5625`）：**不裁切、无黑区**，四边纸白与底边字幕栏铺满画面，**底边纸边里的全部图注（本风格唯一的文字载体）完整可见、居中不溢出**（实测 t=12.0 帧字幕「That winter, the snow closed every road, and the tower had no bell.」整句可读）；代价是整块版按紧轴缩小、横向密度变低。与「16:9 中心裁切」的 SSIM 实测 **0.57–0.61**（`≈1` 才说明是裁切）⇒ 确为**重排**而非裁切。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 墨（近黑） | `#111111` | 唯一的「黑」——未刻的木、黑剪影 | `DEMO.md:59`、`engine/index.js:16` |
| 纸（暖白） | `#EFE8D8` | 手工帘纹纸、纸边、刻白处 | `DEMO.md:59`、`engine/index.js:16` |
| 木（版身） | `#D8C29C` | **只在展示版本身**的镜头出现（浅色凹槽） | `DEMO.md:59`、`engine/index.js:16` |
| 色版·铜 | `#C8502A` | **唯一的一块色版**（熔铜 / 热） | `DEMO.md:59`、`engine/index.js:16` |
| 图注墨 | `#111` | 纸边里的活字 | `DEMO.md:62` |
| 通路 accent | `#A24122` | 通路派生代理色（比 `#C8502A` 更暗） | `dub-styles.json#woodcut` |

- **明度 / 对比规则**：**只有两个值**——近黑墨 + 暖纸白；所有中间调由**刻痕宽度**构成（亮 = 宽刻几乎连成白、中间调 = 细刻、暗 = 不刻），**永远不用灰**（`STYLE.md:28`）。色版**只印在刻白处**，所以它从刻痕里发光；色版压在黑墨上几乎看不见，规划时必须把它安排在刻白区（`STYLE.md:36`）。
- **禁止出现的颜色**：任何灰（灰对灰是禁忌）；平涂色块（那是油毡海报）；第二种彩色（**至多一块色版**）；不透明色上到图注/纸边。
- **同一画面最多几个色相**：**墨 + 纸两值 + 至多一种彩色**。这块彩色是**叙事工具**：它可以在高潮时铺满画面，之后收缩成一个高光（样片里铜色从整个山谷收进钟里）；它**永远不是装饰**（`STYLE.md:37`、`shots2.js:414-435`）。

---

## 4. 转场规则

- **镜头之间怎么切**：只有两种转场——**硬切 = 一次新印张**（两帧套印错位，`DEMO.md:46` 记录的 jolt 是 `[5,−3]` 再 `[−2,1]` px，之后归位），以及**揭纸转场（the peel，本风格唯一的连续转场语法）**：滚筒滚墨（一道湿亮横扫）→ 纸落下 → 马楝螺旋擦、图像透过来 → 纸沿一个圆柱朝镜头掀起、先重后快，背面透出镜像的 show-through（`STYLE.md:52`、`trans.js:10-67`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有溶解、没有划像、没有闪白**。图像**不许淡入/滑入**——只能被「刻」出来；每根线有自己的起始时间与速度（**0.08–0.35s**），揭示键可选 `light`（亮部先刻、粗到细）/ `radial`（从一点：放射光、浇注）/ `down` 或任意函数（`STYLE.md:50`）。
- **硬切点怎么定**：挂在**节奏网格**上，`timeline.json` 是**唯一真源**。样片：0–3s 自由无乐；3–23s = **60 BPM**；23–32.3333s = **90 BPM**（经 **3:2 度量调制**：60 的三连八分 = 90 的八分），音乐在 **28.3333s 一刀切死**、静默到 32.3333s；32.3333–36.3333 = 60 BPM；36.3333–44.3333 = 90 BPM；44.3333–47.3333 = 数字静默；48.3333–58.5 = 60 BPM（`DEMO.md:50`、`style-dna/woodcut.md:63`）。动作时长：**角色 on twos（12fps）、镜头/粒子/火/光 on ones（24fps）**；每次关键动作走「预备 / 动作 / 跟随」（样片：锤子后仰 4 帧 → 击打 2 帧 → 落定 + 3 帧镜头抖）。
- **转场时长与缓动**：揭纸按「带重量的纸」演算——慢起、中间大卷、末尾一翻；卷边有亮线，明暗按纸面朝向镜头的角度（`trans.js:10-67`）。
- **绝对不要的转场**：叠化（dissolve）；任何淡入/滑入；让纸边动；把文字放进画面（`style-dna/woodcut.md:91-96`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **纸边里的活字（letterpress）**，老式衬线 IM Fell English（OFL），样片 **42px**；标题用 IM Fell English SC 并被**刻**进版里（镜像）（`STYLE.md:42-43`、`DEMO.md:62`）。通路侧字体回退 **SimSun**（`dub-styles.json#woodcut.subtitle`） |
| 字号（相对画面宽 / 高） | 样片 **42px**；通路派生 `fontSizeFactor 0.03889`（≈42px/1080）、标题 `fontSizeFactor 0.09`（`dub-styles.json#woodcut`） |
| 颜色 / 描边 / 阴影 | 图注墨 `#111`，**过同一道印刷 shader**（所以图注也带纸纹与上墨不匀）；通路 `subtitleOutline #FFFFFF`、`subtitleBack` 全透明（`DEMO.md:62`、`dub-styles.json#woodcut`） |
| 位置 / 安全边距 | **底部 132px 纸边之内、画面之外**；通路 `marginVFactor 0.12037`（≈130px）、`marginLFactor 0.07037`（≈76px）、`align 2`（`DEMO.md:60`、`dub-styles.json#woodcut`） |
| 单行字数上限 / 最多行数 | demo 只有 **4 条图注**，每句是完整一句话（实测 2.4–4.0s 长，见 `logs/woodcut.log:39,41,47,48`）；一句只承担一层，不做折行堆叠（`style-dna/woodcut.md:52`） |
| 出现与消失方式 | 墨水 **0.1s 上来、不滑动**、**0.15s 淡出**；停留 ≥ `max(1.8s, 语音 + 0.6s)`（`STYLE.md:42`、`film.js:32-41`）。通路 `motion.subtitleFadeIn 0.1`（`dub-styles.json#woodcut`） |

- **字幕与旁白的关系**：旁白是一位沉默的雕版师讲民间传说——**第三人称、过去时，低沉平实，像图注被念出来**；**版画承担其余的一切**（`STYLE.md:81`、`style-dna/woodcut.md:38`）。旁白**极少**：样片只有 4 句（Kokoro `am_onyx`，speed 0.88），句与句之间可以整段静默（`lines.json:1-6`、`DEMO.md:55`）。
- **本风格特有的字幕禁忌**：**图注绝不能压在画面上**（只能活在纸边里）；文字不能淡入/滑入；不用第一人称抒情、网络口播腔、感叹号堆叠；不用抽象概念当主语（只谈能被刻出来的实物、动作、位置）（`style-dna/woodcut.md:49-53`）。

---

## 6. BGM / 音效特征

- **配乐**：低弦为主——低音提琴 / 大提琴（spiccato、pizzicato，**中提琴只在钟响之后才进**）+ 木与皮（log drum、木鱼、框鼓）+ gran cassa / 定音鼓 + **一面** tam-tam + **合成铁砧**（模态 numpy：3–5 个非谐分音 + 锤击瞬态）。民间色彩可选拉锯琴或轮擦提琴的持续音。**钟之前全片不许出现任何钟的音色**——村子「没有嗓子」，所以第一声钟就是高潮；D 小调在钟的余韵里转 D 大调（`DEMO.md:51`、`score.py:1-11,136-171`）。
- **拟音（按材质合成）**：刀入木（瞬态 + 与刀速绑定的带通纤维撕裂）、木屑、滚筒粘滞、纸的空气、马楝沙沙、湿揭纸；金属**按大小**定音（大 = 低、小 = 高而纯），共振物用模态模型 + 回声做距离。样片特有：黄铜供品按大小定音（pot 低而宽 / keys 与 ring 高而纯）、陶土刮擦与碎裂、风箱皮革 + 气流、熔融气泡、浇注轰鸣、入模嘶声；**钟是一套模态模型**（hum 0.5、prime 1、tierce 1.2、quint 1.5、nominal 2/2.5/3/4，各自衰减与拍频）+ **两条山谷回声**（`DEMO.md:52`、`mix.py:134-164`）。
- **旁白处理**：Kokoro `am_onyx` speed 0.88、4 句，归一化 + 轻混响（`DEMO.md:55`、`mix.py:233-243`）。**混音规则**：音乐在旁白下压 ~8dB（钟后 6dB）、在关键 foley 下压 4dB；**foley 也要给人声让路**（−5dB，若某记金属敲击与人声共拍则 −9dB）；把刺耳的瞬态推离正中（`STYLE.md:80`、`mix.py:244-268`）。**J/L 切**携带声音跨版与跨揭纸（火声先进手部镜；户外风闷着带进作坊；风带着揭纸进钟楼；钟的余韵压着结尾卡）。
- **响度目标**：`-14 LUFS`；**交付真峰值上限**：`-1.2 dBTP`（项目级交付线；本风格 `STYLE.md:80` 只写 −14 LUFS，未额外声明更严上限）。本次成片实测 **I = −13.8 LUFS / LRA 7.8 LU（`ebur128`）/ 真峰值 −1.42 dBTP（`loudnorm` `input_tp`，4× 过采样）—— 真峰值在交付线内，余量 0.22 dB、未削波**（`logs/woodcut.log:141` 只印了 `ebur128` 的 `Peak -1.4 dBFS`——那是 1 位小数读数，`astats` 采样峰值 −1.424793 是下界，两者都不能当真峰值用；本片余量是本次 17 份里较小的一档）。配乐自身峰值 **-1.30 dBFS**、三 stem 求和与 mix 完全一致（`logs/woodcut.log:61-62`）。
- **静默策略**：**两段真实静默**——`28.3333–32.3333s`（样片设计为 −40dB 只剩远风，实测音乐层为数字零，其后的第一个声音是罗盘盖的 *click*）与 `44.3333–48.3333s`（**数字静默**，样片设计实测 −91dB，其后的第一个声音是钟——全片最响的一刻）。本次日志实测三段静默窗口（含 0–3.0s）**max abs 全部为 0.0e+00**，且 `bells` stem 在 48.3333s 之前 max abs 也是 0.0e+00（`logs/woodcut.log:78-83`、`DEMO.md:53`）。

---

## 7. 素材偏好

- **需要什么素材**：`timeline.json`（**唯一真源**：`grid` 每个乐段 `{id,t0,t1,bpm}`、`keys` 每个画面/声音锚点的秒数）；`lines.json`（每句 `{id,text,voice,speed}`，样片只有 4 句）+ `voices/dur.json`（每句时长）；画面由 `shots.js` / `shots2.js` 里每镜的 `draw` **现场生成**，不需要任何图库素材（`style-dna/woodcut.md:161-166`、`DEMO.md:81`）。
- **不需要什么素材**：图库照片、实拍、3D 模型、扁平 UI 组件、平涂色块、任何现代图标、任何渐变。**唯一可以「外来的」素材是一张照片或一帧影像**——但它必须过 `woodcutFilter` 变成顺形体的刻痕（约 1900 刀 / 1080p 一帧、约 140ms）（`DEMO.md:139`）。
- **取景 / 质感 / 比例偏好**：**纸边永远不动**，镜头在纸上移动（`STYLE.md:57`）。刀具分级（1080p、1× 相机）：Knife `k` 1.2–2（轮廓、分开黑形体与黑背景的白描边）、V-gouge `v` 2–8（排线、毛发、细光）、U-gouge `u` 10–22（光线、天空横扫、第一遍粗刻）、Stab `stab` r 3–8（雪、火星、土屑、木屑）（`STYLE.md:21-26`）。排线用 Doré 语法：**方向跟形体走、宽度跟调子走**；每根线是**独立的一刀**（30–160px，钝入、收尖、崩口），绝不是连续机器线（`STYLE.md:28`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有照片就直接用引擎造形——`WC.shape(polys, {light, sp, halo, dir, tone, ...})` 雕一个实心块，或 `cutAlong` / `hatch` / `flecks` / `rays` 造轮廓、区域排线、stab 白点、放射光；特写走**高度场**：`hands.js` 的 `Sculpt`（capsule / blob / plank / creases）→ `shade(light)` → `woodcutFilter`（`DEMO.md:100-116`、`style-dna/woodcut.md:176`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | **17 镜**（`shots.js` + `shots2.js`）。样片锚点：钩子 0–3s；4s 近静止微距手部；供品蒙太奇硬切加速 **1 / 1 / 1 / .5 / .5 / .25 / .25 s**；失败段 0.2s 急推后停住 1.3s；钟响段 5.2× → 1× 连续拉远（`DEMO.md:33-42`） |
| 全片时长 | **58.5s**（`style.json:17`、`logs/woodcut.log:26` 的 `dur 58.5`）；brief 是 40–60s（`DEMO.md:8`） |
| 镜头数 | 24fps / **1404 帧**（`logs/woodcut.log:129,144`）；**94 条事件**、**4 条图注**（`logs/woodcut.log:26,135`） |
| 信息投放节拍 | 黑暗里的第一刀（地平线）→ 世界被刻出来 → 第一张印品被揭起（镜像 → 正像）→ 一段长的手部特写 → 小供品快剪蒙太奇 → 第一次尝试**在特写里失败** → 一块静默的版 → 一次个人牺牲 → 第二次尝试、色版淹没画面 → 最长的静默 → 回报的那一声 → 颜色收缩成一个高光 → 白点被「上墨补回」→ 最后一刀又是那条地平线（`DEMO.md:23`） |

- **加速 / 减速点**：**加速**在供品蒙太奇（硬切间隔从 1s 收到 0.25s，每记落点带 jolt）；**减速**在 4s 手部微距（慢推 1.0 → 1.13）、静默的版（只有雪在动）、以及钟响后 5.2× → 1× 的连续拉远（`DEMO.md:36-42`）。
- **留白与静音的位置**：**28.3333–32.3333s** 与 **44.3333–48.3333s** 两段真实静默（后者是数字零，实测 −240 dBFS 级）；静默之后**第一个声音是选定的**——第一段后是罗盘盖 click，第二段后是全片最响的钟（`DEMO.md:53`、`logs/woodcut.log:70,75`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/woodcut/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs $D --fps 24 --workers 4 --out $D/out/video24.mp4`（`build.sh:13`，4 workers 约 45s / 1404 帧）；**本次编排器实际调用**为 `--fps 24 --workers 6 --size 1920x1080 --out D:\lemo-opuscar\styles\woodcut\demo\out\video_gpu.mp4`（`logs/woodcut.log:37`） |
| 帧率 | **24 fps**（1404 帧 / 58.5s，`logs/woodcut.log:129`）；**角色 on twos（12fps）**，镜头/火/光 on ones（`STYLE.md:48`） |
| 分辨率 / 比例 | 原生 1920×1080 / 16:9（画面区 `36,36,1848×912`、底边纸边 132px，`logs/woodcut.log:2`、`DEMO.md:60`）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:16`），由 `stage.setFrame()`（`stage.js:21`）按视口尺寸重排：印框 `IMG` 按轴拉伸铺满（`stage.js:23`）、相机 `z = cam.z × S`（`stage.js:30`）、图注位置随 `IMG` / 字号 `44×S`（`stage.js:55`）；16:9 时 `FX=FY=S=1`、`IMG={36,36,1848,912}` 逐字节退化成设计帧 |
| 混流 | `sh $D/tools/mux.sh $D/out/video24.mp4 $D/mix.wav $O/woodcut.mp4 24 6`（**两段式**：先 `core/render/mux.sh` → `master_crf19.mp4`（两遍 loudnorm −14 LUFS + grain 6），再对母版做一次二次编码；**CRF 28 + `-tune grain`** 是为压细排线 + 每帧墨色噪声 + 颗粒造成的体积）（`build.sh:14`、`demo/tools/mux.sh:2-24`） |
| 编码器 | **`h264_nvenc`（本地 GPU）**；本次渲染日志显示 `nvenc`（`logs/woodcut.log:7`）。**第二段编码器跟随 `LEMO_VENC`**（编排器默认导出 `h264_nvenc`），非 nvenc 时才回落到 `libx264 -preset slow -crf 28 -tune grain`（`demo/tools/mux.sh:19-23`） |
| 音频入口 | `$D/music/score.py`（读 `timeline.json` 的原创配乐 → `score.wav` + stems + `score.json`）+ `$D/mix.py`（按材质合成 foley + 环境 + 旁白 + 配乐闪避 + 两段静音 + 钟 → `mix.wav`）（`build.sh:8,11`） |
| 字幕入口 | `$PY $D/tools/subs.py`（→ `woodcut.srt`，4 条图注）（`build.sh:12`、`logs/woodcut.log:135`） |
| 事件导出 | `node core/render/events.mjs styles/woodcut/demo`（本次 **events 94 dur 58.5**，`logs/woodcut.log:26`） |
| 本风格专属参数 | `$PY $D/tools/cuecheck.py`（配乐卡点 ↔ 画面事件 ↔ 时间线对齐自检，**含两段静音窗口**，本次三段静默 max abs 全 0.0e+00）；`$PY $D/tools/final_asr.py $O/woodcut.mp4`（成片 whisper 抽查）；测试页 `?test=char|hands|pour|village|sheetA|sheetB|filter|spark`（`build.sh:10,15`、`DEMO.md:79`） |
| 一键复现 | `sh styles/woodcut/demo/build.sh`（TTS → asr → score → events → cuecheck → mix → srt → render → mux → 成片 ASR → 风格帧/海报/引擎示例，`build.sh:1-18`） |
| 本次编排器调用 | `node lemo-make.mjs woodcut --skip-sync --no-preflight --ratio 16:9`（`logs/woodcut.log:1`，**走了 `--skip-sync`**） |

---

## 10. 编排规则

- **内容文件字段契约**：`timeline.json` 是**唯一真源**——`grid` 是每个乐段 `{id,t0,t1,bpm}`，`keys` 是每个画面/声音锚点的秒数（`knife_first / carve_* / ink_roll / peel / print_land / L1–L4 / furnace / glow / pour1 / smash / clunk / silence1 / click / compass_drop / bellows2 / pour2 / rays2 / reveal2 / pull2 / silence2 / bell / echo1 / echo2 / endcard`）；`lines.json` 是每一句旁白 `{id, text, voice, speed}`（样片 4 句、voice `am_onyx`、speed 0.88）；`voices/dur.json` 给每句时长（字幕停留 = `max(1.8s, 时长 + 0.6s)`）；画面由各镜的 `draw` 现场生成（`style-dna/woodcut.md:161-166`、`DEMO.md:50`）。
- **事件词汇表**（`type` → 消费者）：`knife_bite` / `knife_run{dur}` / `knife_flick` / `gouge_u` / `gouge_v` / `carve_fine{dur}` / `carve_title{dur}` / `stab` / `brayer{dur}` / `paper_lay` / `baren{dur}` / `peel{dur}` / `paper_land` / `beam_creak` / `clay_rasp{dur}` / `gift_pot|gift_candle|gift_keys|gift_ring|gift_spoon|gift_bracelet` / `cloth_grip` / `bellows` / `fire_roar{dur}` / `molten_bubble{dur}` / `tongs_clank` / `pour{dur}` / `sizzle{dur}` / `sparks{dur}` / `whoosh` / `mould_smash` / `debris{dur}` / `dust{dur}` / `clunk` / `crack{dur}` / `compass_click` / `throw_whoosh` / `compass_drop` / `rays_carve` / `steam{dur}` / `ink_dot` / `amb_wind` / `amb_forge` / `wind_muffled` / `far_wind{dur}` / `vo{id}`（`style-dna/woodcut.md:190-206`）。
- **时间线契约**：`demo/film.js` 导出 `init(g, qs)` 与 `render(g, t)`。`init` 读 `timeline.json`（`DUR=58.5`）、加载 `voices/dur.json`、建 printer 与 4 个缓冲画布、由 `lines.json` 生成 `SUBS`（`t0 = K[id]−0.05`，`t1 = t0 + max(1.8, dur+0.6)`）、把每镜的 `events(K)` 汇总进 `EV` 并按时间排序；`render(g,t)` 找到覆盖 t 的那一镜并调 `s.draw(g, t, t − s.t0)`。每一镜是 `{t0, t1, draw(g,t,lt), events(K)}`，`draw` 内部调 `H.printFrame(g, t, cam, drawFn, opts)`（或 `blockFrame`）把掩膜 + 色版印成画面。页面契约由 `main.js` 暴露 `window.READY / window.render(t) / window.DUR / window.EV`（`style-dna/woodcut.md:180-186`、`film.js:9-41`）。
- **新增主体怎么接入**：新主体 = 一组「刻痕」，必须做三件事：① 用 `WC.shape(polys, {light, sp, halo, dir, tone, lo, hi, kind, seg, reveal})` 雕一个实心块（黑剪影 + 白刀晕 + 顺形体排线），或用 `cutAlong` / `hatch` / `flecks` / `rays` 造轮廓、区域排线、stab 白点、放射光；② 把结果画到**掩膜**上：`shape.draw(m, t)` 或 `WC.drawStrokes(m, strokes, {t, color})`（白 = 刻掉、黑 = 留木；`color:'#000'` 用来「补墨」把已刻区域重新填黑）；③ 可选色版 `WC.plate(c, polys, a)`——只在掩膜被刻白处显色，**绝不能落在黑上**。特写走高度场：`Sculpt` → `shade(light)` → `woodcutFilter`。**每一块可复用的刻痕缓存必须首次使用时自建**，否则跨渲染 worker 不确定（`style-dna/woodcut.md:168-176`、`DEMO.md:100-116`）。
- **换主题时要改哪些文件**：① `demo/timeline.json`（**先写它**：网格 + 全部 cue 锚点）；② `demo/lines.json`（旁白，然后跑 `core/tts/tts.py` + `core/tts/asr_check.py` 得 `voices/dur.json`）；③ `demo/shots.js` / `shots2.js`（每镜的 `t0/t1/draw/events`）+ 需要的 `world.js` / `interior.js` / `fx.js` / `hands.js`；④ 色版颜色改 `engine/index.js:16` 的 `COPPER` 常量与 `makePrinter({plate})` 的传入值；⑤ `music/score.py` 读同一份 `timeline.json`，改段落即可。**做法**：先写 `timeline.json` 与 cue 表、交给音乐侧，画面并行画；**在写任何故事之前先把引擎和一张风格帧做对**（`DEMO.md:81-82`）。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里可生效的参数有 `palette`（bg `#EFE8D8` / bg2 `#D8C29C` / fg `#111111` / accent `#A24122` / subtitle `#111111` / subtitleOutline `#FFFFFF` / subtitleBack 全透明）、`bgRecipe`（type=gradient，stops `#EFE8D8 → #D8C29C`，texture grain，vignette 0.08）、`subtitle`（SimSun / 0.03889 / 0.12037 / 0.07037 / 描边 0 / align 2）、`title.fontSizeFactor 0.09` / `showRole true`、`motion.subtitleFadeIn 0.1` / `chapterTransition cut`、`overlay.accentRule false`（章节卡与 lowerThird 保守关闭）（`dub-styles.json#woodcut`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **两段式 mux 的第二段曾硬写 `libx264`（CPU 编码，违反「合成渲染走本地 GPU」硬规则）**——这是本风格最需要记住的一条。`demo/tools/mux.sh` 的结构是：**第一段**调 `core/render/mux.sh`（那份本来就有「音频比画面短 → 补静音到画面长度 + 一帧，防 `-shortest` 切掉最后一帧」+ 认 `LEMO_VENC`），产出母版 `master_crf19.mp4`；**第二段**再对母版做一次 `libx264 -crf 28 -tune grain` 的二次编码（为压细排线 + 每帧墨色噪声 + 颗粒的体积）。问题出在第二段：它**硬写 libx264**，编排器默认 `export LEMO_VENC=h264_nvenc` 时它不认，于是**走 CPU**。**2026-10-03 只给它打了半条补丁**（`D:/lemo-tools/scripts/patch-style-mux.mjs` 的 woodcut 特例，`TARGETS` 里 `{slug:'woodcut', crf:28, tune:true, onlyEnc:true}`）：**只换编码器、不补静音**——因为帧数由第一段 core 版保证。补丁后第二段写成 `case "${LEMO_VENC:-}" in h264_nvenc) VARG="-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq 32 -b:v 0";; *|libx264) VARG="-c:v libx264 -preset slow -crf 28 -tune grain";; esac`。
- **半条补丁的两个遗留问题**：① 第二段插入的补丁块里**仍带着 `dur()` / `VD` / `AD` / `PAD` 的计算**（`prelude()` 是整块生成的），但第二段的 ffmpeg 用 `-c:a copy`、**从不引用 `$PAD`**——这段是**死代码**，只是没害处；② 走 `h264_nvenc` 分支时 `TUNE=" -tune grain"` **被静默丢弃**（只在 libx264 分支里被使用），也就是**GPU 路径下没有 `-tune grain`**，颗粒保持能力与文档写的 CRF 28 + tune grain 不完全等价。成片实测 **31.2 MB / 约 4.5 Mbps**（`logs/woodcut.log:145`），远低于 `DEMO.md:93` 记录的 libx264 CRF 28 的 93 MB。
- **日志没有单独打印第二段的编码器名**：`logs/woodcut.log:134-144` 只显示了 core 版母版的 loudnorm 统计与最终文件大小，**无法从日志直接确认第二段走的是 nvenc 还是 libx264**（只能从体积反推）。要确认必须让第二段也打印 `$VARG` 或显式回显 `LEMO_VENC`。
- **`mix.wav` 峰值超过 0 dBFS**：`mix.py` 打印 `mix.wav (2808000, 2) peak 1.8093362688225716`（`logs/woodcut.log:116`），即约 **+5.2 dBFS**；文件 11232044 B = 2808000×2×2 + 44，是 **16-bit PCM**。是否已在写盘前归一化、还是已被硬削顶，日志没有显示归一化步骤，**需要复核**；成片靠 core 版 mux 的两遍 loudnorm 拉回 **-13.8 LUFS / Peak -1.4 dBFS**。★ 成片真峰值 = `loudnorm` `input_tp`（4× 过采样）**−1.42 dBTP**，在 −1.2 dBTP 交付线内、未削波——即 mix 的硬削顶嫌疑**没有**在成片上留下削波痕迹（但仍建议复核 mix 写盘）。
- **响度略高于目标**：成片实测 **-13.8 LUFS**（目标 -14.0）、LRA **7.8 LU**（`logs/woodcut.log:139-141`）。成片真峰值 **−1.42 dBTP**（`loudnorm` `input_tp`，4× 过采样），在 −1.2 dBTP 交付线内（余量 0.22 dB）、未削波。
- **cuecheck 的 onset 表里，弓弦类事件的「孤立干声」偏差很大**：`C3_cello B worst +120.5ms`、`C8_cello_in B worst +124.1ms`、`H_strings_in B worst +112.1ms`（`logs/woodcut.log:89,98,107`）。渲染 stem 里的检测值（A worst）都很小（−30 ~ +36ms），所以更像是**弓弦起音本身是软起音**导致 onset 检测器定位到起振后段，而不是卡点错；但这三处需要人工听一遍确认。
- **通路配色是派生近似**：`dub-styles.json#woodcut` 标了 `derived: true`，`accent #A24122` 是比 demo 的色版 `#C8502A` **更暗的代理值**，`bgRecipe.textureRaw` 是 `woodgrain` 而 demo 的纸纹是帘纹纸；★ 另需说明：这条 `textureRaw: woodgrain` **在渲染侧未实现**（`bgFilters()` 只读粗粒度 `texture`，本风格是 `grain`）——`woodgrain` 这一层木纹从未画出来过，已登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里；字幕字体回退 **SimSun**（本机无 IM Fell English）。
- **9:16 曾不适配（★ 2026-10-04 已修）**：原记「无 `aspects` 声明，画面区与底边 132px 纸边图注带都是硬坐标，竖屏会丢掉右半幅与**全部图注**」。**2026-10-04** 已改造 `styles/woodcut/demo/`：`stage.js` 导出 `NATIVE`（`stage.js:12`）与 `setFrame(w,h)`（`stage.js:21`）派生 `W/H/FX/FY/S`，`film.js` 声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:16`），`main.js` 按视口调 `setFrame`（`main.js:14-15`）；印框 `IMG` 按轴拉伸铺满（`stage.js:23`）、相机 `z = cam.z × S`（`stage.js:30`）、图注位置随 `IMG` / 字号 `44×S`（`stage.js:55`）；`shots.js`/`shots2.js`/`trans.js`/`film.js` 的离屏画布改用 stage 的 `W/H`（原来硬写 1920×1080，9:16 下打印机输出 1080×1920 而画布仍是 1920×1080，会出缩小的信框卡）。**16:9 逐字节未变**（`FX=FY=S=1` 时每个表达式退化成它替换掉的那个数字，扩展帧集 6 帧 md5 与改造前完全一致）；9:16 实测不裁切、图注完整（见第 2 节）。

### 素材缺口
- 依赖一份**手写的 `timeline.json`**（唯一真源）——没有它整套编排无从谈起，必须先写网格与 cue 表。
- 依赖**可用的 Kokoro 音色**（样片 `am_onyx`）与 IM Fell English 字体（demo 自带 OFL，但**无 CJK 活字**，中文题材需自备老式衬线/宋体）。
- 引擎自带的**可复用部件有限**：`trans.js`（揭纸）、`hands.js`（高度场雕塑）、`fx.js`（钟 / 风箱 / 供品 / 村民 / 声环）、`interior.js`（作坊 / 坩埚 / 浇注 / 火星 / 模具 / 蒸汽）、`world.js`（山谷 / 村庄 / 钟楼 / 雪）。换主题必须自备场景几何。
- 没有「钟 / 铁砧 / 供品」这类道具的音频采样，**全部靠 numpy 合成**（`mix.py` / `score.py`），改题材要重写对应合成器。
- **`demo/assets/bearded_man_cc0.jpg` 不在仓库、也不在本机盘上（2026-10-06 核实）**：它只被滤镜测试用（`?test=filter`）。`test.js:39` 的 `loadImg()` 里是 `await im.decode()`，**404 会让它 reject**；`test.js:40` 的 `preload()` 直接 await 它 ⇒ **这条路径现在跑不了**（不是「结果不对」，是**直接失败**）。★ 它**不能由仓内脚本重生**（外部照片，无生成器）。作者 / 平台 / 授权在 CREDITS 里本来就写了（ThuyHaBich，Pixabay，经 Wikimedia Commons，CC0），但**原来没有 URL**——现已补 `https://commons.wikimedia.org/wiki/File:Bearded_man_smoking_pipe-3013924.jpg`，并注明「本仓库不含该文件」。★★ 该 Commons 页带 **`Restrictions: personality`**：照片里**真人的肖像权不随 CC0 放弃** ⇒ 要不要把这张图纳入仓库（或换一张无人的替代图）**需用户拍板**；本次**未下载、未新增任何素材**。

### 能力限制
- 慢风格：**40–60s**、一叠独立版、一句一层；撑不起快节奏、强情绪外放、真人出镜、实拍或并列多观点的密集片。
- **纸边永远不动**、**图注只能在纸边**、**最多一块色版**、**绝不灰对灰**——四条硬约束把能做的构图框得很死。
- 角色 on twos（12fps）、镜头 on ones（24fps）是硬性分工；火与液体每 2 帧重刻一次是**刻意的 boil**，不是抖动。

### 踩过的坑（本机实测）
- **雪刻在白雪上会看不见**——要有黑雪堤与风刻地面，雪花才能在天空和暗块上读出来（`DEMO.md:88`）。
- **第一口钟**曾因「短排线段 + 调子正弦摆动」变成**锯齿人字**；修法是**长刻**（14–50 × 间距）+ **一条宽亮带** + 一圈细边光 + 更强的白晕（`DEMO.md:89`、`STYLE.md:101`）。
- **模具的蒸汽画在主体之上会被读成火焰**——移到主体之后，只让几缕从边缘逸出（`DEMO.md:90`、`STYLE.md:102`）。
- **偷懒共享缓存的刻痕**（`X.coatFolds || []`）会破坏跨渲染 worker 的确定性——每个缓存首次使用时自建（`DEMO.md:91`、`STYLE.md:103`）。
- **金属供品的敲击会盖住旁白**（whisper 把 "it had" 听成 "is had"）——foley 必须给人声让路，并把肇事的那一记推离正中（`DEMO.md:92`）。
- **文件体积**：细排线 + 每次印张的上墨噪声 + grain 6 让 58s 片子在 CRF 19 达到 **326 MB**；CRF 28 + `-tune grain` 后 **93 MB** 且 1:1 裁切看不出差别（`DEMO.md:93`）。
- **`woodcutFilter` 在平区出 NaN**，来自 box blur 在平坦区留下极小负数——`sqrt` 前先 clamp（`DEMO.md:94`、`STYLE.md:104`）。
- `still.mjs` 在多个渲染同时跑时会失败，要重试最多 3 次（`DEMO.md:95`）。
- 本次出片**走了 `--skip-sync`**（`logs/woodcut.log:1`），未做双份库同步；渲染 + 音频并行 **88.0s**、全流程 **121.7s**；`ASR mismatches: 0`（`logs/woodcut.log:57,132,151`）。

### 下次迭代优先补什么
- 把第二段的 `$VARG` / `LEMO_VENC` **回显到日志**，让「第二段到底走 GPU 还是 CPU」可验证；并考虑给 nvenc 分支也补上等价于 `-tune grain` 的颗粒保持参数（或改为 nvenc 下用更高 cq）。
- 清掉 woodcut 副本里那段**未被引用的 `$PAD` 死代码**，避免后人误以为第二段会补静音。
- 复核 `mix.wav` 的写盘归一化，确保峰值不超 0 dBFS、int16 不被硬削。
- 把成片响度收到 -14.0 LUFS（当前 -13.8）。
- 人工听一遍 `C3_cello` / `C8_cello_in` / `H_strings_in` 三处弓弦 onset。
- **（已完成 2026-10-04）** 9:16 适配：已给 `film.js` 补 `FILM_META.aspects = ['16:9','9:16']`（`film.js:16`）并由 `stage.setFrame()` 按视口尺寸重排版面（印框 `IMG` 按轴拉伸、相机 `z = cam.z × S`，`stage.js:21-30`）。★ 声明落在影片模块 `film.js` 的 `FILM_META`，**不是 `style.json`**——探测方 `lib/aspects.mjs` 读的就是 `film.js` 源码文本。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/woodcut/woodcut.mp4`（**58.50s / 31.2MB**，1404 帧 / 24fps） |
| 抽帧 | `D:/lemo-tools/_distill/frames/woodcut/`（**24 帧 + 接触印样**） |
| 风格匹配度自评 | **93/100**（2026-10-05 校正：原 94，新增「textureRaw 细纹理未实现」缺陷，palette −1）（2026-10-05 校正：原 93，9:16 画幅缺陷已修并回补 composition +1） |
| 详细资料 | 有（STYLE.md / DEMO.md / style.json / build.sh / demo/tools/mux.sh / lines.json / timeline.json / style-dna .md+.json / dub-styles.json#woodcut / demo 源码 engine+shots+shots2+world+interior+fx+hands+trans+mix+score / 出片日志） |

**逐帧拆解要点**（24 帧按 `(i+0.5)/24 × 58.5s` 折算，各帧约为）：
- **f01 ≈ 1.2s**：**近乎全黑的版**——满屏未刻的黑木纹，只有一道极小的米白刀痕（第一刀 = 地平线）。这正是「黑是木、白是刀刻掉的」的开场。
- **f02 ≈ 3.7s**：世界开始被刻出来——山脉与屋顶的刻痕还在生长中（`carve reveal`），大片仍是黑。
- **f03 ≈ 6.1s**：**block 模式**——一块着墨的黑木版压在木桌上，浅色木凹槽 `#D8C29C` 可见，版边毛糙、投影落在桌面。
- **f04 ≈ 8.5s**：纸/版过渡态，画面偏灰白（纸铺下的瞬间），**标题「THE BELL FOUNDER」是反的（镜像）**。
- **f05 ≈ 11.0s**：**第一张印品**——标题读**正**了，山谷 / 村庄 / 空钟楼 / 松树 / 雪全部刻出，黑块压白、排线顺形体走。
- **f06 ≈ 13.4s**：推近钟楼与山脊（排线沿山势方向），底边纸边里第一条图注「That winter, the snow closed every road, and the tower had no bell.」
- **f07 ≈ 15.8s / f08 ≈ 18.3s**：**4s 手部微距**——高度场 + `woodcutFilter` 雕出的两只旧手，**皮肤刻白、纹理用点刻**，背景是黑的；镜头近静止、只慢推。
- **f09 ≈ 20.7s**：供品蒙太奇的一记——黑底上刻白的钉子 / 钥匙 / 戒指等黄铜小件，图注「So every house gave what metal it had.」
- **f10 ≈ 23.2s**：作坊内景——铸工与学徒站在炉前，坩埚 / 编织状的模具在右侧。
- **f11 ≈ 25.6s**：**第一次颜色**——炉口 / 坩埚里的**铜色 `#C8502A` 首次出现**（只在刻白处发光），锻工举钳。
- **f12 ≈ 28.0s**：第一口钟与垂头的铸工；钟面用 Doré 环绕排线（一条宽亮带 + 细边光）。
- **f13 ≈ 30.5s**：**静默的版**——**框中之框**（作坊门），门外是村民的黑色剪影、门里是铸工背影，**只有雪（stab 白点）在动**；此帧正落在第一段静默 `28.3333–32.3333s` 内。
- **f14 ≈ 32.9s / f15 ≈ 35.3s**：**个人牺牲**——男孩掌心托着罗盘（高度场特写，白色点刻的手 + 圆形罗盘），旁边是细雨般的细刻；f15 是坩埚里正在熔掉的小物件（钥匙 / 戒指 / 罗盘环）。两帧共用同一条图注「The boy gave his compass, the one thing that always guided him home.」（对应 L3，`32.6–36.57s`）。
- **f16 ≈ 37.8s**：第二次浇注——熔流倾入模具，铜色版在刻白处发亮，锻工持钳俯身。
- **f17 ≈ 40.2s / f20 ≈ 47.5s**：**高潮**——从模具爆出**放射状刻痕**，铜色版铺满画面（`rays` + plate flood）；f20 是重排线铺满的铜色帧，正落在第二段静默 `44.3333–48.3333s` 内（静默只关乎声音，画面仍在走）。
- **f18 ≈ 42.7s**：钟已铸成——铸工与男孩分立钟两侧，钟身内透出一线铜色。
- **f19 ≈ 45.1s**：回到山谷全景，钟楼里可见钟与那线铜色。
- **f21 ≈ 49.9s / f22 ≈ 52.4s**：**钟响 + 连续拉远 5.2× → 1×**——整个山谷（山脉 / 房屋 / 钟楼 / 松树 / 雪原）连同**向外扩散的同心声环**同时入画，铜色已**收缩成一个高光**；f22 带最后一条图注「When it rang, the snow stopped to listen.」（L4，`51.8–54.17s`）。
- **f23 ≈ 54.9s / f24 ≈ 57.3s**：**结尾卡 = 一张新印品**——暖纸上一块**黑版面板**，标题「THE BELL FOUNDER」从黑里被刻出来（活字）、上方一口保留**铜色高光**的小钟，下面「A Woodcut Print」「Lemo-Opuscar」「LemoLab × Claude Opus 5.5」+ 小字 credits；f23 左侧还看得见上一镜印品的边缘（揭纸 / 翻页的余韵）。
- **整体观察**：全片**只有墨 + 暖纸两值**（无灰、无冷暖推移），起伏完全由**刻痕密度**、黑块与刻白的比例、以及**唯一的铜色**制造；纸边（含底部图注带）**全程不动**；转场只用**硬切（新印张，2 帧套印错位）**与**揭纸**，**没有一次叠化**；图注只出现在底边纸边里、从不出现在画面上；未见糊帧、黑边或图注溢出。

**自检发现的缺陷**：两段式 mux 第二段曾硬写 libx264（CPU）只打了半条补丁、且 nvenc 分支丢失 `-tune grain`、补丁块里留有未被引用的 `$PAD` 死代码；日志无法直接确认第二段编码器；`mix.wav` 峰值 1.809（> 0 dBFS）；成片 -13.8 LUFS 略高于目标；三处弓弦 onset 的孤立干声偏差 >100ms；通路 accent 是更暗的代理色、字体回退 SimSun；无 9:16 适配（★ 2026-10-04 已修：`FILM_META.aspects` + `stage.setFrame()` 重排，见第 2、11 节）。

**本次为补齐短板做了什么**：**未改动** `D:/lemo-opuscar` 下任何源码，**未起渲染或 TTS**，只新增本目录两份交付物。本次成片走上游既有链路：`node lemo-make.mjs woodcut --skip-sync --no-preflight --ratio 16:9` → 1920×1080 / 24fps / 6 workers / `nvenc`（`logs/woodcut.log:1,7,37`）；混流走 `styles/woodcut/demo/tools/mux.sh`（grain 6）的**两段式**：第一段 `core/render/mux.sh` 产母版 `master_crf19.mp4`（两遍 loudnorm，实测 `-13.8 LUFS / LRA 7.8 LU / Peak -1.4 dBFS`），第二段二次编码 → `MUX_OK 32702799 src_frames=1404 out_frames=1404`，成片 **31.2 MB**，全流程 **121.7s**（`logs/woodcut.log:8,138-145,151`）。第 11 节已把这条半条补丁的来龙去脉与两个遗留问题如实记录，供后续迭代。**★ 2026-10-04** 另做 9:16 适配：改造 `D:/lemo-opuscar/styles/woodcut/demo/`（`stage.js` + `shots.js` + `shots2.js` + `trans.js` + `film.js` + `main.js`）使其支持 9:16，并同步 WSL 副本；16:9 扩展帧集 6 帧逐字节未变，9:16 实测不裁切、图注完整（详见第 2、11 节）。
