---
name: lemo-style-iso-infographic
description: 【lemo 风格 Skill · 等距信息图】要讲流程 / 供应链 / 原理 / 年报数据、想用一张「会动的系统图」把过程讲清楚时用。真等距微缩景观 + 三色平涂方块 + 细墨线标签 + Isotype 数字，东西会剖开露内部，数字是画出来的。选定本风格做视频时，优先读本文件。
slug: iso-infographic
name_zh: 等距信息图
category: 信息与发布
film: From Bean to Cup
---

# 等距信息图（`iso-infographic`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/iso-infographic/STYLE.md` · `styles/iso-infographic/DEMO.md` · `styles/iso-infographic/demo/build.sh` ·
> `lib/style-dna/iso-infographic.json` · `lib/style-dna/iso-infographic.md` · `lib/dub-styles.json#iso-infographic` ·
> `styles/iso-infographic/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一张「会动的系统图」。真正的**等距投影**（轴 30°、无透视、无轮廓线，形体只靠每个面的三档色调区分），**信息图的家具**（引线、标签针、剖切线、剖面阴影线、追踪环、图例、路线）都长在世界里，**数字由重复的图标搭出来**（Isotype）而且必须对得上；整个系统坐在一块漂浮的板上，板边露出剖面（`STYLE.md:6-11`）。

**不是什么**（最容易做错的邻居风格）：不是低多边形 3D（没有透视、没有三档面调之外的光照）；不是扁平 2D 讲解片（所有东西都有等距厚度）；不是蓝图（是色块，不是蓝底线稿）（`STYLE.md:13`）。

**什么时候用它**：流程讲解、供应链、原理科普、年报与数据故事、工程 / 制造 / 物流题材。只要「一件事有先后、有数量、有可拆开的内部」，它就是首选。

**一句话内核**：**一个动作、一个标签、一个由图标搭出来的数字**——系统图自己会动。

**边界**：撑不起情绪化内容。它不擅长抒情、不擅长人物内心、不擅长没有「量」和「过程」的抽象概念；也不要指望它做恐怖、暧昧或诗意的东西。

---

## 2. 画面构图

- **镜头数与画幅**：**全片一个镜头不切**（`DEMO.md:12`「The camera never cuts」），只有换板或插图开合；原生 **16:9（1920×1080）**，★ 2026-10-04 起**已适配 9:16**（`aspects: ['16:9','9:16']`，见本节末子段）。`DEMO.md:8` 说明：方形等距板投影出来正好接近 16:9 的菱形。
- **主体位置与占比**：关键瞬间主体 **≥ 画面高的 1/3**（`STYLE.md:66`）——开场的手、烘焙鼓、带追踪环的豆子。全片相机从 **k=3.75（整块板）到 k=8000（一颗豆）**（`DEMO.md:43`），即 2000 倍以上的对数缩放。
- **负空间 / 留白**：奶油色底（`#F2E6D0`）+ 极淡的等距点阵 + 板下柔和模糊阴影；**底部约 170 px 必须留空**给字幕卡（`STYLE.md:39`）。板是「漂浮的」，不是满幅出血。
- **图层叠放顺序**（从底到顶）：奶油底 + 等距点阵 → 板（含板边剖面：三层土层 + 卵石、三段蓝水柱）→ 世界图元（按 `x+y+z` 画家深度排序后 flush）→ 信息图家具（2px 墨线：引线 / 标签针 / 剖切线 / 追踪环 / 路线）→ 圆形插图（框中框）→ 字幕卡 → 片尾图例卡。
- **安全区**：字幕在底居中、距底 **64 px**、卡半径 10 px（`DEMO.md:104`）；标签针按站点选上下左右方向，**保证标签永不盖住主体**（`STYLE.md:37`）；字幕不与标题、其它字幕行、片尾卡重叠。
- **本风格不能出现的构图**：透视 / 旋转 / 倾斜的投影；实体上的黑色卡通描边（墨线只属于信息图家具）；半透明运动的实体（幽灵感）；标签或字幕压住主体。

