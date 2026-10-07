---
name: lemo-style-engraving
description: 【lemo 风格 Skill · 铜版画】做博物馆标签、科学解说、品牌传承/工艺溯源类短片时用；交付「雕刀在铜版上一线线刻出博物图版、最后手工水彩上色」的耐心、精确、值得被保存的观感。已声明支持 16:9 / 9:16 / 3:4 / 4:3 / 1:1 五种比例（9:16 为产品默认输出比例），可直接出竖屏。选定本风格做视频时，优先读本文件。
slug: engraving
name_zh: 铜版画
category: 印刷与版画
film: The Honeybee, Plate VII
---

# 铜版画（`engraving`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/engraving/STYLE.md` · `styles/engraving/DEMO.md` · `styles/engraving/demo/build.sh` ·
> `demo/film.js` / `demo/film_coffee.js` / `demo/engine/plate.js` / `demo/engine/burin.js` / `demo/subjects/*.js` ·
> `core/lang/lang.mjs` · `lib/style-dna/engraving.md` · `lib/dub-styles.json#engraving` · `lib/dub-visual.json#engraving` ·
> `styles/engraving/style.json` · `demo/content.json` · **成片逐帧拆解**（见文末「蒸馏证据」）。
> ★ **本文件已于 2026-10-04 按新源码（2026-10-02 更新版）重写**：旧版曾误称「无 aspects 声明 / 无含 CJK 字体 / 建议补 9:16 重排」，三处均为旧源时代的错误结论，现已按新源码改正（详见第 2 节与第 11 节）。

---

## 1. 风格说明

**是什么**：一部「雕版自己刻出来」的**凹版印刷**片——线条是雕刀在铜上刻出的沟槽里兜住的墨，明暗全靠线密度，颜色是印完后手工罩上去的透明水彩。三条不可让步的硬规则：① **色调由线构成，绝不用填色**（亮 = 露白纸；半调 = 一族平行线；暗 = 第二族交叉；最深 = 第三族组成菱形；任何地方都没有灰块）；② **每条线都鼓胀与收尖**（等宽线读起来像钢笔/矢量，绝不允许）；③ **颜色后上、手工罩**（透明水彩一块块平铺在成品黑印上，溢出线条、边缘积色，墨始终在最上）（`STYLE.md:8-12`、`style-dna/engraving.md:11`）。

**不是什么**（最容易做错的邻居风格）：不是木刻（白底黑块 + 白色凿痕）、不是钢笔速写（松散断线）、不是工程图（`blueprint`）、不是褐色滤镜老照片（`STYLE.md:14`、`style-dna/engraving.md:13`）。

**什么时候用它**：博物馆物件标签 / 展柜屏、科学解说、品牌传承与工艺溯源、图鉴式知识短片（`dub-styles.json#engraving.tags`、`style.json:11-15`）。样片《The Honeybee, Plate VII》是给展柜旁屏幕做的一块**博物馆物件标签**：一只蜜蜂、它的名字、三件你不知道的事、以及去哪看真的（`DEMO.md:10`）。同一套引擎还被第二个影片模块复用：`demo/film_coffee.js` 用同一介质（`engine/*` 调用次序）讲《Coffea arabica, Plate I》——一条咖啡种子的贸易航线，带 9 个刻名站点（`film_coffee.js:106`、`content_coffee.zh.json`）。

**一句话内核**：一张 1920×1080 的手工帘纹纸就是整个世界；雕刀一线线刻出主体，放大圆窗把「在哪/是什么」一镜讲完，真静默之后，手工上色是奖赏。

**边界**：它撑不起——需要快节奏、强情绪、真人出镜、实拍或现代扁平 UI 的内容；也撑不起「一次讲很多并列信息」的密集片（每句只承担一层）。它是**慢**的：博物馆标签 30–40s、教材图 20–45s、一分钟讲 35–60s（`STYLE.md:103-109`）。

---

## 2. 画面构图

- **设计帧与重排系统**：所有坐标先按**设计帧** `NATIVE = { W: 1920, H: 1080 }`（`film.js:21`）写出；`makeFilm` 拿到 `opts.W/opts.H` 后调用 `layout(W, H)`（`film.js:22-33`）重推整个版面——`fx = W/1920`、`fy = H/1080` **拉伸位置**，`S = min(fx, fy)` **缩放所有尺寸**（圆窗半径、字号、引线、线宽、排线步长）。**1920×1080 时 fx = fy = S = 1**，每个表达式逐字节退化成设计帧（`film.js:19`、`:36-38`）。
- **支持的比例**：`FILM_META.aspects = ['16:9', '9:16', '3:4', '4:3', '1:1']`（`film.js:43`）——这 5 个比例**都能正确构图**（不是「声明支持但会裁切」）。控制台靠**读这段源码文本**探测（影片是浏览器 ESM，node 不能 import，见 `lib/aspects.mjs`），所以字面量必须保持 `aspects` 后跟方括号数组的形状。
- **主体位置与占比**：主体居中，落在**版痕**之内；版痕（压印倒角矩形）在设计帧 (70,44)–(1850,1036)，内 55% 版调 `#e8ddc2`；**双线边框**（2.4px 粗线 + 0.8px 发丝，内缩 9px）在 (100,72)–(1820,1008)（`DEMO.md:60`、`plate.js:41,47,61-62`）。圆形放大图占四角槽位：左上 (300,300)、左下 (300,700)、右下 (1620,700)、右上 (1620,300)，半径 120（`DEMO.md:68`、`film.js:26-27`）。
- **负空间 / 留白**：纸就是留白；亮部是**露白纸**，不是白色填充（`STYLE.md:10`）。
- **图层叠放顺序**（从底到顶）：纸 + 纸纹（纤维/帘纹/霉斑 `#9a6a34`，世界空间随镜头缩放）→ 版调与版痕倒角 → 手绘水彩（**乘算，纸之上、墨之下**）→ 墨线（轮廓 / 排线 / 交叉 / 暗部）→ 刻字与引线 → 字幕纸签（`DEMO.md:60,72`、`plate.js:44-48`）。
- **安全区**：主体在版痕内，标签与圆形图在页边；细节次序要让**推镜永不提前裁掉一条注解**（连续细节排在同一侧）（`STYLE.md:61`、`style-dna/engraving.md:92`）。
- **本风格不能出现的构图**：任何「填灰」（色调必须由线构成）；等宽线；文字或图形淡入/滑入；不透明色上到文字/边框/纸面（`style-dna/engraving.md:160-164`）。

