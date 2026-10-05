---
name: lemo-style-tilt-shift
description: 【lemo 风格 Skill · 移轴微缩】做城市/物流/交通/节日这类「一个系统 + 许多小演员」题材时用；交付「高处俯拍、只有一条水平窄带清晰、全世界像桌面模型」的明亮玩具城观感。选定本风格做视频时，优先读本文件。
slug: tilt-shift
name_zh: 移轴微缩
category: 材质与 3D
film: Toy Town Rush Hour
---

# 移轴微缩（`tilt-shift`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/tilt-shift/STYLE.md` · `styles/tilt-shift/DEMO.md` · `styles/tilt-shift/demo/build.sh` ·
> `lib/style-dna/tilt-shift.json` · `lib/style-dna/tilt-shift.md` · `lib/dub-styles.json#tilt-shift` ·
> `styles/tilt-shift/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部「从高空用移轴镜头 + 延时相机拍一个真实地方」的片子。画面里**只有一条水平的窄带是清晰的**，上下都融进模糊——眼睛把这读成微距拍小东西，于是整个世界变成了模型。让这个把戏成立的另外两件事是：**饱和的阳光色**（模型火车漆那种漆色）和**延时跳帧**（车与人像发条玩具一样一格一格快进）。世界本身必须是写实的，只有镜头与时钟把它变小（`STYLE.md:6-10`、`style-dna/tilt-shift.md:11-13`）。

**不是什么**（最容易做错的邻居风格）：不是玩具或黏土渲染（世界是写实的，不做平涂与手办质感）、不是游戏俯视图（没有 UI、没有干净平涂）、不是无人机航拍（虚化带、饱和度、跳帧是必须的，缺一条就散）（`STYLE.md:10`、`style-dna/tilt-shift.md:152-155`）。

**什么时候用它**：题材天然是「**一个系统 + 许多小演员**」时——城市早高峰、物流枢纽、机场周转、港口装卸、集市、节庆布置、房地产/交通宣传（`dub-styles.json#tilt-shift.tags.theme`、`style.json:11-15`）。样片《Toy Town Rush Hour》就是一座程序化小镇从黎明醒来、涨到堵车峰值、在鸭子一家过马路时把时间砸回真实速度、再升到整城变成电路板（`DEMO.md:8-16`）。

**一句话内核**：高机位 + 虚化带 + 延时跳帧三件套不能拆；用一个饱和的「被发现的」主体在清晰带里带着视线走，让整个世界读成一台被时钟驱动的模型。

**边界**：它撑不起——真人情感戏与内心独白（情节靠速度、虚化带和系统承载，不靠台词）、长复合句的抒情旁白、需要特写人脸或精细表演的内容、抽象概念当主语的片子（只说能在这个地方被拍到的东西，`style-dna/tilt-shift.md:47-51`）。全片机位永远在高处，只有刻意的亲密时刻才降到演员高度（`STYLE.md:14`）。

---

## 2. 画面构图

- **镜头数与画幅**：原生 **16:9 / 1920×1080**（本次出片即 `--ratio 16:9`，`logs/tilt-shift.log:1-2`）。全片 8 个功能镜：dawn / title / ix / train / jam / ducks / rise / end（`story.js:17-19`）。相机运动永远是**平滑的**，跳帧只发生在世界里，不在相机上（`STYLE.md:36`）。
- **主体位置与占比**：斜视镜一律 **45–55° 俯角、110–200 m 距离、27–30° 垂直 FOV**（`DEMO.md:29`）；「棋盘游戏」感用垂直俯拍 + 缓慢旋转（帧 f13/f21）。近景镜是特例：相机约 1.7 m 高、6–8 m 远、约 12° 俯角、17° FOV、近平面 0.08 m，鸭子一家填画面高约 **1/4–1/3**（`DEMO.md:29`、帧 f16）。
- **负空间 / 留白**：靠**虚化带**制造，不靠空白。清晰带很窄（半宽 `w` 0.055，鸭子镜收到 0.035），带外上下都是化开的街区（帧 f01/f13）。
- **图层叠放顺序**（从底到顶）：天空渐变环境图 + 雾 → 程序化城镇（立面 + 屋顶杂物 + 招牌）→ 交通/行人/光轨 → 英雄演员（鸭子，含接触阴影）→ 2× 超采样后做的移轴 DOF gather → 调色（饱和 + 对比 + 暗角）→ HUD（延时时钟）→ 字幕（路牌面板）（`STYLE.md:12-19`、`post.js`）。
- **安全区**：字幕坐进**下虚化带里**、离底 118 px（`DEMO.md:55`）；延时时钟固定在**左上角**（帧 f01/f05/f10/f13 都在左上）。主体（被发现的饱和物）放在清晰带上，别的都让位（`STYLE.md:25`）。
- **本风格不能出现的构图**：低机位（除非刻意亲密时刻）、高楼峡谷挡住地面（低/中层层高 + 45° 以上俯角，`STYLE.md:81`）、主体被立面或峡谷挡住、无来由的运镜、让相机跟着跳帧（`STYLE.md:107`）。

