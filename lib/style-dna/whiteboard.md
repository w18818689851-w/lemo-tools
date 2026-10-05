# 白板讲解（whiteboard）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Einstein in Your Pocket》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一堂在**一整块光滑白板**上现场画出来的课：所有信息都用干擦马克笔**一笔一笔写出来**，笔自己悬空移动（**没有手**），磁贴可以滑动/抬起/下沉，板擦可以把一条轨迹**倒着擦回去**，镜头在板面上旅行而不是切镜。

**它不是**：蓝图（蓝纸 + 制图规范）、蜡笔绘本（蜡质感 + 童话）、动效字幕解释片（文字必须一笔笔写出来，绝不做成动画字块）。
（`STYLE.md:15`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「白板 + 干擦马克笔 + 悬空道具」的某个环节。

| 规则 | 具体值（实测/文档） |
|---|---|
| **板即世界** | 8000×4500 世界单位的暖白渐变板面 `#fbfbf9 → #eeede9`；叠一层极淡擦痕/细划痕平铺纹理（1024px tile，alpha ≤0.03）；外加几十条 5–10% 的**旧课残影**（旧字/圆/箭头，灰 `#9aa0a8` / 淡蓝 `#8aa0c8`，demo 46 条）。 |
| **墨只有三种记号笔色** | 黑 `#23262c` = 事物与结构；蓝 `#2a5cb3` = 信号/光/测量；橙 `#d97757` = 你/时间/关键之物（每个区域只允许一个强调色）。alpha 0.94，用 **multiply** 叠加。 |
| **线宽** | 绘图 6–11px；写字宽 ≈ 字高 13%。 |
| **笔画性格** | 每 ~0.6×线宽重采样；沿法线低频手抖（±2.6px，波长 ~220px）+ 细颤；凿形笔尖按方向调制宽度（0.8–1.0）；起笔压力斜坡 0.72→1、收笔收 12%；圆**越过闭合处**（overlap）；矩形四笔、四角小出界；长笔画起笔内侧一个积墨点。 |
| **干擦质感** | 512px 斑点 + 短划 tile，用 `destination-out` 从墨层减掉，锁定在板面空间，镜头拉远时淡出。 |
| **字只有一种单线手写体** | EMS Tech（OFL），每个字 ±2° 旋转、±3.5% 基线/缩放抖动；缺字（`μ ≈ → × − ✓ ² ↓ ° ± .`）在引擎手工定义。 |
| **高光** | 一道柔和斜向**窗影**反光（白 10–16%），以约 **0.35×** 镜头速度漂移——这一处细节卖出「光滑」。 |
| **道具** | 干擦马克笔（白笔杆、墨色色环与笔帽、毛毡笔尖）、深灰毛毡板擦（橙色小标签）、一枚有光泽的橙色地图别针磁贴（径向渐变 + 白点 + 高光 + 软投影）。铝框与笔托只在最后一个大全景（镜头越过板边）出现。 |

**关键取向**：`STYLE.md:12` 强调「**每一笔都有声**」、`STYLE.md:19` 强调窗影以 0.35× 漂移是「光滑」的唯一卖点。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位边画边讲的老师。第二人称 / 泛指的现在时（`you are here`、`your phone`、`how GPS really works`）。平实、直接、少形容词。

**长度（实测）**：一条线就是一句话；字幕在**子句处**拆分，**每行 ≤44 字符**，短子句（<24 字符）与相邻子句合并（两行上限 90 字符）。字幕 44px，宽度 >1250px 时平衡成两行。书写必须「**落在词上**」——一个术语在旁白说出的那一刻才写完。

**句首类型**（示例性，不是抄原文）：
- 从观众**自己拥有的小物件**起句：`your phone`、`the pin`
- 尺度反差钩子：`20,000 km up`
- 机制陈述、名词留给画面：`delay × speed of light = distance`
- 静默之后一句转折：`But, there's a catch.`
- 「一个数字的后果」起句：`38 μs × c ≈ 11 km`

**这个风格里不会出现的句式**：
- 把术语做成动画字块淡入/滑入（一切文字必须一笔笔写出来）
- 一句话塞多个并列信息点（一条线只承担一个想法）
- 任何画出来的手 / 手臂 / 光标
- 抽象口号式空话（每个说法都必须能被画在板上并被镜头走到）

---

