# 暗色科技发布（dark-keynote）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《Room to Think》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「**界面本身是主角**」的软件发布片：没有实体产品、没有玻璃渲染，主角是界面（光标、窗口、通知、方块、一个数字），活在近黑舞台上、被柔和冷光照亮，**只有一种品牌强调色**留给最重要的那一个元素。

**它不是**：玻璃产品渲染（没有实体）、录屏（没有真系统或 App）、全息 HUD（没有扫描线）、图表片（是一个数字，不是一张图）。
（`STYLE.md:12`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **舞台** | 近黑底色 + 上中部径向提亮；一个大型冷色光晕 `#3B4CCA` 以 8% 放在右上；四角 50–55% 暗角；发丝网格 `rgba(255,255,255,.032)` 每 48px、每第 4 条 `.06`；**无颗粒**。 |
| **UI 套件** | 全部原创、代码画：圆角窗口（半径 14、标题栏 40px，**绝不用交通灯按钮/菜单栏/Dock**）、通知卡、带等宽文件名的文件图标、程序化缩略图、列表行、标签页、徽章、进度条、统一方块。 |
| **表面** | 三级抬升暗面 `#12151C` / `#1A1E28` / `#222734`；1px 边框 `rgba(255,255,255,.08)`；1px 内顶高光 `.07`；柔和投影。 |
| **景深** | 2.5D 相机 `s = 1/(1/zoom − z)`；近镜头卡片随放大模糊；旋转用条带渲染透视（rotY ≤ ~24°）。 |
| **光** | 光是揭示工具：只有被光扫过的像素才亮，未照到停在 7%；光带柔前沿、glint 20%、耗时 1.3s。 |
| **运动** | 24fps on ones，不步进、不沸腾；一切落网格、落拍；缓动快出 + 一次小过冲（back s≈1.3）后立刻安定；出生 0.2–0.3s；消失被设计（一拍收一个部件 / 显像管关机压扁）。 |

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位克制、自信的产品播报员。第二人称、现在时，短促陈述。

**长度（实测）**：demo 6 行 **10–42 个字符**；最短 `Meet Tidy.`（10 字符），最长 `One press, and everything finds its place.`（42 字符）。字幕是一条 UI 组件——底部居中深色半透明胶囊（`rgba(12,14,19,.72)`、1px `rgba(255,255,255,.09)` 边、Inter 500 40px `#E8EAF0`、8px 强调色圆点），以 12px 上浮 + 淡入 0.16s 进入；停留 ≥ `max(1.8s, 语音 + 0.6s)`（`film.js:505`）。

**句首类型**（示例性，不是抄原文）：
- 第二人称点出用户处境：`Your desktop.` / `Your photos.` / `Your inbox.`
- 宣布式短句：`Meet Tidy.`
- 一句话把承诺说完：`One press, and everything finds its place.`
- 短语收束：`Room to think.`

**这个风格里不会出现的句式**：第一人称抒情；营销腔、感叹号堆叠；长复合句；抽象概念当主语。

> ⚠️ **打字即字幕**：由光标在画面里打出的文字不重复烧两遍——它只进 `.srt`（`lines.json` 的 `onscreen:true`，`film.js:505` 过滤掉）。

---

## 3. 叙事节奏

**信息投放顺序**（一次发布）：

```
平静钩子（光标在静默里打片名）
  → 打断（3s 第一条通知）
  → 累积（一次连续拉远，每小节加一层）
  → 过载插入（半秒级：999+ / 148 标签页 / 红色存储条）
  → 冻结 + 静默
  → 那一个动作（所有层对齐成一个和弦）
  → 光的揭幕
  → 大数字
  → 呼吸（UI 自己收起来、音乐自己减掉）
  → 回响（光标把第一句打完）
  → 片尾卡
```

**时间挂在 120 BPM 网格上**：1 拍 = 0.5s，1 小节 = 2s，1 个十六分 = 0.125s（`timeline.js:2`）。

