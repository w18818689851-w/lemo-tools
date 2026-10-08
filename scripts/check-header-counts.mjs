#!/usr/bin/env node
/**
 * scripts/check-header-counts.mjs —— 「闸门头注释 + 库仓文档里的**库级总数声称**」闸门
 *   （★ **写作时**本仓第 41 个 `check-*` 闸门；★ 序号是快照，别当判据 —— 见 ⑤）
 *
 *   ★ 2026-10-08 **扩扫描范围（第 2 批）**：判据①②③ 只守**工具仓 `scripts/check-*.mjs` 的头注释**；
 *     本批新增**判据⑤**，把**库仓** `MAINTAINING.md` / `TECHNIQUE.md` 两份文档里**同类**的
 *     「库级总数声称」也纳入（此前它们**没有任何闸门守** ⇒ 35/8→37/6 那类订正**将来还会静默漂**）。见 ②⑤。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 由来（承接 `check-gate-self-claims.mjs` **自陈的盲区**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   `check-gate-self-claims.mjs` 守「退出码声明 / 判据序号 / 失明线索」，并在它的
 *   ④ 段**明确登记**了一条盲区：「**不判**『头注释里的**实测数字**（误报率、条数、43/43…）
 *   是否可复现』—— 那要重跑每个闸门的语料/夹具，属**另一类闸门**」。
 *   ★ 上一批据此判定「头注释里的数字**机械做不准**」，把整类**留作边界**。
 *   本闸门**回头复核那个判断**，结论是：**部分过于悲观** —— 有一批数字的**真值可廉价算出**
 *   （一次 `readdirSync` / `readdir`，不重跑任何闸门），它们**能**被机械判定。见 ② 的判据表。
 *
 *   ★ 为什么要守：头注释是后人读一个闸门时的**唯一说明书**（`check-gate-self-claims` ① 段语）。
 *   里面写「**43** 份 `_distill.json`」「**43** 个风格」这类**库级总数**，一旦库变了（加风格 /
 *   删档案）而注释没跟，注释就**静默撒谎**，且**没有任何闸门会响**（`check-doc-coverage` 只守
 *   文档、不守闸门头注释；`check-gate-self-claims` 只守退出码/判据序号/失明线索）。本闸门补这一格。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（**只做「真值可廉价算出」的类**；宁可少做几条，也不要误报）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★ 设计纪律（照 `check-gate-self-claims` ② 段）：注释是**自然语言**，机械比对极易误报 ⇒
 *     本闸门**只锚定有固定写法的「总数声称」**，每条判据都先在**真实语料**上跑一遍、**逐条人读**、
 *     再定稿（见 ⑥ 的实测数）。**误报 > 0 的锚点要么收窄、要么整条不做**。
 *
 *   ★★ **头注释区的界定**（本闸门自己定的，与第 40 个闸门**不同**，故写清）：
 *     · 第 40 个闸门只扫**标题区前 6 行**（因为它的判据⑤ 只关心标题里的「第 N 个」）。
 *     · 本闸门扫**整个头注释块** = 第一处块注释起始符起、到第一个独立成行的**闭合注释行**止
 *       （与 `check-gate-self-claims.mjs` 的 `splitHead` **同一套切分**）。
 *     · ★ 理由：总数声称常出现在**更靠后的头注释段**（如「⑥ 实测」段写「枚举到 N 个风格」、
 *       「判据」段写「N 份 `_distill.json`」）—— 只扫前 6 行会**大面积漏判**（实测：本闸门
 *       的全部命中都在标题区**之外**）。
 *     · ★ 只扫**头注释块**，不扫代码体、不扫行注释（代码里的数字是**逻辑**，不是**声称**）。
 *
 *   **判据① 逐风格产物「份数」声称 == 实测份数**（★ 最硬的一条：`N 份 <逐风格产物>` 语义唯一）
 *     · 锚点（**固定写法**，捕获组 1 = 数字）：
 *         - `N 份 `_distill.json``  ⇒ 真值 = `lib/style-skills/<slug>/_distill.json` 的**份数**；
 *         - `N 份 style-dna`        ⇒ 真值 = `lib/style-dna/<slug>.json` 的**份数**；
 *         - `N 份 `DEMO.md``        ⇒ 真值 = `<库仓>/styles/<slug>/DEMO.md` 的**份数**（排除 `_template`）；
 *         - `N 份正文`              ⇒ 真值 = `lib/style-skills/<slug>/SKILL.md` 的**份数**（排除 `_TEMPLATE`
 *           —— 它有一份**模板** SKILL.md，不是真风格；本仓「正文」一词专指逐风格 SKILL.md 的正文，
 *           见 `check-tp-prose` / `check-skill-film-fields` 的头注释）。
 *       「份」= 副本数 ⇒ 「N 份 <逐风格产物>」就是**该产物的总份数**，不可能指子集
 *       （子集写法是「其中 N 份…」/「N 份…**有** X」，本闸门对**带子集标记**的命中**跳过**，
 *        见 ④ 的边界；实测真实语料里**没有**这种写法，见 ⑥）。
 *     · ★ **白名单是「策展」的、不追求穷尽**：只收**能从一个 `readdirSync` 现算**、且**本仓有稳定
 *       专名**的逐风格产物。泛称（`json` / `语料` / `风格 Skill 文档`…）**不认**（见 ④）。
 *
 *   **判据② 风格总数声称 == 实测风格数**
 *     · 锚点（**必须带总数标记**，否则不判 —— 这是防误报的关键）：
 *         - `全部/全库/全仓 N 个风格` ⇒ 真值 = `<库仓>/styles/` 下**目录数**（排除 `_template`）；
 *         - `` `styles/` N 个风格 ``   ⇒ 同上（路径前缀 = 库级）。
 *     · ★ **为什么不认裸 `N 个风格`**：实测真实语料里 `N 个风格` 出现 **22 次**，其中
 *       **只有 2 次**是**库级总数**（43），其余是**子集计数**（`42 个有 film*.js` / `34 个走 core`
 *       / `3 个自带 demo/mux.sh` / `1 个有 muxPatch`）或**当时快照**（`10 个` / `21 个` / `38 个`
 *       / `25 个`）。**把裸 `N 个风格` 一律当 43 判 ⇒ 至少 18 条误报**（这正是上一批判定
 *       「机械做不准」的真实来源，见 ③）。⇒ 只认带总数标记的写法。
 *
 *   **判据③ 闸门总数声称 == 实测闸门数**
 *     · 锚点：`现共 N 个 `check-*.mjs`` ⇒ 真值 = `scripts/check-*.mjs` 的**个数**（本闸门**含自己**）。
 *     · ★ **只认「现共」**（= 当前总数）；`第 N 个`（序号）由第 40 个闸门判据⑤ 管，本闸门**不重复**。
 *
 *   **判据⑤ 库仓文档里的库级总数声称 == 实测**（★ 2026-10-08 新增；**新增扫描根** = 库仓两份文档）
 *     · 扫描根 = `dirname(LEMO_STYLES_ROOT)` 下的 `MAINTAINING.md` / `TECHNIQUE.md`。
 *     · ★ **跨行折行要合并**：这两份文档里声称常被**折行**（`The **37** demos that` ⏎ `ship a \`build.sh\``），
 *       逐行匹配会**整条漏判**（`grep` 也看不见）⇒ 先 `flattenDoc()` 把**段落内折行**并成一行
 *       （保留「每个字符 → 原始行号」映射，命中仍能报出**原始行**）。
 *     · 锚点（**固定写法**，真值全部**环境无关** —— 都是提交进仓的源码/产品，一次 `readdirSync` 现算）：
 *         - `N demos that ship a \`build.sh\``            ⇒ 真值 = `styles/<slug>/demo/build.sh` 份数（**实测 37**）；
 *         - `N of the M styles ship none`                  ⇒ 真值 = `styles − buildSh`（**实测 6**）+ M = 风格数（43）；
 *         - `N of the M styles have a \`demo/film.js\``     ⇒ 真值 = `styles/<slug>/demo/film.js` 份数（**实测 42**）+ M（43）；
 *         - `N \`.srt\` files are committed`               ⇒ 真值 = `styles/<slug>/*.srt` 份数（**实测 41**）。
 *     · ★ **子集守卫**（③④）：数字前 8 字内有 `其中/只有/仅/另有/其余/only/just/among/some of` ⇒ 跳过；
 *       命中后**紧跟限定从句** `with/that/which/whose` ⇒ 读法两可（可能是子集）⇒ 跳过（防误报；真实语料 0 处）。
 *     · ★ **两层语义**：同行带 `写作时/当时/快照` 或**库仓文档的历史标记** `原记/原为/旧值/保留作历史…`
 *       ⇒ 只列 ℹ（库仓文档用「保留原句 + 追加更正」写法，历史值必须豁免）。
 *
 *   **判据④ 失明守卫（本闸门自己的，防空转绿灯）**
 *     · `scripts/` 下扫到 **0 个** `check-*.mjs` ⇒ **FAIL 并明说「本闸门已失明」**；
 *     · **0 条**「库级总数声称」被解析到（工具仓）⇒ **FAIL + 失明**（说明锚点写法变了 / 树不对）；
 *     · **全部真值来源都不可达**（连一份产物都算不出）⇒ **FAIL + 失明**；
 *     · ★ **新增扫描根也覆盖**：库仓**已识别**（`dirname(STYLES)` 下**同时**有 `core/` 与 `styles/`）
 *       时，`MAINTAINING.md` / `TECHNIQUE.md` **读不到** 或 **0 条文档声称** ⇒ **FAIL + 失明**
 *       （别让新根静默空转）。★ 库仓**未识别**（没装库仓 / 合成夹具树）⇒ **只 ℹ、不判失明**
 *       —— 与 `check-doc-coverage` 的「库仓不可达 ⇒ 只 ℹ」同口径（也让 `test/gate-blindness.test.mjs`
 *       的合成夹具树**不会**因缺两份文档而误红）。
 *     · ★ **失明时不再输出判据①②③⑤**（在失明的树上它们只会刷屏，且会被误读成「闸门有问题」）。
 *
 *   **两层语义（照抄本项目）**：命中若是**天生快照**（同行带 `写作时 / 当时 / 立闸门时 / 快照` 等
 *     限定词）或落在**已登记的积压**（`BACKLOG` 表）里 ⇒ **只列 ℹ、不判 FAIL**；
 *     **没记录的**陈旧声称 ⇒ **FAIL**。见 ④ 的边界与 ⑥ 的实测。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 误报率实测（**先跑真实语料、逐条人读命中，再定稿**；见 ⑥ 的数）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **判据①（份数类）首测即 0 误报**：`N 份 <逐风格产物>` 语义唯一（= 该产物总份数），
 *     真实语料 **15 处**命中全部等于实测（`_distill.json` 4 / 正文 8 / style-dna 2 / `DEMO.md` 1）
 *     ⇒ **0 误报**。
 *   · **判据②（风格总数）**：裸 `N 个风格` 版首测 **18 条误报**（见上）；**收窄为「带总数标记」**后
 *     真实语料 **2 处**命中，全部等于实测 ⇒ **0 误报**。
 *   · **判据③（闸门总数）首测即 0 误报**：2 处「现共 N 个」命中，**但都落在带快照限定词的同一行**
 *     （`check-line-endings` 同行有「当时」、`check-repro-form` 同行有「写作时」）⇒ 走**两层语义**
 *     只列 ℹ ⇒ **0 FAIL**（详见 ⑥ 与报告）。★ 判据③ 的**写法覆盖**盲区（只认「现共 N 个」这一种写法、
 *     且不扫 `_distill/*.md`）见 ⑧（含「扩锚点 ⇒ 真阳 0 / 误报 ≥6 ⇒ 不扩」的实测）。
 *   · ★ **收窄改的是「误报形态」还是「放宽判据」**：判据② 是**收窄**（从「所有 `N 个风格`」收到
 *     「带总数标记的 `N 个风格`」）—— 被排除的写法**本来就不是总数声称**，不是「放水」；
 *     判据① 与 ③ 是**首测即准**，未收窄。
 *   · ★ **判据⑤（库仓文档）首测即 0 误报**：4 个锚点在两份文档里命中 **9 条**（见 ⑥），
 *     **逐条人读**全部等于实测（37/6/43/42/41）⇒ **0 误报**。★ 收窄：给「数产物」类锚点加
 *     **`with/that/which/whose` 后置守卫**（子集写法「N demos that ship a `build.sh` **with** X」
 *     不判）—— 这是**收窄误报形态**（真实语料 0 处，夹具 7 证明其生效），**不是放宽判据**。
 *     ★ **不认**的写法（登记为边界，见 ④）：`954 font files`（**环境相关**，未 fetch 时真值 0）、
 *     `all 41 demos that ship a demo/fonts/`（**同因**）、`14/28/1 styles claim … ratios`（要 grep
 *     `aspects` 数组，口径随写法变）、真峰值/响度计数（要重测音频，**动态数据**）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做「动态数据快照」**：`实测 N/M 命中` / `误报 0` / `1161 处` / `2510 个字符串值` /
 *     `276 条去重字段路径` 这类数字要**重跑那个闸门的语料或夹具**才算得出，**不廉价**
 *     ⇒ 不判（属 `check-gate-self-claims` ④ 段登记的同一类盲区）。
 *   · **不认泛称写法**：`N 份 json` / `N 份语料` / `N 份风格 Skill 文档` / `N 个 token` / 裸
 *     `N 个风格` —— 泛称可能指**别的集合**，认它会引入误报风险。★ 实测它们当前**也都是 43**
 *     （正确），但本闸门**不判**（宁可漏判、不误报）。这是本闸门**最主要的边界**（见报告）。
 *   · **不判子集计数**：`N 个风格有 X` / `其中 N 份…` / `只有 N 个风格…` —— 真值要按「有 X 的风格」
 *     现算，口径随 X 变 ⇒ 不廉价、易误报 ⇒ 不判。★ 为防将来有人用「N 份 <产物>」写**子集**，
 *     本闸门跳过两类命中：(a) 数字前 8 字内有 `其中 / 只有 / 仅 / 另有 / 其余`；
 *     (b) 「份数」类里产物**紧跟** `有 / 带 / 含`（读法两可 ⇒ 不判）。
 *   · **不判 `第 N 个 check-* 闸门` 序号**：那是 `check-gate-self-claims` 判据⑤ 的活（只列不判），
 *     本闸门**不重复**（避免两个闸门对同一件事给出不同结论）。
 *   · **不判文档里的数字**：`test/README.md` / `_distill/AGENT-BRIEF.md` / 顶层 `README.md` 的计数
 *     声称已由 `check-doc-coverage.mjs` 的判据③ 守（含锚点唯一性）—— 本闸门只守**闸门头注释**
 *     与**库仓那两份文档**（判据⑤）；其余文档（`AGENTS.md` / `DIRECTOR.md` / `core/README.md`…）**不判**。
 *   · ★ **判据⑤ 的边界（本批如实登记「哪些类没做、为什么」）**：
 *     - **环境相关的字体计数不判**：`0 of the **954** font files` / `all **41** demos that ship a
 *       \`demo/fonts/\`` —— 字体目录被 `.gitignore` 排除，**未 fetch 的克隆真值是 0**、fetch 后才是
 *       954/41 ⇒ 真值**取决于本机状态**，判它会在新克隆上**假红**（与「真值可廉价、环境无关」的口径冲突）。
 *     - **要 grep 源码的计数不判**：`14 styles claim five ratios, 28 claim two, 1 claims nothing` /
 *       `27 of the \`build.sh\` scripts write a \`<slug>.srt\`` —— 真值要解析 `aspects` 数组 / 逐个
 *       `build.sh` 的内容，**口径随写法变**（数组换行、单双引号…），误报风险高 ⇒ 不判。
 *     - **动态数据快照不判**：真峰值/响度计数（`37 of 43 exceed …` / `1 is above 0 dBTP` /
 *       `only 6 pass` / `18 backups`…）要**重测音频 / 数备份目录**，属 `check-gate-self-claims` ④
 *       段登记的同一类盲区 ⇒ 不判。
 *     - **`D:/lemo-films` 侧不判**：`The 43 D:/lemo-films/<slug>/<slug>.mp4 files` 的样本片在**另一棵树**
 *       （可能没装）⇒ 不廉价、不稳 ⇒ 不判。
 *     - **泛称/子集/快照**照 ①②③ 的同一套（见上）。
 *   · **不做语义理解**：判据全部基于**固定写法的锚点**；注释里换个说法（如「风格数 43」）本闸门看不见。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑤ 序号与「快照」的关系
 * ══════════════════════════════════════════════════════════════════════════════
 *   本闸门自己的头注释也写了「写作时本仓第 41 个 `check-*` 闸门」—— 那是**写作时**的事实，
 *   带了「写作时」限定词 ⇒ 两层语义把它当**快照**（即使它命中判据③ 的写法，也只列 ℹ）。
 *   这就是本项目对序号/总数的正解：**写清是哪一刻的**，而不是让它变成一条会过期的断言。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑥ 实测（快照 2026-10-08，语料 = 本仓 `scripts/check-*.mjs` + 库仓两份文档）
 * ══════════════════════════════════════════════════════════════════════════════
 *   （本节数字由本闸门自己跑真实语料得出；见报告 `_distill/头注释计数闸门-2026-10-08.md`
 *    与 `_distill/头注释计数闸门-扩库仓扫描-2026-10-08.md`）
 *   · 真值（分母）：风格 `<库仓>/styles/` = 43（排除 `_template`）；`_distill.json` = 43；
 *     `style-dna` = 43；`SKILL.md`（正文）= 43（排除 `_TEMPLATE`）；`DEMO.md` = 43；
 *     `build.sh` = 37；`noBuildSh` = 6；`film.js` = 42；`*.srt` = 41；闸门 = 41（含本闸门）。
 *   · 解析到声称 **28 条**（= 工具仓 **19** + 库仓文档 **9**，真值全部可得）：
 *     - 判据①：**15 处**命中（`_distill.json` 4 / 正文 8 / style-dna 2 / `DEMO.md` 1），全部等于实测；
 *     - 判据②：**2 处**命中（「全部 N 个风格」与「`styles/` N 个风格」各 1 处），全部等于实测；
 *     - 判据③：**2 处**命中（「现共 N 个」），全部等于实测
 *       （★ 建闸门时这两处是 39/40 且带「当时/写作时」⇒ 只列 ℹ；本批并行智能体已改成 41 ⇒ 复跑转 ok）；
 *     - 判据⑤：**9 处**命中，逐条人读**全部等于实测**：
 *       · `MAINTAINING.md`：`build.sh·demos`=37、`no-build.sh·styles`=6、`·styles`=43、
 *         `film.js·styles`=42、`·styles`=43、`srt·committed`=41（**6 条**）；
 *       · `TECHNIQUE.md`：`build.sh·demos`=37、`no-build.sh·styles`=6、`·styles`=43（**3 条**）。
 *   · 汇总：与实测一致 **28 条**、只列 ℹ **0 条**、FAIL **0 条**。
 *   · 真实语料 **exit 0**（0 FAIL / 0 ℹ）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑦ 验证（**临时副本 + 覆盖点，全程不动真实仓**；同一套断言也写在
 *      `test/gate-blindness.test.mjs` 的 `check-header-counts` 用例里）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**（合成夹具树：2 风格 / 2 份档案，声称数与实测一致）⇒ **exit 0**。
 *   · **变异 A（判据①）**：夹具把 `N 份 `_distill.json`` 的 **N 写成 5**（实测 2）⇒ **exit 1** 并点名。
 *   · **变异 B（判据②）**：夹具把「全部 N 个风格」的 **N 写成 9**（实测 2）⇒ **exit 1** 并点名。
 *   · **变异 C（判据③）**：夹具把「现共 N 个 `check-*.mjs`」的 **N 写成 9**（实测 1）⇒ **exit 1** 并点名。
 *   · **反向验证**：分别**短路**判据①②③（整条比较 / 只放行 `styles` 类 / 只放行 `gates` 类）
 *     ⇒ 对应变异**重新变绿**（证明判据承重，不是摆设）；短路一类时**别类仍红**（证明三类各自承重）。
 *   · **失明两态**：空 `scripts/`（0 闸门）/ 有闸门但 0 条总数声称 ⇒ **均 exit 1 +「本闸门已失明」**，
 *     且**不输出判据①②③⑤**。
 *   · ★ **判据⑤ 的验证（2026-10-08 扩扫描范围时补；同一套断言也写在 `test/gate-blindness.test.mjs`）**
 *     —— 夹具树 = `dirname(LEMO_STYLES_ROOT)` 下**同时**有 `core/` + `styles/`（⇒ 库仓「已识别」）
 *     + 两份文档；真值：styles=2 / buildSh=1 / noBuildSh=1 / filmJs=1 / srtFiles=1 / gates=1：
 *     - **阴性对照**：文档声称全对（1/1/2/1/1）⇒ **exit 0**；
 *     - **变异 ⑤a**：`5 demos that ship a \`build.sh\``（实测 1）⇒ **exit 1** 并点名 `build.sh·demos`；
 *     - **变异 ⑤b**：`9 of the 2 styles ship none`（实测 1）⇒ **exit 1** 并点名 `no-build.sh·styles`；
 *     - **变异 ⑤c**：`1 of the 9 styles ship none`（M 错，实测 2）⇒ **exit 1** 并点名 `…·styles`；
 *     - **变异 ⑤d**：`film.js` 真值 2、文档写 1 ⇒ **exit 1** 并点名 `film.js·styles`；
 *     - **变异 ⑤e**：`5 \`.srt\` files are committed`（实测 1）⇒ **exit 1** 并点名 `srt·committed`；
 *     - **误报形态（子集）**：`the 5 demos that ship a \`build.sh\` **with** a custom mux` ⇒ **不判 ⇒ exit 0**；
 *     - **反向验证**：短路「判据⑤ 的比较」（`c.judge === 5 || …` ⇒ 恒 ok）⇒ 变异 ⑤a **重新变绿**（exit 0）
 *       且不再点名（证明判据⑤ 承重，不是摆设）；
 *     - **失明态（新根）**：库仓**已识别**但删掉 `TECHNIQUE.md` ⇒ **exit 1 +「本闸门已失明」**；
 *       文档可读但 **0 条声称** ⇒ **exit 1 +「本闸门已失明」**；库仓**未识别**（无 `core/`）⇒ **只 ℹ ⇒ exit 0**。
 *   ★ **本闸门也扫自己**（它是 `check-*.mjs`，`files` 含它）⇒ 它头注释里的**字面**声称**同样照判**；
 *     本文件**刻意**把所有**示例**写成 `N` 占位（不写具体数字），以免「举例里的数字」被自己判红
 *     —— 第 40 个闸门踩过同型的坑（它的 ⑥ 段举例 `第 39 个` 曾被判据⑤ 误列）。这不是放水：
 *     真声称写进头注释就照判，只是**本文件选择不写**。★ ⑥ 段的**实测数字**（37/6/42/41…）**不带**
 *     判据①②③ 的锚点写法（写的是 `` `build.sh` = 37 `` 而非 `37 份 …`），故**不会**自判；判据⑤ 的
 *     锚点**只对库仓两份文档**生效（`DOC_ANCHORS` 不扫本仓 `scripts/`）⇒ 本文件的说明文字天然安全。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ⑧ 已知盲区：判据③ 的**写法覆盖**（★ 2026-10-08 复核登记；与 ④ 的边界互补）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · 判据③ **只认「现共 N 个 `check-*.mjs`」这一种写法**。同义的其它写法 —— 裸 `N 个闸门` / `N 闸门`
 *     / `全部 N 个闸门` / `覆盖 N/N 个闸门` / 「既有 N 闸门」—— **本闸门看不见**；`_distill/*.md` 这类
 *     文档也**不在**扫描根内（判据①②③ 只扫 `scripts/check-*.mjs` 头注释、判据⑤ 只扫库仓两份文档）。
 *   · ★ **为什么不扩锚点（先跑真实语料、逐条人读，再定）**：把锚点扩到上述写法后，在真实语料
 *     （`scripts/check-*.mjs` 头注释）上命中 **12 处**，**真阳 0 / 误报 ≥6** —— `第 40 个闸门` 是**序号**
 *     （不是总数）、`21 / 27 / 28 / 29 个闸门全绿` 是**历史快照** ⇒ 命中几乎全是假阳。按本项目纪律
 *     「误报 > 0 的锚点要么收窄、要么整条不做」⇒ **不扩**（这是「不做」，不是「放宽」）。
 *   · ★ 当前已知的**陈旧**闸门数（本闸门抓不到、已由人工在各自文件里按「保留旧值 + 追加复核标记」改对）：
 *     - `_distill/总进度复盘与剩余任务计划-2026-10-07.md`：§一 / §三.6 的「现值 = **41** 闸门 / **103** 条」
 *       ⇒ 已追加「2026-10-08 复核（二次）」改为 **43** 闸门 / **110** 条；
 *     - `_distill/llm-api-接口规格-2026-10-08.md` §九：「既有 **41** 闸门」⇒ 已追加复核标记（现值 **43**）。
 *   · ★ **本闸门自己的 ⑥ 段**也写着 `闸门 = 41`（写作时快照）—— 该段**整段**带「快照 2026-10-08」限定词、
 *     属**合法历史**，**有意保留、不判**（同 ⑤ 段对「序号」的处置）。
 *
 * 用法：node scripts/check-header-counts.mjs [--json]
 * 环境变量：
 *   LEMO_TOOLS_ROOT   工具仓根（默认 `<脚本>/..`，与 `check-doc-coverage` / `check-line-endings` /
 *                     `check-gate-self-claims` / `check-redline-md5` **同名同义**）—— 扫描根 =
 *                     `<LEMO_TOOLS_ROOT>/scripts`，产物真值取 `<LEMO_TOOLS_ROOT>/lib/**`，
 *                     供**非破坏性变异验证**（指向临时夹具树，绝不动真实仓）。
 *   LEMO_STYLES_ROOT  库侧风格根（默认 `D:/lemo-opuscar/styles`，与 `check-doc-coverage` **同名同义**）
 *                     —— 供风格总数 / `DEMO.md` 份数 / `build.sh` / `film.js` / `*.srt` 份数的真值；
 *                     **不可达 ⇒ 跳过该类声称（只 ℹ、不判失明）**，与 `check-doc-coverage` /
 *                     `check-env-overrides` 的库仓口径一致。
 *                     ★ 判据⑤ 的**文档根 = `dirname(LEMO_STYLES_ROOT)`**（库仓根，**不新增覆盖点**）
 *                       —— 合成夹具树把两份文档放进 `dirname(LEMO_STYLES_ROOT)` 即可被扫到。
 * 退出码：0 = 所有**已判**的库级总数声称都与实测一致（快照类只列 ℹ、不影响退出码）；
 *         1 = 有 FAIL（总数声称 ≠ 实测），或**本闸门已失明**（含判据⑤ 的新扫描根失明）；
 *         2 = 前置不可用（读不到 `scripts/` 目录）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// ★ 覆盖点（同名同义于 check-doc-coverage / check-line-endings / check-gate-self-claims / check-redline-md5）。
const TOOLS_ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
const SCRIPTS = path.join(TOOLS_ROOT, 'scripts');
const LIB = path.join(TOOLS_ROOT, 'lib');
// ★ 库侧风格根：库仓是**另一个仓**（由安装向导 clone 而来），不能假设它在别人机器上存在
//   ⇒ 不可达 ⇒ 只 ℹ、不判失明（同 check-doc-coverage 判据③ 的库仓口径）。
const STYLES = path.resolve(process.env.LEMO_STYLES_ROOT || 'D:/lemo-opuscar/styles');
// ★ 新增扫描根（判据⑤）：库仓**两份文档**里的库级总数声称。
//   · 文档根 = `dirname(STYLES)`（库仓根）—— 与 `LEMO_STYLES_ROOT` **同源、不新增覆盖点**；
//     合成夹具树只要把两份文档放进 `dirname(LEMO_STYLES_ROOT)` 即可被扫到。
//   · 「库仓已安装」标记 `libIdentified` = `dirname(STYLES)` 下**同时**有 `core/` 与 `styles/`
//     （真实库仓的形状）—— 只有**已识别**时才要求文档可读 / 有声称，否则只 ℹ（同
//     `check-doc-coverage` 的「库仓不可达 ⇒ 只 ℹ、不判失明」口径）。
const LIB_ROOT = path.dirname(STYLES);
const DOC_FILES = ['MAINTAINING.md', 'TECHNIQUE.md'];
const JSON_OUT = process.argv.includes('--json');

/** 去掉「头注释行的 ` * ` 前缀」，得到纯文本。 */
const stripStar = (l) => l.replace(/^[\s*]+/, '');

