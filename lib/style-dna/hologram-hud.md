# 科幻全息界面（hologram-hud）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**，不收录示例《Volt · Spec Scan》的具体内容（那辆电助力车、那三个参数都不是风格）。
> 证据见文末。

---

## 0. 一句话

一个物体被「扫描」成悬在圆形投影台上的发光线框，目标框依次锁定它的部件，每锁一个就在局部炸开、拉出引线、把一个数字从乱码滚成真值。

**它不是**：渲染出的实物（`glass-product`）、打字机式 keynote（`dark-keynote`）、工程制图（`blueprint`）。
**主体永远是线框**；最多一次性获得半透明面，且线仍在最上。（`STYLE.md:14`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值 |
|---|---|
| **舞台** | 被色相染过的近黑 `hsl(hue+12,70%,2.4%)`；主体后方径向提亮 `hsl(hue+6,65%,7%)`；48px 点阵网格（视差 0.2）；暗角 0.5。 |
| **投影台** | 真透视同心环 r = 0.7 / 1.05（亮）/ 1.12（虚线）/ 1.45 / 2.1；120 刻度（每 10 加长）；24 放射线；0.12 rad/s 自转。 |
| **线框** | `lighter` 叠加 ~1.3px 描边，**7 个 alpha 层级由深度雾决定**（近亮、远 ~25%）；两趟辉光（¼ 分辨率模糊 3px ×0.85、⅛ 分辨率模糊 4px ×0.7）。 |
| **热边** | 色相近白 `hsla(hue,70%,92%)`，只给扫描前沿 / `hot` 内部件 / 光波 / 被 ping 的零件。 |
| **CAD 拓扑** | 管件 = 环 + 纵向线；**每个零件必须物理相连**（漂浮碎片会立刻被发现）。 |
| **实体全息** | 面 = 屏幕空间 Fresnel `0.3 + 0.7·(1−facing)^1.6` × 滚动 interlace（2px 满 + 2px 38%，每帧滚 1px）；点亮时线宽 ×1.5 缓落到 ×1.12；一道光波 ±7cm。 |
| **光柱** | **一条 path、非零环绕**（分开画会出现暗楔或双亮缝）；26 射线、70 尘点。 |
| **HUD 家具** | 四角括号 46px（距边 44px）；视差标尺每 24px 一刻（每 5 个加长）；左上「产品 // SPEC SCAN」；右上状态行；底部遥测。 |
| **文字底板** | 每块文字都有深色底板 `rgba(1,8,12,.72)`、1px 边、10px 角标；**文字从不压在网格线上**。 |
| **模型** | 米为单位、**y 向上**，x = 产品前方、z = 朝观察者；载入归一化（包围盒对角线，默认 2.3117）→ 相机对任何物体都成立。规模 ~5k 顶点 / 6k 边。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：冷静自信的产品讲解员（不是推销员）。第三人称、现在时、陈述句，会对听众说「你」。

**长度（实测）**：单句 **47–72 字符**（8–13 英文词）。硬约束：intro ≤5s 口播、第一条 callout ≤4.8s、其余 ≤3.5s。字幕底板宽 1180px（38px 字）。

**句首类型**：
- 指认式开场：`This is X.`（点名 + 一句定位）
- 以部件为主语、先说它在哪：`The battery hides inside the down tube.`
- 量词 + 单位开门见山：`A two hundred and fifty watt hub motor.`
- 先说结论再说修饰：`… Silent, and sealed.`
- 结尾用人体尺度/行动词收束：`Ready when you are.`

**不会出现的句式**：形容词堆砌的营销腔（`revolutionary`）、第一人称（`we believe`）、疑问句钩子（悬念靠数字滚动，不靠问句）、一句塞两个以上规格。

---

## 3. 叙事节奏

**信息投放顺序**：

```
扫描成形 → 标题（产品名滚入 + 型号/类目 + tagline）
  → 探测到 N 个系统（预备目标框闪一下）
  → 逐部件循环：锁定 → 相机运动 → 局部炸开 → 引线 → 数字滚到真值 → 停靠侧栏
  → 重组 → 点亮成实体全息（360° 转台）
  → 参数卡落版（重量 / 价格 / 行动号召）
  → 扫描擦除 → 片尾卡
```

**时间挂在 120 BPM 网格上**：1 拍 = 0.5s，1 小节 = 2s。

