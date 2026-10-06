---
name: lemo-style-blueprint
description: 【lemo 风格 Skill · 蓝图 / 工程制图】把主题变成一张正在被画出来的晒图纸——普鲁士蓝纸面、白色制图线、尺寸与零件气球标注，机器按制图顺序一笔笔长出来。适合工程、硬件发布、技术原理讲解；选定本风格做视频时，优先读本文件。
slug: blueprint
name_zh: 蓝图 / 工程制图
category: 图形与排版
film: Patent Pending: The Cloud Catcher
---

# 蓝图 / 工程制图（`blueprint`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/blueprint/STYLE.md` · `styles/blueprint/DEMO.md` · `styles/blueprint/demo/build.sh` ·
> `lib/style-dna/blueprint.json` · `lib/style-dna/blueprint.md` · `lib/dub-styles.json#blueprint` ·
> `styles/blueprint/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一整部片子发生在**一张铺在深色绘图桌上的晒图纸**上。普鲁士蓝的纸、白得发亮的线条，被设计的东西（机器 / 物件 / 建筑 / 方案）按**工程师的制图顺序**一帧帧「画」出来：中心线 → 轮廓 → 细节 → 剖面线 → 尺寸 → 零件气球 → 标注。镜头像一只读图纸的眼睛在纸面上平移推近，只允许**正投影与斜二测/等轴测**，绝不做 3D 渲染（`STYLE.md:11-13`）。全片只允许**一个画出来的符号**离开制图语言、变成真的（`style-dna/blueprint.md:14`）。

**不是什么**（最容易做错的邻居风格）：不是**全息 HUD**（没有发光线框、没有 3D 环绕）；不是**白板**（白底马克笔、手写圈注）；不是**铜版画**（雕刀排线当主视觉、暖褐色调）；也不是渲染出来的实物（`STYLE.md:16`）。

**什么时候用它**：主题能被翻译成「一件被设计出来的东西」时——工程方案、硬件产品发布、技术原理讲解、建筑/机械/制造流程。`style.json:11-15` 给的适用面是 Engineering / Hardware launches / Tech explainers。

**一句话内核**：严谨的工程规范与一点顽皮互相较劲——图纸干巴而精确，注释栏可以藏机灵话；然后「一件被认真画出来的东西，忽然自己动了」（`style-dna/blueprint.md:141`）。

**边界**：这个风格**撑不起**情绪化的人物故事、快节奏带货、多人对话或需要真实场景实拍的内容。它没有真人（人物只以**拿笔的手影**或**签名**出现），没有外景，没有第三种颜色，也没有速度感——把「三秒抓眼球」的短视频塞进来会显得极慢（`STYLE.md:14`）。

---

## 2. 画面构图

- **镜头数与画幅**：样片 46.667s / 1120 帧 @24fps，`film.js` 的 `CAMS` 把全片切成若干段，**段内连续运镜、段间硬切**（`style-dna/blueprint.md:287`）。原生画幅 16:9（1920×1080）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:12`），见下方子段。
- **主体位置与占比**：叙事镜一律用中景，**主体约占画面高 80%**，一侧留出空白天空给字幕（`STYLE.md:59`、`DEMO.md:40`）。样片把机器放在中左、空白天空在右侧（帧 f04/f08/f12 可见）。全片只有**开场与结尾**两处是整张纸的全景，其余都推近（`DEMO.md:49`）。
- **负空间 / 留白**：空白天空不是浪费——它是字幕注记框的落点，也是「缺陷段」的笑点（`DEMO.md:44`）。纸面本身有 3200×2200 纸面单位，对折成四份，折痕是天然的构图分割（`sheet.js:5`）。
- **图层叠放顺序**（从底到顶）：深色绘图桌布 `#0D1116` + 纸的落影 → 程序生成的晒图纸 → 墨线缓冲（白 = 曝光的线）→ fx 缓冲（R 阴影压暗 / G 湿度 / B 印章红，`lighter` 叠加）→ **最后叠 overlay 字幕**（`STYLE.md:24`、`DEMO.md:87`）。
- **安全区**：主图形至少离**会被取景的纸边 `960/zoom`**，否则全景会露桌面（`STYLE.md:69`、`DEMO.md:134`）。画面**底部是地面线、底座与标题栏**，所以字幕**不固定在底部**，而是按镜头放在空白天空里（`STYLE.md:40`）。
- **本风格**不能**出现的构图**：主图形贴到会被取景的纸边；向上的爆炸视图撞到页眉（样片为此把爆炸改成主要向上+向侧、并在爆炸时压扁吊臂，`STYLE.md:95`）；把字幕画进 ink 缓冲（会随纸一起跑掉、无法压住线条，`STYLE.md:96`）。

