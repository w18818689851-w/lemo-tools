---
name: lemo-style-ascii-crt
description: 【lemo 风格 Skill · ASCII / CRT 终端】一切画面都是单色磷光屏上「排在字符网格里的真字符」，靠网格字号当镜头、靠打字节奏当剪辑；适合极客/开发者/科技/科幻/日志叙事类题材。选定本风格做视频时，优先读本文件。
slug: ascii-crt
name_zh: ASCII / CRT 终端
category: 图形与排版
film: TRANQUILITY.LOG
---

# ASCII / CRT 终端（`ascii-crt`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/ascii-crt/STYLE.md` · `styles/ascii-crt/DEMO.md` · `styles/ascii-crt/demo/build.sh` ·
> `lib/style-dna/ascii-crt.json` · `lib/style-dna/ascii-crt.md` · `lib/dub-styles.json#ascii-crt` ·
> `styles/ascii-crt/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一块**单色终端屏幕**——P3 琥珀（或 P1 绿 / P4 白）磷光在暗玻璃上发光，边缘弯曲、带扫描线。画面里的一切（标题、风景、人脸、房间、字幕）都是**真实字符排在字符网格上**、按墨量密度挑出来的。全片**只有一个镜头，就是屏幕本身**；它只靠**改变网格字号**来运动（`STYLE.md:6-12`）。

**不是什么**（最容易做错的邻居风格）：**不是**「图片 + ASCII 滤镜」的假货（字符必须作为字符画在网格上）、**不是**黑客电影绿雨、**不是**像素游戏（无精灵、无自由像素）、**不是**科幻 HUD（无矢量线、无悬浮面板）（`STYLE.md:12`）。

**什么时候用它**：文本本身就是角色的行动方式——一台机器、一个远程操作者、跨距离或跨时间的消息。适合开发者工具、科幻、科技品牌、日志/档案/倒计时叙事（`style.json:11-15`）。

**一句话内核**：把「画面由词构成、字号即镜头、打字节奏即剪辑节奏」这三件事用到极致，其余一切交给 CRT 物理。

**边界**：撑不起写实人物特写、自然风光与色彩丰富的题材（只有一个磷光 + 最多一个柔和第二色）；也不适合快切多镜——**全片只有一个镜头**，靠网格缩放与清屏制造「切」。

---

## 2. 画面构图

- **镜头数与画幅**：demo 共 **1435 帧 / 24fps**（≈59.8s），16:9 **1920×1080** 绝对像素构图（`log:36,290`）。★ **2026-10-04 已适配 9:16**：影片模块 `film.js` 声明字面量 `FILM_META.aspects = ['16:9','9:16']`，场景内容经 `frame.js` 的「设计帧 → 当前帧等比装入」重排（原先无声明、按 1920×1080 绝对像素构图）。
- **主体位置与占比**：默认**满屏网格**；文字居中或按列对齐。demo 各镜网格列数不同——标题 20 列（格宽 84px）、终端 80 列（21px）、画面 240 列（8px）、房间 213 列（9px）、分形推进最大格 450px（内含 40 列子网格）（`DEMO.md:75`）。
- **负空间 / 留白**：**负空间才让 ASCII 画读得出来**（`STYLE.md:18`）。亮度 <0.05 的格子保持空白；暗面只用稀疏 `.`。
- **图层叠放顺序**（从底到顶）：不透明黑场景画布（`lighter` 叠加，R=琥珀强度、G=地球蓝强度）→ 字符网格 → CRT post（磷光映射 → bloom → 扫描线 → 桶形畸变 → 圆角遮罩 → 玻璃反光 → 闪烁/噪声）→ 网格之外的 LOG 字幕条。
- **安全区**：文字必须待在**曲率之内**的安全区；**LOG 条区域要留空**不被画面压（`STYLE.md:65`）。
- **本风格**不能**出现的构图**：悬浮面板/矢量线 HUD；两个屏幕之间的交叉溶解；彩色装饰；让字符离开网格（除声明的变换时刻）。

**在 9:16（产品默认 1080×1920）下的表现**：★ **2026-10-04 已适配**——场景内容一律画在设计帧（1920×1080）坐标里，由 `begin()` 施加「设计帧 → 当前帧等比装入」（`frame.js` 的 `setTransform(S,0,0,S,OX,OY)`，中心对齐、紧轴缩放 `S = min(VW/W, VH/H)`），并**裁在设计帧内**（设计帧外的推镜溢出不会渗进上下黑边）；全屏叠加 CRT post 读画布尺寸（`crt.js:74`），自动铺满当前帧。1080×1920 实测（S = 0.5625）：整块终端内容按 0.5625× 缩小、**居中、不裁切**——80 列启动日志、`NO OPTICAL DEVICES`、片尾地球（非洲+欧洲剪影）、底部 LOG 字幕条全部完整落在画面内；曲率遮罩 / 扫描线 / 玻璃反光随画布铺满整帧，读起来仍是一块屏幕。代价是设计帧是 16:9、竖屏下上下各留大片黑（由 CRT 玻璃 / 机身边框填充），**版面更空、密度更低**——与 `whiteboard` 把板面等比装入当前帧的做法同类。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 磷光暗 | `#FF6605` | 琥珀亮度低端（暗处偏橙） | `DEMO.md:79` · `crt.js:24-28` |
| 磷光中 | `#FFB000` | 琥珀主色（正常亮度） | `DEMO.md:79` |
| 磷光过曝 | `#FFEBB8` | 过曝处偏白 | `DEMO.md:79` |
| 第二色（地球蓝） | `#B8E0FF` | 全片唯一非琥珀色，只在重拍出现一次 | `DEMO.md:79` |
| 未点亮玻璃 | `#090604` | 暖近黑玻璃 | `DEMO.md:79` |
| 产品通路（dub） | bg `#000000` / fg `#FFB000` / accent `#B8E0FF` | ★ 2026-10-03 已修：原取 fg `#00ff00` / accent `#ff0000`（离屏通道标记色，见第 11 节），现已改为琥珀 + 地球蓝真值 | `dub-styles.json#ascii-crt` |

