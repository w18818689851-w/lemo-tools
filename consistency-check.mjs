#!/usr/bin/env node
// 一致性校验门 CLI —— 「字幕 ↔ 语义 ↔ 画面」强制核对。
//
// 用法：
//   node consistency-check.mjs <demoRel> [--q "film=x&content=y.json"] [--out <dir>] [--samples 3] [--no-frames]
// 例：
//   node consistency-check.mjs styles/engraving/demo --q "film=film_coffee&content=content_coffee.json" \
//        --out "D:/lemo-films/_consistency/coffee"
//
// 判定规则见 lib/consistency.mjs 顶部注释。核心：每条字幕声明的**语义锚点**，在该字幕时间窗的
// 每个采样点上都必须成立 —— 任一采样点不成立即判该条失败（专抓「字幕还在、画面已经切走」）。
//
// 退出码：0 = 通过；1 = 不通过；2 = 用法/环境错误。

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { verdict, voiceWindowCheck, renderReport, ANCHOR_KINDS } from './lib/consistency.mjs';
import { CFG } from './lib/env.mjs';   // ★ 成片根唯一来源（认 LEMO_FILM_DIR）；本文件原先硬编码 'D:/lemo-films/_consistency'（第二份来源）

const LIB = process.env.LEMO_LIB_WIN || 'D:/lemo-opuscar';   // ★ 库根：保留独立口径（认 LEMO_LIB_WIN，与 lemo-make.mjs 的 winLib 同名同义）；**不是**风格源码根（那个认 LEMO_STYLES_ROOT）—— 已知残留，如实登记
function usage(msg) {
  if (msg) console.error('错误：' + msg);
  console.error('用法：node consistency-check.mjs <demoRel> [--q "k=v&k=v"] [--out <dir>] [--samples N] [--no-frames]');
  process.exit(2);
}

const argv = process.argv.slice(2);
let demoRel = null, q = '', outDir = null, samples = 3, frames = true;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--q') { q = argv[++i] ?? usage('--q 缺少值'); }
  else if (a === '--out') { outDir = argv[++i] ?? usage('--out 缺少值'); }
  else if (a === '--samples') { samples = Number(argv[++i] ?? usage('--samples 缺少值')); }
  else if (a === '--no-frames') { frames = false; }
  else if (a.startsWith('--')) usage(`未知参数 ${a}`);
  else if (!demoRel) demoRel = a;
  else usage(`多余的参数 ${a}`);
}
if (!demoRel) usage('缺少 <demoRel>');
if (!fs.existsSync(path.join(LIB, demoRel, 'index.html'))) usage(`找不到 ${path.join(LIB, demoRel, 'index.html')}`);

outDir = path.resolve(outDir || path.join(CFG.exportDir, '_consistency', demoRel.split('/')[1] || 'film'));   // ★ 成片根从唯一来源派生；不设 LEMO_FILM_DIR 时与旧字面量 'D:/lemo-films/_consistency' 解析结果逐字节相同
fs.mkdirSync(outDir, { recursive: true });
const framesDir = path.join(outDir, 'frames');
if (frames) fs.mkdirSync(framesDir, { recursive: true });

// ★ 必须切到库根再加载页面工具：core/render/page.mjs 的 requireDemo() 与 serve.mjs 的 pageURL()
//   都按 **CWD** 解析 demo 目录（pageURL 还会用 path.relative(ROOT, abs) 判断是不是库内页面）。
//   不 chdir 的话会报 "no index.html in ..."。outDir 已在上面 resolve 成绝对路径，不受影响。
process.chdir(LIB);

// 页面工具从**库**里导入（playwright-core 要按库的 node_modules 解析）
const pageMod = await import(pathToFileURL(path.join(LIB, 'core/render/page.mjs')).href);
const { openDemo, closeServer } = pageMod;

