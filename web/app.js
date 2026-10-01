/* lemo 控制台前端 —— 原生 JS，零依赖，零 CDN。
 *
 * ⚠️ 安全：所有动态内容（日志行、风格名、成片名）一律走 textContent / createTextNode。
 *    全文件只有**一处** innerHTML（风格详情侧栏），喂给它的是**服务端已转义**的
 *    markdown HTML（见 lib/styles.mjs：先转义 & < > " ' 再套自己的标签）——
 *    日志与任何用户可控文本绝不走那条路径。
 */
'use strict';

const $ = (id) => document.getElementById(id);

// ── 全局状态 ────────────────────────────────────────────────
const state = {
  styles: [],
  categories: [],    // 服务端解析出的 9 大类；空数组 = 解析失败 → 退回扁平列表
  films: [],
  jobs: [],
  env: null,
  setup: null,       // 首次运行向导的安装计划（来自 /api/setup/actions）
  logJobId: null,
  logJobKind: null,  // 'render' | 'setup' —— 安装任务结束后要重跑环境检测
  es: null,          // 当前 EventSource
  lastEventId: 0,    // 当前日志流已收到的最大序号（SSE 断线续传用；服务端在每条 data 前发 `id:`）
  autoScroll: true,
  maxLogLines: 5000,
  logLineCount: 0,
  filmSort: 'time',
  filmQuery: '',
  collapsed: new Set(),   // 收起的分组 key
  detailSlug: null,
  checked: new Set(),     // 勾选的 slug（第四批 ① 批量入队）
  batchBusy: false,       // 正在批量入队（防重复点击）
};

// ── 小工具 ──────────────────────────────────────────────────
function fmtSize(n) {
  if (!n && n !== 0) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function fmtDur(a, b) {
  if (!a) return '';
  const s = ((b || Date.now()) - a) / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
}
/** 毫秒 → 人话时长（给「预计还需」用；粗到分钟即可，不做假精度）。 */
function fmtMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const s = ms / 1000;
  if (s < 90) return `${Math.round(s)} 秒`;
  const m = s / 60;
  if (m < 60) return `${m < 10 ? m.toFixed(1) : Math.round(m)} 分钟`;
  return `${(m / 60).toFixed(1)} 小时`;
}
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
let toastTimer = null;
function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
}

async function api(path, opts) {
  const r = await fetch(path, opts);
  const txt = await r.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error((data && data.error) || `HTTP ${r.status}`);
  return data;
}

// ── 步骤进度 ────────────────────────────────────────────────
//
// 编排器（lemo-make.mjs）的 step() 打的是 `\n` + 粗体(`[N] 名称`) + `\n`，原文形如：
//     \x1b[1m[3] 导出事件与字幕（Windows 侧，产物回传 WSL）\x1b[0m
// lib/jobs.mjs 只剥掉 ESC 序列、**不动正文**，所以到前端时是纯文本 `[3] 导出事件与字幕（…）`。
// 也就是说：这个标记在剥离 ANSI 之后**依然存在**，前端直接解析即可，不必改 server.mjs。
// （仍然先做一次去 ANSI，纯属防御：万一将来后端改成推原文，这里照样能匹配。）
//
// ★ 关于 M（总步数）：
//   - 实测 lemo-make.mjs 里 step() 共有 7 个调用点（含最后的 `[7] 核验导出`），
//     且**跳过的步骤照样调 step()**（只把标题换成短名 + 一句「（--skip-xxx）」），
//     所以正常情况下 N 是连续 1..7，不会跳号。
//   - 但三种模式会提前结束：--dry-run 在 [1] 之后 exit(0)；--audio-only / --render-only
//     在并行段之后 return。于是按 opts 推出一个「预期总步数」当起点。
//   - 再与「本次实际见到的最大 N」取 max，任何推导失准都会**自动向上校正**，不会溢出。
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
const STEP_RE = /^\[(\d+)\]\s+(\S.*)$/;
const KNOWN_STEPS = 7;

const prog = { curN: 0, maxN: 0, total: KNOWN_STEPS };

function expectedSteps(opts) {
  const o = opts || [];
  if (o.includes('--dry-run')) return 1;                                      // [1] 之后 exit(0)
  if (o.includes('--audio-only') || o.includes('--render-only')) return 5;    // 并行段之后 return
  return KNOWN_STEPS;
}

function resetProgress(opts) {
  prog.curN = 0; prog.maxN = 0;
  prog.total = expectedSteps(opts);
  $('progress').hidden = true;
  const eta = $('progEta');
  if (eta) { eta.hidden = true; eta.textContent = ''; eta.title = ''; }
  $('progFill').className = 'progress-fill';
  $('progFill').style.width = '0';
  $('progCount').className = 'progress-idx';
  $('progCount').textContent = '—';
  $('progStep').textContent = '—';
  $('progState').className = 'progress-state';
  $('progState').textContent = '';
}

function noteStep(n, title) {
  if (!Number.isFinite(n) || n <= 0) return;
  prog.curN = n;
  prog.maxN = Math.max(prog.maxN, n);
  prog.total = Math.max(prog.total, prog.maxN);   // 推导失准也能自校正，绝不出现 N > M

  const box = $('progress');
  box.hidden = false;
  $('progCount').className = 'progress-idx';
  $('progCount').textContent = `${prog.curN}/${prog.total}`;
  $('progStep').textContent = title;
  $('progStep').title = title;
  $('progState').className = 'progress-state running';
  $('progState').textContent = '进行中';

  const fill = $('progFill');
  fill.className = 'progress-fill running';
  // ★ 只填 (N-1)/M —— 步骤内部没有细分进度，编一个「本步 63%」就是造假。
  fill.style.width = `${((prog.curN - 1) / prog.total) * 100}%`;
}

/** 任务结束时定态。没有收到过任何步骤标记（如启动就失败）则隐藏进度条。 */
function finishProgress(status) {
  const box = $('progress');
  const eta = $('progEta');
  if (eta) { eta.hidden = true; eta.textContent = ''; eta.title = ''; }   // 跑完了就别再报「预计还需」
  if (!prog.curN) { box.hidden = true; return; }
  box.hidden = false;

  const fill = $('progFill');
  const idx = $('progCount');
  const st = $('progState');
  fill.className = 'progress-fill';
  idx.className = 'progress-idx';
  st.className = 'progress-state';

  if (status === 'done') {
    fill.classList.add('done');
    fill.style.width = '100%';
    idx.classList.add('done');
    idx.textContent = `${prog.total}/${prog.total}`;
    st.textContent = '已完成';
  } else if (status === 'failed') {
    fill.classList.add('failed');
    idx.classList.add('failed');
    idx.textContent = `${prog.curN}/${prog.total}`;
    st.textContent = '失败';
  } else if (status === 'canceled') {
    fill.classList.add('canceled');
    idx.classList.add('canceled');
    idx.textContent = `${prog.curN}/${prog.total}`;
    st.textContent = '已取消';
  } else if (status === 'ended') {
    // 上次控制台会话留下的历史任务：停在第 N 步，不会再有进展
    fill.classList.add('canceled');
    idx.classList.add('canceled');
    idx.textContent = `${prog.curN}/${prog.total}`;
    st.textContent = '已结束（历史）';
  } else {
    st.textContent = status || '';
  }
}

/** 从一行日志里识别步骤标记；命中就刷新进度条。 */
function detectStep(text) {
  const t = String(text).replace(ANSI_RE, '').trim();
  const m = STEP_RE.exec(t);
  if (m) noteStep(Number(m[1]), m[2].trim());
}

// ── 预计剩余时间（第四批 ②）─────────────────────────────────
//
// ★ 数据全部来自**历史任务的真实起止时间**，服务端算好后挂在 job.eta 上（见 lib/jobs.mjs:etaFor）。
//   前端**不自己推算**，也不做任何插值/平滑 —— 判据只有服务端一处。
// ★ 没有历史 → eta.confidence === 'none' → **什么都不显示**（首次跑一个新风格时不瞎猜）。
// ★ 同一个 slug 不同参数耗时可差好几倍 → 服务端按参数分组；这里把「样本来源」如实标出来：
//   ok = 同参数 ≥2 次；low = 同参数仅 1 次；coarse = 只有其它参数的历史（明说「仅供参考」）。
function updateEta() {
  const box = $('progEta');
  if (!box) return;
  const j = state.jobs.find((x) => x.id === state.logJobId);
  const e = j && j.eta;
  if (!e || e.confidence === 'none' || !Number.isFinite(e.medianMs)) {
    box.hidden = true;
    box.textContent = '';
    box.title = '';
    return;
  }

  const elapsed = j.startedAt ? Date.now() - j.startedAt : 0;
  const rem = e.medianMs - elapsed;
  let label = rem > 0 ? `预计还需 ~${fmtMs(rem)}` : `已超过历史中位（${fmtMs(e.medianMs)}）`;
  if (e.confidence === 'low') label += '（仅 1 次历史）';
  else if (e.confidence === 'coarse') label += '（其它参数的历史，仅供参考）';

  box.hidden = false;
  box.className = 'progress-eta ' + e.confidence;
  box.textContent = label;
  box.title = `历史样本 ${e.n} 次：中位 ${fmtMs(e.medianMs)}，区间 ${fmtMs(e.minMs)}–${fmtMs(e.maxMs)}\n`
    + `本次已跑 ${elapsed > 0 ? fmtMs(elapsed) : '0 秒（还没开始跑）'}　·　分组键「${e.key}」\n`
    + (e.confidence === 'coarse'
      ? '没有同参数的历史样本，这是「其它参数」（如只调音 / 只重渲）的记录，仅供参考。'
      : '同 slug + 同参数分组的历史耗时。');
}