## 3. 叙事节奏

**结构**：一块板、一条论证链——
钩子落在一个极小的物件上（别针）→ 尺度揭示（拉远看到整张地图/手机）→ 标题落在**第一拍强拍**上 → 分 3 步讲机制（画线，镜头骑着线去下一个区域）→ **静默 + 一句转折** → 用「视觉二重奏」解释这个转折 → 一个展示后果的玩笑 → 板擦倒擦 → 修正、对齐 → 拉远越过板框、看到整块板挂在墙上 → 在标题下方写结尾卡。
板上每个想法各占一个区域，**板面上的距离 = 论证里的距离**。

**节拍（实测）**：音乐挂在 **120 BPM** 网格（1 拍 = 0.5s），第一小节强拍 = 标题（`T0=10.0`）。笔画被排进一个**时间窗口**并解出速度（`by:` 模式），所以书写总能准时落在词上；手速曲线 `u − sin(2πu)/2π × 0.8`（慢落、快中、慢收）。实测：标题 ~3s、标签 0.3–0.8s、一整颗卫星 ~1s；跳笔抬起量 = 距离比例、上限为窗口的 **35%**；间隔 >0.75s 的笔飞到框外停车、下一笔前 **0.42s** 飞回。磁贴下落 0.3s、下沉 = 倾斜 0.5rad + 下坠 40px；板擦恒速、擦 **90–230px** 宽的一条带、强度 90%（永远留 10% 残影）。

**总长**：主 demo **111.0s**（`style.json` dur=111.0，frame_sec=55.5）；`STYLE.md:6` 定位「**60–120s** 的讲解片，通常是科学或 how does X work」；结尾卡写在标题下方（demo 103.3s 起、107.3s 落笔帽）。

**静默政策**：静默是叙事工具——在讲「时间本身」之前留 **43.55–46.42s**（约 2.9s）静默，音乐按 0.35s 淡出后归零，**全片只剩墙上挂钟走秒**；然后 46.45s 用管钟（tubular bells）敲下第一个音把镜头甩到轨道钟。

---

## 4. 镜头逻辑

**相机是什么**：一台在巨大板面上移动的 **2D 相机**（位置、缩放按 **1/z** 插值让推镜像 dolly，带一点 roll）。它是一份「词汇表」而不是一条固定路线；相机**从不切镜**，要切就是一记**甩镜**（whip）。

| 运动 | 表达 | 可以服务 |
|---|---|---|
| 从一张极小的画拉远 | 尺度 | 一个惊人的大小；给出语境 |
| 骑着笔正在画的那条线 | 一个想法引出下一个 | 转场；一个过程；一条路径 |
| 停住不动 | 现在读 | 一个方程；一个定义；一份清单 |
| 甩到新区域 | 停顿之后的新想法 | 一个转折；一个「但是」 |
| 回到早先的区域 | 免费的回调 | 复用某个结果；做对比 |
| 两个区域的分屏 | 两件事同时发生 | 二重奏；前后对比 |
| 慢推到一个符号 | 这一项才是重点 | 一个单位；一个变量；一个名字 |
| 沿一条长图平移 | 顺序、时间 | 一条时间线；一条流水线；一段旅程 |
| 拉远越过板边、看到墙 | 整堂课是一张图 | 总结；一次尺度跳跃 |

**允许的转场**：
- 笔画的线即转场：镜头骑着笔刚画出的那条线（轨道、信号线、轨迹）去下一个想法
- 一记甩镜（camera whip）——相机运动 **>14px/帧** 时做 180° 运动模糊（渲染 ≤12 子帧、子帧间隔 ≤4px 后平均）
- 笔飞入/飞出画框（间隔 >0.75s 时停到框外，下一笔前 0.42s 飞回）
- 板擦沿一条路径恒速擦除（留 10% 残影）——擦一条轨迹倒着读 = 撤销时间

**禁止**：
- 在板面上切镜（要切就是一记甩镜，绝不做叠化/划像）
- 镜头无来由地运动（每次运动都由「看什么」驱动）
- 任何画出来的手、手臂或光标
- 在需要阅读时让镜头动（读方程/定义/清单时必须停住）

---

## 5. 惯用手法（idioms）

