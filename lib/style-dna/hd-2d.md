# HD-2D（hd-2d）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Lampbearer / 守灯人》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一座「会发光的桌面模型」：3D 微缩布景裹着像素贴图，里面站着扁平的 2D 像素立绘——立绘受光、投影，被一台高位远景相机透过一条**移轴清晰带**拍摄，于是整个世界读起来像一张沙盘；**光是主角**，实体灯把立绘的影子甩到地板上，重辉光、重暗角，再叠一层小型 RPG 界面。

**它不是**：体素游戏（角色不能是方块堆的）、纯 2D 像素 RPG（布景必须是真 3D、真光照）、真微缩模型的移轴摄影（贴图是像素，不是材质）。
（`STYLE.md:8-12`）

---

## 1. 材料与渲染的硬规则

任何画面元素都必须能被解释成「一座 3D 微缩布景里的一个像素物件」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **恒定纹理密度** | 表面在小画布上逐像素画（`PX` 类），`NearestFilter` 上传；`worldUV` 按法线做平面投影，让每个表面都保持 **24 px/m**（`PPM = 24`）。 |
| **角色尺度** | 帧 **34×50 px**，`SPX = 1/30` 米/像素（约 1.67 m 高）；立绘是受光的 Lambert 平面（`billboard`），带自定义 depth/distance 材质，所以**能投镂空阴影**。 |
| **颜色 = 色带 + 抖动** | 3–6 个色阶按亮度选取，穿过很窄的 4×4 Bayer 抖动带：立绘 `dz ≈ .22`，贴图 `dz ≈ .45`。再宽 = 到处棋盘噪点。 |
| **selout 描边** | 立绘自动加 1 px 镂空描边：透明像素取其不透明邻居的颜色，朝墨色压暗（`#1a1016`，k=.3）。 |
| **几何** | 只用盒子 + 圆柱（`box`/`cylinder`）搭建筑、地板、岩石；树叶/草丛/蕨/蘑菇/远船/山脊用**公告板**（成片用实例化）。 |
| **发光件** | 窗户是自发光像素窗格（`emissiveIntensity 2.2`）；火是 **6 帧像素图集**按 ~10 fps 步进的公告板；海面是自写 shader（量化波纹 + 浪脊带 + 沿「光源→相机」拉长的倒影条 + 碎光闪点）。 |
| **每场景一套灯光** | 一盏很暗的**投影主光**（DirectionalLight，2048 阴影贴图）+ 半球补光 + 若干**实体点光**（窗 8–9、路灯 12–14、火盆 16 带阴影、提灯 2.6–14 带阴影）+ 一盏**前置补光**（冷色 PointLight，约 2 m 在主角前方——只有正面法线的公告板，背后打光是黑的）。每个光源上坐一个加色 `glow` 精灵，好让辉光有东西可抓。 |
| **后期链**（渲染时） | 2× 超采样 → 物理景深（`CoC ∝ aper × (1/focus − 1/z)`，96 抽样螺旋 gather，远景样本不能糊到清晰前景上）**在同一枚带符号 CoC 里折进移轴** → UnrealBloom → 暗角/调色 → ACES filmic。**没有胶片颗粒。** |
| **移轴版本** | `tiltAmt 17`、清晰带半宽 `tiltW .075`、羽化 `tiltF .3`（屏高比例）、`maxCoc ≥ 24`、饱和 ×1.16、对比 .28。清晰带跟随主角的投影屏幕高度（夹 .2–.8），无角色的镜头用固定的每镜带高（`TILT_C`）。 |

**关键取向**：移轴**不是**一次独立的模糊 pass——它被折进景深的带符号 CoC（清晰带以上记为远景、以下记为近景），这样 gather 才能保住「远景不能糊到清晰前景上」的遮挡规则（`post_ts.js:22-24`、`DEMO.md:156`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位讲童话的旁白者。第三人称、过去时为主，结尾格言句转现在时；缓慢、庄重、不解释、不设悬念。角色台词用第二人称祈使，交给一个被 7 kHz 低通「压进世界里」的声音。

**长度（实测）**：单句 **16–76 个字符**（约 3–13 英文词）。最短是一击式短句（`Tonight, it did.` 16 字符），最长是角色台词（`Take the last flame, little Wren. Keep it close. Don't let the wind have it.` 76 字符）。demo 共 7 条旁白 + 1 条对话，每条 1–5.4s；旁白走**一行制衬线斜体字幕**，屏幕上的说话人走**对话框**。

