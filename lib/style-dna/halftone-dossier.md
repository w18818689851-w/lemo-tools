# 复古半调案卷（halftone-dossier）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《胖橘案卷 / Case File: Chubby》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部复古印刷的案卷片：米色档案纸、几种平涂油墨套印的半调网点、带错位阴影的巨型粗体标题、会「啪」地砸下的橡皮图章、粗描边的角色；片子本身就是一份**一件件被读出来的证据**的卷宗。

**它不是**：Risograph（整个观感不是颗粒双色 riso、不是 zine 拼贴）、Swiss motion（不是白底网格动态字体）、Game Show Flat（不是糖果布景、不是节奏游戏回合）。**每一帧都必须看得见网点、纸和图章**（`STYLE.md:13`）。

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸层**（乘在所有东西之上，只建一次） | 放大过的随机小图做斑驳 + 逐像素噪声（略偏暖）+ 径向暗角 `rgba(120,100,80,.35)` + 一条淡中央折痕（x=960）；**暗场也印在纸上，绝不发光**。 |
| **颗粒层**（每帧） | 520 个纸色小点（r 0.6–2.4、α .75）+ 90 个墨色小点，每 2 帧重新播种——印张上的灰，不是胶片颗粒。 |
| **半调** | 一个旋转的圆点网格画成**一条 path**；step 20–26px；每层不同网角（15°/20°/25°/30°/45°/60°/70°）；半径 = 密度 × step × maxK，maxK 0.6–0.72（~0.7 时点在满密度处并成实墨）；第二层 `class='mul'` 套印。密度场：`radial(cx,cy,R,pw)` / `edge(R,pw)` / 线性渐变。 |
| **半调数字** | 巨型 Bagel Fat One 数字（700–760px）出血到右边缘，平涂后套印一个裁到字形的更暗半调。 |
| **线条沸腾** | `feTurbulence` 0.022 → `feDisplacementMap` scale 5，每 0.1s 重播种（40 种子循环）+ 细墨粒遮罩；**只用于角色和手绘道具**，绝不用于文字/半调/HUD/字幕。 |
| **角色** | 敦实 kawaii 形状 + **7px navy 描边**、平涂、cream 肚子/爪子、粉耳内与腮红、深橙条纹；大而有光泽的眼睛会眯/眨/闭成开心的弧；所有身体姿势共用一个 `catHead`。 |
| **图章** | 双层圆角矩形（外框 10–14px、内 0.35×）+ 120–210px 文字，过 `#stampInk`（位移 7 + 粗墨粒遮罩）；不透明度 0.93、倾斜 −10°…+12°。 |
| **道具** | 星爆、对话气泡、彩带、放射线、便签、文件夹、时钟：平涂 + navy 描边。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：**没有旁白，卡片就是字幕**（`DEMO.md:8`）。公文/案卷口吻，现在时为主。

**长度（实测）**：卡片极短——中文标题/字幕 **2–20 个 CJK 字**（最短 `喵。` / `结案` 2 字，最长一句约 17–20 字），拉丁文约 2–3× 长（`STYLE.md:44`）。

**卡片 = 标题 + 字幕条**：每拍一个标题（serif 900、逐字弹出）；罪状类还有一条**字幕条**——navy 圆角胶囊（r 14）+ 粉色错位阴影（+8/+8，multiply）、Noto Sans SC 900 46px cream、**关键词用黄或粉**；在标题后约 1s 弹出（0.4s、略 −1.2° 倾斜），停到该场结束（≥1.8s）。

**HUD**：左上案号（`案卷 No.2026-CAT-001`，JetBrains Mono 22）+ 章节 chip（`罪状 01 | 测试重力`）；右上 REC 点 + 日期；暗场反色；标题卡隐藏。

**句首类型**（示例性）：
- 案卷式标题（案号 + 起诉书）
- 罪名编号标题（`罪状 01 · 测试重力`）
- 陈述事实的字幕条（`每天测试 17 次重力，结论永远一样。`）
- 一个图章词（惯犯 / 无罪释放 / 结案）
- 感叹式插入词（`啪！` / `太可爱了`）

**这个风格里不会出现的句式**：长句/从句；第一人称抒情与评论；把字幕做成细的通用 caption；喘气式煽情旁白。

---

## 3. 叙事节奏

**信息投放顺序**：

```
标题 → 指控 → 嫌疑人档案（mugshot：正面照 + 身高尺 + 名牌 + 闪光）
  → Count 01 / 02 / 03（每拍背后一个巨型半调数字）
  → "综上所述"（证据卡）
  → 判决图章 → 理由 → 结案
```

角落的案号 HUD 与章节 chip 让观众保持方向。喜剧来自「官僚的严肃」与一个琐碎可爱对象之间的落差。