**在 9:16（产品默认）下的表现**：**已正确适配，不再是缺陷**。9:16 = 1080×1920 时 `fx = 0.5625`、`fy = 1.7778`、`S = 0.5625`：版痕/边框被纵向拉伸填满画幅，四个圆窗槽位落到 (168.8,533.3) / (168.8,1244.4) / (911.3,1244.4) / (911.3,533.3)、半径收到 67.5，字幕纸签仍钉在底部 `y1 = 1058·fy`（`film.js:311`）。**本次样板片按原生 16:9 渲（1920×1080，2026-10-04 重渲）**，抽帧 24 张为 **16:9（360×202）**——版框、四个圆窗、引线、字幕条都在画内、没有裁切（帧 f05/f16/f22）。★ **注意区分**：**样板片 = 原生 16:9**（全库一致）；**9:16 是产品交付默认**，本风格**已适配**（上面 `fx/fy/S` 的推导就是 9:16 时的行为）。旧文档「本风格无 aspects、9:16 会丢右侧 43.75%」的说法来自**旧源**，已作废。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 纸 | `#f1e8d2` | 手工帘纹纸（米黄） | `plate.js:8`、`STYLE.md:18`、`DEMO.md:60` |
| 纸（版调） | `#e8ddc2` | 版痕内 55% 版调 | `plate.js:8`、`DEMO.md:60` |
| 纸纹霉斑 | `#9a6a34` | 稀疏 foxing | `plate.js:8`、`DEMO.md:60` |
| 墨（唯一） | `#1c1510` | 暖近黑，全片唯一墨色 | `plate.js:8`、`STYLE.md:19` |
| 墨（软） | `#3a2c20` | 次级墨线 | `plate.js:8` |
| 版痕倒角 | `rgba(96,70,40,0.42)` / `rgba(255,251,240,0.95)` | 左上压暗 / 右下受光 | `plate.js:9` |
| 引擎备用纸墨 | `#efe6cf` / `#1c1510` | `burin.js` 自带常量（与 `PAL` 略异） | `burin.js:15` |
| 字幕纸签底 | `#f4eddb` | 毛边纸签（软阴影） | `DEMO.md:66`、`film.js:314` |
| 字幕墨 | `#2b1e14` | 纸签上的手写体 | `DEMO.md:66`、`film.js:317` |
| 上色·腹 | `#d9962a` | 琥珀 | `DEMO.md:72`、`content.json` |
| 上色·胸 | `#a8743e` | 赭石 | `DEMO.md:72`、`content.json` |
| 上色·头 / 眼 / 腿 | `#8a6242` / `#6e4a3c` / `#7a5a3c` | 头 / 眼 / 腿 | `DEMO.md:72`、`content.json` |
| 上色·翅 | `#a9c3cf`（alpha 0.5） | 淡蓝灰 | `DEMO.md:72`、`film.js:138` |
| 上色·花粉 | `#eaa21a`（alpha 0.95） | 花粉 | `DEMO.md:72`、`film.js:138` |
| 铜版（仅开场） | `#5e2a12 → #94502c → #4e220e` | 抛光暖金属渐变 | `DEMO.md:74` |
| 铜沟槽 / 亮毛刺 | `#240c05` / `rgba(255,226,186)` | 暗槽 + 朝光亮毛刺 | `DEMO.md:74` |

- **明度 / 对比规则**：**印刷品只有两个值——纸与墨**，所有调子由线密度构成（`STYLE.md:28`）；单光源全片一致，惯例左上——主体模块自带 `L = {x:−0.55, y:−0.62, z:0.56}`（`subjects/bee.js:11`、`DEMO.md:64`），引擎默认 `B.LIGHT = {x:−0.55, y:−0.6, z:0.58}`（`burin.js:411`），两者略有出入、以各自调用点为准；背光轮廓更重（`STYLE.md:21`）。
- **禁止出现的颜色**：不透明色；给文字/边框/纸面上色；任何灰块填充（`style-dna/engraving.md:160,164`）。
- **同一画面最多几个色相**：墨色一种 + 水彩最多一种更强颜料（muted earth / mineral）；颜色要**省着用**——整个主体在一个时刻，或只有重要的那块，或完全不上（`STYLE.md:29-30`）。换铅芯式的转折：从纯黑白到上色本身就是一次事件（`STYLE.md:12`）。
- **通路派生色**：`lib/dub-styles.json#engraving.palette` = bg `#f1e8d2` / bg2 `#e8ddc2`（= `PAL.plateTone`）/ fg `#1c1510` / accent `#7F582B`（§3 未给 hex，此为土色**代理值**）/ subtitle `#1c1510` / subtitleOutline `#f1e8d2` / subtitleBack `#00000000`。`lib/dub-visual.json#engraving.palette.accent` 另记 `#9a6a34`（= `PAL.foxing`）——两处 accent 不一致，见第 11 节。