**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。改造**没有**逐处改写绘制点（three.js 相机 + 移轴 DOF 后处理链自持一套构图，逐处改必然静默错位），而是只改**一个页面外壳文件** `demo/index.html`：影片本体仍按**固定设计帧 1920×1080** 画（一字未改），当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧等比装入**（contain）并居中，留边露出页面底色 `#8fb4d8`（`dub-styles.json#tilt-shift` 的 `palette.bg`，天空蓝）。声明在 `demo/film.js`（`FILM_META.aspects`，控制台按源码文本探测）。`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`。

- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform、不改底色）。本风格后处理链（bloom / DOF gather）**跨进程非确定**（同帧渲两次 md5 不同），故 16:9 判据用 **PSNR + 「同帧两次」噪声地板**：改造前 vs 改造后 3 帧 PSNR **53.86 / 50.22 / 48.85 dB**，与同帧两次的噪声地板 **53.86 / 50.22 / 48.92 dB** 逐帧几乎相等（差 ≤0.07 dB）⇒ 差异**不可与噪声区分**；且**同会话往返**（1920×1080 → 1080×1920 → 1920×1080）实测 md5 **逐字节相同**（证据强度：往返为强证据，跨进程只到噪声地板）。
- **9:16 不裁切**：整幅 16:9 画面、左上延时时钟、底部字幕**全部在画面内**（实测：改后 9:16 vs 16:9 中心裁切 SSIM **0.59–0.67**，vs 理想等比装入 SSIM **0.987–0.991**）。
- **已知代价**：① 竖屏下有效画面只占 **1080×607**，横贯画面的清晰带与路口全景按紧轴缩到 **0.5625×**（细节变细，**清晰带仍是横向的**）；② 上下留边是**天空蓝纯色**（实测留边 YAVG=173 = `#8fb4d8`），与画面上缘的天空同色系、肉眼无明显接缝；③ 其它比例同理（3:4 / 4:3 / 1:1 已声明）。
- **没有做的**：这是**等比装入**，不是**重排**——虚化带没有转成纵向、俯拍没有改成更垂直。要真正的竖屏构图仍需重画机位与 band 参数（见第 11 节）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 公园绿 | `#6fa24a` | 树冠 / 绿地（饱和） | `DEMO.md:45` |
| 沥青 | `#4b4e53` | 道路 / 深色地面 | `DEMO.md:45` |
| 立面暖白 | 暖白 / 奶油 / 赤陶 / 砖 / 淡黄 / 薄荷 / 天蓝 | 建筑立面（模型漆色系） | `DEMO.md:45` |
| 车色 | 白 / 银 / 黑 / 红 / 蓝 / 黄（出租车） | 车流 | `DEMO.md:45` |
| 黎明东侧填充 | `#ffb48c` | 黎明暖低填充（日出侧） | `DEMO.md:48` |
| 字幕牌底 | `#0f5e3c` | 圆角路牌面板绿 | `DEMO.md:55` |
| 字幕字 | `#FFFFFF` | 牌面白字 | `DEMO.md:55` |
| 延时时钟 | 琥珀（延时）/ 绿（真实） | `×24 TIME-LAPSE` / `×1 REAL TIME` | `DEMO.md:56` |

- **明度 / 对比规则**：中性色调映射 + **强饱和 ×1.55** + 柔和加对比 +0.42 + 略暖高光 + 暗角 0.3（`DEMO.md:46`）。**阴影保持蓝而干净，绝不发灰**；只有夜与黎明是低饱和态，且黎明必须读成清晨（暖低填充、很少亮窗），不是午夜（`STYLE.md:24`、`DEMO.md:48`）。
- **禁止出现的颜色**：发灰的中性阴影、午夜感的死黑黎明、低饱和的「阴天」调（`STYLE.md:24`、`style-dna/tilt-shift.md:152`）。
- **同一画面最多几个色相**：立面用一整套暖白 + 糖果色点缀，但**你要被找到的那个主体必须是清晰带里唯一饱和的东西**，或逆着车流移动（`STYLE.md:25`）。样板三套配色方向：地中海港口（白墙/钴蓝百叶/赤陶/绿松石水）、雪山小镇（白/松绿/红缆车/长蓝影）、沙漠集市（沙/藏红/靛蓝篷/橄榄灰）（`STYLE.md:26`）。