**时间挂在 120 BPM 网格上**：1 小节 = 2s（`DEMO.md:29`）。

**demo 弧（30s）**：标题(1) → 指控 + 第一个图章(1) → mugshot(2) → Count 01(2) → Count 02(2，夜里换调色板) → Count 03(2) → 总结 + build(1) → **drop 上的判决图章(1)** → 理由(1) → 结案 + 版权(2)。**每次剪辑都落在小节线上。**

| 动作 | 值 |
|---|---|
| 进入 | back ease 过冲（1.9）0.3–0.45s；对象从画框下方升起或从 0 缩放 |
| 逐字弹出 | 每字掉落 30–100px + 压扁，错开 0.05–0.08s（小字 0.02s） |
| 图章猛砸 | 0.09s 从 2.6× 到 1×（ease-in）+ 5% 阻尼回弹；同一帧相机抖 + 白闪（判决 23.0s 闪 0.5）+ 图章音效 |
| 压扁落地 | `sq = 1 − k·e^(−a·7)·cos(a·20…22)`，`scale(1/sq, sq)` 保持体积 |
| 点状擦除 | 80px 网格、r→62、0.44s 居中在每个切点，带对角延迟；画面被盖住时切场 |
| 线条沸腾 | 10fps（角色），变换 30fps |

**总时长**：demo **30.0s**（`style.json:17`、`render.mjs:17`）。STYLE 明确：**三个展品约 30s，五个约 60s**。

**静默怎么用**：**判决图章之前把音乐清空**，让图章独自落下（demo：drop 把第 11 小节前半留空，判决图章在 23.0 单独落地）。

---

## 4. 镜头逻辑

**镜头是什么**：一台架在扁平、正面的一页纸上的 2D 摄影机（一个 `#cam` 组，没有 3D）。

**词汇表**（用法由主题决定）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 锁死正面 + 小拍脉冲（~0.6%） | 这页是一张海报、在律动 | 标题；一个清单；一次指控 |
| 缓慢推进（1 → 1.05–1.08） | 审视、张力上升 | 档案；判决前的总结 |
| 二次衰减的抖动（5–26px） | 冲击 | 图章；碰撞；落地 |
| 闪帧（白覆盖 ≤0.95→0，大击封顶 0.5） | 被拍照、一次揭示 | mugshot；判决；找到证据 |
| 平移过一块钉住的板 | 展品之间的联系 | 时间线；嫌疑人；事件链 |
| 啪地推近半调细节直到点巨大 | 「再靠近看」 | 指纹；签名；一个数字 |
| 翻页 / 文件夹滑过 | 下一份文件、下一章 | 第二个案子；闪回 |
| 拉远露出整张桌子 | 这份文件只是众多之一 | 尺度；"这每天都在发生" |

**构图**：像印刷页一样——标题左上、主体右中、字幕条底部居中（y=980）、HUD 在四角。

**允许的转场**：点状擦除（每切点可有自己的颜色）；硬切（对比手段，用在大击上）。

**禁止**：溶解；非拍点剪辑；在文字/半调/HUD/字幕上加线条沸腾；100% 白闪（读成掉帧，封顶 ~0.5）。

---

## 5. 表达习惯（idioms）

1. **指控框架**：一个主题变成「X 的案子」——列出它的罪状。
2. **编号展品**：每一拍背后有一个巨型半调数字。
3. **图章**：一个判决是一次物理猛砸。
4. **Mugshot**：正面对象 + 身高尺 + 名牌 + 闪光。
5. **证据板**：展品被钉住、用线连起来，然后被摇。
6. **点密度 = 情绪**：点膨胀成光晕、向边缘挤表示张力、径向绽放表示喜悦。
7. **涂黑**：黑条印在词上，再一条条抬起来。

---

## 6. 氛围

一间档案室 / 一张印刷台：米色档案纸、几种平涂油墨、错位的套印、砸下来的图章；有纸和墨的味道。整体是**官僚式严肃 vs 可爱对象**的喜剧气质，而不是温暖或精致的。

---

## 7. 声音

