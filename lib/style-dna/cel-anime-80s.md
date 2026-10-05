# 80 年代赛璐璐动画（cel-anime-80s）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《City Lights, 1987》的具体内容（那个快递少女、那盘磁带、那座霓虹城都不是风格）。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部用代码复刻的日本 OVA 黄金时代手绘赛璐璐动画，以一盘 80 年代末录像带在显像管电视上播放的形式呈现：**四层叠出来的画面**——喷枪柔边背景、平涂两色 + 硬边阴影/高光 + 彩色描线的赛璐璐、背光透出来的光、以及录像带 + CRT 的播放质感。

**四层缺一层就不像。**
**它不是**：现代数字动画（圆眼大虹膜、网格腮红）、矢量剪贴画（等宽黑线、形状内渐变）、胶片拷贝的仿作（没有片门抖动、没有划痕——这是**磁带**）。（`STYLE.md:14`）

---

## 1. 材料与渲染的硬规则

| 层 | 规则 |
|---|---|
| **赛璐璐渲染** | 平涂 → **硬边**阴影月牙 → **硬边**高光月牙 → **彩色**描线（绝不纯黑）。cel 内部**没有渐变**（例外：峰值处一张 harmony 手绘静止画）。自动阴影 = 裁进形状、`形状 − 朝光源平移后的形状` 以 even-odd 填；高光反向平移；再加 2–4px 饱和霓虹**轮廓光**。1080p 描线 2–3px，大特写缩到 0.45–0.8×。 |
| **色指定** | 用白天标准色，按 lit/shadow/line **分别乘色**推出其他套；另有背光剪影套（暗紫 + 暖轮廓）。 |
| **80 年代的人** | 头 = 球体 + 鹅蛋形下颌；杏仁眼在头部垂直中线附近、粗上睫毛线外挑、分层虹膜 + 两个高光、细长眉；鼻子 = 一个阴影面 + 一笔；头发是交叠发束 + 尖锐不齐发梢 + 「天使环」高光。描线：皮肤暖深棕、头发深紫，**只有硬道具近黑**。 |
| **背景** | 加载时一次画好：天空渐变、喷枪云、带绘制光源的建筑，并配一张随色版滑动的**发光版**。湿地 = 翻转 + 模糊 + 拉丝 + 波纹带。招牌只用通用词。动版加 ~16px 横向拖影。 |
| **光与镜头** | 从发光版强泛光、色彩版在 ~0.9 以上弱泛光；最宽泛光染红橙（halation）。光斑：星芒、变形拉丝、多边形鬼影。**cel 剪影用黑盖到发光版上**，光不透角色。 |
| **录像带 + CRT** | 色度渗色（亮度锐、色度糊并移位）、细扫描线（亮处暗缝变窄）、RGB 光栅、荧光辉光、四角压暗（无曲面黑边）、淡噪声。字幕在调色之后、CRT 管线内合成。 |

**关键取向**：`STYLE.md:90-101` 列了这媒介的陷阱——白 cel 变粉、霓虹透角色、高光黑洞、粗轮廓光吞掉细形状、纸面具脸、粉脸、正面最难画、伪 3D 点翻转、字体回退、CRT 体积。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：**两人对话**、现在时。女主人公（Kokoro `af_bella`）简短笃定、带点嘴硬；无线电调度员（Kokoro `am_michael`，走带通 380–2800Hz + 饱和 + squelch）在催促、报警。像英配动画的短句——信息密度低、口语、有来回。

**长度（实测）**：单句 **17–41 字符**（约 3–8 英文词），全片只有 **8 短行**。最短是干脆的交付语（`Special delivery.`），最长是点名 + 交代期限（`Nightbird, come in. The launch is at dawn.`）。字幕录在带子上：半窄体 54px、奶黄 `#fff0a0` 带 9px 深描边、离底 96px；对讲句用青色 `#8ff4ff` + 方框「● BASE」标签；每行停留 ≥ max(语音 + 0.6s, 1.9s)，下一句出现时上一句让位。

