#!/usr/bin/env node
/**
 * scripts/fix-truepeak.mjs —— 把**已成片**的真峰值修进交付口径（真峰值 ≤ −1.5 dBTP）
 *
 * ★ 本工具做两件事，都只动**音频侧**、**绝不重渲**（视频流逐字节不变）：
 *   ① **修峰值**：真峰值 > −1.2 dBTP 的成片 ⇒ 音频重混（`alimiter`）压到 ≤ −1.5 dBTP；
 *   ② **对账元数据**：把 `selfCheck.loudness` 的 `truePeakDbtp` / `integratedLufs` / `lra` /
 *      **`samplePeakDbfs`** 按**实测**回写。
 *
 * ★★ 为什么必须回写 `samplePeakDbfs`（本工具的**历史缺口**）：
 *   早期版本只回写前三个字段，**不回写 `samplePeakDbfs`（`astats` 采样峰值）**
 *   ⇒ 被重混过的成片，json 里该字段停在**重混前**的旧值 —— 旧值甚至 **> 同片 `truePeakDbtp`**，
 *   而「采样峰值恒 ≤ 真峰值」是硬物理约束（真峰值是过采样后的峰值，不可能更低）
 *   ⇒ json 记录了一个**物理不可能**的状态。实测中招 5 片：
 *   `risograph` / `blueprint` / `dataviz` / `microgame` / `papercut-red`。
 *   现在两个值来自**同一次 ffmpeg 测量**（`astats,loudnorm` 串联），结构上不可能再对不上。
 *   ★ 对**已达标**的成片，② 是**纯元数据对账**：只改 json、**成片一个字节都不动**
 *     （不为修一个文档字段去动合规音频），且**只在内容真变时落盘**（无 mtime 噪声）。
 *
 * ★ 采样峰值 vs 真峰值的**精度陷阱**（写 `samplePeakDbfs` 的口径）：
 *   `astats` 的 `Peak level dB` 是**采样峰值**，恒 ≤ 真峰值。但 json 的 `truePeakDbtp` 只存
 *   **2 位小数**（`loudnorm` 口径），而 `astats` 给 **6 位** ⇒ 真峰值被**向下**舍入时，
 *   6 位的采样峰值会**看起来**比它高（实测 `risograph`：采样 −3.106276 vs 真峰值 −3.11，
 *   差 0.0037 —— 纯精度伪影，物理上并不违反）⇒ 落盘时把采样峰值**夹到真峰值以内**，
 *   保证 `samplePeakDbfs ≤ truePeakDbtp` 在 json 里**恒成立**。
 *
 * ★ 为什么需要「编码 → 测量 → 重试」而不是固定参数：
 *   AAC 编码会把 PCM 的**采样峰值**抬高成更高的**真峰值**（inter-sample peak）。
 *   实测（43 部成片，loudnorm 4× 过采样 input_tp）：过冲最高到 **+1.73 dBTP**。
 *   而 **alimiter 的上限与最终真峰值不是单调关系** —— 实测 papercut-red @256k：
 *      limit −2.5 → −0.94 ；−3.0 → −1.69 ；−3.5 → **−0.88（反而更差）** ；−4.0 → −2.29
 *   原因：压得越狠，波形越「平顶」，编码器的量化噪声分布随之变化，过冲不降反升。
 *   ⇒ 任何「算一个固定上限就完事」的做法都会在某些素材上**静默失败**。
 *   唯一可靠路径：**候选上限阶梯逐个编码、实测、取第一个达标的**。
 *
 * ★ 为什么不重渲染：重渲染要 GPU 跑 18 部（十几分钟）且会改变成片字节；
 *   而本问题是**纯音频**问题 —— `-c:v copy` 让视频流**逐字节不变**，只重编码音轨，
 *   代价仅一次 AAC 代际（纯压峰、无其它处理，256k 下可忽略），远优于重渲染。
 *
 * ★ 安全：改前把原片备份到 `--backup-dir`（默认 D:/lemo-films/_tpfix-backup/），
 *   并**逐字节校验视频流 md5 未变**、时长未变；任一不符即回滚并报错。
 *
 * 用法：
 *   node scripts/fix-truepeak.mjs                 # 干跑：只测量并列出需要修的 / 待对账的
 *   node scripts/fix-truepeak.mjs --apply         # 真正修复 + 元数据对账
 *   node scripts/fix-truepeak.mjs --apply --only papercut-red,backrooms
 *   node scripts/fix-truepeak.mjs --apply --abr 320k
 *   node scripts/fix-truepeak.mjs --restore       # 从备份还原全部
 *
 * 退出码：有修不好的 → 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = 'D:/lemo-tools';
const DIR = path.join(ROOT, 'lib', 'style-skills');
const FF = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const FFPROBE = FF.replace(/ffmpeg\.exe$/, 'ffprobe.exe');

const ARGV = process.argv.slice(2);
const APPLY = ARGV.includes('--apply');
const RESTORE = ARGV.includes('--restore');
const onlyIdx = ARGV.indexOf('--only');
const ONLY = onlyIdx >= 0 ? new Set(ARGV[onlyIdx + 1].split(',').map((s) => s.trim())) : null;
const abrIdx = ARGV.indexOf('--abr');
const ABR = abrIdx >= 0 ? ARGV[abrIdx + 1] : '256k';
const bakIdx = ARGV.indexOf('--backup-dir');
const BAK = bakIdx >= 0 ? ARGV[bakIdx + 1] : 'D:/lemo-films/_tpfix-backup';

// 交付口径：真峰值不高于 −1.2 dBTP。
//   · **已达标的（≤ TP_SPEC）一律不动** —— 对合规音频施压限是无谓的质量损失；
//   · **违反口径的（> TP_SPEC）修到 ≤ TP_TARGET**，留 0.3 dB 余量吸收「改完再测」的波动。
const TP_SPEC = -1.2;
const TP_TARGET = -1.5;
// alimiter 候选上限阶梯（dB，**从高到低**：取第一个达标的 = 压制最轻的）
const LADDER = [-2.5, -3.0, -3.5, -4.0, -4.5, -5.0, -5.5, -6.0];

const run = (bin, args) =>
  new Promise((res) => {
    const p = spawn(bin, args);
    let o = '', e = '';
    p.stdout.on('data', (d) => (o += d));
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res({ c: -1, o, e: `SPAWN ERROR: ${err.message}` }));
    p.on('close', (c) => res({ c, o, e }));
  });

// loudnorm 的值是**带引号字符串**（`"input_tp" : "-2.86"`）⇒ 两侧引号都要允许
const num = (txt, key) => {
  const m = txt.match(new RegExp(`"${key}"\\s*:\\s*"?(-?[0-9.]+)"?`));
  return m ? Number(m[1]) : null;
};

/**
 * 量一部成片的真峰值 / 响度 / LRA（4× 过采样真值口径）+ **采样峰值**（`astats`）。
 * ★ `astats` 与 `loudnorm` **串在同一次解码**里（`astats` 是直通分析器、不改样本）——
 *   实测 43 部的 `input_tp` 与「只跑 loudnorm」逐片一致 ⇒ 不牺牲真峰值口径、也不多跑一遍。
 */
