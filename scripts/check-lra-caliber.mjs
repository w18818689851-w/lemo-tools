#!/usr/bin/env node
/**
 * scripts/check-lra-caliber.mjs —— 43 份 json 的 `selfCheck.loudness.lra` 是不是**统一口径**
 *
 * ★ 为什么需要它（2026-10-03 实踩）：
 *   项目 LRA 口径 = **`ebur128`**（`loudnorm` 的 `input_lra` 系统性偏大，实测同一片 6.0 vs 8.20）。
 *   但 json 里的 `lra` 值来自两个不同来源：早期从出片日志抄的（ebur128）、
 *   以及 `sync-film-caliber.mjs` 回填时用的（`loudnorm`）⇒ **同一字段两种口径**。
 *   更麻烦的是 `fix-truepeak.mjs` 的音频重混**会真的改变 LRA**（压限收窄动态），
 *   实测 `shadow-puppet` 由 9.1 变成 7.1 —— 于是「旧值 + 新片」也成了不一致。
 *
 * 判据：每份 json 的 `lra` 必须与**实测 ebur128 LRA** 相符（容差 0.6 LU）。
 *   对不上就报出来（可能口径不同、也可能是成片被改过而文档没跟）。
 *
 * ★ 失明守卫（2026-10-04 补）：成片全读不到时（`generatedVideo.path` 都无效 / 成片被删），
 *   循环里每个风格都 `continue` ⇒ okEb+looksLn+neither = 0 ⇒ 静默绿。
 *   判据：`checked === 0`（= `okEb + looksLn + neither === 0`，0 部成片被检查）⇒ 判 FAIL 并明说「失明」。
 *   ★★ 2026-10-11 修（F2：**分母会缩水** + **跳过是静默的**）⇒ 三条加强 + 一条「部分覆盖」守卫；完整口径与实测见下方 `★★ 跳过登记（2026-10-11 修，F2）` 段（**刻意不写进头注释**：本文件第 45 行被 `scripts/check-selfcheck-claims.mjs:70` 等**行号引用**锚定，头注释一加行就顶漂）。
 * 用法：node scripts/check-lra-caliber.mjs
 * 退出码：有不符（或失明）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DIR = 'D:/lemo-tools/lib/style-skills';
const FF = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const TOL = 0.6;

const run = (args) =>
  new Promise((res) => {
    const p = spawn(FF, args);
    let e = '';
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res(String(err.message)));
    p.on('close', () => res(e));
  });

const lraEb = async (f) => {
  const e = await run(['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const m = [...e.matchAll(/^\s*LRA:\s*(-?[\d.]+)/gm)];
  return m.length ? Number(m[m.length - 1][1]) : null;
};
const lraLn = async (f) => {
  const e = await run(['-hide_banner', '-nostats', '-i', f, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
  const m = e.match(/"input_lra"\s*:\s*"?(-?[\d.]+)"?/);
  return m ? Number(m[1]) : null;
};

// ══════════════════════════════════════════════════════════════════════════════
// ★★ 跳过登记（2026-10-11 修，F2：**分母会缩水** + **跳过是静默的**）
//   ★ 为什么这段**不写在头注释里**：本文件**第 45 行**（`lraLn` 里那条 loudnorm 探测命令）被
//     `scripts/check-selfcheck-claims.mjs:70` / `test/gate-blindness.test.mjs:1354` 等按**行号**引用
//     （`check-ref-lines.mjs` 判据 (d) 会核「被引行有没有内容」）⇒ 头注释**加一行就会把它们顶漂**
//     （实测：加完当场 `引用失效 1 处（d 1）`）。故本段放在**第 45 行之后**。
//   ★ 旧实现 `if (!f || !fs.existsSync(f) || !Number.isFinite(doc)) continue;` 把两类东西
//     **混在同一个 `continue` 里静默吞掉** —— (a) 成片读不到；(b) `selfCheck.loudness.lra`
//     **缺失 / 不是有限数**；而末行分母用的是 `okEb + looksLn + neither`（= **已检查数**，
//     不是**应有数**）⇒ 枚举到 N 份、只检查了 1 份也照样打 `1/1 OK` + exit 0。
//     实测（审计夹具 `D:/lemo-tmp/lemo-fix/h2`：2 个风格都指向同一段真音频，其一**删掉**
//     `selfCheck.loudness.lra`）：改前 `1/1 OK` + **exit 0**（假绿，被跳过的那份一个字都没提）。
//   ★ 现在的口径（三条，都是**加强** —— 没有放宽任何阈值 / 容差）：
//     ① **分母 = 应有数** `slugs.length`（不再用已检查数）—— 末行打 `${checked}/${slugs.length}`，
//        覆盖面一缩水就**当场看得见**（不再出现 `1/1 OK`）；
//     ② **跳过必须显式**：成片不可达的**逐条点名 + 给原因**（`generatedVideo.path` 缺失 / 文件不在）；
//     ③ **成片可读、却无可核的 `lra` ⇒ FAIL 并点名** —— 那不是「这份没法查」，而是「这份**该有**却没有」，
//        正是 `sync-film-caliber.mjs` 回填丢字段 / 口径没写的形态（与同族
//        `check-loudness-targets.mjs` 对「解析不出目标值」的 `miss.push(slug)` ⇒ FAIL **同口径**）。
//   ★ 另加**部分覆盖守卫**：`checked > 0 && skipped > 0`（有的查了、有的没查）⇒ FAIL ——
//     这正是旧版「分母缩水到看不出」的病灶本身。★ 边界：`checked === 0`（**一份都没查**）不由本条负责，
//     仍由既有失明守卫（0 部成片被检查）判 FAIL —— 两条互斥、不重叠。
//   ★ 实测（2026-10-11 真实语料）：43 份**全部**可检查（`unreachable 0 / badLra 0`）⇒
//     末行 `43/43 OK`、exit 0（与改动前**一致**）。
// ══════════════════════════════════════════════════════════════════════════════

const slugs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort();

let okEb = 0, looksLn = 0, neither = 0;
let blind = 0;
const bad = [];
// ★ 2026-10-11（F2 修）：**跳过不再静默**。两类分开记 —— 见上方「跳过登记」段。
const unreachable = [];   // (a) 成片不可达（`generatedVideo.path` 缺 / 文件不在）⇒ 无法核 lra
const badLra = [];        // (b) 成片**可读**、却无可核的 `lra` ⇒ 真缺陷 ⇒ FAIL 并点名

for (const s of slugs) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, s, '_distill.json'), 'utf8'));
  const f = d.generatedVideo && d.generatedVideo.path;
  const doc = d.selfCheck && d.selfCheck.loudness && d.selfCheck.loudness.lra;
  if (!f) { unreachable.push({ s, why: '`generatedVideo.path` 缺失' }); continue; }
  if (!fs.existsSync(f)) { unreachable.push({ s, why: `成片读不到（${f}）` }); continue; }
  // ★ 成片**可读** ⇒ 这一份**必须**有可核的 lra；缺了就是「回填丢字段」的真缺陷 ⇒ 不再静默跳过。
  if (!Number.isFinite(doc)) { badLra.push({ s, f, got: doc }); continue; }
  const a = await lraEb(f), b = await lraLn(f);
  if (a !== null && Math.abs(doc - a) <= TOL) okEb++;
  else if (b !== null && Math.abs(doc - b) <= TOL) { looksLn++; bad.push({ s, doc, a, b, why: '口径疑似 loudnorm（项目口径应为 ebur128）' }); }
  else { neither++; bad.push({ s, doc, a, b, why: '与两个口径都不符（成片可能被改过而文档没跟）' }); }
}

const checked = okEb + looksLn + neither;              // 真被核过的份数
const skipped = unreachable.length + badLra.length;    // 没被核过的份数（两类，逐条点名）

// ★ 失明守卫：0 部成片被检查 ⇒ 闸门的「口径统一」结论是假的 ⇒ FAIL
if (checked === 0) blind = 1;
// ★ 部分覆盖守卫（2026-10-11 F2 修）：有的查了、有的没查 ⇒ 覆盖面静默缩水 ⇒ FAIL。
//   （`checked === 0` 由上面的失明守卫负责 ⇒ 两条互斥、不重叠。）
const partial = checked > 0 && skipped > 0 ? 1 : 0;

console.log(`json 的 lra 口径：像 ebur128 ${okEb} 份；像 loudnorm ${looksLn} 份；都不像 ${neither} 份（应有 ${slugs.length} 份）`);
if (blind) {
  console.log(`\n✘ 失明：0 部成片被检查（\`generatedVideo.path\` 都读不到 / 成片被删？）⇒ 本闸门什么都没检查`);
}
if (badLra.length) {
  console.log(`\n✘ 成片**可读**、却**没有**可核的 \`selfCheck.loudness.lra\`：${badLra.length} 份（回填丢字段？口径没写？）`);
  for (const x of badLra) console.log(`  ✘ ${x.s.padEnd(20)} 成片在（${x.f}），文档 lra = ${JSON.stringify(x.got)}`);
}
if (unreachable.length) {
  console.log(`\nℹ 跳过 ${unreachable.length}/${slugs.length} 份（成片不可达 ⇒ 本闸门对它们**什么都没核**）：`);
  for (const x of unreachable) console.log(`  ℹ ${x.s.padEnd(20)} ${x.why}`);
}
if (bad.length) {
  console.log('');
  for (const x of bad) console.log(`  ✘ ${x.s.padEnd(20)} 文档 ${String(x.doc).padStart(5)} / ebur128 ${String(x.a).padStart(5)} / loudnorm ${String(x.b).padStart(5)}  ← ${x.why}`);
  console.log('\n修法：node scripts/normalize-skill-schema.mjs --force-lra   （把 lra 统一改成实测 ebur128）');
}
console.log(`\n[闸门] LRA 口径统一 ${checked}/${slugs.length} ${looksLn + neither || blind || partial || badLra.length ? '✘' : 'OK'}`);
process.exitCode = looksLn + neither || blind || partial || badLra.length ? 1 : 0;
