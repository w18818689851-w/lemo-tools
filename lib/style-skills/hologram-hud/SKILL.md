---
name: lemo-style-hologram-hud
description: 【lemo 风格 Skill · 科幻全息界面】要做产品规格讲解 / 拆解 / 展台循环屏时用本风格：一个物体被扫描成悬在圆形投影台上的发光线框，目标框依次锁定它的部件，每锁一个就在局部炸开、拉出引线、把一个数字从乱码滚成真值，最后可能点亮成实体全息。选定本风格做视频时，优先读本文件。
slug: hologram-hud
name_zh: 科幻全息界面
category: 信息与发布
film: Volt · Spec Scan
---

# 科幻全息界面（`hologram-hud`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/hologram-hud/STYLE.md` · `styles/hologram-hud/DEMO.md` ·
> `styles/hologram-hud/demo/build.sh` · `lib/style-dna/hologram-hud.json` ·
> `lib/style-dna/hologram-hud.md` · `lib/dub-styles.json#hologram-hud` ·
> `styles/hologram-hud/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一个物体被「扫描」成悬在圆形投影台上的**发光线框**，目标框依次锁定它的部件；每锁一个就在局部炸开、拉出引线、把一个数字从乱码滚成真值；最后可能一次性点亮成实体全息（`STYLE.md:3`、`style-dna:11`）。主体**永远是线框**，最多一次性获得半透明面，且线仍在最上（`STYLE.md:14`）。

**不是什么**（最容易做错的邻居风格）：不是渲染出的实物（那是 `glass-product`）、不是打字机式 keynote（那是 `dark-keynote`）、不是工程制图（那是 `blueprint`）。判据：画面里如果主体是「被渲染出来的」，就不是本风格。

**什么时候用它**：产品规格讲解、发布会与众筹片、展台循环屏（`style.json` 的 `uses`）。任何**有部件、有数字**的物件都行。

**一句话内核**：**一切读起来都像「被扫描出来的数据」**——扫描面把模型长出来，零件沿装配轴拉开，数字是在屏幕上**被算出来**的（`STYLE.md:10`）。

**边界**：它是**场景风格**，干的是实用活（讲规格、拆解、循环屏），不做抒情；撑不起没有部件、没有可量化参数的题材（纯情绪、纯人物、纯风景）。

---

## 2. 画面构图

- **镜头数与画幅**：原生 **16:9 / 1920×1080**；★ **2026-10-04 已声明多比例**（见下）。demo 是「一条连续环绕相机路径」而非分镜切换——全片无场景内剪切（`STYLE.md:49`）。
- **三层纵深永远同时在**（`STYLE.md:12`）：① **背景点阵网格**（48px 点阵，视差 0.2）；② **主体 + 投影台 + 地面**；③ **前景 HUD**（四角括号、视差更快的标尺、状态文字）。
- **主体位置与占比**：环绕相机（yaw / pitch / dist / 窄 fov，demo `fov 0.6`）+ 一个**屏幕目标位**，所以主体能坐在文字旁边（`STYLE.md:53`）。取景硬规则：**主体在每个关键时刻 ≥ 1/3 画面高**（`STYLE.md:69`）。
- **负空间 / 留白**：近黑舞台（`hsl(hue+12, 70%, 2.4%)`）+ 主体后方径向提亮（`hsl(hue+6, 65%, 7%)`）+ 强暗角 0.5。demo 实测：大卡片在 `x ≥ 1240`、左侧栏在 `x 110–470`、字幕固定在底部中央（基线 y 962）、放大镜在 y 580 之上（`DEMO.md:31`）。
- **图层叠放顺序**（从底到顶）：① 近黑舞台 + 径向提亮；② 点阵网格；③ 投影台（同心环 r = 0.7 / 1.05 亮 / 1.12 虚线 / 1.45 / 2.1，120 刻度每 10 加长，24 放射线）；④ 线框主体（`lighter` 叠加）；⑤ 热边 / 光波 / 光柱；⑥ HUD 家具；⑦ 文字深色底板 + 文字；⑧ 字幕条。
- **安全区**：**文字从不压在网格线上**——每块文字都有自己的深色底板 `rgba(1,8,12,.72)`、1px 边（28% 透明）、10px 角标（`STYLE.md:25`、`style-dna:30`）；相机还要负责让主体避开文字区。
- **本风格**不能**出现的构图**：卡片、芯片栏、字幕、放大镜**互相碰撞**（`STYLE.md:69`）；零件飞进文字区（宁可缩短炸开向量）；漂浮碎片（每个零件必须物理相连，`STYLE.md:22`）。

### 在 9:16（产品默认）下的表现

**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。改造**没有**改写 3D 几何或散落 HUD 面板的绝对像素坐标（那正是本风格「3D 透视相机 + 散落屏幕像素面板」最贵的部分），而是只改**两个文件**：① `demo/index.html` —— 影片本体仍按**固定设计帧 1920×1080** 画（一字未改），当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧等比装入**（contain）并居中，留边露出页面底色 `#02080A`（= 影片自己的近黑舞台色 `hsl(hue+12,70%,2.4%)`，**留边与画面同色、看不出接缝**）；② `demo/film.js` —— 追加 `FILM_META.aspects` 声明（控制台按源码文本探测）。`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`。

- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform）；改造前/后同参渲三帧（15%/50%/85%），**跨进程 md5 逐字节相同**（画布全覆盖页面，底色由 `#000` 改为 `#02080A` 在 16:9 下不可见）。
- **9:16 不裁切**：左侧参数卡（BATTERY RANGE / REAR HUB MOTOR）、右侧大卡片（HYDRAULIC DISC）、放大镜圈 + `TGT 03 · LOCK`、四角括号、底部遥测行与字幕**全部在画面内**（实测：9:16 vs 16:9 中心裁切 SSIM 0.58–0.69，vs 理想等比装入 SSIM 0.987–0.989）。
- **已知代价**：① 竖屏下有效画面只占 1080×607，**分辨率按紧轴缩放**——HUD 文字按 1920 宽绝对像素布局，缩到 56.25% 后**小字与 1px 细线会变糊**；② 留边 = 近黑舞台色，肉眼无接缝，但**严格说全屏层（暗角/点阵网格）不铺满留边**；③ 其它比例同理（3:4 / 4:3 / 1:1 已支持）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 舞台底 | `hsl(hue+12, 70%, 2.4%)` | 被色相染过的近黑 | `DEMO.md:47` |
| 径向提亮 | `hsl(hue+6, 65%, 7%)` | 主体后方 | `DEMO.md:47` |
| 主（线框/ HUD / 面） | `hsla(hue, 100%, 50–80%, a)`，demo **hue 188（青）** | 线、HUD 家具、实体全息面 | `DEMO.md:49,51` |
| 热边 | `hsla(hue, 70%, 92%)` | 扫描前沿 / `hot` 内部件 / 光波 / 被 ping 的零件 | `DEMO.md:49` |
| 强调 | **accent 38（琥珀）**，demo 备用内容 204 / 18（蓝 / 橙） | **只花在「锁定的真值」上**：数字变真那一帧 | `DEMO.md:51`、`STYLE.md:30` |
| 文字底板 | `rgba(1,8,12,.72)`（字幕 `.62`） | 每块文字背后 | `DEMO.md:52,54` |
| 字幕 | 近白 Rajdhani Medium | 字幕正文 | `STYLE.md:38` |

> ★ **为什么本节没有固定 hex（2026-10-04 审计确认）**：本风格的配色**是参数化的** —— 全部色值由 `hue`（demo 用 **188 青**）与 `accent`（**38 琥珀**）两个参数经 HSL 推得（`hsl(hue+12, 70%, 2.4%)` 之类）。**源码里也没有任何固定 hex**（`demo/frames.js:18` 是 `holo.draw(g, m, cam, { hue: T.hue, … })`，色相是运行时传入的）。
> ⇒ 「§3 只给 HSL 表达式、不给 hex」**是有意且正确的**，**不是文档缺口**；下游不要据此去「补」一个 hex（那等于把可参数化的风格钉死成一个色）。

- **明度 / 对比规则**：**一个冷色相 + 一个暖强调**，两者都是**参数**（薄荷/橙、紫/黄绿、冰蓝/红——从主体上选，`STYLE.md:29`）。色相承载线、HUD 与面；**强调色只花在锁定的真值上**，别的地方永远不用（`STYLE.md:30`）。**白 = 热**：近白边与单帧闪白标记「当前活跃」，静止的一切都待在色相的 alpha 层级里（`STYLE.md:31`）。
- **禁止出现的颜色**：强调色用在「锁定的真值」以外的地方（`style-dna:163`）；把主体渲染成实物上色（必须始终是线框）。
- **同一画面最多几个色相**：**2 个**——一个冷色相族（含它的 alpha 层级与近白热边）+ 一个暖强调色。
- **唯一例外**：`keep` —— 一个物体可以保留自己的颜色（单色例外），**只给品牌标记用，绝不用于装饰**（`STYLE.md:32`；demo 在 `frames.js:18` 用了 `#D97757` 作为这个保留色）。

---

## 4. 转场规则

