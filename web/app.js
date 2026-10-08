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
  briefs: [],             // 主题工单（第五批 ⑤；服务端每次从磁盘现读，前端不推断状态）
  briefStyles: [],        // 4 个内容驱动风格（白名单来自 /api/briefs，不在前端硬编码 —— 防漂移）
  briefLang: '',          // 用户**明确选过**的语言版本（偏好）。只由下拉的 change 事件写；
                          // 空 = 还没选过 → 用服务端给的 default（该风格有中文版就是中文版）。
                          // ★ 不在这里回写「当前下拉的值」：否则切到一个没有中文版的风格时会把偏好
                          //   也改成英文版，再切回来就不再默认中文版了。
  defaultLang: 'en',      // 默认语言版本（来自 /api/briefs 的 defaultLang）—— 等于它就不传 --lang
  langCache: new Map(),   // slug → /api/langs 结果（每 3 秒的轮询不该重复打接口）
  // ── 输出尺寸（来自 /api/sizes，清单的权威来源是库侧 core/render/size.mjs）──
  defaultRatio: '9:16',   // 默认比例（服务端给）—— 下拉默认选中它
  ratios: [],             // 预设比例清单 [{id,label,w,h,pixels}]；**不在前端硬编码**
  sizeCache: null,        // /api/sizes 结果（只打一次接口）
  briefRatio: '',         // 用户明确选过的比例（'__custom' = 自定义像素）；空 = 还没选过 → 用默认
  briefSizeW: '',         // 自定义宽（字符串，原样保留用户输入）
  briefSizeH: '',         // 自定义高
  briefBusy: false,       // 正在建工单 / 出片（防重复点击）
  // ── 声音（配音音色）──────────────────────────────────────
  // ★ 音色清单 / 分组 / 默认值 / 告警阈值全部来自 /api/voices，前端**不硬编码音色名**。
  voices: null,           // /api/voices 结果；null = 还没加载完（用来显示骨架屏）
  voiceSel: '',           // 用户选中的音色名（'' = 没选过 → 不传 --voice，用内容文件的默认）
  voiceSpeed: '',         // 用户填的语速（'' = 没填过 → 不传 --speed）
  voicePlaying: '',       // 正在试听的音色名（同一时刻只允许一条在播）
  // ── 试合成一句（POST /api/voices/test，异步任务）──
  // vt.jobId 非空 = 有任务在跑；url 在任务 done 之前是 **404**，所以不能提前喂给 <audio>。
  vt: { jobId: '', url: '', status: '', note: '', error: '', ticks: 0 },
  // ── 导入新音色（GET /api/voices/sources，POST /api/voices/import，异步任务）──
  // ★ 与「试合成」同一套模式：提交拿 job.id → 轮询 /api/jobs → done 后刷新音色列表。
  vSources: null,        // /api/voices/sources 结果；null = 还没加载（折叠区**首次展开时**才拉，避免多余请求）
  vImport: { file: '', name: '', jobId: '', status: '', note: '', error: '', ticks: 0 },  // 当前正在导入的那一条
  vNames: new Map(),     // 源文件 file → 用户改过的音色名（重渲染时别把用户输入冲掉）
  voiceFlash: '',        // 导入成功后要在音色列表里高亮/滚动到的音色名
  voiceFlashTimer: null,
  // ── 文案出片（GET /api/dub/sources|styles，POST /api/dub/preview|analyze|upload|run）──
  // ★ 与「试合成」「导入音色」同一套异步模式：提交拿 job.id → 轮询 /api/jobs → done 后取产物。
  // ★ 断句**不在前端算**：/api/dub/preview 给什么就显示什么（规则只有一处，在核心工具里）。
  // ★ 语义解析也**不在前端算**：/api/dub/analyze 转发给 lib/dub-semantic.mjs。
  //   该模块**默认走纯规则路**（source='rules'，不加载任何模型），也可由外部注入结果
  //   （source='external'，通常来自 WorkBuddy 智能体）。前端只负责把「系统理解成了什么」摆给用户核对。
  dubPreview: null,      // /api/dub/preview 结果；null = 还没点过「断句预览」
  dubPreviewBusy: false,
  dubUploads: null,      // /api/dub/sources 结果；null = 还没加载完
  dubVideoToken: '',     // 当前选中的口播素材 token（'' = 没选）
  dubVideoName: '',      // 展示用（服务端清洗过的原始文件名）
  dubUpload: { busy: false, pct: 0, name: '', error: '' },   // 上传中的进度状态
  dubVoiceOverride: '',  // 本卡片单独覆盖的音色（'' = 跟随「声音」版块；不回写全局偏好）
  dub: { jobId: '', status: '', note: '', error: '', out: '', outName: '', ticks: 0, url: '', notReady: false },
  // 形态：'script' = 仅文案出片（画面由工具生成）；'keep' = 文案 + 口播视频（素材原样不动）
  dubMode: 'script',
  // 风格：'auto' = 按语义自动匹配；'' = 不指定（不传 --style，行为与加这个功能之前一致）；其它 = 风格 id
  dubStyle: 'auto',
  dubStyles: null,       // /api/dub/styles 结果；null = 还没加载
  dubStylesBusy: false,
  dubAnalysis: null,     // /api/dub/analyze 结果；null = 还没分析过
  dubAnalysisBusy: false,
  dubSrtToken: '',       // 形态 2 的可选 SRT token（'' = 不给，让工具自己对齐）
  dubSrtName: '',
  dubSrtUpload: { busy: false, pct: 0, name: '', error: '' },
  // 输出尺寸（与「主题出片」同一套纪律：比例清单来自 /api/sizes，前端**不硬编码**）——
  // '' = 用户还没选过 → 用服务端给的 defaultRatio（9:16）；'__custom' = 自定义像素
  dubRatio: '',
  dubSizeW: '',          // 自定义宽（字符串，原样保留用户输入）
  dubSizeH: '',          // 自定义高
  // 口播素材的像素尺寸：token → {w,h} | null（null = 探不到，按「不知道」处理，不提示）。
  // ★ 尺寸不在前端猜：由 GET /api/dub/source-meta 走 WSL 侧 ffprobe 探（只探一次，见 syncDubCropWarn）。
  dubSrcMeta: {},
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
  if (!r.ok) {
    // ★ 消息保持原样（调用方都只读 message，行为零变化）；额外挂上 status ——
    //   有些接口「未就绪」时返回的是自定义 error 文案（不含 "HTTP 404"），
    //   光靠 message 正则认不出 404，得靠这个字段。
    const err = new Error((data && data.error) || `HTTP ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
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
//   - 实测 lemo-make.mjs 里 step() 静态调用点共 11 个；默认路径（不带 content= / --lines）执行 7 步
//     （含最后的 `[7] 核验导出`），带 `--q content=…` / `--lines` 时 :2635 额外触发 ⇒ 执行 8 步。且**跳过的步骤照样调 step()**
//     （只把标题换成短名 + 一句「（--skip-xxx）」），所以正常情况下 N 是连续 1..7（默认路径），不会跳号。★ 2026-10-08 复核订正：原记「step() 共有 7 个调用点」；实测静态 11 个、默认路径 7 步、带 content= 8 步（无 `--content` flag，content 经 `--q content=` 传入）。
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


// ── 声音（配音音色）─────────────────────────────────────────
//
// ★ 定位：控制台里的「声音」＝ Index-TTS 零样本克隆用的**参考音频**。
//   换音色 = 换一条参考音，不需要训练；所以界面就是把参考音列出来让你挑一条。
// ★ 判据全在服务端（/api/voices）：音色清单、分组、默认值、告警阈值都由它给。
//   前端不硬编码任何音色名 —— 加了新参考音只要刷新就能看到。
// ★ 参考音偏响 → 克隆输出更容易顶到满刻度（削波不可逆），这是项目里**真实发生过**的坑
//   （官方 voice_05 就是因为这个被弃用），所以超阈值的条目给显眼警示（只提醒，不禁用）。
//   ★ 文案保持**统一**：判据在服务端就一个 OR（peak 或 rms 任一超），前端不再按 peak/rms
//   分两种说法 —— 多立一处判据迟早漂移。要更具体就只摆事实（把实测数值列出来）。
const VOICE_KEY = 'lemo.voice';     // 选中的音色名（'' / 无 = 用内容文件的默认）
const SPEED_KEY = 'lemo.speed';     // 语速（'' / 无 = 不传 --speed）

let voiceAudio = null;              // 单例 <audio>：换一条试听前先把上一条停掉

/** 读本机偏好。★ 读不到（隐私模式 / 被禁）不影响使用，只是记不住。 */
function loadVoicePref() {
  try {
    state.voiceSel = localStorage.getItem(VOICE_KEY) || '';
    state.voiceSpeed = localStorage.getItem(SPEED_KEY) || '';
  } catch { /* 读不到就当没选过 */ }
}

function saveVoicePref(key, val) {
  try {
    if (val) localStorage.setItem(key, val);
    else localStorage.removeItem(key);
  } catch { /* 记不住就算了 */ }
}

/** 把「选中的音色 / 语速」翻成 CLI 选项。
 *  ★ 用户若在「高级选项」的 --q 里自己写了 --voice / --speed，就**不重复追加**（以他的为准），
 *    并把这件事作为提示返回 —— 静默覆盖用户的手写参数是最糟的行为。 */
function voiceCliOpts(q) {
  const opts = [];
  const notes = [];
  const qs = String(q || '');
  const qHasVoice = /(^|\s)--voice(\s|$)/.test(qs);
  const qHasSpeed = /(^|\s)--speed(\s|$)/.test(qs);

  if (state.voiceSel) {
    if (qHasVoice) notes.push(`「--q」里已写了 --voice，以它为准（忽略声音版块选的 ${state.voiceSel}）`);
    else opts.push('--voice', state.voiceSel);
  }

  const sp = String(state.voiceSpeed || '').trim();
  if (sp) {
    const n = Number(sp);
    if (!Number.isFinite(n) || n < 0.5 || n > 2) {
      notes.push(`语速 ${sp} 超出 0.5–2 的范围，本次不传 --speed`);
    } else if (qHasSpeed) {
      notes.push('「--q」里已写了 --speed，以它为准');
    } else {
      opts.push('--speed', sp);
    }
  }
  return { opts, notes };
}

/** 该不该告警：peak / rms 任一超过服务端给的阈值。阈值缺失时用契约里的默认值。 */
function voiceLoud(v, warn) {
  const w = warn || { peak: 0.9, rms: 0.18 };
  const pk = Number(v.peak), rm = Number(v.rms);
  return (Number.isFinite(pk) && pk > w.peak) || (Number.isFinite(rm) && rm > w.rms);
}

function fmtVoiceNum(v) {
  return (v === null || v === undefined || !Number.isFinite(Number(v))) ? '' : Number(v).toFixed(2);
}

/** 当前音色条：当前用的是谁、语速多少、跟内容文件默认是否一致 + 一个「重置」按钮。 */
function renderVoiceCurrent() {
  const box = $('voiceCurrent');
  if (!box) return;
  box.textContent = '';

  const d = state.voices;
  const src = d && d.source;
  // 默认值：优先用内容文件里记的（source），没有就用服务端给的 default
  const defVoice = (src && src.voice) || (d && d.default) || '';
  const defSpeed = (src && src.speed !== undefined && src.speed !== null) ? String(src.speed) : '';
  const cur = state.voiceSel || defVoice;
  const sp = String(state.voiceSpeed || defSpeed || '1.0');

  box.appendChild(el('span', 'vc-lbl', '当前：'));
  box.appendChild(el('span', 'vc-name', cur || '—'));
  box.appendChild(el('span', 'vc-lbl', '　语速'));
  box.appendChild(el('span', 'vc-name', sp));
  if (state.voiceSel && defVoice && state.voiceSel !== defVoice) {
    box.appendChild(el('span', 'vc-tag', `已改（内容文件默认 ${defVoice}）`));
  }
  // 选过的音色在列表里找不到时**如实说**（可能是参考音被移走了）—— 不悄悄改回默认
  if (state.voiceSel && d && Array.isArray(d.voices)
      && !d.voices.some((v) => v.name === state.voiceSel)) {
    box.appendChild(el('span', 'vc-tag warn', '列表里没有这条音色'));
  }
  if (src && src.content) {
    box.appendChild(el('span', 'vc-lbl', `　内容文件 ${src.content}`));
  }

  const reset = el('button', 'btn ghost small vc-reset', '重置为内容文件默认');
  reset.title = defVoice
    ? `清掉本机选择，回到内容文件里记的默认（${defVoice}${defSpeed ? '，语速 ' + defSpeed : ''}）`
    : '清掉本机选择，回到服务端给的默认音色与 1.0 语速';
  reset.addEventListener('click', () => {
    state.voiceSel = '';
    state.voiceSpeed = '';
    saveVoicePref(VOICE_KEY, '');
    saveVoicePref(SPEED_KEY, '');
    if ($('fVoiceSpeed')) $('fVoiceSpeed').value = defSpeed || '1.0';
    renderVoices();
    renderVoiceCurrent();
    syncPreview();
    toast('已重置为内容文件默认音色与语速');
  });
  box.appendChild(reset);
  renderVoiceSpeedHint();
}

/** 语速框的提示文字 + 越界标红。★ 不在这里写 input.value —— 用户正在打字时会被抢走光标。 */
function renderVoiceSpeedHint() {
  const hint = $('voiceSpeedHint');
  const inp = $('fVoiceSpeed');
  const d = state.voices || {};
  const src = d.source;
  const defSpeed = (src && src.speed !== undefined && src.speed !== null) ? String(src.speed) : '';
  if (inp) {
    const n = Number(inp.value);
    inp.classList.toggle('bad', !Number.isFinite(n) || n < 0.5 || n > 2);
  }
  if (!hint) return;
  const parts = [];
  if (defSpeed) parts.push(`内容文件里记的是 ${defSpeed}（上一次用过的值）`);
  parts.push('★ 换音色后语速要重调：不同音色的「字/秒」差别很大，实测同一句话同语速下不同音色能差 30%');
  parts.push('中文叙事常用 1.1，常见区间 1.0–1.2（范围 0.5–2）');
  if (src && src.voice) parts.push(`默认音色 ${src.voice}`);
  hint.textContent = parts.join('　·　');
}

/** 试听：同一条再点 = 暂停；同一时刻只允许一条在播。 */
function toggleVoiceAudio(v) {
  if (!voiceAudio) {
    voiceAudio = new Audio();
    voiceAudio.addEventListener('ended', () => { state.voicePlaying = ''; renderVoices(); });
    voiceAudio.addEventListener('error', () => {
      state.voicePlaying = '';
      renderVoices();
      toast('试听失败：读不到这条参考音（文件可能被移走或改名）', true);
    });
  }
  // 再点同一条 → 暂停
  if (state.voicePlaying === v.name && !voiceAudio.paused) {
    voiceAudio.pause();
    state.voicePlaying = '';
    renderVoices();
    return;
  }
  if (!voiceAudio.paused) voiceAudio.pause();       // 换一条前先停掉上一条
  const vtA = $('vtAudio');
  if (vtA && !vtA.paused) vtA.pause();              // 也别和「试合成」的播放器一起响
  voiceAudio.src = '/api/voices/audio?name=' + encodeURIComponent(v.name);
  state.voicePlaying = v.name;
  renderVoices();
  voiceAudio.play().catch((e) => {
    state.voicePlaying = '';
    renderVoices();
    toast('试听失败：' + (e && e.message ? e.message : '浏览器拒绝了播放'), true);
  });
}

/** 选用：只记在本机 + 影响下一次出片；不打断任何正在跑的任务。 */
function pickVoice(name) {
  state.voiceSel = name;
  saveVoicePref(VOICE_KEY, name);
  renderVoices();
  renderVoiceCurrent();
  syncPreview();
  toast(`已选用音色 ${name} —— 用于下一次出片；换音色后记得重调语速`);
}

/** 单条音色。v 的形状见契约：{name, kind, label, file, exists, secs, peak, rms} */
function voiceItemNode(v) {
  const d = state.voices || {};
  const warn = d.warn || { peak: 0.9, rms: 0.18 };
  const loud = voiceLoud(v, warn);
  const isSel = state.voiceSel === v.name;
  const isPlaying = state.voicePlaying === v.name;
  const missing = v.exists === false;

  const row = el('div', 'voice' + (isSel ? ' sel' : '') + (loud ? ' loud' : '') + (state.voiceFlash === v.name ? ' flash' : ''));
  row.dataset.voice = v.name;

  const main = el('div', 'vmain');
  const head = el('div', 'vhead');
  head.appendChild(el('span', 'vname', v.name));
  if (isSel) head.appendChild(el('span', 'vbadge', '● 当前'));
  if (missing) head.appendChild(el('span', 'vbadge bad', '文件缺失'));
  else if (v.error) head.appendChild(el('span', 'vbadge bad', '读不出'));
  main.appendChild(head);

  const meta = [];
  if (v.label) meta.push(v.label);
  const secs = fmtVoiceNum(v.secs);
  if (secs) meta.push(secs + 's');
  const pk = fmtVoiceNum(v.peak);
  const rm = fmtVoiceNum(v.rms);
  if (pk) meta.push('peak ' + pk);
  if (rm) meta.push('rms ' + rm);
  main.appendChild(el('div', 'vmeta', meta.join(' · ')));

  if (missing) {
    main.appendChild(el('div', 'vwarn', '⚠️ 参考音文件不存在，试听与选用都不可用'));
  } else if (v.error) {
    // ★ 有 error = 库侧**读不出**这条参考音（例如 soundfile 不认这个 wav 编码）。
    //   注意这和「peak/rms = null（没测出电平）」是两件事，所以要分开说。
    //   ★ 只警告不禁用：读不出电平的是分析工具，不等于克隆引擎一定解不了码 ——
    //     浏览器里多半还能播，真拿去合成才知道。让用户自己判断，别替他下结论。
    const w = el('div', 'vwarn', `⚠️ 这条参考音读不出（${v.error}）—— 大概率当不了参考音，试听/选用可能失败`);
    w.title = String(v.error);
    main.appendChild(w);
  } else if (loud) {
    // ★ 只说**事实**：哪个值超了哪个阈值。不给「动态偏大」这类新结论 ——
    //   库侧（tts_indextts.py 的 REF_PEAK_WARN / REF_RMS_WARN）本来就是**一个 OR 判据**，
    //   没有「peak 是削波、rms 是动态」的分工；前端再发明一套判据就是第三处，早晚漂移。
    const over = [];
    const pkN = Number(v.peak), rmN = Number(v.rms);
    if (Number.isFinite(pkN) && pkN > warn.peak) over.push(`peak ${pkN.toFixed(2)} > ${warn.peak}`);
    if (Number.isFinite(rmN) && rmN > warn.rms) over.push(`rms ${rmN.toFixed(2)} > ${warn.rms}`);
    main.appendChild(el('div', 'vwarn',
      `⚠️ 参考音偏响（${over.join('、')}）—— 克隆输出可能削波，建议换一条更轻的参考音`));
  }
  row.appendChild(main);

  const acts = el('div', 'vacts');
  const play = el('button', 'btn ghost small', isPlaying ? '⏸ 暂停' : '▶ 试听');
  play.disabled = missing;
  play.title = missing ? '参考音文件不存在' : `播放 ${v.label || v.name}`;
  play.addEventListener('click', (e) => { e.stopPropagation(); toggleVoiceAudio(v); });
  acts.appendChild(play);

  const pick = el('button', 'btn small' + (isSel ? ' primary' : ''), isSel ? '已选用' : '选用');
  pick.disabled = missing;
  pick.title = missing ? '参考音文件不存在' : '选中后用在下一次出片上（不会打断正在跑的任务）';
  pick.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isSel) { toast(`已经是当前音色：${v.name}`); return; }
    pickVoice(v.name);
  });
  acts.appendChild(pick);

  row.appendChild(acts);
  return row;
}

function renderVoices() {
  const box = $('voiceList');
  if (!box) return;
  box.textContent = '';
  const cnt = $('voiceCount');
  const d = state.voices;

  // ① 还没回来 → 骨架屏（不留空白）
  if (d === null) {
    if (cnt) cnt.textContent = '';
    for (let i = 0; i < 3; i++) box.appendChild(el('div', 'voice-skel'));
    return;
  }

  const list = Array.isArray(d.voices) ? d.voices : [];
  if (cnt) cnt.textContent = list.length ? String(list.length) : '';

  // ② 空 / 错：把服务端的 error **原样**显示出来，不吞
  if (d.ok === false || !list.length) {
    const raw = d.error;
    const msg = raw ? (typeof raw === 'string' ? raw : JSON.stringify(raw)) : '没有读到任何音色';
    const e = el('div', 'voice-error');
    e.appendChild(el('div', 've-title', '⚠️ 读不到音色列表'));
    e.appendChild(el('div', 've-detail', msg));
    e.appendChild(el('div', 've-hint',
      '请检查 Index-TTS 是否装好、参考音目录是否存在（顶栏「重新检测」可看环境明细），然后点右上角「刷新」。'));
    box.appendChild(e);
    return;
  }

  // ③ 正常：按服务端给的分组渲染；没被任何分组收走的条目兜到「其它」
  const byName = new Map();
  for (const v of list) byName.set(v.name, v);
  const groups = Array.isArray(d.groups) ? d.groups : [];
  const seen = new Set();

  const addGroup = (label, names) => {
    if (!names.length) return;
    const g = el('div', 'voice-group');
    g.appendChild(el('div', 'voice-group-head', `${label}　${names.length}`));
    for (const n of names) g.appendChild(voiceItemNode(byName.get(n)));
    box.appendChild(g);
  };

  for (const g of groups) {
    const names = (Array.isArray(g.items) ? g.items : []).filter((n) => byName.has(n) && !seen.has(n));
    for (const n of names) seen.add(n);
    addGroup(g.label || g.id || '未命名分组', names);
  }
  addGroup('其它', list.filter((v) => !seen.has(v.name)).map((v) => v.name));
}

async function loadVoices(force) {
  state.voices = null;               // → 骨架屏
  state.voicePlaying = '';
  if (voiceAudio && !voiceAudio.paused) voiceAudio.pause();
  renderVoices();
  try {
    // ★ force：导入完成后服务端清单可能被缓存过，强制现读一次（?force=1）
    const d = await api('/api/voices' + (force ? '?force=1' : ''));
    state.voices = d || { ok: false, error: '接口返回空' };
  } catch (e) {
    // 接口还没就绪 / 出错：把原始信息留给界面显示（renderVoices 会原样展示 error）
    state.voices = { ok: false, error: e.message, voices: [], groups: [] };
  }
  renderVoices();
  renderVoiceCurrent();
  renderDubVoices();     // 「文案出片」的音色下拉也来自同一份清单，一起刷（两处选项必须一致）
  // 语速框的初值：用户选过的 > 内容文件里记的 > 1.0
  const src = (state.voices && state.voices.source) || null;
  const defSpeed = (src && src.speed !== undefined && src.speed !== null) ? String(src.speed) : '';
  if ($('fVoiceSpeed')) $('fVoiceSpeed').value = state.voiceSpeed || defSpeed || '1.0';
  renderVoiceSpeedHint();
}

/** 导入成功后：把新音色在列表里高亮几秒，并滚到它 —— 让用户一眼看到「进去了」。 */
function flashVoice(name) {
  if (!name) return;
  state.voiceFlash = name;
  clearTimeout(state.voiceFlashTimer);
  renderVoices();
  const node = document.querySelector('.voice.flash');
  if (node && node.scrollIntoView) {
    try { node.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { node.scrollIntoView(); }
  }
  state.voiceFlashTimer = setTimeout(() => { state.voiceFlash = ''; renderVoices(); }, 6000);
}

// ── 试合成一句（POST /api/voices/test）──────────────────────
//
// ★ 为什么必须异步：单条合成约 30 秒、首次加载模型 1~2 分钟 —— 请求挂着等必被掐断。
//   所以走服务端的后台任务队列：提交拿到 job.id → 轮询 /api/jobs → done 之后才把
//   产物 URL 喂给 <audio>（**done 之前那个 URL 是 404**，提前塞进去只会报错）。
// ★ 每次提交都会生成**新的** URL（文件名带时间戳），所以绝不按音色名缓存 URL。
// ★ 这条任务也会出现在「任务列表」里（kind=setup），界面上要说明，免得被当成出片任务。
const VT_MAX_TICKS = 750;          // 2 秒一次 × 750 ≈ 25 分钟（服务端单步超时 20 分钟）

/** 当前音色的兜底：没选过就用内容文件的，再没有就用服务端默认。 */
function voiceTestDefault() {
  const d = state.voices || {};
  return (d.source && d.source.voice) || d.default || '';
}

function renderVoiceTest() {
  const box = $('vtState');
  const btn = $('btnVoiceTest');
  const a = $('vtAudio');
  const vt = state.vt;
  if (btn) {
    btn.disabled = !!vt.jobId || !!state.vtBusy;
    btn.textContent = vt.jobId ? '合成中…' : '试合成一句';
  }
  if (!box) return;
  box.textContent = '';
  if (!vt.status) return;

  if (vt.error) {
    box.appendChild(el('div', 'vt-err', '✗ ' + vt.error));
    return;
  }
  const label = { queued: '排队中', running: '合成中', done: '已完成', failed: '失败', canceled: '已取消', ended: '已结束' }[vt.status] || vt.status;
  box.appendChild(el('div', 'vt-line', `试合成：${label}${vt.note ? '　·　' + vt.note : ''}`));
  if (vt.jobId) {
    box.appendChild(el('div', 'vt-sub',
      `任务 ${vt.jobId} —— 它也会出现在下面的「任务列表」里（kind=setup，不是出片任务）；实时日志可以看进度`));
  }
  if (vt.status === 'done' && a) a.hidden = false;
}

async function startVoiceTest() {
  if (state.vt.jobId || state.vtBusy) { toast('已经有一个试合成在跑，等它结束再点', true); return; }
  const name = state.voiceSel || voiceTestDefault();
  if (!name) { toast('还没选音色 —— 先在列表里点一条「选用」', true); return; }

  const sp = Number($('fVoiceSpeed') ? $('fVoiceSpeed').value : 1.1);
  const text = $('vtText') ? $('vtText').value.trim() : '';
  state.vt = { jobId: '', url: '', status: 'queued', note: '正在提交…', error: '', ticks: 0 };
  state.vtBusy = true; renderVoiceTest();

  try {
    const r = await api('/api/voices/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        speed: Number.isFinite(sp) ? sp : 1.1,
        ...(text ? { text } : {}),
      }),
    });
    // ★ 服务端给的是**夹到 0.5–2.0 之后**的实际值，显示它而不是用户输入的值
    state.vt = {
      jobId: r.job.id, url: r.url || '', status: r.job.status || 'queued',
      note: `${r.voice.name} · 语速 ${r.voice.speed} · ${r.voice.textChars} 字`, error: '', ticks: 0,
    };
    renderVoiceTest();
    pollVoiceTest();
  } catch (e) {
    state.vt = { jobId: '', url: '', status: 'failed', note: '', error: e.message, ticks: 0 };
    renderVoiceTest();
    toast('试合成失败：' + e.message, true);
  } finally { state.vtBusy = false; renderVoiceTest(); }
}

function pollVoiceTest() {
  clearTimeout(state.vt.timer);
  if (!state.vt.jobId) return;
  state.vt.timer = setTimeout(async () => {
    if (!state.vt.jobId) return;
    if (++state.vt.ticks > VT_MAX_TICKS) {
      const id = state.vt.jobId;
      state.vt.jobId = '';
      state.vt.error = `任务 ${id} 等了 25 分钟还没结束，不再等（去「任务列表」看它到底怎么了）`;
      renderVoiceTest();
      return;
    }
    try {
      const d = await api('/api/jobs');
      const job = (d.jobs || []).find((j) => j.id === state.vt.jobId);
      if (!job) { state.vt.note = '还没出现在任务列表里…'; renderVoiceTest(); return pollVoiceTest(); }
      state.vt.status = job.status;
      if (job.status === 'done') {
        state.vt.jobId = '';
        state.vt.note = `${state.vt.note}　·　下面这段就是克隆出来的效果`;
        renderVoiceTest();
        const a = $('vtAudio');
        if (a && state.vt.url) {
          a.src = state.vt.url;            // ★ 每次都是新 URL，不能缓存
          a.hidden = false;
          if (voiceAudio && !voiceAudio.paused) voiceAudio.pause();   // 别两条一起响
          a.play().catch(() => { /* 浏览器不给自动播就让用户点播放键 */ });
        }
        toast('试合成完成 —— 播放器在「声音」卡片底部');
        return;
      }
      // ★ 用户主动取消 ≠ 故障（与「文案出片」卡片同一套判据，见 pollDub 处说明）：中性提示，不要红色「失败」。
      if (job.status === 'canceled') {
        state.vt.jobId = '';
        state.vt.error = '';
        state.vt.note = '任务已取消（是你自己停掉的）。';
        renderVoiceTest();
        toast('已取消 —— 这条试合成是你自己停掉的');
        return;
      }
      if (job.status === 'failed') {
        state.vt.jobId = '';
        state.vt.error = job.error || '合成失败（去「实时日志」看这一条任务）';
        renderVoiceTest();
        toast('试合成失败：' + state.vt.error, true);
        return;
      }
      if (job.status === 'ended') {
        // 'ended' = 控制台重启时这条任务还开着（见 pollDub 处说明）：立刻收尾，别白等到超时上限。
        state.vt.jobId = '';
        state.vt.error = '';
        state.vt.note = '任务已结束 —— 控制台重启时它还没跑完。';
        renderVoiceTest();
        toast('任务已结束 —— 控制台重启时它还没跑完，已经停了');
        return;
      }
      renderVoiceTest();
      pollVoiceTest();
    } catch (e) {
      state.vt.note = '查任务状态失败（继续重试）：' + e.message;
      renderVoiceTest();
      pollVoiceTest();
    }
  }, 2000);
}

// ── 导入新音色（GET /api/voices/sources → POST /api/voices/import）──
//
// ★ 定位：源目录（服务端给，前端不写死）里放着的音频文件 → 一键变成参考音。
//   服务端会：量电平 → 降到健康水位 → 裁 6~15 秒干净人声 → 转 44100 单声道 wav。
//   ★ 为什么必须降电平：Index-TTS **按参考音的电平出音**，参考音顶到满刻度，
//     克隆输出也顶到满刻度 —— 削波**不可逆**（项目里真发生过，官方 voice_05 就这么废的）。
// ★ 异步：单条约 10~30 秒，和「试合成」走**同一套**后台任务队列（GPU 只有一块，串行排队）。
//   所以这里也是「提交拿 job.id → 轮询 /api/jobs → done 后刷新列表」，不另发明一套。
// ★ 折叠区默认收起，源目录清单**首次展开时才拉** —— 不导入的人不必为一个折叠区多打一次接口。
const VI_MAX_TICKS = 750;          // 2 秒一次 × 750 ≈ 25 分钟

/** 折叠区里的说明：源目录 + 为什么要降电平。路径来自服务端，全程 textContent。 */
function renderVoiceImportIntro() {
  const box = $('viIntro');
  if (!box) return;
  box.textContent = '';
  const d = state.vSources || {};
  const dir = d.dir || '源目录';

  const p1 = el('p', 'vi-p');
  p1.appendChild(document.createTextNode('把音频文件放进 '));
  p1.appendChild(el('code', 'vi-path', dir));
  p1.appendChild(document.createTextNode(
    '，这里就会出现；导入会自动量电平、降到我标定的健康水位、裁出 6~15 秒干净人声、转成 44100 单声道 wav。'));
  box.appendChild(p1);

  const p2 = el('p', 'vi-why');
  p2.appendChild(el('b', '', '为什么要降电平：'));
  p2.appendChild(document.createTextNode(
    'Index-TTS 是按参考音的电平出音的 —— 参考音顶到满刻度，克隆输出也会顶到满刻度，而削波不可逆（这个坑项目里真踩过）。'));
  box.appendChild(p2);
}

/** 单条待导入的源文件。s 的形状见契约：{file, name, ext, size, already, refName} */
function voiceSourceNode(s) {
  const imp = state.vImport;
  const busy = (!!imp.jobId || !!state.vImportBusy) && imp.file === s.file;
  const row = el('div', 'vi-item' + (busy ? ' busy' : ''));

  const main = el('div', 'vimain');
  const head = el('div', 'vihead');
  head.appendChild(el('span', 'vifile', s.file));           // 源文件名（可能含中文）
  if (s.ext) head.appendChild(el('span', 'vitag', s.ext));
  main.appendChild(head);

  const meta = [];
  const sz = fmtSize(s.size);
  if (sz) meta.push(sz);
  if (s.refName) meta.push('→ ' + s.refName);
  if (meta.length) main.appendChild(el('div', 'vimeta', meta.join(' · ')));
  row.appendChild(main);

  const acts = el('div', 'viacts');
  // 建议的音色名：**服务端已算好 ASCII 名**，前端直接用，不自己转写（转写规则只该有一处）
  const nameInp = el('input', 'input vi-name');
  nameInp.type = 'text';
  nameInp.value = state.vNames.has(s.file) ? state.vNames.get(s.file) : (s.name || '');
  nameInp.placeholder = '音色名（ASCII）';
  nameInp.title = '导入后用的音色名（ASCII）—— 服务端已给建议名，可改';
  nameInp.setAttribute('autocomplete', 'off');
  nameInp.disabled = busy;
  nameInp.addEventListener('input', () => { state.vNames.set(s.file, nameInp.value); });
  acts.appendChild(nameInp);

  const btn = el('button', 'btn primary small', busy ? '导入中…' : '导入');
  btn.disabled = busy;
  btn.title = busy ? '正在导入，约 10~30 秒' : `把 ${s.file} 导入成参考音（约 10~30 秒）`;
  btn.addEventListener('click', () => {
    const nm = String(nameInp.value || '').trim();
    if (nm) state.vNames.set(s.file, nm);
    startVoiceImport(s.file, nm);
  });
  acts.appendChild(btn);
  row.appendChild(acts);

  if (busy) {
    row.appendChild(el('div', 'vi-state',
      `正在导入：量电平 → 降水位 → 裁 6~15 秒 → 转 44100 单声道 wav，约 10~30 秒${imp.note ? '　·　' + imp.note : ''}`));
  }
  return row;
}

function renderVoiceImport() {
  renderVoiceImportIntro();
  const box = $('viList');
  const sum = $('viSum');
  const hint = $('viHint');
  if (sum) sum.textContent = '';
  if (hint) hint.textContent = '';
  if (!box) return;
  box.textContent = '';

  const d = state.vSources;

  // ① 还没拉过 / 正在拉 → 骨架屏（不留空白）
  if (d === null) {
    if (hint) hint.textContent = '正在读源目录…';
    for (let i = 0; i < 2; i++) box.appendChild(el('div', 'voice-skel'));
    return;
  }

  // ② 出错 / 接口未就绪：把服务端的 error **原样**显示，不吞、不假装成功
  if (d.ok === false) {
    const raw = d.error;
    const msg = raw ? (typeof raw === 'string' ? raw : JSON.stringify(raw)) : '接口没有返回 ok';
    const e = el('div', 'voice-error');
    e.appendChild(el('div', 've-title', '⚠️ 读不到待导入的源文件'));
    e.appendChild(el('div', 've-detail', msg));
    const notReady = /HTTP\s*404/.test(msg) || d.notReady === true;
    e.appendChild(el('div', 've-hint', notReady
      ? '后端接口未就绪（/api/voices/sources）—— 前端已按契约写好，等后端上线后点「刷新」即可。'
      : '请确认源目录存在、且服务端有读目录的权限，然后点「刷新」。'));
    box.appendChild(e);
    return;
  }

  const list = Array.isArray(d.sources) ? d.sources : [];
  const todo = list.filter((s) => !s.already);
  const done = list.filter((s) => s.already);
  if (sum) sum.textContent = todo.length ? `　${todo.length} 个待导入` : '';

  // ③ 空状态
  if (!todo.length) {
    box.appendChild(el('div', 'vi-empty',
      `源目录里没有新文件 —— 把 MP3 放进 ${d.dir || '源目录'} 后点「刷新」`));
  } else {
    for (const s of todo) box.appendChild(voiceSourceNode(s));
  }

  // ④ 已导入的**不混在待导入里**（别让用户重复导），单独折叠
  if (done.length) {
    const det = el('details', 'vi-done');
    det.appendChild(el('summary', '', `已导入 ${done.length} 条（点开查看）`));
    for (const s of done) {
      const line = el('div', 'vi-doneline');
      line.appendChild(el('span', 'vifile', s.file));
      if (s.refName) line.appendChild(el('span', 'vimeta', ' → ' + s.refName));
      det.appendChild(line);
    }
    box.appendChild(det);
  }
}

/** 拉源目录清单。★ 只在折叠区展开时 / 点刷新时调用，不在页面初始化时打这个接口。 */
async function loadVoiceSources() {
  state.vSources = null;             // → 骨架屏
  renderVoiceImport();
  try {
    const d = await api('/api/voices/sources');
    state.vSources = d || { ok: false, error: '接口返回空' };
  } catch (e) {
    // ★ 接口还没就绪（404）也走这里：把原始信息交给 renderVoiceImport 原样显示。
    //   404 时服务端可能给的是自定义文案（不含 "HTTP 404"），所以用 status 判断。
    state.vSources = { ok: false, error: e.message, sources: [] };  // ★ 2026-10-08 复核：删掉恒假的 notReady（后端 apiVoiceSources **恒返 200**，永不 404/503）——与 :2614/:2728 同型；消费点 `d.notReady === true` 变 undefined ⇒ 行为等价
  }
  renderVoiceImport();
}

async function startVoiceImport(file, name) {
  if (state.vImport.jobId || state.vImportBusy) { toast('已经有一个导入在跑，等它结束再点', true); return; }
  state.vImport = { file, name: name || '', jobId: '', status: 'queued', note: '正在提交…', error: '', ticks: 0 };
  state.vImportBusy = true; renderVoiceImport();

  try {
    const r = await api('/api/voices/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(name ? { file, name } : { file }),   // name 留空 = 让服务端用建议名
    });
    state.vImport = {
      file, name: name || '', jobId: r.job.id, status: r.job.status || 'queued',
      note: r.out ? '输出 ' + r.out : '', error: '', ticks: 0,
    };
    renderVoiceImport();
    pollVoiceImport();
  } catch (e) {
    state.vImport = { file, name: name || '', jobId: '', status: 'failed', note: '', error: e.message, ticks: 0 };
    renderVoiceImport();
    toast('导入失败：' + e.message, true);
  } finally { state.vImportBusy = false; renderVoiceImport(); }
}

function pollVoiceImport() {
  clearTimeout(state.vImport.timer);
  if (!state.vImport.jobId) return;
  state.vImport.timer = setTimeout(async () => {
    if (!state.vImport.jobId) return;
    if (++state.vImport.ticks > VI_MAX_TICKS) {
      const id = state.vImport.jobId;
      state.vImport.jobId = '';
      state.vImport.error = `任务 ${id} 等了 25 分钟还没结束，不再等（去「任务列表」看它到底怎么了）`;
      renderVoiceImport();
      return;
    }
    try {
      const d = await api('/api/jobs');
      const job = (d.jobs || []).find((j) => j.id === state.vImport.jobId);
      if (!job) { state.vImport.note = '还没出现在任务列表里…'; renderVoiceImport(); return pollVoiceImport(); }
      state.vImport.status = job.status;

      if (job.status === 'done') {
        const nm = state.vImport.name || '';
        state.vImport = { file: '', name: '', jobId: '', status: 'done', note: '', error: '', ticks: 0 };
        renderVoiceImport();
        toast('导入完成' + (nm ? '：' + nm : '') + ' —— 已加入音色列表');
        // 源目录（哪条已导入）+ 音色列表（新音色）都要刷新；列表用 force 绕开服务端缓存
        await Promise.all([loadVoiceSources(), loadVoices(true)]);
        flashVoice(nm);
        return;
      }
      // ★ 用户主动取消 ≠ 故障（与「文案出片」卡片同一套判据，见 pollDub 处说明）：中性提示。
      if (job.status === 'canceled') {
        const nm = state.vImport.name || '';
        state.vImport = { file: '', name: '', jobId: '', status: 'canceled', note: '', error: '', ticks: 0 };
        renderVoiceImport();
        toast('已取消 —— 导入' + (nm ? '（' + nm + '）' : '') + '是你自己停掉的');
        return;
      }
      if (job.status === 'failed') {
        const nm = state.vImport.name || '';
        state.vImport = {
          file: '', name: '', jobId: '', status: 'failed', note: '',
          error: job.error || '导入失败（去「实时日志」看这一条任务）', ticks: 0,
        };
        renderVoiceImport();
        toast('导入失败' + (nm ? '（' + nm + '）' : '') + '：' + state.vImport.error, true);
        return;
      }
      if (job.status === 'ended') {
        // 'ended' = 控制台重启时这条任务还开着（见 pollDub 处说明）：立刻收尾。
        state.vImport = { file: '', name: '', jobId: '', status: 'ended', note: '', error: '', ticks: 0 };
        renderVoiceImport();
        toast('任务已结束 —— 控制台重启时它还没跑完，已经停了');
        return;
      }
      renderVoiceImport();
      pollVoiceImport();
    } catch (e) {
      state.vImport.note = '查任务状态失败（继续重试）：' + e.message;
      renderVoiceImport();
      pollVoiceImport();
    }
  }, 2000);
}

// ── 文案出片（/api/dub*）────────────────────────────────────
//
// ★ 定位：用户粘贴**自己的**文案 → 出成片。和「主题出片」正相反 ——
//   那边的内容由外部 LLM 按风格的 STYLE.md 生成，这边**一个字都不改**。
// ★ 三件事全部交给服务端，前端不自己算：
//   ① 断句 —— /api/dub/preview（规则只有一处，在核心工具 dub.mjs 里；前端只负责显示）。
//      断句错了要重跑一遍配音，所以出片前**先让用户核对**是这张卡片最有价值的一步。
//   ② 素材 —— 上传后拿到 token；出片时只传 token，**不传路径**（路径由服务端查登记表得到）。
//   ③ 出片 —— /api/dub/run 返回 job.id，之后轮询 /api/jobs —— 与「试合成一句」完全同一套。
// ★ 音色默认跟随「声音」版块（同一个 localStorage 键 lemo.voice），但本卡片可以**单独覆盖**；
//   覆盖只存在本卡片的 state 里，不回写 localStorage —— 用户在这里试一个音色，
//   不该悄悄改掉「声音」版块的全局选择。
// ★ 错误一律原样显示（服务端的 error 字符串），不吞、不假装成功；404 / 503 单独提示「未就绪」。
const DUB_MAX_BYTES = 200 * 1024 * 1024;
const DUB_EXTS = ['.mp4', '.mov', '.m4v', '.webm'];
// 形态 2 的可选字幕时间轴（与视频走同一条上传通道，服务端按扩展名判 kind）
const DUB_SRT_EXTS = ['.srt'];
const DUB_MAX_TICKS = 1900;            // 2 秒一次 × 1900 ≈ 63 分钟（服务端单步超时 60 分钟）
// ★ 尺寸**不做前端兜底表**：比例清单与「比例 → 像素」换算的唯一来源是库侧 core/render/size.mjs
//   （控制台侧 lib/sizes.mjs 代理），经 GET /api/sizes 给出来 —— 见下面的 fillDubRatios()。
//   读不到清单就禁用下拉并如实说明（服务端仍会按默认 9:16 出片），绝不另抄一份比例表。
//
// ★ 为什么这里**故意没有**「主题出片」那种画幅警告（#briefAspectWarn / syncBriefAspectWarn）？
//   主题出片的画面来自**风格样板影片模块**（styles/<slug>/demo/film*.js），它们按 1920×1080 的
//   绝对像素构图，所以有 FILM_META.aspects「只支持 16:9」的限制。而文案出片（形态 1）的画面是
//   **按请求尺寸程序化生成**的 —— 见 lib/dub-core.mjs 的 bgSource(spec,{W,H,dur})（`gradients=s=${W}x${H}`），
//   它**没有任何绝对像素常量、与风格样板影片模块无关** → aspects 那套能力判据**不适用**。
//   ★ 所以别看到「主题出片有、文案出片没有」就当成漏了去补一个错的：这里**不该**加画幅警告/禁用。
//   （形态 2「素材原样不动」的风险是**用户上传素材**被裁 —— 那是另一回事，已有 syncDubCropWarn 覆盖。）

/** 服务端的 error 原样转成可显示文本（字符串直接用，对象/数组序列化）。 */
function dubErrText(raw) {
  if (raw === undefined || raw === null || raw === '') return '接口没有返回 ok';
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}

/** 本卡片实际会用的音色：本卡片覆盖 > 「声音」版块选的 > 内容文件默认 > 服务端默认。 */
function dubEffectiveVoice() {
  if (state.dubVoiceOverride) return state.dubVoiceOverride;
  return voiceTestDefault();
}

function dubExtOf(name) {
  const m = /(\.[A-Za-z0-9]+)$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

// ── 渲染 ────────────────────────────────────────────────────
function renderDubScriptHint() {
  const box = $('dubScriptHint');
  const ta = $('dubScript');
  if (!box || !ta) return;
  const n = ta.value.length;
  const parts = [`${n} 字`];
  if (n > 20000) parts.push('⚠️ 超过 20000 字上限，接口会拒');
  parts.push('空行 = 强制断句；不空行则按 。！？； 切，单句超过 40 字再按 ， 二次切（最终以「断句预览」为准）');
  box.textContent = parts.join('　·　');
}

// ── 形态（仅文案出片 / 文案 + 口播视频）──────────────────────
//
// ★ 形态**不是**一个纯 UI 开关，它同时决定：
//   ① 表单显示哪些字段（CSS 类 .mode-*，见 style.css）；
//   ② 提交给 /api/dub/run 的 body（形态 2 带 keepOriginal:true，且**不发**音色/语速/停顿/尺寸/fit）。
// ★ 形态 2 的硬条件：必须有 videoToken —— 前端先拦一道（给出人话），服务端还会再拦一道（400）。
function renderDubMode() {
  const card = $('dubCard');
  const keep = state.dubMode === 'keep';
  if (card) {
    card.classList.toggle('mode-keep', keep);
    card.classList.toggle('mode-script', !keep);
  }
  for (const b of document.querySelectorAll('#dubMode .dub-mode-btn')) {
    const on = b.dataset.mode === state.dubMode;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;   // ★ Tabs 模式：roving tabindex
  }
  const panel = $('dubModePanel'); if (panel) panel.setAttribute('aria-labelledby', keep ? 'dubModeKeep' : 'dubModeScript'); renderDubVideoHint();
  renderDubSrtHint();
  renderDubLimitHint();
  syncDubCropWarn();       // 形态决定「素材会不会被缩放/裁切」—— 切形态就要重核提示
}

function setDubMode(mode) {
  const m = mode === 'keep' ? 'keep' : 'script';
  if (state.dubMode === m) return;
  state.dubMode = m;
  renderDubMode();
  toast(m === 'keep'
    ? '已切到「文案 + 口播视频」：素材的画面与声音不会被修改，成片时长 = 素材时长'
    : '已切到「仅文案出片」：画面用工具生成的背景，配音走本机 Index-TTS');
}

// ── 风格（两形态共用）────────────────────────────────────────
//
// ★ 风格清单来自 GET /api/dub/styles —— 前端**不写死一份**：服务端从 lib/dub-semantic.mjs
//   的 loadStyles() 取，那份才是唯一真相源；这里写死一份必然与它漂移。
// ★ 第一项固定是「自动匹配」（'auto'，推荐）；第二项是「不指定」（value = **空串** —— 出片时
//   不传 --style，行为与加这个功能之前完全一样）；之后是表里剩下的各个风格（默认风格由
//   「不指定」档代表，不重复列一项）。
// ★ 清单拿不到（模块未就绪）时**只留「不指定」**并如实说明 —— 风格没了，出片照旧。
function renderDubStyleOptions() {
  const sel = $('dubStyle');
  if (!sel) return;
  const keep = state.dubStyle;
  sel.textContent = '';

  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = '自动匹配（按文案语义）（推荐）';
  sel.appendChild(auto);

  const d = state.dubStyles;
  const list = (d && Array.isArray(d.styles)) ? d.styles : [];
  const defId = (d && d.default) || 'plain-dark';

  // ★ 「不指定」档的 value **必须是空串** —— 与三处判断一致：
  //   state 注释（本文件 state.dubStyle 的说明）、发送逻辑（startDubRun 的 `state.dubStyle !== ''`）、
  //   提示逻辑（renderDubStyleHint 的 else 分支「不传 --style」）。
  //   ★ 曾经的写法是 `none.value = def.id`（= 服务端 default，如 plain-dark）⇒ 上面三处判断全部落空：
  //     ① 下拉提示误写成「指定风格「plain-dark」」；
  //     ② 出片 body 里多带一个 style=<default>；
  //     ③ dub.mjs 因此多跑一次语义自检，还可能误报「你指定的风格 plain-dark 匹配度偏低」。
  //     画面等价（dub.mjs 的 `let styleId = o.style || 'plain-dark'` 把 plain-dark 当基线），
  //     但用户会看到自相矛盾的提示 —— 故修正为空串。
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '不指定（保持现有外观，与加这个功能之前一致）';
  sel.appendChild(none);

  for (const s of list) {
    if (s.id === defId) continue;      // 默认风格由「不指定」档代表，不重复列一项
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.desc ? `${s.cn} · ${s.id} —— ${s.desc}` : `${s.cn} · ${s.id}`;
    sel.appendChild(o);
  }

  // ★ 兼容历史状态：曾经「不指定」档的 value 是 defId ⇒ 归一化成 ''，免得选中态丢失。
  const keepNorm = keep === defId ? '' : keep;
  const known = ['auto', '', ...list.map((s) => s.id)];
  sel.value = known.includes(keepNorm) ? keepNorm : 'auto';
  state.dubStyle = sel.value;
  renderDubStyleHint();
}

function renderDubStyleHint() {
  const hint = $('dubStyleHint');
  if (!hint) return;
  const d = state.dubStyles;
  const parts = [];
  if (d === null) parts.push('正在读风格清单…');
  else if (d && d.ok === false) parts.push(`读不到风格清单：${dubErrText(d.error)}`);
  else if (d && d.notReady) parts.push(d.note || '风格模块还没就绪');
  else if (d) parts.push(`共 ${Array.isArray(d.styles) ? d.styles.length : 0} 个风格（默认 ${d.default}）`);

  if (state.dubStyle === 'auto') {
    parts.push('自动匹配：出片时由语义解析按文案挑一个风格'
      + (state.dubMode === 'keep' ? '（形态 2 还会看口播表达）' : '')
      + ' —— 点「分析文案」可以先看它会挑哪个');
  } else if (state.dubStyle) {
    parts.push(`指定风格「${state.dubStyle}」`);
  } else {
    parts.push('不指定风格：不传 --style，外观与加这个功能之前完全一样');
  }
  hint.textContent = parts.join('　·　');
}

// ── 分析文案（POST /api/dub/analyze，同步约 1 秒）─────────────
//
// ★ 这一步的全部价值是**让用户核对「系统理解得对不对」**：
//   段落怎么切的、角色标的是什么、主题/情绪/节奏/场景读成了什么、最后挑了哪个风格。
//   理解错了，出片再好看也是跑偏 —— 所以这些必须摆出来，而不是只给一个风格名。
// ★ 语义模块**默认就是规则路**（source:'rules'），没有「LLM 降级」这回事；外部注入结果时
//   source:'external'。界面**照实说**结果是从哪来的 —— 绝不把规则结果伪装成模型结果。
function renderDubAnalysis() {
  const box = $('dubAnalysis');
  const sum = $('dubAnalysisSum');
  const body = $('dubAnalysisBody');
  if (!box || !body) return;

  const a = state.dubAnalysis;
  if (!a && !state.dubAnalysisBusy) {
    box.hidden = true;
    if (sum) sum.textContent = '分析结果';
    return;
  }
  box.hidden = false;
  body.textContent = '';

  if (state.dubAnalysisBusy) {
    if (sum) sum.textContent = '分析中…';
    body.appendChild(el('div', 'dub-kv', '正在做语义解析（默认走规则，很快）…'));
    return;
  }

  if (!a || a.ok === false) {
    if (sum) sum.textContent = '分析失败';
    const e = el('div', 'dub-err');
    e.appendChild(el('div', 'dub-err-title', '⚠️ 分析文案失败'));
    e.appendChild(el('div', 'dub-err-detail', dubErrText(a && a.error)));
    if (a && a.notReady) {
      e.appendChild(el('div', 'dub-err-hint',
        '后端接口未就绪（/api/dub/analyze）—— 前端已按契约写好，等后端上线后重试即可。'));
    }
    body.appendChild(e);
    return;
  }

  const byLabel = {
    external: '外部注入（WorkBuddy 智能体）',
    rules: '规则（默认）',
    user: '你指定的',
    default: '默认',
  };

  if (sum) {
    sum.textContent = `分析结果：${a.styleId || '（没给风格）'}`
      + `（${byLabel[a.stylePickedBy] || a.stylePickedBy || '?'}）`
      + (a.ms !== undefined ? ` · ${a.ms}ms` : '');
  }

  // ★ 来源必须明说 —— 这是「用户能不能相信这份分析」的前提
  if (a.source === 'rules') {
    const w = el('div', 'dub-tag', '本次语义解析走的是规则（词表打分），不是外部注入的结果');
    body.appendChild(w);
  }

  // ① 段落拆分：序号 · role · 文本 · 字数
  const segs = Array.isArray(a.segments) ? a.segments : [];
  const s1 = el('div', 'dub-sec');
  s1.appendChild(el('div', 'dub-sec-head', `段落拆分（${segs.length} 段）`));
  if (!segs.length) s1.appendChild(el('div', 'dub-kv', '（没有段落信息）'));
  for (const sg of segs) {
    const row = el('div', 'dub-seg');
    row.appendChild(el('span', 'dub-seg-i', String(sg && sg.i !== undefined ? sg.i : '')));
    row.appendChild(el('span', 'dub-seg-role', String((sg && sg.role) || '其他')));
    row.appendChild(el('span', 'dub-seg-t', String((sg && sg.text) || '')));
    row.appendChild(el('span', 'dub-seg-n', `${String((sg && sg.text) || '').length} 字`));
    s1.appendChild(row);
  }
  body.appendChild(s1);

  // ② 语义标签：主题 / 情绪 / 节奏 / 场景
  const s2 = el('div', 'dub-sec');
  s2.appendChild(el('div', 'dub-sec-head', '语义标签'));
  const tagrow = el('div', 'dub-tagrow');
  const theme = Array.isArray(a.theme) ? a.theme : (a.theme ? [a.theme] : []);
  const kv = (k, v) => {
    const w = el('span', 'dub-kv');
    w.appendChild(el('span', 'k', k));
    w.appendChild(document.createTextNode(String(v || '—')));
    return w;
  };
  tagrow.appendChild(kv('主题', theme.length ? theme.join(' / ') : '—'));
  tagrow.appendChild(kv('情绪', a.emotion));
  tagrow.appendChild(kv('节奏', a.pace));
  tagrow.appendChild(kv('场景', a.scene));
  s2.appendChild(tagrow);
  body.appendChild(s2);

  // ③ 匹配结果：选中的风格 + 是谁选的 + 前 3 名分数
  const s3 = el('div', 'dub-sec');
  s3.appendChild(el('div', 'dub-sec-head', '匹配结果'));
  const pick = el('div', 'dub-kv');
  pick.appendChild(el('span', 'k', '选中风格'));
  pick.appendChild(document.createTextNode(String(a.styleId || '（没给风格）')));
  pick.appendChild(document.createTextNode(`　·　${byLabel[a.stylePickedBy] || a.stylePickedBy || '?'}`));
  s3.appendChild(pick);

  const scores = (a.scores && typeof a.scores === 'object') ? a.scores : null;
  if (scores) {
    const top = Object.entries(scores)
      .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3);
    if (top.length) {
      const line = el('div', 'dub-kv');
      line.appendChild(el('span', 'k', '前 3 名'));
      line.appendChild(el('span', 'dub-score',
        top.map(([k, v]) => `${k} ${(Math.round(v * 100) / 100)}`).join('　·　')));
      s3.appendChild(line);
    }
  }
  if (a.model) s3.appendChild(el('div', 'dub-score', `模型 ${a.model}${a.ms !== undefined ? ` · ${a.ms}ms` : ''}`));
  body.appendChild(s3);
}

async function analyzeDub() {
  if (state.dubAnalysisBusy) return;
  const ta = $('dubScript');
  const script = ta ? ta.value : '';
  if (!script.trim()) { toast('先粘贴一段文案，再点「分析文案」', true); if (ta) ta.focus(); return; }

  state.dubAnalysisBusy = true;
  state.dubAnalysis = null;
  renderDubAnalysis();
  const btn = $('btnDubAnalyze');
  if (btn) { btn.disabled = true; btn.textContent = '分析中…'; }

  try {
    const d = await api('/api/dub/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
    });
    state.dubAnalysis = d || { ok: false, error: '接口返回空' };
  } catch (e) {
    // ★ 404 / 503 都原样显示服务端的话，只在旁边补一句「未就绪」的指引
    state.dubAnalysis = { ok: false, error: e.message, notReady: e.status === 404 || e.status === 503 };
  }

  state.dubAnalysisBusy = false;
  if (btn) { btn.disabled = false; btn.textContent = '分析文案'; }
  renderDubAnalysis();
  const box = $('dubAnalysis');
  if (box && !box.hidden) box.open = true;
}

function renderDubVoiceHint() {
  const hint = $('dubVoiceHint');
  if (!hint) return;
  const eff = dubEffectiveVoice();
  const parts = [];
  parts.push(eff ? `本次会用：${eff}` : '还没选音色 —— 会用内容文件的默认音色');
  parts.push(state.dubVoiceOverride ? '本卡片单独覆盖（不改「声音」版块）' : '跟随「声音」版块');
  parts.push('换音色后语速要重调（不同音色的字/秒差别很大）');
  hint.textContent = parts.join('　·　');
}

function renderDubVoices() {
  const sel = $('dubVoice');
  if (!sel) return;
  const keep = sel.value;
  sel.textContent = '';
  const d = state.voices || {};
  const list = Array.isArray(d.voices) ? d.voices : [];

  const follow = voiceTestDefault();
  const o0 = document.createElement('option');
  o0.value = '';
  o0.textContent = follow ? `跟随「声音」版块（${follow}）` : '跟随「声音」版块';
  sel.appendChild(o0);

  for (const v of list) {
    const o = document.createElement('option');
    o.value = v.name;
    o.textContent = v.exists === false ? `${v.name}（参考音缺失）` : v.name;
    if (v.exists === false) o.disabled = true;   // 缺文件的音色选了也合成不了，直接禁掉
    sel.appendChild(o);
  }

  const want = state.dubVoiceOverride || keep || '';
  sel.value = list.some((v) => v.name === want) ? want : '';
  state.dubVoiceOverride = sel.value;
  renderDubVoiceHint();
}

// ── 输出尺寸（预设比例 + 自定义像素）──────────────────────────
//
// ★ 与「主题出片」卡片**同一条纪律**：比例清单与「比例 → 像素」换算的唯一来源是库侧
//   core/render/size.mjs（控制台侧 lib/sizes.mjs 代理），经服务端 GET /api/sizes 给出来 ——
//   前端**不硬编码**任何比例。库里改了比例，刷新页面就跟着变（判据写在两处必然漂移）。
// ★ 默认选中服务端给的 defaultRatio（9:16）。选「自定义尺寸…」时出现宽 × 高两个数字框，
//   即时校验（偶数、MIN_SIZE–MAX_SIZE）；非法就拦住出片并给出提示。
// ★ 出片时**显式**传 `--ratio <比例>`（连默认 9:16 也传）或 `--size <WxH>`（size 优先）。

/** 自定义像素的校验结果：{ok, w, h, error}。空输入按「还没填完」处理（措辞友好）。 */
function checkDubCustomSize() {
  const wRaw = ($('dubSizeW') ? $('dubSizeW').value : '').trim();
  const hRaw = ($('dubSizeH') ? $('dubSizeH').value : '').trim();
  if (!wRaw || !hRaw) return { ok: false, error: '填宽和高两个数字（如 1080 × 1920）' };
  if (!/^\d+$/.test(wRaw) || !/^\d+$/.test(hRaw)) return { ok: false, error: '宽和高都必须是整数' };
  const w = Number(wRaw), h = Number(hRaw);
  if (w < SIZE_MIN || w > SIZE_MAX || h < SIZE_MIN || h > SIZE_MAX) {
    return { ok: false, error: `宽和高都要在 ${SIZE_MIN}–${SIZE_MAX} 之间` };
  }
  if (w % 2 || h % 2) return { ok: false, error: '宽和高都必须是**偶数**（H.264 编码要求，如 1080 × 1920）' };
  return { ok: true, w, h };
}

/** 当前表单选的尺寸 → {ratio, size}（喂给 POST /api/dub/run）。自定义非法时 ok=false。 */
function currentDubSizeChoice() {
  const sel = $('dubRatio');
  const v = sel ? sel.value : '';
  if (v === CUSTOM_RATIO) {
    const c = checkDubCustomSize();
    return { ratio: state.defaultRatio, size: c.ok ? `${c.w}x${c.h}` : null, custom: true, ok: c.ok, error: c.error };
  }
  return { ratio: v || state.defaultRatio, size: null, custom: false, ok: true, error: null };
}

/** 比例下拉 / 自定义宽高 → 同步界面：显隐自定义框、按校验结果更新提示。 */
function syncDubSizeUI() {
  const sel = $('dubRatio');
  const field = $('dubSizeField');
  const hint = $('dubRatioHint');
  const shint = $('dubSizeHint');
  if (!sel) return;

  const custom = sel.value === CUSTOM_RATIO;
  if (field) field.hidden = !custom;

  if (custom) {
    if (!state.dubSizeW) state.dubSizeW = '1080';
    if (!state.dubSizeH) state.dubSizeH = '1920';
    if ($('dubSizeW') && !$('dubSizeW').value) $('dubSizeW').value = state.dubSizeW;
    if ($('dubSizeH') && !$('dubSizeH').value) $('dubSizeH').value = state.dubSizeH;
    const c = checkDubCustomSize();
    if (hint) hint.textContent = '自定义像素（出片命令带 --size，优先级高于 --ratio）';
    if (shint) {
      shint.textContent = c.ok ? `→ ${c.w} × ${c.h}（出片命令：--size ${c.w}x${c.h}）` : c.error;
      shint.classList.toggle('bad', !c.ok);
    }
    if ($('dubSizeW')) $('dubSizeW').classList.toggle('bad', !c.ok);
    if ($('dubSizeH')) $('dubSizeH').classList.toggle('bad', !c.ok);
  } else {
    const r = state.ratios.find((x) => x.id === sel.value);
    if (hint) {
      hint.textContent = r
        ? `${r.label || r.id}${r.pixels ? `　→ ${r.w} × ${r.h}` : ''}（出片命令：--ratio ${r.id}）`
        : '';
    }
    if (shint) shint.textContent = '';
  }
  syncDubCropWarn();       // 输出尺寸变了 → 重核「素材会不会被裁」
}

/** 把比例下拉填好（预设 + 自定义）。**只在选项集合变了时重建**，不顶掉用户的选择。 */
async function fillDubRatios() {
  const sel = $('dubRatio');
  if (!sel) return;
  const d = await ensureSizes();

  if (!d || !state.ratios.length) {
    // 读不到清单：不硬编码兜底，只禁用下拉并如实说明（服务端仍会按默认 9:16 出片）。
    sel.textContent = '';
    sel.disabled = true;
    const hint = $('dubRatioHint');
    if (hint) hint.textContent = '读取尺寸清单失败（不选 = 服务端按默认 9:16 出片）';
    return;
  }

  const sig = state.ratios.map((r) => r.id).join(',');
  if (sel.dataset.sig !== sig) {
    sel.textContent = '';
    for (const r of state.ratios) {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = r.label || r.id;
      o.title = `${r.label || r.id}：出片命令会带上 --ratio ${r.id}`
        + (r.pixels ? `（${r.w} × ${r.h}）` : '');
      sel.appendChild(o);
    }
    const oc = document.createElement('option');
    oc.value = CUSTOM_RATIO;
    oc.textContent = '自定义尺寸…';
    oc.title = `自己填宽 × 高（偶数、${SIZE_MIN}–${SIZE_MAX}）；出片命令会带上 --size <宽x高>（优先级高于 --ratio）`;
    sel.appendChild(oc);
    sel.dataset.sig = sig;
    // 默认选中服务端给的 defaultRatio（9:16）—— 用户选过就保留他的选择
    const want = (state.dubRatio === CUSTOM_RATIO || state.ratios.some((r) => r.id === state.dubRatio))
      ? state.dubRatio : state.defaultRatio;
    sel.value = want || state.ratios[0].id;
  }
  sel.disabled = false;
  syncDubSizeUI();
}

// ── 素材比例 × 输出比例：会不会把素材裁掉 ────────────────────────
//
// 背景（实测出来的产品代价）：口播素材铺画面时走的是
//   scale=W:H:force_original_aspect_ratio=increase, crop=W:H    （dub.mjs 形态 B 唯一那条几何链）
// 也就是**保持比例放大到铺满，再居中裁切** —— 不是拉伸、也不是留黑边。
// 于是「素材比例」与「输出比例」差得越多，被切掉的就越多：
//   实测 576×1024（9:16，比例 0.5625）→ 1920×1080（16:9，比例 1.7778）
//   只剩源画面中间约 **31.6%** 的纵向带 —— 脸完整，但发顶被切。
//
// ★ 判据 = 「源画面能留下多少」= min(r_src, r_out) / max(r_src, r_out)（r = 宽/高）。
//   推导：放大系数 k = max(W/sw, H/sh)，裁切后保留的那条边的占比恰好化简成上面这个比。
//   实测校验：0.5625 / 1.7778 = 0.3164 —— 与团队量到的 31.6% 一致。
// ★ 阈值 KEEP_MIN = 0.8（即**切掉 ≥20%** 才提示）：不提示同一比例（保留 1.0，没有代价）；
//   预设比例里任意一组「跨比例」组合的保留值都 ≤ 0.75（最小的一对是 9:16↔3:4、16:9↔4:3 = 0.75），
//   所以这条线对预设下拉的实际效果是「跨比例就提示，同比例不提示」；
//   而对「自定义尺寸」它又能放过与素材比例接近的那些（例如素材 9:16 填 1000×1920，保留 0.925 → 不吵）。
// ★ 只在**素材真的会铺画面**时才提示：dub.mjs 的 --keep-original（形态 2）明令不改画面
//   （成片沿用素材尺寸，见 dub.mjs 里「--size / --ratio 在 --keep-original 下不生效」那一段），
//   所以形态 2 下**没有这个风险**，不提示。
// ★ 只提示，不改渲染行为、不禁用「出片」—— 判断权交回用户（这是团队定的处理方式）。
const KEEP_MIN = 0.8;

// ★ 文案分级线 KEEP_HEAD = 0.65：「保留得够不够多到**敢说会切到头顶**」。
//   阈值不动（还是 0.8），只是把「会提示」这一档再分两层，避免对 3:4 说假话。
//   依据（同一支 576×1024 竖屏素材、逐帧实测发顶）：
//     3:4 保留 0.75 → 发顶**完整**（只裁上 12.5% + 下 12.5%，切在天花板灯与下半身）
//     1:1 保留 0.5625 → **临界**（t=2.5s 切约 71 行；t=17.5s 只剩 8 行余量）
//   0.65 正好落在「完整」与「临界」之间：≥0.65 不许提头顶，<0.65 才说会切头顶。
const KEEP_HEAD = 0.65;

/** 素材尺寸（token → {w,h}）。探过一次就缓存；探不到记 null（按「不知道」处理，不提示）。 */
async function dubSrcDims(token) {
  if (!token) return null;
  if (token in state.dubSrcMeta) return state.dubSrcMeta[token];
  try {
    const d = await api('/api/dub/source-meta?token=' + encodeURIComponent(token));
    state.dubSrcMeta[token] = (d && d.ok && d.w && d.h) ? { w: d.w, h: d.h } : null;
  } catch {
    // 接口不在 / WSL 没起 / 探测失败 —— 都不猜尺寸，如实按「不知道」处理（宁可不说，不吓人）
    state.dubSrcMeta[token] = null;
  }
  return state.dubSrcMeta[token];
}

/** 当前表单选的输出像素（自定义非法时返回 null）。判据用 /api/sizes 给的 w/h，不硬编码比例表。 */
function currentDubOutPixels() {
  const sel = $('dubRatio');
  if (!sel) return null;
  if (sel.value === CUSTOM_RATIO) {
    const c = checkDubCustomSize();
    return c.ok ? { w: c.w, h: c.h } : null;
  }
  const r = state.ratios.find((x) => x.id === sel.value);
  return r && r.w && r.h ? { w: r.w, h: r.h } : null;
}

/** 「源画面能留下多少」：min/max(宽高比)。1 = 完全不裁，越小切得越狠。 */
function keepFraction(srcW, srcH, outW, outH) {
  const rs = srcW / srcH, ro = outW / outH;
  return Math.min(rs, ro) / Math.max(rs, ro);
}

// 竞态护栏：尺寸是异步探来的，连点两下时只让最后一次的结果上屏。
let dubCropWarnSeq = 0;

/** 按「已选素材 + 当前输出尺寸 + 当前形态」更新提示。异步（尺寸要探一次），调用方不用等。 */
async function syncDubCropWarn() {
  const box = $('dubCropWarn');
  if (!box) return;
  const seq = ++dubCropWarnSeq;
  // ★ title 也要清：它带着「素材：xxx」这种上下文，隐藏时虽无可见影响，
  //   但残留值会在下次显示前短暂出现，或让调试时误判当前状态。
  const clear = () => { if (seq === dubCropWarnSeq) { box.hidden = true; box.textContent = ''; box.title = ''; } };

  // 形态 2：素材原样不动（不缩放/不裁切）→ 没有这个风险
  if (state.dubMode === 'keep') return clear();
  const token = state.dubVideoToken;
  if (!token) return clear();
  const out = currentDubOutPixels();
  if (!out) return clear();

  const dims = await dubSrcDims(token);
  if (seq !== dubCropWarnSeq) return;              // 期间用户又改了，丢弃这次结果
  if (!dims) return clear();                       // 探不到尺寸 → 不猜、不提示

  const keep = keepFraction(dims.w, dims.h, out.w, out.h);
  if (keep >= KEEP_MIN) return clear();

  const srcName = state.dubVideoName || token;
  const srcAspect = ratioLabel(dims.w, dims.h);
  const outAspect = ratioLabel(out.w, out.h);
  const pct = Math.round(keep * 100);
  // 竖屏素材配横屏输出 = 切上下（保留的是「高度」）；反过来是切左右（保留「宽度」）。
  const cutEdge = (dims.w / dims.h) < (out.w / out.h) ? '高度' : '宽度';
  // 裁切是**居中**的，所以两侧各吃掉一半。
  const sidePct = Math.round((1 - keep) * 500) / 10;
  const edgeWord = cutEdge === '高度' ? '上下' : '左右';
  const edgeEg = cutEdge === '高度' ? '天花板、下半身' : '左右两侧背景';

  // 文案要**具体、可操作**：说清是哪条素材、会怎么处理、大约切掉多少、怎么改。
  // ★ 一律走 textContent（全文件只有风格侧栏那一处 innerHTML）—— 所以不用任何标记语法，
  //   要强调就靠措辞，别写 **加粗**（那会原样显示成星号）。
  // ★ 分两级（见 KEEP_HEAD 的注释）：切得狠才敢说「会切到头顶」；3:4 这类保住了发顶的，
  //   只如实说「上下会被裁掉」，绝不提头顶 —— 那是误告。
  const lead = `⚠️ 这条口播素材是 ${dims.w}×${dims.h}（${srcAspect}），输出却是 ${out.w}×${out.h}（${outAspect}）：`
    + `画面会放大铺满后居中裁切，只保留素材中间约 ${pct}% 的${cutEdge}（${edgeWord}各裁掉约 ${sidePct}%）。`;
  if (keep < KEEP_HEAD) {
    box.textContent = lead
      + `切掉的比较多 —— 人脸一般还在，但头顶、下巴或两侧可能被切掉。`
      + `想避免：把「输出比例」改成和素材一致的 ${srcAspect}，或换一条人物更居中、上下留白更多的素材。`;
  } else {
    box.textContent = lead
      + `人物主体一般还在，切掉的主要是画面边缘（${edgeEg}），成片通常可用。`
      + `想更保险：把「输出比例」改成和素材一致的 ${srcAspect}，或换一条四周留白更多的素材。`;
  }
  box.title = `素材：${srcName}\n`
    + `处理方式：scale=increase + crop（保持比例铺满，居中裁切；不是拉伸，也不留黑边）\n`
    + `保留比例 = min(素材宽高比, 输出宽高比) / max(...) = ${keep.toFixed(4)}（${pct}%）\n`
    + `提示阈值：保留 < ${KEEP_MIN}（即切掉 ≥ ${Math.round((1 - KEEP_MIN) * 100)}%）才提示；`
    + `保留 < ${KEEP_HEAD} 才会说「会切到头顶」，${KEEP_HEAD}–${KEEP_MIN} 只说「上下会被裁掉」`
    + ` —— 只提示，不改出片行为。`;
  box.hidden = false;
}

/** 把宽高比写成「9:16」这种可读标签（只用于文案，不参与任何判断）。 */
function ratioLabel(w, h) {
  const hit = state.ratios.find((r) => r.w === w && r.h === h);
  if (hit) return hit.id;
  const g = gcd(w, h);
  const a = w / g, b = h / g;
  return (a > 40 || b > 40) ? `${(w / h).toFixed(2)}:1` : `${a}:${b}`;
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

// ★ 素材清单现在混着两种 kind（video / srt）：两个下拉各取自己那一类。
//   kind 由服务端给（老登记项由服务端按扩展名补），前端**不靠扩展名猜** —— 猜法迟早与后端漂移。
function dubUploadsOfKind(kind) {
  const d = state.dubUploads;
  const list = (d && Array.isArray(d.uploads)) ? d.uploads : [];
  return list.filter((u) => (u.kind || 'video') === kind);
}

function fillDubSourceSelect(sel, kind, noneLabel) {
  sel.textContent = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = noneLabel;
  sel.appendChild(none);

  const d = state.dubUploads;
  if (d === null) { none.textContent = '正在读已上传的素材…'; return { none, list: [] }; }

  if (d && d.ok === false) {
    // ★ 接口没就绪 / 出错：原样显示，不吞 —— 但「不用素材」这条正常路径照样可用
    none.textContent = `读不到已上传素材：${dubErrText(d.error)}`;
    return { none, list: [] };
  }

  const list = dubUploadsOfKind(kind);
  for (const u of list) {
    const o = document.createElement('option');
    o.value = u.token;
    o.textContent = `${u.name}　${fmtSize(u.size)}　${fmtTime(u.at)}`;
    sel.appendChild(o);
  }
  return { none, list };
}

function renderDubSources() {
  // ★ 「清单为空」有两种含义，不能混为一谈：
  //   ① 清单**已读到**、里面确实没有这条 token → 素材真被删了，该清 token 并告知；
  //   ② 清单**还没读到**（dubUploads === null，正在读）或**读失败**（ok === false）
  //      → 此时列表也是空的，但那是「还不知道」，不是「没了」。
  //   之前 ② 被当成 ① 处理：上传成功后 loadDubSources() 先把 dubUploads 置 null 再渲染，
  //   于是刚写好的 token 被误判为「已删」并清掉（还弹一条误报 toast）—— 素材根本进不来。
  //   → 只有 loaded 为真（清单确实是权威结果）时才允许走清理逻辑。
  const loaded = state.dubUploads !== null && state.dubUploads.ok !== false;

  const sel = $('dubSrcSel');
  if (sel) {
    const { list } = fillDubSourceSelect(sel, 'video', '（不用口播视频）');
    const okTok = loaded && list.some((u) => u.token === state.dubVideoToken);
    sel.value = okTok ? state.dubVideoToken : '';
    // 选中的素材在清单里消失了（文件被删）→ 如实清掉，不硬留一个死 token
    if (loaded && !okTok && state.dubVideoToken) {
      state.dubVideoToken = '';
      state.dubVideoName = '';
      toast('之前选的口播素材已不在清单里（文件可能被删了）—— 已清除', true);
    }
  }

  const ssel = $('dubSrtSel');
  if (ssel) {
    const { list } = fillDubSourceSelect(ssel, 'srt', '（不给 SRT，自动对齐）');
    const okTok = loaded && list.some((u) => u.token === state.dubSrtToken);
    ssel.value = okTok ? state.dubSrtToken : '';
    if (loaded && !okTok && state.dubSrtToken) {
      state.dubSrtToken = '';
      state.dubSrtName = '';
      toast('之前选的 SRT 已不在清单里（文件可能被删了）—— 已清除', true);
    }
  }

  renderDubVideoHint();
  renderDubSrtHint();
  syncDubCropWarn();       // 素材清单变了（选中项可能被清掉）→ 重核提示
}

function renderDubVideoHint() {
  const hint = $('dubVideoHint');
  if (!hint) return;
  if (state.dubVideoToken) {
    hint.textContent = `已选：${state.dubVideoName || state.dubVideoToken}`;
  } else {
    hint.textContent = state.dubMode === 'keep'
      ? '形态 2 必须有口播视频 —— 没选的话「出片」会被拦住'
      : '不选 = 只给文案形态（画面用工具生成的背景）';
  }
}

function renderDubSrtHint() {
  const hint = $('dubSrtHint');
  if (!hint) return;
  hint.textContent = state.dubSrtToken
    ? `已选：${state.dubSrtName || state.dubSrtToken}`
    : '不给 SRT = 自动对齐（优先 ASR）';
}

// ★ 形态 2 的「限幅到交付线」开关提示：勾选时**明说**成片音轨会被重编码、不再逐字节相同。
//   默认（不勾）时也说明默认行为 —— 用户才知道不勾 = 与素材逐字节一致。
function renderDubLimitHint() {
  const hint = $('dubLimitHint');
  if (!hint) return;
  const on = !!($('dubKeepLimit') && $('dubKeepLimit').checked);
  hint.textContent = on
    ? '已开：成片音轨会被重新编码 + 限幅到交付线，不再与素材逐字节相同（画面/时长/内容仍不动）。'
    : '默认关：成片音轨与素材逐字节相同（素材自身真峰值超标时才用得到这个开关）。';
}

function renderDubUpload() {
  const box = $('dubUploadState');
  if (!box) return;
  const u = state.dubUpload;
  box.textContent = '';
  if (!u.busy && !u.error) { box.hidden = true; return; }
  box.hidden = false;

  if (u.error) { box.appendChild(el('div', 'dub-err-detail', '✗ ' + u.error)); return; }

  box.appendChild(el('div', 'dub-up-line', `正在上传 ${u.name} … ${u.pct}%`));
  const track = el('div', 'dub-up-track');
  const fill = el('div', 'dub-up-fill');
  fill.style.width = `${u.pct}%`;
  track.appendChild(fill);
  box.appendChild(track);
  box.appendChild(el('div', 'dub-up-note', '素材存在 D:\\lemo-films\\dub\\_uploads —— 传完就能在下面「用已上传的」里复用'));
}

function renderDubSrtUpload() {
  const box = $('dubSrtState');
  if (!box) return;
  const u = state.dubSrtUpload;
  box.textContent = '';
  if (!u.busy && !u.error) { box.hidden = true; return; }
  box.hidden = false;

  if (u.error) { box.appendChild(el('div', 'dub-err-detail', '✗ ' + u.error)); return; }

  box.appendChild(el('div', 'dub-up-line', `正在上传 ${u.name} … ${u.pct}%`));
  const track = el('div', 'dub-up-track');
  const fill = el('div', 'dub-up-fill');
  fill.style.width = `${u.pct}%`;
  track.appendChild(fill);
  box.appendChild(track);
}

function renderDubLines() {
  const box = $('dubLines');
  const hint = $('dubPreviewHint');
  const cnt = $('dubCount');
  if (!box) return;
  box.textContent = '';

  const p = state.dubPreview;
  if (!p) {
    box.hidden = true;
    if (hint) hint.textContent = '';
    return;
  }
  box.hidden = false;

  if (p.ok === false) {
    const e = el('div', 'dub-err');
    e.appendChild(el('div', 'dub-err-title', '⚠️ 断句预览失败'));
    e.appendChild(el('div', 'dub-err-detail', dubErrText(p.error)));
    // ★ 2026-10-08 复核：原 `if (p.notReady)`「后端接口未就绪（/api/dub/preview）」分支已删除 ——
    //   `/api/dub/preview` 后端**只返 400 / 200**、**从不** 404/503（见 server.mjs 的 apiDubPreview）
    //   ⇒ 它**永远走不到**（`state.dubPreview.notReady` 字段已一并删除，见 startDubPreview 的 catch）。
    //   失败时只显示上面的服务端原样错误，不再假装存在「未就绪」态。
    box.appendChild(e);
    if (hint) hint.textContent = '';
    if (cnt) cnt.textContent = '';
    return;
  }

  const lines = Array.isArray(p.lines) ? p.lines : [];
  const head = el('div', 'dub-lines-head');
  head.appendChild(el('span', '', `共 ${p.count === undefined ? lines.length : p.count} 句`));
  if (p.source === 'fallback') head.appendChild(el('span', 'dub-tag warn', '降级断句'));
  else if (p.source) head.appendChild(el('span', 'dub-tag', `来自 ${p.source}`));
  box.appendChild(head);
  if (p.note) box.appendChild(el('div', 'dub-lines-note', p.note));

  const list = el('div', 'dub-lines-list');
  for (const ln of lines) {
    const row = el('div', 'dub-line');
    row.appendChild(el('span', 'dub-line-i', String(ln.i)));
    row.appendChild(el('span', 'dub-line-t', String(ln.text === undefined ? '' : ln.text)));
    row.appendChild(el('span', 'dub-line-n', `${String(ln.text || '').length} 字`));
    list.appendChild(row);
  }
  box.appendChild(list);

  if (hint) hint.textContent = '断句不对？在文案里用空行手动分开，再点一次「断句预览」';
  if (cnt) cnt.textContent = String(lines.length);
}

function renderDubState() {
  const box = $('dubState');
  const btn = $('btnDubRun');
  const hint = $('dubRunHint');
  const d = state.dub;
  const keep = state.dubMode === 'keep';

  if (btn) {
    btn.disabled = !!d.jobId || !!state.dubBusy;
    btn.textContent = d.jobId ? (keep ? '出片中（叠字幕）…' : '出片中…') : '出片';
  }
  if (hint) {
    // ★ 不写死「每句 30 秒」：实测同一台机器上，空载时 3 句整条 51 秒，
    //   而另一个智能体并发抢 GPU 时同一段文案跑了 22 分钟（差 20 倍以上）。
    //   写死一个数字，用户遇到忙的时候就会以为卡死了 —— 给区间才是诚实的。
    // ★ 形态 2 **不跑 TTS**，所以那句「逐句合成」的提示对它不成立 —— 分开写，别糊弄。
    if (d.jobId) {
      hint.textContent = keep
        ? '形态 2 不跑 TTS：素材的画面与声音原样保留，只叠字幕与风格化叠加层 —— 通常比形态 1 快得多。进度看「实时日志」'
        : '配音是逐句合成的，通常几十秒一句；机器忙的时候可能到几分钟。模型首次加载还要 1~2 分钟 —— 别以为卡死了；进度看「实时日志」';
    } else {
      hint.textContent = '';
    }
  }

  if (!box) return;
  box.textContent = '';
  if (!d.status) { box.hidden = true; return; }
  box.hidden = false;

  if (d.error) {
    const e = el('div', 'dub-err');
    e.appendChild(el('div', 'dub-err-title', '✗ 出片失败'));
    e.appendChild(el('div', 'dub-err-detail', d.error));
    if (d.notReady) {
      e.appendChild(el('div', 'dub-err-hint',
        '后端接口未就绪（/api/dub/run）—— 前端已按契约写好，等后端上线后重试即可。'));
    }
    box.appendChild(e);
    return;
  }

  const label = { queued: '排队中', running: '出片中', done: '已完成', failed: '失败', canceled: '已取消', ended: '已结束' }[d.status] || d.status;
  box.appendChild(el('div', 'dub-state-line', `出片：${label}${d.note ? '　·　' + d.note : ''}`));
  if (d.jobId) {
    box.appendChild(el('div', 'dub-state-sub',
      `任务 ${d.jobId} —— 它也会出现在下面的「任务列表」里（kind=setup），实时日志可以看进度`));
  }
  if (d.out) box.appendChild(el('div', 'dub-state-path', `输出目录　${d.out}`));

  if (d.status === 'done') {
    const line = el('div', 'dub-done');
    if (d.url) {
      const play = el('button', 'btn primary small', '▶ 播放成片');
      play.title = '在播放器弹层里打开 film.mp4';
      play.addEventListener('click', () => openPlayer(`dub/${d.outName}`, 'film.mp4', d.url));
      line.appendChild(play);
      if (d.filmPath) line.appendChild(el('span', 'dub-done-path', d.filmPath));
    } else {
      line.appendChild(el('div', 'dub-err-detail',
        d.filmError || '任务结束了，但没找到 film.mp4 —— 去输出目录里看一眼'));
    }
    box.appendChild(line);
    if (d.filmNote) box.appendChild(el('div', 'dub-state-sub', d.filmNote));
  }
}

// ── 断句预览 ────────────────────────────────────────────────
async function previewDub() {
  if (state.dubPreviewBusy) return;
  const ta = $('dubScript');
  const script = ta ? ta.value : '';
  if (!script.trim()) {
    toast('先粘贴一段文案，再点「断句预览」', true);
    if (ta) ta.focus();
    return;
  }

  state.dubPreviewBusy = true;
  const btn = $('btnDubPreview');
  if (btn) { btn.disabled = true; btn.textContent = '断句中…'; }
  state.dubPreview = null;
  renderDubLines();
  if ($('dubPreviewHint')) $('dubPreviewHint').textContent = '正在向服务端要断句…';

  try {
    const d = await api('/api/dub/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
    });
    state.dubPreview = d || { ok: false, error: '接口返回空' };
  } catch (e) {
    // ★ 2026-10-08 复核：`/api/dub/preview` **从不**返 404/503（后端只返 400 / 200，见 server.mjs 的 apiDubPreview）⇒ 已删掉恒假的 `notReady` 字段（其 UI 分支也已删，见 renderDubLines）—— 失败时把原始信息交给 renderDubLines 原样显示。
    state.dubPreview = { ok: false, error: e.message };
  }

  state.dubPreviewBusy = false;
  if (btn) { btn.disabled = false; btn.textContent = '断句预览'; }
  renderDubLines();
}

// ── 上传素材（口播视频 / SRT，同一条通道）────────────────────
//
// ★ 两种素材走的是**同一个** /api/dub/upload（服务端按扩展名判 kind 并回传）——
//   不另开一条接口：清洗、限额、防穿越、token 登记表只有一处，才不会有一处漏了防护。
// ★ 前端这一层也做一次扩展名/大小预检：不是安全边界（服务端才是），纯粹是**别让用户
//   传完 200MB 才被告知格式不对**。
function dubUploadExtsOf(kind) {
  return kind === 'srt' ? DUB_SRT_EXTS : DUB_EXTS;
}

function uploadDubAsset(file, kind) {
  if (!file) return;
  const exts = dubUploadExtsOf(kind);
  const label = kind === 'srt' ? 'SRT' : '视频';
  const ext = dubExtOf(file.name);
  if (!exts.includes(ext)) {
    toast(`不支持的${label}格式「${ext || '（无扩展名）'}」—— 只收 ${exts.join(' / ')}`, true);
    return;
  }
  if (file.size > DUB_MAX_BYTES) {
    toast(`${label}过大：${fmtSize(file.size)}（上限 ${fmtSize(DUB_MAX_BYTES)}）`, true);
    return;
  }

  const slot = kind === 'srt' ? 'dubSrtUpload' : 'dubUpload';
  const render = kind === 'srt' ? renderDubSrtUpload : renderDubUpload;
  if (state[slot].busy) { toast(`已经有一个${label}上传在跑，等它结束再选`, true); return; }

  state[slot] = { busy: true, pct: 0, name: file.name, error: '' };
  render();

  // ★ 用 XHR 而不是 fetch：fetch 拿不到**上传**进度。200MB 的素材没进度条，用户会以为卡死。
  //   文件名走 query（encodeURIComponent 处理中文），字节走 body —— 服务端按 raw body 收。
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/dub/upload?name=' + encodeURIComponent(file.name));
  xhr.upload.addEventListener('progress', (e) => {
    if (!e.lengthComputable) return;
    state[slot].pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
    render();
  });
  xhr.addEventListener('load', () => {
    let data = null;
    try { data = JSON.parse(xhr.responseText || 'null'); } catch { data = null; }
    if (xhr.status >= 200 && xhr.status < 300 && data && data.ok) {
      state[slot] = { busy: false, pct: 100, name: '', error: '' };
      if (kind === 'srt') {
        state.dubSrtToken = data.token;
        state.dubSrtName = data.name || file.name;
      } else {
        state.dubVideoToken = data.token;
        state.dubVideoName = data.name || file.name;
      }
      render();
      renderDubVideoHint();
      renderDubSrtHint();
      syncDubCropWarn();       // 刚选中的素材要去探一次尺寸，探回来才知道会不会被裁
      toast(kind === 'srt'
        ? `已上传 ${state.dubSrtName}（${fmtSize(data.size)}）—— 出片时用它当字幕时间轴`
        : `已上传 ${state.dubVideoName}（${fmtSize(data.size)}）—— 出片时会用你的视频当画面`);
      loadDubSources();          // 刷新两个「用已上传的」清单（这条新素材也在里面）
      return;
    }
    const msg = (data && data.error) || `HTTP ${xhr.status}`;
    state[slot] = { busy: false, pct: 0, name: '', error: msg };
    render();
    toast('上传失败：' + msg, true);
  });
  xhr.addEventListener('error', () => {
    state[slot] = { busy: false, pct: 0, name: '', error: '网络错误：上传中断' };
    render();
    toast('上传失败：网络错误', true);
  });
  xhr.send(file);
}

function uploadDubFile(file) { uploadDubAsset(file, 'video'); }
function uploadDubSrtFile(file) { uploadDubAsset(file, 'srt'); }

async function loadDubStyles() {
  if (state.dubStylesBusy) return;
  state.dubStylesBusy = true;
  try {
    const d = await api('/api/dub/styles');
    state.dubStyles = d || { ok: false, error: '接口返回空' };
  } catch (e) {
    state.dubStyles = { ok: false, error: e.message, notReady: e.status === 404 || e.status === 503 };
  }
  state.dubStylesBusy = false;
  renderDubStyleOptions();
}

// 竞态护栏：sources 也是异步读的，上传完成与刷新重叠时只让最后一次的结果上屏。
// ★ 与 syncDubCropWarn 的 dubCropWarnSeq 同一套做法：旧响应回来时若已不是最新那次请求，
//   整个丢弃 —— 不改 state.dubUploads、不改 token、不弹 toast。
//   否则旧清单（不含刚上传的那条）会盖掉新状态，刚写好的 token 被误判成「已删」清掉。
let dubSourcesSeq = 0;

async function loadDubSources() {
  const seq = ++dubSourcesSeq;
  state.dubUploads = null;             // → 「正在读已上传的素材…」
  renderDubSources();
  let d;
  try {
    d = await api('/api/dub/sources');
    d = d || { ok: false, error: '接口返回空', uploads: [] };
  } catch (e) {
    d = { ok: false, error: e.message, uploads: [] };   // ★ 2026-10-08 复核：/api/dub/sources 后端只返 200、从不 404/503 ⇒ 删掉恒假的 notReady（且它本来就无消费者，renderDubSources 只读 ok）
  }
  if (seq !== dubSourcesSeq) return;   // 期间又发起了新的刷新，丢弃这次结果（旧响应不得覆盖新状态）
  state.dubUploads = d;
  renderDubSources();
}

// ── 出片（异步任务）─────────────────────────────────────────
async function startDubRun() {
  if (state.dub.jobId || state.dubBusy) { toast('已经有一条出片任务在跑，等它结束再点', true); return; }
  const ta = $('dubScript');
  const script = ta ? ta.value : '';
  if (!script.trim()) { toast('先粘贴一段文案', true); if (ta) ta.focus(); return; }

  const keep = state.dubMode === 'keep';
  // ★ 形态 2 的硬条件：必须有口播素材。前端先拦一道给出人话，服务端还会再拦一道（400）。
  if (keep && !state.dubVideoToken) {
    toast('形态 2 要先上传（或选一条已上传的）口播视频 —— 没素材就没有「保持原样」这回事', true);
    const d = $('dubDrop');
    if (d) d.scrollIntoView({ block: 'center' });
    return;
  }

  // 只把**用户真的设过**的字段发出去 —— 空值让服务端用工具的默认，别用前端的猜测覆盖工具默认
  const body = { script };
  if (state.dubVideoToken) body.videoToken = state.dubVideoToken;

  if (keep) {
    // ★ 形态 2：素材的画面/声音/时长一律不动 —— 所以**不发**音色/语速/停顿/尺寸/fit/保留原声，
    //   服务端那边也会据此不传 --fit。只叠字幕与叠加层。
    body.keepOriginal = true;
    if (state.dubSrtToken) body.srtToken = state.dubSrtToken;
    // ★ 限幅开关：**只在勾选时**发这个键 —— 不勾就不发，服务端因此不传 --keep-original-limit，
    //   成片音轨与素材逐字节相同（与加这个功能之前完全一致）。
    if ($('dubKeepLimit') && $('dubKeepLimit').checked) body.keepOriginalLimit = true;
  } else {
    if (state.dubVoiceOverride) body.voice = state.dubVoiceOverride;
    const speed = Number($('dubSpeed') ? $('dubSpeed').value : '');
    if (Number.isFinite(speed)) body.speed = speed;
    // ★ 输出尺寸：与「主题出片」同一条纪律 —— 显式传 ratio 或 size（size 优先，与 CLI 一致；
    //   两个都不选 → 传默认比例 9:16，行为与加这个功能之前一致）。
    //   自定义尺寸非法就在这里拦住（别让它跑到服务端才拿 400）。
    const sc = currentDubSizeChoice();
    if (!sc.ok) {
      toast('自定义尺寸不合法：' + sc.error, true);
      const f = $('dubSizeField');
      if (f) f.scrollIntoView({ block: 'center' });
      return;
    }
    if (sc.size) body.size = sc.size;
    else if (sc.ratio) body.ratio = sc.ratio;
    const gap = Number($('dubGap') ? $('dubGap').value : '');
    if (Number.isFinite(gap)) body.gap = gap;
    const fit = $('dubFit') ? $('dubFit').value : '';
    if (fit) body.fit = fit;
    if ($('dubKeepAudio') && $('dubKeepAudio').checked) body.keepOriginalAudio = true;
  }

  // ★ 风格：'auto' 要发（那是「按语义自动匹配」这个明确意图）；
  //   只有用户选了「不指定」那一档时才**不发** --style —— 那才是「行为与加这个功能之前一样」。
  if (state.dubStyle && state.dubStyle !== '') body.style = state.dubStyle;

  const title = $('dubTitle') ? $('dubTitle').value.trim() : '';
  if (title) body.title = title;

  state.dub = { jobId: '', status: 'queued', note: '正在提交…', error: '', out: '', outName: '', ticks: 0, url: '', notReady: false };
  state.dubBusy = true; renderDubState();

  try {
    const r = await api('/api/dub/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    state.dub = {
      jobId: r.job.id, status: r.job.status || 'queued', note: '', error: '',
      out: r.out || '', outName: r.outName || '',
      filmPath: (r.artifacts && r.artifacts.film) || '',
      // ★ 成片 URL 由服务端给（不在这里拼路径形状）—— 服务端就是「成片库」取片那条路
      filmUrl: (r.artifacts && r.artifacts.filmUrl) || '',
      ticks: 0, url: '', notReady: false,
    };
    renderDubState();
    pollDub();
  } catch (e) {
    // ★ 404 = 接口还没上线；503 = 后端在线但核心工具 dub.mjs 还没就绪。
    //   两种都**原样显示服务端的话**，只在旁边补一句「未就绪」的指引。
    state.dub = {
      jobId: '', status: 'failed', note: '', error: e.message,
      out: '', outName: '', ticks: 0, url: '', notReady: e.status === 404 || e.status === 503,
    };
    renderDubState();
    toast('出片失败：' + e.message, true);
  } finally { state.dubBusy = false; renderDubState(); }
}

/** 任务成功 ≠ 文件一定在。要一小段字节（Range 0-0）**真的确认**过，才给播放按钮。 */
async function probeDubFilm(url) {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    if (r.ok || r.status === 206) return { ok: true };
    return { ok: false, error: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

function pollDub() {
  clearTimeout(state.dubTimer);
  if (!state.dub.jobId) return;
  state.dubTimer = setTimeout(async () => {
    if (!state.dub.jobId) return;
    if (++state.dub.ticks > DUB_MAX_TICKS) {
      const id = state.dub.jobId;
      state.dub.jobId = '';
      state.dub.error = `任务 ${id} 等了 63 分钟还没结束，不再等（去「任务列表」看它到底怎么了）`;
      renderDubState();
      return;
    }
    try {
      const d = await api('/api/jobs');
      const job = (d.jobs || []).find((j) => j.id === state.dub.jobId);
      if (!job) { state.dub.note = '还没出现在任务列表里…'; renderDubState(); return pollDub(); }
      state.dub.status = job.status;

      if (job.status === 'done') {
        const id = state.dub.jobId;
        state.dub.jobId = '';
        // URL 由服务端在提交时给出（就是「成片库」取片那条路）；没给就退回按目录名拼
        const url = state.dub.filmUrl
          || `/api/films/dub/${encodeURIComponent(state.dub.outName)}/${encodeURIComponent('film.mp4')}`;
        const probe = await probeDubFilm(url);
        if (probe.ok) {
          state.dub.url = url;
          state.dub.filmNote = '成片也在输出目录里（film.mp4 / film.srt / lines.json / dur.json / timeline.json）。'
            + '★ 它同时出现在下面的「成片库」里（标着「文案出片」），也可以点「刷新」让它立刻出现。';
        } else {
          state.dub.filmError = `任务 ${id} 结束了，但 film.mp4 取不到（${probe.error}）—— 去输出目录里看一眼。`;
        }
        renderDubState();
        // 成片库要能立刻看到这条新片（用户下一眼就会去那儿找）
        if (probe.ok) loadFilms();
        toast(probe.ok ? '文案出片完成 —— 播放按钮在卡片底部，也会出现在「成片库」里' : '任务结束，但成片取不到（看卡片里的提示）', !probe.ok);
        return;
      }
      // ★ 用户主动取消 ≠ 故障：必须分开处理，别用红色「失败」措辞吓人（用户会以为出了 bug）。
      //   本仓库里 status=canceled **只**可能由 cancelJob() 产生，而它只被两处调用：
      //     ① DELETE /api/jobs/:id（server.mjs 里该路由的 DELETE 分支）—— 用户自己点「取消」；
      //     ② 服务进程退出时的兜底（server.mjs 的 SIGINT/SIGTERM 处理）—— 那时页面已连不上，走不到这里。
      //   所以前端能到达的 canceled 就是「用户主动取消」，用中性提示即可。
      if (job.status === 'canceled') {
        state.dub.jobId = '';
        state.dub.error = '';
        state.dub.note = '任务已取消（是你自己停掉的，没有产出成片）—— 想重出就再点一次「出片」。';
        renderDubState();
        toast('已取消 —— 这条出片任务是你自己停掉的，没有产出成片');
        return;
      }
      if (job.status === 'failed') {
        state.dub.jobId = '';
        state.dub.error = job.error || '出片失败（去「实时日志」看这一条任务）';
        renderDubState();
        toast('出片失败：' + state.dub.error, true);
        return;
      }
      if (job.status === 'ended') {
        // ★ 'ended' = 控制台重启时这条任务还开着（lib/jobs.mjs 的 loadHistory 标定），已经不在跑了。
        //   原来它落进「非终态」分支 → 会一直轮询到 63 分钟上限才罢休（白等一场）；现在立刻收尾。
        state.dub.jobId = '';
        state.dub.error = '';
        state.dub.note = '任务已结束 —— 控制台重启时它还没跑完，已经不在了（不会产出成片）。';
        renderDubState();
        toast('任务已结束 —— 控制台重启时它还没跑完，已经停了（去「任务列表」可回看日志）');
        return;
      }
      renderDubState();
      pollDub();
    } catch (e) {
      state.dub.note = '查任务状态失败（继续重试）：' + e.message;
      renderDubState();
      pollDub();
    }
  }, 2000);
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
  // 声音版块：选过音色 / 填过语速才追加（用户已在 --q 里手写就让他赢，见 voiceCliOpts）
  const v = voiceCliOpts(q);
  o.push(...v.opts);
  return { slug, opts: o, voiceNotes: v.notes };
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
  const { slug, opts, voiceNotes } = buildOpts();
  if (!slug) { toast('请先选择或输入一个风格', true); $('fSlug').focus(); return; }
  // 声音参数有冲突（用户自己在 --q 里写了）时如实提示，不静默覆盖
  if (voiceNotes && voiceNotes.length) toast(voiceNotes[0], true);

  const btn = $('btnRun'); if (btn.disabled) return;   // ★ 重入守卫：键盘路径(Enter/Ctrl+Enter)绕过按钮 ⇒ 在此拦
  btn.disabled = true;                       // ★ await 前就禁用：否则 precheck 往返窗口内可双击重复入队
  if (!force) {
    hideLockWarn();
    try {
      const pre = await api('/api/precheck?slug=' + encodeURIComponent(slug));
      if (pre && pre.locked) { showLockWarn(pre, slug, opts); btn.disabled = false; return; }
    } catch (e) {
      // 预检本身失败**不阻断启动** —— 它只是提示，不该变成新的故障点
      console.warn('并发预检失败（不阻断启动）：', e);
    }
  } else {
    hideLockWarn();
  }

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
      loadBriefs();     // 出片任务结束 → 对应工单的 done/failed 立刻反映出来（不用等下一次轮询）
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
      f.addEventListener('click', (e) => { e.stopPropagation(); openPlayer(j.slug, j.film, jobFilmUrl(j)); });
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
    } else {
      // ★ 终态任务（done/failed/canceled/ended）→ 「删除」而不是「取消」：
      //   取消一个已经结束的任务语义上是错的；用户真正想要的是把这条历史清掉。
      //   与「取消」分开措辞（见 server.mjs 的 DELETE /api/jobs/:id 按状态分派）。
      //   样式对齐工单的删除按钮（app.js:delBrief / renderBriefs 的 del）。
      const d = el('button', 'btn danger small', '删除');
      d.title = '删掉这条任务记录（不会删成片）';
      d.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`删除任务记录 ${j.id}（${j.slug}）？\n\n只删这条历史记录与它的日志，不删已产出的成片。`)) return;
        try { await api('/api/jobs/' + encodeURIComponent(j.id), { method: 'DELETE' }); toast('已删除'); }
        catch (err) { toast('删除失败：' + err.message, true); }
        loadJobs();
      });
      row.appendChild(d);
    }

    row.addEventListener('click', () => { attachLog(j.id, j.opts); renderJobs(); });
    box.appendChild(row);
  }
}

// 竞态护栏：3 秒轮询 / SSE 结束 / 取消 / runBatch / startRun 等多处并发，
// 只让最后一次请求的结果上屏，免得旧响应盖掉 state.jobs（刚入队的任务闪没）。
let loadJobsSeq = 0;

async function loadJobs() {
  const seq = ++loadJobsSeq;
  try {
    const d = await api('/api/jobs');
    if (seq !== loadJobsSeq) return;   // 期间又发起了新的刷新，丢弃这次结果（旧响应不得覆盖新状态）
    state.jobs = d.jobs || [];
    renderJobs();
    updateEta();     // 任务列表每 3 秒刷一次 → 「预计还需」跟着走，不用另开定时器
  } catch (e) {
    if (seq !== loadJobsSeq) return;   // 同上：旧的失败信息也不得盖掉新状态
    $('jobs').textContent = '';
    $('jobs').appendChild(el('div', 'empty', '读取任务失败：' + e.message));
  }
}

// ── 主题出片（工单）─────────────────────────────────────────
//
// ★ 这一块是「主题 → 出片」的界面：控制台只负责**落工单 / 透传 runOpts / 起任务 / 显示结果**。
//   内容由**外部 LLM（WorkBuddy）**生成 —— 所以 pending 状态要明确写出「去对话里说『处理工单』」，
//   而不是让人在这儿干等。
//
// ★ 状态的唯一事实来源是服务端（GET /api/briefs，每次从磁盘现读）—— 前端不推断、不缓存判断。
//   WorkBuddy 改完文件，这里下一次轮询（3 秒）就能看到。
//
// ★ 安全：工单里的主题是**用户输入**，一律走 el()/textContent，绝不 innerHTML。
const BRIEF_STATUS_CN = { pending: '待处理', ready: '就绪', running: '出片中', done: '已出片', failed: '失败' };
const BRIEF_STATUS_HINT = {
  pending: '还没生成内容 —— 在对话里说「处理工单」，WorkBuddy 会按该风格的 STYLE.md 生成内容并把工单改成就绪。',
  ready: '内容已就绪，可以出片了。',
  running: '正在出片，进度看「实时日志」面板。',
  done: '成片已生成。',
  failed: '上次出片没成功，可以重试。',
};

function briefStyleLabel(slug) {
  const s = (state.briefStyles || []).find((x) => x.slug === slug);
  return s ? `${s.cn}（${s.slug}）` : slug;
}

/** 把 4 个白名单风格填进下拉。**只在下拉为空时填**，免得轮询每 3 秒重建一次、把用户的选择顶掉。 */
function fillBriefStyles() {
  const sel = $('briefSlug');
  if (!sel || sel.options.length || !state.briefStyles.length) return;
  for (const s of state.briefStyles) {
    const o = document.createElement('option');
    o.value = s.slug;
    o.textContent = `${s.cn}（${s.slug}）`;     // 中文名 + slug：中文给人看，slug 给「处理工单」用
    o.title = `画面主体固定为库内已有的那个（字段 ${s.subjectField}）；主题只改文案 / 配色 / 细节 / 台词。`;
    sel.appendChild(o);
  }
  syncBriefLang();      // 风格就位后立刻把语言选项对上（异步，不阻塞渲染）
}

// ── 语言版本（中文版 / 英文版）──────────────────────────────
//
// ★ 选项**不是前端硬编码的**：语言清单来自库侧 core/lang/lang.mjs 的 LANGS，「这个风格有没有某语言版本」
//   按编排器 --lang 的换名规则（content=X.json → X.<code>.json）探测 —— 两件事都在服务端
//   GET /api/langs?slug= 里做完（见 lib/langs.mjs），前端只消费结果、不自己判、不写死 en/zh。
// ★ 默认中文版（用户是中文用户，这个功能就是为中文版做的）；该风格没有中文内容文件时，服务端只返回
//   英文版 → 这里只显示「英文版」并给一句提示（不是静默少一项）。
// ★ 每 3 秒的工单轮询也会走到这里：按 slug 缓存结果，且只在「可选语言集合变了」时重建选项 ——
//   绝不把用户已经选好的值顶掉。
async function ensureLangs(slug) {
  if (state.langCache.has(slug)) return state.langCache.get(slug);
  try {
    const d = await api('/api/langs?slug=' + encodeURIComponent(slug));
    state.langCache.set(slug, d);
    return d;
  } catch (e) {
    return null;      // 读不到就退化成「只有默认语言」——不阻断出片
  }
}

async function syncBriefLang() {
  const sel = $('briefLang');
  const hint = $('briefLangHint');
  if (!sel) return;
  const slug = $('briefSlug').value;
  if (!slug) {
    sel.textContent = '';
    sel.disabled = true;
    if (hint) hint.textContent = '';
    return;
  }

  const d = await ensureLangs(slug);
  if (!d) {
    sel.disabled = true;
    if (hint) hint.textContent = '读取语言版本失败（不选语言 = 默认英文版，出片照常）';
    return;
  }

  const codes = d.codes || [];
  const sig = codes.join(',');
  if (sel.dataset.sig !== sig) {                 // 只在可选集合变了时重建（不顶掉用户的选择）
    sel.textContent = '';
    for (const l of d.langs || []) {
      const o = document.createElement('option');
      o.value = l.code;
      o.textContent = l.label || l.code;
      o.title = `${l.label || l.code}：出片命令会带上 --lang ${l.code}`
        + (l.files && l.files.length ? `\n该语言的内容文件：${l.files.join('、')}` : '');
      sel.appendChild(o);
    }
    sel.dataset.sig = sig;
    // 用户上次明确选过的语言优先；该风格没有就退回服务端给的默认（有中文版就是中文版）
    const want = codes.includes(state.briefLang) ? state.briefLang : d.default;
    sel.value = want || codes[0] || '';
  }
  sel.disabled = codes.length < 2;

  if (hint) {
    if (codes.length < 2) {
      const miss = (d.unavailable || []).map((x) => x.label || x.code);
      hint.textContent = `该风格只有${(d.langs && d.langs[0] ? d.langs[0].label : '一种')}内容文件`
        + (miss.length ? `（没有 ${miss.join(' / ')} 的内容文件）` : '');
    } else {
      hint.textContent = '';
    }
    hint.title = d.registryError ? `语言注册表读取有问题：${d.registryError}` : '';
  }
}

// ── 输出尺寸（预设比例 + 自定义像素）──────────────────────────
//
// ★ 选项**不是前端硬编码的**：比例清单与「比例 → 像素」换算的唯一来源是库侧
//   core/render/size.mjs（控制台侧 lib/sizes.mjs 代理），经服务端 GET /api/sizes 给出来。
//   前端只消费结果 —— 库里改了比例，这里刷新页面就跟着变。
// ★ 默认选中服务端给的 defaultRatio（9:16）。选「自定义」时出现宽 × 高两个数字框，
//   即时校验（偶数、MIN_SIZE–MAX_SIZE）；非法就禁用「生成工单」并给出提示。
// ★ 出片时控制台会**显式**传 `--ratio <比例>`（连默认 9:16 也传）或 `--size <WxH>`。
const CUSTOM_RATIO = '__custom';
// 自定义像素的上下限。**不在这里当权威**：下面 ensureSizes() 会用 GET /api/sizes 的
// custom.min / custom.max 覆盖它们（那一路来自库侧 core/render/size.mjs 的 MIN_SIZE / MAX_SIZE）。
// 这两个初值只是「接口还没回来」时的占位，与库当前值一致（下限 96：16 是编造的，实测 ≤72 必崩）。
let SIZE_MIN = 96, SIZE_MAX = 8192;
// 比例比较的容差（相对值）——与服务端 lib/aspects.mjs 的 ASPECT_TOL 一致。
const ASPECT_TOL = 0.02;

async function ensureSizes() {
  if (state.sizeCache) return state.sizeCache;
  try {
    const d = await api('/api/sizes');
    state.sizeCache = d;
    if (d.defaultRatio) state.defaultRatio = d.defaultRatio;
    state.ratios = d.ratios || [];
    // 自定义像素的上下限也由服务端给（它读库侧 size.mjs 的 MIN_SIZE / MAX_SIZE）——
    // 前端不另存一份，库里改了下限，这里刷新即跟着改。
    if (d.custom) {
      if (Number.isInteger(d.custom.min)) SIZE_MIN = d.custom.min;
      if (Number.isInteger(d.custom.max)) SIZE_MAX = d.custom.max;
      const w = $('briefSizeW'), h = $('briefSizeH');
      if (w) { w.min = String(SIZE_MIN); w.max = String(SIZE_MAX); }
      if (h) { h.min = String(SIZE_MIN); h.max = String(SIZE_MAX); }
    }
    return d;
  } catch (e) {
    return null;      // 读不到就退化成「不传尺寸」——服务端按默认 9:16 处理，不阻断出片
  }
}

/** 自定义像素的校验结果：{ok, w, h, error}。空输入按「还没填完」处理（error 非空但措辞友好）。 */
function checkCustomSize() {
  const wRaw = ($('briefSizeW') ? $('briefSizeW').value : '').trim();
  const hRaw = ($('briefSizeH') ? $('briefSizeH').value : '').trim();
  if (!wRaw || !hRaw) return { ok: false, error: '填宽和高两个数字（如 1080 × 1920）' };
  if (!/^\d+$/.test(wRaw) || !/^\d+$/.test(hRaw)) return { ok: false, error: '宽和高都必须是整数' };
  const w = Number(wRaw), h = Number(hRaw);
  if (w < SIZE_MIN || w > SIZE_MAX || h < SIZE_MIN || h > SIZE_MAX) {
    return { ok: false, error: `宽和高都要在 ${SIZE_MIN}–${SIZE_MAX} 之间` };
  }
  if (w % 2 || h % 2) return { ok: false, error: '宽和高都必须是**偶数**（H.264 编码要求，如 1080 × 1920）' };
  return { ok: true, w, h };
}

/** 当前表单选的尺寸 → {ratio, size}（喂给 POST /api/briefs）。非法时 size 为 null。 */
function currentSizeChoice() {
  const sel = $('briefRatio');
  const v = sel ? sel.value : '';
  if (v === CUSTOM_RATIO) {
    const c = checkCustomSize();
    return { ratio: state.defaultRatio, size: c.ok ? `${c.w}x${c.h}` : null, custom: true, ok: c.ok, error: c.error };
  }
  return { ratio: v || state.defaultRatio, size: null, custom: false, ok: true, error: null };
}

/** 把比例下拉填好（预设 + 自定义）。**只在选项集合变了时重建**，不顶掉用户的选择。 */
async function fillBriefRatios() {
  const sel = $('briefRatio');
  if (!sel) return;
  const d = await ensureSizes();
  const hint = $('briefRatioHint');

  if (!d || !state.ratios.length) {
    // 读不到清单：不硬编码兜底，只禁用下拉并如实说明（服务端仍会按默认 9:16 出片）。
    sel.textContent = '';
    sel.disabled = true;
    if (hint) hint.textContent = '读取尺寸清单失败（不选 = 服务端按默认 9:16 出片）';
    return;
  }

  const sig = state.ratios.map((r) => r.id).join(',');
  if (sel.dataset.sig !== sig) {
    sel.textContent = '';
    for (const r of state.ratios) {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = r.label || r.id;
      o.title = `${r.label || r.id}：出片命令会带上 --ratio ${r.id}`
        + (r.pixels ? `（${r.w} × ${r.h}）` : '');
      sel.appendChild(o);
    }
    const oc = document.createElement('option');
    oc.value = CUSTOM_RATIO;
    oc.textContent = '自定义尺寸…';
    oc.title = `自己填宽 × 高（偶数、${SIZE_MIN}–${SIZE_MAX}）；出片命令会带上 --size <宽x高>（优先级高于 --ratio）`;
    sel.appendChild(oc);
    sel.dataset.sig = sig;
    const want = (state.briefRatio === CUSTOM_RATIO || state.ratios.some((r) => r.id === state.briefRatio))
      ? state.briefRatio : state.defaultRatio;
    sel.value = want || state.ratios[0].id;
  }
  sel.disabled = false;
  syncBriefSizeUI();      // 由它顺带更新构图能力警告（syncBriefAspectWarn）
}

/** 比例下拉 / 自定义宽高 → 同步界面：显隐自定义框、更新提示、按校验结果启停「生成工单」。 */
function syncBriefSizeUI() {
  const sel = $('briefRatio');
  const field = $('briefSizeField');
  const hint = $('briefRatioHint');
  const shint = $('briefSizeHint');
  if (!sel) return;

  const custom = sel.value === CUSTOM_RATIO;
  if (field) field.hidden = !custom;

  let invalid = false;
  if (custom) {
    if (!state.briefSizeW) state.briefSizeW = '1080';
    if (!state.briefSizeH) state.briefSizeH = '1920';
    if ($('briefSizeW') && !$('briefSizeW').value) $('briefSizeW').value = state.briefSizeW;
    if ($('briefSizeH') && !$('briefSizeH').value) $('briefSizeH').value = state.briefSizeH;
    const c = checkCustomSize();
    invalid = !c.ok;
    if (hint) hint.textContent = '自定义像素（出片命令带 --size）';
    if (shint) {
      shint.textContent = c.ok ? `→ ${c.w} × ${c.h}（出片命令：--size ${c.w}x${c.h}）` : c.error;
      shint.classList.toggle('bad', !c.ok);
    }
    if ($('briefSizeW')) $('briefSizeW').classList.toggle('bad', !c.ok);
    if ($('briefSizeH')) $('briefSizeH').classList.toggle('bad', !c.ok);
  } else {
    const r = state.ratios.find((x) => x.id === sel.value);
    if (hint) {
      hint.textContent = r
        ? `${r.label || r.id}${r.pixels ? `　→ ${r.w} × ${r.h}` : ''}（出片命令：--ratio ${r.id}）`
        : '';
    }
    if (shint) { shint.textContent = ''; shint.classList.remove('bad'); }
    if ($('briefSizeW')) $('briefSizeW').classList.remove('bad');
    if ($('briefSizeH')) $('briefSizeH').classList.remove('bad');
  }

  const btn = $('btnBriefCreate');
  if (btn) btn.disabled = state.briefBusy || invalid;

  syncBriefAspectWarn();      // 尺寸一变就重核「会不会被裁」（只警告，不禁用出片）
}

// ── 影片构图能力（防呆：出片前告诉你会被裁）──────────────────
//
// ★ 判据**不在前端**：影片模块的 `FILM_META.aspects` 声明由服务端**读源码文本**探测（影片模块是浏览器
//   ESM，node 不能 import）——见 lib/aspects.mjs 与 GET /api/aspects。风格下拉里那一项带的 `aspects`
//   就是服务端算好的结果（随 GET /api/briefs 的 styles[] 一起来），前端只消费、不自己判。
// ★ 没声明 aspects = 只支持 16:9（= 没改造过，给别的尺寸会被裁切）。
// ★ 这里**只显示警告，不禁用「生成工单」** —— 用户有权坚持出，只是要提前知情（出了片才发现被裁才是真问题）。

/** 当前表单选的尺寸 → 像素 {w,h}（自定义非法时返回 null）。 */
function currentSizePixels() {
  const sel = $('briefRatio');
  if (!sel) return null;
  if (sel.value === CUSTOM_RATIO) {
    const c = checkCustomSize();
    return c.ok ? { w: c.w, h: c.h } : null;
  }
  const r = state.ratios.find((x) => x.id === sel.value);
  return r && r.w && r.h ? { w: r.w, h: r.h } : null;
}

/** 一组像素是否落在某个比例上（相对容差，与服务端同一条判据）。 */
function matchesAspect(w, h, ratioId) {
  const [a, b] = String(ratioId).split(':').map(Number);
  if (!a || !b) return false;
  const want = a / b;
  return Math.abs(w / h - want) / want <= ASPECT_TOL;
}

/** 按「当前风格 + 当前尺寸」更新警告。选中的尺寸落在支持列表内 → 隐藏。 */
function syncBriefAspectWarn() {
  const box = $('briefAspectWarn');
  const sel = $('briefRatio');
  if (!box || !sel) return;
  // ★ 幂等：本函数会被多次调用（尺寸变 / 风格变 / 清单刷新都会重核）—— **先清空容器再重建**，
  //   否则每调用一次就多堆一个「改用 X」按钮。box.textContent='' 连文本带旧按钮一起清掉。
  box.textContent = '';
  const slug = $('briefSlug') ? $('briefSlug').value : '';
  const st = (state.briefStyles || []).find((s) => s.slug === slug);
  // 拿不到该风格的 aspects（清单还没读回来 / 服务端没给）→ 不猜、不吓人，按「不警告」处理。
  if (!st || !st.aspects || !Array.isArray(st.aspects.supported)) { box.hidden = true; box.title = ''; return; }
  const sup = st.aspects.supported;
  const px = currentSizePixels();
  let msg = '';
  if (px && !sup.some((id) => matchesAspect(px.w, px.h, id))) {
    const what = sel.value === CUSTOM_RATIO ? `自定义尺寸 ${px.w}×${px.h}` : `${sel.value}（${px.w}×${px.h}）`;
    msg = `⚠️ ${st.cn}（${slug}）的影片未适配 ${what}：出这个尺寸画面会被裁切，建议改用 ${sup.join(' / ')}。`
      + (st.aspects.declared ? '' : ' 该影片没写 aspects 声明 = 只支持 16:9。')
      + ' 仍然可以出片 —— 只是要知道画面会被裁。';
  }
  if (!msg) { box.hidden = true; box.title = ''; return; }

  // ★ 把「建议改用的比例」做成**可点的一键修复** —— 光给文本要用户自己去下拉里找再改一次，
  //   摩擦大到等于没修（警告是「被动文本」时，用户实际不会去改）。
  // ★ 比例**动态取** sup 的第一个（不写死 16:9）：现在恰好都是 16:9，但别依赖这个巧合。
  const suggest = sup[0];
  box.appendChild(el('span', 'baw-msg', msg));
  const fix = el('button', 'btn ghost small baw-fix', `改用 ${suggest}`);
  fix.type = 'button';                 // 页面里没有 <form>，仍显式声明，免得将来被当成提交按钮
  fix.title = `把「输出尺寸」改成 ${suggest}（${st.cn} 的影片按这个比例构图）—— 只改尺寸，不会出片`;
  fix.addEventListener('click', () => {
    // ★ 该比例必须在当前下拉里**真的存在**才设：否则会把 select 设成空值（比不改更糟）→ 只提示。
    if (![...sel.options].some((o) => o.value === suggest)) {
      toast(`当前尺寸清单里没有 ${suggest}，请手动选一个该风格支持的尺寸`, true);
      return;
    }
    sel.value = suggest;
    // ★ 派发 change 让既有的监听走完：syncBriefSizeUI → syncBriefAspectWarn 会因此重核，
    //   尺寸已落在支持列表内 → 警告随之消失。★ 这里**只改尺寸，绝不触发任何出片**。
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  box.appendChild(fix);

  box.hidden = false;
  box.title = `影片按 1920×1080 的绝对像素构图，给别的尺寸会被裁切（不是重排、也不是留黑边）。\n`
    + `能力来自影片源码里的 FILM_META.aspects 声明（服务端读源码文本探测，${st.aspects.probe || 'text'}）。\n`
    + `该风格已知支持：${sup.join(' / ')}。让影片支持多比例的做法见库侧 MAINTAINING.md。`;
}

async function copyTextTo(text, btn, label) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; }
  catch {
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
  const old = btn.textContent;
  btn.textContent = ok ? '已复制' : '复制失败';
  btn.classList.toggle('copied', ok);
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1300);
  if (ok) toast(`${label}已复制到剪贴板`);
  else toast('复制失败：浏览器拒绝了剪贴板访问，请手动选中复制', true);
}

/** 一张工单的行。状态不同 → 给不同的按钮（这是这个界面唯一「有判断」的地方，判据全是服务端给的 status）。 */
function briefRow(b) {
  const row = el('div', 'brief ' + b.status);
  const line = el('div', 'brief-line');

  line.appendChild(el('span', 'status ' + b.status, BRIEF_STATUS_CN[b.status] || b.status));
  line.appendChild(el('span', 'bslug', briefStyleLabel(b.slug)));
  const topic = el('span', 'btopic', b.topic);
  topic.title = b.topic;
  line.appendChild(topic);
  line.appendChild(el('span', 'bid', b.id));

  const meta = [];
  if (b.langCn) meta.push(b.langCn);              // 语言版本（中文版 / 英文版）
  if (b.sizeDisplay) meta.push('尺寸 ' + b.sizeDisplay);   // 输出尺寸（9:16 或自定义 1080x1920）
  meta.push(fmtTime(Date.parse(b.createdAt)));
  if (b.status === 'running' && b.startedAt) meta.push('已跑 ' + fmtDur(Date.parse(b.startedAt), null));
  else if (b.startedAt && b.endedAt) meta.push('耗时 ' + fmtDur(Date.parse(b.startedAt), Date.parse(b.endedAt)));
  if (b.runOpts && b.runOpts.length) meta.push('runOpts ' + b.runOpts.join(' '));
  line.appendChild(el('span', 'bmeta', meta.join(' · ')));
  line.appendChild(el('span', 'bspacer'));

  if (b.status === 'pending') {
    // 这是这个界面**最重要**的一个按钮：主题得先被 WorkBuddy 拿到手
    const copy = el('button', 'btn ghost small', '复制主题');
    copy.title = '把主题复制到剪贴板，粘到对话里让 WorkBuddy 处理';
    copy.addEventListener('click', (e) => { e.stopPropagation(); copyTextTo(b.topic, copy, '主题'); });
    line.appendChild(copy);
  }
  if (b.status === 'ready') {
    const run = el('button', 'btn primary small', '出片');
    // 命令预览要**如实**反映服务端会拼出的命令行（含语言版本与输出尺寸；
    // 语言默认 en 不带 --lang；尺寸**总是显式**带 --ratio 或 --size）
    const langArg = b.lang && b.lang !== state.defaultLang ? ` --lang ${b.lang}` : '';
    const sizeArg = (b.sizeInfo && b.sizeInfo.isCustom && b.sizeInfo.valid)
      ? ` --size ${b.sizeDisplay}`
      : ` --ratio ${b.ratio || state.defaultRatio}`;
    run.title = `跑 node lemo-make.mjs ${b.slug} --skip-sync ${(b.runOpts || []).join(' ')}${langArg}${sizeArg}`.trim();
    run.addEventListener('click', (e) => { e.stopPropagation(); runBrief(b.id, run, false); });
    line.appendChild(run);
  }
  if (b.status === 'running') {
    const lg = el('button', 'btn ghost small', '看日志');
    lg.title = '把实时日志挂到「实时日志」面板';
    lg.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!b.jobId) return toast('这张工单没有关联的任务 id', true);
      attachLog(b.jobId, null);
      renderJobs();
    });
    line.appendChild(lg);
  }
  if (b.status === 'done') {
    if (b.film && b.filmUrl) {
      const play = el('button', 'btn ghost small', '▶ 播放');
      play.addEventListener('click', (e) => { e.stopPropagation(); openPlayer(b.slug, b.film, briefFilmUrl(b)); });
      line.appendChild(play);
      line.appendChild(el('span', 'bfilm', b.film));
    } else {
      line.appendChild(el('span', 'bmeta', '成片文件没找到（可能被移走或改名了）'));
    }
  }
  if (b.status === 'failed') {
    const retry = el('button', 'btn primary small', '重试');
    retry.title = '重新出片（工单回到 running；不会重新生成内容）';
    retry.addEventListener('click', (e) => { e.stopPropagation(); runBrief(b.id, retry, true); });
    line.appendChild(retry);
  }
  if (b.status !== 'running') {
    const del = el('button', 'btn danger small', '删除');
    del.title = '删掉这张工单（不会删成片）';
    del.addEventListener('click', (e) => { e.stopPropagation(); delBrief(b); });
    line.appendChild(del);
  }
  row.appendChild(line);

  // ★ 影片构图能力警告（服务端算好的派生字段）：这张工单选的尺寸落不落在这部影片**真的能构图**的比例上。
  //   服务端已按工单的 --film（若有）判过；这里只显示，不重复判、也**不禁用**任何按钮。
  if (b.aspectWarning) {
    const w = el('div', 'bwarn', '⚠️ ' + b.aspectWarning);
    w.title = b.aspectWarningDetail || b.aspectWarning;
    row.appendChild(w);
  }

  // 说明行：把「现在该做什么」写清楚（pending 必须说清去对话里说「处理工单」）
  const notes = [BRIEF_STATUS_HINT[b.status] || ''];
  if (b.error) notes.push('错误：' + b.error);
  if (b.notes) notes.push('备注：' + b.notes);
  if (b.contentRel) notes.push('内容 ' + b.contentRel);
  if (b.linesRel) notes.push('台词 ' + b.linesRel);
  const note = el('div', 'brief-note', notes.filter(Boolean).join(' · '));
  note.title = notes.filter(Boolean).join('\n');
  row.appendChild(note);
  return row;
}

function renderBriefs() {
  const box = $('briefs');
  if (!box) return;
  box.textContent = '';
  $('briefCount').textContent = state.briefs.length ? String(state.briefs.length) : '';

  if (!state.briefs.length) {
    const e = el('div', 'empty');
    e.appendChild(el('div', null, '还没有工单。'));
    e.appendChild(el('div', 'empty-sub',
      '在上面输入一个主题、选风格 / 语言版本 / 输出尺寸 → 点「生成工单」；然后在对话里说「处理工单」，内容就绪后回到这里点「出片」。'));
    box.appendChild(e);
    return;
  }
  for (const b of state.briefs) box.appendChild(briefRow(b));
}

// 竞态护栏：3 秒轮询 / SSE / 建工单 / 出片 / 删除等多处并发，
// 只让最后一次请求的结果上屏，免得旧响应盖掉 briefs/briefStyles/defaultLang/defaultRatio。
let loadBriefsSeq = 0;

async function loadBriefs() {
  const seq = ++loadBriefsSeq;
  try {
    const d = await api('/api/briefs');
    if (seq !== loadBriefsSeq) return;   // 期间又发起了新的刷新，丢弃这次结果（旧响应不得覆盖新状态）
    state.briefs = d.briefs || [];
    state.briefStyles = d.styles || [];
    if (d.defaultLang) state.defaultLang = d.defaultLang;   // 判据来自服务端，前端不写死 'en'
    if (d.defaultRatio) state.defaultRatio = d.defaultRatio; // 默认输出比例（9:16）—— 同理不写死
    fillBriefStyles();
    fillBriefRatios();                                       // 尺寸下拉（选项来自 /api/sizes）
    renderBriefs();
    if (d.disabledReason) {
      $('briefHint').textContent = '工单目录不可用：' + d.disabledReason;
    }
  } catch (e) {
    if (seq !== loadBriefsSeq) return;   // 同上：旧的失败信息也不得盖掉新状态
    const box = $('briefs');
    if (!box) return;
    box.textContent = '';
    box.appendChild(el('div', 'empty', '读取工单失败：' + e.message));
  }
}

async function createBriefFromForm() {
  if (state.briefBusy) return;
  const topic = $('briefTopic').value.trim();
  const slug = $('briefSlug').value;
  // 语言版本：值就是库侧 LANGS 的键（en / zh）。下拉还没填好时留空 → 服务端按默认语言处理。
  const lang = $('briefLang') ? $('briefLang').value : '';
  // 输出尺寸：预设比例 或 自定义像素（出片时控制台会显式传 --ratio / --size）。
  const sizeChoice = currentSizeChoice();
  if (!topic) { toast('先写一个主题', true); $('briefTopic').focus(); return; }
  if (!slug) { toast('还没有可选风格（工单目录可能不可用）', true); return; }
  if (sizeChoice.custom && !sizeChoice.ok) {
    toast('自定义尺寸不合法：' + (sizeChoice.error || ''), true);
    if ($('briefSizeW')) $('briefSizeW').focus();
    return;
  }

  const btn = $('btnBriefCreate');
  state.briefBusy = true;
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = '生成中…';
  try {
    const d = await api('/api/briefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic, slug, lang,
        ratio: sizeChoice.ratio,
        ...(sizeChoice.size ? { size: sizeChoice.size } : {}),
      }),
    });
    $('briefTopic').value = '';
    $('briefHint').textContent = `已建工单 ${d.brief.id}（${d.brief.langCn || d.brief.lang}，${d.brief.sizeDisplay}）—— 在对话里说「处理工单」`;
    toast(`工单已创建（${d.brief.id}，${d.brief.langCn || d.brief.lang}，尺寸 ${d.brief.sizeDisplay}）。在对话里说「处理工单」让 WorkBuddy 生成内容`);
    await loadBriefs();
  } catch (e) {
    toast('建工单失败：' + e.message, true);
  } finally {
    state.briefBusy = false;
    btn.textContent = old;
    syncBriefSizeUI();      // 由它决定按钮该不该禁用（自定义尺寸非法时仍禁用）
  }
}

/** 出片 / 重试。retry=true 时服务端才允许 failed → running（见 server.mjs:apiBriefRun）。 */
async function runBrief(id, btn, retry) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '启动中…';
  try {
    // ★ 音色 / 语速：与主表单**共用同一份本机偏好**（loadVoicePref 读的就是 VOICE_KEY / SPEED_KEY），
    //   也共用同一处判据（voiceCliOpts 负责「--q 里手写了就让用户赢」与 0.5–2 的范围校验）——
    //   于是「主题出片」入口出的片和「开始生成」入口出的片音色一致，不会两个入口行为不同。
    //   ★ retry 不能被丢掉（服务端只有带它才允许 failed → running）。
    const { opts: vOpts } = voiceCliOpts('');
    const body = retry ? { retry: true } : {};
    for (let i = 0; i + 1 < vOpts.length; i += 2) {
      if (vOpts[i] === '--voice') body.voice = vOpts[i + 1];
      else if (vOpts[i] === '--speed') body.speed = Number(vOpts[i + 1]);
    }
    const d = await api('/api/briefs/' + encodeURIComponent(id) + '/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const w = (d.warnings || []);
    toast(w.length ? `已开始出片（注意：${w[0]}）` : `已开始出片：${id}`);
    for (const s of w) $('briefHint').textContent = '⚠️ ' + s;
    await loadBriefs();
    await loadJobs();
    if (d.job && d.job.id) { attachLog(d.job.id, d.job.opts); renderJobs(); }
  } catch (e) {
    toast('出片失败：' + e.message, true);
    await loadBriefs();          // 409 时把最新状态拉回来（可能已被别处改过）
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

async function delBrief(b) {
  if (!confirm(`删除工单 ${b.id}（主题：${b.topic}）？\n\n只删工单，不删成片、不删已生成的内容文件。`)) return;
  try {
    await api('/api/briefs/' + encodeURIComponent(b.id), { method: 'DELETE' });
    toast('工单已删除');
  } catch (e) {
    toast('删除失败：' + e.message, true);
  }
  await loadBriefs();
}

// ── 成片库（排序 / 筛选 / 重新生成 / 打开目录）───────────────
//
// ★ 库里现在有**两类**条目，服务端用 source/slug 区分（见 server.mjs:apiFilms / dubFilms）：
//   · 风格成片：`slug = 风格名` —— 能「重新生成」（把风格与上次的参数填回启动表单）、能「打开目录」。
//   · 文案出片：`source:'dub'` + `slug:null` —— 它**没有风格 slug**，所以任何「按 slug 找风格」的
//     操作（重新生成 / 打开目录）对它都没有意义，点了只会报错 → 这两类按钮对 dub 条目**不渲染**。
//   ★ 不是禁用而是**不渲染**：一个点了必然报错的按钮，摆在那里就是误导。
function filmIsDub(f) {
  return !!(f && (f.source === 'dub' || !f.slug));
}

/** 控制台出片的产物（服务端 `jobFilms` 标了 `source:'job'`）：落在 `_jobs\<任务id>\`，不是样板片。 */
function filmIsJob(f) {
  return !!(f && f.source === 'job');
}

/**
 * 控制台出片的成片 URL —— 它的路由比样板片**深一层**（`/api/films/_jobs/<任务id>/<文件>`）。
 *
 * ★ 为什么需要它：任务行 / 工单行的「▶ 成片」原本按 `<slug>` 拼 URL（`/api/films/<slug>/<文件>`），
 *   那是**样板片**路由。控制台出片现在写进 `_jobs\<任务id>\`（见 lib/jobs.mjs:jobOutDir），
 *   产物不在样板片目录里 ⇒ 照旧拼法会打开样板片（或 404）。
 * ★ 产物不在 `_jobs` 下（用户自带 `--out` 落在别处）→ 返回 null，调用方退回既有拼法。
 */
function jobFilmUrl(j) {
  if (!j || !j.film || !/\\_jobs\\/.test(String(j.film))) return null;
  const name = String(j.film).replace(/\\/g, '/').split('/').pop();
  return `/api/films/_jobs/${encodeURIComponent(j.id)}/${encodeURIComponent(name)}`;
}

/** 工单的成片 URL：优先用**这次任务真实产出的那份**（从 state.jobs 里按 jobId 找），退回服务端给的 filmUrl。 */
function briefFilmUrl(b) {
  const j = (state.jobs || []).find((x) => x.id === b.jobId);
  return jobFilmUrl(j) || b.filmUrl;
}

/** 成片标题：dub 条目没有风格名，用「文案出片」+ 出片目录名代替。 */
function filmTitle(f) {
  if (filmIsDub(f)) return '文案出片';
  const s = state.styles.find((x) => x.slug === f.slug);
  return (s && s.nameCn) || f.slug;
}

/** 播放器标题与排序用的稳定 key（dub 条目没有 slug，用出片目录名兜底）。 */
function filmKey(f) {
  return filmIsDub(f) ? `文案出片 ${f.name || ''}`.trim() : String(f.slug);
}

function sortedFilms() {
  const q = (state.filmQuery || '').trim().toLowerCase();
  const list = state.films.filter((f) => !q
    || (f.slug || '').toLowerCase().includes(q)
    || (f.file || '').toLowerCase().includes(q)
    || (f.name || '').toLowerCase().includes(q)        // dub 条目：按出片目录名（时间戳）也能搜到
    || (filmIsDub(f) && '文案出片'.includes(q)));
  const s = state.filmSort;
  list.sort((a, b) => {
    if (s === 'size') return b.size - a.size;
    if (s === 'slug') return filmKey(a).localeCompare(filmKey(b)) || b.mtime - a.mtime;
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
    const dub = filmIsDub(f);
    const job = filmIsJob(f);
    const s = dub ? null : state.styles.find((x) => x.slug === f.slug);
    const c = el('div', 'film' + (dub ? ' dub' : ''));

    const title = el('div', 'fslug', filmTitle(f));
    c.appendChild(title);
    c.appendChild(el('div', 'fmeta', `${fmtSize(f.size)} · ${fmtTime(f.mtime)}`));
    c.appendChild(el('div', 'fmeta', f.file));
    // dub 条目：把出片目录名（含时间戳）显出来 —— 用户在资源管理器里就是按它找的
    if (dub) c.appendChild(el('div', 'fmeta', `dub\\${f.name}`));
    else if (s && s.nameCn) c.appendChild(el('div', 'fmeta', f.slug));
    // ★ 控制台出片：把出片目录（= 任务 id）显出来 —— 它在 `_jobs\<任务id>\`，不是样板片目录
    if (job) c.appendChild(el('div', 'fmeta', `_jobs\\${f.jobId}`));

    const acts = el('div', 'factions');

    const play = el('button', 'btn ghost small', '播放');
    play.addEventListener('click', (e) => { e.stopPropagation(); openPlayer(filmKey(f), f.file, f.url); });
    acts.appendChild(play);

    // ★ 只有「风格成片」才有重新生成 / 打开目录 —— dub 条目没有 slug，这两个操作无从下手
    if (!dub) {
      const regen = el('button', 'btn ghost small', '重新生成');
      regen.title = '把这个风格和它上次用的参数填回启动表单（不会自动启动）';
      regen.addEventListener('click', (e) => { e.stopPropagation(); regenFilm(f.slug); });
      acts.appendChild(regen);

      if (job) {
        // ★ 控制台出片的落盘目录是 `_jobs\<任务id>`，与风格样板目录 `D:\lemo-films\<slug>` **不是一回事**。
        //   这里不摆「打开目录」（它按 slug 开，会开到样板目录，误导）—— 改为如实标出真实位置。
        const note = el('span', 'film-note', `控制台出片 · 任务 ${f.jobId}`);
        note.title = `这条片子由控制台出片任务 ${f.jobId} 产出，落在 D:\\lemo-films\\_jobs\\${f.jobId}`
          + '（与风格样板目录 D:\\lemo-films\\<风格> 不是一回事）。';
        acts.appendChild(note);
      } else {
        const open = el('button', 'btn ghost small', '打开目录');
        open.title = `在资源管理器里打开 D:\\lemo-films\\${f.slug}`;
        open.addEventListener('click', (e) => { e.stopPropagation(); revealDir(f.slug); });
        acts.appendChild(open);
      }
    } else {
      // 不摆一个点了必然报错的按钮，但把「为什么没有」说清楚（用户有权知道）
      const note = el('span', 'film-note', '无风格 slug → 不能重新生成');
      note.title = '文案出片不是由某个风格生成的，没有可回填的风格参数；要重做请回「文案出片」卡片再出一次。';
      acts.appendChild(note);
    }

    c.appendChild(acts);
    c.addEventListener('click', () => openPlayer(filmKey(f), f.file, f.url));
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
    // 声音版块新增的两个选项：也映射回表单，否则「重新生成」会谎报「表单不支持、已忽略」
    else if (o === '--voice') {
      state.voiceSel = val() || '';
      saveVoicePref(VOICE_KEY, state.voiceSel);
      renderVoices(); renderVoiceCurrent();
      applied.push(o + ' ' + val()); i++;
    }
    else if (o === '--speed') {
      state.voiceSpeed = val() || '';
      saveVoicePref(SPEED_KEY, state.voiceSpeed);
      if ($('fVoiceSpeed')) $('fVoiceSpeed').value = state.voiceSpeed || '1.0';
      renderVoiceCurrent();
      applied.push(o + ' ' + val()); i++;
    }
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

// 竞态护栏：SSE / pollDub / 手动刷新可重叠，只让最后一次请求的结果上屏。
let loadFilmsSeq = 0;

async function loadFilms() {
  const seq = ++loadFilmsSeq;
  try {
    const d = await api('/api/films');
    if (seq !== loadFilmsSeq) return;   // 期间又发起了新的刷新，丢弃这次结果（旧响应不得覆盖新状态）
    state.films = d.films || [];
    renderFilms();
    renderStyles($('search').value);
  } catch (e) {
    if (seq !== loadFilmsSeq) return;   // 同上：旧的失败信息也不得盖掉新状态
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
// 竞态护栏：与 loadFilms 同一批触发点，只让最后一次请求的结果上屏。
let loadStylesBadgesSeq = 0;

async function loadStylesBadges() {
  const seq = ++loadStylesBadgesSeq;
  try {
    const d = await api('/api/demos');
    if (seq !== loadStylesBadgesSeq) return;   // 期间又发起了新的刷新，丢弃这次结果（旧响应不得覆盖新状态）
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

// ── LLM API 配置（/api/llm/*）─────────────────────────────────
//
// 面板逻辑。★ 契约：D:/lemo-tmp/llm-api-spec.md §七（接口）/ §八（落盘）；后端见 server.mjs 的
// /api/llm/* 组说明。
//
// ★ 三条纪律（本项目铁律）：
//   ① **后端异常不得搞崩前端**：所有请求走 llmReq()，它把「网络失败 / 非 JSON / 结构异常」
//      统统兜成 `{ok:false,error}`（本项目既有坑：异常返回把前端搞崩）。
//   ② **key 永不回显**：界面只显示「已配置 / 未配置」；key 输入框留空 = 不改。
//   ③ 三步校验**逐步**点亮（可达 → 鉴权 → 返回体），失败给可操作中文提示。

const LLM_STEP_ORDER = ['reachable', 'auth', 'shape'];
const LLM_STEP_ICO = { pending: '○', running: '⟳', ok: '✓', fail: '✗', skip: '–' };
const llmState = { profiles: [], current: 'workbuddy', cfg: null, busy: false, models: [] };

function llmSleep(ms) { return new Promise((res) => setTimeout(res, ms)); }
function llmSafeStr(o) { try { return JSON.stringify(o).slice(0, 200); } catch { return String(o); } }

/** 统一请求：把一切异常兜成 {ok,data|error}，**绝不抛**。 */
async function llmReq(path, opts) {
  let res;
  try { res = await api(path, opts); }
  catch (e) {
    const raw = e && e.data && (typeof e.data.raw === 'string' ? e.data.raw : e.data.error);
    const message = (typeof raw === 'string' && raw) ? raw.slice(0, 300) : ((e && e.message) || '请求失败');
    return { ok: false, error: { kind: 'network', message, hint: '控制台服务是否还在跑？' } };
  }
  if (res && res.ok === true) return { ok: true, data: res.data };
  if (res && res.ok === false && res.error) return { ok: false, error: res.error };
  return { ok: false, error: { kind: 'bad-json', message: '后端返回结构异常（可能不是 JSON）', detail: llmSafeStr(res) } };
}
function llmErrText(err) {
  if (!err) return '未知错误';
  return `[${err.kind || 'unknown'}] ${err.message || ''}`.trim();
}
function setLlmHint(node, text, isErr) {
  if (!node) return;
  node.textContent = text || '';
  node.style.color = isErr ? 'var(--err)' : '';
}
function parseLlmHeaders(txt) {
  const out = {};
  for (const line of String(txt || '').split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf(':');
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

/** 画 profile 下拉（清单来自 GET /api/llm/profiles；★ 不写死一份 profile 表）。 */
function renderLlmProfileOptions() {
  const sel = $('llmProfile');
  if (!sel) return;
  const cur = llmState.current;
  const list = llmState.profiles.length
    ? llmState.profiles
    : [{ id: cur, label: cur, isDefault: cur === 'workbuddy' }];
  sel.textContent = '';
  for (const p of list) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.label || p.id}${p.isDefault ? '（默认）' : ''}${p.hasKey ? ' · 已配 Key' : ''}`;
    if (p.id === cur) o.selected = true;
    sel.appendChild(o);
  }
}

