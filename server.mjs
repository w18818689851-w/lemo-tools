#!/usr/bin/env node
/**
 * server.mjs —— lemo-tools 本地 Web 控制台（零依赖，原生 node:http）
 *
 * 定位：**纯包装**。它不改 lemo-make.mjs，只是把 `node lemo-make.mjs <slug> [opts]` 包成一个
 * HTTP 接口 + 单页 UI。控制台不启动时，CLI 用法一切照常；控制台崩了也不影响已在跑的任务
 * （任务跑在独立子进程里，本进程只读它的输出）。
 *
 * 用法：
 *   node server.mjs [--port 7788] [--host 127.0.0.1]
 *   环境变量：LEMO_CONSOLE_PORT / LEMO_CONSOLE_HOST
 *
 * 安全：默认只监听 127.0.0.1（本机）。**不要改成 0.0.0.0** —— 这个接口能起子进程、能读本地文件。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkEnv, CFG } from './lib/env.mjs';
import * as jobs from './lib/jobs.mjs';
import * as store from './lib/store.mjs';
import * as briefs from './lib/briefs.mjs';
import * as langs from './lib/langs.mjs';
import * as sizes from './lib/sizes.mjs';
import * as aspects from './lib/aspects.mjs';
import * as voices from './lib/voices.mjs';
import * as dub from './lib/dub.mjs';
// ★ 只借「探素材尺寸」这一件底层件（probe/winToWsl，WSL 侧 ffprobe）——
//   给 GET /api/dub/source-meta 用，见 apiDubSourceMeta 的说明。不引入任何 GPU 相关能力。
import { probe, winToWsl } from './lib/dub-core.mjs';
import { readStyleIndex, renderMarkdown } from './lib/styles.mjs';
import { resolveStylesRoot } from './lib/styles-root.mjs';   // ★ 风格源码根唯一来源（认 LEMO_STYLES_ROOT）；不设时 === path.join(CFG.winLib,'styles')，逐字节相同
import { scanPort, MAX_SCAN } from './lib/portscan.mjs';
import {
  planActions, serializeAction, knownActionIds, actionSatisfied, simulateEnv, FIXTURES,
} from './lib/setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(__dirname, 'web');

// ── 端口固定入口（解决「重启后 URL 失效」）────────────────────
//
// Windows 的保留端口段（Hyper-V/WSL 每次开机随机圈走若干段，实测本机 7699-7798 /
// 7899-8698 / …）**每次重启都会变**，所以控制台可能今天在 7799、明天在 7812。
// 用户收藏的 URL 于是隔天就失效。
//
// 对策：监听成功后把**实际端口**写到两个固定文件 —— 名字固定，内容随实际端口变：
//   .console-port     一行端口号（给脚本读，如 start-console.bat）
//   打开控制台.url      Windows 快捷方式，双击即进（给用户用）
// ★ 退出时**不删**这两个文件：删了下次又得靠人猜端口，等于没解决。下次启动覆盖即可。
//
// ★ LEMO_CONSOLE_NO_ENTRY_FILES=1 → **跳过**写上面这两个文件（见 writeEntryFiles）。
//   为什么测试实例必须设它：test/*.mjs 用**随机端口**自己起 server.mjs；若不跳过，每跑一次测试就把
//   用户的 .console-port / 打开控制台.url 改成测试端口。更糟的是「跑前备份、跑后还原」那套很脆：
//   一旦某次跑崩 / 被 kill（还原语句没执行），脏值就留在文件里，后续跑还把脏值当基线一路「正确还原」——
//   实测这两个文件一度被改成落在 Windows 保留段（7699-7798）、本机根本绑不上的端口，用户的快捷方式
//   直接指向死端口。所以根因是「测试实例本就不该写用户入口文件」—— 起服务的测试一律设 =1。
const PORT_FILE = path.join(__dirname, '.console-port');
const URL_FILE = path.join(__dirname, '打开控制台.url');

// ── 参数 ────────────────────────────────────────────────────
function parseArgv(argv) {
  const o = {
    port: Number(process.env.LEMO_CONSOLE_PORT) || 7788,
    host: process.env.LEMO_CONSOLE_HOST || '127.0.0.1',
    simulateEnv: process.env.LEMO_CONSOLE_SIMULATE_ENV || null,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') { o.port = Number(argv[++i]); }
    else if (argv[i] === '--host') { o.host = argv[++i]; }
    // ★ --open：启动成功后自动开浏览器。**必须由服务自己开**，不能由批处理猜 ——
    //   因为端口可能因 Windows 保留段被自动后扫改掉，批处理拿不到实际端口。
    else if (argv[i] === '--open') { o.open = true; }
    // ★ --simulate-env=<场景>：**演练模式**。让 /api/env 返回一份合成的「干净机器」检测结果，
    //   好把首次运行引导 / 安装按钮在**这台已就绪的机器上**显示出来（否则永远看不到）。
    //   场景见 lib/setup.mjs 的 FIXTURES：clean / bare / partial / ready。
    else if (argv[i].startsWith('--simulate-env=')) { o.simulateEnv = argv[i].slice('--simulate-env='.length); }
    else if (argv[i] === '--help' || argv[i] === '-h') { o.help = true; }
  }
  if (!Number.isInteger(o.port) || o.port < 1 || o.port > 65535) {
    console.error(`✗ 端口非法：${o.port}（需 1–65535）`);
    process.exit(2);
  }
  if (o.simulateEnv && !FIXTURES[o.simulateEnv]) {
    console.error(`✗ 未知演练场景 ${o.simulateEnv}；可选：${Object.keys(FIXTURES).join(' / ')}`);
    process.exit(2);
  }
  return o;
}
const ARGV = parseArgv(process.argv.slice(2));
if (ARGV.help) {
  console.log('用法：node server.mjs [--port 7788] [--host 127.0.0.1] [--open] [--simulate-env=clean|bare|partial|ready]');
  console.log('  --open   启动成功后自动打开浏览器（用**实际**监听端口，含自动后扫后的端口）');
  console.log('  --simulate-env=<场景>  演练模式：/api/env 返回合成的「干净机器」检测结果，');
  console.log('                         用来在本机预览首次运行引导（不会真的安装任何东西）');
  process.exit(0);
}

// ── HTTP 小工具 ─────────────────────────────────────────────
function sendJson(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 1 << 20) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on('data', (d) => {
      n += d.length;
      if (n > limit) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(d);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.srt': 'text/plain; charset=utf-8',
};

// ── 静态文件（只服务 web/ 目录，防目录穿越）───────────────
function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const full = path.resolve(WEB_DIR, rel);
  if (full !== WEB_DIR && !full.startsWith(WEB_DIR + path.sep)) {
    return sendJson(res, 403, { error: '路径越界' });
  }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return sendJson(res, 404, { error: '文件不存在' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(full).pipe(res);
  });
}

// ── API: POST /api/run ──────────────────────────────────────
/**
 * POST /api/run —— 入队一个出片任务（异步）。
 *
 * ★ 形状校验只做在这里：slug 必须匹配 [A-Za-z0-9._-]，opts 交给 lib/briefs.mjs:validateOpts
 *   （与 /api/briefs/:id/run 共用同一处判据，免得两处漂移）。
 * ★ 批次字段（batchId/batchIndex/batchTotal）只做形状校验，不改队列语义 —— 队列仍是串行的。
 */
async function apiRun(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const slug = body.slug;
  if (typeof slug !== 'string' || !slug.trim()) return sendJson(res, 400, { error: '缺少 slug' });
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return sendJson(res, 400, { error: `slug 含非法字符：${slug}` });

  const opts = Array.isArray(body.opts) ? body.opts : [];
  // ★ 选项校验的判据只有一处：lib/briefs.mjs:validateOpts（/api/briefs/:id/run 也调它，免得两处漂移）。
  //   不用 shell（spawn 数组传参），但仍限制形状，避免 UI 传进奇怪的东西。
  const optCheck = briefs.validateOpts(opts, 'opts');
  if (!optCheck.ok) return sendJson(res, 400, { error: optCheck.error });

  // ── 批次（第四批 ① 批量入队）────────────────────────────────
  // ★ 服务端**只做形状校验**，不重新推导「哪些该入队」—— 那是 UI 的事（用户在确认弹层里
  //   可能选择「跳过被锁的」）。这里保证落盘/回显的 batchId 不会带奇怪字符。
  // ★ 批次不是队列语义：队列仍是**串行**的，一批就是连着入队 N 条。
  const meta = {};
  if (body.batchId !== undefined && body.batchId !== null && body.batchId !== '') {
    if (typeof body.batchId !== 'string' || !/^[A-Za-z0-9._-]{1,40}$/.test(body.batchId)) {
      return sendJson(res, 400, { error: 'batchId 非法（只允许 A-Za-z0-9._- ，≤40 字符）' });
    }
    meta.batchId = body.batchId;
    const idx = Number(body.batchIndex);
    const tot = Number(body.batchTotal);
    if (!Number.isInteger(idx) || idx < 1 || idx > 1000) return sendJson(res, 400, { error: 'batchIndex 非法' });
    if (!Number.isInteger(tot) || tot < 1 || tot > 1000 || idx > tot) return sendJson(res, 400, { error: 'batchTotal 非法' });
    meta.batchIndex = idx;
    meta.batchTotal = tot;
  }

  const job = jobs.enqueue(slug, opts, meta);
  sendJson(res, 200, { ok: true, job: jobs.getSummary(job.id) });
}

// ── API: GET /api/eta ───────────────────────────────────────
//
// 批量入队的确认弹层要「将按顺序跑 N 个，预计总耗时 ~X 分钟」，所以需要**一次问一批** slug 的
// 估计值（逐个问会打出 N 个请求，且弹层打开会明显卡）。
//
// ★ 判据只有一处：估时逻辑全在 lib/jobs.mjs:etaFor（纯读历史，不写任何东西）。
//   这个接口只是把它暴露出来，不做任何自己的推算。
// ★ 无历史 → confidence:'none'，前端据此**不显示**（宁可不说，也不编）。
/**
 * GET /api/eta —— 一次问一批 slug 的耗时估计（给批量入队确认弹层用）。
 *
 * ★ 估时逻辑只有一处（lib/jobs.mjs:etaFor，纯读历史）；本接口只暴露它，不自己推算。
 * ★ 一次最多 50 个 slug，逐个正则校验非法字符；`opt` 的形状校验复用 lib/briefs.mjs:validateOpts
 *   （与 /api/run 同一处判据，免得两份正则漂移）。
 */
function apiEta(req, res, url) {
  const slugs = url.searchParams.getAll('slug');
  const opts = url.searchParams.getAll('opt');
  if (!slugs.length) return sendJson(res, 400, { error: '缺少 slug' });
  if (slugs.length > 50) return sendJson(res, 400, { error: `一次最多问 50 个 slug（收到 ${slugs.length} 个）` });
  for (const s of slugs) if (!/^[A-Za-z0-9._-]+$/.test(s)) return sendJson(res, 400, { error: `slug 含非法字符：${s}` });
  // ★ 选项形状**复用 /api/run 的同一处判据**（lib/briefs.mjs:validateOpts）。原先这里自己抄了一份
  //   `/^[A-Za-z0-9._\-=/]+$/` —— 于是 `--ratio 9:16`（值含 `:`）会被 /api/run 与 /api/eta 用
  //   **两份本应相同、实际不同**的判据各拒一次（同一个 `:` 缺失，漂移成两处）。
  const optCheck = briefs.validateOpts(opts, 'opt');
  if (!optCheck.ok) return sendJson(res, 400, { error: optCheck.error });

  const items = slugs.map((slug) => ({ slug, ...jobs.etaFor(slug, opts) }));
  sendJson(res, 200, { opts, phaseKey: jobs.phaseKey(opts), count: items.length, items });
}

// ── API: GET /api/logs/:id  (SSE，支持 Last-Event-ID 断线续传) ──
//
// ★ 断线续传：每条日志行带 `id: <n>`（n 是该任务内**单调递增**的行号，跨重启稳定）。
//   客户端重连时浏览器会自动带上 `Last-Event-ID` 头；也支持 `?lastEventId=` 显式指定
//   （便于脚本/测试，以及「手动重新打开同一个任务」时接着看）。
//   - 不带 → **全量重放**（与本批之前的行为一致，不算破坏性改动）。
//   - 带了 → 只补发 n > lastEventId 的行；中间若已被裁剪，先发一条 `gap` 事件。
//   ⚠️ 任务跑 7 分钟时日志可能上万行，全量重放会让重连明显卡顿 —— 这就是要续传的原因。
/**
 * GET /api/logs/:id —— 任务日志的 SSE 长连接（支持 Last-Event-ID 断线续传）。
 *
 * ★ 续传位置取 `Last-Event-ID` 头，也接受 `?lastEventId=` 显式指定（便于脚本/测试）。
 * ★ 每 15s 发一条 `: ping` 保活；请求关闭时退订并清掉定时器。
 */
function apiLogs(req, res, id, url) {
  const job = jobs.getJob(id);
  if (!job) return sendJson(res, 404, { error: '任务不存在' });

  const rawHeader = req.headers['last-event-id'];
  const rawQuery = url ? url.searchParams.get('lastEventId') : null;
  const lastEventId = Math.max(0, Math.floor(Number(rawHeader ?? rawQuery) || 0));

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': lemo-console stream\n\n');
  res.write(`event: hello\ndata: ${JSON.stringify({
    id, status: jobs.getSummary(id).status, resumeFrom: lastEventId,
    resumed: lastEventId > 0, lines: jobs.getSummary(id).lines,
  })}\n\n`);

  const send = (ev) => {
    if (res.writableEnded) return;
    // `id:` 让浏览器记住进度，重连时自动带 Last-Event-ID；数字里不可能有换行，安全。
    if (Number.isFinite(ev.n) && ev.n > 0) res.write(`id: ${ev.n}\n`);
    // JSON 编码 → 日志里的换行/引号/中文都不会破坏 SSE 帧格式
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };

  const unsub = jobs.subscribe(id, send, { from: lastEventId });
  const ping = setInterval(() => {
    if (!res.writableEnded) { try { res.write(': ping\n\n'); } catch { /* ignore */ } }
  }, 15000);
  ping.unref?.();

  const cleanup = () => { clearInterval(ping); if (unsub) unsub(); };
  req.on('close', cleanup);
  res.on('close', cleanup);
}

// ── API: GET /api/precheck?slug=xxx（启动前并发预检）────────
//
// ★ 为什么要有它：命令行已经在跑同一个 demo 时，编排器会 fail（它的并发锁），
//   但用户**只看到一条错误日志**，分不清是「已经有人在跑」还是「别的问题」。
//   这里在**启动前**就把话说清楚。
// ★ 判据与编排器逐字对齐（见 lib/jobs.mjs:checkLock）：只有「pid 活着 且 锁龄 < 6h」才报冲突；
//   陈旧锁（pid 已死）编排器会自己接管，这里**不误报**。
// ★ 只是**提示**，不是硬拦截 —— /api/run 不会因此拒绝（用户可能确实想跑，比如他已经确认另一个进程是僵尸）。
// ★ 绝不删锁。
/**
 * GET /api/precheck —— 启动前的并发预检：提示是否已有同一个 demo 在跑。
 *
 * ★ 返回锁状态 + 队列里同 slug 的任务 + 一句给 UI 直接显示的人话（UI 不重新拼判据）。
 */
function apiPrecheck(req, res, url) {
  const slug = (url.searchParams.get('slug') || '').trim();
  if (!slug) return sendJson(res, 400, { error: '缺少 slug' });
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return sendJson(res, 400, { error: `slug 含非法字符：${slug}` });

  const lk = jobs.checkLock(slug);
  const q = jobs.queueState();
  const queuedSame = [q.running, ...q.waiting]
    .filter((j) => j && j.slug === slug)
    .map((j) => ({ id: j.id, status: j.status }));

  sendJson(res, 200, {
    slug,
    ...lk,
    queuedSame,
    // 给 UI 直接显示的人话（UI 不重新拼判据 —— 判据只有一处）
    message: lk.locked
      ? `已有另一个 lemo-make 在跑同一个 demo（pid ${lk.pid}，锁创建于 ${lk.lockAgeSec} 秒前）。`
        + '并发跑会往同一批文件写；mux.sh 没有输出锁，交错写会产出「损坏的成片」（本项目实测过）。'
      : (lk.stale
        ? `发现陈旧并发锁（pid ${lk.pid ?? '?'} 已不在，锁龄 ${lk.lockAgeSec} 秒）—— 编排器会自动接管，属正常情况，不视为冲突。`
        : ''),
  });
}

