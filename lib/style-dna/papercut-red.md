# 红色窗花剪纸（papercut-red）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Nian Comes to Town》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「剪出来的」纸片动画：**每一个可见之物都是一张被剪刀剪过、平铺在另一张纸上的纸**；没有绘画、没有渐变阴影、没有描边线，细节、体积和表情全部来自「剪掉了什么」。红纸是主角材料，底纸也是纸，人物是关节剪纸，以 12fps 硬步进表演。

**它不是**：皮影（没有背光幕布、没有半透明驴皮、没有签子）；平面矢量插画（没有描边、没有渐变）；纯剪影片（每个形状内部都是镂空的）。
（`STYLE.md:10`）

---

## 1. 材料与渲染的硬规则

这是这个风格最不可让步的部分。任何画面元素都必须能被解释成「一张被剪过、被光照过或投过影的纸」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸即世界** | 每个「片」内部叠一层中性灰纹理（`soft-light`：染料斑驳、纤维、斑点，±7% 约 130px），再用 `destination-in` 还原原 alpha，镂空依旧是镂空。 |
| **刀口** | 轮廓是带低频抖动的折线（`edge wobble ≈0.35` 单位）；左上一条 1px 亮边、右下一条 1px 暗边。建筑/机械用直线段 + 抖动，绝不圆滑（平滑会把房子变成面包）。 |
| **纸的厚度** | 每片在下一层投紧而软的影（偏移 2.6/3.6px、模糊 5px×zoom、`rgba(52,6,10,.38)`）；叠起的折纸露 2–6 条错开深色边。 |
| **红块 + 阴刻线** | 每片刻一条内刻线（轮廓内侧 3.5 单位处、宽 1.5 单位）：经典双线轮廓，同时分开红压红的部件。 |
| **剪纹词汇** | `motifs.js`：锯齿纹 `sawRow/sawEdge`、月牙纹 `crescent/crescentRows`、旋涡纹 `swirl/doubleSwirl`、云纹 `cloudCut`、团花 `rosette`、梅花孔 `plum`、铜钱孔 `coin`、锥形刻线 `cutTaper`。 |
| **不留孤岛** | 封闭环剪下来会掉心。眼睛 = 上下两道月牙（留桥）+ 一个瞳孔孔；脸永不变形，表情靠可换脸片。 |
| **团花（tuanhua）** | 只设计一个 45° 楔形，镜像 8 次（D4）；阳刻与阴刻交替成环；折痕留一道浅线。 |
| **光** | 正面受光时纸就是纸；夜里 = 画面 × 光照图 + 暖光池，再加自发光背光片（`multiply`，孔处全亮）；两级辉光（10px/40px，强度≈0.55）。 |
| **投影纹样** | 孔的蒙版压扁投到地面用 `lighter` 叠加；落在人物身上时用图层 alpha 遮罩，叠在实心暖斑上，剪出的五官仍读成孔。 |
| **背光透射** | `transmitOf`：纸处 = 透射色 `#e0401c` 带厚薄斑驳，镂空处透明；`multiply` 画在光场上 → 纸 = 光×透射、孔 = 原光。 |

**关键取向**：`STYLE.md:19` 强调「不留孤岛」——真纸剪不出悬空的中心，所以每处镂空都必须有桥连着。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位温暖的奶奶在除夕夜讲故事。第三人称、过去时为主。口语、亲切、带年节的郑重。

**长度（实测）**：单句 **32–74 字符**（约 6–13 英文词）。最短是惊呼句 `Crackle, bang! And away ran Nian.`（32），最长是「三怕」清单句（74）。字幕是一条**纸横批**：Fraunces SemiBold 44px、奶油字 `#fff1d6`、距底 70px、居中，条宽按文字实测 +150px，最多两行。停留 ≥ `max(1.8s, 语音时长 + 0.7s)`。

**句首类型**（示例性，不是抄原文）：
- 时间/节令起句：`Every New Year's Eve, …`
- 具体动作短句钩子：`One by one, the village put out its lights.`
- 转折连词点题：`But Nian fears three things: …`
- 拟声 + 短动作收束：`Crackle, bang! And away ran Nian.`
- 结尾把故事接到当下：`That is why, every New Year, we still …`

