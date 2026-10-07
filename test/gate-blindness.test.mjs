#!/usr/bin/env node
/**
 * test/gate-blindness.test.mjs —— 「闸门**守卫** + 闸门**核心判据**」的**回归套件**（零依赖）
 *
 * 用法：node test/gate-blindness.test.mjs
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 本套件覆盖**两类**回归（2026-10-07 扩批后共 84 条用例 / 覆盖全部 35 个闸门）
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① **失明 / 空转守卫**（绝大多数用例）：闸门的循环把对象全 `continue` 掉、`fails`/`blind`
 *      双空 ⇒ 打印 `✓` + exit 0，其实一个东西都没检查。近几批至少出现 6 次以上，
 *      **每次都是人工发现**。这些守卫的**证据只写在闸门的头注释里**（那是档案，不是测试）
 *      —— 没有任何**自动化**手段防止它们被改回去。
 *   ② **核心判据**（12 条，2026-10-07 补/扩）：**不是**空转，而是「闸门真的判了、但判错/判漏」的
 *      那几条主判据 —— 它们同样是「读起来像已完成」的缺陷，只有夹具级回归能钉住：
 *        · `check-lra-caliber`：文档里的 LRA 看起来是 **loudnorm** 口径 ⇒ 判**不符**；
 *        · `check-loudness-targets`：响度目标**偏离 −14 交付线** ⇒ FAIL；
 *        · `check-plate-pixel`：**品红标记测试失败**（底衬色写错字段）⇒ 判**真缺陷**；
 *        · `check-shell-structure`：**② 判定块结尾缺 `exit 0`** ⇒ FAIL；
 *        · `check-cli-docs`：**notImpl**（文档写了但没实现）/ **notDoc**（实现了但没写文档）⇒ FAIL；
 *        · `check-tp-prose` ⑤：一行**只含 `修复后`** 不算历史语境 ⇒ 该行的成片读数**照判**
 *          （b83-a2：`修复后` 移出 HIST —— 旧版靠它豁免整行，`pictogram-motion:107` 四处陈旧读数就这么被吞）；
 *        · `check-tp-prose` ⑦：**同一句**里既有上游证据词（`mix.wav`）**又有**成片读数 ⇒ 只判
 *          成片那半句（b83-a 收窄：证据词须同句、且读数未被 `成片/全片/本片` 显式归因）；
 *        · `check-tp-prose` ⑨：别的风格名**不在同一子句** ⇒ 不算交叉引用 ⇒ 照判（b83-a 收窄：
 *          由「整行」收到「同一子句」，分隔符 `。！？；;`）。
 *        · `check-skill-film-fields` ⑨：同型（b84-a 收窄：由「整行」收到「同一子句」，分隔符与
 *          `check-tp-prose` 同一套）—— 读数在前子句、别的风格名在后子句 ⇒ 照判；
 *        · `check-skill-film-fields` WxH 朝向守卫（b84-a 补）：9:16 变体（竖画幅）⇒ **参考桶**、不判 FAIL，
 *          而同朝向的变体（如 1600×900）仍照判 —— ⑨ 收窄后暴露的 ⑧ 缺口，与 `check-tp-prose` b83-a 同源。
 *        · `check-mux-parity`（b84-c 建 / b84-a 并入）：**自带 `demo/mux.sh` 的 `LN_TP` 漂移** ⇒ 点名 slug 与那个值；
 *          **编码器守卫被拆**（未设支改成 CPU）⇒ 报 `VENC_GUARD`（用户头号硬规则「渲染一律 GPU」的落地口）；
 *          另有**本闸门独有**的一条守卫：`styles/` 有风格但**一个自带 `demo/mux.sh` 都没有** ⇒ 报「一个都枚举不到」。
 *        · `check-env-overrides`（2026-10-07 建，补一个**已由多批实测确认的缺口**）：**环境变量覆盖点的双向守卫** ——
 *          ① **未登记的新覆盖点**（`lib/aspects.mjs` 里塞一行 `process.env.LEMO_ZZZ_PROBE`）⇒ FAIL 并点名 `文件:行 + 变量名`；
 *          ② **已登记的覆盖点被删**（把 `lib/voices.mjs` 的 `LEMO_VOICE_TEST_TMP` 删成裸标识符）⇒ FAIL 并报「被删了 / 改名了」。
 *          它守的是「夹具会**静默跑在真实仓上**」这件事 —— 覆盖点一丢，**没有任何断言会响**（见闸门头注释 ① 的三处实证）。
 *          ★ 夹具**整棵拷真实语料**（判据② 要求登记表里 100 个「(覆盖点, 读者文件)」对逐个仍在 ⇒ 手写最小树等于抄第二遍登记表）。
 *        · `check-env-overrides` **库仓侧扩展**（2026-10-07，补掉它自己登记的那条盲区；**闸门数不变**）：
 *          **判据⑤ 表↔代码一致性** —— 库仓 `core/**` **与 `tools/**`** 里**代码真在读**的环境变量必须出现在
 *          `core/README.md` 的 `## Environment variables`（含 `### tools/ ...` 小节）表里
 *          （本项目铁律「文档声称值 vs 实测值」在 env 这一维）；
 *          用例：**变异A**（合成库仓的 `core/README.md` 删掉 `LEMO_BBB` 行）⇒ FAIL 并点名；
 *          **变异B**（`core/a.mjs` 加 `process.env.LEMO_ZZZ_PROBE`）⇒ FAIL 并点名；
 *          ★ **2026-10-07 二次扩展**：`tools/**` **并入判据⑤**（原先只列不判 ⇒ 挡不住下一次再漏）。
 *          用例：**变异A′**（删掉新 `### tools/ ...` 小节里的 `LEMO_TOOLONLY` 行）⇒ FAIL 并点名 `[tools]`；
 *          **变异B′**（`tools/x.sh` 加 `${LEMO_TOOL_PROBE:-y}`）⇒ FAIL 并点名 `[tools]`；
 *          **反向**（把 `tools/**` 从判据⑤ 摘掉）⇒ A′/B′ **重新变绿**；
 *          **阴性对照**（表与代码一致）⇒ exit 0 且判据⑤ 打 ✓、判据⑥ 逐条列出「表里多列」；
 *          **判据⑧ 失明守卫**（库仓可达但 `core/**` 0 个 env 读取点 / `tools/**` 0 个待扫文件）⇒ FAIL +「本闸门已失明（库仓侧）」；
 *          **不可达**（`LEMO_OPUSCAR` 指空目录）⇒ **只 ℹ、exit 0**（与失明成对，证明守卫不是「永远 exit 1」）。
 *          ★ 夹具用**手写的合成库仓**（库仓是**另一个仓**，不能假设它在别人机器上存在）；
 *          它**不碰** 12b 那张 100 对登记表 ⇒ 不会退化成「抄第二遍」。
 *        · `check-distill-fields`（2026-10-07 建，`_distill.json` **字段路径**的「登记表 + 双向守卫」）：
 *          ① **未登记字段**（临时语料里塞 `selfCheck.LEMO_ZZZ_PROBE`）⇒ FAIL 并点名 `slug + 字段路径`；
 *          ② **覆盖声明失效**（登记表某条 `coveredBy` 改成不存在的 `check-zzz-not-exist.mjs`）⇒ FAIL 并点名；
 *          ③ **变异 C**（把已登记的 `selfCheck.muxEncoder` 从**全部** json 删掉）⇒ **仍 exit 0**
 *            —— 钉住判据② 的**语义**：「登记了但**闸门**不在了才红」，**不是**「字段消失了就红」；
 *          ④ **失明三态**（空风格树 / 数据里 0 字段 / 空登记表）⇒ FAIL +「本闸门已**失明**」；
 *          ★ 夹具**整棵拷真实 `_distill.json` 语料**（276 条登记表抄第二遍必然漂移）；
 *            要变异**登记表**本身时只能「拷闸门 + `LEMO_TOOLS_ROOT` 指回真实仓」（判据② 才找得到那些闸门）。
 *   ⇒ 两类**共用同一套断言纪律**（见下）。文件名保持 `gate-blindness`（改名会牵动
 *     `test/README.md` 与登记判据），但本文件的**定位**是「闸门守卫 + 核心判据」回归，
 *     不只是失明。
 *
 * ★★ 最重要的纪律：断言必须匹配「**为什么失败**」，不能只看退出码。
 *   本项目反复治过一类病叫「匹配判据可被无关代码满足」—— 若只断言 `exit !== 0`，
 *   那么**任何**让闸门崩溃的原因（路径拼错、文件不存在、JSON 坏、参数写错）都会让测试"通过"，
 *   而真正的守卫被删掉了它也照样绿。**本套件自己绝不能犯这个病**，所以：
 *     · 每个正向用例都断言输出里出现**该闸门特有的文案片段**（失明文案 / 判据文案，
 *       一律逐字抄自该闸门源码）；
 *     · 每个用例都配一条**阴性对照**（最小合法夹具 ⇒ exit 0 且**不含**那句文案）
 *       —— 否则一个「永远 exit 1」的坏断言也能让测试全绿；
 *     · 另有若干「**故意破坏**」自证用例：把被测闸门拷到临时目录、**删掉它的守卫/判据**，
 *       再跑同一套断言，**必须变红** —— 这证明断言真的在测那个守卫，而不是在测「闸门有没有崩」。
 *
 * ★ 技术纪律（本项目踩过的坑）：
 *   · `spawnSync` / `execFileSync` 在本机一律 EBUSY ⇒ **只能用异步 `spawn`**；
 *   · 所有临时文件放 **非 C 盘**（`D:/lemo-tmp/gb-blind-<pid>/`），跑完按**确切路径**清理，不留垃圾；
 *     ★ 根目录**按进程唯一**（带 `process.pid`）—— 曾用写死的 `D:/lemo-tmp/gb-blind`，
 *       而套件开头 `rm(TMP); mk(TMP)`、末尾 `rm(TMP)` ⇒ **两个进程同时跑会互删对方夹具**
 *       （实测并发：一次 18~23 failed，单独跑 77 passed）。WSL 侧同理（`/tmp/gb-blind-neg-<pid>`）。
 *   · **绝不改真实数据**（`lib/dub-styles.json` / `lib/style-skills/` / 真实 `_distill.json` 一律只读）；
 *   · 独立入口、不用外部测试框架（项目零依赖）。
 *
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

// ── 常量 ────────────────────────────────────────────────────────────────────
const TOOLS = 'D:/lemo-tools';
const SCRIPTS = path.join(TOOLS, 'scripts');
// ★ 临时根**按进程唯一**（带 `process.pid`）：套件开头 `rm(TMP); mk(TMP)`、末尾 `rm(TMP)`，
//   若用写死的共享路径，两个进程同时跑就会互删对方夹具（实测并发 18~23 failed / 单独 77 passed）。
//   非 C 盘（本项目纪律）；父目录由 `mk()` 的 recursive 建出，跑完整棵按确切路径删掉。
const TMP = path.join('D:/lemo-tmp', `gb-blind-${process.pid}`);
const NODE = process.execPath;               // 本测试就是被目标 node 跑的 ⇒ 自洽

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
  b: (s) => (TTY ? `\x1b[1m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

/** 干净的基础环境：**剔除**任何继承来的 `LEMO_*`（否则父进程的覆盖点会污染用例）。 */
const BASE_ENV = (() => {
  const e = { ...process.env };
  for (const k of Object.keys(e)) if (/^LEMO_/.test(k)) delete e[k];
  return e;
})();

/**
 * 异步跑一个进程，合并 stdout+stderr。
 * ★ 一律异步 `spawn` —— 本机 `spawnSync`/`execFileSync` 会 EBUSY。
 */
const run = (cmd, args, { env = {}, cwd = TOOLS, timeout = 120000 } = {}) =>
  new Promise((res) => {
    const p = spawn(cmd, args, { cwd, env: { ...BASE_ENV, ...env }, windowsHide: true });
    let o = '';
    p.stdout.on('data', (d) => { o += d; });
    p.stderr.on('data', (d) => { o += d; });
    const t = setTimeout(() => { try { p.kill(); } catch { /* ignore */ } res({ code: -999, out: `${o}\n[TIMEOUT ${timeout}ms]` }); }, timeout);
    p.on('error', (e) => { clearTimeout(t); res({ code: -1, out: `${o}\n[SPAWN ERROR] ${e.message}` }); });
    p.on('close', (code) => { clearTimeout(t); res({ code, out: o }); });
  });

/** 跑 `scripts/<name>`（真实闸门）。 */
const runGate = (name, env) => run(NODE, [path.join(SCRIPTS, name)], { env });

/** 跑 `scripts/<name>` 并带命令行参数。 */
const runGateArgs = (name, args, env) =>
  run(NODE, [path.join(SCRIPTS, name), ...args], { env });

/** 拷一个闸门到 `<root>/scripts/<name>`，返回副本路径（供「落点写死在脚本位置」的闸门做非破坏变异）。 */
const copyGate = (name, root) => {
  const out = path.join(root, 'scripts', name);
  mk(path.dirname(out));
  fs.copyFileSync(path.join(SCRIPTS, name), out);
  return out;
};

/**
 * 把闸门源码拷到临时目录，并做**若干处精确替换**（用于「扫描根写死在源码里、
 * 没有覆盖点环境变量」的闸门：把那个常量重定向到夹具根）。
 * ★ 两道防空转守卫与 `mutate()` 同源：**先断言待替换片段确实存在**、**再断言替换真的生效** ——
 *   否则闸门改了写法时，夹具会静默地继续跑在**真实仓**上，用例就变成了假绿。
 * ★ `subs` 每项是 `[from, to]`：`from` 可为**字符串**（既有用法）或 **RegExp**（2026-10-07 b84-a 扩：
 *   要删/清空「多行对象字面量」这类片段时只能靠正则）。两条守卫对两种形态一视同仁。
 */
const patchGate = (gateName, outDir, subs) => {
  let src = fs.readFileSync(path.join(SCRIPTS, gateName), 'utf8');
  for (const [from, to] of subs) {
    // ★ RegExp 形态：`includes` 不接受正则（会抛 TypeError），故分派；带 `g` 的正则先复位 lastIndex。
    if (from instanceof RegExp) from.lastIndex = 0;
    const found = from instanceof RegExp ? from.test(src) : src.includes(from);
    assert.ok(found,
      `夹具自身失效：${gateName} 里找不到待重定向的片段（源码已变？）\n---\n${from}\n---`);
    const next = src.replace(from, to);
    assert.notEqual(next, src, `夹具自身失效：${gateName} 的替换没有生效\n---\n${from}\n---`);
    src = next;
  }
  const out = path.join(outDir, gateName);
  wf(out, src);
  return out;
};

/** Windows 绝对路径 → 正斜杠形式（要塞进闸门源码的字符串字面量里时用，避免 `\` 被当转义）。 */
const fwd = (p) => p.replace(/\\/g, '/');

/** 异步跑 git（`spawnSync` 在本机 EBUSY ⇒ 只能异步）。 */
const git = (args) => run('git', args, { cwd: TOOLS });

/** 异步跑 WSL 里的一条 bash 命令（`spawnSync`/`execFileSync` 在本机 EBUSY）。 */
const wsl = (script) => run('wsl.exe', ['-d', 'Ubuntu-24.04', '-e', 'bash', '-lc', script]);

/** 本机 ffmpeg（Windows 侧，CPU 编码 —— 不碰 GPU）。 */
const FFMPEG = 'D:/ffmpeg-9.x/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
/** 同目录的 ffprobe（闸门自己也是这么推出来的）。 */
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/, 'ffprobe.exe');

// ── 夹具小工具 ───────────────────────────────────────────────────────────────
const mk = (p) => fs.mkdirSync(p, { recursive: true });
const wf = (p, s) => { mk(path.dirname(p)); fs.writeFileSync(p, s, 'utf8'); };
const rj = (p, o) => wf(p, `${JSON.stringify(o, null, 2)}\n`);
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });

/** 建一个「风格技能树」：<root>/<slug>/SKILL.md + _distill.json。 */
const skillTree = (root, slug, skillMd, distill) => {
  wf(path.join(root, slug, 'SKILL.md'), skillMd);
  rj(path.join(root, slug, '_distill.json'), distill);
  return root;
};

/**
 * 一份「真值齐全」的 `_distill.json` —— 缺任何一维都会让 check-tp-prose 报「该量纲已失明」。
 * ★ 2026-10-07 起还**必须**带一条**与本 json 权威 `truePeakDbtp` 一致**的散文读数（`selfCheck.peakNote`）：
 *   check-tp-prose 的 **json 散文失明守卫**规定「只要读到了 `_distill.json`，白名单散文里就必须有
 *   ≥1 个可核读数」，否则报「本闸门已失明（json 散文）」exit 1。真实 `_distill.json` 43/43 都有
 *   `peakNote` ⇒ 夹具补上这一字段才与真语料同形（否则「最小合法夹具」会被失明守卫误判为红）。
 * ★ `truePeakDbtp`（实测真值 −1.25）**必须 ≠** `peakDbtpTarget`（交付线 −1.2）：`peakNote` 的覆盖级
 *   判据 (J5) 会把「恰好等于交付线」的那个读数当**交付线本身**放掉；真语料 43/43 都是「实测 ≠ 交付线」
 *   （实测统计：`truePeakDbtp == peakDbtpTarget` 的风格 0 个）⇒ 夹具按真语料形态取值，note 才核得中。
 */
const tpDistill = (over = {}) => ({
  generatedVideo: { bytes: 1000000, durSec: 60, width: 1920, height: 1080, frames: 1500 },
  selfCheck: {
    peakNote: '本片成片实测真峰值 input_tp = −1.25 dBTP（本片成片实测）。',
    loudness: {
      truePeakDbtp: -1.25, integratedLufs: -14.2, lra: 3.2, peakDbtpTarget: -1.2, samplePeakDbfs: -1.3,
    },
  },
  ...over,
});

/**
 * 把 `lib/dub-core.mjs` 及其**传递闭包**拷进夹具根（2026-10-07 补）。
 *   · `dub-core.mjs` → `./env.mjs` → `./styles-root.mjs`（**无环**；核法 `grep -n "^import" lib/dub-core.mjs lib/env.mjs lib/styles-root.mjs`）。
 *   · ★ 只拷 `dub-core.mjs` 会让夹具子进程 `ERR_MODULE_NOT_FOUND` **崩掉** ⇒ 闸门**特有的**文案不出现，
 *     断言就会以「闸门崩在路径上」的形式失败（本项目最忌讳的「匹配判据可被无关代码满足」的同源病：
 *     崩掉的闸门既不报特有文案、也不报判据）。故**按闭包逐个拷 + 断言都到了**，
 *     以后 `env.mjs` 再加依赖时，这里会**当场报错**而不是静默退化。
 *   · `mutate` 形如 `[from, to]` ⇒ 只在 `dub-core.mjs` 上做该替换（`mutateFile`），其余原样拷。
 */
const DUB_CORE_CLOSURE = ['dub-core.mjs', 'env.mjs', 'styles-root.mjs'];
const copyDubCoreLib = (root, mutate) => {
  mk(path.join(root, 'lib'));
  for (const f of DUB_CORE_CLOSURE) {
    const dst = path.join(root, 'lib', f);
    if (f === 'dub-core.mjs' && mutate) mutateFile(path.join(TOOLS, 'lib', f), dst, mutate[0], mutate[1]);
    else fs.copyFileSync(path.join(TOOLS, 'lib', f), dst);
    assert.ok(fs.existsSync(dst), `夹具缺 lib/${f}（dub-core 的传递闭包）⇒ 子进程会 ERR_MODULE_NOT_FOUND`);
  }
};

/**
 * 造一段**「两个 LRA 口径本来就不同」**的测试音频，并**分别量出两个口径的真值**。
 *   · 信号 = 前 6 s 满幅正弦 + 后 6 s 压低 30 dB 的正弦（8 kHz / 12 s / 约 192 KB，纯 CPU，无 GPU）；
 *   · 实测本机：`ebur128` LRA 7.6 / `loudnorm.input_lra` 4.7 —— 差 2.9 ≫ 容差 0.6，
 *     正是 `check-lra-caliber.mjs` 存在的理由（项目口径 = ebur128，loudnorm 系统性偏大）。
 *   ★ 两道**夹具前提**断言（都从「量出来的真值」判，不写死数字）：
 *     两个口径都能量出来、且**差异 > 容差** —— 否则这段音频无法用来区分口径，用例会变成假绿。
 */
const lraTone = async (wav) => {
  assert.ok(fs.existsSync(FFMPEG), `夹具依赖本机 ffmpeg 存在：${FFMPEG}`);
  const gen = await run(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i',
    'sine=frequency=440:sample_rate=8000:duration=12',
    '-af', "volume='if(lt(t,6),1,0.03)':eval=frame", '-c:a', 'pcm_s16le', wav]);
  assert.equal(gen.code, 0, `夹具：ffmpeg 造测试音频失败\n${gen.out.slice(0, 400)}`);
  const eb = await run(FFMPEG, ['-hide_banner', '-nostats', '-i', wav,
    '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const m1 = [...eb.out.matchAll(/^\s*LRA:\s*(-?[\d.]+)/gm)];
  const lraEb = m1.length ? Number(m1[m1.length - 1][1]) : null;
  const ln = await run(FFMPEG, ['-hide_banner', '-nostats', '-i', wav,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
  const m2 = ln.out.match(/"input_lra"\s*:\s*"?(-?[\d.]+)"?/);
  const lraLn = m2 ? Number(m2[1]) : null;
  assert.ok(Number.isFinite(lraEb) && Number.isFinite(lraLn),
    `夹具：本机 ffmpeg 量不出两个口径的 LRA（ebur128 ${lraEb} / loudnorm ${lraLn}）\n${ln.out.slice(0, 400)}`);
  assert.ok(Math.abs(lraEb - lraLn) > 0.6,
    `夹具前提不成立：本机两个 LRA 口径只差 ${Math.abs(lraEb - lraLn)}（≤ 容差 0.6）⇒ 这段音频无法区分口径`);
  return { lraEb, lraLn };
};

// ── 用例 ────────────────────────────────────────────────────────────────────
const cases = [];
const test = (name, fn) => cases.push({ name, fn });

/** 断言一个「正向」结果：必须 exit≠0 **且**输出里有该闸门特有的失明/告警文案。 */
const expectBlind = (res, needle, hint) => {
  assert.notEqual(res.code, 0,
    `${hint}：应 exit≠0（守卫该报），实得 ${res.code}\n${res.out.slice(0, 900)}`);
  assert.ok(res.out.includes(needle),
    `${hint}：exit≠0 但**没有**出现该闸门特有文案「${needle}」⇒ 很可能是别的原因崩的（路径/JSON/参数），不是守卫命中\n${res.out.slice(0, 900)}`);
};
/** 断言一个「阴性对照」结果：必须 exit 0 **且**不含失明文案（否则「永远 exit 1」的坏断言也能绿）。 */
const expectClean = (res, needle, hint) => {
  assert.equal(res.code, 0,
    `${hint}：最小合法夹具应 exit 0，实得 ${res.code}\n${res.out.slice(0, 900)}`);
  assert.ok(!res.out.includes(needle),
    `${hint}：exit 0 却出现了失明文案「${needle}」\n${res.out.slice(0, 900)}`);
};

// ── 1. check-tp-prose.mjs ───────────────────────────────────────────────────
test('check-tp-prose：CUR 反向守卫（HIST+CUR 同行 ⇒ 不豁免 ⇒ 陈旧读数 1）', async () => {
  const dir = path.join(TMP, 'tp');
  try {
    // 正向：真值 truePeakDbtp=-1.2；正文写「已修：…原为 −1.2 dBTP，现状 −0.5 dBTP（本片成片实测）」
    //   ⑤ 整行同时有 HIST（已修）与 CUR（现状）⇒ 不豁免 ⇒ −0.5 与实测差 0.7 ⇒ FAIL。
    const pos = skillTree(path.join(dir, 'pos'), 'gb-tp',
      '# gb-tp\n\n已修：真峰值原为 −1.2 dBTP，现状 −0.5 dBTP（本片成片实测）\n',
      tpDistill());
    const r1 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '陈旧读数 1 处', 'check-tp-prose 正向');

    // 阴性对照：去掉「现状」（只留 HIST）⇒ 同一行被历史语境豁免 ⇒ exit 0。
    const neg = skillTree(path.join(dir, 'neg'), 'gb-tp',
      '# gb-tp\n\n已修：真峰值原为 −1.2 dBTP（本片成片实测）\n',
      tpDistill());
    const r2 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '陈旧读数 1 处', 'check-tp-prose 阴性对照');
    assert.ok(!r2.out.includes('已失明'), `check-tp-prose 阴性对照：不应失明\n${r2.out.slice(0, 600)}`);
  } finally { rm(dir); }
});

// ── 1a-2. check-tp-prose 的 ⑤：`修复后` 不再算历史标记（2026-10-07 b83-a2）────
test('check-tp-prose：⑤ `修复后` 不再豁免（只含 `修复后` 的行照判；含 `原记` 的行仍豁免）', async () => {
  const dir = path.join(TMP, 'tp-fixafter');
  try {
    // 正向：整行**只有 `修复后` 一个**「历史」词 ⇒ 不再豁免 ⇒ 成片读数照判。
    //   （旧版 `修复后` 在 HIST 里 ⇒ 整行豁免 ⇒ 假绿 —— 这正是 `pictogram-motion:107` 的病。）
    const pos = skillTree(path.join(dir, 'pos'), 'gb-tp',
      '# gb-tp\n\n本次成片实际状态（音频链修复后）：成片实测真峰值 input_tp = −0.50 dBTP（本片成片实测）。\n',
      tpDistill());
    const r1 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '陈旧读数 1 处', 'check-tp-prose ⑤ 正向');

    // 阴性对照：同一行**再加一个真历史标记** `原记` ⇒ 整行仍被 ⑤ 豁免 ⇒ exit 0。
    //   （证明「删 `修复后`」没有把「修复后 + 原记」的合法历史行一起判红 —— 即**没造误报**。）
    const neg = skillTree(path.join(dir, 'neg'), 'gb-tp',
      '# gb-tp\n\n本次成片实际状态（音频链修复后）：成片实测真峰值 input_tp = −0.50 dBTP（**原记** 旧版读数，本片成片实测）。\n',
      tpDistill());
    const r2 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '陈旧读数 1 处', 'check-tp-prose ⑤ 阴性对照');
    assert.ok(!r2.out.includes('已失明'), `check-tp-prose ⑤ 阴性对照：不应失明\n${r2.out.slice(0, 600)}`);
  } finally { rm(dir); }
});

// ── 1b. check-tp-prose 的 ⑦ / ⑨ 收窄（2026-10-07） ───────────────────────────
test('check-tp-prose：⑦ 非本片产物（同句证据词 + 成片归因例外 ⇒ 只判成片半句）', async () => {
  const dir = path.join(TMP, 'tp-nonfilm');
  try {
    // 真值 truePeakDbtp=-1.2。行内两半：上游 `mix.wav` 半句（应被 ⑦ 排除）+ 成片半句（应被判定）。
    //   ★ 2026-10-07 收窄：⑦ 从「整句」收到「同句证据词 + 读数未被显式归因于成片」。
    const pos = skillTree(path.join(dir, 'pos'), 'gb-tp',
      '# gb-tp\n\n`demo/mix.wav` 真峰值 −1.00 dBTP（上游素材）；经 `core/render/mux.sh` 归一后的成片实测真峰值 input_tp = −0.50 dBTP（本片成片实测）。\n',
      tpDistill());
    const r1 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '陈旧读数 1 处', 'check-tp-prose ⑦ 正向');
    // ★ 必须恰是 1 处：上游 −1.00（与实测 −1.2 差 0.2）被 ⑦ 排除；若 ⑦ 退化成整句，成片半句也被放掉 ⇒ 0 处。
    assert.ok(!r1.out.includes('陈旧读数 2 处'),
      `⑦ 应只判成片半句（1 处），实得 2 处 ⇒ 上游半句没被排除\n${r1.out.slice(0, 700)}`);

    // 真阴性：同一行、成片半句写正确值（−1.30 与实测 −1.2 差 0.1 ≤ 容差 0.15）⇒ exit 0。
    const neg = skillTree(path.join(dir, 'neg'), 'gb-tp',
      '# gb-tp\n\n`demo/mix.wav` 真峰值 −1.00 dBTP（上游素材）；经 `core/render/mux.sh` 归一后的成片实测真峰值 input_tp = −1.30 dBTP（本片成片实测）。\n',
      tpDistill());
    const r2 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '陈旧读数 1 处', 'check-tp-prose ⑦ 真阴性');
    assert.ok(!r2.out.includes('已失明'), `check-tp-prose ⑦ 真阴性：不应失明\n${r2.out.slice(0, 600)}`);
  } finally { rm(dir); }
});

test('check-tp-prose：⑨ 交叉引用（别的风格名必须与读数同子句）', async () => {
  const dir = path.join(TMP, 'tp-xref');
  try {
    // 两个风格：gb-tp（被测）+ gb-other（被引用）。
    //   正向：本片读数在**前一子句**、别的风格名在**后一子句** ⇒ ⑨ 不豁免 ⇒ 陈旧读数 1。
    const root = path.join(dir, 'pos');
    skillTree(root, 'gb-tp',
      '# gb-tp\n\n本片成片真峰值 −0.50 dBTP（本片成片实测）。队里 gb-other 曾到 +0.28 dBTP。\n', tpDistill());
    skillTree(root, 'gb-other', '# gb-other\n', tpDistill());
    const r1 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: root });
    expectBlind(r1, '陈旧读数 1 处', 'check-tp-prose ⑨ 正向');

    // 真阴性：把别的风格名挪进**同一子句** ⇒ ⑨ 豁免（交叉引用单列）⇒ exit 0。
    const root2 = path.join(dir, 'neg');
    skillTree(root2, 'gb-tp',
      '# gb-tp\n\n本片成片真峰值 −0.50 dBTP（对比 gb-other 的 +0.28 dBTP）。\n', tpDistill());
    skillTree(root2, 'gb-other', '# gb-other\n', tpDistill());
    const r2 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: root2 });
    expectClean(r2, '陈旧读数 1 处', 'check-tp-prose ⑨ 真阴性');
  } finally { rm(dir); }
});