---

## 4. 转场规则

- **镜头之间怎么切**：转场**必须来自印刷工艺本身**——揭起印张（`drawPeel`，`film.js:353`）、盖下衬纸、局部擦掉重刻、换新纸上机（`STYLE.md:61`、`dub-visual.json#engraving.transition`）。帧 f22 就是「衬纸盖下」（tissue guard falls over the plate）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有溶解、没有划像**；**没有任何元素淡入/滑入**——文字要么被**刻**出来（罗马字逐字刻）、要么被**写**出来（手写体一笔从左到右）；线条被**刻**、颜色**晕开**、纸张被**压/揭/铺**（`STYLE.md:44`、`style-dna/engraving.md:117`）。
- **硬切点怎么定**：挂在 **96 BPM 网格**上（1 拍 = 0.625s，`film.js:21`）。停留规则（`film.js:60-67`）：首条细节 **9 拍 = 5.625s**，其后每条 **7 拍 = 4.375s**；细节后固定段 gather **2 拍** → silence **2 拍** → colour **8 拍** → landing **7 拍** → end **7 拍**；细节 1–4 条自动重排。本次 3 条细节：细节段 9.375→23.75s，silence 25.00–26.25s，colour 26.25–31.25s，landing 31.25–35.625s，end 35.625–40.0s（`film.js:57-68`，与 `logs/engraving.log:114-117,147-148` 的实测重音一致）。
- **转场时长与缓动**：圆形图沿缓动弧线飞行、带一点抬升、按对数线性长大到目标尺寸；颜色从一点晕开、边缘毛糙、湿边会干；各区错峰（`STYLE.md:43`）。首条长笔画 5.4s，**第 0 帧就已刻了约 1/3**，保证没有空帧（`DEMO.md:47`）。
- **绝对不要的转场**：溶解 / 划像等非印刷工艺的转场；无来由的运镜（`style-dna/engraving.md:163`）。

---

## 5. 字幕样式

★ 本风格有**两条通路**，字幕不是同一套实现，分别交代：

**通路 A · 样板片通路（`demo/` 自己画，Canvas）**：`film.js` 的 `drawSubs`（`film.js:305-319`）。字体 **Pinyon Script**（`FONTS.script`，`plate.js:11`）**38·S px**；字色 `#2b1e14`；坐在一块**手撕边纸签**上（`#f4eddb`，用 `B.RNG(7)` 逐点 ±2.2·S px 抖动出毛边，带 `rgba(60,40,20,0.28)` / 14·S px 软阴影）；底部居中，`y1 = 1058·fy`；最大宽 **860·S**、最多 **2 行**（`wrapLines` 定尺寸折行、不缩字号）；文字由 `writeScript` **一笔从左到右写出来**，整体 0.25s 淡入 / 0.2s 淡出（`film.js:307,309-317`、`dub-visual.json#engraving.subtitleStyle`）。
**通路 B · 「文案+风格」通路（`dub.mjs` + `buildAss`，ASS 字幕）**：`dub-styles.json#engraving.subtitle` = `fontFamily KaiTi` / `fontSizeFactor 0.042`（≈45px@1080）/ `marginVFactor 0.145` / `marginLFactor 0.08` / `outlineFactor 0` / `align 2`；字色 `palette.subtitle #1c1510`、描边色 `palette.subtitleOutline #f1e8d2`（纸色）。**本风格未开底衬**：`subtitle` 里没有 `plate` 键 ⇒ 缺省 `'shadow'`（= 旧行为）。原因有二：① demo 的底衬是**不规则手撕边纸签**（非矩形），ASS 的 `BorderStyle=3` 矩形盒画不出来；② 配置的 `palette.subtitleBack` 本就是**全透明** `#00000000`。字色 `#1c1510` 压在纸色 `#f1e8d2` 上，WCAG 对比度 ≈ **14.8:1**（按相对亮度算，远超 4.5）。
- **字幕与旁白的关系**：旁白是一位**安静的策展人 / 博物学家**（第三人称、现在时、克制不煽情）；字幕是纸签上的手写体，**永远不盖在标签上**（`STYLE.md:37`、`style-dna/engraving.md:44`）。
- **停留 / 折行规则**：提前 **0.1s** 上、滞后 **0.6s** 下；停留 ≥ `max(1.8s, 语音 + 0.6s)`；刻写注解停留 = `字符数 ÷ 12 + 1 s`（`STYLE.md:37`、`tools/subs.py`）。本次 5 条字幕即 `content.json` 的 5 行旁白，长度 42–81 字符（`title` 42 / `d1` 81 / `d2` 60 / `d3` 56 / `close` 63）。
- **CJK 字幕**：引擎（`plate.js`）已支持 CJK 字体栈与 CJK 断行（见第 7 节），`film_coffee.js` 已接线；但**本样片用的 `film.js`（蜜蜂）仍是拉丁默认字族**，中文题材请走 `film_coffee.js` 或给 `film.js` 补一行 `setFonts`（详见第 11 节）。
- **本风格特有的字幕禁忌**：**不透明色上到文字**；文字淡入/滑入；字幕压在行动号召（call to action）上；注解第三行会撞到下一个圆形图（`DEMO.md:66`、`DEMO.md:113`）。