**句首类型**（示例性，不是抄原文）：
- 点名 + 交代期限：`Nightbird, come in. The launch is at dawn.`
- 悬念式交代：`The pilot won't fly without his tape.`
- 一个字确认 + 一句决心：`Copy. I'll beat the sun.`
- 感叹号报警：`The drawbridge is going up! Turn back!`
- 干练的短交付语：`Special delivery.`
- 结尾换个人称把开头再说一遍：`Told you I'd beat the sun.`

**这个风格里不会出现的句式**：
- 旁白式解说（这是两人对话，不是纪录片）
- 长句、书面语或从句套从句
- 抽象概念当主语
- 解释情绪（情绪由表情、镜头与配乐承担）

---

## 3. 叙事节奏

**信息投放顺序**（对白驱动，无旁白）：

```
冷开场带期限（雨天，无线电呼叫「发射在黎明」）
  → 交代目标物件（一盘被遗忘的磁带）
  → 决心（大特写眼睛，三张画睁眼，落在「我会比太阳快」）
  → 片名（背光片名卡在铜管重音上）
  → 快乐的动势蒙太奇（侧向跟拍 / 伪 3D 峡谷后视 / 霓虹光带 / 轮子过水 / 广角高速路埋下目标）
  → 障碍（吊桥升起、拧油门、转速表大特写、剪辑加速）
  → 峰值（辐射速度线 → 一拍冻结 + 白闪 → 冲击帧 → 腾空机车的 harmony 手绘静止画 + 慢摇 → 冲击帧 → 落地火花 + 镜头震）
  → 释放（同一侧向跟拍构图，黎明重绘）
  → 交接（两道手穿过围栏递磁带；手指按下 PLAY）
  → 尾声（火箭升空，延迟上摇；暖特写回应开场台词）→ 片尾卡
```

**时间挂在 116 BPM、4/4 的小节网格上**：1 拍 = 0.5172s，1 小节 = 2.069s；所有剪辑点对齐小节。

| 层 | 规则 |
|---|---|
| 总长 | `DUR = 59.0s`（1416 帧 @24fps） |
| 动画步进 | **角色「拍两格」12fps**；表演（眨眼/睁眼/口型/手势）**「拍三格」8fps**；**镜头/光扫/光斑/雨「拍一格」24fps** |
| 关键点 | eyesOpen 7.75 / title bar(5)=10.345 / warn bar(13)=26.90 / cutout bar(15)+3拍=32.59 / jump bar(16)=33.10 / land bar(18)=37.24 / play bar(21)+0.5拍 / lift bar(22)=45.52 / end bar(26)=53.79 |
| 循环 | 头发/布料是旅行正弦驱动的飘带，4 张一循环（平静时 6 张）；弹跳 = 12fps 几像素抖动 |
| 峰值 | 一张手绘静止画 + 慢摇，只有循环在动 |

**总时长**：主 demo 59.0s（`style.json`）。

**静默怎么用**：**真正的静默**用在最大变化之前——`cutout`（bar15 第 4 拍 → bar16）**全静音一拍 + 白闪**，紧接着冲击帧与副歌；那一拍真空让跳跃读起来更狠。配乐还留了一个 fill bar 给引擎轰油。静默里保留环境（雨/引擎），只把音乐撤掉。

---

## 4. 镜头逻辑

**镜头是什么**：一台 80 年代赛璐璐动画的摄影机——靠**多层景片**（multiplane）与**光带扫过**制造运动，而不是真的三维运动；偏爱剪影、背光与速度语法，并在峰值处敢于**冻结**。

