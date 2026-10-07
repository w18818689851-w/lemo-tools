#!/usr/bin/env node
/**
 * scripts/check-mux-parity.mjs —— **各风格自带 `demo/mux.sh` ↔ `core/render/mux.sh` 的口径 parity 闸门**
 *
 * ★ 由来（2026-10-07）：混流脚本的音频收尾口径在**两个地方各写一份** ——
 *   `core/render/mux.sh`（**走 core 的 34 个风格**共用）与**个别风格自带的** `styles/<slug>/demo/mux.sh`。
 *   实测**只有 3 个风格自带 `demo/mux.sh`**（`paper-popup` / `watercolor` / `pictogram-motion`；
 *   核法 `ls D:/lemo-opuscar/styles/<slug>/demo/mux.sh` 的展开（`styles/*` 通配）⇒ 3）。三份里**两份**在 2026-10-05
 *   与 core 对齐过（两遍 loudnorm → −14 LUFS + 编码后复核闭环 + 编码器守卫），**一份没有**
 *   （`pictogram-motion`：**完全没有 `LN_TP`**、没有 loudnorm、没有复核闭环）。而**没有任何闸门**
 *   在比这两份副本 ⇒ 口径漂移是**静默**的。本闸门把它机械拦住。
 *
 * ★ 为什么要比「关键常量 + 关键结构」，而不只比「有没有 LN_TP」：
 *   · `LN_TP` 默认值 = loudnorm 的 TP 起点。它一变，**成片真峰值整条读数平移** ——
 *     实测 `paper-lantern` 就吃过这个：它没有自带 mux.sh ⇒ 永远走 core ⇒
 *     core 默认值 2026-10-03 被收紧到 −3.5、2026-10-05 改回「−1.7 起步 + 闭环」，
 *     它那一版成片的真峰值就从 −1.68 摆到 −3.37 dBTP（`lib/style-skills/paper-lantern/SKILL.md:112/:117`）。
 *   · `LN_TP_STEP` / `LN_TP_TRIES` = 闭环的步长与档数（步长为什么是 0.25 而不是 0.5：AAC 过冲对
 *     TP 目标**非单调**，粗步长会漏掉可行中间档，见 `core/render/mux.sh:89`）。
 *   · 闭环结构 = 「编一次 → 量成片真峰值 → 不达标就按步长下调 TP 目标**只重编音频** → 取最好的一档」。
 *     **没有它，真峰值超标只能事后拿 `scripts/fix-truepeak.mjs` 补救**。
 *   · 编码器守卫 = 用户**最高优先级硬规则「渲染一律 GPU」**的落地判据（未设 `LEMO_VENC` ⇒ `h264_nvenc`；
 *     显式 `libx264` ⇒ CPU；**其它值 ⇒ 报错退出**，绝不静默回落 CPU）。
 *
 * ★★ 两层语义（**这是本闸门能「当前树 exit 0」而将来新漂移会红**的关键）：
 *   **已在文档/清单里记录的积压 ⇒ 只列不判 FAIL；没记录的才 FAIL。**
 *   本闸门的「已记录的分叉」清单 = `KNOWN_DIVERGENCES`（逐条写明「为什么允许存在 / 待办是什么」）。
 *   同款做法见 `check-dna-coverage.mjs` 的 `DUB_METADATA` / `DUB_UNIMPLEMENTED`、
 *   `check-skill-artifacts.mjs` 的「部分 SKIP 不判 FAIL」、`check-render-venc.mjs` 的 B 类 backlog。
 *   ★ 清单是**承重的、不是摆设**：把它清空，`pictogram-motion` 立刻从 backlog 变 FAIL（变异验证已证）。
 *
 * 判据（对**每一个自带 `styles/<slug>/demo/mux.sh` 的风格**，逐项与 core 比）：
 *   ① `LN_TP` 默认值（应为 −1.7）
 *   ② `LN_TP_STEP`（0.25）、`LN_TP_TRIES`（8）
 *   ③ **编码后复核 + 逐档下调重编**的闭环结构（`TP_TRY`/`ATTEMPT` 循环 + 与 −1.2 的比较）
 *   ④ **编码器守卫**：未设 ⇒ `h264_nvenc`、显式 `libx264` ⇒ CPU、其它值 ⇒ **报错退出**
 *   ⑤ **`LEMO_VENC` 未设时不得静默走 CPU**（不许把 `libx264` 写成默认值）
 *   ⑥ 两遍 loudnorm 的响度目标 `loudnorm=I=-14` 在（否则整条响度链都不在 mux 里）
 *   ⑦（**只登记、不判 FAIL**）交付线 `−1.2 dBTP` 与 **AAC 过冲余量 0.5 dB** 的说明是否两边一致 ——
 *      那是**散文**判据，机械判定不可靠（本项目纪律：判据不成立时宁可只报不改）⇒ 只列。
 *   ★ 另有一条 **core 自身的口径漂移**判据：core 的 ①② 若不等于 `CORE_EXPECT` ⇒ FAIL ——
 *     因为 core 是**34 个风格共用**的那一份，它一变**全体跟随**，必须是**有意为之 + 重渲验证**的事件。
 *
 * 用法：node scripts/check-mux-parity.mjs
 * 退出码：未登记的口径分叉 / core 自身漂移 / **失明** ⇒ 1；否则 0。
 * 覆盖点：**`LEMO_OPUSCAR`**（库根，与 `check-mux-selection` / `check-render-venc` / `check-esm-import-paths`
 *   同名同义），供**非破坏性变异验证**（指向临时夹具树，绝不动真库）。
 * ★ 范围：**只查 `styles/<slug>/demo/mux.sh`**（3 个）。`styles/<slug>/demo/tools/mux.sh`（9 个，其中 8 个自带同型闭环、
 *   `woodcut` 委托 core）**不在本闸门范围** —— 它们由 `check-mux-selection.mjs` 守四项口径。
 *   本闸门输出里会显式打出这个范围，免得那句 ✓ 被读成「所有混流脚本都对齐了」。
 * ★ 只读：不写库、不跑 ffmpeg。
 */
