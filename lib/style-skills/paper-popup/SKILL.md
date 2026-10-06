---
name: lemo-style-paper-popup
description: 【lemo 风格 Skill · 纸片立体书】把真书桌上的一本立体书变成舞台：带米白边的扁平剪纸演员在从书页弹起的纸布景前表演，真实的台灯与真实的微距镜头把它拍得像真的。适合儿童故事、绘本改编、产品寓言的纸世界短片。选定本风格做视频时，优先读本文件。
slug: paper-popup
name_zh: 纸片立体书
category: 材质与 3D
film: Pip's Paper Adventure
---

# 纸片立体书（`paper-popup`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/paper-popup/STYLE.md` · `styles/paper-popup/DEMO.md` · `styles/paper-popup/style.json` ·
> `styles/paper-popup/demo/mux.sh` · `lib/style-dna/paper-popup.json` · `lib/style-dna/paper-popup.md` ·
> `lib/dub-styles.json#paper-popup` · demo 源码（`story.js`/`main.js`/`hud.js`/`paper.js`/`cutmesh.js`/`book.js`） ·
> **成片逐帧拆解**（见文末「蒸馏证据」）。注意：本 demo **没有** `build.sh`，构建链是 `DEMO.md:135-158` 的 7 步。

---

## 1. 风格说明

**是什么**：一个画面里**两个世界**。**真实世界**（人尺度）：HDRI 房间照亮的写实表面、几件真道具（台灯、茶杯、闹钟、铅笔、盆栽）、一支微距镜头（浅景深、暖实用光、软接触影）。**纸世界**：那房间里的一本精装书；打开时封面立起来当**背景**，下页是**地面**。每件布景是一片**扁平剪纸卡**，躺在书页上、绕它的底边**弹起**；角色也是剪纸——几厘米高、扁平、厚米白边、灰色卡纸边、纸纹（`STYLE.md:8`、`style-dna/paper-popup.md:24-33`）。

**不是什么**（最容易做错的邻居风格）：不是**剪纸剪影片**（没有单色蕾丝、没有背光）；不是 **3D 卡通**（画面里没有任何圆雕的东西，所有「3D」都是几片扁平卡）；不是**黏土动画**（纸是铰链、折、卷、滑，它从不被捏软）（`STYLE.md:12`）。

**什么时候用它**：内容能被「书」这个装置装下——一章一个跨页、一次翻页换一个场景、一个机关讲一个道理。适合儿童故事、绘本改编、游戏预告、产品寓言（`style.json#uses`：Children's books / Game trailers / Story films）。

**一句话内核**：卖点在**尺度和材料的错配**——扁平的、饱和的、描边的纸卡通，在真实的光照下投出剪纸形状的影子、在真实的镜头虚化里变软。保留纸的平面感，让光和镜头把它变真（`STYLE.md:16`）。

**边界**：这个风格**撑不起**——数据/图表内容（没有图表位，纸的语汇不等于信息图）；快节奏口播或长段论证（每句都得是图画书的一行，`style-dna/paper-popup.md:51-53`）；需要写实质感或真人情绪特写的题材（角色是几厘米的纸片，脸只有大椭圆眼和弯嘴）；抽象概念讲解（没有抽象名词的位置，一切必须能被画成一件能弹起的纸道具）。

---

## 2. 画面构图

- **镜头数与画幅**：单虚拟微距相机，一份新的关键帧列表 = 一个硬切；`DEMO.md:31-40` 记了 **8 个拍子**（建立 / 开书 / 书内 / 翻页 / 情绪近景 / 页边缘反向 / 飞出 / 结尾）。成片 **1920×1080（16:9）**、133.0s（`style.json:16-17`）。`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`（声明在 `demo/film.js`，**页面外壳等比装入**，见下）；抽帧就是 16:9，这是「风格原本长什么样」的权威证据。
- **主体位置与占比**：主体是**打开的跨页**。舞台坐标系是 `book.stage`：x ∈ [−0.22, 0.22]（左右）、z ∈ [0, 0.30]（书脊在远、读者在近）、y 从纸面向上；立起来的背景是 `book.sky`（`DEMO.md:163`）。跨页把画面横向切成「纸地面（下）+ 立起的背景天空（上）」，地平线通常在画面高度的 45%–55%（帧 f03/f06/f07）。角色 3–5 cm（Pip 高 0.036 m），在书内镜头里常只占画面高度 12%–20%（帧 f04/f05/f09）。
- **负空间 / 留白**：留白由**立起的背景页**承担——天空是成片的上半，往往只有渐变 + 几朵挂在线上的云（帧 f03/f06/f07）；地面页只在近景留出一点空草地。真实世界段（f01/f18/f19）反过来：大面积暗木桌面与虚化房间是留白，书只占中景一小块。
- **图层叠放顺序**（从底到顶）：HDRI 模糊房间背景 → 桌面与真道具 → 书（布面封面 / 书页块 / 地面页贴图 / 立起的背景页 / 卷曲的翻页条）→ 弹起卡（按 z 从远到近逐件弹起，远件向后躺、近件向前脸朝下折）→ 角色剪纸卡 → 近镜头的虚化前景道具 → 手工景深（CoC → 螺旋 gather）→ 轻 bloom → 暗角与暖 → HUD（字幕 / 气泡 / 章节横幅 / 动作词 / 片尾卡）。参考 `post.js`、`sets.js` 的 `updatePops`。
- **安全区**：英文字幕基线 y≈966px、中文基线 y≈1022px（`hud.js:20-26`：`y = 1080 − 70 − (lines−1)·48`，首行画在 `y−44`），即**贴底 70px 起**、≈6.5% 画面高。折行宽度 1720px（`hud.js:19`），左右各只剩 **100px** 边距——这是本风格构图里最紧的一条安全线。章节横幅挂在顶部居中（帧 f10/f14/f17），气泡挂在说话者头顶上方并带一条实时投影的尾巴（`hud.js:41-52`）。
- **本风格不能出现的构图**：书内**绝不能**用视频溶解（`STYLE.md:67`）；**不能让近镜头前景的弹起件挡住镜头路径**（会填满画面成一片模糊，`STYLE.md:95`）；不能有**矩形影子**（每张卡都要用 alpha-mapped depth material，让影子就是剪影，`STYLE.md:96`）；不能出现任何圆雕的、被光打出连续高光的物体（那就变成 3D 卡通）；不能在书内出现甩镜（`style-dna/paper-popup.md:119`）。

**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。改造**没有**逐处改写绘制点（本风格是 three.js 微距书台 + 手工景深 + bloom + Canvas HUD 的固定设计帧管线，`main.js` 的 `renderer.setSize(1920,1080)` 不跟视口走，逐处改必然静默错位），而是只改**一个页面外壳文件** `demo/index.html`：影片本体仍按**固定设计帧 1920×1080** 画（一字未改），当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧等比装入**（contain）并居中，留边露出页面底色 `#fffaf0`（本风格 palette 的 bg，**纸白**，与剪纸的白纸边同色）。声明在 `demo/film.js`（`FILM_META.aspects`，控制台按源码文本探测）。

- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform）；同参数跨进程与同会话往返（1920×1080 → 1080×1920 → 1920×1080）实测 **md5 逐字节相同**（本风格后处理确定，md5 判据可用）。
- **9:16 不裁切**：整幅 16:9 画面（含书台、弹起件、角色与**中英双语底部字幕**）**全部在画面内**（实测：改后 9:16 vs 16:9 中心裁切 SSIM 0.70/0.62/0.77，vs 理想等比装入 SSIM 0.9919/0.9887/0.9974）。
- **已知代价**：① 竖屏下有效画面只占 1080×608，**分辨率按紧轴缩放**，是「小图居中 + 大片留白」；本风格留边取纸白 `#fffaf0`，与画面里的白纸边同色、几乎无缝，观感像「一幅剪纸裱在米白卡纸上」；② **全屏层（暗角/暖调/HUD）留在设计框内**，上下留边无画面内容；③ 其它比例同理（3:4 / 4:3 / 1:1）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 墨线（唯一描边色） | `#3a2a24` 深棕（**绝不是黑**） | 所有剪纸的粗描边 9px + 细节线 5px、气泡描边 | `DEMO.md:70`、`paper.js:3` |
| 纸边（米白） | `#fffdf7` | 每片剪纸外扩的宽边 12–16px（道具 14px、角色 16px @5200 px/m） | `DEMO.md:68` |
| 卡纸边（灰） | `#b9ad9c` | 白边外那条略微下移 1.5px 的灰卡纸厚边 | `DEMO.md:68` |
| 弹起件背面 | `#efe8da`（门用 `#8a5a34`） | 每张卡背面的素纸色 | `DEMO.md:82` |
| 第 1 章 家乡谷 | 草 `#86c763`→`#9fd57a`；山 `#b5e39a` `#a9dd8c` `#8fd06e`（暗 `#6fb553`）；路 `#ecd49a`；天 `#7cc6ef`→`#c9ecf7` | 开书后的第一个跨页 | `DEMO.md:74` |
| 第 2 章 森林 | 地 `#4f8f46`→`#62a653`；后松 `#8cc9a0`；前松 `#3f9a5c`；天 `#a8e0cf` | 障碍角色出场的跨页 | `DEMO.md:75` |
| 第 3 章 海 | 浪（亮→暗）`#9ad8f5` `#79c3ee` `#58ade3` `#3f95d6` `#2f7fc4`；白天 `#4fb3ea`；夜 `#131d44`→`#4a5a94` | 白天→夜晚翻板就在这一跨页内完成 | `DEMO.md:76` |
| 最后一页 | 奶油纸 `#f5eedc` + 石墨线 `rgba(70,72,82,.45)` | 「未完成」页去掉全部彩色，只留铅笔稿 | `DEMO.md:77` |
| 强调色（跨跨页复用） | 蘑菇屋红 `#e8413a`、太阳 `#ffd766`、招牌金 `#ffcf3f`、缎带红 `#d8423a` | 把整本书缝在一起的几记强调 | `DEMO.md:79` |
| 书本体 | 布面 `#1f5566` + 烫金 `#e0b456`（metalness 贴图）+ 页口 `#efe6d2` | 封面 / 书脊 / 页块边线 | `DEMO.md:80` |
| 字幕 | 字 `#fffaf0` on 描边 `rgba(28,18,12,.78)` | 奶油字 + 深棕描边 + 柔和阴影 | `hud.js:22-23` |

- **明度 / 对比规则**：**一个跨页只允许一个主导色族**，所以翻页同时就是换色（`STYLE.md:27`）——谷是绿、林是深绿、海是蓝、最后一页是奶油、真实房间是暖木。真实世界永远「自然而略暖」，纸的颜色才能从背景里跳出来（`STYLE.md:26`）。着色只靠**一个硬月牙**（填暗色、偏移后重填底色），没有渐变阴影（`DEMO.md:70`）。
- **禁止出现的颜色**：霓虹色（`STYLE.md:26`）；纯黑（描边一律 `#3a2a24`，`STYLE.md:18`）；任何渐变软阴影色块；ACES 位移过的纸色（必须用 Neutral tone mapping，`STYLE.md:98`）。
- **同一画面最多几个色相**：纸世界跨页 **3 个**（一个主导色族 + 一记强调 + 墨/纸的中性色）；真实世界段 **2 个**（暖木棕 + 台灯橙）；「未完成页」只允许 **1 个**（奶油 + 石墨）。

---

## 4. 转场规则

- **镜头之间怎么切**：转场**必须来自书本身**——翻页、书合上再打开、落在纸声上的硬切（`STYLE.md:67`、`style-dna/paper-popup.md:117`）。镜头层面是「一份新的关键帧列表 = 一个硬切」（`DEMO.md:29`）。样片三次翻页写死在 `story.js:49` 的 `TURNS = [[48.6,51.4],[71.6,74.4],[86.8,89.6]]`，开书写在 `story.js:48` 的 `OPEN = [10.0,12.6]`。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**书内没有溶解、没有叠化、没有闪白**（`STYLE.md:67`）。唯一的「软」转场是**翻页本身**：一张 40 段的条带沿长度积分弯曲，正面是旧地面、背面是新天空，`φ = θ·(1 − L·(s − ½))`、弯 `L = .55·sin(πu)`、用 `eio` 缓动 **2.3s**（`DEMO.md:50`、`book.js:104-120`）。旧件折下与新件弹上是**同时**发生的，没有空帧。
- **硬切点怎么定**：切点挂在**画面事件**上——一次翻页的落点、一次弹起的收尾、一次台灯开关、一次跳。抽帧里可核到的切点锚：10.0–12.6s 开书（f03 已在书内）、51.6s 第 2 章横幅（f10）、74.6s 第 3 章横幅（f14）、89.9s 最终章横幅（f17）、123.4s 片尾卡（f23/f24）。
- **转场时长与缓动**：翻页 2.3s（`eio`）；弹起 `back(seg(t, t0, t0+.55), 1.7)`——**0.55s 带过冲**（`DEMO.md:46`）；每件弹起的延迟是 `(.3 − z) × 1.2` 秒，所以**从后到前依次弹起**、折下时同序（`STYLE.md:44`）；章节横幅是一块**吊在两根绳上的卡纸招牌**，荡下来（`DEMO.md:89`）。
- **绝对不要的转场**：书内的视频溶解（`STYLE.md:67`）；甩镜 / whip pan（`style-dna/paper-popup.md:119`）；任何 UI 式的淡入淡出或滑动；把转场做成「两个镜头之间留一段空」——纸的转场必须**用纸的动作交叠**。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | 英文 **Fredoka 500**（字幕）/ Fredoka 600（气泡）；中文 **ZCOOL KuaiLe**（OFL，须子集化并把拉丁字体放进 font stack）；标题与章节用 **Lilita One**；衬线标语用 **IM Fell English**（`DEMO.md:84`） |
| 字号（相对画面宽 / 高） | 英文 **40px**（@1920 宽 = **2.08% 画面宽**；@1080 高 = 3.70% 画面高）；中文 **32px**；气泡英文 46px；章节标题 84px；片尾标题 96px（`hud.js:19,26,39`、`DEMO.md:87-90`） |
| 颜色 / 描边 / 阴影 | 字 `#fffaf0` 奶油；描边 `rgba(28,18,12,.78)` 深棕，英文线宽 8px、中文 7px、圆接头；阴影 `rgba(0,0,0,.35)` blur 16（`hud.js:22-23`） |
| 位置 / 安全边距 | 底部居中，英文基线 y≈966px、中文基线 y≈1022px，即**距底 70px**（≈6.5% 画面高）；折行宽度 **1720px**（左右各 100px）（`hud.js:19-26`） |
| 单行字数上限 / 最多行数 | 英文按 1720px 折行，实测多为 1 行（最长 v05 单行 108 字符、会折成 2 行）；中文恒为 1 行在英文下方，所以**视觉上是 2 行**（英上中下）（`story.js:5-21`） |
| 出现与消失方式 | 淡入 0.3s（`t0−0.15 → t0+0.15`）、淡出 0.3s（`t0+d+0.25 → t0+d+0.55`），即**停留到语音结束后 0.25s**（`hud.js:16`、`DEMO.md:87`）；气泡是 `back(…, 2.2)` **过冲弹入** 0.22s、打字 30 字符/秒、隔一个字母一个 blip、右下角一个上下晃的红色「next」三角（`hud.js:36-38`、`DEMO.md:88`） |

- **字幕与旁白的关系**：字幕是**说书人的那句话**（第三人称、图画书句），不是口播稿；气泡是**角色的第一人称短句**，两者**绝不重复**——同一批字不做两遍（`style-dna/paper-popup.md:54`）。停留规则 ≥ `max(1.8s, 语音时长 + 0.6s)`（`STYLE.md:36`）。发音文本与显示文本分离：发音版放 `tts/lines.json`（例：`Swish Swash Sea` 去掉连字符），显示版放 `story.js` 的 `VO`（`DEMO.md:55`）。
- **本风格特有的字幕禁忌**：不许把气泡里的字再做一遍字幕；不许长句与从句（每句都得像图画书的一行）；不许抽象名词与说教；不许混用发音文本与显示文本；中文字体子集漏字或漏拉丁字形必须重新子集化（`STYLE.md:101`）。**另有一条本次实测的读性问题**：字幕压在真实世界的亮虚化背景上时（帧 f18/f19 的台灯散景）奶油字 + 深棕描边几乎读不出来，见第 11 节。
- **「文案 + 风格」通路的参数**（`lib/dub-styles.json#paper-popup`，`derived:true`）：`subtitle.fontFamily = SimSun`（本机无 Fredoka 时的退路）、`fontSizeFactor 0.03704`（≈40px @1080）、`marginVFactor 0.14537`、`marginLFactor 0.06019`、`outlineFactor 0.00546`、`align 2`（底部居中）、`motion.subtitleFadeIn 0.12`、`motion.chapterTransition "cut"`、`overlay.chapterCards true`；`palette` 取 bg `#fffaf0` / fg `#3a2a24` / accent `#866700` / subtitle `#3a2a24` + 白描边——这是「亮底深字」的 WCAG 推导结果，**不是**成片里那条奶油字 + 深棕描边的口径，走 dub 通路时要心里有数。