---

## 4. 转场规则

- **镜头之间怎么切**：**在拍点上硬切**（全片挂在 120 BPM，1 拍 = 0.5s、1 小节 = 2s，`story.js:4`）。另有速度坡（变速）、俯冲（dive）与上升（rise）作为「镜头之间的运动」（`STYLE.md:58`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有溶解/叠化**——会暴露假镜头（`STYLE.md:58`、`style-dna/tilt-shift.md:107`）。有**连续俯冲**：从垂直俯拍一路降到车头附近的中景近景，速度在俯冲中从 ×40 掉到 ×1（帧 f13→f16，`DEMO.md:26`）。有**对数高度的垂直上升**收尾（40 m → 820 m，穿一层薄云，帧 f21→f24，`DEMO.md:27`）。
- **硬切点怎么定**：按 `SHOTS` 边界切：0/5/9/14/19/24/30/34/38（`story.js:18`）。关键时刻表 `T` 另锚定：首音 3.0、片名字母每 0.25s 亮一个（5.0 起）、变灯 10.0/12.0、列车停 17.0/开 18.6、喇叭 20.0–22.0、掉速 22.5→24.0、鸭子跳 24.8/25.6/26.4/27.1/27.8/29.4、放行 30.0、终止和弦 34.0（`story.js:8-15`）。
- **转场时长与缓动**：掉速用 smoothstep 从 ×40 降到 ×1（22.5–24.0s），放行 30.0–30.6s 升回 ×40（`story.js:23-29`）。缓动是「连续、平滑」的，不允许相机出现台阶感。
- **绝对不要的转场**：溶解/叠化、无来由的运镜、让相机跟着跳帧（`style-dna/tilt-shift.md:107`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | Overpass 600（OFL，Highway-Gothic 复兴，`STYLE.md:30`）；延时时钟用 Overpass Mono（`DEMO.md:56`） |
| 字号（相对画面宽 / 高） | 字幕 **44 px**（1920 宽下约 2.3% 画面宽，`DEMO.md:55`）；通路 `fontSizeFactor 0.03519`（`dub-styles.json#tilt-shift`） |
| 颜色 / 描边 / 阴影 | 牌面白字 `#FFFFFF`；坐在 `#0f5e3c` 圆角路牌面板里、带内嵌白色 keyline；左侧一枚亮绿的小红绿灯图标（`DEMO.md:55`） |
| 位置 / 安全边距 | 离底 **118 px**，坐进下虚化带（`DEMO.md:55`）；通路 `marginVFactor 0.14537`、`marginLFactor 0.06019`（`dub-styles.json#tilt-shift`） |
| 单行字数上限 / 最多行数 | 一行一句；demo 6 行实测 24–36 字符（最短 `Every song needs a rest.` 24，最长 `By eight, the whole town is playing.` 36）（`style-dna/tilt-shift.md:38`、`cues.json`） |
| 出现与消失方式 | 停留 ≥ `max(1.8s, 语音时长 + 0.6s)`（`STYLE.md:30`）；demo 实测每条 2.2–3.0s（`cues.json`） |

- **字幕与旁白的关系**：字幕不是「字幕条」，而是**世界自己的标识系统**——一块用当地招牌语言做的牌（路牌、站台牌、港口通告）（`STYLE.md:30`）。另有一个**延时时钟 HUD**在左上角，带速度读数：`07:12` 加小秒、`×24 TIME-LAPSE`（琥珀）、`×1 REAL TIME`（绿），它是观众看「延时」这个原生把戏的**速度表**（`DEMO.md:56`、帧 f01/f13）。
- **本风格特有的字幕禁忌**：**数字必须写成单词、把数字放进 `asr` 字段**（`STYLE.md:66`、`lines.json` 的 v1/v3/v4）；不要用第一人称抒情句；单句不要超过 36 字符（会盖过一次速度变化，`style-dna/tilt-shift.md:50`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「a panel in the graphic language of the place’s signs」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#000F5E3C`（AARRGGBB，落盘 ASS 为 `&H003C5E0F`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(15,94,60,1)）；字色 #FFFFFF 与该底衬的 WCAG 对比度 **7.82**。

---

