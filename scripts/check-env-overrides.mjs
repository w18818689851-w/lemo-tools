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
 *   · 坑一：**把解释某变量没人读的注释当成消费者** ⇒ 必须剥注释。实证：`lib/env.mjs:48` 的 `//`
 *     注释里写着 `process.env.LEMO_LIB_WSL` / `LEMO_LIB_WIN`（那是**说明文字**，不是读者）。
 *   · 坑二：**粗剥会把真代码吃掉**。实测：`test/cases.mjs` 同款的三步粗剥（先正则删块注释、再删
 *     行尾 `//`）在本仓会**吃掉 12 处真命中** —— 其中 6 处是**真代码**
 *     （`dub.mjs:64` 的 `LEMO_VENC`、`lemo-make.mjs` 的 `INDEXTTS_MIN_FREE_MIB`、`style-scan.mjs`
 *     的 `LEMO_STYLES_ROOT` / `LEMO_STYLE_FP_FILE`、`server.mjs:66-68` 的三个 `LEMO_CONSOLE_*`）。
 *     根因有两条：① 某行注释里出现「斜杠 + 星号」⇒ 粗正则把它当块注释起点、**一路吃到下一个
 *     「星号 + 斜杠」**；
 *     ② 字符串里的 `//`（如 `'http://…'`、正则 `/…\/\//g`）⇒ 整行被截断。
 *   ⇒ 本闸门用**状态机**逐字符扫，识别 `'` `"` 反引号字符串（**含模板串 `${}` 里的代码 —— 那部分
 *     是**真代码**，必须保留**，实测 `lemo-make.mjs:1836` 的 `process.env.PATH` 就在 `${}` 里）、
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
 *
 * ★ ⑤ 本闸门**不扫自己**（`SELF`）：否则它的**登记表文本**会自己满足判据 ①（「匹配判据可被无关
 *   代码满足」）。也**不扫** `node_modules` / `.git` / `_tmp_*` / `_superseded*` 等目录。
 *   ★ 本闸门**没有** `LEMO_*` 覆盖点 —— 扫描根按**脚本自身位置**推导（`<脚本>/..`），夹具用
 *   「**整棵拷到临时目录**」（同 `check-render-venc.mjs` 的 A 类落点写法 / `test/gate-blindness.test.mjs`
 *   的 `copyGate`），而不是 env 重定向。
 *
 * ★ ⑥ 已知局限（**如实写，不粉饰**）：
 *   · **动态取值看不见**：`process.env[k]` / `process.env['LEMO_' + x]` 这类**非静态名**本闸门
 *     **一律看不见**（正则只认 `process.env.<标识符>`）。实测本仓有 **2 处**：`dub.mjs:933-934`
 *     （把**调用方传入的一批变量名**透传进 python 的 `export` 串）—— 那两处的变量名是**运行期**的，
 *     机械判定不可靠，**有意不判**。⇒ **「本闸门绿灯」≠「本仓没有别的 env 读取点」**。
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
      'scripts/patch-style-mux.mjs'],
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
      'scripts/style-scan.mjs'],
    what: '风格源码根（默认 <库根>/styles）',
  },
  LEMO_STYLES_ROOT_WSL: {
    readers: ['scripts/unblock-placeholder-audio.mjs'],
    what: 'WSL 侧风格源码根',
  },
  LEMO_LIB_WIN: {
    readers: ['consistency-check.mjs', 'lemo-make.mjs'],
    what: '库根（Windows 侧，编排器 CFG.winLib / consistency-check 的 LIB）',
  },
  LEMO_LIB_WSL: {
    readers: ['lemo-make.mjs'],
    what: '库根（WSL 侧，编排器 CFG.wslLib）',
  },
  LEMO_FILM_DIR: {
    readers: ['lib/env.mjs', 'scripts/check-selfcheck-claims.mjs', 'scripts/prune-jobs.mjs'],
    what: '成片根（lib/env.mjs 的 exportDir；★ 曾被硬编码过一段时期，见头注释 ①）',
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
      'scripts/check-skill-scores.mjs', 'scripts/check-tp-prose.mjs'],
    what: '风格技能树（_distill.json）根 —— 11 个闸门共用，夹具靠它指向临时副本',
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
      'scripts/check-ref-lines.mjs', 'scripts/check-shell-structure.mjs'],
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
  PATH: {
    readers: ['lemo-make.mjs'],
    why: '操作系统的 PATH（把 ffmpeg 目录前置进子进程环境；`process.env.PATH` 在模板串 ${} 里）',
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

// ── 期望值（本闸门自己的口径）──────────────────────────────────────────────
const regVars = Object.keys(OVERRIDES).length + Object.keys(EXTERNAL).length;
const realVars = byVar.size;
const regPairs = [...Object.values(OVERRIDES), ...Object.values(EXTERNAL)].reduce((a, e) => a + e.readers.length, 0);
const realPairs = [...byVar.values()].reduce((a, s) => a + s.size, 0);   // 去重后的 (文件, 变量) 对

const ok = unregistered.length === 0 && gone.length === 0 && blind.length === 0;

if (JSON_OUT) {
  console.log(JSON.stringify({
    root: ROOT,
    scope: { files: files.length, hits: hits.length, vars: realVars },
    expect: { registeredVars: regVars, registeredPairs: regPairs, realPairs, overrides: Object.keys(OVERRIDES).length, external: Object.keys(EXTERNAL).length },
    unregistered: unregistered.map((h) => ({ file: h.rel, line: h.line, name: h.name })),
    gone,
    freshReaders: fresh,
    blind,
    ok,
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
  process.exit();
}

// ── 输出 ────────────────────────────────────────────────────────────────────
console.log(`仓根 : ${ROOT}`);
console.log(`范围 : lib/** + scripts/**（递归）+ 仓根 *.mjs（非递归）；★ 不扫自己（${SELF}）`);
console.log(`       实测 ${files.length} 个文件 / ${hits.length} 处 process.env.* / ${realVars} 个不同变量`);
console.log(`       ★ 已知盲区：**不纳入**库仓 D:/lemo-opuscar 的 core/** 与 tools/**`
  + '（那些是渲染/编排的运行时旋钮，不是「重定向夹具」的覆盖点；见头注释 ④）');
console.log(`       ★ 已知盲区：**动态取值看不见** —— \`process.env[k]\` / \`process.env['X' + y]\` 不判`
  + '（实测本仓 2 处：`dub.mjs:933-934` 透传调用方给的变量名，见头注释 ⑥）');
console.log('');
console.log(`★ 期望值：登记 ${regVars} 条（覆盖点 ${Object.keys(OVERRIDES).length} + 非覆盖点 ${Object.keys(EXTERNAL).length}）`
  + ` / 真实语料 ${realVars} 个变量 / **差额 ${realVars - regVars}**；`
  + `(文件, 变量) 对：登记 ${regPairs} / 扫到 ${realPairs} / 差额 ${realPairs - regPairs}（共 ${hits.length} 处出现）`);
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

console.log(`\n[闸门] 覆盖点登记：未登记 ${unregistered.length} 处、登记点消失 ${gone.length} 个、`
  + `新读者未登记 ${fresh.length} 个（只列）、档B ${Object.keys(EXTERNAL).length} 个（只列）`
  + `${blind.length ? '、**已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exitCode = ok ? 0 : 1;
