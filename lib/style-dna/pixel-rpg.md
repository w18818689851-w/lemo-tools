# 16 位像素角色扮演（pixel-rpg）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Last Save Point》的具体剧情。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部看起来、听起来、并且**行为上**都像 90 年代主机 RPG 的短片：320×180 原生像素、受限索引调色板、会逐字打出的对话框、菜单、存档位、带回声的芯片音乐。故事用游戏讲故事的语法讲——对话框配头像、菜单、状态条、战斗消息、存档文件、获得道具的小号角。

**它不是**：HD-2D（没有景深、泛光、实时光照）；CRT 怀旧（没有扫描线、没有颗粒）；戏仿（不是玩梗，是认真用游戏的语法说一件真诚的事）。
（`STYLE.md:6-14`）

---

## 1. 材料与渲染的硬规则

| 规则 | 具体值（实测/文档） |
|---|---|
| **索引色帧缓冲** | 画面存调色板索引（`Uint8Array`），经查找表（索引→ABGR）出图 → **整块调色板可一帧内换掉**；输出 ×6 最近邻到 1080p；文字也在帧缓冲里（`px.js:1-2,104-159`）。 |
| **主调色板** | 约 32 色（ENDESGA-32）；另有**受保护索引** 32–38（围巾三阶 + 水晶四阶）任何效果都不许动（`px.js:5-21`）。 |
| **色深表** | identity(16-bit) / 最近邻 13 色 NES(8-bit) / 4 亮度阈值(4 色，原生 160×90 再放大) / 褪色 7 阶蓝灰 / 塌缩用 16·8·4·2 色子集；**按亮度映射，不按排名**（`px.js:35-66`）。 |
| **光 = 索引步进** | `LIGHT[]`/`DARK[]` 把每个索引沿色阶挪一步；辉光是 Bayer 阈值环；炉火用暖色重映射（绿→棕→锈），不是通用提亮（`scenes.js:7-18,20-26,33`）。 |
| **抖动** | 4×4 Bayer 用于渐变与辉光；光柱 = 50% 棋盘 + 25% 边缘（`px.js:88-93`）。 |
| **精灵骨骼** | 胶囊肢体 + 左上 3 阶明暗 + 每部件一道材质最深内线 + 一圈 1px 全局墨色描边 + 手写 ASCII 头；一套骨骼出所有姿势（`sprites.js:1-22`）。 |
| **头像** | 32×32、3/4 视角、基础脸 + 眼/眉与嘴叠加层，承担面部表演（`ui.js:25-43`）。 |
| **菜单皮肤** | gb（浅底深框）/ nes（黑底白框）/ snes（蓝渐变 + 白/银边），随年代切换（`ui.js:6-21`）。 |
| **像素字体** | 原创可变宽像素字体，大写高 7、x 高 5、降部 2、行高 10，逐字打印（`font.js:1,5`）。 |

**关键取向**：一切明暗走**调色板步进**（4 级量化），绝不 alpha；相机与视差按**整数像素**、逐帧动（`px.js:68-85`、`STYLE.md:18,44`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一个活在游戏系统里的人。角色用第一人称短句，系统用无人称宣告式。

**长度（实测）**：
- 对话框是字幕：每屏**最多 3 行**、按像素宽度自动折行，单行约 **40–46 字符**；全句建议 **12–72 字符（约 3–14 个英文词）**，一条消息只说一件事（`ui.js:36`）。
- 战斗/系统消息走顶部细窗，**6–24 字符**，全大写、可带「!」（`ui.js:45-49`）。
- 打字速度 **38–40 字符/秒**，旧年代 **30 字符/秒**（`ui.js:35`、`main.js:72`）。
- 每屏停留 ≥ `max(1.8s, 语音 + 0.6s)`，下一个框直接切掉上一个（`main.js:32-41`）。

**句首类型**（示例性，不是抄原文）：
- 角色直问：`Cold? Here.`
- 系统宣告：`WREN used WARD!`
- 状态陈述：`WREN fell.`
- 界面标签：`SELECT A FILE` / `NEW FILE`
- 数值标签：`LV 42` / `HP 212/350`

**这个风格里不会出现的句式**：
- 长段独白（对话框最多 3 行，超了就分屏）。
- 旁白式全知解说（「很多年后，他回想起……」）。
- 现代网络口播腔、emoji、颜文字。
- 任何真实游戏的专有名词、角色名、UI 框、字体、旋律或音效。

