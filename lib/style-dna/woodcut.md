# 木刻版画（woodcut）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Bell Founder》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「版自己刻出来」的凸版印刷片：每一镜都是**一块黑木板**，光只存在于刀刻掉的地方，最多一种颜色、且只给那个「在燃烧」的东西。

**它不是**：铜版画（白底上鼓胀的雕线、从白地垒起的交叉线）、亚麻油毡海报（平涂色块）、把黑白照片跑一遍阈值滤镜（刻痕必须顺着形体走）。
（`STYLE.md:14`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「凸版印刷工艺的某个环节」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **印框** | 画面区嵌在纸边之内（demo 1920×1080，画面区 `36,36,1848×912`，底边 132px 纸边放图注）。**画面边缘 = 版边**：墨迹毛糙，绝不是干净矩形。 |
| **刀具分级** | Knife `k` 1.2–2（轮廓、分开黑形体与黑背景的白描边）；V-gouge `v` 2–8（排线、毛发、细光）；U-gouge `u` 10–22（光线、天空横扫、第一遍粗刻）；Stab `stab` r 3–8（雪、火星、土屑、木屑）。 |
| **排线（Doré 语法）** | **方向跟形体走**（圆被弧线包裹、坡顺落差线、火与光放射、布顺褶皱）；**宽度跟调子走**（亮 = 宽刻几乎连成白、中间调 = 细刻、暗 = 不刻）；远密细、近疏粗。每根线是独立的一刀（30–160px，钝入、收尖、崩口），绝不是连续机器线。 |
| **形体** | 黑剪影 + 白刀晕 + 只在受光边做掠射排线（光 z≈0.2，平面保持黑）。**皮肤刻白、五官留黑**（无字小说的规矩）。 |
| **特写** | 先雕一个小高度场（胶囊、团块、木板、褶痕），打光后跑 `woodcutFilter`，让刻痕顺着等照度线走。 |
| **印刷** | 掩膜（白 = 刻掉）过 WebGL2 合成器：刀口毛刺、±6% 上墨不匀、木纹条痕、没吃上墨的斑点、带固定套印错位的斑驳色版。block 模式：有光泽的着墨木面 + 纹理反光，凹槽里是浅色木。 |
| **色版** | **至多一块**，只印在刻白处，所以它从刻痕里发光、绝不落在黑上；高潮时铺满、之后收缩成一个高光。 |

**关键取向**：`STYLE.md:10` 强调「黑是木、白是刀刻掉的」；`STYLE.md:28` 强调短排线段带调子摆动会变成锯齿人字，所以要用**长刻**（14–50 × 间距）+ 一条宽亮带 + 一圈细边光。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位沉默的雕版师讲一个民间传说。第三人称、过去时，低沉平实，像**图注被念出来**；版画承担其余的一切。

**长度（实测）**：旁白**极少**（demo 只有 4 句，见 `lines.json`）。字幕是**纸边里的活字**（画面之外），IM Fell English ~40–44px，墨色，过同一道印刷 shader；墨水 0.1s 上来、不滑动、0.15s 淡出；停留 ≥ max(1.8s, 语音时长 + 0.6s)。句与句之间可以整段静默。

**句首类型**（示例性，不是抄原文）：
- 时间状语起句：`That winter, …`
- 因果连词起句、把画面留给版：`So every house gave what metal it had.`
- 具体的人 + 具体的物件：`The boy gave his compass, the one thing that always guided him home.`
- 「当……时」收束全片：`When it rang, the snow stopped to listen.`
- （可选）**完全无字的版**：用连续独立画面讲故事

**这个风格里不会出现的句式**：
- 第一人称抒情、网络口播腔、感叹号堆叠
- 抽象概念当主语（只谈能被刻出来的实物、动作、位置）
- 一句塞多个并列信息点（一句只承担一层）
- 把字幕压在画面上（图注只能活在纸边里）

---

## 3. 叙事节奏

**结构**：一叠**独立的版**（无字小说的排序法）——
黑暗里的第一刀（地平线）→ 世界被刻出来 → 第一张印品被揭起（镜像→正像）→ 一段长的手部特写 → 小供品快剪蒙太奇 → 第一次尝试**在特写里失败** → 一块静默的版 → 一次个人牺牲 → 第二次尝试、色版淹没画面 → 最长的静默 → 回报的那一声 → 颜色收缩成一个高光 → 白点被「上墨补回」→ 最后一刀又是那条地平线。
每块版自成一幅、可以完全无声。