test('check-tp-prose：失明（真值来源 = {} ⇒ 逐量纲「已失明」exit 1）', async () => {
  const dir = path.join(TMP, 'tp-blind');
  try {
    const root = skillTree(path.join(dir, 'styles'), 'gb-tp',
      '# gb-tp\n\n本片成片真峰值 −1.30 dBTP。\n', tpDistill());
    const ov = path.join(dir, 'empty.json');
    rj(ov, {});
    const res = await runGate('check-tp-prose.mjs', {
      LEMO_DISTILL_ROOT: root, LEMO_READINGS_MEASURED_JSON: ov,
    });
    expectBlind(res, '本闸门已失明', 'check-tp-prose 失明');
  } finally { rm(dir); }
});

// ── 1c. check-tp-prose 的 **json 散文** pass（2026-10-07 补的零覆盖区）───────────────
//   背景：`_distill.json` 的散文字段（`selfCheck.peakNote` / `selfCheck.audio.*` / `audioEvidence.*` /
//   一切 `*note`）**没有任何闸门读过** ⇒ `halftone-dossier.peakNote` 写 −3.26 dBTP（实测 −2.79）、
//   `pixel-rpg` 写 0.08 dBTP 都能长期存活。现 check-tp-prose 把 json 散文当**第二路扫描源**。
test('check-tp-prose：json 散文（selfCheck.audio.note 现值陈旧 ⇒ 判；与权威一致 ⇒ 放行）', async () => {
  const dir = path.join(TMP, 'tp-jsonprose');
  try {
    // 真值（权威）= 同 json 的 `selfCheck.loudness.truePeakDbtp` = −1.25。
    //   正向：`selfCheck.audio.note` 写 −0.50（Δ 0.75 ≫ 容差 0.15）⇒ 判 1 处、且**点名字段路径**。
    const pos = path.join(dir, 'pos');
    const djP = tpDistill();
    djP.selfCheck.audio = { note: '本片成片实测真峰值 input_tp = −0.50 dBTP（本片成片实测）。' };
    skillTree(pos, 'gb-tp', '# gb-tp\n\n本片成片真峰值 −1.25 dBTP（本片成片实测）。\n', djP);
    const r1 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '陈旧读数 1 处', 'check-tp-prose json 散文正向');
    // ★ 必须点名是**哪个 json 字段**（否则「判到了但没说在哪」= 不可用）。
    assert.ok(r1.out.includes('_distill.json:selfCheck.audio.note'),
      `json 散文正向：输出没点名 \`_distill.json:selfCheck.audio.note\`\n${r1.out.slice(0, 900)}`);

    // 真阴性：同一字段改成与权威一致（−1.25）⇒ exit 0。
    const neg = path.join(dir, 'neg');
    const djN = tpDistill();
    djN.selfCheck.audio = { note: '本片成片实测真峰值 input_tp = −1.25 dBTP（本片成片实测）。' };
    skillTree(neg, 'gb-tp', '# gb-tp\n\n本片成片真峰值 −1.25 dBTP（本片成片实测）。\n', djN);
    const r2 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '陈旧读数 1 处', 'check-tp-prose json 散文真阴性');
    assert.ok(!r2.out.includes('已失明'), `check-tp-prose json 散文真阴性：不应失明\n${r2.out.slice(0, 600)}`);
  } finally { rm(dir); }
});

test('check-tp-prose：json 散文失明（读到 _distill.json 但白名单散文无任何可核读数 ⇒ exit 1）', async () => {
  const dir = path.join(TMP, 'tp-jsonblind');
  try {
    // 有 `_distill.json`（真值齐全）但**散文里一个可核读数都没有** ⇒ json 这一路失明（假绿型病）。
    const blind = path.join(dir, 'blind');
    skillTree(blind, 'gb-tp', '# gb-tp\n\n本片成片真峰值 −1.25 dBTP（本片成片实测）。\n', {
      generatedVideo: { bytes: 1000000, durSec: 60, width: 1920, height: 1080, frames: 1500 },
      selfCheck: { loudness: {
        truePeakDbtp: -1.25, integratedLufs: -14.2, lra: 3.2, peakDbtpTarget: -1.2, samplePeakDbfs: -1.3,
      } },
    });
    const r1 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: blind });
    expectBlind(r1, '本闸门已失明（json 散文）', 'check-tp-prose json 散文失明');

    // 阴性对照：补一条**一致**的 `peakNote` ⇒ 不再失明 ⇒ exit 0。
    const ok = path.join(dir, 'ok');
    skillTree(ok, 'gb-tp', '# gb-tp\n\n本片成片真峰值 −1.25 dBTP（本片成片实测）。\n', tpDistill());
    const r2 = await runGate('check-tp-prose.mjs', { LEMO_DISTILL_ROOT: ok });
    expectClean(r2, '本闸门已失明（json 散文）', 'check-tp-prose json 散文失明阴性对照');
  } finally { rm(dir); }
});

