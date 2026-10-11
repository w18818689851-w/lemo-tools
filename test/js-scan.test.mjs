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
// ★ 本文件怎么自证「有牙」（判据⑤）：把 `lib/js-scan.mjs` 里的**正则识别**临时去掉（`scanRegex` 恒返回 -1），
//   写成一个临时模块再 import —— 它**必须**在最小复现上「带偏」。若这一条不变红 ⇒ 说明第 1 条用例没牙。
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

// ── 3. 等价性：真实语料上，「安全文件」新旧逐字节相同 ────────────────────────
test('★ 等价性·安全文件：新实现与旧实现逐字节相同（三种口径）', () => {
  const corpus = [
    'server.mjs', 'dub.mjs', 'lemo-make.mjs', 'consistency-check.mjs', 'originality-audit.mjs',
    ...fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f.endsWith('.mjs')).map((f) => path.join('lib', f)),
    ...fs.readdirSync(path.join(ROOT, 'scripts')).filter((f) => f.endsWith('.mjs')).map((f) => path.join('scripts', f)),
  ];
  let checked = 0;
  for (const rel of corpus) {
    const src = readIf(path.join(ROOT, rel));
    if (src === null) continue;
    if (hasDanger(src)) continue;                 // 含危险正则 ⇒ 走下面的「更正确」判据
    checked++;
    for (let k = 0; k < MODES.length; k++) {
      const nw = stripComments(src, MODES[k]);
      const ol = OLD[k](src);
      assert.equal(nw, ol, `${rel}（口径 ${JSON.stringify(MODES[k])}）新旧不一致 —— 无危险正则的文件不该有差异`);
    }
  }
  assert.ok(checked >= 40, `安全文件样本太少（实测 ${checked} 个）⇒ 判据可能失明`);
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
