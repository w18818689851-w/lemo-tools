#!/usr/bin/env node
/**
 * scripts/measure-truepeak.mjs —— 实测 43 部成片的**真峰值 / 响度 / LRA**
 *
 * ★ 口径（与 lib/dub-core.mjs#measure 一致，别再退回 astats）：
 *   ffmpeg -af loudnorm=...:print_format=json 的 **`input_tp`** 才是 4× 过采样真峰值（dBTP）。
 *   · `astats` 的 `Peak level dB` 是**采样峰值**，与真峰值实测差最大 1.62 dB —— 不能用；
 *   · `ebur128` 的 `Peak:` 只印 1 位小数（-1.17 会印成 -1.2）—— 判边界会误判。
 *   ★ 注意 loudnorm 输出的数值是**带引号的字符串**（`"input_tp" : "-2.86"`），
 *     正则必须允许两侧引号，否则会静默解析失败、把「测出来了」误报成「测量失败」。
 *
 * 用法：node scripts/measure-truepeak.mjs [--json] [--limit N] [--check]
 *   --check：**交付闸门**模式 —— 任一成片真峰值 > −1.2 dBTP 即退出码 1（并把超标的列出来）。
 *            这是「成片是否达标」的唯一机械判据；`--check` 之外只做测量、恒退出 0。
 * 退出码：`--check` 下有超标 → 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = 'D:/lemo-tools';
const DIR = path.join(ROOT, 'lib', 'style-skills');
const FF = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const ARGV = process.argv.slice(2);
const AS_JSON = ARGV.includes('--json');
const CHECK = ARGV.includes('--check');
const limitIdx = ARGV.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number(ARGV[limitIdx + 1]) : Infinity;

// 判合规的口径：真峰值不得高于 -1.2 dBTP（留 0.5 dB 余量给有损编码）
const TP_LIMIT = -1.2;

const run = (args) =>
  new Promise((res) => {
    const p = spawn(FF, args);
    let e = '';
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res({ c: -1, e: `SPAWN ERROR: ${err.message}` }));
    p.on('close', (c) => res({ c, e }));
  });

// loudnorm JSON 的值是**带引号字符串** ⇒ 两侧引号都要允许
const num = (txt, key) => {
  const m = txt.match(new RegExp(`"${key}"\\s*:\\s*"?(-?[0-9.]+)"?`));
  return m ? Number(m[1]) : null;
};

const slugs = fs
  .readdirSync(DIR)
  .filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json')))
  .sort();

const rows = [];
for (const slug of slugs) {
  if (rows.length >= LIMIT) break;
  const d = JSON.parse(fs.readFileSync(path.join(DIR, slug, '_distill.json'), 'utf8'));
  const f = (d.generatedVideo || {}).path;
  if (!f || !fs.existsSync(f)) {
    rows.push({ slug, tp: null, why: '成片缺失' });
    continue;
  }
  const { c, e } = await run([
    '-hide_banner', '-nostats', '-i', f,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
    '-f', 'null', '-',
  ]);
  const tp = num(e, 'input_tp');
  rows.push({
    slug,
    tp,
    lufs: num(e, 'input_i'),
    lra: num(e, 'input_lra'),
    why: tp === null ? `解析失败(exit ${c})` : null,
  });
}

rows.sort((a, b) => (b.tp ?? -99) - (a.tp ?? -99));

if (AS_JSON) {
  console.log(JSON.stringify({ tpLimit: TP_LIMIT, rows }, null, 2));
} else {
  console.log('slug'.padEnd(22), 'truePeak'.padStart(9), 'LUFS'.padStart(8), 'LRA'.padStart(7), '  判定');
  for (const r of rows) {
    const flag = r.tp === null ? `✘${r.why}` : r.tp > TP_LIMIT ? '✘超标' : 'ok';
    console.log(
      r.slug.padEnd(22),
      String(r.tp ?? '-').padStart(9),
      String(r.lufs ?? '-').padStart(8),
      String(r.lra ?? '-').padStart(7),
      '  ' + flag
    );
  }
  const bad = rows.filter((r) => r.tp !== null && r.tp > TP_LIMIT).length;
  const miss = rows.filter((r) => r.tp === null).length;
  console.log(`\n超标(>${TP_LIMIT} dBTP)：${bad}/${rows.length}；测量失败：${miss}`);
  if (CHECK) {
    if (bad || miss) {
      console.log(`\n✘ 交付闸门未通过：${bad} 部超标${miss ? `、${miss} 部测量失败` : ''}`);
      for (const r of rows) if (r.tp === null || r.tp > TP_LIMIT) console.log(`   ✘ ${r.slug.padEnd(20)} ${r.tp ?? r.why}`);
    } else {
      console.log(`\n✓ 交付闸门通过：43 部成片真峰值全部 ≤ ${TP_LIMIT} dBTP`);
    }
  }
}

process.exitCode = CHECK && rows.some((r) => r.tp === null || r.tp > TP_LIMIT) ? 1 : 0;