// ── API: GET /api/env（缓存 30s）───────────────────────────
const ENV_TTL_MS = 30000;
let envCache = { at: 0, data: null, inflight: null };

/**
 * 把「安装动作」挂到检测结果上 —— **只在服务端做一次**，前端不重新推导。
 *
 * ★ 判据只有一处：动作完全由 lib/setup.mjs 的 planActions(envResult) 算出，
 *   前端拿到的就是 `it.action = {id, kind, title}`，点按钮直接 POST actionId。
 * ★ 加字段不改判据：env.mjs 的检测逻辑一行没动（只是结果里多挂了点东西）。
 */
function withSetup(data) {
  const actions = planActions(data);
  const byEnv = new Map();
  for (const a of actions) for (const id of a.envIds || []) byEnv.set(id, a);
  const groups = (data.groups || []).map((g) => ({
    ...g,
    items: (g.items || []).map((it) => {
      const a = byEnv.get(it.id);
      return a ? { ...it, action: { id: a.id, kind: a.kind, title: a.title } } : it;
    }),
  }));
  return {
    ...data,
    groups,
    setup: {
      autoCount: actions.filter((a) => a.kind === 'auto').length,
      manualCount: actions.filter((a) => a.kind === 'manual').length,
      actionIds: actions.map((a) => a.id),
      scenarios: Object.entries(FIXTURES).map(([k, v]) => ({ key: k, title: v.title })),
    },
  };
}

/**
 * GET /api/env —— 环境检测结果（默认缓存 30s，?force=1 强制重测）。
 *
 * ★ 演练模式：query 的 simulate 优先，其次启动参数 --simulate-env；命中则返回合成结果、不真检测。
 * ★ 并发请求只跑一次全量探测（探测要起 WSL，成本高）—— 用 inflight 去重。
 */
async function apiEnv(req, res, force, url) {
  // 演练模式：query 优先（可随时切换），其次启动参数 --simulate-env
  const sim = url?.searchParams.get('simulate') || ARGV.simulateEnv || null;
  if (sim) {
    const d = simulateEnv(sim);
    if (!d) return sendJson(res, 400, { error: `未知演练场景 ${sim}` });
    return sendJson(res, 200, { ...withSetup(d), cached: false, cacheAgeMs: 0, simulated: sim });
  }

  const fresh = envCache.data && Date.now() - envCache.at < ENV_TTL_MS;
  if (!force && fresh) {
    return sendJson(res, 200, { ...withSetup(envCache.data), cached: true, cacheAgeMs: Date.now() - envCache.at });
  }
  // 并发请求只跑一次全量探测（探测要起 WSL，成本高）
  if (!envCache.inflight) {
    envCache.inflight = checkEnv()
      .then((d) => { envCache = { at: Date.now(), data: d, inflight: null }; return d; })
      .catch((e) => { envCache.inflight = null; throw e; });
  }
  const data = await envCache.inflight;
  sendJson(res, 200, { ...withSetup(data), cached: false, cacheAgeMs: 0 });
}

// ── API: GET /api/setup/actions ─────────────────────────────
//
// 「首次运行向导」的数据源：当前环境该装什么、哪些能自动装、哪些只能手动。
// ★ 纯咨询 + 可执行**描述**，不执行任何东西。
/**
 * GET /api/setup/actions —— 「首次运行向导」的数据源：当前环境该装什么、哪些能自动装。
 *
 * ★ 返回动作清单 + auto/manual 计数；本接口纯咨询，真正执行走 POST /api/setup/run。
 */
async function apiSetupActions(req, res, url) {
  const sim = url?.searchParams.get('simulate') || ARGV.simulateEnv || null;
  const data = sim ? simulateEnv(sim) : await checkEnv();
  if (!data) return sendJson(res, 400, { error: `未知演练场景 ${sim}` });
  const actions = planActions(data);
  sendJson(res, 200, {
    simulated: sim || null,
    summary: data.summary,
    runnable: data.runnable,
    count: actions.length,
    autoCount: actions.filter((a) => a.kind === 'auto').length,
    manualCount: actions.filter((a) => a.kind === 'manual').length,
    actions: actions.map(serializeAction),
  });
}

// ── API: POST /api/setup/run ────────────────────────────────
//
// 真正执行一个安装动作（后台任务，日志走 /api/logs/:id 的 SSE）。
//
// ★ 幂等：**先重新检测**（不用 30s 缓存 —— 幂等判断必须基于当下），
//   对应检测项已经全 ok 就直接返回 skipped，不重装、不建任务。
// ★ 去重：同一个动作已有排队/运行中的任务 → 直接复用那个任务，不重复入队。
// ★ 不阻塞：安装失败**不影响**启动渲染任务（环境自检本来就是咨询性的）。
/**
 * POST /api/setup/run —— 真正执行一个安装动作（后台任务，日志走 /api/logs/:id 的 SSE）。
 *
 * ★ 幂等：先重新检测（不用 30s 缓存）—— 对应检测项已全 ok 就回 skipped，不重装、不建任务。
 * ★ 去重：同一动作已有排队/运行中的任务 → 复用那个任务，不重复入队。
 */
async function apiSetupRun(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const actionId = body.actionId;
  if (typeof actionId !== 'string' || !actionId.trim()) return sendJson(res, 400, { error: '缺少 actionId' });
  if (!/^[A-Za-z0-9._-]+$/.test(actionId)) return sendJson(res, 400, { error: `actionId 含非法字符：${actionId}` });

  const data = await checkEnv();
  const actions = planActions(data);
  const act = actions.find((a) => a.id === actionId);

  if (!act) {
    if (knownActionIds().includes(actionId)) {
      return sendJson(res, 200, { ok: true, skipped: true, reason: '该检测项已就绪 → 跳过（幂等，不重装）' });
    }
    return sendJson(res, 404, { error: `未知动作 ${actionId}` });
  }
  if (act.kind !== 'auto') {
    return sendJson(res, 400, { error: `${act.title} 需要手动完成，控制台不代跑。请看指引。`, manual: serializeAction(act).manual });
  }

  // 去重：同一个动作已经在跑/在排队，就别再入一次队
  const q = jobs.queueState();
  const dup = [q.running, ...q.waiting].find((j) => j && j.kind === 'setup' && j.actionId === actionId);
  if (dup) return sendJson(res, 200, { ok: true, reused: true, job: dup });

  const job = jobs.enqueueSetup({
    actionId: act.id,
    title: act.title,
    steps: act.steps,
    estBytes: act.estBytes || 0,
  });
  sendJson(res, 200, { ok: true, job: jobs.getSummary(job.id) });
}

// ── API: GET /api/demos ─────────────────────────────────────
function firstParagraph(mdPath) {
  let src;
  try { src = fs.readFileSync(mdPath, 'utf8'); } catch { return ''; }
  const lines = src.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length && lines[i].startsWith('#')) i++;      // 跳过标题
  while (i < lines.length && !lines[i].trim()) i++;            // 跳过空行
  const buf = [];
  for (; i < lines.length && buf.length < 3; i++) {
    let t = lines[i].trim();
    if (!t) { if (buf.length) break; else continue; }
    if (t.startsWith('#')) break;
    t = t.replace(/^>\s*/, '');                 // 引用块的 > 是行首标记，不是正文
    if (t) buf.push(t);
  }
  let s = buf.join(' ');
  s = s.replace(/[*_`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 200 ? s.slice(0, 200) + '…' : s;
}

/**
 * GET /api/demos —— 风格（demo）清单：简介、是否带 demo、是否已出片、分类。
 *
 * ★ 分类判据只在 lib/styles.mjs 实现一处（前端只消费结果）；解析失败 → 降级为扁平列表
 *   （风格照样全列出来，只是没有分类）。
 * ★ 读不到风格目录 → 500；每个风格的简介取 STYLE.md（没有则 DEMO.md）的首段。
 */
function apiDemos(req, res) {
  const stylesDir = resolveStylesRoot(CFG.winLib);   // ★ 风格源码根唯一来源；不设 LEMO_STYLES_ROOT 时 === path.join(CFG.winLib,'styles')
  let names = [];
  try {
    names = fs.readdirSync(stylesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map((d) => d.name).sort();
  } catch (e) {
    return sendJson(res, 500, { error: `读不到风格目录 ${stylesDir}：${String(e.message || e)}` });
  }

  // ★ 分类判据（`## 英文 · 中文` + 表格里的 [`slug`]）**只在 lib/styles.mjs 里实现一处**，
  //   前端不做任何解析、只消费这里的结果 —— 本项目反复吃过「同一判据写在两处 → 漂移」的亏。
  //   ★ 解析失败返回 null → 优雅降级：风格照样全列出来，只是没有分类（前端退回扁平列表）。
  const idx = readStyleIndex(stylesDir);

  const out = [];
  for (const slug of names) {
    const dir = path.join(stylesDir, slug);
    const hasDemo = fs.existsSync(path.join(dir, 'demo'));
    const styleMd = path.join(dir, 'STYLE.md');
    const demoMd = path.join(dir, 'DEMO.md');
    const desc = firstParagraph(fs.existsSync(styleMd) ? styleMd : demoMd);
    const filmPath = path.join(CFG.exportDir, slug, `${slug}.mp4`);
    let film = null;
    try {
      const st = fs.statSync(filmPath);
      film = { size: st.size, mtime: st.mtimeMs };
    } catch { /* 没出过片 */ }

    const meta = idx ? idx.bySlug.get(slug) : null;
    out.push({
      slug,
      hasDemo,
      desc,
      film,
      category: meta ? meta.cat : null,     // null = 未归类（README 里没写，或整个 README 没解析成功）
      nameEn: meta ? (meta.en || '') : '',
      nameCn: meta ? (meta.cn || '') : '',
    });
  }

  // 只把「真的有风格落在里面」的分类发给前端 —— 免得 UI 上出现空组。
  // 组内数量由前端从 styles 数组里现数（唯一事实来源），不在这里另存一份计数。
  const used = new Set(out.map((s) => s.category).filter(Boolean));
  const categories = idx
    ? idx.categories.filter((c) => used.has(c.key)).map((c) => ({ key: c.key, en: c.en, cn: c.cn }))
    : [];

  sendJson(res, 200, {
    styles: out,
    count: out.length,
    categories,
    categorized: categories.length > 0,     // false = 降级为扁平列表
  });
}

// ── API: GET /api/style/:slug（STYLE.md / DEMO.md → 已转义的 HTML）──
//
// ★ 渲染在**服务端**做，前端只负责挂进 DOM：
//   转义（& < > " '）与「不引入外部资源」的规则只写一处，前端不重复实现 —— 又是防漂移。
/**
 * GET /api/style/:slug —— 这个风格的 STYLE.md / DEMO.md，渲染成**已转义**的 HTML。
 *
 * ★ 渲染在服务端做（转义 + 不引入外部资源），前端只负责挂进 DOM —— 防漂移。
 * ★ 两份 md 都没有 → 404；slug 白名单 + resolve 后必须在风格目录内（越界 403）。
 */
function apiStyle(req, res, slug) {
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return sendJson(res, 400, { error: `slug 含非法字符：${slug}` });

  const root = path.resolve(resolveStylesRoot(CFG.winLib));   // ★ 风格源码根唯一来源；外层 resolve 保留（下面那道越界守卫要绝对路径，结果与改动前同一表达式一致）
  const dir = path.resolve(root, slug);
  if (dir !== root && !dir.startsWith(root + path.sep)) return sendJson(res, 403, { error: '路径越界' });

  const read = (name) => {
    try { return fs.readFileSync(path.join(dir, name), 'utf8'); } catch { return null; }
  };
  const styleMd = read('STYLE.md');
  const demoMd = read('DEMO.md');
  if (styleMd === null && demoMd === null) {
    return sendJson(res, 404, { error: `${slug} 下既没有 STYLE.md 也没有 DEMO.md` });
  }

  const meta = (() => {
    const idx = readStyleIndex(root);
    return idx ? idx.bySlug.get(slug) : null;
  })();

  sendJson(res, 200, {
    slug,
    nameCn: meta ? (meta.cn || '') : '',
    nameEn: meta ? (meta.en || '') : '',
    category: meta ? meta.cat : null,
    hasStyle: styleMd !== null,
    hasDemo: demoMd !== null,
    styleHtml: styleMd === null ? '' : renderMarkdown(styleMd),
    demoHtml: demoMd === null ? '' : renderMarkdown(demoMd),
  });
}

// ── API: POST /api/reveal（在资源管理器里打开成片目录）────────
/**
 * POST /api/reveal —— 在资源管理器里打开某个成片目录。
 *
 * ★ 只负责「把窗口叫起来」：explorer.exe 即使成功也返回退出码 1，故不等它、也不按退出码判成败
 *   —— 成败以「目录是否存在」为准。
 * ★ slug 白名单 + resolve 后必须在成片目录内，越界 403、不存在 404。
 */
async function apiReveal(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const slug = body.slug;
  if (typeof slug !== 'string' || !slug.trim()) return sendJson(res, 400, { error: '缺少 slug' });
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return sendJson(res, 400, { error: `slug 含非法字符：${slug}` });

  const root = path.resolve(CFG.exportDir);
  const dir = path.resolve(root, slug);
  if (!dir.startsWith(root + path.sep)) return sendJson(res, 403, { error: '路径越界' });
  if (!fs.existsSync(dir)) return sendJson(res, 404, { error: `目录不存在：${dir}` });

  // ⚠️ explorer.exe **即使成功也会返回退出码 1**，所以不能等它、更不能按退出码判成败。
  //    这里只负责「把窗口叫起来」，成败以「目录是否存在」为准（上面已经查过）。
  try {
    spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {
    return sendJson(res, 500, { error: `打开资源管理器失败：${String(e.message || e)}` });
  }
  sendJson(res, 200, { ok: true, dir });
}

// ── API: GET /api/console（端口固定入口的当前状态）────────────
/**
 * GET /api/console —— 端口固定入口的当前状态（host / port / url + 落盘与各注册表状态）。
 *
 * ★ 各字段都是**只读代理**：任务历史、工单、语言注册表、尺寸注册表的状态如实透传。
 */
function apiConsole(req, res) {
  const host = ARGV.host === '0.0.0.0' ? '127.0.0.1' : ARGV.host;
  sendJson(res, 200, {
    host,
    port: ARGV.port,
    url: `http://${host}:${ARGV.port}`,
    portFile: PORT_FILE,
    urlFile: URL_FILE,
    simulateEnv: ARGV.simulateEnv || null,   // 非 null = 演练模式（/api/env 返回合成结果）
    store: store.storeStatus(),     // 任务历史/日志落盘位置与上限（见 lib/store.mjs）
    briefs: briefs.briefsStatus(),  // 主题工单落盘位置与上限（见 lib/briefs.mjs）
    // 语言版本注册表（只读代理，见 lib/langs.mjs）：清单来自库侧 core/lang/lang.mjs 的 LANGS
    langs: { codes: langs.langCodes(), source: langs.langSource, error: langs.langsRegistryError },
    // 输出尺寸注册表（只读代理，见 lib/sizes.mjs）：清单来自库侧 core/render/size.mjs 的 RATIOS
    sizes: { default: sizes.DEFAULT_RATIO, ratios: sizes.ratioIds(), source: sizes.sizeSource, error: sizes.sizesRegistryError },
  });
}


// ── API: GET /api/films ─────────────────────────────────────
/**
 * GET /api/films —— 成片库清单：一级目录下的 .mp4，外加 dub 子目录的 film.mp4，按修改时间倒序。
 *
 * ★ 只读扫描（只 stat，不写任何东西）；读不到成片目录时返回空列表 + error 字段（不 500）。
 * ★ dub 条目由 dubFilms() 追加（比一级目录深一层），形状与既有条目一致 —— 纯追加。
 */
function apiFilms(req, res) {
  const root = CFG.exportDir;
  const films = [];
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (e) {
    return sendJson(res, 200, { films: [], error: `读不到成片目录 ${root}：${String(e.message || e)}` });
  }
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith('_') || ent.name.startsWith('.')) continue;
    const dir = path.join(root, ent.name);
    let files = [];
    try { files = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const f of files) {
      if (!f.isFile() || !f.name.toLowerCase().endsWith('.mp4')) continue;
      const full = path.join(dir, f.name);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      films.push({
        slug: ent.name,
        file: f.name,
        size: st.size,
        mtime: st.mtimeMs,
        url: `/api/films/${encodeURIComponent(ent.name)}/${encodeURIComponent(f.name)}`,
      });
    }
  }
  // ★ 文案出片的成片落在 `D:\lemo-films\dub\<时间戳>\film.mp4` —— 比一级目录**深一层**，
  //   上面那一轮扫不到。而用户做完一条片子，第一反应就是来「成片库」找它 —— 所以这里再扫一层。
  //   既有条目的形状一个字没改（只是多了几条），这是**纯追加**。
  for (const f of dubFilms(root)) films.push(f);
  // ★ 控制台出片的产物落在 `D:\lemo-films\_jobs\<任务id>\<slug>.mp4` —— `_` 前缀目录在上面那一轮
  //   被**故意**跳过（那是本项目「非风格 / 内部产物」的既有约定，用来挡 `_archive` / `_audit` 这些）。
  //   所以这里同样像 dubFilms 那样**显式再扫一层**：既有条目一个字节没改，只是多了几条（纯追加）。
  for (const f of jobFilms(root)) films.push(f);

  films.sort((a, b) => b.mtime - a.mtime);
  sendJson(res, 200, { films, count: films.length });
}