- **合成流行-印刷工具箱**：synth kick、snare、clap、hat；方波式八分 bass；三角波 pad；**马林巴式拨弦**（基频 + ~4× 泛音）主旋律 + 轻八度回声；pizzicato 与指响做潜行（demo 第 6–7 小节 = Count 02）；军鼓滚 + 上升正弦扫做 build（第 10 小节 = 总结）；**drop 把第 11 小节前半留空**让判决图章在 23.0 单独落地；音乐盒铃做 outro + 一条铃琶音收尾（`music.py:1`）。
- **拟音按印刷与笑点**：图章 = 音高下坠 boom + click（大图章加 crackle）；相机快门；纸滑与文件夹扑动；打字机/键盘键击；进擦除前的呼啸；每个字形一个 pop；角色用 boing 与 plop；易碎品用玻璃/陶瓷；合成的动物/生物声（共振峰扫描，如 meow）。
- **静默前图章**：判决前清空音乐，让图章独自落地。
- **混音**：冲击时音效走在音乐前面；主输出软削波；−14 LUFS、真峰 ≤ −1 dB。demo：峰值归一 ×1.6 → `tanh` 软削波 ×0.9 → 1.2s 淡出；封装 −1.6dB + AAC 256k/48kHz，实测 −14.5 LUFS 积分、−1.2 dBTP。

---

## 8. 变化空间（可自由发挥）

这份文件关于什么、它的罪状或展品、角色（或没有）、颜色逻辑之内的油墨、语气（闹剧还是严肃）、开场、结尾与长度（**三个展品约 30s，五个约 60s**）。

`STYLE.md:114-116` 给了远离 demo 的方向：
- **结构**：一份解密报告（一页页揭去涂黑直到真相露出）；一份失踪人口档案（从最后一次目击倒着讲）；一份保险索赔（每个展品都与索赔人的说法矛盾）。
- **开场**：证据袋（暗墨底上一个物件，文件在它周围拼起来）；一个巨大网点里的指纹，拉远时解成一张脸；一通电话（纸上只有一条字幕条，文件随后落下）。
- **结尾**：文件被放进装满同样文件的抽屉；一页涂黑的最终页（答案留在黑条下）；图章砸偏了（落在桌上，对象自由地走出画面）。

---

## 9. 禁忌清单

- Risograph（整个观感不是颗粒双色 riso、不是 zine 拼贴）。
- Swiss motion（不是白底网格动态字体）。
- Game Show Flat（不是糖果布景、不是节奏游戏回合）。
- 渐变（明暗只能来自点的大小与套印）。
- 在文字、半调、HUD、字幕上加线条沸腾。
- 溶解转场。
- 超过五种油墨加纸（会失去印刷感）。
- 照抄任何真实印刷品、版式或字体。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

- `index.html` 的 `C` 调色板与 `F` 字体。
- 10 个 `scene(t0,t1,build)` 的字符串字面量（标题、字幕条、图章词、名牌/档案/文件夹文本）。
- HUD 的 `chips` 表 `[t0,t1,section,title]`；`WIPES`（每切点颜色）；`SHAKES`（冲击时刻）。
- `music.py` 的 `PLAN`（每小节和弦/旋律/模式）与 SFX 表（时间从 `index.html` 抄来）。
- `fetch_fonts.mjs` 的 `fams` 与 `init()` 的预加载表。

### 10.2 新画面的契约

用 `index.html` 里的助手画：`el/txt/tf/op/show`、`chars(...)` + `charsPop(...)`、`halftone(...)`（密度场 `radial`/`edge`，套印加 `class='mul'`）、`caption` + `captionAnim`、`stampEl` + `stampAnim`、`bg`。
角色用 `catHead` + `setFace(cat,{...})` + `blinkAt` + 身体 `catSit/catRun/catLoaf/catCurl` + `runCycle`。
**契约**：`scene(t0,t1,build)`——`build` 建一次节点、返回 `update(t)`，`update` 用**绝对**时间。

### 10.3 时间线契约

全部在 `demo/index.html` 一个文件里：`scene(t0,t1,build)`（349）、`render(t)`（1039）、`init()`（1066，两遍字体预加载 → `buildPaper()` → `buildAll()` → `window.READY=true`）。
`render.mjs` 只依赖 `window.READY` 与 `window.render(t)`；改长度就同时改两个文件的 `FPS`/`DUR`。

### 10.4 事件词汇

由 `music.py` 末尾的 SFX 表声明（时间从 `index.html` 抄来）：每个标题字一个 pop、头探出来的 boing、每个图章的 `stamp()`（音高下坠 boom + click，`big=True` 加 crackle）、mugshot 闪光的 `shutter()`、合成的 `meow()`（共振峰 /i/→/a/→/u/）、杯子的 `clink`、破碎的 `crash_glass()`、每次擦除前的 whoosh、猫躺键盘的 `plop` + 一串 `key_click`、"太可爱了" 的 `sparkle`。

---

## 11. 构建链（复用机制）

