# 皮影戏（shadow-puppet）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Hou Yi Shoots the Suns》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一幅被油灯照亮的布，布前是透光的驴皮剪影：**画面 = 色调映射(灯光场 × 驴皮透射率 × 布纹)**。一切亮度来自灯，一切暗来自皮片的叠加与镂空，**镂空的孔才是最亮的地方**。皮影是关节连缀的刻皮片，被三根竹杆操纵，永远侧身、永远在布的同一侧表演；摄影机是台下的一张座、一根推轨，或干脆绕到幕后。

**它不是**：红纸窗花（没有正面受光的红纸、没有剪刀、没有折纸，这里是背光透射的驴皮）；剪影片 / 纸片动画（材料是半透明的皮，靠灯照亮，靠叠加变暗）；剪影动画（silhouette animation，只有全黑轮廓，没有镂空透光、没有染色、没有铆钉关节）；手绘二维动画（没有描边线、没有平涂色块，一切颜色是光穿过皮和布的结果）；3D（层永远平行于布面，纵深靠灯与虚焦）。
（`STYLE.md:1-10`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「一张被灯照过、被刻过的半透明皮片」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **唯一合成公式** | `hdr = 灯光场 L × 透射率 T × 布纹 cl × 边缘衰减 × 曝光`，再 `c = 1 − exp(−hdr)`。绝不直接画颜色。 |
| **透射率画布** | 白 = 全透（光直接穿过布），墨 = 近黑（皮厚处挡光），**镂空孔 = 透明（最亮）**。每片驴皮 = 一张预渲染的透射率贴图。 |
| **重叠变暗** | 画皮时用 `multiply`，重叠的皮片自然更暗——这是唯一的「体积感」来源。 |
| **灯光场** | 每盏灯 = 一个宽叶瓣（sigB≈700）+ 一个紧核心（sigC≈120），核心/叶瓣亮度比约 6:1；每盏灯独立闪烁（几个百分点的 ~7Hz 值噪声 + 更快的正弦）。灯色永远暖（lcol≈[1,.77,.46]），**从不是白**。 |
| **曝光随灯数压** | `expo = 1.75 / √(亮着的灯数)`；十盏全亮时过曝但不全白。亮度靠灯数，不靠后期调色。 |
| **布纹** | 细经纬（`sin×sin`，被噪声扭曲）+ 纤维噪点 + 大尺度疏密斑 + 幕布四边略暗；是布在透光，不是纯白底。 |
| **驴皮质感** | 可平铺的 512 纹理（多频值噪声 + 稀疏纤维划痕）以 `multiply` 乘上皮片，再用 `destination-in` 把原 alpha 还原——镂空孔保持透明。 |
| **刻皮词汇** | 鱼鳞缝、云头卷（螺旋细缝 + 泪滴孔）、联珠/梅花（小圆孔）、菱形锦纹、古钱纹（圆孔里留方皮）、水波纹、回纹、山纹地层、锥形裂缝（两头尖的宽缝）、火舌（宽根鼓腹、尖端向一侧卷钩）。 |
| **刻线** | 暗色刻线 1.5–2.4px 勾外轮廓与分区线；镂空用 `destination-out` 且 `fillStyle='#000'`（alpha 决定挖多少）。 |
| **铆钉** | 关节处一个深色小圈 + 浅色线结，画在透射率画布的世界坐标上——证明这是可以动的皮件。 |
| **后期** | 暖辉光（三级降采样 + 高斯 + 阈值，默认 .72）+ **暖暗角（向棕 [.7,.47,.25] 走，绝不向灰）** + 饱和度 + 柔和 S 曲线 + 轻颗粒；只有燃烧段才加向上漂的热浪。 |

**关键取向**：颜色永远「被灯染暖」。夜戏 = 关灯（灯数变少），**绝不加蓝**。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位说书人，在戏台下讲一个古老的灾祸与救赎。第三人称、过去时为主；只在结尾一句轻轻转向「此刻/我们」。

