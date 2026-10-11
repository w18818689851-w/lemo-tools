#!/usr/bin/env node
// test/asr-cli.test.mjs —— 编排器 ⑪「ASR 三参数 CLI 出口」（`--asr-lang` / `--asr-model` / `--asr-threshold`）回归测试
//
// ★ 为什么必须有这一份：
//   「功能对齐核查」把「`asr_check` 的三个参数在 UI 不可调」记为一条 ⚠️ 缺控件，根因是**编排器把它们
//   写死了、根本没有 CLI 出口**（库侧 `core/tts/asr_check.py` 是 `[--lang auto] [--model <name>]
//   [--threshold 0.92]`）。本次给它们开了出口，而这块代码**默认路径不跑新分支**（opt-in 式：
//   不传参数时 `$LEMO_ASR_OPTS` 为空 ⇒ 走 else，命令与改动前一字不差）⇒ 既有测试对它**零覆盖**。
//   它有两个「静默失败」面：
//     ① 参数**没传进**内嵌 WSL 脚本（改了 CLI 却忘了改脚本 ⇒ 用户以为调了、实际没调）；
//     ② 默认路径**被动过**（多一个空格、多一个 flag ⇒ 与改动前不再逐字节一致，红线被悄悄破坏）。
//   ⇒ 本文件把这两面都钉住：CLI 契约（真跑）+ **从源码重建内嵌脚本**（真值）+ **真跑 shell**（真值）。
//
// ★ 隔离：
//   · 不碰真实输出目录、**绝不**把成片写进 `D:/lemo-films/<slug>/`（本项目踩过「无 `--out` 真跑 ⇒
//     样板片被覆盖」的事故）—— 本文件的 CLI 用例一律带 `--dry-run`（不跑音频/渲染）。
//   · 临时产物只落 `D:/lemo-tmp/_asr-cli-test-fx`（`after()` 里清掉）。
//   · 不真跑 WSL：内嵌脚本靠**从源码重建**取得（见下），命令靠**桩 python** 真跑 Git Bash 取得 argv。
//
// ★ 怎么拿到「内嵌 WSL 脚本」而不真跑 WSL：
//   内嵌脚本就是 `audioScriptFor(phase)` 返回的那个模板字符串。本文件把该模板**从源码里切出来**、
//   用 `new Function` 原样求值（模板里没有反引号，见 `lemo-make.mjs` 里那条「注释里绝不能出现反引号」
//   的既有说明），从而得到**与 `runWsl` 写进 /tmp 的那份逐字节相同**的脚本 —— 不需要 WSL、没有副作用。
//   `shq()` / `asrArgsSuffix()` 同样从源码抽出求值（**实现是权威**，本文件不另写一份等价逻辑）。
//
// 用法：node test/asr-cli.test.mjs
// 退出码：全绿 0，有失败 1。

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORCH = path.join(ROOT, 'lemo-make.mjs');
const FX = 'D:/lemo-tmp/_asr-cli-test-fx';          // 本测试的临时根（绝不碰真实输出目录 / 成片库）
const SRC = fs.readFileSync(ORCH, 'utf8');

// ★ 改动前（本次之前）那条 asr_check 命令的**逐字节原文**。默认路径必须与它一字不差 ——
//   这是「默认路径逐字节不变」的**基准**（照 `--color default` / `--review` 的做法）。
const ORIGINAL_ASR_CMD = '.venv/bin/python core/tts/asr_check.py "$ASR_LINES" "$D/voices" 2>&1 '
  + '|| echo "STEP_WARN asr_check 未通过（继续）"';

/** 异步子进程（★ 本机 `spawnSync` / `execFileSync` 一律 EBUSY ⇒ 只能用异步 `spawn`）。 */
function sh(exe, args, opts = {}) {
  return new Promise((resolve) => {
    const c = spawn(exe, args, { windowsHide: true, ...opts });
    let out = '', err = '';
    c.stdout?.on('data', (d) => { out += d; });
    c.stderr?.on('data', (d) => { err += d; });
    c.on('error', (e) => resolve({ code: -1, out, err: String(e.message) }));
    c.on('close', (code) => resolve({ code, out, err }));
  });
}

const orch = (args) => sh(process.execPath, ['lemo-make.mjs', ...args], { cwd: ROOT });

