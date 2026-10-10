#!/usr/bin/env node
/**
 * scripts/check-readme-files.mjs —— 「根 `README.md` 的『文件清单』段里**列出的路径必须真实存在**」闸门
 *   （★ 写作时本仓的一个 `check-*` 闸门；序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 为什么需要它（本闸门的存在理由）
 * ══════════════════════════════════════════════════════════════════════════════
 *   根 `README.md` 有一个 `## 文件` 段（文件清单，段内是一个**围栏代码块**，每行形如
 *   `路径` 左对齐补空格 + 一句话职责）。★★ 实测：**没有任何闸门解析它** ——
 *   `check-doc-coverage` 只管 `scripts/` 的登记与计数声称、`check-api-docs` 只管 HTTP 表、
 *   其余闸门只读 `lib/` 源码与契约文档 ⇒ ★ 该段里的**遗漏 / 失实「从来不会被任何闸门看见」**。
 *   ★ 实证：该清单里**漏了 `lib/llm-api.mjs`**（正是承载 WorkBuddy 链路的模块），
 *     而当时 **8 个闸门全部 exit 0**、谁都没报（该行已补）。
 *   ⇒ 立此闸门，把「**README 文件清单里列出的路径是否真实存在**」从**人工核对**变成**机制**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（只做可机械判定的声称）
 * ══════════════════════════════════════════════════════════════════════════════
 *   **判据① 扫「清单里列出的路径必须真实存在」**
 *     · 读根 `README.md` 的 `## 文件` 段（段名 = 行首 `##` + `文件`）；取段内**第一个**
 *       围栏代码块；逐行取**首个空白分隔的 token** 作为候选路径（该段的格式就是
 *       「路径左对齐 + 描述」，路径本身不含空格）。
 *     · ★ **只把「能唯一识别为路径」的条目算数**：token 以已知目录前缀
 *       （`lib/` `scripts/` `test/` `web/` `core/` `demo/` `styles/` `_distill/` `tools/`）开头，
 *       或带文件扩展名（`\.[A-Za-z0-9]{1,8}$`，如 `*.mjs` / `*.bat` / `*.md`）。
 *     · 逐个断言 `path.join(ROOT, 该路径)` **存在**；不存在 ⇒ **FAIL 并点名**
 *       `README 文件清单列出但不存在：<路径>`。
 *     · ★★ **只核「列出的必须存在」这一个方向**。★★ **绝不**要求「仓库里的文件必须都被列出」
 *       —— 段里 `lib/` 那行的括号**本来就是摘要**（实测 `lib/*.mjs` 共 24 个、括号只列 11 个）
 *       ⇒ 要求列全会**必然误报**（把「摘要」当「清单」）。
 *
 *   **判据② 两层语义（登记表 ⇒ 只列 ℹ；未登记 ⇒ FAIL 并点名）**
 *     · `BACKLOG` 登记表：只放**确认合理**的例外（如清单里列的是**目录**、或指向库仓 / 仓库外
 *       的路径）。**当前应为空**，但**留出口**。
 *     · 落在 `BACKLOG` 里 ⇒ **只列 ℹ、不判 FAIL**；**未登记**的不存在路径 ⇒ **FAIL 并点名**。
 *
 *   **判据③ 失明守卫（防空转绿灯）**
 *     · 根 `README.md` 读不到（前置不可用 ⇒ 见退出码 2）；
 *       读到了、但**找不到 `## 文件` 段** / 段内**没有代码块** / **一个可识别的路径都没解析到**
 *       ⇒ **FAIL 且明说「本闸门已失明」**，且失明时**不再输出判据①②**。
 *     · ★ 理由：一个「README 没有 `## 文件` 段」的树会让判据① **恒为空集**而**假绿**
 *       （打印「0 处违约」+ exit 0）。
 *
 *   **判据④ `--json`**（照 `check-lib-exports.mjs`：JSON 模式下 stdout 只出 JSON，退出码同非 JSON）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做语义理解**：只认固定格式（段名 / 代码块 / 行首 token），不解析 Markdown AST。
 *   · **只判「存在」，不判「内容 / 用途描述对不对」**（描述是散文，机械核不了）。
 *   · **只判「列出的必须存在」**：不判「仓库里的文件都被列出」（见判据① 末条）。
 *   · **已知盲区（如实写）**：
 *     ① **描述行**（非首 token）里出现的路径样 token **不参与**解析（只取行首 token）
 *        ⇒ 若某条职责里写了「见 `foo/bar.mjs`」而该文件不存在，本闸门看不见；
 *     ② **格式变了**（路径不再左对齐 / 换成表格 / 段名改了）⇒ 报**失明**（宁可报失明不误报）；
 *     ③ **相对根 README 之外的路径**（如指向库仓 `D:/lemo-opuscar/**`）本闸门按 `ROOT` 拼接后
 *        必然不存在 ⇒ 需登进 `BACKLOG`（当前清单里无此形态）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 验证（**临时树 + 覆盖点，全程不动真实仓**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**：真实仓 ⇒ **exit 0**（清单里列出的路径全部存在）。
 *   · **变异**：临时树（`D:/lemo-tmp/`，前缀 `rf-`）的 README 清单里**加一个不存在的路径**
 *     ⇒ **exit 1 并点名**。
 *   · **反向验证**：把「不存在 ⇒ FAIL」判定**短路成恒假** ⇒ 变异**重新变绿**（证明判据① 承重）。
 *   · **失明态**：夹具 README **没有 `## 文件` 段**（或段内无路径）⇒ **exit 1 +「本闸门已失明」**，
 *     且不输出判据①②。
 *   · 同一套断言写在 `test/gate-blindness.test.mjs` 的 `check-readme-files` 用例里。
 *
 * 用法：node scripts/check-readme-files.mjs [--json]
 * 环境变量：
 *   LEMO_TOOLS_ROOT  工具仓根（默认 `<脚本>/..`，与 `check-resources` / `check-llm-api` /
 *                    `check-lib-exports` / `check-no-sync-spawn` / `check-doc-coverage`
 *                    **同名同义**）—— 供**非破坏性**变异验证（指向临时夹具树，绝不动真实仓）。
 * 退出码：0 = 全绿（清单里列出的路径全部存在、无失明）；
 *         1 = 有 FAIL（清单里列出的路径不存在），或**本闸门已失明**；
 *         2 = 前置不可用（根 `README.md` 读不到 ⇒ 无法开工）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ★ 覆盖点：工具仓根（同名同义于 check-resources / check-llm-api / check-lib-exports / check-no-sync-spawn / check-doc-coverage）。 */
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
const JSON_MODE = process.argv.includes('--json');
const README = path.join(ROOT, 'README.md');

