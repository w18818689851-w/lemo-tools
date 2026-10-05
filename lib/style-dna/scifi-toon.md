# 科幻情景喜剧卡通（scifi-toon）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Coffee Run》的具体剧情。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

给成年人看的 2D 电视动画：**会沸腾的均匀粗深色描边**、**平涂 + 硬边阴影块（无渐变）**、**大白眼 + 小瞳孔**、**有弹性的嘴**、又丑又可爱的生物，以及被当成家里破烂用的科幻硬件。喜剧是**对白驱动**的，类型的引擎是「一个极小的日常目标，用荒谬巨大的科幻手段去追」。

**它不是**：给孩子看的卡通（要冷幽默、长停顿）；日式动画（不要闪亮的眼睛）；矢量说明片（线要 boil）。
（`STYLE.md:6-14`）

**版权红线（不可让步）**：绝不复刻任何既有作品的角色、剪影、配色组合、名字、口头禅、打嗝梗、logo，或某个传送枪的外观；自创卡司、道具与传送装置；不要在片子里或文档里写出源类型的作品名，一句 `inspired by adult-swim-era sci-fi sitcom cartoons` 足矣（`STYLE.md:12-14`）。

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **描边** | 近黑（略紫的黑，#1b1422）；角色/道具约 7px、背景细节 4–6px、圆接头；**线宽屏幕空间恒定**（先变换到屏幕坐标再描边）（`toon.js:7,26,131-134`）。 |
| **line boil** | 每条轮廓屏幕空间按 ~7px 重采样，沿法向低频噪声位移，幅度 ~1.7px；12fps 在 3 张 boil 画间循环；**一切都沸腾**，包括保持姿势与背景（`toon.js:27-30,80-110`）。 |
| **填充** | 只有平涂色；阴影是裁在填充内、朝背光侧的硬边深色块（每形体一块）；辉光是 1–2 圈平半透明环，不是渐变；天空是平色带（`toon.js:117-130,151-154`）。 |
| **脸** | 大白眼（3/4 视角相触）、4–5px 瞳孔、厚眼皮做死鱼眼、眼袋；参数化嘴（张开 o、宽 w、卷曲 sm、歪斜 skew）+ 口腔/牙/舌；情绪靠眉毛（`chars.js:15-49`）。 |
| **卡司** | 剪影必须在纯黑下也读得出；给每个主角一个荒谬服装点子；**避开白大褂 + 尖刺头发**（`chars.js:129-288`；`STYLE.md:22`）。 |
| **生物** | 每个世界一只又恶心又可爱的生物；让它不说话（只用音效），片子始终是两位主角的对白；检查被家具挡住的东西还露出脸和上半身（`STYLE.md:23`）。 |
| **传送门** | 全片**唯一发光**的东西：疙瘩边缘 + 粗描边、旋转旋臂、浅色核心、环绕火花、滴落黏液、开门时一层平半透明色；开门轻微过冲（~12%，back-ease ~0.3s）（`worlds.js:17-56`；`main.js:31`）。 |
| **屏幕图形** | 复古终端标签（VT323）逐字打出，颜色随世界变（`main.js:370-383`）。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：两个主角一来一回。一位低沉、平、慢（死鱼眼），一位更高更快（紧张）。

**长度（实测）**：对白单句 **1–14 个英文词（约 5–80 字符）**，短促、口语、可被打断。`Nope.` 这种一词句是主力笑点。打断的句子**故意生成得比需要长，再在对方插话处截断音频**。字幕停留：旁白 ≥ max(1.8s, 语音+0.6s)；快对白用 `max(audio + 0.35s, 0.9s + 字符数/17)`；在世界切换处与**静音拍之前**切断（`main.js:389-390`；`STYLE.md:97`）。

**句首类型**（示例性，不是抄原文）：
- 紧张者结巴：`So, um— the machine's b-b-broken, and the café's closed, and the, uh—`
- 死鱼眼一个字：`Gary.`
- 命令式：`Get your shoes.` / `One coffee. Black.`
- 一词否定：`Nope.` / `Nope?`
- 生物台词（升调）：`Hi!` / `Yep!`
- 回环收尾：`Gary. Get your shoes.`