- **镜头之间怎么切**：**场景内没有剪切、没有淡入淡出**（`STYLE.md:49`）。全片是**一条连续的环绕相机路径**，段落之间靠相机运动 + 状态变化衔接，不靠剪辑。
- **有没有叠化 / 闪白 / 擦除 / 定格**：允许的转场**必须来自媒介本身**，只有三种——① **扫描面**（扫入 / 擦除，`scan` 与 `scanDown`）；② **放大镜虹膜**（loupe iris，画中画开合）；③ 最多**一次三帧的 glitch**，且只用在**全片最大变化**上（demo 花在 ignition 点亮那一刻，`DEMO.md:29`）。**闪白**只作为状态标记：目标框吸附到位时在重拍上闪白 3 帧（`STYLE.md:44`）。
- **硬切点怎么定**：不存在硬切；但**所有状态变化都落在 120 BPM 网格上**（1 拍 = 0.5s、1 小节 = 2s），锁定落重拍，`tools/cuecheck.py` 逐条核对（demo 实测 0 ms 偏移、全部在 1/16 网格上，`DEMO.md:38`）。
- **转场时长与缓动**：目标框吸附 **~0.22s cubic ease-out**；引线 **~0.5s**；炸开 1 拍（第一条 2 拍）、合拢 0.5s；甩镜 **0.5s cubic in-out**，且**必须在下一段开始前 0.45s 就起步**（写在下一段里会播成硬切，`STYLE.md:99`）；芯片停靠 = 卡片淡出 0.35s + 芯片 x 140→110 滑入。
- **绝对不要的转场**：场景内的剪切或淡入淡出（`style-dna:164`）；把甩镜写在下一段（`STYLE.md:99`）；多过一次的 glitch。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **Rajdhani** Medium（标签用 500/600、大数字与产品名用 300）；微数据用 **Share Tech Mono** 20–22px（`STYLE.md:36`）。dub 通路回退 `DengXian`（本机无 Rajdhani / Share Tech Mono） |
| 字号（相对画面宽 / 高） | 字幕正文 **38px** @1080 高；dub 通路 `fontSizeFactor: 0.045`（= 48.6px @1080，比 demo 略大） |
| 颜色 / 描边 / 阴影 | 近白 Rajdhani Medium；无描边（`outlineFactor: 0.00333`，近似 3.6px 极细）；底是 `rgba(1,8,12,.62)` 深色底板 + 两条**斜向青色括号** + **四根 voiceprint 声纹条**（随语音跳动，`DEMO.md:54`） |
| 位置 / 安全边距 | 底部居中（`align: 2`），基线 **y 962**（≈ 89% 画面高）；dub 通路 `marginVFactor 0.145`、`marginLFactor 0.06` |
| 单行字数上限 / 最多行数 | 底板宽 **1180px** 后换行（`DEMO.md:54`）；demo 实测单句 **47–72 字符**（8–13 英文词），最多 2 行（`style-dna:39`） |
| 出现与消失方式 | **提前 0.1s 上、下一句前 0.12s 下**（`style-dna:85`）；停留 ≥ `max(1.8s, 语音 + 0.6s)`。dub 通路 `subtitleFadeIn: 0.08` |

- **字幕与旁白的关系**：字幕是**旁白的逐字稿**，不是标题。句式是冷静自信的产品讲解员（第三人称、现在时、陈述句，会对听众说「你」），**不是推销员**（`style-dna:37`）。口播硬约束：intro ≤ 5s、第一条 callout ≤ 4.8s、其余 ≤ 3.5s（`style-dna:184`）。demo 用 Kokoro `af_heart`、speed 1.0（`af_nicole` 太喘太慢，同一句 7.0s vs 4.4s，`DEMO.md:43`）。实测口播时长：intro 3.032s / c0 4.373s / c1 3.566s / c2 3.29s / outro 2.816s。
- **本风格特有的字幕禁忌**：① **不会出现**形容词堆砌的营销腔（`revolutionary`）、第一人称（`we believe`）、疑问句钩子（悬念靠数字滚动，不靠问句）、一句塞两个以上规格（`style-dna:48`）；② **数字必须等宽**，否则滚动会抖（`STYLE.md:37`）；③ **小数点画成一个小方块**——发光的小圆点会被读成逗号（`STYLE.md:37`）；④ 字幕条自带底板与括号，不要再叠别的装饰。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「Subtitles are HUD: a dark plate with corner brackets」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#6101080C`（AARRGGBB，落盘 ASS 为 `&H610C0801`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(1,8,12,0.62)）；字色 #FFFFFF（`palette.subtitle` 缺省，按 `&H00FFFFFF` 生效） 与该底衬的 WCAG 对比度 **19.78**。

---

## 6. BGM / 音效特征

