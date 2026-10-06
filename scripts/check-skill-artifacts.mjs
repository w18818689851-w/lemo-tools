#!/usr/bin/env node
/**
 * scripts/check-skill-artifacts.mjs —— 校验 43 份风格 Skill 文档里**记录的成片信息**与磁盘实物是否一致
 *
 * ★ 为什么需要它（2026-10-03 立的由来）：这一招已经抓到过**两次真问题** ——
 *   ① `game-show` 的文档记的是旧成片（audio 6 / 86,267,715 B，而实际已是 91,187,233 B 的有声版）；
 *   ② `ascii-crt` 的成片被 `test/smoke.mjs --full` 的 ⑤+ 用例**误覆盖**（该用例原来不给 `--out`），
 *      文档记 29,712,494 B、实物只剩 21,880,427 B，且几何从 1920×1080 变成了 1080×1920。
 *   两次都是「**拿文档里记的数值去对磁盘上的实物**」发现的 —— 这类偏差（尤其是"测试有副作用"
 *   造成的静默破坏）光看代码和文档都看不出来。
 *
 * 校验 `_distill.json#generatedVideo` 的：path / bytes / durSec / width / height / fps / frames
 * （只校验**文档里确实记了**的字段；没记的跳过，不当失败）。
 *
 * 用法：
 *   node scripts/check-skill-artifacts.mjs [--only a,b] [--json] [--tol-bytes 1024] [--tol-sec 0.05]
 *   node scripts/check-skill-artifacts.mjs --update      # 把不一致的**按实物更正**（会改文档；默认只报不改）
 * 退出码：有不一致 → 1；否则 0。
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// ★ 覆盖点（供非破坏变异验证）：`LEMO_DISTILL_ROOT` 与 `check-film-delivery.mjs:92` / `check-tp-prose.mjs:325` 同名同义（风格技能树）。
const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(ROOT, 'lib', 'style-skills'));
const FFPROBE = process.env.LEMO_FFPROBE || 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffprobe.exe';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const UPDATE = argv.includes('--update');
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const only = (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const TOL_BYTES = Number(argOf('--tol-bytes') || 1024);
const TOL_SEC = Number(argOf('--tol-sec') || 0.05);

// ★ 本机 spawnSync/execFileSync 一律 EBUSY（项目里多处记过）⇒ 用异步 spawn
const run = (cmd, args) => new Promise((res) => {
  const p = spawn(cmd, args, { windowsHide: true });
  let o = '', e = '';
  p.stdout.on('data', (d) => { o += d; });
  p.stderr.on('data', (d) => { e += d; });
  p.on('close', (code) => res({ code, o, e }));
  p.on('error', (x) => res({ code: -1, o, e: String(x.message) }));
});

/** 探测一个成片的实际属性。needFrames=true 时才逐帧计数（慢）。 */
async function probe(film, needFrames) {
  const args = ['-v', 'error', '-select_streams', 'v:0'];
  if (needFrames) args.push('-count_frames');
  args.push('-show_entries', `stream=width,height,r_frame_rate${needFrames ? ',nb_read_frames' : ''}`);
  args.push('-show_entries', 'format=duration,size', '-of', 'json', film);
  const { code, o, e } = await run(FFPROBE, args);
  if (code !== 0) return { err: (e || 'ffprobe 失败').slice(0, 160) };
  try {
    const j = JSON.parse(o);
    const s = (j.streams || [])[0] || {};
    const f = j.format || {};
    const [num, den] = String(s.r_frame_rate || '').split('/').map(Number);
    return {
      width: s.width ?? null,
      height: s.height ?? null,
      fps: Number.isFinite(num) && Number.isFinite(den) && den ? num / den : null,
      frames: needFrames && s.nb_read_frames ? Number(s.nb_read_frames) : null,
      durSec: f.duration != null ? Number(f.duration) : null,
      bytes: f.size != null ? Number(f.size) : null,
    };
  } catch (x) { return { err: 'ffprobe 输出解析失败: ' + x.message }; }
}

if (!fs.existsSync(FFPROBE)) { console.error(`找不到 ffprobe: ${FFPROBE}`); process.exit(2); }

let slugs = [];
try {
  slugs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort();
} catch { /* ★ 目录读不到 ⇒ 交给下面的失明守卫（不裸抛） */ }
if (only.length) slugs = slugs.filter((s) => only.includes(s));

const rows = [];
const fails = [];

