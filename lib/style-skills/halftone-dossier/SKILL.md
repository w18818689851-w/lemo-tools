---
name: lemo-style-halftone-dossier
description: 【lemo 风格 Skill · 复古半调案卷】把题材装订成一份复古印刷的案卷——米色档案纸、套印半调网点、错位阴影的巨型标题、会砸下的橡皮图章，适合讲「一个主题的罪状/展品/结论」这类可被逐条读出的内容。选定本风格做视频时，优先读本文件。
slug: halftone-dossier
name_zh: 复古半调案卷
category: 印刷与排版
film: Case File: Chubby
---

# 复古半调案卷（`halftone-dossier`）· 风格制作 Skill

> **用途**：选定本风格后，**优先读这份文档**作为核心参考。
> **目标不是逐帧复刻样本**，而是**对齐风格特质、复用它的制作思路 / 视觉元素 / 编排手法**。
> **资料源**：`styles/halftone-dossier/STYLE.md` · `styles/halftone-dossier/DEMO.md` ·
> `lib/style-dna/halftone-dossier.json` · `lib/style-dna/halftone-dossier.md` · `lib/dub-styles.json#halftone-dossier` ·
> `styles/halftone-dossier/style.json` · demo 源码 · **成片逐帧拆解**（见文末「蒸馏证据」）。

---

## 1. 风格说明

**是什么**：一部复古印刷的**案卷片**——米色档案纸、几种平涂油墨套印的半调网点、带错位阴影的巨型粗体标题、会「啪」地砸下的橡皮图章、粗描边的角色；片子本身就是一份**一件件被读出来的证据**的卷宗（`STYLE.md:3`）。

**不是什么**（最容易做错的邻居风格）：不是 Risograph（整个观感不是颗粒双色 riso、不是 zine 拼贴）；不是 Swiss motion（不是白底网格动态字体）；不是 Game Show Flat（不是糖果布景、不是节奏游戏回合）。**每一帧都必须看得见网点、纸和图章**（`STYLE.md:13`）。

**什么时候用它**：讲**可被逐条列出**的题材——一个习惯/产品/人物/现象的「罪状」、几项证据、一份检查结论；**三个展品约 30s，五个约 60s**（`STYLE.md:110`）。

**一句话内核**：整片是一张纸，明暗来自点的大小与套印，判决是一次物理猛砸（`STYLE.md:9,26`）。

**边界**：撑不起需要连续叙事、真实影像、温柔抒情的内容——本风格是「官僚式严肃 vs 可爱/琐碎对象」的喜剧气质，靠卡片推进，没有旁白（`style-dna/halftone-dossier.md:124`）。

---

## 2. 画面构图

- **镜头数与画幅**：10 个 `scene`，2D 摄影机（`#cam` 组，无 3D）。原生 **16:9（1920×1080）**；★ **2026-10-04 已声明多比例**（见下）。
- **主体位置与占比**：像印刷页一样——**标题左上**（x ≈ 120–170）、**主体右中**、**字幕条底部居中（y = 980）**、**HUD 在四角**（`DEMO.md:43`）。巨型半调数字（700–760px）出血到右边缘。
- **负空间 / 留白**：米色纸面就是留白；密度靠**点的大小**而非灰度——光晕 `radial`、边缘拥挤 `edge`、自上而下线性渐变三种密度场。
- **图层叠放顺序**（从底到顶）：`#cam > #world`（场景 SVG）→ `#hud` → `#wipe` → `#flash` → `#fade` → `<canvas id="paper">`（multiply 纸层）→ `<canvas id="fx">`（每帧颗粒）（`DEMO.md:159`）。
- **安全区**：标题左上、主体右中、字幕条底部居中、HUD 四角；暗场 HUD 反色、标题卡隐藏 HUD（`DEMO.md:108`）。
- **本风格**不能**出现的构图**：渐变、透明度渐变（明暗只能来自点大小与套印）、超过五种油墨加纸、100% 白闪（读成掉帧，封顶 ~0.5）（`STYLE.md:30,100,102`）。