- **明度 / 对比规则**：**一个磷光承载一切**（amber / green / white 三选一），在自己的亮度梯上走；亮度只有 dim/normal/bold（0.42 / 0.7 / 1.0）与反白视频两种工具（`STYLE.md:30-33`）。
- **禁止出现的颜色**：装饰用的第二色相；RGB 荫罩（**单色管没有荫罩**，`STYLE.md:25`）；彩色 HUD 描边。
- **同一画面最多几个色相**：**1 个**（磷光本身）；全片**最多 1 个**柔和第二色，只给一件「情感物件」，在重拍上开启、不轻易收回（`STYLE.md:31`）。

---

## 4. 转场规则

- **镜头之间怎么切**：转场**发生在屏幕内**——**清屏 / 硬重绘**（=一次切、一个新状态）、**滚动**（缓冲移动）、**开机 / 关机**、**消磁**（`STYLE.md:65`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**没有**交叉溶解；开机是「点→线→整幅」、关机是「整幅→线→点」；消磁是一次抖动/冲击。demo 唯一的「镜头外」是结尾拉出玻璃、看到屏幕是一台机器（`DEMO.md:36`）。
- **硬切点怎么定**：挂在 **100 BPM** 网格上（1 拍 = 0.6s，1 小节 = 2.4s），**每个切都落在小节或拍上**（`DEMO.md:58`、`style-dna/ascii-crt.md:75`）。
- **转场时长与缓动**：打字有速度表演——启动行 12ms/字、命令 38ms/字、标题与回信 120–150ms/字（=100 BPM 十六分音符）；粒子落地闪 1.9× 亮度、0.12s 衰减；余辉 τ≈0.12s（`DEMO.md:52,80`）。
- **绝对不要的转场**：两块屏幕之间的交叉溶解；让字符离格飞入；把「图片+滤镜」当成风格（`STYLE.md:12,65`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | VT323（OFL）等宽位图风；格 0.4em × 0.8em（1:2）（`STYLE.md:16`）。产品通路用 `SimHei`（因 Consolas 无 CJK 字形，`dub-styles.json#ascii-crt`） |
| 字号（相对画面宽 / 高） | LOG 条约 **45 px @1920 宽 ≈ 2.34% 画面宽**；产品通路 `fontSizeFactor` 0.042（对 1080 高）（`STYLE.md:37`、`dub-styles.json#ascii-crt`） |
| 颜色 / 描边 / 阴影 | 磷光同色（琥珀）；**无描边**（辉光由 glow 实现，不是 outline）；**无底框**（`subtitleBack` = `#00000000`） |
| 位置 / 安全边距 | 底部**保留的 LOG 条**：暗色虚线分隔 → 反白 `LOG` 标签 → `> ` 提示符 → 大写正文；`marginVFactor` 0.10（贴底）（`STYLE.md:37`、`dub-styles.json#ascii-crt`） |
| 单行字数上限 / 最多行数 | 一行 ≤ 80 列（对齐 80 列终端）；demo 全片只有 5 行旁白（`style-dna/ascii-crt.md:39`） |
| 出现与消失方式 | **按语音逐词打出**（用 whisper 逐词时间戳），**不是淡入**（`subtitleFadeIn: 0`）；说完后停留 `max(1.4s, 说完+0.6s)`（`STYLE.md:37`、`DEMO.md:81`） |