| 锚点（秒） | 事件 |
|---|---|
| 0.75 / 2.5 | 片名第一个字 / 回车 |
| 3.0 / 3.5 / 3.75 | 三声通知 |
| 4.0–12.0 | 连续拉远 |
| 12.0/12.5/13.0/13.5 | 三个插入镜 |
| 15.0 / 15.5 / 16.0 | 冻结 / 拉伸 / 按下 |
| 17.0 / 18.0 / 19.0 | 网格显形 / 收拢 / chrome |
| 20.0 / 24.5 | 揭幕 / 转正 |
| 26.0 / 26.5–27.0 | 大数字 / 锁位 |
| 29.5 / 30.0–32.0 | 数字退回 / 四拍收回 |
| 33.0 / 34.0 | 静默2 / 回响 |
| 37.0 / 40.0 / 41.5 | 片尾卡 / 淡出 / 光标熄灭 |

**总时长**：主 demo **42.0s**（`style.json:17`、`timeline.js:2`）；简报是 **30–45s** 的软件发布片（`DEMO.md:10`）。

**静默怎么用**：静默是工具。15.0–16.0s 是**所有轨道的数字零**（屏幕暂停了），它之后第一声就是「按下」；33.0–34.0s 是近静默（−60 dB 房间），它之后第一声是光标「嗒」——和第一帧同一个声音。第一次静默之后的声音是全片最重要的声音。

---

## 4. 镜头逻辑

**镜头是什么**：一台按网格与拍点精确驱动的 2.5D 摄影机。它表达的是一种「有刻度、可复现、落在拍上」的世界；它自己不乱动（舞台和网格从不动），只有镜头动它们。

**词汇表**（用法由主题决定）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 锁死极特写 | 亲密、屏幕上唯一活着的东西 | 一个单一动作；一个念头成形 |
| 连续拉远（按小节打点） | 累积、从一个点长出的规模 | 负载扩散；网络生长；团队加入 |
| 穿过冻结帧推近 | 时间停住、焦点收窄 | 一个决定；提交前瞬间；发现 bug |
| 一拍内急拉 | 因果被同时看见 | 同步完成；一次部署落地 |
| 潜入小 UI 元素 + 匹配剪辑 | 进入细节内部 | 重要的计数器；一行日志 |
| 半秒插入镜从源头展开 | 过载、读不过来 | 通知风暴；报错；选择过载 |
| 近乎锁死、物体转动 + 光扫 | 呈现、产品即英雄 | 揭幕；新版本；功能名 |
| 缓慢横移过 UI 平面 | 秩序被眼睛读出 | 时间线；流水线 |
| 网格上的俯视平面图 | 系统视角、结构 | 架构；权限；工作流图 |
| 回到早先取景 | 押韵：什么变了 | 之前/之后；循环闭合；回响 |

**允许的转场**：**UI 展开 / 收起**——每次镜头切换都是某个界面元素展开占满画面，或画面收进某个元素（beat 前一帧就开始，落到拍上时已 ~80% 打开）。

**禁止**：淡入淡出与空白帧；让舞台或网格自己动；无来由的运镜；把强调色给两个元素。

---

## 5. 表达习惯（idioms）

1. **生成的累积**：按规则生成 UI，越来越快、成百上千；混乱不是你画的，是你生成的。
2. **吸附网格**：一个承诺用一次动作讲完——所有东西一拍内飞进网格，网格在此刻之前一直隐形。
3. **活的元素**：光标是主角，也是品牌标记。
4. **冻结**：所有东西停在半空、声音掉到数字零；只有屏幕能这样让时间停住。
5. **光揭示**：柔光带扫过，只有被照亮的像素才亮起。
6. **数字从字形噪声里滚出**：数字乱跳、每个十六分锁一位、带小弹跳。
7. **类型流**：元素沿彩色曲线飞进各自的行，类别读成「流」。
8. **收起来**：UI 一拍拆掉一个部件，直到只剩一个元素。

---

## 6. 氛围

一个有刻度、有网格、正在精确运行的暗色舞台：近黑、微冷的蓝、一层柔和光池；安静、干净、可复现。整体是**精密、克制、值得信赖**的气质，而不是热闹或戏剧化的。

---

## 7. 声音

