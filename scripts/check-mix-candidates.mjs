#!/usr/bin/env node
/**
 * scripts/check-mix-candidates.mjs —— 混音文件的**遮蔽隐患**闸门
 *
 * ★ 由来（2026-10-04，从「存在 ≠ 会被采用」这条教训推广出来的）：
 *   编排器取混音音频的规则是**按候选顺序取第一个存在的**：
 *     `styles/<slug>/demo/mix.wav` → `demo/audio/mix.wav` → `demo/out/mix.wav`
 *   ⇒ 若**靠前的位置留着一份旧的/占位的 mix.wav**，它会**遮蔽**靠后那份真正的混音。
 *
 *   ★ 这不是假想 —— 项目**真实发生过**（`paper-lantern` 的首版缺陷，记在它的
 *     `_distill.json#selfCheck.audioEvidence.firstVersionDefect` 里）：
 *     > 首版出片带 `--skip-audio`；编排器按 `demo/mix.wav → demo/audio/mix.wav → demo/out/mix.wav`
 *     > 取第一个非空者，**一份位于 `demo/mix.wav` 的旧静音占位（23.5 MB，非空）遮住了真正的
 *     > `demo/out/mix.wav`（`mix.py` 落点）** ⇒ 成片成了数字静音（`I = −70 LUFS`）。
 *
 * 判据（对每个风格）：
 *   ① 若**多个候选同时存在** ⇒ 必须**逐字节相同**（md5 一致）。
 *      不同 ⇒ **FAIL**：编排器会挑靠前那份，而音频链可能刚写的是靠后那份 ⇒ 遮蔽。
 *   ② 被挑中的那份**不能是静音/占位**（`volumedetect` 的 `mean_volume` ≤ −70 dB 或读不到 ⇒ FAIL）。
 *   ③ 顺带列出「一个都没有」的风格（不判 FAIL —— 那只是意味着要重跑音频链）。
 *
 * 用法：node scripts/check-mix-candidates.mjs
 * 退出码：有遮蔽 / 静音占位 → 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

// ★ 覆盖点（供非破坏变异验证）：与 `check-aspect-declaration.mjs:56` / `check-dub-styles.mjs:46` 的 `LEMO_STYLES_ROOT` 同名同义。
const STYLES = process.env.LEMO_STYLES_ROOT || 'D:/lemo-opuscar/styles';
const FF = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const CANDS = ['demo/mix.wav', 'demo/audio/mix.wav', 'demo/out/mix.wav'];
const SILENT_DB = -70;

const run = (args) =>
  new Promise((res) => {
    const p = spawn(FF, args);
    let e = '';
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res(String(err.message)));
    p.on('close', () => res(e));
  });

const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

async function meanVolume(f) {
  const e = await run(['-hide_banner', '-nostats', '-i', f, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = e.match(/mean_volume:\s*(-?[\d.]+|-inf)\s*dB/);
  if (!m) return null;
  return m[1] === '-inf' ? -Infinity : Number(m[1]);
}

// ── ★ 失明守卫（防空转绿灯）────────────────────────────────────────────────
//   判据：`styles/` **读不到 / 扫到 0 个风格** ⇒ 一个候选混音都没检查过 ⇒ 判 FAIL 并明说
//   「本闸门已失明」。否则 `fails` 为空会打印「所有多候选的混音都逐字节相同」—— 那是**假的**。
//   （写法照 `check-loudness-targets.mjs:64-79` / `check-config-vs-doc.mjs:108-116` 的同型守卫。）
const blind = [];
let slugs = [];
try {
  slugs = fs.readdirSync(STYLES, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name).sort();
} catch (e) {
  blind.push(`\`${STYLES}\` 读不到（${(e && e.message) || e}）⇒ 一个混音候选都没检查过`);
}
if (!blind.length && slugs.length === 0) blind.push(`\`${STYLES}\` 下扫到 0 个风格目录（路径 / 过滤变了？）⇒ 一个混音候选都没检查过`);

const fails = [];
const multi = [];
const none = [];

for (const slug of slugs) {
  const present = CANDS.map((c) => ({ c, f: path.join(STYLES, slug, c) })).filter((x) => fs.existsSync(x.f));
  if (!present.length) { none.push(slug); continue; }
  const picked = present[0];

  // ① 多候选 ⇒ 必须逐字节相同
  if (present.length > 1) {
    const hashes = present.map((x) => ({ ...x, h: md5(x.f) }));
    const uniq = new Set(hashes.map((x) => x.h));
    multi.push({ slug, files: present.map((x) => x.c), same: uniq.size === 1 });
    if (uniq.size !== 1) {
      fails.push(`${slug}：${present.length} 个候选**内容不同**（编排器会挑 \`${picked.c}\`，遮蔽靠后那份）—— ` +
        hashes.map((x) => `${x.c}=${x.h.slice(0, 8)}`).join(' / '));
    }
  }

  // ② 被挑中的不能是静音/占位
  const mv = await meanVolume(picked.f);
  if (mv === null) fails.push(`${slug}：被挑中的 \`${picked.c}\` 读不到音量（文件损坏？）`);
  else if (mv <= SILENT_DB) fails.push(`${slug}：被挑中的 \`${picked.c}\` 是**静音/占位**（mean ${mv} dB ≤ ${SILENT_DB}）—— 正是 paper-lantern 首版那类事故`);
}

console.log(`风格 ${slugs.length} 个；有候选混音的 ${slugs.length - none.length} 个；**多候选的 ${multi.length} 个**`);
if (multi.length) {
  console.log('\n多候选（靠前的会遮蔽靠后的）：');
  for (const m of multi) console.log(`  ${m.same ? '✓' : '✘'} ${m.slug.padEnd(20)} ${m.files.join('  ')}${m.same ? '（内容相同）' : '（**内容不同**）'}`);
}
if (none.length) console.log(`\nℹ 一个候选都没有的 ${none.length} 个（不判 FAIL —— 意味着会重跑音频链）：${none.join(', ')}`);

if (fails.length) {
  console.log(`\n✘ ${fails.length} 处遮蔽隐患：`);
  for (const f of fails) console.log(`  ✘ ${f}`);
  console.log('\n修法：把靠后的那份（真正被音频链写入的）复制到靠前的位置，让候选顺序不再改变结果。');
} else if (!blind.length) {
  console.log('\n✓ 所有多候选的混音都逐字节相同，且被挑中的不是静音。');
}

if (blind.length) {
  console.log(`\n✘ 本闸门已失明：`);
  for (const b of blind) console.log(`  ✘ ${b}`);
}

console.log(`\n[闸门] 遮蔽隐患 ${fails.length} 处${blind.length ? '、**已失明**' : ''} ${(fails.length || blind.length) ? '✘' : 'OK'}；多候选 ${multi.length} 个`);
process.exitCode = (fails.length || blind.length) ? 1 : 0;