/** 切出「头注释块」：第一处块注释起始符起、到第一个独立成行的闭合注释行止。找不到 ⇒ `null`。 */
function splitHead(src) {
  const L = src.split('\n');
  const i = L.findIndex((l) => /^\s*\/\*\*/.test(l));
  if (i < 0) return null;
  for (let j = i + 1; j < L.length; j++) {
    if (/^\s*\*\/\s*$/.test(L[j])) return L.slice(i + 1, j).join('\n');
  }
  return null;
}

/**
 * 把**整份文档**折成一行「段落内折行合并」文本，同时保留「每个字符 → 原始行号」的映射。
 * ★ 为什么需要：真实语料里库级总数声称会**跨行折行** —— MAINTAINING.md 写作
 *   `The **37** demos that` ⏎ `ship a \`build.sh\` …`、`**41** \`.srt\` files are` ⏎ `committed …`，
 *   逐行匹配会**整条漏判**（grep 也看不见）。空行只作分隔（仍插一个空格，防两段粘连成假串）。
 */
function flattenDoc(src) {
  const lines = src.split('\n');
  let text = '';
  const lineAt = [];
  const push = (s, ln) => { for (let k = 0; k < s.length; k++) { text += s[k]; lineAt.push(ln); } };
  for (let li = 0; li < lines.length; li++) {
    const t = lines[li].replace(/^\s+/, '').replace(/\s+$/, '');
    if (!t) continue;
    if (text.length) { text += ' '; lineAt.push(li + 1); }
    push(t, li + 1);
  }
  return { text, lineAt };
}