---

## 3. 叙事节奏

**信息投放顺序**（按年代/记忆分段，每段一个色深、一个调性、一个 BPM）：

```
A 现在·存档点（褪色·近无声，80 BPM）→ 标题卡 → vo1 → 存档菜单
  → B 回忆一·村庄（4 色·单声道，102.857 BPM）
  → C 回忆二·篝火（8-bit·单声道，6/8 附点 81.08 BPM）
  → 遭遇（刺音：下行扫频 + 噪声）
  → D 回忆三·战斗（16-bit·立体声，160 BPM）→ 硬切
  → KO 静音（真静音）
  → E 哀歌·每级色深掉一层编曲（66.667 BPM，步进 31.0/31.9/32.8/33.7/34.6）
  → F 现在（近乎无声）
  → G 最终之门（120 BPM，47.5 颜色回涨、全乐队进入）→ 白闪硬切
  → H 尾奏（80 BPM，动机解决）
（demo/timeline.json）
```

**时间与色深绑定**：

| 段 | BPM / 拍号 | 色深 / 音质 |
|---|---|---|
| A 存档点 | 80，4/4 | 褪色闷响（低通 ~2.2kHz）+ 12.5% 脉冲 + 三角贝斯 + 长回声 |
| B 村庄 | 102.857，4/4 | 4 色：2 脉冲 + 波表 + 噪声，**单声道**，4-bit 音量阶梯，11kHz 采样保持 |
| C 篝火 | 6/8（附点 81.08） | 8-bit：25% 脉冲 + 三角贝斯 + 琶音和弦，单声道 NES 式 |
| D 战斗 | 160，4/4 | 16-bit：拍弦贝斯 ostinato + 铜管脉冲 + 军鼓，**立体声 + 回声** |
| E 哀歌 | 66.667，自由 | 每级色深掉一层：和声走→回声/立体声走→变薄 8-bit→只剩一个长方波→静音 |
| G 最终之门 | 120，4/4 | 第一小节闷响贝斯 + 定音鼓；47.5 全乐队进入 = 颜色回涨 |

**总时长**：demo **54.5s**（`timeline.json:2`）；短片通常 40–90s，由年代段数决定，每段 5–12s。输出 24fps；精灵 **8fps（走路）到 12fps（火焰、眨眼）**；相机与视差按整数像素逐帧动（`STYLE.md:42-44`）。

**静默怎么用**：静音 = **真零，连回声尾巴也切掉**。战斗在 29.2 起音乐死寂到 30.1；哀歌 34.6 起静一拍。静音是结构，不是留白（`timeline.json`「music must be DEAD SILENT from 29.2 (cut the echo tail too)」）。

---

## 4. 镜头逻辑

**镜头是什么**：一台简单、可读的**游戏相机**。开场与结尾由题材决定。

**词汇表**：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 侧卷轴 + 多层视差 | 旅程、孤独、进度 | 通勤；一次任务；一条时间线 |
| 锁定框 + UI 占三分之一 | 一个选择、系统在说话 | 菜单决策；数值揭示 |
| 战斗侧视图（敌/我方/窗口） | 冲突作为系统 | 考试；谈判；一场病 |
| 俯视大地图平移 | 整个世界、东西在哪 | 一座城；公司地图；一次旅行 |
| 整数像素仰摇上摇高物 | 敬畏、尺度 | 一座塔；一扇门；一座山 |
| 调色板变化时保持不动 | 不用运动表达失去或改变 | 悲伤；记忆褪色；入夜 |
| 门槛背视 | 决心、前方的未知 | 第一天；上线；启程 |
| 马赛克推入缩略图 | 进入一段记忆或一个文件 | 闪回；存档位；一张照片 |

**允许的转场**：
- 缩略图放大 + 马赛克（进入回忆，`main.js:174-181`）
- 马赛克交叉 + 峰值处换调色板（`main.js:184-187`）
- 遇敌旋涡（极坐标扭转 + 马赛克 + Bayer 溶解到白，`main.js:189-199`）
- 屏幕震动（8 帧内 3–2–1 px，`main.js:205`）
- 调色板步进淡入淡出（4 级量化，`px.js:68-85`）

