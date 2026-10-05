# 1920 年代默片（silent-film）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Runaway Loaf》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「被放映出来」的单本默片：**4:3 的拷贝夹在影院幕布之间的片门里**，16:9 画面的两侧就是电影院；画面是墨水线 + 银灰水洗的蚀刻插画，印在会闪烁、抖动、划伤、边缘烧焦的银盐胶片上；**没人说话**——节拍靠大全景里的动作和字幕卡来讲；唯一的声音是影院的乐器（立式钢琴 / 簧风琴）和放映间里的放映机。

**它不是**：黑色电影（没有硬阴影当情绪、没有旁白）；给现代动画套一个棕褐滤镜（画本身就是蚀刻上墨的）；卓别林模仿秀（不用流浪汉造型）；带拟音的有声片（**没有拟音、没有人声**）；普通二维动画（它是先做色调绘制、再被 Redraw 上墨、再被印老的三段式）。

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「一张被蚀刻上墨、又被印老了的画」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **两段式画面** | 先在 4:3 画布上做**色调绘制**（只用灰值），再交给 Redraw 上墨。Redraw 是 house style，不是可选效果。 |
| **灰值密度表** | 印片密度大致：墨 0.07、深色布 0.15–0.3、中间木 0.45–0.6、皮肤 0.8、白亚麻 0.9–0.95。水洗只有 5 级 `V = [0.10, 0.24, 0.43, 0.65, 0.90]`。 |
| **Redraw 上墨** | XDoG（两个 σ 的高斯之差）在每条边的**暗侧**出墨线（与色调无关，所以暗部不会被灌满）；亮度 soft-posterise 成约 5 级水洗；暗部加 45° 排线（再交叉）；**排线每 2 帧重画一次**（boil），像手绘重画动画。 |
| **真实素材同源** | 真实视频帧走同一条 ink 通道，于是素材与动画共用一只手。 |
| **Print pass（FilmPost）** | 银色调，sepia 0.1–0.36；印片黑 ≈0.055、白 ≈0.93；S 曲线；高光 halation；全画幅密度不匀；逐帧闪烁；片门抖动（偶发跳格）；断续竖划痕（**白 = 乳剂被刮掉，深 = 底片上的脏**，每条只活几帧、沿长度断开）；从画框边缘爬进来的棕烧；暗角；两个八度的银盐颗粒（中间调更粗）。 |
| **帧外损伤** | 灰尘斑点（白/深各半）、片门里卡住的一根头发（约 10 帧、会摆动）、偶发一次的大污点（像 cue mark）。 |
| **画框** | 1440×1080 居中于 1920×1080，圆角片门（r=22）+ 柔和的暗边；两侧天鹅绒幕布被银幕溢光和脚灯照亮，可开可合。 |
| **人物** | 真实比例（成人 7.5 头身、儿童约 5 头身）在 2.5D 骨架上——关节在 3D 身体空间解算，再用 yaw 正交投影；默片化妆（苍白皮肤、深眼影与深唇）；身份靠剪影记号。 |

**关键取向**：**数值承载一切**——深衣对浅墙、浅脸对深内景；每一镜都要按缩略图检查读不读得出来。**最多一种彩色**：一个元素画进单独的彩色蒙版，穿过印片仍保持自己的色相（仍吃颗粒、闪烁、暗角）；用它标记全片唯一要紧的东西，或干脆不用。

---

## 2. 句式（字幕卡怎么写）

**谁来写**：一个第三人称的叙述者，用几张卡把故事的转折点钉住。字幕卡**就是**字幕（写进 `.srt` 供无障碍）。

**长度（实测）**：每卡 **2–9 个词**（本片：`The loaf / had other plans.` 4 词；`STOP THAT / BAKER!` 3 词；`Is it yours, mister?` 4 词）。全片只 5 张卡（标题 + 3 张叙事卡 + 片尾）。每卡停留 2.5–3.75 s，且 ≥ `max(1.8s, 阅读时间 + 0.6s)`。

**卡的装饰随情绪**（level）：**0 = 喊叫**（一重线，文字抖动）；**1 = 叙述**（双线 + 阶梯角 + 角扇）；**2 = 温柔**（再加藤蔓与小花）。字体：Playfair Display SC（标题/喊叫）、Old Standard TT Italic（叙述/对白）。