- **按笔画顺序书写**：揭示本身就是解释——方程逐项出现，正好在旁白说出该项时写完。
- **笔带着镜头走**：转场是被画出来的一条线，相机骑着它到下一个想法。
- **磁贴**：板上唯一允许「移动」的东西；把主角交给一枚磁贴，让它被抬起、放下、滑动、下沉。
- **板擦倒带**：把一条轨迹倒着擦掉，读起来像在撤销时间。
- **两支笔同时画**：一场现场二重奏，比较两个量（demo：地面钟 vs 轨道钟，两种速度走时）。
- **旧课残影**：一条淡淡的旧图在合适的时候变得相关。
- **全板揭示**：最后拉远到越过板框，看到整堂课作为一张图挂在墙上（带铝框和笔托）。

---

## 6. 氛围

一间安静的自习室 / 教室：暖白的板、马克笔的干涩声、墙上挂钟的走秒。气质是「**清楚、有条理、现场感**」，而不是戏剧性——镜头从不离开板面，直到最后一记拉远把整面墙露出来。

---

## 7. 声音

**乐器**：
- 钟表式极简：马林巴（8 分音型）、大提琴/低音提琴拨弦（pizz）、木鱼（每拍一下）、钟琴（glockenspiel）主题、沙锤/拍手只在响段出现
- 科技题材可选：合成器琶音、kalimba、拨弦
- 二重奏/发散时刻：同一个音型跑两种速度（phase，demo 用第二台马林巴 ×140/130.5），修正时 **snap 成齐奏**

**foley（每一笔都有声）**：带通毛毡擦玻璃噪声（嘶声 ~2.2–7.5kHz + 身体 ~0.5–1.5kHz），用**笔画自身的速度曲线**做包络，起笔一声 4ms 笔尖「嗒」，随机粘滑颗粒；约 **28%** 的长笔画带**干擦尖叫**（1.5–2.6kHz 正弦 + 7–13Hz 颤音）；蓝笔稍暗、橙笔稍亮；**pan = 笔画的屏幕 x**，镜头越近越响。道具：磁贴吸钢面 = click + 金属模态（830/1370/2210/3120Hz）+ 140Hz 板体闷响；板擦 = 250–2600Hz 毛毡摩擦、被锯齿路径调制；笔托 = 塑料弹跳 + 铝环；笔帽开/合；落水 plop + 水滴。房间：低频底噪 + 一只墙上挂钟在走地面钟的秒。

**混音规则**：人声在最上层（压缩、轻房间）；配乐比 VO RMS 低 **6.5dB** 并在说话时再 duck **9dB**；foley 比 VO 低 **11dB**；房间底噪 0dB；整体 **−14 LUFS**。三段分层：房间底噪 + 逐事件生成的动作声 + 钟表式极简配乐。静默段（43.55–46.42s）只有房间钟；倒带 = 上一段进行曲（`drift.wav`）倒放并压缩进板擦行程。

---

## 8. 变化空间

你可以自由决定：主题的对象、板面布局、逻辑内的颜色、配音、音乐家族、镜头路线、开场、结尾与时长（`STYLE.md:6` 给出 60–120s，适合科学/「X 是怎么工作的」）。

`STYLE.md:110-112` 明确列出**远离 demo** 的选择：

- **结构**：一场**证明**（一个论断写在上方、板面向下一步步填满、每步证毕就框起来）；一场**辩论**（两支笔、板面两半、各自画到中间相遇）；一条**时间线**（一条长横线从左骑到右、事件挂在上面）。
- **开场**：中央画一个巨大的**问号**再缩成第一个图里的一点；一块**被擦过的板**、上面还留着错误答案的残影；一枚**磁贴「咔」地落在空板上**。
- **结尾**：把答案**圈两遍然后落笔帽**；把板**擦干净只留一条线**；推入板上最小的那个符号、它变成标题。

---

## 9. 禁忌清单