/**
 * 扫 `D:\lemo-films\dub\<出片目录>\film.mp4`（「文案出片」的产物）。
 *
 * ★ 只认 **film.mp4**：dub 目录下还有 `_tts\` 里的逐句 wav、`_uploads\` 里的素材、
 *   以及 lines.json / dur.json 这类中间产物 —— 那些不是成片，不该出现在成片库里。
 * ★ `slug: null` + `source: 'dub'`：dub 条目**没有风格 slug**（它不是某个风格出的片），
 *   前端据此把「重新生成」「打开目录」这类**按 slug 找风格**的操作藏起来 ——
 *   它们对 dub 条目无意义，点了只会报错。
 * ★ 纯只读：只 stat，不写任何东西。
 */
function dubFilms(root) {
  const out = [];
  const dubRoot = path.join(root, 'dub');
  let entries = [];
  try { entries = fs.readdirSync(dubRoot, { withFileTypes: true }); } catch { return out; }
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith('_') || ent.name.startsWith('.')) continue;
    const full = path.join(dubRoot, ent.name, 'film.mp4');
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (!st.isFile()) continue;
    out.push({
      slug: null,                 // ★ 没有风格 slug —— 前端据此区分（别拿它去查风格）
      source: 'dub',
      name: ent.name,             // 出片目录名（展示与「打开目录」用）
      file: 'film.mp4',
      size: st.size,
      mtime: st.mtimeMs,
      url: `/api/films/dub/${encodeURIComponent(ent.name)}/${encodeURIComponent('film.mp4')}`,
    });
  }
  return out;
}

/**
 * 扫 `D:\lemo-films\_jobs\<任务id>\<slug>.mp4`（**控制台出片**的产物）。
 *
 * ★ 为什么必须单列一条：控制台出片现在写进独立输出目录（见 lib/jobs.mjs:jobOutDir），
 *   而一级扫描（apiFilms）**故意跳过 `_` 前缀目录** —— 那是本项目「非风格 / 内部产物」的既有约定。
 *   所以这里照 dubFilms 的做法**显式再扫一层**：既有条目一个字节没改，只是多了几条（纯追加）。
 * ★ 文件名就是风格 slug：编排器 `lemo-make.mjs` 里那条 `const dst = path.join(outDir, ...)` 写的是 `<outDir>\<slug>.mp4`，
 *   所以 slug 从文件名取；`jobId` 取目录名（= 任务 id）—— 用户据此能对上是哪一次出片。
 * ★ 只认 `.mp4`：同一个出片目录里还可能有 `<slug>.srt`，那不是成片。
 * ★ 纯只读：只 stat，不写任何东西。
 */
function jobFilms(root) {
  const out = [];
  const jobsRoot = path.join(root, '_jobs');
  let entries = [];
  try { entries = fs.readdirSync(jobsRoot, { withFileTypes: true }); } catch { return out; }
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith('_') || ent.name.startsWith('.')) continue;
    const dir = path.join(jobsRoot, ent.name);
    let files = [];
    try { files = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const f of files) {
      if (!f.isFile() || !f.name.toLowerCase().endsWith('.mp4')) continue;
      const full = path.join(dir, f.name);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      out.push({
        slug: f.name.slice(0, -4),          // 文件名 = 风格 slug（`<slug>.mp4`）
        source: 'job',                      // ★ 与 dub 条目同理：前端据此区分「这不是样板片」
        jobId: ent.name,                    // 任务 id（= 出片目录名）
        name: ent.name,                     // 展示 / 搜索用（与 dub 条目的 name 同义）
        file: f.name,
        size: st.size,
        mtime: st.mtimeMs,
        url: `/api/films/_jobs/${encodeURIComponent(ent.name)}/${encodeURIComponent(f.name)}`,
      });
    }
  }
  return out;
}

// ── API: GET /api/films/:slug/:file（支持 Range，能拖进度条）──
/**
 * GET /api/films/:slug/:file —— 发成片字节，支持 Range 请求（能拖进度条）；HEAD 走同一处理函数。
 *
 * ★ slug/file 白名单 + resolve 后必须在成片目录内（越界 403）；文件不存在 → 404。
 * ★ 带 Range → 206（含后缀范围，非法范围 416）；不带 → 200 + Accept-Ranges: bytes。
 */
function apiFilmFile(req, res, slug, file) {
  if (!/^[A-Za-z0-9._-]+$/.test(slug) || !/^[A-Za-z0-9._-]+$/.test(file)) {
    return sendJson(res, 400, { error: '路径非法' });
  }
  const full = path.resolve(CFG.exportDir, slug, file);
  const rootResolved = path.resolve(CFG.exportDir);
  if (!full.startsWith(rootResolved + path.sep)) return sendJson(res, 403, { error: '路径越界' });

  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return sendJson(res, 404, { error: '成片不存在' });
    const type = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!m) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      let start = m[1] === '' ? null : Number(m[1]);
      let end = m[2] === '' ? null : Number(m[2]);
      if (start === null && end === null) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      if (start === null) { start = Math.max(0, st.size - end); end = st.size - 1; }   // 后缀范围
      if (end === null || end >= st.size) end = st.size - 1;
      if (start > end || start >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      });
      return fs.createReadStream(full, { start, end }).pipe(res);
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(full).pipe(res);
  });
}

// ── API: GET /api/films/dub/:dir/:file（文案出片的成片，比一级目录深一层）──
//
// ★ 为什么单独一条路由、而不是放宽 `/api/films/:slug/:file` 的 slug 正则：
//   那条路由的 slug 语义就是「风格名」，放宽会连带改掉它的行为；新开一条**只加不减**。
// ★ 校验**照抄** apiFilmFile 的写法（白名单正则 + resolve 后必须在根目录内），
//   唯一的差别是根取 `exportDir\dub` 而不是 exportDir ——
//   这样 `dir=..` 也逃不出 dub 目录（若按 exportDir 判，`dir=..` 会落到成片库根下，
//   等于凭空多暴露一批根目录里的文件）。
/**
 * GET /api/films/dub/:dir/:file —— 文案出片的成片字节（比一级目录深一层），支持 Range；HEAD 同。
 *
 * ★ 根取 exportDir\dub 而不是 exportDir —— 这样 dir=.. 也逃不出 dub 目录。
 * ★ 校验照抄 apiFilmFile（白名单 + resolve 后必须在根内），Range 逻辑复用 serveRangeFile。
 */
function apiDubFilmFile(req, res, dir, file) {
  if (!/^[A-Za-z0-9._-]+$/.test(dir) || !/^[A-Za-z0-9._-]+$/.test(file)) {
    return sendJson(res, 400, { error: '路径非法' });
  }
  const dubRoot = path.resolve(CFG.exportDir, 'dub');
  const full = path.resolve(dubRoot, dir, file);
  if (!full.startsWith(dubRoot + path.sep)) return sendJson(res, 403, { error: '路径越界' });
  serveRangeFile(req, res, full,
    MIME[path.extname(full).toLowerCase()] || 'video/mp4',
    '成片不存在（可能还在合成，或已被清理）');
}

// ── API: GET /api/films/_jobs/:jobId/:file（控制台出片的成片，比一级目录深一层）──
//
// ★ 与 dub 那条同理：控制台出片的产物落在 `D:\lemo-films\_jobs\<任务id>\<slug>.mp4`，
//   比一级目录深一层，`/api/films/:slug/:file` 那两条路由都够不着（段数不对）。
// ★ 校验**照抄** apiDubFilmFile（白名单正则 + resolve 后必须在根内），
//   唯一的差别是根取 `exportDir\_jobs` 而不是 exportDir —— 这样 `jobId=..` 也逃不出 _jobs 目录
//   （若按 exportDir 判，`..` 会落到成片库根下，等于凭空多暴露一批根目录里的文件）。
/**
 * GET /api/films/_jobs/:jobId/:file —— 控制台出片的成片字节（比一级目录深一层），支持 Range；HEAD 同。
 *
 * ★ 根取 exportDir\_jobs 而不是 exportDir —— 这样 jobId=.. 也逃不出 _jobs 目录。
 * ★ 校验照抄 apiDubFilmFile（白名单 + resolve 后必须在根内），Range 逻辑复用 serveRangeFile。
 */
function apiJobFilmFile(req, res, jobId, file) {
  if (!/^[A-Za-z0-9._-]+$/.test(jobId) || !/^[A-Za-z0-9._-]+$/.test(file)) {
    return sendJson(res, 400, { error: '路径非法' });
  }
  const jobsRoot = path.resolve(CFG.exportDir, '_jobs');
  const full = path.resolve(jobsRoot, jobId, file);
  if (!full.startsWith(jobsRoot + path.sep)) return sendJson(res, 403, { error: '路径越界' });
  serveRangeFile(req, res, full,
    MIME[path.extname(full).toLowerCase()] || 'video/mp4',
    '成片不存在（可能还在合成，或已被清理）');
}

// ── 通用：带 Range 的静态文件响应（试听要能拖进度条）────────────
//
// ★ 与 apiFilmFile 同一套逻辑（416 / 后缀范围 / Accept-Ranges / no-cache）。
//   为什么不把 apiFilmFile 改成调它：那是既有代码，动它就要重测成片播放；而「声音」版块
//   要发的文件（参考音在 D:\Index-tts、D:\sucai，试听产物在 D:\lemo-films\_voicetest）
//   都不在成片目录下，本来就需要一个能发任意绝对路径的调用方。逻辑照抄一份，既有代码零改动。
function serveRangeFile(req, res, full, type, notFoundMsg) {
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return sendJson(res, 404, { error: notFoundMsg });
    const range = req.headers.range;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!m) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      let start = m[1] === '' ? null : Number(m[1]);
      let end = m[2] === '' ? null : Number(m[2]);
      if (start === null && end === null) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      if (start === null) { start = Math.max(0, st.size - end); end = st.size - 1; }   // 后缀范围
      if (end === null || end >= st.size) end = st.size - 1;
      if (start > end || start >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      });
      return fs.createReadStream(full, { start, end }).pipe(res);
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(full).pipe(res);
  });
}

// ── API: 主题工单（/api/briefs*）──────────────────────────────
//
// ★ 这一组接口是「主题出片」的骨架：控制台只负责**落工单 / 透传 runOpts / 起任务 / 记结果**。
//   内容由**外部 LLM（WorkBuddy）**生成 —— 它读 /api/briefs/processable 拿到
//   STYLE.md 全文 + content.json 样例 + lines.json 样例 + demo 路径，生成完把工单回写成 ready。
//   控制台**不生成内容、不碰 demo 目录、不发明 runOpts**（那三件事都属于 WorkBuddy）。
//
// ★ 为什么 list/get 每次都从磁盘读：回写方式是「外部改 JSON 文件」，只要缓存一份，
//   外部改完控制台就看不见，工单会永远卡在 pending。见 lib/briefs.mjs 的文件头。
//
// ★ 状态机（严格）：pending → ready → running → done/failed；failed → ready（重试）。
//   - 只有 ready 才能出片（pending / running / done 一律 409，理由写清楚）。
//   - running 的工单不允许删（409）—— 那个 lemo-make 子进程还在跑。

/**
 * GET /api/briefs —— 工单列表 + 状态计数，并带上 UI 下拉要用的风格/语言/尺寸清单。
 *
 * ★ 每次从磁盘读（不缓存）：回写方式是「外部改 JSON 文件」，缓存一份就会看不见外部改动。
 */
function apiBriefList(req, res) {
  const list = briefs.listBriefs();
  const st = briefs.briefsStatus();
  sendJson(res, 200, {
    briefs: list,
    count: list.length,
    counts: briefs.countByStatus(list),
    styles: briefs.styleList(),     // UI 的风格下拉从这儿取：4 个白名单风格的**唯一事实来源**
    defaultLang: langs.DEFAULT_LANG, // 默认语言版本（en）—— UI 据此判断「要不要显示 --lang」
    defaultRatio: sizes.DEFAULT_RATIO,   // 默认输出比例（9:16）—— UI 的尺寸下拉据此默认选中
    ratios: sizes.RATIOS,           // 预设比例清单（清单的权威来源是库侧 core/render/size.mjs）
    root: st.root,
    caps: st.caps,
    disabledReason: st.ready ? null : st.disabledReason,
  });
}

/**
 * POST /api/briefs —— 落一张主题工单（status=pending），内容留给外部 LLM 生成。
 *
 * ★ 控制台只落盘、不生成内容、不发明 runOpts（那三件事属于 WorkBuddy）—— 见本组接口的组说明。
 * ★ 建单失败按 briefs.createBrief 返回的 code 回 4xx；成功回 201 + brief + 下一步提示。
 */
async function apiBriefCreate(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const r = briefs.createBrief({ topic: body.topic, slug: body.slug, lang: body.lang, ratio: body.ratio, size: body.size });
  if (!r.ok) return sendJson(res, r.code, { error: r.error });
  sendJson(res, 201, {
    ok: true,
    brief: r.brief,
    hint: `工单已落盘（status=pending，语言版本 ${r.brief.lang}，输出尺寸 ${r.brief.sizeDisplay}）。`
      + '在对话里对 WorkBuddy 说「处理工单」，'
      + '它会读 GET /api/briefs/processable 拿素材、生成内容，并把工单改成 ready；之后回控制台点「出片」。',
  });
}

/**
 * GET /api/langs?slug=<风格> —— 「这个风格有哪些语言版本可以出片」。
 *
 * ★ 判据只有一处：库侧 core/lang/lang.mjs 的 LANGS（清单）+ 编排器 --lang 的换名规则
 *   （「content=X.json → X.<code>.json」⇒ 有 content*.<code>.json 才算有这个语言版本）。
 *   两条都在 lib/langs.mjs 里实现，前端只消费结果 —— 前端不自己判、不硬编码 en/zh。
 * ★ 纯只读：只列目录、只 import 注册表，不写库、不写工单。
 */
function apiLangs(req, res, url) {
  const slug = (url.searchParams.get('slug') || '').trim();
  if (!slug) return sendJson(res, 400, { error: '缺少 slug' });
  const style = briefs.styleBySlug(slug);
  if (!style) return sendJson(res, 400, { error: briefs.unsupportedStyleMessage(slug) });
  const demoDir = path.join(briefs.STYLES_DIR, slug, 'demo');
  sendJson(res, 200, {
    slug,
    styleCn: style.cn,
    defaultLang: langs.DEFAULT_LANG,
    ...langs.langsForDemoDir(demoDir),
  });
}

