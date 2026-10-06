#!/usr/bin/env node
/**
 * scripts/check-audio-chain.mjs —— 「音频链可跑性」闸门（编排器能不能把每个风格的音频链跑起来）
 *
 * ★ ① 由来（2026-10-04 立）：
 *   编排器 `lemo-make.mjs` 的音频链分「配音 → 配乐 → 拟音 → 混音」几步，每一步都靠在 demo 目录里
 *   按**候选清单**找脚本（候选清单是 shell 模板里的 `for c in "$D/…"` 循环）。**混音**这一步的候选是
 *   `$D/mix.py` / `$D/sound.py` / `$D/audio/mix.py`（`lemo-make.mjs:2066-2068`）；一个候选都找不到时，
 *   编排器直接 `STEP_FAIL 该 demo 没有 mix.py / sound.py / audio/mix.py —— 它用的是另一套音频架构`
 *   并 `exit 1`（`lemo-make.mjs:2290-2297`）。
 *   实测（2026-10-04，WIN 与 WSL 两侧各自**复刻编排器那条候选探测循环**跑过，43 个风格结论一致）：
 *     `game-show` / `halftone-dossier` / `pictogram-motion` 三个风格 MIX 恒为空 ⇒ 混音步必然失败。
 *   后果：这三个风格**无法通过编排器重渲音频**，只能 `--skip-audio` 复用旧 `mix.wav` ——
 *   而那条路会**静默复用旧混音**，实测曾冲掉 `pictogram-motion` 此前的真峰值修复（重渲后 TP −0.21 dBTP）。
 *   ★ 这个类别的特征是「**只有真去渲才会发现**」：静态看代码看不出来，既有闸门也全绿。
 *   ⇒ 本闸门把「每个风格的音频链能不能被编排器跑起来」做成机器可读清单 + 回归守卫。
 *
 * ★ ② 判据（机械可解释；候选清单**从 lemo-make.mjs 解析**，不在本闸门重写一份）：
 *   · 解析：读 `lemo-make.mjs` 源码文本，按「变量赋值标记」定位候选清单所在行（标记行若是
 *     `{ MUSIC=` 这种赋值行、候选在上一行的 `for c in …`，就**向上回看 4 行**取最近的那条），
 *     抽出其中的 `"$D/<路径>"` 字面量（见 CANDIDATE_SPECS）。**任一类解析为空 ⇒ 判失明**（防空转）。
 *       - 声线   `{ VOICEFX=`  → `lemo-make.mjs:2205`
 *       - 自带TTS `{ TTSOWN=`   → `lemo-make.mjs:2212`
 *       - 配乐   `{ MUSIC=`    → `lemo-make.mjs:2220`
 *       - 混音   `{ MIX=`      → `lemo-make.mjs:2225`
 *       - 拟音   `{ FOLEY=`    → `lemo-make.mjs:2235`
 *       - 可复用混音产物 `"$D/mix.wav"` → `lemo-make.mjs:2593`
 *       - 配音行 `[ -f "$D/lines.json" ]` → `lemo-make.mjs:2309`
 *   · 逐风格（`styles/*`，排除 `_template`）判定：
 *       - **混音**：`mix.py` → `sound.py` → `audio/mix.py` 取第一个存在的；找不到 ⇒ 混音步必失败。
 *       - **配乐**：`MUSIC` 候选取第一个存在的（注意 `MUSIC == MIX` 时编排器去重、只在混音步跑一次，
 *         所以 living-screencast 的 `sound.py` 只跑一次）。
 *       - **配音**：① `$D/lines.json` 存在 → `core/tts/tts.py`（有 `voice_fx.py`/`voice.py` 则再跑声线）；
 *                 ② 否则有 `$D/tts/gen.py` → 跑它；③ 都没有 → 靠已有 `voices/`。
 *   · 分类（**不一律判 FAIL**）：
 *       - **C 有混音脚本**：编排器能自己重渲音频 ⇒ 正常。
 *       - **B 已知另一套音频架构（只列 backlog，不判 FAIL）**：无混音脚本、但有可复用 `mix.wav`
 *         （`--skip-audio` 能出片）**且落在基线里**。当前基线：`game-show` / `halftone-dossier` /
 *         `pictogram-motion`（逐条含它自带哪些脚本，见输出）。
 *       - **A 无任何音频产出路径（判 FAIL）**：无混音脚本**且**无任何可复用 `mix.wav` 候选
 *         ⇒ 根本出不了带音频的片（真正的死路）。
 *       - **Bnew 新增的不支持风格（判 FAIL）**：无混音脚本、有可复用 `mix.wav`、但**不在基线里**
 *         ⇒ 新出现的、没人知道的能力缺口。提示：要么给它补 `mix.py`，要么把它加进基线并说明原因。
 *
 * ★ ③ 已知局限 / 会误报的边界：
 *   · **只读**：只读 `lemo-make.mjs` 文本与风格目录的文件存在性；不跑渲染、不加载模型、不改任何文件。
 *   · **扫 WIN 侧**（`LEMO_STYLES_ROOT`，默认 `D:/lemo-opuscar/styles`）。而编排器**实际在 WSL 侧**
 *     找脚本（`CFG.wslLib`）—— 两侧若漂移，本闸门结论可能与实际不符。该漂移由
 *     `scripts/check-dual-copy-sync.mjs` 单独守卫（立闸门当天两侧各跑一次探测循环，43 个风格结论一致）。
 *   · **只判「有没有脚本 / 有没有可复用产物」**，不判脚本本身跑不跑得通（缺素材、报错、版本问题都不在此）。
 *   · 「B 类」只保证「有 `mix.wav` 可复用」——**不代表复用是对的**：这三个风格真正的音频产物其实是
 *     `music.wav`（见基线 why），复用 `mix.wav` 是编排器的权宜路径，可能静默过期（正是本闸门要防的那类）。
 *   · 候选清单靠**正则**从源码文本抽取：若 `lemo-make.mjs` 改了写法（换行、变量名、去掉 `"$D/…"` 引号）
 *     导致解析为空 ⇒ 本闸门**判失明**（而不是静默 OK）。
 *   · 基线是**冻结清单**：新增一条会 FAIL，需要人显式维护（补脚本或改基线）。基线里某条已不再成立
 *     （该风格补了混音脚本）⇒ 只报 backlog（ℹ 基线可收缩），不判 FAIL。
 *
 * ★ ④ 退出码：A 类 / Bnew 类 / 失明（候选清单解析为空、风格数为 0、`lemo-make.mjs` 读不到）⇒ 1；否则 0。
 *
 * 用法：node scripts/check-audio-chain.mjs [--json]
 * 环境变量：
 *   LEMO_MAKE         编排器路径（默认 <脚本>/../lemo-make.mjs）
 *   LEMO_OPUSCAR      WIN 副本根（默认 <脚本>/../../lemo-opuscar）
 *   LEMO_STYLES_ROOT  风格根（默认 <OPUSCAR>/styles）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAKE = path.resolve(process.env.LEMO_MAKE || path.join(HERE, '..', 'lemo-make.mjs'));
const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || path.join(HERE, '..', '..', 'lemo-opuscar'));
const STYLES_ROOT = path.resolve(process.env.LEMO_STYLES_ROOT || path.join(OPUSCAR, 'styles'));
const AS_JSON = process.argv.includes('--json');

// ★ 冻结基线：已知「编排器不支持其混音步」的风格（无 mix.py / sound.py / audio/mix.py）。
//   新增一条 ⇒ 判 FAIL（见头注释 ② 的 Bnew）。改这里必须写清 why。
const MIX_UNSUPPORTED_BASELINE = [
  { slug: 'game-show', why: '音频是 music.py 直出 music.wav（配乐+音效+喊词一起混，44.1kHz），无 mix.wav 概念；自带 finish.sh 直混 music.wav（demo-manifest-all.json 的 game-show mux 步；该文件在仓外，按引用纪律第 12 条只写文件名不写行号）' },
  { slug: 'halftone-dossier', why: '完全另一套音频架构：music.py → music.wav，render.mjs 的 mux 子命令直混 music.wav（demo-manifest-all.json notes）' },
  { slug: 'pictogram-motion', why: '完全另一套音频架构：music/music.py → music/music.wav，mux.sh（zsh）直混（demo-manifest-all.json notes）' },
];

// 候选清单定位规则（见头注释 ② 的「解析」表）。
const CANDIDATE_SPECS = [
  { key: 'voicefx', label: '声线后处理', marker: /\{ VOICEFX=/, srcLine: '`lemo-make.mjs:2205`' },
  { key: 'ttsown', label: 'demo 自带 TTS', marker: /\{ TTSOWN=/, srcLine: '`lemo-make.mjs:2212`' },
  { key: 'music', label: '配乐生成器', marker: /\{ MUSIC=/, srcLine: '`lemo-make.mjs:2220`' },
  { key: 'mix', label: '混音脚本', marker: /\{ MIX=/, srcLine: '`lemo-make.mjs:2225`' },
  { key: 'foley', label: '拟音/音效', marker: /\{ FOLEY=/, srcLine: '`lemo-make.mjs:2235`' },
  { key: 'mixwav', label: '可复用混音产物', marker: /"\$D\/mix\.wav"/, srcLine: '`lemo-make.mjs:2593`' },
  { key: 'lines', label: '配音行', marker: /\[ -f "\$D\/lines\.json" \]/, srcLine: '`lemo-make.mjs:2309`' },
];

const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const extractPaths = (line) => {
  const out = [];
  const re = /"\$D\/([^"]+)"/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1]);
  return out;
};

/** 从源码文本里解析某类候选清单：定位标记行，取最近的 `for c in …` 行，抽出 `$D/…` 字面量。 */
function parseCandidates(lines, marker) {
  const idx = lines.findIndex((l) => marker.test(l));
  if (idx < 0) return null;
  for (let j = idx; j >= Math.max(0, idx - 4); j--) {
    if (/\bfor c in\b/.test(lines[j])) {
      const out = extractPaths(lines[j]);
      if (out.length) return out;
    }
  }
  const out = extractPaths(lines[idx]);   // 兜底：标记行自身（如 lines.json 的 if 行）
  return out.length ? out : null;
}

