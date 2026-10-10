#!/usr/bin/env node
/**
 * scripts/check-dna-coverage.mjs —— **风格注册表的字段消费覆盖**
 *   第一节：`lib/style-dna/`（三态：被消费 / 只被打印 / 没人读）
 *   第二节：`lib/dub-styles.json`（★ 2026-10-05 扩展；无消费者且不在清单里 ⇒ FAIL）
 *   第三节：`lib/dub-styles.json` 的 `bgRecipe.textureRaw`（★ 2026-10-05 扩展；**取值级**实现状态：
 *           「某风格声明的细纹理名渲染侧实现了吗」= 「它落在 `dub-core.mjs` 的可解析名字集合里吗」）
 *
 * ★ 由来（2026-10-04 全量审计）：`lib/style-dna/` 有 43 份档案、每份约 15 个顶层字段，
 *   但**真正「被消费」（即真的改了输出）的只有 3 条链路**：
 *     · `sentence_patterns.length` → `subtitleMaxChars` → 字幕折行容量
 *     · `sound_palette.mix_rules`  → `targetLufs`      → 响度归一目标
 *     · `sound_palette.mix_rules`  → `grain`           → 成片颗粒（仅当 --grain 与 build.sh 都没说话时补位）
 *   其余约 80% 字段**零消费者**（有的是「只被打印」，有的完全没人读）。
 *   ⇒ 这不是「坏」，但它是个**看不见的事实**：知识库答得出「怎么套用特质」，却没流程去问。
 *
 * 本闸门做两件事：
 *   ① **回归保护**：上面 3 条链路的**解析函数与使用点**必须都还在（断了就 FAIL —— 那是静默降级）；
 *   ② **可见化**：把字段按「被消费 / 只被打印 / 没人读」三态列出来，未消费的作为 **backlog** 供人工决定要不要接线。
 *
 * 用法：node scripts/check-dna-coverage.mjs [--verbose]
 * 退出码：第一节 3 条链路有断点（`dnaFails`）、**或**第二节 `lib/dub-styles.json` 字段覆盖失败 / 失明
 *         （`dubFails`）、**或**第三节 `bgRecipe.textureRaw` 取值级失败 / 失明（`texFails + texBlind`）
 *         —— 三者任一非 0 ⇒ 1；否则 0。
 *         （★ 2026-10-08 复核：原只写「3 条链路有断点 → 1；否则 0」，漏了第二 / 三节也判 1。）
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/lemo-tools';
const DNA_DIR = path.join(ROOT, 'lib', 'style-dna');
const VERBOSE = process.argv.includes('--verbose');

/**
 * ★ 已接线（真的改输出）的链路 —— 断一条就 FAIL。
 *   `parserIn`：解析函数在哪个文件里（**不一定是读取器** —— 实测 `grain` 的解析就在 `lemo-make.mjs`，
 *   不在 `style-dna-reader.mjs`；我第一版把它写在读取器里，闸门当场报「找不到 parseGrain」）。
 */
const WIRED = [
  { field: 'sentence_patterns.length → subtitleMaxChars', parser: 'parseSubtitleMaxChars', parserIn: 'lib/style-dna-reader.mjs', usedIn: ['dub.mjs'], useToken: 'subtitleMaxChars' },
  { field: 'sound_palette.mix_rules → targetLufs', parser: 'parseTargetLufs', parserIn: 'lib/style-dna-reader.mjs', usedIn: ['dub.mjs'], useToken: 'targetLufs' },
  { field: 'sound_palette.mix_rules → grain', parser: 'dnaGrainFromMixRules', parserIn: 'lemo-make.mjs', usedIn: ['lemo-make.mjs'], useToken: 'dnaGrain' },
];

const fails = [];
/** ★ 必须用**词边界**匹配，不能用 `includes` —— 实测 `dnaGrainXX` 会命中子串 `dnaGrain`，
 *  反向测试时闸门照样「通过」（假阴性）。 */
const hasWord = (src, tok) => new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(src);
for (const w of WIRED) {
  const pp = path.join(ROOT, w.parserIn);
  const psrc = fs.existsSync(pp) ? fs.readFileSync(pp, 'utf8') : '';
  if (!hasWord(psrc, w.parser)) fails.push(`${w.field}：${w.parserIn} 里找不到解析函数 \`${w.parser}\``);
  for (const f of w.usedIn) {
    const p = path.join(ROOT, f);
    const src = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    if (!hasWord(src, w.useToken)) fails.push(`${w.field}：${f} 里找不到使用点 \`${w.useToken}\``);
  }
}

// ── 字段清单（并集 + 覆盖份数）──
const files = fs.readdirSync(DNA_DIR).filter((f) => f.endsWith('.json')).sort();
const top = new Map();       // 顶层 key → 覆盖份数
const sub = new Map();       // 顶层.子 → 覆盖份数
for (const f of files) {
  let j = null;
  try { j = JSON.parse(fs.readFileSync(path.join(DNA_DIR, f), 'utf8')); } catch { continue; }
  for (const [k, v] of Object.entries(j)) {
    top.set(k, (top.get(k) || 0) + 1);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k2 of Object.keys(v)) sub.set(`${k}.${k2}`, (sub.get(`${k}.${k2}`) || 0) + 1);
    }
  }
}

/** 只被打印（`describeStyleDna` 里出现，但不改输出） */
// ★ 2026-10-05 补 6 项：`lib/style-dna-reader.mjs` 的 `describeStyleDna` 已开始打印这六项
//   （「编排手法 6 项」，每项截断到 `DNA_AGENT_FIELD_CAP` 字）—— 它们**不改画面**、但**会被下游智能体看到**，
//   所以既不是「已接线」，也不该再算「完全没人读」。漏了这六项会让本闸门**报出过时的 backlog 结论**。
const PRINT_ONLY = [
  'essence', 'idioms', 'materials_and_rendering', 'variation_space',
  'narrative_rhythm', 'shot_logic', 'atmosphere', 'tone', 'taboos', 'asset_contract',
];

console.log(`lib/style-dna：${files.length} 份档案；顶层字段 ${top.size} 个、二级字段 ${sub.size} 个`);
console.log(`\n★ 已接线（真的改输出）${WIRED.length} 条：`);
for (const w of WIRED) console.log(`  ✓ ${w.field}`);

const unconsumed = [...top.keys()].filter((k) => !WIRED.some((w) => w.field.startsWith(k) || w.field.includes(k)));
const printed = unconsumed.filter((k) => PRINT_ONLY.includes(k));
const dead = unconsumed.filter((k) => !PRINT_ONLY.includes(k));