**句首类型**（示例性，不是抄原文）：
- 定冠词起句：`The …`（`The loaf had other plans.`）
- 切换地点：`Meanwhile, …`
- 引号里的台词：`“…”`
- 全大写喊叫：`STOP THAT BAKER!`

**这个风格里不会出现的句式**：
- 长句、从句套从句
- 解释画面已经展示的东西
- 现代口语、网络梗、emoji
- 第一人称旁白（默片是第三人称叙述者）
- 一张卡塞两个以上信息点
- 卡与画面同时抢戏（卡只在画面停住时上）

---

## 3. 叙事节奏

**信息投放顺序**（一次「被放映出来」的 photoplay 弧线）：

```
PRE（放映机启动、幕布拉开，无乐）
  → TITLE（Maestoso，主题）
  → 第一场（Andante，主题骄傲地出现）
  → 叙事卡 1（喜剧「uh-oh」+ accelerando 引子）
  → 追逐（Hurry）
  → 第二场（Hurry + 停格的滑稽链条）
  → 叙事卡 2（tremolo 喊叫）
  → 减速（ritardando）
  → 静音（SIL，只有放映机）
  → 叙事卡 3（簧风琴 pp 进入）
  → 温柔（Tenderly，主题放慢）
  → 虹膜（IRIS，收拢；眨眼）
  → END（终曲和弦 + 跑片，幕布合拢）
```

**每段有自己的 tempo**，节拍是「该段的拍」：

| 段 | BPM | 拍数 | cue-sheet mood |
|---|---|---|---|
| PRE | 96 | 2.5 | 放映机启动、幕布拉开（无乐） |
| TITLE | 96 | 6 | Maestoso |
| 第一场 | 96 | 10 | Andante（主题，骄傲） |
| CARD1 | 96 | 4.5 | 喜剧 uh-oh + accelerando |
| CHASE | 144 | 12 | Hurry |
| MARKET | 144 | 16 | Hurry，停格 |
| CARD2 | 144 | 6 | tremolo 喊叫 |
| ROLL | 88 | 6 | ritardando |
| SIL | 60 | 2 | 静音（只有放映机） |
| CARD3 | 72 | 3.5 | 簧风琴 pp 进入 |
| TENDER | 72 | 10 | Tenderly |
| IRIS | 72 | 4 | 虹膜收拢；眨眼 |
| END | 72 | 6 | 终曲和弦 + 跑片 |

**总时长**：主 demo 54.2159 s（`timeline.json` DUR）。单本 45–75 s；一镜一个动作节拍；停格可以停留 5 秒等一个笑点落地。

**静默怎么用**：静音是**真实存在**的一段（SIL，60 BPM × 2 拍）：音乐停、只剩放映机；它框住一个被托住的瞬间。谱面在静音段把总增益拉到 **−30 dB**，混音里放映机在 PRE、SIL 与片尾跑片时被推上来。

---

## 4. 镜头逻辑

**镜头是什么**：一台**沉重的默片摄影机**——大多数镜头是锁定的；开场与结尾由题材决定。它不制造情绪，只把因果一眼摆清（**等待就是笑点**）。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 锁定大全景 | 因果一眼看全；等待就是笑点 | 一个机械笑点；人群；一个繁复的工序 |
| 锁定全景 | 一句前提一帧说清 | 角色的日常；一次对峙 |
| 带前景掠过的跟拍 | 追逐；动量 | 追逐；赛跑；限时送达 |
| 虹膜开 / 合 | 把注意力收到一处；一个念头开始或结束 | 一件物；一张脸；一段记忆 |
| 半开虹膜停住 | 角色与观众交换一眼 | 眨眼；秘密；同谋 |
| 有动机的慢推 | 温柔；顿悟 | 跪下；读信；一个决定 |
| 遮罩镜头（钥匙孔、望远镜） | 视角；偷看 | 侦探；好奇；浪漫 |
| 分屏 / 双重曝光 | 诡计；梦；两地同时 | 一通电话；一个鬼魂；白日梦 |