## 6. BGM / 音效特征

- **配乐**：**有音高的打击乐承载风格**——马林巴、钟琴、颤音琴、木鱼、卡林巴、钢片琴，脉冲式、极简（Reich 语法：相位、声部一个个加入、脉动和弦），再加拨弦或小编制簧管；**不要通用钢琴与弦乐**（`STYLE.md:62`）。样板是采样极简马林巴合奏、**120 BPM**，让 8 Hz 延时跳帧正好是十六分音符；**固定乐句骨架 + 城市事件 gate**（车过停止线 gate 马林巴、绿灯给木鱼、人群给钟琴、车厢给低音）（`DEMO.md:33`）。本次 score 实际乐器：claves / contrabass_pizz / glockenspiel / horn / horn_stac / marimba / shaker / sus_cymbal / trombone / trombone_stac / trumpet / trumpet_stac / vibraphone / vibraphone_bowed / vibraphone_hard / woodblock（`logs/tilt-shift.log:54`）。
- **拟音（foley）清单**：延时段很轻的「加速城市」颗粒底噪、轨道咔哒（`carriage`）、变灯继电器（`light`）；真实速度段——怠速引擎、远处车流、麻雀、细小的鸭叫与啾声（`quack`/`peep`）、蹼掌拍柏油（`duckStep`）、入水（`splash`）（`STYLE.md:64`、`style-dna/tilt-shift.md:193-195`）。demo 另有一批硬编码同步拟音：0.5s 红车驶过、2.98s 绿灯、16.2–18.4s 列车进站（squeal/hiss/chime）、19.3–22.3s 堵车喇叭、22.45s tape-stop、29.85s 放行引擎（`mix.py:87-102`）。
- **旁白处理**：放松、少而短；音乐在人声下 duck **约 −8 dB**（demo 实际 `1 − 0.6·vk`）（`STYLE.md:66`、`mix.py:127-136`）。demo 人声 Kokoro `am_adam`、speed 0.9–0.95、6 句短话（`lines.json`）。
- **响度目标**：`-14 LUFS`；**交付真峰值上限**：`-1.2 dBTP`（项目级交付线；本风格 `STYLE.md:66` 只写 master −14 LUFS，未额外声明更严上限）。本次成片实测 **I = −14.1 LUFS / LRA 7.8 LU（`ebur128`）/ 真峰值 −1.56 dBTP（`loudnorm` `input_tp`，4× 过采样）—— 真峰值在交付线内，余量 0.36 dB、未削波**（`logs/tilt-shift.log:125-128` 只印了 `ebur128` 的 `Peak -1.6 dBFS`——那是 1 位小数读数，`astats` 采样峰值 −1.588653 是下界，两者都不能当真峰值用）。demo 先把整体推到 RMS≈−17 dB 再限幅在 −1.5 dBFS，让 mux 的两遍 loudnorm 能线性增益到 −14 LUFS（`mix.py:134-136`）。
- **静音策略**：**静默 = 真实时间到来的那一刻**——切掉音乐，只留一两个真实声音（`STYLE.md:65`）。demo 的掉速是一个 **tape-stop**：varispeed 1 → 0.22、声部一个个退出、然后真静默；休止里每个故事事件只弹一个柔和的音，每次鸭子跳升一级音阶（`DEMO.md:36`、`story.js:13`）。

---

## 7. 素材偏好