- **字幕与旁白的关系**：字幕就是**终端输出**。无声时 LOG 条可显示系统状态：`TRANSMIT [#####.....] 40%`、`SENT … AWAITING REPLY`（`DEMO.md:81`）。
- **本风格特有的字幕禁忌**：**屏幕里「故事展示的文本」是画面不是字幕**，在 `.srt` 里记为 `[SCREEN] …`（`STYLE.md:38`、`main.js:566-571`）；LOG 条必须活在**缩放网格之外**（像状态行），不能跟着镜头缩放；不用黑底框、不用淡入、不用彩色。

---

## 6. BGM / 音效特征

- **配乐**：原创**模拟合成器**配乐，用代码（numpy/numba）渲染——PolyBLEP 锯齿/方波振荡器、带移动截止的共振 4 极点梯形低通、滤波包络、方波音序器、慢磁带 wow（±3 音分）、pad 长混响、重击门限混响；可选 sub-bass 无人机、采样保持噪声、失谐齐奏主音。**绝不 chiptune。** demo：D 小调、100 BPM（`STYLE.md:69`、`DEMO.md:58`）。
- **拟音（foley）清单**（全部合成）：继电器咔哒、消磁嗡（60Hz + 谐波，0.35s 衰减带闷咚）、屈曲弹簧键（塑料咔 + 3.4kHz 弹簧叮 + 键帽低嗒；空格更闷、回车更重）、对面字符的电传滴答、调制解调器握手（2100Hz 应答音 + 两次相位翻转 + 双音 + 1200/2400 FSK + 限带噪声）、方波错误音与 1kHz BEL、粒子落地的 2–6kHz 细小滴答簇、房间底噪（风扇 + 120Hz 低鸣 + 极轻 15.7kHz 行输出啸叫，约 −50 dBFS）（`DEMO.md:64-70`）。
- **旁白处理**：机器说话要处理人声——**16% 环形调制 @52Hz + 6ms 梳状(0.22) + 140–7000Hz 带通 + 软饱和**，并用 whisper 复检每行仍可读（demo 5/5）；Kokoro `am_echo` speed 0.8（`DEMO.md:71`）。
- **响度目标**：`-14 LUFS`（首版实测 **-14.1 LUFS** / LRA 9.1 LU，`log:300-302`）；**真峰值上限**：**-1.2 dBTP**（**项目级交付线**，判据见 `core/render/mux.sh`；本风格 `STYLE.md:73` 未额外声明更严上限）——首版用 `loudnorm` `input_tp`（4× 过采样）实测成片真峰值 -0.98 dBTP、超交付线 0.22 dB（未达标）；★ **2026-10-05 重渲后真峰值 -1.28 dBTP、I = -14.26 LUFS，已在 -1.2 dBTP 交付线内（达标）**，原 -0.98 dBTP 记录保留为历史。（`log:305` 的 `peak -0.982537 dB` 是 `astats` **采样峰值**，只作参考，见下。）
- **静音策略**：**静默是主要乐器**。握手、消息、光标闪烁只在房间底噪上播放；画面成形前有 1.5s 静默；需要「数字归零」时（含混响尾巴）必须真的归零——demo 在硬切上把整条配乐归零 **5 秒**（`DEMO.md:60,63`）。
- **mux 不加颗粒**（`grain 0`）——噪声活在画面里（`build.sh:14`）。

