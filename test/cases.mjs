// test/cases.mjs —— lemo 控制台冒烟测试用例（零依赖）
//
// 分三类：
//   STATIC_CASES   不需要起服务：纯文件检查 + 纯函数单测 + CLI 子进程
//   SERVER_CASES   需要控制台服务在跑：HTTP 接口逐个打
//   PROCESS_CASES  在本进程里 import lib/jobs.mjs 起一个独立队列：验 WSL 侧进程组 kill、日志裁剪/gap
//
// 上下文 ctx 由 test/smoke.mjs 构造，形状见其文件头。
//
// ★ 用例只读项目、只读接口。有副作用的几件事（全部登记在 ARTIFACTS 里，跑完由 cleanupArtifacts 收掉）：
//   1. CLI 子进程（lemo-make.mjs 自己会写 D:\lemo-films 的锁/输出目录，属正常）
//   2. /api/run 起一个 dry-run 任务（不渲染、不混流）
//   3. ⑥ 取消一个 dry-run 任务 —— 会留下编排器的陈旧锁，测试自己删掉（只删 pid 对得上的那一个）
//   4. PROCESS_CASES 起两个任务（一个 sleep 120 的 wsl 步骤 + 一个 20050 行的 exe 步骤），
//      它们会写进 .console 的 index.json / logs；跑完从索引摘掉、日志文件删掉
//   5. WSL 侧的 /tmp 标记文件、D:\WSL 的临时脚本
//   6. FULL_CASES 的现场 TTS 用例（⑤++ / ⑤++++++ / ⑤+++++++）—— 会在 D:\lemo-films 下建
//      `_smoke-tts-*` / `_smoke-fitb-*` / `_smoke-fitd-*` 输出目录，并让 dub.mjs 在共享缓存目录
//      `dub/_verify/` 里写一份同名抽帧目录；两者都登记进 ARTIFACTS.dirs（⑤+++++++ 跑三次 ⇒ 三个抽帧目录）
//   测试服务覆写 .console-port / 打开控制台.url 的副作用由 smoke.mjs 负责备份还原。

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

// 只借 CFG 的常量（wslDistro / exportDir）。env.mjs 顶层没有任何副作用 —— 不会触发探测。
import { CFG } from '../lib/env.mjs';

// ★ 起服务的测试实例不该写用户的固定入口文件（.console-port / 打开控制台.url）——
//   否则每跑一次测试就把它们改成测试端口；跑崩时还原语句没执行，脏值还会残留（见 server.mjs 文件头）。
//   设了这个环境变量，本进程（含它 import 的 smoke.mjs）spawn 出的 server.mjs 会跳过写入。
process.env.LEMO_CONSOLE_NO_ENTRY_FILES = '1';

// ── 红线常量 ────────────────────────────────────────────────
/** ★ 编排器的权威 md5。控制台只是包装层，绝不能改它。 */
// ⚠️ 更新史（都不是控制台改了编排器，而是编排器自身的定向修复）：
//    · 0554085abb34c50e3e1bcfe8f28ab0e1 → fe6eff223293fe741290e23a9102737c：
//      给 runWsl 加 `stream: true` 让音频链路输出实时透传（旧行为：音频步骤标题打在第 10.1s，
//      第一行输出却等到 362.3s，中间 352.2 秒屏幕全静 —— 看着像死了）。改动只涉及 run() 的
//      可选 onChunk 钩子、runWsl 的 stream 开关、以及音频那一步的调用点。
//    · fe6eff223293fe741290e23a9102737c → f6a52d8c1bd82862458d7d3798c1e1c3：
//      音频脚本正文「既不截断也不缓冲」两处一起改（缺任何一处都不生效）：
//        ① 8 处 `| tail -N` 全部去掉 —— tail 必须等 EOF 才知道「最后 N 行」是哪 N 行，会把管道攒住；
//        ② 脚本顶部加 `export PYTHONUNBUFFERED=1` —— python 的 stdout 不是 tty 时按 4KB 块缓冲，
//           输出只有几十行时等于「退出时才吐」，这才是子步骤之间长静默的**主因**。
//      两条都用计时实验实测过：经 tail -2 全挤在 EOF；`stdbuf -oL python3` 也全挤在 EOF（stdbuf
//      改的是 libc stdio，CPython 的 sys.stdout 走自己的 BufferedWriter，不受影响 ⇒ 这条路是死的）；
//      `python3 -u` / `PYTHONUNBUFFERED=1` 才是逐行到达。真实出片对比：改前 TTS 那步静默 22.3s、
//      配乐 20.5s、混音 12.3s；改后 TTS 逐行冒出、混音逐段冒出（配乐那步仍静默，见下）。
//      失败检测未受影响：`set -o pipefail` 下「管道退出码 = 上游退出码」，去掉 tail 后退出码语义
//      等价，STEP_FAIL / STEP_WARN 两套语义与脚本业务逻辑（跑什么、什么顺序、什么条件）一个字没动。
//      ★ 素材步（paper.py）与字幕步（subs.py / srt.py）那三处 tail **刻意保留**：它们所在的
//        runWsl 没开 stream，输出本来就整块到达，tail 只起「压掉冗长输出」的作用，不造成静默。
//      ⚠️ 已知残留：score.py 这类脚本中途一个字都不打印、只在最后 dump JSON，那段是纯计算时间，
//        没有输出可流（要改进度只能改 demo 自己的脚本，超出编排器职责）。
//    ⚠️ 以上缺陷用 --dry-run 都测不出来（dry-run 不跑音频），必须真实出片才现形。
//    · f6a52d8c1bd82862458d7d3798c1e1c3 → e22161a40121413d5771787e18e8562c：
//      **「内容只换一半」这一类缺陷的第三次出现**，由首部「主题→视频」真实出片暴露（换内容重跑后
//      画面/配音都是新主题，只有 .srt 还是上一版）。四处修复 + 两个新选项：
//        ① 字幕源不吃内容参数：`buildShArgs()` 见到未映射的 $C 就返回 null（担心少传一个参数会把
//           后面的顶到前面去），于是 subs.py 被**零参数**调用、回落到默认 content.json。
//           而 `eventsArgTemplate()` 早就有 $C 占位机制，只是**只用在 events 步骤**。
//           → 通用化为 `posArgTemplate(slug, demoRel, needle)`，字幕生成器共用同一模板。
//        ② Windows 侧 voices/dur.json 永不刷新：dur.json 由 WSL 的 TTS 生成，而读它排口播时间窗的
//           页面跑在 Windows（全仓 20+ 个 demo 的页面读它）。默认内容时仓库里已提交一份正确的，
//           **一旦换内容就必然错**（实测偏差 0.2–1.6s）。→ 换内容/换配音行时先跑「只到配音」的
//           前置阶段（LEMO_VOICE_ONLY），把 voices/*.json 回传 Windows，**再**开始渲染。
//        ③ 配音行不随内容派生：build.sh 第一步就是 `$PY -c "…open('$D/$C')…open('$D/lines.json','w')"`
//           —— 配音行文本是从内容文件派生的，编排器不跑这一步。→ 新增 `linesDerivation()`：
//           **照抄 build.sh 那一行**（不重新实现派生规则，避免漂移），只替换内容槽；在配音前置阶段执行。
//        ④ 新增 `--lines <file>`（只换台词不换画面）与 `--film <name>`（同风格另做一部新片，
//           页面 ?film=<name>；事件脚本经 LEMO_FILM 环境变量传，避免顶掉它的 work 位置参数）。
//      ★ 踩坑记录：shell 的 `${VAR:-default}` **会撞上 JS 模板字符串插值**（实测
//        `SyntaxError: Missing } in template expression`）。本文件里一律只能用 `$VAR` 形式，
//        默认值靠 JS 侧注入 `export VAR='...'`；新增 `shq()` 做单引号安全转义。
//      ⚠️ 同样地：这一整类缺陷用 --dry-run 都测不出来（dry-run 不跑音频），必须真实出片才现形。
//    · e22161a40121413d5771787e18e8562c → 2cb2081dfc8d0afa34a723c67c0e96ff3：
//      **修正上一版「配音前置」的时序缺陷**（由首部原创片的真实实拍日志暴露）：
//      上一版把「配音前置」放在 `audioP` 的 IIFE 里，而 `audioP` 与 `renderP` 两个 IIFE 是
//      **同时启动**的 —— 渲染并不会等它。实测日志里 TTS 的输出与渲染进度是**交错**的，
//      渲染页仍旧 fetch 到旧的 voices/dur.json。后果有两层：
//        ① 画面上的口播窗/字幕时间按示例片的旧时长排（偏差 0.2–1.6s）；
//        ② 更隐蔽的是，一致性校验门的 `LINES` 也来自页面读到的 dur.json，
//           于是它会**拿同一份错时长自洽地"假通过"**。
//      → 把配音前置提成 `audioP`/`renderP` **两个 Promise 建立之前**的独立 await，
//        并把失败经 `voicePhaseErr` 传给 audioP（前置失败就不再起音频/渲染）。
//      ⚠️ 这一类缺陷 --dry-run 测不出来（dry-run 不跑音频、也不建 Promise），必须真实出片看日志时序。
//    · 2cb2081dfc8d0afa34a723c67c0e96ff3 → 9d935da0e65cbaab114418991aee2e01：
//      **新增「语言版本」**（用户要求：出片可选中文/英文，选哪种语言就出全套对应语言的片子）。两处：
//        ① 新增 `--lang <code>`：规则是「把 content=X.json 换成 X.<code>.json」，并**同时**送到渲染与
//           事件侧 —— 与 `--film` 完全同理（只送一侧会让事件表停在另一种语言，`cuecheck` 会拿同一份
//           错事件核成"通过"）。语言本身由内容文件的 "lang" 字段承载（字体/字距/圆窗编号前缀/
//           站点刻名/配音音色都由它驱动，见 core/lang/lang.mjs），所以 --lang 只负责"换对文件"。
//        ② 音频脚本对 CJK 语言**主动跳过 `asr_check`**：离线 whisper 对中文实测 9/9 全 DIFF
//           （相似度 0.20–0.57），且它的 norm 不归一化「十/百/千」，含多位数字的行即使转写正确
//           也会 FAIL ⇒ 中文版只会刷一屏假警告、掩盖真正的失败。判定按 lines.json 里的 lang。
//      ★ 注意：`--lang en` 时**不传**这个选项，命令行与改动前逐字节一致（英文路径零影响）。
//    · 9d935da0e65cbaab114418991aee2e01 → 2a001d6de4baaada182cd5403a0868ad：
//      **新增「输出尺寸」与「配音引擎」两条编排能力**（同一轮）：
//        ① `--ratio <9:16|16:9|3:4|4:3|1:1>` / `--size <WxH>`，**缺省 9:16**
//           （用户要求：任务没有明确指定输出尺寸时，自动采用默认值 9:16 导出视频）。
//           比例→像素的换算**不在本文件写第二份** —— 唯一来源是库里的 core/render/size.mjs，
//           运行时 import；读不到才退回内置最小表**并明确警告**（不静默降级）。
//           ★ 为什么默认放编排器而不是 takeSize：still.mjs / video.mjs 是低层工具，全库 43 个
//             风格的 demo/build.sh 都直接调它们且不传 --size、全按 1920x1080 构图；把低层默认
//             改成 9:16 会让那些示例片当场全坏。出片流程显式传尺寸才是正确的位置。
//        ② 配音引擎由**内容文件**的 `voice.engine` 决定（缺省 kokoro）。`indextts` 走本机
//           Windows 便携版的 Index-TTS 2.5：脚本自重入到它自带的 venv python，所以从 WSL
//           启动即可，但**输出目录必须给 Windows 路径**（那个 python 认 D:/ 不认 /mnt/d/），
//           写完再把 wav 拷回 WSL 给 mix.py（mix 在 WSL 跑）。一次进程加载模型批量合成，
//           **不要逐条调用**（逐条 = 每条都重新加载 3.2GB 模型）。
//           ★ 与「语言」同源：语言由内容文件的 `lang` 承载，引擎由 `voice.engine` 承载。
//    · 8c30e388208e1617e3799f507419d2e0 → 61dc5b9ddbaa6caab66ab5ab11dec488：
//      ① **`core/` 一致性闸门扩容**：从只查 `core/render` 扩到 `core/render + core/tts + core/lang`。
//         真因：新写的 `core/tts/tts_indextts.py` 只在 Windows 侧存在（配音却在 WSL 跑），
//         链路跑到一半才报 `python: can't open file`。
//         ★ 但**只比代码/文本文件**（.py/.mjs/.js/.sh/.css/.json/.txt/.md）—— 模型与字体这类
//         二进制资产本就按侧存在（Kokoro 的 .onnx/.bin 只在 WSL、CJK 的 .woff2 只在 Windows），
//         算进闸门只会逼人做无意义的双份拷贝。
//      ② **尺寸自适应闸门**：非 1920×1080 输出时，读影片模块源码判断它有没有导出 `NATIVE`
//         （自适应的标志）。没有就明确警告「很可能是把 1920×1080 的版面裁掉一块」。
//         真因：出片流程默认已改成 9:16，而自适应是**逐风格**做的 —— 实测全库 22 个影片模块里
//         **只有 2 个**（都在 styles/engraving：film.js / film_coffee.js）导出了 NATIVE，
//         其余 20 个仍按 1920×1080 硬画 ⇒ 在它们上面出 9:16 会被裁掉一块。
//         这种失败是**静默**的（像素尺寸完全正确，只有看画面才发现），所以必须喊出来。
//         ★ 用文本特征而非 import：影片模块是浏览器模块（依赖 window/document），Node 里 import 不起来。
//           启发式只用于警告、不阻断；文案里明说「按源码特征判断」，绕过办法是显式给 --ratio 16:9。
//    · 61dc5b9ddbaa6caab66ab5ab11dec488 → 00b8cf1a9de4b904b9481b55ae67c0ea：
//      **尺寸取值改为「两个都独立校验」**。原实现 `const bad = o.size ?? o.ratio` 只校验胜出的那个，
//      于是 `--size 1080x1920 --ratio 7:5` 会**静默丢弃**拼错的 7:5（退出码 0、一字不提），
//      用户打错比例毫无反馈。改成「给了的都要合法」，合法性判完再按 size > ratio 定优先级
//      （优先级语义不变，独立验证已确认 `--size` 仍优先）。
//      来源：独立验证的 G3 找茬项（实测复现）。
//    · 00b8cf1a9de4b904b9481b55ae67c0ea → 070c8bacbdeaa582e8a3e81a6030de45：
//      **自定义尺寸下限 16 → 96**（`MIN_SIZE` / `MAX_SIZE` 在编排器里成为唯一来源）。
//      真因：16 是**编造的**，实测根本画不出来。影片把尺寸按 S = min(W/1920, H/1080) 统一缩放，
//      圆窗半径 RR·S 在 S 很小时缩到接近 0，而库侧 engine/plate.js 的 roundelFrame 还要画一条
//      内圈，半径是 `RR·S − max(3.5, …)` —— 差值算成负数 ⇒ ctx.arc() 抛 IndexSizeError，
//      且**没人接** ⇒ 整个渲染进程退出码 1 + 栈回溯（`--size 16x16` 必现）。
//      实测（2026-10-02）：film_coffee（RR = 84）≤72 崩、80 起正常；film.js（RR = 120）≤48 崩、
//      56 起正常 ⇒ 几何下限 = 两者的较大值 80，留 20% 余量取 **96**（推导写在库侧 size.mjs 的
//      MIN_SIZE 注释里，控制台 / UI / 文档都从那里读）。
//      ★ 编排器只改了两处：内置兜底表的 ok 边界（改读 `M.MIN_SIZE` / `M.MAX_SIZE`）与那行提示文案。
//        正常路径 M 就是库模块 ⇒ 下限直接从库读，这里不再各写一份（避免「同一张表抄两份」）。
//    · 070c8bacbdeaa582e8a3e81a6030de45 → 268ff96dd7e442b4b34dfd5048f8c621：
//      ① **尺寸自适应闸门改读正式声明**。原来靠 `/export\s+const\s+NATIVE\b/` 猜源码文本；
//         现在**优先读 `FILM_META.aspects`**（语义：「这部影片真的能正确构图的比例清单」，
//         不写 = 只支持 16:9），探测逻辑复用现成的 `lib/aspects.mjs`（动态 import；
//         影片模块是浏览器 ESM，Node 里 import 不起来，所以它内部也是读源码文本+正则）。
//         为什么改：同一件事只该有一处判断 —— 控制台全链路（`/api/aspects`、建单校验、
//         UI 出片前警告）已经在用 aspects，编排器不该另猜一遍。`NATIVE` 正则降为兜底。
//         收益：警告文案带上「能力来自 aspects 声明（text 探测：<文件>）」与修复指引，
//         比原来只说「看起来没做自适应」有用得多。
//      ② **超范围报错补上下限**。原实现 `--size 64x64`（格式合法但低于可渲染下限）只说
//         「解析失败」，不说下限是多少。现在直接摆出 `96–8192` 及下限的由来。
//         来源：独立验证实测的 UX 缺口。下限 96 的推导见 core/render/size.mjs 注释
//         （实测 coffee 需 ≥80、bee 需 ≥56，取 80 再留 20% 余量 = 96）。
// ★ 这是「控制台只是包装层，不能改编排器」这条红线的基线。
//   **它拦的是「控制台的功能偷偷改了编排器」，不是「编排器永远不许变」。**
//   如果你**有意**改了 lemo-make.mjs（例如给它加一个正式功能），更新这个常量是正确的做法，
//   但要同时更新 test/README.md 里那张表 —— 两处不一致会让下一个人以为红线坏了。
//   更新命令：`md5sum lemo-make.mjs`
//   2026-10-02 更新：加了 --voice / --speed（配音音色与语速覆盖，控制台「声音」版块用）。
//   2026-10-03 更新：接入**风格特质档案（style-dna）** —— 编排器新增 import 共享 reader、
//     按档案取颗粒（grain）并做兜底、在档案真生效时打印一行提示，以及 HELP 文案。
//     这是**有意给编排器加功能**，基线值随之更新（红线本身保留，见 test/README.md 那张表）。
//   2026-10-05 更新：主题通路补上**出片前的显存守卫** —— 在「音频链路」启动前调用
//     lib/vram.mjs 的 ensureVramFree()（与 dub.mjs 的 TTS 前守卫同一接口、同一语义：预检 → 不足才自动
//     卸载常驻模型 → 仍不足则硬拦失败），杜绝「常驻大模型占满显存 ⇒ Index-TTS 静默挂死」。
//     这是**有意给编排器加功能**，基线值随之更新（红线本身保留，见 test/README.md 那张表）。
//   2026-10-06 更新：**配乐与「配音 + ASR」并行**（音频链调度）。把「配乐」一节从「配音」之后
//     提到之前并后台起跑，混音前用 `wait` 收尾；判据是「该 demo 的配乐脚本是否引用 voices/ 目录
//     或配音阶段产物（dur.json / words.json / words_rel.json / lips.json）」——从代码推出，不写死
//     风格名单（全库 43 风格只有 game-show 与 living-screencast 命中，保持串行；hologram-hud 的
//     `voices=` 是 pad_chord() 的函数参数，不命中）。实测音频链 22.5s → 19.0s（省 3.5s / 15.3%），
//     成片逐字节不变、失败仍 exit 1。这是**有意改编排器**（纯调度，不削弱校验），基线值随之更新
//     （红线本身保留，见 test/README.md 那张表）。
//   2026-10-06 更新：**库路径加环境变量覆盖点**（`LEMO_LIB_WIN` / `LEMO_LIB_WSL`）。原先
//     CFG.winLib / CFG.wslLib 写死为 D:\lemo-opuscar 与 /home/lemo/lemo-opuscar，没有 --lib
//     也没有环境变量 ⇒ 新 clone 上跑编排器**仍然指向真库**，「新克隆能不能跑」无法端到端验证
//     （只能静态分析猜）。现两处均改为 `process.env.LEMO_LIB_* || 原写死值`，命名照既有
//     LEMO_MANIFEST / LEMO_LOCK_DIR 习惯；默认值即原值 ⇒ 不设变量时行为逐字节不变。
//     这是**有意改编排器**（只加覆盖点，不动任何逻辑），基线值随之更新
//     （红线本身保留，见 test/README.md 那张表）。
//   2026-10-06 更新：**字幕告警措辞与第 6 步对齐**（E 类）。第 3 步原说「字幕源不重新生成，
//     .srt 将沿用旧文件」，但第 6 步可能由 demo 自带的 srt 生成器产出新字幕 ⇒ 该断言会**误导**
//     （诊断里 3 条「告警误导」）。现第 3 步改为「本编排器不生成字幕源；.srt 是否更新取决于第 6 步」，
//     第 6 步补明「（第 3 步编排器未产出、demo 自带 srt 生成器本次也没产出）」。**纯措辞，不改逻辑/行为**。
//     这是**有意改编排器**，基线值随之更新（红线本身保留，见 test/README.md 那张表）。
//   2026-10-06 更新：**补上 art-deco 漏跑的变调步 tools/pitch.py**（端到端实测确证的真缺口）。
//     音频链的「配音」段在 wav 落盘、`voices/*.wav` 非空校验**之后**、ASR / 回传 Windows **之前**
//     新增一步候选探测（照 MUSIC / MIX 那几处同一个 `for c in …; do [ -f ] && break; done` 形状，
//     **不写死 slug**）：候选 = `$D/tools/pitch.py`，只在文件存在时跑，不存在就跳过、不出声。
//     ★ 位置是硬约束：pitch.py 会按 lines.json 的 pitch 字段变调重采样并**改写 voices/dur.json**，
//     而 dur.json 是「配音 → 回传 → 渲染」时序链的判据（渲染页初始化时 fetch 它排口播时间窗），
//     回传之后再改就白搭；同时它必须落在 LEMO_SKIP_VOICE 块**之内**，否则 'rest' 相位会把变调
//     叠加两次。实测：编排器出的 dur.json 由 B1 1.009 / B2 1.113 回到做过 pitch 的 0.801 / 0.883。
//     同步改了 orchestratorRuns() 的 runs[] 镜像（否则起飞前检查会把 pitch.py 误报成「漏跑」）。
//     另在 preflight 里加了**只提示、不阻断**的 `ORCH_SKIP_STEPS` 登记表 + reportOrchSkipSteps()：
//     把「build.sh 有、编排器不跑」的步骤（内容有影响 / 只影响交付图 / 纯自检）如实报出，
//     补的正是「声明里 assets_required 多为空 ⇒ 漏跑静默」那个盲区。
//     这是**有意改编排器**（补一个真缺口 + 让同类缺口可见，不削弱任何校验），基线值随之更新
//     （红线本身保留，见 test/README.md 那张表）。
//   2026-10-07 更新：**补上三个「build.sh 有、编排器漏跑、且影响成片内容」的步骤**（逐条核实确证）。
//     (a) `tools/trim_cmd.py`（全库仅 microgame）—— 音频链「配音」段内、`voices/*.wav` 非空校验与
//         pitch.py **之后**、ASR / 回传 Windows **之前**新增一步候选探测（照 pitch.py 同一个形状，
//         **不写死 slug**）。它按 lines.json 的 `trim` 字段裁掉命令词首尾多余的词（Kokoro 念单个词
//         会带元音尾巴：Pump → "Pompey"），**改写三样**：裁剪后的 wav、`voices/dur.json`（时长变短）、
//         `lines.json.asr.json`。位置硬约束同 pitch.py：dur.json 是「配音 → 回传 → 渲染」的时序判据，
//         且必须落在 LEMO_SKIP_VOICE 块之内（否则 'rest' 相位会二次裁剪）。
//         附带把 ASR 的**输入行文件**换成 `$D/lines.json.asr.json`（**仅当本步真跑过**）—— microgame
//         的 build.sh 用的就是它；拿原始 lines.json 去比会把「已裁到只剩 Pump」的音频和「Pump, now!」
//         比 ⇒ 4 条假 DIFF。words.json 本身与 asr 字段无关，故这条只影响校对措辞。
//     (b) `tools/export_cues.mjs`（全库仅 urban-sketch）—— Windows 侧 `exportEventsAndSubs()` 的
//         第 ①-b 步（紧跟 events.mjs，与 build.sh 同序）：开页面读 window.STROKES/TRACK()/EV/DUR，
//         写 `demo/audio/cues.json`，那是 WSL 侧 `audio/foley.py:12` 的**直读输入**（决定拟音轨的
//         全部时间与声像）。它**开页面 ⇒ 只能在 Windows 侧跑**，产物必须显式回传 WSL —— 已把
//         `${demoRel}/audio/cues.json` 加进回传清单。失败 `fail()`（不静默）。
//     (c) `tools/words.py`（全库仅 dataviz / swiss-motion）—— 音频链内、`asr_check.py` **之后**、
//         `VOICE_DONE` / 回传之前：读 lines.json + `voices/words.json`（asr_check 刚写的那份），
//         按字符位置比例把 whisper 词起点映射到原文单词上，写 `voices/words_rel.json` —— 两个风格的
//         页面 main.js 直读它驱动字幕**逐词出现**。实测陈旧证据：WSL 侧 words_rel.json 停在 9/30，
//         而 words.json 已是 10/6（dataviz）/ 10/5（swiss-motion）⇒ 编排器从未跑过它。
//         只在 ASR **真跑了**的分支里跑；跳 ASR 时 `words_rel.json` 与 `words.json` **一并**从回传
//         清单里剔除（同源派生，同一个「不刷新 mtime、避免伪装成新的旧文件」理由）。
//     ★ 同步改了 orchestratorRuns() 的 runs[] 镜像（加入这三个脚本路径），否则起飞前检查会把它们
//       继续报成「编排器漏跑」；同时从 `ORCH_SKIP_STEPS` 登记表里**移除**这三条（它们已被编排器跑）。
//     ★ 另两条**判断为不改编排器**（如实登记，不硬做）：
//        · `models/gen_volt.mjs` / `gen_kite.mjs`（hologram-hud）：重跑产物与入库版**逐字节相同**
//          （实测 md5 一致）⇒ 不跑无差异，登记表 impact 由 content 降为新增的 `none` 档。
//        · （`tools/video_png.mjs` 当时也判为「不接」，2026-10-07 下半场已接上，见下一条。）
//     这是**有意改编排器**（补三个真缺口 + 如实降级一条误报，不削弱任何校验），基线值随之更新
//     （红线本身保留，见 test/README.md 那张表）。
//   2026-10-07 下半场更新：**接上 risograph 的 `tools/video_png.mjs`（换渲染器：PNG 无损中间片）**。
//     它**替换** core/render/video.mjs 而不是「追加一步」—— 原因不是画质偏好：risograph 的网点色在
//     JPEG 的 4:2:0 里会被吃掉，用 core 版渲出的成片**视觉上是降级的**（网点被压掉），属产品正确性。
//     (a) 给 `styles/risograph/demo/tools/video_png.mjs` 补上 `--size` / `--ratio`：照 core 的
//         `core/render/page.mjs` 的 `takeSize` **同源**解析（不自己发明一套），并把 w/h 传给两处
//         `openDemo`（probe 与每个 worker），顺带补上 core 版有的 `requireDemo`。缺这个口时编排器
//         传的 `--size WxH` 会被**静默丢掉**、按 1920x1080 出片（9:16 尤其明显）。
//     (a2) ★ 端到端跑出来的**第 4 条硬伤**：`video_png.mjs:42` 的拼接 `execFileSync` **没传 stdio**，
//         而 `core/render/video.mjs:108` 的同名调用传了 `['ignore','inherit','inherit']`（副本漂移）。
//         本机 Node 的 spawnSync/execFileSync **只要走 pipe 就 EBUSY**（lemo-make.mjs:261 早记过）⇒
//         960 帧全渲完后在拼接处 exit 1、**全部白渲**。已照 core 版补齐同一个 stdio 选项。
//         这条不是本轮引入的：改前 video_png.mjs 也长这样 ⇒ 该 demo 自己的 build.sh 在本机也跑不到底。
//     (b) 编排器渲染段改成**候选探测**（`demoRenderRel`，形状照 `demoMuxRel` 的 `.find()`；
//         **不写死 slug**：路径由 demoRel 拼出来）：demo 自带 `tools/video_png.mjs` 就用它，
//         否则回退 `core/render/video.mjs`。**只换可执行脚本，参数与落点一字不动** ——
//         `--out` 仍指到 `out/video_gpu.mp4`（video_png.mjs 本来就吃 `--out`），下游 mux.sh 无需改；
//         且渲染段原有的「退出码 0 但没产出 video_gpu.mp4 ⇒ 失败」断言已覆盖「输出名对不上」。
//     (c) ★ 红线三处同步：本文件 ORCH_MD5、test/README.md 那张表与「本次改了什么」段、
//         README.md 的「编排器与 build.sh 的差异清单」。另同步了 orchestratorRuns() 的 runs[]
//         （加 `${d}/tools/video_png.mjs`）并从 ORCH_SKIP_STEPS **移除**该条（它已被编排器跑）。
//     ★ 库仓文件（video_png.mjs）改动已**镜像 WSL** 并逐字节核对（见 test/README.md）。
export const ORCH_MD5 = '6283aadb98433b16ea2a35c2a754cd30';

/** /api/demos 的期望规模（来自 styles/README.md 的 9 大类索引）。 */
export const EXPECT_STYLES = 43;
export const EXPECT_CATEGORIES = 9;

// ── 工具 ────────────────────────────────────────────────────
export function md5Of(buf) {
  return createHash('md5').update(buf).digest('hex');
}

/** 数 CR / LF 字节。★ 不用 grep $'\r'（Git Bash 下不可靠）。 */
export function countEol(buf) {
  let cr = 0;
  let lf = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 13) cr++;
    else if (buf[i] === 10) lf++;
  }
  return { cr, lf };
}

/**
 * 项目里的「源码」文件 —— .gitattributes 规定这些一律 LF。
 * 含 test/ 自己（测试代码也是源码，同样不许混进 CR）。
 */
export function sourceFiles(root) {
  const out = [];
  const SRC_RE = /\.(mjs|js|css|html|md)$/i;
  const add = (rel) => {
    const p = path.join(root, rel);
    try { if (fs.statSync(p).isFile()) out.push(rel); } catch { /* 不存在就跳过 */ }
  };
  for (const f of fs.readdirSync(root)) if (SRC_RE.test(f)) add(f);
  add('.gitattributes');
  add('.gitignore');
  for (const d of ['lib', 'web', 'test']) {
    let names = [];
    try { names = fs.readdirSync(path.join(root, d)); } catch { continue; }
    for (const f of names) if (SRC_RE.test(f)) add(path.join(d, f));
  }
  return [...new Set(out)].sort();
}

/**
 * 异步跑一个 node 子进程。
 * ★ 本环境 spawnSync 一律 EBUSY，只能用异步 spawn。
 */
export function runNode(args, { cwd, timeoutMs = 120000, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd, windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...env },
    });
    let stdout = '';
    let stderr = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error(`子进程超时（${timeoutMs}ms）：node ${args.join(' ')}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`));
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); reject(e); });
    child.on('close', (code, signal) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

/**
 * 扫「已渲染的 HTML」里有没有可执行的东西。
 * ★ 只看**真正的标签**（`<tag …>`），不看转义后的正文 —— 否则正文里写
 *   `&lt;img onerror=x&gt;`（已被转义成纯文本、完全无害）会假阳性。
 */
export function scanUnsafeHtml(html) {
  const problems = [];
  if (/<script\b/i.test(html)) problems.push('出现裸 <script>');
  if (/<iframe\b/i.test(html)) problems.push('出现裸 <iframe>');
  for (const tag of html.match(/<[a-zA-Z/][^>]*>/g) || []) {
    const on = /\son[a-z]+\s*=/i.exec(tag);
    if (on) problems.push(`标签里带事件属性 ${on[0].trim()}：${tag.slice(0, 80)}`);
    if (/javascript\s*:/i.test(tag)) problems.push(`标签里带 javascript: 伪协议：${tag.slice(0, 80)}`);
  }
  return problems;
}

// ── 测试产物登记（跑完统一清理；绝不碰真实锁 / 真实任务）─────
//
// ★ 为什么要有它：取消用例与「日志裁剪」用例必须在本进程里 import lib/jobs.mjs 起一个
//   独立队列 —— 那会往 D:\lemo-films\.console 写一条**真实格式**的任务记录。既然写了，
//   就必须登记下来、跑完摘干净，否则就成了「测试留垃圾」。
// ★ 锁文件用 `__test-lock__` 这种不可能与真实风格同名的 slug（风格目录是 lib/styles/<slug>），
//   且**只删自己登记过的那个路径** —— 绝不按通配符删锁（并发写 mux 会产出损坏成片）。
const FILM_DIR = CFG.exportDir;                 // D:\lemo-films（与编排器/服务端同一处常量）
const CONSOLE_ROOT = path.join(FILM_DIR, '.console');
const CONSOLE_LOGS = path.join(CONSOLE_ROOT, 'logs');
const CONSOLE_INDEX = path.join(CONSOLE_ROOT, 'index.json');

export const ARTIFACTS = {
  jobIds: new Set(),      // 测试任务 id（要删 logs/<id>.jsonl 并从 index.json 摘掉）
  lockFiles: new Set(),   // 测试造的锁文件绝对路径
  wslFiles: new Set(),    // WSL 侧的测试临时文件绝对路径
  dirs: new Set(),        // ★ 测试自建的输出目录（递归删）。见 cleanupArtifacts 里的两道守卫 ——
                          //   它是本项目唯一一处「递归删」，守卫不通过一律拒删并报错。
};

// ★ 测试自建目录的命名前缀。cleanupArtifacts 只认这个名字 —— 真实成片目录是
//   `D:\lemo-films\dub\<文案名>` 或用户 `--out` 给的任意名字，绝不会以 `_smoke-` 开头。
const TEST_DIR_PREFIX = '_smoke-';

// ★ 被测的 dub 入口。默认就是项目根下的 `dub.mjs`（**默认值不改任何行为**）。
//   存在的唯一理由：新用例的「故意破坏」验证 —— 要证明断言**真的能抓回归**，就得让被测入口
//   指向一份「手工改坏」的副本。dub.mjs 是**红线**（不许为了验证去改它，并发跑测试时改它
//   还会污染别人的结果），所以把「指向哪一份」做成一个只读的测试开关：
//     `LEMO_TEST_DUB=_mut-dub.mjs node test/smoke.mjs --full --filter ⑤++++++++`
//   副本自己放在项目根（相对 import `./lib/...` 才解析得到），验证完删掉 ⇒ git status 依然干净。
const DUB_ENTRY = process.env.LEMO_TEST_DUB || 'dub.mjs';

/**
 * 跑一段 WSL bash 脚本（本环境 spawnSync 一律 EBUSY，只能异步 spawn）。
 *
 * ★ 一律「写脚本文件 + sed 去 CR」再执行，**不走内联 bash** —— wsl.exe 会把命令行
 *   重新拼一遍再交给 Linux 侧解析，内联里的 `$变量` / 引号会被吃掉（lib/env.mjs 的
 *   注释里写着「内联会吃掉变量」，实测踩到：`$st` 变成空串，断言直接失去意义）。
 * ★ 默认超时给到 60s：这台机器上 WSL 发行版会因空闲被回收，下一次 wsl.exe 调用
 *   可能是**冷启动**（实测见过一次 sleep 3 的步骤 60s 才起来）。超时太短会把
 *   冷启动误判成「命令失败」。
 */
let wslSeq = 0;
export function wsl(script, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve) => {
    const uniq = `cg-wsl-${process.pid}-${Date.now().toString(36)}-${(wslSeq += 1).toString(36)}`;
    const host = path.join(CFG.tmpDir, `${uniq}.sh`);
    const inner = `/mnt/${host[0].toLowerCase()}${host.slice(2).replace(/\\/g, '/')}`;
    let child;
    try {
      fs.mkdirSync(CFG.tmpDir, { recursive: true });
      // 行尾归一成 LF —— CR 会让 bash 报 `$'\r': command not found`
      fs.writeFileSync(host, String(script).replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
    } catch (e) {
      return resolve({ ok: false, code: -1, out: '', err: `写 WSL 临时脚本失败：${e.message}` });
    }
    const cmd =
      `trap 'rm -f /tmp/${uniq}.sh "${inner}" 2>/dev/null' EXIT; `
      + `sed 's/\\r$//' '${inner}' > /tmp/${uniq}.sh && chmod 644 /tmp/${uniq}.sh && bash /tmp/${uniq}.sh`;
    try {
      child = spawn('wsl.exe', ['-d', CFG.wslDistro, '-u', 'root', '--', 'bash', '-c', cmd],
        { windowsHide: true, env: { ...process.env, WSL_UTF8: '1' } });
    } catch (e) {
      try { fs.unlinkSync(host); } catch { /* ignore */ }
      return resolve({ ok: false, code: -1, out: '', err: String(e.message || e) });
    }
    let out = '';
    let err = '';
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { fs.unlinkSync(host); } catch { /* 已经没了 */ }
      resolve(r);
    };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ ok: false, code: null, out, err, timeout: true }); }, timeoutMs);
    child.stdout?.on('data', (d) => { out += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { err += d.toString('utf8'); });
    child.on('error', (e) => finish({ ok: false, code: -1, out, err, error: String(e.message || e) }));
    child.on('close', (code) => finish({ ok: code === 0, code, out, err }));
  });
}

