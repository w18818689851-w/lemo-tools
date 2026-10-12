#!/usr/bin/env node
// test/js-scan.test.mjs —— `lib/js-scan.mjs`（共享「剥注释 / 剥字符串」扫描器）的测试
//
// ★ 为什么必须有这一份：
//   `lib/js-scan.mjs` 是 **9 个 `scripts/check-*.mjs` 共享**的剥注释器（原先各自复制一份、共 4 个变体）。
//   它们**都不认正则字面量** ⇒ 一旦正则里出现**裸引号**（`'` / `"` / `` ` ``，如 `/['"]/`、`/\\'/g`、
//   `/[\s*·`]/`），状态机就把引号当成字符串起始、误判「字符串开了没关」、**把该文件之后的代码整段吞掉**。
//   实测事故：`server.mjs` 新增一个 API 块后，闸门 `check-llm-call-params` 报「本闸门已失明」
//   （剥完只剩 19670/127511 字符、抽到 0 次模块调用）。本文件把该缺陷的**最小复现**钉住。
//
// ★ 本文件怎么自证「有牙」（判据⑤/6g）：把 `lib/js-scan.mjs` 里的**正则识别**临时去掉（`scanRegex` 恒返回 -1），
//   写成一个临时模块再 import —— 它**必须**在最小复现上「带偏」（判据⑤）；同理把**反引号串里的 `${}` 处理**
//   去掉（`if (false)`），它**必须**在 6a/6c 的形状上「带偏」（判据 6g）。任一条不变红 ⇒ 说明对应用例没牙。
//
// ★ 2026-10-12 新增边界：**模板串里的 `${…}` 嵌套**。此前 `state === 'str'` 分支对反引号串不处理 `${}`，
//   一直吃到下一个反引号 ⇒ 一旦 `${}` 里嵌了反引号（实测 `lib/dub-core.mjs:538`），内层反引号被当成闭合、
//   状态机提前回到 code 态、其后整段错位：保字符串口径下**注释不再被剥**（噪声 ⇒ 误报），
//   丢字符串口径下**代码被当字符串丢掉**（实测 `export const ASR_ALIGN_PY` 整段消失 ⇒ 漏报）。
//   用例 6a–6g 钉住它（含两层/三层嵌套、`${}` 里的注释、`${}` 里的字符串按 keepStrings、行号保留、
//   以及真实文件 `lib/dub-core.mjs` 的回归）。
//
// 用法：node test/js-scan.test.mjs
// 退出码：全绿 0，有失败 1。

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { stripComments } from '../lib/js-scan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const TMP = 'D:/lemo-tmp';

// ── 三种口径（覆盖 9 个调用点的既有用法）──────────────────────────────────────
const MODE_BLANK = {};                                        // 抹注释、保字符串（5 份旧副本的口径）
const MODE_REMOVE = { blank: false };                         // 删注释、保字符串（2 份）
const MODE_DROPSTR = { blank: false, keepStrings: false };    // 删注释、丢字符串（1 份）
const MODES = [MODE_BLANK, MODE_REMOVE, MODE_DROPSTR];

// ── 旧实现参照（**逐字复制**自迁移前的副本，供「等价性」用）────────────────────
function OLD_A(s) { let out='',i=0;const n=s.length;let state='code';while(i<n){const c=s[i],d=s[i+1];if(state==='code'){if(c==='/'&&d==='/'){state='line';i+=2;continue;}if(c==='/'&&d==='*'){state='block';i+=2;continue;}if(c==="'")state='sq';else if(c==='"')state='dq';else if(c==='`')state='tpl';out+=c;i++;continue;}if(state==='line'){if(c==='\n'){state='code';out+=c;}i++;continue;}if(state==='block'){if(c==='*'&&d==='/'){state='code';i+=2;}else{if(c==='\n')out+=c;i++;}continue;}const q=state==='sq'?"'":state==='dq'?'"':'`';out+=c;if(c==='\\'){out+=s[i+1]??'';i+=2;continue;}if(c===q)state='code';i++;}return out;}
function OLD_B(src) { const out=src.split('');const n=src.length;const blank=(a,b)=>{for(let k=a;k<b;k++)if(out[k]!=='\n')out[k]=' ';};let i=0,q=null;while(i<n){const c=src[i],c2=src[i+1];if(q){if(c==='\\'){i+=2;continue;}if(c===q){q=null;i++;continue;}i++;continue;}if(c==='/'&&c2==='/'){const s=i;while(i<n&&src[i]!=='\n')i++;blank(s,i);continue;}if(c==='/'&&c2==='*'){const s=i;i+=2;while(i<n&&!(src[i]==='*'&&src[i+1]==='/'))i++;i=Math.min(n,i+2);blank(s,i);continue;}if(c==="'"||c==='"'||c==='`'){q=c;i++;continue;}i++;}return out.join('');}
function OLD_C(src) { let out='';let i=0;const n=src.length;let st=null;while(i<n){const c=src[i];const c2=src.slice(i,i+2);if(st===null){if(c2==='//'){st='//';i+=2;continue;}if(c2==='/*'){st='/*';i+=2;continue;}if(c==="'"||c==='"'||c==='`'){st=c;i+=1;continue;}out+=c;i+=1;continue;}if(st==='//'){if(c==='\n'){st=null;out+=c;}i+=1;continue;}if(st==='/*'){if(c==='\n')out+=c;if(c2==='*/'){st=null;i+=2;}else i+=1;continue;}if(c==='\\'){if(c2[1]==='\n')out+='\n';i+=2;continue;}if(c===st){st=null;i+=1;continue;}if(c==='\n')out+=c;i+=1;}return out;}
const OLD = [OLD_B, OLD_A, OLD_C];   // 与 MODES 一一对应

