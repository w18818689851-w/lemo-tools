---
name: lemo-style-dark-keynote
description: 【lemo 风格 Skill · 暗色科技发布】做软件/产品发布、SaaS 方法论、增长复盘类短片时用；交付「近黑舞台 + 发丝网格 + 唯一强调色」的克制专业观感，界面本身就是主角。选定本风格做视频时，优先读本文件。
slug: dark-keynote
name_zh: 暗色科技发布
category: 信息与发布
film: Room to Think
---

# 暗色科技发布（`dark-keynote`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/dark-keynote/STYLE.md` · `styles/dark-keynote/DEMO.md` · `styles/dark-keynote/demo/build.sh` ·
> `lib/style-dna/dark-keynote.json` · `lib/style-dna/dark-keynote.md` · `lib/dub-styles.json#dark-keynote` ·
> `styles/dark-keynote/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部「界面本身是主角」的软件发布片。没有实体产品、没有玻璃渲染，主角是界面——光标、窗口、通知、方块、一个数字。它活在近黑舞台上，被柔和冷光照亮，全片只有**一种品牌强调色**留给最重要的那一个元素（`STYLE.md:8`、`style-dna/dark-keynote.md:11`）。风格由「精度」定义：每个元素吸附网格、每次运动落在拍上、每种声音属于同一个设计家族；戏剧性来自对比——混乱被画成生成的 UI、一次决定性动作、然后是大片留白（`STYLE.md:10`）。

**不是什么**（最容易做错的邻居风格）：不是玻璃产品渲染（没有实体产品）、不是录屏（没有真 OS/App、没有系统控件、交通灯按钮、Dock）、不是全息 HUD（没有扫描线）、不是图表片（是一个数字，不是一张图）（`STYLE.md:12`、`style-dna/dark-keynote.md:159-162`）。

**什么时候用它**：软件/SaaS 产品发布、版本更新、效率工具介绍、增长与方法论干货、需要「专业、克制、自信」气质的商业短片（`dub-styles.json#dark-keynote.tags`）。样片《Room to Think》是虚构 app「Tidy」的发布片：一个被埋掉的光标一键把几百个窗口归位（`style.json:9`）。

**一句话内核**：暗色舞台上，一个活的元素（光标）用一次落在拍上的动作，把混乱收进网格，然后光揭幕、一个巨号数字说话、一切收起来。

**边界**：它撑不起——真人出镜、实拍素材、风景/人物摄影为主的题材、需要情绪煽动或抒情叙事的片子、多色相热闹的综艺感内容。全片只有一种强调色，如果内容天然需要区分五个并列品类，这个风格会逼你砍到「一个问题色 + 一个强调色」（`STYLE.md:26`）。

---

## 2. 画面构图

- **镜头数与画幅**：原生 16:9 / 1920×1080（本次出片即 `--ratio 16:9`）。单镜以「锁死极特写 → 连续拉远 → 半秒插入 → 冻结推近 → 一拍急拉 → 近乎锁死的转动 → 数字潜入 → 缓慢推 → 回到首镜取景」组织（`DEMO.md:31-42`）。
- **主体位置与占比**：一个焦点元素，通常居中或略偏；强调色只出现在焦点上（`STYLE.md:65`）。钩子镜是光标 + 一行字（文字约 150px，`DEMO.md:33`）；混乱段主体铺满画面；揭幕段产品窗口占画面中心大部；数字镜「12,408」几乎占满全屏宽度（帧 f16/f17）。
- **负空间 / 留白**：极慷慨。开场（帧 f01/f02）、冻结（f12）、数字（f16）、回响（f20/f24）都是大块近黑留白 + 一个元素。
- **图层叠放顺序**（从底到顶）：近黑舞台 + 径向提亮 + 冷色光晕 + 暗角 → 发丝网格（`rgba(255,255,255,.032)`，每 48px，每第 4 条 `.06`）→ UI 卡片/窗口（三级抬升暗面）→ 光标/强调元素 → 字幕吐司（`STYLE.md:16`、`DEMO.md:66`）。
- **安全区**：字幕是底部居中吐司；字幕出现时产品窗口整体上抬 25px，避免吐司切到窗口底（`DEMO.md:79`、`DEMO.md:112`）。
- **本风格不能出现的构图**：交通灯按钮 / 菜单栏 / Dock 等真实系统 chrome；扫描线；把强调色给两个元素；舞台或网格自己漂移（`STYLE.md:17`、`style-dna/dark-keynote.md:110`）。

