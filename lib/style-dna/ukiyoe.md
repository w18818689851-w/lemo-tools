# 浮世绘（ukiyoe）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Toward the Mountain · 山へ五景》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「江户木版画活过来」的片子：**每一个镜头都是一整幅完整的木版画**——一张和纸、一道粗细双墨线边框、几块从不同版上印出来的平涂色块、最上层一道黑色主版墨线、一条竖式题签和一枚朱印。世界是**故意平的**：纵深来自层层叠压的水平色层、霞带与大胆裁切，绝不来自透视、光照或明暗。

**它不是**：加了纸纹叠加的平面矢量插画（没有木纹、没有套色错位）、中国水墨（没有洇开的墨晕，颜色是印上去的不是画上去的）、动画赛璐璐上色（形体上没有光与影）。
（`STYLE.md:16`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸就是画框** | zoom 1 时画面 = 一张和纸，位于粗细双墨线边框内（`FR` = x 44–1876、y 38–1042，3.4px 主框 + 外侧 9px 细线），外面还有一圈纸边。纸可坐在长装裱手卷上（`#c9b690`、260px 间隙、一端木轴）（`print.js:5`、`DEMO.md:60`）。 |
| **分版** | 每组颜色画进自己的离屏画布并缓存（g0 墨线 / g1 蓝 / g2 绿次色 / g3 红人物），以固定套色偏移合成：`g1 (2.2,−1.3)`、`g2 (−1.8,1.9)`、`g3 (1.5,2.2)`（`DEMO.md:76`）。 |
| **质感四步** | 木纹 `source-atop`（天空/水最强，α ≈ 0.1–0.17）→ 馬連擦痕 `destination-out`（α ≈ 0.38，深木 0.2）→ 胡麻摺斑点 `destination-out`（α ≈ 0.3）；主版只加斑点（α 0.12）；整张完成后叠浅色纸纤维（α ≈ 0.09）（`print.js:117-123`、`DEMO.md:78`）。 |
| **木纹** | 扭曲噪声场的等值线：`u = y·0.035 + fbm·9 + knots`，在 `|frac(u)−0.5| > 0.4` 处画细暗线 + 宽浓淡带（`print.js:64-76`）。 |
| **馬連擦痕** | ~260 条模糊圆弧压痕 + 70 条之字横向擦痕（`print.js:77-92`）。 |
| **ぼかし** | 逐像素生成，上边缘按列用低频噪声游走 ±20–30px。★ 绝不用 `fillRect` 条带（会留竖向接缝）（`print.js:181-196`）。 |
| **墨线** | 主版墨线 2.4–3px；大轮廓是**变宽填充笔画**，两端收尖，带 ±20–35% 低频宽度抖动（`print.js:156-171`）；远处用灰主版线或不用线。 |
| **介质的母题** | 霞 = 两端收圆的长平带（すやり霞，`print.js:198-205`）；松 = 平顶针叶垫；田 = 高而平的平行层，交叉线**平行且倾斜**绝不汇聚；雨 = 两组略不同角度的细直线叠在墨色ぼかし 天空下；水 = 分层蓝带、带间ぼかし，泡沫水花留成纸白（`STYLE.md:25`）。 |
| **朱印** | 字从红色里刻出来（`destination-out`），边缘磕损、印泥不匀；盖章动画 1.35 → 1，0.2s（`print.js:226-252`）。 |
| **人物** | 风景里很小（整张约 80–130px），平面、轮廓清晰；脸只用几笔（`STYLE.md:26`）。 |

**关键取向**：让它读起来像「印出来的」而不是「矢量图」的四件事——**纸永远可见、一色一版且套色错位、大色块有木纹与馬連痕、天空与水有ぼかし**（`STYLE.md:10-15`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位旅人在画边用**第一人称**低语，过去时，像题在画边的一首诗。Kokoro `am_adam`，speed 0.84–0.88，5 句短话（`DEMO.md:56`）。

**长度（实测）**：单句 **33–57 字符**（约 7–12 英文词）。最短 `Then the sea stood up between us.`（33 字符），最长 `From home, the mountain was no bigger than a grain of rice.`（57 字符）。硬规则：字幕停留 ≥ `max(1.8s, 语音时长 + 0.6s)`（demo 用 ≥ `max(1.8s, 语音 + 0.75s)`）（`STYLE.md:38`、`DEMO.md:56`）。字幕 = 一条**横向题签**：奶油色纸条 + 粗细双墨线边框 + 左侧一枚小朱印「旅」，Shippori Mincho 500 42px 墨色，居中放底部约 72px；以吃墨显现的遮罩「印」进来（0.22s），再淡出（0.25s）（`DEMO.md:90`）。

