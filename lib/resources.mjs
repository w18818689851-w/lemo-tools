// lib/resources.mjs —— **通用资源检测适配模块**（环境 / 依赖 / 组件库 / 资源文件 / 本地模型 / 插件 的统一入口）
//
// ★ 为什么需要它：本项目里「某个资源在不在 / 版本对不对 / 缺了怎么办」的判据散落在各处 ——
//   env.mjs 管环境、setup.mjs 管安装、各业务各自写「找不到就报错」。于是「换台机器 / 换次打包」
//   就要在好几处同步改，必然漂移（本项目铁律：**同一判据只写一处**）。
//   本模块把这条链**收成一处**：扫描 → 版本校验 → 本地优先挂载 → 缺失提示 → 一键下载 → 自动配置（★ 下载成功后自动 `mount()`）→ 手动导入兜底（★ 导入成功后同样自动 `mount()`）。
//   ★ 上层业务**只调用本模块**，不再自写检测 / 下载逻辑。
//
// ★★ 边界（★ 极重要，改本模块前先读）：
//   1. **env 侧的探测实现仍归 lib/env.mjs**。本模块对 ffmpeg / WSL / Node / venv / 库 / 字体 / 采样库
//      一律走 `detect:{via:'env', id}` **委托** env.mjs 的 `checkEnv()` 结果，**绝不重写它的探测命令** ——
//      重写 = 第二处判据 = 必然与 env.mjs 漂移。`via:'custom'` 只用于 env 侧**没有**的资源
//      （本地模型 / 本地服务端点 / 风格 Skill 包）。
//   2. **动作原语取自 env.mjs**：`run`（异步 spawn，本机 spawnSync 一律 EBUSY）/ `runWsl` / `CFG` / `findFfmpegDir`。
//      本模块**新增**的只有：资源分类、打包类型、目录规范、版本匹配、5 态判定、下载 / 导入 / 挂载、上层唯一入口。
//   3. **绝不抛**：`scanAll` / `scanOne` / `mount` / `importResource` 对**任何**异常都降级为状态 / 错误返回，不 throw。
//      沿用 `checkEnv()` 纪律 —— 控制台的价值是「把 CLI 包起来」，探测失败不该反过来把它搞挂。
//   4. **不擅自动用户文件**：`runDownload` / `importResource` 只写 `_download/` 与 `dirFor()`；
//      `dir:null`（用既有系统位置，如 Windows ffmpeg）的资源**只登记真实路径，不搬动**。
//   5. **扫描只跑一次 checkEnv()**（它要起 WSL，成本高）。`opts.envResult` 可注入 ⇒ 离线单测不碰 WSL。
//
// ★★ 目录规范（契约 §三）—— 根**必须非 C 盘**（本项目硬规则 B）：
//     <resRoot>/env|dep|model|asset|plugin/<id>/   +   <resRoot>/_download/（★ 下载中转，校验通过才移入）
//   `resRoot` 默认 `D:\lemo-res`，覆盖点 `LEMO_RES_DIR`（★ 与 `CFG.exportDir` 认 `LEMO_FILM_DIR` 同一套写法）。
//   ★ 契约 §三 把根记作 `CFG.resRoot`，但 `lib/env.mjs` 的 `CFG` 目前**没有** `resRoot` 这个键，
//     而本模块被明令**不许改 env.mjs**（有并行改动）⇒ 本模块自带同名同义常量，`resourceRoot()` 是唯一口径。
//
// ★★ 状态模型（5 态，契约 §四）—— 只有 `ready` 跳过下载；其余 4 态**一律**触发「缺失提示 + 一键下载 + 手动导入」：
//     ready（找到+可执行+版本满足） / missing（没找到） / corrupt（找到但不可用/不完整） /
//     version-mismatch（能跑但版本不符 want） / path-abnormal（junction/符号链接、应目录却是文件、位置异常）。
//   ★ env 的 3 级咨询状态 → 本模块 5 态 的映射（**有意收敛**，见 `probeFromEnv`）：
//       env `ok`   → ready；env `fail` → missing；
//       env `warn`（找到了但不完整 / 降级）→ **默认 corrupt**（触发补齐），
//       个别语义更适合「缺失」的项（如查不到显卡）用注册表的 `envWarnState:'missing'` 覆盖。
//
// ★ 踩过的坑（勿重犯）：
//   · **版本串带后缀**：`ffmpeg -version` 首行是 `ffmpeg version 9.0.2-full_build ...`，
//     直接拿 `\S+` 会得到 `9.0.2-full_build`。所以 `satisfies()` 一律先 `parseVer()` 取**前导数字段**再比，
//     否则 `>=6.0` 会被字符串比较判错。✓
//   · **路径穿越**：`dirFor(kind,id)` 的 `id` 来自注册表也来自 HTTP 入参（`/api/resources/*`），
//     必须过白名单正则 `^[a-z0-9][a-z0-9._-]*$`，否则 `../` 能写出 resRoot 之外。✓
//   · **下载一律先落 `_download/`**：`http` 下载先落 `_download/`，校验（存在 / 非 0 字节 / 可选 sha256）
//     通过才 `renameSync` 进 `dirFor()`；不通过就留在 `_download/` 并报 `corrupt`（`state:'corrupt'`）。✓
//   · ★★ **`download` 支持 4 种动作**（`kind`）：`http`（下载→校验→移入）/ `git`（clone 到目标）/
//     `apt`（WSL 侧包管理）/ `script`（跑仓库自带脚本）。旧形态 `{url,sha256,estBytes,into}`（无 `kind`）
//     按 `http` 处理 ⇒ **向后兼容**（见 `normDownload`）。★ 只登记**本仓已写明**的来源（`lib/env.mjs` 的
//     `fix` 字段 / `lib/setup.mjs` 的 `AUTO` 表），**绝不发明 URL**；无出处的资源保持 `null`，走 `import` 兜底。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ★ 复用 env.mjs 的**动作原语**（异步 spawn / WSL 执行）与**探测结果**（不重写它的探测命令）。
//   · `run`    —— git clone（Windows 侧）等异步 spawn；本机 spawnSync 一律 EBUSY。
//   · `runWsl` —— apt / 仓库脚本（WSL 侧）；它自带 `asUser` 选项 ⇒ 需要 root 的步骤传 `asUser:'root'`
//                 （外层本就是 `wsl.exe -u root`，故 `su - root` 免密），**不另写一套 WSL 执行器**。
//   · `CFG` / `checkEnv` —— 路径口径与探测结果的唯一来源。
import { CFG, run, runWsl, checkEnv } from './env.mjs';

