---
name: lemo-style-midcentury-toon
description: 【lemo 风格 Skill · 50s 扁平卡通】当你需要一部「跟着做」的说明书式短片——1950 年代教育片的口吻、扁平印刷色配一条永不合拢的呼吸墨线、身体不动只有手在做事、圆角纸牌字幕配冷爵士——就用这个风格。选定本风格做视频时，优先读本文件。
slug: midcentury-toon
name_zh: 50s 扁平卡通
category: 卡通与动画
film: Meet Pip
---

# 50s 扁平卡通（`midcentury-toon`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/midcentury-toon/STYLE.md` · `styles/midcentury-toon/DEMO.md` · `styles/midcentury-toon/demo/build.sh` ·
> `lib/style-dna/midcentury-toon.json` · `lib/style-dna/midcentury-toon.md` · `lib/dub-styles.json#midcentury-toon` ·
> `styles/midcentury-toon/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部 **1950 年代教育片式的「跟着做」指南**。扁平印刷色的形体配一条**永不合拢的呼吸墨线**；**每一块填色都是单独一张「赛璐璐」，印得比线偏几个像素（右下）、并在二拍上重印**，于是画面像手工套印的颜料一样微微抖动（`STYLE.md:10`）。人和物都是几何的：蛋形或豆形头、**鼻子是脸部轮廓的一部分**、两三块平涂的衣服、四指卡通手套。**主讲人的身体是一张定格画——只有手臂、手、眼睛和嘴在动**（`STYLE.md:12`）。房间不「画」：一个场景 = **一个色面 + 一条地面带 + 一条带缺口的水平线 + 一两个道具**（`STYLE.md:12`）。

**这是一个「场景风格」（scene style）**：它**执行一项真实用途**（安装指南、操作步骤、食谱卡、安全卡），而不是讲故事——观众看完应该**能动手做那件事**（`STYLE.md:6`）。

**不是什么**（最容易做错的邻居风格）：不是 **1930 年代橡皮管卡通**（没有黑白、没有弹跳的世界、没有热爵士）；也不是**白板讲解**——它教的是**「怎么做」而不是「为什么」**，画面是**印出来的，不是画上去的**（`STYLE.md:14`）。

**什么时候用它**：产品安装指南、帮助中心说明、安全/规则卡、食谱或仪式卡、App 引导、门店通知——凡是**「步骤 + 数据 + 一个手势」**能讲清的内容都适合（`STYLE.md:104-110` 给了五类用例的信息顺序与时长区间）。

**一句话内核**：**套印偏移让它像手工印刷品，有限动画让「那只手」就是这一步**（`style-dna/midcentury-toon.md:118-119`）。

**边界**：这个风格**撑不起**故事、情绪戏、悬念、快节奏剪辑和抽象概念。它只做**信息编排**——没有步骤可教的内容（抒情、观点、人物访谈）会让它立刻无事可做；也不能出现渐变明暗、手持镜头或溶解转场。

---

## 2. 画面构图

- **镜头数与画幅**：原生画幅 **1920×1080（16:9）**，`--ratio 16:9` 渲染（`_distill/logs/midcentury-toon.log:1-2`）。**已适配 9:16**——`FILM_META.aspects = ['16:9','9:16']`（`film.js:30`）。段落表由 `film.js` 的 `setup(content, durs)` 从 content 重建，**始终落在 132 BPM 网格**（`style-dna/midcentury-toon.md:208-209`）。
- **主体位置与占比**：**关键主体 ≥ 画面高度的 1/3**，并且**必须避开底部 140px 的字幕带**（`STYLE.md:64`）。demo 里 June 站在画面中偏左或中偏右，产品在她身侧地面（帧 f05/f09/f12）。
- **负空间 / 留白**：**大量**——一个场景只有一个色面（帧 f05 的灰蓝、f09 的芥末黄、f12 的牛油果绿），其余全是平涂空场；信息靠**圆形特写**（call-out）挤进来（帧 f06/f07/f10/f12），不靠画满。
- **图层叠放顺序**（从底到顶）：纸底 `#F4EAD5` → 场景色面（墙 = `tint(col,.45)`、地面 = `shade(col,.16)`）→ 带缺口的水平线 → 道具与主讲人（每块填色都带套印偏移）→ 圆形特写与引线 → 数据标签 → 装饰（原子星、星芒、放射光束、波点）→ 步骤头 / 字幕卡 → 虹膜与色块转场。
- **安全区**（字幕 / 主体 / 边缘）：字幕卡是**底部居中的纸色圆角牌**（Jost 500 42px、距底 **60px**、宽上限 **1280px**、最多一行）；**底部 140px 是字幕带**，主体不许落进去（`DEMO.md:80`、`STYLE.md:64`）。
- **本风格**不能**出现的构图**：把产品放在它**自己的颜色**上、把主讲人放在**自己的强调色**上（`STYLE.md:27`）；关键主体小于 1/3 画面高；把细节做成一张独立幻灯片（数据必须落在画面里，`STYLE.md:36`）。

