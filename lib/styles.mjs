// lib/styles.mjs —— 风格索引（9 大类）解析 + 最小 markdown 渲染
//
// ★ 为什么放在**服务端**：
//   分类判据（`## 英文 · 中文` 标题 + 表格里的 `` [`slug`] `` 引用）只写在这里一处。
//   本项目反复吃过「同一判据写在两处 → 必须同步改 → 漂移」的亏（见 lib/env.mjs 的注释），
//   所以前端**不做任何解析**，只消费 /api/demos 里的 categories。
//
// ★ 硬要求：解析失败必须**优雅降级**，绝不抛错、绝不让风格列表变空。
//   README 不存在 / 格式变了 / 一行都没匹配上 → 返回 null，调用方退回扁平列表。

import fs from 'node:fs';
import path from 'node:path';

// ── 1. 风格索引（styles/README.md）──────────────────────────
//
// 源文件结构（实测 D:\lemo-opuscar\styles\README.md）：
//     ## Hand-drawn & Painting · 手绘与绘画
//
//     | Style | 风格 | Folder | Our demo |
//     |---|---|---|---|
//     | Crayon Picture Book | 蜡笔儿童绘本 | [`crayon-book`](crayon-book/STYLE.md) | *The Moon Can't Sleep* |
//
// 解析策略：`##` 开一个分类；表格行里凡是出现 `` [`slug`](…) `` 的，取该行前两列当英文名/中文名。

const CAT_RE = /^##\s+(.+?)\s*$/;
const LINK_RE = /\[`([^`]+)`\]\(([^)]*)\)/;

/**
 * 读并解析风格索引。**任何异常都返回 null**（调用方降级为扁平列表）。
 * @returns {{categories: Array<{key:string,en:string,cn:string,slugs:string[]}>, bySlug: Map<string,{cat:string,en:string,cn:string}>} | null}
 */
export function readStyleIndex(stylesDir) {
  let src;
  try {
    src = fs.readFileSync(path.join(stylesDir, 'README.md'), 'utf8');
  } catch {
    return null;                       // README 不在 → 降级
  }
  try {
    return parseStyleIndex(src);
  } catch {
    return null;                       // 格式变了 → 降级
  }
}

/** 纯函数版（便于单测/复现）：解析失败同样返回 null。 */
export function parseStyleIndex(src) {
  if (typeof src !== 'string' || !src) return null;

  const lines = src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const categories = [];
  const bySlug = new Map();
  let cur = null;

  for (const raw of lines) {
    const line = raw.trim();

    const h = CAT_RE.exec(line);
    if (h) {
      const title = h[1];
      const m = /^(.+?)\s*·\s*(.+)$/.exec(title);
      const en = (m ? m[1] : title).trim();
      const cn = (m ? m[2] : title).trim();
      cur = { key: en, en, cn, slugs: [] };
      categories.push(cur);
      continue;
    }
    if (!cur) continue;

    if (!line.startsWith('|')) continue;
    const link = LINK_RE.exec(line);
    if (!link) continue;                       // 表头 / `|---|` 分隔行都没有反引号链接

    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
    const slug = link[1];
    if (!/^[A-Za-z0-9._-]+$/.test(slug)) continue;

    // 前两列固定是「英文名 | 中文名」（源文件表头就是 `| Style | 风格 | Folder |`），
    // 但为了不让列序变化直接炸掉，只在「链接所在列」之前取列。
    const ci = cells.findIndex((c) => c.includes(link[0]));
    const nameEn = (ci > 0 ? cells[0] : '') || '';
    const nameCn = (ci > 1 ? cells[1] : '') || '';

    if (!cur.slugs.includes(slug)) cur.slugs.push(slug);
    bySlug.set(slug, { cat: cur.key, en: nameEn, cn: nameCn });
  }

  // 一个分类都没解析出来 → 视为格式不符，降级
  const usable = categories.filter((c) => c.slugs.length > 0);
  if (!usable.length || !bySlug.size) return null;

  return { categories: usable, bySlug };
}

// ── 2. 最小 markdown → HTML ─────────────────────────────────
//
// ★ 安全模型（**这是本模块存在的一半理由**）：
//   输入是仓库里的 .md 文件，但**仍然不可信**（仓库可以被改、可以被别人 PR）。
//   所以渲染顺序是「**先整体转义 `& < > " '` → 再套我们自己的标签**」，
//   md 里的 `<script>`、`<img onerror=…>` 会变成纯文本，**没有任何原始 HTML 进入 DOM**。
//   链接还要再过一道 sanitizeUrl，挡掉 `javascript:` / `data:` 这类伪协议。

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')      // ★ & 必须第一个换，否则会把后面生成的实体再转一遍
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 只放行 http/https/mailto 与相对链接；其余（javascript:、data:…）返回 null → 降级成纯文本。 */
function sanitizeUrl(u) {
  const s = String(u || '').trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!s) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return /^(https?|mailto):/i.test(s) ? s : null;
  return s;                                   // 无协议的相对路径 / #锚点 / /绝对路径
}

