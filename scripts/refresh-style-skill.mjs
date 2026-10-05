#!/usr/bin/env node
/**
 * scripts/refresh-style-skill.mjs —— **出片之后，把新成片的实测口径回填进该风格的 Skill 文档**
 *
 * ★ 为什么需要它（2026-10-04 立，补的是项目的一条**明确要求**）：
 *   项目要求「每次未来生成之后，**反向更新该风格的 Skill 文档**」（长期循环）。
 *   但审计发现：**没有任何通用工具能做这件事** ——
 *     · 检测端有自动钩子（`dub.mjs` 的 `warnStyleChanges()` 只在出片路径**提示**「需重新解析」，绝不写库）；
 *     · 写回端全是**硬编码 slug 表**的一次性补丁（`sync-tp-docs.mjs` 写死 18 个 slug、
 *       `patch-tp-prose.mjs` 写死 7 个锚点）⇒ **换个风格就得手改**；
 *     · `check-skill-artifacts.mjs --update` 只回填 `generatedVideo` 的技术字段，**不碰音频口径、不标「已修」**。
 *   本脚本把这条链补成**通用**的：给 slug（或全部），实测成片 → 回填 json → 按需在 SKILL.md 标「已修」。
 *
 * 做什么（全部基于**实测**，不猜）：
 *   ① `generatedVideo`：path / durSec / bytes / width / height / fps / frames
 *   ② `selfCheck.loudness`：integratedLufs / truePeakDbtp / lra / peakTargetMet
 *   ③ **真峰值从「超标」变「达标」时**，在 SKILL.md 里自动标「已修」：
 *      · 「响度目标」行句末追加已修子句；
 *      · 第 11 节「已知缺陷」里**数值已不再匹配实测**且**没有已修标记**的条目，逐条追加。
 *      ⇒ 判据与 `check-tp-prose.mjs` **同源**（那一条只认「关于成片」的断言；这里再多一个条件：值 > −1.2）。
 *   ③-b **同一「超标→达标」时机**，也把 `_distill.json` 的 `selfCheck.warnings` 里那批旧真峰值声称
 *      标成历史（★ 2026-10-04 新增，补工具缺口）：此前只标 SKILL.md，`warnings` 仍留着「成片已削波」
 *      的旧话，而 `selfCheck.loudness` 已被重混后的实测值更新 ⇒ **同一份 json 里「已削波」与「已达标」
 *      并存**，读 `_distill.json` 的下游（`lib/style-skill-reader.mjs`）会被误导。判据同源：只认
 *      「关于成片」的真峰值声称；目标/上限、素材（mix.wav）口径不算；已带历史标记的**不重复追加**。
 *   ④ **反向情况**（旧达标、新超标）**不自动写** —— 那需要新增一条缺陷并定扣分档，属人工判断，只**大声告警**。
 *
 * 幂等：已含 `fix-truepeak` / `refresh-style-skill` 标记的行不再追加。
 *
 * 用法：
 *   node scripts/refresh-style-skill.mjs --only papercut-red [--dry]
 *   node scripts/refresh-style-skill.mjs --all [--dry]
 * 退出码：有「新成片反而超标」→ 1（需人工处理）；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DIR = 'D:/lemo-tools/lib/style-skills';
const FF = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const FP = FF.replace(/ffmpeg\.exe$/, 'ffprobe.exe');
const ARGV = process.argv.slice(2);
const DRY = ARGV.includes('--dry');
const ALL = ARGV.includes('--all');
const onlyIdx = ARGV.indexOf('--only');
const ONLY = onlyIdx >= 0 ? ARGV[onlyIdx + 1] : null;

const TP_SPEC = -1.2;
const DATE = new Date().toISOString().slice(0, 10);
const MARK = /fix-truepeak|refresh-style-skill/;

const run = (bin, args) =>
  new Promise((res) => {
    const p = spawn(bin, args);
    let o = '', e = '';
    p.stdout.on('data', (d) => (o += d));
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res({ o, e: String(err.message), c: -1 }));
    p.on('close', (c) => res({ o, e, c }));
  });

const num = (t, k) => {
  const m = t.match(new RegExp(`"${k}"\\s*:\\s*"?(-?[0-9.]+)"?`));
  return m ? Number(m[1]) : null;
};

async function measureAudio(file) {
  const { e } = await run(FF, ['-hide_banner', '-nostats', '-i', file,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
  const { e: e2 } = await run(FF, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const lras = [...e2.matchAll(/^\s*LRA:\s*(-?[\d.]+)/gm)];
  return {
    truePeakDbtp: num(e, 'input_tp'),
    integratedLufs: num(e, 'input_i'),
    lra: lras.length ? Number(lras[lras.length - 1][1]) : null,   // 项目 LRA 口径 = ebur128
  };
}

async function probeVideo(file) {
  const { o } = await run(FP, ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
    '-show_entries', 'format=duration', '-of', 'json', file]);
  try {
    const j = JSON.parse(o);
    const st = (j.streams || [])[0] || {};
    const [a, b] = String(st.r_frame_rate || '').split('/').map(Number);
    return {
      width: st.width ?? null,
      height: st.height ?? null,
      fps: b ? +(a / b).toFixed(3) : (Number.isFinite(a) ? a : null),
      frames: st.nb_frames ? Number(st.nb_frames) : null,
      // ★★ 2026-10-04 修：这里原来写 `Math.round(...)`（**整数**），而 `check-skill-artifacts.mjs`
      //   的容差是 **±0.05s**（`TOL_SEC`）⇒ 实测 121.791667 被写成 122，差 0.21 > 0.05 ⇒
      //   **跑完本工具，那条闸门必然 FAIL**，还得再手动跑一次 `check-skill-artifacts --update`。
      //   两个工具的口径互相矛盾（一个是「四舍五入到整秒」、一个按 ±0.05s 判）。
      //   ⇒ 这里改成**两位小数**（最大误差 0.005 ≪ 0.05），让「回填完即闸门通过」成立。
      durSec: j.format && j.format.duration ? +(Number(j.format.duration).toFixed(2)) : null,
    };
  } catch { return null; }
}

const note = (oldV, newV) =>
  ` ★ **${DATE} 已修**：成片经重混/重渲后实测真峰值 **${oldV} → ${newV} dBTP**，已在 ${TP_SPEC} dBTP 交付线内；` +
  `本条判语为**修复前**状态，保留作历史。（由 \`scripts/refresh-style-skill.mjs\` 按实测自动标注）`;

// ── ③-b 的判据（与 `check-tp-prose.mjs` 的四条件同源，只针对 `_distill.json#selfCheck.warnings`）──
//   · HIST：整条已带历史语境 ⇒ 幂等跳过（与 SKILL.md 侧的 MARK 策略一致）；
//   · TARGET：数值前紧邻「目标/交付线/上限/≤」⇒ 那是**声明值**不是实测，不算；
//   · MAT：数值 ±70 字内出现 `mix.wav` 等 ⇒ 讲的是**素材**不是成片，不算；
//   · FILM：整条必须含「成片/本片/该片/混流实测」⇒ 只认「关于本片成片」的断言。
const WARN_HIST = /已修|原为|原记|原先|曾是|曾为|历史|修复前|修复后|校正|保留|移入|重渲|重混|已于|已由/;
const WARN_TARGET = /目标|交付线|上限|声明|未达|达标线|<=|≤|低于/;
const WARN_MAT = /mix\.wav|music\.wav|母带|素材|样片|源文件|音源|compose\.py|mix\.py/;
const WARN_FILM = /成片|本片|该片|混流实测/;
//   ★ 正则要求「关键词…数值…紧跟 dB*」：否则会把 `input_tp` 之后隔了几个字的**别的量**
//     （如「，与目标 −14 LUFS」的响度目标）误当成真峰值声称 —— 实测踩过（glass-product）。
const TP_KEYS = /(?:真峰值|input_tp|TPK)[^0-9+−-]{0,10}([+−-]?\d+(?:\.\d+)?)\s*dB/gi;

/** 把 warnings 里「关于成片、却与本次实测真峰值不符、且未标历史」的旧声称逐条标成历史。返回改动条数。 */
function markStaleWarnings(d, oldTp, newTp) {
  const w = d.selfCheck && Array.isArray(d.selfCheck.warnings) ? d.selfCheck.warnings : null;
  if (!w) return 0;
  let n = 0;
  for (let i = 0; i < w.length; i++) {
    const t = w[i];
    if (typeof t !== 'string' || WARN_HIST.test(t)) continue;   // 幂等：已带标记不追加
    if (!WARN_FILM.test(t)) continue;                           // 只认「关于成片」
    const claims = [];
    for (const m of t.matchAll(/([+−-]?\d+(?:\.\d+)?)\s*dBTP/gi))
      claims.push({ v: Number(m[1].replace('−', '-')), at: m.index });
    for (const m of t.matchAll(TP_KEYS))
      claims.push({ v: Number(m[1].replace('−', '-')), at: m.index });
    const stale = claims.some((c) => {
      if (WARN_TARGET.test(t.slice(Math.max(0, c.at - 16), c.at))) return false;   // 目标/上限
      if (WARN_MAT.test(t.slice(Math.max(0, c.at - 70), c.at + 70))) return false; // 素材
      return Math.abs(c.v - newTp) > 0.15;                                        // 与实测不符
    });
    if (stale) { w[i] = t + note(oldTp, newTp); n++; }
  }
  return n;
}