**在 9:16（产品默认）下的表现**：本风格**已适配 9:16**——`FILM_META.aspects = ['16:9','9:16']`（`film.js:30`），`renderFilm` 首行从调用方（视口）取帧 `setFrame(opts.W/opts.H)`（`film.js:18`，派生 `FX = W/NATIVE.W`、`FY = H/NATIVE.H`、`S = min(FX,FY)`），世界层与「贴世界内容」的屏幕家什统一经 `dXf()`（`film.js:20`）把整张 1920×1080 设计帧**等比装入**当前帧、相机 `zoom` 内含 `S` ⇒ 世界坐标不用改；贴画面边的**字幕卡与全屏叠加**（虹膜、色块划像、纸纹、片尾卡）改贴**当前帧**（位置 ×FX/×FY、尺寸/字号/线宽 ×S，`film.js:96-104`、`film.js:882`、`film.js:887`）。1080×1920 实测（`S = 0.5625`）：**不裁切、无黑边**——色面与放射光束铺满整帧，主体（June、Pip、圆形特写）与三枚勋章、缎带提示、CTA 全部完整落在画面中段，字幕卡仍居中贴底（`y = H − 60·FY − h`，`film.js:98`）不溢出。代价是相机缩到 0.5625×，横向构图被压成**竖向中段的一条横带**、上下各留大片同色留白，字号缩到 42×0.5625 ≈ 24 px 仍清晰。信息完整度与 16:9 一致，只是**版面更空、密度更低**。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 纸底 | `#F4EAD5`（暗 `#E6D8BC` / `#D4C29F`） | 全片纸色底 | `DEMO.md:64` |
| 墨（暖近黑） | `#2B2420` | 所有线、文字、步骤头圆盘 | `DEMO.md:65` |
| 强调（珊瑚，June 毛衣） | `#E4613F` / 暗 `#B8452B` | 主讲人服装、8 角星 | `DEMO.md:66` |
| 钩子底（芥末） | `#E8B43A` / 亮 `#F3D37F` | hook 场景地面、腰带、波点 | `DEMO.md:67` |
| 产品（绿松石） | `#3FA7A0` / 暗 `#257A74` | **产品全片一色到底** | `DEMO.md:68` |
| 步骤色面（轮换） | `#7F9CC0` · `#A7AE5B` · `#F0B4A8` · `#6E4A6B` | 灰蓝 / 牛油果 / 粉 / 梅 | `DEMO.md:69` |
| 海军蓝 / 发 / 肤 | `#3B4766` · `#3A2621` · `#F2C7A0` | 裤子 / 头发 / 皮肤 | `DEMO.md:70` |
| 牛皮纸（盒） | `#C9955D` / `#A2713F` / `#DDB47F` | 包装盒三层 | `DEMO.md:71` |

- **明度 / 对比规则**：暖纸底 + 暖近黑墨 + **柔和的原子时代互补色**，**什么都不纯、不荧光**（`STYLE.md:26`）。**一个场景一个底色**：墙用更浅的 tint、地面用更深的 shade（`DEMO.md:73`）。
- **禁止出现的颜色 / 用法**：**渐变的明暗**（明暗只能是一个平涂深色面裁在形状内部，`STYLE.md:20`）；把产品放在它自己的颜色上；把主讲人放在自己的强调色上；霓虹色。
- **同一画面最多几个色相**：场景色面 **1 个**（加它的 tint/shade）+ 纸底 + 墨 + 产品绿松石 + 珊瑚强调 = 实际同屏 **4–5 个色相**。**产品保持一色到底**，强调色是另一个色相，其余色面轮换（`STYLE.md:28`）。

---

## 4. 转场规则

