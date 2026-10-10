#!/usr/bin/env node
/**
 * scripts/check-llm-global-effect.mjs —— 「算力配置修改**全局生效**」闸门
 *   （★ **写作时**本仓 `check-*` 闸门之一；★ 序号是快照，别当判据）
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ① 由来（对齐参考标准的 `check-global-effect`）
 * ══════════════════════════════════════════════════════════════════════════════
 *   参考标准要求：「模块配置修改（切换模型 / 修改 API 地址 / 密钥）会**全局生效**，
 *   影响软件**全部**依赖大模型的功能。」
 *   参考方点明它与「业务不得绕过统一入口」闸门**互补、缺一不可**：
 *     只守「有没有绕路」，不守「经正路时是否真的生效」⇒ 正路自己退化成「读一次就缓存住」
 *     也没人管。**两者缺一不可。**
 *
 *   本项目里「全局生效」= 覆盖文件 `<成片根>/_llm-api.json` 一改，**所有**后续
 *   `chat()` / `listModels()` / `invoke()` 调用立刻按新配置走，**无需重启、无需重新 import**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ② 判据（6 项，**全过才 PASS**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   C1 保存即时可见：`saveService()` 之后，**同一进程**里 `listServices()` / `getActiveService()`
 *      立刻读到新服务（不重启、不重新 import）。
 *   C2 切换传播到**已持有的引用**：模块**已 import**（引用已持有）；`setActiveService()` 之后，
 *      下一次**不带 `service` 的** `chat()` 打到**新服务**的桩。
 *   C3 配置传播：改某服务的 `baseUrl` 之后，下一次 `chat()` 打到**新 baseUrl** 的桩。
 *   C4 落盘：切换 / 修改之后，**磁盘文件**（直接读 JSON）确已更新（⇒ 重启仍生效）。
 *   C5 跨进程：**新起的 Node 进程**读同一配置文件 ⇒ 读到**新** active。
 *   C6 失明守卫：桩**真的收到过请求**（防「空转绿灯」—— 若 `chat()` 根本没发出去，
 *      「走的是新服务」就是**假的**）；且**切换前**打到 A 桩、**切换后**打到 B 桩
 *      （**反向证明判别力**：只打到 B 而没打到 A，说明不了「切换生效」，只说明「一直在打 B」）。
 *
 *   ★ 设计纪律：本闸门是**行为闸门**（真起桩、真发请求、真读盘），**不是**静态读码。
 *     凡「配置是否生效」这类**语义**问题，静态判据一律不可信 —— 必须看**实际打到了谁**。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ③ 隔离（**安全底线**，违反即为事故）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · ★★ 本闸门**绝不**碰真实覆盖文件 `<真实成片根>/_llm-api.json`：在 import 模块**之前**
 *     把 `LEMO_FILM_DIR` 指到**仓外临时树**（`D:/lemo-tmp/...`，非 C 盘）；
 *   · ★★ 另设**自证**：算出 `overrideFilePath()` 后断言它**确实**落在临时树里 ——
 *     万一哪天覆盖点改名，本闸门会**当场失明**（exit 2）而不是去写用户的数据；
 *   · · 清掉 `LEMO_LLM_*` 与网关 env（`SERVER__*` / `CODEBUDDY_GATEWAY_PASSWORD`），
 *     免得外部环境把「当前生效服务」解析到别处 ⇒ 假红 / 假绿；
 *   · · 桩服务只监听 `127.0.0.1:0`（随机端口），**绝不**打真实外网。
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ ④ 已知局限（**必须如实知悉**）
 * ══════════════════════════════════════════════════════════════════════════════
 *   · 本闸门验的是「**经 `lib/llm-api.mjs` 这一推荐入口**」的全局生效。
 *     业务若绕过它自己去读覆盖文件，本闸门**不会**发现 —— 那是 `check-llm-facade-only.mjs` 的职责。
 *   · C5 只验「新进程读到新值」，**不验**并发写竞争（那要另设闸门）。
 *   · 桩只回**最小合法**的 OpenAI 兼容响应；本闸门不判「返回体解析是否正确」（那是单测的职责）。
 *
 * 用法：node scripts/check-llm-global-effect.mjs [--json]
 * 退出码：0 = 6 项全过；1 = 有 FAIL；2 = **本闸门已失明**（隔离失效 / 桩没收到请求 / 模块抽不到导出）。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(path.join(HERE, '..'));
const JSON_OUT = process.argv.includes('--json');
const MODULE_ABS = path.join(ROOT, 'lib', 'llm-api.mjs');

// ── ★★ ③ 隔离：**必须在 import 模块之前**把成片根指到临时树 ────────────────────
const TMP = `D:/lemo-tmp/llm-global-effect-${process.pid}-${Date.now().toString(36)}`;
fs.mkdirSync(TMP, { recursive: true });
process.env.LEMO_FILM_DIR = TMP;
for (const k of ['LEMO_LLM_PROFILE', 'LEMO_LLM_BASE', 'LEMO_LLM_KEY', 'LEMO_LLM_MODEL',
  'LEMO_LLM_HEADERS', 'LEMO_LLM_TIMEOUT_MS', 'SERVER__HOST', 'SERVER__PORT',
  'CODEBUDDY_GATEWAY_PASSWORD', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL',
  'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL']) delete process.env[k];

const checks = [];
const rec = (id, ok, detail = '') => checks.push({ id, ok: !!ok, detail: String(detail) });
const blind = [];

// ── 桩服务（node:http，127.0.0.1:0）──────────────────────────────────────────
function startStub(label) {
  return new Promise((resolve) => {
    const seen = [];
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => {
        seen.push({ method: req.method, url: req.url, body });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `pong-from-${label}` } }] }));
      });
    });
    srv.on('clientError', () => { /* ignore */ });
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      resolve({
        label, seen, base: `http://127.0.0.1:${port}`, port,
        close: () => new Promise((r) => { try { srv.closeAllConnections?.(); } catch { /* ignore */ } srv.close(() => r()); }),
      });
    });
  });
}

