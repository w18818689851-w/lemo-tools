---
name: lemo-style-ukiyoe
description: 【lemo 风格 Skill · 浮世绘】做旅行、日本文化、历史、风景、季节、诗意叙事类短片时用；交付「每个镜头都是一整幅江户木版画——和纸、双墨线边框、分版平涂、竖题签与朱印」的安静印品观感。选定本风格做视频时，优先读本文件。
slug: ukiyoe
name_zh: 浮世绘
category: 东方传统
film: A Journey Toward the Mountain
---

# 浮世绘（`ukiyoe`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/ukiyoe/STYLE.md` · `styles/ukiyoe/DEMO.md` · `styles/ukiyoe/demo/build.sh` ·
> `lib/style-dna/ukiyoe.json` · `lib/style-dna/ukiyoe.md` · `lib/dub-styles.json#ukiyoe` ·
> `styles/ukiyoe/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部「江户木版画活过来」的片子。**每一个镜头都是一整幅完整的木版画**——一张和纸、一道粗细双墨线边框、几块从不同版上印出来的平涂色块、最上层一道黑色主版墨线、一条竖式题签和一枚朱印。世界是**故意平的**：纵深来自层层叠压的水平色层、霞带与大胆裁切，绝不来自透视、光照或明暗（`STYLE.md:8`、`style-dna/ukiyoe.md:11`）。让它读起来像「**印出来的**」而不是「矢量图」的是四件事：**纸永远可见、一色一版且套色错位、大色块有木纹与馬連痕、天空与水有ぼかし**（`STYLE.md:10-15`）。

**不是什么**（最容易做错的邻居风格）：不是加了纸纹叠加的平面矢量插画（必须真有木纹与套色错位）、不是中国水墨（没有洇开的墨晕，颜色是印上去的不是画上去的）、不是动画赛璐璐上色（形体上没有光与影）（`STYLE.md:16`、`style-dna/ukiyoe.md:157-159`）。

**什么时候用它**：题材天然是「**一段旅程 / 一套连作 + 一个恒定主体**」时——旅行游记、日本文化与历史、季节与风景、诗意叙事、画册式内容（`dub-styles.json#ukiyoe.tags.theme`、`style.json:11-15`）。样片《Toward the Mountain · 山へ五景》是一个戴斗笠的旅人从稻田走向远山，过雨桥、经茶屋圆窗，直到一道立起的巨浪把他与山隔开；浪把版画洗回白纸，下一幅就是山，他摘下斗笠（`DEMO.md:10-14`）。

**一句话内核**：纸即画框、一色一版且套色错位、平涂叠层出纵深；故事由「**同一个恒定主体每次落在画面什么位置**」来讲（小到一粒米 → 被圆窗框住 → 被巨浪压住 → 填满整张）。

**边界**：它撑不起——需要光影立体感与透视纵深的内容（3D 场景、写实材质）、快节奏高信息密度的口播、多角色同时表演的复杂调度（人物在风景里只有约 80–130 px）、以及任何需要「照抄一幅真实名画」的诉求（不复制《神奈川冲浪里》《赤富士》《大桥骤雨》，也不照抄它们的角色或构图，`STYLE.md:4`、`style-dna/ukiyoe.md:164`）。

---

## 2. 画面构图

- **镜头数与画幅**：原生 **16:9 / 1920×1080**（本次出片即 `--ratio 16:9`，`logs/ukiyoe.log:1-2`）。全片 **5 幅画（五景）**：一 田毎の朝 / 二 雨の橋 / 三 茶屋の窓 / 四 海立つ / 五 山（`DEMO.md:16`）。相机 **24 fps on ones**（相机分级会抖，`STYLE.md:44`）。
- **纸就是画框**：zoom 1 时画面 = 一张和纸，位于**粗细双墨线边框**内（`FR` = x 44–1876、y 38–1042，**3.4 px** 主框 + 外侧 **9 px** 细线），外面还有一圈纸边；纸坐在长装裱手卷上（`#c9b690`、260 px 间隙、一端木轴）（`DEMO.md:60`、`print.js:5`）。
- **主体位置与占比**：人物在风景里**很小**（整张约 80–130 px，`STYLE.md:26`）；恒定的主体（山）按镜逐幅改变位置与尺度——早期小到一粒米（帧 f04 地平线上一点）、中段被圆窗框住（f11）、高潮被巨浪压住（f15）、结尾填满整张（f19/f21）。
- **负空间 / 留白**：**纸就是白**——泡沫、雪、雾、空天都是**没印的纸**，不用白颜料（`STYLE.md:31`）。白可以淹过画面、把版画洗回一张空白纸（高潮后的 ma，帧 f17 的泡沫渐退）。
- **图层叠放顺序**（从底到顶）：纸底（和纸 + 纤维）→ 各色版平涂（g1 蓝 / g2 绿次色 / g3 红人物，各带固定套色偏移）→ ぼかし 天空与水 → 霞带 → 主版墨线（g0）→ 题签 / 朱印（`DEMO.md:76`、`print.js`）。
- **安全区**：字幕题签覆盖底部约 **150 px**，地面线与人物要抬到它上面（`STYLE.md:38`、`DEMO.md:39`）。竖式题签与朱印通常在右上或画边。
- **本风格不能出现的构图**：透视网格的田地（必须**平行、倾斜、平的叠层**，`STYLE.md:90`）、把松树画成半圆盘（要平顶针叶垫）、`fillRect` 条带做的 ぼかし（会留竖向接缝）、在单幅画内部做 3D 旋转。

