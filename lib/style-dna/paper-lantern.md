# 纸雕灯影（paper-lantern）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《一个月饼的相思 / A Mooncake's Longing》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一个从背后打光的**层叠纸雕灯箱**：6–9 张剪纸卡纸叠在一个浅盒子里，暖光透纸，窗和月亮从孔里烧出来，每一层投下柔和影子到下一层。**盒子就是画框；镜头是灯里的一支微距镜头。**

**它不是**：平面剪纸动画（这里有深度、背光、投影）；皮影（没有单屏、没有杆）；3D 立体模型（每个元素都是平行于盒前面的平面纸）。
（`STYLE.md:16`）

---

## 1. 材料与渲染的硬规则

屏幕上的一切都必须是三样之一：**纸层 / 透纸的光 / 影子**。

| 规则 | 具体值（实测/文档） |
|---|---|
| **单位与布局** | **米、y 向上**。层从 z ≈ −0.14（天）到 0（前）；相机 z ≈ 0.3–0.56、fov ~26°。满幅纸层**永远不大于腔体**（demo 用 `.558 × .328`，腔体 `.56 × .33`）。 |
| **一层** | 米制空间的 Canvas2D 画映射到平面；剪纸用 `destination-out` 挖孔（挖之前必须先给**不透明** fillStyle）。 |
| **纸面收尾** | 纤维纹 `GRAIN`（512²、α .9、`source-atop`）+ 顶边暖光边 `rgba(255,236,200,.35)`（偏移 3px）+ 底边暗影 `rgba(0,0,0,.28)`（偏移 3px）。分辨率 `PPM = 5200` px/m。 |
| **背光 shader** | `emissive += albedo × lightCol × trans × lit × falloff × (base + cloud)`；`fall = mix(.22, 1, exp(−d²/R²))` 围绕每个镜头的灯点；`cloud` 是平铺的纸浆云纹。 |
| **`trans` 阶梯** | 每层从约 **.9**（远）降到约 **.05**（前）。 |
| **自发光窗** | 第二张画布（白 = 光、黑 = 遮罩），由 0→1 的「开灯」uniform 门控；bloom 让它们烧起来。 |
| **镜头** | 浅景深、bloom、轻暗角；**2× 超采样**让剪边保持锐利。 |
| **真实世界布景** | 木框、黑纸内衬、暗房间、一盏面光作为盒子对真实物体的溢光。 |
| **光晕** | 必须用**解析式 shader 衰减**（`burst()`），不要用透明的径向渐变贴图——后者会露出方形边。 |

**关键取向**：`STYLE.md:12`——**影子卖的是「真纸在真盒子里」，永远不要关掉**。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一个**坐在桌边讲故事的人**，不是播音员。demo 用**第一人称**（叙述者就是那块月饼），也可以换成第三人称说书人。

**长度**：字幕是一行**安静的烧入行**，在盒子下方：衬线 500，中文约 40px / 拉丁约 38px，暖白，柔和阴影，**距底约 74px**，在台词前淡入、台词后淡出。长句在最靠近中间的逗号处断成两行（约 **21 个中文字** / 约 42 个拉丁字符）。停留 ≥ `max(1.8s, 语音 + 0.6s)`。

demo 25 行，最长 L13（引述神话，约 44 字），最短 L25「中秋快乐。」（5 字）。

**句首类型**（示例性，不是抄原文）：
- 以时间/节令起句：`农历八月十五，秋天刚好走到一半，所以叫中秋。`
- 自我介绍的物件：`我是一块月饼，出生在外婆的厨房。`
- 转折 / 时间推进：`可今年，…` / `于是，我出发了。`
- 半路插入：`半路上，一个盒子和我擦肩而过。`
- 引文：`但愿人长久，千里共婵娟。`