---

## 6. BGM / 音效特征

- **配乐**：巴洛克室内乐——**羽管键琴 + 弦乐四重奏**，**96 BPM、D 大调**，16 小节 = 40.0s，三 stem（harpsichord / pizz / bowed）（`DEMO.md:53`、`music/score.py`）。`music/score.py` **读 events.json**：每个细节段落（A 长 / B 俯仰 / C 拉远再推）写一次、放在片子放它的位置，outro 跟着细节结尾平移，所以**任意数量的细节都能配到乐**（`style-dna/engraving.md:251`）。刻制段落**全用拨弦**（对应雕刀小而准的切），密度随趟数递增；每个圆形图 = 刻环高音「叮」+ 飞行上行线 + 落地低拨弦；上色前跑动戛然而止 → **真静默 1.25s** → 上色是弦乐第一次上弓；终版图版落 **V–I 终止式**（`DEMO.md:53`）。
- **拟音（按材料分层）**：纸（揭纸噼啪、衬纸轻拍、薄纸沙沙、整纸呼啦）；压印机（滚筒低鸣、闷响）；铜与钢（2.6–9kHz 带通雕刀嘶声 + 颤振 + 1.18/2.31/3.47kHz 版材共振、卷屑 5–9kHz 小叮、抬刀金属嗒、画圆刻划、擦亮摩擦）；墨与水（笔尖刮擦、刻字点状嗒、水滴 plip、湿笔唰）；排线 = 每一趟更密的微刮擦（`DEMO.md:55`）。
- **旁白处理**：Kokoro `bm_fable`（en-gb）、speed 0.92，一位温和的博物学家；音乐在人声下压到 **~50%**（弓弦压得最少）；旋律比人声高一个八度（`DEMO.md:56`、`STYLE.md:69`）。
- **响度目标**：`-14 LUFS`；**交付真峰值上限**：`-1.2 dBTP`（项目级交付线；本风格 `STYLE.md:69` 只写 −14 LUFS，未额外声明更严上限）。**本次成片实测：I = −14.14 LUFS / LRA 5.2 LU（`ebur128`）/ 真峰值 −1.54 dBTP（`loudnorm` 的 `input_tp`，4× 过采样）—— 真峰值远在 −1.2 dBTP 交付线内、未削波**（`logs/engraving.log:177-180` 的 ebur128 `Peak: -1.5 dBFS` 与 `astats` `Peak level dB: -1.577556` 都是**低精度峰值读数**（1 位小数 / 采样峰值），只能当参考，不能当真峰值用）。
- **静默策略**：静默是**真实存在的一段，不是空**。本次实测两处：**0.0–1.87s** 与 **25.00–26.25s**，均 peak **−240.0 dBFS**（全层数字零），此时连房间底噪都压到 0.25 倍，全片只留一个极小的声音（`DEMO.md:54`、`style-dna/engraving.md:94`、`logs/engraving.log:147-148`）。
- **混音/编码前峰值**：`score.py` 的限幅前峰值在 7.538s / 2.585s / 15.955s 分别为 **+1.1 / +0.6 / +0.1 dBFS**，靠 limiter 压回；最终 `mix.wav` peak **−1.20 dBFS**、integrated **−18.0 LUFS**（`logs/engraving.log:85-87,154`）。

---

## 7. 素材偏好

- **需要什么素材**：一个**主体模块**（导出 `{ink, regions, focus}`；`ink` 必须以一条名为 `ol0` 的首笔画打头——镜头跟随的就是它；`regions` 供上色与引线避让；`focus` 供放大圆形图取景）；一份 `content.json`（标题/学名/版号/系列/细节 1–4 条/上色区/图注/签名/旁白）；字体（见下）。参考实现 `demo/subjects/scallop.js`、`demo/subjects/bee.js`（`style-dna/engraving.md:194-199`）。
- **demo 内置的 4 个主体模块**（新源新增后）：`subjects/bee.js`（蜜蜂）、`subjects/scallop.js`（大扇贝）、`subjects/coffee.js`（咖啡植株，`buildCoffee`，`coffee.js:65`）、`subjects/chart.js`（航线图条，`buildChart`，`chart.js:75`）；放大图另有两套：`subjects/details.js`（bee：eye / hamuli / corbicula）与 `subjects/details_coffee.js`（coffee：flower / cherry / seed / harbour）。`film_coffee.js` 用 `buildCoffee` + `buildChart` 组装《Coffea arabica》并带 9 个刻名站点。
- **字体**：demo 自带 OFL 字体 3 个文件（Bodoni Moda 正/斜 VF、Pinyon Script，`demo/fonts/`，`fonts.css`）；**中文题材不必自备**——共享层 `core/lang/fonts-zh.css` 已提供两张 OFL 子集：`Noto Serif SC`（思源宋，罗马体角色，wght 200–900）+ `LXGW WenKai`（霞鹜文楷，手写体角色）。中文的罗马体角色必须是**字体栈** `"Bodoni Moda", "Noto Serif SC"`——Bodoni 有字形就用 Bodoni，缺字（汉字）才落到中文字体（`core/lang/lang.mjs:43-47`、`core/lang/fonts-zh.css`）。
- **不需要什么素材**：图库照片、实拍、3D 模型、扁平 UI 组件、任何现代图标（`style-dna/engraving.md:160-166`）。
- **取景 / 质感 / 比例偏好**：**排线间距相对主体高度**（约 1/180），小图形不会糊灰；单光源；几何遮挡（线条遇前景直接断，传 `excl` 逐环相减，**不能用 even-odd**，否则重叠处互相抵消）（`STYLE.md:19,21`、`style-dna/engraving.md:38`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：新主体写成模块（返回 `{ink, regions, focus}`）；没有画好的放大图时，某个 focus 键会**对主体本身实时放大**（`film.js:92` 的 `{ magnify: true }`）；细节不足 1–4 条时，空槽位显示**自然尺寸小图**（`DEMO.md:68,112`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 首条细节 9 拍 = 5.625s（长签名镜头），其后每条 7 拍 = 4.375s（`film.js:64`） |
| 全片时长 | 40.0s（`style.json:17`、`film.js:68` 的 `DUR = T.end[1]`）；alt 内容 35.6s；文档给 20–60s 区间（`style-dna/engraving.md:92`） |
| 镜头数 | 博物馆标签式：铜版 ECU → 揭印 → 拉远到图版 → 3 条放大细节 → 静默 → 上色 → 锁定终版 → 衬纸结尾卡（`DEMO.md:12`）；本次事件 53 条、字幕 5 条（`logs/engraving.log:39,166`） |
| 信息投放节拍 | 版号 + 系列 → 标题（罗马大写）+ 斜体学名 → 主体成形（轮廓 → 排线 → 交叉 → 暗部）→ N 条放大细节（每条：在哪 → 是什么 → 一句注解）→ 采集完成（自然尺寸对照）→ 静默 → 手工上色 → 锁定终版 → 衬纸结尾卡（`style-dna/engraving.md:65-77`） |

