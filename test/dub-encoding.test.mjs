/**
 * test/dub-encoding.test.mjs —— 第九批对抗性审计 **F3（GBK 字幕静默错位）** 的回归
 *   + **F4（`winToWsl` 多份实现）** 的「唯一来源」契约
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 为什么必须有这一份（F3 的由来，逐字引自审计实测）
 * ══════════════════════════════════════════════════════════════════════════════
 *   用户上传一份 **GBK** 编码的 `.srt`（国内字幕站下载的绝大多数是它）：
 *     ① `fs.readFileSync(sp, 'utf8')` **不抛、不报** —— 字节被解成一串 U+FFFD（问号）；
 *     ② `parseSrt` **照样解得出时间轴**（时间码是 ASCII）⇒ 因此**不会**走「解析出 0 条」那条告警；
 *     ③ 但 `normCJK` 把问号全丢掉 ⇒ `alignCuesToSentences` 的 **hitRate = 0** ⇒ 所有句子落到
 *        「按各句字数比例分配」⇒ ★★ **用户手写的时间轴被换掉**（实测 spans 从 `[[0,1],[1,3],[3,5]]`
 *        变成 `[[0,2],[2,4],[4,5]]`，第一句被拉长一倍、第二句起点错位 1s）；
 *     ④ 而 `dub.mjs` 仍 `alignMode = 'srt'` 并打绿字「对齐方式：srt …」成功 —— **一句提示都没有**。
 *   ⇒ 修法两条腿（缺一不可）：
 *     · `lib/dub-core.mjs` 新增 `decodeUserText` / `readUserTextFile`：把「这份字节能不能按 UTF-8
 *       严格解出」变成**返回值**；非 UTF-8 ⇒ 返回**非空 `note`**（调用方必须告警），并**尝试按 GBK
 *       兜底解码**（Node 内置 `TextDecoder('gbk')` 本机实测可用；无 ICU 的构建会抛 ⇒ 已 try/catch 兜住）。
 *     · `dub.mjs` 的 `--srt` / `--script` / stdin / `--analysis` **四个文本读点**全部改走它
 *       （审计要求「别只修字幕一处」），且 `alignMode` **如实上报**：一句都没匹配上 ⇒ 不报 `srt`。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 覆盖（全部在 `D:/lemo-tmp/` 的本次专属子树里造夹具，**绝不碰** `D:/lemo-films/` 与 `dub/_uploads/`）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① 判据本身：`TextDecoder('utf-8',{fatal:true})` 对 GBK 字节**必须抛**（否则「检出非 UTF-8」没有牙）；
 *      已知 GBK 字节序列 `D6 D0 CE C4` 必须解出「中文」（证明兜底真的在解 GBK，不是碰巧）。
 *   ② `decodeUserText`：UTF-8 / GBK / 解不出 / 空字节 四种输入的返回值。
 *   ③ ★ F3 机制回归：GBK 字节**按 UTF-8 硬读** ⇒ `parseSrt` 出 5 条 cue（**不为 0**）但 hitRate **= 0**
 *      ⇒ 时间轴确实被「按字数比例」换掉；解对编码后 hitRate = 1、spans 与 UTF-8 版**逐字节相同**。
 *   ④ ★ 零行为变更（正常路径）：合法 UTF-8 字幕 ⇒ `readUserTextFile().text` 与
 *      `fs.readFileSync(p,'utf8')` **逐字节相同**，且 `parseSrt` / `splitSentences` 的结果**深等**。
 *   ⑤ BOM：UTF-8 BOM 文件 ⇒ `utf8:true`（BOM 是合法 UTF-8），且 `parseSrt` / `splitSentences`
 *      的结果与**不带 BOM 的同一份文件**逐字相同 —— 这就是「有意不剥 BOM」的实测依据。
 *   ⑥ F4：`lib/dub-core.mjs` 的 `winToWsl`（**唯一来源**，`dub.mjs` / `server.mjs` /
 *      `lib/triple-check.mjs` 都 import 它）的四类入参契约。★ 另有 **11 份**同功能实现
 *      （+ `lib/dub-core.mjs` 自己 1 份 = 全仓 **12** 个定义点；枚举：`grep -rn '/mnt/\${' --include=*.mjs . | grep -v '^\./test/' | grep -v '\.bak/'`）
 *      **本批不合并**（★ 2026-10-12 订正：本处**原写「仓里另 4 份」**，与 `lib/dub-core.mjs` 末尾**同批订正过**的登记
 *      （实测 **11 份**）**互相矛盾** ⇒ 按**实测口径**改齐。真实理由见那段登记：红线 / 禁改 / 独占 /
 *      `lib/env.mjs` 有 import 环 / 常量求值时机）
 *      ⇒ 它们的差异与「为什么当前不可达」**登记在** `lib/dub-core.mjs` 末尾那段注释里，本文件只钉
 *      唯一来源的契约，**不去钉别人的实现**（免得别人一修，本文件就假红）。
 *   ⑦ ★★ **两种「比例分配」必须分得清**（2026-10-12 新增；由来 = `smoke --full` 的 ⑤+++ 验收红）：
 *      `srtAlignMode()` 只有两态，而 `'srt(比例分配)'` **同时**是「**占位符** SRT（正常，⑤+++ 夹具
 *      就是这样）」与「**编码坏了**（异常，③ 那条）」的标签 ⇒ 区分信号**不在 `align` 上**，
 *      而在**解码告警**（`note`）：① 空 / ② 非空。本节把这条「合起来才分得清」变成**机械可判**，
 *      夹具**逐字取自 ⑤+++**（`KO_TEXT` / `KO_SRT`）。
 *
 * ★★ **判据的绑定方式（2026-10-12 修，本文件自己的一处假绿）**：③ 与 ⑦ 里的 `srtAlignMode`
 *   **真的 `import`** 自 `lib/dub-core.mjs`（`dub.mjs:308` 也 import 它）。★ 本处**原先**是
 *   **照抄一份**三元表达式（自注「与 dub.mjs 的取值口径逐字相同」）—— 那是**镜像不是绑定**：
 *   实测（临时副本）把实现改回恒 `'srt'`（= F3 修**之前**的行为）时，本文件**照旧 13/13 绿**
 *   ⇒ 回归钉**抓不到它本该抓的那一次回退**。改绑之后同一变异**必红**（实测：13→2 红）。
 *
 * ★★ 隔离：临时根 = `LEMO_TMP`（默认 `D:/lemo-tmp`），**解析到 C 盘直接炸**（本项目硬规则）；
 *   本次专属子树带 pid + 时间戳，跑完在 `exit` 钩子里递归删。★ 不 spawn 任何子进程（无 EBUSY 风险）。
 *
 * 用法：node test/dub-encoding.test.mjs
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { decodeUserText, readUserTextFile, parseSrt, splitSentences, alignCuesToSentences, srtAlignMode, winToWsl }
  from '../lib/dub-core.mjs';

// ── 临时根（非 C 盘，本项目硬规则）────────────────────────────────────────────
const TMP_BASE = path.resolve(process.env.LEMO_TMP || 'D:/lemo-tmp');
if (/^[cC]:[\\/]/.test(TMP_BASE)) {
  console.error(`✘ LEMO_TMP 解析到 C 盘（${TMP_BASE}）—— 本项目硬规则：临时/产物非 C 盘。`);
  process.exit(2);
}
const BASE = path.join(TMP_BASE, `dub-encoding-${process.pid}-${Date.now().toString(36)}`);
fs.rmSync(BASE, { recursive: true, force: true });
fs.mkdirSync(BASE, { recursive: true });
process.on('exit', () => { try { fs.rmSync(BASE, { recursive: true, force: true }); } catch { /* ignore */ } });