**在 9:16（产品默认）下的表现**：★ **2026-10-04 已适配，不再是缺陷**（`aspects: ['16:9','9:16']`，`demo/film.js:11`）。`render()` 首行按画布实际帧调 `setFrame(W,H)`（`film.js:439` → `engine.js:22-24`），算出 `FX=W/1920`、`FY=H/1080`、`S=min(FX,FY)`；**相机 zoom 乘 `S`**（`film.js:442` 的 `iso.cam.k *= S`，屏幕中心仍是 `W/2,H/2`），世界坐标保持设计帧 1920×1080 不变 ⇒ 等距板按 `S` 等比装入并居中。**屏幕空间的家什分两类**：① 片名卡（`film.js:410`）靠 `Iso.cam.k = S`——`text3Now` 自带 `setTransform`，**不能**用 `designXf()` 包住；圆形插图（`engine.js:305` 按 `W/2+(cx−960)·S` 装入）、插图旁的 `1 CHERRY = SEEDS` 标注（`film.js:536`）与片尾图例卡（`film.js:576`）走 `designXf()`。② **字幕卡属全屏叠加** → 中心 `VW/2`、底距 `64·FY`、字号/内边距/圆点/线宽 ×`S`（`film.js:389-401`）。标签针 / 追踪环 / 剖切线 / 等距点阵 / 豆田 / 云的尺寸与可见性阈值全部按 `S` 折算（`engine.js` 的 `pin/inset/ring/cutLine/hatch/iconGrid`、`world.js` 的屏幕像素下限、`hero.js` 的 `kmTag`）；`main.js:7` 让 canvas 尺寸跟视口走。
竖屏 1080×1920 实测（Read 看图确认）：**t=6.5** 片名卡「FROM BEAN TO CUP」整块立体字完整入画、沿梯田斜向排布；**t=8.82** 山体 + 海面填满竖幅，右侧圆形插图（整颗樱桃）完整、`HARVEST 1,600 m` 引线标签完整；**t=29.4** 深推近船舱内的麻袋，「OURS」追踪环居中；**t=49.98** 手掌托杯的终章特写；**t=53.5** 城市段 + 底居中的字幕「Eleven thousand kilometres, from one pair of hands to yours.」完整在画内；**t=56.0** 整块板 + 七个站点标签 + 片尾图例卡全部完整入画。**没有主体 / 文字被裁**。**16:9 逐字节零回归**（t=8.82 / 29.4 / 49.98 三点 md5 与改造前完全相同）；9:16 与「16:9 中心裁切」的 SSIM 实测 **0.67–0.92**（≈1 才表示没重排）⇒ 确为真重排、非裁切。**口径说明**：世界按 `S` 等比装入并居中，相机拉到整块板时（`k` 小时）竖屏上下会露出**与底色同色**的奶油边（不是黑边，读起来像「竖版海报」）；近景（山体 / 城市 / 舱内）时地面本身超出画框，看不出留边。旧文档「本风格无 aspects、9:16 下丢右侧 43.75%」的说法来自**旧源**，已作废。

---

## 3. 配色体系

| 角色 | 色值（顶 / 左 / 右三档） | 用途 | 来源 |
|---|---|---|---|
| 底（奶油） | `#F2E6D0`（板下底）· `#FBF4E6`（字幕卡 / 浅面） | 背景、点阵底、字幕卡 | `DEMO.md:94`、`DEMO.md:104` |
| 咖啡红 | `#CF5140 / #B3352B / #8C2620` | 咖啡豆、主体、标题块侧面、字幕图例小方块 | `DEMO.md:85` |
| 叶绿 | `#7BA75F / #5E8C4A / #476F37` | 山丘、树、咖啡樱桃 | `DEMO.md:86` |
| 海蓝 | `#5A9BCB / #3C7FB1 / #2D6390` | 海、水柱 | `DEMO.md:87` |
| 奶油面 | `#FBF4E6 / #F2E6D0 / #D9C8A9` | 房子、板面 | `DEMO.md:88` |
| 土 | `#A77850 / #8A5B3A / #6A432A` | 土层、麻袋 | `DEMO.md:89` |
| 芥末 | `#E9BE5C / #D9A53A / #B0832A` | 起重机、道路 | `DEMO.md:90` |
| 墨 | `#2E2522` | 标签文字、引线、2px 墨线家具 | `DEMO.md:91` |
| 字幕文字 | `#141414`（dub 通路）／样片用墨色 | 字幕卡上的字 | `dub-styles.json#iso-infographic` |

- **明度 / 对比规则**：**每个面只有三档**，由法线决定（顶亮 / 左 `+y` 中 / 右 `+x` 暗）；任意颜色都过 `tri(c)` 派生——顶向暖白混 **20%**、暗侧向 `#231A2C` 混 **22%**，所以**阴影偏冷**（`STYLE.md:18`、`DEMO.md:92`）。**没有第四档、没有渐变、没有投影光源。**
- **禁止出现的颜色**：两种含义共用一个色相（**水永远是同一个蓝，主体永远是它自己的色**，`STYLE.md:29`）；实体上的黑色描边；低多边形 3D 的光照色。
- **同一画面最多几个色相**：**5–7 个平涂色**（各带三档）+ 一个墨色（`STYLE.md:28`）。样片：咖啡红 / 叶绿 / 海蓝 / 奶油 / 土 / 芥末 / 墨 = 7 个。

