# 微游戏快闪（microgame）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Five-Second Astronaut》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部快节奏的派对游戏片：**一个喊出来的命令词 + 2.5–4 秒 + 一个动作 + 一个结果**。每一个 microgame 用**完全不同的美术媒介**来画（蜡笔、水墨、终端、丝网印、像素、蓝图、瑞士排版……），每次画风切换的冲击既是笑点也是节拍；一条固定的「家」画风（主持人舞台 + 生命板 + 关卡号）把全片串起来，全片持续加速。

**它不是**：Game Show Flat（单一画风、一轮轮条形图、call-and-response）；风格样片合集（每个游戏都要有赌注，生命把它们连起来）；蒙太奇（每个游戏都有一条一秒内能被抓住的规则）。
（`STYLE.md:10-16`）

---

## 1. 材料与渲染的硬规则

任何画面元素都必须能被解释成「一种被简化的美术媒介」或「家舞台」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **家舞台** | 扁平卡通、粗近黑描边 **~7px**（`#1a1030`）、平涂、**一个硬边阴影**（用暗色填形 → 裁剪 → 往左上挪 9px 重填亮色，剩右下月牙）。 |
| **frame-within-the-frame** | 游戏在里面播的大电视/街机/手机/窗。demo 的电视屏幕 768×432，正好是画面 **1/2.5**。 |
| **每种媒介一个 channel trick** | 绘图媒介把压力/湿度存进 channel（蜡笔 alpha = 压力；水墨湿/干两个 channel）；印刷媒介存版密度（riso 每版一个 channel、加色叠印、半调、套印错位）；屏幕媒介是低分辨率缓冲放大（像素：索引缓冲 + 自动 1px 描边 + 抖动；终端：手写 glyph 艺术 + 磷光 shader）；技术媒介是线系统（蓝图：线宽 + 尺寸标注；瑞士：严格 12 栏网格 + 一个 sans + 一个信号色）。 |
| **规模** | 每种媒介是一幅简化重绘，约 **100–200 行代码**，围绕一个 trick 让它在瞥一眼时就能读懂。 |
| **主角翻译** | 主角在每种媒介里从头重画，但同三个剪影标记永远保留——**圆头盔、带橙球的天线、胸口的「05」**。动起来前先做一张覆盖所有媒介的模型表。 |
| **混媒帧** | alpha 覆盖媒介叠在底上、纸媒介 multiply、屏媒介扁平并裁剪到面板；WebGL2 材质 shader 把 channel 缓冲变成每种画风。 |
| **家舞台色板** | 旋转放射背景后一个深底 + 两三个响亮强调色 + 固定成功色与失败色（只用于印章与生命板）。demo：舞台紫 `#2a0f5c`/`#3d168f`、品红 `#ff2e88`、金 `#ffc928`/`#e08a00`、青 `#1fd1d1`、成功绿 `#3bdc5a`、失败红 `#ff3b3b`。 |
| **每媒介自带色板** | 蜡色、单墨加朱红、琥珀磷光、三张 riso 版、受限像素色、蓝底白线、黑白红。**绝不用家舞台色板去染一种媒介。** |
| **跨媒介强调色** | 一个强调色跟着主角走（水墨里一颗朱红点、终端里一个反色 glyph、瑞士里一个信号红圆）——它是切换之后眼睛找到主角的方式。 |

**关键取向**：`STYLE.md:16` 强调——**它不是风格样片合集**：每个游戏都要有赌注，生命把它们连起来。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一个嗓门很大的主持人（第二人称吆喝）+ 一个话极少的笨手笨脚主角。

**长度**：**命令词就是字幕**。一个重体展示字（Titan One），白字 + 粗墨描边 + 彩色投影 + 背后爆点，斜几度；约 **3 帧**内砸入（`1.9 → 0.92 → 1.0`，过冲后落定），停留，然后在第一个动作前**缩成一个角落标签**，所以结果永远不被盖住。demo 命令词 **2–14 字符**（`PUMP!` / `DON'T SNEEZE!` / `ZIP!` / `SALUTE!` / `LAND IT!`）。

其他台词：圆角卡片 + Lilita One ~50px，停留 ≥ `max(1.8s, 语音 + 0.6s)`，且不得出现在大横幅之下。

**句首类型**（示例性，不是抄原文）：
- 单个动词命令：`PUMP!` / `ZIP!` / `DODGE.` / `SALUTE!`（一个动词 = 剧本 + 字幕 + 重拍）
- 主持人欢迎 / 调侃：`Welcome to …` / `Too easy?`
- 点名式提醒：`One life left, cadet.`
- 宣布下一关：`Boss stage!`