- **镜头之间怎么切**：**转场必须来自媒介本身**——圆（虹膜 / 穿过勋章）、色块擦除（侧向、自下而上）、落在拍点上的硬切（`STYLE.md:64`）。demo 只用了一套**圆的语法**：每次换步骤都是**穿过编号勋章的虹膜**（圆从盖章处长到满画幅，**0.9 拍**），因为「步骤编号本身就是那扇门」（`DEMO.md:32`、帧 f08 可见金色的「2」勋章在圆形特写里放大）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有溶解、没有叠化**（明令禁止）。有**色块擦除**（提示段用侧向、落版段用自下而上，「翻动手册的下一页」，`DEMO.md:39`）、**虹膜收束**（片尾卡在一个圆里，帧 f23/f24）、以及**完全静止 ≥3s** 的落版（`DEMO.md:40`）。
- **硬切点怎么定**：落在**半拍网格**上；demo 用 `tools/cuecheck.py` 核对画面卡点 vs 半拍网格，**0 个偏格**（`DEMO.md:55`）。
- **转场时长与缓动**：虹膜穿过勋章 **0.9 拍**；圆形特写弹出 **0.32s**（back-ease 1.5）；勋章盖章弹出 **0.24s**；标签弹出 **0.26–0.3s**（overshoot 1.9）；字幕卡淡入 **0.16s + 上移 10px**（`DEMO.md:80`）。
- **绝对不要的转场**：**溶解（dissolve）**；**手持镜头**（相机永远是「支架」）；**在下一场景开始前就把它画出来**——过渡里必须把局部时间**夹到起点之后**（`STYLE.md:94`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **字幕卡与正文/标签/细节**用几何无衬线 **Jost 500/600**；标题/数字/步骤头用 **Alfa Slab One**；钩子用 1950s 手写体 **Oleo Script Bold** |
| 字号（相对画面宽 / 高） | 字幕卡 **42px**（1920 宽下 ≈ **2.19%**）；步骤标题 Alfa Slab **64px**；细节标签 Jost **36px**；小标签用加字距全大写 |
| 颜色 / 描边 / 阴影 | 墨色 `#2B2420` 字；卡是**纸色圆角板 + 细墨边**，**它自己的颜色赛璐璐也带套印偏移 5px**；两端各一颗**珊瑚色 8 角星** |
| 位置 / 安全边距 | 底部居中，**距底 60px**；卡宽上限 **1280px**；底部 **140px** 是字幕带，主体不得进入 |
| 单行字数上限 / 最多行数 | **最多一行**；停留 ≥ `max(1.8s, 语音 + 0.6s, 字符数/12 + 1s)` |
| 出现与消失方式 | **快速淡入 + 上移 10px**（0.16s）；步骤头「STEP n OF N」在**二拍上滑入** |

- **字幕与旁白的关系**：字幕就是旁白的逐字稿，**一行只放一个从句**（`Step one. Set the dock against a wall.`）。旁白是**冷静的课堂权威**，单句实测 **23–40 字符**（`style-dna/midcentury-toon.md:38`）。J/L-cut：**每步的台词比它的虹膜早半拍开始**，尾音继续响（`DEMO.md:52`）。
- **本风格特有的字幕禁忌**：**细节文字必须有阅读时间**——数据停留 ≥ `chars/12 + 1s`，不够就把数据移进细节、把语境移进标题和配音（`STYLE.md:93`）；**套印偏移对文字也必须开着**（除清晰图解外，`STYLE.md:18`）；不许把数据做成幻灯片。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「Caption card: a paper-coloured rounded slab with a thin ink border」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#00F4EAD5`（AARRGGBB，落盘 ASS 为 `&H00D5EAF4`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(244,234,213,1)）；字色 #2B2420 与该底衬的 WCAG 对比度 **12.77**。

---

## 6. BGM / 音效特征

- **配乐**：原创 **West-Coast 冷爵士三重奏 + 色彩**，**132 BPM**：颤音琴（和弦、琶音、滑音、电机式颤音）、长笛（旋律）、低音提琴拨弦（walking）、刷子鼓（swirl + 2/4 拍；回报段换 ride 鼓棒）、钢片琴做色彩。**不是 ragtime、不是间谍大乐队、不是钢琴加弦乐**（`STYLE.md:69`、`DEMO.md:49`）。
- **节奏弧**：正常 → **回报段加倍**（升一个全音）→ **提示段减半**（换气）→ 落版恢复正常（`DEMO.md:50`）。**每一步一个自己的颤音琴和弦**（demo 用 F6 / B♭maj7 / C9），落版时**逐枚勋章把这些和弦带回来并移调**；回报段颤音琴按 `events.json` 导出的圈速「一圈一个音」（`DEMO.md:49`）。
- **拟音（foley）清单**：纸板（吱嘎、盒盖砰击、纸纤维拍打）、家电塑料（敲击、咔哒）、地面刮擦（充电座）、**阻尼橡胶图章**（每枚勋章）、**滑哨**（50 cm 尺寸箭头）、**上行 pip**（「已连接」）、**笔尖刮擦**（逐区画路线）、墨线揭离纸面、虹膜的「shhk」（`DEMO.md:54`）。
- **旁白处理**：Kokoro `am_michael` speed **0.94**（`bm_george` 试过——whisper 把他的英式元音里的 `dock` 听成 `dark`，弃用）。旁白**压缩后压在最上**，**音乐在人声下 duck 约 8 dB，拟音不压**（`DEMO.md:55-56`）。
- **响度目标**：`-14 LUFS`；**真峰值上限 −1.2 dBTP**（`DEMO.md:55` 明写 `−14 LUFS, true peak −1.2`，与项目交付线同值、无更严声明）。本次实测成片 **I = −14.1 LUFS / LRA 7.3 LU（`ebur128`）/ 真峰值 −1.50 dBTP（`loudnorm` `input_tp`，4× 过采样）—— 真峰值在交付线内，余量 0.30 dB、未削波**（`logs/midcentury-toon.log:84-87` 只印了 `ebur128` 的 `Peak −1.5 dBFS`——那是 1 位小数读数，`astats` 采样峰值 −1.636732 是下界，两者都不能当真峰值用）。
- **静默策略（三处，本风格特色）**：**A**（0–1.36s）没有音乐，只有盒子；**B**（按下按钮前的最后一拍）**一切关掉、连环境音也关**，所以静默之后第一个声音（开始咔哒）就是那一步；**C**（落版之前）只留房间底噪，静默后第一个声音就是第一枚勋章盖章（`style-dna/midcentury-toon.md:86-88`）。环境：暖房间底噪（低通棕噪 ≈ **−42 dB**）+ 半拍网格上极轻的座钟滴答；回报段由 Pip 的电机嗡鸣接管（`DEMO.md:53`）。**grain 4**（轻颗粒，观感是印刷而非胶片）。