- **配乐**：**音乐优先，挂在网格上**（一小节 = 一个信息拍），锁定都落在重拍上并与配乐核对（`STYLE.md:73`）。demo 是 numpy 原创合成：**120 BPM，D 小调带 Dorian 色彩**，和弦 Dm9 → B♭maj7 → Fmaj9 → G6，D1 方波脉冲走四分音符（`DEMO.md:39`）。音色清单：锯齿/方波琶音 + ping-pong delay（**1–4kHz 挖空给人声**）、方波脉冲、八分贝斯、合成 hat / clap、失谐锯齿 pad、808 式滑音 sub（drop 用，`style-dna:142`）。**密度跟着信息走**（`STYLE.md:75`）：阅读段半速、一拍真数字静音、最大变化用 drop、每个部件加/减一层、更长音值减速、转调、长保持下垫一个持续音。demo 的具体做法：part 1 不打鼓 → part 2 加 hat → part 3 加 clap 并把琶音升八度；regroup 减速（16 分 → 8 分 → 一个四分滑下去）；点亮处 drop（808 滑音 + 7 声部宽锯齿和弦）；落版段半速；片尾卡把琶音一个音一个音撤掉（`DEMO.md:40`）。实测 `score.wav 39.0s, 455 onsets, peak −1.20 dBFS`。
- **拟音（foley）清单**：**按材料分层**（`STYLE.md:76`）——光 = **调内**的正弦与 FM blip；机械 = 伺服滑动、气动噗、液压嘶、金属叮（用 J-cut 提前）；**一次锁定** = 低频撞 + 金属 clack + 两声高频锁定音（D6+12 / A5+12）；**数字滚动**按 24fps 咔哒；探测 blip = D–F–A；琥珀确认 = D6 + A6 + E7（`style-dna:143`）。环境 = **投影嗡鸣 40/80/120Hz** + 房间底。J/L-cut 实测：电机 whine 在甩镜落到电机前 0.4s 起、液压嘶在刹车锁定前 0.4s 起；嗡鸣与和弦尾音**跨过扫描擦除**带进片尾卡（`DEMO.md:42`）。
- **旁白处理**：Kokoro TTS 直出（本 demo **没有** `voice_fx.py` / `voice.py`，出片日志 [配音 1/1] 明确「该 demo 无 voice_fx.py/voice.py，按它自己 build.sh 的写法直接输出」）。**人声期间音乐压 −16.5 dB、拟音也压 −15 dB**，用 **0.5s max-filter 保持**（字与字之间不回弹，避免抽吸）；**只有锁定 / 确认撞击的前 0.2s 逃过闪避**（`style-dna:144`）。
- **响度目标**：`−14 LUFS`；**真峰值上限**：`−1.2 dBTP`（**项目级交付线**，判据见 `core/render/mux.sh`；本风格 `STYLE.md:77` 未额外声明更严上限）。出片实测 **−14.0 LUFS / LRA 3.4**（`ebur128`）、**真峰值 −1.53 dBTP**（`loudnorm` `input_tp`，4× 过采样；`ebur128` `Peak` −1.5 dBFS 仅作参考）——响度精确达标，真峰值在交付线内。
- **静音策略**：两种，都必须与 cue 表核对（任何 UI blip 落进静音窗口都会破坏它，`STYLE.md:98`）：① **near**——第一次锁定前半个拍点，只剩房间嗡鸣，**锁定撞击是静音后第一个声音**；② **true**——点亮前一整拍，**严格归零**（连界面提示音都没有）（`style-dna:90-91`）。

---

## 7. 素材偏好

- **需要什么素材**：① 一个**线框模型 JSON**（`{ name, parts[] }`，米为单位、y 向上、x = 产品前方、z = 朝观察者；载入时归一化，包围盒对角线默认 2.3117，所以任何尺寸都能用）；② `content.json`（全部文字、数字、颜色、模型路径、配音稿）；③ 字体 Rajdhani + Share Tech Mono。**不需要任何实拍素材**。
- **不需要什么素材**：不需要实物渲染、不需要照片、不需要外部 HDRI。**主体必须始终是线框**，给面也只能是一次性的半透明 Fresnel 面。
- **取景 / 质感 / 偏好**：线框 `lighter` 叠加 ~1.3px 描边、**7 个 alpha 层级由深度雾决定**（近亮、远 ~25%）+ 两趟辉光（¼ 分辨率模糊 3px ×0.85、⅛ 分辨率模糊 4px ×0.7）；规模控制在 ~5k 顶点 / 6k 边（`style-dna:24,31`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：**没有 CAD 模型也能做**——用 `engine/holo.js` 的 `modelFromPath(pts2d, {depth, id, slices, explode})` 把任意**闭合 2D 路径挤出**成带侧面片的线框体（`DEMO.md:138`）；或用 `models/mkmodel.mjs` 的图元（tube / ring / disc / box / saddle / fender / wheel / cells / stator / rotor / caliper…）自己拼。**降级时宁可减少零件数，也不要放弃「每个零件物理相连」这条铁律**——漂浮碎片会立刻被发现（`STYLE.md:22`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 无「镜」概念——是**连续相机路径**；段落长度：intro 4 小节 = 8s、第一条 callout **3 小节 = 6s**、其余每条 callout **2 小节 = 4s**、regroup 1 小节 = 2s、high（点亮）2 小节 = 4s、lock（落版）3 小节 = 6s、end 5s（`style-dna:67-75`） |
| 全片时长 | **39.0s** = 34s 场景 + 5s 片尾卡（`style.json:17`、`DEMO.md:5`） |
| 镜头数 | 连续路径 9 个段落：scan-in → title → 3 ×（lock → camera move → local explode → leader → value）→ regroup → solid-hologram turn → spec-sheet lockup → end card（`DEMO.md:12`） |
| 信息投放节拍 | 120 BPM（1 拍 0.5s / 1 小节 2s）；数值停留 ≥2.5s 后停靠左侧栏，**全片每个参数在屏 10–25s**；标题停留 ≥5s；滚动数字 0.5s（第一条 1s） |

