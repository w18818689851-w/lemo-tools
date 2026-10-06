---
name: lemo-style-spy-titles
description: 【lemo 风格 Skill · 60s 间谍片头】需要「1960 年代剪纸片头」的观感时用：四种不透明油墨平涂、手剪毛边、剪影木偶在由字幕自己搭成的布景里追一个东西，铜管强奏就是剪辑点，最后所有碎片沿 30° 斜线飞回拼成片名。选定本风格做视频时，优先读本文件。
slug: spy-titles
name_zh: 60s 间谍片头
category: 图形与排版
film: The Velvet Cipher
---

# 60s 间谍片头（`spy-titles`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/spy-titles/STYLE.md` · `styles/spy-titles/DEMO.md` · `styles/spy-titles/demo/build.sh` ·
> `lib/style-dna/spy-titles.json` · `lib/style-dna/spy-titles.md` · `lib/dub-styles.json#spy-titles` ·
> `styles/spy-titles/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部「纸片被剪刀剪出来、在字幕自己搭成的布景里追一个东西」的 1960 年代片头。四种不透明油墨平涂、**没有渐变**；每块形状都有手剪毛边，靠 2.4px 底色切缝和小纸影分层；人物一律剪影侧面，只靠轮廓与节拍表演；**字幕本身就是建筑 / 道具 / 交通工具**；铜管强奏就是剪辑点；最后所有碎片沿 30° 斜线飞回拼成片名（`STYLE.md:6-14`、`lib/style-dna/spy-titles.md:11`）。

**不是什么**（最容易做错的邻居风格）：不是平面矢量动效（边是剪出来的、纸是实物）；不是半调网点印刷（没有网点）；不是瑞士网格（这里全是斜线与歪斜字）；不是带枪管开场和道具的间谍 parody（`STYLE.md:15`）。

**什么时候用它**：片头 / 活动开场 / 预告片——尤其是「追一个东西，追到最后发现追的就是片子本身」的主题。产品发布 → 产品就是被偷的物件、它的 logo 就是碎片拼出来的东西；讲座 → 核心概念穿过四个「章节」；生日 → 追逐结束时名字拼出来（`DEMO.md:16-26`）。

**一句话内核**：**字即布景 + 强奏即剪辑点 + 斜线网格拼片名**——这三条骨架不能拆（`STYLE.md:106-110`、`DEMO.md:26`）。

**边界**：这个风格**撑不起**抒情、写实、内心独白、长复合句的内容。它没有对白戏、没有表情戏、没有渐变光影，也没有任何「真实人名」可以出现在字幕里（字幕只写虚构职务，`STYLE.md:36`）。需要承载超过 60s 的复杂论证时不要用它——它的叙事单元是「一拍一个动作」。

---

## 2. 画面构图

- **镜头数与画幅**：24 fps，原生 **1920×1080（16:9）**；★ 2026-10-04 起**已适配 9:16**（`aspects: ['16:9','9:16']`，见本节末子段）。样本片 1058 帧 / 44.08s，主 demo 走的是单画幅 + 内部蒙太奇（`style.json:16-17`、出片日志 `MUX_OK 20066216 src_frames=1058`）。
- **主体位置与占比**：剪影人物**很小**，永远在巨大的字幕字形之间穿行（帧 f06：两个小人站在 STARRING 的字腰上；帧 f08：人物贴在 RING 的竖笔画旁）。人物约 7 头身、窄檐帽、宽肩外套、尖头鞋，**全身只有一处彩色（红领带）**兼作运动指示器（`STYLE.md:22`）。
- **负空间 / 留白**：大片**平涂底色**是构图主角。冷开场是一整屏黑（帧 f01），只剩一个红色钥匙孔；片名段落是一整屏奶油纸（帧 f19/f22/f24）。字与字之间的空隙就是「街道」，人物跑在字距里。
- **图层叠放顺序**（从底到顶）：① 单场主导底色（黑 / 红 / 奶油 / 芥末）→ ② 背景道具（用底色的**更深变体**，绝不用黑）→ ③ 纸片形状（带 2.4px 底色切缝 + 纸影）→ ④ 剪影人物（离屏融成一个外轮廓后整体贴回）→ ⑤ 追逐物 MacGuffin（永远压一层黑色背衬，是全画最亮的东西）→ ⑥ 整屏纸纹 multiply + 漏印白点 screen → ⑦ 左下字幕纸条（`STYLE.md:26-32`、`DEMO.md:57-63`）。
- **安全区**：字幕纸条固定在**画面左下**（16:9 为 `(96, 958)`；9:16 按 `FX/FY` 重排到 `(54, 1703)`，仍在左下，见本节末子段），片名与片尾卡居中偏上；人物允许被字形遮挡，但**帽檐、鼻子、领带必须露出来**，否则读成「那里没人」（`STYLE.md:92`）。
- **本风格不能出现的构图**：居中对称的 UI 式版式；任何渐变 / 光晕 / 景深虚化；枪管视角；把字幕放在画面中轴当普通字排（字幕必须是布景）。

### 在 9:16（产品默认）下的表现

★ **2026-10-04 已适配**（`aspects: ['16:9','9:16']`，`demo/film.js:14-19`）。`renderFilm()` 首行按视口调 `setFrame(W,H)`（`film.js:420` → `paper.js:8-11`），算出 `FX=W/1920`、`FY=H/1080`、`S=min(FX,FY)`；**相机 `zoom` 乘 `S`**（`scenes.js:10` 的 `cam(cx,cy,s)` → `z=s·S`，屏幕中心仍是 `W/2,H/2`），世界坐标保持设计帧 1920×1080 不变；**屏幕空间的家什**改走「设计帧 → 当前帧」的等比装入变换 `dXf()`（`paper.js:10`）：劈开的两半（`film.js:73`）、百叶竖条（`film.js:104`）、碎片条（`film.js:330`，条宽 `260·S`、以 `W/2,H/2` 为中心）、远景视差（`scenes.js` 的远山 / 月亮）都据此与相机内容对齐；**字幕纸条**（`frames.js:11-14` 的 `subStrip`）位置按 `FX/FY`（左下 `(96,958)` → `(54,1703)`）、字号 / 纸条高 / 图标按 `S`；`main.js:12-15` 让 canvas 尺寸与 `W/H` 都跟视口走。
竖屏 1080×1920 实测（Read 看图确认）：**冷开场**红钥匙孔居中偏上、完整不裁；**机场段**巨型 `STARRING` 撑满画宽（左右出血是设计本身在 16:9 里就有的）、两个人物与 `THE AGENT` 牌完整、字幕条落底；**丝绒段 / 赌场段 / 屋顶段**主体（丝绒钥匙、`and THE COURIER` + 轮盘 + 赌桌白框、月亮前的两个剪影）都居中完整入画；**列车段** `MUSIC BY THE SAMPLER` 撑满画宽、人物在字腰上；**片名段** `THE VELVET CIPHER` + 举钥匙的小人完整居中；**片尾卡**整块居中。**没有主体 / 文字被裁**。**16:9 逐字节零回归**（t=1.0 / 3.0 / 5.5 / 12.0 / 18.0 / 23.5 / 28.5 / 34.5 / 42.0 九点 md5 与改造前完全相同）；9:16 与「16:9 中心裁切」的 SSIM 实测 **0.58–0.84**（≈1 才表示没重排）⇒ 确为真重排、非裁切。**口径说明**：世界内容按 `S` 等比装入并居中，竖屏上下留出的边是**与底色同色**的（不是黑边，故多数场次读起来像「竖版海报」）；横向追逐段落的「左→右」屏幕方向在竖屏下幅度变小，但方向与因果不变。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 底（墨黑） | `#1b1714` | 冷开场、屋顶夜景、片名锁板的背 | `DEMO.md:57`、`paper.js:5-8` |
| 底（纸奶油） | `#efe4c9` | 丝绒段、片名段、字幕纸条底 | `DEMO.md:57` |
| 强调（信号红） | `#d23a22` | 钥匙孔、领带、网格、危险 | `DEMO.md:57` |
| 次强调（芥末黄） | `#e2a52a` | 机场段底色、钥匙（MacGuffin） | `DEMO.md:57` |
| 深色变体 | `#9a2a18` / `#b07e1c` / `#d9ccae` / `#3a322b` | 只用于纵深与影子（暗红 / 暗芥末 / 暗纸 / 远景城市） | `paper.js:5-8` |
| 字幕字 | `#1B1714` | 亮底上的字幕正文 | `lib/dub-styles.json#spy-titles.subtitle` |
| 字幕条底 | `#E6141414` | 纸条半透明底 | `lib/dub-styles.json#spy-titles.subtitleBack` |

