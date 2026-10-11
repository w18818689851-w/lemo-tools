#!/usr/bin/env node
/**
 * test/setup.test.mjs —— 首次运行「自动安装」的纯逻辑测试（零依赖）
 *
 * 用法：node test/setup.test.mjs
 *
 * ★ 为什么单独一个文件、不并进 test/smoke.mjs：
 *   smoke.mjs 的「19 条用例」是这批优化之前就冻结的验收基线，数量本身就是约定。
 *   安装逻辑的用例另起一个入口，两个数字互不干扰（smoke 仍是 19，这里是 13）。
 *   ★ 2026-10-08 复核：smoke 现为 **41** 条（`STATIC 9 + SERVER 27 + PROCESS 5`）——「19」是更早的快照；
 *     本文件（安装纯逻辑）仍为 **13** 条。
 *   ★★ 2026-10-11：本文件 **13 → 16** 条 —— 新增 ⑭⑮⑯ 三条，钉「乐器采样库单库可选」这个改动：
 *     ⑭ 默认路径（不选）逐字节不变（仍是 `instruments all`）；⑮ 每个库能单装、非法库名进不了命令；
 *     ⑯ 硬编码的库名 / 体积逐字等于**上游** `tools/fetch.sh` 的 `$LIBS` 与 `tools/assets.json`。
 *     ★ 因此本套件现在**依赖上游 Windows 库可读**（`CFG.winLib`，默认 `D:\lemo-opuscar`）——
 *     读不到时 ⑯ 判「无法判定」并 FAIL（刻意：宁可红，也不要静默放行一条会发错命令的硬编码）。
 *   ★★ 2026-10-11（同日第二批）：本文件 **16 → 19** 条 —— 新增 ⑰⑱⑲ 三条，钉「**按库**的已装状态
 *     在向导里可见且不误导」这个改动（修掉上一批自己登记的局限：装完**单个**采样库后
 *     `assets.inst` 仍只说「只有 N 个文件（预期 ~3869）」，看不出装了哪个库）：
 *     ⑰ 文案三档（0/1/5 个库）如实 + **状态判据仍是 `total>=3000`**（未放宽、未收紧）；
 *     ⑱ 探针**真跑**（本地 bash + 临时假库树）⇒ 逐库计数正确、空目录/缺失目录都算 0、
 *        且探针枚举的库名 == `INSTRUMENT_LIBS`；
 *     ⑲ 向导侧：0 个库 ⇒ 卡数仍是 1+N（**呈现不变坏**）；1 个库 ⇒ 6 张卡的 why 如实；
 *        5 个库 ⇒ 该组 0 张卡。
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
  knownActionIds, simulateEnv, TIMEOUTS, INSTRUMENT_LIBS,
} from '../lib/setup.mjs';
// ★ driftCheck / CFG：本套件既有的「漂移哨兵」（⑤）本就以 lib/env.mjs 为对象，故一并向它取用。
// ★ instrumentLibState / assetsProbe / instrumentLibsProbe：⑰⑱ 钉的就是 env.mjs 的「按库」判据与探针。
import {
  CFG, driftCheck, instrumentLibState, assetsProbe, instrumentLibsProbe,
} from '../lib/env.mjs';

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

/**
 * 本机 bash 可执行文件（⑱ 要用它**真跑** env.mjs 的按库探针）。
 * ★ 先按 PATH 找 `bash`；找不到就试 Git for Windows 的两个常见落点 —— 测试可能不是从 Git Bash 起的。
 * ★ 全都不在 ⇒ 返回 `bash`，让 spawn 报 ENOENT ⇒ ⑱ **FAIL**（绝不静默放行，见本文件纪律）。
 */
function bashExe() {
  const fixed = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const c of fixed) { try { if (fs.existsSync(c)) return c; } catch { /* ignore */ } }
  return 'bash';
}