**在 9:16（产品默认）下的表现**：本风格**已适配 9:16**——`FILM_META.aspects = ['16:9','9:16']`（`film.js:23`），`main.js` 按**视口**调 `print.js` 的 `setFrame(W,H)`（`print.js:9`，导出 `FW/FH/FX/FY/S = min(fx,fy)`）重排版面：相机矩阵 `camMatrix` 把「设计帧 → 当前帧」的**等比装入**（`×S` + 居中偏移）折进 z（`film.js:150`），手卷始终**整幅可见**、上下留边补裱纸色 + 和纸纹理（`film.js:179`）；屏幕空间的家什按轴拉伸 / 按紧轴缩放——字幕题签 `x=(FW-w)/2`、`y=FH-72*FY-h`、字号 `42*S`（`film.js:195`），片尾卡 `FW/2 … 920*FY`、字号 `×S`（`film.js:228`），碎浪白屏尺寸 `×S`、收尾整幅 `FW×FH` 盖纸（`film.js:211`）。1080×1920 实测（`S = 0.5625`）：**不裁切、无黑边**，每幅画整张落在画面中部的横带里、上下是裱纸色（不是黑）；字幕题签缩到 42×0.5625 ≈ 24 px，贴底居中、完整在框内。16:9 逐字节未变（`FX=FY=S=1` 时每个表达式退化成它替换掉的那个数字，三帧 md5 与改造前完全一致）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 纸（和纸底） | `#eee2c6` | 纸底（±3% 斑驳；纤维 `#fbf6e9` / `#c7b893`） | `DEMO.md:66`、`print.js:6` |
| 普鲁士蓝 | `#1d3a66` · 暗 `#13284a` · 浅 `#4d6f98` | 天空 / 水 / 山 / 浪（主导色系） | `DEMO.md:67` |
| 深槽 | `#0f2344` | 浪的内侧 | `DEMO.md:68` |
| 浅蓝 | `#8db0c6` · `#bcd0d6` | 水的反光 / 低空 | `DEMO.md:69` |
| 墨（主版） | `#231f1c` | 所有主版墨线 | `DEMO.md:70` |
| 紅（beni） | `#b8412f` · 淡 `#e3a08a` · 桃 `#efc4a8` | 太阳 / 毡凳 / 朱印 / 黎明ぼかし / 题签签条 | `DEMO.md:71` |
| 赭 / 稻草 | `#cf9f4a` · `#c9a45c` | 斗笠 / 路 / 腰带 | `DEMO.md:72` |
| 绿 | `#8aa152` · 暗 `#50703c` · 松 `#3e5a3a` | 田 / 树 | `DEMO.md:73` |
| 蓝布 | `#2c4a70` · 绑腿 `#1d2c44` | 衣服 | `DEMO.md:74` |
| 题签底 | `#f3e7c6` | 横向字幕题签底 | `DEMO.md:90`、`main.js:95` |

- **明度 / 对比规则**：**一套颜料，不是色轮**——6–9 个平涂色相，每个从自己那块版上印到纸底上；**除 ぼかし 外没有渐变，形体上没有明暗**。**墨主版线压在一切之上**；**纸就是白**。远层淡而低对比，近层饱和且带深墨线（`STYLE.md:30-33`）。
- **禁止出现的颜色**：任何形式的光影渐变、赛璐璐式阴影、洇开的墨晕（那是水墨）、用白颜料画泡沫/雪/雾（那是没印的纸）（`STYLE.md:16,31`）。
- **同一画面最多几个色相**：**一个主导色系**扛天空与水（19 世纪版画里是普鲁士蓝），**红是稀有的**——只给朱印、一个太阳、一件衣服或一个签条（`STYLE.md:32`）。样板三套颜料组：靛 + 紅的风景（本片）、美人画内景（淡粉/紫灰/灰绿/漆黑/云母灰底）、秋の摺物（柿/赭/灰绿/深褐/一点蓝）（`STYLE.md:34`）。