- **明度 / 对比规则**：四种油墨**互不透明、绝不渐变**。每场只允许**一个主导底色**，其余三色做前景；背景道具只能取该底色的更深变体，用黑会读成字母（`STYLE.md:31`、`DEMO.md:57`）。
- **禁止出现的颜色**：任何中间调渐变、任何第四种以外的色相、任何半调网点灰。派生通路里 accent 取 `#AF301C`（WCAG 从底色推得的对比色），与纸上的 `#d23a22` 属同一红族，可接受（`lib/dub-styles.json#spy-titles.palette`）。
- **同一画面最多几个色相**：**4 个**（含底色）；实际多数画面只同时出现 3 个。

---

## 4. 转场规则

- **镜头之间怎么切**：**硬切**，而且切点必须落在**铜管强奏**上。样本片的 `HIT` 表（`story.js:6-8`）把 **10 个**强奏时刻全部钉在 132 BPM 网格上：`split=2.2727s`、`snatch=5.9091s`、`hide=11.3636s`、`train=16.8182s`、`freeze=20.4545s`、`roulette=22.2727s`、`pupil=25.0s`、`moon=25.9091s`、`title=33.1818s`、`button=36.8182s`（出片日志 hits 段、`story.js:6-8`）。★ **勘误**：`resume=21.3636s` **不在 `HIT` 表里，而在 `T` 表**（`story.js:16`，写作 `resume: B(12, 3)`）——它是 stop-time 定格之后的「恢复」命名时刻，不是独立强奏剪辑点，**规划剪辑点时不要把它算进 HIT 计数**。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有叠化、没有闪白、没有淡入淡出**。允许的转场只有来自「剪辑 / 剪纸工艺本身」的五种：沿 30° 切线劈开（`STYLE.md:60`「Diagonal split into a grid」）、百叶翻走（12 条竖条，`film.js:99-110`）、风衣划像（`story.js:13`）、**定格（stop-time）**（`STYLE.md:45`）、沿斜线长条交替滑走（`STYLE.md:46`「Shattering」）。★ **勘误**：原先此处引的是 `STYLE.md` 第 111 行，但该行是**空行**——`STYLE.md` 里**没有**这份「五种转场」清单（最接近的只有第 60 行的 diagonal split、第 45 行的 Stop-time、第 46 行的 Shattering、第 64 行的 `strong diagonals (~30°) … No dissolves`）；其中「百叶翻走」「风衣划像」两项 `STYLE.md` **完全无对应文字**，只见于 demo 源码，故改为按内容分项标注出处。
- **硬切点怎么定**：**强奏提前约 8ms 放置**，让采样峰值正好落在剪辑帧上（`STYLE.md:69`、`DEMO.md:82`）。
- **转场时长与缓动**：切是瞬时；字幕纸条滑入 0.18s（ease-out，从左侧滑入 60px）；字幕条 / 网格线落拍时**停死**（short ease-out，`film.js:28-29`、`DEMO.md:43`）。
- **绝对不要的转场**：溶解 / 叠化等 UI 式转场；任何元素淡入 / 滑入（字幕纸条除外，且必须落拍）；无来由的运镜；**形状匹配剪辑时圆心位置或大小发生移动**（移动了匹配就不成立，`STYLE.md:97`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | League Spartan 600（字幕）；credits 用 League Gothic（OFL），字形经 opentype.js 取轮廓后**逐字母重剪** | 
| 字号（相对画面宽 / 高） | 44 px @1080 高 = **画面高 4.07% / 画面宽 2.29%**（`STYLE.md:37`）；派生通路 `fontSizeFactor: 0.04074` |
| 颜色 / 描边 / 阴影 | 亮场：墨黑字 `#1B1714` 压奶油纸条；暗场：奶油字压墨纸条（`DARK_SUB` 表切换）。**无描边**（`outlineFactor: 0`），纸条自带半透明底 `#E6141414` |
| 位置 / 安全边距 | 左下 `(96, 958)` @16:9；★ 9:16 下按 `FX/FY` 重排到 `(54, 1703)`（仍在左下，见第 2 节末子段）。`marginLFactor: 0.07963`、`marginVFactor: 0.14537`、`align: 1`（`lib/dub-styles.json#spy-titles.subtitle`） |
| 单行字数上限 / 最多行数 | **单行**；口播单句 ≤ 4.5s，样本实测 17–29 字符（`He travels light.` = 17，`Tonight, he runs out of roof.` = 29） |
| 出现与消失方式 | 纸条从左侧滑入 60px、0.18s ease-out；停留 ≥ `max(1.8s, 语音时长 + 0.6s)` 后直接消失（`film.js:22`、`DEMO.md:67`） |

