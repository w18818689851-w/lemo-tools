#!/usr/bin/env node
/**
 * scripts/check-line-endings.mjs —— 「行尾卫生」闸门（本仓第 30 个 `check-*` 闸门）
 *
 * ★ ① 由来（**已造成过真实事故**，不是假想）：2026-10-06 日批，`D:/lemo-opuscar` 38 个风格里 **21 个废掉**。
 *   根因链（已实证，写在 `D:/lemo-opuscar/.gitattributes` 头注释里）：
 *     · 该仓此前**没有 `.gitattributes`**，而本机是**系统级 `core.autocrlf=true`**
 *       （工作区平时只靠 `.git/config` 里的**本地** `false` 才勉强保持 LF）；
 *     · ⇒ **新 clone 出来是全仓 CRLF**（实测 1295 个已跟踪文件 `w/crlf`）
 *       ⇒ 两侧 `core/` 字节不一致 ⇒ **编排器拒绝开工**（19 个 A 类硬拒 + 2 个音频链被 SIGTERM）；
 *     · ⇒ 还让两个闸门**假红**：`check-render-venc` 的正则要**裸 `\n`**（CRLF 匹配不上 ⇒ 10 个风格被判
 *       「找不到块」）、`check-dual-copy-sync` 报**源文件漂移 1161 处**。
 *   `.gitattributes` 是 2026-10-06 才补上的。★ 但**补上之后仍然没有任何闸门在守它** ——
 *   谁哪天删掉/改坏它、或往仓里塞一个 CRLF 文件，**不会有任何闸门响**，而后果就是同一批 21 个风格。立此闸门。
 *
 * ★ ② 判据（五条；每条都**机械可解释**）
 *
 *   J1 **`.gitattributes` 存在，且 git **实际生效**的 attr 是对的**（★ 看 attr，不看文件里写了什么）
 *      · 仓根 `.gitattributes` 必须存在；
 *      · 对本闸门登记的**文本扩展名**（`TEXT_EXT`）逐个 `git check-attr text eol -- __eol_probe__.<ext>`，
 *        要求 **`text ∈ {set, auto}` 且 `eol == lf`**；
 *      · 无扩展名的控制文件（`.gitignore` / `.gitattributes`）同样逐个探。
 *      ★ **为什么必须同时看 `text`（本闸门对题给判据的收紧，有实证理由）**：git 属性是**逐属性独立解析**的
 *        —— 若有人把 `*.js text eol=lf` 改写成 `*.js binary`（= `-text`），兜底那行 `* text=auto eol=lf`
 *        仍然把 `eol` 解析成 **`lf`** ⇒ **只看 `eol` 会假绿**（实测 `git check-attr text eol -- x.bin`
 *        ⇒ `text: unset` / `eol: lf`）。⇒ 判据是「`text` 没被 unset **且** `eol == lf`」。
 *
 *   J2 **工作区无 CRLF 文本文件**：`git ls-files --eol` 里**被本闸门判为文本**的路径不许出现
 *      `w/crlf` / `w/mixed`；另报 `i/crlf` / `i/mixed`（**入库 blob 自带 CR** ⇒ 入库时就没归一）；
 *      以及「被判为文本的路径却 `attr/-text`」（被 `.gitattributes` 单点标成二进制 ⇒ 行尾从此不受管）。
 *      ★ **按 `--eol` 的标记区分，绝不按字节扫**：`attr/-text` 那组（jpg/bin/woff2/mp4）**二进制里本来就
 *        可能含 0x0D**（实测 `core/assets/polyhaven/*.jpg` 就含）—— 按字节扫会**大量误报**。
 *
 *   J3 ★ **隐形漂移**（`git status` **看不见**的那种，本仓**真实存在过**）：对已跟踪的文本文件，读
 *      **工作区字节** 与 **`git show HEAD:<path>` 字节**，**去 CR 后相同、原样不同** ⇒ 报出。
 *      · 形态（实测，`D:/lemo-opuscar`）：`creative/dub-probe/_tx_payload.js`（15 个 CR）、
 *        `creative/dub-probe/film-hooked.js`（535 个 CR）—— 工作区 CRLF、仓库里存 LF，
 *        而 `*.js text eol=lf` 的 **clean 过滤把 CRLF 归一化了** ⇒ `git status` **报干净**。
 *      ★ **为什么这条独立于 J2**：J2 读的是 git 的 `--eol` **分类结果**（受 `.gitattributes` 支配），
 *        J3 读的是**字节真值**。当有人把某类文本标成二进制时（J1 只覆盖**登记过的扩展名**），J2 会沉默，
 *        J3 仍能按字节抓出来。两条**互为独立证据**：同一文件同时命中时**合并成一行**、证据都列出。
 *      ★ **安全性（不误报）**：判据要求「**只差 CR**」—— 真的有内容改动时去 CR 后也不相同 ⇒
 *        **不会**与 `git status` 重复报噪声。二进制更不会（`-text` 的路径不进本判据的扫描集）。
 *      ★★ **必须排除「合法的 CRLF 例外」**（首跑实测的误报，已修）：被 `.gitattributes` 声明 `eol=crlf` 的路径
 *        （本仓 `*.bat`/`*.cmd`）**工作区 CRLF、blob 存 LF** 是**设计如此**（clean 过滤一律把 CRLF 归一成 LF 入库）
 *        ⇒ 不排除就会把 `lemo-make.bat` / `start-console.bat` 报成「隐形漂移」（实测误报 **2/10 = 20%**）。
 *        判据用 `git ls-files --eol` 的 `attr/… eol=<v>` 字段**逐路径**取，不看文件名/扩展名硬编码。
 *      ★ **性能**：只对「工作区含 CR」的文件才去取 HEAD blob（`git cat-file --batch` **一次**批量取），
 *        真实语料下这个集合是 **0–8** 个 ⇒ 不扫全仓历史、不逐文件起进程。
 *
 *   J4 **失明守卫（防空转绿灯）**：仓根不存在 / 没有 `.git` / `git` 不可用 / `git ls-files` 枚举到 **0 个**
 *      ⇒ **FAIL 并明说「本闸门已失明」**（绝不静默 OK）。
 *
 *   J5 **两层语义**：命中若落在 `BACKLOG` 登记表里 ⇒ **只列不判 FAIL**（照本项目既有写法，同
 *      `check-render-venc` 的 B 类 / `check-dna-coverage` 的 backlog）。★ **本表当前故意为空**：
 *      唯一已知的真阳性（`creative/dub-probe/*.js`）**正在被别的智能体修** —— 把它登记进 backlog
 *      就等于「**为了让闸门变绿而放宽判据**」，明令禁止（见 ④）。
 *
 * ★ ③ 覆盖范围（**两个仓**，各按自己的 `.gitattributes` 判）
 *   · `opuscar`：默认 `D:/lemo-opuscar`，覆盖点 **`LEMO_OPUSCAR`**（与 `check-render-venc` /
 *     `check-mux-selection` / `check-esm-import-paths` 同名同义）。事故现场。`crlfExt` 为空 ——
 *     该仓**没有** `.bat`/`.cmd`（其 `.gitattributes` 头注释明写）。
 *   · `tools`：默认**本仓根**（`<脚本>/..`），覆盖点 **`LEMO_TOOLS_ROOT`**（与 `check-doc-coverage`
 *     **同名同义**）。本闸门自己住的仓，**同一种病** —— 实测首跑即抓到 **8** 个 `lib/style-dna/*.json`
 *     （工作区 CRLF、blob LF、`git status` 干净）。
 *     ★ 该仓 `.gitattributes` 有**合法的 CRLF 例外**：`*.bat` / `*.cmd`（cmd.exe 对 LF-only 解析不可靠）
 *       ⇒ 这两个扩展名按 **`eol=crlf`** 判，并要求被跟踪的这类文件**工作区确实是 `w/crlf`**
 *       （写成 LF 同样报 —— 那是**反方向**的行尾病，同样会让 cmd.exe 出错）。
 *   `--repo opuscar|tools` 可只跑一个（变异验证 / 局部调试用）。
 *
 * ★ ④ 已知局限 / 会误报的边界（**别当它不存在**）
 *   · **只守已跟踪文件**：`.gitignore` 排除的（`node_modules/**`、`demo/out/**`、`*.log`…）**不在判据内**
 *     —— 它们本就不入库、也不参与「两侧 `core/` 一致」。而新克隆的 CRLF 灾难**必然**落在已跟踪文件上，故够用。
 *   · **文本/二进制的边界是「扩展名清单」**（`TEXT_EXT` + 控制文件名 + `LICENSE-*`）：新增一类文本扩展名
 *     （如 `.toml`）而没往 `TEXT_EXT` 里补 ⇒ 那个类型**看不见**（与 `check-dual-copy-sync` 的
 *     `TEXT_NAME_GLOBS` 同一取舍：**只保证「被枚举到的」正确，不保证「该枚举的都枚举到了」**）。
 *   · J1 只探**登记的**扩展名 ⇒ `.gitattributes` 里别的行写坏了，本闸门不管（超出职责）。
 *   · J3 只对**工作区含 CR** 的文件取 HEAD blob ⇒ **反方向**（blob 带 CR、工作区无 CR）由 J2 的
 *     `i/crlf` 覆盖；当该路径被判为二进制时不覆盖（那时 blob 带 CR 是作者的合法选择）。
 *   · **不判「CRLF 该不该存在」的语义**：例外必须写进 `.gitattributes` + 本闸门 `crlfExt`，否则一律按 LF 判。
 *   · **不查 WSL 侧副本**（`/home/lemo/lemo-opuscar`）：那侧的行尾卫生由 **`check-dual-copy-sync.mjs`** 覆盖
 *     （它逐字节比两侧源文件 ⇒ WSL 侧单独 clone 成 CRLF 会以「**源文件漂移**」形式报出）。
 *     本闸门与它**互补**：**两侧都**是 CRLF 时 `check-dual-copy-sync` 反而全绿，本闸门（守 WIN 侧工作区/入库）
 *     仍会 FAIL。⇒ 两条一起跑才算把这一类关住。
 *   · **只读**：本闸门**不改任何文件、不动任何仓库**（不 add / commit / checkout / reset）。修法见输出末尾。
 *   · **实现坑（本机实测，2026-10-06）**：`spawnSync('git', …)` 在本机**一律 `EBUSY`**（连 `git --version`
 *     都失败）⇒ 本闸门**必须**用**异步 spawn**（与 `check-dual-copy-sync.mjs` 头注释记的 `wsl.exe` 那条同源）；
 *     `git cat-file --batch` 的 stdin **必须 `end()`**，否则子进程等 EOF 不返回（实测挂死）。
 *   · 性能：本闸门要读**全部已跟踪文件**（`opuscar` 90 MB）并批量取「含 CR 的文件」的 HEAD blob
 *     （实测 318 个二进制）⇒ 整闸门 **~3.8 s**（首版只扫文本文件时 ~1 s；用那 3 s 换「不依赖扩展名清单」值得）。
 *
 * ★ ⑤ 退出码：任一仓有 FAIL 级命中、或**任一仓失明** ⇒ 1；否则 0。
 *
 * 用法：node scripts/check-line-endings.mjs [--json] [--repo opuscar|tools]
 * 环境变量：
 *   LEMO_OPUSCAR     库仓根（默认 <本仓>/../lemo-opuscar，即 D:/lemo-opuscar）
 *   LEMO_TOOLS_ROOT  本工具仓根（默认 <脚本>/..，与 check-doc-coverage 同名同义）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_ROOT = path.resolve(HERE, '..');
const JSON_OUT = process.argv.includes('--json');
const REPO_FILTER = (() => {
  const i = process.argv.indexOf('--repo');
  return i >= 0 ? String(process.argv[i + 1] || '') : '';
})();

// ── 判据用的「文本类型」契约（本闸门**唯一**的期望；见头注释 ②/④）─────────────
const TEXT_EXT = ['py', 'mjs', 'js', 'cjs', 'sh', 'html', 'css', 'json', 'md', 'txt', 'srt', 'csv', 'yml', 'gltf'];
const TEXT_NAMES = ['LICENSE', 'CREDITS', 'NOTICE', 'COPYING', 'AUTHORS', '.gitignore', '.gitattributes', '.editorconfig', '.gitmodules'];
const extOf = (p) => {
  const base = p.split('/').pop();
  const d = base.lastIndexOf('.');
  return d > 0 ? base.slice(d + 1).toLowerCase() : '';
};
const baseOf = (p) => p.split('/').pop();
const isTextPath = (p) => {
  const base = baseOf(p);
  if (TEXT_NAMES.includes(base) || base.startsWith('LICENSE-')) return true;
  return TEXT_EXT.includes(extOf(p));
};

// ★ J5 两层语义：命中且匹配本表 ⇒ 只列不判 FAIL。**当前故意为空**（见头注释 J5）。
//   加条目的正确姿势（本项目既有写法）：`{ re: /^路径正则$/, why: '为什么允许（要点名是谁、何时清）' }`
const BACKLOG = [];
const isBacklog = (p) => BACKLOG.find((b) => b.re.test(p)) || null;

// ── 覆盖点 ─────────────────────────────────────────────────────────────────
const REPOS = [
  {
    name: 'opuscar', label: '库仓（事故现场）',
    root: process.env.LEMO_OPUSCAR || path.resolve(TOOLS_ROOT, '..', 'lemo-opuscar'),
    crlfExt: [],
  },
  {
    name: 'tools', label: '工具仓（本闸门所在仓）',
    root: process.env.LEMO_TOOLS_ROOT || TOOLS_ROOT,
    crlfExt: ['bat', 'cmd'],
  },
].filter((r) => !REPO_FILTER || r.name === REPO_FILTER);

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
const countCR = (buf) => { let n = 0; for (const b of buf) if (b === 0x0d) n++; return n; };
const stripCR = (buf) => Buffer.from(buf.toString('binary').replace(/\r/g, ''), 'binary');

/** ★ 必须用**异步 spawn**：本机实测 `spawnSync('git', …)` **一律 `EBUSY`**
 *  （连 `git --version` 都失败；同 `check-dual-copy-sync.mjs` 头注释记的 `wsl.exe` 那条）。
 *  `input` 非空时写进子进程 stdin 并**总是** end（`git cat-file --batch` 靠 EOF 收尾）。 */
