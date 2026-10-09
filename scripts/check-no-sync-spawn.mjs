#!/usr/bin/env node
/**
 * scripts/check-no-sync-spawn.mjs —— 「**实调用** `spawnSync` / `execFileSync`」闸门
 *   （★ 写作时本仓第 46 个 `check-*` 闸门；★ 序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 为什么需要它（本闸门的存在理由）
 * ══════════════════════════════════════════════════════════════════════════════
 *   本仓有一条**已知硬规则**（写死在多处头注释里，实测确认）：
 *     ★ `spawnSync` / `execFileSync` 在本环境**一律 `EBUSY`**（连 `git --version` 都不行）
 *       ⇒ 一律用**异步 `spawn`**。
 *   ★ 但**项目自己的脚本仍在违反它** —— 实测：`scripts/clean-test-residue.mjs` 用 `spawnSync`
 *     调 Windows 回收站 ⇒ 「**回收站优先**」这条安全路径在本机**根本走不通**（每次都 `EBUSY`，
 *     只能退化到「拒绝删除」或要求第三道 `--allow-permanent-delete` 永久删）。该处已修成异步
 *     `spawn`（真跑验证 `方式 = recycle`）。
 *   ★ 修完后全仓**已无任何 `spawnSync` / `execFileSync` 的实调用**（其余出现**全在注释里**，
 *     正当地解释「为什么不用它」）—— 但**没有闸门守它** ⇒ 会再长出来。
 *   ⇒ 立此闸门，把「**不许实调用 `spawnSync` / `execFileSync`**」从**约定 / 注释**变成**机制**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（只做可机械判定的声称）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★ 设计纪律：一律**剥注释**（状态机，**保留字符串字面量**）后再判 —— 否则本仓多处
 *     **正当地在注释里解释「为什么不用它」** 会被判成违规（假阳）。这是本闸门**最容易假阳**
 *     的地方，故判据① 必须**先剥注释、再找调用形态**（实现照 `check-lib-exports.mjs` /
 *     `check-resources.mjs` 的剥注释状态机，**保留字符串**）。
 *
 *   **判据① 扫「实调用」**
 *     · 扫描根 = `lib/**​/*.mjs` + `scripts/**​/*.mjs` + `test/**​/*.mjs` + **仓根 `*.mjs`**（非递归，
 *       含 `server.mjs` / `lemo-make.mjs` / `dub.mjs`）。
 *     · 对每个文件：**剥注释后**再找调用形态 `\bspawnSync\s*\(` 与 `\bexecFileSync\s*\(`。
 *       ★ **注释里的提及必须放行**（本仓多处注释正当提及）—— 见上面的剥注释纪律。
 *     · 顺手覆盖 `child_process` 的**解构导入**形态（如 `import { spawnSync } from 'node:child_process'`）：
 *       ★ 只要**没有实调用**就不算违规；★ **导入但没用** ⇒ **只列 ℹ、不判 FAIL**（别制造无谓的失败）。
 *     · ★ **本闸门不扫自己**（同 `check-lib-exports.mjs` 的纪律）：本文件里的 `CALL_RE` / `BACKLOG`
 *       理由文本都含 `spawnSync` 字样，若参与扫描会自报。
 *
 *   **判据② 两层语义（登记表 ⇒ 只列 ℹ；未登记 ⇒ FAIL 并点名）**
 *     · `BACKLOG` 登记表：已知的「实调用」逐条登记（键 = `<相对仓根路径>:<被调函数名>`，
 *       值 = 一句「为什么保留」）。**当前应为空**（全仓已无实调用），但**留出口**。
 *     · 落在 `BACKLOG` 里 ⇒ **只列 ℹ、不判 FAIL**；
 *     · **未登记**的实调用 ⇒ **FAIL 并点名 `<文件>:<行号> <函数名>`**（另附所在函数名，便于定位）。
 *     · ★ 这样**当前树可绿**（零实调用），且**将来新长出来的**会被抓。
 *
 *   **判据③ 失明守卫（防空转绿灯）**
 *     · 扫描根**一个文件都没扫到** / **一个 `child_process` 导入都没看到** ⇒ **FAIL 且明说
 *       「本闸门已失明」**，且失明时**不再输出判据①②**。
 *     · ★ 为什么要有「一个 `child_process` 导入都没看到」这条：一个「全仓都不 import
 *       `child_process`」的树会让判据① **恒为空集**（零实调用）⇒ 打印「未登记实调用 0 条」+
 *       exit 0（**假绿**）。用「≥1 个 `child_process` 导入」钉住「扫描根确实扫到了会用子进程的代码」。
 *     · ★ **注意**：与 `check-lib-exports` 相反，「**0 个实调用**」是本闸门的**成功态**（不是失明）
 *       —— 故失明守卫**不**看实调用数。
 *
 *   **判据④ `--json`**（照 `check-lib-exports.mjs`：JSON 模式下 stdout 只出 JSON，退出码同非 JSON）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 与「别处」的边界（本闸门**不做**什么，如实登记）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **不做语义理解**：只认固定写法（调用形态 / 导入形态），不解析 AST、不 import 被测模块。
 *   · **不判运行期**：不保证实调用**真的会被执行到**（如写在永不进入的分支里）。
 *   · **不判异步 `spawn`**：本闸门只盯**同步** `spawnSync` / `execFileSync`（异步 `spawn` 是**正解**）。
 *   · **已知盲区（如实写）**：
 *     ① **保留字符串** ⇒ 字符串字面量里出现 `spawnSync(` 也会被算作实调用（假阳；本仓当前无此形态）；
 *     ② **别名调用**（`const s = spawnSync; s(...)` / `child_process['spawnSync'](...)`）判不到（假阴）；
 *     ③ **`spawnSync.call(...)` / `spawnSync.apply(...)`** 这类成员调用**不产生** `spawnSync(` 形态 ⇒ 漏判（假阴）；
 *     ④ **不在扫描根内**的文件（如库仓 `D:/lemo-opuscar/**`）本闸门看不见（本闸门只守工具仓）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 验证（**临时树 + 覆盖点，全程不动真实仓**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **阴性对照**：真实仓 ⇒ **exit 0**（全仓零实调用）。
 *   · **变异**：临时树某个 `lib/*.mjs` 里**新增一行真的调用** `spawnSync(...)` ⇒ **exit 1 并点名**。
 *   · **反向验证之一**：把「未登记 ⇒ FAIL」判定**短路成恒假** ⇒ 变异**重新变绿**（证明判据②承重）。
 *   · **反向验证之二（本闸门特有）**：临时树里加一行**注释**写着 `// spawnSync 不能用`（**不是调用**）
 *     ⇒ **必须仍然 exit 0**（证明「剥注释」真的生效、不假阳）。
 *   · **失明态**：扫描根 0 文件 / **0 个 `child_process` 导入** ⇒ **exit 1 +「本闸门已失明」**，
 *     且不输出判据①②。
 *   · 同一套断言写在 `test/gate-blindness.test.mjs` 的 `check-no-sync-spawn` 用例里。
 *
 * 用法：node scripts/check-no-sync-spawn.mjs [--json]
 * 环境变量：
 *   LEMO_TOOLS_ROOT  工具仓根（默认 `<脚本>/..`，与 `check-resources` / `check-llm-api` /
 *                    `check-lib-exports` / `check-doc-coverage` **同名同义**）—— 供**非破坏性**
 *                    变异验证（指向临时夹具树，绝不动真实仓）。
 * 退出码：0 = 全绿（无未登记的实调用、无失明）；
 *         1 = 有 FAIL（未登记的实调用），或**本闸门已失明**；
 *         2 = 前置不可用（`lib/` 与 `scripts/` 两个扫描根都读不到 ⇒ 无法开工）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ★ 覆盖点：工具仓根（同名同义于 check-resources / check-llm-api / check-lib-exports / check-doc-coverage）。 */