/** 找一个「确定已死」的 pid（spawn 一个空 node 进程 → 等它退出 → 复验）。 */
export async function freshDeadPid() {
  for (let i = 0; i < 5; i++) {
    const c = spawn(process.execPath, ['-e', 'process.exit(0)'], { windowsHide: true, stdio: 'ignore' });
    const pid = c.pid;
    await new Promise((r) => { c.on('close', r); c.on('error', r); });
    try { process.kill(pid, 0); } catch { return pid; }   // 抛错 = 确实不在了
  }
  return null;
}

// ── 配音锁「前置占用」检查（★ 与工具侧 core/tts/tts_indextts.py 的**过期接管**判据同源）──────────
//
// 背景：Index-TTS 的串行锁是**全局独占**的（编排器 / 控制台 / 手工跑共用一把）。工具侧
//   `acquire_lock()`（`tts_indextts.py:807`）在抢锁时有一条**过期接管**判据：
//       `if (same_host and not _pid_alive(owner)) or age > LOCK_STALE:`   ← 属主 pid 已死 **或** 锁龄超龄
//   满足即视为残留、清掉重抢。而本套件原先的前置检查**只判「文件在不在」** ⇒ **比工具更严**：
//   一次被中断的 TTS 留下的死锁（内容 `posix:<pid>`，宿主进程早已不在）会让 5 条现场 TTS 用例**假红**
//   （实测白跑了 3 次 `smoke --full`）。所以这里把工具那条判据**原样搬过来**：
//       · 属主已死 或 锁龄 > LOCK_STALE ⇒ 视为残留、**放行**（并打一行 ℹ）；
//       · 属主仍活着且锁龄 ≤ LOCK_STALE ⇒ 保持原行为，**拒绝**（`assert.fail`）。
//   ★ 绝不放宽「真占用就拒绝」的语义：查不动（WSL 起不来 / 解析不出属主）一律**保守拒绝** ——
//     宁可拒绝，也不放行一个可能真在跑的 TTS（放行会造成**并发跑 TTS**，实测把单句从 6 秒拖到 4~7 分钟）。
//
// 锁文件格式（`tts_indextts.py:770`）：`<宿主>:<pid>`（如 `posix:437`）；兼容旧格式「裸 pid」。
// ★ LOCK_STALE 与工具**同源同默认**：优先读 `INDEXTTS_LOCK_STALE`，缺省 21600s（= 6h，见 `tts_indextts.py:742`）。
const LOCK_STALE_SEC = Number(process.env.INDEXTTS_LOCK_STALE) > 0
  ? Number(process.env.INDEXTTS_LOCK_STALE)
  : 21600;

/**
 * 判断某 pid 在指定宿主上是否还活着。返回 true=活着 / false=确定已死 / null=判不出（保守）。
 * ★ 跨宿主：Windows 与 WSL 是**两套 pid 命名空间**，`posix:<pid>` 必须去 WSL 里 `kill -0` 才准
 *   （与 `tts_indextts.py:772` 的注释同因：拿 Windows 的 pid 去 Linux 里查必然查不到，会误判残留）。
 * ★ 与工具侧 `_pid_alive`（`tts_indextts.py:745`）同口径：判不出来一律不抢（这里返回 null，由调用方按「占用」处理）。
 */
async function pidAliveOn(hostKind, pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;      // 非法 pid ⇒ 未知
  if (hostKind === 'nt') {
    try { process.kill(pid, 0); return true; }
    catch (e) { return e && e.code === 'EPERM' ? true : false; }   // EPERM=存在但无权限 ⇒ 活着
  }
  if (hostKind === 'posix') {
    const r = await wsl(`if kill -0 ${pid} 2>/dev/null; then echo ALIVE; else echo DEAD; fi`);   // 用 wsl() 的默认 60s 超时：发行版空闲被回收后可能是**冷启动**
    if (!r.ok) return null;                                 // WSL 起不来 / 超时 ⇒ 未知 ⇒ 保守
    if (/\bALIVE\b/.test(r.out)) return true;
    if (/\bDEAD\b/.test(r.out)) return false;
    return null;
  }
  return null;
}

/**
 * 配音锁前置检查（放行 / 拒绝）。返回值：
 *   `{ ok:true }`                     锁不存在 ⇒ 放行
 *   `{ ok:true, takeover:true, note }` 属主已死 或 锁龄>LOCK_STALE ⇒ 视为残留，放行（调用方打 ℹ）
 *   `{ ok:false, message }`           真占用（属主活着且锁龄≤LOCK_STALE）/ 判不出 ⇒ 拒绝（调用方 assert.fail）
 *
 * @param {string} lockPath 锁文件绝对路径
 */
export async function checkIndexttsLock(lockPath) {
  if (!fs.existsSync(lockPath)) return { ok: true };

  let raw = '', ageSec = 0;
  try {
    raw = (fs.readFileSync(lockPath, 'utf8') || '').trim();
    ageSec = Date.now() / 1000 - fs.statSync(lockPath).mtimeMs / 1000;
  } catch { /* 读不到内容/时间 ⇒ 下面按「判不出」保守处理 */ }

  const fail = (why) => ({
    ok: false,
    message: `配音锁已被占用：${lockPath}（内容 "${raw || '?'}"）\n`
      + `  ${why}\n`
      + '  本机正在跑另一个配音任务（Index-TTS 全局串行）。这条用例要独占 Index-TTS，\n'
      + '  等它结束后再跑 --full —— 这是**环境占用**，不是被测代码坏了。\n'
      + '  若确认属主已死（残留锁），可删掉该锁文件重试。',
  });
  const takeover = (why) => ({
    ok: true, takeover: true, raw, ageSec,
    note: `接管了残留的配音锁（${lockPath}，内容 "${raw || '?'}"，${why}）—— 本次按「残留」放行。`,
  });

  // ── 判据一：锁龄 > LOCK_STALE ⇒ 残留（与 tts_indextts.py:807 的 `age > LOCK_STALE` 同源）──
  if (ageSec > LOCK_STALE_SEC) {
    return takeover(`锁龄 ${Math.round(ageSec)}s > LOCK_STALE ${LOCK_STALE_SEC}s`);
  }

  // ── 解析锁内容：`<宿主>:<pid>` / 裸 pid / 其它 ──
  const m = /^(nt|posix):(\d+)$/.exec(raw);
  let kind, pid;
  if (m) { kind = m[1]; pid = Number(m[2]); }
  else if (/^\d+$/.test(raw)) { kind = ''; pid = Number(raw); }   // 旧格式裸 pid（宿主未知）
  else {
    return fail(`锁内容解析不出属主 pid（"${raw || '?'}"）—— 无法判定它是否还在跑，保守按「占用」处理。`);
  }

  // ── 判据二：属主已死 ⇒ 残留（与 tts_indextts.py:807 的 `not _pid_alive(owner)` 同源）──
  let alive;
  if (kind === '') {
    // 裸 pid：宿主未知。工具侧按「同宿主尽力判」；本套件跨宿主，取**最保守**口径 ——
    // 两个宿主都确认已死才敢接管，任一「活着 / 判不出」都按占用。
    const nt = await pidAliveOn('nt', pid);
    const posix = await pidAliveOn('posix', pid);
    if (nt === false && posix === false) alive = false;
    else if (nt === true || posix === true) alive = true;
    else alive = null;
  } else {
    alive = await pidAliveOn(kind, pid);
  }

  if (alive === false) return takeover(`属主 ${kind ? `${kind}:` : ''}${pid} 已不在`);
  if (alive === null) return fail(`判不出属主 ${kind ? `${kind}:` : ''}${pid} 是否还活着（跨宿主查不动？）—— 保守按「占用」处理。`);
  return fail(`属主 ${kind}:${pid} 仍在运行`);
}

/**
 * 清理测试产物。**只动登记过的东西**。
 *
 * ★ 目录级清理（ARTIFACTS.dirs）是本文件唯一一处 `rm -rf`，所以加了两道**同时**成立的守卫：
 *     ① 路径必须位于已知的产物根之下（CFG.exportDir / CFG.tmpDir）；
 *     ② basename 必须以 `_smoke-` 开头（测试专用命名）。
 *   任一不满足 → **拒删**并把原因写进 errors（宁可留垃圾，也绝不误删用户的成片）。
 *   守卫不靠「调用方自觉」——就算未来有人往 ARTIFACTS.dirs 里塞了真实路径，这里也拦得住。
 *
 * @returns {{jobs:string[], locks:string[], wsl:string[], dirs:string[], errors:string[]}}
 */
export async function cleanupArtifacts() {
  const rep = { jobs: [], locks: [], wsl: [], dirs: [], errors: [] };

  for (const f of ARTIFACTS.lockFiles) {
    try { fs.unlinkSync(f); rep.locks.push(path.basename(f)); }
    catch (e) { if (e.code !== 'ENOENT') rep.errors.push(`删锁 ${f}：${e.message}`); }
  }
  ARTIFACTS.lockFiles.clear();

  if (ARTIFACTS.wslFiles.size) {
    const r = await wsl(`rm -f ${[...ARTIFACTS.wslFiles].join(' ')}`);
    if (!r.ok) rep.errors.push(`清 WSL 临时文件失败：${r.err || r.code}`);
    else rep.wsl.push(...[...ARTIFACTS.wslFiles]);
  }
  ARTIFACTS.wslFiles.clear();

  for (const d of ARTIFACTS.dirs) {
    const abs = path.resolve(d);
    const roots = [path.resolve(CFG.exportDir), path.resolve(CFG.tmpDir)];
    // 必须严格「在根**下面**」——根自身（abs === root）也拒掉
    const inRoot = roots.some((r) => abs.startsWith(r + path.sep));
    const named = path.basename(abs).startsWith(TEST_DIR_PREFIX);
    if (!inRoot || !named) {
      rep.errors.push(`拒删目录（守卫不通过）${abs}：inRoot=${inRoot} named=${named}`);
      continue;
    }
    try { fs.rmSync(abs, { recursive: true, force: true }); rep.dirs.push(abs); }
    catch (e) { rep.errors.push(`删目录 ${abs}：${e.message}`); }
  }
  ARTIFACTS.dirs.clear();

  if (ARTIFACTS.jobIds.size) {
    for (const id of ARTIFACTS.jobIds) {
      try { fs.unlinkSync(path.join(CONSOLE_LOGS, `${id}.jsonl`)); } catch { /* 没有就算了 */ }
    }
    try {
      const obj = JSON.parse(fs.readFileSync(CONSOLE_INDEX, 'utf8'));
      const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.jobs) ? obj.jobs : null);
      if (arr) {
        const kept = arr.filter((m) => m && !ARTIFACTS.jobIds.has(m.id));
        if (kept.length !== arr.length) {
          const out = Array.isArray(obj) ? kept : { ...obj, jobs: kept };
          const tmp = `${CONSOLE_INDEX}.cg-tmp`;
          fs.writeFileSync(tmp, JSON.stringify(out), 'utf8');
          fs.renameSync(tmp, CONSOLE_INDEX);   // 原子替换（与 lib/store.mjs 同一套做法）
        }
        rep.jobs.push(...ARTIFACTS.jobIds);
      }
    } catch (e) {
      rep.errors.push(`从 ${CONSOLE_INDEX} 摘除测试任务失败：${e.message}`);
    }
    ARTIFACTS.jobIds.clear();
  }
  return rep;
}