**禁止**：alpha 淡入淡出；HD-2D 的景深/泛光/实时光照；CRT 的扫描线/噪点/颗粒（grain = 0）；非整数像素的相机移动或子像素插值；把满彩场景事后量化到 4 色。

---

## 5. 表达习惯（idioms）

1. **调色板 = 情感**：色深、褪色、调色板交换都是叙事工具，整块换表，绝不用 alpha。
2. **色深代表时间**：越旧 = 颜色越少、分辨率越低。
3. **受保护色 = 贯穿全片的线**：几个免于一切效果的颜色让年代之间做匹配剪辑（只用一两个）。
4. **暖色在降色中要保留**：否则第一步就把夕阳变成一片纯红。
5. **对话框就是字幕**：底部四分之一、分层圆角边框 + 抖动深蓝填充 + 32×32 头像 + 原创可变宽像素字；`▼` 读完闪烁。
6. **游戏化表演**：向前跳一步出手、施法姿势、击退后仰、跪地、KO 闪烁（12fps 明灭）后消失；呼吸 = 肩膀抬 1px。
7. **UI 运动**：窗口约 0.3s 滑入（ease-out、整数像素）；手形光标 4fps 上下 1px 抖动，角色犹豫时**停下**。
8. **存档位 = 记忆**：一列文件，选 NEW FILE 时拒绝覆盖。
9. **音质跟着色深走**：4 色 = 单声道 + 4-bit 音量阶梯 + 低采样率；8-bit = NES 式单声道；16-bit = 立体声 + 回声；褪色的现在 = 同一段音乐被闷住。
10. **唯一有机的声音**：一次呼吸/心跳，让角色在某一刻变回人（`mix.py:3,98`）。

---

## 6. 氛围

一台老主机在暗房间里运行：像素边缘干净、颜色有限而饱和、对话框安静地逐字吐出字。有掌机年代的体温——界面是冷的，但界面里的人在努力表达。

---

## 7. 声音

- **乐器**：12.5/25/50% 占空比脉冲波、4-bit 阶梯三角波贝斯、LFSR 噪声鼓、波表主音；SNES 式回声（几次抽头约 180–370ms、反馈约 0.4、环路带低通）；只使用**原创旋律**（动机 M 在各段以不同色深、调性重现）（`music/score.py:43-65,107`）。
- **拟音（全部程序化合成、按色深 bit-crush）**：光标与选择提示音、文字 blip（按说话人变调）、带回声的脚步、火焰噼啪、魔法微光（三角波琶音）、蓄力与爆发、HP 递减 tick、KO 闪烁、每级色深一次 bit-drop、存档 tick、门轴研磨、金币与道具叮当、菜单错误蜂鸣；**唯一不「芯片」的声音是一次呼吸/心跳**（`mix.py:1-3,20-31,89-98`）。
- **混音规则**：音乐在人声下闪避约 **7–8 dB**（快起慢放，用包络算 duck 曲线）；母带峰值归一到 **0.89** 满量程；grain = 0。人声可选：第一人称、少量短句；或只用文字 blip，给一个只活在文字里的角色（`mix.py:160-162,171`）。

---

## 8. 变化空间（可自由发挥）

你要决定：题材里藏的是哪一种游戏系统、角色是谁、有哪些年代、调色板计划、开场与结尾。全部远离 demo。

- **结构**：**大地图巡游**（一张俯视地图，每座城镇是一章，用门转场进入）；**商店与背包**（整个故事只用买到、用到、卖掉的物品来讲）；**回合制决斗**（两边轮流，每一步是题材的一个场景）。
- **开场**：**PRESS START** 标题画面带吸引模式演示；**战斗已经开始**、HP 只剩一点；**开机画面加载失败**、必须重试。
- **结尾**：**GAME OVER** 交给一个选择（重试/放弃）并留开放；**制作名单在大地图上滚动**、角色们走回家；**存档画面**——最后一个存档位被写入、菜单关上。
- **年代配法**：可以是三代硬件，也可以是「一次停电后颜色一格格回来」。
- **可换不可换**：色深数量、年代数、BPM、角色都可换；但**索引色帧缓冲（320×180、×6 最近邻）、受保护的少数颜色、对话框即字幕**三件不能换，换掉任何一件就不再是这个风格。

