#!/usr/bin/env node
/**
 * scripts/check-config-vs-doc.mjs —— 配置的**底色**是否出现在该风格文档的「§3 配色体系」里，
 *   且**以「背景角色」的身份**出现（不是只以「灯光/强调/描边/字」等**非背景角色**出现）。
 *
 * ★ 由来（2026-10-04）：`hd-2d` 的 `palette.bg = #fff0c8` —— 而 `#fff0c8` 在 demo 里是
 *   **灯塔灯光色**（`cliff.js:161`），文档 §3 写的背景是夜空 `#050818 → #101d3e → #2c4262`。
 *   即**抽取时把「灯光色」当成了「背景色」**，`dub-visual.json` 自己的证据行都标着「灯光色」。
 *
 * ★★ 旧判据的盲区（2026-10-05 实测确认，是真事故）：
 *   旧判据只做**集合包含** —— 只要 `palette.bg` 在 §3 的**任意** hex 集合里出现过就放行。
 *   而 `#fff0c8` **确实**在 §3 里（`| 主（暖实体光） | … 灯塔 \`#fff0c8\` | 故事由这些**实体灯**推动 |`
 *   这一行的「色值」列）⇒ 集合包含**命中** ⇒ 闸门放行。**真错是靠人工发现的，闸门抓不到。**
 *   本版把判据改成**角色感知**：不仅要在 §3 里出现，还要出现在**角色列**不是「灯/光/强调/描边/字…」
 *   一类的行里。
 *
 * ── 判据（机械、可解释；全部基于 §3 表格的**行文本**，不用任何语义模型）──────────────────
 *
 *  1) 解析 §3 的**表格行**：只取以 `|` 开头的行（去掉 `|---|---|` 分隔行），每行留
 *     `角色` = 第 1 列、`hexes` = 该行出现的所有 hex。§3 抽不到任何 hex ⇒ 进 `noSec`（只打印）。
 *
 *  2) 对每个候选色 `c`（`palette.bg` + `bgRecipe.stops`）算「命中行」`roleRows(c)`：
 *     · **精确优先**：若 §3 里有与 `c` **归一化后逐字节相同**的 hex ⇒ 命中行 = 这些行
 *       ∪（`RGB 欧氏距离 ≤ NEAR_ROLE=12` 的近似行）。**为什么精确优先**：`NEAR=26` 的宽容差
 *       会把 `#fff0c8`（暖奶油）算成 `#f3ead6`（UI 纸白，距离 19.4）这种**不同色**，
 *       从而把「灯光色」误判成出现在「UI」这种中性行里 ⇒ 真阳性会被放过。先钉精确、再放宽容差，
 *       才不会用近似色去**给角色归属找借口**。
 *     · **无精确才退回** `NEAR=26`：§3 里没有任何精确写法时（如 `brick-toy` 的 `#f4f4f1`
 *       与文档 `#F2F2EE` 是**同一个浅灰底**的两种写法、`living-screencast` 的 `#0C1016` 只在
 *       近似半径内），退回粗容差 —— 与旧判据的容忍度一致，不制造误报。
 *
 *  3) **非背景角色标记** `NONBG`（只扫**角色列**，不扫「用途/来源」列）：
 *     `/灯|光|发光|glow|emissive|强调|accent|描边|边框|高光|亮部/i`。
 *     · **为什么只看角色列**：用途列是**散文**，合法的背景行也会写「描边光晕」（`risograph`
 *       的 `纸白（底）` 行）、「accent」（`ascii-crt` 的 `产品通路（dub）` 行）⇒ 扫用途列会误报。
 *     · **为什么标记表里没有「字/前景」**：`pictogram-motion` 的 `米白 CREAM` 行用途写着
 *       「深色相上的**前景字**与人、片尾底色」—— 它是合法底色 ⇒ 「字/前景」出现在用途散文里
 *       不足以判它非背景。真正要抓的是**角色名**里的光/灯类（`主（暖实体光）`、`环境主光`…）。
 *
 *  4) 裁决：`palette.bg`（**主底色**）的命中行里**存在一行角色列不含 NONBG 标记** ⇒ 「以背景角色被记录」⇒ 放行；
 *     否则（**完全不在 §3**，或**只**出现在非背景角色行里）⇒ 判可疑。
 *     ★ `bgRecipe.stops` 只作**辅助**：**仅当 `palette.bg` 缺失/null 时**才看（见下面「二次收紧」；
 *       不是「任一候选色命中即放行」—— 那句已作废）。
 *
 * ★★ 已知局限 ①（2026-10-06 实测评估后**决定只记录、不根治**）：角色裁决是**黑名单**，没有正向白名单。
 *   · **症状**：`NONBG` 是黑名单 ⇒ **任何不含这些非背景词的 role 都被当成「以背景角色记录」**
 *     ⇒ 只要角色名取得不含灯/光/强调一类词，一个**错底色**就能过闸。
 *   · **可被绕过的具体构造**（夹具实测，`D:/lemo-tmp/agent-gate2/fx/`）：同一个错底色 `#fff0c8` ——
 *     **写成 §3 表格行** `| 派生通路底 | \`#fff0c8\` | 「文案 + 风格」通路的底色 | … |` ⇒ **放行（exit 0）**；
 *     **写成 §3 散文 bullet** `- 「文案 + 风格」通路的底色是 \`#fff0c8\`。` ⇒ **仍判可疑**。
 *     ⇒ 判据对**格式**（只读表格行，散文里写同一句话不算）与**角色命名**（黑名单）都敏感，两者都不是内容判据。
 *   · **为什么没换成正向白名单**（题给方向：role 必须含 `底|背景|天空|纸|地面|环境|墙|幕|板|场景|布|底色`）：
 *     逐条核对 44 条真实语料的 §3 角色列后**实测误报率**（复现：临时目录 `D:/lemo-tmp/agent-gate2/`
 *     下的 `wl-schemes.mjs`，把白名单词表按方案 A–E 逐档替换即可重跑）——
 *     ① 题给 12 词 ⇒ **8 条误报**：`silkscreen-poster`（`天光 sky1`/`dub 通路派生`）、`ascii-crt`
 *        （`产品通路（dub）`）、`brick-toy`（`主`）、`cel-anime-80s`（`夜景主色`）、`living-screencast`
 *        （`产品浅主题·墨`）、`paper-lantern`（`房间黑`）、`pictogram-motion`（`米白 CREAM`）、`swiss-motion`（`页`）；
 *     ② 再补**可辩护**的背景词（`通路|派生|夜|房间|页`）⇒ 降到 **3 条误报**；剩下 3 条只能靠
 *        `主`（`brick-toy`）、`米白`（`pictogram-motion`）、`产品|主题|墨`（`living-screencast`）才救得回来；
 *     ③ 把这 5 个词也塞进白名单 ⇒ 真实语料 **0 误报**，但 `hd-2d` 真阳性夹具（`#fff0c8`）**同时被放行**
 *        （它命中的行是 `主（暖实体光）`，`主` 一进白名单就放行）⇒ **闸门的立身之本被拆掉**；
 *     ④ 退一步用「白名单 ∧ ¬黑名单」⇒ 真实 0 误报且 `hd-2d` 夹具仍被抓，但白名单里必须常驻
 *        `主/米白/产品/主题/墨` 这类**不含任何背景语义**的词 ⇒ 它已不是「正向白名单」，
 *        对上面那条绕过构造**一点也拦不住**（`派生通路底`/`主色` 这类名字照样命中）。
 *   · **结论**：§3 的**角色列不是受控词表**（同一列混着角色名〔底/纸/幕〕、纯色名〔米白/主/墨〕、
 *     通路名〔dub 通路派生〕），任何「按 role 用词」的正向白名单都无法同时做到「排除光/强调行」
 *     与「保住 44 条合法行」—— 除非把 `主/墨/米白` 也当背景词，那就等于没有白名单。
 *     按项目纪律「判据不成立时宁可只报不改」⇒ **保留黑名单**，把局限如实写在这里。
 *     ⇒ 本闸门只保证「底色的**角色归属**不是灯/光/强调一类」；**不保证**角色名与底色内容相符。
 *
 * ── 语义（重要，别把它当判决）：这类可疑分两种，处置完全不同 ——
 *   · **文档已记录**（该风格第 11 节「已知缺陷」里**确实记了本条**冲突）⇒ 属**已知积压**，
 *     文档里已有扣分与（通常）正确值，**只列为 backlog，不判 FAIL**；
 *   · **文档没记录** ⇒ 说明是**新出现的抽取错误**（没人知道），**判 FAIL**。
 *   这样既能把积压显式列出来，又不会被积压淹没而漏掉新问题。
 *
 * ★★ 已知局限 ② 的处置（2026-10-06 **已根治**）：旧 `docRecorded` 是**粗判据** ——
 *   「§11 里同时出现 `dub-styles.json|dub-visual.json|dub 通路` **与** `palette|底色|配色`」即算「已记录」。
 *   ⇒ 会把「§11 记的其实是**另一条**冲突」的风格误判成 backlog。真事故（`shadow-puppet`）：它的 §11 记的是
 *   **`textureRaw: backlit-leather` 未实现**，而自评行里写着「palette −1」、另有一条「`dub 通路`的字幕位置…」
 *   ⇒ 两个正则都命中 ⇒ 被当成「底色冲突已记录」。一旦它的底色真出问题，就会被归成 backlog 而**不判 FAIL**
 *   （夹具实测：改前 `shadow-puppet` 夹具判 **backlog / exit 0**，改后判 **fresh / exit 1**）。
 *   现收紧为**必须指向本条**：§11 里出现**该风格的 `palette.bg` 值**（带 `#`、大小写不敏感、不匹配更长 hex 的前缀）
 *   **或**明确写「底色冲突」（★ 2026-10-06 第三次收紧：原来是泛词「底色」，被 `stained-glass` §11 的
 *   「从底色推得」抵消，见下面「已知局限 ③」）。★ 为什么不用题给备选的「`§3`」：§11 里的 `§3` 经常是在说**别的角色**
 *   （`engraving` §11 就用 `§3` 解释 `accent` 的代理值），拿它当「指向本条」会重新引入同一类误判。
 *   ★ 为什么不用「`背景`」：风格文档里 `背景` 多是「背景带渐变 / 背景 sweep」这类**风格描述**，
 *   不是「本条底色冲突」，用它同样会放宽到旧判据。
 *
 * ★★ 已知局限 ③ 的处置（2026-10-06 **第三次收紧**，修「**已修记录的回归盲区**」）：
 *   · **盲区**（本仓**约定**：修好的缺陷按「**原文保留 + 追加更正**」写 —— 原文被 `~~…~~` 划掉、
 *     后面跟 `★ … 已修：…`）：`docRecorded` 原来只在 §11 里找「该风格的 `palette.bg` hex」或
 *     「`底色`」。⇒ 一条**已修**的记录里必然**同时**写着**旧值**（被划掉的原文 + 「由 X 改为 Y」里的 X）
 *     ⇒ 一旦有人把配置**回退**成旧值，§11 里仍能搜到那个旧 hex ⇒ 判 **backlog / exit 0**，
 *     而这其实是**回归**，应当 **FAIL**。
 *   · **实测佐证**（`stained-glass`，真实 SKILL.md）：§11 写着
 *     `~~派生通路的底色是深灰 #2a2a2e…~~ ★ 2026-10-06 已修：原 palette.bg = #2a2a2e … 由 #2a2a2e 改为 #1d3a9c`；
 *     把 `palette.bg` 回退成 `#2a2a2e` ⇒ 旧判据 **backlog / exit 0**（夹具实测），应判 fresh / exit 1。
 *   · **判据（机械、可解释）**：跑 `docRecorded` 之前，先对 §11 段落做 `stripFixed()`，把**含「已修」
 *     的更正单位**整段剔除，再问「§11 里是否还**指向本条**」。三条规则（按序、无任何语义模型）：
 *     ① 去掉 `~~…~~` 划掉的 span（跨行、非贪婪）；
 *     ② 反复去掉**圆括号组** `（…）`/`(…)`（最内层优先，用 `[^（()）]*` 保证只匹配最内层）——
 *        只要该组里出现 `已修`；
 *     ③ 逐行把**一个 `★` 子句**（= `★` 到**下一个 `★` 或行尾**）删掉 —— 只要该子句里出现 `已修`。
 *   · **边界为什么这么定**（三条都是**被迫**加的，不是猜的；每条都对应真实语料里的一处写法）：
 *     · ① 对应 `~~…~~ ★ 已修` 的**原文**部分（`stained-glass` §11 / `hd-2d` §11）。
 *     · ② 对应**两种没有 `★` 的更正写法**：`stained-glass` 蒸馏证据表的
 *       `（2026-10-06 校正：原 95，dub 通路底色冲突已修 —— palette.bg #2a2a2e→#1d3a9c…）`，
 *       以及同风格「自检发现的缺陷」里的 `palette −1（派生通路的底 #2a2a2e 是「深灰」…；★ 已修：…）`
 *       —— 后者的 hex 在 `★` **之前**，只做 ③ 删不掉它，必须连**整个括号组**一起删。
 *     · ③ 对应 `★ 2026-10-06 已修**：…` 这类更正子句（`★` 到行尾）。
 *     · **不用「行」做单位**（会连同行里**别的**未结缺陷记录一起删）：`stained-glass` 的「自检发现的缺陷」
 *       一行里同时记着 `palette`（已修）/ `typography`（**未结**）/ `audio`（未结）⇒ 只能删括号组与 `★` 子句。
 *     · **不用「条目（整条 bullet）」做单位**：同上，会误删未结记录；且真实语料的更正子句都在行内闭合。
 *   · **连带收紧 `pointsToThis`（同样是被迫的）**：`底色` 这个**泛词**要换成 `底色冲突`。依据：删掉已修单位后，
 *     `stained-glass` §11 仍剩一行 `- **派生条目是近似值**：… 字幕颜色由 WCAG 对比度规则从底色推得 …`
 *     —— 它同时含 `dub-visual.json` + `palette`/`配色` + `底色`，但它**根本没在记冲突**（是派生方法的说明）
 *     ⇒ 只要还认泛词 `底色`，上面那次收紧就被它**整个抵消**（`stained-glass` 仍判 backlog）。`底色冲突`
 *     是**指向本条**的说法（本仓真实语料里 `底色冲突` 只出现在记录该冲突的地方），而 `底色` 不是。
 *
 * ★★ 已知局限 ④（2026-10-06 评估后**只记录、不修**）：上面这次收紧会让**同样写着「已修」的其它风格**
 *   一起从 backlog 翻成 fresh —— 这是**判据应有的行为**（「已修」= 本条冲突**不再**是未结积压；配置里
 *   又出现旧值 ⇒ 是回归）。最典型的是 `hd-2d`：它的 §11 对 `#fff0c8` 这条冲突的**每一处**提及都带「已修」
 *   （§11 的 `~~…~~ ★ 2026-10-05 已修`、「最高可达分与原因」里的 `★ 2026-10-05：… 已修`、蒸馏证据表的
 *   `（2026-10-05 校正：dub 通路底色冲突已修…）`）⇒ `hd-2d` 夹具（`palette.bg` 回退成 `#fff0c8`）现在判
 *   **fresh / exit 1**（旧规则下是 backlog / exit 0）。**这不是误报**：文档确实写着「已修」，配置却又回到旧值。
 *   ⇒ 若某次验收期望 `hd-2d` 仍归 backlog，那是**期望与判据冲突**（两者不可能同时成立：`stained-glass` 的
 *   蒸馏证据表 `（2026-10-06 校正：… dub 通路底色冲突已修 …）` 与 `hd-2d` 的
 *   `（2026-10-05 校正：dub 通路底色冲突已修 …）` 是**逐字同型**的两行 —— 要 `stained-glass` 翻 fresh
 *   就必须剔除它，要 `hd-2d` 留在 backlog 就必须保留它）。
 *
 * 用法：node scripts/check-config-vs-doc.mjs [--all]
 *   --all：连「文档已记录」的积压也判 FAIL（用于集中清理时）
 *
 * ★ 覆盖点（供**非破坏性**变异/夹具验证，不改真文件）：
 *   · `LEMO_DUB_STYLES`     注册表路径（默认 `D:/lemo-tools/lib/dub-styles.json`）
 *                            —— 与 `check-dna-coverage` / `check-config-notes` 同名同义。
 *   · `LEMO_DISTILL_ROOT`   SKILL.md 根（默认 `D:/lemo-tools/lib/style-skills`）
 *                            —— 与 `check-skill-artifacts` / `check-skill-scores` /
 *                            `check-film-aspect` / `check-tp-prose` 同名同义。
 *
 * ★ 失明守卫（2026-10-04 补）：抽不出 §3 的风格进 `noSec`，但 `noSec` **只打印不计 FAIL**。
 *   若**所有**风格都进 noSec（SKILL.md 全读不到 / §3 结构变了），`fresh`/`backlog` 皆空 ⇒ 静默绿。
 *   判据：`cfg.styles.length === 0`（0 个风格）或 `noSec.length === cfg.styles.length`
 *   （**没有任何一个风格可比对**）⇒ 判 FAIL 并明说「**本闸门已失明**」，且**不再打印**那句
 *   「✓ 所有风格…」（否则失明看起来像通过；非失明路径的输出保持逐字节不变）。
 *   ★ 注：本段写法被 `check-doc-coverage.mjs` / `check-mix-candidates.mjs` / `check-mux-selection.mjs`
 *     / `check-skill-artifacts.mjs` 的头注释引用 —— 引用**不依赖行号**（指向本文件的「★ 失明守卫」段 /
 *     `blind[]` 块），以免本文件一改行号就漂。
 * 退出码：有「文档未记录」的可疑（或 --all 下的任意可疑，或失明）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';

const CFG = process.env.LEMO_DUB_STYLES || 'D:/lemo-tools/lib/dub-styles.json';
const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || 'D:/lemo-tools/lib/style-skills');
const FAIL_ALL = process.argv.includes('--all');
const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));

const norm = (h) => String(h).toUpperCase().replace(/^#/, '').slice(0, 6);
const rgb = (h) => { const s = norm(h); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0); };
const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
/** 粗容差：实测 `brick-toy` 的 `#f4f4f1` 与文档 `#F2F2EE` 是**同一个浅灰底**的两种写法、
 *  `living-screencast` 的 `#0C1016` 也只在近似半径内 ⇒ 纯「集合包含」会把这种近似写成误报。 */