// ── BACKLOG：已登记的「清单里列出、但按设计不存在」的例外（只列 ℹ、不判 FAIL）──
//   键 = 清单里的路径（相对仓根，已去掉尾部 `/`）；值 = 「为什么保留」。
//   ★ 当前**为空**：真实清单里列出的路径**全部存在**（目录也算存在）。
//     这是「留出口」—— 若将来确有一条**确认合理**的例外（如清单里列的是**目录**、
//     或指向**库仓 / 仓库外**的路径，本闸门按 `ROOT` 拼接后必然不存在），登进这里（只列 ℹ），
//     而**不要**为了让闸门变绿去放宽判据。
const BACKLOG = new Map(Object.entries({
  // （空）
}));

// ── 前置不可用（exit 2）：根 README.md 读不到 ⇒ 无法开工 ───────────────────────
let readmeText = null;
try { readmeText = fs.readFileSync(README, 'utf8'); } catch { readmeText = null; }
if (readmeText === null) {
  console.error(`✘ 读不到 \`${README}\`（不存在 / 不可读）⇒ 无法开工`);
  process.exit(2);
}

// ── 解析 `## 文件` 段 ────────────────────────────────────────────────────────
const lines = readmeText.split(/\r?\n/);
const SEC_RE = /^##\s*文件\s*$/;               // 段名 = 行首 `##` + `文件`
let secStart = -1;
let secEnd = lines.length;
for (let i = 0; i < lines.length; i++) {
  if (secStart < 0) {
    if (SEC_RE.test(lines[i])) secStart = i;
  } else if (/^##\s/.test(lines[i])) { secEnd = i; break; }
}
const sectionLines = secStart >= 0 ? lines.slice(secStart + 1, secEnd) : [];

// 取段内**第一个**围栏代码块的内容（``` … ```）。
const block = [];
let inFence = false;
for (const ln of sectionLines) {
  if (/^```/.test(ln.trim())) {
    if (!inFence) { inFence = true; continue; }
    break;                                       // 第一个代码块的闭合围栏
  }
  if (inFence) block.push(ln);
}

// ── 判据① 数据：逐行取**首个 token**，筛出「能唯一识别为路径」的条目 ─────────
//   ★ 只取行首 token：该段的格式是「路径左对齐 + 描述」，描述里的路径样文字不参与。
const PREFIX_RE = /^(?:lib|scripts|test|web|core|demo|styles|_distill|tools)\//;
const EXT_RE = /\.[A-Za-z0-9]{1,8}$/;
const entries = [];                              // { raw, p }
for (const line of block) {
  if (!line.trim()) continue;
  const m = /^(\S+)/.exec(line);
  if (!m) continue;
  const token = m[1];
  if (!(PREFIX_RE.test(token) || EXT_RE.test(token))) continue;
  entries.push({ raw: token, p: token.replace(/\/+$/, '') });
}

// ── 判据③ 失明守卫（防空转绿灯）─────────────────────────────────────────────
const blind = [];
if (secStart < 0) {
  blind.push('根 `README.md` 里找不到 `## 文件` 段（段名变了 / 段被删？）');
} else if (block.length === 0) {
  blind.push('`## 文件` 段里找不到围栏代码块（格式变了？）');
} else if (entries.length === 0) {
  blind.push(`\`## 文件\` 段里**一个可识别的路径都没解析到**（扫了 ${block.length} 行；格式变了？）⇒ 判据① 恒为空集`);
}

// ── 判据①② 结果：列出的必须存在（只核这一个方向）────────────────────────────
const registered = [];                           // { p, why }
const missing = [];                              // p
if (blind.length === 0) {
  for (const e of entries) {
    if (fs.existsSync(path.join(ROOT, e.p))) continue;
    if (BACKLOG.has(e.p)) registered.push({ p: e.p, why: BACKLOG.get(e.p) });
    else missing.push(e.p);
  }
  missing.sort();
}
const fails = [];
if (missing.length) {
  fails.push({
    crit: '①',
    detail: `**README 文件清单列出但不存在** ${missing.length} 条（\`## 文件\` 段里列出的路径在仓库里找不到）：\n`
      + missing.map((p) => `     ✘ README 文件清单列出但不存在：${p}`).join('\n')
      + `\n     · ★ 只核「列出的必须存在」这一个方向 —— 仓库里的文件**不要求**都被列出`
      + `（段里 \`lib/\` 那行的括号**本来就是摘要**）。`
      + `\n     · 若**确属有意保留**（如清单里列的是**目录**、或指向**库仓 / 仓库外**的路径）`
      + `⇒ 登进本闸门的 \`BACKLOG\`（键 = 清单里的路径，值 = 一句「为什么保留」）；`
      + `\n       否则请把该路径改对、或从清单里删掉。`,
  });
}

// ── 判据③ 失明守卫（结果）───────────────────────────────────────────────────
const blindGuard = blind.length > 0;
const ok = !blindGuard && fails.length === 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
if (JSON_MODE) {
  console.log(JSON.stringify({
    gate: 'check-readme-files',
    root: ROOT,
    ok,
    blind: blindGuard,
    blindReasons: blind,
    fails,
    entries: entries.map((e) => e.p),
    registered: registered.map((r) => r.p),
    missing,
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
} else {
  console.log('README「文件清单」闸门 —— 守 `## 文件` 段里**列出的路径必须真实存在**（★ 列出的必须存在 ≠ 必须列全）');
  console.log('  判据: ① 逐条断言清单里列出的路径存在（不存在 ⇒ FAIL 并点名） | ② 两层语义（BACKLOG ⇒ 只列 ℹ；未登记 ⇒ FAIL） |');
  console.log('        ③ 失明守卫（无 `## 文件` 段 / 无代码块 / 0 条路径 ⇒ 失明） | ④ `--json`');
  console.log(`  被测: ${ROOT}`);
  console.log(`  解析: \`## 文件\` 段解析到路径条目 ${entries.length} 条（段内代码块 ${block.length} 行）`);
  console.log('');

  if (blindGuard) {
    console.log('✘✘ 本闸门已失明：');
    for (const b of blind) console.log(`   ✘ ${b}`);
    console.log('   ⇒ 「0 处违约」是假的，别信这个绿。请先修段名 / 格式，再信本闸门的结论。');
    console.log('   ⇒ 已失明 ⇒ 判据①② 本次**不输出**（判据③ 是失明守卫本身）。');
    console.log('');
    console.log('[闸门] README 文件清单：已失明 ⇒ 一条判据都没可信地跑过 ✘');
    process.exitCode = 1;
  } else {
    if (registered.length) {
      console.log(`  ℹ 判据①·已登记的例外 ${registered.length} 条（只列、不判 FAIL）：`);
      for (const r of registered) console.log(`     ℹ ${r.p} —— ${r.why}`);
    } else {
      console.log('  ✓ 判据①·已登记的例外 0 条');
    }
    if (fails.length) {
      for (const f of fails) console.log(`\n   ✘ 判据${f.crit}  ${f.detail}`);
    } else {
      console.log(`  ✓ 判据②·未登记的不存在路径 0 条（清单里列出的 ${entries.length} 条路径全部存在）`);
    }
    console.log(`\n[闸门] README 文件清单：列出的路径 ${entries.length} 条 · 不存在 ${missing.length} 条`
      + `（已登记 ${registered.length} / 未登记 ${missing.length}） · 违约 ${fails.length} 处 ${ok ? 'OK' : '✘'}`);
    process.exitCode = ok ? 0 : 1;
  }
}