---

## 7. 素材偏好

- **需要什么素材**：**几乎不需要外部素材**——形体、套印、墨线、装饰、拟音、配乐全部程序化生成（Canvas2D 引擎 + 合成音频）。要人写的是 `content.json`：`product` / `title` / `subtitle` / `hook` / `steps[]`（2–5 步，每步含 `title` / `detail` / `icon` / `action` / `measure` / `line`）/ `payoff` / `tip` / `outro` / `palette` / `voice` / `film`（`DEMO.md:112-131`）。
- **不需要什么素材**：不需要实拍照片/视频、不需要外部贴图（纸纹、纸牙、颗粒都是程序化的）、不需要预先做好的插画（18 个图标已内置：dock, phone, start, cable, wifi, plug, water, beans, cup, filter, box, clock, check, leaf, key, bulb, spark, gear，`DEMO.md:169`）。
- **取景 / 质感 / 比例偏好**：**镜头永远是「支架」（the stand）**，只做推、横移、俯仰、拉远，**永不用手持**（`STYLE.md:48`）。质感是**印刷品**：套印偏移 `(6,4)`px 在二拍（12fps）上抖动 ±1.6px；线是 3–5px 墨带，宽度 ±40% 呼吸、12–25% 断口（`DEMO.md:80`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：若没有 Oleo Script / Alfa Slab One / Jost 三种字体，**至少保住「衬线标题 + 无衬线正文」的角色分工**，并把字幕卡做成**纸色圆角牌 + 细墨边**——这是本风格最容易识别的一件东西；若做不出套印偏移，宁可整体简化也不要用纯平涂，因为「印歪一点」就是本风格的身份（`STYLE.md:18`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | hook **4 小节**；每个 step **≥ 3 小节**（由语音时长决定 `max(3, ceil((语音+1.6)/BAR))`）；最后一步 2 小节；payoff 3；tip 2；lockup 3；end 2 |
| 全片时长 | **40.00s**（3 步 = 22 小节；实测 `style.json dur=40.0`、`logs/midcentury-toon.log:26`） |
| 镜头数 | 段落表：hook → 3 个 step → payoff → tip → lockup → end；本次事件 **65** 条（`logs/midcentury-toon.log:26`） |
| 信息投放节拍 | **132 BPM**（1 拍 ≈ 0.4545s，1 小节 ≈ 1.818s）；卡点必须落在**半拍网格**上 |