// ── 从源码抽出真实现（shq / asrArgsSuffix）并求值 ────────────────────────────────
function grab(re, what) {
  const m = SRC.match(re);
  assert.ok(m, `编排器源码里抽不到 ${what} —— 实现改名了？（本测试的锚点失明）`);
  return m[0];
}
const shqSrc = grab(/function shq\(s\) \{[\s\S]*?\n\}/, 'shq()');
const asrSrc = grab(/function asrArgsSuffix\(o\) \{[\s\S]*?\n\}/, 'asrArgsSuffix()');
const { shq, asrArgsSuffix } = new Function(`${shqSrc}\n${asrSrc}\nreturn { shq, asrArgsSuffix };`)();

// ── 从源码切出 audioScriptFor 的模板并原样求值 ⇒ 得到与 runWsl 写入 /tmp 那份一致的脚本 ──
const TPL_OPEN = SRC.indexOf('`', SRC.indexOf('const audioScriptFor = (phase) => `'));
const TPL_CLOSE = SRC.indexOf('\n`;', TPL_OPEN);
assert.ok(TPL_OPEN > 0 && TPL_CLOSE > TPL_OPEN, '切不出 audioScriptFor 的模板字面量（写法变了？）');
const TPL_BODY = SRC.slice(TPL_OPEN + 1, TPL_CLOSE);
const buildAudio = new Function('phase', 'shq', 'o', 'deriveCmd', 'swapContent', 'linesSrcWsl',
  'ttsEngine', 'demoWinWsl', 'CFG', 'demoWsl', 'asrArgsSuffix', `return \`${TPL_BODY}\`;`);
/** 用给定的 CLI 选项对象 o（含 asrLang/asrModel/asrThreshold）生成内嵌 WSL 脚本。 */
const audioScript = (o, phase = 'all') => buildAudio(
  phase, shq, o, null, null, null, 'kokoro',
  '/mnt/d/lemo-opuscar/styles/ascii-crt/demo',
  { wslLib: '/home/lemo/lemo-opuscar' },
  '/home/lemo/lemo-opuscar/styles/ascii-crt/demo',
  asrArgsSuffix,
);
const ASR_OPTS_EXPORT_RE = /^export LEMO_ASR_OPTS=(.*)$/m;
const ASR_BRANCH_RE = /^(\s*)if \[ -n "\$LEMO_ASR_OPTS" \]; then (.*); else (.*); fi$/m;

fs.rmSync(FX, { recursive: true, force: true });
fs.mkdirSync(FX, { recursive: true });
after(() => { try { fs.rmSync(FX, { recursive: true, force: true }); } catch { /* 清不掉不影响结论 */ } });

// ═══════════════════ A. CLI 契约（真跑编排器；一律 --dry-run，不跑音频/渲染）═══════════════════

test('A1 `--help` 列出 ASR 三个新参数', async () => {
  const r = await orch(['--help']);
  assert.equal(r.code, 0, '--help 应退出码 0');
  for (const f of ['--asr-lang', '--asr-model', '--asr-threshold']) {
    assert.ok(r.out.includes(f), `--help 应列出 ${f}`);
  }
});

test('A2 不传 ASR 参数时 dry-run 仍 exit 0（CLI 没被打扰）', async () => {
  const r = await orch(['ascii-crt', '--skip-sync', '--dry-run']);
  assert.equal(r.code, 0, `不传新参数应仍 exit 0，实际 ${r.code}\n${r.err}`);
});

test('A3 `--asr-threshold` 非法值一律非 0 退出并给出明确文案', async () => {
  const cases = ['1.5', '-0.1', 'abc', 'NaN', '2'];
  for (const v of cases) {
    const r = await orch(['ascii-crt', '--dry-run', '--asr-threshold', v]);
    assert.notEqual(r.code, 0, `--asr-threshold ${v} 应非 0 退出`);
    assert.match(r.err + r.out, /--asr-threshold 必须是 0–1 之间的有限数/, `--asr-threshold ${v} 应给出文案`);
  }
});

test('A4 `--asr-threshold` 边界 0 / 1 / 0.92 合法（exit 0）', async () => {
  for (const v of ['0', '1', '0.92', '0.8']) {
    const r = await orch(['ascii-crt', '--skip-sync', '--dry-run', '--asr-threshold', v]);
    assert.equal(r.code, 0, `--asr-threshold ${v} 应合法（exit 0），实际 ${r.code}\n${r.err}`);
  }
});