| 层 | 停留规则 |
|---|---|
| intro | 4 小节 = 8s |
| 第一条 callout | **3 小节 = 6s**（慢讲） |
| 其余每条 callout | **2 小节 = 4s**（加速） |
| regroup | 1 小节 = 2s |
| high（点亮） | 2 小节 = 4s |
| lock（落版） | 3 小节 = 6s |
| end | 5s |
| callout 总数 | **2–5 条**自动重排 |
| 数值停留 | ≥2.5s 后停靠左侧栏，全片每个参数在屏 10–25s |
| 标题停留 | ≥5s |
| 滚动数字 | 0.5s（第一条 1s） |
| 目标框吸附 | ~0.22s（cubic ease-out），重拍闪白 3 帧 |
| 引线 | ~0.5s |
| 炸开 / 合拢 | 1 拍（第一条 2 拍）/ 0.5s |
| 芯片停靠 | 卡片淡出 0.35s + 芯片 x 140→110 滑入 |
| 侧栏步距 | `min(112, 410/(n−1))` px（5 枚刚好放得下） |
| 字幕 | 提前 0.1s 上、下一句前 0.12s 下，停留 ≥ max(1.8s, 语音 + 0.6s) |

**总时长**：主 demo 39.0s（34s 场景 + 5s 片尾卡）。用例区间：规格讲解 30–40s、循环屏 20–30s、拆解 40–60s、升级 20–30s、装配顺序 20–40s。

**静默怎么用**：两种。
- **near**：第一次锁定前半个拍点，只剩房间嗡鸣，锁定撞击是静音后第一个声音。
- **true**：点亮前一整拍，**严格归零**（连界面提示音都没有）。
- 静音必须与 cue 表核对——任何 UI blip 落进静音窗口都会破坏它。

---

## 4. 镜头逻辑

**镜头是什么**：一台环绕相机（yaw/pitch/dist/窄 fov）+ 一个屏幕目标位——所以主体能坐在文字旁边。它不抒情，只负责「把注意力搬到该看的地方」。**目标框就是相机**（whip 跟着框走）。

**词汇表**：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 高 3/4 缓慢环绕并下降 | 审视；扫描面读成椭圆 | 扫描入场；勘测 |
| 顶视平面图 | 布局、顺序 | 零件清单；装配顺序 |
| 平视侧影、锁定 | 物体在实际使用中的样子 | 高度；前后对比 |
| 推近再漂移（3/4） | 这个部件重要；内部朝镜头走来 | 关键规格；一处缺陷 |
| 跟随目标框的甩镜 | 注意力跳到下一个部件 | 一串零件 |
| 绕部件自身轴环绕 | 轴向结构只在旋转中可读 | 转子、堆叠、铰链、镜片 |
| 沿长部件横移 | 长度、一条路径 | 横梁；线缆走向 |
| 拉远 + 放大镜（画中画） | 同时给出「在哪」（广）与「是什么」（镜） | 小零件；传感器 |
| 升降到平视或退回 | 状态改变：物体站起或归位 | 一次转化；尺度感 |
| 360° 转台 | 每一面 | 整个物体；对称性 |
| 近乎静止的缓慢 dolly | 阅读时间但不给死帧 | 规格表；清单 |

**允许的转场**（必须来自媒介本身）：扫描面（扫入/擦除）、放大镜虹膜、最多一次三帧的 glitch（用在最大变化上）。

**禁止**：场景内的剪切或淡入淡出；把甩镜写在下一段里（会在下一段开头播成硬切，必须在前一段就开始）；让零件飞进文字区（宁可缩短炸开向量）。

---

## 5. 表达习惯（idioms）

1. **七种原生手法的分工**（`STYLE.md:81-89`）：扫描生长 = 「这是真实数据」；目标锁定 = 「现在看这里」；局部炸开 = 「为什么这个数字是真的」；数字滚动 = 兑现节拍；芯片累积 = 阅读时间；放大镜 = 两个尺度同框；实体全息 + 光柱 = 「整体就绪」（最多一次）。
2. **相机跟着框走**：cubic ease，**在下一个锁定之前**就起步；真运动模糊只在甩镜内（5 子帧、180° 快门、1/48s），HUD 保持锐利。
3. **一切都在 24fps 的「ones」上**：只有字形乱码逐帧跳动。
4. **目标框**：超大、旋转 45°、很淡；~0.2s 内 cubic ease-out 吸附到位。
5. **炸开沿各自装配轴**：外壳**沿自己的轴**滑动，内容物留在原地并发光；开用一两拍、合很快。
6. **滚动数字**：字符从右往左锁定，在重拍上转成强调色并闪一帧。
7. **落版**：把读过的参数停靠进左侧栏，直到片尾；芯片引线接到零件上的圆环。

---

## 6. 氛围