- **字幕与旁白的关系**：字幕是**旁白的纸条化呈现**，纸条一端有一个小的**红色钥匙孔字形作 bullet**（帧 f01 可见）。旁白是「磁带里放出来的秘密简报」：第三人称、现在时、短句、不带情绪，英国男声（Kokoro `bm_george`，speed 0.9–0.97）。**结尾句回扣开头句**（`Nobody knows what it opens.` → `Now you know what it opens.`）。
- **本风格特有的字幕禁忌**：① **credits 绝不进字幕带**——credits 是布景的一部分，每个地点一行，且必须在某一刻完整可读（「R R I N」这种只露一半的读法很难受，`STYLE.md:93`）；② 字幕里**绝不写真实人名**，只写虚构职务（「A LEMOLAB PICTURE」「STARRING THE AGENT」「MUSIC BY THE SAMPLER」）；③ 不用第一人称抒情句、网络口播腔、感叹号堆叠、长复合句（>30 字符会盖过 0.18s 纸条滑入与一个乐句）；④ 抽象概念不当主语——只说能被剪成形状的人、物、地点（`lib/style-dna/spy-titles.md:50-54`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「Subtitles on a narrow paper strip (scissor-cut ends, slightly tilted)」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#19D9CCAE`（AARRGGBB，落盘 ASS 为 `&H19AECCD9`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。**底衬色为回退值**：demo 的 band 未读函数体（函数名即 `subStrip`，`film.js:25`），无法取 demo 真值，也就无法核验 demo 底衬与本配置字色的对比度是否达标（<3.0），故改用该风格自身的地色/辅色（palette.bg2 #d9ccae @0.90）；字色 #1B1714 与该底衬的 WCAG 对比度 **11.43**。

---

## 6. BGM / 音效特征

