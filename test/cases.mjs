// test/cases.mjs —— lemo 控制台冒烟测试用例（零依赖）
//
// 分三类：
//   STATIC_CASES   不需要起服务：纯文件检查 + 纯函数单测 + CLI 子进程
//   SERVER_CASES   需要控制台服务在跑：HTTP 接口逐个打
//   PROCESS_CASES  在本进程里 import lib/jobs.mjs 起一个独立队列：验 WSL 侧进程组 kill、日志裁剪/gap
//
// 上下文 ctx 由 test/smoke.mjs 构造，形状见其文件头。
//
// ★ 用例只读项目、只读接口。有副作用的几件事（全部登记在 ARTIFACTS 里，跑完由 cleanupArtifacts 收掉）：
//   1. CLI 子进程（lemo-make.mjs 自己会写 D:\lemo-films 的锁/输出目录，属正常）
//   2. /api/run 起一个 dry-run 任务（不渲染、不混流）
//   3. ⑥ 取消一个 dry-run 任务 —— 会留下编排器的陈旧锁，测试自己删掉（只删 pid 对得上的那一个）
//   4. PROCESS_CASES 起两个任务（一个 sleep 120 的 wsl 步骤 + 一个 20050 行的 exe 步骤），
//      它们会写进 .console 的 index.json / logs；跑完从索引摘掉、日志文件删掉
//   5. WSL 侧的 /tmp 标记文件、D:\WSL 的临时脚本
//   测试服务覆写 .console-port / 打开控制台.url 的副作用由 smoke.mjs 负责备份还原。

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

// 只借 CFG 的常量（wslDistro / exportDir）。env.mjs 顶层没有任何副作用 —— 不会触发探测。
import { CFG } from '../lib/env.mjs';

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

// ── 测试产物登记（跑完统一清理；绝不碰真实锁 / 真实任务）─────
//
// ★ 为什么要有它：取消用例与「日志裁剪」用例必须在本进程里 import lib/jobs.mjs 起一个
//   独立队列 —— 那会往 D:\lemo-films\.console 写一条**真实格式**的任务记录。既然写了，
//   就必须登记下来、跑完摘干净，否则就成了「测试留垃圾」。
// ★ 锁文件用 `__test-lock__` 这种不可能与真实风格同名的 slug（风格目录是 lib/styles/<slug>），
//   且**只删自己登记过的那个路径** —— 绝不按通配符删锁（并发写 mux 会产出损坏成片）。
const FILM_DIR = CFG.exportDir;                 // D:\lemo-films（与编排器/服务端同一处常量）
const CONSOLE_ROOT = path.join(FILM_DIR, '.console');
const CONSOLE_LOGS = path.join(CONSOLE_ROOT, 'logs');
const CONSOLE_INDEX = path.join(CONSOLE_ROOT, 'index.json');

export const ARTIFACTS = {
  jobIds: new Set(),      // 测试任务 id（要删 logs/<id>.jsonl 并从 index.json 摘掉）
  lockFiles: new Set(),   // 测试造的锁文件绝对路径
  wslFiles: new Set(),    // WSL 侧的测试临时文件绝对路径
};

/**
 * 跑一段 WSL bash 脚本（本环境 spawnSync 一律 EBUSY，只能异步 spawn）。
 *
 * ★ 一律「写脚本文件 + sed 去 CR」再执行，**不走内联 bash** —— wsl.exe 会把命令行
 *   重新拼一遍再交给 Linux 侧解析，内联里的 `$变量` / 引号会被吃掉（lib/env.mjs 的
 *   注释里写着「内联会吃掉变量」，实测踩到：`$st` 变成空串，断言直接失去意义）。
 * ★ 默认超时给到 60s：这台机器上 WSL 发行版会因空闲被回收，下一次 wsl.exe 调用
 *   可能是**冷启动**（实测见过一次 sleep 3 的步骤 60s 才起来）。超时太短会把
 *   冷启动误判成「命令失败」。
 */
let wslSeq = 0;
export function wsl(script, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve) => {
    const uniq = `cg-wsl-${process.pid}-${Date.now().toString(36)}-${(wslSeq += 1).toString(36)}`;
    const host = path.join(CFG.tmpDir, `${uniq}.sh`);
    const inner = `/mnt/${host[0].toLowerCase()}${host.slice(2).replace(/\\/g, '/')}`;
    let child;
    try {
      fs.mkdirSync(CFG.tmpDir, { recursive: true });
      // 行尾归一成 LF —— CR 会让 bash 报 `$'\r': command not found`
      fs.writeFileSync(host, String(script).replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
    } catch (e) {
      return resolve({ ok: false, code: -1, out: '', err: `写 WSL 临时脚本失败：${e.message}` });
    }
    const cmd =
      `trap 'rm -f /tmp/${uniq}.sh "${inner}" 2>/dev/null' EXIT; `
      + `sed 's/\\r$//' '${inner}' > /tmp/${uniq}.sh && chmod 644 /tmp/${uniq}.sh && bash /tmp/${uniq}.sh`;
    try {
      child = spawn('wsl.exe', ['-d', CFG.wslDistro, '-u', 'root', '--', 'bash', '-c', cmd],
        { windowsHide: true, env: { ...process.env, WSL_UTF8: '1' } });
    } catch (e) {
      try { fs.unlinkSync(host); } catch { /* ignore */ }
      return resolve({ ok: false, code: -1, out: '', err: String(e.message || e) });
    }
    let out = '';
    let err = '';
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { fs.unlinkSync(host); } catch { /* 已经没了 */ }
      resolve(r);
    };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ ok: false, code: null, out, err, timeout: true }); }, timeoutMs);
    child.stdout?.on('data', (d) => { out += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { err += d.toString('utf8'); });
    child.on('error', (e) => finish({ ok: false, code: -1, out, err, error: String(e.message || e) }));
    child.on('close', (code) => finish({ ok: code === 0, code, out, err }));
  });
}

/** 找一个「确定已死」的 pid（spawn 一个空 node 进程 → 等它退出 → 复验）。 */
export async function freshDeadPid() {
  for (let i = 0; i < 5; i++) {
    const c = spawn(process.execPath, ['-e', 'process.exit(0)'], { windowsHide: true, stdio: 'ignore' });
    const pid = c.pid;
    await new Promise((r) => { c.on('close', r); c.on('error', r); });
    try { process.kill(pid, 0); } catch { return pid; }   // 抛错 = 确实不在了
  }
  return null;
}

