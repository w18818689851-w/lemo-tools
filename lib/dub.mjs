/**
 * lib/dub.mjs —— 「文案出片」的服务端支撑（控制台侧，**不碰**核心工具 dub.mjs）。
 *
 * 定位：控制台只做三件事 ——
 *   ① 收下用户的口播素材（原始字节流 → 落盘 → 登记进清单）；
 *   ② 把文案的**断句**先给用户核对（出片前唯一能省掉返工的机会）；
 *   ③ 把参数拼成 `node dub.mjs ...` 并交给既有的后台任务队列跑。
 * 真正的合成/剪辑/字幕全在 `D:\lemo-tools\dub.mjs` 里，这里一行都不实现。
 *
 * ★ 两个「不许」：
 *   1. **不许用用户给的文件名拼路径** —— 文件名只进登记表（当展示用），落盘路径永远是
 *      `<UPLOAD_DIR>/<服务端生成的 token>.<白名单扩展名>`。目录穿越因此无从发生。
 *   2. **不许另写一份断句规则** —— 断句的唯一真相源是 dub.mjs。这里优先调它的 `--dry-run`
 *      解析输出；只有解析不了才退回本地实现（见 splitScriptLocal，那是**降级路径**）。
 *
 * ★ 素材落在 `D:\lemo-films\dub\`（**非 C 盘**）：200MB 的口播视频放 C 盘是自找麻烦。
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CFG } from './env.mjs';
// ★ 跨进程写锁（2026-10-10 修 RISK-12）：上传登记表 `_uploads/index.json` 是**跨进程读-改-写** ——
//   控制台只在启动时读一次（loadIndex），之后整个进程生命周期都拿内存副本写盘 ⇒ 多实例 / 面板+脚本
//   并发上传时，后写者**整表覆盖**掉先写者的登记（实测 8 路并发只剩 1 条）。根因修法与 `lib/store.mjs`
//   的 `saveIndex` 一致：**共用同一把锁**（`acquireLock` / `releaseLock`，同一 root ⇒ 同一个
//   `.console/index.lock`），把「重读 → 合并 → 原子写」整段放进锁内。**绝不另写一份锁**。
import { acquireLock, releaseLock } from './store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.resolve(__dirname, '..');

/**
 * 核心工具路径。
 * ★ 默认就是 D:\lemo-tools\dub.mjs（那个由另一个智能体维护的核心工具）。
 *   `LEMO_DUB_TOOL` 只是给「临时换一个实现来验证控制台这一侧的链路」用的逃生口
 *   （例如核心工具还没就绪时，用桩脚本验一遍「提交 → 轮询 → 看日志 → 取成片」这条路），
 *   生产用法永远是默认值 —— 不设这个环境变量时行为完全一样。
 */
export const DUB_TOOL = process.env.LEMO_DUB_TOOL || path.join(TOOLS_DIR, 'dub.mjs');

/** 文案出片的根目录（成片 + 上传素材都在它下面）。 */
export const DUB_ROOT = path.join(CFG.exportDir, 'dub');
/** 口播素材的落盘目录。`_` 开头 = 成片库的目录扫描会自动跳过它（见 server.mjs:apiFilms）。 */
export const UPLOAD_DIR = path.join(DUB_ROOT, '_uploads');

/** 单次上传的体积上限。200MB —— 几分钟的手机竖屏视频够用，再大就该先转码。 */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
/** 口播视频允许的扩展名（小写比较）。 */
export const ALLOWED_EXTS = ['.mp4', '.mov', '.m4v', '.webm'];
/**
 * 字幕时间轴允许的扩展名。
 * ★ 形态 2（--keep-original）用它当字幕的时间轴；`.srt` 是纯文本、几十 KB，
 *   但走的是**同一条**上传通道（同一个 token 登记表），所以限额/清洗/防穿越全部复用。
 */
export const ALLOWED_SRT_EXTS = ['.srt'];
/** 上传接口实际接受的全部扩展名（视频 + 字幕）。 */
export const UPLOAD_EXTS = [...ALLOWED_EXTS, ...ALLOWED_SRT_EXTS];
/** 文案长度上限（字符）。2 万字 ≈ 一小时口播，再多就该拆成多条片子。 */
export const MAX_SCRIPT_CHARS = 20000;
/** 片头标题上限。 */
export const MAX_TITLE_CHARS = 120;
/** 外部语义解析结果（`analysis`）的体积上限（字符）—— 防超大对象把请求体/落盘撑爆。 */
export const MAX_ANALYSIS_CHARS = 200000;

