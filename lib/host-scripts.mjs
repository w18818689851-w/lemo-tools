// lib/host-scripts.mjs —— 宿主临时脚本（`D:\WSL` 下的 `*.sh`）的「登记 / 退出兜底 / 启动清扫」**唯一实现**
//
// ★ 由来（本机实测）：编排器、`lib/env.mjs` 与 `lib/dub-core.mjs` 的 `runWsl` 都会先在 `D:\WSL`
//   写一份宿主 .sh（文件名 `<name>-<pid>-<base36>.sh`，`lib/dub-core.mjs` 那份多一个 `-<seq>-` 段，
//   见下面的前缀判据注释）再 spawn `wsl.exe`。那份文件有三条收尾路径，其中**硬杀**那条
//   谁都覆盖不了：
//     · `taskkill /PID <pid> /T /F`（`lib/jobs.mjs` 的 `killTree()` 原样命令）是 TerminateProcess、
//       **不可捕获** ⇒ `finally` **不执行**，`process.on('exit')` 钩子**也不执行**；
//     · `process.exit(130)`（编排器 `:1919` 的 SIGINT/SIGTERM 收尾）同步终止 ⇒ 未恢复的 `finally`
//       不执行，但 `process.on('exit')` 钩子**会**执行。
//   ⇒ 三层各治一类，缺一不可：
//     ① 本模块的 `process.on('exit')` 钩子（治正常退出 / `process.exit()` 那一类）；
//     ② 本模块的 `sweepStaleHostScripts`（**唯一能治硬杀的办法** —— 也是 `_lemo-probe-*` /
//        `_web-probe-*` 日增的真正来源）；
//     ③ 调用方 `runWsl` 的 `finally`（治「父进程活着、await 能恢复」的全部结局）。
//
// ★ 为什么**新建本文件**、而不是塞进 `lib/env.mjs` 导出（落点理由）：
//   · `lib/env.mjs` 被 15+ 个模块与测试 import（`lib/briefs.mjs` 明确记着「env.mjs 顶层无副作用」，
//     `test/gate-blindness.test.mjs` 还会整棵拷树后 import 它）⇒ 往它里面塞「删文件」的顶层副作用
//     会污染那些上下文；
//   · 本模块要被编排器（红线）与 `lib/env.mjs` **共用**；落点若在 `lib/env.mjs`，则编排器要
//     import env.mjs、env.mjs 又要 import 本模块 ⇒ **成环**；
//   · 独立文件还能让「前缀判据 / 文件名解析 / pid 判活 / mtime 判据」这四条**只写一处**
//     （本项目铁律：同一判据只写一处）。
//
// ★ 安全底线（都不许破）：
//   · 只删「前缀是本人 ∧ 文件名形如 `<name>-<pid>-<base36>.sh` 或 `<name>-<pid>-<seq>-<base36>.sh`」
//     的文件；其余一律不碰。实测同目录下还有 `st-setup-inline-*`（6 个，**不是本仓产出**）、
//     `shot.sh` / `probe1.sh` / `fetch-all-fonts.sh` 等**别的模块/手写**的脚本 —— 全部不在判据内；
//   · `D:\WSL\lemo-lib-sync.sh` 是**持久输入文件**（编排器 `:2095` 读它、`lib/setup.mjs` 也用它），
//     文件名**没有** `-<pid>-<b36>` 后缀 ⇒ 天然不匹配下面的正则 ⇒ **永不会被删**；
//   · pid 判活的一切失败方向都是「保留」；mtime 比本次启动新的**绝不动**。

import fs from 'node:fs';
import path from 'node:path';

/** 与编排器的 `C.dim` 同一条转义（本仓没有共享颜色模块，`lib/jobs.mjs` 也是各自定义一份）。 */
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