- **需要什么素材**：**全部在代码里程序化生成**，不依赖实拍/图库。需要——一座程序化城镇（`city.js` 立面着色器 + 招牌）、合并几何（`geo.js`）、时钟驱动的天空/太阳/雾/环境图（`sky.js`）、交通仿真（`traffic.js` 车道/灯/IDM/车队/光轨/行人）、通勤列车（`train.js`）、英雄演员（`ducks.js` 车削鸭子）（`STYLE.md:93`、`style-dna/tilt-shift.md:204-211`）。
- **不需要什么素材**：真实地点照片、真实地标/品牌/logo（一律不出现，`STYLE.md:4`）、玩具/黏土渲染、游戏 UI 素材、无人机航拍原片（`STYLE.md:10`）。
- **取景 / 质感 / 比例偏好**：**模型感细节**是「拍出来的微缩」与「游戏 CG」的分界——立面多种窗型、1.6–3 m 开间、深窗洞、世界空间污渍、反射天光的玻璃、越靠地面越暗的墙、屋顶杂物、遮阳篷与招牌、磨损标线与污迹、车有暗玻璃 + 柔和接触阴影 + 刹车灯、一切叠 AO（`STYLE.md:18`、`DEMO.md:49`）。**人**是小彩色胶囊（模型火车小人，0.5 m），近处演员要有机身体 + 柔和 sheen 材质并**放大 20–30%** 才读得出来（`STYLE.md:19`、`DEMO.md:45`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有程序化城镇就用简单盒体 + 立面贴图拼街区（`geo.js` 的最小用法：用 `geo.js` 盒子搭一个港口，把船当单车道 `traffic.js` 车队跑在水上，`band.follow` 指向其中一条，`STYLE.md:93`）；没有英雄演员就把「被发现的饱和主体」降级为一辆逆行的车或一盏独亮的灯，虚化带照样跟它走。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 4–6s 为主（dawn 0–5、title 5–9、ix 9–14、train 14–19、jam 19–24、ducks 24–30、rise 30–34、end 34–38）（`story.js:18`） |
| 全片时长 | 38.0s（`style.json:17`、`story.js:5`）；本次成片 **38.00s / 912 帧**（`logs/tilt-shift.log:115`） |
| 镜头数 | 8 个功能镜；事件 **2182** 条、字幕 **6** 条（`logs/tilt-shift.log:27-28`） |
| 信息投放节拍 | 安静（黎明一条光轨）→ 系统醒来（演员变多、节奏建立）→ 最大密度 → 硬掉到真实速度（鸭子过马路，失败一次再成功 = 喜剧拍）→ 放行回到快进 → 上升到一个尺度揭示（`DEMO.md:14`、`style-dna/tilt-shift.md:59-66`） |

