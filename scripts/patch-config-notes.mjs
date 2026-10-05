#!/usr/bin/env node
/**
 * scripts/patch-config-notes.mjs —— 给 `lib/dub-styles.json` 里**过期的 `notes` 断言**追加更正子句
 *
 * ★ 由来：`check-config-notes.mjs` 报出 8 处「notes 说某字段缺失/为 null，字段其实有值」。
 *   全是 notes **手写散文没跟上字段变更**（字段后来被填上了）。
 *
 * ★ 为什么用「追加更正」而不是「就地改写散文」：
 *   · 与仓库既有约定一致（原始观察保留 + 追加 `★ 已修/更正`），可回溯；
 *   · 就地改写要猜哪一段是过期断言，改错会丢信息 —— 追加只增不减。
 *   ★ **不要反过来把字段清空** —— 字段里的值是真实在用的，notes 才是过期的那一方。
 *
 * 幂等：notes 已含 `2026-10-03 更正` 即跳过。
 * 用法：node scripts/patch-config-notes.mjs [--dry]
 */
import fs from 'node:fs';

const CFG = 'D:/lemo-tools/lib/dub-styles.json';
const DRY = process.argv.includes('--dry');
const MARK = '2026-10-03 更正';

const isBlank = (v) => v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && v !== null && !Array.isArray(v) &&
    Object.values(v).every((x) => x === null || x === undefined || x === ''));

const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
let n = 0, skip = 0;

for (const e of cfg.styles) {
  const notesText = String(e.notes || '');
  if (!notesText) continue;
  if (notesText.includes(MARK)) { skip++; continue; }

  const pat = /(?:★\s*)?(?:⚠\s*)?(?:\*\*)?((?:palette|bgRecipe|subtitle|title|overlay|motion)(?:\.\w+)?)(?:\*\*)?\s*(?:全为\s*null|为\s*null|缺失|未抽到|没抽到)/g;
  const bad = [];
  for (const m of notesText.matchAll(pat)) {
    const path = m[1];
    const v = get(e, path);
    if (!isBlank(v)) bad.push({ path, actual: JSON.stringify(v).slice(0, 120) });
  }
  if (!bad.length) continue;

  const lines = bad.map((b) => `\`${b.path}\` = ${b.actual}`);
  e.notes = notesText.replace(/\s*$/, '') +
    ` ★ **${MARK}**：上文的「缺失 / 为 null」断言**已过期** —— 字段后来被填上了，当前实际值：${lines.join('；')}。` +
    `（字段里的值是**真实在用**的，请以字段为准；原断言保留作历史。）`;
  n++;
  console.log(`  ✓ ${e.slug.padEnd(20)} 追加更正（${bad.map((b) => b.path).join(', ')}）`);
}

if (!DRY && n) fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2) + '\n');
console.log(`\n更正 ${n} 条；跳过 ${skip} 条（已含更正标记）`);
if (DRY) console.log('★ 干跑，未写入。');