**在 9:16（产品默认）下的表现**：**已适配**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:12`）。本风格是 **WebGL2 合成**（`paper.js` 的片元着色器把 ink/fx/ov 三张 1920×1080 **设计帧**画布合成为晒图纸），所以改造走的是**着色器 uv「设计帧 → 当前帧等比装入」**这一档（效果等于**相机重取景**）：`main.js:6-8` 把输出画布设成视口尺寸，着色器按紧轴缩放 `fitS = min(W/1920, H/1080)` 把设计帧装入当前帧、纸面取样同步用 `cam.z × fitS` ⇒ **绘图（线、尺寸、注记框、零件表、标题栏）落在居中的设计帧区域，晒图纸在其四周继续延伸**（露出更多纸面 + 深色桌布，**不是留黑边、不裁切、不变形**）。1080×1920 实测（`fitS = 0.5625`）：设计帧内容居中、占 1080×607.5，纸面带随镜头变化（t=7.0s 约 y 451–1349）；字幕 NOTE 框完整可见——t=7.0s 的 **NOTE 1**、t=23.33s 的 **NOTE 3** 两帧都在框内、未被裁；上下多出的部分是纸面/桌布。**16:9 逐字节未变**（着色器用 `fitS = 0` 分支走原式，躲开浮点重排；3 帧 md5 全同）。代价：设计帧只占竖屏中段、主体比 16:9 小——这是「宽 1920 必须完整装进 1080」的必然结果；**本轮没有做「真竖版重排」**（改 `CAMS` 与注记框落点、重算字号与安全区）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 底（纸浅） | `#18336B` | 晒图纸 fbm 低频的一端 | `STYLE.md:34` / `dub-styles.json#blueprint` |
| 底（纸深） | `#2A58A6` | 晒图纸 fbm 低频的另一端 | `STYLE.md:34` / `dub-styles.json#blueprint` |
| 线 | `#E7F0F9` | 全片唯一线色（淡蓝白） | `STYLE.md:34` / `STYLE.md:21` |
| 桌布 | `#0D1116` | 纸外的深色绘图桌布 + 纸的落影 | `STYLE.md:34` / `DEMO.md:81` |
| 印章（强调） | `#C23B2E` | 红橡皮章，**全片只用一次** | `DEMO.md:93` |
| 字幕文字 | `#E7F0F9` | 与线同色 | `dub-styles.json#blueprint` |
| 字幕框 | `rgba(12,28,62,.58)` | 浅半透明注记框 + 内外两道白线 | `DEMO.md:102` |

- **明度 / 对比规则**：**只有蓝与白**。蓝在明度上变化（涂布刷痕、水渍、折痕、漂白边角），白在**线宽与软硬**上变化，**色相永不变化**（`STYLE.md:31`）。备选色对：褪色晒过头的纸 `#3A6DA8` → `#5B8CC4`；曝光过深的纸 `#0F2350` → `#1D3F80`（`STYLE.md:34`）。
- **禁止出现的颜色**：任何第三种颜色。全片**只允许一次**非蓝色——橡皮章墨（红是经典，绿 APPROVED 或黑 VOID 也行，`STYLE.md:32`）。高潮的「唯一真实物」可以**发光**（白辉光、柔和明度），但**不能引入新色相**（`STYLE.md:33`）。
- **同一画面最多几个色相**：1 个（蓝）。整片最多在印章那一瞬出现第 2 个（红）。

---

## 4. 转场规则

- **镜头之间怎么切**：**在强拍（downbeat）上硬切**，段内是连续运镜（`STYLE.md:47`、`STYLE.md:69`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有叠化**（`no dissolves`，`STYLE.md:69`）。允许的转场必须**来自制图本身**：①强拍硬切；②**FIG. 编号改写**——旧号被划掉、写上新号并配一行小字（样片 FIG. 1 → FIG. 2 · EXPLODED VIEW → FIG. 3 · IN OPERATION，`style-dna/blueprint.md:129`）；③剖面线 A–A 扫过画面（`STYLE.md:65`）。样片还有两个**物理撞击式微抖**：拍纸与落章（`DEMO.md:57`）。
- **硬切点怎么定**：挂在 **108 BPM 网格**上——1 拍 = 0.5556s、1 小节 = 2.222s、十六分 = 0.139s；段与段的切点落在小节/强拍上（`style-dna/blueprint.md:81`）。
- **转场时长与缓动**：硬切为 0 帧；FIG 改写与剖面线扫过是「画」出来的，时长跟笔画长度走，用 `draw.js` 的弧长截断（`draw.js:53-65`）。斜二测深度因子在 **0 → 0.5** 之间动画，是本风格特有的「平面转出厚度」缓动（`film.js:125`）。
- **绝对不要的转场**：溶解 / 叠化 / 淡入淡出等 UI 式转场；3D 环绕；无来由的运镜（`style-dna/blueprint.md:121`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | 手写体 **Architects Daughter**（页眉 / 标签 / 注释 / 字幕）；标题栏字段用 **B612 / B612 Bold**；签名用 **Allura**（全部 OFL） |
| 字号（相对画面宽 / 高） | 手写字 **38 px**（样片 1920 宽下）；页眉标题 **132 纸面单位**（`DEMO.md:102`、`DEMO.md:106`） |
| 颜色 / 描边 / 阴影 | 文字 `#E7F0F9`；框 `rgba(12,28,62,.58)` + 外 1.2 px / 内 0.8 px 两道白线 |
| 位置 / 安全边距 | **按镜头放在空白天空里**，绝不固定底部；框高约 110–150 px，左下角带一个小引出 tick |
| 单行字数上限 / 最多行数 | 折行宽度 **~880 px**（短句用 600 px）；样片单句 **25–72 字符**（约 5–15 英文词） |
| 出现与消失方式 | **以发光笔尖从左到右「写」上去**，用时约 **0.35s**（不是淡入）；提前 0.1s 上、滞后 0.2s 下；每行停留 ≥ max(1.8s, 语音 + 0.6s) |

