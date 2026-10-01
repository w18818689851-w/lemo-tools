# test/ —— lemo 控制台冒烟测试

把「交付后的人工验证」固化下来：起服务 → 打接口 → 跑 dry-run → 校验编排器没被改坏。
**零依赖**（只用 `node:assert` / `node:http` / `node:child_process` / `node:crypto`），没有 jest/mocha/vitest。

```bash
node test/smoke.mjs              # 全部用例，不含完整回归（约 15–40 秒；本机 WSL 冷启动时会到 1–2 分钟）
node test/smoke.mjs --full       # 额外跑一次完整 ascii-crt 回归（约 80 秒起，实测这台机 7 分钟）
node test/smoke.mjs --filter ③   # 只跑名字里含 "③" 的用例
node test/smoke.mjs --keep-server  # 跑完不杀测试服务（调试用，自己记得收）

node test/setup.test.mjs         # 首次运行安装的**纯逻辑**测试（12 条）
node test/ui.test.mjs            # Web UI 层测试：无头 Edge 渲染 DOM + CDP 真点击（21 条）
```

`test/setup.test.mjs` 与 `test/ui.test.mjs` 都是**独立入口**，故意不并进 `smoke.mjs`：安装逻辑、UI 层各自一个数字，三边互不干扰。
`setup.test.mjs` 不起服务、不碰 WSL（只测 `lib/setup.mjs` 的纯函数）；`ui.test.mjs` 自己起一个临时服务 + 无头 Edge。

退出码：**全绿 0 / 有用例失败 1 / 测试自身异常 2**。
最后一行汇总 `N passed, M failed`。

---

## 覆盖了什么（32 条，`--full` 时 33 条）

### ① 编排器未被改坏（红线）

| 用例 | 断言 |
|---|---|
| 编排器 md5 未被改动 | `lemo-make.mjs` 的 md5 == `0554085abb34c50e3e1bcfe8f28ab0e1` |

控制台只是**包装层**，绝不能改编排器。这条是整个项目的红线，失败信息直说「编排器被改动了 —— 控制台不应该修改它」。

### ② 行尾规则未被破坏

| 用例 | 断言 |
|---|---|
| 源码行尾全为 LF | 项目里所有 `.mjs/.js/.css/.html/.md` + `.gitattributes/.gitignore`（含 `test/` 自己）CR 计数 == 0 |
| **所有 `.bat` 均为 CRLF**（不只 `start-console.bat`） | 仓库里每个 `.bat` 都满足 CR > 0 且 CR == LF，失败信息列出文件名与 CR/LF 计数 |
| `.gitattributes` 行尾规则在位 | 含 `* text=auto eol=lf` 与 `*.bat text eol=crlf` |

依据是 `.gitattributes`；这条防的是 **git 操作静默改写源码行尾**（本项目踩过）。
计数用 `Buffer` 逐字节数 `\r` / `\n`，**不用 `grep $'\r'`**（Git Bash 下不可靠）。

### ③ HTTP 接口（测试自己起服务，随机端口）

| 用例 | 断言 |
|---|---|
| `GET /` | 200 · `text/html` · 含 `<!DOCTYPE html>` |
| `GET /api/env` | 200 · `summary.total` 是数字 · `runnable` 是布尔 · `groups` 非空 |
| `GET /api/demos` | 200 · `styles.length == 43` · `categories.length == 9` · `categorized == true` · **0 个未归类** · `count` 与 `styles.length` 一致 |
| `GET /api/films` | 200 · `films` 是数组 |
| `GET /api/jobs` | 200 · `jobs` 是数组 · `queue` 快照存在 |
| `GET /api/console` | 200 · `store.ready === true` |
| `GET /api/style/ascii-crt` | 200 · 渲染结果里**无裸 `<script>`/`<iframe>`** · **无 `on*=` 事件属性** · 无 `javascript:` 伪协议 |
| `GET /api/precheck?slug=ascii-crt` | 200 · `locked`/`stale`/`alive` 都是布尔 · `locked` 与 `stale` 不同时为 true |
| `GET /api/definitely-not-a-route` | 404 |
| `POST /api/run`（非法 slug / 非法 opts） | 400（注入防护） |
| 目录穿越（4 种变形） | 状态码 400/403/404 且响应体不含 server.mjs 源码特征串；**对照**：`/app.js` 必须 200 —— 否则「不是 200」可能只是静态服务整体坏了 |
| markdown 渲染器转义（**单测**） | 直接给 `lib/styles.mjs` 喂 `<script>` / `<img onerror=>` / `javascript:` 链接 / 表格里的 `<svg onload=>`，断言输出里没有可执行内容 |
| 端口后扫决策（**单测**） | 直接测 `lib/portscan.mjs` 的 `scanPort()`（server.mjs 的 `start()` 调的就是它），用**假 binder** 覆盖六条分支：一绑就上（不多试）· **EACCES 才向后扫**（7788→7789→7790→7791，`moved=true`）· EADDRINUSE **不换端口** · 其它错误**不换端口** · 整段保留 → 扫满 `MAX_SCAN+1` 个后放弃 · 越过 65535 立即放弃。并断言 `MAX_SCAN === 40` / `MAX_PORT === 65535` |

