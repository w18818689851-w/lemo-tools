// lib/env.mjs —— 环境自检（**咨询性**，不 gate 任何东西）
//
// ★ 设计原则：真正的闸门只属于编排器（lemo-make.mjs 的 [1] 环境自检 + core/render/ 一致性闸门）。
//   本模块只做「更广的前置检查」，把「能不能跑 / 缺什么 / 怎么补」讲清楚，**绝不阻断**。
//   理由：本项目反复踩过「同一判据写在两处 → 必须同步改 → 漂移」的坑。
//   所以这里连「core/render/ 是否一致」都不重复实现 —— 那是编排器的职责。
//
// ★ 路径常量必须与 lemo-make.mjs 的 CFG 保持一致。为了不靠人记，本模块启动时
//   会**读编排器的 CFG 块做漂移自检**（driftCheck），不一致就报 warn。

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// ★ 风格源码根的唯一解析实现（纯函数，不 import env ⇒ 不成环，见该模块头部说明）。
import { resolveStylesRoot } from './styles-root.mjs';

const ORCH = 'D:\\lemo-tools\\lemo-make.mjs';

// ── 与 lemo-make.mjs 的 CFG 镜像 ─────────────────────────────
export const CFG = {
  wslDistro: 'Ubuntu-24.04',
  wslUser: 'lemo',
  // ★ 库根（两侧各一处）：认 `LEMO_LIB_WSL` / `LEMO_LIB_WIN` —— 与编排器 `lemo-make.mjs` 的
  //   `CFG.wslLib` / `CFG.winLib` **同名同义、同默认值**（2026-10-09 收敛，见下方 exportDir 注释段的订正）。
  //   ★ 不设这两个变量时，取值**逐字节等于**原硬编码字面量（`'/home/lemo/lemo-opuscar'` / `'D:\\lemo-opuscar'`）⇒ 生产态零影响。
  wslLib: process.env.LEMO_LIB_WSL || '/home/lemo/lemo-opuscar',
  winLib: process.env.LEMO_LIB_WIN || 'D:\\lemo-opuscar',
  tmpDir: 'D:\\WSL',
  // ★ 成片根：**唯一**口径 —— 覆盖点 `LEMO_FILM_DIR`。
  //   不设时**逐字节等价于**原硬编码字面量 `'D:\\lemo-films'`；设了就 `path.resolve` 它。
  //   由来：`.console`（lib/store.mjs）早就认这个变量，而本模块硬编码 ⇒ 同一个「成片根」两套口径，
  //   于是从 CFG.exportDir 派生的 `.briefs` / `_jobs` / `dub` 无法在临时树上隔离
  //   （实测：并行的两个 test/briefs.test.mjs 会共享 `D:\lemo-films\.briefs` 而互撞）。
  //   变量名与默认值与 `lib/store.mjs` / `scripts/prune-jobs.mjs` 的 FILM_DIR **同名同义**。
  exportDir: process.env.LEMO_FILM_DIR ? path.resolve(process.env.LEMO_FILM_DIR) : 'D:\\lemo-films',
  // ★★ 边界（2026-10-07 登记，**已知且有意**）：覆盖点 `LEMO_FILM_DIR` **对编排器 `lemo-make.mjs` 无效** ——
  //   编排器的 `exportDir` 是硬编码字面量（它是**红线文件**，改动要同步 `test/cases.mjs` 的 `ORCH_MD5`
  //   与 `test/README.md` 的表值两处）。⇒ 设了本覆盖点时，`scripts/style-distill.mjs` /
  //   `scripts/unblock-placeholder-audio.mjs`（它们已收敛到读 `CFG.exportDir`）找成片的路径，
  //   与它们 **spawn 出来的编排器**写盘路径**会分叉**。**不设覆盖点（生产态）时恒一致** ⇒ 对生产零影响；
  //   该覆盖点的用途只是「让测试在临时树上隔离」（如 `test/briefs.test.mjs` 的每进程隔离）。
  //   ★ 另：本模块的 `wslLib` / `wslDistro` **有意不设覆盖点** —— 目前没有任何消费方需要在临时树上重定向
  //     WSL 库根（`scripts/patch-style-mux.mjs` 自己认 `LEMO_WSL_ROOT` / `LEMO_WSL_DISTRO`，
  //     `scripts/check-dual-copy-sync.mjs` 另有同名的闸门内覆盖点）。
  //   ★★ **原记（2026-10-07 b85-c 订正，我上一句的理由是错的）**：原文写「给它们加覆盖点会让 `driftCheck()`
  //     对编排器产生漂移告警」—— **不成立**。实测（核法：拿 `driftCheck` 的正则
  //     `${key}\s*:\s*'([^']*)'` 逐个去匹配 `lemo-make.mjs` 源码）：
  //       `wslDistro` → `Ubuntu-24.04` ✓ / `wslUser` → `lemo` ✓ / `tmpDir` → `D:\WSL` ✓ / `exportDir` → `D:\lemo-films` ✓
  //       而 **`wslLib` 与 `winLib` → `null`（读不到）** —— 因为编排器写的是
  //       `wslLib: process.env.LEMO_LIB_WSL || '/home/lemo/lemo-opuscar'` / `winLib: process.env.LEMO_LIB_WIN || 'D:\\lemo-opuscar'`，
  //       **不是纯字符串字面量** ⇒ **`driftCheck()` 对这两个 key 读不到值**（旧版**静默跳过**；★ 2026-10-10 已改为报「无法判定」告警，见 `driftCheck`）。
  //     ⇒ 真正该记的是另一件事：**编排器自己认 `LEMO_LIB_WIN` / `LEMO_LIB_WSL`，而本模块的
  //       `CFG.winLib` / `CFG.wslLib` 不认** ⇒ 「**库根**」有两个口径（与「风格源码根」「成片根」已收敛的情况不同）；
  //       生产态（不设这两个变量）恒一致，**只在使用覆盖点做测试时**才可能分叉。
  //       ★ 若要收敛：让本模块也认 `LEMO_LIB_WIN`（与编排器**同名同义**），再让
  //       `consistency-check.mjs:21` 的 `LIB` 改读 `CFG.winLib` ⇒ 库根收成一处。**代价**：`CFG.winLib` 是底层，
  //       会连带 `checkEnv()` 的 `lib.win` 判定与全部消费方 ⇒ 必须回归。**本次未做（已登记为待办）。**
  //       ★★ **2026-10-09 订正（上面那条待办已做掉）**：本模块的 `CFG.wslLib` / `CFG.winLib` 已改为
  //          `process.env.LEMO_LIB_WSL || '/home/lemo/lemo-opuscar'` / `process.env.LEMO_LIB_WIN || 'D:\\lemo-opuscar'`
  //          —— 与编排器**同名同义、同默认值**（不设时逐字节等于原硬编码字面量 ⇒ 生产态零影响）；
  //          且 `consistency-check.mjs` 的 `LIB` 已改读 `CFG.winLib`（不再自己算一份）⇒ **库根收成一处**。
  //          ★ 已回归：`checkEnv()` 的 `lib.win` 判定 + 全部消费方（`dub.mjs` / `lib/aspects.mjs` / `lib/langs.mjs` /
  //          `lib/sizes.mjs` / `lib/voices.mjs` / `lib/resources.mjs` / `lib/dub-core.mjs` / `lib/setup.mjs` /
  //          `server.mjs` / `scripts/patch-style-mux.mjs` / `scripts/style-distill.mjs` / `scripts/style-skill-check.mjs` /
  //          `scripts/unblock-placeholder-audio.mjs` / `test/cases.mjs`）—— 见 `scripts/check-env-overrides.mjs` 的 readers 登记。
  //          ★ 本模块因此**成了** `LEMO_LIB_WIN` / `LEMO_LIB_WSL` 的读者（已同步登记进 `OVERRIDES`，否则判据① 会 FAIL）。
  ffmpegDirs: ['D:\\ffmpeg-9.x\\ffmpeg-9.0.2-full_build\\bin', 'D:\\Feijian\\_internal'],
  syncScript: 'D:\\WSL\\lemo-lib-sync.sh',
};