async function measure(file) {
  const { e } = await run(FF, [
    '-hide_banner', '-nostats', '-i', file,
    '-af', 'astats=measure_perchannel=none:measure_overall=Peak_level,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
    '-f', 'null', '-',
  ]);
  return {
    tp: num(e, 'input_tp'),
    lufs: num(e, 'input_i'),
    lra: num(e, 'input_lra'),
    sp: samplePeak(e),
  };
}

/**
 * `astats` Overall 的「Peak level dB」（6 位小数）—— **采样峰值**，真峰值的**下界**。
 * 纯静音会印 `-inf` ⇒ 返回 null（该片就不写这个字段，别把 `-Infinity` 塞进 json）。
 */
function samplePeak(txt) {
  const m = txt.match(/Peak level dB:\s*(-?[0-9.]+|-inf)/);
  if (!m || m[1] === '-inf') return null;
  return Number(m[1]);
}

/**
 * 把采样峰值夹进真峰值以内（`truePeakDbtp` 只存 2 位小数，见头注释的「精度陷阱」）。
 * 只在**真峰值被向下舍入**导致采样峰值看起来更高时才生效；其余情况原样保留 6 位精度。
 */
const clampSp = (sp, tp) => (sp !== null && tp !== null && sp > tp ? tp : sp);

