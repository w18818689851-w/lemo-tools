# test/ —— lemo 控制台冒烟测试

把「交付后的人工验证」固化下来：起服务 → 打接口 → 跑 dry-run → 校验编排器没被改坏。
**零依赖**（只用 `node:assert` / `node:http` / `node:child_process` / `node:crypto`），没有 jest/mocha/vitest。

```bash
node test/smoke.mjs              # 全部用例，不含完整回归（约 15–40 秒；本机 WSL 冷启动时会到 1–2 分钟）
node test/smoke.mjs --full       # 额外跑完整回归：全链路出片 + **现场 GPU TTS** + 第三条通路（`--keep-original`，不占 GPU）
                                 #   ★ 波动几乎全来自 WSL 冷启动；现场 TTS 用例本身稳定 ~35 秒，
                                 #     而新增的三条 `--keep-original`/`--fit` 用例合计约 25 秒且**不吃 GPU**
node test/smoke.mjs --filter ③   # 只跑名字里含 "③" 的用例
node test/smoke.mjs --keep-server  # 跑完不杀测试服务（调试用，自己记得收）

node test/setup.test.mjs         # 首次运行安装的**纯逻辑**测试（12 条）
node test/setup-api.test.mjs     # 「首次运行向导」两个接口的 HTTP 契约测试（9 条，★ 绝不真安装）
node test/ui.test.mjs            # Web UI 层测试：无头 Edge 渲染 DOM + CDP 真点击（59 条）
node test/consistency.test.mjs   # 「字幕 ↔ 语义 ↔ 画面」一致性校验门的纯逻辑测试（17 条）
node test/dub-semantic.test.mjs  # 语义解析 / 风格匹配的纯逻辑测试（11 条，★ 含 visual 维度的向后兼容）
node test/briefs.test.mjs        # 「主题工单」数据层 + 接口 + UI 的测试（16 条，★ 含「控制台出片写进 _jobs 独立目录、不覆盖样板片」+「--ratio 的 `:` 判据」「filmUrl 指向本次产物」）
node test/originality.test.mjs   # 「从零原创」审计器的纯逻辑测试（零依赖）
node test/style-skill-reader.test.mjs  # 风格 Skill 文档读取入口的纯逻辑测试（6 条，★ 钉「缺失即 null 绝不抛」的硬契约）
node test/triple-check.test.mjs   # 三者一致性校验门（**全项目唯一允许调 7B VLM 的地方**）的纯逻辑测试（29 条）
node test/dub-lexicon.test.mjs    # 规则词表 TAG_LEXICON / lexiconCoverage 的纯逻辑测试（12 条，★ 词表数据完整性）
node test/dub-api.test.mjs        # /api/dub/* 七个接口的契约与校验测试（18 条，★ 含上传路径穿越防护 + 文案出片成片字节路由 /api/films/dub/:dir/:file 的 200/206/416/HEAD 与路径穿越）
node test/voices-api.test.mjs     # /api/voices/{sources,import,test,test/audio} 的契约与校验测试（9 条，只测失败路径）
node test/style-scan.test.mjs     # 风格源码指纹机制（约定一「自动纳入」的判据）测试（15 条，★ 该变就变/不该变就不变）
node test/triple-check-flow.test.mjs  # verifyTriple 主流程端到端测试（11 条，★ 用桩 LM Studio，绝不碰真实模型）
node test/dub-align.test.mjs      # 功能2「口播 cue ↔ 文案句」时间轴对齐纯逻辑测试（7 条，★ 无空档 / 最短可读时长）
node test/dub-split.test.mjs      # 断句 splitSentences 纯逻辑测试（10 条，★ 硬切不切在词/记号内部 + 切片 trim + 拼回不丢字）
node test/gate-blindness.test.mjs # 闸门「守卫 + 核心判据」回归套件（72 条：**全部 31 个闸门**的失明/反向守卫 + **12 条核心判据**，每条都含「正向命中 + 阴性对照」，另含 25 个「改坏守卫或判据必须变红」自证）
node test/slot.test.mjs           # 整机渲染限流器 core/render/slot.mjs 的行为测试（21 条，★ 槽位上限用子进程并发验排队 + 过期槽接管 + .mutex 清理 + CLI 退出码透传 + release 绝不抛）
```

`test/setup.test.mjs` 与 `test/ui.test.mjs` 都是**独立入口**，故意不并进 `smoke.mjs`：安装逻辑、UI 层各自一个数字，三边互不干扰。
`setup.test.mjs` 不起服务、不碰 WSL（只测 `lib/setup.mjs` 的纯函数）；`ui.test.mjs` 自己起一个临时服务 + 无头 Edge。
`consistency.test.mjs` 同样不起浏览器、不碰库（只测 `lib/consistency.mjs` 的纯函数）——
真正「加载页面取 `window.PROBE`」那一段属于集成层，由 `consistency-check.mjs` 负责，只能在真片上验。

退出码：**全绿 0 / 有用例失败 1 / 测试自身异常 2**。
最后一行汇总 `N passed, M failed`。

---

## 覆盖了什么（41 条，`--full` 时 50 条）

### ① 编排器未被改坏（红线）

| 用例 | 断言 |
|---|---|
| 编排器 md5 未被改动 | `lemo-make.mjs` 的 md5 == `6283aadb98433b16ea2a35c2a754cd30` |

控制台只是**包装层**，绝不能改编排器。这条是整个项目的红线，失败信息直说「编排器被改动了 —— 控制台不应该修改它」。

★ 但它拦的是「**控制台的功能偷偷改编排器**」，不是「编排器永远不许变」。如果确实**有意**给编排器加了正式功能
（例如 2026-10-02 的 `--voice` / `--speed`），正确做法是：`md5sum lemo-make.mjs` → 更新 `test/cases.mjs` 的
`ORCH_MD5` **和**本表里的值（两处必须一致，否则下一个人会以为红线坏了），并在 `cases.mjs` 里写一句这次改了什么。

★ **2026-10-03 更新**：编排器接入**风格特质档案（style-dna）** —— 新增 import 共享 reader（`lib/style-dna-reader.mjs`）、
按档案取颗粒（grain）并做兜底、在档案真生效时打印一行提示，以及 HELP 文案。这是**有意给编排器加功能**，
故基线 md5 由 `c5f94c9552c5437775ce5911b1a00788` → `440fb6a34ead67d427832d5633666a1e`。红线本身**未动**（仍然拦人）。

★ **2026-10-05 更新**：主题通路（`lemo-make.mjs`）补上**出片前的显存守卫** —— 在「音频链路」两个 phase
启动之前调用 `lib/vram.mjs` 的 `ensureVramFree()`（与 dub.mjs 的 TTS 前守卫**同一接口、同一语义**：
预检 → 不足才自动卸载常驻模型 → 仍不足则硬拦失败，`LEMO_NO_VRAM_FREE=1` 可关）。此前只有 dub 通路
有这道守卫，主题通路的 TTS 在显存被常驻大模型占满时会**静默挂死**（项目有过一小时事故）。这是**有意给
编排器加功能**，故基线 md5 由 `314d7fc8a341b6d77189e368552291f3` → `d5a1b91b0113d611e3211e31f31f1be0`。
红线本身**未动**（仍然拦人）。

★ **2026-10-06 更新**：混流后的**帧数比对改为优先读元数据**。原先 `lemo-make.mjs` 在混流前后各跑一次
`ffprobe -count_frames`（全片扫帧）来比对「渲染源 vs 成片」的帧数，用途是拦 `-shortest` 切掉最后一帧
（`backrooms` 实测 `1433/1432`）。实测这两次扫描在 122s 片上一次 ≈10.2s（源侧）+ ≈7.1~7.8s（成片侧），
**每片白花 ≈17~18s**，与「本地渲染速度最大化」这条硬规则冲突。现改为优先读容器元数据 `nb_frames`
（实测 0.04s），**读不到 / 为 0 / 非数字时回落原来的全片扫帧**（兜底不省，回落也读不出来时仍走
「帧数读不出来」那道闸 `MUX_FAIL`，绝不静默放过）。失败语义一字未变：帧数不符仍 `MUX_FAIL`、读不出来仍 die。
这是**有意改编排器**（纯性能，不削弱校验），故基线 md5 由
`d5a1b91b0113d611e3211e31f31f1be0` → `d1330d8bfcfd44c7b270dd49eb73d23c`。红线本身**未动**（仍然拦人）。

★ **2026-10-06 更新（音频链调度：配乐与「配音 + ASR」并行）**：`lemo-make.mjs` 的音频链里，「配乐」
原先串在「配音 + ASR」之后，而配乐并不依赖配音。现把「配乐」一节从「配音」之后提到之前、以 `( … ) &`
**后台起跑**，并在「混音」之前用 `wait "$MUSIC_PID"` 收尾（位置与原串行版一致：配音 → 配乐 → 拟音 → 混音）。
是否并行**由代码判据推出、不写死风格名单**：该 demo 的配乐脚本是否引用 `voices/` 目录或配音阶段产物
（`dur.json` / `words.json` / `words_rel.json` / `lips.json`）。全库 43 风格实测只有 **2 个命中、保持串行**：
`game-show/demo/music.py:24`（把喊词采样混进音乐做闪避）与 `living-screencast/demo/sound.py:200`
（它同时兼任混音，`MUSIC_DEDUP` 会跳过配乐步）；`hologram-hud` 里出现的 `voices=` 是 `pad_chord()` 的
**函数参数**（去谐声部数），**不命中** —— 按 slug 写死会误判。相位边界不变：`'voice'`（`LEMO_VOICE_ONLY=1`）
整块不跑配乐，`'rest'`（`LEMO_SKIP_VOICE=1`）无配音步可重叠 ⇒ 走前台、与改前逐字节等价。
实测（`dataviz`，同参数同 `--out` 的 A/B）：音频链 22.5s → 19.0s（省 3.5s / 15.3%，恰为配乐时长），
成片**逐字节不变**（整文件 / 视频流 / 解码 rawvideo / 音频流四重 md5 全同），失败仍 `exit 1`（不吞）。
这是**有意改编排器**（纯调度，不动渲染/混流/内容/参数），故基线 md5 由
`d1330d8bfcfd44c7b270dd49eb73d23c` → `46f74990491db53901598fedcd53dc01`。红线本身**未动**（仍然拦人）。

★ **2026-10-06 更新（库路径加环境变量覆盖点）**：`lemo-make.mjs` 的 `CFG.winLib` / `CFG.wslLib`
原先**写死**为 `D:\lemo-opuscar` 与 `/home/lemo/lemo-opuscar`，既没有 `--lib` 参数也没有环境变量。
实测新 clone 上跑 `node <clone>/tools/lemo-make.mjs art-deco --skip-sync --dry-run` 虽 `exit 0`，
但打印的仍是 `--out D:\lemo-opuscar\...` ⇒ **它跑的是真库、不是 clone**，「新克隆能不能跑」这件事
**无法端到端验证**。现两处均改为 `process.env.LEMO_LIB_WIN` / `LEMO_LIB_WSL` 覆盖，命名照既有
`LEMO_MANIFEST` / `LEMO_LOCK_DIR` 的习惯（`LEMO_` + 角色 + 侧别）；**默认值即原写死值**，
⇒ 不设变量时行为逐字节不变。两侧必须**成对**设置，只覆盖一侧会让 Windows 与 WSL 指向不同的库、
编排器会拒绝开工。这是**有意改编排器**（只加覆盖点，不动任何逻辑），故基线 md5 由
`46f74990491db53901598fedcd53dc01` → `65ddab4495bdf52a4aab78b4a51f8457`。红线本身**未动**（仍然拦人）。

★ **2026-10-06 更新（字幕告警措辞与第 6 步对齐 · E 类）**：第 3 步的字幕告警原写「该 demo 没有本编排器
支持的字幕生成器 —— 字幕源不重新生成，**.srt 将沿用仓库里已提交的旧文件**」。但**第 6 步混流**会再跑
一次「demo 自带的 srt 生成器」，可能**当场产出**新的 `.srt` ⇒ 第 3 步那句断言会**误导**读者以为字幕一定
是旧的（`.srt` 诊断里归为 3 条「告警误导」）。现第 3 步改为「本编排器**不生成**字幕源；`.srt` 是否更新
**取决于第 6 步混流**（该 demo 若自带 srt 生成器则由它产出）」，第 6 步的告警补明「（第 3 步编排器未产出、
demo 自带 srt 生成器本次也没产出）」，两处**口径一致**。**纯措辞，不改任何逻辑/行为**（分支条件、判定、
输出文件一律未动）。这是**有意改编排器**，故基线 md5 由
`65ddab4495bdf52a4aab78b4a51f8457` → `dfa990043fa1b8368a7011fbc03c1ad0`。红线本身**未动**（仍然拦人）。

★ **2026-10-06 更新（补上 art-deco 漏跑的变调步 `tools/pitch.py`）**：一次编排器端到端实跑
（`node lemo-make.mjs art-deco --out <临时目录> --ratio 16:9`，`exit 0`）与 `styles/art-deco/demo/build.sh`
逐条对照后**确证**：编排器**漏跑 `$D/tools/pitch.py`**，而它**改变音频内容** —— `tools/pitch.py:9`
做 `k = 2**(st/12)` 的变调重采样（音色更年轻、时长随之变短），`:11` **改写 `voices/dur.json`**；
`lines.json` 里 B1 / B2 带 `"pitch": 4`。实测编排器出的 `dur.json` 是 `B1 1.009 / B2 1.113`，
而 `1.009 / 2^(4/12) = 0.801`、`1.113 / 2^(4/12) = 0.883` —— 正好等于**跑前那份（做过 pitch 的）**
⇒ 编排器通路里门童两句「+4 半音、更年轻」的音色**静默丢失**（成片照出、`exit 0`，只有拿 `dur.json`
逐条对照才看得出来）。**修法**：在音频链「配音」段里、`voices/*.wav` 非空校验**之后**、ASR / 回传
Windows **之前**，新增一步候选探测（照 `MUSIC` / `MIX` 那几处同一个
`for c in …; do [ -f ] && break; done` 形状，**不写死 slug**），候选 = `$D/tools/pitch.py`，
只在文件存在时跑、不存在就跳过不出声（全库只有 art-deco 有它）。★ **位置是硬约束**：`pitch.py`
会改写 `voices/dur.json`，而 `dur.json` 是「配音 → 回传 → 渲染」时序链的判据（渲染页初始化时
`fetch` 它排口播时间窗），回传之后再改就白搭；同时它必须落在 `LEMO_SKIP_VOICE` 块**之内**，
否则 `'rest'` 相位（配音已在前置阶段跑过）会把变调**叠加两次**。同步改了 `orchestratorRuns()` 的
`runs[]` 镜像（否则起飞前检查会把 `pitch.py` 误报成「编排器漏跑」）。
★ **同时把「编排器漏跑」做成机器可检的**（只改检查、不改执行）：在 `preflight` 里新增
**只提示、绝不阻断**的 `ORCH_SKIP_STEPS` 登记表 + `reportOrchSkipSteps()`，报出「本 demo 的
`build.sh` 有、而编排器不跑」的步骤，按影响分四级（`content` 影响成片内容 / `delivery` 只影响
交付图 / `selfcheck` 纯自检 / `none` 已实测核实「不跑与跑逐字节无差异」—— 这一档是 2026-10-07 为
hologram-hud 的确定性素材生成器 `gen_volt.mjs` / `gen_kite.mjs` 新增的）。补的正是「声明里
`assets_required` 多为空（实测 43 个 demo 里只有 1 个
有）⇒ 漏跑的步骤根本不出现在任何报告里」那个**全静默**盲区；它**不依赖声明**（只读本仓库文件 +
`orchestratorRuns`），所以声明缺失/损坏时照样有效。★ **没有**把这些步骤写进 `runs[]` ——
`runs[]` 的语义是「编排器本次**会执行**它」，写进去会让起飞前检查把它们当成「会跑」而**静默**，
与「让缺口可见」正好相反（详见 `lemo-make.mjs` 的 `ORCH_SKIP_STEPS` 注释）。完整差异清单与各自影响
见 `README.md` 的「编排器与 `build.sh` 的差异清单」表。这是**有意改编排器**（补一个真缺口 +
让同类缺口可见，不削弱任何校验），故基线 md5 由
`dfa990043fa1b8368a7011fbc03c1ad0` → `caab495c8104130732266e5d1bf2db8b`。红线本身**未动**（仍然拦人）。

★ **2026-10-07 更新（补上三个「build.sh 有、编排器漏跑、且影响成片内容」的步骤）**：承接 2026-10-06 的
`pitch.py`（第 1 例），把 `ORCH_SKIP_STEPS` 登记表里另外三条 **impact: content** 的缺口**逐条核实并补进编排器**：

1. **`tools/trim_cmd.py`**（全库 43 风格里**仅 microgame** 有）。build.sh 顺序是 `tts.py` → `trim_cmd.py`
   → `asr_check.py`。它解决的问题写在 docstring 里：「Kokoro 念单个词结尾会带一个元音尾巴」
   （Pump → "Pompey"）。做法：把 `lines.json` 里带 `trim` 字段的行（microgame 4 条：
   `c_pump` / `c_catch` / `c_zip` / `c_pull`）按 whisper 词时间戳只留第一个词、末尾 40ms 淡出，
   并**改写三样**：① 裁剪后的 wav（人声内容本身）；② `voices/dur.json`（时长随之变短）；
   ③ `lines.json.asr.json`（把这几行的 `asr` 期望文本设成那个词）。旧编排器一步不跑 ⇒ 4 个命令词仍带
   元音尾巴、`dur.json` 停在未裁剪的时长，而成片照出、`exit 0`。
   **位置与 `pitch.py` 同级同约束**（两条都不许动）：配音**之后**（读刚写出的 wav 与 dur.json）、
   回传 Windows / ASR **之前**（`dur.json` 是「配音 → 回传 → 渲染」时序链的判据）；且必须落在
   `LEMO_SKIP_VOICE` 块**之内**（否则 `'rest'` 相位会**二次裁剪**已裁过的 wav）。
   **附带一处**：ASR 的**输入行文件**换成 `$D/lines.json.asr.json` —— **仅当本步真跑过**时
   （microgame 的 build.sh 用的就是它）。拿原始 `lines.json` 去比会把「已裁到只剩 Pump」的音频和期望
   文本「Pump, now!」比 ⇒ 4 条假 DIFF。`words.json` 本身与 `asr` 字段无关（只由转写决定）⇒
   这条只影响校对措辞与 `asr_check` 的退出码，**不影响成片**。之所以加「仅当本步真跑过」的条件：
   没有 `trim_cmd.py` 的 demo 若仓库里躺着一份陈旧的 `lines.json.asr.json`，无条件优先会拿旧期望
   文本核新音频（同一类「陈旧文件伪装成新的」坑）。

2. **`tools/export_cues.mjs`**（全库**仅 urban-sketch** 有）。build.sh 顺序是 `events.mjs` →
   `export_cues.mjs` → `audio/score.py` → `audio/foley.py`。它**开页面**读
   `window.STROKES / TRACK() / EV / DUR`，写 `demo/audio/cues.json` —— 那是 WSL 侧
   `audio/foley.py:12` `json.load(open(os.path.join(D, 'cues.json')))` 的**直读输入**，决定拟音轨的
   全部时间与声像。旧编排器不跑它 ⇒ 拟音按**旧画面**的笔画与轨迹排，而画面已换新内容。
   **位置**：Windows 侧 `exportEventsAndSubs()` 的第 **①-b** 步（紧跟 `events.mjs`，与 build.sh 同序）；
   必须在**并行段之前**（消费者在 WSL 侧、产物要先回传），也必须在 `mix.py` 之前（`foley.py` 的产物
   又是 `mix.py` 的输入）。它**开页面 ⇒ 只能在 Windows 侧跑**，产物落在 Windows 库 ⇒ 已把
   `${demoRel}/audio/cues.json` 加进**回传 WSL 清单**（否则 `foley.py` 读到 WSL 上那份陈旧的）。
   无参数调用（与它自己的 build.sh 一致）。失败走 `fail()`（不静默）。

3. **`tools/words.py`**（全库**仅 dataviz / swiss-motion** 有）。build.sh 顺序是 `asr_check.py` →
   `words.py` → `events.mjs`。它读 `lines.json` + `voices/words.json`（**`asr_check.py` 刚写的那一份**），
   按字符位置比例把 whisper 的词起点映射到原文单词上，写 `voices/words_rel.json` —— 两个风格的页面
   `main.js` 直读它（`dataviz/main.js:11`、`swiss-motion/main.js:12`）驱动字幕**逐词出现**。
   **陈旧证据（实测）**：WSL 侧 `dataviz/voices/words_rel.json` 的 mtime 停在 **9/30 14:50**，而 `words.json`
   已是 **10/6 09:57**（swiss-motion 同：`words_rel` 9/30 vs `words` 10/5）。★ 口径如实说明：**9/30 14:50 是
   整棵 WSL 库的检出时间**（同期大量文件——含各风格 `stills/*.jpg`——都是这个 mtime）⇒ 这条 mtime 只说明
   「**自检出以来它从未被重写过**」；而 `words.json` 的 mtime 明显更晚 ⇒ 它被重写过而派生物没有。两者合起来
   才构成证据：编排器从未跑过 `words.py`，而新配音照常出声、`exit 0`（无法区分）。
   **位置硬约束**：必须排在 `asr_check.py` **之后**（要读它刚写的 words.json）、`VOICE_DONE` / 回传
   **之前**（`words_rel.json` 在 `backFiles` 回传清单里）。**只在 ASR 真跑了的分支里跑**：跳过 ASR ⇒
   `words.json` 是上一版内容的陈旧产物 ⇒ 由它派生的 `words_rel.json` 同样陈旧，与既有的「ASR 跳过
   不回传 words.json」原则一致 —— 因此跳 ASR 时 `words_rel.json` 也**一并**从回传清单里剔除。

★ 三处都照 `pitch.py` 的范例写：候选探测 `for c in "$D/tools/xxx"; do [ -f "$c" ] && { …; break; }; done`
（**不写死 slug**）、文件不存在**静默跳过**、失败**不静默**（`STEP_FAIL <名字>` + `exit 1`）。
同步改了 `orchestratorRuns()` 的 `runs[]` 镜像（加入这三个脚本路径），否则起飞前检查会把它们继续报成
「编排器漏跑」；同时从 `ORCH_SKIP_STEPS` 登记表里**移除**这三条（它们已被编排器跑，且该表本来就会对
「编排器会跑」的脚本自动不再报，移除是为了让表里只剩真缺口）。

★ 另两条**判断为不改编排器**（如实登记，不硬做）：

- **`models/gen_volt.mjs` / `models/gen_kite.mjs`（hologram-hud）—— 不跑无差异。** 重跑产物与入库版
  **逐字节相同**（实测 md5：volt `b25a8e24f408fd44b241b3ee1f9169e4` / kite
  `9f1badb70c1bf786c285bec358a4c168`）⇒ 是确定性生成物，不重生成**不产生任何差异**。故不为它改编排器；
  登记表里 impact 由 `content` 降为**新增的 `none` 档**（措辞：「已核实：不跑与跑无差异」），
  保留登记只为让「build.sh 有、编排器不跑」这件事本身可见。

这是**有意改编排器**（补三个真缺口 + 如实降级一条误报，不削弱任何校验），故基线 md5 由
`caab495c8104130732266e5d1bf2db8b` → `58e2bcbae682b4167444f0dd66445771`。红线本身**未动**（仍然拦人）。

★ **2026-10-07 下半场更新（接上 risograph 的 `tools/video_png.mjs`：换渲染器，PNG 无损中间片）**：
上面「另两条判断为不改编排器」里的 `tools/video_png.mjs` 当时判「不接」，本轮**已接上**。这不是画质偏好 ——
risograph 的网点色（粉/蓝）在 JPEG 的 4:2:0 里会被吃掉，`core/render/video.mjs` 用 `mjpeg` + `yuv420p`
⇒ 编排器此前出的 risograph 成片**视觉上是降级的**（网点被压掉），属**产品正确性**问题。
它在 `build.sh:12` **替换**渲染器（PNG 截图 + `yuv444p` 无损中间片），不是「追加一步」。
上一轮列了三条硬伤；本轮逐条处理时**又跑出第 4 条**（2b，拼接一步在本机必 EBUSY）—— 4 条都记在下面。

1. **给 `styles/risograph/demo/tools/video_png.mjs` 补 `--size` / `--ratio`**（上一轮列的第 ① 条硬伤）。
   照 `core/render/page.mjs` 的 `takeSize` **同源**解析（`const args = …, { w: W, h: H } = takeSize(args), …`），
   **不自己发明一套解析**；`w/h` 传给**两处** `openDemo`（probe 与每个 worker），顺带补上 core 版有的
   `requireDemo(dir)`（本文件自称是 `core/render/video.mjs` 的副本，这是副本该有的契约）。缺这个口时
   编排器传的 `--size WxH` 会被**静默丢掉**、按缺省 1920x1080 出片（9:16 尤其明显）。
   缺省值仍是 1920x1080（`FALLBACK_SIZE`，与全库 35 个 `build.sh` 的调用一致）⇒ **不改默认、无回归**。
2. **编排器渲染段改成候选探测**（上一轮列的第 ③ 条硬伤里「要改编排器」的那一半）：新增
   `const demoRenderRel = [`${demoRel}/tools/video_png.mjs`].find(r => fs.existsSync(path.join(CFG.winLib, r)))`
   → `renderScriptRel = demoRenderRel || 'core/render/video.mjs'`，再拿它当 `renderVArgs[0]`。
   形状照同文件里 `demoMuxRel` 的 `.find()` 候选写法；**不写死 slug**（路径由 `demoRel` 拼出来）。
   ★ **只换可执行脚本，参数与落点一字不动**：`--fps / --workers / --size WxH / --out out/video_gpu.mp4 / --q`
   全部照旧。
2b. ★ **上一轮漏掉的第 4 条硬伤（本轮端到端跑出来的）：`video_png.mjs` 的拼接一步在本机必 EBUSY。**
   `core/render/video.mjs:108` 的拼接显式传了 `execFileSync(…, { stdio: ['ignore','inherit','inherit'] })`，
   而 `video_png.mjs:42` 的**同名同用途**调用**没传**（副本漂移）⇒ 默认 `['pipe','pipe','pipe']`。
   本机实测：**Node 的 `spawnSync`/`execFileSync` 只要走 pipe 就 EBUSY**（`spawnSync('cmd.exe',['/c','echo','hi'])`
   同样 EBUSY；换成 `stdio:'ignore'` 或 `'inherit'` 则 `status 0`）—— `lemo-make.mjs:261` 早就记过
   「本环境 spawnSync 一律 EBUSY」。**实测后果**：第一次端到端跑，6 个 worker 把 960 帧全渲完
   （86s、分段合计 1.4GB）后在拼接处 `EBUSY` 退出码 1 —— **全部白渲**。修法是照 core 版补上同一个
   `stdio` 选项（**不是新发明**，是补齐副本漂移），顺带让 ffmpeg 的报错能真的打到 stderr
   （pipe 时被 `execFileSync` 吞掉）。
   ★ 这条**不是**本轮引入的：改前 `video_png.mjs` 也长这样 ⇒ 该 demo 自己的 `build.sh` 在本机同样跑不到底。
3. ★ **上一轮列的第 ② 条硬伤（输出名对不上）经复核不成立、无需改**：`video_png.mjs:18` 本来就吃
   `--out`（`opt('--out', …)`），而编排器**显式传**了 `--out …/out/video_gpu.mp4` ⇒ 它写的就是
   `video_gpu.mp4`，`mux.sh` 读的正是这个名。另：渲染段原本就有「**退出码 0 但没产出 `video_gpu.mp4`
   ⇒ 失败**」的断言（`if (!fs.existsSync(v)) return { ok:false, … }`），所以「输出名对不上」会被**大声拦下**，
   不会静默出一部错片 —— 上一轮想要的那条断言本来就在。
   （上一轮的第 ③ 条「要改 `D:/lemo-opuscar` 的脚本」由第 2 条 + 第 5 条覆盖：本轮该文件在允许改动范围内，
   且已镜像 WSL。）
4. ★ **红线三处同步**（本表 + `test/cases.mjs` 的 `ORCH_MD5` + `README.md` 的差异清单）：
   `58e2bcbae682b4167444f0dd66445771` → `315887dd9e38702bb057e02f38a97b54`。
   ★ **2026-10-07 再改一次**（纯注释）：`lemo-make.mjs` 里那句引 `core/tts/asr_check.py:116` 的注释**是失效引用**
   （`:116` 实为 `return 'offline'`；真正写 `words.json` 的那句 `json.dump` 在 **`:168`**）⇒
   按引用纪律第 12 条**改成符号锚**（「`core/tts/asr_check.py` 里写 `words.json` 的那句 `json.dump`」），从此不再随行号漂。
   md5 `315887dd9e38702bb057e02f38a97b54` → **`6283aadb98433b16ea2a35c2a754cd30`**。
   另同步 `orchestratorRuns()` 的 `runs[]`（加入 `${d}/tools/video_png.mjs`，否则起飞前检查会继续把它
   报成「编排器漏跑」）并从 `ORCH_SKIP_STEPS` **移除**该条（它已被编排器跑；移除后该表的
   **impact: content 一档为空**，如实说明：内容级缺口目前清零，表结构保留）。
5. ★ **库仓文件已镜像 WSL 并逐字节核对**（`D:/lemo-opuscar/.../tools/video_png.mjs` →
   `/home/lemo/lemo-opuscar/.../tools/video_png.mjs`，`tr -d "\r"` 后 md5 两侧相同；
   `node scripts/check-dual-copy-sync.mjs` **exit 0**）。
6. ★ **端到端证据**（`node lemo-make.mjs risograph --out D:/lemo-tmp/agent-risograph/e2e --ratio 16:9 --skip-sync`，
   `--out` 指临时目录，**不碰已发布样板片**）：
   - **走的是 video_png.mjs**：编排器日志/dry-run 里的渲染命令行是
     `node styles/risograph/demo/tools/video_png.mjs styles/risograph/demo --fps 24 --workers 6 --size 1920x1080 --out D:\lemo-opuscar\…\out\video_gpu.mp4`
     （`--size 1920x1080` 由 `--ratio 16:9` 推出 ⇒ 画幅没丢）。
   - **中间片是 PNG 不是 JPEG**：渲染期抓到的 ffmpeg 进程命令行（Windows `Win32_Process`，见
     `D:/lemo-tmp/agent-risograph/ffargv.txt`）为
     `ffmpeg -f image2pipe -c:v png -i - -c:v h264_nvenc -preset p5 -rc constqp -qp 0 -profile high444p -pix_fmt yuv444p …\out\seg_N.mp4`
     —— 输入是 **`-c:v png`**、输出是 **`yuv444p` / `high444p`**；中间片 `ffprobe`：
     `profile=High 4:4:4 Predictive, pix_fmt=yuv444p, 1920x1080, 960 帧, 1316.5 MB`。
     对照：同一部片用 `core/render/video.mjs`（JPEG 中间片）渲 = `profile=High, pix_fmt=yuvj420p, 74.1 MB`。
   - **两版有可见差异（像素比对：同一部片 / 同 960 帧 / 同 `--size 1920x1080` / 同 `--fps 24`，只换渲染器）**：
     `SSIM  Y 0.969497 | U 0.781050 | V 0.773607 | All 0.841384`；
     `PSNR  y 31.596 | u 25.213 | v 27.114 | avg 27.253 dB`。
     逐平面**平均绝对差**（`ffmpeg -pix_fmt yuv444p -f rawvideo` 全片流式比对 1,990,655,525 个像素；
     **注意 yuv444p 是 planar，三平面各 1920×1080 字节，别按交织读**）：
     `Y 13.482（max 190，差>16 占 43.87%）| U 9.323（max 131，18.82%）| V 7.554（max 120，12.96%）`，三平面合计 **10.120/255**。
     RGB 交织口径另算：`R 12.701 / G 12.622 / B 12.734`，合计 **12.685/255**，单像素最大通道差 **252**，
     **通道差 >16 的像素占 45.60%**。
     ★ **差异的重心在色度**：SSIM 上 `Y 0.970` 而 `U/V 只有 0.78` —— 亮度里网点的**结构**还在，
     色度里已被 4:2:0 抹平，正是「网点色被吃掉」的特征（绝对差 Y 最大是因为 JPEG 在网点边缘有振铃）。
   - **抽帧亲眼看**：`D:/lemo-tmp/agent-risograph/riso-frames/` 下 `{jpeg,png}_f485_zoom.png`（t=20.17s）与
     `{jpeg,png}_t10_zoom.png`（t=10s）。**PNG 版**：蓝点/绿点**颗颗分离、边缘锐利**，底色是**干净的白**，
     `BAKERY` 白字压在蓝底上**无彩边**。**JPEG 版**：同位置的网点被抹开、白底泛**米黄/灰**，
     粉伞边缘有**品红彩边**、伞内白区出现**灰色斑点**（4:2:0 色度下采样的典型伪影）。
   - **GPU 证据两条**：① 渲染期抓到的 ffmpeg 命令行含 **`-c:v h264_nvenc -preset p5`**；
     ② 混流期在 WSL 抓 `/proc/<pid>/cmdline`（`D:/lemo-tmp/agent-risograph/mux-proc.txt`）得到
     `ffmpeg … -map [v] -map [a] -c:v h264_nvenc -preset p5 -profile high -rc vbr -cq 20 -b:v 0 -r 24 -c:a aac …`
     —— 且这次重跑 mux 的成片与编排器交付的那份**逐字节相同**（md5 均 `5edf6a4ee3a64436d827b0299c68b9ff`）
     ⇒ 抓到的是**同一次编码**。
     ③ ★ **从成片文件本身读编码器特征串（有字面量，不是只能读 profile）**：
     `ffprobe -show_streams` 读**成片**得 `streams[0].TAG:encoder = "Lavc60.31.102 h264_nvenc"`
     （`Lavc60.31.102` 是 **WSL 侧** ffmpeg 的版本号，与「混流跑在 WSL」一致）；
     PNG 中间片得 `TAG:encoder = "Lavc63.1.102 h264_nvenc"`（**Windows 侧** ffmpeg）。
     （`format` 级的 `TAG:encoder=Lavf60.16.100` 才是 muxer 名，别拿它当编码器。）
     另做**判别器**对照实验（同源 12 帧分别编码）：`libx264` 会把 `x264 - core 165 r3223` 写进 bitstream，
     `h264_nvenc` **不写**；本次成片与中间片**都不含 `x264 - core` 串** ⇒ 与 `nvenc` 标签互证。
   - **样板片未被动过**：`D:/lemo-films/risograph/risograph.mp4` 与 `.srt` 跑前跑后 md5 **完全相同**
     （`6b2b5a7d8d0bec2deb8894a9b128e3f1` / `9db104a4c80bc11cae8495f59091dbc6`）。
   - **两仓 git status 对照**：库仓跑前**干净**、跑后**只有** `M styles/risograph/demo/tools/video_png.mjs`
     （本次有意改动）—— `.srt` / `events.json` / `stills/*` / `poster.jpg` **一个都没被覆写**
     （编排器把 `.srt` 写在 **WSL 侧**的库里，Windows 侧那份未动）；工具仓跑前干净、跑后 5 个本次改动文件。
     ⇒ **无需从备份还原**（备份在 `D:/lemo-tmp/agent-risograph/backup/`，已核对无差异）。
   红线本身**未动**（仍然拦人）。
   ★ **本次端到端跑出来的两处环境/仓库事实（如实记录）**：
   （i）本机 **Node `spawnSync`/`execFileSync` 只要 stdio 走 pipe 就 EBUSY**（见 2b）；
   （ii）**`D:/lemo-tmp/agent-risograph/` 被另一个并发智能体同时写入**（目录里出现 `jpg.raw` / `png.raw`
   各 ≈5.97 GB、`frames/jpg_10.0.png` 等**非本次产物**）⇒ 该目录**不是**独占的；本次自己的产物一律放在
   子目录 `e2e/`、`jpeg/`、`riso-frames/`、`backup/` 下，未删改任何非本次文件。
7. ★ **验收跑的退出码（本次执行实测，如实记录；含两条「不是本次改动引入」的红）**：
   - `node --check lemo-make.mjs` / `video_png.mjs` **exit 0**；五个改动文件 CR 计数全为 **0**（纯 LF）。
   - **30 个闸门全 `exit 0`**（逐个跑 `scripts/check-*.mjs`，含 `check-film-delivery` / `check-dual-copy-sync`
     / `check-render-venc` / `check-ref-lines`）。★ **原记**：本行的「30」是**那一次（risograph 批）当时的实测值**，
     保留不改（改了就是伪造历史）；**闸门总数现为 31**（2026-10-07 新增 `check-mux-parity.mjs`），
     现值以本文件开头的「闸门」表与 `test/gate-blindness.test.mjs` 头注释为准。
     ★ 顺带一条：`check-render-venc.mjs` 的 **B 类 backlog 清单**
     仍把 `styles/risograph/demo/tools/video_png.mjs` 列作「**不在出片路径上的**手工脚本」——
     本轮之后它**已经**在出片路径上了，该清单的**分类过期**（只是措辞，B 类**不判 FAIL**，故闸门仍 exit 0）。
     本条**不在允许改动范围内**（`scripts/` 不许动），**留给下一轮**：把它从 `B_FILES` 挪到 `pushA(...)`。
     ★★ **已办（2026-10-07 b85-a）**：照本条照办 —— `check-render-venc.mjs` 里已 `pushA(path.join(STYLES, slug, 'demo', 'tools', 'video_png.mjs'), …)`（A 类，由 15 项缩为 **14** 项），
     `B_FILES` 不再列它。原句保留作历史（当时的约束「`scripts/` 不许动」已随该批解除）。
   - **17 个测试入口**：15 个首跑即 `exit 0`。两个红，**都不是本次改动引入**，且都有独立证据：
     · `test/smoke.mjs` 首跑 `exit 1`（⑤ CLI dry-run 2 条红）—— **原因是并发锁竞争**：
       同一时刻另一个 `lemo-make ascii-crt` 占着 `D:\lemo-films\.ascii-crt.lock`，
       手动复现得到一模一样的「已有另一个 lemo-make 在跑同一个 demo（pid 12720）」。
       把锁目录隔离（`LEMO_LOCK_DIR=<临时目录> node test/smoke.mjs`）后 **40 passed / 0 failed / exit 0**。
     · `test/ui.test.mjs` 三次干净重跑：`56/3`（B7,C2,C3）→（日志被两个进程混写，作废）→ **`58 passed / 1 failed`（只剩 B7）**。
       B7 的失败断言是**扫全表**的：`[...document.querySelectorAll('#jobs .jbatch')]` 里每一条都得是 `批 N/2`，
       而持久化的任务历史 `D:\lemo-films\.console\index.json`（**已可用 `LEMO_FILM_DIR` 隔离** —— 2026-10-07 起 `lib/store.mjs:25` 的 `ROOT` 认这个覆盖点，与 `scripts/prune-jobs.mjs` 同名同义；未设时行为逐字节不变）
       里有**另一个并发智能体**在 `2026-10-06T19:10:23Z` 留下的 `batchTotal:1` 任务（`jmux200kg-1` / `impasto`）
       ⇒ 列表里混进一个 `批 1/1`。**本次改动与它无关**：B7 走 `--dry-run --skip-sync`，根本不进渲染段，
       且本次从未起过控制台/批次。★ 这是 `ui.test.mjs` 自身的**用例脆弱性**（API 侧已按 `priorBatchIds` 排除历史、
       DOM 侧没有）—— 修它要改 `test/ui.test.mjs`，**不在允许改动范围内**，如实登记留给下一轮。

### ② 行尾规则未被破坏

| 用例 | 断言 |
|---|---|
| 源码行尾全为 LF | 项目里所有 `.mjs/.js/.css/.html/.md` + `.gitattributes/.gitignore`（含 `test/` 自己）CR 计数 == 0 |
| **所有 `.bat` 均为 CRLF**（不只 `start-console.bat`） | 仓库里每个 `.bat` 都满足 CR > 0 且 CR == LF，失败信息列出文件名与 CR/LF 计数 |
| `.gitattributes` 行尾规则在位 | 含 `* text=auto eol=lf` 与 `*.bat text eol=crlf` |

依据是 `.gitattributes`；这条防的是 **git 操作静默改写源码行尾**（本项目踩过）。
计数用 `Buffer` 逐字节数 `\r` / `\n`，**不用 `grep $'\r'`**（Git Bash 下不可靠）。

### ③ HTTP 接口（测试自己起服务，随机端口）

| 用例 | 断言 |
|---|---|
| `GET /` | 200 · `text/html` · 含 `<!DOCTYPE html>` |
| `GET /api/env` | 200 · `summary.total` 是数字 · `runnable` 是布尔 · `groups` 非空 |
| `GET /api/demos` | 200 · `styles.length == 43` · `categories.length == 9` · `categorized == true` · **0 个未归类** · `count` 与 `styles.length` 一致 |
| `GET /api/films` | 200 · `films` 是数组 |
| `GET /api/jobs` | 200 · `jobs` 是数组 · `queue` 快照存在 |
| `GET /api/console` | 200 · `store.ready === true` |
| `GET /api/style/ascii-crt` | 200 · 渲染结果里**无裸 `<script>`/`<iframe>`** · **无 `on*=` 事件属性** · 无 `javascript:` 伪协议 |
| `GET /api/precheck?slug=ascii-crt` | 200 · `locked`/`stale`/`alive` 都是布尔 · `locked` 与 `stale` 不同时为 true |
| `GET /api/sizes` | 200 · `defaultRatio === '9:16'` · `ratios` 5 条且 9:16 排最前 · 每个比例的 `w`/`h`/`pixels` 与库侧换算**独立手算**的表逐项一致（9:16→1080x1920 / 16:9→1920x1080 / 3:4→1440x1920 / 4:3→1920x1440 / 1:1→1920x1920）· `custom={min:96,max:8192,even:true,example:'1080x1920'}` · `error===null`、`source` 指向库侧 `size.mjs` |
| `GET /api/langs?slug=…` | 缺 / 非法 slug → 400；4 个白名单风格逐个与**磁盘** `content*.<code>.json` 推导的可用语言逐字一致 · `defaultLang='en'` · 有 zh 内容文件的风格 `default='zh'`（否则 `'en'`）· 不可用语言落在 `unavailable`（`available:false`、`files:[]`）· `contentFiles` 与目录一致 · zh 的 `tts.engine='indextts'` 真的透传出来 |
| `GET /api/aspects?slug=…` | 缺 slug → 400；`engraving` 探测到全 5 比例（`probe='text'`、`declared:true`）· **交叉核验**（★ 直接读源文件、**不经 `lib/aspects.mjs`** —— 那正是被测对象）：正向 `engraving/demo/film{,_coffee}.js` 确有 `export const NATIVE`（自适应标志）；反向样本 = **唯一**不支持 9:16 的 `pixel-rpg` —— 它**没有 `demo/film*.js`**，故按其**真实入口**（`demo/index.html` 的 `import('./sheet.js')` / `import('./main.js')`）读 `main.js` / `sheet.js`，断言其中**没有**自适应改造标志（`NATIVE` / `setFrame` / `layout(`）· 未声明 `aspects` 的风格（现仅 `pixel-rpg`）只支持 `['16:9']`、`note` 点明「只支持 16:9」· `?film=<模块名>` 精确到一部（**判据是文件名不是 FILM_META.id**）· 未知 slug / 非法 film 名都不抛（退回 `['16:9']` 并给 `error`） |
| `POST /api/briefs`（非法比例 / 尺寸） | `ratio='7:5'`、`size` 奇数 / 越界 / 非 `WxH` 等 **8 种写法**一律 400，且**工单数不变**（校验在落盘之前，不会留垃圾工单） |
| `GET /api/definitely-not-a-route` | 404 |
| `POST /api/run`（非法 slug / 非法 opts） | 400（注入防护） |
| 目录穿越（4 种变形） | 状态码 400/403/404 且响应体不含 server.mjs 源码特征串；**对照**：`/app.js` 必须 200 —— 否则「不是 200」可能只是静态服务整体坏了 |
| markdown 渲染器转义（**单测**） | 直接给 `lib/styles.mjs` 喂 `<script>` / `<img onerror=>` / `javascript:` 链接 / 表格里的 `<svg onload=>`，断言输出里没有可执行内容 |
| 端口后扫决策（**单测**） | 直接测 `lib/portscan.mjs` 的 `scanPort()`（server.mjs 的 `start()` 调的就是它），用**假 binder** 覆盖六条分支：一绑就上（不多试）· **EACCES 才向后扫**（7788→7789→7790→7791，`moved=true`）· EADDRINUSE **不换端口** · 其它错误**不换端口** · 整段保留 → 扫满 `MAX_SCAN+1` 个后放弃 · 越过 65535 立即放弃。并断言 `MAX_SCAN === 40` / `MAX_PORT === 65535` |
| `GET /api/voices` | 200 · `ok:true` · `voices` 非空 · **四组恒定齐全**（`alias` / `library-alias` / `official` / `library`）· **各分组 items 数之和 == `voices` 条数**（防漏项 —— 有音色没被任何分组收走就会少一条）· 分组里的每个名字都真实存在于 `voices` 里 · `source` 读得到当前 engraving 内容文件的音色（读不到是 `null`，但读了就必须是合法形状） |
| `GET /api/voices/audio?name=<第一个别名>` | 200 · `Content-Type` 含 `audio/` · `Accept-Ranges: bytes` · `Content-Length` > 10000（防「不是真实音频字节流」）· `Range: bytes=0-1023` → **206** 且 `Content-Range` / 长度 / 首 16 字节与整份一致 |
| `GET /api/voices/audio` 安全性 | `name=../../../../windows/win.ini`（正斜杠）与 `..\..\..\windows\win.ini`（反斜杠）→ **都 404**，响应里无 win.ini 特征串；一个「形状合法但清单里没有」的名字 → 也 404 且带 `error` 说明。判据是「`name` 只用来查表，永不拼进路径」，所以目录穿越无从发生 |

> 注入检查只扫**真正的标签**（`<tag …>`），不扫转义后的正文 —— 否则正文里写 `&lt;img onerror=x&gt;`（已转义成纯文本、完全无害）会假阳性。

### ④ dry-run 任务全链路（API 层）

一条用例串起三件事：

1. `POST /api/run` 传 `{slug:'ascii-crt', opts:['--skip-sync','--dry-run']}` → 200 且有 `job.id`
2. 轮询 `GET /api/jobs` 直到该任务结束（超时 60s）→ `status == 'done'` 且 `exitCode == 0`
3. `GET /api/logs/:id` 走 SSE → 至少回放到一行日志、**日志里出现步骤标记 `[1]`**、并且回放了 `end` 事件

跑完把 `job.id` 存进 `ctx.state`，给 ⑥（取消）与 ⑦（断线续传 / 跨重启）当素材。

### ⑤ CLI 未受影响

| 用例 | 断言 |
|---|---|
| CLI dry-run 仍 exit 0 | `node lemo-make.mjs ascii-crt --skip-sync --dry-run` → exit 0 |
| CLI dry-run 打印步骤标记 `[1]` | 输出含 `[1]` |

证明包装层没有破坏命令行用法。

### ⑤+ 完整回归（只在 `--full` 时跑）

`node lemo-make.mjs ascii-crt --skip-sync --out <_smoke-临时目录>` → exit 0 且输出含 `MUX_OK`、`src_frames=1435`、`out_frames=1435`。
**默认不跑**（会真渲染 + 混流；实测 147–441 秒，波动来自 WSL 冷启动）。
★★ **必须给 `--out`**（2026-10-03 修的破坏性副作用）：本用例原来**不给 `--out`**，编排器就写回默认库路径 `D:/lemo-films/ascii-crt/ascii-crt.mp4`，**把已交付成片覆盖掉**了（实测：交付版 1920×1080 / 29,712,494 B 被重渲成 1080×1920 / 21,880,427 B）。
  现在写进 `_smoke-orch-*` 临时目录并登记进 `ARTIFACTS.dirs`（`cleanupArtifacts` 的两道守卫只认 `_smoke-` 前缀）。
  ★ 断言（exit 0 / `MUX_OK` / 帧数）与输出目录无关 ⇒ 改 `--out` **不削弱本用例的覆盖力**。
  ★ 顺带记一条口径：`lemo-make.mjs` 的 `--ratio` **默认 9:16（竖屏）**，所以本用例渲出的是竖屏；交付的 ascii-crt 成片是当年用 `--ratio 16:9` 渲的横屏 —— 两者几何不同是**默认值差异**，不是回归。

### ⑤++ 现场 TTS + style-dna 响度目标（只在 `--full` 时跑）

**为什么要有它**：`⑤+` 跑的是「用**预生成**配音混流出片」—— ascii-crt 的 demo 自带 `voices/`，
音频步根本不会调 TTS，于是**全程不碰 GPU TTS**。而 TTS 这条路径恰恰出过三次真事故
（自死锁 / 显存预检拒载 / 孤儿进程），此前只有 `--dry-run` 与参数级验证撑着，**从没被真跑过**。

**跑法**：`node dub.mjs --script <临时文案> --style engraving --size 270x480 --out <测试目录>`
（270x480 = 9:16 的 1/4 比例，够验几何又不把时间耗在编码上）。

**为什么用 `dub.mjs` 而不是 `lemo-make.mjs`**：`targetLufs`（style-dna 的音频响度目标）这条链
**只在 `dub.mjs` 里接**（`lemo-make` 读 DNA 只取 `grain`）。两条链路共用同一个 TTS 执行体
（`core/tts/tts_indextts.py`），所以「锁 / 显存预检 / 看门狗」这三条也一并覆盖到了。

| 断言 | 判据 |
|---|---|
| TTS 真跑了 | stdout 含 `TTS_DONE`；且含 TTS 脚本的逐条回执行 `l1 <时长> <文本>`（时长落在 (0.5, 15) 秒、文本与输入逐字一致）—— ★ **不能**用「`_tts/*.wav` 还在不在」当判据：dub.mjs 成功后会清掉它（`dub.mjs` 的「清理中间产物（成功才清）」段） |
| 时长回传有效 | `dur.json` 的 `l1` 落在 (0.5, 15) 秒 |
| ★ style-dna 接进链路 | stdout 含「响度目标 **−14** LUFS，**来自风格特质**」——这句**只在** `targetLufs ≠ 通用默认 −16` 时才打印 |
| ★ 串行锁「取了又放」 | 跑前锁不存在（否则**立刻失败**，不等 2 小时）→ 跑中 200ms 轮询**观察到**锁 → 跑完锁**已释放** |
| ★ 响度按 DNA 归一 | 成片真峰值 ≤ −1.7 dBFS（容差 0.25，含 AAC 编码抖动 0.08~0.22 dB）；且**响度打到 −14** 或**峰值打到 −1.7** 至少一个贴住；响度不得超过 DNA 目标 |
| ★ 增益公式用了 DNA 目标 | 从 stdout 打印的**原始测量值**反推 `min(TARGET_PEAK_PCM − rawPeak, wantLufs − rawLoud)`，必须等于实发增益（差 ≤ 0.02 dB）—— 响度那一项必须用 DNA 的 −14，**不是**通用默认 −16 |
| 成片几何 + 音轨正确 | 用 `ffprobe` **独立复验**：视频流 270x480、**存在音轨**（真合成的音频进了成片）、总时长落在 (0.5, 15) 秒 |

**已知局限（如实记 —— 覆盖强度分两半）**：
归一规则是 `gain = min(峰值余量, 响度余量)`，**哪个更保守取决于素材当次的波峰因数 C**：
`C > −target − 1.7` 时峰值受限。本机素材实测 `C ≈ 13–14.4 dB`，而两条阈值是
「DNA 目标 −14 → 12.3 dB」「通用默认 −16 → 14.3 dB」—— **C 正好卡在两者之间**。于是：

- **「DNA 目标被读取 / 被打印 / 被代入增益公式」= 强覆盖**。断言 3 + 断言 5b 都直接打这一点；
  变异验证做过：把 `dub.mjs` 的 `targetLufs = dna.targetLufs` 短路后，
  用例**变红**并报出「stdout 里没有『响度目标 -14 LUFS，来自风格特质』—— style-dna 的 targetLufs 没接进出片链路」。
- **「最终响度数值随 DNA 目标变」= 弱覆盖**（只在响度受限的那几次运行里可观测）。
  多数运行 `C > 12.3` ⇒ 峰值受限 ⇒ 响度那一项被 `min()` 吃掉，此时最终响度**不随** DNA 目标变。
  实测对照：正常出片 `−14.6 / −14.8 / −16.1 LUFS`（峰值都贴 −1.7，峰值受限）；
  而 M1 变异那一次恰好响度受限，成片从「−14.6 LUFS / 峰值 −1.72」变成「**−16 LUFS / 峰值 −4.07**」。

**期望值现读 `lib/style-dna/engraving.json`，不写死数字** —— 改档案不该把测试改红；但用例会断言
「该风格的 `targetLufs` ≠ 通用默认」，否则这条用例就失去了区分力。

**前提**：本机装好 Index-TTS，且**没有别的配音任务在跑**（TTS 的串行锁是全局独占的）。
锁被占时会立刻失败并说明「这是环境占用，不是被测代码坏了」。

**默认不跑**（用例本身约 35 秒；`--full` 整体约 3–9 分钟，波动几乎全来自 WSL 冷启动 ——
实测 `⑤+` 那段从 147 秒到 441 秒不等，而 `⑤++` 稳定在 34 秒）。

### ⑤+++ / ⑤++++ / ⑤+++++ 第三条通路（`--keep-original` / `--keep-original-limit` / `--fit`）
（只在 `--full` 时跑，★ **不占 GPU**、合计约 25 秒）

**为什么要有它（2026-10-07 补的缺口）**：`⑤++` 是此前**唯一**真跑 `dub.mjs` 出片的用例，而它**没传 `--video`**
⇒ 跑的是**形态 A**（生成的渐变背景）。于是「**形态 B**：口播素材铺画面」这条通路、
以及 `--keep-original` / `--keep-original-limit` / `--fit` 三个开关**从来没有过 CLI 级出片覆盖**
（`grep -n -- "--video\|--keep-original\|--fit" test/cases.mjs` 曾经 **0 命中**）。

**★ 为什么这三条不占 GPU、几秒就能跑完**：`--keep-original` 明令「不跑 TTS、不动素材的时长/画面/声音」，
只在素材上叠字幕与叠加层 —— `dub.mjs` 的 `runKeepOriginal` 在「出片前显存预检」**之前**就 `return` 了，
所以这条覆盖**完全不依赖 Index-TTS**（`⑤++` 那条要）。

**夹具（用例里现造，不依赖任何手工准备的文件）**：WSL 的 ffmpeg `lavfi` 造一个 **270×480 / 1.6s** 的 mp4
（`color` 画面 + `sine` 音轨，`volume=20.8dB` 推到满刻度）到 `_smoke-*` 临时目录。

- ★ Windows 侧**没有 ffmpeg**（`which ffprobe` 无结果，实测），所以只能在 WSL 里造；造的是**输入素材**，不是出片。
- ★ 音轨**必须**存在：`--keep-original` 的混流用 `-map 0:a?` / `[0:a]`，无声素材会让「音轨逐字节相同」无从谈起。
- ★★ 音轨**必须**推到超交付线（夹具真峰值实测 **+0.02 dBTP** > `HARD_PEAK_LIMIT` **−1.2 dBTP**）：
  否则 `⑤++++` 那条「限幅把真峰值压进交付线」就是**空转**（素材本来就在线内，限不限都过）。
  两个用例里都各有一条「**素材真峰值 > HARD_PEAK_LIMIT**」的守卫断言盯着夹具 ——
  夹具哪天被改弱，用例会**当场报错**，而不是静默退化成空转。

| 用例 | 跑法 | 断言 |
|---|---|---|
| **⑤+++** 形态 B（`--keep-original`）真出片 | `dub.mjs --script <文案> --video <夹具> --keep-original --srt <SRT> --size 1080x1920 --ratio 16:9 --out <临时目录>` | ① exit 0；② 结果 JSON `keepOriginal:true` / `align:"srt"` / `audioIdentical:true`；③ stdout 含「在 `--keep-original` 下不生效」（用户点名了 `--size`/`--ratio`，必须**被明确告知**忽略了）；④ **ffprobe 独立复验**成片是 **270x480 = 素材尺寸**（**不是**点名的 1080x1920 ⇒ 钉住「沿用素材尺寸」）；⑤ 成片**有音轨**；⑥ **两条音轨各自解成 PCM 再比 md5 ⇒ 逐字节相同**（「没被偷偷重编码 / 替换」的硬证据）；⑦ **真峰值 == 素材真峰值**（差 ≤0.05 dB）**且素材真峰值 > 交付线** ⇒ 钉住「`--keep-original` 明令不改声音，素材超标时成片也超标、**不做归一**」；⑧ `film.srt` 去空白拼接**逐字等于文案**；⑨ 成片时长 = 素材时长 |
| **⑤++++** `--keep-original-limit` | 同上 + `--keep-original-limit` | ① exit 0；② JSON `keepOriginalLimit:true` / `audioIdentical:false`；③ PCM md5 **必须不同**（`alimiter` 是音频滤镜，绕不开「解码 → 滤镜 → 编码」）；④ 素材真峰值 > 交付线（守卫，防空转）；⑤ **成片真峰值 ≤ −1.2 + 0.25 dBTP**（容差与 `⑤++` 同口径：AAC 有损编码会把真峰值挪 0.08~0.22 dB）且**低于素材**；⑥ 限幅**只压峰** —— 尺寸 / 时长 / 字幕内容一律未动 |
| **⑤+++++** `--fit` | `dub.mjs … --video <夹具> --dry-run --fit loop\|trim\|slow` | ① 三个合法值都 exit 0 且计划行含 `fit=<值>`；② dry-run 真**不跑 TTS**（stdout 无 `TTS_DONE`）也**不出成片**（无 `film.mp4`）；③ 非法值 `--fit bogus` ⇒ exit≠0 且报「`--fit 只能是 loop\|trim\|slow`」；④ ★ 同样的非法值**配上 `--keep-original`**（此时 fit 根本用不到）也**必须**当场拒 —— 取值校验是**无条件**的，不许退化成「用得到才校验」 |

**★ 夹具 SRT 的文本故意与文案不同**（`占位文本甲/乙`）：`--keep-original` 的契约是
「`--srt` 只提供**时间轴**，字幕文本一律用**文案**」（`lib/dub-core.mjs` 的「字幕文本一律用文案」那条）。
两边写成一样的话，「字幕逐字等于文案」就**分不清**成片字幕到底取自哪一边 —— 那是一条假绿。
实测（手工复验）：输入 SRT 是占位文本（`文本匹配率 0.0%`），成片 `film.srt` 里仍是**文案**的两句。

**★ 变异验证（证明断言不是空转）**：

- 把 `⑤+++` 的 `--keep-original` 换成 `--keep-original` + `--keep-original-limit` ⇒ **变红**，
  报「成片音轨与素材**不再逐字节相同**：素材 `b7b37a84…` / 成片 `60cb6692…`」。
  （工具自检那条 `audioIdentical` 与测试**自己算**的 PCM md5 两条**都会**响 —— 分别单独验过。）
- 把 `⑤+++` 的期望尺寸改成点名的 `1080x1920` ⇒ **变红**，报 `成片尺寸 270x480 ≠ 1080x1920`
  —— 证明成片确实是**素材**尺寸，不是我们点名的那个。
- 把 `⑤++++` 的 `--keep-original-limit` 去掉 ⇒ **变红**，报「开了限幅，音轨却仍与素材逐字节相同」。

**单独跑**：`node test/smoke.mjs --full --filter 形态` / `--filter --keep-original-limit` / `--filter --fit`
（`--full` 是必须的 —— 这三条登记在 `FULL_CASES` 里，与 `⑤+`/`⑤++` 同一组）。

**★ 那一格已于 2026-10-07 补上**（见下面「⑤++++++ / ⑤+++++++」）—— 上面三条只做到 `--fit` 的
**参数面**（`--dry-run`），`--fit` 的**真出片行为**与「形态 B + 现场 TTS」这条真实产品路径
由 `⑤++++++` / `⑤+++++++` 两条 GPU 用例覆盖。
★ 另记一条（仍然成立）：`--fit` 在 `--keep-original` 下**完全不生效**（`runKeepOriginal` 一个字都不读它），
所以「用 `--keep-original` 顺便把 `--fit` 也测了」这条路是**不通的** —— 只能真跑 TTS。

### ⑤++++++ / ⑤+++++++ 形态 B + 现场 TTS · `--fit` 真出片差异
（只在 `--full` 时跑，★ **占 GPU + 真跑 Index-TTS**；实测 `⑤++++++` 约 57 秒、`⑤+++++++` 约 2–3 分钟）

**为什么要有它（2026-10-07 补的缺口）**：上一批新增的 `⑤+++`/`⑤++++`/`⑤+++++` **全走 `--keep-original`**
（明令不跑 TTS），而 `⑤++` 又是**形态 A**（没传 `--video`）⇒ 两条真实产品路径**从没被 CLI 级出片覆盖**：
① 「**形态 B**（口播素材铺满）+ **现场 TTS** 配音」这个组合；
② `--fit loop|trim|slow` 的**真出片行为**（`-stream_loop -1` / `tpad` 冻结末帧 / `setpts` 放慢）
—— 它只在形态 B 的**非** `--keep-original` 路径上生效，那条路**必须跑 TTS**。

**夹具（用例里现造，不依赖任何手工准备的文件）**：WSL 的 ffmpeg `lavfi` 造一个
**270×480 / 2.0s** 的 mp4 到 `_smoke-*` 临时目录，画面是一条 **0→255 的亮度斜坡**，音轨是 **15 kHz 纯音**
（推到满刻度）。三处设计都是判据的一半：

- ★★ **画面必须是「随时间变化的亮度」**：`--fit` 三值的**成片时长完全相同**（三者的 mux 都是 `-t total`）
  ⇒ **时长与帧数都不是判据**，写「三者时长不同」就是**恒真断言**。真实差别全在**画面内容**：
  `loop` 把素材循环、`trim` 冻结末帧、`slow` 整体放慢。用一条亮度斜坡，**成片某帧的亮度**就等于
  「素材被取到了哪一时刻」的一把刻度尺 ⇒ 判据可以写成「成片逐帧亮度剖面 == 某一种 fit 的语义模型」。
- ★ **音轨必须是 15 kHz 纯音**：TTS 语音在这个频带几乎没有能量（实测成片 **−56.9 dB**），而素材原声
  在这里是 **−3.7 dB** ⇒ 「成片 15 kHz 带内电平很低」是一条**可证伪**的「音轨来自 TTS、不是素材原声」判据。
- ★ **素材尺寸（270×480）与输出点名（`--ratio 16:9` ⇒ 1920×1080）故意不同** ⇒ 「成片尺寸按 `--ratio`
  而不是素材尺寸」成为可证伪的断言；素材只有 2.0s 而配音约 8.4s ⇒ 三条 fit 分支**必然**被走到。

| 用例 | 跑法 | 断言 |
|---|---|---|
| **⑤++++++** 形态 B + 现场 TTS（默认 `--fit loop`） | `dub.mjs --script <文案> --video <夹具> --ratio 16:9 --style engraving --out <临时目录>`（**不传** `--keep-original`、**不传** `--fit`） | ① exit 0；② stdout 含 `TTS_DONE` / `形态 B` / `· fit loop` / `-stream_loop -1 循环播放`（证明走的确实是「形态 B + 现场 TTS + 默认 loop」）；③ **ffprobe 独立复验**成片是 **1920×1080 = `--ratio 16:9`**（**不是**素材 270×480）；④ ★ **音轨来自 TTS 而不是素材原声** —— (a) 音轨时长 ≈ total（8.6s）且 > 素材时长 ×3（素材只有 2s），(b) **15 kHz 带内电平 < −40 dB** 且**夹具素材自身该带 > −20 dB**（守卫，防空转）；⑤ `film.srt` 去空白拼接**逐字等于文案**；⑥ 真峰值 ≤ `HARD_PEAK_LIMIT`（工具自述 + **测试独立复量**两条），响度落在 **DNA 目标 −14 ± 1 LU**；⑦ ★ **素材真的被循环了** —— 逐帧亮度剖面与「loop 模型」的平均差 ≤12 灰度、且至少比另两种模型小 4 倍，并有 **≥3 个「亮度骤降 >150」的下降沿**（画面回到开头） |
| **⑤+++++++** `--fit` 真出片差异 | 同上但**各传一次** `--fit loop` / `--fit trim` / `--fit slow` | ① 三次都 exit 0，计划行含 `· fit <值>`，成片都是 1920×1080（`--fit` 不该改几何）；② ★ **帧数都 = `total`×30**（±2）—— 如实钉住「时长/帧数**不是**判据」这条事实；③ ★ **逐帧亮度剖面各自贴合自己的语义模型**：`ownMae ≤ 12` 且 `ownMae × 4 ≤ 另两个模型的 mae`（三种模型 = 循环 / 冻结末帧 / 放慢，由语义**直接写出**、与被测实现无关）；④ ★ **结构性判据（三种互相排斥）**：`loop` ⇒ 下降沿 ≥3、`trim`/`slow` ⇒ 下降沿 **0**；`trim` ⇒ 末 30% 最小亮度 ≥240（冻结在素材最高亮度）、`slow` ⇒ 末 30% 最小亮度 ≤230（还没爬到顶）；⑤ ★ **区分力守卫**：先算三种模型两两的逐帧平均差，必须 >40 灰度 —— 夹具若退化成纯色，本用例会**当场报错**而不是退化成恒真断言 |

**★ 实测数字（本轮，同一夹具）**：

| `--fit` | total | 帧数 | 剖面平均差 loop / trim / slow | 下降沿 | 末 30% 最小亮度 |
|---|---|---|---|---|---|
| `loop` | 8.356s | 251 | **4.7** / 99.4 / 94.2 | **4** | 0 |
| `trim` | 9.216s | 276 | 107.1 / **1.0** / 98.7 | **0** | **254** |
| `slow` | 8.143s | 244 | 93.6 / 93.5 / **4.2** | **0** | 194 |

★ **三者时长/帧数相同**（帧数 = `round(total×30)`；上表三行 total 的差异**只来自 TTS 当次合成的
配音总时长不同**，与 `--fit` 无关 —— 换一次跑，total 会变、但每行的「帧数 = total×30」与
剖面贴合关系不变）；**差别全在画面**：`loop` 的剖面有 4 个骤降（素材 2s 铺进 8.4s = 循环 4 次），
`trim` 的剖面末段冻结在 254，`slow` 的剖面单调爬升、末段才到 194。
三种模型两两的平均差 94–107 灰度 ⇒ 区分力充裕。

**★ 变异验证（证明断言不是空转）**：

- 把 `⑤++++++` 的调用加上 `--keep-original-audio`（把素材原声混进成片）⇒ **变红**，
  报「成片在 15000 Hz 带内有 … dB —— 这是素材原声那条 15 kHz 纯音」。
- 把 `⑤+++++++` 里 `trim` 那一次实跑的 `--fit trim` 改成 `--fit loop` ⇒ **变红**，
  报「成片剖面并没有明显更贴合自己的模型 —— trim 99.xx vs loop 4.xx」。

**单独跑**：`node test/smoke.mjs --full --filter "形态 B + 现场 TTS"` / `--filter "--fit 真出片差异"`
（`--full` 是必须的；★ 注意 `⑤++++++` 是 `⑤+++++++` 的子串，按编号过滤会两条都跑）。
**前提**：本机装好 Index-TTS 且**没有别的配音任务在跑**（TTS 串行锁全局独占；锁被占时立刻失败并说明
「这是环境占用，不是被测代码坏了」）。

### ⑤++++++++ / ⑤+++++++++ `--fit` 的**反向分支** 与 `slow` 的 **atempo 链**

（只在 `--full` 时跑，★ **占 GPU + 真跑 Index-TTS**；实测 `⑤++++++++` 约 2 分钟（三次 TTS）、`⑤+++++++++` 约 47 秒（一次 TTS））

**为什么要有它（2026-10-07 补的缺口）**：`⑤+++++++` 只覆盖了 `--fit` 的**一个方向**（素材 2.0s < 旁白 ~8.4s）。而 `dub.mjs` 的 `fitFilter`（`dub.mjs:1096-1115`）每条分支都写着**两个方向**，且**反向时三者等价**（都只 `geom`，裁切由 mux 的 `-t total` 完成）；`slow` 的 `atempoChain`（`dub.mjs:1023-1035`）此前**零覆盖**（`⑤+++`/`⑤++++` 走 `--keep-original` 根本不进这条链）。

**夹具**：复用 ⑤++++++ 的「亮度斜坡 + 15 kHz 纯音」素材，两处改动 —— 反向分支把素材拉到 **9.0s**（配 25 字文案）；atempo 那条把素材压到 **1.0s** 并让音调**从第 0.6s 才开始**（前面是数字静音）。

| 用例 | 跑法 | 断言 |
|---|---|---|
| **⑤++++++++** `--fit` 反向分支（素材 ≥ 旁白） | 同一份 9.0s 素材，**各传一次** `--fit loop` / `trim` / `slow` | ① 三次都 exit 0；② ★ 夹具守卫：`srcDur ≥ total`（否则报「用例配比不对」而不是假红）；③ 结构判据：stdout 含 `Xs ≥ 配音 Ys`（证明走的是**反向**那一支）；④ ★ **像素级主判据**：末帧亮度 ≈ **255·total/srcDur**（±20 灰度）—— 正向分支下末帧只会是 255 或 0，这条对「走错方向」可证伪；⑤ 下降沿 0、最大回落 ≤12（不循环、单调不减）；⑥ ★ 模型拟合：`mae(loop) ≤12 且 mae(trim) ≤12`，且 `mae(slow) ≥ 4×前缀模型`（`No<Nm` 时 loop/trim 模型都退化成「素材前缀」，slow 是「拉长」） |
| **⑤+++++++++** `--fit slow` 的 atempo 链（`--keep-original-audio`） | 1.0s 素材 + 51 字文案 ⇒ ratio ≈ 8.3 | ① exit 0 且 stdout 含 `素材原声已压到 -20 dB 混入`；② 夹具守卫 `ratio > 2`（否则单级 atempo 就够、测不到多级）；③ ★ 从 `--echo-cmd`（打 **stderr**）里**取出真实 atempo 链**：级数 ≥2、每级 ∈ `[0.5,100]`、**连乘 == srcDur/total**（±1e-3）；④ ★ 把**这条链原样**作用到素材音轨上，量出的时长 ≈ `total`（容差 6%）；⑤ ★ 成片 15 kHz 带内**时间位置**：前 35% 窗口 ≤ 后 25% 窗口 −15 dB（音调起点被放慢到 ≈60% 处）；⑥ 后 25% 窗口 ≥ −40 dB（TTS 自身在该带 ≈ −57 dB）⇒ 原声真的混进来了 |

**★ 实测数字（本轮）**：

- ⑤++++++++（素材 9.0s）：`loop` total 4.290s / 末帧亮度 **123**（模型 121.6）/ mae loop 1.1 trim 1.1 slow 82.1；`trim` total 4.562s / 末帧 **133**（129.3）/ 1.1 / 1.1 / 77.4；`slow` total 4.034s / 末帧 **113**（114.3）/ 1.1 / 1.1 / 86.7。⇒ 反向三值**等价**（剖面都 = 素材前缀），与「拉长」模型差 70–80 倍。
- ⑤+++++++++（素材 1.0s / 旁白 8.265s）：链 `atempo=0.5,atempo=0.5,atempo=0.5,atempo=0.967937`（**4 级**，连乘 0.120992 == 期望）；链作用到原声后 8.126s（目标 8.265s）；成片 15 kHz 带内 前 35% **−66.8 dB** → 后 25% **−18 dB**。

**★ 变异验证（证明断言不是空转）**（做法：把 `dub.mjs` **复制**成项目根 `_mut-dub.mjs`，用 `LEMO_TEST_DUB=_mut-dub.mjs` 指向它，跑完删掉 —— **全程不改 `dub.mjs`**）：

- 删掉 `slow` 的方向守卫 ⇒ ⑤++++++++ **变红**（被上游结构判据抓到：提示语变成 `… < 配音 … setpts=PTS*0.469`）。
- 保留反向提示语、只让 loop/default 那支也 `setpts` ⇒ ⑤++++++++ **变红**，命中**像素级主判据**（`成片末帧亮度 255，模型 118.2，差 136.8 灰度`）。
- `atempoChain` 末级 ×1.5（每级仍合法、成片照样出）⇒ ⑤+++++++++ **变红**（`连乘 0.172354 ≠ 0.114903`）。
- （纯 CPU 补充）把夹具原声**不接 atempo** 补静音到 total，用 ⑤ 的同一条 `bandMeanDbWindow` 量：前 35% **−12.2 dB** / 后 25% **−91.0 dB** ⇒ 时间窗判据当场不成立。

**单独跑**：`node test/smoke.mjs --full --filter "⑤++++++++"`（★ `--full` 必须；`⑤++++++++` 同时匹配两条）。
**前提**：本机装好 Index-TTS 且没有别的配音任务在跑（TTS 串行锁全局独占）。
**★ 已知口径（不是缺陷）**：ffmpeg 的 `atempo` 是相位声码器，每级实测短约 0.5%（1 级 1.0s→1.9797s / 2 级 →3.9407 / 3 级 →7.8643 / 4 级 →8.2550，理想 2.0/4.0/8.0/8.4），所以 ④ 的容差取 6% —— 没接 atempo 的结果会是 `srcDur`（≈1s），差一个数量级；链错则 ffmpeg 直接报越界。

**★ 本轮一并记下的三条观察项（`dub.mjs` 的，**未改**）**：① `slow` 在**反向分支**的提示语是从 loop 支**继承**的（`dub.mjs:1111-1113`）—— 用户点了 `slow` 看到的是「输出 -t 裁到」，**没说明「素材够长时不放慢」**（纯文案）② `atempoChain` 的循环守卫是 `while (v < 0.5 - 1e-9)`（`dub.mjs:1026`）⇒ 若连乘恰好落在 `[0.5−1e-9, 0.5)`，末级会写出 `atempo=0.499999…` 被 ffmpeg 判越界（**实测不可达**；想彻底封死把守卫改成 `while (v < 0.5)` 即可）③ 视频侧的方向守卫是 `srcDur < total − 0.05`（`dub.mjs:1098`）而音频侧是 `srcDur < total`（`dub.mjs:1034`）⇒ `[total−0.05, total)` 这 0.05s 窗口里「画面不放慢、原声放慢」（亚帧级）。

### ⑥ 任务取消 + 进程树真的被收掉

| 用例 | 断言 |
|---|---|
| `DELETE /api/jobs/:id` 按状态分派 | 起一个 `ascii-crt --skip-sync --dry-run`（无害长任务，约 4.5s）→ `DELETE` 返回 200 `{ok:true}` → 轮询到 `status==='canceled'` 且**记录仍在 `/api/jobs` 列表里**（★ 安全边界：running 只「取消」，绝不删记录）→ **该任务的 pid 用 `process.kill(pid,0)` 复验已消失** → **对这条终态任务再 `DELETE` → 200 `{ok:true,id}` 且记录从列表消失**（新语义，见下） |
| 取消安装任务（`kind='setup'`）→ WSL 侧无残留 | 本进程内 `jobs.enqueueSetup()` 起一个 `sleep 120` 的 wsl 步骤 → 取消 → 断言 WSL 侧那个 pid **已终止**、进程组内**没有活着的成员**、`sleep` 的 alive 标记**仍在**（证明是被杀死的，不是自然跑完） |

第二条覆盖的就是上一轮那个真 bug 的形态：**`taskkill /T` 管不到 WSL2 虚拟机里的进程**。
取消安装任务时，Windows 侧的 wsl.exe 被杀掉了，Linux 侧的 `sleep`/`git clone` 却继续跑到自然结束
（取消一个 6 GB clone = 点了取消还在后台下载）。修复是 `lib/setup.mjs` 给 child 挂 `_lemoKillExtra`
（`setsid -w` 建进程组 + 读 `/tmp/<uniq>.pgid` + 整组 TERM→KILL），`lib/jobs.mjs` 的
`killJobChild()` 调它。**这条用例就是钉住这个钩子的**：把 `_lemoKillExtra()` 那一行注释掉，
它会立刻 FAIL 并把现场（进程树 / 同组进程）打出来。

> ★ 判「进程死了」**必须看进程状态，不能只看 `kill -0`**：实测整组被杀之后，脚本常以
> **僵尸（`Zs <defunct>`）** 形态留在进程表里（父进程被 taskkill 带走 → 被 pid 1 收养 →
> WSL 的 init 不 reap）。僵尸已经死了，但 `kill -0` 对它**返回成功** —— 只看 `kill -0` 会假阳性。

> ★ **2026-10-03 语义变更（有意改动）**：`DELETE /api/jobs/:id` 从「一律取消、重复取消 400」
> 改为**按状态分派**（`server.mjs` + `lib/jobs.mjs:deleteJob`）：
> · `queued` / `running` → **取消**（中止还在跑的任务，原语义不变，返回 200）；
> · 终态（`done` / `failed` / `canceled` / `ended`）→ **删除记录**（从列表 + `index.json` 里抹掉，返回 200 `{ok:true,id}`）。
> 对一条已经结束的任务「取消」在语义上是错的，用户真正要的是「清掉这条历史」。范式对齐 `lib/briefs.mjs:deleteBrief`
> （终态可删、**running 拒删**）。本用例因此把第 5 步的「重复取消 400」改成「终态再 DELETE → 200 且记录消失」，
> 并**新增安全边界断言**：DELETE 一个 `running` 任务后，记录**必须仍在列表里**（只是 `canceled`），
> **绝不能被删** —— 否则会留下占 GPU 的无人管孤儿进程。

### ⑦ SSE 断线续传语义

| 用例 | 断言 |
|---|---|
| `?lastEventId=N` 增量补发 | 先全量回放拿到序号序列 → 取中间某个 N → 再带 `lastEventId=N` 连一次 → 收到的行**逐个等于** `n > N` 的那些行（`deepStrictEqual`），且不该出现 `gap`；`hello` 帧的 `resumed===true` / `resumeFrom===N` |
| `Last-Event-ID` 请求头 | 用请求头（浏览器自动重连走这条）续传结果一致；**头与 query 同时给时以头为准** |
| 跨重启 `logSeq` 稳定 | 重启测试服务 → 该任务从磁盘恢复（`restored===true`、状态仍是 `done`）→ 再次全量回放，**序号与日志正文与重启前逐字一致** |
| `gap` 事件（**内存**裁剪） | 造一个真产出 **20050 行**的安装任务（内存上限 `MAX_LOG_LINES=20000`，超出丢最旧）→ 内存里只剩最后 20000 行（首行 `n=55`）→ 从 `lastEventId=1` 续传 → **先发 `gap`**（`from=2 to=54 dropped=53`）再补发剩下的 20000 行 |
| **落盘**轮转（4MB 单任务截断） | 直接调 `lib/store.mjs`：用真实上限 `CAPS.perJobLogBytes` 真写满一次（2400 条 × ~2KB ≈ 4.8MB）→ 断言 ① 文件**不超过**上限（实测轮转到 2.83MB）② **标记行真的写进去了**（第一条、`stream='meta'`、含「超过 4MB 上限，已丢弃最旧的 N 字节」、且 `n > 1`）③ 标记行的 `n == 首条保留行 n - 1` ④ 轮转后**序号连续不跳号**、末条 `n == 写入条数`（保最新）⑤ 从标记行之后续传**不发 `gap`、不重不漏**（把 `lib/jobs.mjs:subscribe` 的 gap 判据原样套一遍） |
| **落盘总量裁剪**（64MB） | 直接调 `lib/store.mjs`：造 **40 × 2MB = 80MB** 测试日志（用户既有日志也计入总量）→ 调 `saveIndex()` → 断言 ① 真裁了（索引条数 < 40）② 留下的是**最新的一段**（严格等于后缀）③ 被裁掉的最旧任务，日志文件**真的被 `dropLog` 删了** ④ 保留下来的文件都还在 ⑤ logs 下没有「本次测试前缀但索引里没有」的**孤儿** ⑥ 总量回到 64MB 以内，且恰好 = `base + 保留数 × 2MB`（实测裁掉最旧 9 条、保留 31 条） |
| **索引条数上限**（120 条） | 直接调 `lib/store.mjs`：造 **130 条**（上限 +10）小日志（512B，确保不撞 64MB 那条路径）→ 调 `saveIndex()` → 断言 ① 索引恰好 120 条 ② 保留的是**最新的 120 条**（严格等于后缀）③ 最旧的 10 条被**永久删除**（文件 + 索引条目都没了）④ 保留的文件都在 ⑤ ★ **无孤儿**：`logs/` 下本次测试的文件数**正好等于**索引条数，且没有索引里不存在的文件 |

> ⑧ / ⑨ 两条会往 `D:\lemo-films\.console` 真写测试数据并覆写 `index.json` ——
> 跑前备份 `index.json`，`finally` 里把测试文件删干净、`index.json` 原样还原。
> 连跑两次结果一致（已实测：用户历史 72 条 / 71 个日志文件 / 184952 字节，跑完分毫不变）。
> ⚠️ 已知边界：⑧ 的窗口内总量会短暂超过 64MB，若此时**另一个进程**（如 18080 上的控制台）
> 恰好也在调 `saveIndex`，它会把这批测试数据算进总量、可能顺带裁掉用户最旧的历史。
> 实测窗口 < 1 秒且控制台空闲，未发生；但这是这条用例固有的、无法用测试内锁消除的风险。

> `gap` 的触发条件（`lib/jobs.mjs:539`）是「保留的第一行序号 > from+1」，也就是**日志被从前面裁掉过**。
> 它确实可达，只有两条路径：内存超 20000 行、或落盘轮转（4MB 截断会写一条 `n = 首行n-1` 的标记行）。
> 上面两条分别走这两条路径：`gap` 那条走**内存**（代价 ~10 秒，2 万次 `appendFileSync`，是默认套件里最慢的一条）；
> **落盘**轮转那条直接调 `store.appendLog()` 写满 4MB（~0.9 秒，因为它不经过 jobs 队列，也不起任何子进程）。
> ★ 落盘轮转那条验的是**数据层的不变量**（标记行位置 + 序号连续）—— 这正是 SSE 续传依赖的东西；
> 真正的「活 SSE 流上续传」由 `gap` 那条覆盖（两者合起来才是完整的）。

### ⑧ 并发锁的真冲突态

| 用例 | 断言 |
|---|---|
| 活 pid 的锁 | 用**一个真的活着的进程**的 pid 写 `D:\lemo-films\.__test-lock__.lock`（第一行 pid、第二行 ISO 时间，与编排器逐字一致）→ `locked===true` / `alive===true` / `stale===false` / `pid` 回显正确 / `message` 有「并发/损坏」的人话解释 |
| 死 pid 的锁 | 用「spawn 一个空 node 进程 → 等它退出 → 复验确实不在」的 pid → `alive===false` / `locked===false` / **`stale===true`**（不误报冲突） |

判据必须与编排器逐字对齐：只有「pid 活着 且 锁龄 < 6h」才是真冲突；陈旧锁编排器会自己接管，
控制台在这里**绝不能**加戏报警。测试锁用 `__test-lock__` 这个不可能与真实风格同名的 slug，
且**只删自己登记过的那一个路径**（绝不按通配符删锁 —— 并发写 mux 会产出损坏的成片）。

### ⑨ 成片文件的 Range 请求

| 请求 | 断言 |
|---|---|
| 无 `Range` | 200 · `Accept-Ranges: bytes` · `Content-Length == 文件大小` · `video/mp4`（测试只收 64KB 就断开，成片 29MB 没必要整份读） |
| `bytes=0-1023` | 206 · `Content-Range: bytes 0-1023/<size>` · 长度 1024 · 收到的前 16 字节与整份开头一致 |
| `bytes=-1024`（后缀） | 206 · `Content-Range: bytes <size-1024>-<size-1>/<size>` · 长度 1024 |
| `bytes=<size>-<size+100>`（起点越界） | 416 · `Content-Range: bytes */<size>` |
| `bytes=abc`（非法） | 416（**如实断言实现行为**：server.mjs 的正则不匹配就 416） |

用真实的成片 `D:\lemo-films\ascii-crt\ascii-crt.mp4`；文件不在时这条用例直接报「成片缺失，验不了」。

---

## 没覆盖什么（如实写）

- **真实渲染 / 混流**：默认全部跳过，只有 `--full` 才跑 —— 现在跑**九条**：
  `ascii-crt` 全链路（⑤+，预生成配音混流）+ **现场 GPU TTS**（⑤++，真调 Index-TTS 合成 + style-dna 响度归一）
  + **第三条通路**（⑤+++/⑤++++/⑤+++++：`--keep-original` / `--keep-original-limit` 真出片 + `--fit` 参数覆盖；
  ★ 这三条**不跑 TTS、不吃 GPU**）
  + **形态 B + 现场 TTS**（⑤++++++：口播素材铺满 + 真 TTS 配音；**占 GPU**）
  + **`--fit` 真出片差异**（⑤+++++++：`loop`/`trim`/`slow` 各真出片一次，验逐帧画面剖面；**占 GPU**）。
  + **`--fit` 反向分支**（⑤++++++++：素材 ≥ 旁白时 loop/trim/slow 各真出片一次，验逐帧画面剖面 = 素材前缀；**占 GPU**）
  + **`slow` 的 atempo 链**（⑤+++++++++：`--keep-original-audio` 下多级 atempo 的连乘与实物时长/带内时间位置；**占 GPU**）。
- **Web UI 交互**：`web/app.js` / `index.html` / `style.css` 的浏览器行为（点击、表单、播放器、进度条）**本套件**不测 —— 它只保证「服务端发给前端的数据是对的」，不保证前端渲染对。
  → **这一块由 `test/ui.test.mjs` 覆盖**（第四批新增，独立入口）：无头 Edge `--dump-dom` 拿渲染后的 DOM、再用 CDP 真的去点击/按键。见本文末尾。
- **`/api/setup/run` 的「真跑一次安装」（走 HTTP）**：仍不测 —— 它会真的改环境（apt / clone / pip）。
  **校验分支已由 `test/setup-api.test.mjs` 覆盖**（第九批新增，独立入口）：非法 JSON / actionId 形状 / 未知动作 404 / manual 拒跑 400 / 已知已就绪 200 `skipped`，**每条都断言「没有起任务」**；`GET /api/setup/actions` 的契约（含 `?simulate=` 演练场景）也一并覆盖。
  （所以「安装任务的取消」走的是 `jobs.enqueueSetup()` 直调，不是 HTTP —— 这台机器 12/12 ok，`planActions()` 一个动作都规划不出来，走 HTTP 根本入不了队。）
  → **第六批已把「执行通道」与「脚本正文」单独真跑验证**（见 `安装动作真跑简报.md`）：
  `node lib/setup.mjs --run assets.fonts --simulate-env=partial` 真的执行了 `fetch-all-fonts.sh`
  的正文（exit 0、2.2s、119/119 已存在全部跳过、字体数 966→966 不变、无残留）；
  pip / clone 通道与失败分类（NETWORK/DISK/PERMISSION/EXIT/TIMEOUT）用 `runSteps` 真跑验证过。
  但**这两件事仍然没有自动化用例**（都会真的改环境），只有简报里的手工证据。
- **`POST /api/reveal`**：会弹资源管理器窗口，不测。
- ~~**落盘总量上限**：`lib/store.mjs` 的 64MB 日志总量裁剪、120 条索引上限没测。~~
  → **已补**（第六批，⑧ / ⑨）：真按真实上限造数据触发 —— ⑧ 造 40×2MB=80MB 撞 64MB 总量裁剪，
  ⑨ 造 130 条撞 120 条上限。两条都断言「最旧的被丢 / 最新的保留 / 索引与实际文件一致 / 无孤儿日志」。
  跑前备份 `index.json`、finally 里删干净并原样还原（用例连跑两次结果一致）。
  （**4MB 单任务轮转**见 ⑦；`gap` 那条验的是**内存**裁剪（20000 行），三者是三条不同的代码路径。）
- **Windows 保留端口的 `EACCES` 后扫**：**决策逻辑已测**（`lib/portscan.mjs` 的纯函数单测，见 ③），
  但**真实触发**仍没测 —— 要真造一个保留段得改系统配置（`netsh` 圈端口），测试不去动它。
  也就是说：「决策对不对」有断言，「在真保留段上确实会后扫」只有 `server.mjs` 调它这一条路径可推。
- **`lib/env.mjs` 的各项判据**：只断言了 `/api/env` 的**结构**（字段在不在、类型对不对），不断言 WSL/ffmpeg/字体的**具体探测结果** —— 那依赖机器状态，断死会变成假失败。
- **取消「真渲染」任务**：不测 —— 会打断 mux、会动用户成片目录。取消验的是 dry-run（无害长任务）。
- **`DELETE` 一个不存在的任务 id**：没测（⑥ 只测了「运行中取消 → 记录仍在」与「终态再 DELETE → 删记录」；`deleteJob` 的 404 分支没单独立用例）。
- **`HEAD /api/films/:slug/:file`**：路由里有，但没单独立用例（Range 那条已经把实现覆盖了）。

---

## `test/setup.test.mjs` 覆盖了什么（12 条）

| 用例 | 断言 |
|---|---|
| ① 检测到缺失 → 规划出动作 | 「WSL 装好但里面是空的」场景下，必须规划出 wsl.node / wsl.ffmpeg / wsl.venv / lib.wsl / lib.win，且每个动作都带 `why` |
| ② 自动 / 手动分界 | 7 项 `kind==='auto'` 且每步都有 `timeoutMs`；5 项 `kind==='manual'`、有指引、**且不带可执行步骤**（免得让人误以为能自动跑）；最坏场景共 12 个动作 |
| ③ 手动项不含下载命令 | `win.ffmpeg` 的序列化结果里不许出现 curl/wget/Invoke-WebRequest（「不自动下载几百 MB 二进制」） |
| ④ 全 ok → 0 个动作 | `planActions(fixtureReady())` 必须为空数组；反过来把全项改成 warn，每项都必须被某个动作覆盖 |
| ⑤ **漂移哨兵** | 从 `lib/env.mjs` 源码里正则抽出所有 `ok()/warn()/fail()` 的 item id，逐个断言 `lib/setup.mjs` 有**专门**动作（不是落到 `fallback.*`）；同时断言 `fixtureReady` 的 id 集合与 env.mjs 完全一致 |
| ⑥ 幂等判据 | `actionSatisfied()` 在 ready 场景为 true、partial 场景为 false；多项里有一个不 ok 就为 false；不存在的项保守判 false |
| ⑦ 失败分类 | 网络 / 超时 / 仓库不存在 / 权限 / 磁盘 / 命令缺失 / 其它，7 类各自命中；并验优先级（磁盘 > 网络） |
| ⑧ 序列化安全 | 5 个演练场景都能规划 + JSON 化；序列化结果里**不许带 `script` 正文**（脚本留在服务端） |
| ⑨ 超时保护 | `lib.wsl` 的 clone 超时 ≥ 60 分钟、体积预估 > 5 GB；所有 auto 步骤的超时 ≥ 5 分钟 |
| ⑩ 动作 id 稳定 | 每个场景内 id 不重复、字符集合法（server 会 400）；同一份检测结果规划两次结果必须一致（纯函数） |
| ⑪ 排序 | `fail` 的动作排在 `warn` 前面（先修致命的） |
| ⑫ CLI 可用 | `node lib/setup.mjs --simulate --json` exit 0 且结构正确；无参模式能真检测并给结论；未知演练场景必须非 0 |

---

## 副作用与「不干扰用户」

1. **不碰用户那个 18080 实例**：测试自己用**内核分配的空闲端口**（`net.listen(0)`，天然避开 Windows 保留段）起一个临时服务，跑完自己杀掉。全程不读也不写用户的实例。
2. **`--port` 兜底**：起服务时读它自己打印的 `http://127.0.0.1:<实际端口>`，所以即使端口被保留段挤掉、服务自动后扫了，测试也认得实际端口。
3. **固定入口文件：测试实例根本不写它们**（第二道防线才是备份还原）：`server.mjs` 启动时会写 `.console-port` 与 `打开控制台.url`（用户「双击打开控制台」的地址）。
   ★ **2026-10-04 修根因**：测试起的是**临时实例**，本来就不该覆盖用户的这两个文件 —— 现在 7 个起服务的入口都会给子进程设 `LEMO_CONSOLE_NO_ENTRY_FILES=1`，`server.mjs` 见到它就**跳过写入**（并打印一行说明）。
   为什么必须这么做：原来的「跑前备份、跑后写回」**很脆** —— 只要某次跑崩/被 kill（写回语句没执行），脏值就留在文件里，**后续跑又把脏值当成基线一路"正确还原"**（实测发生过：文件被留在一个本机**根本绑不上**的端口上）。
   备份/还原**保留为第二道防线**；`test/ui.test.mjs` 的收尾里另加一条**回归钉子**：跑完后两个文件必须与跑前备份**逐字节一致**（★ 快照要在**还原之前**取，否则比对会被还原抹平、永远绿）。
   （⑦ 的跨重启用例会**再起一次服务**，同样走这套。）
4. **会往 `D:\lemo-films\.console\` 写任务记录**：dry-run 任务、⑥ 取消的 dry-run、以及 ⑥⑦ 两条进程用例自己起的任务，都会留下 `index.json` 条目 + `logs/<id>.jsonl`。这是**测试产物**，但格式和用户自己的任务记录一致，不影响使用。
   ★ **全部**由 `test/cases.mjs` 的 `ARTIFACTS` 登记，跑完在 `finally` 里**从 `index.json` 摘掉、并删掉对应的日志文件**（原子替换，和 `lib/store.mjs` 同一套做法）。
   ★ **第六批修了一个漏登记**：SERVER 层的 ④（dry-run 全链路）与 ⑥（取消）起的两个任务，早先**没有** `ARTIFACTS.jobIds.add(...)` ——
   结果是**每跑一次 `smoke.mjs` 就往用户历史里多留 2 条 dry-run 任务**（实测连跑 5 次 → 历史 72 → 82 条）。
   现已补上登记，实测跑完 `index.json` 仍是 72 条、`logs/` 仍是 71 个文件 / 184952 字节，与跑前逐字节一致。
5. **⑥ 取消渲染任务会留下编排器的并发锁，测试自己收掉**：`lemo-make.mjs` 的 `releaseLock` 挂在 `process.on('exit')` 上，被 `taskkill /F` 硬杀时不会执行 → 留下一个「pid 已死」的 `.ascii-crt.lock`。编排器下次会按「pid 已死」自动接管，**功能上无害**；但测试会在用例的 `finally` 里删掉它 —— 判据很严：**只删「锁里第一行的 pid == 刚被取消的那个 pid」的那一个文件**，绝不碰别的锁。
6. **测试造的锁用 `__test-lock__` 这种不可能与真实风格同名的 slug**，且用完立刻 `unlink`（`finally` 里兜底）。
7. **WSL 侧临时文件**：⑥ 会在 `/tmp` 下写 `cg-cancel-<pid>-<ts>.{pid,alive}`，`wsl()` 辅助函数会往 `D:\WSL\` 写 `cg-wsl-*.sh`；两者都在 `finally` / `close` 里删掉，`ARTIFACTS` 里另有一层兜底。
8. **`/api/env` 会起 WSL 探测**（几秒）：它会往 `D:\WSL\` 写临时脚本，名字带 pid + 时间戳，跑完自删。
9. **不用 `curl`**：本机 curl 走代理，打 localhost 拿到的是 **502**（不是 000）。全部走 `node:http` 直连。
10. **不用 `spawnSync`**：本环境对任何可执行文件都返回 `EBUSY`，全部异步 `spawn`。
11. **WSL 命令一律「写脚本文件再执行」，不走内联 `bash -c`**：`wsl.exe` 会把命令行重新拼一遍再交给 Linux 侧解析，内联里的 `$变量` / 引号会被吃掉（`lib/env.mjs` 的注释里写着「内联会吃掉变量」，实测确实如此 —— 内联写法下 `$st` 变成空串，断言直接失去意义）。
12. **测试自身代码也是 LF**（② 那条会把 `test/*.mjs` 一起查）。
13. **`ui.test.mjs` 的 D4 会往 `D:\lemo-films\.briefs\` 写一张测试工单**（主题「UI 测试：音色随主题出片传递」）：登记在 `BRIEF_IDS`，跑完在**停服务之前**走 `DELETE /api/briefs/:id` 删掉（还在出片时 409 → 重试；404 视为已删）。实测跑完该目录为空。
14. ★ **跑本套件 / 改仓库文件之前，先查有没有并发批量作业在跑**（2026-10-06 真实事故：一个子智能体改 `core/render/mux.sh` 的 WIN 侧、WSL 侧还是旧的 ⇒ 两侧 `core/` 分叉 ⇒ 编排器的「两侧 `core/` 一致」闸门**拒绝开工** ⇒ 当日的 38 风格日批**废掉 21 个**）。查法与判据见 `_distill/AGENT-BRIEF.md` 的「动两侧副本共享的文件之前」一节：`ls -lat _distill/render-run-*.log` / `ls -lat _distill/logs/*.log` 看日志 mtime、`ls -la D:/lemo-films/.*.lock`、`tasklist //FI "IMAGENAME eq ffmpeg.exe"` —— **日志 mtime 在几分钟内 / 有 `.lock` / 有 ffmpeg ⇒ 判定有并发作业，等它排空再动**。★ 本套件与日批抢的正是同一批锁：`lemo-make.mjs:1547` 记着「跑出片的同时跑套件，⑥ 必然失败，耗时 9s → 88s」。
15. ★ **写任务书派活前，任务书里的「环境事实」必须附核法**（2026-10-06 立）：凡出现 **文件路径 / 行号 / 函数名 / 进程 / 端口 / 存在与否 / 谁读谁** 这类断言 ⇒ 都算「环境事实」，都要写「用哪条命令核出来的」；**设计意图 / 要求 / 判断标准 / 已知的通用知识不算**（不必核）。判据、可照抄的格、以及用真实错误做的「凭印象 → 核过之后」正反例，见 `_distill/AGENT-BRIEF.md` 的「派活前：任务书里的『环境事实』必须附核法」一节（核法：`grep -n '环境事实' _distill/AGENT-BRIEF.md`）。★ 同一天同一根因的三次实测：`hologram-hud`（凭印象点名 voices 的读取者，实际全库 **84** 个 `.py`）、`D:/lemo-films/.console-port`（实际在 `D:/lemo-tools/.console-port`，`server.mjs:60`）、「端口文件存在 ⇒ 控制台在跑」（`server.mjs:2070` 明写退出**不删**，存在 ≠ 在跑）。

---

## 已知观察（不是本次改动引入的）

- **WSL 发行版会因空闲被回收，下一次 `wsl.exe` 调用是冷启动**：实测见过一次 `sleep 3` 的步骤 **60 秒**才起来、`--dry-run` 的 CLI 子进程跑到 **74 秒**。所以本套件里凡是要等 WSL 的地方窗口都给得很宽（`wsl()` 默认超时 60s、等标记文件 120s），慢不等于失败。
- **取消一个 WSL 安装步骤后，`su` 进程会多留一会儿**：真正干活的脚本 + `sleep` 立刻就被收掉了（这正是要保的东西），但 `su - lemo -c setsid -w bash …` 会以 `S` 状态多留几十秒（它的孩子 `setsid` 已经是僵尸，它没有 reap）。不干活、不占 GPU，随后自己消失。**不是本次改动引入的**，也不是控制台能控制的（那是 `su`/WSL 侧的行为）。
- **`.console/logs/` 里可能有孤儿日志文件**：`saveIndex` 的条数/总量裁剪会 `dropLog`，但历史上遗留过个别「索引里没有、日志文件还在」的条目（本机现存 1 个，2026-10-01 20:12，早于本次改动）。不影响功能。
- `lemo-make.bat` 与 `start-console.bat` 的工作区行尾**都是 CRLF**（与 `.gitattributes` 的 `*.bat text eol=crlf` 一致）。
  ② 那条用例**查的是仓库里全部 `.bat`**（不只 `start-console.bat`）—— 早先只断言一个文件时，`lemo-make.bat` 是 LF（CR=0 LF=41）也照样全绿；后来把它转成了 CRLF，断言也一并升级成「所有 `.bat`」。若哪天又有 `.bat` 被写成 LF，② 会直接 FAIL 并列出文件名与 CR/LF 计数。

---

## `test/ui.test.mjs` 覆盖了什么（59 条：第四批 20 条 + 第五批 1 条 + 第七批 4 条 + 第八批 10 条 + 第九批 6 条 + 第十批 13 条 + 第十一批 5 条）

补的就是上面「没覆盖什么」里那条 —— **前端渲染出来对不对**。三种手段从弱到强：

**A. 无头 Edge `--dump-dom`（渲染后的真实 DOM，6 条）**

| 用例 | 断言 |
|---|---|
| A1 | `--dump-dom` 拿到的 DOM 里 `.style-item` 数量 == `/api/demos` 的 `styles.length`（证明 JS 真的跑完了，不是空壳） |
| A2 | 批量入队 UI 存在：`.si-check` 复选框数 == 风格数 · `#sideBatch` / `#batchCount` / `#btnBatchQueue` / `#btnBatchClear` 都在 · 初始「已选 0 个」· 初始 `disabled` |
| A3 | `#batchModal` / `#batchBody` / `#batchFoot` / `#helpModal` / `#btnHelp` / `#btnHelp2` / `.kbd-hint` 都在，且提示里含 `<kbd>Ctrl</kbd>`+`<kbd>Enter</kbd>` |
| A4 | `#progEta` 挂载点存在且**初始为空**（无历史不许显示数字）· `<html data-theme="dark">`（默认仍是深色） |
| A5 | 从 `style.css` 里解析两套调色板，按 WCAG 2.1 算 **20 组**前景/背景对比度：**浅色与深色都必须全部 ≥ 4.5**（第五批把深色也设成卡点 —— 深色是默认主题；顺带修了深色 `--fg-faint`：3.48/3.21 → 4.91/4.54。第六批补了 **hover 态**两组：`--fg-faint` / `--fg-dim` on `--bg-3` —— `--bg-3` 是 `.envbar`/`.style-group-head`/`.style-item`/`.film` 的 hover 底色，原来深色只有 4.14、浅色 4.43，都低于 AA，已一并修正到 4.61 / 4.56） |
| A6 | 前三批的 13 个 UI 锚点（进度条 / 空状态 / 复制 / 分组 / 侧栏 / 排序 / 向导 / 预检位 / 预设…）在渲染后的 DOM 里仍在 |
| A7 | 用 `?simulate=clean|bare|partial`（演练模式，这台 12/12 ok 的机器也能看到环境备注与安装引导卡片）逐个 `--dump-dom`，**去掉 HTML 注释后全域扫描**，断言渲染出的 DOM 里 **0 处 `` `**` `` 字面量** —— 控制台里有两类纯文本模板串走 `textContent`：`web/app.js` 的 `#setupIntro`/`.env-note`，以及 `lib/setup.mjs` 给手动项写的 `manual.note`/`steps`/`impact`（第五批一共改了 **4 + 9 = 13 处**，全换成「」引号）。并断言每个场景**真的渲染出了 ≥1 张安装卡片**、`.env-note` 里真有「演练模式」字样（否则用例是空转） |

**B. CDP 真交互（9 条）**

用手写的极小 WebSocket 客户端（node 没有内置 ws，也**不装 puppeteer**）连无头 Edge 的调试端口，真的去点击 / 按键：

| 用例 | 动作 → 断言 |
|---|---|
| B0 | 打开控制台 → 页面渲染出 43 个风格条目 |
| B1 | 点 2 个复选框 → `#batchCount` == 「已选 2 个」、`#btnBatchQueue` 解禁、加了 `.has`；**勾到哪两个从 DOM 读**（列表按 9 大类分组，DOM 顺序 ≠ `state.styles` 顺序） |
| B2 | 点「批量入队」→ 弹层出现，正文含「将按顺序跑 2 个」+ 两个 slug + 「预计总耗时」，`.batch-row` 顺序与勾选顺序一致，底部有取消/入队 |
| B3 | `Esc` → 弹层关闭（不是只能点关闭按钮） |
| B4 | `Ctrl+K` → 焦点到 `#search`；**在输入框里按 `/` 不抢焦点**；非输入态按 `/` 会聚焦搜索框 |
| B5 | 点「?」→ 快捷键面板打开且含 Ctrl/Enter/K/Esc；`Esc` 关闭 |
| B6 | 点主题按钮 → `data-theme=light` + `localStorage` 写入；再点回 `dark` |
| B7 | 勾 2 个 + 勾上「试跑」→ 确认 → **真的入队 2 条**：`/api/jobs` 里两条 `batchId` 相同、`batchIndex` 1/2、`batchTotal` 2；任务列表 DOM 里出现「批 N/2」标记 |
| B8 | 焦点在表单里按 `Ctrl+Enter` → `/api/jobs` 真的多出一条任务（`batchId=null`） |

**C. 服务端语义（HTTP，5 条）**

| 用例 | 断言 |
|---|---|
| C1 | `POST /api/run` 的批次参数校验：非法 `batchId` / `batchIndex>batchTotal` / `batchIndex=0` 都 400；**不带 `batchId` 的老用法仍 200 且 `batchId=null`**（不破坏前几批） |
| C2 | 批量任务跑到终态（`done`/`exit=0`），且 `/api/jobs` 的 summary 里有 `batchId`/`batchIndex`/`batchTotal`/`eta` 字段 |
| C3 | **ETA 真的从历史学习**：先批量问一遍所有 slug 挑样本最少的那个 → 跑一次 dry-run → 同参数再问，样本数 **+1** 且 `medianMs` 为正；**换一组参数问 → `confidence=none`**（不把不同阶段的耗时混着报） |
| C4 | 「预计还需」真的渲染到进度条上：连入队 5 条（后 4 条排队，窗口够宽）→ **走真实 UI 路径**（刷新列表 → 点那一行 = attachLog）→ `#progEta` 显示「预计还需 ~…」、`.ok/.low` 类在、tooltip 里有「历史样本 N 次」 |
| C5 | `GET /api/eta` 的参数校验：缺 slug / 非法 slug / 非法选项都 400；正常输入 200 |

**D. 声音版块（4 条，第七批）**

「声音」版块此前**一条 UI 用例都没有**。这 4 条从「渲染出来没有」一路验到「出片命令里带没带」。

| 用例 | 动作 → 断言 |
|---|---|
| D1 | 页面里有 `#voiceCard`（「声音」卡片）；`#voiceList .voice` 条目数 **== 服务端 `/api/voices` 的条数**（不硬编码，先打一次接口预热缓存并取数）· 每条都有「试听」「选用」按钮 · 条目名不缺失不重复 |
| D2 | 点第一条的「试听」→ **真的向 `/api/voices/audio?name=…` 发请求**。★ app.js 用 `new Audio()` 单例播参考音，它**不在 DOM 里**、选择器查不到 src；所以测试在 `HTMLMediaElement.prototype.play()` 处截一次（src 一定在 play() 之前赋好），断言截到的 URL 含 `/api/voices/audio` 且带对了 name |
| D3 | 点第一条的「选用」→ `localStorage['lemo.voice']` == 该音色名 · 「当前」条（`#voiceCurrent`）里显示它 |
| D4 | **出片（主题工单）真的带上当前音色**：先建一张工单并把 `pending → ready`（状态机允许的唯一迁移）、`runOpts=['--dry-run']`（不真渲染）→ 在页面里装 `fetch` 捕获 → 点这张工单的「出片」→ 断言 ① 捕获到的请求体里 `voice` == D3 选的音色 ② 服务端真的把它拼进了命令行：新任务的 `opts` 含 `--voice <name>`（实测 `["--skip-sync","--dry-run","--ratio","9:16","--voice","zh_curator"]`）。★ 这条就是**缺口 1**（`runBrief` 不带音色）的回归钉子 |

> ★ D4 建的测试工单登记在 `BRIEF_IDS`，`finally` 里**在停服务之前**用 `DELETE /api/briefs/:id` 删掉（还在出片时 409 → 重试几次；404 视为已删）。实测跑完 `D:\lemo-films\.briefs\` 为空。
> ★ D4 依赖 D3（先得通过真实 UI 把音色选进内存态 `state.voiceSel` —— 只改 localStorage 是没用的，`runBrief` 读的是内存态）。
> ★ D1–D3 用 CDP 读**实时 DOM**（页面从 B0 起一直开着），不走早先那次 `--dump-dom` —— 音色清单要起 python，早捕获可能还没渲染完。

> ★ 判据不写死：风格数从 `/api/demos` 现取（不硬编码 43）；C3 不假设「某个 slug 从没跑过」（用户的历史就在 `index.json` 里，测试服务启动时会读回来）—— 而是先问一遍挑样本最少的。
> ★ B7/C3/C4/B8 一律用 `--dry-run --skip-sync`（不渲染、不混流），跑完把测试任务从 `index.json` 摘掉、日志文件删掉；无头 Edge 的 profile 目录建在 `D:\WSL\b4-ui-*`，跑完按**确切路径**递归删除（不用通配符）。
> ★ `--dump-dom` 与 CDP 都要用**独立**的 `--user-data-dir`，否则第二次起浏览器会抢同一个 profile 锁。

**E. 文案出片面板（10 条，第八批）**

「文案出片」面板（`#dubCard`）是项目两个**新增输入能力**的用户点击路径 —— ①「仅自定义文案出片」（画面工具生成、配音走本机 Index-TTS）；②「文案 + 用户上传口播视频」（素材画面与声音**原样不动**，只叠字幕与叠加层）。它们的 HTTP 面（`dub-api.test.mjs`）与逻辑面（`dub-align` / `dub-split`）都已覆盖，唯独**用户真正点的那条路径一条都没有** —— 这 10 条补的就是它。

| 用例 | 动作 → 断言 |
|---|---|
| E1 | 形态切换：默认「仅文案出片」⇒ `#dubCard` 有 `.mode-script`；点「文案 + 口播视频」⇒ 换成 `.mode-keep`、`aria-selected` 跟着走、`.dub-keep-only` 由 `none→block`、`.dub-script-only` 由 `flex→none`（`getComputedStyle` 实测，不是只看类名） |
| E2 | **断句预览逐字相等**：先 HTTP 打 `/api/dub/preview` 拿**权威**断句，再点「断句预览」⇒ `#dubLines` 行数 == 服务端 `count`、且**逐行文本与服务端 `lines[].text` 逐字相等** —— 钉住「断句规则只有一处（在核心工具里），前端只展示不自己切」 |
| E3 | 点「分析文案」⇒ 真的 `POST /api/dub/analyze`，`#dubAnalysis` 展开且 `#dubAnalysisBody` 有内容（等的是「分析结果：…」终态，不是「分析中…」中间态） |
| E4 | 风格下拉结构：选项数 == 服务端清单 + 1（`auto` + 「不指定」档）· 首项 `value=auto` · **「不指定」档 `value` 必须是空串** · 默认风格由该档代表、不单独列项 |
| E5 | 出片请求体 · 形态1（auto）：含 `script` / `style:'auto'` / **显式**尺寸（未选时 `ratio:'9:16'`）、不含 `keepOriginal` / `videoToken` |
| E6 | 出片请求体 · 形态1 选「不指定」档：**`body` 不含 `style` 键**（= 不传 `--style`，与加这个功能之前完全一样）+ 下拉提示走「不传 `--style`」分支。★ 这条是**修一个真缺陷**的回归钉子（见下） |
| E7 | 出片请求体 · 形态2：带 `keepOriginal:true` + `videoToken`，**不带** `voice`/`speed`/`gap`/`size`/`ratio`/`fit`/`keepOriginalAudio`。token 由真 `POST /api/dub/upload` 上传一个极小假 mp4 得到（走真实 `#dubSrcSel` change 路径），跑完按确切路径删文件 + 还原上传登记表 |
| E8 | **前端拦截** · 空文案点「出片」⇒ 捕获到的 `/api/dub/run` 请求数 **== 0** + toast「先粘贴一段文案」 |
| E9 | **前端拦截** · 形态2 但没选口播视频 ⇒ 请求数 **== 0** + toast 提示要先上传 |
| E10 | **前端拦截** · 形态1 选「自定义尺寸」但宽高非法（奇数）⇒ 请求数 **== 0** + toast 说明必须偶数 |

> ★ **绝不真出片**：E5–E7 在页面里 patch `window.fetch`，**拦下** `POST /api/dub/run`（记录 body 后返回假响应），并把 `/api/jobs` 伪造成一条 `canceled` 终态任务让 `pollDub()` 收敛 —— 形态1 会跑 TTS 烧 GPU，形态2 需要真素材，所以一条真任务都不许建。
> ★ **E6 修的真缺陷**：`renderDubStyleOptions` 里「不指定」档原写 `none.value = def.id`（= 服务端 default，如 `plain-dark`），与三处已声明意图（state 注释 / `startDubRun` 的 `state.dubStyle !== ''` 守卫 / `renderDubStyleHint` 的 else 分支）矛盾 ⇒ 守卫成死代码：下拉提示误写「指定风格「plain-dark」」、`body` 多带一个 `style`、`dub.mjs` 因此多跑一次语义自检并可能误报「匹配度偏低」。画面等价（`dub.mjs` 以 `plain-dark` 为基线）故属 **P2**，但用户会看到自相矛盾的提示 —— 已修正为 `value=''`，E4/E6 从「记录缺陷」改写为「断言正确契约」。★ **变异验证**：把 `none.value` 退回 `defId` ⇒ E4/E6 **立刻变红**；还原后复绿。

**F. 播放器弹层 · 窄屏侧栏 · 顶栏按钮（6 条，第九批）**

这三处是覆盖审计里「渲染/交互/契约**三档全空**」的**整块静默失明**区（用户点得到、坏了没人知道）。

| 用例 | 动作 → 断言 |
|---|---|
| F1 | 点成片卡片「播放」→ `#playerModal` 打开。★ 有牙断言：`#playerTitle` 与 `#player.src` 必须自洽于**同一条** `/api/films` 条目（`src` == 该条目的 `url`）—— 防 `openPlayer` 传错 slug/file |
| F2 | 关闭弹层三条路径都通：点「关闭」按钮 / 点背景（`e.target === #playerModal`）/ 按 `Esc`；且关闭后 `src` 被 `removeAttribute` 清掉（不是只 hidden） |
| F3 | 窄屏侧栏按钮的可见性随视口变：宽屏(1400) `getComputedStyle(#btnToggleSide).display === 'none'`；窄屏(500) 变可见（用 CDP `Emulation.setDeviceMetricsOverride`） |
| F4 | 窄屏点「风格」→ `#sidebar` 出现 `.open`，且 **`transform` 真的从 `matrix(…,-320,0)` 变成 `none`**（证明显隐真变了，而不是只 toggle 了一个类名）；再点收起 |
| F5 | 点「重新检测」→ **真的**发出 `GET /api/env?force=1`（页面内 patch `fetch` 记录 URL） |
| F6 | 点「演练」→ 进入演练态（URL 带 `?simulate=`、`#setupCard` 显示、`#setupSim`/`.env-note` 写「演练模式」），并按 bare → partial → clean → 退出 循环 |

> ★ **成片库为空时**：F1/F2 会临时在 `CFG.exportDir` 下建 `uitest-player-<pid>/clip.mp4` 触发播放器，登记后按**确切路径**递归删 —— **绝不静默跳过**。
> ★ **变异验证**：注释掉 `app.js` 的 `$('playerModal').hidden = false` ⇒ F1/F2 变红；把 `#btnToggleSide` 的 `classList.toggle('open')` 改空操作 ⇒ 仅 F4 变红（F3 仍绿，因为 F3 只查可见性）—— 两次还原后复绿。

**G. 限幅开关 · 成片库 · 声音三处 · 生成工单 · 任务取消 · 预设（13 条，第十批）**

这一批补的是覆盖审计里剩下的「薄弱/为零」版块，外加**本轮新加的功能开关**。

| 用例 | 动作 → 断言 |
|---|---|
| G1 | 形态2 **不勾** `#dubKeepLimit` ⇒ 出片 body **不含** `keepOriginalLimit` 键（默认关 = 与加功能前逐字节一致） |
| G2 | 形态2 **勾上** ⇒ body 含 `keepOriginalLimit === true`，且仍含 `keepOriginal`/`videoToken`、仍**不含** `voice`/`speed`/`gap`/`size`/`ratio`/`fit` |
| G3 | 形态1 下该复选框**不可见**（`.dub-keep-only`），且形态1 的 body 不含 `keepOriginalLimit` |
| G4 | 成片库点「刷新」→ **真的** `GET /api/films`，卡片数 == 服务端 `films.length` |
| G5 | 切 `#filmSort`（time/size/slug）→ 卡片顺序**真的变**（★ 用服务端数据在 node 侧自算期望顺序逐条比对，并断言 size ≠ time，证明排序真生效） |
| G6 | `#filmSearch` 输入 slug 片段 → 只剩匹配卡片；输入不存在的串 → 0 张 + 空状态 |
| G7 | 点「试合成一句」→ **真的**向 `/api/voices/test` 发请求（★ fetch 桩拦下，**绝不真合成**，那会烧 GPU） |
| G8 | 展开 `#voiceImport` → 出现「导入」按钮，点它向 `/api/voices/import` 发请求（桩拦下，绝不真导入） |
| G9 | 点 `vc-reset`「重置为内容文件默认」→ 本机选择（`localStorage` 的 `lemo.voice` / `lemo.speed`）被清 |
| G10 | 填主题 + `#briefLang` + `#briefRatio` → 点「生成工单」→ **真的** `POST /api/briefs` 且请求体四字段与表单逐项相等，`GET /api/briefs` 能看到它（★ 工单登记进 `BRIEF_IDS`，跑完在停服务前删掉） |
| G11 | 任务行点「取消」→ **真的** `DELETE /api/jobs/:id`、状态转 `canceled`、记录仍在，且行内文案**中性**（**不得**出现「失败」措辞 —— 项目已固化约定「用户主动取消 ≠ 失败」） |
| G12 | 点「常用组合」预设（`.preset`）→ 只改勾选、**不**启动任务（`/api/jobs` 条数不变） |
| G13 | 点「复制」按钮 → 不报错、按钮仍在（无头环境下剪贴板可能被拒，故**不**断言剪贴板内容） |

> ★ **绝不触发重活**：G7/G8 用页面内 `fetch` 桩拦下真 TTS 合成与真导入；G1–G3 拦下 `POST /api/dub/run`（绝不真出片）。
> ★ **变异验证**：把 `app.js` 的「仅勾选时才发 `keepOriginalLimit`」改成无条件发 ⇒ G1 变红（`实际带了 true`）；删掉 `#filmSearch` 的 `input` 监听 ⇒ G6 变红（`57 张，期望 1 张`）—— 两次还原后 `md5 web/app.js` 回基线、用例复绿。

**H. 画幅不匹配警告的「一键修复」（5 条，第十一批）**

背景（★ 2026-10 多比例改造后已更新）：这一批落地时，43 个风格里**只有 `engraving` 声明了多比例**，其余 42 个的影片源码把 1920×1080 写死 ⇒ 按 `lib/aspects.mjs` 的语义「只支持 16:9」；而控制台**产品默认比例是 9:16**，用户选这 42 个 + 默认比例，成片画面**会被裁切**（不是重排、不是留黑边）。**现状**：42/43 个风格已声明 `aspects`（都支持 9:16），**唯一**不支持 9:16 的是 `pixel-rpg`（像素完整性：320×180 帧缓冲按整数倍最近邻放大，9:16 的 `k=0.5625` 会让像素块变成 3.375px）。
原来只有一段**被动文本**警告（`#briefAspectWarn`），用户得自己去下拉里找正确比例再改一次。这一批把它做成**可点的一键修复**。

> ★ **H1/H2 的样本前提也随改造更新**：`#briefSlug` 只列 **4 个「内容驱动」白名单风格**（`web/app.js:fillBriefStyles` ← `GET /api/briefs` 的 `styles[]` ← `lib/briefs.mjs` 的 `BRIEF_STYLES`），而它们**现在都支持默认的 9:16**；**唯一**不支持 9:16 的 `pixel-rpg` 不是「内容驱动」风格（画面主体写死，主题改不动）、**不在下拉里**，硬塞进去也没用（`syncBriefAspectWarn()` 查的是 `state.briefStyles`）⇒ 它做不了本节样本。判据本身没变（「当前比例不被该风格支持 → 警告 + 一键修复」），样本改成**优先默认比例、否则取任一预设比例**（仍是现取 `/api/sizes` 的 `ratios`，不硬编码风格名 / 比例）。

| 用例 | 动作 → 断言 |
|---|---|
| H1 | 选一个「`aspects.supported` 不含当前比例」的风格（★ 从服务端数据现取，不硬编码）→ `#briefAspectWarn` **可见**、文案含「裁切」、且**渲染出一个按钮** |
| H2 | 点该按钮 → `#briefRatio` **真的变成**该风格支持的比例，且 `#briefAspectWarn` **隐藏**（★ 这条就是「有牙」：证明按钮真的生效，不是只渲染了个壳） |
| H3 | 选一个**支持**当前比例的风格 → 不警告、也没有按钮 |
| H4 | 防空转：警告态下盒子里**确有可见文本**（不是只显示了一个空盒子） |
| H5 | 幂等：连续多次重核（`change` 事件）**不会堆出多个按钮**（`syncBriefAspectWarn()` 先 `textContent=''` 再重建） |

> ★ 按钮文案是 `改用 <该风格 supported[0]>`，**动态取**（现在恰好都是 16:9，但不依赖这个巧合）；若该比例不在 `#briefRatio` 的 options 里，**只提示不硬设**（不把 select 设成空值）。**不禁用出片**、**不改默认比例** —— 保持项目原则「用户有权坚持出，只是要知情」。
> ★ **文案出片（`#dubCard`）故意没有画幅警告**，这不是漏了：它的背景由 `lib/dub-core.mjs` 的 `bgSource(spec,{W,H,dur})` **按请求尺寸程序化生成**（`gradients=s=${W}x${H}`），**无绝对像素常量、与风格样板片模块无关**，所以 `FILM_META.aspects` 那套能力**不适用**。已在 `web/app.js` 的对应代码段写明理由，防后人误修。
> ★ **变异验证**：把按钮的点击处理改空操作 ⇒ H2 变红（`#briefRatio=9:16，期望 16:9`）；去掉「先清空容器」⇒ H2/H3/H5 变红（按钮堆到 10 个）。还原后 4 个文件 md5 回基线。

---

## 文件

```
test/smoke.mjs      冒烟测试入口：参数解析、起停测试服务（含按需重启）、HTTP/SSE 工具、用例调度与汇总、跑完清理测试产物
test/cases.mjs      冒烟测试用例 + 共享常量（ORCH_MD5 / 期望风格数）+ 纯函数（行尾计数 / 注入扫描 / 异步 spawn）
                    + 测试产物登记与清理（ARTIFACTS / cleanupArtifacts）+ WSL 辅助（wsl / freshDeadPid）
test/setup.test.mjs 首次运行安装的纯逻辑测试（独立入口，不起服务、不碰 WSL）
test/setup-api.test.mjs 「首次运行向导」两个接口 `GET /api/setup/actions` / `POST /api/setup/run` 的 HTTP 契约测试（独立入口，零依赖，**绝不真安装**）：`?simulate=<场景>` 的 count/autoCount/manualCount 自算一致 + 每个动作走 `serializeAction`（auto 有 steps+manual:null、manual 反之）+ 未知场景 400 + 无 simulate ⇒ `simulated===null` + `POST` 的非法 JSON / actionId 缺·非串·空·非法字符（`../x`/`a b`/`a/b`/`a:b`/中文）⇒ 400 + 未知动作 404 + manual 动作 400 且响应带 `manual` + 已知已就绪 ⇒ 200 `{ok,skipped}`。★ **每条失败路径都断言「没有起任务」**，并断言两个固定入口（`.console-port` / `打开控制台.url`）跑前跑后逐字节一致。★ 场景清单取自 `GET /api/env` 的 `scenarios`（不硬编码）。★ 变异验证：把 `server.mjs` 的 actionId 字符正则加一个 `/` ⇒ 对应用例变红
test/ui.test.mjs    Web UI 层测试（独立入口）：无头 Edge --dump-dom + CDP 真点击 + 颜色对比度 + 批量/ETA 的服务端语义 + 声音版块（音色渲染/试听请求/选用持久化/出片带 --voice）+ 文案出片面板（形态切换/断句逐字/分析/风格下拉/出片请求体契约/三条前端拦截）+ 播放器弹层/窄屏侧栏/顶栏按钮 + 限幅开关·成片库·声音三处·生成工单·任务取消·预设
test/dub-semantic.test.mjs 语义解析 / 风格匹配的纯逻辑测试（独立入口）：四维打分 + **visual 维度（口播画面气质）的向后兼容与决胜** + 规则路的切段粗粒度 + 外部 `--analysis` 注入与它的硬判据（拼回≠原文即拒）
test/briefs.test.mjs 「主题工单」的测试（独立入口，**16 条**）：数据层 + 接口 + UI，含全链路出片用例。★ ⑬ 钉住「控制台出片必须写进独立输出目录」这条红线 —— 控制台起任务时**从不传 `--out`**（`server.mjs` 只拼 `--skip-sync <runOpts>`），而编排器 `lemo-make.mjs` 的 `outDir = o.out || <exportDir>\<slug>` ⇒ 成片直写**样板片路径**、把样板片覆盖掉（实测 art-deco 的样板片被覆盖成 9:16）。现在 `lib/jobs.mjs` 在**最靠近 spawn 的那一处**（`buildOrchArgs`）注入 `--out <exportDir>\_jobs\<任务id>`；用例两层断言：① 命令行拼装（`--out` 在、是绝对路径、落在 `_jobs\<任务id>`、**不等于也不落在**样板片目录里、只出现一次、用户自带 `--out` 原样尊重）；② 真走一次控制台「主题出片」入口（`--dry-run`，秒级），断言接口回给 UI 的 `job.outDir` 就是 `_jobs\<任务id>`（证明注入真的接在控制台那条路上）。★ ⑮ 钉住「`--ratio` 的值判据」：`9:16` 含 `:`，而 `lib/briefs.mjs` 的 `OPT_RE` 字符白名单里**没有** `:` ⇒ 改前 `--ratio 9:16` 被 `/api/run` 以「非法字符」拒（上一轮做验证时只能回退等价的 `--size 1080x1920`）。现在**不放宽通用白名单**（shell 元字符 / 空白 / 反斜杠 / 非 ASCII 照旧全拒），只在 `--ratio` 的**值位**换成与编排器同源的语义判据（`lib/sizes.mjs:resolveSize` ⇒ 预设比例或合法 WxH）—— 比字符白名单**更严**（`--ratio 99:99` 被拒）；同时 `/api/eta` 原先自己抄了一份同样缺 `:` 的正则，改成复用 `validateOpts`（同一处判据）。★ ⑯ 钉住「`filmUrl` 指向**本次任务**的产物」：控制台出片写在 `_jobs\<任务id>\<slug>.mp4`，而旧拼法 `/api/films/<slug>/<file>` 指的是**样板片**目录（会打开样板片）；现在按产物**实际在不在** `_jobs\<任务id>\` 下判（复用 `lib/jobs.mjs:jobOutDir`，与 `findFilm` 同源），在则拼 `/api/films/_jobs/:jobId/:file` 并断言**真 GET 得到那份字节**，不在（`--dry-run` / 产物被清理 / 用户自带 `--out`）则退回样板片拼法（向后兼容）。
test/originality.test.mjs 「从零原创」审计器的纯逻辑测试（独立入口，零依赖）
test/style-skill-reader.test.mjs 风格 Skill 文档读取入口（`lib/style-skill-reader.mjs`，三条通路读方案的唯一入口）的纯逻辑测试（独立入口，零依赖，零文件写入）：目录穿越防护 + **「缺失即优雅降级 ⇒ 返回 null、绝不抛」的硬契约（三处）** + 11 节/json 读全 + 扩面字段（`scoreBreakdown`/`audio`/`video`/`defects` 正文）与 json 自洽 + 子字段缺失即降级（合成输入，覆盖真实样本字段齐全验不到的分支）
test/triple-check.test.mjs 「画面/字幕文本/原文案语义」三者一致性校验门（`lib/triple-check.mjs`，**全项目唯一允许调 7B 视觉模型**的地方）的纯逻辑测试（独立入口，零依赖，零文件写入、零网络、零 WSL、零 GPU —— 该文件的 `main()` 有 `argv[1]===import.meta.url` 守卫，import 不会加载模型）：**判定矩阵四分支**（OCR≠字幕 / 字幕∉原文案 / 没读出字必判「存疑」**绝不许兜底成一致** / 全对）+ **「模型自报 frame_verdict 绝不参与 verdict」**（实测 temp=0 下模型会确定性误报）+ `parseVerdict` 对脏回复的容错（多对象 / 前言混 `{` / 尾部多余 `}` 都会走兜底）+ `sampleTimes` 抽帧计划（首/中/尾**只在字幕窗内**才纳入、去重 0.25s、降采样首尾保留）+ `nearestCueText` 的 2.0s 阈值 + `buildPrompt` 不得给「读不到就写空」的台阶。★ 本测试当场抓出一个**CLI 可达的真崩溃**（见下）
test/dub-lexicon.test.mjs 规则兜底词表（`lib/dub-lexicon.mjs`）的纯逻辑测试（独立入口，零依赖）：`lexiconCoverage` 契约（恒四键 / 漏登记命中 / 不串维 / **缺失即优雅降级绝不抛**）+ `TAG_LEXICON` 数据完整性（四维非空、值为非空无空白字符串数组、**源文本扫描重复 tag 键**（对象重复键会静默覆盖，只能读源码查）、**同 bucket 内不许有重复触发词**、跨 tag 共用触发词**现状冻结 16/12/12/0**）
test/dub-api.test.mjs `/api/dub/*` 全部 **7 个接口**（`upload`/`sources`/`source-meta`/`styles`/`preview`/`analyze`/`run`）的契约与校验测试（独立入口，零 GPU / 零 TTS / 零真渲染）：**上传安全不变量**（返回的 `path` 只能是 `<UPLOAD_DIR>/<token><ext>`，**用户给的文件名绝不参与拼路径** —— 用 `../../evil.mp4` 等 4 种穿越名字验）、413 的两条路径（Content-Length 预检 + 无长度时中途拒，且**都不落盘**）、`sources` 增量、`source-meta` 的 400/404/400-nonvideo 与「200 或 502」双分支、`styles` 形状（**不硬编码风格数**）、`preview` 的 `count===lines.length`、`analyze` 的全部 400 与**外部 `analysis` 注入 ⇒ `source:'external'`**、`run` 的 10 种形状 400 + **每条 400 后断言「没有起任务」**、★ `run` 新增的 **`keepOriginalLimit` 契约用例**（非布尔字符串/数字 → 400；`keepOriginalLimit:true` 但**没给** `keepOriginal` → 400 —— 它限的是「保持原样」那条音轨，单独给没意义；同样每条都断言没起任务）、★ **⑱ `speed` / `gap` / `title` / `keepOriginalAudio` 四条此前零覆盖的边界**（2026-10-07 补：`speed` 0.4 / 2.1 / `'x'`、`gap` −0.1 / **3.5** / `'x'`、`title` 非字符串 / 过长、`keepOriginalAudio` 非布尔（字符串 / 数字）⇒ 全部 400，且**每条都断言没起任务**）—— 其中 `gap: 3.5` 这条同时**钉住一处 CLI ↔ 控制台的口径差异**（此前**没有任何测试或闸门在对齐它**）：CLI 的 `--gap` 允许 **0–5**，而 API 只允许 **0–3**（与 `web/index.html` 的 `max="3"` 一致 ⇒ 控制台通路内部自洽、**有意更严**）；核心 `lib/dub-core.mjs` 的 `buildTimeline` **不设上限**（gap 只是加在句间）⇒ 3 与 5 都不是实现要求的，且 `0–3 ⊂ 0–5` ⇒ 无功能性差异 ⇒ 判「**各有道理、不硬统一**」，改为把 API 侧口径钉死 + 差异写进 `dub.mjs` 的 USAGE 与 `README.md`、以及「跑完上传目录与 `index.json` 逐字一致」。★ 它当场钉住了一处**不对称**：`analyze` 对非对象 `analysis` 是**忽略**，而 `run` 的 `validateRunBody` 是**硬 400**。★ **⑰ 另覆盖 `GET/HEAD /api/films/dub/:dir/:file`**（「文案出片」成片字节，`server.mjs` 的 `apiDubFilmFile` 路由）—— 成片库里点「文案出片」成品播放的落点，此前服务端**零断言**（`ui.test.mjs` 的 F1 只查 `video.src` 属性、不校验响应）：从 `/api/films` 里找一条 dub 成片（**不硬编码时间戳 `<dir>`**；没有则明确失败、**不静默跳过**）→ 无 Range **200**（`Accept-Ranges`/`video/*`/`Content-Length==size`，只收 64KB 就断开）· `bytes=0-65535` **206**（`Content-Range: bytes 0-65535/<size>`、长度 65536、前 16 字节与整份一致）· 越界 **416**（`bytes */<size>`）· **HEAD 200 无 body**；外加**路径穿越防护** 9 种写法（`..%2F` 逃出 dubRoot ⇒ **403 路径越界**；反斜杠 `..%5C`·盘符 `C%3A`·NUL `%00` ⇒ **400 路径非法**；字面 `../`·`%2e%2e`·`....//`·绝对路径 ⇒ **404**）全部 4xx 且**不返回任何其它文件字节**。★ 变异验证：注释掉 `apiDubFilmFile` 的 `resolve` 前缀守卫 ⇒ 穿越用例变红（`403 → 404`）；去掉 `serveRangeFile` 的上界收敛与越界判据 ⇒ 越界用例变红（`416 → 206`）；两次还原后 `md5sum server.mjs` 回基线
test/voices-api.test.mjs `/api/voices/sources`（只读清单）/ `import` / `test` / `test/audio/:file` 的契约与校验测试（独立入口，零 TTS / 零 ffmpeg 实跑）：**只测失败路径**（非法 JSON / 缺参 / 非法音色名形状 / 超长试听文本 / 路径穿越）并**每条都断言「没有起任务」**。★ 实测纠正了三处：`import` 的参数名是 **`file` 不是 `name`**；`import` 源文件不存在是 **400（走 `r.code`）不是 404**；`test/audio` 的 **403 路径穿越分支在 HTTP 层不可达**（URL 归一化先剥掉 `..`、且路由正则不允许 `/`），实际落到通用 404 —— 已钉住「不是 403」。★ 另记一处不一致：`import` 的音色名上限是 40（`lib/voices.mjs:357`）而 `test` 是 80（`server.mjs` 的 `/^[A-Za-z0-9._-]{1,80}$/` 校验）
test/style-scan.test.mjs 风格**源码指纹**机制（`scripts/style-scan.mjs`，约定一「风格必须持续自动纳入」的**判据本身**）的测试（独立入口，纯文件 IO，零 WSL/GPU/网络）：`fingerprintStyle` 稳定 + **有区分度（防哈希退化成常量 ⇒ `plan` 永远报 0 待处理）**；**「该变就变」**（改 `.js`/`.html`/`.css`/`.mjs` 与根级 `STYLE.md`/`DEMO.md`/`style.json` ⇒ hash 变）；**「不该变就不变」**（改生成物 `events.json`/`lines.json`/`content*.json`、在 `out/`/`stills/`/`music/`/`fonts/`/`assets/` 下新建 `.js`、改 `.py`、新增 `.txt`/`.srt` ⇒ hash **不变**）；`collectStyleFiles` 的**精确集合相等**（相对路径/正斜杠/已排序/无重复）；`diffScans` 的 added/changed（精确到文件）/removed；`loadFingerprintFile` 与 `resolve*` 的真实降级行为。★ 实测确认源码注释（12-27 行）与 `collectStyleFiles` 实现**一致**
test/triple-check-flow.test.mjs `lib/triple-check.mjs` 的 **`verifyTriple()` 主流程端到端**测试（独立入口，★ **用桩 LM Studio，绝不碰真实的 127.0.0.1:12345**）：桩监听内核分配的空闲端口，`LEMO_LMSTUDIO_BASE` 在 `await import()` **之前**设好。覆盖：全一致 / **每帧喂 2 张图**（整帧 + 底部字幕条裁剪）/ 篡改必被抓 / 桩返回垃圾 ⇒ 存疑（**不空转**：篡改用例不能靠「回填提示词」）/ 桩连续 500 ⇒ 触发 1 次重试且 `ok=false` / ★★ **卸载必被调用（显存红线，含「全部帧都失败」时也要卸载）** / v1 卸载「200 但 body 是 error」的假成功 ⇒ 回落 v0 / 报告 JSON 落盘 / 成片不存在与抽帧计划为空的抛错
test/dub-align.test.mjs 功能2（`dub.mjs --keep-original`）的**「口播 cue ↔ 文案句」时间轴对齐**（`lib/dub-core.mjs` 的 `alignCuesToSentences`）纯逻辑测试（独立入口，零依赖，零文件 IO）：★ 由来的真缺陷 —— 原实现给每句的 span **只取「它匹配到的那一条 cue」的窗口** ⇒ 实测 40 字给 10.07s、**34 字只给 1.63s（读不完）**、句间还有 **3.2s 空白无字幕**。修后：① 一句认**一段连续 cue 窗口**（长句才认得出）；② 把 cue 按句切成**首尾相接、无空档、无重叠**的区间；③ **最短可读时长** `max(0.8, 非空白字数/9.0)`（★ 不用 `dub.mjs` 的 `EST_CPS=5.5` —— 那是口播**语速**，本素材 261 字需 47.5s > 素材 42.4s，当下界数学上不可行；改用「**最大阅读速度** 9 字/秒」）。实测：**最大空档 3.230s → 0.000s、短于可读下界 5 条 → 0 条、匹配率 75% → 100%**，且**音轨 PCM md5 仍逐字节相同**
test/dub-split.test.mjs `lib/dub-core.mjs` 的 `splitSentences`（**出片路径上的断句唯一真相源**：`server.mjs` → `dub.mjs` 的 `splitSentences(raw, 40)`）纯逻辑测试（独立入口，零依赖）：★ 由来的真缺陷 —— 兜底硬切原是**盲目定长一刀切**（`t.slice(i, i+maxLen)`），实测**切在词/记号内部**（`…次日就收米\|上百…`、`…全靠 AI \|1键复制…`）且**切片没 trim**（字幕留首尾空白）。修后：在 `[maxLen−6, maxLen+6]` 窗口内挑**优先级最高、且离 maxLen 最近**的切点 —— ① 标点之后 → ② **空白处** → ③ **字符类变化处**（**排除「Latin↔数字」**，那是同一 token 内部）→ ④ 都没有则退回定长切。覆盖：不切在 `AI1` 内部 / 优先空白 / **切片无首尾空白** / **拼回（去空白）== 原文**（硬切最大风险是丢字）/ 含逗号仍按逗号切（既有行为不变）/ **已知局限如实钉住**（纯中文无标点时任何定长切法都可能切在词内，除非引入分词器 —— 本项目 Node 侧有意不依赖 jieba）。★ 已做变异验证：把切点选择退回「永远 maxLen」⇒ 该用例立刻变红
test/gate-blindness.test.mjs 闸门「守卫 + 核心判据」回归套件（独立入口，零依赖，**72 条**）：把「闸门扫到 0 个对象却全绿」与「HIST 整行豁免过宽」两类**守卫**，以及 **12 条核心判据**（非空转 —— 闸门真的判了，但要钉住「判得对」）**从头注释变成测试**。覆盖 **31/31** 个闸门（`scripts/check-*.mjs` 的**全部**，含 `check-render-venc`（GPU 硬规则那道）、`check-line-endings`、`check-derivation-caliber`、`check-dual-copy-sync`、`check-film-delivery`、`check-plate-pixel`、`check-cli-docs`、`check-shell-structure`、`check-loudness-targets`、`check-lra-caliber`）；**失明/空转类子守卫已一条不剩**（含 `check-film-delivery` F 段「全部让位 ⇒ 一部成片都没判」）。★ 夹具按闸门**怎么取根**分三种：① 有 `LEMO_*` 覆盖点的走 env；② 落点按脚本自身位置推导的整棵拷到临时目录；③ 扫描根**硬编码**的（`check-cli-docs` / `check-shell-structure` / `check-loudness-targets` / `check-lra-caliber`）拷到临时目录后**精确重定向那个常量**（`patchGate`，带「待替换片段必须存在 + 替换必须生效」两道防空转断言）—— 否则闸门改了写法时夹具会静默跑在**真实仓**上、用例变成假绿。`check-film-delivery` / `check-lra-caliber` / `check-plate-pixel` 的阴性对照是**现造真成片 / 真音频 / 真渲帧**（纯 CPU，不碰 GPU）。每条都用 `LEMO_*` 覆盖点指向 `D:/lemo-tmp/` 下的**极小非破坏夹具树**，并配**阴性对照**（最小合法夹具必须 exit 0 **且不含失明文案**）。★ 判据强度：`expectBlind` 要求 **exit≠0 且出现该闸门特有文案** —— 只断言退出码的话，任何崩溃（路径/JSON/参数写错）都能骗过它，正是本项目反复治过的「匹配判据可被无关代码满足」。★ 另含 **25** 个**故意破坏自证**：把闸门拷到临时目录、精确替换掉守卫（**先断言待删片段存在**，防替换空转）⇒ 同一套正向断言**必须变红**，证明断言真的在测那条守卫。★ 其中 `check-cli-docs` / `check-plate-pixel` / `check-film-delivery`（F 段）/ `check-lra-caliber` 的自证证明的是「**exit 仍≠0 但文案消失**」或「**改坏后 exit 变 0 并打印 ✓**」⇒ **只断言退出码的坏用例会照样绿**（这正是本套件存在的理由）。 ★ **另覆盖 5 条核心判据**（2026-10-07 补，此前如实记为「仍未覆盖」）：① `check-lra-caliber`「文档 lra 看起来是 **loudnorm** 口径 ⇒ 判不符」（现造 12 s 双电平正弦，实测 ebur128 7.6 / loudnorm 4.7、差 2.9 ≫ 容差 0.6；夹具自带「两个口径必须差 >0.6」的**前提断言**，防 ffmpeg 行为变了之后静默假绿）；② `check-loudness-targets`「`mix_rules` 写成 −16 ⇒ 偏离 −14 交付线 ⇒ FAIL」；③ `check-plate-pixel`「**品红标记测试失败**（底衬色写错字段）⇒ 判**真缺陷**」（夹具把**拷到临时目录的** `lib/dub-core.mjs` 精确改道成「底衬色不进 `OutlineColour`」以**复现历史缺陷**，真实 `lib/dub-core.mjs` 一个字节不动；同一份配置在字段映射正确时 exit 0 ⇒ 唯一能解释 FAIL 的只有标记测试）；④ `check-shell-structure`「**② 判定块以 `fi` 结尾、后面没有 `exit 0`** ⇒ FAIL」；⑤ `check-cli-docs` 的 **notImpl**（文档先于实现）/ **notDoc**（实现了没写文档）。★ 现已**无已知未覆盖**的守卫或核心判据（那 5 条非空转类判据已于 2026-10-07 补上）。
test/slot.test.mjs 整机渲染限流器 `core/render/slot.mjs`（**渲染链**上的限流器：`RENDER_SLOTS` 设了才生效，`video.mjs` 会 `acquire()`）的行为测试（独立入口，零依赖，**21 条**，零 GPU/零真渲染）：acquire/release 往返 · ★ **槽位上限**（`RENDER_SLOTS=2` 时第 3 个 `acquire()` 必须**排队**、别人释放后才拿到 —— 用**子进程并发**验，因为被测源码的等待是 `Atomics.wait` **同步阻塞**，同进程连调两次会自锁）· 过期槽接管（**死 pid 必须接管** vs **活 pid + 新鲜心跳绝不接管** vs **活 pid + 心跳超时按源码 OR 语义会被接管**）· `.mutex` 残留超 GRACE 必须能清掉继续（不能永久自旋）· `RENDER_SLOT_HELD` 只认 `'1'` · `freePct()` 值域 · CLI 退出码透传（0 / 7 / 2 / 127）与不泄漏槽位 · 非法 env 回落（`RENDER_SLOTS=abc` ⇒ 3、`RENDER_MIN_FREE=999` ⇒ 30）。★ 上一批已做**变异验证 12/12**（本轮修 ②③④ 后又复验 7 个，含 ②/④ 相关的 M-J/M-K/M-F/M-L ⇒ 全部仍被抓住）：把 `slot.mjs` 拷到临时目录逐条改坏（`alive` 恒真/恒假、`STALE_AFTER` 改 0/极大、不看心跳、`GRACE` 极大、删掉 `HELD` 短路、去掉 `envNum` 校验、槽位数 +1、CLI 恒 `exit 0`、release 不看 pid）⇒ 对应断言**全部变红**。★ **被测源码的 5 处问题 —— ②③④ 已于 2026-10-07 修复（库仓 `a24b6b9` + `74b5d77` + `5671b38`），①⑤ 按设计只写进头注释、不改语义**：① `stale()` 是 `!alive(pid) || 心跳超时` 的 **OR** 语义 ⇒ 活着的占用者一旦心跳停更 >90s 会被接管（**实测当前不可达**：唯一调用者 `video.mjs` 的渲染主循环每帧 `await`、事件循环不被阻塞，心跳正常；属**潜在**设计风险 ⇒ 已把「占用者不得让事件循环阻塞超过 STALE_AFTER」写成头注释的**前置条件**）② `release()` 改槽位目录**不在互斥锁内**（与 `tryTake` 有 TOCTOU）⇒ **已修**：整体移进 `withMutex`，与 `tryTake` 同一把锁 ③ 导出的 `tryTake` 有隐性前置条件（`DIR` 必须已存在，否则 ENOENT）⇒ **已修**：`tryTake` 自建 `DIR` ④ `acquire()` 每次调用都 `process.on('exit', release)` 且**从不 `off`** ⇒ 监听器累积（实测第 11 个触发 `MaxListenersExceededWarning`）⇒ **已修**：`release` 里 `process.off`，且**放在 `try` 外面**保证一定执行 ⑤ `acquire()` 无超时/退出条件，故障形态是静默挂起（已写进头注释）。★ 修 ② 时**引入过**一个回归（`release` 走 `withMutex` ⇒ `DIR` 不存在时抛 ENOENT，而它会被 `process.on('exit')` 调用）⇒ 同批修掉：`release` 改成 **best-effort 绝不抛**，且 catch **只对非 `ENOENT` 留痕**（`warnOnce`）——`ENOENT` 是预期内（槽位反正会过期被接管）、其它错误（`EACCES`/`EPERM`）是真问题不该静默；并新增 1 条回归测试钉住「DIR 被外部删掉后 release 必须不抛」。
test/README.md      本文件
```

`smoke.mjs` 构造的 `ctx` 会传给每条用例：

| 字段 | 说明 |
|---|---|
| `root` / `orchPath` | 项目根 / 编排器路径 |
| `state` | 用例间传值（④ 把 dry-run 任务 id 放这儿给 ⑥⑦ 用） |
| `note(msg)` | 打印备注（最后统一列出） |
| `sleep(ms)` | 异步等待 |
| `port` / `get` / `post` / `del` / `sse` | HTTP 工具（`get` 支持 `headers` / `maxBytes`；`sse` 支持 `headers` / `stopOn`） |
| `restartServer()` | 杀掉测试服务再起一个（端口会变，`ctx` 里的 HTTP 工具自动跟着换）—— 跨重启用例用 |

> ★ 用例分三组跑：`STATIC_CASES`（不起服务）→ `SERVER_CASES`（服务在跑）→ `PROCESS_CASES`（在本进程里 `import lib/jobs.mjs` 起独立队列，验 WSL 侧进程组 / 内存裁剪）。
> `PROCESS_CASES` **必须排在 `SERVER_CASES` 之后**：它会往 `.console` 写任务记录，等服务把历史读完再写，测试服务的内存里就不会带着这些测试任务、收尾时也不会被它写回去。

---

## 相关的独立检查脚本（**不在**本测试套件内，需手动跑）

这几个是「配置/渲染口径」的专项检查，不进 `smoke.mjs`（有的很慢、有的要 ffmpeg）：

| 脚本 | 查什么 | 速度 |
|---|---|---|
| `scripts/check-dub-styles.mjs` | 「文案+风格」配置的**纹理**硬红线（STYLE.md 声明 vs `bgRecipe.texture`）+ **字幕底衬**的模型级校验（取值合法 / 显式色画不出来 / 对比度 ≥4.5 / STYLE.md 明写「no box」却开 box / 必须有 `dub-visual` 证据） | 秒级 |
| `scripts/check-plate-pixel.mjs` | 字幕底衬的**像素级**校验：真实渲染一帧，用**品红标记色**验证底衬色确实取自 `plateColor` 字段，并实测字色对比度 ≥4.5。★★ **2026-10-07 补（修「扫到 0 个对象却全绿」）**：**底衬差分 0 像素**（底盒没画出来 / 与背景同色 ⇒ 视觉上等于无底衬）判**真缺陷 FAIL** —— 旧版这一行**没有 `ok` 字段** ⇒ 被 `:185` 的 `rows.filter((r) => r.error || r.ok === false)` **漏掉** ⇒ 全部风格都差分 0 时仍打印「✓ 全部通过：底衬色确实取自 plateColor…」+ **exit 0**（**一个底衬色都没真正判过**）。★ **为什么判真缺陷而非失明**：闸门确实渲了 `withBox`/`noPlate` 两帧并**得出了结论**（且品红标记测试在同一情形下同样给 `ok:false`「差分 0 像素（底衬没画出来）」）⇒ 这是该风格的缺陷，不是「没判」。★ 另加**计数式守卫**：**全部**风格都差分 0 ⇒ 明说「一个底衬色都没真正判过」（写法照 `check-skill-artifacts` 的「全部 SKIP」/ `check-dub-styles.mjs:214` 的 `skipped === dub.styles.length`）。★ **部分差分 0 = 逐风格真缺陷 FAIL**（不设阈值；差分 0 恒是「盒不可见」这一缺陷，无需按比例放行）。★ 反向验证（临时树夹具，非破坏）：全部差分 0 **改前 exit 0 + 「✓ 全部通过」／改后 exit 1 + 「一个底衬色都没真正判过」**、正常 **仍 exit 0**、部分差分 0 **exit 1 且只点名缺陷风格**；真实树 25 风格 **逐字节不变** | ~1 分钟（25 个风格） |
| `scripts/style-skill-check.mjs` | 43 份 `lib/style-skills/<slug>/SKILL.md` 的 11 节契约自检 | 秒级 |
| `scripts/check-skill-artifacts.mjs` | 43 份 `_distill.json#generatedVideo` 记录的 **path / bytes / durSec / width / height / fps / frames** 与磁盘实物是否一致（`ffprobe` 实测；只校验文档确实记了的字段）。★ 这一招抓到过两次真问题：`game-show` 文档记的是旧成片、`ascii-crt` 成片被 `--full` 用例误覆盖。支持 `--update` 按实物更正。★ **失明守卫 ①（2026-10-06 补）**：一个带 `_distill.json` 的风格都枚举不到（目录不存在 / `--only` 拼错）⇒ **FAIL 并明说「本闸门已失明」**（旧版此处**静默假绿**）。★★ **失明守卫 ②（2026-10-07 补，修「一个都没检查却全绿」）**：主循环里 `!gv.path` 走 SKIP 分支时 `continue` ⇒ **比对与 `evidenceFrames` 检查被一起跳过**；若**所有**风格都 SKIP（如 `generatedVideo.path` 集体缺失），`fails`/`blind` 双空 ⇒ 旧版打印「✓ …全部一致」+ **exit 0**（**一个东西都没检查**）。现判据 **SKIP 数 == 风格总数 ⇒ FAIL 并明说「一个都没比对」**（写法照 `check-dub-styles.mjs` 的 `skipped === dub.styles.length`）。★ **部分 SKIP 不判 FAIL**（SKIP 是设计允许态；真实语料 43/43 都有 path ⇒ 误报率无样本可测、不设阈值），但会打一行 `ℹ 有 N/M 个风格 SKIP` 免得那句 ✓ 被读成「全都检查过了」。★ 反向验证（`LEMO_DISTILL_ROOT` 夹具，非破坏）：全部 SKIP **改前 exit 0 + 「✓ 全部一致」／改后 exit 1 + 「一个都没比对」**、正常树**仍 exit 0**、0 风格**原守卫仍 exit 1**、部分 SKIP（1/2）**exit 0 + ℹ**；真实树 43/43 **逐字节不变**。覆盖点 **`LEMO_DISTILL_ROOT`**（风格技能树，与 `check-film-delivery` / `check-tp-prose` 同名同义） | ~40 秒 |
| `scripts/check-skill-scores.mjs` | 43 份 `_distill.json` 的**评分自洽性**：① `matchScore` == `scoreBreakdown` 五项之和；② `defects` 里不再有「能被当前 `dub-styles.json` 配置值直接证伪」的条目（含历史语境守卫，`已修/原为/移入 resolvedDefects` 之类不算现行主张）；③ `SKILL.md` 的「风格匹配度自评」== 同目录 `_distill.json#matchScore`（防「改 json 忘了改正文」——实测 `backrooms` 出现过人读 90、机器读 91）。★ **失明守卫（2026-10-06 补）**：注册表读不到 / 解析失败 / 一个带 `_distill.json` 的风格都枚举不到 ⇒ **FAIL 并明说「本闸门已失明」**（旧版此处打印 `[1] 0/0 OK` —— **静默假绿**）。覆盖点 **`LEMO_DISTILL_ROOT`**（风格技能树）+ **`LEMO_DUB_STYLES`**（注册表，与 `check-dna-coverage` 同名同义）。★★ **2026-10-06 二次收紧：修 ② 的「假绿」（第五十八批审计列为「只报不改」，本轮改为修）**。旧判据把「条目仍引用当前配置值」实现成 `[...txt.matchAll(/#hex/g)].some(m => JSON.stringify(该风格配置条目).toUpperCase().includes(hex))` —— **在整份配置条目的文本里做子串搜索**，于是 defect 文本里只要出现**任何一个「配置里出现过」的 hex**（**哪怕是别的字段的色**，如 `subtitle.plateColor`），就被判「仍引用当前配置值」⇒ 把本该 FAIL 的「全失效」**降级成 WARN 的「混合条目」**（`exit 0` 假绿）。实测夹具 `D:/lemo-tmp/agent-matchaudit/fx-scores` vs `fx-scores-control`（唯一差别 = defect 尾部多一句别的字段的 hex `#AABBCC`）：`control` 改前 `全失效 1 条 exit 1`（正确）、`fx-scores` 改前 `⚠ 混合条目 … 全失效 0 条 exit 0`（**假绿**）。新判据**复用同一次断言抽取**（不另起正则）：逐条看被抽取的断言，若其引用值 **== 它所涉字段的当前值**（`texture`↔`bgRecipe.texture`、`fontFamily`↔`subtitle.fontFamily`、`bg/bg2/fg/accent/subtitle`↔`palette.<field>`）⇒ 该断言**未被证伪**，记一次 `citesCurrent`；只有 `citesCurrent > 0` 才是「混合条目」。即判据从「**配置里任何地方**出现过这个值」收窄为「**本条所涉字段**的当前值」（注意：`（实际是 paper）` 这类**修正句**抽不到断言、不计入 —— 这正是与旧假绿的分界）。**误报率（先测再定稿）**：真实 43 份上被抽取断言 **22 条**、**有证伪的条目 0 条** ⇒ 新判据在真实语料上**一次都没被触发**，`[1]/[2]/[3]` 三项与改动前**逐字一致**（exit 0）。**验证**：真阳性 `fx-scores` 改后 **`全失效 1 条 ✘ exit 1`**、改前 HEAD **`混合条目 exit 0`**（假绿）；真阴性真实 43 份 **exit 0 且逐字一致**；不误伤对照（defect 确实引用了**本条所涉字段**的当前值：`bgRecipe.texture 写成 grain（实际是 paper）；另 palette.bg 是 #112233`，`#112233` 即当前 `palette.bg`）**仍判「混合条目 WARN」exit 0**（改前也 exit 0，无回归） | 秒级 |
| `scripts/measure-truepeak.mjs` | 实测 43 部成片的**真峰值 / 响度 / LRA**（口径：`loudnorm` 的 `input_tp`，4× 过采样真值；**不是** `astats` 采样峰值）。`--check` = **交付闸门**（任一超 −1.2 dBTP 即退出码 1）；`--json` 出机器可读；`--limit N` 限量。★ 注意 loudnorm 的值是**带引号字符串**，解析正则必须允许两侧引号，否则会静默把「测出来了」误报成「测量失败」 | ~1 分钟 |
| `scripts/fix-truepeak.mjs` | 把**已成片**的真峰值修进交付口径，并**对账 `selfCheck.loudness`**。两件事：① 真峰值 > −1.2 dBTP ⇒ 音频重混压到 ≤ −1.5 dBTP；② 按实测回写 `truePeakDbtp` / `integratedLufs` / `lra` / **`samplePeakDbfs`**。用 `-c:v copy` 只重编码音轨，**视频流逐字节不变**（脚本自校验 md5/时长/帧数，不符即拒写）。★ 核心是「**编码 → 测量 → 重试**」的候选上限阶梯：`alimiter` 上限与最终真峰值**非单调**（实测 256k 下 −3.5 比 −3.0 更差、shadow-puppet 的 −3.0 甚至给出 −0.07），固定参数必然在部分素材上静默失败。★ **② 的由来（2026-10-05 补）**：早期版本只回写前三个字段、**不回写 `samplePeakDbfs`** ⇒ 被重混过的成片该字段停在**重混前**的旧值、旧值甚至 **> 同片真峰值**（物理不可能：采样峰值恒 ≤ 真峰值），实测中招 5 片（`risograph`/`blueprint`/`dataviz`/`microgame`/`papercut-red`）。现在两个值来自**同一次 ffmpeg 测量**（`astats,loudnorm` 串联；实测 `input_tp` 与单跑 loudnorm 逐片一致，不多跑一遍）。★ 对**已达标**成片，② 是**纯元数据对账**：只改 json、**成片零改动**，且只在**内容真变**时落盘（无 mtime 噪声）—— 首次全库对账补上 25 份**原本缺失**该字段的片。★ **精度陷阱**：`truePeakDbtp` 只存 2 位小数（loudnorm 口径）而 `astats` 给 6 位 ⇒ 真峰值被**向下**舍入时采样峰值会「看起来」更高（实测 5 片差 0.0008–0.0037 dB，纯伪影）⇒ 落盘时把采样峰值**夹到真峰值以内**，保证 `samplePeakDbfs ≤ truePeakDbtp` 恒成立。改前自动备份到 `_tpfix-backup/`，`--restore` 可还原 | ~1–10 分钟 |
| `scripts/sync-tp-docs.mjs` | 成片真峰值修好后，把「已修」同步进 18 份文档（json 的 `defects`→`resolvedDefects` + `audio` 分回补 + `SKILL.md` 正文句末追加已修子句 + 自评分数）。★ 两条踩坑固化成规则：① **不要就地改「响度目标」行的旧真峰值**——那行后半句常紧跟「超出交付线 X dB、已削波」的判语，只改数字会让同句自相矛盾，照 ascii-crt 先例**整句保留 + 句末追加**；② 旧值写法全角/半角/正号/dBTP/dBFS 各不相同，锚点**逐条写死**，用正则猜会静默不替换 | 秒级 |
| `scripts/prune-jobs.mjs` | 控制台出片目录 `_jobs/` 的**保留策略**（默认**只报告不删**）。★ 由来：`_jobs/` 此前**无任何保留策略**，每出一片就落一份 mp4+srt、只增不减（实测 5 个任务 145MB，而注册表 `.console/index.json` 已有 **53** 条 ⇒ **膨胀主因是注册表**）。★ **三处一致**：产物目录 `_jobs/<id>/` + 注册表条目 + 日志 `.console/logs/<id>.jsonl`（只删一处会留「点进去 404」的僵尸任务或孤儿目录）。判据：只处理**已结束**任务（`endedAt` 有值或 status ∈ done/failed/canceled）、**绝不动 running**；按 `createdAt` 保留最新 `--keep N`（默认 10）；产物目录不存在时仍清注册表+日志。★ **安全闸**：路径必须落在 `_jobs/` 内、且 `lstat` 判定**不是 junction/符号链接**（本机踩过「junction 的 `rm -rf` 会穿透删真实目标」）⇒ 命中即跳过并 **exit 1**。默认 dry-run，`--apply` 才执行；覆盖点 `LEMO_FILM_DIR`（默认 `D:/lemo-films`，与 `lib/jobs.mjs` 的 FILM_DIR 同义）⇒ 可在临时树上非破坏验证。★ 实测（临时树，绝不碰真实产物）：dry-run 报告正确；`--apply` 删目录+日志+注册表条目且保留最新；**junction 被拦、真实目标 `keep.txt` 完好、exit 1**；**`--keep 0` 极端下 running 任务仍完好** | 秒级 |
| `scripts/sync-film-caliber.mjs` | 用**实测值**回填 43 份 json 的成片技术口径。★ 立它的原因：真峰值在 json 里的**权威位置是 `selfCheck.loudness`**（不是 `generatedVideo`）——`fix-truepeak.mjs` 最初写错位置，更新成了**静默空操作**（json 记 +1.73、正文说已修）。同时加法式补 `generatedVideo.width/height/fps/frames` | ~1 分钟 |
| `scripts/check-film-delivery.mjs` | 43 部成片的**交付口径闸门**：`selfCheck.loudness` 的 `truePeakDbtp`/`integratedLufs`/`lra` + `peakTargetMet` + `generatedVideo` 的 `width/height/fps/frames/durSec/bytes` **逐条与实测对照**；外加容器健康（`pix_fmt` / 音视频时长差 / 音频码率 / `moov` 在 `mdat` 前）。★ LRA 口径是 **`ebur128`**（`loudnorm` 的 `input_lra` 系统性偏大，实测同一片 6.0 vs 8.20），故只要求与两来源之一匹配。★★ **2026-10-04 补 C 类**：原先只有 A（文档值 vs 实测值）与 B（`peakTargetMet` 布尔与实测是否一致）—— **两条都只判「自洽」，不要求实测真的达标** ⇒ 实测一部真峰值 **−0.21 dBTP（超 −1.2 交付线）** 的成片在 **22 个闸门全绿**下存在过（`pictogram-motion` 重渲时 `--skip-audio` 复用旧 `mix.wav`，**冲掉了此前 fix-truepeak 的修复**）⇒ 「43 部口径一致」**≠**「43 部都达标」。C 类把「**实测真峰值 ≤ 交付线 −1.2 dBTP**」钉死；★ 用「**有 C / 无 C 两版闸门跑同一棵含超标成片的临时树**」做过对照验证（无 C 时那条**完全消失**，失败数 4→3）★★ **2026-10-06 补 F 段「重渲窗口守卫」（修一个设计缺陷：它在批量出片期间**必红**、无法区分「真漂移」与「正在重渲」）**：A/B/C/D 判的是「**文档声称值 vs 磁盘实测**」，而**每日批量出片会重渲成片**、文档要等批次跑完才由 `refresh-style-skill.mjs` 回填 ⇒ 在「成片已重写、文档还没回填」的窗口里这些「不一致」**不是回归**。实证（当日）本闸门报 **exit 1 / 23 处 / 12 部**，两路独立证明不是回归：① 用**改前**的 `mux.sh` 复跑（`LEMO_MUX_SH` 指向旧脚本）⇒ 输出与改后**逐字节相同**（同样 23 处 A/C 类）；② 23 处**全是**「文档值 vs 磁盘实测」，且 12 部**全部**落在当日 09:04–09:33 的重渲名单里（成片 mtime 新于文档 mtime）⇒ 是**日批正在重渲导致文档过期**。判据（机械、可解释）：必要条件 **成片 mtime 新于 `_distill.json` mtime**（文档按定义没描述当前成片，不能拿它判漂移），**且**下列任一 —— ① **成片很新**（≤ 15 min）；② **该 slug 的并发锁活着**（`<LOCK_DIR>/.<slug>.lock`，判据**逐字复用** `lemo-make.mjs:1559-1563`：pid 仍在 且 锁龄 < 6h）；③ **批次在跑**（`_distill/render-run-*.log` / `state.json` / `logs/*.log` 最新 mtime ≤ 10 min，**逐条对齐** `_distill/AGENT-BRIEF.md:423-428` 的既有探测法）。命中 ⇒ **不判 FAIL**（exit 0），报「**疑似正在重渲，本次不判**」并**逐条列出本会报的**（判据一条没删，只改分级）；E 类（静态脚本判据）**恒判、不让位**。★ **失明守卫**：成片不存在/读不到（拿不到 mtime）或文档 mtime 读不到 ⇒ 明说「**失明**」并 FAIL，不静默放过。★ **已知局限**：窗口是**时间**判据 ⇒ 窗口内无法区分，靠「下次再跑」收敛（真漂移是稳定条件，排空后必然重报）；批次在跑时与本次批次无关的旧文档过期也一并让位（排空 10 min 后恢复判定）；`ffmpeg` **进程不作判据**（渲染跑在 **WSL 侧**，Windows `tasklist` 看不见）；`.console-port` **不作判据**（退出时不删，存在 ≠ 在跑）。★ **变异验证（临时副本 + 覆盖点，绝不动真实成片）**：S0 阴性对照（成片 2h 前 / 文档 3h 前，**无任何信号**）⇒ **仍 FAIL** ✓；S1 成片 1 min 前 ⇒ 让位 ✓；S2 批次日志 0.5 min 前（成片 40 min 前）⇒ 让位 ✓；S3 并发锁活着 ⇒ 让位 ✓；S4 文档比成片新（真漂移）⇒ **仍 FAIL** ✓；S5 成片缺失 ⇒ FAIL 且明说失明 ✓；S6 **逐片**让位（一片新一片旧 ⇒ judged 1 / deferred 1 / FAIL 1）✓；S7 **E 类不让位**（两片都很新 + 临时 `mux.sh` 无闭环 ⇒ E 仍 FAIL 6 处）✓。覆盖点新增 **`LEMO_DISTILL_ROOT`**（风格技能树，与 `check-film-aspect` / `check-tp-prose` 同名同义）/ **`LEMO_BATCH_DIR`**（批次证据目录）/ **`LEMO_LOCK_DIR`**（与 `lemo-make.mjs:1549` 同名同义）。★ 同日实测：日批排空后本闸门仍报 23 处 ⇒ 逐条核对**全是文档过期、零真漂移**（无一条 `C 真峰值超标` / `C 响度偏离交付线` / D 类）⇒ 用 `refresh-style-skill.mjs --all` 回填 23 份 `_distill.json`（12 份是这 23 处；另 11 份是 `integratedLufs: -14 → -14.18`、`durSec: 54.4 → 54.42` 这类**精度**补齐）⇒ **exit 0**。★ 顺带修：`--json` 原先被 `[E] …` 那行 stdout 污染（不可 `JSON.parse`，实测踩到），现该行在 `--json` 时走 **stderr**。★★ **2026-10-07 补 F 段计数式失明守卫（修「一部都没判却全绿」）**：F 段让位是**有意的**（避免并发重渲误报，**保留不删**），但若**每一部**成片都命中让位条件 ⇒ `judged = slugs.length − deferred.length = 0` ⇒ 旧版打印「✓ 被判的 **0** 部成片交付口径全部一致」+ **exit 0**（**一部成片都没判**、且每条本会报的错都被「若不是疑似重渲，本会报」吞掉）。现判据 **让位数 == 成片总数 ⇒ FAIL 并明说「一部成片都没判」**（写法照 `check-skill-artifacts` 的「全部 SKIP」/ `check-config-vs-doc.mjs:308`）。★ **部分让位不判 FAIL**（让位是 **per-slug 时序信号**、**有意**按片判定；部分让位时其余片子仍被**真判** ⇒ `judged ≥ 1`、闸门没空转；真实语料实测 43 部 **0 部**让位 ⇒ 误报率无样本可测、不设阈值）。★ 反向验证（临时树 + `LEMO_DISTILL_ROOT`/`LEMO_BATCH_DIR`/`LEMO_LOCK_DIR`，非破坏）：全部让位 **改前 exit 0 + 「✓ 被判的 0 部…」／改后 exit 1 + 「一部成片都没判」**、全部正常 **仍 exit 0**、部分让位（1 让位 / 1 判）**exit 0 + judged 1**；真实树 43/43 **逐字节不变** | ~1.5 分钟 |
| `scripts/check-shell-structure.mjs` | 渲染链 shell 脚本的**结构闸门**（`--wsl` 附带扫 WSL 侧）。★ 查两类**都能骗过 `sh -n`** 的问题：① **`\` 续行后面紧跟 `#` 注释** ⇒ 注释吃掉续行、命令被截断（实测 `watercolor`/`paper-popup` 的 `mux.sh` 因此报 `sh: -af: command not found`，**根本出不了片**，而 `sh -n` 报 OK）；② **判定块以 `if…fi` 结尾、后面没 `exit 0`** ⇒ 退出码与判定结果**全反**。★ 带「WSL 扫描为空即 FAIL」的防假通过护栏 | ~20 秒（含 WSL 约 60 秒） |
| `scripts/check-loudness-targets.mjs` | 「文案+口播」通路的**响度目标解析闸门**。★ 由来：`dub.mjs` 的 `targetLufs` 默认 **−16**（`// 社交视频常用`），靠 `parseTargetLufs()` 从 `lib/style-dna/<slug>.json#sound_palette.mix_rules` 的**中文散文**里正则抽值来覆盖；`pixel-rpg` 的档案恰好漏了这个数（全 43 份里唯一一份）⇒ 该风格 dub 出片**静默停在 −16**，与其余 42 个的 −14 差 2 LU。判据：43 份档案必须**全部**能解析出 `targetLufs`。★★ **2026-10-07 修「退出码与文案各说各话」**：原先末行的 ✘/OK 只算 `miss/offLine/blind`，而 `process.exitCode` **多算了 `dnaOnly`/`skillOnly`** ⇒ 实测出现过「**末行打印 `[闸门] 响度目标解析 1/1 OK`、退出码却是 1**」—— 读文案的人与读退出码的人得出**相反结论**（而头注释写明的策略本来就不含这两项）。现把两处**收成同一个变量** `const fail = miss.length > 0 || offLine.length > 0 || blind.length > 0;`，末行与 `exitCode` **都读它** ⇒ 结构上不可能再分叉；`dnaOnly`/`skillOnly` 保持 `⚠` 级只列不判（它们判的是「文档集合对齐」，不是本闸门的主题「能否解析出响度目标且等于交付线 −14」）。真实语料改前改后逐字相同（`43/43 OK`，exit 0） | 秒级 |
| `scripts/check-tp-prose.mjs` | **SKILL.md 正文**的真峰值声称是否与实测一致（`check-film-delivery` 只覆盖 json，**正文是盲区**）。★ 判据只认「关于本片成片」的断言（匹配点所在**整行**出现「成片」），排除「样片/母带实测」「声明上限 ≤ −1 dBTP」这类误报；历史语境看**整行**（这些行很长，`已修` 子句常在行尾）。交叉引用（引用他片旧值当先例）单列不计 FAIL。★ **2026-10-05 收窄（先测误报率）**：初版命中 **1** 条 = `pictogram-motion:174`，逐条核对后 **真陈旧 0 / 误报 1 ⇒ 误报率 100%**；放宽 ③ 到整行 ⇒ 4 条（真陈旧 1 / 误报 3，**75%**）；去掉 ③ ⇒ 10 条（真陈旧 5 / 误报 5，50%）。⇒ 当时结论是「③ 的 60 字窗有效」（**★ 该结论已于同日被推翻，见下**）。★ **2026-10-05 修 ③ 的「60 字窗假阴」（本次，判据又变了）**：在**含 8 处真陈旧的对照树**上实测，旧 60 字窗**命中 0 ⇒ 假阴 8/8 = 100%**（`hd-2d:120` 的「成片」离 `−1.54` **69** 字、`watercolor:214` 离 `−1.72` **144** 字 —— 全在窗外）⇒ 判据 ③ 由「前后 60 字」放宽为「**整行**含『成片』」。**先测误报率**：只放宽 ③（不加 ⑥）⇒ 命中 **10**（真陈旧 **8** / **误报 2 = 20%**）；两处误报同型 —— `hd-2d:120` 的 `−2.49`、`brick-toy:105` 的 `−0.1`，都是**上游 `demo/mix.wav` 的真峰值**被连带捞进来。⇒ 加 **⑥ 非本片产物排除**（数值**所在句**出现 `mix.wav`/`score.wav`/`母带`/`中间产物`/`上游`/`样片`/`素材` ⇒ 上游读数、不是成片声称；**必须排在 ⑤ 之后**，否则会把「`mix.wav` 波峰因子扫描」那条实验行一起吞掉）⇒ 命中 **8** / 真陈旧 **8** / **误报 0（0%）**。★ 也试过更窄的「同句（按 `。！？；` 分句）」：命中 **1**，但**连 `hd-2d:120` 与 `watercolor:214` 一起漏掉** ⇒ **不采用**。★ 放宽后**新覆盖**的 6 处真陈旧（此前被 60 字窗遮蔽）已按 `loudnorm input_tp`（4× 过采样）实测改正：`paper-lantern:112/117/230/245/266`（正文 −1.66 / 实测 **−3.37**）、`paper-popup:215`（−1.65 / **−2.33**）。★ **残留误报「实验/扫描表」一类**：`pictogram-motion:174` 是「逐档扫描波峰因子」的记录（`PLR 12.99 → +0.28 dBTP` / `10.70 → −1.27` / `9.22 → −2.90` / `8.61 → −2.77`），`+0.28` 只是**中间档读数**。⇒ 加 **⑤ 实验行排除**：整行 ≥2 组「箭头 → 数值 dBTP」即多目标→多实测的对照串 ⇒ 不计 FAIL、单列「实验行」。★ **2026-10-05 修「结构性失明」（本次，判据与覆盖面都变了）**：旧判据 ① 是「**值 > −1.2 才查**」（本意：不达标值不可能是陈旧声称）—— 但它**把所有「修复/重渲后已达标」的值一起排除** ⇒ 「某风格曾写 X、后来重渲或重混，正文仍写 X」这一整类**永久隐形**（只要 X 与现值都 ≤ −1.2，如正文 −2.79 / 实测 −3.26），④ 历史豁免再盖一层。⇒ 现改为「**关于本片的当前结论句（成片语境 + 非历史），无论值是否达标，与实测差 > 0.15 dB 即 FAIL**」；旧 ① 换成 **① 阈值/交付线提及排除**（(a) 数值 == `selfCheck.loudness.peakDbtpTarget`（本库 43/43 = −1.2）；(b) 阈值词**紧贴**该数值且不跨分隔符）。★ 收窄前的误报率实测（43 份正文 / 452 个 `<数> dBTP`）：只放宽旧 ① ⇒ 命中 **21** 处，其中 **18** 处是 `−1.2 dBTP` 交付线本身（**误报率 86%**）、真陈旧仅 3；加 ①(a) ⇒ 命中 **3** 处、**误报 0**；再加 ①(b) 再排除 19 处、命中仍 **3**（零边际）。★ 新判据上线**当即在真实树上 exit 1**（这是正确行为），抓到 **3 处真陈旧**：`halftone-dossier:186`（正文 −2.79 / 实测 −3.26）、`hd-2d:299`（−1.54 / −3.21）、`watercolor:105`（−1.72 / −3.34）—— 三处已按 `loudnorm input_tp`（4× 过采样）实测改正（后两条为「本次复测/复跑」的历史记录句，按项目习惯**保留原句 + 加 `原记` 标记 + 补现值**；`watercolor:105` 是当前结论句，直接改成实测值、**不加**历史标记），改正后全库重新 **0 FAIL**。★ 已知残留盲点（实测 0 例，记录备查）：正文若**恰好**写 `−1.2 dBTP` 当声称，①(a) 会把它当线放掉；「`−1.86 dBTP（上限 −1.2）`」这种同子句混排会被 ①(b) 放掉。★ 覆盖面已知缺口：配套回写工具 `patch-tp-prose.mjs` / `refresh-style-skill.mjs` 的判据里都带「**值 > −1.2**」⇒ 它们**只补「超标 → 达标」那一类**，「**一直达标、重渲后值变了**」这一类**没有工具会写**，只能人工按实测改（本次 3 处即此）。★ 为什么不改成「该数值须是行内唯一 dBTP」：真陈旧样本多数同行还有 `−1.2 dBTP` 交付线（`game-show:197`/`impasto:205`/`stained-glass:183`/`backrooms:213` 都是 2 个）⇒ 会连真陈旧一起放掉。★ 失明守卫：读不到 `selfCheck.loudness.truePeakDbtp` 的风格单列；**全部读不到 / 0 个风格 ⇒ FAIL 并明说「本闸门已失明」**（旧版此处是**静默假绿**）。支持 `LEMO_DISTILL_ROOT`（风格技能树=**正文源**，指向临时拷贝即可构造真陈旧样本，**绝不动真实文档**）/ `LEMO_TP_MEASURED_JSON`（**真值来源**覆盖文件 `{slug: 数}`，指向 `{}` 即验证失明守卫）★★ **2026-10-05 泛化：从「只查 dBTP 一种数值」变成「成片读数这一类声明」**（根因：按**某一种数值**写闸门 ⇒ 非 dBTP 的成片读数**没有任何闸门管**，实测残留 `paper-popup:215` 的 `93,346,551 B`、`watercolor:190/192/214` 的 `51,107,756 字节`、`blueprint:163` 的 `LRA 4.5 LU`、`watercolor:105` 的 `LRA 6.8`、`paper-lantern` 的 `TPK −1.7 dBFS`）。现为**同一套**「抽取 → ① 值域 → ② 阈值/交付线排除 → ③ 与真值对账 → ④ 成片语境 → ⑤ 历史豁免 → ⑥ 实验行 → ⑦ 非本片产物 → ⑧ 逐量纲附加排除+位置守卫 → ⑨ 交叉引用」流水线，量纲只以**登记项**（`DIMS`）加入 —— **加一种量纲 = 加一条登记，不再加一条判据**。已登记 8 类：**dBTP / LUFS / LRA / 字节数 / 分辨率 / 帧数（判 FAIL）+ 体积 MB / 时长（按实测误报率降级为「参考」）**。★ 每类都**先测误报率再定判据**：LUFS 初版 7 命中 **误报 7/7 = 100%** ⇒ 加静音读数（≤ −50 LUFS）+ 阈值 + 非本片产物 ⇒ 3（真 2/误 1）⇒ 改**非对称口径带 `[−0.15,+0.30]`**（实测 `ebur128 I − loudnorm input_i` ∈ [0,0.30]）⇒ **命中 1/误报 0**；LRA **声明 `ebur128` 口径才判**（紧容差 0.1；未声明/声明 loudnorm ⇒ 参考，两口径实测相差最多 1.4 LU）⇒ **命中 1/误报 0**；字节 **13 命中/误报 1**（配乐源文件）⇒ ⑦ 补 `源文件|.mp3` ⇒ **12/0**；MB **11 命中全是误报**（首版/`video_gpu`/x264 实验）⇒ **降级参考**；时长 **257 命中全是误报**（出片耗时/片段时长/静帧超时）⇒ **降级参考**；分辨率加**位置守卫**（紧贴前置 `=`、紧贴后置 `u`）⇒ **0/0**；帧数 **0**。★ 真值**复用** `check-film-delivery.mjs` 的测量结论（json == 实测，43/43 一致），不自己跑 ffmpeg（保持秒级）。★ 覆盖点：`LEMO_DISTILL_ROOT`（正文源+真值源）/ **`LEMO_READINGS_MEASURED_JSON`**（多量纲真值覆盖 `{slug:{dBTP,LUFS,LRA,bytes,durSec,width,height,frames}}`，指向 `{}` 即逐量纲失明）/ `LEMO_TP_MEASURED_JSON`（旧，保留兼容）★★ **2026-10-05 再纳入 `dBFS`（第 9 类量纲，本轮）**：全库 **149 个** `<数> dBFS` 此前**无人对账**。★ 难点是**口径歧义** —— 同一串数字混用三个口径（实测分布：`ebur128 Peak` 32 / `astats|采样峰值` 39 / `loudnorm input_tp|真峰值|dBTP|TPK` 42 / `RMS` 9 / 无口径词 27）⇒ 必须「**口径感知 + 多真值**」。**双真值 + 一派生真值**（全取自既有 json，不另跑 ffmpeg）：`samplePeak` = `audioEvidence.measuredInFilm.{samplePeakDbfs,astatsPeak6dp}` ?? `selfCheck.loudness.samplePeakDbfs`（**43/43 都有**，与 `astats` 实测逐片一致）；`truePeak` = `selfCheck.loudness.truePeakDbtp`；`ebur128Peak` = **`round(truePeak,1)`** —— ★ **实测 43/43 逐个相等**（`ebur128=peak=true` 的 `Peak` 只印 1 位小数）。**口径词 → 真值**：`astats|采样峰值|sample peak` ⇒ samplePeak（容差 **0.01**）；`ebur128|Peak` ⇒ ebur128Peak（**0.001**，真值已舍入到 1 位 ⇒ 应精确相等）；`input_tp|真峰值|dBTP|TPK` ⇒ truePeak（0.15）；`RMS` ⇒ **参考**；**无口径词 ⇒ 最保守**（与任一真值相符即放行，否则**参考、不判 FAIL**）。**口径词按「所在句内离 token 最近」选**（±45 字）。★★ **误报率逐级实测（先测再定判据）**：放宽（无值域/无口径/成片语境恒真）**20 命中 = 误报 20（100%）**；朴素单真值（= `input_tp`）**4 = 100%**；＋口径感知（「窗口内首个命中」）**8 = 100%**；最终判据 −「历史引用」降级 **1 = 100%**；**最终判据 0 命中 / 0 误报**。三处关键收窄：①**值域** `≤ −100 dBFS` ⇒ 数字零/静默段（实测 4 个 `−240 dBFS`）；②**口径按「最近」**（`tilt-shift:104` 的 `Peak -1.6 dBFS` 后 20 字才提 `astats`，用「首个命中」⇒ 8 条误报全是这一型）；③**「历史引用」降级**（`watercolor:105` 的 `−1.716 dBFS` 是「重渲前版本的读数，已不适用」的历史引用，该行已给当前值 `−3.350128`）。④采样峰值容差 **0.01**（`fix-truepeak.mjs` 会按设计把 `samplePeakDbfs` **夹到** `truePeakDbtp` 以内，2 位小数夹取伪影 ≤ 0.005）。★★ **另立第 ⑩ 类「物理约束」FAIL（最可靠，不需口径判断）**：**真峰值 ≥ 采样峰值 恒成立** ⇒ 「采样峰值 > 真峰值」物理不可能；两种形式都查 —— **(a) 数据级** json 自相矛盾（`samplePeakDbfs > truePeakDbtp`）、**(b) 声称级** 同句「采样峰值」>「真峰值」；容差 **0.1**（`input_tp` 2 位小数、`ebur128 Peak` 1 位小数 ⇒ 舍入伪影 ≤ 0.05；实测 5 部「采样峰值 > input_tp」**全是伪影**，Δ ≤ 0.004）。**本库实测 dBFS 真陈旧 0 / 物理不可能 0 ⇒ 本轮未改任何文档**。★ 变异验证（临时树 + `LEMO_DISTILL_ROOT`）：①真阳性（`astats` 采样峰值 `−3.385`→`−3.35`）⇒ FAIL 1 并点名；②口径感知（`ebur128 −1.6`→`−1.7`，差 1 位小数）⇒ FAIL 1，而只差 0.02 的纯舍入 ⇒ 不报；③物理约束（声称级 + 数据级）⇒ FAIL 各 1，阴性对照 ⇒ 0；④失明（`{}` / 空树 / 坏 JSON）⇒ 逐量纲报「已失明」exit 1。★ **2026-10-07 收紧 ⑤「历史语境豁免」（`CUR` 反向守卫）**：整行豁免留了个洞 —— 一行完全可能**既有历史叙述、又有当前结论**（「原先只走 `BorderStyle=1`，**现已切到** `BorderStyle=3`」），整行豁免会把行内的**当前读数**一起放过。现改为 **`HIST && !CUR` 才豁免**，`CUR = 现状|当前结论|目前|仍然|依旧|仍是只|仍只`（机制移植 `check-aspect-prose.mjs` 的 **`CUR` 常量** —— ★ 用**符号锚**不写行号，那个文件同行在改、行号会漂）。**实测（43 份正文）**：走到 ⑤ 的**量纲 token 350 个**（dBTP 191 / dBFS 54 / dur 34 / LUFS 23 / bytes 19 / frame 9 / LRA 8 / WxH 6 / MB 6；另 **297** 处是「物理约束」扫描的**行级**命中，合计 647），其中所在行同时命中 `CUR` 的 **26** 行（全部落在物理约束扫描段，**不含**任何 dBTP/LUFS/LRA 等量纲 token）⇒ 收紧后真实语料 **FAIL 0 / 参考 279 / 静音 11 / 实验行 1 / 交叉引用 6 逐字节不变（误报 0）**。★ 反向验证（`LEMO_DISTILL_ROOT` 夹具，非破坏）：`已修：真峰值原为 −1.2 dBTP，现状 −0.5 dBTP（本片成片实测）` ⇒ **改前 exit 0 / 陈旧读数 0**、**改后 exit 1 / 陈旧读数 1（dBTP 1）**；同夹具里「只有 `HIST`、没有 `CUR`」的那一行**仍被豁免**（计数 1 而非 2） | ~2 秒 |
| `scripts/check-skill-film-fields.mjs` | **SKILL.md 正文**的**成片帧数 / 分辨率 / 时长**声称是否与 `_distill.json#generatedVideo` 一致（`check-tp-prose` 只覆盖真峰值，这三类是**同类盲区**）。★ 由来：`paper-lantern` 正文写「已渲染的 **2922** 帧画面可直接复用」、json 已是 **2923**（2026-10-04 全量重渲后差 1 帧）。判据沿用 `check-tp-prose` 的四条件（值可疑 / 与实测不符 / **成片语境** / 整行无历史语境）+ 「非本片来源」排除（原生·样片·demo·声明值）+ 分辨率的「非假设语境」排除。★ 实测收窄：最宽判据帧数报 **26** 条、逐条人工判断后真陈旧 11 / **误报 15（57.7%）**（全是「demo 原生 900 帧」「样片 7980 帧」这类**设计期**值），收窄后 **9** 条、误报 **0**；分辨率 107 处不符里加守卫后 **0** 条。★ **时长降级为「参考」**（1874 处 `<数>s` 里 60 处落在成片近邻，多为出片耗时/片段时长，够不上 FAIL 精度）。★ 失明守卫：读不到 `generatedVideo` 的风格单列；**全部读不到 ⇒ FAIL 并明说「本闸门已失明」**。★ **2026-10-07 收紧 ④「整行历史语境豁免」（`CUR` 反向守卫）**：④ 原为「整行含 `HIST` ⇒ 整行豁免」，但项目习惯是「保留原句 + 追加更正」⇒ 同一行里可能**既有历史叙述、又有当前结论**（「原先只走 X，**现已切到 Y**」），这类行里的**当前读数**会逃掉检查。现改为 **`HIST && !CUR` 才豁免**（`CUR = 现状|当前结论|目前|仍然|依旧|仍是只|仍只`，与 `check-aspect-prose.mjs` 的 **`CUR` 常量** **逐字一致**；帧数 / 分辨率 / 时长**三处口径一并对齐**，时长只列参考故不影响退出码）。**实测（43 份正文）**：走到 ④ 的 token **62** 个（帧数 7 / 分辨率 4 / 时长 51），被 HIST 豁免的 **22** 个，其中**同行匹配 `CUR` 的 0 个** ⇒ 真实语料**零误报**、改前改后输出**逐字节一致**（`陈旧帧数 0 / 陈旧分辨率 0 / 参考时长 40 / 失明 1`，exit 0）。★ 反向验证（为做非破坏测试**新增覆盖点 `LEMO_DISTILL_ROOT`**，与 `check-tp-prose.mjs:325` **同名同义**，不设时逐字等价原硬编码路径）：夹具 `已修：成片帧数原为 100 帧，现状 999 帧。` ⇒ **改前 exit 0 / 改后 exit 1、陈旧帧数 1**；同夹具「只有 `HIST`、没有 `CUR`」的行**仍被豁免**（把 ④ 整条移除会报 2 处 ⇒ 证明第二行确实走到 ④、豁免是承重的）。★ **2026-10-07 b84-a 收窄 ⑨「交叉引用」作用域**：原按**整行**判（一行里任意位置出现别的风格名 ⇒ 整行读数一起放掉），本库长表格行常「前一句报本片读数、后一句引用他片当先例」⇒ 本片陈旧读数被顺带豁免（假绿）。现收到**同一子句**（`CLAUSE_SEP = /[。！？；;]/g`，与 `check-tp-prose.mjs` **逐字一致**）。**实测（43 份正文）**：⑨ **当前排除 0 个 token**（帧数 154→疑 23→有 ③ 语境 17→过 ⑧ NATIVE 7→过 ④ 0；分辨率 448→疑 176→有 ③ 语境 8→过 ⑧ HYPO 4→过 ④ 0）⇒ 收窄在真实语料上**零影响**、改前改后输出**逐字节一致**（`陈旧帧数 0 / 陈旧分辨率 0 / 参考时长 39 / 失明 1`，exit 0）。⇒ 另造**合成夹具**（真实树 + 注入「读数在前子句、风格名在后子句」）：**改前 exit 0（4 处真陈旧全被放掉）/ 改后 exit 1、陈旧帧数 1 + 陈旧分辨率 1、误报 0**；**反向证明（隔离）**：只把 ⑨ 退回整行 ⇒ 同一夹具**变绿**。★ 同批补 **WxH 朝向守卫**（⑨ 收窄暴露的 ⑧ 缺口，与 `check-tp-prose` b83-a 同源）：9:16 变体（竖画幅）⇒ **参考桶、不判 FAIL**（不静默丢弃），同朝向变体（1600×900）仍照判；真实语料该桶 0 处。★ 两闸门在同一合成夹具上结论**逐项一致**（`WxH 1 / frame 1 / 交叉引用 5`）。★ **未收敛重复实现**：删/薄封装会改动「闸门总数」（现 **31**），而该数字写死在 5 个文件、其中 3 个（`_distill/RETRO-b81.md`/`RETRO-b82.md`/`总进度复盘…md`，前两个是**带日期的历史复盘**）不在本批可改范围 ⇒ 强行删除会留下文档撒谎；留给能同时改这 5 个文件的一批 | ~2 秒 |
| `scripts/patch-tp-prose.mjs` | 给上面报出的陈旧正文声称**追加已修子句**（幂等）。★ 覆盖 `sync-tp-docs.mjs` 锚点够不到的位置：**文末摘要**与**下次迭代待办**里的旧值 | 秒级 |
| `scripts/normalize-skill-schema.mjs` | 把 43 份 `_distill.json` 的**字段结构拉齐**（`resolvedDefects` 曾缺 22 份、`loudness.lra` 缺 23 份、`truePeakMethod` 缺 2 份、`lraMethod` 缺 26 份）。★ **只做加法**：补缺失键 / 填实测值，**绝不重命名或合并** —— 把 `audioScoreBasis` 并进 `scoreBreakdown.audio` 会让该字段从数字变成对象，直接破坏「五项之和 == matchScore」判据。`--force-lra` 把全部 `lra` 统一重测成 ebur128 口径 | ~2 分钟 |
| `scripts/check-lra-caliber.mjs` | 43 份 json 的 `selfCheck.loudness.lra` 是否**统一口径**（项目口径 = **ebur128**）。★ 由来：该字段的值来自两个来源（早期抄出片日志 / `sync-film-caliber` 回填用 loudnorm），且 `fix-truepeak` 的音频重混**会真的改变 LRA**（实测 `shadow-puppet` 9.1 → 7.1） | ~1.5 分钟 |
| `scripts/check-config-notes.mjs` | `lib/dub-styles.json` 里 **`notes` 与它自己的字段是否自相矛盾**（notes 说某字段「缺失/为 null/未抽到」，字段其实有值）。★ 两段式判据：只取**第一个更正标记之前**的正文抽断言，若与字段矛盾则**必须有更正标记且点名了同一路径** —— 这样既不会因「保留历史」误报，也不放过没写更正的过期断言。★ **失明守卫（2026-10-06 补）**：注册表读不到 / 解析失败 / `styles` 不是非空数组 ⇒ **FAIL 并明说「本闸门已失明」**（旧版此处打印「未发现 notes 与字段自相矛盾」—— **静默假绿**）。★★ **失明守卫②（2026-10-07 补，修「0 条 notes 却全绿」）**：① 只保证 `styles` 是非空数组，但主循环 `if (!full) continue` 会把 **notes 为空**的条目全部跳掉 —— 若**所有**条目的 notes 都为空（配置被重新生成、notes 全丢），循环体**一次都不跑** ⇒ `fails=[]` ⇒ 打印「✓ 未发现 notes 与字段自相矛盾」+ **exit 0**（**宣称检查过、实际一条 notes 都没读**）。现统计「真正读过 notes 的条目数」，为 0 且 `styles` 非空 ⇒ FAIL。**实测（非破坏夹具，经覆盖点 `LEMO_DUB_STYLES` 注入 `{"styles":[{"slug":"a","notes":""},{"slug":"b"}]}`）**：加守卫前 `✓` + exit 0 ⇒ 加守卫后 `✘ 本闸门已失明：2 条配置里没有一条带 notes` + exit 1；真实语料（44 条 notes 全非空）改前改后输出**完全一致**（`notes 自相矛盾 0 处 OK；hex 参考 17 条`，exit 0）覆盖点 **`LEMO_DUB_STYLES`**（与 `check-dna-coverage` 同名同义） | 秒级 |
| `scripts/patch-config-notes.mjs` | 给过期的 `notes` 断言**追加更正子句**（幂等）。★ **不要反过来把字段清空** —— 字段里的值是真实在用的，notes 才是过期的那一方 | 秒级 |
| `scripts/refresh-style-skill.mjs` | ★ **「出片后反向更新 Skill 文档」的通用工具**（补项目的一条明确要求）。审计发现此前**没有任何通用工具**能做这件事：检测端有自动钩子（`dub.mjs` 的 `warnStyleChanges()` 只提示、绝不写库），写回端全是**硬编码 slug 表**的一次性补丁（`sync-tp-docs` 写死 18 个 slug、`patch-tp-prose` 写死 7 个锚点），换个风格就得手改。本工具给 slug（`--only`）或全部（`--all`）：实测成片 → 回填 `generatedVideo` + `selfCheck.loudness`（含 **ebur128 LRA**）→ **真峰值由超标变达标时自动在 SKILL.md 标「已修」**（响度目标行 + 全文里数值不再匹配的条目，判据与 `check-tp-prose` 同源）。★ 反向情况（旧达标、新超标）**不自动写**（要新增缺陷并定扣分档，属人工判断），只告警并退出码 1 | ~2 分钟（43 部） |
| `scripts/check-config-vs-doc.mjs` | 配置的**底色**是否在该风格文档「§3 配色体系」里**以背景角色**出现。★ 由来：`hd-2d` 的 `palette.bg = #fff0c8` 在 demo 里是**灯塔灯光色**（`cliff.js:161`），文档 §3 写的背景是夜空 —— 即**抽取时把灯光色当成了背景色**，`dub-visual.json` 自己的证据行都标着「灯光色」。★★ **2026-10-06 补角色感知（修一个已确认的真实盲区）**：旧判据只做**集合包含** —— 只要 `palette.bg` 在 §3 的**任意** hex 里出现过就放行；而 `#fff0c8` **确实**在 §3 里（`\| 主（暖实体光） \| … 灯塔 \`#fff0c8\` \| 故事由这些**实体灯**推动 \|` 的「色值」列）⇒ 集合包含命中 ⇒ 闸门放行，**真错靠人工才发现**。新判据**角色感知**：① 解析 §3 的**表格行**（角色列 = 第 1 列）；② 候选色（`palette.bg` + `bgRecipe.stops`）的「命中行」**精确优先**（§3 里有逐字节相同的 hex 就用它，外加 `RGB 欧氏距离 ≤ NEAR_ROLE=12` 的近似行），**一个精确都没有才退回 `NEAR=26`**（保留旧容忍度）；③ 非背景角色标记 `/灯\|光\|发光\|glow\|emissive\|强调\|accent\|描边\|边框\|高光\|亮部/i` **只扫角色列**（用途列是散文，合法背景行也会写「描边光晕」「accent」⇒ 扫用途列会误报）；④ 命中行里存在一行角色列**不含**标记 ⇒ 放行，否则（完全不在 §3，或**只**在非背景角色行）⇒ 判可疑。★ **为什么精确优先**：`NEAR=26` 会把 `#fff0c8`（暖奶油）算成 `#f3ead6`（UI 纸白，距离 **19.4**）这种**不同色** ⇒ 真阳性被放过。★ **为什么标记表不含「字/前景」**：`pictogram-motion` 的 `米白 CREAM` 行用途写着「深色相上的**前景字**与人、片尾底色」—— 它是合法底色。★ 语义：**文档第 11 节已记录的**列为「已知积压」不判 FAIL（文档里已有扣分与正确值），**文档没记录的**才 FAIL（那才是没人知道的新抽取错误）。★ **失明守卫**：`styles.length===0` 或全部风格都进 `noSec` ⇒ FAIL 并明说「**本闸门已失明**」。★ 覆盖点（新增）**`LEMO_DISTILL_ROOT`**（SKILL.md 根，与 `check-skill-artifacts` / `check-skill-scores` 等同名同义）+ **`LEMO_DUB_STYLES`**（注册表，与 `check-dna-coverage` / `check-config-notes` 同名同义）。★ 验证：真阳性夹具（把 hd-2d 的 `palette.bg` 回退成事故前的 `#fff0c8`）改后 **exit 1**、改前 HEAD **exit 0**；真阴性（真实 44 条）**未记录 0 处 / 积压 2 处（scifi-toon、tilt-shift，同批已清零 ⇒ 现为 0 处）/ exit 0**；失明（风格根指空目录）**exit 1 + 「本闸门已失明」**。★★ **2026-10-06 二次收紧（修残留盲区）**：原规则「**任一**候选色（`palette.bg` 或 `bgRecipe.stops`）以背景角色出现即放行」有致命漏洞 —— **一个正确的 `bg2` 会掩盖一个错误的 `bg`**（`stained-glass` 事故正是钻此空子：`bg #2a2a2e` 取自**测试文件** `styles/stained-glass/demo/test.js:9`、**完全不在 §3**，但 `stops` 里的 `#142a70` 是 §3 的「深蓝」行 ⇒ 放行 —— 这个闸门当初就是为这类错建的，却抓不到它）。现改为「**以 `palette.bg`（主底色）为准** —— `bg` **自身**必须命中背景角色行才放行；`stops` **仅当 `bg` 缺失/null 时**才看」。实测：真实语料 **0 未记录 / 0 积压 / exit 0**；`stained-glass` 改前态夹具（`bg #2a2a2e` + `stops [#2a2a2e,#142a70]`）**判可疑**（**改前规则下 exit 0**）；`hd-2d` 夹具仍 **exit 1**〔★ 2026-10-06 订正：这只对「§11 **未记录**该冲突」的文档成立（最小夹具）；若用**真实 SKILL.md**（其 §11 明确记了 `#fff0c8` 这条冲突），夹具归 **backlog / exit 0**、`--all` 下才 exit 1〕；失明仍 exit 1 且无 ✓。★ **两条已知局限的最终处置（2026-10-06）**：① **角色裁决是黑名单、没有正向白名单 ⇒ 只记录、不根治**（判据不成立）：`NONBG = /灯\|光\|发光\|glow\|emissive\|强调\|accent\|描边\|边框\|高光\|亮部/i` 是黑名单 ⇒ 任何**不含**这些非背景词的 role 都被当成「以背景角色记录」。**可被绕过的具体构造**（夹具实测）：同一个错底色 `#fff0c8` 写成 §3 **表格行** `\| 派生通路底 \| \`#fff0c8\` \| … \|` ⇒ **放行（exit 0）**；写成 §3 **散文 bullet** `- 通路的底色是 \`#fff0c8\`。` ⇒ **仍判可疑** ⇒ 判据对**格式**与**角色命名**都敏感、都不是内容判据。**为什么没换成正向白名单**（题给 12 词 `底\|背景\|天空\|纸\|地面\|环境\|墙\|幕\|板\|场景\|布\|底色`）—— 逐条核对 44 条真实 §3 角色列实测：① 12 词 ⇒ **8 条误报**（`silkscreen-poster`〔`dub 通路派生`〕、`ascii-crt`〔`产品通路（dub）`〕、`brick-toy`〔`主`〕、`cel-anime-80s`〔`夜景主色`〕、`living-screencast`〔`产品浅主题·墨`〕、`paper-lantern`〔`房间黑`〕、`pictogram-motion`〔`米白 CREAM`〕、`swiss-motion`〔`页`〕）；② 再补可辩护词 `通路\|派生\|夜\|房间\|页` ⇒ 降到 **3 条误报**；③ 把剩下的 `主`/`米白`/`产品\|主题\|墨` 也塞进白名单 ⇒ 真实 0 误报，但 `hd-2d` 真阳性夹具（`#fff0c8`，命中行 `主（暖实体光）`）**同时被放行** ⇒ 拆掉闸门立身之本；④ 改「白名单 ∧ ¬黑名单」⇒ 真实 0 误报、`hd-2d` 仍被抓，但白名单必须常驻 `主/米白/产品/主题/墨` 这类**无背景语义**的词 ⇒ 已不是正向白名单，对上面的绕过构造**一点也拦不住**。**结论**：§3 角色列不是受控词表（同列混着角色名〔底/纸/幕〕、纯色名〔米白/主/墨〕、通路名〔dub 通路派生〕）⇒ 按 role 用词的白名单做不到「排除光/强调行」且「保住 44 条合法行」，按项目纪律「判据不成立时宁可只报不改」**保留黑名单**；本闸门只保证「底色的**角色归属**不是灯/光/强调一类」，**不保证**角色名与底色内容相符。② **`docRecorded` 粗判据 ⇒ 2026-10-06 已根治**：旧判据（§11 同时出现 `dub-styles.json\|dub-visual.json\|dub 通路` 与 `palette\|底色\|配色` 即算「已记录」）会把「§11 记的其实是**另一条**冲突」的风格误判成 backlog —— 真事故 `shadow-puppet`：其 §11 记的是 `textureRaw: backlit-leather` 未实现、自评行写着「palette −1」、另有一条「dub 通路的字幕位置…」⇒ 两个正则都命中。现要求 §11 **指向本条**：出现该风格的 `palette.bg` 值（带 `#`、大小写不敏感、不匹配更长 hex 前缀）**或**明确写「底色」。★ 不用题给备选的 `§3`（§11 里的 `§3` 常在说**别的角色**：`engraving` §11 就用它解释 `accent` 的代理值）、也不用 `背景`（多是「背景带渐变 / 背景 sweep」这类风格描述）。**验证（原始输出见报告）**：真实 44 条 **0 未记录 / 0 积压 / exit 0**；`shadow-puppet` 夹具（`bg #2a2a2e` + 真实 SKILL.md）改前 **backlog/exit 0** ⇒ 改后 **fresh/exit 1**；`hd-2d` 最小夹具（只留 §3、`bg #fff0c8`）**fresh/exit 1**；`stained-glass` 夹具（真实 SKILL.md、`bg #2a2a2e` + `stops [#2a2a2e,#142a70]`）**判可疑**（真实 §11 确实记了本条 ⇒ 归 backlog、`--all` 下 exit 1）；以上各夹具在**改前规则**（`6892c75`，集合包含）下均 **exit 0**；失明夹具 **exit 1 + 「本闸门已失明」且无 ✓**。★ `shadow-puppet` 的真实底色 `#f4ead2`〔`demo/carve.js:7` `DYE.white`、`styles/shadow-puppet/STYLE.md:8`「a white cloth screen」〕已在同批补进 §3 行。 ★ **2026-10-06 追加：`LEMO_DUB_STYLES` 已接通渲染链路** —— 此前它**只有 4 个闸门读**（本闸门 / `check-config-notes` / `check-dna-coverage` / `check-skill-scores`），而 `lib/dub-core.mjs` 的 `STYLES_FILE` 与 `lib/dub-semantic.mjs` 的 `STYLES_PATH` 都是**硬编码路径** ⇒ **闸门侧与渲染侧同名不同义**（拿它做「配置项是否影响成片」的变异验证会得到**假阴性**：配置明明不同、成片却是同一份）。现两处均改为 `process.env.LEMO_DUB_STYLES || <原硬编码值>`，与 `LEMO_LIB_WIN` / `LEMO_MUX_SH` / `LEMO_OPUSCAR` / `LEMO_DISTILL_ROOT` 等既有覆盖点**同一语义**（`LEMO_*` 一律**真的影响渲染**）。★ **不设变量时行为不变**：实测 `resolveStyle('stained-glass')` 默认取真实值 `#1d3a9c`、设变量后取夹具值 `#2a2a2e`，渲帧主色随之由钴蓝变为改前态的中性深灰。★★ **2026-10-06 第三次收紧（修「已修记录的回归盲区」）**：本仓约定「修好的缺陷 = **原文保留 + 追加更正**」（原文被 `~~…~~` 划掉、后跟 `★ … 已修：…`）⇒ 一条**已修**记录里必然同时写着**旧值**，于是 `docRecorded` 只要在 §11 里搜到那个旧 hex 就判 backlog —— **把配置回退成旧值（真回归）也照样 exit 0**。实证：`stained-glass` §11 的 `~~派生通路的底色是深灰 #2a2a2e…~~ ★ 2026-10-06 已修：原 palette.bg = #2a2a2e … 由 #2a2a2e 改为 #1d3a9c`。判据改为**先剔除「已修」更正单位、再判是否指向本条**，`stripFixed()` 三条机械规则：① 去掉 `~~…~~` 划掉的 span（跨行）；② 反复去掉**最内层圆括号组**（`[^（()）]*` 保证不跨层）——只要组内含 `已修`；③ 逐行删掉**含 `已修` 的 `★` 子句**（`★` → 下一个 `★` 或行尾）。★ 边界为何是「括号组 + ★ 子句」而**不是整行/整条 bullet**：`stained-glass` §11 的「自检发现的缺陷」一行里同时记着 `palette`（已修）与 `typography`/`audio`（**未结**）⇒ 按行删会**漏报未结记录**；②也是被迫的 —— 同风格蒸馏证据表的 `（2026-10-06 校正：原 95，dub 通路底色冲突已修 —— palette.bg #2a2a2e→#1d3a9c…）` 没有 `★`，且「自检」那条的 hex 在 `★` **之前**，只做 ③ 删不掉。★ **连带收紧 `pointsToThis`**：泛词 `底色` ⇒ `底色冲突`（被迫）：剔除已修单位后 `stained-glass` §11 仍剩 `- **派生条目是近似值**：… 字幕颜色由 WCAG 对比度规则从底色推得 …` —— 它含 `dub-visual.json` + `palette`/`配色` + `底色`，但**根本没在记冲突**，只要还认泛词 `底色` 就会把上面那次收紧**整个抵消**。★ **验证**：真实 44 条 **0 未记录 / 0 积压 / exit 0**（连跑 3 遍）；**回归夹具**（`stained-glass` 真实 SKILL.md + `palette.bg` 回退 `#2a2a2e`）改后 **fresh / exit 1**、改前 HEAD **backlog / exit 0**；**非回归对照**（同夹具、`bg #1d3a9c`）**exit 0**；**三个正对照**（把那条已修标记改成「本条未修」/把 §11 的 `已修` 全去掉/只写「底色冲突」不给 hex，配同一回退夹具）**均 backlog / exit 0** ⇒ 剔除**以「已修」为条件**、不是无脑删；`shadow-puppet` 夹具（`bg #2a2a2e`）仍 **fresh / exit 1**；失明 **exit 1 且无 ✓**。★★ **存疑（已上报，不改）**：这次收紧会让 `hd-2d` 夹具（真实 SKILL.md + `palette.bg` 回退 `#fff0c8`）由 **backlog / exit 0** 翻成 **fresh / exit 1** —— 因为它的 §11 对这条冲突的**每一处**提及都带「已修」（§11 的 `~~…~~ ★ 2026-10-05 已修`、「最高可达分与原因」的 `★ 2026-10-05：… 已修`、蒸馏证据表的 `（2026-10-05 校正：dub 通路底色冲突已修…）`）。**这不是误报**：文档写着「已修」而配置又回到旧值，正是回归。★ 若某次验收要求「`hd-2d` 仍归 backlog」，那是**期望与判据冲突、两者不可能同时成立**：`stained-glass` 蒸馏证据表的 `（2026-10-06 校正：… dub 通路底色冲突已修 …）` 与 `hd-2d` 蒸馏证据表的 `（2026-10-05 校正：dub 通路底色冲突已修 …）` 是**逐字同型**的两行 —— 要 `stained-glass` 翻 fresh 就必须剔除它，要 `hd-2d` 留在 backlog 就必须保留它。 | 秒级 |
| `scripts/check-derivation-caliber.mjs` | **「派生口径」的机器可读 + 闸门**（`lib/dub-styles.json` 每条 entry 的 `derivation` 口径块 ↔ 本条字段 ↔ 该风格自己的 `SKILL.md`）。★ 由来：本注册表是「文案+风格」通路的**唯一可渲染消费入口**，但它的配色/字体**多数不是逐行真抽** —— 43 个真实风格的字幕字体一律是本机字体（`_notes[5]`，STYLE.md 点名的 OFL 字体本机都没有）、32 条派生条目的配色取自证据层 `lib/dub-visual.json`、字幕字号/颜色走「分类别默认 + WCAG」（`_notes[11]`）、3 条底色**落回 plain-dark**（`bgSameAsDefault:true`，`_notes[13]`）、若干条 accent 按 `_notes[10]②` 的「`accent/bg` 一律提到 ≥4.5」被换过。这些口径此前**只写在散文里**（顶层 `_notes` + 每条 `notes`）⇒ 下游**读不出**「哪个值是原文值、哪个是要替换的近似值」，配置漂移也**没人拦得住**。现给每条加 `derivation: {bg, font, subtitle, accent}`（**纯元数据、只增不改**，渲染侧一个字都不读它），判据写在 `_notes[19–23]`。★ **键名为什么是 `derivation`**：与既有的 `derived` / `derivedFrom` / `bgSameAsDefault` **同类并列、自解释**。★ **它必须登记进 `scripts/check-dna-coverage.mjs` 的 `DUB_METADATA` 白名单**（本次已加一条，逐字写明「为什么算元数据」并点明它是本闸门的输入）—— 那个闸门第二节会枚举注册表**全部字段路径**（顶层键 + 每风格键 + 二级 + 三级），凡「全仓零读取 ∧ 不在白名单里」的路径**一律 FAIL**（实测不登记就是 `✘ derivation：44/44 个风格声明了它，但全仓零读取`，EXIT=1）。**白名单就是该闸门为「新元数据字段」预留的人工入口**（其头注释原话「**改的是清单，不是判据**」）⇒ 新增一个元数据字段 = **加一行登记，不改任何判据/阈值、也不动白名单里已有条目**。★ 曾短暂改用 `_notes` 承载（不登记也能过），**已否决**：顶层 `_notes` 是**字符串数组**、条目里若也叫 `_notes` 就是**对象**，属「同名不同层/不同型」的 schema 债务 —— 本项目刚为同型问题吃过亏（`LEMO_DUB_STYLES` 闸门侧与渲染侧同名不同义 ⇒ 变异验证出**假阴性**），不值得为省一行登记去背。★ **判据（① 合法 / ② 不自相矛盾 / ③ 文档守门）**：① 四个轴齐全、取值在枚举内；② **把四个轴按 `_notes[20]` 的规则重算一遍、与写着的值逐轴比对，不等即 FAIL**（`bg=fallback ⟺ bgSameAsDefault:true 或 palette.bg 为空`；`bg/accent = proxy/substituted ⟺ 与 `dub-visual` 的对应值不等（含证据层没抽到）`；`font=substituted ⟺ fontFamily 在本机字体表里且非合成基线`；`subtitle=derived ⟺ derived:true 且 notes 含 WCAG`；`accent=absent ⟺ palette.accent 为空`）；③ `fallback/proxy/substituted/derived` 的条目，其 `lib/style-skills/<slug>/SKILL.md` 里**必须有对应口径说明**（缺则 FAIL 并点名该补哪份文档）。★ 口径分布（2026-10-06 首版）：`bg` exact 37 / proxy 4（silkscreen-poster、risograph、blueprint、microgame）/ fallback 3（hologram-hud、backrooms、living-screencast）；`font` exact 1 / substituted 43；`subtitle` exact 13 / derived 31；`accent` exact 32 / substituted 7 / absent 5。★ **`accent` 多一个 `absent` 取值**（题给形状只有 exact/substituted）：`palette.accent` 为 null 时既非 exact 也非 substituted，必须能机器区分，否则「没有强调色」会被读成「强调色是原文值」。★ **为什么 `bg`/`accent` 用「与 dub-visual 不等」**：`dub-visual.json` 是证据层（`_notes[8]`），不等就说明这个色不是从 demo 代码逐字来的 —— 或来自 STYLE.md 示例色板、或从 `bg2` 提升、或按可见性规则调过；**有独立佐证**：那 7 条被换过的 accent，其 `accent/bg` 对比度**全部落在 5.02–5.26**（规则目标 ≥4.5），而 demo 原值是 1.35–3.84。★ **失明守卫**：注册表读不到 / `styles` 不是非空数组 / **证据层读不到或 `styles` 不是非空对象** / 一个 `SKILL.md` 都读不到 / `_notes` 里不再列全本机字体表 ⇒ **FAIL 并明说「本闸门已失明」**且**不打**分布统计与「✓」。★ 覆盖点 **`LEMO_DUB_STYLES`**（与 `check-config-notes` / `check-config-vs-doc` / `check-dna-coverage` 同名同义）+ **`LEMO_DISTILL_ROOT`**（与 `check-config-vs-doc` / `check-skill-scores` 同名同义）+ **`LEMO_DUB_VISUAL`**（本闸门新增）。★ 验证（临时副本 + 覆盖点，不动真实数据）：真实 44 条 **exit 0**；真阳性夹具（`engraving.derivation.bg` 改成 `fallback`，与其字段矛盾）**exit 1 且给出机械推导原因**；真阳性夹具（抽掉 `art-deco/SKILL.md` 里的 `DengXian`）**exit 1 + 「请在该文档补一句」**；失明三态（`styles:[]` / 路径不存在 / 风格根指空目录 / 证据层空）**均 exit 1 + 「本闸门已失明」** | 秒级 |
| `scripts/check-doc-coverage.mjs` | **文档完整性闸门**：`scripts/` 下每个 `check-*.mjs` 必须在 `test/README.md` 与 `_distill/AGENT-BRIEF.md` **两处**都登记；工具类（`sync-/patch-/normalize-/refresh-/fix-/measure-*`）至少登记一处。★ 由来：`AGENT-BRIEF.md` 是**长期循环的作业手册**，一度只提到 **3** 个脚本（实际 24 个）⇒ 照它跑的产出**通不过新闸门**，而这类「工具加了文档没跟」是静默的。★ **失明守卫（2026-10-06 补）**：`scripts/` 或 `test/` 任一扫到 **0 个** ⇒ **FAIL 并明说「本闸门已失明」**（旧版此处打印「都已在文档里登记」—— **静默假绿**）。★★ **2026-10-06 收紧「登记」判据：由纯子串改为行锚定（修一个已确认的假绿）** —— 旧判据 `t.includes(f)` 只要求脚本名在整份文档里**出现过** ⇒ **行被并掉、格式被破坏它都看不见**（实测：`_distill/AGENT-BRIEF.md` 有 `check-render-venc.mjs` 的超长说明**直接粘着** `node …/patch-render-venc.mjs`、**没有换行**，`patch-render-venc.mjs` 那行被吞掉，闸门照报 `exit 0`）—— 即本项目反复治过的「匹配判据可被无关代码满足」那一类。现要求「**存在一行**按该文档的登记格式写下这个脚本」（脚本名**正则转义**，含 `.`）：`_distill/AGENT-BRIEF.md` 用**命令行 / 行内代码**形态 `^[ \t`\-]*node\s+(\S*[\/\\])?scripts[\/\\]<name>`（实测三种合法形态全接受：代码块 `node D:/…/scripts/x.mjs`、bullet `` - `node scripts/x.mjs` ``、行首行内码 `` `node D:/…/scripts/x.mjs` ``）；`test/README.md` 用**检查器表**形态 `^\|\s*`(scripts|test)[\/\\]<name>``。★ **误报率（先测再定稿）**：真实语料 43 个 .mjs（闸门 28 / 工具 11）**改前改后结论一致 = 0 未登记**；收窄途中确实误伤过 1 个合法形态（`check-plate-pixel.mjs` 只以 bullet + 行内码登记）⇒ 按「锚点可放宽、绝不退回裸子串」把锚点放宽后 **0 误报**。★ **验证（临时树 + `LEMO_TOOLS_ROOT`，绝不动真实文档）**：夹具 A「两行并成一行」（并掉 **gate** `check-venc-args.mjs` 的登记行）⇒ 新判据 **exit 1 并点名「当前只在：test/README.md」**、改前 HEAD **exit 0**；夹具 B「脚本名只出现在句子中间」⇒ 新 **exit 1 点名**、旧 **exit 0**；夹具 A1（并掉 **tool** 行、即本次修的那处）新 **exit 0**（工具只需一处、它在 `test/README.md` 有登记 ⇒ 该形态不翻退出码，只修正 `where` 报告）。★ **失明守卫**：`scripts/` 或 `test/` 任一扫到 **0 个** ⇒ **FAIL 并明说「本闸门已失明」**；夹具 C（根指空目录）实测 **exit 1 + 「本闸门已失明」**。★★ **2026-10-06 同型残留一并收紧（测试入口侧）**：`test/*.test.mjs` 的「已登记」判据原为裸子串 `readme.includes(f)`（测试入口行被并掉时同样看不见），现改为**行锚定** —— 接受 `^node\s+(\S*[\/\\])?test[\/\\]<name>`（命令行块）与 ``^\|\s*`test[\/\\]<name>``` （表行）两种形态；★ 测试入口侧**没有**「工具类只需一处」的豁免（只查 `test/README.md`）⇒ 并成一行**必然**翻退出码。**误报率**：16 个入口改前改后均 **0 未登记**（实测 16/16 都命中①命令行块形态）。**夹具**：「并成一行」/「名字只在句中」新判据 **exit 1 点名 `setup-api.test.mjs`**、改前 HEAD **exit 0**。★ **失明守卫：已覆盖、无需改** —— `blind[]` 早已含 `testEntries.length === 0`（`test/` 扫到 0 个 `*.test.mjs` ⇒ FAIL + 「本闸门已失明」），且 `✓ N 个测试入口都已登记` 那行由 `else if (testEntries.length)` 守住 ⇒ **0 个时不会打印假 ✓**；夹具 F（README 在、0 个入口）实测 **exit 1 + 「本闸门已失明」**。覆盖点 **`LEMO_TOOLS_ROOT`**（lemo-tools 仓库根）★★ **2026-10-07 修「失明守卫口径不一致」**：主循环只检查 `isGate(f) || isTool(f)`（`check-*` 与 `sync-/patch-/normalize-/refresh-/fix-/measure-/prune-*`），但失明守卫用的是**未过滤**的全集 `files.length === 0` ⇒ 若 `scripts/` 下还有「其他类」脚本（`style-distill.mjs` 等）却**过滤集为 0**（命名约定改了），`missing=[]` + `blind=[]` ⇒ 打印「✓ 所有闸门类与工具类脚本都已在文档里登记」+ **exit 0**（**一个都没检查**）。★ 同文件 test 侧（测试入口）本来就是按**过滤集**守卫的，两侧口径不一致本身就是缺陷。现改为按 `files.filter(isGate || isTool)` 的**实际检查集**守卫。**实测（夹具 `LEMO_TOOLS_ROOT` 指向只含一个非闸门非工具的 `foo.mjs` 的假仓库根）**：改前 exit 0 + `✓` ⇒ 改后 exit 1 + 「本闸门已失明」；真实语料改前改后**完全一致**（`未登记脚本 0 个、未登记测试入口 0 个 OK`，exit 0；30 闸门 / 11 工具 / 4 其他） | 秒级 |
| `scripts/check-dna-coverage.mjs` | **风格注册表的字段消费覆盖**（三节）。**第一节 `lib/style-dna/`**：区分「被消费（真的改了输出）/ 只被打印 / 完全没人读」三态。★ 实测 43×15 字段里**只有 3 条链路真的改输出**（字幕折行容量、响度目标、颗粒），约 80% 零消费者。闸门只保护「**原本被消费的字段不许悄悄断掉**」（回归），未消费的列为 backlog 供人工决定要不要接线。**第二节 `lib/dub-styles.json`**（★ 2026-10-05 扩展）：对注册表里**每条字段路径**（`bgRecipe.textureRaw` / `palette.accent` …）判 —— 在 `DUB_METADATA` 元数据白名单里 ⇒ 放行；在 `DUB_UNIMPLEMENTED` 未实现清单里 ⇒ 放行但高亮；否则**有消费者**（运行时代码 grep 到读取点）⇒ 放行；否则 **FAIL**（报字段路径 + 涉及风格数 + 修法）。★ 由来：`bgRecipe.textureRaw` 被 **44/44** 个风格声明却**全仓零读取**，**27 个闸门全绿**下靠**人工只读审计**才发现 ⇒ 立此判据。★ **先测误报率**：加白名单前原始判据命中 **7** 条，逐条人工分类后 **元数据 7 / 真缺口 0** ⇒ **没有白名单时该判据误报 7/7**，白名单就是判据的一半（`visualRef`/`hasVisual`/`synthetic`/`derived`/`derivedFrom`/`bgSameAsDefault`/`version`/`_notes`，2026-10-06 又补 `derivation` + 其四个子键 ⇒ 现 **13** 条）。★★ **2026-10-06 收紧：嵌套路径的消费者判据必须感知路径上下文（顶层键判据不动）** —— 由来：`derivation` 是**纯元数据对象**（`bg`/`font`/`subtitle`/`accent` 四轴，由 `check-derivation-caliber.mjs` 独占消费，**渲染侧一个字都不读**），但它的四条子路径**全靠叶名碰撞**被判「有消费者」⇒ **四条全是假绿**：`derivation.bg` ← `dub.mjs`/`lib/dub-core.mjs` 里**别的对象**的 `.bg`（`palette.bg` 等）；`derivation.font` ← **单点** `server.mjs:136` 的 `'.woff2': 'font/woff2'`（**MIME 串**，与派生口径毫无关系）；`derivation.subtitle` ← `dub.mjs`/`lib/dub-core.mjs`/`lib/dub-semantic.mjs`/`lib/triple-check.mjs`；`derivation.accent` ← `lib/briefs.mjs`/`lib/dub-core.mjs`。叶名（`bg`/`font`/`subtitle`/`accent`）是**高频通用词**，全仓任意位置命中一次就算「有消费者」——`derivation.font` 尤其脆：唯一依据是那个 MIME 串，`server.mjs` 哪天不写 `font/woff2` 它就翻 FAIL，**判据结论取决于无关代码**。**新判据**：顶层键（路径不含 `.`）**不变**；嵌套路径（含 `.`）要求叶名命中的那个文件**还必须出现父键**（倒数第二段：`derivation.bg` 的父键是 `derivation`、`bgRecipe.halftone.angle` 的父键是 `halftone`），且父键必须是**代码 token**（已剥注释 ⇒ 只在注释里提父键不算）。**邻域为什么取「同文件」而不是「同行 / ±N 行」**（先测误报率再定判据）：真实消费者的**父对象常被别名掉** —— `lib/dub-core.mjs:465` `const r = spec.bgRecipe || {}` 之后才 `:447` `r.halftone`（隔 18 行）；`subtitle` 的消费者写作 `sub.plateColor`（`:324`）/ `sp.plateColor`（`:825`），**从不写** `subtitle.plateColor`。实测四种邻域的误报（把**真实有消费者**的字段判成无消费者）：**同行 → 8 条**（`bgRecipe.halftone`、`bgRecipe.textureRaw`、`subtitle.plateColor`、`bgRecipe.halftone.{angle,color,field,k,step}`）、**±5 行 → 4 条**、**同文件 → 0 条**，且同文件恰好杀掉 `derivation.*` 四条假绿（该父键在 28 个运行时代码文件里**零出现**）⇒「同文件」是能杀掉这一类假绿、又零误伤的最小邻域。**误报率实测（真实注册表 67 条字段路径）**：收紧后判定变化**恰好 4 条**（全部是 `derivation.*`：有消费者 → 无消费者），**其余 63 条一字不变**（含 44 条嵌套路径里的 40 条）；这 4 条随即按「**父键已声明为元数据 ⇒ 子键自然也非渲染字段**」登记进 `DUB_METADATA`（**只加行，不改任何既有条目/阈值/判据逻辑**）⇒ 定稿后 **FAIL 0 / 误报 0**。★ **未采纳的替代方案（只报告、未动）**：写成「父键在 `DUB_METADATA` 里 ⇒ 其子路径自动放行」，好处是 `derivation` 将来加第 5 个轴不用再补一行；代价是白名单从「**字段**清单」变成「**字段 + 前缀**清单」、颗粒度变粗。★ **验证**：真阳性夹具（真实注册表 + 给每个风格的 `palette` 注入假字段 `font`：叶名 `font` 全仓只在 `server.mjs` 的 MIME 串出现、而该文件无 `palette`）**改后 exit 1 并点名 `palette.font`**、**改前 HEAD exit 0（假绿）**；同型夹具 `derivation.plateColor`（叶名只在 `lib/dub-core.mjs` 的 `sp.plateColor`、该文件无 `derivation`）**改后 exit 1 / 改前 exit 0**；真阴性：真实注册表 **exit 0 且「第二节 字段覆盖失败 0 条」**；失明三态（空文件 / 坏 JSON / `styles:[]`）仍 **exit 1 + 「本闸门已失明」**。★ **顺序是先查清单、再查消费者**（与常见写法相反）：消费者判据是**叶名匹配**，`version` 会被 `lemo-make.mjs` 的 `process.version` 这类**同名碰撞**误判成「有消费者」。★ 两处实测坑：① **必须剥注释** —— `textureRaw` 在 `dub-core.mjs` 里**只出现在注释**（正是那段「全仓没有任何代码读它」的解释）⇒ 不剥就把**解释缺陷的注释**当成消费者；② **必须排除 `scripts/`** —— 闸门自己的清单里就写着 `bgRecipe.textureRaw` 字符串 ⇒ 不排除会**读到自己**、永不报警（`test/`、`_distill/`、`lib/style-skills/` 同理）。★ **顺序是先查清单、再查消费者**（与常见写法相反）：消费者判据是**叶名匹配**，`version` 会被 `lemo-make.mjs` 的 `process.version` 这类**同名碰撞**误判成「有消费者」。★ **失明守卫**：注册表读不到 / 解析失败 / 枚举到 0 条字段路径 ⇒ FAIL 并明说「本闸门已失明」。★ 变异验证（临时副本 + `LEMO_DUB_STYLES`，不动真实数据）：①注入 `bgRecipe.__probeUnused` ⇒ FAIL 并点名；②临时移除 `visualRef` 白名单 ⇒ 报出 `visualRef`；③路径不存在 / `styles:[]` ⇒ 报「已失明」。**第三节 `lib/dub-styles.json` 的 `bgRecipe.textureRaw` 的「取值级」实现状态**（★ 2026-10-05 扩展；就是第二节原先登记的「已知边界」——「判据是字段级，**不判取值实现了几成**」）：判据**不需要改 schema** —— 渲染侧有一个**权威的「可解析名字集合」R**，从 `lib/dub-core.mjs` **源码抽**出来（不手抄，源码一改判据自动跟）：`R = bgFilters() 里 switch (tex) 的 case 标签 ∪ TEXTURE_SYNONYMS 的键 ∪ TEXTURE_RAW_FALLBACK 的键 ∪ {none}`（同义/回退键只在其归一化目标**确实是某个 case 标签**时才计入；`none` 必须显式计入 —— 它是「不叠纹理」的正确实现，否则 5 个声明 `none` 的风格会被误判）。⇒ **「某风格声明的 `textureRaw` 是否被实现」= 「它是否落在 R 里」**。判据**双向**：**(A) 声明但未标**（值 ∉ R 而散文清单没登记 ⇒ FAIL）、**(B) 标了但已实现**（值 ∈ R 而散文清单仍列着 ⇒ FAIL）；另加 4 条防清单腐烂（清单里的名字已无人声明 / 豁免表过期 / 豁免表无人声明 / 同名同时在清单与豁免表）+ **slug 级**核对（散文逐名带了受影响 slug，某风格声明了该值却没被列进去 ⇒ FAIL，否则「新增一个风格用了 `cel`」看不见）。★ **误报率（先测再定判据）**：原始判据（只看 R）**首跑命中 2 名** —— `vignette`（art-deco）、`paper-grain`（paper-lantern），逐条人工分类 **真不一致 0 / 误报 2（100%）**：这两名渲染侧**确实有归宿**，只是归宿**不是纹理名**（`vignette` 由 `bgRecipe.vignette` 的 `if (vig > 0.001)` 分支画成暗角；`paper-grain` 与粗粒度 `texture: paper` 的 `noise=alls=9:allf=t+u` 同物）⇒ 加**豁免表** `TEXTURE_COVERED_BY_OTHER`（本判据唯一的人工判断入口，与 `DUB_METADATA` 同性质）⇒ 命中 **0** / 误报 **0**。★★ **关键推论：「可解析集合 R」≠「已实现集合」** —— 实测 31 个声明取值 = 落在 R 里 **11** + 声明但未实现 **18** + 豁免 **2**（**不能**拿 R 当已实现全集，那样会误报 2 条）。★ **失明守卫**（本判据依赖**解析源码**，源码一改就可能悄悄抽不到 ⇒ 尤其重要）：`dub-core.mjs` 读不到 / 抽不到两张 `Object.freeze` 表 / 找不到 `export function bgFilters(` 或其 `switch (tex) {`（被删、改名、括号不配对）/ 抽到的 R 为空 / 注册表读不到或 `styles[]` 为空或 0 风格声明 `textureRaw` / **散文里找不到「★ textureRaw 声明但未实现」条目**（找不到就分不清「清单为空」与「散文被重构」）⇒ 一律 **FAIL 并明说「本闸门已失明」**。★ 变异验证（**临时副本 + 覆盖点**，不动真实文件）：①`LEMO_DUB_STYLES` 指向把 `plain-dark.textureRaw` 改成 `foil-stamp` 的副本（散文不动）⇒ FAIL 点名 `foil-stamp` + `plain-dark`；②`cel-anime-80s.textureRaw` 改成已实现名 `paper`（散文仍列 `cel`）⇒ FAIL 报「清单腐烂 / 清单写错」；②b `LEMO_DUB_CORE` 指向**给 `cel` 加了 case 的副本**（=真实现了）⇒ FAIL 报 **(B) 标了但已实现** 并给出出处行号；③`LEMO_DUB_CORE` 指向**删掉 `switch (tex)` 整块**的副本 ⇒ FAIL 报「已失明」；③' `LEMO_DUB_STYLES` 指向 `styles:[]` ⇒ FAIL 报「已失明」；④撤掉覆盖点 ⇒ 复绿 exit 0。覆盖点：**`LEMO_DUB_CORE`**（新增，`dub-core.mjs` 路径）+ 复用第二节的 `LEMO_DUB_STYLES`。★ 已知边界：R 由**正则/状态机**从源码抽（不是 AST）⇒ 若 `bgFilters()` 被大改（换 switch 变量名、case 标签改成变量），本闸门会**判失明而不是静默漏判** | 秒级 |
| `scripts/check-mux-selection.mjs` | **交付路径感知**的混流脚本闸门。★ 关键发现：编排器选混流脚本的规则是「`demo/tools/mux.sh` → `demo/mux.sh`，**只有含 `A="$2"`（标准 `V A O [fps] [grain]` 接口）才采用**，否则回退 `core/render/mux.sh`」⇒ **脚本存在 ≠ 会被采用**。实测 43 个风格里**只有 9 个走自带 mux**，另 3 个（`paper-popup`/`pictogram-motion`/`watercolor`）**只用于手工构建**。闸门只对**被挑中的**脚本校验四项口径（LN_TP 可覆盖 / 真峰值复核 / `exit 0` / 无「续行被注释吃掉」），并**识别「委托 core」**（如 `woodcut` 调 `core/render/mux.sh` 后二次编码 ⇒ 继承口径，不必自带）。★ **失明守卫（2026-10-06 补）**：`styles/` 读不到 / 扫到 **0 个风格** ⇒ **FAIL 并明说「本闸门已失明」**（旧版此处打印「都满足四项口径要求」—— **静默假绿**）。覆盖点 **`LEMO_OPUSCAR`**（与 `check-esm-import-paths` / `check-render-venc` 同名同义） | 秒级 |
| `scripts/check-mux-parity.mjs` | **各风格自带 `demo/mux.sh` ↔ `core/render/mux.sh` 的口径 parity 闸门**。★ 由来：混流脚本的音频收尾口径在**两处各写一份** —— `core/render/mux.sh`（**走 core 的 34 个风格共用**）与**个别风格自带的** `styles/<slug>/demo/mux.sh`（实测**只有 3 个**：`paper-popup`/`watercolor`/`pictogram-motion`），而**没有任何闸门在比这两份副本** ⇒ 口径漂移是**静默**的。判据（逐项与 core 比）：① `LN_TP` 默认值（−1.7）② `LN_TP_STEP`（0.25）/ `LN_TP_TRIES`（8）③ **编码后复核 + 逐档下调重编**闭环结构（`TP_TRY`/`ATTEMPT` 循环 + 与 −1.2 的比较）④ **编码器守卫**（未设 `LEMO_VENC` ⇒ `h264_nvenc`；显式 `libx264` ⇒ CPU；其它值 ⇒ **报错退出** —— 用户最高优先级硬规则「渲染一律 GPU」的落地判据）⑤ 未设时**不得**静默走 CPU ⑥ 两遍 loudnorm 的 `loudnorm=I=-14` 在。★★ **两层语义**（本闸门能「当前树 exit 0」而将来新漂移会红的关键）：**已在清单里记录的积压 ⇒ 只列不判 FAIL；没记录的才 FAIL** —— 清单 `KNOWN_DIVERGENCES` 逐条写明「为什么允许存在 / 待办是什么」（同 `check-dna-coverage` 的 `DUB_METADATA`/`DUB_UNIMPLEMENTED`、`check-render-venc` 的 B 类 backlog）；当前只登记 1 条：`pictogram-motion` 的 `demo/mux.sh` 属**另一套音频架构**的手工入口（`music/music.py` 直出母带、**无 `mix.wav` 概念**，故 mux 阶段不做 loudnorm ⇒ 无 `LN_TP`/无闭环；依据 `lib/style-skills/pictogram-motion/SKILL.md:173`）⇒ 5 项分叉登记为积压。★ 另有一条 **core 自身漂移**判据：core 的 ①② 不等于 `CORE_EXPECT` ⇒ **FAIL** —— 因为它是 34 个风格共用的那一份，一变**全体跟随**（实证：`paper-lantern` 无自带 mux ⇒ 永远走 core ⇒ core 默认值 2026-10-03 收紧到 −3.5 / 10-05 改回「−1.7 起步 + 闭环」，它那版成片真峰值就在 −1.68 与 −3.37 dBTP 之间摆，见 `lib/style-skills/paper-lantern/SKILL.md:112`）。★ **失明守卫**：`core/render/mux.sh` 读不到 / `styles/` 读不到 / 扫到 0 个风格目录 / **一个自带 `demo/mux.sh` 的风格都枚举不到** ⇒ **FAIL 并明说「本闸门已失明」**（防「0 对象却全绿」）。★ **范围**：**只查 `styles/*/demo/mux.sh`**（3 个）；`styles/*/demo/tools/mux.sh`（9 个，其中 8 个自带同型闭环、`woodcut` 委托 core）**不在本闸门范围**（由 `check-mux-selection` 守四项口径）—— 输出里显式打出范围，免得那句 ✓ 被读成「所有混流脚本都对齐了」。★ **变异验证**（`LEMO_OPUSCAR` 指向 `D:/lemo-tmp/b84-c/` 下的极小夹具树，**全程不动真库**；8/8 PASS）：真阴性（真实树）**exit 0**；真阳性（`paper-popup` 的 `LN_TP` → `-2.5`）**exit 1 且点名**；core 自身漂移（core 与两份自带一起改成 −2.5）**exit 1 并单独报 core 那条**；编码器守卫被拆（未设支改成 CPU）**exit 1 / `VENC_GUARD`**；失明三态（空树 / 无 core / 无自带 mux.sh）**exit 1 + 「本闸门已失明」**；★ **反向证明**：把 `KNOWN_DIVERGENCES` 清空 ⇒ `pictogram-motion` 从 ⚠ 积压翻成 **exit 1 / 未登记分叉 5 项**（证明那条清单**承重**、不是摆设）。★ 只读（不写库、不跑 ffmpeg） | 秒级 |
| `scripts/check-mix-candidates.mjs` | 混音文件的**遮蔽隐患**闸门（同一条「存在 ≠ 会被采用」教训的推广）。编排器取混音是**按候选顺序取第一个存在的**：`demo/mix.wav` → `demo/audio/mix.wav` → `demo/out/mix.wav` ⇒ 靠前位置留着旧的/占位的 `mix.wav` 就会**遮蔽**靠后那份真混音。★ 项目**真实发生过**：`paper-lantern` 首版被一份位于 `demo/mix.wav` 的**旧静音占位**（23.5 MB，非空）遮住了真正的 `demo/out/mix.wav` ⇒ 成片成了数字静音。判据：多候选必须**逐字节相同**（md5），且被挑中的不能是静音（`mean_volume` ≤ −70 dB）。★ **失明守卫（2026-10-06 补）**：`styles/` 读不到 / 扫到 **0 个风格** ⇒ **FAIL 并明说「本闸门已失明」**（旧版此处打印「所有多候选的混音都逐字节相同」—— **静默假绿**）。★★ **失明守卫 ②（2026-10-07 补，修「一个都没检查却全绿」）**：主循环 `:75` 的 `if (!present.length) { none.push(slug); continue; }` 把「无候选」风格**移出检查集** ⇒ 若**全部**风格都无候选（`multi.length=0 / fails=[] / blind=[]`）⇒ 旧版打印「✓ 所有多候选的混音都逐字节相同，且被挑中的不是静音。」+ **exit 0**（**一个候选混音都没检查过**，既没比 md5、也没测静音）。现判据 **无候选数 == 风格总数 ⇒ FAIL 并明说「一个都没判」**（写法照 `check-skill-artifacts` 的「全部 SKIP」/ `check-dub-styles.mjs:214`）。★ **部分无候选不判 FAIL**（「无候选」是**设计允许**态：见判据 ③，只意味着要重跑音频链；真实语料实测 43 风格里 **35 个**无候选、8 个有候选 ⇒ 部分无候选是**常态**、误报率**无样本可测** ⇒ 设阈值 = 凭猜收窄），但会打一行 `ℹ 一个候选都没有的 N 个`。★ 反向验证（`LEMO_STYLES_ROOT` 夹具，非破坏）：全部无候选 **改前 exit 0 + 「✓ 所有多候选…」／改后 exit 1 + 「一个都没判」**、全部有候选 **仍 exit 0**、部分无候选（1/3）**exit 0 + ℹ**；真实树 **逐字节不变**。覆盖点 **`LEMO_STYLES_ROOT`**（与 `check-aspect-declaration` / `check-dub-styles` 同名同义） | ~10 秒 |
| `scripts/check-cli-docs.mjs` | **命令行参数**的「文档 ↔ 实现」一致性：用法块列出的每个 `--flag` 必须真有处理分支，代码处理的每个参数必须在用法块里列出（标准参数 `--help`/`--version` 走白名单）。★ 由来：本日**第 5 次**遇到「文档先于实现」（最近一次：`/api/dub/analyze` 的注释写着「也可由外部注入结果」，而 `server.mjs` 里**完全没有 `analysis` 字样**）—— 这类注释**读起来像已完成**。支持两种解析风格（`case '--x'` 与 `a === '--x'`）。★★ **2026-10-06 修一个已确认的假绿：用法块判据从「整份源码里任意缩进 ≥2 空格的 `--flag`」收紧成「锚点法」**。★ 假绿形态：旧 `documented()` 扫**整份源码** ⇒ 一段**无关**的模板文本/注释里缩进写个 `--flag`，就把「已实现但没写进用法块」的参数冒充成「已文档」。**夹具**（`fx-cli` vs `fx-cli-control`，差别只在另一段**无关模板**里多了一行缩进的 `--beta`）：`--beta` 已实现却没写进 `USAGE`，旧版 `fx-cli` **exit 0（假绿）**、`fx-cli-control` exit 1；新版两者都 **exit 1 并点名「`dub.mjs`：代码处理了 `--beta`，但用法块没列」**。★ **为什么不能用「连续块 / 最长块 / 块大小阈值」**（先测误报率；实测**确认**前一位「真实用法块不是连续块」的判断成立）：`dub.mjs` 的用法块被空行/续行切成 **12 个碎段**（各段长度 `[1,2,4,4,1,1,1,1,2,1,1,4]`，最长 4 行）、`lemo-make.mjs` **10 个**（最长 8 行）⇒ 实测误报（把**合法**参数判成「代码有文档无」，`dub`/`lemo-make`）：**只认最长块 18/13 条**、**块长≥3 的并集 10/9 条**、**块长≥2 的并集 6/5 条**、**距小标题≤40 行 4/3 条**（且**杀不掉夹具的假绿**）、**朴素反引号配对 0/21 条**（`lemo-make` 的反引号转义与 `${}` 嵌套模板会让配对错位 ⇒ doc=0 全假红）。★ **新判据（锚点法，机械可解释）**：用法块 = 「含**用法小标题**的那段**模板字符串**（或块注释）」；小标题 = 行尾的 `用法:`/`用法：`/`Usage`/`USAGE`/`选项`/`Options`/`OPTIONS`（前面须是行首/空白/`*`/`·`/反引号）；区域边界 = 由「未转义反引号数的奇偶」判断小标题在不在模板里，再取「上一个含反引号的行 ↔ 下一个含反引号的行」（块注释按 `/*` 起、其闭合标记止同理）；**只有落在区域内的缩进 `--flag` 才算「已文档」**。★ **误报率**：真实语料 `dub.mjs`/`lemo-make.mjs` 各 22 个已文档 flag，**改动前后集合逐字相同（差集 0/0）**、闸门输出**逐字节一致**、**exit 0**；44 个已文档 flag 逐个核对，**无一个**被打成「代码有文档无」。★ **已知局限**：**启发式（非 AST）** —— 小标题写成别的词、或用法块既不是模板字符串也不是块注释（例如用行注释逐行写）⇒ 识别不到区域，表现为 `doc.size===0`，会触发**失明守卫** FAIL（**不会**静默假绿）；`${}` 内嵌反引号等极端写法看不见 | 秒级 |
| `scripts/check-lexicon-coverage.mjs` | **规则词表覆盖闸门**（`lib/dub-lexicon.mjs` ↔ `lib/dub-styles.json`）。★ 由来：规则路（`lib/dub-semantic.mjs:226/234/242`）写的是 `TAG_LEXICON.theme[tag] \|\| []` ⇒ **tag 在词表里缺失时静默退化成空数组、命中数恒 0、该风格在这一维永远匹配不上，且不报错不告警**；而 `lexiconCoverage()` 自称「快速自检」却**全仓零调用点**（本闸门是它的第一个真实消费者）。判据双向：**A 类·漏登记判 FAIL**（用 `lexiconCoverage` 实现，不重写逻辑）、**B 类·死词条只列 backlog**（词表里有、无风格使用，符合「已记录积压不判 FAIL」纪律）。★ 防空转绿灯：`styles` 不是非空数组时**判 FAIL 并明说失明**（否则 schema 一变就静默枚举到 0 个风格、报「0 处漏登记」并绿灯通过）★★ **失明守卫②（2026-10-07 补，修「一个 tag 都没见过却全绿」）**：① 只保证 `styles` 是非空数组，但 `lexiconCoverage({})`（`lib/dub-lexicon.mjs:222-229`）对**没有任何 tag** 的输入返回四维**空数组** ⇒ 若**全库没有一个风格声明 tag**（`tags` 集体缺失 / 为空），`missing=[]` ⇒ 打印「✓ A 类·漏登记 0 处：所有风格的 tag 都能在词表同维度里找到 bucket」+ **exit 0**（**一个 tag 都没见过**）。现统计「全库四维实际声明的 tag 总数」，为 0 ⇒ FAIL。**实测（非破坏夹具 `D:/lemo-tmp/lxfix/`，3 风格 tag 全空；照本闸门「拷 `lib/` + `scripts/` 到临时目录」的变异测试设计）**：加守卫前 `✓ A 类·漏登记 0 处` + exit 0 ⇒ 加守卫后 `✘ 本闸门已失明：3 个风格里没有一个声明了 tag` + exit 1；真实语料（44 风格）改前改后**完全一致**（`漏登记 0 处、死词条 backlog 0 个 OK`，exit 0）。★ **顺带修一处真 bug**：`--json` 模式原先**尾部还会多打一行中文汇总** ⇒ stdout **不是纯 JSON**、`JSON.parse` 直接失败；现按项目既有约定（`check-derivation-caliber.mjs:325-328`）把说明 / 汇总行走 **stderr**，stdout 保持纯 JSON，并补 `blind` 字段（`false` = 真检查过）；改后 `JSON.parse(stdout)` 成功、`keys = styles,missing,dead,blind,ok` | 秒级 |
| `scripts/check-api-docs.mjs` | **HTTP 接口**的「路由 ↔ 文档」**双向**一致性闸门（`server.mjs` 分发块 ↔ `README.md` 的 `## HTTP 接口清单` 表）。★ 由来：本项目反复踩「**文档先于实现**」（最近一次：`/api/dub/analyze` 的注释写着「也可由外部注入结果」，而 `server.mjs` 里**完全没有 `analysis` 字样**，2026-10-04 才补齐）；`check-cli-docs.mjs` 已为**命令行**做了对称闸门，**HTTP 侧一直缺**。判据：server 有而 README 没有 ⇒ FAIL（新接口没登记）；README 有而 server 没有 ⇒ FAIL（文档撒谎）；★ **任一侧解析出 0 条 ⇒ 判 FAIL 并明说「本闸门已失明」**（防空转绿灯）。已知局限：只做**存在性**比对，**不校验「用途」文字是否准确** | 秒级 |
| `scripts/check-audio-chain.mjs` | **音频链可跑性闸门**。★ 由来：编排器 `lemo-make.mjs` 的音频链（配音→配乐→拟音→混音）靠**在 demo 目录里按候选清单找脚本**；**实测 `game-show` / `halftone-dossier` / `pictogram-motion` 三个风格的混音步必然失败**（报 `STEP_FAIL … 它用的是另一套音频架构`，见 `lemo-make.mjs` 的混音步）⇒ 它们**无法通过编排器重渲音频**，只能 `--skip-audio`（复用已有 `mix.wav`）。★ 这类缺口**只有真去渲才会发现** ⇒ 本闸门把它变成**静态一眼可见**。判据（**从 shell 模板解析真实候选清单**，不是 `orchestratorRuns()` 那个不驱动执行的 JS 镜像）：**A 类**（既无混音脚本、也无任何可复用 `mix.wav`）⇒ FAIL；**B 类**（已知「另一套音频架构」，冻结基线）只列 backlog；**Bnew 类**（**新增**的这类风格）⇒ FAIL（提示「补 `mix.py` 或把它加进基线并说明原因」）。实测：43 个风格、**有混音脚本 40、无 3（B 3 / Bnew 0 / A 0）** ⇒ 全绿。★ 防空转：候选清单或风格数为 0 ⇒ **判失明**。★ 已知局限：只判「脚本能不能被找到」，**不判音频质量、也不判 `--skip-audio` 复用是否语义正确**（实测那 3 个风格真正的音频产物是 **`music.wav`**，`mix.wav` 只是名字对不上的权宜产物 ⇒ 复用只保证能出片，不保证复用对） | 秒级 |
| `scripts/check-film-aspect.mjs` | **成片画幅闸门**。★ 由来：2026-10-04 我重渲 10 个风格样板片时，`style-distill.mjs` 构造渲染命令**没传 `--ratio`** ⇒ 落到编排器的**产品默认 9:16**，那 10 部从 1920×1080 变成 1080×1920；而 **9 个风格源码里根本没有 `FILM_META.aspects` 声明**（本库语义：**不写 = 只支持 16:9**，见 `styles/engraving/demo/film.js:35-43`）⇒ 渲出了**该风格并不支持**的画幅。**当时 21 个闸门全绿，没有一个能发现** ⇒ 立此闸门。判据：**A 类（FAIL）** 成片实际画幅必须落在该风格声明支持的集合里（未声明 ⇒ 只支持 16:9，与 `lib/aspects.mjs` 一致）；**B 类（FAIL）** 43 部样板片**画幅应一致**，少数派即违规（判据是**一致性**，不是硬编码 16:9 —— 若全库一致地都是 9:16 且各风格都声明支持，则不违规）。实测首跑即抓出 **10 处**（9 处 A + 10 处 B，`engraving` 只吃 B 因为它确实声明了 9:16）。★ 防空转：成片数或风格数为 0 ⇒ **判失明**。★★ **2026-10-05 补 C 类（样板片被覆盖的盲区）**：A/B 只读 `_distill.json` 的**声明值** ⇒ 「声明 1920×1080、**实际文件** 1080×1920」看不见；真实事故：`D:/lemo-films/art-deco/art-deco.mp4`（样板片）被另一个**不带 `--out` 的并发 `lemo-make`** 覆盖成 1080×1920，而本闸门当时**全绿**。★ 核实（不重复造判据）：`check-film-delivery.mjs:155-168` **已用 `ffprobe` 读实际文件**并把 `generatedVideo.width/height` 与实测比对 ⇒ **json 未被改写**的场景它已能抓到（实测报 `C width 不符 文档 1920 vs 实测 1080`）；但其语义是「**文档 == 实测**」的自洽判据，真空在于 `refresh-style-skill.mjs:165-166` 会把实际值**回填进 json** ⇒ json 一刷新即文档==实测，而本闸门 A 类（43 个风格**全都声明了 9:16**）与 B 类（若一致地全变 9:16）**也放行** ⇒ **两闸门同时失明**（外加 delivery 是 ~2 分钟的晚段闸门）⇒ 故在本闸门补一条**绝对**判据。**C 类（FAIL）**：用 `ffprobe` 读**实际成片文件**，要求**恰为 1920×1080**（依据：样板片一律 16:9，见 `scripts/style-distill.mjs:331` 的 `--ratio 16:9`），报 slug + 实际值 + 期望值 + 文件 mtime；★ **文件缺失 ⇒ 单列「缺失」不判 FAIL**；★ **失明守卫**：文件根不存在 / 枚举到 **0 部**成片 / `ffprobe` 不存在 ⇒ FAIL 并明说「已失明」。支持 `LEMO_DISTILL_ROOT` / `LEMO_STYLES_ROOT` / **`LEMO_FILMS_ROOT`**（实际成片文件根，默认 `D:/lemo-films`，供 C 类做**非破坏性**变异验证）覆盖 | ~2 秒 |
| `scripts/check-aspect-declaration.mjs` | **影片入口画幅声明闸门**（拦一个「潜在陷阱」）。★ 陷阱：`lib/aspects.mjs` 是控制台判定「某风格真能正确构图的比例」的**唯一判据源**，而它**只探 `demo/film*.js`**（本库语义：没写 `FILM_META.aspects` = 只支持 16:9）；但**影片的真实入口是 `demo/index.html`**（`core/render/page.mjs:16` 要求它存在），`index.html` 再 `import(...)` 具体模块。实测 43 个风格里**只有 21 个有 `film*.js`**，另 22 个走 `main.js` / 内联脚本 ⇒ 若有人照 `MAINTAINING.md` 的多比例范式改造了 `main.js`（读视口自适应），**控制台仍会报「只支持 16:9」**（探测看不到），用户被假的「会被裁切」警告与「一键修复」推向更差的比例。判据：**有 `film*.js` ⇒ OK**；**没有** ⇒ 解析 `index.html` 引用的**本地** `.js` 模块（`import('…')` / `import … from '…'` / `src="…js"` 多种写法都认，排除 `node_modules/` 与根绝对路径）+ 内联 `<script>` 正文，逐行找 `innerWidth` / `innerHeight` / `visualViewport`（剔 `//` 注释），**命中 ⇒ FAIL**（报 slug + `file:line` + 「请新建 `demo/film.js` 承载声明」）。★ **失明守卫**：风格目录不存在 / 枚举到 0 个风格 ⇒ FAIL 并明说失明。★ 已知局限：**启发式** —— 「读了视口」≠「一定自适应」，可能误报；命中应**人工确认，别自动改代码**；动态拼路径 / importmap 别名 / CSS 媒体查询等途径**看不见**（假阴）。支持 `LEMO_STYLES_ROOT` 覆盖 | 秒级 |
| `scripts/check-aspect-prose.mjs` | **SKILL.md 画幅论述闸门**（拦「文档撒谎 / 人读到的与机器读到的不同」）。★ 由来：事实源是 `lib/aspects.mjs` 的 `styleAspects(slug)`（读 `styles/<slug>/demo/film*.js` 的 `FILM_META.aspects` **字面量**，**没声明 = 只支持 16:9**），文档源是 `lib/style-skills/<slug>/SKILL.md` 的 §2 / §9 / §11；**实测事故**：某风格已改造为支持 9:16，但 `SKILL.md` **只改了一半**、还残留 1 处「只支持 16:9」，**当时 21 个闸门全绿**，是人工 `grep -c "只支持 16:9"` 才抓到的 ⇒ 立此闸门。判据**双向**：**正向（FAIL）** 已支持 9:16 却仍称「只支持 16:9 / 9:16 不可用 / 会裁右侧 43.75% / 架构级缺陷」；**反向（FAIL）** 未支持 9:16 却称「已适配 9:16 / 已支持竖屏」。★ 历史语境豁免与 `check-tp-prose` **同源**（项目习惯「保留原句 + 历史标记」）：① 命中落在引号（`「」`/`『』`/`“”`）或删除线（`~~…~~`）内 ⇒ 豁免；② 整行含历史标记（`已修/原记/已作废/旧文档`…）也豁免，**但若整行同时含「当前结论」标记**（`现状/当前结论/目前/仍然/依旧`）⇒ **不豁免**（防「一刀切豁免」把「披着历史外衣的当前结论」放过）。行内提到**别的风格名**的单列「交叉引用」不计 FAIL。★ **失明守卫**：风格文档目录不存在 / 枚举到 0 个风格 / 事实源目录不存在 / `styleAspects()` 对全部风格都探不到影片模块 ⇒ **FAIL 并明说「本闸门已失明」**。★ 事实源须在 **Windows 侧**跑（WSL 里会降级成默认值、把全部风格误报 `declared=false`）。`--ignore <slug,…>`（或 `LEMO_ASPECT_PROSE_IGNORE`）可显式排除**正在并行改造**的风格（默认查全部 43 个，非硬编码豁免）。支持 `LEMO_SKILL_ROOT` / `LEMO_STYLES_ROOT` 覆盖（变异测试用）★★ **2026-10-07 让事实源可覆盖 + 记下「方向级失明」**：`lib/aspects.mjs` 的 `STYLES_DIR` 原先**写死** `path.join(CFG.winLib, 'styles')`，于是本闸门的 `LEMO_STYLES_ROOT` **只管失明探测、管不到真正的事实源** ⇒ 本闸门**无法做非破坏反向测试**。现 `STYLES_DIR` 改为 `path.resolve(process.env.LEMO_STYLES_ROOT || …)`；**自证零行为变化**：43 风格 `styleAspects()` dump 逐字节一致（`declared=true` 计数 42 相同）、真实语料输出一致。★ **「方向级失明」实测未复现**（如实记录）：构造「事实源有 `film*.js` 但都不写 `aspects`、文档却写『已支持 9:16』」的假树 ⇒ 闸门**判 152 条 FAIL 并 exit 1**（**响亮的判错方向**，不是静默假绿）；只有「事实源有且仅有一个支持 9:16 的风格、且恰与 POS 词表锚点重合」这一个子情形是**静默假绿**，而它与「事实源正常但文档集体撒谎」**文本上不可区分** ⇒ **刻意不加守卫**（加了会把「闸门失明」换成「闸门说谎」，更坏）—— 推理见 `scripts/check-aspect-prose.mjs` 头注释。★ 已知旁路（本次**未改**，只记）：`lib/briefs.mjs` 与 `lib/env.mjs` 各自 `path.join(CFG.winLib, 'styles')`、不经过 `STYLES_DIR` | 秒级 |
| `scripts/check-dual-copy-sync.mjs` | **全仓「两份副本必须同步」闸门**（约定三）。★ 由来：2026-10-04 一次只读全仓审计发现 —— **渲染读 WSL 侧**（`lemo-make.mjs` 用 `CFG.wslLib`）、**源码指纹读 WIN 侧**（`style-scan.mjs` 默认 `D:/lemo-opuscar/styles`）⇒ 两份一旦不一致，**指纹记录的根本不是被渲染的那份**，`style-distill.mjs plan` 会**永远报「已蒸馏且未变」**（静默失效）。实测真漂移：`engraving` 风格 **9 个源文件**（WIN 10-02 新增 3 个 `subjects/*` + 加 `setFonts()` CJK 支持，**从未同步到 WSL**）与根级 `MAINTAINING.md`。判据：**源文件（`.sh .mjs .js .py .html .css` + 根级 `STYLE.md`/`DEMO.md`/`style.json`）逐字节不一致或单侧缺失 ⇒ FAIL**；**生成物**（`*.srt`、`dur/words/cues/events/lines/score/lips*.json`、`demo/out|voices|voices_raw/**`、`content*.json`）与**资产**（`core/audio/instruments/**`、`core/lang/fonts/**`、WIN 独有工作区 `creative/**`）只列 backlog **不判 FAIL**（不同宿主由流水线各自生成，漂移正常）；★ **防空转**：任一侧扫到 0 个文本文件或 WSL 不可达 ⇒ **判失明**（实测把 `LEMO_WSL_ROOT` 指到不存在路径 ⇒ 正确判失明 exit 1）。★★ **2026-10-06 补第 ⑤ 条判据「git 历史一致性」（参考级，一律不判 FAIL）**：上面那些判据**只比工作区文件 md5** —— 而两份副本是**两份独立仓库**（各有 `.git`、同一个 `origin`）⇒ **两侧 git 历史分叉时旧版闸门看不见**。实测（本次）：WIN HEAD `b0de9e7`（刚提交）、WSL HEAD `f3c590d`、WSL `status` **307** 条；WSL **看不到** `b0de9e7`（`cat-file` ⇒ `Not a valid object name`）⇒ **那个提交只在 WIN 侧**；而**文件是同步的** ⇒ 旧版**全绿**、历史却已分叉。★ 危害：WSL 那份一旦被**当权威**或**重新克隆**，会**丢掉本会话的全部提交**。判据（**只读、便宜、不扫全仓**）：两侧各跑一次 `git status --porcelain=v2 --branch`（**一次调用**同时拿 HEAD / 分支 / 未提交条数），再**双向** `git cat-file -t <对方 HEAD>` 探「一侧能否看到另一侧 HEAD」，若对象都在再用 `git rev-list --left-right --count A...B` **一次**拿领先/落后；报告两侧 HEAD + 分支 + 未提交条数 + 领先/落后 + **哪一侧看不到对方 HEAD** + **后果**。★★ **为什么一律不判 FAIL（本判据最容易做错的地方）**：① **今天就会红** —— 实测历史**已经**分叉（WIN 领先 1）⇒ 判 FAIL 会**立刻打破「27 闸门全绿」**，而项目习惯是「**先测误报率再定判据**、不轻易让既有闸门变红」；② **不重复** —— 真正**已造成损害**的形态是「两侧工作区文件不一致」，那是**既有判据**的职责（判 FAIL），历史分叉只是**潜在**风险；③ **不可自动修** —— 收敛要动仓库（push/pull/merge），本闸门**只读、不改任何仓库状态**，报 FAIL 等于「报一个本闸门无权修的错」，会诱导用 `--no-wsl` 绕过；④ **良性形态多** —— 一侧刚 commit 未 push、一侧正在 rebase、两侧各有未提交都是正常中间态，判死会把正常流程打红。⇒ 只**报告事实 + 后果**，方向由人定。★ **失明守卫**（失明**不许** FAIL、但必须**明说**）：任一侧 root 不存在 / 该路径下**没有 `.git`** / 该侧**没有 git 命令** / git 块未出现在 WSL 输出里 ⇒ 打印「**本判据已失明（原因）**」、**不判 FAIL、不影响退出码**。★ **性能**：WIN 侧最多 3 次 `git`（status/cat-file/rev-list，都 O(1)、不扫历史），WSL 侧**搭车**在既有那次 bash 调用里（**不额外起 `wsl.exe`**）⇒ 实测整闸门 **1.11s → 1.44s（+0.33s）**。★ 已知局限：只比**提交图与工作区脏污**，**不比 remote 配置**（两侧 URL 写法不同 —— HTTPS vs SSH —— 是良性的，判死会误报）；**不 `fetch`**（联网且会改仓库状态）。★ 变异验证（**临时仓库对**，不动真实仓库）：① 两侧 HEAD 相同 ⇒ 报「✓ 两侧 HEAD 相同」exit 0；② 只在一侧加一个**不改被比文件**的提交（改 `.gitignore`）⇒ 报「已分叉 + 对方看不到该 HEAD + 后果」、**源文件漂移 0 处、exit 0**（旧版此情形**全绿**，正是本次要止住的盲区）；③ 该侧存在但**无 `.git`** ⇒ 报「本判据已失明（没有 .git）」、exit 0；④ WSL 路径不存在 / WIN 路径不存在 ⇒ git 判据报失明（**不 FAIL**），exit 1 来自**既有文件判据**的失明守卫（原有行为）。★★ **2026-10-06 补第 ②b 条判据「无扩展名的控制文件」（**已实证**的盲区，不是推测）**：旧版 `isText()` = 「扩展名在 `TEXT_EXT` 里」**或**「文件名正好是 `TEXT_NAMES` 那五个」⇒ **`.gitignore` 这类点开头、无扩展名的控制文件一条都不匹配**（`isText('.gitignore')` ⇒ false）⇒ **两份副本的 `.gitignore` 内容不同（实测曾为 `a25c8d…` / `96112b…`）而本闸门全绿**。这类漂移是**真漂移**且更隐蔽：`.gitignore` 决定**哪些文件入库** ⇒ 两份不一致时「同一份源码在两边入库状态不同」、新克隆**少文件**。实测同类盲区还有 `styles/watercolor/demo/vendor/LICENSE-topojson-client` / `LICENSE-world-atlas`（无扩展名的许可边车，旧 `isText()` 同样判 false ⇒ 从不比对）。判据：`TEXT_NAME_GLOBS = ['.gitignore', '.gitattributes', '.editorconfig', '.gitmodules', 'LICENSE-*']` —— **同一份 glob 列表**同时喂给 WIN 侧匹配器（`globToRe`）与 WSL 侧 `find -name` ⇒ 两侧枚举**由构造保证一致**；命中即按**源文件**处理（漂移判 FAIL）；**不限层级**（本仓实测 2 个 `.gitignore`：根目录 + `styles/engraving/demo/music/.gitignore`）。★ 为什么是「固定 glob 列表」而不是「所有无扩展名文件」：后者会把 `.venv/bin/pip`、`demo/out/.video_gpu_segs-<rand>/pid` 这类**生成/第三方**无扩展名文件也拖进来，既拖慢又全是噪声。★ **失明守卫沿用既有那一条**（不另设）。★ **已知假阴（别当它不存在）**：glob 写漏/写错时两侧**同时**漏 ⇒ 闸门仍绿；本判据只保证「**被枚举到的**文件一致」，**不保证**「该枚举的都枚举到了」。★ **性能**：`find` 多 5 个 `-name`、WIN 侧每文件多 5 次正则 ⇒ 实测 ~3.1s **无可测变化**。★ **变异验证（WSL 侧临时硬链接镜像 + `LEMO_WSL_ROOT` 覆盖点，全程不动真实仓库）**：镜像基线「源文件漂移 0 / 生成物 95 / 资产 46」、exit 0（与真实仓库**逐项相同**）⇒ ① 镜像 `.gitignore` 尾部加 **1 字节**（`a25c8d…` 4901B → `11a43861…` 4902B）⇒ 报 `✘ .gitignore 两侧不一致 | WIN a25c8de8a3… 4901B | WSL 11a43861fd… 4902B | WSL 新`、**源文件漂移 1 处、exit 1**（旧版此情形**全绿**，正是本次要止住的盲区）；② 还原 ⇒ **复绿 exit 0**；③ 同理变异 `LICENSE-topojson-client` ⇒ 报出、exit 1（证明 `LICENSE-*` 这条 glob 也有牙）。真实仓库全程未动（`.gitignore` md5 前后一致）| ~1.5 秒 |
| `scripts/check-venc-args.mjs` | **编码器参数组合的「真编一帧」闸门**。★ 由来：GPU 优先改造把 26 个编码器决策点的参数都动过，而**没人验证过 ffmpeg/nvenc 真的接受这些参数** —— 参数写错（如把 `-rc constqp` 写成 `-cq`）会**到出片时才炸**且没人拦。判据：从 `core/render/**` + `styles/*/demo/**`（`.sh`/`.mjs`）+ `tools/*.sh` 抽出**去重后的每个编码参数组合**，逐个跑 `ffmpeg … -f null -` 编 1 帧 320x240 纯色，**退出码 ≠ 0 ⇒ FAIL**（报出组合 + 出处文件:行 + ffmpeg 报错）。实测 **32 个组合（16 nvenc + 16 libx264）、来自 26 个源文件、~4 秒全绿**。★ 防空转：抽到 0 个组合 ⇒ **判失明**；`$(awk …)`/`$CRF` 等运行期变量会代入具体值，代入不了 ⇒ 判 FAIL 并逐条列出（不静默跳过）。已知局限：只验「ffmpeg 接受参数」，**不验画质/体积** | ~4 秒 |
| `scripts/check-render-venc.mjs` | **「渲染一律 GPU 优先」硬规则的机器守卫**。★ 由来：用户硬规则（最高优先级）「渲染必须用我的显卡 GPU 跑，整个项目只要涉及渲染都要 GPU 优先渲染」；审计发现**出片路径上的编码器决策点**此前是「未设 `LEMO_VENC` ⇒ 静默 `libx264`(CPU)」（`core/render/video.mjs`、`core/render/mux.sh`、9 个被挑中的 `demo/tools/mux.sh`）—— 编排器默认导出 `h264_nvenc` 所以出片本来走 GPU，但**手工构建**（`sh styles/<slug>/demo/build.sh`）不设该变量 ⇒ 改之前真的走 CPU。判据：**未设 ⇒ `h264_nvenc`；显式 `libx264` ⇒ 才 CPU；其它值 ⇒ 报错退出**。A 类（出片路径）违规 ⇒ **FAIL**；B 类（15 个不在出片路径的手工脚本）只列 backlog（符合「已记录积压不判 FAIL」）；D 类（`D:/lemo-opuscar` + `D:/lemo-tools` 的文档/注释里**把「未设时走 CPU 软编」当成默认行为的过期声称**，报文件+行号+片段）⇒ **FAIL**（★ 只做关键词/上下文判定，**不做语义理解**，边界会漏；扫到 0 个文件 ⇒ 判失明）；★★ **2026-10-06 修一个已确认的假红：D 类判据加「相邻性」(e)** —— 旧**守卫**判据只要求「同一小句内同时出现 `libx264` + 默认类词 + 编码语境」；于是本**守卫**把表格里的 `\| libx264 \| 默认安装即有的软件编码器 \|` 判成过期声称（`默认` 修饰的是「默认**安装**」而非「编码器默认值」）—— 假红 3/3；新判据 (e)：限定词必须**直接修饰** `libx264` —— 二者之间只能是「空白 / 标点（**不含表格竖线 `\|`**）/ 连接词白名单（使用·用·走·是·为·的·时·编码器·情况·means·is·use·by·…·`LEMO_VENC`）」；且限定词在编码器名**之后**时其右侧须紧接边界/标点/连接词。**验证**：假红夹具 `fx-fp`（3 条）**改后 exit 0**、**改前 HEAD exit 1**；真声称**守卫**夹具 `fx-tp`（7 形态，含「默认使用 `libx264` 编码」）**改前 exit 1 / 改后仍 exit 1 且 7 条全中**（**守卫没瞎**）；真阴性真实语料（1548 文件）**改前改后输出逐字节一致、exit 0**；★ 新局限（有意取舍）：限定词与编码器名之间垫了实词/整段说明、或**分处表格两格**的真声称会被 (e) 漏报 —— 同形态也是假红来源，纯文本判据无法两全，本**闸门**选「宁漏不乱报」；★ **两份副本（`D:/lemo-opuscar` ↔ WSL `/home/lemo/lemo-opuscar`）逐字节不一致 ⇒ FAIL**；★ 解析出 0 个决策点 ⇒ **判失明**（防空转绿灯）。★★ **2026-10-07 纳入第三个编码决策点：`D:/lemo-tools/dub.mjs`（第三条通路「文案+口播+风格」的最终编码）** —— 它此前**两处混流命令硬编码 `-c:v h264_nvenc`**、**不读 `LEMO_VENC`**、且**不被本闸门登记**：满足「一律本地 GPU / 禁止云端」，但**没有覆盖点**（打错成 `h264_nven`、或想临时走 CPU，都没有统一开关）⇒ 是出片路径上**唯一没被守住**的编码决策点。现纳入 A 类，口径照抄既有形状：**未设 ⇒ `h264_nvenc`；显式 `libx264` ⇒ CPU；其它值 ⇒ 报错退出**（错误文案与 `core/render/video.mjs` / `core/render/mux.sh` / `video_png.mjs` 逐字一致）。★ 它属 **lemo-tools 仓**（WSL 侧无副本）⇒ 展示路径加 `lemo-tools/` 前缀，且**不参与 C 类双副本比对**（否则报「WSL 侧缺失」这种**结构性假红**）。★ **误报率实测（先测再定稿）**：真实语料上 A 类决策点 11 → **12**（新增那 1 条判 ✓）、D 类扫描集与命中数与改动前**逐字不变**（1550 文件 / 0 命中）、C 类仍比 26 个文件 ⇒ **新增误报 0**。★ **变异验证**（临时树 `D:/lemo-tmp/agent-dubvenc/mut/faketools/`：把本闸门拷进去、`LEMO_OPUSCAR` 指向真实仓、`--no-wsl`，**全程不动真实 `dub.mjs`**）：① 还原成修复前形态（不读 `LEMO_VENC`）⇒ **exit 1 并点名 `lemo-tools/dub.mjs`**（「找不到 `process.env.LEMO_VENC || …`」）；② 把未设时的默认值改成 CPU 软编 ⇒ **exit 1 / `L64：未设 LEMO_VENC ⇒ 'libx264'（应为 h264_nvenc，GPU 优先）`**；③ 删掉非法值校验 ⇒ **exit 1 / `L20：没有「非法值 ⇒ 报错退出」的校验`**；对照组（修复后）**exit 0** ⇒ 新决策点**真的被判**（不是橡皮图章）。★ **新局限（已写进头注释 ③）**：mjs 侧只判**文件级**的「解析出 VENC/VARG + 非法值校验」，**不核对每个调用点真的用了那个变量** ⇒ 有人把 `-c:v h264_nvenc` 重新硬写回某一处命令里，本闸门**看不见**（假阴性；由 `check-venc-args.mjs` 真编一帧 + 人工读 diff 兜底）。配套幂等回灌器 `scripts/patch-render-venc.mjs`（双副本 + `tr -d "\r"` + 两侧 `sh -n`/`node --check`）。★★ **2026-10-07（b85-a）两处盲区修正**：① **D 类②（无限定词的错claim）** —— 旧 D 类要求小句内有「默认/未设」限定词，**抓不到**「**示例**：demo 自带 `mux.sh` 用的是 `libx264 -preset slow -crf 17 -r 60`」这类**没有限定词**的写法；新判据 = 同一小句内 `libx264` + 编码上下文（**行级**，与旧判据同口径）+ **脚本引用**（`mux.sh|render.mjs|build.sh|finish.sh|render/video|video_png|video_range|render_range|自带`），且无 `h264_nvenc`、无豁免词（`D_EXPL2` = 旧 `D_EXPL` + `判据|原为|原记|曾写|已过期|已修|以前|不要|别写|别用|禁止|示例|命令|代码块|写法|语法|说成|写成|称作`）；判 FAIL、报仓库+文件+行号+片段。**误报率实测（先测再定稿，真实语料 1544 文件逐条人工分类）**：v1（只要 a+c+脚本引用）命中 **16 = 真阳性 3 + 误报 13** → v2（+追加豁免）命中 **7 = 3 + 4** → v3 命中 **5 = 3 + 2** → 定稿（+`说成|写成|称作`）命中 **3 = 真阳性 3 / 误报 0**；3 条真阳性 = `paper-popup/_distill.json:21`、`:128`、`silent-film/SKILL.md:147`，均已按「保留原句 + `原记` + 补现值」修正 ⇒ 修正后重测 **0 命中 / exit 0**。★ 试过但**否决**的形态：不加追加豁免 ⇒ 误报 13/16（全是判据自述/复盘条目/「回退 `libx264`」/「原先硬写 `libx264`…已修」等合法行）；要求 `用|走|是` 紧邻 `libx264` ⇒ 漏掉真阳性「**示例**：而不是 demo mux.sh 的 `libx264` crf17」⇒ 收窄过度。② **B 类分类订正**：`styles/risograph/demo/tools/video_png.mjs` 已**在出片路径上**（编排器渲染段候选探测 `demoRenderRel`，`lemo-make.mjs:1484`）且已支持 `LEMO_VENC` ⇒ 从 `B_FILES`（15→**14**）挪进 **A 类**（A 12→**13**）；其余 14 项逐项核实**确不在出片路径**（编排器与 `dub.mjs` 都不执行；三份 `demo/mux.sh` 接口不符 ⇒ 回退 core，`check-mux-selection.mjs` 实测）。测试：`test/gate-blindness.test.mjs` 补 D 类② **正/阴/★自证** 3 类用例（69→**71** 条） | 秒级 |
| `scripts/patch-render-venc.mjs` | 按上述判据**幂等回灌** 26 个编码器决策点（双副本一起写）。★ 为何另立而不复用 `patch-style-mux.mjs`：后者是**历史补丁工具**，对已含 `LEMO_LN_TP` 的文件**自动跳过**（它自己的头注释 :16-17 写明），13 个目标里 8 个已含 ⇒ 实际已不生效 | 秒级 |
| `scripts/patch-style-mux.mjs` | 给各 demo 自带的 `mux.sh` 回灌 core 版已修的两处（幂等，支持 `--dry` / `--revert`） | 秒级 |
| `scripts/check-esm-import-paths.mjs` | **动态 `import()` 传「运行时拼出来的绝对路径」的跨平台闸门**。★ 由来：2026-10-05 在 **Windows** 下跑 `styles/hologram-hud/demo/tools/export.mjs` **直接崩** —— `Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. On Windows, absolute paths must be valid file:// URLs. Received protocol 'd:'`。根因：`await import(path.join(ROOT, 'core/render/page.mjs'))` —— `path.join` 产出 `D:\…`，而 Node 的 ESM loader **只认 `file://` URL**（POSIX 下绝对路径可用 ⇒ 以前走 WSL 跑没暴露）。全库同款写法共 **6 处**（hologram-hud/export、silent-film 与 art-deco 的 dump_timeline、midcentury-toon/cues、crayon-book/subs、blueprint/tools/subs），已全改为 `import(pathToFileURL(p).href)`。判据：扫 `styles/<slug>/demo/**` 与 `core/**` 的 `.mjs/.js`，找动态 `import(<arg>)`，`<arg>` 是运行时拼的路径且**没有** `file://`/`pathToFileURL` ⇒ **FAIL**（报 `file:line` + 原始行）；`path.join/resolve/normalize` 直接命中，模板/拼接则看**首片段**（`./` `../` `/` 或 scheme ⇒ 放行，故 `import('./' + f + '.js')` 与 `import('data:…' + readFileSync(path.join(…)))` 不误报）。★ **失明守卫**：扫描根不存在 / 收集到 0 个文件 ⇒ FAIL 并明说「本闸门已失明」。★ 已知局限：**启发式（非 AST）** —— 路径来自变量 / `createRequire` / importmap 等**看不见**（假阴）；自定义 scheme 可能**误报** ⇒ 命中应**人工确认，别自动改代码**。修法：`import(pathToFileURL(<原表达式>).href)` | 秒级 |
| `scripts/check-ref-lines.mjs` | **散文/源码里的 `<路径>:<行号>` 引用会不会随行号漂移而失效**。★★★ **扫描范围（2026-10-07 再扩：纳入源码文件）**：**180 份文档 + 791 份源码** —— 源码侧 = `lib/*.mjs`（根级 21 份）、工具仓根 `*.mjs`（5 份）、`styles/*/demo/**`（733 份）、`core/**`（24 份）、`tools/**`（8 份），只收 `.mjs` / `.js` / `.py` / `.sh`，**排除 `vendor/`、`node_modules/`、`.git/`、`*.min.js`**（压缩产物里 `r.classId` / `r.length` 这类「标识符 + `:0`」形态会被 `REF` 认成引用 —— 因为 `r.classId` 恰好长得像「带扩展名的路径」⇒ 不排除就**假红**；夹具 t3 实测：同一段内容放 `demo/vendor/lib.min.js` 被排除、放 `core/notmin.js` 则报 **2 处假 (a)**）。★ **为什么加源码**：源码注释里的同类引用此前**零覆盖** —— 实证 `lib/jobs.mjs`（3 处）与 `lib/vram.mjs`（2 处）的这类引用**全部已失效**（`lemo-make.mjs` 的 1158 / 743 / 996-1019 / 2428×2 行 ⇒ 真位置 1273 / 858 / 1559-1563 / 2716 行）。★ **判据不变**（(a)(b)(c)(d) 四条全跑；源码里的引用**目标也是别的文件**，与它写在哪种文件里无关）。★ **误报率实测（791 份源码 / 8 处引用，逐条人读）**：**命中 1（真失效）/ 误报 0 ⇒ 精度 100%** ⇒ **不做任何收窄**。那 1 处 = `lib/jobs.mjs` 第 61 行引 `server.mjs` 第 1675 行（1675 行是 `*/`；`--skip-sync` 实在 1674 行注释 / 1755 行 `const opts = ['--skip-sync', ...b.runOpts];`）⇒ **(c) FAIL 真阳性**；另有 **有效 3 处**（`styles/art-deco/demo/frame.js` 第 11 行引 `STYLE.md` 第 45 行、`lib/dub-core.mjs` 第 169 行引 `halftone-dossier/STYLE.md` 第 19 行、第 172 行引 `risograph/STYLE.md` 第 23 行，逐条核过被引行内容与引文逐字一致）与 **只列不判 4 处**（`demo/index.html` 第 140 行 ×2 全库 46 处同名、`STYLE.md` 第 25 行 44 处同名 ⇒ 多义）。★ 排除项**在本轮真实语料上不承重**（带排除 791 份/8 处，关掉排除 792 份/**同样 8 处** —— 那个 `vendor/opentype.min.js` 里**一个反引号都没有**）⇒ 它是**保险**而非修 bug，但**必须留**（夹具 t3 证明该形态一旦落进不被排除的文件就假红）。★★ **同时暴露的第二层盲区（比「没扫源码」更深）**：任务书那 5 处里**只有 1 处带反引号**，其余 4 处是**裸引用**（写作 `见 lemo-make.mjs:743` 这种形式）⇒ 本闸门**按设计就不认**，**扩了源码范围也照样看不见** —— 即「源码文件已纳入」**不等于**「源码里的引用都被管住」；修法是给裸引用**加反引号**（本轮那 5 处已顺带改成**符号名 / 代码锚**，不再依赖行号）。★ **失明守卫照旧生效**（夹具 t4：整棵树无引用 ⇒ exit 1 + 「本闸门已失明」）。★ **不纳入**：`node_modules/`、`vendor/`、生成物。★ **2026-10-07 订正**：`scripts/**` **已纳入**（见上「扩扫描范围③」，实际扫到 44 份）—— 本行原写「`scripts/**`（本轮未要求）不纳入」，那是**上一批的旧状态**；★ 但**本闸门不扫自己**（它的头注释必须用反引号举「引用形态」的例子、并引用真实语料当判据证据，拿它们当真引用核 = **结构性误报**）。★★ **扫描范围（2026-10-07 前一次扩：`.json`）**：**137 → 180 份** —— `test/README.md`、`_distill/AGENT-BRIEF.md`、44 份 `lib/style-skills/*/SKILL.md`、**43 份 `lib/style-skills/*/_distill.json`（本次新增）**、`D:/lemo-opuscar` 的 `MAINTAINING.md` / `TECHNIQUE.md` / `core/README.md` / `styles/*/STYLE.md` / `styles/*/DEMO.md`。★ **为什么加 `.json`**：它的 `defects` / `resolvedDefects` / `limits` / `assetGaps` 文本里**确实有**同样的 `<路径>:<行号>` 引用，而此前**零覆盖**（`DOCS` 只含 `.md`）⇒ 实测新增 **17** 处引用（3796→3813）、**0 FAIL**，逐条人读 **14 条有效 / 2 条真失效（弱）**（`hd-2d` 引 `ui.js` 第 81 行，而色值 `#f6f0e2` 在 88 行；`cel-anime-80s` 引 `demo/bg.js` 第 4 行，而正文说的 `#ff4fa8` 不在该行、`NEON[0]` 实为 `#ff3fa4`）。★ **口径**：`.json` 按**物理行**扫（与 `.md` 同口径），靠「`JSON.stringify` 把 `\n` 转义 ⇒ **1 字符串值 = 1 物理行**」保证与「按 JSON 字符串值判」**等价**（实测 **2510/2510** 个值都完整落在单个物理行内，两种口径跑出的引用集合逐条相同）⇒ **不写第二套解析器**。(a)(b)(c)(d) 对 `.json` **照样适用**，因为引用**目标是外部文件**（`.mjs`/`.js`/`.md`/`.txt`）、不是 JSON 自己；`.json` 唯一特有差异是**转义**，而**反引号不是 JSON 转义字符**，所以 `<路径>:<行号>` 在 JSON 里原样存在。★★ **不加反引号的「裸引用」明确不纳入（先测再定，实测否决）**：`_distill.json` 里还有 **390** 处裸引用（是反引号引用 17 处的 23 倍），按 (a)(b)(d) 判得 **3 命中 / 误报 2**（① 盘符 `D:` 被正则当分隔符吃掉 ⇒ 假 (a)；② `sfx.py` 第 9 行属「按文件名不搜 `core/`」的**已知局限**，`core/audio/sfx.py:9` 真有；③ `mux.sh` 第 115 行解析到**同名错文件** `styles/pictogram-motion/demo/mux.sh`（22 行）而非同小句自己写明的 `core/render/mux.sh`）⇒ 精度 ≈**33%**，且失败是**判据结构性**的：裸引用拿不到「同小句路径感知」（`siblingPaths` **只收反引号片段**）⇒ **不纳入**（正确修法是让引用**带反引号**）。★ **上面几处失效示例故意写成「路径 + 第 N 行」而不是 `路径:N`** —— 既因为**裸写法正是它们不被扫描的原因**，也因为**写成反引号包裹的 `路径:N` 就会把本闸门的说明文字变成真引用**（实测：第一版这么写，闸门立刻多报 (a) 2 + (b) 1）；★ 即使**不加反引号**也不安全：本行反引号有 **442 个**（2026-10-07 起配对已按 CommonMark 等长配对），别人的 code span 仍可能**把你这段纯文本圈进去** ⇒ 落进去就**既不计入引用、也不进 backlog**（本行里 `见 lemo-make.mjs:743` 那种写法就是被圈进去的实例）⇒ 唯一稳妥的写法是**把路径与行号拆开**。★ 另：任务书举的 `hd-2d/_distill.json` 引 `unblock-placeholder-audio.mjs` 那一例**不是反引号引用**（故本次改动管不到它），且它**现在已是对的 `:52`**（`{ slug: 'hd-2d', placeholder: true, … }`）。★ 由来（2026-10-06，本会话**连撞三次**）：`scripts/check-film-aspect.mjs` 的两处注释引用 `` `scripts/style-distill.mjs:189` ``（`--ratio 16:9` 所在行）；改了 `style-distill.mjs` 后它漂到 `:305`，把三处（`check-film-aspect.mjs:66`、`:105`、本文件:602）改成 `:305`；**同一轮里**又改一次、漂到 `:331`，那三处**再次全部失效** ⇒ 只要有人在被引文件**上方插删行**，所有行号引用就**静默失效**，而当时 28 个闸门**没有一个看得见**（纪律第 ⑦ 条「引用外部对象都要有闸门核它真的存在」一直空着的那一格）。判据四层：**(a) 文件存在**（路径解析不到 ⇒ FAIL）、**(b) 行号在范围内**（行号 > 总行数 ⇒ FAIL）、**(c) ★ 内容对得上**（引用所在**小句**内、距引用 **≤40** 字符处若有**高置信代码片段**——`--flag` / `#hex` / `标识符 = 值` / `名字(...)`——则要求它出现在**被引行区间**；用 **token 匹配**，全部 token 命中或某个含数字的 token 命中即算通过）。**(d) ★ 被引行没有内容**（2026-10-06 补，治 (a)(b)(c) **三条全放行**的盲区）—— 被引行 `trim()` 后是**空行** / 是 **`---`（或 `***` / `___`）** / 是 **```` ``` ```` 围栏** / **行号 > 文件实际行数**（`split('\n')` 尾元素造成的**幻影行**，(b) 的 `> lines.length` 抓不到它）⇒ FAIL。★ **只判单点引用**，区间引用（如 `a.js` 第 10-20 行）**不判**——区间**起点早一行**落在空行上是无害写法（实测 `art-deco/SKILL.md` 第 106 行、`shadow-puppet/SKILL.md` 第 101 行、本文件第 581 行三处**全是**这种形态，判它们就是 3 处误报）。★ **误报率（先测再收窄）**：初版（不分单点/区间）命中 **13** / 误报 **3** ⇒ 精度 **77%**；**定稿版（只判单点）命中 13 / 误报 0 ⇒ 精度 100%**（那 3 处被**结构性排除**，不是靠 backlog 兜）⇒ **判 FAIL 而非 backlog**：与 (c) 不同，(d) **没有误报机制**——「被引行是空行/分隔线/围栏/不存在」**没有任何合法读法**能解释成「我指的就是它」。★ **路径感知**（**不做全仓 basename 模糊匹配**——实测那样会把 `main.js:566` 命中到**另一个只有 11 行的** `main.js`，把真问题掩盖成「行号超范围」）：解析顺序 = 文档**所属风格**树 → 文档目录 → 仓根与常见子目录 → 风格树内按尾段唯一命中 → 全库尾段唯一命中；**同小句里出现带目录的同名路径**时以它为准（实测 `hd-2d` 的「core/render/mux.sh … `mux.sh:152-162`」指的就是 core 那个）。★ **误报率（先测再收窄，逐层实测）**：(c) 初版「小句内任取一个反引号片段、要求它是被引行子串」⇒ 候选 98 / FAIL **46**，人工核对**误报约 60%**（`--ratio 16:9` 源码写作 `'--ratio', '16:9'`、`type=='cap'` 写作 `e['type']=='cap'`、`dur 133.0` 写作 `"dur": 133.0`…）⇒ 否决；收窄「距引用 ≤40 但**不限小句**」⇒ 候选暴涨 **646** / FAIL **363**（邻句片段被捞进来）⇒ 否决（小句约束必需）；「只认高置信形态 + 先排除引用自身」⇒ 候选 **37** / FAIL **17**、误报 **0** ⇒ 采用；再把子串匹配换成 token 匹配 ⇒ 消掉 3 处已知误报（`type=='cap'` / `OUT='out/mix.wav'` / `COL.cobalt = …`），**最终 37 / 10**。★ **不收窄成只查 (a)(b)**：(c) 是唯一能抓住「**行号在范围内、但那一行已经不是它说的东西**」的判据 —— 恰是本闸门要治的形态。★ **豁免（只列不判）**：路径匹配 `(^|/)logs?/` 或 `.log$` 的引用 —— `_distill/logs/*.log` **两个仓都被 `.gitignore` 排除**（实测 `git check-ignore` 命中 `*.log` / `_distill/*`）、不随仓库分发、每次跑都重写 ⇒ 行号天然会变，判 FAIL 会得到永远红的噪声闸门。★ **两层语义**：**本引用所在小句**（分隔符同 (c)：`。！？；，、（）()[]|`）内含「已登记失效」标记 `已失效|待修|已知失效|原为|原记|已登记|已废弃` ⇒ 只列 backlog 不判 FAIL（同 `check-tp-prose` ④ 的语境豁免，但粒度收到**小句**）；★ 词表守卫：同一小句里出现 **≥3 个不同标记** ⇒ 那是**词表**不是登记、**不豁免**（否则**本闸门自己的说明行**会把自己**永久豁免** —— 「匹配判据可被无关文本满足」）；★★ **2026-10-06 两次收紧（本判据先后犯过两次同一形态的病）**：① **整行 → 小句** —— 旧版整行粒度下，一行只要**顺口**写了「禁止照抄任何**历史**海报的构图」，该行引用就被整行豁免（实测 swiss-motion 的 SKILL.md 第 30 行）；现要求标记**与引用同小句**，且**故意不用「距引用 ≤40 字符」**（小句已足够紧、又能保住「已登记待修的（a.js 第 1 行、b.js 第 2 行）」这种**列举式登记**，距离判据会误伤它）；② **剔除泛词「历史」、补「已登记/已废弃」** —— 「历史」是**普通词**（「公司历史」「历史海报」），与被引对象失效**无语义绑定**（「原为/原记」保留：本仓「原文保留 + 追加更正」的固定用语）。★ **夹具实测**：fx1a（行含「历史海报」但与引用无关）改前 **backlog** ⇒ 改后 **(b) FAIL**；fx1c（「已登记待修」在**同行的别的小句**里）改前 **backlog** ⇒ 改后 **FAIL**；fx1b（「已登记待修」与引用**同小句**）改前改后**都 backlog**（**未误伤**）。★ **真实语料**：唯一被整行豁免的 hd-2d 的 SKILL.md 第 196 行（它说 mux.sh 第 60 行有 `LN_TP = -1.7`，而 `LN_TP` 实际在 mux.sh 第 94 行、第 60 行只是注释）改前 **backlog** ⇒ 改后 **(c) FAIL** —— 该行的「原记」指的是**旧真峰值读数**、**不是**这条引用，属真阳性。★ **(a) 报错文案订正**：旧版对裸文件名失败写「**全库也没有同名文件**」，而「全库」其实只有 `styles/` 树（`treeIndex(STYLES)`）—— 实测 scifi-toon 的 SKILL.md 引裸名「sfx.py 第 9 行」被判「全库没有」，而 `core/audio/sfx.py` **确实存在**（同段上文自己就写了全路径）⇒ 现如实说明「按**文件名**只搜过『本风格树 + `styles/` 全树』，**没有**按文件名搜 `core/`/`scripts/`/`tools/`」并给出修法；★ **判据不扩到 `core/`**（扩了就是头注释里否决过的 basename 跨树模糊匹配、会命中错文件）。★ **引用形态补逗号组**：行号可写 N / N-M / N/M / **N-M,K,…**（逗号分隔组，**每段都核**）—— 旧正则 `((?:[-/]\d+)*)$` 里没有 `,` ⇒ 这类引用**整个不被识别**（实测 scifi-toon 的 SKILL.md 第 76 行引 story.js 的 1-6 与 66）。★ **误报率（先测再收窄）**：先 `grep … | grep ','` 摸清真实语料，新增被识别的引用 **155 条**（本项目 DOCS 范围内 **142** 条），形态分布 `N,N` 79 / `N-N,N-N` 17 / `N,N,N` 17 / `N,N-N` 12 …，**逐条核对 155/155 全是行号组、0 误吃**（a.js 与 b.js 这种两段仍不匹配，因为正则锚 `^…$` 整串）；**真实语料新增 FAIL = 0**（改动前后同为 a0/b0）。★ **真实语料对照（同一快照）**：引用 3655 → **3797**、解析到 3552、进入 (c) 仍 37；FAIL 0 → **1**（唯一新增即上面的 hd-2d 那条，**可解释**）、只列不判 215 → 245（logs 198 → 229，新增的都是逗号形态的日志行号组）。非风格级文档里的**多义引用**（`demo/test.js:9` 全库 9 处同名）与风格级文档里的**欠指明引用**（`mux.sh:151`，本风格树里没有但全库有 12 处）也只列不判。★ **失明守卫**：扫描范围**一个引用都没找到** ⇒ FAIL 并明说「**本闸门已失明**」；引用都解析不到文件也判失明。★ **验证（临时树 + 覆盖点，绝不动真实仓）**：`fx-ok`（`scripts/style-distill.mjs:331` 的 `--ratio 16:9`，正确）**exit 0**；`fx-b-range`（`:999`）**exit 1 + (b)**；`fx-b-file`（引用一个**不存在的文件**）**exit 1 + (a)**；`fx-b-content`（`:305`，**行号在范围内但内容不对** —— 即本会话真实的漂移形态）**exit 1 + (c)**；`fx-blind`（无引用）**exit 1 + 「本闸门已失明」**；`fx-registered`（行号超范围但该行写了「已登记待修」）**exit 0 且列入 backlog**；**(d) 的 5 个夹具（2026-10-06 补）**：`fx-A`（指向**空行**）**exit 1 + (d)**、`fx-B`（指向 `---`）**exit 1 + (d)**、`fx-C`（行号 = 实际行数 + 1，**幻影行**）**exit 1 + (d)**、`fx-D`（**区间引用**起点落空行 ⇒ 那 3 处无害写法的形态）**exit 0**（**不许抓**）、`fx-E`（正常引用）**exit 0**；同轮还验了 `fx-F`（**0 引用**）**exit 1 + 「本闸门已失明」**（失明守卫未被 (d) 破坏）与 `fx-G`（`***` / `___` / 围栏）**(d) 3 处**。★ 同轮真实语料实测 (d) 命中 **13** 处、**逐条核对误报 0**（逐条清单与「真内容在哪一行」见 `scripts/check-ref-lines.mjs` 头注释）。真实语料首跑：**3652** 处引用 / **3436** 处解析到文件 ⇒ (a) **2**、(b) **24**、(c) **10**，只列不判 **217**（logs 198 / 多义 10 / 欠指明 6 / 已登记 4）—— 其中 `MAINTAINING.md:328` 的 `` `scripts/style-distill.mjs:189` `` 正是本会话那次漂移的残留。★ **已知局限**：(c) **覆盖面窄**（真实语料只有 **37/3652** 处落在判据内，多数引用的小句里只有别的引用/路径/slug/散文）—— **有意的取舍：宁可少判、不可乱报**；启发式（非 AST），**不加反引号**的引用只列进 backlog 盲区、不被核对；风格源码树被**重构成多模块**的老文档（`ascii-crt`/`one-line`/`scifi-toon` 等把 `main.js` 拆成若干模块）会报大量「行号超范围」，那是**真失效**但修法是重写引用。★ (d) 的已知局限：只管「**那一行有没有内容**」、不管「内容对不对」（被引行是正文但写的是别的东西 ⇒ (d) 看不见，那是 (c) 的活，而 (c) 只覆盖少数引用 ⇒ 两条合起来仍有缝）；**区间引用整个不判**（代价：区间起点落空行这类无害写法必须放过 ⇒ 区间型失效也一并放过）；「结构性行」只认 `-{3,}` / `*{3,}` / `_{3,}` / `` `{3,} ``（不认 `~~~`、不认 `#` 标题行、不认纯标点行）。覆盖点 **`LEMO_TOOLS_ROOT`** / **`LEMO_OPUSCAR`** / **`LEMO_STYLES_ROOT`** / **`LEMO_DISTILL_ROOT`**。★★ **2026-10-07 新增第三类 backlog「裸引用(未被核对)」**：本闸门**只认反引号包裹**的引用 ⇒ 正文里**不带反引号**的「路径 + 冒号 + 行号」此前**一条都不被核对**（不计入引用计数、不进 (a)(b)(c)(d)、**也不出现在任何输出里**）⇒ 后人会把「引用失效 0 处」误读成「引用已清零」。现照 `logs` 的写法把它们**列进 backlog**（**只计数 + 可 `--list-backlog` 逐条列出出处与原文片段**，**一律不判 FAIL、不影响退出码**），并在输出里**明说这是盲区**（原文：「别把『引用失效 0 处』读成『引用全对』」）。★ **判据一个字没动**（**不许**把裸引用纳入 (a)(b)(c)(d)）：按 (a)(b)(d) 判实测**精度仅 ≈33%**，失败是**结构性**的（`siblingPaths` 只收反引号片段 ⇒ 只写 basename 的裸引用必然解析到同名错文件）。★★ **2026-10-07 订正（b84-b：上面「不许纳入」的结论被推翻）**：`lib/dub-styles.json` 纳入扫描范围后**重测**，裸引用**其实可判** —— 46 处按 (a)(b)(d) 判得**真阳性 20 / 失败 2 / 多义 24**；给数据文件按 `"id"` 分块喂**风格上下文**后多义 58→29、暴露 **3 处真失效 + 1 处跨风格误报**。★ **收窄（先测再收窄）**：裸引用**不加锚**（嵌在正文里、不是整串），但**扩展名首字符须为字母**（一条规则挡「地址+端口」「数值比」两类假阳）；扫描前先把**反引号片段整段挖成等长空格**（与主判据共用 `codeSpans()`）⇒ 已核对的引用不会被重复算成裸引用 ⇒ **假阳 24 → 1**（唯一残留 = 跨风格同名，已按**写作侧**写全路径）。★ **两层语义照用**：新增 `BARE_KNOWN`（键 = `相对路径|片段`、**不含行号**以免漂移）登记存量；**未登记且 (a)(b)(d) 失败 ⇒ FAIL**。★ **口径代码**：`const BARE_REF = /([A-Za-z0-9_][A-Za-z0-9_./\\-]*\.[A-Za-z][A-Za-z0-9_]*):(\d+)((?:[-/,]\d+)*)/g;`（对**挖洞后的行**跑 `matchAll`）；反引号引用走锚定版 `REF = /^([A-Za-z0-9_][A-Za-z0-9_./\\-]*\.[A-Za-z0-9_]+):(\d+)((?:[-/,]\d+)*)$/`。★ **失明守卫加第 ③ 条**：`lib/dub-styles.json` 在、却 `dubRefCount===0` 或 `dubBareCount===0` ⇒ 判失明（**文件不在时不判** —— 否则 `test/gate-blindness.test.mjs` 的 `ref`/`ref2` 夹具树会误红；代价：数据文件被删**不**触发本条，靠「引用一个都没找到」兜）。★★ **2026-10-07 订正（b84-b 第三轮：把守卫②从「数据计数」换成「源码标记」，根治镜像脆弱点）**：上面「`dubBareCount===0` ⇒ 判失明」**已降级** —— ① 覆盖守卫改成**合计口径** `dubRefCount + dubBareCount === 0`（「把反引号引用也改成裸引用」正是本仓**推荐**的写作方向，旧口径会**假红** ⇒ 假红诱使后人**删掉守卫** ⇒ 判据静默丢失）；② `dubBareCount === 0` **不再判 FAIL**，只打一行 `ℹ`（「本次 0 处裸引用 —— 可能是已全部改写成反引号引用，那是合法方向」）；③ 取代它的是**源码标记守卫**：读**本闸门自己的源码**（先剔掉 `//`、`/*`、`*` 开头的注释行），要求裸引用判据的三个**自造标识符**标记**同时存在** —— `BARE_REF` 的正则定义 / `bPush(`（裸引用判 FAIL 的唯一出口）/ `bareChecked++`（真被 (a)(b)(d) 核过的计数），且三个标记**必须用字符串拼接写**（如 `'const BARE_' + 'REF = '`），免得守卫的**字符串字面量自己满足自己**（那会是一条**假守卫**）；再用**内联探针**做一次**行为自证**（现役 `BARE_REF` 必须认得出探针（`__b84b_self_test__.mjs` 的第 12 行））⇒ 防「正则被收窄成匹配不到任何东西」。**为什么换**：**代码改动是显式可见的、数据改动是静默的**，守卫要钉在「不会偷偷变」的那一侧。④ 变异实测（`D:/lemo-tmp/b84-b/mutate2.mjs`，**4/4 ✓**）：摘掉裸引用判据整段 ⇒ **exit 1 且点名**（`裸引用判据的关键代码标记不见了`，语义未退化）；数据里 40 处裸引用全改成反引号引用 ⇒ **exit 0 + ℹ**（合法改写不再假红）；数据里 11 处反引号引用全改成裸引用 ⇒ **exit 0**（守卫① 合计口径仍成立）；b84-a 那种极简夹具树（无数据文件）⇒ **exit 0**（不误伤）。⑤ **残留洞（已如实登记在脚本头注释，不粉饰）**：把整段塞进 `if (false) { … }` 变成**死代码**时**挡不住**（标记还在文本里、只是不执行）；`/* … */` 块注释包整段同理；标记是**静态文本、不是 AST** ⇒ 后人**重命名** `bPush`/`bareChecked` 会**假红**（需同步改 `BARE_MARKERS` —— 这是刻意的取舍：假红显式可见、一改就好，比假绿静默丢判据好）。⑥ **自我攻击实测**（`self-attack.mjs`）：`//` 整段注释 ✓ 抓得住、正则收窄 ✓ 抓得住（内联探针）、只把 `bPush(` 调用点改名 ✓ 抓得住、`if (false)` ✘ **抓不住**、删段+塞 decoy ✘ 不抓（**主动造假**，不在守卫职责内，且标记是自造标识符 ⇒ **无关代码满足不了**）。★ **数据侧**：46 处裸引用逐条实测 —— **19 处原样保留**（实测已对）/ **21 处改正**（路径补全 / 行号按测量改 / 改指同名真文件）/ **6 处改成符号·片段形态**（不再依赖行号）。★ **实测**：`引用 4613 / 解析 4271 / 裸引用 48（已核 43 / 未进判据 5）/(a)(b)(c)(d) 全 0 / 退出码 0`。★ **数据文件缺失时不再静默**：`lib/dub-styles.json` 不在时打一行 `ℹ` 说清「这个已声明的覆盖目标本次一份都没检查」，表头明细也**按存在性**列它（保证「明细求和 == 总数」，不再出现「总数 181 / 明细 180」）；**不判 FAIL、不改退出码**（极简夹具树里允许缺它）。★ **正则与假阳收窄**：形态与 `REF` 同形但**不加锚**，且**扩展名必须以字母开头** —— 一条规则同时挡掉「地址 + 端口」与「数值比（对比度 2.5 比 1）」两类假阳；实测**宽松版 305 处 → 收窄后 295 处**，挡掉的 10 处全是这两类、**零误伤**。★ **已知残留假阳（不修，只记）**：本闸门自己的「引用形态示例」被它的说明副本（本表这一行、`_distill/AGENT-BRIEF.md`）带进语料（**同步前**本行 9 + 那份 6；同步后 7 + 5），形态上没法区分。★★ **2026-10-07 更新（配对根修后）**：它们**不再落进裸引用 backlog**、而是**进了引用计数**（其中 3 处会造成 (a) 假红，已按**写作侧**改成非引用形态）；现在落在「**多义(无法核对)**」backlog（**只列不判、不产生假红**）。**取舍不变**：宁可多列，也不收窄到漏掉真引用。★★ **掩码口径（2026-10-07 根修：改为 CommonMark 等长配对）**：配对由「**顺序配对**」（正则找「反引号 … 下一个反引号」，**不要求长度相等**）换成 **CommonMark 的「等长反引号串配对」** —— 连续的 N 个反引号开启 code span、由**后面最近的、恰好 N 个**闭合；找不到等长闭合的开启串**不是 code span**（按普通文本处理）。★ 为什么必须换：一行里只要出现**双/四反引号**或**孤立（不成对）的反引号**，顺序配对就**整行错位**，后果是**双向**的 —— ① 有的引用**漏出掩码**、被**误列成裸引用**（假阳）；② 有的**被吃掉**（既不计入引用、也不进 backlog，假阴）。★ **实测（真实语料，同一台机同一时刻；两套配对的**全量 dump 逐条集合比对**，不是只比总数）**：本行有 **442 个反引号 = 428 段反引号串**，顺序配对配出 **221** 段、CommonMark 配出 **211** 段（`AGENT-BRIEF.md` 那份是 164 vs 156）；全语料 **引用 4548 → 4560（唯一键 +10）、解析到文件 4214 → 4219、进入 (c) 45 → 46、裸引用 20 → 8（−12）、多义 17 → 24、只列不判 354 → 349、(a)(b)(c)(d) 全 0 → 全 0、退出码 0 → 0**（★ 这是**文档同步后**、可**当场复现**的同一语料对照；文档同步**之前**同一比对为 **裸引用 23 → 8（−15）**，差的 3 处正是下面「写作侧同步」改掉的那 3 个示例引用）。★ **零丢失**：旧有新无 = **0 条**（旧配对认得、新配对不认的**一条都没有**）、新有旧无 = 10 条；**零新增假阳**（裸引用新有旧无 = 0 条）。★★ **那批「被误报成裸引用」的**（**同步前**测 = 本行 9 + `AGENT-BRIEF.md` 那份 6，共 **15**；**同步后现测** = 本行 7 + 那份 5，共 **12**）**逐条**全是「闸门说明行里的**引用形态示例**」；配对改对后它们**不再进裸引用 backlog**：其中 **12** 处**进了引用计数**（落到「多义(无法核对)」backlog，只列不判），另 **3** 处按**写作侧**改成**非引用形态**。★ **必须同时剥一层「引用一个 code span」的引号**（本仓固定写法）：纯 CommonMark 下那种写法是**一个** code span、其内容**带反引号** ⇒ 锚定的引用判据**不认**它、那条引用会**消失**；剥一层后旧有新无 = 0 条（**不做这步会丢 2 条**）。★ **写作侧同步 3 处**：说明行里 3 个示例引用（两处 `foo.js` + 一处 `scripts/does-not-exist.mjs`，**都带行号**）改对配对后会变成 **(a) 假红**（它们**本来就不是真引用**）⇒ 按「正确修法是写作侧」改成**非引用形态**，改完 (a) **0 处**；其余 **12** 处示例引用落到「多义(无法核对)」backlog（**只列不判、不产生假红**）。★ **判据一个字没动**：(a)(b)(c)(d) 的内容、`REF`、`HIGH_CONF`、小句切分、token 匹配全部未改；改的只有**反引号片段的配对（掩码）口径**这一处（主判据 / (c) 与同小句片段 / 裸引用掩码**三处共用同一个函数**）。★ **夹具（覆盖点指到临时树，绝不动真实仓；对照 = 改动前的副本）**：A（双反引号 code span + 真裸引用）改前 **引用 1 / 裸引用 3**（其中一个双反引号里的引用被**误列成裸引用**）⇒ 改后 **引用 2 / 裸引用 2**（**真裸引用仍被逐条列出**）；B（孤立反引号，整行 3 个）改前 **引用 3 / 裸引用 1**（其中一条是顺序配对**凭空造出的** code span）⇒ 改后 **引用 2 / 裸引用 1**；C（空片段）与 D（正常行）改前后**逐字一致**；E（0 引用）改前后**都 exit 1 + 「本闸门已失明」**。。★ **夹具 `fx-bare`**：真裸引用（含一处**明显失效**的「文件不存在 + 行号超范围」）**被列出**、两类假阳**不被列**、**exit 0**★★ **2026-10-07 逐条核过这 8 处盲区 —— 它们不是「8 条待核对的引用」，而是「8 条**结构上就不是点引用**的串」**：7 处在 `lemo-make.mjs` 的注释里（`audio/foley.py` 第 12 行、`music/score.py` 第 9 行、`mix.py` 第 9 行、`game-show/demo/music.py` 第 24 行、`living-screencast/demo/sound.py` 第 200 行、`main.js` 第 11 行、`main.js` 第 12 行），写法是**泛化的模式描述**（「WSL 侧 `audio/foley.py` 的直读输入」），**故意不点明是哪个风格** —— 而 `main.js` 全库 41 处同名、`build.sh` 35 处同名 ⇒ 补反引号只会把它们从「裸引用盲区」搬进「**多义(无法核对)**」backlog，**一条也不会被真核对**；第 8 处是 `_distill/AGENT-BRIEF.md` 里**明确标注**「这一串故意不加反引号」的**形态示例**。⇒ **实际盲区里「能被核对却没被核对」的真引用 = 0 条**，**不要把 8 这个数当 TODO 读**。★ 本段**刻意用「路径 + 第 N 行」**写这些路径：写成反引号包裹的「路径 + 冒号 + 行号」会把说明文字变成**真引用**（本项目踩过），不加反引号又会变成**新的裸引用** —— 把两者拆开是唯一稳妥的写法。（新类不影响退出码）。★★ **2026-10-07（#7）再纳入第二个数据文件 `lib/dub-visual.json`**（证据层；实测 **16 处**引用：反引号 5 + 裸 11）。首跑**命中 10 处真失效（(b) 6 + (d) 4）/ 误报 0 ⇒ 精度 100%**，逐条人读后**全部改对**（行号按实测改正 + 补反引号 + 补目录，符合写作纪律第 12 条）；另**手工核出 7 处「行号在范围内、但那一行不是它说的东西」**（(a)(b)(c)(d) **四条都抓不到**，正是第 11 条末尾那条缝）—— 其中 6 处是 `injectionApi` 的 `evidence` **系统性指错**（指到任意行而非 setter 的定义行：blueprint 的 38 改 48、dark-keynote 的 504 改 519、dataviz 的「208,10」改 18、microgame 的 32 改 42、risograph 的 29 改 39、swiss-motion 的「30,27」改 38）、1 处是 ukiyoe 的 `cartouche` 指到注释行（print.js 的 262 改 278）；另 6 处是「路径指到 12–21 行的页面契约加载器、真身在 film.js」。**守卫**：新增**第二个数据文件覆盖守卫**（与 `dub-styles.json` 同型：文件在、却**反引号 + 裸合计为 0** ⇒ 判失明），**只在它存在时判**（夹具树里没有它 ⇒ 不误伤）；`test/gate-blindness.test.mjs` 配套 **1 条用例（正向 + 2 阴性 + ★自证）**。 | ~1 秒（2026-10-07 扩源码后实测 0.81–0.83 秒 ×3）|
| `scripts/check-line-endings.mjs` | **「行尾卫生」闸门**（守 `D:/lemo-opuscar` 那次 **38 个风格废掉 21 个** 的根因）。★ 由来：2026-10-06 日批，该仓**没有 `.gitattributes`** 而本机是**系统级 `core.autocrlf=true`**（工作区平时只靠 `.git/config` 的**本地** `false` 才勉强保持 LF）⇒ **新 clone 全仓 CRLF**（实测 1295 个已跟踪文件 `w/crlf`）⇒ 两侧 `core/` 字节不一致 ⇒ **编排器拒绝开工**（19 个 A 类硬拒 + 2 个音频链被并发会话 SIGTERM），并让两个闸门**假红**：`check-render-venc`（正则要**裸 `\n`**，CRLF 匹配不上 ⇒ 10 个风格被判「找不到块」）、`check-dual-copy-sync`（报源文件漂移 **1161** 处）。`.gitattributes` 是当天才补的，**但没有任何闸门在守它** —— 谁哪天删掉/改坏它、或往仓里塞一个 CRLF 文件，都不会有任何闸门响 ⇒ 立此闸门。★★ 判据五条：**J1** 仓根 `.gitattributes` 存在，且对登记的 **14 个文本扩展名**（`py mjs js cjs sh html css json md txt srt csv yml gltf`）+ `.gitignore`/`.gitattributes` 逐个 `git check-attr text eol` 验证 **git 实际生效**的 attr 是 **`text ∈ {set,auto}` 且 `eol=lf`**（★ **必须同时看 `text`**：把 `*.js text eol=lf` 改写成 `*.js binary`（`-text`）后，兜底那行 `* text=auto eol=lf` **仍把 `eol` 报成 `lf`** ⇒ **只看 `eol` 会假绿**；实测 `git check-attr text eol -- x.bin` ⇒ `text: unset` / `eol: lf`）。**J2** `git ls-files --eol` 里**被判为文本**的路径不许出现 `w/crlf` / `w/mixed`（另报 `i/crlf`/`i/mixed` 与「被判为文本却 `attr/-text`」）—— ★ **按 `--eol` 的标记区分、绝不按字节扫**：`attr/-text` 那组（jpg/bin/woff2/mp4）**二进制里本来就可能含 0x0D**（实测 `core/assets/polyhaven/*.jpg` 就含 318 个已跟踪文件带 CR）⇒ 按字节扫会**大量误报**。**J3** ★★ **字节级「隐形漂移」**：对已跟踪文件比「工作区字节」与「`git show HEAD:<path>` 字节」，**去 CR 后相同、原样不同** ⇒ 报出（`git status` **看不见**的那种，本仓**真实存在过**：`creative/dub-probe/_tx_payload.js` 15 个 CR、`film-hooked.js` 535 个 CR）。★ J3 **不按扩展名过滤**（扫描集 = **全部**已跟踪文件）—— 这正是它**独立于 J1/J2** 的地方：后两者只认 `TEXT_EXT` 清单，对「新塞进来的 `.toml`/`.ts` 一类 CRLF 文件」**都瞎**，而 J3 只看「是否**只差 CR**」，与扩展名无关；二进制**不会**因此误报（未改动 ⇒ 与 HEAD **逐字节相同**直接跳过；真改过内容 ⇒ 去 CR 后也不相同）；★ **必须排除 `attr/eol=crlf` 的路径**（本仓 `*.bat`/`*.cmd`）—— 它们**工作区 CRLF、blob 存 LF 是设计如此**（clean 过滤一律把 CRLF 归一成 LF 入库），不排除就会把 `lemo-make.bat` / `start-console.bat` 报成「隐形漂移」（实测误报 **2/10 = 20%**，已修）。**J4** 失明守卫（仓根不存在 / 没有 `.git` / `git` 不可用 / `git ls-files` 枚举到 **0 个**已跟踪文件 ⇒ **FAIL 并明说「本闸门已失明」**，绝不静默 OK）。**J5** backlog 两层语义（命中 `BACKLOG` 只列不判 FAIL，同 `check-render-venc` 的 B 类）—— ★ **本表当前故意为空**：唯一已知的真阳性（`creative/dub-probe/*.js`）**正在被别的智能体修**，把它登记进 backlog 就等于「**为了让闸门变绿而放宽判据**」，明令禁止。★ 覆盖**两个仓**：`opuscar`（默认 `D:/lemo-opuscar`，覆盖点 **`LEMO_OPUSCAR`**，与 `check-render-venc`/`check-mux-selection` 同名同义）与 `tools`（默认**本仓根**，覆盖点 **`LEMO_TOOLS_ROOT`**，与 `check-doc-coverage` 同名同义；该仓有**合法的 CRLF 例外** `*.bat`/`*.cmd` ⇒ 按 **`eol=crlf`** 判、并要求被跟踪的这类文件工作区**确实是 `w/crlf`**（写成 LF 同样报 —— 那是**反方向**的行尾病，cmd.exe 对 LF-only 解析不可靠）；★ 该例外**只在该扩展名于本仓真的存在时**才要求，避免对只用 `.bat`、没有 `.cmd` 的仓过严）。★★ **真实语料首跑（误报率实测）**：`opuscar` 1681 个已跟踪 / 1363 个判为文本 ⇒ **0 违规**（★ 会话开始时实测到的 2 个真阳性 `creative/dub-probe/{_tx_payload.js,film-hooked.js}` **已被并行的另一智能体修掉**，本闸门当时**如实报出**、未放水）；`tools` 280/280 ⇒ **8 处真阳性**（`lib/style-dna/{one-line,pictogram-motion,pixel-rpg,risograph,rubber-hose,scifi-toon,shadow-puppet,silent-film}.json`：工作区 CRLF、blob LF、`git status` **干净**、`update-index --refresh` 后**仍干净**）—— 逐条核对**误报 0**（8 条全是「只差 CR」的隐形漂移，`md5(去CR(工作区)) == md5(去CR(HEAD blob))` 而 `md5(工作区) ≠ md5(blob)`）。★★ **反向验证**（夹具全在 `D:/lemo-tmp/agent-eolgate/`，覆盖点指向夹具、**全程不动真实仓**）：`fx-ok`（合法 LF 仓）**exit 0**；`fx-noattr`（**无** `.gitattributes`）**exit 1 / J1 17 条**；`fx-eolcrlf`（`eol` 被改成 `crlf`）**exit 1 / J1 16 条**；`fx-crlf-text`（文本写成 CRLF）**exit 1 / J2+J3**；★ `fx-bin-cr`（**二进制**含 0x0D，`*.bin binary`）**exit 0 —— 不误报**；★ `fx-hidden`（`.toml` 的 CRLF，**J1/J2 都瞎、只有 J3 看得见**）**exit 1**；`fx-blind-empty`（是 git 仓但 0 个已跟踪文件）/ `fx-blind-nogit`（无 `.git`）**exit 1 + 「本闸门已失明」**；`fx-tools-ok`（`.bat`=CRLF）**exit 0**；`fx-bat-lf`（`.bat` 被写成 LF）**exit 1**。★ **已知局限**：只守**已跟踪**文件（`.gitignore` 排除的 `node_modules/**`、`demo/out/**`、`*.log` **不在判据内** —— 它们本就不入库、也不参与「两侧 `core/` 一致」）；文本/二进制的边界是**扩展名清单**（新增一类文本扩展名如 `.toml` 而没往 `TEXT_EXT` 里补 ⇒ **J1/J2 看不见**，此时只剩 J3 兜底）；J1 只探**登记的**扩展名；J3 对含换行的路径**失明**（`cat-file --batch` 按 `\n` 分行，本两仓无此路径）；**只读**（不 add / commit / checkout / reset，修法只在输出里给）。★ **实现坑（本机实测）**：`spawnSync('git', …)` **一律 `EBUSY`**（连 `git --version` 都失败）⇒ 必须用**异步 spawn**（同 `check-dual-copy-sync.mjs` 头注释记的 `wsl.exe` 那条）；`git cat-file --batch` 的 stdin **必须 `end()`**（否则子进程等 EOF 不返回）。覆盖点 **`LEMO_OPUSCAR`** / **`LEMO_TOOLS_ROOT`**；`--repo opuscar\|tools` 可只跑一个 | ~4 秒 |

> ★ **为什么底衬要两个检查器**：`check-dub-styles.mjs` 算的是**模型值**（`plateColor` 与背景单层合成），
> 对「底衬色被填错 ASS 字段」这类问题是**盲的** —— 实测它曾在 12/25 个风格实际不可读时仍报 25/25 通过。
> 像素级检查器是**真值**，两者缺一不可。
> ★ 像素检查器的**绝对色差只作粗筛**：渲染链有 YUV 往返，高饱和色会掉饱和（偏差与饱和度正相关），
> 所以决定性判据是**品红标记色测试**而不是绝对色差。

> ★ **本轮（2026-10-04）「补测试」当场抓出的两个真缺陷**（都是加测试/加闸门时冒出来的，不是改功能改出来的）：
> 1. **`triple-check` 的 `--max-frames 1` 会崩** —— `sampleTimes` 降采样分支的 `step = (n-1)/(maxFrames-1)`
>    在 `maxFrames === 1` 时分母为 0 ⇒ `step = Infinity` ⇒ `picks[NaN] === undefined` ⇒ 抽帧循环里
>    `p.t.toFixed(2)` 抛 `TypeError`。**可达性**：`verifyTriple:392` 的 `Math.max(1, …)` 让 `--max-frames 1`
>    正好落到 1，且 `:394` 的 `if (!picks.length)` 拦不住（length === 1）。
>    已修：`maxFrames === 1` 时取**中位那一帧**作唯一代表（比首/尾更能代表全片），空计划仍返回 `[]`；由回归用例钉住。
> 2. **词表同 bucket 内重复触发词会虚增命中数** —— `lib/dub-semantic.mjs:165` 的 `hits()` 是**逐词 `n++`**，
>    而 `rank():178` 排序第一键是 `b.n - a.n` ⇒ 同一个词写两遍给该 tag **虚增 +1 命中**
>    （实测「讲一讲清朝的历史，那个朝代的故事」时 `theme.历史` 的 n = **3 含重复 / 2 去重**），
>    在命中数接近的竞争里足以翻盘 top-5 主题排序。已删掉 3 处重复词
>    （`历史:朝代` / `博物:图谱` / `开阔:辽阔`），测试从「冻结现状」升级为「**不许存在**」的硬不变量。
> ⇒ 两条都印证同一件事：**「现状冻结」式的断言会把缺陷固化成基线**，该修的要修成不变量。

### 相关的库（三条通路的读取入口）

| 库 | 说明 |
|---|---|
| `lib/style-skill-reader.mjs` | 风格 Skill 文档的**唯一读取入口**（`lemo-make.mjs` / `dub.mjs` 共用）。★ 2026-10-03 **扩面**：`summarizeStyleSkill` 此前只暴露 9 个字段（完整度 / 匹配度 / 三个**条数**），通路连「本风格成片的真峰值/响度」「画幅帧数」以及**缺陷正文说了什么**都读不到 ⇒ 现在补上 `scoreBreakdown` / `audio`（真峰值·响度·LRA·是否达标）/ `video`（宽高·fps·帧数·时长·字节）/ `defects`（**正文**，避坑知识全在这）/ `resolvedDefectCount`。`describeStyleSkill` 会把评分明细、交付口径、前 3 条缺陷正文一并打印 —— 「优先读 Skill 文档」才真正落到决策上。仍是**只读 + 缺失即 null**，不新增抛错路径 |
| `lib/style-dna-reader.mjs` | 风格特质**数值**入口（`grain` / 字幕折行 / **响度目标**）。★ 注意 `targetLufs` 是从 `mix_rules` 的**中文散文**里正则抽的 —— 抽不到就静默回落默认值，由 `check-loudness-targets.mjs` 兜 |
| `lib/vram.mjs` | ★ **出片前的显存预检 + 自动腾挪**（`dub.mjs` 的 TTS 之前、`core/render/video.mjs` 的渲染之前各插一处）。单一职责接口：给定「需要多少 MiB **空闲**显存」→ 返回「是否可用」。行为固定三步：① 查当前空闲显存（`nvidia-smi --query-gpu=memory.used,memory.total`，**不用** `-lms` / `--query-compute-apps` / `torch.cuda.mem_get_info()`，理由见文件头）；② **不足才**自动腾挪（复用 `lib/triple-check.mjs` 的 `unloadModel()` + 把 LM Studio 报为 `loaded` 的其余模型一并卸掉）后**重查**；③ 仍不足 ⇒ 如实报 `ok:false` + **可操作文案**，文案与 `core/tts/tts_indextts.py` 的 `precheck_vram()` **逐条同口径**（当前可用 / 需要 / 差额 / 两条出路）。★ **两个消费者对「仍然不足」的处理故意不同**（`onShort`）：**dub.mjs 的 TTS 前硬拦**（TTS 是「显存不够就静默挂死一个多小时」的那一步）；**`core/render/video.mjs` 的渲染前只腾挪、不中止**（编排器 `lemo-make.mjs` 把「音频链（含 Index-TTS）」与「渲染」用 `Promise.all` **并行**跑，TTS 占着 6.9GB 时可用显存本来就只有几百 MiB ⇒ 硬拦会把**主题通路**整个打断，而渲染实测峰值增量仅 ~1.5GB、不是会静默挂死的那一步）。★ **够用时零噪声**（真腾挪了才打日志：腾了什么、腾出多少）。★ 为什么必须它：dub 的 TTS 在 **WSL** 里跑，2026-10-05 之前 `INDEXTTS_MIN_FREE_MIB` **传不进**那个 Windows python（WSL→Windows 不传环境变量，已实测）⇒ `core/tts/tts_indextts.py` 把 TTS 拦下来之后**没有任何自动出路**，从 dub 路径唯一的出路曾是**人工腾显存**。★ 现在**阈值本身**已能传到 python 侧（外层把它翻译成 `--min-free-mib=` argv，见下节），但**自动腾挪**仍只能在这里做 ⇒ 本库照旧必需。真实事故：LM Studio 常驻 7B 把显存吃到 7GB ⇒ Index-TTS **静默挂死一个多小时**。★ **2026-10-07 更新：不足文案里多一段 `GPU 占用者:` best-effort 诊断**（`gpuOccupants()`，跑 `nvidia-smi --query-compute-apps=pid,process_name,used_memory`，按**进程名**聚合成「名字 × 个数」，最多 6 行、附一个示例 pid）。**由来**：原先只说「差多少 MiB」+「LM Studio 没有常驻模型可卸」，运维必须**手工**跑 `nvidia-smi` + `tasklist` 才知道真相 —— 当天实测是**另一个项目**的 3 个 `chrome-headless-shell` + 桌面浏览器占着，而原文案里「最常占的是浏览器」只是**猜**的。★ **只报名字与个数、绝不报 MiB**：本机是 **WDDM**，`used_memory` 一律 `[N/A]`（实测），报 MiB 就是编；文案里也印了这句说明，免得读者以为这是完整信息。★ 并明确提示「若其中有**别的项目**的进程（不是 lemo 的）**不要杀** —— 要么等它跑完、要么用 ② 显式放行」。★ **纯诊断、零判据改动**：门槛 / `relax` / `onShort` / 通过-拒绝判定 / 函数签名**全部未动**；**够用时输出逐字节不变**（实测 md5 相同，带不带 `LEMO_VRAM_DEBUG` 都比过）；`nvidia-smi` 查询失败 / 超时（5s）/ 退出码非 0 / 解析不了 ⇒ 这一段**整段消失、逐字退回原文案**，**不抛异常、不改退出码**。★ 这是**有意给编排器通路加可运维性**，`lemo-make.mjs` 本身**未动**。 ★ 拿不到显存读数（没有 `nvidia-smi`）⇒ **跳过并说一声**，绝不把预检本身变成出片的新失败点 |

### 显存预检的环境变量（`lib/vram.mjs`）

| 变量 | 默认 | 作用 |
|---|---|---|
| `INDEXTTS_MIN_FREE_MIB` | `6700` | **dub 通路 TTS 前的预检阈值**。与 `core/tts/tts_indextts.py` 的 `VRAM_MIN_MIB` 是**同一个变量、同一个默认值** ⇒ 两边口径天然一致。★ `0` = **两边都关**这道检查。★ 2026-10-05 起该变量**也能到 python 侧**：`core/tts/tts_indextts.py` 的外层把它翻译成 `--min-free-mib=` 交给内层（WSL→Windows 不传环境变量，只能走 argv，见下）⇒ `0 < 值 < 6700` 时 Node 与 python **两侧同时放宽**（不再是「只放宽 Node、python 仍按 6700 拦」） |
| `LEMO_RENDER_MIN_FREE_MIB` | `3000` | **渲染前的预检阈值**（`core/render/video.mjs`）。实测 `styles/one-line/demo --fps 2 --workers 1` 渲染期间占用 **982 → 峰值 2453 MiB**（增量 ~1471），取 ≈2× 余量以覆盖更重的风格与默认 3 workers。设 `0` = 关 |
| `LEMO_NO_VRAM_FREE` | 未设 | `1` = **只查不腾**（跳过自动卸载，只报不足）。用于「我就是不想让它动我的模型」 |
| `LEMO_VRAM_DEBUG` | 未设 | `1` = 显存**够用时也打一行读数**（默认零噪声） |
| `LEMO_VRAM_MODULE` | 按平台 | 覆盖 `lib/vram.mjs` 的位置（`core/render/video.mjs` 靠动态 `import()` 加载它：Windows `file:///D:/lemo-tools/lib/vram.mjs`、WSL `/mnt/d/lemo-tools/lib/vram.mjs`） |
| `LEMO_LMSTUDIO_BASE` | `http://127.0.0.1:12345` | LM Studio 服务地址（与 `lib/triple-check.mjs` **同源**，不另立一份） |

> ★ 纪律：**只在不足时才动**别人的模型（显存本来就够时一个字都不打、更不会去卸载）；
> 真腾挪了**必须打出来**（自动动作要可回溯）；**成功路径零噪声**。

### Index-TTS 内层配置的 argv 通路（`core/tts/tts_indextts.py`，2026-10-05）

`core/tts/tts_indextts.py` 是**两层**结构：**外层**（你启动的那个 python；dub 通路在 WSL 里）用
`Popen([host_path(PYTHON), …, '--inner', …])` 借 WSL interop 起**内层**（便携版自带的 Windows venv
python）。★ 实测：这一跳 **WSL→Windows 完全不传环境变量**（`env=` 传的是 `dict(os.environ)` 的完整
副本也没用）⇒ 凡「内层读」的变量，用户在任一侧设都**不生效**（「假逃生口」）。

⇒ 四个「内层读」的变量改由外层翻译成 **argv**（映射表 `INNER_OPTS`）：

| 环境变量 | 内层参数 | 内层全局（默认值） |
|---|---|---|
| `INDEXTTS_ENGINE` | `--engine=` | `ENGINE`（`v2_5`） |
| `INDEXTTS_QUANT` | `--quant=` | `QUANT`（`bf16`） |
| `INDEXTTS_DEVICE` | `--device=` | `DEVICE`（空 = 自动） |
| `INDEXTTS_MIN_FREE_MIB` | `--min-free-mib=` | `VRAM_MIN_MIB`（`6700`） |

- 外层**没设**的项**不带参数** ⇒ 内层保持自己的默认值（于是 **Windows 侧设的环境变量**也仍然有效 —— 实测能进内层）。
- 生效值打在内层 `tts_indextts.py: 内层配置 —— engine=… quant=… device=… min_free_mib=…` 一行上，任何一次跑都能当场核对。
- 非法值**明确报错**（非 0 退出，不静默回落）：`ENGINE ∉ {v2_5, v2}`；`MIN_FREE_MIB` 非整数或为负（负值会**静默**关掉显存预检，所以拦下）。
- `HOME` / `APP` / `PYTHON` / `REF_DIR` / `VOICE_LIB` / `TIMEOUT` / `STALL_TIMEOUT` / `LOCK*` 是**外层读**，在 WSL 里 `export` 即有效。

