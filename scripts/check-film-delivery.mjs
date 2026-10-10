#!/usr/bin/env node
/**
 * scripts/check-film-delivery.mjs —— 43 部成片的**交付口径闸门**（文档声称值 vs 实测值）
 *
 * ★ 为什么需要它（2026-10-03 立）：
 *   本轮连踩两个「文档与实物不一致」的坑，都是**静默**的：
 *     ① `fix-truepeak.mjs` 把真峰值写到了 `generatedVideo.truePeakDbtp` —— 该字段不存在，
 *        更新成了空操作 ⇒ json 仍记 +1.73、`peakTargetMet:false`，而正文已写「已修」。
 *     ② 2 个 mux 脚本被插进多行 ffmpeg 命令中间 ⇒ `\` 续行被 `#` 注释吃掉，命令截断。
 *        `sh -n` **查不出来**（不是语法错），只有真跑才发现 `sh: -af: command not found`。
 *   ⇒ 结论：**「文档说了什么」必须与「实测是什么」机械比对**，不能靠人记得去核对。
 *
 * 查这些（逐条与实测对照）：
 *   A. 音频口径：`selfCheck.loudness` 的 `truePeakDbtp` / `integratedLufs` / `lra`
 *      —— 真峰值/响度与 `loudnorm` 的 `input_tp`/`input_i` 实测比对；
 *      ★ **LRA 的口径是 `ebur128`**（项目约定），而 `loudnorm` 的 `input_lra` 系统性偏大
 *        （实测同一片：ebur128 6.0 vs loudnorm 8.20）—— 所以 LRA 只要求**与两个来源之一匹配**
 *        （历史记录里两种都有），两个都对不上才算不符。
 *   B. `peakTargetMet` 必须 == (真峰值 ≤ −1.2)
 *   C. 视频口径：`generatedVideo` 的 `width`/`height`/`fps`/`frames`/`durSec`/`bytes` 与 `ffprobe`/磁盘比对
 *      ★ 另判**实测响度**是否真的落在交付线 −14 LUFS 附近（容差 1.0 LU）—— 见下方 C 响度条。
 *   D. 容器健康：`pix_fmt` 必须是 `yuv420p`；音频流与视频流时长差 ≤ 0.1s；`moov` 在 `mdat` 之前（faststart）；
 *      音频码率落在 200–300 kbps
 *   E. ★ 交付脚本「更早的闸门」（2026-10-05 补；同日**扩展**）：**每一个自己做音频归一的交付脚本**都必须仍带着
 *      「编码后复核闭环」（`LEMO_LN_TP_STEP` / `LEMO_LN_TP_TRIES` / 用 loudnorm `input_tp` 判 −1.2），
 *      且默认 `LN_TP` 起点落在**保响度区间** [−2.0, −1.2]。范围：
 *        · `core/render/mux.sh`（回退路径，可用 `LEMO_MUX_SH` 覆盖，供变异验证）；
 *        · **风格自带的 `mux.sh`**（`styles/<slug>/demo/tools/mux.sh` → `styles/<slug>/demo/mux.sh`，取第一个存在的）——
 *          ★ 判据是「**有没有 `LN_TP=` 赋值**」：有 = 它自己在做音频归一 ⇒ 必须带闭环；
 *          没有（`pictogram-motion` / `woodcut`）= 不做音频归一（另一套架构 / 委托 core），**不要求**（见下方 E 段注释）。
 *      理由：A/B/C 只查 `_distill.json` **声明的成片**，
 *      看不见「交付脚本被改成会让**未来重渲**越窗的配置」。详见文件内 E 段注释。
 *      ★ 同日**再扩展**（E4/E5）：闭环的**参数区间**也必须守住 ——
 *        · **E4 档数上限下界**：`LEMO_LN_TP_TRIES` 默认值必须 ≥ 6；
 *        · **E5 起点上界**：`LEMO_LN_TP` 默认值必须 ≤ −1.7（不能比 −1.7 更接近 0）。
 *        依据是**非单调**实测（见文件内 E4/E5 注释）：`halftone-dossier` / `shadow-puppet` 的成片真峰值对 TP 目标
 *        不单调，**只有把 8 档都试完**才落到达标档；档数被调小或起点被抬高，就会「取不到双达标档」退化成越窗产出。
 *      ★ 同日**再补**（E6 · **可达下限**）：E4/E5 各自钳住「档数」「起点」两个因子，却漏了第三个因子 ——
 *        **步长** `LEMO_LN_TP_STEP`（E 类此前只用 CLOSURE_MARKS 确认它存在，从不看它的值）。
 *        闭环真正能试到的最深一档 = **起点 − 步长 × (档数 − 1)**，三个因子缺一不可；E6 判这个**乘积**必须 ≤ −3.45。
 *        依据同上（见文件内 E6 注释）：把步长由 0.25 改小（如 0.05）时 E2/E4/E5 **全部放行**，
 *        而可达下限塌到 −1.95 ⇒ 实测退化成「打印两条口径无法同时满足 + 交出越窗成片（+0.10 dBTP，exit 0）」。
 *
 * ★ 失明守卫（2026-10-04 补）：`slugs` 为空（无 _distill.json / 路径变了）⇒ 一部成片都没查 ⇒ FAIL。
 *   ★ 2026-10-05 补：E4 的 `LEMO_LN_TP_TRIES` 默认值表达式若找不到（写法变了）⇒ 单独判 FAIL 并**明说「判据已失明」**。
 *   ★ 2026-10-05 再补：E6 的「起点 / 步长 / 档数」三个量任一抽不到 ⇒ 单独判 FAIL 并**明说「判据已失明」**。
 *   ★ 2026-10-06 再补（F 段）：成片不存在/读不到（拿不到 mtime）、文档 mtime 读不到 ⇒ 单独判 FAIL 并**明说「失明」**。
 *   ★ 2026-10-07 再补（F 段·计数式）：**全部让位**（`deferred.length === slugs.length`）⇒ `judged = 0`
 *     ⇒ 旧版打印「✓ 被判的 0 部成片交付口径全部一致」+ exit 0（**一部都没判**、且每条本会报的错都被
 *     「若不是疑似重渲，本会报」吞掉）⇒ 现判 FAIL 并明说「一部成片都没判」。F 段让位**保留**（有意），只加计数守卫。
 *
 * ★★ F 重渲窗口守卫（2026-10-06 补）—— 修「**批量出片期间必红**」这个设计缺陷
 *   缺陷（已实证）：A/B/C/D 判的是「**文档声称值 vs 磁盘实测**」。而**每日批量出片会重渲成片**，
 *   文档要等批次跑完才由 `refresh-style-skill.mjs` 回填 ⇒ 在「**成片已重写、文档还没回填**」的窗口里，
 *   这些「不一致」**不是回归**。实证（2026-10-06，本闸门曾报 **exit 1 / 23 处 / 12 部**），两路独立证明不是回归：
 *     ① 用**改前**的 `mux.sh` 复跑（`LEMO_MUX_SH` 指向旧脚本）⇒ 输出与改后**逐字节相同**（同样 23 处 A/C 类）；
 *     ② 23 处**全是**「文档值 vs 磁盘实测」，且 12 部**全部**落在当日 09:04–09:33 的重渲名单里
 *        （成片 mtime 新于文档 mtime，文档还停在 10-04/10-05）⇒ 是**日批正在重渲导致文档过期**。
 *   ⇒ 结果：批量期间它不能当回归判据（谁看都以为是坏了）。
 *   判据（机械、可解释）—— 必要条件 **成片比文档新**（文档**按定义**没描述当前成片，不能拿它判漂移）：
 *     `defer = (film.mtime > _distill.json.mtime)` **且**下列**任一**成立：
 *       · **成片很新**：`now − film.mtime ≤ DEFER_FRESH_MS`（15 min）—— 刚渲完，回填可能还在路上；
 *       · **该 slug 的并发锁活着**：`<LOCK_DIR>/.<slug>.lock` 存在且按**编排器自己的判据**算活着 ——
 *         逐字复用 `lemo-make.mjs` 里那段锁活性判据（`try { process.kill(oldPid, 0); … }` + `ageMs < 6 * 3600 * 1000`；★ 2026-10-07 原写 `lemo-make.mjs:1767-1771`、行号已漂 ⇒ 改符号锚）：「锁里记的 pid 仍存在（`process.kill(pid,0)` 成功或 EPERM）
 *         且锁龄 < 6h」。这是**最准的 per-slug 信号**：批次每渲一个风格就建这个锁、渲完即删。
 *       · **批次在跑**：`_distill/render-run-*.log` / `_distill/state.json` / `_distill/logs/*.log`
 *         三者**最新 mtime 在 DEFER_ACTIVE_MS（10 min）内** —— 逐条对齐项目既有约定
 *         （`_distill/AGENT-BRIEF.md:423-428`「有没有并发批量作业」的探测法）。
 *   命中 ⇒ **不判 FAIL**，改报「疑似正在重渲，本次不判」，并把**本会报的每一条**列出来（可复核、不丢判据）。
 *   真漂移（**没有**上述信号、文档与成片**稳定地**不符）⇒ **照旧 FAIL** —— 这是最容易改坏的一条，
 *   已用**临时副本 + 覆盖点**造「稳定漂移」情形做过变异验证（见 `test/README.md` 本闸门那行）。
 *   ★ 已知局限（照实写，别当它是全知）：
 *     · 窗口是**时间**判据 ⇒ 窗口**内**无法区分，靠「下次再跑」收敛（真漂移是稳定条件，排空后必然重报）；
 *     · **批次在跑时**，与本次批次无关的**旧文档过期**也会一并让位（批次排空 10 min 后恢复判定）；
 *     · `ffmpeg` **进程**不作判据 —— 实测渲染跑在 **WSL 侧**，Windows 的 `tasklist` **看不见**它
 *       （`D:/lemo-opuscar` 侧由 `wsl.exe` 驱动）⇒ 只用**文件 mtime + 锁**，这两个跨两侧都可靠；
 *     · `.console-port` **不作判据** —— 它是控制台端口、**退出时不删**（`AGENT-BRIEF.md:429-430` 已记此坑），
 *       存在 ≠ 有作业在跑（实测它比批次多活了 21 min）。
 *
 * 用法：node scripts/check-film-delivery.mjs [--json]
 * 环境变量：
 *   LEMO_MUX_SH        交付混流脚本路径（默认 <OPUSCAR>/core/render/mux.sh）—— 供变异验证。
 *   LEMO_OPUSCAR       项目根（默认 D:/lemo-opuscar）—— 供 E 段把 styles/ 拷到临时目录做**非破坏性**变异验证。
 *   LEMO_DISTILL_ROOT  风格技能树（默认 D:/lemo-tools/lib/style-skills）—— F 段变异验证指向**临时副本**
 *                      （与 check-film-aspect.mjs / check-tp-prose.mjs 同名同义）。
 *   LEMO_BATCH_DIR     批次证据目录（默认 D:/lemo-tools/_distill）—— F 段变异验证指向临时目录。
 *   LEMO_LOCK_DIR      并发锁目录（默认 D:/lemo-films）—— 与 `lemo-make.mjs:1892` 同名同义。
 * 退出码：有 FAIL（或失明）→ 1；否则 0。
 *   ★「疑似正在重渲、本次不判」**不算 FAIL**（exit 0），但会**大声打印**并列出本会报的每一条 —— 别当成「通过」。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DIR = path.resolve(process.env.LEMO_DISTILL_ROOT || 'D:/lemo-tools/lib/style-skills');
const FF = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const FP = FF.replace(/ffmpeg\.exe$/, 'ffprobe.exe');
const AS_JSON = process.argv.includes('--json');

// ── ★★ F：重渲窗口守卫的常量与探测（2026-10-06 补；判据由来见头注释 F 段）──────────────
const BATCH_DIR = path.resolve(process.env.LEMO_BATCH_DIR || 'D:/lemo-tools/_distill');
const LOCK_DIR = path.resolve(process.env.LEMO_LOCK_DIR || 'D:/lemo-films');
const DEFER_FRESH_MS = 15 * 60 * 1000;    // 「成片很新」窗口
const DEFER_ACTIVE_MS = 10 * 60 * 1000;   // 「批次在跑」窗口（批次证据的最新 mtime）
// ★ 锁的「活着」判据**逐字对齐** `lemo-make.mjs:1899-1906`：pid 仍在 **且** 锁龄 < 6h。别自创阈值。
const LOCK_MAX_AGE_MS = 6 * 3600 * 1000;
const NOW = Date.now();

// 容差（实测口径的固有波动）
const TOL_TP = 0.15;      // dB
const TOL_LUFS = 0.35;    // LU
const TOL_LRA = 0.8;      // LU
// ★ 交付线（真峰值上限）。**唯一来源**：A/B/C 三处判据都引用它，别再写死字面量。
const PEAK_LIMIT = -1.2;  // dBTP
// ★ 交付线（响度）。**唯一来源** = 本项目交付线 **−14 LUFS**（与 check-loudness-targets.mjs 同源）。
//   容差取 1.0 LU —— ★ 实测 2026-10-04：43 部成片的 integratedLufs 落在 −14.73 ~ −13.80（最大偏离 0.73），
//   故取 1.0；**不要取 0.5**，那会误杀 5 部。
const LUFS_LINE = -14;
const LUFS_TOL = 1.0;     // LU
const TOL_DUR = 1.05;     // s（durSec 记的是整数秒）
const TOL_ABR_LO = 200e3, TOL_ABR_HI = 300e3;

const run = (bin, args) =>
  new Promise((res) => {
    const p = spawn(bin, args);
    let o = '', e = '';
    p.stdout.on('data', (d) => (o += d));
    p.stderr.on('data', (d) => (e += d));
    p.on('error', (err) => res({ c: -1, o, e: String(err.message) }));
    p.on('close', (c) => res({ c, o, e }));
  });

const num = (t, k) => {
  const m = t.match(new RegExp(`"${k}"\\s*:\\s*"?(-?[0-9.]+)"?`));
  return m ? Number(m[1]) : null;
};

// ── ★★ F：探测（只读 mtime / 只读锁文件；不跑 ffmpeg、不看进程表 —— 理由见头注释 F 段「已知局限」）──
const mtimeOf = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return null; } };
const fmtAge = (ms) => `${(ms / 60000).toFixed(1)} min`;

/** 批次证据：**逐条对齐** `_distill/AGENT-BRIEF.md:423-428` 的「有没有并发批量作业」探测法（去掉 ffmpeg 那条）。 */
function batchProbe() {
  const newestIn = (dir, re) => {
    let best = null, bn = null;
    try {
      for (const f of fs.readdirSync(dir)) {
        if (re && !re.test(f)) continue;
        const m = mtimeOf(path.join(dir, f));
        if (m !== null && (best === null || m > best)) { best = m; bn = f; }
      }
    } catch { /* 目录不存在 ⇒ 该项无证据（不是失明：没有批次本来就是正常态） */ }
    return { best, bn };
  };
  const items = [
    ['批量总日志 render-run-*.log', newestIn(BATCH_DIR, /^render-run-.*\.log$/)],
    ['逐风格日志 logs/*.log', newestIn(path.join(BATCH_DIR, 'logs'), /\.log$/)],
    ['批次状态 state.json', { best: mtimeOf(path.join(BATCH_DIR, 'state.json')), bn: 'state.json' }],
  ];
  const hits = [];
  for (const [label, { best, bn }] of items)
    if (best !== null && NOW - best <= DEFER_ACTIVE_MS) hits.push(`${label}（${bn}，${fmtAge(NOW - best)} 前）`);
  return { hits, items };
}