/**
 * GET /api/aspects?slug=<风格>[&film=<影片模块>] —— 这个风格的影片**真的能正确构图**的比例。
 *
 * ★ 判据只有一处：影片模块（styles/<slug>/demo/film*.js）的 `FILM_META.aspects` 声明。
 *   影片模块是**浏览器 ESM**（canvas / DOMMatrix / 根绝对路径 import），node 不能 import ——
 *   所以这里**读源码文本**探测（见 lib/aspects.mjs，如实标注 probe='text'）。
 * ★ 没声明 / 文件不存在 / 写得不合法 → **只支持 16:9**（= 没改造过，给别的尺寸会被裁切）。**不抛错**。
 * ★ 给了 film 就只探那一部（精确）；不给就取该 demo 下所有 film*.js 的**并集**（乐观）。
 * ★ 纯只读：只读影片源码文本，不写库、不写工单。
 */
function apiAspects(req, res, url) {
  const slug = (url.searchParams.get('slug') || '').trim();
  if (!slug) return sendJson(res, 400, { error: '缺少 slug' });
  const film = (url.searchParams.get('film') || '').trim() || null;
  const info = aspects.styleAspects(slug, { film });
  // 白名单外的 slug 也照答（本接口不限于 4 个工单风格）—— 只是读不到 demo 就按「只支持 16:9」。
  sendJson(res, 200, {
    ...info,
    // 顺带把「只支持 16:9」这个默认语义明说出来，免得调用方自己猜
    note: info.declared
      ? '能力来自影片源码里的 FILM_META.aspects 声明（文本探测）。'
      : '影片源码里没有 aspects 声明 → 按「只支持 16:9」处理（= 没做多比例改造，给别的尺寸会被裁切）。',
  });
}

/**
 * GET /api/sizes —— 可选输出尺寸清单（给前端渲染「输出尺寸」下拉）。
 *
 * ★ 清单与「比例 → 像素」换算的**唯一来源是库** D:\lemo-opuscar\core\render\size.mjs
 *   （控制台侧由 lib/sizes.mjs 代理）—— 前端只消费结果，**不硬编码**任何比例。
 * ★ 顺带把每个比例的推导像素给出来（UI 可显示「9:16 → 1080x1920」），以及默认比例。
 * ★ 纯只读：只 import 注册表，不写库、不写工单。
 */
function apiSizes(req, res) {
  const ratios = sizes.RATIOS.map((r) => {
    const wh = sizes.resolveSize({ ratio: r.id });
    return { ...r, w: wh ? wh.w : null, h: wh ? wh.h : null, pixels: wh ? sizes.formatSize(wh) : null };
  });
  sendJson(res, 200, {
    defaultRatio: sizes.DEFAULT_RATIO,
    ratios,
    // 自定义像素的合法范围（与库侧 size.mjs 的校验一致）：偶数、MIN_SIZE–MAX_SIZE。
    // ★ 数字从 lib/sizes.mjs 读（它代理库侧 size.mjs 的 MIN_SIZE / MAX_SIZE），**不在这里另写一份**。
    custom: { min: sizes.MIN_SIZE, max: sizes.MAX_SIZE, even: true, example: '1080x1920' },
    source: sizes.sizeSource,
    error: sizes.sizesRegistryError,   // 读不到库时如实上报（此时 ratios 只剩默认项）
  });
}

// ── API: 声音（/api/voices*）─────────────────────────────────
//
// 「声音」版块的三件事：**看清单 / 听参考音 / 真的合成一句试听**。
//
// ★ 清单的唯一真相源是库侧脚本 core/tts/tts_indextts.py 的 `--list-voices`（见 lib/voices.mjs）。
//   控制台**不另抄一份别名表** —— 两处判据必然漂移，而漂移的表现是「面板上看得到、出片时报
//   unknown voice」，最难查。所以 /api/voices 只是把那份 JSON 原样代理出去。
// ★ 只读 + 一个后台任务：这三个接口都不写库（唯一的写盘是试听的临时输入文件与产物）。

/**
 * GET /api/voices[?force=1] —— 音色清单 + 分组 + 目录状态 + 当前内容用的音色。
 * ★ 30 秒进程内缓存（照 apiEnv）：面板会频繁调它，而每次都要起一个 python 进程。
 */
async function apiVoices(req, res, url) {
  const payload = await voices.voicesPayload({ force: url.searchParams.get('force') === '1' });
  sendJson(res, 200, payload);
}

/**
 * GET /api/voices/audio?name=<name> —— 参考音字节流（试听要能拖进度条，所以支持 Range）。
 *
 * ★ 安全：name **只用来在清单里查表**，查到的绝对路径才去读文件 —— name 永远不会被拼进路径。
 *   清单里没有 → 404。目录穿越因此无从发生（`../../windows/win.ini` 在清单里不存在）。
 */
async function apiVoiceAudio(req, res, url) {
  const name = (url.searchParams.get('name') || '').trim();
  if (!name) return sendJson(res, 400, { error: '缺少 name' });
  const r = await voices.resolveVoice(name);
  if (!r.ok) return sendJson(res, 404, { error: r.error });
  serveRangeFile(req, res, r.voice.file, 'audio/wav', `参考音文件不存在：${r.voice.file}`);
}

/**
 * GET /api/voices/test/audio/<file> —— 试听产物（POST /api/voices/test 的落点）。
 * 与参考音一样支持 Range（前端同一个 <audio> 组件能复用）。
 */
function apiVoiceTestAudio(req, res, file) {
  if (!/^[A-Za-z0-9._-]+$/.test(file)) return sendJson(res, 400, { error: `试听文件名非法：${file}` });
  const root = path.resolve(voices.VOICE_TEST_DIR);
  const full = path.resolve(root, file);
  if (!full.startsWith(root + path.sep)) return sendJson(res, 403, { error: '路径越界' });
  serveRangeFile(req, res, full, 'audio/wav', '试听产物不存在（可能还没合成完，或已被清理）');
}

/**
 * POST /api/voices/test —— 用指定音色**真的合成一句**，让用户先听效果再决定。
 *
 * ★ 必须异步：单条合成约 30 秒，模型首次加载 1~2 分钟 —— HTTP 请求挂着必被前端/浏览器掐断。
 *   所以走**既有的后台任务队列**（jobs.enqueueSetup + lib/setup.mjs 的步骤执行器）：
 *   日志 SSE、取消、落盘、历史恢复全部直接复用，一条都不用重写。
 *   （音色试听和出片共用一条串行队列是**对的**：GPU 只有一块，并行只会互相拖慢。）
 * ★ 产物 URL 在入队时就能定（文件名里的时间戳是这里生成的），所以**随响应直接给出**，
 *   前端不必等任务结束再猜 URL；任务只负责把文件放到位。
 */
async function apiVoiceTest(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return sendJson(res, 400, { error: '缺少 name' });
  // ★ 音色名会被写进 bash 脚本与产物文件名 —— 只收「安全 token」形状。
  //   （清单里的名字本来就都是这个形状；限制在这里是为了不把校验责任推给下游。）
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(name)) {
    return sendJson(res, 400, { error: `音色名含非法字符（只允许 A-Za-z0-9._- ）：${name}` });
  }

  const r = await voices.resolveVoice(name);
  if (!r.ok) return sendJson(res, 404, { error: r.error });

  const text = (typeof body.text === 'string' && body.text.trim())
    ? body.text.trim()
    : voices.DEFAULT_TEST_TEXT;
  if (text.length > 300) return sendJson(res, 400, { error: `试听文本过长（${text.length} 字，最多 300）` });

  let speed = Number(body.speed);
  if (!Number.isFinite(speed) || speed <= 0) speed = voices.DEFAULT_TEST_SPEED;
  speed = Math.round(Math.min(2, Math.max(0.5, speed)) * 100) / 100;   // 库侧 duration_factor 的有效区间

  let prep;
  try {
    prep = voices.prepareVoiceTest({ name, text, speed, uniq: `vt-${process.pid}-${Date.now().toString(36)}` });
  } catch (e) {
    return sendJson(res, 500, { error: `准备试听输入失败：${String(e.message || e)}` });
  }

  const job = jobs.enqueueSetup({
    actionId: `voice-test-${name}`,
    title: `试听音色 ${name}`,
    steps: [{
      kind: 'wsl-file',                       // 脚本文件在宿主侧写好，WSL 里跑（见 lib/setup.mjs:runStep）
      label: `合成一句试听（音色 ${name} · 语速 ${speed} · ${prep.textChars} 字）`,
      hostPath: prep.hostScript,
      timeoutMs: 20 * 60 * 1000,              // 含首次加载模型；超时由执行器杀整组（含 WSL 侧）
    }],
  });

  sendJson(res, 200, {
    ok: true,
    job: jobs.getSummary(job.id),
    url: prep.url,                            // 合成完成后可直接 <audio src> 播放（支持 Range）
    voice: { name, speed, text, textChars: prep.textChars },
    out: { dir: voices.VOICE_TEST_DIR, file: prep.file },
  });
}

/**
 * GET /api/voices/sources —— 音色源目录里**还没被转换成参考音**的候选文件。
 *
 * ★ 候选的判据（扩展名 / 排除 `_` 开头与子目录 / 建议 ASCII 名 / already）**只在
 *   lib/voices.mjs 里实现一处**，这里只把它代理出去 —— 前端拿到 name 直接用，不再自己算。
 * ★ 纯只读：只列目录，不写任何东西。
 */
async function apiVoiceSources(req, res) {
  const r = await voices.listSources();
  sendJson(res, 200, r);
}

/**
 * POST /api/voices/import —— 把一个源素材转成参考音（= 加一个可选音色）。
 *
 * ★ 必须异步：转换要起 ffmpeg + 分析，10~30 秒，HTTP 请求挂着会被前端掐断。走**既有的后台任务
 *   队列**（jobs.enqueueSetup + lib/setup.mjs 的步骤执行器），日志 SSE / 取消 / 落盘全部复用。
 * ★ 转换成功后主动**失效清单缓存**（见 watchVoiceImport）—— 否则用户点完看不到新音色。
 */
async function apiVoiceImport(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const r = await voices.prepareVoiceImport({ file: body.file, name: body.name });
  if (!r.ok) return sendJson(res, r.code || 400, { error: r.error });

  const job = jobs.enqueueSetup({
    actionId: `voice-import-${r.name}`,
    title: `导入音色 ${r.name}`,
    steps: [{
      kind: 'wsl-file',                       // 脚本文件在宿主侧写好，WSL 里跑（见 lib/setup.mjs:runStep）
      label: `把 ${r.file} 转成参考音 ${r.name}.wav（降电平 + 裁到 6~15s）`,
      hostPath: r.hostScript,
      timeoutMs: 10 * 60 * 1000,
    }],
  });
  watchVoiceImport(job.id);

  sendJson(res, 200, {
    ok: true,
    job: jobs.getSummary(job.id),
    out: r.out,                               // 预期输出路径（Windows 形式，供前端/脚本核对）
    name: r.name,
    hint: `转换是后台任务（约 10~30 秒），进度看「实时日志」。完成后音色 ${r.name} 就在清单里了；`
      + '若面板还没刷新出来，点一下刷新（清单有 30 秒缓存，任务成功时服务端会主动失效它）。',
  });
}

/**
 * 盯着导入任务，成功后失效音色清单缓存。
 *
 * ★ 必须 `let unsub = null` 再赋值：subscribe 对已结束的任务会**同步**回调，
 *   写成 `let unsub = jobs.subscribe(...)` 的话回调执行时 unsub 还在 TDZ 里 → ReferenceError。
 *   （与 watchBriefJob 同一个坑。）
 */
function watchVoiceImport(jobId) {
  let unsub = null;
  unsub = jobs.subscribe(jobId, (ev) => {
    if (!ev || ev.type !== 'end') return;
    if (typeof unsub === 'function') { try { unsub(); } catch { /* ignore */ } }
    unsub = null;
    if (ev.status === 'done' && ev.exitCode === 0) voices.invalidateManifest();
  });
}

// ── API: 文案出片（/api/dub*）────────────────────────────────
//
// 定位：用户粘贴一段**自己的文案** → 出成片。两种形态 ——
//   ① 仅自定义文案：画面走工具自己生成的背景（可指定风格，或 --style auto 按语义自动匹配）；
//   ② 文案 + 口播视频：`--keep-original` —— 用户素材的**画面与声音固定、不做任何修改**，
//      成片时长 = 素材时长，我们只在上面做风格化的字幕与叠加层（可选 --srt 指定时间轴）。
// 配音走本机 Index-TTS，音色由前端从「声音」版块带过来（这里只做形状校验 + 透传）；
// ★ 形态 2 不跑 TTS（--keep-original），所以快得多。
//
// ★ 控制台这一侧**不实现任何合成/剪辑/断句/语义**：真正的活在 D:\lemo-tools\dub.mjs
//   与 lib/dub-semantic.mjs 里。所以这里只有「收素材 / 给断句 / 给风格表 / 给语义分析 /
//   拼参数 / 入队」这几件事，参数一律原样透传。
// ★ 素材落 D:\lemo-films\dub\_uploads（非 C 盘）。文件名只进登记表当展示用，
//   落盘路径永远是 `<token>.<白名单扩展名>` —— 用户给的名字**从不参与拼路径**。
// ★ 出片走**既有的后台任务队列**（jobs.enqueueSetup + 一个 exe 步骤）：日志 SSE、取消、
//   落盘、历史恢复全部直接复用；它也会出现在「任务列表」里，这与「试合成一句」是同一套做法。
// ★ 为什么必须异步：配音要**逐句**合成（空载时几十秒一句，机器忙时可能到几分钟；模型首次加载 1~2 分钟），
//   一个 HTTP 请求挂着等必被浏览器掐断。

/**
 * POST /api/dub/upload?name=<原始文件名> —— 收下素材（**raw body**，不是 multipart）。
 *
 * ★ 收两种素材，靠扩展名区分，回传的 `kind` 是 `'video' | 'srt'`：
 *   `video` = 口播视频（.mp4/.mov/.m4v/.webm）；`srt` = 字幕时间轴（.srt，形态 2 可选）。
 *   两条走**同一条**通道 —— 同一份 token 登记表、同一套清洗与限额，安全做法只有一处。
 * ★ 为什么用 raw body：multipart 要自己写解析器（零依赖项目里那是一个真·负担），
 *   而前端只需要传一个文件 —— 文件名走 query、字节走 body，一次 POST 搞定，还少一层出错的地方。
 * ★ 边收边写盘（不是先缓进内存）：200MB 全缓进内存对控制台进程是灾难。
 */
async function apiDubUpload(req, res, url) {
  const rawName = url.searchParams.get('name') || '';
  const name = dub.cleanName(rawName);
  if (!name) return sendJson(res, 400, { error: '缺少 name（用法：POST /api/dub/upload?name=<原始文件名>）' });

  const ext = dub.extOf(name);
  const kind = dub.kindOfExt(ext);
  if (!kind) {
    return sendJson(res, 400, {
      error: `不支持的素材格式「${ext || '（无扩展名）'}」—— 只收 ${dub.UPLOAD_EXTS.join(' / ')}`,
    });
  }

  // Content-Length 能提前判掉的，就别等 200MB 传完再拒（省双方的时间和带宽）
  const cl = Number(req.headers['content-length']);
  if (Number.isFinite(cl) && cl > dub.MAX_UPLOAD_BYTES) {
    sendJson(res, 413, {
      error: `素材过大：${(cl / 1048576).toFixed(1)}MB（上限 ${dub.MAX_UPLOAD_BYTES / 1048576}MB）`,
    });
    req.resume();                     // 把剩下的字节读掉，让连接正常收尾（不 RST，客户端能读到 413）
    return;
  }

  const token = dub.newToken();
  fs.mkdirSync(dub.UPLOAD_DIR, { recursive: true });
  const dest = path.join(dub.UPLOAD_DIR, `${token}${ext}`);   // ★ 路径只用服务端 token

  let size = 0;
  let tooBig = false;
  const ws = fs.createWriteStream(dest);
  // ★ 写流**真正关闭**（fd 已释放）的时点。失败路径必须等它再 unlink —— 见下面两处说明。
  const wsClosed = new Promise((r) => ws.on('close', r));
  const result = await new Promise((resolve) => {
    let settled = false;
    const settle = (v) => { if (!settled) { settled = true; resolve(v); } };

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > dub.MAX_UPLOAD_BYTES && !tooBig) {
        tooBig = true;
        settle({
          ok: false, code: 413,
          error: `素材过大：超过上限 ${dub.MAX_UPLOAD_BYTES / 1048576}MB（传了一半被拒，没有落盘）`,
        });
        try { req.unpipe(ws); } catch { /* ignore */ }
        ws.destroy();
        // ★★ 这里**不能**立刻 unlink：`destroy()` 只是"请求销毁"，fd 可能还没释放，
        //   甚至 `createWriteStream` 的 open 还在飞 —— 此时 unlink 之后，那次 open 会把文件
        //   **重新建出来**，留下一个半截文件（实测：dub-api 的「无残留」用例偶发红，报"新增 <token>.mp4"）。
        //   正确做法 = 等 'close'（fd 已释放）再删，见下面 `await wsClosed`。
        req.resume();                 // 继续读掉，好让客户端读到这个 413
      }
    });
    req.pipe(ws);
    ws.on('finish', () => settle({ ok: true }));
    ws.on('error', (e) => settle({ ok: false, code: 500, error: `写盘失败：${String(e.message || e)}` }));
    req.on('error', (e) => settle({ ok: false, code: 500, error: `上传中断：${String(e.message || e)}` }));
  });

  if (!result.ok) {
    await wsClosed;                   // ★ 等 fd 释放再删 —— 否则可能"删了又被 open 建回来"
    try { fs.unlinkSync(dest); } catch { /* ignore */ }
    return sendJson(res, result.code || 500, { error: result.error });
  }
  if (size === 0) {
    try { fs.unlinkSync(dest); } catch { /* ignore */ }
    return sendJson(res, 400, { error: '上传内容为空（body 里一个字节都没有）' });
  }

  const entry = dub.registerUpload({ token, name, size, path: dest, at: Date.now(), kind });
  sendJson(res, 200, {
    ok: true, token: entry.token, name: entry.name, size: entry.size,
    path: entry.path, kind: entry.kind,
  });
}