---

## 4. 转场规则

- **镜头之间怎么切**：**场景不切，靠手卷滑动**——镜头从右向左滑过装裱间隙，把下一幅带进来；滑得越短越急（demo 1.0 s → 0.9 s → 0.6 s，`DEMO.md:25`、`style-dna/ukiyoe.md:101`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：有**吃墨显现**（printing reveal）——每块版以带噪边的斜向馬連扫过、约 0.34 s 落定，落定时滑动 5–6 px 对准（`story.js:30`、`print.js:207-222`）。有**硬切到空白纸**（ma，間，一次屏息）。有**洗回纸白**（白淹过画面）。**没有交叉溶解、没有 3D 翻转**（`STYLE.md:64`、`style-dna/ukiyoe.md:111`）。
- **硬切点怎么定**：按手卷布局 `GAP/SW/SLOT` 与每幕落定时间 `T`（`story.js:7-29`）。高潮是**全片唯一一次大运镜**，分四拍（约 4.5 s，25.4–30.4 s）：**rise**（浪涨成墙、相机摇过顶边框并略放宽）→ **hang 亮相**（浪冠停在边框外的装裱纸上、爪张开近乎冻结，抖动 ×0.25，整幅画作为物体可见）→ **fall**（浪唇变长转向镜头、爪 ×2.5、相机推到 3× 带小幅滚转）→ **foam**（分形爪从浪唇爆开填满画面、褪到裸纸 → 硬切静默）（`DEMO.md:30-35`）。
- **转场时长与缓动**：题签落下（淡入 + 14 px 短滑）；**朱印是「盖」下去**（scale 1.35 → 1，0.2 s）；吃墨显现约 0.34 s/版（`STYLE.md:46`、`DEMO.md:91`）。★ **native move 需要约一秒的停留才读得出来**——第一版高潮只有 0.7 s，读起来是「泡沫闪了一下」（`STYLE.md:47`、`DEMO.md:37`）。
- **绝对不要的转场**：交叉溶解、3D 翻转、在单幅画内部做 3D 旋转（`style-dna/ukiyoe.md:111`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | **Shippori Mincho 500**（字幕，`STYLE.md:38`）；竖式题签用 **Yuji Syuku**（brush，`STYLE.md:39`）；本机无这两款，通路回退 **SimSun**（`dub-styles.json#ukiyoe`） |
| 字号（相对画面宽 / 高） | 字幕题签 **42 px**（`DEMO.md:90`）；通路 `fontSizeFactor 0.042`（≈45 px，`dub-styles.json#ukiyoe`） |
| 颜色 / 描边 / 阴影 | 墨色 `#231f1c` 字；坐进**奶油题签** `rgba(243,231,198,.96)`，带 **2.6 px + 1 px 双墨线边框**，左侧一枚小朱印「旅」；通路 `subtitleOutline` 也是 `#231f1c`、`outlineFactor 0`（题签是外框不是字描边） |
| 位置 / 安全边距 | 居中、离底约 **72 px**（`DEMO.md:90`）；通路 `marginVFactor 0.078`（150/1920，题签贴底）、`marginLFactor 0.06` |
| 单行字数上限 / 最多行数 | 一行一句；demo 5 行实测 33–57 字符（最短 `Then the sea stood up between us.` 33，最长 `From home, the mountain was no bigger than a grain of rice.` 57）（`style-dna/ukiyoe.md:41`、`logs/ukiyoe.log:29`） |
| 出现与消失方式 | 以吃墨显现的遮罩「**印**」进来（0.22 s），再淡出（0.25 s）；通路 `motion.subtitleFadeIn 0.12`；停留 ≥ `max(1.8s, 语音时长 + 0.6s)`（demo 用 ≥ `max(1.8s, 语音 + 0.75s)`，`STYLE.md:38`、`DEMO.md:56`） |

