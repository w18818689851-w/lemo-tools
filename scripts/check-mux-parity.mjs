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
 *     它那一版成片的真峰值就从 −1.68 摆到 −3.37 dBTP（`lib/style-skills/paper-lantern/SKILL.md:220/:267`）。
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
 * ★★ 第二段判据（2026-10-07 新增）：**`muxPatch` 声称 ↔ 现状**。
 *   由来：`lib/style-skills/<slug>/_distill.json` 里有一个 `muxPatch` 对象，记录「对某风格自带混流脚本
 *   打过的一次补丁」。审计实测：**此前没有任何闸门在读它** ⇒ 补丁被**静默回退**（跑 `--revert` 或手改）
 *   也没人发现，而 `muxPatch.verifiedAfter` 里那句「补丁后 MUX_OK、帧数 1433/1433」会继续被后人当真。
 *   实测**只有 1 个风格有 `muxPatch`**（`backrooms`；核法见 `lib/style-skills/<slug>/_distill.json` 的
 *   `muxPatch` 存在性 + 字段枚举），7 个字段：`reason / script / appliedAt / patchedFile / revert /
 *   verifiedAfter / verifiedBefore`。字段语义与判据见 `MUXPATCH_EXPECT` 上方那段注释。
 *   同款「两层语义」：命中项先查 `KNOWN_DIVERGENCES[slug]`（与第一段共用同一张清单）⇒ 已登记只列不判。
 *
 * 用法：node scripts/check-mux-parity.mjs
 * 退出码：未登记的口径分叉 / core 自身漂移 / `muxPatch` 声称与现状不符 / **失明** ⇒ 1；否则 0。
 * 覆盖点：**`LEMO_OPUSCAR`**（库根，与 `check-mux-selection` / `check-render-venc` / `check-esm-import-paths`
 *   同名同义），供**非破坏性变异验证**（指向临时夹具树，绝不动真库）。
 *   另有 **`LEMO_DISTILL_ROOT`**（`_distill.json` 所在树，与 `check-config-vs-doc.mjs:156` /
 *   `check-film-delivery.mjs:95` 同名同义）—— 第二段判据的**非破坏性变异验证**用它指向临时副本。
 *   ★ 它的默认值**写死**、不按脚本位置推导：`test/gate-blindness.test.mjs` 会把本闸门**拷到临时目录**再跑
 *     （`patchGate`，用于「清空 `KNOWN_DIVERGENCES`」自证）—— 若按脚本位置推导，副本会找不到这棵树而**误报失明**。
 * ★ 范围：**第一段只查 `styles/<slug>/demo/mux.sh`**（3 个）。`styles/<slug>/demo/tools/mux.sh`（9 个，其中 8 个自带同型闭环、
 *   `woodcut` 委托 core）**不在第一段范围** —— 它们由 `check-mux-selection.mjs` 守四项口径。
 *   **第二段只查 `_distill.json` 里显式写了 `muxPatch` 的风格**（1 个：`backrooms`）—— 是「记录声称 ↔ 文件现状」的
 *   一致性，**不是**对 `demo/tools/mux.sh` 的口径复核（那是 `check-mux-selection` 的活）。
 *   本闸门输出里会显式打出这两段范围，免得那句 ✓ 被读成「所有混流脚本都对齐了」。
 * ★ 只读：不写库、不跑 ffmpeg。
 */
import fs from 'node:fs';
import path from 'node:path';

const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || 'D:/lemo-opuscar');
const STYLES = path.join(OPUSCAR, 'styles');
const CORE = path.join(OPUSCAR, 'core', 'render', 'mux.sh');

/**
 * ★ `muxPatch` 声称所在的树（**与 `OPUSCAR` 无关**：`_distill.json` 在**工具仓**里，不在库里）。
 *   覆盖点 `LEMO_DISTILL_ROOT`（与 `check-config-vs-doc.mjs:156` / `check-film-delivery.mjs:95` 同名同义），
 *   供**非破坏性变异验证**指向临时副本（绝不动真库）。
 *   ★ 默认值**写死**、不按脚本位置推导 —— `test/gate-blindness.test.mjs` 会把本闸门拷到临时目录再跑，
 *     按位置推导会让副本找不到这棵树而**误报失明**（那会把既有用例变成假红）。
 */