// ── 锚点表（判据①②③）────────────────────────────────────────────────────────
// ★ 每条的 `kind` 指向一个**真值键**（见下 `truth`）；`re` 必须带 `g`，捕获组 1 = 数字。
const ANCHORS = [
  // ── 判据①：逐风格产物「份数」（文件名唯一 ⇒ 语义无歧义）──
  { id: 'distill-份数', judge: 1, kind: 'distill',
    re: /(\d+)\s*份\s*`?_distill\.json`?/g,
    label: '「N 份 `_distill.json`」' },
  { id: 'style-dna-份数', judge: 1, kind: 'styleDna',
    re: /(\d+)\s*份\s*style-dna/g,
    label: '「N 份 style-dna」' },
  { id: 'DEMO.md-份数', judge: 1, kind: 'demoMd',
    re: /(\d+)\s*份\s*`?DEMO\.md`?/g,
    label: '「N 份 `DEMO.md`」' },
  { id: '正文-份数', judge: 1, kind: 'skDoc',
    re: /(\d+)\s*份\s*正文/g,
    label: '「N 份正文」' },
  // ── 判据②：风格总数（**必须带总数标记**，否则不判 —— 防误报的关键）──
  { id: '风格总数·全部', judge: 2, kind: 'styles',
    re: /(?:全部|全库|全仓)\s*\*{0,2}(\d+)\*{0,2}\s*个风格/g,
    label: '「全部/全库/全仓 N 个风格」' },
  { id: '风格总数·styles/', judge: 2, kind: 'styles',
    re: /`?styles\/`?\s*\*{0,2}(\d+)\*{0,2}\s*个风格/g,
    label: '「`styles/` N 个风格」' },
  // ── 判据③：闸门总数（只认「现共」；`第 N 个` 由第 40 个闸门判据⑤ 管）──
  { id: '闸门总数', judge: 3, kind: 'gates',
    re: /现共\s*\*{0,2}(\d+)\*{0,2}\s*个\s*`?check-\*`?/g,
    label: '「现共 N 个 `check-*.mjs`」' },
];

