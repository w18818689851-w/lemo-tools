// lib/setup.mjs —— 首次运行「自动安装」向导（**只读 env.mjs 的检测结果，不重复实现判据**）
//
// ★ 定位：lib/env.mjs 负责「检测 + 说人话的 fix 提示」，本模块负责把那些提示**升级成
//   可执行的安装动作**，并真的去执行。检测判据仍然只有 env.mjs 一处 —— 这里**不改它**，
//   只消费它返回的 `{ id, label, status, detail, fix }`。
//
// ★ 为什么把「计划」和「执行」拆开：
//   这台机器环境已完全就绪（实测 12/12 ok），所以「缺什么就装什么」的分支**在本地根本走不到**。
//   若把决策逻辑焊死在执行里，就等于交出一份从没跑过的代码。
//   所以：
//     - planActions(envResult) 是**纯函数** —— 喂任何一份 envResult（包括合成的「干净机器」）
//       都能算出动作清单，于是每个分支都能被演练与单测覆盖（见 FIXTURES / --simulate）。
//     - runSteps(...) 是执行器，只认步骤描述，不参与决策。
//
// ★ 自动 / 手动的分界（本项目反复强调的一点，必须在 UI 上体现）：
//   自动 = 本机能替你跑完的（git clone / apt / pip / 跑仓库里的脚本）
//   手动 = 必须由人做的（装 WSL 发行版要重启、装 Windows 侧 ffmpeg 二进制、装显卡驱动）
//   手动项**不提供执行按钮**，只给逐步指引 —— 假装能自动做才是真的坑人。
//
// ★ 执行层纪律（都是本环境实测踩过的坑）：
//   - 本环境 child_process.spawnSync 对任何可执行文件都返回 EBUSY → 一律异步 spawn。
//   - WSL 一律走「脚本文件 + sed 去 CR」，不用内联 bash（内联会吃掉变量）。
//   - 临时文件写 D:\WSL（非 C 盘），文件名带 `st-` 前缀，逐个清理。
//   - 需要 root 的步骤用 `wsl.exe -u root`（WSL 免密），需要用户身份的用 `su - lemo`。

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { CFG, checkEnv } from './env.mjs';

// ── 常量 ────────────────────────────────────────────────────
const TMP_DIR = CFG.tmpDir;                    // D:\WSL
const TMP_PREFIX = 'st-setup';                 // 本模块的临时文件前缀（清理时按前缀逐个列举）
const MIN = 60 * 1000;

/** 默认超时（毫秒）。git clone 6GB / 下载 1.4GB 采样库都很慢，别用默认值把它们掐死。 */
export const TIMEOUTS = {
  quick: 5 * MIN,
  apt: 20 * MIN,
  pip: 40 * MIN,
  clone: 90 * MIN,
  download: 120 * MIN,
};

// ── 步骤描述（纯数据，可序列化）──────────────────────────────
//
// 三种形态：
//   { kind:'wsl',      script, asRoot }  → 把 script 写到 D:\WSL 再经 wsl.exe 执行
//   { kind:'wsl-file', hostPath, args }  → 把宿主机上已有的脚本读出来，原样送进 WSL 执行
//                                          （与编排器步骤 2 跑 lemo-lib-sync.sh 的方式逐字一致）
//   { kind:'exe',      exe, args, cwd }  → 直接在 Windows 侧起进程
const wsl = (label, script, opts = {}) => ({
  kind: 'wsl', label, script, asRoot: !!opts.asRoot,
  timeoutMs: opts.timeoutMs || TIMEOUTS.quick, estBytes: opts.estBytes || 0,
});
const wslFile = (label, hostPath, opts = {}) => ({
  kind: 'wsl-file', label, hostPath, args: opts.args || '', asRoot: !!opts.asRoot,
  timeoutMs: opts.timeoutMs || TIMEOUTS.quick, estBytes: opts.estBytes || 0,
});

// ── 安装动作目录 ────────────────────────────────────────────
//
// 键 = lib/env.mjs 的 item.id。值是**函数**：吃那一项检测结果，吐结构化动作
// （因为有些动作要引用 detail，比如「缺哪几个包」）。
//
// 为什么优先用上游 `plugin/skills/lemo-opuscar/scripts/setup.sh deps`：
//   它是**仓库自己的官方安装器**（npm install + playwright 浏览器 + venv + 三档 requirements，
//   并且用 package.json/requirements 的校验和做幂等标记）。自己另写一套 pip 命令 = 判据两处，
//   迟早和上游漂移。只有上游没覆盖的（apt 装 ffmpeg/Node、字体、采样库、WSL→Windows 同步）
//   才由本模块自己拼命令。找不到 setup.sh 时**才**退回手工 venv+pip（见 wsl.venv 的脚本）。