**★ 2026-10-04：已支持多比例（页面外壳等比装入）**。改造**没有**逐处改写绘制点（本风格绘图**内联在 `index.html` 的 1090 行 `<script>` 里**、**没有独立 `film.js`**，且 `#stage` SVG 与 `#paper`/`#fx` 两张 1920×1080 画布全是绝对像素，逐处改必然静默错位），而是只改**一个页面外壳文件** `demo/index.html`：影片本体仍按**固定设计帧 1920×1080** 画（一字未改），当前帧（= 渲染视口）不是 1920×1080 时，把**整张设计帧等比装入**（contain）并居中，留边露出页面底色 `#F4ECDD`（本风格的米色纸底）。声明在**新增的薄壳** `demo/film.js`（`FILM_META.aspects`，控制台按源码文本探测——它只扫 `demo/film*.js`，而本风格原本一个都没有）。`FILM_META.aspects = ['16:9','9:16','3:4','4:3','1:1']`。

- **16:9 逐字节不变**：1920×1080 时外壳**完全不碰 DOM**（不建包装层、不设 transform、不改 body 尺寸）；改造前/后同参渲三帧（15%/50%/85%），**跨进程 md5 逐字节相同**。
- **9:16 不裁切**：出血到右边缘的巨型半调数字、右中主体、右上 REC/日期 HUD、左上标题与案号、底部字幕条**全部在画面内**（实测：9:16 vs 16:9 中心裁切 SSIM 0.45–0.54，vs 理想等比装入 SSIM 0.960–0.982）。
- **已知代价**：① 竖屏下有效画面只占 1080×607，**分辨率按紧轴缩放**——本风格主体是**半调网点**，缩放后细网点会与像素栅格产生**摩尔纹**（这也是「理想装入 SSIM」略低于其它两档的原因）；② 暗场（深蓝底 + 网点）与米色纸底留边对比强烈，纸边明显；③ 其它比例同理（3:4 / 4:3 / 1:1 已支持）。

---

## 3. 配色体系

| 角色 | 色值 | 用途 | 来源 |
|---|---|---|---|
| 纸 | `#F4ECDD` | 亮场背景（暗场也印在纸上） | `DEMO.md:71` |
| 深墨 | `#1D2340` navy | 所有描边、正文、字幕条、淡出色 | `DEMO.md:72` |
| 蓝 | `#2E55D6` | 标题底、光晕点、表格、一层墨 | `DEMO.md:73` |
| 粉 | `#FF5A87` | 强调、错位阴影、字幕条偏移、判决图章 | `DEMO.md:74` |
| 黄 | `#FFC628` | 关键词、数字、星爆、文件夹 | `DEMO.md:75` |
| 橙 / 深橙 | `#F58A34` / `#D9621E` | 角色毛 / 条纹 | `DEMO.md:76` |
| 奶油 | `#FFF4E2` | 肚子、爪子、暗底上的字 | `DEMO.md:77` |
| 红 | `#E8384F` | 图章、"17"、REC 点 | `DEMO.md:78` |
| 夜 / 夜2 | `#18203F` / `#2A3568` | 夜场背景 / 夜场点 | `DEMO.md:79` |

- **明度 / 对比规则**：**一张纸 + 一种深墨 + 四到五种平涂专色**；深墨承载所有描边与正文；一种墨做**套印阴影**（错位）、一种做**高亮**（关键词/数字）、一种暖红留给图章与警报（`STYLE.md:28-29`）。
- **禁止出现的颜色**：渐变与透明度渐变；超过五种油墨加纸（会失去印刷感）（`STYLE.md:30,102`）。
- **同一画面最多几个色相**：夜场/「秘密」场切到深墨底 + 同色系更亮的点层，仍被纸层 multiply（`STYLE.md:31`）；角色可拥有一两个专属局部色（毛色、衣服）不出现在别处。

---

## 4. 转场规则

- **镜头之间怎么切**：**点状擦除**为主——80px 网格的圆点长到 r=62 全盖再缩回，约 0.44s，居中在每个切点、带对角延迟；每个切点可有自己的擦除颜色（`WIPES`）（`STYLE.md:54`, `DEMO.md:55`）。
- **有没有叠化 / 闪白 / 擦除 / 定格**：有**点状擦除**与**闪帧**（白覆盖 ≤0.95→0，大击封顶 0.5，用于 mugshot / 判决 / 找到证据）；**硬切是对比手段**（demo 在 22、24s 的 drop 上用硬切）（`STYLE.md:54,65`）。
- **硬切点怎么定**：**每次剪辑都落在小节线上**（120 BPM，一小节 2s）；demo 弧每拍切一次（`DEMO.md:29`）。
- **转场时长与缓动**：点状擦除 0.44s；进入用 back ease 过冲（1.9）0.3–0.45s；**没有任何慢淡入**（`STYLE.md:49`）。
- **绝对不要的转场**：溶解 / 叠化（`STYLE.md:71`）；点状擦除没盖满就切场（会露出硬切）（`STYLE.md:99`）。

