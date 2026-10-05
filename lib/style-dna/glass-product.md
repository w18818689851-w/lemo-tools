# 玻璃质感产品（glass-product）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Aura — Hear the Light》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部在透明与磨砂玻璃里做产品渲染的发布片：一个由**玻璃、金属与光**构成的单一英雄物件悬浮在无限黑的影棚里，长灯条在它**背后与旁边**把透明玻璃变成一条带彩虹边的细白轮廓，内部像陈列柜一样透出来。

**它不是**：白幕目录棚拍、线框 HUD、发布会幻灯片——材质与光才是主角。
（`STYLE.md:12`）

**铁律**：物件永远是**虚构的**；绝不复制真实产品剪影、品牌名、logo、字体或 UI（`STYLE.md:10`）。

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **影棚=灯条场景，不是 HDRI** | 用发光面片搭极小黑场景，**每帧**烘焙 PMREM（`pmrem.fromScene(env,0,1,1000)`，销毁上一张 RT）：身后高侧灯条（剪影）、远处宽条（地平线轮廓光）、柔和顶箱、弱前卡片（凹面玻璃朝镜头时关）、顶前主光（仅爆炸视图）、脉冲驱动的强调色卡、**光扫**（在镜头背后，方位角 = 镜头 + π）。真几何 → 高光/折射/色散物理移动；**绝不画 2D 高光**。 |
| **透明玻璃** | transmission 1、roughness ≈0.015、IOR ≈1.52、thickness 决定透镜（3–4.5）、dispersion 5、attenuation `#f3f8fb` @160mm、`DoubleSide`。 |
| **磨砂玻璃** | transmission 0.82–0.9、roughness 0.4、tint `#eef2f5`、thickness 7–14；黑上会读成深灰塑料，除非背后/内部有亮的东西（内部不透明自发光碟）。 |
| **金属** | 缎面钛带（rough 0.16）、镜面铬（0.14；0.05 会爆成白盘）、拉丝钢、香槟色振膜（同心拉丝 roughness map）、带金走线的石墨 PCB。 |
| **导光条** | 抛光亚克力 `#15181b`、clearcoat 1；彗星脉冲头 σ=w/2、尾长 4w@55%、白热核心 head³×0.35、色相蓝→紫随年龄；idle ≈0。 |
| **背景/地板** | 黑 + 可选深灰径向 sweep（`#34383d → #16181b → #000`，0–1.1）；地板 Reflector 12-tap 模糊 ×0.32 径向淡出 + 程序化焦散（透镜环 + R/G/B 偏移、扭曲 Voronoi 细丝、事件扩散环）；**没有地平线**。 |
| **后期** | 2× 超采样；物理 DoF（微距 700–900、爆炸 70、宽景 160–300）；bloom 0.16–0.3 只在 >1.1；**Neutral 色调映射**（AgX 会把强调色洗白）；grain 0。 |

**铁律**：**任何放在透射玻璃里的东西都必须不透明**（只有不透明物体才进 transmission buffer，`STYLE.md:19`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：无主语/祈使式的产品宣言。现在时，克制、低沉。

**长度（实测）**：demo 4 行 **10–27 个字符**；最短 `Meet Aura.`（10 字符）、`Hear the light.`（15 字符），最长 `Every part, in plain sight.`（27 字符）。

**字幕是一块磨砂玻璃**：居中圆角条（76px 高、radius 38），用实时画面模糊填充（`filter: blur(18px) brightness(1.25)` + 10% 冷白、1.2px 渐变描边、蓝→紫顶线）；Inter Tight 300、40px、tracking 1px；停留 ≥ `max(1.9s, 语音 + 0.7s)`（`DEMO.md:56`）。

**标题**：同一款 grotesk 超细字重（200）、很大（112–132px）、很宽字距（56–64px）、居中在上三分之一；一道斜光扫过字母、与物件上的光扫同步；kicker 用小号全大写（18–20px，tracking 8–10）。

**铁律**：**绝不单独念产品名**——ASR 和观众都会听错（demo 把 `Aura.` 改成 `Meet Aura.`，`DEMO.md:45`）。

**句首类型**（示例性）：
- 短语式主张：`Nothing to hide.`
- 强调全部可见：`Every part, in plain sight.`
- 给产品一个动词：`Meet Aura.`
- 感官收束：`Hear the light.`

**这个风格里不会出现的句式**：长句/从句/书面语；单独念产品名；营销腔、感叹号堆叠；第一人称抒情。

---

## 3. 叙事节奏

**信息投放顺序**：

```
黑场里被外部光照亮（神秘）
  → 打开（好奇）
  → 看透（亲密、微距）
  → 拆开（悬念、全静默）
  → 在 drop 上合拢并从内部亮起来（释放）
  → 自信的节奏
  → 回家（安定、回响）
```

