---
name: lemo-style-watercolor
description: 【lemo 风格 Skill · 水彩笔刷】要做自然 / 科普 / 旅行题材的安静纪录片、想让画面「被一笔一笔画出来」、并让配色本身承载数据时用。暖棉纸 + 透明笔触与飞白 + 手写注记，一镜到底的长卷横移，题在纸上的双语字幕。选定本风格做视频时，优先读本文件。
slug: watercolor
name_zh: 水彩笔刷
category: 手绘与绘画
film: Follow the Rain
---

# 水彩笔刷（`watercolor`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/watercolor/STYLE.md` · `styles/watercolor/DEMO.md` · `styles/watercolor/demo/`（无 `build.sh`）·
> `lib/style-dna/watercolor.json` · `lib/style-dna/watercolor.md` · `lib/dub-styles.json#watercolor` ·
> `styles/watercolor/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一页**自己画出来**的手绘日记。暖色棉纸 `#f1e9da` 垫在底下，它是唯一的白，也是橡皮；一切由**一笔一笔的笔触**构成——一条宽度按轮廓走的半透明色带，加 3–9 条断成虚线的飞白毛，交叉处像透明颜料一样变深。**没有一根矢量线**，形体侧面那条更重的边笔（`engine.js` `edgeOf`）是唯一的「线」。东西自己一笔一笔画进来（先结构后细节：干→枝→叶），上面浮一层手写注解（Caveat 标签 + 钢笔引线 + mono 实测值 + Cormorant 标题）。（`STYLE.md:6-14`、`style-dna/watercolor.md:11`）

**不是什么**（最容易做错的邻居风格）：不是水墨（有色、不是墨阶，没有书法式的一挥）；不是厚涂（没有厚颜料、没有刮刀）；不是儿童绘本（没有蜡笔、没有卡通描边）；也不是「矢量插画上叠一层水彩纹理」——必须是**笔触本身**构成形体。（`STYLE.md:14`、`style-dna/watercolor.md:13`）

**什么时候用它**：自然纪录片、科普解释、旅行、地质 / 气候 / 生态这类「有真实数值可测」的题材；也适合菜谱、器物解剖、一年十二页的写生册合集。

**一句话内核**：**painting-in 即揭示，配色即数据**——一支笔在纸上留下的东西就是全部。

**边界**：撑不起快节奏、高信息密度、强冲突的内容。它**没有硬切、没有通用溶解、没有淡入滑入**；不适合广告的密集卖点罗列、多人对话、以及需要精确图表的内容（连续 ramp 读起来像软件，只有量化成 4–6 个色带才像颜料，`STYLE.md:30`）。

---

## 2. 画面构图

- **镜头数与画幅**：样片 **113.6 s 一镜到底**（全片没有一次硬切，`DEMO.md:44`）；原生 **16:9（1920×1080）**，**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，字面量在 `styles/watercolor/demo/film.js:23`）。抽帧即 16:9，是权威证据。
- **主体位置与占比**：每屏一个 hero 主体 + 它的一条注记。地平线约在**画面高 71%**（1920×1080 下 y≈760–822，`scene.js` `buildHorizon` / `drawHorizon`）。主体（树、草丘、动物）落在主层，占画面高约 20–45%；四层视差 far 0.25 / mid 0.55 / main 1.0 / fg 1.55，越远越小越淡（`LAY`，`DEMO.md:82`）。朱红太阳是右上偏中的一枚「印章」，直径约画面宽 3%。
- **负空间 / 留白**：纸色留白很大——上半部（天）与左下 / 右下角基本是未上色的纸。注解层刻意避开主体：labels never cover the subject（`STYLE.md:65`）。
- **图层叠放顺序**（从底到顶）：程序化纸（`paper.jpg`，每帧第一件事就画它）→ 远景 wash 条 + 远树（视差 0.25 / alpha 0.5）→ 层间纸色雾带 → 中景（0.55 / 0.78）→ 地面 wash → 地平线 → 主层植物（1.0）→ 动物 → 火 → 前景（1.55 / 0.95）→ 雨 → HUD（区块卡左上 / 雨量计右上）→ 片头 / 片尾 → 字幕。（`DEMO.md:82`、`scene.js` `drawLandscape`、`main.js` `render(t)`）
- **安全区**：顶部 HUD 左侧从 **x=76（约 3.96% 画面宽）** 起排，区块卡名 Cormorant 52 px；雨量计贴右上；字幕居中在底部（英文基线 y≈1000 或 962，中文行 y=1042，`DEMO.md:88`）。76 px 的边距窄于常见的 5% 安全区，是本风格构图上最紧的一处。
- **本风格不能出现的构图**：硬切 / 溶解 / 淡入滑入；给文字或边框铺底、做成通用字幕框；标注压住主体；矢量描边；画纯白（白 = 未上色的纸）；满画幅塞满元素。

**在 9:16（产品默认）下的表现**：**已适配 9:16**（★ 2026-10-04 改造）——`FILM_META.aspects = ['16:9','9:16']`，字面量落在**新建的 `styles/watercolor/demo/film.js`**（`film.js:23`）。改造点：`film.js` 导出 `NATIVE` 与 `setFrame(w,h)`（把设计帧 `W/H` 派生为当前帧 `FW/FH/FX/FY/S = min(fx,fy)` 与居中偏移 `OX/OY`，`film.js:10-14`），并提供 `fit(a,b,c,d,e,f)` —— 把「设计帧坐标里的局部变换」折进**等比装入**（`film.js:18`）；`index.html` 在 `engine.js` 之后加载 `film.js`（`index.html:4`）；`main.js` 首段读 `window.innerWidth/Height` 设 `cv.width/height` 再 `setFrame()`（`main.js:4-5`），`render()` 先用纸铺满**当前帧**（按原尺寸平铺、不拉伸纹理），再 `fit(1,0,0,1,0,0)` 把整幅画（风景 / 地图 / HUD / 字幕 / 片头片尾）按设计帧等比装入（`main.js:228-230`）；`scene.js` 的 **7 处绝对 `ctx.setTransform(...)` 全部改为 `fit(...)`**（`scene.js:224,234,272,275,471,507-508`）—— 世界坐标**不再**乘 `FX/FY`（乘了就是双重缩放）。

