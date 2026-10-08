#!/usr/bin/env node
/**
 * scripts/style-distill.mjs —— 43 个内置风格的「顺序蒸馏」驱动
 *
 * 为什么要有它：蒸馏是**长期循环流程**（项目约定一），43 个风格要**逐个顺序**跑完
 * （GPU / TTS 都不能并发）。手工一个个敲命令既容易漏、也无法断点续跑。
 * 这个脚本把「枚举 → 顺序出片 → 抽帧 → 记状态」固化成可重入的一条流水线。
 *
 * 用法：
 *   node scripts/style-distill.mjs plan                    ← 按**源码指纹 + 产物存在性**报出「新纳入 / 变更 / 缺成片 / 台账缺指纹（未决）」
 *   node scripts/style-distill.mjs plan --backfill [--only a,b] [--force]  ← 补写台账指纹（默认拒绝「源码可能已变」的写入）
 *   node scripts/style-distill.mjs render [--force] [--only a,b] [--no-skip-sync] [--args "<透传给 lemo-make 的额外参数，如 --skip-audio / --skip-render>"]
 *   node scripts/style-distill.mjs frames [--force] [--only a,b]
 *   node scripts/style-distill.mjs status
 *
 * ★ 「自动纳入」怎么落地的（约定一 · 长期循环）：
 *   本脚本的 `plan` 复用 `scripts/style-scan.mjs` 的**内容哈希指纹**（不是时间戳），
 *   把每个风格当前的指纹与「上次蒸馏时记下的指纹」比对 ——
 *   **新增的 styles/<slug>/ 与源码被改过的已有风格都会自己冒出来**，不需要人工记得去跑。
 *   所以新风格加入项目的流程就是：丢进 styles/ → `plan` 会列出来 → `render`/`frames`/写 Skill 文档。
 *   指纹在**出片成功时**自动写入 state.json（见 doRender）。
 *
 * 产物（全部在非 C 盘）：
 *   D:/lemo-films/<slug>/<slug>.mp4          —— 成片（编排器自己写的，本脚本不搬）
 *   D:/lemo-tools/_distill/state.json        —— 逐风格状态（可断点续跑的唯一依据）
 *   D:/lemo-tools/_distill/logs/<slug>.log   —— 每个风格的完整 stdout/stderr
 *   D:/lemo-tools/_distill/frames/<slug>/    —— 逐帧抽取 + 接触印样（contact sheet）
 * ★ 两条根的**唯一**来源：成片根 = `lib/env.mjs` 的 `CFG.exportDir`（认 `LEMO_FILM_DIR`）；风格源码根 = `lib/styles-root.mjs` 的 `resolveStylesRoot()`（认 `LEMO_STYLES_ROOT`）。不设覆盖点时与原字面量 `'D:/lemo-films'` / `'D:/lemo-opuscar/styles'` 解析结果逐字节相同。
 * ★ 纪律：
 *   · **顺序执行**，绝不并发（GPU 与 Index-TTS 都是独占资源）。
 *   · **一个失败不阻断后面的**：记 status=failed + 原因，继续跑下一个。
 *   · **可重入**：已成功的默认跳过（--force 才重跑）。
 *   · 本脚本**不改** lemo-make.mjs（红线：编排器不能被包装层改）。★ 已知残留：编排器的 `exportDir` **不认** `LEMO_FILM_DIR` ⇒ 设该覆盖点时本脚本按 `<覆盖点>/<slug>/<slug>.mp4` 找成片、它 spawn 的编排器却仍写 `D:\lemo-films\…`，二者分叉；不设覆盖点（生产）时恒一致。
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CFG } from '../lib/env.mjs';                        // ★ 成片根唯一来源（认 LEMO_FILM_DIR）
import { resolveStylesRoot } from '../lib/styles-root.mjs';  // ★ 风格源码根唯一来源（认 LEMO_STYLES_ROOT）
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STYLES_DIR = resolveStylesRoot(CFG.winLib);
const FILM_DIR = CFG.exportDir;
const WORK = path.join(ROOT, '_distill');
const STATE = path.join(WORK, 'state.json');
const LOGS = path.join(WORK, 'logs');
const FRAMES = path.join(WORK, 'frames');
// 蒸馏产物根（每风格两份：SKILL.md + _distill.json）—— 判「有没有蒸馏过」只看这里，不看 state 的 fp
const SKILLS_DIR = path.join(ROOT, 'lib', 'style-skills');
const FFMPEG = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';

const argv = process.argv.slice(2);
const CMD = argv[0] || 'status';
const has = (f) => argv.includes(f);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OPT = {
  force: has('--force'),
  only: (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean),
  skipSync: !has('--no-skip-sync'),
  // 透传给 lemo-make 的额外参数（空格分隔）。用途：失败风格重跑时按需带 `--skip-audio`
  // （音频链本身跑不通、已有占位/自合成 mix.wav 的风格）或 `--skip-render`。
  extra: (argOf('--args') || '').split(/\s+/).filter(Boolean),
};

// ── 枚举：只认 styles/<slug> 且带 demo/ 的目录（_template 是骨架，不是风格）──
function allSlugs() {
  return fs.readdirSync(STYLES_DIR)
    .filter((n) => n !== '_template' && !n.startsWith('.'))
    .filter((n) => fs.existsSync(path.join(STYLES_DIR, n, 'demo')))
    .sort();
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { version: 1, updated: null, styles: {} }; }
}
function saveState(s) {
  fs.mkdirSync(WORK, { recursive: true });
  s.updated = new Date().toISOString();
  const tmp = `${STATE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 1), 'utf8');
  fs.renameSync(tmp, STATE);
}

function pickSlugs() {
  const all = allSlugs();
  return OPT.only.length ? all.filter((s) => OPT.only.includes(s)) : all;
}

/** 当前全部风格的源码指纹（复用 style-scan 的内容哈希，不用时间戳）。 */
async function currentFingerprints() {
  const m = await import('./style-scan.mjs');
  const scan = m.scanStyles({ stylesRoot: STYLES_DIR });
  const map = new Map();
  for (const [slug, v] of Object.entries(scan.styles || {})) map.set(slug, v.hash);
  return map;
}