// ── 解析 lemo-make.mjs ───────────────────────────────────────────────────────
const blindReasons = [];
let makeText = null;
if (!fs.existsSync(MAKE)) {
  blindReasons.push(`编排器不存在：${MAKE}`);
} else {
  makeText = readText(MAKE);
  if (makeText == null) blindReasons.push(`编排器读不到：${MAKE}`);
}

const candidates = {};
if (makeText != null) {
  const lines = makeText.split(/\r?\n/);
  for (const spec of CANDIDATE_SPECS) {
    const got = parseCandidates(lines, spec.marker);
    candidates[spec.key] = got;
    if (!got || got.length === 0) {
      blindReasons.push(`候选清单解析为空：${spec.label}（标记 ${spec.marker} → ${spec.srcLine}）—— lemo-make.mjs 写法变了？`);
    }
  }
}

// 配音引擎路径（`core/tts/tts.py`）—— 只用于展示配音路线，缺了不判失明。
const TTS_ENGINE = makeText ? (/(core\/tts\/tts\.py)/.exec(makeText) || [, 'core/tts/tts.py'])[1] : 'core/tts/tts.py';

// ── 枚举风格 ─────────────────────────────────────────────────────────────────
let slugs = [];
if (!fs.existsSync(STYLES_ROOT)) {
  blindReasons.push(`风格根不存在：${STYLES_ROOT}`);
} else {
  slugs = fs.readdirSync(STYLES_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '_template')
    .map((e) => e.name)
    .sort();
  if (slugs.length === 0) blindReasons.push(`风格扫到 0 个（${STYLES_ROOT}）：路径/过滤变了？`);
}

