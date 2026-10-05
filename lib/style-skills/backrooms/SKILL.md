---
name: lemo-style-backrooms
description: 【lemo 风格 Skill · 后室 / 新怪谈】用一台 1990 年代手持 VHS 摄像机拍下空荡、重复、荧光灯照明的「熟悉但不对劲」的室内，靠空、规则与摄像机自身故障制造后颈发凉；适合恐怖、悬疑、ARG、游戏预告等题材。选定本风格做视频时，优先读本文件。
slug: backrooms
name_zh: 后室 / 新怪谈
category: 电影与时代
film: Night Shift Orientation
---

# 后室 / 新怪谈（`backrooms`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/backrooms/STYLE.md` · `styles/backrooms/DEMO.md` · `styles/backrooms/demo/build.sh` ·
> `lib/style-dna/backrooms.json` · `lib/style-dna/backrooms.md` · `lib/dub-styles.json#backrooms` ·
> `styles/backrooms/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一段从空荡、无尽、荧光灯照明的空间里**回收的摄像机磁带**——一台 1990 年代手持 VHS 摄像机（4:3）连续拍下一个个「熟悉但不对劲」的室内，没有人。恐怖来自**空、重复、官僚式的规则、以及摄像机本身在最不该出错的时刻出错**；规则取代怪物（`STYLE.md:3-13`）。风格全名 **Liminal Found Footage**，`style.json:4`。

**不是什么**（最容易做错的邻居风格）：**不是**恐怖片（没有怪物特写、没有血、没有 jump scare、没有配乐 sting）、**不是** ASCII/CRT 终端片（伪影是**磁带与镜头**，不是磷光与扫描线）、**不是**废墟（**干净是这个风格的一部分**）（`STYLE.md:15`）。

**什么时候用它**：需要「官僚、疲惫、后颈发凉」而不是血腥恐怖的内容——新工作第一班、建筑巡检、搬家看房、学校安全演练、酒店夜审；也适合恐怖、悬疑、ARG 与游戏预告（`style.json:11-15`、`DEMO.md:26`）。

**一句话内核**：把主题变成**一次入职、一个程序或一份清单**，由某人在磁带上录下来；写 5–6 条规则，**让媒介背叛规则**（`DEMO.md:26`）。

**边界**：撑不起快节奏剪辑、多机位、群戏与明亮欢快的题材——**全片只有一个连续手持长镜**，剪辑只发生在磁带断掉的地方。也撑不起需要看清大量文字的内容：告示要留在画面上 ≥3–4s 不被遮挡。

**命名红线**：片子里**绝不能出现**「Backrooms」这个词、wiki 的「Level」编号、社区实体名、任何现有组织或 logo——一切都要原创（`STYLE.md:4`、`DEMO.md:14`）。

---

## 2. 画面构图

- **镜头数与画幅**：demo 共 **1433 帧 / 24fps**（≈59.7s）（`log:88,109`）。输出 **1920×1080（16:9）**，但**画面本身是 4:3 加左右黑边**——3D 场景按 **720×540** 渲染，让 VHS 通道放大（低分辨率藏住 CG 的干净感）（`STYLE.md:19`、`DEMO.md:70`）。
- **★ 黑边已实测确认**：对抽帧做条带亮度测量，左侧 0–12.5% 与右侧 87.5–100% 的平均亮度为 **0（纯黑）**，中央条带 151.2；12.5% 处仍是 0.056、14% 处升到 7.18 → **左右各 240px 黑边、画面有效宽 1440px**，与 4:3（1080×4/3=1440）完全吻合。
- **主体位置与占比**：摄影机就是主角（**听到但从不露面**，只偶尔露出鞋尖）。告示/规则板居中偏左或居中；「那个东西」永远**小、远**（约 33m 外），处在**一片死灯区**里，背后只有很暗的远光（`DEMO.md:44`）。
- **负空间 / 留白**：走廊**溶进黑暗而不是一堵亮墙**——场景背景 = **雾 × 0.15**（`STYLE.md:22`、`DEMO.md:73`）。这是本风格最不可让步的一条。
- **图层叠放顺序**（从底到顶）：720×540 three.js 场景（程序化贴图 + 自定义光照/雾）→ GTAO + 物理景深（自动对焦找焦）+ bloom → **VHS 摄像机着色器**（4:3 画幅 → 抖动/磁头切换条/撕裂 → 桶形畸变+暗角，**不作用于 OSD**）→ OSD（5×7 点阵）→ CEA-608 字幕（**不受磁带噪声影响**，因为「电视解码它们」）→ 1920×1080 左右黑边。
- **安全区**：字幕在 **4:3 画幅内居中**、位于 OSD 时钟**上方**；OSD `● REC` 左上、电量右上、`PM 11:58 / SEP.27.1996` 右下，都画在 4:3 画面内。
- **本风格**不能**出现的构图**：把文字拍成被遮挡或不可读；斜俯拍竖立纸张（会把字**斜切成假斜体**，必须**放低镜头让镜片与纸面平行**，`STYLE.md:39`、`DEMO.md:116`）；把伪影做成 CRT 的扫描线/RGB 荫罩。

**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。改造**没有**逐处改写绘制点（本风格 2438 行的绝对像素 + 720×540 内渲 + VHS/OSD 全屏层，逐处改必然静默错位），而是只改**一个页面外壳文件** `demo/index.html`：影片本体仍按**固定设计帧 1920×1080** 画（一字未改），当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧等比装入**（contain）并居中，留边露出页面底色 `#000`。声明在 `demo/film.js`（`FILM_META.aspects`，控制台按源码文本探测）。`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`。

- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform）；同会话往返（1920×1080 → 1080×1920 → 1920×1080）实测 md5 逐字节相同。
- **9:16 不裁切**：整幅 4:3 画面 + 左右黑边、`● REC`、右上电量、右下 `PM 11:58 / SEP.27.1996`、居中字幕**全部在画面内**（实测：改后 9:16 vs 16:9 中心裁切 SSIM 0.46，vs 理想等比装入 SSIM 0.94）。
- **已知代价**：① 竖屏下有效画面只占 1080×607（含 4:3 区域仅约 810×607），**分辨率按紧轴缩放**——本风格源本就是 720×540 上屏，故无实际损失；② **全屏层（VHS 噪点/抖动/OSD）留在设计框内**，上下留边是**纯黑无扫描线**（实测留边 YAVG=0）——本风格留边 = 底色，肉眼无接缝，但严格说全屏层不铺满整帧；③ 其它比例同理（3:4 / 4:3 / 1:1 已实测）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 墙纸（主色，病态芥末黄） | `#d5bd66` | 办公层墙纸主面；深色条纹 `rgba(140,112,40,.7)` + 菱形柱纹，每卷褪色程度不同 | `DEMO.md:74`、`tex.js:25-48` |
| 踢脚线 / 深色饰边 | `#4d3d26` | 墙脚 | `DEMO.md:74` |
| 地毯 | `#8c763c` | 斑驳湿地毯，湿斑 ×0.6 带微弱高光 | `DEMO.md:74`、`tex.js:52-58` |
| 吊顶板 | `#d9d3b8`（格栅 `#e6e1cf`） | 天花 | `DEMO.md:74` |
| 灯板扩散片 | `#fbfaf0`，emissive ×5 | 嵌入式灯板 | `DEMO.md:74` |
| **唯一饱和色**（红 EXIT） | `#ff2a1a`，**emissive ×9** 才能 bloom | 出口标志，全片唯一会泛光的东西 | `DEMO.md:74`、`world.js:351-357` |
| 字幕 | 白 `#FFFFFF` 黑底块（`subtitleBack` `#FF000000`） | CEA-608 每行一块实心黑底 | `DEMO.md:82`、`dub-styles.json#backrooms` |
| 产品通路底色 | `#0C1016` | ⚠️ 派生兜底值，见第 11 节 | `dub-styles.json#backrooms` |

- **明度 / 对比规则**：**一个病态主色相**（芥末黄 / 机构绿 / 医院蓝 / 米色层压板，随地点选），配同色系的深色饰边与斑驳地板；吊顶与灯板近白、略暖（`STYLE.md:30`）。**白平衡会漂移，颜色从不调干净**（`STYLE.md:32`）。
- **禁止出现的颜色**：第二个饱和色（**恰好一个**饱和色，且它是唯一会 bloom 的东西）；干净调色的白平衡；彩色装饰。
- **同一画面最多几个色相**：主色相 + 近白（吊顶/灯板）+ **1 个**饱和信号色。
- **光照规则**：**上千盏灯、无阴影**——每片元把最近 5×5 灯板求和（发光体余弦 × Lambert / (d²+0.3)）+ 反弹光；每盏 ±8% 暖/冷、+0–7% 绿、3.5% 死、2.5% 闪烁；GTAO（半径≈0.55m）只压暗墙/地接缝（`STYLE.md:21`、`DEMO.md:72`）。
- **雾跟着当地光照走**：雾色 ×（当地光 / 平均）。**灯死处雾也暗**，所以那里的剪影读成**光里的一个洞**（`STYLE.md:22`）。

---

## 4. 转场规则

