#!/usr/bin/env node
/**
 * lemo-make.mjs — lemo-opuscar 跨 Windows/WSL 统一编排器
 *
 * 设计前提（由实测确定，勿轻易改动）：
 *   · WebGL 渲染只能在 Windows 侧用上 GPU —— WSL 的 /dev/dri/card0 是 platform:vgem 虚拟占位设备，
 *     Chromium 无论传什么 ANGLE 后端都回退 SwiftShader（实测 4 种配置全失败）。
 *     Windows 侧带 --enable-gpu 时渲染器是 ANGLE(NVIDIA, RTX 4060, D3D11)，实测 4.8~6.2 倍加速。
 *   · 音频（TTS/配乐/混音）与混流留在 WSL —— WSL 的 ffmpeg 实测带可用的 h264_nvenc，
 *     所以硬件编码不需要搬到 Windows。
 *
 * 因此编排层以 Windows 为外壳（GPU 渲染不可外包），通过 wsl.exe 调 WSL 做音频与混流。
 *
 * ⚠️ 全异步：本环境里 child_process.spawnSync 一律返回 EBUSY（连 `cmd /c echo` 都不行），
 *    异步 spawn 正常。所以本文件不使用任何 spawnSync。
 *
 * 用法：
 *   node lemo-make.mjs <demo-slug> [选项]
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// ── 风格特质档案（style-dna）——「主题+风格」这条通路也读**同一个**知识库（约定一）──
// ★ 复用 lib/style-dna-reader.mjs（与 dub.mjs 是**同一个**读取入口），绝不另建一套读取。
// ★ 只读、缺失即降级：读不到 / 坏文件 / 非法 slug → null，调用方按「无档案」继续
//   ⇒ 档案缺失时行为与改动前逐字节一致（DNA 是增强，不是替代）。
import { readStyleDna, summarizeStyleDna, describeStyleDna } from './lib/style-dna-reader.mjs';
// ★ 风格 Skill 文档（11 节制作方案）—— 与 dub.mjs 共用**同一个**读取入口，不另建一套。
import { readStyleSkill, summarizeStyleSkill, describeStyleSkill } from './lib/style-skill-reader.mjs';
// ★ 出片前的显存预检 + 自动腾挪 —— 与 dub.mjs 的 TTS 前守卫是**同一个**接口、**同一套**语义。
//   主题通路的 TTS 在 WSL 里跑，但显存判据（nvidia-smi）读的是 **Windows** 这张卡，
//   所以守卫只能在 Windows 侧 JS 里调，不能塞进 WSL 的 bash 脚本（那里读不到这张卡）。
//   调用点在下面「音频链路」之前（见那里的说明）。
import { ensureVramFree } from './lib/vram.mjs';

// ─────────────────────────── 配置 ───────────────────────────

const CFG = {
  wslDistro: 'Ubuntu-24.04',
  wslUser: 'lemo',
  // 库根（两侧各一处）：Windows 侧供渲染/混流取脚本与产物，WSL 侧供音频链（TTS/配乐/拟音/混音）读素材。
  // ★ 两处都可用环境变量覆盖，用途就是「让**新 clone / 临时副本**能被端到端验证」——
  //   否则编排器永远只跑 D:\lemo-opuscar 这棵真库，clone 到底能不能跑只能靠静态分析猜。
  // ★ 默认值即原来的写死值 ⇒ **不设这两个变量时行为逐字节不变**。
  // ★ 必须**成对**设置：只覆盖一侧会让 Windows 与 WSL 指向不同的库（两侧不一致），编排器会拒绝开工。
  wslLib: process.env.LEMO_LIB_WSL || '/home/lemo/lemo-opuscar',
  winLib: process.env.LEMO_LIB_WIN || 'D:\\lemo-opuscar',
  tmpDir: 'D:\\WSL',
  exportDir: 'D:\\lemo-films',
  // 起飞前检查（pre-flight）读的 demo 链路声明。**可缺失**：文件不在 / JSON 坏了，
  // 整个检查静默跳过（见 preflight 的三条硬约束）。可用 --manifest 或环境变量 LEMO_MANIFEST 覆盖。
  manifestPath: process.env.LEMO_MANIFEST
    || 'D:\\workbuddyAI\\huancun999\\Opus 5.5\\lemo-opuscar-notes\\demo-manifest-all.json',
  // Windows ffmpeg 候选（按优先级）。video.mjs 内部是 spawn('ffmpeg', …)，
  // 所以必须把这个目录注入 PATH，否则渲染会在写分段时失败。
  ffmpegDirs: [
    'D:\\ffmpeg-9.x\\ffmpeg-9.0.2-full_build\\bin',
    'D:\\Feijian\\_internal',
  ],
};

// ─────────────────────────── 输出 ───────────────────────────

const C = {
  dim: s => `\x1b[2m${s}\x1b[0m`,
  ok: s => `\x1b[32m${s}\x1b[0m`,
  warn: s => `\x1b[33m${s}\x1b[0m`,
  err: s => `\x1b[31m${s}\x1b[0m`,
  b: s => `\x1b[1m${s}\x1b[0m`,
};

let STEP = 0;
const t0 = Date.now();
const el = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

function step(title) { STEP++; console.log(`\n${C.b(`[${STEP}] ${title}`)}`); }
function info(msg) { console.log(`    ${msg}`); }
function ok(msg) { console.log(`    ${C.ok('✓')} ${msg}`); }
function warn(msg) { console.log(`    ${C.warn('!')} ${msg}`); }
function fail(msg) { console.error(`\n${C.err('✗ ' + msg)}`); process.exit(1); }

// ─────────────────────────── 进程执行 ───────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 异步执行并收集输出。不经过 shell（数组传参），免疫引号/空格/中文路径问题。
 * 带退避重试：并发调用 wsl.exe 时实测会出现 EBUSY，是瞬时的。
 *
 * onChunk（可选）：每收到一片 stdout/stderr 就回调一次，用于「边收边透传」的长任务。
 *   ★ 默认 null —— 不传时行为与加这个参数之前**逐字节相同**（只累积、不输出）。
 *   ★ 透传与累积**同时**做：调用方既能实时看到输出，又能拿到完整 r.stdout 去做正则匹配
 *     （音频链路靠 `MIX_OK` / `STEP_FAIL` / `STEP_WARN` 判断成败，不能只图实时而丢掉返回值）。
 */
function run(exe, args, opts = {}, { quiet = false, maxRetry = 5, onChunk = null } = {}) {
  return new Promise(resolve => {
    const attempt = (n) => {
      let child;
      try {
        child = spawn(exe, args, { windowsHide: true, ...opts });
      } catch (e) {
        return resolve({ code: -1, stdout: '', stderr: '', error: e });
      }
      let stdout = '', stderr = '';
      child.stdout?.on('data', d => { stdout += d; if (onChunk) onChunk('stdout', d); });
      child.stderr?.on('data', d => { stderr += d; if (onChunk) onChunk('stderr', d); });
      const done = (code, error) => {
        const transient = error && ['EBUSY', 'EAGAIN', 'EMFILE', 'ENFILE'].includes(error.code);
        if (transient && n < maxRetry) {
          const wait = 250 * n;
          if (!quiet) console.log(C.dim(`    （${path.basename(exe)} 返回 ${error.code}，${wait}ms 后重试 ${n}/${maxRetry - 1}）`));
          return sleep(wait).then(() => attempt(n + 1));
        }
        resolve({ code, stdout, stderr, error });
      };
      child.on('error', e => done(-1, e));
      child.on('close', code => done(code, null));
    };
    attempt(1);
  });
}

/** 异步执行并把输出实时透传（长任务）。 */
function runLive(exe, args, opts = {}) {
  return new Promise(resolve => {
    const p = spawn(exe, args, { stdio: 'inherit', windowsHide: true, ...opts });
    p.on('error', e => resolve({ code: -1, error: e }));
    p.on('close', code => resolve({ code }));
  });
}

/**
 * 在 WSL 里执行一段 shell。
 * 关键：脚本先写到 D:\WSL\<name>.sh，再在 WSL 内 sed 去 CR 后执行。
 * 直接内联多行 bash 通过 wsl.exe 传参会被吃掉变量、错乱引号（本项目反复踩过）。
 *
 * ★ stream: true —— 输出边收边透传（仅长任务需要，见下）。
 *   默认 false：仍是「等 wsl.exe 退出才一次性拿到 stdout」的缓冲语义。
 *   为什么需要它（实测的 UX 缺陷）：音频链路是唯一一条**长且安静**的 WSL 路径 ——
 *     实测 ascii-crt --skip-sync 一次真实出片，音频步骤的标题打在第 10.1s，
 *     而它**第一行**输出直到 362.3s 才出现，中间 352.2 秒屏幕上一个字都没有；
 *     第 63~85 行（配音/声线/ASR/配乐/混音的全部输出）时间戳全挤在 362.4s。
 *     渲染那一步之所以不卡，是因为它走 runLive（stdio: inherit，天然流式）。
 *     ⚠️ 这个缺陷用 --dry-run **永远测不出来**（dry-run 不跑音频）。
 *   ★ 只改「怎么显示」，**不改退出码语义**：命令构造一个字没动，`su` 仍是最后一条命令，
 *     它的退出码仍原样成为 wsl.exe 的退出码 —— 0 与非 0 仍可区分（音频链路靠它判成败）。
 *   ★ 脚本里的 `trap 'rm -f …' EXIT` 清理也照旧（脚本正文未被改动）。
 */
async function runWsl(script, { name = '_lemo-orch', asUser = CFG.wslUser, args = '', stream = false } = {}) {
  // ⚠️ 退出码：**最后一条命令绝不能是 `exit $rc`** —— 实测 `$?` / `$rc` 在这一跳会被提前展开
  //    （`$?`→0、`$rc`→空串），`exit $rc` 退化成裸 `exit`，于是本函数**永远返回 0**。
  //    后果：唯一没有兜底的路径「库同步失败」被静默当成功 —— 同步脚本自己 exit 1 并打印
  //    `❌ WORK 目录不可写 … 拒绝继续`，编排器却照报 `✓ 同步完成` 继续往下跑。
  //    改法：让 `su` 成为**最后一条命令**，它的退出码直接成为 bash -c / wsl.exe 的退出码；
  //    清理改由脚本内的 trap 负责。
  //    实测（`D:\WSL\rc2-test.mjs`，命令构造：`su - lemo -c "bash /tmp/x.sh"`）：
  //      内层 exit 0/1/3/7/42 → 外层拿到 0/1/1/1/1。**具体码被 su 归一成 1**。
  //    ⚠️ 此测量**与命令构造有关**：另有验证者在别的构造下测到「如实透传 0/1/3/7/42」。
  //      两者结论不一致，尚未定位差异来源（可能是 su/PAM 配置或 wrapper 差异）。
  //      因此**不要依赖这里的数字**，只依赖「0 与非 0 可区分」这个已确认的事实。
  //    调用方**只能用 `code !== 0` 判断成败**：同步脚本用 `code !== 0`；闸门改成哈希比对；
  //    混流与音频用 `MIX_OK` / `STEP_FAIL` 正则。若将来需要具体码，
  //    改法是让脚本把退出码写进一个文件、再单独读一次（多一次 wsl 调用）。
  //
  // ⚠️ 临时文件名必须**每次唯一**：两个 lemo-make 实例并发时，如果都用固定的
  //    /tmp/_lemo-mux.sh，后写的会覆盖先写的 —— 先写的那次会执行到别人的脚本。
  //    实测过一次：跑 ascii-crt 却报出 ukiyoe 的错（`$S/ukiyoe.mp4`）。
  const uniq = `${name}-${process.pid}-${Date.now().toString(36)}`;
  const hostPath = path.join(CFG.tmpDir, `${uniq}.sh`);
  fs.mkdirSync(CFG.tmpDir, { recursive: true });
  const inner = `/mnt/${hostPath[0].toLowerCase()}${hostPath.slice(2).replace(/\\/g, '/')}`;
  const body =
    `trap 'rm -f /tmp/${uniq}.sh "${inner}" 2>/dev/null' EXIT\n` +
    script.replace(/\r\n/g, '\n');
  fs.writeFileSync(hostPath, body, 'utf8');
  const cmd =
    `sed 's/\\r$//' '${inner}' > /tmp/${uniq}.sh && chmod 644 /tmp/${uniq}.sh && ` +
    `chown ${asUser} /tmp/${uniq}.sh && ` +
    `su - ${asUser} -c "bash /tmp/${uniq}.sh ${args}"`;
  // 透传原始分片（Buffer 直写，不重新解码）—— 多字节字符被切在分片边界上也不会变问号。
  // 行切分交给下游（控制台 lib/jobs.mjs 的 feed 本来就按行累积），这里不掺和。
  const tee = (s, d) => { (s === 'stderr' ? process.stderr : process.stdout).write(d); };
  return run('wsl.exe', ['-d', CFG.wslDistro, '-u', 'root', '--', 'bash', '-c', cmd],
    { env: { ...process.env, WSL_UTF8: '1' } },
    stream ? { onChunk: tee } : {});
}

/** 找一个可用的 Windows ffmpeg 目录。 */
function findFfmpegDir() {
  for (const d of CFG.ffmpegDirs) {
    if (fs.existsSync(path.join(d, 'ffmpeg.exe'))) return d;
  }
  return null;
}

// ───────────────── P0：demo 级软链 node_modules → Windows junction ─────────────────
/**
 * ★ 为什么要有这个（40 个 demo 全量音频实测里唯一一个「缺结构」类失败）：
 *   styles/paper-popup/demo/node_modules 在 WSL 侧是**软链** → /home/lemo/lemo-opuscar/node_modules，
 *   而它的页面 index.html 用**相对路径** importmap（./node_modules/three/build/three.module.js）。
 *   同步脚本不处理软链、且按名 --exclude=node_modules/ ⇒ Windows 侧那条链根本不存在
 *   ⇒ events.mjs 一开页面就 404，第 3 步直接死。**全仓只有这一个 demo 用这种结构。**
 *
 * 修法：Windows 侧建**等价 junction**（`mklink /J`，不需要管理员权限）。
 *   ⚠️ 不能用符号链接 —— Windows 的 symlink 需要管理员或开发者模式，普通用户会直接失败。
 *
 * 安全约束（都不许破）：
 *   · 幂等：已经是 junction 就跳过，不重建、不出声报错；
 *   · 已存在但不是 junction（真目录/真文件）→ 只警告并跳过，**绝不删**；
 *   · 只处理「WSL 侧确实是软链、且指向仓库根 node_modules」的那种 ——
 *     软链指向别处的（语义未知）不动，只警告；
 *   · 失败要出声：静默放过的话，后面会以「events.mjs 404」的形式现形，归因困难。
 */
async function ensureDemoNodeModulesJunctions() {
  // ① 探测：WSL 侧 styles/*/demo/node_modules 里哪些是软链、指向哪里。
  //    一条命令拿全，不做 per-slug 往返。没有匹配时循环体不执行，输出为空。
  // ⚠️ shell 里不许出现美元大括号写法 —— 会与 JS 模板字符串的插值撞车（本文件反复踩过），
  //    所以路径拼接用 dirname 而不是 ${d%...}。同理注释里不许出现反引号。
  const probe = await runWsl(
    `cd '${CFG.wslLib}/styles' 2>/dev/null || exit 0\n` +
    `for d in */demo/node_modules; do\n` +
    `  [ -L "$d" ] || continue\n` +
    `  s=$(dirname "$(dirname "$d")")\n` +
    `  echo "LEMO_SYMLINK $s $(readlink "$d")"\n` +
    `done`,
    { name: '_lemo-symlink-probe' });
  if (probe.code !== 0) {
    warn(`探测 demo 软链 node_modules 失败（退出码 ${probe.code}）—— 若某 demo 页面报 404 请手工处理`);
    return;
  }
  const links = [];
  for (const line of (probe.stdout || '').split('\n')) {
    const m = /^LEMO_SYMLINK (\S+) (\S+)$/.exec(line.trim());
    if (m) links.push({ slug: m[1], target: m[2] });
  }
  if (!links.length) return;   // 全仓没有这种结构：什么都不做，也不出声

  const winRootNm = path.join(CFG.winLib, 'node_modules');
  for (const { slug, target } of links) {
    const rel = `styles/${slug}/demo/node_modules`;
    const dst = path.join(CFG.winLib, rel);
    if (target !== `${CFG.wslLib}/node_modules`) {
      warn(`${rel} 在 WSL 侧软链到 ${target}（不是仓库根 node_modules）—— 语义未知，不自动建 junction，请手工处理`);
      continue;
    }
    if (!fs.existsSync(winRootNm)) {
      warn(`${rel} 需要 junction，但源目录不存在：${winRootNm}（先在 Windows 侧装依赖）`);
      continue;
    }
    let st = null;
    try { st = fs.lstatSync(dst); } catch { /* 不存在，正常路径 */ }
    if (st) {
      // junction 在 Node 里也报 isSymbolicLink() === true（实测），所以这一条同时盖住 junction 与真 symlink
      if (st.isSymbolicLink()) { ok(`${rel} 已就位（junction → ${winRootNm}）`); continue; }
      warn(`${rel} 已存在且不是 junction（是个真目录）—— 保持不动；若其内容不全请手工处理`);
      continue;
    }
    // ⚠️ 本环境 spawnSync 一律 EBUSY，所以只能用异步 spawn（见文件头说明）。
    // mklink 是 cmd 内建命令，必须经 cmd.exe /c 调用；不需要管理员权限。
    const r = await run('cmd.exe', ['/c', 'mklink', '/J', dst, winRootNm]);
    if (r.code === 0 && fs.existsSync(dst)) {
      ok(`junction 建立 ${rel} → ${winRootNm}`);
    } else {
      // mklink 的 stdout 是 GBK，直接打会乱码 —— 只报退出码，不转述它的输出
      warn(`建 junction 失败（mklink 退出码 ${r.code}）${r.error?.message ? '：' + r.error.message : ''}`);
      warn(`  → ${rel} 仍缺失，页面若用相对路径 importmap 会在下一步 404。可手工执行：`);
      warn(`     cmd /c mklink /J "${dst}" "${winRootNm}"`);
    }
  }
}

// ───────────────── P1：缺素材报错翻译 ─────────────────
/**
 * ★ 为什么要有这个（同样是 40 个 demo 全量音频实测的结论）：
 *   7 个失败里有 4 个是「素材被 .gitignore 排除、根本不在仓库里」——
 *   brick-toy / hd-2d 缺 music/ 下的源音频（.gitignore 里的 styles/<slug>/demo/music/*.mp3
 *   与 styles/<slug>/demo/music/src/），
 *   watercolor 缺 demo/paper.jpg，urban-sketch 缺 demo/audio/foley_*.wav。
 *   这四个 demo 的脚本都被编排器**正确探测到**了，是脚本自己去读素材时失败 ——
 *   但报出来的是 LibsndfileError / 404 这类底层错误，使用者看不出
 *   「跑不了不是编排器的问题，是你缺这个文件」。
 *
 * 做法刻意选了「**失败后翻译**」而不是「跑之前猜测」：前者不会误报（报错里的路径是脚本自己说出来的），
 * 也不需要对 43 个 demo 逐个建模。只 warn，不 fail —— 有些素材本来就可能可选、或有回退。
 */

