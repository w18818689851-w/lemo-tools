---
name: lemo-style-silent-film
description: 【lemo 风格 Skill · 1920s 默片】要交付「被放映出来」的年代感叙事片时用：4:3 拷贝夹在影院幕布间的片门里、墨水线加银灰水洗的蚀刻插画、字幕卡代替人声、立式钢琴弹满每一拍。选定本风格做视频时，优先读本文件。
slug: silent-film
name_zh: 1920s 默片
category: 电影与时代
film: The Runaway Loaf
---

# 1920s 默片（`silent-film`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/silent-film/STYLE.md` · `styles/silent-film/DEMO.md` · `styles/silent-film/demo/build.sh` ·
> `lib/style-dna/silent-film.json` · `lib/style-dna/silent-film.md` · `lib/dub-styles.json#silent-film` ·
> `lib/dub-visual.json#silent-film` · `styles/silent-film/style.json` · `styles/silent-film/silent-film.srt` ·
> demo 源码（`film.js` / `cardspecs.js` / `engine/*` / `music/score.py` / `mix.py`）· **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部「被放映出来」的单本默片。画面本体是一张 **1440×1080 的 4:3 拷贝**，居中放在 1920×1080 的片门里，两侧的黑边就是电影院（天鹅绒幕布 + 脚灯）。拷贝上印的是**墨水线 + 银灰水洗的蚀刻插画**，先做纯灰值色调绘制、再过 Redraw（XDoG 暗侧墨线 + 5 级水洗 + 45° 排线，每 2 帧重画）上墨，最后过 Print pass（闪烁、片门抖动、划痕、棕烧、暗角、两八度银盐颗粒、灰尘/头发）。**没人说话**：节拍靠大全景里的动作和字幕卡讲；唯一的声音是影院乐器（立式钢琴，可加簧风琴）与放映间的放映机（STYLE.md:8-12）。

**不是什么**（最容易做错的邻居风格）：不是黑色电影（没有硬阴影当情绪、没有旁白）；不是给现代动画套一个棕褐滤镜（**画本身就是蚀刻上墨的**）；不是卓别林模仿秀（禁用流浪汉造型：圆顶礼帽、牙刷胡、手杖）；不是带拟音的有声片（**没有拟音、没有人声**）；也不是普通二维动画（它是「色调绘制 → Redraw 上墨 → 印老」三段式）（STYLE.md:14，style-dna/silent-film.md:13）。

**什么时候用它**：① 讲一个**机制型笑点**——一个因果链能在同一个大全景里一眼看完；② 做**复古品牌 / 老字号**的年代叙事；③ 需要「无对白也能讲清」的短故事；④ 要把真实影像（公司档案、家庭录像、体育片段）变成年代画（走 `redraw` 模式）。`style.json` 的 `uses` 写的就是 Comedy / Retro brands / Silent storytelling。

**一句话内核**：**数值承载一切 + 一镜一个动作节拍 + 速度是情绪**——深衣对浅墙、浅脸对深内景；一条清楚、中间有停顿的链胜过三条忙乱的（STYLE.md:26, 83）。

**边界**：这个风格**撑不起**信息密度高的内容。多步骤、多主体、小人物尺度的复杂工序在缩略图里就是噪音（DEMO.md:75 记录了首版八步市集链「在缩略图里读不出来」而整段砍掉）。也不适合需要硬阴影情绪、需要旁白解释、需要写实特写表演的题材——2.5D 骨架脸在大特写下像人偶，只能靠大全景和中景演戏（STYLE.md:59）。

---

## 2. 画面构图

- **镜头数与画幅**：全片 13 个 cue-sheet 段落（PRE / TITLE / BAKERY / CARD1 / CHASE / MARKET / CARD2 / ROLL / SIL / CARD3 / TENDER / IRIS / END），画面按「段」组织。画幅是**双层结构**：外层 1920×1080（16:9），内层 **1440×1080 的 4:3 片门居中**（左右各留 240 px 给幕布），片门圆角 **r=22**，四周一圈柔和暗边（`demo/film.js:72`、`demo/stage.js:46-52`）。
- **主体位置与占比**：人物走**真实比例**——成人 **7.5 头身**、儿童约 **5 头身**，在 2.5D 骨架上做（关节在 3D 身体空间解算，再按 yaw 正交投影）。在 1440 宽的片门里，人物通常只占 **1/4–1/3 画高**（远景/全景），留大片建筑立面与街道；主角在片门内基本**居中或略偏左**，道具（滚动的面包）沿画面底部的鹅卵石带横向移动（帧 f05/f07/f11）。
- **负空间 / 留白**：留白是**天空与浅色墙面**（正色片下天空几乎印成白，`demo/sets.js:8-16`）。浅墙 / 白雪 / 浅围裙是画面里最亮的东西，用来托住深色人影。街道与广场故意空着——**等待就是笑点**（帧 f09 是纯空街的锁定镜，一个人也没有）。
- **图层叠放顺序**（从底到顶）：① 灰值色调绘制的 4:3 场景（天空 → 建筑 → 地面 → 人物 → 接地阴影）→ ② Redraw 上墨 → ③ 虹膜遮罩（圆外黑，柔光边缘）→ ④ FilmPost 印片 → ⑤ 灰尘/头发/污点 → ⑥ 片门 + 两侧幕布 + 脚灯（`demo/film.js:3`、`demo/stage.js:12-34`）。
- **安全区**：字幕卡是**满片门**的（黑漆卡铺满 1440×1080），文字四周留出 deco 边框的宽度；片门之外（左右各 240 px）永远是幕布，**不放任何信息**。主体贴地线，不在片门边缘切人物。
- **本风格**不能**出现的构图**：大特写（骨架脸像人偶，只能小、或放进虹膜里）；同场景镜头之间的叠化；现代甩镜；无动机运镜；无脚灯的闭合幕布（会变纯黑，见第 11 节）。