---

## 5. 字幕样式

| 项 | 值 |
|---|---|
| 字体 | 标题 **Noto Serif SC 900**；展示/数字 **Bagel Fat One**；插入词 **ZCOOL KuaiLe**；数据/HUD **JetBrains Mono 800**；字幕与图章 **Noto Sans SC 900** |
| 字号（相对画面宽 / 高） | 标题 100–230px（≈5.2–12% 画面宽）；字幕条 46px；图章 120–210px；巨型数字 700–760px |
| 颜色 / 描边 / 阴影 | 标题 navy 填充 + **错位阴影 +8/+8**（粉或黄，multiply）；插入词 cream 填充 + 16px navy 描边 + 蓝偏移阴影 |
| 位置 / 安全边距 | 标题左对齐 x ≈ 120–170；**字幕条底部居中 y = 980**（navy 圆角胶囊 r14 + 粉偏移阴影 +8/+8） |
| 单行字数上限 / 最多行数 | 中文标题/字幕 2–20 个 CJK 字（最短 `喵。`/`结案`，最长约 17–20 字）；拉丁约 2–3× 长 |
| 出现与消失方式 | 标题**逐字弹出**（每字掉落 30–100px + 压扁，错开 0.05–0.08s、小字 0.02s）；字幕条在标题后约 1s 弹出（0.4s、略 −1.2° 倾斜），停到该场结束（≥1.8s） |

- **字幕与旁白的关系**：**卡片就是字幕**——每拍一个标题，罪状类再配一条字幕条，**关键词用黄或粉**（tspan）。样本片屏上全中文、**无旁白**（`DEMO.md:8,107`）。
- **本风格特有的字幕禁忌**：不做成细的通用 caption；不用长句/从句/第一人称抒情与评论；**绝不在文字上加线条沸腾**（会把字抖到不可读）（`style-dna/halftone-dossier.md:49,154`）。

**文案+风格通路的底衬落地**：STYLE.md §4 声明「a dark-ink rounded pill with an overprint-ink offset shadow」，但「文案+风格」通路原先只走 `BorderStyle=1`（只画描边与阴影、不画底盒；盒填充字段 `OutlineColour` 被当作描边色用），这层底衬从未画出来。现已切到 `BorderStyle=3`（不透明底盒：盒填充色改用 `OutlineColour`、`Outline` 变为盒内边距，`BackColour` 仍只作阴影色——box 模式下 `Shadow=0`，故该阴影不绘制），渲染参数固定为 `BorderStyle=3`、盒内边距 `Outline=10`（1080 高基准）、`Shadow=0`、盒填充色 `OutlineColour=#001D2340`（AARRGGBB，落盘 ASS 为 `&H0040231D`）。`Shadow=0`：`BorderStyle=3` 下 ASS 的阴影是一份与底盒几乎完全重叠的整盒副本，会把半透明底衬二次压暗（实测 `hd-2d` 的对比度由 6.00 掉到 3.18）；置 0 后底衬的不透明度如实生效，也与检查器的单层合成模型一致。**底衬色与字色取自 demo 的真实实现**：该风格 `STYLE.md §4` 明确规定了底衬与字色的深浅取向（见上方原句），而此前配置正好相反；现已把 `palette.subtitle` 与 `subtitle.plateColor` 一起换成 demo 那一对。字色 `#F4ECDD` 与该底衬 `#001D2340` 的 WCAG 对比度 **13.09**。

---

## 6. BGM / 音效特征