// ── 前缀判据（★ 全仓唯一一处）─────────────────────────────────────────────────
// 覆盖 `runWsl(` 机械枚举出的**全部** name 值。枚举命令（三条，都在本仓跑过）：
//   grep -n "runWsl(" lemo-make.mjs lib/env.mjs
//   grep -n "name: *'" lemo-make.mjs lib/env.mjs
//   grep -n "name: *['\`]" lib/dub-core.mjs dub.mjs lib/triple-check.mjs
// ① `lemo-make.mjs` 的 `runWsl`（14 个字面量 + 1 个模板）：
//   `_lemo-orch`（`:152` 的默认值）· `_lemo-symlink-probe`（`:229`）· `_lemo-preflight`（`:719`）·
//   `_lemo-probe`（`:1939`）· `_lemo-core-hash`（`:1999`）· `lemo-lib-sync`（`:2099`）·
//   `_lemo-paper`（`:2154`）· `_lemo-artifacts`（`:2355`）· `_lemo-subs-py`（`:2395`）·
//   `_lemo-voice`（`:2979`）· `_lemo-voices-back`（`:3009`）· `_lemo-audio`（`:3031`）·
//   `_lemo-mux`（`:3266`）· `_lemo-${scratchName}`（`:3755`，实参只有 `'review'`/`'storyboard'`
//   两个，见 `:3645`/`:3791`）—— 以上**全部**落在 `_lemo-*` 与 `lemo-lib-sync` 两个前缀里。
// ② `lib/env.mjs` 的 `runWsl` 默认名 `_web-probe`（`:138`，并在 `:508` `:531` `:551` 三处显式传它）
//   —— ★ 本批之前它被**故意排除**，而它才是残留增长的**主力**（对抗式验证报告实测 `D:\WSL` 下 47 个，
//      比 `_lemo-*` 的 6 个多得多）。
// ③ ★★ 2026-10-12 本批补的**第三个入口**：`lib/dub-core.mjs` 的 `runWsl`（`:520`，默认名 `dub`）。
//   ★ 它的产出前缀**不止 `dub-*`** —— 该实现被三个文件共用（`grep -rn "from './dub-core.mjs'"` 实测：
//     `dub.mjs:34` / `lib/triple-check.mjs:53`；`server.mjs:32` 只 import `probe`/`winToWsl`，不调 runWsl），
//     故前缀 = 三个文件里 `name:` 的**机械并集**（`grep -n "name:" 这三个文件 | grep -v "name: *['\`]"` 实测
//     **为空** ⇒ 全是字面量、无变量/模板 ⇒ 这个并集是完备的）：
//     · `lib/dub-core.mjs`：`dub`（`:520` 默认值）· `probe`（`:977`）· `measure`（`:1018`）·
//       `vad`（`:1266`）· `dub-asr`（`:1443`）
//     · `dub.mjs`：`dub-cap`（`:360`/`:1005`）· `dub-ko-mux`（`:392`）· `dub-ko-audio`（`:421`）·
//       `dub-frame`（`:472`/`:1199`）· `dub-visual`（`:634`）· `dub-tts`（`:951`）· `dub-mix`（`:1049`）·
//       `dub-audio`（`:1054`）· `dub-gain`（`:1089`）· `dub-mux`（`:1159`）
//     · `lib/triple-check.mjs`：`triple-probe`（`:401`）· `triple-frame`（`:522`）
//   ⇒ 落成 `dub` / `dub-*` / `probe` / `measure` / `vad` / `triple-*` 六个形态（见下面正则）。
//   ★ 实测（`D:\WSL` 现存）：`dub-tts-*` **16** 个 · `dub-ko-mux-*` **1** 个 · `probe-14936-1-…` **1** 个，
//     跨 **10 天**（最早 2026-10-02）且**会话内仍在新增** ⇒ 与 ② 同一个缺陷类的第三个入口。
//   ★ `st-setup-inline-*`（6 个）**不是本仓产出**（全仓 `grep -rn "st-setup-inline"` 只命中本文件与
//     `test/README.md` 的**散文**，无任何产出点）⇒ **故意不纳入**；`res-*`（`lib/resources.mjs` 经
//     `lib/env.mjs` 的 runWsl 产出，`lib/resources.mjs:771`/`:788`）**不在本批范围**（那是 ② 的调用方，
//     不是 ③ 的产出）⇒ 也**故意不纳入**。两者都只登记、不判。
// ★ 两种命名形状都要认（★ 2026-10-12 补：第三个入口比前两个**多一段**）：
//     ① `<prefix>-<pid>-<base36>.sh` —— `lemo-make.mjs` / `lib/env.mjs` 的 runWsl
//        （`${name}-${process.pid}-${Date.now().toString(36)}`）
//     ② `<prefix>-<pid>-<seq>-<base36>.sh` —— `lib/dub-core.mjs` 的 runWsl（`:522`）
//        （`${name}-${process.pid}-${(wslSeq++).toString(36)}-${Date.now().toString(36)}`）
//        ★ `seq` 走 `toString(36)` ⇒ **可能是纯数字**（`D:\WSL` 实测样例 `dub-tts-13880-0-muqu0h0i.sh`
//          的 `seq` 就是 `0`）⇒ 若按「最后一个 `-<数字>-`」解析，pid 会被解析成那个 `seq`。
//          ★ 实测后果（本机）：同形态在**贪婪**判据下 pid 解析成 **0**，而 `process.kill(0,0)`
//            在本机**成功**（实测 ⇒ 判「活」）⇒ 那批文件**永远**落到「pid 存活 ⇒ 保留」，
//            只能靠 6h 兜底 —— 即 N1 发现 1 那条 pid 复用病根的**重演**。
// ★ 因此 pid 段取**从左边数第一个** `-<数字>-`（量词改**惰性** `[\w.-]*?`）⇒ 两种形状都取到真 pid。
//   ★ 前提（已机械核实）：本模块认的全部 name **没有一个含数字段** —— ① 的 14 个 + ② 的 1 个
//     + `scratchName` 的两个实参（`'review'`/`'storyboard'`）+ ③ 的 17 个，全是字母与连字符
//     ⇒ 惰性不会提前停在 name 中间。
//     ★ 已知边界（**没有闸门守**，故写在这里）：若将来有人用 `name: '_lemo-2'` 这种**以数字段结尾**
//       的名字，第一段数字就会被当 pid；届时这条注释是唯一提示。
// ★ `dub` 必须**单列在 `dub-[\w.-]*?` 之前**（★ 顺序有语义，别调换）：
//   `dub(?:-[\w.-]*?)?` 这个写法是错的 —— 外层 `?` 是**贪婪**的（优先 1 次），
//   于是 `dub-4242-7-abc123.sh`（默认名 `dub` + 形状②）会被解析成 prefix=`dub-4242`、**pid=7**（那个 `seq`）。
//   ★ 实测（本机）：`/^dub(?:-[\w.-]*?)?-(\d+)-([0-9a-z]+)(?:-[0-9a-z]+)?\.sh$/` 对上面那串给出 pid=`7`；
//   改成 `dub|dub-[\w.-]*?` 后给出 pid=`4242`。同理，若把 `dub-[\w.-]*?` 排在前面，`dub` 又会被它吃掉 ⇒ pid=7。
const HOST_SCRIPT_RE = /^(?:_lemo-[\w.-]*?|lemo-lib-sync|_web-probe|dub|dub-[\w.-]*?|triple-[\w.-]*?|probe|measure|vad)-(\d+)-([0-9a-z]+)(?:-[0-9a-z]+)?\.sh$/;

