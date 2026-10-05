# 活体实机录屏（living-screencast）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Clawd Moves In》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「看起来像真录屏、其实每个像素都是重画的」产品走查片：所有窗口、菜单、diff 行、按钮都用 HTML/CSS/SVG 重绘，**一个由大方块像素组成的吉祥物**住在这个高分辨率界面里——两种分辨率的对撞就是它的样子。**两个演员，绝不用手**：光标是用户，吉祥物是软件。

**它不是**：暗色科技发布会 keynote（没有黑舞台、没有凭空发明的抽象 UI——这是真产品）、像素游戏（世界是高分辨率矢量 UI，只有吉祥物和它的道具是像素）、真录屏（没有一帧是截图）。
（`STYLE.md:24`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值 |
|---|---|
| **真 UI，重画** | 每个标签、模式名、快捷键和真产品一致；无截图、无 lorem ipsum；被测应用真的会变。 |
| **像素网格神圣** | 吉祥物、道具、拖尾共享一个方块像素网格、边缘锐利（`crispEdges`）；位置对齐半像素。 |
| **重力 = UI 顶边** | 只站真实元素的顶边；位置来自**每帧量活 DOM**（`getBoundingClientRect` 反算世界坐标）。 |
| **窗口浮桌面** | 应用漂在壁纸上、柔和阴影；缩放永不超出显示器。 |
| **深度只服务注意力** | rack focus、暗角聚光；**绝不模糊要读的文字**。 |
| **运动模糊** | 由镜头速度推导、作用在**未变换的外层**、只在甩镜时（慢推保持锐利）。 |

**颜色**：产品自己的浅/暗主题原样照搬；吉祥物保持产品的品牌色，或一个 UI 里没有的饱和色（在任何一帧最先被眼睛找到）；叠加层是中性磨砂玻璃，最多一个取自产品的强调色（`STYLE.md:35-40`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位冷静、一功能一句的讲解者。第三人称 + 现在时，也可用第二人称。

**长度（实测）**：单句 **11–77 字符**（约 2–15 个英文词）。字幕是磨砂玻璃胶囊，停在底部、**绝不压在被讨论的元素上、也绝不在吉祥物下面**；停留 ≥ max(1.8s, 语音 + 0.6s)。

**句首类型**：
- 介绍角色：`Meet Clawd.`
- 以前/现在对照：`It used to live in your terminal.` / `Now it lives right inside the Claude app.`
- 祈使句给指令：`Just say what you want, in plain words.`
- 「你得到什么」：`You get a clear plan, and nothing changes until you say go.`
- 口号收束：`Say it. Plan it. Review it. Ship it.`

**不会出现的句式**：第一人称抒情；网络口播腔/感叹号堆叠；编造的功能或改名的模式；一句塞两个以上信息点；把产品名放进会被按键音盖住的位置。

---

## 3. 叙事节奏

**信息投放顺序**：

```
冷开场（终端打出 claude，logo 方块活过来、吉祥物爬出、留下虚线轮廓）
  → 应用窗口打开、吉祥物落在空状态标题上（diegetic title，落在重拍）
  → 01 直接说（自然语言 prompt + @ 提及、读文件）
  → 02 先计划（Plan 模式，不说 go 就什么都不改）
  → 03 复查（diff、行内评论、修订）
  → 04 自检（预览、暗色开关、并行会话）
  → 口号收尾（吉祥物逐词跳）
```

**时间挂在 100 BPM 网格上**（1 拍 0.6s，段落切点都落在拍上）。VO 起点（秒）：`v01 2.3 / v02 3.5 / v03 6.2 / v04 10.9 / v05 13.5 / v06 16.1 / v07 20.3 / v08 22.9 / v09 28.1 / v10 30.5 / v11 32.8 / v12 36.5 / v13 38.2 / v14 43.0 / v15 45.8 / v16 50.8 / v17 52.42`。章节转场 `wipe1..4 = 10.2 / 19.2 / 27.0 / 35.4`；吉祥物：蓄力下蹲 0.14s（压扁 0.28）、落地压扁 0.22s 阻尼回弹、行走 9 步/秒、随拍轻点、每 2.9s 眨眼。

**总时长**：主 demo 59.4s（`style.json:16-17`）；本风格通常 **45–75s**（`STYLE.md:12`）。

**静默怎么用**：在**关键承诺之前**把音乐降到只剩房间底噪，让那句最重要的话落地（`STYLE.md:80`）。demo 用聚光冻结（spotlight freeze）。

---

## 4. 镜头逻辑

**镜头是什么**：一台录屏软件的镜头——屏幕内一镜到底、缩放 ≥ 1、只在章节转场时切、自动跟随光标、点击时轻微推近。

