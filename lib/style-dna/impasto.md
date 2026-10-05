# 油画厚涂（impasto）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Colour of Rain / 雨的颜色》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一幅用调色刀笔触画出来、并且在动的油画：**每一笔都是一个真实的物体**——一片斜的颜料面，刀压下去留下一道脊、抬起来留下一道唇、颜料将尽处拖出断续的条；世界每帧都从笔触重画一遍，但静止的颜料永远不动，只有故事里在动的东西才动。光以掠射角扫过高度场，所以颜料有厚度。

**它不是**：梵高式的漩涡滤镜（笔触到处沸腾）、盖在扁平矢量上的笔刷贴图、水彩（颜料是不透明的）、把噪声采样出来的「绘画感」照片滤镜。
（`STYLE.md:8-12`）

---

## 1. 材料与渲染的硬规则

任何画面元素都必须能被解释成「一刀一笔真实画出来的颜料」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **明度优先** | 每个场景先画成一张扁平的、按明度规划的插画（**至少 3 个明度**），再转成笔触。参考图在 480 px 宽下读不出来，再多笔触也救不回来。 |
| **笔触分级** | 天空和墙面用大色块（40–60 px），只有边缘和脸用几像素的小笔（3–6 px）；每形状带 `maxR`/`detail`/`dir`。 |
| **不跨形状组** | 笔触绝不跨越 `group`，剪影保持锐利；「失去边缘」是要主动选的（把两个形状放进同一个 `group`）。 |
| **薄底画** | 参考图本身模糊 ~1.5 px 垫在笔触下，画布才不会从缝隙透成描边。 |
| **刀触** | 长大于宽（≈ 半径的 1.7–3.1 倍长、0.95–1.45 倍宽），两端斜切，角度抖动 ±13°、明度抖动 ±6 %。要读成剪影的实体只给很少或不给破碎拖尾（`run` ≈ 0–0.25）。 |
| **掠射光** | 光扫过一个高度场（paint height）；湿的/亮面给稍多镜面高光。默认 `light [-.55,-.6,.7]`、`norm 3.2`、`amb .8`、`dif .28`、`spec .16`、`ao 1.2`。 |
| **倒影** | 湿地/玻璃/水面的倒影是**成叠的短横刀点**，在每个光源下打碎、渐隐；绝不是一个画出来的矩形。 |
| **渲染** | 超采样 2×；**没有胶片颗粒**（颗粒 + 压缩会吃掉刀口），高码率。 |

**两遍渲染**：Pass 1 把笔触画进两张 2× 的缓冲（颜色 + 覆盖率、颜料高度）；Pass 2 给高度场打光（掠射光、湿镜面、颜料薄处的画布纹理）。

---

## 2. 句式（文字怎么写）

**本 demo 没有旁白**——音乐 + 拟音独立成片。画面里的文字只有两种：

- **标题**：被刀一笔笔「画」进画面（约 1 秒的 `appear` 扫入），而且**会随世界一起被带走**（被雨冲走、被刮掉、被覆盖）——标题是画面里的一个物件，不是叠加层。
- **DOM 小字**（署名、数据、图注）：保持在画面之上、清晰可读；**刀触托不住小字母**，小字必须留在 DOM 文本里。

**人称与时态**：没有旁白时由音乐承担——先是独奏大提琴的第一人称孤独，再被圆舞曲接走。标题用名词短语或短祈使，不用完整句子。

**若配旁白**：字幕走朴素衬线、≤ 2 行、停留 ≥ `max(1.8s, 语音 + 0.6s)`；音乐与环境让到人声下约 8 dB。

**这个风格里不会出现的句式**：
- 把标题/文字做成淡入滑入的叠加层（文字要跟着颜料走）
- 用刀笔触去写小字
- 旁白抢戏（若有人声，音乐必须让位）
- 网络口播腔、感叹号堆叠、营销话术

---