**在 9:16（产品默认）下的表现**：本风格**已适配 9:16**——`FILM_META.aspects = ['16:9','9:16']`（`film.js:11-16`），`renderFilm` 首行 `setFrame(opts.W ?? NATIVE.W, opts.H ?? NATIVE.H)` 按视口重排（`film.js:530`），`engine.js` 导出 `NATIVE` 并派生 `W/H/FX/FY/S = min(fx,fy)`（`engine.js:12-14`）。两套坐标各归各的：**世界层**（相机里的桌面 / 窗口 / 几百个元素）由 `camera()` 把 `S` 折进 zoom（`engine.js:473`、`engine.js:479`）——世界按紧轴等比装入当前帧并居中；**全屏层**（近黑底 / 发丝网格 / 暗角 / 字幕吐司 / 插入镜 / 大数字镜 / 片尾卡）贴**当前帧**：位置按 `FX/FY`、尺寸·字号·线宽按 `S`（吐司 `y = H-72*FY`、`px = 40*S`，`engine.js:450`；插入镜 `film.js:316`、大数字镜 `film.js:411`、片尾卡 `film.js:489`）。1080×1920 实测（`S = 0.5625`）：**不裁切、无内容丢失**；底部居中的字幕吐司落在画面内（不再溢出、也不再与主体脱节），大数字镜「12,408」与存储条插入镜按竖幅重排、铺满画面宽。代价与邻居风格（`spy-titles` / `living-screencast`）一致：桌面是 16:9 的实体，竖屏里按 0.5625× 等比缩小成**居中一条横带**，上下是近黑舞台——风格本身就是「UI 浮在近黑舞台上」，所以是版面更空、密度更低，而不是被裁。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 底 | `#0A0B0F` | 近黑舞台基色 | `DEMO.md:66`、`dub-visual.json`（engine.js:7-9 PAL.bg0） |
| 底（径向提亮） | `#151822` | 上中部径向提亮到 | `DEMO.md:66`、`dub-styles.json#dark-keynote.palette.bg2` |
| 冷色光晕 | `#3B4CCA`（8%） | 右上大型冷色光池 | `DEMO.md:66` |
| 主文字 | `#E8EAF0` | 主文本 / 字幕 | `DEMO.md:72` |
| 次级文字 | `#8A90A0` | 二级文本 | `DEMO.md:72` |
| 标签文字 | `#5C6272` | 标签 / 状态 | `DEMO.md:72` |
| **强调（唯一）** | `#B7F34A`（lime） | 光标 / 「Tidy up」药丸 / 勾选 / 「0.8」 | `STYLE.md:28`、`DEMO.md:73` |
| 强调光晕 | `rgba(183,243,74,.35)` | 强调元素外发光 | `DEMO.md:73` |
| 问题色（仅问题段） | `#FF5A5F` | 徽章 / 警告，按下之后永不再现 | `DEMO.md:74` |
| 表面 1/2/3 | `#12151C` / `#1A1E28` / `#222734` | 三级抬升暗面 | `DEMO.md:70` |
| 边框 / 内顶高光 | `rgba(255,255,255,.08)` / `.07`（1px） | 面板描边 / 内高光 | `DEMO.md:71` |
| 三股流色 | `#C9D3E6` / `#F2A65A` / `#7E95FF` | 收拢轨迹：文件 / 照片 / 通知 | `DEMO.md:75` |