- **配乐**：**1960 年代间谍大乐队**（不是 cool noir jazz、不是 ragtime）。乐器：叠八度的顿音小号 + 长号 + 镲（= stab）、经自制弹簧混响的低音弦电吉他、行走低音提琴、鼓刷（软军鼓 + 蛋形沙锤）/ 鼓棒（列车段用十六分「铁轨」军鼓）、邦戈与沙锤（赌场段）、颤音琴、长笛、管风琴强奏、羽管键琴。**调性**：小调、半音线条、附点节奏。**BPM 132**（1 拍 ≈ 0.4545s，1 小节 ≈ 1.818s，`story.js:2-3`、`DEMO.md:49-50`）。
- **原创动机**：从五级半音下行再跳到主音（B–A♯–A–G | E）。★ **避开**最著名间谍主题的 E–F–F♯–F 半音爬行与 Em(maj9) 收尾和弦，收在 **Em6/9**（`DEMO.md:49`、`lib/style-dna/spy-titles.md:138`）。
- **拟音（foley）清单**（全部程序合成，按材料分层）：纸（剪刀 cut「shh」、纸滑、**卡片拍击 = 字母落地**、翻纸、撕裂 = 碎裂）；金属（钥匙叮当、链子崩断、钥匙滑进锁、锁咔哒、轮盘咔啷）；磁带（咔哒、嘶声）。环境只暗示：喷气机掠过（pan L→R）、列车隆隆带按拍的车轮 ka-chunk、轮盘球渐慢滴答、屋顶风、电话铃、楼梯脚步（`STYLE.md:71`、`mix.py:19-98`）。
- **旁白处理**：磁带链路——带通 220–5200 Hz + 软饱和 `tanh` + 0.9 Hz 抖晃 ±0.25% + 人声处抬高的磁带嘶声（`mix.py:119-137`）。音乐在人声下 **duck ~−7 dB**（demo 实际 `1 − 0.55·duck`，`mix.py:143-152`）。
- **响度目标**：`−14 LUFS`；**交付真峰值上限**：`−1.2 dBTP`（`STYLE.md:73` 只写 −14 LUFS，未额外声明更严上限，按项目线判）。成片实测 **I: −13.9 LUFS / LRA 4.6 LU（`ebur128`）/ 真峰值 −2.23 dBTP（`loudnorm` `input_tp`，4× 过采样）—— 真峰值在交付线内，余量 1.03 dB、未削波**（出片日志第 206-207 行只印了 I 与 LRA）。★ 峰值性混音（强奏压轻鼓刷）在 −1.2 dBTP 天花板下只到 −14.4 LUFS，需**先推 ~4 dB 进限幅器再 loudnorm**（`DEMO.md:83`）；本片素材峰值本身偏低，故成片真峰值远未触线。
- **静音策略**：静默是**真零**（连混响尾巴都算）。样本片有三段绝对静音区：冷开场 0–1.5799s、stop-time 20.6–21.3636s、结尾一拍 37.1–37.7273s，实测 `max_abs: 0.0`（出片日志 zones 段、`mix.py:148-151`）。最后一句只压在磁带嘶声上。

---

## 7. 素材偏好

- **需要什么素材**：① 一份**节奏网格**（`story.js`，BPM/BEAT/BAR/HIT/T，唯一时间真值）；② 一组**旁白行**（`lines.json`，每条 `{id, t, text, voice, speed}`，单行 ≤4.5s）；③ 一套**四色板**（`paper.js` 的 `C`：ink/paper/red/mus + 3 个深色变体）；④ 一组**字幕纸条**（`frames.js` 的 `subStrip(text,{dark,dx,a})`）；⑤ 一套**片名字形**（`title.js` 的 `GLYPH` 表 + `titleLayout`）；⑥ 一份**音效事件表**（`film.js` 的 `events()` 返回数组）。
- **不需要什么素材**：**不需要任何实拍素材、照片、视频片段、贴图**。整片由 Canvas2D 程序绘制；纹理、纸影、剪边全是代码生成。
- **取景 / 质感 / 比例偏好**：平面、正投影、无透视；强对角线约 30°；大块平涂底色；人物小、字大；纸的质感来自「低频云纹 + 2600 根纤维 + 每 3px 一条极淡横向刮墨条纹 + 9000 个漏印纸白点（只在深墨上显形）」，封装再加 film grain ~6（`paper.js:92-122`、`DEMO.md:60`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：① 缺 opentype.js 字体文件 → 用 Canvas 系统字体路径 + 手工折线化，仍要**逐字母重剪**（毛边 + ±0.8° 旋转 + ±1.5px 基线错位），否则字会「太干净」而不像剪纸；② 缺原创配乐 → 宁可只留拟音 + 强奏打点，也不要用通用 BGM 库（会破坏「强奏 = 剪辑点」的因果）；③ 缺剪影骨架 → 用最简「帽子 + 外套 + 一条飘动的领带」三件套，领带的波动是唯一的运动指示器，不能省。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 追逐段逐段缩短：形状匹配剪辑的间隔 2 小节 → 1.5 小节 → 2 拍（`DEMO.md:22`） |
| 全片时长 | **44.08s**（样本片）；文档给 30–60s 区间，情绪弧建议 **35–45s**（`DEMO.md:28`、`style.json:17`） |
| 镜头数 | 由 `HIT` 表定：**10 个**强奏时刻（`story.js:6-8`），约 11 个地点 / 段落（冷开场→网格→丝绒→intro→机场→列车→轮盘→赌场→瞳孔→月亮→屋顶→碎裂→片名→按钮） |
| 信息投放节拍 | 1 拍 = 0.4545s；**开头让出 1 拍**给第一句旁白（`OFF = BEAT`，`story.js:2-3`） |