**这个风格里不会出现的句式**：
- 第一人称抒情 / 内心独白
- 网络口播腔、感叹号堆叠、营销话术
- 抽象概念当主语（只谈能剪出来、能光照出来的实物）
- 一句塞两个以上并列信息点

---

## 3. 叙事节奏

**信息投放顺序**（一次「用剪纸的手艺解决问题」的民俗叙事）：

```
冷开场（剪刀咬红纸 → 纸飞走露出宣纸）
  → 片名剪字 + 锯齿轮横幅 + 印章
  → 平静的世界（夜村、窗花）
  → 威胁（远山立起成年兽的背；灯一盏盏灭）
  → 无声的抉择（年兽的眼睛挤进窗格；女孩从怕到定）
  → 折—剪—展（在强拍上）
  → 图案变成光并修复世界（背光团花投影、八盏灯笼飞向八扇窗、纸屑变爆竹）
  → 黎明（夜纸揭起露出昼纸、金箔太阳）
  → 尺度揭示（整片其实是木窗上的一张团花）
  → 片尾卡
```

**时间挂在 120 BPM、2/4 网格上**：1 拍 = 0.5s，1 小节 = 1.0s。

| 层 | 停留规则（`story.js`） |
|---|---|
| 关键锚点 | snips .25/1.0/1.75；title 3.0；village 7.0；rise 12.0；room 17.0 |
| 折 | folds 24.0 / 25.0 / 26.0（每折 ≈0.55s，一次木鱼） |
| 剪 | cut0 26.5 → cut1 29.4，每 0.25s 一刀（= 一个八分音符），揭示圆半径 r≈62 |
| 展 | unfolds 30.0 / 30.25 / 30.5（间隔 0.25s） |
| 绽放 | bloom 31.0（tutti + 大锣） |
| 灯笼 | lanterns 32.0–33.75，每八分音符一扇、由近及远 |
| 字幕 | 提前 0.05s 上、滞后 0.25s 下（`subs.py`：t1 = min(下一句−0.15, 起点+max(1.8, dur+0.7))） |

**总时长**：主 demo 49.0s（`style.json` dur=49.0，frame_sec=35.28）；DEMO.md 记原定 40–55s。

**静默怎么用**：静默是**真实存在**的一段。17.0–19.5（年兽眼睛段）整段没有音乐，只留风声、雪声与沉重呼吸；29.5–30.0（剪完、展开前）所有声音停住，留一拍屏息，然后 31.0 才爆出大锣与 tutti。静默是「奖赏之前的清场」。

---

## 4. 镜头逻辑

**镜头是什么**：一枚压在图版上的**放大镜式的「看」**。它不制造情绪，只把视线引到一处，再让位给信息；运动由剪纸的动作驱动。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 极特写跟随剪刀尖 | 正在制作；对工艺的专注 | 一段工作的开始；签名 |
| 平面正视，锁定 | 剪纸作为一枚徽记 | 片名；一句宣言 |
| 慢摇掠过纸层（视差） | 一个被铺开的世界 | 村庄、路线、时间线 |
| 低角度广角，形状从底纸立起 | 尺度、威胁 | 风暴；对手；逼近的期限 |
| 俯拍桌面 | 手艺即情节 | 折、剪、拼、分拣 |
| 推向发光的片再拉回成一片 | 一个动作扩散开 | 影响；亮起的网络 |
| 翻页 / 揭纸 | 时间或地点改变 | 昼到夜；之前与之后 |
| 拉远到房间里的一件物件 | 整部片是某人做出来的东西 | 记忆；礼物；传统 |
| 绕团花中心旋转 | 秩序、重复 | 一个循环；一支队伍 |

**允许的转场**（必须来自剪纸工艺本身）：折、翻页/揭纸、一张纸飞走、一刀切穿画面。

**禁止**：溶解/叠化等 UI 式转场；任何元素淡入/滑入；用透视制造纵深（层必须平行于屏幕）；无来由的运镜。

---

## 5. 表达习惯（idioms）

