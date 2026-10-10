#!/usr/bin/env node
/**
 * scripts/check-llm-facade-only.mjs —— 「业务层不得绕过统一入口，直接读写算力配置」闸门
 *   （★ **写作时**本仓 `check-*` 闸门之一；★ 序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 由来（对齐参考标准的 `check-facade-only`）
 * ══════════════════════════════════════════════════════════════════════════════
 *   参考标准（`COMPUTE-MODULE-REUSE-GUIDE.md` 的闸门 `check-facade-only`）要求：
 *     **业务层不得自行构造统一入口对象**（`LLMClient(` / `ConfigStore(`），
 *     必须经推荐入口（`runtime.get_client()` / `facade.*`）。
 *   ★ 参考方点明它与「配置全局生效」闸门**互补、缺一不可**：
 *     业务若自己 `new LLMClient(ConfigStore())`，全局生效闸门**照样全绿**，
 *     但**那条路径的配置不会随面板切换而变** ⇒ 正是约束 1 要禁止的洞。
 *
 *   本项目的**等价物**：
 *     · 「统一入口」= `lib/llm-api.mjs`（导出 `chat` / `listServices` / `saveService` / `setActiveService` …）；
 *     · 「入口的内部状态」= 覆盖文件 `<成片根>/_llm-api.json`（多套算力服务的落盘处）。
 *   ⇒ 判据 = **除规范通路外，任何后端运行时代码不得在代码里引用该文件名**。
 *
 *   ★ 与 `check-llm-call-sites.mjs` 的互补关系（**缺一不可**，同参考方的闸门 2/3）：
 *     · 那个闸门守「**出网**」这一维：推理请求必须走模块（禁新增旁路 fetch）；
 *     · 本闸门守「**落盘**」这一维：算力配置必须走模块（禁自己读 / 写那个 JSON）。
 *     只守其一都有洞：有人绕开模块自己读配置文件 ⇒ 面板切换对他无效，
 *     而出网那一维**照样全绿**（他自己拼 URL 也可能恰好走同一个 baseUrl）。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（每条都写清「真阳长什么样 / 误报长什么样」）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ★ 设计纪律：本闸门是**静态读码**（不 import / 不发请求 / 不落盘 —— 无副作用、不依赖网络）。
 *     判据一律用**剥注释后**的文本判（本项目反复治过「判据可被注释满足」的假绿）。
 *     ★★ 但**必须保留字符串字面量** —— 那个文件名就写在**字符串**里（`'_llm-api.json'`）；
 *     若连字符串一起剥，判据就永远看不到它 ⇒ **假绿**。故本闸门只用 `maskNonCode()`：
 *       剥注释 + 正则，**保留**字符串 / 模板串。
 *
 *   **判据① 直连检测**（真阳 = 一个新写的旁路）
 *     · 扫描集内每个文件，取 `maskNonCode()` 文本，逐行找**字面量** `_llm-api.json`；
 *     · 该文件**既不是**规范通路（`lib/llm-api.mjs`）**也不在** `EXCEPTIONS` 登记表 ⇒ **FAIL**，
 *       逐处点名 `文件:行`。
 *     · 真阳长什么样：`lib/foo.mjs` 里写
 *       `JSON.parse(fs.readFileSync(path.join(CFG.exportDir, '_llm-api.json'), 'utf8'))`。
 *     · 误报长什么样：**注释里提这个文件名** —— 如 `server.mjs` 的说明文字
 *       「不再自己读写 `_llm-api.json`」。★ 剥注释后该行变空 ⇒ **不命中**（这是**有意**的，
 *       说明文字不是违规）。★ 若真在**字符串**里提到它（如拼一条给用户看的报错文案）⇒ **会命中**，
 *       属**可接受**的假阳（用行内 `llm-gate: allow` 豁免并写理由）。
 *
 *   **判据② 例外清单（两层语义）**
 *     · **已登记**（`EXCEPTIONS` 里的文件，带**理由** + **归属批次**）⇒ **只列 ℹ、不判 FAIL**。
 *     · **没登记** ⇒ 判据① 的 FAIL。
 *     · 当前登记 **0** 条（规范通路本身不算例外，它是 `FACADE_REL`）—— **空清单不是失明**，
 *       因为本闸门的「允许项」主体是 `FACADE_REL`，不是例外表。
 *
 *   **判据③ 例外不得「失效」**（双向守卫的另一半，照 `check-llm-call-sites.mjs` 的思路）
 *     · 对 `EXCEPTIONS` 里**每一条**，断言它的文件**仍然**：(a) 存在；(b) 在 `maskNonCode()`
 *       文本里**仍有**该字面量。任一不成立 ⇒ **FAIL**（「登记了但没了」——
 *       要么真迁走了该**删登记**，要么写法变了该**查**）。
 *
 *   **判据④ 失明守卫（防空转绿灯）**
 *     · 触发条件（任一成立 ⇒ 本闸门**失明**，exit 2，且**不输出**判据①②③ 的结论）：
 *       (a) 扫描根不存在 / 不是目录；
 *       (b) 扫到 **0** 个 `.mjs`；
 *       (c) **规范通路文件不在扫描集里**（路径改了 ⇒ 判据失去参照物）；
 *       (d) **规范通路里抽不到**该字面量（`OVERRIDE_BASENAME` 改名 / 改写法 ⇒
 *           判据① 会把**所有**引用都当成「未登记旁路」，或反过来永远抓不到 ⇒ 两种都是失明）。
 *     · 为什么必须守 (d)：本闸门的**唯一**正参照就是规范通路里那一处字面量。
 *       它一旦抽不到，「0 处旁路」就可能是**假的**（判据看不到东西）⇒ 这个绿不能信。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 已知局限（**必须如实知悉**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · **只认字面量**：用 `'_llm-api' + '.json'` / `String.fromCharCode(...)` 拼出来的抓不到。
 *     静态判据的固有上界；本闸门**近似强制**，不是证明。
 *   · **只扫 `.mjs`**：本仓后端运行时代码是 `.mjs`（`.js` 只有前端 `web/**`，它读不到本地文件）。
 *   · **`scripts/**` 与 `test/**` 不在扫描集**：那是**闸门与夹具**，不是业务运行时代码；
 *     且闸门自身**合法地**要写这个字面量（否则没法守它）—— 把 `scripts/**` 纳进来会自指。
 *     ★ 代价：有人把旁路写进 `scripts/` 就抓不到。**如实登记**，不粉饰。
 *   · **剥注释是启发式（非 AST）**：正则字面量靠「前一个有意义字符」判定 ⇒ 极端写法理论上会错位。
 *     **兜底**是判据③（真代码被误剥 ⇒ 已登记项会**当场**报失效，假红可见、一改就好）。
 *   · 本闸门**不判**「模块内部实现是否正确」——那是 `check-llm-api.mjs` 的职责。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 扫描集为什么是「`lib/**` + 仓根 `*.mjs`」
 * ══════════════════════════════════════════════════════════════════════════════
 *   · `lib/**`（递归）= 后端业务模块所在；
 *   · 仓根 `*.mjs`（非递归）= 编排器 `lemo-make.mjs` 与 HTTP 层 `server.mjs` 所在；
 *   · 二者合起来 = **后端运行时全部入口**。
 *   ★ 扫描根**按脚本自身位置推导**（`<脚本>/..`），**没有** env 覆盖点 —— 同
 *     `check-llm-call-sites.mjs`：这是「整仓策略」闸门，夹具用「整棵拷到临时目录」
 *     （见 `test/gate-blindness.test.mjs` 的 `copyGate`）比 env 重定向更贴近真实调用形态。
 *
 * 用法：node scripts/check-llm-facade-only.mjs [--json]
 * 退出码：0 = 扫描范围内没有未登记的直连、且已登记例外都还在；
 *         1 = 有 FAIL（发现未登记的直连 / 已登记例外失效）；
 *         2 = **本闸门已失明**（见判据④）—— 「0 处直连」是假的，别信这个绿。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(path.join(HERE, '..'));
/** ★ 本闸门**不扫自己**（否则它自己的模式表 / 举例会自己满足判据 ①）。 */
const SELF = 'check-llm-facade-only.mjs';
const JSON_OUT = process.argv.includes('--json');

