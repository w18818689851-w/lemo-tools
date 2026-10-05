# 一笔画（one-line）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Line That Never Lifted》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一根**从不离纸**的墨线：屏幕上的一切都是那根线在被画出来——角色、地点、物件，甚至时间。没有剪切，场景不切换，它们**变形**（上一幅画最后一笔就是下一幅画的第一笔）。除了墨只有纸，以及一支笔的柔和影子。最多一个强调色，只用一次。

**它不是**：白板讲解（没有手、没有马克笔、没有擦除、没有文字堆满的板）；水墨（没有调子、没有把笔晕当外观）；有剪切、有多笔的线稿动画。
（`STYLE.md:13`）

---

## 1. 材料与渲染的硬规则

任何画面元素都必须能被解释成「那根线上的一个点」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸** | 暖白 `#F4EFE4`；程序化斑驳（1400 单位图块、soft-light）、长纤维（260 单位图块，拉远时淡出否则闪烁）、近景时墨上叠一层稀疏「纸齿」斑点、暗角 0.13 乘算。所有纹理锚定在纸上，随镜头移动。 |
| **墨** | 暖黑 `#1D1A17`，是围绕路径的**填充多边形**（不是 `ctx.stroke`），每个点与纸色混合成不透明色调。 |
| **笔压** | 宽度 = 当前「声音」基准宽 × 笔压 × 细噪声（±8%）；笔压来自速度 `0.66 + 0.8·exp(−v/300)`（快 = 细，慢 = 粗）。 |
| **线的年龄** | 基准宽（纸单位）：child 2.4（alpha .82）、teen 2.5、adult 2.9（.96）、love 2.8、old 2.7（.93）、kid 2.0（.76）。边界处约 ±60 单位平滑过渡。 |
| **墨渗** | 同一个多边形略微加宽，画到离屏层，模糊（≈0.9×zoom px）后以 22% 合成回来。 |
| **积墨** | 速度低于 45 单位/s 的点加一个圆墨点。 |
| **颤抖 / 飞白** | 老年：垂直颤抖（两个噪声八度，幅度至 ~1.1 单位）+ 长尺度噪声的飞白 + 三根细笔毫轨迹；**最后一笔前把干度再降回来**，让最后的手势清晰。 |
| **停笔** | 一个**泪滴形墨点**：尖在笔尖、肚往下坠着摊开、边缘一道深色水线。 |
| **屏幕空间最小线宽** | 拉远时把用于线宽的缩放 clamp 到 ≥ 1.3（揭示时约 3–4px）；否则最终画面像铅笔稿、失去分量。 |
| **笔** | 从不被画出来：只有笔尖一个柔和模糊的楔形阴影（长 ≈ 560×zoom px，alpha .15）+ 1–4px 接触点；手只在交接时以影子出现，每只手合成一个平层（免得重叠处变暗）。 |
| **路径设计** | 章节写成 SVG path 字符串，按弧长采样、用切线连续的连接器连接、时间按曲率加权分配到每个点。 |

**关键取向**：`STYLE.md:9`——**没有填充、没有阴影、没有第二种线重、没有背景美术**。屏幕上除墨以外只有纸和笔的影子。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一个温暖、回顾式的旁白，像长者在纸上慢慢回望一生；第三人称陈述为主，结尾转成第二人称把笔交出去。

**长度（实测）**：demo 6 行，最长 **37 字符**（`For a while, one line was enough for two.`），最短 **16 字符**（`Your turn now.`）。

**字幕是「写」出来的**：手写体（Caveat），墨 84%，**无框**，底部居中（基线距底 100px），从左到右写出（约 0.2s + 每字符 17ms），背后一层柔和纸色光晕（让经过的墨线永远不穿过字母），约 0.45s 淡出。停留 ≥ `max(1.8s, 语音 + 0.6s)`。

**句首类型**（示例性，不是抄原文）：
- 普遍化开场：`Everyone begins by …`（把个体的一生说成所有人的一生）
- 转折推进：`Then someone …`
- 时间 + 数字：`For a while, one line was enough for two.`
- 停顿句：`Sometimes the line stops.`（短句直接对应笔停）
- 接续句：`And then it goes on.`
- 交棒的祈使：`Your turn now.`