console.log(`\nℹ 只被打印（进提示、不改输出）${printed.length} 个：${printed.join('、') || '（无）'}`);
console.log(`\nℹ 完全没人读（backlog）${dead.length} 个：`);
for (const k of dead) console.log(`  · ${k.padEnd(24)} 覆盖 ${top.get(k)}/${files.length} 份`);
if (VERBOSE) {
  console.log('\n二级字段：');
  for (const [k, n] of [...sub.entries()].sort()) console.log(`  ${k.padEnd(34)} ${n}/${files.length}`);
}

if (fails.length) {
  console.log(`\n✘ 已接线的链路出现断点 ${fails.length} 处：`);
  for (const f of fails) console.log(`  ✘ ${f}`);
  console.log('\n★ 这类断点是**静默降级**：风格特质悄悄不再生效，输出照出、只是不对齐风格。');
} else {
  console.log('\n✓ 3 条已接线链路的解析函数与使用点都在。');
}

console.log(`\n[闸门·第一节] 已接线断点 ${fails.length} 处 ${fails.length ? '✘' : 'OK'}；未消费字段 backlog ${dead.length} 个（参考）`);

const dnaFails = fails.length;

// ══════════════════════════════════════════════════════════════════════════
// ★ 第二节（2026-10-05 扩展）：`lib/dub-styles.json` 的**字段消费覆盖**
//
// ★ 由来（2026-10-05 只读全仓审计）：注册表的 `bgRecipe.textureRaw` 被 **44/44** 个风格声明，
//   但当时**全仓零代码读取** —— 44 个风格声明的细纹理**没有一个被渲染**；而当时 **27 个闸门全绿**，
//   是**人工只读审计**才查出来的。这与第一节那 80% 零消费者字段**同一类**：
//   **注册表声明了，代码没人读** —— 完全可以机械化拦住。
//   ★ 审计后的处置（与本闸门同期发生，故本闸门**不**把 textureRaw 列为缺口）：2026-10-05 起
//   `lib/dub-core.mjs` 的 `resolveTextureName()` 会在**粗粒度 `texture` 落空时**读 `r.textureRaw`
//   （`TEXTURE_RAW_FALLBACK`，只做低风险几个；其余「声明但未实现」逐名登记在
//   `lib/dub-styles.json._notes`）。⇒ 字段级判据看**字段有没有消费者**，不看**取值实现了几成**。
//
// 判据（对注册表里**每一条字段路径**，如 `bgRecipe.textureRaw` / `palette.accent`）：
//   · 在 `DUB_METADATA` 白名单里（**声明「本就不该被渲染消费」**）⇒ 放行（显式列 + 逐条说明为什么算元数据）；
//   · 在 `DUB_UNIMPLEMENTED` 未实现清单里（**本该被消费、当前零读取**）⇒ 放行但**单独高亮**（已知缺口，别忘）；
//   · 否则**有消费者**（运行时代码里 grep 到读取点）⇒ 放行；
//   · 否则 ⇒ ★ **FAIL**（报字段路径 + 涉及风格数 + 修法）。
//   ⇒ 将来「接线了」或「未实现清单变了」时，**改的是清单，不是判据**（照上面 WIRED/PRINT_ONLY 的风格）。
//
// ★ **为什么先查清单、再查消费者**（与常见写法相反，是实测逼出来的）：
//   消费者判据的**叶名匹配**（`.leaf` / `['leaf']` / `{ …, leaf, … }`）会撞**同名标识符**。
//   实测：注册表顶层键 `version` **全仓无人读**，却被 `lemo-make.mjs:1638` 等 4 处的
//   `process.version` 判成「有消费者」⇒ 假阴。先查清单可让「**已声明为元数据**」的字段不再
//   依赖脆弱的叶名匹配；而**未声明**的字段照样要过消费者这一关，牙齿没掉。
//
// ★★ 2026-10-06 收紧：**嵌套路径的消费者判据必须感知路径上下文**（顶层键判据不动）★★
//   由来（实测）：`derivation` 是个**纯元数据对象**（`bg`/`font`/`subtitle`/`accent` 四轴），
//   **渲染侧一个字都不读**；但它的四条子路径全靠**叶名碰撞**被判「有消费者」⇒ **四条全是假绿**：
//     · `derivation.bg`       ← `dub.mjs` / `lib/dub-core.mjs` 的 `.bg`（那是 `palette.bg` 等**别的**对象的）
//     · `derivation.font`     ← **单点**：`server.mjs:136` 的 `'.woff2': 'font/woff2'`（MIME 串，与派生口径毫无关系）
//     · `derivation.subtitle` ← `dub.mjs` / `lib/dub-core.mjs` / `lib/dub-semantic.mjs` / `lib/triple-check.mjs`
//     · `derivation.accent`   ← `lib/briefs.mjs` / `lib/dub-core.mjs`
//   ⇒ 叶名（`bg`/`font`/`subtitle`/`accent`）是**高频通用词**，全仓任意位置命中一次就算「有消费者」，
//     与「这个字段路径真的被人读了吗」毫无关系。**`derivation.font` 尤其脆**：唯一依据是那一个 MIME 串，
//     哪天 `server.mjs` 不再写 `font/woff2`，它就翻成 FAIL —— 判据的结论取决于**无关代码**，这是不可接受的。
//
//   判据形态（**只收紧嵌套路径**；顶层键维持叶名匹配 —— `version` 那类假阴已由清单兜住）：
//     · 顶层键（路径**不含** `.`）：**不变** —— 叶名在**任意**运行时代码里出现即算有消费者。
//     · 嵌套路径（路径**含** `.`）：★ 叶名命中的那个文件**还必须出现父键**（倒数第二段；如
//       `derivation.bg` 的父键是 `derivation`、`bgRecipe.halftone.angle` 的父键是 `halftone`），
//       且父键必须是**代码 token**（`consumerSrc` 已剥注释 ⇒ 注释里提到父键不算）。
//       ⇒ 「叶名在**无关**文件里撞上同名标识符」这一类假绿被消掉。
//   ★ **邻域为什么取「同文件」而不是「同行 / ±N 行」**（先测误报率再定判据，本项目铁律）：
//     真实消费者的**父对象常被别名掉**，父键名与叶名根本不在一个表达式里 —— 实测：
//       `lib/dub-core.mjs:465` `const r = spec.bgRecipe || {};` … `:447` `r.halftone`（隔 18 行）；
//       `subtitle` 的消费者写作 `sub.plateColor`（`:324`）/ `sp.plateColor`（`:825`），**从不写** `subtitle.plateColor`。
//     ⇒ 实测四种邻域的误报（把**真实有消费者**的字段判成无消费者）：
//         同行 → 误报 **8** 条（`bgRecipe.halftone`、`bgRecipe.textureRaw`、`subtitle.plateColor`、
//                `bgRecipe.halftone.{angle,color,field,k,step}`）；±5 行 → 误报 **4** 条；
//         **同文件 → 误报 0 条**，且恰好杀掉 `derivation.*` 四条假绿（该父键在 28 个运行时代码文件里**零出现**）。
//     ⇒ **「同文件」是能杀掉这一类假绿、又零误伤的最小邻域**。再收紧就会开始误伤真实字段。
//   ★ **误报率（定稿前实测，真实注册表 67 条字段路径）**：收紧后判定变化**恰好 4 条**，全部是
//     `derivation.*`（有消费者 → 无消费者）；**其余 63 条判定一字不变**（含 44 条嵌套路径里的 40 条）。
//     这 4 条随即按下面的规则登记进 `DUB_METADATA`（**父键已声明为元数据 ⇒ 子键自然也非渲染字段**）
//     ⇒ 定稿后 FAIL 0、误报 0、漏报（假绿）0（对已识别的这一类）。
//   ★ 未采纳的替代方案（**只报告、本轮不动**）：把规则写成「父键在 `DUB_METADATA` 里 ⇒ 其子路径自动放行」，
//     好处是将来 `derivation` 加第 5 个轴不用再补一行；代价是白名单从「**字段**清单」变成「**字段 + 前缀**清单」，
//     颗粒度变粗。本轮按「显式登记 4 条」处理，保持白名单语义不变（更小的改动）。
//
// ★ 误报率（本项目铁律：先测再定判据）：首跑（加白名单前）命中 **7** 条字段路径 —— 逐条人工分类后
//   **真「声明了没人读」0 条**、**元数据 7 条**（`visualRef` / `hasVisual` / `synthetic` / `derived` /
//   `derivedFrom` / `bgSameAsDefault` / `_notes`；`textureRaw` 已由上面的接线消化）
//   ⇒ 原始判据**误报 7/7**，白名单就是为这 7 条而定的；定完白名单后 FAIL 0、误报 0。
//   ★ 也就是说：**没有白名单，这个判据 100% 误报**；白名单不是装饰，是判据的一半。
//
// ★ 两个必须的守卫（都是实测踩出来的）：
//   ① **去注释**：`textureRaw` 在 `lib/dub-core.mjs` 里**只出现在注释中**（正是那段解释
//      「全仓没有任何代码读它」的注释）⇒ 不剥注释就会把**解释缺陷的注释**当成消费者，
//      闸门当场失明。剥注释后，「属性访问 + 下标 + 解构」/「只认 `.leaf`」/「父键也要出现」
//      三种判据、以及「全 runtime」与「只扫注册表消费者」两种范围，**命中数完全一致（都是 7）**。
//   ② **排除 `scripts/`**：本闸门自己的清单里就写着字符串 `bgRecipe.textureRaw`
//      ⇒ 若把 `scripts/` 算进消费者，闸门会**读到自己**、永远认为它「有消费者」而**永不报警**。
//      `test/`、`_distill/`、`lib/style-skills/` 同理（正文/文档会提到字段名）。
//
// ★ 失明守卫：注册表读不到 / 解析失败 / 枚举到 **0** 条字段路径 ⇒ FAIL 并明说「本闸门已失明」。
// 覆盖点：`LEMO_DUB_STYLES`（注册表路径覆盖，供**非破坏性**变异验证；默认 `lib/dub-styles.json`）。
// ══════════════════════════════════════════════════════════════════════════