// ── 锚点表（判据⑤：库仓两份文档里的库级总数声称）──────────────────────────────
// ★ 只锚**固定写法**、**真值可一次 `readdirSync` 现算**、且**环境无关**的声称。
//   `kind2` = 第二个捕获组（「of the M styles」里的 M）另判一条（M 也须等于实测风格数）。
//   `afterGuard` = 命中后**紧跟限定从句**（with/that/which/whose）⇒ 读法两可（可能是子集）⇒ 跳过。
const DOC_ANCHORS = [
  { id: 'build.sh·demos', judge: 5, kind: 'buildSh',
    re: /\*{0,2}(\d+)\*{0,2}\s+demos?\s+that\s+ships?\s+a\s+`?build\.sh`?/g,
    afterGuard: /^\s*(with|that|which|whose)\b/i,
    label: '「N demos that ship a `build.sh`」' },
  { id: 'no-build.sh·styles', judge: 5, kind: 'noBuildSh', kind2: 'styles',
    re: /(\d+)\s+of\s+the\s+(\d+)\s+styles\s+ship\s+none/g,
    label: '「N of the M styles ship none」' },
  { id: 'film.js·styles', judge: 5, kind: 'filmJs', kind2: 'styles',
    re: /(\d+)\s+of\s+the\s+(\d+)\s+styles\s+have\s+a\s+`?demo\/film\.js`?/g,
    afterGuard: /^\s*(with|that|which|whose)\b/i,
    label: '「N of the M styles have a `demo/film.js`」' },
  { id: 'srt·committed', judge: 5, kind: 'srtFiles',
    re: /\*{0,2}(\d+)\*{0,2}\s+`?\.srt`?\s+files\s+are\s+committed/g,
    label: '「N `.srt` files are committed」' },
];