展台 / 发布会 / 科幻指挥室：近黑的场、一道冷色的光、悬浮的线框、偶尔的界面提示音。整体是**精密、可控、被测量**的气质——不是戏剧性，而是「一切都在被读取」。

---

## 7. 声音

- **合成音色**：锯齿/方波琶音 + ping-pong delay（1–4kHz 挖空给人声）；方波脉冲（D1 四分）；八分贝斯、合成 hat/clap、失谐锯齿 pad；808 式滑音 sub（drop 用）。
- **动作声（按材料分层）**：光 = **调内**正弦与 FM blip；机械 = 伺服滑动、气动噗、液压嘶、金属叮（J-cut 提前）；一次锁定 = 低频撞 + 金属 clack + 两声高频锁定音（D6+12 / A5+12）；数字滚动 = 按 24fps 咔哒；探测 blip = D–F–A；琥珀确认 = D6 + A6 + E7。环境 = 投影嗡鸣（40/80/120Hz）+ 房间底。
- **混音规则**：音乐优先、挂网格（一小节 = 一个信息拍），锁定都落在重拍上并与配乐核对。人声期间**音乐压 −16.5dB、拟音也压 −15dB**，用 **0.5s max-filter 保持**（字与字之间不回弹，避免抽吸）；只有锁定/确认撞击的**前 0.2s** 逃过闪避。整体 −14 LUFS。
- **密度跟着信息走**：阅读段半速、一拍真数字静音、最大变化用 drop、每个部件加/减一层、更长音值减速、转调、长保持下垫一个持续音。

---

## 8. 变化空间

物体、模型、锁定哪些部件及顺序、开场、结尾、相机路径、颜色（一对冷色相 + 一个暖强调）、节奏、音乐。

`STYLE.md:119-121` 给了远离 demo 的方向：
- **结构**：不点名产品的循环屏（循环五个传感器）；每镜深一层的拆解（直到核心只剩一个热件）；两版共享投影台、每个数字从旧滚到新的升级。
- **开场**：先给一个部件特写，其余从它扫出；2D 侧影挤出成线框（`modelFromPath`）；顶视平面、投影台当表盘。
- **结尾**：单个数值居中、线框在四周变暗；knolling 飞成带标签的顶视布局；关机、HUD 面板逐块熄灭只留投影台发光。

---

## 9. 禁忌清单

- 把主体渲染成实物——必须始终是线框。
- 强调色用在「锁定的真值」以外的地方。
- 场景内的剪切或淡入淡出。
- 文字压在网格线上（每块文字必须有深色底板）。
- 零件漂浮、不与相邻件物理相连。
- 在静音窗口里放 UI 提示音。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`content.json`）

| 字段 | 类型 | 允许值 | 越界后果 |
|---|---|---|---|
| `product` | string | 1–10 字符 | 超长 176px 字会溢出 410px 栏；需在 `titleBlock` 降字号 |
| `model_code` / `category` | string | 合计 ≤30 | 单行 mono 22px |
| `tagline` | string | ≤60 | 420px 自动换行并缩到 20px |
| `model` | path | 模型 JSON | 任意尺寸都会归一化；`callouts[].part` 的名字必须存在 |
| `hue` / `accent` | 0–360 | 任意 | 整片重新配色 |
| `voice` | `{id,speed}` | Kokoro 音色 | 用 whisper 核对 |
| `intro_vo` / `outro_vo` / `callouts[].vo` | string | intro ≤5s、第一条 ≤4.8s、其余 ≤3.5s | 超长字幕被夹到下一句，口播与下一次锁定重叠 |
| `*_vo_asr` | string | 可选 | 告诉 whisper 该听到什么（如数字） |
| `callouts[]` | array | **2–5** 条：`part`、`label` ≤24、`value` ≤6、`unit` ≤4、`detail` ≤40 可选、`vo` | 第一条 3 小节、其余各 2 小节；>5 放不进侧栏 |
| `footer.weight` / `footer.price` | `{label,value,unit}` | value ≤7 字符 | 自动缩到 40px |
| `footer.cta` | string | ≤34 字符 | 自动缩到 14px |
| `film_title` / `credits[]` | string | — | 片尾卡 |

> ⚠️ `DEMO.md:92` 明确：换 content 只是「验证引擎能重排的技术检查」，不是做片子的方式。真片子有自己的 treatment、顺序、相机路径与时间线。

### 10.2 新画面主体的契约

写一个模型生成器（用 `models/mkmodel.mjs` 的图元：tube / ring / disc / box / saddle / fender / wheel / cells / stator / rotor / caliper…），或把 CAD 导出转成模型格式。