- **加速 / 减速点**：**不靠改速度，靠「减半/加倍感觉」**（`STYLE.md:69`）。回报段加倍 + 升一个全音（把功能变成装饰的高光）；提示段减半换气；落版恢复正常。
- **留白与静音的位置**：三处静默（见第 6 节）就是三处节奏呼吸——尤其 **B 段（按按钮前）是真静音**，之后第一声就是这一步的动作声。落版段有 **≥3s 的完全静止**（「这一帧是拿来截图的」，`STYLE.md:61`；帧 f20/f21/f22）。
- **步数上限**：**2–5 步**；每步增加 ≥3 小节 = **5.45s**；**4 步 ≈ 45s**——要 ≤40s 就得砍提示或片尾卡（`DEMO.md:118`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/midcentury-toon/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/midcentury-toon/demo --fps 24 --workers 6 --size 1920x1080 --out styles/midcentury-toon/demo/out/video_gpu.mp4`（本次 960 帧） |
| 帧率 | **24 fps** 相机/虹膜/箭头/路线/光束；**12 fps（二拍）** 姿态、手形与套印抖动（`STYLE.md:40`） |
| 分辨率 / 比例 | 原生 **1920×1080（16:9）**；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:30`），由 `renderFilm` 首行的 `setFrame()`（`film.js:18`）按实际帧重排：世界层 + 贴世界内容的屏幕家什经 `dXf()` 等比装入（`film.js:20`、`film.js:836`）、字幕与全屏叠加贴当前帧（`film.js:98`）；16:9 时 `fx=fy=S=1` 逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh … 24 4`（**−14 LUFS / 轻颗粒 grain 4**，`logs/midcentury-toon.log:8`） |
| 编码器 | `h264_nvenc`（本地 GPU） |
| 音频入口 | `tools/lines.py content.json lines.json` → `core/tts/tts.py`（Kokoro am_michael）→ `asr_check.py` → `music/score.py` → `core/render/events.mjs` → `tools/cuecheck.py` → `mix.py` |
| 字幕入口 | `tools/cues.mjs` → `cues.json` → `core/render/srt.py`（**注意**：本次编排器未识别该生成器，见第 11 节） |
| 事件导出 | `node core/render/events.mjs styles/midcentury-toon/demo`（本次 events **65**、dur **40**，`logs/midcentury-toon.log:26`） |
| 本风格专属参数 | 混流末尾的 **`4`**（grain 4，**唯一带颗粒的风格之一**）；`--ratio 16:9`；`REG = {dx:6, dy:4, jit:1.6, on:true}` |
| 一键复现 | `sh styles/midcentury-toon/demo/build.sh`；换内容测试 `sh demo/build.sh stills` |

本次出片实测：渲染 960 帧耗时 **16s**、音频链 25.8s、混流总耗时 **43.2s**，成片 **32.1 MB**（`logs/midcentury-toon.log:70-89`）。`cuecheck.py` 在 demo 里找到 **0 个偏格**（`DEMO.md:55`）。

---

## 10. 编排规则

- **内容文件字段契约**（`content.json`）：`product`（1–12 字符）/ `kind` / `title`（≤36）/ `subtitle`（≤24）/ `hook.kicker`（≤14）+ `hook.line` / `steps[]`（**2–5** 项，每项 `title` ≤22、`detail` ≤30、`icon` 取 18 个枚举、`action` 取 `place`/`tap`/`press`/其他→`show`、`measure` 如 `"50 cm"`、`line` 一句短句）/ `payoff.caption`（≤40）+ `payoff.plan`（`y0,y1`、`dock[x,y]`、`zones[]`、`rug`、`items[]`，单位 1920×1080 平面像素）/ `tip.label/text/icon/line` / `outro.line` + `outro.cta`（≤48）/ `palette` / `voice` / `film`（`DEMO.md:112-131`）。
- **事件词汇表**：`creak` / `box_thump{pan,pitch}` / `box_fall` / `ding{gain}` / `pen_write{dur}` / `plastic_land` / `plastic_thock` / `wood_tick` / `wood_block` / `stamp{gain}` / `whoosh{dur}` / `slide{gain}` / `scrape{dur,gain}` / `pop{gain}` / `plug_click` / `flip` / `whistle{pan,up}` / `tap` / `beep{n}` / `btn_soft` / `hold{dur}` / `motor{dur}` / `click_big` / `zone{n}` / `dock` / `paper_swish{gain}` / `grab` / `peel{dur}` / `roll{dur}` / `iris{dur}` / `vo{id}`（`style-dna/midcentury-toon.md:217-238`）。
- **时间线契约**：`film.js` 必须导出 **`setup(content, durs)`**、**`DUR()`**、**`events()`**、**`srtCues()`**、**`renderFilm(ctx, t, Q)`**、**`section(t)`**。`setup` 从 content 的步数与语音时长重建整条时间线（**始终落在 132 BPM 网格**），生成配音表 `T.V`、字幕 `subs()` 与事件表 `EVS`。页面契约由 `main.js` 暴露 `window.DUR` / `window.EV` / `window.SRT` / `window.render(t)` / `window.READY`（`style-dna/midcentury-toon.md:208-210`）。
- **新增主体怎么接入**：主体通过引擎三模块画——`demo/engine/toon.js`（风格本体：`setClock(t)`、`shape(ctx,pts,o)` 画任意形状、`ink` 墨带、`plane` 无线地面、`text` 双色板文字、`fit`、`arrow`、装饰、全局套印 `REG`）、`demo/engine/chars.js`（`drawOwner` 主讲人、`drawHand` 四指手套、`drawPip` 产品）、`demo/engine/icons.js`（18 图标）。`film.js` 里可搬的 helper：`callout()` / `medallionAt()` / `tag()` / `stepHeader()` / `laneY()` + `buildPath()` 流场路线生成器 / 转场块（`STYLE.md:98`、`DEMO.md:153-171`）。
- **换主题时要改哪些文件**：**只改 `demo/content.json`**——每一个字、每一个数字、每一种颜色、配音与 payoff 平面图都在里面（`DEMO.md:90`）。改完跑 `sh demo/build.sh`（会重建 lines、配音 + whisper 校对、events、mix、字幕、视频）。**但配乐是按 22 小节写的**：步数一变长度就变，**必须重跑音乐子智能体**，否则音乐对不上（`DEMO.md:133`）。⚠️ `DEMO.md:149` 明确：换 content 只是「验证引擎能重排的技术检查」，**不是做片子的方式**。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里可生效的参数是 `palette`（`bg #F4EAD5` / `bg2 #E6D8BC` / `fg #2B2420` / `accent #AF3719` / `subtitle #2B2420` / `subtitleOutline #2B2420` / `subtitleBack #F4EAD5`）、`bgRecipe`（solid + texture paper + vignette 0.12）、`subtitle`（字体 `DengXian`、字号因子 0.037 ≈ 40px、下边距 0.145、描边因子 0.0022 ≈ 2.4px）、`title`（字号因子 0.082）、`overlay`（`chapterCards:true`）、`motion`（`subtitleFadeIn 0.15`、`chapterTransition cut`）与 `tags`（主题 教育/生活/教程/科普/家居，情绪 轻松/亲切，节奏 中，场景 步骤/教学/入门）。该条目 **`derived:false`**（手写条目，比另两个风格的派生条目更可信）：配色直接取自 `toon.js:10-17` 的具名调色板 `PAL`。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **本次出片的字幕没有重新生成（重要）**：日志明确打了两条警告——`! 该 demo 没有本编排器支持的字幕生成器 —— 字幕源不重新生成，.srt 将沿用仓库里已提交的旧文件`（`logs/midcentury-toon.log:29`），混流阶段再重复一次 `! 警告：本 demo 没有本次新生成的字幕源 —— .srt 沿用仓库里已提交的旧文件，未重新生成`（`logs/midcentury-toon.log:81`）。也就是说**成片里的字幕不是本次运行按 `content.json` 生成的**，而是仓库里已提交的旧 `.srt`。这是本风格最实在的缺陷：只要改了 content 里的台词，**字幕就会与旁白不一致**。
- **9:16 曾会丢画面（★ 2026-10-04 已修）**：原记「无 `aspects` 声明、按 1920×1080 绝对像素构图；产品默认 9:16 导出时右侧约 43.75% 丢失，常站在右侧的 June 会被整条切掉，上部的圆形特写也会被切，下方整片黑」。**2026-10-04** 已改造 `styles/midcentury-toon/demo/`：`film.js` 导出 `NATIVE` 并声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:30`），新增 `setFrame(W,H)` 派生 `FX/FY/S`（`film.js:18`）与 `dXf()`（`film.js:20`）；`renderFilm` 从实际帧重排（世界层 + 贴世界内容的屏幕家什走 `dXf`，`film.js:836`；字幕与全屏叠加贴当前帧，`film.js:98`、`film.js:882`）；`main.js` 的 canvas 跟随视口并把帧尺寸传给 `renderFilm`。**16:9 逐字节未变**（改造前后三帧静帧 md5 全等）；9:16 实测不裁切、字幕在框内（见第 2 节）。
- **「文案+风格」通路的字幕卡形态会丢**：`dub-styles.json#midcentury-toon` 的 `subtitle.fontFamily` 是 `DengXian`（本机无 Oleo Script / Alfa Slab One / Jost），字号 40px 与下边距 157px 与原生卡（Jost 500 **42px**、距底 **60px**、宽上限 1280px）不同；原生卡的**纸色圆角板 + 细墨边 + 两端珊瑚 8 角星 + 颜色赛璐璐套印偏移 5px** 在通路里不会出现。
- **混音峰值偏高**：`mix.wav peak 0.95`（`logs/midcentury-toon.log:74`），距削波不足 0.5 dB（最终由混流压到 Peak −1.5 dBFS）。成片真峰值实测 **−1.50 dBTP**（`loudnorm` `input_tp`，4× 过采样），在 −1.2 dBTP 交付线内、未削波——mix 的头部余量紧，但两遍 loudnorm 后安全落地。
- **动态范围偏大**：成片 **LRA 7.3 LU**（`logs/midcentury-toon.log:85`），明显大于同批其他风格（3.5 / 4.6 LU）——三处真静音把 LRA 拉开了，属设计使然，但在移动端小音量下可能显得忽大忽小。

