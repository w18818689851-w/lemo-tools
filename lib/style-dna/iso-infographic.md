# 等距信息图（iso-infographic）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《From Bean to Cup》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一张「会动的系统图」：**真正的等距投影**（轴 30°、无透视、无轮廓线，形体只靠每个面的三档色调区分），**信息图的家具**（引线、标签针、剖切线、剖面阴影线、追踪环、图例、路线）都长在世界里，**数字由重复的图标搭出来**（Isotype）而且要对得上；整个系统坐在一块漂浮的板上，板边露出剖面。

**它不是**：低多边形 3D（没有透视、没有三档面调以外的光照）、扁平 2D 讲解片（所有东西都有等距厚度）、蓝图（是色块，不是蓝底线稿）。
（`STYLE.md:13`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值 |
|---|---|
| **投影** | 轴 30°：`sx=(x−y)·cos30°·k`、`sy=((x+y)·½−z)·k`；深度 = x+y+z；入队→排序→flush。**永不旋转或倾斜。** |
| **三档色调** | 由法线决定：顶亮、左(+y)中、右(+x)暗；顶向暖白混 20%、暗侧向 `#231A2C` 混 22%（阴影偏冷）。 |
| **墨线只给家具** | 2px 墨线只用于引线、标签针、剖切线、环、路线、标签；实体没有轮廓线。 |
| **板** | 漂在浅底上，带等距点阵与柔和模糊阴影；前两个面露出剖面（土层、水柱、楼层、管道）。 |
| **复合件** | 作为一个有序图元绘制或给深度偏移（通用画家排序会失效）。 |
| **人物** | 极简立牌（圆头、锥形双色身体、粗手臂、帽子/头发、无脸），12fps。 |
| **LOD** | 高倍跳过小细节；按缩放淡入高物体，拉远不扫过巨物。 |

**颜色**：浅中性底 + **5–7 个平涂色**，每色一义（水永远是同一个蓝）；主体色可保留（其余向暖灰去饱和）；需要在大全景里被找到的站点给一块淡板 + 虚线墨边 + 一个强调色（`STYLE.md:26-32`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位清晰友善的讲解者。第三人称 + 现在时，也可用第二人称直呼观众。

**长度（实测）**：单句 **20–61 字符**（约 4–12 个英文词）。字幕是一张地图标签卡（Jost 500 42px、底居中、距底 64px，底部 ~170px 清空）；停留 ≥ max(1.8s, 语音 + 0.6s)。

**句首类型**：
- 问句开场：`How far did your coffee travel?`
- 「它原本是什么」：`It began as a cherry on a hillside, with two seeds inside.`
- 过程动词起句：`Dried in the sun, then packed with…`
- 极短量化事实做钩子：`Eighteen days at sea.`
- 以「你」收束：`Somewhere in here is yours.`

**不会出现的句式**：第一人称抒情；网络口播腔/感叹号堆叠；抽象概念当主语；一句塞两个以上信息点；含糊的量词（必须能数、能加）。

---

## 3. 叙事节奏

**信息投放顺序**：

```
极特写（主体落在手里，挂一个 0 km 标签）
  → 拉远到第一站与标题
  → 数字一站一站长大（2 粒种子 → 一袋 40 万粒 → 14000 个集装箱）
  → 在最挤的地方穿过嵌套剖面下潜去找它（静默，只剩它有颜色）
  → 最响的一声打断静默、猛地拉回（时间跳变藏在下潜里）
  → 转化站 → 第二段静默 → 温和收束
  → 回响（同样构图，另一只手、另一个物件，标签写总数）
  → 拉远到整块板
```

**时间挂在 100 BPM 网格上**（1 拍 0.6s，1 小节 2.4s；转 80 BPM 后 1 拍 0.75s）。关键锚点：`SNAP 1.5 / TITLE0 5.4 / CUT 9.3 / DRY0 12.0 / SACK 15.0 / JCUT_PORT 17.4 / PORT0 18.0 / SEA0 22.8 / FF0 25.2 / DIVE0 27.6 / BOX_CUT 28.8 / SACK_CUT 29.4 / SIL0 30.0 / HORN 33.6 / ROAST0 36.0 / CRACK0 38.4 / CAFE0 40.8 / GRIND 42.6 / SIL2 45.3 / DROP 45.9 / HAND 49.65 / FULL0 51.9 / CARD 54.9 / END 58.8`。

**总时长**：主 demo 58.8s（`style.json:16-17`）；本风格适合 **45–60s**（`DEMO.md:8`）。

**静默怎么用**：两段——下潜（30.0–33.6s，只剩路线与 −66dB 船体吱呀）与第一滴咖啡之前（45.3–45.9s，数字零）。每段之后的第一声都是全片最重要之一：**船笛**（约 +10dB，D2 锯齿叠失谐 + 2.8s 尾音）与**一滴落进空杯**（`STYLE.md:74`、`DEMO.md:73`）。