- **字幕与旁白的关系**：字幕是「**图纸注释框**」，左端有一个 **NOTE / n** 单元格（B612 Bold）。每一条字幕**同时被写进图纸右下的 GENERAL NOTES 注释栏**，所以最后的整张纸全景会把整段旁白当成制图注记展示出来（`STYLE.md:41`、`DEMO.md:105`）。
- **本风格特有的字幕禁忌**：①**不许把字幕画在 ink 缓冲上**——必须用独立的 overlay 纹理、预乘 alpha 最后合成，否则字幕会随纸跑掉且压不住线条（`STYLE.md:96`）；②不许固定在画面底部（底部是地面线、底座、标题栏）；③字幕不许压在「回报物」（样片的那朵花）上（`STYLE.md:99`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「a light translucent box with double white rules」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#6B0C1C3E`（AARRGGBB，落盘 ASS 为 `&H6B3E1C0C`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(12,28,62,0.58)）；字色 #E7F0F9 与该底衬的 WCAG 对比度 **12.84**。

---

## 6. BGM / 音效特征

- **配乐**：**108 BPM、G 大调**的二声部**巴洛克创意曲**（`score.py:1-4`、`DEMO.md:61`）。羽管键琴奏一行十六分音符的「齿轮」动机（主题 16 个十六分），巴松 staccato 低两个八度做模仿；运转段加入小提琴与大提琴 spiccato 八分（「齿轮在咬」）；雨段用竖琴与羽管键琴分解和弦；片尾主题以 augmentation（增值）再现（`DEMO.md:61-68`）。采样器 `core/audio/sampler.py`，音源 VCSL 羽管键琴/竖琴、VSCO 2 CE 巴松与弦乐（`DEMO.md:69`）。实测 stems RMS：harpsichord −25.6 / bassoon −31.3 / strings −27.9 / harp −34.9 dB（`logs/blueprint.log:142-147`）。
- **拟音（foley）清单**（按材料分层，`STYLE.md:74`）：**纸**——卷纸噼啪与拍纸、丁字尺木滑、针管笔刮纸（2–6 kHz 颗粒、长度 = 笔画长度）、写字串短笔画、圆规吱（2.6 kHz）、排线 13 笔/s、橡皮擦、描图纸沙沙；**黄铜与木**——部件咔哒（3.1 / 5.2 kHz 共振）、擒纵 tick、链条哗啦、弹簧嘣、按 **×1.35** 几何减速的泄气 tick；**水**——每滴柔和 damped pat + 轻雨底；**橡皮章**闷响、笔帽咔哒。
- **旁白处理**：**干、克制**的英式工程师念自己的设计笔记（Kokoro `bm_daniel`、`lang en-gb`、speed 0.9），全片只有 **5–6 行短句**（`DEMO.md:76`、`lines.json`）。混音里音乐在语音下 **duck 到 0.36**（0.25s uniform filter 平滑，防抽吸），拟音再让一半；whoosh **低通 2.5 kHz**（否则盖住「bellows」的辅音）；最终 `mix = M×1.0 + FX×0.55 + VO×0.7`，限幅 0.95、归一化 0.89（`style-dna/blueprint.md:150`）。
- **响度目标**：`−14 LUFS`（`STYLE.md:78`）；**交付真峰值上限**：`−1.2 dBTP`（项目级交付线；本风格 `STYLE.md` 只写 −14 LUFS，未额外声明更严上限）。本次成片实测 **I = −13.9 LUFS / LRA 3.4 LU（`ebur128`）/ 真峰值 −1.03 dBTP（`loudnorm` `input_tp`，4× 过采样）—— 真峰值超交付线 0.17 dB，但真峰值为负、未削波**（`logs/blueprint.log:164-166` 只印了 `ebur128` 的 `Peak −1.0 dBFS`——那是 1 位小数读数，同一条链上 `astats` 的采样峰值 −1.611899（★ 2026-10-05 复测当前入库成片 = **−2.754564 dBFS**）是下界，两者都不能当真峰值用）。音频链在本次运行中**真实跑过**：TTS 产出 6 行配音（v1 2.907s … v6 2.212s，`logs:41-52`）、ASR 校对 6/6 OK、`score.py` 出 108 BPM 配乐、`mix.py` 出 `MIX_OK`（`logs:40-152`）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 −1.03 dBTP → **−1.74 dBTP**、已在 −1.2 dBTP 交付线内（达标）；原 −1.03 dBTP 记录保留为历史。★ 2026-10-04 多比例重渲后复测（2026-10-05）：当前入库成片真峰值 **−2.40 dBTP**（`loudnorm input_tp`，4× 过采样）、`I = −14.02 LUFS`（loudnorm）/ `−13.9`（ebur128）、`LRA 3.4 LU`（ebur128）——−1.74 属重渲前版本。
- **静音策略**：静默是**真实存在的一整段**，不是空。缺陷揭示后（24.3–26.6s 与 27.4–28.85s 两段）实测 RMS 为 **−200 dB（真数字静音）**（`logs/blueprint.log:118-121`）。静默里**只允许纸的声音**；最高潮（修订云线变成真云）**不留旁白**（`STYLE.md:76-77`、`DEMO.md:76`）。