/** ★ 起一个子 Node 进程，读同一份覆盖文件，报出它看到的 active（跨进程判据 C5）。 */
function childActive(moduleAbs, filmDir) {
  const code = `process.env.LEMO_FILM_DIR=${JSON.stringify(filmDir)};`
    + `const m=await import(${JSON.stringify(pathToFileURL(moduleAbs).href)});`
    + `const s=m.getActiveService();process.stdout.write(String((s&&s.id)||''));`;
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--input-type=module', '-e', code], {
      cwd: ROOT, env: { ...process.env, LEMO_FILM_DIR: filmDir }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => resolve({ id: '', err: String(e && e.message) }));
    p.on('close', (rc) => resolve({ id: out.trim(), rc, err: err.slice(0, 300) }));
  });
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
let stubs = [];
let result = { checks, blind, ok: false, exit: 2 };
try {
  if (!fs.existsSync(MODULE_ABS)) {
    blind.push(`规范通路不存在：${MODULE_ABS}`);
  } else {
    const mod = await import(pathToFileURL(MODULE_ABS).href);
    const need = ['saveService', 'setActiveService', 'listServices', 'getActiveService', 'chat', 'overrideFilePath'];
    const missing = need.filter((n) => typeof mod[n] !== 'function');
    if (missing.length) blind.push(`模块抽不到导出：${missing.join(' / ')} ⇒ 判据失去抓手`);

    if (!missing.length) {
      // ── ③ 隔离自证：覆盖文件**必须**落在临时树里 ──────────────────────────
      const ov = mod.overrideFilePath();
      const ovOk = path.resolve(ov).toLowerCase().startsWith(path.resolve(TMP).toLowerCase());
      rec('C0_ISOLATION', ovOk, `overrideFilePath=${ov}（必须在 ${TMP} 内）`);
      if (!ovOk) blind.push(`隔离失效：覆盖文件 ${ov} **不在**临时树 ${TMP} 内 ⇒ 拒绝继续（绝不碰真实用户数据）`);

      if (ovOk) {
        const A = await startStub('A');
        const B = await startStub('B');
        const B2 = await startStub('B2');
        stubs = [A, B, B2];

        // ── C1 保存即时可见 ────────────────────────────────────────────────
        const rA = mod.saveService({ id: 'svc-a', label: 'A', kind: 'openai-compatible', target: 'model', model: 'm', baseUrl: A.base, apiKey: 'sk-aaaa111122223333', timeoutMs: 3000 });
        const rB = mod.saveService({ id: 'svc-b', label: 'B', kind: 'openai-compatible', target: 'model', model: 'm', baseUrl: B.base, apiKey: 'sk-bbbb111122223333', timeoutMs: 3000 });
        mod.setActiveService('svc-a');
        const listed = mod.listServices();
        const ids = (Array.isArray(listed) ? listed : []).map((s) => s.id);
        rec('C1_SAVE_VISIBLE', rA.ok && rB.ok && ids.includes('svc-a') && ids.includes('svc-b'),
          `save A ok=${rA.ok} / save B ok=${rB.ok} / listServices=[${ids.join(',')}]`);

        // ── C2 切换传播到已持有的引用（同一进程、同一模块引用，不重新 import）──
        const c2a = await mod.chat([{ role: 'user', content: 'hi' }], {});
        const sawA1 = A.seen.length;
        mod.setActiveService('svc-b');
        const c2b = await mod.chat([{ role: 'user', content: 'hi' }], {});
        const sawA2 = A.seen.length, sawB1 = B.seen.length;
        rec('C2_ACTIVE_PROPAGATE',
          c2a.ok && c2b.ok && sawA1 === 1 && sawA2 === 1 && sawB1 === 1 && c2b.meta && c2b.meta.service === 'svc-b',
          `切前 A 桩收 ${sawA1} / 切后 A 桩收 ${sawA2}（应不变）+ B 桩收 ${sawB1}；切后 meta.service=${c2b.meta && c2b.meta.service}`);

        // ── C3 配置传播（改 B 的 baseUrl ⇒ 下一次调用打新地址）────────────────
        mod.saveService({ id: 'svc-b', baseUrl: B2.base });
        const c3 = await mod.chat([{ role: 'user', content: 'hi' }], {});
        rec('C3_BASEURL_PROPAGATE', c3.ok && B2.seen.length === 1 && B.seen.length === 1,
          `改 baseUrl 后 B2 桩收 ${B2.seen.length}（应 1）/ B 桩收 ${B.seen.length}（应仍 1，不再被打）`);

        // ── C4 落盘（直接读磁盘 JSON）─────────────────────────────────────────
        let diskActive = '（读不到）';
        try { diskActive = JSON.parse(fs.readFileSync(mod.overrideFilePath(), 'utf8')).active; } catch { /* 见下 */ }
        rec('C4_PERSIST', diskActive === 'svc-b', `磁盘 active=${JSON.stringify(diskActive)}（应 'svc-b'）`);

        // ── C5 跨进程 ─────────────────────────────────────────────────────────
        const child = await childActive(MODULE_ABS, TMP);
        rec('C5_CROSS_PROCESS', child.id === 'svc-b', `子进程 active=${JSON.stringify(child.id)} rc=${child.rc}${child.err ? ' err=' + child.err : ''}`);

        // ── C6 失明守卫：桩必须真收到过请求（否则「生效」无从谈起）────────────
        const total = A.seen.length + B.seen.length + B2.seen.length;
        if (total === 0) blind.push('三个桩**一次请求都没收到** ⇒ chat() 根本没发出去 ⇒ 「配置生效」是空转绿灯');
        rec('C6_STUBS_REALLY_HIT', total > 0, `A=${A.seen.length} B=${B.seen.length} B2=${B2.seen.length}`);
      }
    }
  }
} catch (e) {
  rec('C_ABORT', false, `${(e && e.name) || 'Error'}: ${(e && e.message) || e}`);
} finally {
  for (const s of stubs) { try { await s.close(); } catch { /* ignore */ } }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
}