> 注入检查只扫**真正的标签**（`<tag …>`），不扫转义后的正文 —— 否则正文里写 `&lt;img onerror=x&gt;`（已转义成纯文本、完全无害）会假阳性。

### ④ dry-run 任务全链路（API 层）

一条用例串起三件事：

1. `POST /api/run` 传 `{slug:'ascii-crt', opts:['--skip-sync','--dry-run']}` → 200 且有 `job.id`
2. 轮询 `GET /api/jobs` 直到该任务结束（超时 60s）→ `status == 'done'` 且 `exitCode == 0`
3. `GET /api/logs/:id` 走 SSE → 至少回放到一行日志、**日志里出现步骤标记 `[1]`**、并且回放了 `end` 事件

跑完把 `job.id` 存进 `ctx.state`，给 ⑥（取消）与 ⑦（断线续传 / 跨重启）当素材。

### ⑤ CLI 未受影响

| 用例 | 断言 |
|---|---|
| CLI dry-run 仍 exit 0 | `node lemo-make.mjs ascii-crt --skip-sync --dry-run` → exit 0 |
| CLI dry-run 打印步骤标记 `[1]` | 输出含 `[1]` |

证明包装层没有破坏命令行用法。

### ⑤+ 完整回归（只在 `--full` 时跑）

`node lemo-make.mjs ascii-crt --skip-sync` → exit 0 且输出含 `MUX_OK`、`src_frames=1435`、`out_frames=1435`。
**默认不跑**（约 80 秒，且会真渲染 + 混流）。

### ⑥ 任务取消 + 进程树真的被收掉

| 用例 | 断言 |
|---|---|
| `DELETE /api/jobs/:id` → canceled | 起一个 `ascii-crt --skip-sync --dry-run`（无害长任务，约 4.5s）→ `DELETE` 返回 200 `{ok:true}` → 轮询到 `status==='canceled'` → **该任务的 pid 用 `process.kill(pid,0)` 复验已消失** → 重复取消返回 400 |
| 取消安装任务（`kind='setup'`）→ WSL 侧无残留 | 本进程内 `jobs.enqueueSetup()` 起一个 `sleep 120` 的 wsl 步骤 → 取消 → 断言 WSL 侧那个 pid **已终止**、进程组内**没有活着的成员**、`sleep` 的 alive 标记**仍在**（证明是被杀死的，不是自然跑完） |

第二条覆盖的就是上一轮那个真 bug 的形态：**`taskkill /T` 管不到 WSL2 虚拟机里的进程**。
取消安装任务时，Windows 侧的 wsl.exe 被杀掉了，Linux 侧的 `sleep`/`git clone` 却继续跑到自然结束
（取消一个 6 GB clone = 点了取消还在后台下载）。修复是 `lib/setup.mjs` 给 child 挂 `_lemoKillExtra`
（`setsid -w` 建进程组 + 读 `/tmp/<uniq>.pgid` + 整组 TERM→KILL），`lib/jobs.mjs` 的
`killJobChild()` 调它。**这条用例就是钉住这个钩子的**：把 `_lemoKillExtra()` 那一行注释掉，
它会立刻 FAIL 并把现场（进程树 / 同组进程）打出来。

> ★ 判「进程死了」**必须看进程状态，不能只看 `kill -0`**：实测整组被杀之后，脚本常以
> **僵尸（`Zs <defunct>`）** 形态留在进程表里（父进程被 taskkill 带走 → 被 pid 1 收养 →
> WSL 的 init 不 reap）。僵尸已经死了，但 `kill -0` 对它**返回成功** —— 只看 `kill -0` 会假阳性。

### ⑦ SSE 断线续传语义