/** ★ 规范通路：**唯一**允许引用覆盖文件名的后端代码。 */
const FACADE_REL = 'lib/llm-api.mjs';
/** ★ 被守的字面量：覆盖文件的**基本名**（规范通路里由 `OVERRIDE_BASENAME` 持有）。 */
const NEEDLE = '_llm-api.json';
/** ★ 行内豁免标记（**必须附理由**，便于评审追溯）。 */
const ALLOW_MARKERS = ['llm-gate: allow', 'llm-gate:allow'];

/**
 * ★★ 例外清单 · 「已登记的例外」（两层语义的第一层：只列 ℹ、不判 FAIL）。
 *   每条：rel（文件，相对仓根）/ why（**理由**：为什么它合法地要引用）/ batch（**归属批次**）。
 *   ★ 已登记 ⇒ 只列；没登记 ⇒ 判据① 的 FAIL（**绝不为了让闸门变绿而放宽判据**）。
 */
const EXCEPTIONS = [];

// ── ★ 剥注释 + 正则，**保留字符串 / 模板串**（状态机；行号不变）───────────────
//   逐字照抄 `check-llm-call-sites.mjs` 的 `maskNonCode()`（本项目约定：闸门各自独立、不做共享库）。
//   ★ 顺序关键：先判注释 / 正则、再判引号 ⇒ 注释里的引号不会把状态机带偏；
//     而字符串里的 `/*` / `/x/` 也安全（进入字符串态后不再判注释 / 正则）。
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', '']);
const REGEX_PREV_WORD = ['return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'void', 'delete', 'instanceof', 'new', 'yield', 'await', 'throw'];
function maskNonCode(src) {
  const out = src.split('');
  const n = src.length;
  const stack = [];
  const top = () => (stack.length ? stack[stack.length - 1].t : 'code');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0, prevSig = '', prevWord = '';
  while (i < n) {
    const c = src[i], c2 = src[i + 1], t = top();
    if (t === 'code' || t === 'expr') {
      if (c === "'") { stack.push({ t: 'sq' }); i++; continue; }
      if (c === '"') { stack.push({ t: 'dq' }); i++; continue; }
      if (c === '`') { stack.push({ t: 'tpl' }); i++; continue; }
      if (c === '/' && c2 === '/') { const s = i; while (i < n && src[i] !== '\n') i++; blank(s, i); continue; }
      if (c === '/' && c2 === '*') {
        const s = i; i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i = Math.min(n, i + 2); blank(s, i); continue;
      }
      if (c === '/' && (REGEX_PREV.has(prevSig) || REGEX_PREV_WORD.includes(prevWord))) { stack.push({ t: 'regex' }); i++; continue; }
      if (t === 'expr') {
        if (c === '{') stack[stack.length - 1].depth++;
        else if (c === '}') {
          if (stack[stack.length - 1].depth === 0) { stack.pop(); prevSig = '`'; i++; continue; }
          stack[stack.length - 1].depth--;
        }
      }
      if (/\s/.test(c)) { if (c === '\n') prevSig = ''; i++; continue; }
      prevSig = c;
      const wm = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
      prevWord = wm ? wm[0] : '';
      i++; continue;
    }
    if (t === 'sq' || t === 'dq') {
      if (c === '\\') { i += 2; continue; }                       // ★ 保留字符串内容
      if ((t === 'sq' && c === "'") || (t === 'dq' && c === '"')) { stack.pop(); prevSig = "'"; i++; continue; }
      i++; continue;                                              // ★ 保留字符串内容
    }
    if (t === 'regex') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if (c === '[') { let j = i + 1; while (j < n && src[j] !== ']') { if (src[j] === '\\') j++; j++; } blank(i, Math.min(n, j + 1)); i = Math.min(n, j + 1); continue; }
      if (c === '/') { stack.pop(); prevSig = '/'; i++; continue; }
      blank(i, i + 1); i++; continue;
    }
    // tpl：保留模板文本；`${…}` 里的代码切回 code 态（那里可能有正则 / 注释）
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { stack.pop(); prevSig = '`'; i++; continue; }
    if (c === '$' && c2 === '{') { stack.push({ t: 'expr', depth: 0 }); prevSig = '{'; i += 2; continue; }
    i++; continue;
  }
  return out.join('');
}