---

## 6. BGM / 音效特征

- **配乐**：玩闹的、原声或玩具般的音色——音乐盒、拨弦弦乐、单簧管、钟琴、尤克里里、玩具钢琴、刷子（`STYLE.md:74`）。样片用三段 Kevin MacLeod（CC BY 4.0）在 `music/edit.py` 里剪：`Dreamy Flashback`（0–16.2s，1.6s 淡出）给真实书桌；`Jaunty Gumption` 从 15.4s 起给整个纸世界，并在 **73.21s → 102.79s** 处做**一小节对齐的内部跳剪**（0.42s 交叉淡化，由 `music/jump.py`/`jump2.py` 用节拍同步 chroma + MFCC 自相似搜出、切长取 4 拍的整数倍），让这首歌**真正的结尾落在 104.22s**——正是 Pip 跳出书页的那一瞬；`Heartwarming` 从它的 39.38s 处、×1.15 起给真实世界与片尾卡（`DEMO.md:57`）。
- **拟音（foley）清单**：**纸 foley 是招牌**——翻页 swish、卡纸 thump、弹起 snap（短正弦扫频 + crinkle）、折与皱、拉杆 slide、脚步是小 tap + crinkle、板条 flap、落线 tink，外加书脊吱呀与合上闷响。**全部由 `events.json` 里的 250 条事件在 `mix.py` 里合成**（`DEMO.md:58`、`style-dna/paper-popup.md:150`）。角色声音 = **打字 blip**：Pip 方波亮音（C6 附近）、Crumple 低 180–240 Hz、Fold 三角波（`DEMO.md:56`）。环境床按跨页换：房间底噪 + 闹钟滴答、山谷的鸟 + 河、黄昏的蟋蟀、森林的鸟 + 叶响、海边的浪（`DEMO.md:59`）。
- **旁白处理**：一个温暖的说书人，Kokoro `af_bella`、speed 0.9、en-us、15 句（2–9s），按 1% 峰值裁静音（+10ms 头、+100ms 尾），每句都用 whisper 校对（`DEMO.md:55`）。混音链：人声高通 90 Hz → 压缩（−24 dB、3:1）→ 限幅 → 在语音区**比音乐高 8.5 dB**；音乐在语音下 **duck 40%**（300ms 平滑）；人声 7% 混响；SFX **逐通道**限到 0.5；环境床 ×2；归一化到 0.89 峰值，再由 `mux.sh` 做 `loudnorm I=−14 TP=−1.2 LRA=11`（`DEMO.md:60`）。⚠ **坑**：把立体声（N×2）数组喂给一维限幅器会静默把所有 SFX 压到 −96 dB，必须**逐通道**限（`DEMO.md:104`）。
- **响度目标**：`−14 LUFS`；**真峰值上限**：`−1.2 dBTP`（`core/render/mux.sh` 内部先把 loudnorm 的 TP 钉到 `LN_TP=−1.7`，给 AAC 编码过冲留 0.5 dB 余量）。
- **本次交付实测（音频修复后）**：`demo/mix.wav` = 51,072,088 B / pcm_f32le / 48 kHz 立体声 / 133.000s / md5 `d585e92aae33b287fed1f889cb2aa2b1`，实测 **`I = −13.91 LUFS`、真峰值 `−1.00 dBFS`、LRA 9.40 LU**；经 `core/render/mux.sh` 归一后的成片实测 **`I = −14.34 LUFS`、真峰值 `input_tp = −2.33 dBTP`、LRA 7.6 LU** —— **响度与真峰值双双达标**（`−14` 命中、`−2.33 ≤ −1.2`）。
- ★ **真峰值判据（别搞错）**：必须读 `loudnorm` 的 **`input_tp`**（4× 过采样真峰值），**不要**读 `astats` 的 `Peak level dB`（那是**采样峰值**，会低报，团队先前用混过、误判过两个风格）。
- ★ **仍存在的机制性风险**：`mix.wav` 到片时真峰值 **−1.00 dBFS**，本身已在 loudnorm 的 TP 目标（`−1.7`）**之上 0.7 dB**，全靠 loudnorm 的动态模式把峰压下来；本片落在 −2.33 dBTP，离 `−1.2` 上限还有 **1.13 dB** 余量。同一机制在队里别的风格上**已经真的削波**（团队实测：`pictogram-motion` **+0.28 dBTP**、`game-show` **−0.22 dBTP**，现有 6 个风格最高到 `halftone-dossier` **+0.434**）。
- ★ **不要用「手工预压限」腾余量**：团队实测反而更差（原 mix.wav +0.248 → 预压 TP=−2.0 变 +0.445 → 预压 TP=−4.2 变 **+0.879**）——因为 loudnorm 总会把响度拉回 −14，真正起作用的是**波峰因数**；正解在 `mux.sh` 的 `LN_TP` 余量（核心共享文件，未擅改）。
- **静音策略**：静默不是「关掉声音」，而是**书被按住不动、只剩房间底噪**——放在一次要紧的翻页之前，或一次犹豫（`STYLE.md:76`、`style-dna/paper-popup.md:93`）。

---

## 7. 素材偏好

- **需要什么素材**：真实世界那半边需要 **HDRI 环境**（样片用 `lythwood_lounge_2k.hdr`，模糊度 .22、yaw 2.3）与几件 **CC0 道具**（台灯、茶杯、闹钟、铅笔、盆栽，Poly Haven），加一张真木或织物贴图（胡桃木饰面 `#c9a88a`、env .8）；字体四套全 OFL（Fredoka 500/600/700、Lilita One、IM Fell English、ZCOOL KuaiLe）；音乐三段 CC BY（`DEMO.md:57,66,84`）。
- **不需要什么素材**：**不需要任何照片、实拍视频、矢量素材包、贴图集**——纸世界的一切（每一片剪纸、每一张页面美术、每一个角色、每一件道具、书本身）都是代码生成的：Canvas2D 画 + `finishCut` 收尾 + three.js 组装（`STYLE.md:105`、`DEMO.md:114-131`）。也**不需要**任何现成的立体书扫描或参考书的图样，更不许在片子里点名参考对象（`STYLE.md:4`）。
- **取景 / 质感 / 比例偏好**：**真实单位（米）**——书页 0.44 × 0.30、页块高 0.0175、Pip 高 0.036、Crumple 0.042、纸飞机长 0.052、鲸宽 0.10、船 0.062、山 0.2–0.26 宽、树 0.05–0.16 高、相机近平面 **0.004**（`DEMO.md:64`）。**比例偏好 16:9**（`FILM_META.aspects` 另支持 9:16 / 3:4 / 4:3 / 1:1，见第 2 节）。质感来自三件套：外扩的**米白边 + 灰卡纸边**、共享的**纸纤维纹理**（512px、alpha .5–.85、`source-atop`）、以及**月牙硬阴影**（`DEMO.md:68-70`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有 HDRI 就用**任何暖色环境光 + 一张模糊的暖背景图**，但**必须保留**「真实房间比纸世界更暖更虚」这条对比，否则两个世界的错配就没了；没有真木桌面就用**纯色暖木 + 程序化纹理**，但**不能**改成冷灰或白色桌面；没有 Poly Haven 道具就用**程序化的铅笔 / 简化的杯子**（样片的铅笔本来就是程序化的），但**不能**换成写实的玻璃或金属反光物（会立刻破掉「纸 + 真实灯光」的统一）；没有三段 CC BY 曲子就用任何**玩具感 / 音乐盒质感**的库存或合成曲，但**不能**换成钢琴 + 弦乐组或电子鼓。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 8 个拍子（`DEMO.md:31-40`）；建立段约 10s 是唯一的长镜，书内段落多为 3–6s，情绪近景与反向镜头更短 |
| 全片时长 | **133.0s**（`style.json:16-17`：`dur 133.0`、`frame_sec 26.6`）；样片 7980 帧 @60fps |
| 镜头数 | 8 个拍子（相机关键帧列表数，每个列表 = 一个硬切） |
| 信息投放节拍 | 旁白 15 句 + 气泡 6 条 + 章节横幅 4 块，全部写死在 `story.js`（`story.js:5-38`）；章与章之间是一次翻页 |