// ── 底层：异步 spawn（本环境 spawnSync 一律 EBUSY）────────────
//
// ★★ D3（2026-10-10）：**每条命令都有超时**（默认 RUN_TIMEOUT_MS）。
//   改前 `run()` **没有任何超时** —— 一次 WSL / powershell 调用挂起（互操作、冷启动卡死等）
//   就永远不 resolve。而 `server.mjs` 的 `/api/env` 用 inflight 去重，探针不返回 ⇒ 接口
//   **永久卡在 inflight** 上且不自愈（`?force=1` 也救不回来）。⇒ 这里给 run() 封顶。
//   ★ 口径与 `lib/dub-core.mjs:run` 一致：`opts.timeout`（毫秒，0 = 不限）、超时 ⇒ `code:-2` + `timedOut:true`。
export const RUN_TIMEOUT_MS = 120000;

export function run(exe, args, opts = {}) {
  // ★ 从 opts 摘出 `timeout`（别塞进 spawn 的 options）；**有默认值** ⇒ 任何调用都受超时约束。
  //   ★ 不设默认值就「摘」是错的 —— 那样生产态的探针仍会永久挂住。调用方可显式传 timeout:0 关掉。
  const { timeout = RUN_TIMEOUT_MS, ...spawnOpts } = opts;
  return new Promise((resolve) => {
    let p;
    // ★ stdin 必须是 'ignore'（= /dev/null），不能用默认的 pipe —— 与 lib/dub-core.mjs:488-492 同一处坑：
    //   WSL 的 Windows 互操作（/init + *.exe）会去读 stdin，pipe 永远没有数据也没有 EOF ⇒ **永久挂住**
    //   （实测：同一条命令在交互 shell 里能跑，从 Node spawn 就静默挂死）。
    //   stdout/stderr 保持 'pipe'（下面按 'data' 收集，语义不变）；放 ...spawnOpts 之前 ⇒ 调用方仍可用 opts 覆盖。
    try {
      p = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...spawnOpts });
    } catch (e) {
      return resolve({ code: -1, stdout: '', stderr: '', error: e });
    }
    let stdout = '', stderr = '', timer = null, timedOut = false;
    // ★ 按分片各自解码是错的：`stdout += d` 会把 Buffer 逐片隐式 toString('utf8')，而 Windows
    //   pipe 的分片上限是 64KB ⇒ 多字节字符被切在分片边界上时，两半各解成一个 U+FFFD
    //   （实测 600KB 中文 ⇒ 15 个）。这里没有实时性需求（调用方全是「跑完拿结果」），
    //   所以收 Buffer、只在 resolve 前一次性解码 —— 与 lib/voices.mjs / lib/dub-core.mjs 同源。
    //   ★ 必须在**每个** resolve 分支前 drain()：下面 error/close 的 resolve 都是内联捕获
    //     stdout/stderr 的当前值（不是引用），漏一处就会把空串报出去。
    const outChunks = [], errChunks = [];
    const drain = () => {
      stdout = Buffer.concat(outChunks).toString('utf8');
      stderr = Buffer.concat(errChunks).toString('utf8');
    };
    if (timeout > 0) {
      timer = setTimeout(() => { timedOut = true; try { p.kill(); } catch { /* ignore */ } }, timeout);
    }
    p.stdout?.on('data', (d) => { outChunks.push(d); });
    p.stderr?.on('data', (d) => { errChunks.push(d); });
    p.on('error', (e) => { if (timer) clearTimeout(timer); drain(); resolve({ code: -1, stdout, stderr, error: e }); });
    p.on('close', (code) => { if (timer) clearTimeout(timer); drain(); resolve({ code: timedOut ? -2 : code, stdout, stderr, timedOut }); });
  });
}

/**
 * TTL 缓存 + 并发合并（inflight 去重）—— `/api/env` 的「探测成本高、并发只跑一次」口径。
 *
 * ★★ D3（2026-10-10）：inflight 用 `finally` 复位 ⇒ **成功 / 失败 / 抛错 / 超时**任何结局都清空。
 *   改前 server.mjs 的 apiEnv 只在 `.then` / `.catch` 里复位 ⇒ 探针**不 settle**（挂起）时
 *   inflight 永不复位，接口**永久卡死**。⇒ 抽出本函数，让「复位」这件事只有一处实现、且可单测。
 * ★ 调用方负责 TTL 命中判断（见 `peek`）；`get()` 只管「跑一次 / 合并并发」。
 * @param {number} ttlMs 缓存有效期（毫秒）
 */
export function makeTtlCache(ttlMs) {
  let at = 0, data = null, inflight = null;
  return {
    /** 只读快照：`{ fresh, data, ageMs }`（不触发探测）。 */
    peek() { return { fresh: data != null && Date.now() - at < ttlMs, data, ageMs: Date.now() - at }; },
    /**
     * 取数据：并发调用**只跑一次** probe()；跑完（无论成败）立即清空 inflight。
     * @param {() => Promise<any>} probe
     */
    get(probe) {
      if (!inflight) {
        inflight = Promise.resolve()
          .then(probe)
          .then((d) => { at = Date.now(); data = d; return d; })
          .finally(() => { inflight = null; });   // ★ 任何结局都复位
      }
      return inflight;
    },
  };
}

// 调 WSL —— 一律走「脚本文件 + sed 去 CR」而不是内联 bash（内联会吃掉变量）
export async function runWsl(script, { name = '_web-probe', asUser = CFG.wslUser, args = '' } = {}) {
  const uniq = `${name}-${process.pid}-${Date.now().toString(36)}`;
  fs.mkdirSync(CFG.tmpDir, { recursive: true });
  const host = path.join(CFG.tmpDir, `${uniq}.sh`);
  const inner = `/mnt/${host[0].toLowerCase()}${host.slice(2).replace(/\\/g, '/')}`;
  fs.writeFileSync(host, `trap 'rm -f /tmp/${uniq}.sh "${inner}" 2>/dev/null' EXIT\n${script.replace(/\r\n/g, '\n')}`, 'utf8');
  const cmd =
    `sed 's/\\r$//' '${inner}' > /tmp/${uniq}.sh && chmod 644 /tmp/${uniq}.sh && ` +
    `chown ${asUser} /tmp/${uniq}.sh && su - ${asUser} -c "bash /tmp/${uniq}.sh ${args}"`;
  try {
    registerHostScript(host);   // ★ 登记在飞的宿主 .sh —— 进程退出（含 process.exit()）时由 lib/host-scripts.mjs 的 exit 钩子同步兜底
    return await run('wsl.exe', ['-d', CFG.wslDistro, '-u', 'root', '--', 'bash', '-c', cmd],
      // ★ 不传 stdio ⇒ 走 run() 的默认 ['ignore','pipe','pipe']（stdin=/dev/null）——
      //   这正是 WSL 互操作**必须**的（读 stdin 会永久挂住，见 run() 的说明）。
      { env: { ...process.env, WSL_UTF8: '1' } });
  } finally {
    unregisterHostScript(host); // ★ 摘除登记（清盘仍走下面那句 unlinkSync）
    // ★★ F3（第四批对抗性审计 · 长跑健壮性）：宿主机侧兜底 —— 照抄 lib/setup.mjs:771-774 那一段
    //   （「万一 WSL 侧的 trap 没执行到，宿主机这份也清掉（文件名唯一，不会误删别人的）」）。
    //   改前这里**只有** WSL 脚本内的 trap 一条收尾路径，而上面那份宿主 .sh 是**在 spawn 之前**写好的
    //   ⇒ 只要 wsl 这一跳失败（wsl.exe 不在 PATH / 发行版名不对 / WSL 服务没起 / sed 链中途失败 /
    //   控制台被 taskkill），宿主文件就**没有任何人删**（实测 ENOENT ⇒ 残留 109~125B；D:\WSL 下现存
    //   42 个 _web-probe-*.sh）。run() 在 'close' 与 'error' **两条**路径上都会 resolve
    //   ⇒ 用 finally 覆盖「跑完 / 起不来 / 超时」全部结局。
    //   ★ 只加清理、不改正常行为：成功路径上 WSL 侧早已把内容 sed 到 /tmp 读走，宿主这份本就可删。
    try { fs.unlinkSync(host); } catch { /* 已经没了 */ }
  }
}