---

## 4. 镜头逻辑

**镜头是什么**：一个「世界中心 + 对数插值缩放 k（px/单位）」的正交等距镜头——投影永不改变，只沿路线推进/拉远/平移。

| 运动 | 表达 | 可服务 |
|---|---|---|
| 沿路线跟随 | 过程；因果 | 供应链；旅程；信号 |
| 大全景 + 圆形插图 | 系统与个体同框 | 工厂里的一个工人 |
| 穿过嵌套剖面推进 | 跌进尺度；百万里找一个 | 大海捞针；机器内部 |
| 快速对数拉远 | 释放；细节之后的大局 | 尺度揭示；统计被物化 |
| 锁定 + 东西累积 | 系统被填满；过载 | 队列；交通；增长的数据 |
| 在空处横向跟随 | 一口气；距离 | 海；等待；安静阶段 |
| 上下俯仰穿过地层 | 层；深度；历史 | 地质；城市地下；软件栈 |
| 换一块板 | 前后；此地与彼地 | 两座城；两个时代 |

**允许的转场**：剖切（切线→皮肤滑走→阴影线留下）、换板、切进/出圆形插图、空处长横移。

**禁止**：透视/旋转/倾斜投影；半透明运动的实体（只能靠运动到场）；标签盖住主体；字幕与其它文字重叠或占用底部保留带；无来由的运镜。

---

## 5. 表达习惯（idioms）

1. **剖切**：剖切线 → 皮肤滑走 → 阴影线剖面沿留下（切水果、船壳、集装箱、建筑、机器）。
2. **Isotype 数字**：同样的小图标每次摆成不同排布。
3. **焦点 + 上下文**：除主体外全部灰掉。
4. **框中框**：引线长成圆形插图。
5. **尺度揭示**：拉到所有标签同屏，最后一帧是一张完成的信息图。
6. **被追踪的主体**：一个物件被「你在这里」环跟着。
7. **地层剖面**：板边成为故事。

---

## 6. 氛围

一张摊在工作台上的系统图 / 一块漂浮的沙盘：奶油色的底、点阵、柔和模糊阴影、几档明快平涂色。整体是**清楚、可信、可数、值得被拆开看**的气质。

---

## 7. 声音

- **乐器**：轻的原声（kalimba、marimba、尼龙吉他、pizzicato、木鱼与手鼓、立式/合成贝斯、钟琴、玩具钢琴，或干净电子脉冲）。**没有钢琴、没有弦乐 pad。** 一个短动机可以标记主体。
- **动作声（按材质）**：纤维断裂、肉闷响、颗粒哗啦、倒谷、钢泛音（集装箱）、麻布撕裂、鼓筒旋转、干裂爆响、磨豆啸叫 + 碾压、压粉 thock、陶瓷 plink、升调倾倒。**每个点亮的图标 = 一个声音。**
- **混音规则**：音乐在人声下 −8dB、环境 −7dB；说话时鸟叫静音（whisper 会误听）。J/L-cut 承载建筑（下一站的声音提前 0.6s 进来）。最终拉回每站一个 kalimba 音。−14 LUFS、grain 0。

---

## 8. 变化空间（可自由发挥）

系统、板（或几块）、是否有一个被追踪的主体、数字、镜头路径、开场与结尾。`STYLE.md:107-111`：
- **结构**：一栋楼、一层一层（从剖面塔俯仰下来）；两块板对照（同一系统在两个地方/时代）；一个循环（环形路线回到起点，每圈改一个数字）。
- **开场**：先给完成的信息图再拆成会动的零件；一个小图标不断复制直到变成风景；一个用等距字写在空板上的问题。
- **结尾**：一个没有答案的站点；只剩图例；一个图标的特写，背后大数字虚焦。

---

## 9. 禁忌清单

- 透视或旋转/倾斜的投影。
- 低多边形 3D 的光照（三档面调之外没有光照）。
- 半透明运动的实体（幽灵感）。
- 标签或字幕盖住主体。
- 数字对不上（这个风格靠可信度活着）。
- 实体上加黑色卡通描边（墨线只属于信息图家具）。
- 照抄任何真实的图标、建筑、配色或音乐。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约

### 10.1 内容文件字段（`timeline.js`）
导出 `BPM/BEAT/BAR/BPM2/BEAT2`、`TL`（命名锚点表）、派生数组（`TL.SUNS` 21 个 16 分音符、`TL.DAYS` 18 格、`TL.CRACKS` 8 个切分音、`TL.FULL_STATIONS` 7 个音）、`SUBS[]`（{id,t0,t1,text}）、`KM={farm,sea,city,total}`（**必须相加**）。配音 `lines.json`：[{id,t,text,voice,speed,asr?}]。

