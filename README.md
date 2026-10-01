# lemo-tools — lemo-opuscar 跨 Windows/WSL 统一编排层

把「GPU 渲染」从手工旁路变成默认路径。

## 两种用法

| 方式 | 入口 | 适合 |
|---|---|---|
| **命令行** | `lemo-make.bat <slug>` | 批处理、脚本化、调试 |
| **Web 控制台** | 双击 `start-console.bat` → 浏览器 | 选风格、看实时进度、管理成片 |

**两者互不影响**：控制台不启动时 CLI 一切照常；控制台崩溃不影响正在跑的任务。

### Web 控制台

```
双击 start-console.bat              （默认端口 7788，可传参改：start-console.bat 18080）
或   node server.mjs --port 7788 --open
```

功能：环境状态条 · 43 个风格列表（带简介）· 启动表单（fps/workers/venc/只跑音频/只渲染/dry-run + 高级参数）· **实时日志（SSE，可中途接入）** · 任务队列与取消 · 成片库内嵌播放。

**端口的两条规则**（`server.mjs` 区分处理，因为原因不同）：
- **`EACCES`**（端口落在 Windows 保留段 —— Hyper-V/WSL 随机圈走）→ **自动向后扫描**找可绑端口，并**显著打印实际用的是哪个**。这些段**每次重启都会变**，所以不硬编码备用端口。
- **`EADDRINUSE`**（真被占用）→ **拒绝启动，exit 3，不换端口** —— 换端口会静默起第二个实例。

> 实测本机被圈走：7699-7798 / 7899-8698 / 10592-10691 / 50000-50059（默认 7788 正落在第一段，会自扫到 7799）。

**只监听 `127.0.0.1`，无鉴权。不要改成 `0.0.0.0`。**

## 为什么需要这一层

lemo-opuscar 原本的 `build.sh` 是 POSIX 脚本，只能在 WSL 里跑。但**它的渲染在 WSL 里用不上显卡**：

| 环境 | WebGL 渲染器 | 1435 帧耗时 |
|---|---|---|
| WSL | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device ...))` | 231 s |
| **Windows** | **`ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)`** | **48 s** |
| Windows + NVENC | 同上 | **37 s** |

**WSL 拿不到 GPU 的原因**（不是没装驱动）：
- `/dev/dri/card0` 的 uevent 是 **`platform:vgem`** —— 虚拟占位设备，**没有渲染能力**
- `glxinfo -B` 报 `Accelerated: no`
- Vulkan ICD 目录里没有 `dzn`/`d3d12`，只有 lavapipe（软件）

所以本编排层以 **Windows 为外壳**（GPU 渲染不可外包），通过 `wsl.exe` 调 WSL 做音频与混流。

## 分工

```
Windows（GPU）      渲染  core/render/video.mjs   →  WebGL 走 RTX 4060
                    ↑ 音频与渲染是两条独立支线，并行执行
WSL（CPU + NVENC）  音频  TTS / 声线 / ASR / 配乐 / 混音
                    混流  core/render/mux.sh（LEMO_VENC=h264_nvenc）
