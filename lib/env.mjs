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
  //       **不是纯字符串字面量** ⇒ **`driftCheck()` 对这两个 key 已经静默失明**（它不会报漂移，也不会报失明）。
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
export function run(exe, args, opts = {}) {
  return new Promise((resolve) => {
    let p;
    // ★ stdin 必须是 'ignore'（= /dev/null），不能用默认的 pipe —— 与 lib/dub-core.mjs:488-492 同一处坑：
    //   WSL 的 Windows 互操作（/init + *.exe）会去读 stdin，pipe 永远没有数据也没有 EOF ⇒ **永久挂住**
    //   （实测：同一条命令在交互 shell 里能跑，从 Node spawn 就静默挂死）。
    //   stdout/stderr 保持 'pipe'（下面按 'data' 收集，语义不变）；放 ...opts 之前 ⇒ 调用方仍可用 opts 覆盖。
    try {
      p = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    } catch (e) {
      return resolve({ code: -1, stdout: '', stderr: '', error: e });
    }
    let stdout = '', stderr = '';
    p.stdout?.on('data', (d) => { stdout += d; });
    p.stderr?.on('data', (d) => { stderr += d; });
    p.on('error', (e) => resolve({ code: -1, stdout, stderr, error: e }));
    p.on('close', (code) => resolve({ code, stdout, stderr }));
  });
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
  return run('wsl.exe', ['-d', CFG.wslDistro, '-u', 'root', '--', 'bash', '-c', cmd],
    // ★ 不传 stdio ⇒ 走 run() 的默认 ['ignore','pipe','pipe']（stdin=/dev/null）——
    //   这正是 WSL 互操作**必须**的（读 stdin 会永久挂住，见 run() 的说明）。
    { env: { ...process.env, WSL_UTF8: '1' } });
}

export function findFfmpegDir() {
  for (const d of CFG.ffmpegDirs) {
    try { if (fs.existsSync(path.join(d, 'ffmpeg.exe'))) return d; } catch { /* ignore */ }
  }
  return null;
}

// ── 漂移自检：路径常量有没有和编排器跑偏 ─────────────────────
export function driftCheck() {
  const out = [];
  let src;
  try { src = fs.readFileSync(ORCH, 'utf8'); }
  catch { return [{ id: 'drift', level: 'warn', msg: `读不到编排器 ${ORCH}，无法做路径漂移自检` }]; }
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
    if (got !== null && got !== v) out.push({ id: `drift.${k}`, level: 'warn', msg: `路径常量漂移：${k} 本模块='${v}' 编排器='${got}'` });
  }
  return out;
}

// ── 单项检查工具 ────────────────────────────────────────────
const ok = (id, label, detail = '') => ({ id, label, status: 'ok', detail });
const warn = (id, label, detail = '', fix = '') => ({ id, label, status: 'warn', detail, fix });
const fail = (id, label, detail = '', fix = '') => ({ id, label, status: 'fail', detail, fix });

