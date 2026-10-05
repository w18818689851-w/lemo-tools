#!/usr/bin/env node
/**
 * scripts/check-config-vs-doc.mjs —— 配置的**配色**是否出现在该风格文档的「§3 配色体系」里
 *
 * ★ 由来（2026-10-04）：`hd-2d` 的 `palette.bg = #fff0c8` —— 而 `#fff0c8` 在 demo 里是
 *   **灯塔灯光色**（`cliff.js:161`），文档 §3 写的背景是夜空 `#050818 → #101d3e → #2c4262`。
 *   即**抽取时把「灯光色」当成了「背景色」**，`dub-visual.json` 自己的证据行都标着「灯光色」。
 *   这类错误**没有任何既有检查器覆盖**（`check-dub-styles` 只查纹理红线与字幕底衬）。
 *
 * 判据（**机械、可解释**）：
 *   把 `SKILL.md` 第 3 节「配色体系」段落里出现的所有 hex 收成集合 S；
 *   若配置的 `palette.bg`（以及 `bgRecipe.stops` 里的主色）**一个都不在 S 里** ⇒ 高度可疑。
 *
 * ★ 语义（重要，别把它当判决）：这类可疑分两种，处置完全不同 ——
 *   · **文档已记录**（该风格第 11 节「已知缺陷」里提到了 `dub-styles.json` / `palette`）⇒ 属**已知积压**，
 *     文档里已有扣分与（通常）正确值，**只列为 backlog，不判 FAIL**；
 *   · **文档没记录** ⇒ 说明是**新出现的抽取错误**（没人知道），**判 FAIL**。
 *   这样既能把积压显式列出来，又不会被积压淹没而漏掉新问题。
 *
 * 用法：node scripts/check-config-vs-doc.mjs [--all]
 *   --all：连「文档已记录」的积压也判 FAIL（用于集中清理时）
 *
 * ★ 失明守卫（2026-10-04 补）：抽不出 §3 的风格进 `noSec`，但 `noSec` **只打印不计 FAIL**。
 *   若**所有**风格都进 noSec（SKILL.md 全读不到 / §3 结构变了），`fresh`/`backlog` 皆空 ⇒ 静默绿。
 *   判据：`cfg.styles.length === 0`（0 个风格）或 `noSec.length === cfg.styles.length`
 *   （**没有任何一个风格可比对**）⇒ 判 FAIL 并明说「失明」。
 * 退出码：有「文档未记录」的可疑（或 --all 下的任意可疑，或失明）→ 1；否则 0。
 */
import fs from 'node:fs';
import path from 'node:path';

const CFG = 'D:/lemo-tools/lib/dub-styles.json';
const DIR = 'D:/lemo-tools/lib/style-skills';
const FAIL_ALL = process.argv.includes('--all');
const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));

const norm = (h) => String(h).toUpperCase().replace(/^#/, '').slice(0, 6);
const rgb = (h) => { const s = norm(h); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0); };
/** 近似色容差：实测 `brick-toy` 的 `#f4f4f1` 与文档 `#F2F2EE` 是**同一个浅灰底**的两种写法，
 *  纯「集合包含」会把这种近似写成误报 ⇒ 用 RGB 欧氏距离 ≤ NEAR 视为「文档里有这个色」。 */
const NEAR = 26;
const nearAny = (hex, set) => {
  if (set.has(norm(hex))) return true;
  const a = rgb(hex);
  for (const s of set) {
    const b = rgb(s);
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= NEAR) return true;
  }
  return false;
};

/** 抽出 SKILL.md 第 3 节（配色体系）里的所有 hex */
function section3Hexes(md) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => /^##\s*3\./.test(l));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && !/^##\s/.test(lines[j])) j++;
  const set = new Set();
  for (const m of lines.slice(i, j).join('\n').matchAll(/#([0-9A-Fa-f]{6,8})/g)) set.add(norm(m[1]));
  return set;
}

/** 第 11 节是否已记录「配置配色有问题」 */
function docRecorded(md) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => /^##\s*11\./.test(l));
  const seg = i < 0 ? md : lines.slice(i).join('\n');
  return /dub-styles\.json|dub-visual\.json|dub 通路/.test(seg) && /palette|底色|配色/.test(seg);
}

const backlog = [], fresh = [], noSec = [];

for (const e of cfg.styles) {
  const mdPath = path.join(DIR, e.slug, 'SKILL.md');
  if (!fs.existsSync(mdPath)) { noSec.push({ slug: e.slug, why: '无 SKILL.md' }); continue; }
  const md = fs.readFileSync(mdPath, 'utf8');
  const S = section3Hexes(md);
  if (!S) { noSec.push({ slug: e.slug, why: '无 §3 配色体系' }); continue; }
  if (!S.size) { noSec.push({ slug: e.slug, why: '§3 里没抽出任何 hex' }); continue; }

  const bg = e.palette && e.palette.bg;
  const stops = (e.bgRecipe && e.bgRecipe.stops) || [];
  if (!bg) continue;
  if (nearAny(bg, S) || stops.some((s) => nearAny(s, S))) continue;

  const rec = docRecorded(md);
  const item = { slug: e.slug, bg, stops: stops.join(' '), docHas: [...S].slice(0, 6).map((x) => '#' + x).join(' '), rec };
  (rec ? backlog : fresh).push(item);
}

const show = (list, head) => {
  if (!list.length) return;
  console.log(head);
  for (const x of list) {
    console.log(`  ${x.slug.padEnd(20)} palette.bg = ${x.bg}${x.stops ? `  stops = ${x.stops}` : ''}`);
    console.log(`      文档 §3 出现的色：${x.docHas} …`);
  }
  console.log('');
};

show(backlog, `ℹ 已知积压（文档第 11 节**已记录**该配置冲突，故不判 FAIL）${backlog.length} 处：`);
show(fresh, `✘ **文档未记录**的可疑 ${fresh.length} 处（可能是新出现的抽取错误）：`);

if (!backlog.length && !fresh.length) console.log('✓ 所有风格的底色都能在各自文档的 §3 配色体系里找到。');
if (noSec.length) console.log(`ℹ 无法比对 ${noSec.length} 个：${noSec.map((x) => `${x.slug}（${x.why}）`).join('、')}`);

// ★ 失明守卫：0 个风格、或所有风格都进 noSec（没有任何一个可比对）⇒ 闸门空转 ⇒ FAIL
const blind = [];
if (cfg.styles.length === 0) blind.push('dub-styles.json 里 0 个风格');
else if (noSec.length === cfg.styles.length) blind.push(`全部 ${cfg.styles.length} 个风格都无法比对（SKILL.md 全读不到 / §3 结构变了？）⇒ 没有任何一个风格被真正检查`);
if (blind.length) {
  console.log(`\n✘ 失明：`);
  for (const b of blind) console.log(`  ✘ ${b}`);
}

const fails = (FAIL_ALL ? backlog.length + fresh.length : fresh.length) + blind.length;
console.log(`\n[闸门] 未记录的可疑 ${fresh.length} 处；已记录积压 ${backlog.length} 处；失明 ${blind.length} 处 ${fails ? '✘' : 'OK'}${FAIL_ALL ? '（--all 模式，积压也计 FAIL）' : ''}`);
process.exitCode = fails ? 1 : 0;