const AUTO = {
  'wsl.ffmpeg': (it) => ({
    id: 'wsl.ffmpeg',
    envIds: ['wsl.ffmpeg'],
    kind: 'auto',
    title: '安装 WSL 侧 ffmpeg',
    why: it.detail,
    fixHint: it.fix,
    impact: '混流（编排器 [6]）在 WSL 侧跑，缺 ffmpeg 会直接失败',
    estBytes: 120e6,
    steps: [wsl('apt-get install -y ffmpeg', `
set -e
export DEBIAN_FRONTEND=noninteractive
if command -v ffmpeg >/dev/null 2>&1; then echo "已存在：$(ffmpeg -version 2>/dev/null | head -1) → 跳过"; exit 0; fi
echo "→ apt-get update"
apt-get update -qq
echo "→ apt-get install -y ffmpeg"
apt-get install -y ffmpeg
echo "→ 校验"
ffmpeg -version | head -1
`, { asRoot: true, timeoutMs: TIMEOUTS.apt })],
  }),

  'wsl.node': (it) => ({
    id: 'wsl.node',
    envIds: ['wsl.node'],
    kind: 'auto',
    title: '安装 WSL 侧 Node 20',
    why: it.detail,
    fixHint: it.fix,
    impact: '库里的 video.mjs / playwright 渲染器需要 Node；上游 setup.sh 也要求 npm',
    estBytes: 60e6,
    steps: [wsl('安装 Node 20（NodeSource 官方源）', `
set -e
export DEBIAN_FRONTEND=noninteractive
if command -v node >/dev/null 2>&1; then echo "已存在：$(node --version) → 跳过"; exit 0; fi
apt-get update -qq
apt-get install -y ca-certificates curl gnupg
echo "→ 取 NodeSource 20.x 安装脚本"
curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/${TMP_PREFIX}-nodesource.sh
bash /tmp/${TMP_PREFIX}-nodesource.sh
echo "→ apt-get install -y nodejs"
apt-get install -y nodejs
rm -f /tmp/${TMP_PREFIX}-nodesource.sh
echo "→ 校验"
node --version
`, { asRoot: true, timeoutMs: TIMEOUTS.apt })],
  }),

  // venv 缺失 与 venv 缺包 **合成一个动作**：都跑官方安装器即可（它自带幂等校验和）。
  // 这样就不必去解析 detail 里的「缺 N 个包：a, b」—— 解析字符串是脆弱判据，能免则免。
  'wsl.venv': (it) => ({
    id: 'wsl.venv',
    envIds: ['wsl.venv'],
    kind: 'auto',
    title: '安装 Python 依赖（venv + npm + 无头浏览器）',
    why: it.detail,
    fixHint: it.fix,
    impact: '音频合成、TTS、混流都跑在 WSL 的 .venv 里；缺包会让 [4]/[5] 步骤报错',
    estBytes: 900e6,
    steps: [wsl('上游官方安装器 setup.sh deps voice music', `
set -e
L="${CFG.wslLib}"
if [ ! -d "$L" ]; then echo "✗ 库目录 $L 不存在 —— 请先跑「clone WSL 库」那一步"; exit 2; fi
cd "$L"
if [ -x plugin/skills/lemo-opuscar/scripts/setup.sh ]; then
  echo "→ 用上游官方安装器：setup.sh deps voice music（自带幂等校验和）"
  sh plugin/skills/lemo-opuscar/scripts/setup.sh deps voice music
else
  echo "! 找不到上游 setup.sh（clone 不完整？）→ 退回手工 venv + pip"
  [ -x .venv/bin/python ] || python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
  for f in requirements-voice.txt requirements-music.txt; do
    [ -f "$f" ] && { echo "→ pip install -r $f"; .venv/bin/pip install -r "$f"; } || true
  done
fi
echo "→ 校验关键包（与 env.mjs 的检查清单一致）"
V="$L/.venv/bin/python"
if [ ! -x "$V" ]; then echo "✗ .venv/bin/python 仍不可执行"; exit 3; fi
miss=""
for m in numpy scipy soundfile soxr PIL numba librosa kokoro_onnx faster_whisper; do
  if "$V" -c "import $m" 2>/dev/null; then echo "  + $m"; else echo "  - $m"; miss="$miss $m"; fi
done
if [ -n "$miss" ]; then echo "✗ 仍有包缺失：$miss"; exit 4; fi
echo "✓ Python 依赖就位：$("$V" --version 2>&1)"
`, { timeoutMs: TIMEOUTS.pip })],
  }),

  // ★ 库缺失 与 库不完整（demo 数不足）**合成同一个动作**，脚本自己判断该 clone 还是该补。
  //   早先按 detail 里有没有「不存在」分成两个动作 —— 那是**解析 env.mjs 的文案**，
  //   env.mjs 改一个字这里就走错分支（实测：合成场景里 detail 换了个说法，动作直接消失）。
  //   现在只在「标题/体积预估」上用一次**正向**匹配（匹配不上就按最坏情况显示），
  //   正确性完全由脚本里的 `[ -f AGENTS.md ]` 判断，不依赖任何文案。
  'lib.wsl': (it) => {
    const incomplete = /只有\s*\d+\s*个\s*demo/.test(it.detail || '');
    return {
      id: 'lib.wsl',
      envIds: ['lib.wsl'],
      kind: 'auto',
      title: incomplete ? '补齐 WSL 库内容（git pull，必要时重新 clone）' : '安装 WSL 库（首次 clone 约 6 GB，很慢）',
      why: it.detail,
      fixHint: it.fix,
      impact: '没有库，编排器的 [1] 环境自检会直接 fail；demo 源文件缺失会让对应风格跑不出片',
      estBytes: incomplete ? 0 : 6.5e9,
      steps: [wsl(incomplete ? 'git pull --ff-only（幂等）' : 'git clone lemo-opuscar', `
set -e
L="${CFG.wslLib}"
if [ ! -f "$L/AGENTS.md" ]; then
  if [ -e "$L" ]; then
    echo "✗ $L 已存在但不是库（缺 AGENTS.md）—— 请先手工确认/清理该目录"
    exit 2
  fi
  echo "→ 库里没有内容，开始 clone（约 6 GB，很慢；可随时取消，重跑会重新开始）"
  mkdir -p "$(dirname "$L")"
  git clone https://github.com/lemomo-ai/lemo-opuscar.git "$L"
else
  echo "→ 库已存在，走「补齐」路径：git pull --ff-only（只快进，绝不覆盖本地改动）"
  cd "$L"
  git pull --ff-only || echo "! pull 失败（离线？）—— 继续按现有内容核验"
fi

echo "→ 核验"
[ -f "$L/AGENTS.md" ] || { echo "✗ clone 完成但缺 AGENTS.md，库不完整"; exit 3; }
n=$(ls -d "$L"/styles/*/demo 2>/dev/null | wc -l)
echo "  AGENTS.md 就位 · demo 数 = $n（env.mjs 的预期是 43）"
if [ "$n" -lt 43 ]; then
  echo "✗ demo 只有 $n 个（预期 43）。常见原因：clone 用了 sparse checkout（上游 setup.sh 的默认行为会排除 styles/*/demo/）。"
  echo "  处理办法（二选一）："
  echo "    a) 关闭 sparse：git -C \\"$L\\" sparse-checkout disable && git -C \\"$L\\" checkout -- styles"
  echo "    b) 手工重新完整 clone 一份（见「库与素材 / WSL 库」的指引）"
  exit 4
fi
echo "✓ 库就位"
`, { timeoutMs: incomplete ? TIMEOUTS.apt : TIMEOUTS.clone, estBytes: incomplete ? 0 : 6.5e9 })],
    };
  },

  'assets.fonts': (it) => ({
    id: 'assets.fonts',
    envIds: ['assets.fonts'],
    kind: 'auto',
    title: '补齐字体（跑 fetch-all-fonts.sh，幂等）',
    why: it.detail,
    fixHint: it.fix,
    impact: '缺字体 → 字幕/标题排版回退成默认字体，观感明显变差',
    estBytes: 200e6,
    steps: [wslFile('bash D:\\WSL\\fetch-all-fonts.sh', `${TMP_DIR}\\fetch-all-fonts.sh`, {
      timeoutMs: TIMEOUTS.download,
    })],
  }),

  'assets.inst': (it) => ({
    id: 'assets.inst',
    envIds: ['assets.inst'],
    kind: 'auto',
    title: '下载乐器采样库（约 1.4 GB，可断点续传）',
    why: it.detail,
    fixHint: it.fix,
    impact: '缺采样库 → 配乐只能用物理建模合成，音色差一档',
    estBytes: 1.4e9,
    steps: [wsl('sh tools/fetch.sh instruments all', `
set -e
L="${CFG.wslLib}"
cd "$L"
if [ ! -f tools/fetch.sh ]; then echo "✗ 找不到 $L/tools/fetch.sh"; exit 2; fi
echo "→ 下载 5 个采样库，共约 1.4 GB；中断后重跑同一命令会自动续传"
sh tools/fetch.sh instruments all
echo "→ 校验"
echo "inst=$(find $L/core/audio/instruments -type f 2>/dev/null | wc -l)"
`, { timeoutMs: TIMEOUTS.download, estBytes: 1.4e9 })],
  }),

  // Windows 库缺失：编排器自己会在 [2] 步骤里从 WSL 同步过去（跑一次 lemo-make 即可）。
  // 这里提供「现在就跑同步」的按钮，省得用户为了建目录先跑一整轮。
  'lib.win': (it) => ({
    id: 'lib.win',
    envIds: ['lib.win'],
    kind: 'auto',
    title: '从 WSL 库同步到 Windows（跑 lemo-lib-sync.sh push）',
    why: it.detail,
    fixHint: it.fix,
    impact: 'Windows 侧渲染要读 Windows 库里的风格与素材',
    estBytes: 0,
    steps: [wslFile('bash D:\\WSL\\lemo-lib-sync.sh push', CFG.syncScript, {
      args: 'push', timeoutMs: TIMEOUTS.pip,
    })],
  }),
};