- **镜头之间怎么切**：**全片只有一个连续手持长镜**；剪辑只发生在**磁带断掉的地方**——**开机滚入（power-on roll-in）、跟踪撕裂（tracking tear）、REC 熄灭（REC off）**（`STYLE.md:44,69`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：没有溶解/闪白。有**跟踪撕裂**（磁头切换条 + 按需撕裂）、**定格**（REC 熄灭：定格 → 撕裂 → 黑）、**开机滚入**（磁带滚入时 AWB 蓝→黄摆动、AF 才找到墙上告示）（`DEMO.md:34`）。
- **硬切点怎么定**：挂在**「原始时间」**上，再经**分段线性 warp `W()`** 映射到成片时间（只压走路段）；demo 锚点：`tear 36.35–37.0`（撕裂，时间码跳 +3 小时）、`recOff 57.7`、`endCard 58.1–61.0`，`DUR = W(61.0) = 59.7s`（`style-dna/backrooms.md:75-87`、`story.js:6-14`）。
- **转场时长与缓动**：撕裂处整条混音被**切碎 + 噪声爆发**；门自己开用 **1.3s eased**（`DEMO.md:53`）。
- **绝对不要的转场**：**在磁带不断的情况下剪辑**（`STYLE.md:118`）；两块屏幕之间的交叉溶解；把伪影做成 CRT 扫描线。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **CEA-608 风格**：等宽 **IBM Plex Mono 600**（`STYLE.md:37`）。产品通路用 `SimHei`（因 Consolas 无 CJK 字形，`dub-styles.json#backrooms`） |
| 字号（相对画面宽 / 高） | **42 px @1920 宽 ≈ 2.19% 画面宽**；产品通路 `fontSizeFactor` 0.03889（对 1080 高）（`STYLE.md:37`、`dub-styles.json#backrooms`） |
| 颜色 / 描边 / 阴影 | 白字 + **每行一块实心黑底**（`subtitleBack` `#FF000000`）；**无描边**（`outlineFactor` 0）（`DEMO.md:82`） |
| 位置 / 安全边距 | **在 4:3 画幅内居中**，位于 OSD 时钟**上方**；产品通路 `marginVFactor` 0.17037、`marginLFactor` 0.06019（`DEMO.md:82`、`dub-styles.json#backrooms`） |
| 单行字数上限 / 最多行数 | **每行 ≤ 32 字符**（CEA-608 硬规则）（`STYLE.md:37`、`subs.js:1-9`） |
| 出现与消失方式 | **不受磁带噪声影响**（「电视解码它们」，所以字是干净的）；`subtitleFadeIn: 0`；停留 ≥ `max(1.9s, 说完+0.65s)`（`style-dna/backrooms.md:88`） |

- **字幕与旁白的关系**：字幕是**电视的闭路字幕**，带说话人标记——`[PA]` 前缀给广播，**斜体**给操作者（首行标 `(whispering)`），环境声用方括号 SDH 描述：`[FLUORESCENT LIGHTS HUMMING]`、`[LIGHTS FLICKER]`、`[TAPE NOISE]`、`[SILENCE]`（`DEMO.md:83`）。
- **本风格特有的字幕禁忌**：**告示上的规则不配字幕**——它们是**画面**，必须能读出来、每条 ≥3–4s 不被遮挡（`STYLE.md:39`、`DEMO.md:84`）；不用淡入；不用黑描边；不用非等宽字体。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「white on a solid black box per row」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#00000000`（AARRGGBB，落盘 ASS 为 `&H00000000`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(0,0,0,1)）；字色 #FFFFFF 与该底衬的 WCAG 对比度 **21.00**。

---

## 6. BGM / 音效特征

- **配乐**：**没有配乐**。只有磁带会录下的东西。音乐只存在于**画内**（隔墙传来的电梯音乐、收音机、天花板喇叭里一段走调的叮咚），被过滤、混响、可能随磁带 wow 走调。demo 的画内电梯音乐：原创 easy-listening 循环（**88 BPM F 大调**，颤音琴主旋律、干净吉他 2&4 拍、指弹贝斯），读一条**逐渐变慢的带速曲线 1.00→0.97→0.89**，灯闪时切掉、在静默处死掉且不再回来（`DEMO.md:63`）。
- **拟音（foley）清单**：湿地毯脚步（60–85Hz 闷击 + 0.9–2.6kHz 小湿黏）、转身布料摩擦、REC 开关的摄像机咔哒 + 马达、变焦伺服啸、AF 马达细咔哒、每次灯闪的镇流器「叮」+ 电弧「滋」、头顶极轻的拖曳、门闩 + 粘滑合页吱呀 + 气压呼声（`DEMO.md:64`）。
- **日光灯床**：**120Hz** + 谐波（1/.55/.42/.22/.16/.06）、带通方波的「滋」、约 **9kHz** 镇流器细啸、坏灯管随机「滋滋」爆发；**与画面同一套光照曲线门控**；小房间 +3dB（`DEMO.md:60`、`mix.py:106-121`）。
- **旁白处理**：**PA**——平静公司腔（Kokoro `af_bella`，speed 0.82–0.84）过「天花板喇叭」：限带约 **310–3500Hz**、纸盆共振 ~1.3kHz、tanh 饱和、房间混响，**干到 whisper 仍能转写**；每条规则前一段原创两音叮咚（颤音琴 E5→C5），时间跳跃后叮咚与人声**一起走调**。**操作者**——3–4 句短台词（`am_michael`），低电平、近讲低频、随人声包络的气流层、压缩；近讲呼吸速率跟着**恐惧曲线**，屏息后一口长呼气（`DEMO.md:61-62`）。
- **响度目标**：`-14 LUFS`（实测 **-14.1 LUFS** / **LRA 8.3 LU**，`log:107-108`）；**真峰值上限**：**-1.2 dBTP**（**项目级交付线**，判据见 `core/render/mux.sh`；本风格 `STYLE.md:80` 未额外声明更严上限）。本次 mux 输出未打印 Peak 行（ebur128 只给出 I 与 LRA），但**事后用 `loudnorm` `input_tp`（4× 过采样）实测成片真峰值为 -0.92 dBTP**——**超交付线 0.28 dB（未达标）**，但真峰值为负、**未削波**；根因与全库同类问题一致（AAC 256k 编码余量不足，属项目级既有缺陷）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 -0.92 dBTP → **-1.44 dBTP**（★ 2026-10-05 重渲后实测）、已在 −1.2 dBTP 交付线内（达标）；原 -0.92 dBTP 记录保留为历史。
- **静音策略**：**静默是高潮**——出口出现时整整一秒**数字归零**（连混响尾巴一起），字幕写 `[SILENCE]`。允许的唯一惊吓是柔和的：声音回来时**所有镇流器同时重启**的一声低闷「咚」。另外每次灯闪是**三次 0.1s 的黑**，AE 之后约 **0.45s** 才追上、增益噪声随之泵动（`DEMO.md:65`、`style-dna/backrooms.md:92`）。
- **mux 不加颗粒**（`grain 0`）——噪声活在画面里（`build.sh:12`）。

