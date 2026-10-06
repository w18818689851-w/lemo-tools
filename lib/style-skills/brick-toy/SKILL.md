---
name: lemo-style-brick-toy
description: 【lemo 风格 Skill · 积木玩具】在真实桌面上用微距镜头拍的积木定格动画——用互锁塑料砖搭出世界、角色一拍两格地动起来，适合讲「搭建/失败后重来/小世界大野心」的故事。选定本风格做视频时，优先读本文件。
slug: brick-toy
name_zh: 积木玩具
category: 材质与 3D
film: Rocket from Spare Parts
---

# 积木玩具（`brick-toy`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/brick-toy/STYLE.md` · `styles/brick-toy/DEMO.md` ·
> `lib/style-dna/brick-toy.json` · `lib/style-dna/brick-toy.md` · `lib/dub-styles.json#brick-toy` ·
> `styles/brick-toy/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部在**真实桌面上用微距镜头**拍出来的**积木定格动画**。世界由带圆凸点的互锁塑料砖搭成，角色一个姿势一个姿势地「拍两格」（12fps）动起来，真实的家用物件（茶壶、马克杯、一摞书）在浅景深的虚化背景里当风景（`STYLE.md:8`）。

**不是什么**（最容易做错的邻居风格）：不是低多边形等距小岛（没有平涂切面、没有悬浮立体模型）；不是黏土 / 毛毡定格（砖是刚性的，**永不拉伸、压扁或形变**）；不是干净的产品渲染（这个世界被玩过、被打翻过、被认真搭过）（`STYLE.md:14`）。

**什么时候用它**：讲「把一件事从零搭起来」的题材——产品逐块组装、一个街区一栋栋盖起来、失败散架后零件重组成新东西、宏大野心其实只是桌上的一件玩具（`STYLE.md:76-85`）。

**一句话内核**：一个小世界在真实的桌上认真地活了一回；失败不是终点，只是备用零件（`DEMO.md:9`）。

**边界**：撑不起抽象概念、情绪独白、纪实采访这类「没有可被搭出来的实体」的内容——本风格的每个信息点都必须落在一个可被搭出的物体或动作上（`style-dna/brick-toy.md:52`）。

---

## 2. 画面构图

- **镜头数与画幅**：样本片 22 个镜头 / 54.0s（`story.js:51-57`），原生 **16:9（1920×1080）**；`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`（声明在 `demo/film.js`，**页面外壳等比装入**，见下）。
- **主体位置与占比**：主角（宇航员/火箭）在画面中央偏下，占画面高约 1/3–1/2；道具（茶壶、书）在中景背景、虚化。低角度镜头让小人显得英雄（`STYLE.md:56`）。
- **负空间 / 留白**：大面积虚化背景留白（真实房间），主体周围有浅景深过渡；桌面占据画面下 1/3 作为「地面」。
- **图层叠放顺序**（从底到顶）：真实桌面木纹 → 绿色哑光底板 → 积木主体与道具 → 前景虚化物 → 2D 字幕层（`#ov` canvas）。
- **安全区**：字幕药丸居中、距底边 150px（`DEMO.md:46`）；主体避开画面四边，前景零件堆不许挡镜头边缘（`STYLE.md:66`）。
- **本风格**不能**出现的构图**：悬浮的等距小岛、平光无 AO 的「贴上去」的砖、边缘被前景杂物堵死、光圈过大糊掉中距离英雄（`STYLE.md:92`）。

**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。改造**没有**逐处改写绘制点（本风格是 three.js + 物理景深 + GTAO + 2× SSAA 的固定设计帧管线，`main.js` 的 `renderer.setSize(1920,1080)` 不跟视口走，逐处改必然静默错位），而是只改**一个页面外壳文件** `demo/index.html`：影片本体仍按**固定设计帧 1920×1080** 画（一字未改），当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧等比装入**（contain）并居中，留边露出页面底色 `#f4f4f1`（本风格 palette 的 bg，与影棚浅灰墙同色）。声明在 `demo/film.js`（`FILM_META.aspects`，控制台按源码文本探测）。

- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform）；同会话往返（1920×1080 → 1080×1920 → 1920×1080）实测 md5 逐字节相同（同会话同帧两次也逐字节相同）。跨进程因后处理（SSAA/AO/bloom）非确定、md5 不可用，改用 PSNR：改后 vs 改前 PSNR 54.31/53.28/54.09 dB，与「同参跨进程两次」的噪声地板 54.37/53.21/54.07 dB **持平**（差 ≤0.07 dB）⇒ 16:9 未变。
- **9:16 不裁切**：整幅 16:9 画面（含主体与字幕药丸）**全部在画面内**（实测：改后 9:16 vs 16:9 中心裁切 SSIM 0.77/0.67/0.74，vs 理想等比装入 SSIM 0.9947/0.9932/0.9947）。
- **已知代价**：① 竖屏下有效画面只占 1080×608，**分辨率按紧轴缩放**，是「小图居中 + 大片留白」——本风格留边取 palette 底色 `#f4f4f1`，与影棚浅灰墙同色，肉眼几乎无缝，观感像「照片裱在卡纸上」而非「黑框里的小图」；② **全屏层（前景虚化物等）留在设计框内**，上下留边无画面内容；③ 其它比例同理（3:4 / 4:3 / 1:1）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 底（桌面） | `#8a7a6a`（胡桃木） | 真实木纹桌面 | `DEMO.md:43` |
| 主 | 白 `#f2f2ee` | 宇航员/火箭主体砖 | `STYLE.md:33` |
| 强调 | 红 `#c91a09` | 火箭锥头、鳍、红砖 | `DEMO.md:42` |
| 强调 | 蓝 `#0055bf` | 蓝砖 | `STYLE.md:33` |
| 强调 | 黄 `#f2cd37` | 砖图标、片名副线 | `main.js:189,202` |
| 绿（底板） | `#237841` 哑光 | 绿色底板 | `STYLE.md:33` |
| 黑 | `#1b2a34` | 深色件、字幕字 | `STYLE.md:33` |
| 字幕 | 白 `#fff` on `rgba(18,20,26,.62)` | 药丸底 + 白字 | `DEMO.md:46` |

- **明度 / 对比规则**：白砖必须读成白——**调色略偏冷**（contrast +0.26、saturation ×1.1），避免房间反射把白砖染成奶油色（`STYLE.md:31`, `DEMO.md:43`）。
- **禁止出现的颜色**：钨丝室内的橙色白光（会把白砖变橙，必须用中性日光影棚 HDRI）（`STYLE.md:89`）。
- **同一画面最多几个色相**：一个搭建物只有 1 个主色 + 至多 1–2 个点缀色；饱和色只属于玩具，真实世界保持自然低饱和（`STYLE.md:29-30`）。

---

## 4. 转场规则

- **镜头之间怎么切**：**硬切**为主，切点落在配乐拍点 / 小节上（143.555 BPM，一小节 1.671s）；一次「砖吸附的咔哒」本身就可以是一个剪切点（`STYLE.md:66`, `story.js:8`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：**禁止通用溶解 / 叠化**。允许的转场都必须来自玩具本身——一只手把砖放到镜头前挡住它、沿桌面甩镜、从一个布景拉远进入下一个（`STYLE.md:66,110`）。
- **硬切点怎么定**：对齐 `beat()` / `bar()`；样本片关键切点 title 4.15 / cone1 14.03 / fall 17.37 / rebuild 29.9 / ignite 36.5 / reveal 48.0（`story.js:12-37`）。
- **转场时长与缓动**：硬切 0 帧；镜头运动本身用缓动（焦点/镜头 24fps，不是 12fps）。
- **绝对不要的转场**：通用 dissolve、把镜头也做成 12fps 步进（会读成抖动而非可爱）（`STYLE.md:43,112`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | Fredoka 600（core/fonts，SIL OFL 1.1） |
| 字号（相对画面宽 / 高） | 46px @1920 宽 ≈ 2.4% 画面宽（`main.js:182`） |
| 颜色 / 描边 / 阴影 | 白 `#fff`，无描边；底为深色圆角药丸 `rgba(18,20,26,.62)`（`DEMO.md:46`） |
| 位置 / 安全边距 | 药丸居中，距底边 150px（≈13.9% 画面高）（`main.js:195-196`） |
| 单行字数上限 / 最多行数 | ≤2 行；实测单句 6–45 字符（`style-dna/brick-toy.md:41`） |
| 出现与消失方式 | 出现即整块药丸，停留 ≥ max(1.8s, 语音 + 0.6s)（`STYLE.md:38`） |

