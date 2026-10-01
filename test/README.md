# test/ —— lemo 控制台冒烟测试

把「交付后的人工验证」固化下来：起服务 → 打接口 → 跑 dry-run → 校验编排器没被改坏。
**零依赖**（只用 `node:assert` / `node:http` / `node:child_process` / `node:crypto`），没有 jest/mocha/vitest。

```bash
node test/smoke.mjs              # 全部用例，不含完整回归（约 7–20 秒）
node test/smoke.mjs --full       # 额外跑一次完整 ascii-crt 回归（约 80 秒）
node test/smoke.mjs --filter ③   # 只跑名字里含 "③" 的用例
node test/smoke.mjs --keep-server  # 跑完不杀测试服务（调试用，自己记得收）
```

退出码：**全绿 0 / 有用例失败 1 / 测试自身异常 2**。
最后一行汇总 `N passed, M failed`。

---

## 覆盖了什么（19 条，`--full` 时 20 条）

### ① 编排器未被改坏（红线）

| 用例 | 断言 |
|---|---|
| 编排器 md5 未被改动 | `lemo-make.mjs` 的 md5 == `0554085abb34c50e3e1bcfe8f28ab0e1` |

控制台只是**包装层**，绝不能改编排器。这条是整个项目的红线，失败信息直说「编排器被改动了 —— 控制台不应该修改它」。

### ② 行尾规则未被破坏

| 用例 | 断言 |
|---|---|
| 源码行尾全为 LF | 项目里所有 `.mjs/.js/.css/.html/.md` + `.gitattributes/.gitignore`（含 `test/` 自己）CR 计数 == 0 |
| `start-console.bat` 为 CRLF | CR > 0 且 CR == LF |
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

> 注入检查只扫**真正的标签**（`<tag …>`），不扫转义后的正文 —— 否则正文里写 `&lt;img onerror=x&gt;`（已转义成纯文本、完全无害）会假阳性。

### ④ dry-run 任务全链路（API 层）

一条用例串起三件事：

1. `POST /api/run` 传 `{slug:'ascii-crt', opts:['--skip-sync','--dry-run']}` → 200 且有 `job.id`
2. 轮询 `GET /api/jobs` 直到该任务结束（超时 60s）→ `status == 'done'` 且 `exitCode == 0`
3. `GET /api/logs/:id` 走 SSE → 至少回放到一行日志、**日志里出现步骤标记 `[1]`**、并且回放了 `end` 事件

### ⑤ CLI 未受影响

| 用例 | 断言 |
|---|---|
| CLI dry-run 仍 exit 0 | `node lemo-make.mjs ascii-crt --skip-sync --dry-run` → exit 0 |
| CLI dry-run 打印步骤标记 `[1]` | 输出含 `[1]` |

证明包装层没有破坏命令行用法。

### ⑤+ 完整回归（只在 `--full` 时跑）

`node lemo-make.mjs ascii-crt --skip-sync` → exit 0 且输出含 `MUX_OK`、`src_frames=1435`、`out_frames=1435`。
**默认不跑**（约 80 秒，且会真渲染 + 混流）。

---

## 没覆盖什么（如实写）

- **真实渲染 / 混流**：默认全部跳过，只有 `--full` 才跑一次 `ascii-crt`。
- **Web UI 交互**：`web/app.js` / `index.html` / `style.css` 的浏览器行为（点击、表单、播放器、进度条）一条都没测 —— 本套件只保证「服务端发给前端的数据是对的」，不保证前端渲染对。
- **SSE 断线续传语义**：只测了**全量回放**（`Last-Event-ID` 不带）。`?lastEventId=` 的增量补发、`gap` 事件、跨重启 `logSeq` 稳定性**没测**。
- **任务取消**：`DELETE /api/jobs/:id` 与进程树 kill 没测（会真的杀进程，风险高）。
- **并发锁冲突路径**：`/api/precheck` 只测了「无锁」这一态；`locked=true` 的真冲突态没构造（要造一个活着的 pid 的锁文件）。
- **`POST /api/reveal`**：会弹资源管理器窗口，不测。
- **`GET /api/films/:slug/:file`**：Range 分段（206/416）、拖进度条没测。
- **落盘上限 / 轮转**：`lib/store.mjs` 的 4MB 单任务轮转、64MB 总量裁剪、120 条上限没测。
- **Windows 保留端口的 `EACCES` 后扫**：`server.mjs` 那段自动向后扫描没测（要制造保留段）。
- **`lib/env.mjs` 的各项判据**：只断言了 `/api/env` 的**结构**（字段在不在、类型对不对），不断言 WSL/ffmpeg/字体的**具体探测结果** —— 那依赖机器状态，断死会变成假失败。

---

## 副作用与「不干扰用户」

1. **不碰用户那个 18080 实例**：测试自己用**内核分配的空闲端口**（`net.listen(0)`，天然避开 Windows 保留段）起一个临时服务，跑完自己杀掉。全程不读也不写用户的实例。
2. **`--port` 兜底**：起服务时读它自己打印的 `http://127.0.0.1:<实际端口>`，所以即使端口被保留段挤掉、服务自动后扫了，测试也认得实际端口。
3. **固定入口文件会覆写 → 已备份还原**：`server.mjs` 启动时会写 `.console-port` 与 `打开控制台.url`。测试**跑前按字节备份、跑后按字节写回**，所以用户「双击打开控制台」的地址不会被打乱。
4. **会往 `D:\lemo-films\.console\` 写一条任务记录**：dry-run 任务的历史（`index.json` + `logs/<id>.jsonl`）会留在落盘目录里。这是**测试产物但不留在项目目录**，且和用户自己的任务记录格式一致，不影响使用。
5. **`/api/env` 会起 WSL 探测**（几秒）：它会往 `D:\WSL\` 写临时脚本，名字带 pid + 时间戳，跑完自删。
6. **不用 `curl`**：本机 curl 走代理，打 localhost 拿到的是 **502**（不是 000）。全部走 `node:http` 直连。
7. **不用 `spawnSync`**：本环境对任何可执行文件都返回 `EBUSY`，全部异步 `spawn`。
8. **测试自身代码也是 LF**（② 那条会把 `test/*.mjs` 一起查）。

---

## 已知观察（不是本次改动引入的）

- `lemo-make.bat` 的工作区行尾是 **LF**（CR=0 LF=41），但 `.gitattributes` 规定 `*.bat text eol=crlf`。
  测试**只对 `start-console.bat` 做 CRLF 硬断言**（任务要求如此），对其它 `.bat` 只在备注里打印一行 ⚠️ 记录，不判失败。
  若哪天要统一，`git add --renormalize .` 即可让工作区按属性重写。

---

## 文件

```
test/smoke.mjs    测试入口：参数解析、起停测试服务、HTTP/SSE 工具、用例调度与汇总
test/cases.mjs    用例本体 + 共享常量（ORCH_MD5 / 期望风格数）+ 纯函数（行尾计数 / 注入扫描 / 异步 spawn）
test/README.md    本文件
```

`smoke.mjs` 构造的 `ctx` 会传给每条用例：`root` / `orchPath` / `state`（用例间传值）/ `note(msg)`（打印备注）/ `sleep(ms)`，
HTTP 用例另有 `get` / `post` / `sse` / `port`。