function sh(cmd, args, input) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { windowsHide: true });
    const chunks = [];
    let e = '';
    c.stdout.on('data', (d) => chunks.push(d));
    c.stderr.on('data', (d) => { e += d; });
    c.on('close', (code) => {
      const buf = Buffer.concat(chunks);
      resolve({ code, buf, out: buf.toString('utf8'), err: e });
    });
    c.on('error', (x) => resolve({ code: -1, buf: Buffer.alloc(0), out: '', err: String(x.message) }));
    c.stdin.on('error', () => { /* 子进程提前退出时忽略 EPIPE */ });
    try {
      if (input != null) c.stdin.write(input);
      c.stdin.end();
    } catch { /* 子进程已退出：忽略 */ }
  });
}

const git = (root, args, input) => sh('git', ['-C', root, ...args], input);

/** 解析 `git cat-file --batch` 的输出：按**输入顺序**逐条读 `<sha> <type> <size>\n<content>\n`。
 *  找不到的对象输出 `<name> missing`（此时记 null）。返回 Map<path, Buffer|null>。 */
function parseBatch(buf, names) {
  const map = new Map();
  let pos = 0;
  for (const name of names) {
    const nl = buf.indexOf(0x0a, pos);
    if (nl < 0) { map.set(name, null); continue; }
    const header = buf.toString('utf8', pos, nl);
    pos = nl + 1;
    const parts = header.split(' ');
    const size = parts.length >= 3 && /^\d+$/.test(parts[2]) ? Number(parts[2]) : -1;
    if (size < 0) { map.set(name, null); continue; }   // `<name> missing` / ambiguous
    map.set(name, buf.subarray(pos, pos + size));
    pos += size + 1;                                   // 内容之后那个 \n
  }
  return map;
}