| 用例 | 断言 |
|---|---|
| `?lastEventId=N` 增量补发 | 先全量回放拿到序号序列 → 取中间某个 N → 再带 `lastEventId=N` 连一次 → 收到的行**逐个等于** `n > N` 的那些行（`deepStrictEqual`），且不该出现 `gap`；`hello` 帧的 `resumed===true` / `resumeFrom===N` |
| `Last-Event-ID` 请求头 | 用请求头（浏览器自动重连走这条）续传结果一致；**头与 query 同时给时以头为准** |
| 跨重启 `logSeq` 稳定 | 重启测试服务 → 该任务从磁盘恢复（`restored===true`、状态仍是 `done`）→ 再次全量回放，**序号与日志正文与重启前逐字一致** |
| `gap` 事件（**内存**裁剪） | 造一个真产出 **20050 行**的安装任务（内存上限 `MAX_LOG_LINES=20000`，超出丢最旧）→ 内存里只剩最后 20000 行（首行 `n=55`）→ 从 `lastEventId=1` 续传 → **先发 `gap`**（`from=2 to=54 dropped=53`）再补发剩下的 20000 行 |
| **落盘**轮转（4MB 单任务截断） | 直接调 `lib/store.mjs`：用真实上限 `CAPS.perJobLogBytes` 真写满一次（2400 条 × ~2KB ≈ 4.8MB）→ 断言 ① 文件**不超过**上限（实测轮转到 2.83MB）② **标记行真的写进去了**（第一条、`stream='meta'`、含「超过 4MB 上限，已丢弃最旧的 N 字节」、且 `n > 1`）③ 标记行的 `n == 首条保留行 n - 1` ④ 轮转后**序号连续不跳号**、末条 `n == 写入条数`（保最新）⑤ 从标记行之后续传**不发 `gap`、不重不漏**（把 `lib/jobs.mjs:subscribe` 的 gap 判据原样套一遍） |
| **落盘总量裁剪**（64MB） | 直接调 `lib/store.mjs`：造 **40 × 2MB = 80MB** 测试日志（用户既有日志也计入总量）→ 调 `saveIndex()` → 断言 ① 真裁了（索引条数 < 40）② 留下的是**最新的一段**（严格等于后缀）③ 被裁掉的最旧任务，日志文件**真的被 `dropLog` 删了** ④ 保留下来的文件都还在 ⑤ logs 下没有「本次测试前缀但索引里没有」的**孤儿** ⑥ 总量回到 64MB 以内，且恰好 = `base + 保留数 × 2MB`（实测裁掉最旧 9 条、保留 31 条） |
| **索引条数上限**（120 条） | 直接调 `lib/store.mjs`：造 **130 条**（上限 +10）小日志（512B，确保不撞 64MB 那条路径）→ 调 `saveIndex()` → 断言 ① 索引恰好 120 条 ② 保留的是**最新的 120 条**（严格等于后缀）③ 最旧的 10 条被**永久删除**（文件 + 索引条目都没了）④ 保留的文件都在 ⑤ ★ **无孤儿**：`logs/` 下本次测试的文件数**正好等于**索引条数，且没有索引里不存在的文件 |

> ⑧ / ⑨ 两条会往 `D:\lemo-films\.console` 真写测试数据并覆写 `index.json` ——
> 跑前备份 `index.json`，`finally` 里把测试文件删干净、`index.json` 原样还原。
> 连跑两次结果一致（已实测：用户历史 72 条 / 71 个日志文件 / 184952 字节，跑完分毫不变）。
> ⚠️ 已知边界：⑧ 的窗口内总量会短暂超过 64MB，若此时**另一个进程**（如 18080 上的控制台）
> 恰好也在调 `saveIndex`，它会把这批测试数据算进总量、可能顺带裁掉用户最旧的历史。
> 实测窗口 < 1 秒且控制台空闲，未发生；但这是这条用例固有的、无法用测试内锁消除的风险。

> `gap` 的触发条件（`lib/jobs.mjs:539`）是「保留的第一行序号 > from+1」，也就是**日志被从前面裁掉过**。
> 它确实可达，只有两条路径：内存超 20000 行、或落盘轮转（4MB 截断会写一条 `n = 首行n-1` 的标记行）。
> 上面两条分别走这两条路径：`gap` 那条走**内存**（代价 ~10 秒，2 万次 `appendFileSync`，是默认套件里最慢的一条）；
> **落盘**轮转那条直接调 `store.appendLog()` 写满 4MB（~0.9 秒，因为它不经过 jobs 队列，也不起任何子进程）。
> ★ 落盘轮转那条验的是**数据层的不变量**（标记行位置 + 序号连续）—— 这正是 SSE 续传依赖的东西；
> 真正的「活 SSE 流上续传」由 `gap` 那条覆盖（两者合起来才是完整的）。