// ── 蒸馏产物存在性（「有没有蒸馏过」的唯一判据）────────────────
//   ★★ 2026-10-06 修「工具说谎」：此前 `plan` 用 **state 的 `fp`** 判「有没有蒸馏过」——
//   而 `fp` 只在**渲染成功**时写（见 doRender）⇒ `fp:null` 的真实含义是「**上次出片失败**」，
//   不是「没蒸馏过」。实测 43 个风格里 21 个 `fp` 为 null，而这 **21/21 的 `SKILL.md` +
//   `_distill.json` 都在**（真缺产物的是 0 个）⇒ 旧版把这 21 个全印成「未蒸馏（新纳入）」，
//   凭空多报 21 个待办、并把「上次出片失败」这个真信息彻底遮住。
//   ⇒ 现按**产物存在性**分流（不看 fp）。
function artifactsOf(slug) {
  const dir = path.join(SKILLS_DIR, slug);
  const skill = fs.existsSync(path.join(dir, 'SKILL.md'));
  const distill = fs.existsSync(path.join(dir, '_distill.json'));
  return { skill, distill, complete: skill && distill };
}

// ── 失败归因：**关键词分类**（机械可执行，不做语义理解）──────────
//   分类顺序即优先级：先匹配到的胜出。判据是**字面关键词**，所以可被复核、可被反驳。
function classifyRenderErr(err) {
  const s = String(err || '');
  if (!s) return '无错误文本';
  if (/INDEXTTS_MIN_FREE_MIB|显存|腾显存|MiB|VRAM/i.test(s)) return '显存守卫';
  if (/人工对齐|对齐|wsl\.exe|-d Ubuntu|tr -d/i.test(s)) return '双副本未对齐';
  if (/\bw\d+\s+\d+\/\d+|\bdone\s+[A-Za-z]:\\|frames\s+\d+s|killed/i.test(s)) return '渲染中途错误';
  return '其它';
}

