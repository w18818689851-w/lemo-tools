---
name: lemo-style-microgame
description: 【lemo 风格 Skill · 微游戏快闪】当你需要一部「一个命令词 + 几秒钟 + 一个动作 + 一个结果」的派对游戏快闪片、并且想让每一关换一套完全不同的画风、全片持续加速时，就用这个风格。选定本风格做视频时，优先读本文件。
slug: microgame
name_zh: 微游戏快闪
category: 游戏
film: Five-Second Astronaut
---

# 微游戏快闪（`microgame`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/microgame/STYLE.md` · `styles/microgame/DEMO.md` · `styles/microgame/demo/build.sh` ·
> `lib/style-dna/microgame.json` · `lib/style-dna/microgame.md` · `lib/dub-styles.json#microgame` ·
> `styles/microgame/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部**快节奏派对游戏片**。基本单元是 **microgame = 一个喊出来的命令词 + 2.5–4 秒 + 一个动作 + 一个结果**（成功，或一次好笑的失败）（`STYLE.md:10`）。**每一个 microgame 用完全不同的美术媒介来画**——蜡笔、水墨、终端、丝网印（riso）、像素、蓝图、瑞士排版、黏土、剪纸、木刻——每次画风切换的冲击**既是笑点也是节拍**（`STYLE.md:11`）。一条固定的「家」画风把全片串起来：一个**演播厅舞台 + 主持人 + 生命板 + 关卡号**，游戏之间不断切回它（`STYLE.md:12`）。全片**持续加速**：每隔几关，速度、游戏长度、舞台停留、命令词停留、角色帧率**一起跳一档**（`STYLE.md:13`）。

**不是什么**（最容易做错的邻居风格）：不是 **Game Show Flat**（那是单一画风 + 一轮轮条形图 + call-and-response）；不是**风格样片合集**（本风格每个游戏都有赌注，生命把它们连起来）；不是**蒙太奇**（每个游戏都有一条一秒内能被抓住的规则）（`STYLE.md:16`）。

**什么时候用它**：适合讲「一串并列的小任务 + 一个总目标」的内容——做面包的每一步、护士的一天、一次产品发布的各个环节、一次考试、一场演出。命令词机制让它天然适配**动作为主、台词极短**的题材。

**一句话内核**：**一关换一个画风，一个动词就是剧本、字幕和重拍**（`DEMO.md:19`）。

**边界**：这个格式**只适合 45–60s**，更长就失去 frenzy（`STYLE.md:6`）。它**撑不起**需要连续论证、长句解说、细腻情感递进或真实人物访谈的内容；也撑不起「只有一个统一画风」的需求——那会退化成 Game Show Flat。

---

## 2. 画面构图

- **镜头数与画幅**：原生画幅 **1920×1080（16:9）**，`--ratio 16:9` 渲染（`_distill/logs/microgame.log:1-2`）。★ **2026-10-04 起已声明多比例**：`demo/film.js` 的 `FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`（控制台按源码文本探测），实现走**页面外壳等比装入**（见下）。段落表由 `timeline.js` 的 `SEGS` 驱动（`timeline.js:15-41`）。
- **主体位置与占比**：**游戏屏幕是画面的固定比例，约宽度的 40%**（`STYLE.md:70`）。demo 的电视屏幕是 **768×432，正好是画面的 1/2.5**（`DEMO.md:63`）。游戏内的主角居中偏左或偏右，留出动作空间。
- **负空间 / 留白**：家舞台是**正面、对称**的构图——电视居中，左侧主持人、右侧讲台与生命板，几乎不留白（帧 f03/f06/f08/f13/f16/f22/f23）；游戏内则大量留白，让动作可读（帧 f01/f04/f15/f21）。
- **图层叠放顺序**（从底到顶）：家舞台底（旋转放射 sunburst）→ 舞台家具（招牌 marquee、电视框、讲台、生命板、关卡牌）→ 电视屏幕内容（游戏媒介，可离屏渲染后贴入）→ 命令词横幅 / 角落标签 → 引线计时器与火花 → 字幕卡片 → ✓/✗ 印章。
- **安全区**（字幕 / 主体 / 边缘）：命令词**砸在画面上部或中央**，在第一个动作前**缩成角落标签**（帧 f04 → f05 可见：`DON'T SNEEZE!` 从中央大横幅缩到左上角小标签）；字幕卡片固定在**引线之上**，从不压在大横幅下（`STYLE.md:39`）。
- **本风格**不能**出现的构图**：**空帧**（`STYLE.md:48` 明令禁止）；让命令词盖住结果的构图；在混媒帧里出现**两条以上焦点链**（`STYLE.md:70` 要求只有一条 A→B→C）。

