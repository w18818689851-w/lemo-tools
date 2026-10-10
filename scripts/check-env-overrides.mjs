#!/usr/bin/env node
/**
 * scripts/check-env-overrides.mjs —— **环境变量覆盖点的「登记表 + 双向守卫」闸门**
 *
 * ★ ① 由来（2026-10-07，补一个**已由多批实测确认的缺口**）：
 *   本项目靠一批**环境变量覆盖点**（`LEMO_*` 等）把「闸门 / 测试夹具」重定向到**临时树**，
 *   从而做到「非破坏验证」（不设覆盖点时必须逐字节等价于真实仓，见 `test/cases.mjs` 第 ③ 段的
 *   ⑤ 条断言）。**但没有任何东西保证这些覆盖点还在** —— 谁哪天把某处 `process.env.X` 删掉 /
 *   改名，**没有任何断言会响**，而夹具会**静默地跑在真实仓上**（= 假绿 + 可能真破坏）。三个实证：
 *     · `test/cases.mjs` 里有一张**用例内联的** `OVERRIDES` 表（约 `:866`），只覆盖 `scripts/` 下
 *       **3 个**脚本 + `lib/voices.mjs` 的 `LEMO_VOICE_TEST_TMP`；它断言「这些脚本仍含
 *       `process.env.<VAR>`」⇒ 它**就是这个守卫的雏形**，但只覆盖 **4 个文件**。
 *     · 2026-10-07 给 `lib/voices.mjs` 加了覆盖点 `LEMO_VOICE_TEST_TMP`，**当时没有任何东西守着它**
 *       ⇒ 只能**手工**补进上面那张表（提交 `3413bc4`）。
 *     · `LEMO_FILM_DIR`（`lib/env.mjs` 的 `exportDir`）曾**被硬编码**过一段时期 ⇒ 导致
 *       「同一成片根两套口径」、并让并行的两个 `test/briefs.test.mjs` **互撞**。
 *   本闸门把「覆盖点存在」这件事从**手工登记**升级为**机械守卫**，且是**双向**的。
 *
 * ★★ ② 判据（双向，缺一不可）：
 *   ① **未登记 ⇒ FAIL**：扫**规定范围内的源码**，抽出所有 `process.env.<NAME>`（**先剥注释与字符串**，
 *      见 ③），凡 `<NAME>` **既不在 `OVERRIDES` 也不在 `EXTERNAL`** ⇒ **FAIL**，报出
 *      **文件:行 + 变量名**，提示「新覆盖点要登记」。
 *   ② **登记了但没了 ⇒ FAIL**：对 `OVERRIDES` 里**每一条的每一个 reader 文件**，断言它**仍在**那个
 *      文件里（用**同一套** `extract()` 在**剥注释与字符串后**的文本里找**同名**的 `process.env.<VAR>`）
 *      ⇒ 否则 **FAIL**，报「覆盖点被删了 / 改名了 / 文件没了」。
 *      ★ 比 `test/cases.mjs` 那张表的 `code.includes('process.env.'+VAR)` 更严两处：
 *        ① 用**剥注释与字符串后**的文本 ⇒ 「只在注释/字符串里提了一句」**不算**覆盖点还在；
 *        ② 用**标识符边界**而不是 `includes` ⇒ 实测 `includes` 会被**前缀更长的改名**骗过
 *          （`'…LEMO_OPUSCAR_X'.includes('…LEMO_OPUSCAR')` 为 **true** ⇒ 判据②不响，假阴）。
 *      ★ 为什么按**每个 reader** 判、而不是「至少一个还在」：覆盖点的**风险恰恰是「某一个闸门悄悄
 *        丢了它」** —— 那时**只有那一个闸门**的夹具会静默跑在真实仓上，其它 12 个照样绿。
 *   ③ **ℹ 新读者未登记（只列不判）**：扫到的 `(文件, 变量)` 对若**不在** `OVERRIDES` 的读者清单里
 *      ⇒ 只列一行 ℹ（`EXTERNAL` 的变量同理列出其读者）—— **不判 FAIL**。
 *      为什么要有这条：① 是**按变量名**判的 ⇒ 给一个**已登记**的变量**新增**一个读者文件时，
 *      ① ② 都不会响，登记表的读者清单会**静默过期**（那是假阴）。这条把它变成**显式可见**的提示。
 *      两条纪律（照 `check-mux-parity.mjs` 的 `KNOWN_DIVERGENCES` / `check-render-venc.mjs` 的 B 类）：
 *      **已登记 ⇒ 只列；没登记 ⇒ FAIL**；**绝不为了让闸门变绿而放宽判据**。
 *   ④ **失明守卫**：扫到 **0 个** `process.env.*` / **0 个**待扫文件 / 登记表为空 ⇒ **FAIL 并明说
 *      「本闸门已失明」**（否则「0 处未登记」会被读成「都登记了」—— 本项目反复治过的「0 对象却全绿」）。
 *
 * ★★ ③ 「剥注释」的核法（**本项目踩过的坑，两处都踩过**）：
 *   · 坑一：**把解释某变量没人读的注释当成消费者** ⇒ 必须剥注释。实证：`lib/env.mjs` 的 `//`
 *     注释里写着 `process.env.LEMO_LIB_WSL` / `LEMO_LIB_WIN`（那是**说明文字**，不是读者）。
 *     ★ 2026-10-09 补：同日「库根两口径」收敛后，`lib/env.mjs` 的 `CFG.wslLib` / `CFG.winLib`
 *     **也真的读**这两个变量了（真代码在 `CFG` 定义处）⇒ 该文件现在是它们的**真读者**（已登记）；
 *     但上面这条实证仍成立 —— 该注释本身**不是**读者，**剥注释的判据必须保留**。
 *   · 坑二：**粗剥会把真代码吃掉**。实测：`test/cases.mjs` 同款的三步粗剥（先正则删块注释、再删
 *     行尾 `//`）在本仓会**吃掉 12 处真命中** —— 其中 6 处是**真代码**
 *     （`dub.mjs:64` 的 `LEMO_VENC`、`lemo-make.mjs` 的 `INDEXTTS_MIN_FREE_MIB`、`style-scan.mjs`
 *     的 `LEMO_STYLES_ROOT` / `LEMO_STYLE_FP_FILE`、`server.mjs:66-68` 的三个 `LEMO_CONSOLE_*`）。
 *     根因有两条：① 某行注释里出现「斜杠 + 星号」⇒ 粗正则把它当块注释起点、**一路吃到下一个
 *     「星号 + 斜杠」**；
 *     ② 字符串里的 `//`（如 `'http://…'`、正则 `/…\/\//g`）⇒ 整行被截断。
 *   ⇒ 本闸门用**状态机**逐字符扫，识别 `'` `"` 反引号字符串（**含模板串 `${}` 里的代码 —— 那部分
 *     是**真代码**，必须保留**，实测 `lemo-make.mjs:2179` 的 `process.env.PATH` 就在 `${}` 里）、
 *     `//` 行注释、块注释（星号 + 斜杠 配对）、正则字面量。**注释区与字符串区一律替换成空格
 *     （换行保留 ⇒ 行号不变）**。
 *   ★ 为什么连**字符串字面量**也剥：字符串里提到 `process.env.X` 同样是「不是消费者」。实证：
 *     `scripts/check-render-venc.mjs:250` 的错误文案、`scripts/patch-render-venc.mjs` 的 6 处
 *     **补丁体字面量**里都写着 `process.env.LEMO_VENC` —— 它们**不读**这个变量（补丁脚本是往**别的**
 *     文件里**写**这一行）；`LEMO_VENC` 在 lemo-tools 树里的**真读者只有** `dub.mjs` 与
 *     `scripts/check-selfcheck-claims.mjs`。不剥字符串就会凭空多出 2 个「假读者」。
 *   ★ 剥前/剥后实测（真实语料 75 个 .mjs）：**原始 116 处 → 剥后 106 处**，被剥掉的 **10 处**
 *     **逐条人读全部是注释/字符串**（2 处注释 + 8 处字符串），**0 处真代码被误剥**。
 *
 * ★★ ④ 扫描范围（**含 / 不含库仓的取舍**）：
 *   · **纳入**：本仓 `lib/**`、`scripts/**`（递归）与**仓根** `*.mjs`（非递归，含 `server.mjs` /
 *     `lemo-make.mjs` / `dub.mjs` / `consistency-check.mjs` / `originality-audit.mjs`）。
 *     实测 **75 个文件 / 106 处 / 47 个变量**。
 *   · ★ **不纳入**库仓 `D:/lemo-opuscar` 的 `core/**`、`tools/**`（实测那边只有 **10 个 .mjs**、
 *     **10 个变量**：`LEMO_GPU` / `LEMO_ANGLE` / `LEMO_RENDER_MIN_FREE_MIB` / `LEMO_VRAM_MODULE` /
 *     `LEMO_VRAM_DEBUG` / `LEMO_VENC` / `PLAYWRIGHT_CHROME` / `RENDER_SLOT_DIR` / `RENDER_SLOTS` /
 *     `RENDER_SLOT_HELD`）。取舍理由（**如实写明代价**）：
 *       ① **性质不同**：那些是**渲染/编排的运行时配置旋钮**（显存阈值、渲染槽、GPU 后端），**不是**
 *          「把闸门/夹具重定向到临时树」的覆盖点 —— 而后者正是本闸门存在的理由；
 *       ② **跨仓成本**：纳入就得同时守 `LEMO_OPUSCAR` 与 WSL 侧，且 `RENDER_SLOT_*` 这类**外部/运行时**
 *          语义的两档归类会很含糊 ⇒ 误报风险陡增（本项目纪律：**宁可少判、不可乱报**）；
 *       ③ **已有覆盖**：那边在**出片路径**上的编码决策点（`LEMO_VENC` 的读者）已由
 *          `scripts/check-render-venc.mjs` 的 A 类逐文件守着，不靠本闸门。
 *     ⇒ 这是一处**已知盲区**，输出里**显式打出**它（免得那句 ✓ 被读成「全仓 env 都登记了」）。
 *     ★★ **2026-10-07 后续：这条盲区已被 ⑤⑦ 补掉** —— 库仓 `core/**` + `tools/**` 的「**表 ↔ 代码**」
 *     一致性已由判据 ⑤⑥ 守着（`tools/**` **2026-10-07 起并入判据⑤ 同判 FAIL**，见 ⑦）；本条的
 *     「不纳入**本闸门的双向登记表**」依然成立（那 10 个不是「重定向夹具」的覆盖点）。
 *
 * ★ ⑤ 本闸门**不扫自己**（`SELF`）：否则它的**登记表文本**会自己满足判据 ①（「匹配判据可被无关
 *   代码满足」）。也**不扫** `node_modules` / `.git` / `_tmp_*` / `_superseded*` 等目录。
 *   ★ 本闸门**没有** `LEMO_*` 覆盖点 —— 扫描根按**脚本自身位置**推导（`<脚本>/..`），夹具用
 *   「**整棵拷到临时目录**」（同 `check-render-venc.mjs` 的 A 类落点写法 / `test/gate-blindness.test.mjs`
 *   的 `copyGate`），而不是 env 重定向。
 *
 * ★★ ⑦ **库仓侧扩展（2026-10-07，补掉 ④ 自己登记的那条盲区）**：
 *   ④ 显式登记了一条盲区：**库仓 `D:/lemo-opuscar` 的 `core/**` + `tools/**` 不纳入扫描**。
 *   代价是**库仓的环境变量没有任何登记 / 守卫**，而 `core/README.md` 那张**环境变量表**
 *   （`:75-116`）与**代码真在读的变量**之间**没有任何东西守着一致**（早前独立审计实测漏了 15 个、
 *   手工补齐后**照样没有闸门** —— 下次再加一个变量还会漏）。本扩展把那一维也变成**机器可核**：
 *     · **判据 ⑤（表 ↔ 代码，判 FAIL）**：库仓 `core/**` **和** `tools/**` 里**代码真在读**的环境变量
 *       （`.mjs` 的 `process.env.<NAME>` + shell 的 `${NAME:-…}` 形态 + python 的
 *       `os.environ.get('NAME')`），凡**不在** `core/README.md` 环境变量表里 ⇒ **FAIL**（点名变量
 *       + 作用域 + 文件:行）。这正是本项目铁律「**文档声称值 vs 实测值**」在环境变量这一维的落点。
 *       ★ 2026-10-07：作用域**从 core/** 扩到 core/** + tools/****（原先 tools/** 只列不判 ⇒ 挡不住
 *         下一次再漏；见 ⑦）。
 *     · **判据 ⑥（反向，只列不判）**：表里列了但 `core/**` 与 `tools/**` 的代码**都不读** ⇒ 只列 ℹ
 *       —— 有些是**外部约定**（实测 4 个：`HF_ENDPOINT` 由 `huggingface_hub` 库自己读；
 *       `LEMO_OPUSCAR_HOME` 的读者在
 *       `plugin/skills/lemo-opuscar/scripts/setup.sh`（**core/tools 作用域之外**）；
 *       `RENDER_MIN_FREE` 与 `INDEXTTS_MIN_FREE_MIB` 是**动态取值**（见下 ⑧）。
 *     · **判据 ⑦（`tools/**` 侧 ⇒ 2026-10-07 起并入判据⑤、同判 FAIL）**：
 *       原先 `tools/**` 读的变量**只列 ℹ 不判**（实测 10 个不在表里：`LEMO_LIB` / `FONT_CACHE` /
 *       `FONT_SUB_TMP` / `FONT_STAGE` / `FONT_STAGE_EXTRA` / `FONT_PY` / `FONT_REPORT` /
 *       `FONT_FAILED` / `FONT_OKLOG` / `ONLY_SLUGS`），理由是「`core/README.md` 是 **core 作用域**
 *       的表、改库仓要先问用户」。
 *       ★ 但「只列不判」**挡不住下一次再漏**（判据⑤ 才是可核的那半边）⇒ 用户定案后**已把
 *         `tools/**` 并入判据⑤**：`core/README.md` 新增 `### tools/ environment variables` 小节，
 *         把这 10 个逐条写清（名字 / 默认值 / 作用 / 读者 文件:行）；此后 `core/**` 与 `tools/**`
 *         里真在读的变量**同判 FAIL**（判据⑦ 的「只列」档随之取消，`lib.toolsOnly` 字段移除）。
 *       ★ **不把它们塞进白名单**（那是「为了让闸门变绿而放宽判据」）—— 是**补文档**让判据⑤ 真的能核。
 *     · **判据 ⑧（库仓失明守卫）**：库仓**可达**却一个 env 读取点都扫不到 / 表解析出 0 行 /
 *       找不到 `## Environment variables` 小节 / `tools/**` 下扫到 **0 个待扫文件** ⇒
 *       **FAIL 并明说「本闸门已失明（库仓侧）」**。
 *       ★ `tools/**` 只判「**扫到 0 个文件**」（那必然是路径/过滤坏了）；**不判**「文件在、但
 *         0 个 env 变量」—— 后者可能是 `tools/` 脚本**真的**不再读环境变量（合法内容变更），
 *         判它会变成误报。★ 代价（如实写）：若有人把 `tools/` 的读取点全删了，判据⑤ 在 tools
 *         这一半会**空转**（vacuous true）—— 但 `tools/**` 仍是「有文件」⇒ 不触发失明。
 *   ★ **库仓不可达**（`LEMO_OPUSCAR` 指空 / 目录不存在）⇒ **只打一行 ℹ 说不检查**、**不判 FAIL**
 *     （同 `check-ref-lines.mjs` 对缺失数据文件的做法，见其 `:1357` / `:1365`）。
 *   ★ **库仓根用覆盖点 `LEMO_OPUSCAR`**（与 `check-ref-lines` / `check-render-venc` 同名同义），
 *     **不硬编码** `D:/lemo-opuscar`（否则夹具树里没法重定向）。⇒ 本闸门自己也是
 *     `LEMO_OPUSCAR` 的一个读者，已登记进 `OVERRIDES` 的 readers（判据② 守着它）。
 *   ★ 扫描库仓**不写库仓**（只读）；变异验证只在**临时副本**上做。
 *
 * ★ ⑧ 已知局限（**如实写，不粉饰**）：
 *   · **动态取值看不见**：`process.env[k]` / `process.env['LEMO_' + x]` 这类**非静态名**本闸门
 *     **一律看不见**（正则只认 `process.env.<标识符>`）。实测本仓有 **2 处**：`dub.mjs:933-934`
 *     （把**调用方传入的一批变量名**透传进 python 的 `export` 串）—— 那两处的变量名是**运行期**的，
 *     机械判定不可靠，**有意不判**。⇒ **「本闸门绿灯」≠「本仓没有别的 env 读取点」**。
 *     ★ 库仓侧同型：`core/render/slot.mjs:24` 的 `envNum(name, def, ok)` 用 `process.env[name]`
 *     读 `RENDER_MIN_FREE`、`core/tts/tts_indextts.py:96` 的 `_env_int('INDEXTTS_MIN_FREE_MIB')`
 *     把变量名当**参数**传 —— 两处都是**动态取值**，本闸门看不见（**假阴**，不是误报）。
 *     实测这正是判据 ⑥ 里那 4 条 ℹ 中的 2 条 ⇒ **它们不是「表里多写了」，而是「闸门看不见」**。
 *   · **shell 侧是启发式**：只认「**全大写**（`^[A-Z][A-Z0-9_]*$`）+ 本文件内**无「定义」形式的赋值** +
 *     非 shell 内建」的 `${NAME:-…}` / `${NAME:=…}` / `${NAME:?…}` / `${NAME:+…}` / 裸 `$NAME`。
 *     实测库仓 shell 里 `${CONT:-0}` / `${DEC:-0}` / `${tgt:-}` 这类**文件内局部变量**会被
 *     「本文件内无赋值 / 全大写」两条滤掉（逐条人读确认）。★ 代价：**小写**的 env 输入会被漏。
 *     ★★ 2026-10-07 收窄：「有赋值」原先只认「**行内出现 `NAME=`**」⇒ 把**命令前缀赋值**
 *     （`NAME=值 命令 …`，**不持久**、只传给那个子进程）误当成了定义 ⇒ 漏报
 *     `tools/fetch-fonts.sh:34` 的 `FONT_CACHE`（同文件 `:379` 有 `FONT_CACHE="$CACHE" bash …`）。
 *     现在改为**逐简单命令**判「赋值是不是该命令的唯一内容」（`export`/`local`/`declare`/`readonly`
 *     前缀、多前缀、`2>/dev/null` 等形态都覆盖）—— 详见 `shDefinedNames()` 与 ③④ 的说明。
 *     ★ 局限：**逐行判、不跨行** ⇒ `NAME=值 \` + 下一行命令的**续行**形态判不出来（本项目 6 个
 *     `.sh` 里无此形态）。
 *   · **python 侧只看三种标准形态**（`os.environ.get('X')` / `os.environ['X']` / `os.getenv('X')`）
 *     ⇒ 经**辅助函数 / 表**间接读的看不见（即上面 `_env_int` 那类）。
 *   · **`_` 前缀 = 进程内自设，不是外部输入**（实测库仓 `_LEMO_INDEXTTS_INNER`：`tts_indextts.py`
 *     自己在 `env=dict(os.environ, _LEMO_INDEXTTS_INNER='1')` 里设、再自己读）⇒ 本闸门**不判它**
 *     （否则等于要求文档登记一个「不是输入的东西」），但仍**逐条列出**。
 *   · **剥注释/字符串是启发式（非 AST）**：正则字面量靠「前一个有意义字符」判定，模板串靠 `${}`
 *     括号计数 —— 极端写法（如 `/${/`、嵌套模板里的正则）理论上会错位。**兜底**是判据 ②：真代码
 *     被误剥 ⇒ 那个 reader 在登记表里会**当场报「覆盖点被删了」**（假红可见、一改就好）。
 *   · **`EXTERNAL` 档的读者清单只列不判**（见 ③）⇒ 那些变量消失**不会**让本闸门变红（它们不是
 *     覆盖点，消失不构成「夹具静默跑在真实仓上」）。
 *   · 判据 ① 是**按变量名**判的 ⇒ 只改**读者文件**（把覆盖点从 A 文件挪到 B 文件）时：① 不响、
 *     ② 会响（A 文件里没了）—— 所以挪动**是可见的**；但**新增**读者只在 ③ 里列 ℹ。
 *
 * 用法：node scripts/check-env-overrides.mjs [--json]
 * 退出码：有未登记的变量 / 登记点消失 / 失明 ⇒ 1；否则 0（③ 的 ℹ 不影响退出码）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ★ 扫描根按**脚本自身位置**推导（无 env 覆盖点，见头注释 ⑤）。 */