// ── 两层语义：快照限定词 / 已登记的积压 ─────────────────────────────────────
// ★ 命中若**同行**带这些限定词 ⇒ 天生是快照 ⇒ 只列 ℹ（照 check-gate-self-claims 的 SNAPSHOT_WORDS）。
const SNAPSHOT_WORDS = /(写作时|当时|建立时|立闸门时|本批|那时|新立时|快照)/;
// ★ 文档类（判据⑤）额外的**历史标记**：库仓文档用「保留原句 + 追加更正」的写法，
//   历史值常写成「原记 35 demos」/「旧值保留作历史」⇒ 同行带这些 ⇒ 只列 ℹ、不判 FAIL。
const DOC_HIST_WORDS = /(原记|原为|原值|旧值|旧记|曾记|保留作历史)/;
// ★ 已登记的积压：`{gate, id, n}` —— 已知陈旧、但**故意不判**（改它越过本闸门的职责/文件边界）。
//   本闸门建立时**为空**：真实语料里所有「已判」的声称都与实测一致（见 ⑥）。
const BACKLOG = [];

// ── 真值（一律从文件系统现算）────────────────────────────────────────────────
const truth = {};
const truthSrc = {};
const truthAvail = {};

// 风格目录（排除 _template）
try {
  const ents = fs.readdirSync(STYLES, { withFileTypes: true });
  truth.styles = ents.filter((e) => e.isDirectory() && e.name !== '_template').length;
  truthSrc.styles = `${STYLES}/*/（排除 _template）`;
  truthAvail.styles = true;
} catch {
  truthAvail.styles = false;
  truthSrc.styles = `${STYLES}（不可达）`;
}