### 素材缺口
- 无外部图片/视频素材缺口（全程序化）。真正缺的是**字体**：Oleo Script Bold、Alfa Slab One、Jost 三款若不在环境里，钩子手写体、标题板、正文与字幕卡会全部 fallback，风格识别度大幅下降。
- ~~缺 9:16 版场景布局参数（色面分区、主体站位、圆形特写排布），竖版必须重排~~（★ 2026-10-04 已修：竖版不再需要单独布局——世界层整体「等比装入」当前帧、字幕与全屏叠加贴当前帧，见第 2 / 11 节）。
- `payoff.plan` 需要人工画平面图（`zones[]` / `items[]` 用 1920×1080 平面像素标定）——**没有平面图就没有回报段**，这是内容侧最费工的素材。

### 能力限制
- **只做「怎么做」，不做「为什么」**：没有步骤可教的内容会让它无事可做（`STYLE.md:14`）。
- **步数 2–5，每步 +5.45s**：想做长内容只能加步数，而 4 步就已经 ≈45s，超出产品安装指南 30–40s 的舒适区（`DEMO.md:118`）。
- **静音窗口与配乐小节数不自动重排**：三处静默是在 `mix.py` 里用 `gate()` 按**绝对秒数**硬编码的（B: 20.909–21.80s 真静音；C: 30.2–30.905s 只留房间底噪），**换内容时不会跟着重排**；配乐也按 22 小节写死（`style-dna/midcentury-toon.md:240`、`DEMO.md:133`）。这是它与 lowpoly-island / microgame 不同的地方——**这两个都需要人工重跑音乐子智能体**。
- **关键主体必须 ≥1/3 画面高且避开底部 140px 字幕带**，限制了远景与全景的可用性（`STYLE.md:64`）。
- **纸色圆角牌的墨线边框 ASS 画不出来**：STYLE.md §4 声明的是「paper-coloured rounded slab **with a thin ink border**」，而那个**墨线边框** ASS 画不出来（`BorderStyle=3` 只有纯色填充、没有边框能力），属于已知能力缺口。