- **加速 / 减速点**：刻制段落密度随趟数递增（`film.js:72-76` 的 `conc` 1→16→70→70→90）；细节段落 A 长 / B 俯仰更快 / C 拉远再推（加速）；上色段只有 ≤2% 呼吸轻推——**颜色在动，镜头不动**（`DEMO.md:43-44`）。
- **留白与静音的位置**：0.0–1.87s 与 25.00–26.25s 两处真静默；**上色一定发生在静默之后**——这样它读起来是奖赏，而不是新信息（`style-dna/engraving.md:94`、`film.js:66-67`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/engraving/demo/build.sh` 为准；本次成片的口径以 `_distill/logs/engraving.log` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/engraving/demo --fps 24 --workers 6 --ratio 16:9 --out .../video_gpu.mp4`（**2026-10-04 重渲**，样板片走原生 16:9 = 1920×1080）；`build.sh:21` 用 `--workers 2` 且不传尺寸（同样落在设计帧 1920×1080） |
| 帧率 | 24 fps（960 帧 / 40s，`logs/engraving.log:158`） |
| 分辨率 / 比例 | **1920×1080 / 16:9**（样板片原生比例，2026-10-04 重渲实测）；设计帧 `NATIVE = {W:1920,H:1080}`，`aspects` **声明支持 5 种比例**（`film.js:43`），**9:16 为产品交付默认** |
| 编码器 | **GPU 优先：未设 `LEMO_VENC` ⇒ `h264_nvenc`**；本次日志「编码 nvenc」（`logs/engraving.log:7`） |
| 混流 | `sh core/render/mux.sh $D/out/video.mp4 $D/mix.wav $O/engraving.mp4 24 4`（−14 LUFS，**grain 4**）（`build.sh:22`）；本次 `MUX_OK 34288116 src_frames=960 out_frames=960`（`logs/engraving.log:174`） |
| 音频入口 | `demo/music/score.py`（读 events.json 的巴洛克配乐）+ `demo/mix.py`（foley + 人声 + 闪避三 stem） |
| 字幕入口 | `demo/tools/subs.py $C`（生成 `out/subs.json`）+ `core/render/srt.py`（`build.sh:18`）；本次 5 cues（`logs/engraving.log:166`） |
| 事件导出 | `node $D/tools/events.mjs $D $C`（本次 events 53 dur 40，`logs/engraving.log:38-39`） |
| 本风格专属参数 | `$D/tools/cuecheck.py`（配乐重音 ↔ 画面事件全部在 1 帧内 + 静默电平，本次 **ALL CUES WITHIN TOLERANCE**，`logs/engraving.log:156`）；换内容用 `--q "content=$C"` |
| 一键复现 | `sh styles/engraving/demo/build.sh [content.json]`（voice → check → score → events → mix → cuecheck → srt → frames → mux → stills，`build.sh:1-25`） |
| 备用构建 | `sh styles/engraving/demo/tools/build_alt.sh my_content.json`（在 `demo/out/alt/` 里建，不动主片）（`DEMO.md:121`） |
| 本次编排器调用 | `node lemo-make.mjs engraving --skip-sync --no-preflight --ratio 16:9`（**显式给原生 16:9**）★ 教训：此前一次**漏传 `--ratio`** ⇒ 落到编排器的**产品默认 9:16**，把样板片渲成了 1080×1920（与全库 33 部 16:9 不一致）；根因已修：`style-distill.mjs` 现在**显式传 `--ratio 16:9`** |

---

## 10. 编排规则