const notes = [];
let page = null, browser = null;
try {
  ({ browser, page } = await openDemo(demoRel, { q }));

  // 1) 影片自己声明的字幕表与探针
  const meta = await page.evaluate(() => {
    const F = window.FILM || {};
    return {
      hasLines: Array.isArray(window.LINES),
      lines: window.LINES || (F.LINES || []),
      hasProbe: typeof window.PROBE === 'function',
      dur: window.DUR ?? null,
      title: F.title || null,
      style: F.style || null,
      film: F.id || null,
    };
  });
  if (!meta.hasLines) notes.push('影片没有暴露 window.LINES —— 本闸门只能出抽帧，无法做结构化断言。');
  if (!meta.hasProbe) notes.push('影片没有暴露 window.PROBE —— 语义锚点无法核验（这是**未实现契约**，不是通过）。');

  // 2) 逐条字幕：多采样点取 PROBE
  const probeCache = new Map();
  let probeAt = () => null;
  if (meta.hasProbe) {
    probeAt = t => {
      // 同步接口：这里必须用 page.evaluate（异步），所以先把需要的 t 都算好、一次性批量取。
      return probeCache.get(+t.toFixed(3)) ?? null;
    };
    const ts = new Set();
    for (const L of meta.lines) {
      const t0 = Number(L.t0), t1 = Number(L.t1);
      if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue;
      for (let k = 1; k <= samples; k++) ts.add(+(t0 + (t1 - t0) * (k / (samples + 1))).toFixed(3));
    }
    const list = [...ts].sort((a, b) => a - b);
    if (list.length) {
      const got = await page.evaluate(tsList => tsList.map(t => {
        try { return { t, p: window.PROBE(t) }; } catch (e) { return { t, err: String(e && e.message || e) }; }
      }), list);
      for (const g of got) {
        if (g.err) notes.push(`PROBE(${g.t}) 抛错：${g.err}`);
        probeCache.set(g.t, g.p ?? null);
      }
    }
  }

  const rep = verdict(meta.lines, probeAt, { samples });

  // 3) 字幕窗 ↔ 配音时长
  const durPath = path.join(LIB, demoRel, 'voices', 'dur.json');
  let dur = null;
  try { dur = JSON.parse(fs.readFileSync(durPath, 'utf8')); } catch { notes.push(`读不到配音时长 ${durPath}（跳过窗口核对）`); }
  const voice = dur ? voiceWindowCheck(meta.lines, dur) : null;

  // 4) 抽帧（每条字幕取中点）
  const frameList = [];
  if (frames && meta.lines.length) {
    for (const L of meta.lines) {
      const t0 = Number(L.t0), t1 = Number(L.t1);
      if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue;
      const t = +(t0 + (t1 - t0) / 2).toFixed(3);
      try {
        await page.evaluate(tt => { window.render(tt); }, t);
        const f = path.join(framesDir, `${L.id}@${t}s.png`);
        await page.locator('canvas').screenshot({ path: f });
        frameList.push({ id: L.id, t, file: f });
      } catch (e) { notes.push(`抽帧失败 ${L.id}@${t}s：${String(e && e.message || e)}`); }
    }
  }

  const report = {
    demo: demoRel, q, film: meta.film, title: meta.title, style: meta.style,
    generatedAt: new Date().toISOString(),
    verdict: rep, voice, frames: frameList, notes,
    anchorKinds: Object.keys(ANCHOR_KINDS),
  };
  fs.writeFileSync(path.join(outDir, 'consistency.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'consistency.md'), renderReport(report));

  // 控制台摘要
  const v = rep.ok ? '通过' : '不通过';
  console.log(`\n一致性校验：${v}   （语义锚点 ${rep.pass}/${rep.total} 条字幕成立）`);
  for (const r of rep.rows) {
    if (r.ok) continue;
    const why = r.error || (r.bad || []).map(b => `t=${b.t}s ${b.detail}`).join('；');
    console.log(`  ✗ ${r.id}  ${r.text ? '「' + r.text + '」' : ''}  ${why}`);
  }
  if (voice) console.log(`字幕窗↔配音时长：${voice.ok ? '全部相符' : '有偏差（见报告）'}（容差 ±${voice.tolerance}s）`);
  if (frames) console.log(`抽帧 ${frameList.length} 张 → ${framesDir}`);
  console.log(`报告 → ${path.join(outDir, 'consistency.md')}`);
  if (notes.length) { console.log('备注：'); notes.forEach(n => console.log('  - ' + n)); }

  await browser.close(); closeServer();
  process.exit(rep.ok ? 0 : 1);
} catch (e) {
  try { if (browser) await browser.close(); } catch { }
  try { closeServer(); } catch { }
  console.error('一致性校验门自身出错：', e && e.stack || e);
  process.exit(2);
}
