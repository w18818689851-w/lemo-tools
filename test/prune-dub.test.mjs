// test/prune-dub.test.mjs —— `scripts/prune-dub.mjs`（dub 产物保留策略，RISK-10）的行为回归测试
//
// ★ 由来（2026-10-10）：`dub.mjs` 每出一片就在 `<dubRoot>/<时间戳>-<短id>/` 落一份产物，
//   校验抽帧另有 `<dubRoot>/_verify/<同名目录>/`，**没有任何保留策略**、只增不减。
//   新增 `scripts/prune-dub.mjs` 是它的写侧 ⇒ 本用例钉住它的**安全底线**：
//   ① 默认 dry-run **一个字节都不删**；② `--apply` 必须显式给 `--older-than`（缺则报错退出、不删）；
//   ③ 只删**超龄**的产物目录 / `_verify` 同名抽帧目录；④ 未超龄的、`_uploads/`（用户素材）、
//      只读辅助目录（`_fonts` 等 `_` 开头）**原封不动**；⑤ 路径逃逸 / 符号链接-junction **被拒**；
//   ⑥ 输出里**逐个**列出完整路径。
//
// ★ 隔离：全程只碰 `D:/lemo-tmp/prune-dub-*` 临时树（非 C 盘），跑完递归删；**绝不碰真实 `dub/`**。
//   ★ 覆盖点 = **`--root <dir>`**（本工具**不新增环境变量** ⇒ 无需登记进 `check-env-overrides`）。
//   ★ 本机 `spawnSync`/`execFileSync` 一律 EBUSY ⇒ 照 `test/prune-jobs.test.mjs` 用**异步 `spawn`**。

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PRUNE = path.join(REPO, 'scripts', 'prune-dub.mjs');
const TMP_BASE = process.env.LEMO_TMP || 'D:/lemo-tmp';   // ★ 非 C 盘

const OLD = '20260101-000000-aaaa';   // 超龄产物目录名（形态：YYYYMMDD-HHMMSS-<4hex>）
const NEW = '20990101-000000-bbbb';   // 未超龄（mtime 未来）
const DAY = 24 * 60 * 60 * 1000;

