#!/usr/bin/env node
/**
 * scripts/check-mux-selection.mjs —— **交付路径感知**的混流脚本闸门
 *
 * ★ 由来（2026-10-04 的重要发现）：
 *   编排器选混流脚本的规则是（`lemo-make.mjs` 的 shell 段）：
 *     ```
 *     MUX=core/render/mux.sh
 *     for c in "$D/tools/mux.sh" "$D/mux.sh"; do
 *       [ -f "$c" ] || continue
 *       if grep -qF 'A="$2"' "$c"; then MUX="$c"; break; fi     # ← 必须是标准 V A O [fps] [grain] 接口
 *       echo "  ! 该 demo 自带 $c，但接口不是 V A O [fps] [grain]，回退 core/render/mux.sh"
 *     done
 *     ```
 *   ⇒ **`styles/<slug>/demo/mux.sh` 存在 ≠ 会被采用**！实测 13 个自带脚本里
 *     **只有 9 个**满足 `A="$2"`（8 个 `demo/tools/mux.sh` + `woodcut`），
 *     另 4 个（`game-show/finish.sh`、`paper-popup/mux.sh`、`pictogram-motion/mux.sh`、`watercolor/mux.sh`）
 *     **只用于手工构建**，编排器一律回退 `core/render/mux.sh`。
 *   ⇒ 此前 `check-shell-structure.mjs` **无差别扫全部 .sh**，分不清「在交付路径上」与「只是仓库里的脚本」。
 *     本闸门按**编排器真实的挑选规则**算出「每个风格实际会跑哪个脚本」，再只对**被挑中的**做口径校验。
 *
 * 判据（对**被挑中的**脚本）：
 *   ① `LN_TP` 可被 `LEMO_LN_TP` 覆盖（否则调余量的实验是空操作 —— 踩过）
 *   ② 有**真峰值复核**块（用 `loudnorm` 的 `input_tp` 判 −1.2，而不是只看 `astats` 采样峰值）
 *   ③ 结尾有 `exit 0`（否则判定块的 `if…fi` 会让退出码与判定结果**相反**）
 *   ④ 不存在「`\` 续行后紧跟 `#` 注释」（注释会吃掉续行、命令被截断）
 *
 * 用法：node scripts/check-mux-selection.mjs
 * 退出码：被挑中的脚本有缺项 → 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';

const OPUSCAR = 'D:/lemo-opuscar';
const STYLES = path.join(OPUSCAR, 'styles');
const CORE = path.join(OPUSCAR, 'core', 'render', 'mux.sh');

/** 复刻编排器的挑选规则 */
function pickMux(slug) {
  const d = path.join(STYLES, slug, 'demo');
  for (const c of [path.join(d, 'tools', 'mux.sh'), path.join(d, 'mux.sh')]) {
    if (!fs.existsSync(c)) continue;
    const txt = fs.readFileSync(c, 'utf8');
    if (txt.includes('A="$2"')) return { file: c, own: true };
    return { file: CORE, own: false, skipped: c };   // 找到但接口不符 ⇒ 回退 core（不再往后找）
  }
  return { file: CORE, own: false };
}

const slugs = fs.readdirSync(STYLES, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name)
  .sort();

const fails = [];
const rows = [];

const hasLnTp = (t) => /LEMO_LN_TP/.test(t);
const hasVerdict = (t) => /input_tp/.test(t) && /-1\.2/.test(t);
const hasExit0 = (t) => /^\s*exit\s+0\s*$/m.test(t);
/** ★ 委托检测（2026-10-04 加，修一处误报）：若脚本**真的调用** core/render/mux.sh，
 *  它就继承了 core 的口径（LN_TP 可覆盖 + 真峰值复核 + exit 0），自己只做二次编码 ⇒ 不必自带这三项。
 *  实测 `woodcut/demo/tools/mux.sh:8` 是 `sh "$R/core/render/mux.sh" "$V" "$A" "$TMP" "$FPS" "$GR"`。
 *  ★ 判据必须**只看非注释行** —— 第一次我用了 `find`（取第一处匹配），而第一处是**注释**
 *    （`# 成片合成（本片版）：先走 core/render/mux.sh …`）⇒ 委托检测恒为 false，误报没修掉。 */
const delegatesToCore = (t) =>
  t.split('\n').some((l) => /core\/render\/mux\.sh/.test(l) && !/^\s*#/.test(l));
const hasBadCont = (t) => {
  const L = t.split('\n');
  for (let i = 0; i < L.length - 1; i++) if (/\\\s*$/.test(L[i]) && /^\s*#/.test(L[i + 1])) return i + 1;
  return 0;
};

for (const slug of slugs) {
  const p = pickMux(slug);
  const t = fs.readFileSync(p.file, 'utf8');
  const deleg = delegatesToCore(t);
  const bad = [];
  if (!deleg) {
    if (!hasLnTp(t)) bad.push('LN_TP 不可覆盖');
    if (!hasVerdict(t)) bad.push('缺真峰值复核');
    if (!hasExit0(t)) bad.push('缺 exit 0');
  }
  const bc = hasBadCont(t);
  if (bc) bad.push(`L${bc} 续行被注释吃掉`);
  rows.push({ slug, picked: path.relative(OPUSCAR, p.file).replace(/\\/g, '/'), own: p.own, deleg, skipped: p.skipped ? path.relative(OPUSCAR, p.skipped).replace(/\\/g, '/') : null, bad });
  if (bad.length) fails.push(`${slug}（跑 ${path.basename(p.file)}）：${bad.join('、')}`);
}

const own = rows.filter((r) => r.own);
console.log(`风格 ${rows.length} 个；**走自带 mux 的 ${own.length} 个**，走 core 的 ${rows.length - own.length} 个`);
console.log('\n走自带 mux 的：');
for (const r of own) console.log(`  · ${r.slug.padEnd(20)} ${r.picked}${r.deleg ? "   ✓（委托 core）" : r.bad.length ? "   ✘ " + r.bad.join("、") : "   ✓"}`);
const fell = rows.filter((r) => !r.own && r.skipped);
console.log(`\n自带脚本存在但**接口不符 ⇒ 回退 core**（这些脚本只用于手工构建）：${fell.length} 个`);
for (const r of fell) console.log(`  · ${r.slug.padEnd(20)} ${r.skipped}`);

if (fails.length) {
  console.log(`\n✘ 被挑中的脚本有 ${fails.length} 个缺项：`);
  for (const f of fails) console.log(`  ✘ ${f}`);
} else {
  console.log('\n✓ 所有「被编排器挑中」的混流脚本都满足四项口径要求。');
}

console.log(`\n[闸门] 被挑中脚本缺项 ${fails.length} 个 ${fails.length ? '✘' : 'OK'}；走自带 mux ${own.length}/${rows.length}`);
process.exitCode = fails.length ? 1 : 0;