/**
 * ★ 多模型切换：把可用模型清单灌进「下拉选择」+ datalist（两者同源）。
 *  · 清单来自端点（`POST /api/llm/models`）或配置；**前端不写死任何模型名**。
 *  · 选中下拉项 ⇒ 填入模型名输入框；输入框仍可手填任意模型名（兜底）。
 *  · 清单为空 ⇒ 隐藏下拉（只留手填），避免一个空的、点了没反应的控件误导用户。
 */
function renderLlmModelOptions(models, sourceLabel) {
  const list = Array.isArray(models) ? models.filter(Boolean).map(String) : [];
  llmState.models = list;                    // ★ 记下来 ⇒ 保存时一并落盘（下拉在刷新后仍在）
  const dl = $('llmModelList');
  if (dl) {
    dl.textContent = '';
    for (const m of list) { const o = document.createElement('option'); o.value = m; dl.appendChild(o); }
  }
  const sel = $('llmModelSelect');
  if (!sel) return;
  sel.textContent = '';
  if (!list.length) { sel.hidden = true; return; }
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = `— 从 ${list.length} 个可用模型里选（${sourceLabel || '端点'}）—`;
  sel.appendChild(ph);
  for (const m of list) { const o = document.createElement('option'); o.value = m; o.textContent = m; sel.appendChild(o); }
  sel.hidden = false;
  sel.value = '';
}