const MANUAL = {
  'win.ffmpeg': (it) => ({
    id: 'win.ffmpeg',
    envIds: ['win.ffmpeg'],
    kind: 'manual',
    title: '安装 Windows 侧 ffmpeg',
    why: it.detail,
    fixHint: it.fix,
    impact: 'Windows 侧渲染（含 nvenc 硬编）依赖它',
    manual: {
      note: '「这一步需要你手动做」：这是一个几百 MB 的二进制包，控制台不替你下载。',
      steps: [
        '打开 https://www.gyan.dev/ffmpeg/builds/ 下载「full build」（只有 full 才带 nvenc）',
        '解压，把里面的 bin 目录放到下列候选位置之一（或改 lemo-make.mjs 的 CFG.ffmpegDirs）',
        `  · ${CFG.ffmpegDirs[0]}`,
        `  · ${CFG.ffmpegDirs[1]}`,
        '确认 <目录>\\ffmpeg.exe 存在，回来点「重新检测」',
      ],
      links: [
        { label: 'gyan.dev · FFmpeg full builds', url: 'https://www.gyan.dev/ffmpeg/builds/' },
      ],
    },
  }),

  'wsl.alive': (it) => ({
    id: 'wsl.alive',
    envIds: ['wsl.alive'],
    kind: 'manual',
    title: '安装 WSL 发行版',
    why: it.detail,
    fixHint: it.fix,
    impact: '没有 WSL 就没有音频合成/混流，编排器完全跑不起来',
    manual: {
      note: `「这一步需要你手动做」：安装发行版要重启系统，控制台无法代劳。`,
      steps: [
        `以管理员身份打开 PowerShell（或 cmd），执行： wsl --install -d ${CFG.wslDistro}`,
        '「重启电脑」（安装内核与发行版后必须重启）',
        `重启后首次进入 ${CFG.wslDistro}，建好用户 ${CFG.wslUser}（或改 lemo-make.mjs 的 CFG.wslUser）`,
        '确认：wsl.exe -l -v 能看到该发行版且状态为 Running',
        '回来点「重新检测」',
      ],
      links: [
        { label: '微软官方文档 · 安装 WSL', url: 'https://learn.microsoft.com/windows/wsl/install' },
      ],
    },
  }),

  'win.platform': (it) => ({
    id: 'win.platform',
    envIds: ['win.platform'],
    kind: 'manual',
    title: '必须在 Windows 侧运行',
    why: it.detail,
    fixHint: it.fix,
    impact: 'GPU 渲染走 Windows，WSL/Linux 侧跑不了',
    manual: {
      note: '「这一步需要你手动做」：控制台必须在 Windows 上启动（GPU 渲染走 Windows，WSL/Linux 侧跑不了）。',
      steps: ['把整个 lemo-tools 目录拷到 Windows 侧，再在 Windows 上用 node 启动 server.mjs。'],
    },
  }),

  'win.gpu': (it) => ({
    id: 'win.gpu',
    envIds: ['win.gpu'],
    kind: 'manual',
    title: '安装/更新显卡驱动',
    why: it.detail,
    fixHint: it.fix,
    impact: '没有驱动会回退软渲染，慢很多（但「不会」失败）',
    manual: {
      note: '「这一步需要你手动做」：驱动安装需要管理员权限且要重启。',
      steps: [
        'NVIDIA 用户：装最新 Game Ready / Studio 驱动（nvenc 随驱动提供）',
        'AMD/Intel 用户：装最新驱动，然后改 --venc libx264 用软件编码',
        '装完回来点「重新检测」',
      ],
      links: [{ label: 'NVIDIA 驱动下载', url: 'https://www.nvidia.cn/geforce/drivers/' }],
    },
  }),

  'tool.sync': (it) => ({
    id: 'tool.sync',
    envIds: ['tool.sync'],
    kind: 'manual',
    title: '获取库同步脚本 lemo-lib-sync.sh',
    why: it.detail,
    fixHint: it.fix,
    impact: '缺它 → 编排器 [2] 只 warn 并跳过同步（不会让任务失败），但 WSL/Windows 两份库会不一致',
    manual: {
      note: `「这一步需要你手动做」：该脚本由项目维护方的 sync-builder 产出，不在公开仓库里。`,
      steps: [
        `向项目维护者索取 lemo-lib-sync.sh，放到：${CFG.syncScript}`,
        '（临时替代方案：手工把 WSL 库的 styles/ 与 core/ 拷到 Windows 库，效果等价）',
        '回来点「重新检测」',
      ],
    },
  }),
};

/** 目录里没有显式条目时的兜底：把 env.mjs 的 fix 文本原样升级成「手动指引」。 */
function fallback(it) {
  return {
    id: `fallback.${it.id}`,
    envIds: [it.id],
    kind: 'manual',
    title: `手工处理：${it.label}`,
    why: it.detail,
    fixHint: it.fix,
    impact: '',
    manual: {
      note: '「这一步需要你手动做」（控制台没有对应的自动安装步骤）。',
      steps: [it.fix || '请按 env.mjs 给出的提示处理，然后点「重新检测」。'],
    },
  };
}

// ── 规划器（纯函数）──────────────────────────────────────────
/**
 * 把一份 env 检测结果变成安装动作清单。**不执行任何东西**，可放心单测。
 *
 * @param {object} envResult  checkEnv() 的返回值（或任何同形状的对象 —— 测试时喂合成的即可）
 * @param {object} [opts]
 * @param {string[]} [opts.only]  只保留这些 env item id
 * @returns {Array} 动作清单，fail 在前、warn 在后；ok 项不产生动作
 */
