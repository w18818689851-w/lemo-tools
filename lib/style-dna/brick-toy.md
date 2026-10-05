# 积木玩具（brick-toy）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Rocket from Spare Parts》的具体内容（那个宇航员、那支火箭、那摞书月亮都不是风格）。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部在**真实桌面上用微距镜头**拍出来的**积木定格动画**：世界由带圆凸点的互锁塑料砖搭成，角色一个姿势一个姿势地「拍两格」动起来，真实的家用物件在虚化的背景里当风景。

**它不是**：低多边形等距小岛（平涂切面、悬浮立体模型）、黏土/毛毡定格（砖是刚性的、永不形变）、干净的产品渲染（这个世界被玩过、被打翻过）。
**绝不用任何品牌名、logo 或小人剪影**——角色是「用砖搭出来的」。（`STYLE.md:14`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **塑料** | ABS + 强清漆（clearcoat ~0.85、clearcoatRoughness ~0.07）；粗糙度贴图带指纹（同心弧）与划痕（基础 ~0.17、划痕到 ~0.65）；边缘倒角以挂高光。 |
| **几何** | 圆角箱体（bevel ~0.045 凸点）+ 带细唇的凸点。单位 = 1 凸点间距（8mm）；砖高 **1.2**、板高 **0.4**。 |
| **底板** | 大底板要**哑光**（清漆低于砖），否则会像彩色洗墙一样反射柔光箱。 |
| **布景** | 真实表面 + 真实纹理 + 真实比例道具（**1 米 = 125 凸点**）。 |
| **HDRI** | **中性日光影棚**（photo_studio_loft_hall），绝不用钨丝室内（白砖变橙）；背景强度 ~0.22、环境强度 ~0.45。 |
| **灯光** | 方向性主光（暖白 `#fff4e8`，阴影视锥按镜头收紧）+ 2–3 个 **RectAreaLight 柔光箱**（前主光、后冷轮廓光、大布景上方一个）。 |
| **AO** | GTAO（半径几个凸点）**强制**——压暗叠砖缝、凸点底部、接触点。没有它砖像贴上去的。 |
| **超采样** | **2×**（渲染 3840×2160 → 交付 1080p），否则细凸点边与倒角高光会闪。 |
| **景深** | 物理景深（CoC ∝ |1/focus − 1/z|）。光圈随景别缩放：特写最大、中景小些、广角最小。焦点永远在角色头或正在放下的砖上。 |
| **特效即砖** | 火、烟、水、光、天气、天体全部由板、圆砖、半透明件搭成，逐帧抖动或重建。**没有粒子系统、没有柔和渐变。** |

**关键取向**：`STYLE.md:87-96` 列了这媒介的陷阱——钨丝 HDRI 变橙、满清漆底板反光、平光无 AO、光圈过大糊掉英雄、快速上升物变点、球面段消失在圆柱里、道具串镜。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一个**温暖的说书人**（Kokoro `bm_george`，`en-gb`，speed ~0.9）。第三人称、现在时。语句短、留白多、亲切但不腻。次要声音（任务控制台，`am_adam`）走设备滤波（带通 380–2800Hz + 软饱和）并带 Quindar 提示音。

**长度（实测）**：单句 **6–45 字符**（约 1–9 英文词），全片只有 **4–6 行**，外加 3 个对讲倒计时单词（`Three.` / `Two.` / `One.`）。字幕是「玩具元素」：深色圆角药丸 + 文字旁一个小积木图标，最多两行，停留 ≥ max(1.8s, 语音 + 0.6s)。

**句首类型**（示例性，不是抄原文）：
- 格言式开场，点名主角：`Every rocket starts with one brick.`
- 极短递进：`Then another. And another.`
- 以挫折起句、不带情绪：`The first one fell apart.`
- 用一句安慰把失败翻成机会：`That's okay. Now we have spare parts.`
- 结尾把开头的格言换一个名词再说一遍：`And every moon base... starts with one brick.`

**这个风格里不会出现的句式**：
- 煽情或悲情（情绪由姿态、配乐与静默承担）
- 营销腔、感叹号堆叠（`amazing`、`epic`）
- 抽象概念当主语（只谈可被搭出来的东西、动作、零件）
- 长句或从句套从句（每句只承担一层，短到能落在一次搭砖动作上）

---

## 3. 叙事节奏

**信息投放顺序**：