const ROOT = path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'));
const JSON_MODE = process.argv.includes('--json');

// ── BACKLOG：已登记的「实调用」（只列 ℹ、不判 FAIL）──────────────────────────
//   键 = `<相对仓根的路径>:<被调函数名>`；值 = 「为什么保留」。
//   ★ 当前**为空**：全仓已无 `spawnSync` / `execFileSync` 的实调用（其余出现全在注释里）。
//     这是「留出口」—— 若将来确有一处**必须**用同步子进程（如某种 `EBUSY` 之外的场景）且
//     经评估确属有意保留，登进这里（只列 ℹ），而**不要**为了让闸门变绿去放宽判据。
const BACKLOG = new Map(Object.entries({
  // （空）
}));

// ── 剥注释（**保留字符串字面量**）—— 状态机；行号不变 ───────────────────────
//   ★ 顺序关键：**先判注释、再判引号** ⇒ 注释里的引号 / 反引号不会把状态机带偏。
//   ★ 与 `check-lib-exports.mjs` / `check-resources.mjs` 的剥注释实现同源。
function stripComments(src) {
  const out = src.split('');
  const n = src.length;
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0, q = null;
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (q) {
      if (c === '\\') { i += 2; continue; }
      if (c === q) { q = null; i++; continue; }
      i++; continue;
    }
    if (c === '/' && c2 === '/') { const s = i; while (i < n && src[i] !== '\n') i++; blank(s, i); continue; }
    if (c === '/' && c2 === '*') {
      const s = i; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(n, i + 2); blank(s, i); continue;
    }
    if (c === "'" || c === '"' || c === '`') { q = c; i++; continue; }
    i++;
  }
  return out.join('');
}