## 3. 叙事节奏

**一个颜色弧**：

```
孤独（灰）
  → 放弃（静默）
  → 一点颜色（红伞）
  → 被听见（圆舞曲）
  → 人群（俯瞰编排）
  → 回声（同一机位，灰变成彩；开场断掉的那句在结尾解决）
```

颜色就是故事，而刀可以把任意一笔重新铺成新的颜色。

**画面与音乐共用一张网格**（`timeline.js`）：

| 段 | 网格 | 关键拍点 |
|---|---|---|
| Part A | 独奏大提琴，D 小调，3/4 @ **80 BPM**，从 0.4s 起 | 乐句在 **10.15s** 停在未解决的 E3 上，弓 0.3s 后离弦 |
| 静默 | 10.45–12.4 | 雨几乎停；11.15 一滴水；11.5/11.95 两声小脚步先于画面（J-cut）；12.4 一大下水声是静默后第一个声音 |
| Part B | 街头圆舞曲（musette），D 大调，3/4 @ **132 BPM** | 15.3 POP（弱起）→ 16.66 伴奏进 → 18.03 大提琴进 → 19.39–23.03 九把伞一拍一把 → 23.48–31.21 俯瞰六小节 → 31.21 大停顿（数字零）→ 31.66 终止和弦 → 尾声 F#→E→D → 35.75 末拨弦 |

**总时长**：主 demo 39.7s（`style.json` dur=39.7，frame_sec 28.58），952 帧 @24fps。本风格按「一组节拍网格 × 一套参考插画」伸缩。

**静默怎么用**：静默是**真的数字零**——大停顿 31.21 把音乐与环境砍到 0（连混响尾都剪掉，`score.py` 与 `mix.py` 在同一窗口把样本置零），里面最多只放一个声音。此前还有一段 10.45–12.4 的「几乎什么都没有」，用一个水滴和两声提前进入的小脚步（J-cut）把下一场的声音先送进来。静默是给颜色出现让路。

---

## 4. 镜头逻辑

**镜头是什么**：一台在画布里移动的相机——它必须待在**画出的画板内部**（`half = W/2/zoom`），否则会露出画布边。主体拿到硬边和最小的笔触，其余一切待在大而平静的色块里。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 慢横移 + 推，落在大全景 | 一个被观察的世界；耐心 | 一个地方；一段日常；一群人 |
| 穿过一段静默的推近 | 内心的压力 | 一个怀疑；一个决定；放弃 |
| 从地面或倒影仰起 | 从下方发现 | 一个小人物入场；第一次看见 |
| 从特写拉远 | 反应；世界在回应 | 后果；揭示谁在看 |
| 旋转升降拉远、俯瞰 | 从许多里浮现出图案 | 编排；车流；一场聚会 |
| 同一个大全景，重复 | 前 / 后 | 颜色、季节或时间的变化 |
| 锁死画面，让光来动 | 时间与天气作为演员 | 一天过去；一场雨到来 |
| 沿颜料表面做微距滑移 | 材料本身 | 一种纹理；一件手作物；一张地图 |
| 甩镜切进一张新画板 | 能量、一次跳跃 | 一份清单；蒙太奇；旅行 |

**允许的转场**：覆盖式换景（paint-over，下一镜笔触以约 0.5s 的 `appear` 扫过上一镜，音轨配一声刮刀）、在节拍上硬切、用同一个大全景做「押韵」的回到。

**禁止**：溶解/叠化（两层脊会糊成泥）；相机跑出画板；无来由的运镜。

---

## 5. 表达习惯（idioms）