```
开场微距（一块砖，背景虚化成真实物件）
  → 角色端着第一块砖走进来、放下（第一声 click）
  → 快速搭建（零件沿弧线飞入、每层落定一次 click，对齐配乐拍点）
  → 骄傲 → 塔开始晃 → 倒塌（音乐硬切）→ 安静的独处镜头
  → 捡起零件 → 翻找（扔掉轮子、小花）→ 找到大锥头
  → 用散落的砖重建二号火箭 → 检查（驾驶舱/尾翼）
  → 倒计时 → 点火 → 升空 → 巡航（跟拍，月球在前方）
  → 着陆积木月球 → 走出来、放下一块砖、挥手
  → 拉远到整个桌面的高广角（尺度揭示）→ 片尾卡
```

**时间挂在 143.555 BPM 的配乐小节上**：1 拍 = 0.4177s，1 小节 = 1.671s；所有剪辑点对齐小节；曲中第一拍 0.07s 被对齐到成片 **4.0s**（第一块砖扣下）。

| 层 | 规则 |
|---|---|
| 总长 | `DUR = 54.0s`（1296 帧 @24fps） |
| 动画步进 | **角色与砖 12fps**（`q(t)` 量化到 1/12s）；**镜头/焦点/火焰/飞行器 24fps** |
| 关键点 | title 4.15–5.6 / cone1 14.03 / wobble 15.70 / fall 17.37 / sit 20.9 / pickUp 25.2 / reprise 26.4 / found 29.0 / rebuild 29.9（每 0.19s 一块）/ coneLand 32.5 / count [33.3,34.3,35.3] / ignite 36.5 / lift 37.0 / land 44.2 / reveal 48.0 / end 51.71 |
| 吸附 | 砖飞入走弧线，overshoot **0.35 凸点 → 0 约 4 帧**；每次吸附 = 一声 click |
| 倒塌 | 重力 **420**（真实值 1225）、恢复系数 **~0.3**、预先模拟保证每次渲染一致 |
| 走路 | 腿摆约 ±0.55 rad + 一点上下颠 |

**总时长**：主 demo 54.0s（`style.json`）；DEMO.md 给该片弧线 45–60s。

**静默怎么用**：**把音乐切死**在倒塌瞬间，只留房间底噪与一只滴答的钟（`mix.py` 在整片每秒放一记钟表 tick，倒塌后的安静里最明显）；升空前音乐再次撤出，倒计时下面垫一个 72bpm 的心跳鼓。**静默里只留一个小的真实世界声音。**

---

## 4. 镜头逻辑

**镜头是什么**：一台**手持的微距相机**，架在真实桌面上，像在拍玩具照片——贴得很近、景深很浅、偶尔被撞击震一下。它不抒情，只是「把玩具当世界来拍」，并在结尾拉远揭穿这一切其实在桌上。

**词汇表**：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 单块砖/凸点的极微距，真实房间虚化 | 玩具尺度就是世界 | 开场；一个重要的细节；单个零件 |
| 到小人眼高的低角度 | 小小角色变得英雄 | 野心；骄傲；面对庞然大物 |
| 俯瞰整个表面的高广角 | 尺度揭示：原来一直是玩具 | 总结；反讽；完成品 |
| 低、广、孤独，角色缩在角落 | 渺小、失败 | 挫折；等待；失去 |
| 正面特写，手与砖在焦内 | 亲密、决定 | 一个选择；一次修理；一份礼物 |
| 撞击时的手持晃动 | 物理冲击 | 倒塌；抵达；碰撞 |
| 贴着运动物体跟拍，目的地在前 | 朝目标的动量 | 旅程；比赛；发射 |
| 顶视平面图 | 秩序、布局、地图 | 计划；分拣零件；俯瞰城市 |
| 从真实物件变焦到砖（或反向） | 同框两个尺度 | 「大世界、小制造者」；对比 |
| 绕成品环绕 | 骄傲、检视 | 产品；纪念碑；结果 |

**允许的转场**（必须来自玩具本身）：拍点/小节硬切（一次吸附可以是剪切点）；一只手把砖放到镜头前挡住它；沿桌面甩镜；从一个布景拉远进入下一个。

**禁止**：通用溶解/叠化；让前景杂物挡住画面边缘；不检查每个真实道具与每个镜头的关系；把镜头也做成 12fps 步进。

---

## 5. 表达习惯（idioms）