// ── 「台账缺指纹」这一组的**可判定性**（尽力而为的旁证，**不是结论**）──────
//   背景：`fp:null` ⇒ 台账里**没有可比的指纹** ⇒ **无法判定**该风格源码自上次蒸馏后有没有变过。
//   唯一能借的旁证是扫描器自建的**基线** `lib/style-fingerprints.json`（逐风格带 `hash`）。
//   ★★ 但基线是**陈旧**的：实测 `generatedAt`/`lastScanAt` 停在 2026-10-02/10-03，**43/43 逐文件都与当前不同**
//   ⇒ 「与基线不一致」在当前数据上**近乎必然**，**不许**读成「源码确已变更」。
//   所以三种标记里只有「一致」是**硬结论**（拿一份旧基线还能对上 ⇒ 确实没动过）；
//   「不一致」只是**疑已变**，必须连同基线的 `lastScanAt` 一起打印，让读者按「基线有多旧」自己打折。
function baseVerdict(g) {
  if (!g.baseHash) return { mark: '?', text: '无可比指纹（基线里没有这个风格）' };
  if (g.baseHash === g.cur) return { mark: '✓', text: '与基线一致（可证未变）' };
  return { mark: '✘', text: '与基线不一致（疑已变）' };
}

/** 历史指纹（用于 --backfill 的安全阀）：台账 state.fp + style-scan 的基线文件，两者都算「历史」。 */
async function loadBaseline() {
  try { const m = await import('./style-scan.mjs'); return m.loadFingerprintFile(); } catch { return null; }
}

