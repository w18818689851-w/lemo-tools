---
name: lemo-style-dataviz
description: 【lemo 风格 Skill · 数据叙事】做数据新闻、研究报告、科普/气候/科学类短片时用；交付「红蓝铅笔在米色纸上把真实数据一笔笔画出来」的诚实、可追溯、有人味观感，图表本身就是电影。选定本风格做视频时，优先读本文件。
slug: dataviz
name_zh: 数据叙事
category: 信息与发布
film: A Hundred Summers
---

# 数据叙事（`dataviz`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/dataviz/STYLE.md` · `styles/dataviz/DEMO.md` · `styles/dataviz/demo/build.sh` ·
> `lib/style-dna/dataviz.json` · `lib/style-dna/dataviz.md` · `lib/dub-styles.json#dataviz` ·
> `styles/dataviz/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部「**图表本身就是电影**」的片子——每一个标记都是一个真实的数，每一次运动都是一个有意义的图表操作（一个标记落地、一条轴长出来、标度改变、一个系列变形、一条批注被钉上）。数据真实、开放授权、可追溯；你改的是取景，**永远不改数字**（`STYLE.md:8`、`style-dna/dataviz.md:11`）。让它成为故事的是三层：**人的尺度**（手写批注钉在标记上）、**表演者**（一支真的红蓝铅笔在画每一个标记）、**可听化**（每个标记是一个音高，趋势先被听到再被读到）（`STYLE.md:23`）。

**不是什么**（最容易做错的邻居风格）：不是仪表盘（一次只讲一个想法）、不是带图表的发布会（没有幻灯片）、不是装饰（每个标记必须是真实的数）（`STYLE.md:25`、`style-dna/dataviz.md:171-175`）。

**什么时候用它**：数据新闻、研究报告、科普与气候/科学题材、需要「理性、严谨、可追溯」气质的短片（`dub-styles.json#dataviz.tags`）。样片《A Hundred Summers》把 NASA GISTEMP v4 的 101 个夏季气温点，讲成一位女性 1926→2026 的一生（`DEMO.md:8`）。

**一句话内核**：一张铺在桌上的米色纸、一支红蓝铅笔、一堆手写便签——数据一笔一笔被画出来，趋势先被听见、再被读懂。

**边界**：它撑不起——没有真实数据可引用的题材、需要多色相热闹或综艺感的内容、需要真人出镜或实拍为主的片子、要求「一次讲十个并列观点」的密集信息。全片颜色**只编码一件事：值**，颜色不是装饰（`STYLE.md:37`）。

---

## 2. 画面构图

- **镜头数与画幅**：原生 16:9 / 1920×1080。全片是**一镜到底**（一台 2D 相机在一整张纸上移动），硬切很少且有意义（demo 全片只有一次硬切）（`STYLE.md:58`）。
- **主体位置与占比**：绘图框固定在世界空间 **1500×520**（`DEMO.md:58`、`style-dna/dataviz.md:29`）。关键瞬间主体填满 **≥ 1/3 画幅高度**——第一个点加批注、百年整图、条纹带（`DEMO.md:34`）。
- **负空间 / 留白**：纸就是留白。冷开场（f01）只有一支笔尖 + 一个点；结尾（f23/f24）把片尾卡放进一个虚线空格里。
- **图层叠放顺序**（从底到顶）：米色纸 + 纤维噪声 + 世界空间淡点阵（24px `#E4DDCF`）→ 网格线 / 零线 / 轴 → 数据点与系列线 → 手写批注（引线 + 不闭合的圈）→ 红蓝铅笔（屏幕空间，从右下角进来）→ 底部字幕带（150px）（`DEMO.md:53-58`、`style-dna/dataviz.md:29`）。
- **安全区**：底部 **150px** 给字幕；真实轴滚出屏幕时，把刻度标签钉在画面边缘的纸带上（冻结窗格）（`STYLE.md:74`）。
- **本风格不能出现的构图**：幻灯片式版式、仪表盘网格、把标题叠在签名式图表操作上、任何非图表操作的转场（`style-dna/dataviz.md:126`）。