**句首类型**（示例性，不是抄原文）：
- 以时间跨度 / 旧事起句：`For a hundred years, …`
- 以地点名词引导的路径句：`Through the Whisperwood, …` / `up the Gale Steps, …`
- 极短的转折承接：`Tonight, it did.`
- 以「但」转折引出结论：`But a flame held by careful hands does not go out.`
- 角色台词以动作动词开头、给出一项托付：`Take the last flame, little Wren.`
- 结尾格言式短句：`Every path begins with a single light.`

**这个风格里不会出现的句式**：
- 第一人称自述或抒情（`I feel…`）
- 网络口播腔、感叹号堆叠、营销话术
- 把抽象概念当主语（只讲能被做成一个场景、能被一盏灯照到的东西）
- 一句塞两个以上并列信息点（每句只承担一个画面动作）
- 念出参照作品的名字（只学语法，绝不点名）

---

## 3. 叙事节奏

**一段可通关的旅程**：

```
章节卡（CHAPTER I + 章名）
  → 高位远景立起地标，地标的光失效
  → 在对话框里把「任务物」交接出去
  → 穿过一个更暗的生物群系（旅行）
  → 试炼（风暴；光几乎灭掉；音乐抽空）
  → 光活下来
  → 地标被重新点亮（高潮落在一个音乐下拍）
  → 回到开场那套布景，但已经变了
  → 片名与格言
```

**demo 实测时长与切镜**（76.5s，8 段）：

| 段 | 秒 | 内容 |
|---|---|---|
| card | 0–5.5 | 章节卡 |
| harborWide | 5.5–15.0 | 港镇全景（地标灯失效） |
| pier | 15.0–25.5 | 码头交接（对话框） |
| forest | 25.5–35.5 | 夜林横移 |
| cliff | 35.5–49.5 | 风暴石阶（试炼） |
| lamp | 49.5–58.0 | 灯室点燃（高潮） |
| harborEnd | 58.0–67.0 | 回到港镇（已变） |
| title | 67.0–76.5 | 片名 + 格言 |

**关键事件挂在时间表 `T` 上**（`story.js:13-21`）：灯塔闪→灭 11.5/12.35、点火棒 16.2、对话框进/出 17.3/24.0、狂风 40.6、火变小 41.3、几乎全黑 42.0、重燃 45.6、起身 47.6、倒火 52.6、点燃 53.5、光柱扫海 54.4、船灯逐一亮起 59.2。

**停留规则**：章卡 / 片名停留 ≥ `max(1.8s, 语音 + 0.6s)`；字幕在语音前 ~0.35s 上、之后 ~0.45–0.8s 下；对话框文字在 ~92% 的语音时长里打字完。

**总时长**：主 demo 76.5s（`style.json` dur=76.5，frame_sec 55.08）。本风格按「章节数 × 每章一套布景」伸缩；demo 用 6 个镜头、每 1–2 镜一套布景、7 条旁白 + 1 条对话。

**静默怎么用**：静默是工具。音乐在「灯塔熄灭」处 **0.8s 基本无音乐**（只留合成混响尾），在「火苗将熄」42.0 处**硬切进 0.5s 的抽空段**（只剩约 −44 dBFS 的持续音），其间放两记心跳；火光重燃时才让音乐回来。抽空是「奖赏前的黑暗」，不是失误（`mix.py`、`CUES.md:20-26`）。

---

## 4. 镜头逻辑

**镜头是什么**：一台永远俯瞰桌面的**高位远景相机**（表盘相机）。它从不与角色平视，永远向下看；路径是几把键的**单调样条**（`track()`，无过冲），焦点每帧从相机重算到主体。移轴清晰带把世界压成模型。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 极高极远的慢推，清晰带落在一个小小主体上 | 珍贵；把一整块地方读成一张地图 | 我们在哪；尺度；一个地标 |
| 中高位 3/4，近乎静止的漂移 | 两个人站在同一个舞台上 | 一场对话；一次交接；一个选择 |
| 横移，相机略领先，前景掠过着模糊 | 穿过一个世界的路径 | 旅行；一个有步骤的过程；一段通勤 |
| 俯冲变低变近，此时人物跪下或停下 | 桌面世界忽然变得私人 | 力竭；照料；一个秘密 |
| 上升拉远，焦点从人物交给物件 | 这个动作向外扩散 | 后果；一个系统开始运转 |
| 绕建筑或道具环绕半圈 | 一件东西被从各个面看到 | 一个工作间；一台机器；一座纪念碑 |
| 正上方俯视，移轴带缩成一条 | 一块棋盘、一张计划 | 路线；日程；队列 |
| 在锁死的画面里于两个深度间移焦 | 注意力换手 | 一段记忆；有人在看；前后对比 |
| 回到先前的取景，但已经变了 | 押韵让我们看到变了什么 | 余波；成长；一季之后 |