### 10.2 新画面元素的契约
用 `engine.js`：任意路径走 `shape(iso, pts2d, at, {color, depth, plane, scale})`；现成轮廓 `sparkPath`/`cursorPath`。方块/柱/锥/屋顶/球用 `box/prism/cyl/cone/roof/sphere`；`flat`（贴花）/`line3`（三维折线）/`bill`（立牌）/`text3`（等距字）；`push/pop` 局部坐标系（法线一起旋转）；单色例外 `iso.keep = true`。

### 10.3 时间线契约
`film.js` 导出 `DUR`、`camAt(t)`、`ROUTE`、`render(g,t,Q)`、`events()`。页面契约：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。

### 10.4 事件词汇

| type | 含义 |
|---|---|
| `title_word` | 标题字 |
| `pin` | 标签针 |
| `inset_open` / `inset_close` | 圆形插图开合 |
| `knife` | 剖切线 |
| `cherry_cut` | 切 |
| `slide_steel` | 皮肤滑走（`small:1` 小号） |
| `tear` | 麻布撕裂 |
| `silence` | 静默 |
| `creak` | 船体吱呀 |
| `sack_load` / `truck{dur}` / `amb_port` | 装载 / 卡车 / 港口环境 J-cut |
| `vo{id}` | 人声（读 voices/<id>.wav） |

其余按材料的动作声由 mix.py 按 TL 命名时刻生成；`tools/cuecheck.py` 用 68 个画面同步点校点。

---

## 11. 构建链

```
sh demo/build.sh
  # TTS → whisper → score → events → cue check → mix → srt
  # → render（1,411 帧 ≈35s / 2 workers）→ mux（−14 LUFS, grain 0）→ final whisper → stills
```
（`DEMO.md:135`）

---

## 12. 证据

```
styles/iso-infographic/STYLE.md:6-13     本质 + 不是什么
styles/iso-infographic/STYLE.md:15-24    材料与渲染（投影公式/三档色调/墨线/板/复合件/人物/特写/LOD）
styles/iso-infographic/STYLE.md:26-32    颜色逻辑
styles/iso-infographic/STYLE.md:34-40    字体与字幕
styles/iso-infographic/STYLE.md:42-49    运动质量（线引导/剖切时序/Isotype 回弹/累积=加速）
styles/iso-infographic/STYLE.md:51-66    镜头词汇表
styles/iso-infographic/STYLE.md:68-76    声音
styles/iso-infographic/STYLE.md:78-88    七条 native moves
styles/iso-infographic/STYLE.md:90-99    媒介陷阱
styles/iso-infographic/STYLE.md:101-103  引擎 API
styles/iso-infographic/STYLE.md:105-111  变化空间
styles/iso-infographic/DEMO.md:3         不要复用故事/叙事弧/镜头/道具/时长
styles/iso-infographic/DEMO.md:8         一张等距图 / 45–60s / Z 形路线
styles/iso-infographic/DEMO.md:12        站点讲法一致
styles/iso-infographic/DEMO.md:23-28     六种 native power 的用法
styles/iso-infographic/DEMO.md:30-39     故事形状 + 数字必须相加
styles/iso-infographic/DEMO.md:43-58     逐拍镜头表
styles/iso-infographic/DEMO.md:60-67     运动数值
styles/iso-infographic/DEMO.md:69-79     配乐（两段静默、船笛 +10dB、三层）
styles/iso-infographic/DEMO.md:81-100    调色板与道具
styles/iso-infographic/DEMO.md:102-106   字幕卡与片尾卡=图例
styles/iso-infographic/DEMO.md:108-119   逐条陷阱
styles/iso-infographic/demo/timeline.js:1-34   唯一真值（网格/TL/派生/SUBS/KM）
styles/iso-infographic/demo/engine.js:4-36     30° 常量 / tri() / PAL
styles/iso-infographic/demo/engine.js:39-98    Iso 类（投影/相机/深度队列/sub）
styles/iso-infographic/demo/engine.js:100-119  box() 六面排序 + out 法线
styles/iso-infographic/demo/engine.js:245-249  normal() Newell
styles/iso-infographic/demo/engine.js:259-286  pin() / inset()
styles/iso-infographic/demo/engine.js:302-328  ring() / cutLine() / hatch()
styles/iso-infographic/demo/engine.js:331-345  ICON.* / iconGrid（Isotype）
styles/iso-infographic/demo/engine.js:346-372  person()
styles/iso-infographic/demo/engine.js:373-388  shape() / sparkPath / cursorPath
styles/iso-infographic/demo/film.js:7          DUR
styles/iso-infographic/demo/film.js:61-82      camAt() 对数插值与下潜
styles/iso-infographic/demo/film.js:188        ROUTE
styles/iso-infographic/demo/film.js:523-540    插图剖切 / 追踪环 / 剖切线
styles/iso-infographic/demo/film.js:588-598    events() 全部 type
styles/iso-infographic/demo/lines.json:1-35    6 行旁白实测
styles/iso-infographic/style.json:16-17        frame_sec 35.28 / dur 58.8
```