---

## 7. 素材偏好

- **需要什么素材**：几乎全部程序化。需要：台词 `lines.json`（`{id,t,text,voice,speed,asr?}`，demo 5 条短句）、逐词时间戳 `voices/words.json`、语音时长 `voices/dur.json`、时间线 `main.js` 的 `T`、网格与密度表（列数/格尺寸/字符集）、第二色与其开启时刻（`style-dna/ascii-crt.md:175-180`）。
- **不需要什么素材**：不需要实拍/图库；不需要彩色素材；**不需要任何真实机构的界面文字、字体或 logo**（`STYLE.md:4`）。
- **取景 / 质感 / 比例偏好**：可辨识主体必须靠**剪影**（真实海岸线多边形、几块面构成的脸），不要噪声纹理；远=更暗更稀、近=更亮更密，面之间一条细亮边；**要选一个剪影清楚的视角**（demo 选非洲+欧洲，`DEMO.md:77`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有合适的地球/风景素材时，退到**纯文字镜**（终端日志、进度条、错误码）——LOG 条与打字节奏本身就能撑住片子；第二色可以**完全不出现**（`STYLE.md:105`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 由 `main.js` 的时间线 `T` 驱动；demo 约 11 个段落（开机/标题/拉远/静态/握手/屏息/挫折/决定/静默/高潮/分形/等待/回声/片尾） |
| 全片时长 | demo **59.8s**（`style.json:17`，`frame_sec` 50.23）；简报区间 30–60s |
| 镜头数 | 1435 帧 @24fps（`log:36,290`）；**只有 1 个物理镜头**（屏幕），「切」由清屏/重绘/缩放完成 |
| 信息投放节拍 | 100 BPM（1 拍 0.6s，1 小节 2.4s）；分形推进：先推到 8px→300px 格**停 1s**，再推到 450px（子文本约 28px 可读）（`DEMO.md:50`） |