// ── 夹具 ────────────────────────────────────────────────────────────────────
/** 真 GBK 字节（由 Windows python 的 `encoding='gbk'` 生成，**不是**在 Node 里转出来的）。
 *  核法：`python -c "print(open('gbk.srt','rb').read().hex())"`（本文件下方 `GBK_TEXT` 就是它的解码结果）。 */
const GBK_SRT_HEX =
  '310a30303a30303a30302c303030202d2d3e2030303a30303a30312c3030300abcd7d2d2b1fb0a0a320a30303a30303a30312c30303020'
  + '2d2d3e2030303a30303a30322c3030300ab6a1ceecbcba0a0a330a30303a30303a30322c303030202d2d3e2030303a30303a30332c'
  + '3030300a5bd2f4d0a75d0a0a340a30303a30303a30332c303030202d2d3e2030303a30303a30342c3030300ab8fdd0c10a0a350a30'
  + '303a30303a30342c303030202d2d3e2030303a30303a30352c3030300ac8c90a';
const GBK_TEXT = '1\n00:00:00,000 --> 00:00:01,000\n甲乙丙\n\n2\n00:00:01,000 --> 00:00:02,000\n丁戊己\n\n'
  + '3\n00:00:02,000 --> 00:00:03,000\n[音效]\n\n4\n00:00:03,000 --> 00:00:04,000\n庚辛\n\n'
  + '5\n00:00:04,000 --> 00:00:05,000\n壬\n';