// ── 环境状态条 ──────────────────────────────────────────────
const MARK = { ok: '✓', warn: '!', fail: '✗' };

function renderEnv(data) {
  state.env = data;
  const s = data.summary || { ok: 0, warn: 0, fail: 0, total: 0 };
  const level = s.fail > 0 ? 'fail' : (s.warn > 0 ? 'warn' : 'ok');

  $('envDot').className = 'env-dot ' + level;
  $('envText').textContent = level === 'ok' ? '环境就绪'
    : level === 'warn' ? '环境有告警（不阻断）'
    : '环境有问题（仍可强制启动）';
  $('envSum').textContent = `${s.ok} ok · ${s.warn} warn · ${s.fail} fail`;

  const box = $('envDetail');
  box.textContent = '';

  if (data.drift && data.drift.length) {
    const g = el('div', 'env-group');
    g.appendChild(el('h4', null, '路径漂移自检'));
    for (const d of data.drift) {
      const row = el('div', 'env-item warn');
      row.appendChild(el('span', 'mark', MARK.warn));
      row.appendChild(el('span', 'lbl', d.id));
      row.appendChild(el('span', 'det', d.msg));
      g.appendChild(row);
    }
    box.appendChild(g);
  }

  for (const grp of data.groups || []) {
    const g = el('div', 'env-group');
    g.appendChild(el('h4', null, grp.title));
    for (const it of grp.items) {
      const row = el('div', 'env-item ' + it.status);
      row.appendChild(el('span', 'mark', MARK[it.status] || '?'));
      row.appendChild(el('span', 'lbl', it.label));
      row.appendChild(el('span', 'det', it.detail || ''));
      // ★ 安装按钮的**存在与否**由服务端给的 it.action 决定（判据只在 lib/setup.mjs 一处）。
      //   可自动 → 「安装」按钮；需手动 → 「指引」按钮（跳到上面的引导卡片，不代跑）。
      if (it.action) {
        const b = el('button', 'btn ' + (it.action.kind === 'auto' ? 'primary' : 'ghost') + ' small env-fix-btn',
          it.action.kind === 'auto' ? '安装' : '指引');
        b.dataset.actionId = it.action.id;
        b.title = it.action.title;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (it.action.kind === 'auto') runSetupAction(it.action.id, b);
          else focusSetupItem(it.action.id);
        });
        row.appendChild(b);
      }
      g.appendChild(row);
      if (it.fix) g.appendChild(el('div', 'fix env-item ' + it.status, '↳ ' + it.fix));
    }
    box.appendChild(g);
  }

  const note = el('div', 'env-note',
    `检查时间 ${fmtTime(new Date(data.checkedAt).getTime())}${data.cached ? '（缓存）' : ''}`
    + (data.simulated ? ` · ⚠️ 「演练模式」（合成结果 ${data.simulated}，不是真实检测）` : '')
    + ` · 环境自检是「咨询性」的：fail 不会阻止你启动任务，只做提示。`);
  box.appendChild(note);
}