const NEAR = 26;
/** 角色归属容差（更严）：只认**同色号**的近似写法，不认「不同色但落在 26 内」（如 `#fff0c8` vs `#f3ead6`）。 */
const NEAR_ROLE = 12;
/** 非背景角色标记：只扫**角色列**（用途列是散文，合法背景行也会写「描边光晕」「accent」）。 */
const NONBG = /灯|光|发光|glow|emissive|强调|accent|描边|边框|高光|亮部/i;

/** 抽出 SKILL.md 第 3 节（配色体系）：
 *  · `hexes` = 整个 §3 段落里的所有 hex（**与旧版一致**，含表格外的散文，如 `hologram-hud` 只在
 *    正文提到 `#D97757`）—— 用于「§3 里有没有 hex」的失明判据与展示；
 *  · `rows`  = §3 的**表格行** `{role,hexes}` —— 用于角色感知判据（角色列 = 第 1 列）。 */
function section3(md) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => /^##\s*3\./.test(l));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && !/^##\s/.test(lines[j])) j++;
  const seg = lines.slice(i, j);
  const hexes = new Set();
  for (const m of seg.join('\n').matchAll(/#([0-9A-Fa-f]{6,8})/g)) hexes.add(norm(m[1]));
  const rows = [];
  for (const l of seg) {
    if (!l.trim().startsWith('|')) continue;
    if (/^\|[\s:|-]+\|$/.test(l.trim())) continue; // `|---|---|` 分隔行
    const cols = l.split('|').map((s) => s.trim());
    const hs = [...l.matchAll(/#([0-9A-Fa-f]{6,8})/g)].map((m) => norm(m[1]));
    rows.push({ role: cols[1] || '', hexes: hs });
  }
  return { rows, hexes };
}

/** 某候选色在 §3 的「命中行」：精确优先（+ 严容差近似）；一个精确都没有才退回粗容差。 */
function roleHit(c, rows) {
  const exact = rows.filter((r) => r.hexes.includes(norm(c)));
  if (exact.length) {
    const nearStrict = rows.filter((r) => r.hexes.some((h) => dist(c, h) <= NEAR_ROLE));
    return { mode: `exact+${NEAR_ROLE}`, rows: [...new Set([...exact, ...nearStrict])] };
  }
  return { mode: `near${NEAR}`, rows: rows.filter((r) => r.hexes.some((h) => dist(c, h) <= NEAR)) };
}

/** 把 §11 段落里的「**已修**记录」剔除，只留下「**仍未结**的缺陷记录」。
 *  ★★ 三条机械规则（按序；见文件头「已知局限 ③」的逐条依据）：
 *   ① 去掉 `~~…~~` 划掉的 span（跨行、非贪婪）—— 本仓「原文保留 + 追加更正」约定里的**原文**；
 *   ② 反复去掉**最内层圆括号组** `（…）`/`(…)`，只要该组里出现 `已修`（`[^（()）]*` 保证不跨嵌套层，
 *      循环到不动点即由内向外剥完）；
 *   ③ 逐行把**一个 `★` 子句**（`★` → 下一个 `★` 或行尾）删掉，只要该子句里出现 `已修`。
 *  ★ 为什么用「括号组 / ★ 子句」而不是「整行 / 整条 bullet」：`stained-glass` §11 的「自检发现的缺陷」
 *    一行里同时记着 `palette`（**已修**）与 `typography` / `audio`（**未结**）—— 按行/按条删会把未结记录
 *    一起删掉，让闸门**漏报**；按括号组与 ★ 子句删才既能去掉更正、又保住未结记录。 */
function stripFixed(seg) {
  let s = seg.replace(/~~[\s\S]*?~~/g, ' ');
  for (let guard = 0; guard < 500; guard++) {
    const before = s;
    s = s.replace(/[（(][^（()）]*[）)]/g, (m) => (/已修/.test(m) ? ' ' : m));
    if (s === before) break;
  }
  return s.split('\n').map((l) => {
    const parts = l.split('★');
    if (parts.length < 2) return l;
    return parts.map((p, i) => (i > 0 && /已修/.test(p) ? '' : p)).join('★');
  }).join('\n');
}

/** 第 11 节是否**确实记录了本条**冲突（配置配色有问题），而不是「记了另一条冲突」。
 *  ★★ 2026-10-06 收紧（修残留误判）：旧判据只看「§11 里同时出现
 *    (`dub-styles.json|dub-visual.json|dub 通路`) **与** (`palette|底色|配色`)」——
 *    只要 §11 里**任何一处**提到 palette 就算「本条已记录」。真事故（`shadow-puppet`）：它的 §11
 *    记的是**另一条**冲突（`textureRaw: backlit-leather` 未实现），而自评行里写着「palette −1」、
 *    另有一条「`dub 通路`的字幕位置…」⇒ 两个正则都命中 ⇒ 被当成「底色冲突已记录」⇒ 归成 backlog
 *    而**不判 FAIL**。现要求 §11 **指向本条**：出现该风格的 `palette.bg` 值（带 `#`、大小写不敏感、
 *    不匹配更长 hex 的前缀）**或**明确写「底色冲突」。
 *  ★★ 2026-10-06 第三次收紧（修「已修记录的回归盲区」，见文件头「已知局限 ③」）：先 `stripFixed()`
 *    剔除「已修」更正单位，再判；且 `底色` 泛词收紧为 `底色冲突`（`stained-glass` §11 的
 *    `派生条目是近似值` 一行含「从底色推得」+ `dub-visual.json` + `palette`，会**抵消**这次收紧）。 */
function docRecorded(md, bg) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => /^##\s*11\./.test(l));
  const seg = stripFixed(i < 0 ? md : lines.slice(i).join('\n'));
  const mentionsCfg = /dub-styles\.json|dub-visual\.json|dub 通路/.test(seg);
  const mentionsPal = /palette|配色|底色/.test(seg);
  // `(?![0-9A-Fa-f])` 避免 `#000000` 误命中 `#00000000`（ascii-crt / shadow-puppet 的 §11 里都有后者）。
  const bgHex = bg ? new RegExp(`#${norm(bg)}(?![0-9A-Fa-f])`, 'i').test(seg) : false;
  const pointsToThis = bgHex || /底色冲突/.test(seg);
  return mentionsCfg && mentionsPal && pointsToThis;
}

const backlog = [], fresh = [], noSec = [];

for (const e of cfg.styles) {
  const mdPath = path.join(DIR, e.slug, 'SKILL.md');
  if (!fs.existsSync(mdPath)) { noSec.push({ slug: e.slug, why: '无 SKILL.md' }); continue; }
  const md = fs.readFileSync(mdPath, 'utf8');
  const s3 = section3(md);
  if (!s3) { noSec.push({ slug: e.slug, why: '无 §3 配色体系' }); continue; }
  if (!s3.hexes.size) { noSec.push({ slug: e.slug, why: '§3 里没抽出任何 hex' }); continue; }

  const bg = e.palette && e.palette.bg;
  const stops = (e.bgRecipe && e.bgRecipe.stops) || [];
  if (!bg) continue;

  // ★★ 2026-10-06 收紧：以 **`palette.bg`（主底色）为准** —— `palette.bg` **自身**必须命中
  //   「背景角色」行才放行；`bgRecipe.stops` 只作**辅助**（**仅当 `palette.bg` 缺失/null 时**才看
  //   stops），**不能单独把一条错 bg 救回来**。
  //   由来（真事故）：`stained-glass` 的 `palette.bg = #2a2a2e` 取自**测试文件** `demo/test.js:9`
  //   （模型页灰底）、**完全不在 §3**；但 `bgRecipe.stops` 里的 `#142a70` 是 §3 的「深蓝」背景行
  //   ⇒ 旧「任一候选色命中即放行」规则**放行**了它 —— **一个正确的 bg2 掩盖了一个错误的 bg**，
  //   而这个闸门当初就是为这类错建的。
  const primary = bg ? [bg] : stops;                 // bg 缺失才退回 stops
  const hits = primary.map((c) => ({ c, ...roleHit(c, s3.rows) })).filter((h) => h.rows.length);
  // 放行条件：**主底色**有一行**角色列不是非背景标记**（即「以背景角色被记录」）
  const ok = hits.find((h) => h.rows.some((r) => !NONBG.test(r.role)));
  if (ok) continue;

  const why = hits.length ? 'role' : 'absent';
  const bad = hits.flatMap((h) => h.rows.map((r) => `${h.c}（${h.mode}）角色=${r.role}`));
  const rec = docRecorded(md, bg);
  const item = {
    slug: e.slug, bg, stops: stops.join(' '), why, bad, rec,
    docHas: [...s3.hexes].slice(0, 6).map((x) => '#' + x).join(' '),
  };
  (rec ? backlog : fresh).push(item);
}

const show = (list, head) => {
  if (!list.length) return;
  console.log(head);
  for (const x of list) {
    console.log(`  ${x.slug.padEnd(20)} palette.bg = ${x.bg}${x.stops ? `  stops = ${x.stops}` : ''}`);
    console.log(`      文档 §3 出现的色：${x.docHas} …`);
    if (x.why === 'role') console.log(`      ✘ 底色只以**非背景角色**出现在 §3：${x.bad.join('；')}`);
    else console.log('      ✘ 底色在 §3 里**完全没有出现**');
  }
  console.log('');
};

show(backlog, `ℹ 已知积压（文档第 11 节**已记录**该配置冲突，故不判 FAIL）${backlog.length} 处：`);
show(fresh, `✘ **文档未记录**的可疑 ${fresh.length} 处（可能是新出现的抽取错误）：`);

// ★ 失明守卫：0 个风格、或所有风格都进 noSec（没有任何一个可比对）⇒ 闸门空转 ⇒ FAIL
//   （**先算 `blind`**，才能在打印那句「✓ 所有风格…」之前就把它抑制掉 —— 失明时打 ✓ 会让人
//    误以为「通过」；非失明路径的输出保持**逐字节不变**。）
const blind = [];
if (cfg.styles.length === 0) blind.push('dub-styles.json 里 0 个风格');
else if (noSec.length === cfg.styles.length) blind.push(`全部 ${cfg.styles.length} 个风格都无法比对（SKILL.md 全读不到 / §3 结构变了？）⇒ 没有任何一个风格被真正检查`);

if (blind.length) {
  // 失明时**只**打这一段：不打「✓ 所有风格…」、也不打那一长串「ℹ 无法比对 N 个」（44 条明细在
  // 下面的失明说明里已概括，且逐条 slug 会把真正的失明信号淹掉）。
  console.log(`\n✘ 本闸门已失明：`);
  for (const b of blind) console.log(`  ✘ ${b}`);
} else {
  if (!backlog.length && !fresh.length) console.log('✓ 所有风格的底色都能在各自文档的 §3 配色体系里以**背景角色**找到。');
  if (noSec.length) console.log(`ℹ 无法比对 ${noSec.length} 个：${noSec.map((x) => `${x.slug}（${x.why}）`).join('、')}`);
}

const fails = (FAIL_ALL ? backlog.length + fresh.length : fresh.length) + blind.length;
console.log(`\n[闸门] 未记录的可疑 ${fresh.length} 处；已记录积压 ${backlog.length} 处；失明 ${blind.length} 处 ${fails ? '✘' : 'OK'}${FAIL_ALL ? '（--all 模式，积压也计 FAIL）' : ''}`);
process.exitCode = fails ? 1 : 0;