---

## 7. 素材偏好

- **需要什么素材**：**全部程序化**，不依赖外部图片。需要：台词 `lines.json`（`{id,voice,speed,text,asr?}`，分 PA `af_bella` 与操作者 `am_michael`）、时间线 `story.js` 的 `T0` + 分段线性 warp `W()`、机位曲线（`POS/YAW/PITCH/CAMH/FOV/FOCUS/APER/FEAR/HOLD`）、OSD 曲线 `clock(t)`/`battery(t)`、告示与规则文本（`tex.js` 的 `notice()`）、「那个东西」的剪影设计（`thing2d.js`）（`style-dna/backrooms.md:180-187`）。
- **不需要什么素材**：不需要实拍/图库/3D 模型库；不需要配乐素材（**没有配乐**）；**不需要任何真实录像带的界面文字、字体或 logo**（`STYLE.md:4`）。
- **取景 / 质感 / 比例偏好**：**干净是风格的一部分**——衰败只有个位数百分比（墙根潮痕、吊顶下烟黄带、~7% 翘边接缝、~4% 发黄板、~2% 回风口、<1% 缺板黑洞、扩散板里的死虫）（`STYLE.md:23`、`DEMO.md:75`）。印刷品是**办公激光打印在发黄纸上**：压缩体表头（"FLOOR STAFF — PLEASE READ"）、表单号与修订号（"FORM NS-01 (REV. 9)"）、编号规则、礼貌的 "Thank you for your cooperation. — Management"（`DEMO.md:76`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有「那个东西」的设计时，**它可以完全不出现**（`STYLE.md:113` 明确「那个存在（或没有）」）——只靠空、重复、规则与磁带故障；没有原创画内音乐时，可以让**日光灯床 + 拟音 + 静默**独自撑起全片（这正是 demo 的主要声部）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | **一个连续长镜**（全片 59.7s）；段落由 `story.js` 的 `T0` + `W()` 驱动 |
| 全片时长 | demo **59.7s**（`style.json:17`，`frame_sec` 35.82）；`STYLE.md:6` 明确「适合 **45–60s** 的片子」 |
| 镜头数 | 1433 帧 @24fps（`log:88,109`）；物理镜头 **1 个** |
| 信息投放节拍 | 情绪弧：**boring normal（约 20s 几乎无事）→ 小错位 → 规则被测试（灯闪）→ 看见/看不见（对焦搜寻）→ 时间被拿走（撕裂）→ 规则被打破（出口）→ 最后一条规则转向观众 → REC off**（`DEMO.md:28`） |