> ★ **本风格的配乐是它自己的 `music.py` 真跑出来的**（纯 numpy/scipy 代码合成、无第三方素材、seed 7 确定性），与另两个风格不同——**不是占位**。本次成片音频轨实测 **−13.8 LUFS / 峰值 0.4 dBFS**（见第 11 节的响度缺陷）。★ 口径更正：上述 `峰值 0.4 dBFS` 是 `ebur128` 的 1 位小数读数、口径不同，不能当真峰值引用；**成片真峰值 = `loudnorm` 的 `input_tp`，4× 过采样 = +0.43 dBTP**。 ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 **→ −2.06 dBTP**（后经 2026-10-05 复跑、入库版再测为 **−3.26 dBTP**）、已在 −1.2 dBTP 交付线内；本条判语为**修复前**状态，保留作历史。

- **配乐**：**120 BPM、一小节 2 秒、C 大调每小节一个和弦（`PLAN`，15 小节）**。乐器：synth kick/snare/clap/hat、方波式八分 bass、三角波 pad、**马林巴式 `pluck`**（基频 + 3.99× 泛音）主旋律 + 轻八度回声；`pizz` 拨弦与指响做潜行（第 6–7 小节 = Count 02）；军鼓滚 + 上升正弦扫做 build（第 10 小节 = 总结）（`DEMO.md:60`）。
- **拟音（foley）**：按印刷与笑点——每个标题字一个 pop、头探出来的 boing、每个图章的 `stamp()`（音高下坠 boom + click，大图章加 crackle）、mugshot 的 `shutter()`、合成的 `meow()`（共振峰 /i/→/a/→/u/）、杯子 `clink`、破碎 `crash_glass()`、每次擦除前的 whoosh、猫躺键盘的 `plop` + 一串 `key_click`、"太可爱了" 的 `sparkle`（`DEMO.md:61`）。
- **旁白处理**：无旁白（可选，若有则用干、冷静的播报声，绝不喘气）（`STYLE.md:78`）。
- **响度目标**：`−14 LUFS`、真峰 ≤ −1 dB（`STYLE.md:79`）；**本次实测 −13.8 LUFS / 峰值 0.4 dBFS，未达 −1.2 dBTP 目标**（`_distill/logs/halftone-dossier.log:61`）。（口径更正：`峰值 0.4 dBFS` 是 `ebur128` 的 1 位小数读数、口径不同，真峰值以 `loudnorm` 的 `input_tp`、4× 过采样 **+0.43 dBTP** 为准） ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变），真峰值 +0.43 dBTP → **−2.06 dBTP**（后经 2026-10-05 复跑、入库版再测为 **−3.26 dBTP**）、已在 −1.2 dBTP 交付线内（达标）；原 +0.43 dBTP 记录保留为历史。
- **静音策略**：**判决图章之前把音乐清空**，让图章独自落下——demo 的 drop 把第 11 小节前半留空，判决图章在 23.0s 单独落地（`DEMO.md:60`）。

---

## 7. 素材偏好

- **需要什么素材**：**不需要任何外部图片/视频**——整片是一个自包含的 `demo/index.html`（SVG 场景图 + 两块 Canvas 2D 叠加层），全部由代码绘制；只需五个字体家族（Noto Serif SC / Bagel Fat One / ZCOOL KuaiLe / JetBrains Mono / Noto Sans SC，本地 woff2 切片 + `fonts.css`）（`DEMO.md:5,123-129`）。
- **不需要什么素材**：不需要真实照片、不需要胶片颗粒素材（颗粒是**印张上的灰**，不是 film grain）、不需要 TTS（本风格无旁白）（`STYLE.md:18`, `DEMO.md:59`）。
- **取景 / 质感 / 比例偏好**：纸层 96×54 随机小图放大做斑驳 + 逐像素噪声 ±13（−4 蓝偏暖）+ 径向暗角 `rgba(120,100,80,.35)` + x=960 淡折痕；颗粒层每帧 520 个纸色点（r 0.6–2.4）+ 90 个墨色点，每 2 帧重播种（`DEMO.md:86-88`）。
- **可替代方案**（缺素材时怎么降级而不破风格）：**字体缺失必须先解决**——布局用 canvas `measureText`，某个 unicode-range 切片没加载会用回退字体算逐字位置、字形重叠；`init()` 必须**两遍字体预加载**（对整个页面源码 + 对已构建 SVG 文本）并用 `font-display: block`（`DEMO.md:143-144`）。网点 step 不要小于 ~14px（1080p 下会在编码后摩尔纹）（`STYLE.md:101`）。

