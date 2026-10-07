#!/usr/bin/env node
/**
 * scripts/patch-style-mux.mjs —— 把 core/render/mux.sh 的修好回灌到各风格自带的 mux/finish 副本
 *
 * 补丁项（两项，各自独立、各自幂等）：
 *
 *  【A】编码器 + 补静音（2026-10-03 顺序出片时实测）—— 只对 9 个 `demo/tools/mux.sh`
 *    这 9 个副本的 CRF/颗粒/二次压缩是**有意**的变体，但漏了 core 版里 2026-10-01 已修好的两件事：
 *     ① **音频比画面短时补静音到「画面长度 + 一帧」**。不补的话 `-shortest` 会切掉最后一帧，
 *        编排器的守卫判 `MUX_FAIL 帧数不符`（实测 backrooms：渲染 1433 / 成片 1432）。
 *     ② **编码器跟随 `LEMO_VENC`**。编排器默认 `export LEMO_VENC=h264_nvenc`，
 *        core 版认这个变量，这 9 个副本硬写 libx264 ⇒ **走 CPU 编码**，
 *        违反项目硬规则「渲染/合成一律本地 GPU」。
 *
 *  【B】AAC 编码余量（2026-10-03 回灌 core/render/mux.sh 的 LN_TP）—— 对全部 13 个副本
 *      ⚠️ 该补丁是**历史动作**：core 的 LN_TP 已于同日由 −1.7 再改为 **−3.5 且可被 LEMO_LN_TP 覆盖**，
 *         各副本也已就地升级为新形态。本脚本对「已含 LEMO_LN_TP」的文件会**自动跳过**（见 applyTp 的守卫）。
 *    core 的 loudnorm TP 目标是 **−1.7**（比交付目标 −1.2 低 0.5 dB，那 0.5 dB 是留给 AAC 有损编码
 *    过冲的余量，见 `core/render/mux.sh:47-60` 的实测说明）。而各 demo 自带脚本一律写死 `TP=-1.2`
 *    （watercolor 写 `TP=-1`），**一个都没有编码余量** —— 走自带脚本的风格真峰值明显更高
 *    （实测 shadow-puppet 达 +1.43 dBTP，而走 core 的多在 −1.5 左右）。
 *    ⇒ 把 `:TP=-1.2` / `:TP=-1` 统一改成 `:TP=-1.7`，并在该语句上方加一行注释说明来由。
 *    其中 woodcut / pictogram-motion 没有自己的 loudnorm（前者调 core 后 `-c:a copy`、
 *    后者直接 `-c:a aac` 不归一），本项自动跳过。
 *
 * ★ 本脚本是**幂等**的：已带补丁哨兵的文件**直接跳过、不重打**（2026-10-07 起，见 `MARK_RE` 那段）；
 *   要重打 / 修被写坏的文件，先 `--revert` —— 它走 `normalize()` 把文件还原成「未打补丁」的规范形态。
 *   2026-10-03 第一版就踩过：`String.replace` 的替换串里写 `'$1' + prelude(...)`，而 prelude 里
 *   `ffprobe … "$1"` 的 `$1` 被 JS 当成**捕获组回填**，把 dur() 写成了 `… "$<VF 行内容>" …` ⇒ 补丁形同虚设、帧数照旧被切）。
 *
 * ★ 第二处坑（同轮）：**`#` 注释不能插进 `\` 续行的中间** —— 续行把两条物理行并成一条逻辑行，
 *   插进去的 `#` 会把逻辑行后半段（含真正的 ffmpeg 参数）整段注释掉。所以注释一律插到
 *   **「包含 TP 的整条语句的起始行」之前**（见 statementStart()）。
 *
 * 用法：node scripts/patch-style-mux.mjs [--dry] [--only a,b] [--revert]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
// ★ 库根（WIN / WSL）+ 发行版：**默认值**取自 `lib/env.mjs` 的 `CFG`（= 编排器 `CFG` 的镜像，
//   唯一真相来源），同时认全仓同名同义的覆盖点（与 `check-dual-copy-sync.mjs` **完全一致**：
//   `LEMO_OPUSCAR` / `LEMO_WSL_ROOT` / `LEMO_WSL_DISTRO`）—— 补覆盖点的目的**不是**改判据，
//   而是让本脚本**能**用临时树做非破坏变异验证，而不是只能动真库。
//   本脚本原先硬编码 `'D:/lemo-opuscar'` / `'/home/lemo/lemo-opuscar'` / `'Ubuntu-24.04'`，
//   另加下面那次 `sh -n` 校验里的 `/mnt/d/lemo-opuscar` —— 同一个「库根」共**四处**来源。
//   ★ 不设任何覆盖点时，解析结果与旧字面量**逐字节相同**（见 b83-c2 报告）。
import { CFG } from '../lib/env.mjs';

const WIN = path.resolve(process.env.LEMO_OPUSCAR || CFG.winLib);
const WSL = process.env.LEMO_WSL_ROOT || CFG.wslLib;
const DISTRO = process.env.LEMO_WSL_DISTRO || CFG.wslDistro;
// ★ Windows 绝对路径 → WSL 的 `/mnt/<盘符>/…` 形态（正斜杠）。
//   原先下面那次 `sh -n` 校验里硬编码了 `/mnt/d/lemo-opuscar`（第五处来源）。
const winToMnt = (p) => `/mnt/${p[0].toLowerCase()}${p.slice(2).replace(/\\/g, '/')}`;

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const REVERT = argv.includes('--revert');
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const only = (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

// 13 个副本：
//   · 9 个走 demo/tools/mux.sh（编排器**真正采用**，接口匹配）—— 两项补丁都要；
//     crf = 它自己的 CRF 字面量；tune = 是否 -tune grain；onlyEnc = woodcut 特例。
//   · 4 个（paper-popup / pictogram-motion / watercolor 的 demo/mux.sh；game-show 的 demo/finish.sh）
//     接口不匹配、编排器回退 core，对流水线无影响 —— 只回灌 AAC 余量（tpOnly），不碰编码器/补静音。
//   tp0 = 该文件原本的 loudnorm TP 字面量（归一化时还原用）；null = 它根本没有 loudnorm TP 行。
const TARGETS = [
  // ── 9 个 demo/tools/mux.sh：补丁 A + 补丁 B ──
  { slug: 'backrooms', crf: 24, tp: true, tp0: '-1.2' },
  { slug: 'cel-anime-80s', crf: 23, tp: true, tp0: '-1.2' },
  { slug: 'crayon-book', crf: 19, tp: true, tp0: '-1.2' },
  { slug: 'microgame', crf: 19, tp: true, tp0: '-1.2' },
  { slug: 'risograph', crf: 16, tune: true, tp: true, tp0: '-1.2' },
  { slug: 'shadow-puppet', crf: 22, tp: true, tp0: '-1.2' },
  { slug: 'spy-titles', crf: 19, tp: true, tp0: '-1.2' },
  { slug: 'stained-glass', crf: 22, tp: true, tp0: '-1.2' },
  // woodcut 先调 core（core 现为 LN_TP 可覆盖、默认 −3.5）再 -c:a copy，自身没有 loudnorm ⇒ TP 补丁自动跳过
  { slug: 'woodcut', crf: 28, tune: true, onlyEnc: true, tp: true, tp0: null },
  // ── 4 个接口不匹配的副本：只补丁 B ──
  { slug: 'paper-popup', rel: 'styles/paper-popup/demo/mux.sh', tpOnly: true, tp: true, tp0: '-1.2' },
  // pictogram-motion 直接 -c:a aac、不经 loudnorm ⇒ TP 补丁自动跳过
  { slug: 'pictogram-motion', rel: 'styles/pictogram-motion/demo/mux.sh', tpOnly: true, tp: true, tp0: null },
  { slug: 'watercolor', rel: 'styles/watercolor/demo/mux.sh', tpOnly: true, tp: true, tp0: '-1' },
  { slug: 'game-show', rel: 'styles/game-show/demo/finish.sh', tpOnly: true, tp: true, tp0: '-1.2' },
];

const MARK = '── 本地补丁（2026-10-03 回灌 core/render/mux.sh）──';
// ★★ 2026-10-07：判「文件是否已打过补丁」**不能**拿 `MARK` 做 `includes`。实测 9 个目标里 8 个
//   （backrooms / cel-anime-80s / crayon-book / microgame / risograph / shadow-puppet /
//    spy-titles / stained-glass）的标记都被人手工在括号里插了「保留，」
//   （`# ── 本地补丁（保留，2026-10-03 回灌 core/render/mux.sh）──`，示意「已回灌 core，勿删」）。
//   逐字比对在那 8 个文件上全部失效 ⇒ 后果不只是「认不出已打过补丁」：`normalize()` 找不到标记
//   ⇒ 不删旧块，而它第 ② 步又把 `$VARG` 还原成 libx264 字面量 ⇒ `applyPatch()` 误以为「未打补丁」
//   而**再插一块**，把手工升级过的补丁块（更严的 `case`）冲掉 ⇒ 重跑一次会写坏文件。
//   ⇒ 改认**骨架**（括号内允许插字），与 `check-mux-parity.mjs` 的 `appliedMark` **同构**（两边口径一致）。
const MARK_RE = /^\s*#.*本地补丁（[^）]*回灌 core\/render\/mux\.sh）──\s*$/m;
/** 该文件里是否已有「本地补丁」哨兵（容忍手工在括号内插字）。 */
const hasMark = (text) => MARK_RE.test(text);