### ⑧ 并发锁的真冲突态

| 用例 | 断言 |
|---|---|
| 活 pid 的锁 | 用**一个真的活着的进程**的 pid 写 `D:\lemo-films\.__test-lock__.lock`（第一行 pid、第二行 ISO 时间，与编排器逐字一致）→ `locked===true` / `alive===true` / `stale===false` / `pid` 回显正确 / `message` 有「并发/损坏」的人话解释 |
| 死 pid 的锁 | 用「spawn 一个空 node 进程 → 等它退出 → 复验确实不在」的 pid → `alive===false` / `locked===false` / **`stale===true`**（不误报冲突） |

判据必须与编排器逐字对齐：只有「pid 活着 且 锁龄 < 6h」才是真冲突；陈旧锁编排器会自己接管，
控制台在这里**绝不能**加戏报警。测试锁用 `__test-lock__` 这个不可能与真实风格同名的 slug，
且**只删自己登记过的那一个路径**（绝不按通配符删锁 —— 并发写 mux 会产出损坏的成片）。

### ⑨ 成片文件的 Range 请求

| 请求 | 断言 |
|---|---|
| 无 `Range` | 200 · `Accept-Ranges: bytes` · `Content-Length == 文件大小` · `video/mp4`（测试只收 64KB 就断开，成片 29MB 没必要整份读） |
| `bytes=0-1023` | 206 · `Content-Range: bytes 0-1023/<size>` · 长度 1024 · 收到的前 16 字节与整份开头一致 |
| `bytes=-1024`（后缀） | 206 · `Content-Range: bytes <size-1024>-<size-1>/<size>` · 长度 1024 |
| `bytes=<size>-<size+100>`（起点越界） | 416 · `Content-Range: bytes */<size>` |
| `bytes=abc`（非法） | 416（**如实断言实现行为**：server.mjs 的正则不匹配就 416） |

用真实的成片 `D:\lemo-films\ascii-crt\ascii-crt.mp4`；文件不在时这条用例直接报「成片缺失，验不了」。

---

## 没覆盖什么（如实写）

- **真实渲染 / 混流**：默认全部跳过，只有 `--full` 才跑一次 `ascii-crt`。
- **Web UI 交互**：`web/app.js` / `index.html` / `style.css` 的浏览器行为（点击、表单、播放器、进度条）**本套件**不测 —— 它只保证「服务端发给前端的数据是对的」，不保证前端渲染对。
  → **这一块由 `test/ui.test.mjs` 覆盖**（第四批新增，独立入口）：无头 Edge `--dump-dom` 拿渲染后的 DOM、再用 CDP 真的去点击/按键。见本文末尾。
- **`/api/setup/run` 的「真跑一次安装」（走 HTTP）**：仍不测 —— 它会真的改环境（apt / clone / pip）。
  只测了校验分支（幂等跳过、未知动作、手动项拒跑）。
  （所以「安装任务的取消」走的是 `jobs.enqueueSetup()` 直调，不是 HTTP —— 这台机器 12/12 ok，`planActions()` 一个动作都规划不出来，走 HTTP 根本入不了队。）
  → **第六批已把「执行通道」与「脚本正文」单独真跑验证**（见 `安装动作真跑简报.md`）：
  `node lib/setup.mjs --run assets.fonts --simulate-env=partial` 真的执行了 `fetch-all-fonts.sh`
  的正文（exit 0、2.2s、119/119 已存在全部跳过、字体数 966→966 不变、无残留）；
  pip / clone 通道与失败分类（NETWORK/DISK/PERMISSION/EXIT/TIMEOUT）用 `runSteps` 真跑验证过。
  但**这两件事仍然没有自动化用例**（都会真的改环境），只有简报里的手工证据。
- **`POST /api/reveal`**：会弹资源管理器窗口，不测。
- ~~**落盘总量上限**：`lib/store.mjs` 的 64MB 日志总量裁剪、120 条索引上限没测。~~
  → **已补**（第六批，⑧ / ⑨）：真按真实上限造数据触发 —— ⑧ 造 40×2MB=80MB 撞 64MB 总量裁剪，
  ⑨ 造 130 条撞 120 条上限。两条都断言「最旧的被丢 / 最新的保留 / 索引与实际文件一致 / 无孤儿日志」。
  跑前备份 `index.json`、finally 里删干净并原样还原（用例连跑两次结果一致）。
  （**4MB 单任务轮转**见 ⑦；`gap` 那条验的是**内存**裁剪（20000 行），三者是三条不同的代码路径。）