**这个风格里不会出现的句式**：
- 长段独白或书面解说（对白要短、要能被抢话）。
- 在片名或文档里写出源类型的作品名。
- 照抄任何既有作品的角色、剪影、配色、名字、口头禅、logo。
- 解释笑点（喜剧靠反应镜头，不靠旁白说明）。

---

## 3. 叙事节奏

**信息投放顺序**（极小目标 × 荒谬手段）：

```
实验室（死鱼眼与紧张者的日常）→ 开传送门
  → 果冻宇宙（被打断的第一次尝试）
  → 马克杯宇宙（咖啡在喝人）
  → 三连蒙太奇（牙齿 / 鸽子当政 / 全员是 Vask，同一个「Nope.」越切越快）
  → 可疑地正常的宇宙（平静本身就是笑点）
  → 回家（实验室）→ 咖啡活了、有脸了
  → 冷场反转（'Are you decaf?'）→ 把咖啡丢回传送门
  → 片尾卡（Decaf 在漩涡里挥手）
（demo/story.js:19-30,61-71）
```

**时间挂在 120 BPM 上**：**1 拍 = 0.5s**；每个音乐 cue 的第一拍就是它的剪辑点。

| 层 | 规则 |
|---|---|
| 角色 | **12fps 步进（q）**：姿势、嘴、眨眼、走路、boil 都 12fps |
| 镜头 / 传送门 / 飞行道具 / 转场 | **每帧平滑（24fps）** |
| 规则三连 | 两次慢的错误答案，然后一秒一个世界、按拍切、同一个拒绝词 |

（`story.js:1-6,66`；`STYLE.md:44,87`）

**总时长**：demo **57.5s**；一集通常 40–120s。世界切换点（WIPES）：12.85 / 20.9 / 28.4 / 29.4 / 30.4 / 31.4 / 36.05 秒；三连蒙太奇的世界各只占 **1.0s**（`story.js:33`）。

**静默怎么用**：**静音就是包袱**——在揭示处和冷场处**硬切音乐、连混响尾巴一起切**，只留房间底噪（日光灯嗡、钟表滴答、冰箱）。44.0 的冷场要一块**干净的画面**（`main.js:386`；`STYLE.md:77`）。

---

## 4. 镜头逻辑

**镜头是什么**：一台**对白相机**——中景双人、硬切近景、反应特写、插入特写；转场走传送门漩涡或硬切。

**词汇表**：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 中景双人 | 关系、谁怎么反应 | 对白；对峙；一笔交易 |
| 硬切到近景 | 打断、一张脸崩掉 | 被打断的那句；领悟；一个谎 |
| 插入物件极端特写 | 荒谬的细节 | 一次揭示；问题本身；错误的结果 |
| 反应特写 | 笑点活在脸上 | 每个荒谬图像之后 |
| 紧特写 + 某词上短抖 | 惊慌 | 关键词；警报；尖叫 |
| 冲向传送门 → 漩涡擦除 | 离开一个世界 | 任何地点/时间/版本的跳跃 |
| 同一个取景跨世界重复 | 只有世界在变 | 蒙太奇；对比；一份清单 |
| 对静止双人极慢推入 | 一次冷场 | 反转之后的停顿；一次坦白 |
| 装置与两主角同框的广角 | 整个处境一次看完 | 一次回扣；一个陷阱；一个重新开始 |
| 过肩拍屏幕 | 读坏消息 | 一条消息；一段读数 |
| 两张脸之间甩镜 | 重叠的争吵 | 一场架；一个赌；一个 double take |

**规则**：每个荒谬图像之后必跟一个**反应特写**。**允许的转场**：传送门漩涡擦除（擦除瞬间闪一层浅绿）、硬切。**禁止**：溶解/叠化；把脸放进字幕带（底部约 170px）或让世界标签压到脸。

---