export function planActions(envResult, opts = {}) {
  const items = [];
  for (const g of (envResult && envResult.groups) || []) {
    for (const it of g.items || []) {
      if (it.status === 'ok') continue;
      if (opts.only && !opts.only.includes(it.id)) continue;
      items.push({ ...it, _group: g.title });
    }
  }
  // fail 排在 warn 前面（先修致命的）
  items.sort((a, b) => (a.status === b.status ? 0 : a.status === 'fail' ? -1 : 1));

  const out = [];
  const seen = new Set();
  for (const it of items) {
    const mk = AUTO[it.id] || MANUAL[it.id];
    let act = null;
    try { act = mk ? mk(it) : null; } catch { act = null; }
    if (!act) act = fallback(it);
    if (seen.has(act.id)) continue;      // 同一动作只出一次（如 venv 缺失/缺包合成一条）
    seen.add(act.id);
    out.push({ ...act, status: it.status, group: it._group, label: it.label });
  }
  return out;
}

/** 动作清单 → 索引（UI 与 server 都按 actionId 找）。 */
export function indexActions(actions) {
  const m = new Map();
  for (const a of actions) m.set(a.id, a);
  return m;
}

/**
 * 目录里**静态登记**的动作 id（不含 `lib.wsl.demos` / `fallback.*` 这类按检测结果派生的）。
 * server 用它区分「这个动作存在、只是已经就绪（幂等跳过）」与「压根没这个 id」。
 */
export function knownActionIds() {
  return [...Object.keys(AUTO), ...Object.keys(MANUAL)];
}

/** 把动作整理成「可安全 JSON 化」的形状（不含脚本正文，只留标签/超时/命令摘要）。 */
export function serializeAction(a) {
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    status: a.status,
    group: a.group || '',
    label: a.label || '',
    envIds: a.envIds || [],
    why: a.why || '',
    fixHint: a.fixHint || '',
    impact: a.impact || '',
    estBytes: a.estBytes || 0,
    steps: a.kind === 'auto'
      ? a.steps.map((s) => ({ label: s.label, timeoutMs: s.timeoutMs || 0, cmd: stepCommand(s) }))
      : [],
    manual: a.kind === 'manual'
      ? { note: a.manual.note || '', steps: a.manual.steps || [], links: a.manual.links || [] }
      : null,
  };
}

/**
 * 幂等判据：这个动作对应的检测项现在是不是已经全 ok 了？
 * ★ 用**注入的** envResult 判断，不自己重跑探测 —— 保持纯函数，好测。
 */
export function actionSatisfied(action, envResult) {
  const byId = new Map();
  for (const g of (envResult && envResult.groups) || []) {
    for (const it of g.items || []) byId.set(it.id, it);
  }
  return (action.envIds || []).every((id) => byId.get(id)?.status === 'ok');
}

// ── 步骤 → 可执行命令（供 dry-run / simulate 打印，也供执行器用）──
export function stepCommand(step) {
  if (step.kind === 'exe') return [step.exe, ...(step.args || [])].join(' ');
  const target = step.kind === 'wsl-file'
    ? `(读 ${step.hostPath} 的内容)${step.args ? ' ' + step.args : ''}`
    : '(内联脚本)';
  return `wsl.exe -d ${CFG.wslDistro} -u ${step.asRoot ? 'root' : CFG.wslUser} -- bash <<'ST' ${target} ST`;
}

/** 人读的动作摘要（simulate / dry-run 用）。 */
export function describeAction(a, { verbose = true } = {}) {
  const L = [];
  L.push(`● [${a.kind === 'auto' ? '可自动' : '需手动'}] ${a.title}   (${a.id})`);
  L.push(`    触发：${a.label} = ${a.status}`);
  L.push(`    原因：${a.why}`);
  if (a.fixHint) L.push(`    env.fix 原话：${a.fixHint}`);
  if (a.impact) L.push(`    影响：${a.impact}`);
  if (a.estBytes) L.push(`    预计体积：约 ${(a.estBytes / 1e6).toFixed(0)} MB`);
  if (a.kind === 'auto' && verbose) {
    for (const s of a.steps) {
      L.push(`    将要执行：${s.label}`);
      L.push(`      超时 ${Math.round((s.timeoutMs || 0) / 60000)} 分钟 · ${stepCommand(s)}`);
    }
  } else if (a.kind === 'manual' && verbose) {
    L.push(`    指引（${a.manual.note}）：`);
    for (const s of a.manual.steps) L.push(`      - ${s}`);
    for (const l of a.manual.links || []) L.push(`      链接：${l.label} ${l.url}`);
  }
  return L.join('\n');
}

// ── 执行器（不参与决策）─────────────────────────────────────

/** 按行切分（\r 也算行界 —— 进度条原地刷新要靠它）。 */
function makeLineFeed(onLine, stream) {
  let buf = '';
  return {
    feed(chunk) {
      buf += chunk;
      const parts = buf.split(/\r\n|\r|\n/);
      buf = parts.pop();
      for (const p of parts) onLine(p, stream);
    },
    flush() { if (buf) { onLine(buf, stream); buf = ''; } },
  };
}

function writeWslTemp(name, content, uniq) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const host = path.join(TMP_DIR, `${uniq}.sh`);
  // 行尾一律归一成 LF：脚本是从 Windows 侧写过去的，CR 会让 bash 报 `$'\r': command not found`
  const body = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // ★ 第一行把**自己的 pid** 写下来 —— 配合下面的 setsid，这个 pid 就是新进程组的 PGID，
  //   取消时靠它把整组（bash + git clone + apt …）一起干掉。见 killWslGroupCommand。
  const head = `echo $$ > /tmp/${uniq}.pgid 2>/dev/null || true\n`;
  fs.writeFileSync(host, head + body, 'utf8');
  const inner = `/mnt/${host[0].toLowerCase()}${host.slice(2).replace(/\\/g, '/')}`;
  return { uniq, host, inner };
}

/**
 * 「把 WSL 侧那一整组进程杀掉」的 bash 片段。
 *
 * ★ 为什么必须有它：Windows 侧的 `taskkill /T /F` 只杀 Windows 进程树。
 *   WSL2 里的进程跑在虚拟机里，**不是** wsl.exe 的 Windows 子进程 —— 实测取消一个
 *   `sleep 40` 之后，Linux 侧的 sleep 依然活着跑到自然结束。取消一个 6 GB 的 clone
 *   却让它在后台继续下载，是这个功能里最不能接受的失败模式。
 *
 * ★ 做法：脚本用 `setsid -w` 起，自己成为新会话/进程组的组长；首行把 $$（= PGID）写到
 *   /tmp/<uniq>.pgid。取消时另起一条 wsl.exe 把整组 TERM→KILL。
 *
 * ★ 为什么把 uniq 拆成两半再拼（`P="abc""def"`）：这样这条 kill 命令**自己的**命令行里
 *   不含连续的 uniq，`pkill -f "$P"` 就不会误伤自己（也不会打断自己的后半段）。
 */
