# 1930 年代橡皮管卡通（rubber-hose）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Coffee Cup Chase》的具体剧情。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

早期有声时代的手绘黑白动画：角色有**橡皮管四肢**（等宽软管、没有肘、没有膝）、**白色四指手套**、**饼状眼**（黑色椭圆瞳孔挖掉一个楔形）、巨大的圆鞋，身体像气球一样挤压拉伸。背景是柔和的灰色水彩画；**一切**（家具、机器、植物、墙壁）都跟着音乐呼吸。画面像一卷磨损的 35mm 拷贝投在 4:3 片门里。

**它不是**：1950 年代的平面卡通（没有有限动画、没有彩色、没有图形化背景）；默片（同步的音乐才是引擎）；盖在现代动画上的「复古滤镜」（没有关节、没有渲染明暗）。
（`STYLE.md:6-10`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **片门** | 1920×1080 输出 + 4:3 片门（1440×1080 居中、两侧黑边），四角圆角 r≈28px，边缘一圈柔和内阴影（`film.js:4,22,58`）。 |
| **描边恒定** | 先把形状变换到屏幕坐标再描边 → 任何景别线宽恒定（1080p 约 6px）；line boil ±1.2px，12fps 在 3 张画间循环（`toon.js:1-4,29-33,120-137`）。 |
| **解剖套件** | 面条肢体等宽（约身高 1/20）、一个平滑弯、圆头；手套 = 掌+3 胖指+拇指+外翻袖口+手背缝线，**只描并集轮廓**；饼眼 = 白椭圆 + 大黑瞳（约 63%×74%）挖右上楔形，眨眼用身体色眼睑；鞋 = 大黑椭圆 + 白脚尖高光（`chars.js:59-77,126-154`）。 |
| **物件角色** | 脸长在身上，一个次要特征承载情绪（蒸汽、火苗、灯罩倾斜、弹簧）；盒状物件是略俯视的投影 3D，脸映射在正面（`cast.js:11-56`）。 |
| **背景** | 一次性画进缓存画布（1.25–1.5× 分辨率），平涂 + 柔和斑块（±5%）+ 内缘变暗 + 细深灰轮廓 + 纸纹；**永不 boil**（`STYLE.md:22`）。 |
| **胶片损伤** | 低频片门抖动 ±1.2px + 偶发小跳；闪烁 ±4%；0–3 条漂移竖划痕；每帧 3–8 粒灰尘；偶尔一根毛发；强晕影；剪接处小跳；轻微模糊（blur 0.55px + contrast 1.14）（`film.js:17-59`）。 |
| **灰阶** | 约 6 级灰 + 一个独立的角色白；**严格灰阶**，任何地方不许有色相（连胶片损伤也不许）（`chars.js:8`；`STYLE.md:27`）。 |
| **对比提升** | 最终合成里 mild contrast boost ≈ 1.1–1.15：1930 年代拷贝是浓黑亮白，从不是平灰（`film.js:23`）。 |
| **颗粒** | 在 ffmpeg 的 mux 阶段加（grain **3**），不在页面里（`STYLE.md:23`）。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位电台播音员在解说一场比赛。第三人称、现在时、广播腔。

**长度（实测）**：字幕是**一张年代字卡**，单句约 **24–56 字符（约 5–12 个英文词）**，一行到两行、绝不折成三行；中文 12–26 字。停留 ≥ `max(1.8s, 语音 + 0.6s)`，**硬上硬下、无淡入淡出**。一张卡可以跨两条短语音，短语音**必须合并**成一张卡以免字幕闪（`story.js:15-22`；`STYLE.md:34,94`）。

**句首类型**（示例性，不是抄原文）：
- 报时/呼告：`Seven a.m., folks! And boy, is this coffee bitter!`
- 出发宣告：`And they're off!`
- 惊叹推进：`Up the china cabinet... what a climber!`
- 警告式：`Look out, folks... the drain!`
- 收束/晚安：`Good night, folks!`