- **字幕与旁白的关系**：字幕**不是字幕条，是一条横向题签**——奶油纸条 + 粗细双墨线边框 + 左侧小朱印，它本身就属于版画的印刷语言（`STYLE.md:38`）。另有一条**竖式题签**（vertical cartouche，奶油底、粗细双边框、带系列名浅色签条、下方用毛笔字体写幅题、旁边一枚朱印）作为「每一幅画的句号」（`STYLE.md:39`）。标题也是一条竖题签 + 一条横式英文签，压在第一幅画上、盖章、在首句前揭走（`DEMO.md:92`）。
- **本风格特有的字幕禁忌**：不要用第二人称说教（这个风格是「我」在画边低语，不是导游讲解）；不要现代口语/俚语（语域必须像题画诗）；一句不要塞两个以上并列信息点（`style-dna/ukiyoe.md:50-54`）。**底部 150 px 内不要放地面线与人物**（会被题签盖住）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「Subtitle = a horizontal cartouche: a cream slip with a thick + thin ink border」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#0AF3E7C6`（AARRGGBB，落盘 ASS 为 `&H0AC6E7F3`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。该色值取自 demo 的 band 真实实现（demo band rgba(243,231,198,0.96)）；字色 #231f1c 与该底衬的 WCAG 对比度 **13.28**。

---

## 6. BGM / 音效特征

- **配乐**：**日本乐器，不要钢琴与 pad**——三味线（`core/audio/pluck.py shamisen`，带 sawari 颤响）、尺八、箏、太鼓与締太鼓、小鼓/大鼓的呼喊、拍子木（hyōshigi）、小铃（`STYLE.md:68`）。demo 的原创配乐（`music/score.py`）走**序破急（jo-ha-kyū）**：拍子木在开场印刷上加速（一块版一声，歌舞伎谢幕）→ 尺八自由节奏、**都节音阶（miyako-bushi：D E♭ G A B♭）**、长呼吸音、每个音滑进去、句尾 meri 下滑 → 三味线慢脉动（72 BPM）再转固定音型（96 BPM）→ 太鼓心跳从 0.9 s 间隔加速成滚奏 → 拍下时一记满击 → **绝对静默** → 四记大太鼓重印最后一幅 → 开场尺八动机回来解决、一条带 sawari 的长三味线音在片尾卡下回响（`DEMO.md:43-48`）。
- **拟音（foley）清单（按材质走）**：**纸**——馬連打圈摩擦（带通噪声 + 约 **9 Hz** 圈状调制）、手卷滑动、朱印（低频闷响 + 粘开细响）；**木**——版木放上台面、空心的脚步（`step{m:'dirt'|'wood'}`）；**玻璃**——风铃（分音 **2.36 / 5.15 / 7.98 kHz**）；水；当季的鸟与虫（云雀、雁、鸢的 *pii-hyoro*）（`STYLE.md:71`、`mix.py:27-110`）。
- **旁白处理**：平静的男声、第一人称、5 句短话（Kokoro `am_adam`、speed 0.84–0.88）；音乐在人声下 duck **约 −8 dB**（demo 最后一句压得更深到 0.25、其余 0.42），环境声约 −4 dB（`DEMO.md:56`、`mix.py:149-154`）。
- **响度目标**：`-14 LUFS`；**真峰值上限**：本次实测 **-0.6 dBFS**（**未达 ≤ −1.2 dBTP 目标，见第 11 节**，`logs/ukiyoe.log:113-121`）。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 -0.6 dBFS → **−2.60 dBTP**、已在 −1.2 dBTP 交付线内（达标）；原 -0.6 dBFS 记录保留为历史。
- **静音策略**：静默是**間（ma）**——**绝对静默，连混响尾巴都切掉**（`STYLE.md:70`）。demo 在巨浪拍下后 30.40 s 起 60 ms 淡出，到 32.2 s 完全静音（`mix.py:156-158`）；高潮里还插了一个 80 ms 的静默吸气（`DEMO.md:33`）。

---

## 7. 素材偏好