★ **落到哪一档：等比装入 + 同色留白**。水彩世界是一条**横向卷轴**（`camXf` 沿世界 x 平移，地平线固定在设计 y≈745），没有纵向可填充的内容，所以 1080×1920 下设计帧按 `S = 0.5625` 等比缩到 **1080×607.5 居中**，上下各 **656 px** 留白 —— 留白就是**纸色 + 纸纹**（`PAPER #f1e9da` + `paper.jpg` 平铺），而本风格天空顶端与地面底边本就渐隐到纸，留白即纸，读起来是「同一张画裱进更高的纸框」。**不裁切、不变形**：右上雨量计、左上区块卡、居中片名与字幕、地图右栏图例与 `today` 全部完整在框内（56.8s 那帧英 / 中双行字幕实测完整、未贴边）。★ **代价（如实记）**：画面只占当前帧高的约 **32%**，留白偏大；设计帧底边（地面 wash 结束处）在竖幅里会显出一条硬边 —— 这是「等比装入」这一档的固有代价，不是 bug。

**实测（1080×1920，`S = 0.5625`）**：**16:9 逐字节未变**（17 个时间点 md5 与改造前完全一致）；9:16 与「16:9 中心裁切」的 SSIM = **0.898 / 0.747 / 0.881**（17.0 / 56.8 / 96.6s；口径 `crop=607:1080:656:0` 后 `scale=1080:1920`，ffmpeg `ssim` 的 `All` 值），明显 < 1 ⇒ 不是裁切而是重排（值偏高，是因为两图各有约 68% 是同色留白，内容区已完全重排）。**旧结论已作废**：按 1920×1080 绝对像素构图时「右侧丢 43.75%、下方整片黑、雨量计整块丢失」的记述不再成立。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 底（纸） | `#f1e9da`（`paper.py`：暖底 + 三层平滑噪声 ±3.5% + 约 2600 条短曲线纤维 + 细颗粒 + 5% 暗角） | 全片背景，也是擦除用的雾；**它是唯一的白** | `STYLE.md:18`、`DEMO.md:64` |
| 墨 | `INK #2b2520` | 线、文字、树干边笔、地平线 | `DEMO.md:66` |
| 墨·浅 | `INK2 #3d3129` | 枝条、茎 | `DEMO.md:66` |
| 强调·朱红 | `#cf4f2c`（太阳，叠 7 条 `#b8401f` 干笔横杠，读起来像印章） | 反复出现的重音：太阳 | `DEMO.md:66` |
| 强调·雨蓝 | `#3f7fa8` | 雨滴、雨量计填充与落点标记 | `DEMO.md:66` |
| 区块·沙漠 | 天 `#f0d6b8` / 远山 `#dcae8e` / 中景 `#dba47e` / 地 `#dda27a` | 第 1 区地面色最饱和 | `DEMO.md:72` |
| 区块·疏林 | 天 `#ece2cd` / 远山 `#bdb99c` / 中景 `#cbc28f` / 地 `#dccb92` | 稻草色段 | `DEMO.md:74` |
| 区块·湿林 | 天 `#dfe3dc` / 远山 `#9fb1b8` / 中景 `#98aa8a` / 地 `#a7b48e` | 转冷、加灰 | `DEMO.md:75` |
| 区块·雨林 | 天 `#dbe3d8` / 远山 `#9ab19f` / 中景 `#6f8d6d` / 地 `#6e8b69` | 全片最深的绿 | `DEMO.md:76` |
| 地图降雨 ramp | 150 mm `#cf7c4f` → 300 `#cda35f` → 650 `#b3b07a` → 1150 `#7f9a6c` → 2000 `#46705a` → 4000 `#2f5a45` | 地图填充，量化成 5 个色带 | `DEMO.md:78`、`main.js` `MSTOP` |
| 字幕 | `#2b2520`（ink 78% 不透明度，纸色光晕） | 题在纸上的双语字幕 | `STYLE.md:38` |

- **明度 / 对比规则**：**纸是白**——永不画纯白，亮 = 未上色的纸；**深色靠叠色次数**，不是把更深的颜料盖上去（同一多边形画 3 遍、顶点各自抖动、每遍 `a/3×1.6`，各遍不一致处边缘变深，即「淡彩积边」，`STYLE.md:28`、`DEMO.md:80`）。深度靠图层：越远越小、越淡、越不饱和。
- **禁止出现的颜色**：纯白（白只能是纸）；不透明厚色块；第二种无来由的强调色（朱红与雨蓝各只有一个语义）。
- **同一画面最多几个色相**：**3–5 个色相 + 墨**（`STYLE.md:30`）。ramp 必须量化成 4–6 个色带才读得像颜料，连续 ramp 读起来像软件。

---

## 4. 转场规则