- **明度 / 对比规则**：冷中性阶梯，中性色微微偏蓝、绝不偏暖棕（`STYLE.md:24`）；未受光的像素停在 7%（`STYLE.md:20`、`DEMO.md:50`）。
- **禁止出现的颜色**：暖棕中性、问题红在转折后复现、第二个强调色（`STYLE.md:26`、`style-dna/dark-keynote.md:162`）。
- **同一画面最多几个色相**：静态 UI 只有中性 + 一个强调色；混乱段可临时出现三股流的分类色与问题红，但它们是「噪声」，转折后全部消失（`STYLE.md:27`）。

---

## 4. 转场规则

- **镜头之间怎么切**：**转场 = UI 展开 / 收起**——每次镜头切换都是某个界面元素展开占满画面，或画面收进某个元素（`STYLE.md:67`、`style-dna/dark-keynote.md:108`）。帧 f08 的红色存储条、f10 的网格显形、f16 的数字潜入都是「从源元素展开」。
- **有没有叠化 / 闪白 / 擦除 / 定格**：有**定格**——15.0–16.0s 全画面冻结、所有轨道掉到数字零（`style-dna/dark-keynote.md:85`）；有**光揭示**（柔光带扫过，只有被照亮的像素才亮起，f12→f13）。**没有淡入淡出、没有空白帧**（`STYLE.md:67`）。
- **硬切点怎么定**：全部挂在 120 BPM 网格上（1 拍 = 0.5s，1 小节 = 2s，1 个十六分 = 0.125s，`timeline.js:2`）。关键锚点：0.75/2.5 片名打字、3.0/3.5/3.75 三声通知、12.0–13.5 三个插入镜、15.0 冻结、17.0 网格显形、20.0 揭幕、26.0 大数字、37.0 片尾卡（`style-dna/dark-keynote.md:71-81`）。
- **转场时长与缓动**：展开在拍前一帧启动，落到拍上时已约 80% 打开（`STYLE.md:67`）；缓动为快出 + 一次小过冲（`back`，s≈1.3）后立即安定（`STYLE.md:41`）。
- **绝对不要的转场**：通用淡入淡出、空白帧、无来由运镜、让舞台或网格自己动（`style-dna/dark-keynote.md:110`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | Inter 500（UI/字幕）；本机无 Inter，通路由 `dub-styles.json#dark-keynote` 回退 Microsoft YaHei（`STYLE.md:32`） |
| 字号（相对画面宽 / 高） | 约 40px（`STYLE.md:34`）；通路 `fontSizeFactor 0.037`（≈40px/1080） |
| 颜色 / 描边 / 阴影 | 文字 `#E8EAF0`；无描边；胶囊底 `rgba(12,14,19,.72)`（混乱段 `.88`）、1px `rgba(255,255,255,.09)` 边、柔和投影；带 8px 强调色「说话中」圆点（`DEMO.md:79`） |
| 位置 / 安全边距 | 底部居中吐司；通路 `marginVFactor 0.145`、`marginLFactor 0.06`（`dub-styles.json#dark-keynote`） |
| 单行字数上限 / 最多行数 | 一行一句；demo 6 行实测 10–42 字符，最短 `Meet Tidy.`（10），最长 `One press, and everything finds its place.`（42）（`style-dna/dark-keynote.md:35`） |
| 出现与消失方式 | 12px 上浮 + 淡入 0.16s；停留 ≥ `max(1.8s, 语音 + 0.6s)`（`STYLE.md:34`、`film.js:505`） |

- **字幕与旁白的关系**：字幕是**一个 UI 组件**（吐司），不是传统字幕条。由光标在画面里打出的文字（片名、结尾句）**只进 `.srt`、不重复烧两遍**（`lines.json` 的 `onscreen:true` 被过滤，`film.js:505`、`style-dna/dark-keynote.md:45`）。
- **本风格特有的字幕禁忌**：巨号数字屏**不加字幕**——数字本身就是信息（`STYLE.md:33`）；不要让吐司盖住产品窗口底部（`DEMO.md:112`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「a bottom-centre toast (dark translucent pill, 1 px light border)」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#330C0E13`（AARRGGBB，落盘 ASS 为 `&H33130E0C`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(12,14,19,0.8)）；字色 #E8EAF0 与该底衬的 WCAG 对比度 **16.14**。