// ── 文件名清洗 ──────────────────────────────────────────────
//
// ★ 清洗的目的**不是**为了拿它拼路径（路径永远用服务端 token），而是：
//   ① 前端要显示「你选的是哪个文件」；② 登记表里留个可读的原始名，方便用户认领。
//   即便如此也要洗 —— 一个叫 `../../windows/win.ini` 的「文件名」出现在界面上就是事故。
export function cleanName(raw) {
  let s = String(raw == null ? '' : raw);
  s = s.replace(/\\/g, '/');                    // 统一分隔符，免得只挡了 / 漏了 \
  s = s.split('/').filter(Boolean).pop() || ''; // 只留最后一段：任何目录成分都被剥掉
  s = s.replace(/\.\./g, '');                   // 兜底：万一 .. 自己成了最后一段
  // 控制字符 + Windows 非法字符（: * ? " < > |）—— 这些名字在资源管理器里也存不下
  s = s.replace(/[\u0000-\u001f]/g, '').replace(/[:*?"<>|]/g, '_');
  s = s.trim();
  if (s.length > 180) s = s.slice(0, 180);      // 防超长名（登记表要能读）
  return s;
}

/** 取小写扩展名（含点）。没有扩展名返回 ''。 */
export function extOf(name) {
  const m = /(\.[A-Za-z0-9]+)$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

/**
 * 上传通道接受的扩展名（视频 **或** 字幕）。
 * @returns {'video'|'srt'|''} '' = 不支持
 */
export function kindOfExt(ext) {
  const e = String(ext || '').toLowerCase();
  if (ALLOWED_EXTS.includes(e)) return 'video';
  if (ALLOWED_SRT_EXTS.includes(e)) return 'srt';
  return '';
}

// ── 上传登记表 ──────────────────────────────────────────────
//
// ★ 为什么要有登记表（而不是「token 拼路径去磁盘上找」）：
//   服务端只认登记过的 token —— token 从请求里来，如果拿它直接拼路径，`../` 之类
//   就能读到任意文件。登记表把「token → 绝对路径」的映射攥在服务端手里，请求里的
//   token 只用于**查表**，查不到就是 400/404。
// ★ 落盘成 index.json：控制台重启后「用已上传的」下拉还在（用户不必重传 200MB）。
const INDEX_FILE = path.join(UPLOAD_DIR, 'index.json');
const MAX_UPLOADS = 200;                 // 登记上限，防无限增长（老的先丢，文件不删）

let indexCache = null;
let indexWriteSeq = 0;      // 原子写的 tmp 序号（见 saveIndex），防同进程连续写撞同一个 tmp 名

// 降级 warn 去重（照 lib/store.mjs 的 warn：同一条只说一次、总量封顶），别让每个请求都刷屏。
const warned = new Set();
function warn(msg) {
  if (warned.has(msg) || warned.size >= 30) return;
  warned.add(msg);
  console.warn(`  ⚠️  [上传登记] ${msg}`);
}

/**
 * 从磁盘**重读**登记表（**不碰** indexCache）。★ 拿锁之后再读，读到的才是「当前」的。
 * @returns {object[]|null} 读不到 / 损坏 ⇒ null（调用方据此退回内存副本，**绝不**把「读不到」当空表）
 */
function readIndexFromDisk() {
  let raw;
  try { raw = fs.readFileSync(INDEX_FILE, 'utf8'); }
  catch (e) { return e.code === 'ENOENT' ? [] : null; }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((e) => e && typeof e.token === 'string' && typeof e.path === 'string');
  } catch { return null; }
}

function loadIndex() {
  if (indexCache) return indexCache;
  const disk = readIndexFromDisk();
  indexCache = disk || [];   // 没有 / 坏了都当空表：登记表不是关键数据，丢了只是下拉里少几条
  return indexCache;
}

function saveIndex() {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    // ★ 原子写（照 lib/store.mjs 的范式，2026-10-09 修 D1）：**先写 tmp 再 rename**，
    //   绝不裸写 INDEX_FILE。原因：裸 `writeFileSync` 会**先截断再写** —— 控制台被 Ctrl+C / 被杀
    //   恰逢写索引时，index.json 会留下**被截断的中间态**，`loadIndex` 解析失败**降级成空表**
    //   ⇒ 下拉里已上传的素材全部消失（用户看到的「数据丢失」）。rename 是原子的：写完的路径
    //   只会是「旧文件」或「新文件」，不存在半截文件。
    // ★ tmp 名带 pid + 序号：两个进程若共用同一个 `.tmp`，会互相 rename 抢（实测 EPERM，见 store.mjs:375-377），
    //   带 pid 后各写各的 tmp，至少不会互相打断。
    const tmp = `${INDEX_FILE}.${process.pid}.${(indexWriteSeq += 1)}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(indexCache || [], null, 2), 'utf8');
      fs.renameSync(tmp, INDEX_FILE);      // Windows 上 Node 的 rename 会覆盖已存在的目标
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* 别留半个 tmp */ }
      throw e;
    }
  } catch { /* 落盘失败不影响本次会话（内存里还在），下次重启少几条而已 */ }
}

function randHex(n) {
  let s = '';
  const hex = '0123456789abcdef';
  for (let i = 0; i < n; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

/** 生成一个不可猜的 token（时间戳 + 随机串）：既是文件名，也是登记表的键。 */
export function newToken() {
  return `${Date.now().toString(36)}${randHex(8)}`;
}

/** 把一个已落盘的素材登记进清单。entry.path 由服务端生成，**不来自请求**。 */
export function registerUpload(entry) {
  const kind = entry.kind || kindOfExt(extOf(entry.name)) || 'video';
  const item = {
    token: entry.token,
    name: entry.name,
    size: entry.size,
    path: entry.path,
    at: entry.at || Date.now(),
    kind,                                   // 'video' | 'srt' —— 前端按它分两个下拉
  };
  // ★★ 跨进程「读-改-写」必须**整段在锁内**（2026-10-10 修 RISK-12）。
  //   锁与**降级语义**照抄 `lib/store.mjs` 的 `saveIndex`：`acquireLock` 有界等待，**拿不到也照常
  //   「重读 + 合并」后写**、只多一条 warn —— 本模块的纪律同样是「绝不阻塞上传」，宁可有竞态窗口
  //   也不能让一次上传卡死（代价：极端并发下对方的登记**可能**被覆盖，与 store 的取舍一致）。
  const locked = acquireLock();
  if (!locked) warn('登记表没拿到跨进程锁（另一实例正在写）→ 仍会「重读 + 合并」后写，但「读盘 → 原子写」之间有竞态窗口，对方的登记可能被覆盖');
  try {
    // ── 拿锁之后再读盘（读到的才是「当前」的），以**它**为基准合并本进程这条登记 ──
    const disk = readIndexFromDisk();
    const base = disk ? disk.slice() : loadIndex().slice();   // 读不到 ⇒ 退回内存副本（绝不误当空表）
    // ★ 按 token 去重：重放 / 并发不会把同一条登记写两遍
    if (!base.some((e) => e && e.token === item.token)) base.push(item);
    indexCache = base.slice(-MAX_UPLOADS);
    saveIndex();
  } finally {
    if (locked) releaseLock();
  }
  return indexCache[indexCache.length - 1];
}

/** 已登记的素材，**且文件确实还在**（用户手动删了目录里就自动消失，不留死链）。 */
export function listUploads() {
  const list = loadIndex();
  const alive = list.filter((e) => {
    try { return fs.statSync(e.path).isFile(); } catch { return false; }
  });
  // ★ 老登记项（加 kind 之前写下的）按扩展名补一个 —— 否则前端两个下拉都拿不到它
  return alive
    .map((e) => ({ ...e, kind: e.kind || kindOfExt(extOf(e.path)) || 'video' }))
    .sort((a, b) => b.at - a.at);         // 新的在前
}

/**
 * 按 token 查素材。★ 只查表，**绝不**拿 token 拼路径。
 * @returns {{token,name,size,path,at}|null}
 */
export function getUpload(token) {
  const t = String(token == null ? '' : token).trim();
  if (!t) return null;
  return listUploads().find((e) => e.token === t) || null;
}

/** GET /api/dub/sources 的响应体。 */
export function uploadsPayload() {
  // ★ `disk` = dub 产物的**占用概览**（RISK-10，只读上报，绝不在这里删除 —— 见 dubDiskUsage）。
  return { ok: true, uploads: listUploads(), dir: UPLOAD_DIR, disk: dubDiskUsage() };
}

// ── dub 产物的磁盘占用（RISK-10：只统计、**不删除**）──────────
//
// ★ 由来（2026-10-10）：`dub/` 下的成片目录（`newOutDir()` = `<时间戳>-<短id>`）与校验抽帧目录
//   （`_verify/<成片目录名>`）**没有任何保留策略**，跑久了只增不减。本项目的保留策略工具
//   `scripts/prune-jobs.mjs` **只管 `_jobs/`**（控制台任务产物），**不覆盖** dub 产物。
// ★ 本模块**只做到「如实报出占用」**（`GET /api/dub/sources` 响应里带 `disk`），**绝不自动删除** ——
//   删的是用户的成片，属高危动作，必须先让人知情（保留策略要像 prune-jobs 那样单独立项 + 安全闸）。
function dirSizeBytes(dir) {
  let sum = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) sum += dirSizeBytes(p);
    else { try { sum += fs.statSync(p).size; } catch { /* ignore */ } }
  }
  return sum;
}

function countEntries(dir, wantDir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => (wantDir ? e.isDirectory() : e.isFile())).length;
  } catch { return 0; }
}

/**
 * `dub/` 的占用概览：成片目录数 / 上传素材数 / 校验帧目录数 及各自字节数。
 * ★ 纯只读（readdir + stat），任何异常都降级为 0，绝不抛出、绝不删除。
 */
export function dubDiskUsage() {
  let outCount = 0, outBytes = 0;
  let uploadBytes = 0;
  let verifyCount = 0, verifyBytes = 0;
  let entries = [];
  try { entries = fs.readdirSync(DUB_ROOT, { withFileTypes: true }); } catch { /* 根还没建 ⇒ 全 0 */ }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const p = path.join(DUB_ROOT, ent.name);
    if (ent.name === '_uploads') { uploadBytes = dirSizeBytes(p); continue; }
    if (ent.name === '_verify') { verifyCount = countEntries(p, true); verifyBytes = dirSizeBytes(p); continue; }
    if (ent.name.startsWith('_') || ent.name.startsWith('.')) continue;   // _fonts / _visual-tmp 等辅助目录不计入成片
    outCount += 1;
    outBytes += dirSizeBytes(p);
  }
  const uploadCount = countEntries(UPLOAD_DIR, false);   // 上传素材文件数（含 index.json）
  return {
    root: DUB_ROOT,
    out: { count: outCount, bytes: outBytes },             // 成片目录 dub/<时间戳>-<id>
    uploads: { count: uploadCount, bytes: uploadBytes },   // 上传素材 dub/_uploads
    verify: { count: verifyCount, bytes: verifyBytes },    // 校验抽帧 dub/_verify/<目录名>
    totalBytes: outBytes + uploadBytes + verifyBytes,
  };
}

// ── 风格注册表 / 语义解析（转发给 lib/dub-semantic.mjs）────────
//
// ★ **不在这里另读 dub-styles.json，也不另写一份风格表** —— 风格与语义的唯一真相源是
//   `lib/dub-semantic.mjs`（loadStyles / analyze）。这里只做三件事：
//     ① 把它 **动态** import 进来（那个文件由另一个智能体维护，可能比控制台晚就位；
//        静态 import 会让整个 server.mjs 起不来 —— 那是拿一个可选功能换掉整个控制台）；
//     ② 把它的返回值**洗成接口契约的形状**；
//     ③ 它不在 / 挂了时，如实降级并**明说**（不假装风格表读到了）。
// ★ 降级只降「风格/语义」这一块：`plain-dark`（= 不指定风格，等于现在的外观）永远可用，
//   所以卡片在语义模块没就位时照样能出片，只是没有风格可选。

const SEMANTIC_FILE = 'dub-semantic.mjs';
const SEMANTIC_RETRY_MS = 10000;      // 加载失败后 10 秒内不再重试（别让每个请求都去碰一次磁盘）

let semanticMod = null;               // 加载成功的模块（缓存）
let semanticFailedAt = 0;             // 上次加载失败的时间戳

/** 「不指定风格」这一档的兜底定义（语义模块没就位时唯一可用的一项）。 */
const PLAIN_DARK_FALLBACK = {
  id: 'plain-dark',
  cn: '不指定（保持现有外观）',
  desc: '不加风格：画面、字幕、叠加层都保持现在的样子。',
  tags: {},
  source: 'builtin',
};

/** 动态加载语义模块。拿不到就返回 null（**不抛**）。 */
async function semanticModule() {
  if (semanticMod) return semanticMod;
  const now = Date.now();
  if (semanticFailedAt && now - semanticFailedAt < SEMANTIC_RETRY_MS) return null;
  try {
    const m = await import('./' + SEMANTIC_FILE);
    if (!m || typeof m.loadStyles !== 'function' || typeof m.analyze !== 'function') {
      semanticFailedAt = now;
      return null;
    }
    semanticMod = m;
    return m;
  } catch {
    semanticFailedAt = now;
    return null;
  }
}

const STYLE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

/** 把 loadStyles() 的返回值洗成 `{default, styles:[{id,cn,desc,tags,source}]}`。 */
function normalizeStyles(raw) {
  const obj = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const arr = Array.isArray(raw) ? raw : (Array.isArray(obj.styles) ? obj.styles : []);
  const styles = [];
  for (const s of arr) {
    if (!s || typeof s !== 'object') continue;
    const id = typeof s.id === 'string' ? s.id.trim() : '';
    if (!id || !STYLE_ID_RE.test(id)) continue;
    styles.push({
      id,
      cn: typeof s.cn === 'string' && s.cn ? s.cn : id,
      desc: typeof s.desc === 'string' ? s.desc : '',
      tags: (s.tags && typeof s.tags === 'object') ? s.tags : {},
      source: typeof s.source === 'string' && s.source ? s.source : 'registry',
    });
  }
  const def = (typeof obj.default === 'string' && styles.some((s) => s.id === obj.default))
    ? obj.default : 'plain-dark';
  return { default: def, styles };
}

/**
 * GET /api/dub/styles 的响应体。
 * @returns {Promise<{ok:true,default:string,styles:object[],source?:string,notReady?:boolean,note?:string}>}
 */
export async function stylesPayload() {
  const m = await semanticModule();
  if (m) {
    try {
      const n = normalizeStyles(m.loadStyles());
      if (n.styles.length) {
        // ★ plain-dark 必须在表里（契约规定它代表「不指定」）；没有就补上，免得用户无从选回原样
        if (!n.styles.some((s) => s.id === 'plain-dark')) n.styles.unshift({ ...PLAIN_DARK_FALLBACK });
        return { ok: true, default: n.default, styles: n.styles, source: 'lib/' + SEMANTIC_FILE };
      }
    } catch (e) {
      return {
        ok: true, default: 'plain-dark', styles: [{ ...PLAIN_DARK_FALLBACK }],
        source: 'builtin', notReady: true,
        note: `风格表读取失败（${String(e && e.message || e)}）—— 暂时只能「不指定风格」。`,
      };
    }
  }
  return {
    ok: true, default: 'plain-dark', styles: [{ ...PLAIN_DARK_FALLBACK }],
    source: 'builtin', notReady: true,
    note: `风格与语义模块还没就绪（找不到或加载不了 lib/${SEMANTIC_FILE}）——`
      + '风格下拉暂时只有「不指定（保持现有外观）」，出片不受影响。',
  };
}

/**
 * POST /api/dub/analyze 的实现：转发给语义模块。
 * @returns {Promise<object>} 语义模块的原始返回；模块不在时 `{ok:false,notReady:true,error}`（**不抛**）
 */
export async function analyzeScript({ text, styleIds, analysis }) {
  const m = await semanticModule();
  if (!m) {
    return {
      ok: false, notReady: true,
      error: `语义解析模块还没就绪（找不到或加载不了 lib/${SEMANTIC_FILE}）—— 分析功能要等它就位。`,
    };
  }
  try {
    // ★ 2026-10-04 补：`analysis` 是**外部（WorkBuddy 智能体）产出的语义解析结果**。
    //   设计上「通用语义推理由智能体承担，本模块不调任何本机模型」⇒ 控制台必须能把外部结果**注入**进来，
    //   否则控制台只能用规则路（词表打分），拿不到智能体级的段落/角色划分。
    //   CLI 侧早就有 `--analysis`（`dub.mjs --analysis <file>`），控制台此前**没有对应入口** ——
    //   而 `/api/dub/analyze` 的注释却已经写着「也可由外部注入结果（source:'external'）」⇒ 文档先于实现。
    const r = await m.analyze({
      text,
      ...(styleIds ? { styleIds } : {}),
      ...(analysis && typeof analysis === 'object' && !Array.isArray(analysis) ? { analysis } : {}),
    });
    return (r && typeof r === 'object') ? r : { ok: false, error: '语义解析返回了空结果' };
  } catch (e) {
    // ★ 契约说 analyze() 自己会降级、不抛异常；真抛了也不能让 500 把整张卡片打死 —— 原样回报。
    return { ok: false, error: `语义解析异常：${String(e && e.message || e)}` };
  }
}

/** 风格 id 是否在册（供 /api/dub/run 校验用）。'auto' 与 '' 单独处理，不走这里。 */
export async function styleIds() {
  const p = await stylesPayload();
  return p.styles.map((s) => s.id);
}

// ── 断句预览 ────────────────────────────────────────────────
//
// ★ 断句规则的**唯一真相源是 dub.mjs**。前端不写一份、这里也不该写一份 ——
//   两处规则必然漂移，而漂移的后果很隐蔽：预览说切 12 句，出片切成 9 句，
//   字幕和画面对不上，用户还以为是「工具抽风」。
//   所以正常路径是：调 `node dub.mjs --script - --dry-run`，把它的计划解析出来。
// ★ 但 dub.mjs 可能还没就绪 / 输出格式变了 —— 那时退回本地实现（splitScriptLocal）。
//   ⚠️ 本地实现是**降级路径**，规则可能与 dub.mjs 不一致（它只按任务书给的三条规则写）。
//   降级时前端会**明确标出来**，不会假装这就是出片时会用的断句。

const DRY_RUN_TIMEOUT_MS = 30000;

/** 比较用：去掉空白与标点，只留「实字」。 */
function stripForCompare(s) {
  return String(s == null ? '' : s)
    .replace(/[\s，。！？；、,.!?;:："'“”‘’（）()【】\[\]《》—–\-…~·|]/g, '');
}

/**
 * 从 dub.mjs `--dry-run` 的输出里抠出断句。
 *
 * 认三种形态（按可靠性排序）：
 *   ① 断句结果块：`    l1  15字  春天一到，城市里最先醒的是树。` —— dub.mjs 现在的真实格式；
 *   ② 一段 JSON（含 lines 数组）—— 万一以后改成打 JSON；
 *   ③ 通用编号行：`[1] 文本` / `1. 文本` / `1、文本`。
 * ★ 抠完必须**核对**：拼起来的实字要和**用户原文**的实字逐字相等，否则一律当解析失败。
 *   宁可退回降级实现，也不能把一份错的断句摆给用户看 —— 断句错了要重跑一遍配音。
 *   （所以这里必须拿原文来比，不能拿「输出里有没有这段」来比：输出里每行前面还有
 *     `l1  15字` 这类噪声，拼接后不可能在输出里连续出现。）
 * @param {string} stdout
 * @param {string} script 用户原文（核对用）
 * @returns {{i:number,text:string}[]|null}
 */
export function parseDryRunOutput(stdout, script) {
  const text = String(stdout || '');
  const want = stripForCompare(script);

  const tryAccept = (lines) => {
    if (!lines || !lines.length) return null;
    const joined = stripForCompare(lines.map((l) => l.text).join(''));
    if (!joined) return null;
    // 有原文就与原文比（严格）；没有原文（理论上不会）才退一步在输出里找
    if (want) return joined === want ? lines : null;
    return stripForCompare(text).includes(joined) ? lines : null;
  };

  // ① 断句结果块：`l<序号>  <N>字  <文本>`
  const lLines = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*l\s*(\d{1,4})\s+\d+\s*字\s+(.+?)\s*$/.exec(raw);
    if (!m) continue;
    const t = m[2].trim();
    if (t) lLines.push({ i: Number(m[1]), text: t });
  }
  const ok1 = tryAccept(lLines);
  if (ok1) return ok1;

  // ② JSON：找第一个 { 到最后一个 } 之间能 parse 的最大块
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const obj = JSON.parse(text.slice(first, last + 1));
      const arr = Array.isArray(obj) ? obj : (Array.isArray(obj.lines) ? obj.lines : null);
      if (arr && arr.length) {
        const lines = [];
        let bad = false;
        for (let k = 0; k < arr.length; k++) {
          const it = arr[k];
          const t = typeof it === 'string' ? it : (it && (it.text ?? it.line ?? it.sentence));
          if (typeof t !== 'string' || !t.trim()) { bad = true; break; }
          lines.push({ i: Number.isInteger(it && it.i) ? it.i : k + 1, text: t.trim() });
        }
        if (!bad) {
          const ok2 = tryAccept(lines);
          if (ok2) return ok2;
        }
      }
    } catch { /* 不是 JSON，走下面那一路 */ }
  }

  // ③ 通用编号行：`[1] 大家好。` / `1. 大家好。` / `1、大家好。` / `1 大家好。`
  const numLines = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*(?:\[\s*)?(\d{1,4})\s*[\]).、:：\-–]?\s*(\S.*?)\s*$/.exec(raw);
    if (!m) continue;
    const t = m[2].trim();
    if (!t) continue;
    if (/^\d/.test(t)) continue;          // 「0.00–1.20s …」这类时间轴行，不是正文
    numLines.push({ i: Number(m[1]), text: t });
  }
  return tryAccept(numLines);
}

/**
 * 调 dub.mjs 的 --dry-run 拿断句。
 * @returns {Promise<{i:number,text:string}[]|null>} null = 拿不到（工具不在 / 超时 / 解析不了）
 */
function previewViaTool(script) {
  return new Promise((resolve) => {
    if (!fs.existsSync(DUB_TOOL)) return resolve(null);

    let child;
    try {
      child = spawn(process.execPath, [DUB_TOOL, '--script', '-', '--dry-run'], {
        cwd: TOOLS_DIR, windowsHide: true,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      });
    } catch { return resolve(null); }

    let out = '';
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { if (child && !child.killed) child.kill(); } catch { /* ignore */ }
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), DRY_RUN_TIMEOUT_MS);

    child.stdout?.on('data', (d) => { out += d.toString('utf8'); });
    child.stderr?.on('data', () => { /* 计划可能打在 stderr，也可能只是噪声；这里只认 stdout */ });
    child.on('error', () => finish(null));
    child.on('close', (code) => {
      if (code !== 0) return finish(null);
      finish(parseDryRunOutput(out, script));
    });

    // `--script -` = 从 stdin 读，写完就关（不关的话工具会一直等）
    try { child.stdin.end(String(script), 'utf8'); } catch { /* ignore */ }
  });
}

/**
 * ⚠️ 降级路径：本地断句实现。
 * 规则按任务书：优先按换行 → 没换行按 `。！？；` 切 → 单句 > 40 字再按 `，` 二次切。
 * ★ 这是**兜底**，不是真相源。只有在 dub.mjs 不在 / 输出解析不了的时候才会用到，
 *   返回值里会带 `source: 'fallback'` 让界面如实说明「这不是出片时一定会用的断句」。
 */
export const SOFT_BREAK_CHARS = 40;
const HARD_BREAKS = '。！？；';
const SOFT_BREAKS = '，';

function splitKeeping(text, chars) {
  const res = [];
  let buf = '';
  for (const ch of text) {
    buf += ch;
    if (chars.includes(ch)) { res.push(buf); buf = ''; }
  }
  if (buf.trim()) res.push(buf);
  return res;
}

export function splitScriptLocal(script) {
  const src = String(script == null ? '' : script).replace(/\r\n?/g, '\n');
  const out = [];
  for (const rawLine of src.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    for (const hard of splitKeeping(line, HARD_BREAKS)) {
      const t = hard.trim();
      if (!t) continue;
      if (t.length > SOFT_BREAK_CHARS) {
        for (const soft of splitKeeping(t, SOFT_BREAKS)) {
          const s = soft.trim();
          if (s) out.push(s);
        }
      } else {
        out.push(t);
      }
    }
  }
  return out;
}

/**
 * 断句预览（POST /api/dub/preview 的实现）。
 * @returns {Promise<{lines:{i:number,text:string}[], count:number, source:string, note:string}>}
 */
export async function previewScript(script) {
  const viaTool = await previewViaTool(script);
  if (viaTool && viaTool.length) {
    return {
      lines: viaTool,
      count: viaTool.length,
      source: 'dub.mjs --dry-run',
      note: '断句来自核心工具 dub.mjs 的计划输出（与出片时一致）。',
    };
  }
  const local = splitScriptLocal(script).map((t, k) => ({ i: k + 1, text: t }));
  return {
    lines: local,
    count: local.length,
    source: 'fallback',
    note: '⚠️ 这是控制台的**降级断句**（没能从 dub.mjs --dry-run 拿到计划）：'
      + '规则可能与出片时不完全一致，仅供参考。',
  };
}

// ── 出片参数校验 ────────────────────────────────────────────
//
// ★ 形状校验放在服务端（而不是只靠前端）：前端是给人看的，接口是给机器调的。
//   坏值喂给 dub.mjs 的表现是「跑到一半报个看不懂的错」，比在这里 400 难查得多。
const VOICE_RE = /^[A-Za-z0-9._-]{1,40}$/;
const SIZE_RE = /^\d+x\d+$/;
const FIT_SET = new Set(['loop', 'trim', 'slow']);

/**
 * 校验 POST /api/dub/run 的请求体。
 * @returns {{ok:true,value:object}|{ok:false,error:string}}
 */
export function validateRunBody(body) {
  const b = (body && typeof body === 'object') ? body : {};

  // ① 文案：必填、非空、有上限
  if (typeof b.script !== 'string') return { ok: false, error: 'script 必须是字符串' };
  if (!b.script.trim()) return { ok: false, error: 'script 不能为空（先粘贴一段文案）' };
  if (b.script.length > MAX_SCRIPT_CHARS) {
    return { ok: false, error: `script 过长：${b.script.length} 字（上限 ${MAX_SCRIPT_CHARS}）` };
  }

  const value = { script: b.script, videoToken: '', bgToken: '', title: '' };

  // ② 素材 token：只做形状校验，能不能查到由调用方查登记表（这里不碰磁盘）
  for (const key of ['videoToken', 'bgToken']) {
    const raw = b[key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(raw)) {
      return { ok: false, error: `${key} 形状非法：${String(raw).slice(0, 60)}` };
    }
    value[key] = raw;
  }

  // ②' 字幕时间轴 token（形态 2 的可选 SRT）：与素材 token 同一套形状校验
  if (b.srtToken !== undefined && b.srtToken !== null && b.srtToken !== '') {
    if (typeof b.srtToken !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(b.srtToken)) {
      return { ok: false, error: `srtToken 形状非法：${String(b.srtToken).slice(0, 60)}` };
    }
    value.srtToken = b.srtToken;
  }

  // ②''' 外部语义解析结果（可选）：★ 2026-10-04 补。
  //   设计上「通用语义推理由 WorkBuddy 智能体承担，本工具不调任何本机模型」⇒ 控制台要能把
  //   智能体产出的 `{theme,emotion,pace,scene,segments[{text,role}]}` 注入进来（CLI 侧是 `--analysis`）。
  //   这里只做**形状校验**（必须是对象）；语义是否合法、segments 拼回是否等于原文，由
  //   `lib/dub-semantic.mjs#normalizeExternal` 判（它会拒绝并记「疑似改字」）—— 不在这里重复实现。
  if (b.analysis !== undefined && b.analysis !== null && b.analysis !== '') {
    if (typeof b.analysis !== 'object' || Array.isArray(b.analysis)) {
      return { ok: false, error: 'analysis 必须是对象（{theme,emotion,pace,scene,segments}）' };
    }
    if (JSON.stringify(b.analysis).length > MAX_ANALYSIS_CHARS) {
      return { ok: false, error: `analysis 过大：${JSON.stringify(b.analysis).length} 字符（上限 ${MAX_ANALYSIS_CHARS}）` };
    }
    value.analysis = b.analysis;
  }

  // ②'' 风格：省略 / 'auto' / 一个风格 id。
  //   ★ 这里只校验**形状**，id 在不在册由调用方查 /api/dub/styles（本函数是同步的，不碰磁盘/模块）。
  //   ★ 省略时 value.style 保持 undefined —— 组装参数时**不传 --style**，行为与加这个功能之前完全一样。
  if (b.style !== undefined && b.style !== null && b.style !== '') {
    if (typeof b.style !== 'string') return { ok: false, error: 'style 必须是字符串（auto 或风格 id）' };
    const s = b.style.trim();
    if (s !== 'auto' && !STYLE_ID_RE.test(s)) {
      return { ok: false, error: `style 形状非法：${s.slice(0, 60)}` };
    }
    value.style = s;
  }

  // ②''' 形态 2：不动素材（画面/声音/时长全保留），只叠字幕与叠加层
  if (b.keepOriginal !== undefined && b.keepOriginal !== null) {
    if (typeof b.keepOriginal !== 'boolean') {
      return { ok: false, error: `keepOriginal 必须是布尔值（收到 ${typeof b.keepOriginal}）` };
    }
    value.keepOriginal = b.keepOriginal;
  }
  // ★ 形态 2 的成立条件是「有素材」：没素材就没什么可「保持原样」的，直接拦住
  if (value.keepOriginal === true && !value.videoToken) {
    return { ok: false, error: 'keepOriginal=true 时必须同时给 videoToken（形态 2 = 文案 + 口播视频，没素材不成立）' };
  }

  // ② 形态 2 的可选限幅（--keep-original-limit）：只认真正的布尔
  if (b.keepOriginalLimit !== undefined && b.keepOriginalLimit !== null) {
    if (typeof b.keepOriginalLimit !== 'boolean') {
      return { ok: false, error: `keepOriginalLimit 必须是布尔值（收到 ${typeof b.keepOriginalLimit}）` };
    }
    value.keepOriginalLimit = b.keepOriginalLimit;
  }
  // ★ 语义：这个开关限的是「保持原样」那条音轨 ⇒ 只有 keepOriginal=true 时才有意义。
  //   没开 keepOriginal 就带上它，等于用户以为压了峰、实际没有 —— 拦住而不是静默忽略。
  if (value.keepOriginalLimit === true && value.keepOriginal !== true) {
    return { ok: false, error: 'keepOriginalLimit=true 只在 keepOriginal=true 时才有意义（它限的是"保持原样"那条音轨）；请同时给 keepOriginal，或去掉本开关' };
  }

  // ③ 音色
  if (b.voice !== undefined && b.voice !== null && b.voice !== '') {
    if (typeof b.voice !== 'string' || !VOICE_RE.test(b.voice)) {
      return { ok: false, error: `voice 非法（只允许 A-Za-z0-9._- ，1–40 字符）：${String(b.voice).slice(0, 60)}` };
    }
    value.voice = b.voice;
  }

  // ④ 语速 0.5–2
  if (b.speed !== undefined && b.speed !== null && b.speed !== '') {
    const n = Number(b.speed);
    if (!Number.isFinite(n) || n < 0.5 || n > 2) {
      return { ok: false, error: `speed 非法：必须是 0.5–2 之间的数字（收到 ${String(b.speed)}）` };
    }
    value.speed = Math.round(n * 100) / 100;
  }

  // ⑤ 尺寸 WxH（还要是正整数，防 0x0 / 12x999999）
  if (b.size !== undefined && b.size !== null && b.size !== '') {
    const s = String(b.size).trim();
    if (!SIZE_RE.test(s)) return { ok: false, error: `size 非法：必须是 WxH 形状（收到 ${s.slice(0, 40)}）` };
    const [w, h] = s.split('x').map(Number);
    if (!(w > 0 && h > 0) || w > 8192 || h > 8192) {
      return { ok: false, error: `size 越界：${s}（宽高需 1–8192）` };
    }
    value.size = `${w}x${h}`;
  }

  // ⑥ 句间停顿 0–3
  if (b.gap !== undefined && b.gap !== null && b.gap !== '') {
    const n = Number(b.gap);
    if (!Number.isFinite(n) || n < 0 || n > 3) {
      return { ok: false, error: `gap 非法：必须是 0–3 之间的数字（收到 ${String(b.gap)}）` };
    }
    value.gap = Math.round(n * 100) / 100;
  }

  // ⑦ 素材适配
  if (b.fit !== undefined && b.fit !== null && b.fit !== '') {
    const f = String(b.fit);
    if (!FIT_SET.has(f)) {
      return { ok: false, error: `fit 非法：只能是 loop / trim / slow 之一（收到 ${f.slice(0, 40)}）` };
    }
    value.fit = f;
  }

  // ⑧ 保留原声：只认真正的布尔
  if (b.keepOriginalAudio !== undefined && b.keepOriginalAudio !== null) {
    if (typeof b.keepOriginalAudio !== 'boolean') {
      return { ok: false, error: `keepOriginalAudio 必须是布尔值（收到 ${typeof b.keepOriginalAudio}）` };
    }
    value.keepOriginalAudio = b.keepOriginalAudio;
  }

  // ⑨ 片头标题
  if (b.title !== undefined && b.title !== null && b.title !== '') {
    if (typeof b.title !== 'string') return { ok: false, error: 'title 必须是字符串' };
    if (b.title.length > MAX_TITLE_CHARS) {
      return { ok: false, error: `title 过长：${b.title.length} 字（上限 ${MAX_TITLE_CHARS}）` };
    }
    value.title = b.title;
  }

  return { ok: true, value };
}

// ── 输出目录 / 成片文件 ─────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0'); }

/**
 * 造一个本次出片的输出目录：`D:\lemo-films\dub\<时间戳>-<短id>`。
 * 目录**先建好** —— dub.mjs 只管往里写，不该由它负责猜父目录存不存在。
 */
export function newOutDir() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
    + `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  const name = `${stamp}-${randHex(4)}`;
  const dir = path.join(DUB_ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  return { name, dir };
}

/**
 * 出片产物的对外取用路径。
 * ★ 走的是**成片库那条路**（`/api/films/dub/<目录>/<文件>`），而不是再开一条 dub 专用接口 ——
 *   取片只需要一条路径，两处判据迟早漂移（校验在 server.mjs:apiDubFilmFile，与 apiFilmFile 同一套写法）。
 */
function filmUrl(outName, file = 'film.mp4') {
  return `/api/films/dub/${encodeURIComponent(String(outName || ''))}/${encodeURIComponent(file)}`;
}

/** 本次出片的产物清单（与 dub.mjs 的契约一致）。 */
export function outArtifacts(outDir) {
  const name = path.basename(outDir);
  return {
    dir: outDir,
    name,
    film: path.join(outDir, 'film.mp4'),
    srt: path.join(outDir, 'film.srt'),
    lines: path.join(outDir, 'lines.json'),
    dur: path.join(outDir, 'dur.json'),
    timeline: path.join(outDir, 'timeline.json'),
    script: path.join(outDir, 'script.txt'),
    // ★ 成片 URL 由服务端给（前端不硬编码路径形状）—— 前端拿它直接喂播放器
    filmUrl: filmUrl(name),
  };
}

/** 启动日志用：这条路是否就绪（核心工具在不在）。 */
export function dubStatus() {
  const toolReady = fs.existsSync(DUB_TOOL);
  return {
    root: DUB_ROOT,
    uploadDir: UPLOAD_DIR,
    tool: DUB_TOOL,
    toolReady,
    maxUploadBytes: MAX_UPLOAD_BYTES,
    uploads: listUploads().length,
    disk: dubDiskUsage(),      // ★ RISK-10：dub 产物占用概览（只读上报，不删除）
  };
}