**这个风格里不会出现的句式**：
- 抽象内心独白（这是广播解说，不是意识流）。
- 现代口语、网络梗、emoji。
- 一句塞两个以上并列信息点。
- 照抄任何真实卡通角色的名字、剪影或台词。

---

## 3. 叙事节奏

**信息投放顺序**（一场「追逐 + 变形」的默片式闹剧）：

```
title（片名卡，bar 3.4 像窗帘卷起）
  → wide1（醒来、蘸一口）
  → bitterCU（苦！近景反应）
  → wide2（看见糖罐、对视、起跑）
  → chase（台面横移）
  → toaster（烤面包机）
  → cupboard（盘子木琴 → 勺子滑梯 → 下摇）
  → sink（漩涡、伸胳膊、静音、收回）
  → twoShot（放下、拍拍、转身）
  → leaving（背影走开；方糖犹豫、跳）
  → sweetCU（叮！甜）
  → dance（拉远：全厨房起舞）
  → iris（iris 收拢、被拉上）
  → end
（demo/story.js:25-40）
```

**时间挂在 144 BPM、4/4 上**：**1 拍 = 5/12 s = 10 帧**，1 小节 = 5/3 s。

| 层 | 规则 |
|---|---|
| 角色 | **拍两格（on twos，12fps）**：`q(t) = floor(t*12)/12` |
| 相机 | **拍一格（24fps）**——步进相机读起来会抖 |
| 呼吸 | 每个空闲物件用 `cos(2π·拍数)` 挤压拉伸，**每拍一个极端**（拍点拉长、反拍压扁），幅度约 5–7%，所有道具同相 |
| 输出 | 24fps；1 拍正好是偶数帧（24fps 下 8/10/12/16/20），所以每个拍点都落在两格画上 |

（`story.js:1-10`；`STYLE.md:39-41`）

**总时长**：demo 30 小节 = **50.0s**；短片通常 30–90s。

**静默怎么用**：**乐队一停，一切冻结**（连背景呼吸也停），混响尾巴一起切掉。停在一句凝视、一个笑点之前；bar 18 的第 1–2 拍全静，18.3 一声弹簧「啵嘤」+ 一个柔和钢琴和弦把世界带回来。静音里**唯一允许的声音**是放映机底噪（hiss/crackle/24Hz 片门咔哒）（`story.js:73`；`mix.py:177-184`；`STYLE.md:45`）。

---

## 4. 镜头逻辑

**镜头是什么**：一台**剧场相机**——多数时候锁定，只为跟一个奔跑者或落一个笑点而动。

**词汇表**：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 舞台全景、锁定、平视 | 布景就是舞台，台上人人表演 | 介绍一个地方；群舞；一段例行公事 |
| 硬切到面部近景 | 反应就是笑点 | 一个意外；一次尝味；一次领悟 |
| 跟随奔跑者横移（缓起缓停） | 追逐、动量 | 一场追逐；一次赛跑；一次送达 |
| 中景跟拍（角色占屏高 1/4–1/3） | 每一步都是一个音符 | Mickey-moused 攀爬、跳舞、干活 |
| 随坠落/上升俯仰 | 重力即节奏 | 一次翻滚；一枚火箭；一次吊升 |
| 略高机位、一个不切的长镜 | 危险与解法同框 | 一处危险；一段拉伸；一次营救 |
| 桌面横移（平面角色贴着转动的模型布景） | 世界是真实的地方 | 一条街；一座旋转木马；一层厂房 |
| 从近景拉远成拥挤的中全景 | 一种情绪扩散给所有人 | 一次庆祝；一群人加入 |
| iris 收/放（可被角色抓住） | 片子是实物 | 一个开始；一个结束；带笑点的换场 |

**允许的转场**：iris 开合；按拍硬切；字卡像窗帘一样卷起/放下。

**禁止**：溶解/叠化；为笑点或音乐段落用远景；现代动画式的关节弯曲或渲染明暗；彩色。