---

## 8. 镜头节奏

| 项 | 值 |
|---|---|
| 单镜时长 | 一拍 1 小节 = 2s；demo 弧：标题(1) → 指控 + 首个图章(1) → mugshot(2) → Count 01(2) → Count 02(2) → Count 03(2) → 总结 + build(1) → 判决图章(1) → 理由(1) → 结案 + 版权(2) |
| 全片时长 | **30.0s**（720 帧 @24fps；demo 原生 30fps/900 帧） |
| 镜头数 | 10 个 `scene`（标题 / 指控 / mugshot / 三个 Count / 总结 / 判决 / 理由 / 结案） |
| 信息投放节拍 | 120 BPM、一小节 2s、15 小节；**每次剪辑都落在小节线上**；一个想法一张 2–4s 卡片、一个大标题、一个笑点、一条字幕 |

- **加速 / 减速点**：第 10 小节 build（军鼓滚 + 上升扫）；第 11 小节前半 drop 留空 → 判决图章 23.0s 单独落地（`DEMO.md:60`）。
- **留白与静音的位置**：**判决前清空音乐**；夜场（Count 02）剥到 bass 与指响（`STYLE.md:77`）。

---

## 9. 制作参数清单

> 可直接抄的参数表。命令入口以 `styles/halftone-dossier/DEMO.md` 的 build notes 为准（本风格 demo 目录**没有 build.sh**）。

| 项 | 值 |
|---|---|
| 渲染入口 | `node core/render/video.mjs styles/halftone-dossier/demo --fps 24 --workers 6 --size 1920x1080 --out …`（demo 原用 `node render.mjs video 2`，Playwright headless Chromium） |
| 帧率 | 24fps（demo 原生 30fps；`index.html` 与 `render.mjs` 的 `FPS`/`DUR` 必须同时改） |
| 分辨率 / 比例 | 1920×1080 / 16:9（原生）；★ 2026-10-04 起支持 16:9 / 9:16 / 3:4 / 4:3 / 1:1（**页面外壳等比装入**，见第 2 节） |
| 混流 | `core/render/mux.sh`（→ nvenc；demo 原用 `node render.mjs mux`，x264 CRF 16 + music −1.6dB + AAC 256k/48k） |
| 编码器 | `h264_nvenc`（本地 GPU） |
| 音频入口 | `mix.py`（编排器的混音步入口，2026-10-05 新增的薄壳：无参数、调既有 `music.py`、输出 `demo/mix.wav`）→ 实际合成仍是 `music.py`（score + SFX + master，seed 7、确定性、≈2s） |
| 字幕入口 | 无生成器；`.srt` 由仓库旧文件沿用（列出卡片中文 + 英文对照） |
| 事件导出 | `node core/render/events.mjs styles/halftone-dossier/demo`（→ **events 0 条**；本风格 SFX 时间硬编码在 `music.py` 里） |
| 本风格专属参数 | ~~`--skip-audio`（lemo-make 侧跳过音频重生成，但 mix.wav 由 music.py 产出后被 mux 采用）~~ **★ 2026-10-05 起不再需要**（新增 `demo/mix.py` 后编排器自己能跑音频链）；渲染 720 帧 / 6 workers ≈ 26s |
| 一键复现 | 无 build.sh；按 DEMO.md 六步：fetch_fonts（仅换字体）→ music.py → stills 复审 → video → mux |

---

## 10. 编排规则