**这个风格里不会出现的句式**：
- 长句、从句、书面语（每句都要能在一次呼吸里喊完）
- 抒情、抽象名词、说教（这里只有动作与结果）
- 一句塞两个信息点
- 命令词被烧两遍（它只出现在 `.srt` 里）
- 主持人的话与铜管 stab 撞在一起（命令词必须喊在 stab 之后一点点）

---

## 3. 叙事节奏

**结构**：

```
冷开场（第 1 帧已在游戏里，命令词正在砸下）
  → 拉出电视回到舞台（尺度揭示）
  → 一串 microgame（每个：命令 → 动作 → 结果）
  → SPEED UP（舞台裂成三台老虎机滚轮）
  → 只剩一条命（顶光、主持人静止）
  → BOSS 关（用之前所有媒介的碎片拼成、更长、决定故事）
  → 回到舞台（主角第一次站上去敬礼）
  → 推进电视出片尾卡
```

**速度阶梯**：**120 → 140 → 160 BPM**。

| 层 | 规则 |
|---|---|
| 第 1 轮游戏 | 8 拍（120 BPM，4.0s） |
| 第 2 轮游戏 | 6 拍（140 BPM，2.57s） |
| Boss | 32 拍（160 BPM） |
| 舞台停留 | 1 小节（8 拍）→ 4 拍 → 2 拍 |
| 命令词停留 | 0.75s → 0.64s |
| 角色步进 | 8fps → 12fps → 24fps（Boss） |
| 相机 / 转场 / 引线火花 | **永远 on ones** |

**总时长**：主 demo 59.8s（`style.json`）。STYLE.md 明确：这个格式适合 **45–60s**，更长就失去 frenzy。

**静默怎么用**：至少一次在大 hit 之前留**真实静默**——demo 里第一次喷嚏前 1 拍、只剩一条命的舞台（只剩心跳）、Boss 特写（心跳 + 与第一粒尘埃同一根 guqin 音）。**最响的时刻紧跟最长的静默之后。**

---

## 4. 镜头逻辑

**镜头是什么**：一台会**冲进电视屏幕**的演播室摄像机——镜头在「家舞台」与「游戏屏幕」之间来回，靠推入/缩回电视框做统一转场。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 从游戏内部开始（命令已在砸） | 规则自己解释自己 | 把观众扔进去 |
| 从游戏屏幕拉回 | 尺度：这只是节目里的一个屏幕 | 第一次回到舞台 |
| 锁死正面家机位 | 不变的常量，只有记分板在变 | 舞台节拍；主持人反应 |
| 老虎机滚轮（舞台裂成旋转的往期帧条，每拍停一条） | 加速、总结 | 一次 SPEED UP；换轮 |
| 触发道具的极端插入 | 开始，被感受到 | 一个游戏在重拍上开始 |
| 灯光切到单一顶光、机位不变 | 赌注；最后一次机会 | 最后一条命；一个决定 |
| 瓷砖翻面（往期末帧翻成新帧碎片） | 过去变成现在的材料 | Boss / 终局；回顾 |
| 推入一个细节并停留 | 观众比主角先注意到 | 一个线索；一次静默 |
| 一拍内 snap 回全景 | 释放 | 解法绽放；一次拯救 |
| 分屏、两个媒介并排 | 对比、对抗 | 两个玩家；前后；两种做法 |

**允许的转场**：推入屏幕开始一个游戏（约 0.25s）；整个画面缩回电视返回舞台（约 0.33s），并把 ✓ / ✗ 印章拍在屏幕上。

**禁止**：淡入淡出；**空帧**；溶解/叠化等 UI 式转场；把命令词烧两遍。

**framing**：游戏屏幕是画面的固定比例（约宽度的 40%）；在混媒帧里保持**一条焦点链**（A 引出 B 引出 C），把信息面板推到角落。

---

## 5. 表达习惯（idioms）

1. **每关换画风**：每个任务用最适合它的媒介来画；切换的冲击就是笑点。
2. **命令词**：一个动词同时是剧本、字幕和重拍。
3. **生命做 UI**：计数板不靠旁白就带来情绪；3 → 2 → 1（闪烁）自己制造紧张。
4. **SPEED UP**：五件事一起跳（BPM、游戏长度、舞台停留、命令词停留、角色帧率）。
5. **失败变成解法**：前面一次失败的材料在最后一关作为答案回来。
6. **Boss 混合规则**：终局由之前每一种媒介的碎片拼成——高潮字面上由片子自己的过去构成。
7. **即时回放**：用慢动作把一个笑点解释清楚（冻结、半速、推入、黑边、用该媒介自己的字体写说明）。

