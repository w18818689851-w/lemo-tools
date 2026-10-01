#!/usr/bin/env node
/**
 * test/setup.test.mjs —— 首次运行「自动安装」的纯逻辑测试（零依赖）
 *
 * 用法：node test/setup.test.mjs
 *
 * ★ 为什么单独一个文件、不并进 test/smoke.mjs：
 *   smoke.mjs 的「19 条用例」是这批优化之前就冻结的验收基线，数量本身就是约定。
 *   安装逻辑的用例另起一个入口，两个数字互不干扰（smoke 仍是 19，这里是 12）。
 *
 * ★ 为什么这些用例**必须**存在：
 *   这台机器环境已 12/12 就绪，「检测到缺失 → 生成安装动作」这条路径**本地永远走不到**。
 *   如果只靠手工点一遍，就等于交出一份从没执行过的代码。所以把「一份检测结果 → 该装什么」
 *   做成纯函数（lib/setup.mjs 的 planActions），再用合成的「干净机器」检测结果喂它 ——
 *   于是每个安装分支都能被断言覆盖。
 *
 * 退出码：全绿 0，有失败 1，自身异常 2。
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import {
  planActions, serializeAction, actionSatisfied, classifyFailure, stepCommand,
  FIXTURES, fixtureClean, fixtureBareWsl, fixturePartialAssets, fixtureReady, fixtureAllMissing,
  knownActionIds, simulateEnv, TIMEOUTS,
} from '../lib/setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TTY = process.stdout.isTTY;
const C = {
  ok: (s) => (TTY ? `\x1b[32m${s}\x1b[0m` : s),
  bad: (s) => (TTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (TTY ? `\x1b[2m${s}\x1b[0m` : s),
  b: (s) => (TTY ? `\x1b[1m${s}\x1b[0m` : s),
};
const log = (s = '') => process.stdout.write(`${s}\n`);

// ── 工具 ────────────────────────────────────────────────────
function runNode(args, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT, windowsHide: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    let stdout = '', stderr = '', done = false;
    const timer = setTimeout(() => {
      if (done) return; done = true;
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error(`子进程超时：node ${args.join(' ')}`));
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); reject(e); });
    child.on('close', (code) => { if (done) return; done = true; clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

/** 把一份检测结果里所有项强制改成指定 status（用来构造「全缺」场景）。 */
function forceAll(data, status) {
  return {
    ...data,
    groups: data.groups.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, status })) })),
  };
}

/** 从 lib/env.mjs 源码里抽出它可能产出的所有 item id（漂移哨兵）。 */
function envItemIdsFromSource() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'env.mjs'), 'utf8');
  const ids = new Set();
  const re = /\b(?:ok|warn|fail)\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) ids.add(m[1]);
  return [...ids].sort();
}