**允许的转场**：换布景时的短淡入淡出（`ui.js` 的 `FADES`）、章节卡作为正式分隔、回到开场机位的「押韵式」回切。

**禁止**：平视机位（本风格永远向下看世界）；划像 / 3D 旋转等花式转场；过冲回弹的镜头曲线；把移轴做成独立的模糊 pass。

---

## 5. 表达习惯（idioms）

1. **灯亮，影子跳**：一盏实体灯在立绘旁打开，影子横扫过地板（商店开门、机架上电、老师开投影）。
2. **被提着的那簇光就是进度条**：一盏小灯同时是主光和情绪——亮→飘→将熄→重燃（手机电量、心电监护、守夜烛）。
3. **移轴的珍贵感**：超广角里，清晰带只落在一个小小主体上（城市里一辆送货车、整座医院里一间新生儿的房、夜市里一个摊位）。
4. **灯一盏盏亮起来**：窗、路灯或船灯按稳定节奏在地图上逐个点亮（用户接入网络、村庄通电、节日开始）。
5. **RPG 语法**：章节卡、带名牌的对话框、生物群系、一个地标、一张片名卡（新员工入职、按纪元讲的历史、分阶段的菜谱）。
6. **天气扫过整座沙盘**：雨、雪或闪电带着闪光曲线掠过桌面（一场股灾、被威胁的收成、艰难的一周）。

---

## 6. 氛围

夜里的港口小镇：冷蓝的雾对着一小簇暖琥珀的火，重辉光、重暗角；暗部是暖墨色而非纯黑，最亮处就是被辉光晕开的那个光源。每个场景拥有一套雾色和一把光钥匙，所以一次切景就立刻读作「换了一个地方」；主角穿着全片唯一一套饱和色的衣服，好让这枚小小立绘在大全景里能被找到。

---

## 7. 声音

- **乐器**：室内幻想乐 / 电影配器的色彩（竖琴、钢片琴、弦乐、圆号、低音合唱、定音鼓），或小件民谣乐器（鲁特琴、竖笛、手鼓）。可以**在一首曲子内部剪开**（demo 用 Scott Buckley《Precipice》，CC BY 4.0，五段对齐画面，一个下拍落在点燃那一帧），也可以写原创配乐。
- **静默**：硬切进混响尾、只留一层持续音垫、或光将熄时的一记心跳；东西失败时一个 < 1s 的换气。
- **拟音（按微缩模型的材质分层）**：按表面分层的脚步（木、土、石、雪）、火的噼啪、布料、对话框/菜单的 UI 提示音、东西开启的小铃、每道闪电之后的雷、一次大点燃的深低频轰鸣 + 高频微光；每个场景有各自的环境床，交叉淡入淡出。
- **人声**：讲童话的旁白者（demo：Kokoro `af_heart`，speed .82–.90）；屏幕上的角色低通到 ~7 kHz（`bm_george`，speed .84）好让他「在世界里」。发明的地名 / 人名写进 TTS 的 `asr` 字段。
- **混音规则**：每句人声压缩并做有声段 RMS 统一；总线电平定在人声 −17、音乐 −21、环境 −30、拟音 −27 dB RMS；音乐在旁白下再压约 2.2 dB，并做**逐句自动避让**（把人声窗口里的音乐 + 环境压到比人声低约 10 dB，**只压不抬**，脚本逐句打印实测差，demo 为 7–14 dB）；`tanh` 软削波；最终响度走 `core/render/mux.sh`（两遍 loudnorm −14 LUFS，TP −1.2），**颗粒 0**。

---

## 8. 变化空间（可自由发挥）

你决定：地点、人物、故事点亮的那盏光、章节、开场、结尾、相机路径、主光色温和音乐。`STYLE.md:100-104` 给了远离 demo 的方向：