/**
 * POST /api/dub/preview —— 只做断句，让用户在出片前核对。
 *
 * ★ **同步**接口（不排队）：断句是纯文本活，不进后台队列 —— 让用户为了看一眼断句去排队等 GPU，
 *   是本末倒置。dub.mjs --dry-run 本身也「不做重活」。
 * ★ 断句规则**只有一处**（dub.mjs）。这里优先调它的 --dry-run 并解析输出；
 *   解析不了才退回本地实现，并在响应里用 source/note **明说**这是降级结果（见 lib/dub.mjs）。
 */
async function apiDubPreview(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const script = typeof body.script === 'string' ? body.script : '';
  if (!script.trim()) return sendJson(res, 400, { error: 'script 不能为空（先粘贴一段文案）' });
  if (script.length > dub.MAX_SCRIPT_CHARS) {
    return sendJson(res, 400, { error: `script 过长：${script.length} 字（上限 ${dub.MAX_SCRIPT_CHARS}）` });
  }

  const p = await dub.previewScript(script);
  sendJson(res, 200, { ok: true, lines: p.lines, count: p.count, source: p.source, note: p.note });
}

/** GET /api/dub/sources —— 已上传的素材（供 UI 复用上次传的那条；每条带 kind）。 */
function apiDubSources(req, res) {
  sendJson(res, 200, dub.uploadsPayload());
}

// token → {w,h}。登记过的素材文件不会再变，同一个 token 只探一次。
// ★ 只放内存（不落盘）：探测结果不是关键数据，重启后重探一次即可。
const dubSrcMetaCache = new Map();

/**
 * GET /api/dub/source-meta?token=<token> —— 口播素材的**像素尺寸**（宽 × 高）。
 *
 * ★ 为什么需要它：「文案出片」在**出片前**要能告诉用户「你这条素材会被裁掉多少」，
 *   判据是「素材宽高比 vs 输出宽高比」—— 而前端拿不到素材的宽高
 *   （/api/dub/upload 只回 token / name / size；登记表里也没有尺寸字段）。
 *   ★ 这里只回**素材自己**的 w/h：比例清单与「比例 → 像素」换算的权威仍是 /api/sizes
 *     （库侧 core/render/size.mjs），前端不硬编码任何比例表。
 * ★ 探测用 WSL 侧 ffprobe（lib/dub-core.mjs 的 probe —— 与 dub.mjs 自检同一条路）：
 *   **不用 GPU、不加载任何模型**，纯 ffprobe 读头部。
 * ★ 探不到（WSL 没起 / 素材损坏）→ 502 {ok:false}。前端据此**不提示** ——
 *   宁可不说，也不猜一个尺寸去吓用户。
 */
async function apiDubSourceMeta(req, res, url) {
  const token = (url.searchParams.get('token') || '').trim();
  if (!token) return sendJson(res, 400, { error: '缺少 token（用法：GET /api/dub/source-meta?token=<token>）' });
  const up = dub.getUpload(token);                 // ★ 只查登记表，绝不拿 token 拼路径
  if (!up) return sendJson(res, 404, { error: `token 不在已上传清单里（或文件已被删除）：${token}` });
  if (up.kind !== 'video') {
    return sendJson(res, 400, { error: `token 指的不是视频（${up.name}）—— 只有口播视频才有宽高比` });
  }

  const hit = dubSrcMetaCache.get(token);
  if (hit) return sendJson(res, 200, { ok: true, token, w: hit.w, h: hit.h, cached: true });

  let p = null;
  try { p = await probe(winToWsl(up.path)); }
  catch (e) { return sendJson(res, 502, { ok: false, error: `探测素材尺寸失败：${String(e && e.message || e)}` }); }
  if (!p || !p.w || !p.h) {
    return sendJson(res, 502, {
      ok: false,
      error: `探测不到素材尺寸（ffprobe 没读出 width/height）—— WSL 里的 ffprobe 可能没就绪`,
    });
  }
  dubSrcMetaCache.set(token, { w: p.w, h: p.h });
  sendJson(res, 200, { ok: true, token, w: p.w, h: p.h, cached: false });
}

/**
 * GET /api/dub/styles —— 风格清单（供 UI 填下拉）。
 *
 * ★ 风格表**只从 lib/dub-semantic.mjs 的 loadStyles() 取**，这里既不另读 dub-styles.json
 *   也不另写一份 —— 两份风格表必然漂移，而漂移的后果是「用户选了 A，出片用了 B」。
 * ★ 那个模块由另一个智能体维护、可能晚就位：拿不到时**如实降级**（只给「不指定」+ note），
 *   不 500 —— 没有风格可选，不该连带把出片能力也弄没。
 */
async function apiDubStyles(req, res) {
  sendJson(res, 200, await dub.stylesPayload());
}

/**
 * POST /api/dub/analyze —— 断段 + 语义标签 + 风格匹配（**同步**，约 1 秒）。
 *
 * ★ 为什么同步不排队：它**默认只跑纯规则路**（词表打分，毫秒级），
 *   让用户为了看一眼「系统理解得对不对」去排队是本末倒置。
 *   也可由外部注入结果（source:'external'）；模块自己**不调任何本机模型**。
 * ★ 返回体**就是** analyze() 的结果（不包一层），契约见任务书。
 */
async function apiDubAnalyze(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const script = typeof body.script === 'string' ? body.script : '';
  if (!script.trim()) return sendJson(res, 400, { error: 'script 不能为空（先粘贴一段文案）' });
  if (script.length > dub.MAX_SCRIPT_CHARS) {
    return sendJson(res, 400, { error: `script 过长：${script.length} 字（上限 ${dub.MAX_SCRIPT_CHARS}）` });
  }

  let styleIds;
  if (body.styleIds !== undefined && body.styleIds !== null) {
    if (!Array.isArray(body.styleIds)) return sendJson(res, 400, { error: 'styleIds 必须是字符串数组' });
    if (body.styleIds.length > 64) return sendJson(res, 400, { error: 'styleIds 最多 64 项' });
    for (const s of body.styleIds) {
      if (typeof s !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(s)) {
        return sendJson(res, 400, { error: `styleIds 里有非法 id：${String(s).slice(0, 60)}` });
      }
    }
    styleIds = body.styleIds.slice();
  }

  // ★ 2026-10-04 补：接受**外部（WorkBuddy 智能体）产出的语义解析结果**并原样注入。
  //   设计上「通用语义推理由智能体承担，本模块不调任何本机模型」⇒ 控制台必须能注入外部结果，
  //   否则只能用规则路（词表打分）。此前**只有 CLI 的 `--analysis` 有这条路**，
  //   而本端点的注释却已写着「也可由外部注入结果（source:'external'）」⇒ 文档先于实现，本轮补齐。
  const analysis = (body.analysis && typeof body.analysis === 'object' && !Array.isArray(body.analysis))
    ? body.analysis : undefined;

  const r = await dub.analyzeScript({ text: script, styleIds, analysis });
  if (!r || typeof r !== 'object') return sendJson(res, 500, { error: '语义解析返回了空结果' });
  // 模块没就位 → 503（「后端接口未就绪」那一类）；模块在但分析失败 → 原样 200 带 ok:false
  if (r.ok === false && r.notReady) return sendJson(res, 503, r);
  sendJson(res, 200, r);
}

/**
 * POST /api/dub/run —— 文案 → 成片（异步任务）。
 *
 * ★ 参数全部过一遍**形状校验**（lib/dub.mjs:validateRunBody）：非法直接 400。
 *   坏值喂给 dub.mjs 的表现是「跑到一半报个看不懂的错」，在这里拦住便宜得多。
 * ★ 素材 token **只在登记表里查**，查不到就 400 —— 绝不用请求里的 token 拼路径。
 * ★ `--out` 由服务端定（`D:\lemo-films\dub\<时间戳>-<短id>`）并**先建好目录**：
 *   让工具去猜父目录存不存在是没必要的耦合。
 * ★ 文案**写成文件**再传路径（而不是 `--script -` 走 stdin）：子进程是 exe 直起、不接管 stdin；
 *   而且文案落在出片目录里，事后能对着成片复盘「当时念的是什么」。
 */
async function apiDubRun(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const v = dub.validateRunBody(body);
  if (!v.ok) return sendJson(res, 400, { error: v.error });
  const o = v.value;

  // ★ 输出尺寸（与风格链路 /api/briefs/:id/run 同一条纪律）：优先级 size > ratio > 默认 9:16，
  //   并且**总是显式传**一个尺寸参数（连默认 9:16 也传）—— 命令行自解释，以后改默认值也不漂移。
  //   判据来自库侧 core/render/size.mjs（控制台侧 lib/sizes.mjs 代理）：控制台**不硬编码**比例表，
  //   非法值直接 4xx 拦在这里，别让它跑到 dub.mjs 才报个看不懂的错。
  const rawRatio = (typeof body.ratio === 'string' && body.ratio.trim()) ? body.ratio.trim() : '';
  if (rawRatio && !sizes.isRatioId(rawRatio)) {
    return sendJson(res, 400, {
      error: `ratio 非法：${rawRatio.slice(0, 40)} —— 可选 ${sizes.ratioIds().join(' / ')}`,
    });
  }
  // 自定义像素（size）优先于比例；两个都没给 → 默认比例 9:16。
  // size 的**形状**在 validateRunBody 里已过一遍（WxH、1–8192），这里再按库的校验兜一次：
  // 范围是 MIN_SIZE–MAX_SIZE 且宽高都要偶数（比 lib/dub.mjs 的 1–8192 更严 —— 例如 64x64 画不出来，要拦）。
  let sizeArg = null;   // { flag: '--size' | '--ratio', value: string }
  if (o.size) {
    const wh = sizes.resolveSize({ size: o.size });
    if (!wh) {
      return sendJson(res, 400, {
        error: `size 非法：${o.size} —— 宽高都要是 ${sizes.MIN_SIZE}–${sizes.MAX_SIZE} 的偶数（如 1080x1920）`,
      });
    }
    sizeArg = { flag: '--size', value: sizes.formatSize(wh) };
  } else {
    sizeArg = { flag: '--ratio', value: rawRatio || sizes.DEFAULT_RATIO };
  }

  // 风格：省略 = 不传 --style（**行为与加这个功能之前完全一样**）；
  //       'auto' = 交给核心工具按语义自动匹配；其它值必须真的在风格表里，否则 400。
  if (o.style && o.style !== 'auto') {
    const ids = await dub.styleIds();
    if (!ids.includes(o.style)) {
      return sendJson(res, 400, {
        error: `style 不存在：${o.style} —— 可选 auto / ${ids.join(' / ')}`,
      });
    }
  }

  let videoPath = '';
  if (o.videoToken) {
    const up = dub.getUpload(o.videoToken);
    if (!up) return sendJson(res, 400, { error: `videoToken 不在已上传清单里（或文件已被删除）：${o.videoToken}` });
    if (up.kind === 'srt') {
      return sendJson(res, 400, { error: `videoToken 指的是一条字幕（${up.name}），不是视频 —— 请传口播视频` });
    }
    videoPath = up.path;
  }
  let bgPath = '';
  if (o.bgToken) {
    const up = dub.getUpload(o.bgToken);
    if (!up) return sendJson(res, 400, { error: `bgToken 不在已上传清单里（或文件已被删除）：${o.bgToken}` });
    bgPath = up.path;
  }
  // 形态 2 的可选 SRT：同样**只查登记表**，且必须是 srt 那一条
  let srtPath = '';
  if (o.srtToken) {
    const up = dub.getUpload(o.srtToken);
    if (!up) return sendJson(res, 400, { error: `srtToken 不在已上传清单里（或文件已被删除）：${o.srtToken}` });
    if (up.kind !== 'srt') {
      return sendJson(res, 400, { error: `srtToken 指的不是字幕文件（${up.name}）—— SRT 请用 .srt 上传` });
    }
    srtPath = up.path;
  }

  // 核心工具在不在？**就绪前直接说清楚**，而不是入队一条注定失败的任务让用户去日志里找原因。
  if (!fs.existsSync(dub.DUB_TOOL)) {
    return sendJson(res, 503, {
      error: `核心工具还没就绪：找不到 ${dub.DUB_TOOL} —— 「文案出片」要等它就位才能跑`,
    });
  }

  const out = dub.newOutDir();
  const art = dub.outArtifacts(out.dir);
  try {
    fs.writeFileSync(art.script, o.script, 'utf8');
  } catch (e) {
    return sendJson(res, 500, { error: `写文案文件失败：${String(e.message || e)}` });
  }

  const args = [dub.DUB_TOOL, '--script', art.script, '--out', out.dir];
  if (videoPath) args.push('--video', videoPath);
  if (bgPath) args.push('--bg', bgPath);
  if (o.voice) args.push('--voice', o.voice);
  if (o.speed !== undefined) args.push('--speed', String(o.speed));
  // ★ 输出尺寸：**显式传**（size 优先，否则 ratio；两个都没给 → --ratio 9:16）。
  //   上面已按库侧 size.mjs 校验过，这里只是把选定的那个参数名/值拼进命令行。
  args.push(sizeArg.flag, sizeArg.value);
  if (o.gap !== undefined) args.push('--gap', String(o.gap));
  // ★ 形态 2 不传 --fit：素材的画面/声音/时长都不动，「适配时长」这件事根本不成立
  if (o.fit && !o.keepOriginal) args.push('--fit', o.fit);
  if (o.keepOriginalAudio) args.push('--keep-original-audio');
  if (o.title) args.push('--title', o.title);
  // ★ style 省略就**不传** --style —— 旧调用方的行为一字不变
  if (o.style) args.push('--style', o.style);
  if (o.keepOriginal) args.push('--keep-original');
  // ★ 形态 2 的可选限幅：必须排在 --keep-original 之后（它只在 --keep-original 下有意义）
  if (o.keepOriginalLimit) args.push('--keep-original-limit');
  if (srtPath) args.push('--srt', srtPath);
  // ★ 2026-10-04 补：外部语义解析结果（智能体产出）→ 落盘成文件再传 `--analysis`。
  //   与「文案写成文件」同一条纪律：**不把大 JSON 塞进命令行**，且落在出片目录里便于事后复盘。
  //   形状已在 `validateRunBody` 校过；语义合法性由 `lib/dub-semantic.mjs#normalizeExternal` 判
  //   （segments 拼回不等于原文会被拒并记「疑似改字」）。
  if (o.analysis) {
    const analysisPath = path.join(out.dir, '_analysis.json');
    try {
      fs.writeFileSync(analysisPath, JSON.stringify(o.analysis, null, 2), 'utf8');
    } catch (e) {
      return sendJson(res, 500, { error: `写语义解析文件失败：${String(e.message || e)}` });
    }
    args.push('--analysis', analysisPath);
  }

  // 日志里把**真正要跑的**命令原样打出来（参数由数组拼，不经过 shell，所以中文/空格都安全）
  const shown = ['node', path.basename(dub.DUB_TOOL), ...args.slice(1)]
    .map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ');

  const job = jobs.enqueueSetup({
    actionId: 'dub-run',
    title: `文案出片${o.title ? '：' + o.title : ''}`,
    steps: [{
      kind: 'exe',                       // 宿主侧直起 node（dub.mjs 是 Windows 侧脚本，不走 WSL）
      exe: process.execPath,
      args,
      cwd: __dirname,
      label: `出片：${shown}`,
      timeoutMs: 60 * 60 * 1000,         // 逐句合成 + 首次加载模型，给足一小时
    }],
  });

  sendJson(res, 200, {
    ok: true,
    job: jobs.getSummary(job.id),
    out: out.dir,
    outName: out.name,
    artifacts: art,
    style: o.style || '',
    keepOriginal: o.keepOriginal === true,
    hint: o.keepOriginal === true
      ? '形态 2（保持原素材）：不跑 TTS、不动素材的画面与声音，只叠字幕与风格化叠加层 —— 通常比形态 1 快得多。'
        + '进度看「实时日志」；这条任务也会出现在「任务列表」里。'
      : '配音是逐句合成的，通常几十秒一句；机器忙的时候可能到几分钟。模型首次加载还要 1~2 分钟 ——'
        + '进度看「实时日志」；这条任务也会出现在「任务列表」里。',
  });
}