## 5. 表达习惯（idioms）

1. **平行世界**：每次跳 = 新配色、新 cue、新生物。
2. **双人反差**：死鱼眼 vs 惊慌，笑点在两个反应的差里。
3. **规则三连 → 机关枪**：两次慢的错误答案，然后一秒一个世界、按拍切、同一个拒绝词。
4. **可疑地正常的那个世界**：模式被打破，平静就是笑点。
5. **冷场反转**：反转之后一段长静默，然后一句台词揭示角色的价值观。
6. **硬件当破烂**：能扭曲世界的技术被用来干一件鸡毛蒜皮的家务。
7. **回环按钮**：最后一句重复第一句，故事闭环。
8. **每个荒谬图像之后必跟一个反应特写**；目的道具在笑点落地前先进画。
9. **表演胜过运动**：保持姿势做小变化（眼皮抽动、瞳孔滑动、咽口水、汗珠）；空闲生命 = 呼吸（±1% 挤压）+ 由说话响度驱动的点头。
10. **神经质抖动**：12fps 的 3–6px 随机偏移 + 发抖的瞳孔，幅度随惊慌增长；冷场里除了 boil 什么都不动（`STYLE.md:45-50`）。

---

## 6. 氛围

一间昏暗的实验室 / 一座荒谬的平行宇宙咖啡馆：荧光灯、终端读数、一个发绿光的传送门是全场唯一的光源。冷幽默、尴尬停顿、突然的喧闹——像一集成人的科幻情景喜剧在你眼前现场演。

---

## 7. 声音

- **乐器**：**合成配乐，不需要采样**——一条**特雷门琴**式主音（正弦 + 少量二三次谐波、连奏滑音约 70ms、起音后约 150ms 淡入颤音、弹簧混响）压在模拟贝斯、方波琶音与复古鼓机上；小调式与半音线条适合主主题（`music/score.py:1-5`）。
- **每世界一套类型 cue**：冲浪吉他 / 波尔卡手风琴 / 玩具钢琴摇篮曲 / 电梯 bossa（Karplus-Strong 尼龙弦）/ 刷子摇摆 + 颤音琴 / 大号 + 滑哨 / 温暖 Rhodes + 人声 aah / 颤音弦乐做惊慌（`STYLE.md:75`）。
- **拟音（合成）**：传送门开（低频 boom + 下扫噪声 + 上升漩涡）、嗡鸣、贴近的 fwump、每次擦除的漩涡 whoosh、pop/boing、湿滑 glorp/squish、slurp、chomp、眨眼 blip、click-beep、kazoo 尖响、橡皮玩具声（`mix.py:34-85`）。
- **混音规则**：对白两把声音对比——死鱼眼主角低沉平慢（轻度饱和 + 约 180Hz 抬升做沙哑）、紧张者更高更快（存在感提升）；生物升调（+7 半音）说一两个词。人声走 RMS 配平 + 压缩 + 短早反射（约 9–67ms 五次抽头），让它落在同一个房间里。音乐在对话下闪避约 **−7 dB**（`duck = 1 - 0.55*...`）。母带 **−14 LUFS**（`voice.py:25-29`；`mix.py:140-150`）。

---

## 8. 变化空间（可自由发挥）

你要决定：前提、卡司、世界、笑点、开场、结尾、镜头路径、节奏与配色。全部远离 demo。

- **结构**：**一个世界、许多时钟**（两人待在家，装置把他们跳进一天的不同时刻，每次都更糟）；**求职面试**（一个评审团面试来自别的世界的候选人，每人一种类型 cue）；**技术支持电话**（分屏连接两个世界，一个声音引导另一个穿过一场灾难）。
- **开场**：**灾难中途**（传送门已经开着，有东西正在过来）；**说明书**（一段终端读数在见到任何人之前先解释装置）；**错的世界**（我们从荒谬的世界开始，后来才看到家）。
- **结尾**：**困在别处**（装置坏了，他们愉快地住下）；**观众**（某个世界的生物在屏幕上看完整个片子并给它打分）；**代价**（一个安静的收尾镜头，拍这趟差事让某人付出了什么，不搞笑）。
- **可换**：配色、世界数、cue 都可换。
- **不可换**：**会沸腾的恒定粗描边 + 平涂硬边阴影、每世界一套配色、对白驱动的双人反差喜剧**三件不能换，换掉任何一件就不再是这个风格。

