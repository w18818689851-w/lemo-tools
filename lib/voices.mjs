// lib/voices.mjs —— 「音色清单」的**只读代理**（控制台侧）
//
// ★ 为什么要有这个文件：控制台的「声音」版块要列出可用音色、试听参考音、还能真的合成一句
//   试听。但**音色的唯一真相源是库** —— D:\lemo-opuscar\core\tts\tts_indextts.py 的
//   `--list-voices`（它同时掌握：别名表 VOICE_ALIASES / LIB_ALIASES、官方参考音目录、
//   用户音色库目录、以及每个参考音的存在性与电平）。
//   控制台**绝不另抄一份别名表**：库里加一个别名，控制台要是自己硬编码就必然漂移 ——
//   面板上看得见、真出片时却报 unknown voice，是最难查的一类故障。
//   所以这里只做一件事：跑那个脚本、把它吐的 JSON 原样代理出去（`voices` 一条不改）。
//
// ★ 与 lib/sizes.mjs / lib/langs.mjs 同一条纪律：**只读** —— 本模块不往库里写任何东西。
//   唯一写盘的地方是「试听」用的临时文件（`TEST_TMP_DIR`，见下方定义：默认 `<CFG.tmpDir>/voicetest`，
//   可由覆盖点 `LEMO_VOICE_TEST_TMP` 改；★ 此处**不写死绝对路径**，免得覆盖点改了、注释还停在旧值），
//   落在库外，且是临时物。★ 2026-10-08 复核：「唯一」不成立 —— 本模块另有两处落盘点：试听**产物**目录 `VOICE_TEST_DIR`（`CFG.exportDir/_voicetest`，见下方 :52 定义、:325 建目录、:334-335 写产物；本文件 :294-295 也已自承它是「另一半」）与导入脚本临时目录 `IMPORT_TMP_DIR`（`<CFG.tmpDir>/voiceimport`，见下方 :383 定义、:547 建目录）；三处均在**库外** ⇒「只读（本模块不往库里写任何东西）」的结论仍成立，错的只是「唯一」这个词。
//
// ★ 调用脚本用**任意** python 即可：`--list-voices` 不加载模型、不 import torch，几秒返回。
//   所以这里不假定某个固定解释器路径，而是按候选表逐个试（见 pythonCandidates）。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { CFG } from './env.mjs';
// ★ 风格源码根的唯一解析实现（纯函数）—— 与 lib/aspects.mjs / lib/briefs.mjs / lib/env.mjs 同一处。
import { resolveStylesRoot } from './styles-root.mjs';

// 清单脚本（库侧）。★ 路径来自 CFG.winLib，不另写一份。
const TTS_PY = path.join(CFG.winLib, 'core', 'tts', 'tts_indextts.py');

// 「当前用的音色」从哪读：engraving 风格的 demo 内容文件。
// ★ 为什么是它：用户实际听到的配音就是这个 demo 出的片，面板上标出「当前内容用的是哪个音色」
//   才让「试听」有的放矢（否则用户不知道自己在跟什么对比）。中文版优先，没有就退回英文版。
// ★ 风格源码根**不自己算一份**：走唯一来源 resolveStylesRoot()（它支持 `LEMO_STYLES_ROOT` 覆盖）。
//   否则设了覆盖点时，闸门/工单看假树、这里还在看真树 —— 同一棵树两条来源。
const CONTENT_DIR = path.join(resolveStylesRoot(CFG.winLib), 'engraving', 'demo');
const CONTENT_FILES = ['content_coffee.zh.json', 'content_coffee.json'];

/** 分组顺序与标题（UI 就按这个顺序渲染）。id 与库侧 kind 取值一一对应。 */
export const VOICE_GROUPS = [
  { id: 'alias', label: '别名（推荐）' },
  { id: 'library-alias', label: '我的音色库' },
  { id: 'official', label: '官方参考音' },
  { id: 'library', label: '音色库里的其它 wav' },
];