1. **用刀把颜色重新铺一遍**：每一笔都保留灰版与彩版，一道揭示波逐笔重画（小镇醒来、病人康复、品牌重启、季节转换）。
2. **那唯一有颜色的东西**：世界用 `grey: 1` 画，一个物件用 `grey: 0`（人群里的一个人、熟透的那颗果子、一盏警示灯）。
3. **运动在画画**：移动的物体沿路滴下刀点，从上方看，它们的路径留下一个图案（一支舞、配送路线、一次进攻、迁徙）。
4. **掠射光**：在高潮处把光降到掠射角，让每道脊都接住光，然后再落回来（日出、认出的一刻、揭幕一件雕塑）。
5. **覆盖式换景**：下一镜的笔触扫过上一镜，音轨配一声刮刀（翻修、记忆覆盖当下、一版版的时间线）。
6. **把声音画出来**：一个音符或一个声音变成一条颜料飘带，把颜色带到它触碰的东西上（一首歌抵达听众、一次广播、一个谣言传开）。

---

## 6. 氛围

雨后的黄昏广场：钴蓝 → 桃色 → 金色的天空，赭石的立面，全彩的道具；暖光对着冷影是默认的温度结构，最亮最纯的彩度留给故事的主体（一个道具、一群人、一个光源），而不是背景。灰世界是同一批笔触的明度、略微偏冷、留 5 % 的颜色残余，镜面高光稍高（湿）。整部片子是「颜料在雨里被重新画出来」的气质。

---

## 7. 声音

- **乐器**：有手作质感的原声乐器——独奏弦乐、手风琴、拨弦、竖琴琶音、钢片琴/钟琴（用于 POP）、钢琴、吉他、木管。孤独的世界用一件独奏乐器，共享的世界用合奏。（demo 用采样器合成，CC0 音源。）
- **拟音（跟随颜料与世界）**：每一次重画或覆盖换景都有一声**调色刀刮过湿颜料**（带通 900–4200 Hz + 30–120 Hz 颗粒 + 湿底），湿的刀点，以及场景本身的材料（湿石、尼龙伞布、木头、织物、玻璃）。
- **床**：分层（一层嘶声、近处颗粒、一个明确的细节），相机进入遮蔽处时做低通。
- **混音规则**：音乐与环境在任何人声下让约 8 dB；整体 −14 LUFS（颗粒 0）。可选项：**一个动作 = 一声 = 一切**（音乐锁剪辑）；把一串事件 POP 做成上行的琶音让序列往上爬；一个不解决的乐句留到片尾解决；一段把音乐与环境砍到数字零、只留最多一个声音的硬静默；把下一场的拟音 J-cut 进一段静默。**音乐与拟音可以独立撑起一部没有旁白的片子。**

---

## 8. 变化空间（可自由发挥）

你决定：结构、演员（或没有）、场景、开场、结尾、相机路径、节奏、是否有旁白、以及颜色住在哪里。`STYLE.md:114-118` 给了远离 demo 的方向：

- **结构**：**一件东西，许多双手**（一只碗或一条船经过做它、用它的人，每双手一张画板）；**一幅静物活起来**（一张锁定的桌子，物件轮流动，光一小时一小时地扫过）；**一幅分层的肖像**（一张脸从粗到细被画出来，一个声音讲一段人生，每一层是十年）。
- **开场**：**空白的画布**（只有底画，第一道刀触就是第一个事件）；**颜料的脊上的微距**，拉远后变成一个山脊或一片屋顶；**动作进行中**（一个人已经在画好的画板里奔跑）。
- **结尾**：**被刮回去**（刀把画刮到底画，只留一道痕）；**光熄灭**（掠射光沉下去，只剩脊在发亮，然后黑）；**房间里的一幅画**（整部片子是一幅挂在某处的画，被某个人看着）。

---

## 9. 禁忌清单