---

## 9. 禁忌清单

- TTS 会把连字符结巴读成词（要写成音节 `buh, buh-broken`；把念错的词重拼；起名要能过低沉嗓音）。
- Whisper 听不清很短的片段（除非前后各补约 0.6s 静音）。
- 真的打断：要把被打断的那句生成得**比需要长**，再在对方插话处截断音频。
- 弹性过冲把演员吞掉（要用温和的 back-ease）。
- 食物与液体需要线索（表面细节、滴落、蒸汽），否则会读成别的物件。
- 方波合成镲会混叠成刺耳的 8–20kHz 嘶声（要用带通噪声 + 少量 FM）。
- 持续低于 ~40Hz 的贝斯在笔记本喇叭上是隆隆声（要提高一个八度收尾）。
- 音乐 cue 被硬切但混响尾巴没切 = 不是死寂。
- 复刻任何既有作品的角色、剪影、配色组合、名字、口头禅、打嗝梗、logo 或某个传送枪的外观；也不要使用「酸绿 + 黏液滴落 + 摇晃泡泡字」这套组合（会让人联想到特定作品）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`story.js` 为唯一真值）

| 字段 | 类型 | 说明 |
|---|---|---|
| `DUR` / `ANIM_FPS` / `q(t)` / `BEAT` | — | 57.5 / 12 / 拍两格 / 0.5 |
| `VO{}` | `{id:秒}` | 对白起点 |
| `SHOTS[]` | `[起,止,名,宇宙]` | 镜头表 |
| `WIPES[]` | `[tc,半宽]` | 传送门擦除 |
| `TAGS[]` | `[起,止,编号,描述,底色,字色]` | 世界标签 |
| `T{}` | object | 关键时刻 |
| `CUES[]` | object[] | 配乐 cue（t0 = 第一拍） |
| `lines.json` | object[] | `{id, who, text, sub?, voice, speed, pitch?, cut?, asr?}` |

### 10.2 新画面主体的契约

新增一个角色 = 用 `toon.js` 的矩阵栈 + 形状原语在**世界坐标**里搭，脸用 `chars.js` 的 `eye/mouth/hand`，肢体用 `noodle`；描边自动走屏幕空间 boil 并保持恒定线宽。
新增一个世界 = 在 `worlds.js` 加一个 `export function xxxWorld(t, o)`，给它一套 3–5 色配色（与上一个世界在色相**和**明度上都尽量不同）、一个可选的生物、一个配乐 cue。
新增一个传送门 = 复用 `worlds.js` 的 `portal(cx,cy,r,t,{open,sx,spin})`（`worlds.js:17`；`STYLE.md:29-30,107`）。

### 10.3 时间线契约

- 页面契约：`window.render(t)` / `window.DUR` / `window.EV` / `window.SUBS`；字体在 render 前预载（`main.js:515-516`）。
- `story.js` 是唯一时间真相：画面、字幕、拟音、配乐 cue 全从它导出；每个 cue 的 t0 就是剪辑点。
- 字幕在 `WORLD_CUTS` 处与静音拍之前切断（`main.js:386-390`）。

### 10.4 事件词汇（`events()` → `mix.py` / `score.py`）