/** 把生效配置填进表单（★ 不回显 key；headers 用打码后的值）。 */
function renderLlmForm(cfg) {
  if (!cfg) return;
  $('llmKind').value = cfg.kind || '';
  $('llmBaseUrl').value = cfg.baseUrl || '';
  $('llmModel').value = cfg.model || '';
  $('llmTimeout').value = (cfg.timeoutMs !== undefined && cfg.timeoutMs !== null) ? String(cfg.timeoutMs) : '';
  $('llmPath').value = cfg.path || '';
  $('llmExtract').value = cfg.extract || '';
  // 输入框只放**用户覆盖**的头（后端已把敏感值打码成 ••••••；留占位符 = 不改）
  $('llmHeaders').value = Object.entries(cfg.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
  const eff = Array.isArray(cfg.effectiveHeaders) ? cfg.effectiveHeaders : [];
  setLlmHint($('llmHeadersHint'),
    eff.length
      ? `每行一条「名称: 值」；留空该行 = 删除该头。当前生效头（profile 默认 + 覆盖）：${eff.join(', ')}`
      : '每行一条「名称: 值」；留空该行 = 删除该头', false);

  // ★ 多模型切换：候选清单（来自端点拉取 / 配置）同时灌进「下拉选择」与 datalist；
  //   输入框仍可手填任意模型名（兜底）。清单为空 ⇒ 隐藏下拉，只留手填。
  const modelList = Array.isArray(cfg.models) ? cfg.models : [];
  renderLlmModelOptions(modelList, '端点 / 配置');
  setLlmHint($('llmModelHint'), modelList.length
    ? `共 ${modelList.length} 个候选模型（点「拉取模型」可从端点刷新）；也可手填任意模型名`
    : '点「拉取模型」可从端点拉候选清单，也可手填任意模型名', false);

  const st = $('llmKeyState');
  st.textContent = cfg.hasKey ? '已配置' : '未配置';
  st.className = 'llm-key-state ' + (cfg.hasKey ? 'ok' : 'missing');
  const keyInp = $('llmKey');
  keyInp.value = '';
  // ★ 提示用 keyMask（如 `sk-K…`）—— 掩码不是明文，只是让用户知道「当前已配哪个 key」
  const km = cfg.keyMask ? `（已配置 ${cfg.keyMask}）` : '（已配置）';
  keyInp.placeholder = cfg.hasKey ? `留空 = 不改${km}` : '留空 = 不设置';

  const pid = cfg.profile || llmState.current;
  $('llmProfileBadge').textContent = pid;
  $('llmProfile').value = pid;
  const p = llmState.profiles.find((x) => x.id === pid);
  $('llmProfileHint').textContent = p
    ? `默认 profile = workbuddy；当前 ${p.label || p.id}${p.isDefault ? '（默认）' : ''}${p.note ? ' · ' + p.note : ''}`
    : '默认 profile = workbuddy（软件默认走它）';
  // ★ 规格「当前优先配置 WorkBuddy」：一眼看出当前默认走哪个；切到别的则明确显示「已切换」。
  const pill = $('llmCurrentPill');
  if (pill) {
    const isDefault = pid === 'workbuddy';
    pill.textContent = isDefault ? '当前默认：WorkBuddy' : `已切换：${(p && (p.label || p.id)) || pid}`;
    pill.className = 'llm-current-pill ' + (isDefault ? 'is-default' : 'is-switched');
  }
  setLlmHint($('llmSaveHint'), `落盘：${cfg.overrideFile || 'D:\\lemo-films\\_llm-api.json'}`, false);
  syncLlmCustomRows();
}

/** custom 适配器才显示 path / extract（其余 kind 用不到，藏起来免得误导）。 */
function syncLlmCustomRows() {
  const box = $('llmCustomRows');
  if (box) box.hidden = ($('llmKind').value !== 'custom');
}

/** 表单 → 请求体（includeKey=false 时不带 key，用于校验 / 试一句的临时配置）。 */
function llmFormPayload(includeKey) {
  const p = {
    profile: $('llmProfile').value || undefined,
    kind: $('llmKind').value || '',
    baseUrl: $('llmBaseUrl').value.trim(),
    model: $('llmModel').value.trim(),
    timeoutMs: $('llmTimeout').value.trim(),
    path: $('llmPath').value.trim(),
    extract: $('llmExtract').value.trim(),
    headers: parseLlmHeaders($('llmHeaders').value),
    // ★ 拉取到的候选模型清单随保存落盘（模块 resolveConfig 本就支持 models）⇒ 刷新后下拉仍在。
    models: Array.isArray(llmState.models) ? llmState.models : [],
  };
  if (includeKey) { const k = $('llmKey').value; if (k) p.apiKey = k; }
  return p;
}

async function loadLlmProfiles() {
  const r = await llmReq('/api/llm/profiles');
  if (r.ok) {
    llmState.profiles = (r.data && r.data.profiles) || [];
    llmState.current = (r.data && r.data.current) || 'workbuddy';
  } else {
    setLlmHint($('llmProfileHint'), '读 profile 清单失败：' + llmErrText(r.error)
      + (r.error && r.error.hint ? '（' + r.error.hint + '）' : ''), true);
  }
  renderLlmProfileOptions();
}

async function loadLlmConfig(profileId) {
  const q = profileId ? `?profile=${encodeURIComponent(profileId)}` : '';
  const r = await llmReq('/api/llm/config' + q);
  if (!r.ok) {
    llmState.cfg = null;
    setLlmHint($('llmSaveHint'), '读配置失败：' + llmErrText(r.error)
      + (r.error && r.error.hint ? '（' + r.error.hint + '）' : ''), true);
    return;
  }
  llmState.cfg = r.data;
  renderLlmForm(r.data);
}

async function loadLlm() {
  await loadLlmProfiles();
  // ★ 初次加载 / 点「刷新」：读**生效**配置（不带 ?profile=，才会把已保存的覆盖算进去）。
  //   只有用户**手动切**下拉时才走 loadLlmConfig(id) 的「预览该 profile 默认值」分支。
  await loadLlmConfig(null);
}

/**
 * ★ 多模型切换：从当前 Endpoint 拉取可用模型清单（POST /api/llm/models → 模块 listModels()）。
 * 用**当前表单**的临时配置（不必先保存）。★ 异常接口（非 JSON / 5xx / 超时 / 空 body）由
 * llmReq() + 模块归一成 `{ok:false,error}` ⇒ 这里只更新一句中文提示，**绝不抛、绝不白屏**。
 */
async function fetchLlmModels() {
  if (llmState.busy) return;
  llmState.busy = true;
  const btn = $('btnLlmModels');
  if (btn) btn.disabled = true;
  setLlmHint($('llmModelHint'), '拉取中…（受配置的超时限制）', false);

  const r = await llmReq('/api/llm/models', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(llmFormPayload(true)),
  });
  llmState.busy = false;
  if (btn) btn.disabled = false;

  if (!r.ok) {
    setLlmHint($('llmModelHint'), '拉取模型失败：' + llmErrText(r.error)
      + (r.error && r.error.hint ? '（' + r.error.hint + '）' : ''), true);
    toast('拉取模型失败', true);
    return;
  }
  const d = r.data || {};
  if (d.ok === true) {
    const models = Array.isArray(d.models) ? d.models : [];
    renderLlmModelOptions(models, '端点');
    setLlmHint($('llmModelHint'), models.length
      ? `已从端点拉到 ${models.length} 个可用模型（下拉可选，也可手填）`
      : '端点返回了空的模型清单（可手填模型名）', !models.length);
    toast(models.length ? `已拉取 ${models.length} 个模型` : '端点没有可用模型');
  } else {
    const e = (d && d.error) || {};
    setLlmHint($('llmModelHint'), '拉取模型失败：' + `[${e.kind || 'unknown'}] ${e.message || ''}`, true);
    toast('拉取模型失败', true);
  }
}