- 把文字做成动画字块淡入/滑入——文字只能被一笔笔写出来。
- 画出手、手臂或光标（本风格没有手）。
- 在板面上切镜（只允许甩镜）。
- **一支笔安排太多活**、一笔接一笔地往后漂（demo 里卫星晚了 12s）——每张图必须给一个时间窗口（`by:`），重叠的活交给另一支笔。
- **虚线用统一的最小笔画时长**（60 段虚线 × 0.09s 底线 = 6s）——虚线要有自己的更小底线。
- **积墨点比笔画起点还大**（每个字母都会晕出灰边）——把点收在笔画内。
- **标点消失**（字体的句点是 1px 笔画）——小于线宽的笔画要渲染成点。
- 推镜把**标签切一半**——一个标签在任何镜头里必须全在或全不在。
- 子帧太少的运动模糊让**文字频闪**——子帧间隔 ≤4px。
- 板擦路径**擦过想保留的标签**。
- **英式配音配美式音素**（bm_george + en-us 把 clocks 读成 Clarks）——语言码要配嗓音，并用 ASR 核对。
- 直接照抄 demo 的故事、叙事弧、镜头、道具或时长；结尾卡里的 LemoLab 署名只属于本库 demo，用户成片不带。

---

## 10. 素材契约（换主题时必须遵守）

### 10.1 内容字段表

- `lines.json`：每一行旁白 `{id, text}`（id 形如 `v01 / v02a…`），**逐行即一句**、按子句拆成字幕。
- `voices/words.json`：每个词在每行里的起止时间，供 `at(id, word)` 把画面钉在说出的词上。
- 片子的内容要点（demo 版）：主题对象（别针/手机）、一个惊人的数字（20,000km / 38μs / 11km）、一条能走过去的过程（信号→延迟→距离→三边定位）、一个后果（每天漂一格）、一个修正（发射前调慢）。
- 颜色语义固定（`STYLE.md:28`）：黑=结构、蓝=信号/测量、橙=你/时间/关键之物。

### 10.2 新主体契约

新主体 = 一组用引擎造形函数画出的 `Stroke`，交给某支笔在时间窗口内画完。必须做三件事：

1. 用 `W.line / curve / poly / arc / circle / rect / roundRect / arrow / dashed / hatch` 或 `W.text(str, x, y, {h, align, color})` 生成 `Stroke[]`；
2. 用 `tl.draw(pen, shapes, t, {by, minGap, maxGap})` 排进窗口（`by:` 让引擎解手速、保证准时写完；虚线自带更小底线、需要时用另一支笔）；
3. 需要移动的实体只交给磁贴（`W.drawPinMagnet`）；需要擦除/倒带用 `tl.erase(path, t, dur, {width, strength})`。

给标签留出「全在或全不在」的余量，避开推镜的切边。

### 10.3 时间线契约

`demo/film.js` 导出 `build()` → `{ dur, render, ev, subs, cam, tl, VO, cues }`：

- `render(ctx, t)`：逐帧绘制（含 >14px/帧时的 180° 运动模糊、≤12 子帧、间隔 ≤4px）；
- `dur`：总时长（demo `END=111`）；
- `ev`：按时间排序的事件数组（供 `events.mjs` 导出 `events.json` 驱动声音，并附加 `pan/z/on` 供声像与远近）；
- `subs`：字幕条（子句拆分、≤44 字符/行、每条至少保持 1.4s）；
- `cam`：键控相机；`cues`：音乐锚点（`T0/BEAT/duet0/fix0/dayT…`）。

页面契约由 `main.js` 暴露 `window.READY / window.render(t) / window.DUR / window.EV`。

### 10.4 事件词汇表（type → 消费者）

| type | 载荷 | 消费者 / 效果 |
|---|---|---|
| `stroke` / `write` / `dash` | `{pen,dur,len,x,y,pan,z,on}` | mix.py 记号笔声（write 稍轻）；pan=屏幕 x、z=远近、on=0 时压低 9dB |
| `tap` | `{z}` | 笔尖小嗒 |
| `magnet` | `{big}` | 磁贴吸板：金属模态 + 板体闷响 |
| `magnetOff` | — | 磁贴抬起 |
| `erase` | `{len}` | 板擦毛毡摩擦 |
| `rewind` | `{dur}` | 板擦倒擦（摩擦用 9Hz 调制） |
| `splash` | — | 落水 plop + 水滴 |
| `tray` | `{pen}` | 笔落托弹跳 |
| `trayEraser` | — | 板擦落托闷响 + 弹跳 |
| `cap` / `capOn` | — | 笔帽开 / 合 |
| `ping` | `{k}` | 广播涟漪 → 钟琴 ping |
| `tickG{i}` / `tickO{i}` | — | 地面钟 / 轨道钟的尺子刻度 → 木鱼 |
| `tickFix{i}` | — | 修正后的刻度 |
| `day{d}` | — | 漂移每一天 → 进行曲 |
| `vo` | `{id}` | 人声 |
| `cues` | 音乐锚点包 | music.py |