**长度（实测）**：口播 6 句，每句 **8–16 字**，短句为主。最长的两句也不超过 16 字（`demo/lines.json:11` / `demo/lines.json:30`）。一句一个动作或一个转折，用句号切成短拍；不用长定语、不用分号、不用括号补充。字幕是说书人题板：Cormorant Garamond 600 46px，深褐漆面木牌 + 细金线 + 朱红「说」字印，距底 58px；停留 ≥ `max(1.8s, 语音时长 + 0.8s)`，并截到下一句前 0.3s。

**句首类型**（示例性，不是抄原文）：
- 时间起句：`很久以前……`
- 时代背景：`那时候……`
- 具体动作钩子：`只见……`
- 转折点题：`可……`
- 承接与推进：`后来……` / `于是……`
- 点题因果：`就为……`

**这个风格里不会出现的句式**：
- 网络梗、流行语、emoji、颜文字
- 长定语从句、书面化长句、并列排比堆叠
- 第一人称吐槽或旁白自我吐槽
- 现代专有名词、时间戳、数字梗
- 形容词堆砌（「美轮美奂」「震撼人心」）
- 解释性元叙述（「接下来我们看」）

---

## 3. 叙事节奏

**信息投放顺序**（一次「用皮影的手艺讲一个古老故事」的民俗叙事）：

```
醒木开场（无乐，只有一声醒木）
  → 起板（台 台 七台 仓，加速）
  → 十日（灯一盏盏亮起来）
  → 焦土（心跳鼓；河揭走、树冠揭走、地面烧穿）
  → 急急风（英雄碎步上场）
  → 亮相（大锣一记闷住，急推）
  → 开弓（鼓滚渐强 → 放箭钹 → 大锣）
  → 连射（快长锤，一箭一记锣，逐次压低）
  → 静场（硬停）
  → 回春（板胡欢音，慢而柔）
  → 幕后（绕到灯后，看艺人的手）
  → 收板（一记大锣长尾）
```

**时间挂在 100 BPM 网格上**：1 拍 = 0.6 s，1 小节 = 2.4 s。

| 层 | 停留规则（`story.js`） |
|---|---|
| 关键锚点 | clap .4；titleIn 2.4；titleSet 3.6；sun0 7.2；flares 7.8→10.6；hot 10.8 |
| 英雄段 | run0 18.3 / run1 20.7 / hop 20.9 / liang 21.6 / lookUp 22.9 |
| 开弓 | draw1 [25.5, 27.2]；rel [27.6, 29.4, 30.6, 31.2, 31.8, 32.1, 32.4, 32.7, 33.0] |
| 收束 | last0 33.5 / lastDraw 34.0 / stop 34.8（硬停） |
| 回春 | heal0 37.4 / river 38.6 / canopy 39.6 / heal1 42.0 |
| 转场 | truck0 43.2 / cutBack 43.8 / bow 48.3 / clap2 50.6 / endIn 50.9 / end 54.4 |
| 字幕 | 显示到「语音 +0.8s」且 ≥1.8s，截到下一句前 0.3s |

**总时长**：主 demo 54.4 s（`story.js:3`）。单场景 8–12 s，一镜一个动作节拍。

**静默怎么用**：静场是**真实存在**的一段，而且是硬停。34.8–36.85 s 整条伴奏被 gate 硬切为 0（锣鼓/唢呐 34.8 之后永远清零，连长尾一起切），只留灯芯噼啪与弓弦；静场里至多一声极轻的小锣（36.9 s）。静场 RMS 必须 < −70 dB 才算过。收板前醒木留空（50.5–50.7 s）。

---

## 4. 镜头逻辑