1. **吸附式搭建**：剧情就是一次搭建行为；零件沿弧线飞入、咔哒落定。
2. **无害的崩塌**：东西散架，零件变成新的东西；失败产出备用零件。
3. **真实桌上的玩具**：真实物件在玩具尺度下变成风景。
4. **手作定格**：12fps 姿势、极小的不完美、连火与水都用砖做。
5. **重搭成别的东西**：同样的零件重新排列，变成另一个物体。
6. **尺度揭示**：一直拉远，直到整个世界变成桌上的一件玩具。
7. **用真实刚体物理倒塌**：绕底边倾倒 → 独立刚体（重力略低、恢复系数 ~0.3、摩擦、落平），预先模拟。
8. **特效即积木**：火焰是半透明橙/黄圆片逐帧抖动，烟是白色圆砖逐帧长大外滚。
9. **姿势即表演**：每个情绪用一个大而可读、保持好几格的姿势表达。

---

## 6. 氛围

一个真实房间里的桌面：胡桃木、柔光箱、茶具、台灯、一摞书当月亮；塑料被玩过、有指纹和划痕。整体是「**温暖、顽皮、被认真玩过**」的气质——不是产品目录，而是「一个小世界在真实的桌上认真地活了一回」。

---

## 7. 声音

- **乐器**：小巧、原声、顽皮（钟琴、玩具钢琴、拨弦、尤克里里、口哨、拍手、口风琴）；一把铜管/管弦渐强用于「尺度」；一个心跳鼓用于悬念。（demo 用两首 CC BY 4.0 曲目，**按画面剪辑而非循环垫底**。）
- **动作声**：塑料吱呀（失败前）、极小的塑料脚步、许多 clack 叠成的 crash、砖的 click（短瞬态 + **~2.9kHz 与 ~4.6kHz 共振**）、木头上的 clack、零件堆哗啦、投掷的 whoosh、发现时的钟「叮」、砖在纸上滑动、滤波噪声搭出的马达/引擎。
- **混音规则**：人声压缩，音乐在人声下压低约 **40%**（`duck = 1 − .42·…`，0.25s 最大/均匀滤波保持，字间不回弹）；拟音走增益表（click .55 / clack .45 / crash .7 / whoosh .22 / thump .6 / step .18 / ding .35 / ignite .9 / roar .55）；整体 **−14 LUFS**；环境 = 低通 brown 噪声 ~0.02 + 每秒一记钟表滴答（立体声错位）。

---

## 8. 变化空间（可自由发挥）

结构、角色（或不要角色）、表面与它的道具、开场、结尾、镜头路径、节奏、颜色逻辑范围内的调色板、配乐。

`STYLE.md:106-108` 给了远离 demo 的方向：
- **结构**：一份目录（一拍一个搭好的东西、每个都在回答同一个问题，最后排成一列）；桌对面两个搭建者、作品朝彼此长过去；一次拆解（把成品逐块拆开讲里面有什么）。
- **开场**：一只手把一整箱砖倒到桌上、砖堆落成第一个形状；先给一个真实物件（马克杯、手机），再变焦到它脚下的小世界；空底板的顶视平面像地图一样被填满。
- **结尾**：剩下一块砖被拿在特写里、它引出的问题不回答；房间的灯灭了、只有一扇亮着的积木窗；一只真实的手伸进来把角色拿走。

---

## 9. 禁忌清单

- 任何品牌名、logo 或小人剪影（商标）——角色必须是用砖搭出来的。
- 黏土/毛毡式的形变——砖是刚性的，永不拉伸、压扁或变形。
- 低多边形等距小岛或干净的产品渲染。
- 用钨丝室内 HDRI（白砖变橙）——用中性影棚 HDRI + 略偏冷的调色。
- 给大底板满清漆（会像彩色洗墙反射柔光箱）——底板要哑光。
- 把镜头也做成 12fps 步进（读成抖动）。
- 用粒子系统或柔和渐变做火/烟/水——一切特效都必须是砖。
- 把光圈开太大（中距离英雄会被糊掉）。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

本风格**没有单独的内容 JSON**——旁白与字幕由 `story.js` 的 `VO` 数组驱动：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 如 `v1`..`v5`、`c3`/`c2`/`c1` |
| `t` | number | 出现时刻（秒） |
| `text` | string | 单行旁白；实测 6–45 字符，4–6 行 |
| `radio` | boolean（可选） | `true` 的行走对讲、显示 MISSION CONTROL 标签与红砖图标 |