- **需要什么素材**：**全部在代码里程序化生成**，不依赖实拍/图库。需要——纸/木纹/馬連/斑点/分版/ぼかし/刻线/显现遮罩/题签/朱印的可复用核心（`print.js`）、山水/松/石/雨/雁（`nature.js`）、海与浪（`wave.js`）、旅人骨架（`traveler.js`）、五幅画的缓存色版 + 逐帧 `paint()`（`views.js`）（`STYLE.md:98`、`style-dna/ukiyoe.md:221-229`）。
- **不需要什么素材**：真实照片、真实名画（不复制《神奈川冲浪里》《赤富士》《大桥骤雨》）、3D 模型与光照贴图、光晕/景深/暗角等镜头特效（平版印刷没有暗角，通路 `vignette 0`）。
- **取景 / 质感 / 比例偏好**：**大胆裁切**与**极端前景元素**（一根树枝、一根柱子、一个灯笼横穿画面）是本风格的原生手法；纵深靠**叠层**，绝不靠透视（`STYLE.md:64`）。母题：霞 = 两端收圆的长平带（すやり霞）；松 = 平顶针叶垫；田 = 高而平的平行层、交叉线**平行且倾斜**绝不汇聚；雨 = 两组略不同角度的细直线叠在墨色 ぼかし 天空下；水 = 分层蓝带、带间 ぼかし、泡沫水花留成纸白（`STYLE.md:25`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：没有复杂山水就用 `print.js` 的 `carve/bokashi/kasumi/stampLayer` 组合出简笔山与霞；没有浪就用 `nature.js` 的「简笔浪爪」；缺毛笔字库时用宋体（明体）顶替 Shippori Mincho 并保持字号与居中，**不要引入圆体或黑体**（会破坏印刷感，`dub-styles.json#ukiyoe.notes`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 早期几幅锁死（读墙上一幅画），中段一幅极慢推（1.00 → 1.065）；高潮大运镜约 4.5 s；手卷转场 1.0 → 0.9 → 0.6 s（越来越急）（`DEMO.md:23-25`） |
| 全片时长 | 44.0s（`style.json:17`、`story.js:2`）；本次成片 **44.00s / 1056 帧**（`logs/ukiyoe.log:70`） |
| 镜头数 | 5 幅画（五景）；事件 **81** 条、字幕 **5** 条（`logs/ukiyoe.log:26,109`） |
| 信息投放节拍 | 序破急：慢/开阔/静止（序）→ 渐聚的脉动（破）→ 急速冲向峰值（急）→ 硬切静默（ma）→ 安静的解决与尺度揭示（`DEMO.md:12`） |

- **加速 / 减速点**：**分级帧率是灵魂**——人物与自然 **8 fps**、雨与快速的水 **12 fps**、**相机 24 fps on ones**（相机分级会抖）（`STYLE.md:44`、`story.js:3-4`）。高潮四拍：waveRise [25.4,27.3] → hang [27.3,28.5] → fall [28.5,29.7] → crash [29.7,30.4]；随后 ma [30.4,32.2]，四记重印 32.2 / 32.7 / 33.2 / 33.7（`story.js:20-22`）。
- **留白与静音的位置**：ma 落在 30.4–32.2 s（mix 段 `闁�` 全轨 −180 dB，`logs/ukiyoe.log:94`）；高潮内另有 80 ms 静默吸气（28.42–28.498 s，`logs/ukiyoe.log:71`）。旁白 5 句落点：6.0 / 12.3 / 18.0 / 23.5 / 34.4 s（`logs/ukiyoe.log:29`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/ukiyoe/demo/build.sh` 为准。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4`（`build.sh:12`）；本次编排器实跑为 `--workers 6 --size 1920x1080`（`logs/ukiyoe.log:37`） |
| 帧率 | 24 fps（1056 帧 = 44s；画面内分级 8/12 fps，`logs/ukiyoe.log:70`、`story.js:3-4`） |
| 分辨率 / 比例 | 原生 1920×1080 / 16:9（`logs/ukiyoe.log:2`）；**已适配 9:16**（`FILM_META.aspects = ['16:9','9:16']`，`film.js:23`），由 `print.js` 的 `setFrame(W,H)`（`print.js:9`）重排：相机矩阵 `camMatrix` 折入等比装入 `×S`（`film.js:150`）、屏幕家什按 `FX/FY` 拉伸 / `S` 缩放；16:9 时 `FX=FY=S=1` 逐字节退化成设计帧 |
| 混流 | `sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav styles/ukiyoe/ukiyoe.mp4 24 0`（−14 LUFS / **颗粒 0**，纸本身就是颗粒，`build.sh:13`） |
| 编码器 | `h264_nvenc`（本地 GPU；本次 `nvenc`，`logs/ukiyoe.log:7`） |
| 音频入口 | `demo/music/score.py`（三味线/尺八/太鼓/拍子木）+ `demo/mix.py`（拟音 + 旁白 + 配乐闪避 + 間 的全静音） |
| 字幕入口 | `$PY $D/subs.py && $PY core/render/srt.py $D/out/subs.json styles/ukiyoe/ukiyoe.srt`（`build.sh:11`） |
| 事件导出 | `node core/render/events.mjs $D`（本次 events 81 dur 44，`build.sh:8`、`logs/ukiyoe.log:26`） |
| 本风格专属参数 | 静帧调试 `node core/render/still.mjs styles/ukiyoe/demo <t...>`，`--q nosub=1`（去字幕）、`--q test=trav`（角色表）、`--q poster=1`（`DEMO.md:112`） |
| 一键复现 | `sh styles/ukiyoe/demo/build.sh`（9 步：TTS → whisper → events → 配乐 → 混音 → 字幕 → 渲染 1056 帧 → mux → 成片 ASR 自检，`build.sh:1-14`） |
| 本次编排器调用 | `node lemo-make.mjs ukiyoe --skip-sync --no-preflight --ratio 16:9`（`logs/ukiyoe.log:1`） |