// DEMO.md 份数（逐风格复现档；排除 _template）
if (truthAvail.styles) {
  try {
    const ents = fs.readdirSync(STYLES, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== '_template');
    truth.demoMd = ents.filter((e) => fs.existsSync(path.join(STYLES, e.name, 'DEMO.md'))).length;
    truthSrc.demoMd = `${STYLES}/*/DEMO.md（排除 _template）`;
    truthAvail.demoMd = true;
  } catch { truthAvail.demoMd = false; }
} else {
  truthAvail.demoMd = false;
  truthSrc.demoMd = truthSrc.styles;
}

// ── 判据⑤ 的真值（库仓侧，全部环境无关：这些产物都是**提交进仓**的源码/产品）──
if (truthAvail.styles) {
  try {
    const ents = fs.readdirSync(STYLES, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== '_template');
    truth.buildSh = ents.filter((e) => fs.existsSync(path.join(STYLES, e.name, 'demo', 'build.sh'))).length;
    truth.noBuildSh = truth.styles - truth.buildSh;
    truth.filmJs = ents.filter((e) => fs.existsSync(path.join(STYLES, e.name, 'demo', 'film.js'))).length;
    // 「N `.srt` files are committed」= `styles/<slug>/*.srt` 的**全部**份数（按文件名直接数，不假设名字）
    truth.srtFiles = ents.reduce((a, e) => {
      try { return a + fs.readdirSync(path.join(STYLES, e.name)).filter((f) => f.endsWith('.srt')).length; }
      catch { return a; }
    }, 0);
    truthSrc.buildSh = `${STYLES}/*/demo/build.sh（排除 _template）`;
    truthSrc.noBuildSh = `${truth.styles} 风格 − ${truth.buildSh} 带 build.sh`;
    truthSrc.filmJs = `${STYLES}/*/demo/film.js（排除 _template）`;
    truthSrc.srtFiles = `${STYLES}/*/*.srt（排除 _template）`;
    truthAvail.buildSh = true;
    truthAvail.noBuildSh = true;
    truthAvail.filmJs = true;
    truthAvail.srtFiles = true;
  } catch {
    truthAvail.buildSh = false; truthAvail.noBuildSh = false;
    truthAvail.filmJs = false; truthAvail.srtFiles = false;
  }
} else {
  truthAvail.buildSh = false; truthAvail.noBuildSh = false;
  truthAvail.filmJs = false; truthAvail.srtFiles = false;
  truthSrc.buildSh = truthSrc.styles; truthSrc.noBuildSh = truthSrc.styles;
  truthSrc.filmJs = truthSrc.styles; truthSrc.srtFiles = truthSrc.styles;
}

// _distill.json 份数
try {
  const base = path.join(LIB, 'style-skills');
  const ents = fs.readdirSync(base, { withFileTypes: true });
  truth.distill = ents.filter((e) => e.isDirectory()
    && fs.existsSync(path.join(base, e.name, '_distill.json'))).length;
  truthSrc.distill = `${base}/*/_distill.json`;
  truthAvail.distill = true;
} catch {
  truthAvail.distill = false;
  truthSrc.distill = `${path.join(LIB, 'style-skills')}（不可达）`;
}

// style-dna 份数
try {
  const base = path.join(LIB, 'style-dna');
  truth.styleDna = fs.readdirSync(base).filter((f) => f.endsWith('.json')).length;
  truthSrc.styleDna = `${base}/*.json`;
  truthAvail.styleDna = true;
} catch {
  truthAvail.styleDna = false;
  truthSrc.styleDna = `${base}（不可达）`;
}

// 逐风格 SKILL.md（「正文」）份数（排除 _TEMPLATE —— 它有一份模板 SKILL.md，不是真风格）
try {
  const base = path.join(LIB, 'style-skills');
  const ents = fs.readdirSync(base, { withFileTypes: true });
  truth.skDoc = ents.filter((e) => e.isDirectory() && e.name !== '_TEMPLATE'
    && fs.existsSync(path.join(base, e.name, 'SKILL.md'))).length;
  truthSrc.skDoc = `${base}/<slug>/SKILL.md（排除 _TEMPLATE）`;
  truthAvail.skDoc = true;
} catch {
  truthAvail.skDoc = false;
  truthSrc.skDoc = `${path.join(LIB, 'style-skills')}（不可达）`;
}

// ── 扫描闸门 ─────────────────────────────────────────────────────────────────
let files = [];
try {
  files = fs.readdirSync(SCRIPTS).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
} catch {
  // ★ 前置不可用 ⇒ exit 2（本项目惯例：2 = 前置不可用）。
  console.error(`✘ 读不到 \`${SCRIPTS}\`（目录不存在 / 不可读）⇒ 无法开工`);
  process.exit(2);
}
truth.gates = files.length;
truthSrc.gates = `${SCRIPTS}/check-*.mjs`;
truthAvail.gates = files.length > 0;