- **加速 / 减速点**：**加速**在形状匹配剪辑段（轮盘→轮盘→瞳孔→月亮→锁孔，间隔从 2 小节压到 2 拍）；**减速**在片名落地段（字母落在连续十六分音符上，`letterLand(i) = T.shatter + BEAT·0.75 + i·(BAR − BEAT·0.9)/14`，`film.js:304`）与结尾的「一拍静默 + 一记干邦戈」。
- **动画节奏（关键）**：**木偶走 on twos（12 fps）**——人物的姿势、位置、字母落地、飞机都用 12fps；**摄影机、字幕滑入、网格生长走 on ones（24 fps）**，因为阶梯式摄影机会读成抖动（`STYLE.md:42`、`DEMO.md:41`）。跑步循环 8 张画、每拍一步（132 BPM 下循环 = 2 拍）、前倾 0.3 rad、领带向后飘约 65°；走路每拍一步、外套摆动。
- **留白与静音的位置**：冷开场只有一记磁带咔哒；stop-time 定格 2 拍、音乐绝对静音；结尾一拍数字静音后一记干邦戈，最后一句压在磁带嘶声上（`DEMO.md:51`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/spy-titles/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/spy-titles/demo --fps 24 --workers 3`（本次出片编排器实际用 `--workers 6 --size 1920x1080`） |
| 帧率 | 24 fps（表演层 on twos = 12 fps） |
| 分辨率 / 比例 | **16:9（1920×1080）与 9:16（1080×1920）均已适配**（`aspects: ['16:9','9:16']`，`demo/film.js:14-19`）。版面从视口重推：`renderFilm()` 首行 `setFrame(W,H)`（`film.js:420`）算 `FX/FY/S`（`paper.js:8-11`）；相机 `zoom × S`（`scenes.js:10`）；屏幕空间家什走 `dXf()` 设计帧→当前帧等比装入（`film.js:73,104,330`）；字幕条 `subStrip` 位置 ×FX/FY、字号 ×S（`frames.js:11-14`）；`main.js:12-15` 让 canvas 与 `W/H` 跟视口走。1920×1080 时 `FX=FY=S=1` ⇒ **16:9 逐字节不变**（实测 md5 相同） |
| 混流 | `CRF=24 sh styles/spy-titles/demo/tools/mux.sh <video> <mix.wav> <out.mp4> 24 6`（响度 −14 LUFS / TP −1.2，颗粒 6） |
| 编码器 | `h264_nvenc`（本地 GPU；`LEMO_VENC=h264_nvenc`，mux.sh 走 `-preset p5 -profile high -rc vbr -cq 28 -b:v 0`） |
| 音频入口 | `python demo/music/score.py`（原创大乐队配乐）→ `python demo/mix.py`（拟音 + 磁带旁白 + 闪避） |
| 字幕入口 | `python demo/tools/subs.py` + `python core/render/srt.py demo/out/subs.json styles/spy-titles/spy-titles.srt` |
| 事件导出 | `node core/render/events.mjs styles/spy-titles/demo` → `events.json`（本次 85 条 / dur 44.0909s） |
| 本风格专属参数 | 混流 `CRF=24`（平涂 + grain 在 crf19 = 270MB，crf24 = 18.5MB **无可见差异**）；审片 `--q nosub=1`；模型表 `--q 'sheet=1&v=1'` |
| 一键复现 | `sh styles/spy-titles/demo/build.sh` |

完整 9 步链（`build.sh:6-16`）：① `core/tts/tts.py lines.json voices` → ② `core/tts/asr_check.py`（本次 mismatches: 0）→ ③ `music/score.py` → ④ `core/render/events.mjs` → ⑤ `mix.py` → ⑥ `tools/subs.py` + `core/render/srt.py` → ⑦ `core/render/video.mjs` → ⑧ `mux.sh` → ⑨ 三张 still（styleframe / poster / modelsheet）。

---

## 10. 编排规则

- **内容文件字段契约**（`content_fields`）：`lines.json` 每条 `{id, t, text, voice, speed}`（样本 6 行 `bm_george` 0.9–0.97）；`story.js` 导出 `BPM/BEAT/BAR/OFF/B(n,beat)/DUR/HIT/T`；`paper.js` 的 `C` 是四色板；`frames.js` 的 `subStrip()` 造字幕纸条；`title.js` 的 `GLYPH` + `titleLayout` 造片名；`film.js` 的 `events()` 造音效事件（`lib/style-dna/spy-titles.md:171-180`）。
- **事件词汇表**（`type` → 消费者，共 24 类）：`tape_click`（磁带咔哒）、`paper_cut` / `scissor`（剪刀 shh）、`paper_slide` / `paper_whoosh` / `paper_flip`、`card_slap`（字母落地）、`blinds`（百叶翻）、`grab`、`key_jingle` / `key_drop` / `key_catch` / `key_slide` / `lock_click`、`chain_snap`、`coat_whoosh`、`step{g}` / `skid` / `land`、`jet`（pan L→R）、`train_bed{d}`（按 132BPM 的车轮）、`wheel_clank` / `roulette{d}`、`pupil` / `wind{d}` / `shatter`。全部由 `film.js:437-473` 的 `EV.push` 产生，`core/render/events.mjs` 序列化成 `events.json`（`lib/style-dna/spy-titles.md:195-214`）。
- **时间线契约**：`story.js` 是**唯一时间真值**。`film.js` 导出 `renderFilm(t, opt)`（逐帧绘制，`opt.nosub` 关字幕）、`DUR`、`subs()`、`events()`；`setLines(lines, durs)` 注入旁白与时长。页面契约（`main.js`）：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。
- **新增主体怎么接入**：用 `paper.js` 画——任意多边形 → `rough(pts, seed, amp, step)` 剪边；恒定形状用 `roughC(key, fn, seed, amp, step)` **缓存**；→ `piece(polys, col, {gap, shadow, gapCol, cut})` 平涂并加切缝 / 纸影。**人物必须在 `silhouette(fn)` 里绘制**（内部自动融成一个外轮廓 + 8 向底色描边 + 一层纸影），关节用 `slit(x,y,ang,len,w=1.7)` 挖缝。基元：`rectP/circP/ellP/arcP/smooth/xf`；整屏收尾 `paperFinish(amt)`。字形：`glyph.js` 的 `layout(str,size,{track,font})` + `drawLine(L,x,y,{col,seed,jit,amp,gap})`（`lib/style-dna/spy-titles.md:184-189`）。
- **换主题时要改哪些文件**：① `demo/lines.json`（重写 6 行简报文案 + 时长）；② `demo/voices/`（重新 TTS 声线）；③ `demo/story.js` 的 `HIT` 与 `T` 命名时刻表（重排强奏 = 重排剪辑点）；④ `demo/scenes.js`（把「钥匙孔/网格/丝绒/机场/列车/轮盘/赌场/瞳孔/屋顶/片名底」换成新主题的地点，每个地点 = 一行 credits）；⑤ `demo/title.js` 的 `GLYPH` 与 `titleLayout`（新片名 + 新锁孔字母）；⑥ `demo/paper.js` 的 `C` 四色板（换主导底色）；⑦ `demo/music/score.py` 的动机。**不用改**：`paper.js` 的剪边 / 切缝 / 纸影 / 剪影融合算法、`film.js` 的表演与镜头逻辑。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里是**派生条目**（`derived: true`，`derivedFrom: palette@lib/dub-visual.json / subtitle-px@STYLE.md §4 / contrast-rule(WCAG)`）。生效参数：`palette`（bg `#efe4c9`、bg2 `#d9ccae`、fg `#1b1714`、accent `#AF301C`、subtitle `#1B1714`、subtitleBack `#E6141414`）、`bgRecipe`（gradient + paper 纹理 + vignette 0.08）、`subtitle`（Microsoft YaHei、`fontSizeFactor 0.04074`、`marginVFactor 0.14537`、`marginLFactor 0.07963`、`outlineFactor 0`、`bold`、`align 1`）、`title.fontSizeFactor 0.11`、`overlay.chapterCards: true`、`motion.subtitleFadeIn 0.18` / `chapterTransition: "cut"`。**注意**：通路里字幕字体是 Microsoft YaHei（中文文案），与 demo 的 League Spartan 600（英文）不同；配色与字幕几何一致（`lib/dub-styles.json#spy-titles`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **9:16 不可用** —— ★ **2026-10-04 已修**：本风格现声明 `aspects: ['16:9','9:16']`（`demo/film.js:14-19`），相机 `zoom × S` + 屏幕空间家什 `dXf()` 重排（`scenes.js:10`、`film.js:73,104,330`、`frames.js:11-14`）。16:9 逐字节零回归（9 点 md5 相同）、9:16 真重排（与中心裁切的 SSIM 0.58–0.84），见第 2 / 9 节。
- **`lib/dub-styles.json` 的条目是派生值，不是逐行手抽**：`notes` 明说「配色来自 lib/dub-visual.json 的 palette（demo 代码抽取）；字幕字号 / 位置取自 STYLE.md §4 的 px 值（÷1080 归一）；字幕颜色由 WCAG 对比度规则从底色推得」。知识库更新时应**优先用代码抽取值替换本条的派生值**——当前 `accent #AF301C` 与纸上的 `#d23a22` 不完全一致。
- **派生条目 `overlay.chapterCards: true` 与 demo 实际不符**：demo 里没有独立的章节卡层，credits 是直接画进布景的（`STYLE.md:36`「Credits live in the set」）。通路打开章节卡会多出一层与风格无关的叠加。
- **字幕底衬色为回退值**：目前用风格自身地色/辅色替代（回退原因见第 5 节）；若要完全对齐 demo，需先统一 `palette.subtitle` 与 demo 的 `textColor`。