**词汇表**：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 多层景片升降越过一张高景片 | 一个世界被一层层揭开 | 抵达；下沉进一个地方；升到它之上 |
| 侧向跟拍，3–4 层视差 | 稳定的动量 | 旅程；追逐；进展 |
| 后视驶入伪 3D 峡谷 | 速度、前方的压迫 | 竞速；隧道；倒计时 |
| 静止半身像 + 光带扫过 | 不用动画也能有的速度/紧张 | 驾驶；等待；一个决定 |
| 带散景与滑动高光的插入镜头 | 这个物件很重要 | 一封信；一把钥匙；一张票 |
| 眼睛的大特写 | 决心、认出 | 一个选择；一个承诺 |
| 缓慢摇过一张手绘静止画 | 敬畏、屏住的一口气 | 峰值；回忆；风景 |
| 辐射速度线 + 一拍冻结 | 撞击前的一瞬 | 一次跳跃；一次碰撞；一个进球 |
| 穿过窗户或屏幕推进 | 进入另一个世界 | 闪回；一段广播；一个梦 |
| 锁死的双人镜 + 口型 | 对话 | 斗嘴；坦白；争吵 |
| 把早先的构图重画一遍 | 什么变了 | 暴雨之后；多年以后 |

**允许的转场**（必须来自媒介本身）：强拍硬切、白闪、冲击帧、在与磁带相关的拍点上用跟踪噪声。

**禁止**：数字溶解/划像；让 cel 在景片上看不清；占掉画面下方约 120px 的字幕区；用真的三维运动代替多层景片与光带。

---

## 5. 表达习惯（idioms）

1. **巨大的手绘世界里的小个子平涂英雄。**
2. **静止即戏剧**（保持的大特写或 harmony 手绘静止画）。
3. **背光**：招牌、尾灯、仪表、片名字透过画面发光。
4. **速度语法**：速度线、循环景片、冲击帧。
5. **光带扫过一张静止的 cel**（不用动画就制造速度/紧张）。
6. **把一首歌当成一件物品**（demo 里舱内播放磁带时，配乐真的变成卡带音质再展开）。
7. **磁带瑕疵当标点**（开机亮线、跟踪噪声、嘶声/抖动）。
8. **换色指定**（同一个地方、另一个钟点）。
9. **移动光而不是画**：彩色光带以 `source-atop` 扫过静止的 cel。
10. **峰值冻结**：一张手绘静止画 + 慢摇，只有头发/布料循环在动。

---

## 6. 氛围

雨后的霓虹都市之夜：靛蓝、深紫、霓虹洋红、青、暖窗金；黎明则是长春花蓝、玫瑰、蜜桃、淡金。一台显像管电视在暗房间里发着光，画面有扫描线、色度渗色、荧光辉光与四角压暗。整体是「**怀旧、速度、赶在黎明之前**」的气质。

---

## 7. 声音

- **乐器**：city pop / 合成器放克 / 动画片头流行——萨克斯或合成铜管主音、FM 电钢琴（DX7 式 1:1 载波 + 14:1 钟形瞬态）、slap 贝斯、合唱 16 分吉他切音、门限混响军鼓与大嗵鼓、鼓机、琶音模拟合成器、弦乐垫、FM 钟闪烁；扩展爵士流行和声（maj7、9 度；J-pop「王道进行」IVM7–V7–iii7–vi7）。
- **手法**：把配乐带通成卡带/AM 音质再展开；片名处一记铜管；给效果留一个鼓 fill；峰值前一拍真静音；最后一段副歌升半音。
- **动作声**：引擎按转速曲线合成（谐波锯齿堆叠 + 点火抖动 + 带通排气脉冲，腾空时低通变远）、雨、湿路胎噪、风、警铃、对讲机 squelch、撞击、火花/金属刮擦、磁带咔哒、按键 + 马达、火箭点火与轰鸣。磁带点缀有自己的闷响、嗡声、嘶声。
- **混音规则**：先限幅再压缩 TTS；人声按 RMS 比闪避后的音乐高约 **10dB**（音乐 duck ~9dB、约 −0.64 线性），引擎与环境再让 3dB（duck2 ~−0.3）；副歌比前奏响 4–6dB；**两遍 loudnorm 到 −14 LUFS**（`linear=true`）。用 `99.99` 分位配平，只让极少数峰进限幅器以保住副歌动态。

---

## 8. 变化空间（可自由发挥）