**在 9:16（产品默认）下的表现**：本风格**已适配 9:16**——`FILM_META.aspects = ['16:9','9:16']`（`demo/film.js:20`），`stage.js` 导出 `NATIVE`（`stage.js:15`）与 `setFrame(w,h)`（`stage.js:25`），由 `main.js` 按视口尺寸调用（`main.js:9-10`）派生 `W/H/FX/FY/S = min(fx,fy)`（`stage.js:26`）。两条独立的轴：① **影院（黑场 + 两侧天鹅绒幕布）是当前帧的家什**，`theatre(g, W, H, GATE, …)` 随帧铺满整帧（`demo/film.js:71`），幕布闭拢的 `curtainsOver()` 也走当前 `W/H`（`demo/film.js:80`）；② **4:3 片门是风格特征，按紧轴等比装入并居中**——`GATE.w = FW × S`、`GATE.h = FH × S`、`GATE.x/y = (帧 − 片门)/2`（`stage.js:27-28`），片门**不拉伸**（一拉伸就不是 4:3 了）、**不裁切**，圆角 `22 × S`（`demo/film.js:72`）。片门里放的 1440×1080 影片画布（世界）在合成时**整幅按 `S` 缩放进片门**（`g.drawImage(dev, GATE.x, GATE.y, GATE.w, GATE.h)`，`demo/film.js:73`），所以镜头 / 字幕卡 / 虹膜全部**原样**、只是等比缩小——`shots.js` / `scenes/market.js` 的 `const W = 1440, H = 1080` 是影片画布坐标系，**一行未改**。1080×1920 实测（`S = 0.5625`）：片门 **810×607.5 居中**（x=135, y=656.25），左右各 135 px 幕布、上下各 656 px 影院黑——**不裁切、不变形，4:3 片门与两侧幕布完整保留**。★ **落到「等比装入 + 同色留白」这一档**（不是重排版面）：留白是影院自身的黑 `#050404`，与片门外的黑同色，接得上。字幕卡是满片门黑漆卡、卡内文字居中，**整卡完整可见**（实测 t=27.11 的 CARD2「STOP THAT / BAKER!」两行都在片门内、无裁切）。与「16:9 中心裁切」的 SSIM 实测 **0.38 / 0.60 / 0.39**（`≈1` 才说明是裁切）⇒ 确为**等比装入**而非裁切。**代价**：4:3 片门在竖屏上只占画面中部约 24% 面积，上下大片影院黑；损坏颗粒/发丝的尺寸随 `S` 缩放（`engine/film.js:152` 的 `o.s`，16:9 时 1）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 底（卡纸 / 观众席） | `#0e0d0b` | 黑漆字幕卡底色、观众席、片门外的影院 | `dub-visual.json#silent-film`（`engine/cards.js:3` CARD_BG） |
| 底 2（更黑） | `#050404` | 剧院最深处的黑、片门内缘 | `dub-visual.json#silent-film`（`engine/cards.js:85`） |
| 主（墨线） | `#15120f` | 蚀刻墨线的墨色（叠在灰值水洗上） | `dub-visual.json#silent-film`（`engine/ink.js:5` INK） |
| 前景 / 文字（暖白） | `#ece5d5` | 字幕卡文字、银盐印片的亮部 | `dub-visual.json#silent-film`（`engine/cards.js:3` CARD_FG） |
| 印片黑 / 白 | 密度 0.055 / 0.93 | FilmPost 的黑场与白场（不是 hex，是印片密度） | STYLE.md:19、style-dna/silent-film.md:27 |
| 强调（可选唯一彩色） | `#d97757` | 「最多一种彩色」的蒙版色；本片未使用 | `dub-visual.json#silent-film`（dub 通路派生 accent） |
| 字幕（dub 通路） | `#FFFFFF` / 描边 `#00000000` / 底 `#FF000000` | 「文案+风格」通路派生的字幕色 | `lib/dub-styles.json#silent-film` |

- **明度 / 对比规则**：**全片单色银盐，没有色相**。灰值密度表（实测）：墨 **0.07**、深色布 **0.15–0.3**、中间木 **0.45–0.6**、皮肤 **0.8**、白亚麻 **0.9–0.95**；水洗只有 5 级 `V = [0.10, 0.24, 0.43, 0.65, 0.90]`（style-dna/silent-film.md:24、`engine/ink.js:6`）。sepia 只在 **0.10–0.36** 之间调，且**只由印片控制**：事情变糟时更冷更狠（损伤多、sepia 少），胶片变温柔时更暖更干净（STYLE.md:25）。
- **禁止出现的颜色**：任何饱和色相（除「唯一一种彩色」蒙版）；棕褐滤镜式的整体染色（除非作为整场 tint 的合法替代，一场一色：琥珀白天 / 夜蓝 / 玫瑰浪漫）；荧光色；纯黑纯白（黑场 0.055、白场 0.93，永远不到底）。
- **同一画面最多几个色相**：**0 个**（纯银盐）；启用「唯一一种彩色」时**最多 1 个**，且它标记全片唯一要紧的那件东西——或干脆不用（STYLE.md:27）。

---

## 4. 转场规则