- 梵高式的漩涡滤镜（笔触到处沸腾）。
- 盖在扁平矢量上的笔刷贴图。
- 水彩（颜料必须是不透明的）。
- 把噪声采样出来的「绘画感」照片滤镜。
- 被限制的笔触在边缘收缩、留下画布色的描边（必须补底画）。
- 每一帧重新播种的笔触会沸腾（每一笔必须用固定 seed）。
- 画顺序搞错：在建筑之后才画地面会盖住它们的脚。
- 扁平矩形读成柱子或方块（剪影必须给锥度、一道亮边、一两笔定义性的刀点）。
- 胶片颗粒或重压缩（会毁掉刀口）。
- 直接照抄参照作品的画面、构图、旋律或角色，也不许在片子里点名。
- 复用本 demo 的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`timeline.js`）

画面与声音的唯一网格源：

| 导出 | 说明 |
|---|---|
| `A` / `B` | 两段节拍网格 `{t0, bpm, beats}`（demo A=80 BPM/0.4s、B=132 BPM/15.3s） |
| `at` / `TA` / `TB` / `BEAT_A` / `BEAT_B` | 取小节拍点 |
| `T` | 切点与事件时间表（`hook`/`cutWide`/`title`/`cutMed`/`stop`/`steps`/`splash`/`pop`/`react`/`bowIn`/`cutStreet`/`cutTop`/`gp`/`chord`/`last`/`end`） |
| `DUR` | 总时长 |
| `MEL_A` / `MEL_B` | 音符表 `[bar, beat, beats, pitch]` |
| `CHORDS_B` | 和声表 |
| `POPS` | 逐拍事件 |
| `bowPos()` | 由音符表算弓位（每音换向、长音多用弓） |

### 10.2 新场景的契约

一套新场景是一个模块，画出一张**扁平的、按明度规划的参考插画**：

- 用 `new Ref(w, h, scale)` + `.fill(path, fill, props)` / `.line` / `.text` / `.tint`，每个形状的 props 给 `{dir, maxR, detail, group, type, hgt, jit, len, wid, aj, fallback}`（`dir` 笔触方向、`maxR` 最大笔触半径、`detail` 细节阈值、`group` 形状组）。
- 交给 `paintRef(ref, {R:[radii], T, rev(x,y), app(x,y,level)})` 从粗到细铺刀触（Hertzmann 式：先大色块，只在画还没追上参考图的地方——边缘与细节——用更小的笔；半径序列 demo 为 `[36,18,9,4.5,2.5]`）。
- 人物/道具用 `Strokes().push({x,y,ang,len,wid,c,c2,type,taper,bend,skew,alpha,hgt,rev,app,seed})` 建笔（`type`: `KNIFE`/`BRUSH`/`DAB`/`LINE`），运动物体每帧重建但**用固定 seed**，颜料不沸腾。

### 10.3 时间线契约

页面契约（`main.js`）暴露 `window.render(t)` / `window.READY`。`film.js` 的 `setup(canvas)` 返回 `draw(t)`：按 `EDIT` 选镜 → 若在转场里则上一镜与当前镜同时绘制（`appear`）→ 从 `POST[look]` 取后期 look（`grey`/`warm`）→ 按需覆盖（结尾掠射光 `post.light/norm/expo`、大停顿 `post.expo/sat`）→ `E.finish(post)`。

引擎 API：`new Impasto(canvas,{W,H,ss})`、`E.begin()`/`E.finish(post)`、`E.batch()`→`E.draw(batch,o)`（静态画板）、`E.drawNow()`（运动笔触）、`E.texture(canvas)`+`E.under(tex,w,h,o)`（底画，支持 `revC:[x,y,speed]` 揭示波）、`new Strokes().push({...})`、`paintRef()`、`strokePath(out,pts,{wid,c,type,step})`。

### 10.4 事件词汇（画面事件 → 声音）