**节拍（实测，`timeline.json` 是唯一真源）**：0–3s 自由无乐；3–23s = **60 BPM**；23–32.3333s = **90 BPM**（经 3:2 度量调制：60 的三连八分 = 90 的八分），音乐在 **28.3333s 一刀切死**、静默到 32.3333s；32.3333–36.3333 = 60 BPM；36.3333–44.3333 = 90 BPM（43.0–44.3333 淡出）；44.3333–47.3333 = **数字静默**；47.3333–48.3333 只有钟；48.3333–58.5 = 60 BPM（弦乐在钟的余韵里）。动作：角色 **on twos（12fps）**，镜头/粒子/火/光 **on ones（24fps）**；每次关键动作走「预备 / 动作 / 跟随」；一记硬切 = 一次新印张（2 帧套印错位）。

**总长**：主 demo **58.5s**（`style.json` dur=58.5，frame_sec=49.14）；`DEMO.md:8` 记录该 demo 是照「**40–60 秒**的木刻版画片」这个 brief 做的。

**静默政策**：两段**真实的静默**——29.7–32.3s（−40dB，只剩远处的风；其后的第一个声音是罗盘盖的 *click*）与 44.3–47.3s（**数字静默**，实测 −91dB；其后的第一个声音是钟，全片最响的一刻）。钟之前全片不许有任何钟的音色——村子「没有嗓子」，所以第一声钟就是高潮。

---

## 4. 镜头逻辑

**相机是什么**：一把刀（**the knife is the camera**）——焦点永远是刀尖，或稍后那道最亮的刻痕；镜头在纸上移动，**纸边永远不动**。

| 运动 | 表达 | 可以服务 |
|---|---|---|
| 跟随刀尖 | 制作中；这条线就是故事 | 第一刀；地图上画的一条路线；一个签名 |
| 随刻痕铺开连续拉远 | 一条线变成一个世界；尺度 | 从一条街到一座城；一棵家谱；一段消息能传多远 |
| 锁死机位 | 无字小说的某一页；阅读时间 | 一个决定；一幅肖像；后果 |
| 对雕好的特写缓慢微距推进 | 耐心、触感、劳作 | 在工作中的手；一件工具；一封正被读的信 |
| 急推并停住 | 冲击；那个打破一切的细节 | 一道裂缝；一个错的数字；转过去的一张脸 |
| 框中之框（门/窗/拱） | 距离、排斥、等待 | 门外的村民；一间病房；一条边界 |
| 踩拍点的硬切，每记都是新印张 | 累积；一串印品 | 供品；日子流逝；一串名字 |
| 从细节升起到整体 | 后果 | 洪水到达村庄；光照到一张张脸上 |
| 经揭纸在两块版之间切换 | 一种状态印在另一种之上 | 之前/之后；一个守住的诺言；几代人 |

**允许的转场**：
- **硬切 = 一次新印张**（2 帧套印错位后归位）
- **揭纸转场（the peel，本风格唯一的连续转场语法）**：滚筒滚墨（一道湿亮横扫）→ 纸落下 → 马楝螺旋擦、图像透过来 → 纸沿一个圆柱朝镜头掀起，先重后快，背面透出镜像的 show-through

**禁止**：
- 叠化（dissolve）——只允许硬切或揭纸
- 让画面淡入/滑入——图像只能被「刻」出来
- 让纸边动（纸边永远不动）
- 灰对灰（只能是黑块压白、或白压未刻的黑）
- 把文字放进画面里（文字只能在纸边）

---

## 5. 惯用手法（idioms）

- **光是被刻出来的**：从一个点爆出的放射状刻痕。
- **雕刻即时间**：屏幕上耐心地一刀一刀地干活。
- **镜像的版 → 真正的印品**：一个倒着的词在纸被揭起时读通。
- **Stab 刀当纹理**：白点可以凝在半空，也可以被「上墨补回」直到黑干净。
- **那块唯一的色版会蔓延又收回**：高潮时铺满、之后收缩成一个高光。
- **把一座雕塑或一帧画面过 `woodcutFilter`** 变成顺形体的刻痕。
- **无字小说式排序**：自成一幅幅的版，少句或无语，句与句之间可以整段静默。

---

## 6. 氛围

一间雪封的村子与一座空钟楼：黑墨、暖米色纸、木的冷；刀口、木屑、马楝的摩擦。气质是「**沉、耐心、手工**」，情绪藏在刀口方向里，而不是表情里。

---

## 7. 声音