**镜头是什么**：台下的一张座（观众视角，能看到木框、台口、前排后脑）；也可以是推轨（推、移、跟、甩、俯冲），或绕到幕布背后（镜像视角，看艺人举杆、油灯与烟）。它不制造情绪，只把视线引到一处；**皮影永远侧身、大多时候布面大片留白**。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 固定全景（台口完整，观众后脑在前景） | 一场戏正在上演 | 开场、收板 |
| 缓推（推框中心） | 聚焦一处 | 一句关键旁白 |
| 横移 | 一个被铺开的世界 | 大地、路线、时间线 |
| 跟一个皮影 | 跟随一个主体 | 上场、行走 |
| 亮相时的急推（几帧内推近，压在锣上） | 尺度、决心 | 主角登场 |
| 甩镜 | 一个动作转向另一个目标 | 开弓 → 目标 |
| 锁死全景（完全不动） | 全神贯注 | 连射、密集动作 |
| 中近景空布（两个皮件之间的留白） | 停顿、呼吸 | 抉择前的静 |
| 特写刻纹细节 | 工艺、装饰 | 一处纹样 |
| 地面条平移到画面顶部 | 视线转移 | 环境交代 |
| 横移绕过侧柱到幕后（镜像） | 揭示「这是被操纵的」 | 结尾 |
| 从布面拉回、露出黑暗的戏台房间 | 尺度揭示 | 片尾 |

**允许的转场**（必须来自戏台/皮影本身）：灯一盏盏暗下去、虚化的前景立柱横扫过画面、一个皮件在光里被揭起来、闪到暖白（`fadeCol≈[1,.82,.55]`）、绕到幕后（`mir=-1`，画面左右翻）。

**禁止**：通用叠化（crossfade）；数字转场（像素化、故障、扫光）；正对镜头的脸、正面全身；把皮影放到布外或被裁掉的构图（**推近时镜头必须夹在幕布矩形内，不出黑边**）；以边缘灯为中心做推镜（会把人物推出画面）。

---

## 5. 表达习惯（idioms）

1. **灯就是世界**：亮度由亮着的灯数决定，暗由皮片叠加决定；夜戏是关灯，绝不加蓝。
2. **离屏 = 又大又虚**：皮件离开焦点或被前景立柱挡住时，变大、变糊、变暖。
3. **绕到幕后**：同一块布、同一套皮影，镜像着看，配景变成黑暗木构、油灯与烟、艺人的手。
4. **镂空与透光**：孔是最亮的，重叠是最暗的；刻得越密，透光越多。
5. **手持活气**：主体带几像素的慢频手抖（≈0.02 rad），紧张时振幅放大到 1.8 倍；腿、翎子、流苏是预模拟的阻尼摆，越紧张摆得越狠。
6. **换片（piece swap）**：火、水、烟是刻好的皮件插在杆上，靠换片与抖动演出，**绝不用粒子**。
7. **揭条（strip lift-off）**：河、树冠这类横条可以整条揭下来、按回去，带模糊、放大与位移。
8. **操杆可见**：离布的竹杆是虚的、半透明的（`multiply` + `blur` + alpha≈.62），杆端连着艺人的手。
9. **24fps 连续**：皮影与镜头都是连续运动；只有被换的皮件（火、水）是 12fps 抖动。
10. **按在锣上**：一个动作/一个视觉节拍配一记打击；生死一记大锣，绝不铺满。

---

## 6. 氛围

一间小剧场：木框、黑漆、台口，前排几个模糊的后脑。灯是唯一光源，光是暖的、有呼吸的。尘土与热浪在烧起来时向上漂。皮影的轮廓在布上比它本身更清楚——因为人看的是影子。整体是**苍凉、有仪式感、克制**的气质，悲壮处靠一记大锣，不靠音乐铺满。

---

## 7. 声音