- **镜头之间怎么切**：**不切**。全片是一张画纸，用连续不断的镜头运动把段落缝起来（`DEMO.md:44`、`style-dna/watercolor.md:112`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**有擦除**——刷子边缘的波浪竖裁切揭开整景（`scene.js` `drawStripAt(..., reveal)`）、纸色雾从底部波浪上升把世界洗回白纸（`main.js` `drawMist`）、翻页 / 新纸盖上来。**没有**通用溶解、没有闪白、没有划像、没有定格。
- **硬切点怎么定**：**没有硬切点**。这是硬约束，不是偏好。
- **转场时长与缓动**：雾擦除在样片里是 **70.3–73.6 s**（约 3.3 s，`DEMO.md:40`）；片头用刷边揭开整景在 **10.2–13.4 s**（`REV` 从 −300 扫到 1650 px，`DEMO.md:46`）。缓动只有 `ss` / `eio` / `eo` / `ei` 四种，一切是 `t` 的纯函数，什么都不抖（`STYLE.md:48`）。
- **绝对不要的转场**：硬视频切；两张不相关的画之间的溶解；任何元素的淡入 / 滑入——**东西要么被画出来，要么被雾洗掉**；无来由的运镜。（`style-dna/watercolor.md:114`）

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | 样片：Cormorant Garamond italic 500（英文）/ Noto Serif SC 400（中文）/ Caveat（手写注）/ IBM Plex Mono 400（实测标签，3 px letter-spacing）；dub 通路回退 **SimHei**（`dub-styles.json#watercolor`） |
| 字号（相对画面宽 / 高） | 英文 **36 px @1920×1080** ≈ 1.88% 画面宽 / 3.33% 画面高；中文行 **24 px** ≈ 1.25% 宽；`dub` 通路 `fontSizeFactor 0.03333` |
| 颜色 / 描边 / 阴影 | `INK #2b2520` @ **78%**，叠 **18 px 纸色光晕**、画两遍加密；**无描边、无底框**（`subtitleBack` 透明）。注意 dub 通路给的是白色描边 `outlineFactor 0.00278`，与风格不符 |
| 位置 / 安全边距 | 居中在底部、**坐在纸上不进盒子**：英文基线 y≈1000（两行时 962/1000），中文行 y=1042；dub 通路 `marginVFactor 0.14537` / `marginLFactor 0.07037`，`align 2` |
| 单行字数上限 / 最多行数 | 宽上限 **1400 px**，自动断成**最多 2 行**（balanced）；实测单句最长约 120 字符（v12），仍压进 2 行 |
| 出现与消失方式 | `start − 0.15` 到 `start + dur + 0.45`，**0.25 s 淡入 / 0.35 s 淡出**；dub 通路 `subtitleFadeIn 0`（无渐入） |

- **字幕与旁白的关系**：同一张 VO 表同时驱动字幕、`.srt` 与 `mix.py`（`scene.js:3-17`、`mix.py:137`）。停留 ≥ `max(1.8 s, 语音时长 + 0.6 s)`（`STYLE.md:38`）。**数字在 TTS 里念全、在屏幕上写数字**（样片念 "two hundred and fifty millimetres"，屏上写 `< 250 mm`，`DEMO.md:56`）。
- **本风格特有的字幕禁忌**：不要加底框或做成通用字幕条（字幕必须坐在纸上、带纸色光晕，`style-dna/watercolor.md:55`）；不要用黑体 + 白描边；不要超过 2 行；不要用营销口播腔、感叹号堆叠、`amazing` 这类词（`style-dna/watercolor.md:52`）。

---

## 6. BGM / 音效特征

- **配乐**：**声学、温和**——毛毡钢琴、指弹吉他、木管、轻弦乐、钟琴、卡林巴、软 pad（`STYLE.md:69`）。样片用 **Scott Buckley《Wildflowers》（CC BY 4.0，可合法使用）**，曲源直链写在 `music/prep.sh:8`（`https://www.scottbuckley.com.au/library/wp-content/uploads/2025/12/Wildflowers.mp3`），`prep.sh` 从 mp3 解码出 `Wildflowers.wav`（22.05 kHz 单声道 / 322.17 s，给 `analyze.py` / `jump.py` 做节拍分析）与 `wf48.wav`（48 kHz 立体声 / 322.17 s，给 `edit.py` 做跳剪）。322 s 的曲子用**一次对齐拍点的剪辑跳接**裁到 **117.786 s**：`analyze.py` 测出 tempo **103.359375** / **502 拍**，跳剪 **a = 61.231 s → b = 265.613 s**（`lag` 204.382 s），chroma 相似度 **0.915**，4 拍相位对齐，0.18 s 等功率交叉淡化（`DEMO.md:58`）。**实测核对**：`music/score_beats.json` 的 `cut: 61.23102040816327`、`lag: 204.38204081632654`、`beats[0]: 11.865396825` 与 `scene.js:284` 的 `BEAT0 = 11.865` 逐项吻合；`BEAT = 0.5805 s` 对应 60/0.5805 ≈ 103.36 BPM，与 tempo 一致。画面随后采用它的拍网格。
- **拟音（foley）清单**（全部由场景的物质合成，`mix.py`）：画每一笔的**纸上笔刷沙沙**（带通 1500–7000 Hz 噪声 + 9 Hz 轻颤音 + 声像横扫）、太阳盖印的**一声闷响**（90 Hz 下滑 + 低通噪声 + 短混响）、沙漠风、虎皮鹦鹉叽喳（46 声）、雨滴落树的 plink（14 声，与画面同步）、火的低吼 + 噼啪、渐大的雨、鞭鸟（2 声）、雾起 / 海岸线笔刷 / 地图上的火（`DEMO.md:59`、`style-dna/watercolor.md:139`）。
- **旁白**：样片用 **Kokoro `af_heart` / speed 0.93 / lang en-us**，13 行、一行一个想法、1.7–7.4 s（`tts/gen.py`、`DEMO.md:56`）。**实测核对**：`voices/v01–v13.wav` 为 24 kHz 单声道，时长与 `voices/dur.json` 逐条吻合（v01 `5.901083` vs 5.9、v04 `7.419958` vs 7.42、v06 `1.714250` vs 1.71、v13 `3.388292` vs 3.39）。
- **旁白处理**：人声 → 48 kHz、90 Hz 高通、RMS 压缩（−24 dB，3:1）；**Kokoro 峰均比约 17 dB**，所以先跑一个 5 ms 预读峰值限制（天花板 = 语音 RMS + 11 dB）再做电平匹配；说话时旁白 RMS = 音乐 RMS + 8 dB，音乐让开约 **−4 dB**（×0.62，0.3 s 平滑包络）（`STYLE.md:72`、`style-dna/watercolor.md:140`、`mix.py:151-159`）。
- **响度目标**：**`−14 LUFS`**（mux 两遍 `loudnorm I=-14 TP=-1.7`）；交付真峰值上限 **−1.2 dBTP**（`STYLE.md:72` 只写 final −14 LUFS，未额外声明更严上限；mux 的 TP 目标 −1.7 是给 AAC 过冲留的 0.5 dB 余量，不是交付线）。**成片实测 `I = −14.0 LUFS` / `LRA = 6.6 LU`（`ebur128`）/ 真峰值 `−3.34 dBTP`（`loudnorm` `input_tp`，4× 过采样）—— 响度精确达标，真峰值在交付线内（余量 2.14 dB）、未削波**。★ 口径更正：此前本节与 `_distill.json.audioEvidence` 写的「真峰值 `−1.716 dBFS`（`astats` 6 位小数 `−1.716380`）」是**采样峰值**（下界，口径不同），本次补上 `input_tp` 口径；★ 2026-10-05 复测当前入库成片：`astats` 采样峰值实测 **−3.350128 dBFS**（`−1.716380` 是重渲前版本的读数，已不适用）。上游 `mix.wav` 修前实测 `I = −13.3 LUFS` / `Peak = −1.0 dBFS`（48 kHz 立体声 `pcm_f32le` / 113.600 s），即两遍 loudnorm 把它压到 −14.0。
- **静音策略**：**声明的做法是「把笔抬起来」**——音乐退场，只剩纸与房间，用来框住单独一个被画出来的瞬间（`STYLE.md:71`）。**但 `mix.py` 并没有实现这一条**：配乐被 pad 到全片长度、只做闪避（`mus *= (1 - .38·duck)`）从不归零，全片 113.6 s 音乐不停；雾擦除段（70.3 s）只叠了一层 `airy` 纸声。要复现这条特质必须自己加一段总线静默。