// ── 逐闸门抽声称 ─────────────────────────────────────────────────────────────
const claims = [];   // { gate, id, judge, kind, n, line, snap, backlog }
for (const f of files) {
  const full = path.join(SCRIPTS, f);
  let src;
  try { src = fs.readFileSync(full, 'utf8'); } catch { continue; }
  const head = splitHead(src);
  if (head === null) continue;
  for (const raw of head.split('\n')) {
    const line = stripStar(raw);
    for (const a of ANCHORS) {
      a.re.lastIndex = 0;
      for (const m of line.matchAll(a.re)) {
        // ★ 子集守卫（一）：数字前 8 字内若出现子集标记 ⇒ 这是**子集**计数，不是总数 ⇒ 跳过（不判）。
        const before = line.slice(Math.max(0, m.index - 8), m.index);
        if (/(其中|只有|仅|另有|其余)/.test(before)) continue;
        // ★ 子集守卫（二，只对「份数」类）：`N 份 <产物>` **紧跟** `有/带/含` ⇒ 读法两可
        //   （「N 份里有…」还是「N 份都有…」）⇒ 不判（防误报；真实语料 0 处，见 ⑥）。
        const after = line.slice(m.index + m[0].length, m.index + m[0].length + 2);
        if (a.judge === 1 && /^[有带含]/.test(after)) continue;
        const n = Number(m[1]);
        // ★ `N = 0` 是**失明哨兵**（「枚举到 0 个风格 / 0 份 `_distill.json` ⇒ 失明」），
        //   全项目一律如此写 ⇒ **不是**总数声称 ⇒ 跳过（首测误报 1 处，见 ③）。
        if (n === 0) continue;
        const snap = SNAPSHOT_WORDS.test(line);
        const backlog = BACKLOG.some((b) => b.gate === f && b.id === a.id && b.n === n);
        claims.push({ gate: f, id: a.id, judge: a.judge, kind: a.kind, n, line: line.trim().slice(0, 140), snap, backlog });
      }
    }
  }
}

// ── 扫描库仓两份文档（判据⑤）──────────────────────────────────────────────────
// ★ 「库仓已安装」标记：`dirname(STYLES)` 下**同时**有 `core/` 与 `styles/`（真实库仓的形状）。
//   合成夹具树没有 `core/` ⇒ 不误判失明（同 `check-doc-coverage` 的库仓口径）。
let libIdentified = false;
try {
  libIdentified = fs.statSync(LIB_ROOT).isDirectory()
    && fs.statSync(path.join(LIB_ROOT, 'core')).isDirectory()
    && fs.statSync(STYLES).isDirectory();
} catch { libIdentified = false; }

const docClaims = [];      // 判据⑤ 的命中
const docRead = {};        // 文件名 → 是否读到
for (const df of DOC_FILES) {
  let src;
  try { src = fs.readFileSync(path.join(LIB_ROOT, df), 'utf8'); } catch { docRead[df] = false; continue; }
  docRead[df] = true;
  const { text, lineAt } = flattenDoc(src);
  const rawLines = src.split('\n');
  for (const a of DOC_ANCHORS) {
    a.re.lastIndex = 0;
    for (const m of text.matchAll(a.re)) {
      // ★ 子集守卫（三）：数字前 8 字内若出现子集标记（中/英）⇒ 子集计数 ⇒ 跳过。
      const before = text.slice(Math.max(0, m.index - 8), m.index);
      if (/(其中|只有|仅|另有|其余|\bonly\b|\bjust\b|\bamong\b|\bsome of\b)/i.test(before)) continue;
      // ★ 子集守卫（四）：命中后**紧跟限定从句**（with/that/which/whose）⇒ 读法两可（可能是子集）⇒ 跳过。
      if (a.afterGuard) {
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
        if (a.afterGuard.test(after)) continue;
      }
      const ln = lineAt[m.index] || 1;
      const line = (rawLines[ln - 1] || '').trim();
      const n = Number(m[1]);
      // ★ `N = 0` 是失明哨兵（「0 of the 954 font files」这类）⇒ 不是总数声称 ⇒ 跳过。
      if (n === 0) continue;
      const snap = SNAPSHOT_WORDS.test(line) || DOC_HIST_WORDS.test(line);
      docClaims.push({ gate: df, id: a.id, judge: 5, kind: a.kind, n, line: line.slice(0, 140), snap, ln });
      // ★ `kind2`：第二个捕获组（「of the M styles」的 M）另判一条 —— M 也须等于实测风格数。
      if (a.kind2 && m[2] !== undefined) {
        docClaims.push({ gate: df, id: `${a.id}·styles`, judge: 5, kind: a.kind2, n: Number(m[2]), line: line.slice(0, 140), snap, ln });
      }
    }
  }
}

// ── 判据①②③⑤：判定 ──────────────────────────────────────────────────────────
const fails = [];    // 判定为不符（→ FAIL）
const infos = [];    // 只列不判（真值不可达 / 快照限定词 / 已登记积压）
let judged = 0;
for (const c of [...claims, ...docClaims]) {
  if (!truthAvail[c.kind]) {
    c.verdict = 'info';
    c.why = '真值来源不可达（库仓缺失？）⇒ 跳过（只 ℹ、不判）';
    infos.push(c);
    continue;
  }
  judged++;
  c.actual = truth[c.kind];
  if (c.n === truth[c.kind]) { c.verdict = 'ok'; continue; }
  if (c.snap) {
    c.verdict = 'info';
    c.why = '同行带快照/历史限定词（写作时/当时/快照/原记…）⇒ 天生是快照，只列不判';
    infos.push(c);
    continue;
  }
  if (c.backlog) {
    c.verdict = 'info';
    c.why = '落在 BACKLOG 登记表（已登记的积压）⇒ 只列不判';
    infos.push(c);
    continue;
  }
  c.verdict = 'fail';
  fails.push(c);
}

