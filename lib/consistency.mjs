// 一致性校验门的**纯逻辑**部分（不碰浏览器，可单测）。
//
// 背景（用户硬规则）：
//   「全程保证**字幕、语义、画面三者完全匹配统一**，不允许画面脱节、字幕和语义不符、图文不对版。」
// 这条规则不能靠人肉眼看一遍就算数 —— 必须变成一个**会失败的自动闸门**，否则下次换主题/换风格
// 又会悄悄退化。所以约定：
//
//   影片页面（film 模块）必须额外暴露两个东西：
//     window.LINES = [{ id, t0, t1, text, anchors: [ ... ] }]
//        · text    —— 该时间窗内屏幕上出现的字幕原文
//        · anchors —— **语义锚点**：这条字幕讲的画面元素，必须在该时间窗内真的在画面上
//     window.PROBE = t => ({ ... })
//        · 返回 t 时刻画面上的**结构化事实**（不是像素），供逐条断言
//
//   anchors 的每一种 kind 都对应 PROBE 返回的一个字段，一一可查：

/** 锚点种类 → PROBE 字段。改这里就等于改契约，两边必须同步。 */
export const ANCHOR_KINDS = {
  text:    { probe: 'texts',    label: '版面上刻着的文字' },
  station: { probe: 'stations', label: '航线站点' },
  roundel: { probe: 'roundels', label: '放大圆窗序号' },
  region:  { probe: 'regions',  label: '已上色的色区' },
  element: { probe: 'elements', label: '画面元素' },
  label:   { probe: 'labels',   label: '部件标注' },
};

const arr = v => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const norm = v => String(v).trim().toLowerCase();

/**
 * 判一条锚点是否满足。
 * @param {{kind:string,value:any,note?:string}} a
 * @param {object} probe  PROBE(t) 的返回值
 * @returns {{ok:boolean, kind:string, value:any, note?:string, detail:string}}
 */
export function checkAnchor(a, probe) {
  const spec = ANCHOR_KINDS[a.kind];
  if (!spec) return { ok: false, kind: a.kind, value: a.value, note: a.note, detail: `未知锚点种类 ${a.kind}` };
  if (!probe || typeof probe !== 'object') {
    return { ok: false, kind: a.kind, value: a.value, note: a.note, detail: 'PROBE 没有返回结构化状态（影片未实现契约）' };
  }
  const pool = arr(probe[spec.probe]).map(norm);
  if (spec.probe === 'regions' || spec.probe === 'elements') {
    // 色区/元素：probe 里可能是字符串数组，也可能是 {name,alpha} 数组（alpha>0 才算“在画面上”）
    const names = arr(probe[spec.probe]).map(x => (typeof x === 'string' ? x : x && x.name)).filter(Boolean).map(norm);
    const hit = names.includes(norm(a.value));
    return { ok: hit, kind: a.kind, value: a.value, note: a.note,
      detail: hit ? `${spec.label}含 ${a.value}` : `${spec.label}不含 ${a.value}（当前：${names.join(',') || '空'}）` };
  }
  const hit = pool.includes(norm(a.value));
  return { ok: hit, kind: a.kind, value: a.value, note: a.note,
    detail: hit ? `${spec.label}含 ${a.value}` : `${spec.label}不含 ${a.value}（当前：${pool.join(',') || '空'}）` };
}

/**
 * 逐条字幕核对锚点。
 * @param {Array} lines  window.LINES
 * @param {(t:number)=>object} probeAt  取 t 时刻 PROBE 的函数
 * @param {{samples?:number}} [opt]  每条字幕取几个采样点（默认 3：25%/50%/75%）
 */
export function verdict(lines, probeAt, opt = {}) {
  const samples = Math.max(1, opt.samples ?? 3);
  const rows = [];
  for (const L of arr(lines)) {
    if (!L || !L.id) { rows.push({ id: '(无 id)', ok: false, error: '字幕条目缺 id' }); continue; }
    const t0 = Number(L.t0), t1 = Number(L.t1);
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) {
      rows.push({ id: L.id, ok: false, error: `时间窗非法 t0=${L.t0} t1=${L.t1}` });
      continue;
    }
    if (!L.text || !String(L.text).trim()) { rows.push({ id: L.id, ok: false, error: '字幕文本为空' }); continue; }
    if (!arr(L.anchors).length) { rows.push({ id: L.id, ok: false, error: '没有声明任何语义锚点（无法证明图文相符）', text: L.text }); continue; }

    const ts = [];
    for (let k = 1; k <= samples; k++) ts.push(t0 + (t1 - t0) * (k / (samples + 1)));
    const perSample = ts.map(t => ({ t, checks: arr(L.anchors).map(a => checkAnchor(a, probeAt(t))) }));
    // 判定规则：**每个采样点上，每条锚点都必须成立** —— 任一采样点失败即该条字幕失败。
    // 之所以按“全采样点”而不是“任一点”，是因为「字幕在、画面已经切走」正是要抓的脱节。
    const bad = [];
    for (const s of perSample) for (const c of s.checks) if (!c.ok) bad.push({ t: +s.t.toFixed(2), ...c });
    rows.push({ id: L.id, t0, t1, text: L.text, ok: bad.length === 0, samples: perSample.map(s => +s.t.toFixed(2)), bad });
  }
  const total = rows.length, pass = rows.filter(r => r.ok).length;
  return {
    total, pass, fail: total - pass,
    ok: total > 0 && pass === total,
    rows,
    generatedAt: new Date().toISOString(),
  };
}