- **加速 / 减速点**：**延时跳帧是灵魂**——快进时整个世界以低速率更新、每个位置保持若干帧（8 Hz = 24 fps 下 3 帧），速率分档：快进 8 Hz、×2 与 ×6 之间 12 Hz、×2 以下变平滑（`STYLE.md:36`、`DEMO.md:50`）。速度曲线：t<22.5 → ×40；22.5–24.0 smoothstep 降到 ×1；24.0–30.0 → ×1；30.0–30.6 升回 ×40（`story.js:23-29`）。
- **留白与静音的位置**：静默落在 24.0–30.0s 的休止（RMS −41.3 dBFS，`logs/tilt-shift.log:61`）；开场 dawn 段也是低密度留白（RMS −39.3 dBFS）。音乐事件 onset 与关键帧对齐：3.00 / 4.50 / 5.00 / 14.50 / 17.00 / 20.00 / 22.00 / 24.80 / 25.60 / 26.40 / 27.10 / 27.80 / 29.40 / 30.00 / 34.00（`logs/tilt-shift.log:69-83`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/tilt-shift/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs "$D" --fps 24 --workers 3 --q noev --out "$D/out/video24.mp4"`（`build.sh:18`）；本次编排器实跑为 `--workers 6 --size 1920x1080 --q noev`（`logs/tilt-shift.log:37`） |
| 帧率 | 24 fps（912 帧 = 38s，`logs/tilt-shift.log:115`） |
| 分辨率 / 比例 | 设计帧 **1920×1080 / 16:9**（`logs/tilt-shift.log:2`）；已支持多比例（`demo/film.js` 的 `FILM_META.aspects` = 16:9 / 9:16 / 3:4 / 4:3 / 1:1），经**页面外壳等比装入**实现（见第 2 节） |
| 混流 | `sh core/render/mux.sh "$D/out/video24.mp4" "$D/mix.wav" "$D/../tilt-shift.mp4" 24 1`（−14 LUFS / **颗粒 1**，`build.sh:20`） |
| 编码器 | `h264_nvenc`（本地 GPU；本次 `nvenc`，`logs/tilt-shift.log:7`） |
| 音频入口 | `demo/music/score.py`（采样马林巴，骨架 + 事件 gate）+ `demo/mix.py`（环境 + 拟音 + 人声 + 闪避） |
| 字幕入口 | `node "$D/subs.mjs"`（导 `cues.json`）+ `core/render/srt.py "$D/cues.json" "$D/../tilt-shift.srt"`（`build.sh:11-12`） |
| 事件导出 | `node core/render/events.mjs "$D"`（本次 events 2182 dur 38，`build.sh:10`、`logs/tilt-shift.log:27`） |
| 本风格专属参数 | **页面参数 `--q noev`（只透传给渲染，跳过事件扫描）**；调试开关 `nohud` / `nodof` / `nostep` / `az=<deg>` / `cam=x,y,z,lx,ly,lz,fov` / `aper=` / `bamp=` / `bmix=`（`DEMO.md:72`、`STYLE.md:214`） |
| 一键复现 | `sh styles/tilt-shift/demo/build.sh`（7 步：TTS+whisper → events+字幕 → 配乐 → 混音 → 渲染 → mux → 海报/风格帧，`build.sh:1-26`） |
| 本次编排器调用 | `node lemo-make.mjs tilt-shift --skip-sync --no-preflight --ratio 16:9`（`logs/tilt-shift.log:1`） |

**★ 关于 `--q noev` 的重要澄清**：渲染行的 `--q noev` 是**页面参数**，只透传给渲染、跳过渲染期的**事件扫描**，**不代表事件表该为空**。事件表（`events.json`，本次 2182 条）仍要由 `node core/render/events.mjs` 正常导出，供**配乐 / 字幕 / 拟音**消费（`build.sh:10` 先导出事件、`build.sh:18` 渲染时才带 `noev`）。把它理解成「渲染省一步扫描」即可，别误删事件链。

---

## 10. 编排规则

- **内容文件字段契约**：`story.js` 是**唯一时间真值**，导出 `BPM/BEAT/BAR/DUR/T/SHOTS/shotAt`、`WINDOWS/windowAt/clockAt/fmtClock`（把成片秒数映射到「城市时钟」，每个窗口一个倍率曲线，用 1ms 步长预积分保证确定性）、`VO`、`TITLE`（`style-dna/tilt-shift.md:181-183`、`story.js`）。每个时间窗有 `clock0`（窗口起点的城市时钟秒数）+ `rate(t)`：dawn 4×、title 240×、ix 24×、train 6×、jam 用 `jamRate` 曲线（`story.js:30-36`）。`VO` 每条 `{id, t, text}`，5–6 句，数字写成单词、数字放 `asr`（`lines.json`）。
- **事件词汇表**：`light{win}`（变灯继电器，按窗口区分）/ `carriage{k}`（列车车厢过钢轨接缝咔—嗒）/ `duckStep{i}`（蹼掌拍柏油）/ `hop` / `hopFail` / `quack{soft}` / `peep{happy}` / `splash` / `vo{id}`（`style-dna/tilt-shift.md:187-195`）。`mix.py` 读 `events.json` 做环境/拟音/人声/配乐。
- **时间线契约**：页面契约（`main.js`）为 `window.READY` / `window.render(t)` / `window.DUR` / `window.EV`（`style-dna/tilt-shift.md:183`）。`main.js` 负责相机、跳帧（stepping）、人群、HUD 与事件；`subs.mjs` 用 `openDemo(dir,{q:'noev'})` 导出字幕时间线（`subs.mjs:5`）。
- **新增主体怎么接入**：用 `geo.js`（合并几何构建器）+ `city.js`（程序化城镇/立面着色器/招牌）搭静态；动态系统用 `traffic.js`（车道/灯/IDM 跟车仿真/车队/光轨/行人）与 `train.js`；有生命的英雄演员参考 `ducks.js` 的车削（`LatheGeometry` 身体 + `MeshPhysicalMaterial` sheen 绒毛 + 接触阴影 blob）与 `duckState` 编排（过街/跳路沿：预备压缩 → 起跳拉伸 → 落地压缩 → 回弹，失败一次再成功）（`style-dna/tilt-shift.md:179`）。虚化带用 `makePost` 返回的 `dof.band = {y,w,amp,mix,tilt,pow}` 控制，`band.follow` 把带子投影到主体屏幕位置（`STYLE.md:93`）。
- **换主题时要改哪些文件**：① `demo/story.js`（BPM / 关键时刻 `T` / `SHOTS` / `WINDOWS` 时钟与倍率 / `VO` / `TITLE`，决定节奏与卡点）；② `demo/lines.json`（旁白与 `asr` 数字）；③ `demo/city.js`（城镇布局、立面着色器、招牌）与 `demo/geo.js`；④ `demo/sky.js`（时钟 → 太阳/天空/雾/环境图，黎明辉光）；⑤ `demo/traffic.js`（车道/灯/IDM 参数）；⑥ `demo/ducks.js`（英雄演员与跳跃编排）；⑦ `demo/post.js`（移轴 `TiltPass` 参数与 grade）；配乐改 `demo/music/score.py`，混音改 `demo/mix.py`。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里可生效的参数有 `palette`（bg `#8fb4d8` / bg2 `#e8e4dc` / fg `#1B2A34` / accent `#f2b705` / subtitle `#FFFFFF` / subtitleOutline `#101010` / subtitleBack `#E6141414`）、`bgRecipe`（type=gradient、stops 两段、texture none、vignette 0.35、textureRaw `tilt-shift-blur`）、`subtitle`（SimHei / 0.03519 / 0.14537 / 0.06019 / outline 0.0037 / bold / align 2）、`title.fontSizeFactor 0.086`、`motion.subtitleFadeIn 0.12`、`motion.chapterTransition cut`、`overlay.accentRule true`（`dub-styles.json#tilt-shift`）。**注意**：这是 `derived:true` 的派生条目，字幕字号/位置取自类别默认（light-strip：40px / 下边距 157px / 左边距 65px），非 demo 逐行手抽；字体因 consola.ttf 不含中文字形，已由等宽回退为 SimHei（`dub-styles.json#tilt-shift.notes`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- ~~**9:16 不适配**：无 `aspects` 声明，只按 1920×1080 绝对像素构图，硬渲 9:16 会丢失右侧约 43.75% 并留下方黑区（见第 2 节）。~~ **★ 2026-10-04 已修**：改为「页面外壳等比装入」，`demo/film.js` 声明 5 个比例；9:16 下整幅画面 + 左上延时时钟 + 底部字幕全部在画面内（vs 理想等比装入 SSIM 0.99），留边为天空蓝 `#8fb4d8`。**残留代价**：竖屏有效画面只占 1080×607、虚化带仍是横向的（见第 2 节）。
- **字体通路与 demo 不一致**：demo 用 Overpass 600 / Overpass Mono（OFL），本机 dub 通路回退 **SimHei**；`dub-styles.json#tilt-shift.notes` 明确记录「consola.ttf 只有 448 KB、不含中文字形，中文字幕会 tofu」，因此不能沿用等宽。字宽/字重与设计意图不完全一致。
- **字幕色是通路值不是 demo 值**：通路 `subtitle #FFFFFF` 来自 demo palette 原值（此前误填 `#F3E7C6` 是 ukiyoe 的题签色，已更正）；demo 实际字幕是「绿路牌面板 + 白字」，通路只承载白字，面板需渲染侧自己画。
- **细纹理 `textureRaw: tilt-shift-blur` 声明了但渲染未实现**：`lib/dub-styles.json#tilt-shift.bgRecipe.textureRaw` 是 `tilt-shift-blur`，而渲染侧（`lib/dub-core.mjs` 的 `bgFilters()`）**只把粗粒度 `bgRecipe.texture` 当主权威源**（本风格是 `none` ⇒ 落空（该风格粗粒度没有纹理层）），**不读** `textureRaw` ⇒ `tilt-shift-blur` 这一层质感在「文案 + 风格」通路上**从未画出来过**。为什么没实现：`bgFilters()` 里没有 `tilt-shift-blur` 对应的滤镜分支，按「只复用已有分支、不发明无数据依据的参数」的口径**只如实标注、不猜参数**（已集中登记在 `lib/dub-styles.json` 的 `_notes` 未实现清单里）。