---

## 7. 素材偏好

- **需要什么素材**：不需要任何实拍。需要的是**几何**——目标物体（机器 / 物件 / 建筑 / 方案）的**正立面折线几何**（纸面坐标、y 向下）与一个绘制函数；一套**零件清单**（样片 13 个零件，`sheet.js:61-80` 的 `PARTS`）；页眉/标题栏文字（标题、PATENT PENDING、日期、DWG NO.、SCALE、SHEET、签名）；以及 **5–6 行旁白**。**所有几何都是折线**，这样才能按弧长一笔笔「画」出来（`style-dna/blueprint.md:204`）。
- **不需要什么素材**：不需要照片、视频、3D 模型、贴图、真人镜头。样片连人物都只用**拿笔的手影**表示（`sheet.js:250-268`）。
- **取景 / 质感 / 比例偏好**：质感全部来自**程序生成的纸**——低频 fbm 在 `#18336B`→`#2A58A6`、横向涂布刷痕、从左到右轻微褪色、纸纤维高频噪声 + 稀疏纤维丝、十字折痕（亮边 + 暗边 + 折线磨白）、不规则漂白边角、零星污点（`STYLE.md:20`）。纸外是深色桌布 + 落影。线是淡蓝白 `#E7F0F9`，略软（mipmap 晕开），带一点纸纹驱动的墨迹断续（`STYLE.md:21`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：缺专业素材时，**减零件数、减 FIG 数量**，把叙事收成「一张图 + 一次修订 + 一个印章」——仍然成立，因为风格靠的是制图语言而不是零件数量。缺手写字体时用系统手写体替代并保持字号/位置不变；缺采样音源时用合成羽管键琴/拨弦替代，但**保留 108 BPM 网格与模仿式对位的写法**。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 无固定值；`CAMS` 按叙事分段，段内连续运镜、段间在强拍硬切（`film.js:26-31`） |
| 全片时长 | **46.667s**（`DUR = B(22)` = 21 小节；`style.json` 记 46.7s / 1120 帧） |
| 镜头数 | 样片约 9 段：开场整纸 → 标题推近 → 制图中景 → 爆炸视图 → 运转（含 2× 特写 + 沿链条推移）→ 缺陷 → 修订（锁死机位）→ 符号成真（慢推）→ 回报 → 结尾整纸 + 落章 + 标题栏（`DEMO.md:36-47`） |
| 信息投放节拍 | 挂在 **108 BPM**：1 拍 = 0.5556s、1 小节 = 2.222s、十六分 = 0.139s；**每个图层都在一个拍点上开始**（`style-dna/blueprint.md:93`） |