test('A5 `--asr-lang` / `--asr-model` 悬空取值非 0 退出（不静默吞掉下一个选项）', async () => {
  for (const f of ['--asr-lang', '--asr-model', '--asr-threshold']) {
    const r = await orch(['ascii-crt', f, '--dry-run']);
    assert.notEqual(r.code, 0, `${f} 悬空取值应非 0 退出`);
    assert.match(r.err + r.out, /缺少值/, `${f} 悬空取值应给出「缺少值」`);
  }
});

// ═══════════════════ B. 参数后缀与内嵌脚本（从源码重建的真值）═══════════════════

test('B1 不传三参数 ⇒ 后缀是空串（一个 flag 都不加）', () => {
  assert.equal(asrArgsSuffix({ asrLang: null, asrModel: null, asrThreshold: null }), '',
    '三个都没给时应是空串');
  // 单个不给、其余给，也要逐项正确（null = 不给）
  assert.equal(asrArgsSuffix({ asrLang: null, asrModel: null, asrThreshold: 0.8 }), '--threshold 0.8');
});

test('B2 传了参数 ⇒ 后缀含对应 flag 与值（对应库侧 --lang/--model/--threshold）', () => {
  assert.equal(asrArgsSuffix({ asrLang: 'en', asrModel: null, asrThreshold: null }), '--lang en');
  assert.equal(asrArgsSuffix({ asrLang: null, asrModel: 'base.en', asrThreshold: null }), '--model base.en');
  assert.equal(asrArgsSuffix({ asrLang: 'zh', asrModel: 'base', asrThreshold: 0.8 }),
    '--lang zh --model base --threshold 0.8');
  // ★ 值必须**裸拼**（不逐 token 加引号）：这个后缀会被整条 shq() 包进 export，随后以 $LEMO_ASR_OPTS
  //   不加引号展开分词 —— 而 shell **不会**把「参数展开结果里的引号」当引号用（见 C 组真跑）。
  //   安全改由 parseArgs 的严格字符集校验保证（不含空白 / 通配符）。
  assert.equal(shq(asrArgsSuffix({ asrLang: 'zh', asrModel: null, asrThreshold: null })), "'--lang zh'");
});

test('B3 默认路径：LEMO_ASR_OPTS 为空，且 else 分支那条命令与改动前**逐字节一致**', () => {
  const s = audioScript({ voice: null, speed: null, asrLang: null, asrModel: null, asrThreshold: null });
  assert.equal(s.match(ASR_OPTS_EXPORT_RE)[1], "''", '不传参数时应 export 空串');
  const m = s.match(ASR_BRANCH_RE);
  assert.ok(m, '应能找到 ASR 的 if/else 分支行');
  assert.equal(m[3], ORIGINAL_ASR_CMD,
    `默认路径（else 分支）的命令必须与改动前逐字节一致：\n  期望 ${ORIGINAL_ASR_CMD}\n  实际 ${m[3]}`);
  // ★ 并且那句原文在源码里**原样存在**（不是被改写后再拼回来的）
  assert.ok(SRC.includes(ORIGINAL_ASR_CMD), '源码里应原样保留改动前那条 asr_check 命令');
});

test('B4 传参后：then 分支把 $LEMO_ASR_OPTS 附加到同一条命令上（含 flag 与值）', () => {
  const o = { voice: null, speed: null, asrLang: 'zh', asrModel: 'base', asrThreshold: 0.8 };
  const s = audioScript(o);
  const m = s.match(ASR_BRANCH_RE);
  assert.ok(m, '应能找到 ASR 的 if/else 分支行');
  assert.equal(m[2], `${ORIGINAL_ASR_CMD.replace(' 2>&1 ||', ' $LEMO_ASR_OPTS 2>&1 ||')}`,
    'then 分支应是在原命令尾部附加 $LEMO_ASR_OPTS');
  // LEMO_ASR_OPTS 的值（shq 包裹后的源码形态）必须**逐字**等于 asrArgsSuffix 的结果再 shq
  assert.equal(s.match(ASR_OPTS_EXPORT_RE)[1], shq(asrArgsSuffix(o)), 'LEMO_ASR_OPTS 应是 asrArgsSuffix 的 shq 形态');
  const opts = s.match(ASR_OPTS_EXPORT_RE)[1];
  for (const t of ['--lang zh', '--model base', '--threshold 0.8']) {
    assert.ok(opts.includes(t), `LEMO_ASR_OPTS 应含 ${t}，实际 ${opts}`);
  }
});

// ═══════════════════ C. 真跑 Git Bash：证明参数**真的进了库侧命令的 argv** ═══════════════════