const firstExisting = (demoDir, cands) => {
  if (!cands) return null;
  for (const rel of cands) if (fs.existsSync(path.join(demoDir, rel))) return rel;
  return null;
};
const allExisting = (demoDir, cands) => (cands || []).filter((rel) => fs.existsSync(path.join(demoDir, rel)));
const hasWav = (dir) => {
  try { return fs.readdirSync(dir).some((f) => f.toLowerCase().endsWith('.wav')); } catch { return false; }
};

const baseline = new Map(MIX_UNSUPPORTED_BASELINE.map((b) => [b.slug, b.why]));
const OWN_SCRIPTS = ['build.sh', 'finish.sh', 'mux.sh', 'assemble.py', 'build.py'];

// ── 逐风格判定 ───────────────────────────────────────────────────────────────
const rows = [];
const A = [];      // 无任何音频产出路径（FAIL）
const B = [];      // 已知另一套架构（backlog）
const Bnew = [];   // 新增不支持风格（FAIL）
const staleBaseline = [];   // 基线里已不再成立的条目（backlog）

for (const slug of slugs) {
  const demoDir = path.join(STYLES_ROOT, slug, 'demo');

  const mixScript = firstExisting(demoDir, candidates.mix);
  const musicScript = firstExisting(demoDir, candidates.music);
  const foleyScript = firstExisting(demoDir, candidates.foley);
  const voiceFx = firstExisting(demoDir, candidates.voicefx);
  const mixWavs = allExisting(demoDir, candidates.mixwav);

  const hasLines = !!(candidates.lines && candidates.lines.some((rel) => fs.existsSync(path.join(demoDir, rel))));
  const ttsOwn = firstExisting(demoDir, candidates.ttsown);
  const hasVoices = hasWav(path.join(demoDir, 'voices'));

  let voiceRoute;
  if (hasLines) voiceRoute = voiceFx ? `lines.json→${TTS_ENGINE}+${voiceFx}` : `lines.json→${TTS_ENGINE}`;
  else if (ttsOwn) voiceRoute = `自带 ${ttsOwn}`;
  else voiceRoute = hasVoices ? '无（靠已有 voices/）' : '无配音路径';

  // 混音步分类（见头注释 ②）。
  let category, reason = '';
  if (mixScript) {
    category = 'C';
  } else if (mixWavs.length > 0) {
    if (baseline.has(slug)) { category = 'B'; reason = baseline.get(slug); }
    else { category = 'Bnew'; reason = '无混音脚本、但有可复用 mix.wav，且不在冻结基线里'; }
  } else {
    category = 'A';
    reason = '无混音脚本，也没有任何可复用 mix.wav —— 出不了带音频的片';
  }

  const ownScripts = [
    ...OWN_SCRIPTS.filter((f) => fs.existsSync(path.join(demoDir, f))),
    ...(musicScript ? [musicScript] : []),
    ...(foleyScript ? [foleyScript] : []),
    ...(mixScript ? [mixScript] : []),
  ];

  const row = {
    slug, category,
    mixScript, mixWavs, musicScript, foleyScript, voiceFx, ttsOwn,
    hasLines, hasVoices, voiceRoute, ownScripts, reason,
  };
  rows.push(row);
  if (category === 'A') A.push(row);
  else if (category === 'B') B.push(row);
  else if (category === 'Bnew') Bnew.push(row);
}

