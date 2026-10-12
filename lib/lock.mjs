// lib/lock.mjs —— 并发锁「过期窗口」的**唯一**来源（6 小时）
//
// ★ 为什么单独一个模块：同一个判据此前在**四处**各写一份 ——
//   编排器 `lemo-make.mjs` 的行内字面量 / 控制台 `lib/jobs.mjs` / 交付闸门 `scripts/check-film-delivery.mjs`，
//   三处注释互相自称「与编排器一致 / 逐字对齐」⇒ **同步机制 = 注释**（第七批审计的 F3）。
// ★ 落在这里而不是 `lib/jobs.mjs`：本模块必须是**无依赖的叶子** —— `lib/host-scripts.mjs` 是同一个数的
//   「数值邻居」，而它**不能** import `lib/jobs.mjs`（`jobs → env → host-scripts` 会成环）；
//   反过来 `lib/jobs.mjs` 与交付闸门都能安全 import 本模块 ⇒ 落点只能是叶子模块。
// ★ 语义：`alive && ageMs < LOCK_MAX_AGE_MS` —— 锁里记的 pid 仍在，**且**锁龄未超窗 ⇒ 判「活着」；
//   超窗 ⇒ 视为过期、可接管（编排器接管、控制台报「陈旧锁」、交付闸门不把重渲窗口算进去）。
//   ★ 本常量的消费点**三处**：`lemo-make.mjs:1906`、`lib/jobs.mjs`、`scripts/check-film-delivery.mjs`。
//     第四处「数值相同」的 `lib/host-scripts.mjs` 的 `STALE_MS` **刻意不共用**（关系见下）。
// ★ 与 `lib/host-scripts.mjs` 的 `STALE_MS` 的关系：**数值相同 —— 但 ★ 同值 ≠ 同判据 —— 且刻意不共用本常量** ——
//   两者同属「6h 无生命迹象 ⇒ 必然已死」这一口径，但**证据源与动作都不同**：
//     · 锁  = 「pid + mtime」两个信号，超窗的动作是**接管**（可逆，重跑一次就回来了）；
//     · .sh = 只有 mtime 一个信号，超窗的动作是**删文件**（不可逆）。
//   把可逆策略与不可逆策略绑在同一个数上，会让「锁窗口」的调整**静默**改掉「清扫窗口」
//   ⇒ 各自持有、各自在注释里登记这层关系（见 `lib/host-scripts.mjs` 的 `STALE_MS` 注释）。
export const LOCK_MAX_AGE_MS = 6 * 3600 * 1000;
