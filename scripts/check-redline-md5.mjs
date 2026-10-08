#!/usr/bin/env node
/**
 * scripts/check-redline-md5.mjs —— 「红线文件 md5 的**多处登记是否同步**」闸门
 *
 * ★ 由来（2026-10-07）：项目第一红线是**编排器 `lemo-make.mjs` 不许被悄悄改** —— 它的 md5 被登记在
 *   **多处**（`test/cases.mjs` 的 `ORCH_MD5`、`test/README.md` 的验收判据表、`README.md` 的差异清单），
 *   本意是「任何一处对不上就说明红线被动过」。但**没有任何闸门在守这件事** ⇒ 结果是
 *   `README.md` 的**差异清单**那一处**已经漂了**（写着旧值 `314d7fc8…`，而 `test/cases.mjs` 的 `ORCH_MD5`
 *   与 `test/README.md` 的**验收判据表**都已是新值 `6283aadb…`）—— **跨文档矛盾**，只能靠人工发现。
 *   ★ 2026-10-09：上面三处**改用符号锚**（引用纪律第 12 条）。原先写的是**裸行号**
 *     （`README.md` 差异清单处、`test/cases.mjs` 的 `ORCH_MD5` 处、`test/README.md` 验收判据表处
 *     各带一个「冒号 + 行号」）—— 它们**都会随插行而漂**：实测本次只在 `test/README.md` 的测试清单里
 *     插一行登记，判据表处的那个行号就从表头 `| 用例 | 断言 |` 变成**空行**，直接触发
 *     `check-ref-lines` 判据 (d)「被引行没有内容」；而 `test/cases.mjs` 那处其实**早已漂了**
 *     （真实行号比它写的大 4），只因该行非空才没被 (d) 抓到 —— 故一律换成符号锚，不再写行号。
 *   这类「多处登记、其中一处悄悄过期」是**静默**的（每处单看都「像对的」），只能靠机械比对拦住。
 *
 * ── 判据 ─────────────────────────────────────────────────────────────────────
 *   1. 实测 `lemo-make.mjs` 的 md5；
 *   2. 从**每一处登记**按**锚定正则**抽出登记的 md5（见下面 `SITES`）；
 *   3. 每一处都必须**逐字等于**实测值 —— 不等 ⇒ FAIL 并点名该处。
 *
 * ★★ 为什么必须**锚定**、绝不许「扫全文第一个 32 位 hex」（这是本闸门最大的坑）：
 *   `test/README.md` 里除了那张表的**规范行**，还有 **8 处别的 32 位 hex** —— 它们是
 *   「**带日期的历史记录**」（`故基线 md5 由 \`X\` → \`Y\`。` 这类链条），**必须保留原值**
 *   （改了就是**伪造历史**）。例如 `:66` 的 `314d7fc8… → d5a1b91b…`、`:200` 的
 *   `caab495c… → 58e2bcb…`、`:239`、`:243`（`315887dd… → 6283aadb…`）。
 *   ⇒ 抽取一律**锚定到具体形态**（行首 `|`+表头文字 / `export const ORCH_MD5` / README 的
 *   差异清单 bullet / 本简报的历史箭头），**绝不**「扫全文第一个 32 位 hex」。
 *   ★ 本文件运行时会把**每处抽到的那一行**打出来（含行号），便于人工核对「到底抓到了哪一行」。
 *
 * ── 四处登记（三处**判** + 一处**只列不判**）──────────────────────────────────
 *   · `test/cases.mjs`        —— `export const ORCH_MD5 = '<32hex>';`                      【判】
 *   · `test/README.md`        —— 验收判据表的规范行 `| 编排器 md5 未被改动 | … == \`<32hex>\` |`【判】
 *   · `README.md`             —— 差异清单 `- **编排器 md5 红线** —— \`lemo-make.mjs\` 必须仍是 \`<32hex>\``【判】
 *   · `_distill/AGENT-BRIEF.md` —— `md5 \`<旧值…>\` → **\`<32hex>\`**`                        【参考】
 *   ★ 第 4 处**只列不判**：它与 `test/README.md:243` 是**同型的历史箭头**（描述「本次由 X 改为 Y」），
 *     属**带日期的历史记录** ⇒ 红线将来**合法变更**后它理应仍是历史值，拿它判 FAIL 会制造**误报**。
 *     本闸门照它的**实际值**打印、供人工核对，但**不计入退出码**。（若团队希望它进判据，把该条
 *     `judge: false` 改成 `true` 即可，其余判据一字不动。）
 *
 * ★ 失明守卫（照 `check-config-vs-doc.mjs` / `check-doc-coverage.mjs` 的同型守卫）：
 *   任一**判据处**提取不到（文件缺失 / 正则不匹配 / 抓到空）或红线文件读不到 ⇒ **FAIL 并明说
 *   「本闸门已失明」**，且**不再打印**那句 `✓`（否则「一处都没抽到」会被读成「通过」——
 *   本项目反复治过「0 对象却全绿」）。
 *
 * ★ 覆盖点（供**非破坏性**夹具/变异验证，不改真实仓）：
 *   · `LEMO_TOOLS_ROOT`   lemo-tools 仓库根（`scripts/` 与全部登记处都挂在它下面）
 *                         —— 与 `check-doc-coverage` / `check-line-endings` 同名同义。
 *
 * 用法：node scripts/check-redline-md5.mjs
 * 退出码：任一**判据处**与实测不一致、或失明 → 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.env.LEMO_TOOLS_ROOT || 'D:/lemo-tools';
const REDLINE = path.join(ROOT, 'lemo-make.mjs');

// ── 登记处（锚定正则；`judge:true` = 进判据，`false` = 只列不判）──────────────
const SITES = [
  {
    id: 'test/cases.mjs',
    file: path.join(ROOT, 'test', 'cases.mjs'),
    what: '`export const ORCH_MD5` 的值',
    re: /^export const ORCH_MD5 = '([0-9a-f]{32})';/m,
    judge: true,
  },
  {
    id: 'test/README.md',
    file: path.join(ROOT, 'test', 'README.md'),
    what: '验收判据表的「编排器 md5 未被改动」规范行',
    re: /^\| 编排器 md5 未被改动 \| `lemo-make\.mjs` 的 md5 == `([0-9a-f]{32})` \|/m,
    judge: true,
  },
  {
    id: 'README.md',
    file: path.join(ROOT, 'README.md'),
    what: '差异清单的「编排器 md5 红线」条目',
    re: /^- \*\*编排器 md5 红线\*\* —— `lemo-make\.mjs` 必须仍是 `([0-9a-f]{32})`/m,
    judge: true,
  },
  {
    id: '_distill/AGENT-BRIEF.md',
    file: path.join(ROOT, '_distill', 'AGENT-BRIEF.md'),
    what: '「本次改了什么」段的历史箭头（**只列不判**：与 test/README.md:243 同型的历史记录）',
    re: /md5 `[^`]+` → \*\*`([0-9a-f]{32})`\*\*/,
    judge: false,
  },
];