```
1. （只在换字体时）cd styles/halftone-dossier/demo && node fetch_fonts.mjs（需联网）
2. 无 TTS（跳过）。若加旁白，先按旁白给场景定时。
3. .venv/bin/python styles/halftone-dossier/demo/music.py → demo/music.wav（≈1s）
4. 复审：Chrome 打开 demo/index.html?t=11.2，
   或 node .../render.mjs stills 3.3 7.2 11.25 23.3 27.8 --dir out/review（≈0.25s/帧）
5. 渲染：node .../render.mjs video 2 → demo/out/seg_*.mp4 + video_noaudio.mp4（CRF 12 母版）
   900 帧 ≈ 0.24s/帧/worker → 2 worker 约 2 分钟
6. 封装：node .../render.mjs mux → styles/halftone-dossier/halftone-dossier.mp4
   （x264 CRF 16 + music −1.6dB + AAC 256k/48k）
```
（`DEMO.md:134-139`）

**关键机制**：`init()` 必须**两遍字体预加载**（对整个页面源码 + 对已构建的 SVG 文本）——布局用 canvas `measureText`，若某个 Google Fonts 的 unicode-range 切片还没加载，逐字位置会用回退字体算，字形会重叠（`DEMO.md:143`）。

---

## 12. 证据

```
styles/halftone-dossier/STYLE.md:8-11       本质四条
styles/halftone-dossier/STYLE.md:13         不是什么
styles/halftone-dossier/STYLE.md:17-24      材料与渲染
styles/halftone-dossier/STYLE.md:28-33      颜色逻辑
styles/halftone-dossier/STYLE.md:37-44      字体与字幕
styles/halftone-dossier/STYLE.md:48-54      运动质量
styles/halftone-dossier/STYLE.md:58-71      镜头语法表 + 构图
styles/halftone-dossier/STYLE.md:75-79      声音
styles/halftone-dossier/STYLE.md:85-91      native moves
styles/halftone-dossier/STYLE.md:110        长度（三展品 30s / 五展品 60s）
styles/halftone-dossier/STYLE.md:114-116    变化空间
styles/halftone-dossier/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/halftone-dossier/DEMO.md:5           自包含 index.html + Playwright 30fps
styles/halftone-dossier/DEMO.md:8           屏上全中文 + 无旁白
styles/halftone-dossier/DEMO.md:12          故事结构
styles/halftone-dossier/DEMO.md:14          响但可读：一个想法/2–4s 卡片
styles/halftone-dossier/DEMO.md:20-25       六个 native moves 的用法
styles/halftone-dossier/DEMO.md:29          demo 弧 30s / 120 BPM / 剪辑在小节线上
styles/halftone-dossier/DEMO.md:37-43       逐拍镜头表
styles/halftone-dossier/DEMO.md:45-55       运动数值
styles/halftone-dossier/DEMO.md:59-63       配乐 / SFX / 图章前静默 / 母带
styles/halftone-dossier/DEMO.md:67-103      调色板 / 半调 / 纸 / 颗粒 / 线条沸腾 / 角色 / 字体 / 图章 / 道具
styles/halftone-dossier/demo/index.html:56-60        调色板 C
styles/halftone-dossier/demo/index.html:61-64        字体 F
styles/halftone-dossier/demo/index.html:94           measure
styles/halftone-dossier/demo/index.html:97-118       chars / charsPop
styles/halftone-dossier/demo/index.html:135-150      halftone + radial/edge
styles/halftone-dossier/demo/index.html:155          caption
styles/halftone-dossier/demo/index.html:174-190      stampEl / stampAnim
styles/halftone-dossier/demo/index.html:200-251      catHead / setFace / blinkAt
styles/halftone-dossier/demo/index.html:264-326      catSit/catRun/runCycle/catLoaf/catCurl
styles/halftone-dossier/demo/index.html:349          scene(t0,t1,build)
styles/halftone-dossier/demo/index.html:975          WIPES
styles/halftone-dossier/demo/index.html:995          buildPaper
styles/halftone-dossier/demo/index.html:1021         drawFx（颗粒）
styles/halftone-dossier/demo/index.html:1037         SHAKES
styles/halftone-dossier/demo/index.html:1039         render(t)
styles/halftone-dossier/demo/index.html:1066         init（两遍字体预加载）
styles/halftone-dossier/demo/render.mjs:17           FPS 30 / DUR 30
styles/halftone-dossier/demo/render.mjs:23-25        mux（CRF 16 / −1.6dB / AAC 256k）
styles/halftone-dossier/demo/music.py:1              纯代码合成 / 120 BPM / 一小节 2s
styles/halftone-dossier/demo/music.py:71-79          pluck / bell
styles/halftone-dossier/demo/music.py:111-122        stamp / shutter
styles/halftone-dossier/demo/music.py:178            meow
styles/halftone-dossier/demo/music.py:214-225        PLAN
styles/halftone-dossier/style.json:16-17             frame_sec 9.0 / dur 30.0
```