// ── plan：按指纹报出「需要（重新）蒸馏」的风格 ──────────────────
//   这是「新增风格自动纳入」的**检测端**：新丢进 styles/ 的目录、以及源码被改过的已有风格，
//   都会在这里自己冒出来，不需要人工记得去跑。
async function doPlan() {
  const st = loadState();
  const all = allSlugs();
  const fp = await currentFingerprints();
  // ★ 基线（扫描器自建的 style-fingerprints.json）—— 只用来给「台账缺指纹」那一组**补一个可判定性**，
  //   **不参与**「待处理」计数。它是**陈旧**的，所以只能作从严参考（见 baseVerdict 的说明）。
  //   ★ 同时供下面的 `--backfill` 安全阀复用（一次读盘，两处同源）。
  const base = await loadBaseline();

  const never = [], ledgerGap = [], changed = [], noFilm = [], fresh = [];
  for (const slug of all) {
    const rec = st.styles[slug];
    const cur = fp.get(slug) || null;
    // ★ 分流按**产物存在性**，不按 fp：产物缺 ⇒ 真「未蒸馏（新纳入）」；产物齐 ⇒ 台账缺指纹 ⇒ **未决**（见下）。
    if (!rec || !rec.fp) {
      const art = artifactsOf(slug);
      if (!art.complete) never.push(slug);
      else ledgerGap.push({
        slug,
        fpState: rec ? 'null' : '无记录',
        render: rec?.render || null,
        renderAt: rec?.renderAt || null,
        cause: classifyRenderErr(rec?.renderErr),
        skill: art.skill,
        distill: art.distill,
        cur,                                            // 当前指纹（与基线比用）
        baseHash: base?.styles?.[slug]?.hash || null,   // 基线指纹（null ⇒ 基线里没有 ⇒ 无可比）
      });
      continue;
    }
    if (rec.fp !== cur) { changed.push({ slug, from: String(rec.fp).slice(0, 10), to: String(cur).slice(0, 10) }); continue; }
    const mp4 = path.join(FILM_DIR, slug, `${slug}.mp4`);
    if (!fs.existsSync(mp4) || fs.statSync(mp4).size < 10000) { noFilm.push(slug); continue; }
    fresh.push(slug);
  }

  // ★ 汇总口径：`待处理` **只数真待办**（未蒸馏 / 源码已变更 / 缺成片）；
  //   「台账缺指纹」**单列一个计数**并注明**未决** —— 它的产物齐全，但台账里没有可比指纹，
  //   ⇒ **无法判定**源码自上次蒸馏后有没有变过（可能确实要重蒸馏，只是台账记不下来）。**这不是「没事」。**
  const todo = never.length + changed.length + noFilm.length;
  console.log(`\n风格 ${all.length} 个  |  已蒸馏且未变 ${fresh.length}  |  待处理 ${todo}  |  台账缺指纹 ${ledgerGap.length}（未决·无法判定源码是否变更）\n`);
  if (never.length) console.log(`  未蒸馏（新纳入）：${never.join(', ')}`);
  if (changed.length) {
    console.log(`  源码已变更（需重新蒸馏）：`);
    for (const c of changed) console.log(`    ${c.slug}  ${c.from}… → ${c.to}…`);
  }
  if (noFilm.length) console.log(`  缺成片：${noFilm.join(', ')}`);
  if (ledgerGap.length) {
    const baseAt = base?.lastScanAt || base?.generatedAt || null;
    console.log(`\n  ★ 已蒸馏 · 台账缺指纹 ${ledgerGap.length} 个 —— **未决**（不是「没事」）`);
    console.log('    产物齐全（SKILL.md + _distill.json 都在）；`fp` 只在**渲染成功**时写，');
    console.log('    `fp:null` 的真实含义是「上次出片失败」；但台账里**没有可比指纹** ⇒');
    console.log('    **无法判定**它的源码自上次蒸馏后有没有变过（可能确实要重蒸馏，只是台账记不下来）。');
    console.log(`    可判定性（旁证）：拿基线 lib/style-fingerprints.json 的逐风格 hash 与**当前**指纹比（基线 lastScanAt=${baseAt || '未知'}）`);
    console.log('    ★ 基线越旧，「不一致」越可能只是陈旧 ⇒ 本条只作从严参考，');
    console.log('      **不许**把「与基线不一致」直接当成「确已变更」的结论。');
    for (const g of ledgerGap) {
      const v = baseVerdict(g);
      console.log(`    ${g.slug.padEnd(20)} 归因=${g.cause.padEnd(7)} fp=${g.fpState.padEnd(5)} render=${String(g.render).padEnd(7)} 上次失败 ${g.renderAt || '未知'}  产物=SKILL.md ${g.skill ? '✓' : '✗'} / _distill.json ${g.distill ? '✓' : '✗'}  基线=${v.mark} ${v.text}`);
    }
  }
  if (!todo) {
    console.log(ledgerGap.length
      ? `  无待办（另有 ${ledgerGap.length} 个风格「台账缺指纹」—— **未决**：无法判定源码是否变更，见上）。`
      : '  全部已蒸馏且指纹未变 —— 无待办。');
  }
  console.log('');
  // ★ --backfill：把「已有成片但 state 里没记指纹」的风格补上指纹。
  //   用途：出片循环是在加指纹字段**之前**启动的，跑完不会自动写 fp；跑一次 --backfill 即可补平，
  //   之后 `plan` 才能真正区分「已蒸馏且未变」与「新纳入」。
  //   ★★ 2026-10-06 加**安全阀**：补写的是**当前**指纹 ⇒ 若该风格源码自上次成功出片后已变，
  //   补写等于把「源码已变更」**洗白**成「已蒸馏且未变」，真实变更从此在 `plan` 里消失
  //   （旧版对 `[...never, ...noFilm]` 无条件写，而 `never` 里恰恰混着源码确已变更的风格）。
  //   判据（机械可执行）：把候选的**当前**指纹与它的**历史**指纹（台账 `state.fp` + 基线
  //   `lib/style-fingerprints.json`，后者逐风格带 `hash`）比对 —— **有任一历史指纹不等、或一条
  //   历史指纹都没有 ⇒ 判「无法证明源码未变」⇒ 默认拒绝**，要显式 `--force` 才写。
  if (argv.includes('--backfill')) {
    // ★ `base` 已在本函数开头读好（供 ledgerGap 的可判定性用），此处**复用同一份**（行为与原先逐字一致）。
    const mp4Ok = (slug) => {
      const mp4 = path.join(FILM_DIR, slug, `${slug}.mp4`);
      return fs.existsSync(mp4) && fs.statSync(mp4).size >= 10000;
    };
    const targets = [...never, ...ledgerGap.map((g) => g.slug), ...noFilm]
      .filter(mp4Ok)
      .filter((s) => !OPT.only.length || OPT.only.includes(s))
      .filter((s) => (st.styles[s]?.fp || null) !== (fp.get(s) || null)); // 已经一致 ⇒ 无可写，剔除

    if (!targets.length) {
      console.log(`  --backfill：没有可补写的风格${OPT.only.length ? `（--only ${OPT.only.join(',')}）` : ''}。\n`);
      return { never, ledgerGap, changed, noFilm, fresh };
    }

    const short = (h) => (h ? `${String(h).slice(0, 10)}…` : '(无)');
    const judged = targets.map((slug) => {
      const cur = fp.get(slug) || null;
      const hist = [];
      const recFp = st.styles[slug]?.fp || null;
      if (recFp) hist.push({ src: '台账 state.fp', hash: recFp });
      const b = base?.styles?.[slug];
      if (b?.hash) hist.push({ src: '基线 style-fingerprints.json', hash: b.hash });
      const bad = hist.filter((h) => h.hash !== cur);
      const why = !hist.length ? '无历史指纹可比'
        : bad.length ? `与「${bad.map((h) => h.src).join('、')}」不一致`
          : `与「${hist.map((h) => h.src).join('、')}」一致`;
      return { slug, before: recFp, cur, hist, bad, safe: hist.length > 0 && bad.length === 0, why };
    });
    const unsafe = judged.filter((j) => !j.safe);

    console.log(`  --backfill 候选 ${judged.length} 个（已有成片${OPT.only.length ? `，--only 限定 ${OPT.only.join(',')}` : ''}）；历史指纹来源：台账 state.fp + 基线 lib/style-fingerprints.json`);
    if (base) console.log(`    基线 lastScanAt = ${base.lastScanAt || base.generatedAt || '未知'}（基线越旧，逐条「不一致」越可能只是陈旧，**本阀一律从严判**）`);
    for (const j of judged) {
      console.log(`    ${j.slug.padEnd(20)} 指纹 ${short(j.before).padEnd(12)} → ${short(j.cur).padEnd(12)} ${j.safe ? '✓ 可证未变' : `✘ ${j.why}`}`);
    }

    if (unsafe.length && !OPT.force) {
      console.log('');
      console.log(`  ✘ 拒绝写入（${unsafe.length}/${judged.length} 个候选**无法证明源码未变**）—— **这会洗白源码变更**：`);
      console.log('    补写的是**当前**指纹 ⇒ 这些风格的源码若自上次成功出片后已变，补写后 `plan` 再也报不出该变更。');
      const noHist = unsafe.filter((j) => !j.hist.length).map((j) => j.slug);
      const mis = unsafe.filter((j) => j.hist.length).map((j) => j.slug);
      if (noHist.length) console.log(`    · 无历史指纹可比（台账 fp 为 null）：${noHist.join(', ')}`);
      if (mis.length) console.log(`    · 与历史指纹不一致：${mis.join(', ')}`);
      console.log('    ⇒ 确认要写：`--backfill --force`；只补可证未变的那些：`--backfill --only <slug,…>`。');
      console.log('    ★ 本次**未写盘**（state.json 未改）。\n');
      return { never, ledgerGap, changed, noFilm, fresh };
    }

    let n = 0;
    for (const j of judged) {
      st.styles[j.slug] = { ...(st.styles[j.slug] || {}), fp: j.cur, fpBackfilledAt: new Date().toISOString() };
      n++;
    }
    saveState(st);
    console.log(`\n  ${unsafe.length && OPT.force ? '★ --force 已生效：' : ''}已为 ${n} 个风格补写源码指纹（state.json 已更新）。\n`);
  }
  return { never, ledgerGap, changed, noFilm, fresh };
}