**在 9:16（产品默认）下的表现**：本风格**已适配 9:16**——`FILM_META.aspects = ['16:9','9:16']`（`film.js:14`），`renderFilm` 从 `opts.W/opts.H` 经 `engine.setFrame()`（`engine.js:11`，导出 `FX/FY/S = min(fx,fy)`）重排：相机 `zoom *= S`（`film.js:113`）把整张纸按紧轴缩小，屏幕空间的家什按轴拉伸 / 按紧轴缩放——粘性轴标与左侧纸带用 `FX/FY`（`film.js:288-303`），字幕 `x = 180*FX / y = 985*FY / size = 42*S`（`engine.js:328`），底部字幕带渐变 `850*FY…925*FY`（`film.js:435`）。1080×1920 实测（`S = 0.5625`）：**不裁切、无黑边**，整条 1926–2026 的图与变暖条纹带都完整落在画面里；代价是相机缩到 0.5625×，横向的百年图被压成**竖向中段的一条横带**、上下各留大片纸色空白，字幕缩到 42×0.5625 ≈ 24 px 仍居左下、不溢出，铅笔随相机同步缩小。信息完整度与 16:9 一致（7.5s 那帧 16:9 出画的「1926 — she is born.」批注在 9:16 里反而完整可见），只是**版面更空、密度更低**。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 纸 | `#F6F3EC` | 暖米色底 | `DEMO.md:53`、`dub-styles.json#dataviz.palette.bg` |
| 纸（渐变第二色 / 点阵） | `#E4DDCF` | 世界空间点阵 24px | `DEMO.md:53` |
| 墨（轴 / 系列） | `#2B2723` | 暖近黑，轴 1.4–1.6px、系列线 2.4px | `DEMO.md:53` |
| 网格线 | `#DDD6C9`（1px） | 网格 | `DEMO.md:53` |
| 零线 | `#BDB4A5`（1.3px） | 零线 | `DEMO.md:53` |
| 刻度数字 | `#6E665C` | IBM Plex Mono 17–20px | `DEMO.md:53` |
| 发散色带 | `#2166AC → #4393C3 → #92C5DE → #D1E5F0 → #F2EEE8 → #FDDBC7 → #F4A582 → #D6604D → #B2182B → #7A0F1E` | 以参照期均值为中心 | `DEMO.md:55`、`engine.js:15-16` |
| 蓝铅芯 | `#2F5D8A` | **记忆与人**（手写批注） | `DEMO.md:56`、`STYLE.md:39` |
| 红铅芯 | `#A8283A` | **记录与警告**（换铅芯 = 一次转折） | `DEMO.md:56`、`STYLE.md:39` |
| 铅笔木锥 | `#E3C79C` | 削尖的木头 | `DEMO.md:57` |
| 强调（非数据） | `#D97757` | 可绕过色带的非数据标记（demo 引擎演示用） | `DEMO.md:60` |

- **明度 / 对比规则**：颜色**只编码一件事——值**；发散数据用以参照期均值为中心的对称色带，无自然中心用单条顺序色带；**浅值保持浅，绝不拉伸色带来做大变化**（`STYLE.md:37-38`）。色带公式 `u = (v − centre) / half`，中心 = 1971–2000 均值 0.22°C，半跨度 0.85°C（`style-dna/dataviz.md:32`）。
- **禁止出现的颜色**：任何不编码值的装饰色；把色带拉伸制造的假戏剧性（`style-dna/dataviz.md:177`）。
- **同一画面最多几个色相**：中性纸墨 + 一条色带 + 蓝/红两支铅芯色；除「强调色可绕过色带给非数据标记」外无第四种。

---

## 4. 转场规则