- **相机词汇与参数**（`DEMO.md:29-42`）：一台虚拟微距相机，关键帧 `[t, pos xyz, target xyz, fov, aperture, focus]`，用**单调三次插值**（`track`，Fritsch–Carlson，`lib.js:18-42`）。默认 **fov 30**；书内是**平视**、相机在纸面上方 5–10 cm、后方 30–45 cm、**光圈 2.2–2.5**（浅）；翻页时**拉起成跨页 3/4 视角**、光圈收到 1.8–2（更深，让翻页读得出来）；情绪近景**推到 28 cm**；唯一的**反向镜头**用 **fov 56、对焦 11 cm** 从书内看向虚化的房间与巨大的台灯；飞出后切到 **1 m、fov 32** 的桌面正面，再降到 Pip 的高度（**光圈 4、对焦 ≈0.52 m**）。景深是手工做的：`CoC = aperture × (1/focus − 1/z)`，最大 **14px**、**64 抽**黄金角螺旋 gather（`post.js`、`DEMO.md:42`）。
- **加速 / 减速点**：**开书 10.0–12.6s** 与**三次翻页**（48.6/71.6/86.8 起，各 2.8s）是全片最密的动作窗口；**每一章的跨页内部**反而是慢的——抽帧 f06/f07/f08 三张（≈30.5s / 36.1s / 41.6s）都是同一个谷地跨页的宽景，中间只做了缓慢的横移，说明书内段落是**长停留 + 微动**（`DEMO.md:35`）。减速点是**飞出之后的真实桌面段**（f18–f22，≈97–119s），镜头几乎静止、只有景深在变。
- **留白与静音的位置**：静默（书按住不动 + 只剩房间底噪）放在要紧的翻页之前或一次犹豫（`STYLE.md:76`）；成片里可核到的「不动」段是 **建立镜头**（f01，≈2.8s，暗桌面 + 一本没被翻开的书）与 **落地后的真实桌面**（f20–f22）。**注意**：本片「不动」是设计意图，不是节奏失误——这个风格的房间**永远不动**（`STYLE.md:49`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。⚠ 本 demo **没有** `build.sh`；构建链是 `DEMO.md:135-158` 的 7 步（fonts → voice → 校对 → 时间线 → 配乐 → 事件 + 混音 → 渲染 → 混流 + 字幕）。

| 项 | 值 |
|---|---|
| 流水线入口 | `node lemo-make.mjs paper-popup --ratio 16:9`（首版实跑带 `--skip-sync --no-preflight --skip-audio`；**音频修复后去掉 `--skip-audio`、重跑音频链并重新混流**，视频轨未重渲） |
| 渲染入口 | `node core/render/video.mjs styles/paper-popup/demo --fps 24 --workers 6 --size 1920x1080 --out …/video_gpu.mp4`（本次实测 3192 帧 / 6 workers / **130s**） |
| 帧率 | 本次成片 **24 fps**（**风格原生是 60 fps**「on ones」，`STYLE.md:43`；原生输出 7980 帧） |
| 分辨率 / 比例 | **1920×1080 / 16:9**；`FILM_META.aspects` 支持 16:9 / 9:16 / 3:4 / 4:3 / 1:1（页面外壳等比装入，见第 2 节） |
| 混流 | 本次走 **`sh core/render/mux.sh <video> <mix.wav> <out.mp4> 24 2`**（WSL 侧、`LEMO_VENC=h264_nvenc`、`cq 23`、**颗粒默认 2**）；demo 自带的 `mux.sh` **未被使用**（接口不是 `V A O [fps] [grain]`，编排器回退） |
| 编码器 | **`h264_nvenc`**（本地 GPU，`-preset p5 -profile high -rc vbr -cq 23`）；demo 自带 `mux.sh` 用的是 `libx264 -preset slow -crf 17 -r 60` |
| 音频入口 | `python demo/tts/gen.py af_bella`（→ `voices/v01..v15.wav` + `dur.json`；单句重跑 `gen1.py v04 v07`）→ `python demo/asr.py` / `words.py`（whisper 校对 + 词级时间戳）→ `python demo/music/edit.py`（→ `music/score.wav`，48 kHz 立体声 133.000s）→ `python demo/mix.py`（→ `mix.wav`）。**音频链已修好并实跑**（15 条配音 + 3 首 CC BY 4.0 曲 + 250 条事件 foley）；⚠ `mix.py:196,202` 已由 `np.convolve` 改为 `scipy.signal.fftconvolve`（直卷 6384000×14400 实测 30+ 分钟不结束，改后 **<75 秒**且输出**逐位相同**），回滚备份在 `D:/tmp/mix.py.orig` |
| 字幕入口 | `node demo/make_srt.mjs`（→ `../paper-popup.srt`，双语：英文一行 + 中文一行）。**本次编排器未重新生成字幕源**（该 demo 没有编排器支持的生成器），`.srt` 沿用仓库里已提交的旧文件 |
| 事件导出 | `node core/render/events.mjs styles/paper-popup/demo` → **250 条事件 / dur 133**（本次实测） |
| 本风格专属参数 | 页面契约 `window.READY` / `window.render(t)`（逐帧确定）/ `window.DUR` / `window.EV`（`main.js:442,448,553`）；`render.mjs stills <t…>` 出剧照；`shot.mjs page.html out.png` 截图任意页（`sheet.html` = 角色与道具模型表）；`probe.mjs '<js expr>'` 在场景里求值（`window.DBG` 暴露 pip/boat/fold/whale/book/cam）；`gltest.mjs` 测 GPU flag |
| 一键复现 | **无 `build.sh`**；按 `DEMO.md:135-158` 的 7 步顺序跑，或直接 `node lemo-make.mjs paper-popup --ratio 16:9` |

---

## 10. 编排规则

