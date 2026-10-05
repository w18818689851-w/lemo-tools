# 中国水墨（ink-wash）· 风格创作逻辑档案

> 面向：要**从零原创**一部该风格片子的人 / 下游智能体。
> 本文只收录**风格逻辑**（换主题仍成立的规则），不收录示例《The Swordsman and the River》的具体内容。
> 证据见文末，格式 `file:line`。

---

## 0. 一句话

一部「一笔一笔画出来」的写意水墨片：**暖白宣纸是空间，墨以五种浓淡乘算在纸上**，形体靠没骨的墨块（笔腹的深边就是轮廓）与湿墨晕开、干墨飞白；留白占了大半画面，东西是**被画出来**的。全片只有一种彩色——朱红印章。

**它不是**：水彩（没有彩色晕染）、加了笔刷纹理的矢量图（没有平涂、没有闭合轮廓线）、书法片头。
（`STYLE.md:12`）

---

## 1. 材料与渲染的硬规则

任何画面元素都必须能被解释成「水墨工艺的某个环节」。

| 规则 | 具体值（实测/文档） |
|---|---|
| **纸即世界** | 程序化生成（合成器里），暖宣纸约 `#F2ECDE`；云状斑驳 ±7%、三向纤维、纸浆暗斑、缩小淡出细纹、暗角；锚在世界空间随镜头缩放。 |
| **墨只有一种** | 墨是**乘算**到纸上的描边不透明度，分五色：焦 .96 / 浓 .82 / 重 .60 / 淡 .34 / 清 .16（`ink.js:6`）。 |
| **笔触 = 中心线 × 压力 × 笔毫** | 4–60 根笔毫，墨量沿笔程下降、在长尺度噪声上断开；`dry` 从实心湿笔连续过渡到飞白。 |
| **没骨（loaded stroke）** | 笔毫一侧更浓 → 一笔自带轮廓。这是「读成墨而不是矢量」的关键。 |
| **两层** | 湿层在合成器晕开（12 抽样 ~5px 噪声模糊 + 边缘积墨 + 颗粒）；干层只吃纤维抖动与纸纹咬边（`comp.js:44-72`）。 |
| **墨块不平涂** | 软多边形 + 抖动边缘 + 渐变（`ink.js:183-200`）。 |
| **山石** | 远山向下溶进雾带，近山才有披麻皴与苔点；石头 = 轮廓 → 斧劈皴 → 影染 → 点（`land.js:16-144`）。 |
| **水就是留白** | 靠淡干笔划痕与开放墨环暗示；实心水用宋式平行水纹或淡底 + 几笔巨大没骨笔（`land.js:144`）。 |
| **写意人物** | 一块淡身体底 + 两笔没骨，四肢焦墨；脸只用 3–5 笔（`hero.js:11-94`）。 |
| **书法** | OFL 毛笔字体只当**骨架**：描中心线、压力来自字形粗细、藏锋起笔出锋收笔（`glyph.js:7-69`）。 |

**颜色**：墨从冷灰 `rgb(.52,.55,.58)` 到暖黑 `rgb(.075,.068,.062)`；**一枚朱红** `#B02E22`（demo 的 VERM=[176,46,34]）给印章，最多再加一处极小点缀。**绝不用红做字或大面积晕染**（`STYLE.md:36-40`）。

---

## 2. 句式（字幕 / 旁白怎么写）

**谁来写**：一位安静的题跋作者。第三人称、现在时；克制，不解释画面。

**长度（实测）**：单句 **28–45 字符**（约 5–9 个英文词）。字幕最多两行（46px 斜体 Cormorant），**停留 = 语音时长 + 0.6s**。

**句首类型**（示例性，不是抄原文）：
- 以「不变之物」起句：`The river keeps no name.`
- 以主体动作起句：`He crossed it the only way he knew —`
- 以时间/方位状语起句再落到主体：`Halfway over, …`
- 祈使句作转折：`Draw a sword to cut the water…`
- 格言式收束：`…and the water only flows on.`

**这个风格里不会出现的句式**：
- 第一人称内心独白与抒情
- 网络口播腔、感叹号堆叠、营销话术
- 抽象概念当主语（只谈能被一笔画出来的东西）
- 一句塞两个以上并列信息点
- 解释性的旁白

---

## 3. 叙事节奏

**信息投放顺序**（一笔画成一件事）：

```
虚白空纸
  → 一滴墨落下（creation）
  → 小人物在巨大留白里
  → 轻快（踏水 / 凌空的喜悦）
  → 压倒性的障碍被画成一块墨（湿墨溅开成巨浪）
  → 静默
  → 决定性的一笔（剑 = 写出的「水」字）
  → 释放
  → 尺度揭示（人物成了整幅画里的一个小点）
  → 印章 → 片尾卡
```