const GBK_SRT = Buffer.from(GBK_SRT_HEX, 'hex');
/** 与 GBK 那份**同一内容**的 UTF-8 版（用于「零行为变更」与「解对之后结果相同」两条）。 */
const UTF8_SRT = Buffer.from(GBK_TEXT, 'utf8');
/** 既不是 UTF-8、GBK 也解不出（0x80 在 GBK 里是欧元符、0xFF 无映射 ⇒ 出 U+FFFD）。 */
const BADBYTES_SRT = Buffer.from('1\n00:00:00,000 --> 00:00:01,000\n'.split('')
  .map((c) => c.charCodeAt(0)).concat([0x80, 0xFF, 0x80, 0x0A]));
/** GBK 的**文案**（`--script` 路径）：`甲乙丙。\n丁戊己。\n`（同上，python 生成）。 */
const GBK_SCRIPT = Buffer.from('bcd7d2d2b1fba1a30ab6a1ceecbcbaa1a30a', 'hex');

const P = {
  gbk: path.join(BASE, 'gbk.srt'),
  utf8: path.join(BASE, 'utf8.srt'),
  bom: path.join(BASE, 'bom.srt'),
  bad: path.join(BASE, 'badbytes.srt'),
  gbkScript: path.join(BASE, 'gbk-script.txt'),
};
fs.writeFileSync(P.gbk, GBK_SRT);
fs.writeFileSync(P.utf8, UTF8_SRT);
fs.writeFileSync(P.bom, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), UTF8_SRT]));
fs.writeFileSync(P.bad, BADBYTES_SRT);
fs.writeFileSync(P.gbkScript, GBK_SCRIPT);

/** 文案（3 句）—— 与上面那份 SRT 的 cue 文本一一对得上。 */
const TEXTS = ['甲乙丙。', '丁戊己。', '庚辛壬。'];
const spansOf = (cues) => alignCuesToSentences(cues, TEXTS);

/** `TextDecoder('gbk')` 在本机是否可用（无 ICU 的精简构建会抛 ⇒ 此时「只告警、不转码」）。 */
const HAS_GBK = (() => { try { new TextDecoder('gbk'); return true; } catch { return false; } })();

// ══════════════════════════════════════════════════════════════════════════════
// ① 判据本身有没有牙
// ══════════════════════════════════════════════════════════════════════════════
test('① 判据的牙：严格 UTF-8 解码对 GBK 字节必须抛；对合法 UTF-8 必须不抛', () => {
  assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(GBK_SRT),
    '★ 判据失效：GBK 字节竟然通过了严格 UTF-8 解码 ⇒ 「检出非 UTF-8」无从谈起');
  assert.doesNotThrow(() => new TextDecoder('utf-8', { fatal: true }).decode(UTF8_SRT));
  // 宽松解码（= 改前 `toString('utf8')`）**不抛**、只把字节换成 U+FFFD —— 这正是「静默」的根源
  const loose = GBK_SRT.toString('utf8');
  assert.ok(loose.includes('\uFFFD'), '宽松 UTF-8 解码应产出 U+FFFD（改前就是靠它静默的）');
});