async function saveLlmConfig() {
  if (llmState.busy) return;
  llmState.busy = true;
  setLlmHint($('llmSaveHint'), '保存中…', false);
  const r = await llmReq('/api/llm/config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(llmFormPayload(true)),
  });
  llmState.busy = false;
  if (!r.ok) {
    setLlmHint($('llmSaveHint'), '保存失败：' + llmErrText(r.error)
      + (r.error && r.error.hint ? '（' + r.error.hint + '）' : ''), true);
    toast('保存失败', true);
    return;
  }
  llmState.cfg = r.data;
  renderLlmForm(r.data);
  setLlmHint($('llmSaveHint'), `已保存 → ${(r.data && r.data.overrideFile) || 'D:\\lemo-films\\_llm-api.json'}`, false);
  toast('LLM 配置已保存');
}

async function clearLlmKey() {
  if (llmState.busy) return;
  const r = await llmReq('/api/llm/config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: $('llmProfile').value || undefined, clearKey: true }),
  });
  if (!r.ok) { toast('清除密钥失败：' + llmErrText(r.error), true); return; }
  llmState.cfg = r.data;
  renderLlmForm(r.data);
  toast('已清除已保存的密钥');
}

// ── 三步校验：逐步点亮 ───────────────────────────────────────
function setLlmStepState(step, state, detail) {
  const node = document.querySelector(`.llm-step[data-step="${step}"]`);
  if (!node) return;
  node.className = 'llm-step ' + state;
  node.querySelector('.llm-step-ico').textContent = LLM_STEP_ICO[state] || '○';
  node.querySelector('.llm-step-detail').textContent = detail || '';
}