---

## 4. 转场规则

- **镜头之间怎么切**：默认**不切**——一个长镜头沿路线推进；要换地方就**换一块板**（第二块微缩景观），或**开一个圆形插图**（框中框），或空处长横移当「一口气」（`STYLE.md:65`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**有剖切**（本风格最核心的转场动作）、**有插图开合**、**有硬切换板**（`dub-styles` 的 `chapterTransition: cut`）。**没有**通用溶解、没有闪白、没有划像。
- **硬切点怎么定**：只在「换一块板」或「切进 / 切出插图」时发生；**时间跳变必须藏在下潜里**——`DEMO.md:114` 记录：船从大洋瞬移到目的港时，把豆田画成**屏幕空间、锚在被追踪的那颗豆上**并按 k 缩放，于是跳变不可见。
- **转场时长与缓动**：**剖切三拍**——剖切线 **0.3 s** 画出 → 近侧皮肤沿法线滑出并淡出 **0.35 s**（ease-out，alpha 在 10%→75% 之间由 1 到 0）→ 阴影线剖面沿在最后 40% 淡入（`STYLE.md:45`、`DEMO.md:63`）。下潜是三段推近 **0.9 s → 0.6 s → 0.6 s**（慢 → 快 → 最快，读成「坠落」），每层掉一件乐器、低通再关一点（`DEMO.md:54`）。猛地拉回是 **×470 用 1.2 s**，log 缩放上 ease-out。
- **绝对不要的转场**：透视 / 旋转 / 倾斜投影；半透明运动的实体（只能靠运动到场）；无来由的运镜。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | 样片 **Jost 500**（几何无衬线）；dub 通路回退 **DengXian 等线** |
| 字号（相对画面宽 / 高） | 样片 **42 px** @1920 宽 ≈ 2.2% 宽；dub 通路 `fontSizeFactor` **0.03889** |
| 颜色 / 描边 / 阴影 | 墨 `#141414` ／ 无描边（`outlineFactor:0`）／ 无阴影；文字另有一圈 **7 px 奶油色 halo** 以便压在任何色块上（`STYLE.md:36`） |
| 位置 / 安全边距 | **底居中，距底 64 px**；dub 通路 `marginVFactor 0.15741` / `marginLFactor 0.06019` / `align:2` / `bold:true` |
| 单行字数上限 / 最多行数 | 单句 **20–61 字符**（约 4–12 英文词）；字幕卡一行，不折行 |
| 出现与消失方式 | **卡先画边（0.2 s）→ 文字从左向右擦入**；退出时下移 8 px 并淡出（`DEMO.md:104`）。dub 通路 `subtitleFadeIn:0.12` |

- **字幕与旁白的关系**：字幕是**地图标签**——一块奶油 `#FBF4E6` 卡，10 px 圆角、2 px 墨边、左上角一个**咖啡红等距小方块**当图例芯片。停留 ≥ `max(1.8s, 语音 + 0.6s)`（`STYLE.md:39`）。样片实测三条卡点自检全过：`L4 hold 2.30s need 2.25s OK`、`L5 hold 2.65s need 2.61s OK`、`L6 hold 4.50s need 4.46s OK`。
- **本风格特有的字幕禁忌**：字幕行之间、字幕与标题、字幕与片尾卡**都不许重叠**；不要超过一行；不要盖住主体；不要用纯白底卡（必须用奶油 `#FBF4E6`）；不要加投影。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「The subtitle is a map label: a pale card with a small radius and an ink border」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#0AFBF4E6`（AARRGGBB，落盘 ASS 为 `&H0AE6F4FB`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(251,244,230,0.96)）；字色 #141414 与该底衬的 WCAG 对比度 **16.71**。

---

## 6. BGM / 音效特征