- **镜头之间怎么切**：**转场就是图表操作**——轴生长、拉远、重量程、变形、一个格子变宽成下一帧（`STYLE.md:54`、`style-dna/dataviz.md:124`）。全片一镜到底，硬切罕见：demo 在 46.5 拍（半拍之前）做了**唯一一次硬切**，切进静默（`DEMO.md:14`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有淡出到空白、没有溶解**（`STYLE.md:54`）。有定格（锁死机位做变形）、有破框（图表必须让出空间、撕裂的边缘留下伤疤）、有翻铅芯（蓝→红，0.5s 翻转）（`DEMO.md:38`）。
- **硬切点怎么定**：挂在 **90 BPM、4/4 网格**上（1 拍 = 0.667s，1 小节 = 2.667s，`timeline.js:3`）。节奏**用「细分拍子」加速，不改速度**：7 个点在四分 → 24 个在八分 → 40 个在十六分 → 27 个在三十二分（**每 2 帧一个点**，因为 24fps 下 1/32 音符正好 2 帧）（`DEMO.md:38`）。
- **转场时长与缓动**：重量程读作棘轮咔哒（步进、每步缓动，四个步在 1/32 音符上、每步缓动 0.09 拍）；平静的重量程是平滑的；变形是错峰扫过、每个标记缓入新形态、批注扫过时淡出、再作为小铅笔痕回来（`DEMO.md:38`）。
- **绝对不要的转场**：淡出到空白、溶解、任何不是图表操作的转场（`style-dna/dataviz.md:179`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **字幕即图注**：衬线 Newsreader 42px（demo 自带 `Newsreader-VF.ttf`）；kicker 用小号等宽 IBM Plex Mono（`STYLE.md:44`、`DEMO.md:59`） |
| 字号（相对画面宽 / 高） | 42px（`DEMO.md:59`）；标题 Newsreader 66px（`DEMO.md:58`）；通路派生值 `fontSizeFactor 0.03333`（≈36px/1080）（`dub-styles.json#dataviz`） |
| 颜色 / 描边 / 阴影 | 墨色 `#2B2723`；无描边；词按各自时间戳在**纸色带**上浮现（不是暗底框） |
| 位置 / 安全边距 | **与图左对齐**：`x = 180`，基线 `y ≈ 985`；通路 `marginVFactor 0.16019`、`marginLFactor 0.07963`、`align 1`（左对齐）（`DEMO.md:59`、`dub-styles.json#dataviz`） |
| 单行字数上限 / 最多行数 | **≤ 2 行**；demo 5 行实测 38–70 字符，最短 `The next summer hasn't been drawn yet.`（38），最长 `This summer, she turned one hundred. It was the warmest ever measured.`（70）（`STYLE.md:44`、`style-dna/dataviz.md:42`） |
| 出现与消失方式 | 逐词浮现（3 帧上升 + 淡入）；离开时上翻（flips up）；停留 ≥ `max(1.8s, 语音 + 0.6s)`，由 `tools/subs.py` 断言（`DEMO.md:59`） |

- **字幕与旁白的关系**：字幕是**图的图注**——与图左对齐、上方一条发丝线、一个小号等宽 kicker 标出「目前画到的年份区间」（如 `1926–1958`）（`STYLE.md:44`、`DEMO.md:59`）。
- **本风格特有的字幕禁忌**：**签名式图表操作或静默上不排字幕**；旁白绝不压在急速段 / 静默 / 变形上；不念出超过画面所印的数字（`STYLE.md:46`、`style-dna/dataviz.md:53`）。

---

## 6. BGM / 音效特征