### 踩过的坑（本机实测）
- **一条忽略障碍的路线**会破风格——必须跟随产品的真实规则，流线要绕过障碍且永不相交，并且**一区一拍地画出来，不能一次画完**（`STYLE.md:88`）。
- **单独的鼻子楔子看起来像贴上去的**——要用一条从鼻梁绕过颅骨、在鼻尖闭合的**开放样条**（`STYLE.md:89`）。
- **细手臂从脖子伸出来像两根棍**——肩要在躯干转角处，袖子是一条粗墨带上面再压一条彩带（`STYLE.md:90`）。
- **胖团状手指把手变成一朵云**——必须先描每一部分的并集轮廓、再填色，手指细长并带分隔线（`STYLE.md:91`）。
- **放大世界会让墨线变成三倍粗**——特写要用**圆形 call-out 按原生比例另画**，不能靠 zoom（`STYLE.md:92`）。
- **过渡会提前把下一场景画出来**——必须把局部时间**夹到起点之后**（`STYLE.md:94`）。
- 英文配音用 `bm_george` 时 whisper 把 `dock` 听成 `dark`——英式元音会糊掉关键名词，最终改用 `am_michael` 0.94（`DEMO.md:56`）。

### 下次迭代优先补什么
- **修字幕通路**：给本 demo 补一个编排器能识别的字幕生成器（`tools/cues.mjs` 是 stdout 重定向写法，编排器未支持），或把 `cues.mjs` 的产物提交进仓库并明确版本——**这是目前唯一会让成片与 content 不一致的缺陷**。
- 给 `dub-styles.json#midcentury-toon` 补上**纸色圆角牌 + 细墨边 + 珊瑚 8 角星 + 套印偏移**这几件字幕卡特征，并把字体 fallback 到最接近 Jost 的几何无衬线。
- **（已完成 2026-10-04）** 9:16 适配：已给 `film.js` 补 `FILM_META.aspects = ['16:9','9:16']`（`film.js:30`）并由 `setFrame()` / `dXf()` 重排版面（`film.js:18`、`film.js:20`、`film.js:836`）。★ 声明落在影片模块 `film.js` 的 `FILM_META`，**不是 `style.json`**——探测方 `lib/aspects.mjs` 读的就是 `film.js` 源码文本。
- 把三处静音窗口与配乐小节数改为**从 content 推导**，消除「换内容后静音与音乐不重排」这个陷阱。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/midcentury-toon/midcentury-toon.mp4`（40.00s / 32.1MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/midcentury-toon/`（24 帧 + `_contact.jpg` 接触印样） |
| 风格匹配度自评 | **92/100**（2026-10-05 校正：原 91，9:16 画幅缺陷已修并回补 composition +1） |
| 详细资料 | 有：`styles/midcentury-toon/STYLE.md`、`DEMO.md`、`style.json`、`demo/build.sh`、`lib/style-dna/midcentury-toon.md`、`lib/style-dna/midcentury-toon.json`、`lib/dub-styles.json#midcentury-toon`、`_distill/logs/midcentury-toon.log` |