| 运动 | 表达 | 可服务 |
|---|---|---|
| 推近光标/插入符 | 「事情发生在这里」 | 打 prompt；选菜单；改设置 |
| 静止时缓慢漂移 | 应用是活的 | 一行旁白；等结果 |
| 窗格间甩镜（带模糊） | 因在这里、果在那里 | 发消息 → 结果；代码 → 预览 |
| 推近 + 暗角冻结 | 唯一要记住的承诺 | 安全保证；价格；撤销 |
| 窗格间 rack focus | 注意力移动，其它不动 | 读文件；日志滚动时聊天在等 |
| 拉回整个窗口 | 整条工作流 | 总结；并行任务；前后对比 |
| 跟吉祥物沿列表走 | 软件在逐项处理 | 扫结果；清单；迁移 |
| 分屏重构图 | 两件事同时发生 | 并行会话；对比两版本 |

**允许的转场**：章节胶囊擦除、**像素块擦除**（32×18 方块从左下扫到右上，中间一只奶油色小吉祥物跑过）、主题揭示圆、在转场遮挡下换机位。

**禁止**：溶解或截图；吉祥物浮空/漂离元素；盖住要读的文字或坐在字幕下；对文字做假景深或缩放超出屏幕；画面里出现手/手臂/手指；把运动模糊加在已变换的层上。

---

## 5. 表达习惯（idioms）

1. **Match-cut 起源**：吉祥物从 UI 里已有的东西里诞生并爬出来，留下轮廓。
2. **Diegetic title**：产品名作为真实 UI 元素出现，吉祥物在重拍上落到它上面。
3. **移动的地板**：吉祥物骑着插入符、浮层、被发出的消息、进度条。
4. **带标签的延时**：长活儿以 N× 跑 + 闪烁标签 + rack focus。
5. **聚光冻结**：推近并给唯一承载承诺的徽章打暗角。
6. **片子本身改变状态**：开关的效果逃出预览、接管整片，稍后还回来。
7. **细胞分裂**：新会话劈开屏幕，吉祥物像素爆散分裂。
8. **光标与吉祥物是角色**：光标拍它、戳它、拖它，它会反应。
9. **卡拉 OK 词**：吉祥物随被说出的词逐词跳。

---

## 6. 氛围

一张真实的桌面：应用窗口浮在壁纸上、柔和阴影；UI 是产品自己的主题；吉祥物是一小块饱和品牌色，最先被眼睛找到。整体是**友好、精确、每件事都真的发生了**的气质。

---

## 7. 声音

- **两个分辨率的配乐**：高保真层（钢琴、立式/电贝斯、鼓刷/紧实鼓组、钟琴、真采样）是「世界」；**chiptune 方波是吉祥物**。可交替/二重奏/融合。
- **动作声**：键盘（thock + click，带人手抖动）、触控板点击、窗格 swish、浮层 pop、通知铃声、CI tick、截图快门；吉祥物的走/跳/落地是 8-bit 的。
- **混音规则**：一功能一句、产品名用 whisper 验证；**效果声避开词的首音**；音乐在人声下压；−14 LUFS。静默用在关键承诺之前。

---

## 8. 变化空间（可自由发挥）

功能与顺序、吉祥物、故事、开场、结尾、镜头路径、章节与音乐。`STYLE.md:116-118`：
- **结构**：一场捉虫（一个章节）；一个用户的一天（主题与音乐随时辰变）；一场比赛（两窗口并排，右边赢）。
- **开场**：半途（写了一半的文档）；通知（toast 落下，吉祥物在里面）；空状态（吉祥物从菜单栏掉下来）。
- **结尾**：吉祥物睡着、窗口暗下；应用关掉、它留在 Dock；一次真分享（搭着结果出画）。

---

## 9. 禁忌清单

- 暗色 keynote（黑舞台、凭空发明的抽象 UI）。
- 像素游戏（世界是高分辨率矢量 UI）。
- 任何一帧是真实截图。
- 编造的功能或改名的模式。
- 画面上出现手/手臂/手指。
- 溶解/划像转场。
- 对要读的文字做假景深，或缩放超出屏幕。
- 照抄任何真实的角色、UI、音乐或素材。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约

### 10.1 内容文件字段
`demo/lines.json`：[{id, text, voice, speed, lang, asr?}]（demo：`am_michael` / 1.0 / en-us）。时间线 `film.js` 的 `VO` 是 {id: 起点秒}；字幕强调用 `{}` 包住。

### 10.2 新吉祥物的契约
替换 `clawd.js`：`grid({eyes, arms, legs})` → [[c, r, kind]]（1 身体 / 2 眼睛）；`sprite({...pose})` 渲染 SVG；`pixels(o)` 给像素爆散；`pixart(rows, o)` 画任意像素图；道具共享同一网格。眼睛 n/l/r/u/d/blink/happy/wide/shut，手臂 down/up/wave/tuck，腿 stand/walkA/walkB/tuck/none。

