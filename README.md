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

功能：环境状态条 · 43 个风格列表（带简介）· 启动表单（fps/workers/venc/只跑音频/只渲染/dry-run + 高级参数）· **主题出片表单（选风格 + **语言版本** + **输出尺寸** → 落工单）** · **实时日志（SSE，可中途接入）** · 任务队列与取消 · 成片库内嵌播放。

**端口的两条规则**（`server.mjs` 区分处理，因为原因不同）：
- **`EACCES`**（端口落在 Windows 保留段 —— Hyper-V/WSL 随机圈走）→ **自动向后扫描**找可绑端口，并**显著打印实际用的是哪个**。这些段**每次重启都会变**，所以不硬编码备用端口。
- **`EADDRINUSE`**（真被占用）→ **拒绝启动，exit 3，不换端口** —— 换端口会静默起第二个实例。

> 实测本机被圈走：7699-7798 / 7899-8698 / 10592-10691 / 50000-50059（默认 7788 正落在第一段，会自扫到 7799）。

**只监听 `127.0.0.1`，无鉴权。不要改成 `0.0.0.0`。**

### 首次运行：自动安装向导

环境自检（`lib/env.mjs`）本来就是**咨询性**的：它只告诉你缺什么、给出 `fix` 命令，**不阻断**任何事。
现在多了一层：`lib/setup.mjs` 把那些 `fix` 提示升级成**结构化的安装动作**，控制台顶部会出现
「首次运行引导」卡片，每项要么给一个「安装」按钮（后台任务 + 实时日志），要么给一份**明确的手动指引**。

| | 谁能装 | 例子 |
|---|---|---|
| **可自动** | 控制台替你跑（后台串行队列，实时日志，可取消） | `git clone` 库 · `apt install ffmpeg/nodejs` · 上游 `setup.sh deps voice music` · 跑 `fetch-all-fonts.sh` · `tools/fetch.sh instruments all` · `lemo-lib-sync.sh push` |
| **需手动** | 只能你来做，控制台**只给指引、不代跑** | 装 WSL 发行版（要重启）· 装 Windows 侧 ffmpeg 二进制（几百 MB）· 装显卡驱动 · 索取 `lemo-lib-sync.sh` |

分界很硬：**能自动做的才给按钮**。装 WSL 发行版需要重启、装 ffmpeg 二进制是几百 MB 的第三方包 ——
控制台假装能代劳只会把事情搞坏，所以这些一律只给「这一步需要你手动做」的逐步指引。

其他行为：

- **幂等**：每次执行前**重新检测**，对应项已经 ok 就直接跳过，不重装。
- **失败可区分**：网络 / 权限 / 磁盘 / 仓库不存在 / 命令缺失 / 超时，各给各的处置建议（不是一句「失败了」）。
- **超时保护 + 已耗时心跳**：`git clone` 6 GB 时每 10 秒打一行「⏱ 已耗时 Ns」。
- **取消会杀掉 WSL 侧整组进程**：`taskkill /T` 管不到 WSL2 虚拟机里的进程（实测：只 taskkill 的话，
  取消一个 `sleep 40` 之后 Linux 侧还在跑）。安装步骤用 `setsid -w` 起，取消时按进程组 TERM→KILL。
- **不阻塞**：环境有 `fail` 时**照样能启动任务** —— 这条既有行为没变。

**演练模式**（本机环境已就绪，真实检测永远看不到引导，所以必须能演）：

```bash
node lib/setup.mjs                      # 真检测 + 打印当前该做什么（不执行）
node lib/setup.mjs --simulate           # 用 5 个合成场景把每个安装分支都走一遍（不执行）
node lib/setup.mjs --simulate=all       # 只走「12 项全 fail」这个最坏场景
node lib/setup.mjs --dry-run            # 真检测 + 打印将要执行的命令
node server.mjs --simulate-env=bare     # 让控制台假装这是一台干净机器（UI 上预览引导）
```

URL 上加 `?simulate=clean|bare|partial|all|ready` 也能在页面上切换演练场景（顶栏「演练」按钮循环切）。
演练模式下 `/api/setup/run` **仍走真实检测**，所以演练状态**不可能**触发真实安装。

## HTTP 接口清单

控制台服务端 `server.mjs` 的**全部** `/api` 路由。★ 权威来源是 `server.mjs` 的分发块
（`http.createServer(...)` 里那段 `if` 链）；本表由 `scripts/check-api-docs.mjs` **双向**校验：
**server 有而本表没有 ⇒ 闸门 FAIL**（新接口没登记）；**本表有而 server 没有 ⇒ 闸门 FAIL**（文档撒谎）。

- **方法 / 路径**：参数路由写成 `:name` 形式（校验时两边都归一化成 `:id`）；`HEAD` 与 `GET` **并列**列出
  —— 成片接口两者都支持，`HEAD` 供播放器预取元数据。
- **类型**：`同步`（请求内直接应答）· `异步任务`（入后台串行队列、返回 job，进度走 `/api/logs/:id` 的 SSE）·
  `静态`（直接发文件字节，支持 Range）。
- **用途**：机械摘录该处理函数**自己的 `/** ... */` JSDoc 首句**，**不做发挥**；**没有 JSDoc 的如实写「（无注释）」**。

