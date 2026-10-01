// lib/portscan.mjs —— 监听端口「向后扫描」的**纯决策**逻辑（零依赖）
//
// ★ 为什么单独抽一层：server.mjs 里那段「EACCES（端口落在 Windows 保留段）→ 向后扫下一个」
//   要触发它，得先制造一个真实的保留端口段 —— 那需要改系统配置（netsh），测试没法在真实
//   环境里复现。把**决策**与**绑定 IO** 分开、把「绑定一次」作为参数注入，就能用一个假的
//   binder 精确覆盖四条分支（成功 / EADDRINUSE / 其它错误 / 扫到边界），不碰任何系统配置。
//
// ★ 判据必须与 server.mjs 原实现**逐字一致**：
//     - 最多向后扫 MAX_SCAN 个端口（含 want 本身，故循环 i 取 0..MAX_SCAN）；
//     - 端口号超过 65535 直接放弃（与原来的 `if (port > 65535) break` 等价）；
//     - EADDRINUSE 与「其它错误」都**不后扫** —— 只有 EACCES 才继续往后找。
//   server.mjs 的 start() 只负责把这里的返回值翻译成人话日志 + 退出码。

/** 最多向后扫多少个端口（与 server.mjs 的 start() 共用同一常量，避免两处漂移）。 */
export const MAX_SCAN = 40;

/** TCP 端口上限。 */
export const MAX_PORT = 65535;

/**
 * 从 want 开始逐个尝试绑定，直到成功、或撞上一个「不该后扫」的错误、或扫到边界。
 *
 * @param {number} want 期望端口
 * @param {(port:number)=>Promise<{ok:boolean, code?:string}>} tryFn 绑定一次（server.mjs 传 tryListen）
 * @param {number} [maxScan] 最多向后扫多少个端口（默认 MAX_SCAN）
 * @returns {Promise<
 *   {ok:true, port:number, want:number, moved:boolean} |
 *   {ok:false, reason:'inuse'|'error'|'exhausted', want:number, port?:number, code?:string}
 * >}
 *   reason 的含义：
 *     inuse     —— 真被别的进程占了（EADDRINUSE）→ 调用方应直接报错退出，**不换端口**
 *     error     —— 其它绑定失败 → 报错退出
 *     exhausted —— 从 want 向后扫满 maxScan 个（或越过 65535）都绑不上
 */
export async function scanPort(want, tryFn, maxScan = MAX_SCAN) {
  for (let i = 0; i <= maxScan; i++) {
    const port = want + i;
    if (port > MAX_PORT) return { ok: false, reason: 'exhausted', want };
    const r = await tryFn(port);
    if (r && r.ok) return { ok: true, port, want, moved: port !== want };
    const code = r && r.code;
    if (code === 'EADDRINUSE') return { ok: false, reason: 'inuse', want, port };
    if (code !== 'EACCES') return { ok: false, reason: 'error', want, port, code };
    // EACCES → 落在 Windows 保留段，继续向后扫
  }
  return { ok: false, reason: 'exhausted', want };
}