/**
 * GET /api/briefs/:id —— 读一张工单的当前内容（每次从磁盘读，不缓存）。
 *
 * ★ id 非法 → 400；id 合法但工单不存在 → 404（两者用 isValidBriefId 区分，回不同文案）。
 */
function apiBriefGet(req, res, id) {
  const b = briefs.getBrief(id);
  if (!b) {
    return sendJson(res, briefs.isValidBriefId(id) ? 404 : 400, {
      error: briefs.isValidBriefId(id) ? `工单不存在：${id}` : `工单 id 非法：${id}`,
    });
  }
  sendJson(res, 200, { brief: b });
}

/** PATCH —— 外部 LLM 的**推荐**回写通道（走状态机校验；直接改文件会绕过它）。 */
async function apiBriefPatch(req, res, id) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { error: '请求体必须是一个 JSON 对象' });
  }
  const r = briefs.patchBrief(id, body);
  if (!r.ok) return sendJson(res, r.code, { error: r.error });
  sendJson(res, 200, { ok: true, brief: r.brief, ...(r.warning ? { warning: r.warning } : {}) });
}

/**
 * DELETE /api/briefs/:id —— 删除一张工单（running 中的工单不允许删，回 409）。
 *
 * ★ 删除判据（含状态机限制）全在 lib/briefs.mjs:deleteBrief；失败按它返回的 code 回。
 */
function apiBriefDelete(req, res, id) {
  const r = briefs.deleteBrief(id);
  if (!r.ok) return sendJson(res, r.code, { error: r.error });
  sendJson(res, 200, { ok: true, id: r.id });
}

/**
 * processable —— **给外部 LLM 读的**：列出所有 pending 工单 + 每个风格的完整素材。
 * 这是整个系统里唯一「为 LLM 而设计」的接口，所以宁可多给（STYLE.md 全文、两个样例、真实路径），
 * 也不能让它靠猜 —— 猜错字段名，出片时画面就崩了。
 */
function apiBriefProcessable(req, res, url) {
  const slug = url.searchParams.get('slug');
  if (slug && !briefs.isBriefStyle(slug)) {
    return sendJson(res, 400, { error: briefs.unsupportedStyleMessage(slug) });
  }
  sendJson(res, 200, briefs.buildProcessable({ slug: slug || null }));
}

/**
 * 出片。只有 status=ready 能出（failed 需显式 {"retry":true}，那是 UI 的「重试」按钮）。
 * 内部起 `node lemo-make.mjs <slug> --skip-sync <runOpts>`，复用 lib/jobs.mjs 的串行队列。
 */
async function apiBriefRun(req, res, id) {
  let body = {};
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const b = briefs.getBrief(id);
  if (!b) {
    return sendJson(res, briefs.isValidBriefId(id) ? 404 : 400, {
      error: briefs.isValidBriefId(id) ? `工单不存在：${id}` : `工单 id 非法：${id}`,
    });
  }

  const retry = body.retry === true;
  if (b.status === 'pending') {
    return sendJson(res, 409, {
      error: `工单 ${id} 还是 pending（内容还没生成）—— 先在对话里对 WorkBuddy 说「处理工单」，`
        + '它会读 GET /api/briefs/processable 生成内容并把工单改成 ready，之后才能出片。',
    });
  }
  if (b.status === 'running') {
    return sendJson(res, 409, {
      error: `工单 ${id} 正在出片（status=running，任务 ${b.jobId || '?'}）—— 不能重复启动。`
        + '进度看「实时日志」面板（点任务列表里那一行的「看日志」）。',
    });
  }
  if (b.status === 'done') {
    return sendJson(res, 409, {
      error: `工单 ${id} 已经出过片了（status=done，成片 ${b.film || '?'}）—— 要换内容请新建一张工单，`
        + '或把它的 status 改回 ready 再点出片。',
    });
  }
  if (b.status === 'failed' && !retry) {
    return sendJson(res, 409, {
      error: `工单 ${id} 上次出片失败（status=failed：${b.error || '无错误信息'}）。`
        + '要重试请带 {"retry":true}（控制台 UI 上的「重试」按钮就是这么发的）。',
    });
  }
  if (b.status !== 'ready' && b.status !== 'failed') {
    return sendJson(res, 409, { error: `工单 ${id} 的 status=${b.status} —— 只有 ready 才能出片。` });
  }

  // runOpts 由 WorkBuddy 填，控制台**只透传**；但形状要过一遍（免得把奇怪的东西喂给编排器）
  const v = briefs.validateOpts(b.runOpts, 'runOpts');
  if (!v.ok) return sendJson(res, 400, { error: `工单里的 runOpts 非法：${v.error}（请让 WorkBuddy 修正后回写）` });

  // 内容文件在不在？**只提示，不拦** —— 有可能 WorkBuddy 是直接覆盖 content.json，本来就没有 contentRel。
  const warnings = [];
  if (b.contentRel) {
    const p = path.join(b.demoDir, b.contentRel);
    if (!fs.existsSync(p)) warnings.push(`contentRel 指向的文件不存在：${p}（出片可能失败，或退回库内默认内容）`);
  }
  if (b.linesRel) {
    const p = path.join(b.demoDir, b.linesRel);
    if (!fs.existsSync(p)) warnings.push(`linesRel 指向的文件不存在：${p}`);
  }
  if (!b.runOpts.length) warnings.push('runOpts 为空：出片会用库内默认 content.json，不是你生成的那份内容');
  // runOpts 里若自己带了尺寸参数，会与控制台按工单拼出来的那个冲突 —— 提醒一句（不拦）。
  // ★ 判据与 lib/briefs.mjs:validateOpts 一致：`--ratio` 的值现在**是收的**（`9:16` 含 `:` 也收），
  //   所以这个分支是真会走到的（改前 `--ratio 9:16` 在 validateOpts 就被 400 拦掉了，文案成了死代码）。
  // ★ 冲突结果不是「可能」而是确定的：编排器 `lemo-make.mjs:871` 对重复 `--ratio` 是**后者胜**
  //   （`o.ratio = next()` 逐次覆盖），而控制台把自己的那个拼在 runOpts **之后** ⇒ 工单的尺寸字段赢。
  if (b.runOpts.includes('--ratio') || b.runOpts.includes('--size')) {
    warnings.push('runOpts 里已经带了 --ratio / --size：控制台还会按工单的「输出尺寸」再传一次，'
      + '而它排在 runOpts 之后 ⇒ **以工单的尺寸字段为准**，runOpts 里那个不生效'
      + '（编排器对重复的 --ratio / --size 是后者胜）。建议把尺寸只填在工单的尺寸字段里。');
  }

  // ★ 语言版本：lang=en **不传** --lang（英文版的命令行与改动前逐字一致）；其余语言追加 `--lang <code>`，
  //   由编排器把 content=<base>.json 换成 <base>.<code>.json（并**同时**送到事件表 / 字幕源 / 配音行）。
  //   这里只提示「该风格有没有这个语言的内容文件」，**不拦** —— 内容可能还没生成，或故意用别的命名。
  if (b.lang && b.lang !== langs.DEFAULT_LANG) {
    const probe = langs.langsForDemoDir(b.demoDir);
    if (!probe.codes.includes(b.lang)) {
      warnings.push(`工单要的是${b.langCn || b.lang}（lang=${b.lang}），但 ${b.demoDir} 下没有 content*.<${b.lang}>.json —— `
        + `出片时编排器会报「找不到 <base>.${b.lang}.json」。`
        + `该 demo 现有内容文件：${probe.contentFiles.join(', ') || '（一个都没有）'}`);
    }
  }

  const opts = ['--skip-sync', ...b.runOpts];
  if (b.lang && b.lang !== langs.DEFAULT_LANG) opts.push('--lang', b.lang);
  // ★ 输出尺寸：**总是显式传**一个尺寸参数（与语言的「en 不传」不同 —— 尺寸是新功能、没有历史包袱，
  //   显式传让命令行自解释，以后改默认值也不会造成行为漂移）。
  //   优先级 size > ratio（与库侧 resolveSize 一致）：有自定义像素就传 --size，否则传 --ratio（连默认 9:16 也传）。
  //   两个值在 createBrief / normalize 时已经校验过（这里再兜一次，非法就退回默认比例，绝不把坏值喂给编排器）。
  const si = b.sizeInfo || sizes.sizeInfo(b);
  if (si && si.isCustom && si.valid) {
    opts.push('--size', si.display);
  } else {
    const rt = sizes.isRatioId(b.ratio) ? b.ratio : sizes.DEFAULT_RATIO;
    opts.push('--ratio', rt);
    if (si && !si.valid) warnings.push(`工单的尺寸不合法（${si.error}）→ 已按默认比例 ${sizes.DEFAULT_RATIO} 出片`);
  }
  // ★ 音色 / 语速（控制台「声音」版块）：工单出片也走同一条路 —— 用户在面板上选了音色，
  //   从「主题出片」入口点的片也应该用那个音色，否则同一台机器上两个入口出片音色不一致，很难解释。
  //   形状校验用与 /api/run 同一套规则（lib/briefs.mjs:validateOpts），免得两处漂移。
  if (body.voice !== undefined && body.voice !== null && body.voice !== '') {
    const vv = briefs.validateOpts(['--voice', String(body.voice)], 'voice');
    if (!vv.ok) return sendJson(res, 400, { error: `voice 非法：${vv.error}` });
    opts.push('--voice', String(body.voice));
  }
  if (body.speed !== undefined && body.speed !== null && body.speed !== '') {
    const sp = Number(body.speed);
    if (!Number.isFinite(sp) || sp < 0.5 || sp > 2) {
      return sendJson(res, 400, { error: `speed 非法：必须是 0.5–2.0 之间的数字（收到 ${body.speed}）` });
    }
    opts.push('--speed', String(sp));
  }

  // ★ 影片构图能力（防呆）：这个尺寸落不落在这部影片**真的能正确构图**的比例上？
  //   影片模块的 FILM_META.aspects 声明是判据（读源码文本探测，见 lib/aspects.mjs）；没声明 = 只支持 16:9。
  //   这里**只警告、不拦** —— 用户有权坚持出，只是要知情（出了片才发现被裁才是真问题）。
  //   有 `--film <name>` 就按那一部判（精确）；没有就按该风格 demo 下所有影片模块的并集（乐观）。
  {
    const ac = aspects.aspectCheck({
      slug: b.slug, ratio: b.ratio, size: b.size, film: aspects.filmFromOpts(b.runOpts),
    });
    if (ac.warning) warnings.push(ac.warning);
  }
  const job = jobs.enqueue(b.slug, opts, { briefId: b.id });
  // ★ 先让这条任务**立刻**落盘，再把工单写成 running。
  //   enqueue 的落盘是 500ms 去抖的（lib/jobs.mjs:persistSoon），若不在这里 flush，
  //   就会出现「工单文件已 running + jobId 指向一条索引里还不存在的任务」的 ~500ms 窗口 ——
  //   任何在这个窗口里启动的实例（或重启）都会把这张工单误判成僵尸单收敛成 failed。
  jobs.flushPersist();
  const upd = briefs.patchBrief(id, {
    status: 'running', jobId: job.id,
    startedAt: new Date().toISOString(), endedAt: null, error: null, film: null,
  }, { internal: true });
  if (!upd.ok) console.warn(`  ⚠️  [主题工单] 工单 ${id} 转 running 落盘失败：${upd.error}`);

  watchBriefJob(job.id, id);
  sendJson(res, 200, {
    ok: true,
    brief: briefs.getBrief(id),
    job: jobs.getSummary(job.id),
    warnings,
  });
}

/**
 * 盯着那个出片任务，结束后把工单推到 done / failed。
 *
 * ★ 为什么用 jobs.subscribe 而不是轮询：它本来就是「先同步重放历史、再挂实时回调」，
 *   对一个**已经结束**的任务会在调用瞬间同步回调 end 事件 —— 起完任务立刻结束（比如 dry-run）也不会漏。
 * ★ 取消（canceled）也算 failed：工单没出片，用户点「重试」即可。
 */
function watchBriefJob(jobId, briefId) {
  // ⚠️ 必须 `let unsub = null` 再赋值：subscribe 对已结束的任务会**同步**回调，
  //    写成 `let unsub = jobs.subscribe(...)` 的话，回调执行时 unsub 还在 TDZ 里 → ReferenceError。
  let unsub = null;
  unsub = jobs.subscribe(jobId, (ev) => {
    if (!ev || ev.type !== 'end') return;
    if (typeof unsub === 'function') { try { unsub(); } catch { /* ignore */ } }
    unsub = null;

    const j = jobs.getSummary(jobId);
    const ok = ev.status === 'done' && ev.exitCode === 0;
    const film = j && j.film ? path.basename(j.film) : null;
    const r = briefs.patchBrief(briefId, ok ? {
      status: 'done', endedAt: new Date().toISOString(), film, error: null,
    } : {
      status: 'failed', endedAt: new Date().toISOString(), film: null,
      error: ev.error || (ev.status === 'canceled'
        ? '出片任务被取消（工单没出片）。点「重试」可重新出片。'
        : `出片任务 ${ev.status}（退出码 ${ev.exitCode === null || ev.exitCode === undefined ? '?' : ev.exitCode}）`
          + ' —— 完整日志见任务列表里那一行的「看日志」。'),
    }, { internal: true });
    if (!r.ok) console.warn(`  ⚠️  [主题工单] 工单 ${briefId} 收尾落盘失败：${r.error}`);
  });
}

// ── LLM API 配置（/api/llm/*）────────────────────────────────
//
// 面板「LLM API 配置」的后端。★ 契约：D:/lemo-tmp/llm-api-spec.md §七（接口）/ §八（落盘）。
//
// 分工（本批）：
//   · 适配器 / 配置解析 / **落盘** / 脱敏**全在 lib/llm-api.mjs**（见 §一~§六）—— 本文件只调它的导出：
//     listProfiles / resolveConfig / readOverride / saveOverride / validate / chat。
//     ★ 不自己实现适配器，也**不再自己读写** `_llm-api.json`（避免两份落盘实现各自漂移）。
//   · 本文件只负责：HTTP 信封（§七）、面板需要的「自定义头占位符回填」、以及把请求体拼成 opts。
//
// ★ 三条铁律：
//   ① **key 永不回显**：GET 只回 `hasKey`；自定义头里凡敏感名（authorization / *api*key* / token…）
//      的值一律打码成**固定**占位符 `••••••`；POST 时收到该占位符 ⇒ 保留原值（= 前端「留空=不改」）。
//      ★ 为什么用固定占位符、而不是模块 maskKey 的 `abcd…`：面板要把头**回填**到输入框，
//        只有固定串才能被**无歧义**识别成「未改动」—— 否则用户一保存就把密钥替换成了它自己的掩码。
//   ② **HTTP 一律 200**，错误放 body（`{ok:false,error:{kind,message,hint?}}`）—— 免得前端把 4xx/5xx
//      当网络故障（本项目 web/app.js 的既有 `api()` 就是按 `!r.ok` 抛错的）。
//   ③ **模块没就绪 / 抛异常都不崩服务**：动态 import + try/catch 兜底（模块缺失 ⇒ 一句中文提示）。
//
// 响应信封（§七）：`{ok:true,data}` / `{ok:false,error}`。★ `validate`/`chat` 的**模块结果**整体放在
// `data` 里（模块自己的 ok/steps/errors 原样保留，前端读 `data.ok` / `data.steps`）——
// 这样「请求是否被处理」与「校验是否通过」两件事不会混在一个 `ok` 上。