// ── 用例 ────────────────────────────────────────────────────
const CASES = [
  {
    name: '① 检测到缺失 → 规划出对应的安装动作（干净机器场景）',
    run: () => {
      const data = fixtureBareWsl();
      const actions = planActions(data);
      const ids = actions.map((a) => a.id);
      assert.ok(actions.length >= 6, `只规划出 ${actions.length} 个动作，太少：${ids.join(', ')}`);
      for (const want of ['wsl.node', 'wsl.ffmpeg', 'wsl.venv', 'lib.wsl', 'lib.win']) {
        assert.ok(ids.includes(want), `缺动作 ${want}；实得 ${ids.join(', ')}`);
      }
      // 每个动作都要能说清「为什么」（来自 env.mjs 的 detail）
      for (const a of actions) assert.ok(a.why && a.why.length > 0, `动作 ${a.id} 没有 why`);
    },
  },
  {
    name: '② 自动 / 手动分界正确（能代跑的才给按钮）',
    run: () => {
      const actions = planActions(fixtureAllMissing());
      const by = Object.fromEntries(actions.map((a) => [a.id, a]));
      // 能自动做的
      for (const id of ['wsl.node', 'wsl.ffmpeg', 'wsl.venv', 'lib.wsl', 'lib.win', 'assets.fonts', 'assets.inst']) {
        assert.strictEqual(by[id]?.kind, 'auto', `${id} 应该是 auto，实得 ${by[id]?.kind}`);
        assert.ok(by[id].steps.length > 0, `${id} 是 auto 但一个步骤都没有`);
        for (const s of by[id].steps) {
          assert.ok(['wsl', 'wsl-file', 'exe'].includes(s.kind), `${id} 的步骤 kind 非法：${s.kind}`);
          assert.ok(s.timeoutMs > 0, `${id} 的步骤没有超时保护`);
        }
      }
      // 只能手动的
      for (const id of ['win.ffmpeg', 'wsl.alive', 'tool.sync', 'win.platform', 'win.gpu']) {
        assert.strictEqual(by[id]?.kind, 'manual', `${id} 应该是 manual，实得 ${by[id]?.kind}`);
        assert.ok(by[id].manual.steps.length > 0, `${id} 是 manual 但没给指引步骤`);
        assert.ok(by[id].manual.note.includes('手动'), `${id} 的指引没有明说「这一步需要你手动做」`);
        assert.strictEqual(by[id].steps, undefined, `${id} 是 manual 却带了可执行步骤 —— 会让人误以为能自动跑`);
      }
      // 覆盖度：12 项全部要有动作
      assert.strictEqual(actions.length, 12, `最坏情况下应规划出 12 个动作，实得 ${actions.length}：${actions.map((a) => a.id).join(', ')}`);
    },
  },
  {
    name: '③ 手动项绝不包含「自动下载大二进制」这类动作',
    run: () => {
      const actions = planActions(fixtureClean());
      const ff = actions.find((a) => a.id === 'win.ffmpeg');
      assert.ok(ff, 'clean 场景没有规划出 win.ffmpeg');
      assert.strictEqual(ff.kind, 'manual');
      const txt = JSON.stringify(ff);
      // Windows 侧 ffmpeg 只给链接 + 放置路径，绝不能出现下载命令
      assert.ok(!/curl|wget|Invoke-WebRequest|Start-BitsTransfer/.test(txt), 'win.ffmpeg 里出现了下载命令，与「不自动下载几百 MB 二进制」冲突');
      assert.ok(ff.manual.links.some((l) => /^https:\/\//.test(l.url)), 'win.ffmpeg 没给下载链接');
    },
  },
  {
    name: '④ 全 ok 的环境 → 规划出 0 个动作（不折腾已就绪的机器）',
    run: () => {
      assert.deepStrictEqual(planActions(fixtureReady()), []);
      // 反过来：把 ready 场景全改成 warn，每个 id 都必须有动作（含 warn 也要管）
      const forced = forceAll(fixtureReady(), 'warn');
      const actions = planActions(forced);
      const covered = new Set(actions.flatMap((a) => a.envIds));
      for (const g of forced.groups) {
        for (const it of g.items) {
          assert.ok(covered.has(it.id), `warn 项 ${it.id} 没有任何安装动作覆盖`);
        }
      }
    },
  },
  {
    name: '⑤ 动作目录覆盖 env.mjs 能产出的**全部** item id（漂移哨兵）',
    run: () => {
      const ids = envItemIdsFromSource();
      assert.ok(ids.length >= 12, `从 env.mjs 源码里只抽到 ${ids.length} 个 id，正则可能失效了`);
      const data = fixtureReady();
      // 把 env.mjs 真实会产出的 id 全塞进一份「全 warn」检测结果
      const items = ids.map((id) => ({ id, label: id, status: 'warn', detail: 'x', fix: 'y' }));
      const fake = { groups: [{ title: 'drift', items }], summary: { total: ids.length, ok: 0, warn: ids.length, fail: 0 }, runnable: true };
      const actions = planActions(fake);
      const fb = actions.filter((a) => a.id.startsWith('fallback.'));
      assert.deepStrictEqual(fb.map((a) => a.id), [],
        `以下 env 检测项在 lib/setup.mjs 里没有专门的安装动作，只落到了兜底分支（env.mjs 加了新检查？）：\n  ${fb.map((a) => a.id).join('\n  ')}`);
      assert.strictEqual(actions.length, ids.length, `动作数 ${actions.length} 与 env 项数 ${ids.length} 不一致`);
      // 顺带确认 fixtureReady 里的 id 集合与 env.mjs 一致
      const readyIds = fixtureReady().groups.flatMap((g) => g.items.map((i) => i.id)).sort();
      assert.deepStrictEqual(readyIds, ids, `fixtureReady 的 id 与 env.mjs 不一致：\n  fixture=${readyIds.join(',')}\n  env.mjs=${ids.join(',')}`);
    },
  },
  {
    name: '⑥ 幂等判据：对应项已 ok → 不该再装',
    run: () => {
      const ready = fixtureReady();
      const partial = fixturePartialAssets();
      const actsReady = planActions(ready);
      assert.strictEqual(actsReady.length, 0);

      // 手工造一个动作对象来测 actionSatisfied（它就是 server 幂等判断用的那一个函数）
      const a = { id: 'wsl.venv', envIds: ['wsl.venv'] };
      assert.strictEqual(actionSatisfied(a, ready), true, 'ready 场景下 wsl.venv 应判定为已就绪');
      assert.strictEqual(actionSatisfied(a, partial), false, 'partial 场景下 wsl.venv 应判定为未就绪');

      const multi = { id: 'x', envIds: ['wsl.venv', 'lib.wsl'] };
      assert.strictEqual(actionSatisfied(multi, partial), false, '多项里只要有一个不 ok 就该判未就绪');
      assert.strictEqual(actionSatisfied({ id: 'y', envIds: ['不存在的项'] }, ready), false, '不存在的项应判未就绪（保守）');
    },
  },
  {
    name: '⑦ 失败分类可区分：网络 / 权限 / 磁盘 / 仓库 / 找不到',
    run: () => {
      const cases = [
        ['Could not resolve host: github.com', 'NETWORK'],
        ['fatal: unable to access ... Connection timed out', 'NETWORK'],
        ['fatal: repository \'https://github.com/a/b.git\' not found', 'AUTH'],
        ['fatal: could not read Username for \'https://github.com\': No such device', 'AUTH'],
        ['bash: /home/lemo/lemo-opuscar/tools/fetch.sh: Permission denied', 'PERMISSION'],
        ['OSError: [Errno 28] No space left on device', 'DISK'],
        ['bash: git: command not found', 'NOTFOUND'],
        ['something completely unrelated', 'EXIT'],
      ];
      for (const [text, want] of cases) {
        const got = classifyFailure(text);
        assert.strictEqual(got.code, want, `"${text.slice(0, 50)}" → ${got.code}（期望 ${want}）`);
        assert.ok(got.hint && got.hint.length > 5, `${want} 没有给出可读的处置建议`);
      }
      // 优先级：磁盘 > 网络（一句里同时出现时，磁盘更致命，先报磁盘）
      assert.strictEqual(classifyFailure('No space left on device / Could not resolve host').code, 'DISK');
    },
  },
  {
    name: '⑧ 每个场景都能走通、都能序列化成 JSON（演练模式的数据基础）',
    run: () => {
      const names = Object.keys(FIXTURES);
      assert.ok(names.length >= 4, `演练场景太少（${names.length}）`);
      for (const n of names) {
        const d = simulateEnv(n);
        assert.ok(d, `simulateEnv(${n}) 返回空`);
        assert.strictEqual(d._simulated, n);
        const actions = planActions(d);
        const ser = JSON.parse(JSON.stringify(actions.map(serializeAction)));
        assert.strictEqual(ser.length, actions.length);
        for (const s of ser) {
          assert.ok(s.id && s.kind && s.title, `序列化后缺字段：${JSON.stringify(s)}`);
          assert.ok(['auto', 'manual'].includes(s.kind));
          // 序列化结果**不能带脚本正文**（UI 只需要标签与命令摘要，正文留在服务端）
          assert.ok(!('script' in s), `${s.id} 的序列化结果里带了 script 正文`);
          if (s.kind === 'auto') for (const st of s.steps) assert.ok(st.cmd && st.label, `${s.id} 的步骤缺 cmd/label`);
          if (s.kind === 'manual') assert.ok(s.manual && s.manual.steps.length, `${s.id} 缺 manual 指引`);
        }
      }
      assert.deepStrictEqual(planActions(simulateEnv('ready')), [], 'ready 场景不该有任何动作');
      assert.ok(planActions(simulateEnv('clean')).length > 0, 'clean 场景应该有动作');
      assert.ok(planActions(simulateEnv('partial')).length > 0, 'partial 场景应该有动作');
    },
  },
  {
    name: '⑨ 超时保护：大体积动作给了足够长的超时（clone 6GB 不能被掐死）',
    run: () => {
      const actions = planActions(fixtureBareWsl());
      const by = Object.fromEntries(actions.map((a) => [a.id, a]));
      const clone = by['lib.wsl'];
      assert.ok(clone, '没规划出 lib.wsl');
      assert.ok(clone.steps[0].timeoutMs >= 60 * 60 * 1000, `clone 超时只有 ${clone.steps[0].timeoutMs}ms，太短`);
      assert.ok(clone.estBytes > 5e9, 'clone 没有给出体积预估（UI 要用来提示用户）');
      assert.ok(TIMEOUTS.clone >= TIMEOUTS.quick, '超时常量不成阶梯');
      // 每个 auto 动作的每一步都必须有超时
      for (const a of actions.filter((x) => x.kind === 'auto')) {
        for (const s of a.steps) assert.ok(s.timeoutMs >= 5 * 60 * 1000, `${a.id} 的超时 ${s.timeoutMs}ms 太短`);
      }
    },
  },
  {
    name: '⑩ 动作 id 稳定且不重复（UI 与幂等判断都靠它）',
    run: () => {
      for (const n of Object.keys(FIXTURES)) {
        const actions = planActions(simulateEnv(n));
        const ids = actions.map((a) => a.id);
        assert.strictEqual(new Set(ids).size, ids.length, `场景 ${n} 里动作 id 有重复：${ids.join(', ')}`);
        for (const a of actions) assert.match(a.id, /^[A-Za-z0-9._-]+$/, `动作 id 含非法字符（server 会 400）：${a.id}`);
      }
      // 同一份检测结果规划两次，结果必须完全一致（纯函数）
      const a1 = planActions(fixtureBareWsl()).map((a) => a.id);
      const a2 = planActions(fixtureBareWsl()).map((a) => a.id);
      assert.deepStrictEqual(a1, a2, 'planActions 不是纯函数（两次结果不同）');
      assert.ok(knownActionIds().includes('wsl.venv'), 'knownActionIds 里没有 wsl.venv');
    },
  },
  {
    name: '⑪ fail 排在 warn 前面（先修致命的）',
    run: () => {
      const data = fixturePartialAssets();
      // 造一个 fail + 若干 warn 的混合结果
      const mixed = {
        ...data,
        groups: data.groups.map((g) => ({
          ...g,
          items: g.items.map((it) => (it.id === 'assets.inst' ? { ...it, status: 'fail' } : it)),
        })),
      };
      const actions = planActions(mixed);
      assert.ok(actions.length >= 2, '混合场景动作太少');
      assert.strictEqual(actions[0].status, 'fail', `第一个动作不是 fail 项：${actions[0].id}=${actions[0].status}`);
      const firstWarn = actions.findIndex((a) => a.status === 'warn');
      const lastFail = actions.map((a) => a.status).lastIndexOf('fail');
      if (firstWarn >= 0 && lastFail >= 0) {
        assert.ok(lastFail < firstWarn, 'fail 与 warn 的顺序乱了');
      }
    },
  },
  {
    name: '⑫ CLI --simulate --json 能跑（演练模式真的可用）',
    run: async () => {
      const r = await runNode(['lib/setup.mjs', '--simulate', '--json'], { timeoutMs: 60000 });
      assert.strictEqual(r.code, 0, `CLI 退出码 ${r.code}\n${r.stderr}`);
      const d = JSON.parse(r.stdout);
      assert.strictEqual(d.mode, 'simulate');
      assert.strictEqual(d.fixtures.length, Object.keys(FIXTURES).length, '演练场景数量不对');
      const bare = d.fixtures.find((f) => f.name === 'bare');
      assert.ok(bare, '没有 bare 场景');
      assert.ok(bare.actions.length >= 6, `bare 场景动作太少：${bare.actions.length}`);
      assert.ok(bare.actions.some((a) => a.kind === 'auto' && a.steps.length > 0), 'bare 场景没有可自动动作');
      assert.ok(bare.actions.some((a) => a.kind === 'manual' && a.manualSteps.length > 0), 'bare 场景没有手动指引');
      const ready = d.fixtures.find((f) => f.name === 'ready');
      assert.deepStrictEqual(ready.actions, [], 'ready 场景不该有动作');

      // 无参模式：真检测 + 打印计划（不执行）。本机 12/12 ok → 应当说「无需安装」
      const r2 = await runNode(['lib/setup.mjs'], { timeoutMs: 120000 });
      assert.strictEqual(r2.code, 0, `无参 CLI 退出码 ${r2.code}\n${r2.stderr}`);
      assert.match(r2.stdout, /环境检测：/, '无参 CLI 没打印检测结果');
      assert.match(r2.stdout, /(无需安装任何东西|项待处理)/, '无参 CLI 没给出结论');

      // 未知场景要报错而不是静默
      const r3 = await runNode(['lib/setup.mjs', '--simulate=不存在的场景'], { timeoutMs: 30000 });
      assert.notStrictEqual(r3.code, 0, '未知演练场景竟然返回 0');
    },
  },
];

// ── 主流程 ──────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log('');
  log(C.b('lemo 控制台 · 首次运行安装（纯逻辑）测试'));
  log(C.dim(`  项目 ${ROOT}`));
  log(C.dim(`  用例 ${CASES.length} 条 · 全部不需要起服务、不需要 WSL`));
  log('');

  const results = [];
  for (const c of CASES) {
    const s = Date.now();
    try {
      await c.run();
      results.push({ name: c.name, ok: true });
      log(`  ${C.ok('PASS')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
    } catch (e) {
      results.push({ name: c.name, ok: false, err: e });
      log(`  ${C.bad('FAIL')}  ${c.name} ${C.dim(`(${Date.now() - s}ms)`)}`);
      for (const line of String((e && e.message) || e).split('\n')) log(`        ${line}`);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  log('');
  log('─'.repeat(64));
  if (failed.length) {
    log(C.bad(`  ${passed} passed, ${failed.length} failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
    for (const f of failed) log(C.bad(`  ✗ ${f.name}`));
  } else {
    log(C.ok(`  ${passed} passed, 0 failed`) + C.dim(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`));
  }
  log('─'.repeat(64));
  log('');
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  log(C.bad(`\n✗ 测试自身异常：${(e && e.stack) || e}\n`));
  process.exitCode = 2;
});