- **配乐（可听化即音乐）**：`midi = 62 + (v + 0.4) × 17`；低于中心的音吸附到 D 大调五声；只在最后 ~15 个点上失谐（5→45 音分）；静默前最后一个音最不协和（最大失谐 + 小二度影子），静默后最后一个点是全片最干净最高的音（`DEMO.md:43`、`score.py:33-34`）。音色：**低通门「plonk」**（sine + FM，FM 指数随值升高：木头 → 金属）（`STYLE.md:79`）。本次 `score.py` 输出 `data peak -1.1 rms -19.7`、`pad peak -11.6`、`pulse peak -5.3`（`logs/dataviz.log:83-85`）。
- **床（bed）**：失谐锯齿 pad、软 kick、噪声沙锤、低通 hat、正弦 sub、采样保持 blip、drone；和声随数据变暗或变亮（demo：pad Dmaj9 → G/D → D–Bm–G–A → Bb/D–Dm → 半音簇；静默后 D 空五度、变形的 101 点 glissando、Gmaj7#11、片尾卡下第一个点的音）（`DEMO.md:44`、`style-dna/dataviz.md:152`）。
- **环境声**：跟随批注唤起的地点（J-cut 进、L-cut 出）：房间底噪 → 傍晚蟋蟀 → 海 → 随热变密的蝉 → 静默后的开阔风声 → 房间底噪（`DEMO.md:42`）。
- **拟音（foley）清单**：石墨、纸与木头——笔尖「嗒」、手写刮擦、画轴尺子嘶声、破框时纸张被戳破、翻笔木头咔哒、重量程棘轮齿、变形纸张扫过；最后一个点的「嗒」是全片最干净最干的一声（`DEMO.md:78`、`style-dna/dataviz.md:153`）。
- **旁白处理**：音乐在人声下压 **~−11 dB**（`STYLE.md:82`、`DEMO.md:47`），蝉声 −6 dB；旁白在 300–4000Hz 频段的 SNR 8.6–16 dB（本次实测逐句 12.4 / 10.3 / 14.1 / **8.5** / 16.3 dB，第 4 句略低于声明下限 8.6）（`logs/dataviz.log:89-93`）。
- **响度目标**：`-14 LUFS`；**交付真峰值上限**：`-1.2 dBTP`（项目级交付线；`STYLE.md` 只写 −14 LUFS，未额外声明更严上限）。本次成片实测 **I = −14.1 LUFS / LRA 6.3 LU（`ebur128`）/ 真峰值 −1.12 dBTP（`loudnorm` `input_tp`，4× 过采样）—— 真峰值超交付线 0.08 dB，但真峰值为负、未削波**（`logs/dataviz.log:104-107` 只印了 `ebur128` 的 `Peak -1.1 dBFS`——那是 1 位小数读数，同一条链上 `astats` 的采样峰值 −1.372202 是下界，两者都不能当真峰值用）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 −1.12 dBTP → **−2.23 dBTP**、已在 −1.2 dBTP 交付线内（达标）；原 −1.12 dBTP 记录保留为历史。
  ★ 2026-10-07 复测当前入库成片真峰值 **−1.77 dBTP**（`loudnorm` 的 `input_tp`，4× 过采样；核法见 `_distill.json` 的 `selfCheck.loudness.truePeakDbtp`）。
- **静默策略**：真数字静默是工具。最后一个点之前 **1.0s 全层数字静默**（本次实测 31.00–32.00s peak −240.0 dBFS），空槽之前 0.67s 近静默（42.67–43.33s peak −240.0 dBFS）；它们之后的第一声最重要（`DEMO.md:46`、`logs/dataviz.log:79-80`）。

---

## 7. 素材偏好

- **需要什么素材**：**一份真实的、开放授权、可追溯的数据集**（demo 用 NASA GISTEMP v4 的 `JJA` 列，`data/GLB.Ts+dSST.csv` + `tools/extract_data.py`）；数据抽取器；`timeline.js`（年份→拍映射与图表几何，唯一真值）；批注内容 + 颜色 + 数据空间锚点；强调色。**数据列必须按表头名选（`JJA`），绝不按索引**（`STYLE.md:98`、`DEMO.md:83`）。
- **不需要什么素材**：图库照片、实拍、3D 模型、图标包、任何装饰素材（`style-dna/dataviz.md:175`）。
- **取景 / 质感 / 比例偏好**：纸与石墨的质感；数据点 r=6px + 1.5px 墨环（浅值也能在米色纸上看清）；手写用 Caveat（逐字 ±1.7° 旋转、±2.5% 基线、16% 像素挖空做颗粒）；引线是抖动曲线、末端一个**不闭合**的圈（`DEMO.md:54-56`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：数据集换一份同类真实开放数据即可（**绝不能编数据**）；字体缺失时 demo 自带 OFL 三件套（Newsreader / Caveat / IBM Plex Mono），中文内容需换含 CJK 的近似字体（通路已回退 SimHei）并保持字号与左对齐。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 一镜到底为主；插入式操作（破框推近、翻铅芯、变形）是半拍级（`DEMO.md:26,38`） |
| 全片时长 | 50.0s（`style.json:17`、`timeline.js:36` 的 `DUR = T(75)`）；本次成片 43.8s 出片总耗时（片长 50s） |
| 镜头数 | 一镜到底 + 唯一一次硬切；事件 287 条、字幕 5 条（`logs/dataviz.log:26`、`DEMO.md:14`） |
| 信息投放节拍 | 冷开场在一个点上 → 标题拉远（下垂线变 x 轴）→ 早年稀疏的点 → 稳定的中段 → 加速（批注变密、铅笔变快）→ 破框（笔一顿、翻到红端）→ 急速 → **半拍前停住、唯一硬切进静默** → 最后一个数据点单独出现 → 整条系列一个视图 → 变形为条纹 → 更长的真实记录 → 一个给未知值的空槽 → 片尾卡住在这个空槽里（`DEMO.md:14`） |