- **Windows 保留端口的 `EACCES` 后扫**：**决策逻辑已测**（`lib/portscan.mjs` 的纯函数单测，见 ③），
  但**真实触发**仍没测 —— 要真造一个保留段得改系统配置（`netsh` 圈端口），测试不去动它。
  也就是说：「决策对不对」有断言，「在真保留段上确实会后扫」只有 `server.mjs` 调它这一条路径可推。
- **`lib/env.mjs` 的各项判据**：只断言了 `/api/env` 的**结构**（字段在不在、类型对不对），不断言 WSL/ffmpeg/字体的**具体探测结果** —— 那依赖机器状态，断死会变成假失败。
- **取消「真渲染」任务**：不测 —— 会打断 mux、会动用户成片目录。取消验的是 dry-run（无害长任务）。
- **`DELETE` 一个不存在的任务 id / 排队中的任务**：没测（只测了「运行中取消」与「已结束再取消 → 400」）。
- **`HEAD /api/films/:slug/:file`**：路由里有，但没单独立用例（Range 那条已经把实现覆盖了）。

---

## `test/setup.test.mjs` 覆盖了什么（12 条）

| 用例 | 断言 |
|---|---|
| ① 检测到缺失 → 规划出动作 | 「WSL 装好但里面是空的」场景下，必须规划出 wsl.node / wsl.ffmpeg / wsl.venv / lib.wsl / lib.win，且每个动作都带 `why` |
| ② 自动 / 手动分界 | 7 项 `kind==='auto'` 且每步都有 `timeoutMs`；5 项 `kind==='manual'`、有指引、**且不带可执行步骤**（免得让人误以为能自动跑）；最坏场景共 12 个动作 |
| ③ 手动项不含下载命令 | `win.ffmpeg` 的序列化结果里不许出现 curl/wget/Invoke-WebRequest（「不自动下载几百 MB 二进制」） |
| ④ 全 ok → 0 个动作 | `planActions(fixtureReady())` 必须为空数组；反过来把全项改成 warn，每项都必须被某个动作覆盖 |
| ⑤ **漂移哨兵** | 从 `lib/env.mjs` 源码里正则抽出所有 `ok()/warn()/fail()` 的 item id，逐个断言 `lib/setup.mjs` 有**专门**动作（不是落到 `fallback.*`）；同时断言 `fixtureReady` 的 id 集合与 env.mjs 完全一致 |
| ⑥ 幂等判据 | `actionSatisfied()` 在 ready 场景为 true、partial 场景为 false；多项里有一个不 ok 就为 false；不存在的项保守判 false |
| ⑦ 失败分类 | 网络 / 超时 / 仓库不存在 / 权限 / 磁盘 / 命令缺失 / 其它，7 类各自命中；并验优先级（磁盘 > 网络） |
| ⑧ 序列化安全 | 5 个演练场景都能规划 + JSON 化；序列化结果里**不许带 `script` 正文**（脚本留在服务端） |
| ⑨ 超时保护 | `lib.wsl` 的 clone 超时 ≥ 60 分钟、体积预估 > 5 GB；所有 auto 步骤的超时 ≥ 5 分钟 |
| ⑩ 动作 id 稳定 | 每个场景内 id 不重复、字符集合法（server 会 400）；同一份检测结果规划两次结果必须一致（纯函数） |
| ⑪ 排序 | `fail` 的动作排在 `warn` 前面（先修致命的） |
| ⑫ CLI 可用 | `node lib/setup.mjs --simulate --json` exit 0 且结构正确；无参模式能真检测并给结论；未知演练场景必须非 0 |

---

## 副作用与「不干扰用户」

1. **不碰用户那个 18080 实例**：测试自己用**内核分配的空闲端口**（`net.listen(0)`，天然避开 Windows 保留段）起一个临时服务，跑完自己杀掉。全程不读也不写用户的实例。
2. **`--port` 兜底**：起服务时读它自己打印的 `http://127.0.0.1:<实际端口>`，所以即使端口被保留段挤掉、服务自动后扫了，测试也认得实际端口。
3. **固定入口文件会覆写 → 已备份还原**：`server.mjs` 启动时会写 `.console-port` 与 `打开控制台.url`。测试**跑前按字节备份、跑后按字节写回**，所以用户「双击打开控制台」的地址不会被打乱。
   （⑦ 的跨重启用例会**再起一次服务**，同样走这套备份还原。）