语音时长由 `voices/dur.json` 提供（缺省回退 = 文本长度 × 0.07）。时间点、镜头表、片尾署名都在 `story.js`（`T`/`SHOTS`/`CREDITS`）；几何与材质在 `bricks.js`；角色在 `actors.js`；布景道具在 `set.js`；火箭/物理/特效在 `rockets.js`。

> ⚠️ 换 `VO` 重跑只是「验证引擎能重排」的技术检查，**不是做片子的方式**。

### 10.2 新画面主体的契约

一个新主体 = 用 `bricks.js` 的原语搭出来：
- `brick(w,d,color,{h})`（方砖/板）、`plate`、`mesh(roundGeo(r), color)`（圆砖）、`coneGeo`（锥）、`slopeGeo`（斜坡楔形，用于尾翼）。
- 材质用 `plastic(color,{trans})`（`trans` 走透射材质，用于火焰/玻璃）；每个 mesh 默认 `castShadow=receiveShadow=true`。
- 角色参考 `actors.js` 的 `makeAstro()`：腿 = 1×1 柱、躯干 = 2×2 砖、手臂 = 圆砖、头盔 = 圆 2×2 + **弧形开口圆柱面板**（不要用球面段做面罩——它会消失在圆柱里）；导出 `pose(p)`（角度全为弧度：`arm=[前后x, 侧抬z]`、`legs=[左,右]`、`sit 0..1`）与 `walkPose(phi, amp)`。
- 物理倒塌参考 `rockets.js`：先整体绕底边倾倒，θ>0.38 后散成独立刚体，用 `groundY(x,z)` 求地面高度。

### 10.3 时间线契约

`story.js` 导出 `DUR`（54）、`ANIM_FPS`（12）、`q(t)`/`qc(t)`、`BEAT`/`beat(n)`/`bar(n)`、`T`、`VO`、`SHOTS`（`[起,止,名]`）、`shotAt(t)`。
`main.js` 导出 `render(t)`（内部 `const t = q(t0)` 做 12fps 步进）、`window.DUR` / `window.EV` / `window.READY`；`?t=` 出静帧。渲染用 `core/render/video.mjs`（three.js + 2× SSAA + GTAO，24fps）。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者（mix.py） |
|---|---|---|
| `click{v,pitch}` | 砖的咔哒（每次吸附/落定） | 短瞬态 + 2.9/4.6kHz 共振 |
| `title` | 片名弹出 | pop |
| `whoosh{v}` | 零件飞入 | whoosh |
| `creak{v}` | 失败前的塑料吱呀 | creak |
| `crash` | 倒塌 | crash |
| `clack{v}` | 砖互相撞击 | clack |
| `thump{v}` | 落地/坐下 | thump |
| `step{v}` | 脚步（抽样表演得出） | step |
| `ding` | 发现 | ding |
| `quindar` | 对讲提示音 | quindar |
| `rumble{d,v}` | 点火前震动 | rumble |
| `ignite` | 点火 | ignite |
| `roar{d,v}` | 火箭轰鸣 | roar |

---

## 11. 构建链（复用机制）

```
node core/render/still.mjs styles/brick-toy/demo <t…>      # 逐段审图
.venv/bin/python core/tts/tts.py lines.json voices          # → asr_check.py 校对
node core/render/events.mjs styles/brick-toy/demo
python music/edit.py                                        # 按小节剪辑配乐
python mix.py                                               # 拟音 + 人声 + 配乐
node core/render/video.mjs styles/brick-toy/demo --fps 24   # 1296 帧，2× SSAA + GTAO
core/render/mux.sh out/video24.mp4 mix.wav brick-toy.mp4 24
```

**关键机制**：`story.js` 的时间点**对齐配乐小节**（`beat()`/`bar()`），`edit.py` 按小节剪辑把爆发点对齐点火、最后一个重音落在片尾卡；`main.js` 的 `events()` 产出的事件表喂给 `mix.py`（拟音）——所以换内容时拟音会跟着新事件重排。

---

## 12. 证据