const DUB_STYLES_FILE = process.env.LEMO_DUB_STYLES || path.join(ROOT, 'lib', 'dub-styles.json');

/** 元数据白名单：**本就不该被渲染消费**，只供人工 / 审计 / 下游智能体追溯。
 *  ★ 加一条必须写清「为什么算元数据」—— 这是唯一的人工判断入口，也是本闸门的咽喉。 */
const DUB_METADATA = {
  'visualRef': '指向 lib/dub-visual.json 证据条目的**外键**（证据层），供审计追溯，不进渲染',
  'hasVisual': '该条目**是否有真实 demo 证据**的布尔标记（合成基线 plain-dark 为 false），供人工/审计',
  'synthetic': '该条目**是否为合成基线**（非 styles/<slug>/ 真实风格）的标记，供人工/审计',
  'derived': '该条目**是否为派生条目**的标记，供人工/审计',
  'derivedFrom': '派生**来源列表**（如 hardcoded-baseline），供人工/审计',
  'bgSameAsDefault': '背景**是否与默认风格一致**的标记，供人工/审计（渲染读的是 bgRecipe 本身）',
  'derivation': '每条风格**派生口径**的机器可读标记（`bg`/`font`/`subtitle`/`accent` 四轴各取一个枚举值，说明该值是**原文值**还是**代理取色 / 本机字体替代 / 规则推得 / 落回默认**）—— 由 `scripts/check-derivation-caliber.mjs` **独占消费**（逐条机械重算并比对），**渲染侧一个字都不读它**，供人工/审计；判据写在注册表顶层 `_notes` 第 19–23 条',
  // ★ 2026-10-06 补 4 条：`derivation` 的**子键**。依据同父键 —— **父键已声明为元数据（渲染侧零读取）⇒ 其子键自然也非渲染字段**。
  //   为什么必须显式登记：这四条此前**全靠叶名碰撞**被判「有消费者」（= **假绿**，详见文件头「收紧」一节）——
  //   叶名 `bg`/`font`/`subtitle`/`accent` 是高频通用词，撞上的是**别的对象**的读取点（`palette.bg` 等），
  //   其中 `derivation.font` 是**单点**：唯一依据是 `server.mjs:136` 的 `'.woff2': 'font/woff2'`（MIME 串）。
  //   嵌套判据收紧后它们正确地变成「无消费者」⇒ 由本清单承接（**父键在、子键就该在**，不是新增豁免）。
  'derivation.bg': '`derivation` 的子键（派生口径的 `bg` 轴，枚举值如 `exact`/`proxy`/`absent`）—— 同父键：由 `scripts/check-derivation-caliber.mjs` 独占消费，**渲染侧一个字都不读**；★ 此前被 `dub.mjs` / `lib/dub-core.mjs` 里**别的对象**的 `.bg`（`palette.bg` 等）叶名碰撞判成「有消费者」= 假绿，嵌套判据收紧后登记于此',
  'derivation.font': '`derivation` 的子键（派生口径的 `font` 轴）—— 同父键：非渲染字段；★★ 此前是**单点假绿**：全仓唯一「消费者」是 `server.mjs:136` 的 `\'.woff2\': \'font/woff2\'`（**MIME 类型串**，与派生口径毫无关系），哪天它没了本字段就翻 FAIL ⇒ 判据结论取决于无关代码，故显式登记',
  'derivation.subtitle': '`derivation` 的子键（派生口径的 `subtitle` 轴）—— 同父键：非渲染字段；★ 此前被 `dub.mjs` / `lib/dub-core.mjs` / `lib/dub-semantic.mjs` / `lib/triple-check.mjs` 里 `palette.subtitle` / `subtitle.*` 等同名叶碰撞判成「有消费者」= 假绿，嵌套判据收紧后登记于此',
  'derivation.accent': '`derivation` 的子键（派生口径的 `accent` 轴）—— 同父键：非渲染字段；★ 此前被 `lib/briefs.mjs` / `lib/dub-core.mjs` 里 `palette.accent` 的同名叶碰撞判成「有消费者」= 假绿，嵌套判据收紧后登记于此',
  'version': '注册表 **schema 版本号**（当前无兼容性判据读它；★ 实测它会被 `process.version` 这类同名碰撞误判成「有消费者」，故显式声明为元数据），供人工/审计',
  '_notes': '项目约定：`_` 前缀 = **文件内文档**（本文件是唯一可渲染消费入口的说明；含「声明但未实现的细纹理」逐名清单），非渲染字段',
};