**这个风格里不会出现的句式**：
- 长句、从句、书面语（每句都要像纸上留白一样短）
- 说教、抽象名词堆叠
- 一句塞两个信息点
- 与墨线抢注意力的排印（字幕永远让线通过，不能有框、不能遮画）
- 关键词落在非画面拍点上（关键词必须落在 whisper 逐词时间戳对应的画面卡点上）

---

## 3. 叙事节奏

**情感弧**（demo 的读法，只是一种）：

```
空白纸上一触（前 3 秒钩子）
  → 快而轻的早期章节
  → 唯一一个彩色章节
  → 一次停顿（静默、墨洇开）
  → 线继续、但已改变
  → 最后缓慢的笔画，同时镜头拉远
  → 整幅画，保持
  → 一个把笔交出去的尾奏
```

**时间规则**：**全部 on ones（24 fps）**——吸引力来自连续的作画动作，步进会破坏它。

| 层 | 规则 |
|---|---|
| 章节 | 每章有一个时间窗（秒），窗内每点时间按 `1 + K·turn` 加权（急转弯分到更多时间，平滑处理保证速度不跳变） |
| 音乐卡点 | 用 mark 钉住：按弧长分数 `f`，或按位置 `at:[x,y]`（「笔第二次经过鼻子」）；一次停顿 = 同一位置的两个 mark |
| 拐角 | 局部速度最低 + 高转角 → 导出为候选音符起音 |
| 速度 | 行进线 300–700 单位/s，小细节（手指、睫毛）50–150；全片最重要的一笔通常最慢 |
| 重描 | 合法且不可见（只会略微加粗） |

**总时长**：主 demo 47.5s（`style.json`）。这种片子的甜点区是 **30–60 秒**；再长，连续作画的专注感会变成疲劳。

**静默怎么用**：静默是**字面的**——停笔时把音乐总线归零（包括混响尾巴），房间底噪降到 15%。demo 的停笔墨点在 23.8s 出现、持续 3.05s。这是这个媒介最强的一个节拍（失去、怀疑、一个决定）。

---

## 4. 镜头逻辑

**镜头是什么**：一个**连续**的镜头运动：构图中心、缩放、几度转动、以及一个跟拍权重 f（0 = 纯构图，1 = 锁死笔尖）。跟拍点是笔尖在 **−0.55…+0.4s** 的加权平均（先有延迟、再带一点预判），一个软约束把笔尖保持在画面中央约 **72%×66%** 之内。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 跟笔尖（高跟拍权重） | 行进；动量；一条时间线 | 一段旅程；一个过程；一条时间线 |
| 构图帧、低跟拍权重 | 一个必须被整体读到的场景 | 一幅小品；一个笑话；一张图解 |
| 对笔尖的微距 | 亲密；正在制作 | 第一次触纸；一个签名；一个细节 |
| 保持 + 缓慢推近 | 分量；一次停顿 | 失去；怀疑；一个决定 |
| 镜像构图 | 跨时间的韵脚 | 父母与孩子；前后对比 |
| 连续拉远 | 一切都曾是同一幅画 | 尺度揭示；一张地图；一个词 |
| 横移、线在前面跑 | 地平线；一张图表；一场赛跑 | 股价图；一次心跳；一条路 |
| 随线翻滚 | 眩晕；玩 | 一个翻筋斗；一次坠落；一支舞 |

**允许的转场**：**没有剪切。转场是变形**——一幅图像的最后笔是下一幅图像的第一笔。

**禁止**：任何剪切；淡入淡出、溶解；填充、阴影、第二种线重、背景美术；把手、马克笔或擦除画进画面。

---

## 5. 表达习惯（idioms）