- **字幕与旁白的关系**：字幕是「玩具元素」——药丸左侧有一个**小积木图标**（黄 `#f2cd37`）；对讲行换成**红砖图标 + 红色 "MISSION CONTROL" 标签**（`main.js:185-189`）。
- **本风格特有的字幕禁忌**：不用营销腔、感叹号、抽象概念；每句只承担一层意思、短到能落在一次搭砖动作上（`style-dna/brick-toy.md:50-54`）。片名弹出走 12fps 步进（`main.js:198`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「a dark rounded pill low in the frame」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#6112141A`（AARRGGBB，落盘 ASS 为 `&H611A1412`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。**底衬色与字色取自 demo 的真实实现**：该风格 `STYLE.md §4` 明确规定了底衬与字色的深浅取向（见上方原句），而此前配置正好相反；现已把 `palette.subtitle` 与 `subtitle.plateColor` 一起换成 demo 那一对。字色 `#FFFFFF` 与该底衬 `#6112141A` 的 WCAG 对比度 **5.49**。

---

## 6. BGM / 音效特征

> ★ **本次成片音频已修复**（原为「静音占位」）——音频链已跑通并重新混流出片，见第 11 节。以下为**实测**的成片音频设计。

- **配乐**：两首 Kevin MacLeod（incompetech.com）曲目，**CC BY 4.0 可合法使用**（`CREDITS:3-4`）——「Monkeys Spinning Monkeys」（顽皮、**143.5547 BPM / 298 拍**）与「Heroic Age」。由 `music/edit.py` **按画面剪辑而非循环垫底**：A 段第一拍对齐第一块砖扣下的 4.0s（原曲偏轻，+4dB 与升空段拉近），倒塌瞬间硬切（`FALL = 4.0 + 32×60/143.555`）；重建段同曲安静段回来（−9dB，下拍对齐 29.0s「找到锥头」）；升空段「Heroic Age」53.61s 的爆发点对齐点火（36.5s），60.53→79.02 跳 10 小节（相似度 .95），最后重音落在片尾卡（`final_hit = 51.707s`）。`score.json` 记录 `reprise_downbeat_song = 66.75736961451247`——与 `librosa.beat.beat_track(sr=22050, hop_length=512)` 的下拍**精确吻合到 1e-9**（`edit.py:1-4,27`）。
- **拟音（foley）**：全部**代码合成、无采样**（CREDITS）——砖的 click（短瞬态 + 2.9/4.6kHz 共振）、clack、crash、whoosh、creak、thump、step、ding、quindar、rumble、ignite、roar（`mix.py:9`）。
- **旁白处理**：人声压缩，音乐在人声下压低约 **42%**（`duck = 1 − .42·…`，0.25s 保持、字间不回弹）；对讲走 radio 带通滤波（`mix.py:35,50`）。
- **响度实测**：成片 **I = −13.9 LUFS**、真峰值 **−1.52 dBTP**（口径 = `loudnorm` 的 `input_tp`，4× 过采样；`astats` **采样峰值** `-1.686971` dB 比真峰值低 0.17 dB，不能当真峰值用）——**达标**（≤ −1.2 dBTP）。旧片是 `I = −70.0 LUFS` 的数字静音。中间产物 `music/score.wav`（`edit.py` 产出，`peak norm 1.0637`）与 `demo/mix.wav`（48kHz 立体声 / 54.0s / **I = −15.5 LUFS**、LRA 7.9 LU、真峰值 −0.1 dBTP；astats 峰值 L `-0.445430` / R `-0.706294` dB，RMS `-18.283198` / `-17.695459` dB）。目标 `−14 LUFS`（`STYLE.md:74`）。
- **3 s RMS 弧线**（与设计一致）：music 4.0s 起 → 18–24s 静（倒塌硬切）→ 24–36s 安静重建（−9 dB）→ 36–54s Heroic Age 高潮。
- **静音策略**：**把音乐切死**在倒塌瞬间，只留房间底噪与一只滴答的钟；升空前音乐再次撤出，倒计时下垫一个 72bpm 心跳鼓（`style-dna/brick-toy.md:87`）。