- **加速 / 减速点**：约 20s 的「例行」是刻意的减速（走 POV、低头看鞋），峰值在**对焦搜寻**（`zoom 32.2–33.4`、`figOn 32.2–33.95`，**那个东西只有 `afFig 33.15–33.65` 约 0.5s 是清楚的**）；第二次对上焦（`afEmpty 35.15`）它已不在（`style-dna/backrooms.md:81-83`）。
- **留白与静音的位置**：全片 **1s 数字静音**（`hush 47.35–48.35`）；撕裂（36.35）拿走时间；出口转角（42.7–44.5）后打破规则（`style-dna/backrooms.md:84-86`）。
- **手持运动数字**：步幅 **0.72m**、头部起伏 **3cm**、横摆 **1.8cm**、roll **±0.8°**、呼吸 **0.27Hz**、抖动噪声在 **1 / 3.5 / 9 Hz**（幅度跟恐惧曲线）；低头时 pitch ≈ **−1.2 rad**、镜头前推 **0.2m**（**只露鞋尖和地毯，绝不露裤腿**）；变焦 FOV **52°→27°**、光圈 ×5（`DEMO.md:46,49-51`）。
- **运动规则**：连续运动的只有**手持抖动本身**（步态 + 呼吸 + 抖动噪声）与**灯/曝光的连续变化**；其余一切**永不 snap**——门用 >1s eased 打开；「屏息」时刻**冻结所有手持抖动**（`STYLE.md:45,49`、`DEMO.md:53`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/backrooms/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/backrooms/demo --fps 24 --workers 6 --size 1920x1080 --out …`（`log:35`） |
| 帧率 | 24 fps（**磁带噪声按 30fps 生成**，即使输出 24fps）（`DEMO.md:77`） |
| 分辨率 / 比例 | 1920×1080（16:9）内含 **4:3 pillarbox（左右各 240px 黑边）**；3D 场景 **720×540** |
| 混流 | `CRF=24 sh styles/backrooms/demo/tools/mux.sh <video> <mix.wav> <out.mp4> 24 0`（**grain 0**）（`build.sh:12`） |
| 编码器 | `h264_nvenc`（本地 GPU）——`lemo-make.mjs` 的 `export LEMO_VENC` 导出 `LEMO_VENC=h264_nvenc`，打补丁后的 `demo/tools/mux.sh:21-24` 跟随该变量，`-preset p5 -profile high -rc vbr -cq $((CRF+4))` → **CRF 24 ⇒ cq 28** |
| 音频入口 | `core/tts/tts.py` → `core/tts/asr_check.py` → `music/muzak.py` → `mix.py` → `core/tts/asr_check.py`（**对处理后的人声再复检一次**）（`build.sh:5-10`） |
| 字幕入口 | `build.sh:13` 的内联 `python3 -c` 从 `events.json` 抽 `type=='cap'` 生成 `out/cues.json` → `core/render/srt.py out/cues.json <out.srt>`（`build.sh:13-14`） |
| 事件导出 | `node core/render/events.mjs styles/backrooms/demo`（本片 **103 事件**，`log:26`） |
| 本风格专属参数 | 响度 -14 LUFS、grain 0、CRF 24；灯板数据 128×128 浮点 DataTexture、每片元求和最近 **5×5** 灯板、分母 `d²+0.3`；GTAO 半径≈0.55m；VHS：抖动 ≤0.25px、桶形 0.07、暗角 0.42、黑电平抬升 0.045、色度右移 1.6px、掉磁 0–2 条/帧（`DEMO.md:72,77`） |
| 一键复现 | `sh styles/backrooms/demo/build.sh`（1433 帧约 80s / 3 workers；本次编排用 6 workers 渲染仅 24s） |
| 关键机制 | `story.js` 是**唯一真值**；**所有时间按「原始时间」写、经 `W()` 映射**——别处的硬编码时间也必须一起 warp（`DEMO.md:121`） |

---

## 10. 编排规则

- **内容文件字段契约**（`content_fields`）：`lines.json` 每条 `{id, voice, speed, text, asr?}`；人声分 PA（`af_bella`，0.82–0.84）与操作者（`am_michael`）两类；demo 共 10 条（`p0`–`p6` 七条规则/欢迎 + `w0`–`w4` 五条操作者短句）（`log:37-60`、`style-dna/backrooms.md:182`）。
- **事件词汇表**：`recOn`/`recOff`（摄像机咔哒+马达）、`line{id,who}`（PA 过天花板喇叭 / 操作者小声说话）、`chime`（颤音琴 E5→C5 过同一喇叭）、`step{v}`、`rustle{v}`、`zoom{d}`、`af`、`flick`（镇流器「叮」+电弧「滋」，**与画面 gLight 同一公式**）、`overhead{d}`、`tear{d}`（切碎+噪声爆发）、`hush{d}`（数字静音 + 回归闷咚）、`door{d}`、`end`（`style-dna/backrooms.md:201-215`）。
- **时间线契约**：`story.js` 导出 `DUR`（= W(61.0)）、`T`（已 warp 的关键时刻）、`LINES`、`CHIMES`、机位曲线与 OSD 曲线；`main.js` 组装渲染链（GTAO + DOF + bloom → VHS）并导出事件；`subs.js` 生成 608 字幕（`style-dna/backrooms.md:197`）。
- **新增主体怎么接入**：走 `world.js` 的材质工厂——`paint({map,color,shin,spec,emit})` 画任意贴图/纯色漫反射物体；`silhouetteMat(map)` 画几乎不受光的剪影（alpha 测试）；贴图由 `tex.js` **程序化生成**（确定性 mulberry 种子）。**剪影必须用有机曲线画在朝向相机的广告牌上**（原始几何体会读成玩具），并把广告牌**排除出 GTAO 预通道**（`mesh.isPoints = true`），否则会盖出一个暗矩形（`style-dna/backrooms.md:193`、`DEMO.md:44`）。
- **换主题时要改哪些文件**：① `demo/story.js`（时间线 `T0`/`W()`、机位与对焦/恐惧曲线、OSD 时钟与电量）；② `demo/lines.json` + `voices/`（PA 规则与操作者台词）；③ `demo/tex.js`（新地点材质与**告示文本**）；④ `demo/world.js`（布局/路线/灯阵）；⑤ `demo/thing2d.js` + `figures.js`（那个存在，或删掉走无人版）；⑥ `demo/music/muzak.py`（新的画内音乐）；⑦ `demo/mix.py` 的拟音事件表；⑧ 唯一的信号色。**`vhs.js`（VHS 通道）与 `osd.js`（点阵字体）不用改。**
- **与 `dub.mjs` 通路的关系**：本风格在「文案+风格」通路里能生效的参数是 `palette`（bg `#0C1016` / fg `#FFFFFF` / accent `#6b6457` / 字幕底 `#FF000000`）、`bgRecipe`（solid `#0C1016` + vignette 0.35）、`subtitle`（`fontFamily` SimHei、`fontSizeFactor` 0.03889、`marginVFactor` 0.17037、`outlineFactor` 0）、`title.fontSizeFactor` 0.082、`motion.subtitleFadeIn=0`、`motion.chapterTransition=cut`；`overlay` 全关（含 `accentRule=false`）（`dub-styles.json#backrooms`）。**⚠️ 该条自评为「差异强度：最弱」且 `bgSameAsDefault: true`，见第 11 节。**

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **★ 本风格曾因自带 `demo/tools/mux.sh` 的两个缺陷导致「片子根本出不来」**（2026-10-03 顺序出片实测）：
  ① 它**硬写 `-c:v libx264`**（CPU 编码），违反项目硬规则「渲染/合成一律本地 GPU」——编排器默认 `export LEMO_VENC=h264_nvenc`（`lemo-make.mjs` 的 `export LEMO_VENC`），core 版认这个变量、这 9 个风格自带副本不认；
  ② 它**缺少「音频比画面短时补静音」**——本片 `mix.wav` 59.700000s 比画面 59.706706s 短，`-shortest` 会**切掉最后一帧**，编排器守卫判 `MUX_FAIL 帧数不符 1433/1432`。
  **修复**：2026-10-03 用 `D:/lemo-tools/scripts/patch-style-mux.mjs`（幂等，先 `normalize()` 还原再打补丁）把 `core/render/mux.sh` 的这两处**最小外科回灌**到该副本——插入一个补丁块：`dur()` 用 ffprobe 量 V/A 时长，A<V 时 `PAD=",apad=whole_dur=$((V+1/fps))"`（补到**画面长度 + 一帧**，`-shortest` 就切不到末帧）；编码器改为 `case "${LEMO_VENC:-}"` 分支，`h264_nvenc` 走 `-preset p5 -profile high -rc vbr -cq $((CRF+4))`。
  **回灌后实测**：`MUX_OK 30386381 src_frames=1433 out_frames=1433`（`log:109`），且 mux 打印 `note: audio (59.700000 s) shorter than video (59.706706 s); padding to 59.748373 s`（`log:110`）——补丁确实生效；CRF 24 ⇒ **nvenc cq=28**。**成片已正常产出**（`log:111`）。改动极小、可回滚（`node scripts/patch-style-mux.mjs --only backrooms --revert`）。