import fs from 'node:fs';
import path from 'node:path';

const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || 'D:/lemo-opuscar');
const STYLES = path.join(OPUSCAR, 'styles');
const CORE = path.join(OPUSCAR, 'core', 'render', 'mux.sh');

/**
 * ★ core 当前应持有的口径。**这三条是「一改全动」的开关**：
 *   34 个走 core 的风格（含 `paper-lantern`）的成片真峰值整条读数由它决定
 *   ⇒ 改动必须是「有意为之 + 重渲验证」，所以此处判 FAIL（而不是静默放行）。
 */
const CORE_EXPECT = { LN_TP: '-1.7', LN_TP_STEP: '0.25', LN_TP_TRIES: '8' };

/**
 * ★★ 已记录的分叉（两层语义的「清单」）—— 命中即**只列 backlog、不判 FAIL**。
 *   每条必须写清「为什么允许存在 / 待办是什么」，否则等于放水。
 */
const KNOWN_DIVERGENCES = {
  'pictogram-motion': {
    LN_TP: '本风格的 `demo/mux.sh` 是**另一套音频架构**的手工构建入口：配乐由 `music/music.py` 直出母带 '
      + '`music/music.wav`（已做到 TP −1.12 dBTP / I −14.11 LUFS），**从来没有 `mix.wav` 概念**，'
      + '所以它的 mux 阶段**不做 loudnorm**、也就没有 `LN_TP`。'
      + '依据：`lib/style-skills/pictogram-motion/SKILL.md:173`（音频架构分叉，2026-10-05 已用新增 `demo/mix.py` 给编排器通路补壳）。'
      + '**待办**：若要让手工通路与 core 同口径，须给它加「两遍 loudnorm + 编码后复核闭环」或直接委托 `core/render/mux.sh`。',
    LN_TP_STEP: '同上 —— 没有 loudnorm 就没有 TP 目标，也就没有步长。待办见 `LN_TP` 条。',
    LN_TP_TRIES: '同上 —— 没有复核闭环就没有档数。待办见 `LN_TP` 条。',
    CLOSED_LOOP: '同上 —— 缺「编码后复核 + 逐档下调重编」这道闭环。'
      + '★ **这不是 2026-10-04 那次 +0.28 dBTP 的成因**：那版成片走的是 `core/render/mux.sh`'
      + '（24 fps / `h264_nvenc` / `I −14.0 LUFS`，都不是本 demo 脚本的产物），'
      + '当时 core 自己也**还没有**闭环（闭环是 2026-10-05 加的），'
      + '根因是**素材波峰因子过高**（PLR 12.99 dB）+ AAC 过冲 1.98 dB（−1.7 + 1.98 = +0.28）。'
      + '见 `lib/style-skills/pictogram-motion/SKILL.md:174`、`lib/style-skills/paper-lantern/SKILL.md:185`。'
      + '**待办**：同 `LN_TP` 条。',
    LOUDNORM_I: '同上 —— 响度收口不在 mux 阶段，而在 `music.py` 母带 + 新增的 `demo/mix.py` 第 ③ 步'
      + '（`alimiter` 4× 过采样真峰值收口）。见 `lib/style-skills/pictogram-motion/SKILL.md:173-174`。',
  },
};