async function analyze(repo) {
  const R = repo.root;
  const out = { name: repo.name, label: repo.label, root: R, crlfExt: repo.crlfExt, blind: [], attrViol: [], fileViol: [], backlog: [], stats: {} };
  if (!fs.existsSync(R)) { out.blind.push(`仓根不存在：${R}`); return out; }
  if (!fs.existsSync(path.join(R, '.git'))) { out.blind.push(`\`${R}\` 下没有 \`.git\`（该路径不是 git 仓库的根）`); return out; }

  // ── 先取 `git ls-files --eol`（J2 的数据源；同时给 J1 提供「本仓实际有哪些扩展名」）──
  //   ★ 顺序说明：放在 J1 **之前**，是因为 J1 里 `crlfExt` 的探测要「**该扩展名在本仓真的存在**才要求」——
  //     否则一个只用 `.bat`、没有 `.cmd` 的仓会被无端判 FAIL（过严；实测夹具 `fx-tools-ok` 踩到过）。
  const lsf = await git(R, ['ls-files', '--eol', '-z']);
  if (lsf.code !== 0) {
    out.blind.push(`\`git ls-files --eol\` 失败（exit=${lsf.code}）：${(lsf.err.split('\n')[0] || '').slice(0, 160)}`);
    return out;
  }
  const recs = [];
  for (const chunk of lsf.out.split('\0')) {
    if (!chunk) continue;
    const tab = chunk.indexOf('\t');
    if (tab < 0) continue;
    const head = chunk.slice(0, tab).trim().split(/\s+/);
    recs.push({
      i: String(head[0] || '').slice(2),          // i/lf → lf
      w: String(head[1] || '').slice(2),          // w/crlf → crlf
      attrText: String(head[2] || '').replace(/^attr\//, ''),   // attr/text=auto → text=auto
      attrEol: (String(head.slice(2).join(' ')).match(/(?:^|\s)eol=(\S+)/) || [, null])[1],  // attr/text eol=crlf → crlf
      path: chunk.slice(tab + 1),
    });
  }
  out.stats.tracked = recs.length;
  if (recs.length === 0) {
    out.blind.push(`\`git ls-files\` 在 \`${R}\` 枚举到 **0 个**已跟踪文件（路径/过滤变了？）`
      + ' ⇒ 一条行尾判据都没检查过');
    return out;
  }

  // ── J1：`.gitattributes` 存在 + git 实际生效的 attr 正确 ──────────────────
  if (!fs.existsSync(path.join(R, '.gitattributes'))) {
    out.attrViol.push('仓根**没有** `.gitattributes` ⇒ 行尾全靠 `core.autocrlf` 猜'
      + '（本机是**系统级 `true`**，正是 2026-10-06 事故的根因）');
  }
  const presentExt = new Set(recs.map((r) => extOf(r.path)));
  const probes = [
    ...TEXT_EXT.map((e) => ({ p: `__eol_probe__.${e}`, want: 'lf' })),
    ...['.gitignore', '.gitattributes'].map((n) => ({ p: n, want: 'lf' })),
    // ★ 只探「本仓真的存在该扩展名」的 crlfExt（见上面的顺序说明）
    ...repo.crlfExt.filter((e) => presentExt.has(e)).map((e) => ({ p: `__eol_probe__.${e}`, want: 'crlf' })),
  ];
  const chk = await git(R, ['check-attr', 'text', 'eol', '--', ...probes.map((x) => x.p)]);
  if (chk.code !== 0) {
    out.blind.push(`\`git check-attr\` 失败（exit=${chk.code}）：${(chk.err.split('\n')[0] || '').slice(0, 160)}`);
    return out;
  }
  const attrs = new Map();
  for (const line of chk.out.split('\n')) {
    if (!line) continue;
    const m = line.match(/^(.*): (text|eol): (.*)$/);
    if (!m) continue;
    const rec = attrs.get(m[1]) || {};
    rec[m[2]] = m[3];
    attrs.set(m[1], rec);
  }
  for (const { p, want } of probes) {
    const a = attrs.get(p);
    if (!a) { out.attrViol.push(`\`git check-attr\` 没有返回 \`${p}\` 的 attr（解析失败？）`); continue; }
    const textOk = a.text === 'set' || a.text === 'auto';
    if (!textOk) { out.attrViol.push(`\`${p}\` → \`text: ${a.text}\`（期望 set/auto）`); continue; }
    if (a.eol !== want) out.attrViol.push(`\`${p}\` → \`eol: ${a.eol}\`（期望 \`${want}\`）`);
  }
  if (out.attrViol.length) {
    out.attrNote = '★ **为什么 `text` 也要看（只看 `eol` 会假绿）**：git 属性是**逐属性独立解析**的 ——'
      + ' 把 `*.js text eol=lf` 改写成 `*.js binary`（= `-text`）后，兜底的 `* text=auto eol=lf` 仍把 `eol` 报成 `lf`'
      + '（实测 `git check-attr text eol -- x.bin` ⇒ `text: unset` / `eol: lf`）⇒ 只看 `eol` 会漏掉「行尾从此不受管」。';
  }

  // ── J2：按 `git ls-files --eol` 的**标记**判（不按字节扫）──────────────────
  const perPath = new Map();   // path → { cls:Set, detail:[] }
  const addViol = (p, cls, detail) => {
    const rec = perPath.get(p) || { path: p, cls: new Set(), detail: [] };
    rec.cls.add(cls);
    if (detail) rec.detail.push(detail);
    perPath.set(p, rec);
  };

  const textish = (p) => isTextPath(p) || repo.crlfExt.includes(extOf(p));
  out.stats.text = recs.filter((r) => textish(r.path)).length;
  out.stats.crlfMandated = recs.filter((r) => repo.crlfExt.includes(extOf(r.path))).length;
  out.stats.crlfExtPresent = repo.crlfExt.filter((e) => presentExt.has(e));

  for (const r of recs) {
    if (!textish(r.path)) continue;                       // ★ 二进制（jpg/bin/woff2/mp4…）不进判据
    const mandatedCrlf = repo.crlfExt.includes(extOf(r.path));
    if (r.attrText === '-text') {
      addViol(r.path, 'J2', '`attr/-text` —— 被判为文本的路径被 `.gitattributes` 单点标成**二进制** ⇒ 行尾不再受管');
      continue;
    }
    if (mandatedCrlf) {
      // ★ 反方向：这类文件**必须**是 CRLF（cmd.exe 对 LF-only 解析不可靠）
      if (r.w !== 'crlf') addViol(r.path, 'J2', `工作区 \`w/${r.w}\`（本仓要求 \`crlf\`：cmd.exe 对 LF-only 解析不可靠）`);
      continue;
    }
    if (r.w === 'crlf' || r.w === 'mixed') addViol(r.path, 'J2', `工作区 \`w/${r.w}\`（应为 \`lf\`）`);
    if (r.i === 'crlf' || r.i === 'mixed') addViol(r.path, 'J2', `入库 blob \`i/${r.i}\`（应为 \`lf\`：入库时就没归一）`);
  }

  // ── J3：字节级「隐形漂移」（独立于 .gitattributes 的真值判据）─────────────
  // ★ 扫描集 = **全部已跟踪文件**（**不按扩展名过滤**）—— 这正是 J3 独立于 J1/J2 的地方：
  //   J1 只探登记的扩展名、J2 只认 `TEXT_EXT` 清单，两者对「新塞进来的 `.toml`/`.ts`/`.ini` CRLF 文件」**都瞎**；
  //   J3 只看「工作区与 HEAD 是否只差 CR」，**不关心扩展名** ⇒ 能把那一类抓出来。
  //   ★ 代价可控：真实语料下「含 CR 的已跟踪文件」opuscar **318** 个（全是 jpg/bin/woff2/mp4 这类
  //     本来就可能含 0x0D 的二进制）、tools **10** 个 ⇒ HEAD blob 一次 `cat-file --batch` 批量取，实测约 +1s。
  //   ★ 二进制不会因此误报：它们与 HEAD **逐字节相同**（未改动）⇒ `rawSame` 直接跳过；
  //     真的改过内容 ⇒ 去 CR 后也不相同 ⇒ 也跳过。只有「**只差 CR**」才报。
  const withCR = [];
  for (const r of recs) {
    // ★ 该路径的 git 生效 `eol=crlf`（如本仓的 `*.bat`/`*.cmd`）⇒ **工作区 CRLF 是设计如此**、
    //   blob 存 LF 也是设计如此（clean 过滤一律把 CRLF 归一成 LF 入库）⇒ **必须排除**，
    //   否则会把合法的 CRLF 例外报成「隐形漂移」（实测首跑就在 `lemo-make.bat`/`start-console.bat` 上误报 2 处）。
    if (r.attrEol === 'crlf') continue;
    // ★ 路径含换行会破坏 `cat-file --batch` 的「按 `\n` 分行」协议 ⇒ 本判据对它**失明**（J2 用 `-z`，不受影响）。
    //   本两仓实测无此路径（同 `check-dual-copy-sync` 头注释 ③ 的记法）。
    if (r.path.includes('\n')) continue;
    let buf;
    try { buf = fs.readFileSync(path.join(R, r.path)); } catch { continue; }   // 缺失/读不到 ⇒ 跳过（不算违规）
    const cr = countCR(buf);
    if (cr === 0) continue;                              // ★ 无 CR ⇒ 不可能是「只差 CR」的漂移
    withCR.push({ path: r.path, size: buf.length, cr, rawMd5: md5(buf), noCrMd5: md5(stripCR(buf)), textish: textish(r.path) });
  }
  out.stats.withCR = withCR.length;
  if (withCR.length) {
    const names = withCR.map((x) => `HEAD:${x.path}`);
    const b = await git(R, ['cat-file', '--batch'], names.join('\n') + '\n');
    if (b.code !== 0) {
      out.blind.push(`\`git cat-file --batch\` 失败（exit=${b.code}）：${(b.err.split('\n')[0] || '').slice(0, 160)}`);
    } else {
      const headMap = parseBatch(b.buf, names);
      for (const x of withCR) {
        const head = headMap.get(`HEAD:${x.path}`);
        if (!head) continue;                             // HEAD 里没有（新文件/未提交）⇒ 跳过
        if (md5(head) === x.rawMd5) continue;            // 与 HEAD 逐字节相同 ⇒ 无漂移
        if (md5(stripCR(head)) !== x.noCrMd5) continue;  // 内容真的改了（不是只差 CR）⇒ 交给 git status，不报
        addViol(x.path, 'J3', `**隐形漂移**：工作区 ${x.cr} 个 CR（${x.size}B）与 \`HEAD\` blob **去 CR 后逐字节相同**、`
          + '原样不同 ⇒ `git status` **看不见**（clean 过滤把它归一化了）'
          + (x.textish ? '' : '　★ **该路径不在本闸门的 `TEXT_EXT` 清单里** ⇒ 这条只有 J3（字节级、不依赖扩展名）看得见'));
      }
    }
  }

  // ── 汇总（J5 两层语义：命中 BACKLOG 的只列不判）───────────────────────────
  for (const rec of perPath.values()) {
    const hit = isBacklog(rec.path);
    if (hit) out.backlog.push({ ...rec, cls: [...rec.cls], why: hit.why });
    else out.fileViol.push({ ...rec, cls: [...rec.cls] });
  }
  out.fileViol.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

const unknownRepo = REPO_FILTER && REPOS.length === 0;
const results = unknownRepo ? [] : await Promise.all(REPOS.map(analyze));

const blindAll = unknownRepo
  ? [{ name: '—', label: '—', root: REPO_FILTER, crlfExt: [], blind: [`\`--repo ${REPO_FILTER}\` 不是已知的仓名（可选：opuscar / tools）`], attrViol: [], fileViol: [], backlog: [], stats: {} }]
  : results;

const blind = blindAll.flatMap((r) => r.blind.map((b) => `[${r.name}] ${b}`));
const attrViolCount = blindAll.reduce((n, r) => n + r.attrViol.length, 0);
const fileViolCount = blindAll.reduce((n, r) => n + r.fileViol.length, 0);
const backlogCount = blindAll.reduce((n, r) => n + r.backlog.length, 0);
const ok = !blind.length && attrViolCount === 0 && fileViolCount === 0;

if (JSON_OUT) {
  console.log(JSON.stringify({
    repos: blindAll.map((r) => ({
      name: r.name, label: r.label, root: r.root, stats: r.stats,
      blind: r.blind, attrViol: r.attrViol, attrNote: r.attrNote || null,
      fileViol: r.fileViol.map((v) => ({ path: v.path, classes: v.cls, detail: v.detail })),
      backlog: r.backlog.map((v) => ({ path: v.path, classes: v.cls, why: v.why })),
    })),
    counts: { attrViol: attrViolCount, fileViol: fileViolCount, backlog: backlogCount, blind: blind.length },
    backlogTable: BACKLOG.map((b) => b.why),
    ok,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

// ── 文本输出 ───────────────────────────────────────────────────────────────
console.log('行尾卫生闸门 —— 「两侧副本必须逐字节一致」的地基（约定三）');
console.log('  判据: J1 `.gitattributes` 真的生效（看 git 实际 attr）| J2 工作区/入库无 CRLF 文本 |');
console.log('        J3 字节级隐形漂移（git status 看不见的那种）| J4 失明守卫 | J5 backlog 只列不判');
for (const r of blindAll) {
  console.log(`  · ${r.name.padEnd(8)} ${r.root}`
    + `  （已跟踪 ${r.stats.tracked == null ? '?' : r.stats.tracked} 个、判为文本 ${r.stats.text == null ? '?' : r.stats.text} 个`
    + `、工作区含 CR ${r.stats.withCR == null ? '?' : r.stats.withCR} 个）`);
}
console.log('');

for (const r of blindAll) {
  console.log(`── [${r.name}] ${r.label} ──`);
  if (r.blind.length) {
    for (const b of r.blind) console.log(`  ✘ ${b}`);
    console.log('');
    continue;
  }
  if (r.attrViol.length) {
    console.log(`  ✘ J1 \`.gitattributes\` 判据失败 ${r.attrViol.length} 条（判 FAIL）：`);
    for (const v of r.attrViol) console.log(`      · ${v}`);
    if (r.attrNote) console.log(`      ${r.attrNote}`);
  } else {
    console.log(`  ✓ J1 \`.gitattributes\` 存在，且 ${TEXT_EXT.length} 个文本扩展名 + 2 个控制文件`
      + `${(r.stats.crlfExtPresent || []).length ? ` + ${r.stats.crlfExtPresent.join('/')}(要求 crlf)` : ''} 的 git 生效 attr 都对`);
  }
  if (r.fileViol.length) {
    console.log(`  ✘ J2/J3 文件级违规 ${r.fileViol.length} 处（判 FAIL）：`);
    for (const v of r.fileViol) {
      console.log(`      ✘ ${v.path}`);
      for (const d of v.detail) console.log(`          · [${v.cls.join('+')}] ${d}`);
    }
  } else {
    console.log('  ✓ J2/J3 无违规：被跟踪的文本文件工作区/入库都是 LF，且与 HEAD 无「只差 CR」的隐形漂移');
  }
  if (r.backlog.length) {
    console.log(`  ℹ J5 backlog（已登记积压，**只列不判 FAIL**）${r.backlog.length} 处：`);
    for (const v of r.backlog) console.log(`      · ${v.path} —— ${v.why}`);
  }
  console.log('');
}

if (blind.length) {
  console.log('✘✘ 本闸门已**失明**（结论不可信，绝不静默 OK）：');
  for (const b of blind) console.log(`   ✘ ${b}`);
  console.log('');
}

if (fileViolCount || attrViolCount) {
  console.log('修法（★ 本闸门**只读**，不改文件、不动仓库）：');
  console.log('  · J1（`.gitattributes` 缺失/被改坏）⇒ 补回 `* text=auto eol=lf` + 各文本扩展名 `text eol=lf`');
  console.log('    （照 `D:/lemo-opuscar/.gitattributes` 的写法；**改完要重新 checkout 才能改写工作区**）。');
  console.log('  · J2/J3（工作区文件是 CRLF）⇒ 把那个文件重写成 LF（`tr -d "\\r" < f > f.tmp && mv f.tmp f` 或等价写法），');
  console.log('    或 `git checkout -- <path>`（注意：**会丢弃该文件未提交的改动**，先确认没人在改）。');
  console.log('    ★ **不要**为了让本闸门变绿去放宽判据（`BACKLOG` 只登记**已确认**的积压，且要点名清理责任人）。');
  console.log('');
}

console.log(`[闸门] 行尾卫生：J1 ${attrViolCount} 条、J2/J3 文件级 ${fileViolCount} 处、backlog ${backlogCount} 处（不计）`
  + `${blind.length ? '、**已失明**' : ''} ${ok ? 'OK' : '✘'}`);
process.exit(ok ? 0 : 1);