// ── 静态用例（不需要起服务）─────────────────────────────────
export const STATIC_CASES = [
  {
    name: '① 编排器 md5 未被改动（红线）',
    run: (ctx) => {
      const buf = fs.readFileSync(ctx.orchPath);
      const got = md5Of(buf);
      assert.ok(
        got === ORCH_MD5,
        `编排器被改动了 —— 控制台不应该修改它！\n  期望 md5 ${ORCH_MD5}\n  实际 md5 ${got}\n  文件 ${ctx.orchPath}（${buf.length} 字节）`,
      );
    },
  },
  {
    name: '② 源码行尾全为 LF（CR 计数 == 0）',
    run: (ctx) => {
      const files = sourceFiles(ctx.root);
      assert.ok(files.length >= 10, `扫到的源码文件太少（${files.length}），路径可能不对`);
      const bad = [];
      for (const rel of files) {
        const { cr, lf } = countEol(fs.readFileSync(path.join(ctx.root, rel)));
        if (cr !== 0) bad.push(`${rel}（CR=${cr} LF=${lf}）`);
      }
      assert.ok(
        bad.length === 0,
        `以下源码混进了 CR（.gitattributes 规定 eol=lf）：\n  ${bad.join('\n  ')}\n`
        + '  —— 行尾被 git 静默改写过？检查 .gitattributes / core.autocrlf。',
      );
      ctx.note(`② 已核验 ${files.length} 个源码文件全为 LF`);
    },
  },
  {
    name: '② 所有 .bat 均为 CRLF（不只 start-console.bat）',
    run: (ctx) => {
      // ★ 为什么要把「全部 .bat」升成断言而不是只记录：
      //   lemo-make.bat 曾是 LF（CR=0 LF=41），与 .gitattributes 的 *.bat eol=crlf 不符。
      //   cmd.exe 对 LF-only 批处理解析不可靠 —— 而它是 README 里写的入口。
      //   只断言一个文件 = 其它 .bat 失守时测试仍然全绿。
      const bats = fs.readdirSync(ctx.root).filter((f) => f.toLowerCase().endsWith('.bat'));
      assert.ok(bats.length > 0, '仓库里一个 .bat 都没有？');
      const bad = [];
      for (const f of bats) {
        const { cr, lf } = countEol(fs.readFileSync(path.join(ctx.root, f)));
        if (!(cr > 0 && cr === lf)) bad.push(`${f}(CR=${cr} LF=${lf})`);
      }
      assert.strictEqual(bad.length, 0,
        `.bat 行尾不是纯 CRLF：${bad.join(' / ')} —— cmd.exe 对 LF-only 批处理解析不可靠`);
      ctx.note(`② 已核验 ${bats.length} 个 .bat 全为 CRLF：${bats.join(', ')}`);
    },
  },
  {
    name: '② .gitattributes 行尾规则在位',
    run: (ctx) => {
      const src = fs.readFileSync(path.join(ctx.root, '.gitattributes'), 'utf8');
      assert.match(src, /^\*\s+text=auto\s+eol=lf\s*$/m, '.gitattributes 缺「* text=auto eol=lf」—— 源码默认行尾失守');
      assert.match(src, /^\*\.bat\s+text\s+eol=crlf\s*$/m, '.gitattributes 缺「*.bat text eol=crlf」—— 批处理行尾失守');
    },
  },
  {
    name: '③ markdown 渲染器对注入内容做了转义（单测）',
    run: async (ctx) => {
      const { renderMarkdown } = await import('../lib/styles.mjs');
      const hostile = [
        '# 标题',
        '',
        '<script>alert(1)</script>',
        '',
        '<img src=x onerror="alert(2)">',
        '',
        '[点我](javascript:alert(3))',
        '',
        '| a | b |',
        '|---|---|',
        '| <svg onload=alert(4)> | x |',
      ].join('\n');
      const html = renderMarkdown(hostile);
      const problems = scanUnsafeHtml(html);
      assert.ok(problems.length === 0, `渲染结果里出现了可执行内容：\n  ${problems.join('\n  ')}`);
      assert.match(html, /&lt;script&gt;/, '原文里的 <script> 没有被转义成 &lt;script&gt;');
      assert.doesNotMatch(html, /href="javascript:/i, 'javascript: 伪协议链接没有被降级');
    },
  },
  {
    name: '⑤ CLI dry-run 仍 exit 0（包装层没破坏命令行用法）',
    run: async (ctx) => {
      const r = await runNode(['lemo-make.mjs', 'ascii-crt', '--skip-sync', '--dry-run'], { cwd: ctx.root, timeoutMs: 120000 });
      assert.strictEqual(
        r.code, 0,
        `CLI 退出码 ${r.code}（期望 0）\n--- stdout ---\n${r.stdout}\n--- stderr ---\n${r.stderr}`,
      );
      ctx.state.cliDryRun = r;
    },
  },
  {
    name: '⑤ CLI dry-run 打印步骤标记 [1]',
    run: (ctx) => {
      const r = ctx.state.cliDryRun;
      assert.ok(r, '依赖上一条 CLI 用例的输出，但上一条没跑成');
      assert.match(r.stdout, /\[1\]/, `CLI 输出里找不到步骤标记 [1]\n--- stdout ---\n${r.stdout}`);
    },
  },
  {
    // ★ 这条补的是 test/README.md「没覆盖什么」里的最后一条：Windows 保留端口的 EACCES 后扫。
    //   真造一个保留段要改系统配置（netsh 圈端口），测试没法复现 —— 所以把「绑定一次」作为
    //   参数注入，用假 binder 精确覆盖四条分支。server.mjs 的 start() 就是调这个函数，
    //   而「服务真的能起来」由本套件其余所有起服务用例覆盖（它们都走 start() → scanPort）。
    name: '③ 端口后扫决策：只有 EACCES 才继续往后扫（EADDRINUSE / 其它错误直接放弃）',
    run: async (ctx) => {
      const { scanPort, MAX_SCAN, MAX_PORT } = await import('../lib/portscan.mjs');
      // 常量必须与 server.mjs 的实际行为一致（server.mjs 从这里 import，单一来源）
      assert.strictEqual(MAX_SCAN, 40, `MAX_SCAN=${MAX_SCAN}，与 server.mjs 既有行为（40）不一致`);
      assert.strictEqual(MAX_PORT, 65535, `MAX_PORT=${MAX_PORT}`);

      const fakeBinder = (map) => {
        const calls = [];
        return { calls, fn: async (port) => { calls.push(port); return map(port); } };
      };

      // ① 一绑就上：不该多试任何一个端口
      {
        const b = fakeBinder(() => ({ ok: true }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: true, port: 7788, want: 7788, moved: false });
        assert.deepStrictEqual(b.calls, [7788], `不该多试端口，实际试了 ${b.calls.join(',')}`);
      }

      // ② ★核心：EACCES（端口落在保留段）→ 按顺序向后扫到第一个可绑的端口
      {
        const reserved = new Set([7788, 7789, 7790]);
        const b = fakeBinder((p) => (reserved.has(p) ? { ok: false, code: 'EACCES' } : { ok: true }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: true, port: 7791, want: 7788, moved: true });
        assert.deepStrictEqual(b.calls, [7788, 7789, 7790, 7791], '没有按顺序逐个向后扫');
      }

      // ③ EADDRINUSE → **不换端口**（换端口会静默起第二个实例），直接报 inuse
      {
        const b = fakeBinder((p) => (p === 7788 ? { ok: false, code: 'EADDRINUSE' } : { ok: true }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: false, reason: 'inuse', want: 7788, port: 7788 });
        assert.deepStrictEqual(b.calls, [7788], 'EADDRINUSE 不该继续向后扫');
      }

      // ④ 其它绑定错误（如 EADDRNOTAVAIL）→ 同样不换端口
      {
        const b = fakeBinder(() => ({ ok: false, code: 'EADDRNOTAVAIL' }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: false, reason: 'error', want: 7788, port: 7788, code: 'EADDRNOTAVAIL' });
        assert.deepStrictEqual(b.calls, [7788], '非 EACCES 错误不该继续向后扫');
      }

      // ⑤ 整段都是保留段 → 扫满 MAX_SCAN 个后放弃（含 want 本身共 MAX_SCAN+1 次尝试）
      {
        const b = fakeBinder(() => ({ ok: false, code: 'EACCES' }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: false, reason: 'exhausted', want: 7788 });
        assert.strictEqual(b.calls.length, MAX_SCAN + 1,
          `应尝试 ${MAX_SCAN + 1} 个端口（含 want 本身），实际 ${b.calls.length}`);
        assert.strictEqual(b.calls[0], 7788);
        assert.strictEqual(b.calls[b.calls.length - 1], 7788 + MAX_SCAN);
      }

      // ⑥ 逼近端口上限 → 越过 65535 立即放弃（与 server.mjs 原来的 `if (port > 65535) break` 等价）
      {
        const b = fakeBinder(() => ({ ok: false, code: 'EACCES' }));
        const r = await scanPort(65534, b.fn);
        assert.deepStrictEqual(r, { ok: false, reason: 'exhausted', want: 65534 });
        assert.deepStrictEqual(b.calls, [65534, 65535], '越过 65535 之后不该再试');
      }

      ctx.note('③ 端口后扫：一绑就上 / EACCES 后扫 / EADDRINUSE 不换 / 其它错误不换 / 扫满放弃 / 越过 65535 放弃'
        + ' —— 六条分支全过（用假 binder，不碰系统保留段）');
    },
  },
  {
    name: '③+ 两条「根」已收敛到唯一真相来源（成片根 / 风格源码根）',
    run: async (ctx) => {
      // ★ 钉住本次收敛：① 成片根的唯一口径 = lib/env.mjs 的 CFG.exportDir（认 LEMO_FILM_DIR）；
      //   ② 风格源码根的唯一口径 = lib/styles-root.mjs 的 resolveStylesRoot(winLib)（认 LEMO_STYLES_ROOT）。
      //   判据分四层：派生关系 / 默认值逐字节等价 / 覆盖点真的跟随 / 应用运行时+运维脚本里无残留字面量。
      const { resolveStylesRoot } = await import('../lib/styles-root.mjs');
      const dc = await import('../lib/dub-core.mjs');

      // ① 派生关系：dub-core 的 outRoot 必须**派生**自 CFG.exportDir（不再是第二份字面量）
      assert.strictEqual(
        dc.CFG.outRoot, path.join(CFG.exportDir, 'dub'),
        `lib/dub-core.mjs 的 CFG.outRoot 没有从 CFG.exportDir 派生：`
        + ` outRoot=${dc.CFG.outRoot}，期望 ${path.join(CFG.exportDir, 'dub')}`,
      );

      // ② 不设覆盖点 ⇒ 与旧硬编码字面量**逐字节相同**（生产零行为变化）
      if (!process.env.LEMO_FILM_DIR) {
        assert.strictEqual(CFG.exportDir, 'D:\\lemo-films', 'CFG.exportDir 的默认值被改了');
        assert.strictEqual(dc.CFG.outRoot, 'D:\\lemo-films\\dub', 'dub-core 的 outRoot 默认值被改了');
      }
      if (!process.env.LEMO_STYLES_ROOT) {
        assert.strictEqual(
          resolveStylesRoot(CFG.winLib), path.join(CFG.winLib, 'styles'),
          '不设 LEMO_STYLES_ROOT 时 resolveStylesRoot 不等于 path.join(winLib,"styles")',
        );
      }

      // ③ 覆盖点必须真的让「风格源码根」跟着走（纯函数，读的是**调用时**的 env）
      const prevStyles = process.env.LEMO_STYLES_ROOT;
      const probeRoot = 'D:/lemo-tmp/__styles_probe__';
      try {
        process.env.LEMO_STYLES_ROOT = probeRoot;
        assert.strictEqual(
          resolveStylesRoot(CFG.winLib), path.resolve(probeRoot),
          '设了 LEMO_STYLES_ROOT 后 resolveStylesRoot 没跟着走',
        );
      } finally {
        if (prevStyles === undefined) delete process.env.LEMO_STYLES_ROOT;
        else process.env.LEMO_STYLES_ROOT = prevStyles;
      }

      // ④ 应用运行时（lib/dub-core.mjs / server.mjs / consistency-check.mjs）与运维脚本
      //    （style-distill / unblock-placeholder-audio / fix-truepeak / patch-style-mux /
      //      style-skill-check）里**不许再有**这两条根的独立字面量 ——
      //    只许经 CFG.exportDir / CFG.winLib / resolveStylesRoot 取。（注释行不算。）
      const stripComments = (src) => src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ''))
        .join('\n');
      const BANNED = {
        'lib/dub-core.mjs': [/lemo-films/],
        'server.mjs': [/winLib,\s*['"]styles['"]/],
        'consistency-check.mjs': [/lemo-films/],
        'scripts/style-distill.mjs': [/lemo-films/, /lemo-opuscar/],
        'scripts/unblock-placeholder-audio.mjs': [/lemo-films/, /lemo-opuscar/],
        'scripts/fix-truepeak.mjs': [/lemo-films/],
        // ★ b83-c2 新增收敛：这两个脚本原先各有一处库根 / 风格源码根字面量
        'scripts/patch-style-mux.mjs': [/lemo-films/, /lemo-opuscar/],
        'scripts/style-skill-check.mjs': [/lemo-films/, /lemo-opuscar/],
      };
      const bad = [];
      for (const [rel, pats] of Object.entries(BANNED)) {
        const code = stripComments(fs.readFileSync(path.join(ctx.root, rel), 'utf8'));
        for (const p of pats) if (p.test(code)) bad.push(`${rel} 仍含硬编码 ${p}`);
      }
      assert.strictEqual(
        bad.length, 0,
        `以下文件仍留着两条「根」的独立硬编码（应收敛到 CFG.exportDir / resolveStylesRoot）：\n  ${bad.join('\n  ')}`,
      );

      // ⑤ 闸门/脚本的 `LEMO_*` 覆盖点必须**真的存在** —— 只有覆盖点存在，才能用临时树做
      //    非破坏性变异验证（不设覆盖点时必须逐字节等价于旧字面量默认值，见 ② 与 b83-c2 报告）。
      //    ★ 注意：`scripts/check-shell-structure.mjs` 是**闸门**，按纪律**允许保留**字面量默认值
      //      （不 import 被检代码 ⇒ 避免环 + 自证），故这里只钉「覆盖点存在」，不钉「无字面量」。
      //    ★★ 2026-10-07：**全仓口径**已由 `scripts/check-env-overrides.mjs`（覆盖点登记表 + **双向**守卫）
      //      接管 —— 它扫 `lib/**` + `scripts/**` + 仓根 `*.mjs`，登记 47 条（覆盖点 36 + 非覆盖点 11）/
      //      100 个「(覆盖点, 读者文件)」对，**未登记 ⇒ FAIL**、**登记点被删/改名 ⇒ FAIL**。
      //      下面这张表**刻意保留**：它是**这一批具体文件**的窄口径回归（在本套件里跑，不依赖另一个闸门
      //      是否被执行），与那张全仓登记表**同源不矛盾** —— 实测这 9 个「(文件, 变量)」对
      //      **逐对都在** `check-env-overrides.mjs` 的 `OVERRIDES` 里（改任一侧都要同步看另一侧）。
      //      ★ 没有把这张表**收敛进**那个闸门：那要求闸门把登记表 `export` 出来、并给主流程加
      //      「被 import 时不执行」的守卫（本项目所有闸门都是**独立脚本**、不是模块）⇒ 新耦合 + 风险，
      //      收益只是少一份 4 行的表；故选择「保留 + 交叉注释」。
      const OVERRIDES = {
        'scripts/check-shell-structure.mjs': ['LEMO_OPUSCAR', 'LEMO_TOOLS_ROOT', 'LEMO_WSL_ROOT', 'LEMO_WSL_DISTRO'],
        'scripts/patch-style-mux.mjs': ['LEMO_OPUSCAR', 'LEMO_WSL_ROOT', 'LEMO_WSL_DISTRO'],
        'scripts/unblock-placeholder-audio.mjs': ['LEMO_STYLES_ROOT_WSL'],
        // ★ 2026-10-07 扩到 `lib/`：`LEMO_VOICE_TEST_TMP` 是**应用目录**（`D:\WSL\voicetest`）的覆盖点 ——
        //   该目录由 `server.mjs` 的 `/api/voices/test` 真写盘、且测试会对其做 before/after 差集并删「新增项」，
        //   所以它**必须**留一个口子给夹具/并发隔离；本表就是「这个口子不许被悄悄删掉」的守卫。
        'lib/voices.mjs': ['LEMO_VOICE_TEST_TMP'],
      };
      const missing = [];
      for (const [rel, vars] of Object.entries(OVERRIDES)) {
        const code = fs.readFileSync(path.join(ctx.root, rel), 'utf8');
        for (const v of vars) if (!code.includes(`process.env.${v}`)) missing.push(`${rel} 缺覆盖点 ${v}`);
      }
      assert.strictEqual(
        missing.length, 0,
        `以下覆盖点缺失（无法用临时树做非破坏变异验证）：\n  ${missing.join('\n  ')}`,
      );

      ctx.note('③+ 两条根已收敛：dub-core.outRoot 派生自 exportDir；server / consistency-check / '
        + 'style-distill / unblock-placeholder-audio / fix-truepeak / patch-style-mux / style-skill-check '
        + '去注释后无残留字面量；check-shell-structure 与 unblock 的 WSL 侧覆盖点齐备'
        + '；★ 2026-10-07：覆盖点守卫**扩到 lib/** —— `lib/voices.mjs` 的 `LEMO_VOICE_TEST_TMP` '
        + '（它是应用目录 D:/WSL/voicetest 的**唯一**口子：那个目录由 server 的 /api/voices/test 真写盘、'
        + '而测试会对它做 before/after 差集并删「新增项」⇒ 没有口子就没法在夹具树/并发下隔离）');
    },
  },
];

// ── 服务端用例（需要控制台在跑）─────────────────────────────
export const SERVER_CASES = [
  {
    name: '③ GET / → 200 HTML',
    run: async (ctx) => {
      const r = await ctx.get('/');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      assert.match(String(r.headers['content-type'] || ''), /text\/html/i, `Content-Type=${r.headers['content-type']}`);
      assert.match(r.text, /<!DOCTYPE html>/i, '根路径返回的不是 HTML 文档');
    },
  },
  {
    name: '③ GET /api/env → 200 且 summary.total / runnable 存在',
    run: async (ctx) => {
      const r = await ctx.get('/api/env', { timeoutMs: 180000 });
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      const d = r.json;
      assert.ok(d && typeof d === 'object', '返回不是 JSON 对象');
      assert.strictEqual(typeof d.summary?.total, 'number', `summary.total 不是数字：${JSON.stringify(d.summary)}`);
      assert.strictEqual(typeof d.runnable, 'boolean', `runnable 不是布尔：${JSON.stringify(d.runnable)}`);
      assert.ok(Array.isArray(d.groups) && d.groups.length > 0, 'groups 为空');
    },
  },
  {
    name: `③ GET /api/demos → ${EXPECT_STYLES} 风格 / ${EXPECT_CATEGORIES} 分类 / 0 未归类`,
    run: async (ctx) => {
      const r = await ctx.get('/api/demos');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      const d = r.json;
      assert.ok(Array.isArray(d.styles), 'styles 不是数组');
      assert.strictEqual(d.styles.length, EXPECT_STYLES, `风格数 ${d.styles.length}（期望 ${EXPECT_STYLES}）`);
      assert.strictEqual(d.count, d.styles.length, `count(${d.count}) 与 styles.length(${d.styles.length}) 不一致`);
      assert.ok(Array.isArray(d.categories), 'categories 不是数组');
      assert.strictEqual(d.categories.length, EXPECT_CATEGORIES, `分类数 ${d.categories.length}（期望 ${EXPECT_CATEGORIES}）—— README 索引解析降级了？`);
      assert.strictEqual(d.categorized, true, 'categorized=false —— 索引解析降级成扁平列表了');
      const uncat = d.styles.filter((s) => !s.category).map((s) => s.slug);
      assert.deepStrictEqual(uncat, [], `有 ${uncat.length} 个风格未归类：${uncat.join(', ')}`);
    },
  },
  {
    name: '③ GET /api/films → 200 且有 films 数组',
    run: async (ctx) => {
      const r = await ctx.get('/api/films');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      assert.ok(Array.isArray(r.json.films), `films 不是数组：${r.text.slice(0, 200)}`);
    },
  },
  {
    name: '③ GET /api/jobs → 200 且有 jobs 数组',
    run: async (ctx) => {
      const r = await ctx.get('/api/jobs');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      assert.ok(Array.isArray(r.json.jobs), `jobs 不是数组：${r.text.slice(0, 200)}`);
      assert.ok(r.json.queue && typeof r.json.queue === 'object', 'queue 快照缺失');
    },
  },
  {
    name: '③ GET /api/console → 200 且 store.ready === true',
    run: async (ctx) => {
      const r = await ctx.get('/api/console');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      assert.strictEqual(r.json.store?.ready, true, `历史落盘不可用：${JSON.stringify(r.json.store)}`);
    },
  },
  {
    name: '③ GET /api/style/ascii-crt → 200 且无裸 <script> / on* 属性',
    run: async (ctx) => {
      const r = await ctx.get('/api/style/ascii-crt');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      const d = r.json;
      assert.strictEqual(d.hasStyle, true, 'ascii-crt 没有 STYLE.md');
      assert.ok(typeof d.styleHtml === 'string' && d.styleHtml.length > 0, 'styleHtml 为空');
      const problems = scanUnsafeHtml(d.styleHtml + '\n' + d.demoHtml);
      assert.ok(problems.length === 0, `服务端渲染结果里出现可执行内容：\n  ${problems.join('\n  ')}`);
    },
  },
  {
    name: '③ GET /api/precheck?slug=ascii-crt → 200 且含 locked/stale/alive',
    run: async (ctx) => {
      const r = await ctx.get('/api/precheck?slug=ascii-crt');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      for (const k of ['locked', 'stale', 'alive']) {
        assert.strictEqual(typeof r.json[k], 'boolean', `字段 ${k} 不是布尔：${JSON.stringify(r.json)}`);
      }
      assert.ok(!(r.json.locked && r.json.stale), 'locked 与 stale 同时为 true —— 判据自相矛盾');
    },
  },
  {
    name: '③ 未知接口 → 404',
    run: async (ctx) => {
      const r = await ctx.get('/api/definitely-not-a-route');
      assert.strictEqual(r.status, 404, `状态码 ${r.status}（期望 404）`);
    },
  },
  {
    name: '③ 非法 slug → 400（注入防护）',
    run: async (ctx) => {
      const r = await ctx.post('/api/run', { slug: '../etc/passwd', opts: [] });
      assert.strictEqual(r.status, 400, `状态码 ${r.status}（期望 400）body=${r.text.slice(0, 200)}`);
      const r2 = await ctx.post('/api/run', { slug: 'ascii-crt', opts: ['--out; rm -rf /'] });
      assert.strictEqual(r2.status, 400, `opts 里的非法字符没被拦下：${r2.status} ${r2.text.slice(0, 200)}`);
    },
  },
  {
    name: '③ 目录穿越不会泄漏项目文件',
    run: async (ctx) => {
      // server.mjs 的特征串：响应里只要出现它们，就说明源码被读出去了
      const LEAK_MARKS = ['lemo-tools 本地 Web 控制台', 'sendJson', 'const server = http.createServer'];
      for (const p of ['/api/style/..%2F..%2Fserver.mjs', '/../server.mjs', '/..%2Fserver.mjs', '/api/style/....//....//server.mjs']) {
        const r = await ctx.get(p);
        assert.ok([400, 403, 404].includes(r.status), `${p} → 状态码 ${r.status}（期望 400/403/404）`);
        for (const m of LEAK_MARKS) {
          assert.ok(!r.text.includes(m), `${p} 的响应里泄漏了 server.mjs 内容（命中 "${m}"）：${r.text.slice(0, 160)}`);
        }
      }
      // 对照：web/ 下的真实文件必须正常返回 —— 否则上面那几条「不是 200」可能只是静态服务整体坏了
      const ok = await ctx.get('/app.js');
      assert.strictEqual(ok.status, 200, `web/app.js 取不到（${ok.status}）—— 静态服务本身有问题`);
      assert.match(String(ok.headers['content-type'] || ''), /javascript/i, `app.js 的 Content-Type=${ok.headers['content-type']}`);
    },
  },

  // ── ③+ 输出尺寸 / 语言版本 / 影片构图能力（本批新增的三条**只读**接口）──
  //
  // ★ 这三条接口此前**一条用例都没有**（全项目 test/ 下搜不到 langs / sizes / aspects）。
  //   它们都是纯只读：只 import 库侧注册表 / 只扫 demo 目录 / 只读影片源码文本，不写库、不写工单。
  //   期望值一律**独立算**（按磁盘内容文件、按长边 1920 的换算公式），不 import lib/sizes.mjs 抄输出。
  {
    name: '③ GET /api/sizes → 200 · defaultRatio=9:16 · 比例像素与库换算一致',
    run: async (ctx) => {
      const r = await ctx.get('/api/sizes');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      const d = r.json;
      assert.ok(d && typeof d === 'object' && !Array.isArray(d), '返回不是 JSON 对象');

      // 默认比例必须是 9:16（用户要求：任务没指定尺寸时按 9:16 导出）
      assert.strictEqual(d.defaultRatio, '9:16', `defaultRatio=${JSON.stringify(d.defaultRatio)}（期望 9:16）`);
      assert.ok(Array.isArray(d.ratios), 'ratios 不是数组');

      // ★ 期望值**独立算**：不 import lib/sizes.mjs，直接按库侧 core/render/size.mjs 文件头的推导
      //   （长边 = 1920、s = 1920 / max(a,b)、就近取偶数）手算成一张表，再跟接口逐个比。
      const EXPECT = {
        '9:16': [1080, 1920], '16:9': [1920, 1080], '3:4': [1440, 1920], '4:3': [1920, 1440], '1:1': [1920, 1920],
      };
      assert.deepStrictEqual(d.ratios.map((x) => x.id), Object.keys(EXPECT),
        `比例清单与顺序不对：${JSON.stringify(d.ratios.map((x) => x.id))}`);
      assert.strictEqual(d.ratios[0].id, '9:16', `第一条不是 9:16（第一条即默认项）：${d.ratios[0]?.id}`);
      for (const rt of d.ratios) {
        const [w, h] = EXPECT[rt.id];
        assert.strictEqual(rt.w, w, `${rt.id} 的宽 ${rt.w}（期望 ${w}）`);
        assert.strictEqual(rt.h, h, `${rt.id} 的高 ${rt.h}（期望 ${h}）`);
        assert.strictEqual(rt.pixels, `${w}x${h}`, `${rt.id} 的 pixels=${rt.pixels}（期望 ${w}x${h}）`);
        assert.ok(typeof rt.label === 'string' && rt.label.length > 0, `${rt.id} 的 label 为空`);
      }

      // 自定义像素的合法范围（与库侧 size.mjs 的校验一致）：偶数、MIN_SIZE–MAX_SIZE。
      // ★ 下限 96 **独立手算**，不从 lib/sizes.mjs 读 —— 测试就是要抓「库里改了值而这里没跟上」。
      //   推导：S = min(W/1920, H/1080) 是影片的统一缩放；圆窗内圈半径 = RR·S − max(3.5, …) 必须 ≥ 0，
      //   故 RR·S ≥ 3.5。film_coffee RR=84 ⇒ S ≥ 0.0416667 ⇒ W ≥ 80（实测 80 起正常、72 崩）；
      //   film.js RR=120 ⇒ S ≥ 0.0291667 ⇒ W ≥ 56（实测 56 起正常、48 崩）。取大者 80 + 20% 余量 = 96。
      assert.deepStrictEqual(d.custom, { min: 96, max: 8192, even: true, example: '1080x1920' },
        `custom 约束不对：${JSON.stringify(d.custom)}`);
      // 读到了库就不该有降级错误；source 指向库侧 size.mjs
      assert.strictEqual(d.error, null, `读库失败降级了：${d.error}`);
      assert.match(String(d.source || ''), /size\.mjs$/i, `source 不是库侧 size.mjs：${d.source}`);
      ctx.note('③ /api/sizes：defaultRatio=9:16、5 个比例像素与独立推导一致、custom=96–8192 偶数');
    },
  },
  {
    name: '③ GET /api/langs → 400（缺/非法 slug）· 按磁盘内容文件判可用语言',
    run: async (ctx) => {
      // 错误路径：缺 slug / 不在白名单 → 400
      const noSlug = await ctx.get('/api/langs');
      assert.strictEqual(noSlug.status, 400, `缺 slug 应 400，实际 ${noSlug.status}`);
      const badSlug = await ctx.get('/api/langs?slug=not-a-style');
      assert.strictEqual(badSlug.status, 400, `非法 slug 应 400，实际 ${badSlug.status}`);

      // ★ 期望值**独立算**：直接读 demo 目录的 content*.json，按编排器 --lang 的换名规则
      //   （content=X.json → X.<code>.json ⇒ 有 content*.<code>.json 才算有这个语言版本）推。
      const REGISTRY = ['en', 'zh'];   // 库侧 core/lang/lang.mjs 的 LANGS 键（en 永远可用 = 无后缀的 content.json）
      const diskExpect = (slug) => {
        const demoDir = path.join(CFG.winLib, 'styles', slug, 'demo');
        const files = fs.readdirSync(demoDir).filter((f) => /^content.*\.json$/i.test(f)).sort();
        const avail = REGISTRY.filter((c) => c === 'en'
          || files.some((f) => f.toLowerCase().endsWith(`.${c.toLowerCase()}.json`)));
        return { files, avail };
      };

      for (const slug of ['engraving', 'hologram-hud', 'midcentury-toon', 'silkscreen-poster']) {
        const exp = diskExpect(slug);
        const r = await ctx.get(`/api/langs?slug=${slug}`);
        assert.strictEqual(r.status, 200, `${slug} 状态码 ${r.status}：${r.text.slice(0, 200)}`);
        const d = r.json;
        assert.strictEqual(d.slug, slug, `回显 slug 不对：${d.slug}`);
        assert.strictEqual(d.defaultLang, 'en', `defaultLang=${d.defaultLang}（期望 en）`);
        assert.ok(typeof d.styleCn === 'string' && d.styleCn.length > 0, `${slug} 的 styleCn 为空`);
        assert.ok(typeof d.registrySource === 'string' && /lang\.mjs$/i.test(d.registrySource),
          `registrySource 不是库侧 lang.mjs：${d.registrySource}`);
        assert.strictEqual(d.registryError, null, `读库失败降级了：${d.registryError}`);
        // 可出片的语言版本（与磁盘内容文件推导逐字一致）
        assert.deepStrictEqual(d.codes, exp.avail,
          `${slug} 的 codes=${JSON.stringify(d.codes)}（磁盘推导 ${JSON.stringify(exp.avail)}）`);
        assert.deepStrictEqual(d.contentFiles, exp.files, `${slug} 的 contentFiles 与磁盘不一致`);
        assert.ok(exp.avail.includes(d.default), `${slug} 的 default=${d.default} 不在 codes 里`);
        // 界面偏好：有 zh 就默认 zh，否则默认 en（lib/langs.mjs 的 PREFERRED_LANG）
        assert.strictEqual(d.default, exp.avail.includes('zh') ? 'zh' : 'en',
          `${slug} 的 default=${d.default}（该风格有 zh=${exp.avail.includes('zh')}）`);
        // 逐条结构
        assert.strictEqual(d.langs.length, exp.avail.length, `${slug} langs 条数不对`);
        for (const L of d.langs) {
          assert.strictEqual(L.available, true, `${slug}/${L.code} 的 available 应为 true`);
          assert.ok(typeof L.code === 'string' && L.code, `${slug} 有条目缺 code`);
          assert.ok(typeof L.label === 'string' && L.label.length > 0, `${slug}/${L.code} 缺 label`);
          assert.ok(typeof L.name === 'string', `${slug}/${L.code} 缺 name`);
          assert.ok(typeof L.labelPrefix === 'string', `${slug}/${L.code} 缺 labelPrefix`);
          assert.ok(L.tts === null || typeof L.tts === 'object', `${slug}/${L.code} 的 tts 类型不对`);
          assert.ok(Array.isArray(L.files) && L.files.length > 0, `${slug}/${L.code} 的 files 应为非空数组`);
        }
        // 注册表里有、但这个风格还没有内容文件 → 归到 unavailable
        assert.deepStrictEqual(d.unavailable.map((u) => u.code), REGISTRY.filter((c) => !exp.avail.includes(c)),
          `${slug} 的 unavailable 不对：${JSON.stringify(d.unavailable.map((u) => u.code))}`);
        for (const u of d.unavailable) {
          assert.strictEqual(u.available, false, `${slug}/${u.code} 的 unavailable.available 应为 false`);
          assert.deepStrictEqual(u.files, [], `${slug}/${u.code} 的 unavailable 不该带 files`);
        }
      }

      // 配音引擎字段要真的透传出来：zh 走本机 Index-TTS（库侧 LANGS.zh.tts.engine='indextts'）
      const zh = (await ctx.get('/api/langs?slug=engraving')).json.langs.find((l) => l.code === 'zh');
      assert.ok(zh, 'engraving 应有 zh 语言版本（content_coffee.zh.json）');
      assert.strictEqual(zh.tts && zh.tts.engine, 'indextts',
        `zh 的 tts.engine=${JSON.stringify(zh.tts && zh.tts.engine)}（期望 indextts）`);
      ctx.note('③ /api/langs：4 个白名单风格逐个与磁盘内容文件核对；zh 的 tts.engine=indextts');
    },
  },
  {
    name: '③ GET /api/aspects → 400（缺 slug）· 声明 5 比例 / 未声明只支持 16:9',
    run: async (ctx) => {
      const noSlug = await ctx.get('/api/aspects');
      assert.strictEqual(noSlug.status, 400, `缺 slug 应 400，实际 ${noSlug.status}`);

      // engraving 的两部影片都声明了全 5 个比例（读源码文本探测，不是 import 求值）
      const eng = await ctx.get('/api/aspects?slug=engraving');
      assert.strictEqual(eng.status, 200, `状态码 ${eng.status}`);
      const e = eng.json;
      assert.strictEqual(e.mode, 'style', `mode=${e.mode}（期望 style）`);
      assert.strictEqual(e.probe, 'text', `probe=${e.probe}（期望 text —— 影片是浏览器 ESM，只能读文本）`);
      assert.strictEqual(e.declared, true, 'engraving 应探测到 aspects 声明');
      assert.deepStrictEqual(e.supported, ['9:16', '16:9', '3:4', '4:3', '1:1'],
        `supported=${JSON.stringify(e.supported)}（期望库侧 RATIOS 顺序的全 5 项）`);
      assert.deepStrictEqual(e.default, ['16:9'], `default=${JSON.stringify(e.default)}（期望 ['16:9']）`);
      assert.ok(Array.isArray(e.films) && e.films.length >= 1, 'films 应为非空数组');
      assert.ok(typeof e.source === 'string' && e.source.endsWith('.js'), `source=${e.source}`);
      assert.strictEqual(e.error, null, `探测报错：${e.error}`);
      assert.ok(typeof e.note === 'string' && e.note.includes('aspects'), `note 没说明判据：${e.note}`);

      // ★★ 交叉核验：接口说「支持多比例」，**源码事实**必须真的支持。
      //   为什么值得单加一段：aspects 是编排器与 UI 判断「这个尺寸会不会被裁切」的**唯一依据**，
      //   而它本身是**读源码文本**探测的（影片模块是浏览器 ESM，node 不能 import）。
      //   一旦探测与事实脱节，两边会一起错得很安静 —— 所以拿一个**独立事实**来对照：
      //   自适应改造的标志是影片模块导出 `NATIVE` 并把版面搬进 layout(W,H)。
      //   这里直接读源文件，**不经过 lib/aspects.mjs**（那正是被测对象，不能拿它自证）。
      const _fs = await import('node:fs');
      const _path = await import('node:path');
      const engDemo = _path.join(CFG.winLib, 'styles', 'engraving', 'demo');
      for (const f of ['film', 'film_coffee']) {
        const src = _fs.readFileSync(_path.join(engDemo, `${f}.js`), 'utf8');
        assert.ok(/export\s+const\s+NATIVE\b/.test(src),
          `${f}.js 源码里没有 export const NATIVE（自适应标志），但接口说 engraving 支持 5 个比例 —— 探测与事实脱节`);
      }
      // 反向：被判「只支持 16:9」的风格，源码里就不该有自适应改造的标志，否则上面那条断言自相矛盾。
      //   ★ 反向样本已换（多比例改造后）：原先拿 art-deco 当「只支持 16:9」的样本，但它已被改造成
      //     支持 9:16（demo/film.js 里已声明 aspects: ['16:9','9:16']）—— 旧前提过期。
      //     现在**唯一**不支持 9:16 的是 pixel-rpg（像素完整性约束：320×180 帧缓冲按整数倍最近邻放大，
      //     9:16 的 k=0.5625 会让像素块变成 3.375px），所以拿它做反向样本。
      //   ★ 判据按它的**真实入口**读，不是 film.js：pixel-rpg **没有** demo/film*.js，
      //     demo/index.html 里是 `if (q.has('sheet')) import('./sheet.js'); else import('./main.js');`
      //     ⇒ 真正上屏的是 main.js / sheet.js。自适应改造的标志（见库侧 MAINTAINING.md 的「让影片支持多比例」
      //     范式）是「导出 NATIVE / 调 setFrame / 有 layout(W,H)」—— 这三样在它的入口里一个都不该出现。
      //   ★ 同样直接读源文件，**不经过 lib/aspects.mjs**（那正是被测对象，不能拿它自证）。
      const pxDemo = _path.join(CFG.winLib, 'styles', 'pixel-rpg', 'demo');
      for (const f of ['main.js', 'sheet.js']) {   // 入口清单来自 pixel-rpg/demo/index.html 的 import()
        const src = _fs.readFileSync(_path.join(pxDemo, f), 'utf8');
        assert.ok(!/\bNATIVE\b/.test(src),
          `${f} 里出现 NATIVE（自适应改造标志），但接口说 pixel-rpg 只支持 16:9 —— 探测与事实脱节`);
        assert.ok(!/\bsetFrame\b/.test(src),
          `${f} 里出现 setFrame（自适应改造标志），但接口说 pixel-rpg 只支持 16:9 —— 探测与事实脱节`);
        assert.ok(!/\blayout\s*\(/.test(src),
          `${f} 里出现 layout(（自适应改造标志），但接口说 pixel-rpg 只支持 16:9 —— 探测与事实脱节`);
      }

      // 没声明 aspects 的风格 → 只支持 16:9（默认语义），**不抛错、不 404**
      //   ★ 清单已换（多比例改造后）：42/43 个风格都声明了 aspects，**唯一**没声明的是 pixel-rpg
      //     —— 与上面那段反向核验同一个样本，接口口径（declared=false / 只支持 16:9）与源码事实互为对照。
      for (const slug of ['pixel-rpg']) {
        const r = await ctx.get(`/api/aspects?slug=${slug}`);
        assert.strictEqual(r.status, 200, `${slug} 状态码 ${r.status}`);
        assert.strictEqual(r.json.declared, false, `${slug} 不该有 aspects 声明`);
        assert.deepStrictEqual(r.json.supported, ['16:9'], `${slug} 应只支持 16:9：${JSON.stringify(r.json.supported)}`);
        assert.match(String(r.json.note || ''), /16:9/, `${slug} 的 note 应点明「只支持 16:9」`);
      }

      // 精确到某一部影片：从 style 模式探到的**模块名**里挑一个非默认的（engraving 有 film_coffee）
      //   ★ 判据是「文件名」不是 FILM_META.id —— filmModuleAspects 拼的是 `<name>.js`。
      const other = e.films.map((f) => f.film).find((n) => n !== 'film');
      assert.ok(other, `engraving 应有多部影片模块：${JSON.stringify(e.films.map((f) => f.film))}`);
      const one = await ctx.get(`/api/aspects?slug=engraving&film=${encodeURIComponent(other)}`);
      assert.strictEqual(one.status, 200, `film=${other} 状态码 ${one.status}`);
      assert.strictEqual(one.json.mode, 'film', `mode=${one.json.mode}（期望 film）`);
      assert.strictEqual(one.json.films.length, 1, 'film 模式只该探一部');
      assert.strictEqual(one.json.films[0].film, other, `films[0].film=${one.json.films[0].film}`);
      assert.strictEqual(one.json.declared, true, `${other} 声明了 aspects`);

      // 白名单外的 slug 也照答（本接口不限于 4 个工单风格），读不到 demo 就按「只支持 16:9」
      const unknown = await ctx.get('/api/aspects?slug=definitely-no-such-style');
      assert.strictEqual(unknown.status, 200, `未知 slug 应照答 200，实际 ${unknown.status}`);
      assert.deepStrictEqual(unknown.json.supported, ['16:9'], '未知 slug 应按「只支持 16:9」处理');

      // 非法影片模块名 → 不 404、不抛，只把 error 如实报出来并退回「只支持 16:9」
      const evil = await ctx.get('/api/aspects?slug=engraving&film=..%2Fevil');
      assert.strictEqual(evil.status, 200, `非法 film 名应照答 200，实际 ${evil.status}`);
      assert.strictEqual(evil.json.mode, 'film', `mode=${evil.json.mode}`);
      assert.ok(evil.json.error, `非法影片模块名应给出 error：${JSON.stringify(evil.json.error)}`);
      assert.deepStrictEqual(evil.json.supported, ['16:9'], '非法影片模块名应退回「只支持 16:9」');
      ctx.note('③ /api/aspects：engraving 5 比例、未声明风格只支持 16:9、未知 slug / 非法 film 名都不抛');
    },
  },
  {
    name: '③ 非法比例 / 非法尺寸的工单 → 400 且不落盘',
    run: async (ctx) => {
      const before = await ctx.get('/api/briefs');
      assert.strictEqual(before.status, 200, `GET /api/briefs 状态码 ${before.status}`);
      const n0 = before.json.count;

      // 尺寸约束（偶数、MIN_SIZE–MAX_SIZE，下限 96）在**接口层**的表达：非法写法一律 400，且校验发生在落盘之前
      const bad = [
        [{ ratio: '7:5' }, '不在预设比例'],
        [{ ratio: '9:16:1' }, '畸形比例'],
        [{ size: '1080x1919' }, '奇数高'],
        [{ size: '1081x1920' }, '奇数宽'],
        [{ size: '8x8' }, '远低于 96'],
        [{ size: '94x94' }, '低于 96（正好下一档）'],
        [{ size: '96x94' }, '高低于 96'],
        [{ size: '10000x10000' }, '高于 8192'],
        [{ size: 'abc' }, '不是 WxH'],
        [{ size: '1080' }, '只有一边'],
      ];
      for (const [extra, why] of bad) {
        const r = await ctx.post('/api/briefs', { slug: 'engraving', topic: '尺寸校验用例', ...extra });
        assert.strictEqual(r.status, 400, `${why}（${JSON.stringify(extra)}）应 400，实际 ${r.status}：${r.text.slice(0, 200)}`);
        assert.ok(r.json && typeof r.json.error === 'string' && r.json.error, `${why} 的 400 没有 error 说明`);
      }

      // 关键：以上全是**校验前置**，一条都不该落盘
      const after = await ctx.get('/api/briefs');
      assert.strictEqual(after.json.count, n0, `非法请求竟然改了工单数：${n0} → ${after.json.count}`);
      ctx.note('③ 非法比例/尺寸工单：10 种写法全部 400，工单数不变（校验在落盘之前）');
    },
  },

  {
    name: '④ dry-run 任务全链路（POST /api/run → 轮询 → SSE 日志）',
    run: async (ctx) => {
      // ── 1) 入队 ──
      const r = await ctx.post('/api/run', { slug: 'ascii-crt', opts: ['--skip-sync', '--dry-run'] });
      assert.strictEqual(r.status, 200, `POST /api/run 状态码 ${r.status}：${r.text.slice(0, 300)}`);
      const job = r.json.job;
      assert.ok(job && typeof job.id === 'string' && job.id, `返回里没有 job.id：${r.text.slice(0, 300)}`);
      // ★ 必须登记（第六批补）：这个任务会写进 D:\lemo-films\.console\index.json + logs/<id>.jsonl。
      //   早先漏了这两行，结果是**每跑一次 smoke 就往用户历史里多留 2 条 dry-run 任务**
      //   （文件头注释本来就写着「有副作用的几件事全部登记在 ARTIFACTS 里」，只是这两处没落实）。
      ARTIFACTS.jobIds.add(job.id);
      ctx.note(`④ 任务已入队：${job.id}`);

      // ── 2) 轮询到结束 ──
      const deadline = Date.now() + 60000;
      let last = null;
      let sawRunning = false;
      while (Date.now() < deadline) {
        const j = await ctx.get('/api/jobs');
        last = (j.json.jobs || []).find((x) => x.id === job.id) || null;
        if (last?.status === 'running') sawRunning = true;
        if (last && ['done', 'failed', 'canceled', 'ended'].includes(last.status)) break;
        await ctx.sleep(400);
      }
      assert.ok(last, `轮询 60s 后 /api/jobs 里找不到任务 ${job.id}`);
      assert.ok(['done', 'failed', 'canceled', 'ended'].includes(last.status),
        `任务 60s 内没结束，最后状态 ${last.status}`);
      assert.strictEqual(last.status, 'done', `任务状态 ${last.status}（期望 done），error=${last.error}`);
      assert.strictEqual(last.exitCode, 0, `退出码 ${last.exitCode}（期望 0）`);
      ctx.note(`④ 任务 ${job.id} → ${last.status} / exit ${last.exitCode}（期间观察到 running=${sawRunning}）`);

      // ── 3) SSE 日志回放 ──
      const { events } = await ctx.sse(`/api/logs/${job.id}`, {
        timeoutMs: 20000,
        stopOn: (ev) => ev.type === 'end',
      });
      const lines = events.filter((e) => e.type === 'line');
      assert.ok(lines.length > 0, `SSE 一条日志行都没回放到（收到 ${events.length} 个事件）`);
      assert.ok(lines.some((e) => String(e.line).includes('[1]')),
        `日志里找不到步骤标记 [1]；前 5 行：${lines.slice(0, 5).map((e) => e.line).join(' | ')}`);
      const end = events.find((e) => e.type === 'end');
      assert.ok(end, 'SSE 没有回放 end 事件');
      assert.strictEqual(end.status, 'done', `SSE end.status=${end.status}`);
      ctx.note(`④ SSE 回放 ${lines.length} 行日志，含 [1] 与 end 事件`);

      // 给后面的 ⑥⑦ 用（取消 / 断线续传 / 跨重启）
      ctx.state.dryRunJobId = job.id;
    },
  },

  // ── ⑥ 任务取消（HTTP 层）──────────────────────────────────
  {
    name: '⑥ DELETE /api/jobs/:id → running 变 canceled（记录仍在、进程真死）；终态 DELETE → 删记录',
    run: async (ctx) => {
      // ★ 为什么用 dry-run：它是**无害的长任务**（约 4.5s，只打印步骤、不渲染、不混流）。
      //   真渲染绝不能在测试里取消 —— 取消真渲染会打断 mux，且会动用户的成片目录。
      //
      // ★ 编排器的并发锁 D:\lemo-films\.ascii-crt.lock：dry-run **也会**建它
      //   （编排器在 dry-run 分支之前就抢锁），而它的 releaseLock 挂在 process 的 'exit'
      //   钩子上 —— 被 taskkill /F 硬杀时**不会执行**，于是取消会留下一个「pid 已死」的陈旧锁。
      //   编排器下次会按「pid 已死」自动接管，功能上无害；但它是**这条用例自己造的**残留，
      //   所以要收干净。判据很严：只删「锁里第一行的 pid == 刚被取消的那个 pid」的那一个文件。
      const orchLock = path.join(FILM_DIR, '.ascii-crt.lock');
      let canceledPid = null;

      try {
        const r = await ctx.post('/api/run', { slug: 'ascii-crt', opts: ['--skip-sync', '--dry-run'] });
        assert.strictEqual(r.status, 200, `POST /api/run 状态码 ${r.status}：${r.text.slice(0, 300)}`);
        const id = r.json.job.id;
        ARTIFACTS.jobIds.add(id);   // ★ 必须登记（第六批补）：同上，否则每次跑 smoke 都留一条
        ctx.note(`⑥ 待取消任务：${id}`);

        // 1) 等到 running 并拿到 pid（enqueue 内部同步 startJob，POST 返回时通常已经是 running）
        let s = null;
        const t0 = Date.now();
        while (Date.now() - t0 < 15000) {
          const j = await ctx.get('/api/jobs');
          s = (j.json.jobs || []).find((x) => x.id === id) || null;
          if (s && s.status === 'running' && s.pid) break;
          if (s && ['done', 'failed', 'canceled'].includes(s.status)) break;
          await ctx.sleep(80);
        }
        assert.ok(s, `/api/jobs 里找不到 ${id}`);
        assert.strictEqual(s.status, 'running', `取消前状态是 ${s.status}（期望 running）—— dry-run 是不是太快跑完了？`);
        const pid = s.pid;
        assert.ok(Number.isInteger(pid) && pid > 0, `任务摘要里没有可用 pid：${JSON.stringify(s)}`);
        canceledPid = pid;

        // 2) 取消
        const d = await ctx.del(`/api/jobs/${id}`);
        assert.strictEqual(d.status, 200, `DELETE 状态码 ${d.status}：${d.text.slice(0, 200)}`);
        assert.strictEqual(d.json.ok, true, `DELETE 返回 ${d.text.slice(0, 200)}`);

        // 3) 状态变 canceled —— ★ 且记录必须**仍在列表里**。
        //    ★ 安全边界（关键）：DELETE 一个 running 任务 = 「取消」，**绝不能是「删除」**。
        //    删掉正在跑的任务会留下占 GPU 的无人管子进程（孤儿）。所以这里必须能查到它。
        let s2 = null;
        const t1 = Date.now();
        while (Date.now() - t1 < 20000) {
          const j = await ctx.get('/api/jobs');
          s2 = (j.json.jobs || []).find((x) => x.id === id) || null;
          if (s2 && s2.status === 'canceled') break;
          await ctx.sleep(150);
        }
        assert.ok(s2, `取消后 /api/jobs 里找不到 ${id} —— running 任务被「删除」了？`
          + '（安全边界违规：取消只能置 canceled，绝不能抹掉记录，否则会留下占 GPU 的孤儿进程）');
        assert.strictEqual(s2.status, 'canceled', `取消后状态 ${s2.status}（期望 canceled）`);

        // 4) ★ 进程真的死了（只置状态不杀进程 = 假取消，会留下占 GPU 的孤儿）
        let alive = true;
        const t2 = Date.now();
        while (Date.now() - t2 < 10000) {
          try { process.kill(pid, 0); } catch { alive = false; break; }
          await ctx.sleep(200);
        }
        assert.strictEqual(alive, false,
          `取消后 pid ${pid} 仍活着 —— 进程树没被收掉（taskkill /T 没生效？）`);

        // 5) ★ 语义（2026-10 有意改动）：DELETE /api/jobs/:id **按状态分派** ——
        //      · queued / running → 取消（中止还在跑的任务，原样）；
        //      · 终态（canceled/done/failed/ended）→ **删除记录**（从列表 + index.json 里抹掉）。
        //    所以对上面这条**已 canceled** 的任务再 DELETE，现在返回 200 {ok,id}（不再是 400）。
        //    与 lib/briefs.mjs:deleteBrief 同范式：终态可删、running 拒删（409）。
        const again = await ctx.del(`/api/jobs/${id}`);
        assert.strictEqual(again.status, 200,
          `终态任务 DELETE 应 200（删除记录），实际 ${again.status}：${again.text.slice(0, 200)}`);
        assert.strictEqual(again.json.ok, true, `DELETE 终态应返回 {ok:true}，实际 ${again.text.slice(0, 200)}`);
        assert.strictEqual(again.json.id, id, `DELETE 返回的 id 应为 ${id}，实际 ${again.json.id}`);

        // 6) ★ 记录真的从列表里消失了（不是只把状态又改了一遍）
        const after = await ctx.get('/api/jobs');
        const gone = !(after.json.jobs || []).some((x) => x.id === id);
        assert.ok(gone, `删除后 /api/jobs 里仍有 ${id} —— 记录没被真正删掉`);

        ctx.note(`⑥ 取消 ${id}：running(pid ${pid}) → canceled 且仍在列表、pid 已消失；`
          + '再 DELETE → 200 删除记录（已从列表消失）');
      } finally {
        // 收掉「这条用例自己造出来的」陈旧锁 —— 只认 pid 完全对得上的那一个
        try {
          await ctx.sleep(1000);   // 万一是被杀的那一瞬间刚写下去的
          if (canceledPid !== null && fs.existsSync(orchLock)) {
            const lockPid = Number(String(fs.readFileSync(orchLock, 'utf8')).split('\n')[0]);
            if (lockPid === canceledPid) {
              fs.unlinkSync(orchLock);
              ctx.note(`⑥ 清掉了取消渲染任务留下的陈旧锁 .ascii-crt.lock（pid ${lockPid} 已死）`);
            }
          }
        } catch { /* 清不掉也不影响结论 */ }
      }
    },
  },

  // ── ⑥b DELETE 不存在的 id（404 分支）──────────────────────
  {
    name: '⑥b DELETE /api/jobs/<不存在 id> → 404（非 200/500/裸 HTML）；空 id 走兜底',
    run: async (ctx) => {
      // ★ 补缺口：这条 404 分支此前**从没被测过**。
      //   与 lib/briefs.mjs:deleteBrief「不存在 404」同范式；lib/jobs.mjs:deleteJob
      //   在 :760 明确 `if (!job) return { ok: false, code: 404, error: ... }`。
      //   本用例只读接口，无副作用（deleteJob 对不存在的 id 在 :759-760 就 return 了）。
      const ghost = 'jmur-nonexistent-404probe';

      // 先确认这个 id 确实不在列表里 —— 否则这条用例就变成「删一条真任务」了
      const before = await ctx.get('/api/jobs');
      assert.ok(!(before.json.jobs || []).some((x) => x.id === ghost),
        `探针 id ${ghost} 竟然存在于 /api/jobs —— 请换一个绝不存在的 id`);

      // 1) 不存在的 id → 404 + 可读的 JSON error（不是裸 HTML）
      const r = await ctx.del(`/api/jobs/${ghost}`);
      assert.strictEqual(r.status, 404,
        `DELETE 不存在的 id 应 404，实际 ${r.status}：${r.text.slice(0, 200)}`);
      assert.ok(r.json && typeof r.json.error === 'string' && r.json.error.length > 0,
        `404 响应体应含可读的 { error }，实际：${r.text.slice(0, 200)}`);
      assert.ok(r.json.error.includes(ghost),
        `错误信息应点名缺失的 id ${ghost}，实际：${r.json.error}`);
      assert.ok(!/^\s*</.test(r.text), `响应体疑似裸 HTML：${r.text.slice(0, 120)}`);

      // 2) 边界：空 id（DELETE /api/jobs/）—— 如实记录观察到的行为，不改实现
      const empty = await ctx.del('/api/jobs/');
      ctx.note(`⑥b 边界：DELETE /api/jobs/（空 id）→ ${empty.status}，响应 ${empty.text.slice(0, 120)}`);

      ctx.note(`⑥b DELETE 不存在 id ${ghost} → 404 ${JSON.stringify(r.json)}`);
    },
  },

  // ── ⑦ SSE 断线续传语义 ────────────────────────────────────
  {
    name: '⑦ SSE ?lastEventId=N → 只补发 n>N 的行（增量续传）',
    run: async (ctx) => {
      const id = ctx.state.dryRunJobId;
      assert.ok(id, '依赖 ④ 的任务 id，但 ④ 没跑成');

      // 全量（不带 lastEventId）
      const full = await ctx.sse(`/api/logs/${id}`, { timeoutMs: 20000, stopOn: (e) => e.type === 'end' });
      const fullLines = full.events.filter((e) => e.type === 'line');
      assert.ok(fullLines.length >= 3, `全量回放只有 ${fullLines.length} 行，样本太小，这条用例说明不了问题`);
      const ns = fullLines.map((e) => e.n);
      for (let i = 1; i < ns.length; i++) {
        assert.ok(ns[i] > ns[i - 1], `序号不是单调递增：${ns.slice(0, 12).join(',')}`);
      }

      const N = ns[Math.floor(ns.length / 2)];
      const want = ns.filter((n) => n > N);
      assert.ok(want.length > 0 && want.length < ns.length, `切点 N=${N} 没把行分成两半（共 ${ns.length} 行）`);

      const inc = await ctx.sse(`/api/logs/${id}?lastEventId=${N}`, { timeoutMs: 20000, stopOn: (e) => e.type === 'end' });
      const incLines = inc.events.filter((e) => e.type === 'line');
      assert.deepStrictEqual(incLines.map((e) => e.n), want,
        `增量补发的序号不对：期望 ${want.length} 行（n>${N}），实际 ${incLines.length} 行（${incLines.map((e) => e.n).join(',')}）`);
      assert.ok(!inc.events.some((e) => e.type === 'gap'), '这次没有发生裁剪，不该出现 gap 事件');

      // hello 帧要说明「这是续传」
      const hello = inc.events[0];
      assert.ok(hello && typeof hello === 'object', 'SSE 没有 hello 帧');
      assert.strictEqual(hello.resumed, true, `hello.resumed=${hello.resumed}（期望 true）`);
      assert.strictEqual(hello.resumeFrom, N, `hello.resumeFrom=${hello.resumeFrom}（期望 ${N}）`);

      // 供跨重启用例比对
      ctx.state.sseFull = { ns, lines: fullLines.map((e) => e.line), count: fullLines.length };
      ctx.note(`⑦ 全量 ${ns.length} 行 → lastEventId=${N} 只补发 ${incLines.length} 行（省掉 ${ns.length - incLines.length} 行）`);
    },
  },
  {
    name: '⑦ SSE Last-Event-ID 请求头同样能续传，且优先于 ?lastEventId',
    run: async (ctx) => {
      const id = ctx.state.dryRunJobId;
      const before = ctx.state.sseFull;
      assert.ok(id && before, '依赖 ④⑦ 的前置结果');

      const N = before.ns[Math.floor(before.ns.length / 2)];
      const want = before.ns.filter((n) => n > N);

      // 浏览器自动重连走的是请求头
      const inc = await ctx.sse(`/api/logs/${id}`, {
        timeoutMs: 20000, headers: { 'Last-Event-ID': String(N) }, stopOn: (e) => e.type === 'end',
      });
      assert.deepStrictEqual(inc.events.filter((e) => e.type === 'line').map((e) => e.n), want,
        '带 Last-Event-ID 请求头时补发的行不对');

      // 头与 query 同时给：头优先（server.mjs: rawHeader ?? rawQuery）
      const both = await ctx.sse(`/api/logs/${id}?lastEventId=0`, {
        timeoutMs: 20000, headers: { 'Last-Event-ID': String(N) }, stopOn: (e) => e.type === 'end',
      });
      assert.strictEqual(both.events[0]?.resumeFrom, N,
        `头与 query 冲突时应以头为准（resumeFrom=${both.events[0]?.resumeFrom}，期望 ${N}）`);
      assert.deepStrictEqual(both.events.filter((e) => e.type === 'line').map((e) => e.n), want,
        '头优先时补发的行不对');
      ctx.note('⑦ Last-Event-ID 请求头可续传，且优先于 ?lastEventId');
    },
  },
  {
    name: '⑦ 跨重启 logSeq 稳定（重启后同一任务的序号与行内容逐字不变）',
    run: async (ctx) => {
      const id = ctx.state.dryRunJobId;
      const before = ctx.state.sseFull;
      assert.ok(id && before, '依赖 ④⑦ 的前置结果');

      const port = await ctx.restartServer();
      ctx.note(`⑦ 测试服务已重启（新端口 ${port}）`);

      const list = await ctx.get('/api/jobs');
      const j = (list.json.jobs || []).find((x) => x.id === id);
      assert.ok(j, `重启后 /api/jobs 里找不到 ${id} —— 历史没从磁盘恢复`);
      assert.strictEqual(j.status, 'done', `重启后任务状态 ${j.status}（期望 done）`);
      assert.strictEqual(j.restored, true, '重启后历史任务的 restored 应为 true');

      const after = await ctx.sse(`/api/logs/${id}`, { timeoutMs: 20000, stopOn: (e) => e.type === 'end' });
      const afterLines = after.events.filter((e) => e.type === 'line');
      assert.deepStrictEqual(afterLines.map((e) => e.n), before.ns,
        `重启后序号变了（前 5 个：${afterLines.slice(0, 5).map((e) => e.n).join(',')} vs ${before.ns.slice(0, 5).join(',')}）—— logSeq 没从磁盘恢复`);
      assert.deepStrictEqual(afterLines.map((e) => e.line), before.lines,
        '重启后日志正文变了（落盘/回读丢了内容？）');
      ctx.note(`⑦ 重启后 ${afterLines.length} 行日志的序号与内容与重启前完全一致`);
    },
  },

  // ── ⑧ 并发锁的真冲突态（只造测试锁，绝不碰真实锁）────────
  {
    name: '⑧ 并发锁：活 pid → locked=true / alive=true（真冲突态）',
    run: async (ctx) => {
      const slug = '__test-lock__';                       // 不可能与真实风格同名
      const lockPath = path.join(FILM_DIR, `.${slug}.lock`);
      assert.ok(!fs.existsSync(lockPath), `测试锁路径已存在（${lockPath}）—— 先手动确认这不是真实任务在用的锁`);

      // 造一个真的活着的 pid（无害空转进程），别拿测试自己的 pid 冒充
      const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], { windowsHide: true, stdio: 'ignore' });
      ARTIFACTS.lockFiles.add(lockPath);
      try {
        // 格式与编排器 lemo-make.mjs 逐字一致：第一行 pid、第二行 ISO 时间
        fs.writeFileSync(lockPath, `${child.pid}\n${new Date().toISOString()}\n`, 'utf8');

        const r = await ctx.get(`/api/precheck?slug=${slug}`);
        assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
        const d = r.json;
        assert.strictEqual(d.alive, true, `活 pid ${child.pid} 被判成不活着：${JSON.stringify(d)}`);
        assert.strictEqual(d.locked, true, `活 pid 的锁没被判成冲突：${JSON.stringify(d)}`);
        assert.strictEqual(d.stale, false, `活 pid 的锁被判成陈旧（会误报成「正常」）：${JSON.stringify(d)}`);
        assert.strictEqual(d.pid, child.pid, `回显的 pid 不对：${d.pid}（期望 ${child.pid}）`);
        assert.ok(d.lockAgeSec >= 0 && d.lockAgeSec < 120, `锁龄不合理：${d.lockAgeSec}s`);
        assert.match(String(d.message || ''), /并发|损坏/, `locked=true 时 message 应给出人话解释，实际：${JSON.stringify(d.message)}`);
        // ★ 这条 message 会被前端**原样 textContent**（app.js 的 lockWarn 与批量确认弹层），
        //   所以它里面不能有 markdown 的 `**` —— 那会原样显示成两个星号。
        assert.doesNotMatch(String(d.message || ''), /\*\*/, `message 里有 \`**\` 字面量（前端 textContent 会原样显示）：${JSON.stringify(d.message)}`);
        ctx.note(`⑧ 活 pid ${child.pid} 的锁 → locked=true / stale=false（不误判）；message 无 \`**\` 字面量`);
      } finally {
        try { child.kill(); } catch { /* ignore */ }
        try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
        ARTIFACTS.lockFiles.delete(lockPath);
      }
    },
  },
  {
    name: '⑧ 并发锁：死 pid → locked=false / stale=true（不误报冲突）',
    run: async (ctx) => {
      const slug = '__test-lock__';
      const lockPath = path.join(FILM_DIR, `.${slug}.lock`);
      assert.ok(!fs.existsSync(lockPath), `测试锁路径已存在（${lockPath}）`);

      const deadPid = await freshDeadPid();
      assert.ok(deadPid, '造不出一个确定已死的 pid');

      ARTIFACTS.lockFiles.add(lockPath);
      try {
        fs.writeFileSync(lockPath, `${deadPid}\n${new Date().toISOString()}\n`, 'utf8');
        const r = await ctx.get(`/api/precheck?slug=${slug}`);
        assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
        const d = r.json;
        assert.strictEqual(d.alive, false, `死 pid ${deadPid} 被判成活着：${JSON.stringify(d)}`);
        assert.strictEqual(d.locked, false, `死 pid 的锁被判成冲突 —— 这会让用户在「编排器本来会接管」的情况下被吓一跳：${JSON.stringify(d)}`);
        assert.strictEqual(d.stale, true, `死 pid 的锁应标成 stale：${JSON.stringify(d)}`);
        assert.ok(!(d.locked && d.stale), 'locked 与 stale 同时为 true —— 判据自相矛盾');
        ctx.note(`⑧ 死 pid ${deadPid} 的锁 → locked=false / stale=true（不误报）`);
      } finally {
        try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
        ARTIFACTS.lockFiles.delete(lockPath);
      }
    },
  },

  // ── ⑨ 成片文件的 Range 请求（拖进度条靠它）───────────────
  {
    name: '⑨ GET /api/films/:slug/:file → Range 206 / 越界 416 / 无 Range 200',
    run: async (ctx) => {
      const list = await ctx.get('/api/films');
      assert.strictEqual(list.status, 200, `状态码 ${list.status}`);
      const film = (list.json.films || []).find((f) => f.slug === 'ascii-crt' && f.file === 'ascii-crt.mp4');
      assert.ok(film, `D:\\lemo-films\\ascii-crt\\ascii-crt.mp4 不在 /api/films 列表里 —— 成片缺失时这条用例没法验`);
      const size = film.size;
      assert.ok(size > 200000, `成片只有 ${size} 字节，太小，验不出 Range`);

      const p = '/api/films/ascii-crt/ascii-crt.mp4';

      // 1) 不带 Range → 200 + Accept-Ranges（只收 64KB 就断开：成片 29MB，整份读既慢又没必要）
      const full = await ctx.get(p, { accept: '*/*', maxBytes: 65536 });
      assert.strictEqual(full.status, 200, `无 Range 时状态码 ${full.status}`);
      assert.strictEqual(full.headers['accept-ranges'], 'bytes', `Accept-Ranges=${full.headers['accept-ranges']}`);
      assert.strictEqual(Number(full.headers['content-length']), size, '无 Range 时应回完整长度');
      assert.match(String(full.headers['content-type'] || ''), /video\/mp4/, `Content-Type=${full.headers['content-type']}`);
      assert.ok(full.truncated && full.bytes >= 65536, '测试自己没断开连接（maxBytes 没生效）');

      // 2) bytes=0-1023 → 206 + 正确 Content-Range + 长度 1024
      const r1 = await ctx.get(p, { accept: '*/*', headers: { Range: 'bytes=0-1023' } });
      assert.strictEqual(r1.status, 206, `Range 请求状态码 ${r1.status}（期望 206）`);
      assert.strictEqual(r1.headers['content-range'], `bytes 0-1023/${size}`, `Content-Range=${r1.headers['content-range']}`);
      assert.strictEqual(Number(r1.headers['content-length']), 1024, `Content-Length=${r1.headers['content-length']}`);
      assert.strictEqual(r1.bytes, 1024, `实际收到 ${r1.bytes} 字节（期望 1024）`);
      assert.strictEqual(r1.headers['accept-ranges'], 'bytes');
      assert.ok(r1.buf.subarray(0, 16).equals(full.buf.subarray(0, 16)),
        '206 返回的字节与整份开头不一致 —— 不是同一个文件的同一段');

      // 3) 后缀 Range bytes=-1024 → 206，取的是**末尾** 1024 字节
      const r2 = await ctx.get(p, { accept: '*/*', headers: { Range: 'bytes=-1024' } });
      assert.strictEqual(r2.status, 206, `后缀 Range 状态码 ${r2.status}（期望 206）`);
      assert.strictEqual(r2.headers['content-range'], `bytes ${size - 1024}-${size - 1}/${size}`,
        `后缀 Range 的 Content-Range=${r2.headers['content-range']}`);
      assert.strictEqual(r2.bytes, 1024, `后缀 Range 收到 ${r2.bytes} 字节（期望 1024）`);

      // 4) 起点越界 → 416
      const r3 = await ctx.get(p, { accept: '*/*', headers: { Range: `bytes=${size}-${size + 100}` } });
      assert.strictEqual(r3.status, 416, `越界 Range 状态码 ${r3.status}（期望 416）`);
      assert.strictEqual(r3.headers['content-range'], `bytes */${size}`, `416 的 Content-Range=${r3.headers['content-range']}`);

      // 5) 非法 Range → 如实断言实现行为（server.mjs 的正则不匹配就 416）
      const r4 = await ctx.get(p, { accept: '*/*', headers: { Range: 'bytes=abc' } });
      assert.strictEqual(r4.status, 416, `非法 Range 状态码 ${r4.status}（实现是 416）`);
      assert.strictEqual(r4.headers['content-range'], `bytes */${size}`);

      ctx.note(`⑨ 成片 ${(size / 1048576).toFixed(1)}MB：Range 206/416、后缀 Range、无 Range 200 均符合实现`);
    },
  },

  // ── ③+ 声音（/api/voices*）──────────────────────────────────
  //
  // ★ 「声音」版块此前**一条自动化用例都没有**。这三条钉住的是：
  //   ① 清单契约（四组齐全 + **分组 items 之和 == voices 条数**，防漏项）；
  //   ② 参考音真的能取到字节（含 Range，因为试听要能拖进度条）；
  //   ③ **安全性**：name 只用来在清单里查表，目录穿越无从发生（这是本功能的唯一要点）。
  {
    name: '③ GET /api/voices → 200 · 清单非空 · 四组齐全且 items 之和 == voices 条数',
    run: async (ctx) => {
      // 首次要起一个 python 进程读库侧 --list-voices，给宽一点（缓存 30s，后续很快）
      const r = await ctx.get('/api/voices', { timeoutMs: 120000 });
      assert.strictEqual(r.status, 200, `状态码 ${r.status}：${r.text.slice(0, 200)}`);
      const d = r.json;
      assert.ok(d && typeof d === 'object', '返回不是 JSON 对象');
      assert.strictEqual(d.ok, true, `ok 应为 true，实际 ${JSON.stringify(d.ok)}（error=${JSON.stringify(d.error)}）—— 音色清单读不到？`);
      assert.ok(Array.isArray(d.voices) && d.voices.length > 0, `voices 不是非空数组：${JSON.stringify(d.voices)}`);
      assert.ok(Array.isArray(d.groups), `groups 不是数组：${JSON.stringify(d.groups)}`);

      // 四组**恒定存在**（面板形状不该随某台机器素材多少而变）
      const GROUP_IDS = ['alias', 'library-alias', 'official', 'library'];
      const ids = d.groups.map((g) => g && g.id);
      for (const gid of GROUP_IDS) {
        assert.ok(ids.includes(gid), `缺少分组 ${gid}（实际分组：${ids.join(' / ')}）`);
      }

      // ★ 防漏项：各分组 items 数之和必须 == voices 条数（有音色没被任何分组收走就是漏了）
      const sum = d.groups.reduce((n, g) => n + (Array.isArray(g.items) ? g.items.length : 0), 0);
      assert.strictEqual(sum, d.voices.length,
        `分组 items 之和 ${sum} != voices 条数 ${d.voices.length} —— 有音色没被任何分组收走（面板上会少一条）`);

      // 分组里的每个名字都必须真实存在于 voices 里（分组只该引用，不该凭空造名字）
      const names = new Set(d.voices.map((v) => v && v.name));
      for (const g of d.groups) {
        for (const n of (g.items || [])) {
          assert.ok(names.has(n), `分组 ${g.id} 里的 ${JSON.stringify(n)} 不在 voices 清单里`);
        }
      }

      // source：当前 engraving 内容文件用的音色。读不到时是 null（不算错），但读了就必须是合法形状。
      if (d.source !== null && d.source !== undefined) {
        assert.strictEqual(typeof d.source, 'object', `source 应是对象或 null，实际 ${JSON.stringify(d.source)}`);
        assert.strictEqual(typeof d.source.content, 'string', `source.content 应是内容文件名，实际 ${JSON.stringify(d.source.content)}`);
      }

      ctx.state.voiceFirstAlias = (d.voices.find((v) => v && v.kind === 'alias') || d.voices[0]).name;
      ctx.note(`③ /api/voices：${d.voices.length} 条音色；四组 items = `
        + `${d.groups.map((g) => `${g.id}:${(g.items || []).length}`).join(' ')}；source=${JSON.stringify(d.source)}`);
    },
  },
  {
    name: '③ GET /api/voices/audio?name=<第一个别名> → 200 audio/* · 字节数 > 10000 · Range 206',
    run: async (ctx) => {
      // 拿第一个别名（清单里的第一条 alias，用户最可能试听的那条）
      const list = await ctx.get('/api/voices', { timeoutMs: 120000 });
      assert.strictEqual(list.status, 200, `状态码 ${list.status}`);
      const voices = Array.isArray(list.json.voices) ? list.json.voices : [];
      const first = voices.find((v) => v && v.kind === 'alias') || voices[0];
      assert.ok(first && first.name, `清单里没有可取试听的音色：${JSON.stringify(voices.slice(0, 3))}`);

      const p = '/api/voices/audio?name=' + encodeURIComponent(first.name);

      // 1) 不带 Range → 200 + audio/* + 完整长度（只收 64KB 就断开：参考音几百 KB，没必要整份读）
      const full = await ctx.get(p, { accept: '*/*', maxBytes: 65536 });
      assert.strictEqual(full.status, 200, `状态码 ${full.status}（期望 200）：${full.text.slice(0, 200)}`);
      assert.match(String(full.headers['content-type'] || ''), /audio\//i,
        `Content-Type=${full.headers['content-type']}（期望 audio/*）`);
      assert.strictEqual(full.headers['accept-ranges'], 'bytes', `Accept-Ranges=${full.headers['accept-ranges']}`);
      const size = Number(full.headers['content-length']);
      assert.ok(Number.isFinite(size) && size > 10000,
        `参考音只有 ${size} 字节（期望 > 10000）—— 这条太短，验不出是真实音频字节流`);
      assert.ok(full.truncated && full.bytes >= 65536, '测试自己没断开连接（maxBytes 没生效）');

      // 2) Range bytes=0-1023 → 206 + 正确的 Content-Range（试听要能拖进度条，靠的就是它）
      const r1 = await ctx.get(p, { accept: '*/*', headers: { Range: 'bytes=0-1023' } });
      assert.strictEqual(r1.status, 206, `Range 请求状态码 ${r1.status}（期望 206）`);
      assert.strictEqual(r1.headers['content-range'], `bytes 0-1023/${size}`,
        `Content-Range=${r1.headers['content-range']}`);
      assert.strictEqual(r1.bytes, 1024, `实际收到 ${r1.bytes} 字节（期望 1024）`);
      assert.ok(r1.buf.subarray(0, 16).equals(full.buf.subarray(0, 16)),
        '206 返回的字节与整份开头不一致 —— 不是同一个文件的同一段');

      ctx.note(`③ /api/voices/audio（${first.name}）：${size} 字节，audio/* + Accept-Ranges + Range 206 均符合`);
    },
  },
  {
    name: '③ GET /api/voices/audio 安全性：目录穿越 / 不存在的名字 → 都 404',
    run: async (ctx) => {
      // ★ 判据：name **只用来在清单里查表**，查到的绝对路径才去读文件 —— name 永远不会被拼进路径。
      //   所以 `../../windows/win.ini` 在清单里不存在 → 404，穿越无从发生。
      const LEAK = ['[fonts]', '[extensions]', 'for 16-bit app support'];   // win.ini 的特征串
      for (const name of ['../../../../windows/win.ini', '..\\..\\..\\windows\\win.ini']) {
        const r = await ctx.get('/api/voices/audio?name=' + encodeURIComponent(name));
        assert.strictEqual(r.status, 404, `name=${JSON.stringify(name)} → 状态码 ${r.status}（期望 404）：${r.text.slice(0, 160)}`);
        for (const m of LEAK) {
          assert.ok(!r.text.includes(m), `响应里疑似泄漏了 win.ini（命中 "${m}"）：${r.text.slice(0, 160)}`);
        }
      }
      // 一个「形状合法但清单里没有」的名字 → 同样 404（不是 500、不是空文件）
      const miss = await ctx.get('/api/voices/audio?name=' + encodeURIComponent('definitely_not_a_voice_9f3a'));
      assert.strictEqual(miss.status, 404, `不存在的音色名 → 状态码 ${miss.status}（期望 404）：${miss.text.slice(0, 160)}`);
      assert.ok(miss.json && typeof miss.json.error === 'string', `404 响应应带 error 说明：${miss.text.slice(0, 160)}`);
      ctx.note('③ 声音接口安全性：目录穿越（2 种写法）与不存在的名字都 404，响应里无 win.ini 内容');
    },
  },
];