const DISTILL_ROOT = path.resolve(process.env.LEMO_DISTILL_ROOT || 'D:/lemo-tools/lib/style-skills');

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
      + '见 `lib/style-skills/pictogram-motion/SKILL.md:174`、`lib/style-skills/paper-lantern/SKILL.md:186`。'
      + '**待办**：同 `LN_TP` 条。',
    LOUDNORM_I: '同上 —— 响度收口不在 mux 阶段，而在 `music.py` 母带 + 新增的 `demo/mix.py` 第 ③ 步'
      + '（`alimiter` 4× 过采样真峰值收口）。见 `lib/style-skills/pictogram-motion/SKILL.md:173-174`。',
  },
};

/**
 * ★★ `muxPatch` 声称 ↔ 现状 —— 第二段判据的期望值（2026-10-07 新增，补审计确认的零覆盖区）。
 *
 * 实测（`node -e` 逐风格枚举 `lib/style-skills/<slug>/_distill.json`）：**只有 `backrooms` 有 `muxPatch`**，
 * 7 个字段。**逐字段语义 + 判/不判的理由**（判据以此为准，不是照抄任何人的转述）：
 *   · `script`         = **补丁脚本路径**（`D:/lemo-tools/scripts/patch-style-mux.mjs`）
 *                        ⇒ **判**：必须存在。它同时是 `revert` 字段那条命令的执行体 —— 脚本丢了，
 *                          「记录说打过补丁」与「还能回退」两件事都失去依托。
 *   · `patchedFile`    = **被补丁改写的文件**（`D:/lemo-opuscar/styles/backrooms/demo/tools/mux.sh`）
 *                        ⇒ **判**：必须存在，且**现状必须仍是「已打补丁」态**（见 ⓒⓓ）。
 *   · `verifiedAfter`  = 补丁后的成功读数（散文）。**一半可判、一半不可判**：
 *                        · 不可判（**只列**）：运行时读数 `MUX_OK 30386381`、`src_frames=1433 out_frames=1433`
 *                          —— 静态读文件读不出来，机械判定不可靠（本项目纪律：判据不成立时宁可只报不改）。
 *                        · 可判：它**引用的代码字面量** —— 「`nvenc`」「`-preset p5 -profile high -rc vbr`」
 *                          「`mux 打印补静音 note`」—— 这些是 `patchedFile` 现状该有的**版本标记**。
 *   · `verifiedBefore` = 补丁前的失败读数（散文，`MUX_FAIL 帧数不符 1433/1432`）⇒ **只列不判**（同上，运行时读数）。
 *   · `reason`         = 为什么打这个补丁（纯历史叙述）⇒ **只列不判**。
 *   · `appliedAt`      = 打补丁的日期 ⇒ **只列不判**（记的是当时，不是现状）。
 *   · `revert`         = 还原命令 ⇒ **只列不判**（给「要回退的人」看的，不是现状判据）。
 *
 * ★ **哨兵（`appliedMark`）与补丁体（`body`）的权威来源** = `scripts/patch-style-mux.mjs`：
 *   · 补丁脚本自己的幂等标记 = 它的 `const MARK` 常量（`── 本地补丁（2026-10-03 回灌 core/render/mux.sh）──`），
 *     `applyPatch` 开头 `if (text.includes(MARK)) return 已打过补丁`，而 `--revert` 走的 `normalize()`
 *     会把这个 MARK 块**整块删掉** ⇒ **标记消失正是「被回退」的机械特征**。
 *   · ★★ 但**不能**拿 `MARK` 去对被补丁文件做**逐字**比对 —— 实测（2026-10-07）踩到：
 *     `backrooms/demo/tools/mux.sh:40` 现状是 `# ── 本地补丁（保留，2026-10-03 回灌 core/render/mux.sh）──`
 *     —— 有人在打完补丁后**手工往标记里插了「保留，」**（示意「这条补丁已回灌 core，别删」）。
 *     逐字比对会把它误判成「补丁被回退」⇒ **误报**。故 ⓒ 用**容忍写法** `appliedMark`（正则：认那行注释的
 *     「`本地补丁（…回灌 core/render/mux.sh）──`」骨架，中间允许多插字），而「文件标记 ≠ 脚本 `MARK` 字面量」
 *     这件事降级为**只列不判**的 note（那是**补丁脚本的幂等性**问题，不是 `muxPatch` 声称的内容）。
 *   · 补丁体 = 同一脚本 `prelude()` 生成的那几行（补静音 `apad=whole_dur` + note 打印 + `h264_nvenc`
 *     的参数组合）。只查标记会漏掉「标记还在、补丁体被手改」⇒ 两层都查。
 *   ★ 若补丁脚本哪天换了标记骨架，请同步更新 `appliedMark`（否则会在**已重新打过补丁**的文件上报「被回退」）。
 *   ★ 未登记的风格（`MUXPATCH_EXPECT[slug]` 不存在）⇒ 只判存在性并记一条 backlog，请补登记（**不判 FAIL**）。
 */