const ROOT = path.resolve(path.join(HERE, '..'));
/** ★ 本闸门**不扫自己**（见头注释 ⑤）。 */
const SELF = 'check-env-overrides.mjs';
const JSON_OUT = process.argv.includes('--json');
/**
 * ★ 库仓（**另一个仓**）根：用覆盖点 `LEMO_OPUSCAR`（同名同义，与 `check-ref-lines.mjs` 里
 *   `const OPUSCAR = path.resolve(process.env.LEMO_OPUSCAR || …)` 那处 /
 *   `check-render-venc.mjs:165` 一致），**不硬编码** `D:/lemo-opuscar`（否则夹具树里没法重定向）。
 *   默认与 `check-line-endings.mjs:137` 同款：`<本仓>/../lemo-opuscar`。
 */
const LIBROOT = path.resolve(process.env.LEMO_OPUSCAR || path.join(ROOT, '..', 'lemo-opuscar'));
const LIB_CORE = path.join(LIBROOT, 'core');
const LIB_TOOLS = path.join(LIBROOT, 'tools');
const LIB_README = path.join(LIB_CORE, 'README.md');

// ── ★ 剥注释 + 字符串（状态机；行号不变）────────────────────────────────────
//   详见头注释 ③。`codeOnly()` 把「注释 / 字符串字面量 / 正则字面量」区域替换成空格，
//   **但保留模板串 `${...}` 里的代码**（那部分是真代码）。
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', '']);
const REGEX_PREV_WORD = ['return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'void', 'delete', 'instanceof', 'new', 'yield', 'await', 'throw'];

function codeOnly(src) {
  const out = src.split('');
  const n = src.length;
  const stack = [];                                  // 帧：{t:'tpl'} | {t:'expr',depth} | {t:'sq'|'dq'|'regex'}
  const top = () => (stack.length ? stack[stack.length - 1].t : 'code');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0, prevSig = '', prevWord = '';
  while (i < n) {
    const c = src[i], c2 = src[i + 1], t = top();
    if (t === 'code' || t === 'expr') {
      if (c === "'") { stack.push({ t: 'sq' }); i++; continue; }
      if (c === '"') { stack.push({ t: 'dq' }); i++; continue; }
      if (c === '`') { stack.push({ t: 'tpl' }); i++; continue; }
      if (c === '/' && c2 === '/') { const s = i; while (i < n && src[i] !== '\n') i++; blank(s, i); continue; }
      if (c === '/' && c2 === '*') {
        const s = i; i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i = Math.min(n, i + 2); blank(s, i); continue;
      }
      if (c === '/' && (REGEX_PREV.has(prevSig) || REGEX_PREV_WORD.includes(prevWord))) { stack.push({ t: 'regex' }); i++; continue; }
      if (t === 'expr') {
        if (c === '{') stack[stack.length - 1].depth++;
        else if (c === '}') {
          if (stack[stack.length - 1].depth === 0) { stack.pop(); prevSig = '`'; i++; continue; }
          stack[stack.length - 1].depth--;
        }
      }
      if (/\s/.test(c)) { if (c === '\n') prevSig = ''; i++; continue; }
      prevSig = c;
      const wm = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
      prevWord = wm ? wm[0] : '';
      i++; continue;
    }
    if (t === 'sq' || t === 'dq') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if ((t === 'sq' && c === "'") || (t === 'dq' && c === '"')) { stack.pop(); prevSig = "'"; i++; continue; }
      blank(i, i + 1); i++; continue;
    }
    if (t === 'regex') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if (c === '[') { let j = i + 1; while (j < n && src[j] !== ']') { if (src[j] === '\\') j++; j++; } blank(i, Math.min(n, j + 1)); i = Math.min(n, j + 1); continue; }
      if (c === '/') { stack.pop(); prevSig = '/'; i++; continue; }
      blank(i, i + 1); i++; continue;
    }
    // tpl
    if (c === '\\') { blank(i, i + 2); i += 2; continue; }
    if (c === '`') { stack.pop(); prevSig = '`'; i++; continue; }
    if (c === '$' && c2 === '{') { blank(i, i + 2); stack.push({ t: 'expr', depth: 0 }); prevSig = '{'; i += 2; continue; }
    blank(i, i + 1); i++; continue;
  }
  return out.join('');
}

