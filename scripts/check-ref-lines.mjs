#!/usr/bin/env node
/**
 * scripts/check-ref-lines.mjs —— **散文/源码里的 `<路径>:<行号>` 引用会不会随行号漂移而失效**
 *
 * ★ 由来（2026-10-06，本会话**连撞三次**）：
 *   `scripts/check-film-aspect.mjs` 的两处注释引用 `` `scripts/style-distill.mjs:189` ``
 *   （`--ratio 16:9` 所在行）。我改了 `style-distill.mjs` 之后它漂到 `:305`，
 *   把三处（`check-film-aspect.mjs:66`、`:105`、`test/README.md:602`）改成 `:305`；
 *   **同一轮里**又改了一次，它漂到 `:331`，那三处**再次全部失效**。
 *   ⇒ 只要有人在被引文件**上方插删行**，所有 `<路径>:<行号>` 引用就**静默失效**，
 *   而**当时 28 个闸门没有一个看得见**。
 *   这正是本项目纪律第 ⑦ 条「凡『引用外部对象』的字段（路径/帧号/行号/md5）都要有闸门核它真的存在」
 *   一直空着的那一格。
 *
 * ── 判据（三层）─────────────────────────────────────────────────────────────
 *   引用形态：**反引号包裹**的 `` `<路径>:<行号>` ``，路径**带扩展名**；
 *   行号可写成 `N`、`N-M`、`N/M/…`，以及**逗号分隔的行号组** `N-M,K,…`
 *   （`story.js:1-6,66` ⇒ 拆成 `1-6` 与 `66` 两段，**每段都核**）。
 *   ★ 2026-10-06 补：逗号形态此前**整个不被识别**（旧正则 `((?:[-/]\d+)*)$` 里没有 `,`）
 *     ⇒ 这类引用**不计数、不核对**（实测 `scifi-toon/SKILL.md:76` 的 `` `story.js:1-6,66` ``）。
 *     先摸真实语料（`grep … | grep ','`）确认逗号在引用里**清一色**是行号分隔（
 *     `DEMO.md:52,80`、`STYLE.md:12,65`、`edit.py:1-4,27`…），**不是**别的语法
 *     ⇒ 才把 `,` 并进分隔符集合（仍锚 `^…$` 整串匹配，`a.js:1,b.js:2` 这类**不会**误吃）。
 *
 *   (a) **文件存在**：路径解析不到 ⇒ FAIL（报 出处 file:line + 原片段 + 试过的根）。
 *       ★ **路径感知**解析（**不做全仓 basename 模糊匹配** —— 那样会命中**错文件**，
 *         实测：`main.js:566` 曾被解析到另一个只有 11 行的 `main.js`，把真问题掩盖成「行号超范围」）：
 *       ① 文档**所属风格**的源码树（`<styles>/<slug>` 与其 `demo/`）；
 *       ② 文档自身目录；③ 仓根与常见子目录（`scripts/ lib/ test/ _distill/ core/ tools/`）；
 *       ④ 所属风格树内**按相对路径尾段**唯一命中（`plate.js` → `<slug>/demo/engine/plate.js`）；
 *       ⑤ `styles/` 全树尾段**唯一**命中。
 *       ★ 「全库」= **`styles/` 全树**，**不是整个仓** —— 按**文件名**找只搜 ①④⑤ 这几处，
 *         不搜 `core/`、`scripts/`、`tools/`（那些只在**带目录**的路径下被直接拼路径试过）。
 *         报错文案必须如实说这件事（见下 `missing` 分支），否则会让人去"找一个其实存在的文件"。
 *       · 风格级文档（SKILL.md / STYLE.md / DEMO.md）：本风格树内找不到 ⇒ **FAIL**
 *         （`styles/` 树里同名文件再多也**不属于本风格** —— 实测 `hd-2d` / `paper-lantern` 引用 `mux.sh`，
 *         而这两个风格**根本没有** `mux.sh`）。
 *       · 非风格级文档（`test/README.md` / `AGENT-BRIEF.md` / `MAINTAINING.md` 等）：
 *         `styles/` 树里多处同名且文档没给更多线索 ⇒ **不判 FAIL**，单列「引用不唯一，无法核对」
 *         （那是**文档写得太省**，不是引用失效）。
 *
 *   (b) **行号在范围内**：行号 > 该文件总行数 ⇒ FAIL。
 *
 *   (c) ★ **内容对得上**（本条误报率最高，**先测再收窄**，见下「误报率实测」）。
 *       仅当引用**所在小句内**、且**与引用字符距离 ≤ 40**处存在一个**高置信代码片段**时才判：
 *       要求该片段（或其**全部 token**）出现在**被引行区间**里；都出现不了 ⇒ FAIL。
 *       · 「高置信形态」（只认这四类，**不认**裸标识符单词）：`--flag[ value]`、`#rgb/#rrggbb`、
 *         `标识符 = 值` / `标识符: 值`、`名字(...)`。
 *       · 排除：引用自身、其它 `<路径>:<行号>` 引用、路径形态、含 CJK、含 `…`、纯风格 slug、长度 < 3。
 *       · 匹配用 **token 匹配**（按非字母数字切 token，长度 ≥2）：**全部 token 命中** ⇒ 通过；
 *         否则只要有一个**含数字的 token**（具体值，如 `1700` / `16:9` / `1d3a9c`）命中 ⇒ 也通过。
 *       · 小句里没有这样的片段 ⇒ **只做 (a)(b)**（**明确写进已知局限**，不是「悄悄退化」）。
 *
 *   (d) ★ **被引行本身没有内容**（2026-10-06 补，见下「(d) 的由来与误报率」）。
 *       被引行 `trim()` 之后是 **空行** / 是 **`---`（或 `***` / `___`）** / 是 **```` ``` ```` 围栏**
 *       / **行号 > 文件实际行数**（`split('\n')` 尾元素造成的**幻影行**）⇒ 报出。
 *       · ★ **只对单点引用生效**：区间引用（`a.js:10-20`）**不判** —— 区间**起点早一行**
 *         落在空行上是**无害写法**（实测 `art-deco/SKILL.md:106` 的
 *         `` `style-dna/art-deco.md:172-181` ``、`shadow-puppet/SKILL.md:101` 的
 *         `` `style-dna/shadow-puppet.md:216-235` ``、`test/README.md:581` 的
 *         `` `_distill/AGENT-BRIEF.md:423-428` `` 三处**全部**是这种形态，
 *         起点那一行是 `---`/空行，但区间覆盖的正文是真的）⇒ 判它们就是 3 处误报。
 *       · 逗号组（`a.js:52,80`）**每一段都当单点**逐段判（不含 `-` / `/` 就不算区间）。
 *       · 为什么 (b) 抓不住「幻影行」：`split('\n')` 对**以换行结尾**的文件会多出**一个空尾元素**
 *         ⇒ 118 行的文件 `lines.length === 119`，(b) 的 `maxN > lines.length` **放行** 119。
 *         (d) 用「**实际行数** = 去掉尾空元素后的长度」判，并**单独报幻影行**。
 *
 * ── ★ 误报率实测（2026-10-06，真实语料 137 份文档 / **3652** 处引用）──────────────
 *   判据是**先跑再收窄**的，实测数据（每层都真的跑过）：
 *   · **(c) 初版**（「小句内任取一个反引号片段，要求它是被引行的子串」）：
 *     候选 98 / FAIL **46**，逐条人工核对后**误报约 60%**（`--ratio 16:9` 在源码里写作
 *     `'--ratio', '16:9'`、`type=='cap'` 在源码里写作 `e['type']=='cap'`、
 *     `dur 133.0` 在 json 里写作 `"dur": 133.0`、`COL.cobalt = …` 在源码里是**裸对象字面量**……）
 *     ⇒ **不可用**。
 *   · 收窄① 「距引用 ≤40 字符」**但不限小句**：候选暴涨到 **646** / FAIL **363**
 *     （把邻句的片段也捞进来）⇒ **否决**（小句约束是必需的）。
 *   · 收窄② 「只认高置信形态 + 先排除引用自身」：候选 **37** / FAIL **17**，逐条核对**误报 0**
 *     ⇒ **采用**。
 *   · 收窄③ 再把「子串匹配」换成「token 匹配」：又消掉 `type=='cap'`、`OUT='out/mix.wav'`、
 *     `COL.cobalt = '#1d3a9c'` 三处**已知误报**（见上）⇒ 最终候选 **37** / FAIL **14**。
 *   ★ **不收窄成「只查 (a)(b)」**：(c) 是唯一能抓住「行号对、但那一行已经不是它说的东西」的判据，
 *     恰恰是**本闸门要治的形态**（`style-distill.mjs:305` 的行号**在范围内**，只是内容不对）。
 *
 * ── ★★ (d) 的由来与误报率（2026-10-06 补）─────────────────────────────────────
 *   **盲区（一次只读审计逐条人读 115 处后实测出）**：全库 2545 处「散文对散文」引用里，有
 *   **10 处**被引行其实是**空行 / `---` / 文件末尾的幻影行** —— 而 (a)(b)(c) **三条全部放行**：
 *   文件在（(a) 过）、行号在范围内（(b) 过）、小句里没有代码片段所以 (c) **根本不判**。
 *   实证：`art-deco/SKILL.md:84` 引 `style-dna/art-deco.md:16` ⇒ 第 16 行是 `---`（真内容在 41 行）；
 *   `blueprint/SKILL.md:68` 引 `STYLE.md:119` ⇒ 该文件**只有 118 行**，119 是 `split('\n')` 的**幻影空元素**；
 *   `whiteboard/SKILL.md:153` 引 `style-dna/whiteboard.md:101` ⇒ 空行（真内容在 **191** 行）。
 *   ⇒ 这类失效**只靠「那一行有没有内容」就能判**，不需要读上下文、不需要比对内容。
 *
 *   **误报率（本判据真的跑过，两版都测）**：
 *   · **初版（不分单点/区间）**：命中 **13** 处，逐条核对 **3 处是误报** ⇒ 精度 **77%**。
 *     那 3 处**全是同一种形态**：**区间引用的起点早一行** ——
 *     `art-deco/SKILL.md:106` 的 `` `style-dna/art-deco.md:172-181` ``、
 *     `shadow-puppet/SKILL.md:101` 的 `` `style-dna/shadow-puppet.md:216-235` ``、
 *     `test/README.md:581` 的 `` `_distill/AGENT-BRIEF.md:423-428` ``：
 *     起点那一行确实是空行/`---`，**但区间覆盖的正文是真的**（「从这一行往下看」是无害写法）。
 *   · **定稿版（只判单点引用）**：命中 **13** 处，**逐条核对 0 处误报** ⇒ 精度 **100%**，
 *     且 3 处已知误报**被结构性排除**（它们都是 `N-M`，`isRangeRef` 直接跳过）。
 *     ★ 同时保留召回：空行型失效**一个不漏**（审计的 10 处 + 本判据新发现的 3 处，
 *       含 `unblock-placeholder-audio.mjs:42`、`stage.js:5`、`film.js:198` 三处**代码文件**的）。
 *   ★ **结论：判 FAIL，不做成 backlog** —— 理由：
 *     ① 实测精度 **100%**（13/13 全是真失效，逐条定位到真内容在**别的行号**上，见下「真实语料命中清单」）；
 *     ② 与 (c) 不同，(d) **没有误报机制**：「被引行是空行/分隔线/围栏/不存在」这件事**没有任何一种
 *        合法读法**能解释成「我指的就是它」—— (c) 的误报来自**写法差异**（`'--ratio','16:9'` vs
 *        `--ratio 16:9`），(d) 没有这层歧义；
 *     ③ 唯一的已知误报源（区间起点早一行）**已被判据本身排除**，不是靠 backlog 兜。
 *   ★ **什么条件下要降级为 backlog**（写下来，免得以后凭感觉吵）：若将来在真实语料上出现
 *     「**单点**引用指向空行/`---` **且那是合法写法**」的实例 —— 典型是**有意引用段落边界**
 *     （如「本节到 `X.md:100` 为止」而 100 正好是 `---`）—— 那就是新的一类误报，
 *     届时先把该形态（引用所在小句含「为止/结束/边界」等）**排除**；若排除不掉、精度掉到 9 成以下，
 *     再整体降级为 `(d) 只列不判`。**在此之前判 FAIL。**
 *
 * ── ★★ (d) 的真实语料命中清单（2026-10-06 快照，13 处，**逐条人读、误报 0**）─────────
 *   每条格式：`文档:行` 引 `目标:行` ⇒ **被引行原文** ⇒ 判定 / 真内容在哪一行。
 *   ① `blueprint/SKILL.md:68` 引 `STYLE.md:119` ⇒ 幻影行（该文件**只有 118 行**，119 是尾空元素）
 *      ⇒ **真失效**；该句要的「剖面线 A–A 扫过画面」在 `STYLE.md:65`（同一行 69 引对了）。
 *   ② `hd-2d/SKILL.md:232` 引 `unblock-placeholder-audio.mjs:42` ⇒ **空行** ⇒ **真失效**；
 *      hd-2d 的曲目条目在**第 52 行**（`{ slug: 'hd-2d', placeholder: true, … }`）。
 *   ③ `hd-2d/SKILL.md:292` 同上（同一行号的第二处引用）⇒ **空行** ⇒ **真失效**，真内容同为第 52 行。
 *   ④ `iso-infographic/SKILL.md:70` 引 `STYLE.md:65` ⇒ **空行** ⇒ **真失效**；该句要的
 *      「换一块板 / 开一个圆形插图」在 `STYLE.md:64`（表行 Switch boards）或 `:66`（Framing 段）。
 *   ⑤ `pictogram-motion/SKILL.md:37` 引 `demo/music/report.txt:5` ⇒ **空行** ⇒ **真失效**；
 *      要的「79 个镜头」在**第 4 行**（`Shots in timeline: 79   gaps (pre-hit silences): 11`）。
 *   ⑥ `pictogram-motion/SKILL.md:106` 引 `report.txt:5` ⇒ **空行** ⇒ **真失效**；要的「11 处 pre-hit gap」
 *      与 ⑤ 同在**第 4 行**。
 *   ⑦ `silent-film/SKILL.md:37` 引 `demo/stage.js:5` ⇒ **空行** ⇒ **真失效**；要的「片门圆角 r=22 / 柔和暗边」
 *      在 **46–52 行**（`const r = 22 * S; … roundRect(…)` 与两条渐变暗边）。
 *   ⑧ `spy-titles/SKILL.md:71` 引 `STYLE.md:111` ⇒ **空行** ⇒ **真失效**；该句是
 *      `lib/style-dna/spy-titles.md:111` 的**逐字改写**（真出处就在那儿，引用写错了文件+行号）；
 *      `STYLE.md` 里最接近的是 45（stop-time）/ 46（shattering）。
 *   ⑨ `stained-glass/SKILL.md:45` 引 `film.js:15` ⇒ 幻影行（该文件**只有 14 行**）⇒ **真失效**；
 *      `FILM_META.aspects = ['16:9','9:16']` 在**第 14 行**。
 *   ⑩ `stained-glass/SKILL.md:148` 同上（同一目标的第二处引用）⇒ **真失效**，真内容同为第 14 行。
 *   ⑪ `urban-sketch/SKILL.md:122` 引 `film.js:198` ⇒ **空行** ⇒ **真失效（弱）**；`camera(t)` 是
 *      **179–197 行**，198 正好是它 `}` 之后的空行（差 1 行，但读者在第 198 行**拿不到任何内容**）。
 *   ⑫ `whiteboard/SKILL.md:153` 引 `style-dna/whiteboard.md:101` ⇒ **空行** ⇒ **真失效**；
 *      要的「页面契约 `window.READY / window.render(t) / window.DUR / window.EV`」在 **191 行**。
 *   ⑬ `whiteboard/SKILL.md:154` 引 `style-dna/whiteboard.md:100` ⇒ **`---`** ⇒ **真失效**；
 *      要的「给标签留出「全在或全不在」的余量，避开推镜的切边」在 **179 行**（逐字相同）。
 *   ★ **口径说明**：这一批里 ⑤⑥⑦⑨⑩⑪ 的**目标不是文档而是源码**（`report.txt` / `stage.js` / `film.js`），
 *     说明 (d) 治的不只是「散文对散文」——审计那 10 处只在文档之间，而 (d) 连**文档→源码**的一起抓。
 *   ★ **快照性**：审计给的例子（`art-deco/SKILL.md:84` 引 `style-dna/art-deco.md:16`）在本轮跑时
 *     **已被另一个智能体改成 `:41`**（现指向真内容）⇒ 语料在动，本清单是**某一时刻的快照**，不是永久名单。
 *
 * ── ★★ 2026-10-07 扩扫描范围：纳入 `lib/style-skills/<slug>/_distill.json` ──────────────
 *   **盲区**：`DOCS` 此前**只含 `.md`**，而 `_distill.json` 的 `defects` / `resolvedDefects` /
 *   `limits` / `assetGaps` 文本里**确实有**同样的 `` `<路径>:<行号>` `` 引用
 *   ⇒ 那些引用**没有任何闸门在管**（`.json` 里的引用此前是**零覆盖**）。
 *
 *   **实测（纳入前 → 纳入后，同一台机同一时刻）**：文档 **137 → 180** 份；引用 **3796 → 3813**
 *   （**+17**）；解析到文件 **3561 → 3575**（+14）；进入 (c) **38 → 41**（+3）；
 *   logs 豁免 **229 → 232**（+3）；**FAIL 0 → 0**。
 *   ⇒ 新增 17 处**全部通过 (a)(b)(d)**；逐条人工核对 **14 条有效 / 2 条真失效（弱）**
 *   （见下「`_distill.json` 命中清单」）⇒ **本次纳入的误报率 0**（0 命中即 0 误报）。
 *
 *   ★★ **判据口径：按「JSON 解析出的字符串值」判，不按「文件物理行」—— 但实测两者等价，
 *   故实现上不改主循环（仍按物理行扫）。** 理由：
 *     ① **语义单位**：一条 defect 是**一个完整段落**；JSON 里换行写作**转义的 `\n`（两个字符）**，
 *        所以「文件物理行」是**序列化产物**，与作者写的段落不是一回事（一条 defect 若跨物理行，
 *        物理行口径会把它的引用归到**错的出处行**上）。
 *     ② **实测等价**：43 份 `_distill.json` 共 **2510** 个字符串值，**每一个都完整落在单个物理行内**
 *        （`JSON.stringify(…, 2)` 把 `\n` 转义 ⇒ **1 值 = 1 物理行**）；用「解析值」口径与「物理行」
 *        口径跑出来的引用集合**逐条相同（17 = 17，出处与内容全一致）**。
 *     ③ ⇒ **不为 JSON 写第二套解析器**：那是**新增的复杂度**，且会让 JSON 的判据与 `.md` 的判据
 *        **分叉**（本闸门的价值恰恰在于「一处判据、全语料同口径」）。
 *     ★ **已知取舍**：若将来某份 `_distill.json` 被压成一行（或多行混排），物理行口径下
 *       `where` 报的出处行号会**不再等于**那一条 defect 所在行 —— 但**四条判据本身**全部作用在
 *       **被引的外部文件**上，**不受影响**，只是「出处」列的可读性下降。
 *
 *   ★★ **为什么 (a)(b)(c)(d) 对 `.json` 照样适用**：`_distill.json` 里的引用**目标是别的文件**
 *   （`.mjs` / `.js` / `.md` / `.txt`），**不是 JSON 自己** ⇒ 四条判据全部作用在**被引的外部文件**上：
 *   (a) 那个文件在不在、(b) 行号在不在它范围内、(d) 它那一行有没有内容、
 *   (c) 小句里的高置信片段在不在它那一行。与「引用写在 `.md` 还是 `.json` 里」**无关**。
 *   ★ `.json` 唯一的特有差异是**转义**（`\n` / `\\` / `\"`）—— 但**反引号不是 JSON 的转义字符**，
 *   所以 `` `<路径>:<行号>` `` 在 JSON 里**原样存在、无需反转义**（实测 17 处全是这种原样形态）。
 *
 *   ★★ **裸引用（不加反引号）明确不纳入 —— 先测再定，实测否决**：
 *   `_distill.json` 里还有 **390 处**「不带反引号的 `<路径>:<行号>`」（如 `sfx.py:9`、`mux.sh:115`）。
 *   按 (a)(b)(d) 判 ⇒ 命中 **3** 处，逐条核对 **误报 2/3（精度 ≈ 33%）**：
 *     ① `hd-2d/_distill.json` 的 `D:/lemo-tools/scripts/unblock-placeholder-audio.mjs:52`
 *        ⇒ 探针正则把盘符 `D:` 当分隔符吃掉 ⇒ **假 (a)**（真文件、真行号 `:52`，**该引用是有效的**）；
 *     ② `scifi-toon/_distill.json` 的 `sfx.py:9` ⇒ 判 (a) FAIL，而 `core/audio/sfx.py:9`
 *        **确实存在、且第 9 行正是它引的那句注释** ⇒ 这是**已知局限**（按文件名不搜 `core/`）的**误报**；
 *     ③ `pictogram-motion/_distill.json` 的 `mux.sh:115` ⇒ 解析到**同名的错文件**
 *        （`styles/pictogram-motion/demo/mux.sh`，22 行），而**不是**同一小句自己写明的
 *        `core/render/mux.sh` ⇒ 判 FAIL 的**理由与落点都是错的**
 *        （虽然那条引用**真的**漂了：`noise=c0s` 在 `core/render/mux.sh:173`）。
 *   ⇒ 失败是**判据结构性**的：裸引用拿不到「同小句路径感知」（`siblingPaths` **只收反引号片段**），
 *     所以 ③ 这类「小句里写了全路径、引用本身只写 basename」必然解析到错文件。
 *     ⇒ **不纳入**。★ 正确修法是**让引用带反引号**（或先给裸引用补上路径感知）—— **那是另一件事**。
 *     ★ 这也**纠正**了任务书举的那一例：**`hd-2d` 那条根本不是反引号引用**，所以**本次改动管不到它**
 *     （它至今仍是盲区，且**现在已经是对的 `:52`**，没有真失效可修）；而这个盲区**在 `.md` 里同样存在**
 *     （见下「已知局限」第 2 条：解析器只认反引号包裹的引用）。
 *
 * ── ★★ `_distill.json` 命中清单（2026-10-07 快照，**逐条人读**）────────────────────────
 *   ★ 这 17 处引用**全部通过 (a)(b)(d)**（闸门 0 FAIL）。下面是我**人工读「内容对不对」**的结论 ——
 *     (c) 只在其中 3 处生效（且都通过），剩下 11 处的「内容对不对」本闸门**本来就看不见**（见已知局限）。
 *   · **有效 12 条**：`cel-anime-80s` 的 `demo/bg.js:46`（夜景三色 `#2a1f4a`/`#1f2446`/`#34203f` 都在该行）、
 *     `demo/hud.js:25,27`（`:25` = `strokeStyle='#120a1e'`+`lineWidth=9`、`:27` = `fillStyle='#fff0a0'`）；
 *     `hd-2d` 的 `harbor.js:14`（`sky({top:'#050818', mid:'#101d3e', hor:'#2c4262'})`）、
 *     `DEMO.md:52`（同三色）、`cliff.js:161`（`PointLight('#fff0c8')` = 正文说的「灯光色」）；
 *     `pixel-rpg` 的 `STYLE.md:74`（`−14 LUFS, grain 0`）、`DEMO.md:60`（`Mix to −14 LUFS`）；
 *     `stained-glass` 的 `demo/test.js:9`（`S.fillStyle='#2a2a2e'`）、`glass.js:7`（`cobalt: '#1d3a9c'`）、
 *     `window.js:45`（采石格默认 `COL.cobalt`）、`STYLE.md:33,39`（`:39` = `cobalt ground`）、
 *     `DEMO.md:74`（`cobalt \`#1d3a9c\` (dominant)`）。
 *   · **真失效（弱）2 条** ★ **已报未改**（按任务约定不动 `_distill.json`；改它要过 `check-skill-scores`，另事）：
 *     ① `hd-2d/_distill.json` 引 `ui.js:81`，正文拿它当 `#f6f0e2`（纸白）的**依据**；而 `ui.js:81` 是
 *        `function subtitle(t, v) {` —— 色值 `#f6f0e2` 在 **第 88 行**（同一函数体内，差 7 行）
 *        ⇒ 读者在 81 行**看不到那个色值**。(d) 抓不到（81 行**有内容**）、(c) 未生效
 *        （该小句里只有引用自身，没有高置信片段）⇒ **本闸门看不见**（与 (d) 清单 ⑪ 同形）。
 *     ② `cel-anime-80s/_distill.json` 引 `demo/bg.js:4`，正文写「accent `#ff4fa8`（霓虹洋红，
 *        `demo/bg.js:4` NEON[0]）」；而 `bg.js:4` 是 `export const NEON = ['#ff3fa4', …]`
 *        ⇒ **`NEON[0]` 是 `#ff3fa4`，不是 `#ff4fa8`**（`#ff4fa8` 在 `bg.js` 的 **48/122/201** 行）
 *        ⇒ 引用**位置**（NEON 数组）对，但正文的**取值与出处标注与源码不符**。
 *        (c) 抓不到：`#ff4fa8` 与引用**不在同一小句**（中间隔着 `（霓虹洋红，`）。
 *   · **未纳入但顺手记下的裸引用真失效 3 条**（★ 只是**报告**，本闸门**不管**它们）：
 *     `pictogram-motion/_distill.json` 的 `core/render/mux.sh:23`（`GR="${5:-2}"` 实在 **36** 行）、
 *     `mux.sh:115`（`noise=c0s` 实在 **173** 行）、`demo/mux.sh:12`（`noise=c0s=4` 实在 **19** 行）。
 *
 * ── ★★ 2026-10-07 扩扫描范围②：纳入**源码文件** ────────────────────────────────
 *   **盲区（已被实证）**：`DOCS` 此前只含 `.md` + `_distill.json` ⇒ **源码文件**
 *   （`.mjs` / `.js` / `.py` / `.sh`）**注释里**的同类引用**完全不被覆盖**。
 *   实证：`lib/jobs.mjs`（3 处）与 `lib/vram.mjs`（2 处）的这类引用**全部已失效**
 *   （`lemo-make.mjs` 的 `:1158` / `:743` / `:996-1019` / `:2428`×2 ⇒ 真位置
 *   `:1273` / `:858` / `:1559-1563` / `:2716`）。
 *
 *   **扫描范围（新增）**：`lib/*.mjs`（根级）、工具仓根 `*.mjs`、`styles/<slug>/demo/**`、
 *   `core/**`、`tools/**`（后三者只收 `.mjs` / `.js` / `.py` / `.sh`）。
 *   ★ **排除**（照本项目既有闸门的 `SKIP` 写法，见 `check-esm-import-paths.mjs` 的 `SKIP`）：
 *   `vendor/`、`node_modules/`、`.git/`、`*.min.js` —— 压缩产物/三方库里有
 *   `` `r.classId:0` `` / `` `r.length:0` `` 这种**不是引用**的东西（`REF` 认得出它，
 *   因为 `r.classId` 恰好长得像「带扩展名的路径」）⇒ 不排除就会**假红**（夹具 t3 实测）。
 *   ★ **判据不变**：(a)(b)(c)(d) **四条全跑** —— 源码文件里的引用**目标也是别的文件**，
 *   与「引用写在 `.md` / `.json` / `.js` 里」**无关**。**先测误报率再定稿**，见下。
 *
 *   **实测（纳入前 → 纳入后，同一台机同一时刻）**：扫描 **180 份 → 180 份文档 + 791 份源码**；
 *   引用 **3818 → 3826**（**+8**）；解析到文件 **3578 → 3583**（+5）；进入 (c) **41 → 42**（+1）；
 *   **FAIL 0 → 1**。
 *
 *   ★★ **误报率实测（逐条人读，791 份源码 / **8** 处引用）**：
 *   · **真失效 1 条（闸门可见）**：`lib/jobs.mjs:61` 引 `` `server.mjs:1675` ``，
 *     而 `server.mjs` 第 1675 行只是**注释块的收尾星号斜杠**（`--skip-sync` 实在 **1674**（注释）/ **1755**
 *     （`const opts = ['--skip-sync', ...b.runOpts];`））⇒ **(c) FAIL**，**真阳性**。
 *   · **有效 3 条**（逐条 `sed -n '<n>p'` 核过被引行内容与引文一致）：
 *     `styles/art-deco/demo/frame.js:11` 引 `` `STYLE.md:45` ``（第 45 行 = 「What never moves: the
 *     centre axis of a composition…」，正文的「中轴是构图里唯一不能动的东西」逐字对得上）；
 *     `lib/dub-core.mjs:169` 引 `` `halftone-dossier/STYLE.md:19` ``（第 19 行含 `a rotated grid of
 *     circles` + `step 20–26 px`，与引文逐字一致）；`lib/dub-core.mjs:172` 引
 *     `` `risograph/STYLE.md:23` ``（第 23 行 = `cosine spot function on a rotated grid,
 *     period ~6–8 px at 1080p`，逐字一致）。
 *   · **只列不判 4 条**：`lib/dub-core.mjs` 的 `` `demo/index.html:140` ``×2（全库 **46** 处同名）、
 *     `` `STYLE.md:25` ``（**44** 处同名）⇒ **多义(无法核对)**，**不算误报**（本闸门**不判**它）。
 *   ⇒ **命中 1 / 误报 0 ⇒ 精度 100%**，**不做任何收窄**（四条判据全保留）。
 *   ★ 口径必须说清：**这 8 处里只有 1 处是本闸门能判 FAIL 的**（其余 3 有效 + 4 多义）。
 *     「精度 100%」的分母是**命中**，不是**引用**。
 *   ★ 排除项**在本轮真实语料上不承重**（实测：带排除 791 份/8 处引用，关掉排除 792 份/**同样 8 处**
 *     —— 那个 `vendor/opentype.min.js` 里**一个反引号都没有**，故 0 贡献）⇒ 它是**保险**，不是修 bug；
 *     但**必须留**：夹具 t3 证明同一形态一旦落进不被排除的文件就会**假红**。
 *
 *   ★★ **同时暴露的第二层盲区（比「没扫源码」更深，务必知道）**：
 *   任务书给的 5 处里**只有 `lib/jobs.mjs:60` 是反引号包裹的** —— 其余 4 处
 *   （`lib/jobs.mjs:74` / `:751`、`lib/vram.mjs:25` / `:199`）**都没加反引号**
 *   （写作 `见 lemo-make.mjs:743`、`与编排器 lemo-make.mjs:996-1019 逐字对齐`…）
 *   ⇒ 它们是**裸引用**，本闸门**按设计就不认**（见「已知局限」第 2 条）⇒
 *   **扩了源码范围也照样看不见它们**。⇒ 「源码文件已纳入」**不等于**「源码里的引用都被管住了」：
 *   本次纳入只覆盖**带反引号**的那一部分。**修法**：给裸引用**加上反引号**；
 *   本轮那 5 处已顺带改成**符号名 / 代码锚**（不再依赖行号 ⇒ 也就不再是裸引用）。
 *   ★ 另有一条**本闸门结构性看不见**的真失效（人工读出来的，**已报未改**）：
 *     `server.mjs:742` 引 `` `lemo-make.mjs:2593` ``，正文说它「写的是 `<outDir>\<slug>.mp4`」；
 *     而 `:2593` 是显存注释，真出处是 **`:2890` 的 `const dst = path.join(outDir, \`${o.slug}.mp4\`)`**
 *     ⇒ 行号在范围内 + 被引行有内容 + 小句里没有高置信片段 ⇒ (a)(b)(c)(d) **四条全放行**
 *     （与 (d) 清单 ⑪ 同形）。
 *
 *   ★ **失明守卫照旧生效**（夹具 t4 实测：整棵树一个引用都没有 ⇒ 仍判失明 FAIL）。
 *   ★ **不纳入**：`node_modules/`、`vendor/`、生成物（`demo/out/**` 等）**一律不纳入**（噪声）。
 *     ★ **2026-10-07 订正**：`scripts/**` **已纳入**（见上「扩扫描范围③」）——
 *       本行原写「`scripts/**`（本轮任务未要求）不纳入」，那是**上一批的旧状态**，现按代码实况订正。
 *       ★ 但**本闸门不扫自己**（`check-ref-lines.mjs` 自身被显式排除）：它的头注释**必须**用反引号举
 *       「引用形态」的例子、并引用真实语料实例当判据证据 —— 拿它们当真引用核 = **结构性误报**。
 *
 *   ★ 夹具（用 `LEMO_TOOLS_ROOT` / `LEMO_OPUSCAR` / `LEMO_STYLES_ROOT` / `LEMO_DISTILL_ROOT`
 *     四个覆盖点指到临时树，**绝不动真实仓**；`before.mjs` = 把 `SCAN` 退回 `DOCS` 的等价「改动前」版本）：
 *     · **t1**（源码里 `` `target.mjs:999` ``，目标只有 3 行）**改动前 exit 0（抓不到）⇒ 改动后 (b) 1 处 + exit 1**；
 *     · **t2**（源码里正常引用 `` `target.mjs:2` `` 与 `` `STYLE.md:1` ``）**改动前后都 exit 0**（不误报）；
 *     · **t3**（`` `r.classId:0` `` / `` `r.length:0` `` 放 `demo/vendor/lib.min.js` ⇒ **被排除、0 贡献**；
 *       同一段内容放 `core/notmin.js` ⇒ **2 处 (a) 假红**）⇒ **证明排除项是承重的**；
 *     · **t4**（整棵树无引用）**改动前后都 exit 1 + 「本闸门已失明」**（失明守卫未被扩范围破坏）。
 *
 * ── ★ 豁免（只列 backlog、**不判 FAIL**）──────────────────────────────────────
 *   路径匹配 `(^|/)logs?/` 或 `.log$` 的引用 —— 运行期产物：`_distill/logs/*.log` 在**两个仓都被
 *   `.gitignore` 排除**（实测 `git check-ignore` 命中 `*.log` / `_distill/*`），**不随仓库分发**，
 *   且**每次跑都会重写** ⇒ 它的行号**天然会变**。判它 FAIL 会得到一个**永远红的噪声闸门**。
 *
 * ── ★★ 裸引用（只列 backlog、**不判 FAIL**）—— 2026-10-07 新增的**第三类 backlog** ────────────
 *   **它治的盲区**：本闸门**只认反引号包裹**的引用（见下「已知局限」第 2 条）⇒ 正文里**不带反引号**的
 *   「路径 + 冒号 + 行号」（如 `见 lemo-make.mjs:743`）**一条都不被核对** —— 不计入 `refCount`、
 *   不进 (a)(b)(c)(d)、**也不出现在任何输出里**。上一批把 `lib/style-skills/<slug>/_distill.json` 的
 *   378 处裸引用补了反引号清零，但**全库还剩一批**（在 `SKILL.md` / `test/README.md` / 源码注释里）
 *   —— 而闸门对它们**一言不发** ⇒ 后人会把「0 处失效」误读成「引用已清零」。
 *
 *   **为什么不把它们纳入判据（实测，别再试）**：按 (a)(b)(d) 判裸引用 ⇒ 命中 3 / **误报 2（精度 ≈33%）**，
 *   且失败是**结构性**的：裸引用拿不到「同小句路径感知」（`siblingPaths` **只收反引号片段**），
 *   只写 basename 的裸引用必然解析到**同名错文件**（实测 `mux.sh:115` → 本风格 demo 里那份 22 行的）。
 *   ⇒ **判据一个字都不动**；(a)(b)(c)(d) 的形态与阈值全部不变。
 *
 *   **做法**：照 `logs` 的写法，把裸引用**列进 backlog**（计数 + `--list-backlog` 逐条列出处与原文片段），
 *   **一律不判 FAIL、不影响退出码**。★ 输出里**明说这是盲区**（见 `盲区` 分支的文案），
 *   否则「只列不判」本身也会被读成「已处理」。
 *
 *   **判据（正则）与假阳收窄（2026-10-07 实测）**：形态与 `REF` 同形，但**不加锚**（裸引用嵌在正文里）
 *   —— 路径 + `:` + 行号（可 `N` / `N-M` / `N/M/…` / 逗号组 `N-M,K`），路径**带扩展名**。
 *   ★ **扩展名必须以字母开头**（`\.[A-Za-z]…`）：这一条规则**同时**挡掉两类假阳 ——
 *     ① **`地址:端口`**（`127.0.0.1:12345` / `127.0.0.1:9257`：左侧全是数字点，**没有**「以字母开头的扩展名」）；
 *     ② **`数值比`**（对比度的 `2.5:1` / `11.4:1` / `14.8:1` / `1.5:1`：左侧是纯小数，`5`/`4`/`8` 不是字母）。
 *   ★ **实测（同一台机同一时刻，真实语料）**：**宽松版 305 处 → 收窄后 295 处**（**−10**）；
 *     被挡掉的 10 处**逐条核对全是**上面这两类假阳，**没有误伤任何一条真裸引用**
 *     （收窄前后的差集 = `127.0.0.1:12345`×3、`2.5:1`×2、`11.4:1`×2、`14.8:1`、`1.5:1`、`127.0.0.1:9257`）。
 *   ★ **已知残留假阳（不修，只记）**：本闸门**自己的「引用形态示例」**被它的**说明副本**
 *     （`test/README.md` / `_distill/AGENT-BRIEF.md` 里那两行闸门描述）带进语料 ⇒ 会多列约 **16** 处
 *     （如 `foo.js:12`、`main.js:566`、`demo/test.js:9`、`scripts/does-not-exist.mjs:10`）。
 *     这类**没法从形态上区分**（它们**真的**长得跟裸引用一样），而它们是**夹具/示例说明**不是真引用。
 *     ★ 残留占比 ≈ **16/295 ≈ 5%** ⇒ **接受**（backlog **只列不判**，多列几条不产生假红；
 *     宁可多列 5% 也不收窄到把真裸引用漏掉）。★ 另：压缩产物里的 `r.classId:0` 这类形态
 *     （「标识符 + `:0`」恰好长得像「带扩展名的路径」）由 `SRC_SKIP`（`vendor/`、`node_modules/`、
 *     `*.min.js`）挡住 —— 与 (a)(b)(c)(d) **共用同一套排除项**。
 *   ★ **本闸门自己不扫自己**（`SELF_REF_GATE`）⇒ 本段（以及 (d) 的 13 条清单、`_distill.json` 的 17 条清单）
 *     里为**举证**而写的裸引用**不会**被算进这个 backlog。
 *
 * ── ★★ 2026-10-07 掩码口径统一：主判据的 `TICKS` 由 `+` 改为 `*`（与 `CODE_SPANS` 同口径）──────
 *   **本文件内部原本有「两套掩码」，而它们自相矛盾**：
 *     · **主判据**用 `TICKS`（旧版量词 **`+`**）把一行里的**反引号片段**逐段取出（`matchAll(TICKS)`），
 *       只有「片段内容整串 = `路径:行号`」的才计数 —— 等价于「**只看反引号内**」；
 *     · **裸引用 backlog** 用 `CODE_SPANS`（量词 **`*`**，允许空片段）把反引号片段**整段挖成空格**，
 *       再看剩下的文本 —— 等价于「**只看反引号外**」。
 *   ★ 两套掩码**本该互为补集**（一个看内、一个看外），但 `+` 与 `*` 的**配对不同** ⇒ 中间出现**缝**。
 *
 *   **缝在哪（实测）**：`+` 遇到**双反引号**写法（`` `` `x.js:1` `` ``，本仓大量使用）会**配对错位**
 *   —— 它让第一个反引号与**空格**配对，于是内层那段代码**整段漏出掩码**。后果分两层：
 *     ① **裸引用侧**（先修的一层，2026-10-07）：漏出的片段被**误列成裸引用**（3 处已核对引用被误列）；
 *     ② ★★ **主判据侧**（**本轮才修**）：那 3 处**也从来没被主判据认出来**（`matchAll(TICKS)` 拿不到它们）
 *        ⇒ 它们**既不计入「引用」数、也不出现在裸引用 backlog 里** ⇒ **完全隐形**。
 *        ★ 注意 ① 修完之后这一层**反而更隐蔽**：从「被误列成裸引用（至少看得见）」变成「**两处都不出现**」。
 *
 *   **实测（真实语料，同一台机同一时刻；`test/README.md` 那一行有 446 个反引号）**：
 *     · 该行：`+` 只配出 **219** 个片段，`*` 配出 **223** 个 ⇒ **8 个反引号没配上**（4 组双反引号）；
 *     · 全语料：**引用 4519 → 4522（+3）**、**解析到文件 4185 → 4188（+3）**；
 *     · **不变**：进入 (c) **44 → 44**（**逐条集合完全相同**，两次 dump 对比）、
 *       (a)(b)(c)(d) **全 0 → 全 0**、裸引用 **49 → 49**（明细逐条相同）、只列不判 **383 → 383**、
 *       **退出码 0 → 0**；
 *     · **引用集合零丢失**：两次全量 dump（每条引用打印 `where` + 片段）逐条 diff ⇒ **只有 +3、没有 −1**；
 *     · 新增的 3 处（**此前全部完全隐形**）：`_distill/AGENT-BRIEF.md:633` 引 `core/render/mux.sh:36`、
 *       `test/README.md:870` 引 `check-film-aspect.mjs:66` 与 `scripts/style-distill.mjs:189`。
 *
 *   ★ **反向也测过（`*` 会不会把真引用吃掉）**：`*` 允许空片段 ⇒ **「双反引号紧贴」**形态
 *     （双反引号**直接包住**引用、中间没有空格）会被吃成**两个空片段** ⇒ 那条引用**不再被计数**。
 *     · **真实语料实测：0 处**（`lemo-tools` 全树 + `lemo-opuscar` 的 `styles/` / `core/` / `tools/` 全搜过）；
 *     · ★ 而且**即便出现也只是降级**：它仍会出现在**裸引用 backlog 里**（`*` 掩掉的是那两个空片段、
 *       中间那段代码留在掩码外）—— 旧版 `+` 是「**两处都不出现**」。
 *     ⇒ **净效果是「消除隐形」，不是「少核对」**：`+` 有「隐形」这一档，`*` 没有。
 *     ★ 取舍写下来：**宁可让极少数写法降级成「只列不核」，也不要让它们彻底消失**。
 *
 *   ★ **判据一个字没动**：(a)(b)(c)(d) 的**内容**（阈值、形态、小句切分、token 匹配、
 *     `STRUCTURAL_LINE`、`isRangeRef`…）与 `REF` / `BARE_REF` / `HIGH_CONF` / `REGISTERED_MARK`
 *     **全部未改**；改的只有**反引号片段的配对（掩码）口径**这一个地方（`TICKS` 的 `+` → `*`）。
 *     ★ `TICKS` 在本文件里**只有两处使用**（主循环取引用、取 (c) 与同小句路径用的片段），
 *     **两处都是这套配对**、没有别的用途 ⇒ 改定义即「只改掩码这一处」。
 *     ★ (c) 实际进入比对的**引用集合实测逐条不变**（44 = 44）⇒ (c) 的覆盖面没有被这次改动挪动。
 *
 *   ★ **夹具（四个覆盖点 `LEMO_TOOLS_ROOT` / `LEMO_OPUSCAR` / `LEMO_STYLES_ROOT` / `LEMO_DISTILL_ROOT`
 *     指到临时树，**绝不动真实仓**；对照用的「改动前」= 本文件改动前的副本）**：
 *     · **A**（双反引号写法 + 一条真裸引用）：改动前 引用 **1**，那条双反引号引用**两处都不出现**
 *       （主判据不计数、裸引用 backlog 也没有）⇒ 改动后 引用 **2**、**真裸引用仍被列出**（裸引用 2 → 2）；
 *     · **B**（空片段 `` `` `` + 旁边的真引用）：改动前 那个空片段把**旁边那条真引用一起吃掉**
 *       （`+` 让空片段与后一个反引号配成一大段、把中间的代码隔在配对之外）⇒ 改动后它**回到计数**；
 *       同夹具里「双反引号紧贴」那条则从「被计数」降到「**裸引用 backlog（仍然可见）**」；
 *     · **C**（正常行）：改动前后**逐字一致**（引用 2 / 裸引用 0 / exit 0）；
 *     · **D**（整棵树 0 引用）：改动前后**都 exit 1 + 「本闸门已失明」**（失明守卫未受影响）。
 *
 * ── ★ 两层语义（照本项目既有写法）────────────────────────────────────────────
 *   若**引用所在小句**内出现「已登记的失效」标记（`已失效|待修|已知失效|原为|原记|已登记|已废弃`），
 *   只列 backlog、**不判 FAIL**（同 `check-tp-prose.mjs` ④ 的历史语境豁免，但粒度收窄到**小句**）。
 *
 *   ★★ 2026-10-06 两次收紧（本判据先后犯过两次「匹配判据可被无关文本满足」）：
 *   ① **整行 → 小句**：旧版判据是**整行**粒度，于是一行里**恰好**出现标记词，就把**该行所有引用**
 *      整行豁免 —— 实测 `swiss-motion/SKILL.md:30` 只是**顺口**写了「禁止照抄任何**历史**海报的构图」，
 *      该行引用就被当成「已登记失效」只列不判。现要求标记**与引用同小句**（分隔符同 (c)：
 *      `。！？；，、（）()[]|`）—— 「历史海报」与 `（`STYLE.md:4`）` **不在同一小句** ⇒ 不再豁免。
 *      · 为什么是**小句**而不是「距引用 ≤40 字符」：小句足够紧（分隔符含 `，、（）`），
 *        且能保住**列举式登记**（「已登记待修的（`a.js:1`、`b.js:2`）」两句引用都该豁免）——
 *        距离判据会把这种合法形态误伤。
 *   ② **去掉泛词 `历史`、补 `已登记|已废弃`**：`历史` 是**普通词**（「公司历史」「历史海报」），
 *      与被引对象的失效**没有语义绑定**；豁免要求的是**明确的失效/登记标记**。
 *      （`原为|原记` 保留：它们是本仓「原文保留 + 追加更正」写法的固定用语。）
 *   ★ 词表守卫保留：同一小句里出现 **≥3 个不同标记** ⇒ 那是「标记词表」而不是「已登记失效」，
 *     **不豁免**（否则本闸门自己的说明文字会把自己永久豁免）。
 *
 * ── ★ 失明守卫（防空转绿灯）─────────────────────────────────────────────────
 *   ① 扫描范围内**一个 `<路径>:<行号>` 引用都没找到** ⇒ **FAIL 并明说「本闸门已失明」**；
 *   ② 一个引用都**解析不到文件**（解析成功数 = 0）⇒ 同样判失明（要么文档里的引用真的全坏、要么解析根配错了）。
 *   否则「0 处失效」会是一句**假话**（什么都没扫到）。
 *
 * ── 已知局限 ────────────────────────────────────────────────────────────────
 *   · **(c) 覆盖面窄**：真实语料 3652 处引用里只有 **37 处**落在 (c) 的判据内 —— 因为多数引用
 *     的小句里根本没有「高置信代码片段」（只有别的引用、路径、slug 或散文）。**这是有意的取舍**：
 *     ★ 2026-10-07 纳入 `.json` 后的同口径数字：**3813 处 / 41 处**（占比同样 ≈1%）。
 *     宁可少判、不可乱报。(c) **不是**「所有引用都比对内容」。
 *   · 启发式（非 AST）：解析器只认**反引号包裹**的引用；写在正文里不加反引号的 `foo.js:12` **看不见**
 *     —— ★ 2026-10-07 起**不再是「完全不可见」**：它们会被列进第三类 backlog「**裸引用(未被核对)**」
 *     （**只列不判 FAIL**，见上「裸引用」段）。**但「被列出」≠「被核对」**：它们仍然不进 (a)(b)(c)(d)、
 *     不计入 `refCount` ⇒ 这类引用的**正确性依然零覆盖**。
 *     ★ 2026-10-07 实测：`_distill.json` 里这类**裸引用曾有 390 处**（是**反引号引用 17 处**的 23 倍），
 *     **明确不纳入判据**（按 (a)(b)(d) 判得 3 命中 / **误报 2**，见上「扩扫描范围」段的实测）——
 *     即本次纳入只覆盖该语料的**一小部分**引用，别把「`_distill.json` 已纳入」读成「它的引用全被管住」。
 *     ★★ **源码文件同理（2026-10-07 再确认）**：本轮纳入的 791 份源码共 8 处引用，其中**4 处是裸引用**
 *     （正是任务书那 5 处里的 4 处）⇒ **扩了源码范围也照样看不见它们**。别把「源码文件已纳入」
 *     读成「源码里的引用都被管住了」。
 *   · ★ **`scripts/**` 不在扫描范围内**（2026-10-07 明确记下）：本轮任务未要求；那 29 个闸门自身
 *     带**大量**行号引用（含本闸门**自己的头注释** —— 纳入后会自我扫描，需单独评估误报率）。
 *     纳入前**必须先测误报率**（同 (c) 的纪律）。
 *   · ★ **`vendor/` / `node_modules/` / `*.min.js` / 生成物**一律不纳入（压缩产物里
 *     `` `r.classId:0` `` 这类会被 `REF` 认成引用 ⇒ 假红；见「扩扫描范围②」段的夹具 t3）。
 *   · ★ **`.json` 的出处行号口径**：`_distill.json` 按**物理行**扫（与 `.md` 同口径），
 *     靠「`JSON.stringify` 把 `\n` 转义 ⇒ 1 字符串值 = 1 物理行」保证与「按字符串值判」等价（实测 2510/2510）。
 *     若该文件被压成一行，`where` 的行号会失真（**判据不受影响**，见上）。
 *   · **多义引用**（非风格级文档里的 `demo/test.js:9`）**不判 FAIL**，只列出 —— 需要人读上下文。
 *   · 风格源码树里**被重构成多模块**的老文档（实测 `ascii-crt` / `one-line` / `scifi-toon` 等
 *     把 `main.js` 拆成了若干模块）会报大量「行号超范围」：那是**真失效**，但**修法是重写引用**，
 *     不是本闸门能自动做的。
 *   · ★ **按文件名查找只覆盖 `styles/` 全树**（+ 文档所属风格树），**不覆盖 `core/`**：
 *     裸文件名引用（`` `sfx.py:9` ``）若目标其实在 `core/` 下，会被判 (a) 失败。
 *     **不改判据**（扩到 `core/` 就要按文件名跨树命中，正是头注释里否决过的「basename 模糊匹配」
 *     —— 会命中错文件；且会让 `styles/` 之外的 40+ 个风格源码树的引用语义变松）
 *     ⇒ **只把报错文案改成如实说明范围**（见 `missing` 分支）。修法：文档把引用写成带目录的路径。
 *   · **(d) 只管「那一行有没有内容」，不管「内容对不对」**：被引行是正文但**写的是别的东西**
 *     （行号漂到另一段正文上）(d) **看不见** —— 那是 (c) 的活，而 (c) 只覆盖小句里有高置信片段的少数引用
 *     ⇒ 这两条**合起来仍有缝**（既无代码片段、又漂到另一段正文上的引用，本闸门看不见）。**已知、不改**。
 *   · **(d) 对区间引用整个不判**（`isRangeRef` 跳过）：`a.js:10-20` 的起点落在空行上是无害写法（见上），
 *     但**代价**是「区间起点漂到空行**且区间内也没有真内容**」这类失效 (d) 也放过。取舍理由：那 3 处
 *     已知误报**全是区间**，而区间失效的召回率远低于单点 ⇒ 宁可漏、不可乱报（同 (c) 的取舍）。
 *   · **(d) 的「结构性行」只认 `-{3,}` / `*{3,}` / `_{3,}` / `` `{3,} ``**（整行 trim 后恰好是这些）。
 *     不认 `~~~`、不认「行首是 `#` 的标题」、不认「只有标点的行」—— 扩词表要**先测误报率**再动（同 (c) 的纪律）。
 *   · **(d) 依赖「文件以换行结尾」这个约定**：幻影行判定把尾空元素当幻影。若某文件**真的**以一行空行结尾
 *     且文档有意引它，也只会被 (d) 抓（那一行本来就**没有内容**可引）⇒ 不构成误报。
 *   · `logs/**` 豁免（见上）。
 *
 * 用法：node scripts/check-ref-lines.mjs [--list-backlog]
 * 退出码：有 FAIL（或失明）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';

// ── 覆盖点（供非破坏变异验证；命名照本项目既有闸门）─────────────────────────
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || 'D:/lemo-tools');
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || 'D:/lemo-opuscar');
const STYLES = path.resolve(process.env.LEMO_STYLES_ROOT || path.join(OPUSCAR, 'styles'));
const DISTILL = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(ROOT, 'lib', 'style-skills'));

const LIST_BACKLOG = process.argv.includes('--list-backlog');

// ── 扫描范围（★ 显式列表，不用「全仓 md」那种会拖进噪声的 glob）─────────────
//   ★ 2026-10-07：除 `.md` 外**再纳入 `lib/style-skills/<slug>/_distill.json`** ——
//     它是**唯一**没被任何闸门管着的 `<路径>:<行号>` 引用宿主（见头注释「扩扫描范围」段）。
//   ★★ 2026-10-07 再扩：**源码文件**（`SRCS`，见下）也纳入（见头注释「扩扫描范围②」段）。
const styleSlugs = (() => {
  try { return fs.readdirSync(STYLES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(); }
  catch { return []; }
})();
const skillSlugs = (() => {
  try { return fs.readdirSync(DISTILL, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(); }
  catch { return []; }
})();
const DOCS = [
  path.join(ROOT, 'test', 'README.md'),
  path.join(ROOT, '_distill', 'AGENT-BRIEF.md'),
  ...skillSlugs.map((s) => path.join(DISTILL, s, 'SKILL.md')),
  // ★ 2026-10-07：`_distill.json` 的 defects / resolvedDefects / limits … 里**确实有**同样的
  //   `` `<路径>:<行号>` `` 引用，而它此前**完全不在扫描范围内**（实测新增 17 处，见头注释）。
  ...skillSlugs.map((s) => path.join(DISTILL, s, '_distill.json')),
  path.join(OPUSCAR, 'MAINTAINING.md'),
  path.join(OPUSCAR, 'TECHNIQUE.md'),
  path.join(OPUSCAR, 'core', 'README.md'),
  ...styleSlugs.flatMap((s) => [path.join(STYLES, s, 'STYLE.md'), path.join(STYLES, s, 'DEMO.md')]),
].filter((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });

// ── ★ 2026-10-07 扩扫描范围②：**源码文件**里的 `<路径>:<行号>` 引用 ──────────────
//   盲区：`DOCS` 此前**只含 `.md` + `_distill.json`** ⇒ 源码文件（`.mjs` / `.js` / `.py` / `.sh`）
//   注释里的同类引用**完全不被覆盖**。已实证：`lib/jobs.mjs`（3 处）与 `lib/vram.mjs`（2 处）
//   的这类引用**全部已失效**（修法与实测见头注释「扩扫描范围：源码文件」段）。
//   ★ 判据不变（(a)(b)(c)(d) 全跑）—— 实测命中 2 处、**逐条人读全是真失效（精度 100%）**。
//   ★ 排除项（照本项目既有闸门的 `SKIP` 写法，见 `check-esm-import-paths.mjs` 的 `SKIP`）：
//     压缩过的 JS / 三方库里有 `r.classId:0` 这种**不是引用**的东西 ⇒ 必须排除
//     `vendor/`、`node_modules/`、`.git/`、`*.min.js`。
const SRC_SKIP = /[\\/](?:vendor|node_modules|\.git)[\\/]|\.min\.js$/;
const SRC_EXT = /\.(?:mjs|js|py|sh)$/;
/**
 * ★ 2026-10-07 扩扫描范围③：`scripts/**` **纳入**，但**本闸门自己不扫自己**（见头注释「扩扫描范围③」）。
 *   理由（实测）：本闸门头注释**必须**用反引号举「引用形态」的例子（`a.js:1` / `foo.js:12` /
 *   `X.md:100` / `r.classId:0`…）并**引用真实语料实例**当判据证据（(d) 清单 13 条、
 *   `_distill.json` 清单 17 条）—— 这些是**引用形态规范 / 某一时刻的快照**，
 *   头注释自己就写明「语料在动，本清单不是永久名单」⇒ 拿它们当真引用核 = **结构性误报**。
 *   实测：该文件占 `scripts/**` 引用的 **97/157 = 62%**、占全部命中的 **41/44 = 93%**。
 */