/** 跑一段 bash（⑱ 用；本环境 spawnSync/execFileSync 一律 EBUSY ⇒ 一律异步 spawn）。 */
function runBash(script, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bashExe(), ['-c', script], {
      windowsHide: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    let stdout = '', stderr = '', done = false;
    const timer = setTimeout(() => {
      if (done) return; done = true;
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error(`bash 超时（${timeoutMs}ms）`));
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); reject(e); });
    child.on('close', (code) => { if (done) return; done = true; clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

/** 从探针输出里按 `k=v` 解析成对象（与 lib/env.mjs 里 `kv` 的口径同形）。 */
function parseKv(stdout) {
  return Object.fromEntries(String(stdout || '').trim().split('\n')
    .filter((l) => l.includes('=')).map((l) => l.split('=').map((s) => s.trim())));
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

/**
 * 读**上游库仓**（Windows 侧那份）里的 `tools/*` 文件 —— ⑯ 用它做「清单不漂」的逐字比对。
 * ★ 读不到就返回 null（由用例判「无法判定」并 FAIL，**不**静默放行 —— 本项目的既有纪律）。
 * ★ 候选根：`CFG.winLib`（认 `LEMO_LIB_WIN`）与它的默认值 `D:\lemo-opuscar`（去重）。
 */
function readUpstreamTools(names) {
  const roots = [...new Set([CFG.winLib, 'D:\\lemo-opuscar'])];
  for (const r of roots) {
    try {
      const out = { root: r };
      for (const n of names) out[n] = fs.readFileSync(path.join(r, 'tools', n), 'utf8');
      return out;
    } catch { /* 这个候选根不完整 ⇒ 换下一个 */ }
  }
  return null;
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
      // 覆盖度：12 项全部要有动作（★ 2026-10-11：`assets.inst` 额外派生「单库」可选项 ⇒ 12 + N）
      const want = 12 + INSTRUMENT_LIBS.length;
      assert.strictEqual(actions.length, want,
        `最坏情况下应规划出 ${want} 个动作（12 个检测项 + ${INSTRUMENT_LIBS.length} 个采样库单库可选项），实得 ${actions.length}：${actions.map((a) => a.id).join(', ')}`);
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
      assert.strictEqual(actions.length, ids.length + INSTRUMENT_LIBS.length,
        `动作数 ${actions.length} ≠ 「env 项数 ${ids.length} + 采样库单库可选项 ${INSTRUMENT_LIBS.length}」（★ 后者是 assets.inst 的附加动作，见 ⑭/⑮）`);
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
  {
    name: '⑬ driftCheck 对「表达式写法」不再静默失明：读不到值 ⇒ 报「无法判定」（≠「无漂移」）',
    run: () => {
      // 由来（RISK-13）：编排器把 wslLib/winLib 写成 `process.env.LEMO_LIB_WSL || '...'`（**表达式**），
      //   而 driftCheck 的正则只认**纯字符串字面量** ⇒ 读不到值 ⇒ 旧版**静默跳过**
      //   ⇒ 调用方看到「没有漂移」，实际是**根本没比对上**（静默失明）。
      // 判据：**「匹配不上」必须与「匹配上且一致」区分开**（下面三条正/负断言各钉一条路）。
      const exprSrc = [
        'const CFG = {',
        `  wslLib: process.env.LEMO_LIB_WSL || '${CFG.wslLib}',`,
        `  winLib: process.env.LEMO_LIB_WIN || '${CFG.winLib}',`,
        '};',
      ].join('\n');
      const gotExpr = driftCheck(exprSrc);
      const wslExpr = gotExpr.find((d) => d.id === 'drift.wslLib');
      assert.ok(wslExpr, '★ 表达式写法必须产出可见条目（不再静默失明）');
      assert.match(wslExpr.msg, /无法判定/, `★ 应明确说「无法判定」，实得：${wslExpr.msg}`);

      // 区分①：纯字面量且**一致** ⇒ 该 key 不产出任何条目（= 真的「无漂移」）
      const litOk = driftCheck(`const CFG = {\n  wslLib: '${CFG.wslLib}',\n};`);
      assert.strictEqual(litOk.find((d) => d.id === 'drift.wslLib'), undefined,
        '字面量且一致 ⇒ 不得产出条目（否则会把「一致」误报成问题）');

      // 区分②：纯字面量但**不一致** ⇒ 报「漂移」（与「无法判定」是两条不同的路）
      const litDrift = driftCheck("const CFG = {\n  wslLib: '/definitely/not/the/same',\n};");
      const d2 = litDrift.find((d) => d.id === 'drift.wslLib');
      assert.ok(d2, '不一致的字面量必须产出条目');
      assert.match(d2.msg, /漂移/, `不一致应报「漂移」而非「无法判定」，实得：${d2.msg}`);
    },
  },
  {
    name: '⑭ 采样库默认路径逐字节不变：不选 ⇒ 仍是 `instruments all`，且排在可选项之前',
    run: () => {
      // ★ 铁律（与 `--color default` 同源口径）：**不选任何库**时，用户看到的卡片、点到的按钮、
      //   跑的命令必须与「加单库可选之前」逐字节一致。下面第 ② 段就是改动前 lib/setup.mjs 里
      //   那段脚本的**逐字节副本** —— 想改它，先想清楚为什么（改了这里就必须同步那里）。
      const actions = planActions(fixturePartialAssets());   // 该场景 assets.inst = warn
      const def = actions.find((a) => a.id === 'assets.inst');
      assert.ok(def, `没有规划出 assets.inst（默认的「全部」动作）；实得 ${actions.map((a) => a.id).join(', ')}`);

      // ① 元数据逐字节
      assert.strictEqual(def.kind, 'auto');
      assert.strictEqual(def.title, '下载乐器采样库（约 1.4 GB，可断点续传）');
      assert.strictEqual(def.estBytes, 1.4e9);
      assert.deepStrictEqual(def.envIds, ['assets.inst']);
      assert.strictEqual(def.steps.length, 1);
      assert.strictEqual(def.steps[0].label, 'sh tools/fetch.sh instruments all');
      assert.strictEqual(def.steps[0].timeoutMs, TIMEOUTS.download);

      // ② 脚本正文逐字节（= 改动前的原文）
      assert.strictEqual(def.steps[0].script, [
        '',
        'set -e',
        `L="${CFG.wslLib}"`,
        'cd "$L"',
        'if [ ! -f tools/fetch.sh ]; then echo "✗ 找不到 $L/tools/fetch.sh"; exit 2; fi',
        'echo "→ 下载 5 个采样库，共约 1.4 GB；中断后重跑同一命令会自动续传"',
        'sh tools/fetch.sh instruments all',
        'echo "→ 校验"',
        'echo "inst=$(find $L/core/audio/instruments -type f 2>/dev/null | wc -l)"',
        '',
      ].join('\n'), '默认动作（assets.inst）的脚本正文变了 —— 违反「不选 ⇒ 与改动前逐字节一致」这条铁律');

      // ③ 默认动作必须是这一项的**第一条**（UI 第一张卡 = 默认路径；可选项只许排在它后面）
      const sameEnv = actions.filter((a) => (a.envIds || []).includes('assets.inst')).map((a) => a.id);
      assert.strictEqual(sameEnv[0], 'assets.inst', `assets.inst 的主动作不在第一位：${sameEnv.join(', ')}`);
      assert.deepStrictEqual(sameEnv, ['assets.inst', ...INSTRUMENT_LIBS.map((l) => `assets.inst.${l.name}`)],
        'assets.inst 那一组动作的构成 / 顺序不对');
    },
  },
  {
    name: '⑮ 采样库可选：每个库都能单装（命令里是该库名、不带 all），非法库名进不了命令',
    run: () => {
      const actions = planActions(fixturePartialAssets());
      const by = Object.fromEntries(actions.map((a) => [a.id, a]));
      const allowed = new Set([...INSTRUMENT_LIBS.map((l) => l.name), 'all']);

      // ① 构成：1 个「全部」+ N 个单库，且都在同一个检测项（assets.inst）下
      const inst = actions.filter((a) => a.id === 'assets.inst' || a.id.startsWith('assets.inst.'));
      assert.strictEqual(inst.length, 1 + INSTRUMENT_LIBS.length,
        `采样库相关动作数不对：${inst.map((a) => a.id).join(', ')}`);

      for (const l of INSTRUMENT_LIBS) {
        const a = by[`assets.inst.${l.name}`];
        assert.ok(a, `缺少单库动作 assets.inst.${l.name}`);
        assert.strictEqual(a.kind, 'auto', `${a.id} 应是 auto`);
        assert.strictEqual(a.estBytes, l.bytes, `${a.id} 的体积与清单不符（UI 要显示它）`);
        assert.deepStrictEqual(a.envIds, ['assets.inst'], `${a.id} 的 envIds 应挂在 assets.inst 上`);
        assert.ok(a.why && a.why.length > 0, `${a.id} 没有 why`);

        // ② 命令里出现**那个库名**、且**不带 all**
        const calls = a.steps.flatMap((s) => String(s.script || '').split('\n'))
          .filter((x) => /fetch\.sh\s+instruments/.test(x));
        assert.strictEqual(calls.length, 1, `${a.id} 的 fetch.sh 调用不唯一：${calls.join(' | ')}`);
        assert.strictEqual(calls[0], `sh tools/fetch.sh instruments ${l.name}`,
          `${a.id} 的调用不是「只装这个库」：${calls[0]}`);
        assert.ok(!/\ball\b/.test(calls[0]), `${a.id} 的命令里出现了 all：${calls[0]}`);

        // ③ 幂等守卫盯的就是这个库的目录（目录名 = 库名，见上游 core/audio/INSTRUMENTS.md §9）
        assert.ok(String(a.steps[0].script).includes(`core/audio/instruments/${l.name}`),
          `${a.id} 的幂等守卫没盯 core/audio/instruments/${l.name}`);
      }

      // ④ 白名单：计划里**所有** `fetch.sh instruments <x>` 的 <x> 都必须是「某个库名或 all」
      const args = [];
      for (const a of actions) {
        for (const s of a.steps || []) {
          for (const line of String(s.script || '').split('\n')) {
            const m = /^sh tools\/fetch\.sh instruments (\S+)$/.exec(line);
            if (m) args.push(m[1]);
          }
        }
      }
      assert.ok(args.length >= 1 + INSTRUMENT_LIBS.length, `计划里只抽出 ${args.length} 条 fetch.sh 调用，太少`);
      for (const x of args) assert.ok(allowed.has(x), `计划里出现了白名单外的库名：${x}`);
      assert.ok(args.includes('all'), '默认动作的 `instruments all` 不见了（默认路径被改坏了）');

      // ⑤ 非法库名**进不了命令**：它们既不在 knownActionIds()（⇒ server 直接 404、不执行），
      //   也不会被任何动作拼进 shell —— 「用户输入直拼命令」这条注入面在这里是关着的。
      const bad = ['zzz', 'all2', 'vsco2ce;rm -rf /', '../etc', 'freepats vcsl', '', 'ALL'];
      const known = knownActionIds();
      for (const b of bad) {
        assert.ok(!known.includes(`assets.inst.${b}`), `knownActionIds() 里竟然有非法 id assets.inst.${b}`);
        assert.ok(!known.includes(`assets.inst.${b} `), `knownActionIds() 里竟然有带空格的 id`);
        for (const line of args) assert.notStrictEqual(line, b, `非法库名 ${JSON.stringify(b)} 被拼进了命令`);
      }
      for (const l of INSTRUMENT_LIBS) assert.ok(known.includes(`assets.inst.${l.name}`), `knownActionIds() 少了 assets.inst.${l.name}（server 会误判 404）`);
    },
  },
  {
    name: '⑯ 采样库清单不漂：硬编码的库名 / 体积逐字等于上游（fetch.sh 的 $LIBS + assets.json）',
    run: () => {
      // ★ 为什么必须有这条：库名清单是**硬编码**的（理由见 lib/setup.mjs 的 INSTRUMENT_LIBS 段：
      //   这个动作恰恰是给「库还没装」的机器看的，那时上游文件也不存在 ⇒ 派生必然退化成常量）。
      //   硬编码就必须有闸门 —— 否则上游改名 / 增删库，我们只会**悄悄**发一条错命令。
      // ★ 判据形态：读上游原文逐字比对。**读不到上游 ⇒ 判「无法判定」并 FAIL**（不静默放行，
      //   沿用本套件 ⑬ 的口径：「匹配不上」必须与「匹配上且一致」区分开）。
      const up = readUpstreamTools(['fetch.sh', 'assets.json']);
      assert.ok(up, `读不到上游 tools/fetch.sh 与 tools/assets.json（候选：${CFG.winLib} / D:\\lemo-opuscar）`
        + ' ⇒ **无法判定**库名清单是否漂移。这不是「无问题」：请先让 Windows 库就位（或设 LEMO_LIB_WIN）再跑本套件。');

      // ① fetch.sh 的 $LIBS（= usage 行里 `instruments <lib>` 的 libs）
      const m = /^LIBS="([^"]*)"/m.exec(up['fetch.sh']);
      assert.ok(m, '上游 fetch.sh 里找不到 `LIBS="..."` 这一行（上游形态变了？）⇒ 本套件的解析已失明，必须同步它');
      const upstreamLibs = m[1].trim().split(/\s+/).filter(Boolean);
      assert.ok(upstreamLibs.length >= 1, `上游 $LIBS 解析出 ${upstreamLibs.length} 个库名，解析可能失效：${JSON.stringify(m[1])}`);
      const mine = INSTRUMENT_LIBS.map((l) => l.name).sort();
      assert.deepStrictEqual(mine, [...upstreamLibs].sort(),
        `★ 库名清单与上游不一致（上游改了名 / 增删了库？）—— 同步 lib/setup.mjs 的 INSTRUMENT_LIBS：\n`
        + `  本仓：${mine.join(', ')}\n  上游：${[...upstreamLibs].sort().join(', ')}`);

      // ② 体积：与上游 assets.json 的 `instruments-<lib>.size` 逐字相同（只影响 UI 显示，但显示错就是错）
      const man = JSON.parse(up['assets.json']);
      for (const l of INSTRUMENT_LIBS) {
        const p = man.packs && man.packs[`instruments-${l.name}`];
        assert.ok(p, `上游 assets.json 里没有 instruments-${l.name} 这个 pack（上游改名了？）`);
        assert.strictEqual(l.bytes, p.size,
          `assets.inst.${l.name} 的体积显示与上游不符：本仓 ${l.bytes} / 上游 ${p.size}`);
      }
      // 反向：上游多出来的 instruments-* pack 也必须在本仓清单里（否则用户装不到）
      const extra = Object.keys(man.packs || {})
        .filter((k) => k.startsWith('instruments-'))
        .map((k) => k.slice('instruments-'.length))
        .filter((x) => !mine.includes(x));
      assert.deepStrictEqual(extra, [], `上游有本仓清单里没有的采样库：${extra.join(', ')}（用户装不到它）`);

      // ③ 幂等守卫假设的目录名 = 库名：上游 INSTRUMENTS.md 的授权表里逐个写着 `instruments/<lib>/`
      //    （守卫写错目录名不会报错，只会**永远不跳过** ⇒ 一键安装会把 1.4 GB 再下一遍，故一并钉住）
      let doc = null;
      for (const r of [...new Set([up.root, 'D:\\lemo-opuscar'])]) {
        try { doc = fs.readFileSync(path.join(r, 'core', 'audio', 'INSTRUMENTS.md'), 'utf8'); break; } catch { /* 换下一个 */ }
      }
      assert.ok(doc, `读不到上游 core/audio/INSTRUMENTS.md（候选：${up.root}）⇒ 无法钉住「目录名 = 库名」这个假设`);
      for (const l of INSTRUMENT_LIBS) {
        assert.ok(doc.includes(`instruments/${l.name}/`),
          `上游 INSTRUMENTS.md 里找不到 \`instruments/${l.name}/\` ⇒ 单库动作的幂等守卫盯错了目录（上游改了目录结构？）`);
      }
    },
  },
  {
    name: '⑰ 采样库「按库」文案：0 个 / 1 个 / 5 个库如实；状态判据仍是 total>=3000（未放宽、未收紧）',
    run: () => {
      // ★ 由来（上一批登记的局限）：`lib/env.mjs` 的 `assets.inst` 只数总文件数 ⇒ 装完**单个**库之后
      //   文案仍是「只有 N 个文件（预期 ~3869）」⇒ **看不出装了哪个库**，向导里那 6 张卡照旧全在。
      //   现在文案**追加**按库事实（原文案前缀保留）；判据本身**一字未动**（见下 ④）。
      const names = INSTRUMENT_LIBS.map((l) => l.name);

      // ① 一个都没装 ⇒ warn，且「缺」列全 5 个（文案前缀仍是原文案）
      const zero = instrumentLibState(0, {});
      assert.strictEqual(zero.status, 'warn');
      assert.deepStrictEqual(zero.installed, []);
      assert.deepStrictEqual(zero.missing, names);
      assert.ok(zero.detail.startsWith('0 个文件（预期 ~3869）· '), `原文案前缀没保留：${zero.detail}`);
      assert.ok(zero.detail.includes('0/5 个采样库已装'), `0 库没写 0/5：${zero.detail}`);
      for (const n of names) assert.ok(zero.detail.includes(n), `0 库的「缺」列表里没有 ${n}：${zero.detail}`);

      // ② 只装了 salamander ⇒ 如实：1/5、salamander 在「已装」侧、**不在**「缺」侧
      const one = instrumentLibState(386, { salamander: 386 });
      assert.strictEqual(one.status, 'warn');
      assert.deepStrictEqual(one.installed, ['salamander']);
      assert.deepStrictEqual(one.missing, names.filter((n) => n !== 'salamander'));
      assert.ok(one.detail.includes('1/5 个采样库已装'), `1 库没写 1/5：${one.detail}`);
      assert.ok(one.detail.includes('缺：freepats, karoryfer, vcsl, vsco2ce'), `1 库的「缺」列表不对：${one.detail}`);
      // ★ 「已装」的判据 = 目录下有 >=1 个文件 ⇒ 空目录（半成品）**不算已装**
      assert.deepStrictEqual(instrumentLibState(0, { salamander: 0 }).installed, [],
        '空目录（0 个文件）不该算「已装」');

      // ③ 5 个都装 ⇒ ok；文案不再写「预期」，也不再有「缺」
      const all = instrumentLibState(3869, Object.fromEntries(names.map((n) => [n, 1])));
      assert.strictEqual(all.status, 'ok');
      assert.deepStrictEqual(all.installed, names);
      assert.deepStrictEqual(all.missing, []);
      assert.strictEqual(all.detail, '3869 个文件 · 5/5 个采样库已装');

      // ④ 状态判据**未动**：仍是 `total >= 3000`（阈值两侧各钉一次 —— 不许放宽，也不许收紧）
      assert.strictEqual(instrumentLibState(3000, {}).status, 'ok', '阈值 3000 应判 ok');
      assert.strictEqual(instrumentLibState(2999, {}).status, 'warn', '2999 应判 warn');
      // ★ 已知边界（**有意**）：文件数够、库不全 ⇒ 状态仍 ok（向导不出卡），但**事实写在文案里**
      const coarse = instrumentLibState(3869, { salamander: 3869 });
      assert.strictEqual(coarse.status, 'ok');
      assert.ok(coarse.detail.includes('1/5 个采样库已装'), `「文件数够但库不全」必须看得见：${coarse.detail}`);

      // ⑤ 演练夹具的 assets.inst 文案是**手写**的 ⇒ 钉它与真实函数同源（否则 --simulate 会演一份假事实）
      const fixOf = (data) => data.groups.flatMap((g) => g.items).find((i) => i.id === 'assets.inst').detail;
      assert.strictEqual(fixOf(fixturePartialAssets()), instrumentLibState(0, {}).detail,
        'fixturePartialAssets 的 assets.inst 文案与 instrumentLibState(0, {}) 不一致');
      assert.strictEqual(fixOf(fixtureReady()), all.detail,
        'fixtureReady 的 assets.inst 文案与「5 个库全装」的文案不一致');
    },
  },
  {
    name: '⑱ 按库探针真跑（本地 bash + 临时假库树）：逐库计数正确、空目录/缺失目录都算 0、库名清单 = INSTRUMENT_LIBS',
    run: async () => {
      // ★ 为什么要**真跑**：探针是 shell —— 只断言「字符串里有库名」证明不了它真按库数出来。
      //   在**本地 bash**（Git Bash）里对着**临时假库树**跑：不起 WSL、不碰真实库、不碰真实产物。
      //   ★ 临时根必须在 D 盘（本项目硬规则：临时文件不许落 C 盘），跑完逐字删掉。
      const root = path.join('D:/lemo-tmp', `instprobe-${process.pid}-${Date.now().toString(36)}`);
      const names = INSTRUMENT_LIBS.map((l) => l.name);
      const instDir = path.join(root, 'core', 'audio', 'instruments');
      try {
        // 假树：salamander 2 个文件（含子目录 1 个）、vcsl 1 个、freepats **空目录**、karoryfer/vsco2ce 目录不存在
        for (const [lib, rel] of [['salamander', 'a.wav'], ['salamander', 'sub/b.wav'], ['vcsl', 'x.wav']]) {
          const p = path.join(instDir, lib, rel);
          fs.mkdirSync(path.dirname(p), { recursive: true });
          fs.writeFileSync(p, 'x');
        }
        fs.mkdirSync(path.join(instDir, 'freepats'), { recursive: true });

        // ★ 探针里的 `L=` 由参数注入（`assetsProbe(libRoot)`；生产调用不传 ⇒ 用 CFG.wslLib）
        const r = await runBash(assetsProbe(root.replace(/\\/g, '/')));
        assert.strictEqual(r.code, 0, `探针在本地 bash 里退出码 ${r.code}\n${r.stderr}`);
        const kv = parseKv(r.stdout);

        // ① 整棵树总数（既有判据那一行）与**按库**计数并存
        assert.strictEqual(Number(kv.inst), 3, `总数应为 3，实得 ${kv.inst}`);
        // ② 逐库：与假树一致（含「空目录算 0」「目录不存在算 0」两种边界）
        assert.strictEqual(Number(kv['inst.salamander']), 2, `salamander 应为 2，实得 ${kv['inst.salamander']}`);
        assert.strictEqual(Number(kv['inst.vcsl']), 1, `vcsl 应为 1，实得 ${kv['inst.vcsl']}`);
        assert.strictEqual(Number(kv['inst.freepats'] || 0), 0, '空目录应数出 0');
        for (const n of ['karoryfer', 'vsco2ce']) {
          assert.strictEqual(Number(kv[`inst.${n}`] || 0), 0, `${n} 目录不存在应数出 0`);
        }
        // ③ 探针枚举的库名清单 == INSTRUMENT_LIBS（两处清单会漂 ⇒ 钉住）
        const probe = instrumentLibsProbe();
        const m = /^for b in (.+); do$/m.exec(probe);
        assert.ok(m, `探针里找不到「库名清单」那一行：\n${probe}`);
        assert.deepStrictEqual(m[1].trim().split(/\s+/).sort(), [...names].sort(),
          '探针枚举的库名与 INSTRUMENT_LIBS 不一致（两张清单会漂）');
        // ④ 端到端：探针输出 ⇒ instrumentLibState 的文案（这是 /api/env 里那一项的真实来路）
        const st = instrumentLibState(Number(kv.inst),
          Object.fromEntries(names.map((n) => [n, Number(kv[`inst.${n}`] || 0)])));
        assert.deepStrictEqual(st.installed, ['salamander', 'vcsl']);
        assert.ok(st.detail.includes('2/5 个采样库已装'), `端到端文案不对：${st.detail}`);
        assert.ok(st.detail.includes('缺：freepats, karoryfer, vsco2ce'), `端到端「缺」列表不对：${st.detail}`);
      } finally {
        try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* 尽力而为 */ }
      }
    },
  },
  {
    name: '⑲ 向导侧不误导：0 个库 ⇒ 卡数仍是 1+N（呈现不变坏）；1 个库 ⇒ 6 张卡 why 如实；5 个库 ⇒ 该组 0 张卡',
    run: () => {
      const names = INSTRUMENT_LIBS.map((l) => l.name);
      const withInst = (status, detail) => {
        const d = fixturePartialAssets();
        return {
          ...d,
          groups: d.groups.map((g) => ({
            ...g,
            items: g.items.map((it) => (it.id === 'assets.inst' ? { ...it, status, detail } : it)),
          })),
        };
      };
      const instOf = (actions) => actions
        .filter((a) => a.id === 'assets.inst' || a.id.startsWith('assets.inst.')).map((a) => a.id);

      // ① 0 个库（= 改动前的呈现）：卡数仍是 1 + N —— **不多不少**（不许变成「5 张必装卡把用户淹掉」）
      const zero = planActions(withInst('warn', instrumentLibState(0, {}).detail));
      assert.deepStrictEqual(instOf(zero), ['assets.inst', ...names.map((n) => `assets.inst.${n}`)],
        '0 个库时采样库那一组的卡片构成变了（呈现变坏）');

      // ② 1 个库：6 张卡都在（卡片不消失 —— 有意），但**每张卡的 why 都如实**（6 张同源于那一项检测结果）
      const oneDetail = instrumentLibState(386, { salamander: 386 }).detail;
      const one = planActions(withInst('warn', oneDetail));
      const cards = one.filter((a) => (a.envIds || []).includes('assets.inst'));
      assert.strictEqual(cards.length, 1 + names.length, `1 个库时卡数不对：${cards.map((a) => a.id).join(', ')}`);
      for (const a of cards) assert.strictEqual(a.why, oneDetail, `${a.id} 的 why 不是那一项检测结果的原文`);
      assert.ok(cards[0].why.includes('1/5 个采样库已装'), `卡片上看不出「已装 1 个」：${cards[0].why}`);
      assert.ok(!/缺：[^）]*salamander/.test(cards[0].why), `已装的 salamander 不该出现在「缺」里：${cards[0].why}`);

      // ③ 5 个库全装 ⇒ 该项 ok ⇒ 该组**一张卡都不出**（向导干净，与「全部装好」一致）
      const all = planActions(withInst('ok',
        instrumentLibState(3869, Object.fromEntries(names.map((n) => [n, 1]))).detail));
      assert.deepStrictEqual(instOf(all), [], '5 个库全装时采样库那一组不该出卡');
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