- **加速 / 减速点**：**爆炸视图**是加速点——零件每 **~0.055 进度**放出一个（落在八分音符上，eased），回来时每八分音符组回一个（带黄铜咔哒）；**齿轮**每八分音符前进 **7.5°（一齿）**、带 0.35 拍 ease-out，像擒纵机构；**风箱每拍呼吸一次**；**失效约 1.5s**（齿轮减速 + 风箱泄气 1.0s + 吊臂下垂）；**喜悦** = 风标弹正、指针 overshoot 到 1（back-ease）（`DEMO.md:51-56`）。
- **留白与静音的位置**：缺陷揭示后留 **4.4s** 的「房间」（24.6s 起，只把房间底噪留到极低）；修订段（25.0–28.7s 手影画云）除笔尖刮擦与一支三音疑问动机外几乎全静；奇迹段只有两口气的纸「噗」声 + 1.1s 噪声渐强，旁白要等到 **35.0s** 才回来（`style-dna/blueprint.md:97`）。旁白时刻 v1..v6 = 5.2 / 12.2 / 21.9 / 26.1 / 35.0 / 40.7s（`style-dna/blueprint.md:86`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/blueprint/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/blueprint/demo --fps 24 --workers 3 --out styles/blueprint/demo/out/video24.mp4` |
| 帧率 | **24 fps**（`build.sh:13`） |
| 分辨率 / 比例 | 原生 **1920×1080（16:9）**；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:12`）——由 `paper.js` 的着色器按 `fitS = min(W/1920, H/1080)` 把设计帧等比装入当前帧（`fitS = 0` 时走原式 ⇒ 16:9 逐字节不变）；ink/fx/ov 三张画布始终是设计帧 1920×1080，`main.js` 把输出画布设成视口尺寸 |
| 混流 | `sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $S/blueprint.mp4 24 4`（24 fps / 颗粒 4） |
| 编码器 | `h264_nvenc`（本地 GPU；日志确认 `nvenc`） |
| 音频入口 | `core/tts/tts.py lines.json voices` → `asr_check.py` → `music/score.py` → `mix.py` → `tools/check_mix.py` |
| 字幕入口 | `node $D/tools/subs.mjs`（页面 `window.SUBS` → `subs.json`）+ `core/render/srt.py $D/subs.json $S/blueprint.srt` |
| 事件导出 | `node core/render/events.mjs styles/blueprint/demo`（样片 343 个事件 / dur 46.6667，`logs/blueprint.log:26`） |
| 本风格专属参数 | `--ratio 16:9`；纸面 3200×2200；线宽四级 3.2/2.0/1.25/0.9 纸面单位；屏幕线宽 = 纸面线宽 × `zoom^0.65`；虚线中心线 `[34,7,6,7]`、隐藏线 `[11,7]`、剖切面 `[30,6,5,6,5,6]`；剖面线 45°、间距 8–14 纸面单位 |
| 一键复现 | `sh styles/blueprint/demo/build.sh`（9 步：配音 → ASR 校对 → 字幕 → 事件 → 配乐 → 混音 → 自检 → 渲染 → 混流） |
| 静帧审片 | `node core/render/still.mjs styles/blueprint/demo --range 0:46:1.5`，再 `sheet.py` 逐段审 |

---

## 10. 编排规则

