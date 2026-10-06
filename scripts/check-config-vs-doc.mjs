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
 *  4) 裁决：某候选色的命中行里**存在一行角色列不含 NONBG 标记** ⇒ 该色「以背景角色被记录」⇒ 放行；
 *     否则（**完全不在 §3**，或**只**出现在非背景角色行里）⇒ 判可疑。
 *     风格放行 = 任一候选色（bg 或任一 stop）以背景角色被记录（与旧判据「任一命中即放行」同精神）。
 *
 * ── 语义（重要，别把它当判决）：这类可疑分两种，处置完全不同 ——
 *   · **文档已记录**（该风格第 11 节「已知缺陷」里提到了 `dub-styles.json` / `palette`）⇒ 属**已知积压**，
 *     文档里已有扣分与（通常）正确值，**只列为 backlog，不判 FAIL**；
 *   · **文档没记录** ⇒ 说明是**新出现的抽取错误**（没人知道），**判 FAIL**。
 *   这样既能把积压显式列出来，又不会被积压淹没而漏掉新问题。
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

/** 第 11 节是否已记录「配置配色有问题」 */
function docRecorded(md) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => /^##\s*11\./.test(l));
  const seg = i < 0 ? md : lines.slice(i).join('\n');
  return /dub-styles\.json|dub-visual\.json|dub 通路/.test(seg) && /palette|底色|配色/.test(seg);
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
  const rec = docRecorded(md);
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
