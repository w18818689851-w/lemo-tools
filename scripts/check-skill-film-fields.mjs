#!/usr/bin/env node
/**
 * scripts/check-skill-film-fields.mjs
 *   —— SKILL.md **正文**里的「成片帧数 / 分辨率 / 时长」声称是否与实测一致
 *
 * ① 由来（2026-10-04）：
 *   `check-tp-prose.mjs` 只覆盖正文里的**真峰值**声称；**帧数 / 分辨率 / 时长**这三类
 *   「关于成片」的正文数字**没有任何闸门**。实测就漏过一处：
 *   `paper-lantern/SKILL.md:114` 写着「已渲染的 **2922** 帧画面可直接复用」，
 *   而该风格 `_distill.json#generatedVideo.frames` 已是 **2923**
 *   （2026-10-04 全量重渲后差 1 帧，长期无人发现 —— 人读正文会得到与机器不同的答案）。
 *
 * ② 判据（沿用 `check-tp-prose.mjs` 的整套思路：**只认关于本片成片的声称**）：
 *   · 数据源 = 每风格 `lib/style-skills/<slug>/_distill.json#generatedVideo`
 *     （frames / width / height / durSec）；正文源 = 同风格 `SKILL.md`。
 *   · 三类声称按可靠性分级：
 *     1) **帧数**   `(\d{3,5})\s*帧`（只认 ≥ 100，容差 0）           → 可判 FAIL
 *     2) **分辨率** `(\d{3,4})\s*[×x]\s*(\d{3,4})`（容差 0）        → 可判 FAIL
 *     3) **时长**   `(?<![\w.\-])(\d+(?:\.\d+)?)\s*s\b`（差 > 1s）  → **只列「参考」**
 *   · 四条同时满足才记 FAIL：
 *     ① 值本身可疑（帧数 ≥ 100；分辨率 ≥ 100×100）；
 *     ② 与**本风格实测**不符（帧数/分辨率容差 0，时长差 > 1s）；
 *     ③ **成片语境** —— 帧数看**整行**含「成片/全片/本片/帧数/帧率/入库版」；
 *        分辨率看**近邻 60 字**内含「成片/全片/本片/交付/输出」；
 *     ④ 所在**整行**没有历史语境标记（`HIST` 正则，与 `check-tp-prose.mjs` 逐字一致）；
 *        但同行若**同时**含「当前结论」标记（`CUR`）⇒ **不豁免**（见下方 ★★ CUR 反向守卫）。
 *   ★ 另加「**非本片来源**」排除：近邻 60 字内出现 `原生/样片/demo/DEMO/入库前/未渲/声明/设计稿`
 *     ⇒ **不判 FAIL**（那是设计期尺寸 / 风格声明值，不是本片成片的声称）。
 *   ★ 分辨率再加「**非假设语境**」排除：近邻 60 字内含
 *     `硬渲/渲成/裁/塞在/竖屏/内部/内含/超采样/世界/场景/片门/模板/画布/渲染/若/如果`
 *     ⇒ 不判（那是「若硬渲成 1080×1920 会怎样」这类推导，不是成片分辨率）。
 *   ★ 单列「**交叉引用**」：**别的风格名**与读数落在**同一子句**的，说明是在引用他片的值当先例，
 *     不计 FAIL，供人工判断（与 `check-tp-prose.mjs` 的 ⑨ **逐字同义**，分隔符同一套 `。！？；;`）。
 *
 *   ★★ 误报率实测与收窄动作（2026-10-04，43 份正文）：
 *     · **最宽判据**（只认 ① 值 ≥100 + ② 与实测不符）→ 帧数报 **26** 条。
 *       逐条人工判断（成片都用 ffprobe 复核过）：**真陈旧 11 条**
 *       （`hd-2d` 5 / `paper-lantern` 3 / `pictogram-motion` 3），
 *       **误报 15 条 = 57.7%** —— 全是「demo 原生 30fps/900 帧」「样片 7980 帧」
 *       「非移轴版 video_gpu.mp4（24 fps / 1836 帧）与移轴版 video_tilt.mp4（60 fps / 4590 帧）」
 *       这类**设计期 / 他版**帧数。⇒ 收窄：加 ③（成片语境）+ ④（历史语境）+ 原生来源排除。
 *     · 收窄后帧数报 **9** 条，**误报 0 条**（= 11 条真陈旧里，`hd-2d:138` 因同行 `DEMO.md`、
 *       `pictogram-motion:170` 因整行历史语境被排除 —— 这 2 条属已知局限，见 ③）。
 *     · 分辨率：328 处 `W×H` 里 **107 处与成片尺寸不符**，但加 ③（近邻含「成片」）后只剩
 *       **1** 条 —— 且它是**误报**（`paper-lantern:187`「硬渲 1080×1920 时母版被 1:1 塞在左上角」）。
 *       再加「非假设语境」排除后 → **0** 条。⇒ 分辨率**不加这两道守卫就是 100% 噪声**。
 *     · 时长：1874 处 `<数>s` 里 **60 处**落在「成片」近邻且与 durSec 差 > 1s，但绝大多数是
 *       **出片耗时 / 片段时长 / 静帧时长**（「渲染 1272 帧耗时 207s」「静默小节 26–28 s」
 *       「音频链 46.2s」）。要把它收窄到高精度只能靠「成片实测/全片时长」这类自定义锚点，
 *       而锚点一旦漏写就静默失明 ⇒ **按纪律降级为「参考」，不进退出码**。
 *
 *   ★★ CUR 反向守卫（2026-10-07 加固；修的是「整行历史语境豁免过宽」这个缺陷）：
 *     · **缺陷**：④ 只判「整行有历史语境」就**整行豁免**。但项目习惯是**保留原句 + 追加更正**，
 *       于是会出现**同一行里既有历史叙述、又有当前结论**（「原先只走 X，**现已切到 Y**」）。
 *       这类行里的**当前读数**会逃过检查 —— 正是本项目最忌讳的「文档撒谎而闸门失明」。
 *     · **修法**：`if (HIST.test(line) && !CUR.test(line)) continue;`。
 *       `CUR` 正则与 `check-aspect-prose.mjs` 的 `CUR` 常量 **逐字一致**（同项目已用这道保险治过同一个病，
 *       机制直接移植）。帧数 / 分辨率 / 时长**三处口径一并对齐**（时长只列参考、不进退出码，故不影响退出码）。
 *     · **量化**（插桩副本，放仓库外 `D:/lemo-tmp/`，真实语料 43 份正文）：
 *       走到 HIST 判定处的 token **62** 个（帧数 7 / 分辨率 4 / 时长 51），
 *       其中**被 HIST 豁免**的 **22** 个（帧数 7 / 分辨率 4 / 时长 11），
 *       其中**所在行同时匹配 CUR 的 0 个** ⇒ 真实语料**零误报**：
 *       改前改后输出**逐字节一致**（`陈旧帧数 0 / 陈旧分辨率 0 / 参考时长 40 / 失明 1`，exit 0，md5 相同）。
 *     · **反向夹具**（仓库外 `D:/lemo-tmp/fffix/probe-style/`，`generatedVideo.frames=100`）：
 *       `已修：成片帧数原为 100 帧，现状 999 帧。` ⇒ **改前 exit 0 / 改后 exit 1、陈旧帧数 1**；
 *       而只有 HIST、没有 CUR 的那行（`已修：成片帧数原为 120 帧（历史记录）。`）**仍被豁免**
 *       （判别版把 HIST 豁免整条移除后会报 2 处，证明第二行确实走到了 ④ 判定处、豁免是承重的）。
 *     · ★ 为做**非破坏**反向测试，本闸门新增覆盖点 `LEMO_DISTILL_ROOT`
 *       （与 `check-tp-prose.mjs:325` **同名同义**）：环境变量不设时逐字等价于原硬编码路径，
 *       已自证改前改后输出 md5 不变。**绝不**为此改真实语料。
 *
 *   ★★ ⑨ 交叉引用**作用域收窄**（2026-10-07 b84-a；修的是「整行豁免过宽」这个缺陷）：
 *     · **缺陷**：⑨ 原按**整行**判 —— 一行里**任意位置**出现别的风格名，就把**整行**的读数一起放掉。
 *       本库的长表格行常「前一句报本片读数、后一句引用他片当先例」⇒ 本片的陈旧读数被顺带豁免（**假绿**）。
 *       同型缺陷 `check-tp-prose.mjs` 已于 b83-a 修掉（它的 ⑨ 收到**同一子句**）——本闸门当时未同步 ⇒ 分叉。
 *     · **修法**：`others.some((o) => clauseOf(line, m.index).includes(o))`，
 *       `CLAUSE_SEP = /[。！？；;]/g` 与 `check-tp-prose.mjs` **逐字一致**（不引入第二套）。
 *     · **误报率实测（真实 43 份正文；逐级，命中 = 真阳性 + 误报）**：
 *       | 作用域 | 走到 ⑨ 的 token | 命中 | 真阳性 | 误报 | 交叉引用桶 |
 *       |---|---|---|---|---|---|
 *       | **整行（改前）** | 0 | 0 | 0 | 0 | 0 |
 *       | **同一子句（改后）** | 0 | 0 | 0 | 0 | 0 |
 *       ⇒ 真实语料上 ⑨ **当前排除 0 个 token**（帧数 / 分辨率都到不了 ⑨：③ 成片语境 / ⑧ NATIVE / ④ HIST 先挡下，
 *         逐级计数：帧数 154 token → 疑 23 → 有 ③ 语境 17 → 过 ⑧ NATIVE 7 → ④ HIST 7 → **过 ④ 0**；
 *         分辨率 448 → 疑 176 → 有 ③ 语境 8 → 过 ⑧ HYPO 4 → ④ HIST 4 → **过 ④ 0**）
 *         ⇒ 收窄**在真实语料上零影响**：改前改后输出**逐字节一致**
 *         （`陈旧帧数 0 / 陈旧分辨率 0 / 参考时长 39 / 失明 1`，exit 0；仅汇总行按本批新增
 *         `参考画幅朝向 0 处 / 交叉引用 0 处` 两列 —— ★ 上一条 CUR 节的快照写的是「参考时长 **40**」，
 *         与本次实测的 **39** 差 1，属**上一批的快照漂移**，如实登记、未改那句历史快照）。
 *         ★ 因此本条的实测依据**不能只看真实语料**（那是退化的「0 → 0」）⇒ 另造**合成夹具**（下条）。
 *     · **合成夹具**（真实 44 风格树拷贝 + 追加注入行；`D:/lemo-tmp/b84-a/tree-inj`，**不动真实文档**）：
 *       `hd-2d`（实测 1836 帧 / 1920×1080）追加 3 行：
 *         `本片成片帧数 9999 帧。队里 pictogram-motion 曾到 3926 帧。`（读数在前子句、风格名在后子句）
 *         `本片成片帧数 8888 帧（对比 pictogram-motion 的 3926 帧）。`（同子句 ⇒ 合法交叉引用）
 *         `本片成片分辨率 1600×900。队里 pictogram-motion 曾到 1080×1920。`
 *       `pictogram-motion` 追加 `本片成片帧数 7777 帧（对比 hd-2d 的 1836 帧）。`
 *       实测：**改前**（整行 ⑨）`陈旧帧数 0 / 陈旧分辨率 0 / 交叉引用 8`，**exit 0**（4 处真陈旧全被放掉）；
 *             **改后**（同子句 ⑨）`陈旧帧数 1 / 陈旧分辨率 1 / 交叉引用 5`，**exit 1**（点名 `hd-2d:9999`、`hd-2d:1600×900`）。
 *       ⇒ 命中 2 = 真阳性 2 / **误报 0**（另 5 处确为合法交叉引用、2 处走朝向守卫）。
 *       ★ **反向证明（隔离）**：只把 ⑨ 改回整行（保留朝向守卫）⇒ 同一夹具**变绿**（`陈旧 0/0`，exit 0）；
 *         即「收窄承重」。另一路只去掉朝向守卫（保留同子句 ⑨）⇒ `陈旧分辨率 2`（多出 9:16 变体）⇒ 朝向守卫也承重。
 *     · **与 `check-tp-prose.mjs` 的一致性**：同一注入夹具上，`check-tp-prose` 报
 *       `陈旧读数 2 处（WxH 1 / frame 1）/ 交叉引用 5`、exit 1 —— **与本闸门逐项一致**（frame 1 + WxH 1 + xref 5）。
 *     · ★ **⑨ 收窄暴露的 ⑧ 缺口（已补）**：`art-deco:43` 的 9:16 变体 `1080×1920`（本片 1920×1080）这类 token，
 *       旧版 ⑨ 按整行判时常因同行提到别的风格被顺带豁免；⑨ 收到子句后它会露出来 ⇒ 补 **WxH 朝向守卫**
 *       （token 横竖与成片相反 ⇒ 不是本片画幅；**推「参考」桶、不静默丢弃**，与 `check-tp-prose.mjs` b83-a 同源）。
 *       实测：本库真实语料该桶 **0 处**（`art-deco:43` 在 ③ 就被挡下）；合成夹具该桶 **2 处**。
 *     · ★ **本闸门是否应「退化为 `check-tp-prose` 的登记项」（收敛重复实现）—— 本轮结论：暂不**。
 *       依据（实测）：① 该做法会改动「闸门总数」（现 **31**），而该数字**写死在 5 个文件**里，其中
 *       `_distill/RETRO-2026-10-07-b81.md`、`RETRO-2026-10-07-b82.md`、`总进度复盘与剩余任务计划-2026-10-07.md`
 *       **不在本批可改范围**（前两个是**带日期的历史复盘**，改了就是伪造历史）⇒ 强行删除会留下**文档撒谎**。
 *       ② 删/薄封装**不影响任何判据结论**（两闸门在本库与合成夹具上结论逐项一致）⇒ 收益是「去重复」，
 *       成本是「跨 5 文件同步 + 一处漏改即假绿」。⇒ 建议留给**能同时改这 5 个文件**的一批，
 *       并**先**把两闸门在同一合成夹具上跑出「结论逐项一致」的证据（本轮已备好该夹具与口径）。
 *
 * ③ 已知局限：
 *   · 只认**字面量**：正文若写「约两分钟」「一帧不差」，闸门看不见（假阴）。
 *   · 帧数的「成片语境」用**整行**判定（这些表格行很长，行首的「成片 |」「帧数 |」离数字常 > 60 字）——
 *     所以一行里同时出现「原生设计帧数」与「成片帧数」时，靠**近邻**排除原生那个、仍报成片那个；
 *     若两者挨得太近，会漏（如 `hd-2d:138` 的「本次已按此实渲」因同行 `DEMO.md` 被排除）。
 *   · 分辨率只看 `W×H` 这一种写法（`1080p` / `1920 by 1080` 看不见）。
 *   · 时长永远是「参考」，不进退出码（依据见上）。
 *   · **⑨ 交叉引用按「同一子句」判**（2026-10-07 收窄）⇒ 若一行里「别的风格名」与「本片读数」
 *     被 `，` 隔开但**同属一个子句**，仍算交叉引用、不判 FAIL（与 `check-tp-prose.mjs` 同口径；
 *     实测：把分隔符扩到 `，` 会放进上游读数误报 ⇒ 两边都**只到 `；`**）。
 *   · **WxH 朝向守卫**只认「横竖相反」这一种非本片画幅；同朝向的变体尺寸（如 1280×720 的 16:9 版）
 *     仍会走到 FAIL 判定 —— 实测本库无此例（该桶 0 处）。
 *   · 只比对 `generatedVideo`；**不判断 json 自己的 `selfCheck` 正文是否也陈旧**
 *     （实测 `hd-2d` 的 json 内部就不自洽：`generatedVideo` 已 24 fps，`selfCheck.warnings` 仍写 60 fps）。
 *
 * 用法：node scripts/check-skill-film-fields.mjs
 * 退出码：
 *   0 = 无「陈旧且非历史语境」的成片字段声称（参考项与失明项不影响退出码）
 *   1 = 有 FAIL（陈旧帧数 / 陈旧分辨率），或**全部风格都读不到 generatedVideo**（本闸门已失明）
 */