---

## 7. 素材偏好

- **需要什么素材**：真实桌面纹理（胡桃木 `american_walnut_veneer`）、中性日光影棚 HDRI（`photo_studio_loft_hall`）、真实比例道具（茶壶 tea_set_01、台灯 desk_lamp_arm_01、一摞书）；所有积木几何**全部代码程序化生成**（bricks.js / actors.js / rockets.js）（CREDITS）。
- **不需要什么素材**：不需要任何品牌积木素材（禁止 LEGO logo / 小人剪影）；不需要粒子系统贴图（火/烟/水都用砖做）（`STYLE.md:12,25`）。
- **取景 / 质感 / 比例偏好**：1 米 = 125 凸点；砖高 1.2、板高 0.4；塑料 ABS + 强清漆（clearcoat ~0.85），粗糙度贴图带指纹与划痕（`STYLE.md:19,22`）。
- **配乐素材**：两首 Kevin MacLeod（incompetech.com）曲目「Monkeys Spinning Monkeys」「Heroic Age」，**CC BY 4.0 可合法使用**（`CREDITS:3-4` 已署名）。mp3 与 `Monkeys_Spinning_Monkeys_beats.npy` 被 `.gitignore` 排除（`styles/*/demo/**/*.mp3|wav`、`styles/*/demo/music/*.npy`），**只落本地、不进版本库**——这是仓库既有设计，**不是版权缺口**；新 clone 需先从 incompetech 官方直链取源（取源后文件名须与 `edit.py` 读的一致，librosa 直读 mp3 无需转格式）。
- **可替代方案**（缺素材时怎么降级而不破风格）：HDRI 缺失时改用纯色环境 + 2–3 个 RectAreaLight 柔光箱；真实道具缺失时用其它家居物件顶替，但**必须保持真实比例**、且不许入镜轴冲突（`STYLE.md:96`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 平均 ≈ 2.45s（54.0s / 22 镜，`story.js:51-57`），最短 1.2s、最长 3.8s |
| 全片时长 | **54.0s**（1296 帧 @24fps）（`style.json:17`） |
| 镜头数 | 22 个（macro→place→mA..mE→proud→collapse→alone→pickup→rummage→rebuild→visor→fins→pad→liftoff→cruise→moon→reveal→endcard） |
| 信息投放节拍 | 开场微距 → 快速搭建（每层一次 click）→ 骄傲 → 倒塌（音乐硬切）→ 安静独处 → 捡零件 → 重建 → 倒计时 → 点火 → 升空 → 着陆 → 尺度揭示 → 片尾卡（`style-dna/brick-toy.md:62-72`） |

- **加速 / 减速点**：搭建段最快（`rebuild` 每 0.19s 一块）；`fall` 17.37s 后骤降到安静独处；`ignite` 36.5s 再拉起（`story.js:15-36`）。
- **留白与静音的位置**：倒塌后 17.37–20.9s 的「alone」镜头 + 音乐切死；倒计时 33.3–35.3s 只有心跳鼓（`story.js:19,28`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/brick-toy/DEMO.md` 的 build notes 为准（本风格 demo 目录**没有 build.sh**）。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/brick-toy/demo --fps 24 --workers 6 --size 1920x1080 --out …` |
| 帧率 | 24fps（角色与砖 12fps 步进，镜头/焦点/火/飞行器 24fps） |
| 分辨率 / 比例 | 1920×1080 / 16:9（2× SSAA，渲染 3840×2160 → 交付 1080p）；`FILM_META.aspects` 支持 16:9 / 9:16 / 3:4 / 4:3 / 1:1（页面外壳等比装入，见第 2 节） |
| 混流 | `core/render/mux.sh out/video24.mp4 mix.wav brick-toy.mp4 24` |
| 编码器 | `h264_nvenc`（本地 GPU） |
| 音频入口 | `mix.py`（foley + voice + music） + `music/edit.py`（按小节剪辑） |
| 字幕入口 | 2D canvas `hud()`（`main.js:192-216`），无独立 srt 生成器（本次沿用仓库旧 .srt） |
| 事件导出 | `node core/render/events.mjs styles/brick-toy/demo`（→ events.json，111 条） |
| 本风格专属参数 | 渲染可走 `--skip-audio`（先出无声视频，再由 `mux.sh` 换入混好的音轨）；渲染 ≈ 590s / 1296 帧 / 6 workers |
| 一键复现 | 无 build.sh；按 DEMO.md 五步：still → tts → events/edit/mix → video → mux |