// ── 补丁 B（AAC 编码余量）的注释标记与正文 ──
// 正文刻意写成**不含** `:TP=` 前缀的形式，免得被 TP 正则误伤；标记用 TP_MARK 单独认。
const TP_MARK = 'AAC 编码余量（2026-10-03 回灌 core/render/mux.sh 的 LN_TP=-1.7）';
const TP_NOTE =
  `# ── ${TP_MARK} ── loudnorm 的 TP 目标 −1.7 比交付目标 −1.2 低 0.5 dB，` +
  `那 0.5 dB 是留给 AAC 有损编码过冲的余量；与 core/render/mux.sh 的 LN_TP=-1.7 对齐`;

/** loudnorm 里待改的 TP 字面量：`:TP=-1.2` 或 `:TP=-1`（后面必跟 `:`）。每次新建正则，避免 lastIndex 状态。 */
const tpRe = () => /:TP=-(?:1\.2|1)(?=:)/g;

/** 把文件还原成「未打补丁」的规范形态（去掉两处补丁、把 $VARG/$PAD/:TP 换回原文）。 */
function normalize(text, t) {
  let out = text;
  // ① 去掉「编码器 + 补静音」补丁块：从 MARK 行到其后第一条独立的 `esac`
  if (hasMark(out)) {
    const lines = out.split('\n');
    const i = lines.findIndex((l) => MARK_RE.test(l));
    if (i >= 0) {
      let j = i;
      while (j < lines.length && !/^esac\s*$/.test(lines[j])) j++;
      lines.splice(i, j - i + 1);
      out = lines.join('\n');
    }
  }
  // ② $VARG → 原来的 libx264 片段（统一成规范写法，与原文等价）
  const tune = t.tune ? ' -tune grain' : '';
  out = out.replace(/\$VARG\b/g, `-c:v libx264 -preset slow -crf \${CRF:-${t.crf}}${tune}`);
  // ③ $PAD 去掉
  out = out.replace(/aresample=48000\$PAD\[a\]/g, 'aresample=48000[a]');
  // ④ 去掉「AAC 编码余量」注释行
  if (out.includes(TP_MARK)) out = out.split('\n').filter((l) => !l.includes(TP_MARK)).join('\n');
  // ⑤ :TP=-1.7 → 还原成该文件原来的值
  if (t.tp && t.tp0) out = out.replace(/:TP=-1\.7(?=:)/g, () => `:TP=${t.tp0}`);
  return out;
}