/**
 * ★ mtime 兜底阈值：**6 小时** —— 与编排器 `:1906` 的**锁过期**判据（`alive && ageMs < 6 * 3600 * 1000`）
 * 同一个数、同一个口径（「6h 前的东西必然是死的」）。这里不 import 那个常量（它在红线文件里、
 * 且是行内字面量）⇒ 改那处时要**同时**改这里；已由本注释显式登记这层耦合。
 */
const STALE_MS = 6 * 3600 * 1000;

/**
 * 本次进程启动时刻。★ 本模块被**静态 import**（import 声明会被提升到模块体之前求值）⇒
 * 这里取到的就是「启动时刻」，且**任何 runWsl 都还没跑**（编排器首个 runWsl 在 `:1938`）。
 */
const START_MS = Date.now();

/** ① 在飞的宿主 .sh 登记表：`runWsl` 进入时 add、`finally` 里 delete。exit 钩子只能做同步操作，故只存路径。 */
const HOST_SCRIPTS = new Set();

/** ① 退出钩子：正常退出 / `process.exit()` 时把还在飞的宿主 .sh 同步删掉。 */
function flushHostScriptsOnExit() {
  for (const p of HOST_SCRIPTS) { try { fs.unlinkSync(p); } catch { /* 已没了 */ } }
  HOST_SCRIPTS.clear();
}