/** 手动项：把上面的引导卡片滚到眼前并高亮那一条（控制台不代跑，只指路）。 */
function focusSetupItem(actionId) {
  const card = $('setupCard');
  card.hidden = false;
  const hit = [...$('setupList').querySelectorAll('.setup-item')]
    .find((n) => n.dataset.actionId === actionId);
  if (hit) {
    hit.scrollIntoView({ behavior: 'smooth', block: 'center' });
    hit.classList.add('flash');
    setTimeout(() => hit.classList.remove('flash'), 1600);
  } else {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function loadEnv(force) {
  $('envText').textContent = '环境检测中…';
  $('envDot').className = 'env-dot';
  try {
    const d = await api('/api/env' + (force ? `?force=1${simQuery('&')}` : simQuery('?')));
    renderEnv(d);
  } catch (e) {
    $('envDot').className = 'env-dot fail';
    $('envText').textContent = '环境检测失败：' + e.message;
  }
}

// ── 首次运行向导：把「环境有问题」变成「点一下就装」─────────────────
//
// ★ 判据只有一处：该装什么、哪些能自动装，全部来自服务端 /api/setup/actions
//   （它内部就是 lib/setup.mjs 的 planActions(envResult)）。前端不重新推导、不硬编码动作名 ——
//   否则 env.mjs / setup.mjs 一改，UI 就开始说假话。
// ★ 演练模式：URL 带 ?simulate=clean|bare|partial|ready 时服务端返回**合成**的检测结果，
//   于是这台已经 12/12 ok 的机器也能看到首次运行引导长什么样（只影响显示，不会真的安装）。
// ★ 不阻塞：本卡片只是引导。环境有 fail 时「开始生成」照样可用 —— 那是 env.mjs 的既定定位。

const SIM = new URLSearchParams(location.search).get('simulate') || '';
const simQuery = (sep) => (SIM ? `${sep}simulate=${encodeURIComponent(SIM)}` : '');

const ACTION_BADGE = { auto: '可自动', manual: '需手动' };

function actionCard(a) {
  const card = el('div', 'setup-item ' + a.kind + (a.status === 'fail' ? ' urgent' : ''));
  card.dataset.actionId = a.id;

  const head = el('div', 'setup-item-head');
  head.appendChild(el('span', 'setup-badge ' + a.kind, ACTION_BADGE[a.kind] || a.kind));
  head.appendChild(el('span', 'setup-title', a.title));
  head.appendChild(el('span', 'setup-why', a.why));
  if (a.estBytes) head.appendChild(el('span', 'setup-size', `约 ${fmtSize(a.estBytes)}`));
  card.appendChild(head);

  if (a.impact) card.appendChild(el('div', 'setup-impact', '影响：' + a.impact));

  if (a.kind === 'auto') {
    const body = el('div', 'setup-steps');
    for (const s of a.steps) {
      const li = el('div', 'setup-step');
      li.appendChild(el('span', 'setup-step-lbl', s.label));
      li.appendChild(el('span', 'setup-step-meta', `超时 ${Math.round((s.timeoutMs || 0) / 60000)} 分钟`));
      body.appendChild(li);
    }
    card.appendChild(body);

    const foot = el('div', 'setup-foot');
    const btn = el('button', 'btn primary small', '安装');
    btn.dataset.actionId = a.id;                       // 给无头测试/脚本用
    btn.addEventListener('click', () => runSetupAction(a.id, btn));
    foot.appendChild(btn);
    if (a.fixHint) foot.appendChild(el('span', 'setup-hint', 'env 提示：' + a.fixHint));
    card.appendChild(foot);
  } else {
    const body = el('div', 'setup-steps manual');
    body.appendChild(el('div', 'setup-manual-note', a.manual.note));
    for (const s of a.manual.steps) body.appendChild(el('div', 'setup-step', s));
    for (const l of a.manual.links || []) {
      const line = el('div', 'setup-step');
      // ⚠️ 链接一律用 href 属性赋值 + noopener，绝不 innerHTML
      const link = el('a', 'setup-link', l.label);
      link.href = l.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      line.appendChild(link);
      body.appendChild(line);
    }
    card.appendChild(body);
  }
  return card;
}

function renderSetup(data) {
  state.setup = data;
  const card = $('setupCard');
  const list = $('setupList');
  const actions = (data && data.actions) || [];

  if (!actions.length) {
    card.hidden = true;
    return;
  }

  card.hidden = false;
  list.textContent = '';
  $('setupCount').textContent = `${actions.length} 项待处理`;
  $('setupSim').hidden = !data.simulated;
  $('setupSim').textContent = data.simulated ? `演练：${data.simulated}` : '';

  const nAuto = actions.filter((a) => a.kind === 'auto').length;
  const nManual = actions.length - nAuto;
  $('setupIntro').textContent =
    `环境检测发现 ${data.summary.fail} 个 fail、${data.summary.warn} 个 warn。`
    + `其中 ${nAuto} 项控制台可以替你装（点「安装」，在后台跑，日志在下面「实时日志」里看）；`
    + `${nManual} 项「必须你手动做」（装 WSL 发行版要重启、装 Windows ffmpeg 二进制、装显卡驱动这类，`
    + `控制台代劳只会把事情搞坏）。装完会自动重新检测。`
    + `（提醒：环境自检是咨询性的，有问题也「不阻止」你启动任务。）`;

  for (const a of actions) list.appendChild(actionCard(a));

  const autoBtn = $('btnSetupAuto');
  autoBtn.disabled = nAuto === 0;
  autoBtn.title = nAuto ? `按顺序安装这 ${nAuto} 项（后台串行执行）` : '没有可自动安装的项';
}

async function loadSetup() {
  try {
    const d = await api('/api/setup/actions' + simQuery('?'));
    renderSetup(d);
  } catch (e) {
    $('setupCard').hidden = true;
    console.warn('读取安装计划失败（不阻断任何东西）：', e);
  }
}

/** 执行一个安装动作：入队后台任务 → 把日志接到「实时日志」面板。 */
async function runSetupAction(actionId, btn) {
  if (SIM) { toast(`演练模式（${SIM}）下不会真的安装。去掉 URL 里的 ?simulate= 再试。`, true); return; }
  if (btn) btn.disabled = true;
  try {
    const r = await api('/api/setup/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId }),
    });
    if (r.skipped) { toast(r.reason || '已就绪，跳过'); await refreshAfterSetup(); return; }
    if (r.reused) toast('这个动作已经在队列里了，直接看日志');
    else toast(`已入队安装任务：${r.job.title || actionId}`);
    await loadJobs();
    attachLog(r.job.id, []);
  } catch (e) {
    toast('安装启动失败：' + e.message, true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function refreshAfterSetup() {
  await loadEnv(true);
  await loadSetup();
}

/** 一键安装所有「可自动」项 —— 串行入队（服务端队列本来就是串行的）。 */
async function installAllAuto() {
  if (SIM) { toast(`演练模式（${SIM}）下不会真的安装。`, true); return; }
  const actions = (state.setup && state.setup.actions) || [];
  const autos = actions.filter((a) => a.kind === 'auto');
  if (!autos.length) { toast('没有可自动安装的项'); return; }
  const btn = $('btnSetupAuto');
  btn.disabled = true;
  let first = null;
  try {
    for (const a of autos) {
      try {
        const r = await api('/api/setup/run', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionId: a.id }),
        });
        if (r.job && !first) first = r.job.id;
      } catch (e) {
        toast(`${a.title} 入队失败：${e.message}`, true);
      }
    }
    toast(`已入队 ${autos.length} 个安装任务（串行执行，看「实时日志」）`);
    await loadJobs();
    if (first) attachLog(first, []);
  } finally {
    btn.disabled = false;
  }
}

// ── 风格列表（按 9 大类分组）─────────────────────────────────
//
// ★ 分类信息**全部来自 /api/demos**（服务端用 lib/styles.mjs 解析 styles/README.md）。
//   前端不解析 README、也不硬编码任何分类名 —— 判据只有一处，不会漂移。
// ★ state.categories 为空 = 服务端解析失败/README 缺失 → 自动退回**扁平列表**，
//   风格一个都不会少（这是硬要求：降级不能让列表变空）。
function filmOf(slug) {
  return state.films.find((f) => f.slug === slug) || null;
}

function styleLabel(s) {
  return s.nameCn || s.slug;                    // 中文名优先
}

function matches(s, q) {
  if (!q) return true;
  return (s.slug || '').toLowerCase().includes(q)
    || (s.nameCn || '').toLowerCase().includes(q)
    || (s.nameEn || '').toLowerCase().includes(q)
    || (s.desc || '').toLowerCase().includes(q);
}

/** 一个风格条目。点击 = 选中（沿用第一批的行为）；「详情」按钮 = 开侧栏；
 *  左侧复选框 = 勾选（只服务批量入队，**不改表单里的当前风格**）。 */
function styleItemNode(s, q) {
  const item = el('div', 'style-item');
  item.dataset.slug = s.slug;
  item.title = [styleLabel(s), s.nameEn, s.slug].filter(Boolean).join(' · ') + (s.desc ? `\n${s.desc}` : '');

  const cb = el('input', 'si-check');
  cb.type = 'checkbox';
  cb.checked = state.checked.has(s.slug);
  cb.dataset.slug = s.slug;
  cb.title = `勾选 ${s.slug}（用于批量入队）`;
  cb.setAttribute('aria-label', `勾选 ${s.slug} 用于批量入队`);
  cb.addEventListener('click', (e) => e.stopPropagation());   // 别顺带把表单风格也改了
  cb.addEventListener('change', () => {
    if (cb.checked) state.checked.add(s.slug);
    else state.checked.delete(s.slug);
    updateBatchBar();
  });
  item.appendChild(cb);

  const main = el('div', 'si-main');
  main.appendChild(el('div', 'si-name', styleLabel(s)));
  main.appendChild(el('div', 'si-sub', s.slug));
  item.appendChild(main);

  if (!s.hasDemo) item.appendChild(el('span', 'nodemo', '无 demo'));
  else if (s.film || filmOf(s.slug)) item.appendChild(el('span', 'badge', '已出片'));

  const info = el('button', 'si-info', '详情');
  info.title = `查看 ${s.slug} 的风格规范与示例`;
  info.addEventListener('click', (e) => { e.stopPropagation(); openDetail(s.slug); });
  item.appendChild(info);

  item.addEventListener('click', () => {
    selectStyle(s.slug);
    markActiveStyle();
    $('sidebar').classList.remove('open');
  });
  if (q) markHit(item, q, s);
  return item;
}

/** 搜索命中时把匹配片段高亮（纯 DOM 拼接，不用 innerHTML）。 */
function markHit(item, q, s) {
  for (const key of ['nameCn', 'slug']) {
    const v = (s[key] || '');
    const idx = v.toLowerCase().indexOf(q);
    if (idx < 0) continue;
    const node = item.querySelector(key === 'slug' ? '.si-sub' : '.si-name');
    if (!node) continue;
    node.textContent = '';
    node.appendChild(document.createTextNode(v.slice(0, idx)));
    node.appendChild(el('mark', 'hit', v.slice(idx, idx + q.length)));
    node.appendChild(document.createTextNode(v.slice(idx + q.length)));
    return;
  }
}

function selectStyle(slug) {
  $('fSlug').value = slug;
  syncPreview();
}

function markActiveStyle() {
  const cur = $('fSlug').value.trim();
  for (const n of $('styleList').querySelectorAll('.style-item')) {
    n.classList.toggle('active', n.dataset.slug === cur);
  }
}

/** 渲染风格列表（任何一条路径走完都要同步「已选 N 个」—— 所以包一层）。 */
function renderStyles(filter) {
  renderStylesInner(filter);
  updateBatchBar();
}

function renderStylesInner(filter) {
  const q = (filter || '').trim().toLowerCase();
  const list = $('styleList');
  list.textContent = '';

  const shown = state.styles.filter((s) => matches(s, q));
  const active = $('fSlug').value.trim();

  if (!shown.length) {
    list.appendChild(el('div', 'style-empty',
      state.styles.length ? '没有匹配的风格' : '风格列表为空（检查 D:\\lemo-opuscar\\styles）'));
    $('styleCount').textContent = `${shown.length}/${state.styles.length}`;
    return;
  }

  // 无分类信息 → 扁平列表（降级路径）
  if (!state.categories.length) {
    for (const s of shown) list.appendChild(styleItemNode(s, q));
    $('styleCount').textContent = `${shown.length}/${state.styles.length}`;
    markActiveStyle();
    return;
  }

  // 有分类 → 按服务端给的**顺序**分组；README 里没写到的 slug 落到「未归类」
  const groups = state.categories.map((c) => ({
    key: c.key, cn: c.cn, en: c.en,
    items: shown.filter((s) => s.category === c.key),
  }));
  const rest = shown.filter((s) => !s.category);
  if (rest.length) groups.push({ key: '__rest__', cn: '未归类', en: 'Uncategorized', items: rest });

  let groupsShown = 0;
  for (const g of groups) {
    if (!g.items.length) continue;          // 整组被过滤掉 → 该组隐藏
    groupsShown++;
    // 搜索时强制展开（否则「搜到了却看不见」）
    const collapsed = !q && state.collapsed.has(g.key);

    const box = el('div', 'style-group' + (collapsed ? ' collapsed' : ''));
    const head = el('div', 'style-group-head');
    head.appendChild(el('span', 'caret', collapsed ? '▸' : '▾'));
    head.appendChild(el('span', 'gname', g.cn));                 // 组头中文名
    head.appendChild(el('span', 'gcount', `(${g.items.length})`));
    head.appendChild(el('span', 'gen', g.en));
    head.title = `${g.cn} · ${g.en}（点击${collapsed ? '展开' : '收起'}）`;
    head.addEventListener('click', () => {
      if (state.collapsed.has(g.key)) state.collapsed.delete(g.key);
      else state.collapsed.add(g.key);
      renderStyles($('search').value);
    });
    box.appendChild(head);

    const body = el('div', 'style-group-body');
    body.hidden = collapsed;
    for (const s of g.items) body.appendChild(styleItemNode(s, q));
    box.appendChild(body);
    list.appendChild(box);
  }

  if (!groupsShown) list.appendChild(el('div', 'style-empty', '没有匹配的风格'));
  $('styleCount').textContent = `${shown.length}/${state.styles.length} · ${groupsShown} 组`;
  markActiveStyle();
}

// ── 批量入队（第四批 ①）─────────────────────────────────────
//
// 问题：一次只能提交一个任务。「把这 5 个风格都跑一遍」只能手动点 5 次并等着。
//
// ★ 队列本来就是**串行**的（GPU 只有一块，lib/jobs.mjs 的全局串行队列），所以「批量」不需要
//   任何新的队列语义 —— 就是连着调 N 次 POST /api/run。服务端只多存一个批次标记。
// ★ 入队前给确认：列出将按顺序跑哪几个、预计总耗时（来自 /api/eta，历史真实耗时；没历史就
//   如实说「不估时」）。
// ★ 被并发锁占用的风格**不是硬拦截**：判据来自服务端 /api/precheck（与编排器逐字对齐），
//   由用户在弹层里选「跳过这几个」还是「仍然全部排队」。
// ★ 绝不删锁（那是编排器的接管逻辑）。

function updateBatchBar() {
  const n = state.checked.size;
  $('batchCount').textContent = `已选 ${n} 个`;
  $('batchCount').classList.toggle('has', n > 0);
  $('btnBatchQueue').disabled = n === 0 || state.batchBusy;
  $('btnBatchClear').disabled = n === 0 || state.batchBusy;
}

/** 勾选的 slug，**按列表里的显示顺序**（= state.styles 的顺序）—— 入队顺序可预期。 */
function checkedSlugs() {
  return state.styles.filter((s) => state.checked.has(s.slug)).map((s) => s.slug);
}

function newBatchId() {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * 一条估计值 → 给用户看的话 + tooltip。
 * ★ 宁可粗糙也不编造：'none' 就直说「无历史，不估时」；'coarse' 明确标注是**其它参数**的历史。
 */
function etaInfo(e) {
  if (!e || e.confidence === 'none' || !Number.isFinite(e.medianMs)) {
    return { text: '无历史，不估时', cls: 'none', title: '这个风格还没有「跑完且成功」的记录 —— 控制台不猜耗时。' };
  }
  const span = `区间 ${fmtMs(e.minMs)}–${fmtMs(e.maxMs)}`;
  const base = `预计 ~${fmtMs(e.medianMs)}`;
  const title =
    `历史样本 ${e.n} 次（同 slug + 同参数分组）：中位 ${fmtMs(e.medianMs)}，${span}\n`
    + `分组键「${e.key}」（按 --dry-run / --audio-only / --render-only / --skip-render / --skip-sync 分组；`
    + '未按 fps / workers / venc 分组，同一组内这些差异体现不到估计里）';
  if (e.confidence === 'ok') return { text: base, cls: 'ok', title };
  if (e.confidence === 'low') return { text: `${base}（仅 1 次历史）`, cls: 'low', title };
  return {
    text: `${base}（其它参数的历史，仅供参考）`,
    cls: 'coarse',
    title: `没有「同参数」的历史样本；下面是该风格「其它参数」的 ${e.n} 次记录：`
      + `中位 ${fmtMs(e.medianMs)}，${span}\n不同参数（如只调音 vs 全跑）耗时可差好几倍 —— 这只是粗估。`,
  };
}

async function openBatchConfirm() {
  const slugs = checkedSlugs();
  if (!slugs.length) { toast('先在左侧勾选要批量跑的风格', true); return; }
  const { opts } = buildOpts();

  const modal = $('batchModal');
  const body = $('batchBody');
  const foot = $('batchFoot');
  body.textContent = '';
  foot.textContent = '';
  modal.hidden = false;
  body.appendChild(el('div', 'modal-loading', `正在读取 ${slugs.length} 个风格的历史耗时与并发预检…`));

  // 估时与预检并行。★ 任一失败都**不阻断**批量入队 —— 少一条提示，不该变成新的故障点。
  const qs = slugs.map((s) => 'slug=' + encodeURIComponent(s)).join('&')
    + opts.map((o) => '&opt=' + encodeURIComponent(o)).join('');
  const [etaRes, lockRes] = await Promise.all([
    api('/api/eta?' + qs).catch((e) => { console.warn('取历史耗时失败（不阻断）：', e); return null; }),
    Promise.all(slugs.map((s) => api('/api/precheck?slug=' + encodeURIComponent(s)).catch(() => null))),
  ]);

  const etaBySlug = new Map(((etaRes && etaRes.items) || []).map((x) => [x.slug, x]));
  const locked = [];
  for (let i = 0; i < slugs.length; i++) {
    const pre = lockRes[i];
    if (pre && pre.locked) locked.push({ slug: slugs[i], pre });
  }
  renderBatchModal({ slugs, opts, etaBySlug, locked, etaRes });
}

function closeBatchModal() {
  $('batchModal').hidden = true;
  $('batchBody').textContent = '';
  $('batchFoot').textContent = '';
}

function renderBatchModal({ slugs, opts, etaBySlug, locked, etaRes }) {
  const body = $('batchBody');
  const foot = $('batchFoot');
  body.textContent = '';
  foot.textContent = '';

  body.appendChild(el('div', 'modal-lead',
    `将按顺序跑 ${slugs.length} 个（控制台队列是「串行」的：一次只跑一个，跑完自动接下一个）：`));

  let totalMs = 0;
  let unknown = 0;
  const list = el('div', 'batch-list');
  slugs.forEach((slug, i) => {
    const row = el('div', 'batch-row');
    row.appendChild(el('span', 'bi', String(i + 1)));
    row.appendChild(el('span', 'bslug', slug));
    const info = etaInfo(etaBySlug.get(slug));
    const e = etaBySlug.get(slug);
    if (e && Number.isFinite(e.medianMs)) totalMs += e.medianMs; else unknown++;
    const tag = el('span', 'beta ' + info.cls, info.text);
    tag.title = info.title;
    row.appendChild(tag);
    list.appendChild(row);
  });
  body.appendChild(list);

  const sum = el('div', 'batch-sum');
  const totalTxt = totalMs > 0
    ? `预计总耗时 ~${fmtMs(totalMs)}${unknown ? `（另有 ${unknown} 个无历史，未计入）` : ''}`
    : '预计总耗时：无历史数据，不估时';
  sum.appendChild(el('span', 'bsum-strong', totalTxt));
  sum.title = '总耗时 = 各风格历史中位数之和（串行队列）。历史缺失的不计入，因此可能偏小。';
  body.appendChild(sum);

  body.appendChild(el('div', 'batch-note',
    `参数：${opts.length ? opts.join(' ') : '（默认，全跑）'}　·　每个任务都会带上批次标记，任务列表里能看出它们属于同一批。`));

  // ── 并发锁（可选分支）──
  if (locked.length) {
    const w = el('div', 'batch-lock');
    w.appendChild(el('div', 'bl-title', `⚠️ 有 ${locked.length} 个风格当前被占用`));
    for (const { slug, pre } of locked) {
      w.appendChild(el('div', 'bl-row',
        `${slug} —— ${pre.message || '已有 lemo-make 在跑同一个 demo'}`));
      w.appendChild(el('div', 'bl-sub',
        `锁文件 ${pre.lockPath}　·　pid ${pre.pid ?? '?'}（存活：${pre.alive ? '是' : '否'}）　·　锁龄 ${pre.lockAgeSec} 秒`));
    }
    w.appendChild(el('div', 'bl-sub',
      '并发跑不会让控制台崩，但两边往同一批文件写，mux 交错写会产出「损坏的成片」。建议跳过，等它们跑完再单独补。'));
    body.appendChild(w);
  }

  // ── 底部按钮 ──
  const cancel = el('button', 'btn ghost', '取消');
  cancel.addEventListener('click', closeBatchModal);
  foot.appendChild(cancel);

  if (locked.length) {
    const skip = el('button', 'btn primary', `跳过被占用的 ${locked.length} 个，其余入队`);
    skip.id = 'btnBatchGo';
    skip.addEventListener('click', () => {
      const set = new Set(locked.map((x) => x.slug));
      const keep = slugs.filter((s) => !set.has(s));
      if (!keep.length) { toast('跳过后没有可入队的风格了', true); return; }
      runBatch(keep, opts);
    });
    foot.appendChild(skip);
  }

  const go = el('button', locked.length ? 'btn danger' : 'btn primary',
    locked.length ? `仍然全部排队（${slugs.length} 个，有风险）` : `确认入队（${slugs.length} 个）`);
  go.id = locked.length ? 'btnBatchGoRisk' : 'btnBatchGo';
  go.addEventListener('click', () => runBatch(slugs, opts));
  foot.appendChild(go);

  if (etaRes && etaRes.phaseKey) {
    body.appendChild(el('div', 'batch-note',
      `估时分组键「${etaRes.phaseKey}」—— 只有同 slug 且同分组键的历史样本才会被采用。`));
  }
}

/** 真正入队：逐个 POST /api/run（串行队列，天然按顺序跑）。 */
async function runBatch(slugs, opts) {
  if (state.batchBusy) return;
  state.batchBusy = true;
  updateBatchBar();
  const total = slugs.length;
  const batchId = newBatchId();
  let first = null;
  const fails = [];
  try {
    for (let i = 0; i < total; i++) {
      try {
        const r = await api('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: slugs[i], opts, batchId, batchIndex: i + 1, batchTotal: total }),
        });
        if (!first && r && r.job) first = r.job.id;
      } catch (e) {
        fails.push(`${slugs[i]}（${e.message}）`);
      }
    }
  } finally {
    state.batchBusy = false;
  }

  closeBatchModal();
  state.checked.clear();
  renderStyles($('search').value);
  await loadJobs();
  if (first) attachLog(first, opts);

  if (fails.length) toast(`已入队 ${total - fails.length}/${total}；失败：${fails.join('、')}`, true);
  else toast(`已入队 ${total} 个（同一批次 ${batchId}，按顺序执行）`);
}

// ── 风格详情侧栏（STYLE.md / DEMO.md）───────────────────────
//
// ⚠️ 这里是全文件**唯一**的 innerHTML：内容来自 /api/style/:slug，服务端已经
//    「先转义 & < > \" ' → 再套自己的标签」（lib/styles.mjs），md 里的原始 HTML
//    不可能穿过这一层。日志等用户可控文本永远走 textContent，不经过这里。
function detailSection(title, sub, html) {
  const sec = el('section', 'md-section');
  const h = el('div', 'md-section-head');
  h.appendChild(el('span', 'md-section-title', title));
  h.appendChild(el('span', 'md-section-sub', sub));
  sec.appendChild(h);
  const body = el('div', 'md');
  if (html) body.innerHTML = html;                                  // ← 已转义的 HTML
  else body.appendChild(el('div', 'empty', '（没有这个文件）'));
  sec.appendChild(body);
  return sec;
}

async function openDetail(slug) {
  const drawer = $('detailDrawer');
  const body = $('detailBody');
  state.detailSlug = slug;
  drawer.hidden = false;
  body.textContent = '';
  body.appendChild(el('div', 'detail-loading', '正在读取 ' + slug + ' 的 STYLE.md / DEMO.md…'));

  const s = state.styles.find((x) => x.slug === slug);
  $('detailName').textContent = s ? styleLabel(s) : slug;
  $('detailSub').textContent = [s && s.nameEn, slug, s && s.category ? categoryCn(s.category) : '']
    .filter(Boolean).join(' · ');
  $('detailHint').textContent = `node lemo-make.mjs ${slug}`;

  let d;
  try {
    d = await api('/api/style/' + encodeURIComponent(slug));
  } catch (e) {
    body.textContent = '';
    body.appendChild(el('div', 'empty', '读取失败：' + e.message));
    return;
  }
  if (state.detailSlug !== slug) return;      // 期间又点了别的风格 → 丢弃这次结果

  $('detailName').textContent = d.nameCn || (s ? styleLabel(s) : slug);
  $('detailSub').textContent = [d.nameEn, slug, d.category ? categoryCn(d.category) : ''].filter(Boolean).join(' · ');

  body.textContent = '';
  body.appendChild(detailSection('风格规范 STYLE.md', '怎么画 / 怎么动 / 怎么调色', d.styleHtml));
  body.appendChild(detailSection('示例 DEMO.md', '一个已完成的例子（不是模板）', d.demoHtml));
  body.scrollTop = 0;
}

function categoryCn(key) {
  const c = state.categories.find((x) => x.key === key);
  return c ? c.cn : key;
}

function closeDetail() {
  $('detailDrawer').hidden = true;
  state.detailSlug = null;
}


// ── 启动表单 ────────────────────────────────────────────────
function buildOpts() {
  const o = [];
  const slug = $('fSlug').value.trim();
  const fps = $('fFps').value.trim();
  const workers = $('fWorkers').value.trim();
  const venc = $('fVenc').value;
  const q = $('fQ').value.trim();
  const grain = $('fGrain').value.trim();
  const out = $('fOut').value.trim();

  if (fps && fps !== '24') o.push('--fps', fps);
  if (workers && workers !== '6') o.push('--workers', workers);
  if (venc) o.push('--venc', venc);
  if (q) o.push('--q', q);
  if (grain) o.push('--grain', grain);
  if (out) o.push('--out', out);
  if ($('fSkipSync').checked) o.push('--skip-sync');
  if ($('fSkipRender').checked) o.push('--skip-render');
  if ($('fAudioOnly').checked) o.push('--audio-only');
  if ($('fRenderOnly').checked) o.push('--render-only');
  if ($('fDryRun').checked) o.push('--dry-run');
  return { slug, opts: o };
}

function syncPreview() {
  const { slug, opts } = buildOpts();
  const cmd = slug ? `node lemo-make.mjs ${[slug, ...opts].join(' ')}` : '';
  $('cmdPreview').textContent = cmd;
  $('btnCopyCmd').hidden = !cmd;
  refreshPresetHighlight();
  // 参数一变，之前那条并发预检提示就不再对应当前命令了 → 收起来（判据只有服务端一处，不在这里重算）
  const w = $('lockWarn');
  if (w && !w.hidden) { w.hidden = true; w.textContent = ''; }
}

// ── 常用组合预设 ────────────────────────────────────────────
// 点一下**只设置勾选状态**，不直接启动 —— 用户还能在勾完的基础上微调（比如再补 --skip-sync）。
// 勾选状态与某个预设完全一致时该按钮高亮；一旦手动改动对不上了，高亮自动消失。
const CHK_IDS = ['fSkipSync', 'fSkipRender', 'fAudioOnly', 'fRenderOnly', 'fDryRun'];
const PRESETS = [
  { id: 'quick',  set: {} },                                                    // 快速出片：全不勾（走完整 7 步）
  { id: 'audio',  set: { fSkipRender: true, fAudioOnly: true } },               // 只调音：复用已有视频，只重跑音频链路
  { id: 'render', set: { fRenderOnly: true } },                                 // 只重渲：跳过音频
  { id: 'dry',    set: { fDryRun: true } },                                     // 试跑：只打印计划，不真跑
];

function chkSig(set) {
  return CHK_IDS.map((id) => (set && set[id] ? '1' : '0')).join('');
}

function applyPreset(p) {
  for (const id of CHK_IDS) $(id).checked = !!(p.set && p.set[id]);
  syncPreview();
}

function refreshPresetHighlight() {
  const cur = chkSig(Object.fromEntries(CHK_IDS.map((id) => [id, $(id).checked])));
  for (const b of document.querySelectorAll('.preset')) {
    const p = PRESETS.find((x) => x.id === b.dataset.preset);
    b.classList.toggle('active', !!p && chkSig(p.set) === cur);
  }
}

// ── 命令预览：复制到剪贴板 ──────────────────────────────────
async function copyCmd() {
  const text = $('cmdPreview').textContent.trim();
  if (!text) return;
  const btn = $('btnCopyCmd');
  let ok = false;
  // 首选异步剪贴板 API（127.0.0.1 属于安全上下文，可用）
  try { await navigator.clipboard.writeText(text); ok = true; }
  catch {
    // 兜底：非安全上下文 / 权限被拒时用 execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { ok = false; }
  }
  btn.textContent = ok ? '已复制' : '复制失败';
  btn.classList.toggle('copied', ok);
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('copied'); }, 1300);
  if (!ok) toast('复制失败：浏览器拒绝了剪贴板访问，请手动选中复制', true);
}