- **结构**：**一张昼夜循环的地图**（同一套布景从黎明到夜晚，每个时辰被不同的实体灯照亮，随小镇作息展开）；**三人小队**（三个短章，各自一个生物群系与一盏光，最后汇聚到一个房间）；**地点菜单**（一张正上方俯视的开放地图，相机按每个信息点俯冲进一处地点、再拉回地图）。
- **开场**：**已经在房间里**（一个对话框已经在一台中近景 3/4 上打字）；**俯视地图**（正上方，带缩成一条，再俯下进入 3/4）；**白昼**（一个没有实体灯的明亮正午全景，让后面第一盏灯成为事件）。
- **结尾**：**存档点**（主角在一件微光小物旁歇下，UI 显示一行存档，淡出）；**清晰带收窄**（移轴带变薄到只剩一个立绘，其余全糊）；**小队走出画外**（锁死的大全景在人物走出后继续停留，只剩环境音与火光）。

---

## 9. 禁忌清单

- 体素游戏（角色不能是方块堆的）。
- 纯 2D 像素 RPG（布景必须是真 3D、真光照，不是平贴）。
- 真微缩模型的移轴摄影（贴图是像素，不是材质）。
- 角色立绘在高光下过曝或被灯烧白（灯要往镜头方向挪约 0.45 m，并在 shader 里封顶立绘受光）。
- 公告板背后打光（只有正面法线，必须加前置补光）。
- 圆柱光柱正对相机产生 NaN、被辉光摊成黑块（改用 `beamCard` 公告板光条）。
- 黑暗场景读不出（在「必须变黑」的那一拍之外，把环境中间调抬约 ×2–2.5）。
- 棋盘噪点（抖动带过宽：立绘 .22 / 贴图 .45）。
- 胶片颗粒（像素画不许有颗粒）。
- 直接照抄任何参照作品的角色、地点、标志、UI 饰件或音乐，也不许在片子里点名。
- 复用本 demo 的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`story.js` / `lines.json` / `sfx_events.json`）

`story.js` 是唯一事实源：

| 导出 | 类型 | 说明 |
|---|---|---|
| `DUR` | number | 总秒数（demo 76.5） |
| `SHOTS[]` | `{id, a, b}` | 按秒的镜头表，`shotAt(t)` 取镜 |
| `T` | 时间表 | 事件秒数（`lhOut`/`light`/`dlgIn`/`dlgOut`/`gust`/`dark`/`relight`/`pour`/`ignite`/`beams`/`ships`…） |
| `VO[]` | `{id, t, sub, dlg?, who?, title?}` | `t` 为开始时间，`dur` 取自 `voices/dur.json`；`dlg` 走对话框、否则走字幕；`title` 走片名卡 |

- `lines.json`：TTS 行 `{id, text, voice, speed, asr?}`；发明的地名/人名写进 `asr`。
- `vo_times.json`：每条人声的起始秒（**`mix.py` 读它、不读 `story.js`**）。
- `sfx_events.json`：各场景的事件时间（`pierSteps`/`forestSteps`/`cliffSteps`/`lampSteps`/`thunder`）。

### 10.2 新布景的契约

一套新布景是一个模块，必须导出 **`build<Name>() → { scene, update }`**（参考 `DEMO.md` § Engine reference 的「Minimal new set」）：

- `scene` 里建：雾（`FogExp2`）、天空（`sky()` 的 mesh）、灯光组（一盏投影主光 + 半球补光 + 实体点光 + 一盏约 2 m 在主角前方的**冷色前置补光**）、几何（只用 `box`/`cylinder` + `worldUV` 保持 24 px/m）、公告板植被与道具、粒子 / 雨 / 光柱。
- `update(t, shot, cam, post, renderer)` 每帧：用 `core/lib.js` 的 `track()` 设相机位与 `lookAt`、设 `fov` 并 `updateProjectionMatrix()`、设 `post.dof.focus/aper/maxCoc`、按需覆盖 bloom 强度/阈值、曝光与 `vig` 的 `amt/warm/sat/contrast/fade`。
- 角色用 `makeChar('wren'|'keeper', extraPoses)` 得到 `{ root, mesh, frame(name), face(cam, flip), lanternPos(name, flip) }`；**`root.userData.char` 就是移轴追踪器要找的标记**。

### 10.3 时间线契约