const LLM_KEY_MASK = '••••••';   // 固定占位符（见上文①）
const LLM_SECRET_HEADER_RE = /authorization|api[-_]?key|token|secret|bearer|cookie/i;

// 动态 import：模块尚未落地时这里会抛，调用方兜住（服务照常起；下次请求会重试）。
let _llmMod = null;
async function loadLlmApi() {
  if (_llmMod) return _llmMod;
  _llmMod = await import('./lib/llm-api.mjs');   // 相对本文件解析
  return _llmMod;
}

/** 敏感头的值打码（★ key 永不出现在响应里）。 */
function redactLlmHeaders(h) {
  if (!h || typeof h !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(h)) out[k] = LLM_SECRET_HEADER_RE.test(k) ? LLM_KEY_MASK : v;
  return out;
}

/** 合并自定义头：占位符 ⇒ 保留 prev 原值（= 不改）；空串 ⇒ 删掉该头；其余照收。 */
function mergeLlmHeaders(prev, incoming) {
  const out = {};
  const src = (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) ? incoming : {};
  for (const [k, v] of Object.entries(src)) {
    const val = String(v);
    if (val === LLM_KEY_MASK) { if (prev && prev[k] !== undefined) out[k] = prev[k]; }
    else if (val !== '') out[k] = val;
  }
  return out;
}

/** 把「存储的覆盖」脱敏成可安全回给前端的形状（★ 不含 key 明文）。 */
function sanitizeLlmOverride(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) {
    if (k === 'apiKey') continue;                                  // ★ 永不回显
    if (k === 'headers') { out.headers = redactLlmHeaders(v); continue; }
    out[k] = v;
  }
  out.hasKey = !!(o && o.apiKey);
  return out;
}

/**
 * 请求体 → 传给模块的 opts（§二 优先级 #1 = **显式**传参）。
 * ★ 只放「用户明确给了」的字段（空串一律视为「没给」）—— 其余交给模块按 §二 逐级回落（env / 覆盖文件 / 默认）。
 * @param {object} body 请求体
 * @param {object} [prevHeaders] 覆盖文件里的自定义头（用于把打码占位符还原成原值）
 */
function buildLlmOpts(body, prevHeaders) {
  const b = (body && typeof body === 'object') ? body : {};
  const o = {};
  for (const k of ['profile', 'baseUrl', 'kind', 'model', 'path', 'extract']) {
    if (typeof b[k] === 'string' && b[k].trim() !== '') o[k] = b[k].trim();
  }
  if (b.timeoutMs !== undefined && b.timeoutMs !== '' && b.timeoutMs !== null) {
    const n = Number(b.timeoutMs);
    if (Number.isFinite(n)) o.timeoutMs = n;
  }
  if (typeof b.apiKey === 'string' && b.apiKey !== '') o.apiKey = b.apiKey;
  if (b.headers && typeof b.headers === 'object' && !Array.isArray(b.headers)) {
    const h = mergeLlmHeaders(prevHeaders, b.headers);
    if (Object.keys(h).length) o.headers = h;
  }
  return o;
}

/**
 * 面板用的配置视图（★ key 脱敏）。
 * @param {object} mod lib/llm-api.mjs
 * @param {object} cfg resolveConfig() 或 previewProfile() 的结果（★ 前者含 apiKey，**只在本函数内用**）
 * @param {object} ov  要在「覆盖」里回显的对象（预览别的 profile 时传 {}）
 * @param {{hasKey:boolean,keyMask:string}} [keyInfo] 已脱敏的 key 信息（previewProfile 路径直接给；
 *        不给则从 cfg.apiKey 现算）—— 免得为「已脱敏的输入」再造一条分支。
 */
function llmConfigPayload(mod, cfg, ov, keyInfo) {
  const override = ov || {};
  const hasKey = keyInfo ? !!keyInfo.hasKey : !!cfg.apiKey;
  const keyMask = keyInfo
    ? String(keyInfo.keyMask || '')
    : (() => { try { return mod.maskKey ? mod.maskKey(cfg.apiKey) : ''; } catch { return ''; } })();
  return {
    profile: cfg.id,
    label: cfg.label || '',
    kind: cfg.kind || '',
    baseUrl: cfg.baseUrl || '',
    model: cfg.model || '',
    models: Array.isArray(cfg.models) ? cfg.models : [],
    // 输入框只放**用户覆盖**的头（不把 profile 默认头混进来 ⇒ 保存不会把它们意外固化成覆盖）
    headers: redactLlmHeaders(override.headers || {}),
    effectiveHeaders: Object.keys(cfg.headers || {}),   // 生效头的**名字**（给提示用，不含值）
    timeoutMs: cfg.timeoutMs,
    path: cfg.path,
    extract: cfg.extract,
    hasKey,
    // ★ keyMask（如 `sk-K…`）：**掩码不是明文**（模块 maskKey，契约 §四 同口径），
    //   给面板当「当前已配 key」的提示用（team-lead 2026-10-08 裁定保留）。★ 绝不回 key 本身。
    keyMask,
    unknownProfile: !!cfg.unknownProfile,
    overrideFile: mod.overrideFilePath(),
    override: sanitizeLlmOverride(override),
  };
}

/** 模块缺失 / 抛异常的统一兜底：HTTP 200 + 可操作中文提示（★ 不含任何密钥）。 */
function llmFail(res, e) {
  const notReady = !!(e && (e.code === 'ERR_MODULE_NOT_FOUND' || /llm-api\.mjs/.test(String(e.message || ''))));
  const kind = notReady ? 'config' : 'unknown';
  sendJson(res, 200, {
    ok: false,
    error: {
      kind,
      message: String((e && e.message) || e),
      ...(notReady ? { hint: 'lib/llm-api.mjs 还没落地（另一个智能体在实现）。落地后重开控制台即可。' } : {}),
    },
  });
}

/**
 * GET /api/llm/profiles —— 脱敏 profile 列表 + 当前生效 profile（§七）。
 */
async function apiLlmProfiles(req, res) {
  try {
    const mod = await loadLlmApi();
    sendJson(res, 200, { ok: true, data: { profiles: mod.listProfiles(), current: mod.resolveConfig({}).id } });
  } catch (e) { llmFail(res, e); }
}

/**
 * GET /api/llm/config —— 当前**生效**配置（key 脱敏，只回 hasKey；§七）。
 * `?profile=<id>` 可**预览**另一个 profile：只给它的内置默认（+env），不带上一 profile 的字段覆盖
 * （否则用户切下拉时会看到「上一个 profile 的 baseUrl 挂在下一个 profile 名下」）。
 * ★ 预览走模块的**正式导出** `previewProfile(id)`（= 该 profile 的默认值 + 不读覆盖文件，已脱敏）——
 *   不再依赖 `resolveConfig(opts, _file)` 的第二个内部形参（team-lead 2026-10-08 批准的契约补充）。
 */
async function apiLlmConfigGet(req, res, url) {
  try {
    const mod = await loadLlmApi();
    const qp = ((url && url.searchParams.get('profile')) || '').trim();
    if (qp) {
      const p = mod.previewProfile(qp);
      return sendJson(res, 200, {
        ok: true,
        data: llmConfigPayload(mod, p, {}, { hasKey: p.hasKey, keyMask: p.keyMask }),
      });
    }
    sendJson(res, 200, { ok: true, data: llmConfigPayload(mod, mod.resolveConfig({}), mod.readOverride()) });
  } catch (e) { llmFail(res, e); }
}

/**
 * POST /api/llm/config —— 保存用户覆盖，落盘 `<成片根>/_llm-api.json`（§八；由模块的 saveOverride 落）。
 *
 * 语义（与前端「留空=不改」对齐）：
 *   · `apiKey` 空串/缺省 ⇒ **不改**；`clearKey:true` ⇒ 清掉已存密钥；
 *   · `baseUrl` / `model` / `kind` / `path` / `extract` 空串 ⇒ **删掉该项覆盖**（回落到默认）；
 *   · `headers` 值 = 占位符 `••••••` ⇒ 保留原值，空串 ⇒ 删该头；空对象 ⇒ 删 headers 覆盖；
 *   · `timeoutMs` 空 ⇒ 删；否则须在 1000–600000。
 * ★ 删除靠「把值置成 undefined」：模块 saveOverride 是浅合并，JSON 序列化会丢弃 undefined 键。
 * ★ 落盘用模块的 saveOverride（原子写 + 与现有覆盖合并），本文件**不自己读写**那个文件。
 */
async function apiLlmConfigSave(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 200, { ok: false, error: { kind: 'config', message: '请求体不是合法 JSON' } }); }

  try {
    const mod = await loadLlmApi();
    const prev = mod.readOverride();
    const partial = {};
    if (typeof body.profile === 'string' && body.profile.trim()) partial.profile = body.profile.trim();
    for (const k of ['baseUrl', 'model', 'kind', 'path', 'extract']) {
      if (body[k] === undefined) continue;
      const v = String(body[k]).trim();
      partial[k] = v === '' ? undefined : v;
    }
    if (body.timeoutMs !== undefined) {
      if (body.timeoutMs === '' || body.timeoutMs === null) partial.timeoutMs = undefined;
      else {
        const n = Number(body.timeoutMs);
        if (!Number.isFinite(n) || n < 1000 || n > 600000) {
          return sendJson(res, 200, {
            ok: false,
            error: { kind: 'config', message: `请求超时需在 1000–600000 毫秒之间（收到 ${body.timeoutMs}）` },
          });
        }
        partial.timeoutMs = Math.round(n);
      }
    }
    if (body.clearKey === true) partial.apiKey = undefined;
    else if (typeof body.apiKey === 'string' && body.apiKey !== '') partial.apiKey = body.apiKey;
    if (body.headers !== undefined) {
      if (body.headers === null) partial.headers = undefined;
      else if (typeof body.headers === 'object' && !Array.isArray(body.headers)) {
        const h = mergeLlmHeaders(prev.headers, body.headers);
        partial.headers = Object.keys(h).length ? h : undefined;
      } else {
        return sendJson(res, 200, { ok: false, error: { kind: 'config', message: 'headers 必须是对象' } });
      }
    }

    const saved = mod.saveOverride(partial);
    if (!saved || saved.ok !== true) {
      const e = (saved && saved.error) || {};
      return sendJson(res, 200, { ok: false, error: { kind: e.kind || 'config', message: e.message || '保存失败' } });
    }
    sendJson(res, 200, { ok: true, data: llmConfigPayload(mod, mod.resolveConfig({}), mod.readOverride()) });
  } catch (e) { llmFail(res, e); }
}

/**
 * POST /api/llm/validate —— 跑 validate()（可传**临时配置**，不必先保存；§七）。
 * 返回 `{ok:true, data:{ok,profile,steps:{reachable,auth,shape},errors,hint,masked}}`。
 */
async function apiLlmValidate(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 200, { ok: false, error: { kind: 'config', message: '请求体不是合法 JSON' } }); }

  try {
    const mod = await loadLlmApi();
    const r = await mod.validate(buildLlmOpts(body, mod.readOverride().headers));
    sendJson(res, 200, { ok: true, data: r });
  } catch (e) { llmFail(res, e); }
}

/**
 * POST /api/llm/chat —— 跑一次 chat()（面板上的「试一句」；§七）。
 * body 可给 `prompt`（字符串）或 `messages`（数组）；可带临时配置。
 * 返回 `{ok:true, data:{ok:true,text,usage,meta} | {ok:false,error,meta}}`。
 */
async function apiLlmChat(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 200, { ok: false, error: { kind: 'config', message: '请求体不是合法 JSON' } }); }

  try {
    const mod = await loadLlmApi();
    const msgs = (Array.isArray(body.messages) && body.messages.length)
      ? body.messages
      : [{ role: 'user', content: String(body.prompt || '你好，请用一句话回复「pong」。') }];
    const r = await mod.chat(msgs, buildLlmOpts(body, mod.readOverride().headers));
    sendJson(res, 200, { ok: true, data: r });
  } catch (e) { llmFail(res, e); }
}

