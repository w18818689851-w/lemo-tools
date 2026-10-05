# engraving · 从零作者契约（lemo-opuscar / Copperplate Engraving）

> 用途：让**没有读过源码**的作者智能体，仅凭本文就能为 `styles/engraving/` 写出**全新的画面主体模块**与**全新的镜头编排模块**，并让新片子直接配上已有的配乐（`music/score.py`）与混音（`mix.py`）。
>
> 证据约定：所有结论都带 `文件:行号`，路径相对 `D:\lemo-opuscar\`。源码版本 = 2026-09-30 的 `styles/engraving/demo/`。
> 标注「未验证」= 源码里看不到机制，不做推断；标注「未使用」= 源码导出/返回但当前没有任何消费者。

---

## 0. 一页速查：要新做一部片子，最少要做什么

```text
目录（照抄一份 demo 即可）
  styles/engraving/demo/
    index.html            6 行，<canvas id="c" 1920x1080> + <script type=module src=main.js>
    main.js               页面契约：window.READY / DUR / EV / T / render(t)
    film.js               场景/时间线/镜头/合成/事件（你要重写的是这个）
    engine/               burin.js plate.js wash.js copper.js index.js —— 不要动
    subjects/             一个或多个主体模块（你要新写的是这个）
    music/score.py mix.py 配乐与混音 —— 不要动
    tools/events.mjs subs.py cuecheck.py
    content.json          全部文案/数据
    fonts/fonts.css       必须存在（Bodoni Moda / Pinyon Script）

写主体模块 subjects/<name>.js
  1. import * as B from '../engine/burin.js';
  2. export function buildXxx({ x = 960, y = 606, s = 1, seed = 12 } = {}) { ... }
  3. 返回 { ink, regions, focus }：
       ink     = new B.Ink()，组名必须含 'ol0'(首笔，单条长描边) 'ol' 'h1' 'h2' 'h3'
       regions = { <名字>: { path: Path2D, polys: [[[x,y]…]…], bbox: [x0,y0,x1,y1] } }
       focus   = { <名字>: { x, y, r } }  —— 世界坐标；必须有一个叫 eye 的键做兜底
  4. 只画在 x∈[140,1780] y∈[90,990] 内，主体中心 ≈ (960,606)，光来自左上
  5. 调 ink.schedule(...) 交给 film.js；主体自己不要 schedule

写 film 模块 film.js
  1. import * as B from './engine/burin.js'; 以及 plate.js / wash.js / copper.js / subjects
  2. export function makeFilm(C, voiceDur = {}) { ... return { render, DUR, T, EV, subs, dets, cam } }
  3. 时间表必须按 96 BPM 网格（BEAT=0.625）算：见 §2.2，尾部 26 拍结构不可改
  4. 事件表 EV 必须发出 §3.3 列出的全部 type（少一个 mix.py 会 StopIteration 崩）
  5. render(ctx,t) 里不要自己 setTransform 到底；先 applyCam

跑
  sh styles/engraving/demo/build.sh my_content.json           # 主片，覆盖 demo 自己的产物
  sh styles/engraving/demo/tools/build_alt.sh my_content.json # 隔离到 demo/out/alt/
  单帧：node core/render/still.mjs styles/engraving/demo 30.9 --q "content=my.json&nosub=1"
  出片：node core/render/video.mjs styles/engraving/demo --fps 24 --workers 2 \
        --q "content=my.json" --out styles/engraving/demo/out/video.mp4
  验收：python styles/engraving/demo/tools/cuecheck.py      # 必须 mismatches: 0
```

---

## 1. 主体模块契约（最重要）

### 1.1 模块形态与导出

两个内置主体，同一个契约：

| 文件 | 导出 | 说明 |
|---|---|---|
| `subjects/scallop.js:9` | `export function buildScallop({ x = 960, y = 606, s = 1, seed = 12 } = {})` | 最小示例，55 行 |
| `subjects/bee.js:98` | `export function buildBee({ x = 960, y = 560, s = 1, seed = 7 } = {})` | 完整示例，286 行 |

- 调用点唯一：`film.js:23` → `SUBJECTS[subject]({ x: 960, y: 606, s: 1 })`。
  注意 **`s` 恒为 1**，`x/y` 恒为 `(960, 606)`；`seed` 用默认值。所以主体必须在 s=1 下好看。
- 注册表：`film.js:11` → `const SUBJECTS = { bee: buildBee, scallop: buildScallop };`
  未知的 `C.subject` 落到 `bee`（`film.js:22`）。**加新主体必须同时改这一行**（或让新片自己的 film.js 带上注册表）。
- 主体文件里**只允许** `import * as B from '../engine/burin.js'`（bee.js:8 / scallop.js:5）。
  主体**不要** import `plate.js`/`wash.js`/`copper.js`，也不要碰 canvas 状态。
- 主体**不要**调用 `ink.schedule()` / `ink.build()`：切割时序由 film 决定（`film.js:42-47`）。
- `scallop.js:54` 还额外返回了 `center: [x, y], s`；`bee.js:269` 同。**film.js 不读这两个字段**（未使用，可留可去）。

### 1.2 返回值 `{ ink, regions, focus }`

| 字段 | 类型 | 被谁消费 | 要求 |
|---|---|---|---|
| `ink` | `B.Ink` 实例 | `film.js:41` (`const ink = bee.ink`)、`49`(guide)、`191`、`217`、`238` | 组名必须**恰好**是 `'ol0' 'ol' 'h1' 'h2' 'h3'`（`film.js:42-46` 按这些名字 schedule；`49` 按 `'ol'/'ol0'` 抽描线；`117` 按 `'ol0'` 找首笔） |
| `regions` | `{ [name]: { path: Path2D, polys: [[[x,y]…]…], bbox: [x0,y0,x1,y1] } }` | `film.js:55`（障碍物）、`100-102`（手工上色）、`103`（细节圆窗上色） | `polys` 必须是**闭合环的数组**（`B.bboxOf` 能吃）；`path` 是它们的 `Path2D`（`wash.add` 用）；`bbox` 被 `film.js:101` 用来给 abdomen 选画笔落点 |
| `focus` | `{ [name]: { x: number, y: number, r: number } }` | `film.js:58`、`60`、`79`、`84-90`、`168`、`176`、`214-215` | **世界坐标点**（不是局部坐标！），`r` 是该部位的世界半径，决定圆窗的初始半径与放大倍率（见 §4.2） |

`regions` 的 key 命名规则 = **可上色区域名**，直接对应 `content.json` 的 `colors[].region`：

- bee：`abdomen, thorax, head, eyes, wings, legs, pollen`（`bee.js:6`，`content.json:27-56`）
- scallop：`shell, bands, ears`（`scallop.js:4`，`content_alt.json` 的 `colors`）

**怎么造 `regions`**（照抄 `scallop.js:51-52`）：

```js
const mk = list => { const p = new Path2D(); for (const sh of list) p.addPath(sh.path);
  return { path: p, polys: list.flatMap(sh => sh.polys), bbox: B.bboxOf(list.flatMap(sh => sh.polys)) }; };