---

## 7. 素材偏好

- **需要什么素材**：**几乎不需要外部素材**——纸、笔触、植物、动物、云、地平线、海岸线、地图全部由 `demo/` 程序化生成（`paper.py` 出纸，`engine.js` 出笔触，`plants.js` 出 16 种植物生成器，`aus.js` 出海岸线环）。唯一外部素材是**一首配乐源**（样片用 Scott Buckley《Wildflowers》，**CC BY 4.0，可合法使用**，直链写在 `music/prep.sh:8`）。注意 `music/*.mp3` 与 `*.wav` 被根 `.gitignore` 忽略，**新 clone 必须先跑 `sh music/prep.sh`** 才有曲源。
- **不需要什么素材**：不要照片、不要视频素材、不要位图贴图（纸是程序化生成的，不是 texture 文件）；不要矢量插画再叠水彩纹理；不要 3D 模型。
- **取景 / 质感 / 比例偏好**：横向长卷；一屏一个主体；质感靠「变宽色带 + 飞白毛 + 淡彩积边 + 纸纹」四件套；比例固定 16:9。
- **可替代方案**（缺素材时怎么降级而不破风格）：**缺配乐源时先查 `prep.sh:8` 的直链再下结论**——样片的曲子是 CC BY 4.0，不是版权障碍（本项目曾把它误判成「第三方音源、仓库不含」而落成静音占位，见第 11 节）。确实找不到可合法使用的曲子时，按项目约定用**最小技术占位**把链路跑通（不要顺手换一首别的曲子），「相似气质替换」是单独的下一步。缺字体 → 中文可用任何**衬线**字体近似 Noto Serif SC，但不要换成黑体（会破「题在纸上」的观感）。新标本不会画 → 只画「主干 + 几条枝 + 一团叶」，宁可更简，不要加细节；加新笔触轮廓就扩 `engine.js` 的 `mk(prof)`。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | **全片一镜**（113.6 s）；段落靠区块卡切分：片头 0–10.9 s、横移 10.3–73 s、竖摇 54.2–60.9 s、雾 70.3–73.6 s、地图 73.2 s 起、片尾 101.6 s 起 |
| 全片时长 | **113.6 s**（`style.json:17`、`scene.js:2` `DUR=113.6`）；结构上也可以是 15–30 s 的「一件标本 + 一张注解」，或「一年十二页」的合集 |
| 镜头数 | 1（一镜到底的横移长卷） |
| 信息投放节拍 | 5 个区块，每区约 10–18 s，各带**一个真实数值 + 一个主角标本 + 一只小动物 + 一件小事**（`DEMO.md:29`） |

- **加速 / 减速点**：横移由单调三次插值 `camXf` 驱动（世界 px，0→9800），**区块之间加速、事件处减速**（火、灰树处慢下来，`DEMO.md:38`）；竖摇 `camYf` 在 54.2–57.8 s 抬升 980 px、58.4–60.9 s 落回。
- **留白与静音的位置**：留白越关键越空（帧 f16 是全片最空的一帧）；**静默按声明应放在「把笔抬起来」的地方（雾擦除段 70.3–73.6 s），但 `mix.py` 没有实现总线静默**——本片该处音乐并未退场（见第 6 节「静音策略」与第 11 节）。
- **卡拍**：袋鼠一跳两拍、落地卡拍（`BEAT0=11.865`、`BEAT=0.5805`，`DEMO.md:49`）。改音乐剪辑后必须重新推导这两个常数。

---

## 9. 制作参数清单

> 可直接抄的参数表。本 demo **没有 `build.sh`**，完整链路见 `DEMO.md:106-150`「Build notes」。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/watercolor/demo --fps 24 --workers 6 --size 1920x1080 --out styles/watercolor/demo/out/video_gpu.mp4`（本次实测） |
| 帧率 | **24 fps**（产品导出帧率）；demo 的 `render.mjs` 原生 `FPS` 默认 **60**（`render.mjs:18`） |
| 分辨率 / 比例 | 原生 **1920×1080 / 16:9**（本次 `--ratio 16:9`）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，字面量在 `demo/film.js:23`）。由 `main.js` 读视口 → `film.js` 的 `setFrame()`（`film.js:10-14`）重排：整幅画经 `fit()` 做「设计帧 → 当前帧等比装入」（`main.js:228-230`、`scene.js` 7 处 `fit(...)`），竖幅上下补纸色 + 纸纹留白；16:9 时 `FX=FY=S=1`、偏移 0，逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh <video_gpu.mp4> <mix.wav> styles/watercolor/watercolor.mp4 24 2`（两遍 `loudnorm I=-14 TP=-1.7`；`grain` 默认 2） |
| 编码器 | `h264_nvenc`（本地 GPU，日志实测 `nvenc`） |
| 音频入口 | `demo/tts/gen.py`（Kokoro `kokoro-onnx`，voice `af_heart`，speed 0.93，lang en-us）→ `demo/asr.py`（faster-whisper `base.en` 校对）→ `demo/music/prep.sh` · `analyze.py` · `jump.py` · `edit.py` → `demo/mix.py` |
| 字幕入口 | VO 表 → `core/render/srt.py`（demo 自带 srt 生成器，本编排器不支持，故 `.srt` 沿用仓库旧文件） |
| 事件导出 | `node core/render/events.mjs styles/watercolor/demo` → 实测 `{"dur":113.6,"ev":[]}`（本风格事件是代码里的时间常数，不是 JSON 表） |
| 本风格专属参数 | demo 自带 `mux.sh`（接口是 `V A O`，非编排器的 `V A O [fps] [grain]`）；Noto Serif SC 需 subset；`node fetch_fonts.mjs` 需联网 |
| 一键复现 | `node lemo-make.mjs watercolor --ratio 16:9`；demo 内链：`sh styles/watercolor/demo/mux.sh` |