全部由 `film.js` 里 `tl.draw` 的 stroke 事件、`tl.cue`、`tl.erase` 与 VO 表合并产生，再由 `tools/events.mjs` 序列化成 `events.json`。

---

## 11. 构建链

1. 把脚本写成短行（`demo/lines.json`），用 `core/tts/tts.py` 合成（voice `bm_george`，`lang: en-gb`），用 `demo/tools/asr_check.py`（`WM=medium.en`）核对 → `voices/words.json` 词时间。
2. 布好板面（每个想法一个区域），写 `demo/film.js`：VO 起始时间、把画面用 `at(id, word)` 挂到说出的词上、笔、相机关键帧。
3. `node core/render/events.mjs demo` → `events.json`（每一笔、擦除、磁贴、cue 锚点）。
4. `music.py`（读同一份 events）→ `mix.py`（由 events 生成 foley + VO + ducked score）。
5. `node core/render/video.mjs demo --fps 24` → `core/render/mux.sh … 24 2`（demo 整片约 30s 渲完）。
6. `demo/build.sh` 做第 3–5 步加字幕/海报/剧照；`--vo` 还会重做第 1 步。

---

## 12. 证据（`file:line`）

- `styles/whiteboard/STYLE.md:8-15` —— 本质三条硬规则与「不是什么」（一块实体板、板是地图、真马克笔、没有手）
- `styles/whiteboard/STYLE.md:17-24` —— 材料与渲染（板面/残影/窗影、墨 multiply、笔画性格、干擦质感、单线字、道具）
- `styles/whiteboard/STYLE.md:26-31` —— 颜色逻辑（至多三种记号笔色与其语义、单色变体）
- `styles/whiteboard/STYLE.md:33-39` —— 字体与字幕规则（单线手写体、≤44 字符/行、保持 ≥max(1.8s, 语音+0.6s)、写在词上）
- `styles/whiteboard/STYLE.md:41-48` —— 运动质量（手速曲线、跳笔/停车、磁贴、板擦、速度、运动模糊）
- `styles/whiteboard/STYLE.md:50-66` —— 镜头语法表与运动模糊规则（>14px/帧、≤4px 子帧、不切镜只甩镜）
- `styles/whiteboard/STYLE.md:68-75` —— 声音调色板（每笔有声、干擦尖叫、道具、房间、音乐、混音 −14 LUFS）
- `styles/whiteboard/STYLE.md:77-87` —— 原生动作菜单（按笔画顺序写、笔带镜头、磁贴、板擦倒带、两支笔、残影、全板揭示）
- `styles/whiteboard/STYLE.md:89-98` —— 媒介陷阱（一笔多活、虚线底线、积墨点、标点、切边、子帧、板擦路径、配音音素）
- `styles/whiteboard/STYLE.md:104-112` —— 变化空间（结构/开场/结尾清单）
- `styles/whiteboard/DEMO.md:3` —— 「不要复用它的故事、叙事弧、镜头、道具或时长」
- `styles/whiteboard/DEMO.md:10-32` —— demo 故事结构与原生能力用法（钩子→尺度→标题→机制→静默+转折→二重奏→后果→倒带→修正→全板）
- `styles/whiteboard/DEMO.md:34-41` —— 镜头语法五条与 180° 运动模糊（>14px/帧、≤12 子帧）
- `styles/whiteboard/DEMO.md:43-49` —— demo 运动数值（跳笔 35%、>0.75s 停车、0.42s 飞回、磁贴 0.3s、下沉 0.5rad+40px、板擦 90–230px@90%、标题 3s）
- `styles/whiteboard/DEMO.md:51-57` —— 配乐结构（每笔有声、2.2–7.5kHz、干擦尖叫、道具模态、房间挂钟、120 BPM 钟表极简、phase、混音 6.5/9/11dB）
- `styles/whiteboard/DEMO.md:59-67` —— 色值与道具（板 `#fbfbf9→#eeede9`、46 条残影、窗影 0.35×、三色语义、笔画性格、干擦纹理、EMS Tech、道具）
- `styles/whiteboard/DEMO.md:69-74` —— 标题与结尾卡（写在板上、字幕 44px、demo 结尾卡 103.3s、LemoLab 署名仅本库）
- `styles/whiteboard/DEMO.md:76-83` —— 构建链（lines.json→TTS→asr_check→events.mjs→music.py→mix.py→video.mjs→build.sh）
- `styles/whiteboard/DEMO.md:96-127` —— 引擎参考表与最小示例（各造形函数、Pen/Timeline/Camera/Board、drawMarker/drawEraser/drawPinMagnet）
- `styles/whiteboard/demo/film.js:7` —— BPM=120 / BEAT=0.5 / T0=10.0（第一小节强拍=标题）
- `styles/whiteboard/demo/film.js:8-13` —— VO 起句时间表与 END=111
- `styles/whiteboard/demo/film.js:20-24` —— at(id,word)/atS/atE：把画面钉在说出的词上
- `styles/whiteboard/demo/film.js:27-30` —— 三支笔 K/O/B 与框外停车位
- `styles/whiteboard/demo/film.js:34-42` —— 布局常量（手机/屏幕/PIN/SAT/EQ/CLK/RUL/TRAIL/SEA）
- `styles/whiteboard/demo/film.js:44-54` —— 46 条旧课残影（5–10%、灰/淡蓝）
- `styles/whiteboard/demo/film.js:80-97` —— HOOK 与 TITLE 的绘制窗口与标题落拍
- `styles/whiteboard/demo/film.js:100-132` —— 卫星/轨道/原子钟/广播涟漪（ping）与时间戳
- `styles/whiteboard/demo/film.js:135-143` —— 延迟=距离（信号虚线、harp 下行、方程逐项）
- `styles/whiteboard/demo/film.js:145-162` —— 三边定位（三段圆弧、`?` 标记、+1 more satellite）
- `styles/whiteboard/demo/film.js:164-195` —— 相对论（两座钟、尺子二重奏、speed/gravity、−7μs/+45μs/+38μs）
- `styles/whiteboard/demo/film.js:197-227` —— 后果（38μs×c≈11km、每天漂一格 Mon–Sun、入海、鱼与 `?`）
- `styles/whiteboard/demo/film.js:229-244` —— 修正（板擦倒带、重画轨道刻度、✓、tuned slow before launch）
- `styles/whiteboard/demo/film.js:246-256` —— 结尾卡写在标题下方（103.3s、capOn）
- `styles/whiteboard/demo/film.js:258-278` —— 别针磁贴编排（抬起/飞出/落回/漂移/入海/倒带）与 cue
- `styles/whiteboard/demo/film.js:280-320` —— 键控相机全表（含 1/z 推拉、甩镜 46.45、全板 101.5）
- `styles/whiteboard/demo/film.js:322-337` —— 笔/板擦落托编排与 Board 装配
- `styles/whiteboard/demo/film.js:339-378` —— 字幕拆分（子句、≤44 字符、两行 1250px、保持 1.4s）与字幕条渲染
- `styles/whiteboard/demo/film.js:380-402` —— 帧渲染（>14px/帧的运动模糊、≤12 子帧、events 附加 pan/z/on、返回对象）
- `styles/whiteboard/demo/engine/wb.js:8` —— INK 常量（black/blue/orange/red/green）
- `styles/whiteboard/demo/engine/wb.js:12-33` —— resample / chaikin
- `styles/whiteboard/demo/engine/wb.js:37-84` —— Stroke 类与手速曲线 `prog()`（`u − sin(2πu)/2π × 0.8`）
- `styles/whiteboard/demo/engine/wb.js:87-115` —— ribbon（凿形+压力变宽、点渲染）
- `styles/whiteboard/demo/engine/wb.js:118-177` —— 造形函数 line/poly/curve/arc/circle/rect/roundRect/arrow/dashed/hatch
- `styles/whiteboard/demo/engine/wb.js:181-193` —— 手工补的字形（μ ≈ → × − ✓ ² ↓ . ± °）
- `styles/whiteboard/demo/engine/wb.js:194-221` —— loadFont / text（按书写顺序、逐字抖动）
- `styles/whiteboard/demo/engine/wb.js:225-267` —— Pen / Timeline.draw（`by` 拟合手速、迟到告警、虚线底线）/ erase / cue / zigzag
- `styles/whiteboard/demo/engine/wb.js:270-292` —— penPose（跳笔抬升、IN 0.42/OUT 0.38 停车与飞回）
- `styles/whiteboard/demo/engine/wb.js:295-311` —— Camera（1/z 插值、五种 ease）与 applyCam/toScreen
- `styles/whiteboard/demo/engine/wb.js:314-335` —— noiseTile（干擦斑点）与 boardTile（擦痕）
- `styles/whiteboard/demo/engine/wb.js:338-421` —— Board 渲染（板面渐变、残影、multiply 墨层、destination-out 板擦与干擦纹理、窗影 0.35×、框/托）
- `styles/whiteboard/demo/engine/wb.js:425-486` —— drawMarker / drawEraser / drawPinMagnet
- `styles/whiteboard/demo/mix.py:25-44` —— marker：手速包络、2.2–7.5kHz 嘶声、粘滑颗粒、28% 干擦尖叫、笔尖落点
- `styles/whiteboard/demo/mix.py:45-47` —— tap
- `styles/whiteboard/demo/mix.py:54-63` —— magnet（830/1370/2210/3120Hz 金属模态 + 140Hz 板体闷响）与 magnet_off
- `styles/whiteboard/demo/mix.py:64-75` —— cap_pop / cap_on
- `styles/whiteboard/demo/mix.py:76-82` —— eraser（250–2600Hz、锯齿调制、rewind 用 9Hz 调制）
- `styles/whiteboard/demo/mix.py:83-99` —— plop / tray_clack / thud
- `styles/whiteboard/demo/mix.py:104-108` —— clock_tick（挂钟秒）
- `styles/whiteboard/demo/mix.py:114-127` —— 按事件放置 foley（stroke/write/dash/tap/magnet/erase/rewind/splash/tray/cap…）
- `styles/whiteboard/demo/mix.py:129-144` —— 笔飞入/飞出画框（>0.75s 间隔）与相机甩镜 whoosh
- `styles/whiteboard/demo/mix.py:146-153` —— 房间底噪 + 挂钟走秒
- `styles/whiteboard/demo/mix.py:155-165` —— VO（24k→48k、压缩、轻房间）
- `styles/whiteboard/demo/mix.py:167-181` —— 配乐 duck（−9dB、5ms 控制率）与进行曲倒带（drift.wav 倒放压缩进板擦行程）
- `styles/whiteboard/demo/mix.py:183-187` —— 静默段 43.55–46.42s 只有房间钟
- `styles/whiteboard/demo/mix.py:189-198` —— RMS 平衡（VO 顶、score −6.5dB、foley −11dB、limit）与分轨输出
- `styles/whiteboard/demo/music.py:1-4` —— 钟表式极简 120 BPM、D 大调/B 小调、两马林巴 phase ×140/130.5
- `styles/whiteboard/demo/music.py:20-45` —— 和声表、arp 8 分音型、groove（马林巴/pizz/木鱼/沙锤）
- `styles/whiteboard/demo/music.py:47-54` —— THEME（8 小节钟琴主题）
- `styles/whiteboard/demo/music.py:56-66` —— 开场 pickup 与 TITLE（0–14s 全主题）
- `styles/whiteboard/demo/music.py:68-73` —— 卫星段（钟琴 ping 跟随广播涟漪）
- `styles/whiteboard/demo/music.py:75-81` —— 延迟=距离（harp 跟随蓝色信号虚线下行、方程拨弦）
- `styles/whiteboard/demo/music.py:83-93` —— 三边定位（每个圆一段上行、「Right here」落定）
- `styles/whiteboard/demo/music.py:96-100` —— 甩镜落点 46.45（管钟第一声）
- `styles/whiteboard/demo/music.py:102-129` —— 相对论两马林巴 phase_layer（1.0 与 140/130.5）与 pad
- `styles/whiteboard/demo/music.py:131-146` —— 后果与漂移进行曲（每天一步、下行音阶）
- `styles/whiteboard/demo/music.py:148-153` —— 落水 splash 与鱼之问
- `styles/whiteboard/demo/music.py:155-166` —— 修正段 phase 回归与 fix 落定、snap 成齐奏
- `styles/whiteboard/demo/music.py:168-185` —— 终曲与 outro 主题
- `styles/whiteboard/demo/music.py:187-196` —— 渲染与 drift.wav（倒带用）
- `styles/whiteboard/style.json:16-17` —— frame_sec 55.5 / dur 111.0
