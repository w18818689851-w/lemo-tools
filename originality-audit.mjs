#!/usr/bin/env node
/**
 * originality-audit.mjs —— 「从零原创」审计器 CLI。
 *
 * 用法：
 *   node originality-audit.mjs --new-content <path> --new-subjects <dir|file[,file...]> \
 *        --ref-content <path> --ref-subjects <dir|file[,file...]> --out <dir> \
 *        [--new-events <path>] [--ref-events <path>]
 *
 * 输出：<out>/originality.json + <out>/originality.md
 * 退出码：0 = 全部通过；1 = 有检查失败**或有检查无法判定**（素材缺失不放行）；2 = 用法/读文件错误。
 *
 * 说明：
 *   · events.json 默认按 content.json 所在目录自动发现；找不到就是 unknown（不默认通过）。
 *   · --new-subjects / --ref-subjects 可以给目录（扫全部 .js）、单个文件、或逗号分隔的多个文件。
 */

import fs from 'node:fs';
import path from 'node:path';

import { auditAll, renderMarkdown, STATUS, THRESHOLDS } from './lib/originality.mjs';

const TTY = process.stdout.isTTY;
const C = {
  ok: (x) => (TTY ? `\x1b[32m${x}\x1b[0m` : x),
  bad: (x) => (TTY ? `\x1b[31m${x}\x1b[0m` : x),
  warn: (x) => (TTY ? `\x1b[33m${x}\x1b[0m` : x),
  dim: (x) => (TTY ? `\x1b[2m${x}\x1b[0m` : x),
  b: (x) => (TTY ? `\x1b[1m${x}\x1b[0m` : x),
};
const out = (x = '') => process.stdout.write(`${x}\n`);
const err = (x) => process.stderr.write(`${x}\n`);

function usage(msg) {
  if (msg) err(C.bad(`✗ ${msg}`));
  err('');
  err('用法：node originality-audit.mjs --new-content <path> --new-subjects <dir|file> \\');
  err('         --ref-content <path> --ref-subjects <dir|file> --out <dir> \\');
  err('         [--new-events <path>] [--ref-events <path>]');
  err('');
  process.exit(2);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) usage(`无法识别的参数 ${k}`);
    const eq = k.indexOf('=');
    if (eq > 0) { a[k.slice(2, eq)] = k.slice(eq + 1); continue; }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) usage(`参数 ${k} 缺少取值`);
    a[k.slice(2)] = v; i++;
  }
  return a;
}

function readJson(p, what) {
  let text;
  try { text = fs.readFileSync(p, 'utf8'); }
  catch (e) { usage(`读不到${what}：${p}（${e.code || e.message}）`); }
  try { return JSON.parse(text); }
  catch (e) { usage(`${what}不是合法 JSON：${p}（${e.message}）`); }
}

/** 收集主体模块：目录 → 全部 .js；文件 → 单个；逗号分隔 → 多个。返回 [{name, path, text}]。 */
function collectSubjects(spec, what) {
  const parts = String(spec).split(',').map((x) => x.trim()).filter(Boolean);
  const files = [];
  for (const p of parts) {
    let st;
    try { st = fs.statSync(p); }
    catch { err(C.warn(`⚠️  ${what}路径不存在：${p}（记为素材缺失）`)); continue; }
    if (st.isDirectory()) {
      let names = [];
      try { names = fs.readdirSync(p); } catch { /* ignore */ }
      for (const n of names.sort()) {
        if (!n.toLowerCase().endsWith('.js')) continue;
        const fp = path.join(p, n);
        try { files.push({ name: n, path: fp, text: fs.readFileSync(fp, 'utf8') }); }
        catch (e) { err(C.warn(`⚠️  读不到 ${fp}：${e.code || e.message}`)); }
      }
      if (!files.length) err(C.warn(`⚠️  ${what}目录里没有 .js：${p}`));
    } else {
      try { files.push({ name: path.basename(p), path: p, text: fs.readFileSync(p, 'utf8') }); }
      catch (e) { err(C.warn(`⚠️  读不到 ${p}：${e.code || e.message}`)); }
    }
  }
  return files;
}