1. **笔从不抬起**：任何本身连续的东西（一条河从源头到海、一场接力、一条产线）。
2. **线就是时间**：笔画的性格随年龄、心情或劳损而变。
3. **变形**：一幅图像变形成下一幅；场景不切，它们变形。
4. **停顿是一个事件**：笔尖停下、墨洇开、音乐切成静默（1.5–3s）。
5. **反向设计的尺度揭示**：每个近景小品都是一个最终大画面的秘密部分。
6. **交接**：笔传到另一只手上（以影子出现），一条新线开始。
7. **线作为图表**：线变成一张图表，同时仍然是一幅画。

---

## 6. 氛围

一张暖白纸上的安静工作台：只有墨、纸和笔的影子。整体是「看着一个人一口气画完」的专注与温柔；纸的质感在画面里，墨是暖的近黑，光很轻。

---

## 7. 声音

- **音乐**：一件**独奏乐器、一条不间断的旋律线**——作画的听觉等价物：弓弦或拨弦（大提琴、小提琴、中提琴、竖琴）、独奏木管、哼唱的人声、单把吉他。第二音色只作为稀有强调（一声钟、一段拨弦）。**没有 pad。**
- **写给画**：关键音落在 mark 与拐角上；线快 = 短音；线停 = 一个长音淡入静默；最高的音落在最重要的一次触碰上。
- **笔在纸上是最重要的声音**，从笔速合成：带通噪声（快时亮 2.2–7.5kHz、慢时暗 0.7–2.4kHz），随机纸纤维 tick 的密度 ∝ 速度，振幅 ∝ √速度，随笔尖的屏幕位置 pan；被干笔空隙打断；年轻的手更轻更颠。另加：第一触的一声木嗒、墨点几乎听不见的湿涨、交接的一声小摩擦、一次翻页。
- **静默是字面的**：音乐总线归零（含混响尾巴），房间底噪降。
- **混音**：音乐在人声下 duck **≈5 dB**、笔 **≈4 dB**；整体 **−14 LUFS**；**grain 0**（纸纹在渲染里）。

---

## 8. 变化空间（可自由发挥）

你决定线画什么、是否揭示一幅最终画面、它在哪里停、强调色（或没有）、开场和结尾。

`STYLE.md:106-108` 给了远离 demo 的方向：
- **结构**：**一根线是一个图表**（一条数据序列画成一条地平线，每个峰和谷变成一个场景）；**两条线**（从对角开始、交替绘制直到相遇）；**一个环**（线画完一个场景，再沿原路退回起点，而起点此刻有了别的含义）。
- **开场**：**以速度在半途**（笔已经在纸上跑）；**一幅完成的画**，其线随后散开成故事；**一个用连笔写下的词**，最后一个字母变成第一个场景。
- **结尾**：线**跑出纸的边缘**、继续；**墨用完了**，最后一笔淡成干刮痕；笔在最后一笔前**停在纸上方的半空**。

所有这些都必须守住同一条铁律：**线的连续性就是意义**——每个最终画面的区域只被画一次，连接器必须落在自然线上。

---

## 9. 禁忌清单

- 杂散连接器毁掉揭示——每多一条线都会读成皱纹、胡子或面具；要修**拓扑**（每章从哪里进、从哪里出），不要修画。
- 最终画面的每个区域只画一次；连接器必须落在最终画面的自然线上。
- 像欧拉路径一样规划拓扑：闭合的母题（如嘴）是一个回路——你从进的地方出。
- 线画得太近，加宽后会编成辫子——留出 ≥ 5 单位的缝。
- 圆墨点会读成一颗痣——要做成下垂的泪滴。
- 拉远时线太细——clamp 用于线宽的缩放。
- 半透明的手影在重叠处会加倍变暗——每只手合成一层。
- 标题随镜头移动撞上画——检查标题窗口的每一帧。
- whisper 误听短句——改句子，而不是硬刚。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容需要驱动的东西

最终画面（SVG path 字符串）、章节表（时间窗、marks、holds、style 年龄）、旁白行、标题、强调色区间、交接时刻。

### 10.2 新「画」模块的契约