// ── 最小复现夹具（本次事故的形状）───────────────────────────────────────────
//   ★ 正则 `/['"]/` 含**裸单引号与裸双引号** ⇒ 旧实现把第一个 `'` 当字符串起始、一路「字符串态」到下一个 `'`。
//   ★ 之后再放一条 `// MARKER` 注释 + 一段代码：旧实现**不会**剥掉该注释（它以为在字符串里）。
const FIXTURE = [
  'const head = 1;',
  "const re = /['\"]/;",
  '// MARKER 这条注释必须被剥掉（旧实现被上面的正则带偏后看不见它）',
  'const AFTER = 2;',
  'function tail() { return AFTER + head; }',
  '',
].join('\n');

// ── 「危险正则」检测（**本文件内的独立实现**，用于把语料分成「安全 / 危险」两组）────────
//   判据与模块同规则（前一个有效 token 是「值结尾」⇒ 除法，否则正则起点；含关键字前缀）——
//   但**独立写成另一段代码**：若它与模块对「哪些文件含危险正则」的判断不一致，下面的等价性断言就会红。
const KW = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await', 'default']);
const isIdent = (c) => /[A-Za-z0-9_$]/.test(c);
const isValueEnd = (c) => c !== null && /[A-Za-z0-9_$)\]}"'`]/.test(c);
/** 返回「含引号的正则字面量」的个数。0 ⇒ 判为**安全文件**。 */
function dangerCount(src) {
  const n = src.length;
  let i = 0, state = 'code', quote = null, prev = null, word = '', count = 0;
  while (i < n) {
    const c = src[i];
    if (state === 'code') {
      if (c === '/' && src[i + 1] === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && src[i + 1] === '*') { state = 'block'; i += 2; continue; }
      if (c === '/' && (prev === null || !isValueEnd(prev) || KW.has(word))) {
        let j = i + 1, cls = false, ok = false;
        while (j < n) {
          const d = src[j];
          if (d === '\\') { j += 2; continue; }
          if (d === '\n' || d === '\r') break;
          if (cls) { if (d === ']') cls = false; j++; continue; }
          if (d === '[') { cls = true; j++; continue; }
          if (d === '/') { ok = true; j++; break; }
          j++;
        }
        if (ok) { if (/['"`]|\/\/|\/\*/.test(src.slice(i, j))) count++; i = j; prev = ')'; word = ''; continue; }
      }
      if (c === "'" || c === '"' || c === '`') { state = 'str'; quote = c; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
      if (isIdent(c)) word += c; else word = '';
      prev = c;
      i++; continue;
    }
    if (state === 'line') { if (c === '\n') state = 'code'; i++; continue; }
    if (state === 'block') { if (c === '*' && src[i + 1] === '/') { state = 'code'; i += 2; } else i++; continue; }
    if (c === '\\') { i += 2; continue; }
    if (c === quote) { state = 'code'; quote = null; prev = ')'; word = ''; }
    i++;
  }
  return count;
}
const hasDanger = (s) => dangerCount(s) > 0;

// ── 「模板串里嵌了东西」的判定（**只看源文本性质**，与剥后结果无关）────────────────
//   ★ 用途：口径「丢字符串」下，旧实现（4 个变体都不认 `${}`）在**含这个形状**的文件上**本身就会错位**
//     ⇒ 那些文件**不适用**「新旧子序列」判据（本次修的正是它）。例外**必须**由源性质给出，
//     绝不允许按「比较结果不同」来事后豁免（那等于把判据架空）。
const TPL_NESTED_BACKTICK = /\$\{[^}]*`/;   // `${` 之后、下一个 `}` 之前出现反引号（如 `lib/dub-core.mjs:538`）

/** `a` 是否为 `b` 的**子序列**（用于方向性判据：只允许多删 / 多留，不许改动既有内容）。 */
function isSubseq(a, b) {
  let j = 0;
  for (let i = 0; i < b.length && j < a.length; i++) if (b[i] === a[j]) j++;
  return j === a.length;
}

const readIf = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };

// ── 1. ★ 正则字面量含裸引号 ⇒ 不再带偏（事故最小复现）────────────────────────
test('★ 正则字面量含裸引号 ⇒ 不再带偏（事故最小复现）', () => {
  // ① 口径 C（丢字符串）：只有「被当作代码」的片段才会留在输出里 ⇒ 直接证明正则之后的代码没被吞。
  const c = stripComments(FIXTURE, MODE_DROPSTR);
  assert.ok(c.includes('const AFTER = 2;'), '口径 C：正则之后的代码被吞掉了（本次事故的根因）');
  assert.ok(c.includes('function tail() { return AFTER + head; }'), '口径 C：函数体被吞掉了');
  assert.ok(c.includes("const re = /['\"]/;"), '口径 C：正则字面量是**代码**，应原样保留');
  // ② 口径 B（抹注释）：`// MARKER` 必须被抹成空格 ⇒ 证明状态机仍在「代码态」。
  const b = stripComments(FIXTURE, MODE_BLANK);
  assert.ok(!b.includes('MARKER'), '口径 B：正则之后的注释没被剥 ⇒ 状态机被带偏了');
  assert.equal(b.length, FIXTURE.length, '口径 B：长度必须守恒（抹空格不删字符）');
  // ③ 口径 A（删注释）：注释删掉、正则与代码留下。
  const a = stripComments(FIXTURE, MODE_REMOVE);
  assert.ok(!a.includes('MARKER'), '口径 A：正则之后的注释没被剥');
  assert.ok(a.includes("const re = /['\"]/;") && a.includes('const AFTER = 2;'), '口径 A：代码应保留');
});

// ── 2. ★ 注释含反引号 / 正则含反引号 ⇒ 状态机不被带偏 ────────────────────────
test('★ 注释里含反引号 ⇒ 状态机不被带偏（先判注释、再判引号）', () => {
  const src = [
    'const a = 1; // 行注释里含 ` 反引号 与 \' 单引号',
    'const b = 2;',
    '/* 块注释里也含 ` 反引号 */',
    'const c = 3;',
    '',
  ].join('\n');
  for (const mode of MODES) {
    const out = stripComments(src, mode);
    assert.equal(out.split('\n').length, src.split('\n').length, '行号必须保留');
    assert.ok(out.includes('const b = 2;'), `mode ${JSON.stringify(mode)}：注释里的反引号把状态机带偏了`);
    assert.ok(out.includes('const c = 3;'), `mode ${JSON.stringify(mode)}：块注释里的反引号把状态机带偏了`);
  }
  assert.ok(!stripComments(src, MODE_BLANK).includes('反引号'), '注释内容应被抹掉');
});

test('★ 正则字面量含反引号 ⇒ 不再带偏（check-cli-docs 的形状）', () => {
  const src = 'const HEAD = /(?:^|[\\s*·`])(?:用法|Usage)[ \\t]*$/;\nconst AFTER = 9;\n';
  const c = stripComments(src, MODE_DROPSTR);
  assert.ok(c.includes('const AFTER = 9;'), '正则含反引号时，之后的代码被吞掉了');
  assert.ok(c.includes('/[\\s*·`]/') || c.includes('·`]'), '正则字面量应原样保留');
});

// ── 3. 等价性：真实语料上，「安全文件」新旧一致（**方向性**判据，见每条的理由）────
//   ★ 2026-10-12 改动说明（**为什么不再是逐字节相等**）：本模块新增了「反引号串里认 `${}`」，
//     这是**有意**的行为改动 —— 逐字节相等在**含模板插值**的文件上**必然**不再成立，而仓里
//     56 个安全文件里 52 个含模板插值。⇒ 判据改成**方向性**的（更强地钉住「不许改坏」）：
//       · 口径「抹注释」：新实现只可能**多抹**（差异处必是空格）—— 绝不许把代码抹掉/改掉；
//       · 口径「删注释」：新输出必是旧输出的**子序列**（只可能多删）；
//       · 口径「丢字符串」：旧输出必是新输出的**子序列**（只可能多留 = 保住插值里的代码），
//         ★ 例外仅限「`${}` 里嵌反引号」的文件（旧实现**本身**在那里就错位，正是本次修的形态），
//           例外由 `TPL_NESTED_BACKTICK`（源文本性质）判定，并**非空转自证**（见末尾 nested 计数）。
test('★ 等价性·安全文件：新实现只可能「多抹 / 多删 / 多留」，绝不改动既有内容（三种口径）', () => {
  const corpus = [
    'server.mjs', 'dub.mjs', 'lemo-make.mjs', 'consistency-check.mjs', 'originality-audit.mjs',
    ...fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f.endsWith('.mjs')).map((f) => path.join('lib', f)),
    ...fs.readdirSync(path.join(ROOT, 'scripts')).filter((f) => f.endsWith('.mjs')).map((f) => path.join('scripts', f)),
  ];
  let checked = 0;
  let nested = 0;
  for (const rel of corpus) {
    const src = readIf(path.join(ROOT, rel));
    if (src === null) continue;
    if (hasDanger(src)) continue;                 // 含危险正则 ⇒ 走 3b 的「更正确」判据
    checked++;

    // 口径 A（抹注释、保字符串）：长度守恒 ⇒ 差异处**只可能**是新实现多抹出来的空格
    const nA = stripComments(src, MODES[0]);
    const oA = OLD[0](src);
    assert.equal(nA.length, src.length, `${rel}：抹注释口径下新实现长度不守恒（抹注释不该增删字符）`);
    assert.equal(oA.length, src.length, `${rel}：旧实现抹注释口径长度不守恒 ⇒ 本条前提失效（请更新）`);
    for (let i = 0; i < nA.length; i++) {
      if (nA[i] === oA[i]) continue;
      assert.equal(nA[i], ' ',
        `${rel} @${i}：抹注释口径下新实现**改动了既有字符**（只允许多抹成空格）\n`
        + `  新 ${JSON.stringify(nA.slice(Math.max(0, i - 40), i + 40))}\n`
        + `  旧 ${JSON.stringify(oA.slice(Math.max(0, i - 40), i + 40))}`);
    }

    // 口径 B（删注释、保字符串）：新输出必是旧输出的子序列（只可能多删）
    assert.ok(isSubseq(stripComments(src, MODES[1]), OLD[1](src)),
      `${rel}：删注释口径下新实现**多留**了东西（旧实现的结果里找不到它）`);

    // 口径 C（删注释、丢字符串）：旧输出必是新输出的子序列（只可能多留 = 保住插值里的代码）
    if (TPL_NESTED_BACKTICK.test(src)) { nested++; continue; }   // ★ 旧实现在这种文件上本身错位
    assert.ok(isSubseq(OLD[2](src), stripComments(src, MODES[2])),
      `${rel}：丢字符串口径下新实现**少留**了东西（插值里的代码不该被丢）`);
  }
  assert.ok(checked >= 40, `安全文件样本太少（实测 ${checked} 个）⇒ 判据可能失明`);
  assert.ok(nested >= 1,
    `★ 非空转：一个「\`\${}\` 里嵌反引号」的安全文件都没命中（实测 ${nested}）⇒ 口径 C 的例外判据失明`);
});