- **配乐**：原创**轻原声世界律动**，约 **100 BPM**。尼龙吉他指弹（D–A–Bm–G）+ kalimba，再叠 shaker、bongo、cajon 反拍与 conga，港口与海上加立式贝斯（`jazz_bass`）。快进段走 B 小调色彩。**没有钢琴、没有弦乐 pad**（`DEMO.md:72`）。一个三音**豆子动机**（kalimba A4–F#4–D4）在第一次落豆、最终标签与结尾站点琶音处出现。咖啡馆段从 100 BPM 慢到约 70 并停住；静默后吉他以 80 BPM 重启。
- **拟音（foley）清单**：纤维断裂（茎）、肉闷响（樱桃落掌）、颗粒哗啦（樱桃过网）、倒谷入麻袋、集装箱门与落箱的**非谐钢泛音**、麻布撕裂、鼓筒旋转轰鸣、干裂爆响（一爆）、磨豆啸叫 + 碾压、压粉 thock、陶瓷 plink、**升调**倾倒（`DEMO.md:76`）。**每点亮一个 Isotype 图标 = 一个声音。**
- **旁白处理**：Kokoro `bf_alice`、速度 0.88–1.0，六句短句；音乐在人声下 **−8 dB**、环境 **−7 dB**，说话时**鸟叫静音**——样片实测「一个词尾的鸟叫让 whisper 把 travel 听成 travels」（`DEMO.md:77`）。每句都过 dry take + 最终混音两次 whisper 校验。
- **响度目标**：`−14 LUFS`（`STYLE.md:75`）；**真峰值上限 −1.2 dBTP**（mux.sh 的告警阈值）。**本次成片未达标**：实测 **−14.2 LUFS / 真峰值 +1.20 dBTP**（口径 = `loudnorm` 的 `input_tp`，4× 过采样；mux 告警里的 `peak 0.326858 dB` 是 `astats` 的**采样峰值**，不是真峰值，会低估削波），超 −1.2 dBTP 交付线 **2.40 dB**，且真峰值为正即已**实际削波**，见第 11 节。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 +1.20 dBTP → **−1.69 dBTP**、已在 −1.2 dBTP 交付线内（达标）；原 +1.20 dBTP 记录保留为历史。
- **静音策略**：**两段真静默**——下潜（30.0–33.6s，只剩路线与 **−66 dB** 船体吱呀）与第一滴咖啡之前（45.3–45.9s，数字零）。每段之后的第一声都是全片最重要的声音之一：**船笛**（约高出一切 10 dB，D2 锯齿叠失谐 + 2.8s 尾音，实测 horn peak **−8.3 dB**）与**一滴落进空杯**（`DEMO.md:73`）。
- **声音转场**：港口噪声 **J-cut 提前 0.6s**、烘焙鼓提前 0.6s、船笛尾巴 **L-cut 进城市**；最终拉回时**每站一个 kalimba 音**（`DEMO.md:78`）。

---

## 7. 素材偏好

- **需要什么素材**：**不需要任何外部素材**。整块板、地形、建筑、船、起重机、集装箱、麻袋、人物、图标、手部特写全部由 `demo/engine.js`（零依赖 Canvas 2D）程序化绘制；`world.js` 是世界，`hero.js` 是手部特写。唯一「素材」是一支**几何无衬线字体**（Jost）。
- **不需要什么素材**：不要照片、不要实拍、不要 3D 模型与渲染贴图、不要笔刷纹理、不要颗粒（`grain 0`，`mux.sh` 最后一个参数就是 0）。
- **取景 / 质感 / 比例偏好**：**等距、正交、平涂、三档**；原生 16:9（★ 2026-10-04 起已适配 9:16，见第 2 节末段）；板必须是「漂浮的方形板 + 板边剖面」，不是满幅地图。
- **可替代方案**（缺素材时怎么降级而不破风格）：缺 Jost → 用任何几何无衬线（等线 / Futura 类）替代，但**必须保留 ~7 px halo**，否则压色块看不清。缺引擎 → 用任意 2D canvas 实现同一套 30° 投影 + 三档色调即可，**核心是投影公式和三档规则，不是某个库**（`STYLE.md:17` 给了公式）。做不出 8000 倍对数缩放 → 至少保证「整板 → 单站 → 单物件」三档，尺度揭示是这个风格的情绪来源。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | **全片一个镜头**（不切）；内部按站点分段，约 2–5 s 一段 |
| 全片时长 | **58.8 s**（`style.json:17`）；本风格适合 **45–60 s**（`DEMO.md:8`） |
| 镜头数 | 1（+ 圆形插图若干 + 片尾图例卡） |
| 信息投放节拍 | 挂在 **100 BPM 网格**上（1 拍 0.6 s、1 小节 2.4 s；转 80 BPM 后 1 拍 0.75 s） |