必须导出 `SEGS`：每段 `{id, style, t:[t0,t1], parts:[{d, tf}], slowK, marks?, holds?}`，其中 `d` 是 SVG path 字符串、`tf` 是可选变换、`style` 是线的年龄（`child`/`teen`/`adult`/`love`/`old`/`kid`）、`marks` 是音乐卡点（按弧长分数 `f` 或位置 `at:[x,y]`）、`holds` 是停顿墨点。

### 10.3 时间线契约

`story.js` 是时间线唯一真值，导出 `DUR`、`VO`、`TITLE`、`HAND`、`END`。页面契约由 `main.js` 暴露 `window.render(t)` / `window.DUR` / `window.EV` / `window.SUBS` / `window.READY`。几何层 `geom.js` 导出 `buildPath`/`headAt`/`posAt`；镜头层 `cam.js` 导出 `camAt`/`worldToScreen`/`BASE`。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者 |
|---|---|---|
| `track` | 笔速轨迹（200Hz，含速度 / 屏幕 x / 风格 / 干度） | 笔声合成 |
| `corners` | 拐角（高转角 + 局部速度最低） | 候选音符起音 |
| `tap` | 第一触 | 木嗒 |
| `blot` | 停笔墨点 | 湿涨 |
| `chime` | 新线开始 | 钟声 |
| `handoff` | 交接 | 摩擦 |
| `vo` | 人声 | 加载 voices/<id>.wav |
| `seg` | 段落起止与标记时刻 | 配乐 cue |

---

## 11. 构建链（复用机制）

```
styles/one-line/demo/
  face.js    THE drawing：每章一段 SVG path 字符串 + 变换，以及章节表（时间窗、marks、holds）
  geom.js    按弧长采样 SVG path、加切线连续连接器、分配时间（曲率加权、marks、holds）
  ink.js     线渲染器（笔压、墨渗、积墨、颤抖、飞白、红线区间、泪滴墨点、屏幕最小宽度）
  paper.js   程序化纸、纤维、纸齿、暗角        cam.js    构图关键帧 + 笔尖跟拍 + 软约束
  shots.js   镜头关键帧                          hands.js  笔影与手影
  story.js   人声/字幕/标题/交接时间的唯一真值
  subs.js    写出来的字幕、标题、片尾卡          main.js   render(t)、调试模式、给混音的事件
  lines.json 人声脚本   music/score.py 独奏大提琴配乐   mix.py  笔刮 foley + 人声 + 音乐   build.sh
```

```
sh styles/one-line/demo/build.sh
  # 1. 在 face.js 里设计最终画面，用 still.mjs 反复看（?all=1&nopen=1&nosub=1&cams=...）
  # 2. TTS → asr_check；读 voices/words.json 把行放进 story.js
  # 3. 在 face.js 设章节窗与 marks；tools/probe.mjs 打印段落边界与笔尖轨迹来写镜头键
  # 4. events.mjs → score.py → mix.py
  # 5. video.mjs --fps 24 → mux
```

**关键机制**：`face.js` 是**唯一**的「画」——换一个最终画面（新的 path 字符串 + 章节表），几何层、墨渲染、镜头跟拍、配乐卡点全都自动跟着走。所以「可换内容重跑」在这里的形态是：**换一幅画，其余不变**。

---

## 12. 证据