---

## 9. 禁忌清单

- 按排名映射调色板（会把场景压成黑；必须按亮度带 gamma 映射）。
- 降色子集里不留暖色（会把夕阳压成一片纯红）。
- 8-bit 集里没有深绿或深棕（夜晚草地会变蓝）；炉火旁用通用提亮（草地会变霓虹）。
- 把满彩场景事后量化到 4 色（糊；低年代要原生画）。
- 像素头发画成光滑圆顶（读成头盔）、单像素交替（读成噪点）；浅色衣服读成皮肤；侧视图手持道具挡住脸。
- 深色木板门读成牢门（要加门板、斜边、铆钉）。
- 负数取模得到 `undefined`（必须 `((n%m)+m)%m`）。
- 对话框盖住底部四分之一却没把人抬到框线之上（地板线要在框顶之上）。
- 受保护色的匹配剪辑只算了一侧的屏幕位置。
- 用 alpha 做任何淡入淡出。
- 复用真实游戏的专有名词、角色、UI 框、字体、旋律或音效。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段（`timeline.json` 为唯一真值）

| 字段 | 类型 | 说明 |
|---|---|---|
| `dur` | number | 总时长（秒），demo 54.5 |
| `vo{}` | `{id:{t,expr}}` | 每句人声的起点与表情 |
| `sections[]` | object[] | 每段 `{id,t0,t1,bpm/meter/downbeats,key,fidelity,mood,hits,note}` |
| `lines.json` | `{id,text,sub?,voice,speed}` | 配音脚本（`sub` 为字幕替写） |
| `voices/dur.json` | `{id:秒}` | 每句人声时长 |
| `FILES[]` | `{label,place,time,thumb,lut}` | 存档位；缩略图各自带一张 LUT（`main.js:19-23`） |

### 10.2 新画面主体的契约

新增一个角色 = 在 `sprites.js` 的 `MAT` 里定义材质四阶 `[line,dark,mid,light]`，写一套 ASCII 头部（side/up/down 等视角），并给它一个**剪影记号**（衣摆/帽/发型）；一套骨骼自动出所有姿势（`sprites.js:1-22`）。
新增一个道具 = 用受保护索引做平面着色形状（可做 8 帧/90° 旋转）。
新增一段年代 = 在 `px.js` 的 `LUT` 里加一张查找表（从主调色板按亮度映射），并在 `timeline.json` 的 section 给出对应 `fidelity` 与 `bpm`（`px.js:44-66`）。

### 10.3 时间线契约

- 页面契约：`window.render(t)` / `window.DUR` / `window.READY` / `window.EV` / `window.SUBS`（`main.js:63,242-243`）。
- `timeline.json` 是唯一时间真相：画面、配乐（`music/score.py`）、混音（`mix.py`）都读它；改时间只改这一处（`timeline.json:_doc`）。
- 字幕区间规则：`t1 = max(t1_voice + 0.6, t0 + 1.8)`，可被下一句的 `min` 截断（`main.js:32-41`）。

### 10.4 事件词汇（`EV` → `mix.py`）

| type | 含义 |
|---|---|
| `chime` / `sparkle` | 开场铃 / 微光 |
| `bed{name,t1,gain}` | 环境床（hum/fire/wind） |
| `step` / `step4` / `stepB` | 脚步（不同年代） |
| `flare` / `open` / `open8` / `openUI` | 开窗/开界面（不同色深） |
| `select` / `cursor` / `slide` | 选择/光标/滑入 |
| `mosaic{up}` | 马赛克转场 |
| `cloth` / `hop` | 布动 / 跳步 |
| `ward` / `charge{t1}` / `blast` | 施法三连 |
| `tick` / `thud` / `koblink` | HP 递减 / 落地 / KO 闪烁 |
| `bitdrop{k}` | 每级色深一次降位 |
| `savetick` / `grind{t1}` | 存档 tick / 门轴研磨 |
| `flood` / `ignite{pan}` / `swell{t1}` | 颜色回涨 / 点燃 / 渐强 |
| `breath{d}` | 唯一有机声 |
| `vo{id}` | 人声 |

---

## 11. 构建链（复用机制）