| 画面事件（`timeline.js` 的 `T`） | 声音（`mix.py`） |
|---|---|
| `cutWide` / `cutMed` / `cutStreet` / `cutTop` / `last` | `knife`（覆盖换景的调色刀刮声） |
| `title` | 一声长 `knife`（标题被画进画面） |
| `hook` | `rosin`（松香）+ 雨点打琴 `woodtap` |
| `stop` | `rosin`（弓离弦） |
| `steps` | `splish`（静默里的小脚步，J-cut） |
| `splash` | `big_splash`（静默后第一个声音） |
| `pop` | `fwump`（伞布）+ `fabric`（尼龙）+ 颜料落点 `splish` |
| `bowIn` | `whoosh`（弓抬起） |
| 每个 `POPS` | `whoosh` + `fwump`（伞变彩） |
| `gp` | 真数字零（大停顿） |
| `chord` | 雨停、伞收 `fabric`、鸟鸣 `chirp` |

---

## 11. 构建链（复用机制）

```
sh styles/impasto/demo/build.sh
  # 1. node tools/dump_timeline.mjs        timeline → out/timeline.json
  # 2. .venv/bin/python music/score.py     score（采样器，CC0 音源）
  # 3. .venv/bin/python mix.py             声设计 + 混音（含真静默）
  # 4. node core/render/video.mjs --fps 24 --workers 3
  # 5. sh core/render/mux.sh ... 24 0      颗粒 0：保住刀口
```

顺序：**先 `timeline.js`**（BPM 网格、切点、旋律、POP），再 `scenes/*.js` 画参考插画 → `paintRef()`，再 `film.js`（镜头、相机、转场、后期），最后 `music/score.py` 与 `mix.py`。`dump_timeline.mjs` 把网格导出成 `out/timeline.json` 供 Python 用。

**引擎级陷阱**：`half` 是 GLSL ES 3.00 的保留字；在一个笔触 VAO 还绑定时去绑合成 quad 会悄悄重连 attribute 0（下一帧报 "vertex buffer not big enough"）——**先解绑 VAO**。

---

## 12. 证据