---

## 6. 氛围

一个喧闹的游戏节目演播厅：饱和的派对色板、旋转的放射背景、追逐灯泡的招牌、中央一台大电视、一个带大红按钮的讲台。紧张来自生命板，欢乐来自每一次失败的物理表演。

---

## 7. 声音

- **音乐优先**：先写速度网格与 cue 表，再动画；每一次画面 hit 都落在一张列好的 cue 上。
- **乐器**：一个恒定的 groove 贯穿全片（带 ghost note 的鼓组、slap/synth bass、铜管 stab、keys）；每种媒介加自己的音色（蜡笔 toy piano、水墨 shakuhachi/guqin、终端 square beeps、印刷 vibes、像素 pulse arpeggio、制图 typewriter、瑞士 claves、黏土 kalimba、木刻 koto）。
- **动作声（按媒介分层）**：蜡笔橡皮吱 + 空气；水墨湿 splat + 滴；ASCII 电传打字 + 继电器；riso 纸闷响 + crunch；像素 bit-crushed 噪；蓝图棘轮齿 + 印章闷响；瑞士空心 bonk + 小橡皮 boing。家舞台：弹簧皇冠 click、碎玻璃（失一条命）、翻牌、滚轮 whirr、稀疏掌声。
- **加速选项**：每次 SPEED UP 前一段上行铜管；每轮升一个调；改用减半音符而不是改速度；最后一条命把 groove 降成心跳。
- **混音规则**：主持人把每个命令词喊在 stab **之后**一点点（约 0.1s），免得铜管盖住词；人声下音乐 duck **~11 dB**、foley **~6 dB**；整体 **−14 LUFS**。

---

## 8. 变化空间（可自由发挥）

你决定：任务是什么、每个由哪种媒介来画、家舞台与它的 frame-within-the-frame、主持人和主角、轮数、失败落在哪里、终局、开场和结尾。但**命令 → 动作 → 结果的单元、每关换媒介、以及加速**这三样不能动。

`STYLE.md:112-116` 给了远离 demo 的方向：
- **结构**：**两个玩家轮流**（每个游戏由两个对手之一来玩，生命板变成一根拔河绳）；**一天一小时**（每个游戏是一小时，加速是早高峰与晚高峰，终局是午夜）；**接力**（每个游戏的结果是交给下一个的物件，链条本身就是故事）。
- **开场**：**家舞台在睡觉**（灯灭，主持人在第一拍醒来）；一个我们**倒带回去**的 game-over 画面；**只有生命板**，一个计数器在滴答下降而我们还不知道它在数什么。
- **结尾**：**一张高分表**（主角在每个媒介里逐字母输入自己的名字）；把片尾做成**又一个 microgame**（`CATCH THE NAMES!`）；**家舞台被收进 frame-within-the-frame**、屏幕关掉。

三种开场与三种结尾都要保住同一条：**每一关都得有赌注**（生命把它们连起来），不能退化成风格样片合集。

---

## 9. 禁忌清单

- 亮度斜坡的 ASCII 人物——会糊成一团（用手写 glyph 艺术 + 结构 glyph `/ \ | _ -` + 反色 `@`）。
- 水墨形状读成烟——除非剪影被设计过。
- 高速下的失败读不出来——要让动作过冲并撞到东西，或给它一次即时回放。
- alpha 覆盖媒介从缝隙里透出背景——必须实的地方给满压底。
- 用全局 context 的绘图 helper 在离屏缓冲里会画到错误的画布——前后都要 `setCtx`。
- 命令标签堆积——次要命令应该飞出去。
- 100% 白闪读成空帧——封顶约 60%。
- 单字命令的元音尾巴（`Pump!` 变 `Pompey`）——生成两词短语再按 ASR 时间戳切词。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容需要驱动的东西

台词表 `lines.json`（`{id, t, who, cmd?, fx?, text, voice, speed, trim?}`）、时长表 `dur.json`、速度网格 `timeline.js`（每段 `{id, beats, bpm, kind, style?, cmd?, ok?, dark?}`）、每个媒介的场景模块、家舞台/角色/HUD 参数、以及一张 cue 表。

### 10.2 新媒介模块的契约

