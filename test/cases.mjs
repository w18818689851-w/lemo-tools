// test/cases.mjs —— lemo 控制台冒烟测试用例（零依赖）
//
// 分两类：
//   STATIC_CASES  不需要起服务：纯文件检查 + 纯函数单测 + CLI 子进程
//   SERVER_CASES  需要控制台服务在跑：HTTP 接口逐个打
//
// 上下文 ctx 由 test/smoke.mjs 构造，形状见其文件头。
//
// ★ 用例只读项目、只读接口。唯一有副作用的两件事：
//   1. CLI 子进程（lemo-make.mjs 自己会写 D:\lemo-films 的锁/输出目录，属正常）
//   2. /api/run 起一个 dry-run 任务（不渲染、不混流）
//   测试服务覆写 .console-port / 打开控制台.url 的副作用由 smoke.mjs 负责备份还原。

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

// ── 红线常量 ────────────────────────────────────────────────
/** ★ 编排器的权威 md5。控制台只是包装层，绝不能改它。 */
export const ORCH_MD5 = '0554085abb34c50e3e1bcfe8f28ab0e1';

/** /api/demos 的期望规模（来自 styles/README.md 的 9 大类索引）。 */
export const EXPECT_STYLES = 43;
export const EXPECT_CATEGORIES = 9;

// ── 工具 ────────────────────────────────────────────────────
export function md5Of(buf) {
  return createHash('md5').update(buf).digest('hex');
}

/** 数 CR / LF 字节。★ 不用 grep $'\r'（Git Bash 下不可靠）。 */
export function countEol(buf) {
  let cr = 0;
  let lf = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 13) cr++;
    else if (buf[i] === 10) lf++;
  }
  return { cr, lf };
}

/**
 * 项目里的「源码」文件 —— .gitattributes 规定这些一律 LF。
 * 含 test/ 自己（测试代码也是源码，同样不许混进 CR）。
 */
export function sourceFiles(root) {
  const out = [];
  const SRC_RE = /\.(mjs|js|css|html|md)$/i;
  const add = (rel) => {
    const p = path.join(root, rel);
    try { if (fs.statSync(p).isFile()) out.push(rel); } catch { /* 不存在就跳过 */ }
  };
  for (const f of fs.readdirSync(root)) if (SRC_RE.test(f)) add(f);
  add('.gitattributes');
  add('.gitignore');
  for (const d of ['lib', 'web', 'test']) {
    let names = [];
    try { names = fs.readdirSync(path.join(root, d)); } catch { continue; }
    for (const f of names) if (SRC_RE.test(f)) add(path.join(d, f));
  }
  return [...new Set(out)].sort();
}

/**
 * 异步跑一个 node 子进程。
 * ★ 本环境 spawnSync 一律 EBUSY，只能用异步 spawn。
 */