- **加速 / 减速点**：**Part 1 慢、Part 2 中、Part 3 快**——第一条 callout 给 3 小节（最慢），其余各 2 小节；`regroup` 把相机拉远并下降到 pitch 0，让物体在点亮前**站起来**；`high point` 是唯一一次 360° 转台 + crane up 0 → 13°；`lockup` 近乎静止、只有一次极慢 dolly（3.5 → 3.4），留给观众**阅读**（`DEMO.md:21-26`）。
- **留白与静音的位置**：两处静音（见第 6 节）——第一次锁定前半个拍点的 `near` 静音，与点亮前一整拍的 `true` 静音。demo 实测：`f09` 那一帧是甩镜中的运动模糊（5 子帧、180° 快门、1/48s），HUD 保持锐利（`STYLE.md:48`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/hologram-hud/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/hologram-hud/demo --fps 24 --workers 6 --size 1920x1080 --out …/out/video_gpu.mp4`（本次出片实际命令） |
| 帧率 | 24 fps（`style.json:16` 的 `frame_sec` 25.5 是「每帧秒数」口径下的换算值） |
| 分辨率 / 比例 | 1920×1080 / **16:9**（原生；本次出片命令行显式 `--ratio 16:9`）；★ 2026-10-04 起支持 16:9 / 9:16 / 3:4 / 4:3 / 1:1（**页面外壳等比装入**，见第 2 节） |
| 混流 | `sh core/render/mux.sh <video> <mix.wav> hologram-hud.mp4 24 0`（末位 0 = 颗粒 grain 0，`DEMO.md:77` 明确「−14 LUFS, grain 0」） |
| 编码器 | `h264_nvenc`（本地 GPU；日志 [5] 段确认 nvenc，fps 24，workers 6） |
| 音频入口 | `python demo/music/score.py`（**读 `timeline.json` 排段落**，numpy 合成）→ `python demo/mix.py`（界面音 + 机械拟音 + 环境底 + 人声 + 闪避） |
| 字幕入口 | `demo/tools/export.mjs` 导出 `out/srt.json` → `core/render/srt.py`。**本次这一步失败了**（见第 11 节） |
| 事件导出 | `node core/render/events.mjs styles/hologram-hud/demo`（本次导出 events 71 条 / dur 39） |
| 本风格专属参数 | 甩镜段 **5 子帧真运动模糊**（180° 快门、1/48s），HUD 保持锐利；实体全息面 Fresnel `0.3 + 0.7·(1−facing)^1.6` × 滚动 interlace（2px 满 + 2px 38%，每帧滚 1px）；点亮时线宽 ×1.5 缓落到 ×1.12；光柱必须是**一条 path、非零环绕**（分开画会出现暗楔或双亮缝）；无颗粒 |
| 一键复现 | `sh styles/hologram-hud/demo/build.sh`（模型 → TTS → whisper → export → score → cuecheck → mix → srt → 渲染 → mux → 成片 whisper 抽查，共 8 步） |
| 换内容的验证命令 | `CONTENT=content_alt.json NAME=kite sh styles/hologram-hud/demo/build.sh`（产物在 `demo/out/kite/`） |

---

## 10. 编排规则

- **内容文件字段契约**：全部文字、数字、颜色、模型路径、配音稿都来自 `demo/content.json`，**代码里不含任何文案**（`DEMO.md:92`）。字段：`product`（1–10 字符）、`model_code` / `category`（合计 ≤30）、`tagline`（≤60）、`model`（模型 JSON 路径）、`hue` / `accent`（0–360）、`voice {id,speed}`、`intro_vo`（≤5s 口播）/ `outro_vo` / `callouts[].vo`、`*_vo_asr`（可选，告诉 whisper 该听到什么）、`callouts[]`（**2–5 条**：`part` / `label` ≤24 / `value` ≤6 / `unit` ≤4 / `detail` ≤40 可选 / `vo`）、`footer.weight` / `footer.price`（`{label,value,unit}`，value ≤7）/ `footer.cta`（≤34）、`film_title` / `credits[]`。
- **事件词汇表**（`type` → 消费者，`style-dna:213-243`）：`scan` / `scan_tick` / `scan_done`、`roll{d,n}`、`confirm_small` / `confirm`、`type_line`、`detect{i}`、`lock{i,part}`、`lock_small`、`push{d}`、`orbit{d}`、`explode{part,d}`、`leader`、`reassemble{part}`、`dock{i}`、`whip{d}`、`jcut{part,d}`、`loupe_open` / `loupe_close`、`powerdown{d}`、`ignite`、`glitch{d}`、`wave{d}`、`spin{d}`、`ping{i}`、`cta`、`erase{d}`、`card_tick`、`silence{d,kind:'near'|'true'}`、`vo{id,d}`。**这份 type 表同时喂给 `mix.py`（声音）、`score.py`（网格）和 `cuecheck.py`（卡点自检）**。
- **时间线契约**：`makeFilm(C, model, dur)` 必须返回 **`{ render, TL, events, subs, timeline }`**——`render(ctx, t, opt)` 逐帧绘制（`opt.nosub` / `opt.noblur`）、`TL` 段落表、`events()` 声音事件、`subs()` 字幕条、`timeline()` 配乐网格 `{bpm, bar, dur, intro, calls, regroup, high, lock, end, vo}`。页面契约（`main.js`）：`window.DUR / window.TL / window.EV / window.SUBS / window.TIMELINE / window.render`。`tools/export.mjs` 用无头浏览器把这些导出成 `events.json` / `timeline.json` / `out/srt.json`。
- **新增主体怎么接入**：写一个模型生成器（`models/gen_<name>.mjs`），用 `mkmodel.mjs` 的图元拼；每个 **part** = 「一个可被 callout 瞄准的东西」（`{id, anchor(必须在零件表面), center, tagDir, pieces[]}`），每个 **piece** = 「炸开时独立移动的刚性子装配」（`{id, v, e, q?, explode, axis?, internal?, hot?, box:false?}`）。规则：每个 piece 必须**物理接触**邻件；管件 = 环 + 纵向线；总顶点约 5k / 边约 6k；承载关键数字的部件要有一个 `hot` 内部件和一个**沿自身轴滑动**的外壳（`DEMO.md:178`）。长软管/线缆要设 `box:false`，否则会把目标框撑爆（`DEMO.md:81`）。
- **换主题时要改哪些文件**：① `demo/models/gen_<name>.mjs` —— 新模型生成器（唯一必须新写的）；② `demo/content.json` —— 全部文案、数字、`hue` / `accent`、配音稿（**换完这一份，时间线、配乐、cue 表、侧栏间距全部自动重排**，因为 `score.py` 读 `timeline.json` 排段落）；③ 若要换声线，改 `content.json` 的 `voice.id`。**不需要动** `engine/holo.js`、`engine/hud.js`、`film.js` 的骨架。
- **与 `dub.mjs` 通路的关系**：`dub-styles.json#hologram-hud` 的 `palette` **全为 null**——因为 `STYLE.md §3` 把颜色写成参数（「One cold hue plus one warm accent」），全篇未给任何固定 hex。能生效的参数有：`bgRecipe`（`grid` + `dot-grid` 贴图 + vignette 0.5）、`subtitle`（DengXian、字号因子 0.045、marginV 0.145、marginL 0.06、outline 0.00333、居中）、`title.fontSizeFactor 0.082`、`overlay.accentRule: true` / `progressBar: true`、`motion.subtitleFadeIn 0.08` / `chapterTransition: "iris"`（对应 §5 的 loupe iris）、`accent: null`。★ **2026-10-03 已修**：该条目的 `accent` 原为 `#D97757`（即 demo `frames.js:18` 的 `keep:{star:'#D97757'}` 保留色，**不是本片真正用的 hue 188 / accent 38**），现已移除、改为 `null`——配置不再断言这个错误的代理色。下游走 dub 通路时底色与强调色仍会回退（palette 各项均为 null），需要自行按主题选冷色相。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **字幕源本次没有重新生成**：出片日志 [3] 段明确告警 `styles/hologram-hud/demo/tools/export.mjs 失败（退出码 1）—— 该 demo 的字幕源没有更新`，[6] 段再次告警「本 demo 没有本次新生成的字幕源 —— .srt 沿用仓库里已提交的旧文件，未重新生成」。**成片里的字幕是渲染器直接画的（不是烧 .srt），但随片交付的 `.srt` 是仓库旧文件**，两者可能不同步。这是本次出片最实在的一个缺陷。
- **dub 通路的 palette 全为 null**：`lib/dub-styles.json#hologram-hud` 的 `bg` / `bg2` / `fg` / `subtitle` 都是 null，只有 `accent: #D97757`；下游回退 plain-dark 底色，且这个 accent 并非本片实际色。走「文案 + 风格」通路时，本风格最核心的「冷色相 + 暖强调」配色**需要下游自己生成**。★ **2026-10-03 已修**：原 `accent: #D97757`（keep 保留色、非本片色）已移除，现 palette 各项**均为 null**；配色仍需下游按主题生成（原观察保留如上）。
- **字体回退**：`STYLE.md:36` 点名 Rajdhani（Light/Medium/SemiBold）+ Share Tech Mono，本机都没有；dub 通路回退 `DengXian`（等线）。等线不是窄体几何大写，**滚动数字的等宽抖动控制**与 Rajdhani 的气质都会明显失真。成片本身用的字体在 `demo/fonts`，不受此影响。
- ~~**9:16 不可用**：`style.json` 无 `aspects` 声明，只有 16:9；HUD 全部按 1920 宽绝对像素布局，竖屏会丢掉右侧 43.75%（含大卡片与右侧大数值）。~~ **★ 2026-10-04 已修**：`demo/index.html` 加「设计帧等比装入」外壳 + `demo/film.js` 追加 `aspects` 声明（5 个比例全支持），9:16 下全部 HUD 面板与字幕都在（见第 2 节）。残留代价：竖屏有效画面只占 1080×607、HUD 小字缩到 56.25% 会变糊。
- **本 demo 无 `voice_fx.py` / `voice.py`**：旁白为 Kokoro TTS 直出，无 EQ / 压缩 / 空间化（日志 [配音 1/1] 行）。
- **甩镜帧信息不可读**：`f09` 那一帧处于 5 子帧运动模糊中，画面几乎糊成一片——这是设计使然（`STYLE.md:48`），但意味着**甩镜段不能承载必须被读到的文字**。