**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。改造**没有**逐处改写绘制点——8 个 `g_*.js` 分镜、家舞台、老虎机、Boss 拼贴、片尾卡全是 1920×1080 的绝对坐标（逐处改必然**静默**错位），而是只改**一个页面外壳文件** `demo/index.html`：影片本体仍按**固定设计帧 1920×1080** 画（一字未改），当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧等比装入**（contain）并居中，留边露出本风格底色 **家舞台深紫 `#2a0f5c`（`P.deep`，与片尾卡 / 舞台底同色，读成「电视外仍是演播厅」）**。声明落在 `demo/film.js` 的 `FILM_META.aspects`。**支持的档位**：`16:9 / 9:16 / 3:4 / 4:3 / 1:1`（5 个比例实测构图正确）。

- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform、底色清空回 CSS 的 `#000`）；同会话往返（1920×1080 → 1080×1920 → 1920×1080）实测 **md5 逐字节相同**（3/3 帧）。
- **9:16 是装入不是裁切**：整幅画面（命令词横幅、TV 框、生命板、讲台、引线火花、✓/✗ 印章、字幕卡）**全部在画面内**。实测：改后 9:16 vs 16:9 **中心裁切** SSIM **0.335 / 0.569 / 0.752**（远 < 1），vs **理想等比装入** SSIM **0.978 / 0.997 / 0.997**（近 1）；参考图 pad 色取本风格留边色 `#2a0f5c`（同一帧换黑 pad 只剩 **0.539**，证明留边色必须与实现一致）。
- **已知代价（如实说）**：① 竖屏下有效画面只占 **1080×607**（`k = 1080/1920 = 0.5625`），**分辨率按紧轴缩放**——命令词横幅与卡片小字在 9:16 下缩到约 56%，需在手机全屏下确认可读；② **全屏层（100% 白闪、放射速度线、电视推入 / 缩回、撒花）留在设计框内**，上下留边是**纯色 `#2a0f5c` 无纹理**（留边与家舞台底同色，肉眼无接缝；但严格说全屏层不铺满整帧）；③ 其它比例同理（3:4 / 4:3 / 1:1 已实测）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 家舞台底（旋转放射） | `#2a0f5c` / `#3d168f` | 舞台紫底与放射背景 | `DEMO.md:63` |
| 家舞台强调 | `#ff2e88`（品红） | 命令词投影、卡片边、讲台 | `DEMO.md:63` |
| 家舞台强调 | `#ffc928` / `#e08a00`（金） | 电视框、招牌灯泡、卡片 | `DEMO.md:63` |
| 家舞台强调 | `#1fd1d1`（青） | 舞台点缀 | `DEMO.md:63` |
| 描边 | `#1a1030`（近黑，7px） | 家舞台所有轮廓 | `DEMO.md:63` |
| 成功色 | `#3bdc5a` | ✓ 印章、生命板 | `DEMO.md:63` |
| 失败色 | `#ff3b3b` | ✗ 印章、失命 | `DEMO.md:63` |
| 瑞士信号红 | `#e30613` | 瑞士媒介唯一的强调色 | `DEMO.md:79` |

- **明度 / 对比规则**：家舞台是**高饱和、高对比**的派对色；每种媒介**自带自己的色板**（蜡色、单墨加朱红、琥珀磷光、三张 riso 版、受限像素色、蓝底白线、黑白红）。**绝不用家舞台色板去染一种媒介**（`STYLE.md:32`）。
- **禁止出现的颜色**：把家舞台的紫/品红/金用到游戏媒介里；**100% 纯白闪**（读成空帧，封顶约 60%，`STYLE.md:101`）。
- **同一画面最多几个色相**：家舞台是「一个深底 + 2–3 个响亮强调色」；每种媒介内部按传统限制（瑞士只有黑白 + 信号红，`DEMO.md:79`；riso 只有三张版）。
- **跨媒介强调色**：一个强调色**跟着主角走**（水墨里一颗朱红点、终端里一个反色 `@`、瑞士里一个信号红圆）——它是切换之后眼睛找到主角的方式（`STYLE.md:33`；帧 f05 的朱红 05 印、f07 的反色 `@`、f15 的红圆）。

---

## 4. 转场规则