4. **会往 `D:\lemo-films\.console\` 写任务记录**：dry-run 任务、⑥ 取消的 dry-run、以及 ⑥⑦ 两条进程用例自己起的任务，都会留下 `index.json` 条目 + `logs/<id>.jsonl`。这是**测试产物**，但格式和用户自己的任务记录一致，不影响使用。
   ★ **全部**由 `test/cases.mjs` 的 `ARTIFACTS` 登记，跑完在 `finally` 里**从 `index.json` 摘掉、并删掉对应的日志文件**（原子替换，和 `lib/store.mjs` 同一套做法）。
   ★ **第六批修了一个漏登记**：SERVER 层的 ④（dry-run 全链路）与 ⑥（取消）起的两个任务，早先**没有** `ARTIFACTS.jobIds.add(...)` ——
   结果是**每跑一次 `smoke.mjs` 就往用户历史里多留 2 条 dry-run 任务**（实测连跑 5 次 → 历史 72 → 82 条）。
   现已补上登记，实测跑完 `index.json` 仍是 72 条、`logs/` 仍是 71 个文件 / 184952 字节，与跑前逐字节一致。
5. **⑥ 取消渲染任务会留下编排器的并发锁，测试自己收掉**：`lemo-make.mjs` 的 `releaseLock` 挂在 `process.on('exit')` 上，被 `taskkill /F` 硬杀时不会执行 → 留下一个「pid 已死」的 `.ascii-crt.lock`。编排器下次会按「pid 已死」自动接管，**功能上无害**；但测试会在用例的 `finally` 里删掉它 —— 判据很严：**只删「锁里第一行的 pid == 刚被取消的那个 pid」的那一个文件**，绝不碰别的锁。
6. **测试造的锁用 `__test-lock__` 这种不可能与真实风格同名的 slug**，且用完立刻 `unlink`（`finally` 里兜底）。
7. **WSL 侧临时文件**：⑥ 会在 `/tmp` 下写 `cg-cancel-<pid>-<ts>.{pid,alive}`，`wsl()` 辅助函数会往 `D:\WSL\` 写 `cg-wsl-*.sh`；两者都在 `finally` / `close` 里删掉，`ARTIFACTS` 里另有一层兜底。
8. **`/api/env` 会起 WSL 探测**（几秒）：它会往 `D:\WSL\` 写临时脚本，名字带 pid + 时间戳，跑完自删。
9. **不用 `curl`**：本机 curl 走代理，打 localhost 拿到的是 **502**（不是 000）。全部走 `node:http` 直连。
10. **不用 `spawnSync`**：本环境对任何可执行文件都返回 `EBUSY`，全部异步 `spawn`。
11. **WSL 命令一律「写脚本文件再执行」，不走内联 `bash -c`**：`wsl.exe` 会把命令行重新拼一遍再交给 Linux 侧解析，内联里的 `$变量` / 引号会被吃掉（`lib/env.mjs` 的注释里写着「内联会吃掉变量」，实测确实如此 —— 内联写法下 `$st` 变成空串，断言直接失去意义）。
12. **测试自身代码也是 LF**（② 那条会把 `test/*.mjs` 一起查）。

---

## 已知观察（不是本次改动引入的）

- **WSL 发行版会因空闲被回收，下一次 `wsl.exe` 调用是冷启动**：实测见过一次 `sleep 3` 的步骤 **60 秒**才起来、`--dry-run` 的 CLI 子进程跑到 **74 秒**。所以本套件里凡是要等 WSL 的地方窗口都给得很宽（`wsl()` 默认超时 60s、等标记文件 120s），慢不等于失败。
- **取消一个 WSL 安装步骤后，`su` 进程会多留一会儿**：真正干活的脚本 + `sleep` 立刻就被收掉了（这正是要保的东西），但 `su - lemo -c setsid -w bash …` 会以 `S` 状态多留几十秒（它的孩子 `setsid` 已经是僵尸，它没有 reap）。不干活、不占 GPU，随后自己消失。**不是本次改动引入的**，也不是控制台能控制的（那是 `su`/WSL 侧的行为）。
- **`.console/logs/` 里可能有孤儿日志文件**：`saveIndex` 的条数/总量裁剪会 `dropLog`，但历史上遗留过个别「索引里没有、日志文件还在」的条目（本机现存 1 个，2026-10-01 20:12，早于本次改动）。不影响功能。
- `lemo-make.bat` 与 `start-console.bat` 的工作区行尾**都是 CRLF**（与 `.gitattributes` 的 `*.bat text eol=crlf` 一致）。
  ② 那条用例**查的是仓库里全部 `.bat`**（不只 `start-console.bat`）—— 早先只断言一个文件时，`lemo-make.bat` 是 LF（CR=0 LF=41）也照样全绿；后来把它转成了 CRLF，断言也一并升级成「所有 `.bat`」。若哪天又有 `.bat` 被写成 LF，② 会直接 FAIL 并列出文件名与 CR/LF 计数。

---

## `test/ui.test.mjs` 覆盖了什么（21 条：第四批 20 条 + 第五批 1 条）

补的就是上面「没覆盖什么」里那条 —— **前端渲染出来对不对**。三种手段从弱到强：

**A. 无头 Edge `--dump-dom`（渲染后的真实 DOM，6 条）**

| 用例 | 断言 |
|---|---|
| A1 | `--dump-dom` 拿到的 DOM 里 `.style-item` 数量 == `/api/demos` 的 `styles.length`（证明 JS 真的跑完了，不是空壳） |
| A2 | 批量入队 UI 存在：`.si-check` 复选框数 == 风格数 · `#sideBatch` / `#batchCount` / `#btnBatchQueue` / `#btnBatchClear` 都在 · 初始「已选 0 个」· 初始 `disabled` |
| A3 | `#batchModal` / `#batchBody` / `#batchFoot` / `#helpModal` / `#btnHelp` / `#btnHelp2` / `.kbd-hint` 都在，且提示里含 `<kbd>Ctrl</kbd>`+`<kbd>Enter</kbd>` |
| A4 | `#progEta` 挂载点存在且**初始为空**（无历史不许显示数字）· `<html data-theme="dark">`（默认仍是深色） |
| A5 | 从 `style.css` 里解析两套调色板，按 WCAG 2.1 算 **20 组**前景/背景对比度：**浅色与深色都必须全部 ≥ 4.5**（第五批把深色也设成卡点 —— 深色是默认主题；顺带修了深色 `--fg-faint`：3.48/3.21 → 4.91/4.54。第六批补了 **hover 态**两组：`--fg-faint` / `--fg-dim` on `--bg-3` —— `--bg-3` 是 `.envbar`/`.style-group-head`/`.style-item`/`.film` 的 hover 底色，原来深色只有 4.14、浅色 4.43，都低于 AA，已一并修正到 4.61 / 4.56） |
| A6 | 前三批的 13 个 UI 锚点（进度条 / 空状态 / 复制 / 分组 / 侧栏 / 排序 / 向导 / 预检位 / 预设…）在渲染后的 DOM 里仍在 |
| A7 | 用 `?simulate=clean|bare|partial`（演练模式，这台 12/12 ok 的机器也能看到环境备注与安装引导卡片）逐个 `--dump-dom`，**去掉 HTML 注释后全域扫描**，断言渲染出的 DOM 里 **0 处 `` `**` `` 字面量** —— 控制台里有两类纯文本模板串走 `textContent`：`web/app.js` 的 `#setupIntro`/`.env-note`，以及 `lib/setup.mjs` 给手动项写的 `manual.note`/`steps`/`impact`（第五批一共改了 **4 + 9 = 13 处**，全换成「」引号）。并断言每个场景**真的渲染出了 ≥1 张安装卡片**、`.env-note` 里真有「演练模式」字样（否则用例是空转） |

**B. CDP 真交互（9 条）**

用手写的极小 WebSocket 客户端（node 没有内置 ws，也**不装 puppeteer**）连无头 Edge 的调试端口，真的去点击 / 按键：

| 用例 | 动作 → 断言 |
|---|---|
| B0 | 打开控制台 → 页面渲染出 43 个风格条目 |
| B1 | 点 2 个复选框 → `#batchCount` == 「已选 2 个」、`#btnBatchQueue` 解禁、加了 `.has`；**勾到哪两个从 DOM 读**（列表按 9 大类分组，DOM 顺序 ≠ `state.styles` 顺序） |
| B2 | 点「批量入队」→ 弹层出现，正文含「将按顺序跑 2 个」+ 两个 slug + 「预计总耗时」，`.batch-row` 顺序与勾选顺序一致，底部有取消/入队 |
| B3 | `Esc` → 弹层关闭（不是只能点关闭按钮） |
| B4 | `Ctrl+K` → 焦点到 `#search`；**在输入框里按 `/` 不抢焦点**；非输入态按 `/` 会聚焦搜索框 |
| B5 | 点「?」→ 快捷键面板打开且含 Ctrl/Enter/K/Esc；`Esc` 关闭 |
| B6 | 点主题按钮 → `data-theme=light` + `localStorage` 写入；再点回 `dark` |
| B7 | 勾 2 个 + 勾上「试跑」→ 确认 → **真的入队 2 条**：`/api/jobs` 里两条 `batchId` 相同、`batchIndex` 1/2、`batchTotal` 2；任务列表 DOM 里出现「批 N/2」标记 |
| B8 | 焦点在表单里按 `Ctrl+Enter` → `/api/jobs` 真的多出一条任务（`batchId=null`） |

**C. 服务端语义（HTTP，5 条）**

| 用例 | 断言 |
|---|---|
| C1 | `POST /api/run` 的批次参数校验：非法 `batchId` / `batchIndex>batchTotal` / `batchIndex=0` 都 400；**不带 `batchId` 的老用法仍 200 且 `batchId=null`**（不破坏前几批） |
| C2 | 批量任务跑到终态（`done`/`exit=0`），且 `/api/jobs` 的 summary 里有 `batchId`/`batchIndex`/`batchTotal`/`eta` 字段 |
| C3 | **ETA 真的从历史学习**：先批量问一遍所有 slug 挑样本最少的那个 → 跑一次 dry-run → 同参数再问，样本数 **+1** 且 `medianMs` 为正；**换一组参数问 → `confidence=none`**（不把不同阶段的耗时混着报） |
| C4 | 「预计还需」真的渲染到进度条上：连入队 5 条（后 4 条排队，窗口够宽）→ **走真实 UI 路径**（刷新列表 → 点那一行 = attachLog）→ `#progEta` 显示「预计还需 ~…」、`.ok/.low` 类在、tooltip 里有「历史样本 N 次」 |
| C5 | `GET /api/eta` 的参数校验：缺 slug / 非法 slug / 非法选项都 400；正常输入 200 |

> ★ 判据不写死：风格数从 `/api/demos` 现取（不硬编码 43）；C3 不假设「某个 slug 从没跑过」（用户的历史就在 `index.json` 里，测试服务启动时会读回来）—— 而是先问一遍挑样本最少的。
> ★ B7/C3/C4/B8 一律用 `--dry-run --skip-sync`（不渲染、不混流），跑完把测试任务从 `index.json` 摘掉、日志文件删掉；无头 Edge 的 profile 目录建在 `D:\WSL\b4-ui-*`，跑完按**确切路径**递归删除（不用通配符）。
> ★ `--dump-dom` 与 CDP 都要用**独立**的 `--user-data-dir`，否则第二次起浏览器会抢同一个 profile 锁。

---

## 文件

```
test/smoke.mjs      冒烟测试入口：参数解析、起停测试服务（含按需重启）、HTTP/SSE 工具、用例调度与汇总、跑完清理测试产物
test/cases.mjs      冒烟测试用例 + 共享常量（ORCH_MD5 / 期望风格数）+ 纯函数（行尾计数 / 注入扫描 / 异步 spawn）
                    + 测试产物登记与清理（ARTIFACTS / cleanupArtifacts）+ WSL 辅助（wsl / freshDeadPid）
test/setup.test.mjs 首次运行安装的纯逻辑测试（独立入口，不起服务、不碰 WSL）
test/ui.test.mjs    Web UI 层测试（独立入口）：无头 Edge --dump-dom + CDP 真点击 + 颜色对比度 + 批量/ETA 的服务端语义
test/README.md      本文件
```

`smoke.mjs` 构造的 `ctx` 会传给每条用例：

| 字段 | 说明 |
|---|---|
| `root` / `orchPath` | 项目根 / 编排器路径 |
| `state` | 用例间传值（④ 把 dry-run 任务 id 放这儿给 ⑥⑦ 用） |
| `note(msg)` | 打印备注（最后统一列出） |
| `sleep(ms)` | 异步等待 |
| `port` / `get` / `post` / `del` / `sse` | HTTP 工具（`get` 支持 `headers` / `maxBytes`；`sse` 支持 `headers` / `stopOn`） |
| `restartServer()` | 杀掉测试服务再起一个（端口会变，`ctx` 里的 HTTP 工具自动跟着换）—— 跨重启用例用 |

> ★ 用例分三组跑：`STATIC_CASES`（不起服务）→ `SERVER_CASES`（服务在跑）→ `PROCESS_CASES`（在本进程里 `import lib/jobs.mjs` 起独立队列，验 WSL 侧进程组 / 内存裁剪）。
> `PROCESS_CASES` **必须排在 `SERVER_CASES` 之后**：它会往 `.console` 写任务记录，等服务把历史读完再写，测试服务的内存里就不会带着这些测试任务、收尾时也不会被它写回去。