/** 把重建出来的 ASR 分支行 + 桩 python 放进 FX，真跑 bash，取回被执行的 argv。 */
async function runAsrBranch(o, { env = {} } = {}) {
  const dir = path.join(FX, `run-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(path.join(dir, '.venv', 'bin'), { recursive: true });
  // 桩：把收到的每个参数单独打一行（名字就叫 python，但它是 shell 脚本 ⇒ 会执行）
  fs.writeFileSync(path.join(dir, '.venv', 'bin', 'python'),
    '#!/bin/sh\nfor a in "$@"; do printf \'ARGV:%s\\n\' "$a"; done\n', 'utf8');
  const s = audioScript(o);
  const branch = s.match(ASR_BRANCH_RE)[0].trim();
  const opts = s.match(ASR_OPTS_EXPORT_RE)[1];
  const script = [
    `ASR_LINES='/tmp/x/lines.json'`,
    `D='/tmp/x/demo'`,
    `LEMO_ASR_OPTS=${opts}`,
    branch,
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'run.sh'), script, 'utf8');
  const r = await sh('bash', ['-c', 'chmod +x .venv/bin/python; . ./run.sh'], { cwd: dir, env: { ...process.env, ...env } });
  return r.out.split('\n').filter((l) => l.startsWith('ARGV:')).map((l) => l.slice(5));
}

test('C1 真跑：不传参数 ⇒ 库侧命令收到的 argv 里没有任何 ASR flag', async (t) => {
  const argv = await runAsrBranch({ voice: null, speed: null, asrLang: null, asrModel: null, asrThreshold: null });
  assert.deepEqual(argv, ['core/tts/asr_check.py', '/tmp/x/lines.json', '/tmp/x/demo/voices'],
    `默认路径 argv 应恰是「脚本 + 两个位置参数」，实际 ${JSON.stringify(argv)}`);
});

test('C2 真跑：传了参数 ⇒ 库侧命令的 argv 里出现对应 flag 与值', async (t) => {
  const argv = await runAsrBranch({ voice: null, speed: null, asrLang: 'zh', asrModel: 'base', asrThreshold: 0.8 });
  assert.deepEqual(argv, ['core/tts/asr_check.py', '/tmp/x/lines.json', '/tmp/x/demo/voices',
    '--lang', 'zh', '--model', 'base', '--threshold', '0.8'],
  `传参路径 argv 应含三个 flag 与值，实际 ${JSON.stringify(argv)}`);
});

test('C3 真跑：显式 ASR 参数取消「按行自动跳过」；不传则保持原判定', async (t) => {
  const s = audioScript({ voice: null, speed: null, asrLang: 'zh', asrModel: null, asrThreshold: null });
  const guard = s.split('\n').find((l) => l.includes('$LEMO_ASR_OPTS') && l.includes('ASR_SKIP=0'));
  assert.ok(guard, '应能找到「显式参数 ⇒ ASR_SKIP=0」那一行');
  const run = async (skip, opts) => {
    const dir = path.join(FX, `guard-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'g.sh'),
      `ASR_SKIP='${skip}'\nLEMO_ASR_OPTS=${opts}\n${guard.trim()}\necho "SKIP=$ASR_SKIP"\n`, 'utf8');
    const r = await sh('bash', ['-c', '. ./g.sh'], { cwd: dir });
    return { code: r.code, out: r.out, err: r.err };
  };
  // ① 显式给了参数 + 既有判定「该跳过」⇒ 以用户为准，改判 0 并说明
  const a = await run('1', shq('--lang zh'));
  assert.equal(a.code, 0, `guard 应正常退出：${a.err}`);
  assert.match(a.out, /SKIP=0/, '显式参数应把 ASR_SKIP 改成 0（不再自动跳过）');
  assert.match(a.out, /以用户为准/, '应打印「以用户为准」的说明');
  // ② 没给参数 + 既有判定「该跳过」⇒ 保持 1（默认行为逐字节不变）
  const b = await run('1', "''");
  assert.equal(b.code, 0, `guard 应正常退出：${b.err}`);
  assert.match(b.out, /SKIP=1/, '不传参数时 ASR_SKIP 必须保持原值 1');
  assert.doesNotMatch(b.out, /以用户为准/, '不传参数时不该打印覆盖说明');
  // ③ 没给参数 + 既有判定「不跳过」⇒ 保持 0
  const c = await run('0', "''");
  assert.match(c.out, /SKIP=0/, '不传参数且原判定为 0 时应保持 0');
});