/** 抽静态 `process.env.<NAME>`（只认静态名；`process.env[k]` 看不见 —— 见头注释 ⑥）。 */
const ENV_RE = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
const extract = (text) => {
  const rows = [];
  text.split('\n').forEach((l, i) => { for (const m of l.matchAll(ENV_RE)) rows.push({ line: i + 1, name: m[1] }); });
  return rows;
};

// ── ★★ 库仓侧抽取器（shell / python）—— 详见头注释 ⑦⑧ ──────────────────────
/** shell 内建 / 特殊变量：不是「外部输入」，一律排除。 */
const SH_BUILTIN = new Set(['PATH', 'PWD', 'OLDPWD', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'SHLVL', 'HOSTNAME',
  'IFS', 'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'TZ', 'RANDOM', 'SECONDS', 'LINENO', 'FUNCNAME',
  'BASH_SOURCE', 'BASH_VERSION', 'BASH_REMATCH', 'BASH', 'BASHOPTS', 'SHELLOPTS', 'EUID', 'UID', 'PPID',
  'OPTARG', 'OPTIND', 'OPTERR', 'CDPATH', 'GLOBIGNORE', 'TMPDIR', 'TMP', 'TEMP', 'TERM', 'COLUMNS',
  'LINES', 'EDITOR', 'PAGER', 'MAIL', 'PS1', 'PS2', 'PS4', 'GROUPS', 'DIRSTACK', 'PIPESTATUS', 'REPLY']);
/** 剥 shell 行内注释（**只在引号外**认 `#`；引号内的 `#` 是数据）。 */
function shStripComment(l) {
  let out = '', q = null;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { out += c; if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; out += c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(l[i - 1]))) break;
    out += c;
  }
  return out;
}
/**
 * 抽 shell 侧的**外部输入**。规则（三条同时成立才认，见头注释 ⑧）：
 *   ① 形态是「带默认/必需/替代值的读取」`${NAME:-…}` / `${NAME:=…}` / `${NAME:?…}` / `${NAME:+…}`，
 *      或裸 `$NAME` / `${NAME}`；
 *   ② 名字**全大写**（`^[A-Z][A-Z0-9_]*$`）—— shell 里小写名按惯例是**文件内局部变量**
 *      （实测 `tools/fonts/fetch-extra-fonts.sh:51` 的 `[ -z "${tgt:-}" ]` 就是这么滤掉的）；
 *   ③ 该名字在**同一文件里没有「定义」形式的赋值** —— 否则它是**文件内局部变量**
 *      （实测 `core/render/mux.sh` 的 `CONT` / `DEC` 就是这么滤掉的）。
 *      ★★ **2026-10-07 收窄（修一处漏报）**：原先的判法是「**行内出现 `NAME=`**」就算有赋值 ——
 *        这条**太宽**，把**命令前缀赋值**也当成了定义。shell 语义：`NAME=值 命令 …`（后面还跟着
 *        **命令词**）**只把变量传给那个子进程**、**不持久**，所以它**不是**「本文件内的定义」。
 *        实测反例：`tools/fetch-fonts.sh:379`
 *          `LEMO_LIB="$LIB" FONT_CACHE="$CACHE" ONLY_SLUGS="$ONLY" bash /tmp/fetch-extra-fonts.sh`
 *        ⇒ 老判法把 `FONT_CACHE` 当局部变量滤掉 ⇒ **漏报** `tools/fetch-fonts.sh:34` 那处真读
 *        （`CACHE="${FONT_CACHE:-/opt/fontsrc-cache}"`）。
 *        ★ 现在的判法（`shDefinedNames()`，逐简单命令判）：**赋值必须是这条简单命令的唯一内容**
 *        —— `NAME=值`（唯一内容）/ `export NAME=值` / `declare -x NAME=值` / `local NAME=值` /
 *        `readonly NAME=值` / `NAME=值 2>/dev/null` ⇒ **定义**；
 *        `NAME=值 命令 …` / `A=1 B=2 命令 …`（后面还有**词**）⇒ **不是**定义（命令前缀）。
 *      ★ 例外（两条，都保留）：**自引用的默认值写法** `NAME="${NAME:-…}"` **不算定义** —— 那正是
 *        「读环境变量、给了个默认值」的惯用法（实测 `tools/fonts/fetch-extra-fonts.sh:14` 的
 *        `ONLY_SLUGS="${ONLY_SLUGS:-}"`，该文件头部明确写着 `ONLY_SLUGS` 是**入参（环境变量）**）。
 *        判法：只看**赋值值的开头**（`=` 之后、可选的引号之后）是不是 `$NAME` / `${NAME…`。
 *        ★ **必须只看「值开头」、不能看「整行」**：实测 `core/render/mux.sh:112` 的
 *        `M=$(ffmpeg …) || die "… $(echo "$M" | tail -2)"` —— 行尾**另一条命令**里引用了 `$M`
 *        ⇒ 「看整行」会把 `M` 误判成自引用、进而把 `$M` 当成**外部输入**（实测出 2 个假阳：
 *        `M` / `OUT`）。`export PATH=/usr/local/bin:$PATH` 同型（但 `PATH` 已被 ② 的内建清单挡住）。
 *   ④ **已知局限（如实写）**：判法**逐行**做，**不跨行** ⇒ 「`NAME=值 \` + 下一行 `命令 …`」这种
 *      **续行**形态判不出来（会把 `NAME=值` 当定义；实测本仓 `core/**` + `tools/**` 的 6 个
 *      `.sh` 里**没有**这种形态 —— 所有行尾 `\` 的续行都以**命令词**开头）。同理，一行里
 *      `A=1` 与另一条命令用**换行**而非 `;`/`&&` 分隔时不受影响（本闸门本就逐行扫）。
 */
const SH_ENV_RE = /^[A-Z][A-Z0-9_]*$/;
/** shell 保留字 / 组合前缀：出现在简单命令**开头**时不构成「命令词」（见头注释 ⑧ ③）。 */
const SH_RESERVED = new Set(['if', 'then', 'else', 'elif', 'fi', 'while', 'until', 'do', 'done', 'for',
  'in', 'case', 'esac', 'select', 'function', 'time', 'coproc', '!', '{', '}']);
/** shell 声明内建：其后的 `NAME=…` **一律是定义**（后面还能跟裸名字，如 `local a=1 b c`）。 */
const SH_DECL_KW = new Set(['export', 'local', 'readonly', 'declare', 'typeset']);
/**
 * 把**一行**（已剥注释）按 shell 词法切成 token —— 只服务于「这个 `NAME=` 是不是定义」，不是完整词法：
 *   { t:'assign', name, val } —— `NAME=…` / `NAME+=…`（`=` 紧跟在**词首**的标识符后、未加引号）
 *   { t:'word',   text }      —— 其它词（引号 / `$(…)` / `${…}` 原样收进同一个词）
 *   { t:'op',     text }      —— 顶层操作符（`;` `&` `|` `(` `)` `<` `>` …）
 * ★ 只把**顶层**（不在引号 / `$(…)` / `${…}` / 反引号里）的元字符当操作符 —— 否则
 *   `_size=$(wc -c < "$1" | tr -d ' ')` 里的 `<` / `|` 会被当操作符、把赋值切碎。
 */