// ── 主入口：全量自检 ────────────────────────────────────────
export async function checkEnv() {
  const groups = [];

  // ===== 1. 本机（Windows）=====
  {
    const items = [];
    if (process.platform === 'win32') items.push(ok('win.platform', '平台', `win32 · Node ${process.version}`));
    else items.push(fail('win.platform', '平台', `当前 ${process.platform}`, '本控制台必须在 Windows 侧运行（GPU 渲染需要）'));

    const ff = findFfmpegDir();
    if (ff) {
      const r = await run(path.join(ff, 'ffmpeg.exe'), ['-hide_banner', '-version']);
      items.push(r.code === 0
        ? ok('win.ffmpeg', 'Windows ffmpeg', `${ff} · ${(r.stdout.split('\n')[0] || '').slice(0, 60)}`)
        : fail('win.ffmpeg', 'Windows ffmpeg', `${ff} 但执行失败`, '检查该目录下 ffmpeg.exe 是否可运行'));
    } else {
      items.push(fail('win.ffmpeg', 'Windows ffmpeg', `候选目录都没有 ffmpeg.exe：${CFG.ffmpegDirs.join(' / ')}`,
        '下载 ffmpeg 完整版（含 nvenc）放到候选目录之一；或改 lemo-make.mjs 的 CFG.ffmpegDirs'));
    }

    // GPU：Windows 侧用 wmic 查显卡名（拿不到就 warn，不作为 fail —— 无卡也能回退软渲染）
    const g = await run('powershell.exe', ['-NoProfile', '-Command',
      "(Get-CimInstance Win32_VideoController | Select-Object -First 3 -ExpandProperty Name) -join ' | '"]);
    const names = (g.stdout || '').trim();
    items.push(names
      ? ok('win.gpu', '显卡', names)
      : warn('win.gpu', '显卡', '查不到显卡信息', '若渲染很慢，检查是否装了显卡驱动（WSL 侧拿不到 GPU 是正常的，渲染走 Windows）'));

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
        `确认已安装：wsl.exe -l -v；若发行版名不同，改 lemo-make.mjs 的 CFG.wslDistro`));
      groups.push({ title: 'WSL', items });
      return finalize(groups);
    }
    items.push(ok('wsl.alive', 'WSL 可用性', `${CFG.wslDistro} · 内核 ${lines[1] || '?'}`));
    items.push(lines[2] && lines[2] !== '-'
      ? ok('wsl.node', 'WSL Node', lines[3] || '?')
      : fail('wsl.node', 'WSL Node', '找不到 node', '在 WSL 里安装 Node 20+（推荐 nvm 或 nodesource）'));
    items.push(lines[4] && lines[4] !== '-'
      ? ok('wsl.ffmpeg', 'WSL ffmpeg', lines[5] || '?')
      : fail('wsl.ffmpeg', 'WSL ffmpeg', '找不到 ffmpeg', 'sudo apt install ffmpeg（混流要用，且需带 h264_nvenc）'));

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
        `cd ${CFG.wslLib} && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`));
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
    const w = await runWsl(
      `L="${CFG.wslLib}"; ` +
      '[ -d "$L" ] && echo "LIB_OK" || echo "LIB_MISSING"; ' +
      'echo "demos=$(ls -d $L/styles/*/demo 2>/dev/null | wc -l)"; ' +
      'echo "fonts=$(find $L -type f \\( -name "*.ttf" -o -name "*.otf" -o -name "*.woff2" \\) 2>/dev/null | wc -l)"; ' +
      'echo "inst=$(find $L/core/audio/instruments -type f 2>/dev/null | wc -l)"; ' +
      '[ -d "$L/.git" ] && echo "git=$(git -C $L rev-parse --short HEAD 2>/dev/null)" || echo "git=-"',
      { name: '_web-probe' });
    const kv = Object.fromEntries((w.stdout || '').trim().split('\n')
      .filter((l) => l.includes('=')).map((l) => l.split('=').map((s) => s.trim())));
    const libOk = (w.stdout || '').includes('LIB_OK');

    if (!libOk) {
      items.push(fail('lib.wsl', 'WSL 库', `${CFG.wslLib} 不存在`,
        `git clone https://github.com/lemomo-ai/lemo-opuscar.git ${CFG.wslLib}`));
    } else {
      const demos = Number(kv.demos || 0);
      items.push(demos >= 43
        ? ok('lib.wsl', 'WSL 库', `${CFG.wslLib} · ${demos} 个 demo${kv.git && kv.git !== '-' ? ` · ${kv.git}` : ''}`)
        : warn('lib.wsl', 'WSL 库', `只有 ${demos} 个 demo（预期 43）`, '可能 clone 不完整，重新 clone'));
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
        '首次运行会自动从 WSL 库同步过去（跑一次 lemo-make 即可）'));
    }
    // 字体 / 采样库（只在 WSL 库存在时判断）
    if (libOk) {
      const fonts = Number(kv.fonts || 0);
      items.push(fonts >= 900
        ? ok('assets.fonts', '字体', `${fonts} 个字体文件`)
        : warn('assets.fonts', '字体', `只有 ${fonts} 个（预期 ~966）`,
            '跑 D:\\WSL\\fetch-all-fonts.sh 补齐（幂等）'));
      const inst = Number(kv.inst || 0);
      items.push(inst >= 3000
        ? ok('assets.inst', '乐器采样库', `${inst} 个文件`)
        : warn('assets.inst', '乐器采样库', `只有 ${inst} 个文件（预期 ~3869）`,
            '采样库被 .gitignore 排除时需单独获取，见库内 core/audio/instruments/README'));
    }
    // 同步脚本
    items.push(fs.existsSync(CFG.syncScript)
      ? ok('tool.sync', '库同步脚本', CFG.syncScript)
      : fail('tool.sync', '库同步脚本', `${CFG.syncScript} 不存在`,
          '这是编排器步骤 2 依赖的脚本，缺失会导致同步失败'));
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