function run(cmd, args, { cwd, timeoutMs = 1800000, logFile } = {}) {
  return new Promise((resolve) => {
    const out = fs.openSync(logFile, 'a');
    const child = spawn(cmd, args, { cwd, windowsHide: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
    let tail = '';
    const keep = (b) => { const s = b.toString('utf8'); fs.writeSync(out, s); tail = (tail + s).slice(-4000); };
    child.stdout?.on('data', keep);
    child.stderr?.on('data', keep);
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); fs.closeSync(out); resolve({ code: -1, tail, error: String(e.message || e) }); });
    child.on('close', (code) => { clearTimeout(timer); fs.closeSync(out); resolve({ code, tail }); });
  });
}

// ── render：顺序出片 ──────────────────────────────────────────
async function doRender() {
  const slugs = pickSlugs();
  const st = loadState();
  fs.mkdirSync(LOGS, { recursive: true });

  console.log(`\n顺序出片：${slugs.length} 个风格（${OPT.skipSync ? '--skip-sync' : '含库同步'}）\n`);
  let first = true;
  const t00 = Date.now();

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const tag = `[${String(i + 1).padStart(2, '0')}/${slugs.length}]`;
    const mp4 = path.join(FILM_DIR, slug, `${slug}.mp4`);
    const prev = st.styles[slug] || {};

    if (!OPT.force && prev.render === 'ok' && fs.existsSync(mp4) && fs.statSync(mp4).size > 10000) {
      console.log(`${tag} ${slug}  —— 跳过（已有成片 ${(fs.statSync(mp4).size / 1048576).toFixed(1)}MB）`);
      continue;
    }

    // 第一个风格默认带上库同步（确保 WSL→Windows 的字体/素材齐），之后 --skip-sync 省时间
    const skipSync = OPT.skipSync || (!first && !OPT.skipSync);
    const args = ['lemo-make.mjs', slug];
    if (OPT.skipSync || !first) args.push('--skip-sync');
    // ★★ 2026-10-04 修：**必须显式传原生比例 16:9**，不能落编排器的产品默认 9:16。
    //   原因（实测踩过）：编排器 `--ratio` 的默认是 **9:16**（那是给「交付」的产品默认），
    //   而这里产出的是**风格样板片**，全库原生是 **1920×1080**。
    //   不传 ⇒ 10 个重渲的风格被渲成 1080×1920，其中 **9 个风格源码里根本没有 `aspects` 声明**
    //   （本库语义：`FILM_META.aspects` **不写 = 只支持 16:9**，见 `engraving/demo/film.js:35-39`）
    //   ⇒ 渲出了**该风格并不支持**的画幅（画面按 9:16 排不出来）。原本 43 部里 33 部是 1920×1080，
    //   只有被本脚本重渲的那 10 部变成了 1080×1920 —— 一套样板片画幅不一致。
    //   ⇒ 样板片一律 16:9；要出 9:16 交付片是**另一条通路**（控制台/`--ratio 9:16`）。
    args.push('--ratio', '16:9');
    args.push('--no-preflight', ...OPT.extra);
    first = false;

    const logFile = path.join(LOGS, `${slug}.log`);
    fs.writeFileSync(logFile, `# ${new Date().toISOString()}  node ${args.join(' ')}\n`, 'utf8');
    const t0 = Date.now();
    process.stdout.write(`${tag} ${slug}  … 渲染中（日志 ${path.basename(logFile)}）`);
    const r = await run(process.execPath, args, { cwd: ROOT, logFile });
    const ms = Date.now() - t0;
    const okMp4 = fs.existsSync(mp4) && fs.statSync(mp4).size > 10000;
    const status = (r.code === 0 && okMp4) ? 'ok' : 'failed';

    st.styles[slug] = {
      ...prev,
      render: status,
      renderMs: ms,
      renderAt: new Date().toISOString(),
      exitCode: r.code,
      mp4: okMp4 ? mp4 : null,
      mp4Bytes: okMp4 ? fs.statSync(mp4).size : 0,
      renderLog: logFile,
      renderErr: status === 'failed' ? (r.error || r.tail.split('\n').filter(Boolean).slice(-6).join(' | ')) : null,
      // ★ 蒸馏时的源码指纹 —— `plan` 靠它发现「新风格 / 源码改过的风格」
      // ★★ 2026-10-04 修：**只在渲染成功时写**。此前是**无条件写** ⇒ 渲染**失败**也把「当前指纹」
      //   记成「已蒸馏」，于是 `plan` 把失败报成「已蒸馏且未变」—— **失败对 plan 不可见**，
      //   而成片其实仍是旧源渲的。实测：10 风格重渲首轮有 4 个失败（音频链问题），
      //   跑完 `plan` 仍报「待处理 0」，是靠读渲染汇总才发现失败的。
      // ★★ 2026-10-06 订正：失败时记 `null` 的含义是「**上次出片失败**」，**不是**「未蒸馏」。
      //   旧版 `plan` 把二者混为一谈 ⇒ 把 21 个**产物齐全**的风格印成「未蒸馏（新纳入）」。
      //   现在 `plan` 按**产物存在性**分流，`fp:null` 落进「台账缺指纹」这一类 —— 它**未决**：
      //   台账里没有可比指纹 ⇒ 无法判定源码是否变更（见 doPlan 的 artifactsOf / ledgerGap / baseVerdict）。
      fp: status === 'ok' ? ((await currentFingerprints()).get(slug) || null) : null,
    };
    saveState(st);

    console.log(status === 'ok'
      ? `  ✔ ${(ms / 1000).toFixed(1)}s  ${(st.styles[slug].mp4Bytes / 1048576).toFixed(1)}MB`
      : `  ✘ ${(ms / 1000).toFixed(1)}s  exit=${r.code}  ${String(st.styles[slug].renderErr).slice(0, 200)}`);
  }

  // ★★ 2026-10-04 修（措辞自相矛盾）：分子原先统计的是 **全库** `st.styles` 里 `render==='ok'` 的条数，
  //   而分母是**本次选择**的风格数 ⇒ 会打出 `ok 40 / 10`（第 2 轮实测甚至 `ok 43 / 3`），
  //   读起来像「10 个里成功了 40 个」。⇒ 分子现在只数**本次选择的**那些。
  //   ★ 同时**点名失败项**：本脚本「失败不阻断」是设计（继续跑完其余），但「不阻断」不该等于「看不见」——
  //   实测发生过「4 个失败、`plan` 仍报待处理 0」的静默（失败会写指纹，见上面 fp 的说明）。
  const sel = slugs.filter((s) => st.styles[s]);
  const ok = sel.filter((s) => st.styles[s].render === 'ok').length;
  const bad = slugs.filter((s) => !st.styles[s] || st.styles[s].render !== 'ok');
  console.log(`\n出片汇总：ok ${ok} / ${slugs.length}，总耗时 ${((Date.now() - t00) / 60000).toFixed(1)} 分钟`);
  if (bad.length) {
    console.log(`  ✘ 未成功 ${bad.length} 个：${bad.join(', ')}`);
    console.log('    （失败不阻断是设计，但请**逐条看上面的错误**；重跑用 `--only <这些slug>`）');
  }
  console.log('');
}