页面契约（`main.js`）暴露 `window.render(t)` / `window.READY` / `window.DUR`。`render(t)`：`shotAt(t)` 取镜 → `SET_OF` 映射到布景 → 把 DOF pass 指向该布景的 `scene` → 重置后期默认值（bloom .55/.85、曝光 1.15、warm .1、sat 1.05、vig .62）→ 调 `set.update(t, shot, camera, post, renderer)` → 若 `?tilt` 则套移轴（`tiltAmt 17`、`tiltC = tiltCenter`、`tiltW .075`、`tiltF .3`、`maxCoc ≥ 24`）→ `composer.render()` → `drawOverlay(t, shot)`。所有布景共用一台 `PerspectiveCamera(32, 16/9, .3, 2000)`，由每个布景每帧自己设 fov/位置/lookAt。

### 10.4 事件词汇（画面事件 → 声音）

| 画面事件（`story.js` 的 `T`） | 声音（`mix.py` 的 `place()`） |
|---|---|
| `lhFlicker` / `lhOut` | `fwoomp`（灯灭：低频吸气 + 噪声收尾） |
| `light` | `strike`（划火 + 呼的一下）+ `chime` |
| `dlgIn` | `chime`（对话框 UI 提示音） |
| `pierSteps` / `forestSteps` / `cliffSteps` / `lampSteps` | `stepSoft`（木 / 土 / 石） |
| `gust` | `whoosh`（狂风） |
| `dim` / `dark` | `fwoomp`（压小）+ `heartbeat`（心跳） |
| `relight` | `strike`（轻） |
| `pour` / `ignite` | `strike` + `boom`（深低频轰鸣 + 高频微光） |
| `beams` / `ships` | `bell`（船灯逐个亮的小铃） |
| 闪电（`cliff.js` 的 `flash(t)` 曲线） | 每道闪后 0.25s 的 `thunder` |

---

## 11. 构建链（复用机制）

```
PY=.venv/bin/python; D=styles/hd-2d/demo
# 0. 素材（voices/*.wav、music/score.wav、mix.wav 被 git 忽略，下面重建）
# 1. 人声（Kokoro）+ whisper 检查
$PY core/tts/tts.py $D/lines.json $D/voices
$PY core/tts/asr_check.py $D/lines.json $D/voices
# 2. 配乐剪辑（读 edit.py 顶部 CONFIG 的 T_CAESURA/T_SILENCE/T_HIT/NARRATION）
(cd $D/music && ../../../../.venv/bin/python edit.py)      # → music/score.wav + CUES.md + measure.json
# 3. 混音（环境 + 拟音 + 人声 + 避让）
$PY $D/mix.py                                               # → demo/mix.wav
# 4. 字幕
$PY $D/tools/srt.py                                         # → styles/hd-2d/hd-2d.srt
# 5. 审片剧照（移轴版）
node core/render/still.mjs $D 8 16.9 30.5 42.8 53.8 62 71 --q tilt=1 --out $D/out/review
# 6. 渲染移轴版（4590 帧 @60fps）
node core/render/video.mjs $D --fps 60 --workers 2 --q tilt=1 --out $D/out/video_tilt.mp4
# 7. 封装（loudnorm −14 LUFS，颗粒 0）
sh core/render/mux.sh $D/out/video_tilt.mp4 $D/mix.wav styles/hd-2d/hd-2d.mp4 60 0
```

`?tilt=1` 是**渲染期的后处理开关**（在 `post_ts.js` 里，不是对成片做二次处理）。其它页面开关：`ss=1`（不超采样）、`only=harbor|forest|cliff`（只建一套布景）、`nobloom`、`nodof`、`noglow`、`nocredit=1`。

**关键机制**：改故事时**先改 `story.js`**，再把语音起始时间抄进 `vo_times.json`（`mix.py` 读它），让 `sfx_events.json` 的脚步与布景的走路帧对齐，并挪动 `music/edit.py` 顶部的 cue 常量。配乐是**在一首曲子内部剪开**并对齐画面（`CUES.md`），所以高潮下拍的精度只取决于起音定位（demo 误差 −3.7 ms）。

---

## 12. 证据