**句首类型**（示例性，不是抄原文）：
- 以「从家那边看…」的相对尺度起句：`From home, the mountain was no bigger than a grain of rice.`
- 以自然物为主语 + 教我/给我起句：`The rain taught me to walk slower.`
- 以时间状语 + 拟人化的「它」起句：`Some evenings, it waited for me in a window.`
- 以「然后」推进到一个戏剧性意象：`Then the sea stood up between us.`
- 结尾用一句对照式的顿悟收束：`The mountain never moved. Only I did.`

**这个风格里不会出现的句式**：
- 第二人称说教（这个风格是「我」在画边低语，不是导游在讲解）
- 网络口播腔、感叹号堆叠、营销话术
- 现代口语/俚语（语域必须像题画诗）
- 一句塞两个以上并列信息点

---

## 3. 叙事节奏

**信息投放顺序**：

```
开场（锁在空白纸上，第一幅画一版一版印出来：墨线 → 蓝 → 绿 → 红）
  → 早期几幅（锁死画面，像在看墙上的一幅画，主体很小）
  → 中间一幅（极慢推近一个取景装置，比如圆窗）
  → 转场（手卷从右向左滑过装裱间隙，越来越快：1.0s → 0.9s → 0.6s）
  → 高潮（全片唯一一次大运镜：先越出上边框摇进装裱纸、再俯冲进泡沫）
  → 高潮后（硬切到空白纸，停一拍 ma，再重印）
  → 结尾（从最后一幅拉远，露出整条手卷：每一幅并排 = 尺度揭示；片尾卡落在手卷上）
```

★ 全片的叙事由「**同一个恒定的主体每次落在画面什么位置**」来承担（`STYLE.md:78`、`DEMO.md:10-14`）。

| 层 | 停留规则 |
|---|---|
| **人物与自然** | 8 fps 分级（`story.js:3`） |
| **雨与快速的水** | 12 fps（`story.js:4`） |
| **相机** | 24 fps（分级会抖）（`STYLE.md:44`） |
| **吃墨显现** | 每块版约 0.34s，带噪边的斜向馬連扫过，落定时滑动 5–6px 对准（`story.js:30`、`print.js:207-222`） |
| **题签/印章** | 题签落下（淡入 + 短滑）；印章**盖**下（1.35 → 1，0.2s）（`STYLE.md:46`） |
| **native move** | ★ 需要约一秒的停留才读得出来；一秒内闪过的峰值读起来是噪声（`STYLE.md:47`、`DEMO.md:37`） |
| **高潮四拍** | waveRise [25.4,27.3] → hang（亮相）[27.3,28.5] → fall [28.5,29.7] → crash [29.7,30.4]（`story.js:20`） |
| **ma** | [30.4, 32.2]；重印 [32.2, 32.7, 33.2, 33.7]（`story.js:21-22`） |
| **字幕** | ≥ `max(1.8s, 语音时长 + 0.6s)`（`STYLE.md:38`） |

**总时长**：主 demo 44.0s（`story.js:2`；`style.json` dur=44.0，frame_sec=26.4）。

**静默怎么用**：静默是**間（ma）**：绝对静默，连混响尾巴都切掉（`STYLE.md:70`）。demo 在巨浪拍下后 30.40s 起 60ms 淡出，之后到 32.2s 完全静音（`mix.py:156-158`）；高潮里还插了一个 80ms 的静默吸气（`DEMO.md:33`）。

---

## 4. 镜头逻辑

**镜头是什么**：一只手卷的阅读者——镜头在版画**之上**、在版画**之间**移动，绝不在单幅画内部做 3D 旋转；它从右向左滑过装裱间隙把下一幅带进来，把纸当成一个实体对象来读。

**词汇表**（用法由主题决定，没有固定路线）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 锁死在一张纸上 | 在看墙上一幅版画 | 一个地方；一个肖像；一个静止的时刻 |
| 手卷滑动，右→左穿过装裱间隙（滑得越短越急） | 旅行、下一站 | 一段旅程；一串步骤；一场赛跑 |
| 极慢推近一个取景装置（窗、扇、门） | 注意力收窄 | 发现；思念；一个要紧的细节 |
| 摇过边框进入装裱纸 | 有东西比这幅画更大 | 一场洪水；一个传言；一个巨人 |
| 从一幅拉远到许多幅 | 连作被整体看到 | 一个总结；一条时间线；一次收藏 |
| 俯冲进质感（颗粒、斑点、纤维） | 介质本身变成了画面 | 一个梦；一次崩溃；一段记忆在消散 |
| 横摇过三连幅 | 一个场景一张纸装不下 | 一次游行；一场战斗；一个节庆 |
| 硬切到空白纸 | 間（ma），一次屏息 | 余波；一个决定前的停顿 |