function shTokens(l) {
  const toks = [];
  const n = l.length;
  let i = 0;
  while (i < n) {
    const c = l[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === ';' || c === '&' || c === '|' || c === '(' || c === ')' || c === '<' || c === '>') {
      const s = i;
      while (i < n && /[;&|<>]/.test(l[i])) i++;
      if (i === s) i++;                                   // 单个 `(` / `)`
      toks.push({ t: 'op', text: l.slice(s, i) });
      continue;
    }
    const s = i;
    let name = null, valAt = -1, depth = 0, q = null, bt = false;
    while (i < n) {
      const ch = l[i], ch2 = l[i + 1];
      if (q) { if (ch === '\\' && q === '"') { i += 2; continue; } if (ch === q) q = null; i++; continue; }
      if (bt) { if (ch === '\\') { i += 2; continue; } if (ch === '`') bt = false; i++; continue; }
      if (ch === '\\') { i += 2; continue; }
      if (ch === "'" || ch === '"') { q = ch; i++; continue; }
      if (ch === '`') { bt = true; i++; continue; }
      if (depth > 0) { if (ch === '(' || ch === '{') depth++; else if (ch === ')' || ch === '}') depth--; i++; continue; }
      if (ch === '$' && ch2 === '(') { depth++; i += 2; continue; }
      if (ch === '$' && ch2 === '{') { depth++; i += 2; continue; }
      if (/\s/.test(ch) || ch === ';' || ch === '&' || ch === '|' || ch === '(' || ch === ')' || ch === '<' || ch === '>') break;
      if (name === null) {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\+?=/.exec(l.slice(i));
        if (m) { name = m[1]; i += m[0].length; valAt = i; continue; }
        name = '';                                        // 词首不是赋值 ⇒ 整词都是「词」
      }
      i++;
    }
    if (name) toks.push({ t: 'assign', name, val: valAt >= 0 ? l.slice(valAt, i) : '' });
    else toks.push({ t: 'word', text: l.slice(s, i) });
  }
  return toks;
}
/**
 * 从**一行**里抽出「**定义**」形式的赋值名（见头注释 ⑧ ③④）。判法：
 *   ① 按**顶层操作符**切成**简单命令**（`;` `&&` `||` `|` `&` `(` `)`；重定向不算分隔）；
 *   ② 跳过开头的保留字 / 声明内建（`if` / `then` / `export` / `local` …，含 `declare -x` 的 flag）；
 *   ③ 收下紧跟的连续赋值；**这条简单命令以声明内建开头 ⇒ 全是定义**；
 *   ④ 否则看赋值**之后**：只剩操作符 / 重定向 ⇒ 「只含赋值的简单命令」⇒ 定义；
 *      **还剩「词」（命令名 / 参数）⇒ 命令前缀赋值**（只对该子进程生效、**不持久**）⇒ **不算定义**。
 *   ⑤ 自引用的默认值写法 `NAME="${NAME:-…}"` **不算定义**（那是「读环境变量 + 给默认值」，见 ⑧ ③）。
 */
function shDefinedNames(l) {
  const defs = [];
  let seg = [];
  const flush = () => {
    if (seg.length) {
      let i = 0, decl = false;
      while (i < seg.length && seg[i].t === 'word' && (SH_RESERVED.has(seg[i].text) || SH_DECL_KW.has(seg[i].text))) {
        if (SH_DECL_KW.has(seg[i].text)) decl = true;
        i++;
      }
      while (decl && i < seg.length && seg[i].t === 'word' && /^-\w+$/.test(seg[i].text)) i++;   // `declare -x` / `local -r`
      const picked = [];
      while (i < seg.length && seg[i].t === 'assign') { picked.push(seg[i]); i++; }
      if (picked.length) {
        let ok = decl;
        if (!ok) {                                        // ④：赋值之后还有「词」吗？
          ok = true;
          let j = i;
          while (j < seg.length) {
            const tk = seg[j];
            if (tk.t === 'op') {
              if (/^([<>]|&>)/.test(tk.text)) { j++; if (j < seg.length && seg[j].t === 'word') j++; continue; }   // 重定向 + 它的目标
              j++; continue;
            }
            if (/^\d+$/.test(tk.text) && seg[j + 1] && seg[j + 1].t === 'op' && /^[<>]/.test(seg[j + 1].text)) {   // `2>` 的 fd
              j += 2; if (j < seg.length && seg[j].t === 'word') j++; continue;
            }
            ok = false; break;
          }
        }
        if (ok) for (const a of picked) {
          // ★ 只看**值的开头**是不是 `$NAME` / `${NAME…`（自引用的默认值写法，见头注释 ⑧ ③）。
          if (new RegExp(`^\\s*['"]?\\$\\{?${a.name}\\b`).test(a.val)) continue;
          defs.push(a.name);
        }
      }
    }
    seg = [];
  };
  for (const tk of shTokens(l)) {
    if (tk.t === 'op' && !/^([<>]|&>)/.test(tk.text)) flush();
    else seg.push(tk);
  }
  flush();
  return defs;
}
function extractSh(text) {
  const lines = text.split('\n');
  const assigned = new Set();
  for (const raw of lines) {
    for (const name of shDefinedNames(shStripComment(raw))) assigned.add(name);
  }
  const rows = [];
  lines.forEach((raw, i) => {
    const l = shStripComment(raw);
    const push = (name, form) => {
      if (assigned.has(name) || SH_BUILTIN.has(name) || !SH_ENV_RE.test(name)) return;
      rows.push({ line: i + 1, name, form });
    };
    for (const m of l.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*):[-=?+]/g)) push(m[1], 'default');
    for (const m of l.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) push(m[1], 'curly');
    for (const m of l.matchAll(/(^|[^\\$])\$([A-Za-z_][A-Za-z0-9_]*)/g)) push(m[2], 'bare');
  });
  return rows;
}
/**
 * 抽 python 侧 `os.environ.get('X')` / `os.environ['X']` / `os.getenv('X')`。
 * ★ 经辅助函数 / 表间接读的**看不见**（实测 `core/tts/tts_indextts.py:96` 的 `_env_int('INDEXTTS_MIN_FREE_MIB')`）—— 见头注释 ⑧。
 */