### 素材缺口
- demo 自带 `demo/fonts/` 与 `demo/vendor/`（opentype.js 等），**新主题复用时必须一并复制**，否则 `glyph.js` 取不到轮廓、字会退化成系统字体，剪边与重剪逻辑失效。
- 剪影骨架（`chars.js` 的 agent / courier rigs）只有侧面 / 正面 / 背面三套姿势与跑 / 走循环。**新主题若需要第三人（比如「两个特工、一个画幅」的变体）必须新写 rig**，现有资产不够。
- 无任何预生成的配乐 stem 库：`music/score.py` 是纯程序合成，换主题要改动机代码。

### 能力限制
- ~~只能 16:9~~ ★ **2026-10-04 已修：16:9 与 9:16 都已适配**（见第 2 / 9 节）；只能在 Canvas2D 里画（`video.mjs` 走 Canvas2D 路径，本片 1058 帧 ≈ 19s）；没有 WebGL / 3D 能力，做不了透视与景深。
- 「铜管强奏 = 剪辑点」要求**音乐与时间线同源**。若外部替换 BGM，剪辑点会与音乐错位，风格的核心因果就断了。
- 音效全部程序合成，没有真实采样库；「纸 / 金属 / 磁带」三族的质感靠合成，比真采样略薄。

### 踩过的坑（本机实测）
- **`demo/tools/mux.sh` 原先硬写 `libx264`**（CPU 编码，违反「合成渲染走本地 GPU」硬规则），且**缺「音频比画面短时补静音」**——音频短于画面时 `-shortest` 会切掉末帧，编排器判 `MUX_FAIL 帧数不符`。2026-10-03 已把 `core/render/mux.sh` 里这两处**最小外科回灌**到本副本（脚本 `D:/lemo-tools/scripts/patch-style-mux.mjs`）：① 音频短于画面时 `apad=whole_dur=画面长度+一帧`；② 编码器跟随 `LEMO_VENC`。回灌后本副本第 10-24 行可见注释与 `case "${LEMO_VENC:-}"`。
- **本片这次没有触发补静音分支**：`mix.wav` 45.49s **长于** 画面 44.083s，所以是 `-shortest` 裁掉音频尾巴，`MUX_OK 20066216 src_frames=1058 out_frames=1058` 帧数一致。
- 整块人物若每片都描缝会读成**木人模型图** → 必须在离屏图层里融成一个外轮廓、只挖关节缝（`destination-out`），再整体加 8 向底色描边 + 一层纸影（`DEMO.md:74`）。
- **`clear()` 重置变换会静默杀掉相机** → 背景填充必须保留相机矩阵（`paper.js:15-16`）。
- **主角完全藏在字母后 = 「那里没人」** → 必须让帽檐、鼻子、领带结和飘动的领带露出柱子外；领带必须是**多段飘带 + 行进正弦 + 宽度抖动**，否则读成一条舌头（`DEMO.md:76`）。
- **黑色电报杆夹在词车厢之间会读成字母 I** → 背景道具一律推到底色的更深变体（`DEMO.md:78`）。
- **芥末色的钥匙放在芥末色底上会消失** → 必须给黑色背衬（`DEMO.md:79`）。
- **轮盘丢进空格会盖住相邻字母** → 词的两半要按 `2.2 × 半径` 的间隙重新排版（`DEMO.md:80`）。