---

## 6. BGM / 音效特征

- **配乐**：原创极简主义。马林巴（声部 1，在拍上）+ 硬槌颤音琴（声部 2，先齐奏后错相、峰值略失谐更亮）+ 钟琴（声部 3，反向漂移）+ numpy pad（A drone 逐渐加入 G#/D# 不协和并升高）+ 低音正弦脉冲（八分 → 十六分）+ 轻噪声沙锤；**120 BPM**、**A 大调**；按下时所有声部落到**一个 A 大调 9 和弦**（`DEMO.md:56-57`、`music/score.py:1`）。本次 `score.wav 42.000s gain -6.42 dB notes 361 perc 40`（`logs/dark-keynote.log:73`）。
- **拟音（foley）清单**：光标嗒、低调键盘、回车、通知玻璃、文件 plop、照片 flick、窗口 whoosh、故障音、堆叠闷响、按下「doom」（毛毡槌 + 55→40 Hz 正弦下落）、网格嗒、毛毡嗒、光扫 shimmer、数字颗粒、显像管关机（`DEMO.md:59`）。
- **旁白处理**：音乐在人声下压 **−8 dB**、拟音 **−4 dB**（`STYLE.md:78`、`style-dna/dark-keynote.md:139`）；环境声（房间 + 风扇 + 6.8kHz 线圈啸叫）压到本段最后一句旁白结束前才放开（`DEMO.md:111`）。
- **响度目标**：`-14 LUFS`；**交付真峰值上限**：`-1.2 dBTP`（项目级交付线；本风格 `STYLE.md:78` 只写 −14 LUFS，未额外声明更严上限）。本次成片实测 **I = −14.3 LUFS / LRA 6.0 LU（`ebur128`）/ 真峰值 −1.50 dBTP（`loudnorm` `input_tp`，4× 过采样）—— 真峰值在交付线内，余量 0.30 dB、未削波**（`logs/dark-keynote.log:87-90` 只印了 `ebur128` 的 `Peak -1.5 dBFS`——那是 1 位小数读数，同一条链上 `astats` 的采样峰值 −1.502179 是下界，两者都不能当真峰值用）。
- **静音策略**：静默是工具。15.0–16.0s 所有轨道数字零（屏幕暂停），之后第一声是「按下」；33.0–34.0s 近静默（−60 dB 房间），之后第一声是光标「嗒」，与第一帧同一个声音（`DEMO.md:60`）。

---

## 7. 素材偏好

- **需要什么素材**：**全部在代码里生成**，不依赖外部实拍/图库。需要：原创 UI 套件（圆角窗口、通知卡、带等宽文件名的文件图标、程序化缩略图、列表行、标签页、徽章、进度条、统一方块）、品牌标记与字标、强调色设定、以及一条时间线音符表（`STYLE.md:17`、`style-dna/dark-keynote.md:173-177`）。
- **不需要什么素材**：真实产品截图、真实 OS/App 界面、玻璃材质渲染、3D 模型、照片摄影素材（`STYLE.md:12`）。
- **取景 / 质感 / 比例偏好**：干净、无颗粒（`mux.sh` grain 0）、1px 线、柔和阴影、条带渲染的透视（rotY ≤ ~24°）（`STYLE.md:16-20`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：缩略图用程序化生成的渐变风景替代真实照片；品牌标记用 squircle + 光标几何体替代；字体缺失时用系统无衬线（雅黑）顶替并保持字号/字重，不要引入衬线或手写体。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 钩子/回响镜最长（数秒），插入镜最短（半秒级，如 999+ / 148 标签页 / 红色存储条）（`DEMO.md:35`） |
| 全片时长 | 42.0s（`style.json:17`、`timeline.js:2`）；本次成片 **42.0 s**（容器实测 42.000000 s / 1008 帧 @24fps，含片尾）。⚠ **日志里的 `42.9s` 是「总耗时」，不是片长**（`logs/dark-keynote.log:92` 的 `✓ 成片 19.9 MB  42.9s` 与 `:98` 的 `全部完成 · 总耗时 42.9s` 是同一个累计用时），别再抄错 |
| 镜头数 | 叙事段约 9 个功能镜（钩子/累积/过载/冻结/按下/揭幕/数字/呼吸/回响），事件 873 条、字幕 6 条（`logs/dark-keynote.log:26-28`） |
| 信息投放节拍 | 全部挂 120 BPM 网格：平静钩子 → 打断（3s 首条通知）→ 累积（一次连续拉远，每小节加一层）→ 过载插入 → 冻结 + 静默 → 那一个动作 → 光揭幕 → 大数字 → 呼吸 → 回响 → 片尾卡（`DEMO.md:23`） |