/**
 * ★ 钩子**首次登记时才挂**（而不是模块顶层无条件挂）：这样「import 本模块」这件事本身**零副作用**，
 *   `lib/env.mjs` 那条被 5 处注释记着的不变量（「env.mjs 顶层无副作用」——`lib/briefs.mjs:67`、
 *   `test/setup-api.test.mjs:41`、`test/ui.test.mjs`（★ 用**符号锚**、不写行号：该文件正被另一批改动，
 *   行号在漂）、`test/voices-api.test.mjs:47`、`test/dub-api.test.mjs:107`）继续成立。★ 仍然**只注册一次**（`hooked` 是模块级布尔；
 *   ESM 模块只求值一次 ⇒ 无论被多少模块 import 都只有一份状态）。
 *   ★ 没有「先 add 后挂钩子」的空窗：两者在同一次同步调用里完成。
 * ★ 硬杀（TerminateProcess）下钩子**不会执行** ⇒ 那一类由 ② 启动清扫兜底。
 */
let hooked = false;

/** ① 登记一个在飞的宿主 .sh（`runWsl` 写盘成功后调用）。 */
export function registerHostScript(p) {
  if (!hooked) { hooked = true; process.on('exit', flushHostScriptsOnExit); }
  HOST_SCRIPTS.add(p);
}

/** ① 摘除登记（**不删盘**：清盘仍归调用方 `finally` 的 `unlinkSync` —— 那份可能早就没了）。 */
export function unregisterHostScript(p) { HOST_SCRIPTS.delete(p); }

/** pid 是否还活着。★ 一切失败方向都归「活着」= 保留。 */
function isPidAlive(pid) {
  try { process.kill(pid, 0); return true; }   // 能发信号 ⇒ 活着
  catch (e) { return e?.code === 'EPERM'; }    // EPERM = 存在但没权限 ⇒ 仍算活着
}

/**
 * ② 启动清扫：删掉**上一次进程**遗留的宿主临时脚本（治硬杀那一类 —— 唯一能覆盖硬杀的办法）。
 *
 * 判据 = **两条的并集**（命中任一条即删）：
 *   (a) **原判据**：pid 已死 ∧ mtime 早于本次启动；
 *   (b) **★ mtime 兜底（与 pid 无关）**：mtime 早于 **6 小时**（`STALE_MS`）。
 * ★ 为什么必须有 (b)（实测，证据见 `D:/lemo-tmp/align-audit/N1-P的三层清扫的对抗式验证.md` §1 发现 1）：
 *   Windows 会**回收 pid** 给 chrome / svchost / lsass / LockApp / conhost …… 对抗式验证报告实测
 *   `D:\WSL` 下 10 个匹配文件里 **9 个**的 pid 已被系统进程复用 ⇒ 单靠 (a) 永远判「ALIVE」⇒ **永不删**
 *   （本机 90% 的残留永久失效）；而旧版「`deleted === 0` 就不打汇总行」⇒ 与「本来就没有陈旧文件」
 *   无法区分（**看不见的漏删**）。
 *   宿主临时脚本的生命周期是「一次 wsl 调用」级（几秒~几分钟）⇒ 6h 前的必然是死文件；且宿主 .sh 的
 *   内容在命令一开始就被 `sed` 读进 `/tmp` 了 ⇒ **即使它其实还在飞，删掉也不影响那次调用**。
 *   并发安全：在飞实例的 mtime 是「刚刚」⇒ (a)(b) 两条都不命中。
 * ★ 日志口径：**没有匹配文件 ⇒ 零输出**（默认行为不变）；**有匹配但全保留 ⇒ 必须打出保留条数与原因**；
 *   `dryRun` 时**说清「仅列出，未删除」**（绝不谎报「清除 N 个」）。
 *
 * @param {{dir:string, dryRun?:boolean}} o `dir` = 宿主临时脚本目录（必传，如 `CFG.tmpDir`）。
 * @returns {{dir:string, scanned:number, matched:number, stale:number, deleted:number,
 *            kept:number, keptAlive:number, keptFresh:number, keptOther:number, dryRun:boolean}}
 */