/**
 * 清理测试产物。**只动登记过的东西**。
 * @returns {{jobs:string[], locks:string[], wsl:string[], errors:string[]}}
 */
export async function cleanupArtifacts() {
  const rep = { jobs: [], locks: [], wsl: [], errors: [] };

  for (const f of ARTIFACTS.lockFiles) {
    try { fs.unlinkSync(f); rep.locks.push(path.basename(f)); }
    catch (e) { if (e.code !== 'ENOENT') rep.errors.push(`删锁 ${f}：${e.message}`); }
  }
  ARTIFACTS.lockFiles.clear();

  if (ARTIFACTS.wslFiles.size) {
    const r = await wsl(`rm -f ${[...ARTIFACTS.wslFiles].join(' ')}`);
    if (!r.ok) rep.errors.push(`清 WSL 临时文件失败：${r.err || r.code}`);
    else rep.wsl.push(...[...ARTIFACTS.wslFiles]);
  }
  ARTIFACTS.wslFiles.clear();

  if (ARTIFACTS.jobIds.size) {
    for (const id of ARTIFACTS.jobIds) {
      try { fs.unlinkSync(path.join(CONSOLE_LOGS, `${id}.jsonl`)); } catch { /* 没有就算了 */ }
    }
    try {
      const obj = JSON.parse(fs.readFileSync(CONSOLE_INDEX, 'utf8'));
      const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.jobs) ? obj.jobs : null);
      if (arr) {
        const kept = arr.filter((m) => m && !ARTIFACTS.jobIds.has(m.id));
        if (kept.length !== arr.length) {
          const out = Array.isArray(obj) ? kept : { ...obj, jobs: kept };
          const tmp = `${CONSOLE_INDEX}.cg-tmp`;
          fs.writeFileSync(tmp, JSON.stringify(out), 'utf8');
          fs.renameSync(tmp, CONSOLE_INDEX);   // 原子替换（与 lib/store.mjs 同一套做法）
        }
        rep.jobs.push(...ARTIFACTS.jobIds);
      }
    } catch (e) {
      rep.errors.push(`从 ${CONSOLE_INDEX} 摘除测试任务失败：${e.message}`);
    }
    ARTIFACTS.jobIds.clear();
  }
  return rep;
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
  {
    // ★ 这条补的是 test/README.md「没覆盖什么」里的最后一条：Windows 保留端口的 EACCES 后扫。
    //   真造一个保留段要改系统配置（netsh 圈端口），测试没法复现 —— 所以把「绑定一次」作为
    //   参数注入，用假 binder 精确覆盖四条分支。server.mjs 的 start() 就是调这个函数，
    //   而「服务真的能起来」由本套件其余所有起服务用例覆盖（它们都走 start() → scanPort）。
    name: '③ 端口后扫决策：只有 EACCES 才继续往后扫（EADDRINUSE / 其它错误直接放弃）',
    run: async (ctx) => {
      const { scanPort, MAX_SCAN, MAX_PORT } = await import('../lib/portscan.mjs');
      // 常量必须与 server.mjs 的实际行为一致（server.mjs 从这里 import，单一来源）
      assert.strictEqual(MAX_SCAN, 40, `MAX_SCAN=${MAX_SCAN}，与 server.mjs 既有行为（40）不一致`);
      assert.strictEqual(MAX_PORT, 65535, `MAX_PORT=${MAX_PORT}`);

      const fakeBinder = (map) => {
        const calls = [];
        return { calls, fn: async (port) => { calls.push(port); return map(port); } };
      };

      // ① 一绑就上：不该多试任何一个端口
      {
        const b = fakeBinder(() => ({ ok: true }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: true, port: 7788, want: 7788, moved: false });
        assert.deepStrictEqual(b.calls, [7788], `不该多试端口，实际试了 ${b.calls.join(',')}`);
      }

      // ② ★核心：EACCES（端口落在保留段）→ 按顺序向后扫到第一个可绑的端口
      {
        const reserved = new Set([7788, 7789, 7790]);
        const b = fakeBinder((p) => (reserved.has(p) ? { ok: false, code: 'EACCES' } : { ok: true }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: true, port: 7791, want: 7788, moved: true });
        assert.deepStrictEqual(b.calls, [7788, 7789, 7790, 7791], '没有按顺序逐个向后扫');
      }

      // ③ EADDRINUSE → **不换端口**（换端口会静默起第二个实例），直接报 inuse
      {
        const b = fakeBinder((p) => (p === 7788 ? { ok: false, code: 'EADDRINUSE' } : { ok: true }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: false, reason: 'inuse', want: 7788, port: 7788 });
        assert.deepStrictEqual(b.calls, [7788], 'EADDRINUSE 不该继续向后扫');
      }

      // ④ 其它绑定错误（如 EADDRNOTAVAIL）→ 同样不换端口
      {
        const b = fakeBinder(() => ({ ok: false, code: 'EADDRNOTAVAIL' }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: false, reason: 'error', want: 7788, port: 7788, code: 'EADDRNOTAVAIL' });
        assert.deepStrictEqual(b.calls, [7788], '非 EACCES 错误不该继续向后扫');
      }

      // ⑤ 整段都是保留段 → 扫满 MAX_SCAN 个后放弃（含 want 本身共 MAX_SCAN+1 次尝试）
      {
        const b = fakeBinder(() => ({ ok: false, code: 'EACCES' }));
        const r = await scanPort(7788, b.fn);
        assert.deepStrictEqual(r, { ok: false, reason: 'exhausted', want: 7788 });
        assert.strictEqual(b.calls.length, MAX_SCAN + 1,
          `应尝试 ${MAX_SCAN + 1} 个端口（含 want 本身），实际 ${b.calls.length}`);
        assert.strictEqual(b.calls[0], 7788);
        assert.strictEqual(b.calls[b.calls.length - 1], 7788 + MAX_SCAN);
      }

      // ⑥ 逼近端口上限 → 越过 65535 立即放弃（与 server.mjs 原来的 `if (port > 65535) break` 等价）
      {
        const b = fakeBinder(() => ({ ok: false, code: 'EACCES' }));
        const r = await scanPort(65534, b.fn);
        assert.deepStrictEqual(r, { ok: false, reason: 'exhausted', want: 65534 });
        assert.deepStrictEqual(b.calls, [65534, 65535], '越过 65535 之后不该再试');
      }

      ctx.note('③ 端口后扫：一绑就上 / EACCES 后扫 / EADDRINUSE 不换 / 其它错误不换 / 扫满放弃 / 越过 65535 放弃'
        + ' —— 六条分支全过（用假 binder，不碰系统保留段）');
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

      // 给后面的 ⑥⑦ 用（取消 / 断线续传 / 跨重启）
      ctx.state.dryRunJobId = job.id;
    },
  },

  // ── ⑥ 任务取消（HTTP 层）──────────────────────────────────
  {
    name: '⑥ DELETE /api/jobs/:id → 任务变 canceled 且进程真的死了',
    run: async (ctx) => {
      // ★ 为什么用 dry-run：它是**无害的长任务**（约 4.5s，只打印步骤、不渲染、不混流）。
      //   真渲染绝不能在测试里取消 —— 取消真渲染会打断 mux，且会动用户的成片目录。
      //
      // ★ 编排器的并发锁 D:\lemo-films\.ascii-crt.lock：dry-run **也会**建它
      //   （编排器在 dry-run 分支之前就抢锁），而它的 releaseLock 挂在 process 的 'exit'
      //   钩子上 —— 被 taskkill /F 硬杀时**不会执行**，于是取消会留下一个「pid 已死」的陈旧锁。
      //   编排器下次会按「pid 已死」自动接管，功能上无害；但它是**这条用例自己造的**残留，
      //   所以要收干净。判据很严：只删「锁里第一行的 pid == 刚被取消的那个 pid」的那一个文件。
      const orchLock = path.join(FILM_DIR, '.ascii-crt.lock');
      let canceledPid = null;

      try {
        const r = await ctx.post('/api/run', { slug: 'ascii-crt', opts: ['--skip-sync', '--dry-run'] });
        assert.strictEqual(r.status, 200, `POST /api/run 状态码 ${r.status}：${r.text.slice(0, 300)}`);
        const id = r.json.job.id;
        ctx.note(`⑥ 待取消任务：${id}`);

        // 1) 等到 running 并拿到 pid（enqueue 内部同步 startJob，POST 返回时通常已经是 running）
        let s = null;
        const t0 = Date.now();
        while (Date.now() - t0 < 15000) {
          const j = await ctx.get('/api/jobs');
          s = (j.json.jobs || []).find((x) => x.id === id) || null;
          if (s && s.status === 'running' && s.pid) break;
          if (s && ['done', 'failed', 'canceled'].includes(s.status)) break;
          await ctx.sleep(80);
        }
        assert.ok(s, `/api/jobs 里找不到 ${id}`);
        assert.strictEqual(s.status, 'running', `取消前状态是 ${s.status}（期望 running）—— dry-run 是不是太快跑完了？`);
        const pid = s.pid;
        assert.ok(Number.isInteger(pid) && pid > 0, `任务摘要里没有可用 pid：${JSON.stringify(s)}`);
        canceledPid = pid;

        // 2) 取消
        const d = await ctx.del(`/api/jobs/${id}`);
        assert.strictEqual(d.status, 200, `DELETE 状态码 ${d.status}：${d.text.slice(0, 200)}`);
        assert.strictEqual(d.json.ok, true, `DELETE 返回 ${d.text.slice(0, 200)}`);

        // 3) 状态变 canceled
        let s2 = null;
        const t1 = Date.now();
        while (Date.now() - t1 < 20000) {
          const j = await ctx.get('/api/jobs');
          s2 = (j.json.jobs || []).find((x) => x.id === id) || null;
          if (s2 && s2.status === 'canceled') break;
          await ctx.sleep(150);
        }
        assert.ok(s2, `/api/jobs 里找不到 ${id}`);
        assert.strictEqual(s2.status, 'canceled', `取消后状态 ${s2.status}（期望 canceled）`);

        // 4) ★ 进程真的死了（只置状态不杀进程 = 假取消，会留下占 GPU 的孤儿）
        let alive = true;
        const t2 = Date.now();
        while (Date.now() - t2 < 10000) {
          try { process.kill(pid, 0); } catch { alive = false; break; }
          await ctx.sleep(200);
        }
        assert.strictEqual(alive, false,
          `取消后 pid ${pid} 仍活着 —— 进程树没被收掉（taskkill /T 没生效？）`);

        // 5) 已结束的任务不能再取消
        const again = await ctx.del(`/api/jobs/${id}`);
        assert.strictEqual(again.status, 400, `重复取消应 400，实际 ${again.status}：${again.text.slice(0, 200)}`);

        ctx.note(`⑥ 取消 ${id}：running(pid ${pid}) → canceled，pid 已消失；重复取消 400`);
      } finally {
        // 收掉「这条用例自己造出来的」陈旧锁 —— 只认 pid 完全对得上的那一个
        try {
          await ctx.sleep(1000);   // 万一是被杀的那一瞬间刚写下去的
          if (canceledPid !== null && fs.existsSync(orchLock)) {
            const lockPid = Number(String(fs.readFileSync(orchLock, 'utf8')).split('\n')[0]);
            if (lockPid === canceledPid) {
              fs.unlinkSync(orchLock);
              ctx.note(`⑥ 清掉了取消渲染任务留下的陈旧锁 .ascii-crt.lock（pid ${lockPid} 已死）`);
            }
          }
        } catch { /* 清不掉也不影响结论 */ }
      }
    },
  },

  // ── ⑦ SSE 断线续传语义 ────────────────────────────────────
  {
    name: '⑦ SSE ?lastEventId=N → 只补发 n>N 的行（增量续传）',
    run: async (ctx) => {
      const id = ctx.state.dryRunJobId;
      assert.ok(id, '依赖 ④ 的任务 id，但 ④ 没跑成');

      // 全量（不带 lastEventId）
      const full = await ctx.sse(`/api/logs/${id}`, { timeoutMs: 20000, stopOn: (e) => e.type === 'end' });
      const fullLines = full.events.filter((e) => e.type === 'line');
      assert.ok(fullLines.length >= 3, `全量回放只有 ${fullLines.length} 行，样本太小，这条用例说明不了问题`);
      const ns = fullLines.map((e) => e.n);
      for (let i = 1; i < ns.length; i++) {
        assert.ok(ns[i] > ns[i - 1], `序号不是单调递增：${ns.slice(0, 12).join(',')}`);
      }

      const N = ns[Math.floor(ns.length / 2)];
      const want = ns.filter((n) => n > N);
      assert.ok(want.length > 0 && want.length < ns.length, `切点 N=${N} 没把行分成两半（共 ${ns.length} 行）`);

      const inc = await ctx.sse(`/api/logs/${id}?lastEventId=${N}`, { timeoutMs: 20000, stopOn: (e) => e.type === 'end' });
      const incLines = inc.events.filter((e) => e.type === 'line');
      assert.deepStrictEqual(incLines.map((e) => e.n), want,
        `增量补发的序号不对：期望 ${want.length} 行（n>${N}），实际 ${incLines.length} 行（${incLines.map((e) => e.n).join(',')}）`);
      assert.ok(!inc.events.some((e) => e.type === 'gap'), '这次没有发生裁剪，不该出现 gap 事件');

      // hello 帧要说明「这是续传」
      const hello = inc.events[0];
      assert.ok(hello && typeof hello === 'object', 'SSE 没有 hello 帧');
      assert.strictEqual(hello.resumed, true, `hello.resumed=${hello.resumed}（期望 true）`);
      assert.strictEqual(hello.resumeFrom, N, `hello.resumeFrom=${hello.resumeFrom}（期望 ${N}）`);

      // 供跨重启用例比对
      ctx.state.sseFull = { ns, lines: fullLines.map((e) => e.line), count: fullLines.length };
      ctx.note(`⑦ 全量 ${ns.length} 行 → lastEventId=${N} 只补发 ${incLines.length} 行（省掉 ${ns.length - incLines.length} 行）`);
    },
  },
  {
    name: '⑦ SSE Last-Event-ID 请求头同样能续传，且优先于 ?lastEventId',
    run: async (ctx) => {
      const id = ctx.state.dryRunJobId;
      const before = ctx.state.sseFull;
      assert.ok(id && before, '依赖 ④⑦ 的前置结果');

      const N = before.ns[Math.floor(before.ns.length / 2)];
      const want = before.ns.filter((n) => n > N);

      // 浏览器自动重连走的是请求头
      const inc = await ctx.sse(`/api/logs/${id}`, {
        timeoutMs: 20000, headers: { 'Last-Event-ID': String(N) }, stopOn: (e) => e.type === 'end',
      });
      assert.deepStrictEqual(inc.events.filter((e) => e.type === 'line').map((e) => e.n), want,
        '带 Last-Event-ID 请求头时补发的行不对');

      // 头与 query 同时给：头优先（server.mjs: rawHeader ?? rawQuery）
      const both = await ctx.sse(`/api/logs/${id}?lastEventId=0`, {
        timeoutMs: 20000, headers: { 'Last-Event-ID': String(N) }, stopOn: (e) => e.type === 'end',
      });
      assert.strictEqual(both.events[0]?.resumeFrom, N,
        `头与 query 冲突时应以头为准（resumeFrom=${both.events[0]?.resumeFrom}，期望 ${N}）`);
      assert.deepStrictEqual(both.events.filter((e) => e.type === 'line').map((e) => e.n), want,
        '头优先时补发的行不对');
      ctx.note('⑦ Last-Event-ID 请求头可续传，且优先于 ?lastEventId');
    },
  },
  {
    name: '⑦ 跨重启 logSeq 稳定（重启后同一任务的序号与行内容逐字不变）',
    run: async (ctx) => {
      const id = ctx.state.dryRunJobId;
      const before = ctx.state.sseFull;
      assert.ok(id && before, '依赖 ④⑦ 的前置结果');

      const port = await ctx.restartServer();
      ctx.note(`⑦ 测试服务已重启（新端口 ${port}）`);

      const list = await ctx.get('/api/jobs');
      const j = (list.json.jobs || []).find((x) => x.id === id);
      assert.ok(j, `重启后 /api/jobs 里找不到 ${id} —— 历史没从磁盘恢复`);
      assert.strictEqual(j.status, 'done', `重启后任务状态 ${j.status}（期望 done）`);
      assert.strictEqual(j.restored, true, '重启后历史任务的 restored 应为 true');

      const after = await ctx.sse(`/api/logs/${id}`, { timeoutMs: 20000, stopOn: (e) => e.type === 'end' });
      const afterLines = after.events.filter((e) => e.type === 'line');
      assert.deepStrictEqual(afterLines.map((e) => e.n), before.ns,
        `重启后序号变了（前 5 个：${afterLines.slice(0, 5).map((e) => e.n).join(',')} vs ${before.ns.slice(0, 5).join(',')}）—— logSeq 没从磁盘恢复`);
      assert.deepStrictEqual(afterLines.map((e) => e.line), before.lines,
        '重启后日志正文变了（落盘/回读丢了内容？）');
      ctx.note(`⑦ 重启后 ${afterLines.length} 行日志的序号与内容与重启前完全一致`);
    },
  },

  // ── ⑧ 并发锁的真冲突态（只造测试锁，绝不碰真实锁）────────
  {
    name: '⑧ 并发锁：活 pid → locked=true / alive=true（真冲突态）',
    run: async (ctx) => {
      const slug = '__test-lock__';                       // 不可能与真实风格同名
      const lockPath = path.join(FILM_DIR, `.${slug}.lock`);
      assert.ok(!fs.existsSync(lockPath), `测试锁路径已存在（${lockPath}）—— 先手动确认这不是真实任务在用的锁`);

      // 造一个真的活着的 pid（无害空转进程），别拿测试自己的 pid 冒充
      const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], { windowsHide: true, stdio: 'ignore' });
      ARTIFACTS.lockFiles.add(lockPath);
      try {
        // 格式与编排器 lemo-make.mjs 逐字一致：第一行 pid、第二行 ISO 时间
        fs.writeFileSync(lockPath, `${child.pid}\n${new Date().toISOString()}\n`, 'utf8');

        const r = await ctx.get(`/api/precheck?slug=${slug}`);
        assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
        const d = r.json;
        assert.strictEqual(d.alive, true, `活 pid ${child.pid} 被判成不活着：${JSON.stringify(d)}`);
        assert.strictEqual(d.locked, true, `活 pid 的锁没被判成冲突：${JSON.stringify(d)}`);
        assert.strictEqual(d.stale, false, `活 pid 的锁被判成陈旧（会误报成「正常」）：${JSON.stringify(d)}`);
        assert.strictEqual(d.pid, child.pid, `回显的 pid 不对：${d.pid}（期望 ${child.pid}）`);
        assert.ok(d.lockAgeSec >= 0 && d.lockAgeSec < 120, `锁龄不合理：${d.lockAgeSec}s`);
        assert.match(String(d.message || ''), /并发|损坏/, `locked=true 时 message 应给出人话解释，实际：${JSON.stringify(d.message)}`);
        // ★ 这条 message 会被前端**原样 textContent**（app.js 的 lockWarn 与批量确认弹层），
        //   所以它里面不能有 markdown 的 `**` —— 那会原样显示成两个星号。
        assert.doesNotMatch(String(d.message || ''), /\*\*/, `message 里有 \`**\` 字面量（前端 textContent 会原样显示）：${JSON.stringify(d.message)}`);
        ctx.note(`⑧ 活 pid ${child.pid} 的锁 → locked=true / stale=false（不误判）；message 无 \`**\` 字面量`);
      } finally {
        try { child.kill(); } catch { /* ignore */ }
        try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
        ARTIFACTS.lockFiles.delete(lockPath);
      }
    },
  },
  {
    name: '⑧ 并发锁：死 pid → locked=false / stale=true（不误报冲突）',
    run: async (ctx) => {
      const slug = '__test-lock__';
      const lockPath = path.join(FILM_DIR, `.${slug}.lock`);
      assert.ok(!fs.existsSync(lockPath), `测试锁路径已存在（${lockPath}）`);

      const deadPid = await freshDeadPid();
      assert.ok(deadPid, '造不出一个确定已死的 pid');

      ARTIFACTS.lockFiles.add(lockPath);
      try {
        fs.writeFileSync(lockPath, `${deadPid}\n${new Date().toISOString()}\n`, 'utf8');
        const r = await ctx.get(`/api/precheck?slug=${slug}`);
        assert.strictEqual(r.status, 200, `状态码 ${r.status}`);
        const d = r.json;
        assert.strictEqual(d.alive, false, `死 pid ${deadPid} 被判成活着：${JSON.stringify(d)}`);
        assert.strictEqual(d.locked, false, `死 pid 的锁被判成冲突 —— 这会让用户在「编排器本来会接管」的情况下被吓一跳：${JSON.stringify(d)}`);
        assert.strictEqual(d.stale, true, `死 pid 的锁应标成 stale：${JSON.stringify(d)}`);
        assert.ok(!(d.locked && d.stale), 'locked 与 stale 同时为 true —— 判据自相矛盾');
        ctx.note(`⑧ 死 pid ${deadPid} 的锁 → locked=false / stale=true（不误报）`);
      } finally {
        try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
        ARTIFACTS.lockFiles.delete(lockPath);
      }
    },
  },

  // ── ⑨ 成片文件的 Range 请求（拖进度条靠它）───────────────
  {
    name: '⑨ GET /api/films/:slug/:file → Range 206 / 越界 416 / 无 Range 200',
    run: async (ctx) => {
      const list = await ctx.get('/api/films');
      assert.strictEqual(list.status, 200, `状态码 ${list.status}`);
      const film = (list.json.films || []).find((f) => f.slug === 'ascii-crt' && f.file === 'ascii-crt.mp4');
      assert.ok(film, `D:\\lemo-films\\ascii-crt\\ascii-crt.mp4 不在 /api/films 列表里 —— 成片缺失时这条用例没法验`);
      const size = film.size;
      assert.ok(size > 200000, `成片只有 ${size} 字节，太小，验不出 Range`);

      const p = '/api/films/ascii-crt/ascii-crt.mp4';

      // 1) 不带 Range → 200 + Accept-Ranges（只收 64KB 就断开：成片 29MB，整份读既慢又没必要）
      const full = await ctx.get(p, { accept: '*/*', maxBytes: 65536 });
      assert.strictEqual(full.status, 200, `无 Range 时状态码 ${full.status}`);
      assert.strictEqual(full.headers['accept-ranges'], 'bytes', `Accept-Ranges=${full.headers['accept-ranges']}`);
      assert.strictEqual(Number(full.headers['content-length']), size, '无 Range 时应回完整长度');
      assert.match(String(full.headers['content-type'] || ''), /video\/mp4/, `Content-Type=${full.headers['content-type']}`);
      assert.ok(full.truncated && full.bytes >= 65536, '测试自己没断开连接（maxBytes 没生效）');

      // 2) bytes=0-1023 → 206 + 正确 Content-Range + 长度 1024
      const r1 = await ctx.get(p, { accept: '*/*', headers: { Range: 'bytes=0-1023' } });
      assert.strictEqual(r1.status, 206, `Range 请求状态码 ${r1.status}（期望 206）`);
      assert.strictEqual(r1.headers['content-range'], `bytes 0-1023/${size}`, `Content-Range=${r1.headers['content-range']}`);
      assert.strictEqual(Number(r1.headers['content-length']), 1024, `Content-Length=${r1.headers['content-length']}`);
      assert.strictEqual(r1.bytes, 1024, `实际收到 ${r1.bytes} 字节（期望 1024）`);
      assert.strictEqual(r1.headers['accept-ranges'], 'bytes');
      assert.ok(r1.buf.subarray(0, 16).equals(full.buf.subarray(0, 16)),
        '206 返回的字节与整份开头不一致 —— 不是同一个文件的同一段');

      // 3) 后缀 Range bytes=-1024 → 206，取的是**末尾** 1024 字节
      const r2 = await ctx.get(p, { accept: '*/*', headers: { Range: 'bytes=-1024' } });
      assert.strictEqual(r2.status, 206, `后缀 Range 状态码 ${r2.status}（期望 206）`);
      assert.strictEqual(r2.headers['content-range'], `bytes ${size - 1024}-${size - 1}/${size}`,
        `后缀 Range 的 Content-Range=${r2.headers['content-range']}`);
      assert.strictEqual(r2.bytes, 1024, `后缀 Range 收到 ${r2.bytes} 字节（期望 1024）`);

      // 4) 起点越界 → 416
      const r3 = await ctx.get(p, { accept: '*/*', headers: { Range: `bytes=${size}-${size + 100}` } });
      assert.strictEqual(r3.status, 416, `越界 Range 状态码 ${r3.status}（期望 416）`);
      assert.strictEqual(r3.headers['content-range'], `bytes */${size}`, `416 的 Content-Range=${r3.headers['content-range']}`);

      // 5) 非法 Range → 如实断言实现行为（server.mjs 的正则不匹配就 416）
      const r4 = await ctx.get(p, { accept: '*/*', headers: { Range: 'bytes=abc' } });
      assert.strictEqual(r4.status, 416, `非法 Range 状态码 ${r4.status}（实现是 416）`);
      assert.strictEqual(r4.headers['content-range'], `bytes */${size}`);

      ctx.note(`⑨ 成片 ${(size / 1048576).toFixed(1)}MB：Range 206/416、后缀 Range、无 Range 200 均符合实现`);
    },
  },
];