- **内容文件字段契约**：本风格**没有单独的 `content.json`**，文案与语音由 **`lines.json`** 驱动（`style-dna/blueprint.md:182-191`）。字段：`id`（惯例 `v1`..`v6`，对应时间轴 VO 时刻）、`voice`/`speed`/`lang`（样片 `bm_daniel`/`0.9`/`en-gb`）、`text`（单行旁白，实测 25–72 字符、全片 5–6 行）、`asr`（可选，告诉 whisper 该听到什么，如把 `Figure one` 校对成 `Figure 1`）。语音时长由 `voices/dur.json` 提供。
- **事件词汇表**：`film.js` 里 `EV` 由 `ev()` 逐条 `push`，`type` 有 `unroll`/`slap`/`tsquare`/`pen{d,v}`/`letter{d,v}`/`hatch`/`compass`/`scratch`/`turn`/`whoosh{d,v,pan}`/`section`/`click`/`tick`/`bellows`/`chain`/`swing`/`gaugetwitch`/`gaugeping`/`winddown`/`deflate`/`room`/`puff`/`swell`/`catch`/`drop{v,pan}`/`rainbed`/`grow`/`stampair`/`stamp`/`cap`/`vo{id}`（完整表见 `style-dna/blueprint.md:214-243`）。
- **时间线契约**：`film.js` 导出 `renderFilm(t)` → `{ cam, roll, sheet, seed, wetBlur, fade }`、`DUR`、`EV`、`subs()`、`setLines(lines, dur)`。页面契约（`main.js:107-108`）：`window.render(t)` / `window.DUR` / `window.EV` / `window.SUBS` / `window.READY`，查询参数 `?frame=1|2|3` 出静帧、`?nosub`、`?poster`。
- **新增主体怎么接入**：一个新主体 = **一个新模块**（参考 `demo/machine.js`）。导出①一组**正立面几何**（纸面坐标，y 向下）与②一个 `drawMachine(P)`。`P` 携带状态：`E`（爆炸进度）、`gear`（齿轮角）、`boom`（吊臂角）、`bellows`、`vane`、`gauge`、`section`（剖切线扫过的 x）、`pr`（各图层画入进度 `c/o/g/d/h/b`）。几何用 `draw.js` 的原语：`solid`（斜二测挤出）、`hatch`（剖面线）、`gearPts`（齿形）、`circ`/`ell`/`rect`/`xf`。爆炸偏移与顺序写在模块里的 `EXP`/`ORDER`/`EXSEQ`，啮合相位由 `meshAngle()` 算（`style-dna/blueprint.md:197-204`）。
- **换主题时要改哪些文件**：①`lines.json`（新旁白）；②新主体模块（如 `machine.js`，机器/场景几何与爆炸顺序）；③`sheet.js`（`PARTS` 零件表、页眉/标题栏文字、签名）；④`film.js`（`CAMS` 分段、`DUR`、`EV`、`subs()`、VO 时刻）；⑤`music/score.py` 的 cue 表。**注意**：`style-dna/blueprint.md:195` 明确警告——换 `lines.json` 重跑只是「验证引擎能重排」的技术检查，**不是做片子的方式**；真片子要有自己的 treatment、结构与镜头路径。
- **与 `dub.mjs` 通路的关系**：在「文案 + 风格」通路里本风格走 `lib/dub-styles.json#blueprint`：`palette.bg #18336B` / `bg2 #2A58A6` / `fg #E7F0F9`、`bgRecipe.type gradient` + `texture paper` + `vignette 0.2`、`subtitle.fontFamily KaiTi` / `fontSizeFactor 0.038` / `marginVFactor 0.145` / `marginLFactor 0.06` / `outlineFactor 0.0022` / `align 2`、`title.fontSizeFactor 0.082` / `showRole true`、`overlay.chapterCards true` / `accentRule true`、`motion.chapterTransition cut`。`accent` 为 `null`（红章未给 hex，故不编造）；`subtitleFadeIn 0` 对应「是写上去不是淡入」。该条目本身声明 `source` 为「STYLE.md §2-§6 + lib/dub-visual.json（demo 代码抽取）」，`synthetic:false`。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **【已修】9:16 曾不适配**：原记「`styles/blueprint/` 全目录无 `aspects` 声明；9:16 导出会裁掉右侧约 43.75%、下方全黑，字幕注记框与图纸家具（标题栏 / PARTS LIST / GENERAL NOTES）都在右侧或右下，会被整块切掉」。**2026-10-04 已修**：`film.js` 声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:12`）；`main.js` 把输出画布设成视口尺寸；`paper.js` 的着色器加「设计帧 → 当前帧等比装入」（`fitS = 0` 分支保证 16:9 逐字节不变），纸面取样同步 `cam.z × fitS` ⇒ 绘图完整、纸面四周延伸。3 帧 16:9 md5 全同；9:16 实测不裁切、不变形，字幕注记框完整（见第 2 节子段）。
- **本次出片字幕源没重生成**：日志明确告警——`styles/blueprint/demo/tools/subs.mjs` 以退出码 1 失败，**本次 `.srt` 沿用仓库里已提交的旧文件，未重新生成**（`logs/blueprint.log:27`、`:33`、`:161`）。也就是说成片里的字幕时间**不是本次新算的**，与本次音频的对齐未被验证。
- **字幕注记框不在底部**，这既是风格要求也是使用门槛：换成通用「底部居中字幕」的模板会立刻破风格。
- **响度比目标高 0.1 LU、动态偏紧**：成片实测 `I = −13.9 LUFS`（目标 −14）、`LRA 3.4 LU`（`logs/blueprint.log:164-166`）。LRA 3.4 LU 说明全片动态被压得较紧，而本风格刻意保留了两段**真数字静音**（RMS −200 dB，`logs:118-121`），压缩过紧会削弱静默与乐段之间的对比。
- **真峰值超交付线 0.17 dB（本次新补记，按 2026-10-03 统一口径由 −2 减半为 −1）**：成片真峰值 **−1.03 dBTP**（`loudnorm` `input_tp`，4× 过采样；`STYLE.md` 未声明更严上限，按项目线 −1.2 dBTP 判）。真峰值为负 ⇒ **未削波**，属『仅超线』，基准 −2 档；过冲根因在 **mux/编码阶段**（`loudnorm` 抬峰 + AAC 编码过冲），**非本风格音频链所致，属项目级既有缺陷** ⇒ 减半为 **−1**，`audio 18→17`。★ 口径不按「走 core 还是走自带副本」分：`core/render/mux.sh`（`LN_TP=−1.7`）与各 demo 自带 `mux.sh` 副本（多半写死 `TP=−1.2`）都是项目提供的模板，两类一律减半（理由与逐项见 `_distill.json.audioScoreBasis`）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 −1.03 dBTP → **−1.74 dBTP**，已在 −1.2 dBTP 交付线内；音频评分回补 +1（见第 10 节）。★ 2026-10-04 多比例重渲后复测（2026-10-05）：当前入库成片真峰值 **−2.40 dBTP**——−1.74 属重渲前版本。

### 素材缺口
- 样片用的手写体 **Architects Daughter** 与标题栏字体 **B612** 依赖 demo 自带的 `fonts/`；`dub-styles.json#blueprint` 里因本机无该字体而退回 `KaiTi`（`subtitle.fontFamily`），**字形观感会与样片有差**。
- 采样音源（VCSL 羽管键琴/竖琴、VSCO 2 CE 巴松/弦乐）为项目内素材，**外部复现时缺这套音源**。
- 本风格**没有可复用的现成主体库**：每换一个主题都要新写一个 `machine.js` 式模块。