**允许的转场**（必须来自胶片/影院本身）：虹膜（在摄影机里做，所以会被一起印老）、淡入黑、直切、幕布（开/合；合上时前景重画幕布，脚灯让闭合的天鹅绒仍可见）。

**禁止**：同一场景的镜头之间用叠化；现代甩镜；把大特写用在骨架脸上（会像人偶——特写要么小，要么放在虹膜里）；无动机的运镜。

---

## 5. 表达习惯（idioms）

1. **一条链一个镜头（the chain in one take）**：A 触发 B，B 出画，观众等，B 回来撞 C。
2. **差一点（the near-miss）**：一只手正好合在物体一帧前所在的位置。
3. **字幕卡反转（the intertitle twist）**：一张卡用几个词重构下一镜。
4. **降格混乱（undercranked chaos）**：速度与损伤一起上升（crank > 1 让闪烁更快更强）。
5. **虹膜上的一眼（iris on the look）**：虹膜停在半路，让角色瞥观众一眼。
6. **重画的素材（redrawn footage）**：真实视频推过 ink 通道变成年代画。
7. **回声动作（the echo gesture）**：开头的动作被另一个人重复，意义变了。
8. **死板表演（deadpan）**：脸几乎不变；身体演戏（发力前先蹲、保持姿势、双拍的「两帧急转」、手扶膝）。
9. **物体也演戏**：倒下前先晃、停下前先 ritardando、滚动时 `angle = distance / radius`。
10. **手摇采样**：动作 16fps（降格更快），而闪烁/抖动/颗粒/划痕**每输出帧都变**（24fps）——这个混合让它看起来是「被放映的」，而不只是低帧率。

---

## 6. 氛围

一家小影院：幕布、脚灯、放映间的光束与机器声。银盐的冷、烧过边缘的棕、灰尘与划痕。整体是**喜剧的、有节制的感伤、精确的机械滑稽**——像 1925 年影院里的一场 one-reel。不是黑色电影，不是棕褐滤镜，不是卓别林模仿秀。

---

## 7. 声音

- **乐器**：立式钢琴（VSCO 2 CE upright）——唯一乐器，可加簧风琴（FreePats）。**乐器就是音效设计**。Mickey-mousing 词汇：低音区半音爬行（潜行）、装饰音（眨眼）、前臂音簇（撞击）、渐强的减和弦颤音（等待）、低沉的隆隆颤音（风暴/机器）、`plink … plonk`（空）、减和弦 sforzando（惊吓）、滚奏和弦（门/揭示）、下行滑音（坠落）、低音 `boing`（弹跳）、紧张颤音（犹豫）、小二度（东西碎了）。
- **photoplay idiom**：stride 左手（拍上低音、弱拍中音和弦）；按情绪分段的 cue sheet（Hurry, Misterioso, Agitato, Tenderly, Maestoso）；一个主题回来时被改变。**只用原创音乐。**
- **没有拟音、没有人声**（刻意的）。**放映机就是环境声**：灯闸咔哒（幕布拉开前一瞬）、马达升速（18fps 爬升）、间歇爪 + 马达低鸣（60Hz 家族 + 带限风扇噪声，跟随速度）、收片盘上甩动的胶片（片尾跑片，频率从 14 递减到 4）。静音段只剩放映机。
- **静音**：音乐停、只剩放映机，它框住一个被托住的瞬间。
- **混音规则**：轻压缩驯服钢琴锤击瞬态再归一 **−14 LUFS**；颗粒进画面（mux grain 1，重颗粒用 `-tune grain` 配更高 CRF）。配乐在静音段被段增益拉到 −30 dB。`cuecheck.py` 逐条比较画面卡点与配乐实际写下的卡点，输出 max offset。

---

## 8. 变化空间（可自由发挥）

题材、类型（喜剧 / 情节剧 / 冒险 / 新闻片）、角色、笑点或戏、字幕卡、染色计划、开场与结尾。**保持规则**：单色银盐 + 最多一种彩色 + 动作 16fps / 损伤 24fps + 无拟音无对白。