/** 后端一步的结果形状可能是 true/false / 字符串 / {ok,kind,detail…} —— 一律归一。 */
function normLlmStep(v) {
  if (v === true) return { state: 'ok', detail: '通过' };
  if (v === false) return { state: 'fail', detail: '未通过' };
  if (v === undefined || v === null) return { state: 'skip', detail: '—（未执行）' };
  if (typeof v === 'string') return { state: (v === 'ok' ? 'ok' : 'fail'), detail: v };
  if (typeof v === 'object') {
    const ok = v.ok === true || v.pass === true || v.status === 'ok';
    // ★ 后端 validate() 里「还没跑到」的步骤是 `{ok:false, kind:null, detail:null}`（初始值）——
    //   与「真的失败」（必带 kind+detail）区分开，显示成「未执行」而不是「未通过」。
    if (v.ok === false && !v.kind && !v.detail) return { state: 'skip', detail: '—（未执行）' };
    const detail = v.detail || v.message || v.hint || v.note || (v.kind ? `(${v.kind})` : '');
    return { state: ok ? 'ok' : 'fail', detail: String(detail || (ok ? '通过' : '未通过')) };
  }
  return { state: 'skip', detail: String(v) };
}

async function revealLlmSteps(data) {
  const steps = (data && data.steps) || {};
  for (const k of LLM_STEP_ORDER) setLlmStepState(k, 'pending', '');
  for (const k of LLM_STEP_ORDER) {
    const s = normLlmStep(steps[k]);
    setLlmStepState(k, s.state, s.detail);
    await llmSleep(140);   // 按契约顺序**逐步**点亮，而不是一次性糊出来
  }
  const allOk = !!(data && data.ok === true);
  const hint = (data && data.hint) || '';
  // ★ 顺手用后端 validate() 的 masked.keyMask 刷新「已配 key」提示（key 输入框为空时才刷，
  //   免得把用户刚输入、还没保存的新 key 的掩码显示成「已保存的」）。
  const km = data && data.masked && data.masked.keyMask;
  if (km && $('llmKey').value === '') $('llmKey').placeholder = `留空 = 不改（已配置 ${km}）`;
  const h = $('llmStepHint');
  h.textContent = allOk ? '' : (hint || '校验未通过，请按上面的提示调整。');
  h.style.color = allOk ? '' : 'var(--warn)';
  toast(allOk ? '三步校验全部通过' : '校验未通过', !allOk);
}