// ── 进程用例（本进程内 import lib/jobs.mjs，起一个独立队列）────
//
// ★ 为什么不用 HTTP 层验「安装任务的取消」：
//   `/api/setup/run` 只接受 planActions() 真的规划出来的动作，而这台机器 12/12 ok →
//   一个动作都规划不出来 → 走 HTTP 根本入不了队。所以这里直接调 jobs.enqueueSetup()，
//   走的是**同一条** startSetupJob → runSteps → cancelJob → killJobChild 路径。
// ★ 会往 D:\lemo-films\.console 写任务记录 —— 已登记进 ARTIFACTS，跑完统一摘掉。
export const PROCESS_CASES = [
  {
    name: '⑥ 取消安装任务（kind=setup）→ canceled 且 WSL 侧进程组真的被收掉',
    run: async (ctx) => {
      const jobs = await import('../lib/jobs.mjs');

      const token = `cg-cancel-${process.pid}-${Date.now().toString(36)}`;
      const pidFile = `/tmp/${token}.pid`;
      const aliveMark = `/tmp/${token}.alive`;
      ARTIFACTS.wslFiles.add(pidFile);
      ARTIFACTS.wslFiles.add(aliveMark);

      // 无害长任务：写两个标记文件 → sleep 120 →（自然结束时）删掉 alive 标记
      // ★ sleep 给足 120s：这样「取消后 45s 内进程必须消失」的判定，永远发生在它自然结束之前。
      //   （本机 WSL 发行版会因空闲被回收，wsl.exe 可能是冷启动、单次要几十秒，窗口得留够。）
      const script = [
        `echo "$$" > ${pidFile}`,
        `touch ${aliveMark}`,
        'sleep 120',
        `rm -f ${aliveMark}`,
      ].join('\n');

      let jobId = null;
      try {
        const job = jobs.enqueueSetup({
          actionId: 'cg.cancel-probe',
          title: '取消测试（无害 sleep 30）',
          steps: [{ kind: 'wsl', label: '无害长任务（sleep 30）', script, timeoutMs: 180000 }],
        });
        jobId = job.id;
        ARTIFACTS.jobIds.add(jobId);
        ctx.note(`⑥ 安装任务已入队：${jobId}`);

        // 1) 等 WSL 侧真的跑起来（标记文件出现 = 脚本已经在 sleep 里）
        let up = false;
        let probe = null;
        const t0 = Date.now();
        while (Date.now() - t0 < 120000) {
          probe = await wsl(`test -e ${aliveMark} && echo YES || echo NO`);
          if (String(probe.out).includes('YES')) { up = true; break; }
          await ctx.sleep(500);
        }
        assert.ok(up, `120s 内 WSL 侧没起来（${aliveMark} 未出现）。wsl out=${JSON.stringify(probe?.out)} err=${JSON.stringify(probe?.err)}`);

        const st = jobs.getSummary(jobId);
        assert.strictEqual(st.status, 'running', `取消前任务状态 ${st.status}（期望 running）`);

        const pidRes = await wsl(`cat ${pidFile}`);
        const wslPid = Number(String(pidRes.out).trim());
        assert.ok(Number.isInteger(wslPid) && wslPid > 0, `读不到 WSL 侧 pid：${JSON.stringify(pidRes.out)}`);

        // 2) 取消（走的就是 DELETE /api/jobs/:id 背后那一个 cancelJob）
        const c = jobs.cancelJob(jobId);
        assert.strictEqual(c.ok, true, `cancelJob 返回 ${JSON.stringify(c)}`);

        let s2 = null;
        const t1 = Date.now();
        while (Date.now() - t1 < 20000) {
          s2 = jobs.getSummary(jobId);
          if (s2.status === 'canceled') break;
          await ctx.sleep(200);
        }
        assert.strictEqual(s2.status, 'canceled', `取消后状态 ${s2.status}（期望 canceled）`);

        // 3) ★★ 核心断言：WSL2 里的进程**不是** wsl.exe 的 Windows 子进程，
        //    taskkill /T 管不到它。少了 _lemoKillExtra 这一钩子，sleep 30 会继续跑到自然结束。
        //
        //    ★ 判「死」必须看 **进程状态**，不能只看 `kill -0`：
        //      实测被整组杀掉之后，脚本常会以 **僵尸（Zs <defunct>）** 形态留在进程表里
        //      （父进程已被 taskkill 带走 → 被 pid 1 收养 → WSL 的 init 不 reap）。
        //      僵尸已经死了、不占任何资源，但 `kill -0` 对它**返回成功** —— 只看 kill -0 会假阳性。
        //
        //    ★ 一次探测把三件事一起问完（进程状态 / 组内存活成员 / alive 标记），
        //      免得冷启动时一条 wsl.exe 卡住就把后面几条全拖超时。
        const probeOnce = () =>
          `st=$(ps -o stat= -p ${wslPid} 2>/dev/null | tr -d ' '); `
          + `g=$(ps -eo pid,pgid,stat | awk -v x=${wslPid} '$2==x && $3 !~ /^Z/' | wc -l); `
          + `if [ -e ${aliveMark} ]; then m=PRESENT; else m=GONE; fi; `
          + 'if [ -z "$st" ]; then s=DEAD; else case "$st" in Z*) s=ZOMBIE ;; *) s=ALIVE ;; esac; fi; '
          + 'echo "STATE=$s GROUP=$g MARKER=$m"';

        const parse = (out) => {
          const m = /STATE=(\w+)\s+GROUP=(\d+)\s+MARKER=(\w+)/.exec(String(out));
          return m ? { state: m[1], group: Number(m[2]), marker: m[3] } : null;
        };

        let snap = null;
        let lastProbe = '';
        let lastRaw = '';
        const t2 = Date.now();
        while (Date.now() - t2 < 45000) {
          const r = await wsl(probeOnce(), { timeoutMs: 25000 });
          lastRaw = `out=${JSON.stringify(String(r.out).trim())} err=${JSON.stringify(String(r.err).trim())} timeout=${!!r.timeout}`;
          const p = parse(r.out);
          if (p) {
            snap = p;
            lastProbe = `STATE=${p.state} GROUP=${p.group} MARKER=${p.marker}`;
            if (p.state !== 'ALIVE' && p.group === 0 && p.marker === 'PRESENT') break;
          }
          await ctx.sleep(500);
        }
        assert.ok(snap, `45s 内拿不到 WSL 侧状态快照（最后一次：${lastRaw}）—— 连状态都问不到，不算通过`);
        assert.notStrictEqual(snap.state, 'ALIVE',
          await (async () => {
            // 失败时把现场抓下来（进程树 / 同组进程 / pgid 记录文件）—— 否则只看到一句「还活着」没法定位
            const diag = await wsl(
              `ps -o pid,ppid,pgid,sid,stat,cmd -p ${wslPid} 2>&1;`
              + ' echo "--- 同组进程 ---";'
              + ` ps -eo pid,ppid,pgid,stat,cmd | awk -v g=${wslPid} '$3==g' ;`
              + ' echo "--- /tmp 里的 st-setup 文件 ---";'
              + ' ls -la /tmp/ | grep st-setup || echo "(无)"',
            );
            return `取消后 WSL 侧进程 ${wslPid} 仍在运行（${lastProbe}）`
              + ' —— 这正是「taskkill /T 管不到 WSL2 虚拟机里的进程」那个 bug 的形态\n'
              + `--- 现场 ---\n${diag.out}${diag.err}`;
          })());

        // 4) 进程组里不能还剩**活着的**（非僵尸）成员 —— 脚本 + sleep 都在同一个组里
        assert.strictEqual(snap.group, 0, `进程组 ${wslPid} 里还有 ${snap.group} 个活着的成员`);

        // 5) alive 标记还在 → 说明是被**杀死**的，不是自然跑完（自然跑完会自己删掉它）
        assert.strictEqual(snap.marker, 'PRESENT',
          `标记 ${aliveMark} 不见了 —— 说明那 60 秒是自然跑完的，取消根本没在它活着的时候发生`);

        ctx.note(`⑥ 取消安装任务 ${jobId}：canceled，WSL 侧 pid ${wslPid} 已终止（${lastProbe}），进程组内无存活成员`);
      } finally {
        if (jobId) { try { jobs.cancelJob(jobId); } catch { /* ignore */ } }
        // 兜底：万一断言在「进程还活着」那步就炸了，别把那个 sleep 60 留在 WSL 里
        // （按 pid 记录文件整组 KILL —— 脚本自己就是组长，pid == PGID）
        try {
          await wsl(`p=$(cat ${pidFile} 2>/dev/null || true); `
            + 'if [ -n "$p" ]; then kill -KILL -- "-$p" 2>/dev/null || true; kill -KILL "$p" 2>/dev/null || true; fi; '
            + `rm -f ${pidFile} ${aliveMark}`);
        } catch { /* ignore */ }
      }
    },
  },
  {
    name: '⑦ 日志被裁剪后 ?lastEventId 落在空洞里 → 先发 gap 再补发（实测 20050 行）',
    run: async (ctx) => {
      const jobs = await import('../lib/jobs.mjs');
      const N_LINES = 20050;          // 内存上限是 20000 行（lib/jobs.mjs:MAX_LOG_LINES），超出丢最旧

      let jobId = null;
      try {
        const job = jobs.enqueueSetup({
          actionId: 'cg.gap-probe',
          title: `日志裁剪测试（${N_LINES} 行）`,
          steps: [{
            kind: 'exe',
            label: `打印 ${N_LINES} 行`,
            exe: process.execPath,
            args: ['-e', `for (let i = 0; i < ${N_LINES}; i++) console.log('L' + i)`],
            timeoutMs: 180000,
          }],
        });
        jobId = job.id;
        ARTIFACTS.jobIds.add(jobId);

        const t0 = Date.now();
        let s = null;
        while (Date.now() - t0 < 180000) {
          s = jobs.getSummary(jobId);
          if (['done', 'failed', 'canceled'].includes(s.status)) break;
          await ctx.sleep(300);
        }
        assert.strictEqual(s.status, 'done', `任务状态 ${s.status}（期望 done）`);
        assert.ok(s.lines > 20000, `任务只产出了 ${s.lines} 行，没超过内存上限 20000 —— 裁剪分支根本没被触发`);

        // 全量重放：内存里只剩最后 20000 行 → 首行的 n 必然 > 1（前面被丢掉了）
        const full = [];
        jobs.subscribe(jobId, (e) => full.push(e), { from: 0 });
        const lines = full.filter((e) => e.type === 'line');
        assert.strictEqual(lines.length, 20000, `内存里应只剩 20000 行，实际 ${lines.length}`);
        const firstN = lines[0].n;
        assert.ok(firstN > 2, `首行序号是 ${firstN}，说明没有发生裁剪，这条用例没验到东西`);

        // 续传：请求一个落在空洞里的 lastEventId
        const from = 1;
        const inc = [];
        jobs.subscribe(jobId, (e) => inc.push(e), { from });
        const gap = inc.find((e) => e.type === 'gap');
        assert.ok(gap,
          `从 ${from} 续传时没有发 gap 事件（保留的首行 n=${firstN}，中间缺了 ${firstN - from - 1} 行）`
          + ' —— 客户端会以为中间没丢');
        assert.strictEqual(gap.from, from + 1, `gap.from=${gap.from}`);
        assert.strictEqual(gap.to, firstN - 1, `gap.to=${gap.to}（期望 ${firstN - 1}）`);
        assert.strictEqual(gap.dropped, firstN - from - 1, `gap.dropped=${gap.dropped}`);
        assert.strictEqual(inc.indexOf(gap), 0, 'gap 事件不是第一个 —— 客户端会先看到行、再看到缺口说明');

        const incLines = inc.filter((e) => e.type === 'line');
        assert.deepStrictEqual(incLines.map((e) => e.n), lines.map((e) => e.n), 'gap 之后补发的行不对');

        ctx.note(`⑦ 产出 ${s.lines} 行 → 内存裁剪到 20000（首行 n=${firstN}）；`
          + `从 ${from} 续传先发 gap(${gap.from}→${gap.to}，丢 ${gap.dropped} 行)，再补 ${incLines.length} 行`);
      } finally {
        if (jobId) { try { jobs.cancelJob(jobId); } catch { /* ignore */ } }
      }
    },
  },
  {
    // ★ 这条补的是 test/README.md「没覆盖什么」里的「落盘上限 / 轮转」。
    //   上一条（⑦ 内存裁剪）验的是 lib/jobs.mjs 的**内存**上限（20000 行），这条验的是
    //   lib/store.mjs 的**落盘**轮转（单任务 4MB 截断）—— 两者的触发路径完全不同
    //   （jobs.mjs 的 splice vs store.mjs 的 rotate），别把前者当后者。
    //   真按真实上限写满一次，断言：轮转真的发生 / 标记行真的写进去了 / 序号仍连续（可续传）。
    name: '⑦ 落盘轮转：单任务日志超 4MB 被截断，标记行就位且序号仍连续（可续传）',
    run: async (ctx) => {
      const store = await import('../lib/store.mjs');
      const CAPS = store.CAPS;

      const id = `__fp-rot-${process.pid}-${Date.now().toString(36)}`;
      const file = path.join(CONSOLE_LOGS, `${id}.jsonl`);
      ARTIFACTS.jobIds.add(id);          // 跑完由 cleanupArtifacts 删掉 logs/<id>.jsonl

      try {
        const loaded = store.loadIndex();
        assert.strictEqual(loaded.ready, true, `store 未就绪（${loaded.error || '未知'}）—— 落盘轮转验不了`);
        store.dropLog(id);               // 清掉可能的同名残留

        // 每条记录 ≈ 2KB：写 2400 条 ≈ 4.8MB，足以在 4MB 处触发**恰好一次**轮转
        const big = 'y'.repeat(2048);
        const N = 2400;
        for (let i = 1; i <= N; i++) {
          store.appendLog(id, { n: i, stream: 'stdout', line: `${i}:${big}`, t: Date.now() });
        }

        const size = fs.statSync(file).size;
        // ① 轮转真的发生：文件不再超过单任务上限
        assert.ok(size <= CAPS.perJobLogBytes,
          `轮转后文件仍有 ${size} 字节，超过单任务上限 ${CAPS.perJobLogBytes}`);
        assert.ok(size < N * (big.length + 64),
          `文件大小 ${size} 与写入量相当，说明轮转根本没发生`);

        const recs = store.loadLogs(id);
        assert.ok(recs.length > 0, '轮转后读不回任何日志');

        // ② 标记行真的写进去了：必须是第一条、stream='meta'、且说清丢了多少字节
        const marker = recs[0];
        assert.strictEqual(marker.stream, 'meta', `轮转后第一条不是标记行（stream=${marker.stream}）`);
        assert.match(marker.line, /超过 4MB 上限，已丢弃最旧的 \d+ 字节/, `标记行内容不对：${marker.line}`);
        assert.ok(marker.n > 1, `标记行 n=${marker.n}，说明最旧的日志一条都没丢 —— 这条用例没验到东西`);

        // 标记行的 n 必须 = 第一条保留行的 n - 1（lib/store.mjs:rotate 的约定）
        const kept = recs.slice(1);
        assert.ok(kept.length > 0, '标记行之后一条日志都没有');
        assert.strictEqual(marker.n, kept[0].n - 1,
          `标记行 n=${marker.n}，首条保留行 n=${kept[0].n}（应差 1）`);

        // ③ 序号连续、不跳号 —— 续传靠的就是这个
        for (let i = 1; i < recs.length; i++) {
          assert.strictEqual(recs[i].n, recs[i - 1].n + 1,
            `序号不连续：第 ${i - 1} 条 n=${recs[i - 1].n} → 第 ${i} 条 n=${recs[i].n}`);
        }
        // 保最新：最后一条就是最后写入的那条
        assert.strictEqual(recs[recs.length - 1].n, N, `最后一条 n=${recs[recs.length - 1].n}，期望 ${N}`);

        // ④ 续传语义：lib/jobs.mjs:subscribe 的 gap 判据是「保留的首行 n > from + 1」。
        //    客户端已经收到过标记行（lastEventId = marker.n）之后再续传，必须**不发 gap、不重不漏**。
        const from = marker.n;
        const firstN = recs[0].n;
        assert.ok(!(firstN > from + 1),
          `从标记行之后续传会被判成有缺口（firstN=${firstN} > from+1=${from + 1}）—— 客户端会多报一次 gap`);
        assert.deepStrictEqual(recs.filter((r) => r.n > from).map((r) => r.n), kept.map((r) => r.n),
          '续传补发的行与保留行不一致（重发或漏发）');

        ctx.note(`⑦ 落盘轮转：写 ${N} 条 ≈ ${((N * (big.length + 64)) / 1048576).toFixed(1)}MB → 轮转到 `
          + `${(size / 1048576).toFixed(2)}MB（单任务上限 ${(CAPS.perJobLogBytes / 1048576).toFixed(0)}MB）；`
          + `标记行 n=${marker.n}，首条保留行 n=${kept[0].n}，共 ${recs.length} 条、序号连续到 ${recs[recs.length - 1].n}`);
      } finally {
        try { store.dropLog(id); } catch { /* ignore */ }
        try { fs.unlinkSync(file); } catch { /* ignore */ }
      }
    },
  },
  {
    // ★ 补 test/README.md「没覆盖什么」里的第二条：lib/store.mjs 的 **64MB 日志总量裁剪**。
    //   ⑦ 验的是单任务 4MB 轮转（rotate），这条验的是 saveIndex 的第 ② 段（总量裁剪）——
    //   是**两条完全不同的代码路径**，别把前者当后者。
    //   真按**真实上限**造数据（40 × 2MB = 80MB > 64MB），断言：
    //   最旧的被裁掉 / 最新的保留 / 索引与实际文件一致 / 没有孤儿日志。
    //   ⚠️ 会往 D:\lemo-films\.console 写 ~80MB 测试数据并覆写 index.json ——
    //      跑前备份 index.json，finally 里把测试文件删干净、index.json 原样还原。
    name: '⑧ 落盘总量裁剪：日志总量超 64MB 时从最旧开始丢（索引与文件一致，无孤儿）',
    run: async (ctx) => {
      const store = await import('../lib/store.mjs');
      const CAPS = store.CAPS;
      const loaded = store.loadIndex();
      assert.strictEqual(loaded.ready, true, `store 未就绪（${loaded.error || '未知'}）—— 总量裁剪验不了`);

      const logFile = (id) => path.join(CONSOLE_LOGS, `${id}.jsonl`);
      const dirBytes = () => fs.readdirSync(CONSOLE_LOGS, { withFileTypes: true })
        .filter((e) => e.isFile())
        .reduce((s, e) => { try { return s + fs.statSync(path.join(CONSOLE_LOGS, e.name)).size; } catch { return s; } }, 0);

      const hadIndex = fs.existsSync(CONSOLE_INDEX);
      const indexBackup = hadIndex ? fs.readFileSync(CONSOLE_INDEX) : null;

      const tag = `__fp-total-${process.pid}-${Date.now().toString(36)}`;
      const N = 40;
      const EACH = 2 * 1024 * 1024;
      const ids = [];
      const metas = [];
      for (let i = 1; i <= N; i++) {
        const id = `${tag}-${String(i).padStart(3, '0')}`;
        ids.push(id);
        ARTIFACTS.jobIds.add(id);
        metas.push({ id, slug: '__test-total__', status: 'ended', n: i });
      }

      try {
        const base = dirBytes();
        for (const id of ids) fs.writeFileSync(logFile(id), 't'.repeat(EACH));
        const before = dirBytes();
        assert.ok(before > CAPS.totalLogBytes,
          `测试数据 ${(before / 1048576).toFixed(1)}MB 没超过总量上限 ${(CAPS.totalLogBytes / 1048576).toFixed(0)}MB —— 这条用例没验到东西`);

        store.saveIndex(metas);

        const written = JSON.parse(fs.readFileSync(CONSOLE_INDEX, 'utf8'));
        const kept = Array.isArray(written) ? written : written.jobs;
        assert.ok(Array.isArray(kept), 'saveIndex 写出来的 index.json 里没有 jobs 数组');

        // ① 真的裁了
        assert.ok(kept.length < N, `索引里仍有 ${kept.length} 条（共写入 ${N} 条），总量裁剪没发生`);
        // ② 留下的是**最新的一段**（后缀），最旧的被丢
        const keptIds = kept.map((m) => m.id);
        assert.deepStrictEqual(keptIds, ids.slice(N - keptIds.length),
          `保留的不是最新的一段：${keptIds.slice(0, 3).join(',')} … ${keptIds.slice(-3).join(',')}`);
        const dropped = ids.slice(0, N - keptIds.length);
        assert.ok(dropped.length >= 1, '一条都没被裁掉');

        // ③ 被裁掉的最旧任务，日志文件**真的删了**（不是只从索引里摘掉）
        for (const id of dropped) {
          assert.ok(!fs.existsSync(logFile(id)), `被裁掉的 ${id} 日志文件还在（应由 dropLog 删掉）`);
        }
        // ④ 保留下来的，日志文件都还在
        for (const id of keptIds) {
          assert.ok(fs.existsSync(logFile(id)), `保留的 ${id} 索引在、文件却不在`);
        }
        // ⑤ 索引与实际文件一致：logs 下不该有「本次测试前缀、但索引里没有」的孤儿
        const orphan = fs.readdirSync(CONSOLE_LOGS)
          .filter((f) => f.startsWith(tag) && !keptIds.includes(f.replace(/\.jsonl$/, '')));
        assert.deepStrictEqual(orphan, [], `留下孤儿日志文件：${orphan.join(', ')}`);

        // ⑥ 总量确实压回上限以内（用户既有日志本身没超上限时才成立）
        const after = dirBytes();
        if (base <= CAPS.totalLogBytes) {
          assert.ok(after <= CAPS.totalLogBytes,
            `裁剪后总量仍有 ${(after / 1048576).toFixed(1)}MB，超过 ${(CAPS.totalLogBytes / 1048576).toFixed(0)}MB`);
        }
        assert.strictEqual(after, base + keptIds.length * EACH,
          `裁剪后总量 ${after} ≠ base(${base}) + 保留(${keptIds.length})×${EACH}`);

        ctx.note(`⑧ 总量裁剪：造 ${N}×2MB=${(before / 1048576).toFixed(1)}MB（用户既有 ${(base / 1048576).toFixed(2)}MB）`
          + ` → 裁掉最旧 ${dropped.length} 条，保留最新 ${keptIds.length} 条，总量回到 ${(after / 1048576).toFixed(1)}MB`);
      } finally {
        for (const id of ids) {
          try { fs.unlinkSync(logFile(id)); } catch { /* ignore */ }
          ARTIFACTS.jobIds.delete(id);       // 文件已自己删干净，别让 cleanupArtifacts 再动一次
        }
        try {
          if (indexBackup) fs.writeFileSync(CONSOLE_INDEX, indexBackup);
          else fs.unlinkSync(CONSOLE_INDEX);
        } catch { /* ignore */ }
      }
    },
  },
  {
    // ★ 补 test/README.md「没覆盖什么」里的第三条：lib/store.mjs 的 **120 条索引上限**。
    //   saveIndex 的第 ① 段：条数超上限时从**最旧**开始丢（并同步 dropLog 删文件）。
    //   断言：最旧的被永久删除 / 最近的保留 / **没有留下孤儿日志文件**。
    name: '⑨ 索引条数上限：超过 120 条时最旧的被永久删除，且不留孤儿日志文件',
    run: async (ctx) => {
      const store = await import('../lib/store.mjs');
      const CAPS = store.CAPS;
      const loaded = store.loadIndex();
      assert.strictEqual(loaded.ready, true, `store 未就绪（${loaded.error || '未知'}）—— 条数上限验不了`);

      const logFile = (id) => path.join(CONSOLE_LOGS, `${id}.jsonl`);
      const dirBytes = () => fs.readdirSync(CONSOLE_LOGS, { withFileTypes: true })
        .filter((e) => e.isFile())
        .reduce((s, e) => { try { return s + fs.statSync(path.join(CONSOLE_LOGS, e.name)).size; } catch { return s; } }, 0);

      const hadIndex = fs.existsSync(CONSOLE_INDEX);
      const indexBackup = hadIndex ? fs.readFileSync(CONSOLE_INDEX) : null;

      const tag = `__fp-cap-${process.pid}-${Date.now().toString(36)}`;
      const N = CAPS.maxPersistJobs + 10;      // 130 条（超上限 10 条）
      const EACH = 512;                        // 小日志，避免顺带撞上 64MB 总量裁剪
      const ids = [];
      const metas = [];
      for (let i = 1; i <= N; i++) {
        const id = `${tag}-${String(i).padStart(3, '0')}`;
        ids.push(id);
        ARTIFACTS.jobIds.add(id);
        metas.push({ id, slug: '__test-cap__', status: 'ended', n: i });
      }

      try {
        const base = dirBytes();
        // 前提：这点数据远不到 64MB，所以本用例走的**只**是条数裁剪那条路径，不会被总量裁剪混淆
        assert.ok(base + N * EACH < CAPS.totalLogBytes,
          `测试数据 ${((base + N * EACH) / 1048576).toFixed(2)}MB 撞上了总量上限 ${(CAPS.totalLogBytes / 1048576).toFixed(0)}MB —— 两条裁剪路径会混淆`);

        for (const id of ids) fs.writeFileSync(logFile(id), 'c'.repeat(EACH));
        store.saveIndex(metas);

        const written = JSON.parse(fs.readFileSync(CONSOLE_INDEX, 'utf8'));
        const kept = Array.isArray(written) ? written : written.jobs;
        assert.ok(Array.isArray(kept), 'saveIndex 写出来的 index.json 里没有 jobs 数组');

        // ① 条数被压到上限
        assert.strictEqual(kept.length, CAPS.maxPersistJobs,
          `索引里有 ${kept.length} 条，期望上限 ${CAPS.maxPersistJobs} 条`);
        // ② 保留的是**最新的 120 条**（后缀）
        const keptIds = kept.map((m) => m.id);
        assert.deepStrictEqual(keptIds, ids.slice(N - CAPS.maxPersistJobs),
          `保留的不是最新的 ${CAPS.maxPersistJobs} 条：${keptIds.slice(0, 3).join(',')} … ${keptIds.slice(-3).join(',')}`);
        const dropped = ids.slice(0, N - CAPS.maxPersistJobs);   // 最旧的 10 条

        // ③ 最旧的被**永久删除**（文件 + 索引条目都没了）
        for (const id of dropped) {
          assert.ok(!fs.existsSync(logFile(id)), `最旧的 ${id} 日志文件没被删掉（应是永久删除）`);
          assert.ok(!keptIds.includes(id), `最旧的 ${id} 仍在索引里`);
        }
        // ④ 保留的，文件都还在
        for (const id of keptIds) {
          assert.ok(fs.existsSync(logFile(id)), `保留的 ${id} 索引在、文件却不在`);
        }
        // ⑤ ★ 没有孤儿：logs 目录里本次测试的文件数必须**正好等于**索引里的条数
        const mine = fs.readdirSync(CONSOLE_LOGS).filter((f) => f.startsWith(tag));
        assert.strictEqual(mine.length, CAPS.maxPersistJobs,
          `logs 下本次测试的文件有 ${mine.length} 个，索引里只有 ${keptIds.length} 条 —— 留下了孤儿日志`);
        const orphan = mine.filter((f) => !keptIds.includes(f.replace(/\.jsonl$/, '')));
        assert.deepStrictEqual(orphan, [], `孤儿日志文件：${orphan.join(', ')}`);

        ctx.note(`⑨ 条数上限：写 ${N} 条 → 索引保留最新 ${kept.length} 条，最旧 ${dropped.length} 条连文件一起永久删除，logs 下无孤儿`);
      } finally {
        for (const id of ids) {
          try { fs.unlinkSync(logFile(id)); } catch { /* ignore */ }
          ARTIFACTS.jobIds.delete(id);
        }
        try {
          if (indexBackup) fs.writeFileSync(CONSOLE_INDEX, indexBackup);
          else fs.unlinkSync(CONSOLE_INDEX);
        } catch { /* ignore */ }
      }
    },
  },
];