const SELF_REF_GATE = path.join(ROOT, 'scripts', 'check-ref-lines.mjs');
/** 目录下**根级**（不递归）匹配的文件 —— 用于 `lib/*.mjs` 与工具仓根 `*.mjs` */
const topLevel = (dir, re) => {
  try { return fs.readdirSync(dir).filter((n) => re.test(n)).map((n) => path.join(dir, n)); } catch { return []; }
};
/** 目录下**递归**匹配的文件，逐层跳过 `vendor/`、`node_modules/`、`.git/`、`*.min.js` */
function collectSrc(dir, re, out = []) {
  let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of es) {
    const p = path.join(dir, e.name);
    if (SRC_SKIP.test(p)) continue;
    if (e.isDirectory()) collectSrc(p, re, out);
    else if (re.test(e.name)) out.push(p);
  }
  return out;
}
const SRCS = [...new Set([
  ...topLevel(path.join(ROOT, 'lib'), /\.mjs$/),                       // 工具仓 lib/*.mjs
  ...topLevel(ROOT, /\.mjs$/),                                        // 工具仓根 *.mjs
  ...styleSlugs.flatMap((s) => collectSrc(path.join(STYLES, s, 'demo'), SRC_EXT)),  // styles/*/demo/**
  ...collectSrc(path.join(OPUSCAR, 'core'), SRC_EXT),                 // core/**
  ...collectSrc(path.join(OPUSCAR, 'tools'), SRC_EXT),                // tools/**
  // ★ 2026-10-07 扩扫描范围③：`scripts/**`（29 个闸门 + 工具脚本）—— **排除本闸门自己**（见头注释）。
  ...collectSrc(path.join(ROOT, 'scripts'), SRC_EXT).filter((p) => p !== SELF_REF_GATE),
])].sort();