// ── 一、常量（冻结）────────────────────────────────────────────
export const KINDS = Object.freeze(['env', 'dep', 'model', 'asset', 'plugin']);

export const STATES = Object.freeze([
  'ready',            // 找到 + 可执行 + 版本满足 + 可挂载 ⇒ 直接用，跳过下载
  'missing',          // 没找到 ⇒ 提示 + 一键下载
  'corrupt',          // 找到了但不可用（执行失败 / 损坏 / 校验和不符 / 0 字节 / 不完整）
  'version-mismatch', // 找到了也能跑，但版本不满足 want
  'path-abnormal',    // 找到了但路径异常（junction/符号链接、应目录却是文件、位置异常）
]);

const ID_RE = /^[a-z0-9][a-z0-9._-]*$/;   // ★ 路径安全白名单（防穿越）
const RES_ROOT_DEFAULT = 'D:\\lemo-res';

// 本模块自带资源（env 侧无对应探测项，故 via:'custom' 自探）。
const SELF_DIR = path.dirname(fileURLToPath(import.meta.url));
const STYLE_SKILLS_DIR = path.join(SELF_DIR, 'style-skills');
const INDEX_TTS_DIR = process.env.LEMO_INDEX_TTS_DIR || 'D:\\Index-tts\\Index-tts_v2.5';
const LMSTUDIO_URL = process.env.LEMO_LMSTUDIO_URL || 'http://127.0.0.1:12345/v1/models';

// ★ `CFG.tmpDir`（D:\WSL）的 WSL 侧等价路径（/mnt/d/WSL）—— 供 `assets.fonts` / `lib.win` 的仓库脚本用。
//   与 env.mjs 的 `runWsl` 里那段 `inner` 推导**同一算法**（同一处口径）。
const WSL_TMP = `/mnt/${CFG.tmpDir[0].toLowerCase()}${CFG.tmpDir.slice(2).replace(/\\/g, '/')}`;

// ── 二、目录规范（契约 §三）────────────────────────────────────
let _warnedC = false;

// ★ 资源根的唯一口径：`LEMO_RES_DIR` 覆盖点 → 默认 `D:\lemo-res`。
export function resourceRoot() {
  const raw = (process.env.LEMO_RES_DIR && String(process.env.LEMO_RES_DIR).trim()) || RES_ROOT_DEFAULT;
  const root = path.resolve(raw);
  // 契约 §九.5：解析到 C 盘 ⇒ 报警（本项目硬规则 B：非 C 盘）。只报一次，不阻断。
  if (/^[a-z]:[\\/]/i.test(root) && root[0].toLowerCase() === 'c' && !_warnedC) {
    _warnedC = true;
    try {
      console.warn(`[resources] 资源根解析到 C 盘（${root}）——本项目硬规则 B 要求非 C 盘，请设 LEMO_RES_DIR 指向 D 盘。`);
    } catch { /* ignore */ }
  }
  return root;
}

// ★ 规划落盘目录：<resRoot>/<kind>/<id>。id 必须过白名单（防路径穿越）。
export function dirFor(kind, id) {
  if (!KINDS.includes(kind)) throw new Error(`dirFor: 非法 kind '${kind}'（合法值：${KINDS.join('/')}）`);
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    throw new Error(`dirFor: 非法 id '${id}'（白名单正则 ${ID_RE}）`);
  }
  return path.join(resourceRoot(), kind, id);
}

export function dirPlan() {
  const root = resourceRoot();
  const kinds = {};
  for (const k of KINDS) kinds[k] = path.join(root, k);
  return {
    root,
    kinds,
    download: path.join(root, '_download'),
    note: '下载先落 _download/，校验通过才原子移入 <kind>/<id>/；dir=null 的资源沿用既有系统位置，不搬动。',
  };
}