### 素材缺口
- **无外部图像/视频素材缺口**：线框模型、舞台、投影台、HUD、配乐、拟音全部程序化生成。
- **模型素材需自制**：`content.json` 的 `model` 指向的线框模型必须自己写生成器（或用 `modelFromPath` 从 2D 路径挤出）。demo 自带 `models/gen_volt.mjs`（电助力车）与 `models/gen_kite.mjs`（无人机），可直接读作模板。
- **字体缺口**：Rajdhani 与 Share Tech Mono 本机不存在（见上）。
- **`content_alt.json` 只是技术检查**：`DEMO.md:92` 与 `STYLE.md:123` 都明确——换 content 只是「验证引擎能重排」的技术检查，**不是做片子的方式**；真片子要有自己的 treatment、顺序、相机路径与时间线。

### 能力限制
- 只适合有**部件**、有**可量化参数**的题材；`STYLE.md §11` 给了 5 种用例的时长区间：规格讲解 30–40s（2–5 个部件）、循环屏 20–30s（3–5 个规格，无旁白，末帧 = 首帧）、拆解 40–60s（每部件 4–6s）、升级 20–30s、装配顺序 20–40s。**超出这些区间的题材本风格撑不住。**
- `callouts[]` 硬上限 **5 条**（超过放不进左侧栏，侧栏步距 `min(112, 410/(n−1))` px 只够 5 枚）。
- 渲染很快（936 帧 19s），但**甩镜帧成本是普通帧的 5 倍**（`DEMO.md:77`）。GPU 独占，不可并发。