const fmtNum = (v) => (typeof v === 'number' ? String(v) : '—');

/**
 * 回写 `selfCheck.loudness.samplePeakDbfs`（**纯元数据，不碰成片**）。
 * ★ 只在**内容真变**时落盘（避免 mtime 噪声）；`--dry`（默认）下只报告、不写。
 */
function syncSamplePeak(doc, docPath, sp, tp) {
  const L = doc.selfCheck && doc.selfCheck.loudness;
  if (!L) return { wrote: false };
  const target = clampSp(sp, tp);
  if (target === null) return { wrote: false }; // astats 没测到（静音 / 解析失败）
  const cur = L.samplePeakDbfs;
  if (typeof cur === 'number' && Math.abs(cur - target) < 1e-6) return { wrote: false };
  if (!APPLY) return { wrote: false, plan: `samplePeakDbfs ${fmtNum(cur)} → ${target}` };
  L.samplePeakDbfs = target;
  fs.writeFileSync(docPath, JSON.stringify(doc, null, 2) + '\n');
  return { wrote: true, from: cur, to: target };
}

/** 视频流的 md5（用于证明 `-c:v copy` 确实逐字节没动） */
async function videoMd5(file) {
  const { o } = await run(FF, ['-hide_banner', '-nostats', '-loglevel', 'error', '-i', file, '-map', '0:v:0', '-f', 'md5', '-']);
  return (o.match(/MD5=([0-9a-f]+)/i) || [, '?'])[1];
}

async function duration(file) {
  const { o } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(o.trim());
}

async function videoFrames(file) {
  const { o } = await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]);
  return Number(o.trim());
}

const slugs = fs
  .readdirSync(DIR)
  .filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json')))
  .sort()
  .filter((s) => !ONLY || ONLY.has(s));

if (RESTORE) {
  let n = 0;
  for (const slug of slugs) {
    const doc = JSON.parse(fs.readFileSync(path.join(DIR, slug, '_distill.json'), 'utf8'));
    const film = (doc.generatedVideo || {}).path;
    if (!film) continue;
    const bak = path.join(BAK, path.basename(film));
    if (!fs.existsSync(bak)) continue;
    fs.copyFileSync(bak, film);
    doc.generatedVideo.bytes = fs.statSync(film).size;
    fs.writeFileSync(path.join(DIR, slug, '_distill.json'), JSON.stringify(doc, null, 2) + '\n');
    n++;
    console.log(`↩ 已还原 ${slug}`);
  }
  console.log(`\n还原 ${n} 部。`);
  process.exit(0);
}

fs.mkdirSync(BAK, { recursive: true });
fs.mkdirSync('D:/lemo-films/_tpfix', { recursive: true });
const TMP = 'D:/lemo-films/_tpfix';

let needFix = 0, fixed = 0, failed = 0, skipped = 0, synced = 0, syncPlan = 0;
const report = [];