```
styles/brick-toy/STYLE.md:6-14       本质与不是什么
styles/brick-toy/STYLE.md:16-25      材料与渲染
styles/brick-toy/STYLE.md:27-33      颜色逻辑
styles/brick-toy/STYLE.md:35-39      字体与字幕
styles/brick-toy/STYLE.md:41-47      运动质量
styles/brick-toy/STYLE.md:49-66      镜头语法表 + 转场
styles/brick-toy/STYLE.md:68-74      声音
styles/brick-toy/STYLE.md:76-85      原生手法
styles/brick-toy/STYLE.md:87-96      媒介陷阱
styles/brick-toy/STYLE.md:102-108    变化空间
styles/brick-toy/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/brick-toy/DEMO.md:9-11        一个角色一个目标 / 四个原生能力
styles/brick-toy/DEMO.md:13          弧线与四幕
styles/brick-toy/DEMO.md:17-26       逐镜镜头表
styles/brick-toy/DEMO.md:28          镜头数值（光圈/吸附/重力/恢复系数）
styles/brick-toy/DEMO.md:30-38       配乐结构 / 静默 / foley / 叙述者
styles/brick-toy/DEMO.md:40-47       调色与道具 / 宇航员构造 / 字幕数值
styles/brick-toy/DEMO.md:49-51       片尾卡
styles/brick-toy/demo/story.js:2-5           DUR / ANIM_FPS / q() qc()
styles/brick-toy/demo/story.js:7-10          143.555 BPM / beat()/bar()
styles/brick-toy/demo/story.js:12-37         T 关键时刻表
styles/brick-toy/demo/story.js:39-48         VO 旁白与对讲
styles/brick-toy/demo/story.js:51-58         SHOTS 镜头表
styles/brick-toy/demo/main.js:11-21          2× pixelRatio / GTAO / bloom / 暗角
styles/brick-toy/demo/main.js:124-170        cam() 光圈/焦点/fov + 视锥 + DOF
styles/brick-toy/demo/main.js:177-191        brickIcon() / pill()
styles/brick-toy/demo/main.js:192-216        hud() 片名 12fps 弹出 / 片尾卡
styles/brick-toy/demo/main.js:218-239        render() q(t0) 12fps 步进
styles/brick-toy/demo/main.js:242-266        events() 全部 type
styles/brick-toy/demo/bricks.js:6            BRICK/PLATE/STUD_R/STUD_H
styles/brick-toy/demo/bricks.js:7-10         COL 调色板
styles/brick-toy/demo/bricks.js:13-28        smudgeTex() 指纹 + 划痕
styles/brick-toy/demo/bricks.js:31-39        plastic() clearcoat .85
styles/brick-toy/demo/bricks.js:41-48        studs() 凸点 + 细唇
styles/brick-toy/demo/bricks.js:54-79        brickGeo/roundGeo/coneGeo/slopeGeo
styles/brick-toy/demo/actors.js:9-55         makeAstro() 角色构造
styles/brick-toy/demo/actors.js:57-61        walkPose()
styles/brick-toy/demo/set.js:10-14           M=125 / TOP / PAD / MOON
styles/brick-toy/demo/set.js:17-21           影棚 HDRI / 强度
styles/brick-toy/demo/set.js:24-37           胡桃木 + 主光 + 柔光箱
styles/brick-toy/demo/set.js:63-89           书（月亮）+ 积木月球
styles/brick-toy/demo/set.js:92-95           哑光绿底板 + 发射台
styles/brick-toy/demo/rockets.js:11          G = 420
styles/brick-toy/demo/rockets.js:24-79       倒塌模拟（刚体 + 恢复系数 + 落平）
styles/brick-toy/demo/rockets.js:112-115     火焰（透明圆片）+ 烟（白圆砖）
styles/brick-toy/demo/rockets.js:229-246     火焰/烟逐帧抖动
styles/brick-toy/demo/mix.py:9               foley 增益表
styles/brick-toy/demo/mix.py:13-27           事件 → 拟音映射
styles/brick-toy/demo/mix.py:29              72bpm 心跳鼓
styles/brick-toy/demo/mix.py:35              对讲 radio 滤波
styles/brick-toy/demo/mix.py:41-45           室内底噪 + 钟表滴答
styles/brick-toy/demo/mix.py:50-51           duck .42 + mix 电平
styles/brick-toy/demo/music/edit.py:1-4      按小节剪辑
styles/brick-toy/demo/lines.json:1-10        旁白原文
styles/brick-toy/style.json:16-17            frame_sec 38.88 / dur 54.0
```