- **加速 / 减速点**：**累积 = 加速**——样片里集装箱先按四分音符落地（起重机），再八分，最后四波各约 44 箱的十六分音符（下落 7 单位带小回弹），眼睛能感到「系统接管了」（`DEMO.md:65`）。减速点是两段静默；最强的加速是下潜（0.9→0.6→0.6 s）与 1.2 s 的 ×470 拉回。
- **留白与静音的位置**：下潜静默（30.0–33.6s，除主体外全部去饱和）与首滴前静默（45.3–45.9s）；「在空处横向跟随」那一段是专门的呼吸位（`STYLE.md:62`）。**每段静默之后的第一声必须是最重要的声音之一。**
- **其它节拍规则**：Isotype 图标按**十六分音符**一个一个回弹（overshoot 2.2）登场，数字同步 count-up；**没有线引导就不许动**（路线先画、引线先长、剖切线先画）；实体落地有 18% 压扁 + 两次小回弹。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/iso-infographic/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/iso-infographic/demo --fps 24 --workers 2 --out styles/iso-infographic/demo/out/video24.mp4` |
| 帧率 | **24 fps**（人物视觉上 12fps） |
| 分辨率 / 比例 | **1920×1080 / 16:9 为原生设计帧**（本次出片实测 `--ratio 16:9`，1920x1080）；★ 版面从**实际帧**重推，`--size 1080x1920` / `--ratio 9:16` 亦可正确构图（`FILM_META.aspects = ['16:9','9:16']`，见第 2 节末段） |
| 混流 | `sh core/render/mux.sh <video> <mix.wav> styles/iso-infographic/iso-infographic.mp4 24 0`（−14 LUFS / **grain 0**） |
| 编码器 | `h264_nvenc`（本地 GPU，日志实测 `nvenc`） |
| 音频入口 | `core/tts/tts.py`（Kokoro `bf_alice`）→ `core/tts/asr_check.py`（whisper 逐句）→ `demo/music/score.py`（原创配乐 + stems + score.json）→ `demo/mix.py`（环境底 + 拟音 + 人声 + 闪避） |
| 字幕入口 | `demo/tools/subs.py && core/render/srt.py demo/out/srt.json styles/iso-infographic/iso-infographic.srt`（本次实测：`6 cues`，已重新生成） |
| 事件导出 | `node core/render/events.mjs styles/iso-infographic/demo`（实测输出 `events 147 dur 58.8`） |
| 卡点校验 | `demo/tools/cuecheck.py`（**68 个画面同步点，0 ms 偏移**） |
| 成片抽查 | `demo/tools/final_asr.py <成片>`（对混流后的 mp4 再跑一遍 whisper） |
| 本风格专属参数 | 相机调试用 `?k=…&cx=…&cy=…`；测试场景 `?test=hero` / `?test=hero&end=1` / `?test=spark`；出图用 `?nosub=1&nocard=1` |
| 一键复现 | `sh styles/iso-infographic/demo/build.sh`（10 步，约 2 分钟） |

---

## 10. 编排规则

- **内容文件字段契约**：`demo/timeline.js` 是**唯一真值**——导出 `BPM/BEAT/BAR/BPM2/BEAT2`、命名锚点表 `TL`、派生数组（`TL.SUNS` 21 个十六分音符、`TL.DAYS` 18 格、`TL.CRACKS` 8 个切分音、`TL.FULL_STATIONS` 7 个音）、`SUBS[]`（`{id,t0,t1,text}`）、以及 `KM={farm,sea,city,total}`——**`KM` 必须相加**。配音文本另存 `demo/lines.json`：`[{id,t,text,voice,speed,asr?}]`。
- **事件词汇表**（`type` → 消费者）：`title_word`（标题字）、`pin`（标签针）、`inset_open` / `inset_close`（插图开合）、`knife`（剖切线）、`cherry_cut`（切）、`slide_steel`（皮肤滑走，`small:1` 小号）、`tear`（麻布撕裂）、`silence`（静默）、`creak`（船体吱呀）、`sack_load` / `truck{dur}` / `amb_port`（装载 / 卡车 / 港口环境 J-cut）、`vo{id}`（人声）。其余按材料的动作声由 `mix.py` 按 `TL` 命名时刻生成。
- **时间线契约**：`demo/film.js` 导出 `DUR`、`camAt(t)`（世界中心 + 对数插值 k）、`ROUTE`、`render(g,t,Q)`、`events()`。页面契约：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。
- **新增主体怎么接入**：用 `engine.js`——任意路径走 `shape(iso, pts2d, [x,y,z], {color, depth, plane, scale})`（**任意 2D 轮廓都能变成三档着色的等距实体**，现成轮廓有 `sparkPath` / `cursorPath`）；方块 / 柱 / 锥 / 屋顶 / 球用 `box` / `prism` / `cyl` / `cone` / `roof` / `sphere`；贴花 `flat`、三维折线 `line3`、立牌 `bill`、等距字 `text3`；`push/pop` 进局部坐标系（法线一起转，船转向时着色仍正确）；单色例外用 `iso.keep = true`；整体去饱和用 `iso.desat`。
- **换主题时要改哪些文件**：① `demo/timeline.js`（节拍网格 + 站点锚点 + 字幕 + 数字，改这里全片跟着变）；② `demo/lines.json`（配音文本与声线）；③ `demo/world.js`（世界：地形 / 建筑 / 船 / 港口 / 城市）；④ `demo/hero.js`（开场与收尾的手部特写，**必须共用同一套 pose / 相机 / 缩放 / 标签位，只换肤色、袖子与物件**）；⑤ `demo/film.js`（相机路径、站点、标签、插图、片尾图例）；⑥ `demo/music/score.py` + `demo/mix.py`（配乐与拟音）；⑦ 换配色只改 `engine.js` 的 `PAL` 与 `tri()` 的混合比例。**不要**改 `core/`。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里生效的参数是 `dub-styles.json#iso-infographic`——`palette`（`bg #F2E6D0` / `bg2 #FBF4E6` / `fg #2E2522` / `accent #B3352B` / `subtitle #141414` / `subtitleBack #E6F2E6D0`）、`bgRecipe`（gradient `#F2E6D0`→`#FBF4E6`，`texture:none`，`vignette 0.08`）、`subtitle`（`DengXian` / `fontSizeFactor 0.03889` / `marginVFactor 0.15741` / `outlineFactor 0` / `bold` / `align 2`）、`title.fontSizeFactor 0.09` 且 `showRole:true`、`overlay`（`chapterCards:true` / `accentRule:true` / `progressBar:true`）、`motion.chapterTransition: cut`。**注意该条目是 `derived:true` 的派生条目**（配色来自 `lib/dub-visual.json` 的代码抽取，字号由 STYLE.md §4 的 px ÷ 1080 归一，字幕色由 WCAG 对比度推得），知识库更新时应用代码抽取值替换派生值。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **成片音频削顶，未达真峰值目标**。出片日志里 `mux.sh` 明确告警：`missed the target (-14 LUFS, true peak <= -1.2 dB): measured -14.2 LUFS, peak 0.326858 dB (ebur128 1-decimal readout 1.2 dB)`。**注意口径**：`peak 0.326858 dB` 是 `astats` 的**采样峰值**（`logs/iso-infographic.log:102`），不是真峰值；同一行括号里的 ebur128 1 位小数读值 `1.2` 才接近真峰值。**本次复测真峰值 = `loudnorm` 的 `input_tp` = +1.20 dBTP（4× 过采样）——超 −1.2 dBTP 交付线 2.40 dB，且为正值即已经过 0 dBFS、实际削波。** 日志自己也说了「通常来自 mix.wav 本身峰值偏高，不是 mux.sh 的问题」。这是本次最实的一个缺陷。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 +1.20 dBTP → **−1.69 dBTP**，已在 −1.2 dBTP 交付线内；音频评分回补 +6（见第 10 节）。
- **第一段静默不静**。`DEMO.md:73` 声明下潜静默（30.0–33.6s）里只该剩路线与 −66 dB 船体吱呀；但 `mix.wav` 实测 `silence 30.1–33.5: -25.9 dB`，其中 **`voc sil1 -26.8 dB`**——静默段里仍有人声残留（环境 / 音乐 / 拟音三路都已是 −180 / −180 / −66.4，所以残留来自人声）。第二段静默（45.35–45.85s）实测 −180.0 dB，是干净的。
- **标签与字幕卡纵向间距偏紧**。帧 f21 / f22 里「11,000 km」引线的横线末端离底部的字幕卡很近，逼近 `DEMO.md:105`「lines never overlap the end card」的边界（未真正重叠，但余量小）。
- **片尾图例卡会压在板上**。帧 f23 的「FROM BEAN TO CUP」图例卡落在右下角时与城市 / 板面有轻微叠压；f24 拉回后位置才清爽。`DEMO.md:106` 说它该在「空的奶油角」——拉回到位前并非空角。
- **细纹理 `textureRaw: flat-iso` 声明了但渲染未实现**：`lib/dub-styles.json#iso-infographic.bgRecipe.textureRaw` 是 `flat-iso`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `none` ⇒ 落空（该风格粗粒度没有纹理层）），**不读** `textureRaw` ⇒ `flat-iso` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `flat-iso` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口
- **无外部素材缺口**：全部程序化（`engine.js` / `world.js` / `hero.js`）。
- 字体缺口：样片用 **Jost**，dub 通路回退 **DengXian 等线**；几何感与字重略有差异。
- 图标缺口：`ICON.*` 只提供 sun / moon / box / sack / bean / cherry 六种；新题材（药片、电池、信封…）需要自己写 `iconGrid` 的绘制回调，或走 `shape()`。