async function validateLlm() {
  if (llmState.busy) return;
  llmState.busy = true;
  $('btnLlmValidate').disabled = true;
  $('llmSteps').hidden = false;
  $('llmStepHint').textContent = '';
  for (const k of LLM_STEP_ORDER) setLlmStepState(k, 'running', '检测中…');

  const r = await llmReq('/api/llm/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(llmFormPayload(true)),
  });
  llmState.busy = false;
  $('btnLlmValidate').disabled = false;

  if (!r.ok) {
    setLlmStepState('reachable', 'fail', llmErrText(r.error));
    setLlmStepState('auth', 'skip', '—（未执行）');
    setLlmStepState('shape', 'skip', '—（未执行）');
    const h = $('llmStepHint');
    h.textContent = (r.error && r.error.hint) || '校验请求没跑起来（后端或 LLM 模块未就绪）。';
    h.style.color = 'var(--warn)';
    toast('校验未跑起来', true);
    return;
  }
  await revealLlmSteps(r.data);
}

// ── 试一句 ───────────────────────────────────────────────────
async function tryLlmChat() {
  if (llmState.busy) return;
  llmState.busy = true;
  $('btnLlmTry').disabled = true;
  const out = $('llmTryOut');
  out.textContent = '请求中…（受配置的超时限制）';

  const r = await llmReq('/api/llm/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...llmFormPayload(true), prompt: $('llmTryText').value.trim() }),
  });
  llmState.busy = false;
  $('btnLlmTry').disabled = false;
  renderLlmTryOut(r);
}