```
sh styles/pixel-rpg/demo/build.sh
  # 1. timeline.json / lines.json → 画面（main.js 读 timeline）
  # 2. music/score.py（读 timeline 的 sections 与 fidelity）→ 配乐
  # 3. mix.py（芯片拟音 + 人声 + duck）→ mix.wav
  # 4. 渲染帧 → 成片
```

**关键机制**：`timeline.json` 是唯一真值——画面、配乐、混音全从它导出；改时间只改一处。`?sheet=1` 渲模型表、`?frame=<场景>&lut=<表>` 用任意色深表渲环境（`STYLE.md:103`）。

---

## 12. 证据

```
styles/pixel-rpg/STYLE.md:3-4          一句话本质 + 参考只借语法
styles/pixel-rpg/STYLE.md:6-14         本质五条 + 不是什么（非 HD-2D/非 CRT/非戏仿）
styles/pixel-rpg/STYLE.md:16-25        材料与渲染（索引帧缓冲/主调色板/色深表/光=索引步进/抖动/骨骼/头像/道具）
styles/pixel-rpg/STYLE.md:27-33        颜色逻辑（调色板=情感/色深=时间/受保护色/暖色保留）
styles/pixel-rpg/STYLE.md:35-40        字体与字幕（对话框即字幕/皮肤随年代/停留/标题）
styles/pixel-rpg/STYLE.md:42-47        运动质量（24fps 输出、8–12fps 精灵、游戏化表演、UI 运动、转场）
styles/pixel-rpg/STYLE.md:49-64        镜头语法表 + 取景
styles/pixel-rpg/STYLE.md:66-75        声音（芯片声部/回声/音质跟色深/拟音/静音/duck −7~8dB）
styles/pixel-rpg/STYLE.md:77-87        原生动作七条
styles/pixel-rpg/STYLE.md:89-99        媒介陷阱
styles/pixel-rpg/STYLE.md:105-111      变化空间（结构/开场/结尾）
styles/pixel-rpg/demo/px.js:1-2        索引色像素引擎 320×180 ×6
styles/pixel-rpg/demo/px.js:5-13       主调色板 ENDESGA-32 + 保护色
styles/pixel-rpg/demo/px.js:21         PROTECT 集合
styles/pixel-rpg/demo/px.js:28         lutFrom 索引→ABGR
styles/pixel-rpg/demo/px.js:35-42      rampMap 按亮度分位
styles/pixel-rpg/demo/px.js:44-66      LUT 全表（full/faded/gb4/nes/c16/c8/c4/c2）
styles/pixel-rpg/demo/px.js:47         FADED_RAMP 7 阶蓝灰
styles/pixel-rpg/demo/px.js:51         GB4 4 色
styles/pixel-rpg/demo/px.js:53         gb4 固定亮度阈值
styles/pixel-rpg/demo/px.js:56         NES 13 色
styles/pixel-rpg/demo/px.js:61         SUB16 塌缩子集
styles/pixel-rpg/demo/px.js:68-85      darken/whiten 调色板步进
styles/pixel-rpg/demo/px.js:88-89      4×4 Bayer
styles/pixel-rpg/demo/px.js:90-93      8×8 Bayer
styles/pixel-rpg/demo/px.js:95-96      hash/vnoise
styles/pixel-rpg/demo/px.js:104-136    FB 索引帧缓冲类
styles/pixel-rpg/demo/px.js:119        dither 抖动填充
styles/pixel-rpg/demo/px.js:128-134    blit（带 map）
styles/pixel-rpg/demo/px.js:137-141    sprFromRows ASCII 精灵
styles/pixel-rpg/demo/px.js:144-159    makeOut（LUT present + ×6 最近邻）
styles/pixel-rpg/demo/px.js:161-168    mosaic RGB 级马赛克
styles/pixel-rpg/demo/font.js:1        原创可变宽像素字体（大写高 7）
styles/pixel-rpg/demo/font.js:5        def('A', ...) 字形定义
styles/pixel-rpg/demo/ui.js:6-21       窗口三皮肤 gb/nes/snes
styles/pixel-rpg/demo/ui.js:25-43      对话框（字幕）逐字 + ▼
styles/pixel-rpg/demo/ui.js:35         cps 打字速度
styles/pixel-rpg/demo/ui.js:41         读完后 ▼ 闪烁
styles/pixel-rpg/demo/ui.js:45-49      顶部战报窗
styles/pixel-rpg/demo/ui.js:52-61      手形光标 + 4fps 抖动
styles/pixel-rpg/demo/ui.js:79-109     存档位列表 fileList
styles/pixel-rpg/demo/ui.js:112-117    状态栏 HP/MP
styles/pixel-rpg/demo/ui.js:118-122    bar 血条
styles/pixel-rpg/demo/ui.js:124-129    SAVING 进度
styles/pixel-rpg/demo/ui.js:130-137    SAVE COMPLETE
styles/pixel-rpg/demo/sprites.js:1     骨骼（胶囊肢体 + 分阶明暗 + 自动描边）
styles/pixel-rpg/demo/sprites.js:5-21  材质四阶 MAT
styles/pixel-rpg/demo/sprites.js:22    光从左上来
styles/pixel-rpg/demo/scenes.js:7-18   LIGHT/DARK 索引步进表
styles/pixel-rpg/demo/scenes.js:20-26  glow Bayer 阈值环
styles/pixel-rpg/demo/scenes.js:28-30  shade 区域压暗
styles/pixel-rpg/demo/scenes.js:33     torch 暖色重映射
styles/pixel-rpg/demo/scenes.js:98     噪声驱动的 LIGHT 步进
styles/pixel-rpg/demo/scenes.js:166    corridor 走廊
styles/pixel-rpg/demo/scenes.js:195    doorScene 最终之门
styles/pixel-rpg/demo/scenes.js:233    双重 LIGHT 步进（光带）
styles/pixel-rpg/demo/main.js:12-14    读 timeline/lines/dur
styles/pixel-rpg/demo/main.js:19-23    FILES 存档位（各自 LUT）
styles/pixel-rpg/demo/main.js:29       typing 逐字 blip
styles/pixel-rpg/demo/main.js:32-41    字幕区间 ≥ 语音+0.6 且 ≥1.8
styles/pixel-rpg/demo/main.js:63       window.EV / window.SUBS
styles/pixel-rpg/demo/main.js:67       walk 8fps 步进
styles/pixel-rpg/demo/main.js:74       listSlide 0.3s ease-out
styles/pixel-rpg/demo/main.js:130      HP 递减
styles/pixel-rpg/demo/main.js:134      battleLUT 调色板塌缩步进
styles/pixel-rpg/demo/main.js:162      shake 屏幕震动
styles/pixel-rpg/demo/main.js:164-221  frame 分镜分发
styles/pixel-rpg/demo/main.js:174-181  缩略图放大 + 马赛克（进入回忆）
styles/pixel-rpg/demo/main.js:184      mosaic 交叉
styles/pixel-rpg/demo/main.js:189-199  遇敌旋涡（极坐标 + 马赛克 + Bayer 白）
styles/pixel-rpg/demo/main.js:203      whiten 白闪
styles/pixel-rpg/demo/main.js:205      震动 3–2–1
styles/pixel-rpg/demo/main.js:209-212  颜色回涨（径向 Bayer 揭示）
styles/pixel-rpg/demo/main.js:217      darken 收尾淡出
styles/pixel-rpg/demo/main.js:236-239  海报帧
styles/pixel-rpg/demo/main.js:242-243  window.render / DUR / READY
styles/pixel-rpg/demo/timeline.json:2  dur 54.5
styles/pixel-rpg/demo/mix.py:3         拟音按色深处理；呼吸是唯一非芯片声
styles/pixel-rpg/demo/mix.py:20        sq 脉冲占空比
styles/pixel-rpg/demo/mix.py:23-25     tri 4-bit 阶梯
styles/pixel-rpg/demo/mix.py:26        crush
styles/pixel-rpg/demo/mix.py:31        echo 抽头
styles/pixel-rpg/demo/mix.py:89-90     bitdrop
styles/pixel-rpg/demo/mix.py:98        breath 呼吸
styles/pixel-rpg/demo/mix.py:160-162   duck 包络闪避
styles/pixel-rpg/demo/mix.py:171       峰值归一
styles/pixel-rpg/demo/music/score.py:43-47 pulse 占空比
styles/pixel-rpg/demo/music/score.py:50-52 tri_nes
styles/pixel-rpg/demo/music/score.py:59-65 _lfsr 噪声鼓
styles/pixel-rpg/demo/music/score.py:107 echo 回声
```