- **镜头之间怎么切**：**直切（straight cut）为主**，加上三种「来自胶片/影院本身」的转场（STYLE.md:59）：① **虹膜（iris）**——在摄影机里做，所以会被一起印老（帧 f03 就是一圈虹膜，圆外全黑、边缘柔光）；② **淡入黑（fade to black）**；③ **幕布（curtain）**——开场分开、结尾合拢，合上时前景**重画幕布**并靠脚灯让闭合的天鹅绒仍可见（`demo/film.js:61,68`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有叠化**（同场景镜头之间禁用 dissolve）。有**定格 / 停格（stop-time）**：链式笑点里等一个道具回来，可以停 **2.5 s**（DEMO.md:37 记的是 2.5 s 等待；STYLE.md:37 说停格可停到 5 s）。没有闪白、没有现代擦除。
- **硬切点怎么定**：切点由 `timeline.js` 的**命名卡点（HIT）**定义，画面与配乐共用同一批卡点，`tools/cuecheck.py` 逐条比对 `timeline.json` 的 `HIT` 与 `music/score.json` 的 `keys`，输出 max offset——**这是本风格的验收硬指标**（style-dna/silent-film.md:366）。一张卡、一个虹膜、一次坠落，配乐必须落在同一帧上。
- **转场时长与缓动**：段与段之间是硬切（0 帧）；虹膜开合与幕布开合是有时长的手动动画，落在该段的拍上；只有**刻意的笑点**（双拍 double take）才允许 snap，其余全部走缓动关键帧（`shots.js:23-36` 的 `poseAt` / `numAt`）。
- **绝对不要的转场**：同场景叠化、现代甩镜（whip pan）、无动机的运镜、把 16 fps 采样当成「低帧率效果」（闪烁/抖动必须仍是 24 fps，否则只是卡，`style-dna/silent-film.json` 的 `shot_logic.forbidden`）。

---

## 5. 字幕样式

**本风格的字幕卡就是字幕**——`.srt` 里列的就是卡上的文字，供无障碍使用（STYLE.md:32、`demo/tools/subs.py:1`）。本次成片 `.srt` 共 **5 条**，实测时间（`styles/silent-film/silent-film.srt`）：

| # | 时间 | 文字 | 卡型 |
|---|---|---|---|
| 1 | 00:01.663 → 00:05.263（3.60 s） | THE RUNAWAY LOAF — a photoplay in one reel | TITLE（level 1） |
| 2 | 00:11.662 → 00:14.325（2.66 s） | The loaf had other plans. | CARD1（level 1，斜体叙述） |
| 3 | 00:26.142 → 00:28.492（2.35 s） | STOP THAT BAKER! | CARD2（level 0，喊叫 + shake） |
| 4 | 00:34.733 → 00:37.499（2.77 s） | “Is it yours, mister?” | CARD3（level 2，温柔） |
| 5 | 00:49.316 → 00:54.166（4.85 s） | The End + 版权/素材/字体署名 | END（level 2） |

| 项 | 值 |
|---|---|
| 字体 | 标题 / 喊叫：**Playfair Display SC**（weight 900）；叙述 / 对白：**Old Standard TT Italic**（`demo/cardspecs.js:3-6`，字体文件在 `demo/fonts/`，OFL） |
| 字号（相对 1920 画幅宽） | 标题 **112 px（5.83%）**；喊叫两行 **128 / 150 px（6.67% / 7.81%）**；叙述 **80 px（4.17%）**；对白 **76 px（3.96%）**；片尾主标 **104 px（5.42%）**，署名行 **24–34 px**。相对 1440 宽的片门则分别为 7.78% / 8.89–10.42% / 5.56% / 5.28%（`demo/cardspecs.js:3-14`） |
| 颜色 / 描边 / 阴影 | 文字 `#ece5d5`（暖白）印在 `#0e0d0b` 黑漆卡上，**无描边、无阴影**；卡面有极弱的纤维纹（`engine/cards.js:47-70`） |
| 位置 / 安全边距 | **整卡铺满片门**（1440×1080），文字居中；四周留 deco 边框宽度（约 3–6% 片门宽） |
| 单行字数上限 / 最多行数 | 每卡 **2–9 个词**；一行最多约 **14 个字符宽**，最多 **2 行**（标题卡与片尾卡例外，片尾卡 6 行）；`.srt` 最长一条 45 字符（标题行）（`style-dna/silent-film.json` 的 `sentence_patterns.length`） |
| 出现与消失方式 | **硬上硬下**（卡整张出现、整张消失），**没有淡入淡出**；喊叫卡的文字带 **shake 0.35** 抖动（`cardspecs.js:5`） |
| 停留时长 | 每卡 **2.5–3.75 s**，且 ≥ `max(1.8 s, 阅读时间 + 0.6 s)`（STYLE.md:32）；实测 2.35–4.85 s |

- **字幕与旁白的关系**：本风格**没有旁白**，卡就是唯一的文字通路。规则是「**卡从不解画面已经展示的东西**」，且**只在画面停住时上卡**，不与画面抢戏（STYLE.md:35、style-dna/silent-film.md:56）。
- **本风格特有的字幕禁忌**：长句、从句套从句；现代口语 / 网络梗 / emoji；第一人称旁白（默片是第三人称叙述者）；一张卡塞两个以上信息点；卡与画面同时抢戏。
- **dub 通路派生值（注意落差）**：`lib/dub-styles.json#silent-film` 给的字幕是 **SimSun（宋体）**、`fontSizeFactor 0.05185`（≈56 px @1080）、`align 5`（顶部居中）、`marginLFactor 0.07963`。这与本风格真实的 Playfair/Old Standard **完全不符**，是派生条目的已知落差，见第 11 节。

---

## 6. BGM / 音效特征