test('① 兜底真的在解 GBK：已知字节序列 D6 D0 CE C4 ⇒「中文」', () => {
  if (!HAS_GBK) {
    // 无 ICU 的 Node：`TextDecoder('gbk')` 抛 ⇒ 实现必须退化成「只告警、不转码」，**不许崩**
    assert.throws(() => new TextDecoder('gbk'), '本机报告无 gbk，但构造竟然成功？');
    const r = decodeUserText(Buffer.from([0xD6, 0xD0, 0xCE, 0xC4]), 'x');
    assert.equal(r.utf8, false);
    assert.notEqual(r.note, '', '解不出也必须给出非空 note（否则又变静默）');
    return;
  }
  assert.equal(new TextDecoder('gbk').decode(Buffer.from([0xD6, 0xD0, 0xCE, 0xC4])), '中文');
});

// ══════════════════════════════════════════════════════════════════════════════
// ② decodeUserText / readUserTextFile 的返回值
// ══════════════════════════════════════════════════════════════════════════════
test('② decodeUserText：UTF-8 原样 + utf8:true + note 为空（正常路径零干扰）', () => {
  const r = decodeUserText(UTF8_SRT, '字幕');
  assert.equal(r.utf8, true);
  assert.equal(r.encoding, 'utf-8');
  assert.equal(r.note, '', '★ 合法 UTF-8 时 note 必须为空 —— 否则正常路径会凭空多出告警');
  assert.equal(Buffer.compare(Buffer.from(r.text, 'utf8'), UTF8_SRT), 0, '★ 必须逐字节等价');
});

test('② decodeUserText：空字节 ⇒ 合法空文本（不是「编码错误」）', () => {
  const r = decodeUserText(Buffer.alloc(0), '字幕');
  assert.equal(r.utf8, true);
  assert.equal(r.text, '');
  assert.equal(r.note, '');
});

test('② decodeUserText：GBK 字节 ⇒ utf8:false + 解对文本 + **非空 note**', () => {
  const r = decodeUserText(GBK_SRT, '字幕');
  assert.equal(r.utf8, false, '★ 非 UTF-8 必须如实标出');
  assert.notEqual(r.note, '', '★ 必须给出可告警的 note（这就是「不再静默」的载体）');
  assert.ok(/不是 UTF-8/.test(r.note), `note 要说清「不是 UTF-8」：${r.note}`);
  if (HAS_GBK) {
    assert.equal(r.encoding, 'gbk');
    assert.equal(r.text, GBK_TEXT, '★ 按 GBK 解出来的文本必须与真值逐字相同');
  } else {
    assert.equal(r.encoding, '未知');
  }
});

test('② decodeUserText：UTF-8 与 GBK 都解不出 ⇒ utf8:false + 「未知」+ 要求转码', () => {
  const r = decodeUserText(BADBYTES_SRT, '字幕');
  assert.equal(r.utf8, false);
  assert.equal(r.encoding, '未知');
  assert.notEqual(r.note, '');
  assert.ok(/转成 UTF-8/.test(r.note), `note 要给出可执行的办法：${r.note}`);
});

test('② readUserTextFile：真文件读出来与 decodeUserText 逐字同形', () => {
  const a = readUserTextFile(P.gbk, '字幕');
  const b = decodeUserText(fs.readFileSync(P.gbk), '字幕');
  assert.deepEqual(a, b, '★ 文件版不许另造一份语义');
  assert.equal(a.text, GBK_TEXT);
  assert.equal(a.utf8, false);
  // 文案路径（`--script`）读的也是它 —— 同一份 GBK 字节，只是标签不同
  const s = readUserTextFile(P.gbkScript, '文案');
  assert.equal(s.utf8, false, '★ GBK 文案同样必须被检出（这就是「别只修字幕一处」那条）');
  assert.equal(s.text, '甲乙丙。\n丁戊己。\n');
  assert.ok(/文案不是 UTF-8/.test(s.note), `note 要带上是**哪一份**文本：${s.note}`);
});