// ── 三、注册表（声明式，冻结）──────────────────────────────────
// ★ `download` **只登记本仓已写明的来源**（`lib/env.mjs` 的 `fix` / `lib/setup.mjs` 的 `AUTO`），
//   **绝不发明 URL**；无出处的资源保持 `null`，兜底走 `import`（手动导入）。
// ★ env 侧资源一律 `detect:{via:'env', id}` 委托 env.mjs；id 与 env 的 item.id 同名，便于对齐。
const _entries = [
  // ===== kind:env（运行环境 / 平台）=====
  {
    id: 'win.platform', kind: 'env', label: 'Windows 平台', bundled: true, required: true,
    dir: null, version: {}, detect: { via: 'env', id: 'win.platform' },
    download: null, import: null, mount: { how: 'env', detail: '平台判定（不落盘）' },
    impact: '控制台必须在 Windows 侧运行（GPU 渲染在 Windows 侧）',
    fix: '在 Windows 上运行本控制台',
  },
  {
    id: 'win.gpu', kind: 'env', label: '显卡', bundled: true, required: false,
    dir: null, version: {}, detect: { via: 'env', id: 'win.gpu' }, envWarnState: 'missing',
    download: null, import: null, mount: { how: 'env', detail: 'GPU 由 Windows 侧渲染使用' },
    impact: '无卡也能回退软渲染，只是慢（不阻断）',
    fix: '安装 / 更新显卡驱动（WSL 侧拿不到 GPU 属正常，渲染走 Windows）',
  },
  {
    id: 'wsl.alive', kind: 'env', label: 'WSL 可用性', bundled: true, required: true,
    dir: null, version: {}, detect: { via: 'env', id: 'wsl.alive' },
    download: null, import: null, mount: { how: 'env', detail: 'WSL 发行版运行态' },
    impact: 'WSL 不可用 ⇒ 混流 / 合成链全部失败',
    fix: `确认已安装：wsl.exe -l -v；发行版名不同则改 CFG.wslDistro（当前 ${CFG.wslDistro}）`,
  },

  // ===== kind:dep（可执行依赖 / 组件库）=====
  {
    id: 'win.ffmpeg', kind: 'dep', label: 'Windows ffmpeg（含 nvenc）', bundled: false, required: true,
    dir: null, version: { want: '>=6.0', pattern: /ffmpeg version (\S+)/ },
    detect: { via: 'env', id: 'win.ffmpeg' },
    // ★ 无仓库内下载出处：setup.mjs 把它归为 MANUAL（「控制台不替你下载」）⇒ 保持 null，走手动导入。
    download: null,
    import: { accept: ['.zip', '.7z'], note: '把 ffmpeg 完整版解压后放进候选目录之一（见 CFG.ffmpegDirs）' },
    mount: { how: 'path', detail: '由 CFG.ffmpegDirs 定位既有系统位置，不搬动' },
    impact: '缺它混流会直接失败',
    fix: `下载 ffmpeg 完整版（含 nvenc）放到候选目录之一：${CFG.ffmpegDirs.join(' / ')}`,
  },
  {
    id: 'wsl.node', kind: 'dep', label: 'WSL Node', bundled: false, required: true,
    dir: null, version: { want: '>=18.0', pattern: /(v?\d+\.\d+\.\d+)/ },
    detect: { via: 'env', id: 'wsl.node' },
    // ★ 出处：lib/setup.mjs 的 AUTO['wsl.node']（NodeSource 官方源 20.x）。
    download: {
      kind: 'apt', where: 'wsl', asRoot: true, into: null, sha256: null, estBytes: 60e6,
      cmd: 'apt-get update -qq && apt-get install -y ca-certificates curl gnupg && '
        + 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs',
    },
    import: null, mount: { how: 'path', detail: 'WSL 侧 node 可执行' },
    impact: 'WSL 侧脚本无法运行',
    fix: '在 WSL 里安装 Node 20+（推荐 nvm 或 nodesource）',
  },
  {
    id: 'wsl.ffmpeg', kind: 'dep', label: 'WSL ffmpeg', bundled: false, required: true,
    dir: null, version: { want: '>=6.0', pattern: /(\d+\.\d+(?:\.\d+)?)/ },
    detect: { via: 'env', id: 'wsl.ffmpeg' },
    // ★ 出处：lib/setup.mjs 的 AUTO['wsl.ffmpeg']（apt-get install -y ffmpeg，需 root）。
    download: { kind: 'apt', where: 'wsl', asRoot: true, into: null, sha256: null, estBytes: 120e6, cmd: 'apt-get install -y ffmpeg' },
    import: null, mount: { how: 'path', detail: 'WSL 侧 ffmpeg 可执行' },
    impact: '混流要用，且需带 h264_nvenc',
    fix: 'sudo apt install ffmpeg',
  },
  {
    id: 'wsl.venv', kind: 'dep', label: 'WSL Python venv + 依赖包', bundled: false, required: true,
    dir: null, version: { pattern: /(\d+\.\d+\.\d+)/ },
    detect: { via: 'env', id: 'wsl.venv' },
    // ★ 出处：lib/setup.mjs 的 AUTO['wsl.venv']。原逻辑 = **优先**上游官方安装器
    //   `setup.sh deps voice music`（自带幂等校验和），**找不到才**退回手工 venv + pip。
    //   ★★ 本段与 setup.mjs 的该脚本**同源**（「同一判据只写一处」的已知例外：那是执行器、这里是下载规格）；
    //      任一处改动必须同步另一处。
    download: {
      kind: 'script', where: 'wsl', asRoot: false, into: null, sha256: null, estBytes: 900e6,
      cmd: [
        'set -e',
        `L="${CFG.wslLib}"`,
        'if [ ! -d "$L" ]; then echo "✗ 库目录 $L 不存在 —— 请先安装 WSL 库"; exit 2; fi',
        'cd "$L"',
        'if [ -x plugin/skills/lemo-opuscar/scripts/setup.sh ]; then',
        '  sh plugin/skills/lemo-opuscar/scripts/setup.sh deps voice music',
        'else',
        '  echo "! 找不到上游 setup.sh → 退回手工 venv + pip"',
        '  [ -x .venv/bin/python ] || python3 -m venv .venv',
        '  .venv/bin/pip install --upgrade pip',
        '  .venv/bin/pip install -r requirements.txt',
        '  for f in requirements-voice.txt requirements-music.txt; do [ -f "$f" ] && .venv/bin/pip install -r "$f" || true; done',
        'fi',
        'echo "✓ Python 依赖就绪：$("$L/.venv/bin/python" --version 2>&1)"',
      ].join('\n'),
    },
    import: null, mount: { how: 'path', detail: `${CFG.wslLib}/.venv` },
    impact: '音频 / 语音处理链缺失',
    fix: `cd ${CFG.wslLib} && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`,
  },
  {
    id: 'lib.wsl', kind: 'dep', label: 'WSL 库（lemo-opuscar）', bundled: false, required: true,
    dir: null, version: {}, detect: { via: 'env', id: 'lib.wsl' },
    // ★ 出处：lib/env.mjs 里 `lib.wsl` 的 `fix`（git clone lemo-opuscar）+ lib/setup.mjs 的 AUTO['lib.wsl']（clone，estBytes 6.5e9）。
    download: { kind: 'git', url: 'https://github.com/lemomo-ai/lemo-opuscar.git', sha256: null, estBytes: 6.5e9, into: 'dep' },
    import: null, mount: { how: 'path', detail: CFG.wslLib },
    impact: '风格 / 素材 / 脚本全在库里，缺失则核心链不可用',
    fix: `git clone https://github.com/lemomo-ai/lemo-opuscar.git ${CFG.wslLib}`,
  },
  {
    id: 'lib.win', kind: 'dep', label: 'Windows 库', bundled: false, required: true,
    dir: null, version: {}, detect: { via: 'env', id: 'lib.win' },
    // ★ 出处：lib/setup.mjs 的 AUTO['lib.win']（从 WSL 库**同步**过来，不是 clone）。
    //   ★★ 注：委托方口述表把本项也记成 `git`，但 **env.mjs 的 lib.win fix 里没有 URL**，
    //      仓库内它的动作是同步脚本 ⇒ 按「真实、有出处」原则登记为 script（同步），不发明 clone。
    download: { kind: 'script', where: 'wsl', asRoot: false, into: null, sha256: null, estBytes: 0, cmd: `bash ${WSL_TMP}/lemo-lib-sync.sh push` },
    import: null, mount: { how: 'path', detail: CFG.winLib },
    impact: 'Windows 侧读不到风格目录',
    fix: '首次运行会自动从 WSL 库同步过去（跑一次 lemo-make 即可）',
  },
  {
    id: 'tool.sync', kind: 'dep', label: '库同步脚本', bundled: false, required: true,
    dir: null, version: {}, detect: { via: 'env', id: 'tool.sync' },
    download: null, import: null, mount: { how: 'path', detail: CFG.syncScript },
    impact: '编排器步骤 2 依赖它，缺失会导致同步失败',
    fix: `恢复 ${CFG.syncScript}`,
  },

  // ===== kind:asset（资源文件 / 素材）=====
  {
    id: 'assets.fonts', kind: 'asset', label: '字体', bundled: false, required: false,
    dir: 'fonts', version: {}, detect: { via: 'env', id: 'assets.fonts' },
    // ★ 出处：lib/env.mjs 里 `assets.fonts` 的 `fix`（跑 D:\WSL\fetch-all-fonts.sh，幂等）+ lib/setup.mjs 的 AUTO['assets.fonts']（wslFile 同脚本）。
    download: { kind: 'script', where: 'wsl', asRoot: false, into: null, sha256: null, estBytes: 200e6, cmd: `bash ${WSL_TMP}/fetch-all-fonts.sh` },
    import: { accept: ['.zip', '.7z', '.ttf', '.otf'], note: '把字体包解到 <resRoot>/asset/assets.fonts/' },
    mount: { how: 'path', detail: '字体库目录' },
    impact: '字幕 / 封面缺字体会回退默认字体',
    fix: '跑 D:\\WSL\\fetch-all-fonts.sh 补齐（幂等）',
  },
  {
    id: 'assets.inst', kind: 'asset', label: '乐器采样库', bundled: false, required: false,
    dir: 'instruments', version: {}, detect: { via: 'env', id: 'assets.inst' },
    // ★ 出处：lib/setup.mjs 的 AUTO['assets.inst']（`sh tools/fetch.sh instruments all`，estBytes 1.4e9）。
    //   ★★ 注：委托方口述表说本项「无仓库内出处」—— 实测**有**（就在 setup.mjs 的 AUTO 表）⇒ 按出处登记。
    download: {
      kind: 'script', where: 'wsl', asRoot: false, into: null, sha256: null, estBytes: 1.4e9,
      cmd: `set -e\nL="${CFG.wslLib}"\ncd "$L"\nif [ ! -f tools/fetch.sh ]; then echo "✗ 找不到 $L/tools/fetch.sh"; exit 2; fi\nsh tools/fetch.sh instruments all`,
    },
    import: { accept: ['.zip', '.7z'], note: '把采样库解到 <resRoot>/asset/assets.inst/' },
    mount: { how: 'path', detail: '乐器采样库目录' },
    impact: '配乐 / 乐器音源缺失',
    fix: '采样库被 .gitignore 排除时需单独获取，见库内 core/audio/instruments/README',
  },

  // ===== kind:model（本地模型 / 权重）★ env 侧没有，via:'custom' 自探 =====
  {
    id: 'model.index-tts', kind: 'model', label: 'Index-TTS 本地语音模型', bundled: false, required: false,
    dir: 'index-tts', version: { want: '>=2.0' },
    detect: { via: 'custom', probe: async () => probeIndexTts() },
    download: null,
    import: { accept: ['.zip', '.7z'], note: '把 Index-TTS 权重解到 <resRoot>/model/index-tts/' },
    mount: { how: 'path', detail: '本地 TTS 权重目录' },
    impact: '本地语音合成不可用（可回退其它 TTS 后端）',
    fix: `把 Index-TTS 放到 ${INDEX_TTS_DIR} 或设 LEMO_INDEX_TTS_DIR`,
  },
  {
    id: 'model.lmstudio', kind: 'model', label: 'LM Studio 本地服务', bundled: false, required: false,
    dir: 'lmstudio', version: {},
    detect: { via: 'custom', probe: async () => probeEndpoint(LMSTUDIO_URL) },
    download: null, import: null, mount: { how: 'endpoint', detail: LMSTUDIO_URL },
    impact: '本地大模型推理不可用（可回退云端 API）',
    fix: '启动 LM Studio 并开启本地服务（默认端口 12345）',
  },

  // ===== kind:plugin（插件 / 扩展资源）★ via:'custom' 自探 =====
  {
    id: 'plugin.style-skills', kind: 'plugin', label: '风格 Skill 包', bundled: true, required: false,
    dir: 'style-skills', version: {},
    detect: { via: 'custom', probe: async () => probeStyleSkills() },
    download: null,
    import: { accept: ['.zip', '.7z'], note: '把风格包（含 SKILL.md）解到 <resRoot>/plugin/style-skills/<slug>/' },
    mount: { how: 'path', detail: STYLE_SKILLS_DIR },
    impact: '风格蒸馏 / 风格化能力缺失',
    fix: `恢复 ${STYLE_SKILLS_DIR}\\<slug>\\SKILL.md`,
  },
];