### 素材缺口
- 无外部实拍/图库依赖（全部代码生成），因此不存在「缺图缺片」；真正的缺口是 **Overpass / Overpass Mono 字体文件**（需装进 `demo/fonts/`）与**新主题的程序化城镇资产**（不能沿用《Toy Town Rush Hour》的布局/招牌/鸭子）。

### 能力限制
- 骨架三条不能拆：**虚化带 + 延时跳帧 + 高机位**（`STYLE.md:95-101`、`DEMO.md:12`），因此撑不起平视叙事、长镜头自由节拍、需要精细人脸表演的内容。
- 单镜时长受 120 BPM 网格约束，速度变化必须落在音乐网格上，不适合完全自由的速度曲线。

### 踩过的坑（本机实测，`DEMO.md:74-84`）
- 第一版是「摩天楼森林」，街道完全看不见 → 改低/中层层高 + 45° 以上俯角。
- 黎明车藏在街道峡谷里看不见 → 路由到**靠近相机那一侧的车道**。
- 霓虹招牌被遮 → 移到面向宽阔大道的立面。
- **实例上限（1400 vs 存活 2800 辆车）静默丢掉了英雄车** → 按距相机距离剔除（约 4× 相机高）并抬高上限。
- 车停在鸭子路口前 2 m（IDM 的 jam gap）→ 把停止线移近、把 jam gap 减掉。
- 堵车把故事车道饿空了 → 豁免主干道，让队列排在英雄车后面。
- 俯拍 → 斜视俯冲第一次转了 180° → 旋转俯拍使其屏幕上方对齐目标镜方向。
- 峰值镜一开始用高机位长焦，鸭子只有 1/15 画面高 → 车灯移到车头前上缘使其俯视可读，英雄车留到升起相机抬离它。
- 云把结尾洗白、路灯池读成气泡、近景区街道家具太乱 → 云用不受光白 + 低不透明 + 相机下方无物；灯池更密更大更淡；清掉近景街道家具。
- 一个固定太阳让半部片子背光发灰；第一版黎明读成午夜 → **逐镜头骗太阳方位角**，黎明加粉色东侧填充 + 亮窗数降到约 1/3。