---

## 10. 编排规则

- **内容文件字段契约**：VO 表（`scene.js:3-17`）每行 `[id, 开始, 时长, 英文, 中文]`，13 行、一行一个想法、1.7–7.4 s；同一张表同时驱动字幕、SRT 与 `mix.py`——`mix.py:137` 用正则 `\['(v\d\d)', ([\d.]+),` 从 `scene.js` 抠开始时间，**行必须保持这个形式**。数值表：`RAINK`（世界 x → 年降雨 mm，对数插值）、`ZONES`（区块边界）、`ZCOL`（每区 天/远山/中景/地面）、`MSTOP`（地图降雨 ramp）、`BIOMES`（区块卡文案）、`STN`（地图站点）。
- **事件词汇表**：事件不是 JSON 表而是**时间常数**，由各模块共用：`camXf` / `camYf`（镜头路径，`monotone` 单调三次插值）、`REV`（上色扫描）、`FIRE.fireT0` / `regrowT0`（火烧 / 萌发）、`BEAT0` / `BEAT`（卡拍）、`mapTau`（深时间）、`VO` 行。本次 `events.mjs` 导出为空 `{"dur":113.6,"ev":[]}`。
- **时间线契约**：`render.mjs` 依赖的页面契约是 `window.DUR`（秒）、`window.render(t)`（`t` 的纯函数，画整帧）、`window.READY=true`（字体、纸、`build()` 完成后）。画布 1920×1080，`ctx` 是 `main.js` 里的全局。`render(t)` 顺序：画纸 → （`t<73.7`）风景+注解 → （`t>70.3`）雾 → （`t>73.2`）地图 → HUD → （`t<11`）片头 → 片尾 → 字幕。
- **新增主体怎么接入**：新标本 = `plants.js` 里的一个生成器函数，接收缩放 `sc`，在**局部坐标**工作、原点 `(0,0)` 在根部、`y` 向上为负，返回 `{S: strokes, ...}`（`gum` 还返回 `woody`/`leaves`/`shoots`/`fork`）。用 `scene.js` 的 `add(layer, worldX, generator, scale, {dy, span, sway, args, extra})` 放进某一层并缓存 sprite。要新笔触轮廓就扩 `engine.js` 的 `mk(prof)`。
- **换主题时要改哪些文件**：① `demo/scene.js` 的 `VO` / `LAY` / `ZONES` / `RAINK` 式数值表 / `camXf` / `camYf` / `REV` / `ZCOL` / `build()`；② `demo/main.js` 的地图（`MAPC`/`STN`/`MSTOP`）、HUD（`BIOMES`）、标题与片尾；③ `demo/plants.js` 加新标本生成器；④ `demo/mix.py` 的 sfx 摆放；⑤ 重新 subset 字体。**引擎（`engine.js`）与纸（`paper.py`）不用改**。
- **与 `dub.mjs` 通路的关系**：`dub-styles.json#watercolor` 是 `derived:true` 的**派生条目**（非逐行手抽），生效参数为 `palette`（bg `#f1e9da` / bg2 `#cfc6b3` / fg `#2b2520` / accent `#cf7c4f` / subtitle `#2b2520` / subtitleOutline `#FFFFFF` / subtitleBack 透明）、`bgRecipe`（gradient `#f1e9da`→`#cfc6b3` + `rice-paper` 纹理 + `vignette 0.08`）、`subtitle`（`SimHei` / `fontSizeFactor 0.03333` / `marginVFactor 0.14537` / `marginLFactor 0.07037` / `outlineFactor 0.00278` / `align 2`）、`title.fontSizeFactor 0.082`、`motion`（`subtitleFadeIn 0` / `chapterTransition bloom`）、`overlay` 全关（无章节卡 / 无下三分之一 / 无进度条）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **【已修复】成片音轨曾是数字静音**。首版成片实测 **−70.0 LUFS / Peak −inf / RMS −inf**（aac 48 kHz 立体声流存在，但内容是纯零）。根因是一次**误判**：出片走 `--skip-audio`，音频链未执行，而 `scripts/unblock-placeholder-audio.mjs` 的 `TARGETS` 把 watercolor 登记为 `placeholder: true`、把缺的东西写成 `wf48.wav`（记为「相对路径引用的音源，仓库不含」）——实际那首曲子是 **CC BY 4.0，直链就写在 `music/prep.sh:8`**，从来不是版权障碍。修复后成片 **I = −14.0 LUFS / 真峰值 −1.72 dBTP**（`loudnorm` `input_tp`，4× 过采样；此前记的「−1.716 dBFS」是 `astats` 采样峰值、口径不同）（详见下方「踩过的坑（本机实测）」）。★ **原记**：上述 −1.72 dBTP 是当次重混后的读数；当前入库成片实测真峰值 **−3.34 dBTP**（`loudnorm` `input_tp`，4× 过采样）、达标。**教训：判定「素材缺」之前，先读 demo 自带的下载 / 准备脚本。**
- **声明的「静默」特质没有实现**。`STYLE.md:71` 把「把笔抬起来——音乐退场，只剩纸与房间」列为声音调色板的一条，但 `mix.py` 从不把音乐归零（`mus *= (1 - .38·duck)` 只做约 −4 dB 闪避），全片 113.6 s 音乐不停；70.3 s 的雾擦除段只叠了一层 `airy` 纸声。要复现这条特质必须自己加一段总线静默。
- **mux 用了脚本默认 `grain 2`**（`noise=c0s=2:allf=t`），在纸纹之上又叠了一层胶片颗粒。纸纹本身就是画面的一部分，纸纹类风格应显式传 `grain 0`。
- **顶部 HUD 安全边距只有 76 px（3.96% 画面宽）**，窄于常见的 5% 安全区；一旦要裁切或加边就会先吃掉区块卡。
- **24 fps 导出**，而 `STYLE.md:48` 声明「60 fps suits the slow, fluid brush」；demo 的 `render.mjs:18` 原生默认 `FPS=60`，产品导出默认 24，笔触与摆动的连贯度被降采样。
- **dub 通路字体与描边不符风格**：`dub-styles.json#watercolor` 把字幕映射到 **SimHei（黑体）+ 白色描边**（`outlineFactor 0.00278`），而 `STYLE.md:36-38` 要求 Cormorant Garamond 衬线斜体 + 纸色光晕、中文用 Noto Serif SC 衬线、ink 78% 无描边。该条目的 `notes` 自己承认这是「派生值 + 字体修正（原等宽字体不含中文字形）」。
- **细纹理 `textureRaw: watercolor` 声明了但渲染未实现**：`lib/dub-styles.json#watercolor.bgRecipe.textureRaw` 是 `watercolor`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `rice-paper` ⇒ 宣纸噪点（`noise=alls=6:allf=t+u`）），**不读** `textureRaw` ⇒ `watercolor` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `watercolor` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口
- **配乐源不进版本库**：`music/*.mp3` 与 `*.wav` 被根 `.gitignore` 忽略，新 clone 的 `music/` 里没有曲源，**必须先跑 `sh music/prep.sh`**（脚本自己 `curl` 下载 `Wildflowers.mp3` 再解码）。这**不是**版权缺口（CC BY 4.0），只是默认不入库——这一点曾被误读成「仓库不含的商业版权曲」。
- **无 `styles/watercolor/demo/build.sh`**：AGENT-BRIEF 优先级 4 指定的这个文件在本风格不存在；构建链只以 `DEMO.md:106-150` 的命令清单形式存在。
- **字体是自托管的**（`demo/fonts/` + `fetch_fonts.mjs`，需联网）；Noto Serif SC 被 **subset 到 `scene.js` + `main.js` 里出现的 CJK 字符**，新增中文字幕字符会 fallback 到别的字体直到重新 subset（`STYLE.md:95`）。