// ── 启动前并发预检 ──────────────────────────────────────────
//
// ★ 目的：命令行已经在跑同一个 demo 时，编排器的并发锁会让本次启动**直接失败**，
//   而用户只看到一条错误日志 —— 分不清「已经有人在跑」还是「别的问题」。这里提前说清楚。
// ★ 判据全部来自服务端 /api/precheck（与编排器 lemo-make.mjs 逐字对齐），
//   前端**不自己判**：陈旧锁（pid 已死）不报警，免得误报。
// ★ **不是硬拦截**：用户可以点「仍然启动」。控制台也绝不删锁。
function hideLockWarn() {
  const w = $('lockWarn');
  w.hidden = true;
  w.textContent = '';
}

function showLockWarn(pre, slug, opts) {
  const w = $('lockWarn');
  w.textContent = '';
  w.hidden = false;

  w.appendChild(el('div', 'lw-title', '⚠️ 检测到同一个 demo 已经在跑'));
  w.appendChild(el('div', null, pre.message || ''));
  w.appendChild(el('div', 'lw-sub',
    `锁文件：${pre.lockPath}　·　pid ${pre.pid ?? '?'}（存活：${pre.alive ? '是' : '否'}）　·　锁龄 ${pre.lockAgeSec} 秒`));
  if (pre.queuedSame && pre.queuedSame.length) {
    w.appendChild(el('div', 'lw-sub',
      `控制台队列里也有同 slug 的任务：${pre.queuedSame.map((x) => `${x.id}（${STATUS_CN[x.status] || x.status}）`).join('、')}`));
  }
  w.appendChild(el('div', 'lw-sub', '并发跑不会让控制台崩，但成片可能损坏。建议等它结束再跑。'));

  const acts = el('div', 'lw-acts');
  const go = el('button', 'btn danger small', '仍然启动（有风险）');
  go.addEventListener('click', () => { hideLockWarn(); startRun(true); });
  const no = el('button', 'btn ghost small', '取消');
  no.addEventListener('click', hideLockWarn);
  acts.appendChild(go);
  acts.appendChild(no);
  w.appendChild(acts);

  w.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  toast(`⚠️ ${slug} 已有 lemo-make 在跑（pid ${pre.pid ?? '?'}）—— 见下方提示`, true);
}