1. **折—剪—展**：折 2/4/8 次，一刀变很多刀；展开落在强拍上。
2. **孔就是光**：背光的剪纸透出深红，每个孔发亮，纹样被投到世界上。
3. **对称复制**：镜像母题剥落并增殖（团花 → 窗花 → 烟花）。
4. **纸屑有未来**：剪落的碎屑回来当雪、彩纸、星星。
5. **万物同一张平纸**：东西共享剪纹，一道山脊能立起变怪兽，一道浪能变一条路。
6. **镜像成对**：两个人物从一张对折的纸里剪出。
7. **12fps 角色 / 24fps 镜头**：角色硬步进，镜头、光、天气、火焰、飞纸逐格动。
8. **折的假透视**：翻起的纸分约 16 条，按 cosθ 压缩、沿折线按 `1 + 0.28·height` 放大，竖起变暗、过 90° 露浅色背面。
9. **剪的揭示**：图案沿剪刀路径的一串圆蒙版露出，剪过外缘后角料整块掉落，刃每 0.25s 开合。
10. **展开**：连续几次展开各快于前一拍，纸瓣从折到平 ease-out（「啪」），随后尺度弹跳 + 暖闪。

---

## 6. 氛围

一间安静的老式剪纸作坊 / 除夕夜的村子：纸的味道、红纸的暖、墨的干；光从背后透进来，尘埃在光柱里。整体是**耐心、精确、值得被保存**的气质，而不是戏剧性。

---

## 7. 声音

- **乐器**：明亮的中式室内小合奏——琵琶（长音轮指）、筝（`dan_tranh`：琶音/刮奏/轮指）、二胡（滑音）、笛子、笙或扬琴音色、木鱼、小锣与大锣、手鼓；五声音阶（demo：D 宫五声 D E F# A B）。
- **动作声（按材料分层）**：剪刀 = 金属擦切（2.5–9kHz 带通）+ 短铃 + 纤维断裂的「咔」；折 = swish + 折痕轻拍；展开 = 清脆「啪」；重步 = 厚纸板闷「嘭」（55Hz，每步约 6px 画面抖动）；揭纸 = 细碎撕拉；贴纸 = 手掌轻拍；火柴擦燃与「噗」；爆竹 = 20–60ms 间隔密集噼啪 + 远处闷响。
- **混音规则**：音乐在人声下压 ≈9dB、拟音压 ≈3dB；人声窗口内不放撞击声。旁白（奶奶，Kokoro `af_sarah` 0.9）近、暖、小屋子混响（`room_ir .8` 混 .12）；整体 −14 LUFS，**不加胶片颗粒**（纸纤维本身就是质感）。一剪 = 一拍细分；上行筝音一音符对应一出现之物；手鼓心跳给重量；一记大锣只留一个重音；屏息处全静。

---

## 8. 变化空间（可自由发挥）

主题、人物（或无人）、场景、纸的家族（白天浅纸 / 夜晚染纸 / 靛蓝 / 玉绿 / 黑纸）、开场、结尾、镜头路径、节奏、以及哪些「原生动作」承载故事。

`STYLE.md:100-104` 给了远离 demo 的方向：

- **结构**：一年的十二剪（生肖或日历轮，一月一楔形，旋转）；一条流水线（产品由剪纸零件一件件拼成）；一封信（折起的消息一块块展开，每块一个场景）。
- **开场**：一个已完成的花样（整朵团花，一片掉出来自己走掉）；一张空底纸（白纸，一道折痕出现）；一群已剪好的人物正在跳舞、视差全开。
- **结尾**：重新折起（世界折回一个小方块交到某人手里）；纸屑落定（每片角料飘落成新图案）；只剩背光（灯全灭，只剩一片剪纸背后亮着，把最后一幅画投在墙上）。

---

## 9. 禁忌清单

- 任何「填灰」——色调必须由剪孔/纸的深浅构成，不能出现灰色色块或渐变阴影。
- 描边线或等宽线（会读成矢量插画）——纸的轮廓必须由刀口亮/暗边构成。
- 文字或图形淡入、滑入。
- 用透视制造纵深（层必须平行于屏幕）。
- 照抄任何真实的窗花纹样、团花版式、人物剪影或标题。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。
- 把「换 `content.json` 重跑」当成做片子的方式——它只是技术检查。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`story.js` 为唯一真值）