/** 把浏览器 URL / WSL 绝对路径 / Windows 绝对路径统一成「相对 Windows 库根」的写法。 */
function relToWinLib(p) {
  let s = String(p || '').trim().replace(/^["']|["']$/g, '').split('?')[0].split('#')[0];
  const u = /^https?:\/\/[^/]+(\/.*)$/.exec(s);
  if (u) s = u[1];                                     // http://127.0.0.1:9257/styles/... → /styles/...
  if (s.startsWith(CFG.wslLib + '/')) s = s.slice(CFG.wslLib.length + 1);
  else if (s.startsWith('/mnt/d/lemo-opuscar/')) s = s.slice('/mnt/d/lemo-opuscar/'.length);
  else if (/^[A-Za-z]:[\\/]/.test(s)) s = s.slice(3);   // D:\lemo-opuscar\x → x
  s = s.replace(/^\/+/, '').replace(/\\/g, '/');
  return s || null;
}

function diagnoseMissingAssets(demoRel, text) {
  const raw = [];
  const add = s => { const t = String(s || '').trim(); if (t && !raw.includes(t)) raw.push(t); };
  const t = text || '';
  for (const m of t.matchAll(/(?:optional file missing:\s*|\[page\] 404\s+)(\S+)/g)) add(m[1]);
  for (const m of t.matchAll(/LibsndfileError:\s*Error opening '([^']+)'/g)) add(m[1]);
  for (const m of t.matchAll(/FileNotFoundError:[^\n]*?['"]([^'"]+)['"]/g)) add(m[1]);
  for (const m of t.matchAll(/No such file or directory:?\s*['"]?([^'"\s]+)['"]?/g)) add(m[1]);
  // hd-2d 的 music/edit.py 是 subprocess.run(['ffprobe', …, '<源音频>'], check=True)：
  // 缺源音频时抛的是 CalledProcessError，报错正文里只有那条命令 —— 所以再扫一遍
  // 「库根下的、带素材类扩展名的绝对路径」。**限定扩展名**，免得把 traceback 里的
  // 脚本自身路径（.py / .json）也捞进来当成缺素材。
  const assetRe = /(?:https?:\/\/[^\s/]+)?(\/(?:home\/lemo\/lemo-opuscar|mnt\/d\/lemo-opuscar)\/[^\s'"]+\.(?:mp3|wav|flac|ogg|m4a|jpg|jpeg|png|hdr|npy|onnx|bin))(?![A-Za-z0-9])/gi;
  for (const m of t.matchAll(assetRe)) add(m[1]);
  if (!raw.length) return;

  const hits = [];
  for (const r0 of raw) {
    const rel = relToWinLib(r0);
    if (!rel) continue;
    if (!rel.includes('/')) {
      // 相对路径（brick-toy 的 edit.py 直接 load('Monkeys_Spinning_Monkeys.mp3')）没有确定的基准目录，
      // 按 demo 下最常见的几个位置试一遍，把命中/未命中如实写出来，不猜死一个。
      const cands = [`${demoRel}/music/${rel}`, `${demoRel}/audio/${rel}`, `${demoRel}/${rel}`, rel];
      const hit = cands.find(c => fs.existsSync(path.join(CFG.winLib, c)));
      hits.push(hit ? { rel: hit, shown: hit, found: true, cwdRel: true }
        : { rel, shown: `${rel}（相对路径，${demoRel}/music/、${demoRel}/audio/、${demoRel}/ 下都没有）`, found: false, cwdRel: true });
    } else {
      hits.push({ rel, shown: rel, found: fs.existsSync(path.join(CFG.winLib, rel)), cwdRel: false });
    }
  }
  if (!hits.length) return;

  const isNm = h => /(^|\/)node_modules\//.test(h.rel);
  warn(hits.some(isNm)
    ? '页面缺文件 —— demo 用相对路径引用的 node_modules 在 Windows 侧不存在（不是素材问题）'
    : '缺源素材 —— 这不是编排器的 bug：本 demo 依赖的文件不在仓库里（被 .gitignore 排除）');
  for (const h of hits) warn(`  · ${h.shown}${h.found ? '（存在，但脚本读它时报错）' : ''}`);
  if (hits.some(isNm)) {
    warn('  编排器会为「WSL 侧是软链」的 demo/node_modules 在 Windows 侧建 junction；'
      + '若上面有建 junction 失败的警告，先解决那一条。');
    return;
  }
  warn('  补齐后重跑即可；同类素材可参考同风格 demo，或见本 demo 的 CREDITS / CUES.md / build.sh。');
  warn('  常见被排除的路径：styles/*/demo/music/*.mp3、styles/*/demo/music/src/、styles/*/demo/audio/foley_*.wav');
  if (hits.some(h => h.cwdRel)) {
    warn('  注：上面是**相对工作目录**的路径，而编排器在库根下运行该脚本；'
      + '若文件确已就位、重跑仍报同样的错，请直接跑该 demo 自带的 build.sh。');
  }
}

// ───────────────── 起飞前检查（pre-flight，按 demo 链路声明）─────────────────
/**
 * ★ 为什么要有这个（本项目的最大遗留局限）：
 *   编排器的失败信息看不出「问题出在编排器这一侧，还是本 demo 的输入不在仓库里」。
 *   活证据 urban-sketch：它的配乐候选含 audio/score.py、混音候选含 audio/mix.py，
 *   而旧候选列表里**没有任何 foley 生成器** ⇒ audio/foley.py 从不执行 ⇒ mix.py 读不到
 *   foley_pen.wav ⇒ 报 `LibsndfileError: Error opening '...': System error.`。
 *   **这个报错与「素材本来就不在仓库里」的报错完全一样**，而两者性质相反 ——
 *   前者是编排器漏跑了一步，后者不是编排器的问题。代价：使用者要跑完整条音频链
 *   （最长 6 分钟）才知道「跑不了」，而且不知道该怪谁。
 *
 * 做法：开工前读一次 demo 链路声明（demo-manifest-all.json），核对该 demo
 *   assets_required 里 blocking=true 的项在**实际会被读的位置**是否存在，缺失就把
 *   「缺什么 / 该由谁产生 / 是不是编排器的锅」一次讲清。只读、只提示。
 *
 * ⚠️ 三条硬约束（都不许破）：
 *   1. **绝不 fail、绝不改退出码** —— 检查可能有误（声明是提取出来的），不能挡住本来能跑的 demo；
 *   2. **探测逻辑一个字不动** —— 声明若有误，用声明驱动执行会比探测更糟（探测至少有 40 个 demo 的实测背书）；
 *   3. **失败一律静默跳过** —— 声明文件不在 / JSON 坏了 / 该 demo 不在声明里 / WSL 探测失败 /
 *      路径写法解析不了：全部一声不响地放过，绝不能成为新的单点故障。
 *
 * ⚠️ 为什么在 **WSL 侧**核文件是否存在：音频链（配音/配乐/拟音/混音）在 WSL 里跑，读的是
 *   /home/lemo/lemo-opuscar 那棵树。而 Windows 侧 styles/<slug>/demo/ 下**一个 wav 都没有**
 *   （实测 0 个，WSL 侧 511 个）—— 在 Windows 侧核会把所有音频素材误判成缺失。
 *
 * ⚠️ blocking=false 的缺失**一律不报**（或只当信息）：silent-film 缺的那张图只影响一张静帧，
 *   living-screencast / whiteboard 缺的 voices 用 --vo 就能生成 —— 对它们误报会造成新的误导。
 *
 * ⚠️ 「编排器不跑这个脚本」再细分为两态（判据见 classifyWhy）：
 *   - **真缺口**：脚本在仓库里、**本环境跑得了**、但编排器不跑 → 保留强措辞「这是编排器的缺口，已登记」；
 *   - **外部条件**：脚本在仓库里，但它需要**本环境不具备的条件**（macOS / 联网 / 平台工具）→ 说
 *     「编排器没有执行它 —— 这需要外部条件，不是编排器的 bug」。
 *   后者若说成「缺口」会造出一个**假工单**（game-show/make_voices.sh 需 macOS 的 say、
 *   watercolor/music/prep.sh 需联网，编排器不跑它们多少是设计如此）。危害方向见 classifyWhy 的注释。
 *
 * ⚠️ 2026-10-06 补：本检查分**两段**，纪律相同（只提示、绝不 fail、绝不改退出码）：
 *   ① reportOrchSkipSteps() —— 读 ORCH_SKIP_STEPS 登记表，报出「本 demo 的 build.sh 有、
 *      编排器不跑」的步骤。**不依赖声明**（只读本仓库文件 + orchestratorRuns），所以声明缺失/
 *      损坏/该 demo 不在声明里时它照样有效。它补的正是上面那个「声明驱动」的盲区：
 *      声明里 assets_required 多为空（实测 43 个 demo 里只有 1 个有），于是**漏跑的步骤
 *      根本不会出现在任何报告里**（全静默）。
 *   ② 下面这段声明驱动的检查 —— 一个字没动。
 */

/** 读声明。文件不在 / 解析失败 / 结构不对 → 返回 null（调用方据此静默跳过）。 */
function loadManifest() {
  try {
    const p = CFG.manifestPath;
    if (!p || !fs.existsSync(p)) return null;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (j && j.demos && typeof j.demos === 'object') ? j : null;
  } catch { return null; }
}

/** {a,b,c} → 逐个展开（声明里有 styles/.../foley_{pen,wash,wind,hat,body,amb}.wav 这种写法）。 */
function expandBraces(p) {
  const m = /\{([^{}]*)\}/.exec(p);
  if (!m) return [p];
  const out = [];
  for (const alt of m[1].split(',')) {
    for (const q of expandBraces(p.slice(0, m.index) + alt + p.slice(m.index + m[0].length))) out.push(q);
  }
  return out;
}

/**
 * 把声明里的一条 assets_required[].path 解析成「相对库根的 glob」列表。
 * 解析不出来返回空数组 —— 调用方据此**不报**（宁漏勿错：误报比漏报更误导）。
 * 只做四步归一，不写通用解析器（声明里的写法是有限的几种）：
 *   ① 省略号写法 `v01.wav … v15.wav` → 同目录同扩展名的 glob
 *   ② 截掉人话后缀（`voices/*.wav（40 个：…）`、`v01..v13.wav + dur.json`）
 *   ③ 区间写法 `v01..v13.wav` → `v*.wav`
 *   ④ 变量前缀 $D / $S / $O / $OUT
 * 最后一道安全闸：只放行「无空白、无引号、无 shell 元字符」的相对 glob，
 * 免得声明里的怪写法被拼进 shell（本检查跑的是 shell 命令，这条不能省）。
 */
function manifestPatterns(slug, demoRel, raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) return [];
  const ell = s.search(/…|\.\.\./);
  if (ell > 0) {
    const head = s.slice(0, ell).trim();
    const ext = (/\.([A-Za-z0-9]+)$/.exec(head) || [])[1];
    if (!ext || !head.includes('/')) return [];
    s = `${head.slice(0, head.lastIndexOf('/'))}/*.${ext}`;
  }
  s = s.split(/[（(]|\s\+\s|\s+的/)[0].trim();
  s = s.replace(/([^/\s]*?)\.\.([^/\s]*)/g, (_, a, b) => {
    const ext = (/\.[A-Za-z0-9]+$/.exec(b) || [''])[0];
    return `${a.slice(0, 1)}*${ext}`;
  });
  s = s.replace(/\$OUT\b/g, `styles/${slug}`)
    .replace(/\$D\b/g, demoRel)
    .replace(/\$S\b/g, `styles/${slug}`)
    .replace(/\$O\b/g, `styles/${slug}`)
    .replace(/\\/g, '/').replace(/^\.\//, '');
  if (/^[A-Za-z]:/.test(s) || s.startsWith('/')) return [];   // 绝对路径：不是本仓库的相对写法，不猜
  const out = [];
  for (const p of expandBraces(s)) if (/^[\w./*\-]+$/.test(p)) out.push(p);
  return out;
}

/**
 * 声明里的 produced_by 可能是脚本路径（$D/audio/foley.py），也可能是人话（"ffmpeg（从同名 .mp3 转）"）。
 * 只有前者才谈得上「编排器漏跑了生成器」，所以这里做一次严格识别：认不出就返回 script=null。
 */
function producerOf(slug, demoRel, asset) {
  const raw = asset && asset.produced_by;
  if (raw == null || raw === '') return { script: null, text: null };
  const text = String(raw).trim();
  let s = text.split(/[（(]/)[0].trim();
  s = s.replace(/\$OUT\b/g, `styles/${slug}`)
    .replace(/\$D\b/g, demoRel)
    .replace(/\$S\b/g, `styles/${slug}`)
    .replace(/\$O\b/g, `styles/${slug}`)
    .replace(/\\/g, '/').replace(/^\.\//, '');
  if (!/^[\w./\-]+\.(?:py|mjs|js|cjs|sh|bash|ts)$/.test(s)) return { script: null, text };
  return { script: s, text };
}

/**
 * 编排器本次**会不会执行**这个脚本 —— 这是「编排器漏跑了一步」与「素材不在仓库里」的唯一判据。
 *
 * ⚠️ 这里的候选列表是 audioScript、第 2 步里那些 for 循环、以及 [素材] 那一步的**镜像**。
 *    两处必须同步改；不同步的后果只是「提示里的归类可能不准」，**不影响执行**
 *    （本检查只读、不驱动执行）。刻意不去 refactor 那两处 shell 模板：
 *    它们是全量实测过的，为了复用而改动风险更大。
 *    ⚠️ 上一轮执行者点明过：**改了候选列表就必须同步这里**，否则起飞前检查会继续把
 *      这两条报成「真缺口」（本文件正是被这条规则催生的）。
 */
function orchestratorRuns(slug, demoRel, script) {
  if (!script) return false;
  if (!fs.existsSync(path.join(CFG.winLib, script))) return false;   // 脚本不在仓库里 → 谈不上「漏跑」
  const d = demoRel;
  const runs = [
    `${d}/tools/events.mjs`, `${d}/events.mjs`,
    `${d}/tools/dump_timeline.mjs`, `${d}/render/cues.mjs`,
    `${d}/tools/subs.mjs`, `${d}/subs.mjs`, `${d}/tools/export.mjs`,
    `${d}/tools/subs.py`, `${d}/subs.py`, `${d}/tools/cues.py`, `${d}/cues_export.py`,
    `${d}/voice_fx.py`, `${d}/voice.py`,
    `${d}/paper.py`,
    `${d}/music/score.py`, `${d}/music/compose.py`, `${d}/music/muzak.py`,
    `${d}/music/music.py`, `${d}/music/edit.py`, `${d}/music.py`,
    `${d}/music/audio/score.py`, `${d}/audio/score.py`, `${d}/music/sound.py`, `${d}/sound.py`,
    `${d}/mix.py`, `${d}/audio/mix.py`,
    `${d}/audio/foley.py`, `${d}/foley.py`, `${d}/tools/foley.py`,
    `${d}/tools/srt.py`, `${d}/make_srt.py`, `${d}/subs_export.py`,
    // ★ 2026-10-06 补：变调后处理 pitch.py（音频脚本里「配音之后、ASR/回传之前」新增的那一步）。
    //   镜像必须同步改，否则起飞前检查会把「art-deco 的 pitch.py」继续报成「编排器漏跑」。
    `${d}/tools/pitch.py`,
    // ★ 2026-10-07 补：三个「build.sh 有、旧编排器漏跑、且**影响成片内容**」的步骤。镜像必须同步，
    //   否则起飞前检查会把它们继续报成「编排器漏跑」（ORCH_SKIP_STEPS 里已不再登记它们）：
    //     trim_cmd.py       —— 音频脚本「配音之后、ASR 之前」（裁人声 wav，改写 dur.json）
    //     export_cues.mjs   —— Windows 侧 exportEventsAndSubs() 第 ①-b 步（写 audio/cues.json）
    //     words.py          —— 音频脚本「asr_check.py 之后」（派生 voices/words_rel.json）
    `${d}/tools/trim_cmd.py`, `${d}/tools/export_cues.mjs`, `${d}/tools/words.py`,
  ];
  // TTS 是**两条互斥的后端**，编排器一次只跑一条（这里是 audioScript 配音段的镜像）：
  //   ① $D/lines.json 存在 → core/tts/tts.py（读 demo 根下的 lines.json，写 voices[_raw]/）；
  //   ② 否则若 demo 自带 $D/tts/gen.py（Kokoro，本地离线）→ 跑它。这是补上的一处窄口：
  //      watercolor / paper-popup 的台词在 $D/tts/lines.json（**不是** $D/lines.json），
  //      旧编排器两条都不跑 ⇒ voices/v*.wav 永不生成（声明里那条「编排器打不中它」）。
  if (fs.existsSync(path.join(CFG.winLib, `${d}/lines.json`))) {
    runs.push('core/tts/tts.py');
  } else {
    runs.push(`${d}/tts/gen.py`);
  }
  return runs.includes(script);
}

// ─────────────── 「build.sh 有、编排器不跑」的步骤登记（只报告，不执行）───────────────
/**
 * ★ 为什么要有这张表（2026-10-06 端到端实测 + 全库审计）：
 *   编排器的音频/交付链路是**按候选清单探测** demo 自带脚本的，而全库 35 个带 build.sh 的风格里
 *   **大多数至少漏跑一步**。最要命的是**内容有影响**的那几步 —— 它们不跑时成片照样出得来、
 *   退出码 0，只是内容与 build.sh 不一致，外部表现与「跑通了」无法区分。
 *   实例（本轮修掉的就是第一个）：art-deco 的 tools/pitch.py 会变调重采样并改写 dur.json，
 *   编排器漏跑 ⇒ 门童两句的 +4 半音静默丢失（实测 dur.json 停在未变调的 1.009 / 1.113）。
 *
 * ★ 为什么是**这张人工登记表**，而不是「拿 demo 链路声明的 steps 自动比」：
 *   实测（用 demo-manifest-all.json 的 steps 字段跑一遍全库）会造出**大量假缺口** ——
 *   编排器**直接调用**的 core/ 脚本（core/render/events.mjs、srt.py、video.mjs、mux.sh、
 *   core/tts/tts.py …）都不在 orchestratorRuns 的 runs[] 镜像里（那个镜像只覆盖
 *   「demo 自带候选脚本」这一类），自动比对会把它们全判成「漏跑」（实测 34 个风格里 34 个命中，
 *   明显失真）。所以本表只登记**已逐条核实**的真缺口，宁少勿错。
 *
 * ★ 为什么**不**把这些写进 orchestratorRuns 的 runs[]：runs[] 的语义是「编排器本次**会执行**
 *   它」（见该函数注释）—— 把不执行的步骤写进去，起飞前检查反而会把它们当成「会跑」而**静默**，
 *   与「让缺口可见」正好相反。所以单列本表，由 reportOrchSkipSteps() 读它并如实报出。
 *
 * ★ impact 只决定**措辞**，不决定「报不报」：
 *   'content'  —— 改**成片内容**（音频波形 / 时间轴 / 画面），不跑 = 成片内容与 build.sh 不符；
 *   'delivery' —— 只改**交付图**（poster / styleframe 等静帧），不跑 = 交付图陈旧、成片本身不变；
 *   'selfcheck'—— **纯自检**，不跑 = 少一道校验，成片一字不变；
 *   'none'     —— 已**实测核实**「不跑与跑逐字节无差异」（确定性生成物），保留登记只为让
 *                 「build.sh 有、编排器不跑」这件事本身可见，不构成缺口。
 * ★ 本表是**候选**：报之前还要核两件事 —— ① 该脚本真在本 demo 里；② 编排器本次确实不跑它
 *   （走 orchestratorRuns）⇒ 将来某一步被编排器补上时，这里会**自动**不再报，不用改表。
 *   （pitch.py 就是第一例：它已在 2026-10-06 被补进编排器，因此本表**不登记它**。
 *     trim_cmd.py / export_cues.mjs / words.py 是 2026-10-07 的第二、三、四例，同样已从本表移除。）
 * ★ root='demo' 的 rel 相对 demo 目录（tools/xxx.py）；root='lib' 的 rel 相对库根（core/…）。
 *   两者都按「相对库根」拼出来核存在性 ⇒ **不写死任何 slug**。
 */
const ORCH_SKIP_STEPS = [
  // ── 内容有影响（不跑 ⇒ 成片内容与 build.sh 不符）──
  // ★ video_png.mjs（risograph）：它**替换**渲染器（PNG 无损中间片），不是「追加一步」——
  //   编排器的渲染行硬编码 core/render/video.mjs 且带 --size，而它**不接受 --size** ⇒
  //   直接接上会静默丢画幅。已评估为「风险过高，本轮不接」，详见 D:/lemo-tools/README.md 的差异清单。
  { rel: 'tools/video_png.mjs',   root: 'demo', impact: 'content', what: '导出逐帧 PNG（**换渲染器**：PNG 无损中间片；编排器不替换，理由见 README）' },
  // ── 已核实「不跑无差异」（确定性生成物；保留登记只为「build.sh 有、编排器不跑」这件事本身可见）──
  { rel: 'models/gen_volt.mjs',   root: 'demo', impact: 'none', what: '生成 volt 素材（确定性：重跑产物与入库版逐字节相同，实测 md5 一致）' },
  { rel: 'models/gen_kite.mjs',   root: 'demo', impact: 'none', what: '生成 kite 素材（确定性：重跑产物与入库版逐字节相同，实测 md5 一致）' },
  // ── 只影响交付图（成片本身不变，poster / styleframe 等会陈旧）──
  { rel: 'core/render/still.mjs', root: 'lib',  impact: 'delivery', what: '出静帧（poster / styleframe 等交付图）' },
  { rel: 'tools/still.mjs',       root: 'demo', impact: 'delivery', what: '出静帧（poster / styleframe 等交付图）' },
  // ── 纯自检（不跑只是少一道校验，成片一字不变）──
  { rel: 'tools/cuecheck.py',     root: 'demo', impact: 'selfcheck', what: '配乐卡点 ↔ 画面时间网格自检' },
  { rel: 'tools/final_asr.py',    root: 'demo', impact: 'selfcheck', what: '成片终检（ASR 比对）' },
  { rel: 'tools/check_mix.py',    root: 'demo', impact: 'selfcheck', what: '混音自检' },
  { rel: 'check_mix.py',          root: 'demo', impact: 'selfcheck', what: '混音自检' },
];

/**
 * 报出「本 demo 的 build.sh 有、编排器不跑」的步骤。
 * ⚠️ 三条纪律与 preflight 的其余部分**完全一致**：只打印、**绝不 fail**、**绝不改退出码**；
 *    任何异常都由调用方吞掉（本函数只读本仓库文件 + orchestratorRuns，不碰 WSL / 不碰声明）。
 * 无命中时**一声不响**（不给不需要的 demo 制造噪音）。
 */
function reportOrchSkipSteps(slug, demoRel) {
  const hits = [];
  for (const s of ORCH_SKIP_STEPS) {
    const full = s.root === 'demo' ? `${demoRel}/${s.rel}` : s.rel;
    if (!fs.existsSync(path.join(CFG.winLib, full))) continue;    // 本 demo 没有这个脚本
    if (orchestratorRuns(slug, demoRel, full)) continue;         // 编排器本次会跑它 ⇒ 不是缺口
    hits.push({ ...s, full });
  }
  if (!hits.length) return;
  const rank = { content: 0, delivery: 1, selfcheck: 2, none: 3 };
  hits.sort((a, b) => rank[a.impact] - rank[b.impact]);
  console.log(`\n${C.b('[起飞前检查] build.sh 有、编排器不跑的步骤（已登记 · 只提示、不阻断）')}`);
  for (const h of hits) {
    const mark = h.impact === 'content' ? '★ 影响成片内容'
      : h.impact === 'delivery' ? '○ 只影响交付图'
      : h.impact === 'none' ? '· 已核实：不跑与跑无差异' : '· 仅少一道自检';
    warn(`  ${h.full}  —— ${mark}：${h.what}`);
  }
  if (hits.some(h => h.impact === 'content')) {
    warn('  ★ 带「影响成片内容」的步骤不跑时，成片仍会正常产出（退出码 0），只是内容与 build.sh 不一致 ——');
    warn('    若要逐字节复现该 demo 的 build.sh，请直接跑它自带的 build.sh（本编排器不执行这些步骤）。');
  }
  info(C.dim('（登记表：lemo-make.mjs 的 ORCH_SKIP_STEPS；用 --no-preflight 跳过本检查）'));
}

/**
 * 缺失项的归类。四态，判据必须只用**可核实的事实**：
 *   'runs' —— 声明说的生成器确实在仓库里，且编排器本次会跑它 → 不报（它会被生成出来）；
 *   'gap'  —— 生成器**确实在仓库里**、**本环境跑得了**，但编排器本次不会跑它 → 编排器漏跑了一步（真缺口）；
 *   'ext'  —— 生成器确实在仓库里，但它需要**本环境不具备的外部条件**（macOS / 联网 / 平台工具）
 *             → 编排器不跑它多少是设计如此，**不是编排器的 bug**；
 *   'none' —— 声明里没有生成器 / 生成器不在仓库里 / 认不出是脚本 → 素材不在仓库里（不是编排器的问题）。
 * ⚠️ 'gap' / 'ext' 都必须同时满足「produced_by 认得出是脚本」**且**「该脚本真的存在于仓库」——
 *    只凭前者会把声明里的笔误（指向一个不存在的脚本）误报成「编排器的缺口」。
 *    'gap' 与 'ext' 的细分交给 classifyWhy()。
 */
function classifyProducer(slug, demoRel, prod, asset) {
  if (!prod.script) return { kind: 'none', why: '' };
  if (orchestratorRuns(slug, demoRel, prod.script)) return { kind: 'runs', why: '' };
  if (!fs.existsSync(path.join(CFG.winLib, prod.script))) return { kind: 'none', why: '' };
  return classifyWhy(prod, asset);   // 脚本在仓库里、编排器不跑 → 真缺口还是外部条件
}

/**
 * 脚本内容里的**外部条件**特征。命中即说明这个脚本需要本环境不具备的东西。
 * 特征清单取自任务书：say / osascript（macOS）、curl / wget（联网）、
 * pip install / npm install / brew（装外部依赖）；另补 apt install / docker pull / git clone。
 * ⚠️ 刻意不做成通用解析 —— 这只是**归类措辞**的启发式，判错最多是文案不准，不影响执行。
 */
function extScriptReason(body) {
  if (!body) return '';
  if (/(?:^|[\s;&|()$])say\s+-/.test(body) || /\bosascript\b/.test(body)) {
    return '脚本用到 macOS 专有命令（say / osascript），Windows+WSL 没有';
  }
  const net = /(?:^|[\s;&|()$])(curl|wget)\s/.exec(body);
  if (net) return `脚本要联网下载（用到 ${net[1]}）`;
  const dep = /(?:^|[\s;&|()$])(pip3?\s+install|npm\s+(?:install|ci)|yarn\s+add|pnpm\s+add|brew\s+install|apt(?:-get)?\s+install|docker\s+pull|git\s+clone)/.exec(body);
  if (dep) return `脚本要装外部依赖（用到 ${dep[1].trim()}）`;
  return '';
}

/** 声明文本（how_to_get / produced_by 的人话）里的**外部条件**特征。 */
function extTextReason(text) {
  const m = /(macOS|mac\s*os|osascript|联网|需网络|需要网络|下载|其它平台|别的机器|另一台)/i.exec(text);
  return m ? m[0] : '';
}

/** 声明文本里「本环境跑得了」的**正面**证据 —— 只有拿到它才敢说「真缺口」。 */
function localTextReason(text) {
  const m = /(无需外部素材|不需要外部素材|无外部依赖|不依赖外部|纯程序生成|纯程序合成|纯本地|本地离线|完全离线|本地生成|离线生成|本地合成)/.exec(text);
  return m ? m[0] : '';
}

/** 读脚本内容（只读、只用于归类措辞；读不到 / 不是文件 / 太大都返回空串）。 */
function readScriptBody(script) {
  try {
    const p = path.join(CFG.winLib, script);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return '';
    return fs.readFileSync(p, 'utf8').slice(0, 65536);
  } catch { return ''; }
}

/**
 * 细分「真缺口 / 外部条件」。返回 { kind: 'gap' | 'ext', why: '依据' }。
 *
 * 判据（优先级从高到低，全部只用可核实的事实）：
 *   ① 声明字段 —— asset.requires / asset.external / asset.platform 有值 → 外部条件（直接采信）；
 *      （当前声明里没有这几个字段，这一层是为将来加的字段留的；有则优先于下面所有启发式）
 *   ② 脚本内容 —— 命中 extScriptReason（say / osascript / curl / wget / pip install / npm install /
 *      brew / apt install / docker pull / git clone）→ 外部条件；
 *   ③ 声明文本 —— how_to_get 与 produced_by 的人话命中 extTextReason（macOS / 联网 / 需网络 / 下载 /
 *      其它平台 …）→ 外部条件；
 *   ④ 声明文本的**正面**证据 —— 命中 localTextReason（纯程序生成 / 本地离线 / 无需外部素材 …）→ 真缺口；
 *   ⑤ 以上都判不出 → **保守归「外部条件」**。
 *
 * ⚠️ 为什么保守方向是「外部条件」而不是「缺口」：说成「缺口」会造出一个**假工单**，让使用者去报一个
 *    不存在的 bug；任务书明确的危害方向是「一句错的『这是我们的缺口』，比漏报一个真缺口更糟」。
 *    所以只在**有正面证据**（声明明说本环境跑得了）时才敢说「真缺口」。
 * ⚠️ 无论判成哪一态，都只影响**措辞**，不改变任何执行逻辑（本检查只打印、不 fail）。
 */
function classifyWhy(prod, asset) {
  const fields = [asset && asset.requires, asset && asset.external, asset && asset.platform]
    .filter(x => x !== undefined && x !== null && x !== '' && x !== false);
  if (fields.length) return { kind: 'ext', why: `声明里标了外部条件（${fields.map(String).join(' / ')}）` };

  const sr = extScriptReason(readScriptBody(prod.script));
  if (sr) return { kind: 'ext', why: sr };

  const text = `${(asset && asset.how_to_get) || ''} ${prod.text || ''}`;
  const tr = extTextReason(text);
  if (tr) return { kind: 'ext', why: `声明里写明：${tr}` };

  const lr = localTextReason(text);
  if (lr) return { kind: 'gap', why: `声明里写明「${lr}」—— 本环境跑得了` };

  return { kind: 'ext', why: '没有正面证据说明本环境跑得了它（保守归外部条件）' };
}

/** 一条 WSL 命令核完全部 glob：返回 pattern → 命中数 的 Map；任何异常都返回 null（调用方静默跳过）。 */
async function probeExistence(patterns) {
  const uniq = [...new Set(patterns)];
  if (!uniq.length) return new Map();
  const body = [`LIB=${CFG.wslLib}`]
    .concat(uniq.map((p, i) => `n=$(ls -1d "$LIB"/${p} 2>/dev/null | wc -l); echo "WM_EXIST ${i} $n"`))
    .join('\n');
  const r = await runWsl(body, { name: '_lemo-preflight' });
  if (r.code !== 0) return null;
  const seen = new Map();
  for (const line of (r.stdout || '').split('\n')) {
    const m = /^WM_EXIST (\d+) (\d+)\s*$/.exec(line.trim());
    if (m) seen.set(uniq[Number(m[1])], Number(m[2]));
  }
  if (seen.size !== uniq.length) return null;   // 少一条 → 结果不可信，整块跳过
  return seen;
}

/** how_to_get 摘一句（声明里这段往往很长，原样打会刷屏）。 */
function shortHow(s) {
  let h = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (!h) return '';
  const cut = h.search(/[。；]/);
  if (cut > 0 && cut <= 90) return h.slice(0, cut);
  return h.length > 90 ? h.slice(0, 90) + '…' : h;
}

/** 起飞前检查主流程。只打印，不返回、不抛、不 fail。 */
async function preflight(o, demoRel) {
  if (o.noPreflight) return;
  // ★ 先报「build.sh 有、编排器不跑」的步骤（见 ORCH_SKIP_STEPS）。位置刻意在声明检查**之前**：
  //   这一段**不依赖 demo 链路声明**（只读本仓库文件 + orchestratorRuns），所以声明缺失/损坏、
  //   或该 demo 不在声明里时它照样有效 —— 而「编排器漏跑了一步」恰恰是最需要先看到的信息。
  //   与声明那一段同样的纪律：只提示、绝不 fail、绝不改退出码；异常也一律吞掉（不做单点故障）。
  try { reportOrchSkipSteps(o.slug, demoRel); } catch { /* 只提示，绝不因它中断 */ }
  const m = loadManifest();
  if (!m) return;                                    // 声明缺失/损坏 → 静默
  const d = m.demos[o.slug];
  if (!d || typeof d !== 'object') return;            // 该 demo 不在声明里 → 静默
  const items = Array.isArray(d.assets_required) ? d.assets_required : [];
  const blocking = items.filter(a => a && a.blocking === true);

  if (!items.length) {
    info(C.dim('起飞前检查：本 demo 未声明阻塞性输入（demo 链路声明里没有 assets_required）'));
    return;
  }
  console.log(`\n${C.b('[起飞前检查] 按 demo 链路声明')}`);
  if (!blocking.length) {
    ok(`声明里的输入都非阻塞（${items.length} 项声明 / 0 项阻塞）—— 无需补齐`);
    return;
  }

  // 路径解析：解析不了的项直接丢（宁漏勿错），全丢光就静默
  const probes = [];
  for (const a of blocking) {
    const pats = manifestPatterns(o.slug, demoRel, a.path);
    if (pats.length) probes.push({ asset: a, pats });
  }
  if (!probes.length) return;
  const seen = await probeExistence(probes.flatMap(p => p.pats));
  if (!seen) return;                                  // WSL 探测失败 → 静默跳过整个检查

  const hits = [];
  for (const p of probes) {
    const miss = p.pats.filter(x => (seen.get(x) || 0) === 0);
    if (!miss.length) continue;
    const prod = producerOf(o.slug, demoRel, p.asset);
    const cls = classifyProducer(o.slug, demoRel, prod, p.asset);
    if (cls.kind === 'runs') continue;    // 编排器本次会跑它 → 不报（urban-sketch 的 foley 就属这类）
    hits.push({ path: miss.join('  '), asset: p.asset, prod, kind: cls.kind, why: cls.why });
  }
  if (!hits.length) {
    ok(`声明里的输入都在位（${blocking.length} 项阻塞声明）`);
    return;
  }

  const gaps = hits.filter(h => h.kind === 'gap');
  const exts = hits.filter(h => h.kind === 'ext');
  const plains = hits.filter(h => h.kind === 'none');
  warn(`本 demo 声明了 ${blocking.length} 项阻塞输入，其中 ${hits.length} 项不在位：`);
  for (const h of hits) {
    warn(`  · ${h.path}${h.asset.needed_by ? `   ← ${h.asset.needed_by}` : ''}`);
    // how_to_get 是最可操作的文本（如「① 在 macOS 上 sh make_voices.sh」）——
    // 无论判成哪一态都打出来：让使用者一眼知道要做什么，比争论「该怪谁」有用。
    const how = shortHow(h.asset.how_to_get);
    if (how) warn(`      补齐：${how}`);
  }
  if (gaps.length) {
    // 按生成器脚本归并：watercolor 的 prep.sh 一项覆盖 3 个文件，逐个列会刷屏。
    const byScript = new Map();
    for (const h of gaps) {
      const k = h.prod.script;
      if (!byScript.has(k)) byScript.set(k, { script: k, n: 0, why: h.why });
      const g = byScript.get(k);
      g.n++;
      if (!g.why) g.why = h.why;
    }
    warn(`★ 其中 ${gaps.length} 项本可由本 demo 自带的脚本产生，而编排器本次不会执行那个脚本 ——`);
    warn('  这是编排器的缺口（已登记），**不是**「素材不在仓库里」：');
    for (const g of byScript.values()) {
      warn(`  · 编排器不会执行 ${g.script}（它不在候选列表里），它本可生成上面的 ${g.n} 项`
        + (g.why ? `；判据：${g.why}` : ''));
    }
    warn('  请报告此情况 —— 这正是「漏跑一步」与「缺素材」外部表现一样的实例。');
  }
  if (exts.length) {
    // 同样是按脚本归并：一个 prep.sh 覆盖 3 个文件。
    const byScript = new Map();
    for (const h of exts) {
      const k = h.prod.script;
      if (!byScript.has(k)) byScript.set(k, { script: k, n: 0, why: h.why });
      const e = byScript.get(k);
      e.n++;
      if (!e.why) e.why = h.why;
    }
    warn(`○ 另有 ${exts.length} 项由 demo 自带的脚本产生，但那些脚本需要**本环境不具备的外部条件** ——`);
    warn('  编排器没有执行它们（这多半是设计如此），**这不是编排器的 bug**，不必报工单：');
    for (const e of byScript.values()) {
      warn(`  · ${e.script}：${e.why}（它本可生成上面的 ${e.n} 项）`);
    }
  }
  if (plains.length) {
    warn(`其余 ${plains.length} 项不是编排器的 bug —— 这些文件不在仓库里（多被 .gitignore 排除），需自行补齐。`);
  }
  warn('补齐后重跑即可；同类素材可参考同风格 demo，或见该 demo 的 CREDITS / CUES.md / build.sh。');
  info(C.dim(`（检查依据：${CFG.manifestPath}；用 --no-preflight 跳过本检查）`));
}

// ─────────────────────────── 参数 ───────────────────────────

function parseArgs(argv) {
  const o = {
    slug: null, fps: 24, workers: 6, out: null, venc: 'nvenc',
    q: null, qEvents: null, grain: null, lines: null, film: null, lang: null, ratio: null, size: null,
    voice: null, speed: null,
    skipSync: false, skipAudio: false, skipRender: false,
    audioOnly: false, renderOnly: false, dryRun: false, help: false,
    noPreflight: false, manifest: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // ★ 取值必须校验。原实现是 `const next = () => argv[++i];` —— 对缺失值**静默通过**，实测两个后果：
    //   (a) `lemo-make tilt-shift --q`（不给值）→ o.q 成了 undefined，而下游判的是 `o.q !== null`，
    //       undefined 也算「用户给了」→ 取到 undefined，把 build.sh 派生的 `--q noev` 无声关掉；
    //       退出码仍是 0，一句话提示都没有。
    //   (b) `lemo-make ascii-crt --q --dry-run` → `--dry-run` 被当成 --q 的值吞掉，dryRun 没置上，
    //       于是**真的开始渲染**（验证者被坑过一次，靠 SIGTERM 才停住）。
    //   所以：下一个 token 缺失、或以 -- 开头（那显然是另一个选项，不是值）时一律报错并非 0 退出，
    //   与 --fps/--workers/--venc/--grain 等其它选项的参数校验保持一致。
    const next = opt => {
      const v = argv[i + 1];
      if (v === undefined) fail(`${opt} 缺少值（--help 看用法）`);
      if (v.startsWith('--')) fail(`${opt} 缺少值：下一个 token 是选项 ${v}，不是值（--help 看用法）`);
      i++;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--fps') o.fps = Number(next('--fps'));
    else if (a === '--workers') o.workers = Number(next('--workers'));
    else if (a === '--out') o.out = next('--out');
    else if (a === '--venc') o.venc = next('--venc');
    else if (a === '--q-events') o.qEvents = next('--q-events');
    else if (a === '--q') o.q = next('--q');
    else if (a === '--lines') o.lines = next('--lines');
    else if (a === '--film') o.film = next('--film');
    else if (a === '--lang') o.lang = next('--lang');
    else if (a === '--ratio') o.ratio = next('--ratio');
    else if (a === '--size') o.size = next('--size');
    else if (a === '--grain') o.grain = next('--grain');
    else if (a === '--voice') o.voice = next('--voice');
    else if (a === '--speed') o.speed = Number(next('--speed'));
    else if (a === '--skip-sync') o.skipSync = true;
    else if (a === '--skip-audio') o.skipAudio = true;
    else if (a === '--skip-render') o.skipRender = true;
    else if (a === '--audio-only') { o.audioOnly = true; o.skipRender = true; }
    else if (a === '--render-only') { o.renderOnly = true; o.skipAudio = true; }
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--no-preflight') o.noPreflight = true;
    else if (a === '--manifest') o.manifest = next('--manifest');
    else if (!a.startsWith('--')) o.slug = a;
    else fail(`未知参数 ${a}（--help 看用法）`);
  }
  if (!['nvenc', 'libx264'].includes(o.venc)) fail(`--venc 只能是 nvenc 或 libx264`);
  if (!Number.isFinite(o.fps) || o.fps <= 0) fail(`--fps 必须是正数`);
  if (!Number.isInteger(o.workers) || o.workers < 1) fail(`--workers 必须是 ≥1 的整数`);
  if (o.grain !== null && !/^\d+(\.\d+)?$/.test(o.grain)) fail(`--grain 必须是非负数（0 = 不加颗粒）`);
  // --voice：别名或音色库里的名字（也允许相对路径）。别用中文文件名 —— 控制台的选项校验
  //   （lib/briefs.mjs:OPT_RE）只放行 ASCII，写中文名会在面板那一层就被拒。
  if (o.voice !== null && !/^[A-Za-z0-9._][A-Za-z0-9._\/-]*$/.test(o.voice)) {
    fail(`--voice 只能是别名 / 音色库名 / 相对路径（字母数字 . _ - /），收到：${o.voice}`);
  }
  // --speed：映射到 Index-TTS 的 duration_factor = 1/speed，官方可用区间 0.5–2.0。
  if (o.speed !== null && (!Number.isFinite(o.speed) || o.speed < 0.5 || o.speed > 2)) {
    fail(`--speed 必须在 0.5–2.0 之间（Index-TTS 的 duration_factor 就是 1/speed），收到：${o.speed}`);
  }
  // --lines：只能是 demo 目录下的文件名（与 build.sh 传内容文件同样的约束），
  // 不收路径分隔符 —— 免得把编排器当成任意文件拷贝工具用。
  if (o.lines !== null && !/^[\w.-]+\.json$/.test(o.lines)) {
    fail(`--lines 只接受 demo 目录下的 .json 文件名（如 lines_zh.json），收到 '${o.lines}'`);
  }
  // --film：选片名（demo 目录下的 <name>.js，页面用 ?film=<name> 加载）。默认 film.js = 仓库自带示例片。
  if (o.film !== null && !/^[\w-]+$/.test(o.film)) {
    fail(`--film 只接受模块名（字母数字下划线连字符），收到 '${o.film}'`);
  }
  // --lang：语言代码（en / zh / …）。只做形状校验；具体有没有对应内容文件由下面的换名逻辑查。
  if (o.lang !== null && !/^[A-Za-z][\w-]*$/.test(o.lang)) {
    fail(`--lang 只接受语言代码（如 en / zh），收到 '${o.lang}'`);
  }
  return o;
}

/**
 * demo 的 build.sh 里某条命令的位置参数（给 subs.py / export.mjs 这类吃位置参数的脚本用）。
 * 只替换 $D/$S/$O/$OUT/$W 这几个变量；**出现任何其它 $VAR 就返回 null** —— 说明这条命令的参数
 * 依赖 build.sh 自己的变量（如 hologram-hud 的 `$CONTENT $W`），照抄会把变量名当路径传进去。
 * 返回 null 时调用方应「一个参数都不传」，让脚本走它自己的默认值（这正是 build.sh 默认分支的行为）。
 */
function buildShArgs(slug, demoRel, needle) {
  const p = path.join(CFG.winLib, 'styles', slug, 'demo', 'build.sh');
  if (!fs.existsSync(p)) return null;
  const line = fs.readFileSync(p, 'utf8').split('\n')
    .find(l => l.includes(needle) && !/^\s*#/.test(l));
  if (!line) return null;
  // 先截到本命令结束：build.sh 里一条命令后面常跟着 `&& $PY core/render/srt.py …`，
  // 不截的话那些东西会被当成参数（ascii-crt 的 `node $D/tools/subs.mjs $D && …` 就是这样）。
  const rest = line.slice(line.indexOf(needle) + needle.length).split(/#|&&|\|\||;|\|>?/)[0];
  const toks = rest.trim().split(/\s+/).filter(Boolean)
    .map(t => t.replace(/^["']|["']$/g, ''));
  // 出现 build.sh 自己的变量（如 hologram-hud 的 `$CONTENT $W`）就无法忠实重建位置参数 ——
  // 少传一个会把后面的参数顶到前面去，比不传更糟。这种情况返回 null，调用方一个参数都不传。
  const map = { '$D': demoRel, '$S': `styles/${slug}`, '$O': `styles/${slug}`, '$OUT': `styles/${slug}`, '$W': demoRel };
  if (toks.some(t => t.startsWith('$') && !(t in map))) return null;
  return toks.map(t => map[t] ?? t);
}

/**
 * demo **自带**事件脚本的位置参数模板（复刻它自己 build.sh 里 events.mjs 那一行）。
 *
 * ★ 为什么单独做一个（engraving 是本文件修过的另一个真实缺陷）：
 *   engraving 的 build.sh 是 `node $D/tools/events.mjs $D $C`，而 `C=${1:-content.json}`；
 *   渲染行是 `node core/render/video.mjs $D … --q "content=$C"`。
 *   —— **两步从同一个 $C 派生**，所以它自己跑出来画面与事件必然一致。
 *   旧实现只传了 1 个位置参数（demo 目录），把 $C 丢了：用户 `--q content=content_alt.json`
 *   时渲染换了内容、事件表还是 content.json 的 → 画面/字幕/配乐互相矛盾，且 --q-events 被忽略（只 warn），
 *   等于**没有任何补救手段**。
 *
 * 返回 { args, slots, otherRefs }：
 *   args  —— 该行映射后的位置参数，$D/$S/$O/$OUT/$W 换成真实路径，
 *            **其它 $VAR（engraving 的 $C，即内容文件）保留为 null 占位**，由调用方用 content= 值填；
 *   slots —— 占位符原名，用于判断「这个脚本到底吃不吃内容参数」；
 *   otherRefs —— build.sh 里还有多少条**其它**命令用到同一个变量。
 *            engraving 的 $C 同时喂了 lines.json（配音行）、subs.py（字幕行）、静帧行 ——
 *            本编排器只跟随渲染与事件两步，靠这个数字如实告知「换内容只换了一半」。
 * 返回 null = 无法忠实重建（出现 ${Q:+…} 这类复合变量）：调用方应一个参数都不传。
 */
function posArgTemplate(slug, demoRel, needle) {
  const p = path.join(CFG.winLib, 'styles', slug, 'demo', 'build.sh');
  if (!fs.existsSync(p)) return null;
  const body = fs.readFileSync(p, 'utf8').split('\n').filter(l => !/^\s*#/.test(l));
  const line = body.find(l => l.includes(needle));
  if (!line) return null;
  // 先截到本命令结束（后面常跟 `&& $PY $D/mix.py`，不截会被当成参数）
  const rest = line.slice(line.indexOf(needle) + needle.length).split(/#|&&|\|\||;|\|>?/)[0];
  const toks = rest.trim().split(/\s+/).filter(Boolean)
    .map(t => t.replace(/^["']|["']$/g, ''));
  const map = { '$D': demoRel, '$S': `styles/${slug}`, '$O': `styles/${slug}`, '$OUT': `styles/${slug}`, '$W': demoRel };
  const args = [], slots = [];
  for (const t of toks) {
    if (t in map) { args.push(map[t]); continue; }
    if (/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(t)) { args.push(null); slots.push(t); continue; }
    if (t.startsWith('$')) return null;   // ${VAR:+…} 之类无法重建
    args.push(t);
  }
  const otherRefs = slots.reduce((n, v) => {
    const re = new RegExp(v.replace(/\$/g, '\\$') + '(?![A-Za-z0-9_])');
    return n + body.filter(l => l !== line && re.test(l)).length;
  }, 0);
  return { args, slots, otherRefs };
}

/**
 * 事件脚本的位置参数模板（= posArgTemplate 取 events.mjs 那一行）。
 *
 * ★ 通用化说明（2026-10-02，首部「主题→视频」实拍暴露的缺陷）：
 *   原实现只服务 events.mjs，于是 engraving 的 `$C` 只喂到了事件表与渲染两步。
 *   同一条 `$C` 还喂 subs.py（字幕行）—— 而字幕生成器走的是 buildShArgs()，那个函数
 *   **见到未映射的 $C 就返回 null**（担心少传一个参数会把后面的顶到前面去），
 *   结果 subs.py 被**零参数**调用、回落到默认 content.json。
 *   外部表现：成片画面/配音都是新主题，**只有字幕还是旧文案** —— 自相矛盾。
 *   现在两个调用点共用同一个模板，`$C` 这类内容槽统一由 content= 值填。
 */
function eventsArgTemplate(slug, demoRel) {
  return posArgTemplate(slug, demoRel, 'events.mjs');
}

/**
 * 从一份 --q / --q-events 串里取 content= 的值（不做 URL 解码：build.sh 也是原样传文件名）。
 * 取不到返回 null。
 */
function contentOf(q) {
  const m = /(?:^|&)content=([^&]+)/.exec(q || '');
  return m ? m[1] : null;
}

/**
 * 找出 build.sh 里「内容 → lines.json」的那条派生命令，并把内容槽换成 wanted。
 *
 * ★ 为什么必须补这一步（2026-10-02，首部「主题→视频」实拍暴露的缺陷）：
 *   engraving 的 build.sh 第一步就是
 *     `$PY -c "…json.load(open('$D/$C'))…json.dump(…, open('$D/lines.json','w'))"`
 *   —— **配音行文本是从内容文件派生的**。编排器不跑这一步，换内容后配音文本仍来自默认
 *   content.json ⇒ 画面是咖啡、配音还是蜜蜂。旧实现只在日志里打印一句警告，没有补救手段。
 *   4 个内容驱动 demo 里，engraving / midcentury-toon / hologram-hud 三个都有这一行
 *   （silkscreen-poster 无旁白，本来就不需要）。
 *
 * 做法：**照抄 build.sh 那一行**，只替换变量（不重新实现派生规则 —— 那才会漂移）。
 * 变量替换表与各 demo build.sh 的赋值一致；出现表外变量就返回 null（宁可不动，也不猜）。
 */
function linesDerivation(slug, demoRel, wanted) {
  const p = path.join(CFG.winLib, 'styles', slug, 'demo', 'build.sh');
  if (!fs.existsSync(p)) return null;
  const body = fs.readFileSync(p, 'utf8').split('\n').filter(l => !/^\s*#/.test(l) && l.trim());
  // 派生行 = 写 lines.json 的那条；排除消费方（tts.py / asr_check.py / voices 那几行）
  const raw = body.find(l => /lines\.json/.test(l)
    && !/tts\.py|asr_check\.py|\bvoices\b/.test(l)
    && /-c\s+"|\btools\/|\.mjs\b|\.py\b/.test(l));
  if (!raw) return null;
  let cmd = stripInlineComment(raw).trim();
  const map = {
    '$CONTENT': wanted, '$OUT': `styles/${slug}`, '$PY': '.venv/bin/python',
    '$C': wanted, '$D': demoRel, '$S': `styles/${slug}`, '$O': `styles/${slug}`, '$W': demoRel,
  };
  // 长名字先换，避免 $C 命中 $CONTENT 的前缀
  for (const k of ['$CONTENT', '$OUT', '$PY', '$C', '$D', '$S', '$O', '$W']) {
    cmd = cmd.split(k).join(map[k]);
  }
  // 内容文件名（字面量写法，如 midcentury-toon 的 `$D/content.json`）→ wanted。
  // **只换第一个非 lines.json 的 .json 词**：它的位置就是内容槽，后面的 .json 是输出。
  let done = false;
  cmd = cmd.replace(/(?<![\w.-])([\w-]+\.json)(?![\w.-])/g, m => {
    if (done || m === 'lines.json') return m;
    done = true;
    return wanted;
  });
  if (/\$[A-Za-z_{0-9]/.test(cmd)) return null;   // 表外变量（含 ${…} / $1）→ 不猜
  return cmd;
}

/**
 * 把 JS 字符串安全地嵌进 shell 的**单引号**字面量（内部单引号用 '\'' 断开）。
 * null / undefined / 空串 → ''（配合脚本里的 `export VAR=...` 保证 set -u 下也有定义）。
 * ★ 不要用 ${VAR:-default} 那种写法：它会撞上 JS 模板字符串的插值（本文件实测语法错误）。
 */
function shq(s) {
  if (s === null || s === undefined || s === '') return "''";
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

/**
 * 去掉 shell 行的**行尾注释**，但保留引号内的 #（python 的 -c "…" 里可能有）。
 * 只在「不在引号里 且 # 处于行首或前面是空白」时才截断。
 */
function stripInlineComment(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '\\') { i++; continue; }
      if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}

/**
 * 从 build.sh 的 mux.sh 那一行取 demo 自己想要的 grain / CRF。
 * grain = 该行末尾的最后一个纯数字参数（≥2 个纯数字 token 时才认：倒数第二个是 fps）；
 * CRF   = 行内 `CRF=NN`（demo 自带 mux.sh 大多读这个环境变量）。
 * 取不到就返回 null，交给调用方决定（不写死 0 —— 那正是颗粒与 build.sh 不符的根因）。
 */
function muxIntent(slug) {
  const p = path.join(CFG.winLib, 'styles', slug, 'demo', 'build.sh');
  if (!fs.existsSync(p)) return { grain: null, crf: null };
  const line = fs.readFileSync(p, 'utf8').split('\n')
    .find(l => l.includes('mux.sh') && !/^\s*#/.test(l));
  if (!line) return { grain: null, crf: null };
  const nums = line.slice(line.indexOf('mux.sh') + 'mux.sh'.length).split('#')[0]
    .trim().split(/\s+/).filter(t => /^\d+$/.test(t));
  const crf = /CRF=(\d+)/.exec(line);
  return { grain: nums.length >= 2 ? nums[nums.length - 1] : null, crf: crf ? crf[1] : null };
}

/**
 * 从风格档案的 `sound_palette.mix_rules` 里取**该风格自述的成片颗粒**（grain）。
 *
 * ★ 为什么只挑这一个字段：lemo-make 是**编排器**（见文件头），画面/字幕/音频分别由各 demo
 *   自己的 film.js / subs.py / mix.py 负责，编排器唯一能注入、且**真的会改变成片**的风格量
 *   就是 mux 的颗粒（core/render/mux.sh 的 `noise=c0s=$GR:allf=t` 滤镜）。
 *   而 43 份档案的 mix_rules 恰好逐风格写了它（如 hd-2d「颗粒 0」、art-deco「grain 3」）。
 * ★ 保守解析：只认**显式**的 `grain N` / `颗粒 N`；「不加颗粒 / 无颗粒」→ 0；
 *   其它一律 null（= 该特质不生效，调用方沿用原有来源，行为与改动前一致）。
 * ★ 这只是**取值**，不是又一份读取逻辑 —— DNA 对象本身仍由 lib/style-dna-reader.mjs 提供。
 */
function dnaGrainFromMixRules(mixRules) {
  const s = String(mixRules ?? '');
  if (!s) return null;
  // 明确否定（「不加颗粒」「无颗粒」「没有胶片颗粒」）→ 0
  if (/(?:不加|无|没有|绝不加|不叠)[^，。；、]{0,8}颗粒/.test(s)) return 0;
  const m = /(?:grain|颗粒)\s*[=:：]?\s*~?\s*(\d+(?:\.\d+)?)/i.exec(s);
  return m ? Number(m[1]) : null;
}

/**
 * 从 build.sh 里分别取「导出事件」与「渲染」两步各自声明的 --q。
 *
 * ★ 为什么必须分开取（这是本文件修过的一个真实缺陷）：
 *   旧实现把同一个 --q 同时透传给 events.mjs 与 video.mjs，于是
 *   `lemo-make tilt-shift --q noev=1` 会把 noev=1 喂给 events.mjs，事件表被清空（events 0），
 *   配乐 music/score.py 随即 IndexError，整条命令 exit 1。而**不带 --q 时同一条命令 exit 0**。
 *   noev 是**渲染专用**开关（画面不画事件图层），不代表事件表该为空 —— 事件表还要供配乐/字幕消费。
 *
 * ★ 实证依据（对 Windows 库全量 grep build.sh）：
 *   · 29 个 demo 的 events.mjs 那一行，**没有任何一个带 --q**；
 *   · video.mjs 那一行有 4 个带（engraving / tilt-shift / silkscreen-poster / hologram-hud）。
 *   即「--q 是渲染侧参数」正是各 demo 自己 build.sh 的写法。
 *
 * 只接受**字面量**值。含 $ 的写法（hologram-hud 的 "$Q"、silkscreen-poster 的 ${Q:+--q $Q}）
 * 依赖 build.sh 自己的变量，无法忠实重建 —— 一律返回 null，由调用方退回命令行值或不传。
 */
function qIntent(slug) {
  const out = { events: null, render: null };
  const p = path.join(CFG.winLib, 'styles', slug, 'demo', 'build.sh');
  if (!fs.existsSync(p)) return out;
  // 去掉整行注释；行内注释不影响（--q 一定出现在 # 之前）
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(l => !/^\s*#/.test(l));
  const pick = needle => {
    const line = lines.find(l => l.includes(needle));
    if (!line) return null;
    // 前一个字符不能是 - 或字母数字，避免撞上 --query 这类前缀相同的长选项
    const m = /(?:^|[^-\w])--q\s+("[^"]*"|'[^']*'|\S+)/.exec(line);
    if (!m) return null;
    const v = m[1].replace(/^["']|["']$/g, '');
    return v.includes('$') ? null : v;
  };
  out.events = pick('events.mjs');
  out.render = pick('video.mjs');
  return out;
}

/** 头部打印用：把「传了什么 / 没传」显式区分开，避免使用者以为只传了一份。 */
const fmtQ = v => (v === null || v === undefined ? '(无)' : `--q '${v}'`);

const HELP = `
lemo-make — lemo-opuscar 跨 Windows/WSL 统一编排器

  node lemo-make.mjs <demo-slug> [选项]

渲染固定走 Windows GPU（WebGL 在 WSL 拿不到显卡）；音频与混流走 WSL。
音频与渲染是两条独立支线，会并行执行。

选项
  --fps <n>              帧率，默认 24
  --workers <n>          渲染并行数，默认 6
  --out <dir>            输出目录，默认 ${CFG.exportDir}\\<slug>
  --venc <nvenc|libx264> 混流编码器，默认 nvenc（硬件）
  --q <k=v&k=v>          页面参数，**只透传给渲染**（video.mjs）：如 noev=1、content=x.json
                         默认按 demo 的 build.sh 渲染行取（如 tilt-shift 的 noev），取不到就不传
                         content= 是**唯一例外**：同一个值会喂给所有「与渲染同源」的步骤 ——
                         事件导出（engraving 的 tools/events.mjs）、字幕源（subs.py）、
                         以及配音行（按 build.sh 的派生行重建 lines.json）。
                         即：content=x.json 现在是真的「整条链换内容」，不再是只换一半
  --q-events <k=v&k=v>   页面参数，**只透传给事件导出**（events.mjs）。默认不传
                         事件脚本吃位置参数时（engraving），只有 content= 这一项能传过去
  --lines <file>         配音行文件（demo 目录下的 .json）。给了就用它覆盖 lines.json，
                         优先级高于 content= 的自动派生。适用于「只想换台词、不换画面」
  --film <name>          选片名：加载 demo 目录下的 <name>.js 而不是自带的 film.js
                         （页面 ?film=<name>）。用于「同一风格下另做一部新片」
  --lang <code>          语言版本（如 en / zh）。规则：把 content=X.json 换成 X.<code>.json，
                         并**同时**送到渲染与事件侧。语言由内容文件的 "lang" 字段驱动
                         （字体、字距、圆窗编号前缀、配音音色都由它决定）——
                         所以「选语言 → 出全套对应语言的片子」是一条命令
  --ratio <spec>         输出宽高比：9:16（默认）| 16:9 | 3:4 | 4:3 | 1:1
  --size <WxH>           输出像素尺寸，如 1080x1920（自定义）。优先级高于 --ratio
                         ★ 两个都不给时用默认比例 9:16（任务没指定尺寸时的默认值）。
                         比例→像素的换算见 core/render/size.mjs（唯一来源，本文件不另写一份）
  --grain <n>            混流颗粒强度（0 = 不加）。默认按 demo 的 build.sh 取，取不到就用 mux 脚本自己的默认值
  --voice <name>         覆盖配音音色（Index-TTS 零样本克隆的**参考音**）。取值是音色别名或音色库里的名字，
                         如 zh_curator（官方默认）/ zh_kepu9（科普博主9）。不给就用内容文件里写的那个。
                         想先看有哪些可选：python core/tts/tts_indextts.py --list-voices
                         ★ 它只改 lines.json 里每行的 voice 字段，不动内容文件 —— 所以不会多出两份内容文件互相漂移
                         ★ 若本 demo 带声线处理脚本（voice_fx.py / voice.py，如 ascii-crt / scifi-toon），
                           配音走的是该脚本（Kokoro），--voice / --speed **不生效**（会打印 STEP_WARN），
                           音色由该脚本决定 —— 想用 Index-TTS 音色请换用无该脚本的风格
  --speed <n>            覆盖配音语速，0.5–2.0。映射到 Index-TTS 的 duration_factor = 1/speed。
                         ★ 换音色后**必须重调**：不同音色「字/秒」差别很大（实测同一句话同语速下能差 30%），
                         沿用旧语速会要么塞不进时间槽（口播重叠）、要么留下大片静音空档
  --skip-sync            跳过库同步
  --skip-audio           跳过音频（复用已有 mix.wav）
  --skip-render          跳过渲染（复用已有视频）
  --audio-only           只跑音频
  --render-only          只跑渲染
  --dry-run              只打印计划
  --no-preflight         跳过起飞前检查（默认开启；本检查只提示、绝不阻断）
  --manifest <path>      起飞前检查读的 demo 链路声明，默认
                         ${CFG.manifestPath}
                         （也可用环境变量 LEMO_MANIFEST；文件不在就静默跳过检查）
  --help

风格特质档案（style-dna · 约定一）
  「主题+风格」（本编排器）与「文案+风格」「文案+口播+风格」（dub.mjs）**共用同一个知识库**：
  lib/style-dna/<slug>.json（43 份），经**同一个**读取入口 lib/style-dna-reader.mjs 读取 ——
  不各建一套、不各写一份读取逻辑。本通路每次出片都会读入并打印本次用到的特质。
  ★ 本通路能真的改变成片的只有「成片颗粒」一项（来自 sound_palette.mix_rules → mux.sh 的
    noise 滤镜）。优先级：--grain > demo 的 build.sh > **档案** > mux.sh 默认 2。
    档案只补「前两者都没说」的空缺，绝不覆盖 demo 自己声明的值。
  ★ 档案里其余数值特质在本通路**没有消费者**（字幕折行由各 demo 自己的 subs.py/srt.py 负责；
    响度由 mux.sh 固定 −14 LUFS，无覆盖口）—— 打印时会如实标注，不冒充已生效。
  ★ 档案缺失 / slug 无档案 → 一切与改动前逐字节一致（DNA 是增强，不是替代）。

⚠️ --q 为什么默认只给渲染（唯一例外是 content=）：
  各 demo 的 build.sh 里，--q 只出现在 video.mjs 那一行（29 个 events.mjs 行一个都没有）。
  noev 这类是**渲染专用**开关（画面不画事件图层），并不代表事件表该为空 ——
  事件表还要供配乐/字幕消费。旧版把同一份 --q 同时喂给两步，导致
  --q noev=1 让事件表清空、配乐 IndexError、整条命令 exit 1（不带 --q 时反而正常）。
  所以本编排器只挑 content= 这一项同步给事件导出（engraving 的 build.sh 正是
  events 行 $C 与渲染行 --q content=$C 同源），其余键一律不透传。
  事件脚本不吃位置参数时（走 core/render/events.mjs），content= 传不过去 ——
  此时编排器会明确警告「画面已换内容、事件表没换，成片会不一致」，
  补救办法是显式加 --q-events content=x.json（--q-events 就是那个显式逃生口）。

⚠️ content= 为什么是「整条链换内容」（2026-10-02 修正）：
  同一条内容在 build.sh 里通常被**多个步骤**消费。旧实现只跟了渲染与事件两步，
  实测后果（首部「主题→视频」成片）：画面是咖啡、配音是咖啡，**字幕还是上一版文案** ——
  自相矛盾，且只在日志里留了一句警告，没有补救手段。现在 content= 会同步到：
    · 渲染          video.mjs --q content=$C
    · 事件表        demo 自带 events.mjs 的 $C 位置参数
    · 字幕源        subs.py / cues.py 的 $C 位置参数（同一套位置参数模板）
    · 配音行        lines.json —— 照抄 build.sh 那条「内容 → lines.json」的派生行重建
  另外还有一条**时序**约束：渲染页初始化时会读 voices/dur.json 排口播时间窗，
  而 dur.json 是 WSL 侧 TTS 的产物 ⇒ 换内容时必须**先跑配音、把 voices/*.json 回传
  Windows，再开始渲染**（否则字幕与口播窗按旧时长算，实测偏差 0.2–1.6s）。
  这一步由编排器自动完成，代价是音频链路少一段并行（实测 +11s / 205s）。

⚠️ 事件脚本按 demo 自带的优先：
  engraving 自带 tools/events.mjs（吃位置参数 $D [content.json]、不吃 --q）。
  编排器会用它，并按它 build.sh 那一行重建位置参数：$D 换成 demo 目录，
  内容参数（$C）由 --q-events 或 --q 里的 content= 填；用户没给就一个都不传，
  让它退到自己的默认 content.json（即 build.sh 不带参数调用的默认分支）。

示例
  node lemo-make.mjs ascii-crt
  node lemo-make.mjs ukiyoe --fps 30 --workers 8
  node lemo-make.mjs tilt-shift --q noev=1
  node lemo-make.mjs engraving --q content=content_alt.json    # 渲染与事件表一起换内容（该 demo 两步同源）
  node lemo-make.mjs ascii-crt --render-only
`;

// ─────────────────────────── 主流程 ───────────────────────────

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || !o.slug) { console.log(HELP); process.exit(o.help ? 0 : 2); }
  if (o.manifest) CFG.manifestPath = o.manifest;   // --manifest 覆盖默认的声明文件路径

  const demoRel = `styles/${o.slug}/demo`;
  const demoWin = path.join(CFG.winLib, demoRel);
  const demoWsl = `${CFG.wslLib}/${demoRel}`;
  // Windows 库在 WSL 里的挂载点（/mnt/<盘符小写>/<路径>）。回传产物要用它 ——
  // 这里从 CFG.winLib 推导，不再新增一处写死的 /mnt/d/lemo-opuscar。
  const winLibWsl = CFG.winLib.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
  const demoWinWsl = `${winLibWsl}/${demoRel}`;
  const outDir = o.out || path.join(CFG.exportDir, o.slug);
  // mix.wav 的位置因 demo 而异（demo/ 默认、urban-sketch 在 demo/audio/、paper-lantern 在 demo/out/），
  // 所以这里不再写死一条路径：音频脚本跑完会回报实际产出路径，混流脚本也会自己三处探测。
  const mixWavCands = ['mix.wav', 'audio/mix.wav', 'out/mix.wav'].map(p => `${demoRel}/${p}`);
  const videoWsl = `${demoWsl}/out/video_gpu.mp4`;
  const finalWin = path.join(CFG.winLib, 'styles', o.slug, `${o.slug}.mp4`);
  // 混流参数：--grain 优先，其次 build.sh 里写的，再次**风格档案**，最后交给 mux 脚本自己的默认值
  const intent = muxIntent(o.slug);
  // ── 风格特质档案（style-dna）接入：本通路也读**同一个**知识库（约定一）─────────────
  // ★ 读取入口复用 lib/style-dna-reader.mjs（与 dub.mjs 同一模块，不另建一套读取）。
  // ★ 只读 + 缺失即降级：readStyleDna 读不到就返回 null ⇒ dna 为 null ⇒ 本块整体跳过，
  //   行为与改动前逐字节一致（硬要求：DNA 是增强不是替代）。
  // ★ slug 直接就是风格注册表 id（43 个内置风格一一对应），无需另建映射表。
  const dnaRaw = readStyleDna(o.slug);
  const dna = summarizeStyleDna(dnaRaw);
  // 档案自述的成片颗粒 —— 本通路**唯一**能真的改变成片的风格量（进 mux.sh 的 noise 滤镜）。
  const dnaGrain = dnaRaw ? dnaGrainFromMixRules(dnaRaw.sound_palette?.mix_rules) : null;
  // ⚠️ 判空一律用 `??`（同时盖住 null 与 undefined），不要写成 `!== null`：
  //    原实现 `o.grain !== null ? o.grain : intent.grain` 在参数悬空（值为 undefined）时会取到
  //    undefined，把 build.sh 派生的默认值顶掉 —— 这正是 `tilt-shift --q` 静默关掉 `--q noev` 的根因。
  //    parseArgs 现在会对悬空取值直接报错，这里再用 ?? 兜一道，两处都不许出现 undefined。
  //    ★ 档案放在**最后**一位：它只补「--grain 与 build.sh 都没说」的空缺，
  //      绝不覆盖 demo 自己声明的值（否则编排器出的画面会与它自己的 build.sh 不符）。
  const grain = o.grain ?? intent.grain ?? dnaGrain;
  // 页面参数：--q 与 --q-events 分别只作用于渲染 / 事件导出两步（见 qIntent 的说明）。
  // ★ 渲染侧的默认值也照 build.sh 取（与 --grain 同一个思路，不猜）：
  //   tilt-shift 的渲染行自己写着 `--q noev`；不给 --q 就一个都不传的话，编排器渲出的画面会
  //   带上它自己 build.sh 明确关掉的事件/HUD 图层，与它自己的 build.sh 产出的画面不一致。
  //   全仓只有 tilt-shift 的渲染行带**字面量** --q（另 3 个带 --q 的写法是 "$Q" / ${Q:+--q $Q}，
  //   依赖 build.sh 自己的变量，qIntent 一律返回 null —— 那种退回「不传」，与旧行为一致）。
  //   用户显式给了 --q 就覆盖 build.sh 的。
  // 事件侧优先用 --q-events；没给就用 build.sh 在 events.mjs 行声明的（全仓目前都是「没有」）。
  const qIntentV = qIntent(o.slug);
  let qRender = o.q ?? qIntentV.render;
  // --film：把选片名并进渲染查询串（页面用 ?film=<name> 选模块）。已有 film= 就不覆盖。
  if (o.film && !/(?:^|&)film=/.test(qRender || '')) {
    qRender = qRender ? `${qRender}&film=${o.film}` : `film=${o.film}`;
  }
  let qEvents = o.qEvents ?? qIntentV.events;

  // --lang：**语言版本**。语言由「内容文件」承载（内容文件里的 "lang" 字段驱动字体与配音），
  // 所以 --lang zh 的职责就是「把 content= 换成同名的 <base>.zh.json」。
  // 这样「选哪个语言 → 出全套对应语言的片子」就是一条命令，用户不用去记文件名。
  // ★ 与 --film 同理：内容名必须**同时**送到事件侧，否则事件表还是另一种语言的，
  //   字幕/配乐/画面事件层会与画面脱节（而且 cuecheck 会拿同一份错事件核成"通过"）。
  if (o.lang && o.lang !== 'en') {
    const base = contentOf(qRender) || contentOf(qEvents) || 'content.json';
    if (!/\.json$/i.test(base)) fail(`--lang：content= 看起来不是 .json（收到 '${base}'）`);
    const cand = `${base.replace(/\.json$/i, '')}.${o.lang}.json`;
    const demoDirWin = path.join(CFG.winLib, demoRel);
    if (!fs.existsSync(path.join(demoDirWin, cand))) {
      const have = (() => { try { return fs.readdirSync(demoDirWin).filter(f => /^content.*\.json$/i.test(f)).join(', '); } catch { return '(读不到)'; } })();
      fail(`--lang ${o.lang}：在 ${demoRel}/ 下找不到 ${cand}。\n`
        + `  --lang 的规则是「把 content=X.json 换成 X.${o.lang}.json」。\n`
        + `  该 demo 下现有的内容文件：${have}`);
    }
    const swap = s => (s ? s.replace(/(^|&)content=[^&]+/, (m, g1) => `${g1}content=${cand}`) : s);
    qRender = swap(qRender);
    qEvents = swap(qEvents);
    info(`语言版本 ${o.lang} → 内容文件 ${cand}`);
  }

  // ── 配音引擎：由**内容文件**的 voice.engine 决定（缺省 kokoro）────────────────
  // 为什么放在这里：Index-TTS 是本机部署的 **Windows 便携版应用**（自带 venv 与模型），
  // 它的配音阶段与 Kokoro 走**完全不同的进程与平台**，编排器必须提前知道用哪条路。
  // 语言由内容文件承载 ⇒ 引擎也由内容文件承载，两者同一个源头，不会各说各话。
  // ★ 只读，不改任何文件；读不到 / 没有这个字段 ⇒ kokoro（英文与其它风格行为完全不变）。
  let ttsEngine = 'kokoro';
  {
    const cname = contentOf(qRender) || contentOf(qEvents) || 'content.json';
    try {
      const c = JSON.parse(fs.readFileSync(path.join(CFG.winLib, demoRel, cname), 'utf8'));
      if (c && c.voice && c.voice.engine) ttsEngine = String(c.voice.engine);
    } catch { /* 读不到就按默认 kokoro，下面照旧 */ }
    if (ttsEngine !== 'kokoro') info(`配音引擎 ${ttsEngine}（来自 ${cname} 的 voice.engine）`);
  }
  // 渲染命令提前构造：--dry-run 也要能让人亲眼看到实际会传什么（--q 是分步透传的，必须可核）。
  // ── 输出尺寸：--ratio / --size，**缺省 9:16** ────────────────────────────────
  // 用户要求：「视频默认宽高比 9:16；可选 16:9 / 3:4 / 4:3 / 1:1 + 自定义尺寸；
  //            任务没有明确指定输出尺寸时，自动采用默认值 9:16 导出视频。」
  // ★ 比例→像素的换算**不在这里写第二份**：唯一来源是库里的 core/render/size.mjs
  //   （渲染工具与编排器共用同一张表，改一处就够）。库不在或文件没就位时退回内置最小表，
  //   保证编排器不会因为读不到库而起不来 —— 但会明确警告，不静默降级。
  // ★ 为什么默认放在编排器而不是 takeSize：still.mjs / video.mjs 是低层工具，
  //   全库 43 个风格的 demo/build.sh 都直接调它们且不传 --size、全按 1920x1080 构图；
  //   把低层默认改成 9:16 会让那些示例片当场全坏。出片流程显式传尺寸才是正确的位置。
  let outSize = null;
  {
    const p = path.join(CFG.winLib, 'core/render/size.mjs');
    let M = null;
    try { if (fs.existsSync(p)) M = await import(pathToFileURL(p).href); } catch (e) {
      warn(`读 core/render/size.mjs 失败：${String(e.message || e).split('\n')[0]} —— 用内置表兜底`);
    }
    if (!M) {
      M = {
        RATIOS: [{ id: '9:16' }, { id: '16:9' }, { id: '3:4' }, { id: '4:3' }, { id: '1:1' }],
        DEFAULT_RATIO: '9:16',
        // 自定义像素的上下限。**只在读不到库时**用（正常路径 M 就是库模块，下面的 M.MIN_SIZE 直接
        // 取库侧 core/render/size.mjs 的值 —— 改下限只改库，这里不会各说各话）。
        // 下限 96 与库当前值一致：16 是编造的，实测 ≤72 必崩（圆窗半径缩成负数，未捕获的 IndexSizeError）。
        MIN_SIZE: 96, MAX_SIZE: 8192,
        parseSizeSpec(s) {
          const v = String(s ?? '').trim();
          const m = /^(\d+)\s*:\s*(\d+)$/.exec(v);
          if (m) return M.RATIOS.some(r => r.id === `${+m[1]}:${+m[2]}`) ? { ratio: `${+m[1]}:${+m[2]}` } : null;
          const q = /^(\d+)\s*[xX]\s*(\d+)$/.exec(v);
          return q ? { w: +q[1], h: +q[2] } : null;
        },
        resolveSize({ ratio, size, base = 1920 } = {}) {
          let spec = size ?? ratio;   // 下面要改写，必须是 let（写成 const 会在库缺失时抛 TypeError）
          if (spec == null || spec === '') spec = M.DEFAULT_RATIO;
          const pp = M.parseSizeSpec(spec); if (!pp) return null;
          const even = n => 2 * Math.round(n / 2), ok = n => Number.isInteger(n) && n >= M.MIN_SIZE && n <= M.MAX_SIZE;
          if (pp.w != null) return ok(pp.w) && pp.w % 2 === 0 && ok(pp.h) && pp.h % 2 === 0 ? { w: pp.w, h: pp.h } : null;
          const [a, b] = pp.ratio.split(':').map(Number), s = base / Math.max(a, b);
          const w = even(a * s), h = even(b * s); return ok(w) && ok(h) ? { w, h } : null;
        },
        formatSize: ({ w, h }) => `${w}x${h}`,
      };
      warn('（以上是内置兜底表；正常应走 core/render/size.mjs）');
    }
    // ★ 两个都要独立校验，**不能只校验「胜出的那个」**。
    //   原实现是 `const bad = o.size ?? o.ratio` —— 于是 `--size 1080x1920 --ratio 7:5`
    //   会静默丢弃那个拼错的 7:5（退出码 0、一个字都不提）。用户打错比例却毫无反馈，
    //   等到某天只给 --ratio 时才发现自己一直拼错。
    //   ⇒ 改成：**给了的都要合法**；合法性判完再按 size > ratio 定优先级（优先级语义不变）。
    for (const [flag, val] of [['--size', o.size], ['--ratio', o.ratio]]) {
      if (val == null || val === '') continue;
      if (!M.parseSizeSpec(val)) {
        fail(`${flag} 取值非法：'${val}'。\n`
          + `  可用比例：${M.RATIOS.map(r => r.id).join(' | ')}（默认 ${M.DEFAULT_RATIO}）\n`
          + `  或自定义像素：如 1080x1920（两个数都必须是 ${M.MIN_SIZE}–${M.MAX_SIZE} 的偶数）`);
      }
    }
    outSize = M.resolveSize({ ratio: o.ratio, size: o.size });
    // ★ 走到这里说明**格式合法但范围不合法**（例如 `64x64` 格式没问题、但低于可渲染下限）。
    //   原实现只说「解析失败」，不说下限是多少 —— 用户得自己去翻文档才知道该填多大。
    //   独立验证实测过这个缺口（`--size 64x64`）。这里把可用范围直接摆出来。
    if (!outSize) {
      const lo = M.MIN_SIZE, hi = M.MAX_SIZE;
      fail(`--size / --ratio 的取值超出可用范围：ratio=${o.ratio ?? '(无)'} size=${o.size ?? '(无)'}。\n`
        + (lo != null && hi != null
          ? `  自定义像素的宽高都必须在 ${lo}–${hi} 之间、且为偶数（下限 ${lo} 来自影片版面的可渲染约束，见 core/render/size.mjs 的注释）。\n`
          : '')
        + `  可用比例：${M.RATIOS.map(r => r.id).join(' | ')}（默认 ${M.DEFAULT_RATIO}）`);
    }
    info(`输出尺寸 ${M.formatSize(outSize)}（${o.size ? `自定义 ${o.size}` : `比例 ${o.ratio || M.DEFAULT_RATIO}`}）`);

    // ★ 尺寸自适应的**逐风格**闸门。
    //   背景：出片流程默认已是 9:16，而「影片布局自适应」是**逐风格**做的 ——
    //   实测（2026-10-02）全库只有 styles/engraving 的 film.js / film_coffee.js 做了
    //   （它们导出 NATIVE 并用 layout(W,H) 重排），其余风格的 film.js 仍按 1920×1080 硬画。
    //   ⇒ 在那些风格上出非 16:9 的片，**画面会被裁掉一块**（不是缩放、不是重排）。
    //   这种失败是**静默**的：像素尺寸完全正确，只有肉眼看画面才发现。所以必须在这里喊出来。
    //   ★ 判定用「读影片模块源码里有没有 NATIVE」这个文本特征，而不是 import 它：
    //     影片模块是**浏览器模块**（依赖 window/document），Node 里 import 不起来。
    //     这个启发式可能误报（漏判会把「未自适应」说成自适应），所以**只用于警告、不用于阻断**，
    //     且文案里明说「按源码特征判断」。要绕过就显式给 --ratio 16:9。
    if (outSize.w !== 1920 || outSize.h !== 1080) {
      // ★ 优先读**正式声明** `FILM_META.aspects`（语义：「这部影片真的能正确构图的比例清单」，
      //   不写 = 只支持 16:9）。探测逻辑已在 `lib/aspects.mjs` 里做好（读源码文本 + 正则，
      //   因为影片模块是浏览器 ESM，Node 里 import 不起来），并且**控制台全链路已在用它**
      //   （`/api/aspects`、`/api/briefs` 的 styles[].aspects、建单校验、UI 出片前警告）。
      //   优先复用它，而不是我自己再猜一遍源码文本 —— 同一件事只该有一处判断。
      // ★ 兜底：读不到 lib/aspects.mjs 时，退回「源码里有没有 export const NATIVE」这个启发式。
      let verdict = null;                       // {fits, warning, detail, supported}
      try {
        const A = await import(new URL('./lib/aspects.mjs', import.meta.url).href);
        verdict = A.aspectCheck({ slug: o.slug, ratio: o.ratio, size: o.size, film: o.film || null });
      } catch { /* 拿不到就退回下面的启发式 */ }
      if (verdict && verdict.fits === false) {
        warn(verdict.warning || `${o.slug} 未适配 ${M.formatSize(outSize)}`);
        if (verdict.detail) warn(`  ${verdict.detail}`);
        warn(`  ⇒ 像素尺寸会完全正确，但画面不对 —— 请务必看画面确认。`);
        warn(`  ⇒ 只想稳妥出片就加 --ratio 16:9。`);
      } else if (!verdict) {
        const filmName = o.film || 'film';
        const filmPath = path.join(demoWin, `${filmName}.js`);
        let adaptive = null;
        try {
          if (fs.existsSync(filmPath)) adaptive = /export\s+const\s+NATIVE\b/.test(fs.readFileSync(filmPath, 'utf8'));
        } catch { /* 读不了就当判断不了 */ }
        if (adaptive === false) {
          warn(`本风格的影片模块（${demoRel}/${filmName}.js）看起来**没有做尺寸自适应**`);
          warn(`  ⇒ ${M.formatSize(outSize)} 的输出很可能是把 1920×1080 的版面**裁掉一块**，而不是重排。`);
          warn(`  ⇒ 像素尺寸会完全正确，但画面不对 —— 请务必看画面确认。`);
          warn(`  ⇒ 只想稳妥出片就加 --ratio 16:9；要让这个风格真正支持竖屏，得照 styles/engraving/demo/film_coffee.js`);
          warn(`     的做法改造它（导出 NATIVE，把版面搬进 layout(W,H)：位置按 fx/fy 拉伸、尺寸按 min(fx,fy) 缩放）。`);
        } else if (adaptive === null) {
          warn(`找不到影片模块 ${demoRel}/${filmName}.js，无法判断它是否支持 ${M.formatSize(outSize)}（继续执行）。`);
        }
      }
    }
  }

  const renderVArgs = ['core/render/video.mjs', demoRel, '--fps', String(o.fps), '--workers', String(o.workers),
    '--size', `${outSize.w}x${outSize.h}`,
    '--out', path.join(demoWin, 'out', 'video_gpu.mp4')];
  if (qRender) renderVArgs.push('--q', qRender);
  // 混流脚本：demo 自带的 tools/mux.sh 优先（签名与 core 版一致），否则 core/render/mux.sh
  const demoMuxRel = [`${demoRel}/tools/mux.sh`, `${demoRel}/mux.sh`]
    .find(r => {
      const p = path.join(CFG.winLib, r);
      if (!fs.existsSync(p)) return false;
      // 只接受签名 `V="$1"; A="$2"; O="$3"` 的那一类。paper-popup / pictogram-motion / watercolor
      // 的根目录 mux.sh 是「自己拼段 + 混音」的另一套接口（只吃一个输出路径，两个还是 zsh），
      // 照 core 版的 V A O fps grain 调用会传错参数 —— 那种一律回退 core 版。
      return fs.readFileSync(p, 'utf8').includes('A="$2"');
    });

  console.log(C.b(`\nlemo-make · ${o.slug}`));
  console.log(C.dim(`  demo   ${demoRel}`));
  console.log(C.dim(`  输出   ${outDir}`));
  console.log(C.dim(`  编码   ${o.venc}    fps ${o.fps}    workers ${o.workers}`));
  // 打印**生效值**（可能是 build.sh 来的），不只打印命令行给没给
  if (qRender || qEvents) console.log(C.dim(`  页面参数 渲染 ${fmtQ(qRender)} / 事件 ${fmtQ(qEvents)}`));
  if (o.film) console.log(C.dim(`  选片   ${o.film}（页面 ?film=${o.film}）`));
  if (o.lang) console.log(C.dim(`  语言   ${o.lang}`));
  // 换内容的作用范围必须显式打出来：使用者要能一眼看出「这次是整条链换，还是只换了一半」
  const swapPeek = contentOf(qRender) || contentOf(qEvents);
  if (swapPeek) {
    console.log(C.dim(`  换内容 ${swapPeek} → 渲染 / 事件表 / 字幕源 / 配音行 同源切换（配音前置，再渲染）`));
  } else if (o.lines) {
    console.log(C.dim(`  换配音行 ${o.lines} → 覆盖 lines.json（配音前置，再渲染）`));
  }
  console.log(C.dim(`  混流   ${demoMuxRel || 'core/render/mux.sh'}    grain ${grain !== null ? grain : '(脚本默认)'}`
    + (intent.crf ? `    CRF ${intent.crf}` : '')));
  if (!demoMuxRel && fs.existsSync(path.join(CFG.winLib, demoRel, 'mux.sh'))) {
    warn(`${demoRel}/mux.sh 存在，但它的接口不是 V A O [fps] [grain]（自成一体的拼段脚本），回退 core/render/mux.sh`);
  }

  // ── 风格 Skill 文档（style-skills）：把「这个风格怎么做」的方案位置打出来 ──────
  // ★ 这是「选定风格后**优先调取该风格 Skill 文档**作为核心参考」在**本通路**（主题+风格）的落点。
  //   与 dub.mjs 完全同款：经共享模块 lib/style-skill-reader.mjs 读
  //   lib/style-skills/<slug>/SKILL.md（11 节：风格说明/画面构图/配色体系/转场规则/字幕样式/
  //   BGM·音效特征/素材偏好/镜头节奏/制作参数清单/编排规则/当前短板与避坑要点）。
  // ★ 只读 + **缺失即降级**：没蒸馏过的风格整块不打印 ⇒ 输出与改动前逐字节一致。
  //   这与上面 style-dna 那块「只在真生效时才打印」的收紧是两件事：DNA 是**数值**（要判是否生效），
  //   Skill 文档是**方案指针**（存在就该被看到）。
  const skillSum = summarizeStyleSkill(readStyleSkill(o.slug));
  if (skillSum) {
    ok('风格 Skill 文档已就位（11 节制作方案）');
    for (const L of describeStyleSkill(skillSum)) info(C.dim(`  · ${L}`));
  }

  // ── 风格特质档案（style-dna）：把「本次用到了哪些特质」打出来（干跑也看得到）──────
  // ★ 与 dub.mjs 同款：经共享读取模块读 lib/style-dna/<slug>.json，只读、不改任何东西。
  // ★ 但两条通路的**渲染路径不同**（见下），所以这里如实区分「真的改了画面」与「只是档案自述」：
  //   本通路只有「成片颗粒」会进 mux.sh 的 noise 滤镜；字幕折行/响度目标在本链路上没有消费者
  //   （字幕由各 demo 自己的 subs.py/srt.py 生成；响度由 mux.sh 固定 −14 LUFS，无覆盖口）。
  // ★ 档案缺失时这一整块不打印（dna 为 null）⇒ 输出与改动前逐字节一致。
  // ★★ 进一步收紧（2026-10-03）：**只在档案真的生效时才打印**。
  //   原因：「DNA 存在时逐字节一致」与「打印证据」原本不可兼得 —— 43 份档案里有 42 份的值与
  //   build.sh 一致（未生效），若无条件打印就会凭空多出 6 行诊断，破坏「未生效即零 diff」这个保证。
  //   现在改为：**只有 `grain` 最终真的采用了档案值**（即 --grain 与 build.sh 都没说话、由档案补位）
  //   才打印。于是「未生效」与「缺失」两种情况输出都逐字节不变，而真补位时仍可观察。
  const dnaTookEffect = dna != null && dnaGrain != null && o.grain == null && intent.grain == null;
  if (dnaTookEffect) {
    const dnaSrc = `lib/style-dna/${dna.slug}.json`;
    ok(`风格特质已接入出片（来自 ${dnaSrc}）`);
    info(C.dim('  （下列为档案自述；本通路只有「成片颗粒」一项会真的改变成片）'));
    for (const L of describeStyleDna(dna)) info(C.dim(`  · ${L}`));
    info(`  · 成片颗粒：档案 ${dnaGrain} ⇒ **本次采用**（进 mux.sh 的 noise 滤镜，画面真的会变）`);
  }

  // ── 并发保护 ─────────────────────────────────────────────
  // 同一个 demo 同时跑两次会往同一批文件写：out/video_gpu.mp4、mix.wav、成片。
  // mux.sh **自身没有输出锁**，两个 mux 交错写会产出【损坏的成片】——
  // 实测过一次：h264 报 `Invalid NAL unit size` / `Error splitting the input into NAL units`，
  // aac 报 `SBR was found before the first channel element`，**两个流同时损坏**，
  // 而编排器只看到「帧数不符 1185 vs 1435」这种间接症状。
  // ★ 锁目录可被 LEMO_LOCK_DIR 覆盖（默认仍是导出目录，正常行为一字不变）。
  //   为什么需要：test/briefs.test.mjs ⑥「出片全链路」会**真跑一次编排器 --dry-run**，
  //   而只要此刻有别的进程在渲染同一个风格，它就抢不到锁、退出码 1 ⇒ 那条用例假红。
  //   实测多次（跑出片的同时跑套件，⑥ 必然失败，耗时从 9s 涨到 88s）。
  //   这不是「并发污染」而是**测试隔离缺陷**：测试必须能独立于真实渲染运行。
  const lockDir = process.env.LEMO_LOCK_DIR || CFG.exportDir;
  const lockPath = path.join(lockDir, `.${o.slug}.lock`);
  fs.mkdirSync(lockDir, { recursive: true });
  let tookOver = false;
  try {
    fs.writeFileSync(lockPath, `${process.pid}\n${new Date().toISOString()}\n`, { flag: 'wx' });
  } catch {
    let oldPid = NaN, ageMs = Infinity;
    try { oldPid = Number(fs.readFileSync(lockPath, 'utf8').split('\n')[0]); } catch {}
    try { ageMs = Date.now() - fs.statSync(lockPath).mtimeMs; } catch {}
    let alive = false;
    if (Number.isInteger(oldPid) && oldPid > 0) {
      try { process.kill(oldPid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
    }
    if (alive && ageMs < 6 * 3600 * 1000) {
      fail(
        `已有另一个 lemo-make 在跑同一个 demo（pid ${oldPid}，锁创建于 ${Math.round(ageMs / 1000)} 秒前）。\n` +
        '      并发跑会往同一批文件写；mux.sh 没有输出锁，交错写会产出损坏的成片（实测过）。\n' +
        `      等它结束，或确认它已死掉后删掉这个文件再重试：\n        ${lockPath}`
      );
    }
    warn(`接管过期锁（旧 pid ${oldPid}，已不在）`);
    fs.writeFileSync(lockPath, `${process.pid}\n${new Date().toISOString()}\n`);
    tookOver = true;
  }
  const releaseLock = () => { try { fs.unlinkSync(lockPath); } catch {} };
  process.on('exit', releaseLock);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { releaseLock(); process.exit(130); });
  info(C.dim(`并发锁 ${lockPath}${tookOver ? '（接管）' : ''}`));

  // ── 0. 环境自检 ──────────────────────────────────────────
  step('环境自检');
  if (process.platform !== 'win32') fail('本脚本必须在 Windows 侧运行（GPU 渲染需要）');
  ok(`Windows Node ${process.version}`);

  const ffDir = findFfmpegDir();
  if (!ffDir) fail(`找不到可用的 Windows ffmpeg，检查这些目录：\n      ${CFG.ffmpegDirs.join('\n      ')}`);
  const ffv = await run(path.join(ffDir, 'ffmpeg.exe'), ['-hide_banner', '-version']);
  ok(`ffmpeg  ${ffDir}`);
  if (ffv.stdout) info(C.dim(ffv.stdout.split('\n')[0]));

  if (!fs.existsSync(CFG.winLib)) fail(`Windows 库不存在：${CFG.winLib}`);
  if (!fs.existsSync(demoWin)) fail(`demo 不存在：${demoWin}\n      （可用 styles/README.md 里的 slug）`);
  if (!fs.existsSync(path.join(demoWin, 'index.html'))) fail(`${demoWin} 里没有 index.html`);
  ok('库与 demo 就位');

  const probe = await runWsl('echo WSL_OK; uname -r; command -v node || echo -; command -v ffmpeg || echo -',
    { name: '_lemo-probe' });
  if (probe.code !== 0 || !probe.stdout.includes('WSL_OK')) {
    fail(`WSL 不可用（distro=${CFG.wslDistro}）\n      ${probe.stderr || probe.error?.message || ''}`);
  }
  const L = probe.stdout.trim().split('\n').filter(Boolean);
  ok(`WSL ${CFG.wslDistro} · 内核 ${L[1] || '?'}`);
  info(C.dim(`node ${L[2] || '?'} · ffmpeg ${L[3] || '?'}`));
  if (L[3] === '-' || !L[3]) warn('WSL 里找不到 ffmpeg，混流会失败');

  // 渲染在 Windows、混流在 WSL —— 两侧的 core/render/ 必须一致，否则会产出
  // 让人完全摸不着头脑的结果。开工前拦下来，比出片后才发现便宜得多。
  //
  // ★ 为什么这里**自己算**而不是调 lemo-lib-sync.sh 的 check-core：
  //   该工具在本次会话里被证伪过三次，第三次是「内部自洽的假结论」：
  //     1) 对「只在单侧存在的文件」漏判（把文件列出来，但判定仍为一致）
  //     2) 退出码恒为 0（连真分叉也不返回非 0）
  //     3) WORK 目录的临时文件被 root 占住 → 写不进去 → 脚本不检查写失败 →
  //        读到残留文件得 0 → 报 `RESULT: CONSISTENT` + exit 0，真实分叉被静默放行
  //   前两个还能用文本启发式兜底；第三个不行 —— 它给出的是一个看起来完全正常的结论。
  //   ⇒ 闸门不能建立在一个会「自洽地撒谎」的工具上。这里改成自己比对：
  //     Windows 侧用 Node 读文件算 md5（先去 CR 以对齐 WSL 的 LF），
  //     WSL 侧用一条命令输出 `md5 文件名`，两边做集合比对。
  // ★ 核验范围：core/ 下**所有「Windows 写、WSL 也读」的子目录**，不止 core/render。
  //   为什么扩到 tts / lang：2026-10-02 实测踩到过一次 —— 新写的 core/tts/tts_indextts.py
  //   只在 Windows 侧存在（配音却在 WSL 跑），于是 python: can't open file 直接失败，
  //   而且是在链路跑到一半才暴露。同一类问题 core/lang/ 也会发生（语言注册表只在 Windows 侧）。
  //   凡是两侧都可能各有一份的目录，都要进这张表。
  {
    const CORE_DIRS = ['core/render', 'core/tts', 'core/lang'];
    const allProblems = [];
    let checkedFiles = 0, checkedDirs = 0;
    for (const coreRel of CORE_DIRS) {
      const winDir = path.join(CFG.winLib, coreRel);
      const wslDir = `${CFG.wslLib}/${coreRel}`;
      if (!fs.existsSync(winDir)) continue;   // 该目录本就不存在：跳过（不算问题）
      checkedDirs++;
      // ★ 只比**代码/文本**文件。模型与字体这类二进制资产本来就按侧存在，不该算「不一致」：
      //   实测踩到过 —— core/tts/ 下的 kokoro-v1.0.onnx / voices-v1.0.bin（约 350MB）只在 WSL 侧，
      //   因为 Kokoro 在 WSL 跑；core/lang/fonts/*.woff2 只在 Windows 侧，因为字体由浏览器加载。
      //   把它们算进闸门只会逼人做无意义的双份拷贝。
      const CODE_EXT = new Set(['.py', '.mjs', '.js', '.sh', '.css', '.json', '.txt', '.md']);
      const isCode = f => CODE_EXT.has(path.extname(f).toLowerCase());
      const winMap = {};
      for (const f of fs.readdirSync(winDir)) {
        if (f.includes('.orig-')) continue;
        if (!isCode(f)) continue;
        const p = path.join(winDir, f);
        if (!fs.statSync(p).isFile()) continue;
        const norm = fs.readFileSync(p).toString('binary').replace(/\r\n/g, '\n');
        winMap[f] = crypto.createHash('md5').update(Buffer.from(norm, 'binary')).digest('hex');
      }
      const wslCmd = [
        `cd '${wslDir}' || exit 9`,
        `for f in *; do`,
        `  case "$f" in *.orig-*) continue;; esac`,
        `  [ -f "$f" ] || continue`,
        `  case "\${f##*.}" in py|mjs|js|sh|css|json|txt|md) ;; *) continue;; esac`,
        `  printf '%s %s\\n' "$(md5sum "$f" | cut -d' ' -f1)" "$f"`,
        `done`,
      ].join('\n');
      const wr = await runWsl(wslCmd, { name: '_lemo-core-hash' });
      const wslMap = {};
      for (const line of (wr.stdout || '').trim().split('\n')) {
        const m = /^([0-9a-f]{32})\s+(.+)$/.exec(line.trim());
        if (m) wslMap[m[2]] = m[1];
      }
      if (wr.code !== 0) allProblems.push(`[${coreRel}] WSL 侧取哈希失败（退出码 ${wr.code}）—— 常见原因：该目录在 WSL 侧根本不存在`);
      if (Object.keys(wslMap).length === 0) allProblems.push(`[${coreRel}] WSL 侧一个文件哈希都没取到`);
      if (Object.keys(winMap).length === 0) allProblems.push(`[${coreRel}] Windows 侧一个文件都没读到`);
      const names = [...new Set([...Object.keys(winMap), ...Object.keys(wslMap)])].sort();
      for (const n of names) {
        if (!(n in winMap)) allProblems.push(`[${coreRel}] 仅 WSL 有: ${n}`);
        else if (!(n in wslMap)) allProblems.push(`[${coreRel}] 仅 Windows 有: ${n}`);
        else if (winMap[n] !== wslMap[n]) allProblems.push(`[${coreRel}] 内容不同: ${n}  win=${winMap[n].slice(0, 8)} wsl=${wslMap[n].slice(0, 8)}`);
      }
      checkedFiles += names.length;
    }
    if (allProblems.length) {
      console.log(allProblems.map(d => '    ' + d).join('\n'));
      fail(
        `两侧 core/ 不一致（${allProblems.length} 处），已拒绝开工。\n` +
        '      编排器在 Windows 渲染、在 WSL 跑音频与混流，两侧的 core/ 必须同版本，\n' +
        '      否则会产出难以解释的结果（实测过：新脚本只在一侧 → 跑到一半才报 can not open file）。\n' +
        '      人工对齐（把 Windows 侧拷到 WSL；文本去 CR，字体等二进制直接拷）：\n' +
        '        wsl.exe -d ' + CFG.wslDistro + ' -u root -- bash -c "cd /mnt/d/lemo-opuscar/core && \\\n' +
        '          find . -type f \\( -name \\*.py -o -name \\*.mjs -o -name \\*.js -o -name \\*.sh -o -name \\*.css \\) | while read f; do \\\n' +
        '            tr -d \\"\\r\\" < \\"\\$f\\" > /home/lemo/lemo-opuscar/core/\\"\\$f\\"; done; \\\n' +
        '          find . -type f -name \\*.woff2 | while read f; do cp -f \\"\\$f\\" /home/lemo/lemo-opuscar/core/\\"\\$f\\"; done"\n' +
        '      对齐后重跑本命令即可。'
      );
    }
    if (checkedDirs) ok(`core/ 两侧一致（核验 ${checkedDirs} 个目录 / ${checkedFiles} 个文件）`);
  }

  // ── 起飞前检查（按 demo 链路声明，只提示不阻断）────────────
  // 放在这里而不是「音频链路之前」的原因：--dry-run 在下面几行就 exit(0) 了，
  // 而「这个 demo 到底能不能跑」正是 dry-run 最有用的信息 —— 必须赶在它之前。
  // 位置仍在音频链路之前，且不占用 step() 的编号（不改变既有的 [N] 序列）。
  await preflight(o, demoRel);

  // ── P2-1（2026-10-02）：音色/语速覆盖与配音引擎不匹配时**如实告知**，绝不静默忽略 ──────
  //   实证：styles/ascii-crt/demo/voice_fx.py 与 styles/scifi-toon/demo/voice.py 这两个 demo 有
  //   声线处理脚本 ⇒ 音频链路的配音步会走 `if [ -n "$VOICEFX" ]` 分支（Kokoro 的 core/tts/tts.py
  //   + 该脚本），**不会**走 Index-TTS ⇒ 用户传的 --voice / --speed 根本不生效；更糟的是
  //   `--voice zh_kepu9` 会被 Kokoro 当成音色名报 unknown voice，用户完全不知道为什么。
  //   这里不试图让它支持（那是另一个功能），也不 fail（用户可能就是想跑）——只如实报出。
  //   ★ 位置：紧跟 preflight、在 --dry-run 的 exit 之前 ⇒ **干跑也能看到这条提示**
  //     （干跑不跑音频，放音频脚本里就永远看不到；这也正是控制台面板最容易「骗人」的地方）。
  {
    const demoDirWin = path.join(CFG.winLib, demoRel);
    const fx = ['voice_fx.py', 'voice.py'].find(f => fs.existsSync(path.join(demoDirWin, f)));
    const passed = [o.voice ? '--voice' : null, (o.speed !== null && o.speed !== undefined) ? '--speed' : null]
      .filter(Boolean).join(' / ');
    if (fx && passed) {
      warn(`STEP_WARN ${passed} 对本 demo 不生效：${demoRel}/ 走的是声线处理脚本 ${fx}，`
        + `配音引擎被该脚本接管（不是 Index-TTS），音色/语速由该脚本决定 —— 请改该脚本，或换用 Index-TTS 的风格。`);
    }
  }

  if (o.dryRun) {
    console.log(C.warn('\n--dry-run：以下步骤不会真正执行\n'));
    console.log(`  1. 库同步   ${o.skipSync ? '（跳过）' : 'WSL → Windows 下发字体/素材'}`);
    console.log(`  2. 音频     ${o.skipAudio ? '（跳过）' : `WSL：TTS/声线/配乐/混音 → ${mixWavCands.join(' 或 ')}`}`);
    console.log(`  3. 渲染     ${o.skipRender ? '（跳过）' : `Windows GPU → ${videoWsl}`}`);
    if (!o.skipRender) console.log(C.dim(`     $ node ${renderVArgs.join(' ')}`));
    console.log(`  4. 混流     ${(o.skipRender || o.skipAudio) ? '（依赖缺失，跳过）' : `WSL ${demoMuxRel || 'core/render/mux.sh'}（${o.venc}）→ ${finalWin}`}`);
    console.log(`  5. 导出     ${outDir}`);
    console.log(C.dim((contentOf(qRender) || contentOf(qEvents) || o.lines)
      ? '\n  换内容/换配音行时：2 的「配音」阶段会先单独跑完并回传 voices/*.json，\n'
        + '  之后 2 的「配乐+混音」与 3 才并行（页面要靠 dur.json 排口播时间窗）。\n'
      : '\n  2 与 3 会并行执行。\n'));
    process.exit(0);
  }

  // ── 1. 库同步 ────────────────────────────────────────────
  if (!o.skipSync) {
    step('同步两份库（字体/素材 WSL → Windows；video.mjs 回灌）');
    const syncPath = path.join(CFG.tmpDir, 'lemo-lib-sync.sh');
    if (!fs.existsSync(syncPath)) {
      warn(`${syncPath} 不存在，跳过同步（先跑 sync-builder 产出的同步脚本）`);
    } else {
      const r = await runWsl(fs.readFileSync(syncPath, 'utf8'), { name: 'lemo-lib-sync', args: 'push' });
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(C.dim(r.stderr));
      if (r.code !== 0) fail('库同步失败');
      ok(`同步完成  ${el()}`);
    }
  } else {
    step('同步两份库'); info(C.dim('（--skip-sync）'));
  }

  // ── 1.5 demo 级软链 node_modules → Windows junction（P0）──
  // 必须在「导出事件与字幕」之前：events.mjs 要开页面，页面用相对路径 importmap 时会 404。
  // **不受 --skip-sync 影响** —— 这一步修的是 Windows 侧的结构，与同步脚本无关（同步脚本也不处理软链）。
  // 没这种结构时（全仓目前只有 paper-popup）一个字符都不输出。
  await ensureDemoNodeModulesJunctions();

  // ── 1.6 demo 自带的一次性素材生成器：$D/paper.py（页面贴图）────
  // ★ 这是**起飞前检查在真实运行中自己找出来的缺口**（已登记）：
  //   全仓只有 watercolor 有 demo/paper.py —— 它用 numpy/PIL 程序化生成 demo/paper.jpg
  //   （页面贴图；纯本地、无需任何外部素材、秒级），但不在任何 build.sh 里，旧候选列表也没有它
  //   ⇒ 从不执行 ⇒ events.mjs / 渲染开页面时 paper.jpg 404。声明里的报错原文：
  //   「optional file missing: styles/watercolor/demo/paper.jpg (404)」。
  // ★ 顺序：必须排在「导出事件与字幕」与「渲染」**之前** —— 那两步都要开页面读它。
  //   所以这里刻意不用 step()（会打乱既有的 [N] 编号，而 preflight 也遵守这条），改用方括号标题。
  // ★ 落点：两个消费者（core/render/events.mjs、core/render/video.mjs）都在 **Windows** 侧
  //   读 D:\lemo-opuscar\...\demo\paper.jpg；而第 1 步的库同步是 WSL→Windows 且已经跑完，
  //   所以这里在 WSL 侧生成后要**显式拷到 Windows 侧**（与第 2 步的回传方向相反）。
  //   WSL 侧那份也留着：起飞前检查是在 WSL 侧核存在性的。
  // ★ 只在脚本真的存在时才动（全仓只有 watercolor）—— 其余 42 个 demo 一个字符都不输出。
  {
    const paperRel = `${demoRel}/paper.py`;
    if (fs.existsSync(path.join(CFG.winLib, paperRel))) {
      console.log(`\n${C.b('[素材] demo 自带的页面贴图生成器（WSL）')}`);
      const paperScript = `
set -u
set -o pipefail
LIB=${CFG.wslLib}
D=${demoWsl}
cd "$LIB" || { echo "STEP_FAIL cd 到库目录"; exit 1; }
# 声明里这条的 gate 是「仅当 paper.jpg 缺失」—— 已有就不重跑（程序化产物是确定性的）
if [ -f "$D/paper.jpg" ]; then
  echo "  paper.jpg 已在 WSL 侧存在，跳过生成"
else
  echo "  paper.py → paper.jpg（纯程序生成，无需外部素材）"
  ( cd "$D" && "$LIB/.venv/bin/python" paper.py ) 2>&1 | tail -3 || echo "STEP_WARN paper.py 失败（页面贴图仍缺失，事件/渲染会 404）"
fi
# 拷到 Windows 侧：事件导出与渲染都在那边开页面读它
if [ -f "$D/paper.jpg" ]; then
  if cp -f "$D/paper.jpg" "/mnt/d/lemo-opuscar/${demoRel}/paper.jpg"; then
    echo "  paper.jpg → Windows 侧（/mnt/d/lemo-opuscar/${demoRel}/paper.jpg）"
  else
    echo "STEP_WARN paper.jpg 拷到 Windows 侧失败（渲染会 404）"
  fi
fi
`;
      const pr = await runWsl(paperScript, { name: '_lemo-paper' });
      if (pr.stdout) process.stdout.write(pr.stdout);
      if (pr.stderr) process.stderr.write(C.dim(pr.stderr));
      if (pr.code !== 0) warn('页面贴图生成脚本出错（见上方输出；不阻断，页面可能 404）');
    }
  }

  // ── 2. 导出事件与字幕（Windows 侧，并回传 WSL）────────────
  // ⚠️ 这一步有两个坑，都是实测发现的：
  //   (a) **跨文件系统**：events.mjs / subs.mjs 要开页面，只能在 Windows 侧跑，产物落在
  //       Windows 库；但它们的**消费者全在 WSL 侧** —— `mix.py` / `music/score.py` /
  //       `subs.py` 读 `events.json`，`mux.sh` 的 `srt.py` 读 `out/subs.json`。
  //       两侧是独立文件系统，**必须显式拷回去**，否则音频会静默沿用 WSL 上的陈旧事件表
  //       （实测 ascii-crt：Windows 18:28:45 vs WSL 15:47:12）。
  //   (b) **顺序**：各 demo 的 build.sh 里 events.mjs 在 mix.py **之前**（有依赖），
  //       而音频与渲染是并行跑的 —— 所以这一步必须放在并行段**之前**，不能塞进渲染分支。
  // ★ 包成**可重入**函数（2026-10-02 修，中文 9:16 首跑暴露）：
  //   events/subs 的时间窗是按 voices/dur.json 排的，而 dur.json 由「配音前置」阶段重写。
  //   旧实现只在配音**之前**导出一次 ⇒ 换内容后整片字幕仍按上一轮文案的时长排
  //   （实测字幕比配音拖后 0.5~0.9 秒）。配音前置跑完会再调一次，把时间窗刷到真实时长上。
  const exportEventsAndSubs = async () => {
  step('导出事件与字幕（Windows 侧，产物回传 WSL）');
  {
    // LEMO_FILM：demo 自带的事件脚本要按它自己 build.sh 那行重建位置参数（没有 film 的位置），
    // 所以选片名走环境变量传进去，而不是加位置参数（那会把 work 顶掉）。
    const env = { ...process.env, PATH: `${ffDir};${process.env.PATH || ''}`, LEMO_GPU: '1', LEMO_FILM: o.film || '' };
    const winHas = rel => fs.existsSync(path.join(CFG.winLib, rel));
    // 只有「本次运行新写出来的」文件才回传 WSL。两侧是独立文件系统，把 Windows 上的陈旧提交版
    // 覆盖到 WSL 去，会让配乐/混音读到一份不该更新的旧数据。
    const stamp = Date.now() - 3000;
    const fresh = rel => { try { return fs.statSync(path.join(CFG.winLib, rel)).mtimeMs >= stamp; } catch { return false; } };
    const artifacts = [];
    let subsGen = null;        // 跑成功了的字幕生成器
    let subsGenFound = null;   // 找到了但没跑成的（用于把「没有」和「失败」两种情形分开报）

    // demo/out/ 被 .gitignore 排除，全新克隆里不存在，而好几个生成器（whiteboard/tools/subs.mjs、
    // impasto/tools/dump_timeline.mjs）自己**不建目录**就直接往里写 → ENOENT。先建好。
    fs.mkdirSync(path.join(demoWin, 'out'), { recursive: true });

    // ① 事件表。★ 脚本本身也要候选探测（与配乐生成器同一个思路：不猜，看 demo 自己有什么）：
    //    demo 自带 tools/events.mjs / events.mjs 时优先用它 —— 它是「同一个产物的另一份实现」，
    //    但**接口不同**。全仓只有 engraving 是这一类：它的 tools/events.mjs 吃位置参数（$D [content.json]），
    //    而 core/render/events.mjs 吃 --q。旧实现硬编码 core 版，于是 engraving 的 events.json
    //    是由**错的脚本**生成的（连参数传递方式都不同）。
    //    参数照它自己 build.sh 的那行抄（eventsArgTemplate）；抄不出来时只传 demo 目录 ——
    //    这正是 build.sh **不带内容参数**调用时的默认分支（脚本自己会退到 content.json）。
    //
    // ★ 内容同步（engraving 的 $C 语义，本文件修过的缺陷）：
    //    engraving 的 build.sh 是 `node $D/tools/events.mjs $D $C` + `video.mjs … --q "content=$C"`，
    //    **两步同源于 $C**。所以用户 `--q content=x.json` 时，这个 x.json 也必须喂给事件导出，
    //    否则渲染换了内容、事件表（→ 字幕/配乐/画面事件层）还停在旧内容上，成片自相矛盾。
    //    取值优先级：--q-events 里的 content=（显式指向事件侧）→ --q 里的 content=。
    //    对**不吃位置参数**的事件脚本（core/render/events.mjs 吃 --q），--q 不会透传过去，
    //    这时明确警告「画面已换内容、事件表未换」，并提示用 --q-events 补救。
    //    ⚠️ 只同步 content= 这一项，**绝不**把整个 --q 透传过去：noev 是渲染专用开关
    //    （画面不画事件图层），喂给事件导出会让事件表清空、配乐 IndexError、整条命令 exit 1（实测）。
    const demoEvRel = [`${demoRel}/tools/events.mjs`, `${demoRel}/events.mjs`].find(winHas);
    const renderContent = contentOf(qRender);   // 渲染侧实际会用的内容
    const wanted = contentOf(qEvents) || renderContent;   // 用户希望事件侧用的内容（若有）
    let evContent = null;   // 事件侧**实际**会用到的内容（null = 没换，脚本退到自己的默认）
    let warnedContent = false;   // 已经就「内容没同步过去」警告过了，别再被下面的一致性闸门重复报一次
    let evArgs;
    if (demoEvRel) {
      const tpl = eventsArgTemplate(o.slug, demoRel);
      if (tpl && tpl.slots.length && wanted !== null) {
        // 内容槽填上：engraving 的 $C 就是 build.sh 渲染行 `--q content=$C` 里的同一个 $C
        evContent = wanted;
        evArgs = [demoEvRel, ...tpl.args.map(x => (x === null ? wanted : x))];
        info(C.dim(`事件导出与渲染同源换内容（复刻 build.sh 的 ${tpl.slots.join('/')}）：content=${wanted}`));
        if (tpl.otherRefs) {
          info(C.dim(`  该 demo 的 build.sh 还有 ${tpl.otherRefs} 行从同一个 ${tpl.slots.join('/')} 派生`
            + '（配音行 lines.json、字幕行 subs.py、静帧行等）——'
            + '配音行与字幕源已由本编排器同步跟随（linesDerivation + 位置参数模板），静帧未跟随。'));
        }
      } else {
        // 内容槽填不上（用户没给 content=）→ 只传 build.sh 默认分支会传的那些参数，脚本自己退到默认
        // content.json —— 与旧行为逐字节一致（实测默认情形无后果）。
        const cut = tpl ? tpl.args.findIndex(x => x === null) : -1;
        evArgs = [demoEvRel, ...(tpl ? (cut === -1 ? tpl.args : tpl.args.slice(0, cut)) : [demoRel])];
        if (wanted !== null) {
          warn(`${demoEvRel} 的事件接口不吃 content= —— 画面已换成 content=${wanted}，事件表没换，成片会不一致`);
          warn('  （它只吃位置参数，没有可放 content= 的位置；请按它自己的接口手动导出，或直接跑它自带的 build.sh）');
          warnedContent = true;
        }
      }
      if (qEvents && wanted === null) {
        warn(`${demoEvRel} 吃位置参数、不吃 --q —— 本次 --q-events '${qEvents}' 不会被采纳（只有 content= 这一项能传给它）`);
      }
    } else {
      evArgs = ['core/render/events.mjs', demoRel];
      if (qEvents) evArgs.push('--q', qEvents);
      evContent = contentOf(qEvents);   // core 版吃 --q：只有显式 --q-events 里的 content= 才真会到事件侧
      if (wanted !== null && evContent === null) {
        warn(`core/render/events.mjs 不会收到 content=${wanted}（--q 只透传给渲染）`);
        warn(`  → 若该 demo 的渲染认 content=，则画面已换内容、事件表没换，成片会不一致。`
          + `显式加 --q-events content=${wanted} 才能两步同换。`);
        warnedContent = true;
      }
    }
    // --film：选片名必须同时送到**事件侧**，否则事件表由默认 film.js 产出 —— 画面是新片、
    // 事件表/字幕/配乐还是示例片，而成片看起来「能出」，cuecheck 还会拿同一份错事件核成「通过」。
    // （这是「内容只换一半」的同类缺陷，只是换的维度从 content 变成了 film。）
    if (o.film) {
      if (demoEvRel) {
        // demo 自带的事件脚本按**位置参数**走：它的 argv[4] 是 work、argv[5] 才是 film，
        // 所以必须显式把 work 补上，否则 film 会被当成 work（事件表就写到 film 名字的目录里去了）。
        evArgs.push(demoRel, o.film);
        info(C.dim(`事件导出按选片名走（复刻它的位置参数，work=${demoRel}）：film=${o.film}`));
      } else {
        // core/render/events.mjs 吃 --q：把 film= 并进去（已有 --q 就追加，没有就补一个）
        const qi = evArgs.indexOf('--q');
        if (qi >= 0) evArgs[qi + 1] = `${evArgs[qi + 1]}&film=${o.film}`;
        else evArgs.push('--q', `film=${o.film}`);
        info(C.dim(`事件导出按选片名走（--q）：film=${o.film}`));
      }
    }
    // 一致性闸门：两侧实际用的 content= 必须相同，否则画面一套内容、字幕/配乐/画面事件层另一套。
    // 只在「至少一侧显式给了 content=」时才可能触发 —— 都不给时两侧都用页面默认，天然一致。
    if (!warnedContent && renderContent !== evContent) {
      warn(`渲染与事件的内容不一致：渲染 content=${renderContent ?? '(未指定，页面默认)'}`
        + ` / 事件 content=${evContent ?? '(未指定，页面默认)'}`);
      warn(`  成片会自相矛盾。两步同换请用 --q content=${evContent ?? renderContent}`
        + '（demo 自带的事件脚本吃位置参数时，编排器会自动把它同步给事件导出）');
    }
    info(C.dim(`$ node ${evArgs.join(' ')}`));
    const evR = await run(process.execPath, evArgs, { cwd: CFG.winLib, env });
    if (evR.code !== 0) {
      // 失败后翻译：把 404 / optional file missing 这类底层报错里的路径捞出来核一遍，
      // 明确区分「缺素材」与「编排器探测错了」（见 diagnoseMissingAssets 的说明）。只 warn，不 fail。
      diagnoseMissingAssets(demoRel, `${evR.stdout || ''}\n${evR.stderr || ''}`);
      fail(`events.mjs 失败（退出码 ${evR.code}）：${(evR.stderr || '').trim().split('\n').slice(-2).join(' ')}`);
    }
    info(`events.mjs → ${(evR.stdout || '').trim().split('\n').filter(Boolean).pop() || 'ok'}`);
    artifacts.push(`${demoRel}/events.json`);

    // ①-b 声音设计 cues（urban-sketch 的 tools/export_cues.mjs）★ 2026-10-07 补的缺口。
    //   build.sh 的顺序是 events.mjs → **export_cues.mjs** → audio/score.py → audio/foley.py，
    //   与这里同序。它开页面读 window.STROKES / TRACK() / EV / DUR，写 demo/audio/cues.json ——
    //   那是 WSL 侧 audio/foley.py:12 `json.load(open(os.path.join(D, 'cues.json')))` 的**直读输入**
    //   （世界笔画时间 / 帽子轨迹速度声像 / 事件），决定了拟音轨的全部时间与声像。
    //   旧编排器不跑它 ⇒ 拟音按**旧画面**的笔画与轨迹排，而画面已换新内容、退出码 0（无法区分）。
    //   ⚠️ 必须在**并行段之前**（与 events.mjs 同一个理由：它的消费者在 WSL 侧，产物要先回传）；
    //      也必须在 mix.py 之前（foley.py 的产物又是 mix.py 的输入）。
    //   ⚠️ 它**开页面 ⇒ 只能在 Windows 侧跑**，产物落在 Windows 库 ⇒ 必须进 artifacts 显式回传 WSL
    //      （否则 foley.py 读到 WSL 上那份陈旧 cues.json）。
    //   ★ 候选探测：全库 43 个风格里只有 urban-sketch 有它；不存在就跳过、不出声。
    //     无参数调用（与它自己的 build.sh 一致；openDemo 默认 1920x1080）。
    const cuesRel = `${demoRel}/tools/export_cues.mjs`;
    if (winHas(cuesRel)) {
      info(C.dim(`$ node ${cuesRel}`));
      const cR = await run(process.execPath, [cuesRel], { cwd: CFG.winLib, env });
      if (cR.code !== 0) {
        fail(`export_cues.mjs 失败（退出码 ${cR.code}）：${(cR.stderr || '').trim().split('\n').slice(-2).join(' ')}`);
      }
      info(`export_cues.mjs → ${(cR.stdout || '').trim().split('\n').filter(Boolean).pop() || 'ok'}`);
      artifacts.push(`${demoRel}/audio/cues.json`);
    }

    // ② 配乐/混音共用的时间网格。原实现从不跑它 —— impasto 的 music/score.py:9 与 mix.py:9 第一行就
    //    json.load(out/timeline.json)，而 styles/*/demo/out/ 被 .gitignore 排除 → 第 2 步必然 FileNotFoundError。
    //    paper-lantern 用的是自己那套 render/cues.mjs（同一个产物、同一个位置）。
    const tlRel = [`${demoRel}/tools/dump_timeline.mjs`, `${demoRel}/render/cues.mjs`].find(winHas);
    if (tlRel) {
      const tR = await run(process.execPath, [tlRel], { cwd: CFG.winLib, env });
      if (tR.code !== 0) {
        // 不 fail：另 4 个 demo 的 timeline.json 是提交在仓库里的，页面导出失败也还能用旧值。
        // 真缺文件的那种（impasto）会在配乐那一步以 FileNotFoundError 现形，由音频支线报出来。
        warn(`${tlRel} 失败（退出码 ${tR.code}）—— 依赖 timeline.json 的配乐/混音可能失败`);
      } else {
        info(`${tlRel} → ${(tR.stdout || '').trim().split('\n').filter(Boolean).pop() || 'ok'}`);
      }
    }

    // ③ 字幕生成器（node 类：要开页面，只能在 Windows 侧跑）。原实现只认 tools/subs.mjs，
    //    全仓 43 个 demo 里只有 6 个有它 —— 其余 37 个的字幕源从不重新生成。
    const subsNodeRel = [`${demoRel}/tools/subs.mjs`, `${demoRel}/subs.mjs`, `${demoRel}/tools/export.mjs`].find(winHas);
    if (subsNodeRel) {
      subsGenFound = subsNodeRel;
      // 参数照 build.sh 抄（取不到就不传，让脚本走自己的默认值）
      const a = buildShArgs(o.slug, demoRel, path.basename(subsNodeRel)) || [];
      const sR = await run(process.execPath, [subsNodeRel, ...a], { cwd: CFG.winLib, env });
      if (sR.code !== 0) {
        warn(`${subsNodeRel} 失败（退出码 ${sR.code}）—— 该 demo 的字幕源没有更新`);
        if (sR.stderr) info(C.dim((sR.stderr || '').trim().split('\n').slice(-3).join('\n        ')));
      } else {
        subsGen = subsNodeRel;
        info(`${subsNodeRel} → ${(sR.stdout || '').trim().split('\n').filter(Boolean).pop() || 'ok'}`);
      }
    }

    // ④ 本次新写出的中间产物回传 WSL（字幕源在第 4 步由 WSL 的 srt.py 消费，配乐/混音读 timeline.json）
    for (const rel of [
      `${demoRel}/out/timeline.json`, `${demoRel}/timeline.json`,
      ...['out/subs.json', 'subs.json', 'out/srt.json', 'out/cues.json', 'cues.json'].map(c => `${demoRel}/${c}`),
    ]) {
      if (winHas(rel) && fresh(rel) && !artifacts.includes(rel)) artifacts.push(rel);
    }
    const lines = [`mkdir -p '${CFG.wslLib}/${demoRel}/out'`];
    for (const rel of artifacts) {
      lines.push(`if cp -f '/mnt/d/lemo-opuscar/${rel}' '${CFG.wslLib}/${rel}'; then echo "  回传 OK: ${rel}"; else echo "  ! 回传失败: ${rel}"; fi`);
    }
    const cr = await runWsl(lines.join('\n'), { name: '_lemo-artifacts' });
    if (cr.stdout) process.stdout.write(cr.stdout.split('\n').map(l => l ? '    ' + l : l).join('\n') + '\n');
    if (cr.code !== 0) warn('事件/字幕产物回传 WSL 时出错（见上方输出）');

    // ⑤ 字幕生成器（python 类：用 WSL 的 .venv 跑，且必须排在 ④ 之后，否则读到的是陈旧的 events.json）
    // ★ 候选照 demo链路声明说明.md 第 6.1 节的命名分布补齐，**每条都核过全仓有 demo 在用**：
    //   tools/subs.py(9) · subs.py(3) · tools/cues.py(1，shadow-puppet) · cues_export.py(1，one-line)
    //   两条新候选都**直接写文件**（tools/cues.py 写 out/cues.json；cues_export.py 写 cues.json），
    //   是真正 drop-in 的「字幕源生成器」。
    //   同名但**故意不收**的：cues.mjs(ink-wash) / tools/cues.mjs(midcentury-toon) ——
    //   它们把 JSON 打到 **stdout**，build.sh 里是 `node cues.mjs > out/cues.json` 的重定向写法。
    //   编排器不做重定向就会「跑成功但一个文件都没写」，还会把 subsGen 置上、盖掉后面那句
    //   「字幕源没有重新生成」的正确警告 ⇒ 加了比不加更糟。
    const subsPyRel = [`${demoRel}/tools/subs.py`, `${demoRel}/subs.py`,
      `${demoRel}/tools/cues.py`, `${demoRel}/cues_export.py`].find(winHas);
    if (subsPyRel && !subsGen) {
      subsGenFound = subsGenFound || subsPyRel;
      // ★ 与事件导出共用同一个位置参数模板（2026-10-02 修）：engraving 的 build.sh 是
      //   `$PY $D/tools/subs.py $C`，$C 与渲染行 `--q content=$C` 同源。
      //   旧实现走 buildShArgs()，那个函数见到未映射的 $C 就返回 null ⇒ subs.py 零参数调用
      //   ⇒ 字幕源回落到默认 content.json ⇒ **画面/配音换了新主题、只有字幕还是旧文案**。
      //   现在：有内容槽就填 content= 值，没有内容槽（或用户没给 content=）就只传模板里
      //   内容槽之前的部分 —— 后者与 build.sh 默认分支逐字节一致。
      const subsTpl = posArgTemplate(o.slug, demoRel, path.basename(subsPyRel));
      let a = [];
      if (subsTpl) {
        const cut = subsTpl.args.findIndex(x => x === null);
        if (cut === -1) {
          a = subsTpl.args;
        } else if (wanted !== null) {
          a = subsTpl.args.map(x => (x === null ? wanted : x));
          info(C.dim(`字幕生成器与渲染同源换内容（复刻 build.sh 的 ${subsTpl.slots.join('/')}）：content=${wanted}`));
        } else {
          a = subsTpl.args.slice(0, cut);
        }
      }
      const pyScript =
        `set -o pipefail\n` +
        `cd '${CFG.wslLib}' || exit 1\n` +
        `.venv/bin/python '${subsPyRel}'${a.map(x => ` '${x}'`).join('')} 2>&1 | tail -3\n`;
      const pr = await runWsl(pyScript, { name: '_lemo-subs-py' });
      if (pr.stdout) process.stdout.write(pr.stdout.split('\n').map(l => l ? '    ' + l : l).join('\n') + '\n');
      if (pr.code !== 0) {
        warn(`${subsPyRel} 失败（退出码 ${pr.code}）—— 该 demo 的字幕源没有更新`);
      } else {
        subsGen = subsPyRel;
        info(`${subsPyRel} → ok（WSL .venv）${a.length ? '  args=' + a.join(' ') : ''}`);
      }
    }

    if (!subsGen) {
      warn(subsGenFound
        ? `${subsGenFound} 没能跑成 —— 本编排器未重新生成字幕源；.srt 是否更新取决于第 6 步混流（该 demo 若自带 srt 生成器则由它产出）`
        : '该 demo 没有本编排器支持的字幕生成器 —— 本编排器不生成字幕源；.srt 是否更新取决于第 6 步混流（该 demo 若自带 srt 生成器则由它产出）');
      info(C.dim('（已探测 tools/subs.mjs / subs.mjs / tools/export.mjs / tools/subs.py / subs.py /' +
        ' tools/cues.py / cues_export.py；cues.mjs、tools/cues.mjs 是 stdout 重定向写法、' +
        'build.sh 内联等尚未支持；另 4 个 demo 的 srt 由自带的 srt 生成器直接产出，见混流步）'));
    } else {
      info(`字幕生成器 ${subsGen} —— .srt 将在第 4 步由 srt.py 重新生成`);
    }
  }
  };
  await exportEventsAndSubs();

  // ── 3 & 4. 音频（WSL）与渲染（Windows GPU）并行 ───────────
  // 音频链路。关键点（由独立验证发现并修正）：
  //   全仓 43 个 demo 里**只有 ascii-crt 有 voice_fx.py**。原实现无条件把 TTS 输出到
  //   voices_raw/ 再指望 voice_fx.py 搬到 voices/，导致其余 42 个 demo 的 voices/ 永远为空、
  //   asr_check 与 mix.py 必然崩。正确做法（与各 demo 自己的 build.sh 一致）：
  //     有 voice_fx.py → TTS 出到 voices_raw/ → fx → voices/
  //     没有           → TTS 直接出到 voices/
  // ★ 换内容时的**时序约束**（2026-10-02，首部「主题→视频」实拍暴露）：
  //   渲染页初始化时会 fetch('voices/dur.json') 来排口播时间窗，而 dur.json 是 WSL 侧
  //   TTS 的产物、Windows 侧那份是仓库里已提交的（默认内容专用）。
  //   ⇒ 一旦换内容/换配音行，dur.json 必然要变，**必须先出配音、把 voices/*.json 回传
  //     Windows，再开始渲染**，否则成片字幕与口播时间窗全按旧文案算（实测偏差 0.2–1.6s）。
  //   全仓有 20+ 个 demo 的页面读 voices/dur.json，所以这不是 engraving 一家的问题。
  const swapContent = contentOf(qRender) || contentOf(qEvents);
  const textMayChange = swapContent !== null || o.lines !== null;
  const deriveCmd = swapContent !== null ? linesDerivation(o.slug, demoRel, swapContent) : null;
  const linesSrcWsl = o.lines ? `${CFG.wslLib}/${demoRel}/${o.lines}` : null;
  if (textMayChange) {
    info(C.dim(`配音行文本可能变了 → 配音先跑，voices/*.json 回传 Windows 后再渲染`
      + (deriveCmd ? `（lines.json 由 build.sh 的派生行重建）` : '')));
    if (swapContent !== null && !deriveCmd) {
      warn(`该 demo 没有可复刻的「内容 → lines.json」派生行 —— 配音文本不会随 content=${swapContent} 变。`
        + `如需换配音，请用 --lines 指定行文件，或直接跑它自带的 build.sh。`);
    }
  }

  // phase: 'all' = 配音+配乐+混音一次跑完；'voice' = 只到配音（回传 dur.json 用）；
  //        'rest' = 跳过配音，只跑配乐+混音（与渲染并行）。
  const audioScriptFor = (phase) => `
set -u
set -o pipefail
export PATH=/usr/local/bin:$PATH
export LEMO_VOICE_ONLY=${phase === 'voice' ? '1' : '0'}
export LEMO_SKIP_VOICE=${phase === 'rest' ? '1' : '0'}
export LEMO_DERIVE_LINES=${phase === 'rest' ? "''" : shq(deriveCmd)}
export LEMO_CONTENT=${shq(swapContent)}
# --voice / --speed：音色与语速覆盖（空串 = 不动 lines.json 里的原值）
export LEMO_TTS_VOICE=${shq(o.voice || '')}
export LEMO_TTS_SPEED=${shq(o.speed === null || o.speed === undefined ? '' : String(o.speed))}
export LEMO_LINES_SRC=${phase === 'rest' ? "''" : shq(linesSrcWsl)}
# 配音引擎（由内容文件的 voice.engine 决定，缺省 kokoro）与两个平台各一份的 demo 路径。
# Index-TTS 是本机 Windows 便携版：它的脚本会自重入到自带 venv 的 python，所以从 WSL 启动即可，
# 但**传给它的输出目录必须是 Windows 路径**（那个 python 认 D:/... 不认 /mnt/d/...）；
# 而 mix.py 跑在 WSL，所以随后还要用 /mnt 那份路径把 wav 拷回来。
export LEMO_TTS_ENGINE=${shq(ttsEngine)}
export LEMO_DEMO_WIN=${shq(demoWinWsl.replace(/^\/mnt\/([a-z])/, (m, d) => d.toUpperCase() + ':'))}
export LEMO_DEMO_WIN_MNT=${shq(demoWinWsl)}
# ★ 无缓冲：本脚本的输出要边跑边透传（见下面「输出策略」）。python 的 stdout 一旦不是 tty
#   （这里是管道）就按 4KB 块缓冲，默认攒满 4KB 或进程退出才吐 —— 输出只有几十行时等于
#   「退出时才吐」，子步骤之间全是静默。这里统一解掉，覆盖本脚本里所有 python 调用。
export PYTHONUNBUFFERED=1
LIB=${CFG.wslLib}
D=${demoWsl}
cd "$LIB" || { echo "STEP_FAIL cd 到库目录"; exit 1; }

# ── 输出策略：直接流式，既不截断也不缓冲 ─────────────────────────────────────
# 本脚本是编排器里唯一一条以 stream:true 跑的 WSL 路径（输出边跑边透传）。要真的边跑边出，
# 必须**同时**满足两件事 —— 少任何一件都会退化成「子步骤跑完才一起冒出来」：
#   ① 管道末端不能有 tail -N：tail 必须等到 EOF 才知道「最后 N 行」是哪 N 行，会把整条管道攒住。
#   ② 上游 Python 必须无缓冲：python 的 stdout 一旦不是 tty（这里是管道）就按 4KB 块缓冲，
#      默认要攒满 4KB 或进程退出才吐 —— 输出只有几十行时等于「退出时才吐」。
# ★ 两条都是**实测**出来的（生产者逐行输出、每行间隔 1s，用到达时刻计时）：
#     经 tail -2                    → 3 行全挤在 EOF 时刻到达（+3.0s/+3.0s/+3.0s）
#     stdbuf -oL python3 ...        → 仍然全挤在 EOF（+9.1s/+9.1s/+9.1s）—— stdbuf 改的是
#                                     libc stdio，而 CPython 的 sys.stdout 走自己的
#                                     BufferedWriter，压根不受它影响 ⇒ stdbuf 这条路是死的
#     python3 -u / PYTHONUNBUFFERED=1 → 逐行到达（+3.1s/+4.1s/+5.1s），这才是真流式
# ⇒ 下面每一处都直接输出；Python 无缓冲统一由本脚本顶部的 PYTHONUNBUFFERED=1 负责
#   （不逐个写 -u：一是少改 8 处，二是脚本内部再 spawn 的 python 子进程也一并生效）。
# ★ 失败检测不受影响：set -o pipefail 下「管道退出码 = 上游退出码」，去掉 tail 后退出码语义
#   完全等价，|| { echo "STEP_FAIL ..."; exit 1; } 与 || echo "STEP_WARN ..." 两套语义原样保留。
# ⚠️ 仍有静默的地方（改不了，如实说明）：有些脚本（如 score.py）中途**一个字都不打印**，
#   只在最后 dump 一段 JSON —— 那段是纯计算时间，没有输出可流。要看到进度只能改 demo 自己的脚本。

# 属主防御：历史上以 root 跑过命令，留下 root:root 的文件（如 voices/words.json），
# 会让 asr_check.py / mix.py 写回时 PermissionError 直接失败。lemo 有免密 sudo，先纠正。
# ⚠️ 这里刻意**不写成「|| true」** —— 静默吞掉失败就是「假保险」：chown 没成功但没人知道，
#    等到后面写回时才以 PermissionError 的形式炸出来，归因困难。失败要出声。
#    （另注：本文件里所有 shell 片段都在 JS 模板字符串内，注释里绝不能出现反引号 ——
#      它会与相邻反引号配对，把中间内容当表达式求值，静默改坏文本且不报语法错。
#      同理：shell 的美元大括号写法会撞上 JS 插值，本文件里一律只用 $VAR 形式。）
for sub in voices voices_raw music out .; do
  [ -e "$D/$sub" ] || continue
  if ! sudo chown -R lemo:lemo "$D/$sub" 2>/dev/null; then
    echo "  ! 警告：chown -R lemo:lemo $D/$sub 失败（若该处有 root 属主文件，后续写回会 PermissionError）"
  fi
done

# ── 换内容：重建 lines.json（配音行文本的源头）──────────────────────────────
# 编排器在换内容时把 build.sh 里那条「内容 → lines.json」的命令**原文**传进来
# （见 linesDerivation）。不重建的话配音文本仍来自默认 content.json ⇒
# 画面/字幕/事件都换了新内容、只有配音还是旧的，成片自相矛盾。
if [ -n "$LEMO_DERIVE_LINES" ]; then
  echo "[换内容] 按 build.sh 的派生行重建 lines.json（content=$LEMO_CONTENT）"
  if sh -c "$LEMO_DERIVE_LINES"; then
    echo "  ✓ lines.json 已从 $LEMO_CONTENT 派生"
  else
    echo "STEP_WARN lines.json 派生失败 —— 配音文本可能仍是默认内容"
  fi
fi
# --lines：显式指定配音行文件（优先级最高，覆盖上面的派生结果）
if [ -n "$LEMO_LINES_SRC" ]; then
  if cp -f "$LEMO_LINES_SRC" "$D/lines.json" 2>/dev/null; then
    echo "[换内容] lines.json 已按 --lines 指定文件覆盖：$(basename "$LEMO_LINES_SRC")"
  else
    echo "STEP_WARN --lines 指定的文件拷不进来：$LEMO_LINES_SRC"
  fi
fi

# ★ --voice / --speed：覆盖内容文件里的音色与语速（控制台「声音」版块用这条）。
#   位置放在派生与 --lines 之后 = 优先级最高。只改 lines.json 里每行的这两个字段，
#   不动文本/顺序/其它字段 —— 这样「换音色」不必改内容文件，也就不会多出两份内容文件互相漂移。
if [ -n "$LEMO_TTS_VOICE" ] || [ -n "$LEMO_TTS_SPEED" ]; then
  .venv/bin/python -c '
import json, sys
p, voice, speed = sys.argv[1], sys.argv[2], sys.argv[3]
L = json.load(open(p, encoding="utf-8"))
for x in L:
    if voice: x["voice"] = voice
    if speed: x["speed"] = float(speed)
json.dump(L, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("  \u2713 lines.json 音色/语速已覆盖：voice=%s speed=%s（%d 条）"
      % (voice or "(不变)", speed or "(不变)", len(L)))
' "$D/lines.json" "$LEMO_TTS_VOICE" "$LEMO_TTS_SPEED"
fi

# ── 脚本探测 ────────────────────────────────────────────────────────────────
# 声线后处理：voice_fx.py（ascii-crt）→ voice.py（scifi-toon，另外还写 voices/lips.json 口型包络）
VOICEFX=""
for c in "$D/voice_fx.py" "$D/voice.py"; do [ -f "$c" ] && { VOICEFX="$c"; break; }; done

# demo 自带 TTS：$D/tts/gen.py（Kokoro，本地离线）。★ 这是补上的另一处窄口：
#   编排器的 TTS 步只认 $D/lines.json，而 watercolor / paper-popup 的台词在 $D/tts/lines.json
#   ⇒ 旧候选列表里没有它 ⇒ voices/v*.wav 永不生成 ⇒ mix.py 读不到配音（外部表现与「缺素材」一样）。
#   与 core/tts/tts.py 是**两套互斥的后端**：只在 $D/lines.json 不存在时才用它，避免两条 TTS 链都跑。
TTSOWN=""
for c in "$D/tts/gen.py"; do [ -f "$c" ] && { TTSOWN="$c"; break; }; done

# 配乐生成器：全仓有 8 种命名（写死 music/score.py 时，多个 demo 的配乐直接不跑 → 混音读不到 score.wav）
# 逐条都有实证（见 demo链路声明说明.md 第 6.1 节；括号里是该命名的 demo 数）：
#   music/score.py(30) · music/edit.py(4) · music.py(3) · music/muzak.py(1) · music/compose.py(1)
#   music/music.py(1，pictogram-motion) · audio/score.py(1，urban-sketch) · sound.py(1，living-screencast)
MUSIC=""
for c in "$D/music/score.py" "$D/music/compose.py" "$D/music/muzak.py" "$D/music/music.py" "$D/music/edit.py" "$D/music.py" "$D/music/audio/score.py" "$D/audio/score.py" "$D/music/sound.py" "$D/sound.py"; do
  [ -f "$c" ] && { MUSIC="$c"; break; }
done

# 混音脚本：mix.py → sound.py（living-screencast 一个脚本兼任配乐+混音）→ audio/mix.py（urban-sketch）
MIX=""
for c in "$D/mix.py" "$D/sound.py" "$D/audio/mix.py"; do [ -f "$c" ] && { MIX="$c"; break; }; done

# 拟音/音效生成器（写 foley_*.wav 这类中间轨）。★ 这是本文件修过的一个真实缺口：
#   全仓只有 urban-sketch 用 audio/foley.py（纯程序合成，不需要任何外部素材），
#   而旧候选列表里只有「配乐」与「混音」两组，**没有任何 foley 生成器** ⇒
#   foley.py 从不执行 ⇒ 下一步 mix.py 读不到 foley_pen.wav 而失败。
#   这与「素材不在仓库里」的外部表现完全一样，但性质相反 —— 是编排器漏跑了一步
#   （见 demo链路声明说明.md 第 5 节 #4 与 demo-manifest-all.json 的 urban-sketch 声明）。
#   顺序：必须排在混音**之前**（mix.py 直接读它的产物）。
FOLEY=""
for c in "$D/audio/foley.py" "$D/foley.py" "$D/tools/foley.py"; do [ -f "$c" ] && { FOLEY="$c"; break; }; done

# 同一个脚本兼任配乐与混音时只跑一次（放混音那一步跑，顺序与它自己的 build.sh 一致）
MUSIC_DEDUP=0
if [ -n "$MUSIC" ] && [ "$MUSIC" = "$MIX" ]; then
  echo "[配乐] $(basename $MUSIC) 同时兼任配乐与混音，只在混音步骤跑一次"
  MUSIC=""
  MUSIC_DEDUP=1
fi

# ── 配乐 ────────────────────────────────────────────────────────────────────
# ★ 2026-10-06：把配乐与「配音 + ASR」**并行**（实测省 4.7~5.8s / 13~14%）。
#   本段位置由「配音之后」提到「配音之前」，就是为了让它能后台起跑。
#   ★ 为什么可以并行（判据**从代码推出**，不写死风格名单）：
#     配音步只写 voices/，配乐步只写 music/，两者产物不重叠；
#     唯一可能的依赖是「配乐脚本把配音产物当素材」。
#     ⇒ 判据 = 该 demo 的配乐脚本是否引用 voices/ 目录或配音阶段产物
#       （dur.json / words.json / words_rel.json / lips.json）。
#     全库 43 风格实测命中 2 个，它们保持**串行**：
#       · game-show/demo/music.py:24 —— wave.open(f'voices/{name}.wav')：把喊词采样混进音乐做闪避；
#       · living-screencast/demo/sound.py:200 —— 读 voices/*.wav（它同时兼任混音，下面的
#         MUSIC_DEDUP 会把 MUSIC 清空，配乐步本就不跑）。
#   ★ 为什么不能按 slug 写死：hologram-hud/demo/music/score.py 里出现的 voices= 是 pad_chord()
#     的**函数参数**（去谐声部数），与 voices/ 目录毫无关系 —— 按名字猜会把它误判成「必须串行」。
#   ★ 相位边界（两个都保持原语义）：
#     · 'voice'（LEMO_VOICE_ONLY=1）只跑到配音就 exit ⇒ 本段整块不跑（旧位置在 exit 之后，等价）；
#     · 'rest'（LEMO_SKIP_VOICE=1）本相位内没有配音步可重叠 ⇒ 走前台，与改前逐字节等价。
#   ★ 失败语义不变：后台分支的退出码留在 MUSIC_PID 上，由下面的「等配乐」wait 出来照旧 exit 1。
MUSIC_PID=""
if [ "$LEMO_VOICE_ONLY" != "1" ] && [ -n "$MUSIC" ]; then
  echo "[配乐] $(basename "$MUSIC")"
  mkdir -p "$D/music/stems"
  # 缺源素材预检（**只警告，不 fail**）：music/src/ 被 .gitignore 排除（styles/*/demo/music/src/），
  # 全新克隆里不存在。配乐脚本引用它时，不预检的话后面只会报一句底层 FileNotFoundError /
  # LibsndfileError / ffprobe CalledProcessError，看不出「跑不了不是编排器的问题，是你缺这个文件」。
  # 只在「脚本正文确实出现 src/」时才提示，避免对不依赖它的 demo 误报。
  if grep -q 'src/' "$MUSIC" 2>/dev/null; then
    if [ ! -d "$D/music/src" ] || [ -z "$(ls -A "$D/music/src" 2>/dev/null)" ]; then
      echo "  ! 缺源素材：$(basename "$MUSIC") 引用 music/src/，但 $D/music/src/ 不存在或为空"
      echo "    （该目录被 .gitignore 排除，需自行补齐后再跑；见本 demo 的 CREDITS / CUES.md）"
    fi
  fi
  MUSIC_READS_VOICES=0
  if grep -qE "voices[/'\\"]|dur\\.json|words(_rel)?\\.json|lips\\.json" "$MUSIC" 2>/dev/null; then
    MUSIC_READS_VOICES=1
  fi
  if [ "$LEMO_SKIP_VOICE" != "1" ] && [ "$MUSIC_READS_VOICES" = "0" ]; then
    echo "  → 与配音并行（该配乐脚本不引用 voices/ 与配音阶段产物）"
    ( .venv/bin/python "$MUSIC" 2>&1 || { echo "STEP_FAIL $(basename "$MUSIC")"; exit 1; } ) &
    MUSIC_PID=$!
  else
    .venv/bin/python "$MUSIC" 2>&1 || { echo "STEP_FAIL $(basename "$MUSIC")"; exit 1; }
  fi
elif [ "$LEMO_VOICE_ONLY" != "1" ] && [ -n "$MIX" ]; then
  if [ "$MUSIC_DEDUP" = "1" ]; then
    # living-screencast 的 sound.py 同时兼任配乐与混音（上面已说明只在混音步骤跑一次）
    echo "[配乐] 已由混音脚本一并产出（同一个脚本，见上）"
  else
    # 全仓 43 个 demo 里只有 paper-lantern 走到这里：它的 music/ 里只有 MUSIC.md 与 analysis.json，
    # **从来没有配乐生成器**，mix.py 直读两个不在仓库里的第三方 mp3（Kevin MacLeod 曲目）。
    # 旧实现只说「由混音脚本一并产出」，会让使用者以为没问题 —— 如实说明编排器补不了这类缺口。
    echo "[配乐] 无独立配乐生成器，跳过"
    echo "  ! 该 demo 的 music/ 下没有任何配乐生成脚本 —— 若混音脚本直读 music/ 里的素材（如第三方 mp3），"
    echo "    而素材又不在仓库里，本编排器无法补齐：见该 demo 的 MUSIC.md / CREDITS，自行下载后重跑。"
  fi
fi

# ── 配音 ────────────────────────────────────────────────────────────────────
# LEMO_SKIP_VOICE=1：配音已在「渲染前的前置阶段」跑过（换内容时必须先出 dur.json，
# 否则 Windows 页面读到旧的 voices/dur.json，口播时间窗全错）。这里跳过，只跑配乐+混音。
if [ "$LEMO_SKIP_VOICE" = "1" ]; then
  echo "[配音] 跳过（已在渲染前的前置阶段完成，本次只跑配乐与混音）"
fi
if [ "$LEMO_SKIP_VOICE" != "1" ]; then
if [ -f "$D/lines.json" ]; then
  if [ -n "$VOICEFX" ]; then
    # ★ 引擎声明与实际不符的坑（实证）：本分支**优先于**下面的 indextts 分支 —— 只要 demo 有
    #   voice_fx.py / voice.py 就走这里的 Kokoro（core/tts/tts.py），即使内容文件里写了
    #   "engine": "indextts" 也会**静默**跑 Kokoro。更隐蔽的是这类 demo 的 lines.json 里 voice
    #   常是 zh_curator 这种 Index-TTS 别名，喂给 Kokoro 直接报 unknown voice，用户看到的是
    #   「音色不认识」，根本想不到是引擎没生效。不 fail（用户可能就是想用 Kokoro）：只出声说清。
    if [ "$LEMO_TTS_ENGINE" = "indextts" ]; then
      echo "STEP_WARN 内容文件声明 engine=indextts，但本 demo 有声线处理脚本 $(basename $VOICEFX)，Index-TTS 引擎不生效 —— 实际用的是 Kokoro（core/tts/tts.py）"
    fi
    # TTS 的原始输出目录由声线脚本自己决定：ascii-crt 的 voice_fx.py 读 voices_raw/，
    # scifi-toon 的 voice.py 读 out/raw/。按脚本里实际写的那个字符串选目录。
    RAW="$D/voices_raw"
    if grep -q 'out/raw' "$VOICEFX" 2>/dev/null && ! grep -q 'voices_raw' "$VOICEFX" 2>/dev/null; then
      RAW="$D/out/raw"
    fi
    mkdir -p "$RAW"
    echo "[配音 1/2] TTS → $(basename $RAW)/"
    .venv/bin/python core/tts/tts.py "$D/lines.json" "$RAW" 2>&1 || { echo "STEP_FAIL tts"; exit 1; }
    echo "[配音 2/2] 声线处理 $(basename $VOICEFX)"
    MARK=/tmp/lemo-voicemark-$$
    touch "$MARK"
    .venv/bin/python "$VOICEFX" 2>&1 || { echo "STEP_FAIL $(basename $VOICEFX)"; exit 1; }
    # 声明了副产物的（voice.py 写 voices/lips.json 口型包络）必须确认它真被刷新了 ——
    # lips.json 不被刷新而 dur.json 被 tts.py 覆盖，会让口型与语音错位，且完全看不出来。
    if grep -q 'lips.json' "$VOICEFX" 2>/dev/null; then
      if [ -f "$D/voices/lips.json" ] && [ "$D/voices/lips.json" -nt "$MARK" ]; then
        echo "  ✓ voices/lips.json 已随配音刷新"
      else
        echo "STEP_WARN $(basename $VOICEFX) 没有刷新 voices/lips.json（口型包络会与本次配音不同步）"
      fi
    fi
    rm -f "$MARK"
  else
    if [ "$LEMO_TTS_ENGINE" = "indextts" ]; then
      # ── Index-TTS 本地（用户本机部署的 Windows 便携版）──────────────────────
      # 与 Kokoro 的区别（三条，都是实测得来的）：
      #   ① 它跑在 Windows：脚本自重入到便携版自带的 venv python，所以从 WSL 启动没问题，
      #      但**输出目录必须给 Windows 路径**（LEMO_DEMO_WIN）。
      #   ② 产物要写到**Windows 侧**的 voices/：渲染页读的就是那一份 dur.json；
      #      写完再用 /mnt 那份路径把 wav 拷回 WSL，因为 mix.py 在 WSL 跑。
      #   ③ 它一次进程加载模型（1~2 分钟）批量合成全部行，所以**不要**逐条调用。
      echo "[配音 1/1] TTS → Index-TTS 本地（Windows 便携版，零样本克隆参考音）"
      if ! .venv/bin/python core/tts/tts_indextts.py "$D/lines.json" "$LEMO_DEMO_WIN/voices" 2>&1; then
        echo "STEP_FAIL tts_indextts"; exit 1
      fi
      mkdir -p "$D/voices"
      n=0
      for f in "$LEMO_DEMO_WIN_MNT"/voices/*.wav; do
        [ -f "$f" ] || continue
        cp -f "$f" "$D/voices/$(basename "$f")" && n=$((n+1))
      done
      if [ "$n" -gt 0 ]; then
        echo "  ✓ 已把 $n 个 wav 回传到 WSL 的 voices/（mix.py 在 WSL 跑，要用这一份）"
      else
        echo "STEP_WARN 没有从 Windows 侧回传到任何 wav"
      fi
      # ★ dur.json 必须与**刚搬过来的这批 wav**逐条一致，而且必须落在 WSL 侧。
      #   旧实现是「从 Windows 把 dur.json 拷过来」，依赖那一刻 Windows 侧文件已落盘 ——
      #   实测不可靠：2026-10-02 中文 9:16 复跑时该 if 判空（没打印那行），WSL 侧的 dur.json
      #   就停在 kokoro 时代的旧值，紧接着「回传 Windows」又把它盖回 Windows，
      #   于是 events/字幕时间窗全按旧时长排 —— 字幕比配音拖后 0.5~0.9s，且逐条差 0.47~0.87s。
      #   改成**直接从 WSL 侧这批 wav 重算**：不依赖任何跨侧时序假设，且天然与 wav 一致。
      # ★ 必须**按 lines.json 的 id 过滤**，不能把 voices/*.wav 全量 glob 进来。
      #   实测踩到过：英文版遗留的 close.wav 躺在 WSL 的 voices/ 里，重算出来的 dur.json
      #   就多一条 "close": 5.383 —— 而 dur.json 是 events/字幕排时间窗的唯一依据。
      #   （Windows 侧合成前也会清 stale wav，但那清的是 Windows 的 voices/，管不到这一份。）
      .venv/bin/python -c '
import json, os, sys, wave
D = sys.argv[1]
ids = [L["id"] for L in json.load(open(os.path.join(D, "lines.json"), encoding="utf-8"))]
out = {}
for i in ids:
    p = os.path.join(D, "voices", i + ".wav")
    if not os.path.isfile(p):
        sys.exit("dur recompute: missing wav for line %r" % i)
    w = wave.open(p)
    out[i] = round(w.getnframes() / w.getframerate(), 3)
    w.close()
json.dump(out, open(os.path.join(D, "voices", "dur.json"), "w"), indent=1)
print("  \u2713 voices/dur.json 已按 lines.json 逐条从 wav 重算（%d 条，供事件/字幕排时间窗）" % len(out))
' "$D"
    else
      echo "[配音 1/1] TTS → voices/（该 demo 无 voice_fx.py/voice.py，按它自己 build.sh 的写法直接输出）"
      .venv/bin/python core/tts/tts.py "$D/lines.json" "$D/voices" 2>&1 || { echo "STEP_FAIL tts(voices)"; exit 1; }
    fi
  fi
  if [ -z "$(ls -A "$D/voices"/*.wav 2>/dev/null)" ]; then
    echo "STEP_FAIL voices/ 里没有 wav 产出"; exit 1
  fi

  # ── 变调后处理：pitch.py（按 lines.json 里每行的 pitch 字段做变调重采样）────────────
  # ★ 这是本文件修过的一个真实缺口（2026-10-06 端到端实测确证）：全库 43 个风格里**只有
  #   art-deco** 有 tools/pitch.py，而它**改变音频内容** —— 对带 pitch 字段的行做
  #   k = 2^(st/12) 的变调重采样（音色更年轻、时长随之变短），并**改写 voices/dur.json**。
  #   旧编排器的音频链里没有任何一步会跑它 ⇒ 门童两句的 +4 半音在编排器通路里**静默丢失**：
  #   成片照出、退出码 0，只有拿 dur.json 与 build.sh 那条路逐条对照才看得出来
  #   （实测编排器出的 B1 1.009 / B2 1.113，而做过 pitch 的应是 0.801 / 0.883）。
  # ★ 位置有**硬约束**（两条，都不许动）：
  #   ① 必须排在**配音之后** —— 它读 TTS 刚写出的 wav 与 dur.json；
  #   ② 必须排在**回传 Windows / ASR 之前** —— dur.json 是「配音 → 回传 → 渲染」这条时序链的
  #      判据（渲染页初始化时 fetch 它来排口播时间窗），回传之后再改就白搭。
  #   因此它落在 LEMO_SKIP_VOICE 块**之内**：'rest' 相位（配音已在前置阶段跑过）若再跑一次，
  #   变调会被**叠加两次**。
  # ★ 候选探测照本文件既有写法（与 MUSIC / MIX 那几处同一个形状）；**不写死 slug** ——
  #   只在文件存在时跑，不存在就跳过、不出声（全库只有 art-deco 有它）。
  PITCH=""
  for c in "$D/tools/pitch.py"; do [ -f "$c" ] && { PITCH="$c"; break; }; done
  if [ -n "$PITCH" ]; then
    echo "[配音 变调] $(basename "$PITCH")（按 lines.json 的 pitch 字段升调，会改写 wav 与 dur.json）"
    # 失败**不静默**：这一步的产物就是音频内容本身，悄悄跳过等于把「音色与 build.sh 不符」藏起来。
    # 与 voice_fx.py / voice.py 同级处理，也与各 demo build.sh 的 set -e 语义一致。
    .venv/bin/python "$PITCH" "$D/lines.json" "$D/voices" 2>&1 || { echo "STEP_FAIL $(basename "$PITCH")"; exit 1; }
  fi

  # ── 人声裁剪：trim_cmd.py（按 lines.json 里每行的 trim 字段裁掉首尾多余的词）───────────
  # ★ 这是本文件修过的**第二个**「build.sh 有、旧编排器漏跑、且**改音频内容**」的缺口
  #   （2026-10-07 逐条核实确证）：全库 43 个风格里**只有 microgame** 有 tools/trim_cmd.py。
  #   它解决的问题写在它自己的 docstring 里：「Kokoro 念单个词结尾会带一个元音尾巴」
  #   （Pump → "Pompey"）。做法：把 lines.json 里带 trim 字段的行（microgame 4 条：
  #   c_pump / c_catch / c_zip / c_pull）按 whisper 词时间戳只留第一个词、末尾 40ms 淡出。
  #   它**改写三样东西**（缺一不可，全部影响成片）：
  #     ① 裁剪后的 wav —— 人声内容本身；
  #     ② voices/dur.json —— 时长随之变短（渲染页 fetch 它排口播时间窗）；
  #     ③ lines.json.asr.json —— 把这几行的 asr 期望文本设成那个词（供 asr_check 比对）。
  #   旧编排器一步都不跑 ⇒ 4 个命令词仍带元音尾巴、dur.json 停在未裁剪的时长，
  #   而成片照出、退出码 0 —— 与「跑通了」无法区分。
  # ★ 位置与 pitch.py **同级同约束**（两条都不许动）：
  #   ① 必须排在**配音之后** —— 它读 TTS 刚写出的 wav 与 dur.json；
  #   ② 必须排在**回传 Windows / ASR 之前** —— dur.json 是「配音 → 回传 → 渲染」这条时序链的
  #      判据，回传之后再改就白搭。
  #   因此同样落在 LEMO_SKIP_VOICE 块**之内**：'rest' 相位（配音已在前置阶段跑过）若再跑一次，
  #   会二次裁剪已裁过的 wav（把命令词越裁越短）。
  # ★ 候选探测照本文件既有写法；**不写死 slug** —— 不存在就跳过、不出声（全库只有 microgame 有它）。
  TRIM=""
  for c in "$D/tools/trim_cmd.py"; do [ -f "$c" ] && { TRIM="$c"; break; }; done
  if [ -n "$TRIM" ]; then
    echo "[配音 裁剪] $(basename "$TRIM")（按 lines.json 的 trim 字段裁首尾多余的词，会改写 wav、dur.json 与 lines.json.asr.json）"
    # 失败**不静默**：这一步的产物就是音频内容本身，悄悄跳过等于把「命令词带元音尾巴、dur.json 偏长」
    # 藏起来。与 pitch.py / voice_fx.py 同级处理，也与各 demo build.sh 的 set -e 语义一致。
    .venv/bin/python "$TRIM" "$D/lines.json" "$D/voices" 2>&1 || { echo "STEP_FAIL $(basename "$TRIM")"; exit 1; }
  fi

  # ASR 的**输入行文件**也要跟着换：microgame 的 build.sh 那一行是
  #   .venv/bin/python core/tts/asr_check.py $D/lines.json.asr.json $D/voices
  # —— 用的是 trim_cmd.py 刚写出的那一份（它把被裁行的 asr 期望文本设成了那个词，"Pump"）。
  # 拿原始 lines.json 去比，会把「已裁到只剩 Pump」的音频和期望文本「Pump, now!」比 ⇒ 4 条假 DIFF
  # 刷屏（实测 build.sh 通路没有这 4 条）。words.json 本身与 asr 字段无关（只由转写决定），
  # 所以这条只影响校对措辞与 asr_check 的退出码，不影响成片。
  # ★ 只在**本步真跑过**时才改用它：否则一个没有 trim_cmd.py 的 demo 若仓库里躺着一份陈旧的
  #   lines.json.asr.json，ASR 会拿旧期望文本去核新音频（同一类「陈旧文件伪装成新的」坑）。
  ASR_LINES="$D/lines.json"
  if [ -n "$TRIM" ] && [ -f "$D/lines.json.asr.json" ]; then ASR_LINES="$D/lines.json.asr.json"; fi

  # ASR 校对只对拉丁语言有意义。离线 Kokoro 的中文音质本身一般，而 asr_check 用的 whisper 小模型
  # 对中文实测 9/9 全部 DIFF（相似度 0.20–0.57）；更要命的是它的 norm 不归一化「十/百/千」，
  # 所以含多位数字的行即使转写正确也会 FAIL ⇒ 中文版只会刷一屏假警告，掩盖真正的失败。
  # 判定按 lines.json 里的 lang（配音行派生自内容文件的 voice.lang，见 build.sh 第一条命令）。
  # ★ 改成**按行**判定（2026-10-02）。旧写法是文件级 grep 'cmn'/'ja'，两个实证的坑：
  #   ① lang 写成 zh / zh-Hans 的中文 demo 匹配不到 ⇒ 不跳过 ⇒ 中文 9/9 假 DIFF 照样刷屏；
  #   ② 只要文件里**有一条** cmn，同文件的英文行也被一起跳过 ⇒ 漏校对。
  #   现在要求**所有行**的 lang 都是 CJK 才跳过；有任何一行非 CJK 就照常跑
  #   （宁可多跑一次 ASR，也不漏校对）。lang 缺失按「非 CJK」处理，同样偏保守。
  ASR_SKIP=$(.venv/bin/python -c '
import json, sys
try:
    L = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    print("0"); sys.exit(0)
def cjk(lang):
    return str(lang or "").lower().startswith(("zh", "cmn", "ja", "ko", "yue"))
print("1" if L and all(cjk(x.get("lang")) for x in L) else "0")
' "$D/lines.json")
  if [ "$ASR_SKIP" = "1" ]; then
    echo "[配音 校对] 跳过 ASR —— 所有行的 lang 都是 CJK（离线 ASR 对中文实测 9/9 全 DIFF，且数字归一化缺失）"
    # ★ 跳过 ASR ⇒ asr_check.py（words.json 在配音阶段唯一的写者）没跑 ⇒ 那份 words.json 保持旧内容。
    #   处理原则（2026-10-02，经复核后定稿）：
    #     ① **绝不删除** —— 全库有 17 处消费方（whiteboard/film.js、paper-lantern/mix.py、
    #        dataviz|swiss-motion/tools/words.py 等），删了它们当场读不到文件（真回归）。
    #     ② **不回传**（见下面 backFiles）—— 文件留在原地、mtime 不变，下游读到的是「诚实的旧文件」，
    #        而不是「被回传刷新了 mtime、伪装成新的旧文件」。这才是原来那个坑的真正解法。
    #     ③ 只有本 demo **真有消费方**时才告警，否则一行噪音都不制造。
    #   ⚠️ 探测用 shell 而不是 .venv/bin/python -c（后者要起解释器、写一大段 -c 更笨）。
    #      排除 /voices/ 是因为 words.json 自己就在那儿，不算消费方。
    WORDS_CONSUMERS=$(grep -rl "words\\.json" "$D" --include='*.js' --include='*.py' --include='*.mjs' --include='*.html' 2>/dev/null | grep -v "/voices/" | head -3)
    if [ -n "$WORDS_CONSUMERS" ]; then
      echo "STEP_WARN ASR 已跳过（该语言不在离线 ASR 可用范围内），voices/words.json **保持旧内容且未刷新** —— 下列文件会读到**旧的**词级时间轴，可能与本轮配音不同步："
      echo "$WORDS_CONSUMERS" | sed "s|^$D/||" | sed "s|^|STEP_WARN   · |"
    else
      echo "  ✓ ASR 已跳过（本 demo 无 words.json 消费方）"
    fi
    # ★ 机器可判的标记：编排器据此把 words.json 从回传 Windows 的清单里剔除（见下面 backFiles）。
    echo "ASR_SKIPPED"
  else
    echo "[配音 校对] ASR（失败不致命，只警告）"
    .venv/bin/python core/tts/asr_check.py "$ASR_LINES" "$D/voices" 2>&1 || echo "STEP_WARN asr_check 未通过（继续）"

    # ── 词级时间轴派生：words.py ────────────────────────────────────────────────
    # ★ 这是本文件修过的**第三个**「build.sh 有、旧编排器漏跑、且**影响成片内容**」的缺口
    #   （2026-10-07 逐条核实确证）：全库 43 个风格里**只有 dataviz / swiss-motion** 有 tools/words.py。
    #   它读 lines.json + voices/words.json（**asr_check.py 刚写的那一份**），按字符位置比例把
    #   whisper 的词起点映射到原文单词上，写 voices/words_rel.json —— 两个风格的页面 main.js
    #   直读它（dataviz main.js:11 / swiss-motion main.js:12），驱动字幕**逐词出现**。
    #   旧编排器不跑它 ⇒ 逐词时间轴停在旧内容上，而新配音照常出声、退出码 0（无法区分）。
    #   实测证据：WSL 侧 dataviz/voices/words_rel.json 停在 9/30 14:50，而 words.json 已是
    #   10/6 09:57 的新内容（swiss-motion 同：words_rel 9/30 vs words 10/5）—— 陈旧 5~6 天。
    # ★ 位置硬约束：必须**排在 asr_check.py 之后**（要读它刚写的 words.json），
    #   **VOICE_DONE / 回传之前**（words_rel.json 在下面的 backFiles 回传清单里）。
    # ★ 只在 ASR **真跑了**的这个分支里跑：跳过 ASR ⇒ words.json 是上一版内容的陈旧产物 ⇒
    #   由它派生的 words_rel.json 同样陈旧，与既有的「ASR 跳过不回传 words.json」原则一致
    #   （跳 ASR 时 words_rel.json 也一并从回传清单里剔除，见下面 backFiles）。
    # ★ 候选探测照本文件既有写法；不写死 slug —— 不存在就跳过、不出声。
    WORDS=""
    for c in "$D/tools/words.py"; do [ -f "$c" ] && { WORDS="$c"; break; }; done
    if [ -n "$WORDS" ]; then
      echo "[配音 词轴] $(basename "$WORDS")（由 words.json 派生 voices/words_rel.json，页面逐词高亮直读）"
      # 失败**不静默**：产物直接决定字幕逐词出现的时刻，悄悄跳过等于把「逐词时间轴与本次配音不同步」藏起来。
      .venv/bin/python "$WORDS" 2>&1 || { echo "STEP_FAIL $(basename "$WORDS")"; exit 1; }
    fi
  fi
else
  if [ -n "$TTSOWN" ]; then
    # 与 core/tts/tts.py 互斥：走到这里说明本 demo 没有 $D/lines.json，core TTS 本就不会跑。
    # gen.py 自己 chdir 到它所在目录、输出到 ../voices（即 $D/voices），所以从库根跑即可。
    echo "[配音] demo 自带 TTS $(basename "$TTSOWN")（不是 core/tts/tts.py；本 demo 无 $D/lines.json）"
    .venv/bin/python "$TTSOWN" 2>&1 || echo "STEP_WARN $(basename "$TTSOWN") 失败（配音仍缺失）"
    if [ -z "$(ls -A "$D/voices"/*.wav 2>/dev/null)" ]; then
      echo "STEP_WARN $D/voices/ 里仍没有 wav 产出"
    fi
  else
    echo "[配音] 该 demo 无 lines.json，跳过（paper-lantern / impasto 这类用自己那套 tts.py）"
  fi
fi
fi

# ── 配音前置阶段的出口 ──────────────────────────────────────────────────────
# LEMO_VOICE_ONLY=1：只跑「换内容 → lines.json → 配音 → ASR」就停，让编排器把
# voices/dur.json / words.json 回传 Windows 后再开始渲染。★ 这一步是**时序必需**，
# 不是优化：页面 fetch('voices/dur.json') 发生在渲染页初始化时，晚于它再回传就白搭。
if [ "$LEMO_VOICE_ONLY" = "1" ]; then
  echo "VOICE_DONE"
  exit 0
fi

# ── 等配乐（并行分支）收尾 ──────────────────────────────────────────────────
# 配乐已在上面「配乐」一节里**后台启动**（位置在「配音」一节之前）。混音脚本要读它的产物
# （score.wav / music.wav 等），所以必须在这里等它落盘 —— 位置与原来的串行版一致
# （配音 → 配乐 → 拟音 → 混音），只是「配音」与「配乐」两段现在重叠跑。
# ★ 失败语义**逐字不变**：配乐自己已经打了 STEP_FAIL，这里 wait 拿到非 0 就照样 exit 1
#   （不吞、不降级成警告，等价于原串行版那句「STEP_FAIL + exit 1」）。
if [ -n "$MUSIC_PID" ]; then
  if wait "$MUSIC_PID"; then
    echo "[配乐] 并行分支已收尾（与配音并行完成）"
  else
    echo "STEP_FAIL 配乐（并行分支，见上方 STEP_FAIL）"; exit 1
  fi
fi

# ── 拟音 ────────────────────────────────────────────────────────────────────
# 没有 foley 脚本时**完全静默**（43 个 demo 里只有 urban-sketch 有）；
# 失败只 STEP_WARN 不 fail —— 拟音未必是混音的硬依赖，各 demo 的 mix.py 读法不同。
if [ -n "$FOLEY" ]; then
  echo "[拟音] $(basename "$FOLEY")"
  .venv/bin/python "$FOLEY" 2>&1 || echo "STEP_WARN $(basename "$FOLEY") 失败（继续；若混音脚本需要它的产物，下一步会报出来）"
fi

# ── 混音 ────────────────────────────────────────────────────────────────────
if [ -z "$MIX" ]; then
  # 没有任何混音脚本。game-show / halftone-dossier / pictogram-motion 属于这一类：
  # 它们的音频是 music.wav + 一段 ffmpeg 直混，没有 mix.wav 这个概念。
  echo "STEP_FAIL 该 demo 没有 mix.py / sound.py / audio/mix.py —— 它用的是另一套音频架构"
  for f in "$D/build.sh" "$D/finish.sh" "$D/mux.sh" "$D/assemble.py" "$D/build.py"; do
    [ -f "$f" ] && echo "  ! 它自带 $(basename $f)，请直接跑那个脚本（本编排器不支持该 demo 的音频链）"
  done
  exit 1
fi
echo "[混音] $(basename "$MIX")"
MIXMARK=/tmp/lemo-mixmark-$$
touch "$MIXMARK"
.venv/bin/python "$MIX" 2>&1 || { echo "STEP_FAIL $(basename "$MIX")"; exit 1; }

# mix.wav 的落点因 demo 而异：demo/（默认）、demo/audio/（urban-sketch）、demo/out/（paper-lantern）。
# 优先取本次运行真的写出来的那个；都没有就看有没有已存在的（脚本只做增量、没重写的情况）。
MIXOUT=""
for c in "$D/mix.wav" "$D/audio/mix.wav" "$D/out/mix.wav"; do
  [ -s "$c" ] || continue
  if [ "$c" -nt "$MIXMARK" ]; then MIXOUT="$c"; break; fi
  [ -z "$MIXOUT" ] && MIXOUT="$c"
done
rm -f "$MIXMARK"
if [ -z "$MIXOUT" ]; then
  echo "STEP_FAIL 混音脚本跑完了，但 demo/、demo/audio/、demo/out/ 三处都没有 mix.wav"
  exit 1
fi
echo "MIX_OK $(stat -c%s "$MIXOUT") $MIXOUT"
`;

  let audioP = null;
  let audioMixPath = null;   // 音频脚本回报的 mix.wav 实际路径（--skip-audio 时为 null，混流脚本自己探测）
  const audioWarns = [];     // 音频链路的 STEP_WARN（下面统一报，不吞）

  // ── 出片前显存预检 + 自动腾挪（★ 必须在 TTS **之前**）────────────────────────
  // ★ 为什么在这里：本通路的 TTS 在 WSL 里跑（见 audioScriptFor 的配音段 → core/tts/tts_indextts.py），
  //   而显存判据 nvidia-smi 读的是 **Windows** 这张卡 ⇒ 守卫只能在 Windows 侧 JS 里调，
  //   不能塞进 WSL 的 bash 脚本（那里读不到这张卡）。位置在「音频链路」两个 phase 启动**之前**，
  //   所以覆盖配音（voice）与配音+配乐+混音（all）两条路径 —— 两者都以 TTS 打头。
  // ★ 语义与 dub.mjs 的 TTS 前守卫**完全一致**（照它做，别自创）：
  //   预检 → 不足才自动卸载常驻模型（走 LM Studio HTTP API，不是杀进程）→ 仍不足则明确失败。
  //   这里用默认 onShort:'require'（**硬拦**）：TTS 正是「显存不够就静默挂死一个多小时」的那一步
  //   （见 lib/vram.mjs 头部事故），绝不许它静默挂死。
  //   阈值沿用 INDEXTTS_MIN_FREE_MIB（与 core/tts/tts_indextts.py 的 VRAM_MIN_MIB 同名同默认值
  //   6700）⇒ 两侧口径天然一致；设 0 两边都关。LEMO_NO_VRAM_FREE=1 只查不腾（关自动卸载）。
  if (!o.skipAudio) {
    const vramRes = await ensureVramFree(Number(process.env.INDEXTTS_MIN_FREE_MIB ?? 6700),
      { label: 'TTS 合成', relaxEnv: 'INDEXTTS_MIN_FREE_MIB' });
    if (!vramRes.ok) fail(vramRes.message);
  }

  // ── 阶段 1/2：换内容时**必须先**把配音跑完，并把 voices/*.json 回传 Windows ────────
  // ★ 这一步必须落在 audioP / renderP **两个 Promise 建立之前**。
  //   旧写法把它放在 audioP 的 IIFE 里 —— 而两个 IIFE 是同时启动的，渲染并不会等它：
  //   实测日志里 TTS 的输出与渲染进度是**交错**的，渲染页仍旧 fetch 到旧的 dur.json。
  //   渲染页在初始化时读 voices/dur.json 排口播时间窗，晚了就白搭（偏差 0.2–1.6s），
  //   而且会让一致性校验门「拿同一份错时长自洽地假通过」—— 必须在这里串起来。
  let voicePhaseErr = null;
  if (!o.skipAudio && textMayChange) {
    step('音频链路 · 配音前置（WSL：重建 lines.json → 配音 → ASR → 回传 Windows）');
    const v = await runWsl(audioScriptFor('voice'), { name: '_lemo-voice', stream: true });
    if (v.code !== 0 || !/VOICE_DONE/.test(v.stdout)) {
      const sf = /STEP_FAIL (.+)/.exec(v.stdout);
      diagnoseMissingAssets(demoRel, `${v.stdout || ''}\n${v.stderr || ''}`);
      voicePhaseErr = `配音前置阶段失败：${sf ? sf[1].trim() : '没有跑到 VOICE_DONE'}（退出码 ${v.code}）`;
    } else {
      audioWarns.push(...[...v.stdout.matchAll(/STEP_WARN (.+)/g)].map(x => x[1].trim()));
      // voices/*.json + lines.json 回传 Windows（页面读的就是这一份）
      // ★ 跳过 ASR 时**不回传** words.json（2026-10-02 修）。words.json 在配音阶段唯一的写者是
      //   asr_check.py（见 core/tts/asr_check.py:116），跳过 ASR ⇒ 没重算 ⇒ 那份是上一版内容的
      //   陈旧产物。旧实现照样把它拷回 Windows：mtime 被刷新、看起来像刚生成，而页面拿到的是
      //   **旧词级时间**（实测 engraving 的 words.json 至今还是旧英文内容的 5 条 title,d1-d3,close）。
      //   ★ 音频脚本跳 ASR 时**只不回传、绝不删除**（全库有 17 处消费方，如 whiteboard/film.js、
      //     paper-lantern/mix.py；删了它们当场读不到文件）。文件留在原地、mtime 不变，下游读到的是
      //     「诚实的旧文件」，而不是被回传刷新了 mtime、伪装成新的旧文件 —— 这才是原坑的真正解法。
      //   判定依据是音频脚本跳 ASR 时打的 ASR_SKIPPED 标记（比匹配中文日志稳）。
      const asrSkipped = /ASR_SKIPPED/.test(v.stdout || '');
      // ★ words_rel.json 与 words.json **同源**（都是那一次 ASR 的派生物：words.json 是转写本身，
      //   words_rel.json 是它按原文单词比例重映射的结果，由 tools/words.py 写）。跳 ASR ⇒ 两者
      //   都是上一版内容的陈旧产物 ⇒ **一并**不回传（同样的理由：不回传就不会刷新 mtime，
      //   下游读到的是「诚实的旧文件」而不是「伪装成新的旧文件」）。
      const backFiles = ['dur.json', 'lips.json'];
      if (!asrSkipped) backFiles.splice(1, 0, 'words.json', 'words_rel.json');
      if (asrSkipped) info(C.dim('跳过 ASR → 不回传 words.json / words_rel.json（文件保留原地、mtime 不变，避免「伪装成新的旧文件」）'));
      const back = await runWsl(
        [`mkdir -p '${demoWinWsl}/voices'`]
          .concat(backFiles.map(f =>
            `[ -f '${demoWsl}/voices/${f}' ] && cp -f '${demoWsl}/voices/${f}' '${demoWinWsl}/voices/${f}' && echo "  ✓ voices/${f} → Windows"`))
          .concat([`[ -f '${demoWsl}/lines.json' ] && cp -f '${demoWsl}/lines.json' '${demoWinWsl}/lines.json' && echo "  ✓ lines.json → Windows"`])
          .join('\n'),
        { name: '_lemo-voices-back' });
      const done = (back.stdout || '').split('\n').filter(l => l.includes('✓'));
      if (done.length) info(C.dim(done.join('\n')));
      else warn('配音前置阶段没有回传到任何 voices/*.json —— 渲染会按旧时长排口播窗');

      // ★ dur.json 此时已是 Index-TTS 的**真实**时长 ⇒ 必须把 events/subs 的时间窗按它重排。
      //   少了这一步，字幕仍按上一轮文案的时长排（实测拖后 0.5~0.9 秒），
      //   而且一致性校验门会「拿同一份错时长自洽地假通过」。
      info(C.dim('dur.json 已是配音真实时长 → 重排事件与字幕时间窗'));
      await exportEventsAndSubs();
    }
  }

  if (!o.skipAudio) {
    step(`音频链路（WSL：${textMayChange ? '配乐 → 混音' : '配音 → 声线 → ASR → 配乐 → 混音'}）`);
    audioP = (async () => {
      if (voicePhaseErr) return { ok: false, msg: voicePhaseErr };
      // ★ stream: true —— 音频链路的输出边跑边透传（全流程唯一一条「又长又安静」的 WSL 路径）。
      //   旧写法是 `await runWsl(...)` 拿到整块 r.stdout 再一次性写出来 ⇒ 配音/声线/ASR/配乐/混音
      //   的全部输出要等音频跑完（实测 352 秒）才一起冒出来，进度条看着像死了。
      //   ⚠️ 改成流式后**不能**再在下面把 r.stdout / r.stderr 整体写一遍 —— 那会重复打印一份。
      //   r.stdout / r.stderr 仍照常返回（下面要用 MIX_OK / STEP_FAIL / STEP_WARN 正则匹配）。
      const r = await runWsl(audioScriptFor(textMayChange ? 'rest' : 'all'), { name: '_lemo-audio', stream: true });
      const m = /MIX_OK (\d+) (\S+)/.exec(r.stdout);
      if (r.code !== 0 || !m) {
        // 报清楚是哪一步失败的，而不是笼统的「exit N」——
        // 原来报「音频链路失败（exit 0）」是因为退出码确实为 0（失败判据是没匹配到 MIX_OK），
        // 而且 TTS / ASR / 配乐 / 混音四种失败长得一模一样，使用者无从下手。
        const sf = /STEP_FAIL (.+)/.exec(r.stdout);
        const why = sf ? sf[1].trim() : (m ? '未知原因' : '没有产出 mix.wav');
        // 失败后翻译：LibsndfileError / FileNotFoundError 这类底层报错多半是「素材不在仓库里」，
        // 补一段人话（见 diagnoseMissingAssets 的说明）。只 warn，不改变退出码。
        diagnoseMissingAssets(demoRel, `${r.stdout || ''}\n${r.stderr || ''}`);
        return { ok: false, msg: `音频链路失败：${why}（退出码 ${r.code}）` };
      }
      audioWarns.push(...[...r.stdout.matchAll(/STEP_WARN (.+)/g)].map(x => x[1].trim()));
      audioMixPath = m[2];
      return { ok: true, msg: `mix.wav ${(Number(m[1]) / 1048576).toFixed(1)} MB  ${m[2]}`, warns: audioWarns };
    })();
  } else {
    step('音频链路'); info(C.dim('（--skip-audio）'));
  }

  let renderP = null;
  if (!o.skipRender) {
    step(`渲染（Windows GPU · ${o.fps}fps · ${o.workers} workers）`);
    fs.mkdirSync(path.join(demoWin, 'out'), { recursive: true });
    renderP = (async () => {
      const env = {
        ...process.env,
        PATH: `${ffDir};${process.env.PATH || ''}`,
        LEMO_GPU: '1',
        LEMO_VENC: 'h264_nvenc',
      };
      // 事件与字幕已在并行段之前导出并回传 WSL（见第 2 步），这里只负责渲染。
      // ⚠️ 这里**只**传 --q（渲染侧），不要再传给 events.mjs 同一份 —— 那正是本文件修过的缺陷：
      //    noev=1 会把事件表清空，配乐随即 IndexError（实测 exit 1）。
      // 命令在 main 开头就构造好了（--dry-run 也要能核），这里直接用同一份。
      info(C.dim(`$ node ${renderVArgs.join(' ')}`));
      const r = await runLive(process.execPath, renderVArgs, { cwd: CFG.winLib, env });
      if (r.code !== 0) return { ok: false, msg: `渲染失败（exit ${r.code}）` };
      const v = path.join(demoWin, 'out', 'video_gpu.mp4');
      if (!fs.existsSync(v)) return { ok: false, msg: '渲染退出码为 0 但没有产出文件' };
      return { ok: true, msg: `video_gpu.mp4 ${(fs.statSync(v).size / 1048576).toFixed(1)} MB` };
    })();
  } else {
    step('渲染'); info(C.dim('（--skip-render）'));
  }

  const rs = await Promise.all([audioP, renderP].filter(Boolean));
  for (const r of rs) { if (r) r.ok ? ok(r.msg) : fail(r.msg); }
  if (rs.length === 2) info(C.dim(`（音频与渲染并行完成）  ${el()}`));

  if (o.audioOnly || o.renderOnly) {
    console.log(C.ok(`\n完成（部分模式）  ${el()}`));
    return;
  }

  // ── 4. 混流（WSL，硬件编码）─────────────────────────────
  // 注意：产物落在 WSL 内部文件系统（不是 /mnt/d），Windows 侧读不到，
  //       所以让 WSL 脚本自己把成片与字幕拷到 /mnt/d，编排器不跨文件系统拷。
  step(`混流（WSL mux.sh · ${o.venc}）`);
  const exportWsl = outDir.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
  const runStart = Math.floor(t0 / 1000);
  const crfLine = intent.crf ? `export CRF=${intent.crf}` : '# （build.sh 里没写 CRF，不导出该变量）';
  // ⚠️ 关键：渲染产物落在 **Windows** 文件系统（D:\lemo-opuscar\...\out\video_gpu.mp4），
  //    而混流在 WSL 里跑。这两棵树是**独立文件系统**，中间没有任何同步步骤会传渲染产物
  //    （push 只传字体/素材，pull 只传 core/render/video.mjs）。
  //    所以必须让 WSL 侧**直接读 /mnt/d 上那一份**，绝不能读 WSL 库里的同名文件 ——
  //    后者可能是一份陈旧历史产物，会导致「拿旧视频混流却报成功」这种静默错误。
  //    另加两道断言：① 产物必须是本次运行写出的（新鲜度）；② 成片帧数必须等于渲染帧数。
  const muxScript = `
set -u
export PATH=/usr/local/bin:$PATH
export LEMO_VENC=${o.venc === 'nvenc' ? 'h264_nvenc' : 'libx264'}
LIB=${CFG.wslLib}
D=${demoWsl}
S=${CFG.wslLib}/styles/${o.slug}
OUT=${exportWsl}
VID=/mnt/d/lemo-opuscar/styles/${o.slug}/demo/out/video_gpu.mp4
RUN_START=${runStart}
SKIP_RENDER=${o.skipRender ? 1 : 0}
MIXWAV='${audioMixPath || ''}'
GRAIN='${grain === null ? '' : grain}'
${crfLine}
cd "$LIB" || exit 1
# 属主防御：见音频脚本里的同类说明（刻意不写成 || true，失败要出声）
for t in "$D/out" "$S" "$OUT"; do
  [ -e "$t" ] || continue
  sudo chown -R lemo:lemo "$t" 2>/dev/null || echo "  ! 警告：chown -R lemo:lemo $t 失败"
done

[ -f "$VID" ] || { echo "MUX_FAIL 缺渲染产物：$VID"; exit 1; }

# mix.wav：优先用音频脚本回报的那个路径（它的落点因 demo 而异）；--skip-audio 时自己三处探测。
if [ -z "$MIXWAV" ]; then
  for c in "$D/mix.wav" "$D/audio/mix.wav" "$D/out/mix.wav"; do
    [ -s "$c" ] && { MIXWAV="$c"; break; }
  done
fi
if [ -z "$MIXWAV" ] || [ ! -f "$MIXWAV" ]; then
  echo "MUX_FAIL 找不到 mix.wav（demo/、demo/audio/、demo/out/ 都没有）"
  exit 1
fi

# 字幕：两条路，**优先 demo 自带的 srt 生成器**（直接写 .srt，不经 core/render/srt.py）。
# 全仓有 4 个 demo 是这种写法（tools/srt.py: cel-anime-80s / hd-2d；make_srt.py: game-show；
# subs_export.py: stained-glass）—— 它们的字幕源不是 subs.json/cues.json，而是 story.js + voices/dur.json
# 或 events.json，所以走不了下面那条通用路。它们都读 WSL 侧的数据，必须排在音频与事件导出之后
# （本步天然满足），且都写 $S/<slug>.srt —— 与 core/render/srt.py 同一落点。
# 刻意**不收**的：make_srt.mjs(paper-popup) / srt.cjs(pictogram-motion) / srt.mjs(scifi-toon) ——
# 它们是 Node 脚本，而编排器的平台分工是「Node 一律 Windows」；其中 srt.mjs 还要开页面。
# 这三个 demo 当前分别因缺素材、音频链不被支持、demo 自身 bug 而跑不通，收益为零、风险非零。
SRT_OWN=""; SRT_OWN_OK=0
for c in "$D/tools/srt.py" "$D/make_srt.py" "$D/subs_export.py"; do
  [ -f "$c" ] && { SRT_OWN="$c"; break; }
done
if [ -n "$SRT_OWN" ]; then
  echo "  字幕生成器（demo 自带）$SRT_OWN"
  # 注意：这里刻意不把 python 的输出直接管道进 tail 再交给 if —— 没有 pipefail 时管道的
  # 退出码是 tail 的（恒为 0），失败会被当成成功、并报出「已重新生成」的假消息。先落盘再判。
  SRT_OWN_LOG=$(mktemp /tmp/lemo-srt-own-XXXXXX)
  if .venv/bin/python "$SRT_OWN" > "$SRT_OWN_LOG" 2>&1; then
    tail -2 "$SRT_OWN_LOG"
    SRT_OWN_OK=1
    echo "  字幕已由 $(basename "$SRT_OWN") 直接重新生成：$S/${o.slug}.srt"
  else
    echo "  ! 警告：$(basename "$SRT_OWN") 失败（不影响成片产出，.srt 沿用旧文件）"
    tail -3 "$SRT_OWN_LOG"
  fi
  rm -f "$SRT_OWN_LOG"
fi

# 通用路（demo 没有自带 srt 生成器时）：从本次新写出的字幕源经 core/render/srt.py 生成。
# 各 demo 把字幕源写成 subs.json / srt.json / cues.json 的都有（位置也不一样），取候选里最新的。
# 但**只认本次运行写出来的**（mtime 晚于 RUN_START）：仓库里已提交的旧 cues.json 也在这个候选里，
# 拿它重新生成 .srt 会把「字幕源根本没更新」伪装成「字幕已重新生成」。一个新鲜源都没有时**显式警告**。
if [ "$SRT_OWN_OK" != "1" ]; then
  SRT_IN=""; SRT_NEW=0
  for c in "$D/out/subs.json" "$D/out/srt.json" "$D/out/cues.json" "$D/subs.json" "$D/cues.json"; do
    [ -f "$c" ] || continue
    m=$(stat -c %Y "$c" 2>/dev/null || echo 0)
    if [ "$m" -gt "$RUN_START" ] && [ "$m" -gt "$SRT_NEW" ]; then SRT_NEW=$m; SRT_IN=$c; fi
  done
  if [ -n "$SRT_IN" ]; then
    if .venv/bin/python core/render/srt.py "$SRT_IN" "$S/${o.slug}.srt" 2>&1 | tail -2; then
      echo "  字幕已从 $(basename "$SRT_IN") 重新生成：$S/${o.slug}.srt"
    else
      echo "  ! 警告：字幕生成失败（不影响成片产出）"
    fi
  else
    echo "  ! 警告：本 demo 没有本次新生成的字幕源（第 3 步编排器未产出、demo 自带 srt 生成器本次也没产出）—— .srt 沿用仓库里已提交的旧文件，未重新生成"
  fi
fi

if [ "$SKIP_RENDER" != "1" ]; then
  VID_MTIME=$(stat -c %Y "$VID" 2>/dev/null || echo 0)
  if [ "$VID_MTIME" -lt "$RUN_START" ]; then
    echo "MUX_FAIL 渲染产物是陈旧的（mtime=$VID_MTIME 早于本次开始=$RUN_START），拒绝用它混流"
    exit 1
  fi
fi

# 混流脚本：demo 自带的优先，否则 core/render/mux.sh。12 个 demo 自带的 mux.sh 与 core 版全部不同
# （9 种变体：各自的 CRF / 颗粒 / 二次压缩），一律用 core 版会让成片与它自己的 build.sh 不符。
# 只接受签名是 V A O [fps] [grain] 的那一类：paper-popup / pictogram-motion / watercolor 的根目录
# mux.sh 是「自己拼段 + 混音」的另一套接口（只吃一个输出路径，两个还是 zsh），照 core 版调用会传错。
MUX=core/render/mux.sh
for c in "$D/tools/mux.sh" "$D/mux.sh"; do
  [ -f "$c" ] || continue
  if grep -qF 'A="$2"' "$c" 2>/dev/null; then MUX="$c"; break; fi
  echo "  ! 该 demo 自带 $c，但接口不是 V A O [fps] [grain]，回退 core/render/mux.sh"
done
echo "  混流脚本 $MUX"

# 注意：ffprobe 的 -of csv=p=0 在本机输出会带一个尾逗号（实测输出形如 1435+逗号），
# 直接做字符串比较会把两者判成不等而误报。所以一律只取数字。
num() { tr -dc '0-9' | head -c 12; }
# 帧数：**优先读容器元数据 nb_frames**（实测 0.04s；43 个成片 + 全部渲染源都带该元数据，
# 且与 -count_frames 真扫帧逐帧相等）。读不到 / 为 0 / 非数字时**回落全片扫帧**
# （-count_frames：122s 片源侧 10.2s、成片侧 7.1~7.8s —— 这两次扫描原先每片白花 ≈17~18s）。
# 兜底不能省：回落也拿不到数字时返回空串，下面「帧数读不出来」那道闸照样 MUX_FAIL，绝不静默放过。
frames() {
  f=$(ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames -of csv=p=0 "$1" 2>/dev/null | num)
  [ -n "$f" ] && [ "$f" != "0" ] || f=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$1" 2>/dev/null | num)
  printf '%s' "$f"
}
SRC_FRAMES=$(frames "$VID")
sh "$MUX" "$VID" "$MIXWAV" "$S/${o.slug}.mp4" ${o.fps} $GRAIN
RC=$?
if [ $RC -ne 0 ] || [ ! -s "$S/${o.slug}.mp4" ]; then echo "MUX_FAIL exit=$RC"; exit 1; fi

OUT_FRAMES=$(frames "$S/${o.slug}.mp4")
if [ -n "$SRC_FRAMES" ] && [ -n "$OUT_FRAMES" ] && [ "$SRC_FRAMES" != "$OUT_FRAMES" ]; then
  echo "MUX_FAIL 帧数不符：渲染 $SRC_FRAMES 帧，成片 $OUT_FRAMES 帧"
  exit 1
fi
if [ -z "$SRC_FRAMES" ] || [ -z "$OUT_FRAMES" ]; then
  echo "MUX_FAIL 帧数读不出来（渲染='$SRC_FRAMES' 成片='$OUT_FRAMES'），无法确认成片完整"
  exit 1
fi

mkdir -p "$OUT" || exit 1
cp -f "$S/${o.slug}.mp4" "$OUT/${o.slug}.mp4" || exit 1
[ -f "$S/${o.slug}.srt" ] && cp -f "$S/${o.slug}.srt" "$OUT/${o.slug}.srt"
echo "MUX_OK $(stat -c%s "$OUT/${o.slug}.mp4") src_frames=$SRC_FRAMES out_frames=$OUT_FRAMES"
`;
  const mr = await runWsl(muxScript, { name: '_lemo-mux' });
  if (mr.stdout) process.stdout.write(mr.stdout);
  if (mr.stderr) process.stderr.write(C.dim(mr.stderr));
  const mm = /MUX_OK (\d+)/.exec(mr.stdout);
  if (!mm) fail('混流失败（见上方输出）');
  ok(`成片 ${(Number(mm[1]) / 1048576).toFixed(1)} MB  ${el()}`);
  // mux.sh 会在响度/真峰值未达标时向 stderr 打警告。原来这里只把它 dim 掉就报「✓ 成片」，
  // 等于把「没达标」静默放过（实测 ascii-crt 真峰值 −0.6 dBFS，目标 ≤ −1.2 dBTP）。
  const loudWarn = /missed the target[^\n]*/.exec(mr.stderr || '');
  if (loudWarn) {
    warn(`成片已产出，但 ${loudWarn[0].replace(/^mux\.sh:\s*warning:\s*/, '')}`);
    warn('  这通常来自 mix.wav 本身峰值偏高，不是 mux.sh 的问题；不影响播放，但未达 −1.2 dBTP 目标。');
  }

  // ── 5. 核验导出结果（文件已由 WSL 侧直接写到输出目录）─────
  step('核验导出');
  const dst = path.join(outDir, `${o.slug}.mp4`);
  if (!fs.existsSync(dst)) fail(`成片没有落到输出目录：${dst}`);
  const st = fs.statSync(dst);
  ok(dst);
  const srtDst = path.join(outDir, `${o.slug}.srt`);
  if (fs.existsSync(srtDst)) ok(srtDst);

  console.log(C.ok(`\n全部完成 · ${(st.size / 1048576).toFixed(1)} MB · 总耗时 ${el()}`));
}

main().catch(e => fail(e?.stack || String(e)));