/** 找事件时间线：显式路径优先，否则按 content.json 所在目录自动发现。返回 { path, data }。 */
function autoEvents(contentPath, explicit, what) {
  if (explicit) {
    const p = path.resolve(explicit);
    try { return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
    catch (e) { err(C.warn(`⚠️  ${what} events 读不到/不是 JSON：${p}（${e.code || e.message}）`)); return { path: p, data: null }; }
  }
  const guess = path.join(path.dirname(contentPath), 'events.json');
  try { return { path: guess, data: JSON.parse(fs.readFileSync(guess, 'utf8')) }; }
  catch {
    err(C.warn(`⚠️  ${what} 未发现事件时间线：${guess}（记为素材缺失，无法判定）`));
    return { path: guess, data: null };
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) usage('缺少参数');
  const a = parseArgs(argv);

  for (const req of ['new-content', 'new-subjects', 'ref-content', 'ref-subjects', 'out']) {
    if (!a[req]) usage(`缺少必填参数 --${req}`);
  }

  const newContentPath = path.resolve(a['new-content']);
  const refContentPath = path.resolve(a['ref-content']);
  const outDir = path.resolve(a.out);

  const newContent = readJson(newContentPath, '新片 content');
  const refContent = readJson(refContentPath, '示例 content');
  const newFiles = collectSubjects(a['new-subjects'], '新片 subjects');
  const refFiles = collectSubjects(a['ref-subjects'], '示例 subjects');
  const newEv = autoEvents(newContentPath, a['new-events'], '新片');
  const refEv = autoEvents(refContentPath, a['ref-events'], '示例');
  const newEvents = newEv.data, refEvents = refEv.data;

  if (!newFiles.length) err(C.warn('⚠️  新片主体模块一个都没读到 —— 相关检查会如实报「素材缺失，无法判定」。'));

  let sameDir = false;
  try {
    sameDir = fs.realpathSync(path.resolve(a['new-subjects'])) === fs.realpathSync(path.resolve(a['ref-subjects']));
  } catch { /* 路径不存在就算了 */ }

  const report = auditAll({
    newContent, refContent, newFiles, refFiles, newEvents, refEvents,
    meta: {
      newContent: newContentPath,
      refContent: refContentPath,
      newSubjects: path.resolve(a['new-subjects']),
      refSubjects: path.resolve(a['ref-subjects']),
      newFiles: newFiles.map((f) => f.name),
      refFiles: refFiles.map((f) => f.name),
      newEvents: newEv.path,
      refEvents: refEv.path,
      thresholds: THRESHOLDS,
    },
  });

  const notes = [];
  if (sameDir) notes.push('新片与示例的 subjects 指向**同一个目录** —— 同一批文件互比必然判失败，这本身是正确行为，但请确认这是你的本意。');
  if (newEv.path === refEv.path && newEv.data) {
    notes.push(`两侧的事件时间线来自**同一个文件**（${newEv.path}）—— 它必然完全相同，\`timeline.order\` 这一条对本次审计**没有区分力**。新片请给自己的 events 时间线，并用 --new-events 指定。`);
  }
  if (!newEvents) notes.push('新片没有事件时间线，`timeline.order` 判为「无法判定」（不放行）。');
  if (!newFiles.length) notes.push('新片主体模块缺失，主体相关检查判为「无法判定」（不放行）。');
  report.notes = notes;

  try { fs.mkdirSync(outDir, { recursive: true }); }
  catch (e) { usage(`建不了输出目录 ${outDir}（${e.code || e.message}）`); }

  const jsonPath = path.join(outDir, 'originality.json');
  const mdPath = path.join(outDir, 'originality.md');
  let md = renderMarkdown(report);
  if (notes.length) {
    md = md.replace('\n## 汇总\n', `\n## 备注\n\n${notes.map((n) => `- ${n}`).join('\n')}\n\n## 汇总\n`);
  }
  try {
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(mdPath, md, 'utf8');
  } catch (e) { usage(`写不了报告（${e.code || e.message}）`); }

  const s = report.summary;
  out('');
  out(C.b('原创性审计 · 从零原创'));
  out(C.dim(`  新片 content  ${newContentPath}`));
  out(C.dim(`  示例 content  ${refContentPath}`));
  out('');
  for (const c of report.checks) {
    const tag = c.status === STATUS.PASS ? C.ok('PASS') : c.status === STATUS.FAIL ? C.bad('FAIL') : C.warn('UNKN');
    out(`  ${tag}  ${c.title} ${C.dim(`— ${c.detail}`)}`);
  }
  out('');
  out('─'.repeat(64));
  const head = `  通过 ${s.pass} / 失败 ${s.fail} / 无法判定 ${s.unknown}（共 ${s.total}）`;
  out(s.ok ? C.ok(head) : C.bad(head));
  out(C.dim(`  报告：${mdPath}`));
  out(C.dim(`        ${jsonPath}`));
  out('─'.repeat(64));
  out('');

  // 退出码：只要不是「全部 pass」就非 0 —— unknown 绝不默认放行。
  process.exitCode = s.ok ? 0 : 1;
}

try { main(); }
catch (e) { err(C.bad(`\n✗ 审计器自身异常：${(e && e.stack) || e}\n`)); process.exit(2); }