- **加速 / 减速点**：累积段越来越快（元素按规则生成、越来越密）；冻结段骤停；揭幕段极慢（窗口转正 4.5s、镜头几乎不动，`DEMO.md:38`）。
- **留白与静音的位置**：15.0–16.0s 与 33.0–34.0s 两处静默；开场与结尾都是大留白（帧 f01/f02/f20/f24）（`DEMO.md:60`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/dark-keynote/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/dark-keynote/demo --fps 24 --workers 6 --size 1920x1080 --out …`（`logs/dark-keynote.log:38`） |
| 帧率 | 24 fps on ones（`STYLE.md:40`） |
| 分辨率 / 比例 | 原生 1920×1080 / 16:9（`logs/dark-keynote.log:2`）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:11-16`），由 `engine.setFrame()`（`engine.js:12-14`）重排：相机 `zoom × S`（`engine.js:473`）、全屏家什按 `FX/FY` 定位 / `S` 缩放（`engine.js:450`）；16:9 时 `fx=fy=S=1` 逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $O/dark-keynote.mp4 24 0`（−14 LUFS / grain 0）（`build.sh:15`） |
| 编码器 | `h264_nvenc`（本地 GPU；本次 `nvenc`，`logs/dark-keynote.log:7`） |
| 音频入口 | `demo/music/score.py`（配乐）+ `demo/mix.py`（拟音 + 人声 + 闪避） |
| 字幕入口 | `demo/tools/export.mjs`（导 `out/srt.json`）+ `core/render/srt.py`（生成 `.srt`）（`build.sh:10,13`） |
| 事件导出 | `node core/render/events.mjs styles/dark-keynote/demo`（本次 events 873 dur 42，`logs/dark-keynote.log:25-26`） |
| 本风格专属参数 | `node $D/tools/dump_timeline.mjs`（速度网格 + 声部音符表）、`python $D/tools/cuecheck.py`（配乐↔画面卡点 + 每个元素一个音） |
| 一键复现 | `sh styles/dark-keynote/demo/build.sh`（11 步：dump_timeline → TTS → whisper → score → export → cuecheck → mix → srt → render → mux → final_asr）（`build.sh:1-18`） |
| 本次编排器调用 | `node lemo-make.mjs dark-keynote --skip-sync --no-preflight --ratio 16:9`（`logs/dark-keynote.log:1`） |

---

## 10. 编排规则

- **内容文件字段契约**：`timeline.js` 是**唯一真值**——导出 `BPM/BEAT/BAR/S16/DUR`、音型 `P`、关键时间点 `K`、四条声部 `voice1/voice2/voice3/voiceClean`、`typeTimes`；`tools/dump_timeline.mjs` 把它导出为 `timeline.json` 供 Python 配乐/混音/校点读取（`style-dna/dark-keynote.md:181`）。`lines.json` 每行 `{id, text, voice, speed, onscreen?}`，demo 用 `af_kore`、speed 0.95，`onscreen:true` 的行由光标在画面里打出、只进 `.srt`（`style-dna/dark-keynote.md:172`）。
- **事件词汇表**：`key{c,i}` / `return` / `caret_tick` / `ding{i}` / `spawn_file|spawn_photo|spawn_notif|spawn_window{kind,fg,pan,big}` / `insert{i}` / `freeze` / `stretch` / `press` / `land{g,pan,k}` / `grid` / `sort_wave{w}` / `chrome` / `sweep` / `check{i}` / `num` / `lock{i}` / `retract{i}` / `to_caret` / `silence2` / `end_card` / `caret_off` / `vo{id}`（`style-dna/dark-keynote.md:185`）。`tools/cuecheck.py` 校验关键 cue，且每个生成元素都落在配乐音符上。
- **时间线契约**：`film.js` 导出 `renderFilm(g,t,o)`、`DUR`、`setLines/subs`、`buildEvents()`；页面契约 `window.READY / window.render(t) / window.DUR / window.EV`（`style-dna/dark-keynote.md:181`）。
- **新增主体怎么接入**：用引擎画——任意形状 `E.litShape(g, path2d, {accent, color, glowR, sweep, bbox})`；星标 `sparklePath`；轨迹 `trail`；光标 `caret`；UI 套件 `windowBox / windowContent(kind) / notif / fileIcon / photo / badge / appIcon / storageBar`；飞行 `flyPose` + `motionBlur`；光扫 `lightReveal`；透视 `perspective`；数字 `scramble`；字幕 `toast`；镜头 `camera`（`style-dna/dark-keynote.md:177`）。
- **换主题时要改哪些文件**：① `demo/timeline.js`（BPM/音型/声部/关键时间点，决定节奏与卡点）；② `demo/lines.json`（旁白与 `onscreen` 标记）；③ `demo/film.js`（场景编排与事件表 `buildEvents`）；④ `demo/world.js`（混乱生成器的元素规则与吸附目标）；⑤ `demo/engine.js` 里的 `setAccent` 强调色与品牌标记函数（`tidyMark`/`wordmark` 需按新品牌重命名）。配乐改 `demo/music/score.py`，混音改 `demo/mix.py`。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里可生效的参数有 `palette`（bg/bg2/fg/accent/subtitle/subtitleBack）、`bgRecipe`（type=grid / texture=hairline-grid / vignette 0.52）、`subtitle`（Microsoft YaHei / 0.037 / 0.145 / 0.06 / 无描边 / align 2）、`title.fontSizeFactor 0.10`、`motion.subtitleFadeIn 0.16`、`overlay.chapterCards true`（`dub-styles.json#dark-keynote`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **字体回退**：`STYLE.md:32` 点名 Inter / Inter Tight 600 / JetBrains Mono，本机无这些 OFL 字体，通路由 `dub-styles.json` 回退到 Microsoft YaHei，字重/字宽与设计意图不完全一致（`dub-styles.json#dark-keynote.notes`）。
- **9:16 曾不适配（★ 2026-10-04 已修）**：原记「无 `aspects` 声明，只按 1920×1080 绝对像素构图，硬渲 9:16 会丢失右侧约 43.75% 并留下方黑区」。**2026-10-04** 已改造 `styles/dark-keynote/demo/`：`film.js` 导出 `FILM_META.aspects = ['16:9','9:16']`（`film.js:11-16`）、`engine.js` 加 `setFrame(W,H)` 派生 `FX/FY/S`（`engine.js:12-14`），`renderFilm` 从实际帧重排（相机 `zoom × S`；全屏家什按 `FX/FY/S`）。**16:9 逐字节未变**（`fx=fy=S=1` 时每个表达式退化成它替换掉的那个数字）；9:16 实测不裁切、内容完整（见第 2 节）。
- **`bg`/`fg` 无官方 hex**：`STYLE.md:24` 只说「cool neutral ladder」，`#0A0B0F`/`#151822`/`#E8EAF0` 来自 demo 代码具名调色板 PAL，非文档明文（`dub-styles.json#dark-keynote.notes`）。