// ── ★ 失明守卫（防空转绿灯）────────────────────────────────────────────────
//   判据：一个带 `_distill.json` 的风格都枚举不到（目录不存在 / `--only` 拼错 / 过滤变了）⇒
//   一份文档都没校验过 ⇒ 判 FAIL 并明说「本闸门已失明」。否则 `fails` 为空会打印
//   「文档记录的成片信息与实物全部一致」—— 那是**假的**。
//   （写法照 `check-loudness-targets.mjs:64-79` / `check-config-vs-doc.mjs:108-116` 的同型守卫。）
const blind = [];
if (slugs.length === 0) blind.push(`\`${DIR}\` 下一个带 _distill.json 的风格都没枚举到（路径 / \`--only\` / 过滤变了？）⇒ 一份文档都没校验过`);
for (const slug of slugs) {
  const p = path.join(DIR, slug, '_distill.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const gv = j.generatedVideo || {};
  if (!gv.path) { rows.push({ slug, status: 'SKIP', why: '文档没记 generatedVideo.path' }); continue; }
  if (!fs.existsSync(gv.path)) { fails.push(`${slug}: 文档记的成片不存在 —— ${gv.path}`); rows.push({ slug, status: 'FAIL', why: '成片文件不存在' }); continue; }

  const real = await probe(gv.path, gv.frames != null);
  if (real.err) { fails.push(`${slug}: ffprobe 读不出实物 —— ${real.err}`); rows.push({ slug, status: 'FAIL', why: 'ffprobe 失败' }); continue; }

  const bad = [];
  const cmp = (key, doc, act, tol, unit) => {
    if (doc == null || act == null) return;
    if (Math.abs(doc - act) > tol) bad.push(`${key}: 文档 ${doc}${unit} vs 实物 ${act}${unit}`);
  };
  cmp('bytes', gv.bytes, real.bytes, TOL_BYTES, ' B');
  cmp('durSec', gv.durSec, real.durSec, TOL_SEC, ' s');
  cmp('width', gv.width, real.width, 0, '');
  cmp('height', gv.height, real.height, 0, '');
  cmp('fps', gv.fps, real.fps, 0.01, ' fps');
  cmp('frames', gv.frames, real.frames, 0, ' 帧');

  if (bad.length) {
    fails.push(`${slug}: ${bad.join('；')}`);
    rows.push({ slug, status: 'FAIL', why: bad.join('；'), real, gv });
    if (UPDATE) {
      for (const k of ['bytes', 'durSec', 'width', 'height', 'fps', 'frames']) {
        if (gv[k] != null && real[k] != null && Math.abs(gv[k] - real[k]) > (k === 'bytes' ? TOL_BYTES : k === 'durSec' ? TOL_SEC : 0.01)) gv[k] = real[k];
      }
      fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
    }
  } else {
    rows.push({ slug, status: 'PASS', why: '' });
  }

  // ── ★ 2026-10-04 追加：`evidenceFrames` 列的帧图**必须真的存在** ──
  //   它是「我逐帧看过、这些帧就是证据」的凭据。文件不在 ⇒ 这条声称**无凭据**。
  //   落点固定为 `_distill/frames/<slug>/<文件名>`（实测 43/43 都在这里）。
  const frames = Array.isArray(j.evidenceFrames) ? j.evidenceFrames : [];
  if (!frames.length) {
    fails.push(`${slug}: evidenceFrames 为空（逐帧分析没有留下任何凭据）`);
    rows.push({ slug, status: 'FAIL', why: 'evidenceFrames 为空' });
  } else {
    const missFrames = frames.filter((f) => !fs.existsSync(path.join(ROOT, '_distill', 'frames', slug, String(f))));
    if (missFrames.length) {
      fails.push(`${slug}: evidenceFrames 有 ${missFrames.length}/${frames.length} 个帧图不存在（如 ${missFrames.slice(0, 3).join(', ')}）`);
      rows.push({ slug, status: 'FAIL', why: `帧图缺 ${missFrames.length}/${frames.length}` });
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ ffprobe: FFPROBE, rows, fails, ...(blind.length ? { blind } : {}) }, null, 2));
} else {
  console.log('check-skill-artifacts —— 文档记录的成片信息 vs 磁盘实物');
  console.log(`  ffprobe: ${FFPROBE}`);
  console.log(`  风格数  : ${slugs.length}   容差: bytes ±${TOL_BYTES} / durSec ±${TOL_SEC}s`);
  if (UPDATE) console.log('  ★ --update：不一致的已按实物更正');
  console.log('');
  for (const r of rows) {
    const mark = r.status === 'PASS' ? '  ok ' : r.status === 'SKIP' ? ' skip' : ' FAIL';
    console.log(`${mark}  ${String(r.slug).padEnd(22)} ${r.why || ''}`);
  }
  console.log('');
  if (blind.length) {
    console.log(`✘ 本闸门已失明：`);
    for (const b of blind) console.log(`  ✘ ${b}`);
    console.log('');
  }
  if (fails.length) { console.log(`✗ 与实物不一致 ${fails.length} 条：`); for (const f of fails) console.log(`  - ${f}`); }
  else if (!blind.length) console.log('✓ 文档记录的成片信息与实物全部一致。');
}
process.exit((fails.length || blind.length) ? 1 : 0);