// ── 路由 ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const p = decodeURIComponent(url.pathname);
  const m = req.method || 'GET';

  try {
    if (p === '/api/run' && m === 'POST') return await apiRun(req, res);
    // GET /api/jobs —— 任务列表 + 队列状态（同步快照）
    if (p === '/api/jobs' && m === 'GET') return sendJson(res, 200, { jobs: jobs.listJobs(), queue: jobs.queueState() });

    // DELETE /api/jobs/:id —— 取消（排队/运行中）或删除（已结束）一条任务，按状态分派
    let mm = /^\/api\/jobs\/([^/]+)$/.exec(p);
    if (mm && m === 'DELETE') {
      // ★ 同一个 DELETE 两种语义，按状态分派（「取消」≠「删除」）：
      //   · 排队中 / 运行中 → 取消（中止那个还在跑的任务）—— 原有语义**不变**；
      //   · 已结束（done/failed/canceled/ended）→ 删除记录（从列表 + index.json 里抹掉）。
      //   对一条已经结束的任务「取消」语义上是错的，用户要的是「清掉这条历史」。
      //   返回形状对齐 apiBriefDelete（lib/briefs.mjs:deleteBrief）。
      const id = mm[1];
      const j = jobs.getSummary(id);
      if (j && (j.status === 'queued' || j.status === 'running')) {
        const r = jobs.cancelJob(id);
        return sendJson(res, r.ok ? 200 : 400, r);
      }
      const r = jobs.deleteJob(id);
      if (!r.ok) return sendJson(res, r.code || 400, { error: r.error });
      return sendJson(res, 200, { ok: true, id: r.id });
    }
    mm = /^\/api\/logs\/([^/]+)$/.exec(p);
    if (mm && m === 'GET') return apiLogs(req, res, mm[1], url);

    if (p === '/api/precheck' && m === 'GET') return apiPrecheck(req, res, url);
    if (p === '/api/eta' && m === 'GET') return apiEta(req, res, url);
    if (p === '/api/env' && m === 'GET') return await apiEnv(req, res, url.searchParams.get('force') === '1', url);
    if (p === '/api/setup/actions' && m === 'GET') return await apiSetupActions(req, res, url);
    if (p === '/api/setup/run' && m === 'POST') return await apiSetupRun(req, res);
    if (p === '/api/demos' && m === 'GET') return apiDemos(req, res);
    if (p === '/api/films' && m === 'GET') return apiFilms(req, res);
    if (p === '/api/console' && m === 'GET') return apiConsole(req, res);
    if (p === '/api/reveal' && m === 'POST') return await apiReveal(req, res);

    mm = /^\/api\/style\/([^/]+)$/.exec(p);
    if (mm && m === 'GET') return apiStyle(req, res, mm[1]);

    mm = /^\/api\/films\/([^/]+)\/([^/]+)$/.exec(p);
    if (mm && m === 'GET') return apiFilmFile(req, res, mm[1], mm[2]);
    if (mm && m === 'HEAD') return apiFilmFile(req, res, mm[1], mm[2]);

    // 文案出片的成片在 dub\ 子目录里（比一级目录深一层）—— 见 apiDubFilmFile 的说明
    mm = /^\/api\/films\/dub\/([^/]+)\/([^/]+)$/.exec(p);
    if (mm && m === 'GET') return apiDubFilmFile(req, res, mm[1], mm[2]);
    if (mm && m === 'HEAD') return apiDubFilmFile(req, res, mm[1], mm[2]);

    // 控制台出片的成片在 _jobs\ 子目录里（同样比一级目录深一层）—— 见 apiJobFilmFile 的说明
    mm = /^\/api\/films\/_jobs\/([^/]+)\/([^/]+)$/.exec(p);
    if (mm && m === 'GET') return apiJobFilmFile(req, res, mm[1], mm[2]);
    if (mm && m === 'HEAD') return apiJobFilmFile(req, res, mm[1], mm[2]);

    // ── 主题工单（顺序要紧：/api/briefs/processable 必须先于 /api/briefs/:id 匹配）──
    if (p === '/api/briefs' && m === 'POST') return await apiBriefCreate(req, res);
    if (p === '/api/briefs' && m === 'GET') return apiBriefList(req, res);
    if (p === '/api/langs' && m === 'GET') return apiLangs(req, res, url);
    if (p === '/api/sizes' && m === 'GET') return apiSizes(req, res);
    if (p === '/api/aspects' && m === 'GET') return apiAspects(req, res, url);
    // ── 声音（顺序要紧：/api/voices/test/audio/<file> 比 /api/voices/test 更具体）──
    if (p === '/api/voices' && m === 'GET') return await apiVoices(req, res, url);
    if (p === '/api/voices/audio' && m === 'GET') return await apiVoiceAudio(req, res, url);
    if (p === '/api/voices/sources' && m === 'GET') return await apiVoiceSources(req, res);
    if (p === '/api/voices/import' && m === 'POST') return await apiVoiceImport(req, res);
    mm = /^\/api\/voices\/test\/audio\/([^/]+)$/.exec(p);
    if (mm && m === 'GET') return apiVoiceTestAudio(req, res, mm[1]);
    if (p === '/api/voices/test' && m === 'POST') return await apiVoiceTest(req, res);
    // ── 文案出片（/api/dub*）──
    if (p === '/api/dub/upload' && m === 'POST') return await apiDubUpload(req, res, url);
    if (p === '/api/dub/preview' && m === 'POST') return await apiDubPreview(req, res);
    if (p === '/api/dub/analyze' && m === 'POST') return await apiDubAnalyze(req, res);
    if (p === '/api/dub/run' && m === 'POST') return await apiDubRun(req, res);
    if (p === '/api/dub/styles' && m === 'GET') return await apiDubStyles(req, res);
    if (p === '/api/dub/sources' && m === 'GET') return apiDubSources(req, res);
    if (p === '/api/dub/source-meta' && m === 'GET') return await apiDubSourceMeta(req, res, url);
    if (p === '/api/briefs/processable' && m === 'GET') return apiBriefProcessable(req, res, url);
    mm = /^\/api\/briefs\/([^/]+)\/run$/.exec(p);
    if (mm && m === 'POST') return await apiBriefRun(req, res, mm[1]);
    mm = /^\/api\/briefs\/([^/]+)$/.exec(p);
    if (mm && m === 'GET') return apiBriefGet(req, res, mm[1]);
    if (mm && m === 'PATCH') return await apiBriefPatch(req, res, mm[1]);
    if (mm && m === 'DELETE') return apiBriefDelete(req, res, mm[1]);

    // ── LLM API 配置（/api/llm/*）—— 面板 + 「试一句」（契约与铁律见文件头说明）──
    if (p === '/api/llm/profiles' && m === 'GET') return await apiLlmProfiles(req, res);
    if (p === '/api/llm/config' && m === 'GET') return await apiLlmConfigGet(req, res, url);
    if (p === '/api/llm/config' && m === 'POST') return await apiLlmConfigSave(req, res);
    if (p === '/api/llm/validate' && m === 'POST') return await apiLlmValidate(req, res);
    if (p === '/api/llm/chat' && m === 'POST') return await apiLlmChat(req, res);

    if (p.startsWith('/api/')) return sendJson(res, 404, { error: `未知接口 ${m} ${p}` });

    return serveStatic(req, res, p);
  } catch (e) {
    if (!res.headersSent) sendJson(res, 500, { error: String(e && e.message || e) });
    else try { res.end(); } catch { /* ignore */ }
  }
});

// 绑定失败的处理策略 —— 两种原因，处理办法**完全不同**：
//
//   EADDRINUSE —— 真被别的进程占了。**不自动换**：换端口会静默起第二个实例，
//                 而用户的本意很可能是「我以为它没在跑」→ 必须让他知道。
//
//   EACCES     —— 端口落在 Windows 的「保留端口范围」里（Hyper-V/WSL 启动时随机圈走若干段）。
//                 ★ 这不是用户的错，而且**这些段每次重启都会变** —— 所以硬编码任何
//                   备用端口（如 17788）迟早也会失败。故这里**自动向后扫描**找第一个可绑的端口，
//                   并把「实际用的是哪个」**显著打出来**（是「换并告知」，不是静默换）。
//
// 实测本机被圈走：7699-7798 / 7899-8698 / 10592-10691 / 50000-50059（默认 7788 正落在第一段）。
//
// ★ 「向后扫到第几个端口」这套**决策**本身抽在 lib/portscan.mjs（scanPort / MAX_SCAN）里 ——
//   纯函数、可单测：真造一个保留段要改系统配置，测试没法复现，所以把绑定 IO 作为参数注入，
//   用假 binder 覆盖 EACCES / EADDRINUSE / 其它错误 / 扫到边界四条分支。这里只负责绑定与报错。

/**
 * 把**实际**监听端口写进两个固定文件（见文件头说明）。
 * 任何一步失败都只记日志、不抛错 —— 固定入口是便利功能，不能反过来把服务搞挂。
 * @returns {{ok:boolean, skipped?:boolean, url:string, failed:string[]}}
 */
function writeEntryFiles(port) {
  const host = ARGV.host === '0.0.0.0' ? '127.0.0.1' : ARGV.host;   // 0.0.0.0 不能当 URL 用
  const url = `http://${host}:${port}`;

  // ★ 测试实例（自己起 server.mjs 的那些 test/*.mjs）一律设 LEMO_CONSOLE_NO_ENTRY_FILES=1 ——
  //   跳过写用户的固定入口文件（见文件头说明）。**未设该变量时下面的行为与以前逐字节一致**。
  const noEntry = process.env.LEMO_CONSOLE_NO_ENTRY_FILES;
  if (noEntry === '1' || noEntry === 'true') {
    console.log('  固定入口写入已跳过（LEMO_CONSOLE_NO_ENTRY_FILES=1）—— 这是测试实例，'
      + '不该覆盖用户的 .console-port / 打开控制台.url');
    return { ok: false, skipped: true, url, failed: [] };
  }

  const failed = [];

  try {
    fs.writeFileSync(PORT_FILE, `${port}\r\n`, 'utf8');
  } catch (e) {
    failed.push(`.console-port（${e.message}）`);
  }

  // Windows 快捷方式格式：普通 INI 文本，双击即用默认浏览器打开 URL。
  // 内容全 ASCII（URL 里只有主机和端口），不涉及编码问题。
  try {
    fs.writeFileSync(URL_FILE,
      '[InternetShortcut]\r\n'
      + `URL=${url}\r\n`
      + 'IconIndex=0\r\n', 'utf8');
  } catch (e) {
    failed.push(`打开控制台.url（${e.message}）`);
  }

  return { ok: failed.length === 0, url, failed };
}

function tryListen(port) {
  return new Promise((resolve) => {
    const onErr = (e) => { server.removeListener('listening', onOk); resolve({ ok: false, code: e.code }); };
    const onOk = () => { server.removeListener('error', onErr); resolve({ ok: true, port }); };
    server.once('error', onErr);
    server.once('listening', onOk);
    server.listen(port, ARGV.host);
  });
}

async function start() {
  const want = ARGV.port;
  // 「绑不上时要不要往后扫」这套决策在 lib/portscan.mjs（纯函数，可单测）。
  // 这里只做两件事：把绑定函数注入进去、把结果翻译成人话日志与退出码。
  const res = await scanPort(want, tryListen);

  if (res.ok) {
    const port = res.port;
    if (port !== want) {
      console.log('');
      console.log(`  ⚠️  默认端口 ${want} 落在 Windows 保留端口段内（Hyper-V/WSL 圈走，系统不允许绑定）。`);
      console.log(`     已自动改用 ${port}。**这些保留段每次重启都会变** —— 想固定请显式指定：`);
      console.log(`       node server.mjs --port <端口>   或设环境变量 LEMO_CONSOLE_PORT`);
      console.log(`     排查保留段：netsh interface ipv4 show excludedportrange protocol=tcp`);
    }
    ARGV.port = port; // 让后续日志与实际端口一致
    console.log(`\n  lemo 控制台已启动 → http://${ARGV.host}:${port}`);
    console.log(`  成片目录 ${CFG.exportDir}`);
    console.log(`  风格目录 ${resolveStylesRoot(CFG.winLib)}`);
    const st = store.storeStatus();
    console.log(st.ready
      ? `  历史落盘 ${st.root}（单任务日志 ≤ ${(st.caps.perJobLogBytes / 1048576).toFixed(0)}MB，总计 ≤ ${(st.caps.totalLogBytes / 1048576).toFixed(0)}MB，最多 ${st.caps.maxPersistJobs} 条）`
      : `  ⚠️ 历史落盘不可用：${st.disabledReason}（任务照常跑，只是重启后看不到历史）`);

    const bs = briefs.briefsStatus();
    console.log(bs.ready
      ? `  主题工单 ${bs.root}（最多 ${bs.caps.maxBriefs} 张 · 只服务 4 个内容驱动风格：${bs.styles.map((s) => s.slug).join(' / ')}）`
      : `  ⚠️ 主题工单不可用：${bs.disabledReason}（其余功能照常）`);

    // 语言版本：清单来自库侧 core/lang/lang.mjs（见 lib/langs.mjs）。读不到库就只认 en，并如实说明。
    console.log(`  语言版本 ${langs.langCodes().join(' / ')}（清单来自 ${langs.langSource}）`
      + (langs.langsRegistryError ? `　⚠️ ${langs.langsRegistryError}` : ''));

    // 输出尺寸：清单来自库侧 core/render/size.mjs（见 lib/sizes.mjs）。默认 9:16，读不到库就只剩默认项。
    console.log(`  输出尺寸 ${sizes.ratioIds().join(' / ')} + 自定义（默认 ${sizes.DEFAULT_RATIO}，清单来自 ${sizes.sizeSource}）`
      + (sizes.sizesRegistryError ? `　⚠️ ${sizes.sizesRegistryError}` : ''));

    // 文案出片：素材与成片都落在 D:\lemo-films\dub（非 C 盘）。
    // 核心工具 dub.mjs 不在时**如实说**（面板上点出片会拿到 503，不是静默失败）。
    {
      const ds = dub.dubStatus();
      console.log(ds.toolReady
        ? `  文案出片 ${ds.root}（素材 ${ds.uploads} 条 · 上限 ${(ds.maxUploadBytes / 1048576).toFixed(0)}MB/条 · 工具 ${ds.tool}）`
        : `  文案出片 ${ds.root}　⚠️ 核心工具还没就绪：${ds.tool}（面板上出片会返回 503）`);
    }

    // 影片构图能力：**读影片源码文本**探测 FILM_META.aspects（影片模块是浏览器 ESM，node 不能 import）。
    // 没声明 = 只支持 16:9（= 没改造过，给别的尺寸会被裁切）—— 出片前会据此给警告（见 lib/aspects.mjs）。
    for (const s of bs.styles) {
      const a = s.aspects || { supported: ['16:9'], declared: false };
      console.log(`  构图能力 ${s.slug}：${a.supported.join(' / ')}`
        + (a.declared ? '' : '（未声明 aspects → 只支持 16:9）'));
    }

    // 固定入口：把**实际**端口落盘，让用户有个不会变的地址（见文件头 PORT_FILE 的说明）
    const entry = writeEntryFiles(port);
    if (entry.ok) {
      console.log(`  固定入口已更新：${PORT_FILE} = ${port} · ${URL_FILE} → ${entry.url}`);
      console.log(`  （双击「打开控制台.url」即可进入；这两个文件退出时**不删**，下次启动覆盖）`);
    } else if (!entry.skipped) {
      // ★ skipped 时 writeEntryFiles 已打印「已跳过」说明 —— 这里不能再打印成功，避免误报。
      console.log(`  ⚠️ 固定入口写入不完整（${entry.failed.join('、')}），不影响使用`);
    }
    console.log(`  Ctrl+C 停止（正在跑的任务会被一起终止）\n`);
    if (ARGV.simulateEnv) {
      console.log(`  ⚠️  演练模式（--simulate-env=${ARGV.simulateEnv}）：/api/env 返回的是**合成**的检测结果，`);
      console.log(`      用来预览首次运行引导。安装按钮仍在，但请勿在演练模式下真的点它。\n`);
    }

    // 自动开浏览器 —— 用**实际**监听端口（可能已被自动后扫改过），
    // 所以这件事必须由服务自己做，不能让启动脚本猜。
    if (ARGV.open) {
      const host = ARGV.host === '0.0.0.0' ? '127.0.0.1' : ARGV.host;
      const url = `http://${host}:${port}`;
      try {
        spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
      } catch (e) {
        console.error(`  （自动打开浏览器失败：${e.message} —— 请手动访问 ${url}）\n`);
      }
    }
    return;
  }

  if (res.reason === 'inuse') {
    console.error(`\n✗ 端口 ${res.port} 已被其它进程占用（EADDRINUSE）。`);
    console.error(`  本服务**不会**自动换端口 —— 换端口会静默起第二个实例，`);
    console.error(`  而你可能只是想确认它有没有在跑。`);
    console.error(`  排查：netstat -ano | findstr :${res.port}   （末列是 PID）`);
    console.error(`  换端口：node server.mjs --port 17788   （或设环境变量 LEMO_CONSOLE_PORT）\n`);
    process.exit(3);
  }

  if (res.reason === 'error') {
    console.error(`\n✗ 无法在 ${ARGV.host}:${res.port} 上启动服务（${res.code || '未知错误'}）。\n`);
    process.exit(3);
  }

  // exhausted：从 want 向后扫满 MAX_SCAN 个（或越过 65535）都绑不上
  console.error(`\n✗ 从 ${want} 向后扫了 ${MAX_SCAN} 个端口都绑不上（都落在 Windows 保留段内）。`);
  console.error(`  请显式指定一个端口：node server.mjs --port <端口>\n`);
  process.exit(3);
}

start();

// ── 启动收敛：上次会话残留的 running 工单 → failed ─────────────
//
// ★ 为什么必须做（见 lib/briefs.mjs:reconcileRunning）：控制台退出时会把 lemo-make 子进程一起收掉，
//   但工单文件里的 status 还写着 running —— 不收敛的话 UI 上会永远挂一张「出片中」的僵尸工单，
//   而且它既不能删（running 不许删）也不能重试。
// ★ 这里能查到任务状态，是因为 lib/jobs.mjs 在 import 时已经把历史读回内存（loadHistory），
//   而上次没跑完的任务会被它标成 'ended'（不是 running）→ 于是这些工单会被正确收敛成 failed。
// ★ 但「标成 ended」把两种情况混成了一种：上次崩溃留下的僵尸 / **另一个还活着的控制台实例正在跑的任务**。
//   多实例共用 .briefs 与 .console 时，后者必须放过 —— 否则第二个实例一启动就把第一个实例正在出片的
//   工单收敛成 failed（实测：A 的任务还在队列里跑，B 一启动工单就变 failed 并挂上「控制台重启」的错误文案）。
//   归属判据见 lib/jobs.mjs:isJobOwnedByLiveConsole（靠任务落盘的 ownerPid + 进程存活探测）。
{
  const stuck = briefs.reconcileRunning((jobId) => {
    if (!jobId) return false;
    const j = jobs.getSummary(jobId);
    if (j && (j.status === 'running' || j.status === 'queued')) return true;
    return jobs.isJobOwnedByLiveConsole(jobId);
  });
  if (stuck.length) console.log(`  主题工单：${stuck.length} 张上次没跑完的 running 工单已改成 failed（可点「重试」）`);
}

// 控制台退出时，把还在跑的任务一起收掉 —— 否则会留下占 GPU 的孤儿进程
let closing = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (closing) process.exit(0);
    closing = true;
    console.log('\n  正在停止…');
    const q = jobs.queueState();
    if (q.running) jobs.cancelJob(q.running.id);
    for (const w of q.waiting) jobs.cancelJob(w.id);
    jobs.flushPersist();     // 别让 500ms 去抖把最后一次状态变化吞掉
    setTimeout(() => process.exit(0), 800).unref?.();
  });
}