const regions = { shell: mk([shell]), bands: mk(bands), ears: mk(earSh) };
```

bee 用的是同一套（`bee.js:100` 累积 `regions[name].push(shape)`，`bee.js:261` 折叠成一个 Path2D，`_` 开头的临时键被跳过：`bee.js:261` `if (k.startsWith('_')) continue`）。

**`focus` 的硬要求**：`film.js:58` 是 `const f = bee.focus[d.focus] || bee.focus.eye;`
→ 若 `d.focus` 写错 **且** `focus.eye` 不存在，`film.js:60` 的 `f.x` 会抛 TypeError。所以**任何主体都必须定义 `focus.eye`** 作为兜底键（`scallop.js:53` 没定义 —— 它靠 content 里只写 `umbo/growth` 才没崩，这是潜在坑）。

**圆窗必须能"指到"部位**：`focus[name].r` 是圆窗里那块"待放大圆盘"的世界半径。
`film.js:214` 的 `M = 500 / (d.f.r * 2.4)` → 圆窗（世界半径 `RR=120`）里显示的**世界圆盘半径 = 2.4 × f.r**，放大倍率 = `120 / (2.4 × f.r)`。
bee：`eye.r = 34`（`bee.js:265`）→ 显示半径 81.6 世界单位 → ≈1.47×。所以 `r` 要**比部位本身略大**（留一圈上下文），太小则看不出放大，太大则圆窗里塞进半个身子。

**引线可达性**：`focus[name]` 的点会被 `film.js:84` 拿去算直线，失败则在 `film.js:85-89` 以 20 px 网格搜一个绕行 waypoint；搜不到就 `d.wp = null` 仍画直线（`film.js:90`）。
所以 focus 点**不要埋在其它 region 的多边形里** —— `film.js:79` 会把包含该点的障碍多边形从障碍表里剔除（否则无解）。

### 1.3 `ol0` 首笔的特殊要求

**契约**：`ink.group('ol0')` 之后，必须**恰好 add 一条长描边**（一个 `outline(...)` 调用即可，因为 `outline` 一次 `ink.add` 一条闭合环：`burin.js:352-353`）。

**为什么**（三处消费）：

1. `film.js:117` `const first = ink.S.find(x => x.g === 'ol0');` —— 取 `ink.S` 里**第一条** `g==='ol0'` 的描边，`film.js:118-121` 的 `tipAt(t)` 用它的 `xy`（Float32Array 展平的折线）、`n`（点数）、`s0/s1` 算"此刻刀尖在哪、朝哪"，`film.js:123` 的 `followCam` 让镜头贴着刀尖走，`film.js:258-263` 用它画刻刀与铜屑。
2. `film.js:42` `ink.schedule('ol0', -2.6, 4.2, { conc: 1 });` —— 只有一条描边时 `conc:1` 才有意义（"一刀"）。开窗从 **−2.6** 开始：t=0 时已切掉 `2.6/6.8 ≈ 38%`（DEMO.md:47 "at frame 0 it is already a third cut"），到 4.2 s 收刀。
3. `film.js:49` 把 `'ol'`+`'ol0'` 的描边复制成 `guide`（`s0=-20,s1=-19`），在铜板上当"描好的设计线"淡画（`film.js:255-256`）。

**因此**：
- `ol0` 必须是一条**连续的长轮廓**（demo：蜜蜂腹部外缘 `bee.js:169` `outline(ink, abd.polys[0], { w: 2.3, light: LV, vary: 0.9, seed: seed+1, run: 170 })`；扇贝外壳外缘 `scallop.js:20`，`run: 170`）。
- 长度决定"钩子镜头"的可看性：`followCam` 在 `t ≤ T.lift = 2.0` 之间工作（`film.js:123, 146`），`HOOKZ = 4.2`、roll 从 −0.05 漂到 −0.014（`film.js:122-123`）。描边太短 → 2 s 内刀尖跑完，镜头就没东西可跟。
- `run: 170` 是 `outline` 的"一刀一刀接续"参数（`burin.js:347`），让轮廓在 170 px 的周期内鼓起/收细 —— 首笔尤其需要，否则"统一线宽读成钢笔"（STYLE.md:11,86）。
- **不要**给 `ol0` 排多条描边：`tipAt` 只用第一条（`film.js:117`）。

### 1.4 `engine/burin.js` API 清单（逐个签名 + 主体里的真实用法）

> 全部来自 `engine/burin.js`。**加粗** = 主体一定会用；其余是可用工具箱。

#### 随机与数学

| 函数 | 签名（照抄） | 返回 | 行 |
|---|---|---|---|
| `RNG` | `RNG(seed = 1)` | `() => number`（确定性 0–1） | 18 |
| `hash` | `hash(a, b = 0)` | 0–1 | 22 |
| `noise1` | `noise1(x, seed = 0)` | 0–1，1D 平滑噪声 | 23 |
| `noise2` | `noise2(x, y, seed = 0)` | 0–1，2D 平滑噪声 | 24 |
| `clamp` | `clamp(v, a = 0, b = 1)` | number | 29 |
| `mix` | `mix(a, b, t)` | number（线性插值） | 30 |
| `sstep` | `sstep(a, b, x)` | 0–1 smoothstep | 31 |

典型用法（纹理微扰，`scallop.js:28`）：
```js
return clamp(bulk + 0.45 * (1 - rib) + 0.18 * side + 0.08 * (noise2(px / 40, py / 40, seed) - 0.5));
```

#### 变换与几何

| 函数 | 签名 | 返回 | 行 |
|---|---|---|---|
| `xf` | `xf(x = 0, y = 0, s = 1, rot = 0, flip = false)` | `f([px,py]) → [X,Y]`，且 `f.scale = s` | 34 |
| `compose` | `compose(outer, inner)` | 复合变换，带 `.scale` 相乘 | 39 |
| `parseD` | `parseD(d, step = 2)` | `[{ pts: [[x,y]…], closed }]` | 42 |
| `toPath` | `toPath(subs, path = new Path2D())` | `Path2D` | 82 |
| `bboxOf` | `bboxOf(polys, pad = 0)` | `[x0,y0,x1,y1]` | 86 |
| **`shape`** | `shape(d, f = xf(), step = 2)` | `{ subs, polys, lines, path, bbox }` | 92 |
| `fromSubs` | `fromSubs(subs)` | 同上 | 96 |
| **`ring`** | `ring(pts)` | 同上（一个闭合环） | 100 |
| `ellipsePts` | `ellipsePts(cx, cy, rx, ry, rot = 0, n = 64, a0 = 0, a1 = 2π)` | `[[x,y]…]`（开放圆弧若 a1−a0<2π） | 101 |
| `ellipse` | `ellipse(cx, cy, rx, ry, rot = 0, n = 72)` | `ring(...)` | 107 |
| `inPoly` | `inPoly(polys, x, y)` | bool（even-odd，多环叠加） | 108 |
| `inAny` | `inAny(polys, x, y)` | bool（任一环内） | 117 |
| `resample` | `resample(pts, step)` | 按弧长重采样后的 `pts` | 118 |
| `normals` | `normals(P, closed)` | `[[nx,ny]…]`（左法线，单位） | 130 |
| `polyArea` | `polyArea(P)` | 有符号面积 | 138 |
| `offsetRing` | `offsetRing(P, d)` | 外扩/内缩的环；`d` 可为 `number` 或 `(i,p)=>number` | 140 |
| `along` | `along(P, u)` | `{ x, y, dx, dy, L }`（弧长分数 u 处的点+切向） | 145 |

`shape` + `ring` 是主体骨架（`bee.js:104-112`）：
```js
const TH = 'M0 -172 C50 -172 80 -140 80 -92 C80 -44 52 -8 0 -6 C-52 -8 -80 -44 -80 -92 C-80 -140 -50 -172 0 -172 Z';
const th = shape(TH, W, 1.2), hd = shape(HD, W, 1.2);          // W = xf(x, y, s)
const abd = ring(abdPts.map(W));                                // 用采样点手搓的环
const pet = B.ellipse(P([0, 2])[0], P([0, 2])[1], S(14), S(8)); // 解析椭圆环
```
> `step` 是**局部单位**下的采样步长：`shape` 内部会 `step / f.scale`（`burin.js:93`），所以缩放不会让采样变粗。

`offsetRing` / `along` / `compose` / `linTone` / `blobTone` / `maxT` / `mulT` / `hatchAlong` / `engraveTone` 在 bee/scallop/details 里**都没有被调用**（grep 计数为 0 或仅 import）—— 可用，但本风格没有先例，用之前自己验证。

#### Ink 墨水库

```js
class Ink {
  constructor({ color = INK, minW = 0.16, chunk = 160 } = {})   // L160
  group(name)                          // L161 → this（切换后续 add 的组名）
  add(pts, w)                          // L163，pts=[[x,y]…]；w=number 或逐点数组
  dot(x, y, r)                         // L174，等价于一条极短、宽 2r 的描边
  groups()                             // L175
  schedule(group, t0, t1, { conc = 6, key = null, minDur = 0.06 })  // L179
  instant(group, t = -1)               // L193，整组同时出现（已完成的图）
  build()                              // L194
  draw(ctx, t = Infinity, { view = viewRect(ctx), color = this.color, wScale = 1, dx = 0, dy = 0 }) → tips  // L216
  span(group)                          // L242 → [t0, t1]
  count(group)                         // L243
}
```

- **`w ≤ minW(0.16)` 等于"提刀"**：该处断线（`burin.js:167, 209`）。所以 `wMin` 必须 > 0.16 才画得出来；`bee.js:32` 用 `wMin: 0.16` 恰好贴线，`scallop.js` 用 `wMin: 0.18`。
- `draw` 的返回值 `tips = [[x, y, w]…]` 是"此刻正在被切的位置"（`burin.js:234`），**demo 没用**（film.js 用自己的 `tipAt`）。
- `schedule` 的语义（`burin.js:179-191`）：组内描边按**加入顺序**在 `[t0,t1]` 内依次开切，每条的时长 ∝ 自身长度（等刻刀速度），`conc` = 同时切几条。`key(stroke)` 可改顺序。
- `film.js` 的用法（`film.js:41-47`）：
  ```js
  const ink = bee.ink;
  ink.schedule('ol0', -2.6, 4.2, { conc: 1 });
  ink.schedule('ol',  ...T.build.ol, { conc: 16 });   // [2.6, 4.6]
  ink.schedule('h1',  ...T.build.h1, { conc: 70 });   // [3.3, 5.5]
  ink.schedule('h2',  ...T.build.h2, { conc: 70 });   // [4.4, 6.2]
  ink.schedule('h3',  ...T.build.h3, { conc: 90 });   // [5.0, 6.9]
  ink.build();
  ```
  → **主体作者只需保证这 5 个组存在且内容合理**；密度（conc）由 film 调。

#### 排线 / 描边 / 点 / 毛

| 函数 | 签名 | 关键点 | 行 |
|---|---|---|---|
| **`hatch`** | `hatch(ink, polys, o = {})` | 一族平行线，被 `bend` 弯成贴合形体；按 `tone(x,y)` 变宽；`excl` 是遮挡（逐环相减） | 272 |
| `engraveTone` | `engraveTone(ink, polys, o = {})` | `hatch` 的三遍（`g` / `g2` / `g3`） | 307 |
| `hatchAlong` | `hatchAlong(ink, polys, guide, o = {})` | 沿一条引导线的等距"袖套"线 | 319 |
| **`outline`** | `outline(ink, pts, o = {})` | 会**鼓起**的轮廓；闭合时按光向变粗、按 `run/pinch` 断成数刀 | 336 |
| **`stroke`** | `stroke(ink, pts, w = 1.4, o = {})` | = `outline(..., { closed: false, taper: o.taper ?? 16, grain: 0.15 })` | 355 |
| **`stipple`** | `stipple(ink, polys, { density = 0.02, tone = () => 0.5, r = 0.7, seed = 5, thr = 0.2, excl = null } = {})` | 按 tone 撒点 | 357 |
| **`fur`** | `fur(ink, polys, { density = 0.01, len = 10, dir = () => [0,1], w = 0.9, seed = 9, tone = () => 0.6, curl = 0.25, rimOut = 1, excl = null } = {})` | 短毛，从体内长出、沿 `dir(x,y)` 梳 | 365 |

`hatch` 的完整选项（`burin.js:273-274`，**照抄**）：
```
angle = 0, spacing = 6, bend = 0, tone = () => 0.5, thr = 0.15, wMin = 0.18, wMax = 2.0,
gamma = 1.0, step = 2.5, taper = 10, jitter = 0.12, wobble = 0.35, seed = 1,
excl = null, origin = null, a0 = 0, dash = 0, bend2 = 0, flipDir = false, swell = 0.8
```
`outline` 的完整选项（`burin.js:337`）：
```
w = 2, closed = true, light = [-0.6, -0.8], vary = 0.8, taper = 14, seed = 3, step = 2,
excl = null, grain = 0.2, w0 = null, w1 = null, run = 110, pinch = 0.55, swell = true
```

**主体里的真实调用片段**（这些就是"典型用法"，照抄即可）：

```js
// ① 轮廓（管状肢节）：bee.js:31
ink.group('ol');  outline(ink, c.polys[0], { w, light: LV, vary: 0.9, seed, excl });

// ② 第一族排线：沿肢节轴向，只在暗侧出现：bee.js:32
ink.group('h1');  hatch(ink, c.polys, { angle: c.ang, spacing: spacing * 0.8, tone, thr: 0.16,
                                        wMax: 1.3, wMin: 0.16, seed, taper: 5, excl });

// ③ 交叉族：bee.js:33
ink.group('h2');  hatch(ink, c.polys, { angle: c.ang + Math.PI / 2 - 0.25, spacing: spacing * 1.05,
                                        tone, thr: 0.5, wMax: 1.0, wMin: 0.16, seed: seed + 3, taper: 3, excl });

// ④ 第三族（深暗/腰线）：bee.js:207
ink.group('h3');  hatch(ink, th.polys, { angle: 1.4, spacing: 4.4, tone: thTone, thr: 0.74,
                                         wMax: 0.9, wMin: 0.18, seed: seed + 5, excl: headX });

// ⑤ 弯折贴合形体（腹部体节）：bee.js:186
hatch(ink, inter, { angle: 0, bend: -((b0 + b1) / 2) / (100 * 100 * s), a0: 0,
                    origin: P([0, (y0 + y1) / 2]), spacing: 3.1, tone: segT, thr: 0.14,
                    wMax: 1.9, seed: seed + 70 + i, taper: 8 });

// ⑥ 手搓逐点宽度（生长纹，宽度随 tone 变）：scallop.js:42
const ws = pts.map(([px, py]) => { const t = toneAt(px, py); return (strong ? 0.5 : 0.18) + (strong ? 1.1 : 0.55) * t; });
ink.add(pts, ws);

// ⑦ 开口描边（脊线、脉、须、体节边）：scallop.js:33 / bee.js:190 / bee.js:199
stroke(ink, pts, 1.1, { taper: 60 });
stroke(ink, rim, 2.2, { taper: 30 });
stroke(ink, [[px - d[0] * 2, py - d[1] * 2], [px + d[0] * ln, py + d[1] * ln + ln * 0.4]], 0.6, { taper: 3 });