### 10.3 时间线契约
`film.js` 是唯一时间线：`BPM/B/DUR/VO/EV`、`W(id,word,n)`/`WE(id,word,n)`（画面节拍挂词）、`camAt(t)`、`build(words)`、`frame(t)`。页面契约：`window.READY` / `render(t)` / `DUR` / `EV` / `SUBS` / `T`。

### 10.4 事件词汇

| type | 含义 |
|---|---|
| `vo{id}` | 人声 |
| `step{v}` / `jump{d}` / `land{v,big}` | 吉祥物脚步 / 起跳 / 落地（8-bit） |
| `key{v,sp}` / `tkey` / `tenter` | 键盘 / 终端键 / 终端回车 |
| `blip{n}` / `blink` / `morph` | logo 方块亮 / 眨眼 / 方块变精灵 |
| `winopen` / `hit` | 窗口打开 / 重拍落地 |
| `click` / `pop` / `enter` / `chip` / `send` | 点击 / 浮层 / 回车 / @ 选中 / 发送 |
| `pane` / `whoosh{d}` / `read{i}` / `tick` | 窗格 / 甩镜 / 逐行读 / 高亮 |
| `write` / `dash` / `tool` / `count` / `rkey{v}` | 写计划 / 虚线走开 / 工具调用 / 数字滚动 / 连续修订 |
| `boing` / `stomp` / `darkon` / `shutter` | 被拍 / 跺按钮 / 暗色扩散 / 快门 |

由 `sound.py` 消费（含 ducking）。

---

## 11. 构建链

```
sh styles/living-screencast/demo/build.sh   # 全渲染约 30s
  # film.js 是时间线；ui.js 状态→HTML；clawd.js 精灵；main.js 层/锚点/模糊/HUD
  # sound.py 从 events.json 造配乐+foley+VO（含 ducking）
```
（`DEMO.md:92-99`）

---

## 12. 证据

```
styles/living-screencast/STYLE.md:14-24     本质 + 不是什么
styles/living-screencast/STYLE.md:26-33     材料与渲染
styles/living-screencast/STYLE.md:35-40     颜色逻辑
styles/living-screencast/STYLE.md:42-47     字体与字幕
styles/living-screencast/STYLE.md:49-56     运动质量
styles/living-screencast/STYLE.md:58-73     镜头词汇表 + 转场
styles/living-screencast/STYLE.md:75-81     声音
styles/living-screencast/STYLE.md:83-95     九条 native moves
styles/living-screencast/STYLE.md:97-106    媒介陷阱
styles/living-screencast/STYLE.md:108-110   引擎文件清单
styles/living-screencast/STYLE.md:112-118   变化空间
styles/living-screencast/DEMO.md:3          不要复用故事/叙事弧/镜头/道具/时长
styles/living-screencast/DEMO.md:10         demo 故事（四章）
styles/living-screencast/DEMO.md:14-21      六条硬规则
styles/living-screencast/DEMO.md:23-34      导演工具箱十项
styles/living-screencast/DEMO.md:38-53      逐拍镜头表
styles/living-screencast/DEMO.md:55-78      配乐/动作数值
styles/living-screencast/DEMO.md:80-84      调色板
styles/living-screencast/DEMO.md:86-88      片尾卡
styles/living-screencast/demo/film.js:6-9   BPM/DUR/VO
styles/living-screencast/demo/film.js:13-18 W()/WE()
styles/living-screencast/demo/film.js:25-34 typing()/typed()
styles/living-screencast/demo/film.js:37-47 EASE/camAt()
styles/living-screencast/demo/film.js:50-91 Actor 表演
styles/living-screencast/demo/film.js:94-114 Cursor
styles/living-screencast/demo/film.js:125-134 build() 与字幕
styles/living-screencast/demo/film.js:136-217 五段编排
styles/living-screencast/demo/film.js:303    frame(t)
styles/living-screencast/demo/clawd.js:1-22 18×10 网格
styles/living-screencast/demo/clawd.js:25-33 sprite()
styles/living-screencast/demo/clawd.js:39-70 道具/尘土/速度线
styles/living-screencast/demo/main.js:29-31 A() 量 DOM
styles/living-screencast/demo/main.js:33-36 运动模糊
styles/living-screencast/demo/main.js:85-99 HUD
styles/living-screencast/demo/main.js:102-116 wipe()
styles/living-screencast/demo/ui.js:3-6     窗口几何
styles/living-screencast/demo/ui.js:104-139 真实被测代码与窗口
styles/living-screencast/demo/sound.py:44-46 小节/和弦/声场
styles/living-screencast/demo/sound.py:62-114 groove()/theme()
styles/living-screencast/demo/sound.py:144-153 键盘/浮层/甩镜/boom
styles/living-screencast/demo/sound.py:204-205 duck
styles/living-screencast/demo/lines.json:1-121 17 行旁白实测
styles/living-screencast/style.json:16-17   frame_sec 5.94 / dur 59.4
```