**时间线**（`story.js` 是唯一真值，秒）：

| 锚点 | 时刻 |
|---|---|
| dropFall / dropHit / bloomEnd | .5 / .9 / 5.2 |
| titleIn / titleOut | 2.6 / 6.4 |
| 三笔 paint | [8.8, 9.4, 10.0]（tassel 10.3） |
| leap → 墨晕转场 | 14.2 → x3a 14.45 → x3b 15.3 |
| 过江 9 步 | step0 15.3333，beat .66667 |
| cut5（第一段静默） | 26.8 |
| draw / 三笔 w1..w3 | 28.0 / [28.5,29.0] [29.2,29.75] [29.95,30.35] |
| hush（第二段静默）→ cut | 30.5 → 32.4（决定性的一笔只用 0.17s） |
| close / bow | [38.6,40.2] / [40.9,41.5] |
| scrollA / seal / endCard | 42.6 / 44.6 / 45.6 |

**帧率**：人物 **12fps**（on twos）；镜头、墨晕、涟漪、溅墨 **24fps**（`STYLE.md:48-54`）。

**总时长**：主 demo 48.0s（`style.json:16-17`，frame_sec 34.56）；适合 40–60s 的单场景短片。

**静默怎么用**：`events()` 声明两段 silence——26.8–27.59 与 30.5–32.4。`mix.py` 把**整个总线**（音乐+环境+混响尾）清零，只用 20ms 淡入淡出，最多留一个声音（一滴水、一声剑鸣）。最长的一段（1.9s）之后，才是那把断流的剑（`STYLE.md:79`、`mix.py:128-132`）。

---

## 4. 镜头逻辑

**镜头是什么**：一只在宣纸上方缓慢移动的眼睛（手卷/立轴的观者）。它不制造情绪，只把「正在被画出来」当叙事。

**词汇表**（用法由主题决定）：

| 运动 | 表达 | 可服务 |
|---|---|---|
| 锁定在纸上 | 纸就是舞台 | 成形中的东西；静止的决定 |
| 从右向左平移（手卷） | 时间与距离是同一幅画 | 旅程；历史；过程 |
| 竖直俯仰（立轴） | 高度、层层堆叠 | 季节；攀爬；代际 |
| 横向跟随 + 前方留空 + 极慢远景视差 | 在一个世界里移动 | 旅行；追逐；通勤 |
| 高处大全景 + 留白里的小人 | 渺小、孤独 | 孤独；自然的尺度 |
| 低角度 + 暗块压顶 + 推近带震 | 重量、威胁 | 障碍；风暴；压力 |
| 硬切到极大特写 | 流动被打断（唯一的硬切） | 决定；震动；记忆 |
| 推进墨晕/雾 | 在两种状态间穿过 | 记忆；梦；季节轮转 |
| 拉远直到某一笔归入整体 | 它原来在更大的东西里 | 总结；尺度的反讽 |
| 回到更早的取景 | 韵脚让「变了什么」被看见 | 余波；成长；前后对比 |

**允许的转场**：墨晕（带深色水线的前沿）、沿卷轴平移、雾、起跳处的墨晕（demo 的 leap→过江）。

**禁止**：通用溶解/划像；矢量式补间；无来由的运镜；在湿墨上填不透明色块。

---

## 5. 表达习惯（idioms）

1. **一笔就是全部**：产品从一根线里诞生；城市从一条街长出来。
2. **留白即实体**：擦掉墨反而露出纸白——墙上一扇门打开、人群分开。
3. **笔 = 手势 = 动作**：笔顺变成编舞。
4. **飞白**：一记快速干笔横扫，从静默里出来最强。
5. **墨晕转场**：下一场在扩散的水滴里长出。
6. **手卷**：一幅长画从右向左展开，最后一眼看全。
7. **把一块墨劈开**：两半各被裁在切线两侧，一半升起、一半塌下，溅墨留下。

---

## 6. 氛围

一张铺开的宣纸、一间安静的书房：墨的干、纸的暖、水的凉；雾在远山之间，尘埃在光里。整体是**克制、留白、值得被慢慢看**的气质。

---

## 7. 声音

- **乐器**：古琴领奏（散音/按音滑音/吟猱/泛音/扫弦）+ 低而带气声的箫 + 大鼓与定音鼓 + 框鼓（脚步）+ 小锣（印章）；中国五声音阶（demo：F 宫五声）。
- **动作声（按材质）**：墨滴（1300Hz→380Hz 下滑「叮」+ 湿软噗）、毛笔破空（1200–6500Hz 带通 + 毛刷颗粒）、点水（水花 + 小咚 + 5 颗水珠）、溅墨（70 颗短湿点）、印章（木印闷「咚」+ 纸面细响）、剑（鞘摩擦 + 五音叠加的金属清鸣）。
- **混音规则**：配乐**不循环、按段落 cue**；人声闪避 −6 dB（.5s 平滑），环境同步压到 30%；静默清零整个总线但保留其后第一声；−14 LUFS、grain 0。