### 能力限制
- **不能做 3D**：只允许正投影 + 斜二测/等轴测（`STYLE.md:12`）。斜二测深度因子只在 **0 → 0.5** 之间动画。
- **不能有第三种颜色**，全片只有一次非蓝（红章）。
- **不能有真人**：人物只能是拿笔的手影或签名。
- 静默段是**真数字静音**（实测 −200 dB RMS），如果下游通路会自动加底噪/加压缩，会破掉这个设计。

### 踩过的坑（本机实测）
- **主图形贴纸边**：全景会露桌面。解决：主图形离会被取景的纸边至少 `960/zoom`，样片为此把纸从 3200×2000 加高到 3200×2200 并把机器右移（`DEMO.md:134`）。
- **向上的爆炸撞页眉**：爆炸要主要向上 + 向侧，并在爆炸时压扁吊臂让网兜横向展开（`DEMO.md:135`）。
- **字幕画在 ink 缓冲**会随纸跑掉且不能压线 → 必须独立 overlay 纹理、预乘 alpha 最后合成（`DEMO.md:136`）。
- **唯一真实物被自己的影子压暗** → 在 fx 缓冲上把它的区域乘 `rgb(0,255,255)`，只把阴影通道清零（`DEMO.md:137`）。
- **逐瓣着色读起来像葡萄 / 气泡膜** → 一个形状只用**一个跨整体的渐变**，新月形阴影用「并集减位移并集」的遮罩（`DEMO.md:138`）。
- **重叠加色圆填云会冒泡** → 并集按**一条路径** `fill('nonzero')` 填（`DEMO.md:139`）；扇贝弧方向画反会像星芒（`DEMO.md:140`）；半鼓的云像甜甜圈，内瓣要早长 `r × min(1, pf × 2.2)`（`DEMO.md:141`）。
- **回报物太小会毁掉情绪回报** → 回报物要占**画面高约 1/3、居中、逐笔画出**（茎 → 叶 → 每拍一瓣），旁边留可见水渍，且字幕不要压在它上面（`DEMO.md:142`）。
- **被网兜接住的东西会透出来** → 不要整体把网画上去：先在前缘下方用物体本体填，再画网与前缘、跳过背缘（`DEMO.md:143`）。
- **whisper 把 "Figure one" 读成 "Figure 1"** → 在 `lines.json` 加 `asr` 字段（`DEMO.md:145`）。
- **不要在仓库根留下散落文件** → 一律用绝对路径写进风格自己的目录（`DEMO.md:146`）。

### 下次迭代优先补什么
1. **让字幕源能重新生成**（修 `tools/subs.mjs` 或改用受支持的入口），消除「字幕沿用旧文件」这个告警。
2. **【已完成】9:16 已适配**（见第 2 节子段）：走的是着色器「设计帧等比装入 + 相机重取景」，主体与注记框完整、不裁不变形；**仍未做**的是「真竖版重排」——把主体与注记框重排成竖构图、重算字号与安全区（需改 `CAMS` 与注记框落点，本轮未做）。
3. 内置一套**手写体/标题栏字体**（OFL）随 demo 分发，避免下游退回 KaiTi。
4. 抽一个**通用 `machine.js` 模板**（几何 + `EXP`/`ORDER`/`EXSEQ` + `meshAngle` 骨架），降低换主题的成本。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/blueprint/blueprint.mp4`（46.67s / 43.9MB / 46,064,767 B） |
| 抽帧 | `D:/lemo-tools/_distill/frames/blueprint/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **93/100**（2026-10-05 校正：原 90，9:16 画幅缺陷已修并回补 composition +3）（2026-10-03 校正：原 89，音频真峰值缺陷已修，audio +1）（本轮由 90 下调 1：新补记成片真峰值 −1.03 dBTP 超 −1.2 dBTP 交付线 0.17 dB，取 −2 档、按 mux/编码根因减半为 −1） |
| 详细资料 | 有：`styles/blueprint/STYLE.md`、`styles/blueprint/DEMO.md`、`styles/blueprint/demo/build.sh`、`styles/blueprint/style.json`、`lib/style-dna/blueprint.md`、`lib/dub-styles.json#blueprint`、`_distill/logs/blueprint.log`、抽帧 |