function renderLlmTryOut(r) {
  const box = $('llmTryOut');
  box.textContent = '';
  if (!r.ok) {
    const d = el('div', 'llm-out-err', '请求失败：' + llmErrText(r.error));
    if (r.error && r.error.hint) d.appendChild(el('span', 'llm-out-hint', r.error.hint));
    box.appendChild(d);
    return;
  }
  const d = r.data || {};
  if (d.ok === true) {
    box.appendChild(el('div', 'llm-out-text', d.text || '(空回复)'));
    const meta = [];
    if (d.meta && d.meta.model) meta.push('model=' + d.meta.model);
    if (d.usage) meta.push('usage=' + llmSafeStr(d.usage));
    if (meta.length) box.appendChild(el('div', 'llm-out-meta', meta.join('  ')));
  } else {
    const e = (d && d.error) || {};
    const err = el('div', 'llm-out-err', '调用失败：' + `[${e.kind || 'unknown'}] ${e.message || ''}`);
    if (e.detail) err.appendChild(el('span', 'llm-out-hint', String(e.detail).slice(0, 300)));
    box.appendChild(err);
  }
}

/** ★ 界面入口：顶栏「LLM 配置」→ 滚到面板卡片并高亮一下（纯前端定位，不发请求）。 */
function gotoLlmCard() {
  const card = $('llmCard');
  if (!card) return;
  if (card.scrollIntoView) {
    try { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { card.scrollIntoView(); }
  }
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 1600);
}