export const RESOURCES = Object.freeze(_entries.map((e) => Object.freeze(e)));

// ── 四、纯函数（可单测，不碰 IO）────────────────────────────────

// 版本串 → 前导数字段（如 'v9.0.2-full_build' → [9,0,2]）；无数字 ⇒ null。
function parseVer(s) {
  if (s == null) return null;
  const m = String(s).match(/\d+(?:\.\d+)*/);
  if (!m) return null;
  return m[0].split('.').map((n) => Number(n));
}

// 逐段比较（短的补 0）：a>b → 1；a<b → -1；相等 → 0。
function cmpVer(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

// ★ 版本匹配（契约 §六）：支持 '>=x.y' / '^x.y' / '~x.y' / 'x.y.z' 精确 / '*'。
export function satisfies(versionGot, want) {
  try {
    const w = (want == null ? '*' : String(want)).trim();
    if (w === '' || w === '*') return true;
    const got = parseVer(versionGot);
    if (!got) return false;
    const m = w.match(/^(>=|<=|>|<|\^|~|=)?\s*(.+)$/);
    const op = (m && m[1]) || '=';
    const wv = parseVer(m ? m[2] : w);
    if (!wv) return false;
    const c = cmpVer(got, wv);
    switch (op) {
      case '>=': return c >= 0;
      case '>': return c > 0;
      case '<=': return c <= 0;
      case '<': return c < 0;
      // ^：同主版本且 >=（0.x 时退化为同次版本 —— 与 semver 对 0.x 的保守处理一致）
      case '^': return c >= 0 && (wv[0] > 0 ? got[0] === wv[0] : got[0] === 0 && got[1] === (wv[1] || 0));
      // ~：同主 + 同次
      case '~': return c >= 0 && got[0] === wv[0] && (got[1] || 0) === (wv[1] || 0);
      default: return c === 0;   // '='
    }
  } catch { return false; }
}

// ★ 5 态判定（纯函数）。判定优先级：missing → path-abnormal → corrupt → 不可执行 → 版本不符 → ready。
export function classify(probe, versionSpec = {}) {
  const p = probe && typeof probe === 'object' ? probe : {};
  if (!p.found) return 'missing';
  if (p.pathAbnormal) return 'path-abnormal';
  if (p.corrupt) return 'corrupt';
  if (p.executable === false) return 'corrupt';
  const want = versionSpec && versionSpec.want;
  if (want && p.version != null && !satisfies(p.version, want)) return 'version-mismatch';
  return 'ready';
}

// ★ 纯函数：把 scan 结果转成「待办动作」清单（required 优先）。喂合成 scan 即可演练每个分支。
export function planDownloads(scanResult) {
  const list = Array.isArray(scanResult && scanResult.resources) ? scanResult.resources : [];
  const actions = [];
  for (const r of list) {
    if (!r || r.state === 'ready') continue;
    actions.push({
      id: r.id,
      kind: r.kind,
      label: r.label,
      state: r.state,
      required: !!r.required,
      reason: r.detail || '',
      auto: !!r.download,          // 契约：可一键自动修复 ⇔ 注册表有 download
      download: r.download || null,
      import: !!r.import,
      planDir: r.planDir || null,
      fix: r.fix || '',
    });
  }
  actions.sort((a, b) => Number(b.required) - Number(a.required));
  return actions;
}

// ── 五、探测（委托 env.mjs / 自探）─────────────────────────────

function findEnvItem(envResult, id) {
  const groups = envResult && envResult.groups;
  if (!Array.isArray(groups)) return null;
  for (const g of groups) {
    const items = g && g.items;
    if (!Array.isArray(items)) continue;
    for (const it of items) if (it && it.id === id) return it;
  }
  return null;
}

// ★ 委托型：把 env 的 3 级状态映射成 probe（详见文件头「状态模型」的映射表）。
function probeFromEnv(entry, envResult) {
  const item = findEnvItem(envResult, entry.detect.id);
  if (!item) return { found: false, _detail: 'env 侧未产出该探测项（可能因上游探测提前返回）' };
  const _detail = item.detail || '';
  const _fix = item.fix || '';
  if (item.status === 'fail') return { found: false, _detail, _fix };
  if (item.status === 'warn') {
    // env warn = 找到了但不完整 / 降级 ⇒ 默认 corrupt（触发补齐）；个别项可用 envWarnState:'missing' 覆盖。
    const mode = entry.envWarnState || 'corrupt';
    if (mode === 'missing') return { found: false, _detail, _fix };
    return { found: true, executable: true, corrupt: true, _detail, _fix };
  }
  return { found: true, executable: true, _detail, _fix };
}

// 从 env 的 detail 文本里按注册表 pattern 抽版本（env 不直接给结构化版本）。
function withEnvVersion(entry, probe) {
  const pat = entry.version && entry.version.pattern;
  if (pat && probe && probe._detail && probe.version == null) {
    try {
      const m = String(probe._detail).match(pat);
      if (m && m[1] != null) probe.version = m[1];
    } catch { /* ignore */ }
  }
  return probe;
}

// 目录探测：found / pathAbnormal（符号链接 / 应目录却是文件）。
function probeDir(dir, { expectDir = true } = {}) {
  try {
    const ls = fs.lstatSync(dir);
    if (ls.isSymbolicLink()) return { found: true, path: dir, executable: false, pathAbnormal: true };
    if (expectDir && !ls.isDirectory()) return { found: true, path: dir, executable: false, pathAbnormal: true };
    return { found: true, path: dir, executable: true };
  } catch {
    return { found: false, path: dir };
  }
}

// 自探：Index-TTS 本地模型目录（本机真实存在 D:\Index-tts\Index-tts_v2.5）。
function probeIndexTts() {
  const dir = INDEX_TTS_DIR;
  const base = probeDir(dir);
  if (!base.found || base.pathAbnormal) return base;
  let n = 0;
  try { n = fs.readdirSync(dir).length; } catch { /* ignore */ }
  if (n === 0) return { found: true, path: dir, executable: false, corrupt: true, _detail: `${dir} 存在但为空` };
  const m = path.basename(dir).match(/v?(\d+(?:\.\d+)*)/);
  return { found: true, path: dir, executable: true, version: m ? m[1] : null, _detail: `${dir} · ${n} 项` };
}

// 自探：本地服务端点（LM Studio，本机默认 http://127.0.0.1:12345）。不可达 ⇒ missing。
async function probeEndpoint(url, { timeout = 1500 } = {}) {
  const out = { found: false, path: url };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    let res;
    try {
      res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    } finally { clearTimeout(t); }
    if (!res.ok) return { found: true, path: url, executable: false, corrupt: true, _detail: `${url} · HTTP ${res.status}` };
    let j = null;
    try { j = await res.json(); } catch { /* ignore */ }
    const n = j && Array.isArray(j.data) ? j.data.length : null;
    return { found: true, path: url, executable: true, version: null, _detail: `${url} 可达${n != null ? ` · ${n} 个模型` : ''}` };
  } catch {
    return out;
  }
}