**这个风格里不会出现的句式**：
- 播音腔、广告腔
- 一句塞两个信息点
- **把画面里已经作为纸出现的词再做一遍字幕**（同一批字不许出现两次）
- 多音字直接喂给 TTS（要用同音字 `say` 字段，字幕保留真字）
- 过长不分行

---

## 3. 叙事节奏

**故事形状**（demo 的读法，只是一种）：

```
房间 → 开灯 → 推入盒子，标题
  → 起源（外婆的厨房、压月饼）
  → 一点文化（明代卷轴引用）
  → 缺席（空位子）
  → 旅程（火车穿过层叠山、路上讲的神话、一个反向的盒子）
  → 抵达远方的城市
  → 信
  → 反转：另一个盒子是往另一个方向的（互相思念——两扇窗、一个月亮）
  → 一首古诗
  → 拉出盒子，「中秋快乐」
```

**时间规则**：

| 层 | 规则 |
|---|---|
| 每句台词 | 从 **2.6s** 开始；持续它 `dur.json` 的长度，后面跟 `GAP[id]` 秒 |
| GAP 表 | 在 `main.js`（如 `L02: 4.2` 给标题节拍、`L25: 5.0` 给结尾） |
| 镜头锚定 | 在 `shots/index.js` 里 `start: L('L06') - .5`——**改一句配音就自动重排整条时间线** |
| 运动 | 全部 30 fps **on ones**，绝不步进 |

**总时长**：主 demo 121.8s（`style.json`）。DEMO.md 明确：demo 跑 2 分钟，**45–120s 都适合这个风格**。

**静默怎么用**：灯被**关掉**时，除了房间底噪所有声音都掉出去，然后随灯一起回来。这是这个媒介专属的静默——不是压低音乐，而是把「光」本身拿掉。

---

## 4. 镜头逻辑

**镜头是什么**：灯里的一支**微距镜头**——盒子是画框，镜头小而盒子浅，所以运动都短。景深很浅：故事层对焦，前景和远层都虚。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 缓慢推近、几乎正面 | 亲密；被吸进一个地方 | 一段记忆；一个要紧的细节；一扇亮窗 |
| 缓慢拉远 | 语境；孤独；尺度 | 一个独处的人；前后对比；整个地方一次看完 |
| 层间跟焦（rack focus） | 注意力在深度里移动 | 两个人一近一远；背后的线索；现在与从前 |
| 带深度视差的横移 | 旅程；时间流逝 | 一趟旅行；分阶段的流程；一条时间线 |
| 俯视叠层 | 一件被造出来的东西，像匠人看到的那样 | 一份食谱；一封信；一张地图；产品装配 |
| 拉出 / 推入盒子 | 画框作为物件；「这是一个被讲出来的故事」 | 一件纪念品；一个取景装置；回到当下 |
| 锁死机位，只有光在变 | 等待；一天或一夜的流逝 | 守夜；四季；一座城入睡 |
| 沿叠层上下倾斜 | 攀爬；坠落；天与地 | 一座山；一口井；希望与重量 |
| 近景幕布遮挡转场 | 场景之间的一道幕 | 换章；梦；一个秘密被揭开 |

**允许的转场**：溶解（0.5–1.2s）；iris；灯关/灯开；近景幕布（两半必须在前缘精确相接）。

**禁止**：甩镜；数字变焦；盒边半在画内半在画外。

**framing**：故事层在焦点上，前景与远层都软；在盒内盒边**完全出画**，在外景**清晰入画**，绝不半在。

---

## 5. 表达习惯（idioms）

1. **灯打开**：光源先亮，然后远层，然后窗一盏盏亮。
2. **两扇窗、一个月亮**：两个亮着的地方共用一个光源。
3. **深度即距离**：一堆山脊或街道让「很远」可见；行进时各层以正比于深度的速度移动。
4. **会自己写的纸**：一条纸带从它的边缘、在说出的那个词上长出来。
5. **盒子作为纪念物**：镜头在一个房间里找到那盏真实的灯，真实物体被它的溢光照亮。
6. **从打开的东西里爆出的光**：盖子抬起，解析式的光溢出来。
7. **窗里的剪影**：一个带关节的身影在一个亮框里。