// ── 扫描集：`lib/**`（递归）+ 仓根 `*.mjs`（非递归）──────────────────────────
function collect() {
  const out = [];
  const libDir = path.join(ROOT, 'lib');
  const walk = (dir) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        walk(p);
      } else if (e.isFile() && e.name.endsWith('.mjs')) {
        out.push(p);
      }
    }
  };
  walk(libDir);
  try {
    for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.mjs')) out.push(path.join(ROOT, e.name));
    }
  } catch { /* 仓根读不到 ⇒ 由失明守卫处理 */ }
  return out.filter((p) => path.basename(p) !== SELF).sort();
}

function hitsOf(absPath) {
  let src = '';
  try { src = fs.readFileSync(absPath, 'utf8'); } catch { return []; }
  const masked = maskNonCode(src);
  const lines = masked.split('\n');
  const raw = src.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(NEEDLE)) continue;
    const rawLine = raw[i] || '';
    if (ALLOW_MARKERS.some((m) => rawLine.includes(m))) continue;
    hits.push({ line: i + 1, text: rawLine.trim() });
  }
  return hits;
}

// ── 扫描 ─────────────────────────────────────────────────────────────────────
const files = collect();
const byRel = new Map();     // rel -> hits
for (const p of files) {
  const h = hitsOf(p);
  if (h.length) byRel.set(path.relative(ROOT, p).split(path.sep).join('/'), h);
}