---

## 8. 变化空间（可自由发挥）

结构、人物（或无人）、山水、开场、结尾、镜头路径、节奏、以及红色出现在哪。

`STYLE.md:110-114` 给了远离 demo 的方向：
- **结构**：一个字，一笔一笔（不画人物，大字的每一笔展开成主题的一个小景）；立轴（从天空到地面的竖直俯仰，四段、墨色渐深）；两支笔对话（交替的笔互相回应，最后在一团墨晕里相遇）。
- **开场**：已经在动（人物已画好并在移动，世界在它周围晕开）；先满后空（先给一张画满墨的画，在出现光或路的地方把墨擦掉）；笔毫（一记湿笔填满画面，抬起时才看见它画了什么）。
- **结尾**：一个小记号（特写脚印或叶子，周围的墨在干，不拉远）；蒸发（整幅画按笔顺倒着消失）；停在半途（笔在最后一笔落下前停住）。

---

## 9. 禁忌清单

- 任何「填灰」——浓淡必须由墨与笔毫构成。
- 彩色晕染（这是水墨，不是水彩）。
- 闭合的矢量轮廓线或平涂。
- 给文字或纸面上色；第二种彩色（除了一枚朱印与一处极小点缀）。
- 通用溶解/划像转场；矢量式补间。
- 把 OFL 毛笔字体直接描轮廓当字（只能当骨架）。
- 照抄任何真实水墨画、构图、人物或音乐。
- 复用示例的故事、叙事弧、镜头、道具或时长（`DEMO.md:3`）。

---

## 10. 素材契约（要新做一部片，需要产出什么）

### 10.1 内容文件字段

- **`demo/story.js`** 是唯一真值：导出 `DUR`、`T`（dropFall/dropHit/bloomEnd/titleIn/panA/panB/paint[]/leap/x3a/x3b/step0/beat/nSteps/darken/shot4/cut5/draw/w1..w3/hush/cut/cutEnd/x7a/x7b/close/bow/scrollA/seal/endCard）、`VO[]`（`{id, t, sub:[t0,t1], text}`，text 用 `\n` 显式断行）、`stepTimes()`。
- **`demo/lines.json`**：`[{id, text, voice, speed, lang}]`（demo：`bm_george` / en-gb / .82–.86）。
- **字幕位置**：`shots.js` 的 `subPos(id, t)` 按镜头留白手写。

### 10.2 新画面主体的契约

用 `ink.js` 的笔触库搭：`mk(pts, o)` 建一笔、`draw(L, s, p, am)` 逐帧画、`drawSeq` 按书写顺序、`blot` 点苔/溅墨、`mass` 湿墨块、`qpts` 二次贝塞尔。TONE 与 PROF 可复用。参考：人物 `hero.js`（POSE/mixPose/hero）、山石 `land.js`、浪 `wave.js`、书法 `glyph.js`。

### 10.3 时间线契约

`story.js` → `shots.js` 的 `frame(t, A, B, TMP)` 返回该帧合成参数（含 A/B 两套画面的墨晕蒙版 `[cx,cy,R,on]`）；`subPos(id,t)` 给字幕位置；`events()` 给事件数组。`comp.js` 的 `makeComp(canvas)` → `composite(A,B,o)`；`layerSet(W,H)` 造 {wet, dry, col} 三张画布。页面契约：`window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。

### 10.4 事件词汇（`type` → 消费者）

| type | 含义 | 消费者（mix.py） |
|---|---|---|
| `vo{id}` | 人声 | 读 voices/<id>.wav |
| `drip{gain}` | 墨滴落纸 | 下滑「叮」+ 湿噗 |
| `brush{gain,dur}` | 毛笔/剑气破空 | 带通噪声 + 毛刷颗粒 |
| `whoosh{gain,k}` | 起跳/脚步带的风 | whoosh |
| `step{gain,k}` | 点水脚步 | 水花 + 小咚 + 水珠 |
| `splash{gain}` | 落水 | 水花 |
| `skid{gain}` | 滑停 | 带通噪声 |
| `sword{gain}` | 拔剑 | 鞘摩擦 + 金属清鸣（须在第二段静默前收掉） |
| `cut{gain}` | 断流 | 撕裂气流 + 江水轰响 + 低频冲击 |
| `splatter{gain}` | 溅墨 | 70 颗短湿点 |
| `collapse{gain}` | 浪塌 | 棕噪 + 带通 |
| `waterclose{gain}` | 合水 | 带通 |
| `cloth{gain}` | 袍角 | 带通 |
| `seal{gain}` | 印章 | 木印闷咚 + 纸面细响 |
| `silence{t0,t1}` | 静默段 | 整个总线清零 |
| `amb{kind,t0,t1}` | 环境床（wind/water/roar） | 风/江水/轰响 |

全部由 `shots.js` 的 `events()` 产生，再由 `tools/events.mjs` 序列化成 events.json。

---

## 11. 构建链（复用机制）

```
sh styles/ink-wash/demo/build.sh
  # 1. story.js 时间线 → lines.json → Kokoro TTS → whisper 检查
  # 2. music/score.py（古琴配乐，按段落 cue）
  # 3. events.mjs → events.json → mix.py（foley + 人声 + 音乐）
  # 4. subs → srt
  # 5. core/render/video.mjs 出帧 → mux（−14 LUFS，grain 0）
  # 6. still.mjs 出剧照与海报