- **内容文件字段契约**：**`story.js` 是时间线的唯一真值**——`DUR`（总时长秒，demo 133.0）、`VO[]`（旁白 `[id, 起, 英文, 中文]`，15 条）、`BUB[]`（气泡 `[谁, 起, 止, 英文, 中文]`，6 条）、`CHAPTERS[]`（`[起, 止, 英文标签, 英文标题, 中文标题]`，4 章）、`CREDITS[]`、`TITLE_CN`、`OPEN`（开书窗口）、`TURNS[]`（翻页窗口）（`story.js:1-49`）。配套：`voices/dur.json`（每句实测时长，`VO` 的起点必须按它排）、`tts/lines.json`（**发音版**文本，与显示版分离）。
- **事件词汇表**（本次导出 **250** 条，`type` → `mix.py` 的 `G` 表逐类增益）：`creak`（书脊吱呀）/ `thump`（合上闷响）/ `pop`（弹起 snap）/ `swish`（翻页）/ `door`（门吱呀）/ `boing` / `hop` / `roll` / `footstep`（小 tap + crinkle）/ `bang`（「!」）/ `stomp` / `nice` / `great`（arpeggio）/ `sparkle`（铃）/ `poof` / `fold` / `whoosh` / `splash` / `spout`（鲸喷）/ `clack`（板条）/ `tink`（星落线）/ `switch`（台灯）/ `chord`（暖和弦）/ `skid`（落地滑）（`style-dna/paper-popup.md:204-227`）。加一个新 type 就在 `mix.py` 里加一个分支。
- **时间线契约**：页面暴露 `window.READY`（资源就绪）、`window.render(t)`（**逐帧确定**，同一个 t 永远给同一帧）、`window.DUR`、`window.EV = [{t, type, …}]`；`render.mjs events` 把 `EV` 导出成 `events.json` 喂给 `mix.py`（`DEMO.md:177`）。**这条「纯函数」性质是本风格能换主题的根**：换一套 `story.js` + `sets.js` + `art.js` 重跑即可，引擎不动（`style-dna/paper-popup.md:243`）。
- **新增主体怎么接入**：(1) **新增一个跨页** = 在 `sets.js` 的 `pages()` 里加页面美术（2048×1396，`gx(x)`/`gz(z)` 把米映射到像素）+ 一块 `popper` 调用（新 spread 索引）+ 扩展 `RISE/FOLD/TURNS`；(2) **新增一个角色** = 在 `art.js` 里画（`cut(wm,hm,draw,…)` 返回 `{c,w,h,ax,ay}`）+ 在 `actors.js` 里加一个 `makeX`（返回 `{root, pose(p), …}`，`p = {walk,stride,armL,armR,flap,eyes,mouth,look,blink,lean}`）；(3) **所有弹起件一律走** `cutMesh(item, {s, backCol, shadow, tex})`（`cutmesh.js:18-26`、`DEMO.md:172-173`）。
- **换主题时要改哪些文件**：**改 4 组**——(1) `story.js`（`DUR`/`VO`/`BUB`/`CHAPTERS`/`CREDITS`/`OPEN`/`TURNS`）+ `tts/lines.json`；(2) `sets.js` 的 `pages()` 与 `buildSets` 的 `popper` 块（新跨页的美术与弹起件、`RISE/FOLD/TURNS`）；(3) `art.js` 里要重画的道具与角色；(4) `main.js` 里的 `pipState`/`crumpleState` 一类编排、相机关键帧表 `SH` 与 `lightsAt(t)`。**`book.js` / `paper.js` / `cutmesh.js` / `post.js` / `lib.js` / `render.mjs` / `mix.py` 不需要动**——这是本风格最关键的复用机制：**换故事、跨页、角色与镜头，工艺层与引擎不变**（`DEMO.md:229`）。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里是 `derived:true`（不是逐行手抽，而是从 `lib/dub-visual.json` 的 palette + `STYLE.md §4` 的字幕 px 值 + WCAG 对比度规则推得）。**能生效的参数**：`palette`（bg `#fffaf0` / bg2 `#cfc8ba` / fg `#3a2a24` / accent `#866700` / subtitle `#3a2a24` / subtitleOutline `#FFFFFF`）、`bgRecipe`（type `gradient`、stops `["#fffaf0","#cfc8ba"]`、texture `paper`、vignette 0.08）、`subtitle`（fontFamily `SimSun`、fontSizeFactor 0.03704、marginVFactor 0.14537、marginLFactor 0.06019、outlineFactor 0.00546、bold false、align 2）、`title`（fontSizeFactor 0.09、showRole false）、`overlay`（chapterCards **true**、lowerThird false、accentRule false、progressBar false）、`motion`（subtitleFadeIn 0.12、chapterTransition **cut**）。⚠ 该条目的 `notes` 自己声明这是**派生值**，并建议「知识库更新时优先用代码抽取值替换」——`bgRecipe` 的渐变底色（`#fffaf0`→`#cfc8ba`）与成片里「暖木桌 + 纸跨页」的实际底色并不对应，走 dub 通路时要按主题重设底色。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **编码余量机制性不足（当前最硬的一条）**：`mix.wav` 的真峰值是 **−1.00 dBFS**，而 `core/render/mux.sh` 的 loudnorm 目标是 **`LN_TP=−1.7`** —— 素材本身比目标高 **0.7 dB**，全靠 loudnorm 的动态模式把峰压下来。本片最终落在 **−2.33 dBTP**，虽然达标，但离 `−1.2 dBTP` 交付上限还有 **1.13 dB** 余量。这个机制在队里别的风格上**已经真的削波**（团队实测：`pictogram-motion` **+0.28 dBTP**、`game-show` **−0.22 dBTP**，现有 6 个风格最高到 `halftone-dossier` **+0.434**）。★ **不要用手工预压限来腾余量**：团队实测反而更差（原 mix.wav +0.248 → 预压 TP=−2.0 变 +0.445 → 预压 TP=−4.2 变 **+0.879**）——loudnorm 总会把响度拉回 −14，真正起作用的是**波峰因数**；正解在 `mux.sh` 的 `LN_TP`（核心共享文件，未擅改）。`_distill.json` 的 `audio` 项因此扣 2 分。
- **【历史根因 · 已修复】首版成片音轨曾是数字静音**：第一版出片带 `--skip-audio`，整条音频链被跳过，`core/render/mux.sh` 打印 `warning: the audio is silent or quieter than -70 LUFS, so loudness normalisation was skipped`（日志 `I: -70.0 LUFS / LRA: 0.0 LU / Peak: -inf dBFS`），我复核成片实测 mean/max 均 **−91.0 dB**。根因链是「`--skip-audio` → 一条静音占位轨被照常混入 → mux 跳过 loudnorm → 出片**有声轨但无声**」。**已由 `fix-paperpopup-audio` 修好**：去掉 `--skip-audio`、修 `mix.py` 的卷积、重新混流出新片（视频轨未动），现成片实测 `I = −14.04 LUFS / −1.65 dBTP`（**原记** 2026-10-03 读数；当前入库成片实测 `I = −14.34 LUFS / −2.33 dBTP`）。这条保留下来是因为它是个**通用的验收陷阱**：有音轨 ≠ 有声音。
- **帧率只有 24fps，不是风格原生的 60fps「on ones」**：`STYLE.md:43` 明确「On ones（60 fps 适合平滑的微距相机）」，样片是 7980 帧；本次成片经 ffprobe 实测 `r_frame_rate=24/1`、3192 帧。后果是弹起（0.55s）只剩约 13 帧、`back()` 过冲与 `spring()` 的收尾采样变粗，微距慢移的顺滑度低于声明值。`_distill.json` 的 `rhythm` 项因此扣 4 分。
- **字幕压在亮虚化背景上读不出来**：帧 f18（≈97.0s，v11）与 f19（≈102.4s，「Here goes!」气泡）里，真实世界的台灯散景接近白/琥珀色，而字幕是奶油 `#fffaf0` 填色 + `rgba(28,18,12,.78)` 描边（`hud.js:22`）——奶油字与亮散景的明度太近，只剩描边在撑，**该处字幕几乎不可读**（f18 还叠加了淡入中的半透明）。这是本风格把字幕做成「奶油 + 深棕描边」后必然要面对的边界情况。
- **折行宽度 1720px 对 1920px 画幅太满**：`hud.js:19` 的 `wrap(x, en, 1720)` 只给左右各 100px 边距，最长的英文行（v05 108 字符）几乎顶到画框（帧 f01/f05/f08）。这不是错的，但它把 9:16 下的损失放大到了「右半整段被切」。
- **近镜头前景的虚化道具反复占据画面下缘**：帧 f04/f05/f06/f07/f08/f11/f13 的下缘都有一块大而糊的绿色剪纸（花 / 灌木 / 蕨），这是 `DEMO.md:103` 自己记下的坑（「forest ferns and a bush at 20.9 s filled the frame near the lens」）。它按风格是**故意的浅景深**，但占比偏大时会吃掉近三分之一的画面，`composition` 项因此扣 2 分。

### 素材缺口
- **真实世界那半边全靠外部素材**：HDRI（`lythwood_lounge_2k.hdr`）与五件 CC0 道具（台灯、茶杯、闹钟、铅笔、盆栽）来自 Poly Haven，**换主题就要换一整套桌面**，且 `DEMO.md:107` 记了 `Poly Haven` 的 API 对 Python `urllib` 返回 403、必须用 `curl` 下载。
- **四套 OFL 字体与三段 CC BY 音乐都是外部依赖**：Fredoka / Lilita One / IM Fell English / ZCOOL KuaiLe 由 `fetch_fonts.mjs` 下载到 `demo/fonts/`；中文子集**只含下载那一刻源码里出现过的字**（`DEMO.md:108`）——**改任何中文文案都必须重跑 `fetch_fonts.mjs`**，否则缺字。ZCOOL KuaiLe 的子集没有拉丁字形，中文行里的英文必须靠 `'"ZCOOL KuaiLe", Fredoka'` 的 font stack 兜底。
- **音乐是三首固定的 CC BY 4.0 曲（是工作流依赖，不是版权障碍）**：`Dreamy Flashback` / `Jaunty Gumption` / `Heartwarming`，作者 **Kevin MacLeod**（incompetech.com），**署名即可用**，已与 `story.js:42` 的 `CREDITS` 一致；三份 mp3 的 ID3 我核过（artist 均为 Kevin MacLeod），并已转成 48 kHz / pcm_s16le / 立体声 WAV 落在 `demo/music/`。换主题时的真实成本是**重跑 `music/jump.py` / `jump2.py` 的小节对齐跳剪搜索**（节拍同步 chroma + MFCC 自相似，切长取 4 拍的整数倍），让原曲的真实结尾落在你要的那一帧上。