**模型 JSON = `{ name, parts[] }`**：
- 每个 **part** = 「一个可被 callout 瞄准的东西」：
  `{ id`（被 `content.json` 的 `callouts[].part` 引用）`, anchor`（热点坐标，**必须在零件表面**）`, center`（可选，特写/放大镜看哪里，默认 anchor）`, tagDir`（可选，落版编号芯片在环左 −1 / 右 1）`, pieces[] }`
- 每个 **piece** = 「炸开时独立移动的刚性子装配」：
  `{ id, v`（顶点扁平数组）`, e`（边索引对）`, q`（可选四边形，4 索引，供实体全息面与 Fresnel）`, explode`（炸开=1 时沿装配轴的偏移）`, axis`（可选自转轴 `{c,d}`）`, internal`（可选，打开前隐藏）`, hot`（可选，打开时近白发光）`, box:false`（可选，不计入目标框，用于长软管/线缆） }`

**规则**：每个 piece 必须物理接触邻件；管件 = 环 + 纵向线；总顶点约 5k / 边约 6k；承载关键数字的部件要有一个 `hot` 内部件和一个沿自身轴滑动的外壳。（`DEMO.md:178`）

### 10.3 时间线契约

`makeFilm(C, model, dur)` 必须返回 **`{ render, TL, events, subs, timeline }`**：
- `render(ctx, t, opt)` 逐帧绘制（`opt.nosub` / `opt.noblur`）；`TL` 段落表。
- `events()` 返回声音事件数组；`subs()` 返回字幕条；`timeline()` 返回配乐网格（`{bpm, bar, dur, intro, calls, regroup, high, lock, end, vo}`）。
- 页面契约（`main.js`）：`window.DUR` / `window.TL` / `window.EV` / `window.SUBS` / `window.TIMELINE` / `window.render`。
- `tools/export.mjs` 用无头浏览器把这些导出成 `events.json` / `timeline.json` / `out/srt.json`。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者（mix.py / score.py） |
|---|---|---|
| `scan` / `scan_tick` / `scan_done` | 扫描声与刻度 | 扫频 whoosh + tick + 完成 blip |
| `roll{d,n}` | 滚动咔哒 | 按 24fps 计数器 |
| `confirm_small` / `confirm` | 确认音 | blip / D6+A6+E7 叠置 |
| `type_line` | 打字 | 三声 tick |
| `detect{i}` | 探测 blip | D–F–A |
| `lock{i,part}` | 锁定撞击 | 低频撞 + clack + 两声锁定音 |
| `lock_small` | 放大镜内小锁 | blip |
| `push{d}` | 伺服推镜 | servo |
| `orbit{d}` | 环绕 | whoosh |
| `explode{part,d}` | 局部炸开 | 按材料（battery=伺服+shimmer / motor=气动+叮×3 / 其他=液压嘶+叮） |
| `leader` | 引线 | zip |
| `reassemble{part}` | 合拢 | zip + tick |
| `dock{i}` | 停靠 | blip |
| `whip{d}` | 甩镜 | whoosh |
| `jcut{part,d}` | 提前的机械声 | 电机 whine / 液压嘶 |
| `loupe_open` / `loupe_close` | 虹膜 | iris |
| `powerdown{d}` | 关机 | powerdown |
| `ignite` | 点亮 | ignite |
| `glitch{d}` | 故障帧 | glitch |
| `wave{d}` | 光波 | shimmer |
| `spin{d}` | 转台 | whoosh |
| `ping{i}` | 落版 ping | ping |
| `cta` | 行动号召 | confirm |
| `erase{d}` | 擦除 | 反向 whoosh |
| `card_tick` | 片尾卡 tick | blip |
| `silence{d,kind:'near'|'true'}` | 静音窗口 | mix.py 据此归零 |
| `vo{id,d}` | 人声 | 加载 `voices/<id>.wav` |

---

## 11. 构建链（复用机制）

```
sh styles/hologram-hud/demo/build.sh                 # 从零重现
CONTENT=content_alt.json NAME=kite sh .../build.sh   # 换内容（产物在 demo/out/kite/）
  # 1. models/gen_*.mjs 生成线框模型 JSON
  # 2. tools/make_lines.mjs：content → lines.json
  # 3. Kokoro 配音（af_heart）→ whisper 逐句校对
  # 4. tools/export.mjs：画面事件 → events.json，时间网格 → timeline.json，字幕 → out/srt.json
  # 5. music/score.py：读 timeline.json 排段落，numpy 合成 → score.wav + score.json
  # 6. tools/cuecheck.py：配乐 ↔ 画面卡点自检
  # 7. mix.py：界面音 + 机械拟音 + 环境底 + 人声 + 闪避 → mix.wav
  # 8. srt → 逐帧渲染（甩镜段 5 子帧运动模糊）→ mux（−14 LUFS，无颗粒）→ 成片 whisper 抽查