import fs from 'node:fs';
import path from 'node:path';

/** 风格文档根。★ 允许覆盖（与 `check-tp-prose.mjs:325` **同名同义**）：仅供**非破坏**反向测试，
 *  环境变量不设时逐字等价于原来的硬编码路径，行为完全不变。 */
const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || 'D:/lemo-tools/lib/style-skills');
const HIST = /已修|原为|原记|原先|曾是|曾为|历史|修复前|修复后|校正|拆分|移入|resolvedDefects/;
/** ★ 当前结论标记 —— 一行里**同时**出现它 + 历史标记 ⇒ **不豁免**（防「一刀切豁免」）。
 *  依据：项目习惯是「保留原句 + 追加更正」，于是同一行里会既有历史叙述、又有当前结论
 *  （「原先只走 X，**现已切到 Y**」）。这类行里的**当前读数**必须照判，否则就是「文档撒谎而闸门失明」。
 *  机制逐字移植自 `check-aspect-prose.mjs` 的 `CUR` 常量（同项目已用它治过同一个病）。 */
const CUR = /现状|当前结论|目前|仍然|依旧|仍是只|仍只/;
const FRAME_CTX = /成片|全片|本片|帧数|帧率|入库版/;            // 帧数：整行
const RES_CTX = /成片|全片|本片|交付|输出/;                    // 分辨率：近邻
const NATIVE = /原生|样片|demo|DEMO|入库前|未渲|设计稿|风格声明|on ones/;  // 非本片来源 ⇒ 排除
const HYPO = /硬渲|渲成|裁|塞在|竖屏|内部|内含|超采样|世界|场景|片门|模板|画布|渲染|若|如果|原生|帧缓冲|索引|缓冲/;
const NEAR = 60;
/** ⑨ 交叉引用判定的作用域 = **同一子句**（2026-10-07 收窄）。
 *  ★ 分隔符与 `check-tp-prose.mjs` 的 `CLAUSE_SEP = /[。！？；;]/g` **逐字一致**，不引入第二套。
 *  ★ 旧版按**整行**判：一行里**任意位置**出现别的风格名，就把**整行**的读数一起放掉 ——
 *    本库大量「引用他片当先例」的长表格行里，风格名与读数常不在同一子句，于是**本片**的陈旧读数被顺带豁免。
 *  ★ 实测（43 份真实正文）：该路径**当前排除 0 个 token**（帧数 / 分辨率都到不了 ⑨，全被 ③ 成片语境 /
 *    ⑧ NATIVE / ④ HIST 先挡下）⇒ 收窄前后**真实语料输出逐字节一致**（详见头注释「⑨ 收窄」一节）。 */