export function runNode(args, { cwd, timeoutMs = 120000, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd, windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...env },
    });
    let stdout = '';
    let stderr = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error(`子进程超时（${timeoutMs}ms）：node ${args.join(' ')}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`));
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); reject(e); });
    child.on('close', (code, signal) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

/**
 * 扫「已渲染的 HTML」里有没有可执行的东西。
 * ★ 只看**真正的标签**（`<tag …>`），不看转义后的正文 —— 否则正文里写
 *   `&lt;img onerror=x&gt;`（已被转义成纯文本、完全无害）会假阳性。
 */
export function scanUnsafeHtml(html) {
  const problems = [];
  if (/<script\b/i.test(html)) problems.push('出现裸 <script>');
  if (/<iframe\b/i.test(html)) problems.push('出现裸 <iframe>');
  for (const tag of html.match(/<[a-zA-Z/][^>]*>/g) || []) {
    const on = /\son[a-z]+\s*=/i.exec(tag);
    if (on) problems.push(`标签里带事件属性 ${on[0].trim()}：${tag.slice(0, 80)}`);
    if (/javascript\s*:/i.test(tag)) problems.push(`标签里带 javascript: 伪协议：${tag.slice(0, 80)}`);
  }
  return problems;
}

// ── 静态用例（不需要起服务）─────────────────────────────────
export const STATIC_CASES = [
  {
    name: '① 编排器 md5 未被改动（红线）',
    run: (ctx) => {
      const buf = fs.readFileSync(ctx.orchPath);
      const got = md5Of(buf);
      assert.ok(
        got === ORCH_MD5,
        `编排器被改动了 —— 控制台不应该修改它！\n  期望 md5 ${ORCH_MD5}\n  实际 md5 ${got}\n  文件 ${ctx.orchPath}（${buf.length} 字节）`,
      );
    },
  },
  {
    name: '② 源码行尾全为 LF（CR 计数 == 0）',
    run: (ctx) => {
      const files = sourceFiles(ctx.root);
      assert.ok(files.length >= 10, `扫到的源码文件太少（${files.length}），路径可能不对`);
      const bad = [];
      for (const rel of files) {
        const { cr, lf } = countEol(fs.readFileSync(path.join(ctx.root, rel)));
        if (cr !== 0) bad.push(`${rel}（CR=${cr} LF=${lf}）`);
      }
      assert.ok(
        bad.length === 0,
        `以下源码混进了 CR（.gitattributes 规定 eol=lf）：\n  ${bad.join('\n  ')}\n`
        + '  —— 行尾被 git 静默改写过？检查 .gitattributes / core.autocrlf。',
      );
      ctx.note(`② 已核验 ${files.length} 个源码文件全为 LF`);
    },
  },
  {
    name: '② 所有 .bat 均为 CRLF（不只 start-console.bat）',
    run: (ctx) => {
      // ★ 为什么要把「全部 .bat」升成断言而不是只记录：
      //   lemo-make.bat 曾是 LF（CR=0 LF=41），与 .gitattributes 的 *.bat eol=crlf 不符。
      //   cmd.exe 对 LF-only 批处理解析不可靠 —— 而它是 README 里写的入口。
      //   只断言一个文件 = 其它 .bat 失守时测试仍然全绿。
      const bats = fs.readdirSync(ctx.root).filter((f) => f.toLowerCase().endsWith('.bat'));
      assert.ok(bats.length > 0, '仓库里一个 .bat 都没有？');
      const bad = [];
      for (const f of bats) {
        const { cr, lf } = countEol(fs.readFileSync(path.join(ctx.root, f)));
        if (!(cr > 0 && cr === lf)) bad.push(`${f}(CR=${cr} LF=${lf})`);
      }
      assert.strictEqual(bad.length, 0,
        `.bat 行尾不是纯 CRLF：${bad.join(' / ')} —— cmd.exe 对 LF-only 批处理解析不可靠`);
      ctx.note(`② 已核验 ${bats.length} 个 .bat 全为 CRLF：${bats.join(', ')}`);
    },
  },
  {
    name: '② .gitattributes 行尾规则在位',
    run: (ctx) => {
      const src = fs.readFileSync(path.join(ctx.root, '.gitattributes'), 'utf8');
      assert.match(src, /^\*\s+text=auto\s+eol=lf\s*$/m, '.gitattributes 缺「* text=auto eol=lf」—— 源码默认行尾失守');
      assert.match(src, /^\*\.bat\s+text\s+eol=crlf\s*$/m, '.gitattributes 缺「*.bat text eol=crlf」—— 批处理行尾失守');
    },
  },
  {
    name: '③ markdown 渲染器对注入内容做了转义（单测）',
    run: async (ctx) => {
      const { renderMarkdown } = await import('../lib/styles.mjs');
      const hostile = [
        '# 标题',
        '',
        '<script>alert(1)</script>',
        '',
        '<img src=x onerror="alert(2)">',
        '',
        '[点我](javascript:alert(3))',
        '',
        '| a | b |',
        '|---|---|',
        '| <svg onload=alert(4)> | x |',
      ].join('\n');
      const html = renderMarkdown(hostile);
      const problems = scanUnsafeHtml(html);
      assert.ok(problems.length === 0, `渲染结果里出现了可执行内容：\n  ${problems.join('\n  ')}`);
      assert.match(html, /&lt;script&gt;/, '原文里的 <script> 没有被转义成 &lt;script&gt;');
      assert.doesNotMatch(html, /href="javascript:/i, 'javascript: 伪协议链接没有被降级');
    },
  },
  {
    name: '⑤ CLI dry-run 仍 exit 0（包装层没破坏命令行用法）',
    run: async (ctx) => {
      const r = await runNode(['lemo-make.mjs', 'ascii-crt', '--skip-sync', '--dry-run'], { cwd: ctx.root, timeoutMs: 120000 });
      assert.strictEqual(
        r.code, 0,
        `CLI 退出码 ${r.code}（期望 0）\n--- stdout ---\n${r.stdout}\n--- stderr ---\n${r.stderr}`,
      );
      ctx.state.cliDryRun = r;
    },
  },
  {
    name: '⑤ CLI dry-run 打印步骤标记 [1]',
    run: (ctx) => {
      const r = ctx.state.cliDryRun;
      assert.ok(r, '依赖上一条 CLI 用例的输出，但上一条没跑成');
      assert.match(r.stdout, /\[1\]/, `CLI 输出里找不到步骤标记 [1]\n--- stdout ---\n${r.stdout}`);
    },
  },
];

// ── 服务端用例（需要控制台在跑）─────────────────────────────
export const SERVER_CASES = [
  {
    name: '③ GET / → 200 HTML',
    run: async (ctx) => {
      const r = await ctx.get('/');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      assert.match(String(r.headers['content-type'] || ''), /text\/html/i, `Content-Type=${r.headers['content-type']}`);
      assert.match(r.text, /<!DOCTYPE html>/i, '根路径返回的不是 HTML 文档');
    },
  },
  {
    name: '③ GET /api/env → 200 且 summary.total / runnable 存在',
    run: async (ctx) => {
      const r = await ctx.get('/api/env', { timeoutMs: 180000 });
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      const d = r.json;
      assert.ok(d && typeof d === 'object', '返回不是 JSON 对象');
      assert.strictEqual(typeof d.summary?.total, 'number', `summary.total 不是数字：${JSON.stringify(d.summary)}`);
      assert.strictEqual(typeof d.runnable, 'boolean', `runnable 不是布尔：${JSON.stringify(d.runnable)}`);
      assert.ok(Array.isArray(d.groups) && d.groups.length > 0, 'groups 为空');
    },
  },
  {
    name: `③ GET /api/demos → ${EXPECT_STYLES} 风格 / ${EXPECT_CATEGORIES} 分类 / 0 未归类`,
    run: async (ctx) => {
      const r = await ctx.get('/api/demos');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      const d = r.json;
      assert.ok(Array.isArray(d.styles), 'styles 不是数组');
      assert.strictEqual(d.styles.length, EXPECT_STYLES, `风格数 ${d.styles.length}（期望 ${EXPECT_STYLES}）`);
      assert.strictEqual(d.count, d.styles.length, `count(${d.count}) 与 styles.length(${d.styles.length}) 不一致`);
      assert.ok(Array.isArray(d.categories), 'categories 不是数组');
      assert.strictEqual(d.categories.length, EXPECT_CATEGORIES, `分类数 ${d.categories.length}（期望 ${EXPECT_CATEGORIES}）—— README 索引解析降级了？`);
      assert.strictEqual(d.categorized, true, 'categorized=false —— 索引解析降级成扁平列表了');
      const uncat = d.styles.filter((s) => !s.category).map((s) => s.slug);
      assert.deepStrictEqual(uncat, [], `有 ${uncat.length} 个风格未归类：${uncat.join(', ')}`);
    },
  },
  {
    name: '③ GET /api/films → 200 且有 films 数组',
    run: async (ctx) => {
      const r = await ctx.get('/api/films');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      assert.ok(Array.isArray(r.json.films), `films 不是数组：${r.text.slice(0, 200)}`);
    },
  },
  {
    name: '③ GET /api/jobs → 200 且有 jobs 数组',
    run: async (ctx) => {
      const r = await ctx.get('/api/jobs');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      assert.ok(Array.isArray(r.json.jobs), `jobs 不是数组：${r.text.slice(0, 200)}`);
      assert.ok(r.json.queue && typeof r.json.queue === 'object', 'queue 快照缺失');
    },
  },
  {
    name: '③ GET /api/console → 200 且 store.ready === true',
    run: async (ctx) => {
      const r = await ctx.get('/api/console');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      assert.strictEqual(r.json.store?.ready, true, `历史落盘不可用：${JSON.stringify(r.json.store)}`);
    },
  },
  {
    name: '③ GET /api/style/ascii-crt → 200 且无裸 <script> / on* 属性',
    run: async (ctx) => {
      const r = await ctx.get('/api/style/ascii-crt');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      const d = r.json;
      assert.strictEqual(d.hasStyle, true, 'ascii-crt 没有 STYLE.md');
      assert.ok(typeof d.styleHtml === 'string' && d.styleHtml.length > 0, 'styleHtml 为空');
      const problems = scanUnsafeHtml(d.styleHtml + '\n' + d.demoHtml);
      assert.ok(problems.length === 0, `服务端渲染结果里出现可执行内容：\n  ${problems.join('\n  ')}`);
    },
  },
  {
    name: '③ GET /api/precheck?slug=ascii-crt → 200 且含 locked/stale/alive',
    run: async (ctx) => {
      const r = await ctx.get('/api/precheck?slug=ascii-crt');
      assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
      for (const k of ['locked', 'stale', 'alive']) {
        assert.strictEqual(typeof r.json[k], 'boolean', `字段 ${k} 不是布尔：${JSON.stringify(r.json)}`);
      }
      assert.ok(!(r.json.locked && r.json.stale), 'locked 与 stale 同时为 true —— 判据自相矛盾');
    },
  },
  {
    name: '③ 未知接口 → 404',
    run: async (ctx) => {
      const r = await ctx.get('/api/definitely-not-a-route');
      assert.strictEqual(r.status, 404, `状态码 ${r.status}（期望 404）`);
    },
  },
  {
    name: '③ 非法 slug → 400（注入防护）',
    run: async (ctx) => {
      const r = await ctx.post('/api/run', { slug: '../etc/passwd', opts: [] });
      assert.strictEqual(r.status, 400, `状态码 ${r.status}（期望 400）body=${r.text.slice(0, 200)}`);
      const r2 = await ctx.post('/api/run', { slug: 'ascii-crt', opts: ['--out; rm -rf /'] });
      assert.strictEqual(r2.status, 400, `opts 里的非法字符没被拦下：${r2.status} ${r2.text.slice(0, 200)}`);
    },
  },
  {
    name: '③ 目录穿越不会泄漏项目文件',
    run: async (ctx) => {
      // server.mjs 的特征串：响应里只要出现它们，就说明源码被读出去了
      const LEAK_MARKS = ['lemo-tools 本地 Web 控制台', 'sendJson', 'const server = http.createServer'];
      for (const p of ['/api/style/..%2F..%2Fserver.mjs', '/../server.mjs', '/..%2Fserver.mjs', '/api/style/....//....//server.mjs']) {
        const r = await ctx.get(p);
        assert.ok([400, 403, 404].includes(r.status), `${p} → 状态码 ${r.status}（期望 400/403/404）`);
        for (const m of LEAK_MARKS) {
          assert.ok(!r.text.includes(m), `${p} 的响应里泄漏了 server.mjs 内容（命中 "${m}"）：${r.text.slice(0, 160)}`);
        }
      }
      // 对照：web/ 下的真实文件必须正常返回 —— 否则上面那几条「不是 200」可能只是静态服务整体坏了
      const ok = await ctx.get('/app.js');
      assert.strictEqual(ok.status, 200, `web/app.js 取不到（${ok.status}）—— 静态服务本身有问题`);
      assert.match(String(ok.headers['content-type'] || ''), /javascript/i, `app.js 的 Content-Type=${ok.headers['content-type']}`);
    },
  },
  {
    name: '④ dry-run 任务全链路（POST /api/run → 轮询 → SSE 日志）',
    run: async (ctx) => {
      // ── 1) 入队 ──
      const r = await ctx.post('/api/run', { slug: 'ascii-crt', opts: ['--skip-sync', '--dry-run'] });
      assert.strictEqual(r.status, 200, `POST /api/run 状态码 ${r.status}：${r.text.slice(0, 300)}`);
      const job = r.json.job;
      assert.ok(job && typeof job.id === 'string' && job.id, `返回里没有 job.id：${r.text.slice(0, 300)}`);
      ctx.note(`④ 任务已入队：${job.id}`);

      // ── 2) 轮询到结束 ──
      const deadline = Date.now() + 60000;
      let last = null;
      let sawRunning = false;
      while (Date.now() < deadline) {
        const j = await ctx.get('/api/jobs');
        last = (j.json.jobs || []).find((x) => x.id === job.id) || null;
        if (last?.status === 'running') sawRunning = true;
        if (last && ['done', 'failed', 'canceled', 'ended'].includes(last.status)) break;
        await ctx.sleep(400);
      }
      assert.ok(last, `轮询 60s 后 /api/jobs 里找不到任务 ${job.id}`);
      assert.ok(['done', 'failed', 'canceled', 'ended'].includes(last.status),
        `任务 60s 内没结束，最后状态 ${last.status}`);
      assert.strictEqual(last.status, 'done', `任务状态 ${last.status}（期望 done），error=${last.error}`);
      assert.strictEqual(last.exitCode, 0, `退出码 ${last.exitCode}（期望 0）`);
      ctx.note(`④ 任务 ${job.id} → ${last.status} / exit ${last.exitCode}（期间观察到 running=${sawRunning}）`);

      // ── 3) SSE 日志回放 ──
      const { events } = await ctx.sse(`/api/logs/${job.id}`, {
        timeoutMs: 20000,
        stopOn: (ev) => ev.type === 'end',
      });
      const lines = events.filter((e) => e.type === 'line');
      assert.ok(lines.length > 0, `SSE 一条日志行都没回放到（收到 ${events.length} 个事件）`);
      assert.ok(lines.some((e) => String(e.line).includes('[1]')),
        `日志里找不到步骤标记 [1]；前 5 行：${lines.slice(0, 5).map((e) => e.line).join(' | ')}`);
      const end = events.find((e) => e.type === 'end');
      assert.ok(end, 'SSE 没有回放 end 事件');
      assert.strictEqual(end.status, 'done', `SSE end.status=${end.status}`);
      ctx.note(`④ SSE 回放 ${lines.length} 行日志，含 [1] 与 end 事件`);
    },
  },
];

// ── --full 才跑的完整回归（约 80 秒）────────────────────────
export const FULL_CASES = [
  {
    name: '⑤+ 完整回归 ascii-crt --skip-sync → exit 0 且 MUX_OK src/out = 1435',
    run: async (ctx) => {
      const r = await runNode(['lemo-make.mjs', 'ascii-crt', '--skip-sync'], { cwd: ctx.root, timeoutMs: 600000 });
      assert.strictEqual(r.code, 0, `完整回归退出码 ${r.code}（期望 0）\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}\n--- stderr ---\n${r.stderr.slice(-2000)}`);
      assert.match(r.stdout, /MUX_OK/, `输出里没有 MUX_OK\n--- 末尾 stdout ---\n${r.stdout.slice(-3000)}`);
      assert.match(r.stdout, /src_frames=1435/, '输出里没有 src_frames=1435');
      assert.match(r.stdout, /out_frames=1435/, '输出里没有 out_frames=1435');
    },
  },
];