```
styles/impasto/STYLE.md:3-4          一句话本质与参照（只学语法、绝不点名/复用）
styles/impasto/STYLE.md:8-12         本质与「不是什么」（非漩涡/非笔刷贴图/非水彩/非照片滤镜）
styles/impasto/STYLE.md:16-23        材料与渲染（明度优先、笔触分级、不跨组、底画、刀触、掠射光、倒影、2× 无颗粒）
styles/impasto/STYLE.md:27-30        颜色逻辑（破碎色、暖光冷影、颜色即事件、灰/彩双版）
styles/impasto/STYLE.md:34-36        字体与字幕（标题被刀画进画面、小字留 DOM、衬线）
styles/impasto/STYLE.md:40-43        运动质量（静止颜料不动、固定 seed、动作挂节拍、预备-动作-跟随）
styles/impasto/STYLE.md:49-61        镜头语法表（9 move）与「待在画板内」/转场规则
styles/impasto/STYLE.md:65-69        声音（拟音跟颜料、分层床、原声乐器、音乐锁剪辑、硬静默、−14 LUFS）
styles/impasto/STYLE.md:75-80        原生招法 6 条
styles/impasto/STYLE.md:84-90        介质陷阱
styles/impasto/STYLE.md:98-110       引擎 API 与最小示例
styles/impasto/STYLE.md:114-118      变化空间（结构/开场/结尾各三选）
styles/impasto/DEMO.md:5             demo 规格（The Colour of Rain，39.7s）
styles/impasto/DEMO.md:10-14         故事、弧线与「颜色即故事」
styles/impasto/DEMO.md:16            花掉的五个原生招法
styles/impasto/DEMO.md:20-32         九镜镜头表与六个运动
styles/impasto/DEMO.md:36-50         配乐结构（A/B 网格、静默、九把伞、终止和弦、尾声）
styles/impasto/DEMO.md:54-67         逐段声设计表
styles/impasto/DEMO.md:71-77         调色板、灯光参数、笔触大小、人物与湿倒影
styles/impasto/DEMO.md:81            片尾卡（刀画标题 + DOM 署名）
styles/impasto/DEMO.md:95-99         构建顺序
styles/impasto/DEMO.md:101-107       引擎级陷阱与本 demo 道具陷阱
styles/impasto/DEMO.md:109-123       引擎参考 API 表
styles/impasto/style.json:8-17       film/line/frame_sec 28.58/dur 39.7
styles/impasto/demo/timeline.js:4-5        A/B 节拍网格
styles/impasto/demo/timeline.js:7-10       at/TA/TB/BEAT_A/BEAT_B
styles/impasto/demo/timeline.js:12-32      T 切点事件表与 DUR
styles/impasto/demo/timeline.js:36-42      MEL_A（断在未解决的 E3）
styles/impasto/demo/timeline.js:44-58      MEL_B 与 CHORDS_B
styles/impasto/demo/timeline.js:60         POPS 九把伞逐拍事件
styles/impasto/demo/timeline.js:64-75      bowPos 弓位
styles/impasto/demo/engine/impasto.js:3-4   两遍渲染（颜色+高度 / 给高度场打光）
styles/impasto/demo/engine/impasto.js:10-13 笔触属性布局与 KNIFE/BRUSH/DAB/LINE
styles/impasto/demo/engine/impasto.js:30-37 bend/taper 使笔触可弯可收尖
styles/impasto/demo/engine/impasto.js:79    斜切刀口（skew）
styles/impasto/demo/engine/impasto.js:83-92 破碎条与颜料将尽的 runout
styles/impasto/demo/engine/impasto.js:213   默认灯光参数
styles/impasto/demo/engine/impasto.js:218-219 Impasto 构造（ss=2 超采样）
styles/impasto/demo/engine/impasto.js:239   笔触 Float32Array → batch（VAO）
styles/impasto/demo/engine/impasto.js:265   uRun 控制拖尾破碎
styles/impasto/demo/engine/plate.js:1-6     参考插画 → 刀触；不跨形状组
styles/impasto/demo/engine/plate.js:59-60   paintRef 粗到细半径序列 R0
styles/impasto/demo/engine/plate.js:70      group 映射
styles/impasto/demo/engine/plate.js:98-99   maxR/detail 控制
styles/impasto/demo/engine/plate.js:123     收缩直到足迹留在组内
styles/impasto/demo/film.js:37              片尾署名是清晰 DOM 文本
styles/impasto/demo/film.js:54-57           POST 两个 look（grey/warm）
styles/impasto/demo/film.js:108-111         标题被刀画进画面、再被雨带走
styles/impasto/demo/film.js:326-330         EDIT 表
styles/impasto/demo/film.js:339-346         结尾掠射光与 E.finish
styles/impasto/demo/scenes/common.js:1-17   参考插画共用几何/缓动助手
styles/impasto/demo/mix.py:20-64            拟音库
styles/impasto/demo/mix.py:66-85            三层雨床与逐镜电平自动化
styles/impasto/demo/mix.py:91-92            覆盖换景与标题处放调色刀刮声
styles/impasto/demo/mix.py:135-141          音乐优先、环境避让、大停顿真零、limit
styles/impasto/demo/music/score.py:1-4      A/B 两段（D 小调 80 / D 大调 132）
styles/impasto/demo/music/score.py:26       未解决的 E 被弓离弦硬门切掉
styles/impasto/demo/music/score.py:66-74    终止和弦
styles/impasto/demo/music/score.py:88-91    大停顿真数字静默
styles/impasto/demo/tools/dump_timeline.mjs:1-5  timeline → out/timeline.json
styles/impasto/demo/build.sh:1-9            完整构建链（含 mux 颗粒 0）
styles/impasto/demo/CREDITS:1-6             全部由代码绘制、采样 CC0、字体 OFL
styles/impasto/demo/index.html:1            单 canvas 页面 + module main.js
styles/impasto/demo/main.js:1-5             页面契约 window.render / window.READY
```