const PY_ENV_RE = /(?:os\.environ\s*(?:\.get\s*\(\s*)?\[\s*|os\.environ\.get\s*\(\s*|os\.getenv\s*\(\s*)['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;
function extractPy(text) {
  const rows = [];
  text.split('\n').forEach((l, i) => {
    if (/^\s*#/.test(l)) return;                       // 整行注释不算
    for (const m of l.matchAll(PY_ENV_RE)) rows.push({ line: i + 1, name: m[1] });
  });
  return rows;
}
/** 库仓侧按扩展名选抽取器（`process.env.<NAME>` / shell / python）。 */
const LIB_EXTS = ['.mjs', '.sh', '.bash', '.py'];
function extractLib(rel, text) {
  if (rel.endsWith('.mjs')) return extract(codeOnly(text)).map((h) => ({ ...h, how: 'process.env' }));
  if (rel.endsWith('.sh') || rel.endsWith('.bash')) return extractSh(text).map((h) => ({ ...h, how: 'shell' }));
  if (rel.endsWith('.py')) return extractPy(text).map((h) => ({ ...h, how: 'python' }));
  return [];
}
/** ★ `_` 前缀 = **进程内自设**、不是外部输入（见头注释 ⑧）⇒ 不判、只列。 */
const LIB_INTERNAL = (n) => n.startsWith('_');

/** 库仓待扫文件（递归；`core/**` 与 `tools/**` 分开收集 —— 作用域不同，见头注释 ⑦）。 */
function collectLib(root) {
  const out = [];
  const walk = (dir) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_SEG.test(e.name)) walk(p); continue; }
      if (!e.isFile() || !LIB_EXTS.some((x) => e.name.endsWith(x))) continue;
      out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

/** 解析 `core/README.md` 的 `## Environment variables` 表 ⇒ name -> 行号。 */
function readLibTable() {
  const res = { vars: new Map(), section: false, file: LIB_README, exists: fs.existsSync(LIB_README) };
  if (!res.exists) return res;
  let inSec = false;
  fs.readFileSync(LIB_README, 'utf8').split('\n').forEach((l, i) => {
    if (/^##\s+Environment variables\s*$/i.test(l)) { inSec = true; res.section = true; return; }
    if (inSec && /^##\s/.test(l)) { inSec = false; return; }
    if (!inSec) return;
    const m = /^\|\s*`([A-Za-z_][A-Za-z0-9_]*)(?:=[^`]*)?`\s*\|/.exec(l);   // `VAR` / `VAR=value`
    if (m) res.vars.set(m[1], i + 1);
  });
  return res;
}

// ── 收集待扫文件 ────────────────────────────────────────────────────────────
const SKIP_SEG = /^(node_modules|\.git|out|logs|ref|_superseded.*|_tmp_.*)$/;
function collect() {
  const out = [];
  const walk = (dir, recursive) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (recursive && !SKIP_SEG.test(e.name)) walk(p, true); continue; }
      if (!e.isFile() || !e.name.endsWith('.mjs')) continue;
      if (e.name === SELF) continue;                       // ★ 不扫自己
      out.push(p);
    }
  };
  walk(path.join(ROOT, 'lib'), true);
  walk(path.join(ROOT, 'scripts'), true);
  walk(ROOT, false);                                       // 仓根：非递归
  return [...new Set(out)].sort();
}

// ── ★★ 登记表 · 档 A「本项目覆盖点」（判双向 FAIL）──────────────────────────
//   每条：变量名 → { readers:[谁在读（文件，相对仓根）], what:'它重定向什么' }。
//   ★ 读者清单是**按「名字在真代码里出现」机械抽出**的（剥注释+字符串后，见 ③），
//     所以「同一个覆盖点被 N 个闸门各自读一次」会列 N 个文件 —— 那正是判据 ② 要逐个守的。
const OVERRIDES = {
  // —— 库 / 风格源码 / 成片根 ——
  LEMO_OPUSCAR: {
    readers: ['scripts/check-audio-chain.mjs', 'scripts/check-dual-copy-sync.mjs', 'scripts/check-esm-import-paths.mjs',
      'scripts/check-film-aspect.mjs', 'scripts/check-film-delivery.mjs', 'scripts/check-line-endings.mjs',
      'scripts/check-mux-parity.mjs', 'scripts/check-mux-selection.mjs', 'scripts/check-ref-lines.mjs',
      'scripts/check-render-venc.mjs', 'scripts/check-shell-structure.mjs', 'scripts/check-venc-args.mjs',
      'scripts/patch-style-mux.mjs',
      // ★ 2026-10-10 补：这 4 个闸门也把 `LEMO_OPUSCAR` 当**库仓根覆盖点**（`path.resolve(process.env.LEMO_OPUSCAR || …)`）
      //   ⇒ 补进 readers 让判据② 也守它（原先只在判据③ 里报「新读者未登记」）。
      //   · check-demo-header：按库仓根找 demo 头样式
      //   · check-repro-form：按库仓根找复现表单
      //   · check-sources-paths：按库仓根校验来源路径
      //   · check-target-as-measured：按库仓根找「目标 vs 实测」读数
      'scripts/check-demo-header.mjs', 'scripts/check-repro-form.mjs', 'scripts/check-sources-paths.mjs',
      'scripts/check-target-as-measured.mjs',
      // ★ 2026-10-07：本闸门自己（⑦ 的库仓侧扫描根）也是 `LEMO_OPUSCAR` 的读者。
      //   它**不扫自己**（见 ⑤）⇒ 它**不在**「扫到」的 (文件, 变量) 对里，所以上面那句
      //   「(文件, 变量) 对 差额」会显示 **-1**，那是**预期的**（输出里有一行专门说明）。
      //   登记它的理由：删掉这行 ⇒ 库仓扫描会**静默回落到默认路径** ⇒ 夹具里判据⑤⑥⑦ 会**悄悄消失**。
      'scripts/check-env-overrides.mjs'],
    what: '库仓根（默认 D:/lemo-opuscar）—— 十几个闸门的扫描根，夹具靠它指向临时夹具树',
  },
  LEMO_OPUSCAR_WIN: {
    readers: ['scripts/patch-render-venc.mjs'],
    what: '库仓根（Windows 侧，patch-render-venc 的双副本比对基准）',
  },
  LEMO_STYLES_ROOT: {
    readers: ['lib/styles-root.mjs', 'scripts/check-aspect-declaration.mjs', 'scripts/check-aspect-prose.mjs',
      'scripts/check-audio-chain.mjs', 'scripts/check-dub-styles.mjs', 'scripts/check-film-aspect.mjs',
      'scripts/check-mix-candidates.mjs', 'scripts/check-ref-lines.mjs', 'scripts/check-render-venc.mjs',
      'scripts/style-scan.mjs',
      // ★ 2026-10-10 补：这 2 个闸门也把 `LEMO_STYLES_ROOT` 当**风格源码根覆盖点**
      //   （`process.env.LEMO_STYLES_ROOT || 'D:/lemo-opuscar/styles'`）⇒ 补进 readers 让判据② 也守它。
      //   · check-doc-coverage：按风格源码根核对文档覆盖
      //   · check-header-counts：按风格源码根数头部计数
      'scripts/check-doc-coverage.mjs', 'scripts/check-header-counts.mjs'],
    what: '风格源码根（默认 <库根>/styles）',
  },
  LEMO_STYLES_ROOT_WSL: {
    readers: ['scripts/unblock-placeholder-audio.mjs'],
    what: 'WSL 侧风格源码根',
  },
  LEMO_LIB_WIN: {
    // ★ 2026-10-09 收敛「库根两口径」：`lib/env.mjs` 的 `CFG.winLib` 也改认这个变量（原先硬编码）；
    //   `consistency-check.mjs` 的 `LIB` 改为**读 `CFG.winLib`**（不再自己读 env）⇒ 从读者里**移除**它。
    readers: ['lib/env.mjs', 'lemo-make.mjs'],
    what: '库根（Windows 侧；编排器 CFG.winLib 与 lib/env.mjs 的 CFG.winLib 同名同义）',
  },
  LEMO_LIB_WSL: {
    // ★ 2026-10-09：同上，`lib/env.mjs` 的 `CFG.wslLib` 也改认这个变量（原先硬编码）。
    readers: ['lib/env.mjs', 'lemo-make.mjs'],
    what: '库根（WSL 侧；编排器 CFG.wslLib 与 lib/env.mjs 的 CFG.wslLib 同名同义）',
  },
  LEMO_FILM_DIR: {
    readers: ['lib/env.mjs', 'scripts/check-selfcheck-claims.mjs', 'scripts/prune-jobs.mjs',
      // ★ 2026-10-10 补：`clean-test-residue.mjs` 也把 `LEMO_FILM_DIR` 当**成片根覆盖点**
      //   （`process.env.LEMO_FILM_DIR || 'D:/lemo-films'`；它从成片根派生 `.briefs` / `.console` / `.locks-test`）
      //   ⇒ 补进 readers 让判据② 也守它。
      'scripts/clean-test-residue.mjs'],
    what: '成片根（lib/env.mjs 的 exportDir；★ 曾被硬编码过一段时期，见头注释 ①）',
  },
  // ★ 2026-10-09 追加：测试残留清理工具的**备份目录覆盖点**。
  //   ★ 它是**路径重定向**（把备份落到哪）⇒ 归 `OVERRIDES`（不是外部约定）✓
  LEMO_BACKUP_DIR: {
    readers: ['scripts/clean-test-residue.mjs'],
    what: '★ 测试残留清理工具的**备份根**（默认 `D:/lemo-backup`；**禁止 C 盘**）。'
      + '★ 该工具**默认只预览（dry-run）**，要真删必须 `--apply` + 二次确认，且**备份失败即拒绝删除** ✓',
  },
  // ★ 2026-10-09 追加：**通用资源检测适配模块**（`lib/resources.mjs`）的三个覆盖点。
  //   ★ 三个都是**路径 / 端点重定向**（把「去哪找 / 去哪连」指到别处）⇒ 归 `OVERRIDES`（不是外部约定）✓
  LEMO_RES_DIR: {
    readers: ['lib/resources.mjs'],
    what: '★ 通用资源检测适配模块的**资源根**（默认 `D:\\lemo-res`；**禁止 C 盘**）。'
      + '它是「自动下载的资源一律存到**预先规划好的**文件夹」这条规格的落点 —— 目录结构 = `<root>/<kind>/<id>`，'
      + '下载先落 `<root>/_download/` 中转、校验通过才移入 ✓',
  },
  LEMO_INDEX_TTS_DIR: {
    readers: ['lib/resources.mjs'],
    what: '★ 本地 **Index-TTS** 安装目录（默认 `D:\\Index-tts\\Index-tts_v2.5`）—— 资源检测用它判「本地语音模型是否就位」✓',
  },
  LEMO_LMSTUDIO_URL: {
    readers: ['lib/resources.mjs'],
    what: '★ 本地 **LM Studio** 服务地址（默认 `http://127.0.0.1:12345`）—— 资源检测用它探活'
      + '（**只读健康检查，不做任何推理**；见 `scripts/check-llm-call-sites.mjs` 的例外登记）✓',
  },
  LEMO_TMP: {
    readers: ['scripts/check-plate-pixel.mjs', 'test/originality.test.mjs'],
    what: '★ 临时根（默认 D:/lemo-tmp；**禁止写 C 盘** ⇒ 读者一律「解析到 C 盘就直接炸」）。'
      + '2026-10-08 加：`check-plate-pixel` 原先往 C 盘写临时文件、`originality.test.mjs` 原先用 `os.tmpdir()`（= C 盘）',
  },
  LEMO_FILMS_ROOT: {
    readers: ['scripts/check-film-aspect.mjs', 'scripts/check-selfcheck-claims.mjs'],
    what: '成片根**别名**（与 LEMO_FILM_DIR 同义；留它免得夹具按那个名字重定向时静默仍在读真库）',
  },
  LEMO_LOCK_DIR: {
    readers: ['lemo-make.mjs', 'scripts/check-film-delivery.mjs'],
    what: '编排器锁目录（默认 = 成片根）',
  },
  LEMO_MANIFEST: {
    readers: ['lemo-make.mjs'],
    what: '编排器清单路径（CFG.manifestPath）',
  },
  LEMO_SKILL_ROOT: {
    readers: ['scripts/check-aspect-prose.mjs'],
    what: '风格技能树根（SKILL.md / _distill.json 所在树）',
  },
  // —— 闸门的数据 / 工具覆盖点 ——
  LEMO_DISTILL_ROOT: {
    readers: ['scripts/check-config-vs-doc.mjs', 'scripts/check-derivation-caliber.mjs', 'scripts/check-film-aspect.mjs',
      'scripts/check-film-delivery.mjs', 'scripts/check-mux-parity.mjs', 'scripts/check-ref-lines.mjs',
      'scripts/check-selfcheck-claims.mjs', 'scripts/check-skill-artifacts.mjs', 'scripts/check-skill-film-fields.mjs',
      'scripts/check-skill-scores.mjs', 'scripts/check-tp-prose.mjs',
      // ★ 2026-10-10 补：这 5 个闸门也把 `LEMO_DISTILL_ROOT` 当**风格技能树根覆盖点**
      //   （`path.resolve(process.env.LEMO_DISTILL_ROOT || <默认>)`）⇒ 补进 readers 让判据② 也守它。
      //   · check-demo-header：按技能树根找 demo 头
      //   · check-distill-fields：按技能树根核对 _distill.json 字段
      //   · check-repro-form：按技能树根找复现表单
      //   · check-sources-paths：按技能树根校验来源路径
      //   · check-target-as-measured：按技能树根找「目标 vs 实测」读数
      'scripts/check-demo-header.mjs', 'scripts/check-distill-fields.mjs', 'scripts/check-repro-form.mjs',
      'scripts/check-sources-paths.mjs', 'scripts/check-target-as-measured.mjs'],
    what: '风格技能树（_distill.json）根 —— 16 个闸门共用，夹具靠它指向临时副本',
  },
  LEMO_DUB_STYLES: {
    readers: ['lib/dub-core.mjs', 'lib/dub-semantic.mjs', 'scripts/check-config-notes.mjs', 'scripts/check-config-vs-doc.mjs',
      'scripts/check-derivation-caliber.mjs', 'scripts/check-dna-coverage.mjs', 'scripts/check-skill-scores.mjs'],
    what: '注册表 lib/dub-styles.json 的路径',
  },
  LEMO_DUB_VISUAL: {
    readers: ['scripts/check-derivation-caliber.mjs'],
    what: '证据表 lib/dub-visual.json 的路径',
  },
  LEMO_DUB_CORE: {
    readers: ['scripts/check-dna-coverage.mjs'],
    what: 'lib/dub-core.mjs 的路径（该闸门要从它**源码抽**字段清单）',
  },
  LEMO_DUB_TOOL: {
    readers: ['lib/dub.mjs'],
    what: 'dub.mjs（「文案+口播+风格」工具）的路径',
  },
  LEMO_FFMPEG: {
    readers: ['scripts/check-plate-pixel.mjs'],
    what: 'ffmpeg 可执行文件路径',
  },
  LEMO_FFPROBE: {
    readers: ['scripts/check-selfcheck-claims.mjs', 'scripts/check-skill-artifacts.mjs'],
    what: 'ffprobe 可执行文件路径',
  },
  LEMO_NODE: {
    readers: ['scripts/patch-render-venc.mjs'],
    what: 'node 可执行文件路径（补丁脚本做 `node --check` 自检时用）',
  },
  LEMO_PYTHON: {
    readers: ['lib/voices.mjs'],
    what: 'python 解释器路径（TTS 侧；与 LEMO_VOICES_PYTHON 同义）',
  },
  LEMO_VOICES_PYTHON: {
    readers: ['lib/voices.mjs'],
    what: 'python 解释器路径（优先于 LEMO_PYTHON）',
  },
  LEMO_MAKE: {
    readers: ['scripts/check-audio-chain.mjs'],
    what: '编排器 lemo-make.mjs 的路径（该闸门从它源码抽音频链候选）',
  },
  LEMO_MUX_SH: {
    readers: ['scripts/check-film-delivery.mjs'],
    what: 'core/render/mux.sh 的路径',
  },
  LEMO_BATCH_DIR: {
    readers: ['scripts/check-film-delivery.mjs'],
    what: '批次目录（该闸门找批次记录的位置）',
  },
  LEMO_READINGS_MEASURED_JSON: {
    readers: ['scripts/check-tp-prose.mjs'],
    what: '实测读数 json（真值来源，夹具靠它喂已知读数）',
  },
  LEMO_TP_MEASURED_JSON: {
    readers: ['scripts/check-tp-prose.mjs'],
    what: '真峰值实测读数 json（真值来源）',
  },
  LEMO_ASPECT_PROSE_IGNORE: {
    readers: ['scripts/check-aspect-prose.mjs'],
    what: '该闸门的忽略清单（判据输入覆盖点）',
  },
  LEMO_STYLE_FP_FILE: {
    readers: ['scripts/style-scan.mjs'],
    what: '风格指纹文件路径',
  },
  LEMO_LMSTUDIO_BASE: {
    readers: ['lib/triple-check.mjs'],
    what: 'LM Studio 服务端点（夹具可指向假服务）',
  },
  // —— 开放式 LLM API 配置（`lib/llm-api.mjs`，2026-10-08 新增）——
  //   ★ 规格 §二 的 6 个覆盖点（`_distill/llm-api-接口规格-2026-10-08.md`）；唯一读者是 `lib/llm-api.mjs` 的
  //     `resolveConfig()`。
  //   ★ 2026-10-08 订正：**不要**把 `server.mjs` 登记成读者 —— `/api/llm/*` 的 handler 是**委托**给
  //     `lib/llm-api.mjs` 的（`server.mjs` 自己不再读 `process.env.LEMO_LLM_PROFILE`）⇒ 登记它会立刻
  //     触发判据②「登记了但没了」的**假 FAIL**（实测踩过）。
  //   ★ 与 `LEMO_LMSTUDIO_BASE` 同类：夹具可指向假服务 / 假 key，**不落盘、不改真实配置**。
  LEMO_LLM_PROFILE: {
    readers: ['lib/llm-api.mjs'],
    what: '选哪个 LLM profile（默认 workbuddy）',
  },
  LEMO_LLM_BASE: {
    readers: ['lib/llm-api.mjs'],
    what: '覆盖 LLM baseUrl（夹具可指向假服务）',
  },
  LEMO_LLM_KEY: {
    readers: ['lib/llm-api.mjs'],
    what: '覆盖 LLM apiKey（★ 绝不可写进日志/文件；脱敏只显示前 4 位）',
  },
  LEMO_LLM_MODEL: {
    readers: ['lib/llm-api.mjs'],
    what: '覆盖 LLM model',
  },
  LEMO_LLM_HEADERS: {
    readers: ['lib/llm-api.mjs'],
    what: 'JSON 字符串，合并进 LLM 请求头',
  },
  LEMO_LLM_TIMEOUT_MS: {
    readers: ['lib/llm-api.mjs'],
    what: 'LLM 请求超时（默认 30000；范围 1000–600000）',
  },
  // —— WSL 侧 ——
  LEMO_WSL_ROOT: {
    readers: ['scripts/check-dual-copy-sync.mjs', 'scripts/check-shell-structure.mjs', 'scripts/patch-style-mux.mjs'],
    what: 'WSL 侧库根（默认 /home/lemo/lemo-opuscar）',
  },
  LEMO_WSL_DISTRO: {
    readers: ['scripts/check-dual-copy-sync.mjs', 'scripts/check-shell-structure.mjs', 'scripts/patch-style-mux.mjs'],
    what: 'WSL 发行版名（默认 Ubuntu-24.04）',
  },
  LEMO_VENC_DISTRO: {
    readers: ['scripts/check-venc-args.mjs'],
    what: '真编一帧时用的 WSL 发行版名',
  },
  LEMO_VENC_FFMPEG: {
    readers: ['scripts/check-venc-args.mjs'],
    what: '真编一帧时用的 ffmpeg 路径（WSL 侧）',
  },
  // —— 编码器 / 应用目录 ——
  LEMO_VENC: {
    readers: ['dub.mjs', 'scripts/check-selfcheck-claims.mjs'],
    what: '编码器决策覆盖点（未设 ⇒ h264_nvenc；显式 libx264 ⇒ CPU；其它 ⇒ 报错退出）',
  },
  LEMO_TOOLS_ROOT: {
    readers: ['scripts/check-doc-coverage.mjs', 'scripts/check-line-endings.mjs', 'scripts/check-redline-md5.mjs',
      'scripts/check-ref-lines.mjs', 'scripts/check-shell-structure.mjs',
      // ★ 2026-10-08：`check-llm-api.mjs`（守 `lib/llm-api.mjs` 契约）也读它 —— 被测模块 =
      //   `<LEMO_TOOLS_ROOT>/lib/llm-api.mjs`，供非破坏变异（指向临时夹具树）。
      'scripts/check-llm-api.mjs',
      // ★ 2026-10-10：`check-visible-hints.mjs`（守「用户可见文案不得提及已删控件/已删 profile」）
      //   也读它 —— 它要按 `<LEMO_TOOLS_ROOT>` 定位待扫文件（`lib/llm-api.mjs` / `web/index.html` / `web/app.js`），
      //   同样供非破坏变异（指向临时夹具树）。
      'scripts/check-visible-hints.mjs',
      // ★ 2026-10-10 补：这 8 个闸门也把 `LEMO_TOOLS_ROOT` 当**本仓根覆盖点**
      //   （`path.resolve(process.env.LEMO_TOOLS_ROOT || path.join(HERE, '..'))`）—— 一律是
      //   「按仓根定位待扫文件」的扫描根，夹具靠它指向临时副本 ⇒ 补进 readers 让判据② 也守它。
      //   · check-distill-fields：按仓根 + 技能树根核对字段
      //   · check-gate-self-claims：按仓根核对闸门自述
      //   · check-header-counts：按仓根数头部计数
      //   · check-lib-exports：按仓根校验 lib 导出
      //   · check-no-sync-spawn：按仓根扫同步 spawn
      //   · check-readme-files：按仓根核对 README 列出的文件
      //   · check-resources：按仓根跑资源检测
      //   · check-sources-paths：按仓根校验来源路径
      'scripts/check-distill-fields.mjs', 'scripts/check-gate-self-claims.mjs', 'scripts/check-header-counts.mjs',
      'scripts/check-lib-exports.mjs', 'scripts/check-no-sync-spawn.mjs', 'scripts/check-readme-files.mjs',
      'scripts/check-resources.mjs', 'scripts/check-sources-paths.mjs'],
    what: 'lemo-tools 仓根（本仓自身）',
  },
  LEMO_VOICE_TEST_TMP: {
    readers: ['lib/voices.mjs'],
    what: '应用目录 D:/WSL/voicetest 的覆盖点（2026-10-07 新加；当时**没有任何东西守着它**，见头注释 ①）',
  },
};

// ── ★ 登记表 · 档 B「外部约定 / 非覆盖点」（**只登记、只列，不判 FAIL**）──────
//   判据：**不是**「把闸门/夹具重定向到临时树」的覆盖点 —— 多为**行为开关**或**外部约定**
//   （由操作系统 / 第三方库 / 控制台前端读）。它们消失**不构成**「夹具静默跑在真实仓上」，
//   所以不适用判据 ②（同 `check-render-venc.mjs` 的 B 类 backlog / `check-mux-parity.mjs` 的两层语义）。
//   ★ 仍然登记 `readers`（「谁在读」）：判据 ③ 用它比「新读者」，免得这些变量每次都被报成未登记读者。
const EXTERNAL = {
  // ★ 2026-10-09 追加：**本机智能体网关**的三个外部约定（宿主/网关进程注入；本项目只读来拼 baseUrl 与鉴权，
  //   **不重定向任何路径或工具**）⇒ 按本文件头注释 ③ 归 `EXTERNAL`（只登记、不判 FAIL）✓
  //   ★★ `CODEBUDDY_GATEWAY_PASSWORD` 是**口令** ⇒ 这里登记的只是**变量名**，★ 值**绝不落盘/进日志** ✓
  SERVER__PORT: {
    readers: ['lib/llm-api.mjs'],
    why: '本机智能体网关的**监听端口**（宿主注入；★ 端口**动态**，代码里**不硬编码**）',
  },
  SERVER__HOST: {
    readers: ['lib/llm-api.mjs'],
    why: '本机智能体网关的**监听地址**（宿主注入；缺省 127.0.0.1）',
  },
  CODEBUDDY_GATEWAY_PASSWORD: {
    readers: ['lib/llm-api.mjs'],
    why: '本机智能体网关的**鉴权口令**（宿主注入；★ 只从环境取，**绝不落盘/进日志**）',
  },
  PATH: {
    readers: ['lemo-make.mjs'],
    why: '操作系统的 PATH（把 ffmpeg 目录前置进子进程环境；`process.env.PATH` 在模板串 ${} 里）',
  },
  // ★ 2026-10-09 追加：本机「智能体网关」（CodeBuddy Gateway）的三个外部约定。
  //   ★ 它们是**宿主（网关进程）注入**的，本项目**只读**来拼 baseUrl 与鉴权头，**不重定向任何路径/工具**
  //   ⇒ 按本闸门头注释 ③ 归 `EXTERNAL`（只登记、不判 FAIL）✓
  SERVER__HOST: {
    readers: ['lib/llm-api.mjs'],
    why: '外部约定：宿主注入的本机网关**监听地址**（缺省 127.0.0.1；★ 不重定向路径/工具，只用来拼 baseUrl）',
  },
  SERVER__PORT: {
    readers: ['lib/llm-api.mjs'],
    why: '外部约定：宿主注入的本机网关**监听端口**（★ **动态读**，代码里**不硬编码**；重启可能变）',
  },
  CODEBUDDY_GATEWAY_PASSWORD: {
    readers: ['lib/llm-api.mjs'],
    why: '外部约定：本机网关的 **Bearer 口令**（★ **只从环境取**，**绝不**落盘 / 进日志 / 写进任何文件）',
  },
  WHISPER_MODEL: {
    readers: ['lib/dub-core.mjs'],
    why: '外部约定：faster-whisper / whisper 的模型名（本项目只**透传**给 ASR 子进程）',
  },
  INDEXTTS_MIN_FREE_MIB: {
    readers: ['dub.mjs', 'lemo-make.mjs'],
    why: '本项目的**显存下限阈值**旋钮（读来判「要不要腾显存」，不重定向任何路径/工具）',
  },
  LEMO_ASR_OFFLINE: {
    readers: ['lib/dub-core.mjs'],
    why: 'ASR **离线偏好**开关（读来判行为，不重定向路径）',
  },
  LEMO_VRAM_DEBUG: {
    readers: ['lib/vram.mjs'],
    why: '显存守卫的**调试开关**（`=== "1"`）',
  },
  LEMO_NO_VRAM_FREE: {
    readers: ['lib/vram.mjs'],
    why: '显存守卫的**禁用开关**（`=== "1"`）',
  },
  LEMO_SKIP_STYLE_SCAN: {
    readers: ['dub.mjs'],
    why: 'dub 通路的**跳过风格扫描**开关（`=== "1"`）',
  },
  LEMO_CONSOLE_PORT: {
    readers: ['server.mjs'],
    why: '控制台监听端口（配置项）',
  },
  LEMO_CONSOLE_HOST: {
    readers: ['server.mjs'],
    why: '控制台监听地址（配置项）',
  },
  LEMO_CONSOLE_SIMULATE_ENV: {
    readers: ['server.mjs'],
    why: '控制台**模拟环境**开关（配置项）',
  },
  LEMO_CONSOLE_NO_ENTRY_FILES: {
    readers: ['server.mjs'],
    why: '控制台**不列出入口文件**开关（行为开关）',
  },
  // —— 开放式 LLM API 的「运行时线索」环境变量（`lib/llm-api.mjs`，2026-10-08）——
  //   ★ 规格 §二.3：`kind==='anthropic'` / `'openai-compatible'` 且未显式给 key/baseUrl/model 时，
  //     取官方约定环境变量。**外部约定**（不是「把夹具重定向到临时树」的覆盖点）⇒ 归档 B：
  //     只登记、只列，**不判 FAIL**（同 `WHISPER_MODEL`）。
  //   ★ 2026-10-08 补：`ANTHROPIC_MODEL` / `OPENAI_MODEL` —— team-lead 裁定「否则『环境里有可用模型、
  //     面板却报缺 model』」，模块在 `resolveConfig()` 里也读了这两个（见 `lib/llm-api.mjs` 的
  //     「运行时线索补 model」注释）⇒ 与 key/baseUrl 同类，一并登记为外部约定。
  ANTHROPIC_API_KEY: {
    readers: ['lib/llm-api.mjs'],
    why: '外部约定：Anthropic 官方密钥环境变量（LLM 模块只**透传/读取**，不重定向任何路径）',
  },
  ANTHROPIC_BASE_URL: {
    readers: ['lib/llm-api.mjs'],
    why: '外部约定：Anthropic 官方端点覆盖环境变量',
  },
  ANTHROPIC_MODEL: {
    readers: ['lib/llm-api.mjs'],
    why: '外部约定：Anthropic 官方模型名环境变量（未显式给 model 时的运行时线索）',
  },
  OPENAI_API_KEY: {
    readers: ['lib/llm-api.mjs'],
    why: '外部约定：OpenAI（兼容）官方密钥环境变量',
  },
  OPENAI_BASE_URL: {
    readers: ['lib/llm-api.mjs'],
    why: '外部约定：OpenAI（兼容）官方端点覆盖环境变量',
  },
  OPENAI_MODEL: {
    readers: ['lib/llm-api.mjs'],
    why: '外部约定：OpenAI（兼容）官方模型名环境变量（未显式给 model 时的运行时线索）',
  },
};

// ── 判据 ①：未登记 ⇒ FAIL ──────────────────────────────────────────────────
const files = collect();
const hits = [];                       // {rel, line, name}
const byVar = new Map();               // name -> Set(rel)
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  let txt;
  try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const h of extract(codeOnly(txt))) {
    hits.push({ rel, line: h.line, name: h.name });
    if (!byVar.has(h.name)) byVar.set(h.name, new Set());
    byVar.get(h.name).add(rel);
  }
}
const known = new Set([...Object.keys(OVERRIDES), ...Object.keys(EXTERNAL)]);
const unregistered = hits.filter((h) => !known.has(h.name));

// ── 判据 ②：登记了但没了 ⇒ FAIL ────────────────────────────────────────────
//   ★ 用**标识符边界**判（`extract()` 抽出的名字**逐字相等**），而不是 `includes('process.env.'+VAR)`：
//     `includes` 会被**前缀更长的改名**骗过 —— 实测把 `process.env.LEMO_OPUSCAR` 改成
//     `process.env.LEMO_OPUSCAR_X` 时，`'…LEMO_OPUSCAR_X'.includes('…LEMO_OPUSCAR')` 仍为 **true**
//     ⇒ 判据②**不响**（假阴）。改用同一套 `extract()` 后「改名」照旧被抓。
const gone = [];                       // {name, rel, why}
for (const [name, ent] of Object.entries(OVERRIDES)) {
  for (const rel of ent.readers) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) { gone.push({ name, rel, why: '登记的文件**不存在**' }); continue; }
    let txt;
    try { txt = fs.readFileSync(p, 'utf8'); } catch (e) { gone.push({ name, rel, why: `读不到（${(e && e.message) || e}）` }); continue; }
    if (!extract(codeOnly(txt)).some((h) => h.name === name)) {
      gone.push({ name, rel, why: `文件里已找不到 \`process.env.${name}\`（**被删了 / 改名了**，或只剩注释/字符串里提过）` });
    }
  }
}

// ── 判据 ③：ℹ 新读者未登记（只列不判）─────────────────────────────────────
const fresh = [];
for (const [name, set] of byVar) {
  const reg = new Set([
    ...((OVERRIDES[name] || {}).readers || []),
    ...((EXTERNAL[name] || {}).readers || []),
  ]);
  for (const rel of set) if (!reg.has(rel)) fresh.push({ name, rel });
}
fresh.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

// ── 判据 ④：失明守卫（防空转绿灯）──────────────────────────────────────────
const blind = [];
if (files.length === 0) blind.push(`\`${ROOT}\` 下扫到 0 个 .mjs（路径 / 过滤变了？）⇒ 一个文件都没检查过`);
if (hits.length === 0) blind.push('一个 `process.env.*` 都没抽到（剥注释/字符串的写法变了？）⇒ 本闸门已失明');
if (Object.keys(OVERRIDES).length === 0) blind.push('`OVERRIDES` 登记表为空 ⇒ 判据 ② 一条都没检查');

// ── ★★ 判据 ⑤⑥⑦⑧：库仓（另一个仓）的「表 ↔ 代码」一致性 ────────────────────
//   详见头注释 ⑦⑧。★ 库仓**不可达** ⇒ 只打一行 ℹ、不判 FAIL（同 check-ref-lines 对缺失数据文件）。
const libReachable = fs.existsSync(LIB_CORE);
const lib = {
  reachable: libReachable, root: LIBROOT,
  coreFiles: [], coreHits: [], coreVars: new Map(),       // name -> Set(rel)
  toolsFiles: [], toolsVars: new Map(), toolsHits: [],
  table: { vars: new Map(), section: false, exists: false, file: LIB_README },
  missing: [],        // ★ 判 FAIL：core/** 或 tools/** 的代码在读、但表里没有（scope 标出来源）
  tableOnly: [],      // ℹ 表里有、core/** 与 tools/** 的代码都不读
  internal: [],       // ℹ `_` 前缀：进程内自设
  blind: [],
};
if (libReachable) {
  const coreFiles = collectLib(LIB_CORE);
  lib.coreFiles = coreFiles.map((f) => path.relative(LIBROOT, f).replace(/\\/g, '/'));
  const add = (map, name, rel) => { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(rel); };
  for (const f of coreFiles) {
    const rel = path.relative(LIBROOT, f).replace(/\\/g, '/');
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const h of extractLib(rel, txt)) { lib.coreHits.push({ rel, ...h }); add(lib.coreVars, h.name, rel); }
  }
  for (const f of collectLib(LIB_TOOLS)) {
    const rel = path.relative(LIBROOT, f).replace(/\\/g, '/');
    lib.toolsFiles.push(rel);
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const h of extractLib(rel, txt)) { lib.toolsHits.push({ rel, ...h }); add(lib.toolsVars, h.name, rel); }
  }
  lib.table = readLibTable();
  // ★ 2026-10-07：判据⑤ 的作用域**从 core/** 扩到 core/** + tools/****（原 ⑦ 只列不判 ⇒ 挡不住
  //   下一次再漏）。core 与 tools 里真在读的变量，都必须在 `core/README.md`（含 `### tools/ ...`
  //   小节）里能找到。`scope` 字段只为把「是谁在读」标出来，不参与判定。
  for (const [n, rels] of lib.coreVars) {
    if (LIB_INTERNAL(n)) { lib.internal.push({ name: n, rels: [...rels] }); continue; }
    if (!lib.table.vars.has(n)) lib.missing.push({ name: n, rels: [...rels], scope: 'core' });
  }
  for (const [n, rels] of lib.toolsVars) {
    if (LIB_INTERNAL(n)) { lib.internal.push({ name: n, rels: [...rels] }); continue; }
    if (!lib.table.vars.has(n)) lib.missing.push({ name: n, rels: [...rels], scope: 'tools' });
  }
  // ★ 判据⑥ 的反向：表里列了、但 **core/** 与 **tools/** 的代码都不读 ⇒ 只列 ℹ。
  for (const [n, line] of lib.table.vars) if (!lib.coreVars.has(n) && !lib.toolsVars.has(n)) lib.tableOnly.push({ name: n, line });
  lib.missing.sort((a, b) => (a.name < b.name ? -1 : 1));
  lib.internal.sort((a, b) => (a.name < b.name ? -1 : 1));

  // ── 判据 ⑧：库仓失明守卫（可达却扫不到东西 ⇒ 明说失明）────────────────────
  if (coreFiles.length === 0) lib.blind.push('库仓 `core/**` 下扫到 0 个 `.mjs` / `.sh` / `.py`（路径变了？）⇒ 一个文件都没检查过');
  if (lib.coreHits.length === 0) lib.blind.push('库仓 `core/**` 里一个 env 读取点都没抽到（抽取器写法变了？）⇒ **本闸门已失明（库仓侧）**');
  // ★ 2026-10-07：`tools/**` 并入判据⑤ ⇒ 它**扫到 0 个文件**时判据⑤ 的 tools 那一半会**空转**
  //   （vacuous true，「0 个未登记」是假的）⇒ 也算失明。**只判「0 个文件」**、不判「文件在但 0 个
  //   变量」（后者可能是 `tools/` 脚本真的不再读 env —— 合法内容变更，判它会误报；见头注释 ⑧）。
  if (lib.toolsFiles.length === 0) lib.blind.push('库仓 `tools/**` 下扫到 **0 个待扫文件**（`.mjs` / `.sh` / `.bash` / `.py`；路径 / 过滤变了？）⇒ 判据⑤ 在 `tools/**` 这一半**空转** ⇒ **本闸门已失明（库仓侧）**');
  if (!lib.table.exists) lib.blind.push(`库仓 \`core/README.md\` **不存在**（\`${LIB_README}\`）⇒ 判据⑤⑥ 一条都没跑`);
  else if (!lib.table.section) lib.blind.push('库仓 `core/README.md` 里找不到 `## Environment variables` 小节 ⇒ 判据⑤⑥ 一条都没跑');
  else if (lib.table.vars.size === 0) lib.blind.push('库仓 `core/README.md` 的环境变量表**解析出 0 行** ⇒ **本闸门已失明（库仓侧）**');
}
const libFail = lib.missing.length > 0 || lib.blind.length > 0;