### 能力限制
- **多比例已支持（页面外壳等比装入）**：`FILM_META.aspects` 含 16:9 / 9:16 / 3:4 / 4:3 / 1:1；竖屏靠「设计帧等比装入」实现（整幅 16:9 画面不裁切地缩进竖屏，中英字幕与片尾卡都在），**不是**原生竖版构图——若要「让字幕按可见宽度自适应折行、把横幅与气泡收进竖屏」的原生方案，仍需**另做版式**（见「下次迭代优先补什么」）。
- **角色表现力有上限**：脸只有大黑椭圆眼 + 两个白高光 + 弯嘴 + 粉脸颊，表情靠 `eyes`（open/happy/wide/closed/dizzy）与 `mouth`（smile/open/o/grin/worried/determined）的**量化换片**，做不了细腻情绪特写（`DEMO.md:48,70`）。
- **转身只能翻面**：`rotation.y` 会让卡片侧面朝上、露出空白背面，所以转身一律用 `scale.x` 翻转、并在正/背两套画之间切（`STYLE.md:93`）；负缩放还会交换前后材质，镜像道具必须**另画一张**。
- **纸的「3D」全靠叠卡**：任何看起来有体积的东西都是几片扁平卡（前后层、铰在龙骨上的三角），做不了真正旋转的立体物（`STYLE.md:19`）。
- **前景弹起件不能挡镜头**：近镜头的弹起件会填满画面成一片模糊，只能移开或收小光圈（`STYLE.md:95`）。

### 踩过的坑（本机实测）
- **首版出片完整跑通、有 3 条告警**：命令 `node lemo-make.mjs paper-popup --skip-sync --no-preflight --ratio 16:9 --skip-audio`；Windows Node v22.22.2 + ffmpeg 9.0.2；**走的是 `--skip-sync`**（`[2]` 段显示「（--skip-sync）」）与 `--no-preflight`；渲染 3192 帧用 **130s**（6 workers，1920×1080，24fps）→ `video_gpu.mp4` 163.7 MB；混流走 **WSL 的 `core/render/mux.sh`**，编码器 **`h264_nvenc`（GPU）**，颗粒取脚本默认 **2**；首版成片 **84.76 MB / 133.000s / 3192 帧**，总耗时 **199.4s**。三条告警：(1) `styles/paper-popup/demo/mux.sh 存在，但它的接口不是 V A O [fps] [grain]，回退 core/render/mux.sh`；(2) `该 demo 没有本编排器支持的字幕生成器 —— 字幕源不重新生成，.srt 将沿用仓库里已提交的旧文件`；(3) `mux.sh: warning: the audio is silent or quieter than -70 LUFS, so loudness normalisation was skipped`。**音频修复后重新混流的新片为 93,346,551 B（≈89.0 MB，**原记** 2026-10-03 首混读数；当前入库成片 **93,293,467 B**）/ 1920×1080 / 24fps / 3192 帧 / 133.000000s，视频轨逐项未动，只换了音轨**（我已 ffprobe 复核）。 ★ 2026-10-06 更正：编排器第 3 步字幕告警措辞已改（第五十三批，md5 65ddab44→dfa99004）——其中『告警误导 / 两处不一致』部分已消解，其余仍成立
- **`--skip-audio` 的后果是「静音成片」而不是「没有音轨」（首版踩过，已修）**：`core/render/mux.sh` 会先 `ffprobe` 检查音频流，若 `mix.wav` 不存在会直接 `die`；首版没 `die`、且产出了 aac 48 kHz 立体声轨（2 kb/s），说明是**一条静音轨被照常混了进去**，只有响度归一被跳过——所以「有音轨」不等于「有声音」，**验收必须量电平，不能只看流列表**。要出有声片必须去掉 `--skip-audio` 并先跑 `tts/gen.py` + `music/edit.py` + `mix.py`。
- **`mix.py` 的 `np.convolve` 直卷是本风格真正的性能陷阱（已修）**：`mix.py:196,202` 用 `np.convolve` 直卷 6,384,000 × 14,400 是 O(n·m)，实测**跑 30+ 分钟不结束**（被两次超时 / SIGKILL 掉），`ps` 显示 **530% CPU / 34 线程 / load average 21** —— 极易被误判成「脚本卡死」。改成 `scipy.signal.fftconvolve` 后 **<75 秒**，且输出与改前**逐位相同**（12,768,000 样本 0 个不同，`max_abs_diff 0.000e+00`）；`mix.py` md5 `8b4dacd3…` → `ef62e55e…`，回滚备份 `D:/tmp/mix.py.orig`。⚠ **同类问题的通用解**：跑任何 Python 音频脚本（`mix.py` / `edit.py` / librosa / TTS）前先限线程 —— `OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 BLIS_NUM_THREADS=1 PYTHONUNBUFFERED=1`（多任务并发时 OpenBLAS 会互相抢占 + 忙等自旋，进度接近零）；另外 **Python 的 print 在管道里是块缓冲的**，看不到输出 ≠ 卡死，要 `PYTHONUNBUFFERED=1` 才实时。判据：`cat /proc/loadavg` 远大于 `nproc`，且 `ps -eo pid,pcpu,etimes,args --sort=-pcpu` 里 python 跑很久、CPU 几百但**产物 mtime 不动**。
- **编排器不会用 demo 自己的 `mux.sh`**：`styles/paper-popup/demo/mux.sh` 用的是 `libx264 -preset slow -crf 17 -r 60` + `noise=c0s=2:c0f=t+u` + `loudnorm I=-14:TP=-1.2:LRA=11`，即**原生 60fps 出片**；编排器只认 `V A O [fps] [grain]` 接口，于是回退到 `core/render/mux.sh`（24fps、nvenc）。**想要 60fps 成片就得手工跑 demo 的 `mux.sh`。**
- **字幕源不会被重新生成**：编排器探测过 `tools/subs.mjs` / `subs.mjs` / `tools/export.mjs` / `tools/subs.py` / `subs.py` / `tools/cues.py` / `cues_export.py` 都不匹配，所以 `.srt` 用的是仓库里已提交的那份（21 条 cue、双语）。改 `story.js` 的 `VO` 之后**必须手工跑 `node demo/make_srt.mjs`**，否则字幕与画面不同步。 ★ 2026-10-06 更正：编排器第 3 步字幕告警措辞已改（第五十三批，md5 65ddab44→dfa99004）——其中『告警误导 / 两处不一致』部分已消解，其余仍成立
- **引擎与媒介的坑**（`DEMO.md:102-109`、`STYLE.md:93-101`）：单平面的船会藏住坐在里面的角色（要拆成帆在后 z −3 mm、船身在前 z +2 mm，角色夹中间）；矩形影子会毁掉错觉（每张卡都要 alpha-mapped depth material，spot shadow map 4096²、bias −6e-5、normalBias 4e-4）；翻页背光的一面会变黑（`emissive map = colour map`，叶子 emissive .42）；headless Chrome 会退回 SwiftShader（默认约 620 ms/帧，必须 `--use-angle=gl --enable-gpu --ignore-gpu-blocklist`，并且 ES modules 需要 HTTP，`render.mjs` 内部起 `serve.mjs`）；ACES 会移动纸的颜色（必须 Neutral）；每帧重画角色画布很贵（只在姿态变化时重画，姿态量化到 1/40）。
- **换主题最容易撞的三条**：**用 `rotation.y` 转身**（会露出空白背面，必须 `scale.x`）、**用矩形影子**（必须用剪影 depth material）、**让近镜头的前景弹起件挡住镜头**（会整片糊掉）。另外别忘了：**改中文文案就要重跑 `fetch_fonts.mjs` 重新子集化**。