- **加速 / 减速点**：用细分拍子加速（四分→八分→十六分→三十二分，最后每 2 帧一个点）；破框与急速段最快；变形段锁死机位（变形本身就是运动）（`DEMO.md:38`、`STYLE.md:69`）。
- **留白与静音的位置**：最后一个点之前 1.0s 真数字静默；空槽之前 0.67s 近静默；冷开场与片尾（虚线空格）都是大留白（`DEMO.md:46`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/dataviz/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/dataviz/demo --fps 24 --workers 6 --size 1920x1080 --out …`（`logs/dataviz.log:39`） |
| 帧率 | 24 fps（1200 帧 / 50s） |
| 分辨率 / 比例 | 原生 1920×1080 / 16:9（`logs/dataviz.log:2`）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:14`），由 `engine.setFrame()`（`engine.js:11`）重排：相机 `zoom × S`（`film.js:113`）、屏幕家什按 `FX/FY` 拉伸 / `S` 缩放；16:9 时 `fx=fy=S=1` 逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $S/dataviz.mp4 24 0`（−14 LUFS / grain 0）（`build.sh:16`） |
| 编码器 | `h264_nvenc`（本地 GPU；本次 `nvenc`，`logs/dataviz.log:7`） |
| 音频入口 | `demo/music/score.py`（可听化 + 模块合成床）+ `demo/mix.py`（环境 + 拟音 + 旁白 + 闪避） |
| 字幕入口 | `demo/tools/words.py`（逐词时间）+ `demo/tools/subs.py`（断言停留）+ `core/render/srt.py`（`build.sh:9,14`） |
| 事件导出 | `node core/render/events.mjs styles/dataviz/demo`（本次 events 287 dur 50，`logs/dataviz.log:26`） |
| 本风格专属参数 | `python $D/tools/extract_data.py`（CSV→json）、`python $D/tools/cuecheck.py`（107 个 cue 校点，最大偏差 0.03ms） |
| 一键复现 | `sh styles/dataviz/demo/build.sh`（约 2 分钟：extract → TTS → whisper → words → events → score → cuecheck → mix → 字幕 → render → mux → styleframe/poster）（`build.sh:1-18`） |
| 本次编排器调用 | `node lemo-make.mjs dataviz --skip-sync --no-preflight --ratio 16:9`（`logs/dataviz.log:1`） |

---

## 10. 编排规则

- **内容文件字段契约**：内容驱动每一个数、每一句与每一色。`lines.json` 每行 `{id, t, text, voice, speed, asr?, hold?}`，demo 用 `af_alloy`、speed 0.92、5 行；whisper 把数字写成阿拉伯数字，故 `asr` 要写 `For 50 years…`、`…turned 100…`（`style-dna/dataviz.md:190`、`DEMO.md:48`）。`timeline.js` 是**唯一真值**：导出 `BPM/B/BAR/T`、`LIFE0/LIFE1`、`yearK(y)`、`lifeYears()`、关键拍 `K`、`DUR`、图表几何 `U/X/BOX/BAND`（`style-dna/dataviz.md:207`）。
- **事件词汇表**：由 `buildEvents()` 产生（供 `mix.py`）：每个数据点一个 `dot_{year}`（落点「嗒」+ 可听化音符）、`tap2026`（最干净最干的「嗒」）、`celltap`（空槽第一笔）、破框 / 惊跳 / 翻红 / 重量程 / 变形 / 静默等命名事件；`tools/cuecheck.py` 用 **107 个 cue** 对配乐校点（最大偏差 0.03ms）（`style-dna/dataviz.md:212-213`）。
- **时间线契约**：`film.js` 导出 `setData(d)`、`setCaptions(lines,dur,words)`、`subs()`、`renderFilm(g,t,opt)`、`buildEvents()`；页面契约 `window.READY / window.render(t) / window.DUR / window.EV`（`style-dna/dataviz.md:208`）。
- **新增主体怎么接入**：用引擎画——任意折线 `pencilStroke(g, pts, {color,width,progress,seed,wobble,passes,grain})`（铅笔 + 写入手感，返回笔尖）；任意闭合形状 `inkShape(g, path, {fill|value, hatch, progress})`；任意路径采成点线序列 `plotShape`；任意闭合形状填成条纹 `stripesFill`；手写 `handText`；印刷字 `setType`；数据点 `dataDot`；点→条纹变形 `morphMark`；批注几何 `leader / ringPath / wavePath / heartPath / bracketPath / sparklePath / quadPath`；空槽 `dashedCell`；铅笔 `drawPencil`；字幕 `caption`（`style-dna/dataviz.md:196-202`）。注意 `pencilStroke` / `dashedCell` / `dataDot` 会自己设 `globalAlpha`（`DEMO.md:83`）。
- **换主题时要改哪些文件**：① `data/` 换新数据集并改 `tools/extract_data.py`；② `timeline.js`（网格 + 年份→拍映射 + 图表几何）；③ `lines.json`（旁白，含 `asr` 数字改写）；④ `film.js`（批注内容/颜色/数据空间锚点、相机路径、铅笔动作、事件）；⑤ `music/score.py`（音高映射公式随新值域调整）；⑥ `mix.py`（环境声跟随新地点）。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里是**派生条目**（`derived:true`），可生效的参数有 `palette`（bg `#F6F3EC` / bg2 `#E4DDCF` / fg `#2B2723` / accent `#d97757` / subtitle `#2B2723`）、`bgRecipe`（type=gradient / texture=dot-grid / vignette 0.08）、`subtitle`（SimHei / 0.03333 / 0.16019 / 0.07963 / align 1）、`title.fontSizeFactor 0.082`（`dub-styles.json#dataviz`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **闪避值两处矛盾（未抹平）**：`style-dna/dataviz.json#sound_palette.mix_rules` 主值写「音乐在人声下压 **~−11 dB**」，但同一段括号内注明 `mix.py` 文档串写作 **~−8 dB**；`style-dna/dataviz.md:156` 写 −11 dB，而 `style-dna/dataviz.md:281` 的证据行写 `mix.py:1-3 … 音乐 ~−8 dB`。两处数字不一致，本文件**如实并列、不替它选一个**。
- **第 4 句旁白 SNR 略低于声明下限**：声明旁白在 300–4000Hz 的 SNR 为 8.6–16 dB，本次实测逐句 12.4 / 10.3 / 14.1 / **8.5** / 16.3 dB，第 4 句（最热那一夏）低于下限 0.1 dB（`logs/dataviz.log:89-93`）。
- **真峰值超交付线 0.08 dB（本次新补记，按 2026-10-03 统一口径由 −2 减半为 −1）**：成片真峰值 **−1.12 dBTP**（`loudnorm` `input_tp`，4× 过采样；`STYLE.md` 未声明更严上限，按项目线 −1.2 dBTP 判）。真峰值为负 ⇒ **未削波**，属『仅超线』，基准 −2 档；过冲根因在 **mux/编码阶段**（`loudnorm` 抬峰 + AAC 编码过冲），**非本风格音频链所致，属项目级既有缺陷** ⇒ 减半为 **−1**，`audio 16→15`。★ 口径不按「走 core 还是走自带副本」分：`core/render/mux.sh`（`LN_TP=−1.7`）与各 demo 自带 `mux.sh` 副本（多半写死 `TP=−1.2`）都是项目提供的模板，两类一律减半（理由与逐项见 `_distill.json.audioScoreBasis`）。`mix.wav` 峰值偏热（`logs/dataviz.log:88` 记 `mix peak -1.0 dBFS`）是编码过冲把真峰值顶过线的直接背景。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 −1.12 dBTP → **−2.23 dBTP**，已在 −1.2 dBTP 交付线内；音频评分回补 +1（见第 10 节）。
  ★ 2026-10-07 复测当前入库成片真峰值 **−1.77 dBTP**（`loudnorm` 的 `input_tp`，4× 过采样；核法见 `_distill.json` 的 `selfCheck.loudness.truePeakDbtp`）。