/** 本次真正扫的文件 = 文档 + 源码 */
const SCAN = [...DOCS, ...SRCS];

// ── 引用形态 ────────────────────────────────────────────────────────────────
//   反引号包裹、路径带扩展名、`:行号`（可 `N` / `N-M` / `N/M/…` / 逗号分隔组 `N-M,K`）
//   ★ 锚 `^…$`：整串必须刚好是「路径:行号组」，`a.js:1,b.js:2` / `x.js:1, 'a'` 都不会被误吃。
const REF = /^([A-Za-z0-9_][A-Za-z0-9_./\\-]*\.[A-Za-z0-9_]+):(\d+)((?:[-/,]\d+)*)$/;
/**
 * 反引号片段的**配对**（= 主判据这一侧的「掩码口径」）。
 * ★ 2026-10-07 量词由 `+` 改为 `*`，与 `CODE_SPANS` **统一到同一套「允许空」配对**
 *   （见下 `CODE_SPANS` 的说明与头注释「掩码口径统一」段）。
 *   旧版 `+`（要求 ≥1 个字符）在**双/四反引号**写法上会**配对错位**：`` `` `` 里第一个反引号与
 *   **空格**配对，内层那段代码**整段漏出掩码** ⇒ 它**既不被本循环 `matchAll(TICKS)` 计入「引用」**、
 *   **也不进裸引用 backlog**（裸引用侧的掩码 `CODE_SPANS` 是 `*`，早把它掩掉了）⇒ **完全隐形**。
 *   实测（真实语料）：**3 处引用此前完全隐形**，改后**全部回到「引用」计数**并被 (a)(b)(c)(d) 核对；
 *   **引用集合零丢失**（两次全量 dump 逐条 diff，只有 +3、没有 −1）。
 * ★ 为什么两套掩码必须同口径：主判据扫「反引号**内**」、裸引用扫「反引号**外**」——
 *   只有配对一致时，任何 `路径:N` 形态才**要么被计数、要么被列进 backlog**，不会两者皆无。
 * ★ 本常量在文件里**只有两处使用**（主循环取引用 / 取 (c) 与同小句路径用的片段），**两处都是这套配对**，
 *   没有别的用途 ⇒ 改定义即「只改掩码这一处」，`REF` 与 (a)(b)(c)(d) 的**内容一个字都没动**。
 */