const trunc = (s, n = 200) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ── 1. 实测红线 md5 ─────────────────────────────────────────────────────────
let actual = null;
try {
  actual = createHash('md5').update(fs.readFileSync(REDLINE)).digest('hex');
} catch { actual = null; }             // ★ 读不到 ⇒ 交给下面的失明守卫（不裸抛）

// ── 2. 逐处锚定抽取（并记录命中的**行号 + 行文本**，供人工核对）──────────────
const found = [];
for (const s of SITES) {
  let text = null;
  try { text = fs.readFileSync(s.file, 'utf8'); } catch { text = null; }
  let value = null;
  let lineNo = null;
  let line = null;
  if (text != null) {
    const m = text.match(s.re);
    if (m && m[1]) {
      value = m[1];
      lineNo = text.slice(0, m.index).split('\n').length;
      line = (text.split('\n')[lineNo - 1] || '').trim();
    }
  }
  found.push({ ...s, value, lineNo, line });
}

// ── 3. 失明守卫：判据处提取不到 ⇒ FAIL 并明说「本闸门已失明」────────────────
const blind = [];
if (actual == null) blind.push(`红线文件读不到：${REDLINE}（目录不存在 / 文件缺失？）`);
for (const f of found) {
  if (f.judge && f.value == null) {
    blind.push(`登记处提取不到（文件缺失 / 正则不匹配 / 抓到空）：\`${f.id}\` —— ${f.what}`);
  }
}

// ── 4. 比对（只对 `judge:true` 的处判 FAIL；`actual` 读不到时交给失明守卫，不产生无意义的比对）──
const judged = found.filter((f) => f.judge);
const bad = judged.filter((f) => f.value != null && actual != null && f.value !== actual);

// ── 5. 输出 ─────────────────────────────────────────────────────────────────
console.log(`红线文件：${REDLINE}`);
console.log(`实际 md5：${actual || '（读不到）'}\n`);
console.log('登记处提取结果（逐处；★ 供人工核对「到底抓到了哪一行」）：');
for (const f of found) {
  const tag = f.judge ? '判  ' : '参考';
  if (f.value == null) {
    console.log(`  [${tag}] ${f.id.padEnd(24)} ✘ 提取不到（${f.what}）`);
  } else {
    const cmp = actual == null ? '（实际读不到）' : (f.value === actual ? '== 实际 ✓' : '≠ 实际 ✘');
    console.log(`  [${tag}] ${f.id.padEnd(24)} ${f.value}  ${cmp}`);
    console.log(`          ← 第 ${f.lineNo} 行：${trunc(f.line)}`);
  }
}

if (bad.length) {
  console.log(`\n✘ ${bad.length} 处登记的 md5 与实际**不一致**（红线被动过，或该处忘了同步）：`);
  for (const f of bad) console.log(`  ✘ ${f.id.padEnd(24)} 登记 ${f.value}  ≠  实际 ${actual}（第 ${f.lineNo} 行）`);
  console.log('\n修法：把上述每一处的 md5 改成实测值（红线若被有意改过，四处都要同步 —— 见 test/cases.mjs 的「红线三处同步」注释）。');
}

if (blind.length) {
  console.log('\n✘ 本闸门已失明：');
  for (const b of blind) console.log(`  ✘ ${b}`);
}

if (!bad.length && !blind.length) {
  console.log(`\n✓ ${judged.length} 处判据登记与实测 md5 逐字一致（另 1 处历史箭头仅列出、不判）。`);
}

console.log(`\n[闸门] 判据处 ${judged.length} 处、不一致 ${bad.length} 处、失明 ${blind.length} 处 ${(bad.length || blind.length) ? '✘' : 'OK'}`);
process.exitCode = (bad.length || blind.length) ? 1 : 0;