/** 递归收集 `dir` 下后缀属于 `exts` 的文件（`dir` 不存在 ⇒ 空数组）。 */
function walk(dir, exts, out = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

/** 仓根**非递归**的 `*.mjs`（`dub.mjs` / `lemo-make.mjs` / `server.mjs` / …）。 */
function rootMjs() {
  try {
    return fs.readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.mjs'))
      .map((e) => path.join(ROOT, e.name));
  } catch { return []; }
}

/** 该下标所在行号（1-based）。剥注释保留 `\n` ⇒ 行号与原文件一致。 */
function lineOf(text, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (text[i] === '\n') n++;
  return n;
}

/**
 * 该下标之前**最近的**函数名 —— 仅供定位显示（启发式）。
 * 只认真正的函数定义：`function <name>(` 或 `const <name> = (async)? (…) =>` / `= function`；
 * ★ **不认** `const r = spawnSync(…)` 这类「等号右边不是函数」的赋值（否则会把变量名当函数名）。
 */
function enclosingFn(text, idx) {
  const before = text.slice(0, idx);
  const re = /(?:^|\n)[ \t]*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(|(?:^|\n)[ \t]*(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][A-Za-z0-9_$]*\s*=>)/g;
  let last = null, m;
  while ((m = re.exec(before)) !== null) last = m[1] || m[2];
  return last;
}

// ── 前置不可用（exit 2）：两个主扫描根都读不到 ⇒ 无法开工 ─────────────────────
const LIB_DIR = path.join(ROOT, 'lib');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const hasLib = fs.existsSync(LIB_DIR);
const hasScripts = fs.existsSync(SCRIPTS_DIR);
if (!hasLib && !hasScripts) {
  console.error(`✘ 读不到 \`${LIB_DIR}\` 与 \`${SCRIPTS_DIR}\`（都不存在 / 不可读）⇒ 无法开工`);
  process.exit(2);
}

// ── 收集扫描根文件 ───────────────────────────────────────────────────────────
const SELF_NAME = 'check-no-sync-spawn.mjs';   // ★ 本闸门**不扫自己**（同 check-lib-exports 的纪律）
const SCAN_FILES = [...new Set([
  ...walk(LIB_DIR, ['.mjs']),
  ...walk(SCRIPTS_DIR, ['.mjs']),
  ...rootMjs(),
  ...walk(path.join(ROOT, 'test'), ['.mjs']),
])].filter((f) => path.basename(f) !== SELF_NAME);

// ── 判据① 数据：剥注释后找「实调用」+ 统计 `child_process` 导入 ──────────────
const CALL_RE = /\b(spawnSync|execFileSync)\s*\(/g;
/** 文件是否 import `child_process`（`from` / `require` / 动态 `import()` 三种形态）。 */
const CP_IMPORT_RE = /(?:from\s*|require\s*\(\s*|import\s*\(\s*)['"](?:node:)?child_process['"]/;
/** `import { a, b as c } from '…child_process'` ⇒ 逐个解构名（判「导入但没用」）。 */
const SYNC_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"](?:node:)?child_process['"]/g;

const hits = [];            // { file, line, callee, fn }
const importedUnused = [];  // { file, name }
let scanRead = 0;
let cpImportFiles = 0;

for (const f of SCAN_FILES) {
  let raw;
  try { raw = fs.readFileSync(f, 'utf8'); } catch { continue; }
  scanRead++;
  const text = stripComments(raw);
  if (CP_IMPORT_RE.test(text)) cpImportFiles++;

  // 解构导入的同步函数名（可能多个 import 语句 ⇒ 逐个收）
  const importedSync = new Set();
  SYNC_IMPORT_RE.lastIndex = 0;
  let im;
  while ((im = SYNC_IMPORT_RE.exec(text)) !== null) {
    for (const part of im[1].split(',')) {
      const nm = part.trim().split(/\s+as\s+/).pop().trim();
      if (nm === 'spawnSync' || nm === 'execFileSync') importedSync.add(nm);
    }
  }

  // 实调用（调用形态）
  const calledInFile = new Set();
  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(text)) !== null) {
    const callee = m[1];
    calledInFile.add(callee);
    hits.push({ file: f, line: lineOf(text, m.index), callee, fn: enclosingFn(text, m.index) });
  }

  // 导入但没用 ⇒ 只列 ℹ
  for (const nm of importedSync) if (!calledInFile.has(nm)) importedUnused.push({ file: f, name: nm });
}

// ── 判据③ 失明守卫（防空转绿灯）─────────────────────────────────────────────
const blind = [];
if (SCAN_FILES.length === 0) blind.push('全部扫描根加起来**一个文件都没读到**（路径变了？）');
else if (scanRead === 0) blind.push(`枚举到 ${SCAN_FILES.length} 个文件，却**一个都没读成功**`);
else if (cpImportFiles === 0) {
  blind.push(`扫了 ${scanRead} 个文件，却**一个 \`child_process\` 导入都没看到** ⇒ 判据① 恒为空集（本闸门已失明）`);
}

// ── 判据② 两层语义 ──────────────────────────────────────────────────────────
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const registered = [];     // { key, why, where }
const unregistered = [];   // { key, where }
if (blind.length === 0) {
  for (const h of hits) {
    const key = `${rel(h.file)}:${h.callee}`;
    const where = `${rel(h.file)}:${h.line} ${h.callee}${h.fn ? `（在 ${h.fn}() 内）` : ''}`;
    if (BACKLOG.has(key)) registered.push({ key, why: BACKLOG.get(key), where });
    else unregistered.push({ key, where });
  }
  registered.sort((a, b) => (a.where < b.where ? -1 : 1));
  unregistered.sort((a, b) => (a.where < b.where ? -1 : 1));
}
const fails = [];
if (unregistered.length) {
  fails.push({
    crit: '②',
    detail: `**未登记的实调用** ${unregistered.length} 处（本环境 \`spawnSync\` / \`execFileSync\` **一律 EBUSY** ⇒ 必须用**异步 \`spawn\`**）：\n`
      + unregistered.map((u) => `     ✘ ${u.where}`).join('\n')
      + `\n     · 本仓硬规则：同步子进程调用在本机**根本走不通**（实测「回收站优先」因此整条失效）。`
      + `\n     · 修法：改用**异步 \`spawn\`**（\`await\` 收退出码 + stdout/stderr）。`
      + `\n     · 若**确属有意保留** ⇒ 登进本闸门的 \`BACKLOG\`（键 = \`<文件>:<函数名>\`，值 = 一句「为什么保留」）。`,
  });
}

// ── 判据③ 失明守卫（结果）───────────────────────────────────────────────────
const blindGuard = blind.length > 0;
const ok = !blindGuard && fails.length === 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
if (JSON_MODE) {
  console.log(JSON.stringify({
    gate: 'check-no-sync-spawn',
    root: ROOT,
    ok,
    blind: blindGuard,
    blindReasons: blind,
    fails,
    scanFiles: scanRead,
    childProcessImportFiles: cpImportFiles,
    totalCallSites: hits.length,
    registered: registered.map((r) => r.where),
    unregistered: unregistered.map((u) => u.where),
    importedUnused: importedUnused.map((x) => `${rel(x.file)}:${x.name}`),
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
} else {
  console.log('「实调用 spawnSync / execFileSync」闸门 —— 守「本环境同步子进程一律 EBUSY ⇒ 必须异步 spawn」这条硬规则');
  console.log('  判据: ① 剥注释后扫实调用（`\\b(spawnSync|execFileSync)\\s*\\(`） | ② 两层语义（BACKLOG ⇒ 只列 ℹ；未登记 ⇒ FAIL） |');
  console.log('        ③ 失明守卫（0 文件 / 0 个 child_process 导入 ⇒ 失明） | ④ `--json`');
  console.log(`  被测: ${ROOT}`);
  console.log(`  扫描: ${scanRead} 个文件、其中 ${cpImportFiles} 个 import \`child_process\`；实调用 ${hits.length} 处`);
  console.log('');

  if (blindGuard) {
    console.log('✘✘ 本闸门已失明：');
    for (const b of blind) console.log(`   ✘ ${b}`);
    console.log('   ⇒ 「0 处违约」是假的，别信这个绿。请先修路径 / 扫描根，再信本闸门的结论。');
    console.log('   ⇒ 已失明 ⇒ 判据①② 本次**不输出**（判据③ 是失明守卫本身）。');
    console.log('');
    console.log('[闸门] 同步子进程实调用：已失明 ⇒ 一条判据都没可信地跑过 ✘');
    process.exitCode = 1;
  } else {
    if (registered.length) {
      console.log(`  ℹ 判据①·已登记的实调用 ${registered.length} 处（只列、不判 FAIL）：`);
      for (const r of registered) console.log(`     ℹ ${r.where} —— ${r.why}`);
    } else {
      console.log('  ✓ 判据①·实调用 0 处');
    }
    if (fails.length) {
      for (const f of fails) console.log(`\n   ✘ 判据${f.crit}  ${f.detail}`);
    } else {
      console.log('  ✓ 判据②·未登记的实调用 0 处');
    }
    if (importedUnused.length) {
      console.log(`  ℹ 判据①·导入了但**未调用**的同步函数 ${importedUnused.length} 处（只列、不判 FAIL）：`);
      for (const x of importedUnused) console.log(`     ℹ ${rel(x.file)}:${x.name}`);
    }
    console.log(`\n[闸门] 同步子进程实调用：扫描 ${scanRead} 个文件 · 实调用 ${hits.length} 处`
      + `（已登记 ${registered.length} / 未登记 ${unregistered.length}） · 违约 ${fails.length} 处 ${ok ? 'OK' : '✘'}`);
    process.exitCode = ok ? 0 : 1;
  }
}
