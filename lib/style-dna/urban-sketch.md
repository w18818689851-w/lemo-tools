# 钢笔淡彩（urban-sketch）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Where the Wind Went》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一页在户外几分钟画成的写生簿：**一支会抖、会出头、会断笔、从不真正封口的深褐细钢笔，先「暗示」出一个世界；透明水彩随后罩上去，与线错位、溢出、积边、沉进纸纹**——线和淡彩，两者必须同时在。

**它不是**：水彩笔触（没有无线的湿画、没有不靠线的画家式边缘）、白板（没有马克笔、没有讲解图）、水墨（没有毛笔书法、没有单色墨阶）。
（`STYLE.md:21`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「钢笔在纸上 + 水彩在纸上」的某个环节。

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸即世界** | 5120×2880 世界单位的一整页冷压纸，暖米 `#f5eede`；两档 fbm 斑驳（0.0011 / 0.0062 cycles/px，±4.5%）+ 一层 512px 平铺牙纹（乘法叠在一切之上，连人物一起）。镜头拉远到整页时按 1:1 显示。 |
| **墨只有一种** | 深褐 `#2b2520`（`INK=[43,37,32]`），全片唯一墨色，永不改。 |
| **线宽随深度** | 1.3–3.4px，远细近粗（`lw(Y)=1.3+2.1·depthS(Y)`）；抖动 0.9–1.3px；两端出头 3–8px；长笔画 30–60% 概率吃到一处 3–9px 的断笔。 |
| **线只暗示不描述** | 几笔窗纹代替一整片窗格；扇贝状碎片代替一整圈树冠轮廓（`STYLE.md:16`）。 |
| **淡彩是错位的** | 2–3 层噪声边半透明乘法叠色，alpha 0.4–0.65，与线错位约一个线宽，干后沿轮廓压一道 30–40% 的深色水痕。 |
| **颜色是「到达」** | 每个像素有「颜色到达时刻」。源以 v px/s 洇开、最远 R，超出 R 后按 creep 秒/像素慢渗；前沿有一道 +70% 的积色暗带（`film.js:158-159`、`engine.js:196-214`）。 |
| **颗粒** | 颜料 × `(0.82 + 0.36·fbm(p·0.21))`——颜料沉进纸纹。 |
| **纸白最亮** | 白是留白，靠 `reserve` 抬回纸色，绝不画。 |
| **页是画面的一部分** | 噪声页边（fbm 0.004，±80px），内侧一圈 70px 白点带、外侧一圈 70px 彩色飞溅点；**从不铺到边**，留页边写字。 |
| **确定性** | 同 seed → 同笔触，可逐帧离线渲染。 |

**关键取向**：`STYLE.md:19` 强调「什么都没画满边」——铺满会杀死写生簿的感觉；页边必须碎成叶点大小的斑与白洞。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一个坐在公园长椅上边看边画的人。第一人称「我注意到…」的当下口吻，或第三人称观察者。慢，像自言自语。**此风格可以完全无旁白**（demo 就没有）。

**长度（实测）**：字幕单行 ≤ 约 **28 个汉字**，手写体，写进页边或下缘一条手写栏，**绝不套通用字幕框**。示例手写批注 `Sun. 3:40 pm — windy`（22 字符）、片名 `Where the wind went.`（19 字符）。停留 ≥ `max(1.8s, 语音时长+0.6s)`（`STYLE.md:47`）。

**句首类型**（示例性，不是抄原文）：
- 时间地点式批注：`Sun. 3:40 pm — windy` → 日期 + 天气 + 地点
- 「我注意到」这类观察动词起句
- 以天气 / 光线这类环境状语起句，再落到主体
- 一个具体小物件起句（一只帽、一杯咖啡、一把伞）
- 结尾以一个地点名或一句手写日期收束

**这个风格里不会出现的句式**：
- 营销口播腔、感叹号堆叠、`amazing` / `you won't believe`
- 抽象概念当主语（只谈能被画出来的实物、位置、天气）
- 一句塞两个以上信息点（每句只承担一层）
- 把文字做成淡入/滑入的通用字幕条（文字必须被**写**出来）

---

## 3. 叙事节奏