- **通路字体替换**：`dub-styles.json#dataviz` 是派生条目，字幕字体由 demo 的 Newsreader 换成 SimHei（因 Consolas 无中文字形），中文内容下与「图注衬线」气质有偏差（`dub-styles.json#dataviz.notes`）。
- **9:16 曾不适配（★ 2026-10-04 已修）**：原记「无 `aspects` 声明，绘图框 1500×520 是硬尺寸，竖屏会裁掉横轴右端」。**2026-10-04** 已改造 `styles/dataviz/demo/`：`film.js` 导出 `NATIVE` 并声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:14`）、`engine.js` 加 `setFrame(W,H)` 派生 `FX/FY/S`（`engine.js:11`），`renderFilm` 从实际帧重排（相机 `zoom × S`，`film.js:113`；字幕 / 粘性轴标按 `FX/FY/S`，`engine.js:328`、`film.js:288-303`）。**16:9 逐字节未变**（`fx=fy=S=1` 时每个表达式退化成它替换掉的那个数字）；9:16 实测不裁切、整图完整（见第 2 节）。

### 素材缺口
- 依赖**一份真实、开放授权、可追溯的数据集**；没有数据集就做不了这个风格（绝不能编数据）。demo 自带 OFL 三件套字体（Newsreader / Caveat / IBM Plex Mono），但**无含 CJK 的手写/衬线字体**，中文题材需自备。

### 能力限制
- 一次只讲一个想法；颜色只编码值，不支持多品类并列用色。
- 节奏受 90 BPM 网格与「细分拍子加速」约束；不适合自由节拍的长镜头。
- 尺度切换**只能切到更长的真实记录，绝不外推**（`STYLE.md:93`）。

### 踩过的坑（本机实测）
- GISTEMP 的季节列前有 J-D 与 D-N，**必须按表头名选 `JJA`**，否则取错列（`DEMO.md:83`）。
- 破框在 0.17s 内重量程是**看不见的**——需把被戳破的状态保持 ≥ 半拍（`DEMO.md:83`、`STYLE.md:100`）。
- 右对齐批注仍是从左往右写——铅笔要先跳到第一个字母（占文本相位 16%）（`DEMO.md:83`）。
- 跟踪镜里世界空间标题会被画面边缘切掉；三十二分密度时铅笔笔身横在刚落的点上——需加陡角度（`DEMO.md:83`）。
- 合成的真人声（笑声）诡异——改用柔和的非人声（demo 换成一声音乐盒音）（`DEMO.md:49`）。

### 下次迭代优先补什么
- 抹平闪避值矛盾（统一 `mix.py` 文档串与 STYLE.md/DEMO.md 的 −11 dB）。
- 补含 CJK 的衬线/手写字体，或明确中文题材的字体替代规范。
- **（已完成 2026-10-04）** 9:16 适配：已给 `film.js` 补 `FILM_META.aspects = ['16:9','9:16']`（`film.js:14`）并由 `engine.setFrame()` 重排版面（`engine.js:11`）。★ 声明落在影片模块 `film.js` 的 `FILM_META`，**不是 `style.json`**——探测方 `lib/aspects.mjs` 读的就是 `film.js` 源码文本。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/dataviz/dataviz.mp4`（50.00s / 22.5MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/dataviz/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **92/100**（2026-10-05 校正：原 91，9:16 画幅缺陷已修并回补 composition +1）（2026-10-03 校正：原 90，音频真峰值缺陷已修，audio +1）（本轮由 91 下调 1：新补记真峰值 −1.12 dBTP 超 −1.2 dBTP 交付线 0.08 dB，取 −2 档、按 mux/编码根因减半为 −1） |
| 详细资料 | 有（STYLE.md / DEMO.md / style.json / build.sh / style-dna .md+.json / dub-styles.json#dataviz / demo 源码 / 出片日志） |