/** 该 slug 的并发锁是否「活着」—— 判据逐字复用 `lemo-make.mjs:1899-1906`。无锁返回 null（正常态，非失明）。 */
function lockProbe(slug) {
  const p = path.join(LOCK_DIR, `.${slug}.lock`);
  const m = mtimeOf(p);
  if (m === null) return null;
  const age = NOW - m;
  let pid = NaN;
  try { pid = Number(fs.readFileSync(p, 'utf8').split('\n')[0]); } catch { /* 读不到 ⇒ 按「不活」处理 */ }
  let alive = false;
  if (Number.isInteger(pid) && pid > 0) {
    try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
  }
  return { p, pid, age, alive, live: alive && age < LOCK_MAX_AGE_MS };
}

const slugs = fs
  .readdirSync(DIR)
  .filter((s) => fs.existsSync(path.join(DIR, s, '_distill.json')))
  .sort();

const fails = [];
// ★★ F（2026-10-06）：`sink` 是可切换的收集器 —— 判一部成片时先收进**该片的本地桶**，
//   判完再决定「进 fails」还是「进 deferred（疑似正在重渲，本次不判）」。E 段（静态文本判据）恒用 `fails`。
let sink = fails;
const bad = (slug, kind, msg) => sink.push({ slug, kind, msg });