- **乐器（锣鼓先行）**：锣鼓经——大锣「哐」（击后 0.4s 音高下滑 2–3.5 半音）、小锣「台」（击后 0.12s 上扬）、钹、板鼓（高硬「哒」）、堂鼓（心跳与滚奏）、木鱼；板胡（erhu 采样加亮 + 鼻音共振峰 + 可变速滑音，苦音偏音 fa↑=+5.4 / si↓=+10.5 半音，欢音 D E F# A B）；唢呐感（oboe + 饱和 + 共振峰，**全片最多一次**）；低音垫（contrabass / cellos，很弱）。
- **动作声（按材料分层）**：醒木（硬木拍桌）、点灯「噗」（fwoomp）、竹杆碰布（短脆）、驴皮翻动/离布（flap）、皮鞋步、弓弦（基频 196Hz 轻微上滑）、箭中皮（thwack）、捏灯芯「噗 + 嘶」（snuff）、火噼啪、热的低嗡、水、幕后房间底噪、呼吸。
- **混音规则**：人声 −14 LUFS（两遍 loudnorm，TP −1.2）；旁白出现时音乐闪避 **12 dB**（250ms 包络 × 1.6），拟音 4 dB，环境 5 dB；每句旁白比床（音乐 + 拟音 + 环境）高 **≥12 dB** 才算过。静场段硬切、无残留。整体 −14 LUFS，颗粒 2。

---

## 8. 变化空间（可自由发挥）

主题、人物（或无人）、场景、染料组（3–5 饱和色 + 生皮 + 墨）、开场、结尾、镜头路径、节奏、以及哪些「原生动作」承载故事。**保持上限**：染料不超过 3–5 种饱和色 + 生皮色 + 墨，且所有色都被灯染暖。

- **结构**：①一支队伍/仪仗走过（横移长镜，人物从右到左，锣鼓按步伐）；②两个艺人（幕前幕后同时叙事，前半在布前看戏，后半绕到布后看操纵，油灯在中间）；③一个作坊（白天刻皮、晚上试戏，刻刀与灯芯的拟音互换，颜色只在夜里才活）；④一场审判或献祭（用灯光数量做张力：一盏一盏亮起来逼供，最后一盏灭掉判决）。
- **开场**：先给幕后（艺人点灯、手在布上投下影子）；或只给一个镂空的孔透光（观众还不知道那是什么）；或从戏中间开始，第一句旁白交代前情。
- **结尾**：灯被端走（画面慢慢变黑，只剩布）；皮影收拢、放回木箱（杆的咔哒声）；观众陆续离席（后脑一个个从前景移走）；或最后一盏灯留给观众，与开场呼应。
- **人物可替换**：猎人、书吏、船夫、织女、囚徒、走方郎中。**道具可替换**：弓、刀、伞、灯、笔、秤、网。
- **声音可整体换**：另一种戏曲打击乐（潮州锣鼓、十番），但「锣鼓先行、一记大锣定生死、静场硬切」的规则不变。

---

## 9. 禁忌清单

- **平涂贴纸感**：把皮影画成没有厚薄、没有透光变化的色块（必须靠 `multiply` 叠加产生明暗）。
- **正面脸**：皮影永远侧身，脸是空脸镂空（`ink` 勾轮廓与五官细皮线），不做正面。
- **把镂空纹样画成放射状花瓣或锯片**（鱼鳞、云头、联珠、锦纹都有固定走向，不能乱转）。
- **过曝处出灰角**（暗角必须走棕，不走灰）。
- **浅色薄片在亮布上消失**（必须读得清的细片一律用深色）。
- **镜像视角下用同一个 x 缩放画 x/y 两个方向**（会把皮件翻过来；x 缩放管 x，y 缩放管 y）。
- **用 `lighter` 画烟**（亮布上看不见；烟要先用淡褐 `source-over`，只有靠近灯的那一段才暖白加色）。
- **以边缘灯为中心做推镜**（把人物推出画面；推镜永远推框中心，只有俯冲进灯焰时才围绕灯）。
- **静场漏音**（床音没硬切干净）。
- **GPU 高负载下截图超时当失败**（要重试 3 次）。
- 照抄任何真实的皮影纹样、人物造型或标题。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`story.js` 为唯一真值）