const TICKS = /`([^`\n]*)`/g;
/**
 * ★ 2026-10-07 新增：**裸引用**（正文里**不带反引号**的「路径 + 冒号 + 行号」）。
 *   本闸门**只认反引号包裹**的引用 ⇒ 这类引用**一条都不被核对**（不计入 `refCount`、不进 (a)(b)(c)(d)）。
 *   这里只把它们**列进 backlog**（计数 + `--list-backlog`），**不判 FAIL** ——
 *   因为按 (a)(b)(d) 判它们实测精度仅 ≈33%（结构性失败，见头注释「裸引用」段）。
 *   ★ 与 `REF` 的差别只有两点：① **不加锚**（裸引用嵌在正文里，不是整串）；② **扩展名必须以字母开头**
 *     —— 后者一条规则同时挡掉 `地址:端口`（`127.0.0.1:12345`）与 `数值比`（对比度 `2.5:1`）两类假阳。
 *     实测：宽松版 305 处 → 收窄后 295 处，挡掉的 10 处**全是**这两类假阳、**零误伤**。
 */
const BARE_REF = /([A-Za-z0-9_][A-Za-z0-9_./\\-]*\.[A-Za-z][A-Za-z0-9_]*):(\d+)((?:[-/,]\d+)*)/g;
/**
 * 裸引用扫描用的「挖洞」正则：把**已核对的**反引号片段整段换成等长空格，免得它们被重复算成裸引用。
 * ★ 新增时的由来（2026-10-07）：当时主判据的 `TICKS` 是 `+`（要求非空），遇到**双反引号**写法
 *   （`` `` `x.js:1` `` ``，本仓大量使用）会把**内层反引号与空格配对**，导致 `x.js:1` **整段漏出掩码**
 *   ⇒ 3 处已核对引用被误列成裸引用（实测：`_distill/AGENT-BRIEF.md` 的 `core/render/mux.sh:36`、
 *   `test/README.md` 的 `check-film-aspect.mjs:66` 与 `scripts/style-distill.mjs:189`）。
 *   `*`（允许空）会先把相邻的两个反引号吃掉，配对才与人的读法一致 ⇒ 这 3 处消失（298 → 295）。
 * ★★ 2026-10-07 后续（本文件本轮改动）：**主判据的 `TICKS` 也已由 `+` 改为 `*`** ⇒ 两套掩码**现在同口径**。
 *   理由是上面那 3 处**并没有真的被修好** —— 它们只是从「被误列成裸引用」变成了
 *   「**两处都不出现**」（主判据 `matchAll(TICKS)` 拿不到它们、裸引用侧又被本正则掩掉）⇒ **完全隐形**。
 *   同口径后它们**回到「引用」计数**并被 (a)(b)(c)(d) 核对（实测见头注释「掩码口径统一」段）。
 *   ★ **判据（`REF` 与 (a)(b)(c)(d) 的内容）一个字都没动** —— 改的只是**配对（掩码）口径**。
 */
const CODE_SPANS = /`[^`\n]*`/g;
/** 第三类 backlog 的 kind（`logs` / 多义 / 欠指明 之外的） */
const BARE_KIND = '裸引用(未被核对)';
/** 占位符 / 通配的路径不算引用（`styles/<slug>/demo`、`film*.js`） */
const isPlaceholder = (p) => /[<>*…]/.test(p);
const isLogRef = (p) => /(^|\/)logs?\//.test(p) || /\.log$/.test(p);
/**
 * (d) 的「结构性行」：分隔线 / 代码块围栏 —— 这类行**没有任何被引内容**，
 * 引用落到它上面一定是漂移（或写错），**不需要看上下文**就能判。
 */
const STRUCTURAL_LINE = /^(?:-{3,}|\*{3,}|_{3,}|`{3,})$/;
/** (d) 只判**单点引用**：`N-M` / `N/M` 这种区间**起点早一行**是无害写法（见头注释） */
const isRangeRef = (rest) => /[-/]/.test(rest);
const describeLine = (raw) => {
  const t = raw.trim();
  if (t === '') return raw === '' ? '空行' : '**只有空白**';
  return `\`${t.slice(0, 40)}\``;
};
/**
 * 「已登记失效」标记 —— ★ 只收**明确的失效/登记**语义，**不收**泛词（`历史` 已剔除）。
 * 判据是**引用所在小句**粒度（见头注释「两层语义」的两次收紧）。
 */
const REGISTERED_MARK = /已失效|待修|已知失效|原为|原记|已登记|已废弃/g;
function isRegistered(seg) {
  const marks = new Set(seg.match(REGISTERED_MARK) || []);
  if (!marks.size) return false;
  return marks.size < 3;   // ≥3 个不同标记 ⇒ 那是「标记词表」，不是登记
}

// ── 路径解析 ────────────────────────────────────────────────────────────────
const SKIP_DIR = new Set(['node_modules', '.git', 'out', 'voices', 'voices_raw', 'stills', 'CREDITS', 'assets', 'fonts']);
const idxCache = new Map();
function treeIndex(root) {
  if (idxCache.has(root)) return idxCache.get(root);
  const byTail = new Map(), byFull = new Map();
  (function walk(d, rel) {
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (SKIP_DIR.has(e.name)) continue;
      const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else {
        if (!byTail.has(e.name)) byTail.set(e.name, []);
        byTail.get(e.name).push(p);
        if (!byFull.has(r)) byFull.set(r, p);
      }
    }
  })(root, '');
  const o = { byTail, byFull }; idxCache.set(root, o); return o;
}