**允许的转场**：手卷滑动、吃墨显现、洗回纸白、硬切到空白。

**禁止**：交叉溶解；3D 翻转；在单幅画内部做 3D 旋转；透视渲染/光照/明暗。

---

## 5. 表达习惯（idioms）

1. **一套连作**：一个恒定主体在不同构图里；故事由它每次落在画面何处来讲。
2. **手卷**：场景不切，镜头从右向左滑，下一幅到来。
3. **一版一版地印**：先主版墨线，再每块颜色略偏地落下、对准。
4. **纸就是白**：泡沫、雪、雾、空天都是没印的纸；白可以淹过画面、把版画洗回一张空白纸。
5. **画框是一个物体**：边框、题签、朱印都是实体的；大到一定程度的东西会冲破边框进入装裱纸。
6. **异版**：同一块主版用不同色版重印（昼→夜、春→冬）。
7. **三连幅**：一个场景被分到三张纸上，拼起来才读得出。
8. **序破急（jo-ha-kyū）**：慢、开阔、静止 → 渐聚的脉动 → 急速冲向峰值 → 硬切静默。

---

## 6. 氛围

一张和纸摊在桌上、旁边是刻好的版木与朱印泥：暖纸色、靛蓝的天空与水、偶尔一点朱红；没有光影，只有叠层、霞带与留白。整体是**安静、克制、被自然尺度压住的旅程感**。

---

## 7. 声音

- **乐器**：**日本乐器，不要钢琴与 pad**——三味线（`core/audio/pluck.py shamisen`，带 sawari 颤响）、尺八、箏、太鼓与締太鼓、小鼓/大鼓的呼喊、拍子木（hyōshigi）、小铃（`STYLE.md:68`）。
- **调式**：都节（miyako-bushi，demo 用 D E♭ G A B♭）、阳、律；尺八用长呼吸音、每个音滑进去、句尾 meri 下滑；三味线可以保持脉动或固定音型（`STYLE.md:69`、`DEMO.md:46`）。
- **动作声（按材质走）**：纸（馬連打圈摩擦 = 带通噪声 + 约 9Hz 圈状调制、手卷滑动、朱印 = 低频闷响 + 粘开细响）；木（版木放上台面、空心的脚步）；玻璃（风铃分音 2.36 / 5.15 / 7.98 kHz）；水；当季的鸟与虫（云雀、雁、鸢的 pii-hyoro）（`STYLE.md:71`、`mix.py:27-110`）。
- **混音规则**：人声平静、少数几句短话；音乐在人声下 duck ~8 dB（demo 最后一句 L5 压得更深到 0.25，其余 0.42），环境声 ~4 dB；整体 −14 LUFS；★ `mux.sh` grain **0**（纸本身就是颗粒）（`STYLE.md:72`、`mix.py:149-154`）。技术选项：绝对静默当 ma；留一个 sawari 音在响；自由呼吸乐句对着稳定脉动；拍子木加速（歌舞伎谢幕）；太鼓心跳收紧成滚奏；箏的滑音换季；入场前一声鼓喊（`STYLE.md:70`）。

---

## 8. 变化空间（可自由发挥）

那个恒定主体（或没有）、幅数、人物、开场、结尾、镜头路径、节奏与颜料组。所有方向都必须远离 demo 的《Toward the Mountain · 山へ五景》：

- **结构**：**异版**（同一条街的一块主版，分别重印成黎明、雨、节庆之夜、雪）；**三连幅展开**（三张纸一次揭示一张，三张拼起来故事才读得出）；**一幅画正在被制作**（刻版师的版木，一镜一块，每块的颜色讲一章）。
- **开场**：**一个极近的裁切**（一个极端前景的细节、灯笼或袖子填满整张纸，拉远才发现是一幅画）；**空白的版木**（刻好的木上墨、纸盖上去、馬連擦过，揭起来露出第一幅印品）；**先给装裱**（一条合拢的手卷展开到它的第一张）。
- **结尾**：**只剩一枚朱印**（版画褪回纸白，只有红印留下）；**画册合上**（纸像书页一样叠起，封面落下）；**最后一幅没完成**（只有主版墨线，色版再没落下）。

同时可换：颜料组（6–9 个平涂色相，每片一版）、主导色系、恒定的主体。★ 但「纸即画框 + 一色一版且套色错位 + 平涂叠层出纵深」这三条骨架不能拆（`STYLE.md:100-106`、`DEMO.md:12`）。