const CLAUSE_SEP = new RegExp('[。！？；;]', 'g');
const clauseOf = (line, idx) => {
  const marks = [...line.matchAll(CLAUSE_SEP)].map((x) => x.index);
  let a = 0;
  for (const k of marks) { if (k < idx) a = k + 1; else break; }
  const tail = line.slice(a);
  const e = tail.search(CLAUSE_SEP);
  return e === -1 ? tail : tail.slice(0, e + 1);
};

const dirs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, 'SKILL.md'))).sort();
const blind = [], staleFrame = [], staleRes = [], refDur = [], xref = [], resOrient = [];

for (const slug of dirs) {
  const jsonPath = path.join(DIR, slug, '_distill.json');
  let gv = null;
  if (fs.existsSync(jsonPath)) {
    try { gv = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).generatedVideo || null; } catch { gv = null; }
  }
  if (!gv || typeof gv.frames !== 'number') { blind.push(slug); continue; }   // ★ 失明守卫
  const others = dirs.filter((s) => s !== slug);
  const lines = fs.readFileSync(path.join(DIR, slug, 'SKILL.md'), 'utf8').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const near = (idx, len) => line.slice(Math.max(0, idx - NEAR), idx + len + NEAR);

    // ── 1) 帧数（高精度 → 判 FAIL） ──
    for (const m of line.matchAll(/(\d{3,5})\s*帧/g)) {
      const v = Number(m[1]);
      if (v < 100) continue;                       // ① 小于 100 的「3 帧」多是动作描述
      if (v === gv.frames) continue;               // ② 与实测一致
      if (!FRAME_CTX.test(line)) continue;         // ③ 整行不是关于成片
      if (NATIVE.test(near(m.index, m[0].length))) continue;  // 设计期 / 他版来源
      if (HIST.test(line) && !CUR.test(line)) continue;       // ④ 整行有历史语境（但同行有当前结论 ⇒ 不豁免）
      const isXref = others.some((o) => clauseOf(line, m.index).includes(o));   // ⑨ 同一子句（2026-10-07 收窄）
      (isXref ? xref : staleFrame).push({ slug, ln: i + 1, v, measured: gv.frames, line });
    }

    // ── 2) 分辨率（需 ③ 成片近邻 + ④ 历史语境 + 非假设语境 → 判 FAIL） ──
    for (const m of line.matchAll(/(\d{3,4})\s*[×x]\s*(\d{3,4})/g)) {
      const w = Number(m[1]), h = Number(m[2]);
      if (w < 100 || h < 100) continue;            // ① 值本身可疑
      if (w === gv.width && h === gv.height) continue;         // ② 与实测一致
      const n = near(m.index, m[0].length);
      if (!RES_CTX.test(n)) continue;              // ③ 只认「关于成片」的断言（近邻）
      if (HYPO.test(n)) continue;                  // 非假设语境（硬渲 / 裁切 / 内部尺寸…）
      if (HIST.test(line) && !CUR.test(line)) continue;       // ④ 整行有历史语境（但同行有当前结论 ⇒ 不豁免）
      // ★ WxH「朝向守卫」（⑨ 收窄后**暴露**出来的既有 ⑧ 缺口，与 `check-tp-prose.mjs` b83-a 的处理**同源**）：
      //   token 的横竖与成片**相反** ⇒ 不是本片画幅（如 9:16 变体 `1080×1920`，本片 1920×1080）。
      //   ★ 旧版 ⑨ 按整行判时，这类 token 常因同行提到别的风格被顺带豁免；⑨ 收到子句后它会露出来。
      //   ★ **不静默丢弃** —— 推「参考」桶（本项目踩过「静默丢弃 = 假绿」的病，本库有大量 9:16 变体）。
      if (Number.isFinite(gv.width) && Number.isFinite(gv.height) && (w > h) !== (gv.width > gv.height)) {
        resOrient.push({ slug, ln: i + 1, v: `${w}×${h}`, measured: `${gv.width}×${gv.height}`, line });
        continue;
      }
      const isXref = others.some((o) => clauseOf(line, m.index).includes(o));   // ⑨ 同一子句（2026-10-07 收窄）
      (isXref ? xref : staleRes).push({ slug, ln: i + 1, v: `${w}×${h}`, measured: `${gv.width}×${gv.height}`, line });
    }

    // ── 3) 时长（噪声大 → 只列「参考」） ──
    for (const m of line.matchAll(/(?<![\w.\-])(\d+(?:\.\d+)?)\s*s\b/g)) {
      const v = Number(m[1]);
      if (!Number.isFinite(v) || Math.abs(v - gv.durSec) <= 1) continue;
      if (!/成片/.test(near(m.index, m[0].length))) continue;
      if (HIST.test(line) && !CUR.test(line)) continue;       // ④ 同上（时长只列参考，不进退出码，口径一并对齐）
      refDur.push({ slug, ln: i + 1, v, measured: gv.durSec, line });
    }
  }
}