// 自探：风格 Skill 包（本机 D:\lemo-tools\lib\style-skills\<slug>\SKILL.md）。
function probeStyleSkills() {
  const root = STYLE_SKILLS_DIR;
  const base = probeDir(root);
  if (!base.found || base.pathAbnormal) return base;
  let n = 0;
  try {
    for (const name of fs.readdirSync(root)) {
      if (name.startsWith('_')) continue;   // 跳过 _TEMPLATE
      try { if (fs.existsSync(path.join(root, name, 'SKILL.md'))) n++; } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  if (n === 0) return { found: true, path: root, executable: false, corrupt: true, _detail: `${root} 下没有含 SKILL.md 的风格包` };
  return { found: true, path: root, executable: true, version: null, _detail: `${root} · ${n} 个风格包` };
}

async function resolveProbe(entry, envResult, opts) {
  const d = entry.detect || {};
  if (d.via === 'env') return withEnvVersion(entry, probeFromEnv(entry, envResult));
  if (d.via === 'custom' && typeof d.probe === 'function') {
    const p = await d.probe({ envResult, opts, CFG });
    return p && typeof p === 'object' ? p : { found: false, _detail: '自定义探测未返回对象' };
  }
  return { found: false, _detail: '未配置探测方式' };
}

// ── 六、扫描（★ 上层唯一入口）──────────────────────────────────

let _envCache = null;   // { at, result } —— checkEnv() 只跑一次（要起 WSL，成本高）

async function getEnv(opts) {
  if (opts && opts.envResult && typeof opts.envResult === 'object') return { result: opts.envResult, cached: true };
  if (!(opts && opts.force) && _envCache) return { result: _envCache.result, cached: true };
  const result = await checkEnv();
  _envCache = { at: Date.now(), result };
  return { result, cached: false };
}

function stateTag(state) {
  switch (state) {
    case 'missing': return '未找到';
    case 'corrupt': return '已损坏 / 不完整，建议重下或补齐';
    case 'version-mismatch': return '版本不符';
    case 'path-abnormal': return '路径异常';
    default: return '';
  }
}

function describe(entry, state, probe) {
  if (probe && probe._detail) {
    const tag = stateTag(state);
    return tag ? `${probe._detail}（${tag}）` : probe._detail;
  }
  const p = probe && probe.path ? `路径 ${probe.path}` : '';
  switch (state) {
    case 'ready': return `${entry.label} 可用${probe && probe.version ? `（${probe.version}）` : ''}`;
    case 'missing': return `${entry.label} 未找到`;
    case 'corrupt': return `${entry.label} 已找到但不可用 / 不完整${p ? `：${p}` : ''}`;
    case 'version-mismatch': return `${entry.label} 版本不符：实测 ${(probe && probe.version) || '?'}，需要 ${entry.version && entry.version.want}`;
    case 'path-abnormal': return `${entry.label} 路径异常${p ? `：${p}` : ''}`;
    default: return entry.label;
  }
}

async function buildStatus(entry, envResult, opts) {
  let probe = { found: false };
  try {
    probe = await resolveProbe(entry, envResult, opts);
  } catch (e) {
    probe = { found: false, _detail: `探测异常：${(e && e.message) || e}` };
  }
  const versionSpec = entry.version || {};
  const state = classify(probe, versionSpec);
  return {
    id: entry.id,
    kind: entry.kind,
    label: entry.label,
    bundled: !!entry.bundled,
    required: !!entry.required,
    state,
    detail: describe(entry, state, probe),
    version: probe.version != null ? probe.version : null,
    want: versionSpec.want != null ? versionSpec.want : null,
    path: probe.path != null ? probe.path : null,
    planDir: dirFor(entry.kind, entry.id),
    download: entry.download || null,
    import: !!entry.import,
    impact: entry.impact || '',
    fix: entry.fix || probe._fix || '',
    autoFixable: !!entry.download,
  };
}

function summarize(resources) {
  const s = { total: resources.length };
  for (const st of STATES) s[st] = 0;
  for (const r of resources) if (s[r.state] != null) s[r.state]++;
  return s;
}

export async function scanAll(opts = {}) {
  const checkedAt = new Date().toISOString();
  try {
    const only = Array.isArray(opts.only) && opts.only.length ? new Set(opts.only) : null;
    const entries = RESOURCES.filter((e) => !only || only.has(e.id));
    const { result: envResult, cached } = await getEnv(opts);
    const resources = [];
    for (const entry of entries) {
      try {
        resources.push(await buildStatus(entry, envResult, opts));
      } catch (e) {
        resources.push({
          id: entry.id, kind: entry.kind, label: entry.label,
          bundled: !!entry.bundled, required: !!entry.required, state: 'missing',
          detail: `构建状态异常：${(e && e.message) || e}`, version: null, want: null, path: null,
          planDir: dirFor(entry.kind, entry.id), download: entry.download || null,
          import: !!entry.import, impact: entry.impact || '', fix: entry.fix || '', autoFixable: !!entry.download,
        });
      }
    }
    return { resources, summary: summarize(resources), dirPlan: dirPlan(), checkedAt, cached };
  } catch (e) {
    // ★ 绝不抛：连 env 都拿不到时，也返回一个结构合法的空结果。
    return {
      resources: [], summary: summarize([]), dirPlan: dirPlan(),
      checkedAt, cached: false, error: (e && e.message) || String(e),
    };
  }
}

export async function scanOne(id, opts = {}) {
  try {
    const entry = RESOURCES.find((e) => e.id === id);
    if (!entry) return null;
    const all = await scanAll({ ...opts, only: [id] });
    return (all.resources && all.resources[0]) || null;
  } catch {
    return null;
  }
}

// ── 七、动作：下载 / 导入 / 挂载（★ 绝不抛）─────────────────────

// 一键下载 / 修复：按 `download.kind` 分派。
//   http   → <resRoot>/_download/ → 校验（非 0 字节 / 可选 sha256）→ 原子移入 dirFor()
//   git    → `git clone` 到 dirFor()（WSL 侧则经 runWsl）
//   apt    → WSL 侧包管理（runWsl，asUser:'root'）
//   script → 跑仓库自带脚本（runWsl）
// ★ 绝不抛；失败一律返回 { ok:false, error, detail }，`corrupt` 类失败额外带 `state:'corrupt'`。
//
// ★★ 契约 §六（2026-10-09 订正：补「下载完自动配置并建立连接」）：
//   **下载成功（分派结果 res.ok === true）后自动 `await mount(id)`**，并把结果并入返回：
//     { ...res, mount: { ok, how, detail }, mounted: <mount.ok 的布尔> }
//   · `opts.mount === false` ⇒ **跳过挂载**（`mount()` 内部会 `scanOne(id)`，含一次 WSL 扫描，成本高），
//     返回 { ...res, mount: null, mounted: null, mountSkipped: true }。**默认挂载**（opts 省略 / mount 非 false）。
//   · ★ `ok` 的语义**不变**（= 下载本身是否成功）：挂载失败**不**把 `ok` 改成 false，
//     只在 `detail` 末尾追加「（★ 已下载但挂载失败：<mount.detail>）」—— 让调用方能分辨
//     「下载失败」与「下载成功但挂载失败」（否则会误触发重新下载）。
export async function runDownload(id, onLog, opts) {
  const log = typeof onLog === 'function' ? onLog : () => {};
  let res;
  try {
    const entry = RESOURCES.find((e) => e.id === id);
    if (!entry) return { ok: false, id, error: 'not-registered', detail: `未登记资源 ${id}` };
    const dl = normDownload(entry.download);
    if (!dl) return { ok: false, id, error: 'no-download-spec', detail: '该资源未配置下载地址，请走手动导入（importResource）' };
    if (dl.kind === 'http') res = await _dlHttp(entry, dl, log);
    else if (dl.kind === 'git') res = await _dlGit(entry, dl, log);
    else if (dl.kind === 'apt' || dl.kind === 'script') res = await _dlExec(entry, dl, log);
    else return { ok: false, id, error: 'bad-kind', detail: `未知 download.kind='${dl.kind}'` };
  } catch (e) {
    return { ok: false, id, error: 'exception', detail: `下载异常：${(e && e.message) || e}` };
  }
  // ★ 下载成功 ⇒ 自动挂载（契约 §六）。失败结果原样返回（谈不上挂载）。
  if (res.ok !== true) return res;
  if (opts && opts.mount === false) return { ...res, mount: null, mounted: null, mountSkipped: true };
  let m;
  try { m = await mount(res.id, opts); }
  catch (e) { m = { ok: false, how: null, detail: `mount 异常：${(e && e.message) || e}` }; }
  const mounted = !!(m && m.ok);
  const out = { ...res, mount: m, mounted };
  if (!mounted) {
    const note = `（★ 已下载但挂载失败：${(m && m.detail) || '未知原因'}）`;
    out.detail = res.detail ? `${res.detail} ${note}` : note;
  }
  return out;
}

// ★ 向后兼容：旧形态 `{url, sha256, estBytes, into}`（无 `kind`）按 `http` 处理。
function normDownload(dl) {
  if (!dl || typeof dl !== 'object') return null;
  const kind = dl.kind || (dl.url ? 'http' : (dl.cmd ? 'script' : null));
  if (!kind) return null;
  const where = dl.where || (kind === 'apt' ? 'wsl' : 'win');   // apt 只在 WSL 侧
  return { ...dl, kind, where };
}

const tail = (s, n = 400) => String(s || '').trim().slice(-n);

async function _dlHttp(entry, dl, log) {
  const dlDir = path.join(resourceRoot(), '_download');
  fs.mkdirSync(dlDir, { recursive: true });
  let ext = '.bin';
  try { ext = path.extname(new URL(dl.url).pathname) || '.bin'; } catch { /* ignore */ }
  const tmp = path.join(dlDir, `res-${entry.id}-${Date.now().toString(36)}${ext}`);
  log(`[http] ${dl.url} → ${tmp}`);
  const res = await fetch(dl.url);
  if (!res.ok) return { ok: false, id: entry.id, kind: 'http', error: `http-${res.status}`, detail: `HTTP ${res.status}`, tmp };
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tmp, buf);
  // ★ 校验优先：不通过 ⇒ 留在 _download/ 并报 corrupt（绝不污染规划目录）。
  if (!fs.existsSync(tmp) || fs.statSync(tmp).size === 0) {
    return { ok: false, id: entry.id, kind: 'http', error: 'empty', state: 'corrupt', detail: '下载文件为 0 字节，已留在 _download/', tmp };
  }
  if (dl.sha256) {
    const h = crypto.createHash('sha256').update(buf).digest('hex');
    if (h.toLowerCase() !== String(dl.sha256).toLowerCase()) {
      return { ok: false, id: entry.id, kind: 'http', error: 'sha256', state: 'corrupt', detail: `校验和不符（实测 ${h}），已留在 _download/`, tmp };
    }
  }
  const destDir = dirFor(entry.kind, entry.id);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(tmp));
  fs.renameSync(tmp, dest);
  log(`校验通过 → ${dest}`);
  return { ok: true, id: entry.id, kind: 'http', path: dest, bytes: buf.length };
}