- **镜头之间怎么切**：**统一转场 = 电视框**。舞台 → 游戏是**推入电视屏幕**（约 **0.25s**）；游戏 → 舞台是**整个画面缩回电视**（约 **0.33s**），并把 **✓ / ✗ 印章拍在屏幕上**（`STYLE.md:48`、`DEMO.md:48`）。硬切也大量使用，切点落在拍点（120/140/160 BPM 网格）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有叠化、没有淡入淡出、没有空帧**（`STYLE.md:48`）。有**定格**——即时回放会冻结 3 帧再半速播放（`DEMO.md:50`）。
- **硬切点怎么定**：跟**速度网格**走。`timeline.js` 是全片唯一真值，每段有 `{id, beats, bpm, kind, style?, cmd?, ok?, dark?}`（`style-dna/microgame.md:180`）。
- **转场时长与缓动**：推入 0.25s、缩回 0.33s；命令词砸入约 **3 帧**（`1.9 → 0.92 → 1.0`，过冲后落定）（`DEMO.md:46`）。
- **绝对不要的转场**：淡入淡出；**空帧**；溶解/叠化等 UI 式转场；把命令词**烧两遍**（它只出现在 `.srt` 里）（`STYLE.md:41,48`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **命令词**用重体展示字（如 Titan One）；**其他台词**用圆体（如 Lilita One ~50px） |
| 字号（相对画面宽 / 高） | 命令词为**大横幅级**（占画面宽度的一半以上）；卡片 50px（1920 宽下 ≈ **2.6%**） |
| 颜色 / 描边 / 阴影 | 命令词 = **白字 + 22px 墨描边 + 品红投影 + 背后金色爆点**，斜 **−6°**；卡片 = 金色圆角卡 + 7px 墨描边 + 硬边阴影 |
| 位置 / 安全边距 | 命令词砸在画面中央/上部，**第一个动作前缩成角落标签**；卡片在**引线之上** |
| 单行字数上限 / 最多行数 | 命令词 **2–14 字符**（`PUMP!` / `DON'T SNEEZE!` / `ZIP!` / `SALUTE!` / `LAND IT!`）；单行 |
| 出现与消失方式 | 命令词 **3 帧砸入**（过冲 → 落定）→ 停留 → **缩小成角落标签**；卡片 2 步弹出（12 fps）；一次性横幅（`BOSS STAGE!` / `PULL!`）**飞出去**而不是变成标签 |

- **字幕与旁白的关系**：**命令词就是字幕**——它同时是剧本、字幕和重拍，**不烧两遍**，只出现在 `.srt` 里（`STYLE.md:41`）。主持人的其他台词用圆角卡片 + 小图标（主持人用秒表图标、主角用头盔图标）。停留 ≥ `max(1.8s, 语音 + 0.6s)`，**绝不出现在大横幅之下**。
- **本风格特有的字幕禁忌**：命令标签**堆积**（`LAND IT!` + `PULL!` 挤在同一角）——次要命令必须飞出去（`STYLE.md:100`）；游戏**内部**的任何文字（回放说明、标签）必须用**该媒介自己的字体**，不许用家舞台字体（`STYLE.md:40`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「a rounded card in the home palette with the home outline and hard shadow」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#4C000000`（AARRGGBB，落盘 ASS 为 `&H4C000000`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。**底衬色为回退值**：demo 侧底衬（demo band P.gold #ffc928）与该风格配置的 `palette.subtitle` 字色 #FFFFFF 对比度不足（<3.0），故改用该风格自身的地色/辅色（palette.subtitleBack #B3000000）；字色 #FFFFFF 与该底衬的 WCAG 对比度 **19.25**。

---

## 6. BGM / 音效特征