/** 生成插入到 ffmpeg 调用之前的「编码器 + 补静音」补丁块。 */
function prelude(crf, tune) {
  return `# ${MARK}
#   ① 音频比画面短 → 补静音到「画面长度 + 一帧」，否则 -shortest 切掉最后一帧（编排器判 MUX_FAIL 帧数不符）
#   ② 编码器跟随 LEMO_VENC（编排器默认导出 h264_nvenc）—— 硬规则：合成渲染走本地 GPU
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null | head -1; }
VD=$(dur "$V"); AD=$(dur "$A"); PAD=""
if awk -v a="$AD" -v v="$VD" 'BEGIN { exit !(a + 0 > 0 && v + 0 > 0 && a + 0 < v - 1e-6) }'; then
  PD=$(awk -v v="$VD" -v f="$FPS" 'BEGIN { printf "%.6f", v + 1 / f }')
  PAD=",apad=whole_dur=$PD"
  echo "mux.sh: note: audio ($AD s) shorter than video ($VD s); padding to $PD s (one frame past, so -shortest cannot clip)" >&2
fi
CRF="\${CRF:-${crf}}"; TUNE="${tune}"
case "\${LEMO_VENC:-}" in
  h264_nvenc) VARG="-c:v h264_nvenc -preset p5 -profile high -rc vbr -cq $(awk -v c="$CRF" 'BEGIN{printf "%d",(c+0)+4}') -b:v 0";;
  *|libx264) VARG="-c:v libx264 -preset slow -crf $CRF $TUNE";;
esac
`;
}