const blindMode = blind.length > 0;
const failed = checks.filter((c) => !c.ok);
const ok = !blindMode && checks.length > 0 && failed.length === 0;

// ── 输出 ─────────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({
    gate: 'check-llm-global-effect', root: ROOT, module: MODULE_ABS, tmpFilmRoot: TMP,
    checks, blind, ok, exit: blindMode ? 2 : (ok ? 0 : 1),
  }, null, 2));
  process.exitCode = blindMode ? 2 : (ok ? 0 : 1);
  process.exit();
}

console.log('算力配置全局生效闸门 —— 守「改配置 ⇒ 全部依赖大模型的功能立刻按新配置走」');
console.log('  判据: C1 保存即时可见 | C2 切换传播 | C3 配置传播 | C4 落盘 | C5 跨进程 | C6 失明守卫');
console.log(`  仓根 : ${ROOT}`);
console.log(`  规范 : lib/llm-api.mjs（★ 本闸门只验「经此入口」的生效；绕过入口的由 check-llm-facade-only.mjs 守）`);
console.log(`  隔离 : LEMO_FILM_DIR=${TMP}（仓外临时树，非 C 盘；跑完即删）`);
console.log('');

if (blindMode) {
  console.log('✘✘ 本闸门已失明：');
  for (const b of blind) console.log(`   ✘ ${b}`);
  console.log('   ⇒ 「配置全局生效」这个结论**不可信**。请先修隔离 / 导出 / 桩，再信本闸门的结论。');
  console.log('');
  console.log('[闸门] 算力配置全局生效：**已失明** ⇒ 一条判据都没可信地跑过 ✘');
  process.exitCode = 2;
  process.exit();
}

for (const c of checks) {
  console.log(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.id.padEnd(26)} ${c.detail}`);
}
console.log('');
console.log(`[闸门] 算力配置全局生效：${checks.length - failed.length}/${checks.length} 项通过 ${ok ? 'OK' : '✘'}`);
process.exitCode = ok ? 0 : 1;