// ── 事件绑定 ────────────────────────────────────────────────
function bind() {
  // ⚠️ 必须包一层：直接传 startRun 会把 MouseEvent 当成 force 参数（真值）→ 预检被跳过
  $('btnRun').addEventListener('click', () => startRun(false));
  $('btnRefreshJobs').addEventListener('click', loadJobs);
  // 主题出片（工单）
  $('btnRefreshBriefs').addEventListener('click', loadBriefs);
  $('btnBriefCreate').addEventListener('click', createBriefFromForm);
  // 换风格 → 语言选项跟着换（哪个风格有哪些语言版本由服务端 /api/langs 说了算）
  //           同时重核构图能力（不同风格支持的输出比例不同）
  $('briefSlug').addEventListener('change', () => { syncBriefLang(); syncBriefAspectWarn(); });
  $('briefLang').addEventListener('change', (e) => { state.briefLang = e.target.value; });
  // 输出尺寸：换比例 → 同步界面（自定义框显隐 + 校验）；自定义宽高即时校验（非法就禁用「生成工单」）
  $('briefRatio').addEventListener('change', (e) => {
    state.briefRatio = e.target.value;
    syncBriefSizeUI();
  });
  for (const id of ['briefSizeW', 'briefSizeH']) {
    if (!$(id)) continue;
    $(id).addEventListener('input', (e) => {
      if (id === 'briefSizeW') state.briefSizeW = e.target.value.trim();
      else state.briefSizeH = e.target.value.trim();
      syncBriefSizeUI();
    });
  }
  $('briefTopic').addEventListener('keydown', (e) => {
    // ★ Ctrl+Enter 交给全局处理器（它跑的是「启动任务」），这里只管裸 Enter
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) createBriefFromForm();
  });
  $('btnRefreshFilms').addEventListener('click', () => { loadFilms(); });
  // LLM API 配置：刷新 / 保存 / 一键校验 / 试一句 / 清除密钥 / 切 profile / kind 联动
  if ($('btnGotoLlm')) $('btnGotoLlm').addEventListener('click', gotoLlmCard);
  if ($('btnLlmRefresh')) $('btnLlmRefresh').addEventListener('click', loadLlm);
  if ($('btnLlmModels')) $('btnLlmModels').addEventListener('click', (e) => { e.preventDefault(); fetchLlmModels(); });
  if ($('llmModelSelect')) $('llmModelSelect').addEventListener('change', (e) => {
    if (e.target.value) $('llmModel').value = e.target.value;   // 选中下拉项 ⇒ 填入模型名
  });
  if ($('btnLlmSave')) $('btnLlmSave').addEventListener('click', saveLlmConfig);
  if ($('btnLlmValidate')) $('btnLlmValidate').addEventListener('click', validateLlm);
  if ($('btnLlmClearKey')) $('btnLlmClearKey').addEventListener('click', clearLlmKey);
  if ($('btnLlmTry')) $('btnLlmTry').addEventListener('click', tryLlmChat);
  if ($('llmProfile')) $('llmProfile').addEventListener('change', (e) => {
    // 切 profile ⇒ 拉该 profile 的生效配置（默认值），避免「上一个 profile 的值挂在它名下」
    llmState.current = e.target.value;
    loadLlmConfig(e.target.value);
  });
  if ($('llmKind')) $('llmKind').addEventListener('change', syncLlmCustomRows);
  if ($('llmTryText')) $('llmTryText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); tryLlmChat(); }
  });
  // 声音（配音音色）：刷新清单 / 语速输入（改了要立刻反映到命令预览上）
  if ($('btnRefreshVoices')) $('btnRefreshVoices').addEventListener('click', () => loadVoices(false));
  if ($('btnVoiceTest')) $('btnVoiceTest').addEventListener('click', startVoiceTest);
  // 导入新音色：折叠区**首次展开时**才拉源目录（收起时不该为一个低频功能多打一次接口）
  if ($('voiceImport')) {
    $('voiceImport').addEventListener('toggle', (e) => {
      if (e.target.open && state.vSources === null) loadVoiceSources();
    });
  }
  if ($('btnVoiceSrcRefresh')) $('btnVoiceSrcRefresh').addEventListener('click', loadVoiceSources);
  if ($('vtText')) $('vtText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); startVoiceTest(); }
  });
  if ($('fVoiceSpeed')) {
    $('fVoiceSpeed').addEventListener('input', (e) => {
      state.voiceSpeed = e.target.value.trim();
      saveVoicePref(SPEED_KEY, state.voiceSpeed);
      renderVoiceCurrent();
      syncPreview();
    });
  }
  // 文案出片：形态切换 / 断句预览 / 风格 / 分析 / 上传素材 / 参数 / 出片
  if ($('dubScript')) {
    $('dubScript').addEventListener('input', () => {
      renderDubScriptHint();
      // ★ 文案改了 → 之前那份断句与那份分析都不再对应当前文案，**收起来**
      //   （别让用户对着旧断句出片，也别让他拿旧分析判断「系统理解得对不对」）
      if (state.dubPreview) { state.dubPreview = null; renderDubLines(); }
      if (state.dubAnalysis) { state.dubAnalysis = null; renderDubAnalysis(); }
    });
  }
  if ($('dubMode')) {
    for (const b of document.querySelectorAll('#dubMode .dub-mode-btn')) {
      b.addEventListener('click', () => setDubMode(b.dataset.mode));
    }
    // ★ ARIA Tabs 模式的键盘模型：←/→（及 ↑/↓）在形态 tab 间移动并选中，Home/End 跳首尾。
    //   配合 renderDubMode 的 roving tabindex（只有选中的那个 tab 是 Tab 键的落点）。
    $('dubMode').addEventListener('keydown', (e) => {
      const tabs = [...document.querySelectorAll('#dubMode .dub-mode-btn')];
      const i = tabs.indexOf(e.target);
      if (i < 0) return;
      const n = tabs.length;
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      if (j < 0) return;
      e.preventDefault();
      setDubMode(tabs[j].dataset.mode);
      tabs[j].focus();
    });
  }
  if ($('dubStyle')) {
    $('dubStyle').addEventListener('change', (e) => {
      state.dubStyle = e.target.value;
      renderDubStyleHint();
    });
  }
  // 文案出片的输出尺寸（比例下拉 + 自定义宽高）——与「主题出片」同一套交互
  if ($('dubRatio')) {
    $('dubRatio').addEventListener('change', (e) => {
      state.dubRatio = e.target.value;
      syncDubSizeUI();
    });
  }
  for (const id of ['dubSizeW', 'dubSizeH']) {
    if (!$(id)) continue;
    $(id).addEventListener('input', (e) => {
      if (id === 'dubSizeW') state.dubSizeW = e.target.value.trim();
      else state.dubSizeH = e.target.value.trim();
      syncDubSizeUI();
    });
  }
  if ($('btnDubAnalyze')) $('btnDubAnalyze').addEventListener('click', analyzeDub);
  if ($('btnDubPreview')) $('btnDubPreview').addEventListener('click', previewDub);
  if ($('btnDubRefresh')) $('btnDubRefresh').addEventListener('click', loadDubSources);
  if ($('btnDubPick')) $('btnDubPick').addEventListener('click', () => $('dubFile').click());
  if ($('dubFile')) {
    $('dubFile').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      uploadDubFile(f);
      e.target.value = '';      // 清空，好让同一个文件再选一次也能触发 change
    });
  }
  if ($('dubDrop')) {
    const drop = $('dubDrop');
    // ★ dragover 必须 preventDefault，否则浏览器会把拖进来的视频**直接打开**（默认行为），页面就跳走了
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      uploadDubFile(f);
    });
    drop.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;   // 「选择文件」按钮自己处理
      if ($('dubFile')) $('dubFile').click();
    });
  }
  // SRT：与视频同一套交互（选/拖/复用已上传/清除）
  if ($('btnDubSrtPick')) $('btnDubSrtPick').addEventListener('click', () => $('dubSrtFile').click());
  if ($('dubSrtFile')) {
    $('dubSrtFile').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      uploadDubSrtFile(f);
      e.target.value = '';
    });
  }
  if ($('dubSrtDrop')) {
    const drop = $('dubSrtDrop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      uploadDubSrtFile(f);
    });
    drop.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if ($('dubSrtFile')) $('dubSrtFile').click();
    });
  }
  if ($('dubSrcSel')) {
    $('dubSrcSel').addEventListener('change', (e) => {
      const tok = e.target.value;
      state.dubVideoToken = tok;
      const u = dubUploadsOfKind('video').find((x) => x.token === tok);
      state.dubVideoName = u ? u.name : '';
      renderDubVideoHint();
      syncDubCropWarn();       // 换了一条素材 → 重核「会不会被裁」
    });
  }
  if ($('dubSrtSel')) {
    $('dubSrtSel').addEventListener('change', (e) => {
      const tok = e.target.value;
      state.dubSrtToken = tok;
      const u = dubUploadsOfKind('srt').find((x) => x.token === tok);
      state.dubSrtName = u ? u.name : '';
      renderDubSrtHint();
    });
  }
  if ($('btnDubClear')) {
    $('btnDubClear').addEventListener('click', () => {
      state.dubVideoToken = '';
      state.dubVideoName = '';
      if ($('dubSrcSel')) $('dubSrcSel').value = '';
      state.dubUpload = { busy: false, pct: 0, name: '', error: '' };
      renderDubUpload();
      renderDubVideoHint();
      syncDubCropWarn();       // 素材清掉了 → 提示也该跟着消失
      toast('已清除口播素材');
    });
  }
  if ($('btnDubSrtClear')) {
    $('btnDubSrtClear').addEventListener('click', () => {
      state.dubSrtToken = '';
      state.dubSrtName = '';
      if ($('dubSrtSel')) $('dubSrtSel').value = '';
      state.dubSrtUpload = { busy: false, pct: 0, name: '', error: '' };
      renderDubSrtUpload();
      renderDubSrtHint();
      toast('已清除 SRT —— 出片时自动对齐（优先 ASR）');
    });
  }
  if ($('dubVoice')) {
    $('dubVoice').addEventListener('change', (e) => {
      state.dubVoiceOverride = e.target.value;
      renderDubVoiceHint();
    });
  }
  // ★ 形态 2 的限幅开关：只更新提示（勾选时才明说「音轨会被重编码」），不改别的。
  if ($('dubKeepLimit')) {
    $('dubKeepLimit').addEventListener('change', () => renderDubLimitHint());
  }
  if ($('btnDubRun')) $('btnDubRun').addEventListener('click', startDubRun);
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
  loadVoicePref();      // ★ 先读本机声音偏好：它会进启动表单的命令预览（--voice / --speed）
  bind();
  syncPreview();
  updateBatchBar();
  renderDubScriptHint();   // 文案字数提示（还没输入时也要显示「0 字」而不是空白）
  renderDubMode();         // 形态（默认「仅文案出片」）—— 它决定下面显示哪些字段
  renderDubState();        // 出片区初始收起
  await Promise.all([
    loadEnv(false), loadSetup(), loadStylesBadges(), loadFilms(), loadJobs(),
    loadBriefs(), loadVoices(), loadDubSources(), loadDubStyles(), fillDubRatios(),
    loadLlm(),
  ]);
  // 任务状态轮询（SSE 只推日志，列表用轮询保持简单）
  setInterval(() => { loadJobs(); }, 3000);
  // 工单也轮询：WorkBuddy 是**在控制台外面**改工单文件的（改完文件控制台看不见别的东西），
  // 所以这里必须自己定期重读 —— 否则用户得手动点「刷新」才看得到「内容已就绪」。
  setInterval(() => { loadBriefs(); }, 3000);
  // 环境每 60 秒刷一次（服务端缓存 30 秒）。★ 演练模式下不自动刷，免得把合成结果换成真实结果。
  if (!SIM) {
    setInterval(() => { loadEnv(false); }, 60000);
    setInterval(() => { loadSetup(); }, 60000);
  }
}

boot();