/** 补丁 A：打「编码器 + 补静音」。用**函数式 replace**（不是替换串）—— 见文件头那条踩坑说明。 */
function applyPatch(text, t) {
  if (hasMark(text)) return { text, changed: false, why: '已打过补丁' };
  const tune = t.tune ? ' -tune grain' : '';
  const encRe = /-c:v libx264 -preset slow -crf ["']?(?:\$\{CRF:-)?\d+\}?["']?(?: -tune grain)?/;
  if (!encRe.test(text)) return { text, changed: false, why: '找不到 libx264 片段' };

  const blk = prelude(t.crf, tune);
  let out = text;

  if (t.onlyEnc) {
    // woodcut 特例：它先调 core/render/mux.sh（那份已有补静音修好，帧数正确）再二次编码，
    // 所以只需要「编码器跟随 LEMO_VENC」这半条补丁，不需要 PAD。
    const lines = out.split('\n');
    const idx = lines.findIndex((l) => l.includes('-c:v libx264'));
    if (idx < 0) return { text, changed: false, why: '定位不到编码行' };
    lines.splice(idx, 0, blk.replace(/\n$/, ''));
    out = lines.join('\n');
    out = out.replace(encRe, () => '$VARG');
    return { text: out, changed: true, why: `crf=${t.crf}${tune}（woodcut 特例：只换编码器）` };
  }

  // 通用：补丁块插到 VF= 行之后（cel-anime-80s 无 VF 行，退到 LN= 行之后）
  const a1 = /^(if \[ "\$GR" = "0" \]; then VF=.*\n)/m;
  const a2 = /^(LN="loudnorm.*\n)/m;
  if (a1.test(out)) out = out.replace(a1, (m, g1) => g1 + blk);
  else if (a2.test(out)) out = out.replace(a2, (m, g1) => g1 + blk);
  else return { text, changed: false, why: '找不到插入锚点（VF= / LN= 都没有）' };

  if (!out.includes(',aresample=48000$PAD[a]')) {
    if (out.includes(',aresample=48000[a]')) out = out.replace(',aresample=48000[a]', () => ',aresample=48000$PAD[a]');
    else return { text, changed: false, why: '找不到 aresample=48000[a]' };
  }
  out = out.replace(encRe, () => '$VARG');
  return { text: out, changed: true, why: `crf=${t.crf}${tune}` };
}

/** 找「包含第 idx 行的整条 shell 语句」的起始行（用于安全插入 `#` 注释，避开 `\` 续行）。 */
function statementStart(lines, idx) {
  let s = idx;
  while (s > 0 && /\\\s*$/.test(lines[s - 1])) s--;
  return s;
}

/** 补丁 B：把 `:TP=-1.2` / `:TP=-1` 改成 `:TP=-1.7`，并在整条语句起始行之前加一行注释。 */
function applyTp(text, t) {
  if (!t.tp) return { text, changed: false, why: '未纳入 TP 回灌' };
  if (text.includes(TP_MARK)) return { text, changed: false, why: '已打过 TP 补丁' };
  // ★★ 2026-10-03 新增守卫：若该文件已改成「可覆盖 + 默认 −3.5」的新形态（含 LEMO_LN_TP），
  //   就不要再打旧补丁 —— 否则会插回一条写着「LN_TP=-1.7」的过期注释，误导后人；
  //   而且 normalize() 的第 ⑤ 步还会去改测量命令里的 :TP=-1.7:（虽然净效果为零，但没必要动）。
  if (text.includes('LEMO_LN_TP')) return { text, changed: false, why: '已是新形态（LEMO_LN_TP 可覆盖 + 默认 −3.5），跳过旧 TP 补丁' };
  const hits = text.match(tpRe());
  if (!hits) return { text, changed: false, why: '无 loudnorm TP 行（无需改动）' };

  const lines = text.split('\n');
  const idx = lines.findIndex((l) => tpRe().test(l));
  const s = statementStart(lines, idx);        // 插到语句起始行之前，避免 `#` 吞掉续行
  lines.splice(s, 0, TP_NOTE);
  const out = lines.join('\n').replace(tpRe(), () => ':TP=-1.7');
  return { text: out, changed: true, why: `${t.tp0 || '原值'} → -1.7（${hits.length} 处）` };
}

/** 依次打两项补丁（各自独立；任一项不适用都不阻断另一项）。 */
function patchAll(text, t) {
  const notes = [];
  let out = text, changed = false;
  if (!t.tpOnly) {
    const r = applyPatch(out, t);
    if (r.changed) { out = r.text; changed = true; }
    notes.push(`编码器+补静音：${r.why}`);
  }
  if (t.tp) {
    const r = applyTp(out, t);
    if (r.changed) { out = r.text; changed = true; }
    notes.push(`AAC 余量：${r.why}`);
  }
  return { text: out, changed, why: notes.join(' / ') };
}

/** 行级 diff（LCS），给 --dry 打印「改哪一行、before→after」。 */
function lcsDiff(a, b) {
  const A = a.split('\n'), B = b.split('\n');
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ op: ' ', line: i + 1, text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: '-', line: i + 1, text: A[i] }); i++; }
    else { out.push({ op: '+', line: j + 1, text: B[j] }); j++; }
  }
  while (i < n) out.push({ op: '-', line: i + 1, text: A[i++] });
  while (j < m) out.push({ op: '+', line: j + 1, text: B[j++] });
  return out;
}