/** 配音时长与字幕时间窗是否对得上（字幕不能早于/晚于声音太多）。 */
export function voiceWindowCheck(lines, dur, opt = {}) {
  const tol = opt.tolerance ?? 0.35;   // 秒；超过就报
  const out = [];
  for (const L of arr(lines)) {
    const d = dur && (dur[L.id] ?? dur[L.voiceId]);
    if (!Number.isFinite(d)) { out.push({ id: L.id, ok: false, detail: '没有该行的配音时长' }); continue; }
    const win = Number(L.t1) - Number(L.t0);
    // ★ 先归到毫秒再比：3.0 - 3.35 在 IEEE754 里是 -0.35000000000000009，会让「恰好等于容差」
    //   这种边界判成失败，还会在报告里印出「差 0.35s」却标 ❌ 的自相矛盾结果。归整是必须的。
    const diff = Math.round((win - d) * 1000) / 1000;
    const ok = Math.abs(diff) <= tol;
    out.push({ id: L.id, ok, win: +win.toFixed(3), voice: +d.toFixed(3), diff,
      detail: ok ? '字幕窗与配音时长相符' : `字幕窗 ${win.toFixed(2)}s vs 配音 ${d.toFixed(2)}s（差 ${diff.toFixed(2)}s）` });
  }
  return { ok: out.every(r => r.ok), rows: out, tolerance: tol };
}

/** 出 markdown 报告。 */
export function renderReport(rep) {
  const L = [];
  L.push(`# 一致性校验报告（字幕 ↔ 语义 ↔ 画面）`);
  L.push('');
  L.push(`- 影片：\`${rep.film || '?'}\``);
  L.push(`- 页面：\`${rep.demo || '?'}\`  查询：\`${rep.q || '(无)'}\``);
  L.push(`- 生成时间：${rep.generatedAt}`);
  L.push(`- 结论：**${rep.verdict.ok ? '通过' : '不通过'}** —— 语义锚点 ${rep.verdict.pass}/${rep.verdict.total} 条字幕全部成立`);
  L.push('');
  if (rep.verdict.total === 0) L.push('> ⚠️ 影片没有声明任何字幕条目（window.LINES），本闸门无法校验。');
  L.push('## 逐条结果');
  L.push('');
  L.push('| # | 字幕 id | 时间窗 | 字幕原文 | 结果 | 失败点 |');
  L.push('|---|---|---|---|---|---|');
  rep.verdict.rows.forEach((r, i) => {
    const win = r.t0 !== undefined ? `${r.t0.toFixed(2)}–${r.t1.toFixed(2)}s` : '—';
    const bad = r.error ? r.error : (r.bad || []).map(b => `t=${b.t}s ${b.detail}`).join('；');
    L.push(`| ${i + 1} | \`${r.id}\` | ${win} | ${(r.text || '').replace(/\|/g, '\\|')} | ${r.ok ? '✅' : '❌'} | ${bad || ''} |`);
  });
  if (rep.voice) {
    L.push('');
    L.push('## 字幕窗 ↔ 配音时长');
    L.push('');
    L.push(`容差 ±${rep.voice.tolerance}s —— ${rep.voice.ok ? '✅ 全部相符' : '❌ 有偏差'}`);
    L.push('');
    L.push('| id | 字幕窗(s) | 配音(s) | 差(s) | 结果 |');
    L.push('|---|---|---|---|---|');
    for (const r of rep.voice.rows) L.push(`| \`${r.id}\` | ${r.win ?? '—'} | ${r.voice ?? '—'} | ${r.diff ?? '—'} | ${r.ok ? '✅' : '❌'} |`);
  }
  if (rep.frames && rep.frames.length) {
    L.push('');
    L.push('## 抽帧（供人工复核图文是否对版）');
    L.push('');
    for (const f of rep.frames) L.push(`- \`${f.id}\` @ ${f.t}s → \`${f.file}\``);
  }
  if (rep.notes && rep.notes.length) {
    L.push('');
    L.push('## 备注');
    L.push('');
    for (const n of rep.notes) L.push(`- ${n}`);
  }
  L.push('');
  return L.join('\n');
}