- **乐器**：调音打击乐与铺底——马林巴、颤音琴（琴槌或弓奏）、钟琴、钢片琴、合成 pad/drone、低音正弦脉冲、沙锤、拨弦合成、毛毡钢琴；干净、干、极简（样例 VCSL，CC0）。
- **音乐是一条可见的过程**：错相、加法累积、减法过程、用切分拍子加速、或一个所有东西都落上去的和弦。demo：马林巴（声部 1，在拍上）+ 硬槌颤音琴（声部 2，先齐奏后错相、峰值处略失谐更亮）+ 钟琴（声部 3，反向漂移）+ numpy pad（A drone 逐渐加入 G#/D# 不协和并升高）+ 低音正弦脉冲（八分 → 十六分）+ 轻噪声沙锤；按下时所有声部落到 **一个 A 大调 9 和弦**（`score.py:1`）。
- **两个声音家族 = 故事**：混乱的声音是「散」的（每条通知音高各差 ±45 音分、声像乱摆、每种来源一种音色）；Tidy 的声音是「一套」（毛毡嗒 + 玻璃叮，全在 A 大调五声里、居中），于是 264 次落地汇成一片同调微光（`mix.py:19`）。
- **静默是工具**：屏幕上暂停时所有轨道数字零；一个呼吸用近静默（−60 dB 房间）。静默后第一声最重要。
- **混音**：音乐在人声下压 −8 dB、拟音 −4 dB；整体 −14 LUFS；无颗粒。环境声（房间 + 风扇 + 6.8kHz 线圈啸叫）**压到本段最后一句旁白结束前**才放开。J/L cut 承载 UI 转场。

---

## 8. 变化空间（可自由发挥）

产品的动词、主角元素（或没有）、问题图像、强调色、结构、开场、结尾、镜头路径与配乐过程。

`STYLE.md:109-111` 给了远离 demo 的方向：
- **结构**：一个倒计时（发布清单一项项勾过）；并排对照（两个版本工作流分屏，旧的溺水、新的提前完成）；一条缩放阶梯（一个像素 → 一个组件 → 一屏 → 一队设备）。
- **开场**：先给数字（黑底上一个巨大统计量，意义倒着揭示）；一张空网格的平面图，一个槽一个槽填满；从第一帧就是插入风暴，平静很晚才来。
- **结尾**：空网格上只剩一个方块亮着强调色；产品在宽景里安静运行、没有文字；一个「已发布」状态（一条确认气泡，然后黑暗）。

---

## 9. 禁忌清单

- 玻璃产品渲染（没有实体产品）。
- 录屏（没有真 OS/App、没有系统控件、交通灯按钮、Dock）。
- 全息 HUD（没有扫描线）。
- 图表片（是一个数字，不是一张图）。
- 通用淡入淡出转场与空白帧。
- 把强调色给两个元素（如果两个东西是强调色，其中一个错了）。
- 问题色（红）在转折之后再次出现。
- 照抄任何真实发布会、界面、字体、系统控件、旋律或 logo。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

- `timeline.js`：速度网格 `BPM/BEAT/BAR/S16/DUR`、音型 `P`、关键时间点 `K`、三条声部的音符表。
- `lines.json`：每行 `{id, text, voice, speed, onscreen?}`，demo 用 `af_kore`、speed 0.95；`onscreen:true` 的行由光标在画面里打出、只进 `.srt`。
- 强调色（`setAccent`，示例 lime `#B7F34A`）；UI 道具；品牌标记与字标。

### 10.2 新画面元素的契约

用引擎画：任意形状 `E.litShape(g, path2d, {accent, color, glowR, sweep, bbox})`；星标 `sparklePath`；轨迹 `trail`；光标 `caret`；UI 套件 `windowBox / windowContent(kind) / notif / fileIcon / photo / badge / appIcon / storageBar`；飞行 `flyPose` + `motionBlur`；光扫 `lightReveal`；透视 `perspective`；数字 `scramble`；字幕 `toast`；镜头 `camera`。

### 10.3 时间线契约

`timeline.js` 是**唯一真值**：导出 `BPM/BEAT/BAR/S16/DUR`、`P`、`K`、`voice1/voice2/voice3/voiceClean`、`typeTimes`；`tools/dump_timeline.mjs` 导出 `timeline.json` 供 Python 配乐/混音/校点读取。`film.js` 导出 `renderFilm(g,t,o)`、`DUR`、`setLines/subs`、`buildEvents()`；页面契约 `window.READY / window.render(t) / window.DUR / window.EV`。

### 10.4 事件词汇

`key{c,i}` / `return` / `caret_tick` / `ding{i}` / `spawn_file|spawn_photo|spawn_notif|spawn_window{kind,fg,pan,big}` / `insert{i}` / `insert_back` / `freeze` / `stretch` / `press` / `land{g,pan,k}` / `lift{g}` / `grid` / `sort_wave{w}` / `chrome` / `caret_logo` / `dim` / `sweep` / `check{i}` / `push` / `num` / `lock{i}` / `files` / `line2` / `num_back` / `retract{i}` / `to_caret` / `to_caret2` / `silence2` / `end_card` / `caret_off` / `vo{id}`。
`tools/cuecheck.py` 检查关键 cue，且每个生成元素都落在配乐音符上。