| 词 | 含义 |
|---|---|
| `vo{id}` / `cue{...}` | 人声 / 配乐 cue |
| `amb{w,d}` | 世界环境床（lab/jelly/mug/normal/teeth/pigeon/vasks） |
| `plip` / `squeak` / `tic` / `gulp` / `cloth` / `click` | 小动作音 |
| `portalOpen` / `portalHum{d}` / `portalClose` / `portalWhoosh` / `suck` / `whooshBig` | 传送门系列 |
| `pop` / `boing` / `slam` / `thud` | 弹/弹跳/摔/闷响 |
| `gurgle` / `glorp` / `slide` / `squish` / `wetblink` / `slurp{d}` | 湿滑系列 |
| `page` / `lick` / `chomp` / `coo` / `swish` | 纸张/舔/咬/咕咕/挥 |
| `shopbell` / `cupSet` / `bloop` / `blip` / `wheee{d}` / `gulpPortal` / `tOpen` | 商店/杯子/气泡/闪烁/飞行/吞门 |

---

## 11. 构建链（复用机制）

```
sh styles/scifi-toon/demo/build.sh
  # 1. lines.json → core/tts/tts.py → voice.py（按角色处理 + 口型 lips.json）→ asr.py（补 0.6s 静音校对）
  # 2. story.js 的 VO/CUES → events.json → music/score.py（合成配乐）
  # 3. mix.py（拟音 + 对白 + 房间早反射 + duck −7dB）→ mix.wav；levels.py 查各声部电平
  # 4. 逐帧渲染 → 成片；sheet.sh / strip.sh 出接触表与连续帧条
```

**关键机制**：`story.js` 是唯一真值——画面、字幕、拟音、配乐 cue 全从它导出；改时间只改一处。`toon.js` 的矩阵栈 + 屏幕空间描边让线宽在任何景别恒定；`voice.py` 同时产出配音与口型包络（`toon.js:1-4`；`voice.py:33-42`）。

---

## 12. 证据