// ── frames：抽帧 + 接触印样 ────────────────────────────────────
// 逐帧「一帧一帧」地看 43 部片子不现实（成片 30fps × 几十秒 = 上千帧），
// 所以分两层：① 等间隔抽 24 帧单图（够做逐帧细节核对）；② 拼一张接触印样（一眼看全片节奏）。
async function doFrames() {
  const slugs = pickSlugs();
  const st = loadState();
  let done = 0;
  for (const slug of slugs) {
    const mp4 = path.join(FILM_DIR, slug, `${slug}.mp4`);
    if (!fs.existsSync(mp4)) { console.log(`  ${slug} —— 没有成片，跳过`); continue; }
    const dir = path.join(FRAMES, slug);
    const sheet = path.join(dir, '_contact.jpg');
    if (!OPT.force && fs.existsSync(sheet)) { done++; continue; }
    fs.mkdirSync(dir, { recursive: true });

    // ① 等间隔 24 帧（按片长自动算 fps）
    const dur = await probeDur(mp4);
    const n = 24;
    const fps = dur > 0 ? Math.max(0.05, n / dur) : 1;
    let r = await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-i', mp4,
      '-vf', `fps=${fps.toFixed(4)},scale=360:-2`, '-q:v', '3',
      path.join(dir, 'f%02d.jpg')], { logFile: path.join(LOGS, `${slug}.frames.log`) });
    // ② 接触印样：6×4
    r = await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-i', mp4,
      '-vf', `fps=${fps.toFixed(4)},scale=320:-2,tile=6x4`, '-frames:v', '1', '-q:v', '3', sheet],
      { logFile: path.join(LOGS, `${slug}.frames.log`) });

    const nFrames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg') && !f.startsWith('_')).length;
    st.styles[slug] = { ...(st.styles[slug] || {}), frames: nFrames > 0 ? 'ok' : 'failed', framesDir: dir, frameCount: nFrames, durSec: dur };
    saveState(st);
    if (nFrames > 0) done++;
    console.log(`  ${slug}  ${dur.toFixed(1)}s → ${nFrames} 帧 + 接触印样  ${nFrames > 0 ? '✔' : '✘'}`);
  }
  console.log(`\n抽帧汇总：${done}/${slugs.length}\n`);
}