function killWslGroupCommand(uniq) {
  const half = Math.ceil(uniq.length / 2);
  const pat = `"${uniq.slice(0, half)}""${uniq.slice(half)}"`;
  return [
    `P=${pat}`,
    'F="/tmp/$P.pgid"',
    'G=$(cat "$F" 2>/dev/null || true)',
    'if [ -n "$G" ]; then',
    '  kill -TERM -- "-$G" 2>/dev/null || true',
    '  sleep 1',
    '  kill -KILL -- "-$G" 2>/dev/null || true',
    'fi',
    'rm -f "$F"',
    'pkill -TERM -f "$P" >/dev/null 2>&1 || true',   // 兜底：没进组的情况（如 root 侧起的）
    'exit 0',
  ].join('\n');
}

/**
 * 跑一个步骤。**只认步骤描述，不做任何决策。**
 *
 * @param {object} step
 * @param {object} hooks
 * @param {(line:string, stream:string)=>void} hooks.onLine  逐行回调（stdout/stderr 都走这里）
 * @param {(child)=>void} [hooks.onSpawn]  子进程起来时回调（任务队列要拿它来支持取消）
 * @param {(text:string)=>void} [hooks.onTick]  心跳（用于「已耗时」显示）
 * @param {()=>boolean} [hooks.aborted]  返回 true 则中断
 * @returns {Promise<{ok:boolean, code:number|null, ms:number, timeout:boolean, error?:string}>}
 */
export function runStep(step, hooks = {}) {
  const onLine = hooks.onLine || (() => {});
  const started = Date.now();

  return new Promise((resolve) => {
    let child = null;
    let timer = null;
    let tick = null;
    let done = false;
    let timedOut = false;
    let spawnError = null;

    const out = makeLineFeed(onLine, 'stdout');
    const err = makeLineFeed(onLine, 'stderr');

    const cleanup = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (tick) { clearInterval(tick); tick = null; }
    };
    const finish = (code) => {
      if (done) return;
      done = true;
      cleanup();
      out.flush(); err.flush();
      resolve({
        ok: !timedOut && !spawnError && code === 0,
        code, ms: Date.now() - started, timeout: timedOut,
        error: spawnError ? String(spawnError.message || spawnError) : undefined,
      });
    };

    try {
      if (step.kind === 'exe') {
        child = spawn(step.exe, step.args || [], {
          cwd: step.cwd || undefined, windowsHide: true,
          env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
        });
      } else {
        let content;
        let label = step.script || '';
        if (step.kind === 'wsl-file') {
          try { content = fs.readFileSync(step.hostPath, 'utf8'); }
          catch (e) { onLine(`✗ 读不到宿主机脚本 ${step.hostPath}：${e.message}`, 'stderr'); return finish(-1); }
        } else {
          content = label;
        }
        const uniq = `${TMP_PREFIX}-${step.kind === 'wsl-file' ? 'file' : 'inline'}-${process.pid}-${Date.now().toString(36)}`;
        const { host, inner } = writeWslTemp(step.kind === 'wsl-file' ? 'file' : 'inline', content, uniq);
        const asUser = step.asRoot ? 'root' : CFG.wslUser;
        // ★ setsid -w：让脚本成为**独立进程组的组长**，这样取消时能整组干掉（见 killWslGroupCommand）。
        //   -w 保证 setsid 等子进程结束才返回，否则 wsl.exe 会提前退出、日志被截断。
        const innerCmd = `setsid -w bash /tmp/${uniq}.sh ${step.args || ''}`;
        const runAs = step.asRoot ? innerCmd : `su - ${CFG.wslUser} -c "${innerCmd}"`;
        const cmd =
          `trap 'rm -f /tmp/${uniq}.sh /tmp/${uniq}.pgid "${inner}" 2>/dev/null' EXIT\n` +
          `sed 's/\\r$//' '${inner}' > /tmp/${uniq}.sh && chmod 644 /tmp/${uniq}.sh && ` +
          `chown ${asUser} /tmp/${uniq}.sh && ${runAs}`;
        child = spawn('wsl.exe', ['-d', CFG.wslDistro, '-u', 'root', '--', 'bash', '-c', cmd],
          { windowsHide: true, env: { ...process.env, WSL_UTF8: '1' } });
        // ★ 取消时除了杀 Windows 侧进程树，还要把 WSL 侧那一组也杀掉。
        //   挂在 child 上而不是改 jobs.mjs 的签名，是为了让「取消」这条既有路径一行不用重写。
        child._lemoKillExtra = () => {
          try {
            spawn('wsl.exe', ['-d', CFG.wslDistro, '-u', 'root', '--', 'bash', '-c', killWslGroupCommand(uniq)],
              { windowsHide: true, stdio: 'ignore', env: { ...process.env, WSL_UTF8: '1' } });
          } catch { /* 尽力而为 */ }
        };
        // 兜底：万一 WSL 侧的 trap 没执行到，宿主机这份也清掉（文件名唯一，不会误删别人的）
        child.on('close', () => {
          try { fs.unlinkSync(host); } catch { /* 已经没了 */ }
        });
      }
    } catch (e) {
      spawnError = e;
      onLine(`✗ 起进程失败：${e.message}`, 'stderr');
      return finish(-1);
    }

    if (hooks.onSpawn) { try { hooks.onSpawn(child); } catch { /* ignore */ } }
    child.stdout?.on('data', (d) => out.feed(d.toString('utf8')));
    child.stderr?.on('data', (d) => err.feed(d.toString('utf8')));
    child.on('error', (e) => { spawnError = e; finish(-1); });
    child.on('close', (code) => finish(code));

    if (step.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        onLine(`✗ 步骤超时（${Math.round(step.timeoutMs / 60000)} 分钟）—— 终止进程树（含 WSL 侧进程组）`, 'stderr');
        killChild(child);
        setTimeout(() => finish(-1), 1500).unref?.();
      }, step.timeoutMs);
      timer.unref?.();
    }
    // 「已耗时」心跳：clone 6GB 时用户最需要知道的就是「它还在动」
    tick = setInterval(() => {
      const s = Math.round((Date.now() - started) / 1000);
      if (hooks.onTick) hooks.onTick(s);
    }, 10000);
    tick.unref?.();
  });
}

/** 杀进程树（Windows 必须 /T，否则 wsl.exe 的子孙会变成占 GPU 的孤儿）。 */
export function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try { spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* ignore */ }
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ } }
  }
}

/**
 * 杀掉一个子进程「连带它 WSL 侧那一整组」。
 * 见 killWslGroupCommand 的说明：taskkill /T 管不到 WSL2 虚拟机里的进程。
 */
export function killChild(child) {
  if (!child) return;
  if (typeof child._lemoKillExtra === 'function') {
    try { child._lemoKillExtra(); } catch { /* 尽力而为 */ }
  }
  killTree(child.pid);
}