- **配乐**：**音乐优先**——先写速度网格与 cue 表，再动画；每一次画面 hit 都落在一张列好的 cue 上（`STYLE.md:74`）。demo 是原创 **funk/pop fusion**：带 16 分 hi-hat 与 ghost note 的鼓组、**合成 slap bass**、堆叠铜管 stab（trumpet_stac + alto sax + trombone_stac）、vibraphone + piano 的「e-piano」。鼓与贝斯**贯穿全片**；上面每关加**一个颜色乐器**：xylophone（蜡笔）、guqin 泛音与滑音（水墨）、square beeps（ASCII）、vibes + sax（riso）、pulse arpeggio（像素）、muted trumpet（蓝图）、claves + 干钢琴（瑞士）（`DEMO.md:55`）。速度阶梯 **120 → 140 → 160 BPM**，每轮升一个全音。
- **拟音（foley）清单**：**跟着媒介走**——蜡笔橡皮吱 + 空气；水墨湿 splat + 滴；ASCII 电传打字 + 继电器；riso 纸闷响 + crunch；像素 bit-crushed 噪；蓝图棘轮齿 + 印章闷响；瑞士空心 bonk + 小橡皮 boing。家舞台：弹簧皇冠 click、碎玻璃（失一条命）+ 弹跳叮、翻牌、老虎机 whirr、稀疏掌声（`DEMO.md:57`）。
- **旁白处理**：主持人 = Kokoro `am_fenrir`，speed **1.05–1.15**，**每个命令词喊在铜管 stab 之后 0.1s**，免得铜管盖住词；主角 = `af_bella` 升 **+2.5 半音**，只有「Oh no.」加「ah… ah…」与喷嚏（后两者当 SFX 处理，豁免 whisper 校验）（`DEMO.md:58`）。音乐在语音下 duck **约 11 dB**、foley duck **约 6 dB**（`STYLE.md:79`）。
- **响度目标**：`-14 LUFS`；**交付真峰值上限**：`-1.2 dBTP`（项目级交付线；`STYLE.md` 只写 −14 LUFS，未额外声明更严上限）。本次实测 **I −14.1 LUFS / LRA 3.5 LU（`ebur128`）/ 真峰值 −0.86 dBTP（`loudnorm` `input_tp`，4× 过采样）—— 真峰值超交付线 0.34 dB，但真峰值为负、未削波**（`logs/microgame.log:129-130` 只印了 I 与 LRA）；混音文件 `mix.wav` 峰值 **0.89**（`logs/microgame.log:118`）。混流走自带副本 `styles/microgame/demo/tools/mux.sh`（`TP=-1.2`，**无 AAC 编码余量**）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 −0.86 dBTP → **−2.18 dBTP**、已在 −1.2 dBTP 交付线内（达标）；原 −0.86 dBTP 记录保留为历史。
- **静默策略**：至少一次在**最大的 hit 之前留真实静默**——demo 里第一次喷嚏前 1 拍、只剩一条命的舞台（只剩心跳）、Boss 特写（心跳 + 与第一粒尘埃同一根 guqin 音）。**最响的时刻紧跟最长的静默之后**（`DEMO.md:56`）。加速选项：每次 SPEED UP 前一段上行铜管、每轮升一个调、改用减半音符而非改速度、最后一条命把 groove 降成心跳（`STYLE.md:77`）。

---

## 7. 素材偏好

- **需要什么素材**：**几乎不需要外部素材**——家舞台、角色、八种媒介、配乐、拟音全部程序化生成（Canvas2D + WebGL2 材质 shader + 合成音频）。要人写的是：台词表 `lines.json`（`{id, t, who, cmd?, fx?, text, voice, speed, trim?}`）、速度网格 `timeline.js`、cue 表、每个媒介的 `sceneX(g, lt)` 模块、以及**一张覆盖所有媒介的主角模型表**（`STYLE.md:26`）。
- **不需要什么素材**：不需要实拍照片/视频、不需要外部贴图（蜡笔纸纹、riso 半调、CRT 扫描线都是程序化生成的）。
- **取景 / 质感 / 比例偏好**：家舞台**正面锁定机位**；游戏内用该媒介自己的景别语言（像素用 240×135 索引缓冲 ×8，终端用手写 glyph，蓝图用线宽系统）。
- **可替代方案**（缺素材时怎么降级而不破风格）：若做不出全部八种媒介，**宁可减到 4–5 种也要保证每次切换差异足够大**（切到两种相似的媒介就没有冲击了）；若没有 WebGL2 材质 shader，蜡笔/水墨/riso 可用 Canvas2D 的 channel 缓冲近似，但**必须保留「一个 channel trick 就能读懂」这条**（`STYLE.md:22`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 第 1 轮游戏 **8 拍 = 4.0s**（120 BPM）；第 2 轮 **6 拍 = 2.57s**（140 BPM）；Boss **32 拍**（160 BPM）（`style-dna/microgame.md:80-83`） |
| 全片时长 | **59.83s**（实测；`style.json dur=59.8`、`logs/microgame.log:26`） |
| 镜头数 | 由 `SEGS` 段落表决定；demo 事件 **171** 条（`logs/microgame.log:26`） |
| 信息投放节拍 | 舞台停留 1 小节（8 拍）→ 4 拍 → 2 拍；命令词停留 0.75s → 0.64s；角色步进 8fps → 12fps → 24fps（Boss） |