/** 试听合成的默认文本（约 24 字，便于判断语速）与默认语速。 */
export const DEFAULT_TEST_TEXT = '咖啡豆其实是一枚种子，它从埃塞俄比亚出发，走遍了整个世界。';
export const DEFAULT_TEST_SPEED = 1.1;

/** 试听产物落点（非 C 盘，与成片目录同盘，避免占系统盘）。 */
export const VOICE_TEST_DIR = path.join(CFG.exportDir, '_voicetest');

const CACHE_TTL_MS = 30000;
const LIST_TIMEOUT_MS = 60000;

// ── python 解释器候选 ───────────────────────────────────────
//
// ★ 为什么不写死路径：这台机器上 `python` 恰好指向 WorkBuddy 自带的那份，但用户机器上不一定。
//   `--list-voices` 对解释器版本没要求（只用标准库），所以「能跑就行」——
//   按「显式指定 → 本机已知位置 → PATH」的顺序试，第一个能返回合法 JSON 的胜出。
function pythonCandidates() {
  const out = [];
  const explicit = process.env.LEMO_VOICES_PYTHON || process.env.LEMO_PYTHON;
  if (explicit) out.push(explicit);

  // WorkBuddy 自带的便携 python：versions/<版本>/python.exe，取版本号最大的那个。
  const base = path.join(os.homedir(), '.workbuddy-ai', 'binaries', 'python', 'versions');
  try {
    const vers = fs.readdirSync(base)
      .filter((n) => fs.existsSync(path.join(base, n, 'python.exe')))
      .sort()
      .reverse();
    for (const v of vers) out.push(path.join(base, v, 'python.exe'));
  } catch { /* 没有就算了，后面还有 PATH 兜底 */ }

  out.push('python', 'python3');   // 裸名字交给 PATH 解析
  return out;
}

/** 取 stderr 的头几行（错误要能看见原话，不能只写「失败」）。 */
function headLines(s, n = 4) {
  const lines = String(s || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, n).join(' / ');
}