### 下次迭代优先补什么
- 把 Overpass / Overpass Mono 装进 `demo/fonts/`，消除字体回退。
- ~~给 `style.json` 补 `aspects` 或提供 9:16 重排方案（横向虚化带 → 纵向）。~~ **★ 2026-10-04：`aspects` 声明已完成**（落在 `demo/film.js`，5 个比例）；**仍待办**：真正的 9:16 **重排**方案（把横向虚化带改成纵向、把俯拍改成更垂直）——页面外壳只做等比装入，不是重排。
- 把 `dub-styles.json#tilt-shift` 的派生字幕值替换为 demo 代码抽取值（含绿路牌面板）。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/tilt-shift/tilt-shift.mp4`（38.00s / 39.3MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/tilt-shift/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **90/100**（2026-10-05 校正：原 91，新增「textureRaw 细纹理未实现」缺陷，palette −1）（2026-10-05 校正：原 90，9:16 画幅缺陷已修并回补 composition +1） |
| 详细资料 | 有（STYLE.md / DEMO.md / style.json / build.sh / style-dna .md+.json / dub-styles.json#tilt-shift / demo 源码 story.js+post.js+ducks.js+mix.py+subs.mjs / cues.json / lines.json / 出片日志） |

**逐帧拆解要点**：f01 黎明暗蓝紫的俯视街景、只有光轨与稀疏灯亮（约 9% 亮窗），左上 `06:00` 延时时钟（dawn，RMS −39.3 dB）；f05 蓝调立面上一块粉橙霓虹招牌 `TOY TOWN / RUSH HOUR`、下方绿路牌 `A TILT-SHIFT MINIATURE`（title，字母逐颗亮）；f10 中高斜视的车站，青绿色通勤列车横贯、站台灰色、字幕绿路牌「The seven-forty brings the bass.」（train，6×）；f13 垂直俯拍路口、绿地树冠饱和绿 `#6fa24a`、车流排满，字幕「By eight, the whole town is playing.」（jam，×40，RMS −14.4）；f16 近景过马路——白黑斑马线、母鸭与三只小鸭黄橙、前景大片模糊红白（掉到 ×1 的亲密镜，w 收到 0.035）；f19 小鸭跳上路沿（含一次失败）；f21 又回到垂直俯拍、字幕「Then... take it from the top.」（rise）；f24 绿路牌片尾卡 `Toy Town Rush Hour / TILT-SHIFT MINIATURE / LemoLab × Claude Opus 5.5`（end）。**配色有推移**：dawn 低饱和暗蓝紫 → title 冷蓝 + 霓虹粉橙 → 白天高饱和（绿树/白墙/彩车）→ 近景高饱和白黑红。**转场全是硬切**，无叠化；清晰带随镜头在画面里上下滑动（f01 在中带、f16 收窄到斑马线）。**无瑕疵帧**（无糊、闪、错位、黑边）。

**自检发现的缺陷**：字体通路回退 SimHei（demo 是 Overpass 系列）；~~无 9:16 适配~~（**★ 2026-10-04 已修**：页面外壳等比装入 + `demo/film.js` 声明 5 个比例）；通路字幕只承载白字、不画 demo 的绿路牌面板。

**本次为补齐短板做了什么**：未改动 `D:/lemo-opuscar` 下源码、未改 `lemo-make.mjs`、未起渲染或 TTS（GPU 独占）。仅新增本目录两份交付物；短板如实记录在第 11 节，留给后续迭代。**★ 2026-10-04 补记**：本轮按「页面外壳等比装入」范式改动 `styles/tilt-shift/demo/index.html` 并新增 `demo/film.js`（声明 5 个比例）——**这是本风格唯一的两处源码改动**，three.js 影片本体与后处理链一字未改；16:9 实测与改造前**不可区分**（PSNR ≈ 同帧噪声地板，同会话往返 md5 逐字节相同）。