### 下次迭代优先补什么
- **~~把音频跑出来~~（已完成）**：首版 `--skip-audio` 造成的静音成片已修复 —— 15 条配音、纸 foley、打字 blip、三首 CC BY 4.0 曲、环境床全部到位，成片实测 `−14.34 LUFS / −2.33 dBTP` **达标**。**下一步是把余量做厚**：`mix.wav` 真峰值 −1.00 dBFS 高于 loudnorm 的 `LN_TP=−1.7`，本片只剩 **0.45 dB** 余量；正解是调 `mux.sh` 的 `LN_TP`（核心共享文件，需团队决策），**不要**手工预压限（实测更差）。
- **把帧率提到 60fps**：改用 demo 自带的 `mux.sh`（或给 `core/render/mux.sh` 传 `fps=60`），并核 7980 帧，让「on ones」与微距慢移的顺滑度回到声明值。
- **修字幕在亮背景上的可读性**：给字幕加一层**可选的半透明纸底条**（与 `STYLE.md:37` 的「奶油字 + 深棕描边」不冲突，只是加一层更深的描边或一条极淡的暗底），至少保证压在台灯散景上时可读；同时把折行宽度从 1720px 收到约 1560px，给左右各留 180px。
- **补 9:16 安全构图方案**（或产品侧锁死 16:9）：至少要让字幕按**可见宽度**自适应折行，并把章节横幅与气泡的横向位置约束到左侧 56.25% 内。
- **沉淀「新跨页 = 页面美术 + popper 块 + RISE/FOLD/TURNS」的模板**，把「换主题只改 `story.js` + `sets.js` + `art.js` + `main.js` 的编排/镜头」这条路径固化下来，降低新主题的成本。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/paper-popup/paper-popup.mp4`（133.000s / 93,293,467 B ≈89.0MB / 3192 帧 / 1920×1080 @24fps / 音频 `I=−14.34 LUFS`、真峰值 `−2.33 dBTP`、LRA 7.6 LU） |
| 抽帧 | `D:/lemo-tools/_distill/frames/paper-popup/`（24 帧 + `_contact.jpg` 接触印样，等间隔 ≈5.54s） |
| 风格匹配度自评 | **88/100**（音频修复后回填：`audio` 3 → 17；`palette 20` / `composition 18` / `typography 17` / `rhythm 16` 四项未动） |
| 详细资料 | 有：`styles/paper-popup/STYLE.md`、`DEMO.md`、`style.json`、`demo/mux.sh`、`lib/style-dna/paper-popup.md`、`lib/style-dna/paper-popup.json`、`lib/dub-styles.json#paper-popup`、`_distill/logs/paper-popup.log`、demo 源码（`story.js`/`hud.js`/`paper.js`/`cutmesh.js`/`book.js`/`lib.js`） |

**逐帧拆解要点**（从 24 张抽帧里真正看到的；帧序号与时间可互相印证——抽帧按 133.0s / 24 帧等间隔采样，第 i 帧约在 `(i−0.5)×5.54s`，与 `story.js` 的 `VO`/`BUB`/`CHAPTERS` 窗口逐条对得上）：

- **f01（≈2.8s）**：**建立镜头**——暗胡桃木桌面上只有一本来被翻开的精装书（布面 `#1f5566` + 烫金书名 + 圆形 Pip 徽章）、一只闹钟、一支铅笔、一只茶杯，画面左上一角是橙色台灯罩；房间很暗，只有台灯那一束暖光。字幕已出：v01「On a quiet desk, in a quiet room…」+ 中文，**英文行几乎横贯画面**（左右只剩约 100px）。
- **f02（≈8.3s）**：镜头压低贴近书封，烫金书名 `The Little Sprite's Adventure` 与「a paper tale」副题清晰；字幕 v02「Until one evening… somebody did.」**此刻正处在淡入/淡出窗口，字偏暗偏灰**——这是「字幕压在亮/暖背景上」问题的第一次出现。
- **f03（≈13.9s）**：**书已打开**（`OPEN = [10.0,12.6]`），第 1 章跨页全景——绿草坡、红蘑菇屋、蓝色小池塘、栅栏、`Papervale` 木招牌、几朵挂在线上的云，地平线约在画面高度 55%。**此帧无字幕**（v03 要到 17.0s 才起），说明旁白之间是留白的。
- **f04（≈19.4s）**：推近蘑菇屋，字幕 v03「Inside, in a land made entirely of paper, lived a little sprite named Pip.」；**画面左下角出现第一块大而糊的绿色剪纸（前景花）**，占据了近四分之一画面。
- **f05（≈25.0s）**：Pip 首次正面亮相（绿色叶帽、蓝袍、翅膀），**气泡**「Good morning, Papervale!」+ 中文在头顶，白色卡纸 + 深墨描边 + 指向 Pip 的尾巴；画面下缘又是一块糊花。
- **f06（≈30.5s）**：谷地宽景——**棍上的纸太阳**（`sunOnStick`，正是 v04 念到的那句）、层叠的山丘、蓝白波浪的河带；字幕 v04 的长句横贯画面。
- **f07（≈36.1s）**：**几乎不动**的同一跨页，只做了缓慢横移；太阳被山挡住一半；**无字幕**（v04 已结束、v05 未起）。这一帧是「书内段落长停留 + 微动」的直接证据。
- **f08（≈41.6s）**：Pip 近景，字幕 v05「But every evening, when the sun went down, another light came on…」——**本片第一次点出「页外还有光」**，也是结尾反转的伏笔。
- **f09（≈47.1s）**：气泡「I'm going to find out where it comes from!」；`Papervale` 招牌在左。紧接着 48.6s 就是**第一次翻页**（`TURNS[0]`）。
- **f10（≈52.6s）**：**第 2 章横幅**（`Chapter 2 / The Whispering Woods`，红缎带 + 金色 Lilita One 标题 + 中文「第二章 · 窃窃私语森林」）吊在画面顶部居中；换场为**深绿森林**跨页（后松 `#8cc9a0`、前松 `#3f9a5c`），字幕 v06。
- **f11（≈58.2s）**：障碍角色 **Crumple（一团皱纸）** 出现，头顶一个红色「!」；气泡**正在打字**（只显示到「Hmph! N」）——这是 30 字符/秒打字 + 隔字母 blip 的直接证据；画面右下又是一块糊蕨。
- **f12（≈63.7s）**：Crumple 被**抚平**（摊在木头上、皱褶变平），字幕 v07「where Pip learned that a grumpy crumple… just needs someone to smooth things out.」——「纸作为角色」这个 idiom 的完整演示。
- **f13（≈69.3s）**：Crumple 折成**纸飞机 Fold**，气泡「Wheee! I'm Fold!」；Pip 在旁。
- **f14（≈74.8s）**：**第 3 章横幅**（`Chapter 3 / The Swish-Swash Sea`）+ 换场为**海**跨页：整屏都是层叠的蓝色波浪卡（亮→暗五档 `#9ad8f5`→`#2f7fc4`），Pip 坐在红帆小船上。**这是全片平面叠卡最密的一帧**。
- **f15（≈80.4s）**：白天海面，一头蓝色**鲸鱼喷出彩色纸屑**（笑点），小船在前景——正是 `DEMO.md:23` 记的那个 gag。
- **f16（≈85.9s）**：**同一跨页已翻成夜晚**——深蓝夜空（`#131d44`→`#4a5a94`）、**挂在线上的星星**与月亮、深色波浪；字幕 v09「on through the night, beneath the stars on their strings」。**日→夜的「四片翻板」机关**在这里完成（`DEMO.md:18`），而且**色族整体换掉了**，不是加一层蓝滤镜。
- **f17（≈91.4s）**：**最终章横幅**（`Final Chapter / The Last Page`）+ 换场为**「未完成页」**：奶油纸 `#f5eedc` 上只有石墨铅笔的树与房子轮廓，地上印着大号 IM Fell English 的 `The En…`；字幕 v10「until they reached the very last page. Nothing else was drawn there. Just two words. The End.」。**全片唯一一个去色的跨页**，与 `STYLE.md:29` 完全一致。
- **f18（≈97.0s）**：**已跳出书外**——画面是真实桌面，但**极浅的景深**把房间化成一片暖琥珀散景，只有书页边缘与站在纸上的 Pip 略实；字幕 v11 **几乎读不出来**（见第 11 节的读性缺陷）。
- **f19（≈102.4s）**：Pip 站在书页上准备起跳，气泡「Here goes!」+ 中文「冲啦！」；背后是巨大的台灯散景。**这一拍正是音乐跳剪让原曲结尾落地的 104.22s 前夜**（音频已修复、片中有声，但该跳剪落点**未做听感核验**，见下方缺陷）。
- **f20（≈107.9s）**：**落地 / 揭示**——回到正常景深的真实桌面：打开的书（奶油页块）、带花纹的茶杯与碟、盆栽、铅笔；Pip 与纸飞机出现在画面上方（飞过桌面）。**无字幕**（v12 与 v13 之间的留白）。
- **f21（≈113.5s）**：Pip 站上折好的**纸飞机**，在胡桃木桌面上、实焦；字幕 v13「And that is how Pip found out where the big, warm light came from.」——**「页外的光」就是台灯**，伏笔回收。
- **f22（≈119.0s）**：Pip 的近景笑脸（大黑椭圆眼 + 白高光 + 粉脸颊），字幕 v14「A reading lamp… and someone, reading along.」。
- **f23（≈124.6s）**：**片尾卡**——金色 `The Little Sprite's Adventure` + 中文「小精灵冒险记」压在真实的桌面镜头上；字幕 v15「The end? Or maybe… just the beginning.」。
- **f24（≈130.1s）**：片尾卡完整形态——金色标题 + 中文 + 斜体 `The End?` + 一行 `LemoLab × Claude Opus 5.5`（**这一行属于本库的 demo，用户成片不带**，`DEMO.md:98`），底部是音乐 / 素材 / 配音三行版权与中文对照。
- **色走**：暗暖房间（f01–f02）→ 绿谷（f03–f09）→ 深绿森林（f10–f13）→ 蓝海白天（f14–f15）→ **海军蓝夜**（f16）→ 奶油 + 石墨的「未完成页」（f17）→ 暖琥珀真实桌面（f18–f22）→ 暖桌面 + 金标题（f23–f24）。**每一跨页换一个主导色族、翻页即换色**，与 `STYLE.md:27` 完全一致；跨跨页复用的红（蘑菇屋）、金（招牌 / 标题）、黄（太阳）也确实在缝整本书。
- **节奏**：抽帧里可以清楚看到「**建立慢 → 书内慢（f06/f07/f08 三帧几乎同一机位）→ 章节切换密（f10/f14/f17 各带横幅）→ 飞出后重新变慢**」的呼吸；三次翻页都发生在章节交界（48.6 / 71.6 / 86.8s），**书内没有任何一处溶解**。
- **瑕疵**：抽帧里**没有发现糊帧、闪帧、错位或黑边**；唯一两处读性问题都在字幕上——**f18 的奶油字幕压在亮散景上几乎不可读**（叠加淡入中的半透明），**f02 的字幕正处在淡入/淡出窗口所以偏暗**。另外 f04/f05/f06/f07/f08/f11/f13 的**下缘虚化剪纸占比偏大**，是设计内的浅景深但已接近 `DEMO.md:103` 记的那个坑。