- **结构**：①一部**新闻片**（一串「报道」，标题卡之间夹一张叙述卡）；②**三本的情节剧**（每本一色：琥珀 / 蓝 / 玫瑰；一张反派卡、一场营救）；③一部**戏法片**（梅里爱式：一个舞台、一个魔术师、物件靠替换剪辑出现与变形）。
- **开场**：从**追逐中段**开始（片已经在放、已经划伤，还没有标题）；先来一张**只有一个问题的字幕卡**（画面之前）；**放映员视角**（从放映间射出的光束，然后是银幕）。
- **结尾**：**片子断了**（拷贝烧穿、灯闸露出白光）；最后一张卡**直接对观众说话**；在锁定的大全景里**淡黑**，钢琴按住一个和弦。
- **角色可替换**：面包师、警察、女仆、报童、发明家、售货员、猫。**道具可替换**：面包、篮子、帽子、信、工具、车轮、伞。
- **染色计划可整体换**：琥珀白天 / 夜蓝 / 玫瑰浪漫 / 只留一种彩色标记唯一要紧的东西。
- **配乐可整体换**：簧风琴、剧院管风琴、小提琴或小合奏，但「乐器就是音效设计、按情绪分段、静音只剩放映机」的规则不变。

---

## 9. 禁忌清单

- **内容太多会毁掉默片**：一个小的多步链在缩略图里就是噪音；一条清楚、中间有停顿的链胜过三条忙乱的。
- **木偶手臂**：要先外展再屈曲；抬臂时肩要升起并前摆；抬高侧躯干的肩角要收窄；手臂压在躯干上时藏起它的轮廓线；抬臂要侧向抬起（或转身），别让手臂穿过脸。
- **姿态跳变**：每个角色必须由缓动的关键帧表驱动，**绝不用 `if` 分支**。
- **飘浮的道具**：道具要夹在两掌之间、落在双臂之间的深度；滚动物体的旋转必须绑到距离（`angle = distance / radius`）。
- **眉角会随朝向翻转**：表情要在最终尺寸的裁切里检查。
- **虹膜在任何镜头缩放后必须在影片坐标里跟踪目标。**
- **抓取必须把手精确放在节拍上物体所在处**，否则读不出来。
- **只被暗银幕照亮的闭合幕布会变成纯黑**（必须加脚灯）。
- **重颗粒会让文件巨大**（用 `-tune grain` 配更高 CRF 重编码）。
- 使用流浪汉造型（圆顶礼帽、牙刷胡、手杖）、任何真实影片的桥段、任何已出版的旋律。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`timeline.js` 为唯一真值）

| 字段 | 类型 | 说明 |
|---|---|---|
| `FPS` | number | 输出帧率 24 |
| `SECS` | `[name, bpm, beats, mood][]` | 速度网格（cue sheet 分段） |
| `SEC` | object | 由 SECS 算出：`{name, bpm, beats, beat, t0, t1, dur, mood}` |
| `HIT` | object | 命名卡点（画面与配乐共享） |
| `CARDS_AT` | `[section, key][]` | 字幕卡出现在哪一段 |
| `CARDS` | object | 字幕卡设计：`{level, lines[{text,font,weight,size,italic,caps,spacing}], gap, shake, dy}` |
| `timeline.json` | `{DUR, SEC, HIT}` | 由 `dump_timeline.mjs` 导出，供 score.py / mix.py / subs.py / cuecheck.py |
| `lines / srt.json` | `[{t0,t1,text}]` | 字幕卡文字（卡就是字幕） |

### 10.2 新画面主体的契约

新角色 = 一个真实比例的 **2.5D 骨架**，必须提供：
- **在 3D 身体空间解算关节**（x 前、y 上、z 角色左），再用 yaw 正交投影（0 = 面向镜头，90 = 面向画面右，-90 = 画面左，180 = 背面），然后每个部件按远近顺序画成「墨线 + 银灰水洗」。
- **BODY 比例**（成人 7.5 头身 / 儿童约 5 头身：neck / headUp / shoulderY / thigh / shin / upper / fore / hand + 躯干 rows 行表）。
- **四肢 strip 宽度剖面**、**5 种手型**（relax / fist / open / grip / point）。
- **头部 spec**（skin / jaw / chin / brow / lip / nose / hair / hat / beard / age / makeup）与在 3D 头上的面部特征（眉 / 眼 / 鼻 / 嘴）——正面、3q、侧面、背面共用同一份数据。
- **姿态 = 缓动的关键帧表**（`poseAt` / `numAt`），绝不用 `if` 分支。