---

## 9. 禁忌清单

- 加了纸纹叠加的平面矢量插画（必须真有木纹与套色错位）。
- 中国水墨（没有洇开的墨晕，颜色是印上去的不是画上去的）。
- 动画赛璐璐上色（形体上没有光与影）。
- 用 `fillRect` 条带做ぼかし（会留竖向接缝）。
- 田地的透视网格（必须是平行、倾斜、平的叠层）。
- 交叉溶解与 3D 翻转。
- 在单幅画内部做 3D 旋转。
- 照抄任何一幅著名的真实版画（不复制《神奈川冲浪里》《赤富士》《大桥骤雨》），也不照抄它们的角色或构图。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

| 要素 | 说明 |
|---|---|
| **时间线** | `story.js`：`DUR`、`q8/q12` 分级、`GAP/SW/SLOT` 手卷布局、`T`（每幕落定时间、平移区间、巨浪四拍、ma、重印、题签/印章时刻）、`REVEAL_DUR`、`VO` |
| **旁白** | `lines.json`，每条 `{id, text, voice, speed}`；demo 5 行 am_adam 0.84–0.88 |
| **颜料组** | `print.js` 的 `PAL`，6–9 个平涂色相 |
| **分版** | g0 墨线 / g1 蓝 / g2 绿次色 / g3 红人物，各带固定套色偏移 |
| **画面** | `views.js` 五幅画缓存色版 + 逐帧 `paint()` |
| **音效事件** | events.json |

### 10.2 新画面元素的契约

用 `print.js` 画（可复用核心）：纸/木纹/馬連/斑点/分版/ぼかし/刻线/显现遮罩/题签/朱印。
- 切线与墨线：`smooth/dense/poly` + `carve(x, pts, w, {taper, seed, jit})`（变宽填充线，两端收尖）+ `line/fillPath`。
- ぼかし：`bokashi(...)`（逐像素、边缘按列游走）；霞：`kasumi(...)`。
- 套版印上：`stampLayer(dst, src, reveal, reg, shift)` / `stampFn(dst, fn, reveal, shift)`（吃墨显现 + 滑动对准）。
- 朱印：`sealCanvas(chars,size,{white,seed,col})` + `drawSeal(...)`（盖章动画）。
- 竖题签：`vtext/vlen/cartouche(...)`；大色块质感：`printTex(x, grain, baren, ox, oy)`。
- 山水/松/石/雨/鸟参考 `nature.js`，海与浪参考 `wave.js`，旅人骨架参考 `traveler.js`。

### 10.3 时间线契约

`story.js` 是唯一时间真值：导出 `DUR`、`q8/q12`、`GAP/SW/SLOT`、`T`、`REVEAL_DUR`、`VO`。`views.js` 把每幅画做成缓存色版 + 逐帧 `paint()`；`main.js` 负责相机、手卷、纸、显现、标题、字幕与事件；`mix.py` 读 events.json 做拟音/人声/配乐/ducking 与静默的 ma；`subs.py` 把 cue 导成 srt。页面契约（`main.js`）：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 |
|---|---|
| `baren{d}` | 馬連打圈摩擦 |
| `block` | 版木放上台面 |
| `slip` | 纸签落下 / 揭起 |
| `seal` | 朱印按下 |
| `scroll{d}` | 手卷平移 |
| `step{m}` | 脚步（`m='dirt'|'wood'`） |
| `cup` / `sip` | 茶碗 / 啜饮 |
| `chime` | 风铃 |
| `lark` / `geese` / `kite` | 云雀 / 雁 / 鸢 pii-hyoro |
| `hat` | 斗笠摩擦 |
| `gust` | 阵风 |
| `rise{d}` / `crash` / `fall{d}` | 浪立起 / 拍下 / 落下 |
| `amb{w,d}` | 环境（field/rain/tea/sea/high） |
| `vo{id}` | 人声（mix.py 从 voices/<id>.wav 读） |

全部由 `core/render/events.mjs` 序列化成 events.json。

---

## 11. 构建链（复用机制）

```
styles/ukiyoe/demo/
  print.js    纸、木纹、馬連、斑点、分版、ぼかし、刻线、显现遮罩、题签、朱印
  nature.js   山 + 雪沟、松、石、雨、雁、简笔浪爪
  traveler.js 旅人（走/站/扶笠/蓑衣/坐饮/背影/脱笠）
  views.js    五幅画：缓存色版（g0–g3）+ 逐帧 paint()
  wave.js     海行、浪的几何、分带浪身、分形爪、水花簇
  story.js    时间线（唯一真值）     main.js  相机、手卷、纸、显现、标题、字幕、事件
  lines.json  旁白   music/score.py  原创配乐   mix.py  拟音 + 人声 + 闪避 + 静默的 ma   subs.py  cue → srt
  build.sh    一键重建
```