```
styles/one-line/STYLE.md:3           一句话定义
styles/one-line/STYLE.md:4           参考语汇与不可复制项
styles/one-line/STYLE.md:8-11        本质四条
styles/one-line/STYLE.md:13          不是什么
styles/one-line/STYLE.md:17-27       纸/墨/笔压/墨渗/积墨/颤抖飞白/泪滴/最小宽度/笔不画/路径
styles/one-line/STYLE.md:31-33       颜色逻辑
styles/one-line/STYLE.md:37-38       字幕与标题的「写出来」
styles/one-line/STYLE.md:43-46       运动质量
styles/one-line/STYLE.md:50-63       镜头词汇表 + 无剪切
styles/one-line/STYLE.md:67-72       声音
styles/one-line/STYLE.md:78-84       七个 native move
styles/one-line/STYLE.md:88-96       媒介陷阱
styles/one-line/STYLE.md:104-108     变化空间
styles/one-line/DEMO.md:3            不要复用故事/叙事弧/镜头/道具/时长
styles/one-line/DEMO.md:5            demo 名与 47.5s
styles/one-line/DEMO.md:8            30–60s / 一笔画完一生 / 最终揭示
styles/one-line/DEMO.md:12-16        一根连续线 / 一切都是线 / 参考语汇
styles/one-line/DEMO.md:18-26        五个 native power 的故事用法
styles/one-line/DEMO.md:28           改编主题的配方
styles/one-line/DEMO.md:30           40–50s 情感弧
styles/one-line/DEMO.md:34           镜头连续运动 + 跟拍点 + 软约束
styles/one-line/DEMO.md:36-44        逐拍镜头表
styles/one-line/DEMO.md:46-49        on ones / 时间=章节窗+曲率 / 拐角 / 速度
styles/one-line/DEMO.md:53-57        配乐 / 静默 / 笔声 / 人声
styles/one-line/DEMO.md:61-67        反向设计 + 欧拉拓扑 + 重描 + 测揭示
styles/one-line/DEMO.md:69-82        纸/墨/颜色/笔的实测数值
styles/one-line/DEMO.md:86-88        字幕/标题/片尾卡
styles/one-line/DEMO.md:92-103       实测坑
styles/one-line/DEMO.md:108-124      模块图与构建步骤
styles/one-line/demo/story.js:2-13        DUR/TITLE/VO/HAND/END
styles/one-line/demo/ink.js:4-6           PAPER/INK/RED
styles/one-line/demo/ink.js:8-15          STY 六种线的年龄
styles/one-line/demo/ink.js:18-74         prepare()
styles/one-line/demo/ink.js:27-34         红线区间
styles/one-line/demo/ink.js:36-42         老年颤抖/飞白
styles/one-line/demo/ink.js:55-59         笔压宽度
styles/one-line/demo/ink.js:68-72         停笔墨点
styles/one-line/demo/ink.js:79-163        drawLine()
styles/one-line/demo/ink.js:84            屏幕最小线宽 clamp
styles/one-line/demo/ink.js:140-147       墨渗离屏层
styles/one-line/demo/ink.js:151-155       飞白笔毫轨迹
styles/one-line/demo/ink.js:156-161       积墨
styles/one-line/demo/ink.js:166-186       drawBlots() 泪滴墨点
styles/one-line/demo/face.js:1-5          反向设计总注释
styles/one-line/demo/face.js:31           眼镜几何
styles/one-line/demo/face.js:43-46        BIRTH
styles/one-line/demo/face.js:57-63        DOME/HAIR/KITE/TAIL
styles/one-line/demo/face.js:65-69        BIKE
styles/one-line/demo/face.js:71-90        LOVERS
styles/one-line/demo/face.js:92-98        HOUSE
styles/one-line/demo/face.js:100-101      EYE_R
styles/one-line/demo/face.js:103-106      CHILD
styles/one-line/demo/face.js:108-111      OLD
styles/one-line/demo/face.js:113-116      KID
styles/one-line/demo/face.js:119-131      SEGS 章节表
styles/one-line/demo/main.js:17-19        prepare/buildPath
styles/one-line/demo/main.js:24-31        camFor() 调试视图
styles/one-line/demo/main.js:41-75        render()
styles/one-line/demo/main.js:77-104       events()
styles/one-line/demo/main.js:106-111      window 契约
styles/one-line/demo/cam.js:5             BASE=0.85
styles/one-line/demo/cam.js:8-18          keyAt()
styles/one-line/demo/cam.js:20-42         camAt() 跟拍 + 软约束
styles/one-line/demo/cam.js:44-47         worldToScreen()
styles/one-line/demo/shots.js:2-32        CAM 镜头关键帧
styles/one-line/demo/lines.json:1-38      6 行旁白
styles/one-line/style.json:16-17          frame_sec 39.9 / dur 47.5
```