### 10.3 时间线契约

- 页面契约（`main.js`）：`window.render(t)` / `window.DUR` / `window.READY` / `window.EV`；`?scene=file.fn` 渲染测试页。
- `timeline.js` 是唯一真值：速度网格 + 命名卡点 + 字幕卡位置。
- `tools/dump_timeline.mjs` 导出 `timeline.json`，画面、配乐、混音、字幕卡全部从它派生——**改时间只改一处**。

### 10.4 事件词汇

| type | 含义 | 消费者 |
|---|---|---|
| `section` | 一段开始 | 混音/配乐换段 |
| `hit` | 命名卡点 | 画面与配乐共享；`cuecheck.py` 比较 HIT 与 `score.json` 的 keys |
| `card` | 一张字幕卡上 | 写进 `.srt` 供无障碍 |
| `projector` | 放映机 | 灯闸咔哒 / 马达升速 / 爪与马达低鸣 / 片尾甩片 |

---

## 11. 构建链（复用机制）

```
sh styles/silent-film/demo/build.sh
  # 1. dump_timeline.mjs → timeline.json
  # 2. music/score.py → score.wav + score.json
  # 3. tools/cuecheck.py（画面卡点 ↔ 配乐卡点）
  # 4. mix.py → mix.wav（配乐 + 放映机）
  # 5. tools/subs.py → out/srt.json → .srt
  # 6. video.mjs --fps 24 → mux.sh（−14 LUFS，颗粒 1）→ -tune grain 压缩
  # 7. still.mjs 海报 / 风格帧 / 关卡帧 / 重画样张
```

**关键机制**：`timeline.js` 是唯一真值——画面、配乐、混音、字幕卡全部从它导出。`Redraw` 让真实素材与动画共用一只手。`cuecheck.py` 保证「画面卡点」与「配乐卡点」逐条对齐。

---

## 12. 证据