### 踩过的坑（本机实测 + demo 自述）
- 出片命令是 `node lemo-make.mjs hologram-hud --skip-sync --no-preflight --ratio 16:9`——**跳过了两份库同步与预检**，16:9 是手动补的参数。
- `tools/export.mjs` 在 `--skip-sync` 下**直接失败退出码 1**（日志只留下 `}` 和 `Node.js v22.22.2` 两行残迹），导致字幕源没更新。日志还列出编排器探测过的候选（`tools/subs.mjs` / `subs.mjs` / `tools/export.mjs` / `tools/subs.py` / `subs.py` / `tools/cues.py` / `cues_export.py`），结论是「只有 4 个 demo 的 srt 由自带的 srt 生成器直接产出」——**本 demo 不在其中**。
- 音频与渲染**并行**完成（日志：29.4s），总耗时 47.8s。
- ASR 校对：5 行全部 OK，`mismatches: 0 (lang=en, model=base.en)`。注意 ASR **对数字与标点都不敏感**：`Eighty kilometres` 回读成 `80 kilometers`、`Seventeen point four` 回读成 `17.4`、`A 250-watt` 回读成 `A two hundred and fifty watt`，都判 OK——所以 `*_vo_asr` 字段要按「whisper 会听到什么」来写。
- demo 自述的坑（`DEMO.md:79-88`）：滚动 interlace 用 `setTransform(…, offset)` 再 `destination-in` 会清掉偏移矩形外的全部内容 → 要 `offset % patternHeight`；刹车油管把目标框撑爆 → `box:false`；长斜引线上的热点标签会被读成指错零件 → 改成在零件本体上画环、芯片放旁边、闪一下零件；甩镜写在下一段会播成硬切 → 要提前 0.45s 起步并检查 0.1s 帧条；两个平行目标框（盖子与电芯都动）读不出「炸开」→ 改成外壳沿轴滑动、内容物留在原地发光；光柱分开画会有暗楔或双亮缝 → 一条 path 三个子路径、非零环绕；扫描擦除最初只裁边、半透明面会残留。

### 下次迭代优先补什么
1. 修 `tools/export.mjs` 在 `--skip-sync` 下退出码 1 的问题，让字幕源能重新生成（否则随片 `.srt` 永远是旧文件）。
2. 给 `dub-styles.json#hologram-hud` 补上真正的冷色相底色与强调色（现为 null + 一个保留色），否则 dub 通路无法复现本风格的配色内核。
3. 补一份竖屏（9:16）的 HUD 重排方案：卡片与左侧栏按 1080 宽重算，而不是裁 1920。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/hologram-hud/hologram-hud.mp4`（39.00s / 34.0MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/hologram-hud/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **94/100**（2026-10-03 校正：原 93，dub 通路 accent 错误代理色一条已修，palette +1） |
| 详细资料 | 有：`styles/hologram-hud/STYLE.md`、`DEMO.md`、`demo/build.sh`、`style.json`、`lib/style-dna/hologram-hud.md`、`lib/style-dna/hologram-hud.json`、`lib/dub-styles.json#hologram-hud`、`_distill/logs/hologram-hud.log`、demo 源码（`film.js` / `engine/holo.js` / `engine/hud.js` / `models/mkmodel.mjs` / `content.json` / `music/score.py` / `mix.py`） |

**逐帧拆解要点**（24 帧覆盖 39.0s，约 1.63s/帧）：