---

## 10. 编排规则

- **内容文件字段契约**：`story.js` 是**唯一时间真值**，导出 `DUR`、`q8/q12`（8 fps / 12 fps 量化函数）、`GAP/SW/SLOT`（手卷布局：间隙 / 滑距 / 槽位）、`T`（每幕落定时间、平移区间、巨浪四拍、ma、重印、题签/印章时刻）、`REVEAL_DUR`、`VO`（`style-dna/ukiyoe.md:174`、`story.js`）。`lines.json` 每条 `{id, text, voice, speed}`，demo 5 行 `am_adam` 0.84–0.88（`style-dna/ukiyoe.md:175`）。
- **事件词汇表**：`baren{d}`（馬連打圈摩擦）/ `block`（版木放上台面）/ `slip`（纸签落下/揭起）/ `seal`（朱印按下）/ `scroll{d}`（手卷平移）/ `step{m}`（脚步 `dirt`|`wood`）/ `cup` / `sip` / `chime` / `lark` / `geese` / `kite` / `hat` / `gust` / `rise{d}` / `crash` / `fall{d}` / `amb{w,d}`（环境 field/rain/tea/sea/high）/ `vo{id}`（`style-dna/ukiyoe.md:195-212`）。全部由 `core/render/events.mjs` 序列化成 `events.json`（本次 81 条）。
- **时间线契约**：页面契约（`main.js`）为 `window.READY` / `window.render(t)` / `window.DUR` / `window.EV`。`views.js` 把每幅画做成缓存色版 + 逐帧 `paint()`；`main.js` 负责相机、手卷、纸、显现、标题、字幕与事件；`mix.py` 读 `events.json` 做拟音/人声/配乐/ducking 与静默的 ma；`subs.py` 把 cue 导成 srt（`style-dna/ukiyoe.md:193`）。
- **新增主体怎么接入**：用 `print.js` 画（可复用核心）——切线与墨线 `smooth/dense/poly` + `carve(x, pts, w, {taper, seed, jit})`（变宽填充线、两端收尖）+ `line/fillPath`；ぼかし 用 `bokashi(...)`（逐像素、边缘按列游走）、霞用 `kasumi(...)`；套版印上用 `stampLayer(dst, src, reveal, reg, shift)` / `stampFn(dst, fn, reveal, shift)`（吃墨显现 + 滑动对准）；朱印用 `sealCanvas(chars,size,{white,seed,col})` + `drawSeal(...)`；竖题签用 `vtext/vlen/cartouche(...)`；大色块质感用 `printTex(x, grain, baren, ox, oy)`（`style-dna/ukiyoe.md:183-189`）。山水/松/石/雨/鸟参考 `nature.js`，海与浪参考 `wave.js`，旅人骨架参考 `traveler.js`。
- **换主题时要改哪些文件**：① `demo/story.js`（`DUR` / `q8/q12` / `GAP,SW,SLOT` / `T` 全表 / `REVEAL_DUR` / `VO`，决定节奏与卡点）；② `demo/lines.json`（旁白）；③ `demo/print.js` 的 `PAL`（6–9 个平涂色相）与分版定义（g0–g3 及套色偏移）；④ `demo/views.js`（五幅画的缓存色版与 `paint()`）；⑤ `demo/nature.js` / `wave.js` / `traveler.js`（母题与人物）；⑥ `demo/main.js`（相机、手卷、纸、显现、标题、字幕、事件）。配乐改 `demo/music/score.py`，混音改 `demo/mix.py`。
- **与 `dub.mjs` 通路的关系**：本风格在「文案 + 风格」通路里可生效的参数有 `palette`（bg `#eee2c6` / bg2 `#e2d3b0` / fg `#231f1c` / accent `#1d3a66` / subtitle `#231f1c` / subtitleOutline `#231f1c` / subtitleBack `#f3e7c6`）、`bgRecipe`（type=solid、texture **washi**、vignette 0）、`subtitle`（**SimSun** / 0.042 / 0.078 / 0.06 / outline 0 / bold false / align 2）、`title.fontSizeFactor 0.082`、`motion.subtitleFadeIn 0.12`、`motion.chapterTransition **cut**`、`overlay.chapterCards true`、`overlay.accentRule true`（`dub-styles.json#ukiyoe`）。**注意两处口径**：① 通路 `palette` 四个色都取自 demo `print.js:6` 的具名调色板 PAL（paper `#eee2c6` / paperD `#e2d3b0` / sumi `#231f1c` / prus `#1d3a66`）；`subtitleBack` 在 dub-core 里是**阴影色**、不是题签底衬；② `motion.chapterTransition` JSON 写的是 `cut`，但同条 `notes` 论证的是 `wipe`（斜向馬連扫过的印刷揭示），两处不一致，使用时以「印刷揭示 = wipe 观感」为准（`dub-styles.json#ukiyoe.notes`）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **真峰值未达标**：本次成片实测 Peak **-0.6 dBFS**，**未达 mux.sh 的 ≤ −1.2 dBTP 目标**；`mux.sh` 明确告警「the mix is probably clipping or has very hot peaks」（`logs/ukiyoe.log:113-121`）。响度 −14.1 LUFS 达标，但 mix.wav 峰值偏高，下一版需先压峰再 mux。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 -0.6 dBFS → **−2.60 dBTP**，已在 −1.2 dBTP 交付线内；音频评分回补 +2（见第 10 节）。
- **9:16 曾不适配（★ 2026-10-04 已修）**：原记「无 `aspects` 声明，只按 1920×1080 绝对像素构图，硬渲 9:16 会丢失右侧约 43.75% 并留下方黑区」。**2026-10-04** 已改造 `styles/ukiyoe/demo/`：把渲染逻辑拆到 `film.js` 并声明 `FILM_META.aspects = ['16:9','9:16']`（`film.js:23`）、`print.js` 加 `setFrame(W,H)` 派生 `FW/FH/FX/FY/S`（`print.js:9`），`camMatrix` 折入「设计帧→当前帧」等比装入（`film.js:150`），字幕 / 片尾卡 / 碎浪白屏按 `FX/FY/S` 重排（`film.js:195,228,211`），竖幅上下留边补裱纸（`film.js:179`）。**16:9 逐字节未变**（三帧 md5 与改造前完全一致）；9:16 实测不裁切、每幅画整张完整可见、字幕在框内（见第 2 节）。
- **字体回退**：demo 声明 Shippori Mincho 500（字幕）+ Yuji Syuku（竖题签毛笔），本机无这两款，通路回退 **SimSun**，题签的笔意与字宽与设计意图不一致（`dub-styles.json#ukiyoe.notes`）。
- **通路 `palette` 全为 null 的历史问题已修但仍有口径差**：`notes` 记录 §3 全篇无 hex（「a pigment set, not a colour wheel」），下游曾回退 plain-dark；现四个色已交叉核对到 demo PAL，但通路仍不承载题签双墨线边框与朱印。

