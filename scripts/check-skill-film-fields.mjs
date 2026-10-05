#!/usr/bin/env node
/**
 * scripts/check-skill-film-fields.mjs
 *   —— SKILL.md **正文**里的「成片帧数 / 分辨率 / 时长」声称是否与实测一致
 *
 * ① 由来（2026-10-04）：
 *   `check-tp-prose.mjs` 只覆盖正文里的**真峰值**声称；**帧数 / 分辨率 / 时长**这三类
 *   「关于成片」的正文数字**没有任何闸门**。实测就漏过一处：
 *   `paper-lantern/SKILL.md:114` 写着「已渲染的 **2922** 帧画面可直接复用」，
 *   而该风格 `_distill.json#generatedVideo.frames` 已是 **2923**
 *   （2026-10-04 全量重渲后差 1 帧，长期无人发现 —— 人读正文会得到与机器不同的答案）。
 *
 * ② 判据（沿用 `check-tp-prose.mjs` 的整套思路：**只认关于本片成片的声称**）：
 *   · 数据源 = 每风格 `lib/style-skills/<slug>/_distill.json#generatedVideo`
 *     （frames / width / height / durSec）；正文源 = 同风格 `SKILL.md`。
 *   · 三类声称按可靠性分级：
 *     1) **帧数**   `(\d{3,5})\s*帧`（只认 ≥ 100，容差 0）           → 可判 FAIL
 *     2) **分辨率** `(\d{3,4})\s*[×x]\s*(\d{3,4})`（容差 0）        → 可判 FAIL
 *     3) **时长**   `(?<![\w.\-])(\d+(?:\.\d+)?)\s*s\b`（差 > 1s）  → **只列「参考」**
 *   · 四条同时满足才记 FAIL：
 *     ① 值本身可疑（帧数 ≥ 100；分辨率 ≥ 100×100）；
 *     ② 与**本风格实测**不符（帧数/分辨率容差 0，时长差 > 1s）；
 *     ③ **成片语境** —— 帧数看**整行**含「成片/全片/本片/帧数/帧率/入库版」；
 *        分辨率看**近邻 60 字**内含「成片/全片/本片/交付/输出」；
 *     ④ 所在**整行**没有历史语境标记（`HIST` 正则，与 `check-tp-prose.mjs` 逐字一致）。
 *   ★ 另加「**非本片来源**」排除：近邻 60 字内出现 `原生/样片/demo/DEMO/入库前/未渲/声明/设计稿`
 *     ⇒ **不判 FAIL**（那是设计期尺寸 / 风格声明值，不是本片成片的声称）。
 *   ★ 分辨率再加「**非假设语境**」排除：近邻 60 字内含
 *     `硬渲/渲成/裁/塞在/竖屏/内部/内含/超采样/世界/场景/片门/模板/画布/渲染/若/如果`
 *     ⇒ 不判（那是「若硬渲成 1080×1920 会怎样」这类推导，不是成片分辨率）。
 *   ★ 单列「**交叉引用**」：行内出现**别的风格名**的，说明是在引用他片的值当先例，
 *     不计 FAIL，供人工判断（与 `check-tp-prose.mjs` 同）。
 *
 *   ★★ 误报率实测与收窄动作（2026-10-04，43 份正文）：
 *     · **最宽判据**（只认 ① 值 ≥100 + ② 与实测不符）→ 帧数报 **26** 条。
 *       逐条人工判断（成片都用 ffprobe 复核过）：**真陈旧 11 条**
 *       （`hd-2d` 5 / `paper-lantern` 3 / `pictogram-motion` 3），
 *       **误报 15 条 = 57.7%** —— 全是「demo 原生 30fps/900 帧」「样片 7980 帧」
 *       「非移轴版 video_gpu.mp4（24 fps / 1836 帧）与移轴版 video_tilt.mp4（60 fps / 4590 帧）」
 *       这类**设计期 / 他版**帧数。⇒ 收窄：加 ③（成片语境）+ ④（历史语境）+ 原生来源排除。
 *     · 收窄后帧数报 **9** 条，**误报 0 条**（= 11 条真陈旧里，`hd-2d:138` 因同行 `DEMO.md`、
 *       `pictogram-motion:170` 因整行历史语境被排除 —— 这 2 条属已知局限，见 ③）。
 *     · 分辨率：328 处 `W×H` 里 **107 处与成片尺寸不符**，但加 ③（近邻含「成片」）后只剩
 *       **1** 条 —— 且它是**误报**（`paper-lantern:187`「硬渲 1080×1920 时母版被 1:1 塞在左上角」）。
 *       再加「非假设语境」排除后 → **0** 条。⇒ 分辨率**不加这两道守卫就是 100% 噪声**。
 *     · 时长：1874 处 `<数>s` 里 **60 处**落在「成片」近邻且与 durSec 差 > 1s，但绝大多数是
 *       **出片耗时 / 片段时长 / 静帧时长**（「渲染 1272 帧耗时 207s」「静默小节 26–28 s」
 *       「音频链 46.2s」）。要把它收窄到高精度只能靠「成片实测/全片时长」这类自定义锚点，
 *       而锚点一旦漏写就静默失明 ⇒ **按纪律降级为「参考」，不进退出码**。
 *
 * ③ 已知局限：
 *   · 只认**字面量**：正文若写「约两分钟」「一帧不差」，闸门看不见（假阴）。
 *   · 帧数的「成片语境」用**整行**判定（这些表格行很长，行首的「成片 |」「帧数 |」离数字常 > 60 字）——
 *     所以一行里同时出现「原生设计帧数」与「成片帧数」时，靠**近邻**排除原生那个、仍报成片那个；
 *     若两者挨得太近，会漏（如 `hd-2d:138` 的「本次已按此实渲」因同行 `DEMO.md` 被排除）。
 *   · 分辨率只看 `W×H` 这一种写法（`1080p` / `1920 by 1080` 看不见）。
 *   · 时长永远是「参考」，不进退出码（依据见上）。
 *   · 只比对 `generatedVideo`；**不判断 json 自己的 `selfCheck` 正文是否也陈旧**
 *     （实测 `hd-2d` 的 json 内部就不自洽：`generatedVideo` 已 24 fps，`selfCheck.warnings` 仍写 60 fps）。
 *
 * 用法：node scripts/check-skill-film-fields.mjs
 * 退出码：
 *   0 = 无「陈旧且非历史语境」的成片字段声称（参考项与失明项不影响退出码）
 *   1 = 有 FAIL（陈旧帧数 / 陈旧分辨率），或**全部风格都读不到 generatedVideo**（本闸门已失明）
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'D:/lemo-tools/lib/style-skills';
const HIST = /已修|原为|原记|原先|曾是|曾为|历史|修复前|修复后|校正|拆分|移入|resolvedDefects/;
const FRAME_CTX = /成片|全片|本片|帧数|帧率|入库版/;            // 帧数：整行
const RES_CTX = /成片|全片|本片|交付|输出/;                    // 分辨率：近邻
const NATIVE = /原生|样片|demo|DEMO|入库前|未渲|设计稿|风格声明|on ones/;  // 非本片来源 ⇒ 排除
const HYPO = /硬渲|渲成|裁|塞在|竖屏|内部|内含|超采样|世界|场景|片门|模板|画布|渲染|若|如果|原生|帧缓冲|索引|缓冲/;
const NEAR = 60;

const dirs = fs.readdirSync(DIR).filter((s) => fs.existsSync(path.join(DIR, s, 'SKILL.md'))).sort();
const blind = [], staleFrame = [], staleRes = [], refDur = [], xref = [];

for (const slug of dirs) {
  const jsonPath = path.join(DIR, slug, '_distill.json');
  let gv = null;
  if (fs.existsSync(jsonPath)) {
    try { gv = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).generatedVideo || null; } catch { gv = null; }
  }
  if (!gv || typeof gv.frames !== 'number') { blind.push(slug); continue; }   // ★ 失明守卫
  const others = dirs.filter((s) => s !== slug);
  const lines = fs.readFileSync(path.join(DIR, slug, 'SKILL.md'), 'utf8').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const near = (idx, len) => line.slice(Math.max(0, idx - NEAR), idx + len + NEAR);

    // ── 1) 帧数（高精度 → 判 FAIL） ──
    for (const m of line.matchAll(/(\d{3,5})\s*帧/g)) {
      const v = Number(m[1]);
      if (v < 100) continue;                       // ① 小于 100 的「3 帧」多是动作描述
      if (v === gv.frames) continue;               // ② 与实测一致
      if (!FRAME_CTX.test(line)) continue;         // ③ 整行不是关于成片
      if (NATIVE.test(near(m.index, m[0].length))) continue;  // 设计期 / 他版来源
      if (HIST.test(line)) continue;               // ④ 整行有历史语境
      const isXref = others.some((o) => line.includes(o));
      (isXref ? xref : staleFrame).push({ slug, ln: i + 1, v, measured: gv.frames, line });
    }

    // ── 2) 分辨率（需 ③ 成片近邻 + ④ 历史语境 + 非假设语境 → 判 FAIL） ──
    for (const m of line.matchAll(/(\d{3,4})\s*[×x]\s*(\d{3,4})/g)) {
      const w = Number(m[1]), h = Number(m[2]);
      if (w < 100 || h < 100) continue;            // ① 值本身可疑
      if (w === gv.width && h === gv.height) continue;         // ② 与实测一致
      const n = near(m.index, m[0].length);
      if (!RES_CTX.test(n)) continue;              // ③ 只认「关于成片」的断言（近邻）
      if (HYPO.test(n)) continue;                  // 非假设语境（硬渲 / 裁切 / 内部尺寸…）
      if (HIST.test(line)) continue;               // ④ 整行有历史语境
      const isXref = others.some((o) => line.includes(o));
      (isXref ? xref : staleRes).push({ slug, ln: i + 1, v: `${w}×${h}`, measured: `${gv.width}×${gv.height}`, line });
    }

    // ── 3) 时长（噪声大 → 只列「参考」） ──
    for (const m of line.matchAll(/(?<![\w.\-])(\d+(?:\.\d+)?)\s*s\b/g)) {
      const v = Number(m[1]);
      if (!Number.isFinite(v) || Math.abs(v - gv.durSec) <= 1) continue;
      if (!/成片/.test(near(m.index, m[0].length))) continue;
      if (HIST.test(line)) continue;
      refDur.push({ slug, ln: i + 1, v, measured: gv.durSec, line });
    }
  }
}

// ── 输出（沿用 check-tp-prose.mjs 的风格） ──
const dump = (list, unit) => {
  for (const s of list) {
    console.log(`  ${s.slug.padEnd(20)} L${String(s.ln).padStart(4)}  正文 ${s.v}${unit} / 实测 ${s.measured}${unit}\n      ${s.line.trim().slice(0, 150)}`);
  }
};

if (staleFrame.length) {
  console.log(`✘ 疑似「陈旧且非历史语境」的正文**帧数**声称 ${staleFrame.length} 处：\n`);
  dump(staleFrame, ' 帧');
}
if (staleRes.length) {
  console.log(`\n✘ 疑似「陈旧且非历史语境」的正文**分辨率**声称 ${staleRes.length} 处：\n`);
  dump(staleRes, '');
}
if (refDur.length) {
  console.log(`\nℹ 参考：正文**时长**声称与实测差 > 1s 的 ${refDur.length} 处 —— 噪声大（多为出片耗时/片段时长），不计 FAIL：`);
  const bySlug = {};
  for (const r of refDur) bySlug[r.slug] = (bySlug[r.slug] || 0) + 1;
  for (const [k, v] of Object.entries(bySlug)) console.log(`  ${k.padEnd(20)} ${v} 处`);
}
if (xref.length) {
  console.log(`\nℹ 交叉引用（行内提到别的风格，引用其值当先例）${xref.length} 处 —— 不计 FAIL，供人工判断：`);
  const bySlug = {};
  for (const x of xref) bySlug[x.slug] = (bySlug[x.slug] || 0) + 1;
  for (const [k, v] of Object.entries(bySlug)) console.log(`  ${k.padEnd(20)} ${v} 处`);
}
if (blind.length) {
  console.log(`\nℹ 失明：读不到 _distill.json#generatedVideo 的风格 ${blind.length} 个（不计 FAIL，但统计）：`);
  console.log('  ' + blind.join('、'));
}

// ★ 失明守卫：一个风格都枚举不到、或全部风格都读不到 ⇒ 本闸门没有可比对的真值，必须 FAIL 并明说
const allBlind = dirs.length === 0 || blind.length === dirs.length;
if (allBlind) {
  console.log(dirs.length === 0
    ? `\n✘ 本闸门已失明：\`${DIR}\` 下一个风格（SKILL.md）都找不到，没有任何可比对的真值。`
    : `\n✘ 本闸门已失明：${dirs.length} 个风格**全部**读不到 generatedVideo，没有任何可比对的真值。`);
}

const fail = staleFrame.length + staleRes.length + (allBlind ? 1 : 0);
if (!staleFrame.length && !staleRes.length && !allBlind) console.log('✓ 未发现「陈旧且非历史语境」的正文成片帧数 / 分辨率声称。');
console.log(`\n[闸门] 陈旧帧数 ${staleFrame.length} 处 / 陈旧分辨率 ${staleRes.length} 处 / 参考时长 ${refDur.length} 处 / 失明 ${blind.length} 个 ${fail ? '✘' : 'OK'}`);
process.exitCode = fail ? 1 : 0;