function probeDur(mp4) {
  return new Promise((resolve) => {
    const c = spawn(FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe'),
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { windowsHide: true });
    let o = '';
    c.stdout.on('data', (d) => { o += d; });
    c.on('close', () => resolve(Number(String(o).trim()) || 0));
    c.on('error', () => resolve(0));
  });
}

// ── status ────────────────────────────────────────────────────
function doStatus() {
  const st = loadState();
  const all = allSlugs();
  const rows = all.map((s) => ({ slug: s, ...(st.styles[s] || {}) }));
  const nRenderOk = rows.filter((r) => r.render === 'ok').length;
  const nFramesOk = rows.filter((r) => r.frames === 'ok').length;
  console.log(`\n风格总数 ${all.length}  |  出片 ok ${nRenderOk}  |  抽帧 ok ${nFramesOk}`);
  console.log(`state: ${STATE}  (updated ${st.updated || 'never'})\n`);
  for (const r of rows) {
    const mark = r.render === 'ok' ? '✔' : r.render === 'failed' ? '✘' : '·';
    const f = r.frames === 'ok' ? `${String(r.frameCount).padStart(2)}帧` : '  --';
    const sec = r.durSec ? `${r.durSec.toFixed(1)}s` : '   --';
    const mb = r.mp4Bytes ? `${(r.mp4Bytes / 1048576).toFixed(1)}MB` : '  --';
    console.log(`  ${mark} ${r.slug.padEnd(20)} ${f} ${sec.padStart(7)} ${mb.padStart(8)}${r.renderErr ? '   ' + String(r.renderErr).slice(0, 90) : ''}`);
  }
  console.log('');
}

// ── main ──────────────────────────────────────────────────────
if (CMD === 'render') await doRender();
else if (CMD === 'frames') await doFrames();
else if (CMD === 'plan') await doPlan();
else if (CMD === 'status') doStatus();
else { console.log('用法: node scripts/style-distill.mjs plan|render|frames|status [--force] [--only a,b]'); process.exit(2); }