// ── 3b. 等价性：真实语料上，「含危险正则的文件」新实现更正确 ────────────────
test('★ 等价性·危险文件：新实现更正确（判据 = 正则字面量是**代码**，旧实现把它当字符串吞掉）', () => {
  // 判据：口径 C（丢字符串）下 —— 正则字面量**不含引号以外的代码语义**，它是**代码** ⇒ 应原样保留；
  //       旧实现把正则里的引号当字符串起始 ⇒ 该正则字面量被当字符串内容丢掉。
  const cases = [
    ['lib/env.mjs', String.raw`/\\'/g`],                       // replace(/\\'/g, "'") —— 正则里含裸单引号
    ['lib/styles.mjs', '/\\[`([^`]+)`\\]\\(([^)]*)\\)/'],      // LINK_RE —— 正则里含反引号
    ['lib/aspects.mjs', "/['\"`]([^'\"`]+)['\"`]/g"],          // 正则里含三种引号
  ];
  let checked = 0;
  for (const [rel, lit] of cases) {
    const src = readIf(path.join(ROOT, rel));
    if (src === null) continue;
    if (!src.includes(lit)) continue;                       // 语料变了 ⇒ 跳过（不误报）
    const nw = stripComments(src, MODE_DROPSTR);
    const ol = OLD_C(src);
    assert.ok(nw.includes(lit), `${rel}：新实现应把正则字面量当**代码**原样保留`);
    assert.ok(!ol.includes(lit), `${rel}：旧实现把它当字符串吞掉了（这正是被修的缺陷）`);
    assert.notEqual(nw, ol, `${rel}：新旧应当不同（旧实现被带偏）`);
    checked++;
  }
  assert.ok(checked >= 1, `一个「含危险正则」的真实样本都没命中（实测 ${checked}）⇒ 判据失明`);
});