function sh(cmd, args) {
  return new Promise((r) => {
    const c = spawn(cmd, args, { windowsHide: true });
    let o = '', e = '';
    c.stdout.on('data', (d) => { o += d; });
    c.stderr.on('data', (d) => { e += d; });
    c.on('close', (code) => r({ code, o, e }));
    c.on('error', (x) => r({ code: -1, o, e: String(x.message) }));
  });
}

const list = TARGETS.filter((t) => !only.length || only.includes(t.slug));
console.log(`\n${REVERT ? '还原' : '回灌'} ${list.length} 个风格自带 mux/finish 脚本${DRY ? '（--dry 只打印）' : ''}\n`);

let nChanged = 0, nSkip = 0, nFail = 0;
for (const t of list) {
  const rel = t.rel || `styles/${t.slug}/demo/tools/mux.sh`;
  const winPath = path.join(WIN, rel);
  if (!fs.existsSync(winPath)) { console.log(`  ✘ ${t.slug}：找不到 ${winPath}`); nFail++; continue; }
  const src = fs.readFileSync(winPath, 'utf8');
  // ★★ 2026-10-07 新增早退守卫（幂等）：文件已带「本地补丁」哨兵 ⇒ 认为已回灌过，**跳过**。
  //   ① 必须在 normalize() **之前**判：normalize() 第 ① 步会把补丁块整块删掉，之后再看标记就晚了。
  //      旧写法把「已打过补丁」的判定放在 applyPatch() 里，而主流程传给 applyPatch() 的**永远是
  //      normalize() 之后的文本**（块已被删）⇒ 那条分支在主流程里根本**不可达**，幂等实际只靠
  //      「往返逐字节相等」兜底。一旦补丁块被手工升级过（实测 9 个目标全是），往返就不再相等
  //      ⇒ 重跑会把手工升级**冲掉**（实测真库 `--dry`：8 个被 LEMO_LN_TP 守卫挡住，`woodcut` 会被改写）。
  //   ② 哨兵判定用容忍骨架（见 `hasMark`），否则认不出那 8 个插了「保留，」的文件。
  //   ★ 要改 / 要修已打过补丁的文件，先 `--revert`（normalize 走同一个容忍骨架），再跑本脚本。
  if (!REVERT && hasMark(src)) {
    console.log(`  · ${t.slug}：跳过（已打过补丁，幂等${src.includes('LEMO_LN_TP') ? '；且已是新形态：LEMO_LN_TP 可覆盖 + 默认 −3.5' : ''}）`);
    nSkip++; continue;
  }
  // ★★ 2026-10-03 新增早退守卫：该文件已升级为「TP 可覆盖 + 默认 −3.5 + 真峰值复核块」的新形态。
  //   此时既不该打旧补丁（会插回写着 LN_TP=-1.7 的过期注释），
  //   也不该走 normalize()（它第 ⑤ 步会把**测量命令**里的 :TP=-1.7: 改回 :TP=-1.2:，
  //   虽然对 input_tp 读数无影响，但会让文件与其余副本不一致）。
  //   ★ 没有补丁块、只升级了 TP 形态的副本（paper-popup / watercolor / game-show）仍由这条挡住。
  if (src.includes('LEMO_LN_TP')) { console.log(`  · ${t.slug}：跳过（已是新形态：LEMO_LN_TP 可覆盖 + 默认 −3.5）`); nSkip++; continue; }
  const norm = normalize(src, t);
  const wasPatched = hasMark(src) || src.includes(TP_MARK);

  let finalText = norm;
  let why = '';
  if (!REVERT) {
    const r = patchAll(norm, t);
    if (!r.changed) { console.log(`  · ${t.slug}：跳过（${r.why}）`); nSkip++; continue; }
    finalText = r.text;
    why = r.why;
  } else if (!wasPatched) {
    console.log(`  · ${t.slug}：未打过补丁，跳过`); nSkip++; continue;
  }
  if (finalText === src) { console.log(`  · ${t.slug}：内容无变化，跳过`); nSkip++; continue; }

  if (DRY) {
    console.log(`  ~ ${t.slug}  [${rel}]`);
    console.log(`      ${REVERT ? '将还原' : '将打补丁'}${wasPatched ? '（检测到已有补丁，先归一化）' : ''}  ${why}`);
    for (const d of lcsDiff(src, finalText)) {
      if (d.op === ' ') continue;
      console.log(`      ${d.op === '-' ? 'before' : 'after '} L${d.line}: ${d.text}`);
    }
    nChanged++;
    continue;
  }

  fs.writeFileSync(winPath, finalText, 'utf8');
  const b64 = Buffer.from(finalText, 'utf8').toString('base64');
  const r = await sh('wsl.exe', ['-d', DISTRO, '-u', 'root', '-e', 'bash', '-c',
    `printf %s '${b64}' | base64 -d > ${WSL}/${rel} && tr -d "\\r" < ${WSL}/${rel} > ${WSL}/${rel}.tmp && mv ${WSL}/${rel}.tmp ${WSL}/${rel} && sh -n ${WSL}/${rel} && echo WSL_OK`]);
  const rc = await sh('wsl.exe', ['-d', DISTRO, '-u', 'root', '-e', 'bash', '-c',
    `sh -n ${winToMnt(WIN)}/${rel} && echo WIN_OK`]);
  const wslOk = String(r.o).includes('WSL_OK');
  const winOk = String(rc.o).includes('WIN_OK');
  console.log(`  ${wslOk && winOk ? '✔' : '✘'} ${t.slug}  ${why}  WSL=${wslOk ? 'ok' : 'FAIL'} WIN=${winOk ? 'ok' : 'FAIL'}${wasPatched ? '  （已先归一化）' : ''}`);
  if (!wslOk || !winOk) { nFail++; console.log(`      WSL=${JSON.stringify(String(r.o + r.e).slice(0, 200))} WIN=${JSON.stringify(String(rc.o + rc.e).slice(0, 200))}`); }
  else nChanged++;
}
console.log(`\n汇总：改动 ${nChanged}，跳过 ${nSkip}，失败 ${nFail}\n`);
