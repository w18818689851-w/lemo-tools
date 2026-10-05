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
 *   判据：`okEb + looksLn + neither === 0`（0 部成片被检查）⇒ 判 FAIL 并明说「失明」。
 *
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

const slugs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort();

let okEb = 0, looksLn = 0, neither = 0;
let blind = 0;
const bad = [];

for (const s of slugs) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, s, '_distill.json'), 'utf8'));
  const f = d.generatedVideo && d.generatedVideo.path;
  const doc = d.selfCheck && d.selfCheck.loudness && d.selfCheck.loudness.lra;
  if (!f || !fs.existsSync(f) || !Number.isFinite(doc)) continue;
  const a = await lraEb(f), b = await lraLn(f);
  if (a !== null && Math.abs(doc - a) <= TOL) okEb++;
  else if (b !== null && Math.abs(doc - b) <= TOL) { looksLn++; bad.push({ s, doc, a, b, why: '口径疑似 loudnorm（项目口径应为 ebur128）' }); }
  else { neither++; bad.push({ s, doc, a, b, why: '与两个口径都不符（成片可能被改过而文档没跟）' }); }
}

// ★ 失明守卫：0 部成片被检查 ⇒ 闸门的「口径统一」结论是假的 ⇒ FAIL
if (okEb + looksLn + neither === 0) blind = 1;

console.log(`json 的 lra 口径：像 ebur128 ${okEb} 份；像 loudnorm ${looksLn} 份；都不像 ${neither} 份`);
if (blind) {
  console.log(`\n✘ 失明：0 部成片被检查（\`generatedVideo.path\` 都读不到 / 成片被删？）⇒ 本闸门什么都没检查`);
}
if (bad.length) {
  console.log('');
  for (const x of bad) console.log(`  ✘ ${x.s.padEnd(20)} 文档 ${String(x.doc).padStart(5)} / ebur128 ${String(x.a).padStart(5)} / loudnorm ${String(x.b).padStart(5)}  ← ${x.why}`);
  console.log('\n修法：node scripts/normalize-skill-schema.mjs --force-lra   （把 lra 统一改成实测 ebur128）');
}
console.log(`\n[闸门] LRA 口径统一 ${okEb}/${okEb + looksLn + neither} ${looksLn + neither || blind ? '✘' : 'OK'}`);
process.exitCode = looksLn + neither || blind ? 1 : 0;