- **内容文件字段契约**（`content_fields`）：`index.html` 的 `C` 调色板与 `F` 字体；10 个 `scene(t0,t1,build)` 的字符串字面量（标题、字幕条、图章词、名牌/档案/文件夹文本）；HUD 的 `chips` 表 `[t0,t1,section,title]`；`WIPES`（每切点颜色）；`SHAKES`（冲击时刻）；`music.py` 的 `PLAN` 与 SFX 表；`fetch_fonts.mjs` 的 `fams` 与 `init()` 预加载表（`style-dna/halftone-dossier.md:165-169`）。
- **事件词汇表**：由 `music.py` 末尾的 SFX 表声明（时间从 `index.html` 抄来）：每标题字一个 pop、头探出的 boing、每图章 `stamp()`（`big=True` 加 crackle）、mugshot 的 `shutter()`、合成 `meow()`、杯子 `clink`、破碎 `crash_glass()`、擦除前 whoosh、猫躺键盘 `plop` + `key_click` 串、`sparkle`。**注意本风格不走 `events.json`**（`events.mjs` 导出 0 条）（`DEMO.md:61`）。
- **时间线契约**：全部在 `demo/index.html` 一个文件——`scene(t0,t1,build)`（build 建一次节点、返回 `update(t)`，用**绝对**时间）、`render(t)`、`init()`（两遍字体预加载 → `buildPaper()` → `buildAll()` → `window.READY=true`）。`render.mjs` 只依赖 `window.READY` 与 `window.render(t)`（`DEMO.md:175`）。
- **新增主体怎么接入**：用 `el/txt/tf/op/show`、`chars(...)`+`charsPop(...)`、`halftone(...)`（密度场 `radial`/`edge`，套印加 `class='mul'`）、`caption`+`captionAnim`、`stampEl`+`stampAnim`、`bg`；角色用 `catHead` + `setFace(cat,{...})` + `blinkAt` + 身体 `catSit/catRun/catLoaf/catCurl` + `runCycle`（换角色保留配方：7px navy 描边、平涂、cream 肚子、`boil` 滤镜、`setFace` 接口）（`DEMO.md:166`）。
- **换主题时要改哪些文件**：**把 `demo/` 复制到新目录、重写 `buildAll()`**（10 个 scene 的字符串 + `C`/`F` + `chips`/`WIPES`/`SHAKES`）+ `music.py`（`PLAN` 与 SFX 表）+ 长度同步改 `index.html` 与 `render.mjs` 的 `FPS`/`DUR`。
- **与 `dub.mjs` 通路的关系**：`lib/dub-styles.json#halftone-dossier` 生效参数——palette（bg `#F4ECDD` / bg2 `#1D2340` / fg `#1D2340` / accent `#CA0037`）、bgRecipe（gradient 双色 + **texture: halftone**）、subtitle（SimHei 粗体、fontSizeFactor 0.03704、marginV 0.14537）。

---

## 11. 当前短板与避坑要点