| 字段 | 类型 | 说明 |
|---|---|---|
| `DUR` | number | 总时长（秒），demo 54.4 |
| `BEAT` / `BAR` | number | 一拍 0.6（100 BPM）、一小节 2.4 |
| `T` | object | 每个关键时刻的秒数：clap/match/lampOn/titleIn/titleSet/titleOut/sun0/flares/hot/burn0/burn1/flames/run0/run1/hop/liang/lookUp/draw1/rel/fly/last0/lastDraw/stop/lower0/lower1/softGong/heal0/river/canopy/heal1/pull0/truck0/cutBack/truck1/bow/clap2/endIn/end |
| `KILL` | number[] | 被射顺序（哪个灯先灭） |
| `hitT(i)` | fn | 命中时刻 = rel[i] + fly[i] |
| `VO[]` | `{id,t,text}` | id 为 `L1..L6`；同音词写 `asr` 别名（ten/10、suns/sons、Hou/Hu） |
| `SHOTS[]` | `[起,止,名]` | 镜头表，`shotAt(t)` 查表 |
| `lines.json` | `{id,text,voice,speed,asr?}` | 配音脚本，供 TTS |

### 10.2 新画面主体的契约

新人物/新物 = 一个「刻皮片模块」，必须提供：
- 每个可动部件 = 一张透射率贴图（由 `carve.js` 的 `piece(box,draw,opt)` 预渲染）+ 一个关节（父片局部坐标）+ 一个铆钉。
- 角色至少 **8–12 片**；头放大 ~1.2 倍且头饰占全身约 1/4；袖子与躯干用不同染料。
- 画的时候用 `multiply`，镂空用 `destination-out`。
- 必须导出：三根操纵杆锚点（颈杆 + 两根手杆）、两段 IK 的手臂链、可选的摆动物（翎子/流苏，预模拟）。
- 景片 = 刻好的皮件，幕布大部分留白。

### 10.3 时间线契约

- 页面契约（`main.js`）：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV` / `window.T` / `window.SUBS`。
- `story.js` 导出 `DUR/BEAT/BAR/T/KILL/hitT/VO/SHOTS/shotAt`；所有模块禁止各写一份时间。
- `core/render/events.mjs` 从 `story.js` 生成 `events.json`，`mix.py` 与 `music/score.py` 都读它。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者（`mix.py` 里的声音） |
|---|---|---|
| `clap` | 醒木 | 硬木拍桌 |
| `match` | 划火柴 | 噼啪 + fwoomp |
| `ignite` | 点灯 | fwoomp |
| `flare` | 灯亮 | fwoomp（音高随序号升） |
| `rodtap` | 竹杆碰布 | 短脆高频 |
| `liftoff` | 皮件离布 | flap |
| `creak` | 木头/皮革吱呀 | 连续吱呀 |
| `twang` | 弓弦 | 196Hz 轻微上滑 |
| `arrow` | 箭飞行 | whoosh |
| `hit` | 箭中皮 | thwack |
| `snuff` | 捏灭灯芯 | 噗 + 嘶 |
| `crowflap` | 乌拍翅 | 四声翅响 |
| `bowease` | 收弓 | 两声吱呀 |
| `step` / `hop` / `land` | 步 / 跳 / 落 | 皮鞋步 / flap / 杆 + 步 |
| `crack` / `crackle` / `fireup` / `heat` | 火 | 炸裂 / 密集噼啪 / fwoomp / 低嗡 |
| `water` / `wind` / `cloth` / `room` / `breath` | 环境 | 水 / 风 / 布 / 房间底噪 / 呼吸 |
| `vo{id}` | 旁白 | 读 `voices/<id>.wav` |

---

## 11. 构建链（复用机制）

```
sh styles/shadow-puppet/demo/build.sh
  # 1. lines.json → core/tts/tts.py → asr_check.py
  # 2. events.mjs → music/score.py → mix.py → cues.py + srt.py
  # 3. video.mjs --fps 24 --workers 3 → mux.sh（两遍 loudnorm −14 LUFS，颗粒 2，CRF 22）
  # 4. still.mjs 海报 + 风格帧（重试 3 次）