- **配乐**：**立式钢琴是唯一乐器**（VSCO 2 CE upright，CC0），温柔段可加**簧风琴**（FreePats accordion，CC0，`pp` 进入）。**乐器就是音效设计**（STYLE.md:63）。作曲法是 photoplay 的 **stride 左手**（拍上低音、弱拍中音和弦）+ **按情绪分段的 cue sheet**：Maestoso（标题）→ Andante「Loaf theme」（F 大调，主题骄傲地出现）→ 喜剧 uh-oh + accelerando → **Hurry**（A 小调、16 分音符跑动、**144 BPM**）→ stop-time 悬念 + Misterioso 走步 → Agitato 颤音 → ritardando（**88 BPM**）→ 静音 → Tenderly（主题放慢到 **72 BPM**）→ 终曲。**一个主题在开头骄傲、在结尾温柔**。**只用原创音乐**（DEMO.md:50、`demo/music/score.py:1-5`）。
- **拟音（foley）清单**：**没有拟音、没有人声**（刻意的）。**放映机就是环境声**：① **灯闸咔哒**（幕布拉开前一瞬）；② **马达升速**（PRE 段 18 fps 爬升）；③ **间歇爪 + 马达低鸣**（60 Hz 家族 + 带限风扇噪声，跟随速度）；④ **收片盘上甩动的胶片**（片尾跑片，频率从 **14 递减到 4**）（`demo/mix.py:15-45`）。
- **Mickey-mousing 词汇表**（用钢琴演事件）：低音区半音爬行（潜行）、装饰音（眨眼）、前臂音簇（撞击）、渐强的减和弦颤音（等待）、低沉的隆隆颤音（风暴/机器）、`plink … plonk`（空手）、减和弦 sforzando（双拍惊吓）、滚奏和弦（门/揭示）、下行滑音（坠落）、低音 `boing`（弹跳）、紧张颤音（犹豫，G4–Ab4 越弹越快）、小二度（面包掰断）（STYLE.md:63、`demo/music/score.py:74-169`）。
- **旁白处理**：**无旁白**。混音只有配乐 + 放映机两条。
- **响度目标**：`−14 LUFS`；**真峰值上限**：`−1.2 dBTP`（**项目级交付线**，判据见 `core/render/mux.sh`；本风格 `STYLE.md:67` 未额外声明更严上限）。本次实测 **−14.5 LUFS / LRA 6.5 LU**（`ebur128`，`_distill/logs/silent-film.log:79-82`）、**真峰值 −1.56 dBTP**（`loudnorm` `input_tp`，4× 过采样；`ebur128` `Peak` −1.6 dBFS 仅作参考），真峰值在交付线内。做法是**轻压缩驯服钢琴锤击瞬态**（年代录音从不这么尖）再归一（`mix.py:53-56`）。
- **静音策略**：**静音是真实存在的一段**（SIL，60 BPM × 2 拍）：音乐停、只剩放映机，它框住一个被托住的瞬间。谱面在静音段把**段增益拉到 −30 dB**（`score.py:142-143,176-184`），混音里放映机在 **PRE / SIL / 片尾跑片**时被推上来（`mix.py:46-50`）。DEMO 记录了两处静音：链式笑点里瓜出画时的 stop-time（只剩微弱颤音渐强），以及面包停下后**放映机独奏 2 秒**（DEMO.md:52）。

---

## 7. 素材偏好

- **需要什么素材**：① **灰值色调绘制**（不是彩色插画）——每一镜先在 4:3 上画一张只用灰值的图，密度按第 3 节的表；② **2.5D 骨架角色**（真实比例 7.5 / 5 头身）+ 5 种手型（relax / fist / open / grip / point）+ 缓动关键帧姿态表；③ **小镇布景件**：房屋立面（可倾斜基线）、鹅卵石街（越靠前石块越高）、路灯柱、天空、接地阴影（`demo/sets.js:8-188`）；④ **可滚动的圆形道具**（本片是圆面包——长条面包不能沿长度滚，`DEMO.md:73`）；⑤ 字体文件（`demo/fonts/`：Playfair Display / Playfair Display SC / Old Standard TT，OFL）；⑥ 钢琴与簧风琴采样（CC0）。
- **不需要什么素材**：**不需要任何写实影像**（除非刻意走 `redraw` 模式把真实视频推过 ink 通道）；不需要彩色素材（会被 Redraw 洗成灰）；不需要真人配音 / 旁白；不需要拟音库；不需要转场素材（转场全在引擎里画）。
- **取景 / 质感 / 比例偏好**：**广角、全景、锁定机位**；人物在画面里小；垂直竖构图不适合（片门是 4:3 横构图）；质感关键词是「**蚀刻插画 + 银盐印片**」，不是「照片滤镜」。
- **可替代方案**（缺素材时怎么降级而不破风格）：① 缺 2.5D 骨架 → 用**剪影 + 少量墨线**的简化人物（本风格本来就是靠剪影记号认人：一顶帽、一件衣、一件工具）；② 缺场景件 → 用**一块浅色立面 + 一条地平线**（正色片下天空近白，两面灰墙就够撑一镜）；③ 缺钢琴采样 → 用任何**单声部键盘音色**做旋律，但**不能加鼓、不能加合成器 pad**，否则立刻不是默片；④ 缺彩蛋道具 → 干脆不用「唯一一种彩色」。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 一个动作节拍一镜；定格 / 停格可停 **2.5 s**（可到 5 s）。链式笑点整条链在**一个锁定大全景里一镜到底，不切**（`shots.js:181`） |
| 全片时长 | **54.2159 s**（`demo/timeline.json` DUR，1301 帧 @24fps）；声明区间 **45–75 s**（单本 one-reel）（`style-dna/silent-film.json` 的 `narrative_rhythm.total_length_range`） |
| 镜头数 | 按 13 段组织：PRE / TITLE / BAKERY / CARD1 / CHASE / MARKET / CARD2 / ROLL / SIL / CARD3 / TENDER / IRIS / END（`demo/timeline.js:6-20`） |
| 信息投放节拍 | 段有自己的 tempo：**96 / 96 / 96 / 96 / 144 / 144 / 144 / 88 / 60 / 72 / 72 / 72 / 72 BPM**；每段 `beat = 60/bpm`、`dur = beat × beats`。**运动按 16 fps 采样**（追逐段降格到 **18 fps**、1.3× 速度），而**闪烁/抖动/颗粒/划痕每输出帧都变（24 fps）**——这个混合才让它像「被放映的」，而不只是低帧率（STYLE.md:39、`demo/film.js:34`） |
| 加速 / 减速点 | 加速：CARD1 的 accelerando 引子 → **CHASE 144 BPM**；减速：CARD2 之后 **ritardando 88** → **SIL 60** → **TENDER 72**。速度与损伤一起上升（降格混乱，`crank > 1` 让闪烁更快更强） |
| 留白与静音的位置 | 留白：MARKET 链式笑点里**瓜出画后的 2.5 s 空等**、f09 的纯空街锁定镜。静音：**SIL 段（60 BPM × 2 拍，音乐拉到 −30 dB，只剩放映机）**，它框住一个被托住的瞬间，之后第一个声音是簧风琴 `pp` 进入 |

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/silent-film/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/silent-film/demo --fps 24 --workers 2 --out styles/silent-film/demo/out/video24.mp4`（build.sh 第 6 步；本次批量出片走 `lemo-make.mjs` 时是 `--fps 24 --workers 6 --size 1920x1080`） |
| 帧率 | **输出 24 fps**（1301 帧）；**运动采样 16 fps**（追逐段 18 fps）——两套帧率并存是风格核心（`demo/timeline.js:3`、`demo/film.js:34`） |
| 分辨率 / 比例 | 原生 **1920×1080（16:9）**；内层片门 **1440×1080 居中（x=240）**，圆角 r=22；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`demo/film.js:20`），由 `stage.setFrame()`（`stage.js:25`）按视口尺寸重排：影院（黑场 + 两侧幕布）随帧铺满整帧（`demo/film.js:71`）、**4:3 片门按紧轴等比装入并居中**（`GATE.w = FW × S`，`stage.js:27-28`）、片门里的 1440×1080 印片按 `S` 缩放进片门（`demo/film.js:73`）；16:9 时 `FX=FY=S=1`、`GATE={240,0,1440,1080}`，每个表达式逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh <video> <mix.wav> <out> 24 1`（第 5 个参数 **24 = 帧率**，第 6 个 **1 = mux 颗粒**；颗粒主要已在画面里，mux 只补 1）（build.sh 第 7 步） |
| 编码器 | 混流走 **`h264_nvenc`**（本地 GPU，`_distill/logs/silent-film.log:74`）；最终胶片颗粒压缩用 **`libx264 -preset slow -crf 25 -tune grain`**（build.sh 第 8 步） |
| 音频入口 | `demo/music/score.py`（配乐 → `music/score.wav` + `score.json`）→ `demo/mix.py`（配乐 + 放映机 → `mix.wav`）；校验 `demo/tools/cuecheck.py`（画面卡点 ↔ 配乐卡点） |
| 字幕入口 | `demo/tools/subs.py`（字幕卡文字 → `out/srt.json`）+ `core/render/srt.py`（→ `.srt`）；卡就是字幕 |
| 事件导出 | `node core/render/events.mjs styles/silent-film/demo`（本次输出 `events 47 dur 54.2159`） |
| 时间线真值 | `node styles/silent-film/demo/tools/dump_timeline.mjs` → `timeline.json`（`{DUR, SEC, HIT}`），画面/配乐/混音/字幕卡全部从它派生 |
| 本风格专属参数 | 静音段增益 **−30 dB**（`score.py` 段增益）；mux 颗粒 **1**；最终编码必须带 **`-tune grain`**（重颗粒会让文件巨大：CRF 19 时 170 MB，`-tune grain -crf 25` 约 77 MB，`DEMO.md:82`）；本风格**没有 `--q noev=1` 之类的开关** |
| 一键复现 | `sh styles/silent-film/demo/build.sh`（9 步：timeline → score → cuecheck → mix → srt → 渲染 → 混流 → 颗粒压缩 → 静帧；约 2.5 分钟） |
| 本次实际命令 | `node lemo-make.mjs silent-film --skip-sync --no-preflight --ratio 16:9`（`_distill/logs/silent-film.log:1`） |