### 能力限制
- **9:16 曾不可用（★ 2026-10-04 已修）**：原记「无 `aspects` 声明，属 16:9 专用；产品默认 9:16 下画面被 1:1 塞在左上角、右侧 43.75% 丢失、下方整片黑」。**2026-10-04** 已改造 `styles/watercolor/demo/`：新建 `film.js` 导出 `NATIVE`/`setFrame(W,H)`（派生 `FW/FH/FX/FY/S` 与偏移 `OX/OY`）并声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:10-23`）；`index.html` 加载它（`index.html:4`）；`main.js` 读视口设画布 + 调 `setFrame()`（`main.js:4-5`），`render()` 用 `fit()` 做等比装入（`main.js:228-230`）；`scene.js` 7 处绝对 `setTransform` 改为 `fit(...)`（`scene.js:224,234,272,275,471,507-508`）。**16:9 逐字节未变**（17 个时间点 md5 与改造前完全一致）；9:16 实测**不裁切、不变形**，整幅画（含雨量计 / 地图图例 / 双行字幕）完整在框内，落到「等比装入 + 同色留白（纸色）」一档（见第 2 节）。
- **一镜到底是它的强项也是它的限制**：撑不起需要频繁切换视角或强冲突的内容。
- 音频链跑在 WSL 侧的 `.venv`（numpy / scipy / soundfile + `kokoro-onnx`），Windows 侧没有这套环境；缺 WSL 就只能落静音占位。
- **配音文件只在 WSL 侧**：`voices/v01–v13.wav` 被 `.gitignore` 忽略，Windows 副本的 `voices/` 里只有 `dur.json`；跨侧核对音频链时要到 WSL 路径下看。
- **matchScore 上限说明**：成片即本风格自身的 demo，理论上限 100。本次五项均有可核验的实测证据，扣掉的 8 分全部来自可复现的具体缺陷（grain 2、9:16 缺陷、HUD 边距、dub 字体、24 fps、静默特质未实现），**无「不可达分」**。

### 踩过的坑（本机实测）
- **首版**出片命令：`node lemo-make.mjs watercolor --skip-sync --no-preflight --ratio 16:9 --skip-audio`（日志首行，`2026-10-03T06:19:55.948Z`）——跳过了两份库同步、预检**与整条音频链**（音频链后于 15:47 单独补齐并重混，见下）。
- 编排器两条告警：① demo 自带 `mux.sh` 的接口不是 `V A O [fps] [grain]`（自成一体），**回退 `core/render/mux.sh`**；② 该 demo 没有本编排器支持的字幕生成器 → `.srt` 沿用仓库里已提交的旧文件，未重新生成。
- 渲染：**2726 帧** / 24 fps / 6 workers / 1920×1080，实测 **33 s** 出 `video_gpu.mp4`（84.3 MB）。
- 首版混流：走 WSL 侧 `core/render/mux.sh` + `h264_nvenc`（**GPU**，不是 CPU）；`MUX_OK 47369662 src_frames=2726 out_frames=2726`，帧数一致；首版成片 45.2 MB，全流程总耗时 **78.2 s**。修复音频后重混的帧数仍是 `2726`（未变），只是体积涨到 51,106,197 字节。
- 首版出片的静音告警原文：`mux.sh: warning: the audio is silent or quieter than -70 LUFS, so loudness normalisation was skipped`。
- **音频修复记录（2026-10-03 15:47–15:50，零源码改动）**：① `sh music/prep.sh` 下载并解码出 `Wildflowers.wav`（14,207,822 字节 / 22.05 kHz 单声道 / 322.17 s）与 `wf48.wav`（61,856,534 字节 / 48 kHz 立体声 / 322.17 s）；② `tts/gen.py` 用 Kokoro `af_heart` speed 0.93 生成 `voices/v01–v13.wav`（24 kHz，时长与 `dur.json` 逐条吻合）；③ `music/analyze.py` → `jump.py` → `edit.py` 产出 `score.wav`（22,615,032 字节 / 117.786 s，`score_beats.json` 与仓库原件逐字节一致）；④ `mix.py` 产出 `mix.wav`（43,622,488 字节 / `pcm_f32le` / 48 kHz 立体声 / 113.600 s / 修前实测 `I = −13.3 LUFS`、`Peak = −1.0 dBFS`，替换掉旧的 21,999,822 字节 `pcm_s16le` 静音占位）；⑤ 重跑 `core/render/mux.sh`（`LEMO_VENC=h264_nvenc`，**GPU**）两遍 loudnorm 压到 −14.0 LUFS。**视频未变**：新成片仍是 1920×1080 / 24 fps / 2726 帧 / 113.583333 s，仅体积从 47,369,662 增至 51,106,197 字节（多出来的正是 aac 音轨）。
- **一条识别指纹**：`mix.wav` 的格式能判断「音频链到底跑没跑过」——`mix.py` 写的是 `pcm_f32le`，静音占位是 `pcm_s16le`。
- **重跑本风格的音频脚本前必须限制 BLAS 线程数**（由 teammate `fix-hd2d-audio` 在本机实测并广播，非我自测）：本风格的 `analyze.py` / `jump.py` 用 **librosa**，`mix.py` 用 **`fftconvolve` / `sosfilt` / `resample_poly` / `maximum_filter1d`**，都会被 numpy/scipy 链接的 OpenBLAS/OpenMP 多线程拖住——机器上并行跑多个 Python 音频任务时，实测 `edit.py` 从「35 分钟不结束（519% CPU / 34 线程 / load average 27 / 非自愿上下文切换 14 万次）」变成**单线程 14 秒**完成。跑之前先设：
  `export PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 BLIS_NUM_THREADS=1`
  其中 `PYTHONUNBUFFERED=1` 同时解决「`print` 在管道里是块缓冲、看不到输出就误判成卡死」。换配乐（要重跑 `analyze.py` / `jump.py` / `edit.py`）或改旁白（要重跑 `mix.py`）时一定会再遇到。
- demo 自身的坑（`DEMO.md:93-104` 记录，换主题时会再遇到）：wash 条太短会把高地形削成平顶、透明 wash 停在画布底边会露硬缝、五个脚本共享一个全局作用域会让 `READY` 不置位、`mk()` 消耗全局 RNG（`render` 里现做的笔触必须 `withSeed`）、每帧几千笔太慢要 sprite 缓存、Kokoro 峰均比约 17 dB 要先限幅再匹配电平。

### 下次迭代优先补什么
- 在 `mix.py` 里补一段**总线静默**（照 `STYLE.md:71` 的「把笔抬起来」，放在雾擦除段），把声明的静默特质真正做出来。
- 改正 `scripts/unblock-placeholder-audio.mjs` 的 `TARGETS` 条目：watercolor 的曲源是 **CC BY 4.0 且有直链**，应从「缺源 → 静音占位」名单里移出（改成先跑 `sh music/prep.sh`）。
- ~~给 16:9-only 风格在编排器侧**直接拒绝 9:16 导出**，或补 `aspects` 声明，避免静默产出废片。~~ **★ 2026-10-04 已完成本风格这一半**：已补 `FILM_META.aspects = ['16:9','9:16']`（`demo/film.js:23`）并由 `setFrame()` + `fit()` 重排版面（见第 2 节）；编排器侧的通用拒绝策略仍可另议。
- 本风格 mux 应显式传 **`grain 0`**（纸纹已在画面里）。
- 给编排器补**字幕生成器适配**，让 `.srt` 能随片重新生成。
- dub 通路的字体 / 描边应与 demo 对齐（衬线 + 纸色光晕，而非黑体 + 白描边）。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03（音频修复后回填于 `2026-10-03T07:52:38Z`） |
| 成片 | `D:/lemo-films/watercolor/watercolor.mp4`（113.583333 s / 51,106,197 字节 / 2726 帧 / 24 fps / 1920×1080；音轨 aac 48 kHz 立体声，`I = −14.0 LUFS`、真峰值 `−3.34 dBTP`（`loudnorm` `input_tp`，4× 过采样；`astats` 采样峰值 −3.350128 是下界）） |
| 抽帧 | `D:/lemo-tools/_distill/frames/watercolor/`（24 帧 + 接触印样，均为 16:9） |
| 音频证据 | `music/Wildflowers.mp3` 12,891,141 字节（md5 `132be755238c09853720556bb833e999`）· `music/Wildflowers.wav` 14,207,822 字节 / 322.17 s · `music/wf48.wav` 61,856,534 字节 / 322.17 s · `music/score.wav` 22,615,032 字节 / 117.786 s · `demo/mix.wav` 43,622,488 字节 / `pcm_f32le` / 113.600 s（修前 `I = −13.3 LUFS` / `Peak = −1.0 dBFS`）· `voices/v01–v13.wav` 24 kHz（WSL 侧，时长与 `dur.json` 逐条吻合） |
| 风格匹配度自评 | **93/100**（2026-10-05 校正：原 94，新增「textureRaw 细纹理未实现」缺陷，palette −1）（2026-10-05 校正：原 92，9:16 画幅缺陷已修并回补 composition +2） |
| 详细资料 | 有：`styles/watercolor/STYLE.md`、`DEMO.md`、`style.json`、`lib/style-dna/watercolor.md`、`lib/style-dna/watercolor.json`、`lib/dub-styles.json#watercolor`、demo 源码（`scene.js`/`main.js`/`engine.js`/`plants.js`/`mix.py`/`mux.sh`/`render.mjs`/`paper.py`）、`_distill/logs/watercolor.log` |