---

## 10. 编排规则

- **内容文件字段契约**（`content_fields`）：本风格**没有单独内容 JSON**，旁白由 `story.js` 的 `VO` 数组驱动，字段 `{id, t, text, radio?}`；语音时长读 `voices/dur.json`（缺省回退 = 文本长度 × 0.07）（`style-dna/brick-toy.md:173-182`）。
- **事件词汇表**：`click{v,pitch}` / `title` / `whoosh{v}` / `creak{v}` / `crash` / `clack{v}` / `thump{v}` / `step{v}` / `ding` / `quindar` / `rumble{d,v}` / `ignite` / `roar{d,v}`（`style-dna/brick-toy.md:201-216`）。
- **时间线契约**：`story.js` 导出 `DUR`(54) / `ANIM_FPS`(12) / `q(t)`/`qc(t)` / `BEAT`/`beat(n)`/`bar(n)` / `T` / `VO` / `SHOTS` / `shotAt(t)`；`main.js` 导出 `render(t)` 与 `window.DUR`/`window.EV`/`window.READY`（`style-dna/brick-toy.md:194-197`）。
- **新增主体怎么接入**：用 `bricks.js` 原语搭——`brick(w,d,color,{h})` / `plate` / `roundGeo` / `coneGeo` / `slopeGeo`，材质 `plastic(color,{trans})`；角色参考 `actors.js` 的 `makeAstro()`（面罩用弧形开口圆柱，不要用球面段）（`style-dna/brick-toy.md:186-192`）。
- **换主题时要改哪些文件**：`story.js`（`T`/`VO`/`SHOTS`/`CREDITS`）+ `set.js`（桌面/道具/月球）+ `actors.js`/`rockets.js`（新主体几何）；`bricks.js` 的调色板 `COL`（`bricks.js:7-10`）。
- **与 `dub.mjs` 通路的关系**：`lib/dub-styles.json#brick-toy` 生效参数——palette（bg `#f4f4f1` / fg `#1b2a34` / accent `#c91a09`）、bgRecipe（solid + vignette 0.08）、subtitle（DengXian 粗体、fontSizeFactor 0.03704、marginV 0.14537、居中）。

---

## 11. 当前短板与避坑要点