// ── ⑤+++/⑤++++/⑤+++++ 的公共夹具：一个「极小的假口播素材」───────────
//
// ★ 为什么必须**现造**而不是在仓里放一份：`*.mp4` 一律不入库（成片与素材都按「非 C 盘、
//   不提交」处理），而且本项目的纪律是「测试自己造输入、跑完自己清掉」。
// ★ 为什么必须**带音轨**：`--keep-original` 的混流命令用 `-map 0:a?` / `[0:a]`，
//   无声素材会让「音轨逐字节相同」这条断言**无从谈起**（连音轨都没有）。
// ★ 为什么在 WSL 里造：Windows 侧**没有 ffmpeg**（`which ffprobe` 无结果，实测），
//   只能走 WSL 的 `lavfi` 虚拟源。这一步造的是**输入素材**，不是出片 —— 不占 GPU、不跑 TTS。
// ★ 为什么尺寸是 270x480 / 1.6s：h264 要求宽高都是偶数；1.6s 让编码与混流都落在亚秒级。
// ★★ 为什么音轨要推到满刻度（`volume=20.8dB`）：ffmpeg 的 `sine` 源默认只有 −20.8 dBFS，
//   而交付线是 `HARD_PEAK_LIMIT = −1.2 dBTP`。素材自身**必须**超标，否则
//   `--keep-original-limit` 那条断言「限幅把真峰值压进交付线」就是**空转**
//   （素材本来就在线内，限不限都过）—— 所以夹具的峰值本身就是判据的一半，
//   两个用例里都各有一条 `srcTruePeak > HARD_PEAK_LIMIT` 的守卫断言盯着它。
const KO_W = 270, KO_H = 480, KO_DUR = 1.6;
const KO_TEXT = '这是保留原声原画的测试。画面和声音都不改。';
/** 夹具的 SRT（两条 cue，正好铺满素材时长）—— 给 `--srt` 用，绕开 ASR。
 *  ★ 文本**故意与文案不同**：`--keep-original` 的契约是「`--srt` 只提供**时间轴**，
 *    字幕文本一律用**文案**」（见 `lib/dub-core.mjs` 的「字幕文本一律用文案」那条）。
 *    若两边文本写成一样，「字幕逐字等于文案」这条断言就**分不清**成片字幕到底取自哪一边
 *    —— 那是一条假绿。故意写不一样，才让「文本来自文案」成为**可证伪**的。
 *    （文本认不出不影响取时间：`alignCuesToSentences` 对认不出的句子按字数比例分配 cue 区间。） */
const KO_SRT = '1\n00:00:00,000 --> 00:00:00,800\n占位文本甲（SRT 只提供时间轴）\n\n'
  + '2\n00:00:00,800 --> 00:00:01,600\n占位文本乙\n';

/** `D:\a\b` → `/mnt/d/a/b`（WSL 侧路径）。 */
function toWsl(p) {
  const s = String(p);
  return `/mnt/${s[0].toLowerCase()}${s.slice(2).replace(/\\/g, '/')}`;
}

/** 造一个「有画面 + 有音轨」的极小假口播素材到 hostPath（Windows 路径）。 */
function makeDubMaterial(hostPath) {
  return wsl([
    'ffmpeg -hide_banner -nostdin -y',
    `  -f lavfi -i "color=c=0x203040:s=${KO_W}x${KO_H}:r=30:d=${KO_DUR}"`,
    `  -f lavfi -i "sine=f=440:r=48000:d=${KO_DUR}"`,
    '  -af "volume=20.8dB"',
    '  -c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p',
    '  -c:a aac -b:a 96k -ar 48000 -ac 2',
    '  -shortest -movflags +faststart',
    `  "${toWsl(hostPath)}"`,
  ].join(' \\\n'), { timeoutMs: 180000 });
}

/**
 * ffprobe 一个媒体文件 → `{ v, a, dur }`（视频流 / 音轨 / 总时长；读不到给 null）。
 * ★ `stream` 里**连 duration 一起取**：`⑤++++++` 要断言「成片音轨的时长 ≈ 配音总时长」
 *   （素材原声只有 2.0s，成片音轨 ~8.4s ⇒ 光凭时长就能排除「音轨是素材原声」这一种退化）。
 *   多取一个字段对既有调用方（只读 `.width/.height/.codec_type`）无影响。
 */
async function probeMedia(hostPath) {
  const r = await wsl('ffprobe -v error -show_entries stream=codec_type,width,height,codec_name,duration '
    + `-show_entries format=duration -of json "${toWsl(hostPath)}"`, { timeoutMs: 120000 });
  let j = null;
  try { j = JSON.parse(String(r.out)); } catch { return null; }
  const streams = Array.isArray(j.streams) ? j.streams : [];
  return {
    v: streams.find((s) => s.codec_type === 'video') || null,
    a: streams.find((s) => s.codec_type === 'audio') || null,
    dur: Number(j.format && j.format.duration),
  };
}

/**
 * **独立**量一个文件的真峰值 / 集成响度（WSL 的 `loudnorm` + `ebur128`，口径与 `dub.mjs` 一致）。
 * ★ 刻意不用工具自己打印的那个数 —— 那条是「自述」，判据要落在**成片实物**上。
 * ★★ 两个响度口径都要给，**判据必须落在 `ebur128` 上**：
 *   · `ebur128` = `ebur128=peak=true` 的集成响度 `I:` —— 这是**项目权威口径**
 *     （`dub.mjs` 的 `measure()` 用它算 `lufs`，`check-film-delivery` / `check-lra-caliber` 也用它）。
 *   · `lufs` = `loudnorm` 的 `input_i` —— **另一个口径**。长片（40–60s 样板片）上两者实测差 ≤0.06 LU，
 *     但**短片 + 含静音**时可以拉开（本轮实测同一部 8.4s 成片：ebur128 −14.0 / loudnorm −14.09；
 *     而另一次运行 loudnorm 读到 −15.1，ebur128 仍在 −14.x）⇒ 拿 `input_i` 去对「风格目标」是
 *     **口径错配**，会把「读数差异」误判成「归一没做对」。
 */
async function measureLoud(hostPath) {
  const r = await wsl('ffmpeg -hide_banner -nostdin -i '
    + `"${toWsl(hostPath)}" -af loudnorm=print_format=json -f null - 2>&1\n`
    + 'ffmpeg -hide_banner -nostdin -i '
    + `"${toWsl(hostPath)}" -af ebur128=peak=true -f null - 2>&1 | grep -E 'I: ' | tail -1`,
  { timeoutMs: 180000 });
  const t = `${r.out}${r.err}`;
  const tp = /"input_tp"\s*:\s*"(-?[\d.]+)"/.exec(t);
  const i = /"input_i"\s*:\s*"(-?[\d.]+)"/.exec(t);
  const eb = /I:\s*(-?[\d.]+)\s*LUFS/.exec(t);
  return {
    tp: tp ? Number(tp[1]) : null,
    lufs: i ? Number(i[1]) : null,          // loudnorm 口径（参考）
    ebur128: eb ? Number(eb[1]) : null,     // ★ 项目权威口径（判据用这个）
  };
}

/**
 * 把两个文件的音轨各自解成 PCM（48k / 立体声 / s16）再算 md5，返回 `[md5A, md5B]`。
 * ★ 这是「音轨有没有被偷偷重编码 / 替换」的**硬证据**：`-c:a copy` 下解码结果必然逐字节
 *   相同，重编码（`--keep-original-limit`）则必然不同。判据与 `dub.mjs` 自检那一段同口径
 *   （它也是「解成 PCM 再比 md5」），但这里是**测试自己独立算**，不采信工具自述。
 */
async function audioPcmMd5Pair(hostA, hostB) {
  const t = `/tmp/ko-pcm-${process.pid}-${Date.now().toString(36)}`;
  const r = await wsl([
    `ffmpeg -v error -y -i "${toWsl(hostA)}" -vn -c:a pcm_s16le -ar 48000 -ac 2 -f wav ${t}a.wav`,
    `ffmpeg -v error -y -i "${toWsl(hostB)}" -vn -c:a pcm_s16le -ar 48000 -ac 2 -f wav ${t}b.wav`,
    `md5sum ${t}a.wav ${t}b.wav`,
    `rm -f ${t}a.wav ${t}b.wav`,
  ].join('\n'), { timeoutMs: 180000 });
  return String(r.out).trim().split('\n')
    .map((l) => l.trim().split(/\s+/)[0]).filter((h) => /^[0-9a-f]{32}$/.test(h));
}

/**
 * 读 `film.srt`，把每条字幕的**正文**拼起来（去空白）—— 「字幕逐字等于文案」的判据。
 * ★ 与 `⑤++` 用例里内联的那段**同口径**（那边是 `srtBlocks` / `srtJoined` / `stripWs2`）：
 *   比「拼接后」而不是「逐条」，因为怎么切句是编排的自由，但**内容一个字都不能变**。
 */
function srtJoinedText(srtPath) {
  const blocks = fs.readFileSync(srtPath, 'utf8').split(/\n\s*\n/)
    .map((b) => b.split('\n').slice(2).join(' ').trim()).filter(Boolean);
  return { blocks, joined: blocks.map((s) => s.replace(/\s+/g, '')).join('') };
}

// ── ⑤++++++ / ⑤+++++++ 的公共夹具：一个「亮度随时间爬升」的假口播素材 ──────────
//
// ★★ 为什么画面必须是「随时间变化的亮度」——这是本轮最关键的一处设计：
//   `--fit loop|trim|slow` 三者的**成片时长完全相同**（`dub.mjs` 的混流一律 `-t total`，
//   见 `dub.mjs` 第 [6] 步的 mux；loop 靠 `-stream_loop -1`、trim 靠 `tpad` 补到 total、
//   slow 靠 `setpts` 拉长到 total）⇒ **时长与帧数都不是判据**，写「三者时长不同」就是恒真断言。
//   三者的真实差别**全在画面内容**：
//     · loop → 素材被**循环**（成片第 t 秒取素材第 t mod D 秒）
//     · trim → 素材放完后**冻结末帧**（成片第 t≥D 秒都取素材最后一帧）
//     · slow → 素材被**整体放慢**（成片第 t 秒取素材第 t·D/T 秒）
//   要让这个差别**可观测**，素材必须「每一时刻的画面都不同」⇒ 用一条 0→255 的**亮度斜坡**，
//   于是「成片某一帧的亮度」就是「素材被取到了哪一时刻」的一把刻度尺（实测该斜坡单调递增，
//   见下面 `FIT_RAMP_NOTE`）。判据因此可以写成「成片逐帧亮度剖面 == 某一种 fit 的语义模型」。
//
// ★ 为什么音轨是 **15 kHz 纯音**：用来证明成片音轨**来自 TTS、不是素材原声**。
//   TTS 语音在 15 kHz 处几乎没有能量（实测成片该带 mean −56.8 dB），而素材原声在这里是
//   **−3.7 dB**（推到满刻度）⇒ 「成片 15 kHz 带内电平很低」是一条**可证伪**的判据：
//   若实现退化成把素材原声混进成片（例如误开 `--keep-original-audio`），它会当场 FAIL。
//
// ★ 为什么素材是 270x480 / 2.0s 而输出点名 `--ratio 16:9`（=1920x1080）：
//   两者尺寸**故意不同** ⇒ 「成片尺寸按 `--ratio` 而不是素材尺寸」成为**可证伪**的断言
//   （若成片是 270x480，说明 `--size`/`--ratio` 没生效）。
//   素材只有 2.0s 而配音 ~8.4s ⇒ 三条 fit 分支（都要求 srcDur < total）**必然**被走到。
const FIT_W = 270, FIT_H = 480, FIT_DUR = 2.0, FIT_TONE_HZ = 15000;
const FIT_OUT_W = 1920, FIT_OUT_H = 1080;      // `--ratio 16:9` 的默认像素（唯一来源：core/render/size.mjs）
const FIT_RATIO = '16:9';
// ★ 文案约 51 字 ⇒ TTS 实测 total ≈ 8.2–8.4s（素材的 4 倍多）⇒ 斜坡上「三种 fit 取到不同时刻」
//   的差异足够大（实测三种模型的逐帧剖面两两平均差 ≈ 94–102 灰度）。
const FIT_TEXT = '这是一次形态B与配音时长适配的真实出片测试。画面用口播素材铺满，声音来自本地合成，字幕逐字等于文案。';
// ★ 必须挑一个 style-dna 的 `targetLufs ≠ 通用默认`（−16）的风格，否则「响度 −14±1」这条
//   判据与走默认无法区分（与 `⑤++` 同口径）。engraving 的 mix_rules 写「整体 −14 LUFS」。
const FIT_STYLE = 'engraving';

/**
 * 造「亮度爬升 + 15 kHz 纯音」的极小假口播素材到 hostPath（Windows 路径）。
 *
 * 全部参数都可覆盖（默认值 = 原来那一份 270x480 / 2.0s / 全程 15 kHz，既有调用点一个字没变）：
 *   · `dur`   —— 素材时长（反向分支用例要一个**比旁白长**的素材；atempo 用例要一个**很短**的素材）
 *   · `toneOnset` —— 音调**起始时刻**（秒）。>0 时前面那段是数字静音（`afade=t=in` 的 st 之前增益恒 0，
 *     实测带内 mean_volume = −91 dB = 16 bit 的量化噪声底）。
 *     ★ 为什么需要「音调晚一点开始」：`--fit slow` 会把素材**原声**按 ratio 一起 atempo 放慢
 *       ⇒ 「音调从第几秒开始」就是「atempo 到底把原声拉长了没有」的一把刻度尺（见 ⑤+++++++++）。
 */
function makeFitMaterial(hostPath, {
  dur = FIT_DUR, w = FIT_W, h = FIT_H, toneHz = FIT_TONE_HZ, toneOnset = 0,
} = {}) {
  const af = toneOnset > 0
    ? `afade=t=in:st=${toneOnset}:d=0.02,volume=20.8dB`   // st 之前增益恒 0 ⇒ 数字静音
    : 'volume=20.8dB';
  return wsl([
    'ffmpeg -hide_banner -loglevel error -nostdin -y',
    `  -f lavfi -i "color=c=black:s=${w}x${h}:r=30:d=${dur}"`,
    `  -f lavfi -i "sine=f=${toneHz}:r=48000:d=${dur}"`,
    `  -vf "geq=lum='255*T/${dur}':cb=128:cr=128,format=yuv420p"`,
    `  -af "${af}"`,
    '  -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p',
    '  -c:a aac -b:a 96k -ar 48000 -ac 2',
    '  -shortest -movflags +faststart',
    `  "${toWsl(hostPath)}"`,
  ].join(' \\\n'), { timeoutMs: 180000 });
}

// ── ⑤++++++++ / ⑤+++++++++ 的夹具常量 ──────────────────────────
// ★ 反向分支（素材 ≥ 旁白）：素材**必须比旁白长**，否则三条 fit 分支一条都走不到。
//   文案刻意取短（约 25 字 ⇒ TTS 实测 total ≈ 4s），素材给 9.0s ⇒ 留 2 倍以上余量
//   （TTS 时长有抖动，余量不够会让用例**偶发**掉进正向分支 —— 那样断言就不是在测反向分支了）。
const FITR_DUR = 9.0;
const FITR_TEXT = '反向分支：素材比旁白更长，画面只取素材开头的一段。';
// ★ atempo 链：素材**必须比旁白短很多**。ratio = total/srcDur > 2 才逼出多级
//   （单级 atempo 的合法范围是 [0.5, 100]，ratio>2 ⇒ 需要的 tempo < 0.5 ⇒ 一级放不下）。
//   1.0s 素材 + 约 51 字文案（total ≈ 8.4s）⇒ ratio ≈ 8.4 ⇒ 链长 4 级。
const FITB_DUR = 1.0, FITB_TONE_ONSET = 0.6;

/**
 * 把整片解成「**每帧 1 个像素的灰度**」→ 返回长度 = 帧数的数组（第 i 项 = 第 i 帧的均值灰度）。
 * ★ 为什么整片一次抽完、按帧对齐，而不是逐点 `-ss` 取帧：`-ss` 的定位有亚帧误差，
 *   而三种 fit 的差异要靠**逐帧剖面**比对（斜坡斜率实测 ~174 灰度/秒 ⇒ 0.1s 误差 = 17 灰度）。
 *   一次抽完既没有 seek 误差、也只需一次 ffmpeg 调用。
 * ★ 为什么走**文件**而不是 stdout：二进制过 WSL stdout 会被损坏（`lib/env.mjs` 的同类注释）。
 *   临时文件写在 `scratchDir`（用例的 `_smoke-` 输出目录）里 ⇒ 随该目录一起被 `cleanupArtifacts` 收掉。
 */
async function frameProfile(hostPath, scratchDir) {
  const rawHost = path.join(scratchDir, `_prof-${Math.random().toString(36).slice(2)}.raw`);
  const r = await wsl('ffmpeg -v error -nostdin -y -i '
    + `"${toWsl(hostPath)}" -vf "scale=1:1,format=gray" -f rawvideo -pix_fmt gray "${toWsl(rawHost)}"`,
  { timeoutMs: 180000 });
  if (!r.ok) return null;
  try { return Array.from(fs.readFileSync(rawHost)); } catch { return null; }
}

