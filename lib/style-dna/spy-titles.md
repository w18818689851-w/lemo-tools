# 60s 间谍片头（spy-titles）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Velvet Cipher》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「纸片被剪刀剪出来、在字幕自己搭成的布景里追一个东西」的 1960 年代片头：**四种不透明油墨平涂、没有渐变**，每块形状都有手剪毛边、靠切缝和纸影分层；人物一律剪影侧面，只靠轮廓与节拍表演；**字幕本身就是建筑/道具/交通工具**，铜管强奏就是剪辑点，最后所有碎片沿 30° 斜线飞回来拼成片名。

**它不是**：平面矢量动效（边是剪出来的、纸是实物）、半调网点印刷（没有网点）、瑞士网格（这里全是斜线与歪斜字）、带枪管开场和道具的间谍 parody。
（`STYLE.md:15`）

---

## 1. 材料与渲染的硬规则

任何画面元素都必须能被解释成「剪纸工艺的某个环节」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **四种油墨，绝不渐变** | 墨黑 `#1b1714`、纸奶油 `#efe4c9`、信号红 `#d23a22`、芥末黄 `#e2a52a`；只允许「更深的纸」变体（暗红 `#9a2a18`、暗芥末 `#b07e1c`、暗纸 `#d9ccae`、远景 `#3a322b`）用于纵深/影子（`paper.js:5-8`）。 |
| **剪刀毛边** | 每个多边形每 ~9–10px 重采样，沿法线按低频噪声位移（默认 amp 1.3，大形状更大）+ 偶发 1–2px 小豁口（哈希 >0.965 时额外下切 amp×1.6）；**角点不偏**，只有边中间摆动（`paper.js:23-45`）。 |
| **★ 边在局部坐标剪一次并缓存** | `roughC(key, fn, ...)`：纸片移动时边缘跟着走。在屏幕空间算边会让运动中的剪影边缘「沸腾」/爬行（`paper.js:46-48`、`STYLE.md:19`）。 |
| **纸片分层** | 相邻纸片留 **2.4px 底色切缝**（`S.gap=2.4`）+ 小纸影（偏移 2.5/3.5px、blur 5、alpha 0.30）；整块人物以切缝作外轮廓，所以黑人物能压在黑字母前（`paper.js:15`、`paper.js:61-69`）。 |
| **纸纹** | 一次生成、整屏 multiply：低频云纹 + 2600 根纤维 + 每 3px 一条极淡横向刮墨条纹；另有 9000 个「漏印纸白」点以 screen 叠加（只在深墨上显形）。封装再加 film grain ~6（`paper.js:92-122`、`DEMO.md:60`）。 |
| **剪影人物** | 约 7 头身、窄檐帽（帽带是一道剪缝）、宽肩外套、尖头鞋，**只有一处彩色（红领带）**兼作运动指示器（跑起来向后飘）。纸片在**离屏图层里融成一个外轮廓**，只在肩/肘/髋/膝留 1.7px 关节缝；手是尖楔形，除特写里一道奶油色眼缝外无五官（`paper.js:134-157`、`STYLE.md:22`）。 |
| **追逐物（MacGuffin）** | 永远压在一层黑色背衬（= 墨色关键线）上，在任何底色上都读得出来，是全画最亮的东西（`STYLE.md:23`）。 |
| **字** | 字幕用 OFL 窄体（League Gothic）→ opentype.js 取轮廓 → 折线化（曲线每段 8 分）→ **每个字母重剪一遍**（毛边、±0.8° 旋转、±1.5px 基线错位）；片名用自制剪纸几何字形（直线 + 圆弧、笔画不匀、基线错落），绝不照抄真实片名字形（`glyph.js:11-23`、`glyph.js:46-65`、`title.js:1-19`）。 |

**关键取向**：剪影人物必须先融成一个外轮廓再整体贴回主画布（8 向底色描边 + 一层纸影），否则每块纸片都描缝会读成木人模型图（`STYLE.md:90`、`DEMO.md:74`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一份磁带里放出来的秘密简报。第三人称、现在时、短句、不带情绪。英国男声（Kokoro `bm_george`，speed 0.9–0.97）。