// ── 4. 基本语义 + 行号保留 ──────────────────────────────────────────────────
test('基本语义：行注释 / 块注释 / 字符串 / 转义 / 行号保留', () => {
  // 行注释：口径 A 删掉（留换行）；口径 B 抹成空格（长度守恒、注释字被抹掉）
  assert.equal(stripComments('a // c\nb', MODE_REMOVE), 'a \nb');
  const lineB = stripComments('a // c\nb', MODE_BLANK);
  assert.equal(lineB.length, 'a // c\nb'.length, '口径 B：长度必须守恒');
  assert.ok(!lineB.includes('c') && lineB.endsWith('\nb'), '口径 B：注释字应被抹成空格');
  // 块注释
  assert.equal(stripComments('a/*c*/b', MODE_REMOVE), 'ab');
  const blkB = stripComments('a/*c*/b', MODE_BLANK);
  assert.equal(blkB, 'a     b');
  assert.equal(blkB.length, 'a/*c*/b'.length);
  // 字符串内容（三种引号）都要保留（口径 A / B）
  for (const q of ["'", '"', '`']) {
    const s = `const x = ${q}a//b/*c*/${q};`;
    assert.equal(stripComments(s, MODE_REMOVE), s, `口径 A：${q} 字符串内容不该被剥`);
    assert.equal(stripComments(s, MODE_BLANK), s, `口径 B：${q} 字符串内容不该被剥`);
  }
  // 转义：`\'` 不闭合字符串
  const esc = "const s = 'a\\'b';const t = 1;";
  assert.equal(stripComments(esc, MODE_REMOVE), esc, '转义引号不该提前闭合字符串');
  // 口径 C：字符串内容丢、只留换行
  assert.equal(stripComments("const s = 'abc';const t = 1;", MODE_DROPSTR), 'const s = ;const t = 1;');
  assert.equal(stripComments("const s = 'a\nb';", MODE_DROPSTR), 'const s = \n;');
  // 行号保留（三种口径 + 多行夹具）
  const multi = 'let a = 1;\n// 注释\n/* 块\n   注释 */\nconst s = `模\n板`;\nlet b = 2;\n';
  for (const mode of MODES) {
    assert.equal(stripComments(multi, mode).split('\n').length, multi.split('\n').length, `口径 ${JSON.stringify(mode)} 行号漂了`);
  }
  // 除法不误判成正则
  assert.equal(stripComments('const r = a / b / c;', MODE_REMOVE), 'const r = a / b / c;');
  assert.equal(stripComments('const r = x[0] / 2;', MODE_REMOVE), 'const r = x[0] / 2;');
  // 正则识别：`return /re/`、`= /re/`、`(/re/)` 都按正则（整段保留）
  assert.equal(stripComments('return /^a+$/;', MODE_REMOVE), 'return /^a+$/;');
  assert.equal(stripComments('const m = s.match(/a\\/b/);', MODE_REMOVE), 'const m = s.match(/a\\/b/);');
});