| 字段 | 类型 | 说明 |
|---|---|---|
| `DUR` | number | 总时长（秒），demo 49.0 |
| `BEAT` | number | 一拍秒数，0.5（120 BPM、2/4） |
| `T` | object | 每个关键时刻的秒数：snips/lift/title/titleFold/village/rise/lightsOut/room/blink/decide/red/light/noise/nod/folds/cut0/cut1/unfolds/bloom/paste/outside/lanterns/nianClose/flinch/flee/fireworks/dawn/sunUp/asleep/reveal/cadence/end/endTicks |
| `VO[]` | `{id,t,text}` | id 为 `L1..L6`；同音词写 `asr` 别名（Nian→Nyan/Nion） |
| `SHOTS[]` | `[起,止,名]` | 镜头表，`shotAt(t)` 查表 |
| `lines.json` | `{id,text,voice,speed,asr?}` | 配音脚本，供 TTS |

### 10.2 新画面主体的契约

新人物/新物 = 一个「关节片模块」，必须导出：
- 一组 `piece`（由 `paper.js` 的 `piece(box,draw,opt)` 预渲染，走完整工序 `fill → cut → inset → finishPaper`）。
- `rig` parts 表（`rig.js` 的 `{name,parent,at,piece,ang,z}`，`solveRig` 解出各部件矩阵）。
- 可换的脸片/表情片。

造型规则：红块 + 内刻线，孔用月牙 + 瞳孔孔，不留孤岛；对称物用 D4 变换（`tuanhua.js`）。

### 10.3 时间线契约

- 页面契约（`main.js`）：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。
- `story.js` 导出 `DUR/BEAT/T/VO/SHOTS/shotAt`；`fold.js` 导出 `drawFold(g,t)`、`camFold(t)`；`light.js` 导出 `beginLight/pool/glowWindow/bloom/rays/applyLight`。
- `events.mjs` 读 `window.EV` 生成 `events.json` 驱动声音。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者（`mix.py` 里的声音） |
|---|---|---|
| `snip` | 剪刀（可 `big`） | 金属擦切 + 纤维断 |
| `paperwhoosh` | 纸呼啸 | 纸面滑过 |
| `place` / `stamp` / `pat` | 贴纸 / 印章 / 拍纸 | 轻拍 |
| `pageturn` | 翻页 | 纸翻 + 轻拍 |
| `windbed` | 风声床 | 低频风 |
| `thud` | 年兽脚步 | 厚纸板闷响 55Hz |
| `growl` | 低吼 | 谐波簇 |
| `puff` | 烛火熄 | 低频噪声 + 高频噗 |
| `breath` | 呼吸 | 带通噪声 |
| `blink` | 眨眼 | 高频轻拍 |
| `match` | 火柴 | 噼啪 + fwoomp |
| `fold` / `unfold` | 折 / 展开 | swish + 拍 / 清脆啪 |
| `bloom` | 绽放 | fwoomp + shimmer |
| `glowon` | 点亮 | fwoomp + shimmer |
| `lanternarrive` | 灯笼抵达 | 短 swish |
| `crackers` / `firework` | 爆竹 / 烟花 | 密集噼啪 / 上升哨 + 爆 |
| `yelp` | 年兽呜咽 | 下滑鼻音 |
| `peel` | 揭纸 | 细碎撕拉 |
| `bird` | 鸟 | 三声啁啾 |
| `roomtone` | 室内底噪 | 棕噪 |
| `vo{id}` | 人声 | 读 `voices/<id>.wav` |

---

## 11. 构建链（复用机制）

```
sh styles/papercut-red/demo/build.sh
  # 1. lines.json → core/tts/tts.py → asr_check.py
  # 2. events.mjs → music/score.py → mix.py → subs.py
  # 3. video.mjs --fps 24 --workers 3（1176 帧）→ mux.sh → check_final.py
```
（`DEMO.md:108-115`）

**关键机制**：`story.js` 是唯一真值——画面、字幕、拟音、配乐 cue 全部从它导出；改时间只改一处。`music/score.py` 读 `events.json`，所以任意折/剪/展次数都能配到乐。