1. `node core/render/still.mjs styles/ukiyoe/demo <t…>`（`--q nosub=1`、`--q test=trav` 看角色表、`--q poster=1`）。
2. `core/tts/tts.py lines.json voices` → `core/tts/asr_check.py`。
3. `node core/render/events.mjs styles/ukiyoe/demo` → `music/score.py` → `mix.py`。
4. `node core/render/video.mjs styles/ukiyoe/demo --fps 24 --workers 3`（1056 帧 ≈ 45s，Canvas2D）。
5. `core/render/mux.sh out/video24.mp4 mix.wav ukiyoe.mp4 24 0` → `check_asr.py ukiyoe.mp4`。

或直接 `sh styles/ukiyoe/demo/build.sh`。（`DEMO.md:98-118`）

---

## 12. 证据

```
styles/ukiyoe/STYLE.md:6-16           本质 + 不是什么（四件事让它是「印」不是「矢量」）
styles/ukiyoe/STYLE.md:18-26          材料与渲染（纸即画框/分版/质感/ぼかし/墨线/母题/朱印/小人物）
styles/ukiyoe/STYLE.md:28-34          颜色逻辑
styles/ukiyoe/STYLE.md:36-39          字体与字幕（横向题签 = 字幕、竖式题签）
styles/ukiyoe/STYLE.md:41-47          运动质量（8/12/24fps、吃墨显现、盖章、停一秒）
styles/ukiyoe/STYLE.md:49-64          镜头语法 + 构图 + 转场
styles/ukiyoe/STYLE.md:66-72          声音
styles/ukiyoe/STYLE.md:74-84          七个 native moves
styles/ukiyoe/STYLE.md:86-94          媒介陷阱
styles/ukiyoe/STYLE.md:100-106        变化空间
styles/ukiyoe/DEMO.md:3               不要复用故事/弧线/镜头/道具/时长
styles/ukiyoe/DEMO.md:5-6             demo 44s / 山へ五景
styles/ukiyoe/DEMO.md:8-16            五景 + 恒定主体 + 序破急 + native moves
styles/ukiyoe/DEMO.md:18-39           逐拍镜头表 + 高潮四拍 + 停一秒的教训
styles/ukiyoe/DEMO.md:41-56           配乐 + 乐器配方 + 拟音 + 人声 + duck
styles/ukiyoe/DEMO.md:58-86           画布/手卷/颜料组/分版偏移/质感配方/道具
styles/ukiyoe/DEMO.md:88-96           字幕题签/竖式题签/标题/片尾卡
styles/ukiyoe/DEMO.md:98-118          构建链
styles/ukiyoe/demo/story.js:2              DUR = 44.0
styles/ukiyoe/demo/story.js:3-4            q8 / q12
styles/ukiyoe/demo/story.js:7-8            GAP / SW / SLOT
styles/ukiyoe/demo/story.js:10-29          T 全表
styles/ukiyoe/demo/story.js:30             REVEAL_DUR
styles/ukiyoe/demo/story.js:33             VO 起始时间
styles/ukiyoe/demo/print.js:5              FR 墨线边框
styles/ukiyoe/demo/print.js:6-13           PAL 颜料组
styles/ukiyoe/demo/print.js:43-104         buildTextures
styles/ukiyoe/demo/print.js:117-123        inkify
styles/ukiyoe/demo/print.js:156-171        carve 变宽墨线
styles/ukiyoe/demo/print.js:181-196        bokashi 逐像素
styles/ukiyoe/demo/print.js:198-205        kasumi すやり霞
styles/ukiyoe/demo/print.js:207-222        stampLayer / stampFn
styles/ukiyoe/demo/print.js:226-252        朱印 + 盖章动画
styles/ukiyoe/demo/print.js:255-274        竖式题签
styles/ukiyoe/demo/print.js:277-279        printTex
styles/ukiyoe/demo/mix.py:27-42            纸拟音（馬連 9Hz）
styles/ukiyoe/demo/mix.py:53-55            风铃分音
styles/ukiyoe/demo/mix.py:89-91            crash
styles/ukiyoe/demo/mix.py:92-110           五处环境
styles/ukiyoe/demo/mix.py:143-161          配乐 + duck + 間 绝对静默
styles/ukiyoe/demo/lines.json:1-7          5 行旁白实测
styles/ukiyoe/style.json:16-17             frame_sec 26.4 / dur 44.0
```