一个物件、一个目标（自己发光）、一次转折（重新组装）。**首尾呼应**：开场用一道光扫揭示黑暗的物件，结尾用**同一道**光扫扫过已经自己发光的它（`DEMO.md:16`）。

**时间挂在 120 BPM 网格上**：1 拍 = 0.5s，1 小节 = 2s（`story.js:2`）。

| 时间（s） | 事件 |
|---|---|
| [0.5,1.7] / [2.0,3.2] | 黑场两道光扫 |
| [1.0,3.9] | 标题 |
| [4.5,7.6] / 8.0 | 开盖 / 磁吸落定 |
| [8.0,9.4] | 右耳机磁吸浮起 |
| [12.0,15.2] / 15.5 / 16.0 | 爆炸视图 / 屏息 / **合拢（drop）** |
| [20.0,21.2] | 左耳机飞入 |
| 24.0 / [27.0,27.8] | 结尾光扫 / 两只耳机落回托槽 |
| [24.5,27.7] / 28.0 | 片名 / 结束 |

爆炸段被拉长到 **17.0s**，让零件冲回来、16.0 合拢、光纹在同一帧首次亮起（因果在同一个机位里）。**剪辑点都在小节线上**。

**总时长**：主 demo **32.0s**（`style.json:17`）；DEMO 给的故事弧 **30–40s**（`DEMO.md:14`）。

**静默怎么用**：合拢之前**半小节的完全静默（连混响尾巴都切掉）**，里面最多放一条反向呼啸（demo 15.55s 一条 0.45s 的 `revwhoosh`——零件被吸回）。静默后第一声最重要：16.0 的合拢 = 一串磁吸 click 簇 + 一个非谐玻璃和弦。

---

## 4. 镜头逻辑

**镜头是什么**：一台**永远在漂移**的影棚摄影机：缓慢环绕或推进，绝不锁死、绝不手持（除撞击时几帧微震）。产品片**不需要镜头间的空间连续性**——每一镜都是它自己的展示台，可以藏起或移走任何不为它服务的东西。

**词汇表**（用法由主题决定）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 扫过黑暗物件、缓慢推进 | 先看轮廓、再看内容 | 未知的东西；之前的状态 |
| 缓慢的高位 3/4 环绕 | 一次运动看完整件 | 机构打开；变体 |
| 微距、从表面机架对焦到内部零件 | 没什么可藏的 | 一个成分；一个传感器 |
| 侧面微距环绕 | 材质对比 | 层次；一条缝 |
| 爆炸视图、轴与视线约 40°、环绕 | 技术美、悬浮 | 架构；转折前的停顿 |
| 正面直对、轻微推进 | 宣告 | 一个数字；一个名字 |
| 俯视微距 | 满尺寸下的图案 | 通道；一块电路 |
| 俯视地板 | 效果离开物件 | 范围；扩散的能量 |
| 低角度环绕物件下方 | 纪念碑、重量 | 耐用；旗舰 |
| 缓慢拉远进入负空间 | 给字留位置 | 一个主张；一个问题 |

**允许的转场**：在拍上剪辑（尽量落小节线）；一道光扫穿过黑场。

**禁止**：溶解与划像；锁死机位（必须一直漂移）；手持；在宽景里让英雄物件被画框边缘切掉；非拍点剪辑。

---

## 5. 表达习惯（idioms）

1. **透明**：里面才是英雄；从外壳机架对焦到内部零件。
2. **透镜**：厚玻璃穹顶会放大并弯曲它背后的东西。
3. **色散**：一道光扫穿过厚边缘时变成一段移动的光谱。
4. **光在内部旅行**：能量（电、数据、热、声）作为光在通道里跑。
5. **焦散**：一次内部脉冲变成地板上扩散的环。
6. **爆炸视图与合拢**：零件浮开，在 downbeat 上「啪」地合回去。
7. **磨砂变透明**：磨砂壳变清（roughness 与 tint 动画到 0），内部出现。
8. **把任意主题套用**：找到「产品做的那个看不见的事」，让它在玻璃里变成光（`STYLE.md:75`）。

---

## 6. 氛围

一间无限黑的影棚：只有灯条、玻璃、金属与一条会流动的光；冷、静、精密。整体是**透明、可信、被认真打光**的气质，而不是喧闹或温暖的。

---

## 7. 声音