/** 异步跑 CLI，返回 { code, out, err }。 */
function runCli(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [PRUNE, ...args], { cwd: REPO, windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

/** 造夹具：产物目录 + `_verify` 同名抽帧 + `_uploads` + 只读辅助目录 + 非产物目录。 */
function makeFixture() {
  const dir = path.join(TMP_BASE, `prune-dub-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  const mk = (rel, file) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(p, { recursive: true });
    if (file) fs.writeFileSync(path.join(p, file), 'x'.repeat(64), 'utf8');
    return p;
  };
  const oldArt = mk(OLD, 'film.mp4');               // 超龄产物目录
  const newArt = mk(NEW, 'film.mp4');               // 未超龄产物目录
  const oldVer = mk(path.join('_verify', OLD), 'f.png');   // 超龄抽帧目录
  const newVer = mk(path.join('_verify', NEW), 'f.png');   // 未超龄抽帧目录
  const uploads = mk('_uploads', null);
  fs.writeFileSync(path.join(uploads, 'index.json'), '{}', 'utf8');
  fs.writeFileSync(path.join(uploads, 'user-old.mp4'), 'u'.repeat(128), 'utf8');  // 用户素材（超龄）
  const aux = mk('_fonts', 'x.ttf');                // 只读辅助目录
  const odd = mk('randomdir', 'a.txt');             // 非产物目录形态

  // 设 mtime：old = 100 天前；new = 现在
  const oldT = new Date(Date.now() - 100 * DAY);
  for (const p of [oldArt, oldVer, uploads, path.join(uploads, 'user-old.mp4')]) {
    fs.utimesSync(p, oldT, oldT);
  }
  return { dir, oldArt, newArt, oldVer, newVer, uploads, aux, odd };
}

const exists = (p) => fs.existsSync(p);

test('prune-dub：dry-run（--older-than）一个字节都不删', async () => {
  const f = makeFixture();
  try {
    const r = await runCli(['--older-than', '30', '--root', f.dir]);
    assert.equal(r.code, 0, `退出码应为 0\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    assert.ok(exists(f.oldArt), 'dry-run 后超龄产物目录必须还在');
    assert.ok(exists(f.newArt), 'dry-run 后未超龄产物目录必须还在');
    assert.ok(exists(f.oldVer), 'dry-run 后超龄抽帧目录必须还在');
    assert.ok(exists(f.uploads), 'dry-run 后 _uploads 必须还在');
    assert.ok(exists(path.join(f.uploads, 'user-old.mp4')), 'dry-run 后用户素材必须还在');
    assert.ok(r.out.includes(f.oldArt), '报告里应逐个列出超龄产物目录的完整路径');
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('prune-dub：--apply + 阈值 ⇒ 只删超龄产物/抽帧，未超龄 + _uploads + 辅助目录原封不动', async () => {
  const f = makeFixture();
  try {
    const r = await runCli(['--apply', '--older-than', '30', '--root', f.dir]);
    assert.equal(r.code, 0, `退出码应为 0\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    // 该删的删掉
    assert.equal(exists(f.oldArt), false, '超龄产物目录应被删除');
    assert.equal(exists(f.oldVer), false, '超龄 _verify 同名抽帧目录应被删除');
    // 不该删的原封不动
    assert.ok(exists(f.newArt), '未超龄产物目录必须保留');
    assert.ok(exists(f.newVer), '未超龄抽帧目录必须保留');
    assert.ok(exists(f.uploads), '_uploads 默认不动');
    assert.ok(exists(path.join(f.uploads, 'user-old.mp4')), '用户素材默认不动（即使超龄）');
    assert.ok(exists(path.join(f.uploads, 'index.json')), '_uploads/index.json 登记表永远保留');
    assert.ok(exists(f.aux), '只读辅助目录 _fonts 默认跳过');
    assert.ok(exists(f.odd), '非产物目录形态默认跳过');
    // 输出含逐个完整路径
    assert.ok(r.out.includes(f.oldArt), '输出应含被删产物目录的完整路径');
    assert.ok(r.out.includes(f.oldVer), '输出应含被删抽帧目录的完整路径');
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('prune-dub：--apply 缺 --older-than ⇒ 报错退出且不删', async () => {
  const f = makeFixture();
  try {
    const r = await runCli(['--apply', '--root', f.dir]);
    assert.notEqual(r.code, 0, '缺阈值 + --apply 必须报错退出（非 0）');
    assert.equal(exists(f.oldArt), true, '报错退出后超龄产物目录必须还在');
    assert.equal(exists(f.oldVer), true, '报错退出后超龄抽帧目录必须还在');
    assert.ok(/older-than/.test(r.out + r.err), '报错信息应点名缺 --older-than');
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('prune-dub：指向 dubRoot 之外的符号链接/junction 被拒（不穿透删真实目标）', async () => {
  const f = makeFixture();
  const outside = path.join(TMP_BASE, `prune-dub-out-${process.pid}-${Date.now().toString(36)}`);
  try {
    fs.mkdirSync(outside, { recursive: true });
    const secret = path.join(outside, 'secret.txt');
    fs.writeFileSync(secret, 'DO-NOT-DELETE', 'utf8');
    // 在 dubRoot 内造一个「产物目录名」的 junction，指向 dubRoot 之外
    const linkName = '20260202-000000-cccc';
    const link = path.join(f.dir, linkName);
    fs.symlinkSync(outside, link, 'junction');

    const r = await runCli(['--apply', '--older-than', '0', '--root', f.dir]);
    assert.equal(r.code, 1, `安全闸拦截应 exit 1\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    assert.ok(exists(secret), 'junction 目标里的真实文件必须完好（不穿透删除）');
    assert.ok(exists(link), '被拒的 junction 本身也不应被删');
    assert.ok(/符号链接|junction|越界/.test(r.out), '输出应说明拒绝原因');
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('prune-dub：--only 带路径成分（../）被拒 ⇒ 用法错误退出且不删', async () => {
  const f = makeFixture();
  try {
    const r = await runCli(['--apply', '--older-than', '0', '--only', '../../etc', '--root', f.dir]);
    assert.equal(r.code, 1, '非法 --only 应 exit 1（用法错误）');
    assert.equal(exists(f.oldArt), true, '非法 --only 时不应删任何东西');
    assert.ok(/--only/.test(r.out + r.err), '报错应点名 --only');
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('prune-dub：--include-uploads 才纳入用户素材（且 index.json 仍保留）', async () => {
  const f = makeFixture();
  try {
    const r = await runCli(['--apply', '--older-than', '30', '--include-uploads', '--root', f.dir]);
    assert.equal(r.code, 0, `退出码应为 0\nstdout:\n${r.out}\nstderr:\n${r.err}`);
    assert.equal(exists(path.join(f.uploads, 'user-old.mp4')), false, '--include-uploads 下超龄用户素材应被删除');
    assert.ok(exists(path.join(f.uploads, 'index.json')), 'index.json 登记表永远保留');
    assert.ok(/用户上传的素材/.test(r.out), '启用该开关时输出应醒目提示「这是用户上传的素材」');
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});
