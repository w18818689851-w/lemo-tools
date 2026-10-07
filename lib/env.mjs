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
  wslLib: '/home/lemo/lemo-opuscar',
  winLib: 'D:\\lemo-opuscar',
  tmpDir: 'D:\\WSL',
  // ★ 成片根：**唯一**口径 —— 覆盖点 `LEMO_FILM_DIR`。
  //   不设时**逐字节等价于**原硬编码字面量 `'D:\\lemo-films'`；设了就 `path.resolve` 它。
  //   由来：`.console`（lib/store.mjs）早就认这个变量，而本模块硬编码 ⇒ 同一个「成片根」两套口径，
  //   于是从 CFG.exportDir 派生的 `.briefs` / `_jobs` / `dub` 无法在临时树上隔离
  //   （实测：并行的两个 test/briefs.test.mjs 会共享 `D:\lemo-films\.briefs` 而互撞）。
  //   变量名与默认值与 `lib/store.mjs` / `scripts/prune-jobs.mjs` 的 FILM_DIR **同名同义**。
  exportDir: process.env.LEMO_FILM_DIR ? path.resolve(process.env.LEMO_FILM_DIR) : 'D:\\lemo-films',
  ffmpegDirs: ['D:\\ffmpeg-9.x\\ffmpeg-9.0.2-full_build\\bin', 'D:\\Feijian\\_internal'],
  syncScript: 'D:\\WSL\\lemo-lib-sync.sh',
};

// ── 底层：异步 spawn（本环境 spawnSync 一律 EBUSY）────────────
export function run(exe, args, opts = {}) {
  return new Promise((resolve) => {
    let p;
    try {
      p = spawn(exe, args, { windowsHide: true, ...opts });
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
        ? ok('wsl.venv', 'Python venv', `${pl[1] || '?'} · 10/10 包就位`)
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