- **加速 / 减速点**：**五件事一起跳**——tempo、游戏长度、舞台停留、命令词停留、角色帧率（`STYLE.md:46`）。demo 的加速点在 SPEED UP 段（老虎机滚轮，帧 f11）；减速点只在**静默**处（第一次喷嚏前、只剩一条命、Boss 特写）。
- **留白与静音的位置**：**相机 / 转场 / 引线火花永远 on ones**（`STYLE.md:45`），只有角色会掉帧——**帧率本身就是加速阶梯的一部分**（`STYLE.md:45`）。静默位置见第 6 节。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/microgame/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/microgame/demo --fps 24 --workers 6 --size 1920x1080 --out styles/microgame/demo/out/video_gpu.mp4` |
| 帧率 | **24 fps**（相机/转场/火花 on ones；角色按 8/12/24 fps 步进；本次 1436 帧，`logs/microgame.log:105`） |
| 分辨率 / 比例 | **1920×1080（16:9）**；★ 2026-10-04 已支持多比例 **`16:9 / 9:16 / 3:4 / 4:3 / 1:1`**（页面外壳等比装入，留边 `#2a0f5c`；见第 2 节） |
| 混流 | `sh styles/microgame/demo/tools/mux.sh …`（**−14 LUFS / grain 0 / CRF 20**，`logs/microgame.log:8`） |
| 编码器 | `h264_nvenc`（本地 GPU） |
| 音频入口 | TTS → `tools/trim_cmd.py` → whisper → `music/score.py` → `events.mjs` → `tools/cuecheck.py` → `mix.py` |
| 字幕入口 | `tools/subs.py` + `core/render/srt.py`（本次 **17 cues**，`logs/microgame.log:31,125`） |
| 事件导出 | `node core/render/events.mjs styles/microgame/demo`（本次 events **171**、dur **59.8268**，`logs/microgame.log:26`） |
| 本风格专属参数 | 混流 `CRF 20` + `grain 0`；`--ratio 16:9`；`tools/dump_timeline.mjs` 导出 `timeline.json` |
| 一键复现 | `sh styles/microgame/demo/build.sh` |

本次出片实测：渲染 1436 帧耗时 **28s**、音频链 46.2s、混流总耗时 **70.4s**，成片 **49.4 MB**（`logs/microgame.log:105-139`）。`cuecheck.py` 核对 **57** 个画面事件与 `music/score.json`，demo 最大偏移 **4.7 ms**（`DEMO.md:54`）。

---

## 10. 编排规则