### 已知缺陷
- **★ 本次修了一个真 bug（不改画面，纯加性）**：`core/render/video.mjs` 的页面契约要求 `window.DUR`，而本风格 `index.html` 里 `DUR` 是脚本作用域的 `const`、没挂到 window，通用渲染器探到 `window.DUR === undefined` 直接 fail（`window.DUR must be a positive number of seconds`），**本风格因此一直出不了片**。已加一行 `window.DUR = DUR; window.FPS = FPS;`（`index.html:70`）修复，画面未动。
- **★ 音频这次是真配乐（非占位）**：`music.py` 纯 numpy/scipy 合成、120 BPM、一小节 2 秒、无第三方素材，本次就是跑它自己的 `music.py` 产出真实配乐。但**响度未达标**：实测 **−13.8 LUFS / 峰值 0.4 dBFS**，目标 −14 LUFS / TP ≤ −1.2 dBTP，mux.sh 报「missed the target…probably clipping or has very hot peaks」（`_distill/logs/halftone-dossier.log:61`）。（口径更正：`峰值 0.4 dBFS` 是 `ebur128` 的 1 位小数读数、口径不同，真峰值以 `loudnorm` 的 `input_tp`、4× 过采样 **+0.43 dBTP** 为准） ★ **2026-10-03 已修**：成片已用 `scripts/fix-truepeak.mjs` 音频重混（`-c:v copy`，视频流逐字节未变、帧数与时长不变），真峰值 +0.43 dBTP → **−2.06 dBTP**（后经 2026-10-05 复跑、入库版再测为 **−3.26 dBTP**），已在 −1.2 dBTP 交付线内；音频评分回补 +4（见第 10 节）。
- ~~**9:16 硬渲会丢画面**：无 `aspects` 声明，产品默认 9:16 导出时右侧约 43.75% 丢失、下方黑边；出血数字与右中主体全被裁掉。~~ **★ 2026-10-04 已修**：`demo/index.html` 加「设计帧等比装入」外壳 + 新增薄壳 `demo/film.js` 声明 `aspects`（5 个比例全支持），9:16 下整幅画面都在（见第 2 节）。残留代价：竖屏有效画面只占 1080×607、半调网点缩放会摩尔纹。
- ~~**走不了编排器的音频链**：本风格没有独立的混音脚本，而 `lemo-make.mjs` 的混音步只按 `mix.py` / `sound.py` / `audio/mix.py` 三个**文件名**找脚本，一个都找不到就 `STEP_FAIL 该 demo 没有 mix.py / sound.py / audio/mix.py —— 它用的是另一套音频架构` 并 `exit 1`（`lemo-make.mjs` 的混音步）⇒ 本风格只能 `--skip-audio` 复用仓库里那份旧的 `demo/mix.wav`，走不了标准「主题出片」通路。~~ **★ 2026-10-05 已修**：新增薄壳 `demo/mix.py`（**不接受命令行参数**、用同一个解释器 `subprocess` 调既有 `music.py` 并把输出路径指向 `demo/mix.wav`；不重写任何配乐逻辑、不碰视频、幂等），编排器混音步现已命中本风格 —— 实测 `MIX_OK 5292044 …/styles/halftone-dossier/demo/mix.wav`，随后 `MUX_OK 46164256 src_frames=720 out_frames=720`，成片 1080×1920 / 30.00s / 真峰值 −2.79 dBTP / −14.24 LUFS（两条交付口径都达标）。**不再需要 `--skip-audio`**。（★ **原记**：上述 −2.79 dBTP 是那次复跑产物的读数；当前入库成片实测真峰值 **−3.26 dBTP**（`loudnorm` `input_tp`，4× 过采样）、达标。）★ 这条缺陷原本**没有**独立扣分项（`_distill.json#defects` 里从未记过它、也无 `【audio −N】`），故 `scoreBreakdown` / `matchScore` 不变。
- **本 demo 没有 build.sh**，一键复现只能照 DEMO.md 六步手动走。
- **events.json 为 0 条**：本风格 SFX 不走事件导出，时间硬编码在 `music.py`；字幕源未重新生成（沿用仓库旧 .srt）。 ★ 2026-10-06 复核：本条与本批次（第五十三批）改的**编排器第 3 步字幕告警措辞**无关——本条不引用该告警；其主张的「字幕源未重新生成、沿用仓库旧 `.srt`」由**第 6 步混流**实测确认（`_distill/logs/halftone-dossier.log:74`：「本 demo 没有本次新生成的字幕源 —— .srt 沿用仓库里已提交的旧文件，未重新生成」；本 demo 无任何字幕生成器）⇒ 属**真实缺陷**，仍成立，评分不变。

### 素材缺口
- 五个字体家族（Noto Serif SC 900 / Bagel Fat One / ZCOOL KuaiLe / JetBrains Mono 800 / Noto Sans SC 900）必须本地 woff2 就位；缺任何一个都会导致逐字位置算错、字形重叠。

### 能力限制
- 依赖 Playwright + headless Chromium；720 帧 / 6 workers ≈ 26s（demo 原 900 帧 ≈ 2 min with 2 workers）。
- `<clipPath>` id 是全局的——每个被裁剪的数字/表格都要唯一 id（`num01`/`num03`/`tclip`）（`STYLE.md:97`）。
- 时间窗场景：某元素在它的 cue 之前必须显式 `op(…,0)`，否则会在窗口外可见（`STYLE.md:98`）。
- `demo/stills/t_*.png` 里有一部分早于纸纹理（0.5–7.1s 看起来是平的）——**成片与新渲染一致，不与那些早期静帧一致**（`DEMO.md:150`）。
- `index.html` 里有未使用的残留（`#ink` 滤镜、`charsIdle()`、`E.elastic`），已定义但从未调用（`DEMO.md:151`）。