// ── 失败分类（要求「网络失败 / 权限不足 / 磁盘不足 要可区分」）──
const FAIL_PATTERNS = [
  { code: 'DISK', hint: '磁盘空间不足。清理目标分区后重试（WSL 侧看 df -h，Windows 侧看 D 盘剩余）。',
    re: [/No space left on device/i, /ENOSPC/, /not enough space/i, /There is not enough space/i] },
  { code: 'NETWORK', hint: '网络不可达或超时。检查代理/网络后重试；clone 与下载都支持重跑续传。',
    re: [/Could not resolve host/i, /Temporary failure in name resolution/i, /Network is unreachable/i,
      /Failed to connect/i, /Connection timed out/i, /Could not connect/i, /Connection refused/i,
      /unable to access/i, /SSL certificate problem/i, /proxy/i, /timed out/i] },
  { code: 'AUTH', hint: '仓库不存在或没有访问权限。确认 URL 与账号权限。',
    re: [/Repository not found/i, /Authentication failed/i, /could not read Username/i,
      /Permission to .* denied/i, /fatal: repository .* not found/i] },
  { code: 'PERMISSION', hint: '权限不足。需要 root 的步骤请确认 WSL 可用 `wsl -u root`（本控制台默认可用）。',
    re: [/Permission denied/i, /EACCES/, /Operation not permitted/i, /are you root/i, /sudo:/i] },
  { code: 'NOTFOUND', hint: '命令或文件不存在。多半是上一步没做完（比如库还没 clone）。',
    re: [/command not found/i, /No such file or directory/i, /not found/i] },
];

/**
 * 从步骤输出里判失败原因。**只看输出，不改判据** —— 输出里没命中就归到 EXIT。
 * @returns {{code:string, hint:string, evidence:string|null}}
 */
export function classifyFailure(text) {
  const s = String(text || '');
  for (const p of FAIL_PATTERNS) {
    for (const re of p.re) {
      const m = re.exec(s);
      if (m) return { code: p.code, hint: p.hint, evidence: m[0] };
    }
  }
  return { code: 'EXIT', hint: '步骤以非 0 退出。看上面最后几行输出定位原因。', evidence: null };
}

/**
 * 顺序执行一串步骤（任务队列与 CLI 都用它）。
 *
 * ★ 返回里的字段名要分清（踩过一次）：
 *   `exitCode` = 子进程退出码（数字）；`kind` = **失败分类**（NETWORK / PERMISSION / DISK /
 *   NOTFOUND / AUTH / TIMEOUT / CANCELED / EXIT）。早先把分类塞在 `code` 里，和退出码撞名，
 *   结果 `Number.isFinite('AUTH')` 为 false → UI 上退出码恒显示 -1。
 *
 * @param {object[]} steps
 * @param {object} hooks  { onLine, onSpawn, aborted, onStepStart }
 * @returns {Promise<{ok, failedStep?, exitCode, kind, hint, evidence, ms}>}
 */
export async function runSteps(steps, hooks = {}) {
  const onLine = hooks.onLine || (() => {});
  const tail = [];                     // 只留最近若干行，用于失败分类
  const t0 = Date.now();
  const keep = (l) => { tail.push(l); if (tail.length > 60) tail.shift(); };
  const onLine2 = (l, s) => { keep(l); onLine(l, s); };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (hooks.aborted && hooks.aborted()) {
      return { ok: false, exitCode: null, kind: 'CANCELED', hint: '已取消', evidence: null, ms: Date.now() - t0 };
    }
    onLine(`[${i + 1}/${steps.length}] ${step.label}`);
    if (hooks.onStepStart) hooks.onStepStart(step, i);
    const r = await runStep(step, {
      onLine: onLine2,
      onSpawn: hooks.onSpawn,
      onTick: (sec) => onLine(`  ⏱ 已耗时 ${sec}s（本步超时 ${Math.round(step.timeoutMs / 60000)} 分钟）`),
      aborted: hooks.aborted,
    });
    if (r.timeout) {
      return { ok: false, failedStep: i, exitCode: r.code, kind: 'TIMEOUT', evidence: null,
        hint: `步骤超时（${Math.round(step.timeoutMs / 60000)} 分钟）。网络慢或数据量大时，可稍后重跑（clone/下载支持续传）。`,
        ms: Date.now() - t0 };
    }
    if (!r.ok) {
      const c = classifyFailure(tail.join('\n'));
      return { ok: false, failedStep: i, exitCode: r.code, kind: c.code, hint: c.hint, evidence: c.evidence, ms: Date.now() - t0 };
    }
  }
  return { ok: true, exitCode: 0, kind: null, hint: '', evidence: null, ms: Date.now() - t0 };
}

// ── 演练用的合成检测结果 ────────────────────────────────────
//
// ★ 这是本任务的关键：这台机器 12/12 ok，真实检测**永远走不到安装分支**。
//   于是把「一台干净机器会看到什么」写成纯数据，喂给 planActions 就能证明
//   每个安装分支都真的存在、都能被走到（`node lib/setup.mjs --simulate` 会全跑一遍）。
//
// 每项的 detail / fix 尽量与 lib/env.mjs 的实际输出对齐（照抄它生成的字符串格式）。

const it = (id, label, status, detail, fix) => ({ id, label, status, detail, fix: fix || '' });
const grp = (title, items) => ({ title, items });

function envFixture(groups) {
  const all = groups.flatMap((g) => g.items);
  const n = (s) => all.filter((i) => i.status === s).length;
  return {
    groups,
    summary: { total: all.length, ok: n('ok'), warn: n('warn'), fail: n('fail') },
    runnable: n('fail') === 0,
    drift: [],
    checkedAt: new Date().toISOString(),
    _fixture: true,
  };
}

/** 场景一：**全新机器** —— 什么都没装（Windows 也没有 ffmpeg）。 */
export function fixtureClean() {
  return envFixture([
    grp('本机（Windows）', [
      it('win.platform', '平台', 'ok', 'win32 · Node v22.22.2'),
      it('win.ffmpeg', 'Windows ffmpeg', 'fail',
        '候选目录都没有 ffmpeg.exe：D:\\ffmpeg-9.x\\ffmpeg-9.0.2-full_build\\bin / D:\\Feijian\\_internal',
        '下载 ffmpeg 完整版（含 nvenc）放到候选目录之一；或改 lemo-make.mjs 的 CFG.ffmpegDirs'),
      it('win.gpu', '显卡', 'warn', '查不到显卡信息',
        '若渲染很慢，检查是否装了显卡驱动（WSL 侧拿不到 GPU 是正常的，渲染走 Windows）'),
    ]),
    grp('WSL', [
      it('wsl.alive', 'WSL 可用性', 'fail', 'distro=Ubuntu-24.04 探测失败',
        '确认已安装：wsl.exe -l -v；若发行版名不同，改 lemo-make.mjs 的 CFG.wslDistro'),
    ]),
  ]);
}