**长度（实测）**：单句 **17–29 字符**（约 3–6 英文词）。示例里最短 `He travels light.`（17 字符），最长 `Tonight, he runs out of roof.`（29 字符）。硬规则：每行口播 ≤ 4.5s；字幕停留 ≥ `max(1.8s, 语音时长 + 0.6s)`（`film.js:22`）。字幕是一条窄纸条（剪口两端、倾斜 −1°）放左下 (96,958)，League Spartan 600 44px，0.18s 从左侧滑入 60px（`DEMO.md:67`）。

**句首类型**（示例性，不是抄原文）：
- 以「你的目标 / 他」起句的简报陈述：`Your target carries a key.`
- 一句否定式断言：`Nobody knows what it opens.` / `He never looks back.`
- 极短的习性白描：`He travels light.`
- 用时间状语起句再落事件：`Tonight, he runs out of roof.`
- 结尾「现在你知道了」的回扣句：`Now you know what it opens.`

**这个风格里不会出现的句式**：
- 第一人称抒情与内心独白（靠剪影的动作和铜管强奏承载情节）
- 网络口播腔、感叹号堆叠、营销话术
- 长复合句（单句 >30 字符会盖过 0.18s 纸条滑入与一个乐句）
- 抽象概念当主语（只说能被剪成形状的人、物、地点）

---

## 3. 叙事节奏

**信息投放顺序**：

```
冷开场（黑底一个锁定形状 = 钥匙孔）
  → 一行简报钩子
  → 劈开（钥匙孔沿 30° 切线裂成两半飞走，露出红色网格）
  → 字幕条沿网格线滑入并落拍（A LEMOLAB PICTURE）
  → 丝绒钥匙被手套抢走 → 风衣划像
  → 3–4 个地点追逐（每段比上一段短；每个地点 = 一行字幕搭成的布景）
  → 插科打诨（人半藏在字母后；stop-time 定格）
  → 形状匹配剪辑加速蒙太奇（轮盘→轮盘→瞳孔→月亮→锁孔）
  → 剪影对巨大奶油月亮完成抓捕
  → 世界沿 30° 网格碎裂、碎片飞回拼成片名
  → 安静收尾（一拍静默、一记干邦戈、一句冷话）
```

**时间全部挂在 132 BPM 网格上**：1 拍 = 60/132 ≈ 0.4545s，1 小节 = 4 拍 ≈ 1.818s；开头让出 1 拍给第一句旁白（`OFF = BEAT`）（`story.js:2-3`）。

| 层 | 停留规则 |
|---|---|
| 铜管强奏 = 剪辑点 | `split=B(2)`、`snatch=B(4)`、`train=B(10)`、`freeze=B(12)`、`roulette=B(13)`、`moon=B(15)`、`title=B(19)`、`button=B(21)`（`story.js:6-8`） |
| 跑步循环 | 2 拍（每步 1 拍，`film.js:16`） |
| 定格（stop-time） | 在 `HIT.freeze` 整幅冻结到 `T.resume`，音乐绝对静音后恢复（`film.js:181`） |
| 片名字母落地 | 连续十六分音符：`letterLand(i) = T.shatter + BEAT·0.75 + i·(BAR − BEAT·0.9)/14`（`film.js:304`） |
| 字幕纸条滑入 | 0.18s（ease-out，`film.js:28-29`） |
| 字幕停留 | ≥ `max(1.8s, 语音时长 + 0.6s)`（`film.js:22`） |

**总时长**：主 demo 44.1s（`style.json` dur=44.1，frame_sec=26.46；`story.js` `DUR=B(25)=44.09s`）。文档给 30–60s 区间；情绪弧建议 35–45s（`DEMO.md:28`）。