// ── 输出（沿用 check-tp-prose.mjs 的风格） ──
const dump = (list, unit) => {
  for (const s of list) {
    console.log(`  ${s.slug.padEnd(20)} L${String(s.ln).padStart(4)}  正文 ${s.v}${unit} / 实测 ${s.measured}${unit}\n      ${s.line.trim().slice(0, 150)}`);
  }
};

if (staleFrame.length) {
  console.log(`✘ 疑似「陈旧且非历史语境」的正文**帧数**声称 ${staleFrame.length} 处：\n`);
  dump(staleFrame, ' 帧');
}
if (staleRes.length) {
  console.log(`\n✘ 疑似「陈旧且非历史语境」的正文**分辨率**声称 ${staleRes.length} 处：\n`);
  dump(staleRes, '');
}
if (refDur.length) {
  console.log(`\nℹ 参考：正文**时长**声称与实测差 > 1s 的 ${refDur.length} 处 —— 噪声大（多为出片耗时/片段时长），不计 FAIL：`);
  const bySlug = {};
  for (const r of refDur) bySlug[r.slug] = (bySlug[r.slug] || 0) + 1;
  for (const [k, v] of Object.entries(bySlug)) console.log(`  ${k.padEnd(20)} ${v} 处`);
}
if (xref.length) {
  console.log(`\nℹ 交叉引用（**同一子句**内提到别的风格，引用其值当先例）${xref.length} 处 —— 不计 FAIL，供人工判断：`);
  const bySlug = {};
  for (const x of xref) bySlug[x.slug] = (bySlug[x.slug] || 0) + 1;
  for (const [k, v] of Object.entries(bySlug)) console.log(`  ${k.padEnd(20)} ${v} 处`);
}
if (resOrient.length) {
  console.log(`\nℹ 参考：正文**分辨率**画幅朝向与成片相反（如 9:16 变体 1080×1920，本片 1920×1080）的 ${resOrient.length} 处 —— 不是本片画幅，不计 FAIL，供人工判断：`);
  const bySlug = {};
  for (const r of resOrient) bySlug[r.slug] = (bySlug[r.slug] || 0) + 1;
  for (const [k, v] of Object.entries(bySlug)) console.log(`  ${k.padEnd(20)} ${v} 处`);
}
if (blind.length) {
  console.log(`\nℹ 失明：读不到 _distill.json#generatedVideo 的风格 ${blind.length} 个（不计 FAIL，但统计）：`);
  console.log('  ' + blind.join('、'));
}

// ★ 失明守卫：一个风格都枚举不到、或全部风格都读不到 ⇒ 本闸门没有可比对的真值，必须 FAIL 并明说
const allBlind = dirs.length === 0 || blind.length === dirs.length;
if (allBlind) {
  console.log(dirs.length === 0
    ? `\n✘ 本闸门已失明：\`${DIR}\` 下一个风格（SKILL.md）都找不到，没有任何可比对的真值。`
    : `\n✘ 本闸门已失明：${dirs.length} 个风格**全部**读不到 generatedVideo，没有任何可比对的真值。`);
}

const fail = staleFrame.length + staleRes.length + (allBlind ? 1 : 0);
if (!staleFrame.length && !staleRes.length && !allBlind) console.log('✓ 未发现「陈旧且非历史语境」的正文成片帧数 / 分辨率声称。');
console.log(`\n[闸门] 陈旧帧数 ${staleFrame.length} 处 / 陈旧分辨率 ${staleRes.length} 处 / 参考时长 ${refDur.length} 处 / 参考画幅朝向 ${resOrient.length} 处 / 交叉引用 ${xref.length} 处 / 失明 ${blind.length} 个 ${fail ? '✘' : 'OK'}`);
process.exitCode = fail ? 1 : 0;
