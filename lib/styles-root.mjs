// lib/styles-root.mjs —— 「风格源码根」（`D:\lemo-opuscar\styles`）解析的**唯一**实现。
//
// ★ 它解决什么问题（防漂移）：
//   这个根以前在三个地方**各算一份**：
//     · lib/aspects.mjs  —— 探测影片构图能力（`styles/<slug>/demo/film*.js`）
//     · lib/briefs.mjs   —— 拼 demoDir / styleDir（`/api/briefs/*` 给外部 LLM 的真实路径）
//     · lib/env.mjs      —— 健康检查里数「Windows 库有几个风格目录」
//   三份里**只有 aspects 那份**支持 `LEMO_STYLES_ROOT` 覆盖 ⇒ 设了覆盖点时，闸门看得见假树、
//   工单与健康检查却还在看真树 —— 「同一棵树、两条来源」。收敛成一处后三方**一起**跟着走。
//
// ★ 为什么是**独立模块 + 纯函数**，而不是「把 aspects 的 STYLES_DIR 直接给另两方」：
//   lib/env.mjs 是**最底层**（它定义 `CFG`），而 lib/aspects.mjs **import 了 env.mjs**
//   ⇒ `env.mjs` **不能**反向 import `aspects.mjs`（会成环：env → aspects → env，`CFG` 在环里取到 undefined）。
//   同理，任何「读 CFG 再算根」的中立模块也会成环（它 import env，env 又 import 它）。
//   ⇒ 解法：本模块**不 import env.mjs**，只导出**纯函数** `resolveStylesRoot(winLib)` —— 根由调用方把
//      `CFG.winLib` 传进来。于是 env.mjs 也能用它，且**不成环**（依赖方向单向：env/aspects/briefs → styles-root）。
//
// ★ 纪律：本模块**只依赖 node:path**。不要在这里 import env.mjs / aspects.mjs —— 那会把上面破掉的环重新接上。

import path from 'node:path';

/**
 * 解析「风格源码根」。
 *
 * ★ 覆盖点 `LEMO_STYLES_ROOT`（供非破坏变异验证 / 反向测试）：设了就 `path.resolve` 它；
 *   不设时**逐字节等价于原实现** `path.join(winLib, 'styles')`。
 *
 * @param {string} winLib Windows 库根（= `CFG.winLib`，如 `D:\lemo-opuscar`）
 * @returns {string} 风格源码根
 */
export function resolveStylesRoot(winLib) {
  return process.env.LEMO_STYLES_ROOT
    ? path.resolve(process.env.LEMO_STYLES_ROOT)
    : path.join(winLib, 'styles');
}