结构、角色、世界、开场、结尾、镜头路径、节奏与色指定。

`STYLE.md:111-113` 给了远离 demo 的方向：
- **结构**：四季切片（一个地方、四套色指定、每次一个小变化）；双人对话（锁死双人镜的喜剧，中途炸开成一段幻想戏）；伪片头字幕（角色逐个登场，每人一个姿势 + 一张名牌）。
- **开场**：从一段对话中间切入（口型已经在动，没有定场镜）；一台电视被打开到某个世界内广播；教室里一只画画的手的大特写，再切到它画出的世界。
- **结尾**：一个笑定格 + 「to be continued」卡；磁带放完变成蓝屏；从安静的天台缓缓上摇到星空、没有对白。

---

## 9. 禁忌清单

- cel 形状内部出现渐变（例外：峰值处一张 harmony 手绘静止画）。
- 纯黑描线（必须用彩色描线——皮肤暖深棕、头发深紫，只有硬道具近黑）。
- 现代数字动画的圆眼大虹膜、网格腮红。
- 矢量剪贴画感（等宽线、形状内渐变）。
- 胶片拷贝的瑕疵（片门抖动、灰尘、划痕、套色错位）——与「磁带」设定矛盾。
- 用品牌名或真实作品的招牌（招牌只用通用词）。
- 让霓虹光透进角色（必须把 cel 剪影盖到发光版上）。
- 给白色 cel 强泛光（会变粉——泛光要从发光版来）。
- 让彩色光/霓虹染粉角色的脸（皮肤每套色指定单独给，光带扫脸要弱）。
- 把镜头也做成 12fps 步进（读成抖动）。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

本风格**没有单独的内容 JSON**——台词由 `story.js` 的 `VO` 数组驱动：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 如 `d1`..`d4`、`g1`..`g4` |
| `t` | number | 出现时刻（秒） |
| `who` | `'D'` \| `'G'` | `D` = 调度员走无线电（青色 + BASE 标签）；`G` = 少女 |
| `text` | string | 单行台词；实测 17–41 字符，8 行 |

语音时长由 `voices/dur.json` 提供（缺省回退 = 文本长度 × 0.07）。时间点、镜头表、片尾署名都在 `story.js`；绘制原语在 `cel.js`；色指定在 `pal.js`；人设在 `head80.js`；背景景片在 `bg.js`；特效在 `fx.js`；CRT 后期在 `post.js`；字幕在 `hud.js`。

> ⚠️ 换 `VO` 重跑只是「验证引擎能重排」的技术检查，**不是做片子的方式**。

### 10.2 新画面主体的契约

一个新主体 = 用 `cel.js` 的原语画：
- `path(pts, closed, tension)` 把折点（`[x,y,1]` = 折角）用 Catmull-Rom → 贝塞尔平滑成路径。
- `cel(g, pts, {f, s, so, h, ho, rim, l, lw, sh, hi})` 一次画出「平涂 + 硬边阴影月牙（`so` 朝光源偏移）+ 硬边高光月牙（`ho`）+ 轮廓光（`rim`）+ 彩色描线（`l`）」。
- 颜色一律从 `pal.js` 的色指定取（**不要硬编码**，否则换时间带会崩）。
- 头发/围巾用 `ribbon(spine, width)` + `flutter(x,y,ang,len,n,amp,waves,phase,droop)` 生成飘带。
- 头部参考 `head80.js`：颅骨球心 (0,0) 半径 80、眼中心 +22、鼻底 +54、嘴 +74、下巴 +114；导出 `EXPR`（neutral/determined/panting/smile/smileopen/surprised/talk/closed）与正面 / 3-4 / 侧面三种画法。
- **大特写时把 `LWK.k` 调小**让描线变细。

### 10.3 时间线契约