**自检发现的缺陷**（每一条都对应 `_distill.json` 里的一处扣分）：
- `audio` 17/20：音频链已修好并实跑 —— 15 条配音（Kokoro `af_bella`）+ 250 条事件合成的纸 foley + 3 首 CC BY 4.0 曲 + 每跨页环境床全部到位，成片实测 `I = −14.34 LUFS`（目标 −14）、真峰值 `−2.33 dBTP`（上限 −1.2）、LRA 7.6 LU，**响度与真峰值双双达标**。**扣 2 分**给「编码余量机制性不足」：`mix.wav` 真峰值 −1.00 dBFS 高于 loudnorm 的 `LN_TP=−1.7`，本片还有 1.13 dB 余量，同一机制已在 `pictogram-motion`（+0.28 dBTP）与 `game-show`（−0.22 dBTP）上真的削波。**扣 1 分**给「音色与编排未独立验证」：我只能核到响度 / 真峰值这类**聚合指标**，纸 foley 的逐类可闻性、打字 blip 的波形与音高范围、三段曲的小节对齐跳剪是否真让原曲结尾落在 104.22s、duck 是否真是 40%，本次**未做听感或频谱核验**。
- `rhythm` 16/20：成片 **24fps**（3192 帧），而风格声明 **60fps on ones**（7980 帧），弹起过冲与微距慢移的采样变粗。**音频修复未改变这一点**（新片仍是 24fps，混流仍走 `core/render/mux.sh` 而非 demo 自带的 60fps `mux.sh`）。
- `typography` 17/20：字幕压在真实世界的亮虚化背景上时奶油字 + 深棕描边几乎不可读（f18/f19）；折行宽度 1720px 只留左右各 100px，长句几乎顶框（f01/f05/f08）。
- `composition` 18/20：近镜头前景的虚化剪纸反复占据画面下缘约四分之一（f04/f05/f06/f07/f08/f11/f13），是 `DEMO.md:103` 自己记过的坑。
- `palette` 20/20：抽帧实测的色族（谷绿 / 林深绿 / 海蓝 + 夜海军蓝 / 未完成页奶油 + 石墨 / 真实房间暖琥珀）与 `DEMO.md:72-80` 声明的色值逐族对得上，墨 `#3a2a24`、纸边 `#fffdf7`、卡纸边 `#b9ad9c` 也都在场，**未发现偏离**。

**本次为补齐短板做了什么**：
- **没有改动 `lemo-make.mjs`、没有改动 `D:/lemo-opuscar` 下的任何源码、没有起任何渲染或 TTS**（纪律红线）。本次蒸馏是**只读分析 + 写本目录两份文档**。
- 只做了**只读**的外部核验。**首版**：用 `ffprobe` 确认成片 `1920×1080 / 24fps / 133.000s / 88884075 B`（h264 视频轨 + aac 48 kHz 立体声轨），用 `ffmpeg volumedetect` 确认该音轨 **mean/max 均为 −91.0 dB**（数字静音）—— 补上了日志只有 `-70.0 LUFS / -inf` 的间接读数。**音频修复后**：用 `ffprobe` 复核新成片 `93,346,551 B / 1920×1080 / 24fps / 3192 帧 / 133.000000s`（**原记**；当前入库成片 **93,293,467 B**）（视频轨逐项与首版一致），用 `loudnorm print_format=json` 实测 **`input_i = −14.04`、`input_tp = −1.65`、`input_lra = 8.20`**（**原记** 2026-10-03；当前入库成片 `input_i = −14.34`、`input_tp = −2.33`、`input_lra = 7.5`），用 `md5sum` 核 `mix.wav = d585e92aae33b287fed1f889cb2aa2b1` 与 `mix.py = ef62e55e26eb6834ad82c0278b2c5728`，并核过三份 mp3 的 ID3（artist 均为 Kevin MacLeod）、三份 WAV 规格（48 kHz / pcm_s16le / 立体声）与 `voices/` 的 15 个 wav。
- 把**24fps、字幕读性、前景糊块占比、编码余量**四条如实写进第 11 节与 `_distill.json` 的 `defects`，把**外部素材依赖、字体子集、音乐 CC BY 4.0、9:16 只能推导未实渲**写进 `assetGaps`/`limits`，并在第 10 节写清「换主题只改 `story.js` + `sets.js` + `art.js` + `main.js` 的编排与镜头，`book/paper/cutmesh/post/render/mix` 不动」的复用路径，供下游直接抄。
- **音频修复后做了文档回填**（`audio` 3 → 17、`matchScore` 74 → 88）：改第 6 节（BGM/音效补齐实测值与真峰值判据）、第 9 节（音频链已实跑、`mix.py` 的 `fftconvolve` 修正与回滚备份）、第 11 节（静音条从「当前缺陷」改为「历史根因·已修复」，新增「编码余量机制性不足」，补 `np.convolve` 性能陷阱与限线程通用解）与 `_distill.json`。**画面三项（`palette 20` / `composition 18` / `typography 17`）与 `rhythm 16` 原样未动** —— 音频修复不改变画面，动它们就是虚高。