/** 某窄带内的平均电平（dB）——「素材原声是 15 kHz 纯音、成片里没有它」的判据。 */
async function bandMeanDb(hostPath, f, widthHz = 2000) {
  const r = await wsl(`ffmpeg -hide_banner -nostdin -i "${toWsl(hostPath)}" `
    + `-af "bandpass=f=${f}:width_type=h:w=${widthHz},volumedetect" -f null - 2>&1 | grep mean_volume`,
  { timeoutMs: 180000 });
  const m = /mean_volume:\s*(-?[\d.]+|-inf)\s*dB/.exec(`${r.out}${r.err}`);
  if (!m) return null;
  return m[1] === '-inf' ? -Infinity : Number(m[1]);
}

/**
 * 同上的**带内**平均电平，但只看 `[t0, t1)` 这一段（用来给「原声在成片里的**时间位置**」做判据）。
 * ★ 用 `atrim` 而不是 `-ss/-t`：`-ss` 的定位有亚帧误差，而这里要卡的是「音调从第几秒开始」
 *   （⑤+++++++++ 里两个窗口之间隔了 2 秒以上，误差量级完全够用，但 atrim 更干净）。
 */
async function bandMeanDbWindow(hostPath, f, t0, t1, widthHz = 2000) {
  const r = await wsl(`ffmpeg -hide_banner -nostdin -i "${toWsl(hostPath)}" `
    + `-af "atrim=${t0}:${t1},bandpass=f=${f}:width_type=h:w=${widthHz},volumedetect" -f null - 2>&1 | grep mean_volume`,
  { timeoutMs: 180000 });
  const m = /mean_volume:\s*(-?[\d.]+|-inf)\s*dB/.exec(`${r.out}${r.err}`);
  if (!m) return null;
  return m[1] === '-inf' ? -Infinity : Number(m[1]);
}

// ── `--fit` 三值的**语义模型** + 剖面统计量（纯 JS，不占 GPU）──────────────────
//
// 给定素材的逐帧剖面 M（长度 Nm）与成片的帧数 No，三种 fit 各自的「成片第 i 帧应当等于素材第几帧」：
//   loop: 素材被循环          → 素材帧号 = i mod Nm
//   trim: 素材放完后冻结末帧  → 素材帧号 = min(i, Nm-1)
//   slow: 素材被放慢 No/Nm 倍 → 素材帧号 = floor(i · Nm / No)
// ★ 这三条**不是**从被测实现反推出来的，而是从「循环 / 冻结末帧 / 整体放慢」三个词的定义直接写出，
//   与被测实现相互独立 ⇒ 「实测剖面与哪一条最贴合」可以反过来检验实现走的是哪条分支。
const FIT_MODELS = {
  loop: (M, i) => M[i % M.length],
  trim: (M, i) => M[Math.min(i, M.length - 1)],
  slow: (M, i, No) => M[Math.min(M.length - 1, Math.floor((i * M.length) / No))],
};
const fitMae = (O, M, kind) => {
  let s = 0;
  for (let i = 0; i < O.length; i++) s += Math.abs(O[i] - FIT_MODELS[kind](M, i, O.length));
  return s / O.length;
};
/** 下降沿计数：相邻两帧亮度骤降 > 150 ⇒ 「画面又从头开始了」——loop 独有的结构特征。 */
const fitDownEdges = (O) => {
  let n = 0;
  for (let i = 1; i < O.length; i++) if (O[i] - O[i - 1] < -150) n++;
  return n;
};
/** 最大回落：相邻两帧亮度最多回落多少（单调不减的剖面 → 很小）。 */
const fitMaxFallback = (O) => {
  let m = 0;
  for (let i = 1; i < O.length; i++) m = Math.max(m, O[i - 1] - O[i]);
  return m;
};
/** 末 frac 段的最小亮度（trim 冻结在素材最高亮度 ⇒ 很大；slow 还没爬到顶 ⇒ 明显更小）。 */
const fitTailMin = (O, frac) => Math.min(...O.slice(Math.floor(O.length * (1 - frac))));
/** 第 frac 比例处的亮度。 */
const fitAt = (O, frac) => O[Math.min(O.length - 1, Math.floor(O.length * frac))];

/**
 * 三种模型**彼此**在**实测素材剖面**上的平均差（区分力守卫）。
 * ★ 必须喂**实测的 M**：若喂一条内部合成的「名义斜坡」，无论真实夹具长什么样它都恒为大值
 *   ⇒ 夹具退化成纯色时守卫**不会响**，本用例就悄悄变成「三者都一样」的恒真断言
 *   （实测过：喂合成斜坡时，纯色夹具下 `sep` 仍是 94–102）。所以这里只收实测剖面。
 */
function fitModelSeparation(M, No) {
  const mk = (kind) => Array.from({ length: No }, (_, i) => FIT_MODELS[kind](M, i, No));
  const d = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / a.length;
  return { 'loop|trim': d(mk('loop'), mk('trim')), 'loop|slow': d(mk('loop'), mk('slow')), 'trim|slow': d(mk('trim'), mk('slow')) };
}