- **加速 / 减速点**：字母掉落段（33.6s 起）是加速点，一个锯齿琶音随字母落下生长、在变色重拍上开成 Bbmaj7；**全片唯一的和弦**（D 大调）落在回信上（`DEMO.md:61`）。
- **留白与静音的位置**：画面成形前 1.5s 静默；握手后整条配乐归零 5s；光标闪 3 次是全片最重要的表演（`DEMO.md:24,60`）。
- **运动规则**：**字符永不离开网格**（除声明的变换时刻）；只有三样东西连续运动——**网格缩放（=镜头）、CRT 物理、变换中的粒子**（`STYLE.md:43-44`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/ascii-crt/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/ascii-crt/demo --fps 24 --workers 6 --size 1920x1080 --out …`（`log:36`） |
| 帧率 | 24 fps |
| 分辨率 / 比例 | 原生 1920×1080 / 16:9；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js`），场景内容经 `frame.setFrame()` 的「设计帧 → 当前帧等比装入」重排（`S = min(VW/W, VH/H)`、居中偏移 `OX/OY`，并裁在设计帧内），CRT post 读画布尺寸铺满当前帧；16:9 时 `S=1`、偏移 0 逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh <video> <mix.wav> <out.mp4> 24 0`（**grain 0**，噪声在画面里）（`build.sh:14`） |
| 编码器 | `h264_nvenc`（本地 GPU，`log:7` 编码 nvenc） |
| 音频入口 | `core/tts/tts.py` → `voice_fx.py` → `core/tts/asr_check.py` → `music/score.py` → `mix.py`（`build.sh:6-11`） |
| 字幕入口 | `node tools/subs.mjs <demo>` + `core/render/srt.py <out/subs.json> <out.srt>`（`build.sh:12`） |
| 事件导出 | `node core/render/events.mjs styles/ascii-crt/demo`（本片 **362 事件 / 9 cues**，`log:26-27`） |
| 本风格专属参数 | 响度 -14 LUFS、grain 0；字体 VT323；图集 160px + 2.2px 描边；负片每格采样 3×6；密度 dim/normal/bold = 0.42/0.7/1.0；抖动 0.7；亮度 <0.05 留白（`DEMO.md:76`） |
| 一键复现 | `sh styles/ascii-crt/demo/build.sh` |
| 关键机制 | 画面/拟音/字幕/配乐全读 `main.js` 同一份时间线 `T` 与 `window.EV`；**粒子计划必须在 `window.EV` 导出前建好**（`DEMO.md:110`、`main.js:598`） |

---

## 10. 编排规则

- **内容文件字段契约**（`content_fields`）：`lines.json` 每条 `{id, t, text, voice, speed, asr?}`；demo 用 Kokoro `am_echo` speed 0.8，**4–6 条短句**（`style-dna/ascii-crt.md:175`）。配 `voices/words.json`（逐词时间戳，LOG 条逐词打字用）与 `voices/dur.json`（停留计算）。
- **事件词汇表**：`vo{id}`（人声，从 `voices/<id>.wav` 读）、`key/space/enter/keyLight{ch}`（打字→弹簧屈曲键）、`remote{ch}`（对面字符→电传滴答）、`relay`/`degauss`、`bootline`/`ratchet{k}`/`clunk`、`modem{d}`/`modemUp{d}`、`err`/`err2`/`bel`、`zoomIn{d,soft?}`/`zoomOut{d}`、`poweroff`、`land{n}`（粒子落地→n 个一簇的高频滴答）（`style-dna/ascii-crt.md:194-206`）。
- **时间线契约**：`main.js` 是全片时间线，导出 `window.DUR`、`window.EV`、`window.SUBS`、`window.render(t)`、`window.READY`；`tools/subs.mjs` 导出 `window.SUBS`（`style-dna/ascii-crt.md:190`）。`SUBS` 里含 `[SCREEN]` 条目（`main.js:566-571`）。
- **新增主体怎么接入**：写一个「底片函数」——先把灰度画进与网格**严格对齐**的离屏画布（R=琥珀亮度、G=第二色亮度、B=标志位如夜面），再交给 `term.js` 的 `cellsFromImage` 按格取平均、`makeRamp`+`pick` 选字。参考实现 `art.js` 的 `paintEarthrise`/`makeCraters`/`horizonY`（`style-dna/ascii-crt.md:186`）。
- **换主题时要改哪些文件**：① `demo/main.js`（时间线 `T`、`EV`、`SUBS`、各段落）；② `demo/lines.json` + `voices/`（文案与逐词时间戳）；③ `demo/art.js`（新的底片场景，如换成别的剪影主体）；④ `demo/music/score.py`（新谱，但仍需模拟合成器 + 100 BPM 网格）；⑤ `demo/mix.py` 的拟音事件表；⑥ `demo/term.js` 的网格列数与字符集；⑦ 第二色与其开启时刻。**`crt.js`（CRT post）与 `term.js` 的图集/密度表机制不用改。**
- **与 `dub.mjs` 通路的关系**：本风格在「文案+风格」通路里能生效的参数是 `palette`（bg `#000000` / fg `#FFB000` / accent `#B8E0FF` —— ★ 2026-10-03 已修，原为离屏通道标记色 `#00ff00`/`#ff0000`，见第 11 节）、`bgRecipe`（solid + `scanlines` 纹理 + vignette 0.35）、`subtitle`（`fontFamily` SimHei、`fontSizeFactor` 0.042、`marginVFactor` 0.10、`outlineFactor` 0）、`title.fontSizeFactor` 0.082、`overlay.accentRule=true`、`overlay.progressBar=true`（唯一开进度条的风格）、`motion.subtitleFadeIn=0`、`motion.chapterTransition=cut`（`dub-styles.json#ascii-crt`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **`dub-styles.json#ascii-crt` 的 palette 是错的**：它取 `fg #00ff00` / `accent #ff0000`，来源写的是 `term.js:68` 的 `chan ? '#00ff00' : '#ff0000'`——但这两个色**只是离屏负片的通道标记**（R 通道=琥珀强度、G 通道=地球蓝强度，`term.js:2` 注释明写「crt.js 负责上色」）。真实磷光输出是**琥珀** `#FF6605`/`#FFB000`/`#FFEBB8` + 地球蓝 `#B8E0FF`（`DEMO.md:79`、`crt.js:24-28`）。**走 dub 通路会渲成绿色**，与成片不符。这是本风格最大的失真点。★ **2026-10-03 已修**：当前 `dub-styles.json#ascii-crt` 的 palette 已改为 bg `#000000` / fg `#FFB000` / accent `#B8E0FF`，与真实磷光输出一致，走 dub 通路不再渲成绿色。（原观察保留如上。）
- **9:16 曾不适配（★ 2026-10-04 已修）**：原记「无 `aspects` 声明，产品默认 9:16 下丢右侧 ~43.75%，且曲率/扫描线是按 16:9 算的，裁切后不再像一块屏幕」。**2026-10-04** 已改造 `styles/ascii-crt/demo/`：新建 `frame.js`（`NATIVE` / `setFrame(VW,VH)` / `S,OX,OY`）、把影片逻辑从 `main.js` 拆到 `film.js` 并声明 `FILM_META.aspects = ['16:9','9:16']`、`main.js` 改为页面契约读视口（`cv.width = innerWidth`）；场景内容经「设计帧 → 当前帧等比装入」（`begin()` 施加 `setTransform(S,0,0,S,OX,OY)` + 裁在设计帧内），CRT post 读画布尺寸（`crt.js:74`）自动铺满当前帧。**16:9 逐字节未变**（`S=1`、偏移 0；三个采样帧 md5 相同）；9:16 实测不裁切（见第 2 节）。
- **真峰值未达标**：混流告警「missed the target (-14 LUFS, true peak <= -1.2 dB): measured -14.1 LUFS, peak -0.982537 dB」（`log:305-308`）——注意其中 `peak -0.982537 dB` 是 `astats` 的**采样峰值**（6 位小数），**不是真峰值**；用 `loudnorm` `input_tp`（4× 过采样）复测成片**真峰值 -0.98 dBTP**，超 -1.2 dBTP 交付线 0.22 dB（真峰值为负、**未削波**）。混音峰值 0.95（`log:288`）本身偏热，属 `mix.wav` 问题而非 mux 问题。★ **2026-10-03 已修（2026-10-05 重渲后实测）**：成片已用当前管线重渲，真峰值 -1.28 dBTP、I = -14.26 LUFS，已在 -1.2 dBTP 交付线内（达标）。（首版记录保留如上。）
- **本次出片走了 `--skip-sync`**（`log:1`）；`events.mjs`/`subs.mjs` 在 Windows 侧成功、产物回传 WSL（`log:25-29`），但同步两份库这一步被跳过。
- **产品通路的 `fontFamily` 是 SimHei 而非等宽**：等宽是风格前提（格 0.4em×0.8em），非等宽中文字幕会破坏字符网格美学（`dub-styles.json#ascii-crt` 自述「Consolas 无 CJK 字形，未实测」）。