- **本次 `.srt` 未重新生成**：编排器明确告警「该 demo 没有本编排器支持的字幕生成器 —— 字幕源不重新生成，`.srt` 将沿用仓库里已提交的旧文件」（`log:29-30`、`log:104`）。backrooms 的 `build.sh:13` 用的是**内联 `python3 -c`** 从 `events.json` 抽 `cap` 事件，编排器探测的 7 个候选（`tools/subs.mjs`/`subs.mjs`/`tools/export.mjs`/`tools/subs.py`/`subs.py`/`tools/cues.py`/`cues_export.py`）都不匹配 → **字幕可能与本次成片不同步**，属真实风险。
- ~~**无 9:16 支持，且本风格损失最重**~~ **★ 2026-10-04 已修**：`demo/index.html` 加「设计帧等比装入」外壳 + `demo/film.js` 声明 `aspects`（5 个比例全支持），9:16 下整幅画面与 OSD 都在（见第 2 节）。残留代价：竖屏有效画面只占 1080×607、全屏层不铺满留边。
- **`dub-styles.json#backrooms` 几乎是无效条目**：该条 `bgSameAsDefault: true`、notes 自述「纯色 `#0C1016` + vignette + 4px 扫描线（黑压黑，肉眼不可见），且无任何叠加层 —— 与 plain-dark 的差异**只剩暗角**……差异强度：**最弱**。若要求「一眼看出不同」，这条应标为暂不支持或另配底色」。~~更严重的是它把 `bgRecipe.texture` 写成 `scanlines`~~（**★ 2026-10-03 已修**：当前 `bgRecipe.texture = none`，不再违反 `STYLE.md:25`「无扫描线、无 RGB 荫罩」的红线；该条 notes 自陈的 `textureRaw: vhs-grain` 矛盾也随之消失）。**仍成立的是底色兜底那一半** —— 底色仍是 plain-dark 的 `#0C1016`，而风格主色是芥末黄 `#d5bd66` 系。
- **真峰值超交付线 0.28 dB**：mux 的 ebur128 输出只打印了 `I` 与 `LRA`（`log:107-108`），**没有 Peak 行**；事后用 `loudnorm` `input_tp`（4× 过采样）实测成片真峰值 **-0.92 dBTP**，**超 -1.2 dBTP 交付线 0.28 dB**（未达标，但真峰值为负、**未削波**）。`mix.wav` 峰值 0.950、rms -19.8 dB（`log:89`）——源混音峰值偏热是根因之一，与全库同类问题一致（AAC 256k 编码余量不足，属项目级既有缺陷）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 -0.92 dBTP → **-1.44 dBTP**（★ 2026-10-05 重渲后实测），已在 −1.2 dBTP 交付线内；音频评分回补 +1（见第 10 节）。
- **本次出片走了 `--skip-sync`**（`log:1`）；`events.mjs` 在 Windows 侧成功、产物回传 WSL（`log:25-27`）。
- **WebGL 编译告警**：`THREE.WebGLProgram: Program Info Log: (86,12-86): warning X3595: gradient instruction used in a loop with varying iteration; partial derivatives may have undefined value`（`log:38-39`）——出现在自定义光照/雾 shader 的 5×5 灯板循环里，属已知告警，本次未影响出片。