**乐器**：
- 低弦（低音提琴、大提琴；spiccato、pizzicato，**中提琴只在钟响之后才进**）
- 木与皮（log drum、木鱼、框鼓）、gran cassa、定音鼓、**一面** tam-tam、合成敲击金属（模态：3–5 个非谐分音 + 锤击瞬态）
- 民间色彩可选：拉锯琴或轮擦提琴的持续音

**foley（按材质合成）**：刀入木（瞬态 + 与刀速绑定的带通纤维撕裂）、木屑、滚筒粘滞、纸的空气、马楝沙沙、湿揭纸；金属按大小（大=低、小=高而纯）；共振物用模态模型加回声做距离。demo 特有：黄铜供品按大小定音、陶土刮擦与碎裂、风箱皮革 + 气流、熔融气泡、浇注轰鸣、入模嘶声；**钟是一套模态模型**（hum 0.5、prime 1、tierce 1.2、quint 1.5、nominal 2, 2.5, 3, 4，各自衰减与拍频）+ 两条山谷回声。

**混音规则**：音乐在旁白下压 ~8dB（钟后 6dB）、在关键 foley 下压 4dB；**foley 也要给人声让路**（−5dB，若某记金属敲击与人声共拍则 −9dB）；把刺耳的瞬态推离正中。**−14 LUFS**。J/L 切携带声音跨版与跨揭纸（火声先进手部镜；户外风闷着带进作坊；风带着揭纸进钟楼；钟的余韵压着结尾卡）。

---

## 8. 变化空间

你可以自由决定：故事、人物（或没有人物）、每一块版、开场、结尾、镜头路径、节奏、以及那唯一的颜色给谁。

`STYLE.md:112-116` 明确列出**远离 demo** 的选择：

- **结构**：一本**日课书**（七块锁死的版、每个时辰一块、版内无运动）；**同一块版反复重刻**（每一场刻得更深、图像随木头的减少而改变）；**两块版轮流印**（两个地方交替出印品、直到一张纸上同时承载两者）。
- **开场**：**挂在墙上的一幅成品**（再回到版里看它是怎么刻的）；**一张白纸**（一块着墨的版压上去：第一幅图整块地到来）；顺着**木纹**让它变成水或田野、第一批刻痕跟着它走。
- **结尾**：**被清洗干净的版**（墨被洗掉、只剩浅色的刻过的木）；**一叠印品**（在同一块版的许多张纸上不断升起）；**一个没刻到的角**（停在刀从未到达的黑木上）。

---

## 9. 禁忌清单

- 在白色区域刻白色记号（看不见）——stab 刀痕背后必须有暗块。
- 给每个面都排线（看起来像毛或雨）——掠射光；只在受光边刻 3–6 刀。
- 黑脸配白刻痕、做小了读不出来——皮肤白、五官黑、白色部分加一圈黑保留线。
- 手绘的特写道具像手套和团块——用高度场 + `woodcutFilter`。
- 短的排线段带调子摆动会变成锯齿人字——用长刻（14–50 × 间距）、一条宽亮带、一圈细边光、更强的白晕。
- 把蒸汽/烟画在主体之上会被读成火焰——画到后面去，只让几缕从边缘逸出。
- 在镜头之间偷懒共享缓存的刻痕，会让帧依赖渲染 worker——每个缓存首次使用时自建。
- 细排线 + 上墨噪声 + 颗粒把文件撑大——用更高 CRF 配 `-tune grain`，并看 1:1 裁切；`woodcutFilter` 在平区出现 NaN → `sqrt` 前先 clamp。
- 直接照抄 demo 的故事、叙事弧、镜头、道具或时长；结尾卡里的 LemoLab 署名只属于本库 demo，用户成片不带。

---

## 10. 素材契约（换主题时必须遵守）

### 10.1 内容字段表

- `lines.json`：每一句旁白 `{id, text, voice, speed}`（demo 只有 4 句、voice `am_onyx`、speed 0.88）。
- `voices/dur.json`：每句时长（字幕停留 = max(1.8s, 时长 + 0.6s)）。
- `timeline.json` 是**唯一真源**：
  - `grid`：每个乐段 `{id, t0, t1, bpm}`；
  - `keys`：每个画面/声音锚点的秒数（`knife_first / carve_* / ink_roll / peel / print_land / L1–L4 / furnace / glow / pour1 / smash / clunk / silence1 / click / compass_drop / bellows2 / pour2 / rays2 / reveal2 / pull2 / silence2 / bell / echo1 / echo2 / endcard …`）。