/** 文档所属风格 slug（SKILL.md 在 `<DISTILL>/<slug>/`，STYLE|DEMO.md 在 `<STYLES>/<slug>/`） */
function slugOf(file) {
  const rel1 = path.relative(DISTILL, file);
  if (!rel1.startsWith('..') && !path.isAbsolute(rel1)) { const s = rel1.split(/[\\/]/)[0]; if (s && s !== rel1) return s; }
  const rel2 = path.relative(STYLES, file);
  if (!rel2.startsWith('..') && !path.isAbsolute(rel2)) { const s = rel2.split(/[\\/]/)[0]; if (s && s !== rel2) return s; }
  return null;
}

function rootsFor(file) {
  const slug = slugOf(file), out = [];
  if (slug) out.push(path.join(STYLES, slug), path.join(STYLES, slug, 'demo'));
  out.push(path.dirname(file));
  out.push(ROOT, path.join(ROOT, 'scripts'), path.join(ROOT, 'lib'), path.join(ROOT, 'test'),
    path.join(ROOT, '_distill'), path.join(ROOT, '_distill', 'logs'));
  // ★ 2026-10-07：补 `lib/style-skills/`（`DISTILL`）—— SKILL.md 的**正主目录**此前**不在解析根里**
  //   ⇒ 脚本里写 `<slug>/SKILL.md:N`（如 `paper-lantern/SKILL.md:114`）会被误判成「(a) 文件不存在」。
  //   实测（逐条对比 971 份语料 / 3824 处引用的解析结果）：**0 差异** ⇒ 纯误报修正，不动判据。
  out.push(DISTILL);
  out.push(OPUSCAR, path.join(OPUSCAR, 'core'), path.join(OPUSCAR, 'tools'), STYLES);
  return [...new Set(out)];
}