// ── 判据④ 失明守卫（防空转绿灯；失明时**不再输出判据①②③**）──────────────────
const blindReasons = [];
if (files.length === 0) {
  blindReasons.push(`\`${SCRIPTS}\` 下扫到 **0 个** \`check-*.mjs\`（路径 / 过滤变了？）⇒ 判据①②③ 一条都没跑`);
} else if (claims.length === 0) {
  blindReasons.push(`扫到 ${files.length} 个闸门，但**一条**库级总数声称都没解析到 ⇒ 判据①②③ 空转（锚点写法变了？）`);
}
if (!truthAvail.distill && !truthAvail.styleDna && !truthAvail.skDoc && !truthAvail.styles) {
  blindReasons.push('**全部**真值来源都不可达（`lib/style-skills` / `lib/style-dna` / 库侧 `styles`）⇒ 一份产物都算不出');
}
// ★ 判据⑤ 的失明守卫（**新增扫描根**，别静默空转）：只在「库仓已安装」（有 `core/` + `styles/`）时要求文档可读 / 有声称。
if (libIdentified) {
  for (const df of DOC_FILES) {
    if (!docRead[df]) {
      blindReasons.push(`库仓文档根 \`${LIB_ROOT}\` 已识别（有 \`core/\` + \`styles/\`），但 \`${df}\` **读不到** ⇒ 判据⑤ 的该文档**失明**（新增扫描根静默空转）`);
    }
  }
  if (docClaims.length === 0) {
    blindReasons.push(`库仓文档根 \`${LIB_ROOT}\` 已识别、两份文档也读到了，但**一条**文档类库级总数声称都没解析到 ⇒ 判据⑤ 空转（锚点写法变了 / 文档被改写？）`);
  }
}
const blind = blindReasons.length > 0;
const ok = !blind && fails.length === 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
const judgeOf = (n) => (n === 1 ? '判据① 逐风格产物份数'
  : n === 2 ? '判据② 风格总数'
    : n === 3 ? '判据③ 闸门总数'
      : '判据⑤ 库仓文档总数声称');

if (JSON_OUT) {
  console.log(JSON.stringify({
    scripts: SCRIPTS,
    styles: STYLES,
    libRoot: LIB_ROOT,
    docs: DOC_FILES,
    headRegion: '头注释块（第一处 /** 到闭合 */，不是标题区前 6 行）',
    gates: files.length,
    truth: {
      styles: truthAvail.styles ? truth.styles : null,
      distill: truthAvail.distill ? truth.distill : null,
      styleDna: truthAvail.styleDna ? truth.styleDna : null,
      skDoc: truthAvail.skDoc ? truth.skDoc : null,
      demoMd: truthAvail.demoMd ? truth.demoMd : null,
      buildSh: truthAvail.buildSh ? truth.buildSh : null,
      noBuildSh: truthAvail.noBuildSh ? truth.noBuildSh : null,
      filmJs: truthAvail.filmJs ? truth.filmJs : null,
      srtFiles: truthAvail.srtFiles ? truth.srtFiles : null,
      gates: truth.gates,
    },
    truthSrc,
    libIdentified,
    docRead,
    parsed: claims.length + docClaims.length,
    parsedTools: claims.length,
    parsedDocs: docClaims.length,
    judged,
    claims: [...claims, ...docClaims].map((c) => ({
      gate: c.gate, judge: c.judge, id: c.id, kind: c.kind, claimed: c.n,
      actual: c.actual === undefined ? null : c.actual,
      verdict: c.verdict,
      line: c.line,
    })),
    fails: fails.map((f) => ({ gate: f.gate, judge: f.judge, id: f.id, claimed: f.n, actual: f.actual, line: f.line })),
    infos: infos.map((i) => ({ gate: i.gate, judge: i.judge, id: i.id, claimed: i.n, actual: i.actual ?? null, why: i.why, line: i.line })),
    blind: blindReasons,
    counts: { fails: fails.length, infos: infos.length, blind: blindReasons.length },
    ok,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

console.log('闸门头注释计数闸门 —— 守「`scripts/check-*.mjs` 的**头注释** + 库仓两份文档里**库级总数声称** ↔ **实测**」');
console.log('  判据: ① 逐风格产物份数（`_distill.json` / style-dna / `DEMO.md`）== 实测 | ② 风格总数 == 实测 |');
console.log('        ③ 闸门总数 == 实测 | ⑤ 库仓文档总数声称 == 实测 | ④ 失明守卫（0 闸门 / 0 声称 / 文档读不到 ⇒ 失明）');
console.log('  头注释区: **整个头注释块**（第一处 `/**` 到闭合 ` */`；不是标题区前 6 行 —— 总数声称常在更靠后的段）');
console.log(`  扫描: ${SCRIPTS}（${files.length} 个闸门）`);
console.log(`        + 库仓文档 ${DOC_FILES.join(' / ')}（${libIdentified ? '库仓已识别' : '库仓未识别 ⇒ 只 ℹ'}）`);
console.log('  真值（分母，一律从文件系统现算）:');
for (const k of ['styles', 'distill', 'styleDna', 'skDoc', 'demoMd', 'buildSh', 'noBuildSh', 'filmJs', 'srtFiles', 'gates']) {
  console.log(`    · ${k.padEnd(9)} = ${truthAvail[k] === false ? '（不可达 ⇒ 跳过该类声称）' : truth[k]}   ← ${truthSrc[k]}`);
}
console.log('');

if (blind) {
  console.log('✘ 本闸门已失明：');
  for (const r of blindReasons) console.log(`  ✘ ${r}`);
} else {
  if (fails.length) {
    console.log(`✘ 头注释 / 库仓文档里的库级总数声称与实测不符 ${fails.length} 处：\n`);
    for (const j of [1, 2, 3, 5]) {
      const g = fails.filter((x) => x.judge === j);
      if (!g.length) continue;
      console.log(`  ── ${judgeOf(j)}（${g.length} 处）──`);
      for (const x of g) {
        // ★ 措辞按来源分：工具仓头注释写「头注释写」、库仓文档写「文档写」（`test/gate-blindness.test.mjs`
        //   的变异 A/B/C 断言的是**逐字** `…：头注释写 **N**、实测 **M**` ⇒ 这里必须逐字保留）。
        const wrote = x.judge === 5 ? '文档写' : '头注释写';
        console.log(`    · ${x.gate.padEnd(34)} ${x.id}：${wrote} **${x.n}**、实测 **${x.actual}**`);
        console.log(`        ${x.line}`);
      }
      console.log('');
    }
  } else {
    console.log(`✓ 判据①②③⑤ 命中 0（真值可得的库级总数声称 ${judged} 条，全部与实测一致或走两层语义；只列 ℹ ${infos.length} 条，见下）。`);
  }

  if (infos.length) {
    console.log(`\nℹ 只列不判 ${infos.length} 条（快照限定词 / 已登记积压 / 真值不可达 ⇒ 不判 FAIL）：`);
    for (const i of infos) {
      const t = i.actual === undefined ? '?' : i.actual;
      console.log(`    · ${i.gate.padEnd(34)} ${i.id}：写 **${i.n}**、实测 **${t}** —— ${i.why}`);
    }
  }

  const byJudge = (j) => fails.filter((x) => x.judge === j).length;
  console.log(`\n[闸门] 闸门 ${files.length} 个 / 解析到声称 ${claims.length} 条（工具仓）+ ${docClaims.length} 条（库仓文档） / 已判 ${judged} 条`
    + ` / 判据① FAIL ${byJudge(1)} / 判据② FAIL ${byJudge(2)} / 判据③ FAIL ${byJudge(3)} / 判据⑤ FAIL ${byJudge(5)}`
    + ` / ℹ 只列不判 ${infos.length} ${ok ? 'OK' : '✘'}`);
}
process.exitCode = ok ? 0 : 1;