### 已修复（本次）
- **★ 成片音频已从「数字静音」修复为真配乐**：原成片音频是静音占位（`I = −70.0 LUFS`），音频链因缺曲跑不起来；本次已取源、重跑音频链并重新混流出片。新成片 `D:/lemo-films/brick-toy/brick-toy.mp4` 为 **24,296,434 字节**，**1920×1080 / 24 fps / 1296 帧 / 54.000000 s**（与旧片逐项完全一致——视频没变，只换了音轨）；音频实测 **I = −13.9 LUFS**、真峰值 **−1.52 dBTP**（`loudnorm` `input_tp`，4× 过采样；astats 采样峰值 `-1.686971`，比真峰值低 0.17 dB）。
  - **修复路径**：① 从 incompetech 官方直链取回两首 CC BY 4.0 曲目——`Monkeys_Spinning_Monkeys.mp3`（5,005,207 B / 320 kbps / 125.074 s）与 `Heroic_Age.mp3`（3,902,611 B / 320 kbps / 97.463 s），落位 `demo/music/`（文件名正是 `edit.py` 读的，librosa 直读 mp3 无需转格式）；② 补出 `edit.py` 依赖但仓库缺失的 `Monkeys_Spinning_Monkeys_beats.npy`：`librosa.beat.beat_track(sr=22050, hop_length=512, units='time')` → tempo **143.5547 / 298 拍**，下拍 `66.75736961451247`，与仓库原 `score.json` 精确吻合到 1e-9（**必须 sr=22050/hop=512；用 sr=48000 会得 66.72，差 0.037s**）；③ 跑 `edit.py` → `score.wav`，`score.json` 精确回到原值 `{"final_hit":51.70700000000001,"reprise_downbeat_song":66.75736961451247}`；④ 跑 `mix.py` → `mix.wav`（10,368,044 B / 48 kHz 立体声 / 54.0 s / I = −15.5 LUFS / LRA 7.9 LU）；⑤ 走 `core/render/mux.sh`（`LEMO_VENC=h264_nvenc` ⇒ **GPU 编码**），两遍 loudnorm 把混音的 −15.5 LUFS 归一化到成片的 −13.9 LUFS。**未用 demo 自带的混流脚本**。
  - **配音未重跑**：`demo/voices/` 已有 8 条（`v1`–`v5` = Kokoro `bm_george`、`c1`–`c3` = `am_adam`，24 kHz），`dur.json` 一致；`core/tts/asr_check.py lines.json voices --lang en` → **8/8 OK，mismatches 0，exit 0**（base.en），原文与转写逐条一致。`demo/events.json` 已存在（dur=54、111 个事件），直接复用。

### 仍存在的短板
- ~~**9:16 硬渲会丢画面**：无 `aspects` 声明，产品默认 9:16 导出时右侧约 43.75% 画面丢失、下方整片黑。~~ **★ 2026-10-04 已修**：`demo/index.html` 加「设计帧等比装入」外壳 + `demo/film.js` 声明 `aspects`（5 个比例全支持），9:16 下整幅画面与字幕都在（见第 2 节）。残留代价：竖屏有效画面只占 1080×608、留边无全屏层内容。
- **本 demo 没有 build.sh**，一键复现只能照 DEMO.md 手动五步走。
- **本次出片仍走 `--skip-sync`**，字幕源沿用仓库已提交旧 `.srt`、未重新生成。

### 素材缺口 / 版本库陷阱
- 两首配乐 mp3 与 `Monkeys_Spinning_Monkeys_beats.npy` 被 `.gitignore` 排除（`styles/*/demo/**/*.mp3|wav`、`styles/*/demo/music/*.npy`），**只落本地、不会进 git**——仓库既有设计，**不是版权缺口**（`CREDITS:3-4` 已声明 Kevin MacLeod / CC BY 4.0，直链在 incompetech 官方站）。**新 clone 必须先跑取源步骤**，否则 `edit.py` 直接 `LibsndfileError`。
- Kokoro TTS 声线（`bm_george`/`am_adam`）本机需自行生成。

### 踩过的坑（本机实测）
- **`edit.py` 用相对路径读 mp3，在仓库根执行会崩**：编排器在**仓库根**执行 `.venv/bin/python styles/brick-toy/demo/music/edit.py`，脚本按相对路径找 `Monkeys_Spinning_Monkeys.mp3`，报 `LibsndfileError: Error opening 'Monkeys_Spinning_Monkeys.mp3'`。**修正**（本次唯一源码改动，可回滚）：`styles/brick-toy/demo/music/edit.py` 第 5 行原有 import 行末加 `, os` 并追加 `os.chdir(os.path.dirname(os.path.abspath(__file__)))`——与兄弟脚本 `paper-popup/edit.py` 的既有约定一致。回滚：`git checkout styles/brick-toy/demo/music/edit.py`。
- 混流走 `core/render/mux.sh` + `nvenc`（未用 demo 自带脚本）；本次两遍 loudnorm **已生效**（与旧片静音时跳过归一化不同）。
- **Python 音频脚本必须先限 BLAS/OpenMP 线程数，否则会「假卡死」**：`edit.py` / `mix.py` 里的 numpy/scipy/librosa 默认按核数起线程，多任务并发时线程互抢 + OpenBLAS 忙等自旋，实测单线程只需 ~14s 的计算量会拖到 35 分钟不结束（`ps` 显示 500%+ CPU、RSS 数百 MB、`nonvoluntary_ctxt_switches` 十几万）。重跑本风格音频链前先设：`PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 BLIS_NUM_THREADS=1`；另注意 `print` 在管道里是块缓冲的，**看不到输出不等于卡死**，加 `PYTHONUNBUFFERED=1` 才能看实时进度。