// ── 期望值（本闸门自己的口径）──────────────────────────────────────────────
const regVars = Object.keys(OVERRIDES).length + Object.keys(EXTERNAL).length;
const realVars = byVar.size;
const regPairs = [...Object.values(OVERRIDES), ...Object.values(EXTERNAL)].reduce((a, e) => a + e.readers.length, 0);
const realPairs = [...byVar.values()].reduce((a, s) => a + s.size, 0);   // 去重后的 (文件, 变量) 对

const ok = unregistered.length === 0 && gone.length === 0 && blind.length === 0 && !libFail;
// ★ 本闸门自己**不扫自己**（见 ⑤）⇒ 它作为 `LEMO_OPUSCAR` 读者的那一条**不在**「扫到」里 ⇒ 差额 -N 是预期的。
const selfReaders = [...Object.values(OVERRIDES), ...Object.values(EXTERNAL)]
  .reduce((a, e) => a + e.readers.filter((r) => r === `scripts/${SELF}`).length, 0);

if (JSON_OUT) {
  console.log(JSON.stringify({
    root: ROOT,
    scope: { files: files.length, hits: hits.length, vars: realVars },
    expect: { registeredVars: regVars, registeredPairs: regPairs, realPairs, overrides: Object.keys(OVERRIDES).length, external: Object.keys(EXTERNAL).length },
    unregistered: unregistered.map((h) => ({ file: h.rel, line: h.line, name: h.name })),
    gone,
    freshReaders: fresh,
    blind,
    library: lib.reachable ? {
      root: lib.root,
      scope: { coreFiles: lib.coreFiles.length, coreHits: lib.coreHits.length, coreVars: lib.coreVars.size,
        toolsFiles: lib.toolsFiles.length, toolsHits: lib.toolsHits.length, toolsVars: lib.toolsVars.size },
      table: { file: lib.table.file, exists: lib.table.exists, section: lib.table.section, vars: lib.table.vars.size },
      missingFromTable: lib.missing,
      tableOnly: lib.tableOnly,
      internal: lib.internal,
      blind: lib.blind,
    } : { reachable: false, note: `库仓不可达（${lib.root}）⇒ 只打 ℹ、不判 FAIL` },
    ok,
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
  process.exit();
}

// ── 输出 ────────────────────────────────────────────────────────────────────
console.log(`仓根 : ${ROOT}`);
console.log(`范围 : lib/** + scripts/**（递归）+ 仓根 *.mjs（非递归）；★ 不扫自己（${SELF}）`);
console.log(`       实测 ${files.length} 个文件 / ${hits.length} 处 process.env.* / ${realVars} 个不同变量`);
console.log(`       ★ 已知盲区：**不纳入**库仓 D:/lemo-opuscar 的 core/** 与 tools/** 的**双向登记表**`
  + '（那些是渲染/编排的运行时旋钮，不是「重定向夹具」的覆盖点）—— 见头注释 ④；'
  + '\n         ★ 但它们的「**表 ↔ 代码**」一致性已由下方「库仓」一节的判据⑤⑥⑧ 覆盖'
  + '（2026-10-07 补；其中 **core/** 与 **tools/** 同判 FAIL**，见头注释 ⑦）');
console.log(`       ★ 已知盲区：**动态取值看不见** —— \`process.env[k]\` / \`process.env['X' + y]\` 不判`
  + '（实测本仓 2 处：`dub.mjs:933-934` 透传调用方给的变量名，见头注释 ⑧）');
console.log(`       ★ 库仓侧（另一个仓）：\`core/**\` + \`tools/**\` 的 env 读取点见下方「库仓」一节`
  + `（扫描根覆盖点 \`LEMO_OPUSCAR\`，默认 ${LIBROOT}）`);
console.log('');
console.log(`★ 期望值：登记 ${regVars} 条（覆盖点 ${Object.keys(OVERRIDES).length} + 非覆盖点 ${Object.keys(EXTERNAL).length}）`
  + ` / 真实语料 ${realVars} 个变量 / **差额 ${realVars - regVars}**；`
  + `(文件, 变量) 对：登记 ${regPairs} / 扫到 ${realPairs} / 差额 ${realPairs - regPairs}（共 ${hits.length} 处出现）`);
if (selfReaders) {
  console.log(`       ★ 其中 ${selfReaders} 个登记读者是**本闸门自己**（不扫自己，见头注释 ⑤）⇒ 不在「扫到」里，`
    + `故差额 -${selfReaders} 是**预期的**（登记它正是为了让判据② 守住「库仓扫描根覆盖点被删」）`);
}
console.log('');

// ★ 失明消息**放在最前**（否则会被下面成片的 ✘ 淹没；失明时「0 处未登记」是假的）。
if (blind.length) {
  console.log('✘✘ 本闸门已**失明**：');
  for (const b of blind) console.log(`   ✘ ${b}`);
  console.log('   ⇒ 「0 处未登记」是**假的**，别信这个绿。请先修路径 / 剥注释写法，再信本闸门的结论。');
  console.log('   ⇒ 已失明 ⇒ 判据②③ 本次**不输出**：在失明的树上它们只会刷屏，且会被误读成「覆盖点被删了」。');
  console.log('');
}

if (blind.length) {
  console.log(`[闸门] 覆盖点登记：**已失明** ⇒ 一条判据都没可信地跑过 ✘`);
  process.exitCode = 1;
  process.exit();
}

if (unregistered.length) {
  console.log(`✘ 判据①·有 ${unregistered.length} 处**未登记**的 process.env（新覆盖点要登记进 OVERRIDES / EXTERNAL）：`);
  for (const h of unregistered) console.log(`   ✘ ${h.rel}:${h.line}  ${h.name}`);
  console.log('   ↳ 若是「把闸门/夹具重定向到临时树」的覆盖点 ⇒ 登记进 `OVERRIDES`（含 readers + 它重定向什么）；');
  console.log('     若只是行为开关 / 外部约定 ⇒ 登记进 `EXTERNAL`（只登记、不判 FAIL）。');
} else {
  console.log('✓ 判据①·扫描范围内所有 process.env.<NAME> 都已登记');
}

if (gone.length) {
  console.log(`\n✘ 判据②·有 ${gone.length} 个**已登记的覆盖点消失**（夹具会静默跑在真实仓上）：`);
  for (const g of gone) console.log(`   ✘ ${g.name}  登记于 ${g.rel} —— ${g.why}`);
  console.log('   ↳ 修法：把覆盖点补回那个文件；若它**确实**已挪到别处/改名，请同步改 `OVERRIDES` 的 readers。');
} else {
  console.log(`✓ 判据②·${regPairs} 个「(覆盖点, 读者文件)」对全部仍在（覆盖点没被删/改名）`);
}

if (fresh.length) {
  console.log(`\nℹ 判据③·有 ${fresh.length} 个**新读者未登记**（只列不判，不改退出码）：`);
  for (const f of fresh) console.log(`   · ${f.name}  出现在 ${f.rel}（登记表的读者清单里没有它）`);
  console.log('   ↳ 把该文件补进对应条目的 `readers`（`OVERRIDES` 或 `EXTERNAL`）—— 让判据②也守它（`EXTERNAL` 档只列不判）。');
} else {
  console.log('✓ 判据③·扫到的 (文件, 变量) 对与登记表的读者清单完全一致（无未登记读者）');
}

console.log(`\nℹ 档 B·外部约定 / 非覆盖点（只登记、只列，**不判 FAIL**）${Object.keys(EXTERNAL).length} 个：`);
for (const [n, e] of Object.entries(EXTERNAL)) console.log(`   · ${n}（读者：${e.readers.join(', ')}）—— ${e.why}`);

// ── ★★ 库仓侧输出（判据 ⑤⑥⑧，详见头注释 ⑦⑧）──────────────────────────────
console.log(`\n══ 库仓（另一个仓）：${lib.root} ══`);
if (!lib.reachable) {
  console.log(`ℹ **不检查**：库仓不可达（\`${LIB_CORE}\` 不存在，或 \`LEMO_OPUSCAR\` 指空）⇒ `
    + '判据⑤⑥⑧ 本次**一条都没跑**（**不判 FAIL** —— 同 `check-ref-lines` 对缺失数据文件的做法）。');
  console.log('   ↳ 想让库仓也受检：设 `LEMO_OPUSCAR=<库仓根>`（夹具树靠它重定向）。');
} else {
  console.log(`范围 : core/** **和** tools/**（判据⑤⑥，**判 FAIL** —— 2026-10-07 起 tools 并入判据⑤）；`
    + `实测 core ${lib.coreFiles.length} 个文件 / ${lib.coreHits.length} 处 / ${lib.coreVars.size} 个变量；`
    + `tools ${lib.toolsFiles.length} 个文件 / ${lib.toolsHits.length} 处 / ${lib.toolsVars.size} 个变量`);
  console.log(`表   : ${lib.table.exists ? lib.table.file : '（不存在）'}`
    + `${lib.table.section ? ' 的 `## Environment variables`' : '（找不到 `## Environment variables` 小节）'}`
    + ` ⇒ 解析出 ${lib.table.vars.size} 行（含 \`### tools/ environment variables\` 小节）`);

  // ★ 失明消息放在最前（同本仓侧的做法）。
  if (lib.blind.length) {
    console.log('\n✘✘ 本闸门已**失明（库仓侧）**：');
    for (const b of lib.blind) console.log(`   ✘ ${b}`);
    console.log('   ⇒ 「0 个变量未登记进表」是**假的**，别信。请先修路径 / 抽取器 / README 小节，再信库仓侧的结论。');
  }

  if (lib.missing.length) {
    console.log(`\n✘ 判据⑤·库仓 core/** 与 tools/** 里有 ${lib.missing.length} 个变量**代码真在读、但 \`core/README.md\` 的表里没有**`
      + '（★ 这正是「文档声称值 vs 实测值」在环境变量这一维的落点）：');
    for (const m of lib.missing) console.log(`   ✘ [${m.scope}] ${m.name}  ←  读它的文件：${m.rels.join(', ')}`);
    console.log('   ↳ 修法：把这几行补进库仓 `core/README.md` 的表'
      + '（`core/**` 读的进 `## Environment variables`；`tools/**` 读的进 `### tools/ environment variables`。'
      + '★ **那是另一个仓的文件**，本闸门只读不写；改之前请先确认）。');
  } else if (!lib.blind.length) {
    console.log(`\n✓ 判据⑤·库仓 core/** 与 tools/** 里代码真在读的 `
      + `${lib.coreVars.size + lib.toolsVars.size - lib.internal.length} 个变量`
      + ' **全部**出现在 `core/README.md` 的表里');
  }

  if (lib.tableOnly.length) {
    console.log(`\nℹ 判据⑥·表里列了、但 core/** 与 tools/** 的代码**本闸门扫不到读者**的 ${lib.tableOnly.length} 个（**只列不判**）：`);
    for (const t of lib.tableOnly) console.log(`   · ${t.name}  (core/README.md:${t.line})`);
    console.log('   ↳ 分三种：① **外部约定**（如 `HF_ENDPOINT` 由 huggingface_hub 自己读）；'
      + '② 读者在**别的目录**（如 `LEMO_OPUSCAR_HOME` 的读者在 `plugin/skills/lemo-opuscar/scripts/setup.sh`）；'
      + '③ **动态取值**本闸门看不见（见头注释 ⑧：`RENDER_MIN_FREE` / `INDEXTTS_MIN_FREE_MIB`）。'
      + '⇒ **③ 不是「表里多写了」**。');
  } else {
    console.log('\n✓ 判据⑥·表里每一行都能在 core/** 或 tools/** 的代码里找到读者');
  }

  if (lib.internal.length) {
    console.log(`\nℹ \`_\` 前缀（**进程内自设、不是外部输入** ⇒ 不判、只列）${lib.internal.length} 个：`);
    for (const t of lib.internal) console.log(`   · ${t.name}  ←  ${t.rels.join(', ')}`);
  }
  console.log(`\n[库仓] 表↔代码：core 在读 ${lib.coreVars.size} 个 + tools 在读 ${lib.toolsVars.size} 个（**同判 FAIL**）· `
    + `未登记进表 ${lib.missing.length} 个 · 表里多列 ${lib.tableOnly.length} 个（只列）`
    + `· 内部 \`_\` 前缀 ${lib.internal.length} 个（只列）${lib.blind.length ? '· **已失明（库仓侧）**' : ''} ${libFail ? '✘' : 'OK'}`);
}

console.log(`\n[闸门] 覆盖点登记：未登记 ${unregistered.length} 处、登记点消失 ${gone.length} 个、`
  + `新读者未登记 ${fresh.length} 个（只列）、档B ${Object.keys(EXTERNAL).length} 个（只列）`
  + `${blind.length ? '、**已失明**' : ''}`
  + `；库仓表↔代码（core+tools）：${lib.reachable ? `未登记进表 ${lib.missing.length} 个、表里多列 ${lib.tableOnly.length} 个（只列）` : '**不可达 ⇒ 不检查**'}`
  + ` ${ok ? 'OK' : '✘'}`);
process.exitCode = ok ? 0 : 1;