```

**关键机制**：`story.js` 是唯一真值——画面、字幕、拟音、配乐 cue 全部从它导出；改时间只改一处。`music/score.py` 读同一套时间点（100 BPM），所以任意灯数/箭数都能配到乐。幕后是同一套透射率画布 + 镜像矩阵，不另做一套素材。

---

## 12. 证据

```
styles/shadow-puppet/STYLE.md:1-10      本质三条 + 不是什么
styles/shadow-puppet/STYLE.md:12-24     合成公式/灯光场/布纹/刻皮/景片
styles/shadow-puppet/STYLE.md:26       舞台与幕后（镜像、木框、油灯、艺人的手）
styles/shadow-puppet/STYLE.md:30-35    颜色逻辑（全部透射、3–5 染料、孔最亮、夜=关灯）
styles/shadow-puppet/STYLE.md:39-40    字体与字幕（说书人题板、镂空字皮影牌）
styles/shadow-puppet/STYLE.md:44-51    运动质量（24fps、手抖、惯性、按锣）
styles/shadow-puppet/STYLE.md:57-72    镜头语法 + 转场 + 禁止
styles/shadow-puppet/STYLE.md:76-81    声音（锣鼓经/板胡/唢呐/拟音/duck/静场）
styles/shadow-puppet/STYLE.md:87-93    原生动作（灯即世界、离屏虚、绕幕后、揭条）
styles/shadow-puppet/STYLE.md:97-106   坑（平涂/正面脸/放射纹/灰角/镜像翻转/推镜）
styles/shadow-puppet/STYLE.md:114-118  变化空间（结构/开场/结尾）
styles/shadow-puppet/demo/gl.js:1       画面 = 色调映射(灯光场 × 驴皮透射率 × 布纹) + 前景层 + 辉光
styles/shadow-puppet/demo/gl.js:36      hdr = L * T * cl * (.62 + .38*ed) * expo
styles/shadow-puppet/demo/gl.js:37      色调映射 c = 1.0 - exp(-hdr)
styles/shadow-puppet/demo/gl.js:27-29   每盏灯 = 宽叶瓣 + 紧核心
styles/shadow-puppet/demo/gl.js:32-34   布纹（经纬/纤维/大尺度）+ 四边略暗
styles/shadow-puppet/demo/gl.js:62      暖暗角 mix(..., vec3(.7,.47,.25))
styles/shadow-puppet/demo/gl.js:56      三级降采样辉光
styles/shadow-puppet/demo/gl.js:16      mir = -1 从幕后看
styles/shadow-puppet/demo/gl.js:20      热浪 haze
styles/shadow-puppet/demo/gl.js:18      frontOnly + fade
styles/shadow-puppet/demo/carve.js:1-2  每片驴皮 = 透射率贴图；multiply 重叠变暗
styles/shadow-puppet/demo/carve.js:56-63 hideTexture：multiply 纹理 + destination-in 还原 alpha
styles/shadow-puppet/demo/carve.js:68-75 cut / cutLine（destination-out 镂空）
styles/shadow-puppet/demo/carve.js:82-89 scales 鱼鳞
styles/shadow-puppet/demo/carve.js:91-100 cloud 云头卷
styles/shadow-puppet/demo/carve.js:145-155 lattice 菱形格 / coin 古钱纹
styles/shadow-puppet/demo/carve.js:162-181 flameTongue 火舌 / cutTaper 锥形裂缝
styles/shadow-puppet/demo/carve.js:124-129 rivet 铆钉
styles/shadow-puppet/demo/houyi.js:1    11 片驴皮 + 箭壶 + 弓箭 + 两根翎子；三根操纵杆
styles/shadow-puppet/demo/houyi.js:28   空脸：脸部镂空，只留轮廓与五官细皮线
styles/shadow-puppet/demo/houyi.js:185-192 两段 IK
styles/shadow-puppet/demo/houyi.js:195-216 翎子链条
styles/shadow-puppet/demo/houyi.js:281  画皮用 multiply
styles/shadow-puppet/demo/houyi.js:302-307 世界坐标画铆钉
styles/shadow-puppet/demo/houyi.js:314-321 drawRods 操纵杆（虚、半透明）
styles/shadow-puppet/demo/backstage.js:10-19 silhouette 暖色轮廓光
styles/shadow-puppet/demo/backstage.js:75-86 flame（lighter 加色）
styles/shadow-puppet/demo/backstage.js:88-109 smoke（淡褐 / 近灯暖白）
styles/shadow-puppet/demo/stage.js:6-32  drawFrame 木框 + 内沿受光
styles/shadow-puppet/demo/stage.js:34-45 drawAudience 前排后脑
styles/shadow-puppet/demo/stage.js:47-54 drawPillar 前景立柱
styles/shadow-puppet/demo/stage.js:56-75 plaque 镂空字皮影牌
styles/shadow-puppet/demo/scenery.js:1  景片全是刻出来的驴皮件，幕布大部分留白
styles/shadow-puppet/demo/scenery.js:26 CRACKS 地面裂纹
styles/shadow-puppet/demo/scenery.js:55 焦土 cutTaper 逐渐烧穿
styles/shadow-puppet/demo/scenery.js:167 火焰纹皮件 12fps 抖动
styles/shadow-puppet/demo/main.js:29-41 lampI 灯闪
styles/shadow-puppet/demo/main.js:257   expoFront = 1.75 / √(亮灯数)
styles/shadow-puppet/demo/main.js:105-109 手持微颤 + 张力颤
styles/shadow-puppet/demo/main.js:112-126 翎子/腿惯性预模拟
styles/shadow-puppet/demo/main.js:136   镜头夹紧（不出黑边）
styles/shadow-puppet/demo/main.js:144   亮相急推
styles/shadow-puppet/demo/main.js:281-327 renderBack 幕后 + mir:-1 fade 暖白
styles/shadow-puppet/demo/hud.js:1-20   字幕 = 说书人题板
styles/shadow-puppet/demo/story.js:1-2  100 BPM，1 拍 = 0.6s
styles/shadow-puppet/demo/story.js:3    DUR = 54.4
styles/shadow-puppet/demo/story.js:29-33 SHOTS 镜头表
styles/shadow-puppet/demo/mix.py:13-17  room_ir + verb 小剧场混响
styles/shadow-puppet/demo/mix.py:20-24  woodclap 醒木
styles/shadow-puppet/demo/mix.py:44-47  twang 弓弦
styles/shadow-puppet/demo/mix.py:51-53  snuff 捏灭灯芯
styles/shadow-puppet/demo/mix.py:136    旁白时音乐闪避 12 dB
styles/shadow-puppet/demo/mix.py:144    静场 34.8–36.85
styles/shadow-puppet/demo/music/score.py:59-71 big_gong 哐 / small_gong 台
styles/shadow-puppet/demo/music/score.py:82-95 bangu 板鼓 / tanggu 堂鼓 / muyu 木鱼
styles/shadow-puppet/demo/music/score.py:120-127 急急风 + 亮相大锣
styles/shadow-puppet/demo/music/score.py:152-171 板胡（滑音/揉弦/鼻音）
styles/shadow-puppet/demo/music/score.py:175   苦音偏音 fa↑ / si↓
styles/shadow-puppet/demo/music/score.py:241-247 硬停 gate
styles/shadow-puppet/demo/music/score.py:257   锣刮 scrape
styles/shadow-puppet/demo/music/score.py:273-275 cues 12 段
styles/shadow-puppet/demo/build.sh:9    步骤 4 原创配乐
styles/shadow-puppet/demo/build.sh:12-13 逐帧渲染 + mux
styles/shadow-puppet/demo/tools/mux.sh:5 两遍 loudnorm −14 LUFS
styles/shadow-puppet/demo/index.html:5  画布 1920×1080（WebGL2）
```

---

## 附：字幕区间与时长规则（`tools/cues.py`）

`t1 = t + max(1.8, dur[id] + 0.8)`；若存在下一句则 `t1 = min(t1, 下一句 t − 0.3)`；最后一句截到 `clap2 − 0.15`。与页面 `main.js` 的 `SUBS` 规则一致——**字幕、页面、SRT 三处必须同源**。
