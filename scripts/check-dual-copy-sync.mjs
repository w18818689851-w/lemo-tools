#!/usr/bin/env node
/**
 * scripts/check-dual-copy-sync.mjs —— 「WIN 副本 ↔ WSL 副本」双份同步闸门
 *
 * ★ ① 由来（2026-10-04，用户「约定三」+ 一次只读全仓审计）：
 *   项目纪律（约定三）：`D:/lemo-opuscar` 与 WSL `/home/lemo/lemo-opuscar` 是**两份副本，必须同步**。
 *   而且两条路径**分工不同**：
 *     · **渲染读 WSL 侧**（`lemo-make.mjs` 用 `CFG.wslLib` 指向 WSL 库）；
 *     · **源码指纹读 WIN 侧**（`scripts/style-scan.mjs` 默认 `D:/lemo-opuscar/styles`）。
 *   ⇒ 两份一旦不一致，`style-scan` 记录的指纹**根本不是被渲染的那份**，
 *     `style-distill.mjs plan` 会**永远报「已蒸馏且未变」**（静默失效、永不重新解析）。
 *   2026-10-04 只读审计（约 1346 个文本文件/侧）实测到真漂移：
 *     · `engraving` 风格的 9 个源文件不一致（`demo/film.js` 396/356 行、`demo/main.js` 26/13、
 *       `demo/engine/plate.js` 240/144、`demo/engine/burin.js` 493/463、`demo/index.html` 7/6、
 *       `demo/tools/events.mjs`，以及 `demo/subjects/{chart,coffee,details_coffee}.js` —— 这三个
 *       在 WSL 侧**根本不存在**）；
 *     · `core/README.md`（WIN 更新）。
 *   ⇒ 本闸门把「两份副本逐文件一致」钉死为可机器判定的规则，防止这类漂移再次静默溜回库里。
 *
 * ★ ② 判据（机械可解释）：
 *   · 枚举**两侧**的文本类文件（`.sh .bash .mjs .js .cjs .ts .py .md .json .html .htm .css .srt .txt`、
 *     无扩展名的 `CREDITS`/`LICENSE`/`NOTICE`/`COPYING`/`AUTHORS`，以及**无扩展名的控制文件**
 *     `.gitignore`/`.gitattributes`/`.editorconfig`/`.gitmodules` 与许可边车 `LICENSE-*` —— 见下方 ★②b），
 *     **排除** `node_modules`/`.git`/`__pycache__`/`.cache`/`.venv`/`venv` 等目录与 `*.orig`/`*.orig-*` 备份。
 *   · 对每个文件算 **md5**（WIN 侧用 Node 读字节、WSL 侧用 `md5sum`），**逐文件比对**
 *     —— 不做整行字符串比对（WIN 的 `md5sum` 输出带 `*` 标记、WSL 不带，整行比会假红）。
 *   · 分类（**核心是区分「源文件」与「生成物」**）：
 *       - **源文件（判 FAIL）**：代码/文档（`.sh .mjs .js .cjs .ts .py .html .htm .css .md`）、
 *         风格定义 `style.json`、以及**其它未被判为生成物的文件**（如 `package.json`、
 *         `fonts/OFL.txt`、`vendor/*.min.js`）——它们是人写/手工拷入的，两份**必须**一致。
 *         不一致或**单侧缺失** ⇒ FAIL，报出**文件 + 两侧 md5/字节 + 哪侧新**。
 *       - **生成物（只列 backlog，不判 FAIL）**：见下方「生成物判定规则」。
 *         它们在**不同宿主**上由流水线各自生成，漂移属正常噪声。
 *       - **非源码资产 / 工作区（只列 backlog，不判 FAIL）**：`core/audio/instruments/**`（下载的
 *         第三方乐器采样库）、`core/lang/fonts/**`（字体许可文本）、`creative/**`（WIN 独有工作区）。
 *         理由：它们不是人写的库源码；其同名二进制（`.wav`/`.woff2`）本闸门**根本不比**，
 *         只比文本边车只会产生噪声。★ 这是一条**判断**（见 ③），若你认为它们也应同步，把
 *         对应 `ASSET_RULES` 删掉即可让它们回到「源文件」判 FAIL。
 *   · ★ **生成物判定规则（启发式，按路径/文件名）** —— 依据：这些是流水线产物，不是风格源码
 *     （与 `style-scan.mjs` 的 DENY_DIRS / 注释「events.json/lines.json/content*.json 是生成物」一致）：
 *       1) 扩展名 `*.srt`（字幕，`subs.py` 等产出）；
 *       2) 文件名为 `dur|words|cues|events|lines|timeline|measure|analysis|lips|score|subs|subtitles.json`
 *          （TTS 时长/词表、混音时间轴、事件、字幕时间轴、配乐、口型表 —— 由流水线按内容生成）；
 *       3) 文件名 `content*.json`（`content_alt.json`/`content_coffee.json`/… 内容数据）；
 *       4) 位于产物目录：`out/`、`stills/`、`voices/`、`voices_raw/`、`crops/`、`posters/`、`thumbs/`；
 *       5) 临时/备份文件：文件名含 `_tmp`/`.tmp`/`.bak`/`.old`/`.swp`。
 *   · ★ **防空转绿灯**：任一侧扫到 **0 个**文本文件、或 WSL 不可达 / `cd` 失败 ⇒ **判 FAIL 并明说失明**
 *     （不许静默 OK）。
 *   · `--json` 输出分类计数与明细（含被判为生成物的清单，供人工核对分类是否误伤）。
 *
 * ★ ②b **无扩展名的控制文件判据（2026-10-06 补；这条是「已实证」的盲区，不是推测）**：
 *   ★ 由来：旧版 `isText()` = 「扩展名在 `TEXT_EXT` 里」**或**「文件名正好是 `TEXT_NAMES` 那五个」⇒
 *     `.gitignore` 这类**点开头、无扩展名**的控制文件**一条都不匹配**（`isText('.gitignore')` ⇒ false）
 *     ⇒ **两份副本的 `.gitignore` 内容不同，本闸门却全绿**（实测两侧曾为 `a25c8d…` / `96112b…`）。
 *     这类漂移是**真漂移**、且比代码漂移更隐蔽：`.gitignore` 决定**哪些文件入库** ⇒ 两份不一致时
 *     「同一份源码在两边入库状态不同」，新克隆会**少文件**，而闸门看不见。
 *     实测同类盲区还有 `styles/watercolor/demo/vendor/LICENSE-topojson-client` / `LICENSE-world-atlas`
 *     （无扩展名的许可边车，旧 `isText()` 同样判 false ⇒ 从不比对）。
 *   ★ 判据：把**无扩展名的控制文件**按**文件名 glob** 并入同一套枚举，命中即按**源文件**处理（漂移判 FAIL）：
 *     `TEXT_NAME_GLOBS = ['.gitignore', '.gitattributes', '.editorconfig', '.gitmodules', 'LICENSE-*']`
 *     —— **同一份 glob 列表**同时喂给 WIN 侧匹配器（`globToRe`）与 WSL 侧 `find -name`，
 *     两侧判据**由构造保证一致**（与既有 `TEXT_EXT`/`TEXT_NAMES` 的写法同风格）。
 *     · 为什么是「固定 glob 列表」而不是「所有无扩展名文件」：后者会把 `.venv/bin/pip`、
 *       `styles/<slug>/demo/out/.video_gpu_segs-<rand>/pid` 这类**生成/第三方**无扩展名文件也拖进来
 *       —— 既拖慢、又全是噪声；这里只收**人写的控制文件**（同上，是**判断**，见 ③）。
 *     · 不限层级：任意目录下的 `.gitignore` 都算（本仓实测 2 个：根目录、
 *       `styles/engraving/demo/music/.gitignore`）。
 *   ★ 失明守卫：**沿用既有那一条**（任一侧扫到 0 个文件 / WSL 不可达 ⇒ 判 FAIL 并明说失明），本判据不另设。
 *     ★ **已知假阴（写在这里，别当它不存在）**：若 glob 写漏/写错，两侧会**同时**漏掉那个文件 ⇒
 *     闸门仍绿。本判据只能保证「**被枚举到的**文件一致」，**不能**保证「该枚举的都枚举到了」。
 *   ★ 性能：WSL `find` 多 5 个 `-name`、WIN 侧每文件多 5 次正则 ⇒ 实测整闸门 ~3.1s，无可测变化。
 *
 * ★ ③ 已知局限 / 会误报的边界：
 *   · **只比文本类文件**：媒体/二进制（`.mp4 .wav .jpg .png .ttf .woff2 .glb .npy` 等）**不比**
 *     —— 它们体积大、且多由流水线生成，逐字节比代价高、噪声大。
 *   · **无扩展名的控制文件是「白名单」而非「全收」**（见 ★②b）：只有 `TEXT_NAME_GLOBS` 里列到的
 *     才比。**没列到的**无扩展名文件（如某个新加的 `.npmrc`/`.dockerignore`）**仍然看不见** ——
 *     闸门不会因为「新增了一类控制文件」而自己发现，得人工往 `TEXT_NAME_GLOBS` 里补。
 *   · 「源文件 / 生成物 / 资产」的分界线是**启发式**（按路径与文件名），可能**误分类**：
 *     - 若某**生成物**未被上面的 5 条规则命中 ⇒ 会被当**源文件**判 FAIL（假红）；
 *     - 若某**源文件**恰好落进产物目录/命中生成物文件名/资产前缀 ⇒ 会被当**生成物/资产**漏判（假阴）。
 *     ⇒ 输出里会**列出被判为生成物/资产的清单**（命中规则 + 计数），供人工核对并反馈修正规则。
 *   · **不做方向判断**（不自动决定哪侧对）：只报「不一致」，由人决定同步方向；「哪侧新」仅按 mtime 提示。
 *   · 只认文件**内容**：权限位 / 符号链接 / 空目录差异**看不见**。
 *   · 若某侧文件名含**换行**，`find -printf`/`md5sum` 的逐行解析会错位（本仓无此情况）。
 *   · `--no-wsl` 会**跳过** WSL 侧 ⇒ 本闸门此时**没有做双份比对**，会打印醒目警告（仅供 WIN 侧单看/调试）。
 *
 * ★ ④ 退出码：源文件漂移 / 源文件单侧缺失 / 本闸门失明（任一侧 0 文件、WSL 不可达）⇒ 1；否则 0
 *   （生成物漂移**不影响**退出码；★ ⑤ 的 git 历史判据**也不影响**退出码 —— 理由见 ⑤）。
 *
 * ★ ⑤ **git 历史一致性判据（2026-10-06 补；参考/告警级，一律不判 FAIL）**：
 *   ★ 由来（本次实测，止住一个已发生的盲区）：上面 ①–④ 的判据**只比工作区文件 md5** ——
 *   而 `D:/lemo-opuscar`（WIN）与 `/home/lemo/lemo-opuscar`（WSL）是**两份独立仓库**
 *   （各有 `.git`、同一个 `origin`）⇒ **两侧 git 历史分叉时本闸门看不见**。实测：
 *   WIN HEAD = `b0de9e7`（刚提交）、WSL HEAD = `f3c590d`、WSL `status` **307** 条未提交；
 *   WSL **看不到** `b0de9e7`（`git cat-file -t b0de9e7` ⇒ `Not a valid object name`）
 *   ⇒ **那个提交只在 WIN 侧**。而**文件是同步的**（两侧工作区 md5 一致）
 *   ⇒ 旧版闸门**全绿**、历史却已分叉。
 *   ★ 危害：WSL 那份一旦被当权威、或被重新克隆，会**丢掉本会话的全部提交**。
 *   ★ 判据（**机械、只读、便宜**）：两侧各跑一次 `git status --porcelain=v2 --branch`
 *     —— **一次调用**同时拿到 HEAD / 分支 / 未提交条数（`#` 行给 oid 与分支，其余行数即未提交条数），
 *     **不扫全仓**；再**双向**探「一侧能否看到另一侧的 HEAD」（`git cat-file -t <对方 HEAD>`）；
 *     若 WIN 侧两个对象都在，再用 `git rev-list --left-right --count A...B` **一次**拿到各自领先/落后。
 *     报告：两侧 HEAD（短哈希）、分支、未提交条数、领先/落后、以及「**哪一侧看不到对方的 HEAD**」。
 *   ★★ **判据强弱（本判据最容易做错的地方，故写明理由）**：
 *     · **一律不判 FAIL**（参考/告警级，像 `check-dna-coverage.mjs` 的 backlog 那样只列不判死）。
 *       理由 ① **今天就会红**：实测历史**已经**分叉（WIN 领先 1、WSL 看不到该对象）⇒ 判 FAIL 会
 *       **立刻打破「27 闸门全绿」**，而项目习惯是「**先测误报率再定判据**、不轻易让既有闸门变红」。
 *       理由 ② **不重复**：真正**已造成损害**的形态是「两侧工作区文件不一致」—— 那是**既有判据**
 *       的职责（判 FAIL）；历史分叉本身是**潜在**风险，不是当下已损坏的文件。
 *       理由 ③ **不可自动修**：收敛历史要动仓库（push/pull/merge），而本闸门**只读、不改任何仓库状态**
 *       ⇒ 报 FAIL 等于「报一个本闸门无权修的错」，会诱导用 `--no-wsl` 绕过。
 *       理由 ④ **良性形态多**：一侧刚 commit 未 push、一侧正在 rebase、两侧各有未提交 —— 都是正常
 *       作业中间态，判死会把正常流程打红（且该判据是**事实陈述**、没有「误报率」可测）。
 *     ⇒ 故本判据只**报告事实 + 后果**，把「要不要收敛、往哪个方向收敛」留给人工（与 ③ 一致）。
 *   ★ **失明守卫**（本项目铁律：失明**不许** FAIL、但必须**明说**）：任一侧 root 不存在 /
 *     该路径下**没有 `.git`**（不是 git 仓库）/ 该侧**没有 git 命令** / git 块未出现在 WSL 输出里
 *     ⇒ 打印「**本判据已失明（原因）**」，**不判 FAIL、不影响退出码**。
 *   ★ **性能**：WIN 侧最多 3 次 `git` 调用（status / cat-file / rev-list，都是 O(1) 级、不扫历史），
 *     WSL 侧**搭车**在既有的那次 bash 调用里（**不额外起 `wsl.exe`**）⇒ 实测整闸门 ~2.9s → ~3.2s。
 *   ★ 已知局限：只比**提交图与工作区脏污**，**不比 remote 配置**（两侧 URL 写法不同 —— HTTPS 与 SSH
 *     —— 是良性的，判死会误报）；**不 `fetch`**（联网、且会改仓库状态）；不判「该由哪侧收敛」。
 *
 * 用法：node scripts/check-dual-copy-sync.mjs [--json] [--no-wsl]
 * 环境变量：
 *   LEMO_OPUSCAR      WIN 副本根（默认 <脚本>/../../lemo-opuscar，即 D:/lemo-opuscar）
 *   LEMO_WSL_ROOT     WSL 副本根（默认 /home/lemo/lemo-opuscar）
 *   LEMO_WSL_DISTRO   WSL 发行版（默认 Ubuntu-24.04）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** ★ `wsl.exe` 不能用 spawnSync（实测 `EBUSY`），必须用异步 spawn。 */
