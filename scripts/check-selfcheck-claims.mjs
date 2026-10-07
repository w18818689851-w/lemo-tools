#!/usr/bin/env node
/**
 * scripts/check-selfcheck-claims.mjs —— `_distill.json#selfCheck` 里**「对实物可核的声称」**的闸门
 *
 * ★ 由来（2026-10-07，补一个**已由独立审计实测确认的零覆盖区**）：
 *   一次只读审计统计：43 份 `_distill.json` 的 `selfCheck` 去重后共 **283 条字段路径**，
 *   其中 **242 条没有任何闸门在读**（41 条有消费者）。本条闸门专门接住其中**能对实物/权威字段核**的几条：
 *
 *   | 字段（43 份里的出现次数）        | 声称什么        | 真值来源（本闸门实测核过）                                   |
 *   |----------------------------------|-----------------|--------------------------------------------------------------|
 *   | `selfCheck.muxEncoder`（43/43）  | 成片用 nvenc 编 | ★★ **成片的编码器 tag**：`ffprobe -select_streams v:0`         |
 *   |                                  |                 | `-show_entries stream_tags=encoder`（实测 43/43 =               |
 *   |                                  |                 | `Lavc60.31.102 h264_nvenc`）                                    |
 *   | `selfCheck.fps`（3/43）          | 帧率            | `generatedVideo.fps`（同源；而 `generatedVideo.*` 已被          |
 *   | `selfCheck.frames`（3/43）       | 帧数            | `check-skill-artifacts.mjs` 对着成片核过 ⇒ 只需核「两者一致」） |
 *   | `selfCheck.size`（3/43）         | 分辨率 WxH      | `generatedVideo.{width,height}`（同上）                         |
 *   | `selfCheck.srtCues`（2/43）      | 字幕条数        | **成片同名 `.srt` 的实际 cue 数**（实测 2/2 一致）              |
 *
 * ★★ 为什么 `muxEncoder` 这条最重要（本闸门存在的理由）：
 *   它声称「nvenc」，而此前**零读者** ⇒ 若哪天渲染回退成 `libx264`（违反项目第一硬规则
 *   「渲染一律 GPU 优先」），**没有任何闸门会响**：`check-render-venc.mjs` 核的是**脚本**里的
 *   编码器决策点（源码级，不看成片）、`check-mux-parity.mjs` 核的是两份 `mux.sh` 的**口径**、
 *   `check-skill-artifacts.mjs` 核的是 `generatedVideo.*` 的**数值**（不含编码器）。
 *   ⇒ 本条闸门是**那条硬规则在 `_distill.json` 侧的落点**：它判的是**成片实际用的编码器**。
 *
 * ★ 判据（三条，全部只核「能对实物/权威字段核」的字段；**不核散文** —— 那已由 `check-tp-prose.mjs` 管）：
 *   (A) `selfCheck.muxEncoder` 存在且非空 ⇒ 否则 FAIL（声称缺失 = 无凭据）。
 *   (B) ★ **达标**（不是「自洽」）：成片实际的视频流编码器 tag 必须含**期望编码器**
 *       —— 期望值 = `LEMO_VENC`（若设）否则 `h264_nvenc`。
 *       成片实际是 `libx264` ⇒ **FAIL**（那正是「静默走 CPU」）。
 *       ★ 为什么必须有一处真判达标（项目铁律）：只判「声称 == 实物」的话，
 *         一个「声称 libx264、实物 libx264」的成片会**绿灯通过** —— 而那违反第一硬规则。
 *   (C) **自洽**：`muxEncoder` 的声称值与成片 tag 必须对得上（声称归一化后是 tag 的子串）。
 *       声称 `nvenc` 而 tag 是 `libx264`（或反之）⇒ FAIL。
 *   (D) `selfCheck.{fps,frames,size}`（**有才核**）：与 `generatedVideo.{fps,frames,width,height}` 逐项一致
 *       （`size` 解析成 `WxH`）。同义 ⇒ 不重复跑 ffprobe（`generatedVideo.*` 已由 `check-skill-artifacts` 对实物核过）。
 *   (E) `selfCheck.srtCues`（**有才核**）：与**成片同名 `.srt`** 的实际 cue 数一致（实测 2/2 一致、误报 0）。
 *       字幕文件取 `generatedVideo.path` 换扩展名（`<slug>.mp4` → `<slug>.srt`）；`.srt` 不在则跳过（不判 FAIL）。
 *
 * ★ **有意不核的 `selfCheck` 字段（逐条给理由，非疏漏）**：
 *   · `loudness.{truePeakDbtp,integratedLufs,lra,peakDbtpTarget,peakTargetMet,samplePeakDbfs}`（43/43）
 *     —— **已被** `check-film-delivery.mjs`（A/B/C 类，对着成片实测核）+ `check-tp-prose.mjs`（json 数值自洽）
 *     + `check-lra-caliber.mjs` 覆盖 ⇒ 再核一遍是**重复**。
 *   · `rendered`（43/43）/ `usedPreGeneratedAudio` / `warnings[]` / 一切 `*note` / `audio.*` / `events` /
 *     `totalSec` / `renderSec` / `ratio` / `nativeResolution` / `grain` / `skipSync` / `preflight` …
 *     —— 要么是**散文**（已由 `check-tp-prose.mjs` 的 json pass 管）、要么**口径不明**
 *     （实测 `selfCheck.totalSec` 与 `generatedVideo.durSec` **本来就不同**：`one-line` 67.1 vs 47.5，
 *     说明它是**另一个量**、不是成片时长 ⇒ 拿 durSec 判它就是**凭猜收窄**）、
 *     要么**没有可对的真值**（`grain` 的「档位」只在 `lib/style-dna/*.json` 的**散文**里写着
 *     `grain = 0`，无结构化字段 ⇒ 核它等于核散文，与纪律冲突）。
 *   · `rendered === true` 的**真实性**由 (A)(B) 的「成片必须存在且可读」隐式覆盖（成片读不到 ⇒ 失明 FAIL）。
 *
 * ★ **失明守卫**（防空转绿灯；写法照 `check-skill-artifacts.mjs` 的两条 / `check-loudness-targets.mjs:64-79`）：
 *   ① 一个带 `_distill.json` 的风格都枚举不到 ⇒ FAIL 并明说「本闸门已失明」；
 *   ② **一个可核字段都没有**（43 份里 `muxEncoder` 与 `fps/frames/size` 全缺）⇒ FAIL 并明说「本闸门已失明」；
 *   ③ **一个成片文件都读不到**（`ffprobe` 一个都没成功）⇒ FAIL 并明说「本闸门已失明」。
 *   ⇒ 否则「fails 为空」会打印「✓ 全部一致」—— 那是**假的**（一个东西都没核）。
 *
 * ★ 覆盖点（供非破坏变异验证；与既有闸门同名同义）：
 *   · `LEMO_DISTILL_ROOT` —— 风格技能树（默认 `<仓根>/lib/style-skills`；与 `check-skill-artifacts`
 *     / `check-film-delivery` / `check-tp-prose` 同名同义）。
 *   · `LEMO_FILM_DIR`     —— 成片根（默认 `D:/lemo-films`；与 `lib/env.mjs` / `fix-truepeak.mjs`
 *     / `prune-jobs.mjs` 同名同义）。**别名** `LEMO_FILMS_ROOT`（`check-film-aspect.mjs` 用的名字）
 *     也接受 —— 免得夹具按那个名字重定向时**静默地仍在读真库**（同型坑本项目踩过）。
 *   · `LEMO_FFPROBE`      —— ffprobe 路径（默认 `D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffprobe.exe`）。
 *   · `LEMO_VENC`         —— **期望编码器**（默认 `h264_nvenc`；与 `check-render-venc.mjs` 同名同义）。
 *
 * ★ 已知局限（如实登记，不粉饰）：
 *   · (B)(C) 认的是**视频流的 `encoder` tag** —— 那是**编码器自己写的**，不是「谁编的」的独立证明。
 *     拿一个 CPU 编的片再手工改 tag 就能骗过它（**主动造假不在守卫职责内**）。它能抓住的是
 *     「渲染路径**静默回落**成 CPU」这一真实形态（那时 tag 会变成 `Lavc… libx264`）。
 *   · tag 缺失（`stream_tags.encoder` 为空）⇒ 判 FAIL 并明说「无法核」—— **宁红勿绿**。
 *   · 只认 `stream_tags=encoder`；`format_tags=encoder` 是**封装器**版本（实测 `Lavf60.16.100`、
 *     不含 `h264_nvenc`）⇒ **不能用**它判（实测 43/43 都拿不到编码器名）。
 *   · (D) 只与 `generatedVideo.*` 比，**不**直接与成片比 —— 后者是 `check-skill-artifacts` 的活，
 *     且 `-count_frames` 会**分钟级**（本项目明令别把闸门做成分钟级）。
 *
 * 用法：node scripts/check-selfcheck-claims.mjs [--only a,b] [--json]
 * 退出码：有 FAIL 或失明 → 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || path.join(ROOT, 'lib', 'style-skills'));
const FILM_DIR = path.resolve(process.env.LEMO_FILM_DIR || process.env.LEMO_FILMS_ROOT || 'D:/lemo-films');
const FFPROBE = process.env.LEMO_FFPROBE || 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffprobe.exe';
/** ★ 期望编码器：未设 `LEMO_VENC` ⇒ `h264_nvenc`（项目第一硬规则「渲染一律 GPU 优先」）。 */
const EXPECTED = process.env.LEMO_VENC || 'h264_nvenc';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const only = (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

// ★ 本机 spawnSync/execFileSync 一律 EBUSY（项目里多处记过）⇒ 用异步 spawn
const run = (cmd, args) => new Promise((res) => {
  const p = spawn(cmd, args, { windowsHide: true });
  let o = '', e = '';
  p.stdout.on('data', (d) => { o += d; });
  p.stderr.on('data', (d) => { e += d; });
  p.on('close', (code) => res({ code, o, e }));
  p.on('error', (x) => res({ code: -1, o, e: String(x.message) }));
});

/** 归一化：只留字母数字 + 小写（`h264_nvenc` → `h264nvenc`）。 */
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** 只读头部、不逐帧解码（实测 43 部 ≈ 5 s）⇒ 取视频流的 `encoder` tag。 */
async function probeEncoder(film) {
  const { code, o, e } = await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name:stream_tags=encoder', '-of', 'json', film]);
  if (code !== 0) return { err: (e || 'ffprobe 失败').slice(0, 160) };
  try {
    const j = JSON.parse(o);
    const s = (j.streams || [])[0] || {};
    return { codec: s.codec_name || null, tag: ((s.tags || {}).encoder || null) };
  } catch (x) { return { err: 'ffprobe 输出解析失败: ' + x.message }; }
}

/** 解析 `selfCheck.size`（`"1920x1080"`）→ `{ w, h }`；解析不出返回 null。 */
function parseSize(s) {
  const m = String(s).match(/^\s*(\d+)\s*[xX×*]\s*(\d+)\s*$/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

if (!fs.existsSync(FFPROBE)) { console.error(`找不到 ffprobe: ${FFPROBE}`); process.exit(2); }

let slugs = [];
try {
  slugs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json'))).sort();
} catch { /* ★ 目录读不到 ⇒ 交给下面的失明守卫（不裸抛） */ }
if (only.length) slugs = slugs.filter((s) => only.includes(s));

const rows = [];
const fails = [];
let filmsRead = 0;      // ffprobe 成功读到的成片数
let compared = 0;       // 真正做过的「声称 vs 真值」比对次数

for (const slug of slugs) {
  const p = path.join(DIR, slug, '_distill.json');
  let j;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (x) { fails.push(`${slug}: _distill.json 解析失败 —— ${x.message}`); rows.push({ slug, status: 'FAIL', why: 'json 解析失败' }); continue; }
  const sc = j.selfCheck || {};
  const gv = j.generatedVideo || {};

  const claim = sc.muxEncoder;
  const hasFps = sc.fps != null || sc.frames != null || sc.size != null;
  const hasSrtCues = sc.srtCues != null;

  if (claim == null && !hasFps && !hasSrtCues) {
    rows.push({ slug, status: 'SKIP', why: 'selfCheck 里没有一个可核字段（muxEncoder / fps / frames / size / srtCues 全缺）' });
    continue;
  }

  const bad = [];

  // ── (A)(B)(C) `selfCheck.muxEncoder` vs 成片的编码器 tag ──────────────────
  if (claim == null) {
    bad.push('selfCheck.muxEncoder 缺失（声称无凭据）');
  } else if (typeof claim !== 'string' || !claim.trim()) {
    bad.push(`selfCheck.muxEncoder 不是非空字符串：${JSON.stringify(claim)}`);
  } else {
    const film = gv.path || path.join(FILM_DIR, slug, `${slug}.mp4`);
    if (!fs.existsSync(film)) {
      bad.push(`成片不存在，无法核 muxEncoder 声称 —— ${film}`);
    } else {
      const real = await probeEncoder(film);
      if (real.err) {
        bad.push(`ffprobe 读不出成片的编码器 —— ${real.err}`);
      } else {
        filmsRead++;
        const tag = real.tag;
        // (B) ★ 达标：成片实际编码器必须含期望值（未设 LEMO_VENC ⇒ h264_nvenc）。
        if (!tag) {
          bad.push(`成片没有视频流 encoder tag（codec=${real.codec || '?'}）⇒ 无法核「用 nvenc 编」`);
        } else if (!norm(tag).includes(norm(EXPECTED))) {
          bad.push(`★ 成片未走 ${EXPECTED}（GPU 优先铁律）：实际 encoder tag = "${tag}"`);
        }
        // (C) 自洽：声称值必须对得上成片 tag。
        if (tag && !norm(tag).includes(norm(claim))) {
          bad.push(`muxEncoder 声称 "${claim}" 与成片实际 "${tag}" 不符`);
        }
        compared++;
      }
    }
  }

  // ── (D) `selfCheck.{fps,frames,size}` vs `generatedVideo.*`（有才核）────────
  if (hasFps) {
    const cmpNum = (k, doc, act, tol) => {
      if (doc == null || act == null) return;
      compared++;
      if (Math.abs(doc - act) > tol) bad.push(`selfCheck.${k} ${doc} vs generatedVideo.${k} ${act}`);
    };
    cmpNum('fps', sc.fps, gv.fps, 0.01);
    cmpNum('frames', sc.frames, gv.frames, 0);
    if (sc.size != null) {
      const sz = parseSize(sc.size);
      if (!sz) bad.push(`selfCheck.size 解析不出 WxH：${JSON.stringify(sc.size)}`);
      else if (gv.width != null && gv.height != null) {
        compared++;
        if (sz.w !== gv.width || sz.h !== gv.height) {
          bad.push(`selfCheck.size ${sz.w}x${sz.h} vs generatedVideo ${gv.width}x${gv.height}`);
        }
      }
    }
  }

  // ── (E) `selfCheck.srtCues` vs 成片同名 `.srt` 的实际 cue 数（有才核）────────
  let srtSkip = '';
  if (hasSrtCues) {
    const srt = (gv.path || path.join(FILM_DIR, slug, `${slug}.srt`)).replace(/\.mp4$/i, '.srt');
    if (!fs.existsSync(srt)) {
      srtSkip = `selfCheck.srtCues 有声称，但字幕文件不在（${srt}）⇒ 没核`;
    } else {
      const cues = (fs.readFileSync(srt, 'utf8').match(/^\s*\d+\s*$/gm) || []).length;
      compared++;
      if (cues !== sc.srtCues) bad.push(`selfCheck.srtCues ${sc.srtCues} vs ${path.basename(srt)} 实际 ${cues} 条`);
    }
  }

  if (bad.length) { fails.push(`${slug}: ${bad.join('；')}`); rows.push({ slug, status: 'FAIL', why: bad.join('；') }); }
  else if (srtSkip) rows.push({ slug, status: 'SKIP', why: srtSkip });
  else rows.push({ slug, status: 'PASS', why: '' });
}

// ── ★ 失明守卫（防空转绿灯）────────────────────────────────────────────────
const blind = [];
if (slugs.length === 0) {
  blind.push(`\`${DIR}\` 下一个带 _distill.json 的风格都没枚举到（路径 / \`--only\` / 过滤变了？）⇒ 一份声称都没核过`);
}
if (slugs.length > 0 && compared === 0) {
  blind.push(`${slugs.length} 个风格里**一个可核字段都没核到**（muxEncoder 与 fps/frames/size/srtCues 全缺，或全 SKIP）⇒ 本闸门什么都没检查`);
}
if (slugs.length > 0 && filmsRead === 0) {
  blind.push(`**一个成片文件都读不到**（ffprobe 成功 0 部；成片根 = \`${FILM_DIR}\`）⇒ 「成片实际编码器」这一维已失明`);
}

if (asJson) {
  console.log(JSON.stringify({ ffprobe: FFPROBE, distillRoot: DIR, filmDir: FILM_DIR, expected: EXPECTED, slugs: slugs.length, filmsRead, compared, rows, fails, ...(blind.length ? { blind } : {}) }, null, 2));
} else {
  console.log('check-selfcheck-claims —— `_distill.json#selfCheck` 里对实物可核的声称 vs 真值');
  console.log(`  ffprobe    : ${FFPROBE}`);
  console.log(`  风格树     : ${DIR}`);
  console.log(`  成片根     : ${FILM_DIR}   期望编码器: ${EXPECTED}`);
  console.log(`  风格数 ${slugs.length}   成片读到 ${filmsRead}   比对 ${compared} 处`);
  console.log('');
  for (const r of rows) {
    const mark = r.status === 'PASS' ? '  ok ' : r.status === 'SKIP' ? ' skip' : ' FAIL';
    console.log(`${mark}  ${String(r.slug).padEnd(22)} ${r.why || ''}`);
  }
  console.log('');
  if (blind.length) {
    console.log('✘ 本闸门已失明：');
    for (const b of blind) console.log(`  ✘ ${b}`);
    console.log('');
  }
  if (fails.length) { console.log(`✗ ${fails.length} 条声称与真值不符：`); for (const f of fails) console.log(`  - ${f}`); }
  else if (!blind.length) console.log(`✓ ${slugs.length} 个风格的 selfCheck 声称（muxEncoder ${EXPECTED} + fps/frames/size + srtCues）与真值全部一致。`);
}
process.exit((fails.length || blind.length) ? 1 : 0);