// ══════════════════════════════════════════════════════════════════════════════
// ③ ★ F3 机制回归（改前必红的那条）
// ══════════════════════════════════════════════════════════════════════════════
test('③ ★ GBK 字幕「按 UTF-8 硬读」⇒ 解析得出 5 条 cue，但匹配率 0、时间轴被换掉（改前的真形态）', () => {
  const cues = parseSrt(GBK_SRT.toString('utf8'));            // ★ 改前的读法
  assert.equal(cues.length, 5, '时间码是 ASCII ⇒ cue 数照样是 5（**不会**走「解析出 0 条」那条告警）');
  const a = spansOf(cues);
  assert.equal(a.hitRate, 0, '★ 问号被 normCJK 丢光 ⇒ 一条都认不出');
  // 认不出 ⇒ 全部落到「按各句字数比例分配」⇒ 时间轴被换掉（实测差异，不是推测）
  const guessed = a.spans.map(([s, e]) => [s.toFixed(3), e.toFixed(3)]);
  assert.deepEqual(guessed, [['0.000', '2.000'], ['2.000', '4.000'], ['4.000', '5.000']]);
});

test('③ ★ 用 readUserTextFile 解对编码之后：匹配率 1，时间轴与 UTF-8 版逐字节相同', () => {
  const good = spansOf(parseSrt(readUserTextFile(P.gbk, '字幕').text));
  const ref = spansOf(parseSrt(readUserTextFile(P.utf8, '字幕').text));
  assert.equal(good.hitRate, 1, '★ 解对编码后必须全部认得出（GBK 兜底真的把用户时间轴救回来了）');
  assert.deepEqual(good.spans, ref.spans, '★ 与同一份内容的 UTF-8 版**逐字节相同**');
  assert.notDeepEqual(good.spans, spansOf(parseSrt(GBK_SRT.toString('utf8'))).spans,
    '★ 与「硬读」的结果必须不同 —— 这条就是「用户时间轴被换掉」的证据');
});

test('③ ★ 一句都没匹配上 ⇒ `alignMode` 不许报 `srt`（如实上报的判据）', () => {
  // ★★ 判据的**唯一来源**：`lib/dub-core.mjs` 的 `srtAlignMode(hitRate)` —— `dub.mjs` 也 import 它。
  //   ★ 本处**原先**写的是**照抄一份**（自注「与 dub.mjs 的取值口径逐字相同」）⇒ 那是**镜像不是绑定**：
  //     实测（2026-10-12，临时副本）把 `dub.mjs` 的实现改回恒 `'srt'`（= F3 修**之前**的行为），
  //     本文件**照旧 13/13 绿** ⇒ 回归钉**抓不到它本该抓的那一次回退**。现改为**真的 import**。
  const modeOf = srtAlignMode;
  const noMatch = parseSrt(UTF8_SRT.toString('utf8'));
  assert.equal(spansOf(noMatch).hitRate, 1);
  assert.equal(modeOf(spansOf(noMatch).hitRate), 'srt', '认得出 ⇒ 报 srt（正确路径不许被误伤）');
  // 换成与文案毫无关系的 cue 文本 ⇒ hitRate 0 ⇒ 必须**不报** `srt`
  const alien = parseSrt(UTF8_SRT.toString('utf8')).map((c) => ({ ...c, text: 'zzz' }));
  assert.equal(spansOf(alien).hitRate, 0);
  assert.equal(modeOf(spansOf(alien).hitRate), 'srt(比例分配)');
  assert.notEqual(modeOf(spansOf(alien).hitRate), 'srt', '★ 退化成按字数比例猜时**不许**报 srt');
});

// ══════════════════════════════════════════════════════════════════════════════
// ④ ★ 零行为变更（正常路径）：合法 UTF-8 字幕逐字节相同
// ══════════════════════════════════════════════════════════════════════════════
test('④ ★ 零行为变更：合法 UTF-8 字幕 ⇒ 文本逐字节相同、parseSrt/splitSentences 深等', () => {
  const oldText = fs.readFileSync(P.utf8, 'utf8');            // ★ 改前的读法
  const newText = readUserTextFile(P.utf8, '字幕').text;      // ★ 改后的读法
  assert.equal(Buffer.compare(Buffer.from(oldText, 'utf8'), Buffer.from(newText, 'utf8')), 0,
    '★ 正常路径必须逐字节相同');
  assert.deepEqual(parseSrt(newText), parseSrt(oldText), 'parseSrt 结果必须深等');
  assert.deepEqual(splitSentences(newText), splitSentences(oldText), 'splitSentences 结果必须深等');
  assert.deepEqual(spansOf(parseSrt(newText)), spansOf(parseSrt(oldText)), '对齐结果必须深等');
});