### 能力限制
- ~~**只有 16:9**。`style.json` 无 `aspects`；方形板是为 16:9 设计的，9:16 下丢右侧 43.75% 且板会被挤在左上（见第 2 节末段）。~~ ★ **2026-10-04 已修**：`demo/film.js:11` 已声明 `FILM_META.aspects = ['16:9','9:16']`，`render()` 按实际帧重排版面（相机 zoom ×`S`、屏幕空间家什分「当前帧 / 设计帧等比装入」两类），竖屏 1080×1920 实测主体与字幕均不裁、构图真重排（SSIM 0.67–0.92）；16:9 逐字节零回归。判语为**修复前**状态，保留作历史。
- **适合 45–60 s**（`DEMO.md:8`）。更长会靠累积填充拖节奏，更短则「数字一站站长起来」的层次铺不开。
- **可信度是命门**：数字对不上（`KM` 不加和）、工序顺序不符现实，风格立刻崩。改简报前必须先在 treatment 里说明理由。
- 依赖 `demo/tools/cuecheck.py`（68 个同步点）与 `final_asr.py` 做卡点与成片复核，缺这两步容易出「字幕与旁白错位」而不自知。

### 踩过的坑（本机实测）
- 本次出片走的是 **`--skip-sync --no-preflight --ratio 16:9`**（日志首行），跳过了两份库同步与预检；`node_modules` junction 已就位，未报错。
- 混流走 **WSL 侧 `core/render/mux.sh` + `h264_nvenc`**（GPU），实测 `MUX_OK src_frames=1411 out_frames=1411`，帧数一致。
- 渲染 **1411 帧**耗时 **24s**（6 workers；`DEMO.md:135` 说 2 workers 约 35s），音频链路与渲染并行共 **31.5s**，全片总耗时 **54.1s**。
- 配音是**本次真实 TTS 生成**的（非预生成）：`L1 1.954 / L2 3.557 / L3 3.503 / L4 1.645 / L5 2.01 / L6 3.856`，ASR 复核 `mismatches: 0 (lang=en, model=base.en)`。
- 本次字幕**已重新生成**（与 ink-wash 不同）：日志显示 `styles/iso-infographic/demo/tools/subs.py → ok`，混流阶段 `iso-infographic.srt 6 cues 字幕已从 srt.json 重新生成`。
- 唯一告警是上面那条响度 / 峰值未达标；`!` 级告警两条，都是同一件事。
- `DEMO.md:110-118` 的坑清单（换题材时最容易再踩）：Newell 法线要配 `out` 提示再剔除；复合件（梯田灌木、吊车臂）要当一个有序图元画 / 给大深度偏移；半透明下落箱子像幽灵（只能用运动）；船头压滩像搁浅（船体四周要留可见水面，转向先平移离码头）；k=600 时灌木是满屏绿盘（k>120 跳过灌木 + 英雄层后面画平背景）；拉远穿过吊车会出一帧巨臂（按缩放淡入高物体 `alpha = clamp((80−k)/40)`）；2.5–7 kHz 高频床在说话时会害 whisper 听错词；白色盒子加红屋顶会被读成房子（机器要有「标志性零件」）。
- `DEMO.md:119`：zsh 里失败的 glob 会中断 `&&` 链，shell 循环要走 `bash -c`。