必须导出 `sceneX(g, lt)`（`lt` = 段内本地时间），并在内部把主角用该媒介从头重画、但保留三个剪影标记（圆头盔、天线球、「05」）。离屏绘制时必须先 `setCtx(ctx)`。参考 `demo/g_<medium>.js`（`g_crayon.js` / `g_ink.js` / `g_ascii.js` / `g_riso.js` / `g_pixel.js` / `g_blue.js` / `g_swiss.js` / `g_boss.js`）。

### 10.3 时间线契约

`timeline.js` 是全片**唯一真值**（速度网格 + 段落表），必须导出 `SEGS`、`DUR`、`S`（id→段）、`find(t)`、`bt(id, k)`。页面契约由 `main.js` 暴露 `window.render(t)` / `window.DUR` / `window.EV` / `window.SUBS` / `window.SRT` / `window.READY`。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者 |
|---|---|---|
| `voice` | 人声 | 加载 voices/<id>.wav |
| `fuse_on` / `cmd_slam` | 引线点火 / 命令词砸入 | 计时器 / 命令词 |
| `tv_in` / `tv_out` | 推入 / 缩回电视 | 转场 |
| `crown` | 主持人拍表冠 | 弹簧 click |
| `crack` / `lights_off` | 生命裂开 / 灯灭 | 碎玻璃 / 静默 |
| `stamp_ok` / `stamp_bad` | ✓ / ✗ 印章 | 印章闷响 |
| `button` / `insert_whoosh` | 大红按钮 / 插入 | 咔嗒 / 呼啸 |
| `bulb` / `reels_spin` / `reel_stop` / `zoom_whoosh` | 灯泡 / 滚轮旋转 / 停轮 / 冲镜 | 招牌 / 老虎机 |
| `tile_flip` | Boss 瓷砖翻面 | 翻牌 |
| 每游戏拟音 | `pump` `sneeze` `ink_splat` `drip` `blink` `typing` `ratchet` `buckle` `beep2` `float_whoosh` `grab` `chomp` `jump` `meteor` `graze` `pencil` `zip` `red_stamp` `swing` `bonk` `bounce` `replay_in` `replay_out` `roll` `cloud_whoosh` `lever` `chute_pop` `err` `zoom_in` `dust` `sneeze_big` `ink_boom` `canopy_open` `wind` `splash` `clear` `confetti` `applause` `hop` `salute` `tick_hand` `rocket_pop` | mix.py 里的对应声音 |

---

## 11. 构建链（复用机制）

```
styles/microgame/demo/
  timeline.js  速度网格 + 段落表（唯一真值）    film.js   装配：舞台、电视转场、老虎机、Boss 瓷砖、片尾卡、字幕、事件
  toon.js chars.js stage.js hud.js   家画风、主持人 & 主角、舞台、引线/命令/印章/生命/字幕
  glpass.js     WebGL2 材质 shader：riso / crayon / CRT / ink / blueprint paper
  g_crayon.js g_ink.js g_ascii.js g_riso.js g_pixel.js g_blue.js g_swiss.js g_boss.js   每媒介一个模块（场景 + 主角翻译）
  frames.js     模型表与风格帧      music/score.py   原创配乐      mix.py   foley + 人声 + ducking
  tools/        trim_cmd.py cuecheck.py subs.py final_asr.py review.sh mux.sh dump_timeline.mjs
```

```
sh demo/build.sh
  # TTS → trim → whisper → score → events → cue check → mix → srt → render（1436 帧约 25s）→ mux（−14 LUFS, grain 0）
```

**关键机制**：先写 `timeline.js`（速度网格），再写 cue 表，然后把网格与 cue 表交给配乐（并行作画）。`tools/cuecheck.py` 检查画面事件与 `music/score.json` 的偏移。所以**换一组任务、换一组媒介**，只要重写速度网格与各媒介的 `sceneX`，画面与音乐仍然同步——这是「可换内容重跑」的实现方式。

---

## 12. 证据