// ══════════════════════════════════════════════════════════════════════════════
// ⑤ BOM：有意不剥（实测依据）
// ══════════════════════════════════════════════════════════════════════════════
test('⑤ UTF-8 BOM 文件：utf8:true，且 parseSrt / splitSentences 与无 BOM 版逐字相同', () => {
  const r = readUserTextFile(P.bom, '字幕');
  assert.equal(r.utf8, true, 'BOM 是合法 UTF-8 ⇒ 不该被当成「非 UTF-8」告警');
  assert.equal(r.note, '');
  // U+FEFF 是 JS 的空白字符 ⇒ 两处 trim 都会吃掉它 ⇒ 剥与不剥下游等价（这就是「不剥」的依据）
  assert.deepEqual(parseSrt(r.text), parseSrt(fs.readFileSync(P.utf8, 'utf8')),
    '★ BOM 版与无 BOM 版的 parseSrt 结果必须深等（否则说明 BOM 真的漏到了下游）');
  assert.deepEqual(splitSentences(r.text), splitSentences(fs.readFileSync(P.utf8, 'utf8')));
  assert.deepEqual(spansOf(parseSrt(r.text)), spansOf(parseSrt(fs.readFileSync(P.utf8, 'utf8'))));
});

// ══════════════════════════════════════════════════════════════════════════════
// ⑦ ★ 两种「比例分配」必须**分得清**（第九批 F3 的验收红：`smoke --full` 的 ⑤+++）
// ══════════════════════════════════════════════════════════════════════════════
// ★ 由来：`srtAlignMode()` **只有两态**，而 `'srt(比例分配)'` **同时**出现在两种完全不同的情形：
//     ① **正常**：SRT 读得好，只是文本是**占位符**（`test/cases.mjs` 的 ⑤+++ 夹具 `KO_SRT` 就是这样
//        —— 它的注释明写「SRT 只提供时间轴」，文本与 `KO_TEXT` **本来就对不上**）；
//     ② **异常**：SRT 的字节不是 UTF-8 且解不出（本文件 ③ 那条，F3 要抓的）。
// ⇒ ★ 二者的区分信号**不在 `align` 上**，而在**解码告警**（`decodeUserText().note` ⇒ `warn()`）：
//     ① `note` **为空**（无告警）/ ② `note` **非空**（「不是 UTF-8」告警）。
//   ★ 本节把「**两个信号合起来才分得清**」变成**机械可判**：同一个 `'srt(比例分配)'` 标签下，
//     `note` 一空一非空。谁哪天把两个信号并成一个（或让 `align` 去承载编码），这里必红。
//
// ★★ 夹具**逐字取自 ⑤+++**（`test/cases.mjs` 的 `KO_TEXT` / `KO_SRT`）—— 不另造一份，
//    否则本节的结论对那条用例**不成立**（那正是本次验收红暴露的问题：夹具的性质没人钉）。
const KO_TEXT_555 = '这是保留原声原画的测试。画面和声音都不改。';
const KO_SRT_555 = '1\n00:00:00,000 --> 00:00:00,800\n占位文本甲（SRT 只提供时间轴）\n\n'
  + '2\n00:00:00,800 --> 00:00:01,600\n占位文本乙\n';

test('⑦ 占位符 SRT（⑤+++ 夹具原样）：标签 = srt(比例分配) 但 **note 为空**（无编码告警）', () => {
  const dec = decodeUserText(Buffer.from(KO_SRT_555, 'utf8'), '字幕');
  assert.equal(dec.utf8, true, '★ 夹具是**合法 UTF-8**（只是文本是占位符）');
  assert.equal(dec.note, '', '★ 合法 UTF-8 ⇒ 无告警 —— 这就是「占位符」侧的区分信号');
  const cues = parseSrt(dec.text);
  assert.equal(cues.length, 2, '时间轴照样解得出来（2 条 cue）');
  const a = alignCuesToSentences(cues, splitSentences(KO_TEXT_555));
  assert.equal(a.hitRate, 0, '★ 占位文本与文案本来就对不上 ⇒ 匹配率 0（这是**夹具的设计**，不是错误）');
  assert.equal(srtAlignMode(a.hitRate), 'srt(比例分配)', '⇒ 标签是「比例分配」那一态');
});