const facadeHits = byRel.get(FACADE_REL) || [];
const facadeScanned = files.some((p) => path.relative(ROOT, p).split(path.sep).join('/') === FACADE_REL);

// ── 判据④ 失明守卫 ───────────────────────────────────────────────────────────
const blind = [];
if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) blind.push(`扫描根不存在 / 不是目录：${ROOT}`);
if (files.length === 0) blind.push('扫描到 0 个 .mjs —— 扫描根 / 扩展名判据已失效');
if (!facadeScanned) blind.push(`规范通路 ${FACADE_REL} **不在扫描集里**（路径改了？）⇒ 判据失去正参照`);
if (facadeScanned && facadeHits.length === 0) {
  blind.push(`规范通路 ${FACADE_REL} 里**抽不到**字面量 ${NEEDLE}（改名 / 改写法？）⇒ 判据① 的正参照没了`);
}

// ── 判据①②③ ─────────────────────────────────────────────────────────────────
const registered = EXCEPTIONS.map((e) => e.rel);
const bypassReal = [];   // 未登记 ⇒ FAIL
const infoOnly = [];     // 已登记 ⇒ 只列 ℹ
for (const [rel, h] of byRel) {
  if (rel === FACADE_REL) continue;
  if (registered.includes(rel)) infoOnly.push({ rel, hits: h });
  else bypassReal.push({ rel, hits: h });
}
const stale = [];
for (const ex of EXCEPTIONS) {
  const h = byRel.get(ex.rel);
  if (!h || !h.length) {
    const exists = fs.existsSync(path.join(ROOT, ex.rel));
    stale.push({ rel: ex.rel, why: exists ? '文件还在，但**已不再引用**该字面量（写法变了？）' : '**文件已不存在**' });
  }
}

const fails = [];
for (const b of bypassReal) for (const h of b.hits) fails.push({ crit: '①', detail: `${b.rel}:${h.line} 直接引用 ${NEEDLE} —— ${h.text}` });
for (const s of stale) fails.push({ crit: '③', detail: `${s.rel} —— ${s.why}` });

const blindMode = blind.length > 0;
const ok = !blindMode && fails.length === 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({
    gate: 'check-llm-facade-only',
    root: ROOT,
    facade: { rel: FACADE_REL, scanned: facadeScanned, hits: facadeHits.length },
    needle: NEEDLE,
    scannedFiles: files.length,
    filesWithNeedle: [...byRel.keys()],
    exceptions: EXCEPTIONS.map((e) => ({ rel: e.rel, why: e.why, batch: e.batch })),
    bypass: bypassReal.map((b) => ({ rel: b.rel, hits: b.hits })),
    infoOnly: infoOnly.map((b) => ({ rel: b.rel, hits: b.hits })),
    stale,
    fails: fails.map((f) => ({ crit: f.crit, detail: f.detail })),
    blind,
    ok,
    exit: blindMode ? 2 : (fails.length ? 1 : 0),
  }, null, 2));
  process.exitCode = blindMode ? 2 : (fails.length ? 1 : 0);
  process.exit();
}