### 踩过的坑（本机实测）
- 本次出片走 `--skip-sync`（`_distill/logs/halftone-dossier.log:1,21`）。~~lemo-make 的步骤 [4] 是 `--skip-audio`，但 `demo/mix.wav`（由 `music.py` 产出、30.0s）仍被 mux.sh 采用，所以成片有真实配乐（`_distill/logs/halftone-dossier.log:56-61`）。~~ **★ 2026-10-05 起不再需要 `--skip-audio`**：新增 `demo/mix.py` 薄壳后，编排器会自己跑「配乐 → 混音」（`music.py` → `demo/mix.wav`，30.0s / 5,292,044 B），成片音轨仍是有真实配乐的那一轨。
- 混流走 WSL 的 `mux.sh` + nvenc（GPU）。★ 2026-10-05 复跑：`core/render/mux.sh` 的「编码后复核闭环」从 `LN_TP = −1.7` 起步、逐档下调 TP 目标重编（本片用到第 8 档 `−3.45`），最终成片真峰值 −2.79 dBTP、响度 −14.24 LUFS，**不再出现**「missed the target」告警（旧记录里那条告警对应的是固定 `LN_TP` 时代）。（★ **原记**：上述 −2.79 dBTP / −14.24 LUFS 是该次复跑输出的读数；当前入库成片（1920×1080 / 39,613,063 B）实测真峰值 **−3.26 dBTP** / **−14.26 LUFS**（`loudnorm` `input_tp`，4× 过采样）、达标。）

### 下次迭代优先补什么
- 把 `music.py` 的母带峰值归一从 ×1.6 下调（或在 mux 前再降 1–2 dB），使集成响度回到 −14 LUFS、真峰 ≤ −1.2 dBTP。

---

## 蒸馏证据

| 项 | 值 |
|---|---|
| 蒸馏日期 | 2026-10-03 |
| 成片 | `D:/lemo-films/halftone-dossier/halftone-dossier.mp4`（30.00s / 37.7MB） |
| 抽帧 | `D:/lemo-tools/_distill/frames/halftone-dossier/`（15 帧 + 接触印样） |
| 风格匹配度自评 | **91/100**（2026-10-05 校正：原 89，9:16 画幅缺陷已修并回补 composition +2）（2026-10-03 校正：原 85，音频真峰值缺陷已修，audio +4） |
| 详细资料 | 有（STYLE.md / DEMO.md / style-dna md+json / dub-styles / style.json / music.py / index.html 关键行 / halftone-dossier.log） |

**逐帧拆解要点**：f01 标题首帧——蓝底（`#2E55D6`）满幅半调网点（右上角点更密、向中心变稀），中央奶油色 Bagel Fat One「CHU」带 navy 偏移阴影，右上角 JetBrains Mono「CASE FILE · 2026」。f02 标题卡——「CHUBBY」大字落定、橘猫头从字母后探出，下方中文副标题「胖橘 · 一份来自铲屎官的起诉书」。f04 mugshot——米色纸底 + 左侧身高尺刻度，橘猫正面居中、蓝粉双色半调光晕在它身后，脚下 navy 名牌「PANG JU, O.」。f06 同场续帧——左侧巨型「99+」（Bagel Fat One，粉红套印），右侧 profile 文字块，左上 HUD「案卷 No.2026-CAT-001」+ 章节 chip。f11 夜场 Count 02——切到深墨底（`#18203F`）+ 同色系更亮点，左上中文标题「凌晨四点跑酷」，右上黄色数字时钟「04:00」，床与猫剪影，底部 navy 字幕条「每晚 4:00 准时开跑，从不迟到。」（「从不迟到」黄字高亮）。f13 同场续帧——猫在床上奔跑（`runCycle`）、速度线。f15 Count 03——回到米色纸底，标题「代写周报」、笔记本上打满乱码、右侧巨型粉红半调「3」、右上黄便签「18:00 必须交！」、猫趴在键盘上。全程可见网点、纸纹与套印错位；转场为点状擦除（部分硬切）；无渐变、无柔阴影。

**自检发现的缺陷**：音频响度未达标（−13.8 LUFS / 峰值 0.4 dBFS，该值为 `ebur128` 1 位小数读数，真峰值以 `loudnorm input_tp` 4× 过采样 **+0.43 dBTP** 为准）；9:16 不支持；无 build.sh；events.json 0 条；字幕源未重生成。 ★ 2026-10-03：成片真峰值已修（+0.43 dBTP → −2.06 dBTP，音频重混；后经 2026-10-05 复跑、入库版再测为 **−3.26 dBTP**），见第 11 节。

**本次为补齐短板做了什么**：给 `index.html` 加了一行 `window.DUR = DUR; window.FPS = FPS;`（`index.html:70`），修复通用渲染器的 `window.DUR must be a positive number of seconds` 契约缺失——**纯加性、不改画面**，本风格因此首次出片成功。