**写生顺序**：

```
空白页 + 手写日期/地点
  → 钢笔按真实笔顺把主体一笔笔「画」出来（线先于色）
  → 颜色作为「到达」从某个源头洇开（事件给页面上色）
  → N 个被颜色点到的细节
  → 到顶 / 静默
  → 颜色扩散或收束
  → 拉远成整页（页作为画框，页边手写片名与版权页）
  → 收
```

**时间挂在 150 BPM 的 3/4 拍网格上**：1 拍 = 0.4s，1 小节 = 1.2s（`film.js:7`、`score.py:12`）。

| 层 | 规则 |
|---|---|
| 跑步循环 | 两拍一步（`ph=(t-6.95)*TAU/(BEAT*2)`），每一步落在拍上 |
| 风线 | 每拍生一道「~@」形，0.4s 画出来，再从尾巴擦掉 |
| 颜色源 | 每 0.04s 沿帽子轨迹落一个 |
| 手写批注 | 1.55–2.35s |
| 片名 | 28.2–29.5s |
| 版权页 | 30.1–31.8s |
| 静音小节 | 20.4–21.58s |

**总时长**：主 demo 32.4s（`style.json` dur=32.4，frame_sec=16.2）；无硬性区间，由故事决定（多页旅行日记可更长，单页速写 20–40s 常见）。

**静默怎么用**：静默是工具。demo 在到顶（19.2s）之后留整整一小节真静默，20.4–21.58s，连环境底噪都收掉，只留纸面房间音；**静默期间画面里没有风**。静默后的第一个声音就是下一个动作（下坠的单簧管半音下行 + 定音鼓）。

---

## 4. 镜头逻辑

**镜头是什么**：一台放在整页大纸上的 **2D 相机**（5120×2880 世界，最后拉远到 0.375× 才 1:1 看见整页）。设计好的运动用三次缓动；跟拍用**临界阻尼弹簧**追一个「提前量」目标，所以镜头会像手一样有滞后（demo 用 stiffness 28，坠落段 70）。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 推近 | 注意；观察一个细节 | 一张脸；一块招牌；一件小事 |
| 弹簧横移跟随 | 行走、追逐 | 被带着走的物件；一个走者；一辆车 |
| 摇臂升起 | 新的高度、视野打开 | 天际线；一棵树；一个阳台 |
| 甩摇 + 轻微侧滚 | 方向突变 | 一次坠落；一阵风；一个意外 |
| 冲击推入 + 0.35s 抖动 | 撞击 | 一次接住；一次相撞；关门 |
| 拉远到整页 | 尺度；速写作为一件物品 | 总结；一个地方的全貌 |
| 倾入页边 | 从画到字 | 批注；日期；片名 |
| 沿纯线稿区慢摇 | 上色之前的世界 | 安静的开场；回忆 |
| 笔在画时保持不动 | 「注意」这个动作本身 | 正在被画的主体 |
| 翻页到新一跨 | 另一个时间或地点 | 旅行日记；连着几天 |

**允许的转场**（必须来自纸与画本身）：在页面上做镜头移动、翻页、颜色到达本身作为转场。

**禁止**：溶解/叠化（`STYLE.md:75` 明确禁止）；划像等 UI 式转场；任何元素的淡入/滑入（颜色只能从一点 bloom 或经到达场洇开，绝不 snap）；无来由的运镜。

---

## 5. 表达习惯（idioms）

1. **线先于色**：钢笔按真实笔顺把主体一笔笔画出，淡彩随后落下——画画的过程本身即奇观。
2. **颜色作为到达**：每个像素有「颜色到达时刻」，从源头带一道毛边湿前沿向外洇开；**事件即可上色**。人物在颜色碰到之前是定格的线稿，被碰到才开始动。
3. **唯一的彩色物**：整页线稿里只留一个带色的物件，它成为主角（demo 是草帽）。
4. **页作为画框**：拉远到整页可见，页边碎成色点，空白页边里写着手写批注。
5. **胡萝卜人**：远景人群一块色块 + 两条腿线 + 一个头点，不做完整骨架。
6. **不可见的力被画出来**：风是一道道「~@」形墨线（每拍生、0.4s 画出、从尾巴擦掉）；阵风是几道从右边扫进的长风线。
7. **人物 12fps 抖（boil）**：线抖与淡彩 seed 每 1/12s 换一次；**静态的页不抖**，相机每帧平滑移动。