- **内容文件字段契约**（`content.json`，`style-dna/engraving.md:174-188`、`DEMO.md:105-119`）：`title` ≤22 字符（超长需在 `film.js` 降到 44px）；`latin` ≤30 字符（须在 9.4s 首次推镜前满足 chars/12+1s）；`plate_no` ≤10 / `series` ≤48；`subject` ∈ `"bee"` \| `"scallop"` \| `"coffee"`（未知回退 `bee`）；`details[]` 1–4 条（>4 被忽略；不足则空槽位显示自然尺寸图，时间轴自动重排）；`details[].focus` 取该主体 focus 键（无对应放大图 → 对主体本身实时放大）；`details[].note` ≤60 字符（2 行 29px，第 3 行会碰下一个圆形图）；`colors[]` `{region,color}`（未知 region 跳过，顺序即上色顺序）；`caption` ≤50 字符；`signature.left/right`；`nat_size_label` ≤16；`voice.voice/speed/lines[]`（id：`title`/`d1..dN`/`close`，d 行 ≤4.5s）；`end.film_title/style_name/credits[]`（credits ≤3 行 × ≤35 字符）。★ 中文版（`content_coffee.zh.json`）另有 `lang: "zh"`、`stations{ 站点键 → 译名 }`、`voice.engine: "indextts"`、`voice.lang: "cmn"`，字幕 id 扩展到 `s1..s4`（`core/lang/lang.mjs:29-56`）。
- **事件词汇表**（`type` → `mix.py` 里的声音）：`burin`（带通嘶声+颤振+版材共振）/ `lift` / `press` / `peel` / `hatch` / `pass{g}` / `title{n,dur}` / `push{i,role,dur}` / `ring` / `burnish` / `cut{i}` / `travel` / `land{i}` / `letters` / `quill{i}` / `natsize` / `silence{until}` / `drop{region}` / `landing` / `dot` / `tissue` / `vo{id,dur}`（`film.js:381-393`、`style-dna/engraving.md:211-234`）。
- **时间线契约**：`makeFilm(C, voiceDur, opts)` 返回 `{render, DUR, T, EV, subs, dets, cam}`（`film.js:395`）；`render(ctx,t)` 逐帧绘制，`EV` 按时间排序（由 `tools/events.mjs` 序列化成 `events.json` 驱动声音）；页面契约 `window.READY / window.render(t) / window.DUR / window.EV`（`main.js:21-26`）。`main.js` 另把 `FILM_META` / `LINES` / `probeAt` 挂到 `window`，供控制台探测比例与做一致性核对（`main.js:22-24`）。
- **新增主体怎么接入**：写一个主体模块，导出 `{ink, regions, focus}`——`ink` 是 `B.Ink` 描边库、**必须以一条名为 `ol0` 的首笔画打头**；`regions` 是 `{regionName: {path, polys, bbox}}`；`focus` 是 `{focusKey: {x,y,r}}`。参考实现 `demo/subjects/scallop.js` / `coffee.js`（`style-dna/engraving.md:194-199`）。
- **换主题时要改哪些文件**：① `demo/content.json`（所有字、数、色）；② 新主体模块（放 `demo/subjects/`）；③ 若换配色改 `content.json` 的 `colors[]`（不改引擎）。**注意**：`STYLE.md:117` 与 `DEMO.md:136` 明确——换 `content.json` 重跑只是「验证引擎能重排的技术检查，**不是做片子的方式**」；真正的做法是先写 treatment，再据此产出素材。配乐不用改（`score.py` 读 events.json，任意细节数都能配乐）。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里可生效的参数有 `palette`（bg `#f1e8d2` / bg2 `#e8ddc2` / fg `#1c1510` / accent `#7F582B` / subtitle `#1c1510` / subtitleOutline `#f1e8d2` / subtitleBack `#00000000`）、`bgRecipe`（type=solid / texture=paper / vignette 0.12 / seed 53）、`subtitle`（KaiTi / 0.042 / 0.145 / 0.08 / 描边 0 / align 2，**未开底衬**）、`title.fontSizeFactor 0.046`、`motion.subtitleFadeIn 0`、`overlay.chapterCards true / accentRule true`（`dub-styles.json#engraving`）。

---

## 11. 当前短板与避坑要点

### ★ 三处旧文档错误声称（已按新源码改正）
1. ~~「无 `aspects` 声明，只按 1920×1080 硬坐标」~~ ⇒ **错**。新源 `film.js:43` 明写 `aspects: ['16:9','9:16','3:4','4:3','1:1']`，并有 `layout(W,H)`（`film.js:22-33`）做**多比例重排**；1920×1080 时 `fx=fy=S=1` 逐字节退化，所以旧样片看不出差别，但**改造是真的**。
2. ~~「demo 自带字体无含 CJK 的手写/衬线字体」~~ ⇒ **错**。引擎 `plate.js` 新增 `setFonts()`（`:15`）+ `fontSpec()`（`:70`）**字体栈支持**与 **CJK 断行**（`wrapCJK`，`:149-229`，含行首/行尾**禁则**与 `Intl.Segmenter` 分词）；共享层 `core/lang/lang.mjs:40-55` 提供 zh 字族（`"Bodoni Moda", "Noto Serif SC"` + `"LXGW WenKai"`），`core/lang/fonts-zh.css` 提供两张 OFL 子集，`index.html:4` 与 `main.js:5,12,15` 都已接线。**唯一保留的小缺口**：本样片用的 `film.js`（蜜蜂）**没有**调用 `setFonts`，仍是拉丁默认字族；真正接线的是 `film_coffee.js:282`（`plate.setFonts(L.fonts)`）。做中文题材请走 `film_coffee.js`，或给 `film.js` 补同一行。
3. ~~「下次迭代：给 `style.json` 补 `aspects` 或提供 9:16 重排方案」~~ ⇒ **已不需要**。9:16 **就是本项目的产品默认输出比例**，而本风格已正确支持它；★ 但**样板片按原生 16:9 出**（2026-10-04 重渲为 **1920×1080**，抽帧为 16:9 且构图完整）。旧建议「补 9:16 重排」会**直接误导**下游——照它做等于把已经做好的事情再拆一遍。