### 素材缺口
- 无外部实拍/图库依赖（全部代码生成），因此不存在「缺图缺片」；真正的缺口是 **Shippori Mincho / Yuji Syuku 字体文件**（需装进 `demo/fonts/`）与**新主题的颜料组 + 母题资产**（不能沿用《Toward the Mountain》的五景、浪形、旅人）。

### 能力限制
- 骨架三条不能拆：**纸即画框 + 一色一版且套色错位 + 平涂叠层出纵深**（`STYLE.md:100-106`、`DEMO.md:12`），因此撑不起写实光影、3D 透视、快节奏高密度口播。
- 人物在风景里只有约 80–130 px，撑不起多角色复杂表演与精细面部戏。
- native move 必须停留约一秒才读得出来，节奏天然偏慢（`STYLE.md:47`）。

### 踩过的坑（本机实测，`DEMO.md:120-128`）
- 锯齿状雪线看着像王冠、平滑的雪线像糖霜 → 用**随机长度的窄尖雪沟**，并强制控制点 x 单调（否则出现自交小环）。
- 第一版浪像一道瀑布帘（水线从基部扇形散开）→ 水线必须**沿背坡轮廓**走；浪身要**分带蓝**；浪爪必须**分叉并向内钩**（一条卷曲的条带读成缎带）。
- 偏移曲线在紧的浪唇处自交 → 内侧水线**只用背坡**。
- 浪冲破边框必须**同时**逃出 sheet clip 与 frame clip，两侧裁到画框，只有顶部破出去。
- `mountain()` 只在传入平涂色时才填充，导致渐变浪身透明 → 注意选项标志。
- 朱印用 `multiply` 在深色片尾卡和浪上**消失** → 那里改 `source-over`。
- 旅人走过前景树读成「在树前面」→ 让低枝**避开行走路径**。
- 字幕题签盖住底部 150 px 里的地面线与人物 → 把它们抬上去。