```
styles/silent-film/STYLE.md:8-12       本质四条（被放映的 4:3 / 墨水线银灰 / 没人说话 / 唯一的声音）
styles/silent-film/STYLE.md:14         不是什么
styles/silent-film/STYLE.md:18-21      色调绘制 + Redraw / Print pass / 画框 / 人物
styles/silent-film/STYLE.md:25-28      颜色逻辑（单色银盐 / 数值承载 / 最多一种彩色 / 整场染色）
styles/silent-film/STYLE.md:32-35      字幕卡（停留规则 / deco 边框随情绪 / 年代字体 / 每卡几个词）
styles/silent-film/STYLE.md:39-42      运动质量（手摇采样 / 速度是情绪 / 死板表演 / 关键帧缓动）
styles/silent-film/STYLE.md:46-59      镜头语法 + 转场 + 禁止
styles/silent-film/STYLE.md:63-67      声音（乐器即音效设计 / photoplay idiom / 无拟音 / 静音 / 混音）
styles/silent-film/STYLE.md:73-79      原生动作七条
styles/silent-film/STYLE.md:83-91      坑（内容太多 / 木偶手臂 / 姿态跳变 / 飘浮道具 / 眉角 / 虹膜 / 抓取 / 幕布变黑 / 重颗粒）
styles/silent-film/STYLE.md:95         engine 文件表
styles/silent-film/STYLE.md:99-103     变化空间（结构 / 开场 / 结尾）
styles/silent-film/demo/timeline.js:3  FPS = 24
styles/silent-film/demo/timeline.js:6-20 SECS 速度网格与 cue-sheet mood
styles/silent-film/demo/timeline.js:24-28 每段 beat = 60/bpm，dur = beat × beats
styles/silent-film/demo/timeline.js:34-69 HIT 命名卡点
styles/silent-film/demo/timeline.js:72 CARDS_AT 字幕卡位置
styles/silent-film/demo/film.js:3      帧管线：色调 4:3 → Redraw → 虹膜 → FilmPost → 灰尘 → 片门
styles/silent-film/demo/film.js:4      运动 16fps 采样，闪烁/抖动 24fps
styles/silent-film/demo/film.js:14     W1920 H1080 FW1440 GATE
styles/silent-film/demo/film.js:21-26  LOOK 每段的 crank/str/sepia/fps
styles/silent-film/demo/film.js:61     幕布：开场分开、结尾合拢
styles/silent-film/demo/film.js:68     闭合时前景重画幕布 + 脚灯
styles/silent-film/demo/film.js:92-107 虹膜在影片坐标里
styles/silent-film/demo/film.js:110-114 events() 输出 section 与 hit
styles/silent-film/demo/engine/ink.js:6 V = 五级水洗值
styles/silent-film/demo/engine/ink.js:13 mode 'tonal' 是 house style
styles/silent-film/demo/engine/ink.js:59-93 ink：变宽、收尖、暗侧更重、boil 每 2 帧重掷
styles/silent-film/demo/engine/ink.js:96-106 wash：柔光渐变 + 斑驳
styles/silent-film/demo/engine/ink.js:110-137 hatch：45° 平行线，从暗侧淡出
styles/silent-film/demo/engine/ink.js:141-163 form = wash + hatch + contour
styles/silent-film/demo/engine/ink.js:171-181 drawShape：任何路径都能按本风格画
styles/silent-film/demo/engine/ink.js:215-235 shade：背光侧的月牙
styles/silent-film/demo/engine/redraw.js:5-7 管线（XDoG → 5 级水洗 → 排线，每 2 帧重画）
styles/silent-film/demo/engine/redraw.js:65-67 DoG 带通：墨在边的暗侧
styles/silent-film/demo/engine/redraw.js:70-74 水洗柔 posterise
styles/silent-film/demo/engine/redraw.js:76 排线 bk = floor(frame/2)
styles/silent-film/demo/engine/film.js:5-12 FilmPost 参数表
styles/silent-film/demo/engine/film.js:46-58 竖划痕（白 = 乳剂刮掉，深 = 底片脏）
styles/silent-film/demo/engine/film.js:60-64 棕烧从边缘爬入
styles/silent-film/demo/engine/film.js:68-72 银盐颗粒：两八度，中间调更粗
styles/silent-film/demo/engine/film.js:74-78 色调：中性银 → sepia
styles/silent-film/demo/engine/film.js:80-89 唯一的一种彩色（蒙版保持色相）
styles/silent-film/demo/engine/film.js:114-121 weaveAt 片门抖动 + 跳格
styles/silent-film/demo/engine/film.js:122-126 flickerAt 逐帧闪烁
styles/silent-film/demo/engine/film.js:152-180 damage 灰尘/头发/污点
styles/silent-film/demo/engine/cards.js:8-44 decoBorder（level 0/1/2）
styles/silent-film/demo/engine/cards.js:47-70 intertitle 黑漆卡 + 年代衬线 + shake
styles/silent-film/demo/engine/cards.js:73-79 iris
styles/silent-film/demo/engine/cards.js:82-106 theatre 黑观众席 + 天鹅绒幕布 + 脚灯
styles/silent-film/demo/engine/figure.js:2-5 2.5D + 7.5 头身
styles/silent-film/demo/engine/figure.js:18-30 BODY 比例表
styles/silent-film/demo/engine/figure.js:51-96 solve 3D 解算
styles/silent-film/demo/engine/figure.js:79 先外展再屈曲
styles/silent-film/demo/engine/figure.js:99-106 projector 正交 + yaw
styles/silent-film/demo/engine/figure.js:181-195 5 种手型
styles/silent-film/demo/engine/figure.js:290-291 手臂压在躯干上时跳过轮廓点
styles/silent-film/demo/engine/figure.js:394-407 runPose
styles/silent-film/demo/engine/figure.js:409-417 walkPose / walkBob
styles/silent-film/demo/engine/heads.js:2 真实比例 + 默片化妆
styles/silent-film/demo/engine/heads.js:10-45 drawHead（正面/3q/侧面/背面共用数据）
styles/silent-film/demo/engine/heads.js:155-177 关键光阴影形状
styles/silent-film/demo/engine/heads.js:228-237 眉毛（随朝向翻转）
styles/silent-film/demo/sets.js:8-16 sky（正色片，天空几乎印成白）
styles/silent-film/demo/sets.js:20-67 house
styles/silent-film/demo/sets.js:94-108 street（鹅卵石）
styles/silent-film/demo/sets.js:151-159 melon
styles/silent-film/demo/sets.js:185-188 contactShadow
styles/silent-film/demo/shots.js:1-2 每一镜画一张色调 4:3 帧
styles/silent-film/demo/shots.js:23-36 poseAt / numAt 缓动关键帧表
styles/silent-film/demo/shots.js:40-46 palmsAt 两掌交汇点
styles/silent-film/demo/shots.js:48 锁定全景
styles/silent-film/demo/shots.js:129 真实滚动旋转 rot = 距离/半径
styles/silent-film/demo/shots.js:138-139 带前景跟拍、降格
styles/silent-film/demo/shots.js:177-178 前景灯柱视差 1.35
styles/silent-film/demo/shots.js:181 锁定，整条链一个镜头
styles/silent-film/demo/shots.js:201-213 see-saw 与瓜
styles/silent-film/demo/shots.js:331-333 tenderCam 有动机的慢推
styles/silent-film/demo/shots.js:391-394 girlFace 影片坐标
styles/silent-film/demo/cardspecs.js:2-15 CARDS 字幕卡设计
styles/silent-film/demo/cardspecs.js:5 CARD2 喊叫卡
styles/silent-film/demo/stage.js:5 FW/FH/GATE
styles/silent-film/demo/stage.js:12-21 shoot：画场景 → 冲洗 → 灰尘
styles/silent-film/demo/stage.js:23-34 gate：放进片门 + 柔和暗边
styles/silent-film/demo/main.js:10-19 window.render(t) 契约
styles/silent-film/demo/main.js:20-21 window.DUR / window.READY
styles/silent-film/demo/index.html:5 画布 1920×1080
styles/silent-film/demo/mix.py:2-3 没有拟音；放映机是环境声
styles/silent-film/demo/mix.py:15-20 claw 间歇爪
styles/silent-film/demo/mix.py:21-33 放映机速度曲线
styles/silent-film/demo/mix.py:34-38 马达/风扇低鸣
styles/silent-film/demo/mix.py:39-43 片尾甩片
styles/silent-film/demo/mix.py:44-45 灯闸咔哒
styles/silent-film/demo/mix.py:46-50 放映机电平曲线
styles/silent-film/demo/mix.py:53-56 轻压缩驯服钢琴瞬态
styles/silent-film/demo/music/score.py:1-5 按 cue sheet 分段的原创配乐
styles/silent-film/demo/music/score.py:32-38 gliss 白键滑音
styles/silent-film/demo/music/score.py:39-45 trem 颤音
styles/silent-film/demo/music/score.py:46-53 stride 左手
styles/silent-film/demo/music/score.py:74-77 紧张颤音
styles/silent-film/demo/music/score.py:78-82 坠落/弹跳/双拍
styles/silent-film/demo/music/score.py:107-110 plink … plonk
styles/silent-film/demo/music/score.py:115 前臂音簇
styles/silent-film/demo/music/score.py:117-118 停格悬念
styles/silent-film/demo/music/score.py:142-143 SIL 静音
styles/silent-film/demo/music/score.py:169 眨眼 = 装饰音
styles/silent-film/demo/music/score.py:176-184 小影院混响 + 段增益（静音 −30 dB）
styles/silent-film/demo/tools/cuecheck.py:1-9 画面卡点 ↔ 配乐卡点
styles/silent-film/demo/tools/subs.py:1 字幕卡就是字幕
styles/silent-film/demo/build.sh:6 步骤 1 dump_timeline
styles/silent-film/demo/build.sh:9 步骤 4 配乐 + 放映机
styles/silent-film/demo/build.sh:12-13 合成 −14 LUFS + -tune grain
styles/silent-film/demo/timeline.json:2 DUR 54.2159
```

---

## 附：cue check（画面卡点必须与配乐卡点对齐）

`tools/cuecheck.py` 逐条把 `timeline.json` 的 `HIT` 与 `music/score.json` 的 `keys` 对齐，打印每条的毫秒偏移与 `max offset`。**这是本风格的验收硬指标**：一张卡、一个虹膜、一次坠落，配乐必须落在同一帧上。