/** 场景二：WSL 装好了但里面是空的（没 Node / 没 ffmpeg / 没 venv / 没库）。 */
export function fixtureBareWsl() {
  return envFixture([
    grp('本机（Windows）', [
      it('win.platform', '平台', 'ok', 'win32 · Node v22.22.2'),
      it('win.ffmpeg', 'Windows ffmpeg', 'fail', '候选目录都没有 ffmpeg.exe：D:\\ffmpeg-9.x\\ffmpeg-9.0.2-full_build\\bin',
        '下载 ffmpeg 完整版（含 nvenc）放到候选目录之一；或改 lemo-make.mjs 的 CFG.ffmpegDirs'),
      it('win.gpu', '显卡', 'ok', 'NVIDIA GeForce RTX 4060'),
    ]),
    grp('WSL', [
      it('wsl.alive', 'WSL 可用性', 'ok', 'Ubuntu-24.04 · 内核 5.15.167.4-microsoft-standard-WSL2'),
      it('wsl.node', 'WSL Node', 'fail', '找不到 node', '在 WSL 里安装 Node 20+（推荐 nvm 或 nodesource）'),
      it('wsl.ffmpeg', 'WSL ffmpeg', 'fail', '找不到 ffmpeg', 'sudo apt install ffmpeg（混流要用，且需带 h264_nvenc）'),
      it('wsl.venv', 'Python venv', 'fail', '/home/lemo/lemo-opuscar/.venv 不存在或不可执行',
        'cd /home/lemo/lemo-opuscar && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'),
    ]),
    grp('库与素材', [
      it('lib.wsl', 'WSL 库', 'fail', '/home/lemo/lemo-opuscar 不存在',
        'git clone https://github.com/lemomo-ai/lemo-opuscar.git /home/lemo/lemo-opuscar'),
      it('lib.win', 'Windows 库', 'fail', 'D:\\lemo-opuscar 不存在',
        '首次运行会自动从 WSL 库同步过去（跑一次 lemo-make 即可）'),
      it('tool.sync', '库同步脚本', 'fail', 'D:\\WSL\\lemo-lib-sync.sh 不存在',
        '这是编排器步骤 2 依赖的脚本，缺失会导致同步失败'),
    ]),
  ]);
}

/** 场景三：库在、但资产不全（demo 少 / 字体少 / 采样少 / venv 缺包）。 */
export function fixturePartialAssets() {
  return envFixture([
    grp('本机（Windows）', [
      it('win.platform', '平台', 'ok', 'win32 · Node v22.22.2'),
      it('win.ffmpeg', 'Windows ffmpeg', 'ok', 'D:\\ffmpeg-9.x\\ffmpeg-9.0.2-full_build\\bin · ffmpeg version 9.0.2-full_build'),
      it('win.gpu', '显卡', 'ok', 'NVIDIA GeForce RTX 4060'),
    ]),
    grp('WSL', [
      it('wsl.alive', 'WSL 可用性', 'ok', 'Ubuntu-24.04 · 内核 5.15.167.4-microsoft-standard-WSL2'),
      it('wsl.node', 'WSL Node', 'ok', 'v22.22.2'),
      it('wsl.ffmpeg', 'WSL ffmpeg', 'ok', '6.1.1-3ubuntu5'),
      it('wsl.venv', 'Python venv', 'warn', 'Python 3.12.3 · 缺 3 个包：numba, kokoro_onnx, faster_whisper',
        '/home/lemo/lemo-opuscar/.venv/bin/pip install numba kokoro_onnx faster_whisper'),
    ]),
    grp('库与素材', [
      it('lib.wsl', 'WSL 库', 'warn', '只有 12 个 demo（预期 43）', '可能 clone 不完整，重新 clone'),
      it('lib.win', 'Windows 库', 'ok', 'D:\\lemo-opuscar · 45 个风格目录'),
      it('assets.fonts', '字体', 'warn', '只有 88 个（预期 ~966）', '跑 D:\\WSL\\fetch-all-fonts.sh 补齐（幂等）'),
      it('assets.inst', '乐器采样库', 'warn', '只有 0 个文件（预期 ~3869）',
        '采样库被 .gitignore 排除时需单独获取，见库内 core/audio/instruments/README'),
      it('tool.sync', '库同步脚本', 'ok', 'D:\\WSL\\lemo-lib-sync.sh'),
    ]),
  ]);
}

/** 场景四：**当前这台机器** —— 全 ok，应该规划出 0 个动作。 */
export function fixtureReady() {
  return envFixture([
    grp('本机（Windows）', [
      it('win.platform', '平台', 'ok', 'win32 · Node v22.22.2'),
      it('win.ffmpeg', 'Windows ffmpeg', 'ok', 'D:\\ffmpeg-9.x\\ffmpeg-9.0.2-full_build\\bin · ffmpeg version 9.0.2'),
      it('win.gpu', '显卡', 'ok', 'NVIDIA GeForce RTX 4060'),
    ]),
    grp('WSL', [
      it('wsl.alive', 'WSL 可用性', 'ok', 'Ubuntu-24.04 · 内核 5.15.167.4-wsl2'),
      it('wsl.node', 'WSL Node', 'ok', 'v22.22.2'),
      it('wsl.ffmpeg', 'WSL ffmpeg', 'ok', '6.1.1-3ubuntu5'),
      it('wsl.venv', 'Python venv', 'ok', 'Python 3.12.3 · 10/10 包就位'),
    ]),
    grp('库与素材', [
      it('lib.wsl', 'WSL 库', 'ok', '/home/lemo/lemo-opuscar · 43 个 demo'),
      it('lib.win', 'Windows 库', 'ok', 'D:\\lemo-opuscar · 45 个风格目录'),
      it('assets.fonts', '字体', 'ok', '966 个字体文件'),
      it('assets.inst', '乐器采样库', 'ok', '3869 个文件'),
      it('tool.sync', '库同步脚本', 'ok', 'D:\\WSL\\lemo-lib-sync.sh'),
    ]),
  ]);
}

/**
 * 场景五：**最坏情况** —— 12 项全部报 fail。
 *
 * ★ 这是「每个安装分支都能走到」的**最直接**证明：一次演练就能把所有动作规划出来，
 *   不用在四个场景之间拼。也顺带当漂移哨兵 —— env.mjs 新增检测项后，这里会立刻多出一项。
 */
export function fixtureAllMissing() {
  const groups = fixtureReady().groups.map((g) => ({
    title: g.title,
    items: g.items.map((x) => ({ ...x, status: 'fail', detail: `${x.label} 不可用（演练：最坏情况）`, fix: x.fix })),
  }));
  return envFixture(groups);
}

export const FIXTURES = {
  clean: { title: '全新机器（Windows 无 ffmpeg，WSL 不可用）', make: fixtureClean },
  bare: { title: 'WSL 装好但里面是空的（无 Node/ffmpeg/venv/库）', make: fixtureBareWsl },
  partial: { title: '库在但资产不全（demo/字体/采样/venv 缺）', make: fixturePartialAssets },
  all: { title: '最坏情况：12 项全部 fail（一次覆盖所有安装分支）', make: fixtureAllMissing },
  ready: { title: '当前这台机器（全 ok，应规划出 0 个动作）', make: fixtureReady },
};