- **极简电子，绝不用钢琴加弦乐**：弓奏玻璃/湿指音、颗粒水晶云、玻璃铃与 FM 玻璃拨弦、给精确感的滤波 tick 网格、暖 pad、sub drone、软短 kick 与拍手、808 低音（正弦 + 音高包络、软饱和、滑音）、噪声与锯齿 riser、一声高玻璃叮；小调与调式色彩适合暗影棚（demo：120 BPM、F 小调）。
- **锁拍**：每一条脉冲、光扫与合拢都锁在配乐上——**先写 cue 表**，配乐与渲染器共用同一份 hit list；光脉冲可以精确跟随一条切分的 bass 模式（demo：808 每小节 `[0, .75, 1, 1.5]`，光脉冲一一对应）。
- **拟音按材质**：光扫用玻璃微光（带通噪声 + 非谐泛音、随灯条声像移动）；移动盖子用玻璃-金属摩擦；磁吸 click（<2ms 瞬态 + 3–5kHz 金属共振 + 低频闷响）；移动零件用气流噗；合拢 = 一串相隔几毫秒的 click + 一个非谐玻璃和弦（泛音 ×2.76、×5.4）；玻璃碰玻璃的 tick。
- **静默是工具**：释放前一小段完全静默（连混响尾巴都切掉），里面最多一条反向呼啸。
- **混音**：音乐在人声下压 ~12 dB、拟音 ~6 dB；把最大低频峰值限掉 ~3 dB 让 loudnorm 保持线性；−14 LUFS；grain 0。

---

## 8. 变化空间（可自由发挥）

物件（永远虚构）、内部、强调色、结构、开场、结尾、镜头路径、节奏与音乐。

`STYLE.md:102-104` 给了远离 demo 的方向：
- **结构**：一条产品线（三个变体靠内部发光的东西对比）；光的一天（一个物件经历早、中、晚，灯条组绕着它转）；材质堆叠（每拍去掉一层，直到核心独自立着）。
- **开场**：先看里面（一个内部零件；外壳在它周围成形）；先看焦散（地板上的光，顺着它往上找到物件）；剪影（几个黑轮廓；一个开始发光）。
- **结尾**：只剩地板（物件离开，它的焦散还在脉动）；降温（自发光淡到只剩灯条轮廓）；停在微距（不拉远；一个细节，名字很小）。

---

## 9. 禁忌清单

- 白幕目录棚拍。
- 线框 HUD。
- 发布会幻灯片。
- 复制真实产品剪影、品牌名、logo、字体或 UI。
- 画 2D 高光（光扫必须是真几何，高光/折射/色散要物理移动）。
- 溶解、划像、手持、锁死机位。
- 把强调色用在非光的东西上。
- 在非拍点剪辑。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

- `story.js`：BPM 网格、镜头表 `SHOTS`、kick 表 `KICKS`、光扫表 `MACRO_SWEEPS`、旁白 `VO`、拟音 `SFX`——**是配乐与渲染器共用的唯一真值**。
- `lines.json`：每行 `{id,text,voice,speed}`，demo 用 `am_michael`、speed 0.86–0.88、3–4 短行。
- 强调色族（冰蓝 `#62DCFF` → 淡紫 `#A98BFF`）；灯条组尺寸/强度；材质参数；`cues.json`（关键时间点，供自检）。

### 10.2 新画面的契约

**新物件：替换 `product.js` 里的几何（例如把玻璃圆柱 + 盘绕导光条），保留材质与 `studio.js`**（`STYLE.md:96`）。
- 材质：`glass({...})` / `frosted({...})` / `metal(color,rough,{...})` / `guideMat(wrap)`（彗星脉冲 `onBeforeCompile`、`setPulses(mat,list,base)`）。
- 爆炸：`explode(bud,e,spin)`。
- 影棚：`makeStudio(renderer,scene)`（每帧 PMREM、光扫、背景、地板镜像 + 焦散 + 拍环）。

### 10.3 时间线契约

`story.js` 是**唯一真值**：导出 `BPM/BEAT/BAR/DUR`、`T`（关键时间点）、`SHOTS/shotAt`、`KICKS`、`MACRO_SWEEPS`、`VO`、`SFX`。
`main.js` 的 `frame(t)` 按 `shotAt(t)` 分镜布景、相机、光与脉冲、磨砂字幕、标题、片尾卡。页面契约 `window.READY / window.render(t) / window.DUR`。

### 10.4 事件词汇

`sweep{d,pan,v}` / `slide{d,v}`（玻璃翻盖摩擦）/ `tock`（翻盖到位）/ `click{v,pan}`（磁吸）/ `lift{d,v,pan}`（浮起）/ `puff{v,pan}`（零件气流）/ `slowwhoosh{d,v}` / `revwhoosh{d,v}`（静默里的反向呼啸）/ `snap{v}`（合拢 = click 簇 + 玻璃和弦）。
全部由 `story.js` 的 `SFX` 声明，再由 `core/render/events.mjs` 序列化成 `events.json`。

---

## 11. 构建链（复用机制）