/** 跑一次 `--list-voices`。任何异常都收成 {ok:false, stderr}，不抛。 */
function runListVoices(py) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(py, [TTS_PY, '--list-voices'], { windowsHide: true });
    } catch (e) {
      return resolve({ ok: false, code: -1, stdout: '', stderr: String(e.message || e) });
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* 已经没了 */ }
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n（${LIST_TIMEOUT_MS / 1000}s 未返回，已终止）` });
    }, LIST_TIMEOUT_MS);
    timer.unref?.();

    child.stdout?.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, code: -1, stdout, stderr: `${stderr}\n${e.message}` });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

/** 依次试候选解释器，返回库侧那份 JSON。全失败则把每个候选的原始报错拼起来报出。 */
async function fetchManifest() {
  const tried = [];
  for (const py of pythonCandidates()) {
    // 绝对路径的候选先做存在性检查，省掉一次无谓的 spawn
    if (path.isAbsolute(py) && !fs.existsSync(py)) continue;
    const r = await runListVoices(py);
    if (r.ok) {
      try {
        const j = JSON.parse(r.stdout);
        if (j && Array.isArray(j.voices)) return { data: j, error: null, python: py };
        tried.push(`${py}: 输出里没有 voices 数组`);
      } catch (e) {
        tried.push(`${py}: 输出不是合法 JSON（${e.message}）：${headLines(r.stdout, 1)}`);
      }
    } else {
      tried.push(`${py}: ${headLines(r.stderr || r.stdout) || `退出码 ${r.code}`}`);
    }
  }
  return { data: null, error: `音色清单读取失败（脚本 ${TTS_PY}）。${tried.join('；')}`, python: null };
}

// ── 清单缓存（30 秒）────────────────────────────────────────
//
// ★ 面板会频繁调 /api/voices（切标签、刷新都调）。这个脚本要起一个 python 进程，
//   每次都跑太重。30 秒足够新鲜 —— 用户在库里加了一个 wav，最多等半分钟就能看见。
// ★ 并发去重：同一瞬间多个请求只跑一次脚本（照 apiEnv 的 envCache.inflight）。
// ★ ?force=1 绕过缓存（用户点了「刷新音色」就得当场看见）。
let cache = { at: 0, data: null, inflight: null };

/**
 * 拿清单（带缓存）。**不抛** —— 失败也返回对象，error 里带原始 stderr。
 * @returns {Promise<{voices:object[], meta:object|null, error:string|null}>}
 */
async function manifest({ force = false } = {}) {
  const fresh = cache.data && Date.now() - cache.at < CACHE_TTL_MS;
  if (!force && fresh) return cache.data;

  if (!cache.inflight) {
    cache.inflight = fetchManifest()
      .then((r) => {
        const data = {
          voices: r.data ? r.data.voices : [],
          meta: r.data || null,
          error: r.error,
          python: r.python,
        };
        cache = { at: Date.now(), data, inflight: null };
        return data;
      })
      .catch((e) => {
        cache.inflight = null;
        throw e;
      });
  }
  return cache.inflight;
}

// ── 当前内容文件实际用的音色 ────────────────────────────────
//
// ★ 读不到就返回 null，**不报错**：这是「锦上添花」的信息（面板上标一个「当前：zh_kepu9」），
//   内容文件换了名字/被删了都不该让整个声音版块挂掉。
export function readVoiceSource() {
  for (const name of CONTENT_FILES) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, name), 'utf8')); } catch { continue; }
    const v = j && j.voice;
    if (v && typeof v === 'object') {
      return {
        content: name,
        voice: typeof v.voice === 'string' ? v.voice : null,
        speed: Number.isFinite(v.speed) ? v.speed : null,
      };
    }
  }
  return null;
}

/**
 * 按 kind 分组建 items。**只放清单里真实存在的 name**，顺序 = 清单里的出现顺序
 * （也就是库侧 `--list-voices` 的枚举顺序：别名 → 音色库别名 → 官方 → 音色库）。
 * ★ 四个分组**恒定存在**（哪怕 items 为空）—— 面板的形状不该随某台机器的素材多少而变。
 */
function groupVoices(voices) {
  const byKind = new Map(VOICE_GROUPS.map((g) => [g.id, []]));
  for (const v of voices) {
    if (!v || typeof v.name !== 'string') continue;
    const bucket = byKind.get(v.kind);
    if (bucket) bucket.push(v.name);
  }
  return VOICE_GROUPS.map((g) => ({ id: g.id, label: g.label, items: byKind.get(g.id) || [] }));
}

/**
 * GET /api/voices 的完整响应体。字段形状是冻结契约，别改名字。
 * @returns {Promise<object>}
 */
export async function voicesPayload({ force = false } = {}) {
  const m = await manifest({ force });
  const meta = m.meta;
  return {
    ok: !m.error,
    default: meta ? (meta.default ?? null) : null,
    voices: m.voices,                       // ★ 原样透传，一条不漏、一个字段不改
    groups: groupVoices(m.voices),
    dirs: meta
      ? { refDir: meta.refDir ?? null, libDir: meta.libDir ?? null, refDirOk: !!meta.refDirOk, libDirOk: !!meta.libDirOk }
      : { refDir: null, libDir: null, refDirOk: false, libDirOk: false },
    warn: meta ? { peak: meta.peakWarn ?? null, rms: meta.rmsWarn ?? null } : { peak: null, rms: null },
    // ★ source 与清单无关（读的是内容文件），清单挂了也照样给 —— 面板仍能显示「当前用的是什么」
    source: readVoiceSource(),
    error: m.error,
  };
}

/**
 * 把音色名解析成参考音文件的**绝对路径**。
 *
 * ★ 安全：路径**只可能来自清单**，绝不把 name 拼进任何路径 —— 这是防目录穿越的唯一要点。
 *   清单里没有这个名字，就没有路径可用，直接 404。
 *
 * @returns {Promise<{ok:true, voice:object}|{ok:false, error:string, names:string[]}>}
 */
export async function resolveVoice(name, { force = false } = {}) {
  const m = await manifest({ force });
  const names = m.voices.map((v) => v.name).filter(Boolean);
  if (m.error) return { ok: false, error: m.error, names };
  const v = m.voices.find((x) => x && x.name === name);
  if (!v) {
    return {
      ok: false,
      names,
      error: `音色 ${JSON.stringify(name)} 不在清单里。可用：${names.slice(0, 12).join(' / ')}`
        + (names.length > 12 ? ` …（共 ${names.length} 个）` : ''),
    };
  }
  if (!v.file) return { ok: false, names, error: `音色 ${name} 在清单里但没有文件路径` };
  if (v.exists === false) return { ok: false, names, error: `音色 ${name} 的参考音文件不存在：${v.file}` };
  if (!fs.existsSync(v.file)) return { ok: false, names, error: `音色 ${name} 的参考音文件读不到：${v.file}` };
  return { ok: true, voice: v };
}

// ── 试听合成（后台任务用）───────────────────────────────────

/** Windows 路径 → WSL 里的 /mnt 路径（bash 脚本里引用宿主机文件要靠它）。 */
export function winToWsl(p) {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(p);
  if (!m) return p;
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

/** 时间戳（本地时区，给人看的）：20261002-153045。 */
export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * 试听用的临时目录（宿主侧）：输入 json 与 bash 脚本都落这儿。
 *
 * ★ 覆盖点（2026-10-07）：`LEMO_VOICE_TEST_TMP` —— **不设时与旧表达式逐字节等价**
 *   （`path.join(CFG.tmpDir,'voicetest')`），设了就 `path.resolve` 它。写法与 `lib/env.mjs` 的
 *   `CFG.exportDir` 认 `LEMO_FILM_DIR` **同型**（同名同义、未设时解析结果不变）。
 *
 *   由来：本目录是**应用目录**（`prepareVoiceTest` 在真实试听时往这里写盘），而
 *   `test/voices-api.test.mjs` 原先只是把**同一路径重算一遍**来做「跑前快照 / 跑后删新增」。
 *   ⇒ 该路径是**共享**的：两个测试实例、或「测试 + 正在跑的控制台」会共用它，而测试的兜底删除
 *   会把**别人的在途文件**当成自己的残留删掉（实测：跑测试期间往该目录写一个文件，跑完已被删除，
 *   且测试仍报全绿 —— 静默数据丢失）。有覆盖点后，测试可把自己 spawn 的 server（继承 env）
 *   隔离到**每进程**目录 ⇒ 不再有「不是自己的文件」可删。
 *   ★ 另一半：产物目录 `VOICE_TEST_DIR`（下方 `CFG.exportDir/_voicetest`）**本来就认**
 *     `LEMO_FILM_DIR` ⇒ 那半边早就能隔离，只有本目录此前没有任何口子。
 */
const TEST_TMP_DIR = process.env.LEMO_VOICE_TEST_TMP
  ? path.resolve(process.env.LEMO_VOICE_TEST_TMP)
  : path.join(CFG.tmpDir, 'voicetest');

/** 清掉超过一天没人动的试听临时文件（任务被取消/控制台被杀时会留下残渣，靠这个自愈）。 */
function pruneTestTmp() {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  let names = [];
  try { names = fs.readdirSync(TEST_TMP_DIR); } catch { return; }
  for (const n of names) {
    const p = path.join(TEST_TMP_DIR, n);
    try { if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p); } catch { /* 删不掉就算了 */ }
  }
}

/**
 * 准备好一次试听合成：写 lines.json + 写 bash 脚本，返回给任务执行器要的东西。
 *
 * ★ 安全要点（整个功能里唯一需要注意的地方）：text 是**用户自由输入**。
 *   它只作为 JSON 字符串落进 lines.json，由 python 读 —— 全程不经过任何 shell 解析。
 *   bash 脚本里只出现我自己生成的 token（路径、时间戳、**已通过字符白名单的音色名**），
 *   用户文本一个字都不进来。所以引号 / $ / 反引号 / 换行都伤不到这条命令。
 *
 * @param {{name:string, text:string, speed:number, uniq:string}} o
 * @returns {{file:string, url:string, hostScript:string, linesHost:string, outWsl:string, dstWsl:string, textChars:number}}
 */
export function prepareVoiceTest({ name, text, speed, uniq }) {
  fs.mkdirSync(TEST_TMP_DIR, { recursive: true });
  fs.mkdirSync(VOICE_TEST_DIR, { recursive: true });
  pruneTestTmp();

  // 输入：库侧 tts_indextts.py 认的 lines.json 形状（见该脚本文件头）。
  const linesHost = path.join(TEST_TMP_DIR, `${uniq}.json`);
  fs.writeFileSync(linesHost, JSON.stringify([{ id: 't1', text, voice: name, speed, lang: 'cmn' }]), 'utf8');
  const jsonWsl = winToWsl(linesHost);

  const file = `${name}_${stamp()}.wav`;
  const outWsl = winToWsl(path.join(VOICE_TEST_DIR, `_tmp_${uniq}`));
  const dstWsl = winToWsl(path.join(VOICE_TEST_DIR, file));
  const scriptHost = path.join(TEST_TMP_DIR, `${uniq}.sh`);
  const scriptWsl = winToWsl(scriptHost);

  const script = [
    'set -u',
    // 收尾：输入 json、这份脚本自己、以及半途失败的临时输出目录，都清掉。
    // （脚本本体是**内容来源**，真正的执行副本在 /tmp，删掉源文件不影响本次运行。）
    `trap 'rm -f "${jsonWsl}" "${scriptWsl}" 2>/dev/null || true; rm -rf "${outWsl}" 2>/dev/null || true' EXIT`,
    'cd /home/lemo/lemo-opuscar || { echo "✗ 找不到库 /home/lemo/lemo-opuscar"; exit 1; }',
    `echo "→ 音色 ${name} · 语速 ${speed} · 文本 ${text.length} 字"`,
    'echo "  首次加载模型要 1~2 分钟，之后每条约 30 秒。日志会一直往下滚，别关这个面板。"',
    `.venv/bin/python core/tts/tts_indextts.py '${jsonWsl}' '${outWsl}'`,
    'rc=$?',
    'if [ $rc -ne 0 ]; then echo "✗ 合成失败（退出码 $rc）—— 上面最后几行是库侧的原始报错"; exit $rc; fi',
    `if [ ! -f '${outWsl}/t1.wav' ]; then echo "✗ 合成结束但没找到 ${outWsl}/t1.wav"; exit 1; fi`,
    `mkdir -p '${path.posix.dirname(dstWsl)}' || exit 1`,
    `cp '${outWsl}/t1.wav' '${dstWsl}' || exit 1`,
    `ls -l '${dstWsl}'`,
    'echo "✓ 试听产物已就绪"',
  ].join('\n') + '\n';

  fs.writeFileSync(scriptHost, script, 'utf8');   // runSteps 会归一化行尾，这里不必自己换 LF

  return { file, url: `/api/voices/test/audio/${file}`, hostScript: scriptHost, linesHost, outWsl, dstWsl, textChars: text.length };
}

// ── 音色导入（源素材 → 参考音）────────────────────────────────
//
// ★ 背景：Index-TTS 不认音色名、**只认参考音频** —— 「加一个可选音色」= 往参考音目录
//   （= 清单里的 libDir）放一条合格的 wav。用户手上是 MP3，必须先转换：降电平（否则克隆输出
//   削波，不可逆）+ 裁到 6~15s（infer_v2_5 只取前 15s）+ 统一成 44100 单声道 s16。
//   转换脚本在**库侧**：D:\lemo-opuscar\core\tts\voice_ref.py（三条硬性要求的依据都在它文件头）。
//
// ★ 控制台这边只做三件事：① 列候选源；② 把中文源名映射成一个安全的 ASCII 音色名；
//   ③ 起一个后台任务跑那个脚本。**转换本身一行都不在 Node 里实现** —— 判据只有一处，
//   否则必然与库侧漂移（这是本项目反复吃过亏的地方）。

/** 参考音目录的兜底默认值（与库侧 tts_indextts.py 的 LIB_DIR 默认同值；正常走清单里的 libDir）。 */
export const DEFAULT_REF_DIR = 'D:/sucai/gongzuoliusucai/kelongshengyin/_ref_wav';

/** 音色源目录认的音频后缀（大小写不敏感）。 */
const SRC_EXTS = new Set(['.mp3', '.m4a', '.wav', '.flac', '.aac', '.ogg']);

/** 音色名白名单：与 lib/briefs.mjs 的 OPT_RE、库侧 voice_ref.py 的 NAME_RE 同源（ASCII 才进得去选项校验）。 */
const VOICE_NAME_RE = /^[A-Za-z0-9._-]{1,40}$/;

/** 导入任务的临时脚本落点（宿主侧，跑完由执行器清掉）。 */
const IMPORT_TMP_DIR = path.join(CFG.tmpDir, 'voiceimport');

/**
 * 词表：中文短语 → ASCII 片段。**长词在前**（按最长匹配切）。
 *
 * ★ 为什么要一份词表而不是逐字拼音：Node 里没有拼音库，而「可读、稳定」是硬要求。
 *   这份词表覆盖了用户音色库里实际出现的词；映射值刻意对齐**库里已有的 21 个 wav 名**
 *   （huashang1 / psy_male / kepu9 …），这样同一个源不会因为「名字对不上」被重复导入。
 *   未收录的汉字会被丢掉（见 suggestName），落成兜底名。
 */
const NAME_DICT = [
  ['沧桑情感男', 'cangsang_male'],
  ['华商博主', 'huashang'], ['科普博主', 'kepu'], ['动物世界', 'dongwu'],
  ['情感瘾哥', 'yinge'], ['情感男', 'qinggan_male'], ['工具箱', 'toolbox'],
  ['心理学', 'psy'], ['李冠宇', 'liguanyu'], ['长音频', 'long'],
  ['素人', 'suran'], ['走心', 'zouxin'], ['沧桑', 'cangsang'],
  ['奶狗', 'naigou'], ['小蓝', 'xiaolan'], ['快节奏', 'fast'],
  ['磁性', ''], ['声音', ''], ['配音', ''],
  ['博主', 'bozhu'], ['男', 'male'], ['女', 'female'],
];
const MONTHS = ['', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** 按最长匹配把名字切成「ASCII 片段」；相邻的 ASCII 片段（含数字）合并，中文片段之间才加下划线。 */
function tokenizeName(base) {
  const toks = [];
  let i = 0;
  while (i < base.length) {
    let hit = null;
    for (const [zh, en] of NAME_DICT) {
      if (base.startsWith(zh, i)) { hit = [zh, en]; break; }
    }
    if (hit) {
      if (hit[1]) toks.push(hit[1]);
      i += hit[0].length;
      continue;
    }
    const ch = base[i];
    if (/[A-Za-z0-9]/.test(ch)) {
      const last = toks[toks.length - 1];
      // 紧挨着的字母/数字合成一个串（华商博主1 → huashang + 1 → huashang1；情感男1 同理）
      if (last && /^[A-Za-z0-9_]+$/.test(last)) toks[toks.length - 1] = last + ch;
      else toks.push(ch);
    } else if (toks.length && toks[toks.length - 1] !== '') {
      toks.push('');        // 空格/标点/未收录的汉字 → 一个分隔点（空格因此变成 `_`）
    }
    i += 1;
  }
  return toks;
}

/**
 * 源文件名 → 建议的 ASCII 音色名（**前端直接用这个，不再自己算**）。
 *
 * 例：`华商博主4.MP3` → `huashang4`；`心理学男配音.MP3` → `psy_male`；`7月2日.MP3` → `jul2`。
 * 已经是 ASCII 的就规范化（小写、非字母数字转 `_`）。认不得的汉字被丢掉；
 * 全丢掉时落成 `voice`（同名冲突由调用方追加数字后缀区分）。
 */
export function suggestName(file) {
  let base = String(file || '').replace(/\.[^.]+$/, '');
  base = base.replace(/(\d{1,2})月(\d{1,2})日/g, (m, mo, d) => {
    const n = Number(mo);
    return (MONTHS[n] || `${n}m`) + d;        // 7月2日 → jul2
  });
  let s = tokenizeName(base).join('_');
  s = s.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  if (!s) s = 'voice';
  if (s.length > 40) s = s.slice(0, 40).replace(/_+$/, '');
  return s;
}

/** 参考音目录里已有的 wav（小写、去扩展名）—— `already` 就按它比。 */
function refStems(refDir) {
  const s = new Set();
  let names = [];
  try { names = fs.readdirSync(refDir); } catch { return s; }
  for (const n of names) if (n.toLowerCase().endsWith('.wav')) s.add(n.slice(0, -4).toLowerCase());
  return s;
}

/**
 * 扫音色源目录（内部用，额外带回 refDir）。
 * ★ 排除：子目录、`_` / `.` 开头的文件与目录（`_ref_wav` 自己就被这条排除）、不支持的扩展名。
 * ★ `already` 按**转写后的名字**比参考音目录 —— 不看源文件名，这样用户重命名源文件也不会产生重复音色。
 */
async function scanSources() {
  const m = await manifest({});
  const refDir = (m.meta && m.meta.libDir) || DEFAULT_REF_DIR;
  const dir = path.dirname(refDir);
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) {
    return { ok: false, dir, refDir, sources: [], error: `读不到音色源目录 ${dir}：${String(e.message || e)}` };
  }
  const have = refStems(refDir);
  const used = new Set();
  const sources = [];
  for (const ent of ents) {
    if (!ent.isFile()) continue;
    const n = ent.name;
    if (n.startsWith('_') || n.startsWith('.')) continue;
    const ext = path.extname(n);
    if (!SRC_EXTS.has(ext.toLowerCase())) continue;
    const base = suggestName(n);
    let name = base;
    let k = 1;
    while (used.has(name.toLowerCase())) { k += 1; name = `${base}_${k}`; }   // 同名冲突追加数字
    used.add(name.toLowerCase());
    let size = 0;
    try { size = fs.statSync(path.join(dir, n)).size; } catch { /* 读不到就算了 */ }
    sources.push({
      file: n, name, ext: ext.replace(/^\./, '').toUpperCase(), size,
      already: have.has(name.toLowerCase()), refName: `${name}.wav`,
    });
  }
  sources.sort((a, b) => a.file.localeCompare(b.file, 'zh'));
  return { ok: true, dir, refDir, sources, error: null };
}

/** `GET /api/voices/sources` 的响应体（字段形状是冻结契约，别改名字）。 */
export async function listSources() {
  const r = await scanSources();
  return { ok: r.ok, dir: r.dir, sources: r.sources, error: r.error };
}

/**
 * `POST /api/voices/import` 的前半段：校验 + 写好要跑的后台脚本。
 *
 * ★ 安全（整个功能里唯一需要注意的地方）：`file` **必须**是扫描结果里的一个名字（精确匹配），
 *   **绝不把它拼进任何路径** —— 目录穿越（`../../windows/win.ini`）在清单里不存在，自然 400。
 *   脚本里出现的路径全部由我这边生成（源目录 + 白名单校验过的 name），用户输入一个字都不进来。
 *
 * @returns {Promise<{ok:true, name:string, out:string, file:string, hostScript:string}
 *                  |{ok:false, code:number, error:string}>}
 */
export async function prepareVoiceImport({ file, name }) {
  if (typeof file !== 'string' || !file.trim()) return { ok: false, code: 400, error: '缺少 file' };
  const want = file.trim();
  const r = await scanSources();
  if (!r.ok) return { ok: false, code: 500, error: r.error };

  const src = r.sources.find((s) => s.file === want);
  if (!src) {
    const names = r.sources.map((s) => s.file);
    return {
      ok: false, code: 400,
      error: `源文件 ${JSON.stringify(want)} 不在候选清单里（子目录 / _ 开头 / 不支持的扩展名都列不出来）。`
        + `候选：${names.slice(0, 12).join(' / ') || '（一个都没有）'}`,
    };
  }
  // 文件名会被写进 bash 脚本的单引号里 —— 带引号/反引号/$ 的名字直接拒掉（本项目素材都是中文名，不受影响）
  if (/['"`$\\]/.test(src.file)) {
    return { ok: false, code: 400, error: `源文件名含不安全字符，无法安全地传给转换脚本：${src.file}` };
  }

  const nm = (name === undefined || name === null || String(name).trim() === '')
    ? src.name : String(name).trim();
  if (!VOICE_NAME_RE.test(nm)) {
    return { ok: false, code: 400, error: `name 非法（只允许 A-Za-z0-9._- ，1~40 字符）：${nm}` };
  }
  const out = path.join(r.refDir, `${nm}.wav`);
  if (fs.existsSync(out)) {
    return { ok: false, code: 400, error: `目标参考音已存在，不覆盖：${out}` };
  }

  fs.mkdirSync(IMPORT_TMP_DIR, { recursive: true });
  const uniq = `vi-${process.pid}-${Date.now().toString(36)}`;
  const scriptHost = path.join(IMPORT_TMP_DIR, `${uniq}.sh`);
  const scriptWsl = winToWsl(scriptHost);
  const srcWsl = winToWsl(path.join(r.dir, src.file));   // src.file 来自目录列表，不是用户拼的
  const outWsl = winToWsl(out);

  const script = [
    'set -u',
    `trap 'rm -f "${scriptWsl}" 2>/dev/null || true' EXIT`,
    'cd /home/lemo/lemo-opuscar || { echo "✗ 找不到库 /home/lemo/lemo-opuscar"; exit 1; }',
    `echo "→ 导入音色 ${nm} ← ${src.file}"`,
    `echo "  （降电平 + 裁到 6~15s + 转成 44100 单声道 s16；判据见 voice_ref.py 文件头）"`,
    `.venv/bin/python core/tts/voice_ref.py '${srcWsl}' '${outWsl}' --name '${nm}'`,
    'rc=$?',
    'if [ $rc -ne 0 ]; then echo "✗ 转换失败（退出码 $rc）—— 上面最后几行是 voice_ref.py 的原始报错"; exit $rc; fi',
    `if [ ! -f '${outWsl}' ]; then echo "✗ 转换结束但没找到 ${outWsl}"; exit 1; fi`,
    `ls -l '${outWsl}'`,
    `echo "✓ 参考音已就绪 —— 音色 ${nm} 现在就在「声音」清单里了"`,
  ].join('\n') + '\n';
  fs.writeFileSync(scriptHost, script, 'utf8');    // runSteps 会归一化行尾，这里不必自己换 LF

  return { ok: true, name: nm, out, file: src.file, hostScript: scriptHost };
}

/** 导入成功后**主动失效清单缓存** —— 否则用户点完看不到新音色，会以为失败（缓存 30 秒）。 */
export function invalidateManifest() {
  cache.at = 0;
  cache.data = null;
}

/** 供 /api/console 之类的状态展示用：清单来源与缓存年龄。 */
export function voicesStatus() {
  return {
    source: TTS_PY,
    contentDir: CONTENT_DIR,
    testDir: VOICE_TEST_DIR,
    cached: !!cache.data,
    cacheAgeMs: cache.data ? Date.now() - cache.at : null,
  };
}