**逐帧拆解要点**：
- **f01**：空白暖纸 + 右上朱红太阳（约 3% 画面宽）+ 一条从左到右的细地平线（墨色 `even` 笔，还没画完）。没有文字。
- **f02**：片名 `Follow the Rain` Cormorant 斜体居中偏上，下面一行 spaced caps 副题 + 中文行；底部第一句字幕（英文衬线斜体 + 中文行）。太阳仍在右上。
- **f03**：区块卡出现（左上 `Hummock grassland` + `01 / 05` mono + 斜体副题），右上雨量计 `ANNUAL RAINFALL < 250 mm` + 蓝色落点标记；地平线以下开始铺暖橙 wash。
- **f04 / f05**：沙漠风景被**画进来**——远山 wash、几株树、一只袋鼠、一块朱红岩（`Uluru`，带手写引线）；f05 有更多 spinifex 草丘与标签 `spinifex · Triodia`，地面是最饱和的橙粉 `#dda27a`。
- **f06 / f07**：换区 `Acacia shrubland ≈ 290 mm`，mulga 树（枝条上举），手写注 `branches up, rain runs down`，云开始出现；地面转稻草色。
- **f08 / f09**：`Eucalypt woodland ≈ 470 → 580 mm`，桉树（浅色树干 + 稀疏树冠），树上一只考拉，标签 `gum · Eucalyptus`，远山转蓝灰。
- **f10**：`≈ 650 mm`，**火**——画面右下橙色火舌，树被交叉淡化到焦黑 sprite（`#2a2320`），地面压出一条灰烬带。
- **f11**：`≈ 690 mm`，焦黑树干上长出绿色 epicormic 芽（`drawList` 画回），右侧标签 `epicormic`。
- **f12 / f13**：`Tall wet forest ≈ 920 → 1,100 mm`，王桉的白色高干、绿蕨、层间纸色雾带；f13 是竖摇抬升，树干旁一条 `≈ 100 m` 的尺寸线。色调明显转冷。
- **f14 / f15**：`Rainforest 2,000 → 2,900 mm`，密绿雨林层层叠叠，一只食火鸡；`burst` 让整片雨林在 0.9 s 内同时炸开。全片最满、最绿的两帧。
- **f16**：**空白纸**（只剩一笔），雾把世界洗回白纸（70.3–73.6 s）——转场不是切，是擦除。全片最空的一帧。
- **f17 / f21**：地图 `today`，澳洲轮廓被画出，降雨 ramp 量化成色带，右侧图例，图上一支 `our walk` 箭头 + `desert` 标注。
- **f18 / f19 / f20**：深时间倒回——`50` → `49` → `6 million years age`，标注从 `drifting` 到 `drying`，地图从全绿变成「干心绿边」的今日格局（`mapTau`）。
- **f22**：地图褪到约 30%，只剩轮廓与淡淡色带（Tasmania 在底部）。
- **f23 / f24**：片尾卡——片名回到褪色地图上 + spaced caps 副题 + 中文行 + mono 版权行（音乐许可、声线、海岸线来源、`rainfall bands are schematic`）+ 斜体衬线署名行 `LemoLab × Claude Opus 5.5`。
- **整体色走**：暖橙（沙漠）→ 稻草（疏林）→ 灰绿（湿林）→ 深绿（雨林）→ 回到纸色（雾）→ 数据色带（地图）→ 褪色（片尾）；朱红太阳与蓝色落点作为两个反复出现的重音贯穿全片。节奏是「一镜到底的长横移 + 区块间加速、事件处减速」，**字幕全程居中在纸上、不进盒子**，单行最多 2 行。