// ── 工具 ────────────────────────────────────────────────────────────────────
/** 只留**非注释行**（`#` 起头整行注释）。判据的「已做」信号必须来自**代码**（同 `check-mux-selection.mjs:72`）。 */
const codeOnly = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

/** 抽 `VAR="${ENV:-<默认值>}"` 里的默认值；没有这一行 ⇒ null。 */
const grabDefault = (src, varName, envName) => {
  const m = src.match(new RegExp(`^\\s*${varName}="\\$\\{${envName}:-([^}]*)\\}"`, 'm'));
  return m ? m[1].trim() : null;
};

/** ③ 闭环结构：`TP_TRY`/`ATTEMPT` 的 while 循环 + 按 `LN_TP_STEP` 下调 + 与 −1.2 的比较（都在非注释代码里）。 */
const hasClosedLoop = (code) =>
  /TP_TRY/.test(code) && /ATTEMPT/.test(code) && /\bwhile\b/.test(code)
  && /LN_TP_STEP/.test(code) && /(<=|>=|<|>)\s*-1\.2/.test(code);

/** ④ 编码器守卫：三支齐全（未设 ⇒ nvenc / libx264 ⇒ CPU / 其它 ⇒ 报错退出）。 */
const vencGuard = (src) => {
  const m = src.match(/case\s+"\$\{LEMO_VENC:-\}"\s+in([\s\S]*?)\besac\b/);
  if (!m) return { ok: false, why: '找不到 `case "${LEMO_VENC:-}" in … esac` 块' };
  const b = m[1];
  if (!/''\s*\|\s*h264_nvenc\s*\)/.test(b)) return { ok: false, why: '未设 `LEMO_VENC` 时不是 `h264_nvenc`（应走 GPU）' };
  if (!/^\s*libx264\s*\)/m.test(b)) return { ok: false, why: '没有显式 `libx264` ⇒ CPU 的分支' };
  if (!/^\s*\*\s*\)/m.test(b) || !/\bexit\s+1\b/.test(b)) return { ok: false, why: '其它值没有「报错退出」（可能静默回落 CPU）' };
  return { ok: true };
};

// ── ★ 失明守卫（防空转绿灯）────────────────────────────────────────────────
//   判据：`core/render/mux.sh` 读不到 / `styles/` 读不到 / 扫到 0 个风格目录 /
//   **一个自带 `demo/mux.sh` 的风格都枚举不到** ⇒ **FAIL 并明说「本闸门已失明」**。
//   否则 `fails` 为空会打印「所有自带 mux.sh 都与 core 同口径」—— 那是**假的**
//   （旧版这类闸门踩过「0 对象却全绿」；写法照 `check-mux-selection.mjs:51-65` /
//   `check-loudness-targets.mjs` / `check-skill-artifacts.mjs` 的同型守卫）。
const blind = [];
let coreSrc = null;
try { coreSrc = fs.readFileSync(CORE, 'utf8'); }
catch (e) { blind.push(`\`${CORE}\` 读不到（${(e && e.message) || e}）⇒ 没有基准可比`); }