---

## 5. 表达习惯（idioms）

1. **万物随拍呼吸**：布景就是角色；高潮时**整个世界**可以同步起舞，连墙都跳。
2. **Mickey-mousing**：每一步都是一个音符；一个道具就是一件乐器。
3. **橡皮管拉伸**：四肢在一个不切的长镜里伸到任意长度。
4. **变形**：任何东西在运动中变成另一样东西。
5. **弹跳球跟唱**：歌词印在字卡上，一个球按拍从一个词跳到下一个词。
6. **片子是实物**：字卡像窗帘卷起；iris 被抓住拉上；字幕卡会被撞；片门线会滑。
7. **墨水瓶**：画师的笔画出主角，主角再和笔吵架。
8. **预备—停顿—动作**：大动作前先下蹲（压扁到 ~0.8）、停住（乐队也停）、再啪地弹出；撞击得到带指数回弹的压扁。
9. **停顿也是表演**：一串停顿、每个眼神落在八分音符上配一声木鱼，读起来就是在思考。
10. **脸部优先**：脸必须读得清，所以不为笑点用远景；目的地道具在笑点落地前先进画。

---

## 6. 氛围

一间 1930 年代风格的厨房，被当成一座剧场：瓷砖、花纹墙纸、棋盘格地板；一切都在嗡嗡地呼吸。像一卷磨损但充满活力的 35mm 拷贝——有灰尘、有划痕、有晕影，但热闹、干净、节奏极准。

---

## 7. 声音

- **乐器**：1930 年代热舞乐队 / ragtime——跨步钢琴、单簧管、小号（开号 + plunger 弱音「哇哇」）、长号（滑音）、大号 oom-pah、2 & 4 拍班卓、刷子军鼓与滚奏、木琴、木鱼、滑哨、镲、卡祖笛、搓衣板、剧场管风琴；**不要弦乐垫、不要现代合成器**；一段短小的原创切分主题可在不同编排里重现（`music/score.py:1-6`）。
- **拟音（按材料合成）**：瓷器/玻璃 = 高硬非谐分音 + 极短瞬态；木 = 木鱼；金属 = 铃与铛；弹簧 = 「啵嘤」；水 = 滤波噪声 + 上升 blip 与气泡；橡胶 = 锯齿波「吱呀」过带通（`mix.py:22-64`）。
- **光学声轨**：拟音 + 配乐之后过一遍带限约 **110Hz–6.2kHz**、轻微抖晃（wow ~0.6Hz、flutter ~7Hz）、柔和饱和；再垫 hiss、crackle 与 **24Hz** 放映机片门咔哒——静音里唯一允许的声音（`mix.py:167-184`）。
- **混音规则**：旁白走电台链（HP ~260Hz / LP ~4.6kHz、tanh 饱和、短房间、压缩）；音乐在人声下闪避约 **8dB**（`mus * (1 - 0.62*duck)`）；响度 **−14 LUFS**（两遍 loudnorm）（`mix.py:163-164`；`STYLE.md:70-72`）。

---

## 8. 变化空间（可自由发挥）

你要决定：地点（或好几个）、卡司、结构、开场、结尾、镜头路径、速度与乐队编制。全部远离 demo。

- **结构**：**一首跟唱**（主歌副歌，弹跳球带着信息，布景把每句歌词演出来）；**一场才艺秀**（物件轮流上台，最小的那个赢）；**一次接力**（一样东西在一座城里手手相传，每次交接都是旋律上的一件新乐器）。
- **开场**：**从墨水瓶里出来**（一支笔画出主角，主角跳上布景）；**幕布升起**（乐队调音，一根指挥棒开启全片）；**一只眼睛上的 iris**（它眨一下，iris 放大，显出这是谁的眼睛）。
- **结尾**：**把字卡拉过来**（角色在搞笑途中把「The End」拖到自己面前）；**胶片断了**（画面烧起来，一只戴手套的手把它接好，鞠最后一躬）；**乐队收摊**（乐器一件件离开，只剩一个音）。
- **可换**：速度、乐队编制、灰阶温度（暖纸灰 / 冷银盐灰 / 微棕）都可换。
- **不可换**：**橡皮管四肢 + 饼眼 + 四指手套的解剖套件、万物随拍呼吸、4:3 片门里的磨损胶片质感**三件不能换，换掉任何一件就不再是这个风格。