### 下次迭代优先补什么
1. ~~给本风格补一个 `aspects` 声明或一套 9:16 重排版式（把「一行 credits」拆成竖排两行），否则产品默认导出路径永远不可用。~~ ★ **2026-10-04 已完成**：已声明 `aspects: ['16:9','9:16']` 并从视口重排版面（见第 2 / 9 节）。若还想把「一行 credits」在竖屏下改成真正的**竖排两行**（而非等比装入），仍是可选优化。
2. 把 `lib/dub-styles.json#spy-titles` 从派生值改为代码直抽（尤其 `accent` 与 `overlay.chapterCards`）。
3. 补第三人剪影 rig 与更长的跑步循环（现在 8 张画）。
4. 建一个纸 / 金属 / 磁带的采样库，替换纯合成拟音。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/spy-titles/spy-titles.mp4`（44.08s / 19.1MB，20066216 字节） |
| 抽帧 | `D:/lemo-tools/_distill/frames/spy-titles/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **94/100**（2026-10-05 校正：原 93，9:16 画幅缺陷已修并回补 composition +1） |
| 详细资料 | **有**：`STYLE.md`、`DEMO.md`、`demo/build.sh`、`demo/tools/mux.sh`、`style.json`、`lib/style-dna/spy-titles.md`、`lib/dub-styles.json#spy-titles`、`_distill/logs/spy-titles.log` |

