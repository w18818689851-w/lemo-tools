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
import { readStyleIndex, renderMarkdown } from './lib/styles.mjs';
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
async function apiRun(req, res) {
  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }); }

  const slug = body.slug;
  if (typeof slug !== 'string' || !slug.trim()) return sendJson(res, 400, { error: '缺少 slug' });
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return sendJson(res, 400, { error: `slug 含非法字符：${slug}` });

  const opts = Array.isArray(body.opts) ? body.opts : [];
  for (const o of opts) {
    if (typeof o !== 'string') return sendJson(res, 400, { error: 'opts 必须是字符串数组' });
    // 不用 shell（spawn 数组传参），但仍限制形状，避免 UI 传进奇怪的东西
    if (!/^[A-Za-z0-9._\-=/]+$/.test(o)) return sendJson(res, 400, { error: `选项含非法字符：${o}` });
  }
  // 值型选项不能是最后一个 token，否则编排器会以「缺少值」报错；这里提前拦下给更清楚的提示
  const NEEDS_VALUE = ['--fps', '--workers', '--out', '--venc', '--q', '--q-events', '--grain', '--manifest'];
  for (let i = 0; i < opts.length; i++) {
    if (NEEDS_VALUE.includes(opts[i]) && (opts[i + 1] === undefined || opts[i + 1].startsWith('--'))) {
      return sendJson(res, 400, { error: `${opts[i]} 缺少值` });
    }
  }

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
function apiEta(req, res, url) {
  const slugs = url.searchParams.getAll('slug');
  const opts = url.searchParams.getAll('opt');
  if (!slugs.length) return sendJson(res, 400, { error: '缺少 slug' });
  if (slugs.length > 50) return sendJson(res, 400, { error: `一次最多问 50 个 slug（收到 ${slugs.length} 个）` });
  for (const s of slugs) if (!/^[A-Za-z0-9._-]+$/.test(s)) return sendJson(res, 400, { error: `slug 含非法字符：${s}` });
  for (const o of opts) if (!/^[A-Za-z0-9._\-=/]+$/.test(o)) return sendJson(res, 400, { error: `选项含非法字符：${o}` });

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

function apiDemos(req, res) {
  const stylesDir = path.join(CFG.winLib, 'styles');
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
function apiStyle(req, res, slug) {
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return sendJson(res, 400, { error: `slug 含非法字符：${slug}` });

  const root = path.resolve(CFG.winLib, 'styles');
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
  });
}


// ── API: GET /api/films ─────────────────────────────────────
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
  films.sort((a, b) => b.mtime - a.mtime);
  sendJson(res, 200, { films, count: films.length });
}

// ── API: GET /api/films/:slug/:file（支持 Range，能拖进度条）──
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

// ── 路由 ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const p = decodeURIComponent(url.pathname);
  const m = req.method || 'GET';

  try {
    if (p === '/api/run' && m === 'POST') return await apiRun(req, res);
    if (p === '/api/jobs' && m === 'GET') return sendJson(res, 200, { jobs: jobs.listJobs(), queue: jobs.queueState() });

    let mm = /^\/api\/jobs\/([^/]+)$/.exec(p);
    if (mm && m === 'DELETE') {
      const r = jobs.cancelJob(mm[1]);
      return sendJson(res, r.ok ? 200 : 400, r);
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
 * @returns {{ok:boolean, url:string, failed:string[]}}
 */
function writeEntryFiles(port) {
  const host = ARGV.host === '0.0.0.0' ? '127.0.0.1' : ARGV.host;   // 0.0.0.0 不能当 URL 用
  const url = `http://${host}:${port}`;
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
    console.log(`  风格目录 ${path.join(CFG.winLib, 'styles')}`);
    const st = store.storeStatus();
    console.log(st.ready
      ? `  历史落盘 ${st.root}（单任务日志 ≤ ${(st.caps.perJobLogBytes / 1048576).toFixed(0)}MB，总计 ≤ ${(st.caps.totalLogBytes / 1048576).toFixed(0)}MB，最多 ${st.caps.maxPersistJobs} 条）`
      : `  ⚠️ 历史落盘不可用：${st.disabledReason}（任务照常跑，只是重启后看不到历史）`);

    // 固定入口：把**实际**端口落盘，让用户有个不会变的地址（见文件头 PORT_FILE 的说明）
    const entry = writeEntryFiles(port);
    if (entry.ok) {
      console.log(`  固定入口已更新：${PORT_FILE} = ${port} · ${URL_FILE} → ${entry.url}`);
      console.log(`  （双击「打开控制台.url」即可进入；这两个文件退出时**不删**，下次启动覆盖）`);
    } else {
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