// 基线可收缩：基线里但已不再「无混音脚本」的风格。
for (const b of MIX_UNSUPPORTED_BASELINE) {
  const r = rows.find((x) => x.slug === b.slug);
  if (r && r.category !== 'B') staleBaseline.push({ slug: b.slug, now: r.category });
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────
const blind = blindReasons.length > 0;
const fails = [...A, ...Bnew];
const ok = !blind && fails.length === 0;
const withMix = rows.filter((r) => r.category === 'C');
const noMix = rows.filter((r) => r.category !== 'C');
const counts = {
  styles: rows.length,
  withMixScript: withMix.length,
  noMixScript: noMix.length,
  A_noAudioPath: A.length,
  B_knownUnsupported: B.length,
  Bnew_newUnsupported: Bnew.length,
};

if (AS_JSON) {
  console.log(JSON.stringify({
    make: MAKE,
    stylesRoot: STYLES_ROOT,
    opuscar: OPUSCAR,
    candidates,
    ttsEngine: TTS_ENGINE,
    baseline: MIX_UNSUPPORTED_BASELINE,
    counts,
    fails: fails.map((r) => ({ slug: r.slug, category: r.category, reason: r.reason, ownScripts: r.ownScripts, mixWavs: r.mixWavs })),
    staleBaseline,
    rows,
    blind,
    blindReasons,
    ok,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

// ── 文本输出 ─────────────────────────────────────────────────────────────────
const fmtCands = (k) => (candidates[k] ? `${candidates[k].length} 条` : '（解析失败）');
console.log('音频链可跑性闸门 —— 编排器能不能把每个风格的音频链跑起来');
console.log(`  编排器: ${MAKE}`);
console.log(`  风格根: ${STYLES_ROOT}`);
console.log(`  候选清单（从 lemo-make.mjs 解析）：混音 ${fmtCands('mix')} / 配乐 ${fmtCands('music')} / `
  + `拟音 ${fmtCands('foley')} / 声线 ${fmtCands('voicefx')} / 自带TTS ${fmtCands('ttsown')} / `
  + `可复用 mix.wav ${fmtCands('mixwav')}`);
console.log(`  风格 ${counts.styles} 个：有混音脚本 ${counts.withMixScript}、无混音脚本 ${counts.noMixScript}`
  + `（其中 B 基线 ${counts.B_knownUnsupported}、Bnew 新增 ${counts.Bnew_newUnsupported}、A 无路径 ${counts.A_noAudioPath}）\n`);

if (A.length) {
  console.log(`✘ A 类「无任何音频产出路径」（判 FAIL）${A.length} 处 —— 既无混音脚本、也无任何可复用 mix.wav：`);
  for (const r of A) console.log(`  ${r.slug.padEnd(22)} ${r.reason}`);
} else {
  console.log('✓ 没有「无任何音频产出路径」的风格');
}

console.log(`\n${B.length ? 'ℹ' : 'ℹ'} B 类「已知另一套音频架构」（只列 backlog，不判 FAIL）${B.length} 个：`);
for (const r of B) {
  console.log(`  · ${r.slug}  可复用 ${r.mixWavs.join(' / ')}  自带脚本 [${r.ownScripts.join(', ') || '无'}]`);
  console.log(`      ${r.reason}`);
}
if (!B.length) console.log('  （无）');

if (Bnew.length) {
  console.log(`\n✘ Bnew 类「新增的不支持风格」（判 FAIL）${Bnew.length} 处 —— 无混音脚本、有可复用 mix.wav、但不在冻结基线里：`);
  for (const r of Bnew) console.log(`  ${r.slug.padEnd(22)} 自带脚本 [${r.ownScripts.join(', ') || '无'}]`);
  console.log('  ⇒ 要么给它补 mix.py / sound.py / audio/mix.py，要么把它加进 MIX_UNSUPPORTED_BASELINE 并写清原因。');
} else {
  console.log('\n✓ 没有新增的「编排器不支持混音」风格');
}

if (staleBaseline.length) {
  console.log(`\nℹ 基线可收缩（不判 FAIL）${staleBaseline.length} 条 —— 这些风格已不再是「无混音脚本」，可从基线移除：`);
  for (const s of staleBaseline) console.log(`  · ${s.slug}（现在 = ${s.now}）`);
}

console.log(`\nℹ 混音步会失败的风格全集（A ∪ B ∪ Bnew，共 ${noMix.length} 个）：`
  + `${noMix.map((r) => r.slug).join(' ') || '（无）'}`);

console.log('\n逐风格（混音 / 配乐 / 配音）：');
for (const r of rows) {
  const mix = r.mixScript || (r.category === 'A' ? '✘ 无（且无 mix.wav）' : `✘ 无（复用 ${r.mixWavs.join('/') || '—'}）`);
  const mus = r.musicScript || '—';
  console.log(`  ${r.slug.padEnd(22)} [${r.category}] 混音=${mix}  配乐=${mus}  配音=${r.voiceRoute}`);
}

if (blind) {
  console.log('\n✘✘ 本闸门已**失明**，结论不可信：');
  for (const r of blindReasons) console.log(`   ✘ ${r}`);
}

console.log(`\n[闸门] 音频链可跑性：风格 ${counts.styles} 个、有混音脚本 ${counts.withMixScript}、`
  + `无混音脚本 ${counts.noMixScript}（B ${counts.B_knownUnsupported} / Bnew ${counts.Bnew_newUnsupported} / A ${counts.A_noAudioPath}）、`
  + `FAIL ${fails.length} 处${blind ? '、**已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exit(ok ? 0 : 1);