### 素材缺口
- **无外部素材缺口**（全程序化、不依赖图片/模型/配乐素材）。真正的缺口是**「那个东西」的剪影设计**：必须用有机曲线画在朝向相机的广告牌上，**目标：你看得出它在挥手，你数不清手指**（`DEMO.md:44`）。

### 能力限制
- **全亮场景会读成「医院走廊」** → 必须把墙打散成带缺口的隔断，远处落进黑暗（`STYLE.md:95`）。
- **灯会穿墙**（无遮挡光照）→ 一个「死灯区」需要 ±5m 内所有灯都死、且它背后的走廊也暗，否则剪影会被框在亮窗上（`STYLE.md:96`、`DEMO.md:112`）。
- **背景在走廊尽头显示成亮矩形** → 背景必须 = 雾 × 0.15（`STYLE.md:97`）。
- **均匀雾会把剪影抬成灰色** → 雾必须跟着当地光照走（`STYLE.md:98`）。
- **逐行抖动会斜切文字；俯拍会把字变成假斜体** → 抖动 ≤0.25px；拍纸时**放低镜头**（`STYLE.md:99`）。
- **原始几何体搭的人物读成玩具、腿像管子** → 用有机剪影；**只露鞋尖**（`STYLE.md:100`、`DEMO.md:117`）。
- **纯红在低 emissive 下永不 bloom**（红的亮度低）→ 必须开到 **×9**（`STYLE.md:101`、`DEMO.md:118`）。
- **用滤波前的峰值归一化会炸掉总线**：曾把 PA 总线炸高 **16dB** → 必须用**处理后**的信号归一化（`STYLE.md:102`、`DEMO.md:119`）。
- **PA 重混响毁可懂度**：重混响曾把 "night shift" 变成 "my church" → 每句处理后都要 whisper 复检，**整混也要复检**（`STYLE.md:103`、`DEMO.md:120`）。
- **广告牌会在 AO 里盖出暗矩形** → 把它排除出 GTAO 预通道（`STYLE.md:104`）。
- **时间压缩**：关键帧要写在「原始时间」并经**同一个** `W()` 映射，**别处的硬编码时间也必须一起 warp**（`STYLE.md:105`、`DEMO.md:121`）。
- **VHS 噪声让文件变大**：CRF 24 → 60s 约 47MB（本次实际 29.0MB / 1080p nvenc cq28）（`DEMO.md:122`）。

### 踩过的坑（本机实测）
- 上述 mux 双缺陷（libx264 + 缺补静音）是**本风格独有、且曾导致出不了片**的坑，见上「已知缺陷」。
- 编排器告警「没有本编排器支持的字幕生成器」，导致 `.srt` 未重生成（`log:29`）。

### 下次迭代优先补什么
- **把 `demo/tools/mux.sh` 的回灌并入仓库基线**（或让 `build.sh` 直接调 `core/render/mux.sh`），使补丁不再依赖一次性脚本。
- **给 backrooms 补一个编排器认得的字幕生成器**（`tools/subs.mjs` 或 `tools/subs.py`），别再让 `.srt` 沿用旧文件。
- **修 `dub-styles.json#backrooms`**：~~删掉 `texture: scanlines`（违反「无扫描线」红线）~~ **★ 2026-10-03 已完成**（现 `texture = none`）；**剩余待办**：补真实底色（芥末黄 `#d5bd66` 系而非兜底 `#0C1016`），并据实评估是否应标「暂不支持」。
- ~~给 `style.json` 补 `aspects`~~ **★ 2026-10-04 已完成**：能力声明落在 `demo/film.js`（`FILM_META.aspects`；本风格无 `film*.js` 命名约定，故新建该文件承载声明，页面并不 import 它）。控制台 `check-aspect-declaration.mjs` 已复绿、`aspectCheck('backrooms', …)` 对 5 个比例均 `fits=true`。
- 若要**全屏层铺满竖屏整帧**（VHS 噪点/扫描线延伸进上下留边），需要把全屏层改成**当前帧空间**重画（不能只随设计帧缩放）——这是外壳范式做不到的部分。
- 让 mux 打印真峰值（或改用 `loudnorm` `input_tp`），把 -1.2 dBTP 交付线变成出片即验证项（★ 原记·首版出片事后复测 −0.92 dBTP、超线 0.28 dB；该片经 2026-10-03 音频重混与 2026-10-05 重渲，现成片实测 −1.44 dBTP、已在交付线内）。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/backrooms/backrooms.mp4`（59.71s / 29.0MB / 30,403,182 B） |
| 抽帧 | `D:/lemo-tools/_distill/frames/backrooms/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **95/100**（2026-10-05 校正：原 92，9:16 画幅缺陷已修并回补 composition +3）（2026-10-03 校正：原 91，音频真峰值缺陷已修，audio +1）（★ 2026-10-03：原 90 —— 其中「texture 违反红线」那一半已修，palette 扣分由 −2 降为 −1） |
| 详细资料 | 有（`STYLE.md` · `DEMO.md` · `style.json` · `demo/build.sh` · `demo/tools/mux.sh` · `style-dna/backrooms.md` · `dub-styles.json#backrooms` · `_distill/logs/backrooms.log` · `vhs.js`/`main.js`/`term` 源码 · `patch-style-mux.mjs`） |