/** 给 server 的演练模式用：把一份合成检测结果转成 /api/env 的形状。 */
export function simulateEnv(name = 'clean') {
  const f = FIXTURES[name];
  if (!f) return null;
  const data = f.make();
  data._simulated = name;
  data._simulatedTitle = f.title;
  return data;
}

// ── CLI ─────────────────────────────────────────────────────
//
// 用法（本模块平时是被 server.mjs / jobs.mjs import 的库，只有直接 `node lib/setup.mjs` 才走这里）：
//
//   node lib/setup.mjs                     真检测 + 打印当前该做什么（不执行）
//   node lib/setup.mjs --dry-run           同上，但把「将要执行的命令」逐条打印出来
//   node lib/setup.mjs --simulate          用 4 个合成场景把**每个安装分支**都走一遍（不执行）
//   node lib/setup.mjs --simulate=bare     只走某一个场景
//   node lib/setup.mjs --json              机器可读输出（配合 --simulate / 无参）
//   node lib/setup.mjs --run <actionId>    真实执行某个动作（先重新检测，已就绪则跳过）
//   node lib/setup.mjs --run <actionId> --simulate-env=bare   在演练场景下执行（仅用于验证执行路径）
//
// ★ --simulate 是本任务的核心交付：这台机器 12/12 ok，真实检测永远走不到安装分支，
//   所以必须有一台「假的干净机器」来证明那些分支真的存在、真的能被规划出来。

function isMain() {
  try {
    const self = fs.realpathSync(fileURLToPath(import.meta.url)).toLowerCase();
    const argv1 = process.argv[1] ? fs.realpathSync(process.argv[1]).toLowerCase() : '';
    return self === argv1;
  } catch { return false; }
}

function planFor(data, opts) {
  return planActions(data, opts);
}

async function cli() {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const valOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const kv = (f) => { const p = argv.find((a) => a.startsWith(`${f}=`)); return p ? p.slice(f.length + 1) : null; };

  const json = has('--json');
  const dry = has('--dry-run');
  const simName = kv('--simulate') || (has('--simulate') ? 'all' : null);
  const simEnv = kv('--simulate-env');
  const runId = valOf('--run');

  const emit = (obj) => { if (json) process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); };

  // ── 模式 A：--simulate（演练：每个分支都走一遍）──
  if (simName) {
    const names = simName === 'all' ? Object.keys(FIXTURES) : [simName];
    const report = { mode: 'simulate', fixtures: [] };
    for (const n of names) {
      const f = FIXTURES[n];
      if (!f) { console.error(`✗ 未知场景 ${n}；可选：${Object.keys(FIXTURES).join(' / ')} 或 all`); process.exitCode = 2; return; }
      const data = simulateEnv(n);
      const actions = planFor(data);
      report.fixtures.push({
        name: n, title: f.title, summary: data.summary,
        actions: actions.map((a) => ({
          id: a.id, kind: a.kind, title: a.title, status: a.status, envIds: a.envIds,
          why: a.why, estBytes: a.estBytes || 0,
          steps: a.kind === 'auto'
            ? a.steps.map((s) => ({ label: s.label, timeoutMs: s.timeoutMs, cmd: stepCommand(s) }))
            : [],
          manualSteps: a.kind === 'manual' ? a.manual.steps : [],
          links: a.kind === 'manual' ? (a.manual.links || []) : [],
        })),
      });
      if (!json) {
        console.log('');
        console.log('═'.repeat(78));
        console.log(`  演练场景「${n}」 —— ${f.title}`);
        console.log(`  检测结果：${data.summary.ok} ok · ${data.summary.warn} warn · ${data.summary.fail} fail · runnable=${data.runnable}`);
        console.log('═'.repeat(78));
        if (!actions.length) console.log('  （无需安装任何东西）');
        for (const a of actions) { console.log(describeAction(a)); console.log(''); }
      }
    }
    if (json) emit(report);
    return;
  }

  // ── 模式 B：真检测（--dry-run 或无参）──
  const data = simEnv ? simulateEnv(simEnv) : await checkEnv();
  const actions = planFor(data);

  if (runId) {
    const act = actions.find((a) => a.id === runId);
    if (!act) {
      // 区分两种情况：这个动作存在但已经就绪（幂等跳过） vs. 压根没这个 id
      const known = Object.keys({ ...AUTO, ...MANUAL });
      if (known.includes(runId)) { console.log(`✓ ${runId} 已就绪 → 跳过（幂等，不重装）`); return; }
      console.error(`✗ 未知动作 ${runId}。`);
      console.error(`  当前可执行：${actions.length ? actions.map((a) => a.id).join(' / ') : '（无 —— 环境已就绪）'}`);
      process.exitCode = 2;
      return;
    }
    if (act.kind !== 'auto') { console.error(`✗ ${runId} 是手动项，控制台不代跑。`); process.exitCode = 2; return; }
    console.log(`▶ 执行 ${act.id}：${act.title}`);
    const r = await runSteps(act.steps, { onLine: (l) => console.log(l) });
    if (r.ok) { console.log(`✓ 完成（${(r.ms / 1000).toFixed(1)}s）`); return; }
    console.error(`✗ 失败 [${r.kind}] ${r.hint}${r.evidence ? `（命中：${r.evidence}）` : ''}`);
    process.exitCode = 1;
    return;
  }

  if (json) {
    emit({
      mode: dry ? 'dry-run' : 'plan',
      simulated: data._simulated || null,
      summary: data.summary,
      actions: actions.map((a) => ({
        id: a.id, kind: a.kind, title: a.title, status: a.status, envIds: a.envIds,
        why: a.why, estBytes: a.estBytes || 0,
        steps: a.kind === 'auto' ? a.steps.map((s) => ({ label: s.label, timeoutMs: s.timeoutMs, cmd: stepCommand(s) })) : [],
        manualSteps: a.kind === 'manual' ? a.manual.steps : [],
      })),
    });
    return;
  }

  console.log('');
  console.log(`  环境检测：${data.summary.ok} ok · ${data.summary.warn} warn · ${data.summary.fail} fail · runnable=${data.runnable}`);
  if (data._simulated) console.log(`  ⚠️ 演练模式：这不是真实检测结果（场景 ${data._simulated}）`);
  console.log('');
  if (!actions.length) {
    console.log('  ✓ 无需安装任何东西（所有检测项都 ok）。');
    console.log('');
    return;
  }
  console.log(`  共 ${actions.length} 项待处理（${actions.filter((a) => a.kind === 'auto').length} 项可自动 / ${actions.filter((a) => a.kind === 'manual').length} 项需手动）：`);
  console.log('');
  for (const a of actions) { console.log(describeAction(a, { verbose: true })); console.log(''); }
  if (!dry) console.log('  （这是计划，没有执行任何东西。加 --dry-run 看命令，--simulate 演练全部分支）');
  console.log('');
}

if (isMain()) {
  cli().catch((e) => { console.error(`✗ setup.mjs 异常：${(e && e.stack) || e}`); process.exitCode = 2; });
}