### 素材缺口
- 本风格基本无外部素材缺口，但**「能读出剪影的底片素材」是稀缺项**：噪声纹理的地球会读成「纹理球」，必须用大陆多边形剪影（`DEMO.md:106`）。换主题时最容易卡在这里。

### 能力限制
- **反白（inverse video）陷阱**：`destination-out` 只改 alpha，上传时被忽略 → 会得到不透明黑画布与「被挖黑」的字，必须用**黑色图集**（`STYLE.md:89`）。
- **负片与网格未对齐**会在几百列上漂移，表现为星星重影、陨石坑边缘错位 → 必须按「格宽/采样数」精确映射（`STYLE.md:90`、`DEMO.md:105`）。
- **格心算错**：格子高是 2·cw，格心是 `(j+.5)·2cw` 而不是 `(j+1)·cw`（`STYLE.md:91`）。
- 每个暗像素都变字符会得到 `-+-+` 墙 → 必须阈值 + gamma≈1.25 + 局部对比（`STYLE.md:92`）。
- **粒子从字母中心爆发会堆成发光条** → 从字形内部随机点出发、起始小、淡入（`STYLE.md:94`、`DEMO.md:107`）。
- **描边图集会让 `M`、`B` 的字腔闭合** → 分形遮罩要另采一份**细的、只填充**的字形位图（`STYLE.md:95`、`DEMO.md:109`）。
- 开机参数为 0 时仍会画中心点 → 开机前把曝光置 0 并用它乘点项（`STYLE.md:97`）。