**逐帧拆解要点**：f01 冷开场——极特写一个带蓝环的数据点，蓝铅笔尖点着它，手写「-0.22°C」；f02 拉远，手写批注「1926 — she is born.」+ 抖动引线 + 不闭合的圈 + 虚线垂线；f03 标题「A Hundred Summers」+ 副标「Global summer temperature (June–August), °C · one dot per summer」，下垂线变成 x 轴、出现「1926」刻度；f04 y 轴长出来（-0.5/0.0 刻度），字幕「Each dot is one summer:」逐词浮现；f05 字幕写全；f06 点画到 ~1933，第二条蓝批注「1933 — the sea」带三卷浪涂鸦，x 刻度 1926/1930；f07 字幕「For fifty years, her summers barely moved.」；f09 跟踪镜——最新点在 ~60% 宽处，x 刻度 1940/1950；f10 第三条蓝批注「1958 — a daughter.」带心形涂鸦；f13 字幕「Then the dots began to climb, and they never came back down.」；f14 铅笔**翻到红端**（红尖朝上），爬升段，荷兰角开始；f15 红色批注「1959 — hottest yet」；f16 破框——虚线 2026 竖线、右上大红点 + 不闭合红圈、上方「2026」标签；f17 全图 + 红批注「2026 — her 100th summer」+「+1.28°C」，字幕「This summer, she turned one hundred.」；f18 字幕写全 + 全图五条批注齐（蓝 1926/1933/1958、红 1959/2026）；f19 变形为**变暖条纹**整条色带（蓝→红），标题在上；f21 拉远到 0.72×、标题居中、手写「her hundred summers」；f22 空槽——右侧虚线边 + 手写「Next summer」+ 铅笔在右；f23 片尾卡落在虚线空格里（标题 + DATA STORYTELLING + 迷你条纹 + credits）；f24 片尾卡全 credits + 手写「Her story is fiction. Every number is real.」。全片纸色恒定（无冷暖推移），靠点的密度与色带值制造起伏；转场全是图表操作（轴生长/拉远/重量程/变形/格子变宽），全片仅一次硬切进静默。

**自检发现的缺陷**：闪避值两处矛盾（−11 vs −8）；第 4 句旁白 SNR 8.5 dB 略低于声明下限 8.6；通路字幕字体回退 SimHei；无 9:16 适配（★ 2026-10-04 已修：`FILM_META.aspects` + `engine.setFrame()`，见第 11 节）；**离线复测成片真峰值 −1.12 dBTP 超 −1.2 dBTP 交付线 0.08 dB（真峰值为负、未削波；取 −2 档、按 mux/编码根因减半为 −1）**。 ★ 2026-10-03：成片真峰值已修（−1.12 dBTP → −2.23 dBTP，音频重混），见第 11 节。
  ★ 2026-10-07 复测当前入库成片真峰值 **−1.77 dBTP**（`loudnorm` 的 `input_tp`，4× 过采样；核法见 `_distill.json` 的 `selfCheck.loudness.truePeakDbtp`）。

**本次为补齐短板做了什么**：未改动 `D:/lemo-opuscar` 下源码，未起渲染或 TTS。仅新增本目录两份交付物；矛盾与短板如实记录在第 11 节，未替素材编造参数。