---

## 10. 编排规则

- **内容文件字段契约**（`timeline.js` 是唯一真值，`style-dna/silent-film.json` 的 `asset_contract.content_fields`）：
  - `FPS`（输出帧率 **24**）；`SECS` = `[name, bpm, beats, mood][]`（速度网格 / cue-sheet 分段）；`SEC`（由 SECS 算出 `{name,bpm,beats,beat,t0,t1,dur,mood}`）；`HIT`（命名卡点，画面与配乐共享）；`CARDS_AT` = `[section, key][]`（卡出现在哪一段）；`CARDS`（卡设计：`{level, lines[{text,font,weight,size,italic,caps,spacing}], gap, shake, dy}`）。
  - `timeline.json`（由 `dump_timeline.mjs` 导出，供 `score.py` / `mix.py` / `subs.py` / `cuecheck.py`）；`lines` / `srt.json` = `[{t0,t1,text}]`（字幕卡文字）。
- **事件词汇表**（`film.js` 的 `events()`，本次导出 **47 条**）：`section`（一段开始，给混音/配乐换段）、`hit`（命名卡点，画面与配乐共享，`cuecheck.py` 比对）、`card`（一张字幕卡上，写进 `.srt`）、`projector`（放映机：灯闸咔哒 / 马达升速 / 爪与马达低鸣 / 片尾甩片）（`demo/film.js:110-114`）。
- **时间线契约**：页面契约 `window.render(t)` / `window.DUR` / `window.READY` / `window.EV`，`?scene=file.fn` 可渲染单页测试（`demo/main.js:10-21`）。`timeline.js` 是唯一真值——**改时间只改一处**。
- **新增主体怎么接入**：新角色 = 一个真实比例 2.5D 骨架。必须提供：BODY 比例表（成人 7.5 / 儿童约 5 头身：neck / headUp / shoulderY / thigh / shin / upper / fore / hand + 躯干 rows 行表）、四肢 strip 宽度剖面、5 种手型、头部 spec（skin / jaw / chin / brow / lip / nose / hair / hat / beard / age / makeup）与 3D 头上的面部特征（眉/眼/鼻/嘴，正面 / 3q / 侧面 / 背面共用同一份数据）；姿态一律用**缓动关键帧表**（`poseAt` / `numAt`），**绝不用 `if` 分支**（`style-dna/silent-film.json` 的 `asset_contract.new_subject_contract`）。抬臂要**先外展（abduction）再屈曲（flexion）**，并让肩升起前摆、抬高侧躯干肩角收窄，否则变木偶手臂（`engine/figure.js:79,290-291`）。
- **换主题时要改哪些文件**：
  1. `demo/timeline.js` —— 重写 `SECS`（段名 / BPM / 拍数 / mood）、`HIT`（笑点卡点）、`CARDS_AT`；这是第一步，先写它再写别的（`DEMO.md:98`）。
  2. `demo/cardspecs.js` —— 重写 `CARDS` 五张卡的文字、字体、字号、`level`（0 喊叫 / 1 叙述 / 2 温柔）。
  3. `demo/shots.js` —— 每个 section 一个函数，重画该段的灰值色调帧与关键帧姿态。
  4. `demo/chars.js` / `poses.js` / `sets.js` —— 换角色、换关键姿态、换布景件。
  5. `demo/film.js` 的 `LOOK` —— 每段的 `crank / str / sepia / fps`（速度与损伤是情绪控制）。
  6. 重跑 `sh styles/silent-film/demo/build.sh`。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里能生效的参数是 `lib/dub-styles.json#silent-film` 给的 `palette`（`bg #0e0d0b` / `bg2 #050404` / `fg #ece5d5` / `accent #d97757`）、`bgRecipe`（`type: gradient`，`stops [#0e0d0b, #050404]`，`texture: none`（★ 2026-10-03 更正：原记 `film-grain`，与 `STYLE.md:25` 的「无扫描线、无 RGB 荫罩」硬规则冲突；当前配置已是 `none`），`vignette 0.35`）、`subtitle`（SimSun，5.185%，顶部居中）、`motion.chapterTransition: cut`；`overlay` 的章节卡 / 下三分之一 / 进度条**全部关闭**。**但注意**：本风格的文案**写死在 `demo/cardspecs.js` 的 `CARDS` 常量里**，dub 通路**没有 setter、没有 fetch、也没有 `lines.json`**（`dub-visual.json#silent-film.copyInjection.note`：「只能改文件或加注入钩子」）。也就是说，**走 dub 通路时文案注入不了，必须改源码**。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **骨架在跪姿 / 腿部会露出关节错位**：帧 f19（温柔段，主角跪地把面包掰两半）里，跪地那条腿的小腿与大腿在膝处**断开且明显过长**，读起来像两条分离的深色细棍；同一帧主角的支撑臂也偏细。这是 2.5D 骨架在大幅屈膝姿态下的投影问题。