console.log('LLM 入口闸门 —— 守「算力配置必须走 `lib/llm-api.mjs`」（禁业务层自己读写覆盖文件）');
console.log('  判据: ① 直连检测 | ② 例外清单（两层语义）| ③ 例外不得失效 | ④ 失明守卫（防空转绿灯）');
console.log(`  仓根 : ${ROOT}`);
console.log(`  范围 : lib/**（递归）+ 仓根 *.mjs（非递归）；★ 不扫自己（${SELF}）`);
console.log(`         ★ 已知盲区：**不纳入** scripts/**（闸门自身合法地要写这个字面量）与 test/**（夹具）—— 见头注释 ③`);
console.log(`         实测 ${files.length} 个 .mjs / 其中含字面量 ${NEEDLE} 的 ${byRel.size} 个`);
console.log(`  规范 : ${FACADE_REL}（含该字面量 ${facadeHits.length} 处 —— **允许**，它就是通路本身）`);
console.log('');

if (blindMode) {
  console.log('✘✘ 本闸门已失明：');
  for (const b of blind) console.log(`   ✘ ${b}`);
  console.log('   ⇒ 「0 处直连」是**假的**，别信这个绿。请先修路径 / 剥注释写法 / 正参照，再信本闸门的结论。');
  console.log('   ⇒ 本闸门已失明 ⇒ 判据①②③ 本次**不输出**（在失明的树上它们只会刷屏）。');
  console.log('');
  console.log('[闸门] LLM 入口：**已失明** ⇒ 一条判据都没可信地跑过 ✘');
  process.exitCode = 2;
  process.exit();
}

if (bypassReal.length) {
  console.log(`✘ 判据①·有 ${bypassReal.length} 个文件**直接引用** ${NEEDLE} 却没走 \`${FACADE_REL}\`（也不在例外清单里）：`);
  for (const b of bypassReal) for (const h of b.hits) console.log(`   ✘ ${b.rel}:${h.line}  ${h.text}`);
  console.log(`   ↳ 修法：改走 \`${FACADE_REL}\` 的导出（\`listServices\` / \`saveService\` / \`setActiveService\` / \`chat\` …）；`);
  console.log('     确实要自己读的，请登记进本闸门的 `EXCEPTIONS`（**必须**写清理由 + 归属批次）。');
} else {
  console.log(`✓ 判据①·扫描范围内**没有**未登记的直连（${files.length} 个文件里，只有规范通路含该字面量）`);
}

if (EXCEPTIONS.length) {
  console.log(`\nℹ 判据②·已登记例外 ${EXCEPTIONS.length} 条（**只列 ℹ、不判 FAIL**）：`);
  for (const ex of EXCEPTIONS) {
    const hit = byRel.get(ex.rel);
    const at = hit ? hit.map((h) => `${h.line}`).join(', ') : '（本文件不在「含该字面量」名单里 —— 见判据③）';
    console.log(`   · ${ex.rel}  ←  命中行 ${at}`);
    console.log(`       理由：${ex.why}`);
    console.log(`       归属批次：${ex.batch}`);
  }
} else {
  console.log('\nℹ 判据②·例外清单为空（**这不是失明**：本闸门的允许项主体是规范通路本身）');
}

if (stale.length) {
  console.log(`\n✘ 判据③·有 ${stale.length} 个**已登记的例外失效**（「登记了但没了」）：`);
  for (const s of stale) console.log(`   ✘ ${s.rel} —— ${s.why}`);
  console.log('   ↳ 修法：若它**真的**不再引用该文件 ⇒ 把这条登记**删掉**；若只是写法变了 ⇒ 同步改登记表。');
} else {
  console.log(`\n✓ 判据③·${EXCEPTIONS.length} 条已登记例外的引用**都还在**`);
}

if (infoOnly.length) {
  console.log(`\nℹ 判据②·已登记且仍有引用 ${infoOnly.length} 个文件：`);
  for (const b of infoOnly) for (const h of b.hits) console.log(`   · ${b.rel}:${h.line}  ${h.text}`);
}

console.log(`\n[闸门] LLM 入口：扫描 ${files.length} 个文件 · 含字面量 ${byRel.size} 个（规范 ${facadeHits.length ? 1 : 0} + 登记 ${infoOnly.length} + 未登记直连 ${bypassReal.length}）`
  + ` · 例外 ${EXCEPTIONS.length} 条（失效 ${stale.length}） · FAIL ${fails.length} 处 ${fails.length ? '✘' : 'OK'}`);
process.exitCode = fails.length ? 1 : 0;