```
（`build.sh:1-38`）

**关键机制**：`score.py` **读 `timeline.json`** 排段落——所以换内容时配乐会自动跟着新段落重排（`score.py:3-15`）。`film.js` 里 `events()` 产出的 `type` 表同时喂给 `mix.py`（声音）、`score.py`（网格）和 `cuecheck.py`（卡点自检）。

---

## 12. 证据

```
styles/hologram-hud/STYLE.md:8-14      本质与不是什么
styles/hologram-hud/STYLE.md:18-25     舞台/投影台/线框/热边/CAD/实体/HUD/文字底板
styles/hologram-hud/STYLE.md:29-32     颜色逻辑
styles/hologram-hud/STYLE.md:36-39     字体/等宽数字/字幕/标题
styles/hologram-hud/STYLE.md:43-49     24fps ones / 锁定 / 炸开 / 引线 / 滚动 / 芯片 / 跟框 / 无剪切
styles/hologram-hud/STYLE.md:53-69     相机词汇表与取景规则
styles/hologram-hud/STYLE.md:73-77     音乐优先/合成音色/密度/foley/闪避 −14 LUFS
styles/hologram-hud/STYLE.md:81-89     原生手法分工
styles/hologram-hud/STYLE.md:109-123   用例表与变化空间
styles/hologram-hud/STYLE.md:123       换 content 只是技术检查
styles/hologram-hud/DEMO.md:3          不要复用故事/叙事弧/镜头/道具/时长
styles/hologram-hud/DEMO.md:10-14      结构与数值停留/停靠时长
styles/hologram-hud/DEMO.md:19-31      逐拍镜头表与取景数字
styles/hologram-hud/DEMO.md:33         运动数值
styles/hologram-hud/DEMO.md:37-43      配乐弧线/120 BPM/Dorian/和弦/静音/J-L-cut/叙述者
styles/hologram-hud/DEMO.md:47-54      全部数值（舞台/投影台/线框/实体/配色/字体/HUD/字幕）
styles/hologram-hud/DEMO.md:90-109     content.json 字段表
styles/hologram-hud/DEMO.md:129-178    引擎参考与模型数据格式
styles/hologram-hud/demo/film.js:5                        BEAT=0.5 / BAR=2
styles/hologram-hud/demo/film.js:15-36                    buildTimeline 段落
styles/hologram-hud/demo/film.js:34                       语音兜底 = words/2.6
styles/hologram-hud/demo/film.js:39-47                    callBeats
styles/hologram-hud/demo/film.js:50-95                    相机键位与甩镜跨段
styles/hologram-hud/demo/film.js:110                      railStep
styles/hologram-hud/demo/film.js:112-126                  甩镜运动模糊 5 子帧
styles/hologram-hud/demo/film.js:134-160                  扫描/擦除/点亮/光波
styles/hologram-hud/demo/film.js:260-267                  字幕时机
styles/hologram-hud/demo/film.js:269-276                  状态行序列
styles/hologram-hud/demo/film.js:279-314                  放大镜 ×4.3
styles/hologram-hud/demo/film.js:394-433                  events() 全部 type
styles/hologram-hud/demo/film.js:434-437                  subs()/timeline() 契约
styles/hologram-hud/demo/mix.py:38-59                     锁定撞击与确认音构成
styles/hologram-hud/demo/mix.py:133-136                   投影嗡鸣 40/80/120Hz
styles/hologram-hud/demo/mix.py:215-232                   duck −16.5/−15dB、0.5s 保持、真静音归零
styles/hologram-hud/demo/music/score.py:3                 120 BPM/Dorian/1-16 网格
styles/hologram-hud/demo/music/score.py:79-95             和弦与段落映射
styles/hologram-hud/demo/music/score.py:237-276           808 sub 与 drop
styles/hologram-hud/demo/build.sh:1-38                    构建链与换内容命令
styles/hologram-hud/demo/tools/make_lines.mjs:1-9         content → lines.json
styles/hologram-hud/demo/tools/export.mjs:1-18            导出三件套
styles/hologram-hud/demo/content.json:1-63                示例内容字段
styles/hologram-hud/demo/timeline.json:1-79               实测段落与语音时长
styles/hologram-hud/style.json:16-17                      frame_sec 25.5 / dur 39.0
```