**静默怎么用**：静默是**真零**（连混响尾巴都算）。冷开场只有一记磁带咔哒；stop-time 与结尾那一拍绝对静音；最后一句只压在磁带嘶声上（`STYLE.md:72`、`DEMO.md:51`）。`mix.py` 把两段区间整段清零并做 5ms 淡入淡出：20.60–21.364s（stop-time）与 37.10–37.727s（结尾一拍）（`mix.py:148-151`）。

---

## 4. 镜头逻辑

**镜头是什么**：一台平面、果断、把字幕当布景来拍的机位。先拉开到能读完整行字幕，再推进到动作里；追逐时永远横向跟拍、单一屏幕方向（左→右，被追的在前、追的在后）。它不制造情绪，只负责读字、追人、在强奏上硬切。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 全行字幕拉开 → 推轨进入 | 先读、后动 | 任何用字搭出来的地点 |
| 横向跟拍，单一屏幕方向 | 追逐、动量 | 一场追逐；一场赛跑；一次投递 |
| 在铜管强奏上硬切 | 重击；一个新地点 | 蒙太奇；一次揭示；一个笑点 |
| 形状匹配剪辑（同形状同位置） | 押韵；加速 | 轮盘→硬币→瞳孔→月亮 |
| 平底上锁死一个形状 | 神秘；一个图标 | 冷开场；一条线索；一个 logo |
| 剪影对巨大圆（奶油月亮） | 主角时刻 | 一次抓捕；一次胜利；一次对峙 |
| 沿 30° 斜线切成网格 | 碎裂；同时多个 | 分屏；一个阴谋；一队人 |
| 沿一列字垂直下摇 | 下降；一份名单 | 一栋楼；一个花名册；一次倒计时 |
| 推进一个字母直到填满画幅 | 一个字母变成一个地点 | 一道门；一条隧道；一扇窗 |

**允许的转场**（必须来自剪辑/剪纸工艺本身）：沿 30° 切线劈开、百叶翻走（12 条竖条）、风衣划像、定格（stop-time）、沿斜线长条交替滑走。

**禁止**：溶解/叠化等 UI 式转场；任何元素淡入/滑入（字幕纸条除外，且必须落拍）；无来由的运镜；形状匹配剪辑时圆心位置或大小发生移动（匹配就不成立，`STYLE.md:97`）。

---

## 5. 表达习惯（idioms）

1. **字即布景**：每个地点就是一行字幕，那一行就是它的建筑——字母是柱廊、词是车厢、一个 O 是轮盘、一个破折号是屋檐、一个字母是锁。
2. **字幕即节奏**：字幕落在拍上，强奏就是硬切。
3. **形状匹配剪辑**：把具象抽象到剪影后，形状押韵又便宜又有力；张力上升时剪辑间隔缩短（2 小节 → 1.5 小节 → 2 拍）。
4. **斜线网格**：开场沿 30° 劈开并繁殖成网格；高潮时碎片沿同一组斜线飞回拼成片名；片名再沿同一条切线合拢——**开场伤口 = 收尾接缝**。
5. **剪影木偶（on twos）**：人物永远是侧面平剪纸，12fps 表演，一切演技都在轮廓与时序上：跑、贴平、回头、冻结。
6. **stop-time 笑点**：在强奏上冻结、静默、恢复。
7. **追逐物就是片名**：所有人追的东西最后被拼成片名。
8. **关节缝**：整块人物先融成一个外轮廓，只留几道细缝（`STYLE.md:90`）。

---

## 6. 氛围

一张铺在桌上的彩色卡纸和一把剪刀：四个油墨色、纸的味道、剪刀的冷；底色随地点整体换（黑 = 冷开场/屋顶，红 = 网格/列车/赌场，奶油 = 丝绒/片名，芥末 = 机场）。整体是**干脆、有节奏、带一点冷幽默的机械感**，而不是阴郁或写实。

---

## 7. 声音