export function findFfmpegDir() {
  for (const d of CFG.ffmpegDirs) {
    try { if (fs.existsSync(path.join(d, 'ffmpeg.exe'))) return d; } catch { /* ignore */ }
  }
  return null;
}

// ── 漂移自检：路径常量有没有和编排器跑偏 ─────────────────────
/**
 * 读编排器 CFG 块，与本模块的路径常量逐一比对，不一致 / **读不到**都报出来。
 *
 * ★★ RISK-13（判据：**「匹配不上」必须与「匹配上且一致」区分开**）：编排器可能把某个键写成
 *   **表达式**（如 `wslLib: process.env.LEMO_LIB_WSL || '...'`），而本函数的正则
 *   `${key}\s*:\s*'([^']*)'` **只认纯字符串字面量** ⇒ 读不到值。旧版对「读不到」是**静默跳过**
 *   ⇒ 调用方看到「没有漂移」，实际是**根本没比对上**（静默失明）。现在「读不到」会如实产出一条
 *   **「无法判定」**告警（条目形状与漂移告警同型，调用方消费方式不变），让上层看得见。
 * @param {string} [orchSrc] 编排器源码文本；**仅供测试注入夹具**（生产调用不传 ⇒ 读 ORCH 文件）。
 * @returns {{id:string, level:'warn', msg:string}[]}
 */