/** 未实现清单：字段**本该被消费**、当前零读取 —— 不是「没问题」，是「**已知缺口，已登记**」。
 *  ★ 进这里必须写清「谁拍板、为什么先不接线」；否则就是拿它当万能豁免，闸门失效。
 *  ★ 当前**为空**：审计查出的 `bgRecipe.textureRaw` 已于 2026-10-05 由
 *    `lib/dub-core.mjs#resolveTextureName` 接线（粗粒度落空时读它）⇒ 它现在是「有消费者」，
 *    走不到本清单。留空表是为了保留**这个出口**（下次再有「声明了没人读、但暂不接线」的字段，
 *    登记在这里，而不是去改判据）。 */
const DUB_UNIMPLEMENTED = {};

const CONSUMER_EXTS = new Set(['.mjs', '.js', '.cjs', '.html']);
const CONSUMER_SKIP_DIRS = new Set(['node_modules', 'scripts', 'test', '_distill', 'creative', 'style-skills', '.bak', '.git']);

/** 收集**运行时代码**文件（根级 + lib/ + web/；跳过闸门/测试/文档/备份/临时）。 */
function walkConsumers(dir, out = []) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (e.isDirectory()) {
      if (CONSUMER_SKIP_DIRS.has(e.name) || /^_tmp/.test(e.name)) continue;
      walkConsumers(path.join(dir, e.name), out);
    } else if (CONSUMER_EXTS.has(path.extname(e.name))) out.push(path.join(dir, e.name));
  }
  return out;
}

/** 去注释（行注释 + 块注释），**保留字符串内容**。★ 不剥注释 ⇒ 解释缺陷的注释会被当成消费者。 */
function stripComments(s) {
  let out = '', i = 0; const n = s.length; let state = 'code';
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") state = 'sq'; else if (c === '"') state = 'dq'; else if (c === '`') state = 'tpl';
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += c; } i++; continue; }
    if (state === 'block') { if (c === '*' && d === '/') { state = 'code'; i += 2; } else { if (c === '\n') out += c; i++; } continue; }
    const q = state === 'sq' ? "'" : state === 'dq' ? '"' : '`';
    out += c;
    if (c === '\\') { out += s[i + 1] ?? ''; i += 2; continue; }
    if (c === q) state = 'code';
    i++;
  }
  return out;
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 枚举注册表的全部字段路径：顶层键 + 每风格键 + 二级 + 三级（对象才下钻，数组不下钻）。 */
function collectDubPaths(dub) {
  const set = new Set();
  for (const k of Object.keys(dub)) {
    if (k === 'styles') continue;
    set.add(k);
  }
  for (const st of dub.styles) {
    for (const [k, v] of Object.entries(st)) {
      set.add(k);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v)) {
          set.add(`${k}.${k2}`);
          if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
            for (const k3 of Object.keys(v2)) set.add(`${k}.${k2}.${k3}`);
          }
        }
      }
    }
  }
  return [...set].sort();
}

/** 有多少个风格声明了这条路径（顶层键返回 0，表示「注册表级」）。 */
function dubCoverage(dub, fp) {
  const seg = fp.split('.');
  let n = 0;
  for (const st of dub.styles) {
    let o = st, ok = true;
    for (const s of seg) {
      if (o && typeof o === 'object' && !Array.isArray(o) && s in o) o = o[s]; else { ok = false; break; }
    }
    if (ok) n++;
  }
  return n;
}

const dubFails = [];
let dub = null, dubReadErr = '';
try { dub = JSON.parse(fs.readFileSync(DUB_STYLES_FILE, 'utf8')); }
catch (e) { dubReadErr = e.message; }
const dubStylesOk = dub && Array.isArray(dub.styles) && dub.styles.length > 0;
const dubPaths = dubStylesOk ? collectDubPaths(dub) : [];

// ── ★ 失明守卫：读不到 / 解析失败 / 枚举到 0 条字段路径 ⇒ FAIL（否则「0 命中」会静默假绿）──
if (!dubStylesOk || dubPaths.length === 0) {
  dubFails.push(
    `✘ 失明：${DUB_STYLES_FILE} ${dubReadErr ? `读取/解析失败（${dubReadErr}）` : '里 styles[] 为空'}`
    + ` ⇒ 枚举到 ${dubPaths.length} 条字段路径，**本闸门已失明**（什么都没检查）`,
  );
}

const consumerFiles = walkConsumers(ROOT).filter((f) => path.resolve(f) !== path.resolve(DUB_STYLES_FILE));
const consumerSrc = new Map();
for (const f of consumerFiles) {
  try { consumerSrc.set(f, stripComments(fs.readFileSync(f, 'utf8'))); } catch { /* 读不到就当无内容 */ }
}