/** 行内：`code` → 链接 → **粗体** → *斜体*。入参必须是**已转义**的文本。 */
function inline(esc) {
  let s = esc;

  // 行内代码先抽出来占位，免得里面的 * _ [ ] 被当成语法
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, c) => `\u0000${codes.push(c) - 1}\u0000`);

  // 图片：不引外链（零 CDN），只保留 alt 文本
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 链接（URL 允许一层嵌套括号，如 wikipedia 的 `(disambiguation)`；否则会把尾巴 `)` 留在正文里）
  s = s.replace(/\[([^\]]+)\]\(([^()\s]*(?:\([^()]*\)[^()\s]*)*)(?:\s+"[^"]*")?\)/g, (m, txt, url) => {
    const u = sanitizeUrl(url);
    return u ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${txt}</a>` : txt;
  });
  // 粗体 / 斜体
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w*])__([^_\n]+)__(?!\w)/g, '$1<strong>$2</strong>');
  s = s.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');

  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i) => `<code>${codes[Number(i)]}</code>`);
  return s;
}

const indentOf = (l) => (/^(\s*)/.exec(l)[1] || '').replace(/\t/g, '    ').length;
const ITEM_RE = /^([-*+]|\d+[.)])\s+(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const HEAD_RE = /^(#{1,6})\s+(.*)$/;
const isTableSep = (t) => /^\|[\s:|-]+\|$/.test(t) && t.includes('-');

/** 渲染 markdown 为 HTML。**任何输入都不会抛错**（最差退化成转义后的纯文本）。 */
export function renderMarkdown(md) {
  try {
    return renderBlocks(String(md == null ? '' : md));
  } catch (e) {
    return `<pre>${escapeHtml(md)}</pre><!-- 渲染失败：${escapeHtml(e && e.message)} -->`;
  }
}

function renderBlocks(src) {
  const lines = src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { i++; continue; }

    // ── 围栏代码块 ──
    const fence = /^```\s*([\w+-]*)\s*$/.exec(t);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++;                                              // 吃掉收尾 ```
      const cls = fence[1] ? ` class="lang-${escapeHtml(fence[1])}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // ── 标题 ──
    const h = HEAD_RE.exec(t);
    if (h) {
      const lv = h[1].length;
      out.push(`<h${lv}>${inline(escapeHtml(h[2]))}</h${lv}>`);
      i++;
      continue;
    }

    // ── 分隔线 ──
    if (HR_RE.test(t)) { out.push('<hr>'); i++; continue; }

    // ── 表格（当前行是表头、下一行是 `|---|---|`）──
    if (t.startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1].trim())) {
      const head = splitRow(t);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { body.push(splitRow(lines[i].trim())); i++; }
      let html = '<div class="md-tablewrap"><table><thead><tr>';
      for (const c of head) html += `<th>${inline(escapeHtml(c))}</th>`;
      html += '</tr></thead><tbody>';
      for (const row of body) {
        html += '<tr>';
        for (let k = 0; k < head.length; k++) html += `<td>${inline(escapeHtml(row[k] == null ? '' : row[k]))}</td>`;
        html += '</tr>';
      }
      out.push(html + '</tbody></table></div>');
      continue;
    }

    // ── 引用块 ──
    if (/^>/.test(t)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderBlocks(buf.join('\n'))}</blockquote>`);
      continue;
    }

    // ── 列表 ──
    if (ITEM_RE.test(t)) {
      const r = renderList(lines, i);
      out.push(r.html);
      i = r.next;
      continue;
    }

    // ── 段落：吃到空行或下一个块级起点 ──
    {
      const buf = [];
      while (i < lines.length) {
        const cur = lines[i];
        const ct = cur.trim();
        if (!ct) break;
        if (HEAD_RE.test(ct) || HR_RE.test(ct) || /^```/.test(ct) || /^>/.test(ct) || ITEM_RE.test(ct)) break;
        if (ct.startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1].trim())) break;
        buf.push(ct);
        i++;
      }
      if (buf.length) out.push(`<p>${inline(escapeHtml(buf.join(' ')))}</p>`);
    }
  }
  return out.join('\n');
}

function splitRow(t) {
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
}

/** 列表：支持一层嵌套（子项缩进更深）与「缩进但无标记」的续行。 */
function renderList(lines, start) {
  const base = indentOf(lines[start]);
  const ordered = /^\s*\d+[.)]\s+/.test(lines[start]);
  const items = [];
  let i = start;

  while (i < lines.length) {
    const l = lines[i];
    const t = l.trim();

    if (!t) {
      // 空行：只有「下一个非空行仍是本层的列表项」才继续，否则结束
      const nxt = lines[i + 1] == null ? '' : lines[i + 1];
      if (/^\s*([-*+]|\d+[.)])\s+/.test(nxt) && indentOf(nxt) >= base) { i++; continue; }
      break;
    }

    const m = ITEM_RE.exec(t);
    const ind = indentOf(l);

    if (m && ind >= base) {
      // 标记类型变了（无序 → 有序，或反之）→ 这是**另一个列表**，结束本层
      const isOrdered = /^\d/.test(m[1]);
      if (isOrdered !== ordered) break;
      if (ind > base && items.length) items[items.length - 1].children.push(l);
      else items.push({ text: m[2], children: [] });
      i++;
      continue;
    }
    if (!m && items.length && ind > base) {           // 续行，拼进上一条
      items[items.length - 1].text += ' ' + t;
      i++;
      continue;
    }
    break;
  }

  const tag = ordered ? 'ol' : 'ul';
  let html = `<${tag}>`;
  for (const it of items) {
    html += `<li>${inline(escapeHtml(it.text))}`;
    if (it.children.length) {
      const sub = renderList(it.children, 0);
      html += sub.html;
    }
    html += '</li>';
  }
  return { html: html + `</${tag}>`, next: i };
}