### 踩过的坑（本机实测）
- **懒构建的数据到不了导出器**：不在 `window.EV` 导出前先 `buildFall()`，字母掉落的拟音会全静音（`DEMO.md:110`、`main.js:598`）。
- 地球字母穿过还看得见的句子会很乱 → 先让它们全部落到地平线之下，再从下往上「升起」（`DEMO.md:108`）。

### 下次迭代优先补什么
- **修 `dub-styles.json#ascii-crt` 的 palette**：把 fg 改成琥珀 `#FFB000`、第二色改成 `#B8E0FF`、accent 另定，并在 `dub-visual.json` 里补 `ascii-crt` 的真值（现有条目声称 `visualRef` 指向 `lib/dub-visual.json#ascii-crt`，且该条 notes 自称「style-dna 里也无 ascii-crt.json」——**这个说法是错的**：`lib/style-dna/ascii-crt.json` 实际存在，只是它和 `STYLE.md` 一样**通篇不给 hex**，只给「P3 琥珀 / P1 绿 / P4 白」的定性描述，所以派生色必须由人工按 demo 实装值补齐）。★ **2026-10-03 已完成 palette 部分**：当前 `dub-styles.json#ascii-crt` 为 bg `#000000` / fg `#FFB000` / accent `#B8E0FF`；`dub-visual.json` 的真值补齐仍待办。
- ~~给 `style.json` 补 `aspects`，或做 9:16 专用网格列数~~ ★ **2026-10-04 已完成**：影片声明 `FILM_META.aspects` 并按实际帧重排（见第 2 / 11 节）。
- 压 `mix.wav` 峰值，使成片真峰值（`loudnorm` `input_tp`）降到 ≤ -1.2 dBTP 交付线。★ **2026-10-05 重渲后已达标**：真峰值 -1.28 dBTP（原 -0.98 dBTP、超线 0.22 dB，保留为历史）。
- 接入真正含 CJK 的等宽字体（思源黑体 Mono / NSimSun），恢复字符网格美学。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/ascii-crt/ascii-crt.mp4`（59.79s / 28.3MB / **29,710,467 B**，2026-10-03 重渲；原记 29,712,494 B） |
| 抽帧 | `D:/lemo-tools/_distill/frames/ascii-crt/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **98/100**（2026-10-05 校正：原 96，9:16 画幅缺陷已修并回补 composition +2）（2026-10-03 校正：原 92，两条已修缺陷回补 palette +1、audio +3） |
| 详细资料 | 有（`STYLE.md` · `DEMO.md` · `style.json` · `demo/build.sh` · `style-dna/ascii-crt.md` · `dub-styles.json#ascii-crt` · `_distill/logs/ascii-crt.log` · `term.js`/`crt.js` 源码） |