### 素材缺口
- 无外部素材依赖（全部代码生成），因此不存在「缺图缺片」问题；真正的缺口是**字体文件**与**品牌资产**（新主题必须自备标记/字标，不能沿用 Tidy）。

### 能力限制
- 全片只能一种强调色，天然不支持「多品类并列用色」的内容。
- 单镜时长受 120 BPM 网格约束，不适合需要自由节拍的长镜头表达。

### 踩过的坑（本机实测）
- 264 个元素的「就近吸附」看起来像闪烁而非收拢——改成每种类型飞向自己的行（Desktop / Photos / Inbox）、沿曲线、带轨迹后解决（`DEMO.md:108`）。
- 生成器最初在网格里留洞，看起来像 bug——按组裁/补到精确槽位数解决（`DEMO.md:109`）。
- 风扇与线圈啸叫（300Hz–7kHz）盖住人声——压到本段最后一句旁白结束才放开（`DEMO.md:111`）。
- 字幕吐司切到产品窗口底部——字幕出现时窗口上抬 25px（`DEMO.md:112`）。

### 下次迭代优先补什么
- 把 Inter / Inter Tight / JetBrains Mono 装进 `demo/fonts/`，消除字体回退。
- **（已完成 2026-10-04）** 9:16 适配：已给 `film.js` 补 `FILM_META.aspects = ['16:9','9:16']`（`film.js:11-16`）并由 `engine.setFrame()` 重排版面（`engine.js:12-14`）。★ 声明落在影片模块 `film.js` 的 `FILM_META`，**不是 `style.json`**——探测方 `lib/aspects.mjs` 读的就是 `film.js` 源码文本。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/dark-keynote/dark-keynote.mp4`（42.00s / 19.9MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/dark-keynote/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **92/100**（2026-10-05 校正：原 91，9:16 画幅缺陷已修并回补 composition +1） |
| 详细资料 | 有（STYLE.md / DEMO.md / style.json / build.sh / style-dna .md+.json / dub-styles.json#dark-keynote / demo 源码 / 出片日志） |

**逐帧拆解要点**：f01 近黑舞台上一行白字「Ro」+ lime 光标在打字（钩子，极特写）；f02 标题「Room to think.」带等宽 overline「TIDY · A LAUNCH FILM」，光标在左下（帧内打字）；f03–f06 通知/文件/照片窗口不断堆叠，字幕吐司依次「Your desktop. / Your photos. / Your inbox.」；f07 全屏混乱（数百元素）；f08 插入镜——红色「Storage almost full / 1.4 GB left」满宽进度条（问题色，此后不复现）；f09 混乱最密；f10 网格显形——所有元素吸附成整齐方块阵列；f11 收拢中（三股流轨迹）；f12 冻结/极暗（所有轨道数字零）；f13 光揭幕后产品窗口出现，字幕「Meet Tidy.」，右上 lime「Tidy up」药丸；f14 字幕「One press, and everything finds its place.」；f15 窗口转正 + 缓慢推；f16 大数字镜「12,408 files.」独占全屏；f17 加「Sorted in 0.8 seconds.」，lime 强调「0.8」+ 进度条；f18 呼吸段窗口收起；f19 网格边缘 lime 描边点亮；f20 lime 光标单独在留白中（回到首镜取景）；f21「Room to thin」打字回响；f22 片尾卡「Room to think.」+ 左对齐 credits；f23 片尾卡 + 末尾光标闪烁；f24 光标熄灭、近黑留白。全片配色无推移（始终近黑冷调），靠光揭示与元素密度制造明暗起伏；转场全是 UI 展开/收起，无淡入淡出。

**自检发现的缺陷**：字体回退（Inter → 雅黑）；无 9:16 适配（★ 2026-10-04 已修：`FILM_META.aspects` + `engine.setFrame()`，见第 11 节）；`bg`/`fg` 无官方 hex（来自 demo 代码）。

**本次为补齐短板做了什么**：未改动 `D:/lemo-opuscar` 下源码，未起渲染或 TTS。仅新增本目录两份交付物；短板（字体、9:16）如实记录在第 11 节，留给后续迭代。