**逐帧拆解要点**：`_contact.jpg` 一眼可见全片是**芥末黄 + 黑边 + 白色点阵 OSD**的稳定体系，节奏前 2/3 几乎静止、末段收紧。**左右各约 12.5% 是纯黑边**——用条带亮度实测确认（左 0–12.5% 与右 87.5–100% 的 YAVG=0，中央 151.2；12.5% 处 0.056、14% 处 7.18），即 **4:3 画面 1440px 居中嵌在 1920px 里**。f01 开场：镜头对着软木板上的告示，画面左上 `● REC`（白点阵 + 黑描边）、右上电量图标、右下 `PM 11:58 / SEP.27.1996`，底部字幕条黑底白字 `[FLUORESCENT LIGHTS HUMMING]`——OSD 与 SDH 字幕同框即交代了「这是磁带」。f05 摇开后是**无尽走廊**：轴对齐隔断墙、吊顶灯板排成一列退进黑暗（背景确实是暗的，不是亮墙），字幕 `[PA] Rule one. The humming of the lights is normal.` 两行居中。f09 是对着墙上守则的**近距阅读镜**：黄化纸上 `...ATION` 表头 + 编号规则 1–6 全文可读（含 `Rule 6. If a coworker waves at you, wave back.`），`PM 11:59` —— 注意**镜片与纸面平行**，字没有变成假斜体。f13 低头看地毯：整屏是斑驳芥末黄地毯的湿地毯纹理，**只有地毯没有腿**（遵守「只露鞋尖」），`PM 11:59` 未变。f17 是**时间被拿走**之后：完全相同的走廊构图，但 OSD 已跳到 `AM 2:59 / SEP.27.1996`，字幕 `[PA] Rule four. There are no exits on this floor.`——同一构图、只有 OSD 变了，正是「撕裂 = 宇宙做的剪辑」。f21 是转角后的**门自己开了**：绿灰色门缝里透出暖光，`AM 3:00`。f24 片尾卡：黑底白点阵 `NIGHT SHIFT ORIENTATION` / `LIMINAL FOUND FOOTAGE` / `LemoLab × Claude Opus 5.5`。**色走**：全程芥末黄单色相 + 近白吊顶，**唯一的饱和色是红 EXIT**（在 f21 前后段落出现、是唯一泛光的东西）；白平衡有可见漂移，从不「调干净」。**字幕**：CEA-608 风格、每行 ≤32 字符、黑底块、位于 OSD 上方、**不被磁带噪声污染**（对比画面本身的噪点）。**转场**：全程一个连续手持长镜，**无一次溶解**；「切」只由跟踪撕裂/开机滚入/REC 熄灭完成。

**自检发现的缺陷**：本次 `.srt` 未重新生成（沿用旧文件，可能与成片不同步）；无 9:16 支持且 4:3 叠加导致损失最重；~~`dub-styles.json#backrooms` 的 `texture: scanlines` 违反「无扫描线」红线~~（**★ 2026-10-03 已修**，现 `texture = none`）；底色仍为兜底值（**仍成立**）；mux 未打印真峰值，-1.2 dBTP 交付线出片时未验证（事后复测真峰值 -0.92 dBTP，超线 0.28 dB）；本次 `--skip-sync`；WebGL X3595 告警。 ★ 2026-10-03：成片真峰值已修（-0.92 dBTP → **-1.44 dBTP**，音频重混 + 2026-10-05 重渲），见第 11 节。

**本次为补齐短板做了什么**：**这是三个风格里唯一一处源码改动**——2026-10-03 把 `core/render/mux.sh` 的两处修复（① 音频短于画面时补静音到「画面长度+一帧」；② 编码器跟随 `LEMO_VENC` 走 nvenc）用 `D:/lemo-tools/scripts/patch-style-mux.mjs` **最小外科回灌**到 `styles/backrooms/demo/tools/mux.sh`。改动形态是在 `VF=` 行后插入一个带 `── 本地补丁 ──` 标记的补丁块，并把编码器片段替换为 `$VARG` 分支；**幂等、可回滚**（`--revert`）。回灌前该片**根本出不来**（`MUX_FAIL 帧数不符 1433/1432`），回灌后 `MUX_OK src_frames=1433 out_frames=1433`、nvenc cq=28、成片正常产出。此外未改动任何其它源码。