/** 有消费者？
 *  · **顶层键**（路径**不含** `.`）：判据维持原样 —— 叶名以「属性访问 `.leaf` / 下标 `['leaf']` /
 *    字面量 `{ …, leaf, … }`」在**任意**运行时代码里出现即算有消费者（`version` 那类同名碰撞由 `DUB_METADATA` 兜住）。
 *  · **嵌套路径**（路径**含** `.`）：★ 收紧 —— 叶名命中的那个文件**还必须出现父键**（倒数第二段：
 *    `derivation.bg` 的父键是 `derivation`、`bgRecipe.halftone.angle` 的父键是 `halftone`），
 *    且父键必须是**代码 token**（`consumerSrc` 已剥注释 ⇒ 只在注释里提父键不算）。
 *    ⇒ 「叶名在**无关**文件里撞上同名标识符」这一类假绿被消掉（实测：`derivation.*` 四条）。
 *  · **邻域取「同文件」的依据**（实测，见文件头「收紧」一节）：真实消费者的父对象常被别名掉
 *    （`const r = spec.bgRecipe` → `r.halftone`；`sub.plateColor`），同行 / ±5 行会误伤
 *    **4~8** 条真实字段；「同文件」误报 **0** 且足以杀掉 `derivation.*`（其父键在运行时代码里零出现）。 */
function dubHasConsumer(fp) {
  const segs = fp.split('.');
  const leaf = segs[segs.length - 1];
  const parent = segs.length > 1 ? segs[segs.length - 2] : null;   // ★ 顶层键 → null ⇒ 判据不变
  const pats = [
    new RegExp(`\\.${escRe(leaf)}\\b`),
    new RegExp(`\\[\\s*['"\`]${escRe(leaf)}['"\`]\\s*\\]`),
    new RegExp(`\\{[^{}]*\\b${escRe(leaf)}\\b[^{}]*\\}`),
  ];
  const parentRe = parent ? new RegExp(`\\b${escRe(parent)}\\b`) : null;
  for (const s of consumerSrc.values()) {
    if (!pats.some((p) => p.test(s))) continue;
    if (parentRe && !parentRe.test(s)) continue;   // ★ 嵌套路径：父键必须同文件（且是代码）出现
    return true;
  }
  return false;
}

const dubConsumed = [], dubMeta = [], dubUnimpl = [], dubOrphan = [], dubNoConsumer = [];
if (dubStylesOk && dubPaths.length) {
  for (const fp of dubPaths) {
    const n = dubCoverage(dub, fp);
    const hasC = dubHasConsumer(fp);
    if (!hasC) dubNoConsumer.push(fp);   // ★ 误报率中间数据：原始判据（「无消费者」）会命中的字段
    // ★ 顺序：**先看清单、再看消费者**（判据建议里是「消费者优先」，此处按实测反了 —— 见文件头
    //   「为什么先查清单」：`version` 会被 `process.version` 这类**同名碰撞**误判成「有消费者」）。
    if (DUB_METADATA[fp]) { dubMeta.push({ fp, n, hasC, why: DUB_METADATA[fp] }); continue; }
    if (DUB_UNIMPLEMENTED[fp]) { dubUnimpl.push({ fp, n, hasC, why: DUB_UNIMPLEMENTED[fp] }); continue; }
    if (hasC) { dubConsumed.push({ fp, n }); continue; }
    dubOrphan.push({ fp, n });
  }
  for (const o of dubOrphan) {
    dubFails.push(
      `${o.fp}：${o.n}/${dub.styles.length} 个风格声明了它，但全仓**零读取**`
      + '（既不是元数据、也不在未实现清单）⇒ **要么接线、要么加进 DUB_METADATA / DUB_UNIMPLEMENTED 并说明**',
    );
  }
}

// ── 输出 ────────────────────────────────────────────────────────────────
console.log(`\n── 第二节：lib/dub-styles.json 字段消费覆盖 ──`);
console.log(`  注册表 : ${DUB_STYLES_FILE}`);
console.log(`  风格数 : ${dubStylesOk ? dub.styles.length : '(读不到)'}`);
console.log(`  消费者 : ${consumerFiles.length} 个运行时代码文件（已剥注释；已排除 scripts/test/_distill/style-skills/备份）`);
console.log(`  字段路径: ${dubPaths.length} 条（顶层键 + 每风格键 + 嵌套）`);
if (dubStylesOk && dubPaths.length) {
  console.log(`\n  ★ 原始判据（「无消费者」）命中 ${dubNoConsumer.length} 条：${dubNoConsumer.join('、') || '（无）'}`);
  console.log(`     ⇒ 其中元数据 ${dubMeta.filter((m) => !m.hasC).length} 条、未实现 ${dubUnimpl.filter((u) => !u.hasC).length} 条、`
    + `未登记 ${dubOrphan.length} 条（★ 只有「未登记」才 FAIL）`);
  console.log(`  ✓ 有消费者 ${dubConsumed.length} 条`);
  console.log(`  ℹ 元数据白名单 ${dubMeta.length} 条（声明「本就不该被渲染消费」）：`);
  for (const m of dubMeta) console.log(`      · ${m.fp.padEnd(20)} 覆盖 ${m.n}/${dub.styles.length}${m.hasC ? '（另有同名碰撞，不影响结论）' : ''} —— ${m.why}`);
  console.log(`  ⚠ 未实现清单 ${dubUnimpl.length} 条（**本该被消费、当前零读取**，已登记不判 FAIL）：`);
  for (const u of dubUnimpl) console.log(`      · ${u.fp.padEnd(20)} 覆盖 ${u.n}/${dub.styles.length} —— ${u.why}`);
  if (dubOrphan.length) {
    console.log(`\n  ✘ 声明了没人读、且两个清单都没有 ${dubOrphan.length} 条：`);
    for (const o of dubOrphan) console.log(`      · ${o.fp.padEnd(20)} 覆盖 ${o.n}/${dub.styles.length}`);
  }
}
if (dubFails.length) {
  console.log(`\n✘ 第二节失败 ${dubFails.length} 条：`);
  for (const f of dubFails) console.log(`  ✘ ${f}`);
} else if (dubStylesOk && dubPaths.length) {
  console.log(`\n✓ 第二节：注册表每条字段路径都「有消费者」或「已在清单里注明」。`);
}