// ⑧ 撒点（花粉球）：bee.js:156
stipple(ink, pl.polys, { density: 0.09, tone: addT(sphereTone(cm[0], cm[1], rx, ry, { L, rot: ang }), 0.1),
                         r: 0.62, seed: seed + 61, thr: 0.05 });

// ⑨ 绒毛（胸背的毛被）：bee.js:213
fur(ink, th.polys, { density: 0.045, len: 11 * s, w: 0.85, seed: seed + 6,
                     dir: (xx, yy) => norm([xx - thC[0], yy - thC[1] + 10 * s]),
                     tone: thTone, curl: 0.5, excl: headX });

// ⑩ 遮挡：把前层形状的 polys 作为 excl 传进去（几何遮挡，不是混合）：bee.js:118,204
const headX = [...hd.polys, ...eyePolys], bodyX = [...abd.polys, ...th.polys, ...headX, ...pet.polys];
outline(ink, th.polys[0], { w: 2.0, light: LV, vary: 0.9, seed: seed + 2, excl: headX });
```

#### 色调场

| 函数 | 签名 | 说明 | 行 |
|---|---|---|---|
| `LIGHT` | `{ x: -0.55, y: -0.6, z: 0.58 }` | 全片唯一光向（`plate`/`copper` 同源） | 381 |
| **`sphereTone`** | `sphereTone(cx, cy, rx, ry, { base = 0, k = 1, L = LIGHT, rot = 0 })` | 椭球的光照 → `tone(x,y)` 0(亮)–1(背光) | 383 |
| **`cylTone`** | `cylTone(cx, cy, r, a, { base = 0, k = 1, L = LIGHT })` | 圆柱（肢节轴向 `a`） | 391 |
| `linTone` | `linTone(x0, y0, x1, y1, t0, t1)` | 线性渐变 tone | 398 |
| `addT` / `maxT` / `mulT` | `addT(...fs)` / `maxT(...fs)` / `mulT(f, k)` | 组合 tone 场（自动 clamp） | 399-401 |
| `blobTone` | `blobTone(cx, cy, rx, ry, v = 0.6, soft = 0.5)` | 软斑 | 402 |
| `formTone` | `formTone(polys, { light = [-0.6,-0.7], lz = 0.55, base = 0.05, k = 1, res = 180, radius = null, rim = 0.25, ambient = 0 } = {})` | 任意形状 → 距离场"枕头"光照；返回值还带 `.df(x,y)` 与 `.grad` | 408 |
| `contourHatch` | `contourHatch(ink, polys, { spacing = 6, tone = null, thr = 0.15, wMin = 0.3, wMax = 1.8, from = 0.5, maxLevels = 200, taper = 8, seed = 4, light } = {})` | 沿距离场等值线的"顺形线" | 435 |

主体里最常用的是 `sphereTone` / `cylTone` + `addT`：

```js
// bee.js:167 腹部：椭球，中心在局部 (0,140)
const abdTone = sphereTone(P([0, 140])[0], P([0, 140])[1], S(96), S(165), { L, base: 0.0 });

// bee.js:30 肢节：圆柱 + 常数加深 + 关节处的压暗（自定义函数混进 tone）
const tone = addT(cylTone(cm[0], cm[1], r * 1.05, c.ang, { L }), dark, 0.12, joint);
```
> `addT` 接受**函数或常数**（`burin.js:399`），所以 `addT(cylTone(...), 0.12, joint)` 里的 `0.12` 是整体加深。
> 主体的 tone 函数一律**吃世界坐标**（`tone(x, y)`），因为 `hatch` 是在世界坐标里采样（`burin.js:291`）。

#### 公共入口 `engine/index.js`

```js
engraveShape(d, { at = B.xf(), light = [-0.6,-0.7], spacing = 4, wMax = 1.6, outlineW = 1.8,
                  style = 'hatch', angle = -0.6, ink = new B.Ink(), g = '', base = 0.05, seed = 1 } = {})
  → { ink, shape, tone }        // index.js:16；组名 `${g}ol ${g}h1 ${g}h2 ${g}h3`