- **内容文件字段契约**：台词表 `lines.json`（`{id, t, who, cmd?, fx?, text, voice, speed, trim?}`，demo 共 **21 条**）；时长表 `dur.json`；速度网格 `timeline.js`（每段 `{id, beats, bpm, kind, style?, cmd?, ok?, dark?}`）；每个媒介的场景模块；家舞台/角色/HUD 参数；一张 cue 表（`style-dna/microgame.md:180`）。
- **事件词汇表**：`voice` / `fuse_on` / `cmd_slam` / `tv_in` / `tv_out` / `crown` / `crack` / `lights_off` / `stamp_ok` / `stamp_bad` / `button` / `insert_whoosh` / `bulb` / `reels_spin` / `reel_stop` / `zoom_whoosh` / `tile_flip`，外加每游戏拟音（`pump` `sneeze` `ink_splat` `typing` `ratchet` `beep2` `zip` `bonk` `replay_in` `sneeze_big` `ink_boom` `canopy_open` `clear` `confetti` `applause` `salute` 等）（`style-dna/microgame.md:190-203`）。
- **时间线契约**：`timeline.js` 是全片**唯一真值**（速度网格 + 段落表），必须导出 `SEGS`、`DUR`、`S`（id→段）、`find(t)`、`bt(id, k)`。页面契约由 `main.js` 暴露 `window.render(t)` / `window.DUR` / `window.EV` / `window.SUBS` / `window.SRT` / `window.READY`（`style-dna/microgame.md:188`）。
- **新增主体怎么接入**：新的媒介模块必须导出 `sceneX(g, lt)`（`lt` = 段内本地时间），内部把主角**用该媒介从头重画**、但保留**三个剪影标记**（圆头盔、天线球、「05」）；离屏绘制时必须先 `setCtx(ctx)`（`style-dna/microgame.md:184`）。
- **换主题时要改哪些文件**：改 `lines.json`（命令词与台词）、`timeline.js`（速度网格与段落）、以及每个媒介的 `sceneX` 模块；**家画风四件（`toon.js` / `chars.js` / `stage.js` / `hud.js`）与 `music/score.py` 通常不动**——因为配乐读的是 cue 表，只要重写速度网格与各媒介 `sceneX`，画面与音乐仍然同步（`style-dna/microgame.md:224`）。配方：**列出 6–8 个动词 → 每个动词配一个最自然的媒介 → 让其中两个失败 → 让 Boss 关复用失败的材料**（`DEMO.md:26`）。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里可生效的参数是 `palette`（`bg #3d168f` / `fg #FFFFFF` / `accent #cbb8ff` / `subtitle #FFFFFF` / `subtitleBack #B3000000`）、`bgRecipe`（solid + texture paper + vignette 0.35）、`subtitle`（字体 `KaiTi`、字号因子 0.0463、下边距 0.16019、**bold true**）、`title`（字号因子 0.11）、`overlay`（`accentRule:true`、`progressBar:true`）、`motion`（`subtitleFadeIn 0.08`、`chapterTransition cut`）与 `tags`（主题 游戏/活动/教育，情绪 热烈/幽默，节奏 快，场景 综艺/教学）。**注意**：该条目是 `derived:true` 的派生值，字体是 `KaiTi` 而非 Titan One / Lilita One（见第 11 节）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- ~~**9:16 会丢画面且丢的是关键 UI**~~ **★ 2026-10-04 已修**：`demo/index.html` 加「设计帧等比装入」外壳 + `demo/film.js` 声明 `FILM_META.aspects`（5 个比例全支持），9:16 下整幅画面（含生命板、讲台、大红按钮、TV 框、字幕）**都在**（见第 2 节）。残留代价：竖屏有效画面只占 1080×607、全屏层不铺满留边。
- **「文案+风格」通路的字幕完全不对**：`dub-styles.json#microgame` 的 `subtitle.fontFamily` 是 `KaiTi`、`bold:true`、`subtitleBack:#B3000000`（黑底条），而本风格原生字幕是 **Titan One 白字 + 22px 墨描边 + 品红投影 + 金色爆点、斜 −6°**，且**命令词 = 字幕、不加底框**（`DEMO.md:46,87`）。走 `dub.mjs` 通路时，本风格最标志性的视觉元素会全部丢失。
- **ASR 未全通过**：本次 `mismatches: 4`（`d_ah` / `fx_choo1` / `d_ah2` / `fx_choo2`），日志打 **`STEP_WARN asr_check 未通过（继续）`**（`logs/microgame.log:87-110`）。按 `DEMO.md:58` 这四条属于**当 SFX 处理、豁免 whisper 校验**的条目，所以不算真缺陷，但流程上确实亮了黄灯。
- **混音峰值偏高**：`mix.wav peak 0.89`（`logs/microgame.log:118`），距削波只剩约 1 dB。
- **真峰值超交付线 0.34 dB（本次新补记）**：成片真峰值 **−0.86 dBTP**（`loudnorm` `input_tp`，4× 过采样；`STYLE.md` 未声明更严上限，按项目线 −1.2 dBTP 判）。真峰值为负 ⇒ **未削波**，属『仅超线』。根因在下游 AAC 编码余量——本风格副本 `styles/microgame/demo/tools/mux.sh` 的 loudnorm 目标写死 `TP=-1.2`（`tools/mux.sh:5,9`），未采用 core 版 `LN_TP=-1.7`；按 AGENT-BRIEF 取 −2 档后**减半 = −1**（项目级既有缺陷，非本风格音频链所致），`audio 18→17`（理由见 `_distill.json.audioScoreBasis`）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 −0.86 dBTP → **−2.18 dBTP**，已在 −1.2 dBTP 交付线内；音频评分回补 +1（见第 10 节）。
- **音视频长度不一致**：`mux.sh` 提示 `audio (59.826792 s) shorter than video (59.833333 s); padding to 59.875000 s`（`logs/microgame.log:132`）——已自动补足，无实际影响。
- **字幕底衬色为回退值**：目前用风格自身地色/辅色替代（回退原因见第 5 节）；若要完全对齐 demo，需先统一 `palette.subtitle` 与 demo 的 `textColor`。
- **细纹理 `textureRaw: toon` 声明了但渲染未实现**：`lib/dub-styles.json#microgame.bgRecipe.textureRaw` 是 `toon`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `paper` ⇒ 纸纹噪点（`noise=alls=9:allf=t+u`）），**不读** `textureRaw` ⇒ `toon` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `toon` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口
- 无外部素材缺口（全程序化）。真正缺的是**字体**：Titan One、Lilita One、Inter 若不在环境里，命令词与卡片会 fallback，风格立刻走样。
- ~~缺 9:16 版舞台布局参数（TV 尺寸、讲台与生命板位置），竖版必须重排。~~ **★ 2026-10-04 已解决（改用页面外壳整幅等比装入，不重排、不裁切）**：9:16 无需竖版舞台布局参数；仅当要求竖版**满屏无留边**时，才需要原生竖向重排。