- **中景面部仍偏人偶感**：帧 f21 里女孩的脸在片门内约占 1/6 画高时，五官已经能看出是「贴上去的」——眉、眼、嘴的墨线边缘生硬。STYLE.md:59 明确说「大特写用在骨架脸上像人偶」，本片已经守住了「不用大特写」，但中景仍是可读性上限。
- **「断续竖划痕」在抽帧里读成一条贯通直线**：帧 f03（虹膜镜）右半有一条**贯穿整个片门高度的 1 px 亮线**，与 STYLE.md:19 要求的「每条只活几帧、沿长度断开」不符，看起来像数字直线而不是刮伤的乳剂。
- **喊叫卡的装饰层级读不出来**：CARD2（帧 f13「STOP THAT / BAKER!」）在 `cardspecs.js:5` 里声明 `level: 0`（**一重粗线**），但抽帧上看到的是**细双线**边框，与 level 1（双线阶梯角）视觉区分很弱；喊叫卡的情绪只靠字号（128/150 px）和 shake 撑。
- **片尾卡不是年代卡**：END 卡（帧 f24）堆了 **6 行 24–104 px 的小字**（片名 / 风格名 / LEMO-OPUSCAR / LemoLab × Claude Opus 5.5 / 素材 CC0 / 字体 OFL），是**现代署名块**，不是 1920s 的字幕卡形态。
- **卡点分布不均**：5 张卡里有 3 张（CARD1 / CARD2 / CARD3）挤在 **11.7–37.5 s** 的中间 26 秒内，开头 11 s 与结尾 16 s 各只有 1 张卡，节奏上「中间密、两头空」。
- **9:16 曾不适配（★ 2026-10-04 已修）**：原记「无 `aspects` 声明，画面会被等比塞进左上角、右侧约 43.75% 丢失、两侧幕布全丢」。**2026-10-04** 已改造 `styles/silent-film/demo/`：`stage.js` 导出 `NATIVE`（`stage.js:15`）与 `setFrame(w,h)`（`stage.js:25`）派生 `W/H/FX/FY/S`，`film.js` 声明 `FILM_META.aspects = ['16:9','9:16']`（`demo/film.js:20`），`main.js` 按视口设 canvas 并调 `setFrame`（`main.js:9-10`）；影院随帧铺满、**4:3 片门按紧轴等比装入居中**（`stage.js:27-28`）、印片按 `S` 缩放进片门（`demo/film.js:73`）、损坏颗粒随 `S` 缩放（`engine/film.js:152`）。**16:9 逐字节未变**（`FX=FY=S=1` 时每个表达式退化成它替换掉的那个数字，15%/50%/85% 三帧 md5 与改造前完全一致）；9:16 实测不裁切、4:3 片门完整（见第 2 节）。★ 陷阱：`engine/ink.js` 已有一个 `setFrame(t, opts)`（每帧墨线状态），舞台的帧设置器在 `stage.js` 里叫 `setFrame(w,h)`、ink 那个在本地改名 `setInkFrame`——否则 `stage.js` 里两个同名绑定会静默互相覆盖。
- **sepia 冷暖推移几乎看不出**：STYLE.md:25 说「事情变糟时更冷更狠、温柔时更暖更干净」，但抽帧对比 f07（追逐）与 f19（温柔）几乎看不出可辨的暖冷差；sepia 只在 0.10–0.36 之间调，幅度太小。
- **`dub-styles` 的字幕字体是错的**：`lib/dub-styles.json#silent-film` 派生出来的字幕字体是 **SimSun（宋体）**、字号 5.185%、顶部居中，与真实字幕卡的 **Playfair Display SC / Old Standard TT Italic + 满卡居中**完全不是一回事。这条派生值本身在 `notes` 里也自认是「从分类别默认推得、应优先用代码抽取值替换」。