async function startRun(force) {
  const { slug, opts } = buildOpts();
  if (!slug) { toast('请先选择或输入一个风格', true); $('fSlug').focus(); return; }

  if (!force) {
    hideLockWarn();
    try {
      const pre = await api('/api/precheck?slug=' + encodeURIComponent(slug));
      if (pre && pre.locked) { showLockWarn(pre, slug, opts); return; }
    } catch (e) {
      // 预检本身失败**不阻断启动** —— 它只是提示，不该变成新的故障点
      console.warn('并发预检失败（不阻断启动）：', e);
    }
  } else {
    hideLockWarn();
  }

  const btn = $('btnRun');
  btn.disabled = true;
  try {
    const r = await api('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, opts }),
    });
    toast(`已入队：${slug}（${r.job.status}）`);
    attachLog(r.job.id, r.job.opts);
    await loadJobs();
  } catch (e) {
    toast('启动失败：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ── 日志（SSE）──────────────────────────────────────────────
// 关键字高亮：✗ 错误 / 行首 ! 警告 / MUX_OK 混流成功 / src_frames= 帧数核对
const HL_RE = /(MUX_OK|src_frames=\d+|✗|(?:^|\s)!(?=\s|$))/g;

function highlightInto(parent, text) {
  HL_RE.lastIndex = 0;
  let last = 0, m;
  while ((m = HL_RE.exec(text)) !== null) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    const tok = m[0];
    let cls = 'hl-warn';
    if (tok.indexOf('MUX_OK') >= 0) cls = 'hl-ok';
    else if (tok.indexOf('src_frames') >= 0) cls = 'hl-frame';
    else if (tok.indexOf('✗') >= 0) cls = 'hl-err';
    const span = el('span', cls, tok);
    parent.appendChild(span);
    last = m.index + tok.length;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

function appendLog(rec) {
  const pre = $('log');
  $('logEmpty').hidden = true;

  // 步骤标记只出现在**原始日志行**里，控制台自己补的 meta 行不参与识别
  if (rec.stream !== 'meta') detectStep(rec.line);

  const line = el('span', 'log-line' + (rec.stream === 'stderr' ? ' stderr' : rec.stream === 'meta' ? ' meta' : ''));
  // ⚠️ 逐段 textContent，绝不 innerHTML
  highlightInto(line, rec.line === '' ? ' ' : rec.line);
  line.appendChild(document.createTextNode('\n'));
  pre.appendChild(line);

  state.logLineCount++;
  if (state.logLineCount > state.maxLogLines) {
    const drop = state.logLineCount - state.maxLogLines;
    for (let i = 0; i < drop && pre.firstChild; i++) pre.removeChild(pre.firstChild);
    state.logLineCount = state.maxLogLines;
  }

  if (state.autoScroll) {
    const w = $('logWrap');
    w.scrollTop = w.scrollHeight;
  }
}

function closeStream() {
  if (state.es) { try { state.es.close(); } catch { /* ignore */ } state.es = null; }
}

/**
 * 挂上某个任务的日志流。
 *
 * ★ SSE 断线续传：服务端每条日志都带 `id: <n>`，浏览器 EventSource 会记住并在**自动重连**
 *   时带上 `Last-Event-ID` 头 → 服务端只补发缺失部分。这里额外做两件事：
 *   1. 记录 `state.lastEventId`（来自 ev.lastEventId），以便「手动重新点开同一个仍在跑的任务」
 *      时用 `?lastEventId=` 接着看，而不是把上万行全量重放一遍。
 *   2. 只在**同一个任务且仍在跑**时才续传；已结束的任务重新打开要看到**完整**日志。
 * ★ 不续传时行为与以前完全一致：清屏 + 全量重放。
 */
function attachLog(jobId, opts) {
  const j = state.jobs.find((x) => x.id === jobId);
  const live = !!j && (j.status === 'running' || j.status === 'queued');
  const resume = state.logJobId === jobId && state.lastEventId > 0 && live;

  closeStream();
  state.logJobId = jobId;
  state.logJobKind = j ? (j.kind || 'render') : null;   // 安装任务结束时据此重跑环境检测
  const pre = $('log');

  if (!resume) {
    state.lastEventId = 0;
    state.logLineCount = 0;
    pre.textContent = '';
    resetProgress(opts || (j && j.opts));
  }

  $('logEmpty').hidden = true;   // 已挂上任务：空态让位（任务的第一行日志马上就到）
  $('logJob').textContent = jobId ? `· ${jobId}` : '';
  $('streamState').textContent = resume ? `续传中（从第 ${state.lastEventId + 1} 行起）…` : '连接中…';

  const url = '/api/logs/' + encodeURIComponent(jobId)
    + (resume ? `?lastEventId=${state.lastEventId}` : '');
  const es = new EventSource(url);
  state.es = es;

  es.addEventListener('hello', (ev) => {
    let d = null;
    try { d = JSON.parse(ev.data); } catch { /* ignore */ }
    $('streamState').textContent = d && d.resumed
      ? `已连接（续传：已跳过前 ${d.resumeFrom} 行，共 ${d.lines} 行）`
      : `已连接（含历史日志${d && d.lines ? `，共 ${d.lines} 行` : ''}）`;
  });
  es.onopen = () => { if (!state.lastEventId) $('streamState').textContent = '已连接（含历史日志）'; };

  es.onmessage = (ev) => {
    // 服务端发的 `id:` → 浏览器填到 ev.lastEventId。续传就靠它。
    const n = Number(ev.lastEventId);
    if (Number.isFinite(n) && n > state.lastEventId) state.lastEventId = n;

    let rec;
    try { rec = JSON.parse(ev.data); } catch { return; }
    if (rec.type === 'line') { appendLog(rec); return; }
    if (rec.type === 'gap') {
      // 中间这段已经被内存/磁盘上限裁掉了 —— 如实告知，不假装没丢
      appendLog({ stream: 'meta', line: `[控制台] 中间有 ${rec.dropped} 行日志已被上限裁剪（第 ${rec.from}–${rec.to} 行），无法补发` });
      return;
    }
    if (rec.type === 'end') {
      appendLog({ stream: 'meta', line: `[控制台] 任务状态：${STATUS_CN[rec.status] || rec.status}${rec.exitCode === null ? '' : `（退出码 ${rec.exitCode}）`}` });
      finishProgress(rec.status);
      $('streamState').textContent = `流已结束：${STATUS_CN[rec.status] || rec.status}`;
      closeStream();
      loadJobs();
      loadFilms();
      loadStylesBadges();
      // 安装任务结束 → 环境可能变了，重新检测并重算安装计划（幂等：装好的项会自动消失）
      if (state.logJobKind === 'setup') { state.logJobKind = null; refreshAfterSetup(); }
    }
  };

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      $('streamState').textContent = '连接已关闭';
    } else {
      $('streamState').textContent = `连接中断，重连中…（已收到 ${state.lastEventId} 行，续传不会重放）`;
    }
  };

  updateEta();     // 挂上任务后立刻按历史给一个「预计还需」（无历史则不显示）
}

// ── 任务列表 ────────────────────────────────────────────────
// ended = 上次控制台会话没跑完的任务（重启后从磁盘恢复，见 lib/jobs.mjs:loadHistory）。
// 它不可能是「运行中」—— 那个 lemo-make 子进程已经随控制台一起没了。
const STATUS_CN = { queued: '排队中', running: '运行中', done: '完成', failed: '失败', canceled: '已取消', ended: '已结束' };

function renderJobs() {
  const box = $('jobs');
  box.textContent = '';
  if (!state.jobs.length) {
    const e = el('div', 'empty');
    e.appendChild(el('div', null, '还没有任务。'));
    e.appendChild(el('div', 'empty-sub', '在上面选一个风格 → 点「开始生成」，任务会出现在这里（状态 / 耗时 / 成片），随时可回看日志或取消。'));
    box.appendChild(e);
    return;
  }

  for (const j of state.jobs) {
    const isSetup = j.kind === 'setup';
    const row = el('div', 'job' + (j.id === state.logJobId ? ' active' : '') + (j.restored ? ' restored' : '') + (isSetup ? ' setup-job' : ''));

    row.appendChild(el('span', 'status ' + j.status, STATUS_CN[j.status] || j.status));
    // 批次标记（第四批 ①）：一眼看出这几条是同一批「批量入队」的
    if (j.batchId) {
      const hasIdx = Number.isInteger(j.batchIndex) && Number.isInteger(j.batchTotal);
      const b = el('span', 'jbatch', hasIdx ? `批 ${j.batchIndex}/${j.batchTotal}` : '批');
      b.dataset.batchId = j.batchId;
      b.title = `属于同一批「批量入队」（批次 ${j.batchId}${hasIdx ? `，第 ${j.batchIndex}/${j.batchTotal} 个` : ''}）`
        + '—— 队列是串行的，它们会按顺序一个个跑。';
      row.appendChild(b);
    }
    if (j.restored) {
      const h = el('span', 'jhist', '历史');
      h.title = j.interrupted
        ? '这条记录来自上一次控制台会话，且当时没跑完（控制台被关/被杀）。'
        : '这条记录来自上一次控制台会话，已从磁盘恢复（D:\\lemo-films\\.console）。';
      row.appendChild(h);
    }
    if (isSetup) {
      row.appendChild(el('span', 'jkind', '安装'));
      row.appendChild(el('span', 'jslug', j.title || j.actionId || '安装'));
    } else {
      row.appendChild(el('span', 'jslug', j.slug));
    }
    row.appendChild(el('span', 'jid', j.id));

    const meta = [];
    if (!isSetup && j.opts && j.opts.length) meta.push(j.opts.join(' '));
    if (isSetup && j.actionId) meta.push(j.actionId);
    meta.push(fmtTime(j.createdAt));
    if (j.startedAt) meta.push('耗时 ' + fmtDur(j.startedAt, j.endedAt));
    if (j.exitCode !== null && j.exitCode !== undefined) meta.push('退出码 ' + j.exitCode);
    if (j.lines) meta.push(j.lines + ' 行日志');
    row.appendChild(el('span', 'jmeta', meta.join(' · ')));

    if (j.error) row.appendChild(el('span', 'jmeta', '错误：' + j.error));

    const sp = el('span', 'jspacer');
    row.appendChild(sp);

    if (j.film) {
      const f = el('span', 'jfilm', '▶ ' + j.film);
      f.style.cursor = 'pointer';
      f.addEventListener('click', (e) => { e.stopPropagation(); openPlayer(j.slug, j.film); });
      row.appendChild(f);
    }

    const viewBtn = el('button', 'btn ghost small', '看日志');
    viewBtn.addEventListener('click', (e) => { e.stopPropagation(); attachLog(j.id, j.opts); renderJobs(); });
    row.appendChild(viewBtn);

    if (j.status === 'queued' || j.status === 'running') {
      const c = el('button', 'btn danger small', '取消');
      c.addEventListener('click', async (e) => {
        e.stopPropagation();
        try { await api('/api/jobs/' + encodeURIComponent(j.id), { method: 'DELETE' }); toast('已发送取消'); }
        catch (err) { toast('取消失败：' + err.message, true); }
        loadJobs();
      });
      row.appendChild(c);
    }

    row.addEventListener('click', () => { attachLog(j.id, j.opts); renderJobs(); });
    box.appendChild(row);
  }
}

async function loadJobs() {
  try {
    const d = await api('/api/jobs');
    state.jobs = d.jobs || [];
    renderJobs();
    updateEta();     // 任务列表每 3 秒刷一次 → 「预计还需」跟着走，不用另开定时器
  } catch (e) {
    $('jobs').textContent = '';
    $('jobs').appendChild(el('div', 'empty', '读取任务失败：' + e.message));
  }
}

// ── 成片库（排序 / 筛选 / 重新生成 / 打开目录）───────────────
function sortedFilms() {
  const q = (state.filmQuery || '').trim().toLowerCase();
  const list = state.films.filter((f) => !q
    || (f.slug || '').toLowerCase().includes(q)
    || (f.file || '').toLowerCase().includes(q));
  const s = state.filmSort;
  list.sort((a, b) => {
    if (s === 'size') return b.size - a.size;
    if (s === 'slug') return String(a.slug).localeCompare(String(b.slug)) || b.mtime - a.mtime;
    return b.mtime - a.mtime;                       // 默认：时间，新 → 旧
  });
  return list;
}

function renderFilms() {
  const box = $('films');
  box.textContent = '';
  const shown = sortedFilms();
  $('filmCount').textContent = state.films.length
    ? `${shown.length}/${state.films.length}`
    : '';

  if (!state.films.length) {
    box.appendChild(el('div', 'empty', '还没有成片（D:\\lemo-films 下没有 mp4）。'));
    return;
  }
  if (!shown.length) {
    box.appendChild(el('div', 'empty', '没有匹配的成片。'));
    return;
  }

  for (const f of shown) {
    const s = state.styles.find((x) => x.slug === f.slug);
    const c = el('div', 'film');

    c.appendChild(el('div', 'fslug', s && s.nameCn ? s.nameCn : f.slug));
    c.appendChild(el('div', 'fmeta', `${fmtSize(f.size)} · ${fmtTime(f.mtime)}`));
    c.appendChild(el('div', 'fmeta', f.file));
    if (s && s.nameCn) c.appendChild(el('div', 'fmeta', f.slug));

    const acts = el('div', 'factions');

    const play = el('button', 'btn ghost small', '播放');
    play.addEventListener('click', (e) => { e.stopPropagation(); openPlayer(f.slug, f.file, f.url); });
    acts.appendChild(play);

    const regen = el('button', 'btn ghost small', '重新生成');
    regen.title = '把这个风格和它上次用的参数填回启动表单（不会自动启动）';
    regen.addEventListener('click', (e) => { e.stopPropagation(); regenFilm(f.slug); });
    acts.appendChild(regen);

    const open = el('button', 'btn ghost small', '打开目录');
    open.title = `在资源管理器里打开 D:\\lemo-films\\${f.slug}`;
    open.addEventListener('click', (e) => { e.stopPropagation(); revealDir(f.slug); });
    acts.appendChild(open);

    c.appendChild(acts);
    c.addEventListener('click', () => openPlayer(f.slug, f.file, f.url));
    box.appendChild(c);
  }
}

/** 重新生成：跳到启动表单 → 选中 slug → 预填选项。**绝不自动启动**，等用户确认。 */
function regenFilm(slug) {
  selectStyle(slug);
  const last = state.jobs.find((j) => j.slug === slug);      // state.jobs 是新→旧
  let note = '已选中该风格';
  if (last && Array.isArray(last.opts) && last.opts.length) {
    const r = applyOptsToForm(last.opts);
    note = `已预填上次任务的参数（${r.applied.length} 项）`;
    if (r.skipped.length) note += `；表单不支持、已忽略：${r.skipped.join(' ')}`;
  }
  syncPreview();
  markActiveStyle();

  const card = $('fSlug').closest('.card');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1400);
  }
  $('fSlug').focus();
  toast(`${slug}：${note}。确认后点「开始生成」（不会自动启动）`);
}