### 能力限制
- **格式硬上限 45–60s**：更长就失去 frenzy（`STYLE.md:6`）。想做长内容必须换风格。
- 依赖 **WebGL2 材质 shader**（riso / crayon / CRT / ink / blueprint paper 五种，`glpass.js`）与大量离屏 Canvas 渲染；`setCtx` 一旦漏调就会画到错误的画布（`DEMO.md:115`）。
- **单字命令在 Kokoro 里会加元音尾巴**（`Pump!` → `Pompey`、`Zip!` → `Zipper`），必须生成两词短语再按 ASR 时间戳切词（`tools/trim_cmd.py`）（`DEMO.md:59`）。
- 角色帧率必须能独立于相机帧率步进（8/12/24 fps），否则加速阶梯做不出来。

### 踩过的坑（本机实测）
- 亮度斜坡的 ASCII 主角**糊成一团**——必须用手写 glyph 模板 + 结构 glyph（`/ \ | _ -`）+ 天线球用反色 `@`（`DEMO.md:111`）。
- 水墨降落伞一开始读成**黑烟/雷雨云**——要把泼墨阶段压短且保持圆形、伞幅用渐变 + 缝线扇形展开、加扇贝形下摆、边缘留亮（`DEMO.md:112`）。
- 瑞士的「敬礼失败」读成**举手**——手臂必须**过冲并撞到**红球，且这个失败需要一次即时回放才能在 140 BPM 下被读懂（`DEMO.md:113`）。
- 蜡笔层在 alpha 模式下会**从蜡的缝隙里透出背景**——必须给满压的纸白底（`DEMO.md:114`）。
- 用全局 context 的绘图 helper 在离屏缓冲里会画到**错误的画布**——前后都要 `setCtx`（`DEMO.md:115`）。
- `flat` 是 GLSL ES 3 的保留字（`DEMO.md:116`）；上传 2D canvas 不设 `UNPACK_FLIP_Y` 时 v=0 是画布顶，要用 `p/R` 采样（`DEMO.md:117`）。
- 命令标签会**堆积**（`LAND IT!` + `PULL!` 同角）——次要命令应飞出去（`DEMO.md:118`）。
- 100% 白闪读成**空帧**——封顶 60%（`DEMO.md:119`）。

### 下次迭代优先补什么
- 给 `dub-styles.json#microgame` 补一套**命令词专用字幕样式**（Titan One、白字 + 墨描边 + 品红投影 + 金色爆点、斜 −6°、无底框），替换 `KaiTi + bold + 黑底条` 的派生值。
- ~~补一个 **9:16 舞台布局变体**（TV 尺寸、讲台与生命板位置），让竖版不丢生命板。~~ **★ 2026-10-04 已完成（改用页面外壳整幅等比装入，不重排）**：9:16 下整幅画面都在；仅当要求竖版**满屏无留边**时才需原生竖向重排。
- 把 `fx_*` 与 `d_ah*` 这四条从 ASR 校验里正式标注为「豁免」，避免每次出片都亮黄灯。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/microgame/microgame.mp4`（59.83s / 49.4MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/microgame/`（24 帧 + `_contact.jpg` 接触印样） |
| 风格匹配度自评 | **92/100**（2026-10-05 校正：原 93，新增「textureRaw 细纹理未实现」缺陷，palette −1）（2026-10-05 校正：原 92，9:16 画幅缺陷已修并回补 composition +1）（2026-10-03 校正：原 91，音频真峰值缺陷已修，audio +1）（本轮由 92 下调 1：新补记成片真峰值 −0.86 dBTP 超 −1.2 dBTP 交付线 0.34 dB，取 −2 档、根因在下游 AAC 编码余量故减半 = −1） |
| 详细资料 | 有：`styles/microgame/STYLE.md`、`DEMO.md`、`style.json`、`demo/build.sh`、`lib/style-dna/microgame.md`、`lib/style-dna/microgame.json`、`lib/dub-styles.json#microgame`、`_distill/logs/microgame.log` |