let slugs = [];
try {
  slugs = fs.readdirSync(STYLES, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name).sort();
} catch (e) { blind.push(`\`${STYLES}\` 读不到（${(e && e.message) || e}）⇒ 一个风格都没扫到`); }
if (!blind.length && slugs.length === 0) blind.push(`\`${STYLES}\` 下扫到 0 个风格目录（路径 / 过滤变了？）⇒ 一个混流脚本都没检查过`);

// 枚举自带 `demo/mux.sh` 的风格
const own = [];
for (const slug of slugs) {
  const p = path.join(STYLES, slug, 'demo', 'mux.sh');
  if (fs.existsSync(p)) own.push({ slug, file: p });
}
if (!blind.length && own.length === 0) {
  blind.push('`styles/*/demo/mux.sh` **一个都枚举不到**（文件挪了？过滤变了？）⇒ 一个自带 mux 脚本都没检查过');
}

// ── 主判定 ──────────────────────────────────────────────────────────────────
const fails = [];
const backlog = [];
const rows = [];

if (coreSrc !== null) {
  // ★ core 自身漂移：它是 34 个风格共用的那一份，一变全体跟随 ⇒ 必须是有意为之的事件。
  for (const [id, key] of [['LN_TP', 'LN_TP'], ['LN_TP_STEP', 'LN_TP_STEP'], ['LN_TP_TRIES', 'LN_TP_TRIES']]) {
    const got = grabDefault(coreSrc, id, `LEMO_${id}`);
    if (got === null) fails.push(`core/render/mux.sh：找不到 \`${id}="\${LEMO_${id}:-…}"\`（口径锚点丢了）`);
    else if (got !== CORE_EXPECT[key]) {
      fails.push(`core/render/mux.sh 的 \`${id}\` 默认值 = \`${got}\`，期望 \`${CORE_EXPECT[key]}\``
        + '（★ core 一变，**所有走 core 的风格**（含 paper-lantern 这类无自带 mux 的）成片真峰值整条读数一起平移'
        + ' ⇒ 改它必须是「有意为之 + 重渲验证」；确认后同步更新本闸门的 `CORE_EXPECT`）');
    }
  }
}

for (const { slug, file } of own) {
  const src = fs.readFileSync(file, 'utf8');
  const code = codeOnly(src);
  const rel = path.relative(OPUSCAR, file).replace(/\\/g, '/');
  const bad = [];
  const note = [];

  // ① ② 常量
  for (const id of ['LN_TP', 'LN_TP_STEP', 'LN_TP_TRIES']) {
    const got = grabDefault(src, id, `LEMO_${id}`);
    if (got === null) bad.push({ id, msg: `没有 \`${id}="\${LEMO_${id}:-…}"\`（缺这一项 ⇒ 无此口径）` });
    else if (got !== CORE_EXPECT[id]) bad.push({ id, msg: `\`${id}\` 默认值 = \`${got}\`，应为 \`${CORE_EXPECT[id]}\`` });
  }
  // ③ 闭环
  if (!hasClosedLoop(code)) bad.push({ id: 'CLOSED_LOOP', msg: '没有「编码后复核 + 逐档下调重编」闭环（缺 `TP_TRY`/`ATTEMPT` 循环或与 −1.2 的比较）' });
  // ④ 编码器守卫
  const g = vencGuard(src);
  if (!g.ok) bad.push({ id: 'VENC_GUARD', msg: `编码器守卫不完整：${g.why}` });
  // ⑤ 未设时不得静默走 CPU
  if (/LEMO_VENC:-\s*libx264/.test(src)) bad.push({ id: 'VENC_NO_SILENT_CPU', msg: '把 `libx264` 写成了 `LEMO_VENC` 未设时的默认值（静默走 CPU，违反「渲染一律 GPU」）' });
  // ⑥ 两遍 loudnorm 的响度目标
  if (!/loudnorm=I=-14/.test(code)) bad.push({ id: 'LOUDNORM_I', msg: '代码里没有 `loudnorm=I=-14`（响度归一不在这个 mux 里）' });

  // ⑦ 只登记：交付线 −1.2 + AAC 余量 0.5 dB 的说明
  const hasLine12 = /(<=|>=|<|>)\s*-1\.2/.test(code);
  const hasAacNote = /AAC/.test(src);
  note.push(`交付线 −1.2 判据：${hasLine12 ? '有' : '无'}；AAC 过冲余量说明：${hasAacNote ? '有' : '无'}`);

  // ★ 两层语义：命中的项先查「已记录的分叉」清单
  const reg = KNOWN_DIVERGENCES[slug] || {};
  const fresh = [];
  for (const b of bad) {
    if (reg[b.id]) backlog.push(`${slug}（${rel}）· ${b.id}：${b.msg}\n      ↳ 已登记：${reg[b.id]}`);
    else fresh.push(b);
  }
  // 清单里登记了、但实际已不再分叉 ⇒ 提示可以删条目（不判 FAIL）
  const resolved = Object.keys(reg).filter((id) => !bad.some((b) => b.id === id));
  for (const id of resolved) backlog.push(`${slug}（${rel}）· ${id}：★ 登记的分叉**已消解**（现在对得上 core 了）⇒ 可从 \`KNOWN_DIVERGENCES\` 删掉这条登记`);

  rows.push({ slug, rel, fresh, backlogN: bad.length - fresh.length, note });
  for (const f of fresh) fails.push(`${slug}（${rel}）：${f.msg}`);
}