### 素材缺口
- **没有 `lines.json`**：本风格的文案**写死在 `demo/cardspecs.js` 的 `CARDS` 常量**里（`dub-visual.json#silent-film.copyContract.note`：「无 lines.json；条数为源码内可数项」）。因此「文案 + 风格」通路**注入不了文案**，只能改源码。
- **`lib/dub-visual.json#silent-film` 的 `visualRef` 在本次读取时为 undefined**（按 `styles` 键取 `silent-film` 是能取到的，走 `visualRef` 路径的消费者需要按 `styles['silent-film']` 兜底）。
- **`demo/assets/redraw_src.jpg` 不在仓库、也不在本机盘上（2026-10-06 核实）**：它只被 redraw 测试用（`?scene=frames.redrawSample`）。★ `frames.js:119` 与 `sheets.js:28` 都只挂 `onload`、**没有 `onerror`** ⇒ 404 时那个 Promise **永不 resolve，页面直接挂死**（不报错、不退出，比抛异常更难查）。它是 CC0 视频 `DiagonalCrosswalkYongeDundas.webm`（Raysonho，Wikimedia Commons）的**一帧裁切**：**原理上可由该 CC0 源重生**，但**确切裁切位置从未记录** ⇒ 无法逐字节复现。CREDITS 原来只写了作者 / 平台 / 授权、**没有 URL**——现已补 `https://commons.wikimedia.org/wiki/File:DiagonalCrosswalkYongeDundas.webm`，并注明「本仓库不含该文件」。本次**未下载、未新增任何素材**。
- **字体：`fonts/` 里的 `.ttf` 不入库，但现已可由仓内脚本重生（2026-10-06 更正）**：本 demo 用 Playfair Display / Playfair Display SC Black+Bold / Old Standard TT Regular+Italic+Bold（均 OFL；`fonts/` 下的 OFL 许可原文与 `fonts.css` **已入库**）。★ 但 `.ttf` 本身被 `.gitignore`（`styles/*/demo/fonts/**/*.ttf`）挡住 ⇒ **新克隆里一个都没有**（clone 后实测 `demo/fonts/*.ttf` = 0）。原记「字体文件齐全…**无缺口**」只说对了「不需要外部素材」，**漏了「不入库」这一半**。现已把字体获取脚本纳入仓库 `tools/fetch-fonts.sh`，跑 `bash tools/fetch-fonts.sh --only silent-film` 即可补齐；实测重生出的 `.ttf` 与工作区**逐字节一致**（md5 相同）⇒ 归为「可由仓内脚本重生」，不再是缺口。★ 注意它**依赖网络**（从 google/fonts 取源文件，jsDelivr → raw.githubusercontent → gitmirror 三镜像轮询）。

### 能力限制
- **已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`demo/film.js:20`）；产品默认 1080×1920 下 4:3 片门按紧轴等比装入、居中，落在「等比装入 + 同色留白」这一档——不裁切、不变形，片门与幕布完整（见第 2 节）。
- 2.5D 骨架的表达上限是「大全景里用身体演戏」：**不适合**近景情绪戏、不适合面部特写、不适合多人复杂交互。
- **不适合信息密度高的题材**：一镜一个动作节拍、一卡 2–9 个词，硬塞多步骤内容会直接毁掉可读性（DEMO 记录首版八步市集链整段砍掉）。
- 运动 16 fps + 损伤 24 fps 的两套帧率是**硬规则**：任何「统一成 24 fps 更顺滑」的优化都会让风格立刻失效。

### 踩过的坑（本机实测）
- **首跑导出步骤失败、重跑即通过（瞬时故障）**：2026-10-03 首次批量出片时，第 3 步导出里 `styles/silent-film/demo/tools/dump_timeline.mjs` 报**退出码 1**（`_distill/logs/silent-film.log:27`），而同一步的 `events.mjs` 本身**成功**输出 `events 47 dur 54.2159`（log:26）。同一命令手工重跑即通过，判定为**瞬时故障**，非代码缺陷。**应对：遇到这一条直接重跑，不要去改 `dump_timeline.mjs`。**
- **本次没有走 TTS、没有走 `--skip-sync` 的音频链**：日志第 [4] 步「音频链路」为空——因为**该 demo 无 `lines.json`，跳过配音**（log:39），配乐与混音由 demo 自己的 `score.py` + `mix.py` 现场生成（`score.wav 54.22 s, events 661 peak 0.843`；`mix.wav 54.22 s peak 0.751`）。命令行确实带了 `--skip-sync`，但**没有使用任何预生成配音**。成片真峰值 = `loudnorm` `input_tp`（4× 过采样）**−1.56 dBTP**，在 −1.2 dBTP 交付线内（余量 0.36 dB）、未削波。
- **本次成片实际跑通了**：渲染 `1301 frames` / 43 s / 6 workers → `video_gpu.mp4 103.8 MB`；混流走 **nvenc**，`MUX_OK 65259378 src_frames=1301 out_frames=1301`，最终 **62.2 MB / 总耗时 89.5 s**（log:69-90）。**告警只有上面那一条**。
- 只被暗银幕照亮的闭合幕布会变成**纯黑**（blackdetect），必须加脚灯（STYLE.md:90、`DEMO.md:81`）——帧 f01（PRE 段）整幅几乎全黑就是这个陷阱的边界，靠脚灯才让幕布边缘勉强可见。
- **重颗粒会让文件巨大**：CRF 19 时 170 MB；必须 `-tune grain -crf 25` 才回到约 77 MB（`DEMO.md:82`）。