---

## 9. 禁忌清单

- 把画面做成平的灰（背景要压到中灰，纯白与墨只留给角色，最后加对比提升）。
- 用远景讲笑点（会把角色变小、Mickey-mousing 读不出）。
- 把「悲伤」的眉毛画成「生气」（眉毛要按内端/外端定义，内端 = 靠近鼻子）。
- 把肢体画在身体剪影之后（要向外踢、向外伸）。
- 画好的角色在某些机位与背景道具穿帮（要检查每个镜头的最后一帧）。
- 一排烟雾读成思考气泡（要散开、放大）。
- 短语音让字幕闪（要合并成一张卡）。
- 任何色彩、任何关节、任何渲染明暗。
- 使用既有卡通角色的名字、剪影、设计、旋律或 logo；尤其**不要**用「人头杯 + 吸管」那类设计——若主角是个物件，**整个物件就是身体**。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`story.js` 为唯一真值）

| 字段 | 类型 | 说明 |
|---|---|---|
| `BPM/BEAT/BAR` | number | 144；BEAT=5/12；BAR=5/3 |
| `bar(b,beat)` | fn | 1 起算的时间换算 |
| `NBARS/DUR` | number | 30 小节 / 50.0s |
| `ANIM_FPS` / `q(t)` | 12 / fn | 角色拍两格 |
| `breath(t)` | fn | 呼吸相位 cos |
| `VO{}` | `{id:秒}` | 旁白起点 |
| `SUBS[]` | `[t0,t1,文本,'b'\|'t']` | 字卡（一张可覆盖多条语音） |
| `SHOTS[]` | `[起,止,名]` | 镜头表 |
| `K{}` | object | 关键时刻 |
| `CUES[]` | object[] | 配乐 cue |

### 10.2 新画面主体的契约

新增一个物件角色 = 用 `toon.js` 的矩阵栈（push/translate/rotate/scale）+ 形状原语（ell/arc/spline/rr/rect/quad/noodle/ribbon）画，脸用 `chars.js` 的 `pieEye/mouth/brow`、脚用 `shoe`、手用 `glove`、肢体用 `hose`，并在 draw 开头调用 `breathe(b)` 让它随拍呼吸（`cast.js:1-8,11-32`；`chars.js:59-154`）。
新增一个镜头 = 在 `SHOTS` 加一行 + 在 `scenes.js` 加 `shotXxx(t)` + 在 `main.js` 的 `FN` 表登记（`main.js:35`）。

### 10.3 时间线契约

- 页面契约：`window.render(t)` / `window.DUR` / `window.SUBS` / `window.EV` / `window.READY`（`main.js:52-59`）。
- `story.js` 是唯一时间真相：画面、字幕、拟音、配乐 cue 全从它导出；时间一律用 `bar(b, beat)` 计算（1 起算）。
- 剪接处片门跳一下：`cutAt` 命中该帧时 `jump = 3`（`main.js:49`）。

### 10.4 事件词汇（`events.js` → `mix.py`）

| 词 | 含义 |
|---|---|
| `porcelain` / `ceramic_low` | 瓷器 / 厚陶瓷 |
| `woodblock` | 木鱼 |
| `sugar_crunch` | 方糖脆响 |
| `slide_whistle` | 滑哨 |
| `boing` | 弹簧 |
| `bell_ring` | 闹钟铃 |
| `water_splash` / `bubble_bed` | 水花 / 气泡床 |
| `rubber_creak` | 橡胶吱呀 |
| `china_crash` | 瓷器碎裂 |
| `whoosh` / `zip_up` / `smack` / `ratchet` | 掠过 / 拉链 / 拍击 / 棘轮 |
| `plip` / `twirl` / `creak` / `zipBack` | 通用动作音 |
| `vo{id}` | 人声 |
| `projector` | 放映机底噪 |