- **乐器**：1960 年代间谍大乐队——叠八度的顿音小号与长号 + 镲（= stab）、经弹簧混响的低音弦电吉他、行走低音提琴、鼓刷或鼓棒、邦戈与沙锤、颤音琴、长笛、管风琴强奏、羽管键琴。小调、半音线条、附点节奏。★ **原创动机**（从五级半音下行再跳到主音），**避开**最著名间谍主题的 E–F–F♯–F 半音爬行与 Em(maj9) 收尾和弦，收在 Em6/9（`DEMO.md:49`）。
- **动作声（按材料分层，全部程序合成）**：纸（剪刀 cut「shh」、纸滑、卡片拍击=字母落地、翻纸、撕裂=碎裂）；金属（钥匙叮当、链子崩断、钥匙滑进锁、锁咔哒、轮盘咔啷）；磁带（咔哒、嘶声）。环境只暗示：喷气机掠过（pan L→R）、列车隆隆带按拍的车轮 ka-chunk、轮盘球渐慢滴答、屋顶风（`STYLE.md:71`、`mix.py:19-98`）。
- **混音规则**：音乐在人声下 duck ~−7 dB（demo 实际 `1 − 0.55·duck`）；音乐 ×0.95 + 拟音 ×0.9 + 人声；拟音先低通 11kHz 去采样间峰值；整体推 ~+4 dB 进限幅器再 loudnorm 到 −14 LUFS（`mix.py:143-152`）。★ **stab 提前 ~8ms 放置**，让采样峰值正好落在剪辑帧上（`STYLE.md:69`）。人声走磁带链路：带通 220–5200Hz + 软饱和 `tanh` + 0.9Hz 抖晃 ±0.25% + 人声处抬高的磁带嘶声（`mix.py:119-137`）。

---

## 8. 变化空间（可自由发挥）

追什么、谁在追、地点（都以字幕形式出现）、四种油墨、开场与结尾。所有方向都必须远离 demo 的《The Velvet Cipher》：

- **结构**：不追、改**倒计时**（十行字幕、十个地点，每个地点里用字搭出一个炸弹时钟数字）；**倒着来的抢劫**（东西被一件件送回原位，一个地点一件）；**两个特工、一个画幅**（沿斜线分成两半，两边底色不同，直到他们相遇）。
- **开场**：一个**满画幅片名**当场碎裂成整段（把揭示搬到开头）；**一通电话**在一个单张剪出的房间里响起；**主角已经在坠落**，穿过一列字幕。
- **结尾**：片名**永远拼不起来**，缺一块，主角带着它走开；**缓慢拉远**，揭示每个地点原来都是一张巨大的字幕页；**在最后一记强奏上定格**并停住。

同时可换：追逐物的形状、主导底色、剪影人物的行头（帽子/外套/鞋子）、跑步循环的画数与拍数。★ 但「字即布景 + 强奏即剪辑点 + 斜线网格拼片名」这三条骨架不能拆（`STYLE.md:106-110`、`DEMO.md:26`）。

---

## 9. 禁忌清单

- 平面矢量动效（边必须是剪出来的，纸是实物）。
- 半调网点印刷（那是别的风格）。
- 瑞士网格式排版（这里全是斜线、歪斜字、俏皮）。
- 带枪管开场或道具的间谍 parody。
- 溶解/叠化等非剪辑工艺的转场。
- 让形状匹配剪辑的圆心移动。
- 照抄任何真实片名的 logo、字形、角色或镜头。
- 在字幕里写真实人名（字幕只写虚构的职务，`STYLE.md:36`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

| 要素 | 说明 |
|---|---|
| 旁白行（`lines.json`） | 每条 `{id, t, text, voice, speed}`；单行 ≤4.5s；demo 6 行 bm_george 0.9–0.97 |
| 节奏网格（`story.js`） | `BPM/BEAT/BAR/OFF/B(n,beat)/DUR/HIT/T`，唯一时间真值 |
| 四色板（`paper.js` 的 `C`） | `ink/paper/red/mus` + 3 个深色变体；每场一个主导底色 |
| 字幕条（`frames.js`） | `subStrip(text,{dark,dx,a})`；深场奶油纸条、浅场墨纸条（`DARK_SUB` 表） |
| 片名（`title.js`） | `GLYPH` 表 + `titleLayout`；lock 字母 = 黑板 + 红钥匙孔 |
| 音效事件（`film.js`） | `events()` 返回数组 |