### 能力限制
- 依赖 three.js + 物理景深 + GTAO + 2× SSAA，**必须 GPU**；1296 帧在 6 workers 下 ≈ 590s，是重资源风格。

### 下次迭代优先补什么
- 若换主题 / 换曲，保持 **143.555 BPM / 小节对齐**的剪辑逻辑（`FALL` 与 `final_hit` 均据此推导），并重跑 `edit.py` 校正 `score.json` 的 `reprise_downbeat_song`。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/brick-toy/brick-toy.mp4`（1920×1080 / 24fps / 1296 帧 / 54.000000s / **24,296,434 B**；音频 I = −13.9 LUFS、真峰值 −1.52 dBTP） |
| 抽帧 | `D:/lemo-tools/_distill/frames/brick-toy/`（24 帧 + 接触印样） |
| 音频证据 | `styles/brick-toy/demo/music/edit.py` · `music/score.json`（`final_hit=51.707`、`reprise_downbeat_song=66.75736961451247`） · `music/score.wav` · `demo/mix.wav` · `demo/voices/`（8 条，ASR 8/8 OK） · `music/Monkeys_Spinning_Monkeys_beats.npy` |
| 风格匹配度自评 | **90/100**（2026-10-05 校正：原 87，9:16 画幅缺陷已修并回补 composition +3） |
| 详细资料 | 有（STYLE.md / DEMO.md / style-dna md+json / dub-styles / story.js / main.js / mix.py / music/edit.py / CREDITS / brick-toy.log） |

**逐帧拆解要点**：f01 极微距单块红砖（2×4）落在灰木桌面，茶壶/杯子在背景虚化，字幕药丸「Every rocket starts with one brick.」——开场即尺度。f04 搭建段：白色积木小人在绿底板上放砖，红白柱升起，字幕「Then another. And another.」。f08 小人仰视高塔，红白相间火箭已成形。f12 白色躯干特写（红/黄/蓝圆凸点），周围散落零件，字幕「That's okay. Now we have spare parts.」——倒塌后的重建。f16 红色大鳍 + 黄蓝砖底，画面底部出现红色 "MISSION CONTROL" 标签 + 「Three… Two…」倒计时。f19 火箭（红锥头/白身/鳍）立在书摞（月亮）上，灰桌面。f21 火箭着陆在积木月球（灰圆板）表面、宇航员在旁，字幕「And every moon base… starts with one brick.」。f24 片尾卡：压暗的桌面全景 + 标题「Rocket from Spare Parts」+「BRICK TOY · LEMO-OPUSCAR」+ credits。配色全程是玩具饱和色（红/白/黄/蓝/绿）对低饱和的真实房间；字幕只在有旁白/对讲时出现，硬切转场。

**自检发现的缺陷**：音频整轨静音（**本次已修复**）；~~9:16 不支持~~（**★ 2026-10-04 已修**：页面外壳等比装入 + `demo/film.js` 声明 aspects）；无 build.sh；`--skip-sync` 沿用旧 .srt。

**本次为补齐短板做了什么**：取回两首 CC BY 4.0 配乐（Kevin MacLeod / incompetech.com）并落位 `demo/music/`；用 `librosa` 补出仓库缺失的 beats npy（sr=22050/hop=512，下拍与 `score.json` 吻合到 1e-9）；修 `edit.py` 的相对路径 cwd（加 `os.chdir`，可回滚）；重跑 `edit.py` + `mix.py`，走 `mux.sh`（nvenc，两遍 loudnorm）重新混流出片——成片音频由 `−70.0 LUFS` 数字静音变为 **I = −13.9 LUFS / 真峰值 −1.52 dBTP**（`loudnorm` `input_tp`，4× 过采样）的真配乐。视频画面未变，仅替换音轨。