---

## 11. 构建链（复用机制）

```
sh styles/rubber-hose/demo/build.sh
  # 1. story.js 的 VO/SUBS → 配音 + 字幕
  # 2. story.js 的 K/CUES + events.js → music/score.py（大乐队）→ mix.py（拟音 + 电台链 + 光学声轨）→ mix.wav
  # 3. scenes.js 逐帧 → film.js 后期（片门/闪烁/划痕/晕影）→ mux.sh（grain 3 + loudnorm −14 LUFS）→ 成片
```

**关键机制**：`story.js` 是唯一真值——画面、字幕、拟音、配乐 cue 全从它导出；改时间只改一处。`toon.js` 的矩阵栈 + 屏幕空间描边让线宽在任何景别恒定（`toon.js:1-4`）。

---

## 12. 证据

```
styles/rubber-hose/STYLE.md:3-4          一句话本质 + 参考只借语法
styles/rubber-hose/STYLE.md:6-10         本质 + 不是什么（非 50 年代/非默片/非复古滤镜）
styles/rubber-hose/STYLE.md:12-23        材料与渲染（片门/角色/解剖套件/物件/背景/胶片损伤）
styles/rubber-hose/STYLE.md:25-30        颜色逻辑（严格灰阶/角色占极端/一条明暗带/灰阶温度）
styles/rubber-hose/STYLE.md:32-35        字体与字幕（年代字卡/片名 Shrikhand/Limelight）
styles/rubber-hose/STYLE.md:37-45        运动质量（on twos/拍=偶数帧/呼吸/走跑/预备停顿动作/停顿即表演/乐队停即冻结）
styles/rubber-hose/STYLE.md:47-63        镜头语法表 + 转场 + 禁止溶解
styles/rubber-hose/STYLE.md:65-72        声音（热舞乐队/Mickey-mouse/材料拟音/电台链/光学声轨/−14 LUFS）
styles/rubber-hose/STYLE.md:74-84        原生动作七条
styles/rubber-hose/STYLE.md:86-94        媒介陷阱
styles/rubber-hose/STYLE.md:100-106      变化空间（结构/开场/结尾）
styles/rubber-hose/demo/toon.js:1-4      引擎头注释（屏幕空间描边/boil/平涂）
styles/rubber-hose/demo/toon.js:7        INK 墨色
styles/rubber-hose/demo/toon.js:12-26    矩阵栈 + 仿射
styles/rubber-hose/demo/toon.js:22-23    tx / zoom
styles/rubber-hose/demo/toon.js:29       S 全局状态（boil/amp/lw）
styles/rubber-hose/demo/toon.js:30-33    frame：boil 12fps 三张循环
styles/rubber-hose/demo/toon.js:36-40    ell / arc
styles/rubber-hose/demo/toon.js:42-54    Catmull-Rom spline
styles/rubber-hose/demo/toon.js:65-80    noodle 等宽面条肢体
styles/rubber-hose/demo/toon.js:83-97    toScreen 屏幕空间 7px 重采样
styles/rubber-hose/demo/toon.js:98-113   boilPts 沿法向噪声位移
styles/rubber-hose/demo/toon.js:120-133  shape（fill → clip 阴影 → outline）
styles/rubber-hose/demo/toon.js:134-137  outline 恒定线宽
styles/rubber-hose/demo/toon.js:154-157  bands 硬边天空色带
styles/rubber-hose/demo/toon.js:158      wob 摆动工具
styles/rubber-hose/demo/chars.js:8       P 灰阶（白/纸/浅/中/深…/墨）
styles/rubber-hose/demo/chars.js:59-77   pieEye 饼眼 + 楔形瞳孔 + 眼睑
styles/rubber-hose/demo/chars.js:83-90   brow 眉毛
styles/rubber-hose/demo/chars.js:92-124  mouth 嘴型库
styles/rubber-hose/demo/chars.js:126-138 glove 四指手套（并集描边）
styles/rubber-hose/demo/chars.js:147-150 shoe 大黑鞋 + 白脚尖
styles/rubber-hose/demo/chars.js:154     hose 面条肢体
styles/rubber-hose/demo/chars.js:157-186 steam 蒸汽
styles/rubber-hose/demo/cast.js:1        会呼吸的厨房群演
styles/rubber-hose/demo/cast.js:8        breathe 挤压拉伸
styles/rubber-hose/demo/cast.js:11-32    clock（钟面即脸）
styles/rubber-hose/demo/cast.js:35-56    toaster（镀铬）
styles/rubber-hose/demo/cast.js:92-102   plateStair 盘子木琴
styles/rubber-hose/demo/cast.js:123-132  sugarBowl 糖罐
styles/rubber-hose/demo/cast.js:135-147  windowCurtain 会呼吸的窗帘
styles/rubber-hose/demo/film.js:4        GATE 4:3 1440×1080 r28
styles/rubber-hose/demo/film.js:13-24    post：片门抖动 + 对比提升 + 模糊
styles/rubber-hose/demo/film.js:18       低频漂移 + 偶发小跳
styles/rubber-hose/demo/film.js:23       blur 0.55 + contrast 1.14
styles/rubber-hose/demo/film.js:28       亮度闪烁
styles/rubber-hose/demo/film.js:31-37    竖直划痕
styles/rubber-hose/demo/film.js:39-44    灰尘斑点
styles/rubber-hose/demo/film.js:46-51    偶尔一根毛发
styles/rubber-hose/demo/film.js:53-58    晕影 + 片门内阴影
styles/rubber-hose/demo/story.js:1-2     144 BPM，1 拍 10 帧
styles/rubber-hose/demo/story.js:3-5     BPM/BEAT/BAR、NBARS 30、DUR 50
styles/rubber-hose/demo/story.js:6-7     ANIM_FPS 12、q 拍两格
styles/rubber-hose/demo/story.js:10      breath cos 呼吸
styles/rubber-hose/demo/story.js:13      VO 旁白起点
styles/rubber-hose/demo/story.js:15-22   SUBS 字卡（一张可覆盖多条语音）
styles/rubber-hose/demo/story.js:25-40   SHOTS 镜头表
styles/rubber-hose/demo/story.js:44-64   K 关键时刻
styles/rubber-hose/demo/story.js:67-78   CUES 配乐 cue
styles/rubber-hose/demo/main.js:23       字体预载
styles/rubber-hose/demo/main.js:35       FN 镜头函数表
styles/rubber-hose/demo/main.js:49       剪接处片门跳一下
styles/rubber-hose/demo/main.js:52-55    window.DUR/SUBS/EV
styles/rubber-hose/demo/ui.js:5-16       fatTitle（Shrikhand + 墨描边 + 投影）
styles/rubber-hose/demo/ui.js:30-48      subPlate 年代字卡（黑牌 + 双线框 + 角花 + 话筒）
styles/rubber-hose/demo/mix.py:22-23     porcelain 瓷器
styles/rubber-hose/demo/mix.py:36        boing 弹簧
styles/rubber-hose/demo/mix.py:54        rubber_creak 橡胶吱呀
styles/rubber-hose/demo/mix.py:163-164   duck 音乐闪避 ≈8dB
styles/rubber-hose/demo/mix.py:167-168   optical 带限 110–6200Hz
styles/rubber-hose/demo/mix.py:177-184   hiss/crackle/24Hz 放映机底噪
styles/rubber-hose/demo/music/score.py:1-6 大乐队 144 BPM 乐器表
styles/rubber-hose/demo/music/score.py:19-20 BPM/bar 换算
```