// ══════════════════════════════════════════════════════════════════════════
// ★ 第三节（2026-10-05）：`bgRecipe.textureRaw` 的**取值级**实现状态
//
// ★ 由来（就是第二节自己登记的「已知边界」）：第二节判的是**字段级** ——「有没有人读
//   `bgRecipe.textureRaw` 这个字段」。它答不了「**声明了 31 个取值，渲染侧实现了几成**」。
//   而这个缺口**真实发生过**：`textureRaw` 有 31 个取值，渲染侧只实现了一部分，状态却只写在
//   `lib/dub-styles.json._notes` 的**散文**里（+ 19 份 `SKILL.md` §11 的散文条目）⇒
//   一旦有人实现了某个纹理（或反过来），散文**不会自动跟着变**、闸门也**看不见** ——
//   那种「声明了没人读」的失配**还会再长出来**。本节把它变成**可机械校验**的判据。
//
// ★ 判据**不需要改 schema**：渲染侧有一个**权威的「可解析名字集合」R**，从
//   `lib/dub-core.mjs` **源码抽**出来（不手抄 —— 源码一改，判据自动跟）：
//     R = `bgFilters()` 里 `switch (tex)` 的 **case 标签**
//       ∪ `TEXTURE_SYNONYMS` 的**键**（仅当其归一化目标确实是某个 case 标签）
//       ∪ `TEXTURE_RAW_FALLBACK` 的**键**（同上）
//       ∪ {`none`}
//   `none` 必须显式计入：它是「不叠纹理」的**正确实现**（`resolveTextureName` 返回 none ⇒
//   switch 走 `default`），否则 5 个声明 `none` 的风格会被误判成「声明了没人实现」。
//   ⇒ **「某风格声明的 `textureRaw` 是否被实现」= 「它是否落在 R 里」** ⇒ 可机械计算。
//
// ★ 判据（双向，两条都要）：
//   (A) **声明但未标**：某风格 `textureRaw` 的值 **∉ R**（渲染侧没实现），但散文清单里
//       **没有**它 ⇒ **FAIL**（渲染侧落空、文档也不说 ⇒ 照文档干活的人被误导）；
//   (B) **标了但已实现**：某风格 `textureRaw` 的值 **∈ R**（已实现/已映射），散文清单里
//       **仍列着**它 ⇒ **FAIL**（实现了却不更新散文 ⇒ 文档开始撒谎）。
//   另加 4 条防「清单自己腐烂」的对称判据（都 FAIL）：清单里的名字**已无人声明**；
//   豁免表条目**已过期**（名字变得可解析）或**已无人声明**；同一个名字**同时**出现在清单与豁免表。
//   以及 **slug 级**核对：散文逐名带了受影响 slug，若某风格声明了该值却没被列进去 ⇒ FAIL
//   —— 否则「新增一个风格用了 `cel`」这类漂移看不见。
//
// ★ 误报率（本项目铁律：先测再定判据）：**原始判据（只看 R）首跑命中 2 条** ——
//   `vignette`（art-deco）、`paper-grain`（paper-lantern）。逐条人工分类：
//   **真不一致 0 / 误报 2（100%）**。这两名渲染侧**确实有归宿**，只是归宿**不是纹理名**：
//   `vignette` 由 `bgRecipe.vignette`（`bgFilters()` 的 `if (vig > 0.001)` 分支）画成暗角；
//   `paper-grain` 与粗粒度 `texture: paper` 的 `noise=alls=9:allf=t+u` 是同物。
//   ⇒ 加**豁免表** `TEXTURE_COVERED_BY_OTHER`（本判据**唯一的人工判断入口**，与第二节的
//     `DUB_METADATA` 同性质：「白名单不是装饰，是判据的一半」）⇒ 命中 **0** / 误报 **0**。
//   ★★ 关键推论：这 2 名**不可解析但确实已实现** ⇒ **「可解析集合 R」≠「已实现集合」**。
//     实测分解：31 个声明取值 = 落在 R 里 **11** + 声明但未实现 **18** + 豁免 **2**。
//     ⇒ **不能**拿 R 直接当「已实现全集」（那样会误报 2 条）。
//
// ★ 失明守卫（本判据**依赖解析源码**，源码一改就可能悄悄抽不到 —— 这一条尤其重要）：
//   ① `dub-core.mjs` 读不到；② 抽不到 `TEXTURE_SYNONYMS` / `TEXTURE_RAW_FALLBACK` 表；
//   ③ 找不到 `export function bgFilters(` 或其中的 `switch (tex) {`（或被删/改名/括号不配对）；
//   ④ 抽到的 R 为空；⑤ 注册表读不到 / `styles[]` 为空 / 0 个风格声明 textureRaw；
//   ⑥ 散文里找不到「★ textureRaw **声明但未实现**」条目（找不到就分不清「清单为空」与
//      「散文被重构」，(B) 会静默失去覆盖面）
//   ⇒ 一律 **FAIL 并明说「本闸门已失明」**（否则「0 命中」会静默假绿）。
// 覆盖点：`LEMO_DUB_CORE`（`dub-core.mjs` 路径覆盖）+ 复用第二节的 `LEMO_DUB_STYLES`，
//   两者都供**非破坏性**变异验证（默认读真实文件）。
// ══════════════════════════════════════════════════════════════════════════

const DUB_CORE_FILE = process.env.LEMO_DUB_CORE || path.join(ROOT, 'lib', 'dub-core.mjs');

/** ★ 豁免表：名字**不可解析**、但渲染侧**由别的字段覆盖** ⇒ 不列入「未实现清单」。
 *  ★ 加一条必须写清「哪个字段覆盖了它、在 `dub-core.mjs` 的哪个分支」——
 *    这是本判据唯一的人工判断入口；豁免条目一旦变得可解析，本闸门会判它「过期」并 FAIL。 */
const TEXTURE_COVERED_BY_OTHER = {
  'vignette': 'art-deco：`bgRecipe.vignette: 0.35` 已由 `bgFilters()` 的 `if (vig > 0.001)` 分支画成暗角 ⇒ 同一质感不必再当纹理叠一遍',
  'paper-grain': 'paper-lantern：粗粒度 `texture: paper` 的 `noise=alls=9:allf=t+u` 就是纸纹颗粒 ⇒ 细名与粗名同物',
};

const texFails = [];
const texBlind = [];
const texRows = { impl: [], unimpl: [], exempt: [], miss: [] };

const lineAt = (src, idx) => src.slice(0, idx).split('\n').length;

/** `{` 的配对 `}` 下标（跳过注释 / 字符串 / 模板串）；不配对返回 −1。 */
function matchBrace(src, openIdx) {
  let depth = 0, state = 'code';
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i], d = src[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; i++; continue; }
      if (c === '/' && d === '*') { state = 'block'; i++; continue; }
      if (c === "'" || c === '"' || c === '`') { state = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return i; }
      continue;
    }
    if (state === 'line') { if (c === '\n') state = 'code'; continue; }
    if (state === 'block') { if (c === '*' && d === '/') { state = 'code'; i++; } continue; }
    if (c === '\\') { i++; continue; }
    if (c === state) state = 'code';
  }
  return -1;
}