---

## 6. 氛围

一个安静暗房间里一盏亮着的灯：暖光从纸后透出，能看见纸的纤维、木框的纹、桌上被溢光照亮的茶具。整体是「被珍惜的、家里的、节日夜晚」的气质——不是戏剧性，而是陪伴。

---

## 7. 声音

- **乐器**：像纸后透出的光一样的乐器——毡钢琴、音乐盒、钢片琴、竖琴或弹拨筝、竹笛、软弦乐；一件主题文化里的独奏乐器。**没有鼓组**；打击乐只作为单下的软击（木鱼、小锣、手鼓）。
- **动作声**：纸与光——开灯时开关咔哒 + 上升的微光；纸的沙沙与滑动；卡纸轻拍；盒盖闷响；揭示时的钟声；幕布的软 whoosh；场景床（河、铁轨、城市嗡、蟋蟀、雪风）。
- **静默**：灯关掉时，除了房间底噪全部掉出，随灯回来。
- **混音**：人声压缩并前置（RMS ~−18 dB），音乐在语音下 duck **~5–6 dB**，foley 低（−24…−34 dB），峰值限制，最终 **−14 LUFS**。
- **选项**：片子换地方时一件新乐器进入；每个光 cue 一个 foley；配乐「倒着解」，让一段 swell 正好落在关键那句上。

---

## 8. 变化空间（可自由发挥）

你决定地点、人物（或没有）、明度阶梯、光源、真实世界是否出现、开场、结尾和镜头路径。

`STYLE.md:108-110` 给了远离 demo 的方向：
- **结构**：**一扇窗、一年**（一盏锁定的灯，里面的场景一季一季地变，光是唯一的转场）；**一个垂直堆叠**（片子向下倾斜穿过天空、城市、街道、地下，各是一章）；**物件的接力**（同一件物件在五个小盒子之间手手相传，每个盒子一个不同的阶梯）。
- **开场**：**已经点亮、场景中途**（一个身影走过亮着的街；只有当镜头 rack focus 时我们才知道这是纸）；**黑暗与一个孔**（一个针尖大的光点扩大成月亮、一扇门、一只眼）；**俯视**（手的视角看一张纸被剪，剪好的纸滑进叠层）。
- **结尾**：**灯一盏盏灭**、最后一扇窗最后灭；**rack focus 到前层**，直到故事糊成暖光；**一张新纸从前面滑进来**，开始下一个故事。

所有这些都必须守住同一条铁律：**后层亮而半透、前层暗而不透**——这条阶梯就是深度，破坏它就压平了盒子。

---

## 9. 禁忌清单

- `destination-out` 剪纸前必须有不透明 fillStyle，否则孔是半剪的。
- 柔和影子会溢光 / 产生自阴影光环：不该参与的层需要 **`shadow: false` 和 `recv: false` 两者都要**。
- 透明的径向渐变贴图会露出方形边 → 用解析式 shader 衰减（`burst()`）。
- 近景幕布两半不在**前缘**相接，会露出旧镜头的一条缝。
- 比腔体大的纸层会在外景镜头里戳穿木框。
- **grade 状态不许在镜头之间残留**：每个镜头省略的 grade key 必须每帧回落到默认，否则渲染结果取决于一个 worker 从哪一帧开始（worker 边界会有可见跳变）。
- headless Chrome 必须带 GPU flags；SwiftShader 慢约 6×。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容需要驱动的东西

台词表 `script.json`（每行 `{id, text, rate?, say?, sub?}`）、`vo/dur.json`、`vo/words.json`（whisper 逐词时间戳）、镜头表（start 锚定到台词）、每镜头一个模块。

### 10.2 新镜头模块的契约