// ── 进程用例（本进程内 import lib/jobs.mjs，起一个独立队列）────
//
// ★ 为什么不用 HTTP 层验「安装任务的取消」：
//   `/api/setup/run` 只接受 planActions() 真的规划出来的动作，而这台机器 12/12 ok →
//   一个动作都规划不出来 → 走 HTTP 根本入不了队。所以这里直接调 jobs.enqueueSetup()，
//   走的是**同一条** startSetupJob → runSteps → cancelJob → killJobChild 路径。
// ★ 会往 D:\lemo-films\.console 写任务记录 —— 已登记进 ARTIFACTS，跑完统一摘掉。
export const PROCESS_CASES = [
  {
    name: '⑥ 取消安装任务（kind=setup）→ canceled 且 WSL 侧进程组真的被收掉',
    run: async (ctx) => {
      const jobs = await import('../lib/jobs.mjs');

      const token = `cg-cancel-${process.pid}-${Date.now().toString(36)}`;
      const pidFile = `/tmp/${token}.pid`;
      const aliveMark = `/tmp/${token}.alive`;
      ARTIFACTS.wslFiles.add(pidFile);
      ARTIFACTS.wslFiles.add(aliveMark);

      // 无害长任务：写两个标记文件 → sleep 120 →（自然结束时）删掉 alive 标记
      // ★ sleep 给足 120s：这样「取消后 45s 内进程必须消失」的判定，永远发生在它自然结束之前。
      //   （本机 WSL 发行版会因空闲被回收，wsl.exe 可能是冷启动、单次要几十秒，窗口得留够。）
      const script = [
        `echo "$$" > ${pidFile}`,
        `touch ${aliveMark}`,
        'sleep 120',
        `rm -f ${aliveMark}`,
      ].join('\n');

      let jobId = null;
      try {
        const job = jobs.enqueueSetup({
          actionId: 'cg.cancel-probe',
          title: '取消测试（无害 sleep 30）',
          steps: [{ kind: 'wsl', label: '无害长任务（sleep 30）', script, timeoutMs: 180000 }],
        });
        jobId = job.id;
        ARTIFACTS.jobIds.add(jobId);
        ctx.note(`⑥ 安装任务已入队：${jobId}`);

        // 1) 等 WSL 侧真的跑起来（标记文件出现 = 脚本已经在 sleep 里）
        let up = false;
        let probe = null;
        const t0 = Date.now();
        while (Date.now() - t0 < 120000) {
          probe = await wsl(`test -e ${aliveMark} && echo YES || echo NO`);
          if (String(probe.out).includes('YES')) { up = true; break; }
          await ctx.sleep(500);
        }
        assert.ok(up, `120s 内 WSL 侧没起来（${aliveMark} 未出现）。wsl out=${JSON.stringify(probe?.out)} err=${JSON.stringify(probe?.err)}`);

        const st = jobs.getSummary(jobId);
        assert.strictEqual(st.status, 'running', `取消前任务状态 ${st.status}（期望 running）`);

        const pidRes = await wsl(`cat ${pidFile}`);
        const wslPid = Number(String(pidRes.out).trim());
        assert.ok(Number.isInteger(wslPid) && wslPid > 0, `读不到 WSL 侧 pid：${JSON.stringify(pidRes.out)}`);

        // 2) 取消（走的就是 DELETE /api/jobs/:id 背后那一个 cancelJob）
        const c = jobs.cancelJob(jobId);
        assert.strictEqual(c.ok, true, `cancelJob 返回 ${JSON.stringify(c)}`);

        let s2 = null;
        const t1 = Date.now();
        while (Date.now() - t1 < 20000) {
          s2 = jobs.getSummary(jobId);
          if (s2.status === 'canceled') break;
          await ctx.sleep(200);
        }
        assert.strictEqual(s2.status, 'canceled', `取消后状态 ${s2.status}（期望 canceled）`);

        // 3) ★★ 核心断言：WSL2 里的进程**不是** wsl.exe 的 Windows 子进程，
        //    taskkill /T 管不到它。少了 _lemoKillExtra 这一钩子，sleep 30 会继续跑到自然结束。
        //
        //    ★ 判「死」必须看 **进程状态**，不能只看 `kill -0`：
        //      实测被整组杀掉之后，脚本常会以 **僵尸（Zs <defunct>）** 形态留在进程表里
        //      （父进程已被 taskkill 带走 → 被 pid 1 收养 → WSL 的 init 不 reap）。
        //      僵尸已经死了、不占任何资源，但 `kill -0` 对它**返回成功** —— 只看 kill -0 会假阳性。
        //
        //    ★ 一次探测把三件事一起问完（进程状态 / 组内存活成员 / alive 标记），
        //      免得冷启动时一条 wsl.exe 卡住就把后面几条全拖超时。
        const probeOnce = () =>
          `st=$(ps -o stat= -p ${wslPid} 2>/dev/null | tr -d ' '); `
          + `g=$(ps -eo pid,pgid,stat | awk -v x=${wslPid} '$2==x && $3 !~ /^Z/' | wc -l); `
          + `if [ -e ${aliveMark} ]; then m=PRESENT; else m=GONE; fi; `
          + 'if [ -z "$st" ]; then s=DEAD; else case "$st" in Z*) s=ZOMBIE ;; *) s=ALIVE ;; esac; fi; '
          + 'echo "STATE=$s GROUP=$g MARKER=$m"';

        const parse = (out) => {
          const m = /STATE=(\w+)\s+GROUP=(\d+)\s+MARKER=(\w+)/.exec(String(out));
          return m ? { state: m[1], group: Number(m[2]), marker: m[3] } : null;
        };

        let snap = null;
        let lastProbe = '';
        let lastRaw = '';
        const t2 = Date.now();
        while (Date.now() - t2 < 45000) {
          const r = await wsl(probeOnce(), { timeoutMs: 25000 });
          lastRaw = `out=${JSON.stringify(String(r.out).trim())} err=${JSON.stringify(String(r.err).trim())} timeout=${!!r.timeout}`;
          const p = parse(r.out);
          if (p) {
            snap = p;
            lastProbe = `STATE=${p.state} GROUP=${p.group} MARKER=${p.marker}`;
            if (p.state !== 'ALIVE' && p.group === 0 && p.marker === 'PRESENT') break;
          }
          await ctx.sleep(500);
        }
        assert.ok(snap, `45s 内拿不到 WSL 侧状态快照（最后一次：${lastRaw}）—— 连状态都问不到，不算通过`);
        assert.notStrictEqual(snap.state, 'ALIVE',
          await (async () => {
            // 失败时把现场抓下来（进程树 / 同组进程 / pgid 记录文件）—— 否则只看到一句「还活着」没法定位
            const diag = await wsl(
              `ps -o pid,ppid,pgid,sid,stat,cmd -p ${wslPid} 2>&1;`
              + ' echo "--- 同组进程 ---";'
              + ` ps -eo pid,ppid,pgid,stat,cmd | awk -v g=${wslPid} '$3==g' ;`
              + ' echo "--- /tmp 里的 st-setup 文件 ---";'
              + ' ls -la /tmp/ | grep st-setup || echo "(无)"',
            );
            return `取消后 WSL 侧进程 ${wslPid} 仍在运行（${lastProbe}）`
              + ' —— 这正是「taskkill /T 管不到 WSL2 虚拟机里的进程」那个 bug 的形态\n'
              + `--- 现场 ---\n${diag.out}${diag.err}`;
          })());

        // 4) 进程组里不能还剩**活着的**（非僵尸）成员 —— 脚本 + sleep 都在同一个组里
        assert.strictEqual(snap.group, 0, `进程组 ${wslPid} 里还有 ${snap.group} 个活着的成员`);

        // 5) alive 标记还在 → 说明是被**杀死**的，不是自然跑完（自然跑完会自己删掉它）
        assert.strictEqual(snap.marker, 'PRESENT',
          `标记 ${aliveMark} 不见了 —— 说明那 60 秒是自然跑完的，取消根本没在它活着的时候发生`);

        ctx.note(`⑥ 取消安装任务 ${jobId}：canceled，WSL 侧 pid ${wslPid} 已终止（${lastProbe}），进程组内无存活成员`);
      } finally {
        if (jobId) { try { jobs.cancelJob(jobId); } catch { /* ignore */ } }
        // 兜底：万一断言在「进程还活着」那步就炸了，别把那个 sleep 60 留在 WSL 里
        // （按 pid 记录文件整组 KILL —— 脚本自己就是组长，pid == PGID）
        try {
          await wsl(`p=$(cat ${pidFile} 2>/dev/null || true); `
            + 'if [ -n "$p" ]; then kill -KILL -- "-$p" 2>/dev/null || true; kill -KILL "$p" 2>/dev/null || true; fi; '
            + `rm -f ${pidFile} ${aliveMark}`);
        } catch { /* ignore */ }
      }
    },
  },
  {
    name: '⑦ 日志被裁剪后 ?lastEventId 落在空洞里 → 先发 gap 再补发（实测 20050 行）',
    run: async (ctx) => {
      const jobs = await import('../lib/jobs.mjs');
      const N_LINES = 20050;          // 内存上限是 20000 行（lib/jobs.mjs:MAX_LOG_LINES），超出丢最旧

      let jobId = null;
      try {
        const job = jobs.enqueueSetup({
          actionId: 'cg.gap-probe',
          title: `日志裁剪测试（${N_LINES} 行）`,
          steps: [{
            kind: 'exe',
            label: `打印 ${N_LINES} 行`,
            exe: process.execPath,
            args: ['-e', `for (let i = 0; i < ${N_LINES}; i++) console.log('L' + i)`],
            timeoutMs: 180000,
          }],
        });
        jobId = job.id;
        ARTIFACTS.jobIds.add(jobId);

        const t0 = Date.now();
        let s = null;
        while (Date.now() - t0 < 180000) {
          s = jobs.getSummary(jobId);
          if (['done', 'failed', 'canceled'].includes(s.status)) break;
          await ctx.sleep(300);
        }
        assert.strictEqual(s.status, 'done', `任务状态 ${s.status}（期望 done）`);
        assert.ok(s.lines > 20000, `任务只产出了 ${s.lines} 行，没超过内存上限 20000 —— 裁剪分支根本没被触发`);

        // 全量重放：内存里只剩最后 20000 行 → 首行的 n 必然 > 1（前面被丢掉了）
        const full = [];
        jobs.subscribe(jobId, (e) => full.push(e), { from: 0 });
        const lines = full.filter((e) => e.type === 'line');
        assert.strictEqual(lines.length, 20000, `内存里应只剩 20000 行，实际 ${lines.length}`);
        const firstN = lines[0].n;
        assert.ok(firstN > 2, `首行序号是 ${firstN}，说明没有发生裁剪，这条用例没验到东西`);

        // 续传：请求一个落在空洞里的 lastEventId
        const from = 1;
        const inc = [];
        jobs.subscribe(jobId, (e) => inc.push(e), { from });
        const gap = inc.find((e) => e.type === 'gap');
        assert.ok(gap,
          `从 ${from} 续传时没有发 gap 事件（保留的首行 n=${firstN}，中间缺了 ${firstN - from - 1} 行）`
          + ' —— 客户端会以为中间没丢');
        assert.strictEqual(gap.from, from + 1, `gap.from=${gap.from}`);
        assert.strictEqual(gap.to, firstN - 1, `gap.to=${gap.to}（期望 ${firstN - 1}）`);
        assert.strictEqual(gap.dropped, firstN - from - 1, `gap.dropped=${gap.dropped}`);
        assert.strictEqual(inc.indexOf(gap), 0, 'gap 事件不是第一个 —— 客户端会先看到行、再看到缺口说明');

        const incLines = inc.filter((e) => e.type === 'line');
        assert.deepStrictEqual(incLines.map((e) => e.n), lines.map((e) => e.n), 'gap 之后补发的行不对');

        ctx.note(`⑦ 产出 ${s.lines} 行 → 内存裁剪到 20000（首行 n=${firstN}）；`
          + `从 ${from} 续传先发 gap(${gap.from}→${gap.to}，丢 ${gap.dropped} 行)，再补 ${incLines.length} 行`);
      } finally {
        if (jobId) { try { jobs.cancelJob(jobId); } catch { /* ignore */ } }
      }
    },
  },
  {
    // ★ 这条补的是 test/README.md「没覆盖什么」里的「落盘上限 / 轮转」。
    //   上一条（⑦ 内存裁剪）验的是 lib/jobs.mjs 的**内存**上限（20000 行），这条验的是
    //   lib/store.mjs 的**落盘**轮转（单任务 4MB 截断）—— 两者的触发路径完全不同
    //   （jobs.mjs 的 splice vs store.mjs 的 rotate），别把前者当后者。
    //   真按真实上限写满一次，断言：轮转真的发生 / 标记行真的写进去了 / 序号仍连续（可续传）。
    name: '⑦ 落盘轮转：单任务日志超 4MB 被截断，标记行就位且序号仍连续（可续传）',
    run: async (ctx) => {
      const store = await import('../lib/store.mjs');
      const CAPS = store.CAPS;

      const id = `__fp-rot-${process.pid}-${Date.now().toString(36)}`;
      const file = path.join(CONSOLE_LOGS, `${id}.jsonl`);
      ARTIFACTS.jobIds.add(id);          // 跑完由 cleanupArtifacts 删掉 logs/<id>.jsonl

      try {
        const loaded = store.loadIndex();
        assert.strictEqual(loaded.ready, true, `store 未就绪（${loaded.error || '未知'}）—— 落盘轮转验不了`);
        store.dropLog(id);               // 清掉可能的同名残留

        // 每条记录 ≈ 2KB：写 2400 条 ≈ 4.8MB，足以在 4MB 处触发**恰好一次**轮转
        const big = 'y'.repeat(2048);
        const N = 2400;
        for (let i = 1; i <= N; i++) {
          store.appendLog(id, { n: i, stream: 'stdout', line: `${i}:${big}`, t: Date.now() });
        }

        const size = fs.statSync(file).size;
        // ① 轮转真的发生：文件不再超过单任务上限
        assert.ok(size <= CAPS.perJobLogBytes,
          `轮转后文件仍有 ${size} 字节，超过单任务上限 ${CAPS.perJobLogBytes}`);
        assert.ok(size < N * (big.length + 64),
          `文件大小 ${size} 与写入量相当，说明轮转根本没发生`);

        const recs = store.loadLogs(id);
        assert.ok(recs.length > 0, '轮转后读不回任何日志');

        // ② 标记行真的写进去了：必须是第一条、stream='meta'、且说清丢了多少字节
        const marker = recs[0];
        assert.strictEqual(marker.stream, 'meta', `轮转后第一条不是标记行（stream=${marker.stream}）`);
        assert.match(marker.line, /超过 4MB 上限，已丢弃最旧的 \d+ 字节/, `标记行内容不对：${marker.line}`);
        assert.ok(marker.n > 1, `标记行 n=${marker.n}，说明最旧的日志一条都没丢 —— 这条用例没验到东西`);

        // 标记行的 n 必须 = 第一条保留行的 n - 1（lib/store.mjs:rotate 的约定）
        const kept = recs.slice(1);
        assert.ok(kept.length > 0, '标记行之后一条日志都没有');
        assert.strictEqual(marker.n, kept[0].n - 1,
          `标记行 n=${marker.n}，首条保留行 n=${kept[0].n}（应差 1）`);

        // ③ 序号连续、不跳号 —— 续传靠的就是这个
        for (let i = 1; i < recs.length; i++) {
          assert.strictEqual(recs[i].n, recs[i - 1].n + 1,
            `序号不连续：第 ${i - 1} 条 n=${recs[i - 1].n} → 第 ${i} 条 n=${recs[i].n}`);
        }
        // 保最新：最后一条就是最后写入的那条
        assert.strictEqual(recs[recs.length - 1].n, N, `最后一条 n=${recs[recs.length - 1].n}，期望 ${N}`);

        // ④ 续传语义：lib/jobs.mjs:subscribe 的 gap 判据是「保留的首行 n > from + 1」。
        //    客户端已经收到过标记行（lastEventId = marker.n）之后再续传，必须**不发 gap、不重不漏**。
        const from = marker.n;
        const firstN = recs[0].n;
        assert.ok(!(firstN > from + 1),
          `从标记行之后续传会被判成有缺口（firstN=${firstN} > from+1=${from + 1}）—— 客户端会多报一次 gap`);
        assert.deepStrictEqual(recs.filter((r) => r.n > from).map((r) => r.n), kept.map((r) => r.n),
          '续传补发的行与保留行不一致（重发或漏发）');

        ctx.note(`⑦ 落盘轮转：写 ${N} 条 ≈ ${((N * (big.length + 64)) / 1048576).toFixed(1)}MB → 轮转到 `
          + `${(size / 1048576).toFixed(2)}MB（单任务上限 ${(CAPS.perJobLogBytes / 1048576).toFixed(0)}MB）；`
          + `标记行 n=${marker.n}，首条保留行 n=${kept[0].n}，共 ${recs.length} 条、序号连续到 ${recs[recs.length - 1].n}`);
      } finally {
        try { store.dropLog(id); } catch { /* ignore */ }
        try { fs.unlinkSync(file); } catch { /* ignore */ }
      }
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