```
1. 先写 cue 表与 story.js（BPM 网格、配乐与渲染器共用的 kick 表）。
2. node core/render/still.mjs styles/glass-product/demo 9.3 14.6 26.8 [--q nosub=1] 迭代静帧；
   --range 0.5:31.5:1 + sheet.py 做总览。
3. core/tts/tts.py demo/lines.json demo/voices → asr_check.py 直到全部 OK。
4. python demo/music/score.py → node core/render/events.mjs demo → python demo/mix.py。
5. node core/render/video.mjs demo --fps 24 --workers 3（768 帧含 2×SSAA、transmission、
   每帧 PMREM 与镜像 ≈ 30–45s on M-series）。
6. sh core/render/mux.sh out/video24.mp4 mix.wav glass-product.mp4 24 0，再 python demo/check_mix.py。
7. 或直接 sh styles/glass-product/demo/build.sh。
```
（`DEMO.md:80-86`）

---

## 12. 证据

```
styles/glass-product/STYLE.md:8            本质
styles/glass-product/STYLE.md:10           物件永远虚构
styles/glass-product/STYLE.md:12           不是什么
styles/glass-product/STYLE.md:16           影棚=灯条场景 / 每帧 PMREM / 光扫
styles/glass-product/STYLE.md:17-20        透明/磨砂/金属/导光条
styles/glass-product/STYLE.md:21-22        背景 / 地板焦散 / 后期
styles/glass-product/STYLE.md:26-29        颜色逻辑
styles/glass-product/STYLE.md:33-35        字体与字幕
styles/glass-product/STYLE.md:39-43        运动质量
styles/glass-product/STYLE.md:49-62        镜头语法表 + 无空间连续性
styles/glass-product/STYLE.md:66-71        声音
styles/glass-product/STYLE.md:75-83        native moves
styles/glass-product/STYLE.md:100-104      变化空间
styles/glass-product/DEMO.md:3             不要复用故事/叙事弧/镜头/道具/时长
styles/glass-product/DEMO.md:10-12         demo 故事 + 不可见之物可视化
styles/glass-product/DEMO.md:14            故事弧 30–40s
styles/glass-product/DEMO.md:16            首尾呼应
styles/glass-product/DEMO.md:24-33         逐拍镜头表
styles/glass-product/DEMO.md:37            运动数值
styles/glass-product/DEMO.md:41            配乐
styles/glass-product/DEMO.md:43-45         拟音与混音
styles/glass-product/DEMO.md:49-57         强调色 / 灯条组 / 材质 / 后期 / 字幕条 / 标题
styles/glass-product/demo/story.js:2-3             BPM 120 / DUR 32
styles/glass-product/demo/story.js:6-15            关键时间点 T（snap 16.0）
styles/glass-product/demo/story.js:18-22           SHOTS / shotAt
styles/glass-product/demo/story.js:25-30           KICKS / MACRO_SWEEPS
styles/glass-product/demo/story.js:33-38           VO
styles/glass-product/demo/story.js:41-57           SFX
styles/glass-product/demo/studio.js:6-8            makeStudio / 黑 env
styles/glass-product/demo/studio.js:20             光扫灯条
styles/glass-product/demo/studio.js:34-48          每帧 pmrem.fromScene
styles/glass-product/demo/studio.js:89             透镜环形焦散
styles/glass-product/demo/studio.js:109            Reflector 地板镜像
styles/glass-product/demo/product.js:6-7           光纹主色
styles/glass-product/demo/product.js:9-16          glass / frosted
styles/glass-product/demo/product.js:47-69         guideMat / setPulses
styles/glass-product/demo/product.js:82-88         makeBud / 玻璃穹顶
styles/glass-product/demo/product.js:142           explode
styles/glass-product/demo/product.js:153-158       makeCase / 磨砂底座
styles/glass-product/demo/main.js:42-48            kickState / budLight
styles/glass-product/demo/main.js:70-71            frame / shotAt
styles/glass-product/demo/main.js:180              微距段每拍光扫
styles/glass-product/demo/main.js:229-261          glintText / AURA 标题
styles/glass-product/demo/main.js:237-242          subtitle 磨砂条
styles/glass-product/demo/music/score.py:2         120 BPM / F 小调 / 32.0s
styles/glass-product/demo/music/score.py:20        KICKS_808
styles/glass-product/demo/music/score.py:65-106    k808 / glass_pluck / bell
styles/glass-product/demo/mix.py:17-74             sweep/mag_click/glass_ding/slide/whoosh_air/puff
styles/glass-product/demo/mix.py:89-90             snap = 6 click 相隔 15ms
styles/glass-product/demo/mix.py:114-120           duck / limit
styles/glass-product/style.json:16-17              frame_sec 19.2 / dur 32.0
```