必须导出 `build(E) → { S, update(t), post(t), grade(t) }`；`E` 含 `dur/T0/C/env/W/cue/cueEnd/word`。

每个纸层用 `sheet({U, w, h, draw, glowDraw?, glow, glowCol, trans, z, x, y, ax, ay, shadow, recv, finish, ppm, bumpDraw?})`——`draw(x,k)` 在米制空间作画（原点居中、y 向上），`glowDraw` 画自发光图（白 = 光、黑 = 遮罩），`ax/ay` 是关节枢轴。

### 10.3 时间线契约

`main.js` 是时间线（GAP 表 + 台词锚定）；页面契约 `window.READY` / `window.DUR` / `window.render(t)`（逐帧确定）/ `window.CUES` / `window.PLAN`。`out/timeline.json` 由 `render/cues.mjs` 导出，供 `mix.py` 排 foley。

### 10.4 事件词汇

事件是每个镜头的 `s.sfx` 数组，由 `out/timeline.json`（台词起点）与 `vo/words.json`（逐词时间）驱动 `mix.py` 的 foley；转场是 `in: { type: 'dissolve' | 'iris', dur, center }`。

---

## 11. 构建链（复用机制）

```
styles/paper-lantern/demo/
  index.html       页面：canvas + #sub + #credit，importmap → /node_modules/three
  script.json      台词：{id, text, rate?, say?, sub?}
  tts.py asr.py words.py   edge-tts → vo/*.wav + dur.json；whisper 校验；逐词时间 → vo/words.json
  src/main.js      时间线（GAP 表）、镜头调度（懒构建/释放）、溶解、字幕、credits、window.render(t)
  src/shots/index.js   镜头表，每段 start 锚定到台词：start: L('L06') - .5
  src/shots/sNN_*.js   每镜头一个模块：build(E) → { S, update(t), post(t), grade(t) }
  src/paper.js stage.js post.js room.js art.js people.js props.js lib.js   引擎
  render/still.mjs video.mjs cues.mjs   剧照、并行渲染、导出 out/timeline.json
  mix.py           人声 + 音乐 + foley → out/mix.wav
```

```
D=styles/paper-lantern/demo
python3 $D/tts.py                          # → vo/<id>.wav + vo/dur.json
.venv/bin/python $D/asr.py                 # OK / DIFF per line
.venv/bin/python $D/words.py L01 … L25     # → vo/words.json
node $D/render/cues.mjs                    # → out/timeline.json（DUR、台词 cue C、镜头表 P）
.venv/bin/python $D/mix.py                 # → out/mix.wav
node $D/render/video.mjs --workers 6       # → out/video.mp4（任意 worker 数得到相同帧）
sh core/render/mux.sh … 30 0               # 两遍 loudnorm −14 LUFS，30fps，无 grain
```

**关键机制**：**镜头锚定到台词**——`src/shots/index.js` 里 `start: L('L06') - .5`，而每句的时长来自 `vo/dur.json`。所以**换一批台词、换一版配音，整条时间线自动重排**；这就是「可换内容重跑」在这个风格里的形态。`render/cues.mjs` 导出 `out/timeline.json` 让混音层用同一份时间。

---

## 12. 证据