// ── 2. check-skill-film-fields.mjs ──────────────────────────────────────────
test('check-skill-film-fields：CUR 反向守卫（帧数 HIST+CUR ⇒ 陈旧帧数 1）', async () => {
  const dir = path.join(TMP, 'ff');
  try {
    const gv = { generatedVideo: { frames: 100, width: 1920, height: 1080, durSec: 60 } };
    // 正向：实测 frames=100，正文「已修：成片帧数原为 100 帧，现状 999 帧。」
    //   100 与实测一致被放行；999≠100 且整行有 CUR ⇒ 不豁免 ⇒ 陈旧帧数 1。
    const pos = skillTree(path.join(dir, 'pos'), 'gb-ff',
      '# gb-ff\n\n已修：成片帧数原为 100 帧，现状 999 帧。\n', gv);
    const r1 = await runGate('check-skill-film-fields.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '陈旧帧数 1 处', 'check-skill-film-fields 正向');

    // 阴性对照：去掉「现状」且用 100 ⇒ 整行历史语境豁免 + 100 与实测一致 ⇒ exit 0。
    const neg = skillTree(path.join(dir, 'neg'), 'gb-ff',
      '# gb-ff\n\n已修：成片帧数原为 100 帧。\n', gv);
    const r2 = await runGate('check-skill-film-fields.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '陈旧帧数 1 处', 'check-skill-film-fields 阴性对照');
    assert.ok(!r2.out.includes('已失明'), `阴性对照不应失明\n${r2.out.slice(0, 600)}`);
  } finally { rm(dir); }
});

// ── 2a. check-skill-film-fields 的 ⑨ / ⑧（2026-10-07 b84-a） ────────────────
test('check-skill-film-fields：⑨ 交叉引用（别的风格名必须与读数同子句）', async () => {
  const dir = path.join(TMP, 'ff-xref');
  try {
    const gv = { generatedVideo: { frames: 100, width: 1920, height: 1080, durSec: 60 } };
    // 正向：陈旧帧数在**前一子句**、别的风格名在**后一子句** ⇒ ⑨ 不豁免 ⇒ 陈旧帧数 1。
    const pos = path.join(dir, 'pos');
    skillTree(pos, 'gb-ff', '# gb-ff\n\n本片成片帧数 999 帧。队里 gb-other 曾到 100 帧。\n', gv);
    skillTree(pos, 'gb-other', '# gb-other\n', gv);
    const r1 = await runGate('check-skill-film-fields.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '陈旧帧数 1 处', 'check-skill-film-fields ⑨ 正向');

    // 真阴性：把别的风格名挪进**同一子句** ⇒ ⑨ 豁免（交叉引用单列）⇒ exit 0。
    const neg = path.join(dir, 'neg');
    skillTree(neg, 'gb-ff', '# gb-ff\n\n本片成片帧数 999 帧（对比 gb-other 的 100 帧）。\n', gv);
    skillTree(neg, 'gb-other', '# gb-other\n', gv);
    const r2 = await runGate('check-skill-film-fields.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '陈旧帧数 1 处', 'check-skill-film-fields ⑨ 真阴性');
    assert.ok(r2.out.includes('交叉引用 1 处'),
      `⑨ 真阴性：应把该 token 单列「交叉引用 1 处」\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

test('check-skill-film-fields：WxH 朝向守卫（9:16 变体 ⇒ 参考桶；同朝向变体仍判 FAIL）', async () => {
  const dir = path.join(TMP, 'ff-orient');
  try {
    const gv = { generatedVideo: { frames: 100, width: 1920, height: 1080, durSec: 60 } };
    // 正向（守卫生效）：竖画幅 1080×1920 与本片 1920×1080 横竖相反 ⇒ 推「参考」桶、不判 FAIL ⇒ exit 0。
    const pos = path.join(dir, 'pos');
    skillTree(pos, 'gb-ff', '# gb-ff\n\n本片成片分辨率 1080×1920。\n', gv);
    const r1 = await runGate('check-skill-film-fields.mjs', { LEMO_DISTILL_ROOT: pos });
    expectClean(r1, '陈旧分辨率 1 处', 'check-skill-film-fields 朝向守卫正向');
    assert.ok(r1.out.includes('参考画幅朝向 1 处'),
      `朝向守卫：应把该 token 单列「参考画幅朝向 1 处」（不静默丢弃）\n${r1.out.slice(0, 700)}`);

    // 阴性对照（守卫不越权）：同朝向的变体 1600×900 ⇒ **照判** FAIL ⇒ 陈旧分辨率 1。
    const neg = path.join(dir, 'neg');
    skillTree(neg, 'gb-ff', '# gb-ff\n\n本片成片分辨率 1600×900。\n', gv);
    const r2 = await runGate('check-skill-film-fields.mjs', { LEMO_DISTILL_ROOT: neg });
    expectBlind(r2, '陈旧分辨率 1 处', 'check-skill-film-fields 朝向守卫阴性对照');
  } finally { rm(dir); }
});

// ── 3. check-config-notes.mjs ───────────────────────────────────────────────
test('check-config-notes：失明守卫②（有风格但全无 notes ⇒ 一条都没检查过）', async () => {
  const dir = path.join(TMP, 'cfg');
  try {
    // 正向：两条配置、notes 全空 ⇒ 主循环把全部条目 continue ⇒ checkedNotes=0 ⇒ 失明。
    const pos = path.join(dir, 'empty.json');
    rj(pos, { styles: [{ slug: 'a', notes: '' }, { slug: 'b' }] });
    const r1 = await runGate('check-config-notes.mjs', { LEMO_DUB_STYLES: pos });
    expectBlind(r1, '没有一条带 notes', 'check-config-notes 正向');

    // 阴性对照：一条非空 notes ⇒ 真正检查过 ⇒ exit 0。
    const neg = path.join(dir, 'one.json');
    rj(neg, { styles: [{ slug: 'a', notes: '本条的 palette 完整，无缺项。' }] });
    const r2 = await runGate('check-config-notes.mjs', { LEMO_DUB_STYLES: neg });
    expectClean(r2, '没有一条带 notes', 'check-config-notes 阴性对照');
  } finally { rm(dir); }
});

// ── 4. check-doc-coverage.mjs ───────────────────────────────────────────────
test('check-doc-coverage：失明守卫（scripts/ 只有非闸门非工具的 foo.mjs ⇒ 一个都没检查）', async () => {
  const dir = path.join(TMP, 'doc');
  try {
    // 正向：假仓库根，scripts/ 里只有 foo.mjs（既非 check-* 也非工具类）⇒ 过滤集为 0 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    wf(path.join(pos, 'scripts', 'foo.mjs'), '// 非闸门、非工具\n');
    const r1 = await runGate('check-doc-coverage.mjs', { LEMO_TOOLS_ROOT: pos });
    expectBlind(r1, '本闸门已失明', 'check-doc-coverage 正向');

    // 阴性对照：一个已登记闸门（两份文档都按各自格式登记）+ 一个已登记测试入口 ⇒ exit 0。
    // ★ 2026-10-07（顺带修一处**夹具陈旧**，非本用例的原始判据）：`check-doc-coverage.mjs` 新增了
    //   「文档里的**计数声称** vs **实测**」判据（闸门数 / 用例数 / ★自证数一律**从文件系统现算**，
    //   见其 `CLAIMS` 表）⇒ 最小合法夹具必须**同时**提供 `test/gate-blindness.test.mjs`
    //   （否则 `gbText` 读不到 ⇒ 「用例数 / 自证数无法计算」）与两处文档里的**计数锚点**。
    //   本夹具按 **1 个闸门 / 2 条用例 / 1 条 ★自证** 配平（旧夹具没有这两样 ⇒ 阴性对照被误判成失明）。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'scripts', 'check-x.mjs'), '// 一个闸门\n');
    wf(path.join(neg, 'test', 'gb-doc.test.mjs'), '// 一个测试入口\n');
    wf(path.join(neg, 'test', 'gate-blindness.test.mjs'),
      '// 合成回归套件（2 条用例 / 1 条 ★自证）\n'
      + "test('a', () => {});\n"
      + "test('★自证 b', () => {});\n"
      // ★ 这一行**必须拼接**：`check-doc-coverage.mjs` 的「gate-blindness·用例数 / 闸门数」锚点要求
      //   那个句子在 `test/gate-blindness.test.mjs` 里**恰好命中 1 处**；写成连续字面量会让**本文件自己**
      //   多出一处命中 ⇒ 锚点不唯一 ⇒ 判失明（实测：写完连续字面量后 check-doc-coverage 立刻报
      //   「锚点命中 **2** 处（应为 1）」）。
      + '// 共 2 条用例' + ' / 覆盖全部 1 个闸门\n');
    wf(path.join(neg, 'test', 'README.md'),
      '# 测试\n\n'
      + '回归套件（独立入口，零依赖，**2 条**）：覆盖 **1/1** 个闸门，另含 **1** 个**故意破坏自证**。\n'
      + '（2 条：**全部 1 个闸门**的守卫，另含 1 个「改坏守卫或判据必须变红」自证）\n\n'
      + '| `scripts/check-x.mjs` | 说明 |\n'
      + '| `test/gb-doc.test.mjs` | 说明 |\n'
      + '| `test/gate-blindness.test.mjs` | 说明 |\n');
    wf(path.join(neg, '_distill', 'AGENT-BRIEF.md'),
      '# 简报\n\nnode D:/x/scripts/check-x.mjs\n');
    const r2 = await runGate('check-doc-coverage.mjs', { LEMO_TOOLS_ROOT: neg });
    expectClean(r2, '本闸门已失明', 'check-doc-coverage 阴性对照');
  } finally { rm(dir); }
});

// ── 5. check-lexicon-coverage.mjs（无覆盖点：路径基于脚本自身位置推导 ⇒ 整棵拷贝）──
test('check-lexicon-coverage：失明守卫②（3 风格四维 tag 全空 ⇒ 没有一个声明了 tag）', async () => {
  const dir = path.join(TMP, 'lex');
  try {
    // ★ 按该闸门头注释的变异设计：把 lib/ 整目录 + 脚本拷到临时目录，保持 lib/↔scripts/ 相对位置。
    fs.cpSync(path.join(TOOLS, 'lib'), path.join(dir, 'lib'), { recursive: true });
    mk(path.join(dir, 'scripts'));
    fs.copyFileSync(path.join(SCRIPTS, 'check-lexicon-coverage.mjs'),
      path.join(dir, 'scripts', 'check-lexicon-coverage.mjs'));
    const gate = path.join(dir, 'scripts', 'check-lexicon-coverage.mjs');
    const stylesJson = path.join(dir, 'lib', 'dub-styles.json');

    // 正向：3 个风格、四维 tag 全空 ⇒ declaredTags=0 ⇒ 失明。
    rj(stylesJson, { styles: [
      { slug: 'a', tags: {} },
      { slug: 'b', tags: { theme: [] } },
      { slug: 'c', tags: { theme: [], emotion: [], scene: [], pace: [] } },
    ] });
    const r1 = await run(NODE, [gate]);
    expectBlind(r1, '没有一个声明了 tag', 'check-lexicon-coverage 正向');

    // 阴性对照：给一个风格声明一个词表里已有的 tag（theme「通用」）⇒ 漏登记 0 ⇒ exit 0。
    rj(stylesJson, { styles: [{ slug: 'a', tags: { theme: ['通用'] } }] });
    const r2 = await run(NODE, [gate]);
    expectClean(r2, '没有一个声明了 tag', 'check-lexicon-coverage 阴性对照');
    assert.ok(r2.out.includes('漏登记 0 处'), `阴性对照应报「漏登记 0 处」\n${r2.out.slice(0, 600)}`);
  } finally { rm(dir); }
});

// ── 6. check-ref-lines.mjs ──────────────────────────────────────────────────
test('check-ref-lines：失明守卫（一棵零引用的树 ⇒ 一个引用都没找到）', async () => {
  const dir = path.join(TMP, 'ref');
  const envFor = (root) => ({
    LEMO_TOOLS_ROOT: root,
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_STYLES_ROOT: path.join(root, 'opuscar', 'styles'),
    LEMO_DISTILL_ROOT: path.join(root, 'lib', 'style-skills'),
  });
  try {
    // 正向：一棵（几乎）空的树 ⇒ refCount=0 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    for (const d of ['test', '_distill', 'lib', 'scripts', 'opuscar/styles']) mk(path.join(pos, d));
    const r1 = await runGate('check-ref-lines.mjs', envFor(pos));
    expectBlind(r1, '本闸门已失明', 'check-ref-lines 正向');

    // 阴性对照：放一条能解析的引用（test/README.md 引同目录的 target.mjs:1）⇒ exit 0。
    const neg = path.join(dir, 'neg');
    for (const d of ['test', '_distill', 'lib', 'scripts', 'opuscar/styles']) mk(path.join(neg, d));
    wf(path.join(neg, 'test', 'target.mjs'), 'line1\nline2\nline3\n');
    wf(path.join(neg, 'test', 'README.md'), '# 测试\n\n见 `target.mjs:1`。\n');
    const r2 = await runGate('check-ref-lines.mjs', envFor(neg));
    expectClean(r2, '本闸门已失明', 'check-ref-lines 阴性对照');
  } finally { rm(dir); }
});

// ── 7. check-aspect-prose.mjs ───────────────────────────────────────────────
test('check-aspect-prose：失明守卫（LEMO_SKILL_ROOT 指向空目录 ⇒ 枚举到 0 个风格）', async () => {
  const dir = path.join(TMP, 'asp');
  try {
    // 正向：文档树是空目录 ⇒ 枚举到 0 个风格 ⇒ 失明（输出为「本闸门已**失明**」带 markdown 粗体）。
    const posRoot = path.join(dir, 'pos');
    mk(path.join(posRoot, 'skills'));
    mk(path.join(posRoot, 'styles'));
    const r1 = await runGate('check-aspect-prose.mjs',
      { LEMO_SKILL_ROOT: path.join(posRoot, 'skills'), LEMO_STYLES_ROOT: path.join(posRoot, 'styles') });
    expectBlind(r1, '本闸门已**失明**', 'check-aspect-prose 正向');

    // 阴性对照：一个风格，事实源里 film.js 声明 aspects:['16:9']（⇒ 未支持 9:16），
    //   文档无任何肯定/否定式画幅声称 ⇒ 无矛盾 ⇒ exit 0。
    const negRoot = path.join(dir, 'neg');
    const skills = path.join(negRoot, 'skills');
    const styles = path.join(negRoot, 'styles');
    wf(path.join(skills, 'gb-asp', 'SKILL.md'), '# gb-asp\n\n示例风格文档。\n');
    rj(path.join(skills, 'gb-asp', '_distill.json'),
      { limits: [], defects: [], assetGaps: [], resolvedDefects: [], selfCheck: { warnings: [] } });
    wf(path.join(styles, 'gb-asp', 'demo', 'film.js'),
      "export const FILM_META = { aspects: ['16:9'] };\n");
    const r2 = await runGate('check-aspect-prose.mjs',
      { LEMO_SKILL_ROOT: skills, LEMO_STYLES_ROOT: styles });
    expectClean(r2, '失明', 'check-aspect-prose 阴性对照');
  } finally { rm(dir); }
});

// ── 8. check-skill-artifacts.mjs ────────────────────────────────────────────
test('check-skill-artifacts：失明守卫②（全部 SKIP ⇒ 一个都没比对）', async () => {
  const dir = path.join(TMP, 'art');
  // ★ 阴性对照要用到真实仓里的帧图目录（`_distill/frames/<slug>/` 的落点写死在脚本 ROOT 下，
  //   覆盖点改不了它）⇒ 用一个**真实存在**的 slug，让 evidenceFrames 的存在性检查能通过。
  const REAL_SLUG = 'game-show';
  const realFrame = path.join(TOOLS, '_distill', 'frames', REAL_SLUG, '_contact.jpg');
  const realFilm = 'D:/lemo-films/game-show/game-show.mp4';
  try {
    // 正向：一个风格，generatedVideo 有但缺 `path` ⇒ 全部 SKIP ⇒ 一个都没比对 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    rj(path.join(pos, REAL_SLUG, '_distill.json'),
      { generatedVideo: { bytes: 1, durSec: 1, width: 1920, height: 1080, frames: 10 }, evidenceFrames: [] });
    const r1 = await runGate('check-skill-artifacts.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '一个都没比对', 'check-skill-artifacts 正向');

    // 阴性对照：path 指向真实成片、**不记**任何数值字段（⇒ 逐字段比对全部跳过 ⇒ PASS），
    //   evidenceFrames 用真实存在的帧图 ⇒ 无 FAIL ⇒ exit 0。
    assert.ok(fs.existsSync(realFilm), `阴性对照依赖真实成片存在：${realFilm}`);
    assert.ok(fs.existsSync(realFrame), `阴性对照依赖真实帧图存在：${realFrame}`);
    const neg = path.join(dir, 'neg');
    rj(path.join(neg, REAL_SLUG, '_distill.json'),
      { generatedVideo: { path: realFilm }, evidenceFrames: ['_contact.jpg'] });
    const r2 = await runGate('check-skill-artifacts.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r2, '已失明', 'check-skill-artifacts 阴性对照');
    assert.ok(r2.out.includes('文档记录的成片信息与实物全部一致'),
      `阴性对照应报「全部一致」\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 8b. check-selfcheck-claims.mjs（★ 项目第一硬规则「渲染一律 GPU 优先」的 json 侧落点）──
//   ★ 2026-10-07 建：`selfCheck.muxEncoder`（43/43 声称「nvenc」）此前**零读者** ⇒ 渲染一旦
//     静默回退成 CPU，**没有任何闸门会响**（`check-render-venc` 核的是**脚本**、`check-mux-parity`
//     核的是两份 `mux.sh` 的口径、`check-skill-artifacts` 核的是 `generatedVideo.*` 的数值）。
//   ★ 本用例专测那条**最容易漏**的判据 —— 「**达标**」而非「自洽」：一部真 `libx264` 成片
//     配上「声称 libx264」是**自洽**的，只判自洽的闸门会**绿灯放行**（违反第一硬规则）。
test('check-selfcheck-claims：★ 达标判据（成片实为 libx264 ⇒ FAIL，即便声称也写 libx264）', async () => {
  const dir = path.join(TMP, 'scc');
  mk(dir);                                   // ★ ffmpeg 不会自建目录 ⇒ 先建（否则「造片失败」被误读成夹具坏了）
  const cpuFilm = path.join(dir, 'cpu.mp4');
  try {
    // ── 夹具前提：本机 ffmpeg 造一部**真 libx264** 成片（纯 CPU，不碰 GPU）──
    assert.ok(fs.existsSync(FFMPEG), `夹具依赖本机 ffmpeg 存在：${FFMPEG}`);
    const gen = await run(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i',
      'testsrc=size=320x180:rate=24:duration=1', '-c:v', 'libx264', '-preset', 'ultrafast', cpuFilm]);
    assert.equal(gen.code, 0, `夹具：ffmpeg 造 CPU 成片失败\n${gen.out.slice(0, 400)}`);
    assert.ok(fs.existsSync(cpuFilm), `夹具：CPU 成片没造出来 ${cpuFilm}`);
    // ★ 夹具前提：ffprobe 必须真的把它的 encoder tag 读成 libx264（否则用例测不到那个形态）
    const pr = await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream_tags=encoder', '-of', 'json', cpuFilm]);
    assert.ok(/"encoder"\s*:\s*"[^"]*libx264/.test(pr.out),
      `夹具：ffprobe 没把夹具片读成 libx264 ⇒ 用例测不到目标形态\n${pr.out.slice(0, 300)}`);

    // 用真实风格的 json 当模板（只把 `generatedVideo.path` 换成夹具片；`muxEncoder` 保持真值 nvenc）
    const real = JSON.parse(fs.readFileSync(path.join(TOOLS, 'lib', 'style-skills', 'art-deco', '_distill.json'), 'utf8'));
    const pos = path.join(dir, 'pos');
    rj(path.join(pos, 'art-deco', '_distill.json'),
      { ...real, generatedVideo: { ...real.generatedVideo, path: fwd(cpuFilm) } });
    const r1 = await runGate('check-selfcheck-claims.mjs', { LEMO_DISTILL_ROOT: pos });
    // 正向：必须报出「成片未走 h264_nvenc（GPU 优先铁律）」（逐字抄自源码）+ 自洽不符
    expectBlind(r1, '★ 成片未走 h264_nvenc（GPU 优先铁律）', 'check-selfcheck-claims 正向');
    assert.ok(r1.out.includes('muxEncoder 声称 "nvenc" 与成片实际'),
      `正向还应报「声称 vs 实际不符」\n${r1.out.slice(0, 900)}`);

    // ── ★自证：把「达标」与「自洽」两条判据**短路**（只改条件、不动括号结构）⇒ 同夹具必须变绿 ──
    //   ⇒ 证明上面那条断言真的在测这两条判据，而不是在测「闸门有没有崩」。
    const gateCopy = patchGate('check-selfcheck-claims.mjs', path.join(dir, 'rev'), [
      ['} else if (!norm(tag).includes(norm(EXPECTED))) {', '} else if (false) {'],
      ['if (tag && !norm(tag).includes(norm(claim))) {', 'if (false) {'],
    ]);
    const r2 = await run(NODE, [gateCopy], { env: { LEMO_DISTILL_ROOT: pos } });
    assert.equal(r2.code, 0, `★自证：短路达标/自洽判据后应 exit 0，实得 ${r2.code}\n${r2.out.slice(0, 900)}`);
    assert.ok(!r2.out.includes('成片未走 h264_nvenc'),
      `★自证：短路后**不该**再报「成片未走 h264_nvenc」\n${r2.out.slice(0, 900)}`);

    // ── 阴性对照：真风格 + 真成片（nvenc）⇒ exit 0 且不含失明文案 ──
    const realFilm = 'D:/lemo-films/art-deco/art-deco.mp4';
    assert.ok(fs.existsSync(realFilm), `阴性对照依赖真实成片存在：${realFilm}`);
    const neg = path.join(dir, 'neg');
    rj(path.join(neg, 'art-deco', '_distill.json'),
      { generatedVideo: { path: realFilm }, selfCheck: { muxEncoder: 'nvenc' } });
    const r3 = await runGate('check-selfcheck-claims.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r3, '已失明', 'check-selfcheck-claims 阴性对照');
    assert.ok(r3.out.includes('与真值全部一致'),
      `阴性对照应报「与真值全部一致」\n${r3.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 9. check-mix-candidates.mjs（额外） ─────────────────────────────────────
test('check-mix-candidates：失明守卫②（全部风格无候选 ⇒ 一个候选混音都没检查过）', async () => {
  const dir = path.join(TMP, 'mix');
  // 阴性对照需要一份**非静音**的真实混音；取仓外真实文件（只读拷贝，绝不改原文件）。
  const realMix = 'D:/lemo-opuscar/styles/halftone-dossier/demo/mix.wav';
  try {
    // 正向：唯一风格目录里一个候选都没有 ⇒ 无候选数 == 风格总数 ⇒ 失明。
    const pos = path.join(dir, 'pos', 'styles');
    mk(path.join(pos, 'gb-mix'));
    const r1 = await runGate('check-mix-candidates.mjs', { LEMO_STYLES_ROOT: pos });
    expectBlind(r1, '一个候选混音都没检查过', 'check-mix-candidates 正向');

    // 阴性对照：放一份非静音的真实 mix.wav 作唯一候选 ⇒ 通过 ⇒ exit 0。
    if (!fs.existsSync(realMix)) assert.fail(`阴性对照依赖真实混音存在：${realMix}`);
    const neg = path.join(dir, 'neg', 'styles');
    mk(path.join(neg, 'gb-mix', 'demo'));
    fs.copyFileSync(realMix, path.join(neg, 'gb-mix', 'demo', 'mix.wav'));
    const r2 = await runGate('check-mix-candidates.mjs', { LEMO_STYLES_ROOT: neg });
    expectClean(r2, '本闸门已失明', 'check-mix-candidates 阴性对照');
  } finally { rm(dir); }
});

// ══════════════════════════════════════════════════════════════════════════
// 第 10–25 条（2026-10-07 扩批）：把覆盖面从 9 个闸门扩到 24 个。
//   每条都照既有纪律：**正向**（命中「该失明」的条件 ⇒ exit≠0 + 逐字抄自源码的失明文案）
//   ＋**阴性对照**（最小合法夹具 ⇒ exit 0 且不含那句文案）。
//   ★ 造不出阴性对照的闸门**一律不造**（宁缺勿滥）。
//     ★ 2026-10-07 订正：此处原写「见文件末『未覆盖清单』」—— 该清单**已不存在**（覆盖面达到
//       31/31 个闸门全部覆盖后即移除），属**悬空引用**，已删。若将来又出现「造不出阴性对照」的闸门，
//       请在**本注释块内**就地登记，不要再指向一个可能被删掉的小节。
// ══════════════════════════════════════════════════════════════════════════

// ── 10. check-line-endings.mjs（J4 失明守卫）────────────────────────────────
test('check-line-endings：J4 失明守卫（git ls-files 枚举到 0 个已跟踪文件）', async () => {
  const dir = path.join(TMP, 'eol');
  try {
    // 正向：一个**真的 git 仓库**（有 .git）但一个文件都没 `git add`
    //   ⇒ `git ls-files --eol` 返回空 ⇒ recs.length===0 ⇒ J4 失明。
    //   ★ 用 `--repo tools` 只跑 tools 仓，避免读真实 D:/lemo-opuscar。
    const pos = path.join(dir, 'pos');
    mk(pos);
    assert.equal((await git(['init', '-q', pos])).code, 0, '夹具：git init 失败');
    const r1 = await runGateArgs('check-line-endings.mjs', ['--repo', 'tools'], { LEMO_TOOLS_ROOT: pos });
    expectBlind(r1, '枚举到 **0 个**已跟踪文件', 'check-line-endings 正向');

    // 阴性对照：同一个仓里放一个 LF 文本 + 正确的 `.gitattributes` ⇒ J1/J2/J3 全过 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    mk(neg);
    assert.equal((await git(['init', '-q', neg])).code, 0, '夹具：git init 失败');
    await git(['-C', neg, 'config', 'core.autocrlf', 'false']);
    wf(path.join(neg, '.gitattributes'), '* text=auto eol=lf\n');
    wf(path.join(neg, 'a.md'), 'line1\nline2\n');
    assert.equal((await git(['-C', neg, 'add', '-A'])).code, 0, '夹具：git add 失败');
    const r2 = await runGateArgs('check-line-endings.mjs', ['--repo', 'tools'], { LEMO_TOOLS_ROOT: neg });
    expectClean(r2, '本闸门已**失明**', 'check-line-endings 阴性对照');
    assert.ok(r2.out.includes('J1 `.gitattributes` 存在'),
      `阴性对照应真的跑过 J1\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 11. check-render-venc.mjs（★ 用户头号硬规则「渲染必须走 GPU」的守卫）────
test('check-render-venc：A 类失明守卫（解析出的编码器决策点为 0）', async () => {
  const dir = path.join(TMP, 'venc');
  // ★ 该闸门的 A 类决策点落点 = `<脚本>/../../lemo-opuscar/core/render/*` 与 `<脚本>/../dub.mjs`
  //   ⇒ 只能把闸门**拷到临时目录**、让它自己「落点写死」的两个路径都不存在。
  const VALID_MJS =
    "const VENC = process.env.LEMO_VENC || 'h264_nvenc';\n"
    + "if (VENC !== 'h264_nvenc' && VENC !== 'libx264') { process.exit(1); }\n";
  const VALID_SH =
    '#!/bin/sh\n'
    + 'case "${LEMO_VENC:-}" in\n'
    + "  '') VENC=h264_nvenc ;;\n"
    + '  libx264) VENC=libx264 ;;\n'
    + '  *) echo bad; exit 1 ;;\n'
    + 'esac\n';
  const envFor = (root) => ({
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_STYLES_ROOT: path.join(root, 'styles'),
  });
  try {
    // 正向：拷来的闸门旁没有 dub.mjs、opuscar 树里没有 core/render/* ⇒ 3 个 A 类决策点
    //   全部「文件不存在」⇒ aParsed=0 ⇒ 失明（且**只有**这一句能解释 exit≠0）。
    const pos = path.join(dir, 'pos');
    const gatePos = copyGate('check-render-venc.mjs', pos);
    mk(path.join(pos, 'opuscar'));
    mk(path.join(pos, 'styles'));
    const r1 = await run(NODE, [gatePos], { env: envFor(pos) });
    expectBlind(r1, '本闸门已**失明**：解析出的编码器决策点为 0', 'check-render-venc 正向');

    // 阴性对照：三个决策点都放**最小合法**实现（未设⇒h264_nvenc / 显式 libx264⇒CPU / 非法⇒exit）
    //   ⇒ aParsed=3、aFails=0、D 类两仓都非空且 0 命中、C 类因非规范路径自动跳过 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    const gateNeg = copyGate('check-render-venc.mjs', neg);
    wf(path.join(neg, 'dub.mjs'), VALID_MJS);
    wf(path.join(neg, 'opuscar', 'core', 'render', 'video.mjs'), VALID_MJS);
    wf(path.join(neg, 'opuscar', 'core', 'render', 'mux.sh'), VALID_SH);
    mk(path.join(neg, 'styles'));
    const r2 = await run(NODE, [gateNeg], { env: envFor(neg) });
    expectClean(r2, '本闸门已**失明**', 'check-render-venc 阴性对照');
    assert.ok(r2.out.includes('A 类·出片路径编码器决策点 3 个（成功解析 3 个）'),
      `阴性对照应真的解析出 3 个决策点\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 11b. check-render-venc 的 D 类②（**无限定词**的错claim，2026-10-07 b85-a）──
// ★ 盲区：旧 D 类要求小句内有「默认/未设」限定词，而文档更常见的写法是
//   「demo 自带 `mux.sh` 用的是 `libx264 -preset slow -crf 17 -r 60`」——**没有限定词** ⇒ 抓不到。
//   新判据：同一小句内 `libx264` + 编码上下文（行级）+ **脚本引用**（`mux.sh`/`build.sh`/`自带`…），
//   且无 `h264_nvenc`、无豁免词（显式/回退/硬写/已修/原记/示例/命令/说成…）。
test('check-render-venc：D 类② 无限定词 claim（把 libx264 说成某脚本的编码器）', async () => {
  const dir = path.join(TMP, 'venc-d2');
  // ★ 该闸门的 A 类决策点落点 = `<脚本>/../../lemo-opuscar/core/render/*` 与 `<脚本>/../dub.mjs`
  //   ⇒ 只能把闸门**拷到临时目录**、让它自己「落点写死」的路径都指向夹具；D 类扫描根同理
  //   （opuscar 走 `LEMO_OPUSCAR`，lemo-tools 走 `<脚本>/..` = 临时根）。
  const VALID_MJS =
    "const VENC = process.env.LEMO_VENC || 'h264_nvenc';\n"
    + "if (VENC !== 'h264_nvenc' && VENC !== 'libx264') { process.exit(1); }\n";
  const VALID_SH =
    '#!/bin/sh\n'
    + 'case "${LEMO_VENC:-}" in\n'
    + "  '') VENC=h264_nvenc ;;\n"
    + '  libx264) VENC=libx264 ;;\n'
    + '  *) echo bad; exit 1 ;;\n'
    + 'esac\n';
  /** 建一个「A 类 3 决策点合法 + D 类两仓非空」的极小夹具根，并写入一份文档。 */
  const fixture = (root, docMd) => {
    const gate = copyGate('check-render-venc.mjs', root);
    wf(path.join(root, 'dub.mjs'), VALID_MJS);
    wf(path.join(root, 'opuscar', 'core', 'render', 'video.mjs'), VALID_MJS);
    wf(path.join(root, 'opuscar', 'core', 'render', 'mux.sh'), VALID_SH);
    mk(path.join(root, 'styles'));
    wf(path.join(root, 'doc.md'), docMd);
    return gate;
  };
  const envFor = (root) => ({
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_STYLES_ROOT: path.join(root, 'styles'),
  });
  try {
    // 正向：文档把**自带 `mux.sh`** 说成用 `libx264`（无限定词）⇒ D 类② 命中 ⇒ exit 1 + 特有文案 + 点名。
    const pos = path.join(dir, 'pos');
    const gatePos = fixture(pos, 'demo 自带的 mux.sh 用的是 `libx264 -preset slow -crf 17 -r 60`。\n');
    const r1 = await run(NODE, [gatePos, '--no-wsl'], { env: envFor(pos) });
    expectBlind(r1, '1 处过期声称（脚本实际跟随', 'check-render-venc D 类② 正向');
    assert.ok(r1.out.includes('doc.md:1'),
      `D 类② 应点名 doc.md:1\n${r1.out.slice(0, 900)}`);
    // ★ 必须恰是 1 处：证明判据没有把同一行重复计（旧 D 类① 与 D 类② 不叠加）。
    assert.ok(!r1.out.includes('2 处过期声称（脚本实际跟随'),
      `D 类② 应只 1 处\n${r1.out.slice(0, 900)}`);

    // 阴性对照：同一份文档改成**合法表述**（显式/回退/不要写/硬写已修/命令示例）⇒ 0 命中、exit 0。
    const neg = path.join(dir, 'neg');
    const gateNeg = fixture(neg, [
      '- 显式 `libx264` 才走 CPU（默认走 GPU）。',
      '- `libx264` 回退分支只在显式指定时启用。',
      '- 不要写 `libx264` 当默认值。',
      '- 回退 `libx264 -preset slow -crf 16`（描述 CPU 分支）。',
      '- 以前 mux.sh 硬写 `libx264`，已修。',
      '- 命令示例：`ffmpeg -i in.mp4 -c:v libx264 -preset slow out.mp4`',
      '',
    ].join('\n'));
    const r2 = await run(NODE, [gateNeg, '--no-wsl'], { env: envFor(neg) });
    expectClean(r2, '处过期声称（脚本实际跟随', 'check-render-venc D 类② 阴性');
    assert.ok(r2.out.includes('D 类②·文档/注释'),
      `阴性对照应真的跑过 D 类② 判据\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 11c. ★自证 check-render-venc 的 D 类② ───────────────────────────────────
test('★自证 check-render-venc：短路 D 类② 判据后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-venc-d2');
  const VALID_MJS =
    "const VENC = process.env.LEMO_VENC || 'h264_nvenc';\n"
    + "if (VENC !== 'h264_nvenc' && VENC !== 'libx264') { process.exit(1); }\n";
  const VALID_SH =
    '#!/bin/sh\n'
    + 'case "${LEMO_VENC:-}" in\n'
    + "  '') VENC=h264_nvenc ;;\n"
    + '  libx264) VENC=libx264 ;;\n'
    + '  *) echo bad; exit 1 ;;\n'
    + 'esac\n';
  try {
    // 把 D 类② 的判据行短路成 `if (true) continue;`（该行整行不再匹配任何 clause）。
    const gate = mutate('check-render-venc.mjs', dir,
      'if (!/libx264/.test(c) || /h264_nvenc/i.test(c) || D_EXPL2.test(c) || !D_SCRIPT.test(c)) continue;',
      'if (true) continue;');
    // 同一套正向夹具：文档把自带 mux.sh 说成用 libx264（无限定词）。
    wf(path.join(dir, 'dub.mjs'), VALID_MJS);
    wf(path.join(dir, 'opuscar', 'core', 'render', 'video.mjs'), VALID_MJS);
    wf(path.join(dir, 'opuscar', 'core', 'render', 'mux.sh'), VALID_SH);
    mk(path.join(dir, 'styles'));
    wf(path.join(dir, 'doc.md'), 'demo 自带的 mux.sh 用的是 `libx264 -preset slow -crf 17 -r 60`。\n');
    const res = await run(NODE, [gate, '--no-wsl'], {
      env: { LEMO_OPUSCAR: path.join(dir, 'opuscar'), LEMO_STYLES_ROOT: path.join(dir, 'styles') },
    });
    // 判据被短路后：D 类② 不再命中（exit 0、无那句文案）⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '1 处过期声称（脚本实际跟随', 'mut'),
      undefined, '短路 D 类② 后正向断言竟然还通过 ⇒ 断言没在测该判据');
  } finally { rm(dir); }
});

// ── 12. check-derivation-caliber.mjs（5 条守卫里最外层的那条）───────────────
test('check-derivation-caliber：失明守卫②（注册表 styles 不是非空数组）', async () => {
  const dir = path.join(TMP, 'dv');
  try {
    // 正向：`styles: []` ⇒ 一条 entry 都没检查过 ⇒ 失明（`process.exit(1)`）。
    const pos = path.join(dir, 'pos.json');
    rj(pos, { styles: [] });
    const r1 = await runGate('check-derivation-caliber.mjs', { LEMO_DUB_STYLES: pos });
    expectBlind(r1, '本闸门已失明', 'check-derivation-caliber 正向');

    // 阴性对照：一条 entry，其 `derivation` 与「机械重算」逐轴一致，且需说明的口径都在 SKILL.md 里
    //   ⇒ ①②③ 全过 ⇒ exit 0。
    const neg = path.join(dir, 'neg.json');
    rj(neg, {
      _notes: ['subtitle.fontFamily 一律填本机字体（Microsoft YaHei / SimHei / SimSun / KaiTi / DengXian / Consolas）'],
      styles: [{
        slug: 'gb-dv',
        palette: { bg: '#101010' },
        subtitle: { fontFamily: 'Consolas' },
        derived: false,
        notes: '',
        derivation: { bg: 'proxy', font: 'substituted', subtitle: 'exact', accent: 'absent' },
      }],
    });
    const vis = path.join(dir, 'vis.json');
    rj(vis, { styles: { 'gb-dv': {} } });
    const root = path.join(dir, 'skills');
    wf(path.join(root, 'gb-dv', 'SKILL.md'),
      '# gb-dv\n\n底色 #101010 派生自 demo，字体 Consolas。\n');
    const r2 = await runGate('check-derivation-caliber.mjs',
      { LEMO_DUB_STYLES: neg, LEMO_DUB_VISUAL: vis, LEMO_DISTILL_ROOT: root });
    expectClean(r2, '本闸门已失明', 'check-derivation-caliber 阴性对照');
    assert.ok(r2.out.includes('✓ 每条 entry'),
      `阴性对照应真的判过每条 entry\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 13. check-dna-coverage.mjs（第二节：注册表字段消费覆盖）─────────────────
test('check-dna-coverage：第二节失明守卫（styles[] 为空 ⇒ 枚举到 0 条字段路径）', async () => {
  const dir = path.join(TMP, 'dna');
  try {
    // 正向：注册表 styles[] 为空 ⇒ `dubStylesOk` false ⇒ 第二节「**本闸门已失明**」。
    const pos = path.join(dir, 'pos.json');
    rj(pos, { styles: [] });
    const r1 = await runGate('check-dna-coverage.mjs', { LEMO_DUB_STYLES: pos });
    expectBlind(r1, '**本闸门已失明**', 'check-dna-coverage 正向');

    // 阴性对照：一条 entry（`_notes` 是白名单元数据、其余字段在真实运行时代码里都有消费者）
    //   + 第三节：`textureRaw` 落在可解析集合 R 里、散文里能找到「声明但未实现」条目
    //   ⇒ 一二三节 0 FAIL ⇒ exit 0。
    //   ★ 第三节的**豁免表 `TEXTURE_COVERED_BY_OTHER` 是硬编码的**（`vignette` / `paper-grain`），
    //     且判据 (A5)「豁免腐烂」要求**注册表里必须有风格声明这两个值**，否则 FAIL。
    //     ⇒ 最小合法夹具**必须**把这两个值也声明进去（这是闸门真实的口径，不是夹具将就）；
    //     `none` 落在 R 里、另两个落在豁免表里，三条都放行。
    const neg = path.join(dir, 'neg.json');
    rj(neg, {
      _notes: ['★ textureRaw **声明但未实现**：（当前无）'],
      styles: [
        { slug: 'gb-dc-a', palette: { bg: '#101010' }, bgRecipe: { textureRaw: 'none' } },
        { slug: 'gb-dc-b', palette: { bg: '#101010' }, bgRecipe: { textureRaw: 'vignette' } },
        { slug: 'gb-dc-c', palette: { bg: '#101010' }, bgRecipe: { textureRaw: 'paper-grain' } },
      ],
    });
    const r2 = await runGate('check-dna-coverage.mjs', { LEMO_DUB_STYLES: neg });
    expectClean(r2, '**本闸门已失明**', 'check-dna-coverage 阴性对照');
    assert.ok(r2.out.includes('✓ 第二节：注册表每条字段路径'),
      `阴性对照应真的跑过第二节判据\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 14. check-config-vs-doc.mjs（底色 vs 文档 §3）────────────────────────────
test('check-config-vs-doc：失明守卫（0 个风格 / 全部风格都进 noSec）', async () => {
  const dir = path.join(TMP, 'cvd');
  try {
    // 正向：`styles: []` ⇒ 0 个风格 ⇒ 失明（并**抑制**那句「✓ 所有风格…」）。
    const pos = path.join(dir, 'pos.json');
    rj(pos, { styles: [] });
    const r1 = await runGate('check-config-vs-doc.mjs', { LEMO_DUB_STYLES: pos });
    expectBlind(r1, '本闸门已失明', 'check-config-vs-doc 正向');

    // 阴性对照：一个风格，其 `palette.bg` 在 §3 表格里**以背景角色**（角色列不含灯/光/强调类词）出现
    //   ⇒ 放行 ⇒ exit 0。
    const neg = path.join(dir, 'neg.json');
    rj(neg, { styles: [{ slug: 'gb-cvd', palette: { bg: '#101010' } }] });
    const root = path.join(dir, 'skills');
    wf(path.join(root, 'gb-cvd', 'SKILL.md'),
      '# gb-cvd\n\n## 3. 配色体系\n\n| 角色 | 色值 | 用途 |\n|---|---|---|\n| 底色 | `#101010` | 主背景 |\n');
    const r2 = await runGate('check-config-vs-doc.mjs',
      { LEMO_DUB_STYLES: neg, LEMO_DISTILL_ROOT: root });
    expectClean(r2, '本闸门已失明', 'check-config-vs-doc 阴性对照');
    assert.ok(r2.out.includes('✓ 所有风格的底色都能'),
      `阴性对照应真的比过这个风格\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 15. check-skill-scores.mjs（评分自洽性）─────────────────────────────────
test('check-skill-scores：失明守卫（一个带 _distill.json 的风格都枚举不到）', async () => {
  const dir = path.join(TMP, 'sco');
  try {
    // 正向：技能树是空目录 ⇒ slugs.length===0 ⇒ ①②③ 一条都没执行 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-skill-scores.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, '本闸门已失明', 'check-skill-scores 正向');

    // 阴性对照：一份 `_distill.json`（matchScore == 五项之和）+ 自评行与之一致的 SKILL.md
    //   ⇒ ①②③ 全过 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    rj(path.join(neg, 'gb-ss', '_distill.json'), {
      matchScore: 90,
      scoreBreakdown: { palette: 20, composition: 20, typography: 20, rhythm: 15, audio: 15 },
      defects: [],
    });
    wf(path.join(neg, 'gb-ss', 'SKILL.md'), '# gb-ss\n\n## 风格匹配度自评 **90/100**\n');
    const cfg = path.join(dir, 'cfg.json');
    rj(cfg, { styles: [{ slug: 'gb-ss' }] });
    const r2 = await runGate('check-skill-scores.mjs', { LEMO_DISTILL_ROOT: neg, LEMO_DUB_STYLES: cfg });
    expectClean(r2, '本闸门已失明', 'check-skill-scores 阴性对照');
    assert.ok(r2.out.includes('[1] matchScore == scoreBreakdown 五项之和：1/1'),
      `阴性对照应真的判过这一份\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 16. check-api-docs.mjs（HTTP 路由 ↔ README）─────────────────────────────
test('check-api-docs：失明守卫（server 侧解析出 0 条 /api 路由）', async () => {
  const dir = path.join(TMP, 'api');
  const README_OK =
    '# 文档\n\n## HTTP 接口清单\n\n| 方法 | 路径 | 用途 | 类型 |\n|---|---|---|---|\n'
    + '| GET | `/api/x` | 用途 | 同步 |\n';
  try {
    // 正向：server.mjs 里一条 /api 路由都没有（README 侧正常）⇒ serverSet 为空 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    const gatePos = copyGate('check-api-docs.mjs', pos);
    wf(path.join(pos, 'server.mjs'), '// 没有任何 /api 路由\n');
    wf(path.join(pos, 'README.md'), README_OK);
    const r1 = await run(NODE, [gatePos]);
    expectBlind(r1, '本闸门已**失明**', 'check-api-docs 正向');

    // 阴性对照：两侧各一条同形状路由 ⇒ 双向无差异 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    const gateNeg = copyGate('check-api-docs.mjs', neg);
    wf(path.join(neg, 'server.mjs'),
      "http.createServer((req, res) => {\n  const p = req.url;\n  const m = req.method;\n"
      + "  if (p === '/api/x' && m === 'GET') return;\n"
      + "  if (p.startsWith('/api/')) { res.statusCode = 404; return; }\n});\n");
    wf(path.join(neg, 'README.md'), README_OK);
    const r2 = await run(NODE, [gateNeg]);
    expectClean(r2, '本闸门已**失明**', 'check-api-docs 阴性对照');
    assert.ok(r2.out.includes('✓ 两边完全对应'),
      `阴性对照应真的双向比过\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 17. check-esm-import-paths.mjs（动态 import 传运行时绝对路径）───────────
test('check-esm-import-paths：失明守卫（扫描根收集到 0 个 .mjs/.js）', async () => {
  const dir = path.join(TMP, 'esm');
  try {
    // 正向：LEMO_OPUSCAR 指向一棵没有 styles/*/demo/** 也没有 core/** 的树 ⇒ files 0 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-esm-import-paths.mjs', { LEMO_OPUSCAR: pos });
    expectBlind(r1, '本闸门已失明', 'check-esm-import-paths 正向');

    // 阴性对照：`core/` 下放一个不含动态 import 的 .mjs ⇒ 收集到 1 个、0 违规 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'core', 'x.mjs'), 'export const a = 1;\n');
    const r2 = await runGate('check-esm-import-paths.mjs', { LEMO_OPUSCAR: neg });
    expectClean(r2, '本闸门已失明', 'check-esm-import-paths 阴性对照');
    assert.ok(r2.out.includes('扫描 .mjs/.js：1 个'),
      `阴性对照应真的扫到 1 个文件\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 18. check-aspect-declaration.mjs（无 film*.js 风格的入口自适应探测）──────
test('check-aspect-declaration：失明守卫（枚举到 0 个风格）', async () => {
  const dir = path.join(TMP, 'ad');
  try {
    // 正向：风格根是空目录 ⇒ 枚举到 0 个风格 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-aspect-declaration.mjs', { LEMO_STYLES_ROOT: pos });
    expectBlind(r1, '本闸门已**失明**', 'check-aspect-declaration 正向');

    // 阴性对照：一个风格、有 `demo/film.js`（探测看得见它）⇒ 不查真实入口 ⇒ 0 处 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'gb-ad', 'demo', 'film.js'), 'export const FILM_META = { aspects: ["16:9"] };\n');
    const r2 = await runGate('check-aspect-declaration.mjs', { LEMO_STYLES_ROOT: neg });
    expectClean(r2, '本闸门已**失明**', 'check-aspect-declaration 阴性对照');
    assert.ok(r2.out.includes('有 film*.js 1 个'),
      `阴性对照应真的枚举到 1 个风格且探测可见\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 19. check-mux-selection.mjs（交付路径感知的混流脚本）────────────────────
test('check-mux-selection：失明守卫（styles 下扫到 0 个风格目录）', async () => {
  const dir = path.join(TMP, 'mux');
  try {
    // 正向：`styles/` 存在但是空目录 ⇒ 一个混流脚本都没检查过 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(path.join(pos, 'styles'));
    const r1 = await runGate('check-mux-selection.mjs', { LEMO_OPUSCAR: pos });
    expectBlind(r1, '本闸门已失明', 'check-mux-selection 正向');

    // 阴性对照：一个风格、自带 `demo/tools/mux.sh` 且含 `A="$2"`（会被编排器挑中）
    //   且四项口径齐（LN_TP 可覆盖 / 真峰值复核 / exit 0 / 无「续行被注释吃掉」）⇒ exit 0。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'styles', 'gb-mux', 'demo', 'tools', 'mux.sh'),
      '#!/bin/sh\n'
      + 'A="$2"\n'
      + 'LN_TP="${LEMO_LN_TP:--1.7}"\n'
      + 'TP=$(ffmpeg -i "$A" -f null - 2>&1 | grep -o "input_tp[^,]*")\n'
      + 'if [ "$(echo "$TP <= -1.2" | bc)" = "1" ]; then echo ok; fi\n'
      + 'exit 0\n');
    const r2 = await runGate('check-mux-selection.mjs', { LEMO_OPUSCAR: neg });
    expectClean(r2, '本闸门已失明', 'check-mux-selection 阴性对照');
    assert.ok(r2.out.includes('走自带 mux 的 1 个'),
      `阴性对照应真的挑中这个自带脚本\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 19b. check-mux-parity.mjs（自带 demo/mux.sh ↔ core 的口径 parity；2026-10-07 b84-c 新建 / b84-a 并入）──
test('check-mux-parity：失明守卫（无 styles / 有 styles 但一个自带 demo/mux.sh 都没有）', async () => {
  const dir = path.join(TMP, 'muxpar');
  try {
    // 正向 A：`styles/` 读不到（只有 core）⇒ 一个风格都没扫到 ⇒ 失明。
    const pos = path.join(dir, 'pos');
    wf(path.join(pos, 'core', 'render', 'mux.sh'),
      '#!/bin/sh\nLN_TP="${LEMO_LN_TP:--1.7}"\nLN_TP_STEP="${LEMO_LN_TP_STEP:-0.25}"\nLN_TP_TRIES="${LEMO_LN_TP_TRIES:-8}"\n');
    const r1 = await runGate('check-mux-parity.mjs', { LEMO_OPUSCAR: pos });
    expectBlind(r1, '本闸门已失明', 'check-mux-parity 正向 A');

    // 正向 B：`styles/` 有风格、但**一个自带 demo/mux.sh 都没有** ⇒ 一个自带脚本都没检查过 ⇒ 失明。
    //   ★ 这条是本闸门**独有**的守卫（别的闸门没有「0 个自带 mux.sh」这一态），必须单独钉住。
    const pos2 = path.join(dir, 'pos2');
    wf(path.join(pos2, 'core', 'render', 'mux.sh'),
      '#!/bin/sh\nLN_TP="${LEMO_LN_TP:--1.7}"\nLN_TP_STEP="${LEMO_LN_TP_STEP:-0.25}"\nLN_TP_TRIES="${LEMO_LN_TP_TRIES:-8}"\n');
    mk(path.join(pos2, 'styles', 'gb-a'));
    mk(path.join(pos2, 'styles', 'gb-b'));
    const r2 = await runGate('check-mux-parity.mjs', { LEMO_OPUSCAR: pos2 });
    expectBlind(r2, '一个都枚举不到', 'check-mux-parity 正向 B');

    // 阴性对照：core + 一个自带 demo/mux.sh、口径与 core 逐项一致 ⇒ exit 0 且**真的**印出「与 core 同口径」。
    //   （只断言 exit 0 会被「永远 exit 1」的坏断言满足 ⇒ 必须钉那句 ✓ 文案。）
    const neg = path.join(dir, 'neg');
    const CORE_OK = '#!/bin/sh\n'
      + 'LN_TP="${LEMO_LN_TP:--1.7}"\n'
      + 'LN_TP_STEP="${LEMO_LN_TP_STEP:-0.25}"\n'
      + 'LN_TP_TRIES="${LEMO_LN_TP_TRIES:-8}"\n';
    const OWN_OK = CORE_OK
      + 'J=$(ffmpeg -i "$A" -af loudnorm=I=-14:TP=$LN_TP:print_format=json -f null - 2>&1)\n'
      + 'case "${LEMO_VENC:-}" in\n'
      + '  \'\'|h264_nvenc) VARG="-c:v h264_nvenc" ;;\n'
      + '  libx264) VARG="-c:v libx264" ;;\n'
      + '  *) echo bad; exit 1 ;;\n'
      + 'esac\n'
      + 'TP_TRY="$LN_TP"; ATTEMPT=0\n'
      + 'while [ "$ATTEMPT" -lt "$LN_TP_TRIES" ]; do\n'
      + '  ATTEMPT=$((ATTEMPT + 1))\n'
      + '  awk -v p="$OP" \'BEGIN { exit !(p + 0 <= -1.2) }\' && break\n'
      + '  TP_TRY=$(awk -v t="$TP_TRY" -v s="$LN_TP_STEP" \'BEGIN { printf "%.3f", t - s }\')\n'
      + 'done\n';
    wf(path.join(neg, 'core', 'render', 'mux.sh'), CORE_OK);
    wf(path.join(neg, 'styles', 'gb-parity', 'demo', 'mux.sh'), OWN_OK);
    const r3 = await runGate('check-mux-parity.mjs', { LEMO_OPUSCAR: neg });
    expectClean(r3, '本闸门已失明', 'check-mux-parity 阴性对照');
    assert.ok(r3.out.includes('✓ 与 core 同口径'),
      `阴性对照应真的判它同口径（而不是只 exit 0）\n${r3.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

test('check-mux-parity：核心判据（LN_TP 漂移 / 编码器守卫被拆 ⇒ 未登记分叉）', async () => {
  const dir = path.join(TMP, 'muxpar2');
  try {
    const CORE_OK = '#!/bin/sh\nLN_TP="${LEMO_LN_TP:--1.7}"\nLN_TP_STEP="${LEMO_LN_TP_STEP:-0.25}"\nLN_TP_TRIES="${LEMO_LN_TP_TRIES:-8}"\n';

    // 正向 A：自带 mux 的 `LN_TP` 默认值改成 −2.5（core 仍是 −1.7）⇒ 未登记分叉 ⇒ exit 1 且点名该 slug 与那个值。
    const pos = path.join(dir, 'pos');
    const OWN_DRIFT = CORE_OK.replace('LN_TP="${LEMO_LN_TP:--1.7}"', 'LN_TP="${LEMO_LN_TP:--2.5}"')
      + 'loudnorm=I=-14\n'
      + 'case "${LEMO_VENC:-}" in\n  \'\'|h264_nvenc) ;; ;;\n  libx264) ;; ;;\n  *) exit 1 ;;\nesac\n'
      + 'TP_TRY="$LN_TP"; ATTEMPT=0\nwhile [ "$ATTEMPT" -lt "$LN_TP_TRIES" ]; do :; done\n'
      + 'awk \'BEGIN { exit !(0 <= -1.2) }\'\n';
    wf(path.join(pos, 'core', 'render', 'mux.sh'), CORE_OK);
    wf(path.join(pos, 'styles', 'gb-parity', 'demo', 'mux.sh'), OWN_DRIFT);
    const r1 = await runGate('check-mux-parity.mjs', { LEMO_OPUSCAR: pos });
    assert.notEqual(r1.code, 0, `LN_TP 漂移应 exit≠0\n${r1.out.slice(0, 700)}`);
    assert.ok(r1.out.includes('gb-parity') && r1.out.includes('-2.5'),
      `应点名 gb-parity 与 -2.5（而不只是「退出码非 0」）\n${r1.out.slice(0, 700)}`);

    // 正向 B：编码器守卫被拆（未设支改成 CPU）⇒ `VENC_GUARD` 未登记分叉 ⇒ exit 1。
    //   ★ 这条钉的是用户**最高优先级硬规则「渲染一律 GPU」**的落地判据，必须能单独变红。
    const pos2 = path.join(dir, 'pos2');
    const OWN_BADVENC = CORE_OK
      + 'loudnorm=I=-14\n'
      + 'case "${LEMO_VENC:-}" in\n  \'\'|libx264) VARG="-c:v h264_nvenc" ;;\n  libx264) VARG="-c:v libx264" ;;\n  libx264x) exit 1 ;;\nesac\n'
      + 'TP_TRY="$LN_TP"; ATTEMPT=0\nwhile [ "$ATTEMPT" -lt "$LN_TP_TRIES" ]; do :; done\n'
      + 'awk \'BEGIN { exit !(0 <= -1.2) }\'\n';
    wf(path.join(pos2, 'core', 'render', 'mux.sh'), CORE_OK);
    wf(path.join(pos2, 'styles', 'gb-parity', 'demo', 'mux.sh'), OWN_BADVENC);
    const r2 = await runGate('check-mux-parity.mjs', { LEMO_OPUSCAR: pos2 });
    assert.notEqual(r2.code, 0, `编码器守卫被拆应 exit≠0\n${r2.out.slice(0, 700)}`);
    assert.ok(r2.out.includes('VENC_GUARD') || r2.out.includes('编码器守卫'),
      `应报编码器守卫（而不只是「退出码非 0」）\n${r2.out.slice(0, 700)}`);

    // 阴性对照：与 core 逐项一致 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    const OWN_OK = CORE_OK
      + 'loudnorm=I=-14\n'
      + 'case "${LEMO_VENC:-}" in\n  \'\'|h264_nvenc) VARG="-c:v h264_nvenc" ;;\n  libx264) VARG="-c:v libx264" ;;\n  *) exit 1 ;;\nesac\n'
      + 'TP_TRY="$LN_TP"; ATTEMPT=0\nwhile [ "$ATTEMPT" -lt "$LN_TP_TRIES" ]; do :; done\n'
      + 'awk \'BEGIN { exit !(0 <= -1.2) }\'\n';
    wf(path.join(neg, 'core', 'render', 'mux.sh'), CORE_OK);
    wf(path.join(neg, 'styles', 'gb-parity', 'demo', 'mux.sh'), OWN_OK);
    const r3 = await runGate('check-mux-parity.mjs', { LEMO_OPUSCAR: neg });
    expectClean(r3, '本闸门已失明', 'check-mux-parity 核心判据阴性对照');
  } finally { rm(dir); }
});

test('★自证 check-mux-parity：清空「已记录分叉」清单 ⇒ pictogram-motion 必须翻红', async () => {
  const dir = path.join(TMP, 'muxpar3');
  try {
    // ★ 封闭证明（不依赖真库当前状态）：**同一棵夹具树**，只换「清单被清空的副本」⇒ 绿→红。
    //   夹具的 `styles/pictogram-motion/demo/mux.sh` 按**真脚本的形状**造（有编码器守卫、无 LN_TP / 无 loudnorm / 无闭环）
    //   ⇒ 命中真清单里 pictogram-motion 登记的那 5 项。
    const fixture = path.join(dir, 'hermetic');
    const CORE_OK = '#!/bin/sh\nLN_TP="${LEMO_LN_TP:--1.7}"\nLN_TP_STEP="${LEMO_LN_TP_STEP:-0.25}"\nLN_TP_TRIES="${LEMO_LN_TP_TRIES:-8}"\n';
    const PICTO_SHAPE = '#!/bin/sh\n'
      + 'case "${LEMO_VENC:-}" in\n  \'\'|h264_nvenc) VARG="-c:v h264_nvenc" ;;\n  libx264) VARG="-c:v libx264" ;;\n  *) exit 1 ;;\nesac\n';
    wf(path.join(fixture, 'core', 'render', 'mux.sh'), CORE_OK);
    wf(path.join(fixture, 'styles', 'pictogram-motion', 'demo', 'mux.sh'), PICTO_SHAPE);
    const CLEAR = [[/const KNOWN_DIVERGENCES = \{[\s\S]*?\n\};/, 'const KNOWN_DIVERGENCES = {};']];

    // 前提（阴性对照）：真清单**原样** ⇒ 那 5 项全走「已登记积压」⇒ exit 0。
    const gKeep = patchGate('check-mux-parity.mjs', path.join(dir, 'keep'), []);
    const rk = await run(NODE, [gKeep], { env: { LEMO_OPUSCAR: fixture } });
    assert.equal(rk.code, 0,
      `★自证前提不成立：真清单下 pictogram-motion 形状的脚本应走「已登记积压」⇒ exit 0\n${rk.out.slice(0, 900)}`);
    assert.ok(rk.out.includes('已登记积压 5 项'),
      `真清单下应记 5 项积压\n${rk.out.slice(0, 900)}`);

    // 把真实闸门拷到临时目录，用**正则**精确清空 `KNOWN_DIVERGENCES` 的清单体。
    //   ★ `patchGate` 的两道防空转守卫（先断言片段存在、再断言替换生效）对 RegExp 形态同样适用
    //     ⇒ 闸门改了写法时这条自证会**当场报错**，而不是静默空转成假绿。
    const g = patchGate('check-mux-parity.mjs', path.join(dir, 'cleared'), CLEAR);
    assert.ok(fs.existsSync(g), '★自证夹具：清空清单的闸门副本应已落盘');
    assert.ok(!fs.readFileSync(g, 'utf8').includes("'pictogram-motion': {"),
      '★自证夹具：清单体应真的被清空（防空转）');
    const r1 = await run(NODE, [g], { env: { LEMO_OPUSCAR: fixture } });
    assert.notEqual(r1.code, 0,
      `清空清单后 pictogram-motion 应翻成 FAIL ⇒ 清单是判据的一半\n${r1.out.slice(0, 900)}`);
    assert.ok(r1.out.includes('pictogram-motion') && r1.out.includes('未登记分叉'),
      `应点名 pictogram-motion 的未登记分叉（而不只是「退出码非 0」）\n${r1.out.slice(0, 900)}`);

    // ★ 集成复核（真库）：真实树 + **未改**清单 ⇒ exit 0（那份积压是「只列不判」的）。
    //   ★ 这条**依赖真库当前状态**（`pictogram-motion` 的 mux.sh 仍是另一套架构）——
    //     若哪天它被修好并删掉登记，这里会**大声报错**（不是静默假绿），届时按新事实更新。
    const r0 = await runGate('check-mux-parity.mjs', {});
    assert.equal(r0.code, 0,
      `集成复核：真实树 + 未改清单应 exit 0（pictogram-motion 的积压登记已失效？）\n${r0.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 20. check-venc-args.mjs（编码器参数组合的真编码闸门）────────────────────
test('check-venc-args：失明守卫（抽到的编码器参数组合为 0）', async () => {
  const dir = path.join(TMP, 'varg');
  try {
    // 正向：仓库树里没有任何 `case "${LEMO_VENC:-}" in` / vencArgs 写法 ⇒ 组合数 0 ⇒ 失明
    //   （★ `runAll()` 在 list 为空时**直接返回**，不会去调 WSL —— 这条用例零外部依赖）。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-venc-args.mjs', { LEMO_OPUSCAR: pos });
    expectBlind(r1, '本闸门已**失明**', 'check-venc-args 正向');

    // 阴性对照：一个 `core/render/*.sh`，`case` 块里**只有一条** libx264 分支
    //   ⇒ 组合数 1（纯 CPU 编码，**不碰 GPU**）⇒ 真在 WSL 里编 1 帧、ffmpeg 接受 ⇒ exit 0。
    //   ★ 只留 libx264 分支是刻意的：nvenc 分支会占用用户正在跑渲染的那块 GPU。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'core', 'render', 'gb.sh'),
      '#!/bin/sh\n'
      + 'case "${LEMO_VENC:-}" in\n'
      + '  libx264) VARG="-c:v libx264 -preset medium -crf 19" ;;\n'
      + 'esac\n'
      + 'ffmpeg -i in.mp4 $VARG out.mp4\n');
    const r2 = await runGate('check-venc-args.mjs', { LEMO_OPUSCAR: neg });
    expectClean(r2, '本闸门已**失明**', 'check-venc-args 阴性对照');
    assert.ok(r2.out.includes('组合 1 个、ffmpeg 拒绝 0 个'),
      `阴性对照应真的抽出 1 个组合并实测通过\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 21. check-film-aspect.mjs（C 类：实际成片文件的画幅）────────────────────
test('check-film-aspect：C 类失明守卫（实际成片扫到 0 部）', async () => {
  const dir = path.join(TMP, 'fa');
  const mkTree = (root, filmsRoot) => {
    rj(path.join(root, 'distill', 'gb-fa', '_distill.json'),
      { generatedVideo: { width: 1920, height: 1080 } });
    mk(path.join(root, 'styles', 'gb-fa'));
    mk(filmsRoot);
    return {
      LEMO_DISTILL_ROOT: path.join(root, 'distill'),
      LEMO_STYLES_ROOT: path.join(root, 'styles'),
      LEMO_FILMS_ROOT: filmsRoot,
    };
  };
  try {
    // 正向：成片文件根**存在但是空的** ⇒ filmsFound 0 ⇒ C 类失明（A/B 两类的夹具本身是合法的）。
    const pos = path.join(dir, 'pos');
    const r1 = await runGate('check-film-aspect.mjs', mkTree(pos, path.join(pos, 'films')));
    expectBlind(r1, '实际成片扫到 0 部', 'check-film-aspect 正向');

    // 阴性对照：放一部**真的 1920×1080** 的极小 mp4（ffmpeg 现造，纯 CPU，几 KB）
    //   ⇒ filmsFound 1、A/B/C 三类全过 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    const envNeg = mkTree(neg, path.join(neg, 'films'));
    const mp4 = path.join(envNeg.LEMO_FILMS_ROOT, 'gb-fa', 'gb-fa.mp4');
    mk(path.dirname(mp4));
    assert.ok(fs.existsSync(FFMPEG), `阴性对照依赖本机 ffmpeg 存在：${FFMPEG}`);
    const gen = await run(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi',
      '-i', 'color=c=black:s=1920x1080:d=0.2:r=25', '-frames:v', '1',
      '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '45', mp4]);
    assert.equal(gen.code, 0, `夹具：ffmpeg 生成 1920x1080 测试片失败\n${gen.out.slice(0, 400)}`);
    assert.ok(fs.existsSync(mp4), `夹具：测试片没生成：${mp4}`);
    const r2 = await runGate('check-film-aspect.mjs', envNeg);
    expectClean(r2, '本闸门已**失明**', 'check-film-aspect 阴性对照');
    assert.ok(r2.out.includes('全部成片画幅一致'),
      `阴性对照应真的判过这部成片\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 22. check-dual-copy-sync.mjs（WIN ↔ WSL 两份副本）───────────────────────
test('check-dual-copy-sync：WIN 侧失明守卫（副本扫到 0 个文本文件）', async () => {
  const dir = path.join(TMP, 'dual');
  const WSL_TMP = `/tmp/gb-blind-neg-${process.pid}`;   // ★ 按进程唯一（同 TMP 的并发理由）
  try {
    // 正向：WIN 副本根存在但是空的 ⇒ winMap.size 0 ⇒ 失明。
    //   ★ 加 `--no-wsl`：本闸门的 WSL 侧失明守卫另有其人（这里只钉 WIN 侧那条），且能省一次 wsl 启动。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGateArgs('check-dual-copy-sync.mjs', ['--no-wsl'], { LEMO_OPUSCAR: pos });
    expectBlind(r1, '本闸门已**失明**', 'check-dual-copy-sync 正向');

    // 阴性对照：WIN 侧与 WSL 侧各放**同一份内容**的文本文件 ⇒ 源文件 0 漂移 ⇒ exit 0。
    //   ★ 这里必须真跑 WSL 侧（`--no-wsl` 下任何 WIN 侧文件都会被算成「WSL 侧缺失」= 源文件漂移）。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'a.md'), 'hello\n');
    const setup = await wsl(`mkdir -p ${WSL_TMP} && printf 'hello\\n' > ${WSL_TMP}/a.md`);
    assert.equal(setup.code, 0, `夹具：WSL 侧建树失败\n${setup.out.slice(0, 400)}`);
    const r2 = await runGate('check-dual-copy-sync.mjs',
      { LEMO_OPUSCAR: neg, LEMO_WSL_ROOT: WSL_TMP });
    expectClean(r2, '本闸门已**失明**', 'check-dual-copy-sync 阴性对照');
    assert.ok(r2.out.includes('✓ 源文件两侧逐字节一致'),
      `阴性对照应真的比过两侧\n${r2.out.slice(0, 900)}`);
  } finally {
    rm(dir);
    await wsl(`rm -rf ${WSL_TMP}`);
  }
});

// ── 23. check-dub-styles.mjs（纹理硬红线 + 字幕底衬）────────────────────────
test('check-dub-styles：失明守卫（styles-root 未找到 / 全部 STYLE.md 读不到）', async () => {
  const dir = path.join(TMP, 'dubs');
  try {
    // ★ 该闸门的注册表路径**写死**在脚本 ROOT 下（无覆盖点）⇒ 夹具必须去满足**真实注册表**的每个 slug。
    //   正向：styles-root 指向一个空目录 ⇒ 全部风格 SKIP ⇒ skipped === styles.length ⇒ 失明。
    const pos = path.join(dir, 'pos');
    mk(pos);
    const r1 = await runGate('check-dub-styles.mjs', { LEMO_STYLES_ROOT: pos });
    expectBlind(r1, '失明：styles-root', 'check-dub-styles 正向');

    // 阴性对照：按真实注册表逐风格造一份**刚好不触红线**的 STYLE.md ——
    //   `texture ∈ {scanlines}` ⇒ 正文正面提「scanlines」；`texture = grain` ⇒ 正面提「grain」；
    //   其余纹理 ⇒ 两个词都不提（否则会踩「硬红线 5：有声明但配置没开」）。
    const reg = JSON.parse(fs.readFileSync(path.join(TOOLS, 'lib', 'dub-styles.json'), 'utf8'));
    assert.ok(Array.isArray(reg.styles) && reg.styles.length > 0, '夹具：真实注册表应有 styles[]');
    const neg = path.join(dir, 'neg');
    for (const st of reg.styles) {
      const tex = String((st.bgRecipe || {}).texture || 'none');
      const md = (tex === 'scanlines' || tex === 'scanline') ? '# placeholder\n\n扫描线 scanlines 是定义层。\n'
        : (tex === 'grain') ? '# placeholder\n\n颗粒 grain 是定义层。\n'
          : '# placeholder\n\n纯色底，无额外纹理层。\n';
      wf(path.join(neg, st.slug, 'STYLE.md'), md);
    }
    const r2 = await runGate('check-dub-styles.mjs', { LEMO_STYLES_ROOT: neg });
    expectClean(r2, '失明：styles-root', 'check-dub-styles 阴性对照');
    assert.ok(r2.out.includes('✓ 未发现纹理硬红线不一致'),
      `阴性对照应真的判过全部风格\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 24. check-audio-chain.mjs（音频链可跑性）────────────────────────────────
test('check-audio-chain：失明守卫（候选清单从编排器里一条都解析不出来）', async () => {
  const dir = path.join(TMP, 'ac');
  try {
    // 正向：LEMO_MAKE 指向一个**存在但没有任何候选标记**的文件 ⇒ 7 类候选清单全部解析为空 ⇒ 失明。
    //   （比「文件不存在」强：它证明的是**解析**这条守卫，不是「路径打错了」。）
    const pos = path.join(dir, 'pos');
    wf(path.join(pos, 'make.mjs'), '// 没有任何候选清单标记\n');
    mk(path.join(pos, 'styles'));
    const r1 = await runGate('check-audio-chain.mjs',
      { LEMO_MAKE: path.join(pos, 'make.mjs'), LEMO_STYLES_ROOT: path.join(pos, 'styles') });
    expectBlind(r1, '候选清单解析为空：混音脚本', 'check-audio-chain 正向');

    // 阴性对照：造一份**最小但形状正确**的编排器文本（7 类标记各配一条 `for c in "$D/…"`）
    //   + 一个自带 `mix.py` 的风格（⇒ C 类，混音步跑得起来）⇒ 0 FAIL ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    wf(path.join(neg, 'make.mjs'),
      'for c in "$D/voice_fx.py" "$D/voice.py"; do :; done\n'
      + '{ VOICEFX=1; }\n'
      + 'for c in "$D/tts/gen.py"; do :; done\n'
      + '{ TTSOWN=1; }\n'
      + 'for c in "$D/music.py" "$D/sound.py"; do :; done\n'
      + '{ MUSIC=1; }\n'
      + 'for c in "$D/mix.py" "$D/sound.py" "$D/audio/mix.py"; do :; done\n'
      + '{ MIX=1; }\n'
      + 'for c in "$D/foley.py"; do :; done\n'
      + '{ FOLEY=1; }\n'
      + 'for c in "$D/mix.wav"; do :; done\n'
      + 'if [ -f "$D/lines.json" ]; then :; fi\n');
    wf(path.join(neg, 'styles', 'gb-ac', 'demo', 'mix.py'), '# mix\n');
    const r2 = await runGate('check-audio-chain.mjs',
      { LEMO_MAKE: path.join(neg, 'make.mjs'), LEMO_STYLES_ROOT: path.join(neg, 'styles') });
    expectClean(r2, '候选清单解析为空', 'check-audio-chain 阴性对照');
    assert.ok(r2.out.includes('有混音脚本 1'),
      `阴性对照应真的把它判成 C 类\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 25. check-ref-lines.mjs 的**第二条**失明守卫 ────────────────────────────
//   （第一条「一个引用都没找到」已被既有用例 6 覆盖；这条管的是**引用全解析不到文件**。）
test('check-ref-lines：失明守卫②（找到引用但一处都解析不到文件）', async () => {
  const dir = path.join(TMP, 'ref2');
  const envFor = (root) => ({
    LEMO_TOOLS_ROOT: root,
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_STYLES_ROOT: path.join(root, 'opuscar', 'styles'),
    LEMO_DISTILL_ROOT: path.join(root, 'distill'),
  });
  try {
    // 正向：文档里**有**一条引用，但那个文件在任何一个解析根下都不存在
    //   ⇒ refCount>0 且 resolvedCount===0 ⇒ 失明②（第一条守卫不会命中）。
    const pos = path.join(dir, 'pos');
    for (const d of ['test', 'opuscar', 'distill']) mk(path.join(pos, d));
    wf(path.join(pos, 'test', 'README.md'), '# 测试\n\n见 `nope/does-not-exist.mjs:1`。\n');
    const r1 = await runGate('check-ref-lines.mjs', envFor(pos));
    expectBlind(r1, '一处都解析不到文件', 'check-ref-lines 正向②');

    // 阴性对照：同一条引用改成一个**真的存在**的同目录文件 ⇒ 解析成功 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    for (const d of ['test', 'opuscar', 'distill']) mk(path.join(neg, d));
    wf(path.join(neg, 'test', 'target.mjs'), 'line1\nline2\nline3\n');
    wf(path.join(neg, 'test', 'README.md'), '# 测试\n\n见 `target.mjs:1`。\n');
    const r2 = await runGate('check-ref-lines.mjs', envFor(neg));
    expectClean(r2, '一处都解析不到文件', 'check-ref-lines 阴性对照②');
    assert.ok(r2.out.includes('解析到文件 1 处'),
      `阴性对照应真的解析到那个文件\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ══════════════════════════════════════════════════════════════════════════
// 第 26–31 条（2026-10-07 扩批）：补上最后 6 个未覆盖闸门 ⇒ 覆盖面 24 → **30（全部）**。
//   夹具手法按「闸门怎么取根」分三种（都**只读真实仓**，绝不改任何真实数据）：
//     · 有**覆盖点环境变量**的（check-film-delivery：LEMO_DISTILL_ROOT / LEMO_MUX_SH / LEMO_OPUSCAR /
//       LEMO_BATCH_DIR / LEMO_LOCK_DIR）⇒ 全走 env，不碰真实仓、也不碰 `D:/lemo-films/` 的成片；
//     · 落点按**脚本自身位置**推导的（check-plate-pixel：`ROOT = HERE/..`）⇒ 整棵拷到临时目录
//       （`copyGate`），并把它自己的 `os.tmpdir()` 用 TEMP/TMP 重定向到**非 C 盘**；
//     · 扫描根**写死在源码里**的（check-cli-docs / check-shell-structure / check-loudness-targets /
//       check-lra-caliber）⇒ 只能把闸门拷到临时目录再重定向那个常量（`patchGate`，与既有
//       copyGate / mutate 同一套非破坏手法，且两处防空转断言：待替换片段必须在、替换必须生效）。
//   · 每条照既有纪律：正向（命中该失明条件 ⇒ exit≠0 + 逐字抄自源码的失明文案）
//     ＋ 阴性对照（最小合法夹具 ⇒ exit 0 且不含那句文案 + 真的判过东西的正向证据）。
// ══════════════════════════════════════════════════════════════════════════

// ── 26. check-cli-docs.mjs（用法块 ↔ 实现的防空转绿灯守卫）──────────────────
test('check-cli-docs：失明守卫（任一侧解析出 0 个 flag ⇒ 明说「失明（解析风格变了？）」）', async () => {
  const dir = path.join(TMP, 'cli');
  // 该闸门的 `ROOT` 写死 `D:/lemo-tools`（**无**覆盖点环境变量）⇒ 重定向到夹具根。
  // 夹具的两个入口各用一种解析风格：`case '--flag':`（dub.mjs 的 switch）与 `a === '--flag'`（lemo-make.mjs 的 if 链）。
  const USAGE = '#!/usr/bin/env node\nconst USAGE_TEXT = `\n用法:\n  --alpha   做某事\n`;\n';
  const entry = (root, rel, implLine) => wf(path.join(root, rel), USAGE + implLine);
  const setup = (root) => ({
    gate: patchGate('check-cli-docs.mjs', path.join(root, 'scripts'),
      [["const ROOT = 'D:/lemo-tools';", `const ROOT = '${fwd(root)}';`]]),
    root,
  });
  try {
    // 正向：两个入口都**只有用法块、没有任何处理分支** ⇒ impl.size === 0 ⇒ 失明
    //   （★ 这不是「文件不存在」那条路：文件在、用法块也解析出来了，只有**实现**侧是 0）。
    const pos = setup(path.join(dir, 'pos'));
    entry(pos.root, 'dub.mjs', '');
    entry(pos.root, 'lemo-make.mjs', '');
    const r1 = await run(NODE, [pos.gate]);
    expectBlind(r1, '解析到 0 个**已实现** flag ⇒ 失明（解析风格变了？）', 'check-cli-docs 正向');

    // 阴性对照：两个入口各有一个已实现且已写进用法块的 flag ⇒ 双向无差异 ⇒ exit 0。
    const neg = setup(path.join(dir, 'neg'));
    entry(neg.root, 'dub.mjs', "case '--alpha': break;\n");
    entry(neg.root, 'lemo-make.mjs', "if (a === '--alpha') { }\n");
    const r2 = await run(NODE, [neg.gate]);
    expectClean(r2, '失明（解析风格变了？）', 'check-cli-docs 阴性对照');
    assert.ok(r2.out.includes('✓ 用法块与实现完全对应。'),
      `阴性对照应真的双向比过两个入口\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 27. check-shell-structure.mjs（WIN 侧失明守卫 + ① 续行被注释吃掉）────────
test('check-shell-structure：WIN 侧失明守卫 + ①「续行被注释吃掉」', async () => {
  const dir = path.join(TMP, 'sh');
  // `WIN_ROOTS = [OPUSCAR, TOOLS]`（由 `LEMO_OPUSCAR`/`LEMO_TOOLS_ROOT` 覆盖点派生，无覆盖点时落真实仓）
  //   ⇒ patchGate 把这行整体重定向到夹具根，避免扫到真实仓。
  const WIN_ROOTS_SRC = "const WIN_ROOTS = [OPUSCAR, TOOLS];";
  const setup = (root) => ({
    gate: patchGate('check-shell-structure.mjs', path.join(root, 'scripts'),
      [[WIN_ROOTS_SRC, `const WIN_ROOTS = ['${fwd(root)}'];`]]),
    root,
  });
  try {
    // 正向①：扫描根存在但**一个 shell 脚本都没有** ⇒ files.length===0 ⇒ WIN 侧失明
    //   （★ 该闸门 WSL 侧早有「扫描为空 ⇒ FAIL」守卫，这条钉的是**WIN 侧**那条，靠 `--wsl` 区分）。
    const pos = setup(path.join(dir, 'pos'));
    mk(pos.root);
    const r1 = await run(NODE, [pos.gate]);
    expectBlind(r1, '✘ WIN 扫描为空', 'check-shell-structure 正向');

    // 正向②：① 号结构缺陷（`\` 续行后紧跟 `#` 注释 ⇒ 注释吃掉续行、命令被截断）必须被抓。
    //   ★ 这类缺陷 `sh -n` **报 OK**（不是语法错，是语义被注释改变）—— 正是本闸门存在的理由。
    const pos2 = setup(path.join(dir, 'pos2'));
    wf(path.join(pos2.root, 'bad.sh'),
      '#!/bin/sh\nffmpeg -i in.mp4 \\\n# ★ 注释吃掉续行\n  -c:v libx264 out.mp4\n');
    const r2 = await run(NODE, [pos2.gate]);
    expectBlind(r2, '① 续行被注释吃掉', 'check-shell-structure 正向②');

    // 阴性对照（同时覆盖上面两条）：一个干净的脚本 ⇒ 0 处结构问题 + WIN 侧没失明 ⇒ exit 0。
    const neg = setup(path.join(dir, 'neg'));
    wf(path.join(neg.root, 'ok.sh'), '#!/bin/sh\nffmpeg -i in.mp4 -c:v libx264 out.mp4\nexit 0\n');
    const r3 = await run(NODE, [neg.gate]);
    expectClean(r3, '✘ WIN 扫描为空', 'check-shell-structure 阴性对照');
    assert.ok(!r3.out.includes('① 续行被注释吃掉'), `阴性对照不应报结构问题\n${r3.out.slice(0, 700)}`);
    assert.ok(r3.out.includes('扫描 shell 脚本：1 个（Windows 侧）'),
      `阴性对照应真的扫到 1 个脚本\n${r3.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 28. check-loudness-targets.mjs（响度目标解析的计数式失明守卫）────────────
test('check-loudness-targets：失明守卫（style-dna 档案 0 份 ⇒ 明说「本闸门什么都没检查」）', async () => {
  const dir = path.join(TMP, 'lufs');
  // `DNA_DIR` / `SKILL_DIR` 都写死在源码里（**无**覆盖点环境变量）⇒ 重定向到夹具根。
  // ★ 另需把 `lib/style-dna-reader.mjs` 按**同一相对位置**拷过去：闸门 import 的是 `../lib/…`，
  //   而 reader 的 DNA 目录是「本文件同级的 style-dna/」⇒ 只要两处指向同一个 `<root>/lib/style-dna` 即可。
  const setup = (root) => {
    mk(path.join(root, 'lib'));
    fs.copyFileSync(path.join(TOOLS, 'lib', 'style-dna-reader.mjs'),
      path.join(root, 'lib', 'style-dna-reader.mjs'));
    const gate = patchGate('check-loudness-targets.mjs', path.join(root, 'scripts'), [
      ["const DNA_DIR = 'D:/lemo-tools/lib/style-dna';", `const DNA_DIR = '${fwd(path.join(root, 'lib', 'style-dna'))}';`],
      ["const SKILL_DIR = 'D:/lemo-tools/lib/style-skills';", `const SKILL_DIR = '${fwd(path.join(root, 'lib', 'style-skills'))}';`],
    ]);
    mk(path.join(root, 'lib', 'style-dna'));
    mk(path.join(root, 'lib', 'style-skills'));
    return gate;
  };
  try {
    // 正向：style-dna 目录**读空** ⇒ slugs.length===0 ⇒ 一份档案都没解析过 ⇒ 失明。
    const gatePos = setup(path.join(dir, 'pos'));
    const r1 = await run(NODE, [gatePos]);
    expectBlind(r1, 'style-dna 档案 0 份（目录读空 / 路径变了？）⇒ 本闸门什么都没检查', 'check-loudness-targets 正向');

    // 阴性对照：**一份** `mix_rules` 里写得出 −14 LUFS 的档案 ⇒ 解析 1/1、分布 {−14:1} ⇒ 0 FAIL ⇒ exit 0。
    //   ★ 这里**刻意不造**同名的 Skill 文档：闸门会把「只有 dna 没有 Skill 文档」打成 `⚠`
    //     （2026-10-07 起 **⚠ = 只列不判、不进退出码** —— 它判的是「文档集合对齐」，
    //      不是本闸门的主题「响度目标能否解析」）。⇒ 一份档案就是**最小合法夹具**；
    //      本用例顺带把「⚠ 不进退出码」这个口径钉住（若有人再把它塞回 exitCode，这里立刻变红）。
    const root = path.join(dir, 'neg');
    const gateNeg = setup(root);
    rj(path.join(root, 'lib', 'style-dna', 'gb-lt.json'),
      { slug: 'gb-lt', sound_palette: { mix_rules: '整体 -14 LUFS（源：styles/gb-lt/STYLE.md:20）' } });
    const r2 = await run(NODE, [gateNeg]);
    expectClean(r2, '本闸门什么都没检查', 'check-loudness-targets 阴性对照');
    assert.ok(r2.out.includes('可解析出响度目标：1/1'),
      `阴性对照应真的解析出 1 份的响度目标\n${r2.out.slice(0, 700)}`);
    assert.ok(r2.out.includes('⚠ 只有 dna 没有 Skill 文档'),
      `阴性对照应如实打出那条 ⚠（只列不判）\n${r2.out.slice(0, 700)}`);
    assert.ok(r2.out.trimEnd().endsWith('[闸门] 响度目标解析 1/1 OK'),
      `阴性对照末行应是 OK（与 exit 0 口径一致）\n${r2.out.slice(-300)}`);
  } finally { rm(dir); }
});

// ── 29. check-lra-caliber.mjs（计数式失明守卫：0 部成片被检查）───────────────
test('check-lra-caliber：失明守卫（0 部成片被检查 ⇒ 明说「本闸门什么都没检查」）', async () => {
  const dir = path.join(TMP, 'lra');
  // `DIR` 写死在源码里（**无**覆盖点环境变量）⇒ 重定向到夹具根。
  const setup = (root) => {
    const gate = patchGate('check-lra-caliber.mjs', path.join(root, 'scripts'),
      [["const DIR = 'D:/lemo-tools/lib/style-skills';", `const DIR = '${fwd(path.join(root, 'distill'))}';`]]);
    mk(path.join(root, 'distill'));
    return gate;
  };
  try {
    // 正向：**有** `_distill.json`、但 `generatedVideo.path` 指向一个不存在的文件 ⇒
    //   主循环每个风格都 `continue` ⇒ okEb+looksLn+neither === 0 ⇒ 失明。
    //   ★ 比「目录为空」强：它证明的是**循环里的 continue 这条守卫**，不是「枚举不到」。
    const gatePos = setup(path.join(dir, 'pos'));
    rj(path.join(dir, 'pos', 'distill', 'gb-lra', '_distill.json'),
      { generatedVideo: { path: fwd(path.join(dir, 'pos', '不存在的成片.mp4')) }, selfCheck: { loudness: { lra: 5 } } });
    const r1 = await run(NODE, [gatePos]);
    expectBlind(r1, '失明：0 部成片被检查', 'check-lra-caliber 正向');

    // 阴性对照：现造一段**真的音频**（6 s 纯音，几 KB，纯 CPU），再用闸门**同一条 ffmpeg 命令**
    //   量出它的 ebur128 LRA 逐字回填文档 ⇒ 与 ebur128 口径相符 ⇒ 0 不符 ⇒ exit 0。
    const root = path.join(dir, 'neg');
    const gateNeg = setup(root);
    const wav = path.join(root, 'tone.wav');
    assert.ok(fs.existsSync(FFMPEG), `阴性对照依赖本机 ffmpeg 存在：${FFMPEG}`);
    const gen = await run(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi',
      '-i', 'sine=frequency=440:sample_rate=48000:duration=6', '-c:a', 'pcm_s16le', wav]);
    assert.equal(gen.code, 0, `夹具：ffmpeg 造测试音频失败\n${gen.out.slice(0, 400)}`);
    const eb = await run(FFMPEG, ['-hide_banner', '-nostats', '-i', wav,
      '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const mLra = [...eb.out.matchAll(/^\s*LRA:\s*(-?[\d.]+)/gm)];
    const lraEb = mLra.length ? Number(mLra[mLra.length - 1][1]) : null;
    assert.ok(Number.isFinite(lraEb),
      `夹具：本机 ffmpeg 没量出 ebur128 LRA（不能拿它做阴性对照）\n${eb.out.slice(0, 400)}`);
    rj(path.join(root, 'distill', 'gb-lra', '_distill.json'),
      { generatedVideo: { path: wav }, selfCheck: { loudness: { lra: lraEb } } });
    const r2 = await run(NODE, [gateNeg]);
    expectClean(r2, '本闸门什么都没检查', 'check-lra-caliber 阴性对照');
    assert.ok(r2.out.includes('像 ebur128 1 份'),
      `阴性对照应真的判过这部成片的口径\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 30. check-film-delivery.mjs（总失明 + F 段计数式「全部让位」）────────────
test('check-film-delivery：失明守卫（0 部成片被检查）+ F 段「全部让位 ⇒ 一部成片都没判」', async () => {
  const dir = path.join(TMP, 'fd');
  // ★ 该闸门**有**覆盖点环境变量 ⇒ 夹具全走 env，既不碰真实仓、也不碰 `D:/lemo-films/` 下的成片。
  //   E 段要一份带「编码后复核闭环」的交付脚本（默认值区间由 E2/E4/E5/E6 一起钳住，见闸门注释）。
  const MUX_OK = '#!/bin/sh\n'
    + 'LN_TP="${LEMO_LN_TP:--1.7}"\n'
    + 'LN_TP_STEP="${LEMO_LN_TP_STEP:-0.25}"\n'
    + 'LN_TP_TRIES="${LEMO_LN_TP_TRIES:-8}"\n'
    + 'ffmpeg -i "$1" -af "loudnorm=TP=$LN_TP" -f null - 2>&1 | grep input_tp\n'
    + 'if [ "$(echo "$TP > -1.2" | bc)" = "1" ]; then :; fi\n';
  const envFor = (root) => ({
    LEMO_MUX_SH: path.join(root, 'mux.sh'),
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_BATCH_DIR: path.join(root, 'batch'),
    LEMO_LOCK_DIR: path.join(root, 'locks'),
    LEMO_DISTILL_ROOT: path.join(root, 'distill'),
  });
  const prep = (root) => {
    wf(path.join(root, 'mux.sh'), MUX_OK);
    wf(path.join(root, 'opuscar', 'styles', 'gb-fd', 'demo', 'tools', 'mux.sh'), MUX_OK);
    mk(path.join(root, 'batch'));
    mk(path.join(root, 'locks'));
    mk(path.join(root, 'distill'));
    return root;
  };
  try {
    // 正向：成片树**空的** ⇒ slugs.length===0 ⇒ 总失明守卫命中
    //   （★ E 段的夹具本身是合法的 ⇒ 这一句是唯一能解释 exit≠0 的原因）。
    const pos = prep(path.join(dir, 'pos'));
    const r1 = await runGate('check-film-delivery.mjs', envFor(pos));
    expectBlind(r1, '0 部成片被检查（style-skills 下无 _distill.json / 路径变了？）', 'check-film-delivery 正向');

    // 阴性对照：现造一部**真成片**（320×180 / 6 s / libx264 纯 CPU，不碰 GPU），
    //   再用与闸门**同一条 ffmpeg 命令**量出 A/B/C 三处真值、逐字回填文档，
    //   并把文档 mtime 设成**晚于成片** ⇒ F 段「成片比文档新」不成立 ⇒ 不让位 ⇒ 真判 ⇒ 0 FAIL。
    const root = prep(path.join(dir, 'neg'));
    const film = path.join(root, 'films', 'gb-fd', 'gb-fd.mp4');
    mk(path.dirname(film));
    assert.ok(fs.existsSync(FFMPEG), `阴性对照依赖本机 ffmpeg 存在：${FFMPEG}`);
    const enc = await run(FFMPEG, ['-y', '-v', 'error',
      '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=25:d=6',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=6',
      '-af', 'loudnorm=I=-14:TP=-2.5:LRA=11',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart', '-shortest', film]);
    assert.equal(enc.code, 0, `夹具：ffmpeg 造测试成片失败\n${enc.out.slice(0, 500)}`);

    const pr = await run(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', film]);
    const j = JSON.parse(pr.out);
    const vs = (j.streams || []).find((s) => s.codec_type === 'video') || {};
    const as = (j.streams || []).find((s) => s.codec_type === 'audio') || {};
    const fmt = j.format || {};
    const fps = vs.r_frame_rate
      ? (() => { const [x, y] = vs.r_frame_rate.split('/').map(Number); return y ? +(x / y).toFixed(3) : x; })() : null;
    const num = (t, k) => {
      const m = t.match(new RegExp(`"${k}"\\s*:\\s*"?(-?[0-9.]+)"?`));
      return m ? Number(m[1]) : null;
    };
    const l1 = await run(FFMPEG, ['-hide_banner', '-nostats', '-i', film,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
    const tp = num(l1.out, 'input_tp'), lufs = num(l1.out, 'input_i');
    const l2 = await run(FFMPEG, ['-hide_banner', '-nostats', '-i', film,
      '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const mm = [...l2.out.matchAll(/^\s*LRA:\s*(-?[\d.]+)/gm)];
    const lraEb = mm.length ? Number(mm[mm.length - 1][1]) : num(l1.out, 'input_lra');
    assert.ok(Number.isFinite(tp) && Number.isFinite(lufs),
      `夹具：量不出真值（真峰值 ${tp} / 响度 ${lufs}）\n${l1.out.slice(0, 400)}`);
    const docPath = path.join(root, 'distill', 'gb-fd', '_distill.json');
    rj(docPath, {
      generatedVideo: {
        path: film, width: vs.width, height: vs.height, fps,
        frames: vs.nb_frames ? Number(vs.nb_frames) : 0,
        durSec: Math.round(Number(fmt.duration)), bytes: fs.statSync(film).size,
      },
      selfCheck: { loudness: {
        truePeakDbtp: tp, integratedLufs: lufs, lra: lraEb, peakTargetMet: tp <= -1.2,
      } },
    });
    // ★ 文档 mtime 必须**晚于**成片（闸门 F 段的必要条件是「成片比文档新」）——
    //   显式 utimes，不靠「写完就比它新」这种时序巧合。
    const t = new Date(fs.statSync(film).mtimeMs + 120000);
    fs.utimesSync(docPath, t, t);
    const r2 = await runGate('check-film-delivery.mjs', envFor(root));
    expectClean(r2, '0 部成片被检查', 'check-film-delivery 阴性对照');
    assert.ok(r2.out.includes('✓ 被判的 1 部成片交付口径全部一致'),
      `阴性对照应真的判过这部成片\n${r2.out.slice(0, 900)}`);

    // ── 正向②（F 段**计数式**「全部让位」守卫）：把**同一个夹具**的文档 mtime 翻到**早于成片**。
    //   F 段让位的**必要条件**是「成片比文档新」⇒ 现在成立；而成片是**本次测试刚写盘的**
    //   ⇒ 必然落在 `DEFER_FRESH_MS`（15 min）窗口内 ⇒ 该片必然让位 ⇒ `deferred === slugs`（1/1）
    //   ⇒ `judged === 0` ⇒ 明说「一部成片都没判」并 FAIL（旧版会打印「✓ 被判的 0 部…全部一致」+ exit 0）。
    //   ★ 为什么这是**确定性**的、不是「靠时间窗」：夹具在测试运行的当下写盘，而**整套件只跑 ~24 s**
    //     （≪ 15 min）⇒ 「成片很新」这条信号是**构造上必然成立**的；唯一的时间关系
    //     （文档 mtime < 成片 mtime）由 `utimesSync` **显式设定**，不依赖任何调度顺序。
    //     另外两条让位信号（该 slug 的并发锁 / 批次日志）在夹具里都是**空目录** ⇒ 不参与。
    //   ★ 阴性对照就是上面那条：**同一棵树**、只把 mtime 关系翻回去（文档晚于成片）⇒ 不让位 ⇒ 真判 ⇒ exit 0。
    const t2 = new Date(fs.statSync(film).mtimeMs - 120000);
    fs.utimesSync(docPath, t2, t2);
    const r3 = await runGate('check-film-delivery.mjs', envFor(root));
    expectBlind(r3, '都被判「疑似正在重渲」而让位 ⇒ 本次**一部成片都没判**', 'check-film-delivery 正向②');
    assert.ok(r3.out.includes('⚠ 疑似正在重渲，本次不判 1 部'),
      `正向② 应真的走了 F 段让位通路\n${r3.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 31. check-plate-pixel.mjs（计数式失明守卫：全部差分 0 像素）─────────────
test('check-plate-pixel：计数式失明守卫（全部风格底衬差分 0 像素 ⇒ 明说「一个底衬色都没真正判过」）', async () => {
  const dir = path.join(TMP, 'pp');
  // ★ 该闸门无覆盖点环境变量，但它的落点按**脚本自身位置**推导（`ROOT = HERE/..`）⇒ 整棵拷过去即可。
  //   ★ 它自己用 `os.tmpdir()` 建中间目录 ⇒ 把 TEMP/TMP 指到**非 C 盘**（本项目纪律）。
  const OS_TMP = path.join(dir, 'os-tmp');
  mk(OS_TMP);
  const envPP = { TEMP: fwd(OS_TMP), TMP: fwd(OS_TMP) };
  const setup = (root, styles) => {
    copyDubCoreLib(root);
    rj(path.join(root, 'lib', 'dub-styles.json'), { styles });
    return copyGate('check-plate-pixel.mjs', root);
  };
  // 一个「底盒画不出来」的风格：plate='box' 但既无 plateColor 也无 palette.subtitleBack
  //   ⇒ 底盒退化成「palette.bg 加 CC α」= 与背景**完全同色** ⇒ 差分 0 像素。
  //   ★ `subtitleOutline` 置成全透明（ASS α=FF）是为了让「去掉 plate」那一帧的**字形描边**也不可见 ——
  //     否则描边本身会产生差分，掩盖掉我们要验的「底盒差分 0」。
  const boxInvisible = {
    slug: 'gb-pp',
    palette: { bg: '000000', subtitle: 'FFFFFF', subtitleOutline: 'FF101010' },
    subtitle: { plate: 'box' },
  };
  try {
    // 正向：唯一的风格底衬差分 0 像素 ⇒ 单风格那条判成真缺陷（进 fails ⇒ exit 1），
    //   且计数式守卫明说「一个底衬色都没真正判过」（旧版这一行没有 ok 字段 ⇒ 会被漏掉 ⇒ 假绿）。
    const gatePos = setup(path.join(dir, 'pos'), [boxInvisible]);
    const r1 = await run(NODE, [gatePos], { env: envPP });
    expectBlind(r1, '一个底衬色都没真正判过', 'check-plate-pixel 正向');

    // 阴性对照：同一个风格，底衬给一个**与背景不同**的不透明色 ⇒ 真渲两帧、差分非 0、
    //   品红标记测试通过、对比度达标 ⇒ exit 0。
    const gateNeg = setup(path.join(dir, 'neg'), [{
      slug: 'gb-pp',
      palette: { bg: '000000', subtitle: 'FFFFFF' },
      subtitle: { plate: 'box', plateColor: '404040' },
    }]);
    const r2 = await run(NODE, [gateNeg], { env: envPP });
    expectClean(r2, '一个底衬色都没真正判过', 'check-plate-pixel 阴性对照');
    assert.ok(r2.out.includes('✓ 全部通过：底衬色确实取自 plateColor'),
      `阴性对照应真的渲出底盒并判过它\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ══════════════════════════════════════════════════════════════════════════
// 第 32–36 条（2026-10-07 扩批之二）：**核心判据**（非空转）—— 上面那些用例钉的是
//   「守卫还在不在（会不会空转）」，这 5 条钉的是「**闸门真的判了，且判得对**」：
//     · 文档里的 LRA 看起来是 **loudnorm** 口径 ⇒ 判**不符**；
//     · 响度目标**偏离 −14 交付线** ⇒ FAIL；
//     · **品红标记测试失败**（底衬色写错字段）⇒ 判**真缺陷**；
//     · **② 判定块结尾缺 `exit 0`** ⇒ FAIL；
//     · **notImpl / notDoc**（文档先于实现 / 实现了没写文档）⇒ FAIL。
//   ★ 这 5 条的「失败」**不是失明**，但断言纪律与上面**完全一致**：`expectBlind` 只要求
//     「exit≠0 **且**输出里出现逐字抄自源码的那句话」⇒ 直接沿用，**不另造 helper**、
//     也**不退化**成「只看退出码」（否则闸门崩在路径/JSON 上也能骗过它）。
//   ★ 夹具手法沿用既有三种（env 覆盖点 / 整棵拷贝 / `patchGate` 重定向硬编码常量），
//     全程**只读真实仓**，绝不改任何真实数据。
// ══════════════════════════════════════════════════════════════════════════

// ── 32. check-lra-caliber.mjs：口径判据（像 loudnorm ⇒ 判不符）──────────────
test('check-lra-caliber：口径判据（文档 lra 与 loudnorm 相符、与 ebur128 差 >0.6 ⇒ 判不符）', async () => {
  const dir = path.join(TMP, 'lra2');
  // `DIR` 写死在源码里（无覆盖点）⇒ patchGate 重定向到夹具根（与既有用例 29 同一手法）。
  const setup = (root) => {
    const gate = patchGate('check-lra-caliber.mjs', path.join(root, 'scripts'),
      [["const DIR = 'D:/lemo-tools/lib/style-skills';", `const DIR = '${fwd(path.join(root, 'distill'))}';`]]);
    mk(path.join(root, 'distill', 'gb-lra'));
    return gate;
  };
  const writeDoc = (root, lra) => rj(path.join(root, 'distill', 'gb-lra', '_distill.json'),
    { generatedVideo: { path: fwd(path.join(dir, 'tone.wav')) }, selfCheck: { loudness: { lra } } });
  try {
    // 夹具：造一段**两个口径本来就不同**的音频，并量出两个口径的真值（见 lraTone 的两道前提断言）。
    mk(dir);
    const { lraEb, lraLn } = await lraTone(path.join(dir, 'tone.wav'));

    // 正向：文档写的 lra 正好等于 **loudnorm** 口径 ⇒ 与 ebur128 差 2.9 > 容差 0.6 ⇒ 判不符
    //   （`okEb` 不成立、`looksLn` 成立 ⇒ 走「口径疑似 loudnorm」那一支 ⇒ exit 1）。
    const gatePos = setup(path.join(dir, 'pos'));
    writeDoc(path.join(dir, 'pos'), lraLn);
    const r1 = await run(NODE, [gatePos]);
    expectBlind(r1, '口径疑似 loudnorm（项目口径应为 ebur128）', 'check-lra-caliber 口径判据正向');
    assert.ok(r1.out.includes('像 loudnorm 1 份'),
      `正向应真的把它判成「像 loudnorm 1 份」\n${r1.out.slice(0, 900)}`);

    // 阴性对照：**同一段音频**，文档写 ebur128 口径的实测值 ⇒ 相符 ⇒ exit 0。
    const gateNeg = setup(path.join(dir, 'neg'));
    writeDoc(path.join(dir, 'neg'), lraEb);
    const r2 = await run(NODE, [gateNeg]);
    expectClean(r2, '口径疑似 loudnorm', 'check-lra-caliber 阴性对照');
    assert.ok(r2.out.includes('像 ebur128 1 份'),
      `阴性对照应真的判成「像 ebur128 1 份」\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 33. check-loudness-targets.mjs：交付线判据（偏离 −14 ⇒ FAIL）────────────
test('check-loudness-targets：交付线判据（mix_rules 写成 −16 ⇒ 偏离 −14 ⇒ FAIL）', async () => {
  const dir = path.join(TMP, 'lufs2');
  // `DNA_DIR` / `SKILL_DIR` 都写死在源码里（无覆盖点）⇒ patchGate 重定向；
  //   ★ 还需把 `lib/style-dna-reader.mjs` 按同一相对位置拷过去（闸门 import 的是 `../lib/…`）。
  const setup = (root) => {
    mk(path.join(root, 'lib'));
    fs.copyFileSync(path.join(TOOLS, 'lib', 'style-dna-reader.mjs'),
      path.join(root, 'lib', 'style-dna-reader.mjs'));
    const gate = patchGate('check-loudness-targets.mjs', path.join(root, 'scripts'), [
      ["const DNA_DIR = 'D:/lemo-tools/lib/style-dna';", `const DNA_DIR = '${fwd(path.join(root, 'lib', 'style-dna'))}';`],
      ["const SKILL_DIR = 'D:/lemo-tools/lib/style-skills';", `const SKILL_DIR = '${fwd(path.join(root, 'lib', 'style-skills'))}';`],
    ]);
    mk(path.join(root, 'lib', 'style-dna'));
    mk(path.join(root, 'lib', 'style-skills'));
    return gate;
  };
  /** 一份能解析出响度目标的档案（值由 `mix_rules` 里的「NN LUFS」决定）。 */
  const dna = (root, line) => rj(path.join(root, 'lib', 'style-dna', 'gb-lt.json'),
    { slug: 'gb-lt', sound_palette: { mix_rules: `整体 ${line} LUFS（源：styles/gb-lt/STYLE.md:20）` } });
  try {
    // 正向：唯一一份档案解析出 **−16**（本项目交付线是 −14）⇒ 分布 {−16:1} 偏离交付线 ⇒ FAIL。
    //   ★ 这条判据 2026-10-04 才补上：原判据只判 `Number.isFinite(v)` ⇒ 写成 −16 也照样绿。
    const gatePos = setup(path.join(dir, 'pos'));
    dna(path.join(dir, 'pos'), '-16');
    const r1 = await run(NODE, [gatePos]);
    expectBlind(r1, '响度目标**偏离交付线 -14 LUFS** 的值：-16', 'check-loudness-targets 交付线判据正向');

    // 阴性对照：**同一份档案**写成交付线 −14 ⇒ 分布 {−14:1} 不偏离 ⇒ exit 0。
    const gateNeg = setup(path.join(dir, 'neg'));
    dna(path.join(dir, 'neg'), '-14');
    const r2 = await run(NODE, [gateNeg]);
    expectClean(r2, '响度目标**偏离交付线', 'check-loudness-targets 阴性对照');
    assert.ok(r2.out.includes('分布 {"-14":1}'),
      `阴性对照应真的算出 {−14:1} 的分布\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 34. check-plate-pixel.mjs：品红标记判据（底衬色写错字段 ⇒ 判真缺陷）──────
test('check-plate-pixel：品红标记判据（底衬色写错字段 ⇒ 标记测试失败 ⇒ 判真缺陷）', async () => {
  const dir = path.join(TMP, 'ppmark');
  const OS_TMP = path.join(dir, 'os-tmp');    // 非 C 盘（闸门自己用 os.tmpdir() 建中间目录）
  mk(OS_TMP);
  const envPP = { TEMP: fwd(OS_TMP), TMP: fwd(OS_TMP) };
  // ★★ 这个风格在「字段映射正确」时是**完全合法**的：底衬色与 `palette.subtitleOutline` 同值，
  //   于是绝对色差 Δ=1（≤20 粗筛）、对比度 16.5（≥4.5）**全部达标** ⇒ 唯一能解释 FAIL 的
  //   只有**品红标记测试**（「底衬色确实取自 plateColor 字段」）。⇒ 断言不会被别的判据顶替。
  const style = {
    slug: 'gb-ppm',
    palette: { bg: '000000', subtitle: 'FFFFFF', subtitleOutline: '202020' },
    subtitle: { plate: 'box', plateColor: '202020' },
  };
  // ★ 破坏点（**模拟历史缺陷**「底衬色写错字段」，见闸门头注释 2026-10-03 那条）：
  //   把底衬色改道成**别的字段** —— `BorderStyle=3` 的盒填充字段是 OutlineColour，
  //   改道后盒色变成 `palette.subtitleOutline`，品红标记测试当场抓住。
  //   只改**拷贝到夹具根的 dub-core**，真实 `lib/dub-core.mjs` 一个字节都不动。
  const setup = (root, breakCore) => {
    rj(path.join(root, 'lib', 'dub-styles.json'), { styles: [style] });
    copyDubCoreLib(root, breakCore
      ? ['const subOutlineCol = plateOn ? cPlate : cOut;', 'const subOutlineCol = plateOn ? cOut : cOut;']
      : undefined);
    return copyGate('check-plate-pixel.mjs', root);
  };
  try {
    // 正向：字段映射被改坏 ⇒ 标记测试报「盒色 … 不是品红 ⇒ 底衬色未取自 plateColor」
    //   ⇒ 该风格判**真缺陷**（`ok:false` ⇒ 进 fails ⇒ exit 1），且**不是**失明那条路。
    const gatePos = setup(path.join(dir, 'pos'), true);
    const r1 = await run(NODE, [gatePos], { env: envPP });
    expectBlind(r1, '不是品红 ⇒ 底衬色未取自 plateColor', 'check-plate-pixel 标记判据正向');
    assert.ok(r1.out.includes('✗ 不通过 1 个：'),
      `应走「真缺陷」通路（逐风格报出来），而不是失明/空转\n${r1.out.slice(0, 900)}`);

    // 阴性对照：**同一份风格配置**、字段映射正常 ⇒ 标记测试通过 + 对比度达标 ⇒ exit 0。
    const gateNeg = setup(path.join(dir, 'neg'), false);
    const r2 = await run(NODE, [gateNeg], { env: envPP });
    expectClean(r2, '不是品红', 'check-plate-pixel 阴性对照');
    assert.ok(r2.out.includes('✓ 全部通过：底衬色确实取自 plateColor'),
      `阴性对照应真的渲出底盒并通过标记测试\n${r2.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 35. check-shell-structure.mjs：② 判据（判定块结尾缺 exit 0）─────────────
test('check-shell-structure：② 判据（判定块以 fi 结尾、后面没有 exit 0 ⇒ FAIL）', async () => {
  const dir = path.join(TMP, 'sh2');
  // `WIN_ROOTS = [OPUSCAR, TOOLS]` ⇒ patchGate 把这行整体重定向到夹具根。
  const setup = (root) => patchGate('check-shell-structure.mjs', path.join(root, 'scripts'),
    [["const WIN_ROOTS = [OPUSCAR, TOOLS];", `const WIN_ROOTS = ['${fwd(root)}'];`]]);
  // 一个**真的**判定块：抽 input_tp → 判超线 → 报「missed the target」，但**以 fi 结尾**。
  //   ★ 这类缺陷 `sh -n` 报 OK（不是语法错）—— 退出码与判定结果**正好相反**，正是本闸门存在的理由。
  const BLOCK = '#!/bin/sh\n'
    + 'TP=$(ffmpeg -i "$1" -af ebur128 -f null - 2>&1 | grep -o "input_tp[^,]*")\n'
    + 'if [ "$(echo "$TP > -1.2" | bc)" = "1" ]; then\n'
    + '  echo "loudness missed the target"\n'
    + 'fi\n';
  try {
    // 正向：最后一条非注释语句是 `fi`，且前 25 行内有判定块标记（`input_tp` / `missed the target`）⇒ 命中。
    const gatePos = setup(path.join(dir, 'pos'));
    wf(path.join(dir, 'pos', 'gb.sh'), BLOCK);
    const r1 = await run(NODE, [gatePos]);
    expectBlind(r1, '② 判定块后缺 exit 0', 'check-shell-structure ② 判据正向');
    assert.ok(r1.out.includes('以 fi 结尾 ⇒ 退出码与判定结果相反'),
      `正向应报出这条判据的理由\n${r1.out.slice(0, 900)}`);

    // 阴性对照：**同一条判定块**后面补一行 `exit 0` ⇒ 最后一条非注释语句不再是 fi ⇒ 0 处 ⇒ exit 0。
    const gateNeg = setup(path.join(dir, 'neg'));
    wf(path.join(dir, 'neg', 'gb.sh'), `${BLOCK}exit 0\n`);
    const r2 = await run(NODE, [gateNeg]);
    expectClean(r2, '② 判定块后缺 exit 0', 'check-shell-structure ② 判据阴性对照');
    assert.ok(r2.out.includes('✓ 未发现「续行被注释吃掉」或「判定块缺 exit 0」的结构问题。'),
      `阴性对照应真的判过这个脚本\n${r2.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── 36. check-cli-docs.mjs：notImpl / notDoc 两条判据 ───────────────────────
test('check-cli-docs：notImpl / notDoc（文档先于实现 / 实现了没写文档 ⇒ FAIL）', async () => {
  const dir = path.join(TMP, 'cli2');
  // `ROOT` 写死（无覆盖点）⇒ patchGate 重定向；两个入口文件都必须存在（否则先报「文件不存在」）。
  const setup = (root) => patchGate('check-cli-docs.mjs', path.join(root, 'scripts'),
    [["const ROOT = 'D:/lemo-tools';", `const ROOT = '${fwd(root)}';`]]);
  /** 用法块（锚点法认定的那段模板字符串）+ 实现行；另一入口固定为「两侧一致」。 */
  const usage = (flags) => '#!/usr/bin/env node\nconst USAGE_TEXT = `\n用法:\n'
    + `${flags.map((f) => `  ${f}   做某事`).join('\n')}\n\`;\n`;
  const CLEAN_OTHER = usage(['--delta']) + "if (a === '--delta') { }\n";
  const build = (tag, dubSrc) => {
    const root = path.join(dir, tag);
    const gate = setup(root);
    wf(path.join(root, 'dub.mjs'), dubSrc);
    wf(path.join(root, 'lemo-make.mjs'), CLEAN_OTHER);
    return gate;
  };
  try {
    // 正向① notImpl：用法块列了 `--alpha`，代码里**没有**任何处理分支
    //   （`--gamma` 两侧都有 ⇒ 只有这一处不一致；两侧 flag 数都非 0 ⇒ **不是**失明那条路）。
    const r1 = await run(NODE, [build('p1', usage(['--alpha', '--gamma']) + "case '--gamma': break;\n")]);
    expectBlind(r1, '但代码里**没有任何处理分支**（文档先于实现）', 'check-cli-docs notImpl 正向');
    assert.ok(r1.out.includes('用法块列了 `--alpha`'),
      `正向① 应指名道姓报出 \`--alpha\`\n${r1.out.slice(0, 900)}`);

    // 正向② notDoc：`--beta` 代码里处理了、用法块**没列**（用户看不到）。
    const r2 = await run(NODE, [build('p2',
      usage(['--gamma']) + "case '--gamma': break;\nif (a === '--beta') { }\n")]);
    expectBlind(r2, '但用法块没列（用户看不到）', 'check-cli-docs notDoc 正向');
    assert.ok(r2.out.includes('代码处理了 `--beta`'),
      `正向② 应指名道姓报出 \`--beta\`\n${r2.out.slice(0, 900)}`);

    // 阴性对照：两个入口各自「用法块 ↔ 实现」一一对应 ⇒ 两条判据都不命中 ⇒ exit 0。
    const r3 = await run(NODE, [build('neg', usage(['--alpha']) + "case '--alpha': break;\n")]);
    expectClean(r3, '但代码里**没有任何处理分支**', 'check-cli-docs 阴性对照');
    assert.ok(!r3.out.includes('但用法块没列（用户看不到）'),
      `阴性对照不应报 notDoc\n${r3.out.slice(0, 700)}`);
    assert.ok(r3.out.includes('✓ 用法块与实现完全对应。'),
      `阴性对照应真的双向比过两个入口\n${r3.out.slice(0, 700)}`);
  } finally { rm(dir); }
});

// ── ★★ 「故意破坏」自证：删掉守卫 ⇒ 同一套断言必须变红 ────────────────────────
//   证明这些断言真的在测「那个守卫」，而不是在测「闸门有没有崩」。
//   做法：把闸门源码拷到临时目录，做一处**精确字符串替换**删掉守卫，再跑同一套正向断言。

/**
 * 读任意源文件 → 断言待替换片段确实存在 → 替换 → 写副本。返回副本路径。
 * ★ 两道防空转断言（与 `patchGate()` 同源）：片段必须在、替换必须生效 ——
 *   否则源码改了写法时，自证会**静默地**跑在一份没被破坏的副本上，用例就变成了假绿。
 */
const mutateFile = (srcPath, dstPath, from, to) => {
  const src = fs.readFileSync(srcPath, 'utf8');
  assert.ok(src.includes(from),
    `破坏用例自身失效：${srcPath} 里找不到待删的守卫片段（源码已变？）\n---\n${from}\n---`);
  const mutated = src.replace(from, to);
  assert.notEqual(mutated, src, `破坏用例自身失效：${srcPath} 的替换没有生效`);
  wf(dstPath, mutated);
  return dstPath;
};

/** 读**闸门**源码 → 断言待替换片段确实存在 → 替换 → 写副本。返回副本路径。 */
const mutate = (gateName, outDir, from, to) =>
  mutateFile(path.join(SCRIPTS, gateName), path.join(outDir, gateName), from, to);

test('★自证 check-config-notes：删掉「全无 notes」守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-cfg');
  try {
    const gate = mutate('check-config-notes.mjs', dir,
      'if (cfg.styles.length > 0 && checkedNotes === 0) {', 'if (false) {');
    const cfg = path.join(dir, 'empty.json');
    rj(cfg, { styles: [{ slug: 'a', notes: '' }, { slug: 'b' }] });
    const res = await run(NODE, [gate], { env: { LEMO_DUB_STYLES: cfg } });
    // 守卫被删后：exit 0、无「没有一条带 notes」⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '没有一条带 notes', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-tp-prose：删掉 CUR 反向守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-tp');
  try {
    // 把「HIST 且非 CUR 才豁免」退化成「只要 HIST 就豁免」（即删掉 CUR 反向守卫）。
    //   ★ 2026-10-07：主循环那行加了 `!S.json && ` 前缀（json 散文的历史豁免改由 J1–J4 承担）
    //     ⇒ 变异锚点必须跟着带上前缀，否则 `replace` 会落到下方「物理不可能」段那行同名判据上、
    //     主循环的守卫根本没被删掉（实测：带旧锚点时本自证会假绿）。
    const gate = mutate('check-tp-prose.mjs', dir,
      'if (!S.json && HIST.test(line) && !CUR.test(line)) continue;',
      'if (!S.json && HIST.test(line)) continue;');
    const pos = skillTree(path.join(dir, 'styles'), 'gb-tp',
      '# gb-tp\n\n已修：真峰值原为 −1.2 dBTP，现状 −0.5 dBTP（本片成片实测）\n', tpDistill());
    const res = await run(NODE, [gate], { env: { LEMO_DISTILL_ROOT: pos } });
    // 守卫被删后：整行被历史语境豁免 ⇒ exit 0、无「陈旧读数 1 处」⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '陈旧读数 1 处', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-tp-prose：删掉 ⑦ 成片归因例外后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-tp-nonfilm');
  try {
    // 把 ⑦ 的「成片归因例外」删掉（退回纯「整句含 NONFILM 即排除」）。
    const gate = mutate('check-tp-prose.mjs', dir,
      'if (NONFILM.test(sentenceOf(line, m.index)) && !filmAttr(line, m.index)) continue;',
      'if (NONFILM.test(sentenceOf(line, m.index))) continue;');
    const pos = skillTree(path.join(dir, 'styles'), 'gb-tp',
      '# gb-tp\n\n`demo/mix.wav` 真峰值 −1.00 dBTP（上游素材）；经 `core/render/mux.sh` 归一后的成片实测真峰值 input_tp = −0.50 dBTP（本片成片实测）。\n',
      tpDistill());
    const res = await run(NODE, [gate], { env: { LEMO_DISTILL_ROOT: pos } });
    // 例外被删后：整句因 `mix.wav` 被排除 ⇒ exit 0、无「陈旧读数 1 处」⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '陈旧读数 1 处', 'mut'),
      undefined, '删掉 ⑦ 归因例外后正向断言竟然还通过 ⇒ 断言没在测该例外');
  } finally { rm(dir); }
});

test('★自证 check-tp-prose：把 ⑨ 由「同子句」退回「整行」后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-tp-xref');
  try {
    // 把 ⑨ 的「别的风格名必须与读数同子句」退回旧版「整行提到即豁免」。
    const gate = mutate('check-tp-prose.mjs', dir,
      'const isXref = others.some((o) => clauseOf(line, m.index).includes(o));',
      'const isXref = others.some((o) => line.includes(o));');
    const root = path.join(dir, 'styles');
    skillTree(root, 'gb-tp',
      '# gb-tp\n\n本片成片真峰值 −0.50 dBTP（本片成片实测）。队里 gb-other 曾到 +0.28 dBTP。\n', tpDistill());
    skillTree(root, 'gb-other', '# gb-other\n', tpDistill());
    const res = await run(NODE, [gate], { env: { LEMO_DISTILL_ROOT: root } });
    // 退回整行后：整行提到 gb-other ⇒ 交叉引用豁免 ⇒ exit 0、无「陈旧读数 1 处」⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '陈旧读数 1 处', 'mut'),
      undefined, '把 ⑨ 退回整行后正向断言竟然还通过 ⇒ 断言没在测该收窄');
  } finally { rm(dir); }
});

test('★自证 check-tp-prose：把 `修复后` 塞回 HIST 后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-tp-fixafter');
  try {
    // 把 b83-a2 的「删掉 `修复后`」退回旧版词表（`修复后` 重新算历史标记）。
    const gate = mutate('check-tp-prose.mjs', dir,
      "const HIST = /已修|原为|原记|原先|曾是|曾为|历史|修复前|校正|拆分|移入|resolvedDefects/;",
      "const HIST = /已修|原为|原记|原先|曾是|曾为|历史|修复前|修复后|校正|拆分|移入|resolvedDefects/;");
    const root = path.join(dir, 'styles');
    skillTree(root, 'gb-tp',
      '# gb-tp\n\n本次成片实际状态（音频链修复后）：成片实测真峰值 input_tp = −0.50 dBTP（本片成片实测）。\n',
      tpDistill());
    const res = await run(NODE, [gate], { env: { LEMO_DISTILL_ROOT: root } });
    // 把 `修复后` 塞回 HIST 后：整行被 ⑤ 豁免 ⇒ exit 0、无「陈旧读数 1 处」⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '陈旧读数 1 处', 'mut'),
      undefined, '把 `修复后` 塞回 HIST 后正向断言竟然还通过 ⇒ 断言没在测该收窄');
  } finally { rm(dir); }
});

test('★自证 check-tp-prose：摘掉「json 散文进 FAIL 桶」后，json 散文正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-tp-jsonprose');
  try {
    // 把「json 散文 token 进 FAIL 桶」这条新判据摘掉（`S.json` 的 token 一律降级为参考）。
    const gate = mutate('check-tp-prose.mjs', dir,
      "else if (D.mode === 'fail' && !S.jr) fails.get(D.key).push(rec2);",
      "else if (D.mode === 'fail' && !S.jr && !S.json) fails.get(D.key).push(rec2);");
    const root = path.join(dir, 'styles');
    const dj = tpDistill();
    dj.selfCheck.audio = { note: '本片成片实测真峰值 input_tp = −0.50 dBTP（本片成片实测）。' };
    skillTree(root, 'gb-tp', '# gb-tp\n\n本片成片真峰值 −1.25 dBTP（本片成片实测）。\n', dj);
    const res = await run(NODE, [gate], { env: { LEMO_DISTILL_ROOT: root } });
    // 判据被摘后：json 散文的 −0.50 不再判 ⇒ exit 0、无「陈旧读数 1 处」⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '陈旧读数 1 处', 'mut'),
      undefined, '摘掉 json 散文判据后正向断言竟然还通过 ⇒ 断言没在测该判据');
  } finally { rm(dir); }
});

test('★自证 check-skill-film-fields：把 ⑨ 由「同子句」退回「整行」后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-ff-xref');
  try {
    // 把 ⑨ 的「别的风格名必须与读数同子句」退回旧版「整行提到即豁免」。
    // ★ 该串在源码里出现**两次**（帧数 / 分辨率各一），`replace` 只换第一处 = 帧数那处 ⇒ 与夹具同维度。
    const gate = mutate('check-skill-film-fields.mjs', dir,
      'const isXref = others.some((o) => clauseOf(line, m.index).includes(o));',
      'const isXref = others.some((o) => line.includes(o));');
    const root = path.join(dir, 'styles');
    const gv = { generatedVideo: { frames: 100, width: 1920, height: 1080, durSec: 60 } };
    skillTree(root, 'gb-ff', '# gb-ff\n\n本片成片帧数 999 帧。队里 gb-other 曾到 100 帧。\n', gv);
    skillTree(root, 'gb-other', '# gb-other\n', gv);
    const res = await run(NODE, [gate], { env: { LEMO_DISTILL_ROOT: root } });
    // 退回整行后：整行提到 gb-other ⇒ 交叉引用豁免 ⇒ exit 0、无「陈旧帧数 1 处」⇒ 原正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '陈旧帧数 1 处', 'mut'),
      undefined, '把 ⑨ 退回整行后正向断言竟然还通过 ⇒ 断言没在测该收窄');
  } finally { rm(dir); }
});

test('★自证 check-skill-film-fields：删掉 WxH 朝向守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-ff-orient');
  try {
    // 把朝向守卫短路成恒 false（= 删掉该守卫）。
    const gate = mutate('check-skill-film-fields.mjs', dir,
      'if (Number.isFinite(gv.width) && Number.isFinite(gv.height) && (w > h) !== (gv.width > gv.height)) {',
      'if (false) {');
    const root = path.join(dir, 'styles');
    const gv = { generatedVideo: { frames: 100, width: 1920, height: 1080, durSec: 60 } };
    skillTree(root, 'gb-ff', '# gb-ff\n\n本片成片分辨率 1080×1920。\n', gv);
    const res = await run(NODE, [gate], { env: { LEMO_DISTILL_ROOT: root } });
    // 守卫被删后：竖画幅 1080×1920 不再进参考桶 ⇒ 判 FAIL ⇒ 原阴性断言（exit 0 + 参考画幅朝向 1 处）必须**抛**。
    assert.throws(() => expectClean(res, '陈旧分辨率 1 处', 'mut'),
      undefined, '删掉朝向守卫后阴性断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-render-venc：删掉 A 类失明守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-venc');
  try {
    // 把「aParsed === 0 ⇒ 失明」退化成「永不失明」。
    const gate = mutate('check-render-venc.mjs', dir, 'const blind = aParsed === 0;', 'const blind = false;');
    // 同一套正向夹具：3 个 A 类决策点全部「文件不存在」。
    mk(path.join(dir, 'opuscar'));
    mk(path.join(dir, 'styles'));
    const res = await run(NODE, [gate], {
      env: { LEMO_OPUSCAR: path.join(dir, 'opuscar'), LEMO_STYLES_ROOT: path.join(dir, 'styles') },
    });
    // 守卫被删后：exit 仍≠0（文件缺失 ⇒ aFails / D 类失明），但**不再打印**那句 A 类失明文案
    //   ⇒ 只断言「exit≠0」的坏用例会照样绿，本套件的第二条断言必须**抛**。
    assert.throws(() => expectBlind(res, '本闸门已**失明**：解析出的编码器决策点为 0', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-line-endings：删掉 J4 失明守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-eol');
  try {
    // 把「git ls-files 枚举到 0 个 ⇒ 失明」退化成「永不失明」。
    const gate = mutate('check-line-endings.mjs', dir, 'if (recs.length === 0) {', 'if (false) {');
    const repo = path.join(dir, 'repo');
    mk(repo);
    assert.equal((await git(['init', '-q', repo])).code, 0, '夹具：git init 失败');
    const res = await run(NODE, [gate, '--repo', 'tools'], { env: { LEMO_TOOLS_ROOT: repo } });
    assert.throws(() => expectBlind(res, '枚举到 **0 个**已跟踪文件', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-derivation-caliber：删掉失明块后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-dv');
  try {
    // 把「有失明原因就打印 + exit 1」整块短路掉（守卫被架空）。
    const gate = mutate('check-derivation-caliber.mjs', dir, 'if (blind.length) {', 'if (false) {');
    const cfg = path.join(dir, 'empty.json');
    rj(cfg, { styles: [] });
    const res = await run(NODE, [gate], { env: { LEMO_DUB_STYLES: cfg } });
    // 守卫被架空后：`styles: []` 走完空循环 ⇒ 分布为空、fails 为空 ⇒ 打印「✓」+ exit 0 ⇒ 正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '本闸门已失明', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-cli-docs：把「失明也计入 fails」短路掉后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-cli');
  try {
    // 守卫（`:123`）的落点是 `fails.push(...blind)` —— 短路掉它，`blind` 里那几句就**再也打不出来**。
    //   ★ 此刻 exit 仍≠0（`notImpl` 会因为 impl 侧 0 个而报「文档先于实现」）⇒
    //     只断言「exit≠0」的坏用例会照样绿，本套件的第二条断言必须**抛**。
    const gate = mutate('check-cli-docs.mjs', dir,
      'fails.push(...blind);', '/* 自证：失明不再计入 fails */;');
    const root = path.join(dir, 'root');
    const g2 = path.join(root, 'scripts', 'check-cli-docs.mjs');
    const USAGE = '#!/usr/bin/env node\nconst USAGE_TEXT = `\n用法:\n  --alpha   做某事\n`;\n';
    wf(path.join(root, 'dub.mjs'), USAGE);
    wf(path.join(root, 'lemo-make.mjs'), USAGE);
    // 破坏点 + 重定向点同时生效（重定向同样要断言「替换真的发生了」，否则会跑在真实仓上）。
    const src = fs.readFileSync(gate, 'utf8');
    const broken = src.replace("const ROOT = 'D:/lemo-tools';", `const ROOT = '${fwd(root)}';`);
    assert.notEqual(broken, src, '自证夹具失效：ROOT 重定向没生效');
    wf(g2, broken);
    const res = await run(NODE, [g2]);
    assert.throws(() => expectBlind(res, '解析到 0 个**已实现** flag ⇒ 失明（解析风格变了？）', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-shell-structure：删掉 WIN 侧失明守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-sh');
  try {
    const gate = mutate('check-shell-structure.mjs', dir, 'if (files.length === 0) {', 'if (false) {');
    const root = path.join(dir, 'root');
    mk(root);
    const src = fs.readFileSync(gate, 'utf8');
    const broken = src.replace("const WIN_ROOTS = [OPUSCAR, TOOLS];", `const WIN_ROOTS = ['${fwd(root)}'];`);
    assert.notEqual(broken, src, '自证夹具失效：WIN_ROOTS 重定向没生效');
    wf(gate, broken);
    const res = await run(NODE, [gate]);
    // 守卫被删后：空扫描根 ⇒ fails 为空 ⇒ exit 0、无「✘ WIN 扫描为空」⇒ 正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '✘ WIN 扫描为空', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-loudness-targets：删掉「档案 0 份」失明守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-lufs');
  try {
    const gate = mutate('check-loudness-targets.mjs', dir, 'if (slugs.length === 0) blind.push(', 'if (false) blind.push(');
    // ★ 该闸门 import 的是 `../lib/style-dna-reader.mjs` ⇒ 破坏副本必须落在 `<root>/scripts/` 下
    //   （放错位置会去解析 `<dir>/../lib/…`，报错原因就变成「模块找不到」而不是守卫被删）。
    const root = path.join(dir, 'root');
    mk(path.join(root, 'lib'));
    fs.copyFileSync(path.join(TOOLS, 'lib', 'style-dna-reader.mjs'), path.join(root, 'lib', 'style-dna-reader.mjs'));
    mk(path.join(root, 'lib', 'style-dna'));
    mk(path.join(root, 'lib', 'style-skills'));
    const broken = fs.readFileSync(gate, 'utf8')
      .replace("const DNA_DIR = 'D:/lemo-tools/lib/style-dna';", `const DNA_DIR = '${fwd(path.join(root, 'lib', 'style-dna'))}';`)
      .replace("const SKILL_DIR = 'D:/lemo-tools/lib/style-skills';", `const SKILL_DIR = '${fwd(path.join(root, 'lib', 'style-skills'))}';`);
    assert.ok(broken.includes(fwd(path.join(root, 'lib', 'style-dna'))) && broken.includes(fwd(path.join(root, 'lib', 'style-skills'))),
      '自证夹具失效：DNA_DIR / SKILL_DIR 重定向没生效');
    const g2 = path.join(root, 'scripts', 'check-loudness-targets.mjs');
    wf(g2, broken);
    const res = await run(NODE, [g2]);
    // 守卫被删后：0 份档案 ⇒ miss/offLine/dnaOnly/skillOnly 全空 ⇒ exit 0 ⇒ 正向断言必须**抛**。
    assert.throws(() => expectBlind(res, 'style-dna 档案 0 份（目录读空 / 路径变了？）⇒ 本闸门什么都没检查', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-lra-caliber：删掉「0 部成片被检查」守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-lra');
  try {
    const gate = mutate('check-lra-caliber.mjs', dir,
      'if (okEb + looksLn + neither === 0) blind = 1;', 'if (false) blind = 1;');
    const root = path.join(dir, 'root');
    mk(path.join(root, 'distill'));
    const broken = fs.readFileSync(gate, 'utf8')
      .replace("const DIR = 'D:/lemo-tools/lib/style-skills';", `const DIR = '${fwd(path.join(root, 'distill'))}';`);
    assert.ok(broken.includes(fwd(path.join(root, 'distill'))), '自证夹具失效：DIR 重定向没生效');
    wf(gate, broken);
    rj(path.join(root, 'distill', 'gb-lra', '_distill.json'),
      { generatedVideo: { path: path.join(root, '没有这部成片.mp4') } });
    const res = await run(NODE, [gate]);
    // 守卫被删后：全 continue ⇒ 三个计数器全 0 ⇒ exit 0 ⇒ 正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '失明：0 部成片被检查', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-film-delivery：删掉「0 部成片被检查」守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-fd');
  try {
    // 守卫（`:193`）的落点是 `if (slugs.length === 0) bad('(全部)', '✘ 失明', …)`。
    const gate = mutate('check-film-delivery.mjs', dir,
      "if (slugs.length === 0) bad('(全部)', '✘ 失明',", "if (false) bad('(全部)', '✘ 失明',");
    // 同一套正向夹具：空的成片树 + 合法的 E 段夹具（否则 E 段自己会报错，掩盖结论）。
    const MUX_OK = '#!/bin/sh\n'
      + 'LN_TP="${LEMO_LN_TP:--1.7}"\n'
      + 'LN_TP_STEP="${LEMO_LN_TP_STEP:-0.25}"\n'
      + 'LN_TP_TRIES="${LEMO_LN_TP_TRIES:-8}"\n'
      + 'ffmpeg -i "$1" -af "loudnorm=TP=$LN_TP" -f null - 2>&1 | grep input_tp\n'
      + 'if [ "$(echo "$TP > -1.2" | bc)" = "1" ]; then :; fi\n';
    wf(path.join(dir, 'mux.sh'), MUX_OK);
    wf(path.join(dir, 'opuscar', 'styles', 'gb-fd', 'demo', 'tools', 'mux.sh'), MUX_OK);
    mk(path.join(dir, 'batch'));
    mk(path.join(dir, 'locks'));
    mk(path.join(dir, 'distill'));
    const res = await run(NODE, [gate], { env: {
      LEMO_MUX_SH: path.join(dir, 'mux.sh'),
      LEMO_OPUSCAR: path.join(dir, 'opuscar'),
      LEMO_BATCH_DIR: path.join(dir, 'batch'),
      LEMO_LOCK_DIR: path.join(dir, 'locks'),
      LEMO_DISTILL_ROOT: path.join(dir, 'distill'),
    } });
    // 守卫被删后：0 部成片 + E 段合法 ⇒ fails 为空 ⇒ exit 0 ⇒ 正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '0 部成片被检查（style-skills 下无 _distill.json / 路径变了？）', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-film-delivery：删掉 F 段「全部让位」守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-fd2');
  try {
    // 守卫（`:340`）的落点是 `if (slugs.length > 0 && deferred.length === slugs.length)`。
    const gate = mutate('check-film-delivery.mjs', dir,
      'if (slugs.length > 0 && deferred.length === slugs.length)', 'if (false)');
    // 同一套夹具：合法的 E 段 + 一部**存在但刚写盘**的成片 + 文档 mtime 显式设早 ⇒ 必然让位。
    //   ★ 成片只需**存在**（本守卫只读 mtime，不看媒体内容）⇒ 用 1 字节文件即可 ——
    //     这顺带证明「让位判据与媒体分析无关」，也让这条自证零 ffmpeg 依赖。
    const MUX_OK = '#!/bin/sh\n'
      + 'LN_TP="${LEMO_LN_TP:--1.7}"\n'
      + 'LN_TP_STEP="${LEMO_LN_TP_STEP:-0.25}"\n'
      + 'LN_TP_TRIES="${LEMO_LN_TP_TRIES:-8}"\n'
      + 'ffmpeg -i "$1" -af "loudnorm=TP=$LN_TP" -f null - 2>&1 | grep input_tp\n'
      + 'if [ "$(echo "$TP > -1.2" | bc)" = "1" ]; then :; fi\n';
    wf(path.join(dir, 'mux.sh'), MUX_OK);
    wf(path.join(dir, 'opuscar', 'styles', 'gb-fd', 'demo', 'tools', 'mux.sh'), MUX_OK);
    mk(path.join(dir, 'batch'));
    mk(path.join(dir, 'locks'));
    mk(path.join(dir, 'distill'));
    const film = path.join(dir, 'films', 'gb-fd', 'gb-fd.mp4');
    wf(film, 'x');
    const docPath = path.join(dir, 'distill', 'gb-fd', '_distill.json');
    rj(docPath, { generatedVideo: { path: film } });
    const t = new Date(fs.statSync(film).mtimeMs - 120000);
    fs.utimesSync(docPath, t, t);
    const res = await run(NODE, [gate], { env: {
      LEMO_MUX_SH: path.join(dir, 'mux.sh'),
      LEMO_OPUSCAR: path.join(dir, 'opuscar'),
      LEMO_BATCH_DIR: path.join(dir, 'batch'),
      LEMO_LOCK_DIR: path.join(dir, 'locks'),
      LEMO_DISTILL_ROOT: path.join(dir, 'distill'),
    } });
    // 守卫被删后：全部让位 ⇒ `local` 全被丢掉 ⇒ fails 为空 ⇒ 打印「✓ 被判的 0 部成片交付口径
    //   全部一致」+ exit 0（**一部都没判**却报通过）⇒ 正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '都被判「疑似正在重渲」而让位 ⇒ 本次**一部成片都没判**', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

test('★自证 check-plate-pixel：删掉「全部差分 0」计数式守卫后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-pp');
  try {
    // 守卫（`:227`）的落点是 `if (allZero) console.log(...)`。
    const gate = mutate('check-plate-pixel.mjs', dir, 'if (allZero) console.log(', 'if (false) console.log(');
    const root = path.join(dir, 'root');
    copyDubCoreLib(root);
    rj(path.join(root, 'lib', 'dub-styles.json'), { styles: [{
      slug: 'gb-pp',
      palette: { bg: '000000', subtitle: 'FFFFFF', subtitleOutline: 'FF101010' },
      subtitle: { plate: 'box' },
    }] });
    const broken = fs.readFileSync(gate, 'utf8');   // 破坏点在源码里，拷过去即可（ROOT 按自身位置推导）
    const g2 = path.join(root, 'scripts', 'check-plate-pixel.mjs');
    wf(g2, broken);
    const OS_TMP = path.join(dir, 'os-tmp');   // 非 C 盘（闸门自己用 os.tmpdir() 建中间目录）
    mk(OS_TMP);
    const res = await run(NODE, [g2], { env: { TEMP: fwd(OS_TMP), TMP: fwd(OS_TMP) } });
    // 守卫被删后：exit 仍≠0（单风格那条差分 0 已判成真缺陷），但**不再打印**那句计数式失明文案
    //   ⇒ 只断言「exit≠0」的坏用例会照样绿，本套件的第二条断言必须**抛**。
    assert.throws(() => expectBlind(res, '一个底衬色都没真正判过', 'mut'),
      undefined, '删掉守卫后正向断言竟然还通过 ⇒ 断言没在测该守卫');
  } finally { rm(dir); }
});

// ── ★★ 第二批「故意破坏」自证（2026-10-07 扩批之二）：上面那 5 条**核心判据**同样要自证 ──
//   每条都把**那一条判据**改坏，再跑同一套正向夹具，断言**必须变红** ——
//   证明那些文案真的来自那条判据，而不是来自「闸门崩了」或别的分支。

test('★自证 check-lra-caliber：短路「像 loudnorm」分支后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-lra2');
  try {
    // 把「与 loudnorm 相符 ⇒ 判口径疑似 loudnorm」这一支的条件短路 ⇒ 该 doc 会掉进
    // `neither` 分支（**exit 仍≠0**，但文案换成「与两个口径都不符」）⇒ 只断言「exit≠0」的
    //   坏用例会照样绿，本套件的第二条断言必须**抛**。
    const gate = mutate('check-lra-caliber.mjs', dir,
      'else if (b !== null && Math.abs(doc - b) <= TOL) {', 'else if (false) {');
    const root = path.join(dir, 'root');
    mk(path.join(root, 'distill', 'gb-lra'));
    const broken = fs.readFileSync(gate, 'utf8')
      .replace("const DIR = 'D:/lemo-tools/lib/style-skills';", `const DIR = '${fwd(path.join(root, 'distill'))}';`);
    assert.ok(broken.includes(fwd(path.join(root, 'distill'))), '自证夹具失效：DIR 重定向没生效');
    wf(gate, broken);
    // 同一套正向夹具：文档 lra 写 loudnorm 口径的实测值。
    const { lraLn } = await lraTone(path.join(dir, 'tone.wav'));
    rj(path.join(root, 'distill', 'gb-lra', '_distill.json'),
      { generatedVideo: { path: fwd(path.join(dir, 'tone.wav')) }, selfCheck: { loudness: { lra: lraLn } } });
    const res = await run(NODE, [gate]);
    assert.throws(() => expectBlind(res, '口径疑似 loudnorm（项目口径应为 ebur128）', 'mut'),
      undefined, '短路那条分支后正向断言竟然还通过 ⇒ 断言没在测该判据');
  } finally { rm(dir); }
});

test('★自证 check-loudness-targets：短路「偏离交付线」判据后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-lufs2');
  try {
    // 把 `offLine` 恒置空（= 退回「只判能不能解析」的旧口径）⇒ −16 也照样绿。
    const gate = mutate('check-loudness-targets.mjs', dir,
      'const offLine = Object.keys(dist).map(Number).filter((v) => Math.abs(v - LUFS_LINE) > LUFS_EPS);',
      'const offLine = [];');
    const root = path.join(dir, 'root');
    mk(path.join(root, 'lib'));
    fs.copyFileSync(path.join(TOOLS, 'lib', 'style-dna-reader.mjs'), path.join(root, 'lib', 'style-dna-reader.mjs'));
    mk(path.join(root, 'lib', 'style-dna'));
    mk(path.join(root, 'lib', 'style-skills'));
    const broken = fs.readFileSync(gate, 'utf8')
      .replace("const DNA_DIR = 'D:/lemo-tools/lib/style-dna';", `const DNA_DIR = '${fwd(path.join(root, 'lib', 'style-dna'))}';`)
      .replace("const SKILL_DIR = 'D:/lemo-tools/lib/style-skills';", `const SKILL_DIR = '${fwd(path.join(root, 'lib', 'style-skills'))}';`);
    assert.ok(broken.includes(fwd(path.join(root, 'lib', 'style-dna'))) && broken.includes(fwd(path.join(root, 'lib', 'style-skills'))),
      '自证夹具失效：DNA_DIR / SKILL_DIR 重定向没生效');
    const g2 = path.join(root, 'scripts', 'check-loudness-targets.mjs');
    wf(g2, broken);
    rj(path.join(root, 'lib', 'style-dna', 'gb-lt.json'),
      { slug: 'gb-lt', sound_palette: { mix_rules: '整体 -16 LUFS（源：styles/gb-lt/STYLE.md:20）' } });
    const res = await run(NODE, [g2]);
    // 判据被架空后：1 份档案都解析得出目标值 ⇒ miss/blind 都空 ⇒ exit 0 ⇒ 正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '响度目标**偏离交付线 -14 LUFS** 的值：-16', 'mut'),
      undefined, '短路那条判据后正向断言竟然还通过 ⇒ 断言没在测该判据');
  } finally { rm(dir); }
});

test('★自证 check-plate-pixel：把品红标记测试改成恒通过后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-ppmark');
  try {
    // 把「盒内众数色必须是品红系」这个**决定性判据**改成恒真（= 退回「只看绝对色差」的旧口径）。
    const gate = mutate('check-plate-pixel.mjs', dir,
      'const isMagenta = rgb[0] > 110 && rgb[2] > 110 && rgb[1] < 110 && Math.abs(rgb[0] - rgb[2]) < 90;',
      'const isMagenta = true;');
    const root = path.join(dir, 'root');
    const OS_TMP = path.join(dir, 'os-tmp');
    mk(OS_TMP);
    // 同一套正向夹具：底衬色被改道到别的字段（盒色 = palette.subtitleOutline），
    //   但绝对色差 Δ=1、对比度 16.5 都达标 ⇒ 标记测试一被架空，这一条就会变成 exit 0。
    copyDubCoreLib(root, ['const subOutlineCol = plateOn ? cPlate : cOut;',
      'const subOutlineCol = plateOn ? cOut : cOut;']);
    rj(path.join(root, 'lib', 'dub-styles.json'), { styles: [{
      slug: 'gb-ppm',
      palette: { bg: '000000', subtitle: 'FFFFFF', subtitleOutline: '202020' },
      subtitle: { plate: 'box', plateColor: '202020' },
    }] });
    const g2 = path.join(root, 'scripts', 'check-plate-pixel.mjs');
    wf(g2, fs.readFileSync(gate, 'utf8'));
    const res = await run(NODE, [g2], { env: { TEMP: fwd(OS_TMP), TMP: fwd(OS_TMP) } });
    assert.throws(() => expectBlind(res, '不是品红 ⇒ 底衬色未取自 plateColor', 'mut'),
      undefined, '架空标记测试后正向断言竟然还通过 ⇒ 断言没在测该判据');
  } finally { rm(dir); }
});

test('★自证 check-shell-structure：短路 ② 判据后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-sh2');
  try {
    // 把「以 fi 结尾且前 25 行（非注释）里有判定块标记 ⇒ 判缺 exit 0」这一支短路。
    const gate = mutate('check-shell-structure.mjs', dir,
      'if (/missed the target|input_tp|Peak level dB/.test(near)) {', 'if (false) {');
    const root = path.join(dir, 'root');
    mk(root);
    const broken = fs.readFileSync(gate, 'utf8')
      .replace("const WIN_ROOTS = [OPUSCAR, TOOLS];", `const WIN_ROOTS = ['${fwd(root)}'];`);
    assert.ok(broken.includes(`['${fwd(root)}']`), '自证夹具失效：WIN_ROOTS 重定向没生效');
    wf(gate, broken);
    wf(path.join(root, 'gb.sh'),
      '#!/bin/sh\n'
      + 'TP=$(ffmpeg -i "$1" -af ebur128 -f null - 2>&1 | grep -o "input_tp[^,]*")\n'
      + 'if [ "$(echo "$TP > -1.2" | bc)" = "1" ]; then\n'
      + '  echo "loudness missed the target"\n'
      + 'fi\n');
    const res = await run(NODE, [gate]);
    // 判据被短路后：该脚本 0 处问题、WIN 侧非空（未失明）⇒ exit 0 ⇒ 正向断言必须**抛**。
    assert.throws(() => expectBlind(res, '② 判定块后缺 exit 0', 'mut'),
      undefined, '短路那条判据后正向断言竟然还通过 ⇒ 断言没在测该判据');
  } finally { rm(dir); }
});

test('★自证 check-cli-docs：短路 notImpl 判据后，正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-cli2');
  try {
    // 把「用法块列了、代码没有」这一侧收空 ⇒ 只剩 notDoc 那一侧（本夹具里它为空）⇒ 静默 OK。
    const gate = mutate('check-cli-docs.mjs', dir,
      'const notImpl = [...doc].filter((f) => !impl.has(f));', 'const notImpl = [];');
    const root = path.join(dir, 'root');
    const srcGate = fs.readFileSync(gate, 'utf8');
    const broken = srcGate.replace("const ROOT = 'D:/lemo-tools';", `const ROOT = '${fwd(root)}';`);
    assert.notEqual(broken, srcGate, '自证夹具失效：ROOT 重定向没生效');
    const g2 = path.join(root, 'scripts', 'check-cli-docs.mjs');
    wf(g2, broken);
    // 同一套正向夹具：用法块列了 `--alpha`、代码里没有；`--gamma` 两侧都有。
    const usage = (flags) => '#!/usr/bin/env node\nconst USAGE_TEXT = `\n用法:\n'
      + `${flags.map((f) => `  ${f}   做某事`).join('\n')}\n\`;\n`;
    wf(path.join(root, 'dub.mjs'), usage(['--alpha', '--gamma']) + "case '--gamma': break;\n");
    wf(path.join(root, 'lemo-make.mjs'), usage(['--delta']) + "if (a === '--delta') { }\n");
    const res = await run(NODE, [g2]);
    assert.throws(() => expectBlind(res, '但代码里**没有任何处理分支**（文档先于实现）', 'mut'),
      undefined, '短路 notImpl 判据后正向断言竟然还通过 ⇒ 断言没在测该判据');
  } finally { rm(dir); }
});

// ── 21. check-ref-lines.mjs（裸引用判据 + 数据文件覆盖守卫，2026-10-07 b84-b）─────
test('check-ref-lines：裸引用真的判 (b) / 合计口径覆盖守卫 / 合法改写不假红', async () => {
  const dir = path.join(TMP, 'reflines');
  const BT = '`';
  const DUB = (notes) => '{\n  "version": 1,\n  "styles": [\n    {\n      "id": "gb-bare",\n'
    + `      "notes": "${notes}",\n      "palette": {}\n    }\n  ]\n}\n`;
  // ★ 夹具里**必须同时**放一条反引号引用 + 一条裸引用（且都能解析）：
  //   否则「覆盖守卫（反引号+裸 合计为 0 ⇒ 失明）」会先命中 ⇒ 阴性对照会假红。
  const DUB_OK = DUB(`见 ${BT}test/target.mjs:1${BT} 与 test/target.mjs:1。`);
  const DIRS = ['test', '_distill', 'lib', 'scripts', 'opuscar/styles'];
  const envFor = (root) => ({
    LEMO_TOOLS_ROOT: root,
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_STYLES_ROOT: path.join(root, 'opuscar', 'styles'),
    LEMO_DISTILL_ROOT: path.join(root, 'lib', 'style-skills'),
  });
  const tree = (root, dub) => {
    for (const d of DIRS) mk(path.join(root, d));
    wf(path.join(root, 'test', 'target.mjs'), 'line1\nline2\n');
    wf(path.join(root, 'test', 'README.md'), '# 测试\n\n见 `target.mjs:1`。\n');
    wf(path.join(root, 'lib', 'dub-styles.json'), dub);
  };
  try {
    // 正向 A：裸引用写 `:99`（target.mjs 只有 2 行）⇒ 判 (b) 行号超范围，且**点明它是裸引用**。
    const pos = path.join(dir, 'pos');
    tree(pos, DUB(`见 ${BT}test/target.mjs:1${BT} 与 test/target.mjs:99。`));
    const r1 = await runGate('check-ref-lines.mjs', envFor(pos));
    assert.notEqual(r1.code, 0, `裸引用超范围应 exit≠0\n${r1.out.slice(0, 900)}`);
    assert.ok(r1.out.includes('(b) 行号超范围'), `应报 (b) 行号超范围\n${r1.out.slice(0, 900)}`);
    assert.ok(r1.out.includes('这是**裸引用**'), `应点明这是裸引用\n${r1.out.slice(0, 900)}`);

    // 正向 B：数据文件存在但**一处引用都没有** ⇒ 覆盖守卫①（合计口径）判失明。
    const pos2 = path.join(dir, 'pos2');
    tree(pos2, '{\n  "version": 1,\n  "styles": []\n}\n');
    const r2 = await runGate('check-ref-lines.mjs', envFor(pos2));
    assert.notEqual(r2.code, 0, `空数据文件应 exit≠0\n${r2.out.slice(0, 900)}`);
    assert.ok(r2.out.includes('本闸门已失明'), `应判失明\n${r2.out.slice(0, 900)}`);

    // 阴性 A：反引号 + 裸 各一条、都能解析 ⇒ exit 0，且裸引用**真的被核过**。
    const neg = path.join(dir, 'neg');
    tree(neg, DUB_OK);
    const r3 = await runGate('check-ref-lines.mjs', envFor(neg));
    expectClean(r3, '已失明', 'check-ref-lines 阴性 A');
    assert.ok(/裸引用 1 处[^\n]*已核 1/.test(r3.out), `裸引用应被核过\n${r3.out.slice(0, 900)}`);

    // 阴性 B（守卫脆弱点回归）：**只有裸引用、0 反引号引用** ⇒ 不许判失明、exit 0。
    //   ★ 由来：「把反引号引用也改成裸引用」正是本仓推荐的写作方向 ⇒ 覆盖守卫必须用「合计」口径，
    //     否则会假红；而后人为了让它绿就会删掉守卫 ⇒ **裸引用判据静默丢失**。
    const n28 = path.join(dir, 'bareonly');
    tree(n28, DUB('见 test/target.mjs:1。'));
    const r4 = await runGate('check-ref-lines.mjs', envFor(n28));
    assert.ok(!r4.out.includes('已失明'), `只有裸引用不应判失明\n${r4.out.slice(0, 900)}`);
    assert.strictEqual(r4.code, 0, `只有裸引用应 exit 0\n${r4.out.slice(0, 900)}`);

    // 阴性 C（另一个合法改写方向）：**只有反引号引用、0 裸引用** ⇒ exit 0 + 一行 ℹ（不假红）。
    const n29 = path.join(dir, 'tickonly');
    tree(n29, DUB(`见 ${BT}test/target.mjs:1${BT}。`));
    const r5 = await runGate('check-ref-lines.mjs', envFor(n29));
    expectClean(r5, '已失明', 'check-ref-lines 阴性 C');
    assert.ok(r5.out.includes('本次 **0 处裸引用**'), `应打「0 处裸引用」的 ℹ\n${r5.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

test('★自证 check-ref-lines：摘掉裸引用判据整段 ⇒ 源码标记守卫必须变红', async () => {
  // ★ 为什么是「自证式」而不是 env 夹具：这条守卫读的是**闸门自己的源码**
  //   （源码标记存在性 + 内联探针行为自证），夹具树驱动不了它 ⇒ 只能改源码副本。
  const dir = path.join(TMP, 'reflines-self');
  try {
    const src = fs.readFileSync(path.join(SCRIPTS, 'check-ref-lines.mjs'), 'utf8');
    // 两道锚点：定位「裸引用判定」那一段的起止。
    // ★ 锚点若被重排/改名，下面两条 assert 会**先**失败，**不会退化成「空变异」**（否则这条自证会静默变绿）。
    const a = src.indexOf('    for (const bm of masked.matchAll(BARE_REF)) {');
    const b = src.indexOf('    for (const m of codeSpans(line)) {', a);
    assert.ok(a >= 0, '自证夹具失效：找不到裸引用判定的起点锚点（源码已变？）');
    assert.ok(b > a, '自证夹具失效：找不到裸引用判定的终点锚点（源码已变？）');
    const mutated = src.slice(0, a) + src.slice(b);
    assert.notEqual(mutated, src, '自证夹具失效：摘除没有生效');
    assert.ok(!mutated.includes('for (const bm of masked.matchAll(BARE_REF)) {'),
      '自证夹具失效：摘除后仍含该片段');
    const f = path.join(dir, 'mut-bare-removed.mjs');
    wf(f, mutated);
    const r = await run(NODE, [f], { env: {} });
    assert.notEqual(r.code, 0, `摘掉裸引用判据后应 exit≠0\n${r.out.slice(0, 900)}`);
    assert.ok(r.out.includes('裸引用判据的关键代码标记不见了'),
      `应报「关键代码标记不见了」\n${r.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 21b. check-ref-lines.mjs 的**第二个数据文件覆盖守卫**（#7，2026-10-07）──────────
//   与 21 同型：`lib/dub-visual.json` 是**第二个已声明的覆盖目标**（证据层）。
//   本条证明「把它从 `DOCS` 摘掉 / 它的引用被清空」会被抓住，而**合法的两种写作方向**不假红。
test('check-ref-lines：`dub-visual.json` 覆盖守卫（#7，第二个数据文件覆盖目标）', async () => {
  const dir = path.join(TMP, 'reflines-dv');
  const BT = '`';
  // ★ 夹具里**必须**同时放 `dub-styles.json`（带引用）—— 否则覆盖守卫①会先命中 ⇒ 阴性对照假红。
  const DUB_STYLES = '{\n  "version": 1,\n  "styles": [\n    {\n      "id": "gb-bare",\n'
    + `      "notes": "见 ${BT}test/target.mjs:1${BT} 与 test/target.mjs:1。",\n      "palette": {}\n    }\n  ]\n}\n`;
  const DUB_VISUAL = (ev) => '{\n  "version": 1,\n  "styles": [\n    {\n      "id": "gb-vis",\n'
    + `      "evidence": "${ev}",\n      "palette": {}\n    }\n  ]\n}\n`;
  const DIRS = ['test', '_distill', 'lib', 'scripts', 'opuscar/styles'];
  const envFor = (root) => ({
    LEMO_TOOLS_ROOT: root,
    LEMO_OPUSCAR: path.join(root, 'opuscar'),
    LEMO_STYLES_ROOT: path.join(root, 'opuscar', 'styles'),
    LEMO_DISTILL_ROOT: path.join(root, 'lib', 'style-skills'),
  });
  const tree = (root, dv) => {
    for (const d of DIRS) mk(path.join(root, d));
    wf(path.join(root, 'test', 'target.mjs'), 'line1\nline2\n');
    wf(path.join(root, 'test', 'README.md'), '# 测试\n\n见 `target.mjs:1`。\n');
    wf(path.join(root, 'lib', 'dub-styles.json'), DUB_STYLES);
    wf(path.join(root, 'lib', 'dub-visual.json'), dv);
  };
  try {
    // 正向：`dub-visual.json` **存在**但一处引用都没有 ⇒ 覆盖守卫②判失明，且文案点明是这个文件。
    const pos = path.join(dir, 'pos');
    tree(pos, DUB_VISUAL('无引用的说明文字'));
    const r1 = await runGate('check-ref-lines.mjs', envFor(pos));
    assert.notEqual(r1.code, 0, `dub-visual 零引用应 exit≠0\n${r1.out.slice(0, 900)}`);
    assert.ok(r1.out.includes('本闸门已失明'), `应判失明\n${r1.out.slice(0, 900)}`);
    assert.ok(r1.out.includes('lib/dub-visual.json'), `失明文案应点明 dub-visual.json\n${r1.out.slice(0, 900)}`);

    // 阴性 A：反引号 + 裸 各一条 ⇒ exit 0（合计口径，不假红）。
    const neg = path.join(dir, 'neg');
    tree(neg, DUB_VISUAL(`见 ${BT}test/target.mjs:1${BT} 与 test/target.mjs:1。`));
    const r2 = await runGate('check-ref-lines.mjs', envFor(neg));
    expectClean(r2, '已失明', 'check-ref-lines dub-visual 阴性 A');

    // 阴性 B（守卫脆弱点回归）：**只有裸引用、0 反引号** ⇒ 同样不许假红。
    const n2 = path.join(dir, 'bareonly');
    tree(n2, DUB_VISUAL('见 test/target.mjs:1。'));
    const r3 = await runGate('check-ref-lines.mjs', envFor(n2));
    assert.ok(!r3.out.includes('已失明'), `dub-visual 只有裸引用不应判失明\n${r3.out.slice(0, 900)}`);
    assert.strictEqual(r3.code, 0, `dub-visual 只有裸引用应 exit 0\n${r3.out.slice(0, 900)}`);

    // ★自证：把覆盖守卫②的条件改成恒假 ⇒ **同一个正向夹具**必须不再判失明（证明断言真的在测那条守卫）。
    const gdir = path.join(dir, 'mut');
    mk(path.join(gdir, 'scripts'));
    const mut = patchGate('check-ref-lines.mjs', path.join(gdir, 'scripts'),
      [['dvExists && dvRefCount + dvBareCount === 0', 'false']]);
    const rm1 = await run(NODE, [mut], { env: envFor(pos) });
    assert.ok(!rm1.out.includes('lib/dub-visual.json'),
      `★自证：摘掉覆盖守卫②后，同一夹具**不该**再报 dub-visual 失明 ⇒ 断言确实在测该守卫\n${rm1.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

// ── 37. check-redline-md5.mjs（红线 md5 的「多处登记是否同步」；2026-10-07 新建）────
test('check-redline-md5：登记处漂移 ⇒ exit 1 点名；提取不到 ⇒ 失明', async () => {
  const dir = path.join(TMP, 'redline');
  const md5 = (p) => createHash('md5').update(fs.readFileSync(p)).digest('hex');
  const CUR = md5(path.join(TOOLS, 'lemo-make.mjs'));      // ★ 从真实红线文件算，不写死数字（红线变了夹具仍成立）
  const WRONG = 'deadbeefdeadbeefdeadbeefdeadbeef';
  const NEEDLE = '登记的 md5 与实际';                      // 该闸门特有的「不一致」文案片段
  const BLIND = '本闸门已失明';
  /** 造一棵「红线 + 四处登记」的极小树；`wrong` 指定把哪一处登记改成错值。 */
  const tree = (name, wrong) => {
    const root = path.join(dir, name);
    mk(path.join(root, 'test'));
    mk(path.join(root, '_distill'));
    fs.copyFileSync(path.join(TOOLS, 'lemo-make.mjs'), path.join(root, 'lemo-make.mjs'));
    const v = (site) => (site === wrong ? WRONG : CUR);
    wf(path.join(root, 'test', 'cases.mjs'), "export const ORCH_MD5 = '" + v('cases') + "';\n");
    wf(path.join(root, 'test', 'README.md'),
      '| 编排器 md5 未被改动 | `lemo-make.mjs` 的 md5 == `' + v('treadme') + '` |\n');
    wf(path.join(root, 'README.md'),
      '- **编排器 md5 红线** —— `lemo-make.mjs` 必须仍是 `' + v('readme') + '`（控制台只是包装层）\n');
    wf(path.join(root, '_distill', 'AGENT-BRIEF.md'), 'md5 `315887dd…` → **`' + v('brief') + '`**。\n');
    return root;
  };
  try {
    // 阴性对照：四处登记全对 ⇒ exit 0，且不含失明 / 「不一致」文案。
    const neg = tree('neg');
    const r0 = await runGate('check-redline-md5.mjs', { LEMO_TOOLS_ROOT: neg });
    expectClean(r0, BLIND, 'check-redline-md5 阴性对照');
    assert.ok(!r0.out.includes(NEEDLE), `阴性对照不该报「${NEEDLE}」\n${r0.out.slice(0, 900)}`);

    // 正向 A：README.md 那份改成错值（**正是 2026-10-07 真实漂过的那一处**）⇒ exit 1 并点名 README.md。
    const fa = tree('fx-a', 'readme');
    const r1 = await runGate('check-redline-md5.mjs', { LEMO_TOOLS_ROOT: fa });
    expectBlind(r1, NEEDLE, 'check-redline-md5 正向 A（README.md 漂移）');
    assert.ok(r1.out.includes('README.md'), `正向 A 应点名 README.md\n${r1.out.slice(0, 900)}`);

    // 正向 B：test/README.md 那张验收判据表改成错值 ⇒ exit 1 并点名 test/README.md。
    const fb = tree('fx-b', 'treadme');
    const r2 = await runGate('check-redline-md5.mjs', { LEMO_TOOLS_ROOT: fb });
    expectBlind(r2, NEEDLE, 'check-redline-md5 正向 B（表行漂移）');
    assert.ok(r2.out.includes('test/README.md'), `正向 B 应点名 test/README.md\n${r2.out.slice(0, 900)}`);

    // 正向 C：三处**判据处**都提取不到（空文件）⇒ exit 1 + 「本闸门已失明」（绝不静默通过）。
    const fc = tree('fx-c');
    for (const f of ['README.md', path.join('test', 'cases.mjs'), path.join('test', 'README.md')]) {
      wf(path.join(fc, f), '');
    }
    const r3 = await runGate('check-redline-md5.mjs', { LEMO_TOOLS_ROOT: fc });
    expectBlind(r3, BLIND, 'check-redline-md5 正向 C（三处都提取不到）');

    // ★ 反向对照：只改**历史 md5 链**（不是登记处）⇒ 仍 exit 0
    //   （证明它的抽取**锚定到具体形态**、没在「扫全文第一个 32 位 hex」）。
    const ff = tree('fx-f');
    wf(path.join(ff, 'test', 'README.md'),
      '| 编排器 md5 未被改动 | `lemo-make.mjs` 的 md5 == `' + CUR + '` |\n'
      + '故基线 md5 由 `314d7fc8a341b6d77189e368552291f3` → `d5a1b91b0113d611e3211e31f31f1be0`。\n');
    const r4 = await runGate('check-redline-md5.mjs', { LEMO_TOOLS_ROOT: ff });
    expectClean(r4, BLIND, 'check-redline-md5 反向对照（历史链被改）');

    // ★自证：把「不一致」判据短路成恒假 ⇒ **同一套正向断言必须变红**（证明断言真的在测那条判据）。
    const gdir = path.join(dir, 'mut');
    mk(path.join(gdir, 'scripts'));
    const mut = patchGate('check-redline-md5.mjs', path.join(gdir, 'scripts'),
      [['f.value != null && actual != null && f.value !== actual', 'false']]);
    const rm1 = await run(NODE, [mut], { env: { LEMO_TOOLS_ROOT: fa } });
    assert.throws(() => expectBlind(rm1, NEEDLE, 'mut'),
      undefined, '短路「不一致」判据后正向断言竟然还通过 ⇒ 断言没在测该判据');
  } finally { rm(dir); }
});

// ── 12b. check-env-overrides.mjs（覆盖点登记表**双向**守卫，2026-10-07 建）────
// ★ 为什么夹具是「**整棵拷真实语料**」而不是手写最小树：判据② 要求**登记表里 100 个
//   「(覆盖点, 读者文件)」对逐个仍在** ⇒ 手写最小树等于把整张登记表**抄第二遍**（两套口径必然漂移）；
//   拷真实语料则**自洽**（闸门与语料同一快照）—— 这也正是本闸门要守的那件事的反面。
// ★ 该闸门**没有** `LEMO_*` 覆盖点（扫描根按脚本自身位置推导）⇒ 只能「整棵拷 + `copyGate`」。
const copyEnvregCorpus = (root) => {
  mk(path.join(root, 'lib')); mk(path.join(root, 'scripts'));
  for (const f of fs.readdirSync(path.join(TOOLS, 'lib'))) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(TOOLS, 'lib', f), path.join(root, 'lib', f));
  for (const f of fs.readdirSync(path.join(TOOLS, 'scripts'))) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(TOOLS, 'scripts', f), path.join(root, 'scripts', f));
  for (const f of fs.readdirSync(TOOLS)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(TOOLS, f), path.join(root, f));
  return copyGate('check-env-overrides.mjs', root);
};

test('check-env-overrides：未登记的新覆盖点 ⇒ FAIL；已登记的覆盖点被删 ⇒ FAIL（含阴性 + 失明）', async () => {
  const dir = path.join(TMP, 'envreg');
  // 判据① 的特有文案（逐字抄自闸门源码）与判据② 的特有文案
  const N_UNREG = '处**未登记**的 process.env';
  const N_GONE = '个**已登记的覆盖点消失**';
  const N_BLIND = '本闸门已**失明**';
  try {
    // ① 阳性（判据①）：真实语料副本 + 给 lib/aspects.mjs 塞一行 `process.env.LEMO_ZZZ_PROBE`
    const pos = path.join(dir, 'pos');
    const gatePos = copyEnvregCorpus(pos);
    fs.appendFileSync(path.join(pos, 'lib', 'aspects.mjs'), '\nconst PROBE = process.env.LEMO_ZZZ_PROBE;\n');
    const r1 = await run(NODE, [gatePos]);
    expectBlind(r1, N_UNREG, 'check-env-overrides 判据① 正向');
    assert.ok(r1.out.includes('LEMO_ZZZ_PROBE') && r1.out.includes('lib/aspects.mjs'),
      `判据① 应点名 文件:行 + 变量名\n${r1.out.slice(0, 900)}`);

    // ② 阳性（判据②）：把**已登记**的覆盖点从它登记的文件里删掉（改成裸标识符 ⇒ 不产生新变量名，
    //    故**只有**判据② 能解释这个 exit≠0）。
    const pos2 = path.join(dir, 'pos2');
    const gatePos2 = copyEnvregCorpus(pos2);
    const vf = path.join(pos2, 'lib', 'voices.mjs');
    fs.writeFileSync(vf, fs.readFileSync(vf, 'utf8').replace(/process\.env\.LEMO_VOICE_TEST_TMP/g, 'VOICE_TEST_TMP_FALLBACK'));
    const r2 = await run(NODE, [gatePos2]);
    expectBlind(r2, N_GONE, 'check-env-overrides 判据② 正向');
    assert.ok(r2.out.includes('LEMO_VOICE_TEST_TMP') && r2.out.includes('lib/voices.mjs'),
      `判据② 应点名 覆盖点 + 登记文件\n${r2.out.slice(0, 900)}`);
    assert.ok(!r2.out.includes(N_UNREG),
      `判据② 那条不该触发判据①（删成裸标识符不产生新变量名）\n${r2.out.slice(0, 900)}`);

    // ③ 阴性对照：同一份真实语料、**不改动** ⇒ exit 0 且两条 ✓ 都在（否则「永远 exit 1」也能骗过）
    const neg = path.join(dir, 'neg');
    const gateNeg = copyEnvregCorpus(neg);
    const r3 = await run(NODE, [gateNeg]);
    expectClean(r3, N_UNREG, 'check-env-overrides 阴性对照');
    assert.ok(r3.out.includes('✓ 判据①·扫描范围内所有 process.env.<NAME> 都已登记')
      && r3.out.includes('✓ 判据②·'),
      `阴性对照应真的跑过判据①②\n${r3.out.slice(0, 900)}`);
    assert.ok(/登记 47 条/.test(r3.out) && /\*\*差额 0\*\*/.test(r3.out),
      `阴性对照应打印「本闸门期望值」且差额 0\n${r3.out.slice(0, 900)}`);

    // ④ 失明守卫：一棵**没有任何 `process.env.*`** 的树 ⇒ exit 1 且明说「本闸门已失明」
    //    （否则「0 处未登记」会被读成「都登记了」—— 本项目反复治过的「0 对象却全绿」）
    const bl = path.join(dir, 'blind');
    mk(path.join(bl, 'lib')); mk(path.join(bl, 'scripts'));
    wf(path.join(bl, 'lib', 'a.mjs'), 'export const x = 1;\n');
    wf(path.join(bl, 'scripts', 'b.mjs'), 'export const y = 2;\n');
    const gateBl = copyGate('check-env-overrides.mjs', bl);
    const r4 = await run(NODE, [gateBl]);
    expectBlind(r4, N_BLIND, 'check-env-overrides 失明守卫');
    assert.ok(!r4.out.includes('未登记 0 处'),
      `失明时不该打印像「未登记 0 处」的绿灯口径\n${r4.out.slice(0, 900)}`);
  } finally { rm(dir); }
});

test('★自证 check-env-overrides：短路判据① / 判据② 后，各自的正向断言必须变红', async () => {
  const dir = path.join(TMP, 'mut-envreg');
  const N_UNREG = '处**未登记**的 process.env';
  const N_GONE = '个**已登记的覆盖点消失**';
  try {
    // 判据① 自证：把「未登记」集合短路成空数组（`const unregistered = …` ⇒ `[]`）
    const a = path.join(dir, 'a');
    const ga = copyEnvregCorpus(a);
    fs.appendFileSync(path.join(a, 'lib', 'aspects.mjs'), '\nconst PROBE = process.env.LEMO_ZZZ_PROBE;\n');
    mutateFile(path.join(SCRIPTS, 'check-env-overrides.mjs'), ga,
      'const unregistered = hits.filter((h) => !known.has(h.name));', 'const unregistered = [];');
    const ra = await run(NODE, [ga]);
    assert.throws(() => expectBlind(ra, N_UNREG, 'mut'),
      undefined, '短路判据① 后正向断言竟然还通过 ⇒ 断言没在测那条判据');

    // 判据② 自证：把「登记点消失」的判据短路成恒假
    const b = path.join(dir, 'b');
    const gb = copyEnvregCorpus(b);
    const vf = path.join(b, 'lib', 'voices.mjs');
    fs.writeFileSync(vf, fs.readFileSync(vf, 'utf8').replace(/process\.env\.LEMO_VOICE_TEST_TMP/g, 'VOICE_TEST_TMP_FALLBACK'));
    mutateFile(path.join(SCRIPTS, 'check-env-overrides.mjs'), gb,
      'if (!extract(codeOnly(txt)).some((h) => h.name === name)) {', 'if (false) {');
    const rb = await run(NODE, [gb]);
    assert.throws(() => expectBlind(rb, N_GONE, 'mut'),
      undefined, '短路判据② 后正向断言竟然还通过 ⇒ 断言没在测那条判据');
  } finally { rm(dir); }
});

// ── 12b-2. check-env-overrides.mjs · **库仓侧「表 ↔ 代码」一致性**（2026-10-07 扩展）──
// ★ 为什么这里用**手写的合成库仓**、而 12b 用「整棵拷真实语料」：库仓是**另一个仓**
//   （`D:/lemo-opuscar`），本套件**不能假设它存在**（别人的机器 / CI 上可能没有）；
//   而库仓侧的四条判据（⑤⑥⑦⑧）只依赖「一棵有 `core/**` + `tools/**` + `core/README.md` 表的树」，
//   手写最小树**不碰** 12b 那张 100 对的登记表 ⇒ 不会退化成「把登记表抄第二遍」。
const LIB_OK = '✓ 判据⑤·';
const LIB_MISS = '判据⑤·库仓 core/** 与 tools/** 里有';
const LIB_BLIND = '本闸门已失明（库仓侧）';
/**
 * 合成最小库仓：`core/**` 用**三种抽取器各读一个**（`.mjs` / shell / python），
 * `tools/**` 读一个（**2026-10-07 起并入判据⑤ ⇒ 也必须登记进表**，写在 `### tools/ ...` 小节里），
 * 表里另有一个「列了但代码不读」的（判据⑥ 只列不判）。
 */
const miniLib = (root) => {
  wf(path.join(root, 'core', 'README.md'),
    '# 合成库仓\n\n## Environment variables\n\n| Variable | Meaning |\n|---|---|\n'
    + '| `LEMO_AAA` | a |\n| `LEMO_BBB` | b |\n| `LEMO_CCC` | c |\n'
    + '| `LEMO_UNREAD` | 表里列了但代码不读（⇒ 判据⑥ 只列 ℹ） |\n'
    + '\n### `tools/` environment variables\n\n| Variable | Meaning |\n|---|---|\n'
    + '| `LEMO_TOOLONLY` | tools 侧读的（⇒ 2026-10-07 起判据⑤ 同判 FAIL，必须登记） |\n');
  wf(path.join(root, 'core', 'a.mjs'), 'export const a = process.env.LEMO_AAA;\n');
  wf(path.join(root, 'core', 'render', 'mux.sh'), 'B="${LEMO_BBB:-x}"\n');
  wf(path.join(root, 'core', 'tts', 't.py'), "import os\nC = os.environ.get('LEMO_CCC')\n");
  wf(path.join(root, 'tools', 'x.sh'), 'T="${LEMO_TOOLONLY:-y}"\n');
  return root;
};
/** 把 `core/README.md` 里某一行变量行删掉（变异A）。 */
const dropLibTableRow = (libRoot, name) => {
  const p = path.join(libRoot, 'core', 'README.md');
  const re = new RegExp(`^\\|\\s*\`${name}\`\\s*\\|`);
  const kept = fs.readFileSync(p, 'utf8').split('\n').filter((l) => !re.test(l));
  wf(p, kept.join('\n'));
};

test('check-env-overrides·库仓侧：表↔代码一致 ⇒ 绿；删表行 / 加新变量 / 失明 ⇒ 红；不可达 ⇒ 只 ℹ', async () => {
  const dir = path.join(TMP, 'envreg-lib');
  try {
    // ① 阴性对照：合成库仓的**表与代码一致**（core 三种抽取器 + `tools/**` 侧**都已登记**）⇒ exit 0，
    //    判据⑤ 打 ✓ 且**作用域含 tools/**；判据⑥ 把「表里多列」**逐条列出**（否则那条 ℹ 是空转的）。
    const neg = path.join(dir, 'neg');
    const gateNeg = copyEnvregCorpus(neg);
    const r0 = await run(NODE, [gateNeg], { env: { LEMO_OPUSCAR: miniLib(path.join(dir, 'lib-neg')) } });
    expectClean(r0, LIB_MISS, '库仓侧 阴性对照');
    assert.ok(r0.out.includes(LIB_OK) && r0.out.includes('与 tools/** 里代码真在读的'),
      `阴性对照应真的跑过判据⑤、且作用域含 tools/**\n${r0.out.slice(-1600)}`);
    assert.ok(r0.out.includes('LEMO_UNREAD'),
      `判据⑥ 应逐条列出「表里多列」\n${r0.out.slice(-1600)}`);

    // ② 变异 A（表里删一个**真在用**的变量行）⇒ 判据⑤ 必须报出、并点名那个变量 + 读它的文件。
    const a = path.join(dir, 'a');
    const gateA = copyEnvregCorpus(a);
    const libA = miniLib(path.join(dir, 'lib-a'));
    dropLibTableRow(libA, 'LEMO_BBB');
    const r1 = await run(NODE, [gateA], { env: { LEMO_OPUSCAR: libA } });
    expectBlind(r1, LIB_MISS, '库仓侧 变异A（删表行）');
    assert.ok(r1.out.includes('LEMO_BBB') && r1.out.includes('core/render/mux.sh'),
      `判据⑤ 应点名变量 + 读它的文件\n${r1.out.slice(-1600)}`);

    // ③ 变异 B（`core/*.mjs` 里加一个新变量）⇒ 判据⑤ 必须报出。
    const b = path.join(dir, 'b');
    const gateB = copyEnvregCorpus(b);
    const libB = miniLib(path.join(dir, 'lib-b'));
    fs.appendFileSync(path.join(libB, 'core', 'a.mjs'), '\nconst PROBE = process.env.LEMO_ZZZ_PROBE;\n');
    const r2 = await run(NODE, [gateB], { env: { LEMO_OPUSCAR: libB } });
    expectBlind(r2, LIB_MISS, '库仓侧 变异B（加新变量）');
    assert.ok(r2.out.includes('LEMO_ZZZ_PROBE'), `判据⑤ 应点名新变量\n${r2.out.slice(-1600)}`);

    // ④ 失明守卫：库仓**可达**、表也在，但 `core/**` 一个 env 读取点都没有 ⇒
    //    **必须 FAIL 并明说「本闸门已失明（库仓侧）」**（否则「0 个未登记进表」会被读成「表全对」）。
    //    ★ 给一棵**有 `tools/**` 待扫文件、但它不读 env** 的树 ⇒ 只有 **core 侧**失明这条能触发
    //      （否则 `tools/**` 0 文件那条新守卫会替它触发 ⇒ 这条断言就不再真的在测 core 失明）。
    const bl = path.join(dir, 'blind');
    const gateBl = copyEnvregCorpus(bl);
    const libBl = path.join(dir, 'lib-blind');
    wf(path.join(libBl, 'core', 'README.md'),
      '# 合成库仓\n\n## Environment variables\n\n| Variable | Meaning |\n|---|---|\n| `LEMO_X` | x |\n');
    wf(path.join(libBl, 'core', 'a.mjs'), 'export const x = 1;\n');
    wf(path.join(libBl, 'tools', 'x.sh'), 'echo hi\n');
    const r3 = await run(NODE, [gateBl], { env: { LEMO_OPUSCAR: libBl } });
    expectBlind(r3, LIB_BLIND, '库仓侧 失明守卫');
    assert.ok(r3.out.includes('已失明（库仓侧）** ✘'),
      `失明时汇总行必须带 ✘（不能只留一句「未登记进表 0 个」像绿灯）\n${r3.out.slice(-1600)}`);

    // ⑤ 库仓**不可达**（`LEMO_OPUSCAR` 指空目录）⇒ **只打一行 ℹ、不判 FAIL**（exit 0）。
    //    ★ 这条与 ④ 是一对：不可达 = ℹ，可达却扫不到 = FAIL。两条都测才说明守卫不是「永远 exit 1」。
    const na = path.join(dir, 'na');
    const gateNa = copyEnvregCorpus(na);
    const r4 = await run(NODE, [gateNa], { env: { LEMO_OPUSCAR: path.join(dir, 'no-such-library') } });
    expectClean(r4, LIB_BLIND, '库仓侧 不可达');
    assert.ok(r4.out.includes('**不检查**：库仓不可达'),
      `不可达应打一行 ℹ 说明不检查\n${r4.out.slice(-1600)}`);
  } finally { rm(dir); }
});

// ── 12b-3. check-env-overrides.mjs · **`tools/**` 并入判据⑤**（2026-10-07 二次扩展）──
// ★ 由来：`tools/**` 原先是「判据⑦ 只列不判」⇒ 缺口（缺的是 `tools/` 的**文档**）**可见但挡不住**。
//   定案：补文档（`core/README.md` 的 `### tools/ environment variables` 小节）**并**把 `tools/**`
//   并入判据⑤（同判 FAIL）。本用例测的正是「并入之后**真的能核**」，而不是「打印一行就算数」。
test('check-env-overrides·库仓侧 tools/**：已登记 ⇒ 绿；删工具行 / 加工具变量 ⇒ 红；摘掉 tools 作用域 ⇒ 重新变绿', async () => {
  const dir = path.join(TMP, 'envreg-tools');
  // ★ 反向验证用：只摘掉「toolsVars ⇒ lib.missing」这一行（`scope: 'tools'` 全仓唯一）。
  const TOOLS_LINE = "    if (!lib.table.vars.has(n)) lib.missing.push({ name: n, rels: [...rels], scope: 'tools' });";
  const TOOLS_OFF = '    // ★ 反向验证用：摘掉 tools 作用域（不判 FAIL）';
  try {
    // ① 阴性对照：`tools/x.sh` 读的 `LEMO_TOOLONLY` 写在 `### tools/ ...` 小节里 ⇒ exit 0。
    const neg = path.join(dir, 'neg');
    const gNeg = copyEnvregCorpus(neg);
    const r0 = await run(NODE, [gNeg], { env: { LEMO_OPUSCAR: miniLib(path.join(dir, 'lib-neg')) } });
    expectClean(r0, LIB_MISS, 'tools 侧 阴性对照');

    // ② 变异 A′：删掉新小节里的 `LEMO_TOOLONLY` 行 ⇒ 判据⑤ 必须报出、点名 `[tools]` + 读它的文件。
    const a = path.join(dir, 'a');
    const gA = copyEnvregCorpus(a);
    const libA = miniLib(path.join(dir, 'lib-a'));
    dropLibTableRow(libA, 'LEMO_TOOLONLY');
    const r1 = await run(NODE, [gA], { env: { LEMO_OPUSCAR: libA } });
    expectBlind(r1, LIB_MISS, 'tools 侧 变异A′（删工具行）');
    assert.ok(r1.out.includes('[tools] LEMO_TOOLONLY') && r1.out.includes('tools/x.sh'),
      `判据⑤ 应点名 [tools] + 变量 + 读它的文件\n${r1.out.slice(-1600)}`);

    // ③ 变异 B′：`tools/x.sh` 里加一个**新**变量 ⇒ 判据⑤ 必须报出（原先「只列不判」时这里会**漏**）。
    const b = path.join(dir, 'b');
    const gB = copyEnvregCorpus(b);
    const libB = miniLib(path.join(dir, 'lib-b'));
    fs.appendFileSync(path.join(libB, 'tools', 'x.sh'), 'U="${LEMO_TOOL_PROBE:-z}"\n');
    const r2 = await run(NODE, [gB], { env: { LEMO_OPUSCAR: libB } });
    expectBlind(r2, LIB_MISS, 'tools 侧 变异B′（加工具变量）');
    assert.ok(r2.out.includes('[tools] LEMO_TOOL_PROBE'),
      `判据⑤ 应点名 [tools] LEMO_TOOL_PROBE\n${r2.out.slice(-1600)}`);

    // ④ 反向验证：把 `tools/**` 从判据⑤ **摘掉** ⇒ 上述两个变异**重新变绿**
    //    （否则「报红」可能只是别的东西在报，而不是 tools 作用域本身）。
    const revA = path.join(dir, 'rev-a');
    copyEnvregCorpus(revA);
    const gRevA = patchGate('check-env-overrides.mjs', path.join(revA, 'scripts'), [[TOOLS_LINE, TOOLS_OFF]]);
    const ra = await run(NODE, [gRevA], { env: { LEMO_OPUSCAR: libA } });
    expectClean(ra, LIB_MISS, 'tools 侧 反向（摘掉 tools 作用域）· 变异A′');

    const revB = path.join(dir, 'rev-b');
    copyEnvregCorpus(revB);
    const gRevB = patchGate('check-env-overrides.mjs', path.join(revB, 'scripts'), [[TOOLS_LINE, TOOLS_OFF]]);
    const rb = await run(NODE, [gRevB], { env: { LEMO_OPUSCAR: libB } });
    expectClean(rb, LIB_MISS, 'tools 侧 反向（摘掉 tools 作用域）· 变异B′');

    // ⑤ 失明守卫：`tools/` 目录在、但 **0 个待扫文件** ⇒ FAIL + 「本闸门已失明（库仓侧）」。
    //    ★ 只判「0 个文件」、不判「文件在但 0 个 env 变量」（后者可能是脚本真的不再读 env ⇒ 会误报）。
    const bl = path.join(dir, 'blind');
    const gBl = copyEnvregCorpus(bl);
    const libBl = miniLib(path.join(dir, 'lib-blind'));
    rm(path.join(libBl, 'tools', 'x.sh'));
    const r3 = await run(NODE, [gBl], { env: { LEMO_OPUSCAR: libBl } });
    expectBlind(r3, LIB_BLIND, 'tools 侧 失明守卫');
    assert.ok(r3.out.includes('`tools/**` 下扫到 **0 个待扫文件**'),
      `失明时要点名 tools 0 个待扫文件\n${r3.out.slice(-1600)}`);
  } finally { rm(dir); }
});

test('★自证 check-env-overrides·库仓侧：把判据⑤⑥⑦⑧ 整段摘掉后，变异 A/B 与失明夹具必须重新变绿', async () => {
  const dir = path.join(TMP, 'mut-envreg-lib');
  // 整段替换成空壳（`reachable:false` ⇒ 走「不可达 ⇒ 只 ℹ」那条支）。
  const CUT = /\/\/ ── ★★ 判据 ⑤⑥⑦⑧[\s\S]*?const libFail = lib\.missing\.length > 0 \|\| lib\.blind\.length > 0;/;
  const SHELL = 'const lib = { reachable: false, root: "X", table: { vars: new Map(), section: false, exists: false, file: "X" },'
    + ' missing: [], tableOnly: [], toolsOnly: [], internal: [], blind: [], coreVars: new Map(),'
    + ' coreFiles: [], coreHits: [], toolsHits: [], toolsVars: new Map() };\nconst libFail = false;';
  /** 建「真实语料副本 + 摘掉库仓判据的闸门」。
   *  ★ `patchGate(gateName, outDir, subs)` 的 `outDir` 就是 `scripts/` 目录本身（它自己拼 `<outDir>/<name>`）。 */
  const mkMut = (name, libRoot) => {
    const root = path.join(dir, name);
    copyEnvregCorpus(root);
    const gate = patchGate('check-env-overrides.mjs', path.join(root, 'scripts'), [[CUT, SHELL]]);
    return { gate, lib: libRoot };
  };
  try {
    // ① 变异 A 的夹具 + 摘掉判据的闸门 ⇒ 必须 exit 0（判据没了 ⇒ 缺口不再可见）
    const libA = miniLib(path.join(dir, 'lib-a'));
    dropLibTableRow(libA, 'LEMO_BBB');
    const m1 = mkMut('a', libA);
    const ra = await run(NODE, [m1.gate], { env: { LEMO_OPUSCAR: m1.lib } });
    assert.throws(() => expectBlind(ra, LIB_MISS, 'mut'),
      undefined, '摘掉判据⑤⑥⑦⑧ 后变异A 竟然还报 ⇒ 那条正向断言没在测判据⑤');

    // ② 变异 B 的夹具 + 摘掉判据的闸门 ⇒ 必须 exit 0
    const libB = miniLib(path.join(dir, 'lib-b'));
    fs.appendFileSync(path.join(libB, 'core', 'a.mjs'), '\nconst PROBE = process.env.LEMO_ZZZ_PROBE;\n');
    const m2 = mkMut('b', libB);
    const rb = await run(NODE, [m2.gate], { env: { LEMO_OPUSCAR: m2.lib } });
    assert.throws(() => expectBlind(rb, LIB_MISS, 'mut'),
      undefined, '摘掉判据⑤⑥⑦⑧ 后变异B 竟然还报 ⇒ 那条正向断言没在测判据⑤');

    // ③ 失明夹具 + 摘掉判据的闸门 ⇒ 必须 exit 0（否则「失明守卫」可能是别的东西在报）
    const libBl = path.join(dir, 'lib-blind');
    wf(path.join(libBl, 'core', 'README.md'),
      '# 合成库仓\n\n## Environment variables\n\n| Variable | Meaning |\n|---|---|\n| `LEMO_X` | x |\n');
    wf(path.join(libBl, 'core', 'a.mjs'), 'export const x = 1;\n');
    const m3 = mkMut('blind', libBl);
    const rbl = await run(NODE, [m3.gate], { env: { LEMO_OPUSCAR: m3.lib } });
    assert.throws(() => expectBlind(rbl, LIB_BLIND, 'mut'),
      undefined, '摘掉判据⑤⑥⑦⑧ 后失明夹具竟然还报 ⇒ 失明断言没在测判据⑧');
  } finally { rm(dir); }
});

// ── 12c. check-distill-fields.mjs（`_distill.json` 字段路径的「登记表 + 双向守卫」，2026-10-07 建）──
// ★ 为什么夹具是「**整棵拷真实 `_distill.json` 语料**」而不是手写最小树：判据① 要求「真实数据里出现的
//   **每一条**字段路径都已在登记表里」⇒ 手写最小树等于把 276 条登记表**抄第二遍**（两套口径必然漂移）。
//   拷真实语料则**自洽**（闸门与语料同一快照）—— 这也正是本闸门要守的那件事的反面。
// ★ 本闸门**有**两个覆盖点（`LEMO_DISTILL_ROOT` 风格树 / `LEMO_TOOLS_ROOT` 仓根）⇒ 语料可重定向，
//   但要变异**登记表**本身时，只能「拷闸门 + `LEMO_TOOLS_ROOT` 指回真实仓」（判据② 才找得到那些闸门）。
const copyDistillCorpus = (root) => {
  const dst = path.join(root, 'skills');
  for (const e of fs.readdirSync(path.join(TOOLS, 'lib', 'style-skills'), { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(TOOLS, 'lib', 'style-skills', e.name, '_distill.json');
    if (!fs.existsSync(f)) continue;
    mk(path.join(dst, e.name));
    fs.copyFileSync(f, path.join(dst, e.name, '_distill.json'));
  }
  return dst;
};
/** 把某份 `_distill.json` 改一改（读 → 改 → 写回）。 */
const editDistill = (file, fn) => {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  fn(j);
  wf(file, `${JSON.stringify(j, null, 2)}\n`);
};

test('check-distill-fields：未登记字段 ⇒ FAIL 并点名；删字段不误报；覆盖声明失效 ⇒ FAIL（含失明）', async () => {
  const dir = path.join(TMP, 'distill-fields');
  // 该闸门的三条特有文案（逐字抄自闸门源码）
  const N_UNREG = '条**未登记**的字段路径';
  const N_GONE = '条**覆盖声明失效**';
  const N_BLIND = '本闸门已**失明**';
  try {
    // ① 阴性对照：真实语料副本、**不改动** ⇒ exit 0 且判据①② 都真的跑过（否则「永远 exit 1」也能骗过）
    const neg = copyDistillCorpus(path.join(dir, 'neg'));
    const r0 = await runGate('check-distill-fields.mjs', { LEMO_DISTILL_ROOT: neg });
    expectClean(r0, N_UNREG, 'check-distill-fields 阴性对照');
    assert.ok(r0.out.includes('✓ 判据①·') && r0.out.includes('✓ 判据②·'),
      `阴性对照应真的跑过判据①②\n${r0.out.slice(0, 900)}`);
    assert.ok(/实测 43 个风格 \/ 276 条去重字段路径/.test(r0.out),
      `阴性对照应打印「43 个风格 / 276 条字段路径」\n${r0.out.slice(0, 900)}`);

    // ② 变异 A（判据①）：给某份 json 加一个全新字段 ⇒ FAIL 并**点名 slug + 字段路径**
    const pos = copyDistillCorpus(path.join(dir, 'pos'));
    const slug = fs.readdirSync(pos).sort()[0];
    editDistill(path.join(pos, slug, '_distill.json'), (j) => { j.selfCheck = { ...(j.selfCheck || {}), LEMO_ZZZ_PROBE: 1 }; });
    const r1 = await runGate('check-distill-fields.mjs', { LEMO_DISTILL_ROOT: pos });
    expectBlind(r1, N_UNREG, 'check-distill-fields 判据① 正向');
    assert.ok(r1.out.includes(slug) && r1.out.includes('selfCheck.LEMO_ZZZ_PROBE'),
      `判据① 应点名 slug + 字段路径\n${r1.out.slice(0, 900)}`);

    // ③ 变异 B（判据②）：把某条 `coveredBy` 改成**不存在的闸门名** ⇒ FAIL 并点名那个名字 + 字段路径
    //    ★ 闸门拷到临时目录 ⇒ 必须把 `LEMO_TOOLS_ROOT` 指回**真实仓**（判据② 在那里找 `scripts/<闸门>.mjs`）。
    const gateB = patchGate('check-distill-fields.mjs', path.join(dir, 'mut-b'),
      [["coveredBy: 'check-skill-artifacts.mjs'", "coveredBy: 'check-zzz-not-exist.mjs'"]]);
    const r2 = await run(NODE, [gateB], { env: { LEMO_TOOLS_ROOT: TOOLS } });
    expectBlind(r2, N_GONE, 'check-distill-fields 判据② 正向');
    assert.ok(r2.out.includes('check-zzz-not-exist.mjs') && r2.out.includes('generatedVideo.'),
      `判据② 应点名闸门名 + 字段路径\n${r2.out.slice(0, 900)}`);

    // ④ 变异 C（**语义**）：把某条**已登记为有闸门**的字段从**全部** json 里删掉 ⇒ 仍 exit 0
    //    —— 确认判据② 的语义是「登记了但**闸门**不在了才红」，**不是**「字段消失了就红」。
    const c = copyDistillCorpus(path.join(dir, 'c'));
    for (const s of fs.readdirSync(c)) editDistill(path.join(c, s, '_distill.json'), (j) => { if (j.selfCheck) delete j.selfCheck.muxEncoder; });
    const r3 = await runGate('check-distill-fields.mjs', { LEMO_DISTILL_ROOT: c });
    expectClean(r3, N_GONE, 'check-distill-fields 变异 C（删字段）');
    assert.ok(/实测 43 个风格 \/ 275 条去重字段路径/.test(r3.out) && r3.out.includes('✓ 判据②·'),
      `变异 C 应显示 275 条、且判据② 不响\n${r3.out.slice(0, 900)}`);

    // ⑤ 失明三态（防空转绿灯）：空风格树 / 数据里 0 字段 / 登记表为空 ⇒ **均** exit 1 +「本闸门已**失明**」
    const empty = path.join(dir, 'blind-empty');
    mk(empty);
    const rb1 = await runGate('check-distill-fields.mjs', { LEMO_DISTILL_ROOT: empty });
    expectBlind(rb1, N_BLIND, 'check-distill-fields 失明①（空风格树）');
    assert.ok(!rb1.out.includes('判据①·') && !rb1.out.includes('判据②·'),
      `失明时不该输出判据①②\n${rb1.out.slice(0, 900)}`);

    const zero = copyDistillCorpus(path.join(dir, 'zero'));
    for (const s of fs.readdirSync(zero)) wf(path.join(zero, s, '_distill.json'), '{}\n');
    const rb2 = await runGate('check-distill-fields.mjs', { LEMO_DISTILL_ROOT: zero });
    expectBlind(rb2, N_BLIND, 'check-distill-fields 失明②（数据里 0 字段）');

    // ★ 清空登记表：把 `const FIELDS = {` 收成 `{}`，原登记表体改挂到一个死变量上（保持语法有效）。
    const gateZ = patchGate('check-distill-fields.mjs', path.join(dir, 'mut-zero'),
      [['const FIELDS = {', 'const FIELDS = {};\nconst __DEAD = {']]);
    const rb3 = await run(NODE, [gateZ], { env: { LEMO_TOOLS_ROOT: TOOLS } });
    expectBlind(rb3, N_BLIND, 'check-distill-fields 失明③（登记表为空）');
  } finally { rm(dir); }
});

test('★自证 check-distill-fields：短路判据① / 判据② 后，各自的变异必须重新变绿', async () => {
  const dir = path.join(TMP, 'mut-distill-fields');
  const N_UNREG = '条**未登记**的字段路径';
  const N_GONE = '条**覆盖声明失效**';
  try {
    // 判据① 自证：把「未登记」集合短路成空数组 ⇒ 变异A 必须重新变绿
    const a = copyDistillCorpus(path.join(dir, 'a'));
    const slug = fs.readdirSync(a).sort()[0];
    editDistill(path.join(a, slug, '_distill.json'), (j) => { j.selfCheck = { ...(j.selfCheck || {}), LEMO_ZZZ_PROBE: 1 }; });
    const ga = patchGate('check-distill-fields.mjs', path.join(dir, 'ga'),
      [['const unregistered = [...real.keys()].filter((p) => !FIELDS[p]).sort();', 'const unregistered = [];']]);
    const ra = await run(NODE, [ga], { env: { LEMO_DISTILL_ROOT: a, LEMO_TOOLS_ROOT: TOOLS } });
    assert.throws(() => expectBlind(ra, N_UNREG, 'mut'),
      undefined, '短路判据① 后变异A 竟然还报 ⇒ 那条正向断言没在测判据①');

    // 判据② 自证：把「遍历登记表」短路成空 ⇒ 变异B 必须重新变绿
    const gb = patchGate('check-distill-fields.mjs', path.join(dir, 'gb'),
      [["coveredBy: 'check-skill-artifacts.mjs'", "coveredBy: 'check-zzz-not-exist.mjs'"],
        ['for (const [p, ent] of Object.entries(FIELDS)) {\n  if (!ent || !ent.coveredBy) continue;',
          'for (const [p, ent] of []) {\n  if (!ent || !ent.coveredBy) continue;']]);
    const rb = await run(NODE, [gb], { env: { LEMO_TOOLS_ROOT: TOOLS } });
    assert.throws(() => expectBlind(rb, N_GONE, 'mut'),
      undefined, '短路判据② 后变异B 竟然还报 ⇒ 那条正向断言没在测判据②');
  } finally { rm(dir); }
});

// ── 跑 ──────────────────────────────────────────────────────────────────────
async function main() {
  rm(TMP);
  mk(TMP);
  log(C.b(`\ntest/gate-blindness.test.mjs —— 闸门「守卫 + 核心判据」回归套件（${cases.length} 条）\n`));
  const t0 = Date.now();
  const results = [];
  try {
    for (const c of cases) {
      const s = Date.now();
      try {
        await c.fn();
        results.push({ name: c.name, ok: true });
        log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
      } catch (e) {
        results.push({ name: c.name, ok: false });
        log(`  ${C.bad('FAIL')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
        for (const line of String((e && e.message) || e).split('\n')) log(`        ${line}`);
      }
    }
  } finally {
    rm(TMP);   // ★ 按确切路径清理整棵临时树，不留垃圾
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  log('');
  log('─'.repeat(64));
  if (failed.length) {
    log(C.bad(`  ${passed} passed, ${failed.length} failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
    for (const f of failed) log(C.bad(`  ✗ ${f.name}`));
  } else {
    log(C.ok(`  ${passed} passed, 0 failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
  }
  log('─'.repeat(64));
  log('');
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  try { rm(TMP); } catch { /* ignore */ }
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