**逐帧拆解要点**：
- **f01（0.0s）**：整屏墨黑 `#1b1714`，正中一个红色 `#d23a22` 钥匙孔（极简、锁定单形状），左下已出现奶油纸条字幕「Your target carries a key.」带红色钥匙孔 bullet。**冷开场只有一记磁带咔哒**（日志 `cold_open_pre_bongo` 0–1.5799s `max_abs 0.0`）。
- **f04（~7.4s）**：底色翻成**纸奶油** `#efe4c9`，画面中央是一块**红色圆角丝绒垫**（带菱形绗缝纹理），上面横着一把丝绒钥匙——红底上的暗红细节，是全片唯一「软」的质感。字幕条仍是奶油底墨字。
- **f06（~11.0s）**：底色切成**芥末黄** `#e2a52a`，巨大的墨黑 `STARRING` 占满下半屏，右上角一块奶油小牌写 `THE AGENT`；两个剪影小人（戴帽、约 7 头身）站在字腰上，**极小**。字幕「He travels light.」仍在左下纸条。→ 印证「字即布景 + 人物小 + credits 活在布景里」。
- **f08（~14.7s）**：底色**信号红**，`RING` 的竖笔画当柱廊，人物贴在笔画旁，领带向后飘。**同一行 credits 在不同帧里被完整读到**（`RING`→`STARRING`）。
- **f12（~22.0s）**：红色底，`Y THE SAMPLER` 当**列车车厢**，两个剪影在词与词的间隙上方跨越；背景有电线杆（用更深的红，不是黑）。
- **f14（~25.8s）**：红色底，`and THE COURIER`，**O 位置换成黑白轮盘**（形状匹配剪辑的落点），下方一排黑红相间的竖条，左下角一条黑色风衣划像扫过 + 一把芥末色钥匙带黑背衬。
- **f16（~29.3s）**：**主角时刻**——墨黑天空，一个巨大奶油圆（月亮）居中，两个剪影在月亮前对峙 / 抓捕，下方是红色 + 芥末色窗格的建筑群。字幕「Tonight, he runs out of roof.」。
- **f19（~34.9s）**：**片名段**——整屏奶油纸，墨黑手剪字 `THE VELVET CIPHER` 分两行、基线错落；`CIPHER` 的 **I 是一块黑色锁板 + 红色钥匙孔**；右侧一个小剪影举着芥末色钥匙。
- **f22（~40.4s）**：片名已**合拢**，I 的钥匙孔里插进芥末色钥匙（「钥匙打开了片名」的揭示），字幕「Now you know what it opens.」——**结尾句回扣开头句**。
- **f24（~44.0s）**：**片尾卡**——小片名居中，下面一条红色分隔线，`60s SPY TITLE SEQUENCE`（剪体字）+ `LemoLab × Claude Opus 5.5`（红色）+ 一行小字 `a LemoLab picture · music by the sampler · cut from paper`，右侧一个**正在扶帽致意的小剪影**。
- **色走**：黑（冷开场）→ 红（网格 / 列车 / 赌场）→ 奶油（丝绒 / 片名）→ 芥末（机场）→ 黑（屋顶）→ 奶油（片名 / 片尾）。**底色随地点整体切换，不是渐变推移**，每次切换都落在强奏上。
- **不动的段落**：stop-time 定格（20.6–21.3636s，连背景滚动一起冻结，音乐绝对静音）；冷开场 0–1.58s 画面几乎静止。
- **字幕节拍**：6 条字幕全部左下纸条、单行、短句，每条约 2–2.5s 停留。
- **瑕疵帧**：抽帧 24 张**未见**糊、闪、错位、字幕溢出或黑边；红 / 芥末底的纸张颗粒在静帧上清晰可见（这正是风格要的）。

**自检发现的缺陷**：无硬缺陷。扣 7 分的原因见下：`palette` −1（`lib/dub-styles.json` 的派生 `accent #AF301C` 与纸上的 `#d23a22` 不完全一致）、`typography` −1（通路字幕字体 Microsoft YaHei 与 demo 的 League Spartan 600 不同）、`composition` −0（9:16 不可用是架构缺陷；**该扣分项已于 2026-10-04 随多比例适配不再成立、2026-10-05 已回补 composition +1**，见第 2 / 9 / 11 节）、`audio` −2（响度 −13.9 LUFS 对 −14 目标差 0.1 LU，可接受；但纯合成拟音比真采样略薄）、`rhythm` −2（44.08s 落在 30–60s 声明区间内，但「形状匹配剪辑间隔从 2 小节压到 2 拍」这一加速在 24 张等间隔抽帧上无法逐拍验证，只能靠 `story.js` 与日志 HIT 表交叉确认）。**当前 94/100**，受限于派生通路参数的偏差（9:16 架构缺陷已于 2026-10-04 修、2026-10-05 回补分数），再往上要改派生通路。

**本次为补齐短板做了什么**：把 `core/render/mux.sh` 的两处修正（① 音频短于画面时 `apad=whole_dur=画面+一帧`；② 编码器跟随 `LEMO_VENC`，默认 `h264_nvenc`）**最小外科回灌**到 `styles/spy-titles/demo/tools/mux.sh` 副本（脚本 `D:/lemo-tools/scripts/patch-style-mux.mjs`）。改动极小、可回滚（只动第 10-24 行），且不触碰 `lemo-make.mjs` 与 `D:/lemo-opuscar` 下的其他源码。本次出片**未触发**补静音分支（音频 45.49s 长于画面 44.083s），但编码器分支已生效——日志第 7 行 `编码 nvenc`、第 201 行 `混流（WSL mux.sh · nvenc）`。