```

**关键机制**：`story.js` 是画面、配乐、拟音、字幕共用的**唯一时间真值**——改一行语音时长，全片自动重排（`DEMO.md:76`）。

---

## 12. 证据

```
styles/ink-wash/STYLE.md:6-13       本质 + 不是什么
styles/ink-wash/STYLE.md:16-34      材料与渲染（纸/墨五色/笔触/没骨/两层/墨块/山石/水/人物/书法）
styles/ink-wash/STYLE.md:36-40      颜色逻辑（只有墨 + 一枚朱红）
styles/ink-wash/STYLE.md:42-46      字体与字幕（题跋、停留规则）
styles/ink-wash/STYLE.md:48-54      运动质量（12fps/24fps、画出来、静止）
styles/ink-wash/STYLE.md:56-73      镜头词汇表 + 转场 + 禁止
styles/ink-wash/STYLE.md:75-81      声音（古琴、cue、静默、foley、闪避）
styles/ink-wash/STYLE.md:83-93      七条 native moves
styles/ink-wash/STYLE.md:95-102     媒介陷阱
styles/ink-wash/STYLE.md:104-106    引擎文件清单
styles/ink-wash/STYLE.md:108-114    变化空间
styles/ink-wash/DEMO.md:3           不要复用故事/叙事弧/镜头/道具/时长
styles/ink-wash/DEMO.md:5           demo 48s
styles/ink-wash/DEMO.md:12          48s 叙事弧
styles/ink-wash/DEMO.md:18-28       逐拍镜头表
styles/ink-wash/DEMO.md:32-38       配乐（F 宫五声、两段静默、bm_george）
styles/ink-wash/DEMO.md:42-54       色值/合成器参数/笔压/山石/水/浪/人物/水字/墨晕
styles/ink-wash/demo/story.js:1-31  时间线唯一真值
styles/ink-wash/demo/ink.js:6       TONE 焦浓重淡清
styles/ink-wash/demo/ink.js:42-55   PROF 笔法表
styles/ink-wash/demo/ink.js:62-94   mk() 笔毫墨量下降 / gapLen
styles/ink-wash/demo/ink.js:97-153  draw() 墨体 + 飞白
styles/ink-wash/demo/ink.js:183-200 mass() 湿墨块
styles/ink-wash/demo/comp.js:22-35  纸 shader
styles/ink-wash/demo/comp.js:44-72  inkD() 晕开 + 边缘积墨 + 干层咬边
styles/ink-wash/demo/comp.js:73     inkCol() 冷灰→暖黑
styles/ink-wash/demo/comp.js:87-99  墨晕转场蒙版
styles/ink-wash/demo/seal.js:4-31   朱红白文方印
styles/ink-wash/demo/subs.js:4-20   题跋字幕
styles/ink-wash/demo/shots.js:12-30 frame() 镜头分段与两次墨晕
styles/ink-wash/demo/shots.js:33-42 subPos()
styles/ink-wash/demo/shots.js:45-71 events() 全部 type + 两段 silence
styles/ink-wash/demo/mix.py:19-77   按材质 foley
styles/ink-wash/demo/mix.py:116-132 闪避 + 静默清零
styles/ink-wash/demo/music/score.py:1-5 古琴/箫/大鼓/盖印 + F 宫五声
styles/ink-wash/demo/hero.js:6      VERM 全片唯一朱红
styles/ink-wash/demo/hero.js:11-94  POSE / mixPose
styles/ink-wash/demo/land.js:16-144 ridgeFn/mountainLayer/cun/cliff/pine/reed/ripple
styles/ink-wash/demo/wave.js:15-25  waveShape / wave
styles/ink-wash/demo/glyph.js:7-69  「水」字骨架与书写
styles/ink-wash/demo/lines.json:1-7 5 行旁白实测
styles/ink-wash/style.json:16-17    frame_sec 34.56 / dur 48.0
```