/** 把一串 CLI 选项映射回表单；映射不了的**如实返回**，不静默丢弃。 */
function applyOptsToForm(opts) {
  const applied = [];
  const skipped = [];
  for (const id of CHK_IDS) $(id).checked = false;

  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    const val = () => opts[i + 1];
    if (o === '--skip-sync') { $('fSkipSync').checked = true; applied.push(o); }
    else if (o === '--skip-render') { $('fSkipRender').checked = true; applied.push(o); }
    else if (o === '--audio-only') { $('fAudioOnly').checked = true; applied.push(o); }
    else if (o === '--render-only') { $('fRenderOnly').checked = true; applied.push(o); }
    else if (o === '--dry-run') { $('fDryRun').checked = true; applied.push(o); }
    else if (o === '--fps') { $('fFps').value = val(); applied.push(o + ' ' + val()); i++; }
    else if (o === '--workers') { $('fWorkers').value = val(); applied.push(o + ' ' + val()); i++; }
    else if (o === '--venc') { $('fVenc').value = val(); applied.push(o + ' ' + val()); i++; }
    else if (o === '--q') { $('fQ').value = val(); applied.push(o + ' ' + val()); i++; }
    else if (o === '--grain') { $('fGrain').value = val(); applied.push(o + ' ' + val()); i++; }
    else if (o === '--out') { $('fOut').value = val(); applied.push(o + ' ' + val()); i++; }
    else skipped.push(o);
  }
  return { applied, skipped };
}