---

## 12. 证据

```
styles/papercut-red/STYLE.md:3-4       一句话本质 + 参考只借语法
styles/papercut-red/STYLE.md:6-10      本质三条 + 不是什么
styles/papercut-red/STYLE.md:12-23     纸纹/刀口/纸厚/内刻线/剪纹/不留孤岛/团花/光/投影
styles/papercut-red/STYLE.md:25-30     颜色逻辑（中国红/纸档/底与主角不同纸族/金箔）
styles/papercut-red/STYLE.md:32-36     字体与字幕（纸横批、Fraunces、停留规则）
styles/papercut-red/STYLE.md:38-45     运动质量（12/24fps、折的假透视、剪的揭示、展开）
styles/papercut-red/STYLE.md:47-63     镜头语法表 + 转场 + 禁止溶解
styles/papercut-red/STYLE.md:65-71     声音（民乐小合奏/拟音/duck 9dB/−14 LUFS 无颗粒）
styles/papercut-red/STYLE.md:73-82     原生动作六条
styles/papercut-red/STYLE.md:98-104    变化空间（结构/开场/结尾）
styles/papercut-red/DEMO.md:3          不要复用故事/叙事弧/镜头/道具/时长
styles/papercut-red/DEMO.md:10-18      demo 故事结构与 49s 弧线
styles/papercut-red/DEMO.md:22-37      逐镜表（120 BPM、0.5s 拍、S1–S12）
styles/papercut-red/DEMO.md:39-58      配乐结构（D 宫五声、乐器、cue 表、duck）
styles/papercut-red/DEMO.md:74-84      调色板与道具（纸色、纸影、内刻线、背光窗花、团花、女孩、年兽、剪参数）
styles/papercut-red/demo/story.js:1-13   120 BPM/2/4、DUR 49、T 关键时刻表
styles/papercut-red/demo/story.js:15-27  VO 起点与 SHOTS 镜头表
styles/papercut-red/demo/hud.js:19-36    字幕纸横批 subStrip
styles/papercut-red/demo/hud.js:38-47    drawSubs 12fps 两步落下
styles/papercut-red/demo/paper.js:45-59  paperGrain soft-light 纹理
styles/papercut-red/demo/paper.js:145-150 inset 内刻线（双线轮廓）
styles/papercut-red/demo/paper.js:165-187 finishPaper（斑驳 + 刀口 + alpha 还原）
styles/papercut-red/demo/paper.js:198-206 transmitOf 背光透射贴图
styles/papercut-red/demo/motifs.js:19-34  sawRow / sawEdge 锯齿纹
styles/papercut-red/demo/motifs.js:36-54  crescent / crescentRows 月牙纹
styles/papercut-red/demo/motifs.js:56-87  swirl / doubleSwirl / cloudCut / plum / rosette
styles/papercut-red/demo/tuanhua.js:6-15  TR=400、outerR、wedgePoly
styles/papercut-red/demo/tuanhua.js:17-65 wedgeCuts 阳刻/阴刻、灯笼、如意云卷
styles/papercut-red/demo/tuanhua.js:98-111 D4 八个变换与整张团花
styles/papercut-red/demo/light.js:39-64   glowWindow 背光窗
styles/papercut-red/demo/light.js:67-73   bloom 两级辉光
styles/papercut-red/demo/fold.js:39-61    flap 翻起的纸（16 条、伪透视）
styles/papercut-red/demo/fold.js:84-91    camFold 桌面俯拍相机
styles/papercut-red/demo/mix.py:21-29     snip 剪刀
styles/papercut-red/demo/mix.py:50-52     thud 厚纸板闷响
styles/papercut-red/demo/mix.py:77-85     crackers 爆竹
styles/papercut-red/demo/mix.py:150-158   配乐 + duck 9dB + foley 3dB
styles/papercut-red/demo/main.js:524-549  EV 全部 type 与 window 契约
styles/papercut-red/demo/subs.py:1-13     cues 停留规则
styles/papercut-red/style.json:16-17      frame_sec 35.28 / dur 49.0
```
