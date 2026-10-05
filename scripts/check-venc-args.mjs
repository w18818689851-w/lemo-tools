#!/usr/bin/env node
/**
 * scripts/check-venc-args.mjs —— 编码器参数组合的**真编码**闸门（ffmpeg 实测）
 *
 * ★ ① 由来（2026-10-04）：
 *   用户硬规则「渲染一律 GPU 优先」落地后，26 个编码器决策点被改成
 *   「未设 LEMO_VENC ⇒ h264_nvenc / 显式 libx264 ⇒ CPU / 非法值 ⇒ 报错」。
 *   但**这些参数 ffmpeg/nvenc 到底吃不吃**没人验过 —— 手工只抽查了 3 个变体。
 *   任何一处写错（例如把 `-rc constqp` 写成 `-rc bogus`、把 `-cq` 写成 `-bogus`）
 *   都要等到**真出片时**才炸，而且没有任何闸门会拦。
 *   ⇒ 本闸门把仓库里**每一个编码器参数组合**抽出来，逐个用 ffmpeg 编 1 帧，
 *     用「ffmpeg 是否接受这组参数」当判据。
 *
 * ★ ② 判据（机械可解释）：
 *   · 抽取范围：`core/render/**`、`tools/**`、`styles/<slug>/demo/**` 下的 `.sh` / `.mjs` / `.js`
 *     （`*.orig-*` 备份不在内 —— 扩展名不是 .sh/.mjs）。
 *     A 类（shell）：`case "${LEMO_VENC:-}" in … esac` 里每条 `VARG="…"` 分支（含 nvenc 与 libx264）。
 *     B 类（mjs）：`vencArgs(...)` 调用点，以及 `const VARG/VARG444 = VENC === 'h264_nvenc' ? […] : […]` 这类数组。
 *   · 变量代入：`${VAR:-def}` / `$VAR` 用文件内该变量的字面默认值代入；
 *     `$(awk -v c="$CRF" 'BEGIN{printf "%d",(c+0)+4}')` 这类命令替换用具体数字算出（CRF=19 ⇒ 23）。
 *     `-pix_fmt <x>`（在 `$VARG` / 调用点同一行或紧接着的位置）一并带上 —— 那正是要验的东西之一。
 *   · 对**去重后**的每个组合执行：
 *       ffmpeg -hide_banner -nostdin -y -f lavfi -i color=c=black:s=320x240:d=1:r=25 <参数> -f null -
 *     退出码 ≠ 0 ⇒ FAIL，报「组合 + 出自哪个文件哪一行 + ffmpeg 报错摘要」。
 *   · ★ 防空转绿灯：抽到的组合数为 0，或存在**无法代入**的组合（依赖运行期变量）⇒ FAIL 并明说「本闸门已失明 / 无法验证」。
 *
 * ★ ③ 已知局限 / 会误报的边界：
 *   · 只验「ffmpeg 接受这组参数」，**不验**画质 / 体积 / 编码结果是否符合预期。
 *   · 只认上面两种写法；`if [ -z "$LEMO_VENC" ]` 之类别的写法会**看不见**（假阴性）。
 *   · 依赖**运行期变量**的参数（调用点传的不是字面量，如 `vencArgs(SOME_VAR)`）无法代入 ⇒ 判 FAIL 并列出（不静默跳过）。
 *   · 在 WSL 里跑 ffmpeg（`wsl -d Ubuntu-24.04`）；WSL / ffmpeg 不可用时判 FAIL（不能静默变绿）。
 *
 * ★ ④ 退出码：任一组合 ffmpeg 不接受、或抽到 0 个组合、或存在无法代入的组合、或 WSL 不可用 ⇒ 1；否则 0。
 *
 * 用法：node scripts/check-venc-args.mjs [--json]
 *   环境变量：LEMO_OPUSCAR（仓库根，默认 <脚本>/../../lemo-opuscar）
 *             LEMO_VENC_DISTRO（WSL 发行版，默认 Ubuntu-24.04）
 *             LEMO_VENC_FFMPEG（WSL 内 ffmpeg 可执行名，默认 ffmpeg）
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || path.join(HERE, '..', '..', 'lemo-opuscar'));
const DISTRO = process.env.LEMO_VENC_DISTRO || 'Ubuntu-24.04';
const FFMPEG = process.env.LEMO_VENC_FFMPEG || 'ffmpeg';
const JSON_OUT = process.argv.includes('--json');
const CONC = 4;                 // 并发上限（别把 WSL / GPU 打爆）
const HARD_TIMEOUT_MS = 90_000; // 整体硬超时（预期 ~30s 内）

const rel = (p) => path.relative(OPUSCAR, p).replace(/\\/g, '/');
const read = (p) => fs.readFileSync(p, 'utf8');
const lineAt = (text, idx) => text.slice(0, idx).split('\n').length;

// ── 极简算术求值（给 awk 命令替换 / mjs 的 String(crf + 5) 用）───────────────
function evalArith(expr, vars) {
  let e = String(expr), bad = false;
  e = e.replace(/[A-Za-z_]\w*/g, (n) => {
    const v = vars[n];
    if (v !== undefined && /^-?\d+(?:\.\d+)?$/.test(String(v))) return String(v);
    bad = true; return '0';
  });
  if (bad || !/^[\d+\-*/(). \t]+$/.test(e)) return null;
  const toks = e.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  if (!toks) return null;
  let i = 0;
  const peek = () => toks[i];
  const primary = () => {
    if (peek() === '(') { i++; const v = expr0(); if (toks[i++] !== ')') throw 0; return v; }
    if (peek() === '-') { i++; return -primary(); }
    const t = toks[i++];
    if (t === undefined || !/^\d/.test(t)) throw 0;
    return parseFloat(t);
  };
  const term = () => {
    let v = primary();
    while (peek() === '*' || peek() === '/') { const op = toks[i++]; const r = primary(); v = op === '*' ? v * r : v / r; }
    return v;
  };
  const expr0 = () => {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = toks[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  try { const v = expr0(); if (i !== toks.length) return null; return String(Math.trunc(v)); } catch { return null; }
}

// ── shell 抽取 ──────────────────────────────────────────────────────────────
/** 文件内 `NAME="${NAME:-def}"` / `NAME="literal"` 形式的变量默认值（同一行可有多个赋值）。 */
function shellVars(text) {
  const vars = {};
  let m;
  const reDef = /([A-Za-z_]\w*)="\$\{\1:-([^}]*)\}"/g;
  while ((m = reDef.exec(text))) vars[m[1]] = m[2];
  const reLit = /([A-Za-z_]\w*)="([^"$]*)"/g;
  while ((m = reLit.exec(text))) if (vars[m[1]] === undefined) vars[m[1]] = m[2];
  return vars;
}
/** 代入 `${VAR:-def}` / `${VAR}` / `$VAR`；未定义的变量原样保留（之后会被判为无法代入）。 */
function substVars(s, vars) {
  s = s.replace(/\$\{([A-Za-z_]\w*):-([^}]*)\}/g, (_, n, d) => (vars[n] !== undefined ? vars[n] : d));
  s = s.replace(/\$\{([A-Za-z_]\w*)\}/g, (_, n) => (vars[n] !== undefined ? vars[n] : '${' + n + '}'));
  s = s.replace(/\$([A-Za-z_]\w*)/g, (_, n) => (vars[n] !== undefined ? vars[n] : '$' + n));
  return s;
}
/** 代入 `$(awk -v c="$CRF" 'BEGIN{printf "%d",EXPR}')`；返回 null 表示无法代入。 */
function substCmd(s, vars) {
  let failed = false;
  const out = s.replace(
    /\$\(awk\s+-v\s+([A-Za-z_]\w*)=("[^"]*"|'[^']*'|\S+)\s+'BEGIN\{printf\s+"%d",([^}]*)\}'\)/g,
    (whole, name, rawval, expr) => {
      const val = rawval.replace(/^["']|["']$/g, '');
      const v = evalArith(expr, { ...vars, [name]: val });
      if (v === null) { failed = true; return whole; }
      return v;
    },
  );
  return failed ? null : out;
}
/** 抽 shell 里的 `case "${LEMO_VENC:-}" in … esac` → 每条 `VARG="…"` 一条记录。 */
function extractShell(text) {
  const out = [];
  const re = /case\s+"\$\{LEMO_VENC:-\}"\s+in\n([\s\S]*?)\nesac/g;
  let m;
  while ((m = re.exec(text))) {
    const startLine = lineAt(text, m.index);
    m[1].split('\n').forEach((l, i) => {
      // ★ 值里可能嵌 `"`（如 `$(awk -v c="$CRF" …)`）⇒ 用贪婪匹配到该行最后一个 `"`（`;;` 之前）
      const vm = l.match(/VARG="(.*)"\s*;;?\s*$/);
      if (!vm) return;
      const pat = (l.match(/^\s*([^)]*)\)/) || [, '?'])[1].trim();
      out.push({ raw: vm[1], pattern: pat, line: startLine + 1 + i });
    });
  }
  return out;
}
/** `$VARG` 同一行上的 `-pix_fmt <x>`（带上它，正是要验的东西之一）。 */
function shellPixFmts(text) {
  const set = new Set();
  for (const l of text.split('\n')) {
    if (!/\$VARG\b/.test(l)) continue;
    const m = l.match(/-pix_fmt\s+([A-Za-z0-9_]+)/);
    if (m) set.add(m[1]);
  }
  return [...set];
}

// ── mjs 抽取 ────────────────────────────────────────────────────────────────
/** 按顶层逗号切分（尊重引号与括号嵌套）。 */
function splitTop(s) {
  const out = []; let depth = 0, cur = '', q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
/** 解析 JS 数组字面量 → 参数数组；无法代入返回 null。 */
function parseJsArray(src, vars) {
  const inner = src.replace(/^\s*\[/, '').replace(/\]\s*$/, '');
  const args = [];
  for (const item of splitTop(inner)) {
    let m;
    if ((m = item.match(/^'([^']*)'$/)) || (m = item.match(/^"([^"]*)"$/))) { args.push(m[1]); continue; }
    if ((m = item.match(/^String\(([\s\S]*)\)$/))) {
      const v = evalArith(m[1], vars);
      if (v === null) return null;
      args.push(v); continue;
    }
    if (/^[A-Za-z_]\w*$/.test(item) && vars[item] !== undefined) { args.push(String(vars[item])); continue; }
    return null;
  }
  return args;
}
/** 解析 `(crf, preset = 'medium')` → [{name, def}]。 */
function parseParams(s) {
  return splitTop(s).map((p) => {
    const m = p.match(/^([A-Za-z_]\w*)\s*=\s*(?:'([^']*)'|"([^"]*)"|(\S+))$/);
    if (m) return { name: m[1], def: m[2] ?? m[3] ?? m[4] };
    return { name: p.trim(), def: undefined };
  }).filter((p) => p.name);
}
/** 抽 mjs：vencArgs 函数调用点 + `const X = VENC === 'h264_nvenc' ? […] : […]` 直用数组。 */
function extractMjs(text) {
  const recs = [];
  const funcRe = /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*VENC\s*===\s*'h264_nvenc'\s*\?\s*(\[[\s\S]*?\])\s*:\s*(\[[\s\S]*?\])\s*;/g;
  const directRe = /const\s+(\w+)\s*=\s*VENC\s*===\s*'h264_nvenc'\s*\?\s*(\[[\s\S]*?\])\s*:\s*(\[[\s\S]*?\])\s*;/g;
  let m;
  while ((m = funcRe.exec(text))) {
    const [name, params, arrN, arrC] = [m[1], parseParams(m[2]), m[3], m[4]];
    const callRe = new RegExp('\\b' + name + '\\s*\\(([^)]*)\\)', 'g');
    let c;
    while ((c = callRe.exec(text))) {
      const callLine = lineAt(text, c.index);
      const argv = splitTop(c[1]);
      const vars = {};
      params.forEach((p, i) => {
        const a = argv[i];
        if (a === undefined) { if (p.def !== undefined) vars[p.name] = p.def; return; }
        const q = a.match(/^'([^']*)'$/) || a.match(/^"([^"]*)"$/);
        if (q) vars[p.name] = q[1];
        else if (/^-?\d+(?:\.\d+)?$/.test(a)) vars[p.name] = a;
        else vars[p.name] = undefined; // 运行期变量
      });
      const pf = pixFmtNear(text, c.index);
      recs.push({ arrN, arrC, vars, line: callLine, label: `${name}(${c[1].trim()})`, pf });
    }
  }
  while ((m = directRe.exec(text))) {
    const name = m[1];
    const useRe = new RegExp('\\b' + name + '\\b', 'g');
    let u;
    while ((u = useRe.exec(text))) {
      // 跳过定义处自身
      if (text.slice(Math.max(0, u.index - 6), u.index) === 'const ') continue;
      const line = lineAt(text, u.index);
      if (line === lineAt(text, m.index)) continue;
      recs.push({ arrN: m[2], arrC: m[3], vars: {}, line, label: name, pf: pixFmtNear(text, u.index) });
    }
  }
  return recs;
}
/** 从 idx 起向后 500 字符找 `-pix_fmt` 的值（mjs 里写成 `'-pix_fmt', 'yuv420p'`）。 */
function pixFmtNear(text, idx) {
  const win = text.slice(idx, idx + 500);
  const m = win.match(/['"]-pix_fmt['"]\s*,\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

// ── 收集文件 ────────────────────────────────────────────────────────────────
function walk(dir, acc) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(sh|mjs|js)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const files = [];
walk(path.join(OPUSCAR, 'core', 'render'), files);
walk(path.join(OPUSCAR, 'tools'), files);
const stylesDir = path.join(OPUSCAR, 'styles');
if (fs.existsSync(stylesDir)) {
  for (const e of fs.readdirSync(stylesDir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('_')) continue;
    walk(path.join(stylesDir, e.name, 'demo'), files);
  }
}

// ── 组装去重后的参数组合 ────────────────────────────────────────────────────
const combos = new Map();   // key -> { args, sources:[{file,line,label}] }
const unresolved = [];      // { file, line, raw, why }
const addCombo = (args, src) => {
  const key = JSON.stringify(args);
  if (!combos.has(key)) combos.set(key, { args, sources: [] });
  combos.get(key).sources.push(src);
};

for (const file of files.sort()) {
  const r = rel(file);
  const text = read(file);
  if (file.endsWith('.sh')) {
    const vars = shellVars(text);
    const pfs = shellPixFmts(text);
    for (const b of extractShell(text)) {
      const src = { file: r, line: b.line, label: `VARG[${b.pattern}]` };
      const s1 = substVars(b.raw, vars);
      const s2 = substCmd(s1, vars);
      if (s2 === null || /[$`]/.test(s2)) { unresolved.push({ ...src, raw: b.raw, why: s2 === null ? '命令替换无法求值' : '残留未代入的 $/`' }); continue; }
      const base = s2.trim().split(/\s+/).filter(Boolean);
      if (!base.length) { unresolved.push({ ...src, raw: b.raw, why: '代入后为空' }); continue; }
      if (pfs.length) for (const pf of pfs) addCombo([...base, '-pix_fmt', pf], src);
      else addCombo(base, src);
    }
  } else {
    for (const rec of extractMjs(text)) {
      const src = { file: r, line: rec.line, label: rec.label };
      const nv = parseJsArray(rec.arrN, rec.vars);
      const cpu = parseJsArray(rec.arrC, rec.vars);
      for (const [arr, tag] of [[nv, 'nvenc'], [cpu, 'libx264']]) {
        const label = { ...src, label: `${src.label} → ${tag}` };
        if (arr === null) { unresolved.push({ ...label, raw: tag === 'nvenc' ? rec.arrN : rec.arrC, why: '数组含无法代入的表达式' }); continue; }
        const args = rec.pf ? [...arr, '-pix_fmt', rec.pf] : arr;
        addCombo(args, label);
      }
    }
  }
}

const list = [...combos.values()];

// ── 跑 ffmpeg（WSL，一次调用内并行）─────────────────────────────────────────
function shStdin(cmd, args, input) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { windowsHide: true });
    let o = '', e = '';
    c.stdout.on('data', (d) => { o += d; });
    c.stderr.on('data', (d) => { e += d; });
    c.on('close', (code) => resolve({ code, o, e }));
    c.on('error', (x) => resolve({ code: -1, o, e: String(x.message) }));
    if (input !== undefined) { c.stdin.write(input); c.stdin.end(); }
  });
}
const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

async function runAll() {
  if (!list.length) return { statuses: [], fails: [], wslError: null };
  const N = list.length;
  let script = `rm -f /tmp/lemo_venc_*.err /tmp/lemo_venc_fails.txt\n`;
  script += `ffrun() {\n  local idx="$1"; shift\n`;
  script += `  if ${q(FFMPEG)} -hide_banner -nostdin -y -f lavfi -i color=c=black:s=320x240:d=1:r=25 "$@" -f null - >/dev/null 2>"/tmp/lemo_venc_$idx.err"; then\n`;
  script += `    echo "__OK__ $idx"\n  else\n    echo "__FAIL__ $idx"\n    echo "$idx" >> /tmp/lemo_venc_fails.txt\n  fi\n}\n`;
  const groups = Math.min(CONC, N);
  for (let g = 0; g < groups; g++) {
    const lines = [];
    for (let i = g; i < N; i += groups) lines.push(`ffrun ${i} ${list[i].args.map(q).join(' ')}`);
    script += `(\n${lines.join('\n')}\n) &\n`;
  }
  script += `wait\necho "__DONE__"\n`;
  script += `echo "__FAILS_BEGIN__"\n`;
  script += `if [ -f /tmp/lemo_venc_fails.txt ]; then sort -n -u /tmp/lemo_venc_fails.txt | while read i; do echo "===ERR $i==="; tail -6 "/tmp/lemo_venc_$i.err" 2>/dev/null; done; fi\n`;
  script += `echo "__FAILS_END__"\n`;
  script += `rm -f /tmp/lemo_venc_*.err /tmp/lemo_venc_fails.txt\n`;

  const timer = new Promise((r) => setTimeout(() => r({ code: -2, o: '', e: 'HARD_TIMEOUT' }), HARD_TIMEOUT_MS));
  const r = await Promise.race([shStdin('wsl.exe', ['-d', DISTRO, '-e', 'bash', '-s'], script), timer]);
  const o = String(r.o || '');
  const statuses = new Array(N).fill('blocked');
  for (const line of o.split('\n')) {
    let m = line.match(/^__OK__ (\d+)$/); if (m) statuses[+m[1]] = 'ok';
    m = line.match(/^__FAIL__ (\d+)$/); if (m) statuses[+m[1]] = 'fail';
  }
  const fails = [];
  const fm = o.match(/__FAILS_BEGIN__\n([\s\S]*?)\n__FAILS_END__/);
  if (fm) {
    for (const blk of fm[1].split(/^===ERR /m).slice(1)) {
      const idx = +blk.slice(0, blk.indexOf('===')).trim();
      fails.push({ idx, err: blk.slice(blk.indexOf('\n') + 1).trim().split('\n').slice(0, 4).join('\n') });
    }
  }
  const wslError = !o.includes('__DONE__')
    ? (r.e === 'HARD_TIMEOUT' ? `WSL 超时（>${HARD_TIMEOUT_MS / 1000}s）` : `WSL 未正常返回（exit ${r.code}）：${String(r.e || '').slice(0, 200)}`)
    : null;
  return { statuses, fails, wslError };
}

const { statuses, fails, wslError } = await runAll();
const failBy = new Map(fails.map((f) => [f.idx, f.err]));
for (const c of list) c.status = statuses[list.indexOf(c)] || 'blocked';

const failedCombos = list.filter((c) => c.status !== 'ok');
const blind = list.length === 0;
const unresolvedFail = unresolved.length > 0;
const ok = !blind && !unresolvedFail && !wslError && failedCombos.length === 0;

// ── 输出 ────────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({
    opuscar: OPUSCAR,
    wsl: { distro: DISTRO, ffmpeg: FFMPEG, error: wslError },
    scannedFiles: files.length,
    total: list.length,
    unresolved,
    combos: list.map((c) => ({
      args: c.args.join(' '),
      status: c.status,
      err: c.status === 'fail' ? (failBy.get(list.indexOf(c)) || '') : undefined,
      sources: c.sources.map((s) => `${s.file}:${s.line} ${s.label}`),
    })),
    blind,
    ok,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

console.log('check-venc-args —— 编码器参数组合的 ffmpeg 实测闸门');
console.log(`  仓库: ${OPUSCAR}`);
console.log(`  扫描: ${files.length} 个文件（core/render/**、tools/**、styles/*/demo/** 的 .sh/.mjs/.js）`);
console.log(`  ffmpeg: WSL ${DISTRO} 的 ${FFMPEG}（真编 1 帧 320x240 纯色）`);
console.log(`  判据: 每个去重后的参数组合 ffmpeg 退出码 = 0\n`);
console.log(`抽到参数组合（去重后）${list.length} 个：`);
for (const [i, c] of list.entries()) {
  const tag = c.status === 'ok' ? '✓' : (c.status === 'fail' ? '✘' : '?');
  console.log(`  ${tag} [${String(i).padStart(2)}] ${c.args.join(' ')}`);
  for (const s of c.sources) console.log(`        ← ${s.file}:${s.line}  ${s.label}`);
  if (c.status === 'fail') {
    const err = failBy.get(i) || '';
    for (const l of err.split('\n').slice(0, 3)) console.log(`        ✘ ffmpeg: ${l}`);
  }
}
if (unresolved.length) {
  console.log(`\n✘ 无法代入（无法验证）的组合 ${unresolved.length} 个：`);
  for (const u of unresolved) console.log(`  ✘ ${u.file}:${u.line}  ${u.label}  「${String(u.raw).slice(0, 60)}」 —— ${u.why}`);
}
if (wslError) console.log(`\n✘ ${wslError}`);
if (blind) {
  console.log('\n✘✘ 本闸门已**失明**：抽到的编码器参数组合为 0 —— 路径或写法变了，');
  console.log('    「0 处违规」是假的。请先修路径/写法，再信本闸门的结论。');
}
console.log(`\n[闸门] 编码器参数组合可执行：组合 ${list.length} 个、ffmpeg 拒绝 ${failedCombos.length} 个、无法代入 ${unresolved.length} 个${blind ? '、**已失明**' : ''}${wslError ? '、WSL 不可用' : ''} ${ok ? 'OK' : '✘'}`);
process.exit(ok ? 0 : 1);