---

## 6. 氛围

一个有风、有光、有鸟叫的户外：纸的暖、墨的干、水彩刚干时的凉。整体是**被观察到的、手作的、当下的**气质——不是设计稿，不是照片，也不是解说图。

---

## 7. 声音

- **乐器**：爵士华尔兹三重奏（walking bass 走三拍、刷子、立式钢琴在第 2–3 拍）+ 单簧管主奏；弱音小号（城市段）；颤音琴与马林巴（树炸色时的点彩）。可选家族：咖啡馆手风琴三重奏、独奏尼龙吉他、弦乐四重奏拨弦、铜管乐队（人群）。**一个区域一个色彩乐器**。
- **动作声（按材料分层）**：纸上的钢笔——带通噪声（约 1.6–7.5kHz）+ 纤维幅度纹理 + 纸纤维小颗粒，每道真实笔触一声，成千上万道叠成一片沙沙，快画时像踩镲；湿画洇开的「shhh」；风是带通布朗噪声，J-cut 从右声道进来；草帽翻飞是纸质拍打，速率 `9+min(14, speed/120)` Hz、响度跟速度、声像跟屏幕 x；脚步（草地）、扑空、起跳、扑接的「啪」、点水 plop；车铃 1760Hz + 2.76/5.4 分音；环境三层：纸面房间音 → 公园鸟鸣（颜色到达后）→ 城市低鸣（天际线前一小节 J-cut 进来）。
- **混音规则**：6 音乐 stem + 6 拟音 stem；拟音整体高通 90Hz；开场 0–2.4s **只有笔声**且推大、之后线稿扩散的沙沙压到 0.55；音乐给关键拟音让路（接住 24.0s 压到 0.55、触地 8.4s 压到 0.8、路灯 11.9s 压到 0.85）；总混 `music×0.9 + foley`，60Hz 以下轻切、峰值限 0.95；响度 −14 LUFS。

---

## 8. 变化空间（可自由发挥）

地点、主体、颜色做什么（一直在 / 被扣留 / 迟到）、有没有旁白、音乐家族、镜头路径、开场、结尾和长度。

`STYLE.md:112-120` 给了远离 demo 的方向：
- **结构**：五页旅行日记（一天一页，每页被风或手翻开）；同一个街角画四次（墨不变、淡彩随时刻变）；一份菜谱（市集上一样样画食材，最后画成品）。
- **开场**：空白页只有手写日期，然后第一笔地平线；页边一只咖啡杯特写、拉远发现背后画着整座城；雨点落在纸上、bloom 成第一片淡彩。
- **结尾**：速写本合上；最后一个人物走出页边进入空白；颜色退回到线稿、只留一扇亮着的窗。

demo 本身只用了一顶被风吹走的草帽和一片公园——故事、道具、时长都不可复用。

---

## 9. 禁忌清单

- 画到页边——必须留页边并让边缘碎掉。
- 颜色 snap 出现——只能从一点 bloom 或经到达场洇开。
- 用包围盒/矩形去裁剪颜色场，留下直边或白缺口——要按真实（噪声）距离与真实阶梯轮廓裁。
- 角色跑进未上色区就掉色——到达时刻只在起点采样一次或绑定到上色事件，绝不在当前位置采样。
- 静态墨线被后来的淡彩遮挡不了——要在画前景之前把远处墨线擦掉，远景人群用胡萝卜人。
- 正面脸画成秃头——先画头发整块，再从下半部擦出脸。
- 给整幅铺底色，或做通用字幕框。
- 照抄任何真实速写页、构图、字体排版。
- 复用示例的故事、叙事弧、镜头、道具或时长。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | 片名，手写在页边（demo：`Where the wind went.`） |
| `note` | string | 页角批注（日期 + 天气 + 地点） |
| `credits[]` | string[] | 版权页几行手写 |
| `colors[]` | `[r,g,b]` | 每个色块进 `wash` 的 col |
| `sources[]` | `{x,y,t,v,R,sy,mask}` | 颜色到达源 |
| `EV[]` | `{t,type,...}` | 声音事件 |
| `STROKES[]` | `[t0,dur,L,group]` | 世界每一笔，供拟音逐笔发声 |
| `TRACK()` | `[t,速度,屏幕x][]` | 帽子轨迹，供翻飞声 |