**逐帧拆解要点**：`_contact.jpg` 一眼可见全片是**琥珀单色 + 黑玻璃 + 扫描线**的稳定体系，节奏前慢后快、末段出现唯一一次冷色（地球蓝）。f01 开机瞬间——全黑屏上只有一个琥珀色**方块光标**（点→线→整幅的开机第一步，对应 `STYLE.md:44`「只有三样东西连续运动」）。f05 是 80 列启动日志：`TRANQUILITY.LOG / UNIT 7 / LUNAR RELAY 7 / MAINTENANCE` 表头 + 左右两栏（左 `RELAY-7 MONITOR ROM 4.11` 各项状态，右 `LINK / CARRIER NONE / SIGNAL [........]`），底部 LOG 条反白标签。f09 推近后的大字 `IS ANYONE THERE?` 居中、末尾带块状光标，顶部一条 `INCOMING ORIGIN: EARTH CARRIER 300 BAUD`，底部 LOG 条——这是「推进=亲密」的示范。f13 `I AM STI▮` 正在**逐字打出**回信（打字节奏=表演）。f17 是全片最关键的变换时刻：网格缩小、字形坠落，画面被**密集的 M/R/H/A/S/E 字母**填满（这些字母全部来自 `I AM STILL HERE.` 的字母集）——正是「画面由词构成」。f21 高潮成果：字符拼出的**地球**（非洲+欧洲剪影清晰可读）在蓝白 `#B8E0FF`（唯一非琥珀色）+ 下方琥珀色月面与环形山 + 左上角一个琥珀小方块光标，LOG 条显示 `SENT 2091.06.14 03:14:07 AWAITING REPLY`。f24 片尾：**拉出玻璃**——画面缩进一台字符画的终端里，右侧一个大圆形舷窗里是真实地球（`ASCII / CRT TERMINAL` / `LemoLab × Claude Opus 5.5`），全片**唯一屏幕之外的镜头**，随后关机收成一点。**色走**：全程琥珀单色，仅在 37.2s 变色重拍引入一次地球蓝，之后不再收回；无彩色装饰、无 RGB 荫罩。**字幕**：底部 LOG 条全程固定、反白 `LOG` 标签 + `> ` 提示符、大写、逐词打出、单行不超 80 列。**转场**：全部是清屏/硬重绘/缩放/开机/关机，**无一次交叉溶解**。

**自检发现的缺陷**：`dub-styles.json#ascii-crt` palette 曾取离屏通道标记色（绿/红）而非琥珀磷光（第 11 节）——★ 2026-10-03 已修（现为 fg `#FFB000` / accent `#B8E0FF` / bg `#000000`）；~~无 9:16 支持~~ ★ 2026-10-04 已适配 9:16（`FILM_META.aspects` + 设计帧等比装入，见第 2 / 11 节）；成片真峰值首版 -0.98 dBTP 未达 -1.2 dBTP 交付线（`log:305` 的 -0.982537 dB 是 `astats` 采样峰值，非真峰值）——★ 2026-10-05 重渲后真峰值 -1.28 dBTP，已在 -1.2 dBTP 交付线内；本次 `--skip-sync`。

**本次为补齐短板做了什么**：本次**未改动** `styles/ascii-crt` 下任何源码；`dub-styles.json` 的 palette 错误**只做记录、未擅自修改**（红线：不碰别人的通路数据），留给迭代修复。★ **2026-10-03 更新**：palette 错误已由上游修正（现 fg `#FFB000` / accent `#B8E0FF` / bg `#000000`），成片亦已用当前管线重渲（2026-10-05 重渲后真峰值 -1.28 dBTP 达标）。