/**
 * 解析结果：{p} 命中 ｜ {ambiguous:[…]} 多义 ｜ {how:'underspec'} 欠指明 ｜ null 解析不到
 * @param siblingPaths 同小句里出现的**带目录的路径**片段（如 `` `core/render/mux.sh` ``）——
 *   若某个的 basename 与本引用相同，则本引用就是它（★ 路径感知：实测 `hd-2d` 的
 *   「core/render/mux.sh … `mux.sh:152-162`」指的就是 core 那个，不是本风格自带的）。
 */
function resolveRef(file, refPath, siblingPaths = []) {
  const tail = refPath.split(/[\\/]/).pop();
  if (!refPath.includes('/')) {
    for (const sp of siblingPaths) {
      if (sp.split(/[\\/]/).pop() !== tail) continue;
      for (const r of rootsFor(file)) {
        const p = path.resolve(r, sp);
        try { if (fs.statSync(p).isFile()) return { p, how: 'sibling-path' }; } catch {}
      }
      for (const r of [OPUSCAR, STYLES, ROOT]) {
        const p = path.resolve(r, sp);
        try { if (fs.statSync(p).isFile()) return { p, how: 'sibling-path' }; } catch {}
      }
    }
  }
  for (const r of rootsFor(file)) {
    const p = path.resolve(r, refPath);
    try { if (fs.statSync(p).isFile()) return { p, how: 'root' }; } catch {}
  }
  const slug = slugOf(file);
  if (slug) {
    const ix = treeIndex(path.join(STYLES, slug));
    if (refPath.includes('/') && ix.byFull.has(refPath)) return { p: ix.byFull.get(refPath), how: 'slug-full' };
    const c = ix.byTail.get(tail);
    if (c && c.length === 1) return { p: c[0], how: 'slug-tail' };
    if (c && c.length > 1) return { p: null, ambiguous: c, how: 'slug-ambig' };
    // ★ 本风格树里没有：`styles/` 全树也没有同名 ⇒ 真的不在 styles 里（FAIL）；
    //   `styles/` 全树有同名 ⇒ 文档**欠指明**（只列不判）。★ 注意这里**没有**搜 `core/`（见 known limits）。
    const g = treeIndex(STYLES).byTail.get(tail) || [];
    return { p: null, ambiguous: g, how: g.length ? 'underspec' : 'missing' };
  }
  const g = treeIndex(STYLES).byTail.get(tail);
  if (g && g.length === 1) return { p: g[0], how: 'global-tail' };
  if (g && g.length > 1) return { p: null, ambiguous: g, how: 'global-ambig' };
  return null;
}