### 下次迭代优先补什么
- **修混音峰值**：把 `mix.wav` 整体降 **≥ 2.5 dB**（真峰值 +1.20 dBTP 要压到 ≤ −1.2 dBTP 至少需 2.4 dB）并压掉瞬态峰值，让成片回到 −14 LUFS / ≤ −1.2 dBTP。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 **→ −1.69 dBTP**、已在 −1.2 dBTP 交付线内；本条判语为**修复前**状态，保留作历史。
- **修第一段静默的人声残留**：确认 30.1–33.5s 是否有一条 VO 的尾巴压进了静默窗，在 `timeline.js` 的 `SUBS` / `lines.json` 里把该句收尾提前，或让 `mix.py` 的静默清零也覆盖人声总线。
- ~~给编排器补 `aspects` 声明，或对 16:9-only 风格**直接拒绝 9:16 导出**。~~ ★ **2026-10-04 已完成**：本风格已在 `demo/film.js:11` 补上字面量 `FILM_META.aspects = ['16:9','9:16']`（控制台按源码文本探测，见 `D:/lemo-tools/lib/aspects.mjs`），`styleAspects('iso-infographic')` 返回 `declared:true` 且含 `9:16`；无需再拒绝导出。
- 片尾图例卡加一个「拉回到位前淡出」的规则，避免 f23 那种压在板上的中间态。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/iso-infographic/iso-infographic.mp4`（58.79s / 31.7MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/iso-infographic/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **94/100**（2026-10-05 校正：原 95，新增「textureRaw 细纹理未实现」缺陷，palette −1）（2026-10-03 校正：原 89，音频真峰值缺陷已修，audio +6） |
| 详细资料 | 有：`styles/iso-infographic/STYLE.md`、`DEMO.md`、`demo/build.sh`、`lib/style-dna/iso-infographic.md`、`lib/style-dna/iso-infographic.json`、`lib/dub-styles.json#iso-infographic`、`styles/iso-infographic/style.json`、`_distill/logs/iso-infographic.log` |