async function revealDir(slug) {
  try {
    const r = await api('/api/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    toast('已打开目录：' + r.dir);
  } catch (e) {
    toast('打开目录失败：' + e.message, true);
  }
}

async function loadFilms() {
  try {
    const d = await api('/api/films');
    state.films = d.films || [];
    renderFilms();
    renderStyles($('search').value);
  } catch (e) {
    $('films').textContent = '';
    $('films').appendChild(el('div', 'empty', '读取成片失败：' + e.message));
  }
}

function openPlayer(slug, file, url) {
  const v = $('player');
  let src = url;
  if (!src) {
    const parts = String(file).replace(/\\/g, '/').split('/');
    const name = parts[parts.length - 1];
    src = `/api/films/${encodeURIComponent(slug)}/${encodeURIComponent(name)}`;
  }
  v.src = src;
  $('playerTitle').textContent = `${slug} / ${file}`;
  $('playerModal').hidden = false;
  v.play().catch(() => { /* 自动播放被拦是正常的，用户点一下即可 */ });
}
function closePlayer() {
  const v = $('player');
  try { v.pause(); } catch { /* ignore */ }
  v.removeAttribute('src');
  try { v.load(); } catch { /* ignore */ }
  $('playerModal').hidden = true;
}

// ── 风格列表徽标刷新（出片后要更新）────────────────────────
async function loadStylesBadges() {
  try {
    const d = await api('/api/demos');
    state.styles = d.styles || [];
    state.categories = d.categories || [];      // 空 = 服务端解析失败 → renderStyles 自动退回扁平列表
    renderStyles($('search').value);
    const dl = $('styleOptions');
    dl.textContent = '';
    for (const s of state.styles) {
      const o = document.createElement('option');
      o.value = s.slug;                          // 表单里填的永远是 slug（CLI 参数）
      if (s.nameCn) o.label = s.nameCn;          // 下拉里显示中文名，方便找
      dl.appendChild(o);
    }
  } catch (e) { /* 静默：徽标不是关键路径 */ }
}

// ── 主题切换（第四批 ④）─────────────────────────────────────
//
// ★ **默认仍是深色**（开发工具的正确默认，也是前几批一直在用的）。
//   浅色只是「在亮环境里看得清」的可选项，不改任何默认行为。
// ★ 只改 <html data-theme>，颜色全部由 style.css 的 CSS 变量接管 —— JS 不碰任何具体颜色，
//   免得同一套配色写在两处、日后漂移。
// ★ 持久化失败（隐私模式 / localStorage 被禁）**不影响使用**：当次仍能切，只是记不住。
const THEME_KEY = 'lemo-console-theme';

function applyTheme(t) {
  const light = t === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  const btn = $('btnTheme');
  if (btn) {
    btn.textContent = light ? '深色' : '浅色';
    btn.title = light ? '切回深色主题（默认）' : '切换到浅色主题（默认是深色；选择记在本机）';
  }
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* 读不到就用默认 */ }
  applyTheme(saved === 'light' ? 'light' : 'dark');     // ★ 默认深色
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* 记不住就算了 */ }
  toast(next === 'light' ? '已切到浅色主题' : '已切回深色主题（默认）');
}