### ★ 本次最大教训：WSL 副本长期过期 ⇒ 成片来自旧源
- 2026-10-02 WIN 侧给本风格做了较大更新（新增 `subjects/chart.js`、`coffee.js`、`details_coffee.js`；`engine/plate.js` 加 `setFonts`/`fontSpec` + CJK 断行；`film.js`/`film_coffee.js`/`main.js`/`index.html`/`engine/burin.js`/`tools/events.mjs` 更新；含 `layout()` 多比例重排），**但从未同步到 WSL**。
- 而**渲染读 WSL、源码指纹读 WIN** ⇒ 2026-10-03 那次成片**实际来自旧源**，`_distill.json` / `SKILL.md` 也全按旧源写（于是有了上面三处错误声称）。
- 2026-10-04 已把 9 个源文件 + `core/README.md` + `MAINTAINING.md` 同步到 WSL（两侧逐字节一致），并用新源**重渲**（成片真峰值 −3.27 dBTP，已核验）。★ **2026-10-07 更正**：上面这句里的 `−3.27 dBTP` 是那次**重渲前版本**的读数（**原记**）；本片已于 2026-10-07 重渲，当前入库成片的真峰值 = `loudnorm` 的 `input_tp`（4× 过采样）**−1.54 dBTP**（见 `_distill.json` 的 `selfCheck.loudness.truePeakDbtp`）。
- **记住的规则**：给这个风格（以及任何「WIN 写码 / WSL 渲染」的风格）改源码后，**先同步双副本再出片**，否则出片、抽帧、文档会一起建立在旧源上；核验时不要只看源码指纹，要**把两侧文件逐字节比一遍**。

### 已知缺陷
- **ASR 校对未通过 1 条**：本次 `mismatches: 1`，标题行 `Apis mellifera` 被 whisper 转成 `a piece mellafura`（`DIFF title | …`），日志有 `STEP_WARN asr_check 未通过（继续）`——ASR 失败不致命、只警告，但这句学名的可听性存疑（`logs/engraving.log:72,79-80`）。`STYLE.md:93` 的既定对策是给 checker 一个 plain spelling（`asr` 字段），标题行已设 `asr`，仍差 1 条。
- **配乐限幅前峰值超过 0 dBFS**：`score.py` 在 7.538s / 2.585s / 15.955s 的限幅前峰值分别为 `+1.1 / +0.6 / +0.1 dBFS`（`logs/engraving.log:85-87`），靠 limiter 压回；最终 mix peak `-1.20 dBFS`、mix integrated `-18.0 LUFS`（`:154`），成片安全但配乐本身头部余量偏紧。成片真峰值实测 **−1.54 dBTP**（`loudnorm` `input_tp`，4× 过采样），在 −1.2 dBTP 交付线内、未削波。
- **通路派生条目与两处 accent 不一致**：`dub-styles.json#engraving` 的 `accent #7F582B` 只是 §3「透明水彩、赭石与矿物色」的**土色代理值**、非 §3 原文色；字幕字体用 `KaiTi` 顶替 Pinyon Script（通路侧本机无 Pinyon，demo 自带该 OFL 字体）。`dub-visual.json#engraving.palette.accent` 记的却是 `#9a6a34`（= `PAL.foxing`）——**同一风格两个 accent**，下游复现时存在色值漂移风险。★ 另：`dub-styles.json#engraving.notes` 仍写着「`bg2` = null（源文件只给一个纸色）」，而**实际字段 `palette.bg2` 已是 `#e8ddc2`**（= `PAL.plateTone`）——notes 文本已陈旧（本文件不在我的可改范围，仅记录）。

### 素材缺口
- 依赖**一个画好的主体模块**（`{ink, regions, focus}`，`ol0` 首笔画）；demo 内置 4 个主体（`bee` / `scallop` / `coffee` / `chart`）+ 两套放大图（`details.js` / `details_coffee.js`），新主题仍须自备主体几何。
- **本样片（`film.js` 蜜蜂）未接 CJK 字体**：引擎与 `film_coffee.js` 都已支持，但 `film.js` 缺一行 `setFonts`（见上「三处旧文档错误声称」第 2 条）。

### 能力限制
- 慢风格：20–60s 区间，一次只讲一个主体 + 1–4 条细节；不适合快节奏与并列多观点。
- 色调由线构成，**不能填灰**——需要大面积平色块的内容不适合。
- 换 `content.json` 只能做技术检查，不能当创作方式。