async function _dlGit(entry, dl, log) {
  const dest = dl.dest || dirFor(entry.kind, entry.id);
  if (dl.where === 'wsl') {
    log(`[git/wsl] clone ${dl.url} → ${dest}`);
    const r = await runWsl(`set -e\ngit clone --depth 1 ${dl.url} "${dest}"`, { name: `res-${entry.id}`, ...(dl.asRoot ? { asUser: 'root' } : {}) });
    return { ok: r.code === 0, id: entry.id, kind: 'git', path: dest, code: r.code, detail: tail(r.stderr || r.stdout) };
  }
  log(`[git] clone ${dl.url} → ${dest}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = await run('git', ['clone', '--depth', '1', dl.url, dest]);
  if (r.code !== 0) return { ok: false, id: entry.id, kind: 'git', error: `git-${r.code}`, detail: tail(r.stderr || r.stdout) };
  if (!fs.existsSync(dest)) return { ok: false, id: entry.id, kind: 'git', error: 'missing-after-clone', detail: `clone 后目标不存在：${dest}` };
  return { ok: true, id: entry.id, kind: 'git', path: dest };
}

async function _dlExec(entry, dl, log) {
  const cmd = dl.cmd || '';
  if (!cmd) return { ok: false, id: entry.id, kind: dl.kind, error: 'no-cmd', detail: '缺少 cmd' };
  log(`[${dl.kind}] ${cmd.split('\n')[0]}`);
  let r;
  if (dl.where === 'wsl') {
    r = await runWsl(cmd, { name: `res-${entry.id}`, ...(dl.asRoot ? { asUser: 'root' } : {}) });
  } else {
    r = await run('bash', ['-lc', cmd]);
  }
  return { ok: r.code === 0, id: entry.id, kind: dl.kind, code: r.code, detail: tail(r.stdout || r.stderr) };
}

// 手动导入兜底：把用户自备的包 / 目录放进 dirFor(kind,id)。
// ★ 只复制，**不搬动**源文件；压缩包解压交给用户（见注册表 import.note）。
//
// ★★ 契约 §六：**导入成功（res.ok === true）后自动 `await mount(id)`**，返回结构同 `runDownload`：
//   { ...res, mount: { ok, how, detail }, mounted: <mount.ok 的布尔> }。
//   · `opts.mount === false` ⇒ 跳过挂载，返回 { ...res, mount: null, mounted: null, mountSkipped: true }
//     （`mount()` 内部会 `scanOne(id)`，含一次 WSL 扫描，成本高）。**默认挂载**。
//   · ★ `ok` 的语义**不变**（= 导入本身是否成功）：挂载失败**不**把 `ok` 改成 false，
//     只在 `detail` 末尾追加「（★ 已导入但挂载失败：<mount.detail>）」—— 区分「导入失败」与「导入成功但挂载失败」。
export async function importResource(id, srcPath, opts) {
  let res;
  try {
    const entry = RESOURCES.find((e) => e.id === id);
    if (!entry) return { ok: false, id, error: 'not-registered', detail: `未登记资源 ${id}` };
    if (!srcPath || typeof srcPath !== 'string') return { ok: false, id, error: 'bad-src', detail: '缺少源路径' };
    if (!fs.existsSync(srcPath)) return { ok: false, id, error: 'src-missing', detail: `源不存在：${srcPath}` };
    const destDir = dirFor(entry.kind, entry.id);
    fs.mkdirSync(destDir, { recursive: true });
    const st = fs.statSync(srcPath);
    let dest;
    if (st.isDirectory()) {
      dest = path.join(destDir, path.basename(srcPath));
      fs.cpSync(srcPath, dest, { recursive: true });
    } else {
      dest = path.join(destDir, path.basename(srcPath));
      fs.copyFileSync(srcPath, dest);
    }
    res = { ok: true, id, path: dest };
  } catch (e) {
    return { ok: false, id, error: 'exception', detail: `导入异常：${(e && e.message) || e}` };
  }
  // ★ 导入成功 ⇒ 自动挂载（契约 §六）。失败结果原样返回（谈不上挂载）。
  if (opts && opts.mount === false) return { ...res, mount: null, mounted: null, mountSkipped: true };
  let m;
  try { m = await mount(res.id, opts); }
  catch (e) { m = { ok: false, how: null, detail: `mount 异常：${(e && e.message) || e}` }; }
  const mounted = !!(m && m.ok);
  const out = { ...res, mount: m, mounted };
  if (!mounted) {
    const note = `（★ 已导入但挂载失败：${(m && m.detail) || '未知原因'}）`;
    out.detail = res.detail ? `${res.detail} ${note}` : note;
  }
  return out;
}

// 挂载 / 登记真实路径 → { ok, how, detail }。只有 ready 才算挂载成功。
// ★★ `opts.envResult`（2026-10-09 补）：透传给 `scanOne(id, opts)` ⇒ **离线单测**用（注入一份合成
//   env 结果即可，**不必起 WSL**），或让调用方**复用已算好的那份** env 结果、免掉一次重复的全量探测
//   （`runDownload` / `importResource` 就是这么把 opts 传下来的 —— 它们上游刚扫过一次）。
export async function mount(id, opts = {}) {
  try {
    const entry = RESOURCES.find((e) => e.id === id);
    if (!entry) return { ok: false, how: null, detail: `未登记资源 ${id}` };
    const how = (entry.mount && entry.mount.how) || 'path';
    const st = await scanOne(id, opts);
    if (!st) return { ok: false, how, detail: `扫描无结果：${id}` };
    if (st.state !== 'ready') {
      return { ok: false, how, detail: `当前状态 ${st.state}，未挂载：${st.detail}` };
    }
    if (how === 'endpoint') {
      const p = await probeEndpoint(st.path);
      if (!p.found || p.executable === false) return { ok: false, how, detail: `端点不可达：${st.path}` };
    }
    return { ok: true, how, detail: (entry.mount && entry.mount.detail) || st.path || '已登记' };
  } catch (e) {
    return { ok: false, how: null, detail: `mount 异常：${(e && e.message) || e}` };
  }
}