### 10.2 新画面主体的契约

新主体是 `engine.js` 里的一个函数或一支笔触库，必须能返回 `drawPrims` 认得的图元列表：
- `k='knock'`：纸色遮挡（poly）
- `k='wash'`：淡彩（poly + col + a + dx/dy 错位）
- `k='ink'`：墨线（`st = penStroke(...)`）
- `k='fn'`：自定义

`sketchShape(ctx, poly, col, {ink, wash, offset, color, p})` 可以**一句话把任意闭合多边形画成「钢笔淡彩」**。新角色造型放进 `poses.js` 的 `LOOK` 表，新姿势用 `V(x,y,z)` 身体坐标写。

### 10.3 时间线契约

`film.js` 导出 `BPM/BEAT/BAR/DUR` 与 `window.render(t)`、`window.DUR`、`window.EV`、`window.TRACK`、`window.STROKES`，并置 `window.READY=true`。
`render(t)` 里：先 `comp(cam,t)` 合成整页，再按世界坐标 `setTransform` 画动态层，**人物按 y 深度从远到近排序**。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者（foley.py / score.py 里的声音） |
|---|---|---|
| `hatColor` | 唯一彩色物上色 | 颤音琴 + 钟琴闪 |
| `windIn` / `gust` | 起风 / 阵风 | 风 whoosh |
| `hatLift` | 帽子离头 | 纸呼啸 + 高频噪声 |
| `bounce` | 触地压扁 | 闷响 + 纸拍 |
| `miss` / `jump` | 扑空 / 起跳 | 呼啸 + 脚步 |
| `bell` | 车铃 | 1760Hz 车铃 |
| `lampSpin` | 绕灯转圈 | 单簧管颤音 |
| `tree` | 树炸色 | 颤音琴 + 马林巴滚 |
| `apex` | 到顶 | 漂浮 Db 大七（#11） |
| `silence` | 静默 | 收掉 amb/wind |
| `fall` | 下坠 | 呼啸 + 单簧管半音下行 + 定音鼓 |
| `dive` / `catch` | 扑 / 接住 | 风 + 全奏（duck .55） |
| `splash` | 点水 | plop + 泛音 |
| `step{surf}` | 脚步（草/石） | 草地脚步，落在拍上 |
| `writeTitle{d}` / `writeCredits{d}` / `writeNote{d}` | 手写 | 更碎、更快的笔声 |

全部由 `film.js` 里 `EV.push` 产生。

---

## 11. 构建链（复用机制）

```
styles/urban-sketch/demo/
  engine.js   pen, wash, foliage, arrival field, GL compositor, figure rig, hat, bike, handwriting, sketchShape
  world.js    the static page: sky, skyline (ink in stroke order), trees, lawn, path, lamp, pond, bridge, crowd, edge dissolve
  poses.js    character looks + pose library (sit, run, walk, cycle, dive, prone, wave)
  film.js     timeline: hat path, camera, performances, colour sources, sound cues
  audio/      score.py (music) · foley.py (all procedural sound) · mix.py
  build.sh    one command, from nothing to urban-sketch.mp4
```

渲染：`node core/render/video.mjs styles/urban-sketch/demo --fps 24 --workers 4`。
**关键机制**：颜色到达场（`arrivalField`）把「上色」变成一个可被事件驱动的量——任何「颜色该在什么时候到哪」的故事都能复用同一套引擎；`STROKES` 把世界里的每一笔导出给拟音，所以笔声永远和画面同步。

---

## 12. 证据