```
styles/hd-2d/STYLE.md:3-4            一句话本质与参照（只学语法、绝不点名/复用）
styles/hd-2d/STYLE.md:8-12           本质与「不是什么」（非体素/非纯 2D/非移轴摄影）
styles/hd-2d/STYLE.md:16-20          材料与渲染（24px/m、色带+Bayer、selout、灯光组、后期链）
styles/hd-2d/STYLE.md:24-29          颜色逻辑（两温度、暖墨暗部、一雾一光、主角专属色、UI 一金属一纸白）
styles/hd-2d/STYLE.md:33-36          字体与字幕（Cinzel+Cormorant、46–54px、对话框打字 90%）
styles/hd-2d/STYLE.md:40-44          运动质量（立绘步进/其余滑动、姿势即数据、灯在呼吸、天气程序化）
styles/hd-2d/STYLE.md:48-62          镜头语法表（9 move）与取景/转场规则
styles/hd-2d/STYLE.md:66-70          声音（配器、静默、拟音按材质、人声低通、−14 LUFS）
styles/hd-2d/STYLE.md:76-81          原生招法 6 条
styles/hd-2d/STYLE.md:85-92          介质陷阱（抖动带/灯烧白/前置补光/NaN 光柱/可读性/移轴带/process.exit）
styles/hd-2d/STYLE.md:100-104        变化空间（结构/开场/结尾各三选）
styles/hd-2d/DEMO.md:5               demo 规格（76.5s/1920×1080/60fps/移轴版）
styles/hd-2d/DEMO.md:10              故事梗概与格言
styles/hd-2d/DEMO.md:14-20           五个原生力在故事里的用法表
styles/hd-2d/DEMO.md:22-24           故事形状与 6 镜/7 旁白+1 对话
styles/hd-2d/DEMO.md:28-37           逐镜相机表与三条规则
styles/hd-2d/DEMO.md:41-44           声音结构（Kokoro/Precipice 五段/53.5 卡点/混音与逐句避让）
styles/hd-2d/DEMO.md:50-58           分辨率/像素、调色板、材质、灯光、后期参数、字体
styles/hd-2d/DEMO.md:64-69           运动实现与签名拍点
styles/hd-2d/DEMO.md:73-79           字幕/对话框/章节卡/片名/署名/.srt
styles/hd-2d/DEMO.md:146-158         实测陷阱清单
styles/hd-2d/style.json:8-17         film/line/frame_sec 55.08/dur 76.5
styles/hd-2d/demo/story.js:2         DUR = 76.5
styles/hd-2d/demo/story.js:3-12      SHOTS 八段镜头表
styles/hd-2d/demo/story.js:13-21     T 事件时间表
styles/hd-2d/demo/story.js:23-32     VO 八条（7 旁白 + 1 对话）
styles/hd-2d/demo/lines.json:1-53    TTS 行（af_heart/bm_george，speed .82–.90，asr 兜底）
styles/hd-2d/demo/post_ts.js:12-30   CoC shader 与移轴折进带符号 CoC
styles/hd-2d/demo/post_ts.js:31-54   96 抽样螺旋 gather 与「远景不能糊到前景」
styles/hd-2d/demo/post_ts.js:87-96   暗角/暖色/对比/饱和 shader
styles/hd-2d/demo/post_ts.js:98-107  makePost 链（DOF→bloom→vig→OutputPass）
styles/hd-2d/demo/px.js:4            PPM = 24
styles/hd-2d/demo/px.js:5-6          4×4 Bayer 抖动表
styles/hd-2d/demo/px.js:39-48        outline selout
styles/hd-2d/demo/px.js:52-59        texOf NearestFilter / mip / repeat
styles/hd-2d/demo/px.js:62           ramp(cols, dz) 色带 + 抖动带宽
styles/hd-2d/demo/px.js:132-146      billboard 受光立绘（Lambert + alphaTest + 自定义 depth/distance）
styles/hd-2d/demo/px.js:161-164      glow 加色光晕精灵
styles/hd-2d/demo/kit.js:7-16        worldUV 恒定密度平面投影 UV
styles/hd-2d/demo/kit.js:59-85       house 程序化木屋（含发光窗/烟囱）
styles/hd-2d/demo/kit.js:104-123     fire 6 帧像素火图集 10fps 步进
styles/hd-2d/demo/kit.js:126-131     ridge 像素山脊公告板
styles/hd-2d/demo/chars.js:5-6       SPX = 1/30、帧 34×50 px
styles/hd-2d/demo/chars.js:143-158   WREN/KEEP 姿势表（姿势即数据）
styles/hd-2d/demo/chars.js:174-192   makeChar：atlas + frame/face/lanternPos
styles/hd-2d/demo/fx.js:5            flick 火光闪烁（三正弦 ≈ ±20%）
styles/hd-2d/demo/fx.js:8-24         sky 渐变穹顶 + 月亮光晕
styles/hd-2d/demo/fx.js:40-83        sea 像素海 shader
styles/hd-2d/demo/fx.js:86-101       particles 确定性 CPU 粒子
styles/hd-2d/demo/fx.js:104-117      rain 风向倾斜雨段
styles/hd-2d/demo/fx.js:134-156      beamCard 轴向公告板光条
styles/hd-2d/demo/ui.js:39-53        chapterCard 章节卡
styles/hd-2d/demo/ui.js:57-78        dialog 对话框（金框/名牌/打字/光标）
styles/hd-2d/demo/ui.js:81-90        subtitle 衬线斜体字幕与暗带
styles/hd-2d/demo/ui.js:93-108       title 片名卡
styles/hd-2d/demo/ui.js:111-117      blackout 换景黑场 FADES
styles/hd-2d/demo/main.js:17         共用 PerspectiveCamera(32, 16/9, .3, 2000)
styles/hd-2d/demo/main.js:24-28      makePost + bloom/vig 默认值 + ?nobloom/?nodof
styles/hd-2d/demo/main.js:33-41      tiltCenter 清晰带跟随主角投影高度（夹 .2–.8）
styles/hd-2d/demo/main.js:43-56      window.render(t) 页面契约与移轴参数
styles/hd-2d/demo/harbor.js:12       港镇雾色 #16223a / .0105
styles/hd-2d/demo/harbor.js:18-21    投影月光 + 半球补光
styles/hd-2d/demo/harbor.js:81-82    火盆实体点光（带阴影）+ 光晕
styles/hd-2d/demo/harbor.js:140-143  灯塔辉光/点光与两条 beamCard 光柱
styles/hd-2d/demo/harbor.js:175      冷色前置补光 #9fb2e8
styles/hd-2d/demo/harbor.js:179-181  港镇三镜相机 track 表
styles/hd-2d/demo/harbor.js:244      前置补光位置与按镜开关
styles/hd-2d/demo/forest.js:115      onBeforeCompile 封顶立绘受光（×1.35 + emissive）
styles/hd-2d/demo/forest.js:120      冷色轮廓补光注释
styles/hd-2d/demo/forest.js:123-129  高位 3/4 横移、look-ahead 领先、末段减速
styles/hd-2d/demo/forest.js:132      9 fps 步进走路
styles/hd-2d/demo/forest.js:138      提灯点光往镜头方向挪 .42 m
styles/hd-2d/demo/forest.js:151      森林景深 focus/aper 380/maxCoc 24
styles/hd-2d/demo/cliff.js:117-118   风暴主光 + 闪电 bolt 光
styles/hd-2d/demo/cliff.js:160-161   灯室 moon2 与透镜 lensL（带阴影）
styles/hd-2d/demo/cliff.js:181       flash(t) 闪电曲线
styles/hd-2d/demo/cliff.js:185-190   风暴四段相机 track
styles/hd-2d/demo/cliff.js:217-219   可读性补光 ext
styles/hd-2d/demo/cliff.js:255-265   点燃爆发 exp(-(t-ignite)/.22) 与光柱开启
styles/hd-2d/demo/mix.py:9           DUR = 76.5
styles/hd-2d/demo/mix.py:22-40       分场景环境床与交叉淡入淡出
styles/hd-2d/demo/mix.py:44-66       合成拟音库
styles/hd-2d/demo/mix.py:68-82       事件落点
styles/hd-2d/demo/mix.py:104         音乐在旁白下压约 2.2 dB
styles/hd-2d/demo/mix.py:108-115     总线电平与逐句自动避让
styles/hd-2d/demo/music/CUES.md:20-26  配乐五段剪辑表与两处抽空
styles/hd-2d/demo/music/CUES.md:37-42  53.5 卡点定位（误差 −3.7 ms）
styles/hd-2d/demo/sfx_events.json:1  各场景脚步时间与两记雷
styles/hd-2d/demo/vo_times.json:1    八条人声起始时间
styles/hd-2d/hd-2d.srt:1-31          导出的字幕（含 OLD KEEPER 前缀）
styles/hd-2d/demo/CREDITS:1-4        素材与授权（原创/CC BY 4.0/只学语法）
```