// ── 输出 ────────────────────────────────────────────────────────────────────
console.log(`库根 : ${OPUSCAR}`);
console.log(`基准 : ${CORE}${coreSrc === null ? '（读不到）' : ''}`
  + `${coreSrc === null ? '' : `  [LN_TP=${grabDefault(coreSrc, 'LN_TP', 'LEMO_LN_TP')} / STEP=${grabDefault(coreSrc, 'LN_TP_STEP', 'LEMO_LN_TP_STEP')} / TRIES=${grabDefault(coreSrc, 'LN_TP_TRIES', 'LEMO_LN_TP_TRIES')}]`}`);
console.log(`范围 : styles/*/demo/mux.sh（自带 mux 的风格 ${own.length} 个 / 风格总数 ${slugs.length}）`
  + '；★ styles/*/demo/tools/mux.sh 不在本闸门范围（由 check-mux-selection 守四项口径）');
console.log('');
for (const r of rows) {
  // ★ 三态标记：未登记分叉 ✘ / 已登记积压 ⚠ / 完全同口径 ok。
  //   绝不许把「有已登记积压」也印成 ✓ —— 那会让读者以为它已经对齐（本项目反复治过的假绿形态）。
  const mark = r.fresh.length ? '  ✘ ' : r.backlogN ? '  ⚠ ' : '  ok ';
  const verdict = r.fresh.length
    ? `✘ 未登记分叉 ${r.fresh.length} 项：${r.fresh.map((f) => f.id).join('、')}`
    : r.backlogN ? `⚠ 与 core 分叉 ${r.backlogN} 项（**已登记积压**，见下）` : '✓ 与 core 同口径';
  console.log(`${mark}${r.slug.padEnd(20)} ${r.rel}   ${verdict}`);
  for (const n of r.note) console.log(`        · ${n}`);
}

if (backlog.length) {
  console.log(`\nℹ 已记录的分叉（只列 backlog、**不判 FAIL**；清单在 \`KNOWN_DIVERGENCES\`）${backlog.length} 项：`);
  for (const b of backlog) console.log(`  · ${b}`);
}

if (fails.length) {
  console.log(`\n✘ 未登记的口径分叉 / core 漂移 ${fails.length} 处：`);
  for (const f of fails) console.log(`  ✘ ${f}`);
} else if (!blind.length) {
  console.log('\n✓ 所有自带 `demo/mux.sh` 的风格都与 core/render/mux.sh 同口径（或已如实登记为积压），core 自身口径未漂移。');
}

if (blind.length) {
  console.log('\n✘ 本闸门已失明：');
  for (const b of blind) console.log(`  ✘ ${b}`);
}

console.log(`\n[闸门] 未登记分叉 ${fails.length} 处、已登记积压 ${backlog.length} 项`
  + `${blind.length ? '、**已失明**' : ''} ${(fails.length || blind.length) ? '✘' : 'OK'}；自带 mux ${own.length}/${slugs.length}`);
process.exitCode = (fails.length || blind.length) ? 1 : 0;