`story.js` 导出 `BPM`(116)/`BEAT`/`BAR`/`bar(n)`/`beat(n)`、`DUR`(59.0)、`q12(t)`/`q8(t)`/`qc12(t)`（量化到 1/12s、1/8s）、`T`、`VO`、`SHOTS`（`[起,止,名]`）、`shotAt(t)`。
`main.js` 导出 `render(t)`（`const fr = Math.round(t*24)`）、`window.EV` / `window.DUR` / `window.POST` / `window.READY`；`?test=model|close|side` 出人设表、`?raw=1` 跳过 CRT、`?nosub=1` 隐藏字幕、`?shot=` 指定镜头、`?t=` 出静帧。`shots.js` + `scenes1–4.js` 每镜一个函数，从 `main.js` 的 `SHOTS_FN` 分派。渲染用 `core/render/video.mjs`（24fps）。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者（mix.py） |
|---|---|---|
| `squelch` | 对讲按键咔 | 高频咔 + 短噪声 |
| `tapeclick` | 磁带咔哒 | 两声 click |
| `rev{v}` | 轰油 | 引擎 |
| `crton` | 显像管开机 | 高压嘣 + 15.7kHz 尖啸 |
| `launch` | 片名铜管扫频 | 400→6000Hz 扫频 |
| `whoosh{v}` | 呼啸 | 600→5000Hz 扫频 |
| `spray{d}` | 水花 | 带通噪声 |
| `bell{v}` | 警铃双音 | 1180/1560/2890Hz |
| `clunk` | 吊桥闷响 | thump 90 |
| `twist` | 拧油门 | click + creak |
| `impact` | 冲击 | thump + crash |
| `wind{d}` | 风 | 带通噪声 |
| `land` | 落地 | thump + crash |
| `scrape{d}` | 金属刮擦 + 火花 | 带通 + 颗粒 |
| `grab` | 抓取 | clack |
| `button` | 按键 | click + clack |
| `tapenoise{d}` | 磁带跟踪噪声 | 嘶声 + 抖动嗡声 + 撕裂咔啦 |
| `motor{d}` | 马达 | 120Hz + 带通噪声 |
| `ignite` | 点火 | ignite |
| `roar{d}` | 火箭轰鸣 | roar |
| `vo{id}` | 人声 | `d*` 走 radio 滤波 |

---

## 11. 构建链（复用机制）

```
node styles/cel-anime-80s/demo/tools/still.mjs … --range 0.5:58.5:1   # → sheet.py 联系表 → 看 → 修
.venv/bin/python core/tts/tts.py demo/lines.json demo/voices          # → asr_check.py 校对
.venv/bin/python demo/music/score.py                                   # 原创配乐 + stems + cue
node core/render/events.mjs demo → .venv/bin/python demo/mix.py        # 事件 → 拟音 + 混音
node core/render/video.mjs demo --fps 24 --workers 4                   # 1416 帧
sh demo/tools/mux.sh … ; python demo/tools/srt.py                      # 封装 + 字幕
```

**关键机制**：`score.py` 的结构**逐段对齐 `story.js` 的镜头**（前奏/片名/主歌/预副歌/全静音/副歌/卡带/升调副歌/结束），`main.js` 的 `events()` 产出的事件表喂给 `mix.py`（拟音 + 闪避）——所以换内容时配乐与拟音会跟着新段落/新事件重排。编码：ffmpeg 只加 luma-only noise 2、CRF ≈ 23；loudnorm 两遍 `linear=true`。

---

## 12. 证据