// ── (c) 的片段判据 ──────────────────────────────────────────────────────────
const isRefLike = (s) =>
  REF.test(s) ||
  /^[\w.-]+\.(js|mjs|py|sh|md|json|html|css|txt|log|srt)(#[\w.-]+)?$/.test(s) ||
  /^[\w.-]+:\d+([-,/]\d+)*$/.test(s) ||
  /^[\w.-]+:[\d,/-]+$/.test(s);
const HIGH_CONF = [
  // CLI 选项：`--flag[ value]`，或**单个短选项** `-x`。
  // ★ 不收 `-rn` 这类「多个短选项合并」—— 实测 `AGENT-BRIEF.md:517` 的 `-rn` 是 **grep 的选项**，
  //   与被引的 `game-show/demo/music.py:24` 毫无关系（同一小句里出现了另一个命令）⇒ 假红。
  /^--[A-Za-z][\w-]*([ =]\S+)?$/,
  /^-[A-Za-z]([ =]\S+)?$/,
  /^#[0-9a-fA-F]{3,8}$/,                              // 色值
  /^[A-Za-z_$][\w$.\[\]]*\s*[=:]\s*\S+$/,             // 赋值 / 键值
  /^[A-Za-z_$][\w$.]*\([^)]*\)$/,                     // 调用
];
const isHighConf = (s) => HIGH_CONF.some((re) => re.test(s));
function okSnippet(s, slug) {
  const t = s.trim();
  if (t.length < 3) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;
  if (t.includes('…')) return false;
  if (slug && t === slug) return false;
  if (isRefLike(t)) return false;
  return isHighConf(t);
}
const tokensOf = (s) => s.split(/[^A-Za-z0-9#.]+/).map((t) => t.replace(/^[.#]+|[.#]+$/g, '')).filter((t) => t.length >= 2 && /[A-Za-z0-9]/.test(t));
/** token 匹配：全部 token 命中 ⇒ 通过；否则只要有一个**含数字的 token**命中 ⇒ 也通过 */
function snippetMatches(snip, targetText) {
  const tk = tokensOf(snip);
  if (!tk.length) return targetText.includes(snip);
  const low = targetText.toLowerCase();
  const hit = (t) => low.includes(t.toLowerCase());
  if (tk.every(hit)) return true;
  return tk.some((t) => /\d/.test(t) && hit(t));
}

// ── 主循环 ──────────────────────────────────────────────────────────────────
const linesOf = new Map();
const getLines = (p) => { if (!linesOf.has(p)) linesOf.set(p, fs.readFileSync(p, 'utf8').split('\n')); return linesOf.get(p); };

const fails = [];      // {kind, file, docLine, ref, snippet?, detail}
const backlog = [];    // 豁免 / 多义 / 已登记 / 裸引用(未被核对)
let refCount = 0, resolvedCount = 0, cApplied = 0;
let bareCount = 0;     // ★ 裸引用（正文里不带反引号）—— **从未被核对**，只列 backlog

for (const file of SCAN) {
  const slug = slugOf(file);
  const docLines = fs.readFileSync(file, 'utf8').split('\n');
  docLines.forEach((line, i) => {
    const lineNo = i + 1;
    // ── ★ 裸引用：只列 backlog、**不判 FAIL**（见头注释「裸引用」段）──
    //   先把**反引号片段整段挖成等长空格**，保证「已核对的引用」不会被重复算成裸引用
    //   （等长替换 ⇒ 命中位置与原文一致，便于报出处）。用 `CODE_SPANS`（与主判据的 `TICKS` **同口径**，
    //   两套掩码必须配对一致，否则会出现「既不计入引用、也不进 backlog」的隐形引用 —— 见其定义与头注释）。
    const masked = line.replace(CODE_SPANS, (t) => ' '.repeat(t.length));
    for (const bm of masked.matchAll(BARE_REF)) {
      if (isPlaceholder(bm[1])) continue;      // `styles/<slug>/demo`、`film*.js` 这类占位/通配不算
      bareCount++;
      // ★ `masked` 是**等长**替换 ⇒ `bm.index` 与原文下标一致，可以直接去原文取上下文片段。
      const rawCtx = line.slice(Math.max(0, bm.index - 30), bm.index + bm[0].length + 30).trim();
      backlog.push({
        kind: BARE_KIND,
        where: `${path.relative('D:/', file).replace(/\\/g, '/')}:${lineNo}`,
        fragment: bm[0],
        detail: '正文里**不带反引号**的「路径 + 冒号 + 行号」⇒ 本闸门**只认反引号包裹**的引用，'
          + '这一条**从未被核对**（不计入 refCount、不进 (a)(b)(c)(d)）。'
          + '修法：给它补**反引号 + 带目录的路径**（见 `_distill/AGENT-BRIEF.md` 引用纪律第 12 条）'
          + `\n        原文：…${rawCtx}…`,
      });
    }
    for (const m of line.matchAll(TICKS)) {
      const inner = m[1].trim();
      const r = inner.match(REF);
      if (!r) continue;
      const [, refPath, firstLine, rest] = r;
      if (isPlaceholder(refPath)) continue;
      refCount++;

      const nums = [Number(firstLine), ...[...rest.matchAll(/\d+/g)].map((x) => Number(x[0]))];
      const maxN = Math.max(...nums);
      const where = `${path.relative('D:/', file).replace(/\\/g, '/')}:${lineNo}`;
      const fragment = `\`${inner}\``;

      // ── 小句与「同小句里的路径片段」（供路径感知解析 / (c) / 豁免 用）──
      const start = m.index, end = m.index + m[0].length;
      const parts = line.split(/(?<=[。！？；，、（）()\[\]|])/);
      let segStart = 0, segEnd = line.length, acc = 0;
      for (const s of parts) { if (acc <= start && start < acc + s.length) { segStart = acc; segEnd = acc + s.length; break; } acc += s.length; }
      const seg = line.slice(segStart, segEnd);

      // 两层语义：**本引用所在小句**里有「已登记失效」标记（≥3 个标记的词表不算）
      const registered = isRegistered(seg);

      const push = (kind, detail, extra = {}) => {
        const rec = { kind, where, fragment, detail, ...extra };
        (registered ? backlog : fails).push(registered ? { ...rec, kind: kind + '(已登记)' } : rec);
      };

      const spans = [...line.matchAll(TICKS)].map((x) => ({ t: x[1].trim(), i: x.index, e: x.index + x[0].length }))
        .filter((x) => x.i >= segStart && x.e <= segEnd && x.t !== inner);
      const siblingPaths = spans.map((x) => x.t).filter((t) => /[\\/]/.test(t) && /\.[A-Za-z0-9]+$/.test(t) && !isPlaceholder(t));

      // ── 豁免：运行期日志 ──
      if (isLogRef(refPath)) { backlog.push({ kind: 'logs(运行期产物)', where, fragment, detail: '被 .gitignore 排除、不随仓库分发，行号每次运行都会变' }); continue; }

      const res = resolveRef(file, refPath, siblingPaths);
      if (!res || !res.p) {
        if (res && res.how === 'global-ambig') {
          backlog.push({ kind: '多义(无法核对)', where, fragment, detail: `全库 ${res.ambiguous.length} 处同名：${res.ambiguous.map((p) => path.relative(OPUSCAR, p).replace(/\\/g, '/')).join('、')}` });
        } else if (res && res.how === 'underspec') {
          // ★ 2026-10-06 文案订正（与下面 `missing` 分支**同因**，判据一律不动）：旧版只写
          //   「全库有 N 处同名」，而这里的「全库」**只有 `styles/` 全树**（`treeIndex(STYLES)`）
          //   —— 实测 `hd-2d/SKILL.md` 引 `` `mux.sh:152-162` `` 时列出的候选**全在 `styles/` 下**，
          //   而正确答案是 `core/render/mux.sh`（同一段上文自己就写了这条全路径）⇒ 候选名单里
          //   **根本没有正主**，照候选去挑会挑错。现如实说明**搜索范围**（同头注释 known limits）。
          backlog.push({ kind: '欠指明(只列不判)', where, fragment, detail: `本风格树（styles/${slug}/）里没有 \`${refPath}\`，全库有 ${res.ambiguous.length} 处同名（${res.ambiguous.map((p) => path.relative(OPUSCAR, p).replace(/\\/g, '/')).join('、')}）—— 文档没说清指哪一个。★ **本计数只覆盖 \`styles/\` 全树**（按文件名找）；\`core/\`、\`scripts/\`、\`tools/\` 等树**不在内** —— 所以「候选名单里没有」**不等于**「仓里没有」（若该文件其实在 \`core/\` 下，请把引用写成**带目录**的路径，如 \`core/render/mux.sh\`）` });
        } else if (res && res.how === 'slug-ambig') {
          push('(a) 文件不存在', `本风格树（styles/${slug}/）里有 ${res.ambiguous.length} 处同名、无法定位：${res.ambiguous.map((p) => path.relative(OPUSCAR, p).replace(/\\/g, '/')).join('、')}`, { refPath });
        } else if (res && res.how === 'missing') {
          // ★ 2026-10-06 文案订正：旧版写「全库也没有同名文件」，但「全库」其实只有 `styles/` 树
          //   （`treeIndex(STYLES)`）—— 实测 `scifi-toon` 引 `` `sfx.py:9` `` 时被判「全库没有」，
          //   而 `D:/lemo-opuscar/core/audio/sfx.py` **确实存在**（同一段上文自己就写了全路径）
          //   ⇒ 让人去找一个其实存在的文件。现如实说明**搜索范围**与**怎么修**。
          push('(a) 文件不存在', `本风格树（styles/${slug}/）里没有 \`${refPath}\`。★ 本闸门按**文件名**只搜过两处：` +
            `「本风格树 + styles/ 全树（${styleSlugs.length} 个风格）」；**没有**按文件名搜 \`core/\`、\`scripts/\`、\`tools/\` 等树` +
            `（只有**带目录**的路径才会直接拼到这些根上试）—— 所以「styles 树里没有」**不等于**「仓里没有」。` +
            `若该文件其实在 \`core/\` 下，请把引用写成**带目录**的路径（如 \`core/audio/sfx.py:9\`）`, { refPath });
        } else {
          push('(a) 文件不存在', `路径解析不到：\`${refPath}\`（试过 ${rootsFor(file).length} 个根：${rootsFor(file).map((x) => path.relative('D:/', x).replace(/\\/g, '/')).slice(0, 4).join('、')}…）`, { refPath });
        }
        continue;
      }
      resolvedCount++;
      const target = res.p;
      const lines = getLines(target);
      const shown = path.relative('D:/', target).replace(/\\/g, '/');

      // ── (b) 行号在范围内 ──
      if (maxN > lines.length) {
        push('(b) 行号超范围', `\`${refPath}\` 指到第 ${maxN} 行，而 ${shown} 只有 ${lines.length} 行`, { refPath, target: shown });
        continue;
      }

      // ── (d) 被引行本身没有内容：空行 / `---` / 围栏 / 幻影行 ──
      //   ★ 只对**单点引用**生效（区间起点早一行是无害写法，见头注释）。
      //   为什么放在 (b) 之后、(c) 之前：(b) 一旦超范围就 `continue`（幻影行是**唯一**能让
      //   (b) 放行、而 (d) 抓到的形态）；(c) 只管「小句里有高置信片段」的少数引用，
      //   而 (d) 管的是**多数引用**（散文对散文），两者互不冲突、都要跑。
      if (!isRangeRef(rest)) {
        const realCount = lines.length - (lines[lines.length - 1] === '' ? 1 : 0);
        for (const n of nums) {
          const raw = lines[n - 1] ?? '';
          const t = raw.trim();
          if (n > realCount) {
            push('(d) 被引行没有内容', `\`${refPath}\` 指到第 ${n} 行，而 ${shown} 的**实际行数只有 ${realCount}**` +
              `（\`split('\\n')\` 的尾元素造成的**幻影行**，(b) 的 \`> lines.length\` 抓不到它）`, { refPath, target: shown });
            break;
          }
          if (t === '' || STRUCTURAL_LINE.test(t)) {
            push('(d) 被引行没有内容', `\`${refPath}\` 指到 ${shown} 第 ${n} 行，该行 ${describeLine(raw)}` +
              `（空行 / 分隔线 / 围栏 —— **没有可引的内容**，引用多半已随行号漂移）`, { refPath, target: shown });
            break;
          }
        }
      }

      // ── (c) 内容对得上（收窄后：小句内 + 距引用 ≤40 + 高置信片段）──
      const snips = spans
        .filter((x) => Math.min(Math.abs(x.e - start), Math.abs(end - x.i)) <= 40)
        .map((x) => x.t)
        .filter((t) => okSnippet(t, slug));
      if (!snips.length) continue;                                        // 没有可用片段 ⇒ 只做 (a)(b)
      cApplied++;
      const text = nums.map((n) => lines[n - 1] ?? '').join('\n');
      if (!snips.some((s) => snippetMatches(s, text))) {
        const at = nums.map((n) => `第 ${n} 行 = ${JSON.stringify((lines[n - 1] ?? '').trim().slice(0, 90))}`).join('；');
        push('(c) 内容对不上', `引的是 \`${refPath}\` 的 ${snips.map((s) => `\`${s}\``).join(' / ')}，但 ${shown} ${at}`, { refPath, target: shown, snippet: snips });
      }
    }
  });
}

// ── ★ 失明守卫 ──────────────────────────────────────────────────────────────
const blind = [];
if (refCount === 0) blind.push(`扫描范围内（${DOCS.length} 份文档 + ${SRCS.length} 份源码）**一个 \`<路径>:<行号>\` 引用都没找到** ⇒ 一个引用都没检查过`);
if (refCount > 0 && resolvedCount === 0) blind.push(`找到 ${refCount} 处引用，但**一处都解析不到文件** ⇒ 要么文档里的引用真的全坏、要么解析根配错了（先核对下面的 (a) 清单）`);

// ── 输出 ────────────────────────────────────────────────────────────────────
const byKind = (k) => fails.filter((f) => f.kind.startsWith(k));
console.log('散文里的 `<路径>:<行号>` 引用闸门\n');
console.log(`扫描：${DOCS.length} 份文档 + ${SRCS.length} 份源码`);
console.log(`  文档：test/README.md、_distill/AGENT-BRIEF.md、${skillSlugs.length} 份 SKILL.md、`);
console.log(`        ${DOCS.filter((p) => p.endsWith('_distill.json')).length} 份 _distill.json、MAINTAINING/TECHNIQUE/core/README、${styleSlugs.length}×2 份 STYLE|DEMO.md`);
console.log(`  源码：${topLevel(path.join(ROOT, 'lib'), /\.mjs$/).length} 份 lib/*.mjs、${topLevel(ROOT, /\.mjs$/).length} 份工具仓根 *.mjs、` +
  `${SRCS.filter((p) => /[\\/]demo[\\/]/.test(p)).length} 份 styles/*/demo/**、` +
  `${SRCS.filter((p) => p.includes(path.join(OPUSCAR, 'core'))).length} 份 core/**、` +
  `${SRCS.filter((p) => p.includes(path.join(OPUSCAR, 'tools'))).length} 份 tools/**、` +
  `${SRCS.filter((p) => p.startsWith(path.join(ROOT, 'scripts'))).length} 份 scripts/**（.mjs/.js/.py/.sh；已排除 vendor/、node_modules/、*.min.js；**本闸门自己不扫自己**）`);
console.log(`引用：${refCount} 处；解析到文件 ${resolvedCount} 处；其中 ${cApplied} 处进入 (c) 内容比对`);
console.log(`★ 另有**裸引用**（正文里不带反引号）${bareCount} 处 —— 本闸门**只认反引号包裹**的引用 ⇒ 这 ${bareCount} 处**从未被核对**（不计入上面的「引用」数；只列 backlog，见文末「盲区」）\n`);

const SHOW = { '(a)': '(a) 文件不存在', '(b)': '(b) 行号超范围', '(c)': '(c) 内容对不上', '(d)': '(d) 被引行没有内容（空行/分隔线/围栏/幻影行）' };
const KINDS = ['(a)', '(b)', '(c)', '(d)'];
for (const k of KINDS) {
  const list = byKind(k);
  console.log(`  ${list.length ? '✘' : '✓'} ${SHOW[k]}：${list.length} 处`);
}
for (const k of KINDS) {
  const list = byKind(k);
  if (!list.length) continue;
  console.log(`\n✘ ${SHOW[k]}（${list.length} 处）：`);
  for (const f of list) console.log(`  · ${f.where}  ${f.fragment}\n      ${f.detail}`);
}

if (backlog.length) {
  console.log(`\n○ 只列不判 FAIL（${backlog.length} 处）：`);
  const g = {};
  for (const b of backlog) (g[b.kind] ||= []).push(b);
  for (const [k, v] of Object.entries(g)) console.log(`  · ${k}：${v.length} 处`);
  if (bareCount) {
    // ★ 必须**明说这是盲区** —— 否则「只列不判」会被读成「已处理」，盲区就白列了。
    console.log(`\n  ★★ **盲区**：上面「${BARE_KIND}」的 ${bareCount} 处 = 正文里**不带反引号**的「路径 + 冒号 + 行号」。`);
    console.log(`     本闸门**只认反引号包裹**的引用 ⇒ 它们**一条都没被核对**（既不在上面的 (a)(b)(c)(d) 里，也不计入「引用：N 处」）。`);
    console.log(`     ⇒ **别把「引用失效 0 处」读成「引用全对」** —— 这 ${bareCount} 处是**盲区**，正确性零覆盖。`);
    console.log(`     ★ **不判 FAIL** 是因为按 (a)(b)(d) 判它们实测精度只有 ≈33%（裸引用拿不到「同小句路径感知」，会解析到同名错文件）。`);
    console.log(`     正确修法是**写作侧**：给它们补**反引号 + 带目录的路径**（见 \`_distill/AGENT-BRIEF.md\` 引用纪律第 12 条），不是改判据。`);
  }
  if (LIST_BACKLOG) for (const b of backlog) console.log(`      ${b.where}  ${b.fragment}\n        ${b.detail}`);
  else console.log('\n  （加 `--list-backlog` 逐条列出）');
}

if (blind.length) {
  console.log('\n✘ 本闸门已失明：');
  for (const b of blind) console.log(`  ✘ ${b}`);
}

console.log(`\n[闸门] 引用失效 ${fails.length} 处（a ${byKind('(a)').length} / b ${byKind('(b)').length} / c ${byKind('(c)').length} / d ${byKind('(d)').length}）、只列不判 ${backlog.length} 处（其中**裸引用盲区** ${bareCount} 处）${blind.length ? '、**已失明**' : ''} ${(fails.length || blind.length) ? '✘' : 'OK'}`);
process.exitCode = (fails.length || blind.length) ? 1 : 0;