```
styles/microgame/STYLE.md:3            一句话定义（命令词/几秒/一个动作）
styles/microgame/STYLE.md:6            45–60s，更长失去 frenzy
styles/microgame/STYLE.md:10-16        本质五条 + 不是什么
styles/microgame/STYLE.md:20-27        家舞台/每媒介 channel trick/主角翻译/混媒帧
styles/microgame/STYLE.md:31-34        颜色逻辑（家派对色板 + 每媒介自带 + 跨媒介强调色）
styles/microgame/STYLE.md:38-41        命令词=字幕的排印与停留
styles/microgame/STYLE.md:45-51        帧率阶梯/五件事加速/引线/统一转场/失败被表演
styles/microgame/STYLE.md:57-70        镜头词汇表 + framing
styles/microgame/STYLE.md:74-79        音乐优先/每媒介音色/foley/加速选项/静默/人声 duck
styles/microgame/STYLE.md:85-91        七个 native move
styles/microgame/STYLE.md:95-102       媒介陷阱
styles/microgame/STYLE.md:110-116      变化空间
styles/microgame/DEMO.md:3             不要复用故事/叙事弧/镜头/道具/时长
styles/microgame/DEMO.md:5             demo 名与 59.8s
styles/microgame/DEMO.md:10-12         故事结构与「每关换媒介」为何有效
styles/microgame/DEMO.md:16-22         五个 native move 在 demo 里的用法
styles/microgame/DEMO.md:24-26         demo 故事形状
styles/microgame/DEMO.md:30-41         逐段镜头表
styles/microgame/DEMO.md:45-50         速度阶梯/命令词/引线/转场/失败/即时回放
styles/microgame/DEMO.md:54-59         配乐/foley/人声 duck/单字命令切词
styles/microgame/DEMO.md:63-83         家舞台色值/角色/八种媒介/Boss 拼贴/水墨降落伞
styles/microgame/DEMO.md:87-91         命令词即字幕/卡片/片尾卡
styles/microgame/DEMO.md:96-107        模块图与构建步骤
styles/microgame/DEMO.md:111-121       实测坑
styles/microgame/demo/timeline.js:4-13    add() 两种算法
styles/microgame/demo/timeline.js:15-22   第 1 轮 120 BPM 段落
styles/microgame/demo/timeline.js:23      SPEED 段 [120,140]
styles/microgame/demo/timeline.js:25-30   第 2 轮 140 BPM 段落
styles/microgame/demo/timeline.js:31-35   BOSSIN/BOSS/RESULT/END
styles/microgame/demo/timeline.js:36-41   导出 SEGS/DUR/S/find/bt
styles/microgame/demo/toon.js:2-9         P 家舞台调色板
styles/microgame/demo/toon.js:12-14       K / setCtx / lw
styles/microgame/demo/toon.js:17-30       part() 硬边阴影
styles/microgame/demo/toon.js:32-39       tube()
styles/microgame/demo/toon.js:67-76       outlined()
styles/microgame/demo/film.js:20          SCENE 映射
styles/microgame/demo/film.js:23          renderGameTo() 离屏渲染
styles/microgame/demo/film.js:26-28       still()/firstFrame()/lastFrame()
styles/microgame/demo/film.js:33-41       subs()/srtCues()
styles/microgame/demo/film.js:42-85       events() 全部 type
styles/microgame/demo/film.js:88-90       R2()/tvOutDur()/tvInDur()
styles/microgame/demo/film.js:91-93       PREV/NEXT/BADGE
styles/microgame/demo/film.js:94-106      tickState() 主持人姿态
styles/microgame/demo/film.js:108-141     stageSeg() 舞台段
styles/microgame/demo/film.js:142-157     buttonInsert()
styles/microgame/demo/film.js:159-167     REEL_ITEMS/speedTile
styles/microgame/demo/film.js:168-205     speedSeg() 老虎机
styles/microgame/demo/film.js:207-225     bossinSeg() Boss 瓷砖
styles/microgame/demo/film.js:227-241     endCard()
styles/microgame/demo/film.js:244-268     renderFilm() 主渲染
styles/microgame/demo/stage.js:8-9        TV/TVZ
styles/microgame/demo/stage.js:11-14      tvCam()
styles/microgame/demo/stage.js:15-24      sunburst()
styles/microgame/demo/stage.js:25-52      marquee()
styles/microgame/demo/stage.js:53-64      tvSet()
styles/microgame/demo/stage.js:65-73      tvScreen()
styles/microgame/demo/stage.js:74-84      podium()
styles/microgame/demo/stage.js:85-94      floor()
styles/microgame/demo/stage.js:95-110     spots()
styles/microgame/demo/stage.js:112-127    drawStage()
styles/microgame/demo/stage.js:128-138    confetti()
styles/microgame/demo/main.js:3-12        页面初始化与 window.EV/SUBS/SRT
styles/microgame/demo/main.js:13-42       window.render(t)
styles/microgame/demo/main.js:48-49       window.DUR / window.READY
styles/microgame/demo/lines.json:1-194    21 条台词
styles/microgame/style.json:16-17         frame_sec 23.92 / dur 59.8
```