// ── 5. ★自证：去掉「正则识别」⇒ 第 1 条必须变红 ──────────────────────────────
test('★自证：把共享模块的「正则识别」去掉 ⇒ 最小复现必须变红（本条证明第 1 条有牙）', async () => {
  const modPath = path.join(ROOT, 'lib', 'js-scan.mjs');
  const src = fs.readFileSync(modPath, 'utf8');
  const ANCHOR = 'const end = scanRegex(src, i);';
  assert.ok(src.includes(ANCHOR), `变异锚点变了：找不到 \`${ANCHOR}\`（请更新本条自证）`);
  const mutated = src.replace(ANCHOR, 'const end = -1;   // ★自证：去掉正则识别');
  assert.notEqual(mutated, src, '变异没生效');
  fs.mkdirSync(TMP, { recursive: true });
  const tmpPath = path.join(TMP, `js-scan-mut-${process.pid}.mjs`);
  fs.writeFileSync(tmpPath, mutated);
  try {
    const mut = await import(pathToFileURL(tmpPath).href);
    const out = mut.stripComments(FIXTURE, MODE_DROPSTR);
    // ★ 变异版必须「带偏」：正则之后的代码被当字符串丢掉
    assert.ok(!out.includes('const AFTER = 2;'),
      '变异版竟然没带偏 ⇒ 说明第 1 条用例没有牙（或变异没生效）');
    const outB = mut.stripComments(FIXTURE, MODE_BLANK);
    assert.ok(outB.includes('MARKER'),
      '变异版竟把正则之后的注释剥掉了 ⇒ 说明第 1 条用例没有牙');
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
  // 还原（未变异）后，与第 1 条同口径的断言逐字节成立
  assert.ok(stripComments(FIXTURE, MODE_DROPSTR).includes('const AFTER = 2;'));
});

// ══════════════════════════════════════════════════════════════════════════════
// ── 6. ★ 模板串 `${…}` 里的嵌套（2026-10-12 修的边界）──────────────────────────
//   由来：`state === 'str'` 分支此前对反引号串**不处理 `${}`** —— 它在 `str` 态一直吃到**下一个反引号**。
//   实测后果（`lib/dub-core.mjs:538` 的 `` `'${String(s).replace(/'/g, `'\\''`)}'` ``，`${}` 里嵌了反引号）：
//     · 内层反引号被当成闭合 ⇒ 状态机**提前回到 code 态** ⇒ 其后整段错位；
//     · 口径「抹/删注释、保字符串」⇒ 从该行起其后约 88 行注释**不再被剥**（噪声 ⇒ 判据可能**误报**）；
//     · 口径「丢字符串」⇒ 其后**代码被当字符串丢掉**（实测 `export const ASR_ALIGN_PY` 整段消失
//       ⇒ 判据**漏报**，这是危险方向）。
//   ⇒ 现在：反引号串里遇 `${` ⇒ 进「插值代码态」（`tplStack` 压一层，花括号深度记 0）；该态里
//     `{` +1 / `}` −1，**归零时回到外层反引号串态**；插值里的代码走同一套状态机 ⇒ **支持任意层嵌套**。
// ══════════════════════════════════════════════════════════════════════════════
const DUB_CORE = path.join(ROOT, 'lib', 'dub-core.mjs');

// ── 6a. `${}` 里嵌反引号（照 `lib/dub-core.mjs:538` 的真实形状）────────────────
test('★ 模板串 ${} 里嵌反引号 ⇒ 状态机不被带偏（lib/dub-core.mjs:538 的真实形状）', () => {
  const raw = fs.readFileSync(DUB_CORE, 'utf8');
  const line = raw.split('\n')[537];
  assert.ok(line.includes('${String(s).replace(') && line.includes('`'),
    `dub-core.mjs:538 的形状变了（找不到「\`\${}\` 里嵌反引号」那行）⇒ 请更新本条：实得 ${JSON.stringify(line)}`);
  // ★ 紧跟其后的一句**注释原文**（第七批 F4 当时为躲误报把它改写掉了）——「噪声」的最小载体
  const src = [line, '//   （/home/lemo/lemo-opuscar/.venv 里已装 1.2.1，HF 缓存有 base / base.en），不另装一套。', 'const AFTER = 1;', ''].join('\n');
  // ① 口径「抹注释」：该行之后的**注释必须被抹**（= 噪声消失，判据不再可能因注释误报）
  const b = stripComments(src, MODE_BLANK);
  assert.ok(!b.includes('/lemo-opuscar/'), '抹注释口径：:538 之后的注释没被抹掉（状态机被内层反引号带偏）');
  assert.ok(b.includes('const AFTER = 1;'), '抹注释口径：:538 之后的**代码**被吞掉了');
  assert.equal(b.length, src.length, '抹注释口径：长度必须守恒');
  assert.equal(b.split('\n').length, src.split('\n').length, '行号必须保留');
  // ② 口径「删注释」：注释删掉、代码留下
  const a = stripComments(src, MODE_REMOVE);
  assert.ok(!a.includes('/lemo-opuscar/'), '删注释口径：:538 之后的注释没被删');
  assert.ok(a.includes('const AFTER = 1;'), '删注释口径：:538 之后的代码被吞');
  // ③ 口径「丢字符串」：:538 之后是**代码** ⇒ 必须留下（此前被当字符串整段丢掉）
  const d = stripComments(src, MODE_DROPSTR);
  assert.ok(d.includes('const AFTER = 1;'), '丢字符串口径：:538 之后的代码被当字符串丢掉了');
  assert.ok(d.includes('String(s).replace('), '丢字符串口径：模板插值里的**代码**应保留');
  // ④ `${` / 闭合它的 `}` 按字符串出口 ⇒ 「保字符串」口径下该行逐字节不变
  assert.equal(b.split('\n')[0], line, '抹注释口径：这一行应逐字节保留（模板串是字符串）');
  assert.equal(a.split('\n')[0], line, '删注释口径：这一行应逐字节保留');
});

// ── 6b. `${}` 里嵌注释 ⇒ 注释必须被剥 ────────────────────────────────────────
test('★ 模板串 ${} 里的注释必须被剥（${ /* c */ x } / ${ x // c\\n }）', () => {
  const blk = 'const a = `p${ /* CMT */ x }q`;\nconst b = 2;\n';
  const bB = stripComments(blk, MODE_BLANK);
  assert.ok(!bB.includes('CMT'), '抹注释口径：`${}` 里的块注释没被抹');
  assert.equal(bB.length, blk.length, '抹注释口径：长度必须守恒');
  assert.ok(bB.includes('const b = 2;'), '抹注释口径：注释之后的代码被吞了');
  const bR = stripComments(blk, MODE_REMOVE);
  assert.ok(!bR.includes('CMT'), '删注释口径：`${}` 里的块注释没被删');
  assert.ok(bR.includes('const b = 2;'), '删注释口径：注释之后的代码被吞了');
  // 行注释（注释体跨行，`}` 在下一行 ⇒ 注释必须吃在行尾、`}` 仍要闭合插值）
  const lin = 'const a = `p${ x // CMT2\n }q`;\nconst b = 3;\n';
  for (const mode of MODES) {
    const out = stripComments(lin, mode);
    assert.ok(!out.includes('CMT2'), `口径 ${JSON.stringify(mode)}：\`\${}\` 里的行注释没被剥`);
    assert.ok(out.includes('const b = 3;'), `口径 ${JSON.stringify(mode)}：行注释之后的代码被吞了`);
    assert.equal(out.split('\n').length, lin.split('\n').length, `口径 ${JSON.stringify(mode)}：行号漂了`);
  }
});

// ── 6c. 两层 / 三层嵌套 ─────────────────────────────────────────────────────
test('★ 任意层嵌套：`a${`b${c}`}d` / 三层 ⇒ 状态机正确回到外层', () => {
  // ★ 标记刻意用**可辨识的长词**：这样「丢字符串」口径下能逐段断言「哪一段该留、哪一段该丢」。
  //   （纯 `a/b/c/d` 单字母的夹具在旧实现上会**碰巧自洽** —— 4 个反引号两两配对，错位区正好被夹住
  //     ⇒ 那条用例就**没有牙**。用长词后旧实现会漏出 `}dd`（= 模板串内容被当代码输出）⇒ 当场变红。）
  const NEST2 = 'const r = `aa${`bb${CC}`}dd`;';
  const src = [NEST2, '// MARK 必须被剥', 'const z = 9;', ''].join('\n');
  for (const mode of MODES) {
    const out = stripComments(src, mode);
    assert.equal(out.split('\n').length, src.split('\n').length, `口径 ${JSON.stringify(mode)}：行号漂了`);
    assert.ok(!out.includes('MARK'), `口径 ${JSON.stringify(mode)}：两层嵌套之后状态机错位 ⇒ 注释没被剥`);
    assert.ok(out.includes('const z = 9;'), `口径 ${JSON.stringify(mode)}：两层嵌套之后代码被吞了`);
  }
  // 「保字符串」两口径下该行逐字节保留（模板串是字符串 ⇒ 整行原样）
  assert.equal(stripComments(src, MODE_BLANK).split('\n')[0], NEST2);
  assert.equal(stripComments(src, MODE_REMOVE).split('\n')[0], NEST2);
  // ★ 「丢字符串」口径：`CC`（内层插值的**代码**）必须留；`aa`/`bb`/`dd`（模板串内容）必须丢。
  const d0 = stripComments(src, MODE_DROPSTR).split('\n')[0];
  assert.ok(d0.includes('CC'), '丢字符串口径：内层插值里的代码 `CC` 被丢了');
  assert.ok(!d0.includes('aa') && !d0.includes('bb') && !d0.includes('dd'),
    `丢字符串口径：模板串内容（aa/bb/dd）没被丢 ⇒ 状态机错位，实得 ${JSON.stringify(d0)}`);
  // 三层（`${` 里再有反引号模板、再有 `${`）
  const deep = 'const s = `1${`2${`3${x}`}`}`;\n// MARK3 必须被剥\nconst w = 1;\n';
  for (const mode of MODES) {
    const out = stripComments(deep, mode);
    assert.equal(out.split('\n').length, deep.split('\n').length, `口径 ${JSON.stringify(mode)}：三层行号漂了`);
    assert.ok(!out.includes('MARK3'), `口径 ${JSON.stringify(mode)}：三层嵌套之后错位`);
    assert.ok(out.includes('const w = 1;'), `口径 ${JSON.stringify(mode)}：三层嵌套之后代码被吞`);
  }
  assert.equal(stripComments(deep, MODE_BLANK).split('\n')[0], 'const s = `1${`2${`3${x}`}`}`;');
  assert.ok(stripComments(deep, MODE_DROPSTR).split('\n')[0].includes('x'),
    '丢字符串口径：三层嵌套最内层插值的代码 `x` 被丢了');
});

// ── 6d. `${}` 里的字符串按 keepStrings 处理 ─────────────────────────────────
test('★ ${} 里的字符串按 keepStrings 处理（丢字符串口径只丢字符串、不丢插值里的代码）', () => {
  const src = 'const a = `p${ "STR" + v }q`;\n';
  assert.equal(stripComments(src, MODE_BLANK), src, '抹注释口径：整行应逐字节保留');
  assert.equal(stripComments(src, MODE_REMOVE), src, '删注释口径：整行应逐字节保留');
  const drop = stripComments(src, MODE_DROPSTR);
  assert.ok(!drop.includes('STR'), '丢字符串口径：`${}` 里的字符串内容应被丢掉');
  assert.ok(drop.includes('+ v'), '丢字符串口径：`${}` 里的**代码**（表达式）必须留下');
  // 插值里嵌的**模板串**也按 keepStrings：丢口径下它的字符串内容丢、它的插值代码留
  const src2 = 'const a = `p${ `S${u}` }q`;\n';
  const d2 = stripComments(src2, MODE_DROPSTR);
  assert.ok(!d2.includes('S'), '丢字符串口径：插值里嵌的模板串内容应被丢');
  assert.ok(d2.includes('u'), '丢字符串口径：插值里嵌的模板串**插值代码**应留下');
  assert.equal(stripComments(src2, MODE_BLANK), src2, '抹注释口径：整行应逐字节保留');
});

// ── 6e. 行号保留（多行插值 + 跨行注释）──────────────────────────────────────
test('★ 行号保留：多行模板插值（含跨行注释与嵌套插值）⇒ 输出行数 == 输入行数', () => {
  const src = [
    'const a = `x${',
    '  /* 跨行注释 */',
    '  y +',
    '  `${z}`',
    '}w`;',
    'const b = 1;',
    '',
  ].join('\n');
  for (const mode of MODES) {
    const out = stripComments(src, mode);
    assert.equal(out.split('\n').length, src.split('\n').length, `口径 ${JSON.stringify(mode)}：行号漂了`);
    assert.ok(out.includes('const b = 1;'), `口径 ${JSON.stringify(mode)}：代码被吞`);
  }
  assert.ok(!stripComments(src, MODE_BLANK).includes('跨行注释'), '抹注释口径：跨行注释没被剥');
});

// ── 6f. ★ 回归：真实文件 `lib/dub-core.mjs` ─────────────────────────────────
test('★ 回归：lib/dub-core.mjs 剥完后「注释里的词不再算、:538 之后的代码不再被吞」', () => {
  const src = fs.readFileSync(DUB_CORE, 'utf8');
  const b = stripComments(src, MODE_BLANK);
  const d = stripComments(src, MODE_DROPSTR);
  // ① 行号保留
  assert.equal(b.split('\n').length, src.split('\n').length, '抹注释口径：行号漂了');
  assert.equal(d.split('\n').length, src.split('\n').length, '丢字符串口径：行号漂了');
  // ② ★ 「噪声消失」：`SYN-SENT` **只**出现在 :1288 的注释里（:538 之后）⇒ 剥完必须不再出现
  assert.ok(src.includes('SYN-SENT'), '语料变了：dub-core.mjs 里已找不到只在注释里出现的标记 SYN-SENT（请更新本条）');
  assert.ok(!b.includes('SYN-SENT'), '抹注释口径：:538 之后的注释没被抹 ⇒ 噪声仍在（判据可能**误报**）');
  // ③ ★ 「漏报消失」：:538 之后的**代码**（`export const ASR_ALIGN_PY`，:1292）在丢字符串口径下必须留下
  assert.ok(src.includes('export const ASR_ALIGN_PY'), '语料变了：找不到 export const ASR_ALIGN_PY（请更新本条）');
  assert.ok(d.includes('export const ASR_ALIGN_PY'), '丢字符串口径：:538 之后的代码被当字符串吞掉了（判据会**漏报**）');
  // ④ ★ 与 `test/cases.mjs` 的 F4 BANNED 判据同口径：`[/lemo-films/, /lemo-opuscar/]` 在剥后文本里都不该出现
  //    （原文里也都没有 ⇒ 本条只作「与 F4 闸门同口径」的说明性核对，不是判据的牙）
  for (const p of [/lemo-films/, /lemo-opuscar/]) {
    assert.ok(!p.test(b), `抹注释口径：剥后文本里仍有 ${p}（F4 BANNED 判据会红）`);
  }
  // ⑤ ★ 剥后「仍含 `//` 的行」必须**只剩字符串里的**（实测只有 1 行：python 文案里的 `https://hf-mirror.com`）
  const stillSlash = b.split('\n').filter((L) => L.includes('//'));
  assert.ok(stillSlash.length <= 2,
    `抹注释口径：剥后仍有 ${stillSlash.length} 行含 \`//\` ⇒ :538 之后的注释成片没被抹（噪声）\n`
    + stillSlash.slice(0, 3).map((L) => '  ' + L.slice(0, 100)).join('\n'));
});

// ── 6g. ★自证：把共享模块的「`${}` 处理」去掉 ⇒ 6a/6c 必须变红 ─────────────────
test('★自证：把共享模块的「反引号串里认 ${}」去掉 ⇒ 6a/6c 必须变红（本条证明 6a/6c 有牙）', async () => {
  const modPath = path.join(ROOT, 'lib', 'js-scan.mjs');
  const src = fs.readFileSync(modPath, 'utf8');
  const ANCHOR = "if (quote === '`' && c === '$' && src[i + 1] === '{') {";
  assert.ok(src.includes(ANCHOR), `变异锚点变了：找不到 \`${ANCHOR}\`（请更新本条自证）`);
  const mutated = src.replace(ANCHOR, "if (false) {   // ★自证：去掉 \${} 处理");
  assert.notEqual(mutated, src, '变异没生效');
  fs.mkdirSync(TMP, { recursive: true });
  const tmpPath = path.join(TMP, `js-scan-mut-tpl-${process.pid}.mjs`);
  fs.writeFileSync(tmpPath, mutated);
  // 6a 的形状（照 `lib/dub-core.mjs:538`）与 6c 的形状（两层嵌套）
  const raw = fs.readFileSync(DUB_CORE, 'utf8');
  const fix = [raw.split('\n')[537],
    '//   （/home/lemo/lemo-opuscar/.venv 里已装 1.2.1），不另装一套。', 'const AFTER = 1;', ''].join('\n');
  const nest = ['const r = `aa${`bb${CC}`}dd`;', '// MARK 必须被剥', 'const z = 9;', ''].join('\n');
  try {
    const mut = await import(pathToFileURL(tmpPath).href);
    // 6a：变异版必须「带偏」⇒ 该行之后的注释不再被抹、代码被当字符串丢掉
    assert.ok(mut.stripComments(fix, MODE_BLANK).includes('/lemo-opuscar/'),
      '变异版竟把 :538 之后的注释剥掉了 ⇒ 说明 6a 没有牙（或变异没生效）');
    assert.ok(!mut.stripComments(fix, MODE_DROPSTR).includes('const AFTER = 1;'),
      '变异版竟保住了 :538 之后的代码 ⇒ 说明 6a 没有牙');
    // 6c：两层嵌套 ⇒ 变异版把第 2 个反引号当闭合，之后整段当**代码**输出
    //     ⇒ 内层模板串内容 `bb` 会当代码漏出来（★ 不能用「注释有没有被剥」判牙：两层嵌套的 4 个反引号
    //       两两配对，错位区正好被夹住、第 4 个反引号之后两边重新同步 ⇒ 注释照样被剥）。
    const mutNest = mut.stripComments(nest, MODE_DROPSTR).split('\n')[0];
    assert.ok(mutNest.includes('bb'),
      `变异版竟把两层嵌套处理对了（模板串内容 bb 没漏成代码）⇒ 说明 6c 没有牙（或变异没生效）：实得 ${JSON.stringify(mutNest)}`);
    assert.ok(!stripComments(nest, MODE_DROPSTR).split('\n')[0].includes('bb'),
      '修复版把内层模板串内容 `bb` 当代码留下了 ⇒ 6c 的判据本身不对');
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
  // 还原（未变异）后，6a/6c 同口径的断言成立
  assert.ok(!stripComments(fix, MODE_BLANK).includes('/lemo-opuscar/'));
  assert.ok(stripComments(nest, MODE_BLANK).split('\n')[1].trim() === '');
});