---

## 11. 构建链（复用机制）

```
1. 写 timeline.js（网格、音型、声部、关键时间）→ node tools/dump_timeline.mjs
   → 把 timeline.json + cue 表交给配乐；画面并行画。
2. 先建引擎和产品窗口（它们是风格帧），再从音符表建混乱生成器，最后做收拢。
3. sh demo/build.sh 重建一切：TTS → whisper → score → events → cue 检查 → mix → srt → render → mux（−14 LUFS，grain 0）。
4. node core/render/still.mjs demo --range 0.5:42:1 + sheet.py 至少两轮，另加收拢与按下的帧条。
```
（`DEMO.md:102-105`）

---

## 12. 证据

```
styles/dark-keynote/STYLE.md:8          本质
styles/dark-keynote/STYLE.md:10         由「精度」定义
styles/dark-keynote/STYLE.md:12         不是什么
styles/dark-keynote/STYLE.md:16-20      舞台/UI 套件/表面/景深/光
styles/dark-keynote/STYLE.md:24-28      颜色逻辑
styles/dark-keynote/STYLE.md:32-36      字体与字幕
styles/dark-keynote/STYLE.md:40-46      运动质量
styles/dark-keynote/STYLE.md:50-67      镜头语法表 + 转场
styles/dark-keynote/STYLE.md:71-78      声音
styles/dark-keynote/STYLE.md:84-91      native moves
styles/dark-keynote/STYLE.md:107-111    变化空间
styles/dark-keynote/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/dark-keynote/DEMO.md:16-21       六个 native moves 的用法
styles/dark-keynote/DEMO.md:23          故事弧
styles/dark-keynote/DEMO.md:25          声音与画面共用一条时间线
styles/dark-keynote/DEMO.md:31-43       逐拍镜头表
styles/dark-keynote/DEMO.md:47-52       运动数值
styles/dark-keynote/DEMO.md:56-62       配乐结构
styles/dark-keynote/DEMO.md:66-77       舞台色值 / 强调色 / 三股流色 / 道具
styles/dark-keynote/demo/timeline.js:2          BPM 120 / DUR 42
styles/dark-keynote/demo/timeline.js:5          音型 P
styles/dark-keynote/demo/timeline.js:8-24       关键时间点 K
styles/dark-keynote/demo/timeline.js:27-62      四条声部
styles/dark-keynote/demo/film.js:21-34          caretState
styles/dark-keynote/demo/film.js:37-52          camMess
styles/dark-keynote/demo/film.js:193-207        弧线飞行 + 三股流
styles/dark-keynote/demo/film.js:261-287        光环 + 网格前沿 + 网格显形
styles/dark-keynote/demo/film.js:332-334        winPose
styles/dark-keynote/demo/film.js:363-369        屏幕空间光扫
styles/dark-keynote/demo/film.js:398-434        大数字场景
styles/dark-keynote/demo/film.js:454-472        窗口→线→光标
styles/dark-keynote/demo/film.js:537-560        buildEvents
styles/dark-keynote/demo/engine.js:14-15        setAccent
styles/dark-keynote/demo/engine.js:100-123      litShape
styles/dark-keynote/demo/engine.js:358-387      lightReveal
styles/dark-keynote/demo/engine.js:389-410      perspective
styles/dark-keynote/demo/engine.js:411-437      scramble
styles/dark-keynote/demo/engine.js:440-458      toast
styles/dark-keynote/demo/engine.js:459-475      camera
styles/dark-keynote/demo/world.js:122-128       TILE 60 / 槽位 / RING 2600
styles/dark-keynote/demo/mix.py:19              A 大调五声
styles/dark-keynote/demo/mix.py:25-58           光标/键盘/玻璃/毛毡/呼啸/落下/照片/通知
styles/dark-keynote/demo/music/score.py:1       错相 / A 大调 / 120 BPM
styles/dark-keynote/demo/music/score.py:46      六条 stem
styles/dark-keynote/style.json:16-17            frame_sec 8.4 / dur 42.0
```