### 踩过的坑（本机实测）
- **翅膀脉络必须闭合**——随机脉络线看起来是假的，长脉络定义成曲线、横脉吸附上去（`DEMO.md:94`）。
- **腿关节画成整段胶囊像一串珠子**——要排除上一节、只露远端帽（`DEMO.md:95`）。
- **同一 demo 文件夹的两次渲染会互撞**：`video.mjs` 把分段写进 `<demo>/out/`，主片与 alt 片要**先后**渲（`DEMO.md:96`）。
- **雕刀偏线 30° 读成「在旁边戳」**——`0.22 rad`（≤15°）解决（`DEMO.md:97`、`STYLE.md:89`）。
- **引线贴着翅膀读成穿过翅膀**——需留 ≥34px 余量（`DEMO.md:98`）。
- 等宽线读成钢笔 → 用鼓胀排线、轮廓在交接处收细，`wMin` 保持发丝级（`style-dna/engraving.md:86`）。
- 圆形图若按小尺寸绘制会冻成亚像素 → 按 500 单位半径绘制再缩进（demo 实际半径 120）（`style-dna/engraving.md:90`）。
- **`lines.json` 是生成物，别手工改**：它由 `build.sh` **第 1 步**从 `content.json` 的 `voice` 块派生（`build.sh:8`）。本 demo 的配音引擎是 **Kokoro**，只认 `bm_fable` 这类 Kokoro 音色；它曾被一次 `--voice zh_kepu9` 覆盖污染（`zh_kepu9` 是**中文 Index-TTS 通路**的音色，见 `content_coffee.zh.json`），导致 `tts.py: unknown voice`、出不了片。现 `lines.json` 已是 5 行、`voice=bm_fable`。**结论：要改旁白只改 `content.json` 的 `voice.lines[]`，再跑 build.sh；永远不要手工编辑 `lines.json`。**

### 下次迭代优先补什么
- 给 `film.js`（蜜蜂）补一行 `setFonts(L.fonts)`，让**本样片也能直接出中文版**（引擎能力已就绪）。
- 消除 `lines.json` 被 `--voice` 污染的风险（例如让 `build.sh` 第 1 步总是覆盖、或在 tts 前校验 `voice` 是否在该引擎的音色表内）。
- 给 `score.py` 留足头部余量，避免限幅前峰值超过 0 dBFS。
- 修标题行 ASR（换更易转写的学名读法或调整 `asr`）。
- 统一 `dub-styles.json` 与 `dub-visual.json` 的 accent 值（`#7F582B` vs `#9a6a34`），并订正 `dub-styles.json#engraving.notes` 里「bg2 = null」的陈旧文本。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03（首版）· **2026-10-04 按新源码重写** |
| 成片 | `D:/lemo-films/engraving/engraving.mp4`（40.00s / 37.5MB / **1920×1080 16:9** / 960 帧） |
| 抽帧 | `D:/lemo-tools/_distill/frames/engraving/`（24 帧 + 接触印样，均为 **16:9**：单帧 360×202、印样 1920×720） |
| 风格匹配度自评 | **93/100** |
| 详细资料 | 有（STYLE.md / DEMO.md / style.json / build.sh / content.json / content_coffee.zh.json / lines.json / style-dna .md+.json / dub-styles.json#engraving / dub-visual.json#engraving / demo 源码 / core/lang / 出片日志） |

**逐帧拆解要点**（帧时刻按 `t(NN) = (NN − 0.5) × dur / 24`，dur = 40.0 ⇒ 每帧 1.667s）：f01（0.83s）开场铜版 ECU——抛光暖铜 + 模糊的四格窗反射，雕刀刀尖在刻、卷屑升起，铜面上有淡淡的蜜蜂描线（镜头跟随刀尖）；f03（4.17s）已拉到纸面、正刻蜜蜂——只有轮廓 + 翅面排线，无标题、无上色；f05（7.50s）标题段：顶部刻出「THE HONEYBEE.」+ 斜体学名「Apis mellifera」，蜜蜂居中偏下，底部纸签手写字幕「Plate seven. The honeybee: Apis mellifera.」；f07（10.83s）推镜到复眼特写，排线随形体弯曲，字幕「Each eye is built from some six thousand facets…」；f13（20.83s）图版上已有 FIG. 1（复眼，左上槽位）与 FIG. 2（翅钩，左下槽位），第三个圆窗正在右侧成形，字幕「And on the hind leg, a basket, for carrying pollen home.」；f16（25.83s）全图版完成——四条标签、两条引线、右上「NATURAL SIZE」自然尺寸小图，仍是**纯黑白**；f17（27.50s）手工上色进行中：腹部琥珀、翅淡蓝灰、胸赭石，乘算在墨之下，边缘有湿边与溢出；f20（32.50s）锁定终版——标题、三条 FIG 标签、图注「See the living hive in Gallery 4」、签名（del./sculp.）齐；f22（35.83s）衬纸（tissue guard）半透明盖下；f23/f24（37.50 / 39.17s）衬纸上的结尾卡「THE HONEYBEE, PLATE VII / Copperplate Engraving / LEMO OPUSCAR / LemoLab × Claude Opus 5.5 / 三行 credits」。全片纸色恒定（无冷暖推移），靠线密度与最后的上色制造起伏；转场全是印刷工艺动作（揭印/衬纸），无溶解无划像。**24 帧均为 16:9（1920×1080 样板片），版框、四个圆窗槽位、引线、底部字幕条全部落在画内、无裁切**。

**自检发现的缺陷**：ASR 标题行未通过 1 条（`Apis mellifera` 转写失败）；配乐限幅前峰值 >0 dBFS；通路字体回退 KaiTi、accent 为代理色且两处不一致；`lines.json` 曾被 `--voice` 污染。（旧版还记过「无 aspects / 无 CJK / 9:16 不适配」三条，**均为旧源时代的错误结论，已作废**。）

**本次为补齐短板做了什么**：未改动 `D:/lemo-opuscar` 下源码，未起渲染或 TTS。上游已于 2026-10-04 把 9 个源文件 + `core/README.md` + `MAINTAINING.md` 同步到 WSL 并用新源重渲；本次仅按**新源码 + 新成片抽帧 + 实测数据**重写本目录两份交付物（SKILL.md + `_distill.json`），并把「WSL 副本过期 ⇒ 成片来自旧源」这一坑写入第 11 节。