const MUXPATCH_EXPECT = {
  backrooms: {
    // 补丁脚本的 `const MARK` 字面量（**只用于「标记漂移」这条只列不判的 note**，不参与 FAIL 判定）
    scriptMark: '── 本地补丁（2026-10-03 回灌 core/render/mux.sh）──',
    // ⓒ 被补丁文件里「已打补丁」的机械特征。★ 容忍写法：`（…）` 之间允许多插字（实测文件里插了「保留，」）。
    appliedMark: /^\s*#.*本地补丁（[^）]*回灌 core\/render\/mux\.sh）──\s*$/m,
    body: [
      { id: 'MUXPATCH_PAD', re: /apad=whole_dur/, why: '补静音：音频短于画面时补到「画面长度 + 一帧」，否则 -shortest 切掉末帧 ⇒ 编排器判 `MUX_FAIL 帧数不符`（`verifiedBefore` 记的 1433/1432 就是这个）' },
      { id: 'MUXPATCH_NOTE', re: /echo "mux\.sh: note: audio/, why: '补静音时打印 note（`verifiedAfter` 记的「mux 打印补静音 note」）' },
      { id: 'MUXPATCH_ENC', re: /h264_nvenc/, why: 'GPU 编码（`verifiedAfter` 记的 nvenc；用户头号硬规则「渲染一律本地 GPU」）' },
      { id: 'MUXPATCH_ENC_PRESET', re: /-preset p5/, why: '`verifiedAfter` 记的 `-preset p5`' },
      { id: 'MUXPATCH_ENC_PROFILE', re: /-profile high/, why: '`verifiedAfter` 记的 `-profile high`' },
      { id: 'MUXPATCH_ENC_RC', re: /-rc vbr/, why: '`verifiedAfter` 记的 `-rc vbr`' },
    ],
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

// ── ★★ 第二段：`muxPatch` 声称 ↔ 现状 ────────────────────────────────────────
//   枚举 `lib/style-skills/*/_distill.json`（`DISTILL_ROOT`），对每个显式写了 `muxPatch` 的风格逐条复核。
//   判据与字段语义见 `MUXPATCH_EXPECT` 上方那段注释。**失明守卫**（并入同一个 `blind[]`）：
//   `DISTILL_ROOT` 读不到 / 扫到 0 个风格目录 / **一条 `muxPatch` 声称都枚举不到** ⇒ 失明。
//   ★ 最后那条是**本项目反复治过的假绿形态**（「0 个对象却全绿」，同 `check-mux-selection.mjs:51-65`）：
//     真实语料此刻**确实有 1 条**（`backrooms`）⇒ 变成 0 只能是「记录被删 / 字段改名 / 树被挪」
//     —— 那时本段一句判据都没跑过，绝不能印绿。若确已移除全部 `muxPatch` 声称，请同步删掉本段与登记文案。
const mpRows = [];
let mpFound = 0;
let mpParseErr = 0;
try {
  const dirs = fs.readdirSync(DISTILL_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'));
  for (const e of dirs) {
    const f = path.join(DISTILL_ROOT, e.name, '_distill.json');
    if (!fs.existsSync(f)) continue;
    let j = null;
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (err) { mpParseErr++; fails.push(`${f} 解析失败（${(err && err.message) || err}）⇒ 读不出它的 \`muxPatch\` 声称`); continue; }
    if (j && j.muxPatch && typeof j.muxPatch === 'object') { mpFound++; mpRows.push({ slug: e.name, file: f, claim: j.muxPatch }); }
  }
  if (!blind.length && dirs.length === 0) blind.push(`\`${DISTILL_ROOT}\` 下扫到 0 个风格目录（路径 / 过滤变了？）⇒ 一条 \`muxPatch\` 声称都没检查过`);
} catch (err) {
  blind.push(`\`${DISTILL_ROOT}\` 读不到（${(err && err.message) || err}）⇒ 一条 \`muxPatch\` 声称都没检查过`);
}
if (!blind.length && mpFound === 0 && mpParseErr === 0) {
  blind.push('`lib/style-skills/*/_distill.json` 里**一条 `muxPatch` 声称都枚举不到**（记录被删？字段改名？树被挪？）'
    + '⇒ 本段判据没检查过任何东西（★ 若确已移除全部 `muxPatch` 声称，请同步删掉本段与登记文案）');
}

const mpOut = [];
for (const { slug, file, claim } of mpRows) {
  const where = file.replace(/\\/g, '/');
  const bad = [];    // ⇒ 判 FAIL（除非已在 KNOWN_DIVERGENCES 登记）
  const note = [];   // ⇒ **只列不判**（散文 / 运行时读数 / 历史叙述）
  const asStr = (v) => (typeof v === 'string' && v ? v : null);
  /** 散文截断（避免把 `reason` 整段铺满终端）。★ 按**字符**切，不按字节（本项目踩过 `cut -c` 切坏中文）。 */
  const clip = (v, n = 150) => {
    const s = asStr(v);
    if (s === null) return '（缺 / 非字符串）';
    return s.length > n ? `${s.slice(0, n)}…（共 ${s.length} 字）` : s;
  };

  // ⓐ `script`（补丁脚本路径）必须存在
  const scriptPath = asStr(claim.script);
  if (!scriptPath) bad.push({ id: 'MUXPATCH_SCRIPT', msg: '`muxPatch.script` 缺失或不是非空字符串（补丁脚本路径没记 ⇒ 既无法复核，`revert` 也无从执行）' });
  else if (!fs.existsSync(scriptPath)) bad.push({ id: 'MUXPATCH_SCRIPT', msg: `\`muxPatch.script\` 指向的补丁脚本**不存在**：\`${scriptPath}\`` });

  // ⓑ `patchedFile` 必须存在
  const patched = asStr(claim.patchedFile);
  if (!patched) bad.push({ id: 'MUXPATCH_FILE', msg: '`muxPatch.patchedFile` 缺失或不是非空字符串（被补丁改写的文件没记）' });
  else if (!fs.existsSync(patched)) bad.push({ id: 'MUXPATCH_FILE', msg: `\`muxPatch.patchedFile\` **不存在**：\`${patched}\`` });

  // ⓒⓓ 被补丁文件的**现状**必须仍是「已打补丁」态（补丁标记 + 补丁体）
  const exp = MUXPATCH_EXPECT[slug];
  if (patched && fs.existsSync(patched)) {
    const t = fs.readFileSync(patched, 'utf8');
    if (!exp) {
      backlog.push(`${slug}（${where}）· MUXPATCH_NO_EXPECT：\`MUXPATCH_EXPECT\` 里没有该风格的补丁标记/补丁体期望`
        + '⇒ 本闸门**只判了存在性**（ⓐⓑ），没判「补丁是否还在」；请把 `verifiedAfter` 里的代码字面量登记进 `MUXPATCH_EXPECT`');
    } else {
      // ⓒ 补丁标记在不在 = 「补丁是否被静默回退」的机械特征（★ 容忍写法，见 MUXPATCH_EXPECT 上方注释）
      if (!exp.appliedMark.test(t)) {
        bad.push({ id: 'MUXPATCH_REVERTED', msg: `\`${patched}\` 现状**不含补丁标记** ${exp.appliedMark}`
          + ' ⇒ 该补丁**已被回退 / 被整块覆盖**，而 `muxPatch.verifiedAfter` 声称的现状不再成立'
          + '（`muxPatch.revert` 那条命令会把这个标记块整块删掉）' });
      } else {
        // ⓓ 标记还在，但补丁体缺项（标记留着、体被手改的半吊子状态）
        for (const m of exp.body) {
          if (!m.re.test(t)) bad.push({ id: m.id, msg: `\`${patched}\` **有补丁标记、但补丁体缺项**：找不到 ${m.re} —— ${m.why}` });
        }
        // ★ **只列不判**：文件里的标记 vs 补丁脚本的 `MARK` 字面量是否**逐字**一致。
        //   不一致 ⇒ 补丁脚本自己的幂等判定（`text.includes(MARK)`）在该文件上失效（再跑一次会认不出「已打过补丁」）。
        //   ★ 这是**补丁脚本的幂等性**问题，不是 `muxPatch` 声称的内容 ⇒ 不判 FAIL（实测 2026-10-07 真语料就有这条）。
        if (typeof exp.scriptMark === 'string' && !t.includes(exp.scriptMark)) {
          const markLine = (t.split('\n').find((l) => exp.appliedMark.test(l)) || '').trim();
          const scriptKeepsMark = scriptPath && fs.existsSync(scriptPath)
            && fs.readFileSync(scriptPath, 'utf8').includes(exp.scriptMark);
          note.push('★ **只列不判**：文件里的补丁标记与补丁脚本的 `MARK` 字面量**不完全一致**'
            + `（文件：\`${markLine}\` ／ 脚本 MARK：\`${exp.scriptMark}\`）`
            + '⇒ 补丁脚本的幂等判定（`applyPatch` 的 `text.includes(MARK)`）在该文件上**已失效**'
            + `（再跑一次会认不出「已打过补丁」）${scriptKeepsMark ? '；★ 脚本自身仍用这个字面量 ⇒ 本闸门期望值未过期' : '；★ 脚本里也已找不到该字面量 ⇒ 期望值可能已过期，请同步 `appliedMark`'}`
            + '。这是**补丁脚本的幂等性**问题、不是 `muxPatch` 声称的内容 ⇒ 不判 FAIL，**只报不改**。');
        }
      }
    }
  }

  // ⓕ **只列不判**：散文 / 运行时读数 / 历史叙述（机械判定不可靠）
  note.push(`reason（为什么打这个补丁）：${clip(claim.reason)}`);
  note.push(`appliedAt：${clip(claim.appliedAt, 40)}；revert：${clip(claim.revert, 120)}`);
  note.push(`verifiedBefore（补丁前的失败读数，运行时 ⇒ 只列）：${clip(claim.verifiedBefore)}`);
  note.push(`verifiedAfter（补丁后的成功读数，运行时部分只列）：${clip(claim.verifiedAfter)}`);

  // ★ 两层语义：命中项先查「已记录的分叉」清单（与第一段共用 `KNOWN_DIVERGENCES`）
  const reg = KNOWN_DIVERGENCES[slug] || {};
  const fresh = [];
  for (const b of bad) {
    if (reg[b.id]) backlog.push(`${slug}（${where}）· ${b.id}：${b.msg}\n      ↳ 已登记：${reg[b.id]}`);
    else fresh.push(b);
  }
  // 清单里登记了 MUXPATCH_* 但实际已不再分叉 ⇒ 提示可删条目（不判 FAIL）
  for (const id of Object.keys(reg).filter((k) => k.startsWith('MUXPATCH_') && !bad.some((b) => b.id === id))) {
    backlog.push(`${slug}（${where}）· ${id}：★ 登记的分叉**已消解**（现状与声称一致）⇒ 可从 \`KNOWN_DIVERGENCES\` 删掉这条登记`);
  }

  for (const f of fresh) fails.push(`${slug}（${where}）：${f.msg}`);
  mpOut.push({ slug, where, fresh, backlogN: bad.length - fresh.length, note });
}

// ── 输出 ────────────────────────────────────────────────────────────────────
console.log(`库根 : ${OPUSCAR}`);
console.log(`基准 : ${CORE}${coreSrc === null ? '（读不到）' : ''}`
  + `${coreSrc === null ? '' : `  [LN_TP=${grabDefault(coreSrc, 'LN_TP', 'LEMO_LN_TP')} / STEP=${grabDefault(coreSrc, 'LN_TP_STEP', 'LEMO_LN_TP_STEP')} / TRIES=${grabDefault(coreSrc, 'LN_TP_TRIES', 'LEMO_LN_TP_TRIES')}]`}`);
console.log(`范围 : styles/*/demo/mux.sh（自带 mux 的风格 ${own.length} 个 / 风格总数 ${slugs.length}）`
  + '；★ styles/*/demo/tools/mux.sh 不在本闸门范围（由 check-mux-selection 守四项口径）');
console.log(`       ★ 第二段只查 _distill.json 里显式写了 muxPatch 的风格（${mpFound} 个 / ${DISTILL_ROOT}）`
  + '—— 是「记录声称 ↔ 文件现状」的一致性，不是对 demo/tools/mux.sh 的口径复核');
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

// ★ 第二段输出：`muxPatch` 声称 ↔ 现状
if (mpOut.length) {
  console.log('\n★ `muxPatch` 声称 ↔ 现状（判据：补丁脚本 / 被补丁文件存在 ＋ 文件现状仍带**补丁标记与补丁体**'
    + '＝ 补丁未被静默回退；`reason`/`appliedAt`/`revert`/`verifiedBefore`/`verifiedAfter` 的散文与运行时读数**只列不判**）：');
  for (const r of mpOut) {
    const mark = r.fresh.length ? '  ✘ ' : r.backlogN ? '  ⚠ ' : '  ok ';
    const verdict = r.fresh.length
      ? `✘ 与声称不符 ${r.fresh.length} 项：${r.fresh.map((f) => f.id).join('、')}`
      : r.backlogN ? `⚠ 与声称不符 ${r.backlogN} 项（**已登记积压**，见下）` : '✓ 现状与 `muxPatch` 声称一致';
    console.log(`${mark}${r.slug.padEnd(20)} ${r.where}   ${verdict}`);
    for (const n of r.note) console.log(`        · ${n}`);
  }
}

if (backlog.length) {
  console.log(`\nℹ 已记录的分叉（只列 backlog、**不判 FAIL**；清单在 \`KNOWN_DIVERGENCES\`）${backlog.length} 项：`);
  for (const b of backlog) console.log(`  · ${b}`);
}

if (fails.length) {
  console.log(`\n✘ 未登记的口径分叉 / core 漂移 / \`muxPatch\` 声称与现状不符 ${fails.length} 处：`);
  for (const f of fails) console.log(`  ✘ ${f}`);
} else if (!blind.length) {
  console.log('\n✓ 所有自带 `demo/mux.sh` 的风格都与 core/render/mux.sh 同口径（或已如实登记为积压），core 自身口径未漂移；'
    + `\`muxPatch\` 声称（${mpFound} 条）的补丁脚本 / 被补丁文件都在，且现状仍带补丁标记与补丁体（未被静默回退）。`);
}

if (blind.length) {
  console.log('\n✘ 本闸门已失明：');
  for (const b of blind) console.log(`  ✘ ${b}`);
}

console.log(`\n[闸门] 未登记分叉 ${fails.length} 处、已登记积压 ${backlog.length} 项`
  + `${blind.length ? '、**已失明**' : ''} ${(fails.length || blind.length) ? '✘' : 'OK'}；自带 mux ${own.length}/${slugs.length}；muxPatch 声称 ${mpFound} 条`);
process.exitCode = (fails.length || blind.length) ? 1 : 0;