function sh(cmd, args) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { windowsHide: true });
    let o = '', e = '';
    c.stdout.on('data', (d) => { o += d; });
    c.stderr.on('data', (d) => { e += d; });
    c.on('close', (code) => resolve({ code, o, e }));
    c.on('error', (x) => resolve({ code: -1, o, e: String(x.message) }));
  });
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WIN_ROOT = path.resolve(process.env.LEMO_OPUSCAR || path.join(HERE, '..', '..', 'lemo-opuscar'));
const WSL_ROOT = process.env.LEMO_WSL_ROOT || '/home/lemo/lemo-opuscar';
const DISTRO = process.env.LEMO_WSL_DISTRO || 'Ubuntu-24.04';
const JSON_OUT = process.argv.includes('--json');
const NO_WSL = process.argv.includes('--no-wsl');

// ── 枚举规则（两侧必须完全一致，否则会假红）──────────────────────────────────
const SKIP_DIRS = ['node_modules', '.git', '__pycache__', '.cache', '.venv', 'venv', '.mypy_cache', '.pytest_cache'];
const TEXT_EXT = ['.sh', '.bash', '.mjs', '.js', '.cjs', '.ts', '.py', '.md', '.json', '.html', '.htm', '.css', '.srt', '.txt'];
const TEXT_NAMES = ['CREDITS', 'LICENSE', 'NOTICE', 'COPYING', 'AUTHORS'];
// ★ ②b 无扩展名的控制文件（**glob**，见头注释 ②b）。★ 这份列表是**唯一真相**：WIN 侧用 globToRe 编译成
//   正则、WSL 侧直接当 `find -name` 的 pattern ⇒ 两侧枚举**由构造保证一致**（不会一边改一边忘）。
const TEXT_NAME_GLOBS = ['.gitignore', '.gitattributes', '.editorconfig', '.gitmodules', 'LICENSE-*'];
const globToRe = (g) => new RegExp('^' + g.split('*').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
const TEXT_NAME_RES = TEXT_NAME_GLOBS.map(globToRe);
const GEN_DIRS = new Set(['out', 'stills', 'voices', 'voices_raw', 'crops', 'posters', 'thumbs']);
const GEN_JSON_NAME = /^(dur|words|cues|events|lines|timeline|measure|analysis|lips|score|subs|subtitles)\.json$/;
// ★ 第三类「非源码资产 / 工作区」（只入 backlog，不判 FAIL）：**下载来的第三方资产**与
//   **WIN 独有工作区** —— 它们不是人写的库源码，且其同名二进制（.wav/.woff2）本闸门根本不比，
//   只比它们的文本边车只会产生噪声。判据（按路径前缀，见头注释 ③ 已知局限）：
const ASSET_RULES = [
  { re: /^core\/audio\/instruments\//, why: '下载乐器采样库 core/audio/instruments/**' },
  { re: /^core\/lang\/fonts\//, why: '字体许可/资产 core/lang/fonts/**' },
  { re: /^creative\//, why: 'WIN 独有工作区 creative/**' },
];

const isSkippedName = (name) => /\.orig(-|$)/.test(name);
const isText = (name) => TEXT_EXT.some((e) => name.endsWith(e))
  || TEXT_NAMES.includes(name)
  || TEXT_NAME_RES.some((re) => re.test(name));   // ★ ②b 无扩展名控制文件

/** 分类：返回 { cat:'src'|'gen'|'asset', why }。判据见头注释 ②。 */
function classify(rel) {
  const segs = rel.split('/');
  const base = segs[segs.length - 1];
  const lower = base.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot > 0 ? lower.slice(dot) : '';

  // ★ 先判「路径」类规则（资产 / 产物目录 / 临时备份），再判扩展名/文件名类规则 —— 否则
  //   `out/srt.json`、`voices/dur.json`、`lines_zh_tmp.json` 会被 `.json` 分支提前吞掉而误判为源码。
  for (const a of ASSET_RULES) if (a.re.test(rel)) return { cat: 'asset', why: a.why };
  const dirHit = segs.slice(0, -1).find((s) => GEN_DIRS.has(s));
  if (dirHit) return { cat: 'gen', why: `产物目录 ${dirHit}/` };
  if (/(_tmp|\.tmp|\.bak|\.old|\.swp)/.test(lower)) return { cat: 'gen', why: '临时/备份文件' };
  if (ext === '.srt') return { cat: 'gen', why: '*.srt' };
  if (ext === '.json') {
    if (GEN_JSON_NAME.test(lower)) return { cat: 'gen', why: '生成 JSON（dur/words/cues/events/lines/score…）' };
    if (/^content.*\.json$/.test(lower)) return { cat: 'gen', why: 'content*.json' };
    if (lower === 'style.json') return { cat: 'src', why: '风格定义 style.json' };
    return { cat: 'src', why: '其它 JSON' };
  }
  if (/^timing_report/.test(lower)) return { cat: 'gen', why: 'timing_report*.txt' };
  // ★ 2026-10-04 补：`music/report.txt` 是 `music.py` **生成**的响度/频段报告
  //   （实测 `styles/pictogram-motion/demo/music/music.py:1622` 写出）。
  //   此前它被误判为**源文件** ⇒ 每次重跑 `music.py` 都会制造一次**假红**（实测发生过一次）。
  if (lower === 'report.txt' && segs.includes('music')) {
    return { cat: 'gen', why: 'music/report.txt（music.py 生成的响度报告）' };
  }
  return { cat: 'src', why: '源码/文档' };
}

// ── WIN 侧：Node 递归枚举 + 读字节算 md5 + stat ──────────────────────────────
function walkWin(root) {
  const out = [];
  const stack = [''];
  while (stack.length) {
    const relDir = stack.pop();
    let ents;
    try { ents = fs.readdirSync(path.join(root, relDir), { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (SKIP_DIRS.includes(e.name)) continue;
        stack.push(rel);
      } else if (e.isFile()) {
        if (isSkippedName(e.name) || !isText(e.name)) continue;
        out.push(rel);
      }
    }
  }
  out.sort();
  return out;
}

const winMap = new Map(); // rel -> { md5, size, mtimeMs }
let winBlind = null;
if (!fs.existsSync(WIN_ROOT)) {
  winBlind = `WIN 副本根不存在：${WIN_ROOT}`;
} else {
  for (const rel of walkWin(WIN_ROOT)) {
    const p = path.join(WIN_ROOT, rel);
    try {
      const buf = fs.readFileSync(p);
      const st = fs.statSync(p);
      winMap.set(rel, {
        md5: crypto.createHash('md5').update(buf).digest('hex'),
        size: st.size,
        mtimeMs: st.mtimeMs,
      });
    } catch { /* 读不到就当不存在 */ }
  }
  if (winMap.size === 0) winBlind = `WIN 副本扫到 0 个文本文件：${WIN_ROOT}（路径/过滤变了？）`;
}

// ── ★ ⑤ git 历史探针（WIN 侧；见头注释 ⑤）──────────────────────────────────
/** 解析 `git status --porcelain=v2 --branch` 的**一次调用**输出：
 *  `# branch.oid <hash>` / `# branch.head <branch>` 给 HEAD 与分支，**其余非 `#` 行数** = 未提交条数。 */
function parseGitStatus(out) {
  const rec = { head: null, branch: null, dirty: null, unborn: false };
  let dirty = 0, sawHeader = false;
  for (const line of String(out).split('\n')) {
    if (!line) continue;
    if (line.startsWith('# branch.oid ')) {
      sawHeader = true;
      const v = line.slice('# branch.oid '.length).trim();
      if (v === '(initial)') rec.unborn = true; else rec.head = v;
    } else if (line.startsWith('# branch.head ')) {
      rec.branch = line.slice('# branch.head '.length).trim();
    } else if (line.startsWith('#')) continue;
    else dirty++;
  }
  if (sawHeader) rec.dirty = dirty;
  return rec;
}

/** 探 WIN 侧 git 状态。**只读**（status / cat-file / rev-list 都不改仓库）。返回 { ok, why } 或
 *  { ok:true, head, branch, dirty, unborn }。 */
async function probeGitWin(root) {
  if (!fs.existsSync(path.join(root, '.git'))) {
    return { ok: false, why: `${root} 下没有 .git（该路径不是 git 仓库的根）` };
  }
  const st = await sh('git', ['-C', root, 'status', '--porcelain=v2', '--branch']);
  const out = String(st.o || '');
  if (st.code !== 0 || !/# branch\./.test(out)) {
    return { ok: false, why: `WIN 侧 git 不可用或该路径不是 git 仓库（exit=${st.code}）：${String(st.e || '').split('\n')[0].slice(0, 140)}` };
  }
  return { ok: true, ...parseGitStatus(out) };
}

const winGit = await probeGitWin(WIN_ROOT);

// ── WSL 侧：一次 bash 调用内 find + md5sum（★ 用 -print0|xargs 避免 argv 超长）──
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const FIND_SKIP = `\\( -type d \\( ${SKIP_DIRS.map((d) => `-name ${shq(d)}`).join(' -o ')} \\) -prune \\)`;
const FIND_NAMES = `\\( ${TEXT_EXT.map((e) => `-name ${shq('*' + e)}`).join(' -o ')} -o ${TEXT_NAMES.map((n) => `-name ${shq(n)}`).join(' -o ')} -o ${TEXT_NAME_GLOBS.map((g) => `-name ${shq(g)}`).join(' -o ')} \\)`;
const FIND = `find . ${FIND_SKIP} -o \\( -type f ! -name ${shq('*.orig-*')} ! -name ${shq('*.orig')} ${FIND_NAMES} \\)`;

const wslMap = new Map(); // rel -> { md5, size, mtimeSec }
let wslBlind = null;
let wslRaw = { code: null, o: '', e: '' };
// ★ ⑤ WSL 侧 git 块（**搭车**在下面这次 bash 调用里，不额外起 wsl.exe；见头注释 ⑤）。
//   `[ -e .git ]` 先挡「不是 git 仓库」，`command -v git` 再挡「没装 git」—— 两种情况都算**失明**（不 FAIL）。
const WIN_HEAD = winGit.ok ? winGit.head : null;
const GIT_BLOCK = [
  `echo __GIT_BEGIN__`,
  `if [ -e .git ] && command -v git >/dev/null 2>&1; then`,
  `  echo __GIT_OK__`,
  `  git status --porcelain=v2 --branch 2>&1`,
  `  echo __GIT_VIS__`,
  `  if [ -n ${shq(WIN_HEAD || '')} ] && git cat-file -t ${shq(WIN_HEAD || '')} >/dev/null 2>&1; then echo YES; else echo NO; fi`,
  `else`,
  `  echo __GIT_BLIND__`,
  `  if [ -e .git ]; then echo no-git-binary; else echo no-dotgit; fi`,
  `fi`,
  `echo __GIT_END__`,
].join('\n');

if (NO_WSL) {
  wslBlind = null; // 明确跳过，不算失明（见头注释 ③：此时未做比对，会打印警告）
} else {
  const script = [
    `cd ${shq(WSL_ROOT)} 2>/dev/null || { echo __CD_FAIL__; exit 4; }`,
    `echo __SIZE_BEGIN__`,
    `${FIND} -printf '%s\\t%T@\\t%p\\n'`,
    `echo __SIZE_END__`,
    `echo __MD5_BEGIN__`,
    `${FIND} -print0 | xargs -0 -r md5sum`,
    `echo __MD5_END__`,
    GIT_BLOCK, // ★ 必须放在 __MD5_END__ **之后**：md5 块的解析是「到结束标记为止」，前置会污染它
  ].join('\n');
  wslRaw = await sh('wsl.exe', ['-d', DISTRO, '-e', 'bash', '-lc', script]);
  const o = String(wslRaw.o || '');
  if (o.includes('__CD_FAIL__') || !o.includes('__MD5_BEGIN__') || !o.includes('__MD5_END__')) {
    wslBlind = `WSL 不可达或脚本失败（distro=${DISTRO} root=${WSL_ROOT} exit=${wslRaw.code}）：${String(wslRaw.e || '').split('\n')[0].slice(0, 160)}`;
  } else {
    const sizeBlk = (o.match(/__SIZE_BEGIN__\n([\s\S]*?)\n__SIZE_END__/) || [, ''])[1];
    for (const line of sizeBlk.split('\n')) {
      if (!line) continue;
      const i1 = line.indexOf('\t'), i2 = line.indexOf('\t', i1 + 1);
      if (i1 < 0 || i2 < 0) continue;
      const rel = line.slice(i2 + 1).replace(/^\.\//, '');
      wslMap.set(rel, { size: Number(line.slice(0, i1)), mtimeSec: Number(line.slice(i1 + 1, i2)), md5: null });
    }
    const md5Blk = (o.match(/__MD5_BEGIN__\n([\s\S]*?)\n__MD5_END__/) || [, ''])[1];
    for (const line of md5Blk.split('\n')) {
      const m = line.match(/^([0-9a-f]{32})\s+\*?(.+)$/);
      if (!m) continue;
      const rel = m[2].replace(/^\.\//, '');
      const rec = wslMap.get(rel) || { size: null, mtimeSec: null };
      rec.md5 = m[1];
      wslMap.set(rel, rec);
    }
    if (wslMap.size === 0) wslBlind = `WSL 副本扫到 0 个文本文件：${WSL_ROOT}（路径/过滤变了？）`;
  }
}

// ── ★ ⑤ git 历史一致性（参考/告警级，**不影响退出码**；见头注释 ⑤）────────────
/** 解析 WSL 侧搭车 git 块的输出。返回 { ok, why } 或 { ok:true, head, branch, dirty, unborn, seesWinHead }。 */
function parseWslGit(out) {
  const m = String(out).match(/__GIT_BEGIN__\n([\s\S]*?)\n__GIT_END__/);
  if (!m) return { ok: false, why: `WSL 侧 git 块未出现在输出里（脚本被截断 / 该侧 cd 失败）` };
  const body = m[1];
  if (body.includes('__GIT_BLIND__')) {
    const why = body.includes('no-git-binary')
      ? `${WSL_ROOT} 侧**没有 git 命令**`
      : `${WSL_ROOT} 下**没有 .git**（该路径不是 git 仓库的根）`;
    return { ok: false, why };
  }
  const [statusPartRaw, visPart = ''] = body.split('__GIT_VIS__');
  // ★ 必须**剔掉自己埋的标记行**（`__GIT_OK__`）再数「非 `#` 行」—— 否则它会被当成一条未提交记录
  //   （实测：WSL 侧真实 307 条被数成 308 条）。
  const statusPart = statusPartRaw.split('\n').filter((l) => !/^__GIT_/.test(l)).join('\n');
  if (!body.includes('__GIT_OK__') || !/# branch\./.test(statusPart)) {
    return { ok: false, why: `WSL 侧 \`git status --porcelain=v2\` 未返回预期输出（不是 git 仓库？）：${statusPart.split('\n').filter(Boolean)[0]?.slice(0, 120) || '（空）'}` };
  }
  return { ok: true, ...parseGitStatus(statusPart), seesWinHead: /^\s*YES\s*$/m.test(visPart) };
}

const wslGit = NO_WSL
  ? { ok: false, why: '已用 --no-wsl **跳过** WSL 侧（本判据随之失明）' }
  : parseWslGit(String(wslRaw.o || ''));

const gitBlind = [];      // 失明原因（**不判 FAIL**，只明说）
if (!winGit.ok) gitBlind.push(`WIN 侧：${winGit.why}`);
if (!wslGit.ok) gitBlind.push(`WSL 侧：${wslGit.why}`);

/** 领先/落后（只有 WIN 侧两个对象都在时才算得出来）。返回 { ahead, behind, why }。 */
let gitAb = null;
if (winGit.ok && wslGit.ok && winGit.head && wslGit.head && winGit.head !== wslGit.head) {
  const r = await sh('git', ['-C', WIN_ROOT, 'rev-list', '--left-right', '--count', `${winGit.head}...${wslGit.head}`]);
  const m = String(r.o || '').trim().match(/^(\d+)\s+(\d+)$/);
  if (r.code === 0 && m) gitAb = { ahead: Number(m[1]), behind: Number(m[2]) };
  else gitAb = { ahead: null, behind: null, why: 'WIN 侧看不到对方 HEAD 的提交图（对象缺失）⇒ 无法算领先/落后' };
}
// WIN 能否看到 WSL 的 HEAD（一次 cat-file，O(1)，不扫历史）
let winSeesWslHead = null;
if (winGit.ok && wslGit.ok && wslGit.head) {
  const r = await sh('git', ['-C', WIN_ROOT, 'cat-file', '-t', wslGit.head]);
  winSeesWslHead = r.code === 0;
}
const gitSame = winGit.ok && wslGit.ok && !!winGit.head && winGit.head === wslGit.head;
const gitForked = winGit.ok && wslGit.ok && !!winGit.head && !!wslGit.head && winGit.head !== wslGit.head;
// 「哪一侧看不到对方的 HEAD」—— 只在两侧都是仓库时才有意义
const invis = [];
if (winSeesWslHead === false) invis.push('WIN 侧看不到 WSL 的 HEAD');
if (wslGit.ok && wslGit.seesWinHead === false) invis.push('WSL 侧看不到 WIN 的 HEAD');

// ── 逐文件比对 ──────────────────────────────────────────────────────────────
const allRels = [...new Set([...winMap.keys(), ...wslMap.keys()])].sort();
const srcDrift = [];   // 判 FAIL
const genDrift = [];   // 只列 backlog（流水线生成物）
const assetDrift = []; // 只列 backlog（下载资产 / 工作区）
const genInventory = new Map();   // why -> count（供人工核对分类）
const assetInventory = new Map(); // why -> count
let sameCount = 0;

const newerOf = (w, l) => {
  if (!w || !l || w.mtimeMs == null || l.mtimeSec == null) return null;
  const d = w.mtimeMs - l.mtimeSec * 1000;
  if (Math.abs(d) < 1000) return '≈同';
  return d > 0 ? 'WIN 新' : 'WSL 新';
};

for (const rel of allRels) {
  const w = winMap.get(rel) || null;
  const l = wslMap.get(rel) || null;
  const { cat, why } = classify(rel);
  if (cat === 'gen') genInventory.set(why, (genInventory.get(why) || 0) + 1);
  if (cat === 'asset') assetInventory.set(why, (assetInventory.get(why) || 0) + 1);

  if (w && l && w.md5 && l.md5 && w.md5 === l.md5) { sameCount++; continue; }
  if (!w && !l) continue; // 理论上不会发生

  const row = {
    rel, why, cat,
    status: !w ? 'WSL 独有（WIN 侧缺失）' : (!l ? 'WIN 独有（WSL 侧缺失）' : '两侧不一致'),
    win: w ? { md5: w.md5, size: w.size } : null,
    wsl: l ? { md5: l.md5, size: l.size } : null,
    newer: newerOf(w, l),
  };
  if (cat === 'src') srcDrift.push(row);
  else if (cat === 'asset') assetDrift.push(row);
  else genDrift.push(row);
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
const blindReasons = [winBlind, wslBlind].filter(Boolean);
const blind = blindReasons.length > 0;
const ok = !blind && srcDrift.length === 0;
const wslChecked = !NO_WSL && !wslBlind;

if (JSON_OUT) {
  console.log(JSON.stringify({
    winRoot: WIN_ROOT,
    wslRoot: WSL_ROOT,
    distro: DISTRO,
    wslChecked,
    noWsl: NO_WSL,
    counts: {
      winFiles: winMap.size,
      wslFiles: wslMap.size,
      union: allRels.length,
      same: sameCount,
      srcDrift: srcDrift.length,
      genDrift: genDrift.length,
      assetDrift: assetDrift.length,
    },
    blind,
    blindReasons,
    srcDrift,
    genDrift,
    assetDrift,
    genInventory: [...genInventory.entries()].map(([why, count]) => ({ why, count })),
    assetInventory: [...assetInventory.entries()].map(([why, count]) => ({ why, count })),
    // ★ ⑤ git 历史一致性（**参考级**：不影响 ok / 退出码）
    git: {
      advisoryOnly: true,
      blind: gitBlind,
      win: winGit.ok ? { head: winGit.head, branch: winGit.branch, dirty: winGit.dirty, unborn: winGit.unborn } : null,
      wsl: wslGit.ok ? { head: wslGit.head, branch: wslGit.branch, dirty: wslGit.dirty, unborn: wslGit.unborn } : null,
      same: gitSame,
      forked: gitForked,
      aheadBehind: gitAb,
      winSeesWslHead,
      wslSeesWinHead: wslGit.ok ? wslGit.seesWinHead : null,
      invisibleTo: invis,
    },
    ok,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

// ── 文本输出 ────────────────────────────────────────────────────────────────
const hash = (h) => (h ? h.slice(0, 10) + '…' : '—');
const side = (x) => (x ? `${hash(x.md5)} ${x.size == null ? '?' : x.size}B` : '（缺失）');
const fmtRow = (r) => `  ${r.cat === 'src' ? '✘' : '·'} ${r.rel}\n      ${r.status}  |  WIN ${side(r.win)}  |  WSL ${side(r.wsl)}${r.newer ? `  |  ${r.newer}` : ''}`;

console.log('双份副本同步闸门 —— WIN ↔ WSL（约定三：两份副本必须同步）');
console.log(`  WIN 副本: ${WIN_ROOT}  （${winMap.size} 个文本文件）`);
console.log(`  WSL 副本: ${WSL_ROOT} @ ${DISTRO}  （${wslMap.size} 个文本文件）`);
console.log(`  判据: 源文件逐字节一致（md5）；生成物/资产漂移只入 backlog，不判 FAIL`);
console.log(`        + git 历史一致性（参考级、**不判 FAIL**，见头注释 ⑤）`);
console.log(`  文本文件: 两侧并集 ${allRels.length} 个，一致 ${sameCount} 个\n`);

if (srcDrift.length) {
  console.log(`✘ 源文件漂移（判 FAIL）${srcDrift.length} 处：`);
  for (const r of srcDrift) console.log(fmtRow(r));
} else if (wslChecked) {
  console.log('✓ 源文件两侧逐字节一致');
}

console.log(`\nℹ 生成物 backlog（不判 FAIL）${genDrift.length} 处（不同宿主由流水线各自生成，漂移正常）：`);
for (const r of genDrift) console.log(fmtRow(r));
if (!genDrift.length) console.log('  （无）');

console.log(`\nℹ 非源码资产/工作区 backlog（不判 FAIL）${assetDrift.length} 处（下载资产 / WIN 独有工作区，见头注释 ③）：`);
for (const r of assetDrift) console.log(fmtRow(r));
if (!assetDrift.length) console.log('  （无）');

console.log(`\nℹ 被判为「生成物 / 非源码」的清单（命中规则 → 文件数，供人工核对分类是否误伤）：`);
for (const [why, count] of [...genInventory.entries()].sort((a, b) => b[1] - a[1])) console.log(`   · [生成物] ${why}  →  ${count} 个`);
for (const [why, count] of [...assetInventory.entries()].sort((a, b) => b[1] - a[1])) console.log(`   · [资产]   ${why}  →  ${count} 个`);
if (!genInventory.size && !assetInventory.size) console.log('   （无）');

// ── ★ ⑤ git 历史一致性输出（参考/告警级：**不判 FAIL**，见头注释 ⑤）────────────
const sh10 = (h) => (h ? h.slice(0, 7) : '—');
console.log('\n── git 历史一致性（参考级：本判据**不判 FAIL**、不影响退出码；见头注释 ⑤）──');
if (gitBlind.length) {
  console.log('  ⚠ **本判据已失明**（不是 FAIL —— 只说明这条判据这次什么都没查到）：');
  for (const b of gitBlind) console.log(`      · ${b}`);
} else {
  const gitSide = (g, label) => `  ${label} HEAD ${sh10(g.head)}${g.unborn ? '（尚无提交）' : ''}`
    + ` | 分支 ${g.branch || '—'} | 未提交 ${g.dirty == null ? '?' : g.dirty} 条`;
  console.log(gitSide(winGit, 'WIN 侧:'));
  console.log(gitSide(wslGit, 'WSL 侧:'));
  if (gitSame) {
    console.log(`  ✓ 两侧 HEAD **相同**（${sh10(winGit.head)}）`);
    if (winGit.dirty !== wslGit.dirty) {
      console.log(`  ⚠ 但**未提交条数不同**（WIN ${winGit.dirty} / WSL ${wslGit.dirty}）—— 两侧工作区脏污程度不一样，值得看一眼。`);
    }
  } else if (gitForked) {
    console.log(`  ⚠ 两侧 HEAD **不同** ⇒ **git 历史已分叉**（这是**参考级告警**，不判 FAIL）：`);
    if (gitAb && gitAb.ahead != null) {
      console.log(`      · WIN 领先 WSL ${gitAb.ahead} 个提交、WSL 领先 WIN ${gitAb.behind} 个提交`);
      if (gitAb.behind === 0) console.log('      · ⇒ WSL 侧**只是落后**（可 fast-forward 收敛，无需 merge）');
      else console.log('      · ⇒ 两侧**各有独有提交**（真分叉：收敛需要 merge/rebase，不是简单 ff）');
    } else {
      console.log(`      · 领先/落后：**算不出**（${(gitAb && gitAb.why) || '对象缺失'}）`);
    }
    console.log(`      · 未提交条数：WIN ${winGit.dirty} / WSL ${wslGit.dirty}`);
    if (invis.length) {
      for (const s of invis) console.log(`      · ★ ${s} ⇒ **那个提交只存在于另一侧**（对方连对象都没有，\`git log\` 里根本看不到）`);
    } else {
      console.log('      · 两侧**互相都能看到**对方的 HEAD（对象都在，只是提交图不同）');
    }
    console.log('  ★★ **后果（为什么这条值得看）**：WSL 那份一旦被**当权威**、或被**重新克隆**，');
    console.log('     会**丢掉只在 WIN 侧的那些提交**（本会话的提交就是这么在 WSL 侧缺席的）。');
    console.log('  ★ 本判据**不做方向判断、不动任何仓库**：要不要收敛、往哪边收敛由人决定（见头注释 ③⑤）。');
  } else {
    console.log('  ⚠ 两侧都是 git 仓库，但至少一侧**尚无提交**（HEAD 为空）⇒ 无法比对历史。');
  }
}

if (blind) {
  console.log('\n✘✘ 本闸门已**失明**，结论不可信：');
  for (const r of blindReasons) console.log(`   ✘ ${r}`);
}
if (NO_WSL) {
  console.log('\n⚠ 已用 --no-wsl **跳过** WSL 侧 —— 本闸门此时**没有做双份比对**，结论不代表两份已同步。');
}

const gitNote = gitBlind.length
  ? `git 历史参考：**已失明**（${gitBlind.length} 条原因）`
  : (gitSame ? 'git 历史参考：两侧 HEAD 相同' : (gitForked ? `git 历史参考：**已分叉**（WIN ${sh10(winGit.head)} / WSL ${sh10(wslGit.head)}）` : 'git 历史参考：无法比对'));
console.log(`\n[闸门·git 判据] ${gitNote} —— **参考级，不影响退出码**（见头注释 ⑤）`);
console.log(`[闸门] 双份副本同步：源文件漂移 ${srcDrift.length} 处、生成物 ${genDrift.length} 处+资产 ${assetDrift.length} 处（不计）${blind ? '、**已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exit(ok ? 0 : 1);