```
styles/urban-sketch/STYLE.md:12-21     本质两条硬规则 + 不是什么
styles/urban-sketch/STYLE.md:23-34     材料与渲染（纸/墨/淡彩/到达场/树叶/天空/建筑/人物/页边）
styles/urban-sketch/STYLE.md:36-42     颜色逻辑（墨单色/淡彩局部色/纸白最亮/颜色可扣留）
styles/urban-sketch/STYLE.md:44-48     字体与字幕（手写、页边、hold ≥ max(1.8s, speech+0.6s)）
styles/urban-sketch/STYLE.md:50-56     运动质量（12fps boil、预备-动作-跟随、不可见力被画出）
styles/urban-sketch/STYLE.md:58-75     十项镜头词汇表 + 构图 + 转场（禁 dissolve）
styles/urban-sketch/STYLE.md:77-85     声音调色板（环境三层/钢笔/水/foley/音乐家族/静默/混音）
styles/urban-sketch/STYLE.md:87-95     原生招式（线先于色/颜色作为到达/唯一的彩色物/页作为画框/胡萝卜人）
styles/urban-sketch/STYLE.md:97-106    媒介陷阱
styles/urban-sketch/STYLE.md:108-110   引擎函数清单
styles/urban-sketch/STYLE.md:112-120   变化空间（结构/开场/结尾）
styles/urban-sketch/DEMO.md:5          demo 32.4s 1920×1080 24fps 无旁白
styles/urban-sketch/DEMO.md:22-30      demo 用到的原生招式
styles/urban-sketch/DEMO.md:34-37      5120×2880 页 / 弹簧 28、70 / punch-in 0.35s / 拉远
styles/urban-sketch/DEMO.md:41-44      12fps boil / 风被画出 / 颜色 bloom
styles/urban-sketch/DEMO.md:48-52      配乐三层 / 150 BPM 3/4 爵士华尔兹 F / 静音 / −14 LUFS
styles/urban-sketch/DEMO.md:56-68      全部色值与参数表
styles/urban-sketch/DEMO.md:72-78      手写批注/片名/版权页字体与时间
styles/urban-sketch/DEMO.md:95-101     实际踩过的陷阱
styles/urban-sketch/DEMO.md:107-121    引擎函数参考表 + sketchShape 最小示例
styles/urban-sketch/demo/film.js:7-8            BPM=150 / BEAT / BAR / DUR=32.4
styles/urban-sketch/demo/film.js:101-102        STEPS 脚步落在拍上
styles/urban-sketch/demo/film.js:145-157        颜色到达源
styles/urban-sketch/demo/film.js:158-160        arrivalField GW=640 GH=360 amp=240
styles/urban-sketch/demo/film.js:165-167        弹簧跟随（28 / 70 / dt 1/240）
styles/urban-sketch/demo/film.js:168-186        camera() 逐段运动
styles/urban-sketch/demo/film.js:198            boilOf=floor(t*12)
styles/urban-sketch/demo/film.js:207            bloomClip 噪声圆
styles/urban-sketch/demo/film.js:210            colorAt 由到达场换算
styles/urban-sketch/demo/film.js:246-261        windCurls
styles/urban-sketch/demo/film.js:263-272        gust 阵风
styles/urban-sketch/demo/film.js:274-283        leaves
styles/urban-sketch/demo/film.js:292-300        notes() 手写批注/片名/版权页
styles/urban-sketch/demo/film.js:333-336        帽子永远最前 / 纸色 halo
styles/urban-sketch/demo/film.js:346-350        EV 全部 type
styles/urban-sketch/demo/film.js:353-354        TRACK / STROKES
styles/urban-sketch/demo/engine.js:11-12        INK / PAPER
styles/urban-sketch/demo/engine.js:66-76        rough() 噪声边
styles/urban-sketch/demo/engine.js:81-106       penStroke（抖/出头/断笔）
styles/urban-sketch/demo/engine.js:109-120      drawPen
styles/urban-sketch/demo/engine.js:122-134      rasterPen（笔顺 → ink+time）
styles/urban-sketch/demo/engine.js:138-151      wash
styles/urban-sketch/demo/engine.js:153          reserve 留白
styles/urban-sketch/demo/engine.js:155-161      dab 叶片点
styles/urban-sketch/demo/engine.js:163-192      LEAF 调色板 + foliage
styles/urban-sketch/demo/engine.js:196-214      arrivalField
styles/urban-sketch/demo/engine.js:215          sampleField
styles/urban-sketch/demo/engine.js:220-257      FS 着色器（纸×颜色×墨线，颗粒 0.82+0.36·fbm）
styles/urban-sketch/demo/engine.js:258-282      compositor（R16F 到达场）
styles/urban-sketch/demo/engine.js:286-302      drawPrims（knock/wash/ink/fn）
styles/urban-sketch/demo/engine.js:376-526      figure
styles/urban-sketch/demo/engine.js:539-566      hat
styles/urban-sketch/demo/engine.js:570-579      handwrite
styles/urban-sketch/demo/engine.js:582-598      bike
styles/urban-sketch/demo/engine.js:603-609      sketchShape
styles/urban-sketch/demo/world.js:5-9           W/H/WIN_A/WIN_B/depthS/FIG_H/ORIGIN
styles/urban-sketch/demo/world.js:29-36         pageMask / inPage
styles/urban-sketch/demo/world.js:57-71         天空 + 云留白
styles/urban-sketch/demo/world.js:79-110        建筑
styles/urban-sketch/demo/world.js:117-147       天际线墨线按笔顺
styles/urban-sketch/demo/world.js:150-155       bSources / insideBuilding
styles/urban-sketch/demo/world.js:157-164       草坪
styles/urban-sketch/demo/world.js:167-223       树
styles/urban-sketch/demo/world.js:226-235       小路
styles/urban-sketch/demo/world.js:238-252       路灯
styles/urban-sketch/demo/world.js:255-282       池塘 + 桥
styles/urban-sketch/demo/world.js:285-301       野餐布 + 篮子
styles/urban-sketch/demo/world.js:303-330       胡萝卜人
styles/urban-sketch/demo/world.js:333-339       草的笔触
styles/urban-sketch/demo/world.js:342-355       页边碎成色点
styles/urban-sketch/demo/poses.js:5-17          LOOK 表
styles/urban-sketch/demo/poses.js:20-61         姿势库 + mixPose
styles/urban-sketch/demo/audio/mix.py:11-16     6 音乐 stem + 6 拟音 stem
styles/urban-sketch/demo/audio/mix.py:19-22     开场只有笔声 / 拟音 hp 90Hz
styles/urban-sketch/demo/audio/mix.py:25-29     duck 让路（24.0/.55、8.4/.8、11.9/.85）
styles/urban-sketch/demo/audio/mix.py:30-33     mix 0.9 / 60Hz 轻切 / 限 0.95
styles/urban-sketch/demo/audio/foley.py:21-27   pen() 带通 1600–7500Hz
styles/urban-sketch/demo/audio/foley.py:43-47   世界每一笔逐笔发声
styles/urban-sketch/demo/audio/foley.py:50-57   wet() 湿画洇开
styles/urban-sketch/demo/audio/foley.py:72-81   风（J-cut 右声道）
styles/urban-sketch/demo/audio/foley.py:91-102  草帽翻飞
styles/urban-sketch/demo/audio/foley.py:107-121 脚步/扑空/跳/扑接/点水
styles/urban-sketch/demo/audio/foley.py:124-132 车铃
styles/urban-sketch/demo/audio/foley.py:134-152 环境三层 + 静音
styles/urban-sketch/demo/audio/score.py:1-2     150 BPM 3/4 爵士华尔兹 F / 小节 1.2s / 摇摆
styles/urban-sketch/demo/audio/score.py:22-30   和声表
styles/urban-sketch/demo/audio/score.py:39      1.8s 上色声
styles/urban-sketch/demo/audio/score.py:87-93   16 小节 Db 大七（#11）
styles/urban-sketch/demo/audio/score.py:94-99   17 静音 / 18 下坠
styles/urban-sketch/demo/audio/score.py:105-108 20 接住全奏
styles/urban-sketch/demo/audio/score.py:127-144 刷子/踩镲/吊镲
styles/urban-sketch/demo/audio/score.py:154-158 gate 20.4–21.58s 真静音
styles/urban-sketch/style.json:16-17            frame_sec 16.2 / dur 32.4
```