### 下次迭代优先补什么
1. **修骨架的屈膝/跪姿投影**（`engine/figure.js` 的 `solve` 与 `runPose`/`walkPose` 之外补一个 `kneelPose`），这是抽帧上最显眼的一处破绽。
2. **把竖划痕改成真正的「断续、每条只活几帧」**（`engine/film.js:46-58`），消除 f03 那种贯通全高的 1 px 直线。
3. **加强 level 0 与 level 1 的边框区分**（`engine/cards.js:8-44`）：喊叫卡应该是一重**粗**线，现在读成细双线。
4. **把 END 卡瘦身**成年代卡（主标 + 一行署名），把素材/字体署名移到片外或压到最小。
5. **拉开 sepia 幅度**（0.10–0.36 太窄），让「温柔段更暖」在抽帧上真的看得见。
6. **给 dub 通路补一个文案注入钩子**（或在 `dub-visual.json` 里把 `silent-film` 标为「inline-code，需改源码」），并修正派生字幕字体。
7. **（已完成 2026-10-04）** 9:16 适配：已给 `film.js` 补 `FILM_META.aspects = ['16:9','9:16']`（`demo/film.js:20`），并由 `stage.setFrame()` 按视口尺寸重排舞台（影院铺满整帧、**4:3 片门按紧轴等比装入居中**，`stage.js:25-28`）。★ 声明落在影片模块 `film.js` 的 `FILM_META`，**不是 `style.json`**——探测方 `lib/aspects.mjs` 读的就是 `film.js` 源码文本。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/silent-film/silent-film.mp4`（54.2159 s / 62.2 MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/silent-film/`（24 帧 + 接触印样，等间隔约 2.26 s） |
| 风格匹配度自评 | **90/100** |
| 详细资料 | 有 —— `styles/silent-film/STYLE.md`（11 节全文）· `DEMO.md`（含 Engine reference 与 Pitfalls）· `demo/build.sh`（9 步）· `demo/cardspecs.js` · `demo/timeline.json` · `styles/silent-film/silent-film.srt` · `style.json` · `lib/style-dna/silent-film.md`（366 行，含 200+ 条 `file:line` 证据）· `lib/style-dna/silent-film.json`（15 字段）· `lib/dub-styles.json#silent-film` · `lib/dub-visual.json#silent-film` · `_distill/logs/silent-film.log` |

**逐帧拆解要点**：接触印样（`_contact.jpg`）一眼看全 24 帧的节奏与色走——**全片纯银盐灰阶，没有任何色相推移**，唯一的变化是明暗与损伤密度。① **f01** 是 PRE 段：整幅近全黑，只有两侧天鹅绒幕布的极弱边缘与片门轮廓（脚灯在起作用），画面中央有一处微弱的放映机光点；② **f02** 切到 TITLE 卡：黑漆卡 + **双线阶梯角 + 上下角扇**的 deco 边框，Playfair Display SC 大字「THE RUNAWAY LOAF」+ 斜体小字「a photoplay in one reel」，文字居中、**硬上硬下无淡入**；③ **f03** 是虹膜镜：一圈**圆外全黑、边缘柔光**的虹膜，里面是面包店学徒举着圆面包，白墙几乎印成白；**同一帧右半有一条贯通片门全高的 1 px 亮线**（见第 11 节缺陷）；④ **f04/f05** 是「BAKERY」卡 + 面包店锁定全景：学徒戴白色百褶帽、深马甲、长白围裙，街面是**越靠前越高的鹅卵石带**，建筑立面用 45° 排线做暗部；⑤ **f06** 是 CARD1「The loaf had other plans.」（斜体叙述卡）；⑥ **f07–f12** 是 CHASE 与 MARKET：**带前景掠过的跟拍**（路灯柱以 1.35 视差扫过前景，速度可见），随后切到**锁定大全景**——手推车、瓜、警察在同一条街上，人物很小、留白很大；⑦ **f09** 是一帧**纯空街**（一个人也没有），这是「等待就是笑点」的留白镜；⑧ **f13** 是 CARD2 喊叫卡「STOP THAT / BAKER!」，字号明显大于其他卡（128/150 px）、文字带抖；⑨ **f14–f18** 回场景，f17 是 CARD3 温柔卡「Is it yours, mister?」——边框换成了**藤蔓与小花**，字体换成 Old Standard TT Italic；⑩ **f19/f21** 是 TENDER 段：**有动机的慢推**（机位降到孩子的高度），主角跪地掰面包、两半面包弹在空中，暗部（门板、阴影）能看到明显的**交叉排线**，这是全片 sepia 最暖、损伤最轻的一段；⑪ **f24** 是 END 卡，幕布合拢。**转场全部是硬切**，唯一的两处「软」转场是虹膜（f03 开、片尾合）与幕布（开场分、结尾合）；**字幕卡出现的时间点是 1.7 / 11.7 / 26.1 / 34.7 / 49.3 s，每次整卡出现、整卡消失，停在画面停住的时候**。**瑕疵帧**：f03 的贯通竖线、f19 的跪姿腿部错位、f21 的女孩面部生硬。

**自检发现的缺陷**：见第 11 节「已知缺陷」8 条。扣分对应：`palette` −1（sepia 冷暖推移在抽帧上不可辨）、`composition` −3（跪姿腿部关节错位、f03 贯通竖线、中景面部人偶感）、`typography` −3（喊叫卡边框层级读不出、END 卡是现代署名块、dub 派生字幕字体 SimSun 不符）、`rhythm` −2（5 张卡有 3 张挤在中间 26 秒、卡点分布不均）、`audio` −1（实测 −14.5 LUFS 比 −14 目标低 0.5 LU、LRA 6.5 LU 偏大）。合计 **90/100**。

**本次为补齐短板做了什么**：**没有改动 `D:/lemo-opuscar` 下的任何源码**（红线）。本次只做「读资料 + 逐帧拆解 + 写文档」，全部缺陷**如实记录**在第 11 节，修复方案列为「下次迭代优先补什么」的第 1–6 条，留给后续实现。
