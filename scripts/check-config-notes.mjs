#!/usr/bin/env node
/**
 * scripts/check-config-notes.mjs —— `lib/dub-styles.json` 里 **`notes` 与它自己的字段是否自相矛盾**
 *
 * ★ 为什么需要它（2026-10-03 实踩）：
 *   `dub-styles.json` 每条都有一段 `notes` 文字说明，是下游智能体读配置时的**主要解释**。
 *   但 `notes` 是**手写散文**，字段改过之后 notes 常常没跟着改 ⇒ 出现「notes 说某字段是 null/缺失，
 *   字段其实有值」这类**自相矛盾**。实测先例：`papercut-red` 的 notes 说「修正后应为 bg #f2e8d0」，
 *   而字段实际是 `#D2201F`（该条已修）。
 *
 * 判据（**只查可机械验证的一类**，不猜散文语义）：
 *   从 `notes` 里抽出「<字段路径> 缺失 / 为 null / 全为 null / 未抽到」这类断言，
 *   再到该条配置里核实该路径**是不是真的为空**。有值 ⇒ 自相矛盾。
 *
 * ★ 但仓库的既有约定是「**原始观察保留 + 追加更正**」—— 更正后的 notes 里**仍然留着**那条旧断言
 *   （后面跟着 `★ 2026-10-03 更正：…`）。所以判据是两段式：
 *     ① 取**第一个更正标记之前**的正文，抽出里面的断言；
 *     ② 若断言与字段矛盾，**必须有更正标记、且该标记点名了同一条路径** —— 否则 FAIL。
 *   ⇒ 这样既不会因为「保留了历史」而误报，也不会让「没写更正」的过期断言漏过去。
 *
 * ★ 为什么**不**查「配置值 vs 文档描述的颜色不一致」：那需要判断「谁对」——
 *   文档里大量「dub 通路已退到 X 字体」「按场景轮换、本就没有单一固定值」是**有意回退**，不是错。
 *   那一类只作参考输出（`--verbose`），不计 FAIL。
 *
 * 用法：node scripts/check-config-notes.mjs [--verbose]
 * 退出码：有自相矛盾 → 1；否则 0。
 */
import fs from 'node:fs';

const CFG = 'D:/lemo-tools/lib/dub-styles.json';
const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));

const MARK_RE = /★\s*\*\*?\s*\d{4}-\d{2}-\d{2}\s*更正/;

const isBlank = (v) => v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && v !== null && !Array.isArray(v) &&
    Object.values(v).every((x) => x === null || x === undefined || x === ''));

const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const fails = [];
const notes = [];

for (const e of cfg.styles) {
  const full = String(e.notes || '');
  if (!full) continue;
  const mi = full.search(MARK_RE);
  const head = mi >= 0 ? full.slice(0, mi) : full;
  const tail = mi >= 0 ? full.slice(mi) : '';

  // 「<路径> 全为 null / 缺失 / 未抽到 / 没抽到」
  const pat = /(?:★\s*)?(?:⚠\s*)?(?:\*\*)?((?:palette|bgRecipe|subtitle|title|overlay|motion)(?:\.\w+)?)(?:\*\*)?\s*(?:全为\s*null|为\s*null|缺失|未抽到|没抽到)/g;
  for (const m of head.matchAll(pat)) {
    const path = m[1];
    const v = get(e, path);
    if (isBlank(v)) continue;                       // 断言成立，不算矛盾
    const covered = tail.includes(path);            // 更正里点过名
    if (!covered) {
      fails.push({ slug: e.slug, path, claim: m[0].trim(), actual: JSON.stringify(v).slice(0, 90), why: tail ? '有更正标记但没点到这条路径' : '没有任何更正标记' });
    }
  }

  // 参考类：notes 里出现的 hex，是否都不在 palette 里（只提示，不判 FAIL）
  const hexes = [...head.matchAll(/#[0-9A-Fa-f]{6,8}/g)].map((x) => x[0].toUpperCase());
  const palVals = Object.values(e.palette || {}).filter((x) => typeof x === 'string').map((x) => x.toUpperCase());
  const notInPal = hexes.filter((h) => !palVals.includes(h));
  if (hexes.length && notInPal.length) {
    notes.push({ slug: e.slug, notesHex: hexes.length, notInPalette: notInPal.length, sample: notInPal.slice(0, 4).join(' ') });
  }
}

if (fails.length) {
  console.log(`✘ notes 与字段自相矛盾 ${fails.length} 处：\n`);
  for (const f of fails) console.log(`  ${f.slug.padEnd(20)} notes 说「${f.claim}」，但 ${f.path} 实际 = ${f.actual}  ← ${f.why}`);
  console.log('\n修法：跑 `node scripts/patch-config-notes.mjs`（给过期的 notes 追加更正子句）。');
  console.log('      **不要**反过来把字段清空 —— 字段里的值是真实在用的，notes 才是过期的那一方。');
} else {
  console.log('✓ 未发现 notes 与字段自相矛盾（过期的断言都已带更正标记）。');
}

if (process.argv.includes('--verbose') && notes.length) {
  console.log(`\nℹ 参考：notes 里出现但不在 palette 里的 hex（多为「来源色板」或有意回退，不判 FAIL）${notes.length} 条：`);
  for (const x of notes) console.log(`  ${x.slug.padEnd(20)} notes 有 ${x.notesHex} 个 hex，其中 ${x.notInPalette} 个不在 palette（如 ${x.sample}）`);
}

console.log(`\n[闸门] notes 自相矛盾 ${fails.length} 处 ${fails.length ? '✘' : 'OK'}${notes.length ? `；hex 参考 ${notes.length} 条` : ''}`);
process.exitCode = fails.length ? 1 : 0;