/** 从 `const NAME = Object.freeze({ … })` 抽 `'键': '值'`（值只认字符串字面量）。 */
function extractFrozenTable(src, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*Object\\.freeze\\(\\s*\\{`);
  const m = re.exec(src);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const close = matchBrace(src, open);
  if (close < 0) return null;
  const body = src.slice(open + 1, close);
  const out = new Map();
  const pr = /(?:^|[\s,{])(?:'([^']*)'|"([^"]*)"|([A-Za-z_$][\w$]*))\s*:\s*(?:'([^']*)'|"([^"]*)")\s*(?=[,}\n])/gm;
  let pm;
  while ((pm = pr.exec(body)) !== null) {
    out.set(pm[1] ?? pm[2] ?? pm[3], { to: pm[4] ?? pm[5], line: lineAt(src, open + 1 + pm.index) });
  }
  return { map: out, line: lineAt(src, m.index) };
}

/** 抽 `bgFilters()` 内 `switch (tex)` 的 case 标签（只收该 switch **直接层**的 `case '<字面量>':`）。 */
function extractSwitchCases(src) {
  const fm = /export\s+function\s+bgFilters\s*\(/.exec(src);
  if (!fm) return { ok: false, why: '找不到 `export function bgFilters(`' };
  const sm = /switch\s*\(\s*tex\s*\)\s*\{/.exec(src.slice(fm.index));
  if (!sm) return { ok: false, why: '`bgFilters()` 里找不到 `switch (tex) {`' };
  const open = fm.index + sm.index + sm[0].length - 1;
  const close = matchBrace(src, open);
  if (close < 0) return { ok: false, why: '`switch (tex)` 的 `{` 不配对' };
  const body = src.slice(open + 1, close);
  const cases = new Map();
  let j = 0, depth = 0, state = 'code';
  while (j < body.length) {
    const c = body[j], d = body[j + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; j += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; j += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { state = c; j++; continue; }
      if (c === '{') { depth++; j++; continue; }
      if (c === '}') { depth--; j++; continue; }
      const prev = j === 0 ? '' : body[j - 1];
      if (depth === 0 && body.startsWith('case', j) && !/[\w$.]/.test(prev) && !/[\w$]/.test(body[j + 4] || '')) {
        const cm = /^case\s+(['"])([^'"]*)\1\s*:/.exec(body.slice(j));
        if (cm) { cases.set(cm[2], lineAt(src, open + 1 + j)); j += cm[0].length; continue; }
      }
      j++; continue;
    }
    if (state === 'line') { if (c === '\n') state = 'code'; j++; continue; }
    if (state === 'block') { if (c === '*' && d === '/') { state = 'code'; j += 2; } else j++; continue; }
    if (c === '\\') { j += 2; continue; }
    if (c === state) state = 'code';
    j++;
  }
  return { ok: true, cases, line: lineAt(src, fm.index) };
}

let coreSrc = '', coreReadErr = '';
try { coreSrc = fs.readFileSync(DUB_CORE_FILE, 'utf8'); } catch (e) { coreReadErr = e.message; }

const syn = coreSrc ? extractFrozenTable(coreSrc, 'TEXTURE_SYNONYMS') : null;
const fb = coreSrc ? extractFrozenTable(coreSrc, 'TEXTURE_RAW_FALLBACK') : null;
const swc = coreSrc ? extractSwitchCases(coreSrc) : { ok: false, why: '源码读不到' };

if (!coreSrc) texBlind.push(`读不到 ${DUB_CORE_FILE}${coreReadErr ? `（${coreReadErr}）` : ''}`);
else {
  if (!syn) texBlind.push('抽不到 `const TEXTURE_SYNONYMS = Object.freeze({…})`');
  if (!fb) texBlind.push('抽不到 `const TEXTURE_RAW_FALLBACK = Object.freeze({…})`');
  if (!swc.ok) texBlind.push(swc.why);
}
if (!dubStylesOk) texBlind.push(`注册表读不到 / \`styles[]\` 为空：${DUB_STYLES_FILE}${dubReadErr ? `（${dubReadErr}）` : ''}`);

const caseLabels = swc.ok ? swc.cases : new Map();
const R = new Map();          // 可解析名字 → 出处
for (const [k, l] of caseLabels) R.set(k, `switch case @dub-core.mjs:${l}`);
for (const [k, o] of (syn?.map || new Map())) if (caseLabels.has(o.to)) R.set(k, `TEXTURE_SYNONYMS → ${o.to} @dub-core.mjs:${o.line}`);
for (const [k, o] of (fb?.map || new Map())) if (caseLabels.has(o.to)) R.set(k, `TEXTURE_RAW_FALLBACK → ${o.to} @dub-core.mjs:${o.line}`);
if (caseLabels.size) R.set('none', '落空/空操作：`resolveTextureName()` 返回 none ⇒ switch 走 `default`、不叠纹理 = 正确实现');
if (!texBlind.length && R.size === 0) texBlind.push('抽到的可解析名字集合 R 为空（switch 里一个 case 都没有？）');

// ── 注册表侧：每个风格的 textureRaw（口径与 `resolveTextureName` 一致：空 ⇒ none）──
const declaredTex = new Map();   // raw → [slug]
const rawBySlug = new Map();     // slug → raw
if (dubStylesOk) {
  for (const st of dub.styles) {
    const slug = st.slug || st.id;
    const raw = String((st.bgRecipe || {}).textureRaw ?? '').trim().toLowerCase() || 'none';
    rawBySlug.set(slug, raw);
    if (!declaredTex.has(raw)) declaredTex.set(raw, []);
    declaredTex.get(raw).push(slug);
  }
  if (declaredTex.size === 0) texBlind.push('注册表里 0 个风格声明 `bgRecipe.textureRaw`');
}

// ── 散文侧：`_notes` 的「声明但未实现」条目（格式固定：`名字`（slug、slug））──
const notes = Array.isArray(dub?._notes) ? dub._notes : [];
const unimplNote = notes.find((n) => /textureRaw\s*\*\*声明但未实现\*\*/.test(n)) || null;
const U = new Map();             // 未实现名字 → [slug]
if (unimplNote) {
  const re = /`([^`]+)`（([^）]*)）/g;
  let m;
  while ((m = re.exec(unimplNote)) !== null) {
    U.set(m[1], m[2].split(/[、/]/).map((s) => s.trim()).filter(Boolean));
  }
}
if (!unimplNote) texBlind.push('散文里找不到「★ textureRaw **声明但未实现**」条目（找不到就分不清「清单为空」与「散文被重构」）');

// ── 判据 ────────────────────────────────────────────────────────────────
if (!texBlind.length && dubStylesOk) {
  for (const [raw, slugs] of [...declaredTex.entries()].sort()) {
    if (R.has(raw)) texRows.impl.push({ raw, slugs });
    else if (U.has(raw)) texRows.unimpl.push({ raw, slugs });
    else if (TEXTURE_COVERED_BY_OTHER[raw]) texRows.exempt.push({ raw, slugs });
    else texRows.miss.push({ raw, slugs });
  }
  // (A) 声明但未标
  for (const r of texRows.miss) {
    texFails.push(`(A) 声明但未标：${r.slugs.join(' / ')} 声明 \`bgRecipe.textureRaw="${r.raw}"\`，但渲染侧**不可解析**`
      + '（既不是 `bgFilters()` 的 case，也不在 `TEXTURE_SYNONYMS` / `TEXTURE_RAW_FALLBACK` 里），'
      + '散文清单也没登记它 ⇒ **要么在 `lib/dub-core.mjs` 里实现它、要么把 `lib/dub-styles.json._notes` 的清单改对**');
  }
  // (B) 标了但已实现
  for (const [name, slugs] of U) {
    if (R.has(name)) {
      texFails.push(`(B) 标了但已实现：散文清单把 \`${name}\` 列为「声明但未实现」（受影响 slug：${slugs.join(' / ') || '—'}），`
        + `但它**已经可解析**（${R.get(name)}）⇒ **要么把清单改对、要么说明为什么它仍算未实现**`);
    }
    if (!declaredTex.has(name)) {
      texFails.push(`(A4) 清单腐烂：散文清单里的 \`${name}\` 已经**没有任何风格声明**（清单记的受影响 slug：${slugs.join(' / ') || '—'}）`
        + ' ⇒ 把这条从清单里删掉（或把 slug 写对）');
    }
  }
  // 豁免表自身
  for (const [name, why] of Object.entries(TEXTURE_COVERED_BY_OTHER)) {
    if (R.has(name)) {
      texFails.push(`(A3) 豁免过期：豁免表把 \`${name}\` 记为「不可解析但由别的字段覆盖」，但它**已经可解析**（${R.get(name)}）`
        + ' ⇒ 从 `TEXTURE_COVERED_BY_OTHER` 里删掉');
    }
    if (!declaredTex.has(name)) {
      texFails.push(`(A5) 豁免腐烂：豁免表里的 \`${name}\` 已经**没有任何风格声明** ⇒ 删掉它（原由：${why}）`);
    }
    if (U.has(name)) {
      texFails.push(`(A6) 自相矛盾：\`${name}\` **同时**出现在散文「未实现清单」与闸门「豁免表」里 ⇒ 二选一（同一个名字不能既是「没归宿」又是「有归宿」）`);
    }
  }
  // slug 级：散文逐名带了受影响 slug —— 反向核对
  for (const [slug, raw] of rawBySlug) {
    if (R.has(raw)) continue;
    const inU = (U.get(raw) || []).includes(slug);
    const inE = !!TEXTURE_COVERED_BY_OTHER[raw];
    if (!inU && !inE) {
      texFails.push(`(A') 声明但未标（逐风格）：${slug} 的 \`textureRaw="${raw}"\` 不可解析，`
        + `但散文清单没把这个 slug 列在 \`${raw}\` 名下 ⇒ **要么实现它、要么把清单改对**`);
    }
  }
  for (const [name, slugs] of U) {
    for (const s of slugs) {
      if (!rawBySlug.has(s)) {
        texFails.push(`(A4') 清单里的 slug \`${s}\` 在注册表里**不存在**（挂在 \`${name}\` 名下）⇒ 把清单改对`);
      } else if (rawBySlug.get(s) !== name) {
        texFails.push(`(A4') 清单写错：清单把 \`${s}\` 挂在 \`${name}\` 名下，但它实际的 \`textureRaw="${rawBySlug.get(s)}"\` ⇒ 把清单改对`);
      }
    }
  }
}

// ── 输出 ────────────────────────────────────────────────────────────────
console.log(`\n── 第三节：lib/dub-styles.json 的 bgRecipe.textureRaw **取值级**实现状态 ──`);
console.log(`  渲染源 : ${DUB_CORE_FILE}`);
if (texBlind.length) {
  console.log('  ✘ **本闸门已失明**（判据依赖解析 `dub-core.mjs` 源码，抽不到就等于什么都没检查）：');
  for (const b of texBlind) console.log(`      · ${b}`);
} else {
  console.log(`  抽取点 : bgFilters@dub-core.mjs:${swc.line}、TEXTURE_SYNONYMS@:${syn.line}、TEXTURE_RAW_FALLBACK@:${fb.line}`);
  console.log(`  可解析集合 R：${R.size} 个 = switch case ${caseLabels.size} + 同义 ${syn.map.size} + 回退 ${fb.map.size} + none`);
  console.log(`      ${[...R.keys()].join('、')}`);
  console.log(`  注册表声明 ：${declaredTex.size} 个取值 / ${dub.styles.length} 个风格`);
  console.log(`    ✓ 落在 R 里（已实现）      ${String(texRows.impl.length).padStart(2)}：${texRows.impl.map((r) => r.raw).join('、') || '（无）'}`);
  console.log(`    ⚠ 声明但未实现（散文已登记）${String(texRows.unimpl.length).padStart(2)}：${texRows.unimpl.map((r) => r.raw).join('、') || '（无）'}`);
  console.log(`    ℹ 不可解析但由别的字段覆盖  ${String(texRows.exempt.length).padStart(2)}：${texRows.exempt.map((r) => r.raw).join('、') || '（无）'}`);
  console.log(`    ✘ 不可解析且**没登记**      ${String(texRows.miss.length).padStart(2)}：${texRows.miss.map((r) => r.raw).join('、') || '（无）'}`);
  console.log(`  ★ R 是「可解析」、**不是**「已实现全集」：有 ${texRows.exempt.length} 名不可解析却确实有归宿（见 TEXTURE_COVERED_BY_OTHER）。`);
}
if (texFails.length) {
  console.log(`\n✘ 第三节失败 ${texFails.length} 条：`);
  for (const f of texFails) console.log(`  ✘ ${f}`);
} else if (!texBlind.length) {
  console.log('\n✓ 第三节：每个 textureRaw 取值要么「可解析」、要么在散文清单 / 豁免表里；清单与豁免表都没有腐烂。');
}

const texFailCount = texFails.length + texBlind.length;
console.log(`\n[闸门] 第一节 已接线断点 ${dnaFails} 处；第二节 字段覆盖失败 ${dubFails.length} 条；第三节 textureRaw 取值级失败 ${texFailCount} 条 ${(dnaFails || dubFails.length || texFailCount) ? '✘' : 'OK'}`);
process.exitCode = (dnaFails || dubFails.length || texFailCount) ? 1 : 0;