```
它**不满足主体契约**（组名带前缀、没有 regions/focus、没有 `ol0`），所以**不要**用它来写 `subjects/*`；它只用于一次性小图（`demo/example/index.html`）。主体要自己 `new B.Ink()` + 手工分组。

### 1.5 尺寸 / 坐标系 / 光向 / 比例

| 约定 | 值 | 证据 |
|---|---|---|
| 世界坐标系 | 1920×1080，原点左上，y 向下 | `film.js:14` |
| 主体落点 | `(x, y) = (960, 606)`，`s = 1` | `film.js:23` |
| 主体局部系 | **"plate px at scale 1，胸腹交界在 (0,0)，头朝 −y"** | `bee.js:2` |
| 主体包络 | bee 局部 y ∈ [−371, +290]、x ∈ [−165, +165]（须尖到腹尖） | `bee.js:104-115, 253` |
| 版框安全区 | 主体必须完全落在版框 `PLATE` 内；引线绕行点的搜索域 = `x∈[140,1780] y∈[90,990]`（20 px 网格），所以主体（及 focus 点）应落在这个域内，否则引线只能直穿 | `film.js:15, 85` |
| 光向 | `L = { x: -0.55, y: -0.62, z: 0.56 }`；`LV = [L.x, L.y]` 传给 `outline/hatch` | `bee.js:11-12`, `scallop.js:7` |
| 单张纸上唯一光向 | 全片共用；`B.LIGHT` 是同一方向的引擎默认 | `burin.js:381` |
| 轮廓线宽（s=1） | `w: 1.15 … 2.4`（bee）、`1.8 … 2.4`（scallop）；首笔 `ol0` 用最重的 2.3–2.4 | `bee.js:169, 204, 223`；`scallop.js:20-21` |
| 第一族排线 | `spacing 3.1–3.7`，`thr 0.14–0.16`，`wMin 0.16–0.18`，`wMax 1.8–2.0` | `bee.js:186, 205, 224` |
| 交叉族 | `spacing ×1.05–1.1`，`thr 0.46–0.5`，`wMax ×0.78` | `bee.js:187, 206, 225` |
| 第三族 | `spacing ×1.25`，`thr 0.74–0.78`，`wMax ×0.6` | `bee.js:188, 207` |
| 毛/点 | `fur w 0.6–0.85, len 6.5–11`；`stipple r 0.45–0.7` | `bee.js:195, 199, 213`；`bee.js:90, 156` |
| 排线间距 / 主体高度 | bee 主体高 ≈600 px（y −242…+290）→ `3.1/600 ≈ 1/190`（STYLE.md:19 说 ~1/180） | `bee.js:105-115` |
| `step`（采样步长） | 轮廓 1–2，排线 2.5（默认），细节圆窗里放大到 3（内容被缩小，所以步长要放大） | `details.js:25, 135` |
| 细节圆窗内容系 | **局部半径 500**，圆心 (0,0)，圆窗 `k = r/500` 缩进去 | `details.js:1`、`film.js:212` |

**局部 → 世界的桥**（每个主体开头都要有，`bee.js:99` / `scallop.js:10`）：
```js
const W = xf(x, y, s), P = p => W(p);          // bee：P([局部点]) → 世界点
const P = ([u, v]) => [x + u * s, y + v * s];  // scallop：等价的显式写法
```
**注意**：`P` 返回**世界坐标**，所以 `focus` 的 x/y 必须过一遍 `P`（`scallop.js:53`：`{ x: P([0,-212])[0], y: P([0,-212])[1], r: 40 * s }`）。

### 1.6 `subjects/details.js` 契约（圆窗里的"画出来的放大图"）

```js
export const DETAILS = { eye: buildEye, hamuli: buildHamuli, corbicula: buildCorbicula };  // details.js:8
export function buildDetail(name, o = {}) { return (DETAILS[name] || buildEye)(o); }        // details.js:9
```

- **只有 `subject === 'bee'` 才会用画出来的放大图**：`film.js:62`
  `d.art = subject === 'bee' && DETAILS[d.focus] ? buildDetail(d.focus) : { magnify: true, regions: {} };`
  → 新主体（非 bee）**自动走"实拍式放大"**：`film.js:213-217` 把**主体自己的 ink + wash** 按 `M = 500/(d.f.r*2.4)` 放大后画进圆窗，并给 ink 传 `wScale: 0.55`。
  若新主体也想有手绘放大图，必须改 `film.js:62` 那个 `subject === 'bee'` 判断（例如改成 `DETAILS[d.focus]`），并在 `DETAILS` 里注册。
- **返回结构**：`{ ink, regions: { <名>: { path, polys } }, specimen: polys, noRule?: bool }`（`details.js:2`）
  - `ink` 的组名：`'ol' 'h1' 'h2' 'h3'` + `'rule'`（ruling machine 的横线底纹，`details.js:13`）。`film.js:71-75` 就按这 5 个名字 schedule。
  - **`regions` 的 key 必须复用主图的上色区名**，否则圆窗里不会上色：`film.js:103` 只在 `rn === name`（当前 content 的颜色区名）时才建 `dWash` 条目，唯一的例外是 `rn === 'hooks' && name === 'legs'`。
    → eye 用 `eyes` / `head`（`details.js:59`）、hamuli 用 `wings` / `hooks`（`details.js:110`）、corbicula 用 `legs` / `pollen`（`details.js:171`）。
  - **`specimen` 与 `noRule` 当前没有任何消费者**（`film.js` 只读 `d.art.ink` 和 `d.art.regions`，见 §1.2 表；grep 全库确认）。`specimen` 只在 detail 自己的 `ruled()` 里当 `excl` 用（`details.js:169`）。→ 保留这两个字段是为了和注释一致，但**新作者不必实现**。
- **尺寸约定**：内容画在**半径 500 的局部系**里；`film.js:212` 用 `k = r/500` 缩放（r 从 `d.f.r` 长到 `RR=120`）。
  - 内容不要超出半径 ~492（`buildEye` 的头部圆 `ellipsePts(0,0,492,492)`：`details.js:23`；`buildHamuli` 用 490：`details.js:108`；ruled 底纹圆 486：`details.js:14`）。
  - 因为最终缩小 0.24 倍，细节里的线宽要**放大**：outline `w 2.2–5.6`、hatch `wMin 0.7–0.8 / wMax 1.6–3.4`、`spacing 5–12`、`stipple r 1.9–2.3`、`step 3`（`details.js:29, 47-49, 136-140, 154`）。
  - 圆窗内容**自己不上色**，`Wash` 由 film 建（`dWash[j]`，`film.js:96, 103, 219`）。
- **`rule` 组**（横线底纹）只在 corbicula 里出现（`details.js:12-16, 169`）；`film.js:75` 对它 schedule `conc: 30`。没有 `rule` 组的 detail（eye / hamuli）不受影响（`schedule` 对空组是 no-op：`burin.js:181-182`）。

---

## 2. film 模块契约

### 2.1 导出与返回

```js
export const W = 1920, H = 1080, BEAT = 0.625;                       // film.js:14
export function makeFilm(C, voiceDur = {}) { … }                     // film.js:21
return { render, DUR, T, EV, subs, dets, cam: camAt };               // film.js:355
```

| 字段 | 类型 | 页面契约 | 消费者 |
|---|---|---|---|
| `render` | `(ctx, t) => void`，t 秒 | `main.js:12` → `window.render` | `core/render/video.mjs:61`、`still.mjs:21`、`readcheck.mjs:21` 逐帧调 |
| `DUR` | number（秒） | `main.js:11` → `window.DUR` | `video.mjs:53`（`window.DUR must be a positive number`） |
| `EV` | `[{t, type, …}]` | `main.js:11` → `window.EV` | `core/render/events.mjs:9`、`tools/events.mjs:7` → `events.json` |
| `T` | 时间表对象 | `main.js:11` → `window.T` | **核心渲染器不读**（只在浏览器里给人看） |
| `subs` | `[{t0,t1,text}]` | 不导出到 window | `film.js:268` 自己画；`tools/subs.py:9` 用 events 重算一份 |
| `dets` | 细节数组（含 slot/focus/art/时序） | 不导出 | `film.js` 内部 |
| `cam` | `(t) => {cx,cy,z,rot}` | 不导出 | `film.js:302` |

**参数 `C`** = `content.json` 解析后的对象（`main.js:6`）；**`voiceDur`** = `voices/dur.json` 的 `{id: 秒}`（`main.js:8`，缺失时用 `Math.max(1.6, text.length/14)` 兜底：`film.js:108`）。

### 2.2 `T`（时间表）：96 BPM 网格

`BEAT = 0.625 s`（96 BPM 的四分音符：60/96 = 0.625，`film.js:2`），`BAR = 2.5 s`（4/4）。

**算 T 的那段逻辑（film.js:27-38，逐行讲清）**：

```js
const T = {};
T.hook = [0, 2.5]; T.lift = 2.0; T.peel = [2.5, 3.2];                       // L28
T.build = { ol: [2.6, 4.6], h1: [3.3, 5.5], h2: [4.4, 6.2], h3: [5.0, 6.9], border: [3.0, 5.6] };  // L29
T.title = 6.25;                                                             // L30
T.d0 = 9.375;                                                               // L31
const dets = []; let s = T.d0;                                              // L32
const roleOf = i => i === 0 ? 'A' : (i === 1 && details.length > 2) ? 'B' : 'C';   // L34
details.forEach((d, i) => { const D = i === 0 ? 9 * BEAT : 7 * BEAT;
  dets.push({ ...d, i, s, D, long: i === 0, role: roleOf(i) }); s += D; });  // L35
T.dEnd = s; T.gather = [s, s + 2 * BEAT]; T.silence = [s + 2 * BEAT, s + 4 * BEAT];      // L36
T.colour = [s + 4 * BEAT, s + 12 * BEAT]; T.landing = [s + 12 * BEAT, s + 19 * BEAT];
T.end = [s + 19 * BEAT, s + 26 * BEAT];                                     // L37
const DUR = T.end[1];                                                       // L38
```

| key | 含义 | 值 |
|---|---|---|
| `hook` | 铜板 ECU + 刻刀钩子 | `[0, 2.5]` = 0–4 拍 |
| `lift` | 刻刀抬起（画面切到撕纸前） | `2.0` = 3.2 拍 |
| `peel` | 试样被揭下（铜板 → 纸） | `[2.5, 3.2]` = 4–5.12 拍 |
| `build` | 三遍排线的绝对开窗（**与细节数量无关**） | `ol 2.6–4.6 / h1 3.3–5.5 / h2 4.4–6.2 / h3 5.0–6.9 / border 3.0–5.6` |
| `title` | 标题开始刻 | `6.25` = 10 拍 |
| `d0` | 第 1 个细节的起点 | `9.375` = 15 拍（**固定**） |
| `dEnd` | 最后一个细节结束 | `9.375 + 5.625 + 4.375×(N−1)` |
| `gather` | 全版收拢 + 天然大小图 | `[dEnd, dEnd+1.25]` = +2 拍 |
| `silence` | 真静音 | `[dEnd+1.25, dEnd+2.5]` = +2 拍 |
| `colour` | 手工上色 | `[dEnd+2.5, dEnd+7.5]` = +8 拍 |
| `landing` | 定版（poster 帧 + 落款） | `[dEnd+7.5, dEnd+11.875]` = +7 拍 |
| `end` | 薄纸护页落下 + 片尾卡 | `[dEnd+11.875, dEnd+16.25]` = +7 拍 |
| `DUR` | = `T.end[1]` | `dEnd + 16.25` |

**细节时长**：第 1 个 `9 * BEAT = 5.625 s`，其余每个 `7 * BEAT = 4.375 s`（`film.js:35`）。DEMO.md:111 说的 "the first 9 beats, others 7 beats each" 就是这句。

**DUR 速查**（`dEnd` 尾部固定 26 拍 = 16.25 s）：

| 细节数 N | `dEnd` | `DUR` |
|---|---|---|
| 1 | 15.000 | 31.250 |
| 2 | 19.375 | 35.625（= DEMO.md:121 的 35.6 s alt） |
| 3 | 23.750 | **40.000**（demo） |
| 4 | 28.125 | 44.375 |
| 0 | 9.375 | 25.625（未测试，`dets[0]` 有 guard：`film.js:148`） |

**role 分配**（`film.js:34`，配乐靠它选段落）：

| N | roles |
|---|---|
| 1 | `A` |
| 2 | `A, C` |
| 3 | `A, B, C` |
| 4 | `A, B, C, C` |

> **新作者最容易踩的一条**：`T.build.*` / `T.title` / `T.d0` 是**绝对秒数**，`T.dEnd` 之后全部是**相对 dEnd 的拍数**。配乐（`score.py`）与混音（`mix.py`）都假设这个形状（见 §3.2）。你可以改 `T.d0`，但**尾部 26 拍的相对结构不能动**，否则 cuecheck 与 score 的 outro 会错位。

### 2.3 `camAt`（镜头）

```js
const camAt = t => { … return { cx, cy, z, rot }; };   // film.js:145-162
```

- **签名**：`camAt(t: number) => { cx: number, cy: number, z: number, rot: number }`
  - `cx, cy` = 世界坐标里的**注视点**；`z` = 倍率（1 = 全版）；`rot` = **弧度**。
  - 合成方式（`film.js:173`）：`translate(W/2,H/2) → rotate(rot) → scale(z,z) → translate(-cx,-cy)`。
- **用到三类镜头**：

| 类型 | 实现 | 行 |
|---|---|---|
| 跟刀（follow） | `followCam(t)`：`{ cx: tip.x+20, cy: tip.y+30, z: HOOKZ*(1-0.03*min(t,3)), rot: -0.05+0.012*min(t,3) }`，`HOOKZ = 4.2` | 122-123 |
| 关键帧插值 | `keys[]` 由 `K(t, cam, ease)` 压入；`camAt` 找相邻两帧，**z 走对数插值**、`cx/cy` 用"逆 z 加权"（`film.js:158-161`）——这样推近/拉远时画面里的点几乎不滑动 | 125-144, 155-161 |
| 圆窗同行（ride） | `d0.a.travel` 窗口内：z 从 4.5 对数降到 `frameFor(d0).z`，同时把注视点从"部位"过渡到"圆窗落点+阅读框" | 148-154 |

- 关键帧序列（`film.js:127-144`）：
  ```
  K(T.peel[1]=3.2, followCam(3.2)) → K(6.2, WIDE) → K(T.d0, WIDE)
  每个细节：frameFor(d)（见下）
  K(T.gather[1]-0.1, WIDE) → K(T.colour[0], WIDE) → K(colour[0]+2.5, {962,546,1.02,-0.0015}) → K(colour[1], WIDE) → K(T.end[1]+1, WIDE)
  ```
  `WIDE = { cx: 960, cy: 540, z: 1, rot: 0 }`（`film.js:124`）；`K` 的第三个参数是缓动，默认 `eio`（`film.js:126`），传 `x => x` 表示线性。
- **阅读框 `frameFor(d)`**（`film.js:130-135`）：
  ```js
  const cx = d.slot[0] < 960 ? 700 : 1258;                        // 往版心方向偏，给圆窗+标签留位
  if (d.i === 0) return { cx, cy: d.slot[1] < 540 ? 440 : 640, z: 1.45, rot: 0 };
  if (d.role === 'B') return { cx, cy: 702, z: 1.45, rot: 0 };
  return { cx, cy: d.slot[1] < 540 ? 378 : 702, z: 1.45, rot: 0 };
  ```
  → z 恒为 **1.45**。DEMO.md:41-43 说的"tilt down"不是一种镜头类型，而是**同一 z 下把关键帧的 cy 从 640/440 移到 702**。
- **每个细节段怎么和 T 挂钩**（`film.js:136-141`）：
  - `i === 0`（role A，签名镜头）：`K(a.push[1], {cx:d.f.x+18, cy:d.f.y+4, z:4.3, rot:0.012})` → `K(a.travel[0], {cx:d.st.x, cy:d.st.y, z:4.5, rot:0.01}, 线性)` → `K(a.travel[1]+0.6, fr)` → `K(d.s+d.D, fr, 线性)`。其中 `d.st = { x: d.f.x+14, y: d.f.y+2 }`（`film.js:138`）。
  - role B：`K(a.push[1], fr)` → `K(d.s+d.D, fr, 线性)`。
  - role C：`K(a.push[1], WIDE)` → `K(d.s+2.9, WIDE, 线性)` → `K(d.s+3.9, fr)` → `K(d.s+d.D, fr, 线性)`（先拉回全版，再推近阅读）。
  - **`a.push[1]` 是"推近结束"的时刻**：role A 是 `push[0]+1.1`，B/C 是 `push[0]+1.0`（`film.js:64-66`）。
- 每个细节的相对时序 `d.a`（`film.js:64-68`，**先写相对值再整体加 `d.s`**）：

| role | push | ring | burn | cont | travel | name | latin | note |
|---|---|---|---|---|---|---|---|---|
| `A`（第 1 个） | `[0, 1.1]` | `[1.05, 1.45]` | `[1.1, 1.4]` | `[1.35, 3.5]` | `[1.9, 3.4]` | 3.3 | 3.6 | 3.9 |
| `B`（第 2 个且 N>2） | `[0, 1.0]` | `[0.5, 0.8]` | `[0.52, 0.75]` | `[0.7, 2.2]` | `[0.8, 1.8]` | 1.9 | 2.15 | 2.4 |
| `C`（其余） | `[0, 1.0]` | `[0.5, 0.8]` | `[0.52, 0.75]` | `[0.7, 2.2]` | `[0.9, 2.1]` | 2.0 | 2.25 | 2.5 |

> **配乐硬约束**：`score.py` 的 sec_A/sec_B/sec_C 把 ring / travel / land 写死在 `push + 1.05 / +1.9 / +3.4`（A）、`+0.5 / +0.8 / +1.8`（B）、`+0.5 / — / +2.1`（C）（`score.py:157-170, 186-197, 213-228`）。**改这些相对值会让 `cuecheck.py` 报 BAD**（见 §3.2）。

### 2.4 `render(ctx, t)` 的合成顺序

```js
function render(ctx, t) {                                   // film.js:300-311
  ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';   // 301
  const cam = camAt(t);                                     // 302
  if (t < T.peel[0])      drawCopperScene(ctx, t, cam);      // 303 铜板段
  else if (t < T.peel[1]) drawPeel(ctx, t, cam);            // 304 撕纸过渡
  else                    drawPaperScene(ctx, t, cam);      // 305 纸面段
  // 306-308 印刷后处理：暖色 vignette（multiply），t ≥ peel[0] 才加
  if (t >= T.peel[1] && !location.search.includes('nosub')) drawSubs(ctx, t);   // 309
  drawEnd(ctx, t);                                          // 310 薄纸护页 + 片尾卡
}
```

**A. `drawCopperScene`（film.js:251-265）——铜板**

| 步 | 调用 | 说明 |
|---|---|---|
| 1 | `applyCam(ctx, cam)` | 应用镜头 |
| 2 | `Cu.drawCopper(ctx, [-300,-300,W+300,H+300])` | 铜底色 + 抛光划痕（`copper.js:23`） |
| 3 | `Cu.copperLight(ctx, W, H, cam)` | **必须在 grooves 之前**（否则反光把刻线洗掉，STYLE.md:90）；工作室窗户反射，屏幕空间（`copper.js:35`） |
| 4 | `applyCam(ctx, cam)` | 重置（copperLight 改了变换） |
| 5 | `guide.draw(ctx, Infinity, {color:'rgba(255,226,196,0.4)', wScale:0.3, dx:-0.25, dy:-0.25})` + 第二遍暗色 | 描好的设计线（`film.js:49` 造的 guide ink） |
| 6 | `Cu.drawGrooves(ctx, ink, min(t, T.lift+0.001), { zoom: cam.z })` | 已刻出的槽（`copper.js:52`） |
| 7 | `Cu.drawSwarf(ctx, sp, dv, cut, { s: 1.25 })` | 铜屑（`copper.js:106`） |
| 8 | `Cu.drawBurin(ctx, sp, dv, { s: 1.1, lift })` | 刻刀（`copper.js:62`）；`sp` 由 `screenOf(cam, tip.x, tip.y)` 把世界刀尖投到屏幕（`film.js:250, 258`） |

**B. `drawPeel`（film.js:315-338）——撕纸**：先 `drawCopperScene` → 用一条 2700 px 的带 `band()` 做 clip，在折线**后**画纸（`noColour: true`）→ 铜上的投影 → 折起的纸背（`pre: M` 镜像矩阵 + `inkOnly: true`）→ 圆柱形卷曲渐变 + 折痕线。

**C. `drawPaperScene(ctx, t, cam, { noColour, pre, inkOnly })`（film.js:187-248）——纸面，这是主体作者最关心的**

| 步 | 调用 | 证据 |
|---|---|---|
| 1 | `applyCam(ctx, cam, pre)` | 188 |
| 2 | `drawSheet(ctx, { W, H, plate: PLATE })`（`inkOnly` 时跳过） | 189 |
| 3 | `wash.draw(ctx, t)`（`noColour` 时跳过）——**上色在墨之下** | 190 |
| 4 | `ink.draw(ctx, t)` —— 主体墨线 | 191 |
| 5 | `frameInk.draw(ctx, t)` —— 版框双线 | 192 |
| 6 | 标题 4 条：`title`(50/600/track .16 @960,132)、`latin`(24 italic @960,170)、`plate_no`(22/600/.12 right @1804,116)、`series`(13/500/.22 left @116,112) | 196-200 |
| 7 | **引线**：对每个已有圆窗 `drawLeader` | 202 |
| 8 | **圆窗**：clip 圆 → 填纸色 → `paperTexture` multiply → `plateTone` 55% → 缩放画内容（magnify 分支 或 `dWash[j]`+`d.art.ink`）→ `roundelFrame(..., {p:r.ring, w:2.0})` | 204-223 |
| 9 | **标签**：`FIG. n · NAME`(17/600/.14)、`latin`(20 italic)、`note`(script 29, wrap 380, lead 1.12) | 224-231 |
| 10 | **天然大小槽位**：`natSlot` 存在且 `t > T.gather[0]` 时，`k = 0.19`、`wScale: 2.1`、`tb = lerp(2.4, 6.9, …)`，再刻 `nat_size_label` | 233-240 |
| 11 | `caption`(22 italic @960,988) | 243 |
| 12 | `signature.left/right`(13 italic @104,1026 / @1816,1026) | 244-247 |

**圆窗里的两条分支**（`film.js:213-221`）：
```js
if (d.art.magnify) {                                  // 实拍式放大（新主体的默认路径）
  const M = 500 / (d.f.r * 2.4);
  const tb = t < d.a.cont[0] ? -99 : lerp(-2.7, 7.0, seg(t, ...d.a.cont));   // 圆窗里"重刻一遍"
  ctx.scale(M, M); ctx.translate(-d.f.x, -d.f.y);
  if (!noColour) wash.draw(ctx, t);
  ink.draw(ctx, tb, { wScale: 0.55 });
} else {                                              // 手绘放大图
  if (!noColour) dWash[j].draw(ctx, t);
  d.art.ink.draw(ctx, t, { wScale: Math.max(1, 0.55 / (k * cam.z)) ** 0.6 });
}
```
> `tb` 从 −2.7 走到 7.0：圆窗内**重播整条雕刻时间线**（此时 `ink` 早已切完，靠时间偏移让线条"再长一遍"）。

**D. `drawSubs`（film.js:267-281）**：见 §2.5。

**E. `drawEnd`（film.js:283-298）**：`p = seg(t, T.end[0], T.end[0]+0.7)`；`y = lerp(-H-40, 0, eo(p))` 把薄纸从上方滑下；纸上刻 `end.film_title`(46)、`end.style_name`(27 italic)、`LEMO-OPUSCAR`(20/.3)、`LemoLab × Claude Opus 5.5`(23 italic)、`end.credits[]`(17/500/.04，行距 30 @720)。

### 2.5 `subs` 的结构与字幕绘制规则

```js
const lines = (C.voice && C.voice.lines) || [];                     // film.js:107
const vd = id => voiceDur[id] || Math.max(1.6, (lines.find(l => l.id === id)?.text.length || 30) / 14);   // 108
const put = (id, t) => { const l = lines.find(x => x.id === id); if (l) vo.push({ id, t0: t, t1: t + vd(id), text: l.text }); };  // 110
put('title', T.title + 0.15);                                       // 111
dets.forEach((d, i) => put('d' + (i + 1), d.s + (d.long ? 0.45 : 0.3)));   // 112
put('close', T.colour[0] + 0.5);                                    // 113
const subs = vo.map((v, i) => ({ t0: v.t0 - 0.1,
  t1: Math.min(v.t1 + 0.6, vo[i + 1] ? vo[i + 1].t0 - 0.2 : 1e9), text: v.text }));   // 114
```

- **结构**：`subs = [{ t0: number, t1: number, text: string }]`，按时间升序（`vo` 的推入顺序 = title → d1…dN → close）。
- **规则**：`t0 = 起说 − 0.1`，`t1 = min(说完 + 0.6, 下一句起说 − 0.2)` —— 永不重叠（DEMO.md:66 "on 0.1 s before the line, off 0.6 s after it"）。
- **绘制**（`drawSubs`，`film.js:267-281`）：找到 `t ∈ [t0, t1)` 的那条；alpha = `min(seg(t,t0,t0+0.25), 1-seg(t,t1-0.2,t1))`；`size 38`、`font FONTS.script`、`wrapLines(..., 860)`；纸签高 `lines*38*1.12 + 24`、宽 `max(行宽) + 70`、底边 `y1 = 1058`、水平居中 960；纸签是**手撕边**（每 14/12 px 抖 2.2 px 的路径）+ 软阴影 `rgba(60,40,20,0.28)`，文字 `#2b1e14`。
- **语音 id 契约**：`title`、`d1`…`dN`（N = 细节数）、`close`。缺哪个就少一条字幕（`put` 里 `if (l)`）。`voiceDur[id]` 来自 `voices/dur.json`（`main.js:8`，`?voices=` 可换）。
- `?nosub` 查询参数可关字幕（`film.js:309`）。
- `tools/subs.py:9` 用**同一条公式**从 `events.json` 的 `vo` 事件重算 `subs.json`（喂给 `core/render/srt.py`）→ 所以 `vo` 事件必须带 `id` 和 `dur`。

### 2.6 `dets` 的结构与"重排"

```js
const details = (C.details || []).slice(0, 4);        // film.js:24 → 超过 4 个被丢弃
dets.push({ ...d, i, s, D, long: i === 0, role: roleOf(i) });   // film.js:35
// 之后逐个补：d.slotName, d.slot, d.f, d.art, d.a, d.lab, d.wp   // film.js:57-90
```

| 字段 | 类型 | 来源 |
|---|---|---|
| `name / latin / note / focus` | 来自 content | `film.js:35` |
| `i` | 0 起序号 | 35 |
| `s` | 该细节段起点（秒） | 35 |
| `D` | 该细节段时长（5.625 / 4.375） | 35 |
| `long` | 是否第 1 个（配音早 0.45 s vs 0.3 s） | 35, 112 |
| `role` | `'A' / 'B' / 'C'` | 34 |
| `slotName / slot` | `'UL'|'LL'|'LR'|'UR'` / `[x,y]` | 57（`SLOT_ORDER[d.i]`） |
| `f` | `{x, y, r}` 世界坐标，**已按槽位左右镜像** | 58-60 |
| `art` | `{magnify:true, regions:{}}` 或 `buildDetail(focus)` 的返回值 | 62 |
| `a` | 相对时序表（已加 `d.s`，见 §2.3） | 64-68 |
| `lab` | `{ name: 'FIG. n · NAME', latin, note }` | 77 |
| `wp` | 引线绕行点 `[x,y]` 或 `null` | 79-90 |
| `st` | 仅 `i===0`：签名镜头的起点 `{x: f.x+14, y: f.y+2}` | 138 |

**槽位分配 = 顺序**（`film.js:16, 53, 57`）：
`SLOT_ORDER = ['UL','LL','LR','UR']`；`SLOTS = { UL:[300,300], LL:[300,700], LR:[1620,700], UR:[1620,300] }`；`natSlot = SLOT_ORDER[details.length] || null`。
→ N=1 用 UL，天然大小在 LL；N=2 用 UL+LL，天然大小在 LR；N=3 用 UL+LL+LR，天然大小在 **UR**；N=4 全占，**没有**天然大小图（`SLOT_ORDER[4] === undefined`）。

**镜像**（`film.js:59-60`）：`left = slot[0] < 960`；`mx = x => left === (x < 960) ? x : 1920 - x`。
→ 槽位在左侧时用 `focus` 点在左半边的那个实例，右侧时把 x 镜像。**所以主体的 focus 点应该两侧都有对应实例**（bee 的 eye/hamuli/corbicula 都在右侧，靠镜像取左侧那个）。

**时间线重排**：见 §2.2。N 变化时 `dEnd` 变、`T.gather/silence/colour/landing/end` 整体平移，但**尾部 26 拍结构不变**；配乐按 `push` 事件里的 `role` 重放段落（`score.py:311-315`）。

---

## 3. `window.EV` 事件词表（决定新片能不能配上音）

`EV` 在 `film.js:341-353` 构造，最后 `EV.sort((a,b)=>a.t-b.t)`（`film.js:353`），经 `main.js:11` → `window.EV` → `core/render/events.mjs:9` / `tools/events.mjs:7` 写成 `events.json`（`{ dur, ev }`）。

### 3.1 全部 type（22 个）

| type | 字段 | 含义（film.js 行） |
|---|---|---|
| `burin` | `t, until` | 刻刀在铜板上走：`t=0`，`until = T.lift`（342） |
| `lift` | `t` | 刻刀抬起（343） |
| `press` | `t` | 压印机（J-cut 提前 0.25 s）：`T.peel[0]-0.25`（344） |
| `peel` | `t` | 试样被揭下：`T.peel[0]`（344） |
| `hatch` | `t, until` | 排线全程：`T.build.ol[0]` → `T.build.h3[1]`（345） |
| `pass` | `t, g` | 每一遍的起点，`g ∈ {'ol','h1','h2','h3'}`（346） |
| `title` | `t, n, dur` | 标题刻字：`n = 标题字符数+1`（含句点），`dur 0.9`（347） |
| `push` | `t, i, role, dur` | 细节段开始推近；`dur = d.D`（348） |
| `ring` | `t, i` | 圆窗被划出（348） |
| `burnish` | `t, i` | 圆窗内擦亮（348） |
| `cut` | `t, until, i` | 圆窗内重刻（`d.a.cont`）（348） |
| `travel` | `t, until, i` | 圆窗飞向槽位（348） |
| `land` | `t, i` | 圆窗落地（348） |
| `letters` | `t, dur` | 刻字（圆窗标签 0.6 / 定版 0.75）（348, 351） |
| `quill` | `t, dur, i` | 手写体注记（`dur 1.1`）（348） |
| `natsize` | `t` | 天然大小图开始：`T.gather[0]`（349） |
| `silence` | `t, until` | 真静音（349） |
| `drop` | `t, region` | 上色落笔，每个颜色区一条（350） |
| `landing` | `t` | 定版/终止（351） |
| `dot` | `t` | 落款的两点（351） |
| `tissue` | `t` | 薄纸护页落下：`T.end[0]-0.2`（351） |
| `vo` | `t, id, dur` | 旁白窗口（352） |

`i` 一律 ∈ `0..3`（`mix.py` 用 4 元素表索引，见 §3.2）。

### 3.2 逐个消费者的依赖

#### (a) `music/score.py` —— 配乐

| 读什么 | 行 | 怎么用 |
|---|---|---|
| `EVJ['dur']` | 24 | `DUR`，决定 `N = DUR*SR` |
| `type=='push'` 列表 → `DETS` | 25 | 遍历，取 `e['t']` 与 `e.get('role', 'A' if i==0 else 'C')` |
| `type=='natsize'` → `OUTRO` | 26 | `OUTRO = e['t']`；`O2 = OUTRO - 23.75` |
| `push[].role` | 312-315 | `OFF = e['t'] - TEMPLATE[role]`，再调 `{'A':sec_A,'B':sec_B,'C':sec_C}[role]()` |

- `TEMPLATE = { A: 9.375, B: 15.0, C: 19.375 }`（`score.py:311`）——**demo 自己的**细节起点。
- **段落内容是写死的**（相对 demo 网格）：sec_A 里 ring 在 `push+1.05`、travel 在 `push+1.9`、land 在 `push+3.4`（`score.py:157,164,167`）；sec_B ring `+0.5`、travel `+0.8`、land `+1.8`（`score.py:186,192,195`）；sec_C ring `+0.5`、land `+2.1`（`score.py:213,226`）。
  → **新片必须保持 §2.3 表格里那三行的相对时序**，否则配乐重音与画面错位、`cuecheck.py` 报 BAD。
- **按细节数量重排**：sec_A/B/C 的长度分别是 5.625 / 4.375 / 4.375 s（`score.py:148-243`），正好等于 `9*BEAT / 7*BEAT / 7*BEAT`；尾部 `sec_outro()` 用 `O2` 整体平移（`score.py:316-317`）。
  → 只要 `T` 的形状对（§2.2），1–4 个细节都能得到对齐的配乐。
- **outro 内部也是写死的**（相对 `OUTRO`）：静音门 `24.985+O2 … 26.25+O2`（`score.py:330`）、首次拉弓 `26.25+O2`（`score.py:260, 286`）、终止 `31.25+O2`（`score.py:299-302`）、片尾 `35.625+O2`（`score.py:306`）、`36.6+O2` 起淡出（`score.py:332`）。
  对照 `film.js:36-37`：`silence[0]=dEnd+1.25`、`colour[0]=dEnd+2.5`、`landing[0]=dEnd+7.5`、`end[0]=dEnd+11.875` → 与 `OUTRO=dEnd` 时**完全一致**（O2=0）。
  → **`natsize` 事件必须等于 `T.gather[0]`，且尾部 26 拍结构不能改。**
- `role` 只能是 `A/B/C`：`{'A':sec_A,'B':sec_B,'C':sec_C}[role]` 会 KeyError（`score.py:315`）。

#### (b) `mix.py` —— 拟音 + 混音

`E = json.load(...events.json)`；`DUR = E['dur']`；`EV = E['ev']`（`mix.py:11`）。
`first = lambda typ: next(e for e in EV if e['type'] == typ)`（`mix.py:15`）—— **`first()` 找不到就抛 `StopIteration`，脚本直接崩**。

| 事件 | 字段 | mix.py 行 | 用途 |
|---|---|---|---|
| `peel` | `t` | 22, 58, 64-67 | 纸张撕开 + 压印 thump + 刻刀嘶声尾巴 |
| `silence` | `t, until` | 22, 24-26 | 房间底噪在静音段降到 0.25 |
| `burin` | `t, until` | 33-47 | 金属嘶声（2.6–9 kHz）+ chatter + 铜板共振 + 铜屑 ping |
| `lift` | `t` | 49-51 | 金属小 tick |
| `press` | `t` | 54-56 | 滚筒低鸣（J-cut 提前 0.35 s） |
| `hatch` | `t, until` | 78, 83 | 第 4 遍 micro-scratch 的结束 |
| `pass` | `t, g` | 79-85 | `passes = {e['g']: e['t']}`；**必须同时有 `ol/h1/h2/h3` 四个 `g`**，否则 `passes['ol']` KeyError |
| `title` | `t, n, dur` | 92 | `ticks(t, n, dur, 0.07)` 刻字点 |
| `push` | `t` | 97 | 纸页 whoosh |
| `ring` | `t` | 98-99 | 划圆圈的嘶声 |
| `burnish` | `t` | 100 | 软擦 |
| `cut` | `t, until, i` | 101 | `scratches(..., seed: 10+e['i'])` + 声像 `[-.4,-.4,.4,.4][e['i']]` |
| `travel` | `t, until` | 102 | 圆窗飞行的 whoosh |
| `land` | `t, i` | 103-104 | 纸页轻拍 + 声像表 |
| `letters` | `t, dur` | 105 | 12 个点 |
| `quill` | `t, dur, i` | 106-108 | 笔尖沙沙 + 声像表 |
| `natsize` | `t` | 109 | 天然大小图的细划痕 |
| `drop` | `t, region` | 113-118 | 水滴 plip + 湿刷；声像查 `pans` 表（`mix.py:112`，未知 region 落 0） |
| `landing` | `t` | 119 | （只取时间，本身不发声） |
| `dot` | `t` | 120 | 两个轻点 |
| `tissue` | `t` | 121-128 | 薄纸沙沙 + whoosh |
| `vo` | `id, t, dur` | 131-137 | 读 `voices/<id>.wav`；**文件不存在会抛** |

→ **`i` 必须 ∈ {0,1,2,3}**（`mix.py:101,104,108` 直接下标 4 元素列表）。

#### (c) `tools/cuecheck.py` —— 配乐重音 vs 画面事件

`f(typ, i=None, key='t')`（`cuecheck.py:6-8`）在 `ev` 里找第一个匹配，找不到返回 `None`；随后 `min(M, key=lambda c: abs(c['t'] - p))` 会因 `None` 抛 TypeError。

核对的对（`cuecheck.py:10-17`）：
```
(peel, peel)  (title, title)
每个 push： (push.t, 'detail i+1 (role) starts')  (ring.i, 'ring i+1')
           role ∈ 'AB' 时还有 (travel.i, 'roundel i+1 lifts')
           (land.i, 'roundel i+1 lands')
(natsize)  (silence)  (silence.until)  (landing)
```
- **role 从 `push` 事件读**（`cuecheck.py:12`，缺省 `'A' if i==0 else 'C'`）。
- 需要 `music/cues.json` 存在（`score.py:364` 生成）。
- 容差 `1/24 s`（一帧 @24fps，`cuecheck.py:22`）；最后检查 `mix.wav` 在静音段的峰值（`cuecheck.py:26-29`）。
- → **必读事件**：`peel, title, push(+i,+role), ring, land, natsize, silence(+until), landing`；role 为 A/B 时还要 `travel`。

#### (d) `tools/subs.py` —— 字幕

读 `events.json` 的 `vo` 事件（`subs.py:8-9`）与 `content.json` 的 `voice.lines[].id/text`（`subs.py:7`）→ 输出 `subs.json`。**`vo` 必须有 `id`（能在 lines 里找到）与 `dur`。**

#### (e) `film.js` 的 `render`

**完全不读 `EV`**。画面由 `T` 与 `d.a` 驱动。EV 只服务声音 + 外部工具。

### 3.3 结论：一部新片最少必须发出哪些事件

**逐条照抄 `film.js:342-352` 的 22 类即可**。若做不到全量，下面是最小可用集（缺任一条，现有管线会崩）：

```
必发（否则 mix.py 抛 StopIteration / KeyError）：
  burin{t,until}  lift{t}  press{t}  peel{t}
  hatch{t,until}  pass{t,g}×4（g = ol,h1,h2,h3 各一条）
  title{t,n,dur}  natsize{t}  landing{t}  tissue{t}  silence{t,until}
  vo{t,id,dur}（每个配音行一条，id 必须对应 voices/<id>.wav）
必发（否则 cuecheck.py 抛 TypeError）：
  push{t,i,role,dur}（每个细节一条，role ∈ A/B/C）
  ring{t,i}  land{t,i}  （role 为 A/B 时还要 travel{t,until,i}）
按内容量发（缺了只是没声音，不崩）：
  burnish{t,i}  cut{t,until,i}  letters{t,dur}  quill{t,dur,i}
  drop{t,region}（每个上色区一条）  dot{t}
硬约束字段：
  i ∈ {0,1,2,3}；role ∈ {A,B,C}；g ∈ {ol,h1,h2,h3}
  t 单调递增（film.js:353 会 sort，但工具按顺序 first() 取）
  title.n = 标题字符数 + 1（含句点，film.js:347）
```

**字段填法**（= film.js 的原式）：
```js
EV.push({ t: 0, type: 'burin', until: T.lift });
EV.push({ t: T.lift, type: 'lift' });
EV.push({ t: T.peel[0] - 0.25, type: 'press' }, { t: T.peel[0], type: 'peel' });
EV.push({ t: T.build.ol[0], type: 'hatch', until: T.build.h3[1] });
for (const g of ['ol','h1','h2','h3']) EV.push({ t: T.build[g][0], type: 'pass', g });
EV.push({ t: T.title, type: 'title', n: [...String(C.title||'')].length + 1, dur: 0.9 });
for (const d of dets) EV.push(
  { t: d.a.push[0], type: 'push', i: d.i, role: d.role, dur: d.D },
  { t: d.a.ring[0], type: 'ring', i: d.i },
  { t: d.a.burn[0], type: 'burnish', i: d.i },
  { t: d.a.cont[0], type: 'cut', until: d.a.cont[1], i: d.i },
  { t: d.a.travel[0], type: 'travel', until: d.a.travel[1], i: d.i },
  { t: d.a.travel[1], type: 'land', i: d.i },
  { t: d.a.name, type: 'letters', dur: 0.6 },
  { t: d.a.note, type: 'quill', dur: 1.1, i: d.i });
EV.push({ t: T.gather[0], type: 'natsize' }, { t: T.silence[0], type: 'silence', until: T.silence[1] });
cOrder.forEach((name, k) => EV.push({ t: c0 + k * 0.42, type: 'drop', region: name }));
EV.push({ t: T.landing[0], type: 'landing' }, { t: T.landing[0]+0.05, type: 'letters', dur: 0.75 },
        { t: T.landing[0]+1.0, type: 'dot' }, { t: T.landing[0]+1.2, type: 'dot' },
        { t: T.end[0]-0.2, type: 'tissue' });
vo.forEach(v => EV.push({ t: v.t0, type: 'vo', id: v.id, dur: v.t1 - v.t0 }));
EV.sort((a, b) => a.t - b.t);
```

---

## 4. 硬约束与安全区

### 4.1 版面（世界单位）

| 项 | 值 | 证据 |
|---|---|---|
| 画面 | `1920 × 1080` | `film.js:14` |
| 版框（plate mark） | `PLATE = [70, 44, 1850, 1036]` | `film.js:15` |
| 双线边框 | `BORDER = [100, 72, 1820, 1008]`；`borderInk(ink, [x0,y0,x1,y1], { gap = 9 })` → 外线 `w 2.4`、内线 `w 0.8` 且内缩 9 px（即内线在 `[109,81,1811,999]`） | `film.js:15,50`；`plate.js:56-59` |
| 版框斜面 | `b = 5`，上/左墙暗、下/右墙亮（光来自左上） | `plate.js:46-51` |
| 纸 | `PAL.paper = '#f1e8d2'`，版内 tone `#e8ddc2` @55% | `plate.js:8,43` |
| 墨 | `INK = '#1c1510'` | `burin.js:15` |
| 引线 waypoint 搜索域 | `gx ∈ [140,1780] step 20`，`gy ∈ [90,990] step 20` | `film.js:85` |
| 版面中心 | `(960, 540)`；主体落点 `(960, 606)` | `film.js:124, 23` |
| vignette | `t ≥ T.peel[0]` 后 multiply 的暖色径向渐变 | `film.js:308` |

### 4.2 圆窗（roundel）

| 项 | 值 | 证据 |
|---|---|---|
| 半径 | `RR = 120` | `film.js:16` |
| 双规线 | `roundelFrame(ctx, r.x, r.y, r.r, { p: r.ring, w: 2.0 })`：外线 `w=2.0` 从 `−π/2−0.4` 起画 `2π·p`；内线 `w = 0.76`、半径 `r − max(3.5, r·0.035) = r − 4.2`，从同一角起画 `2π·(1.1p−0.1)` | `film.js:223`；`plate.js:114-121` |
| 四个槽位 | `UL [300,300]` → `LL [300,700]` → `LR [1620,700]` → `UR [1620,300]`（按 `SLOT_ORDER` 顺序分配） | `film.js:16,57` |
| 空槽位 | `natSlot = SLOT_ORDER[details.length] || null`；N=4 时无天然大小图；N=0 时天然大小图在 UL | `film.js:53` |
| 天然大小图 | `t > T.gather[0]` 才出现；`k = 0.19`（"版宽 ≈20 cm，蜜蜂 ≈13 mm"）；`wScale: 2.1`；`tb = lerp(2.4, 6.9, seg(t, gather[0], gather[1]−0.1))`；标签 `nat_size_label` 在 `slot.y + 110` | `film.js:233-240` |
| 圆窗起飞 | `roundelAt(d,t)`：`t < a.ring[0]` 返回 `null`；`u = eio(seg(t, ...a.travel))`；`x = lerp(f.x, slot.x, u)`、`y = lerp(f.y, slot.y, u) − sin(uπ)·30`（**中途抬 30 px**）；`r = exp(lerp(log(f.r), log(RR), u))`（**对数增长**） | `film.js:165-170` |
| 圆窗内底 | 填 `PAL.paper` → `paperTexture` multiply → `PAL.plateTone` @`0.55·ss(r.burn)` → 再画内容；alpha 由 `ss(r.burn)` 控制 | `film.js:206-211` |
| 放大倍率 | 实拍式：显示世界半径 `2.4 × f.r`；手绘式：内容按 `k = r/500` 缩入 | `film.js:212-215` |
| 引线 | 从 `d.f` 到圆窗**边缘**（`rim()`：`slot + 单位向量·RR`），`lineWidth 0.95`，`lineCap/lineJoin round`，根点画 `r=1.7` 实心点；若 `L < r.r + 6` 直接不画 | `film.js:80,175-182` |
| 引线绕行 | 直连先试；不行则网格搜 waypoint，要求：离槽心 ≥ `RR + 20 = 140`、两段都"clear" | `film.js:83-89` |
| 最小间隙 | `clear()` 从 `q=14` 起每 4 px 采样，每点查 9 个偏移（`k=0` 半径 0，`k=1..8` 半径 34、每 45°）→ **等效 ≥34 px 净空** | `film.js:81` |
| 障碍物 | `OBST = bee 时 ['wings','thorax','abdomen','head']`，否则 `Object.keys(bee.regions)`；排除 focus 点自身所在的多边形 | `film.js:54-55, 79` |
| 图号 | 在引线根部沿方向偏 26 px、垂直偏 11 px 处刻 `size 15 italic` 的 `i+1` | `film.js:183-184` |

> **新主体最容易踩的**：`regions` 的键决定了引线要绕开谁。若新主体的 `regions` 只有 2–3 个键，引线会很"自由"；但若某个 region 的 `polys` 覆盖了整张图，`clear()` 永远失败 → `d.wp = null` → 引线直穿画面（DEMO.md:98 "Leaders hugging a wing read as crossing it"）。

### 4.3 字号与文本

**字体**：`FONTS = { roman: 'Bodoni Moda', script: 'Pinyon Script' }`（`plate.js:11`）。
`main.js:9` **只预载**这三条：`'600 40px "Bodoni Moda"'`、`'italic 400 40px "Bodoni Moda"'`、`'400 40px "Pinyon Script"'`。
→ 用到别的 weight/size 组合（尤其斜体 script）时**必须加进 `document.fonts.load` 列表**，否则首帧可能用系统兜底字体。字体文件在 `demo/fonts/`（`BodoniModa-VF.ttf`、`BodoniModa-Italic-VF.ttf`、`PinyonScript-Regular.ttf`、`fonts.css`）。

| 用途 | 字号 / 字重 / 字距 | 位置 | 证据 |
|---|---|---|---|
| 标题（罗马大写 + '.'） | `50 / 600 / track .16` | `(960, 132)` 居中 | `film.js:196` |
| 拉丁学名 | `24 / 400 italic` | `(960, 170)` | `film.js:197` |
| 版号 `plate_no` | `22 / 600 / .12` | `(1804, 116)` 右对齐 | `film.js:199` |
| 系列名 `series` | `13 / 500 / .22` | `(116, 112)` 左对齐 | `film.js:200` |
| 细节标签 `FIG. n · NAME` | `17 / 600 / .14` | `(slot.x, slot.y+156)` | `film.js:226` |
| 细节拉丁名 | `20 / 400 italic` | `(slot.x, slot.y+184)` | `film.js:227` |
| 细节手写注记 | `script 29`（**固定字号，不缩**），`lead 1.12`，宽度上限 `NOTE.width = 380` | 第 q 行 `(slot.x, slot.y+220+q·32.48)` | `film.js:17, 228-230` |
| 天然大小标签 | `15 / 600 / .2` | `(slot.x, slot.y+110)` | `film.js:239` |
| 图号（引线根） | `15 italic` | 见 §4.2 | `film.js:184` |
| 题词 `caption` | `22 / 500 italic` | `(960, 988)` | `film.js:243` |
| 落款 | `13 italic` | `(104, 1026)` 左 / `(1816, 1026)` 右 | `film.js:245-246` |
| 字幕 | `script 38`，宽度上限 860，`#2b1e14`，纸签 `#f4eddb` | 底边 `y = 1058`，居中 | `film.js:271-279` |
| 片尾卡 | `46 / 27 italic / 20 / 23 italic / 17` | `(960, 420/478/580/622/720+i·30)` | `film.js:292-296` |

**换行规则**：
- 细节注记用 `wrapLines(ctx, note, 380, { size: 29, font: FONTS.script })`（`film.js:228`）——**字号恒定，长文本只增加行数**（`plate.js:136-144`）；两行时会再平衡，避免第二行只剩一个词（`plate.js:142`）。
- 字幕用 `wrapLines(..., 860, { size: 38, font: FONTS.script })`（`film.js:271`）。
- 刻字用 `engraveText`：逐字从左往右"擦"出来（`plate.js:76-81`），`p` 是进度（`p ≤ 0` 不画；`p = 1` 全显）。
- 手写用 `writeScript`：一笔从左到右写，`p < 1` 时笔尖带湿边渐变（`plate.js:93-99`）。

**两条安全区规则（数字级）**：
1. **细节注记最多 2 行**：UL 槽位（y=300）的第 3 行基线在 `420+100+2×32.48 = 585`，而下方 LL 圆窗（y=700）的**顶边 = 700−120 = 580** → 相撞。第 2 行基线 552（字身高约 532–557）仍留 ~23 px。→ `content.json` 的 `note` ≤ 60 字符（DEMO.md:113）。
2. **注记水平居中于槽位 x**（`writeScript` 默认 `align: 'center'`），宽 380 → 右列槽位 x=1620 时右边缘 `1620+190 = 1810`，内框线在 **1811** → 只剩 1 px。所以 **380 就是上限，不要加宽**（`film.js:17`）。
3. 字幕纸签顶边 = `1058 − (行数×42.56 + 24)`；两行时 ≈ `949`，与下排圆窗的注记（到 ~952）几乎相接 → **字幕与下排注记不会重叠的前提就是注记 ≤2 行**。

### 4.4 已知坑（逐条摘出 + 标注）

**DEMO.md:92-99「Pitfalls tied to this demo's props」**

| # | 坑 | 是否新作者必踩 |
|---|---|---|
| 1 | **翅脉必须闭合成翅室**：长脉用曲线定义，横脉吸附到长脉上（`bee.js` 的 `FX`）。随机画脉一眼假。 | 只在画膜翅时 |
| 2 | **腿关节画成整段胶囊会像串珠**：把上一段作为 `excl` 传进去，只露远端端帽。 | **必踩**（`excl` 遮挡是唯一手段） |
| 3 | **同一 demo 目录的两次渲染会互撞**：`video.mjs` 把分段写进 `<demo>/out/`，主片与 alt 要**先后**渲。 | **必踩**（并行渲会报错，`video.mjs:15-23` 有 lock） |
| 4 | **刻刀 skew**：30° 看着像在旁边戳，`0.22 rad` 才对（`copper.js:62` 的 `skew = 0.22`）。 | 只在改铜板段时 |
| 5 | **引线贴着翅膀会被读成穿过翅膀**：要 ≥34 px 净空（`film.js:81`）。 | **必踩** |
| 6 | "Apis mellifera"：Kokoro 念得还行但 whisper 转不出来 → 该行用 `asr` 字段。 | 用学名念白时 |

**STYLE.md:84-93「Pitfalls of the medium」**

| # | 坑 | 是否新作者必踩 |
|---|---|---|
| 1 | 统一线宽读成钢笔 → `hatch({swell})`、`outline({run, pinch})`，`wMin` 保持发丝级。 | **必踩**（这是本风格第 1 号特征） |
| 2 | 重叠没有遮挡 → 把遮挡者作为 `excl`（逐环相减；even-odd 会抵消重叠）。 | **必踩** |
| 3 | 只剩轮廓的部件挨着有排线的身体 → 每个部件沿自身轴向排线，每个关节加一层暗。 | **必踩** |
| 4 | 刻刀沿着刻痕 → 看不见槽；skew 太大会像在戳 → ≤15°。规则螺旋的铜屑像弹簧 → 变绕距、加扭转、亮一侧边。 | 只在改铜板段时 |
| 5 | 反光盖过刻痕 → 先画铜面光。圆窗内容画得太小会冻在亚像素上 → **画大再缩**。引线贴着主体读成穿过 → 留净空。 | **必踩**（"画大再缩"就是 §1.6 的半径 500 约定） |
| 6 | **一条很长的早段描边永远画不出来** → ink 的提前退出必须"向前看"最长的一条（`Ink.draw` 的 `if (s.s1 > t + this.maxDur + 1e-3) break;`，`burin.js:230`）。 | **必踩**（改 `schedule` 窗口/`conc` 时） |
| 7 | 推近时裁掉刚出现的注记 → 相邻细节放同一侧（`frameFor` 的 `cx` 只取 700/1258 两个值）。 | **必踩** |
| 8 | 学名 TTS 可能念得出、ASR 转不出 → 给检查器一个朴素拼写（`asr`）。 | 用学名念白时 |

**额外（源码里存在但两份文档都没写）**：
- `ol0` 必须**恰好一条**长描边，否则 `film.js:117` 的 `find` 只取第一条，跟刀镜头只跟一小段（§1.3）。
- `focus.eye` 是 `film.js:58` 的兜底键：**任何主体都必须定义**，否则 focus 名写错直接 TypeError（§1.2）。
- `d.art.regions` 的键**必须复用主图上色区名**（唯一例外 `hooks↔legs`），否则圆窗里不上色（`film.js:103`）。
- `specimen` / `noRule` 被 `details.js` 返回但**无人消费**（§1.6）。
- `bee.js:9` import 了 `engraveTone` 但**从未调用**（示例代码里的死引用）。
- `film.js:23` 传的是 `y: 606`，而 `buildBee` 的默认是 `y: 560` —— **默认值永远不会生效**，主体按 `y = 606` 设计。
- `T.build` / `T.title` / `T.d0` 是绝对秒数，而 `T.gather` 之后全部相对 `dEnd`：**混用两种参考系是时间线错乱的头号原因**。

---

## 5. `content.json` 字段表（精确版）

来源：`DEMO.md:101-121` 的表 + 逐字段核到 `film.js` 的读取行。路径 = `styles/engraving/demo/content.json`（`?content=` 可换，`main.js:6`）。

| 字段 | 类型 | 读取处 | 越界后的**具体**表现 |
|---|---|---|---|
| `title` | string | `film.js:196`（`toUpperCase() + '.'`）、`347`（`n = 字符数+1`） | 宽了会压到 `latin` 行（`engraveText` 不缩、不换行，`plate.js:69-85` 只会按字符顺序擦出，超宽就往两侧溢出）；要缩短或把 `size: 50` 改小 |
| `latin` | string | `film.js:197` | 太长则 `title` 6.4 s 起的念白时长（`voices/dur.json`）超过第一次推近（`T.d0 = 9.375`）→ 字幕被 `subs` 的 `min(...)` 截断（`film.js:114`），画面也已在推近 |
| `plate_no` | string | `film.js:199`（右对齐 @1804,116） | 超过 ~10 字符会向左侵占标题区 |
| `series` | string | `film.js:200`（左对齐 @116,112） | 超过 ~48 字符会与标题碰撞（DEMO.md:109） |
| `subject` | `"bee"`\|`"scallop"`\|自定义 | `film.js:22`（未知 → `'bee'`）、`11`（注册表） | 拼错会静默画成蜜蜂；新名字必须注册进 `SUBJECTS`（`film.js:11`） |
| `details[]` | array of `{name, latin, note, focus}` | `film.js:24`（`slice(0,4)`） | **>4 个被丢弃**；1–4 个时 `T` 重排（§2.2）；0 个时没有细节段（`dets[0]` 有 guard，`film.js:148`） |
| `details[].name` | string | `film.js:77`（`FIG. n · NAME`） | 长名字（17 px 居中于槽位 x）向两侧溢出，左列会越过内框线 |
| `details[].latin` | string | `film.js:77` | 同上（20 px italic） |
| `details[].note` | string | `film.js:77, 228-230` | **>60 字符 → 第 3 行会撞下方圆窗**（§4.3 规则 1）；且写满时间 `1.1 s` 与 `wrapLines` 行数绑定（`film.js:229-230`） |
| `details[].focus` | string | `film.js:58`（`bee.focus[d.focus] \|\| bee.focus.eye`）、`62`（`DETAILS[d.focus]`） | 未知键 → 落 `focus.eye`（**若主体没有 `eye` 键则 TypeError**）；bee 的已知键：`eye`/`hamuli`/`corbicula`（`bee.js:264-268`），scallop：`umbo`/`growth`/`ribs`/`ear`（`scallop.js:53`）；无手绘图的键自动走"实拍放大" |
| `colors[]` | `{region, color}` | `film.js:95`（映射）、`97`（顺序）、`100`（查 `bee.regions[name]`）、`350`（`drop` 事件） | 未知 region 被 `if (!r) return` 跳过（`film.js:100`），**不报错但也不上色、不发 drop 事件**；顺序 = 上色顺序，每条间隔 `0.42 s`（`film.js:99, 350`）。上色窗 `T.colour` 只有 8 拍 = 5 s，且每区 `wash.dur = 1.6`（wings）/ `1.25`（其余）（`film.js:102`）→ 第 k 条必须在 `c0+0.42k+1.6 ≤ T.colour[1]` 内落笔，即 **≤ 8 个区**（全按 1.6 s 计；若都不含 wings 可到 9 个）。7 个时最后一条在 `c0+2.52 = T.colour[0]+2.62`，余量充足 |
| `caption` | string | `film.js:243`（22 italic @960,988） | 太长会溢出内框；DEMO.md:115 要求"可读时间 ≥ 字符数/12 + 1 s 塞进 4.4 s 定版" |
| `signature.left/right` | string | `film.js:245-246` | 无 `signature` 则整块不画（`if (C.signature)`） |
| `nat_size_label` | string | `film.js:239`（`|| 'Natural size'`） | 超过 ~16 字符（15 px，居中于槽位 x）溢出 |
| `voice.voice` / `voice.speed` | string / 0.8–1.0 | **film.js 不读**；只被 `build.sh:8` 与 `build_alt.sh` 读去做 TTS | 只影响 `voices/*.wav` 的音色与时长 |
| `voice.lines[]` | `{id, text, asr?}` | `film.js:107-113`（按 `id` 查 `title` / `d1..dN` / `close`） | 缺 `title` → 无标题字幕；缺 `d3` 而 `details` 有 3 个 → 该细节无声；`id` 不在 `voices/*.wav` 里 → `mix.py:133` 读文件抛错 |
| `voice.lines[].asr` | string | 不参与画面；`build.sh:8` 传给 ASR 检查 | 不给则 whisper 可能转不出学名（DEMO.md:99） |
| `end.film_title` / `end.style_name` / `end.credits[]` | string / string / string[] | `film.js:291-296` | 缺 `end` → `C.end \|\| {}`（`film.js:291`），全部回落到 `C.title` / `'Copperplate Engraving'` / 无 credits；credits 每行 `17 px` @ `720+i·30`，>3 行会压到画面下缘 |

**"最小可跑" content（照抄 `DEMO.md:125-134` 的 scallop 例子即可）**：至少要 `title / subject / details[] / colors[] / caption / voice.lines[]`；`end`、`signature`、`nat_size_label`、`plate_no`、`series`、`latin` 缺失都不会崩（各自有回落或 `if` 保护）。

---

## 6. 附录：导出但当前无消费者的 API（新作者慎用）

| API | 状态 |
|---|---|
| `B.offsetRing(P, d)` (`burin.js:140`) | 导出；`subjects/*` 与 `engine/*` 都没调用 |
| `B.along(P, u)` (`145`) | 同上 |
| `B.compose(outer, inner)` (`39`) | 同上（bee.js:273 自己写了个等价的 `compose2`，也没用） |
| `B.linTone` (`398`) / `B.blobTone` (`402`) / `B.maxT` (`400`) / `B.mulT` (`401`) | 同上 |
| `B.hatchAlong(ink, polys, guide, o)` (`319`) | 同上（STYLE.md:97 提到但无示例） |
| `B.engraveTone(ink, polys, o)` (`307`) | 同上（bee.js:9 import 了但没调用；`engraveShape` 自己拼 `hatch` 而非用它） |
| `Ink.instant` / `Ink.span` / `Ink.count` / `Ink.groups` / `Ink.dot`（直接） | 导出；film.js 不用（`dot` 被 `stipple` 内部用，`burin.js:362`） |
| `plate.js` 的 `leader(ctx, from, to, o)` (`123`) | **film.js 不用它**，自己实现了 `drawLeader`（`film.js:175-185`） |
| `plate.js` 的 `fitLines(ctx, str, maxW, o)` (`103`) | 导出但无消费者（换行走 `wrapLines`） |
| `details.js` 的 `specimen` / `noRule` | 返回但无消费者（§1.6） |
| 主体返回值里的 `center` / `s` | 返回但无消费者（§1.2） |
| `window.T` | `main.js:11` 导出，`core/*` 不读（仅供浏览器里人工检查） |

**未验证**：`burin.js:300` 的 `flipDir !== (li % 2 === 1 && o.boustro)` 依赖一个未在任何地方设置的 `o.boustro` 选项 —— 即 `hatch` 的"隔行反向"分支实际不会触发；本文不推断其原意。