```
styles/scifi-toon/STYLE.md:3-4           一句话本质 + 参考只借语法
styles/scifi-toon/STYLE.md:6-14          本质 + 不是什么 + 版权红线
styles/scifi-toon/STYLE.md:16-25         材料与渲染（线/boil/填充/脸/卡司/生物/传送门/屏幕图形）
styles/scifi-toon/STYLE.md:27-33         颜色逻辑（每世界一套/线与眼白不变/辉光归装置/正常世界是笑点）
styles/scifi-toon/STYLE.md:35-40         字体与字幕（说话人气泡/时序/片名避雷）
styles/scifi-toon/STYLE.md:42-50         运动质量（12fps/24fps/表演/预备/挤压拉伸/口型/抖动/冷场）
styles/scifi-toon/STYLE.md:52-70         镜头语法表 + 反应特写规则 + 转场
styles/scifi-toon/STYLE.md:72-79         声音（特雷门/类型 cue/静音是包袱/拟音/配音对比）
styles/scifi-toon/STYLE.md:81-91         原生动作七条
styles/scifi-toon/STYLE.md:93-103        媒介陷阱
styles/scifi-toon/STYLE.md:109-115       变化空间（结构/开场/结尾）
styles/scifi-toon/demo/toon.js:1-4       引擎头注释（屏幕空间描边/boil/平涂）
styles/scifi-toon/demo/toon.js:7         INK 略紫黑
styles/scifi-toon/demo/toon.js:26        S：amp 1.7 / lw 7
styles/scifi-toon/demo/toon.js:27-30     frame：boil 12fps 三张循环
styles/scifi-toon/demo/toon.js:80-94     toScreen 屏幕空间 7px 重采样
styles/scifi-toon/demo/toon.js:95-110    boilPts 沿法向噪声位移
styles/scifi-toon/demo/toon.js:117-130   shape（fill → clip 阴影 → outline）
styles/scifi-toon/demo/toon.js:131-134   outline 恒定线宽
styles/scifi-toon/demo/toon.js:151-154   bands 平色带天空
styles/scifi-toon/demo/chars.js:6-8      PAL 角色配色
styles/scifi-toon/demo/chars.js:15-31    eye 大白眼 + 小瞳孔 + 眼皮
styles/scifi-toon/demo/chars.js:33-49    mouth 参数化嘴
styles/scifi-toon/demo/chars.js:50-60    hand 手
styles/scifi-toon/demo/chars.js:129-217  vask 骨架（面条肢体）
styles/scifi-toon/demo/chars.js:218-288  gary 骨架
styles/scifi-toon/demo/worlds.js:10-13   jellyRect 果冻摇摆
styles/scifi-toon/demo/worlds.js:17-56   portal 传送门
styles/scifi-toon/demo/worlds.js:25      疙瘩状边缘
styles/scifi-toon/demo/worlds.js:31-40   旋臂
styles/scifi-toon/demo/worlds.js:46-49   火花
styles/scifi-toon/demo/worlds.js:51-54   滴落
styles/scifi-toon/demo/worlds.js:140     jelly 世界
styles/scifi-toon/demo/worlds.js:215     mug 世界
styles/scifi-toon/demo/worlds.js:277     teeth 世界
styles/scifi-toon/demo/worlds.js:300     pigeon 世界
styles/scifi-toon/demo/worlds.js:319     vask 咖啡馆
styles/scifi-toon/demo/worlds.js:332     正常咖啡馆
styles/scifi-toon/demo/story.js:1-6      时间线真值：DUR 57.5 / ANIM_FPS 12 / q / BEAT 0.5
styles/scifi-toon/demo/story.js:9-16     VO 对白起点
styles/scifi-toon/demo/story.js:19-30    SHOTS（带宇宙）
styles/scifi-toon/demo/story.js:33       WIPES 传送门擦除
styles/scifi-toon/demo/story.js:36-43    TAGS 世界标签（配色）
styles/scifi-toon/demo/story.js:46-58    T 关键时刻
styles/scifi-toon/demo/story.js:61-71    CUES 配乐 cue
styles/scifi-toon/demo/main.js:15-26     talk 口型（12fps 步进）
styles/scifi-toon/demo/main.js:31        popOpen 温和 back-ease
styles/scifi-toon/demo/main.js:33-37     cam 抖动
styles/scifi-toon/demo/main.js:41        landSq 落地挤压 22%
styles/scifi-toon/demo/main.js:71-74     sucked 被吸进门
styles/scifi-toon/demo/main.js:361-368   wipe 漩涡擦除
styles/scifi-toon/demo/main.js:370-383   tag 复古终端逐字
styles/scifi-toon/demo/main.js:385-392   字幕时序 + WORLD_CUTS
styles/scifi-toon/demo/main.js:394-400   wrapSub 1300px 折行
styles/scifi-toon/demo/main.js:401-419   字幕渲染（说话人气泡 + 堆叠变暗 0.7）
styles/scifi-toon/demo/main.js:420-441   片名卡
styles/scifi-toon/demo/main.js:427       片名避雷（不用荧光绿/不做滴液）
styles/scifi-toon/demo/main.js:442-459   片尾卡
styles/scifi-toon/demo/main.js:461-471   render 分发
styles/scifi-toon/demo/main.js:474-513   events 音效事件表
styles/scifi-toon/demo/main.js:515-516   window 契约 + 字体预载
styles/scifi-toon/demo/voice.py:1-6      配音后处理（音高/截断/角色 EQ）
styles/scifi-toon/demo/voice.py:25-29    VASK 饱和 + 180Hz / GARY 提亮
styles/scifi-toon/demo/voice.py:33-42    口型：RMS + 频谱质心 @24Hz
styles/scifi-toon/demo/asr.py:1-3        whisper 前后补 0.6s 静音
styles/scifi-toon/demo/asr.py:12-13      补静音
styles/scifi-toon/demo/levels.py:1-11    各声部电平表
styles/scifi-toon/demo/mix.py:34-48      传送门拟音系列
styles/scifi-toon/demo/mix.py:140-144    人声短早反射（房间感）
styles/scifi-toon/demo/mix.py:149-150    duck 音乐闪避 ≈−7dB
styles/scifi-toon/demo/mix.py:151-152    混音 + limit
styles/scifi-toon/demo/music/score.py:1-5 合成配乐（特雷门/贝斯/方波/鼓机）
styles/scifi-toon/demo/lines.json        对白脚本（who/text/sub/asr/cut）
```