const slugs = ALL
  ? fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort()
  : (ONLY ? [ONLY] : []);
if (!slugs.length) { console.error('用法：--only <slug> 或 --all（可加 --dry）'); process.exit(2); }

let nJson = 0, nProse = 0, nWorse = 0, nJsonWarn = 0;
const rows = [];

for (const slug of slugs) {
  const jsonPath = path.join(DIR, slug, '_distill.json');
  const mdPath = path.join(DIR, slug, 'SKILL.md');
  if (!fs.existsSync(jsonPath)) { console.log(`— ${slug}：无 _distill.json，跳过`); continue; }
  const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const film = (d.generatedVideo || {}).path;
  if (!film || !fs.existsSync(film)) { console.log(`— ${slug}：成片缺失，跳过`); continue; }

  const before = (d.selfCheck && d.selfCheck.loudness) ? { ...d.selfCheck.loudness } : {};
  const a = await measureAudio(film);
  const v = await probeVideo(film);
  if (a.truePeakDbtp === null) { console.log(`✘ ${slug}：音频实测失败，跳过`); continue; }

  // ① + ② 回填 json（全部以实测为准）
  d.generatedVideo = { ...(d.generatedVideo || {}), path: film, bytes: fs.statSync(film).size };
  if (v) for (const k of ['width', 'height', 'fps', 'frames', 'durSec']) if (v[k] !== null) d.generatedVideo[k] = v[k];
  if (!d.selfCheck) d.selfCheck = {};
  if (!d.selfCheck.loudness) d.selfCheck.loudness = {};
  const L = d.selfCheck.loudness;
  L.integratedLufs = a.integratedLufs !== null ? Number(a.integratedLufs.toFixed(2)) : L.integratedLufs;
  L.truePeakDbtp = Number(a.truePeakDbtp.toFixed(2));
  if (a.lra !== null) L.lra = a.lra;
  L.peakTargetMet = L.truePeakDbtp <= TP_SPEC;

  const changed = Math.abs((before.truePeakDbtp ?? 999) - L.truePeakDbtp) > 0.05;
  const wasOk = Number.isFinite(before.truePeakDbtp) && before.truePeakDbtp <= TP_SPEC;
  const wasBad = Number.isFinite(before.truePeakDbtp) && before.truePeakDbtp > TP_SPEC;

  // ③-b 真峰值由「超标」变「达标」⇒ 顺带把 `_distill.json#selfCheck.warnings` 里的旧真峰值声称标成历史。
  //     ★ 必须在**落盘之前**改 `d`，好与 ① ② 的回填一次写入；幂等由 markStaleWarnings 内部保证。
  const nWarn = (wasBad && L.peakTargetMet) ? markStaleWarnings(d, before.truePeakDbtp, L.truePeakDbtp) : 0;

  // ★ 只在**内容真的变了**时才落盘（此前无条件写 ⇒ 每次跑都刷新 mtime，制造噪声）。
  const rawBefore = fs.readFileSync(jsonPath, 'utf8');
  const outJson = JSON.stringify(d, null, 2) + '\n';
  if (!DRY && outJson !== rawBefore) fs.writeFileSync(jsonPath, outJson);
  nJson++;
  nJsonWarn += nWarn;

  console.log(`  ${slug.padEnd(20)} 真峰值 ${String(before.truePeakDbtp ?? '-').padStart(6)} → ${String(L.truePeakDbtp).padStart(6)} dBTP` +
    `  ${L.peakTargetMet ? '✓达标' : '✘超标'}${changed ? '' : '（未变）'}${nWarn ? `  · warnings 标已修 ${nWarn} 条` : ''}`);

  // ④ 反向情况：旧达标、新超标 —— 不自动写，只告警（要新增缺陷条目 + 定扣分档，属人工判断）
  if (wasOk && !L.peakTargetMet) {
    nWorse++;
    console.log(`     ✘✘ 反向：该风格原先达标（${before.truePeakDbtp} dBTP），**重渲后超标**（${L.truePeakDbtp}）—— 需要新增一条缺陷条目并定扣分档，请人工处理`);
    rows.push({ slug, action: '反向超标，需人工' });
    continue;
  }

  // ③ 真峰值由超标变达标 ⇒ 在 SKILL.md 标「已修」（通用，不靠硬编码锚点）
  if (!wasBad || !L.peakTargetMet) { rows.push({ slug, action: '口径已回填，无需标已修' }); continue; }
  if (!fs.existsSync(mdPath)) { rows.push({ slug, action: '无 SKILL.md' }); continue; }

  const lines = fs.readFileSync(mdPath, 'utf8').split('\n');
  let hit = 0;

  // (a) 「响度目标」行
  const iTgt = lines.findIndex((l) => /响度目标/.test(l));
  if (iTgt >= 0 && !MARK.test(lines[iTgt])) {
    lines[iTgt] = lines[iTgt].replace(/\s*$/, '') + note(before.truePeakDbtp, L.truePeakDbtp);
    hit++;
  }

  // (b) **全文**扫描：数值不再匹配实测、且没有已修标记的条目，逐条追加。
  //     ★ 不能只扫第 11 节「已知缺陷」—— 实测踩过：文末摘要（`- **音频削波**：成片真峰值 +1.73 dBTP…`）
  //       与「下次迭代优先补什么」里的待办项都在 §11 之外，只扫已知缺陷会漏掉它们。
  //       判据与 `check-tp-prose.mjs` 同源：值 > −1.2、与实测差 > 0.15、匹配点前后 60 字内有「成片」。
  for (let i = 0; i < lines.length; i++) {
    if (MARK.test(lines[i])) continue;
    if (/风格匹配度自评/.test(lines[i])) continue;   // 评分行由 check-skill-scores 管，不在这里动
    let touched = false;
    for (const m of lines[i].matchAll(/([+−-]?\d+(?:\.\d+)?)\s*dBTP/g)) {
      const val = Number(m[1].replace('−', '-'));
      if (!Number.isFinite(val) || val <= TP_SPEC) continue;
      if (Math.abs(val - L.truePeakDbtp) <= 0.15) continue;
      const near = lines[i].slice(Math.max(0, m.index - 60), m.index + m[0].length + 60);
      if (!/成片/.test(near)) continue;
      touched = true;
    }
    if (touched) { lines[i] = lines[i].replace(/\s*$/, '') + note(before.truePeakDbtp, L.truePeakDbtp); hit++; }
  }

  if (hit) { if (!DRY) fs.writeFileSync(mdPath, lines.join('\n')); nProse += hit; }
  rows.push({ slug, action: `json 已回填；SKILL.md 标已修 ${hit} 处` });
}

console.log('\n' + '─'.repeat(74));
console.log(`json 回填 ${nJson} 份（其中 warnings 标已修 ${nJsonWarn} 条）；SKILL.md 标已修 ${nProse} 处；**反向超标需人工** ${nWorse} 份`);
if (DRY) console.log('★ 干跑，未写入。');
console.log('\n下一步建议：node scripts/check-tp-prose.mjs && node scripts/check-film-delivery.mjs && node scripts/check-lra-caliber.mjs');
process.exitCode = nWorse ? 1 : 0;