```
styles/cel-anime-80s/STYLE.md:6-14      本质四层与不是什么
styles/cel-anime-80s/STYLE.md:16-26     材料与渲染（cel/色指定/人设/背景/光与镜头/录像带 CRT）
styles/cel-anime-80s/STYLE.md:28-33     颜色逻辑
styles/cel-anime-80s/STYLE.md:35-38     字体与字幕
styles/cel-anime-80s/STYLE.md:40-47     运动质量
styles/cel-anime-80s/STYLE.md:49-67     镜头语法表 + 转场
styles/cel-anime-80s/STYLE.md:69-75     声音
styles/cel-anime-80s/STYLE.md:77-88     原生手法
styles/cel-anime-80s/STYLE.md:90-101    媒介陷阱
styles/cel-anime-80s/STYLE.md:107-113   变化空间
styles/cel-anime-80s/DEMO.md:3          不要复用故事/叙事弧/镜头/道具/时长
styles/cel-anime-80s/DEMO.md:10-16      一个主角一个目标一个期限 / 歌曲当剧情物件
styles/cel-anime-80s/DEMO.md:20-33      逐镜镜头表 + 116 BPM
styles/cel-anime-80s/DEMO.md:35-43      配乐结构 / 卡带化 / foley / 人声 / mix
styles/cel-anime-80s/DEMO.md:45-51      调色与道具 / 少女构造 / CRT 数值
styles/cel-anime-80s/DEMO.md:53-57      片尾卡 / 片名卡 / 字幕数值
styles/cel-anime-80s/demo/story.js:2-12            BPM/BEAT/BAR/DUR/q12/q8/qc12
styles/cel-anime-80s/demo/story.js:14-28           T 关键时刻表
styles/cel-anime-80s/demo/story.js:31-40           VO 台词
styles/cel-anime-80s/demo/story.js:43-65           SHOTS 镜头表
styles/cel-anime-80s/demo/cel.js:12-30             path() Catmull-Rom → 贝塞尔
styles/cel-anime-80s/demo/cel.js:36-54             crescent()/cel() 平涂+硬边阴影高光+轮廓光+彩线
styles/cel-anime-80s/demo/cel.js:62-81             ribbon()/flutter() 飘带
styles/cel-anime-80s/demo/cel.js:93-98             airbrush() 喷枪
styles/cel-anime-80s/demo/pal.js:4-30              BASE 白天标准色
styles/cel-anime-80s/demo/pal.js:35-41             LIGHTS 时间带乘色
styles/cel-anime-80s/demo/pal.js:42-54             palette() + 夜景皮肤单独指定
styles/cel-anime-80s/demo/head80.js:1-7            头部几何坐标 + 描线配色
styles/cel-anime-80s/demo/head80.js:10-19          EXPR 表情预设
styles/cel-anime-80s/demo/head80.js:22-65          eye() 杏仁眼 + 分层虹膜 + 高光 + 睫毛
styles/cel-anime-80s/demo/post.js:24-37            rgb2yc/samp() 色度渗色
styles/cel-anime-80s/demo/post.js:40-54            开机 + 跟踪噪声
styles/cel-anime-80s/demo/post.js:55-90            comp：泛光/调色/字幕/扫描线/光栅/压暗
styles/cel-anime-80s/demo/post.js:111-114          CRT 克制版参数
styles/cel-anime-80s/demo/hud.js:4-8               subSpans() 停留与让位
styles/cel-anime-80s/demo/hud.js:9-29              hud() 奶黄字幕 + 对讲青色 + BASE 标签
styles/cel-anime-80s/demo/main.js:26-33            景片加载时一次画好
styles/cel-anime-80s/demo/main.js:41-56            render() + CRT power/track
styles/cel-anime-80s/demo/main.js:58-71            events() 全部 type
styles/cel-anime-80s/demo/mix.py:23-41             引擎按转速曲线合成
styles/cel-anime-80s/demo/mix.py:44-57             环境床（雨/胎噪/风/城市/海）
styles/cel-anime-80s/demo/mix.py:82                foley 增益表
styles/cel-anime-80s/demo/mix.py:111-124           人声（radio 滤波 + 房间卷积 + RMS 配平）
styles/cel-anime-80s/demo/mix.py:126-138           duck −0.64 / duck2 −0.3 / 分位配平
styles/cel-anime-80s/demo/music/score.py:1-17      116 BPM / E♭→E / 逐段结构
styles/cel-anime-80s/demo/music/score.py:36-38     CUT 全静音 / LOFI 卡带 / KEY_UP 升半音
styles/cel-anime-80s/demo/lines.json:1-10          八行台词原文
styles/cel-anime-80s/style.json:16-17              frame_sec 17.7 / dur 59.0
```