### 下次迭代优先补什么
- 修真峰值：在 `mix.py` 先压峰/限幅到 −1.5 dBFS 左右，再让 mux 的两遍 loudnorm 线性增益到 −14 LUFS，消除 −0.6 dBTP 告警（★ 原记·首版告警值；该缺陷已于 2026-10-03 音频重混修复，成片实测 −2.60 dBTP 达标）。
- 把 Shippori Mincho / Yuji Syuku 装进 `demo/fonts/`，消除字体回退。
- **（已完成 2026-10-04）** 9:16 适配：已给 `film.js` 补 `FILM_META.aspects = ['16:9','9:16']`（`film.js:23`）并由 `print.js` 的 `setFrame()` 重排版面（`print.js:9`）。★ 声明落在影片模块 `film.js` 的 `FILM_META`，**不是 `style.json`**——探测方 `lib/aspects.mjs` 读的就是 `film.js` 源码文本。手卷仍横向排列（**不是**纵向翻页），竖幅下整幅等比装入、上下补裱纸色。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/ukiyoe/ukiyoe.mp4`（44.00s / 27.9MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/ukiyoe/`（24 帧 + 接触印样） |
| 风格匹配度自评 | **92/100**（2026-10-05 校正：原 91，9:16 画幅缺陷已修并回补 composition +1）（2026-10-03 校正：原 89，音频真峰值缺陷已修，audio +2） |
| 详细资料 | 有（STYLE.md / DEMO.md / style.json / build.sh / style-dna .md+.json / dub-styles.json#ukiyoe / demo 源码 print.js+views.js+story.js+mix.py+subs.py / 出片日志） |

**逐帧拆解要点**：f01 **空白纸 + 只有主版墨线**——一片稻田的轮廓线、一棵平顶松、远山一小点，无颜色（开场「一版一版地印」的起点）；f04 第一幅印完——黎明粉橙 ぼかし 天空、靛蓝远山、朱红太阳、青绿稻田**平行倾斜的叠层**、右侧松树、戴斗笠的小旅人（约 100 px），底部奶油题签「From home, the mountain was no bigger than a grain of rice.」（33→57 字符实测）；f11 茶屋——一个**圆窗**把山框住（中段极慢推 1.00→1.065），屋内红毡凳、茶炉、朱印「茶」、纸灯笼，底部题签「Some evenings, it waited for me in a window.」；f15 第四幅「海立つ」——一道**立起的浪墙**（分带蓝：浅蓝浪冠 → 普鲁士 → 深槽）、白色泡沫沿浪冠、旅人在岩石岬角、远山与松在两侧；f17 **俯冲进泡沫**——分形浪爪 + 水花簇填满画面、褪到裸纸（crash 后 → 硬切静默 ma）；f19 第五幅「山」——山**填满整张**、雪冠呈**向沟壑下垂的尖指**、地平线水平带；f21 同幅加题签「The mountain never moved. Only I did.」+ 旅人摘下斗笠；f24 片尾卡——深靛 `#161a22` 上**五幅画并排**（尺度揭示），标题「Toward the Mountain 山へ五景」+ `UKIYO-E · a Lemo-Opuscar demo · LemoLab × Claude Opus 5.5` + 一枚朱印。**配色无明暗推移**（平版印刷），靠**印刷进度**（白纸 → 逐版上色 → 泡沫洗回纸白）与**尺度的放大**制造起伏；转场全是手卷滑动 + 吃墨显现，无叠化。**无瑕疵帧**（无糊、闪、错位、字幕溢出）。

**自检发现的缺陷**：成片真峰值 −0.6 dBFS 未达 ≤ −1.2 dBTP 目标（mux 告警）；字体回退 SimSun（demo 是 Shippori Mincho / Yuji Syuku）；无 9:16 适配（★ 2026-10-04 已修：`FILM_META.aspects` + `print.js setFrame()`，见第 11 节）；通路 `chapterTransition` 标 `cut` 与 notes 论证的 `wipe` 不一致。 ★ 2026-10-03：成片真峰值已修（-0.6 dBFS → −2.60 dBTP，音频重混），见第 11 节。

**本次为补齐短板做了什么**：未改动 `D:/lemo-opuscar` 下源码、未改 `lemo-make.mjs`、未起渲染或 TTS（GPU 独占）。仅新增本目录两份交付物；短板如实记录在第 11 节，留给后续迭代。