for (const slug of slugs) {
  const docPath = path.join(DIR, slug, '_distill.json');
  const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));
  const film = (doc.generatedVideo || {}).path;
  if (!film || !fs.existsSync(film)) {
    console.log(`— ${slug}：成片缺失，跳过`);
    skipped++;
    continue;
  }
  const before = await measure(film);
  if (before.tp === null) { console.log(`✘ ${slug}：测量失败`); failed++; continue; }
  if (before.tp <= TP_SPEC) {
    // ★ 已达标 ⇒ **不动成片**（对合规音频施压限是无谓的质量损失），只做**元数据对账**：
    //   `samplePeakDbfs` 缺失 / 陈旧 / 与真峰值不自洽时按实测回写（纯 json，成片零改动）。
    const r = syncSamplePeak(doc, docPath, before.sp, before.tp);
    if (r.wrote) {
      synced++;
      console.log(`ok ${slug.padEnd(20)} TP=${before.tp.toFixed(2)}（成片已达标）· 对账 samplePeakDbfs ${fmtNum(r.from)} → ${r.to}`);
    } else if (r.plan) {
      syncPlan++;
      console.log(`ok ${slug.padEnd(20)} TP=${before.tp.toFixed(2)}（成片已达标）· 待对账：${r.plan}`);
    } else {
      console.log(`ok ${slug.padEnd(20)} TP=${before.tp.toFixed(2)}（已达标，无需处理）`);
    }
    continue;
  }
  needFix++;
  console.log(`⚠ ${slug.padEnd(20)} TP=${before.tp.toFixed(2)} I=${before.lufs} → 违反口径（> ${TP_SPEC}），修到 ≤ ${TP_TARGET}`);
  if (!APPLY) { report.push({ slug, before: before.tp, after: null, ceiling: null, note: '干跑' }); continue; }

  // ── 候选上限阶梯：从高到低试，取第一个达标的（= 压制最轻的） ──
  const vmBefore = await videoMd5(film);
  const durBefore = await duration(film);
  const tmpOut = path.join(TMP, `${slug}.fix.mp4`);
  let best = null; // { tp, lufs, ceiling }
  for (const ceil of LADDER) {
    const { c } = await run(FF, [
      '-y', '-hide_banner', '-nostats', '-loglevel', 'error',
      '-i', film, '-map', '0:v:0', '-map', '0:a:0',
      '-c:v', 'copy',
      '-af', `alimiter=limit=${ceil}dB:level=disabled`,
      '-c:a', 'aac', '-b:a', ABR, '-movflags', '+faststart', tmpOut,
    ]);
    if (c !== 0) { console.log(`    limit=${ceil} 编码失败`); continue; }
    const m = await measure(tmpOut);
    console.log(`    limit=${String(ceil).padStart(5)}dB → TP=${m.tp} I=${m.lufs}`);
    if (m.tp === null) continue;
    if (!best || m.tp < best.tp) best = { ...m, ceiling: ceil };
    if (m.tp <= TP_TARGET) { best = { ...m, ceiling: ceil }; break; }
  }
  if (!best) { console.log(`  ✘ ${slug}：所有候选上限均失败`); failed++; report.push({ slug, before: before.tp, after: null, ceiling: null, note: '编码失败' }); continue; }

  // ── 安全闸：视频流 md5 / 时长 / 帧数必须与改前一致，否则拒绝写入 ──
  const vmAfter = await videoMd5(tmpOut);
  const durAfter = await duration(tmpOut);
  const frBefore = await videoFrames(film);
  const frAfter = await videoFrames(tmpOut);
  if (vmAfter !== vmBefore) { console.log(`  ✘ ${slug}：视频流 md5 变了（${vmBefore} → ${vmAfter}），拒绝写入`); failed++; report.push({ slug, before: before.tp, after: best.tp, ceiling: best.ceiling, note: '视频流被改动' }); continue; }
  if (Math.abs(durAfter - durBefore) > 0.05) { console.log(`  ✘ ${slug}：时长变了（${durBefore} → ${durAfter}），拒绝写入`); failed++; report.push({ slug, before: before.tp, after: best.tp, ceiling: best.ceiling, note: '时长改变' }); continue; }
  if (frBefore !== frAfter) { console.log(`  ✘ ${slug}：帧数变了（${frBefore} → ${frAfter}），拒绝写入`); failed++; report.push({ slug, before: before.tp, after: best.tp, ceiling: best.ceiling, note: '帧数改变' }); continue; }

  // ── 备份 + 落盘 + 回写文档 ──
  const bakPath = path.join(BAK, path.basename(film));
  if (!fs.existsSync(bakPath)) fs.copyFileSync(film, bakPath);
  fs.copyFileSync(tmpOut, film);
  fs.unlinkSync(tmpOut);
  doc.generatedVideo.bytes = fs.statSync(film).size;
  // ★ 真峰值在 json 里的**权威位置是 `selfCheck.loudness`**，不是 `generatedVideo`。
  //   踩过的坑：最初写的是 `doc.generatedVideo.truePeakDbtp`（该字段根本不存在）
  //   ⇒ 更新**静默空操作**，json 仍记着修复前的 +1.73、`peakTargetMet:false`，
  //     而 SKILL.md 正文已写「已修到 −1.69」⇒ 文档自相矛盾。
  //   ⇒ 这里直接写 `selfCheck.loudness`，并同步 `peakTargetMet`。
  const L = doc.selfCheck && doc.selfCheck.loudness;
  if (L) {
    const old = L.truePeakDbtp;
    L.truePeakDbtp = Number(best.tp.toFixed(2));
    if (best.lufs !== null && best.lufs !== undefined) L.integratedLufs = Number(best.lufs.toFixed(2));
    if (L.lra !== undefined && best.lra !== null && best.lra !== undefined) L.lra = Number(best.lra.toFixed(1));
    L.peakTargetMet = L.truePeakDbtp <= -1.2;
    L.peakNote = `★ ${new Date().toISOString().slice(0, 10)} 已修：成片经 \`scripts/fix-truepeak.mjs\` 音频重混（\`-c:v copy\`，视频流逐字节未变），真峰值 ${old} → ${L.truePeakDbtp} dBTP（alimiter 上限 ${best.ceiling}dB）。原值 ${old} 记录为修复前状态。`;
    // ★ 采样峰值必须与真峰值**同一次测量**一起回写 —— 只写真峰值正是历史缺口的成因
    //   （旧值留在 json 里、甚至 > 新真峰值，物理不可能）。见头注释。
    const spOut = clampSp(best.sp, L.truePeakDbtp);
    if (spOut !== null) L.samplePeakDbfs = spOut;
  } else {
    console.log(`  ⚠ ${slug}：json 无 selfCheck.loudness，真峰值未回写`);
  }
  fs.writeFileSync(docPath, JSON.stringify(doc, null, 2) + '\n');
  fixed++;
  console.log(`  ✓ ${slug}：TP ${before.tp.toFixed(2)} → ${best.tp.toFixed(2)}（limit=${best.ceiling}dB，I=${best.lufs}，视频流 md5 未变 ${vmBefore.slice(0, 8)}，${frAfter} 帧）`);
  report.push({ slug, before: before.tp, after: best.tp, ceiling: best.ceiling, note: 'ok' });
}

console.log('\n' + '─'.repeat(70));
console.log(`需修 ${needFix} 部；本次修复 ${fixed}；元数据对账 ${synced} 部；跳过（已达标且无需对账）${slugs.length - needFix - skipped - synced - syncPlan}；失败 ${failed}；成片缺失 ${skipped}`);
if (syncPlan) console.log(`★ 待对账（干跑未落盘）${syncPlan} 部 —— 加 --apply 才写 json（成片不动）。`);
console.log(`交付口径：真峰值 ≤ ${TP_SPEC} dBTP（修复目标 ≤ ${TP_TARGET}，留 0.3 dB 复测余量）`);
if (!APPLY && needFix) console.log('★ 这是干跑 —— 加 --apply 才真正修复。');
if (report.length) {
  console.log('\n明细：');
  for (const r of report) console.log(`  ${r.slug.padEnd(20)} ${String(r.before).padStart(6)} → ${String(r.after ?? '-').padStart(6)}  limit=${r.ceiling ?? '-'}  ${r.note}`);
}
process.exitCode = failed ? 1 : 0;