// ── --full 才跑的完整回归 ────────────────────────────────────
// ⑤+ / ⑤++ 走真渲染 + **现场 GPU TTS**（分钟级）；⑤+++ / ⑤++++ / ⑤+++++ 走
// `--keep-original`（明令不跑 TTS）⇒ 不占 GPU、几秒级。
export const FULL_CASES = [
  {
    // ★★ 2026-10-03 修复一处**破坏性副作用**：本用例原来跑 `lemo-make.mjs ascii-crt --skip-sync`
    //   **不给 `--out`** ⇒ 编排器写回默认库路径 `D:\lemo-films\ascii-crt\ascii-crt.mp4`，
    //   **把已交付的成片覆盖掉了**（实测：交付版是 1920×1080 / 29,712,494 B，
    //   被本用例重渲成 1080×1920 / 21,880,427 B —— 连几何都不一样）。
    //   ⇒ 现在写进 `_smoke-` 前缀的临时目录，并登记进 ARTIFACTS.dirs（cleanupArtifacts 的两道守卫只认这个前缀）。
    //   ★ 断言（exit 0 / MUX_OK / src_frames / out_frames）与输出目录无关，所以改 `--out` 不影响本用例的覆盖力。
    name: '⑤+ 完整回归 ascii-crt --skip-sync → exit 0 且 MUX_OK src/out = 1435',
    run: async (ctx) => {
      const outDir = path.join(CFG.exportDir, `${TEST_DIR_PREFIX}orch-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(outDir, { recursive: true });
      ARTIFACTS.dirs.add(outDir);   // ★ 中途断言失败也要摘干净 —— 收尾由 smoke.mjs 的 finally 统一做
      const r = await runNode(['lemo-make.mjs', 'ascii-crt', '--skip-sync', '--out', outDir], { cwd: ctx.root, timeoutMs: 600000 });
      assert.strictEqual(r.code, 0, `完整回归退出码 ${r.code}（期望 0）\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}\n--- stderr ---\n${r.stderr.slice(-2000)}`);
      assert.match(r.stdout, /MUX_OK/, `输出里没有 MUX_OK\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}`);
      assert.match(r.stdout, /src_frames=1435/, '输出里没有 src_frames=1435');
      assert.match(r.stdout, /out_frames=1435/, '输出里没有 out_frames=1435');
    },
  },
  {
    // ★ 为什么必须有这条（2026-10-03 补的缺口）：
    //   `⑤+` 跑的是「用**预生成**配音混流出片」—— ascii-crt 的 demo 自带 voices/，
    //   音频步根本不会调 TTS。于是**全程不碰 GPU TTS**。而 TTS 这条路径恰恰出过三次真事故
    //   （自死锁 / 显存预检拒载 / 孤儿进程），此前只有 `--dry-run` 与参数级验证撑着，从没被真跑过。
    // ★ 为什么用 dub.mjs 而不是 lemo-make：`targetLufs`（style-dna 的音频响度目标）这条链
    //   **只在 dub.mjs 里接**（lemo-make 读 DNA 只取 grain）。两条链路共用同一个 TTS 执行体
    //   （core/tts/tts_indextts.py），所以「锁 / 显存预检 / 看门狗」这三条也一并覆盖到了。
    name: '⑤++ 现场 TTS（真跑 Index-TTS）+ style-dna 响度目标 → 锁取了又放，成片响度按 DNA 归一',
    run: async (ctx) => {
      const { TARGET_PEAK_PCM, TARGET_LUFS } = await import('../lib/dub-core.mjs');
      const TTS_SLUG = 'engraving';   // 有 style-dna、且其 targetLufs ≠ 通用默认（-16）的风格
      const TTS_TEXT = '这是一次真实的配音合成测试。';
      const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // ── 前置 1：本机真的具备 Index-TTS 执行体 ──
      const ttsPy = path.join(CFG.winLib, 'core', 'tts', 'tts_indextts.py');
      assert.ok(fs.existsSync(ttsPy),
        `Index-TTS 执行体不存在：${ttsPy}\n  这条用例要求本机具备 Index-TTS（现场 GPU 合成）；缺了就无法覆盖`
        + '「现场 TTS」这条路径 —— 这是**用例无法成立**，不是被测代码坏了。');

      // ── 前置 2：期望值**现读** DNA，不写死数字（改档案不该把测试改红）──
      const { readStyleDna, summarizeStyleDna } = await import('../lib/style-dna-reader.mjs');
      const dnaSum = summarizeStyleDna(readStyleDna(TTS_SLUG));
      assert.ok(dnaSum, `读不到 lib/style-dna/${TTS_SLUG}.json —— 这条用例依赖它的 targetLufs`);
      const wantLufs = dnaSum.targetLufs;
      assert.ok(Number.isFinite(wantLufs),
        `lib/style-dna/${TTS_SLUG}.json 没有可用的 targetLufs（读到 ${JSON.stringify(wantLufs)}），用例失去判据`);
      assert.notStrictEqual(wantLufs, TARGET_LUFS,
        `lib/style-dna/${TTS_SLUG}.json 的 targetLufs 恰好等于通用默认 ${TARGET_LUFS} —— 那样`
        + '「DNA 生效」与「走默认」的输出完全相同，这条用例就失去了区分力。请换一个 targetLufs ≠ 默认的风格。');

      // ── 前置 3：真锁没被别的任务占着 ──
      //   TTS 的串行锁是**全局**的（编排器 / 控制台 / 手工跑共用一把）。被占着时本用例会一直
      //   等锁到 LOCK_TIMEOUT（2 小时）才失败 —— 那对冒烟测试是不可接受的。所以先探再跑。
      const ttsHome = process.env.INDEXTTS_HOME || 'D:/Index-tts/Index-tts_v2.5';
      const lockPath = process.env.INDEXTTS_LOCK || path.join(ttsHome, '.indextts.lock');
      const readLock = () => { try { return fs.readFileSync(lockPath, 'utf8').trim(); } catch { return '?'; } };
      // ★ 判据不是「文件在不在」，而是工具的**过期接管**判据（属主已死 / 锁龄>LOCK_STALE ⇒ 残留放行）——
      //   见本文件顶部 `checkIndexttsLock` 与 `tts_indextts.py:807`。
      const lockGate = await checkIndexttsLock(lockPath);
      if (!lockGate.ok) assert.fail(lockGate.message);
      if (lockGate.takeover) console.log(`ℹ ${lockGate.note}`);

      // ── 建测试输出目录（前缀 _smoke- ⇒ cleanupArtifacts 的两道守卫才认它）──
      fs.mkdirSync(CFG.exportDir, { recursive: true });
      const outDir = path.join(CFG.exportDir, `${TEST_DIR_PREFIX}tts-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(outDir, { recursive: true });
      ARTIFACTS.dirs.add(outDir);   // ★ 中途断言失败也要摘干净 —— 收尾由 smoke.mjs 的 finally 统一做
      //   ★ 还有一处容易被漏掉：dub.mjs 的「[7] 自检」会把抽帧写到共享缓存目录
      //     `dub/_verify/<输出目录名>/`。不登记的话，每次 --full 都会在里面留一个 `_smoke-tts-*`
      //     目录（实测攒到 6 个才发现）。名字里带 outDir 的 basename，所以是确定的，可以提前登记。
      ARTIFACTS.dirs.add(path.join(CFG.exportDir, 'dub', '_verify', path.basename(outDir)));
      const scriptFile = path.join(outDir, '_script.txt');
      fs.writeFileSync(scriptFile, `${TTS_TEXT}\n`, 'utf8');

      // ── 跑：真 TTS + 真出片 ──
      //   尺寸 270x480 = 9:16 的 1/4 比例（够验几何，又不把时间耗在编码上）。
      //   锁的存在性用**轮询**观察：TTS 全程持锁 ~30s，200ms 一次绝不会漏。
      let sawLock = false;
      const poll = setInterval(() => { try { if (fs.existsSync(lockPath)) sawLock = true; } catch { /* ignore */ } }, 200);
      let r;
      try {
        r = await runNode(
          ['dub.mjs', '--script', scriptFile, '--style', TTS_SLUG, '--size', '270x480', '--out', outDir],
          { cwd: ctx.root, timeoutMs: 600000 },
        );
      } finally {
        clearInterval(poll);
      }
      assert.strictEqual(r.code, 0,
        `现场 TTS 出片退出码 ${r.code}（期望 0）\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}\n--- stderr ---\n${r.stderr.slice(-2000)}`);

      // ── 断言 1：TTS 真的跑了（不是复用预生成配音）──
      //   ★ 判据不能是「_tts/*.wav 还在不在」：dub.mjs 在**成功后**会清掉 _tts/ 与 _program*.wav
      //     这些中间产物（dub.mjs:943-947）。改用 TTS 脚本自己逐条打印的那一行（由 dub.mjs
      //     原样 echo）—— 它只在**真的合成过**才存在，且带真实时长。
      assert.match(r.stdout, /TTS_DONE/,
        `stdout 里没有 TTS_DONE —— 现场 TTS 没跑完\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      const mLine = /^l1\s+(\d+(?:\.\d+)?)\s+(.+)$/m.exec(r.stdout);
      assert.ok(mLine,
        'stdout 里没有 TTS 的逐条回执行（形如 "l1 <时长> <文本>"）—— 现场合成没产出音频\n'
        + `--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      const ttsDur = Number(mLine[1]);
      assert.ok(Number.isFinite(ttsDur) && ttsDur > 0.5 && ttsDur < 15,
        `TTS 回执的时长不合理：${JSON.stringify(mLine[1])}`);
      assert.strictEqual(mLine[2].trim(), TTS_TEXT,
        `TTS 回执的文本与输入不一致：${JSON.stringify(mLine[2])}`);

      // ── 断言 2：dur.json 有效（TTS 的时长回传）──
      const durFile = path.join(outDir, 'dur.json');
      assert.ok(fs.existsSync(durFile), `没有 ${durFile}`);
      const durMap = JSON.parse(fs.readFileSync(durFile, 'utf8'));
      const d1 = Number(durMap.l1);
      assert.ok(Number.isFinite(d1) && d1 > 0.5 && d1 < 15,
        `dur.json 的 l1 时长不合理：${JSON.stringify(durMap.l1)}`);

      // ── 断言 3：★ style-dna 真的接进来了（这句**只在** targetLufs ≠ 通用默认时才打印）──
      assert.match(r.stdout, new RegExp(`响度目标 ${reEsc(wantLufs)} LUFS，来自风格特质`),
        `stdout 里没有「响度目标 ${wantLufs} LUFS，来自风格特质」—— style-dna 的 targetLufs 没接进出片链路\n`
        + `--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);

      // ── 断言 4：★ 串行锁「取了又放」──
      assert.ok(sawLock,
        `整个现场 TTS 过程里从没观察到配音锁（${lockPath}）—— 串行锁没生效？\n`
        + '  Index-TTS 绝不能并发（实测 4~5 个实例会把 6 秒的合成拖到 4~7 分钟），这把锁是硬要求。');
      assert.ok(!fs.existsSync(lockPath),
        `跑完了但配音锁没释放：${lockPath}（内容 "${readLock()}"）\n`
        + '  锁泄漏会把后续所有配音任务堵到 LOCK_TIMEOUT（2 小时）。');

      // ── 断言 5：成片响度/峰值真的按 DNA 目标归一 ──
      //   归一规则（`dub.mjs`，2026-10-04 起）：
      //     · 两个目标差 ≤ 1 LU ⇒ `gain = min(峰值余量, 响度余量)`，**至少一个贴住限值**；
      //     · 两个目标差 > 1 LU ⇒ `gain = 响度余量` + `alimiter` 限幅 ⇒ **两个都贴住限值**。
      //   两种形态都合法，但必须**至少一个贴住限值**，否则说明增益根本没算对。
      //   ★ 容差取 0.25 dB：成片是 AAC 有损编码，实测会把 PCM 真峰值挪 0.08~0.22 dB
      //     （见项目约定「音频有损编码」）。卡到 0.15 会被编码抖动打成假红。
      const TOL = 0.25;
      const lastJson = (r.stdout.match(/^\{.*"lufs".*\}$/m) || [])[0];
      assert.ok(lastJson, 'stdout 末尾没有机器可读的结果 JSON 行');
      const fin = JSON.parse(lastJson);
      // ★ 2026-10-03：判据改用**真峰值**（dub.mjs 现在会在 JSON 里给 truePeak，来自 loudnorm input_tp，
      //   4× 过采样）。此前用的是 `peak`（astats **采样峰值**）却标成「真峰值」——
      //   实测全量 43 部里两者最大差 1.62 dB，用采样峰值会**漏报**。
      const finTP = typeof fin.truePeak === 'number' ? fin.truePeak : fin.peak;
      assert.ok(finTP <= TARGET_PEAK_PCM + TOL,
        `成片真峰值 ${finTP} dBTP（采样峰值 ${fin.peak} dBFS）超过上限 ${TARGET_PEAK_PCM}（含 AAC 编码余量 ${TOL}）`);
      const hitLoud = Math.abs(fin.lufs - wantLufs) <= TOL;
      const hitPeak = Math.abs(finTP - TARGET_PEAK_PCM) <= TOL;
      assert.ok(hitLoud || hitPeak,
        `增益没打到任何一个限值：成片响度 ${fin.lufs} LUFS（DNA 目标 ${wantLufs}）、`
        + `真峰值 ${finTP} dBTP（上限 ${TARGET_PEAK_PCM}）—— 响度/峰值归一没生效？`);
      assert.ok(fin.lufs <= wantLufs + TOL,
        `成片响度 ${fin.lufs} LUFS 超过了 DNA 目标 ${wantLufs}（容差 ${TOL}）`);

      // ── 断言 5b：★ 增益公式**真的把 DNA 目标当输入**（不是只打印了它）──
      //   用 stdout 里打印的**原始测量值**反推公式，再与实发增益对比。
      //   ★★ 2026-10-04 改：`dub.mjs` 的增益规则**变了** —— 此前是
      //     `gain = min(峰值余量, 响度余量)`「取更保守的那个」，后果是
      //     **峰值余量总是更保守、响度那一项被 min() 吃掉**（本机素材波峰因数 ~13–14 dB
      //     > `targetLufs − TARGET_PEAK_PCM = 12.3 dB`）⇒ 实测成片响度只到 **−17.3 LUFS**，
      //     离 DNA 目标 **−14** 差 **3.3 LU**。原注释把这条记成了「已知局限」，
      //     实为**可修的缺陷**：纯增益在数学上不可能同时满足峰值与响度，必须**限幅**。
      //   现规则：两者差 > `LUFS_SHORTFALL_LIMIT`(1.0 LU) 时 → `gain = 响度余量` 并启用
      //     `alimiter`（只压峰、不改电平）；否则维持 `min(...)` 不变（不动既有输出）。
      const mRaw = /拼装后 峰值 (-?[\d.]+) dBFS · 集成响度 (-?[\d.]+) LUFS/.exec(r.stdout);
      assert.ok(mRaw, `stdout 里没有拼装后的原始测量行\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      const rawPeak = Number(mRaw[1]);
      const rawLoud = Number(mRaw[2]);
      const mGain = /施加增益 ([+-]?[\d.]+) dB/.exec(r.stdout);
      assert.ok(mGain, `stdout 里没有「施加增益」行\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      const gainActual = Number(mGain[1]);
      const gainPeakMargin = TARGET_PEAK_PCM - rawPeak;
      const gainLoudMargin = wantLufs - rawLoud;
      // ★ 这个常量必须与 `dub.mjs` 里的 `LUFS_SHORTFALL_LIMIT` 一致
      const LUFS_SHORTFALL_LIMIT = 1.0;
      const useLimiter = gainPeakMargin < gainLoudMargin - LUFS_SHORTFALL_LIMIT;
      const gainExpect = useLimiter ? gainLoudMargin : Math.min(gainPeakMargin, gainLoudMargin);
      assert.ok(Math.abs(gainActual - gainExpect) <= 0.02,
        `施加增益 ${gainActual} dB 与规则不符：\n`
        + `  峰值余量 ${gainPeakMargin.toFixed(3)} / 响度余量 ${gainLoudMargin.toFixed(3)}`
        + ` ⇒ ${useLimiter ? `两者差 > ${LUFS_SHORTFALL_LIMIT} LU ⇒ 期望取响度余量并限幅` : '期望取更保守的那个'}\n`
        + `  期望 ${gainExpect.toFixed(3)}，实际 ${gainActual.toFixed(3)}（差 ${Math.abs(gainActual - gainExpect).toFixed(3)} dB）\n`
        + `  ★ 响度余量必须用 DNA 目标 ${wantLufs}，不是通用默认 ${TARGET_LUFS}`);

      // ── 断言 5c（2026-10-04 新增）：★ 限幅路径下**响度真的打到了目标** ──
      //   这是修那个缺陷的**结果断言** —— 只证明「公式用了 DNA 目标」还不够
      //   （旧代码也用了，只是被 min() 吃掉、数值上没效果）。
      //   容差 0.8 LU 是宽的：限幅只压峰、会轻微拉低集成响度（实测本机素材影响 < 0.05 LU），
      //   但留足余量以免被不同素材的波峰因数打成假红。它仍能抓住修前那 3.3 LU 的短差。
      if (useLimiter) {
        assert.match(r.stdout, /峰值限幅/,
          `这条素材两个目标差 ${(gainLoudMargin - gainPeakMargin).toFixed(2)} LU（> ${LUFS_SHORTFALL_LIMIT}）`
          + ' ⇒ 应当走「按响度目标增益 + 峰值限幅」那条路，但 stdout 里没看到「峰值限幅」\n'
          + `--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
        assert.ok(Math.abs(fin.lufs - wantLufs) <= 0.8,
          `走了限幅路径，成片响度应当贴住 DNA 目标 ${wantLufs} LUFS，实测 ${fin.lufs} LUFS`
          + `（差 ${Math.abs(fin.lufs - wantLufs).toFixed(2)} LU）—— 限幅没把响度顶上去？`);
      }

      // ── 断言 6：成片几何 + 音轨（用 ffprobe **独立复验**，不采信工具自述）──
      //   音轨这条尤其重要：`_tts/*.wav` 成功后就被清掉了，所以「真合成的音频真的进了成片」
      //   只能从成片侧独立验证。
      const mp4 = path.join(outDir, 'film.mp4');
      assert.ok(fs.existsSync(mp4), `没有 ${mp4}`);
      const toWsl = (p) => `/mnt/${p[0].toLowerCase()}${p.slice(2).replace(/\\/g, '/')}`;
      const pr = await wsl(`ffprobe -v error -show_entries stream=codec_type,width,height -show_entries format=duration -of json ${toWsl(mp4)}`);
      let probeJson = null;
      try { probeJson = JSON.parse(String(pr.out)); } catch { /* 下面统一报错 */ }
      assert.ok(probeJson && Array.isArray(probeJson.streams),
        `ffprobe 没读出流信息：${JSON.stringify(String(pr.out).slice(0, 300))}（err=${String(pr.err).slice(0, 300)}）`);
      const vStream = probeJson.streams.find((s) => s.codec_type === 'video');
      const aStream = probeJson.streams.find((s) => s.codec_type === 'audio');
      assert.ok(vStream, '成片里没有视频流');
      assert.strictEqual(`${vStream.width}x${vStream.height}`, '270x480',
        `ffprobe 读到的成片尺寸不是 270x480：${vStream.width}x${vStream.height}`);
      assert.ok(aStream, '成片里没有音轨 —— 现场合成的配音没进成片');
      const fmtDur = Number(probeJson.format && probeJson.format.duration);
      assert.ok(Number.isFinite(fmtDur) && fmtDur > 0.5 && fmtDur < 15,
        `成片总时长不合理：${JSON.stringify(probeJson.format && probeJson.format.duration)}`);

      // ── 断言 7（2026-10-04 新增）：★ 成片字幕**逐字等于文案** ──
      //   需求把「字幕内容与文案保持一致」写成硬规则，而这条**不需要 VLM 就能机械核**：
      //   读成片的 `film.srt`，把每条字幕的文本拼起来与输入的文案比对（都去掉空白）。
      //   ★ 比「拼接后」而不是「逐条」：字幕怎么切句是编排的自由（切句规则可能变），
      //     但**内容一个字都不能变**。多字、少字、改字都会让拼接结果不等。
      //   ★ 与 `--verify-triple`（需 7B VLM、验画面语义）**互补**：那条验画面，这条验文本。
      const srtPath = path.join(outDir, 'film.srt');
      assert.ok(fs.existsSync(srtPath), `没有 ${srtPath}`);
      const srtBlocks = fs.readFileSync(srtPath, 'utf8').split(/\n\s*\n/)
        .map((b) => b.split('\n').slice(2).join(' ').trim()).filter(Boolean);
      const stripWs2 = (s) => String(s).replace(/\s+/g, '');
      const srtJoined = srtBlocks.map(stripWs2).join('');
      const wantJoined = stripWs2(TTS_TEXT);
      assert.ok(srtBlocks.length > 0, 'film.srt 里一条字幕都没有');
      assert.strictEqual(srtJoined, wantJoined,
        `成片字幕内容与文案不一致（去空白后比对）：\n`
        + `  文案 ${wantJoined.length} 字：${wantJoined}\n`
        + `  字幕 ${srtJoined.length} 字：${srtJoined}\n`
        + `  字幕分 ${srtBlocks.length} 条：${JSON.stringify(srtBlocks)}`);

      ctx.note(`⑤++ 现场 TTS 实测：成片 ${fin.lufs} LUFS / 峰值 ${fin.peak} dBFS`
        + `（DNA 目标 ${wantLufs} LUFS，限值 ${TARGET_PEAK_PCM} dBFS，本次由${hitPeak ? '峰值' : '响度'}限住）`
        + `；锁已观察到且已释放`);
    },
  },
  {
    // ★ 为什么必须有这条（2026-10-07 补的缺口）：
    //   本文件里**唯一**真跑 `dub.mjs` 出片的用例是 `⑤++`（现场 TTS），而它**没传 `--video`**
    //   ⇒ 跑的是**形态 A**（生成的渐变背景）。于是「**形态 B**：口播素材铺画面」这条通路
    //   **从来没有过 CLI 级出片覆盖**（`grep -n -- "--video\|--keep-original\|--fit" test/cases.mjs`
    //   曾经 0 命中）。
    // ★ 为什么这条**不跑 TTS、不吃 GPU、几秒就能跑完**：`--keep-original` 明令「不跑 TTS、
    //   不动素材的时长/画面/声音」，只在素材上叠字幕与叠加层（`dub.mjs` 的 `runKeepOriginal`
    //   在「出片前显存预检」**之前**就 return 了）⇒ 这条覆盖完全不依赖 Index-TTS。
    // ★ 为什么必须给 `--srt`：不给会依次退 ASR → VAD → 均匀分配。ASR 要 faster-whisper +
    //   模型加载（多一个依赖、多几秒、结果还不确定）；`--srt` 是**最快最确定**的那一路。
    //   断言 `"align":"srt"` 就是钉「走的确实是 SRT 那一路、没有偷偷退到 ASR」。
    //   ★ 夹具 SRT 的**文本故意与文案不同**（见 `KO_SRT`）⇒「字幕逐字等于文案」这条才是在验
    //     「字幕文本取自**文案**」；两边写成一样的话，它只是在验一句恒真的废话。
    name: '⑤+++ 形态 B（--keep-original）真出片：尺寸沿用素材 / 音轨逐字节相同 / 字幕逐字等于文案',
    run: async (ctx) => {
      const { HARD_PEAK_LIMIT } = await import('../lib/dub-core.mjs');

      // ── 夹具：现造一个极小的假口播素材（跑完随 outDir 一起删）──
      fs.mkdirSync(CFG.exportDir, { recursive: true });
      const outDir = path.join(CFG.exportDir, `${TEST_DIR_PREFIX}ko-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(outDir, { recursive: true });
      ARTIFACTS.dirs.add(outDir);   // ★ 中途断言失败也要摘干净 —— 收尾由 smoke.mjs 的 finally 统一做
      //   ★ `dub.mjs` 的抽帧会写进共享缓存目录 `dub/_verify/<输出目录名>/`，名字是确定的，提前登记
      ARTIFACTS.dirs.add(path.join(CFG.exportDir, 'dub', '_verify', path.basename(outDir)));

      const srcFile = path.join(outDir, '_src.mp4');
      const m = await makeDubMaterial(srcFile);
      assert.ok(m.ok && fs.existsSync(srcFile),
        `造夹具素材失败（WSL ffmpeg lavfi）：code=${m.code}\n${String(m.err).slice(-800)}`);

      const scriptFile = path.join(outDir, '_script.txt');
      fs.writeFileSync(scriptFile, `${KO_TEXT}\n`, 'utf8');
      const srtFile = path.join(outDir, '_sub.srt');
      fs.writeFileSync(srtFile, KO_SRT, 'utf8');

      // ── 跑：真出片（不跑 TTS）──
      //   ★ 刻意给 `--size 1080x1920 --ratio 16:9`（与素材 270x480 **不同**）：
      //     `--keep-original` 明令「改尺寸/比例就是改画面」⇒ 这两个参数**不生效**。
      //     成片尺寸因此是**可证伪的**：它必须等于素材，而不是我们点名的那个。
      const r = await runNode(['dub.mjs', '--script', scriptFile, '--video', srcFile,
        '--keep-original', '--srt', srtFile, '--size', '1080x1920', '--ratio', '16:9',
        '--out', outDir], { cwd: ctx.root, timeoutMs: 300000 });
      assert.strictEqual(r.code, 0,
        `--keep-original 出片退出码 ${r.code}（期望 0）\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}\n--- stderr ---\n${r.stderr.slice(-2000)}`);

      // ── 断言 1：工具自己那行机器可读的结果 JSON ──
      const lastJson = (r.stdout.match(/^\{.*"keepOriginal".*\}$/m) || [])[0];
      assert.ok(lastJson, `stdout 末尾没有机器可读的结果 JSON 行\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      const fin = JSON.parse(lastJson);
      assert.strictEqual(fin.keepOriginal, true, '结果 JSON 里 keepOriginal 不是 true');
      assert.strictEqual(fin.align, 'srt',
        `对齐方式不是 srt（读到 ${JSON.stringify(fin.align)}）—— --srt 没被采用？`);
      assert.strictEqual(fin.audioIdentical, true,
        `工具自检报「音轨与素材不逐字节相同」（audioIdentical=${JSON.stringify(fin.audioIdentical)}）`);

      // ── 断言 2：--size / --ratio 被忽略，且用户**被明确告知** ──
      assert.match(r.stdout, /在 --keep-original 下不生效/,
        'stdout 里没有「在 --keep-original 下不生效」的提示 —— 用户给了 --size/--ratio 却没人告诉他被忽略了\n'
        + `--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);

      // ── 断言 3：成片几何 == 素材几何（ffprobe 独立复验，不采信工具自述）──
      const srcP = await probeMedia(srcFile);
      const filmPath = path.join(outDir, 'film.mp4');
      assert.ok(fs.existsSync(filmPath), `没有 ${filmPath}`);
      const filmP = await probeMedia(filmPath);
      assert.ok(srcP && srcP.v, `ffprobe 读不出素材的视频流：${JSON.stringify(srcP)}`);
      assert.ok(filmP && filmP.v, `ffprobe 读不出成片的视频流：${JSON.stringify(filmP)}`);
      assert.strictEqual(`${srcP.v.width}x${srcP.v.height}`, `${KO_W}x${KO_H}`,
        `夹具素材尺寸不是 ${KO_W}x${KO_H}（读到 ${srcP.v.width}x${srcP.v.height}）—— 夹具本身不对，断言失去意义`);
      assert.strictEqual(`${filmP.v.width}x${filmP.v.height}`, `${KO_W}x${KO_H}`,
        `成片尺寸 ${filmP.v.width}x${filmP.v.height} ≠ 素材 ${KO_W}x${KO_H}`
        + '（--keep-original 明令沿用素材尺寸；若成片是 1080x1920，说明 --size/--ratio 被错误地生效了）');
      assert.ok(filmP.a, '成片里没有音轨 —— --keep-original 的素材原声没进成片');

      // ── 断言 4：音轨**逐字节相同**（两条音轨都解成 PCM 再比 md5）──
      const md5s = await audioPcmMd5Pair(srcFile, filmPath);
      assert.strictEqual(md5s.length, 2,
        `PCM md5 只读到 ${md5s.length} 条（期望 2 条：素材 / 成片）—— WSL 侧解码失败？`);
      assert.strictEqual(md5s[0], md5s[1],
        '成片音轨与素材**不再逐字节相同**（默认应当是 -c:a copy）：\n'
        + `  素材 ${md5s[0]}\n  成片 ${md5s[1]}\n`
        + '  ⇒ 音轨被重编码或替换了。--keep-original 的契约是「一个字节都不动」'
        + '（要压峰得显式加 --keep-original-limit）。');

      // ── 断言 5：★ 真峰值 == 素材真峰值（既没归一、也没限幅）──
      //   ★ 为什么用「与素材相等」而不是「≤ 交付线」：`--keep-original` **明令不改声音**，
      //     所以素材超交付线时成片也**必须**超（`dub.mjs` 对此只 warn、不 bad）。
      //     断言「≤ 交付线」会**把实现行为写反**。
      const srcL = await measureLoud(srcFile);
      const filmL = await measureLoud(filmPath);
      assert.ok(srcL.tp !== null && filmL.tp !== null,
        `真峰值测不到（素材 ${JSON.stringify(srcL)} / 成片 ${JSON.stringify(filmL)}）`);
      assert.ok(srcL.tp > HARD_PEAK_LIMIT,
        `夹具素材自身真峰值 ${srcL.tp} dBTP 没有超过交付线 ${HARD_PEAK_LIMIT} dBTP`
        + ' ⇒ 「素材超标时 keep-original 也不归一」这条断言成了空转。请把夹具的音轨推得更满。');
      assert.ok(Math.abs(filmL.tp - srcL.tp) <= 0.05,
        `成片真峰值 ${filmL.tp} dBTP 与素材 ${srcL.tp} dBTP 不一致`
        + `（差 ${Math.abs(filmL.tp - srcL.tp).toFixed(3)} dB）—— 音轨被改过了（--keep-original 不做任何归一）`);

      // ── 断言 6：字幕**逐字等于文案**（去空白后拼接比对）──
      const srtPath = path.join(outDir, 'film.srt');
      assert.ok(fs.existsSync(srtPath), `没有 ${srtPath}`);
      const srt = srtJoinedText(srtPath);
      const wantText = KO_TEXT.replace(/\s+/g, '');
      assert.ok(srt.blocks.length > 0, 'film.srt 里一条字幕都没有');
      assert.strictEqual(srt.joined, wantText,
        '成片字幕内容与文案不一致（去空白后比对）：\n'
        + `  文案 ${wantText.length} 字：${wantText}\n`
        + `  字幕 ${srt.joined.length} 字：${srt.joined}\n`
        + `  字幕分 ${srt.blocks.length} 条：${JSON.stringify(srt.blocks)}\n`
        + '  ★ 输入的 SRT 文本与文案**故意不同** ⇒ 成片字幕若等于 SRT 的占位文本，'
        + '说明字幕文本被错误地取自 --srt 而不是文案。');

      // ── 断言 7：时长沿用素材（不 loop / 不 trim / 不 setpts）──
      assert.ok(Number.isFinite(filmP.dur) && Math.abs(filmP.dur - KO_DUR) < 0.1,
        `成片时长 ${filmP.dur}s 与素材 ${KO_DUR}s 差超过 0.1s`);

      ctx.note(`⑤+++ --keep-original 实测：成片 ${filmP.v.width}x${filmP.v.height}（= 素材尺寸，`
        + `点名的 1080x1920 被正确忽略）· 音轨 PCM md5 与素材相同（${md5s[0].slice(0, 8)}…）· `
        + `真峰值 ${filmL.tp} dBTP（素材 ${srcL.tp}，**未被归一**，超交付线 ${HARD_PEAK_LIMIT}）· `
        + `字幕 ${srt.blocks.length} 条 / ${srt.joined.length} 字逐字等于文案`);
    },
  },
  {
    // ★ 为什么必须有这条：`--keep-original-limit` 是「素材自身真峰值超交付线」时**唯一**的补救
    //   —— 它把音轨**重编码 + `alimiter` 限幅**（只压峰，不动时长/画面/内容）。这条分支此前零覆盖。
    // ★ 夹具的音轨刻意推到满刻度 ⇒ 素材真峰值 +0.02 dBTP > 交付线 −1.2 dBTP，
    //   「限幅后 ≤ 交付线」才是**可证伪**的（素材本就在线内的话，限不限都过 ⇒ 空转）。
    // ★ 与 ⑤+++ 成对读：一条断言「音轨逐字节相同（没动）」，一条断言「音轨必然不同（动了）」
    //   —— 两者合起来才钉住「默认 copy / 显式限幅才重编码」这条口径。
    name: '⑤++++ --keep-original-limit：音轨不再逐字节相同 且 真峰值被压进交付线',
    run: async (ctx) => {
      const { HARD_PEAK_LIMIT } = await import('../lib/dub-core.mjs');

      fs.mkdirSync(CFG.exportDir, { recursive: true });
      const outDir = path.join(CFG.exportDir, `${TEST_DIR_PREFIX}kolim-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(outDir, { recursive: true });
      ARTIFACTS.dirs.add(outDir);
      ARTIFACTS.dirs.add(path.join(CFG.exportDir, 'dub', '_verify', path.basename(outDir)));

      const srcFile = path.join(outDir, '_src.mp4');
      const m = await makeDubMaterial(srcFile);
      assert.ok(m.ok && fs.existsSync(srcFile),
        `造夹具素材失败（WSL ffmpeg lavfi）：code=${m.code}\n${String(m.err).slice(-800)}`);
      const scriptFile = path.join(outDir, '_script.txt');
      fs.writeFileSync(scriptFile, `${KO_TEXT}\n`, 'utf8');
      const srtFile = path.join(outDir, '_sub.srt');
      fs.writeFileSync(srtFile, KO_SRT, 'utf8');

      const r = await runNode(['dub.mjs', '--script', scriptFile, '--video', srcFile,
        '--keep-original', '--keep-original-limit', '--srt', srtFile, '--out', outDir],
      { cwd: ctx.root, timeoutMs: 300000 });
      assert.strictEqual(r.code, 0,
        `--keep-original-limit 出片退出码 ${r.code}（期望 0）\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}\n--- stderr ---\n${r.stderr.slice(-2000)}`);

      // ── 断言 1：工具自己的结果 JSON ──
      const lastJson = (r.stdout.match(/^\{.*"keepOriginal".*\}$/m) || [])[0];
      assert.ok(lastJson, `stdout 末尾没有机器可读的结果 JSON 行\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      const fin = JSON.parse(lastJson);
      assert.strictEqual(fin.keepOriginalLimit, true, '结果 JSON 里 keepOriginalLimit 不是 true');
      assert.strictEqual(fin.audioIdentical, false,
        `工具自检竟报「音轨与素材逐字节相同」（audioIdentical=${JSON.stringify(fin.audioIdentical)}）`
        + ' —— 开了 --keep-original-limit 却好像没限幅？');

      const filmPath = path.join(outDir, 'film.mp4');
      assert.ok(fs.existsSync(filmPath), `没有 ${filmPath}`);

      // ── 断言 2：音轨**不再**逐字节相同（PCM md5 必须不同）──
      const md5s = await audioPcmMd5Pair(srcFile, filmPath);
      assert.strictEqual(md5s.length, 2,
        `PCM md5 只读到 ${md5s.length} 条（期望 2 条：素材 / 成片）—— WSL 侧解码失败？`);
      assert.notStrictEqual(md5s[0], md5s[1],
        '开了 --keep-original-limit，音轨却仍与素材**逐字节相同**：\n'
        + `  素材 ${md5s[0]}\n  成片 ${md5s[1]}\n`
        + '  ⇒ 限幅没有生效（它必须重编码：`alimiter` 是音频滤镜，绕不开解码→滤镜→编码）。');

      // ── 断言 3：★ 真峰值被压进交付线（且素材确实超标 —— 否则本断言空转）──
      const TOL = 0.25;   // 与 ⑤++ 同口径：AAC 有损编码会把真峰值挪 0.08~0.22 dB
      const srcL = await measureLoud(srcFile);
      const filmL = await measureLoud(filmPath);
      assert.ok(srcL.tp !== null && filmL.tp !== null,
        `真峰值测不到（素材 ${JSON.stringify(srcL)} / 成片 ${JSON.stringify(filmL)}）`);
      assert.ok(srcL.tp > HARD_PEAK_LIMIT,
        `夹具素材自身真峰值 ${srcL.tp} dBTP 没有超过交付线 ${HARD_PEAK_LIMIT} dBTP`
        + ' ⇒ 「限幅把它压进交付线」这条断言成了空转（本来就在线内）。请把夹具的音轨推得更满。');
      assert.ok(filmL.tp <= HARD_PEAK_LIMIT + TOL,
        `成片真峰值 ${filmL.tp} dBTP 超过交付线 ${HARD_PEAK_LIMIT}（含 AAC 编码余量 ${TOL}）`
        + ` —— 限幅没达标（素材 ${srcL.tp} dBTP）`);
      assert.ok(filmL.tp < srcL.tp,
        `成片真峰值 ${filmL.tp} 没有低于素材 ${srcL.tp} —— 限幅没压峰？`);

      // ── 断言 4：限幅**只**压峰 —— 画面尺寸与字幕内容都不许变 ──
      const srcP = await probeMedia(srcFile);
      const filmP = await probeMedia(filmPath);
      assert.ok(filmP && filmP.v, `ffprobe 读不出成片的视频流：${JSON.stringify(filmP)}`);
      assert.strictEqual(`${filmP.v.width}x${filmP.v.height}`, `${srcP.v.width}x${srcP.v.height}`,
        `限幅后成片尺寸变了：${filmP.v.width}x${filmP.v.height} ≠ 素材 ${srcP.v.width}x${srcP.v.height}`);
      assert.ok(Number.isFinite(filmP.dur) && Math.abs(filmP.dur - KO_DUR) < 0.1,
        `限幅后成片时长 ${filmP.dur}s ≠ 素材 ${KO_DUR}s（限幅不该动时长）`);
      const srtPath = path.join(outDir, 'film.srt');
      assert.ok(fs.existsSync(srtPath), `没有 ${srtPath}`);
      const srt = srtJoinedText(srtPath);
      assert.strictEqual(srt.joined, KO_TEXT.replace(/\s+/g, ''),
        `限幅后字幕内容与文案不一致：${JSON.stringify(srt.blocks)}`);

      ctx.note(`⑤++++ --keep-original-limit 实测：素材真峰值 ${srcL.tp} dBTP → 成片 ${filmL.tp} dBTP`
        + `（≤ 交付线 ${HARD_PEAK_LIMIT}）· 音轨 PCM md5 与素材不同（${md5s[0].slice(0, 8)}… → ${md5s[1].slice(0, 8)}…，`
        + `重编码是有意的）· 尺寸/时长/字幕一律未动`);
    },
  },
  {
    // ★ 为什么必须有这条：`--fit loop|trim|slow` 此前**零 CLI 覆盖**。它只在
    //   **形态 B 的非 keep-original** 路径上生效（`dub.mjs` 的画面滤镜分支），
    //   而那条路径**必须跑 TTS**（真出片 = 占 GPU + 30 秒以上）⇒ 本用例先用 `--dry-run`
    //   做**近零成本**覆盖：参数解析 → 取值校验 → 计划行透传。
    //   ★ 真出片的 `--fit trim` 覆盖**做不到**：`--keep-original` 不跑 TTS ⇒ 那条分支根本
    //     不执行；而形态 B 的真出片绕不开 TTS。这一格留给 `⑤++` 那一类 GPU 用例，见 test/README.md。
    // ★ 为什么连「非法值」也要测：`--fit` 的取值校验在 `main()` 里、**早于** keep-original 分支
    //   ⇒ 就算这次出片根本用不到 fit（例如配了 `--keep-original`），非法值也**必须**当场拒。
    //   把校验挪成「用得到时才校验」是很容易发生的退化，这条钉住它。
    name: '⑤+++++ --fit 取值校验（loop|trim|slow）+ dry-run 计划透传（不跑 TTS / 不渲染）',
    run: async (ctx) => {
      fs.mkdirSync(CFG.exportDir, { recursive: true });
      const outDir = path.join(CFG.exportDir, `${TEST_DIR_PREFIX}kofit-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(outDir, { recursive: true });
      ARTIFACTS.dirs.add(outDir);   // ★ dry-run 不走到抽帧 ⇒ 不会有 dub/_verify/<name>，只登记这一个
      const srcFile = path.join(outDir, '_src.mp4');
      const m = await makeDubMaterial(srcFile);
      assert.ok(m.ok && fs.existsSync(srcFile),
        `造夹具素材失败（WSL ffmpeg lavfi）：code=${m.code}\n${String(m.err).slice(-800)}`);
      const scriptFile = path.join(outDir, '_script.txt');
      fs.writeFileSync(scriptFile, '这是一次 --fit 的计划干跑。\n', 'utf8');

      const dry = (extra) => runNode(['dub.mjs', '--script', scriptFile, '--video', srcFile,
        '--out', outDir, '--dry-run', ...extra], { cwd: ctx.root, timeoutMs: 300000 });

      // ── 断言 1：三个合法值都透传到计划行；且 dry-run 真的**不跑 TTS、不渲染** ──
      for (const fit of ['loop', 'trim', 'slow']) {
        const r = await dry(['--fit', fit]);
        assert.strictEqual(r.code, 0,
          `--fit ${fit} --dry-run 退出码 ${r.code}（期望 0）\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
        assert.match(r.stdout, new RegExp(`fit=${fit}`),
          `stdout 里没有 fit=${fit} —— 计划行没把 --fit 透传出去\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
        assert.match(r.stdout, /--dry-run 到此为止/,
          `--fit ${fit} 的 dry-run 没走到「到此为止」那一行`);
        assert.ok(!/TTS_DONE/.test(r.stdout),
          '--dry-run 竟然跑了 TTS（stdout 里有 TTS_DONE）—— 这条用例「零 GPU」的前提被破坏了');
        assert.ok(!fs.existsSync(path.join(outDir, 'film.mp4')),
          '--dry-run 竟然出了成片（film.mp4 存在）');
      }

      // ── 断言 2：非法值当场拒（两种组合都要拒：普通形态 B / 配了 --keep-original）──
      const badFit = await dry(['--fit', 'bogus']);
      assert.notStrictEqual(badFit.code, 0, '--fit bogus 竟然 exit 0（期望非 0）');
      assert.match(badFit.stdout, /--fit 只能是 loop\|trim\|slow/,
        `非法 --fit 的报错文案不对\n--- stdout ---\n${badFit.stdout.slice(-1000)}`);
      const badKeep = await runNode(['dub.mjs', '--script', scriptFile, '--video', srcFile,
        '--keep-original', '--fit', 'bogus', '--out', outDir, '--dry-run'],
      { cwd: ctx.root, timeoutMs: 120000 });
      assert.notStrictEqual(badKeep.code, 0,
        '--keep-original 下 --fit 根本用不到，非法值却被放过了 —— 取值校验必须是**无条件**的');
      assert.match(badKeep.stdout, /--fit 只能是 loop\|trim\|slow/,
        `--keep-original 下非法 --fit 的报错文案不对\n--- stdout ---\n${badKeep.stdout.slice(-1000)}`);

      ctx.note('⑤+++++ --fit 实测：loop/trim/slow 三值都透传到计划行 fit=<值>；'
        + '非法值在「形态 B」与「配了 --keep-original」两种组合下都被当场拒（exit≠0）');
    },
  },
  {
    // ★ 为什么必须有这条（2026-10-07 补的缺口）：
    //   「**形态 B**（`--video` 口播素材铺满画面）+ **现场 TTS**」这条**真实产品路径**
    //   此前**没有 CLI 级出片覆盖**：`⑤++` 是形态 A（没传 `--video`），
    //   `⑤+++`/`⑤++++`/`⑤+++++` 全是 `--keep-original`（明令不跑 TTS）⇒
    //   「素材铺满 + TTS 配音」这个**组合**从没被真跑过（`⑤+++++` 只覆盖了 `--fit` 的**参数面**）。
    // ★ 本用例同时是 `--fit` **行为面**的第一个覆盖点：不传 `--fit` ⇒ 走默认 `loop`
    //   ⇒ 「素材比配音短 ⇒ `-stream_loop -1` 循环播放」这条分支第一次被真出片验证。
    name: '⑤++++++ 形态 B + 现场 TTS 真出片（默认 --fit loop）：尺寸按 --ratio / 音轨来自 TTS 不是素材原声 / 字幕逐字等于文案 / 响度 −14±1 / 素材被循环',
    run: async (ctx) => {
      const { HARD_PEAK_LIMIT, TARGET_LUFS } = await import('../lib/dub-core.mjs');
      const { readStyleDna, summarizeStyleDna } = await import('../lib/style-dna-reader.mjs');

      // ── 前置 1：本机真的具备 Index-TTS 执行体 ──
      const ttsPy = path.join(CFG.winLib, 'core', 'tts', 'tts_indextts.py');
      assert.ok(fs.existsSync(ttsPy),
        `Index-TTS 执行体不存在：${ttsPy}\n  这条用例要求本机具备 Index-TTS（现场 GPU 合成）；缺了就无法覆盖`
        + '「形态 B + 现场 TTS」这条路径 —— 这是**用例无法成立**，不是被测代码坏了。');

      // ── 前置 2：期望响度**现读** DNA，不写死数字（与 `⑤++` 同口径）──
      const dnaSum = summarizeStyleDna(readStyleDna(FIT_STYLE));
      assert.ok(dnaSum, `读不到 lib/style-dna/${FIT_STYLE}.json —— 这条用例依赖它的 targetLufs`);
      const wantLufs = dnaSum.targetLufs;
      assert.ok(Number.isFinite(wantLufs),
        `lib/style-dna/${FIT_STYLE}.json 没有可用的 targetLufs（读到 ${JSON.stringify(wantLufs)}），用例失去判据`);
      assert.notStrictEqual(wantLufs, TARGET_LUFS,
        `lib/style-dna/${FIT_STYLE}.json 的 targetLufs 恰好等于通用默认 ${TARGET_LUFS} —— 那样`
        + '「响度按风格目标归一」与「走默认」的输出完全相同，这条断言就失去了区分力。');

      // ── 前置 3：真锁没被别的任务占着（TTS 的串行锁是**全局**独占的）──
      const ttsHome = process.env.INDEXTTS_HOME || 'D:/Index-tts/Index-tts_v2.5';
      const lockPath = process.env.INDEXTTS_LOCK || path.join(ttsHome, '.indextts.lock');
      // ★ 用工具的**过期接管**判据（属主已死 / 锁龄>LOCK_STALE ⇒ 残留放行），不是「文件在不在」
      const lockGate = await checkIndexttsLock(lockPath);
      if (!lockGate.ok) assert.fail(lockGate.message);
      if (lockGate.takeover) console.log(`ℹ ${lockGate.note}`);

      // ── 夹具 + 输出目录（前缀 `_smoke-` ⇒ cleanupArtifacts 的两道守卫才认它）──
      fs.mkdirSync(CFG.exportDir, { recursive: true });
      const outDir = path.join(CFG.exportDir, `${TEST_DIR_PREFIX}fitb-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(outDir, { recursive: true });
      ARTIFACTS.dirs.add(outDir);
      //   `dub.mjs` 的 [7] 自检会把抽帧写到共享缓存 `dub/_verify/<输出目录名>/`，名字是确定的，提前登记
      ARTIFACTS.dirs.add(path.join(CFG.exportDir, 'dub', '_verify', path.basename(outDir)));

      const srcFile = path.join(outDir, '_src.mp4');
      const m = await makeFitMaterial(srcFile);
      assert.ok(m.ok && fs.existsSync(srcFile),
        `造夹具素材失败（WSL ffmpeg lavfi）：code=${m.code}\n${String(m.err).slice(-800)}`);
      const scriptFile = path.join(outDir, '_script.txt');
      fs.writeFileSync(scriptFile, `${FIT_TEXT}\n`, 'utf8');

      // ── 夹具自检：尺寸 / 时长 / 音轨都对，否则后面的断言全都失去意义 ──
      const srcP = await probeMedia(srcFile);
      assert.ok(srcP && srcP.v, `ffprobe 读不出素材的视频流：${JSON.stringify(srcP)}`);
      assert.strictEqual(`${srcP.v.width}x${srcP.v.height}`, `${FIT_W}x${FIT_H}`,
        `夹具素材尺寸不是 ${FIT_W}x${FIT_H}（读到 ${srcP.v.width}x${srcP.v.height}）`);
      assert.ok(srcP.a, '夹具素材没有音轨 —— 15 kHz 纯音这条判据失去载体');

      // ── 跑：真 TTS + 真出片（形态 B；不传 --keep-original、不传 --fit ⇒ 默认 loop）──
      const r = await runNode(['dub.mjs', '--script', scriptFile, '--video', srcFile,
        '--ratio', FIT_RATIO, '--style', FIT_STYLE, '--out', outDir],
      { cwd: ctx.root, timeoutMs: 900000 });
      assert.strictEqual(r.code, 0,
        `形态 B + 现场 TTS 出片退出码 ${r.code}（期望 0）\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}\n--- stderr ---\n${r.stderr.slice(-2000)}`);

      // ── 断言 1：走的确实是「形态 B + 现场 TTS + 默认 fit=loop」这条路 ──
      assert.match(r.stdout, /TTS_DONE/,
        `stdout 里没有 TTS_DONE —— 现场 TTS 没跑完\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      assert.match(r.stdout, /形态 B/, 'stdout 里没有「形态 B」—— 没走口播素材铺画面那条路');
      assert.match(r.stdout, /· fit loop/,
        `stdout 的计划行里没有「· fit loop」—— 默认值没落到 loop\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      assert.match(r.stdout, /-stream_loop -1 循环播放/,
        `stdout 里没有「-stream_loop -1 循环播放」—— 素材比配音短，loop 分支本该被选中\n`
        + `--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);

      // ── 断言 2：工具自己的机器可读结果 JSON ──
      const lastJson = (r.stdout.match(/^\{.*"truePeak".*\}$/m) || [])[0];
      assert.ok(lastJson, `stdout 末尾没有机器可读的结果 JSON 行\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      const fin = JSON.parse(lastJson);
      const total = Number(fin.total);
      assert.ok(Number.isFinite(total) && total > 3,
        `成片总时长不合理：${JSON.stringify(fin.total)}（本用例需要 total 明显大于素材 ${FIT_DUR}s）`);

      // ── 断言 3：★ 成片尺寸按 --ratio（不是素材尺寸）—— ffprobe 独立复验 ──
      const filmPath = path.join(outDir, 'film.mp4');
      assert.ok(fs.existsSync(filmPath), `没有 ${filmPath}`);
      const filmP = await probeMedia(filmPath);
      assert.ok(filmP && filmP.v, `ffprobe 读不出成片的视频流：${JSON.stringify(filmP)}`);
      assert.strictEqual(`${filmP.v.width}x${filmP.v.height}`, `${FIT_OUT_W}x${FIT_OUT_H}`,
        `成片尺寸 ${filmP.v.width}x${filmP.v.height} ≠ --ratio ${FIT_RATIO} 的 ${FIT_OUT_W}x${FIT_OUT_H}`
        + `（素材是 ${FIT_W}x${FIT_H}）—— 成片若等于素材尺寸，说明 --ratio 没生效；`
        + '若等于别的值，说明尺寸换算错了。');

      // ── 断言 4：★ 音轨**来自 TTS、不是素材原声**（两条互相独立的判据）──
      assert.ok(filmP.a, '成片里没有音轨 —— 现场合成的配音没进成片');
      const aDur = Number(filmP.a.duration);
      assert.ok(Number.isFinite(aDur), `ffprobe 没给出成片音轨的时长：${JSON.stringify(filmP.a.duration)}`);
      assert.ok(Math.abs(aDur - total) < 0.2,
        `成片音轨时长 ${aDur}s 与配音总时长 ${total}s 差超过 0.2s —— 音轨不是这条配音？`);
      assert.ok(aDur > FIT_DUR * 3,
        `成片音轨时长 ${aDur}s 不到素材时长 ${FIT_DUR}s 的 3 倍 —— 音轨可能是素材原声（素材只有 ${FIT_DUR}s）`);
      //   (b) 频谱：素材原声是一个 15 kHz 纯音；TTS 语音在这个频带几乎没有能量。
      //   ★ 守卫：素材自己**必须**在该带内很响，否则「成片里没有它」是空转（本来就没有）。
      const srcBand = await bandMeanDb(srcFile, FIT_TONE_HZ);
      const filmBand = await bandMeanDb(filmPath, FIT_TONE_HZ);
      assert.ok(srcBand !== null && filmBand !== null,
        `15 kHz 带内电平测不到（素材 ${JSON.stringify(srcBand)} / 成片 ${JSON.stringify(filmBand)}）`);
      assert.ok(srcBand > -20,
        `夹具素材在 ${FIT_TONE_HZ} Hz 带内只有 ${srcBand} dB —— 夹具的原声没被推到满刻度`
        + ' ⇒ 「成片里没有这个音」这条断言成了空转。请把夹具音轨推得更满。');
      assert.ok(filmBand < -40,
        `成片在 ${FIT_TONE_HZ} Hz 带内有 ${filmBand} dB（素材原声是 ${srcBand} dB）—— `
        + '这是素材原声那条 15 kHz 纯音！成片音轨本该 100% 来自 TTS（TTS 在该带内实测 ≈ −57 dB）。');

      // ── 断言 5：★ 字幕逐字等于文案（比「拼接后」，与 `⑤++`/`⑤+++` 同口径）──
      const srtPath = path.join(outDir, 'film.srt');
      assert.ok(fs.existsSync(srtPath), `没有 ${srtPath}`);
      const srt = srtJoinedText(srtPath);
      assert.ok(srt.blocks.length > 0, 'film.srt 里一条字幕都没有');
      assert.strictEqual(srt.joined, FIT_TEXT.replace(/\s+/g, ''),
        '成片字幕内容与文案不一致（去空白后比对）：\n'
        + `  文案 ${FIT_TEXT.replace(/\s+/g, '').length} 字\n  字幕 ${srt.joined.length} 字：${srt.joined}\n`
        + `  字幕分 ${srt.blocks.length} 条：${JSON.stringify(srt.blocks)}`);

      // ── 断言 6：★ 真峰值 ≤ 交付线 · 响度落在风格目标 ±1 LU（需求口径）──
      //   容差 0.25 dB 与 `⑤++` 同口径：成片是 AAC 有损编码，实测会把真峰值挪 0.08~0.22 dB。
      const TOL = 0.25;
      const finTP = typeof fin.truePeak === 'number' ? fin.truePeak : fin.peak;
      assert.ok(finTP <= HARD_PEAK_LIMIT + TOL,
        `成片真峰值 ${finTP} dBTP 超过交付线 ${HARD_PEAK_LIMIT}（含 AAC 编码余量 ${TOL}）`);
      assert.ok(Math.abs(Number(fin.lufs) - wantLufs) <= 1.0,
        `成片集成响度 ${fin.lufs} LUFS 没有落在风格目标 ${wantLufs} ± 1 LU 内`
        + `（差 ${Math.abs(Number(fin.lufs) - wantLufs).toFixed(2)} LU）`);
      //   再独立量一次（不采信工具自述）：口径与 `dub.mjs` 一致（`loudnorm` 真峰值 + `ebur128` 响度）
      const filmL = await measureLoud(filmPath);
      assert.ok(filmL.tp !== null && filmL.ebur128 !== null && filmL.lufs !== null,
        `独立量成片响度失败：${JSON.stringify(filmL)}`);
      assert.ok(filmL.tp <= HARD_PEAK_LIMIT + TOL,
        `独立实测成片真峰值 ${filmL.tp} dBTP 超过交付线 ${HARD_PEAK_LIMIT}（容差 ${TOL}）`);
      //   ★ 响度判据落在 **ebur128**（项目权威口径）上，不落在 `loudnorm input_i` 上 ——
      //     后者是另一个口径，短片 + 含静音时实测能差 1 LU 以上（见 `measureLoud` 的注释）。
      assert.ok(Math.abs(filmL.ebur128 - wantLufs) <= 1.0,
        `独立实测（ebur128 口径）成片响度 ${filmL.ebur128} LUFS 不在 ${wantLufs} ± 1 LU 内`
        + `（同一次运行：loudnorm 口径 ${filmL.lufs}、工具自述 ${fin.lufs}）`);
      //   ★ 口径一致性：工具自述的 `lufs` 与测试独立实测的 `ebur128` 都是 ebur128 口径，不该差太多
      assert.ok(Math.abs(filmL.ebur128 - Number(fin.lufs)) <= 0.3,
        `成片响度「工具自述 ${fin.lufs}」与「测试独立实测 ${filmL.ebur128}」差 `
        + `${Math.abs(filmL.ebur128 - Number(fin.lufs)).toFixed(2)} LU（都应是 ebur128 口径）`);

      // ── 断言 7：★ 素材**真的被循环了**（逐帧亮度剖面 vs 三种 fit 的语义模型）──
      //   素材是一条 0→255 的亮度斜坡 ⇒ 「成片第 i 帧的亮度」= 素材被取到了哪一时刻。
      const M = await frameProfile(srcFile, outDir);
      const O = await frameProfile(filmPath, outDir);
      assert.ok(M && M.length >= 30, `素材逐帧剖面读不到或太短：${M && M.length}`);
      assert.ok(O && O.length >= 30, `成片逐帧剖面读不到或太短：${O && O.length}`);
      assert.ok(Math.abs(O.length - total * 30) <= 2,
        `成片帧数 ${O.length} 与 total×30 = ${(total * 30).toFixed(0)} 差超过 2 帧`);
      const maes = { loop: fitMae(O, M, 'loop'), trim: fitMae(O, M, 'trim'), slow: fitMae(O, M, 'slow') };
      assert.ok(maes.loop <= 12,
        `成片剖面与 loop 模型（素材循环）的平均差 ${maes.loop.toFixed(2)} 灰度 —— 太大，素材没被循环？\n`
        + `  三种模型的平均差：loop ${maes.loop.toFixed(2)} / trim ${maes.trim.toFixed(2)} / slow ${maes.slow.toFixed(2)}`);
      assert.ok(maes.loop * 4 <= maes.trim && maes.loop * 4 <= maes.slow,
        `成片剖面并没有**明显**更贴合 loop 模型：loop ${maes.loop.toFixed(2)} / trim ${maes.trim.toFixed(2)} / slow ${maes.slow.toFixed(2)}`
        + ' —— 默认 fit=loop 下，成片应当最像「素材循环」，且与另两种模型差 4 倍以上。');
      const dEdges = fitDownEdges(O);
      assert.ok(dEdges >= 3,
        `成片剖面只有 ${dEdges} 个「亮度骤降 >150」的下降沿 —— 素材（2.0s）被铺进 ${total.toFixed(2)}s，`
        + `循环播放应当产生 ≥3 次「画面回到开头」的骤降。没有骤降 ⇒ 没在循环。`);

      ctx.note(`⑤++++++ 形态 B + 现场 TTS 实测：成片 ${filmP.v.width}x${filmP.v.height}（--ratio ${FIT_RATIO}；`
        + `素材 ${FIT_W}x${FIT_H}）· total ${total}s · 音轨 ${aDur}s（≈ total，素材只有 ${FIT_DUR}s）· `
        + `${FIT_TONE_HZ} Hz 带内 素材 ${srcBand} dB → 成片 ${filmBand} dB（素材原声没进成片）· `
        + `真峰值 ${finTP} dBTP ≤ ${HARD_PEAK_LIMIT} · 响度 ${fin.lufs} LUFS（DNA 目标 ${wantLufs}）· `
        + `逐帧剖面 loop/trim/slow 平均差 ${maes.loop.toFixed(2)}/${maes.trim.toFixed(2)}/${maes.slow.toFixed(2)}，下降沿 ${dEdges}`);
    },
  },
  {
    // ★ 为什么必须有这条：`--fit` 的**真出片行为**（`loop` 的 `-stream_loop -1` / `trim` 的
    //   `tpad` 冻结末帧 / `slow` 的 `setpts` 放慢）此前**零覆盖** —— `⑤+++++` 只到 `--dry-run`
    //   的参数面，而 `--fit` 只在**形态 B 的非 `--keep-original`** 路径生效（那条路必须跑 TTS）。
    // ★★ 本用例的核心（也是最容易做错的一处）：**三者时长完全相同，时长/帧数不是判据**。
    //   三者的 mux 都是 `-t total`（`dub.mjs` 第 [6] 步）⇒ loop 循环到 total、trim 用 `tpad`
    //   补到 total、slow 用 `setpts` 拉到 total。写「三者时长不同」就是一条**恒真**的假绿断言。
    //   真实差别在**画面内容** ⇒ 判据落在「逐帧亮度剖面」上（夹具是一条 0→255 亮度斜坡，
    //   「成片某帧的亮度」=「素材被取到了哪一时刻」）。
    // ★ 三者各自还各有一条**结构性**判据，彼此独立、且互相排斥：
    //     loop ⇒ 剖面有 ≥3 个「亮度骤降」下降沿（画面又从头开始）；trim/slow ⇒ 0 个；
    //     trim ⇒ 末 30% 的亮度**冻结在素材最高亮度**（≥240）；slow ⇒ 末 30% 还没到顶（≤230）。
    name: '⑤+++++++ --fit 真出片差异（loop/trim/slow 各跑一次）：帧数都 = total×30（时长不是判据），逐帧亮度剖面各自符合「循环 / 冻结末帧 / 放慢」的语义',
    run: async (ctx) => {
      const ttsPy = path.join(CFG.winLib, 'core', 'tts', 'tts_indextts.py');
      assert.ok(fs.existsSync(ttsPy),
        `Index-TTS 执行体不存在：${ttsPy}\n  这条用例要跑三次现场 TTS（每次一个 --fit 值）；缺了就无法覆盖`
        + '`--fit` 的真出片行为 —— 这是**用例无法成立**，不是被测代码坏了。');
      const ttsHome = process.env.INDEXTTS_HOME || 'D:/Index-tts/Index-tts_v2.5';
      const lockPath = process.env.INDEXTTS_LOCK || path.join(ttsHome, '.indextts.lock');
      // ★ 用工具的**过期接管**判据（属主已死 / 锁龄>LOCK_STALE ⇒ 残留放行），不是「文件在不在」
      const lockGate = await checkIndexttsLock(lockPath);
      if (!lockGate.ok) assert.fail(lockGate.message);
      if (lockGate.takeover) console.log(`ℹ ${lockGate.note}`);

      fs.mkdirSync(CFG.exportDir, { recursive: true });
      const baseDir = path.join(CFG.exportDir, `${TEST_DIR_PREFIX}fitd-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(baseDir, { recursive: true });
      ARTIFACTS.dirs.add(baseDir);   // 三次运行的子目录都在它下面，递归删一次即可

      const srcFile = path.join(baseDir, '_src.mp4');
      const m = await makeFitMaterial(srcFile);
      assert.ok(m.ok && fs.existsSync(srcFile),
        `造夹具素材失败（WSL ffmpeg lavfi）：code=${m.code}\n${String(m.err).slice(-800)}`);
      const scriptFile = path.join(baseDir, '_script.txt');
      fs.writeFileSync(scriptFile, `${FIT_TEXT}\n`, 'utf8');

      // ── 夹具自检：素材必须「比配音短」，否则三条 fit 分支一条都不会被走到 ──
      const srcP = await probeMedia(srcFile);
      assert.ok(srcP && srcP.v, `ffprobe 读不出素材的视频流：${JSON.stringify(srcP)}`);
      assert.ok(Math.abs(Number(srcP.dur) - FIT_DUR) < 0.05,
        `夹具素材时长 ${srcP.dur}s ≠ ${FIT_DUR}s`);
      const M = await frameProfile(srcFile, baseDir);
      assert.ok(M && M.length >= 30, `素材逐帧剖面读不到或太短：${M && M.length}`);
      //   ★ 夹具的**区分力守卫**：素材若退化成纯色（或亮度不随时间变），三种模型的剖面会塌成同一条，
      //     那本用例就变成「三者都一样」的恒真断言。这里先算三种模型两两的平均差，必须足够大。
      const sep = fitModelSeparation(M, Math.round(8.4 * 30));
      for (const [k, v] of Object.entries(sep)) {
        assert.ok(v > 40,
          `夹具区分力不足：模型 ${k} 的逐帧平均差只有 ${v.toFixed(1)} 灰度（要求 > 40）——`
          + ' 素材的亮度没有随时间明显变化（或变化与 fit 语义无关），本用例会退化成恒真断言。');
      }

      // ── 三次真出片：loop / trim / slow ──
      const runs = {};
      for (const fit of ['loop', 'trim', 'slow']) {
        const runDir = path.join(baseDir, `${TEST_DIR_PREFIX}${fit}`);
        fs.mkdirSync(runDir, { recursive: true });
        ARTIFACTS.dirs.add(path.join(CFG.exportDir, 'dub', '_verify', path.basename(runDir)));
        const r = await runNode(['dub.mjs', '--script', scriptFile, '--video', srcFile,
          '--fit', fit, '--ratio', FIT_RATIO, '--style', FIT_STYLE, '--out', runDir],
        { cwd: ctx.root, timeoutMs: 900000 });
        assert.strictEqual(r.code, 0,
          `--fit ${fit} 出片退出码 ${r.code}（期望 0）\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}\n--- stderr ---\n${r.stderr.slice(-2000)}`);

        const lastJson = (r.stdout.match(/^\{.*"truePeak".*\}$/m) || [])[0];
        assert.ok(lastJson, `--fit ${fit}：stdout 末尾没有结果 JSON\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
        const fin = JSON.parse(lastJson);
        const total = Number(fin.total);
        assert.ok(Number.isFinite(total) && total > FIT_DUR * 2,
          `--fit ${fit}：total ${JSON.stringify(fin.total)} 不大于素材时长 ${FIT_DUR}s 的两倍 —— fit 分支不会被走到`);

        const filmPath = path.join(runDir, 'film.mp4');
        assert.ok(fs.existsSync(filmPath), `--fit ${fit}：没有 ${filmPath}`);
        const filmP = await probeMedia(filmPath);
        assert.ok(filmP && filmP.v, `--fit ${fit}：ffprobe 读不出成片视频流`);
        assert.strictEqual(`${filmP.v.width}x${filmP.v.height}`, `${FIT_OUT_W}x${FIT_OUT_H}`,
          `--fit ${fit}：成片尺寸 ${filmP.v.width}x${filmP.v.height} ≠ ${FIT_OUT_W}x${FIT_OUT_H}（--fit 不该改几何）`);

        const O = await frameProfile(filmPath, runDir);
        assert.ok(O && O.length >= 30, `--fit ${fit}：成片逐帧剖面读不到或太短：${O && O.length}`);
        //   ★ 帧数 = total×30（三种 fit **都一样**）—— 如实钉住「时长不是判据」这条事实。
        assert.ok(Math.abs(O.length - total * 30) <= 2,
          `--fit ${fit}：成片帧数 ${O.length} ≠ total×30 = ${(total * 30).toFixed(0)}（±2）—— `
          + '三者的 mux 都是 `-t total`，帧数只由 total 决定、与 --fit 无关。');

        const maes = { loop: fitMae(O, M, 'loop'), trim: fitMae(O, M, 'trim'), slow: fitMae(O, M, 'slow') };
        const own = maes[fit];
        const others = Object.entries(maes).filter(([k]) => k !== fit);
        assert.ok(own <= 12,
          `--fit ${fit}：成片剖面与该值自己的语义模型的平均差 ${own.toFixed(2)} 灰度 —— 太大。\n`
          + `  三种模型的平均差：loop ${maes.loop.toFixed(2)} / trim ${maes.trim.toFixed(2)} / slow ${maes.slow.toFixed(2)}\n`
          + `  （loop=素材循环 / trim=冻结末帧 / slow=整体放慢）`);
        for (const [k, v] of others) {
          assert.ok(own * 4 <= v,
            `--fit ${fit}：成片剖面并没有**明显**更贴合自己的模型 —— ${fit} ${own.toFixed(2)} vs ${k} ${v.toFixed(2)}`
            + '（要求自己的平均差至少小 4 倍）⇒ 实现走的分支与 --fit 给的值不符。');
        }
        //   ★ 计划行透传（放在**实质判据之后**：这一条只证明「参数传到了、计划行照实打印」，
        //     而上面那条才是「行为真的按这个值做了」——变异验证时应当由**上面那条**先响）。
        assert.match(r.stdout, new RegExp(`· fit ${fit}`),
          `--fit ${fit} 的计划行里没有「· fit ${fit}」\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);

        //   ★ 结构性判据（与模型拟合相互独立，且三种 fit 互相排斥）
        const dEdges = fitDownEdges(O);
        const tailMin = fitTailMin(O, 0.30);
        if (fit === 'loop') {
          assert.ok(dEdges >= 3,
            `--fit loop：剖面只有 ${dEdges} 个「亮度骤降 >150」的下降沿（期望 ≥3）——`
            + ' 素材只有 2.0s 而成片约 8.4s，循环播放必须产生多次「画面回到开头」的骤降。');
        } else {
          assert.ok(dEdges === 0,
            `--fit ${fit}：剖面有 ${dEdges} 个「亮度骤降 >150」的下降沿 —— 这是**循环**的特征，`
            + ` 而 --fit ${fit} 不该循环（trim 冻结末帧 / slow 只放慢）。`);
        }
        if (fit === 'trim') {
          assert.ok(tailMin >= 240,
            `--fit trim：末 30% 的最小亮度只有 ${tailMin}（素材最高亮度是 ${M[M.length - 1]}）——`
            + ' trim 应当把素材放完后**冻结在末帧**，末段亮度应贴住素材最高值。');
        }
        if (fit === 'slow') {
          assert.ok(fitMaxFallback(O) <= 12,
            `--fit slow：剖面最大回落 ${fitMaxFallback(O)} 灰度 —— 放慢播放应当单调不减。`);
          const want70 = M[Math.min(M.length - 1, Math.floor(0.70 * M.length))];
          const got70 = fitAt(O, 0.70);
          assert.ok(Math.abs(got70 - want70) <= 25,
            `--fit slow：成片 70% 处的亮度 ${got70}，而「素材放慢到 total」的模型给出 ${want70}（差 ${Math.abs(got70 - want70)}）——`
            + ' slow 应当把素材整体拉长，70% 处仍远未到素材最高亮度。');
        }
        runs[fit] = { total, frames: O.length, maes, dEdges, tailMin };
      }

      // ── 三者**彼此不同**（结构性判据两两互相排斥）──
      assert.ok(runs.loop.dEdges >= 3 && runs.trim.dEdges === 0 && runs.slow.dEdges === 0,
        `三者的下降沿数没有形成「loop 独有」的分离：loop ${runs.loop.dEdges} / trim ${runs.trim.dEdges} / slow ${runs.slow.dEdges}`);
      assert.ok(runs.trim.tailMin >= 240 && runs.slow.tailMin <= 230,
        `trim 与 slow 没被末段亮度分开：trim 末 30% 最小 ${runs.trim.tailMin} / slow ${runs.slow.tailMin}`
        + '（trim 应冻结在素材最高亮度，slow 应还没爬到顶）');

      const fmt = (k) => `${k}: total ${runs[k].total.toFixed(3)}s / 帧数 ${runs[k].frames} / 剖面平均差 loop ${runs[k].maes.loop.toFixed(1)} trim ${runs[k].maes.trim.toFixed(1)} slow ${runs[k].maes.slow.toFixed(1)} / 下降沿 ${runs[k].dEdges} / 末30%最小 ${runs[k].tailMin}`;
      ctx.note('⑤+++++++ --fit 三值实测（★ 帧数都 = total×30，时长/帧数**不是**判据；差别在画面）：\n    '
        + ['loop', 'trim', 'slow'].map(fmt).join('\n    '));
    },
  },
  {
    // ★ 为什么必须有这条：`⑤+++++++` 只覆盖了 `--fit` 的**一个方向**（素材 2.0s < 旁白 ~8.4s）。
    //   而 `dub.mjs` 的 fitFilter（dub.mjs:1096-1115）里每一条分支都写着**两个方向**：
    //     · slow —— 只有 `srcDur < total-0.05` 才 `setpts=PTS*(total/srcDur)`；否则**掉进 loop 分支的 return**（只 `geom`）
    //     · trim —— 只有 `srcDur < total-0.05` 才 `tpad=stop_mode=clone` 冻结末帧；否则只 `geom`
    //     · loop —— 短则给输入加 `-stream_loop -1`；长则只 `geom`
    //   而裁切一律由 mux 的 `-t total` 完成（dub.mjs:1142）
    //   ⇒ **反向（素材 ≥ 旁白）时三者的画面滤镜链其实等价**：都只 `geom`，成片 = 素材的**前 total 秒**。
    //   这条用例把这个「等价」**钉死**（而不是写成恒真断言）：三者的剖面都必须等于「素材前缀」这一条模型，
    //   且**必须与 slow 的「整体拉长」模型差 4 倍以上**。若有人去掉 slow/trim 的方向守卫
    //   （让 slow 在反向也去 setpts），slow 会把整条素材压进 total ⇒ 末帧亮度从中间值跳到 255，当场变红。
    // ★ 期望值是从实现推出来的，不是抄正向用例的：反向时成片第 i 帧 = 素材第 i/30 秒
    //   （因为 `-t total` 只裁不改速）⇒ 逐帧亮度 = 255·(i/30)/srcDur ⇒ 末帧亮度 ≈ **255·total/srcDur**
    //   这个**中间值**。正向分支下末帧要么是 255（trim 冻结/slow 拉到顶）要么是 0（loop 回卷），
    //   都不是它 —— 所以这条判据对「走错方向」是**可证伪**的。
    name: '⑤++++++++ --fit 反向分支（素材 ≥ 旁白）真出片：loop/trim/slow 都只取素材前 total 秒（剖面 = 素材前缀、单调不循环、末帧亮度 = 255·total/srcDur）',
    run: async (ctx) => {
      const ttsPy = path.join(CFG.winLib, 'core', 'tts', 'tts_indextts.py');
      assert.ok(fs.existsSync(ttsPy),
        `Index-TTS 执行体不存在：${ttsPy}\n  这条用例要跑三次现场 TTS（每次一个 --fit 值）；缺了就无法覆盖`
        + '`--fit` 的反向分支 —— 这是**用例无法成立**，不是被测代码坏了。');
      const ttsHome = process.env.INDEXTTS_HOME || 'D:/Index-tts/Index-tts_v2.5';
      const lockPath = process.env.INDEXTTS_LOCK || path.join(ttsHome, '.indextts.lock');
      // ★ 用工具的**过期接管**判据（属主已死 / 锁龄>LOCK_STALE ⇒ 残留放行），不是「文件在不在」
      const lockGate = await checkIndexttsLock(lockPath);
      if (!lockGate.ok) assert.fail(lockGate.message);
      if (lockGate.takeover) console.log(`ℹ ${lockGate.note}`);

      fs.mkdirSync(CFG.exportDir, { recursive: true });
      const baseDir = path.join(CFG.exportDir, `${TEST_DIR_PREFIX}fitr-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(baseDir, { recursive: true });
      ARTIFACTS.dirs.add(baseDir);   // 三次运行的子目录都在它下面，递归删一次即可

      const srcFile = path.join(baseDir, '_src.mp4');
      const m = await makeFitMaterial(srcFile, { dur: FITR_DUR });
      assert.ok(m.ok && fs.existsSync(srcFile),
        `造夹具素材失败（WSL ffmpeg lavfi）：code=${m.code}\n${String(m.err).slice(-800)}`);
      const scriptFile = path.join(baseDir, '_script.txt');
      fs.writeFileSync(scriptFile, `${FITR_TEXT}\n`, 'utf8');

      // ── 夹具自检：素材必须是一条 0→255 的**单调**亮度斜坡（否则「取到第几秒」这把尺子不成立）──
      const srcP = await probeMedia(srcFile);
      assert.ok(srcP && srcP.v, `ffprobe 读不出素材的视频流：${JSON.stringify(srcP)}`);
      const srcDur = Number(srcP.dur);
      assert.ok(Math.abs(srcDur - FITR_DUR) < 0.05, `夹具素材时长 ${srcP.dur}s ≠ ${FITR_DUR}s`);
      const M = await frameProfile(srcFile, baseDir);
      assert.ok(M && M.length >= 60, `素材逐帧剖面读不到或太短：${M && M.length}`);
      assert.ok(M[0] <= 20 && M[M.length - 1] >= 235,
        `夹具素材不是一条 0→255 的斜坡：首帧 ${M[0]} / 末帧 ${M[M.length - 1]}`
        + ' —— 亮度不随时间变的话，「成片某帧取到素材第几秒」就无从判断。');
      assert.ok(fitMaxFallback(M) <= 12,
        `夹具素材剖面有 ${fitMaxFallback(M)} 灰度的回落 —— 斜坡必须单调不减。`);

      // ── 三次真出片：loop / trim / slow（都应当落在**反向**分支）──
      const runs = {};
      for (const fit of ['loop', 'trim', 'slow']) {
        const runDir = path.join(baseDir, `${TEST_DIR_PREFIX}${fit}`);
        fs.mkdirSync(runDir, { recursive: true });
        ARTIFACTS.dirs.add(path.join(CFG.exportDir, 'dub', '_verify', path.basename(runDir)));
        const r = await runNode([DUB_ENTRY, '--script', scriptFile, '--video', srcFile,
          '--fit', fit, '--ratio', FIT_RATIO, '--style', FIT_STYLE, '--out', runDir],
        { cwd: ctx.root, timeoutMs: 900000 });
        assert.strictEqual(r.code, 0,
          `--fit ${fit} 出片退出码 ${r.code}（期望 0）\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}\n--- stderr ---\n${r.stderr.slice(-2000)}`);

        const lastJson = (r.stdout.match(/^\{.*"truePeak".*\}$/m) || [])[0];
        assert.ok(lastJson, `--fit ${fit}：stdout 末尾没有结果 JSON\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
        const fin = JSON.parse(lastJson);
        const total = Number(fin.total);
        assert.ok(Number.isFinite(total) && total > 0.5, `--fit ${fit}：total 不合理 ${JSON.stringify(fin.total)}`);

        //   ★ 夹具守卫：这一次**必须**落在反向分支（素材 ≥ 旁白）。掉进正向分支的话，
        //     下面的期望值全都不成立 —— 那是**用例配比**问题（TTS 时长抖动），不是被测代码坏了。
        assert.ok(srcDur >= total - 0.05,
          `--fit ${fit}：素材 ${srcDur}s 竟然短于旁白 ${total}s —— 本用例要测的是**反向分支**，`
          + ' 文案/素材时长配比不对（TTS 时长抖动），请把文案改短或素材加长。');

        //   ★ 结构判据：走的是**反向**那一支（「Xs ≥ 配音 Ys」这句只在反向打印，dub.mjs:1108/1113）
        assert.match(r.stdout, /\d+\.\d+s ≥ 配音 \d+\.\d+s/,
          `--fit ${fit}：stdout 里没有「素材 Xs ≥ 配音 Ys」—— 走的不是反向分支？\n`
          + `--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);

        const filmPath = path.join(runDir, 'film.mp4');
        assert.ok(fs.existsSync(filmPath), `--fit ${fit}：没有 ${filmPath}`);
        const filmP = await probeMedia(filmPath);
        assert.ok(filmP && filmP.v, `--fit ${fit}：ffprobe 读不出成片视频流`);
        assert.strictEqual(`${filmP.v.width}x${filmP.v.height}`, `${FIT_OUT_W}x${FIT_OUT_H}`,
          `--fit ${fit}：成片尺寸 ${filmP.v.width}x${filmP.v.height} ≠ ${FIT_OUT_W}x${FIT_OUT_H}（--fit 不该改几何）`);

        const O = await frameProfile(filmPath, runDir);
        assert.ok(O && O.length >= 30, `--fit ${fit}：成片逐帧剖面读不到或太短：${O && O.length}`);
        assert.ok(Math.abs(O.length - total * 30) <= 2,
          `--fit ${fit}：成片帧数 ${O.length} ≠ total×30 = ${(total * 30).toFixed(0)}（±2）`);

        // ── 判据 1（主判据，语义级）：末帧亮度 == 255·total/srcDur ──
        const wantEnd = 255 * total / srcDur;
        const gotEnd = O[O.length - 1];
        assert.ok(Math.abs(gotEnd - wantEnd) <= 20,
          `--fit ${fit}：成片末帧亮度 ${gotEnd}，而「只取素材前 total 秒」的模型给出 ${wantEnd.toFixed(1)}`
          + `（素材 ${srcDur}s / 旁白 ${total}s，差 ${Math.abs(gotEnd - wantEnd).toFixed(1)} 灰度）。\n`
          + '  ★ 反向分支下三者都该是「素材的一段**前缀**」：末帧停在 255·total/srcDur 这个**中间值**上；'
          + ' 若末帧接近 255（整条素材被压进 total）或接近 0，说明实现走了别的分支。');

        // ── 判据 2（结构级）：不循环、单调不减 ──
        assert.strictEqual(fitDownEdges(O), 0,
          `--fit ${fit}：剖面有 ${fitDownEdges(O)} 个「亮度骤降 >150」的下降沿 —— 反向分支不该循环。`);
        assert.ok(fitMaxFallback(O) <= 12,
          `--fit ${fit}：剖面最大回落 ${fitMaxFallback(O)} 灰度 —— 只取素材前缀应当单调不减。`);

        // ── 判据 3（模型拟合）：贴合「素材前缀」，且与「整体拉长」模型差 4 倍以上 ──
        //   No < Nm 时 FIT_MODELS.loop / .trim 都退化成「取素材第 i 帧」= 前缀模型；
        //   FIT_MODELS.slow 是「把素材拉长到 No」= 陡得多的斜坡 ⇒ 必须差得远。
        const maes = { loop: fitMae(O, M, 'loop'), trim: fitMae(O, M, 'trim'), slow: fitMae(O, M, 'slow') };
        assert.ok(maes.loop <= 12 && maes.trim <= 12,
          `--fit ${fit}：剖面与「素材前缀」模型不贴合 —— loop ${maes.loop.toFixed(2)} / trim ${maes.trim.toFixed(2)}`
          + `（要求都 ≤ 12）。slow 模型 ${maes.slow.toFixed(2)}。`);
        assert.ok(maes.slow >= 4 * Math.max(maes.loop, maes.trim),
          `--fit ${fit}：剖面并没有与「整体拉长」模型分开 —— slow 模型 ${maes.slow.toFixed(2)}`
          + ` vs 前缀模型 loop ${maes.loop.toFixed(2)} / trim ${maes.trim.toFixed(2)}（要求 slow 至少大 4 倍）`
          + ' ⇒ 实现可能在反向分支错误地做了 setpts。');

        runs[fit] = { total, frames: O.length, end: gotEnd, wantEnd, maes };
      }

      const fmt = (k) => `${k}: total ${runs[k].total.toFixed(3)}s / 帧数 ${runs[k].frames} / 末帧亮度 ${runs[k].end}`
        + `（模型 ${runs[k].wantEnd.toFixed(1)}）/ 剖面平均差 loop ${runs[k].maes.loop.toFixed(1)}`
        + ` trim ${runs[k].maes.trim.toFixed(1)} slow ${runs[k].maes.slow.toFixed(1)}`;
      ctx.note(`⑤++++++++ --fit 反向分支实测（素材 ${FITR_DUR}s ≥ 旁白 ⇒ 三值都只取素材前 total 秒；`
        + '★ 反向时 loop/trim/slow 的画面链**等价**，差别只在正向）：\n    '
        + ['loop', 'trim', 'slow'].map(fmt).join('\n    '));
    },
  },
  {
    // ★ 为什么必须有这条：`--fit slow` 在 `--keep-original-audio` 下要把素材**原声**一起放慢，
    //   走的是 `atempoChain(1/ratio)`（dub.mjs:1023-1035）。而**单级 atempo 的合法范围只有 [0.5, 100]**
    //   （实测：`atempo=0.25` / `atempo=0.119` 直接报 `Value … out of range [0.5 - 100]`）
    //   ⇒ ratio = total/srcDur > 2 时需要的 tempo < 0.5，**一级放不下，必须串多级**。
    //   这条链此前**零覆盖**：`⑤+++++++` 不传 --keep-original-audio；`⑤+++`/`⑤++++` 走 --keep-original
    //   根本不进这条链。链长算错（少串一级 / 只给一级）会让 ffmpeg 当场报越界，成片直接失败。
    // ★ 判据全部落在**实物**上，不看退出码：
    //   ① 从 `--echo-cmd` 打出的 WSL 脚本里**取出**真实的 atempo 链：逐级取值范围合法、连乘 == srcDur/total；
    //   ② 把**这条链原样**作用在夹具素材的音轨上，量出的时长必须 ≈ total（≈ ratio×srcDur）；
    //   ③ 夹具音调**故意从素材第 0.6s 才开始**（前面是数字静音，实测带内 −91 dB）
    //      ⇒ 成片里 15 kHz 带内电平必须「前半段静、后半段响」—— 这是「atempo 真的把原声**拉长**了」的
    //      **时间级**证据（若没接 atempo，音调会从成片第 0.6s 就开始，前半段窗口当场变响）；
    //   ④ 成片 15 kHz 带内电平整体**远高于** TTS 自身（`⑤++++++` 实测 TTS 在该带 ≈ −57 dB）
    //      —— 证明素材原声真的被混进来了，而不是只打印了一行「已混入」。
    // ★ 期望值推导：ratio = total/srcDur ⇒ 素材音调起点 0.6s 应移到成片 ≈ 0.6·total 处；
    //   `--keep-original-audio` 的混音链把原声压 −20 dB 后 atrim 到 total 再 amix（dub.mjs:1036-1039）。
    name: '⑤+++++++++ --fit slow 的 atempo 链（--keep-original-audio）：多级 atempo、连乘 = srcDur/total、原声真的被放慢并混进成片',
    run: async (ctx) => {
      const ttsPy = path.join(CFG.winLib, 'core', 'tts', 'tts_indextts.py');
      assert.ok(fs.existsSync(ttsPy),
        `Index-TTS 执行体不存在：${ttsPy}\n  这条用例要跑一次现场 TTS（拿到真实 total 才能算出 ratio）；`
        + '缺了就无法覆盖 `--fit slow` 的 atempo 链 —— 这是**用例无法成立**，不是被测代码坏了。');
      const ttsHome = process.env.INDEXTTS_HOME || 'D:/Index-tts/Index-tts_v2.5';
      const lockPath = process.env.INDEXTTS_LOCK || path.join(ttsHome, '.indextts.lock');
      // ★ 用工具的**过期接管**判据（属主已死 / 锁龄>LOCK_STALE ⇒ 残留放行），不是「文件在不在」
      const lockGate = await checkIndexttsLock(lockPath);
      if (!lockGate.ok) assert.fail(lockGate.message);
      if (lockGate.takeover) console.log(`ℹ ${lockGate.note}`);

      fs.mkdirSync(CFG.exportDir, { recursive: true });
      const baseDir = path.join(CFG.exportDir, `${TEST_DIR_PREFIX}fita-${process.pid}-${Date.now().toString(36)}`);
      fs.mkdirSync(baseDir, { recursive: true });
      ARTIFACTS.dirs.add(baseDir);

      const srcFile = path.join(baseDir, '_src.mp4');
      const m = await makeFitMaterial(srcFile, { dur: FITB_DUR, toneOnset: FITB_TONE_ONSET });
      assert.ok(m.ok && fs.existsSync(srcFile),
        `造夹具素材失败（WSL ffmpeg lavfi）：code=${m.code}\n${String(m.err).slice(-800)}`);
      const scriptFile = path.join(baseDir, '_script.txt');
      fs.writeFileSync(scriptFile, `${FIT_TEXT}\n`, 'utf8');

      // ── 夹具自检：音轨必须「前段静音 + 后段 15 kHz 音调」（否则判据 ③ 不成立）──
      const srcHead = await bandMeanDbWindow(srcFile, FIT_TONE_HZ, 0, FITB_TONE_ONSET - 0.1);
      const srcTail = await bandMeanDbWindow(srcFile, FIT_TONE_HZ, FITB_TONE_ONSET + 0.1, FITB_DUR);
      assert.ok(srcHead !== null && srcTail !== null,
        `量不到夹具素材的 15 kHz 带内电平（前段 ${srcHead} / 后段 ${srcTail}）`);
      assert.ok(srcHead <= -60,
        `夹具素材前段（0→${(FITB_TONE_ONSET - 0.1).toFixed(1)}s）15 kHz 带内电平 ${srcHead} dB —— 应当是数字静音。`);
      assert.ok(srcTail >= -20,
        `夹具素材后段 15 kHz 带内电平只有 ${srcTail} dB —— 音调没推满，判据 ③ 会失去区分力。`);

      const runDir = path.join(baseDir, `${TEST_DIR_PREFIX}slow`);
      fs.mkdirSync(runDir, { recursive: true });
      ARTIFACTS.dirs.add(path.join(CFG.exportDir, 'dub', '_verify', path.basename(runDir)));
      const r = await runNode([DUB_ENTRY, '--script', scriptFile, '--video', srcFile,
        '--fit', 'slow', '--keep-original-audio', '--echo-cmd',
        '--ratio', FIT_RATIO, '--style', FIT_STYLE, '--out', runDir],
      { cwd: ctx.root, timeoutMs: 900000 });
      assert.strictEqual(r.code, 0,
        `--fit slow --keep-original-audio 出片退出码 ${r.code}（期望 0）\n`
        + `--- 末尾 stdout ---\n${r.stdout.slice(-3000)}\n--- stderr ---\n${r.stderr.slice(-2000)}`);

      //   ★ 结构判据：真的走了「原声混入」那一支（这句 ok() 只在 dub.mjs:1044 打印）
      assert.match(r.stdout, /素材原声已压到 -20 dB 混入（--keep-original-audio）/,
        `stdout 里没有「素材原声已压到 -20 dB 混入」—— --keep-original-audio 没生效？\n`
        + `--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);

      const lastJson = (r.stdout.match(/^\{.*"truePeak".*\}$/m) || [])[0];
      assert.ok(lastJson, `stdout 末尾没有结果 JSON\n--- 末尾 stdout ---\n${r.stdout.slice(-2000)}`);
      const fin = JSON.parse(lastJson);
      const total = Number(fin.total);
      assert.ok(Number.isFinite(total) && total > 1, `total 不合理 ${JSON.stringify(fin.total)}`);

      const srcP = await probeMedia(srcFile);
      const srcDur = Number(srcP.dur);
      assert.ok(Math.abs(srcDur - FITB_DUR) < 0.05, `夹具素材时长 ${srcP.dur}s ≠ ${FITB_DUR}s`);
      const ratio = total / srcDur;
      //   ★ 夹具守卫：ratio 必须 > 2，否则 1/ratio ≥ 0.5 ⇒ 单级 atempo 就够了，本用例测不到多级链。
      assert.ok(ratio > 2,
        `ratio = total/srcDur = ${ratio.toFixed(3)} ≤ 2 —— 单级 atempo 就够用了，本用例测不到**多级**链。`
        + `（素材 ${srcDur}s / 旁白 ${total}s；把文案加长或素材改短。）`);

      // ── 判据 ①：取出真实的 atempo 链并逐级校验 ──
      //   链在 `--echo-cmd` 打到 **stderr** 的 dub-mix 脚本里（lib/dub-core.mjs:526 的 echo 分支）。
      const cm = /((?:atempo=[\d.]+,)+atempo=[\d.]+)/.exec(r.stderr);
      assert.ok(cm,
        `--echo-cmd 的 stderr 里找不到 atempo 链 —— --keep-original-audio 下没给素材原声做变速？\n`
        + `--- 末尾 stderr ---\n${r.stderr.slice(-3000)}`);
      const chain = cm[1];
      const stages = chain.split(',').map((s) => Number(s.replace('atempo=', '')));
      assert.ok(stages.every((v) => Number.isFinite(v)),
        `atempo 链解析出的分级不是数字：${JSON.stringify(chain)}`);
      assert.ok(stages.length >= 2,
        `atempo 链只有 ${stages.length} 级（${chain}）—— ratio=${ratio.toFixed(3)} 需要 tempo=${(1 / ratio).toFixed(4)} < 0.5，`
        + ' 单级 atempo 的合法范围是 [0.5, 100]，一级放不下 ⇒ 实现少串了级数（ffmpeg 会当场报越界）。');
      for (const v of stages) {
        assert.ok(v >= 0.5 && v <= 100,
          `atempo=${v} 越出 ffmpeg 的合法范围 [0.5, 100]（整条链：${chain}）—— 成片会直接失败。`);
      }
      const prod = stages.reduce((a, b) => a * b, 1);
      const wantProd = srcDur / total;   // = 1/ratio：把原声按 ratio 放慢所需的 tempo 连乘
      assert.ok(Math.abs(prod - wantProd) <= 1e-3,
        `atempo 链的连乘 ${prod.toFixed(6)} ≠ srcDur/total = ${wantProd.toFixed(6)}（链：${chain}）`
        + ' —— 连乘不等于 1/ratio 的话，原声与画面的放慢倍数对不上（音画不同步）。');

      // ── 判据 ②：把**这条链原样**作用在夹具素材的音轨上，量时长 ──
      //   ★ 期望 ≈ total（= ratio×srcDur）。★ 容差取 6%：ffmpeg 的 atempo 是相位声码器，
      //     实测每级会短 ~0.5%（1 级 1.0s→1.9797s / 2 级 →3.9407 / 3 级 →7.8643 / 4 级 →8.2550，
      //     理想分别是 2.0/4.0/8.0/8.4）—— 这不是缺陷，是 atempo 的固有长度口径。
      //     一个**没有** atempo 的结果会是 srcDur（≈1s）、差一个数量级；链错则会直接报错。
      const tmpWav = `/tmp/fita-${process.pid}-${Date.now().toString(36)}.wav`;
      const rA = await wsl([
        `ffmpeg -v error -y -i "${toWsl(srcFile)}" -vn -af "${chain}" -ar 48000 -ac 2 -c:a pcm_s16le ${tmpWav}`,
        `ffprobe -v error -select_streams a -show_entries stream=duration -of csv=p=0 ${tmpWav}`,
        `rm -f ${tmpWav}`,
      ].join('\n'), { timeoutMs: 180000 });
      const chainedDur = Number(String(rA.out).trim().split('\n').filter(Boolean).pop());
      assert.ok(Number.isFinite(chainedDur),
        `把 atempo 链作用到素材音轨上失败：code=${rA.code}\n${String(rA.out).slice(-800)}\n${String(rA.err).slice(-800)}`);
      assert.ok(Math.abs(chainedDur - total) <= 0.06 * total + 0.1,
        `atempo 链把素材音轨（${srcDur}s）拉成了 ${chainedDur}s，而目标（= 成片总时长）是 ${total}s`
        + `（链：${chain}）—— 原声的放慢倍数与画面不一致。`);

      // ── 判据 ③④：成片里的 15 kHz 带内电平（时间位置 + 绝对电平）──
      const filmPath = path.join(runDir, 'film.mp4');
      assert.ok(fs.existsSync(filmPath), `没有 ${filmPath}`);
      const filmHead = await bandMeanDbWindow(filmPath, FIT_TONE_HZ, 0, 0.35 * total);
      const filmTail = await bandMeanDbWindow(filmPath, FIT_TONE_HZ, 0.75 * total, total);
      assert.ok(filmHead !== null && filmTail !== null,
        `量不到成片的 15 kHz 带内电平（前段 ${filmHead} / 后段 ${filmTail}）`);
      //   ④ 原声真的进了成片（TTS 自身在该带 ≈ −57 dB）
      assert.ok(filmTail >= -40,
        `成片后段 15 kHz 带内电平只有 ${filmTail} dB —— 素材原声（音调在素材后 40%）没有混进成片。`);
      //   ③ 时间位置：音调起点被 atempo 从素材的 0.6s 推到了成片 ≈ 0.6·total 处 ⇒ 前 35% 必须是静的
      assert.ok(filmHead <= filmTail - 15,
        `成片前段 15 kHz 带内 ${filmHead} dB 与后段 ${filmTail} dB 差不到 15 dB ——`
        + ` 素材音调本来从第 ${FITB_TONE_ONSET}s 才开始，放慢后应当移到成片 ≈ ${(FITB_TONE_ONSET * total).toFixed(1)}s 处`
        + '（≈ 60% 处）；前半段就响说明原声**没有被 atempo 放慢**（音画不同步）。');

      ctx.note(`⑤+++++++++ --fit slow atempo 链实测（素材 ${srcDur}s / 旁白 ${total}s，ratio ${ratio.toFixed(2)}）：`
        + `链 ${chain}（${stages.length} 级，连乘 ${prod.toFixed(6)} vs 期望 ${wantProd.toFixed(6)}）· `
        + `链作用到原声后 ${chainedDur.toFixed(3)}s（目标 ${total.toFixed(3)}s）· `
        + `成片 15 kHz 带内 前35% ${filmHead} dB → 后25% ${filmTail} dB（素材原声确实被放慢并混入）`);
    },
  },
];