**逐帧拆解要点**：
- **f01**：整张空白晒图纸铺在深色桌布上，纸面带十字折痕与不规则漂白边角，一条深色丁字尺横过纸面上部——**开场是「纸卷甩开 + 丁字尺」的建立镜**，画面里没有主体。
- **f04**：机器（吊臂 + 桅杆 + 底座齿轮）已在中左被画出，占画面高约 80%；右中偏上是 **NOTE 1** 注记框，写着 `Figure one. An apparatus for catching clouds.`——确认「**字幕按镜头放在空白天空、不在底部**」。
- **f08**：爆炸视图，零件四散、带编号气球，右下露出 PARTS LIST，右中 **NOTE 2**（13 parts, one bellows…），左下角 **FIG. 2 · EXPLODED VIEW** 已写上——确认 **Fig 编号当转场**。
- **f12**：中景，页眉 **THE CLOUD CATCHER** + PATENT PENDING 在左上，右侧 GENERAL NOTES 注释栏成列，右中 **NOTE 3**（It works beautifully. Except, there are no clouds on this sheet.）——**缺陷揭示**。
- **f15**：画面中部出现**手绘修订云线**，里面写着 `(NO CLOUDS ON SHEET)`，右侧可见**拿笔的手影**，右中 NOTE 4 `So, I issued a revision.`，还可见 `REV 1 → AND ONE CLOUD` 的小标注——**修订段**。
- **f18**：云线已鼓成**带体积与渐变的真云**，雨滴落下、网兜接住，右中 **NOTE / ONE @ CLOUD** 标注，底部 **FIG. 3 · IN OPERATION**——**符号成真 + 回报**，云是画面里唯一有柔和明度的东西。
- **f20**：雨仍在落，画面中部**逐笔画出的一株植物**（茎 + 叶 + 花）从底座长出，右中 **NOTE 5**（It rained on the drawing. I'm told drawings don't do that.）——回报物居中、约画面高 1/3。
- **f22**：镜头拉回整张纸，右上是完整 PARTS LIST（13 行零件表，含 `COUNTERWEIGHT (GRANDMOTHER'S IRON)` 这类机灵话），右下是标题栏，NOTE 6 `Status: works. Slightly damp.`，**红章 WORKS** 斜盖在 PATENT PENDING 上。
- **f24**：片尾卡 = 标题栏全貌——TITLE `THE CLOUD CATCHER`、INVENTOR `Cornelius Wrenfield`（Allura 手写签名）、DATE `25 SEPT. 1891`、DWG NO. `CC-001`、SCALE `1 : 12`、STATUS `PATENT PENDING` 上有红章 `WORKS`、STYLE `BLUEPRINT`、DRAWN BY `LemoLab × Claude Opus 5.5`。
- **节奏与色走**：全片蓝色基本恒定（纸的明度有细微推移，靠折痕/水渍/漂白边角制造），**唯一一次色相跳变是 f22/f24 的红章**。转场全是硬切 + FIG 编号改写，没有叠化。字幕共 6 条，每条停在屏上约 2–3s 后随下一句切换。
- **未见明显瑕疵帧**：24 帧里没有糊、闪、错位、黑边；字幕未溢出注记框。

**自检发现的缺陷**：本次日志有 **1 处告警**——`tools/subs.mjs` 退出码 1，`.srt` 沿用仓库旧文件、未重新生成（`logs/blueprint.log:27/33/161`）；**离线复测另发现成片真峰值 −1.03 dBTP 超 −1.2 dBTP 交付线 0.17 dB（真峰值为负、未削波；取 −2 档、按 mux/编码根因减半为 −1）**；其余环节（事件 343 条、ASR 6/6 OK、`MIX_OK`、`MUX_OK src_frames=1120 out_frames=1120`）均正常。抽帧侧未见画面瑕疵。 ★ 2026-10-03：成片真峰值已修（−1.03 dBTP → −1.74 dBTP，音频重混；★ 2026-10-04 重渲后当前实测 **−2.40 dBTP**），见第 11 节。

**本次为补齐短板做了什么**：**画幅上做了一处改动**——`demo/film.js` + `demo/main.js` + `demo/paper.js` 已按 `MAINTAINING.md` 的多比例范式改造为支持 9:16（着色器 uv 等比装入 + 相机重取景，见第 2 / 9 / 11 节；16:9 逐字节未变）。**其余源码未动**；字幕源告警写进第 11 节，留给下一轮迭代。