export function sweepStaleHostScripts({ dir, dryRun = false } = {}) {
  if (!dir) throw new Error('sweepStaleHostScripts: 缺少 dir（宿主临时脚本目录，如 CFG.tmpDir）');
  const out = { dir, scanned: 0, matched: 0, stale: 0, deleted: 0, kept: 0, keptAlive: 0, keptFresh: 0, keptOther: 0, dryRun };
  let names;
  try { names = fs.readdirSync(dir); } catch { return out; }   // 目录不存在 / 读不到 ⇒ 零输出、零删除
  out.scanned = names.length;
  const now = Date.now();
  const hits = [];                                  // 命中删除判据的：先全部收集，再统一删（或只列）
  let keptAlive = 0, keptFresh = 0, keptOther = 0;
  for (const name of names) {
    const m = HOST_SCRIPT_RE.exec(name);
    if (!m) continue;                               // ★ 非本模块前缀 / 形态不符 ⇒ 一律不碰
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }   // 读不到（已没了）⇒ 不当命中
    out.matched++;
    if (!st.isFile()) { keptOther++; continue; }    // 同名目录 / 链接 ⇒ 不动
    const pid = Number(m[1]);
    const dead = !isPidAlive(pid);
    const byPid = dead && st.mtimeMs < START_MS;    // (a) 原判据
    const byAge = now - st.mtimeMs > STALE_MS;      // (b) mtime 兜底（与 pid 无关）
    if (!byPid && !byAge) { (dead ? keptFresh++ : keptAlive++); continue; }
    hits.push({ name, pid, mtimeMs: st.mtimeMs, why: byPid ? `pid ${pid} 已不在` : 'mtime 早于 6h' });
  }
  for (const h of hits) {
    if (dryRun) continue;                           // dry-run：**只列不删**
    try { fs.unlinkSync(path.join(dir, h.name)); out.deleted++; }
    catch { keptOther++; }                          // 删不掉（被占 / 权限）⇒ 算保留，不报错
  }
  out.stale = hits.length;
  out.keptAlive = keptAlive; out.keptFresh = keptFresh; out.keptOther = keptOther;
  out.kept = keptAlive + keptFresh + keptOther;

  // ── 日志（口径：没有匹配文件 ⇒ 零输出）──
  if (out.matched === 0) return out;
  for (const h of hits) {
    const tail = dim(`（${h.why}，mtime ${new Date(h.mtimeMs).toISOString()}）`);
    console.error(dryRun
      ? `    ${dim('[dry-run] 陈旧残留')} ${h.name} ${tail}`
      : `    ${dim('· 清扫陈旧残留')} ${h.name} ${tail}`);
  }
  const keptNote = out.kept
    ? `，保留 ${out.kept} 个（${[
      keptAlive ? `pid 存活 ${keptAlive}` : '',
      keptFresh ? `比本次启动新 ${keptFresh}` : '',
      keptOther ? `非普通文件或删不掉 ${keptOther}` : '',
    ].filter(Boolean).join(' / ')}）`
    : '';
  if (dryRun) {
    console.error(dim(`    · 宿主临时脚本清扫 [dry-run]：匹配 ${out.matched} 个，命中 ${out.stale} 个陈旧残留`
      + ` —— **仅列出，未删除**${keptNote}`));
  } else if (out.deleted || out.kept) {
    console.error(dim(`    · 宿主临时脚本清扫：匹配 ${out.matched} 个，清除 ${out.deleted} 个陈旧残留${keptNote}`));
  }
  return out;
}