// ── 快捷键面板（可发现入口，不是藏起来的功能）────────────────
function openHelp() { $('helpModal').hidden = false; }
function closeHelp() { $('helpModal').hidden = true; }

/** 焦点是不是在「能打字」的地方 —— 决定 `/` 该不该抢焦点。 */
function isTyping(node) {
  // ★ 真实键盘事件的目标就是**当前聚焦元素**；但脚本 dispatch 到 document 时 e.target 是 document
  //   （无头测试就是这么按键的）。这两种情况都该按「当前聚焦在哪」来判，所以补一个回退。
  const el = (node && node !== document) ? node : document.activeElement;
  if (!el) return false;
  const tag = (el.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

function focusSearch() {
  $('sidebar').classList.add('open');    // 窄屏下侧栏可能是收起的
  const s = $('search');
  s.focus();
  s.select?.();
}

// ── 事件绑定 ────────────────────────────────────────────────
function bind() {
  // ⚠️ 必须包一层：直接传 startRun 会把 MouseEvent 当成 force 参数（真值）→ 预检被跳过
  $('btnRun').addEventListener('click', () => startRun(false));
  $('btnRefreshJobs').addEventListener('click', loadJobs);
  $('btnRefreshFilms').addEventListener('click', () => { loadFilms(); });
  $('btnRefreshEnv').addEventListener('click', () => loadEnv(true));
  // 首次运行向导
  $('btnSetupRefresh').addEventListener('click', () => refreshAfterSetup());
  $('btnSetupAuto').addEventListener('click', installAllAuto);
  $('btnSimulate').addEventListener('click', () => {
    // 演练模式：把 ?simulate= 写进 URL 再刷新 —— 于是「这台已就绪的机器」也能看到首次运行引导。
    const u = new URL(location.href);
    const cur = u.searchParams.get('simulate');
    if (!cur) { u.searchParams.set('simulate', 'bare'); toast('演练模式：假装这是一台干净机器（不会真的安装）'); }
    else if (cur === 'bare') { u.searchParams.set('simulate', 'partial'); toast('演练场景：库在但资产不全'); }
    else if (cur === 'partial') { u.searchParams.set('simulate', 'clean'); toast('演练场景：全新机器'); }
    else { u.searchParams.delete('simulate'); toast('已退出演练模式（回到真实检测）'); }
    location.href = u.toString();
  });
  $('btnClearLog').addEventListener('click', () => {
    $('log').textContent = '';
    state.logLineCount = 0;
    $('logEmpty').textContent = state.logJobId ? '已清屏。新日志会继续出现在这里。' : '← 选一个风格，点「开始生成」';
    $('logEmpty').hidden = false;
  });

  $('btnCopyCmd').addEventListener('click', copyCmd);
  for (const b of document.querySelectorAll('.preset')) {
    b.addEventListener('click', () => {
      const p = PRESETS.find((x) => x.id === b.dataset.preset);
      if (p) applyPreset(p);
    });
  }

  $('envbar').addEventListener('click', () => {
    const d = $('envDetail');
    d.hidden = !d.hidden;
  });

  $('autoScroll').addEventListener('change', (e) => {
    state.autoScroll = e.target.checked;
    if (state.autoScroll) $('logWrap').scrollTop = $('logWrap').scrollHeight;
  });

  $('search').addEventListener('input', (e) => renderStyles(e.target.value));

  // 分组展开/收起
  $('btnExpandAll').addEventListener('click', () => {
    state.collapsed.clear();
    renderStyles($('search').value);
  });
  $('btnCollapseAll').addEventListener('click', () => {
    for (const c of state.categories) state.collapsed.add(c.key);
    if (state.styles.some((s) => !s.category)) state.collapsed.add('__rest__');
    renderStyles($('search').value);
  });

  // 成片区：排序 / 筛选
  $('filmSort').addEventListener('change', (e) => { state.filmSort = e.target.value; renderFilms(); });
  $('filmSearch').addEventListener('input', (e) => { state.filmQuery = e.target.value; renderFilms(); });

  // 风格详情侧栏
  $('btnCloseDetail').addEventListener('click', closeDetail);
  $('btnUseStyle').addEventListener('click', () => {
    const slug = state.detailSlug;
    if (!slug) return;
    selectStyle(slug);
    markActiveStyle();
    closeDetail();
    const card = $('fSlug').closest('.card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('fSlug').focus();
    toast(`已选中 ${slug}，确认参数后点「开始生成」`);
  });

  for (const id of ['fSlug', 'fFps', 'fWorkers', 'fVenc', 'fQ', 'fGrain', 'fOut',
                    'fSkipSync', 'fSkipRender', 'fAudioOnly', 'fRenderOnly', 'fDryRun']) {
    $(id).addEventListener('change', syncPreview);
    $(id).addEventListener('input', syncPreview);
  }

  $('fSlug').addEventListener('keydown', (e) => {
    // ★ Ctrl+Enter 交给全局处理器（否则这里先跑一次、全局再跑一次 = 入队两条）
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) startRun(false);
  });

  $('btnToggleSide').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  $('btnClosePlayer').addEventListener('click', closePlayer);
  $('playerModal').addEventListener('click', (e) => { if (e.target === $('playerModal')) closePlayer(); });

  // 批量入队（第四批 ①）
  $('btnBatchQueue').addEventListener('click', openBatchConfirm);
  $('btnBatchClear').addEventListener('click', () => {
    state.checked.clear();
    renderStyles($('search').value);
  });
  $('btnCloseBatch').addEventListener('click', closeBatchModal);
  $('batchModal').addEventListener('click', (e) => { if (e.target === $('batchModal')) closeBatchModal(); });

  // 主题 + 快捷键面板（第四批 ③④）
  $('btnTheme').addEventListener('click', toggleTheme);
  $('btnHelp').addEventListener('click', openHelp);
  $('btnHelp2').addEventListener('click', openHelp);
  $('btnCloseHelp').addEventListener('click', closeHelp);
  $('helpModal').addEventListener('click', (e) => { if (e.target === $('helpModal')) closeHelp(); });

  // ── 键盘快捷键（第四批 ③）──
  // ★ 可发现：顶栏有「?」按钮、表单下方有一行提示，不是藏起来的功能。
  document.addEventListener('keydown', (e) => {
    // ① Ctrl/Cmd+K → 聚焦风格搜索（任何位置都生效）
    if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      focusSearch();
      return;
    }
    // ② Ctrl/Cmd+Enter → 启动当前表单的任务
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'Enter') {
      e.preventDefault();
      startRun(false);
      return;
    }
    // ③ Esc → 关掉最上面那一层
    if (e.key === 'Escape') {
      if (!$('helpModal').hidden) { closeHelp(); return; }
      if (!$('batchModal').hidden) { closeBatchModal(); return; }
      if (!$('detailDrawer').hidden) { closeDetail(); return; }
      closePlayer();
      return;
    }
    // ④ `/` → 聚焦搜索（只在没在打字时；否则应该老老实实输入一个斜杠）
    if (e.key === '/' && !isTyping(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      focusSearch();
    }
  });
}

// ── 启动 ────────────────────────────────────────────────────
async function boot() {
  initTheme();          // ★ 默认深色；只有本机明确选过浅色才切（先于渲染，避免闪一下）
  bind();
  syncPreview();
  updateBatchBar();
  await Promise.all([loadEnv(false), loadSetup(), loadStylesBadges(), loadFilms(), loadJobs()]);
  // 任务状态轮询（SSE 只推日志，列表用轮询保持简单）
  setInterval(() => { loadJobs(); }, 3000);
  // 环境每 60 秒刷一次（服务端缓存 30 秒）。★ 演练模式下不自动刷，免得把合成结果换成真实结果。
  if (!SIM) {
    setInterval(() => { loadEnv(false); }, 60000);
    setInterval(() => { loadSetup(); }, 60000);
  }
}

boot();