```

> WSL 的 ffmpeg 实测**带可用的 `h264_nvenc`**，所以硬件编码不需要搬到 Windows。

## 用法

```
lemo-make.bat <demo-slug> [选项]
```

```bat
lemo-make.bat ascii-crt                      :: 默认：24fps / 6 workers / NVENC
lemo-make.bat ukiyoe --fps 30 --workers 8
lemo-make.bat ascii-crt --render-only        :: 只重渲视频
lemo-make.bat ascii-crt --audio-only         :: 只重跑音频
lemo-make.bat ascii-crt --skip-sync          :: 跳过库同步
lemo-make.bat ascii-crt --venc libx264       :: 回退 CPU 编码
lemo-make.bat ascii-crt --dry-run            :: 只打印计划（含起飞前检查）
lemo-make.bat tilt-shift --q noev=1          :: 页面参数（默认只给渲染）
lemo-make.bat ascii-crt --no-preflight       :: 跳过起飞前检查
lemo-make.bat --help
```

输出到 `D:\lemo-films\<slug>\`。

## 六个步骤

| # | 步骤 | 在哪 | 说明 |
|---|---|---|---|
| 1 | 环境自检 + 一致性闸门 | 两侧 | 检查 node/ffmpeg/WSL；**独立核验 `core/render/` 两侧 md5 一致**（不一致直接拒绝开工） |
| 2 | 库同步 | WSL → Windows | 下发字体/素材；回灌 `video.mjs` |
| 3 | **导出事件与字幕** | **Windows** | `events.mjs` / `subs.mjs` 要开页面，只能在 Windows 跑；**产物显式回传 WSL** |
| 4 | 音频 ∥ 渲染 | WSL / **Windows GPU** | 两条独立支线，**并行** |
| 5 | 混流 | WSL | `mux.sh` + `LEMO_VENC` |
| 6 | 导出 | Windows | 复制成片与字幕到输出目录 |

> **起飞前检查**（`[起飞前检查]`）在步骤 1 之后、`--dry-run` 之前执行。它读 `demo-manifest-all.json`，
> 检查该 demo 声明的输入是否在位，并分三态告知：**真缺口**（编排器漏跑生成器）/ **外部条件**（需要 macOS 或联网）/
> **非缺口**（素材不在仓库里）。**只提示，绝不阻断**；声明文件不在就静默跳过。用 `--no-preflight` 关闭。

### 步骤 3 为什么必须单独成步

`events.mjs` / `subs.mjs` 要开页面（headless 浏览器），所以只能在 **Windows** 侧跑；但它们的**消费者全在 WSL**
（`mix.py` / `music/score.py` / `subs.py` 读 `events.json`，`mux.sh` 的 `srt.py` 读 `out/subs.json`）。
两侧是**独立文件系统**，所以编排器必须**显式把产物拷回 WSL**。

而且各 demo 的 `build.sh` 里 `events.mjs` 在 `mix.py` **之前**（有依赖），所以这一步必须放在并行段**之前**。


## 文件

```
lemo-make.bat          入口（找 node → 转调 .mjs）
lemo-make.mjs          主编排器
README.md              本文件
```

依赖的外部脚本（在 `D:\WSL\`）：
- `lemo-lib-sync.sh` —— 两份库的同步（`push` / `pull` / `check`）
- `fetch-all-fonts.sh` —— 字体补齐（幂等）

## ⚠️ 环境约束（踩过的坑，改动前务必读）

### 1. 本环境里 `spawnSync` 一律失败

`child_process.spawnSync` 在这个环境里对**任何**可执行文件都返回 `EBUSY` —— 连 `cmd.exe /c echo hi` 都不行。**异步 `spawn` 完全正常。**

所以 `lemo-make.mjs` **不使用任何 `spawnSync`**。改这个文件时不要引入同步版本。

### 2. 调 WSL 必须走「脚本文件」而不是内联 bash

内联多行 bash 通过 `wsl.exe` 传参会**吃掉变量、错乱引号**（`$VAR` 变空、嵌套目录、`$f` 丢失）。本项目的做法一律是：

```
把脚本写到 D:\WSL\<name>.sh
→ wsl.exe ... bash -c "sed 's/\r$//' /mnt/d/WSL/<name>.sh > /tmp/<name>.sh && su - lemo -c 'bash /tmp/<name>.sh'"
```

`runWsl()` 已经封装了这个模式。

### 3. Windows ffmpeg 不在 PATH 上

`video.mjs` 内部是 `spawn('ffmpeg', …)`，而 Windows 的 ffmpeg 只有 `D:\ffmpeg-9.x\...\bin\` 和 `D:\Feijian\_internal\` 下有。编排器会把第一个存在的目录**注入 PATH**。不注入的话渲染会在写分段时失败。

### 4. 两份库不能全量互覆盖

- WSL 的 `video.mjs` 是**原始版**，Windows 的带 `LEMO_VENC` 开关 —— 全量覆盖会**静默回退** nvenc
- Windows 的 `video.mjs` 是**全仓唯一的 CRLF 文件**，回灌 WSL 前必须 `tr -d '\r'`
- 同步**一律不加 `--delete`**（目标侧有 Windows 独有的 `node_modules/` 和渲染产物）

### 5. `node_modules` / `.venv` 永远排除

`.venv` 是 Linux 专用（`bin/python3.12` 是 `/usr/bin/` 的绝对软链）。`node_modules` 两侧各一份（各 39 MiB），实测 0 个平台特定二进制但**不建议软链**（跨文件系统软链会拖慢 ESM 解析）。两侧各自 `npm ci`。

## 已知的上游 bug

`core/render/mux.sh` 会把**任何短于 58 秒的音频**误判为「文件损坏」并拒绝出片：

| 音频时长 | 退出码 |
|---|---|
| 10 / 30 / **57** s | **1**（`the file is damaged or cut off`）|
| 58 / 60 / 90 s | 0 |

**根因**：`loudnorm` 动态模式有约 3 秒前瞻缓冲，不计入 `-progress` 的 `out_time`，实测偏差**恒为 2.9 秒**；而 `mux.sh` 的容差是 `max(时长×5%, 0.15)`，要盖住 2.9 秒就得时长 ≥ 58 秒。

上游那支 59.79 秒的成片是**擦边通过**（`59.79×5% = 2.99 > 2.9`，只富余 0.09 秒）。

编排层默认**启用修复**（用一次不带 loudnorm 的廉价解码独立测真实时长）；设 `LEMO_STRICT_UPSTREAM=1` 可恢复上游行为以便逐字节对比。

## 相关报告

全部在 `D:\workbuddyAI\huancun999\Opus 5.5\lemo-opuscar-notes\`：
- `GPU渲染方案与完整出片报告.md` —— 主报告
- `mux等价实现规格.md` —— mux.sh 逆向规格 + NVENC 参数映射
- `库差异与同步清单.md` —— 两份库的精确差异与同步策略
- `mux改动简报.md` / `库同步脚本简报.md` —— 实现记录