**逐帧拆解要点**：
- **构图怎么变**：f01 钩子——芥末黄空场、牛皮纸盒打开、绿松石 Pip 躺在盒里、June 在右侧张手，**无字幕**；f02/f03/f04 钩子揭示——Oleo Script 手写体 `Meet Pip.` 从左上滑入、背后 30 楔形放射光束 + 4 角原子星，Alfa Slab 标题 `Your New Robot Vacuum` + `SET UP IN 3 STEPS` 色板，底部字幕卡「Meet Pip, your new robot vacuum.」；f05–f08 第 1 步——灰蓝色面、`① Place the dock` 步骤头（墨色圆盘 + 白色数字 + 衬线标题）、June **跪姿**把充电座推向墙、圆形特写里先后出现「手按充电座」「50 cm / 50 cm 尺寸箭头 + 滑哨」「金色『2』勋章放大」（这就是穿过勋章的虹膜转场）；f09–f11 第 2 步——芥末黄面、`② Connect the app`、June 持手机、圆形特写里手机 UI 从红色加号点成 `Home` + 勾、标签「Home Wi-Fi, 2.4 GHz」、产品上方出现信号环；f12–f13 第 3 步——牛油果绿面 + 放射光束、**极近景**一根手指按下 Pip 的绿松石按钮、标签「Hold for one second」+ 座钟图标；f14 转场——粉色面 + 腰子形沙发 + 蓝地毯 + 绿松石按钮勋章（按钮 → 虹膜 → 顶视图）；f15/f16 **回报段**——顶视平面图，`Pip maps the room as it goes` 标签，LIVING ROOM / HALL / KITCHEN 三区，**沿墙环路 + 往复车道绕开家具 + 转角小卷曲 + 车道之间的星与点**，逐区画出，退后看像一块原子时代织物；f17/f18/f19 提示段——粉色面、`Pick up loose cables first.` 标题、June 跪姿伸手拎起线缆、左侧残留平面图；f20/f21/f22 落版——回到纸色底，`Meet Pip.` + `Your New Robot Vacuum` + `SET UP IN 3 STEPS`，**三枚编号勋章横向排开**（灰蓝充电座 / 芥末手机 / 牛油果开始键）各带标题与细节、之间有虚线箭头，下方缎带提示 + `Full manual: scan the code inside the lid` CTA + 右下角星芒里的圆码，字幕「Three steps. That's it.」；f23/f24 片尾卡——深色底上一个大纸色圆（虹膜收束），`Meet Pip` 手写体 + `MID-CENTURY CARTOON` + `Lemo-Opuscar` + `LemoLab × Claude Opus 5.5` + 字体/素材致谢 + 一颗绿松石圆点。
- **色怎么走**：**按场景轮换，不做全片推移**——芥末黄（钩子，f01–f04）→ 灰蓝（步骤 1，f05–f08）→ 芥末黄（步骤 2，f09–f11）→ 牛油果绿 + 放射光束（步骤 3，f12–f13）→ 粉（转场 + 提示，f14/f17–f19）→ 纸色（落版，f20–f22）→ 深色（片尾卡，f23/f24）。**产品绿松石 `#3FA7A0` 从 f01 到 f22 一色未变**，June 的珊瑚毛衣同样贯穿全片——这正是「产品全片一色到底、强调色是另一个色相」的视觉证据。
- **字幕什么时候出现**：字幕卡**从钩子段开始就一直在**，每段一行、底部居中、纸色圆角牌带细墨边与两端珊瑚小星：f03/f04「Meet Pip, your new robot vacuum.」、f05–f08「Step one. Set the dock against a wall.」、f09–f11「Step two. Open the app and add Pip.」、f12/f13「Step three. Press start.」、f17–f19「Tip: pick up loose cables first.」、f20–f22「Three steps. That's it.」。另有**细节标签**（小一号、贴圆形特写）：「50 cm clear on each side」「Home Wi-Fi, 2.4 GHz」「Hold for one second」。
- **转场**：**圆（虹膜/穿过勋章）是唯一主语法**——f08 圆形特写里金色「2」勋章放大即 f09 的开场（步骤切换）；f12 的按钮 → f14 的顶视图也是圆到圆；f23 片尾卡本身就是一个大圆（虹膜收束）。另有**色块擦除**（f16 → f17 的提示段是侧向翻页、f19 → f20 的落版是自下而上翻页）。**未见溶解、未见手持、未见空帧**。
- **瑕疵帧**：未发现糊帧、错位、字幕溢出或黑边。f08 圆形特写里的「2」勋章是转场中的间帧（正在放大），不是错位；f14 是转场的中间态（按钮勋章 + 沙发 + 地毯同框），刻意如此。

**自检发现的缺陷**：见第 11 节「已知缺陷」五条——**字幕未重新生成（沿用仓库旧 .srt）**、9:16 丢画面（★ 2026-10-04 已修：`FILM_META.aspects` + `setFrame()` / `dXf()`，见第 11 节）、「文案+风格」通路字幕卡形态丢失、混音峰值 0.95 偏高、LRA 7.3 LU 偏大。

**本次为补齐短板做了什么**：**未改动任何源码**（遵守红线）。本次仅做文档蒸馏；第 11 节已把「修字幕通路」「补字幕卡形态」「补 9:16 布局变体」「让静音与音乐从 content 推导」列为下次迭代的优先项。