**逐帧拆解要点**：
- **画面元素怎么变**：f01/f02 是**冷开场**——第 1 帧已经在游戏里（蜡笔媒介，`PUMP!` 已在左上角，主角在打气）；f03 拉出电视回到**家舞台**（STAGE 02、招牌 `FIVE-SECOND ASTRONAUT`、金 TV、秒表头主持人、3 个头盔生命、讲台大红按钮）；f04/f05 水墨喷嚏关（f04 命令词 `DON'T SNEEZE!` 是**中央大横幅 + 金爆点 + 品红投影**，f05 已缩成左上角小标签、画面是黑墨头 + 白眼 + 朱红 05 印）；f06 回舞台 STAGE 03 + 红 ✗ + 「Bless you. Next!」+ 生命降到 2；f07 ASCII 终端关（琥珀磷光、手写 glyph 主角）；f08 回舞台 STAGE 04 + 绿 ✓；f09/f10 riso 关（三版套印 + 半调 + `CATCH!`/`CHOMP!`）；f11 **老虎机 SPEED UP**（舞台裂成三条旋转条）；f12 像素关（240×135 索引色 + `DODGE!`）；f13 回舞台 STAGE 06；f14 蓝图关（蓝纸白线 + 尺寸线 + `ZIP!`）；f15 瑞士关（`salute.` 黑圆 + 黑方 + 红圆）；f16 回舞台 STAGE 08 + 红 ✗ + 「One life left, cadet.」+ 只剩 1 个头盔；f17 **Boss 瓷砖翻面**（往期末帧翻成新帧碎片）；f18/f19/f20/f21 Boss 混媒关（riso 云 + 蓝图特写 + 水墨降落伞绽放 + 红靶心）；f22/f23 回舞台 + 绿 ✓ `CLEAR!` + 撒花 + 主角首次站上舞台；f24 片尾卡在电视里。
- **色怎么走**：**没有全片统一的色走**——这是本风格的核心。家舞台恒定在紫/品红/金（f03/f06/f08/f13/f16/f22/f23/f24）；每关游戏**完全换色板**：蜡笔（米白纸 + 蜡绿 + 蜡红，f01/f02）→ 水墨（米白 + 黑 + 一颗朱红，f04/f05）→ 终端（黑 + 琥珀，f07）→ riso（纸白 + 蓝/黄/品红三版，f09/f10）→ 像素（深紫 + 星空，f12）→ 蓝图（蓝 + 白，f14）→ 瑞士（白 + 黑 + 信号红，f15）→ Boss 混媒（粉紫天空 + 橙太阳 + 蓝地球，f18–f21）。
- **字幕什么时候出现**：命令词**每关开头砸入**（f01 `PUMP!`、f04 `DON'T SNEEZE!`、f07 `STRAP IN!`、f12 `DODGE!`、f14 `ZIP!`、f15 `SALUTE!`、f18–f21 `LAND IT!`），并在第一个动作前**缩成角落标签**（f05 是这一行为的直接证据）；主持人与主角的台词用**金色圆角卡片**（f03「Welcome to Five-Second Camp!」、f06「Bless you. Next!」、f16「One life left, cadet.」、f19「Oh no.」）。
- **转场**：**推入/缩回电视框**是主转场（f02 → f03、f05 → f06、f07 → f08、f12 → f13、f15 → f16、f21 → f22 都是这一对），配 ✓/✗ 印章；此外有硬切与老虎机滚轮（f11）。**未见叠化、未见空帧**。
- **瑕疵帧**：未发现糊帧、错位、字幕溢出或黑边。f11 三条滚轮条之间的细缝是刻意的老虎机结构，不是瑕疵。f19 右上角的 ASCII 高度读数面板被缩到角落——这是 Boss 混媒帧「一条焦点链 + 信息面板推角落」规则的正确执行（`DEMO.md:81`）。

**自检发现的缺陷**：见第 11 节「已知缺陷」六条——9:16 丢生命板、「文案+风格」通路字幕完全不对（KaiTi + 黑底条）、ASR 亮黄灯（4 条豁免项）、混音峰值 0.89 偏高、**成片真峰值 −0.86 dBTP 超交付线 0.34 dB（−2 档减半 = −1）**、音视频长度差已自动补足。 ★ 2026-10-03：成片真峰值已修（−0.86 dBTP → −2.18 dBTP，音频重混），见第 11 节。 ★ **2026-10-04：9:16 丢生命板已修**——改为页面外壳整幅等比装入（见第 2 节）。

**本次为补齐短板做了什么**：**未改动任何源码**（遵守红线）。本次仅做文档蒸馏；第 11 节已把「命令词专用字幕样式」「9:16 舞台布局变体」「ASR 豁免标注」列为下次迭代的优先项。 ★ **2026-10-04（多比例改造）**：为支持多比例，改了 **2 个源文件** —— `demo/index.html`（新增页面外壳等比装入脚本）与 `demo/film.js`（新增 `FILM_META.aspects` 声明）；**影片绘制代码（8 个 `g_*.js` / `stage.js` / `frames.js` / `hud.js` / `chars.js` / `toon.js` / `glpass.js`）一字未动**，故 16:9 逐字节不变（md5 实测）。