| 方法 | 路径 | 用途 | 类型 |
|---|---|---|---|
| POST | `/api/run` | 入队一个出片任务（异步） | 异步任务 |
| GET | `/api/jobs` | 任务列表 + 队列状态（同步快照） | 同步 |
| DELETE | `/api/jobs/:id` | 取消（排队/运行中）或删除（已结束）一条任务，按状态分派 | 同步 |
| GET | `/api/logs/:id` | 任务日志的 SSE 长连接（支持 Last-Event-ID 断线续传） | 同步 |
| GET | `/api/precheck` | 启动前的并发预检：提示是否已有同一个 demo 在跑 | 同步 |
| GET | `/api/eta` | 一次问一批 slug 的耗时估计（给批量入队确认弹层用） | 同步 |
| GET | `/api/env` | 环境检测结果（默认缓存 30s，?force=1 强制重测） | 同步 |
| GET | `/api/setup/actions` | 「首次运行向导」的数据源：当前环境该装什么、哪些能自动装 | 同步 |
| POST | `/api/setup/run` | 真正执行一个安装动作（后台任务，日志走 /api/logs/:id 的 SSE） | 异步任务 |
| GET | `/api/demos` | 风格（demo）清单：简介、是否带 demo、是否已出片、分类 | 同步 |
| GET | `/api/films` | 成片库清单：一级目录下的 .mp4，外加 dub 子目录的 film.mp4 与 `_jobs\<任务id>\` 下控制台出片的 .mp4，按修改时间倒序 | 同步 |
| GET | `/api/console` | 端口固定入口的当前状态（host / port / url + 落盘与各注册表状态） | 同步 |
| POST | `/api/reveal` | 在资源管理器里打开某个成片目录 | 同步 |
| GET | `/api/style/:slug` | 这个风格的 STYLE.md / DEMO.md，渲染成已转义的 HTML | 同步 |
| GET | `/api/films/:slug/:file` | 发成片字节，支持 Range 请求（能拖进度条）；HEAD 走同一处理函数 | 静态 |
| HEAD | `/api/films/:slug/:file` | 发成片字节，支持 Range 请求（能拖进度条）；HEAD 走同一处理函数 | 静态 |
| GET | `/api/films/dub/:dir/:file` | 文案出片的成片字节（比一级目录深一层），支持 Range；HEAD 同 | 静态 |
| HEAD | `/api/films/dub/:dir/:file` | 文案出片的成片字节（比一级目录深一层），支持 Range；HEAD 同 | 静态 |
| GET | `/api/films/_jobs/:jobId/:file` | 控制台出片的成片字节（落在 `_jobs\<任务id>\`，比一级目录深一层），支持 Range；HEAD 同 | 静态 |
| HEAD | `/api/films/_jobs/:jobId/:file` | 控制台出片的成片字节（落在 `_jobs\<任务id>\`，比一级目录深一层），支持 Range；HEAD 同 | 静态 |
| POST | `/api/briefs` | 落一张主题工单（status=pending），内容留给外部 LLM 生成 | 同步 |
| GET | `/api/briefs` | 工单列表 + 状态计数，并带上 UI 下拉要用的风格/语言/尺寸清单 | 同步 |
| GET | `/api/langs` | 这个风格有哪些语言版本可以出片 | 同步 |
| GET | `/api/sizes` | 可选输出尺寸清单（给前端渲染「输出尺寸」下拉） | 同步 |
| GET | `/api/aspects` | 这个风格的影片真的能正确构图的比例 | 同步 |
| GET | `/api/voices` | 音色清单 + 分组 + 目录状态 + 当前内容用的音色 | 同步 |
| GET | `/api/voices/audio` | 参考音字节流（试听要能拖进度条，所以支持 Range） | 静态 |
| GET | `/api/voices/sources` | 音色源目录里还没被转换成参考音的候选文件 | 同步 |
| POST | `/api/voices/import` | 把一个源素材转成参考音（= 加一个可选音色） | 异步任务 |
| GET | `/api/voices/test/audio/:file` | 试听产物（POST /api/voices/test 的落点） | 静态 |
| POST | `/api/voices/test` | 用指定音色真的合成一句，让用户先听效果再决定 | 异步任务 |
| POST | `/api/dub/upload` | 收下素材（raw body，不是 multipart） | 同步 |
| POST | `/api/dub/preview` | 只做断句，让用户在出片前核对 | 同步 |
| POST | `/api/dub/analyze` | 断段 + 语义标签 + 风格匹配（同步，约 1 秒） | 同步 |
| POST | `/api/dub/run` | 文案 → 成片（异步任务） | 异步任务 |
| GET | `/api/dub/styles` | 风格清单（供 UI 填下拉） | 同步 |
| GET | `/api/dub/sources` | 已上传的素材（供 UI 复用上次传的那条；每条带 kind） | 同步 |
| GET | `/api/dub/source-meta` | 口播素材的像素尺寸（宽 × 高） | 同步 |
| GET | `/api/briefs/processable` | 给外部 LLM 读的：列出所有 pending 工单 + 每个风格的完整素材 | 同步 |
| POST | `/api/briefs/:id/run` | 出片。只有 status=ready 能出（failed 需显式 {"retry":true}） | 异步任务 |
| GET | `/api/briefs/:id` | 读一张工单的当前内容（每次从磁盘读，不缓存） | 同步 |
| PATCH | `/api/briefs/:id` | 外部 LLM 的推荐回写通道（走状态机校验；直接改文件会绕过它） | 同步 |
| DELETE | `/api/briefs/:id` | 删除一张工单（running 中的工单不允许删，回 409） | 同步 |
| GET | `/api/llm/profiles` | 脱敏 profile 列表 + 当前生效 profile | 同步 |
| GET | `/api/llm/config` | 当前生效配置（key 脱敏，只回 hasKey） | 同步 |
| POST | `/api/llm/config` | 保存用户覆盖，落盘 `<成片根>/_llm-api.json` | 同步 |
| POST | `/api/llm/validate` | 跑 validate()（可传临时配置，不必先保存） | 同步 |
| POST | `/api/llm/chat` | 跑一次 chat()（**兼容保留**：面板「试跑」已改走 `/api/llm/invoke`） | 同步 |
| POST | `/api/llm/invoke` | 通用 AI 算力调用（chat / image / audio / embedding / custom，转发到模块 invoke()） | 同步 |
| POST | `/api/llm/models` | 拉取当前 Endpoint 的可用模型清单（面板「多模型切换」用） | 同步 |
| GET | `/api/resources/scan` | 资源全量/子集扫描（返回 `lib/resources.mjs` 的 `scanAll()`；30s 缓存 + 并发合并） | 同步 |
| GET | `/api/resources/dirplan` | 目录规划（纯函数、不碰 IO，直接透传） | 同步 |
| POST | `/api/resources/import` | 手动导入用户自备的包（未知 id ⇒ 400） | 同步 |
| POST | `/api/resources/download` | 一键下载（后台任务，日志走既有任务/SSE 通道） | 同步 |

★ 上表共 **54** 条（`server.mjs` 分发块的 `方法 路径` 语句数）。用途全部有出处、**0** 行是「（无注释）」：
其余 **52** 行各摘录其处理函数的一句 `/** ... */` JSDoc 首句（机械摘录、不做发挥）；`GET /api/jobs` 与
`DELETE /api/jobs/:id` **无处理函数**、内联在分发块里，用 `//` 行注释说明。
★ `GET /api/logs/:id` 是 **SSE 长连接**，不属于上面三类，这里按「请求内直接应答」归为 `同步`。

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
lemo-make.bat engraving --lang zh            :: 语言版本（把 content=X.json 换成 X.zh.json）
lemo-make.bat ascii-crt --ratio 9:16         :: 输出宽高比（默认 9:16）
lemo-make.bat ascii-crt --size 1080x1920     :: 自定义像素（优先级高于 --ratio）
lemo-make.bat engraving --voice zh_kepu9     :: 换配音音色（Index-TTS 参考音，见「音色选择」）
lemo-make.bat engraving --voice zh_kepu9 --speed 1.1   :: 连语速一起定（0.5–2.0）
lemo-make.bat --help
```

输出到 `D:\lemo-films\<slug>\`。

### 三条通路（入口不同、产出不同）

本层的出片入口**不止 `lemo-make.mjs` 一个**。共**三条通路**，根本区别是**画面主体从哪来**：

| # | 通路 | 入口 | 画面主体来自 | 声音 |
|---|---|---|---|---|
| ① | **主题 + 风格** | `lemo-make.bat <slug>` / `node lemo-make.mjs <slug>` | 风格自带的 demo（按该风格的内容文件渲染） | 风格自带配音或 TTS |
| ② | **文案 + 风格** | `node dub.mjs --script <文件> [--style <slug>]` | 生成的渐变背景（或 `--bg <图>`） | 现场 TTS 念你给的文案 |
| ③ | **文案 + 口播 + 风格** | `node dub.mjs --script <文件> --video <mp4> [--style <slug>]` | **你给的那段口播素材**（保持比例、居中裁切铺满） | 现场 TTS；`--keep-original` 可保留原声原画 |

②③ 是**同一个入口** `dub.mjs` 的两种形态：不给 `--video` 走形态 A（= ②），给了就走形态 B（= ③）。
`dub.mjs --help` 有全部选项；输出同样落在 `D:\lemo-films\dub\<名字>\`。

★ **一处**已知的 CLI ↔ 控制台口径差异（**有意保留、不硬统一**，2026-10-07 审计后写明）：
`--gap`（句间停顿）在 **CLI 允许 0–5**，而**控制台 API**（`POST /api/dub/run`）**只允许 0–3**
—— 后者与 UI 输入框的 `max="3"` 对齐，属控制台自己的**更严**策略。
核心 `lib/dub-core.mjs` 的 `buildTimeline(lines, durs, gap)` **不设上限**（gap 只是加在句间），
所以 3 与 5 都不是实现要求的；且 `0–3 ⊂ 0–5` ⇒ API 从不放过 CLI 会拒的值，
**不存在「同一请求一条入口接受、另一条拒绝」的功能性差异**。
⇒ 处置：**不改任一侧的校验**，改为把差异写明（`dub.mjs` 的 USAGE 也补了范围），
并由 `test/dub-api.test.mjs` 的 ⑱ 把 **API 侧口径钉住**（`gap: 3.5` 必须 400）。

> **它和编排器不是一回事**：`dub.mjs` **不碰 demo 脚本** —— 不跑 `build.sh`、不做配乐/静帧、
> 不读 `demo-manifest-all.json`。所以它**没有**编排器那种「漏跑生成器」的问题（那类缺口只存在于 ①：
> `lemo-make.mjs` 按 manifest 挑步骤，漏了哪一步会静默沿用旧产物）。dub 的画面只有两种来源
> —— **你给的素材**或**一张背景** —— 没有第三步可漏。

**三条通路的编码器口径一致**（用户硬规则：渲染一律本地 GPU 优先）：`LEMO_VENC` 未设 ⇒ `h264_nvenc`；
显式 `libx264` ⇒ CPU；其它值 ⇒ 报错退出（绝不静默回落）。这条由
`scripts/check-render-venc.mjs` 把三条通路的决策点全数登记、逐个守。

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

## 编排器与 `build.sh` 的差异清单

编排器**不是** `build.sh` 的逐行复刻 —— 它按**候选清单探测** demo 自带的脚本（`for c in …; do [ -f ] && break; done`）。
因此**有些 `build.sh` 步骤编排器不跑**。这张表如实登记（2026-10-06 首核，2026-10-07 复核），
并说明各自影响。★ 影响分四级：**成片内容**（不跑 ⇒ 成片内容与 `build.sh` 不一致）/ **只影响交付图**
（成片本身不变，`poster.jpg`、`stills/*.jpg` 会陈旧）/ **纯自检**（不跑只是少一道校验，成片一字不变）/
**已核实无差异**（确定性生成物，不跑与跑逐字节相同）。

| 步骤（相对 `demo/`，`core/` 的相对库根） | 影响 | 涉及的风格 | 说明 |
|---|---|---|---|
| `tools/pitch.py` | **成片内容** | art-deco | ★ **已修（2026-10-06）**：编排器**现在会跑它**（原先漏跑 ⇒ 门童两句 +4 半音静默丢失）。列在此处只为标记「这一类缺口确实存在过」 |
| `tools/trim_cmd.py` | **成片内容** | microgame | ★ **已修（2026-10-07）**：编排器**现在会跑它**（原先漏跑 ⇒ 4 个命令词带元音尾巴、`dur.json` 停在未裁剪时长）。位置同 `pitch.py`：配音之后、ASR / 回传之前 |
| `tools/export_cues.mjs` | **成片内容** | urban-sketch | ★ **已修（2026-10-07）**：编排器**现在会跑它**（Windows 侧 `exportEventsAndSubs()` 第 ①-b 步，产物 `audio/cues.json` 回传 WSL 供 `audio/foley.py` 直读）。原先漏跑 ⇒ 拟音按旧画面笔画/轨迹排 |
| `tools/words.py` | **成片内容** | dataviz / swiss-motion | ★ **已修（2026-10-07）**：编排器**现在会跑它**（`asr_check.py` 之后、`VOICE_DONE` 之前；产物 `voices/words_rel.json` 由页面 `main.js` 直读驱动逐词高亮）。原先漏跑 ⇒ 逐词时间轴陈旧 5~6 天 |
| `tools/video_png.mjs` | **成片内容** | risograph | ★ **已修（2026-10-07）**：编排器**现在会用它**。它是**换渲染器**（PNG 无损中间片）而非追加一步 —— 上一轮判「不接」是因为它**不接受 `--size`**、接上会静默丢画幅；本轮先给它补上 `--size`（照 `core/render/page.mjs` 的 `takeSize` 同源），再在编排器渲染段做**候选探测**（`demoRenderRel`，不写死 slug）。**为什么必须修**：网点色在 JPEG 4:2:0 里会被吃掉 ⇒ 用 `core/render/video.mjs` 出的 risograph 成片视觉上是**降级**的。列在此处只为标记「这一类缺口确实存在过」 |
| `models/gen_volt.mjs` + `models/gen_kite.mjs` | 已核实**无差异** | hologram-hud | 生成 volt / kite 素材。2026-10-07 实测重跑产物与入库版**逐字节相同**（md5 volt `b25a8e24…` / kite `9f1badb7…`）⇒ 确定性生成物，**不跑与跑无差异**，故不为它改编排器 |
| `core/render/still.mjs` | 只影响交付图 | **27 个**风格（含 art-deco） | 出静帧 → `stills/*.jpg`、`poster.jpg`、`styleframe.jpg` 会**陈旧**（成片本身不变）。2026-10-07 已量化（见下） |
| `tools/still.mjs` | 只影响交付图 | rubber-hose | 同上 |
| `tools/cuecheck.py` | 纯自检 | 12 个：art-deco / dark-keynote / dataviz / engraving / hologram-hud / iso-infographic / microgame / midcentury-toon / silent-film / silkscreen-poster / whiteboard / woodcut | 配乐卡点 ↔ 画面时间网格自检 |
| `tools/final_asr.py` | 纯自检 | **8 个**：dark-keynote / **dataviz** / hologram-hud / iso-infographic / microgame / rubber-hose / **stained-glass** / woodcut | 成片终检（ASR 比对） |
| `check_mix.py`（`demo/` 或 `demo/tools/`） | 纯自检 | 2 个：blueprint / glass-product | 混音自检 |

**这些差异是机器可检的**（2026-10-06 起）：`lemo-make.mjs` 的 `ORCH_SKIP_STEPS` 登记表 + `reportOrchSkipSteps()`，
会在**起飞前检查**里按上表报出本 demo 命中的步骤（`★ 影响成片内容` / `○ 只影响交付图` /
`· 仅少一道自检` / `· 已核实：不跑与跑无差异`）。
**只提示、绝不阻断**（不 fail、不改退出码），且**不依赖** `demo-manifest-all.json` —— 声明缺失/损坏时照样有效
（这补的正是「声明里 `assets_required` 多为空 ⇒ 漏跑的步骤根本不出现在任何报告里」那个**全静默**盲区）。
用 `--no-preflight` 可整块关掉。

★ **为什么这些不写进 `orchestratorRuns()` 的 `runs[]`**：`runs[]` 的语义是「编排器本次**会执行**它」
（它是音频脚本与「第 3 步」候选循环的镜像），把**不执行**的步骤写进去会让起飞前检查把它们当成「会跑」而
**静默** —— 与「让缺口可见」正好相反。所以单列一张登记表，报之前再核「脚本真在本 demo 里」**且**
「`orchestratorRuns()` 确实返回 false」，于是将来某一步被编排器补上时它会**自动**不再报
（`pitch.py` 是第一例；2026-10-07 补进编排器的 `trim_cmd.py` / `export_cues.mjs` / `words.py` 是第二、三、四例，
它们已从登记表里**移除**，`runs[]` 镜像则同步**加入**。`video_png.mjs` 是**第五例，也是形态不同的一例** ——
它不是「漏跑一步」而是**换渲染器**，同样已移除、已进 `runs[]`；移除后该表的 `impact: content` 一档**为空**，
如实说明：内容级缺口目前**清零**，表结构保留，供将来如实登记新发现的内容级缺口。）

★ **`tools/video_png.mjs`（risograph）已接上（2026-10-07）—— 它是怎么修的**：
它在 `build.sh:12` **替换** `core/render/video.mjs`：
`node $D/tools/video_png.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4`。
它用 **PNG 截图 + `yuv444p` 无损中间片**（`video.mjs` 用 JPEG q95 + `yuv420p`）。
★ **为什么这不是锦上添花**：risograph 的网点色（粉/蓝）在 JPEG 的 4:2:0 色度下采样里**会被吃掉** ——
编排器此前出的 risograph 成片**网点被压掉**，视觉上就是降级版，属**产品正确性**问题。

上一轮判「不接」的三条硬伤，本轮逐条处理：
1. **它不接受 `--size`** ⇒ 已给 `video_png.mjs` 补上 `--size` / `--ratio`：照 `core/render/page.mjs` 的
   `takeSize` **同源**解析（`{ w: W, h: H } = takeSize(args)`），**不自己发明一套**；`w/h` 传给**两处**
   `openDemo`（probe 与每个 worker）；顺带补上 core 版有的 `requireDemo(dir)`。缺省仍是 1920x1080
   （`FALLBACK_SIZE`）⇒ **不改默认、全库 37 个 `build.sh` 的调用零回归**。
2. **它默认输出 `out/video24.mp4`，与下游要读的 `out/video_gpu.mp4` 对不上** ⇒ **经复核这条不成立**：
   `video_png.mjs:18` 本来就吃 `--out`（`opt('--out', …)`），而编排器**显式传**了
   `--out …/out/video_gpu.mp4` ⇒ 它写的就是 `video_gpu.mp4`。下游 `mux.sh` 读的正是这个名，
   **无需改下游**。且渲染段原本就有「退出码 0 但没产出 `video_gpu.mp4` ⇒ 失败」的断言，输出名对不上会**大声拦下**。
3. **补齐前两项要改 `D:/lemo-opuscar` 的脚本** ⇒ 本轮该文件**在允许改动范围内**，并已**镜像 WSL**、
   逐字节核对 md5 两侧相同（`node scripts/check-dual-copy-sync.mjs` **exit 0**）。
4. ★ **上一轮没发现、本轮端到端跑出来的第 4 条硬伤：拼接一步在本机必 EBUSY。**
   `core/render/video.mjs:108` 的拼接显式传了 `execFileSync(…, { stdio: ['ignore','inherit','inherit'] })`，
   而 `video_png.mjs:42` 的**同名同用途**调用**没传**（副本漂移）⇒ 默认 `['pipe','pipe','pipe']`。
   本机实测：**Node 的 `spawnSync`/`execFileSync` 只要走 pipe 就 EBUSY**（连
   `spawnSync('cmd.exe',['/c','echo','hi'])` 都 EBUSY；换 `stdio:'ignore'`/`'inherit'` 则 `status 0`）——
   `lemo-make.mjs:261` 早就记过「本环境 spawnSync 一律 EBUSY」。**后果**：960 帧全渲完（86s、分段 1.4GB）
   后在拼接处 `exit 1`，**全部白渲**。修法 = 照 core 版补上同一个 `stdio` 选项（**不是新发明**，是补齐副本漂移），
   顺带让 ffmpeg 的报错能真的打到 stderr（pipe 时被 `execFileSync` 吞掉）。
   ★ 这条**不是**本轮引入的：改前 `video_png.mjs` 也长这样 ⇒ 该 demo 自己的 `build.sh` 在本机同样跑不到底。

编排器侧的做法（`lemo-make.mjs` 渲染段，**不写死 slug**）：
```js
const demoRenderRel = [`${demoRel}/tools/video_png.mjs`]
  .find(r => fs.existsSync(path.join(CFG.winLib, r)));
const renderScriptRel = demoRenderRel || 'core/render/video.mjs';
const renderVArgs = [renderScriptRel, demoRel, '--fps', … ];   // 其余参数与落点一字不动
```
形状照同文件里 `demoMuxRel` 的 `.find()` 候选写法。**只换可执行脚本，参数与 `--out` 落点一字不动**
⇒ 下游 `mux.sh` / 帧数闸门 / 新鲜度断言全部无需改。同步把 `${d}/tools/video_png.mjs` 加进
`orchestratorRuns()` 的 `runs[]`（否则起飞前检查会继续把它报成「编排器漏跑」），并从 `ORCH_SKIP_STEPS` 移除。

★ 顺带核过：risograph 自带的 `tools/mux.sh` 有 `V/A/O` 签名 ⇒ 编排器**本来就会**用它，那条不是缺口。

★ **一处已知边界（本轮未动，如实登记）**：`qIntent()` 用 `pick('video.mjs')` 从 `build.sh` 的**渲染行**
取字面量 `--q`，而 risograph 的渲染行写的是 `video_png.mjs` —— 子串 `video.mjs` **不匹配** ⇒ 这一行取不到 `--q`。
**今天无影响**（全库只有 risograph 用 `video_png.mjs`，而它的渲染行本来就没有 `--q`，取不到与取到 `null` 等价）。
若将来某个 demo 的 `video_png.mjs` 行带了字面量 `--q`，需要把 `qIntent()` 的 needle 扩成
`['video.mjs', 'video_png.mjs']`（**有意不做**：为今天不存在的用例改编排器，风险大于收益）。

★ **静帧（`core/render/still.mjs`）陈旧度已量化（2026-10-07）**：只影响交付图，**成片不变**，故不为它加
编排器步骤（风险高、收益低）。实测做法与结论如下（原始数据见 `D:/lemo-tmp/agent-orchgap/`）：

- **方法**：对 **7 个**风格各按它**自己 `build.sh` 里那条产出 `stills/styleframe.jpg` 的原始命令**
  （`t` 与 `--q` 逐字照抄）重渲一张到临时目录，与已入库的那张做逐像素比对。
  样本：`stained-glass`(40.6, nosub=1) · `art-deco`(41.9, nosub=1) · `microgame`(50.2, nosub=1) ·
  `dataviz`(37.62, nosub=1) · `risograph`(28.8, nosub=1) · `ascii-crt`(39.4, nosub=1) ·
  `blueprint`(31.0, nosub)。
- **三条对照（必须先做，否则结论不成立）**：① **渲染器确定性** —— 同一条命令独立跑两遍，**7/7 逐字节相同**
  （后来又补跑一遍 3/3 亦逐字节相同）⇒ 后面量到的差异不是渲染抖动；② **`voices/` 混淆项** —— Windows 侧这几个
  demo 大多没有 `voices/`（渲染页 `fetch('voices/dur.json')` 404），把当前 `voices/` 临时补进去再渲，
  **7/7 仍逐字节相同** ⇒ 差异与 `voices/` 无关（这些 `--q` 都带 `nosub`，字幕本来就关着）；
  ③ **光栅化后端（关键对照）** —— 把同一帧在 `LEMO_GPU=0`（软件光栅化，`core/render/browser.mjs:12-14`
  就不传 `--enable-gpu`）下重渲，与 `LEMO_GPU=1`（默认，ANGLE/D3D11）**逐字节不同**，且差的**量级与
  「新渲 vs 已入库」完全同级**：

  | 风格 | 新渲(GPU开) vs 已入库 | GPU 开 vs GPU 关（**只换后端、源码一字未改**） |
  |---|---|---|
  | stained-glass | 1.965 / 5.47% | **2.314 / 6.61%** |
  | microgame | 2.722 / 9.82% | **2.496 / 10.19%** |
  | dataviz | 0.876 / 1.53% | **0.894 / 0.75%** |

  ⇒ 即「**什么都没改、只换光栅化后端**」就能造出与 A/B 同量级（stained-glass、microgame 甚至更大）的差异。
- **量化结果**（新渲 vs 已入库）：

  | 风格 | 平均绝对差 /255 | 像素差 >8/255 | >32/255 | 最大通道差 |
  |---|---|---|---|---|
  | stained-glass | 1.965 | 5.47% | 0.07% | 149 |
  | art-deco | 1.807 | 4.11% | **1.64%** | 161 |
  | microgame | 2.722 | **9.82%** | 0.83% | 220 |
  | dataviz | 0.876 | 1.53% | 0.38% | 197 |
  | risograph | 1.216 | 2.48% | 0.13% | 172 |
  | ascii-crt | 1.989 | 6.43% | 0.47% | 133 |
  | blueprint | 0.943 | 2.50% | 0.28% | 143 |

- **结论（如实说明，与直觉相反）**：**7/7 都与已入库的不一致**，但**逐张目视核对后，画面内容是一致的**
  —— 同一构图、同一文字、同一姿态、同一组数据；差异**集中在光栅化层**（`microgame` 的天空半调网点相位、
  `dataviz` 的标题字渲染、`art-deco` 的辉光/边缘、`stained-glass` 的整体曝光），且差异分布是**局部集中**
  而非全画面均匀薄层。结合对照 ③，这批差异**不足以判定「交付图内容陈旧」**：其量级可被「仅切换光栅化后端」
  完全解释（最可能是 headless-shell / GPU 驱动或 `core/render/browser.mjs` 的启动参数在这批图生成之后变过；
  本闸门**无从区分**「源码变了」与「渲染器/驱动变了」）。因此只能下**较弱但确定**的结论：
  「**已入库的交付图在当前渲染管线下不可逐字节复现**」，**不能**说它们与当前源码不一致。
  ⇒ 处置：**不为它加编排器步骤**；但若你要求交付图与当前源码**逐字节**一致，请重跑各 demo 自己的
  `build.sh`（或手动跑那条 `still.mjs` 命令）。★ `hd-2d` **不在这 7 个里**：它没有 `build.sh`、
  `DEMO.md` 里也没有产出 `stills/styleframe.jpg` 的那条命令 ⇒ **无法复现、也就无法比对**（它的
  `stills/styleframe.jpg` 缺可追溯的生成命令，这本身是一条值得记的缺口）。

★ **不要拿 `demo-manifest-all.json` 的 `steps` 字段自动比**：编排器**直接调用**的 `core/` 脚本
（`core/render/events.mjs`、`srt.py`、`video.mjs`、`mux.sh`、`core/tts/tts.py` …）都不在 `runs[]` 镜像里
（那个镜像只覆盖「demo 自带候选脚本」这一类）⇒ 自动比对会把它们**全判成「漏跑」**（实测 34 个风格里 34 个命中，
明显失真）。这也是本表选「人工核实 + 登记」而不是「自动比对」的原因。

★ **干净名单**：按 `build.sh` 逐条抽取核对，37 个带 `build.sh` 的风格里**绝大多数至少漏跑一步**，
本表核出的「没有上述任何一步」的是 **crayon-book / impasto / paper-lantern**；另有 **lowpoly-island**
（只差 `music/check.py` 一个自检）与 **scifi-toon**（只差 `asr.py` / `srt.mjs` —— 后者是编排器**有意**不跑的
Node 字幕脚本，见「第 6 步混流」里的说明）。

## 四批新功能：语言版本 / 配音引擎 / 输出尺寸 / 音色选择

三者的共同点：**开关都在「内容文件」或一条命令行里，且都能逐字节回归到改动前**。
深度用法（中文断行、字体栈为什么必须带拉丁、Index-TTS 音色怎么选、控制台的裁切警告）见
`creative/coffee/04-从零原创使用手册.md` 的 §6 / §6.5 / §7；这里只讲编排层与接口这一侧。

### 语言版本 `--lang`

语言**不在命令行里**，在内容文件的 `"lang"` 字段里；`--lang <code>` 只做一件事：
**把 `content=X.json` 换成 `X.<code>.json`，并同时送到渲染侧与事件侧**（与 `--film` 同理 ——
只送一侧会让事件表/字幕/配乐停在另一种语言，`cuecheck` 还会拿同一份错事件核成「通过」）。

| | 规则 |
|---|---|
| `--lang zh` + `--q content=content_coffee.json` | 用 `content_coffee.zh.json`；找不到就 `fail` 并列出该 demo 现有内容文件，**不静默退回英文** |
| `--lang en`（或不传） | **空操作**：不传 `--lang`，命令行与加语言功能之前逐字一致 |
| `content=` 填什么 | **基名**（`content_coffee.json`），不要写 `content_coffee.zh.json`（那会去找 `.zh.zh.json`） |

语言注册表是库侧 `core/lang/lang.mjs` 的 `LANGS`（**加一种语言 = 在那里加一条**），它驱动字体、字距、
圆窗编号前缀（`FIG.` → `图`）与配音音色。控制台的语言下拉来自 `GET /api/langs?slug=<风格>`，
它按上面这条换名规则**探测该风格真的有哪个语言版本**（没写 `.zh.json` 的风格只显示「英文版」）。

★ 中文版**主动跳过离线 ASR 校对**：whisper 小模型对中文实测 **9/9 全 DIFF**（相似度 0.20–0.57），
且它的 norm **不归一化「十/百/千」**（含多位数字的行即使转写正确也 FAIL）⇒ 只会刷一屏假警告、掩盖真正的失败。
判定按 `lines.json` 里的 `lang`，**不是**按命令行。

### 配音引擎（`voice.engine`，缺省 `kokoro`）

用哪个 TTS 后端，由**内容文件**的 `voice.engine` 决定，**没有命令行开关** —— 因为语言（`lang`）和
引擎（`voice.engine`）是同一个源头：编排器只读内容文件，不会出现「字幕已中文、配音还走英文音色」。

| 引擎 | 实现 | 跑在哪 | `voice` 是什么 |
|---|---|---|---|
| `kokoro`（缺省） | `core/tts/tts.py` | WSL 的 `.venv` | Kokoro 音色名（`bm_fable` / `af_heart`…） |
| `indextts` | `core/tts/tts_indextts.py` | 本机 Windows 便携版 Index-TTS 2.5 自带的 venv（脚本**自重入**过去） | **参考音频**（别名 `zh_curator` / `zh_curator_alt`，或目录里**真实存在**的 `voice_NN` / `.wav` 路径），**不是**音色名 |

Index-TTS 是本机部署的零样本克隆引擎，**从 WSL 启动即可**：脚本用 `/mnt/<盘符>/…` 做存在性检查、
借 WSL interop 起那个 Windows python，再自重入（`_LEMO_INDEXTTS_INNER=1`）；**一次进程加载模型、
批量合成全部行**，不要逐条调用（逐条 = 每条都重新加载 3.2 GB 模型）。
实测 9 条台词：加载 ~25 s、每条 ~30 s（RTF ≈ 6.5）、合计约 4 分钟。可配置项
`INDEXTTS_HOME` / `INDEXTTS_PYTHON` / `INDEXTTS_APP` / `INDEXTTS_TIMEOUT`。
★ 跨宿主路径的坑（**外层不要对 Windows 路径调 `os.path.abspath`**、**内层参数必须是 Windows 路径**）见手册 §6.5。

### 输出尺寸 `--ratio` / `--size`（默认 9:16）

**比例→像素换算的唯一来源是库侧 `core/render/size.mjs`**（`RATIOS` / `DEFAULT_RATIO` / `resolveSize`），
编排器与控制台都从这里取，不各抄一份。

| 比例 | 像素（长边 1920） |
|---|---|
| **9:16**（默认） | **1080 × 1920** |
| 16:9 | 1920 × 1080 |
| 3:4 | 1440 × 1920 |
| 4:3 | 1920 × 1440 |
| 1:1 | 1920 × 1920 |
| 自定义 `--size WxH` | 你填的（两边都必须是 96–8192 的**偶数**，H.264 `yuv420p` 要求；下限 96 是渲染器的实测几何下限，见库侧 `core/render/size.mjs` 的 `MIN_SIZE`） |

优先级 `--size` > `--ratio` > 默认（9:16）；两个都不给 = 9:16。编排器把结果**显式**以 `--size WxH`
传给 `video.mjs`（低层渲染工具只认 `--size`，不认 `--ratio`）。

★ **「默认 9:16」为什么放在编排器/控制台，而不放在低层 `takeSize`**：`still.mjs` / `video.mjs` 是低层工具，
全库 37 个风格的 `demo/build.sh` 都直接调它们、**都不传 `--size`、全按 1920×1080 构图**；把低层默认改成
9:16 会让那些示例片**当场全坏**。所以 `takeSize` 的默认仍是 1920×1080，「默认 9:16」只在出片流程生效。

★ 影片布局的自适应是**逐风格**做的：`styles/engraving/demo/film_coffee.js` 已改造（从视口 `opts.W/H`
重排版面，并在 `FILM_META.aspects` 声明支持的比例；1920×1080 时逐字节退化），**其它风格的影片模块
若未改造，在非 16:9 下会被裁切**（不是重排、也不是留黑边）。控制台建单时会**读影片源码文本**探测
`aspects`，不落在这个风格能构图的那些比例上就弹橙色警告（**只警告、不禁用**）——
判据与自查见手册 §7.4 / §7.5。

### 音色选择 `--voice` / `--speed`（2026-10-02）

**Index-TTS 不认音色名，只认参考音频** —— 所以「换音色」= 换一条参考 wav，别名只是给内容文件一个稳定锚点。

```bat
lemo-make.bat engraving --voice zh_kepu9              :: 官方别名 / 音色库名 / 相对路径
lemo-make.bat engraving --voice zh_kepu9 --speed 1.1  :: 语速 0.5–2.0（映射到 duration_factor = 1/speed）
python core/tts/tts_indextts.py --list-voices          :: 看有哪些可选（不加载模型，秒回）
```

★ `--voice` **只改 `lines.json` 里每行的字段，不动内容文件** —— 所以不会多出两份内容文件互相漂移。
它的实现位置在「内容派生」与 `--lines` **之后**（优先级最高）。

**音色从哪来**（两级，都在 `core/tts/tts_indextts.py` 顶部配置）：
- `INDEXTTS_REF_DIR`（默认 Index-TTS 自带的 `官方测试素材/参考音频/`）—— 13 个官方参考音 + 2 个别名
- `INDEXTTS_VOICE_LIB`（默认 `D:/sucai/gongzuoliusucai/kelongshengyin/_ref_wav/`）—— **用户自备音色库**，
  由声音库里的 MP3 转成 wav 后放进来；脚本会把它下面的所有 `.wav` 自动列成可选音色（子目录不计）

**换音色后必须重调语速**：不同音色「字/秒」差别很大 —— 实测同一句话、同一 speed，
`科普博主9` 比官方 `voice_12` **短 31%**。沿用旧语速会要么塞不进页面固定的口播槽位（口播重叠）、
要么留下大片静音空档。

**参考音的电平判据是「峰值」而不是 RMS**：Index-TTS 按参考音的电平出音，顶到满刻度就会把克隆输出
顶到满刻度（**削波不可逆**）。官方 `voice_05` 就是因为 peak 1.0 导致克隆全部削波而被弃用。
目标水位 `mean ≈ -30dB / peak ≤ -10dB`；自备素材几乎都需要先降电平（实测用户素材比官方响 15dB）。
脚本会在合成前打印每条参考音的 `时长 / peak / rms` 并在超标时告警。

**控制台「声音」版块**：列出全部音色（分组：别名 / 我的音色库 / 官方参考音 / 音色库其它），
可**试听参考音**、**试合成一句**、**选用**；选中的音色与语速存 localStorage，
出片时自动注入 `--voice` / `--speed`（主表单与「主题出片」两个入口都生效）。接口：
`GET /api/voices`、`GET /api/voices/audio?name=`、`POST /api/voices/test`、`GET /api/voices/test/audio/<file>`。
清单的**唯一真相源**是 `tts_indextts.py --list-voices`，Node 侧不另抄一份别名表。

⚠️ 有 `voice_fx.py` / `voice.py` 的风格（实测 `ascii-crt`、`scifi-toon`）走的是声线处理脚本，
**`--voice` / `--speed` 不生效**，配音音色由那个脚本决定 —— 编排器会打印 `STEP_WARN` 说明，
不会静默忽略。

## 测试

```bash
node test/smoke.mjs          # 冒烟测试（41 条，约 15–40 秒，不渲染；WSL 冷启动会到 1–2 分钟）
node test/smoke.mjs --full   # 额外跑一次完整 ascii-crt 回归（约 80 秒起，共 50 条）
node test/setup.test.mjs     # 首次运行安装的纯逻辑测试（12 条，约 5 秒，不起服务、不用 WSL）
node test/setup-api.test.mjs # 「首次运行向导」两个接口的 HTTP 契约测试（9 条，约 20 秒，★ 绝不真安装）
node test/ui.test.mjs        # Web UI 层测试（无头 Edge 渲染 DOM + CDP 真点击，59 条）
node test/consistency.test.mjs  # 一致性校验门的纯逻辑测试（17 条，不起浏览器）
```

零依赖（`node:assert` + `node:http` + `node:child_process`），退出码 0 = 全绿。覆盖：

- **编排器 md5 红线** —— `lemo-make.mjs` 必须仍是 `7130414be5906fcb0582c457e232b40b`（控制台只是包装层）
- **行尾规则** —— 源码全 LF、`start-console.bat` CRLF（防 git 静默改写源码）
- **27 条服务端用例** —— HTTP 接口（含 43 风格 / 9 分类 / 0 未归类、`/api/style` 注入防护、目录穿越、`/api/sizes` 尺寸换算、`/api/langs` 语言版本、`/api/aspects` 构图能力）+ SSE 续传 + 并发锁 + Range
- **dry-run 任务全链路** —— `POST /api/run` → 轮询到结束 → SSE 日志里出现步骤标记 `[1]`
- **CLI 未受影响** —— `node lemo-make.mjs ascii-crt --skip-sync --dry-run` 仍 exit 0

`test/setup.test.mjs` 单独一个入口（不并进 smoke），因为「41 条」是冻结的验收基线，数量本身就是约定。
它专测**本地走不到的那条路**：「检测到缺失 → 生成正确的安装动作」做成纯函数
（`planActions(envResult)`），再喂合成的「干净机器」检测结果 —— 于是每个安装分支都能被断言覆盖。
含一条**漂移哨兵**：从 `lib/env.mjs` 源码里抽出所有 item id，逐个断言 `lib/setup.mjs` 有专门的
安装动作（env.mjs 加了新检查而 setup.mjs 忘了跟 → 立刻红）。

测试自己用**随机空闲端口**起一个临时服务、跑完自己停，**不碰**你正在用的控制台实例
（启动时会覆写 `.console-port` / `打开控制台.url`，测试跑前备份、跑后按字节还原）。
详见 `test/README.md`（含「不覆盖什么」与副作用说明）。

## 文件

```
lemo-make.bat          入口（找 node → 转调 .mjs）
lemo-make.mjs          主编排器（通路 ①：主题 + 风格）
dub.mjs                第二入口（通路 ②③：文案 + 风格 / 文案 + 口播 + 风格）
README.md              本文件
test/smoke.mjs         冒烟测试入口（零依赖）
test/cases.mjs         冒烟测试用例
test/setup.test.mjs    首次运行安装的纯逻辑测试
test/setup-api.test.mjs  「首次运行向导」接口的 HTTP 契约测试（零依赖，绝不真安装）
test/ui.test.mjs       Web UI 层测试（无头 Edge + CDP）
test/consistency.test.mjs  一致性校验门的纯逻辑测试
consistency-check.mjs  跨 Windows/WSL 的「字幕 ↔ 语义 ↔ 画面」一致性闸门
originality-audit.mjs  原创性审计
server.mjs             Web 控制台服务
lib/                   控制台的服务端模块（env / setup / jobs / store / styles / briefs / langs / sizes / aspects / consistency / originality）
lib/style-dna/         各风格的创作逻辑与作者契约
web/                   控制台前端（index.html / app.js / style.css）
```

`lib/langs.mjs`（语言清单）、`lib/sizes.mjs`（比例清单）、`lib/aspects.mjs`（影片构图能力）
都是**只读代理**：权威来源在库侧（`core/lang/lang.mjs` / `core/render/size.mjs` / 影片源码里的
`FILM_META.aspects`），控制台只动态 import / 读文本，**绝不另抄一份清单**（两处判据必然漂移）。
读不到库时各自降级并**如实上报**（语言只剩英文版、比例只剩默认 9:16），不静默用自造的表。

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

### 6. WSL2 里的进程**不是** `wsl.exe` 的 Windows 子进程

`taskkill /PID <wsl.exe> /T /F` 杀不掉虚拟机里那个命令。实测：取消一个跑在 WSL 里的 `sleep 40` 之后，
**Linux 侧的 sleep 照样活到自然结束**（换成 6 GB 的 `git clone` 就是「点了取消还在后台下载」）。

对策（见 `lib/setup.mjs:killWslGroupCommand`）：WSL 侧脚本用 `setsid -w` 起，自己成为**新进程组的组长**，
首行把 `$$`（= PGID）写到 `/tmp/<uniq>.pgid`；取消时另起一条 `wsl.exe` 对整组 `TERM → KILL`。
`pkill -f` 的匹配串要**拆成两半再拼**（`P="abc""def"`），否则那条 kill 命令会匹配到自己。

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