test('⑦ 编码解不出的 SRT：标签**同样**是 srt(比例分配)，但 **note 非空**（有告警）', () => {
  const dec = decodeUserText(BADBYTES_SRT, '字幕');
  assert.equal(dec.utf8, false);
  assert.notEqual(dec.note, '', '★ 解不出 ⇒ 必须有告警 —— 这就是「编码坏了」侧的区分信号');
  const a = alignCuesToSentences(parseSrt(dec.text), TEXTS);
  assert.equal(a.hitRate, 0);
  assert.equal(srtAlignMode(a.hitRate), 'srt(比例分配)');
});

test('⑦ ★ 合起来才分得清：两种情形**标签相同**，只有 note 能把它们分开', () => {
  const ph = decodeUserText(Buffer.from(KO_SRT_555, 'utf8'), '字幕');
  const bad = decodeUserText(BADBYTES_SRT, '字幕');
  const modePh = srtAlignMode(alignCuesToSentences(parseSrt(ph.text), splitSentences(KO_TEXT_555)).hitRate);
  const modeBad = srtAlignMode(alignCuesToSentences(parseSrt(bad.text), TEXTS).hitRate);
  assert.equal(modePh, modeBad, '★ 两种情形的 `align` **本来就相同** ⇒ `align` 分不开它们（这是事实，不是缺陷）');
  // ⇒ 区分信号只能是 note：空 / 非空
  assert.equal(ph.note === '', true, '占位符侧：note 为空');
  assert.equal(bad.note === '', false, '编码坏侧：note 非空');
  assert.notEqual(ph.note === '', bad.note === '', '★ 判据：用 note 当判别器时两种情形必须落在**不同**一侧');
});

test('⑦ 零行为变更：`srtAlignMode` 与原先内联的三元表达式**逐值相同**', () => {
  const old = (hitRate) => (hitRate > 0 ? 'srt' : 'srt(比例分配)');   // ★ 改前内联在 `dub.mjs:308`
  for (const h of [0, 0.25, 0.5, 7 / 8, 1]) {
    assert.equal(srtAlignMode(h), old(h), `hitRate=${h} 时取值变了`);
  }
  // ★ 顺带钉住「编码」与「标签」**正交**：GBK 解得出（hitRate=1、标签 srt）时 note **仍**非空
  const gbk = readUserTextFile(P.gbk, '字幕');
  assert.notEqual(gbk.note, '', 'GBK 解得出也必须告警（告警**不是** hitRate 的函数）');
  assert.equal(srtAlignMode(alignCuesToSentences(parseSrt(gbk.text), TEXTS).hitRate), 'srt',
    '★ 解对编码后 hitRate=1 ⇒ 标签是 srt —— 标签**不**承载编码信息');
});

// ══════════════════════════════════════════════════════════════════════════════
// ⑥ F4：`winToWsl` 唯一来源的契约
// ══════════════════════════════════════════════════════════════════════════════
test('⑥ winToWsl（唯一来源）：盘符绝对路径 / 正斜杠 / UNC / 相对路径 / 盘符相对路径', () => {
  assert.equal(winToWsl('D:\\a\\b.mp4'), '/mnt/d/a/b.mp4');
  assert.equal(winToWsl('C:/x/y'), '/mnt/c/x/y');
  assert.equal(winToWsl('D:\\lemo-films\\dub\\_uploads\\t1.srt'), '/mnt/d/lemo-films/dub/_uploads/t1.srt');
  // 非盘符路径的 fallback：把分隔符换成 `/`（bash 侧才找得到）
  assert.equal(winToWsl('relative\\sub\\file.mp4'), 'relative/sub/file.mp4');
  assert.equal(winToWsl('\\\\server\\share\\f.mp4'), '//server/share/f.mp4');
  // ★ 盘符**相对**路径（`D:foo.wav`，无斜杠）：本实现**不碰**它 ——
  //   而 `lemo-make.mjs` 的内联 `w2l` 会把它错解成 `/mnt/dfoo.wav`（差异已登记在 dub-core 末尾注释里）
  assert.equal(winToWsl('D:foo.wav'), 'D:foo.wav');
});