### 10.2 新画面元素的契约

用 `paper.js` 画：
- 任意多边形 → `rough(pts, seed, amp, step)` 剪边；恒定形状用 `roughC(key, fn, seed, amp, step)` 缓存。
- → `piece(polys, col, {gap, shadow, gapCol, cut})` 平涂并加切缝/纸影。
- 人物必须在 `silhouette(fn)` 里绘制（内部自动融成一个外轮廓 + 8 向底色描边 + 一层纸影），关节用 `slit(x,y,ang,len,w=1.7)` 挖缝。
- 形状基元：`rectP/circP/ellP/arcP/smooth/xf`；整屏收尾 `paperFinish(amt)`。
- 字形：`glyph.js` 的 `layout(str,size,{track,font})` + `drawLine(L,x,y,{col,seed,jit,amp,gap})`。

### 10.3 时间线契约

`story.js` 是唯一时间真值。`film.js` 导出 `renderFilm(t,opt)`（逐帧绘制，`opt.nosub` 关字幕）、`DUR`、`subs()`、`events()`；`setLines(lines, durs)` 注入旁白与时长。页面契约（`main.js`）：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 |
|---|---|
| `tape_click` | 磁带咔哒 |
| `paper_cut` / `scissor` | 剪刀剪 shh |
| `paper_slide` / `paper_whoosh` / `paper_flip` | 纸滑 / 纸呼啸 / 翻纸 |
| `card_slap` | 卡片拍击（字母落地） |
| `blinds` | 百叶翻 |
| `grab` | 抓取 |
| `key_jingle` / `key_drop` / `key_catch` / `key_slide` / `lock_click` | 钥匙金属声族 |
| `chain_snap` | 链子崩断 |
| `coat_whoosh` | 风衣呼啸 |
| `step{g}` / `skid` / `land` | 脚步 / 急停 / 落地 |
| `jet` | 喷气机掠过（pan L→R） |
| `train_bed{d}` | 按 132BPM 的车轮 ka-chunk |
| `wheel_clank` / `roulette{d}` | 轮盘咔啷 / 球渐慢滴答 |
| `pupil` / `wind{d}` / `shatter` | 瞳孔 / 风 / 碎裂 |

全部由 `film.js:437-473` 的 `EV.push` 产生，`tools/events.mjs` 序列化成 events.json。

---

## 11. 构建链（复用机制）

```
styles/spy-titles/demo/
  paper.js   四油墨、剪边（缓存）、切缝、纸影、纸纹、剪影图层 + 关节缝
  glyph.js   League Gothic → opentype.js 轮廓 → 重剪字母
  chars.js   agent / courier 骨架、姿势、跑/走循环、钥匙 + 钥匙孔
  title.js   自制片名字形、锁板 I、斜线劈开
  scenes.js  钥匙孔、网格、丝绒、intro、机场、列车、轮盘、赌场、瞳孔、屋顶、片名底
  film.js    时间线、表演、镜头、字幕、音效事件
  story.js   132-BPM 网格（唯一时间真值）
  music/score.py  原创大乐队配乐（采样器）    mix.py  拟音 + 磁带人声 + 闪避
```

1. `node core/render/still.mjs styles/spy-titles/demo 12 20.8 --q nosub=1` — 审片（`?sheet=1&v=1`、`?frame=airport|train|title`）。
2. `core/tts/tts.py lines.json voices` → `core/tts/asr_check.py`（6/6）。
3. `python music/score.py` → `node core/render/events.mjs` → `python mix.py`。
4. `node core/render/video.mjs styles/spy-titles/demo --fps 24 --workers 3`（1058 帧 ≈ 17s，Canvas2D）。
5. `CRF=24 sh demo/tools/mux.sh out/video24.mp4 mix.wav spy-titles.mp4 24 6`（core mux + CRF 旋钮：平涂 + grain 在 crf19 = 270MB，crf24 = 18.5MB 无可见差异）。或直接 `sh demo/build.sh`。