```
styles/paper-lantern/STYLE.md:3          一句话定义
styles/paper-lantern/STYLE.md:4          参考语汇与不可复制项
styles/paper-lantern/STYLE.md:8-16       本质三条 + 可走出盒子 + 不是什么
styles/paper-lantern/STYLE.md:20-25      单位/层/背光/自发光窗/镜头/真实世界
styles/paper-lantern/STYLE.md:29-33      颜色逻辑（阶梯即深度）
styles/paper-lantern/STYLE.md:37-41      文字即纸 / 字体 / 字幕
styles/paper-lantern/STYLE.md:45-49      运动质量
styles/paper-lantern/STYLE.md:53-67      镜头词汇表 + framing + 转场
styles/paper-lantern/STYLE.md:71-76      声音
styles/paper-lantern/STYLE.md:82-88      七个 native move
styles/paper-lantern/STYLE.md:92-98      媒介陷阱
styles/paper-lantern/STYLE.md:106-110    变化空间
styles/paper-lantern/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/paper-lantern/DEMO.md:5           demo 名与 121.8s / 引擎
styles/paper-lantern/DEMO.md:8           中文旁白 / 45–120s
styles/paper-lantern/DEMO.md:12          腔体尺寸与首尾呼应
styles/paper-lantern/DEMO.md:16-24       六个 native power 的故事用法
styles/paper-lantern/DEMO.md:25          demo 故事形状
styles/paper-lantern/DEMO.md:27          改编主题的配方
styles/paper-lantern/DEMO.md:31-37       逐段镜头表
styles/paper-lantern/DEMO.md:41-46       运动 / 关节 / 开灯序列 / 文字揭示 / 硬动作 / 转场
styles/paper-lantern/DEMO.md:50-59       配音 / 多音字 / 逐词时间 / 配乐 / 混音
styles/paper-lantern/DEMO.md:63-89       单位布局 / S01 层叠表 / 色值 / 纸面收尾 / 背光 shader / 字体 / 真实世界布景
styles/paper-lantern/DEMO.md:93-98       字幕 / 标题 / 片尾卡
styles/paper-lantern/DEMO.md:102-109     实测坑
styles/paper-lantern/DEMO.md:114-153     模块图与构建步骤
styles/paper-lantern/DEMO.md:157-216     引擎参考（页面契约 / 时间线 / shot 上下文 E / API 表 / 最小镜头 / 切英文）
styles/paper-lantern/demo/src/main.js:9-12     SSAA 与三份数据
styles/paper-lantern/demo/src/main.js:15-20    GAP 表 + 时间线 + window.CUES/DUR
styles/paper-lantern/demo/src/main.js:23-26    镜头表 plan + window.PLAN/EV
styles/paper-lantern/demo/src/main.js:30-36    渲染器（VSM / SSAA / PMREM / 字体）
styles/paper-lantern/demo/src/main.js:41       get() 懒构建镜头 + E
styles/paper-lantern/demo/src/main.js:44       gc() 释放离场镜头
styles/paper-lantern/demo/src/main.js:46-52    drawShot()
styles/paper-lantern/demo/src/main.js:56-80    window.render(t)
styles/paper-lantern/demo/src/main.js:73-77    字幕断行
styles/paper-lantern/demo/src/main.js:81       window.READY
styles/paper-lantern/demo/src/paper.js:5       PPM=5200
styles/paper-lantern/demo/src/paper.js:10-21   makeGrain()
styles/paper-lantern/demo/src/paper.js:23-48   makeCloud()/CLOUD()
styles/paper-lantern/demo/src/paper.js:52-58   paint() 米制画布
styles/paper-lantern/demo/src/paper.js:60-68   text()/vtext()
styles/paper-lantern/demo/src/paper.js:71-83   finish()
styles/paper-lantern/demo/src/paper.js:92-115  paperMat() 背光/自发光/裁剪
styles/paper-lantern/demo/src/paper.js:124-139 sheet()
styles/paper-lantern/demo/src/paper.js:142-162 skyPanel()
styles/paper-lantern/demo/src/paper.js:165-195 moon()/setMoon()
styles/paper-lantern/demo/src/paper.js:198-205 burst()
styles/paper-lantern/demo/src/stage.js:5-24    stage()
styles/paper-lantern/demo/src/stage.js:27-33   aim()
styles/paper-lantern/demo/src/stage.js:37-44   dispose()
styles/paper-lantern/demo/src/shots/index.js:21-45  SHOTS() 20 段镜头表
styles/paper-lantern/demo/script.json:1-110    25 行中文台词
styles/paper-lantern/style.json:16-17          frame_sec 60.9 / dur 121.8
```