- 画面内容由 `shots.js` / `shots2.js` 里每镜的 `draw` 现场生成。

### 10.2 新主体契约

新主体 = 一组「刻痕」。必须做三件事：

1. 用 `WC.shape(polys, {light, sp, halo, dir, tone, lo, hi, kind, seg, reveal})` 雕一个实心块（黑剪影 + 白刀晕 + 顺形体排线），或用 `cutAlong` / `hatch` / `flecks` / `rays` 造轮廓、区域排线、stab 白点、放射光；
2. 把结果画到**掩膜**上：`shape.draw(m, t)` 或 `WC.drawStrokes(m, strokes, {t, color})`（白 = 刻掉、黑 = 留木；`color:'#000'` 用来「补墨」把已刻区域重新填黑）；
3. 可选的颜色版：`WC.plate(c, polys, a)`——它只在掩膜被刻白的地方显色，**绝不能落在黑上**。

特写走高度场：`hands.js` 的 `Sculpt`（capsule / blob / plank / creases）→ `shade(light)` → `woodcutFilter`。每一块可复用的刻痕缓存必须**首次使用时自建**，保证跨 worker 确定性。

### 10.3 时间线契约

`demo/film.js` 导出 `init(g, qs)` 与 `render(g, t)`：

- `init`：读 `timeline.json`（DUR=58.5）、加载 `voices/dur.json`、建 printer 与 4 个缓冲画布、由 `lines.json` 生成 `SUBS`（`t0 = K[id]−0.05`，`t1 = t0 + max(1.8, dur+0.6)`）、把每镜的 `events(K)` 汇总进 `EV` 并按时间排序；
- `render(g, t)`：找到覆盖 t 的那一镜并调 `s.draw(g, t, t − s.t0)`；
- 每一镜是 `{ t0, t1, draw(g,t,lt), events(K) }`；`draw` 内部调 `H.printFrame(g, t, cam, drawFn, opts)`（或 `blockFrame`）把掩膜 + 色版印成画面。

页面契约由 `main.js` 暴露 `window.READY / window.render(t) / window.DUR / window.EV`。

### 10.4 事件词汇表（type → 消费者）

| type | 载荷 | 消费者 / 效果 |
|---|---|---|
| `knife_bite` / `knife_run`{dur} / `knife_flick` | — | 刀口：入木瞬态、纤维撕裂、挑刀 |
| `gouge_u` / `gouge_v` | — | U 形 / V 形凿 |
| `carve_fine`{dur} / `carve_title`{dur} / `stab` | — | 细刻 / 标题刻 / stab 白点 |
| `brayer`{dur} / `paper_lay` / `baren`{dur} / `peel`{dur} / `paper_land` | — | 滚墨 / 落纸 / 马楝 / 揭纸 / 纸落地 |
| `beam_creak` / `clay_rasp`{dur} | — | 梁响 / 陶土刮擦 |
| `gift_pot｜candle｜keys｜ring｜spoon｜bracelet` | — | 各按大小定音的黄铜供品 |
| `cloth_grip` / `bellows` / `fire_roar`{dur} / `molten_bubble`{dur} | — | 抓布 / 风箱 / 炉火 / 熔融气泡 |
| `tongs_clank` / `pour`{dur} / `sizzle`{dur} / `sparks`{dur} | — | 钳响 / 浇注 / 入模嘶声 / 火星 |
| `whoosh` / `mould_smash` / `debris`{dur} / `dust`{dur} | — | 挥击 / 模具碎裂 / 碎屑 / 尘 |
| `clunk` / `crack`{dur} | — | 钟的闷响 / 裂缝 |
| `compass_click` / `throw_whoosh` / `compass_drop` | — | 罗盘盖 / 抛出 / 落入 |
| `rays_carve` / `steam`{dur} / `ink_dot` | — | 放射刻痕 / 蒸汽 / 把白点补回的点墨 |
| `amb_wind` / `amb_forge` / `wind_muffled` / `far_wind`{dur} | — | 环境风 / 炉床 / 闷风 / 远风 |
| `vo` | `{id}` | 人声 |

全部由各镜的 `events(K)` 产生，再由 `core/render/events.mjs` 序列化成 `events.json`。

---

## 11. 构建链

`demo/build.sh` 全流程（`sh styles/woodcut/demo/build.sh`，任意目录）：