- **f01**（≈1.6s）：Hook。圆形投影台的椭圆边在近黑里清晰可见，主体只扫出了一半（前轮与车架的线框已现，后半仍在暗处）；四角括号、左上 `VOLT CE-01 // SPEC SCAN`、右上 `SCANNING 042%`、底部遥测行全部到位。**这一帧就证明了「三层纵深」——网格、主体、HUD 同时在场**。
- **f03**（≈3.3s）：标题段。左侧 `VOLT` 大号超细字 + `CE-01 CITY E-BIKE` 等宽小字 + `Stripped to what matters.` tagline；完整线框车居中偏右，青色；底部字幕条 `This is Volt. A city e-bike, stripped to what matters.` 带声纹条与斜括号。右上状态已变成 `SCAN COMPLETE · 3 SYSTEMS`。
- **f07**（≈9.8s）：**Part 1 的特写**。机位推近到 downtube，目标框（青色、旋转 45°、带 `TGT 01 · LOCK` 标签）套住电池；右侧深色底板卡片 `BATTERY RANGE / 20 km / 540 Wh — hidden in the down tube`。**注意数值此刻是 20，仍在滚动中**（滚动数字 1s，第一条最长）。右上 `TARGET 1/3 · BATTERY`。
- **f08**（≈11.4s）：同机位，数值**已滚到真值 `80 km` 并转成琥珀强调色**——这是本风格的「兑现节拍」。卡片标题与 detail 行不变，只有数字变色，完全对应 `STYLE.md:30`「强调色只花在锁定的真值上」。
- **f09**（≈13.1s）：**甩镜中的运动模糊帧**。整幅画面糊成一片，只有右侧卡片 `BATTERY RANGE / 80 km` 保持锐利——验证了 `STYLE.md:48`「真运动模糊只在甩镜内，HUD 保持锐利」。这一帧基本不可读，说明甩镜段不能承载必读文字。
- **f11**（≈16.3s）：**Part 2**。电机沿轴炸开（端盖/转子/定子/端盖分开），转子与定子反向自转；目标框套在中心；右侧卡片 `REAR HUB MOTOR / 250 w / 45 Nm — sealed, silent`；左侧栏已出现第一枚停靠芯片 `BATTERY RANGE 80 km`。
- **f13**（≈19.6s）：**Part 3 + 放大镜**。相机拉远到全身，右上出现画中画放大镜圆窗（×4.3，自己的反向环绕）看刹车；右侧卡片 `HYDRAULIC DISC / 160 mm / Two-piston — all-weather`；**左侧栏三枚芯片齐全**（BATTERY RANGE 80 / REAR HUB MOTOR 250 / 另一枚）。三层信息（全身 + 放大镜 + 卡片 + 侧栏）同屏不碰撞，正是 `STYLE.md:69` 要求的排布。
- **f17**（≈27.6s）：**High point（点亮后的 360° 转台）**。车身几乎正对/俯视，线框加粗、面已点亮，主体占据画面中央一大块；左侧栏三枚芯片全部为琥珀值；投影台环在最下方。这是全片唯一一次看到物体的每一面。
- **f19**（≈30.9s）：**Spec sheet 落版**。左侧 `VOLT` 标题回归（与 f03 同一位置，首尾呼应）；左侧栏三枚参数芯片；右侧大数值 `WEIGHT 17.4 kg` + `4,533 USD` + CTA `Available now. Ready when you are.`；底部字幕 `Seventeen point four kilos. Ready when you are.`。**这一帧可以直接当海报用**（`DEMO.md:10` 的原话）。
- **f22**（≈35.7s）：**扫描擦除**。物体已被擦掉，只剩投影台环与两团极淡的残影——与 hook（f01）形成镜像。画面上部已无任何 HUD 卡片。
- **f24**（≈39.0s）：**片尾卡**。中央 `Volt · Spec Scan` 大号、下方 `SCI-FI HOLOGRAM HUD`、`Lemo-Opuscar`、`LemoLab × Claude Opus 5.5`，再下面是 Voice / Fonts / Product 三行小字（Voice Kokoro af_heart、Fonts Rajdhani + Share Tech Mono、Product model and score: original, made to order），背景是极淡的投影台环。每行是**滚入**的，不是淡入（`DEMO.md:59`）。

**全片色走**：**青色（hue 188）从头到尾不变**，负责线框、HUD、面与热边；**琥珀（accent 38）只在数值变真的那一刻出现**，且只出现在数字上。没有出现第二种冷色相，也没有任何品牌色。逐帧看下来，全片色相数 = 2（青 + 琥珀），与 `STYLE.md:29` 声明的「一个冷色相 + 一个暖强调」完全一致。

**节奏观察**：f01–f03（0–3.3s）是扫描生长 + 标题，画面元素从少到多；f07–f13（9.8–19.6s）是信息密度最高的三个 callout 段，每帧都在换机位、换卡片、换侧栏；f17–f21（27.6–34s）回到稳定构图，只有数字和芯片在动，是**刻意的阅读时间**；f22–f24 擦除 + 片尾。**全片没有一帧是硬切**——每个相邻帧之间都是相机在动，符合 `STYLE.md:49`「场景内没有剪切」。

**自检发现的缺陷**：① `tools/export.mjs` 退出码 1，字幕源未重新生成，随片 `.srt` 是仓库旧文件；② dub 通路 palette 全 null、accent 曾取的是保留色而非本片色——★ 2026-10-03 已修（错误的 accent 代理值 `#D97757` 已移除，现为 `null`）；③ Rajdhani / Share Tech Mono 本机无，dub 回退 DengXian；④ 9:16 无适配；⑤ 本 demo 无 `voice_fx.py`，旁白为 TTS 直出。

**本次为补齐短板做了什么**：**没有改动任何源码**（红线：不改 `lemo-make.mjs`、不改 `D:/lemo-opuscar` 下源码）。短板全部如实记录在第 11 节，留给下一轮迭代。