**逐帧拆解要点**：
- **f01 / f02**：开场极特写——等距平涂的两只手（一只托着，一只从枝上摘），咖啡樱桃是红的、叶是绿的，**没有轮廓线，只有三档面调**；f02 出现 **`0 km`** 标签针与底部字幕卡（红方块芯片 + 墨字）。
- **f03**：拉远到第一站，梯田山丘（同心弧）、小树、农舍；**标题以等距块的形式躺在地平面上**（奶油面 + 咖啡红侧面）——「FROM BEAN TO …」。
- **f05**：右上开**圆形插图**，里面是咖啡樱桃的**剖切特写**（红线 + 淡红果肉 + 两粒种子）；字幕卡在底。
- **f06**：晒豆站，四排红色晒床，虚线**路线**从上方穿过，有一个标签针 + 数字（该帧分辨率下具体数值不可辨认，不臆测）；字幕「Dried in the sun, then packed with four hundred thousand others.」
- **f09 / f10**：港口站——芥末黄吊车、深蓝船体、彩色集装箱；f09 有 **`14,000`** 标签针。f10 是整块板的全貌：绿山 / 蓝海 / 城市三带分明，板边露出土色剖面。
- **f12**：满装集装箱船横过画面，船上集装箱按**四分→八分→十六分**累积的终态，底部城市砖块房屋。
- **f13 / f14**：**下潜 + 焦点上下文**——满屏灰白的豆子（去饱和），只有**一颗豆是绿的**，带旋转虚线**追踪环**与 `1 of 400,000` 标签针；f14 底部字幕卡「Somewhere in here is yours.」——这是全片情绪峰值。
- **f15**：船已到目的港，吊车 / 城市 / 集装箱同框，是静默后「猛地拉回」的落点。
- **f18**：咖啡馆**剖切内景**——四壁被切开露出内部（人、吧台、磨豆机），左侧 **70 颗豆子的 Isotype 图标摆成一个杯子的轮廓**，标签 `CUP 70 beans`。
- **f21 / f22**：收尾回声——第二只手托着咖啡杯（同一构图、不同肤色与袖子），**`11,000 km`** 标签针 + 引线；f21 是字幕**擦入中途**（文字被卡边裁切，属声明中的 wipe 行为），f22 显示完整句「Eleven thousand kilometres, from one pair of hands to yours.」
- **f23 / f24**：拉回整块板，所有标签同屏，可辨认的有 `HARVEST 1,600 m`、`TRUCK 400 km`、`SEA 18 DAYS 10,500 km`、`ROAST 220 °C`、`CUP 70 beans`；`DRY` 一站的数字被片尾图例卡压住，无法辨认（不臆测）。右下角**片尾卡 = 图例**：「FROM BEAN TO CUP / Isometric Infographic / TOTAL 11,000 km」+ Isotype 色条（图例上标注的公里档位含 1,000 / 400 / 10,500）+ `Lemo-Opuscar · LemoLab × Claude Opus 5.5` + `NOT TO SCALE`。`DEMO.md:39` 给出数字自洽规则：`400 + 10,500 + 100 = 11,000 km`。
- **整体色走**：全片**没有冷暖推移**，是「站点换色」（绿山 → 蓝海 → 城市灰砖 → 咖啡棕 → 奶油底）；唯一的「色走」事件是 f13/f14 的**全片去饱和**（焦点 + 上下文），之后在 f21 恢复。节奏是「持续累积 + 两次急停」。

**自检发现的缺陷**：成片真峰值 **+1.20 dBTP**（口径 = `loudnorm` `input_tp`，4× 过采样；超 −1.2 dBTP 交付线 2.40 dB，实际削波。`astats` 采样峰值 +0.33 dB 会低估削波程度）；第一段静默内人声残留（−26.8 dB）；标签与字幕卡余量小；片尾图例卡中间态压在板上。 ★ 2026-10-03：成片真峰值已修（+1.20 dBTP → −1.69 dBTP，音频重混），见第 11 节。

**本次为补齐短板做了什么**：**未改动 `lemo-make.mjs`、未改动 `styles/iso-infographic/` 下任何源码**。仅完成本 Skill 文档与 `_distill.json` 的蒸馏；上述短板已全部记录在第 11 节，留给下一轮迭代。