1. `core/tts/tts.py`：Kokoro 配音（`am_onyx` 0.88，4 句）→ 2. `core/tts/asr_check.py`：whisper 逐句校对 → `words.json`；
3. `music/score.py`：读 `timeline.json` → `music/score.wav` + stems + `score.json`；
4. `node core/render/events.mjs`：画面事件 → `events.json`；
5. `tools/cuecheck.py`：配乐卡点 ↔ 画面事件 ↔ 时间线对齐自检（含两段静音）；
6. `mix.py`：按材质合成的拟音 + 环境 + 旁白 + 配乐闪避 + 两段静音 + 钟 → `mix.wav`；
7. `tools/subs.py`：字幕 → `woodcut.srt`；
8. `node core/render/video.mjs --fps 24 --workers 4`：逐帧渲染（4 workers 约 45s / 1404 帧）；
9. `tools/mux.sh … 24 6`：合成（−14 LUFS、颗粒 6、CRF 28）；
10. `tools/final_asr.py`：成片 whisper 抽查；
11–13. `still.mjs` 出风格帧、海报、引擎最小示例。

---

## 12. 证据（`file:line`）

- `styles/woodcut/STYLE.md:6-14` —— 本质三条硬规则与「不是什么」（黑是木、白是刀刻掉的；图像是被刻出来的；版是镜像）
- `styles/woodcut/STYLE.md:16-31` —— 材料与渲染（印框、刀具宽度表、Doré 排线语法、皮肤白五官黑、高度场特写、WebGL2 印刷）
- `styles/woodcut/STYLE.md:33-38` —— 颜色逻辑（近黑 + 暖纸两值；至多一块色版、只印在刻白处、给唯一重要的东西）
- `styles/woodcut/STYLE.md:40-44` —— 字体与字幕（纸边活字 IM Fell English ~40–44px、0.1s 上/0.15s 下、停留 ≥max(1.8s,语音+0.6s)、标题是被刻的）
- `styles/woodcut/STYLE.md:46-53` —— 运动质量（角色 12fps、镜头/火/光 24fps、预备-动作-跟随、逐刀揭示 0.08–0.35s、硬切=套印错位、揭纸转场、纸边不动）
- `styles/woodcut/STYLE.md:55-71` —— 镜头语法表与转场规则（硬切/揭纸、绝不叠化）
- `styles/woodcut/STYLE.md:73-81` —— 声音调色板（乐器、按材质合成 foley、静默是工具、J/L 切、foley 也给人声让路、−14 LUFS）
- `styles/woodcut/STYLE.md:83-93` —— 原生动作菜单（光是被刻的、雕刻=时间、镜像版→真印品、stab 当纹理、唯一色版蔓延与收回、filter 一尊雕塑、无字小说排序）
- `styles/woodcut/STYLE.md:95-104` —— 媒介陷阱（白刻白、排线过密、黑脸读不出、手绘道具像手套、短排线变锯齿、蒸汽被读成火、缓存共享破坏确定性、文件体积与 NaN）
- `styles/woodcut/STYLE.md:106-108` —— 引擎清单（shape/cutAlong/hatch/flecks/rays/drawStrokes/plate/woodcutFilter/makePrinter）
- `styles/woodcut/STYLE.md:110-116` —— 变化空间（日课书/同版重刻/两版轮流；三种开场；三种结尾）
- `styles/woodcut/DEMO.md:3` —— 「不要复用它的故事、叙事弧、镜头、道具或时长」
- `styles/woodcut/DEMO.md:10-25` —— demo 故事结构与原生能力用法（黑暗第一刀→世界→第一印→手→供品→失败→静默→牺牲→色版淹没→静默→钟→颜色收缩→白点补回→最后一刀）
- `styles/woodcut/DEMO.md:27-46` —— 逐拍镜头表与动作时长（3.5×→1× 拉远、4s 微距、硬切加速 1/1/1/.5/.5/.25/.25、0.2s 急推、8×→1× 拉远）
- `styles/woodcut/DEMO.md:48-55` —— 配乐结构（60→90 BPM 3:2 度量调制、钟前无钟音色、两段真实静默 29.7–32.3 与 44.3–47.3、J/L 切、混音 8/6/4dB、foley −5/−9dB、am_onyx 0.88 4 句）
- `styles/woodcut/DEMO.md:57-62` —— 色值与道具（ink `#111111` / paper `#EFE8D8` / wood `#D8C29C` / copper `#C8502A`、画面区 36,36,1848×912、132px 纸边、3px 套印错位、道具清单、字幕 IM Fell English 42px）
- `styles/woodcut/DEMO.md:64-66` —— 结尾卡（标题镜像刻进版、结尾是一张新印品、小钟保留铜高光、LemoLab 署名仅本库）
- `styles/woodcut/DEMO.md:68-95` —— 构建链与陷阱（timeline 先行、先做引擎与风格帧、build.sh 全流程、两段静默自检、雪在白上不可见、锯齿人字、蒸汽、缓存、金属声盖住旁白、CRF 28 -tune grain、结构张量 NaN）
- `styles/woodcut/DEMO.md:97-139` —— 引擎参考表与最小示例（shape/cutAlong/hatch/flecks/rays/plate/woodcutFilter/makePrinter 选项与 filter 用法）
- `styles/woodcut/demo/film.js:9-10` —— W=1920 / H=1080 / DUR=58.5 / EV / SUBS
- `styles/woodcut/demo/film.js:14-29` —— init（读 timeline.json、voices/dur.json、建 printer 与 4 缓冲、4 句 VO、SUBS t1=t0+max(1.8,dur+.6)、汇总各镜 events）
- `styles/woodcut/demo/film.js:32-41` —— captionAt（0.1s 上/0.15s 下）与 render（按 t 找镜）
- `styles/woodcut/demo/timeline.json:1-25` —— 唯一真源：dur 58.5、七段 grid（含 90 BPM 与两段静默）、全部 keys
- `styles/woodcut/demo/stage.js:5-10` —— W/H/IMG（36,36,1848×912）/M/C/printer
- `styles/woodcut/demo/stage.js:12-32` —— camMatrix / begin（纸铺满后裁到画面区、mirror 支持）/ end
- `styles/woodcut/demo/stage.js:34-47` —— caption（纸边活字画在掩膜上一起被印）与 print
- `styles/woodcut/demo/shots.js:19-31` —— printFrame 与 jolt/regJolt（硬切=2 帧套印错位）
- `styles/woodcut/demo/shots.js:33-63` —— blockFrame 与 table（着墨的版在木桌上、投影、亮倒角）
- `styles/woodcut/demo/shots.js:66-117` —— S1–S2：第一刀（地平线）、标题被刻、stab 雪、山谷被刻
- `styles/woodcut/demo/shots.js:119-220` —— S3 滚墨/落纸/马楝/揭纸 与 S4 第一张印品（镜像→正像）
- `styles/woodcut/demo/shots2.js:13-19` —— CUT_C=31.9167、st12（角色 on twos）与 FLIP/NORM
- `styles/woodcut/demo/shots2.js:25-51` —— S5 手部特写（高度场 → woodcutFilter，`down`/`light` 两种 reveal）
- `styles/woodcut/demo/shots2.js:53-100` —— S6 供品快剪（每个动作一个声、一刀，手从上方伸入）
- `styles/woodcut/demo/shots2.js:118-154` —— S7 炉子与第一次颜色（推近坩埚、色版首次出现、浇注 + rays）
- `styles/woodcut/demo/shots2.js:156-190` —— S8 模具被砸（0.2s 急推 + 3 帧镜头抖）与裂缝爬升
- `styles/woodcut/demo/shots2.js:192-218` —— S9 静默：门口的村民（框中之框、只有雪在动）
- `styles/woodcut/demo/shots2.js:220-280` —— S10 罗盘（开盖 → click → 决定 → 抛出 → 落入坩埚）
- `styles/woodcut/demo/shots2.js:282-324` —— S11 第二次浇注（2.4→1.18 拉远 + 60 条放射刻痕 + 色版 flood）
- `styles/woodcut/demo/shots2.js:325-339` —— S12 完整的钟（蒸汽画在钟后、只让几缕逸出）
- `styles/woodcut/demo/shots2.js:357-412` —— S13 翻页（揭纸到钟楼）与 S14 最长的静默（两只手在绳上、5.2× 到钟）
- `styles/woodcut/demo/shots2.js:414-435` —— S15–16 钟响（5.2×→1× 连续拉远、铜色从整个山谷收进钟里、白点被 ink_dot 补回）
- `styles/woodcut/demo/shots2.js:437-482` —— S17 结尾卡（黑版面板里刻出标题、活字署名、最后一刀）
- `styles/woodcut/demo/trans.js:10-58` —— curl（纸沿圆柱掀起：升起/顶部/翻面三段、明暗按面向镜头的角度、卷边亮线）
- `styles/woodcut/demo/trans.js:60-67` —— peelState（带重量的纸：慢起、中间大卷、末尾一翻）
- `styles/woodcut/demo/world.js:5-8` —— PW/PH 1848×912、HOR=560（第一刀）、TOWER/BELFRY
- `styles/woodcut/demo/world.js:10-14` —— 冷光 L_MOON 与 carve 模式下的 reveal 包装
- `styles/woodcut/demo/world.js:57-107` —— buildWorld（天空横扫、山脉逐峰雕、雪原刻白、雪堤、脚印、房屋、钟楼、松树、雪层种子）
- `styles/woodcut/demo/world.js:134-145` —— snowAt（雪按 12fps 步进，像被重印）
- `styles/woodcut/demo/hands.js:7-68` —— Sculpt 高度场（capsule/blob/plank/creases/noise/shade）
- `styles/woodcut/demo/hands.js:70-118` —— founderHands（木板的旧手 + 陶土面，掠射光）
- `styles/woodcut/demo/hands.js:120-188` —— boyCompass（男孩手掌托罗盘，open/half/shut/grip 四态）
- `styles/woodcut/demo/interior.js:38-48` —— fire（炉口的火每 2 帧重刻一次，活的火）
- `styles/woodcut/demo/interior.js:50-60` —— drawWorkshop（墙板、梁、工具、炉、地、模具与绳箍）
- `styles/woodcut/demo/interior.js:63-77` —— crucible（可倾斜的坩埚、熔面与色版高光）
- `styles/woodcut/demo/interior.js:78-94` —— stream（熔流：白刻 + 铜色版 + 12fps 抖动的流线）
- `styles/woodcut/demo/interior.js:95-104` —— sparks（放射状 stab + 铜色版）
- `styles/woodcut/demo/interior.js:106-119` —— mouldBreak（模具碎成一块块飞散）
- `styles/woodcut/demo/interior.js:120-129` —— steam（12fps 重刻的白卷，画在主体之后）
- `styles/woodcut/demo/fx.js:10-60` —— bell（Doré 环绕排线、亮带 + 细边光、裂缝与分支、clapper）
- `styles/woodcut/demo/fx.js:62-81` —— bellows（皮革褶皱、开合角度）
- `styles/woodcut/demo/fx.js:83-117` —— GIFT/drawGift/heap/crucibleTop（黄铜供品与堆积的金属堆）
- `styles/woodcut/demo/fx.js:127-144` —— villager（四种雕刻剪影的村民，可低头/翻转）
- `styles/woodcut/demo/fx.js:146-157` —— rings（声音：雕刻的同心环向外扩散）
- `styles/woodcut/demo/engine/index.js:16` —— INK `#111111` / PAPER `#EFE8D8` / COPPER `#C8502A` / WOOD `#D8C29C`
- `styles/woodcut/demo/engine/index.js:30-55` —— cutAlong（把路径断成手工刻的刀痕，seg/gap/reveal）
- `styles/woodcut/demo/engine/index.js:57-65` —— flecks（stab 白点：雪、火星、木屑）
- `styles/woodcut/demo/engine/index.js:67-82` —— rays（放射状刻痕 = 被刻出来的光）
- `styles/woodcut/demo/engine/index.js:84-108` —— shape（黑剪影 + 白晕 + 顺形体排线，light/dir/tone/white/reveal）
- `styles/woodcut/demo/engine/index.js:110-115` —— plate（唯一色版，只在刻白处显色）/ ellipse / rect
- `styles/woodcut/demo/engine/knife.js:15-21` —— mkStroke（中心线 + 逐点宽度 + 刀型 + 揭示时间）
- `styles/woodcut/demo/engine/knife.js:49-60` —— prof（四种刀型的宽度剖面）
- `styles/woodcut/demo/engine/knife.js:64-96` —— strokePath（把一刀刻到进度 pr，含实时刀尖与崩口）
- `styles/woodcut/demo/engine/knife.js:98-110` —— progOf（刀带缓入）与 drawStrokes（一次填完多刀，返回刀尖）
- `styles/woodcut/demo/engine/knife.js:121-129` —— chip（刀尖卷起的木屑，只在 block 世界）
- `styles/woodcut/demo/engine/hatch.js:30-67` —— Region（栅格化 + 精确距离场 + 膨胀法线）
- `styles/woodcut/demo/engine/hatch.js:76-92` —— light / reliefTone / dirAngle / dirRadial / dirRing / dirContour
- `styles/woodcut/demo/engine/hatch.js:97-178` —— hatch（流线排线：方向场 + 调子定宽、断成刀痕、reveal 排序）
- `styles/woodcut/demo/engine/print.js:11-65` —— 印刷/版面的 fragment shader（毛边、上墨不匀、木纹、斑点、色版错位与斑驳、block 模式的槽与反光）
- `styles/woodcut/demo/engine/print.js:68-101` —— makePrinter（WebGL2，render(mask, color, {mode, seed, inkSeed, reg, edge, sheen, wetX, plate})）
- `styles/woodcut/demo/engine/filter.js:23-74` —— woodcutFilter（亮度定刻宽、结构张量定方向、levels、reveal light/radial/down）
- `styles/woodcut/demo/mix.py:39-59` —— knife_bite/knife_run/gouge/stabs/fine_scratch（刀与木）
- `styles/woodcut/demo/mix.py:60-74` —— brayer/paper_lay/baren/peel/paper_land（纸与墨）
- `styles/woodcut/demo/mix.py:76-133` —— clay_rasp、GIFTS（pot/candle/keys/ring/spoon/bracelet 各按大小定音）、bellows、fire、bubbles、clank、pour、sizzle、smash、debris、clunk、crack、compass_click/drop
- `styles/woodcut/demo/mix.py:134-164` —— rays、steam、wind、ink_dot、big_bell（hum/prime/tierce/quint/nominal 等分音）、reverb
- `styles/woodcut/demo/mix.py:166-216` —— 按事件放置 foley（含 gift_/bellows/fire_roar/molten_bubble/tongs_clank/pour/sizzle/sparks/whoosh/mould_smash/debris/dust/clunk/crack/compass_*/rays_carve/steam/ink_dot）
- `styles/woodcut/demo/mix.py:218-231` —— 环境床（房间+风、山谷雪、门外的风 L 切、炉床 J 切）、钟 + 两条山谷回声
- `styles/woodcut/demo/mix.py:233-243` —— 旁白（am_onyx 4 句、归一化、轻混响）
- `styles/woodcut/demo/mix.py:244-268` —— 配乐 duck（人声 0.40/钟后 0.5、关键 foley 再让 0.35）、foley 也让人声（共拍金属 −0.65）、两段真实静默与收尾
- `styles/woodcut/demo/music/score.py:1-11` —— 配乐总纲（低弦+木皮+定音鼓+一面 tam-tam+合成铁砧；钟前不许有钟音色；D 小调→钟后 D 大调；动机 A）
- `styles/woodcut/demo/music/score.py:26-48` —— 读 timeline.json（唯一真源）、snap 到精确三分之一、各段 BPM 与拍长
- `styles/woodcut/demo/music/score.py:136-171` —— 合成铁砧（非谐分音比 1/2.76/5.40/8.93/13.34 + 锤击瞬态 + 铁的低沉体声 + 40ms 金属抖动）
- `styles/woodcut/demo/music/score.py:173-282` —— C1–C5 各段（弦乐动机、心跳框鼓、供品拨弦、炉段铁砧 ting-ting-TANG、smash 的 C 和弦、28.3333 一刀切死）
- `styles/woodcut/demo/music/score.py:284-371` —— C8–C9（脆弱的大提琴动机、铁砧 16 分、37.667–39.0 滚奏、39.0 低弦 ff + 唯一一面 gong + 大铁砧）
- `styles/woodcut/demo/music/score.py:373-404` —— C12（钟的余韵里弦乐进来、D 大调、管钟与手铃回声钟、55.0 终止和弦）
- `styles/woodcut/demo/music/score.py:406-440` —— 混响、静默门（0–3.0 / 28.3333–32.3333 / 44.3333–48.3333 硬零，钟族在 48.3333 前强制为零）、导出 stems 与 score.json
- `styles/woodcut/demo/music/score.py:442-467` —— 乐器 credits 与自检（峰值/RMS/静默窗口/onset 对齐）
- `styles/woodcut/demo/build.sh:1-18` —— 完整构建链（TTS→asr→配乐→events→cuecheck→mix→srt→逐帧→合成→成片 ASR→风格帧/海报/引擎示例）
- `styles/woodcut/demo/lines.json:1-6` —— 4 句旁白（am_onyx 0.88）
- `styles/woodcut/demo/events.json:1` —— 画面事件表（knife/gouge/carve/brayer/paper/baren/peel/gift/bellows/pour/smash/clunk/crack/compass/rays…）
- `styles/woodcut/style.json:16-17` —— frame_sec 49.14 / dur 58.5