（`DEMO.md:85-103`）

---

## 12. 证据

```
styles/spy-titles/STYLE.md:6-15        本质 + 不是什么
styles/spy-titles/STYLE.md:17-24       材料与渲染（剪边缓存/切缝/纸影/剪影融合/黑背衬/字重剪）
styles/spy-titles/STYLE.md:26-32       颜色逻辑（四油墨 + 主导底色 + 三组示例色值）
styles/spy-titles/STYLE.md:34-38       字体与字幕（纸条/虚构职务/停留规则）
styles/spy-titles/STYLE.md:40-46       运动质量（on twos/落拍停死/stop-time/碎裂）
styles/spy-titles/STYLE.md:48-64       镜头词汇表 + 构图 + 转场
styles/spy-titles/STYLE.md:66-74       声音（大乐队/强奏提前 8ms/拟音/真零静默/duck/−14 LUFS）
styles/spy-titles/STYLE.md:76-86       七个 native moves
styles/spy-titles/STYLE.md:88-98       媒介陷阱
styles/spy-titles/STYLE.md:104-110     变化空间（结构/开场/结尾各三例）
styles/spy-titles/DEMO.md:3            不要复用故事/弧线/镜头/道具/时长
styles/spy-titles/DEMO.md:5-8          demo 44s / 30–60 秒
styles/spy-titles/DEMO.md:16-26        五个 native powers + 改编法
styles/spy-titles/DEMO.md:28           情绪弧 35–45s
styles/spy-titles/DEMO.md:30-45        逐拍镜头表 + on twos + stop-time
styles/spy-titles/DEMO.md:47-53        配乐（132BPM/原创动机/强奏=剪辑点/磁带人声/−14 LUFS）
styles/spy-titles/DEMO.md:55-63        调色板与道具（色值/剪边缓存/切缝/纸纹/剪影设定）
styles/spy-titles/DEMO.md:85-103       构建链
styles/spy-titles/demo/story.js:2-4          BPM 132 / DUR=B(25)=44.09s
styles/spy-titles/demo/story.js:6-8          HIT 强奏 = 剪辑点表
styles/spy-titles/demo/story.js:9-21         T 命名时刻表
styles/spy-titles/demo/paper.js:5-8          四油墨调色板 + 深色变体
styles/spy-titles/demo/paper.js:15-16        S.gap=2.4 / clear 保留相机变换
styles/spy-titles/demo/paper.js:23-48        rough 剪边 + roughC 局部缓存
styles/spy-titles/demo/paper.js:52-70        piece 切缝 + 纸影
styles/spy-titles/demo/paper.js:92-122       纸纹 + paperFinish
styles/spy-titles/demo/paper.js:134-157      silhouette 图层 + slit 关节缝
styles/spy-titles/demo/glyph.js:11-23        opentype.js 轮廓折线化
styles/spy-titles/demo/glyph.js:46-65        cutLetter 重剪 + drawLine 微旋转/错位
styles/spy-titles/demo/title.js:1-19         自制片名字形 + 锁孔 I
styles/spy-titles/demo/title.js:65-93        CUT_ANG=30° 斜线劈开/合拢
styles/spy-titles/demo/film.js:13-16         on twos + STEP=BEAT*2
styles/spy-titles/demo/film.js:21-31         subs 停留 + 纸条滑入
styles/spy-titles/demo/film.js:181           warp() stop-time
styles/spy-titles/demo/film.js:304           letterLand 十六分音符落地
styles/spy-titles/demo/film.js:305-343       sShatter 碎片飞回 + 长条滑走
styles/spy-titles/demo/film.js:437-473       events() 全部 type
styles/spy-titles/demo/mix.py:119-137        磁带人声链路 + 嘶声
styles/spy-titles/demo/mix.py:143-152        duck / 绝对静音两段 / +4dB
styles/spy-titles/demo/lines.json:1-43       6 行旁白实测
styles/spy-titles/style.json:16-17           frame_sec 26.46 / dur 44.1
```
