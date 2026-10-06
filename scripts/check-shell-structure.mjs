#!/usr/bin/env node
/**
 * scripts/check-shell-structure.mjs —— 渲染链 shell 脚本的**结构闸门**
 *
 * ★ 为什么需要它（2026-10-03 实踩，两类都**骗过了 `sh -n`**）：
 *
 *   ① **`\` 续行后面紧跟 `#` 注释** ⇒ 注释吃掉续行，命令被截断，
 *      后面的参数变成**独立命令**。实测 `styles/watercolor/demo/mux.sh`：
 *      ```
 *      ffmpeg ... -c:v libx264 -preset slow -crf 16 -g 120 \      ← 续行
 *      # ★ AAC 编码余量说明…                                        ← 注释吃掉续行
 *      LN_TP="${LEMO_LN_TP:--3.5}"
 *        -af "loudnorm=…" -c:a aac …                                ← 变成独立命令
 *      ```
 *      真跑报 `sh: -af: command not found`（退出码 127）——**根本出不了片**。
 *      `sh -n` 报 **OK**（这不是语法错，是语义被注释改变）。
 *      同类还有 `styles/paper-popup/demo/mux.sh`（那份还有 `set -e`，直接中止）。
 *
 *   ② **判定块以 `if … fi` 结尾、后面没有 `exit 0`** ⇒ 脚本退出码 = 最后一条语句的状态
 *      ⇒ **通过时反而 exit 1、失败时 exit 0**（全反了）。实测 12 个有复核块的文件里 11 个中招。
 *
 * 用法：node scripts/check-shell-structure.mjs [--wsl]
 *   --wsl：额外扫 WSL 侧 /home/lemo/lemo-opuscar（慢，需要 wsl 可用）
 *
 * ★ WIN 侧失明守卫（2026-10-04 补）：WSL 侧早已有「扫描为空 ⇒ FAIL」的守卫（见下方 wslCount），
 *   但 **WIN 侧没有** —— `WIN_ROOTS` 全部不存在时 `files` 为空、`fails` 空 ⇒ 静默绿。
 *   判据：WIN 侧收集到 0 个 shell 脚本 ⇒ 判 FAIL 并明说「失明」。
 * 退出码：有问题（或 WIN 侧失明）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// ★ 本机 `spawnSync`/`execFileSync` 对**任何**可执行文件一律返回 EBUSY ⇒ 一律用异步 spawn。
const runAsync = (bin, args, opts = {}) =>
  new Promise((res) => {
    const p = spawn(bin, args, opts);
    let o = '', e = '';
    p.stdout.on('data', (d) => (o += d));
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res({ o, e: String(err.message), c: -1 }));
    p.on('close', (c) => res({ o, e, c }));
  });

const WIN_ROOTS = ['D:/lemo-opuscar', 'D:/lemo-tools'];
const SKIP = /node_modules|\.git\/|_distill\/logs|\.orig-|\.bak/;
const fails = [];

function collect(dir, depth = 0, out = []) {
  if (depth > 7) return out;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name).replace(/\\/g, '/');
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) collect(p, depth + 1, out);
    else if (/\.(sh|bash)$/.test(e.name)) out.push(p);
  }
  return out;
}

function checkOne(file, text) {
  const lines = text.split('\n');

  // ① 续行后紧跟注释
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\\\s*$/.test(lines[i]) && /^\s*#/.test(lines[i + 1])) {
      fails.push({ file, kind: '① 续行被注释吃掉', ln: i + 1, detail: `${lines[i].trim().slice(0, 50)} ⏎ ${lines[i + 1].trim().slice(0, 40)}` });
    }
  }

  // ② 判定块结尾缺 exit 0：最后一条非空非注释语句若是 fi，且前面 20 行内有 "missed the target"/判据 awk
  const tail = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.trim() && !/^\s*#/.test(l));
  const last = tail[tail.length - 1];
  if (last && /^\s*fi\s*$/.test(last.l)) {
    // ★ 2026-10-06 收紧（夹具实测的假红）：原判据把**整段（含注释）**丢进 near 做标记匹配，
    //   于是一个**普通**脚本只要「最后一条非注释语句是 fi」且前 25 行里**注释**提到过
    //   `input_tp`（如 `# 这里的 input_tp 只是顺带一提`）就被判成「判定块后缺 exit 0」——
    //   而它根本不是判定块 ⇒ 假红。现在 near **只取非注释行**：标记必须出现在**代码**里才算
    //   「这是判定块」。真实判定块的标记（`awk … input_tp …` / `echo "…missed the target…"`）
    //   都在代码行上，故本收紧不改真实语料结论（改前改后 82 个脚本均 0 命中）。
    const near = lines.slice(Math.max(0, last.i - 25), last.i + 1)
      .filter((l) => !/^\s*#/.test(l)).join('\n');
    if (/missed the target|input_tp|Peak level dB/.test(near)) {
      fails.push({ file, kind: '② 判定块后缺 exit 0', ln: last.i + 1, detail: '以 fi 结尾 ⇒ 退出码与判定结果相反' });
    }
  }
}

const files = [];
for (const r of WIN_ROOTS) files.push(...collect(r));
// ★ WIN 侧失明守卫：一个脚本都没收到 ⇒ 扫描根全不存在 / 路径变了 ⇒ 不能静默当通过
if (files.length === 0) {
  fails.push({ file: '(WIN)', kind: '✘ WIN 扫描为空', ln: 0, detail: `期望从 ${WIN_ROOTS.join(' / ')} 收集 shell 脚本，实际 0 个 ⇒ 失明` });
}
for (const f of files) checkOne(f, fs.readFileSync(f, 'utf8'));

// ── WSL 侧（可选）：同名文件与 Windows 侧比对 md5，顺便查结构 ──
let wslCount = 0;
if (process.argv.includes('--wsl')) {
  const rel = files.filter((f) => f.startsWith('D:/lemo-opuscar/')).map((f) => f.replace('D:/lemo-opuscar/', ''));
  const script = rel.map((r) => `if [ -f "/home/lemo/lemo-opuscar/${r}" ]; then echo "=== ${r}"; cat "/home/lemo/lemo-opuscar/${r}"; fi`).join('\n');
  const tmp = 'D:/lemo-tools/.tmp-wsl-scan.sh';
  fs.writeFileSync(tmp, script, 'utf8');
  const r = await runAsync('wsl', ['-d', 'Ubuntu-24.04', '-u', 'root', '--', 'bash', '-c',
    `tr -d '\\r' < /mnt/d/lemo-tools/.tmp-wsl-scan.sh > /tmp/wslscan.sh && bash /tmp/wslscan.sh`],
    { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  const out = r.o || '';
  let cur = null, buf = [];
  const flush = () => { if (cur) { checkOne('WSL:/home/lemo/lemo-opuscar/' + cur, buf.join('\n')); wslCount++; } };
  for (const line of out.split('\n')) {
    const m = line.match(/^=== (.+)$/);
    if (m) { flush(); cur = m[1]; buf = []; }
    else if (cur !== null) buf.push(line);
  }
  flush();
  // ★ 防「假通过」：WSL 侧一个文件都没读到，说明 wsl 调用失败或路径不对 —— 必须报出来，不能静默当通过
  if (wslCount === 0) {
    fails.push({ file: 'WSL:/home/lemo/lemo-opuscar', kind: '✘ WSL 扫描为空', ln: 0, detail: `期望 ${rel.length} 个文件，实际读到 0 个（wsl 调用失败？退出码 ${r.c}）` });
  }
}

console.log(`扫描 shell 脚本：${files.length} 个（Windows 侧）${process.argv.includes('--wsl') ? ` + ${wslCount} 个（WSL 侧）` : ''}`);
if (fails.length) {
  console.log(`\n✘ 发现 ${fails.length} 处结构问题：\n`);
  for (const f of fails) console.log(`  ${f.file}\n    L${f.ln} [${f.kind}] ${f.detail}`);
} else {
  console.log('\n✓ 未发现「续行被注释吃掉」或「判定块缺 exit 0」的结构问题。');
}
console.log(`\n[闸门] 问题 ${fails.length} 处 ${fails.length ? '✘' : 'OK'}`);
process.exitCode = fails.length ? 1 : 0;