export function driftCheck(orchSrc) {
  const out = [];
  let src;
  if (typeof orchSrc === 'string') {
    src = orchSrc;
  } else {
    try { src = fs.readFileSync(ORCH, 'utf8'); }
    catch { return [{ id: 'drift', level: 'warn', msg: `读不到编排器 ${ORCH}，无法做路径漂移自检` }]; }
  }
  const grab = (key) => {
    const m = src.match(new RegExp(`${key}\\s*:\\s*'([^']*)'`));
    if (!m) return null;
    // ⚠️ 取到的是**源码原文**（JS 字符串字面量），反斜杠是转义过的：
    //    源码里 `'D:\\lemo-opuscar'` 的实际值是 `D:\lemo-opuscar`。
    //    不反转义会得到恒定的假阳性（本模块第一版就踩了这个坑）。
    return m[1].replace(/\\\\/g, '\\').replace(/\\'/g, "'");
  };
  for (const [k, v] of Object.entries({
    wslDistro: CFG.wslDistro, wslUser: CFG.wslUser, wslLib: CFG.wslLib,
    winLib: CFG.winLib, tmpDir: CFG.tmpDir, exportDir: CFG.exportDir,
  })) {
    const got = grab(k);
    // ★★ RISK-13：`grab` 返回 null = 编排器里该键不是**纯字符串字面量**（正则读不到值）。
    //    **不得**静默跳过 —— 如实报「无法判定」，与下面的「漂移」是两条不同的路。
    if (got === null) {
      out.push({ id: `drift.${k}`, level: 'warn', msg: `路径常量无法判定：${k} 在编排器里不是纯字符串字面量（正则读不到值，未做比对）` });
      continue;
    }
    if (got !== v) out.push({ id: `drift.${k}`, level: 'warn', msg: `路径常量漂移：${k} 本模块='${v}' 编排器='${got}'` });
  }
  return out;
}

// ── 单项检查工具 ────────────────────────────────────────────
const ok = (id, label, detail = '') => ({ id, label, status: 'ok', detail });
const warn = (id, label, detail = '', fix = '') => ({ id, label, status: 'warn', detail, fix });
const fail = (id, label, detail = '', fix = '') => ({ id, label, status: 'fail', detail, fix });

// ── 乐器采样库清单（★ 全仓唯一一份：检测「按库」计数 + 安装动作派生共用）─────
//
// ★★ 为什么这份清单在 **env.mjs**（2026-10-11 从 `lib/setup.mjs` 下移）：
//   「某个采样库装没装」必须在**检测层**就按库算出来 —— 否则装完**单个**库之后，`assets.inst`
//   那一项只会说「只有 N 个文件（预期 ~3869）」⇒ **已装的那个库看不见**，向导里那 6 张卡照旧全在
//   （上一批登记的局限）。而安装动作 `assets.inst.<lib>` 也要同一份清单。
//   ★ 两个模块都要 ⇒ 只能放在**更底层**那一侧：`lib/setup.mjs` 本来就 `import` 本模块，
//     反过来（env.mjs → setup.mjs）会**成环**，且 ESM 循环会在 setup.mjs 顶层读 `CFG` 时抛 TDZ
//     （`Cannot access 'CFG' before initialization`）—— 实测过，不是理论风险。
//   ⇒ 定义留在 env.mjs；setup.mjs `import` 后**同名再导出**（既有消费者一行不用改）。
//
// ★ 清单**为什么硬编码、凭什么不会悄悄漂**（原记于 lib/setup.mjs，随清单一起搬来）：
//   · 来源：上游 `tools/fetch.sh:7` 的 `LIBS="freepats karoryfer salamander vcsl vsco2ce"`
//     （= 它 usage 行里 `instruments <lib>` 的 libs，也 = `tools/assets.json` 里
//      `instruments-<lib>` 这 5 个 pack 的后缀）。上游改了库名 / 增删库 ⇒ **必须同步这里**。
//   · 为什么**不**在运行时从上游文件派生：安装动作恰恰是给「库还没装」的机器看的，
//     而那时上游 `tools/fetch.sh` 也不存在 ⇒ 派生必然退化成兜底常量。与其留两套（派生 + 兜底），
//     不如只留一套常量。
//   · 谁保证不漂：`test/setup.test.mjs` 的 ⑯ 会读上游 `tools/fetch.sh` 的 `$LIBS` 与
//     `tools/assets.json` 的 `instruments-*.size` 做**逐字比对**（读不到上游文件 ⇒ 判
//     「无法判定」并 FAIL，不静默放行）⇒ 上游改名 / 换体积时**当场变红**。
//   · `bytes` 只用于 UI 显示「约 XXX MB」（`estBytes`）；真实下载量与完整性以**上游**为准
//     （`fetch.sh` 自己按 `assets.json` 的 sha256 校验），这里不复制那份权威。
//   · `name` 同时是**目录名**：上游 `core/audio/instruments/<lib>/`（见 `core/audio/INSTRUMENTS.md` §9）
//     —— 检测按库计数与安装动作的幂等守卫都盯它，并由 ⑯ 一并钉住。
export const INSTRUMENT_LIBS = [
  { name: 'freepats', bytes: 415959040, note: 'FreePats 各包 + MuldjordKit 鼓组' },
  { name: 'karoryfer', bytes: 77772800, note: '二胡 / 爵士低音提琴 / 中音萨克斯' },
  { name: 'salamander', bytes: 229150720, note: 'Salamander 三角钢琴' },
  { name: 'vcsl', bytes: 284682240, note: '竖琴 / 颤音琴 / 管钟 / 马林巴 / 萨克斯 / 打击' },
  { name: 'vsco2ce', bytes: 413911040, note: '管弦主力：弦乐 / 木管 / 铜管 / 打击 / 管风琴' },
];

/** 探针输出 / 解析「按库计数」用的键前缀（★ 生成与解析**共用这一处**，别各写一份）。 */
const INST_LIB_KEY = 'inst.';

/**
 * 「按库」探针片段（纯函数：只产出 shell，不执行）。
 * ★ 与整棵树的总数（`inst=`）分开报：总数由既有那一行给，这里只补**每个库**的文件数。
 * ★ 库名来自 `INSTRUMENT_LIBS`（唯一一份）⇒ 不会出现「探针数的库」与「卡片装的库」两张清单。
 * ★ 目录不存在 ⇒ `find` 无输出 ⇒ 计数 0（`2>/dev/null` 吞掉 find 自己的报错）。
 */
export function instrumentLibsProbe() {
  const names = INSTRUMENT_LIBS.map((l) => l.name);
  return [
    `for b in ${names.join(' ')}; do`,
    `  echo "${INST_LIB_KEY}$b=$(find "$L/core/audio/instruments/$b" -type f 2>/dev/null | wc -l)";`,
    'done',
  ].join('\n');
}

/**
 * 「库与素材」那一组的 WSL 探针正文（纯函数：只产出脚本，不执行）。
 * ★ 抽成纯函数是为了能**不起 WSL** 就验证它 —— `test/setup.test.mjs` 的 ⑱ 把这段脚本在
 *   **本地 bash** 里对着**临时假库树**跑一遍，断言「按库计数」真的按库出来、且解析结果一致。
 * @param {string} [libRoot] 库根（默认 `CFG.wslLib`）。★ 只有测试会传别的值（临时假库树）；
 *   生产调用不传 ⇒ 脚本与改动前**逐字节相同**。
 */
export function assetsProbe(libRoot = CFG.wslLib) {
  return `L="${libRoot}"; ` +
    '[ -d "$L" ] && echo "LIB_OK" || echo "LIB_MISSING"; ' +
    'echo "demos=$(ls -d $L/styles/*/demo 2>/dev/null | wc -l)"; ' +
    'echo "fonts=$(find $L -type f \\( -name "*.ttf" -o -name "*.otf" -o -name "*.woff2" \\) 2>/dev/null | wc -l)"; ' +
    'echo "inst=$(find $L/core/audio/instruments -type f 2>/dev/null | wc -l)"; ' +
    instrumentLibsProbe() + '; ' +
    '[ -d "$L/.git" ] && echo "git=$(git -C $L rev-parse --short HEAD 2>/dev/null)" || echo "git=-"';
}

/**
 * `assets.inst`（乐器采样库）这一项的判据 —— 纯函数，可脱离 WSL 单测。
 *
 * @param {number} total  整棵 `core/audio/instruments` 下的文件总数
 * @param {Record<string, number>} counts  每个库的文件数（键 = 库名，见 `INSTRUMENT_LIBS`）
 * @returns {{status:'ok'|'warn', detail:string, installed:string[], missing:string[]}}
 *
 * ★★ 状态判据**一字未改**（仍是 `total >= 3000 ⇒ ok`）—— 本次只把「按库」的事实补进 `detail`。
 *   「不许为了让闸门变绿放宽判据」的反面同样成立：**也不收紧**。
 *   ⇒ 已知边界（**如实登记，有意不改**）：若某台机器只装了 1 个库、但它的文件数已 `>= 3000`，
 *     本项状态仍是 `ok`（向导因此不出卡），此时 `detail` 会把「1/5 个采样库已装」写出来 ——
 *     事实**看得见**，但不据此改判据（改了会让「文件数够、库不全」的机器凭空多出 6 张卡，属行为变更）。
 * ★ 「已装」的判据 = 该库目录下有 **>= 1 个文件**（= 有内容、可用）。
 *   ★ 与安装动作的 shell 守卫（`[ -d <库目录> ]`）**有意不同**：守卫只判目录存在 ⇒ 它是「已装」的**超集**。
 *     差别只在「目录在、但一个文件都没有」（半成品）这一种情况：env 报「缺」，点那张卡会「已存在 → 跳过」。
 *     已登记为已知边界（**只登记、不顺手改** —— 收紧守卫会动到 ⑭/⑮ 逐字节钉住的单库脚本正文）。
 */
export function instrumentLibState(total, counts) {
  const names = INSTRUMENT_LIBS.map((l) => l.name);
  const has = (name) => Number((counts || {})[name] || 0) > 0;
  const installed = names.filter(has);
  const missing = names.filter((name) => !has(name));
  const t = Number(total || 0);
  const libs = `${installed.length}/${names.length} 个采样库已装`
    + (missing.length ? `（缺：${missing.join(', ')}）` : '');
  return {
    status: t >= 3000 ? 'ok' : 'warn',
    // ★ 原文案前缀（`N 个文件（预期 ~3869）`）**保留** —— 本次是**追加**按库事实，不是替换。
    detail: t >= 3000 ? `${t} 个文件 · ${libs}` : `${t} 个文件（预期 ~3869）· ${libs}`,
    installed, missing,
  };
}

/**
 * 「乐器采样库缺失」的 fix 文案 —— **唯一来源**（本项目铁律：同一句文案只许写一处）。
 *
 * ★ 为什么抽成常量：这句话原本**抄了三份**，三份都会各自漂，而且**没有闸门守**：
 *   ① 本文件 checkEnv() 里 warn('assets.inst', …) 的第 4 参（生产路径）；
 *   ② lib/resources.mjs 的 assets.inst 台账条目 fix（生产路径，走 /api/resources/scan）；
 *   ③ lib/setup.mjs 的 fixturePartialAssets()（演练路径，走 /api/env?simulate=partial
 *      与 --simulate；它渲染成「env.fix 原话：…」一行）。
 *   现在只有这里写正文，另两处 import 本常量。
 * ★ 谁保证不漂：test/resources.test.mjs 直接取三处的**值**比对，并断言这句文案在
 *   lib/env.mjs / lib/resources.mjs / lib/setup.mjs 的源码里只作为字面量出现在本文件一处。
 * ★ 导出形态是**值导出**（不是函数）⇒ scripts/check-lib-exports.mjs 不对它数调用点
 *   （该闸门只判可调用导出；值导出由别的闸门守）。
 */
export const ASSETS_INST_FIX = '采样库被 .gitignore 排除时需单独获取，见库内 core/audio/instruments/README';

/**
 * 其余三句 fix 文案的**唯一来源**（口径同 `ASSETS_INST_FIX`：同一句文案只许写一处）。
 *
 * ★ 由来（2026-10-11 第二批收口）：这三句原本各**抄了三份**、且**没有闸门守**：
 *   ① 本文件 checkEnv() 里 warn/fail 的第 4 参（生产路径 `/api/env`）；
 *   ② `lib/resources.mjs` 对应台账条目的 `fix`（生产路径 `/api/resources/scan`）；
 *   ③ `lib/setup.mjs` 演练夹具（`/api/env?simulate=…` 与 `--simulate`）。
 *   ⇒ 三份会各自漂。现在正文只写在下面这三处常量，另两处 import 它们。
 *
 * ★★ **为什么只收口这三句**（本批的取舍，如实写明；全量比对见 `test/resources.test.mjs`）：
 *   · 这三句（连同上一批的 `ASSETS_INST_FIX`）是**仅有的**同时满足「**三处**字面量逐字节相同」
 *     +「**无插值**」的精确重复 ⇒ 收口是**无条件**零行为变更（值一字未改，夹具取值方式也不变）。
 *   · 其余重复**本次不动**，按**实测**（不是目测）分三类：
 *     ㈠ **两处精确重复（env ↔ setup），resources 侧值不同**：`win.ffmpeg` / `win.gpu` /
 *        `wsl.alive` / `wsl.ffmpeg` / `tool.sync` + `lib.wsl` 的 warn 文案（`可能 clone 不完整，重新 clone`）。
 *        ★ 这 6 条**同样零插值** ⇒ 收口**也能**做到无条件零行为变更；**本批未做**（取舍：只有 2 处、
 *        漂移面小于本批那 4 条 3 处的；且本批 ② 的比对口径是 env ↔ resources）⇒ 登记为**可收口候选**。
 *     ㈡ **三处精确重复但含插值**：`lib.wsl`（`git clone … ${CFG.wslLib}`）与 `wsl.venv`
 *        （`cd ${CFG.wslLib} && …`）—— 它们的第三处（setup.mjs 夹具）把该值**硬编码**成
 *        `/home/lemo/lemo-opuscar` ⇒ 收口要把夹具的**取值方式**从硬编码改成引用常量，
 *        那会在 `LEMO_LIB_WSL` 被设时改变演练输出（**条件**行为变更）⇒ 只登记。
 *     ㈢ **近重复（env ↔ resources 值本就不同）**：`win.platform` / `win.ffmpeg` / `win.gpu` /
 *        `wsl.alive` / `wsl.ffmpeg` / `tool.sync` —— 在 env ↔ resources 这一维收口必然改动
 *        `/api/env` 或 `/api/resources` 的**输出文本** ⇒ 违反零行为变更 ⇒ 只登记。
 *
 * ★ 谁保证不漂：`test/resources.test.mjs` 对每句取**三处的值**互比，并断言这句文案在
 *   `lib/env.mjs` / `lib/resources.mjs` / `lib/setup.mjs` 三个文件的源码里只作为**字面量**
 *   出现在本文件一处。
 *
 * ★★ 2026-10-11 第三批订正（**上面 ㈠ 那句「本批未做」已作废，原句照留作历史**）：
 *   ㈠ 登记的 6 条（`win.ffmpeg` / `win.gpu` / `wsl.alive` / `wsl.ffmpeg` / `tool.sync` +
 *   `lib.wsl` 的 warn 文案）**本批已收口** —— 正文只写在下面那 6 个常量里，`lib/setup.mjs`
 *   的演练夹具 import 它们。理由：它们与上批那 4 句**同样满足「无插值」**⇒ 收口**无条件零行为变更**
 *   （值一字未改，只是夹具的取值方式从「手抄字面量」变成「引用常量」）。已实测：
 *   `/api/env`（含 5 个 `?simulate=` 场景）与 `planActions()` 的输出**逐字节不变**。
 *   ★ ㈡（`lib.wsl` 的 fail 文案 / `wsl.venv`，含 `${CFG.wslLib}`）**仍然只登记** —— 它们的第三处
 *     （setup 夹具）把该值**硬编码**成 `/home/lemo/lemo-opuscar` ⇒ 收口要把夹具的取值方式从硬编码
 *     改成引用常量，那会在 `LEMO_LIB_WSL` 被设时改变演练输出（**条件**行为变更）。
 *   ★ ㈢（env ↔ resources 值本就不同）**仍然只登记** —— 在那一维收口必然改 `/api/env` 或
 *     `/api/resources` 的输出文本。
 *
 * ★★ 2026-10-11 第四批订正（**上面 ㈡ 那句「仍然只登记」已作废，原句照留作历史**）：
 *   ㈡（`lib.wsl` 的 fail 文案 / `wsl.venv` 的 fail 文案，**含插值**）**本批已收口**，但形态与
 *   前三批不同：因为含插值，不能做成**字符串**常量，只能把**文案模板**做成**函数**（插值点当参数），
 *   见下方 `LIB_WSL_FAIL_FIX(lib)` / `WSL_VENV_FAIL_FIX(lib)`。★ 关键是**谁传什么**：
 *     · `lib/env.mjs`（生产 `/api/env`）与 `lib/resources.mjs`（台账）传 `CFG.wslLib`；
 *     · `lib/setup.mjs` 的演练夹具传**硬编码**的 `'/home/lemo/lemo-opuscar'` ——
 *       夹具的**取值方式一字未改**（仍是那个硬编码默认路径）⇒ 无论设不设 `LEMO_LIB_WSL`，
 *       演练输出都**逐字节不变** ⇒ **无条件**零行为变更（已实测比对 5 个 `?simulate=` 场景）。
 *       ★ 这是本批与前几批的**唯一差别**：前几批连「取值方式」都不变（手抄 → 引用同一个字符串），
 *       本批是「**模板**合一、取值方式不变」—— 因为**模板**才是会漂的那部分（改文案只改一处）。
 *   ★ ㈢（env ↔ resources 值本就不同）**仍然只登记，但结论改为「设计如此」**（第四批复核）：
 *     这不是「该收口而没做」，而是**两侧用途不同、本就该不同** —— env 侧是「检测项给用户的
 *     修复建议」、resources 侧是「资源台账的说明」⇒ 详见下方 `WIN_FFMPEG_FIX` 等 6 条常量处、
 *     以及 `lib/resources.mjs` 台账头部「★ 这 6 条**有意不同**」那段。
 */
export const ASSETS_FONTS_FIX = '跑 D:\\WSL\\fetch-all-fonts.sh 补齐（幂等）';
export const LIB_WIN_FIX = '首次运行会自动从 WSL 库同步过去（跑一次 lemo-make 即可）';
export const WSL_NODE_FIX = '在 WSL 里安装 Node 20+（推荐 nvm 或 nodesource）';

/**
 * 「env ↔ 演练夹具」**两处精确重复**的 6 句文案的**唯一来源**（2026-10-11 第三批收口）。
 *
 * ★ 由来：这 6 句原本在 `lib/env.mjs`（生产路径 `/api/env`）与 `lib/setup.mjs` 的演练夹具
 *   （`/api/env?simulate=…` 与 `--simulate`）里**各写一份字面量**，且**没有闸门守** ⇒ 两处会各自漂。
 * ★ 与上批那 4 句的差别：上批是**三处**（env + resources + setup）逐字节相同；这 6 句只有**两处**
 *   （env + setup）—— `lib/resources.mjs` 对应台账条目的 `fix` **值本来就不同**（如实测 `win.ffmpeg`
 *   在那边是 `…放到候选目录之一：${CFG.ffmpegDirs.join(' / ')}`）⇒ 不能跨到 resources 去收口
 *   （那会改 `/api/resources/scan` 的输出文本）。
 * ★★ 零行为变更：这 6 句**都不含插值**，值**一字未改**，夹具只是把「手抄的字面量」换成「引用常量」
 *   ⇒ `/api/env`（含 5 个 `?simulate=` 场景）与 `planActions()` 的输出**逐字节不变**（已实测比对）。
 * ★ 谁保证不漂：`test/resources.test.mjs` 的「防再分叉」用例（**已参数化**，覆盖本批 6 句 + 上批 4 句）
 *   逐条断言「env 常量 == 演练夹具里同 id 项的值」，并断言这句文案在
 *   `lib/env.mjs` / `lib/resources.mjs` / `lib/setup.mjs` 的源码里**只作为字面量出现在本文件一处**。
 *   ★ 变异自证：把任一处夹具的值改一个字 ⇒ 该用例当场变红（已实测）。
 *
 * ★★ 2026-10-11 第四批**复核**（㈢ 从「待收口」**降级为「设计如此」**，以后别再当重复来收口）：
 *   上面这 6 句（`WIN_FFMPEG_FIX` / `WIN_GPU_FIX` / `WSL_ALIVE_FIX` / `WSL_FFMPEG_FIX` /
 *   `TOOL_SYNC_FIX` + `win.platform` 那句内联字面量）与 `lib/resources.mjs` 台账里**同名 id** 的
 *   `fix` **措辞不同、且是有意的** —— 两侧**用途不同**：
 *     · **env 侧**（本文件）是「**检测项给用户的修复建议**」：在自检面板里**紧挨着**检测结果出现，
 *       要说清**该去改哪个配置项**（如「改 lemo-make.mjs 的 CFG.ffmpegDirs」）；
 *     · **resources 侧**（`lib/resources.mjs` 的 `_entries`）是「**资源台账的说明**」：独立于检测结果
 *       存在，要把**当前机器上的实际值**摊开（如把 `CFG.ffmpegDirs` 的候选目录**逐个列出**）。
 *   ⇒ 若强行统一成同一句，**必然**改动 `/api/env` 或 `/api/resources` 的输出文本（违反零行为变更），
 *     而且**本来就更差**（把「建议」和「台账说明」压成一句，两边都不好用）。
 *   ⇒ **结论：保持不同**。`lib/resources.mjs` 台账头部有对应的「★ 这 6 条**有意不同**」说明。
 *   ⇒ 这条**不再是待办**；`test/resources.test.mjs` 的 `places:2` 反向断言（「这句 env 文案不得
 *     出现在 lib/resources.mjs」）正是用来**钉住**这个结论的（谁哪天把它抄过去 ⇒ 当场红）。
 */
export const WIN_FFMPEG_FIX = '下载 ffmpeg 完整版（含 nvenc）放到候选目录之一；或改 lemo-make.mjs 的 CFG.ffmpegDirs';
export const WIN_GPU_FIX = '若渲染很慢，检查是否装了显卡驱动（WSL 侧拿不到 GPU 是正常的，渲染走 Windows）';
export const WSL_ALIVE_FIX = '确认已安装：wsl.exe -l -v；若发行版名不同，改 lemo-make.mjs 的 CFG.wslDistro';
export const WSL_FFMPEG_FIX = 'sudo apt install ffmpeg（混流要用，且需带 h264_nvenc）';
export const TOOL_SYNC_FIX = '这是编排器步骤 2 依赖的脚本，缺失会导致同步失败';
/**
 * ★ 只覆盖 `lib.wsl` 的 **warn** 文案（「可能 clone 不完整，重新 clone」）。
 * ★★ 它的 **fail** 文案（`git clone …`）原先**不在**收口范围（原句照留作历史）：那条含插值、
 *   且演练夹具把该值**硬编码**成 `/home/lemo/lemo-opuscar` ⇒ 收口会把夹具的取值方式从硬编码
 *   改成引用常量，`LEMO_LIB_WSL` 被设时演练输出会变（**条件**行为变更）⇒ 只登记。
 *   ★ 2026-10-11 第四批：改用**函数模板**收口了（夹具仍传硬编码默认路径、取值方式不变）⇒
 *     见下方 `LIB_WSL_FAIL_FIX` / `WSL_VENV_FAIL_FIX`。
 */
export const LIB_WSL_WARN_FIX = '可能 clone 不完整，重新 clone';

/**
 * ★★ 2026-10-11 第四批收口：两条**含插值**的 fail 文案的**唯一模板来源**。
 *
 * ★ 为什么是**函数**而不是字符串：这两句的插值点是**库根路径** `CFG.wslLib`，而演练夹具
 *   （`lib/setup.mjs`）用的是**硬编码**默认路径 `/home/lemo/lemo-opuscar`。做成函数后，
 *   「模板」只写一处，而「传什么值」由调用方决定 ——
 *     · `lib/env.mjs`（生产 `/api/env`）与 `lib/resources.mjs`（台账）传 `CFG.wslLib`；
 *     · `lib/setup.mjs` 的演练夹具传 `'/home/lemo/lemo-opuscar'`（**硬编码，取值方式不变**）。
 *   ⇒ 无论是否设 `LEMO_LIB_WSL`，演练输出**逐字节不变**（无条件零行为变更，已实测）。
 *
 * ★ 谁保证不漂：`test/resources.test.mjs` 的「防再分叉」用例（这两条按 `fn:true` 参数化）——
 *   ① 断言 `lib/resources.mjs` 台账 fix == 本函数(`CFG.wslLib`)；② 断言演练夹具同 id 项的值
 *   == 本函数(`CFG.wslLib`)（夹具传硬编码默认路径 ⇒ 默认环境逐字节相等）；③ 断言**模板源码**
 *   （含 `${lib}` 的那段）只作为字面量出现在**本文件一处**（另两处只能是**函数调用**）。
 *
 * ★ 注意：`lib/resources.mjs` / `lib/setup.mjs` 的注释里**不要逐字抄**下面这两段模板源码 ——
 *   ③ 的文本扫描比的是**源码字面量**，抄进注释会让「只许一处」当场变红。
 */
export const LIB_WSL_FAIL_FIX = (lib) => `git clone https://github.com/lemomo-ai/lemo-opuscar.git ${lib}`;
export const WSL_VENV_FAIL_FIX = (lib) => `cd ${lib} && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`;

// ── 主入口：全量自检 ────────────────────────────────────────
export async function checkEnv() {
  const groups = [];

  // ===== 1. 本机（Windows）=====
  {
    const items = [];
    if (process.platform === 'win32') items.push(ok('win.platform', '平台', `win32 · Node ${process.version}`));
    // ★ 本句（检测项**建议**）与 `lib/resources.mjs` 台账里 win.platform 的 `fix`（**台账说明**）
    //   **有意不同** —— 两侧用途不同，别再当重复去收口（见本文件 6 句常量处「第四批复核」那段）。
    else items.push(fail('win.platform', '平台', `当前 ${process.platform}`, '本控制台必须在 Windows 侧运行（GPU 渲染需要）'));

    // ★★ 2026-10-12（第六批审计 §3-4 收口）：本处的判据是**「能跑」**（真 spawn `ffmpeg -version` 看退出码），
    //   而编排器 `lemo-make.mjs` 的 `[0] 环境自检` **改前**同一事实用的是**「存在」**（`findFfmpegDir()` 之后
    //   **无条件** `ok(...)`、从不看那次 `-version` 的 `ffv.code`）⇒ 同一个「ffmpeg.exe 在但跑不起来」的机器，
    //   **本模块报 fail、编排器报 ✓**。★ 裁定（本批）：**本处的「能跑」才对** —— 目录存在 ≠ 可执行（DLL 缺失 /
    //   架构不符 / 杀软隔离），这种机器上渲染/静帧/混流**必然失败**，且失败点在几分钟之后的下游、错误信息与根因无关。
    //   编排器那处**不是**「早退守卫」（守卫是它上一行的 `if (!ffDir) fail(...)`）——`ok(...)` 是一句**给用户看的断言**，
    //   断言就必须能被证伪。★ 实测（桩放 D:/lemo-tmp/）：空 `ffmpeg.exe` ⇒ 本模块 fail（code=-1/EFTYPE）、编排器改前 ✓；
    //   真 exe 但 `-version` 退出 9 ⇒ 同样 fail vs ✓；真 ffmpeg ⇒ 两侧一致（本模块 ok / 编排器 ✓）。
    //   ⇒ ★ 红线侧**已按本判据收口**（`lemo-make.mjs:1930` = `if (ffv.code === 0) ok(...) else fail(...)`），两侧现已同口径。
    const ff = findFfmpegDir();
    if (ff) {
      const r = await run(path.join(ff, 'ffmpeg.exe'), ['-hide_banner', '-version']);
      items.push(r.code === 0
        ? ok('win.ffmpeg', 'Windows ffmpeg', `${ff} · ${(r.stdout.split('\n')[0] || '').slice(0, 60)}`)
        : fail('win.ffmpeg', 'Windows ffmpeg', `${ff} 但执行失败`, '检查该目录下 ffmpeg.exe 是否可运行'));
    } else {
      items.push(fail('win.ffmpeg', 'Windows ffmpeg', `候选目录都没有 ffmpeg.exe：${CFG.ffmpegDirs.join(' / ')}`,
        WIN_FFMPEG_FIX));
    }

    // GPU：Windows 侧用 wmic 查显卡名（拿不到就 warn，不作为 fail —— 无卡也能回退软渲染）
    // ★★ 第九批对抗性审计 F1 漏改（Y1-2，审计建议里点名过本处却没做也没登记）：
    //   powershell.exe 的**自身输出**走的是控制台输出代码页（本机 ACP=936 ⇒ GBK），不是 UTF-8。
    //   与 `lib/voices.mjs:102` 那处**同病、不同药** —— `PYTHONUTF8:'1'` 对 powershell **完全无效**
    //   （那是 python 解释器自己的开关）。实测（Node v22.22.2，stdout 重定向成管道）：
    //     · 原样                                            ⇒ 12 个 U+FFFD（字节 d6d0cec4… = GBK）
    //     · `$OutputEncoding=[System.Text.Encoding]::UTF8`  ⇒ **无效**（它只管「powershell 管道喂原生程序」的方向）
    //     · `[Console]::OutputEncoding=[…]::UTF8`           ⇒ **0 个 U+FFFD**（字节 e4b8ad… = UTF-8）★ 采用
    //   ★ 为什么不能照抄 F2 的「收 Buffer、末尾一次性解码」：那套只治**分片边界**，
    //     而这里的字节**本身就是 GBK** ⇒ 攒齐了再按 UTF-8 解仍是 12 个 U+FFFD。
    //     必须让**子进程吐 UTF-8**。★ 也不是 `chcp 65001`（那要有真控制台；本进程 stdout 是管道）——
    //     `[Console]::OutputEncoding` 的 setter 在**无控制台**下同样生效（实测 code:0、stderr 空）。
    //   ★ 零行为变更（实测）：ASCII 显卡名 / 空输出两种桩，加前置前后 stdout 与 stderr **逐字节相同**
    //     （生产命令真值 `NVIDIA GeForce RTX 4060` 25B→25B，`Buffer.equals`=true）。
    //   ★ 纪律（**不只这一处**）：Windows 侧子进程要读非 ASCII 就必须**显式定编码** ——
    //     python 走 `PYTHONUTF8:'1'`（lib/voices.mjs）、WSL 走 `WSL_UTF8:'1'`（下面的 runWsl）、
    //     powershell 走本前置。★ 实测 `lib/**` 里 powershell 的**进程调用点只有这一处**
    //     （`grep -rin powershell lib/*.mjs` 的另两处是注释 `env.mjs:75` 与一句**给用户看的
    //     安装指引文案** `setup.mjs:318`，都不起进程；其余在 `scripts/**`，只吐 ASCII 的回收站结果）。
    const g = await run('powershell.exe', ['-NoProfile', '-Command',
      '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; '
      + "(Get-CimInstance Win32_VideoController | Select-Object -First 3 -ExpandProperty Name) -join ' | '"]);
    const names = (g.stdout || '').trim();
    items.push(names
      ? ok('win.gpu', '显卡', names)
      : warn('win.gpu', '显卡', '查不到显卡信息', WIN_GPU_FIX));

    groups.push({ title: '本机（Windows）', items });
  }

  // ===== 2. WSL =====
  {
    const items = [];
    const p = await runWsl(
      'echo WSL_OK; uname -r; command -v node || echo -; node --version 2>/dev/null || echo -; ' +
      'command -v ffmpeg || echo -; ffmpeg -version 2>/dev/null | head -1 | cut -d" " -f3 || echo -; ' +
      'ls -d "$L" 2>/dev/null || echo -',
      { name: '_web-probe' });
    const lines = (p.stdout || '').trim().split('\n').map((s) => s.trim());

    if (p.code !== 0 || lines[0] !== 'WSL_OK') {
      items.push(fail('wsl.alive', 'WSL 可用性', `distro=${CFG.wslDistro} 探测失败`,
        WSL_ALIVE_FIX));
      groups.push({ title: 'WSL', items });
      return finalize(groups);
    }
    items.push(ok('wsl.alive', 'WSL 可用性', `${CFG.wslDistro} · 内核 ${lines[1] || '?'}`));
    items.push(lines[2] && lines[2] !== '-'
      ? ok('wsl.node', 'WSL Node', lines[3] || '?')
      : fail('wsl.node', 'WSL Node', '找不到 node', WSL_NODE_FIX));
    items.push(lines[4] && lines[4] !== '-'
      ? ok('wsl.ffmpeg', 'WSL ffmpeg', lines[5] || '?')
      : fail('wsl.ffmpeg', 'WSL ffmpeg', '找不到 ffmpeg', WSL_FFMPEG_FIX));

    // Python venv + 关键包
    const py = await runWsl(
      `V="${CFG.wslLib}/.venv/bin/python"; ` +
      'if [ -x "$V" ]; then echo PY_OK; $V --version 2>&1; ' +
      'for m in numpy scipy soundfile soxr PIL numba librosa kokoro_onnx faster_whisper; do ' +
      '$V -c "import $m" 2>/dev/null && echo "+$m" || echo "-$m"; done; ' +
      'else echo PY_MISSING; fi', { name: '_web-probe' });
    const pl = (py.stdout || '').trim().split('\n').map((s) => s.trim());
    if (pl[0] !== 'PY_OK') {
      items.push(fail('wsl.venv', 'Python venv', `${CFG.wslLib}/.venv 不存在或不可执行`,
        WSL_VENV_FAIL_FIX(CFG.wslLib)));
    } else {
      const miss = pl.filter((s) => s.startsWith('-')).map((s) => s.slice(1));
      items.push(miss.length === 0
        ? ok('wsl.venv', 'Python venv', `${pl[1] || '?'} · 9/9 包就位`)
        : warn('wsl.venv', 'Python venv', `${pl[1] || '?'} · 缺 ${miss.length} 个包：${miss.join(', ')}`,
            `${CFG.wslLib}/.venv/bin/pip install ${miss.join(' ')}`));
    }
    groups.push({ title: 'WSL', items });
  }

  // ===== 3. 库与素材 =====
  {
    const items = [];
    // WSL 库
    // ★ 探针正文抽成纯函数 `assetsProbe()`（⑱ 在本地 bash 里对着临时假库树真跑一遍它）。
    const w = await runWsl(assetsProbe(), { name: '_web-probe' });
    const kv = Object.fromEntries((w.stdout || '').trim().split('\n')
      .filter((l) => l.includes('=')).map((l) => l.split('=').map((s) => s.trim())));
    const libOk = (w.stdout || '').includes('LIB_OK');

    if (!libOk) {
      items.push(fail('lib.wsl', 'WSL 库', `${CFG.wslLib} 不存在`,
        LIB_WSL_FAIL_FIX(CFG.wslLib)));
    } else {
      const demos = Number(kv.demos || 0);
      items.push(demos >= 43
        ? ok('lib.wsl', 'WSL 库', `${CFG.wslLib} · ${demos} 个 demo${kv.git && kv.git !== '-' ? ` · ${kv.git}` : ''}`)
        : warn('lib.wsl', 'WSL 库', `只有 ${demos} 个 demo（预期 43）`, LIB_WSL_WARN_FIX));
    }
    // Windows 库
    if (fs.existsSync(CFG.winLib)) {
      let n = 0;
      // ★ 风格目录数：走**唯一**的风格源码根解析（lib/styles-root.mjs）—— 与 aspects/briefs 同一处逻辑。
      //   不设 `LEMO_STYLES_ROOT` 时等价于旧表达式 `path.join(CFG.winLib, 'styles')`（逐字节相同）；
      //   设了覆盖点（仅变异测试用）时，计数**跟着覆盖点走**（与闸门/工单看同一棵树）。
      //   注：下面的 label 仍显示 `CFG.winLib`（那是「库身份」）；生产环境不设覆盖点，两者恒一致。
      try { n = fs.readdirSync(resolveStylesRoot(CFG.winLib)).length; } catch { /* ignore */ }
      items.push(ok('lib.win', 'Windows 库', `${CFG.winLib} · ${n} 个风格目录`));
    } else {
      items.push(fail('lib.win', 'Windows 库', `${CFG.winLib} 不存在`,
        LIB_WIN_FIX));
    }
    // 字体 / 采样库（只在 WSL 库存在时判断）
    if (libOk) {
      const fonts = Number(kv.fonts || 0);
      items.push(fonts >= 900
        ? ok('assets.fonts', '字体', `${fonts} 个字体文件`)
        : warn('assets.fonts', '字体', `只有 ${fonts} 个（预期 ~966）`,
            ASSETS_FONTS_FIX));
      // ★★ 2026-10-11（按库可见）：文案补上「按库」事实 —— 装完**单个**库之后不再是
      //   「只有 N 个文件（预期 ~3869）」这种「看不出装了哪个」的说法，而是
      //   `N 个文件（预期 ~3869）· 1/5 个采样库已装（缺：…）`。
      //   ★ 状态判据仍是 `inst >= 3000`（**未改**，见 `instrumentLibState` 的说明）。
      //   ★★ 2026-10-11（同日第三批）：`fix` 文案**已收口成一处** —— 正文只写在
      //     `ASSETS_INST_FIX`（本文件上方），这里引用它；`lib/resources.mjs` 的 assets.inst
      //     台账条目与 `lib/setup.mjs` 的 fixturePartialAssets() 也都改成引用同一个常量。
      //     起因：这句话原本抄了三份且**无闸门守** ⇒ 三份会各自漂。零行为变更（值逐字节相同）。
      const inst = Number(kv.inst || 0);
      const instCounts = Object.fromEntries(INSTRUMENT_LIBS.map((l) => [l.name, Number(kv[INST_LIB_KEY + l.name] || 0)]));
      const instState = instrumentLibState(inst, instCounts);
      items.push(instState.status === 'ok'
        ? ok('assets.inst', '乐器采样库', instState.detail)
        : warn('assets.inst', '乐器采样库', instState.detail, ASSETS_INST_FIX));
    }
    // 同步脚本
    items.push(fs.existsSync(CFG.syncScript)
      ? ok('tool.sync', '库同步脚本', CFG.syncScript)
      : fail('tool.sync', '库同步脚本', `${CFG.syncScript} 不存在`,
          TOOL_SYNC_FIX));
    groups.push({ title: '库与素材', items });
  }

  return finalize(groups);
}

function finalize(groups) {
  const all = groups.flatMap((g) => g.items);
  const n = (s) => all.filter((i) => i.status === s).length;
  return {
    groups,
    summary: { total: all.length, ok: n('ok'), warn: n('warn'), fail: n('fail') },
    // ★ 咨询性结论：只有 fail 才算「跑不了」，warn 一律不阻断
    runnable: n('fail') === 0,
    drift: driftCheck(),
    checkedAt: new Date().toISOString(),
  };
}

// ── 宿主临时脚本的清理：判据与实现都在 `lib/host-scripts.mjs`（**只写那一处**）──────────────
// ★ 本模块的 `runWsl`（上面）产出的是 `_web-probe-*` —— 实测 `D:\WSL` 下 **47 个**，比编排器的
//   `_lemo-*`（6 个）多得多，是本机残留的**主力**。本批把它的前缀并进共享模块的前缀判据
//   （`_lemo-*` + `lemo-lib-sync` + `_web-probe`）⇒ 编排器启动时的清扫会一并清掉；
//   本模块这边只做「登记 + 摘除」，于是 exit 钩子也覆盖本模块的产物。
// ★ 这里**故意不调用** `sweepStaleHostScripts`：本模块顶层要保持「无副作用」——
//   `lib/briefs.mjs:67`、`test/setup-api.test.mjs:41`、`test/ui.test.mjs`（★ 用**符号锚**、不写行号：
//   该文件正被另一批改动，行号在漂）、`test/voices-api.test.mjs:47`、`test/dub-api.test.mjs:107`
//   五处注释都记着这条不变量，
//   而 `test/gate-blindness.test.mjs` 还会整棵拷树后 import 它。⇒ 启动清扫只在编排器侧做一次
//   （那里才是「一次出片」的入口）。★ 共享模块那边也做了配合：exit 钩子是**首次登记时**才挂的
//   ⇒ 「import 本模块」这件事仍然零副作用。
// ★ import 写在**文件尾**：本文件前段的行号被多处散文引用（如 `test/briefs.test.mjs:48` 引 `:33`）
//   ⇒ 在文件头插行会整体推后那些行号；只在本文件尾部追加，前段行号逐行不变。
import { registerHostScript, unregisterHostScript } from './host-scripts.mjs';