// ★ 失明守卫：一部成片都没被检查 ⇒ 闸门的「全部一致」结论是假的 ⇒ FAIL
if (slugs.length === 0) bad('(全部)', '✘ 失明', '0 部成片被检查（style-skills 下无 _distill.json / 路径变了？）');

const deferred = [];
const batch = batchProbe();

for (const slug of slugs) {
  const docPath = path.join(DIR, slug, '_distill.json');
  const docMs = mtimeOf(docPath);
  let film = null, filmMs = null;
  // ★★ F（2026-10-06）：这一片的 A/B/C/D 结果先收进**本地桶**，判完再决定「进 fails」还是「进 deferred」。
  const local = [];
  const prevSink = sink;
  sink = local;
  slugBody: {
    const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));
    const g = doc.generatedVideo || {};
    film = g.path;
    filmMs = film ? mtimeOf(film) : null;
    if (!film || filmMs === null) {
      // ★★ F 失明守卫（2026-10-06 补）：拿不到成片（不存在 / 读不到）⇒ **拿不到 mtime** ⇒
      //   既不能判「正在重渲」也不能判「漂移」⇒ **明说失明并 FAIL**，绝不静默放过。
      bad(slug, '✘ 失明·成片缺失',
        `成片不存在或读不到 ⇒ 拿不到 mtime，既不能判「正在重渲」也不能判「漂移」：${film}`);
      break slugBody;
    }
    if (docMs === null) {
      bad(slug, '✘ 失明·文档 mtime', `读不到文档 mtime ⇒ 无法判「文档是否已过期」：${docPath}`);
      break slugBody;
    }

    // ── A/B：音频口径 ──
    const { e } = await run(FF, ['-hide_banner', '-nostats', '-i', film,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
    const tp = num(e, 'input_tp'), lufs = num(e, 'input_i'), lraLn = num(e, 'input_lra');
    // LRA 的另一来源：ebur128（项目口径），与 loudnorm 的 input_lra 不同
    const { e: e2 } = await run(FF, ['-hide_banner', '-nostats', '-i', film, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const lraEb = (() => {
      const m = [...e2.matchAll(/^\s*LRA:\s*(-?[\d.]+)/gm)];
      return m.length ? Number(m[m.length - 1][1]) : null;
    })();
    const L = doc.selfCheck && doc.selfCheck.loudness;
    if (!L) bad(slug, 'A 音频口径', 'json 缺 selfCheck.loudness');
    else {
      if (tp === null) bad(slug, 'A 音频口径', '实测真峰值读不到');
      else if (Math.abs(L.truePeakDbtp - tp) > TOL_TP)
        bad(slug, 'A 真峰值不符', `文档 ${L.truePeakDbtp} vs 实测 ${tp}`);
      if (lufs !== null && L.integratedLufs !== undefined && Math.abs(L.integratedLufs - lufs) > TOL_LUFS)
        bad(slug, 'A 响度不符', `文档 ${L.integratedLufs} vs 实测 ${lufs}`);
      if (L.lra !== undefined && lraLn !== null) {
        const okEb = lraEb !== null && Math.abs(L.lra - lraEb) <= TOL_LRA;
        const okLn = Math.abs(L.lra - lraLn) <= TOL_LRA;
        if (!okEb && !okLn)
          bad(slug, 'A LRA 不符', `文档 ${L.lra} vs ebur128 ${lraEb} / loudnorm ${lraLn}`);
      }
      // ── B：peakTargetMet 自洽 ──
      if (tp !== null && L.peakTargetMet !== (tp <= PEAK_LIMIT))
        bad(slug, 'B peakTargetMet 反了', `文档 ${L.peakTargetMet}，实测 ${tp} dBTP`);

      // ── C：★ 实测真峰值**必须真的达标**（不只是「自洽」）──────────────
      // ★★ 2026-10-04 补（补一个**真空转绿灯**）：上面的 A 只判「文档值 vs 实测值」、B 只判
      //   「`peakTargetMet` 布尔与实测是否一致」—— **两条都不要求实测真的 ≤ 交付线**。
      //   实测发生过：一部真峰值 **−0.21 dBTP（超 −1.2 线）** 的成片在 **22 个闸门全绿**下存在过
      //   （`pictogram-motion` 重渲时 `--skip-audio` 复用旧 `mix.wav`，**冲掉了此前 fix-truepeak 的修复**）。
      //   ⇒ 「43 部交付口径全部一致」**≠**「43 部都达标」。这一条把「真的达标」钉死。
      if (tp !== null && tp > PEAK_LIMIT)
        bad(slug, 'C 真峰值超标', `实测 ${tp} dBTP > 交付线 ${PEAK_LIMIT} —— 跑 fix-truepeak.mjs --apply --only ${slug}`);

      // ── C：★ 实测响度**必须真的落在交付线 −14 LUFS 附近**（不只是「文档值 == 实测值」）──
      // ★★ 2026-10-04 补：上面 A 的响度条只做「文档值 vs 实测值」自洽比对 ⇒ 一部实测 −18 LUFS
      //   的成片，只要 json 如实记着 −18，A 也会绿 ⇒ **全库没有任何闸门真判响度达标**。
      //   这一条把「响度真的达标」钉死（容差 1.0 LU，依据见上方 LUFS_TOL 注释）。
      if (lufs !== null && Math.abs(lufs - LUFS_LINE) > LUFS_TOL)
        bad(slug, 'C 响度偏离交付线', `实测 ${lufs} LUFS，偏离交付线 ${LUFS_LINE} 超过 ${LUFS_TOL} LU`);
    }

    // ── C/D：视频与容器 ──
    const { o: probe } = await run(FP, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', film]);
    let j = null;
    try { j = JSON.parse(probe); } catch { bad(slug, 'D 容器', 'ffprobe 输出不可解析'); break slugBody; }
    const v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
    const a = (j.streams || []).find((s) => s.codec_type === 'audio') || {};
    const fmt = j.format || {};

    const fps = v.r_frame_rate ? (() => { const [x, y] = v.r_frame_rate.split('/').map(Number); return y ? +(x / y).toFixed(3) : x; })() : null;

    for (const [k, got] of [['width', v.width], ['height', v.height], ['fps', fps], ['frames', v.nb_frames ? Number(v.nb_frames) : null]]) {
      if (g[k] === undefined) bad(slug, 'C 字段缺失', `generatedVideo.${k} 未记录`);
      else if (got !== null && got !== undefined && Number(g[k]) !== Number(got))
        bad(slug, `C ${k} 不符`, `文档 ${g[k]} vs 实测 ${got}`);
    }
    if (Math.abs(Number(fmt.duration) - Number(g.durSec)) > TOL_DUR)
      bad(slug, 'C durSec 不符', `文档 ${g.durSec} vs 实测 ${Number(fmt.duration).toFixed(2)}`);
    if (Number(g.bytes) !== fs.statSync(film).size)
      bad(slug, 'C bytes 不符', `文档 ${g.bytes} vs 磁盘 ${fs.statSync(film).size}`);

    if (v.pix_fmt !== 'yuv420p') bad(slug, 'D pix_fmt', `${v.pix_fmt}（播放器兼容性）`);
    const vd = Number(v.duration || fmt.duration), ad = Number(a.duration || fmt.duration);
    if (Number.isFinite(vd) && Number.isFinite(ad) && Math.abs(vd - ad) > 0.1)
      bad(slug, 'D 音视频时长差', `视频 ${vd.toFixed(3)}s vs 音频 ${ad.toFixed(3)}s`);
    const abr = Number(a.bit_rate || 0);
    if (abr && (abr < TOL_ABR_LO || abr > TOL_ABR_HI)) bad(slug, 'D 音频码率', `${(abr / 1000).toFixed(1)} kbps`);
    // moov 是否在 mdat 之前（faststart）
    try {
      const fd = fs.openSync(film, 'r');
      const buf = Buffer.alloc(1024 * 1024);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);
      const head = buf.subarray(0, n).toString('latin1');
      const im = head.indexOf('moov'), id = head.indexOf('mdat');
      if (im < 0 || (id >= 0 && im > id)) bad(slug, 'D 未 faststart', `moov@${im} mdat@${id}`);
    } catch { /* 读不到就跳过 */ }
  }
  sink = prevSink;

  // ── ★★ F：重渲窗口判定（2026-10-06 补；判据由来与局限见头注释 F 段）──────────────
  // 必要条件：**成片比文档新**（`film.mtime > _distill.json.mtime`）—— 文档**按定义**没描述当前成片，
  //   不能拿它判漂移。文档比成片新 ⇒ 文档是在成片之后写的、本该描述它 ⇒ **任何不符都是真漂移**。
  // 再叠**任一**「正在重渲」证据：成片很新 / 该 slug 的并发锁活着 / 批次日志很新。
  // 三条都拿不到 ⇒ **照旧 FAIL**（真漂移不许被放走）。失明的片子（拿不到 mtime）不参与让位。
  const blind = local.some((f) => f.kind.startsWith('✘ 失明'));
  const lock = lockProbe(slug);
  const filmAge = filmMs === null ? null : NOW - filmMs;
  const newer = filmMs !== null && docMs !== null && filmMs > docMs;
  const why = [];
  if (newer) {
    if (filmAge <= DEFER_FRESH_MS) why.push(`成片 ${fmtAge(filmAge)} 前被写（≤ ${DEFER_FRESH_MS / 60000} min）`);
    if (lock && lock.live) why.push(`该 slug 的并发锁活着（${path.basename(lock.p)}，pid ${lock.pid}，锁龄 ${fmtAge(lock.age)}）`);
    if (batch.hits.length) why.push(`批次在跑（${batch.hits.join('；')}）`);
  }
  if (!blind && why.length) {
    deferred.push({ slug, film, filmAge: fmtAge(filmAge), docAge: fmtAge(NOW - docMs), why, wouldFail: local });
    continue;
  }
  fails.push(...local);
}

// ── ★★ F 计数式失明守卫（2026-10-07 补）：**全部让位** ⇒ 一部成片都没判 ⇒ FAIL ──────────────
//   F 段的让位（`:319` 的 `if (!blind && why.length) { deferred.push(...); continue; }`）是**有意的** ——
//   避免并发重渲期间误报（**不要删它**）。但若**每一部**成片都命中让位条件 ⇒
//   `judged = slugs.length − deferred.length = 0` ⇒ 旧版打印「✓ 被判的 0 部成片交付口径全部一致」
//   并 exit 0 —— **一部成片都没判过**，而且每条本会报的错都被「（若不是疑似重渲，本会报）」吞掉。
//   判据：让位数 == 成片总数 ⇒ 判 FAIL 并明说「一部都没判」。
//   （写法照 `check-skill-artifacts.mjs:157` 的「全部 SKIP」/ `check-config-vs-doc.mjs:308` 的
//     `noSec.length === cfg.styles.length` 同型守卫；此处 `sink` 已还原成 `fails` ⇒ `bad()` 落进 fails。）
//   ★ 为什么不给「部分让位」设阈值：让位是 **per-slug 的时序信号**（该片刚被写 / 该 slug 的锁活着 /
//     批次在跑），**有意**按片判定；部分让位时其余片子仍被**真判**（`judged ≥ 1`）⇒ 闸门没空转。
//     真实语料实测 43 部 **0 部**让位 ⇒ 部分让位的误报率**无样本可测** ⇒ 不设阈值（照「先测误报率」纪律）。
if (slugs.length > 0 && deferred.length === slugs.length)
  bad('(全部)', '✘ 失明·全部让位', `全部 ${slugs.length} 部成片都被判「疑似正在重渲」而让位 ⇒ 本次**一部成片都没判**`
    + `（F 段让位是有意的，但**全让位 = 闸门空转**，不能当通过）`);

// ── E：★ 交付脚本「更早的闸门」（2026-10-05 补；同日扩展：风格自带 mux.sh 一并纳入）────────
// 为什么需要它：上面的 A/B/C 都只查 `_distill.json` **声明的成片**（16:9 样板片）。
//   它们拦得住「已声明的成片被重渲坏掉」，却拦不住「**交付脚本本身**被改成一个会让**未来重渲**越窗的配置」——
//   那种片子还没渲出来，成片闸门自然看不见（正是本闸门立档时踩过的那类「静默失效」）。
// 实测教训：`core/render/mux.sh` 的 loudnorm TP 目标默认值一度从 −1.7 收紧到 −3.5（想给 AAC 留更多余量）。
//   峰值确实压住了，但**响度**被 loudnorm 的动态模式钳下去（高 LRA 的 mix 会放弃 linear 回落 dynamic）：
//   实测 silkscreen-poster 成片 **−16.05 LUFS**、shadow-puppet **−15.42 LUFS**，双双出了 −14±1 的窗。
//   ⇒ 固定值留余量顾此失彼：脚本已改为「−1.7 起步 + 编码后复核闭环」（不达标就逐档下调 TP 重编，只重做音频）。
//   这条闸门把「脚本必须仍带着那个闭环、且起点仍在保响度的区间」钉死，防止有人再把默认值调回一个牺牲响度的值
//   （或把闭环整段删掉）。
// ★★ 2026-10-05 扩展：闭环**只在 core 里**是不够的 —— 实测有 10 个**风格自带** `mux.sh` 各自做音频归一
//   （`LN_TP="${LEMO_LN_TP:--3.5}"`，且没有任何复测/重试），它们被编排器直接挑中（不走 core）。
//   这些静态留余量的脚本同样会「要么峰值越线、要么响度出窗」，所以本闸门对**每一个自己做音频归一的交付脚本**都判。
//   纳入规则（见下面 withLnTp 的判据）：**有 `LN_TP=` 赋值** ⇒ 它在做音频归一 ⇒ 必须带闭环；
//   **没有** ⇒ 不做音频归一，**不要求** —— 实测：
//     · `pictogram-motion/demo/mux.sh` 直接 `-c:a aac -b:a 320k`（音乐/音效已在 `music/music.py` 里混好并定好电平，
//       全程没有 loudnorm）⇒ 它没有「TP 目标」这个概念，硬塞一个闭环等于给它装一个不需要的音频链；
//     · `woodcut/demo/tools/mux.sh` 先 `sh core/render/mux.sh`（闭环在 core 里）再 `-c:a copy` 复用音频
//       （音频流逐字节来自 core 的产出）⇒ 它**继承** core 的闭环，自己不该重复实现。
//   失明守卫：风格里一个带 `LN_TP=` 的都没扫到 ⇒ 判 FAIL（路径/写法变了，别静默绿灯）。
// 判据（只读文本，不跑渲染；对 **WIN 副本** 判，两份副本是否同步由 check-dual-copy-sync.mjs 单独守卫）：
//   E1 脚本可读；`LN_TP` 仍是 `${LEMO_LN_TP:-X}` 形式（可覆盖 —— 硬编码会让「调余量」的实验变成空操作）。
//   E2 默认起点 X 落在保响度区间 [MUX_TP_LO, MUX_TP_HI] = [−2.0, −1.2]：
//        · 比 −1.2 松（如 −1.0）⇒ 不给 AAC 过冲留余量，成片峰值容易越线；
//        · 比 −2.0 紧（如 −3.5）⇒ 高 LRA 风格的响度会被钳出窗。实测 silkscreen-poster（mix LRA 12.20）：
//          TP −2.0 → 成片 −14.88 LUFS ✓；TP −2.1 → −15.00（贴边）；TP −3.5 → −16.05 ✗。
//          实测 shadow-puppet（mix 真峰值 +1.30 dBTP、LRA 10.60）：TP −3.5 → 成片 −15.42 LUFS ✗；
//          −1.7 起步 + 闭环 → 6 档后 −14.94 LUFS / 真峰值 −1.42 dBTP ✓。
//   E3 闭环三件套仍在：`LEMO_LN_TP_STEP` / `LEMO_LN_TP_TRIES` / 用 loudnorm `input_tp` 判 −1.2 的复核。
//   E4 ★（2026-10-05 补）档数上限下界：`LN_TP_TRIES="${LEMO_LN_TP_TRIES:-N}"` 的默认 N **必须 ≥ 6**。
//        理由见上方 MUX_TRIES_MIN 注释（halftone-dossier 需 8 档才转负 ⇒ 6 是保守下界）。
//        ★ 失明守卫：抽不到该默认值表达式（写法变了）⇒ 单独判 FAIL 并**明说「判据已失明」**，不静默放行。
//   E5 ★（2026-10-05 补）起点上界：`LN_TP` 默认起点 **必须 ≤ −1.7**（不能比 −1.7 更接近 0）。
//        ★ 与 E2 的协调（不重复、不冲突）：E2 判的是**区间** [MUX_TP_LO, MUX_TP_HI] = [−2.0, −1.2]，
//        E5 只是把**上界**从 −1.2 收紧到 −1.7。为避免同一条违规被两条判据各报一次，E5 **只在窄带
//        (−1.7, −1.2] 里报**（即 E2 已放行、但 E5 该拦的那段）；`> −1.2` 仍由 E2 的「越界」报（E5 不重复报）。
//        两者合起来恰好等价于「起点 ∈ [−2.0, −1.7]」，无重复、无冲突。
//        ★ 起点表达式抽不到时由 E1 报（见上，已明说判据失明）—— 不会静默放行。
//   E6 ★（2026-10-05 补）**可达下限**：`起点 − 步长 × (档数 − 1)` **必须 ≤ −3.45**。
//        ★ 为什么 E4/E5 不够（这条守卫**真正**要守的性质）：闭环能试到的最深一档是三个因子的**乘积**，
//        E4 只看「档数 ≥ 6」、E5 只看「起点 ≤ −1.7」，**两个都没看步长** `LEMO_LN_TP_STEP`
//        （E 类此前只用 CLOSURE_MARKS 确认它「存在」，从不看它的值）。于是存在一条**全绿通道**：
//        把步长由 0.25 改小到 0.05（起点 −1.7、档数 6 都不动）⇒ E2/E4/E5 全部放行，
//        而可达下限只有 −1.95 ⇒ 实测 6 档全部落在平台期、取不到达标档 ⇒ 越窗产出（见下 E6 注释的实测）。
//        ★ 判的是**关系**（不是把 −1.7 / 0.25 / 8 写死）⇒ 保留「三个量都可覆盖」的自由度：
//        `起点 −1.7 / 步长 0.25 / 档数 8`、`起点 −2.0 / 步长 0.25 / 档数 7`（可达下限 −3.5）……都能过，
//        只要**可达下限**够深。这正是「守住性质、不锁死实现」。
//        ★ 失明守卫：起点 / 步长 / 档数**任一**抽不到（写法变了）⇒ 单独判 FAIL 并**明说「判据已失明」**。
const OPUSCAR = process.env.LEMO_OPUSCAR || 'D:/lemo-opuscar';
const MUX_SH = process.env.LEMO_MUX_SH || path.join(OPUSCAR, 'core', 'render', 'mux.sh');
const MUX_TP_LO = -2.0, MUX_TP_HI = -1.2;
// ★★ E4/E5（2026-10-05 补）：闭环的**参数区间**守卫。为什么必须有 —— 实测证明成片真峰值对 TP 目标
//   **极不单调**，光有闭环（会重试）不够，还必须保证「**试得够多档**」且「**起点够低**」：
//     · halftone-dossier 实测 8 档（TP 目标 → 成片真峰值）：−1.7→+0.43、−1.95→+0.43、−2.2→+0.25、
//       −2.45→+0.25、−2.7→+0.25、−2.95→+0.25、−3.2→+0.19、**−3.45→−2.79**（只有**最后一档**才转负）；
//     · shadow-puppet 同样不单调：−2.2→+3.41、−2.7→+0.45、−2.95→−1.42。
//   ⇒ ① 若把 LEMO_LN_TP_TRIES 默认值调小（省编码次数，如 3/5）⇒ 取不到那个「转负档」⇒ 退化成「只打印警告」的
//        越窗产出（halftone-dossier 实测在起点 −1.0 + 8 档时正是如此）。
//      ⇒ E4：默认档数必须 ≥ 6（halftone 需 8 档才达标 ⇒ 6 是保守下界，既守住又给「省次数」留了余量）。
//      ⇒ ② 若把 LEMO_LN_TP 起点往上调（更接近 0）⇒ 可达区间整体上移、同样取不到达标档。
//      ⇒ E5：默认起点必须 ≤ −1.7（−1.7 是实测能覆盖这些风格的值）。
const MUX_TRIES_MIN = 6;      // LEMO_LN_TP_TRIES 默认值下界（档）
const MUX_TP_MAX_START = -1.7; // LEMO_LN_TP 默认值上界（比 −1.7 更接近 0 即 FAIL）
// ★★ E6（2026-10-05 补）：**可达下限**守卫 —— 闭环能试到的最深一档 = 起点 − 步长 × (档数 − 1)。
//   为什么必须有（E4/E5 漏掉的那个因子）：E4 钳「档数」、E5 钳「起点」，**都不看步长**
//   `LEMO_LN_TP_STEP`；而「能不能试到达标档」由三者的**乘积**决定。实测（2026-10-05，
//   `styles/halftone-dossier/demo/out/video_gpu.mp4` + `demo/mix.wav`，`sh core/render/mux.sh <V> <A> <out> 24 0`）：
//     · 默认（起点 −1.7 / 步长 0.25 / 8 档 ⇒ 可达下限 −3.45）：
//         −1.7 → (I −14.02, TP +0.10)、−1.95 → (−14.02, +0.10)、−2.20 → (−14.21, **−2.04**) ⇒ 第 3 档达标，产出正常；
//     · 起点上调到 −1.0（可达下限 −2.75）：−1.0…−2.00 五档全在平台期 (+0.10)，第 6 档 −2.25 → (−14.21, −2.21) ⇒ 仍达标；
//     · **可达下限过浅**（起点 −1.7 / 步长 0.05 / 6 档 ⇒ 可达下限 −1.95，**E2/E4/E5 全部放行**）：
//         −1.7…−1.95 六档**全是 (I −14.02, TP +0.10)** ⇒ 取不到达标档 ⇒ mux.sh 打印
//         「the two delivery lines cannot BOTH be met」并交出**越窗**成片（真峰值 +0.10 dBTP > 交付线 −1.2），
//         而且 **exit 0** —— 只查成片的 A/B/C 看不见，正是本闸门要拦的「静默失效」。
//     · 更硬的历史实测（本闸门 E4/E5 依据的那组）：halftone-dossier 曾**只有第 8 档（TP 目标 −3.45）**
//       才把成片真峰值压到 −2.79（前 7 档全在 +0.19~+0.43）；shadow-puppet 亦非单调
//       （−2.2→+3.41、−2.7→+0.45、−2.95→−1.42）。
//   ⇒ 阈值取 −3.45：它**既是默认参数的实际可达下限**（−1.7 − 0.25×7），**又是实测出现过的最深需求**
//     （halftone-dossier 的转负档）。任何把可达下限抬浅的改动（抬起点 / 缩档数 / 缩步长）都会被拦。
const MUX_FLOOR_MAX = -3.45;   // 可达下限（起点 − 步长×(档数−1)）的上界；比它浅即 FAIL
const FLOOR_EPS = 1e-9;        // 浮点余量：−1.7 − 0.25×7 在 IEEE754 下正好落在阈值上，别让它误报
// ★ 用 \b 收尾：否则「LEMO_LN_TP_STEP_X」这种**改名**会照样命中（子串匹配），变异验证会假通过（实踩）。
const CLOSURE_MARKS = [
  ['LEMO_LN_TP_STEP', /LEMO_LN_TP_STEP\b/],
  ['LEMO_LN_TP_TRIES', /LEMO_LN_TP_TRIES\b/],
  ['loudnorm input_tp 复核', /input_tp/],
  ['交付线 -1.2', /-1\.2/],
];
/** 判一个「自己做音频归一」的交付脚本：LN_TP 可覆盖 + 起点在保响度区间 + 闭环三件套在 + 闭环可达下限够深。 */
function judgeDeliveryScript(label, text) {
  const m = text.match(/^\s*LN_TP="\$\{LEMO_LN_TP:-(-?[0-9.]+)\}"/m);
  if (!m) bad(label, 'E LN_TP', '找不到 `LN_TP="${LEMO_LN_TP:-…}"`（默认 TP 目标，且必须可被 LEMO_LN_TP 覆盖）—— 判据已失明：默认值写法变了？不能静默放行');
  else {
    const v = Number(m[1]);
    if (!(v >= MUX_TP_LO && v <= MUX_TP_HI))
      bad(label, 'E 默认 TP 起点越界', `LN_TP 默认 ${v}，应落在 [${MUX_TP_LO}, ${MUX_TP_HI}]（保响度区间，见本闸门 E 段注释）`);
    // ── E5 · 起点上界（2026-10-05 补）──────────────────────────────────────────
    // 与 E2 协调：E2 已判区间 [−2.0, −1.2]，E5 只把**上界**收紧到 −1.7；为避免重复报，E5 只在
    // E2 放行、而 E5 该拦的窄带 (−1.7, −1.2] 里报；`> −1.2` 交给 E2 的「越界」。见上方 E5 注释。
    if (v > MUX_TP_MAX_START && v <= MUX_TP_HI)
      bad(label, 'E5 起点上界过高',
        `LN_TP 默认 ${v} > ${MUX_TP_MAX_START}（比 ${MUX_TP_MAX_START} 更接近 0）：起点越高、可达区间越浅，`
        + `非单调风格（halftone-dossier / shadow-puppet）取不到达标档 ⇒ 越窗产出。实测 shadow-puppet 在起点 −1.0 附近即取不到双达标档`);
  }
  // ── E4 · 档数上限下界（2026-10-05 补）────────────────────────────────────────
  // 实测 halftone-dossier 需 8 档才把真峰值压到 −2.79（前 7 档全在 +0.19~+0.43，**只有最后一档转负**）、
  // shadow-puppet 亦非单调（−2.2→+3.41、−2.7→+0.45、−2.95→−1.42）⇒ 档数被调小就取不到达标档。
  // 6 是保守下界（既守住非单调风格、又给「省编码次数」留余量）。
  const mt = text.match(/^\s*LN_TP_TRIES="\$\{LEMO_LN_TP_TRIES:-(\d+)\}"/m);
  if (!mt)
    bad(label, 'E4 失明', '找不到 `LN_TP_TRIES="${LEMO_LN_TP_TRIES:-N}"` 的默认值表达式 —— 判据已失明：档数上限写法变了？不能静默放行');
  else if (!(Number(mt[1]) >= MUX_TRIES_MIN))
    bad(label, 'E4 档数上限过低',
      `LEMO_LN_TP_TRIES 默认 ${mt[1]} < ${MUX_TRIES_MIN}：实测 halftone-dossier 需 8 档才取到达标档`
      + `（8 档真峰值 −1.7→+0.43 … −3.2→+0.19、**−3.45→−2.79**，只有最后一档转负）、shadow-puppet 亦非单调`
      + `（−2.2→+3.41、−2.7→+0.45、−2.95→−1.42）⇒ 档数不足会取不到双达标档、退化成「只打印警告」的越窗产出`);
  // ── E6 · 可达下限（2026-10-05 补）────────────────────────────────────────────
  // 闭环能试到的最深一档 = 起点 − 步长 × (档数 − 1)。三个量**全部取自脚本的实际赋值**（不写死数字），
  // 判的是**关系** ⇒ 保留「三个量都可覆盖」的自由度，只守住「深度」这个真正的性质。见上方 MUX_FLOOR_MAX 注释。
  // ★ 三个量里 **步长** 是 E1~E5 都没看过的那个（CLOSURE_MARKS 只确认它存在）—— 这正是本条的立足点。
  const mStep = text.match(/^\s*LN_TP_STEP="\$\{LEMO_LN_TP_STEP:-([0-9.]+)\}"/m);
  const start = m ? Number(m[1]) : null;
  const step = mStep ? Number(mStep[1]) : null;
  const tries = mt ? Number(mt[1]) : null;
  const missing = [['起点', start], ['步长', step], ['档数', tries]].filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length)
    bad(label, 'E6 失明', `解析不出闭环的「${missing.join(' / ')}」—— 可达下限 = 起点 − 步长 × (档数 − 1) 需要这三个量，`
      + '判据已失明：默认值写法变了？不能静默放行'
      + '（期望 `LN_TP="${LEMO_LN_TP:-X}"` / `LN_TP_STEP="${LEMO_LN_TP_STEP:-X}"` / `LN_TP_TRIES="${LEMO_LN_TP_TRIES:-N}"`）');
  else {
    const floor = start - step * (tries - 1);
    if (floor > MUX_FLOOR_MAX + FLOOR_EPS)
      bad(label, 'E6 可达下限过浅',
        `闭环可达下限 ${floor.toFixed(2)} = 起点 ${start} − 步长 ${step} × (档数 ${tries} − 1)，比 ${MUX_FLOOR_MAX} 浅：`
        + '实测 halftone-dossier 只有 TP 目标 −3.45 那一档才把成片真峰值压到 −2.79（前 7 档全在 +0.19~+0.43）、'
        + 'shadow-puppet 亦非单调（−2.2→+3.41、−2.7→+0.45、−2.95→−1.42）；'
        + '可达下限不够深 ⇒ 取不到双达标档 ⇒ mux.sh 打印「两条口径无法同时满足」并交出**越窗**成片'
        + '（实测 起点 −1.7 / 步长 0.05 / 6 档 ⇒ 可达下限 −1.95 ⇒ 六档全 +0.10 dBTP，且 exit 0）');
  }
  for (const [lbl, re] of CLOSURE_MARKS) if (!re.test(text)) bad(label, 'E 闭环缺失', `脚本里找不到「${lbl}」—— 编码后复核闭环被删了？`);
}
{
  // ① core（回退路径）
  let mux = null;
  try { mux = fs.readFileSync(MUX_SH, 'utf8'); } catch { /* 读不到下面报 */ }
  if (mux == null) bad('(mux.sh)', 'E 交付脚本', `读不到 ${MUX_SH}`);
  else judgeDeliveryScript('(core mux.sh)', mux);

  // ② 风格自带的 mux.sh（取 tools/ 优先，与编排器的挑选顺序一致）
  const stylesRoot = path.join(OPUSCAR, 'styles');
  const withLnTp = [], noLnTp = [];
  if (fs.existsSync(stylesRoot)) {
    for (const e of fs.readdirSync(stylesRoot, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('_')) continue;
      for (const rel of ['demo/tools/mux.sh', 'demo/mux.sh']) {
        const p = path.join(stylesRoot, e.name, rel);
        if (!fs.existsSync(p)) continue;
        let t = null;
        try { t = fs.readFileSync(p, 'utf8'); } catch { /* 读不到就跳过 */ }
        if (t == null) break;
        const rec = { slug: e.name, p, rel: `styles/${e.name}/${rel}`, text: t };
        if (/^\s*LN_TP="/m.test(t)) withLnTp.push(rec); else noLnTp.push(rec);
        break;
      }
    }
  }
  if (withLnTp.length === 0)
    bad('(styles)', 'E 失明', `风格自带 mux.sh 里一个带 \`LN_TP=\` 的都没扫到（${stylesRoot} 路径/写法变了？）`);
  for (const s of withLnTp) judgeDeliveryScript(s.rel, s.text);
  // ★ 2026-10-06：`--json` 时这行走 **stderr** —— 原先它打在 stdout，把 `--json` 的 JSON 前缀污染成
  //   `[E] …\n{…}`（不可 `JSON.parse`，实测踩到）。E 段是**静态文本**判据，与重渲窗口无关，恒判。
  const eLine = `[E] 交付脚本：core/render/mux.sh + 风格自带 mux.sh 里带 LN_TP 的 ${withLnTp.length} 个（逐个要求闭环）`
    + `${noLnTp.length ? `；不带 LN_TP 的 ${noLnTp.length} 个（不做音频归一，不要求）：${noLnTp.map((x) => x.slug).join(' ')}` : ''}`;
  if (AS_JSON) console.error(eLine); else console.log(eLine);
}

if (AS_JSON) {
  console.log(JSON.stringify({
    total: slugs.length,
    judged: slugs.length - deferred.length,
    deferred,
    batch: { active: batch.hits.length > 0, hits: batch.hits, newest: batch.items.map(([l, { best, bn }]) => `${l}: ${bn || '(无)'} ${best === null ? 'N/A' : fmtAge(NOW - best) + ' 前'}`) },
    lockDir: LOCK_DIR,
    fails,
  }, null, 2));
} else {
  // ── ★★ F 段报告：**疑似正在重渲 ⇒ 本次不判**（不是「通过」，所以大声打印 + 列出本会报的每一条）──
  if (deferred.length) {
    console.log(`⚠ 疑似正在重渲，本次不判 ${deferred.length} 部（**这不等于「通过」**）：\n`);
    for (const d of deferred) {
      console.log(`  ${d.slug.padEnd(20)} 成片 ${d.filmAge} 前被写 / 文档 ${d.docAge} 前 → ${d.why.join('；')}`);
      for (const f of d.wouldFail) console.log(`      （若不是疑似重渲，本会报）[${f.kind}] ${f.msg}`);
    }
    console.log('  ⇒ 判据：成片 mtime 新于文档 mtime **且**（成片 ≤15 min 内被写 / 该 slug 并发锁活着 / 批次日志 ≤10 min 内被写）。');
    console.log('  ⇒ 批次排空 10 min 后重跑本闸门：若仍红，那是**真漂移**（或文档待回填，跑 refresh-style-skill.mjs）。');
  }
  console.log(`[F] 批次信号：${batch.hits.length ? `**有**（${batch.hits.join('；')}）` : '无'}`
    + `　|　${batch.items.map(([l, { best, bn }]) => `${l} ${bn || '(无)'} ${best === null ? 'N/A' : fmtAge(NOW - best) + ' 前'}`).join('　|　')}`
    + `　|　锁目录 ${LOCK_DIR}`);

  if (fails.length) {
    console.log(`\n✘ 发现 ${fails.length} 处口径不一致：\n`);
    for (const f of fails) console.log(`  ${f.slug.padEnd(20)} [${f.kind}] ${f.msg}`);
  } else {
    console.log(`\n✓ 被判的 ${slugs.length - deferred.length} 部成片交付口径全部一致（文档声称值 == 实测值）`
      + `${deferred.length ? `（另有 ${deferred.length} 部**未判**，见上）` : ''}`);
  }
  console.log(`\n[闸门] 成片 ${slugs.length} 部；已判 ${slugs.length - deferred.length} 部；不一致 ${fails.length} 处`
    + `；疑似正在重渲未判 ${deferred.length} 部 ${fails.length ? '✘' : 'OK'}`);
}
process.exitCode = fails.length ? 1 : 0;