**音频链逐项核对**（修复后实测，逐条对上 `STYLE.md:67-73` 的声明）：配乐 = Scott Buckley《Wildflowers》CC BY 4.0，`prep.sh:8` 有直链，`analyze.py` tempo 103.359375 / 502 拍，`edit.py` 跳剪 a=61.231 s → b=265.613 s（chroma 0.915）裁到 117.786 s；`score_beats.json` 的 `cut`/`lag`/`beats[0]` 与 `scene.js:284` 的 `BEAT0=11.865` 逐项吻合。拟音 = `mix.py` 程序合成（笔刷沙沙 / 盖印闷响 / 沙漠风 / 46 声鹦鹉 / 14 声雨滴 plink / 火吼+噼啪 / 渐大的雨 / 2 声鞭鸟 / 雾起 / 地图上的火）。旁白 = Kokoro `af_heart` speed 0.93 / en-us，13 行，24 kHz 且时长与 `dur.json` 逐条吻合。混音 = 5 ms 预读限幅 → 旁白 RMS = 音乐 +8 dB → 音乐闪避 ×0.62 → 峰值归一到 0.89。响度 = 成片实测 `I = −14.0 LUFS`（声明目标 −14 LUFS，精确达标）、真峰值 `−3.34 dBTP`（`loudnorm` `input_tp`，4× 过采样；`astats` 采样峰值 −3.350128 是下界）（低于 −1.2 dBTP 交付上限）。

**自检发现的缺陷**：mux 用了默认 `grain 2`；无 `aspects` 声明导致 9:16 下右侧 43.75% 丢失（★ 2026-10-04 已修：补 `FILM_META.aspects` + `setFrame()`/`fit()` 等比装入，见第 2 / 11 节）；24 fps 导出而非原生 60；dub 通路字幕用黑体 + 白描边，与风格不符；顶部 HUD 安全边距仅 76 px；声明的「静默」特质在 `mix.py` 里没有实现。

**本次为补齐短板做了什么**：**未改动 `lemo-make.mjs`、未改动 `styles/watercolor/` 下任何源码、未起渲染或 TTS**。首轮仅完成 SKILL 文档与 `_distill.json` 的蒸馏。首轮成片的**音轨数字静音**短板随后由音频专项 teammate 修复（补曲源 → 跑 `prep.sh`/`gen.py`/`analyze.py`/`jump.py`/`edit.py`/`mix.py` → 重跑 `core/render/mux.sh`，零源码改动），我据其实测值回填了本文件第 6 / 11 节与 `_distill.json` 的 `audio` 分项（4 → 19，`matchScore` 77 → 92）。其余短板已全部记录在第 11 节，留给下一轮迭代。
