# Architecture And Runtime

## 目标与非目标

目标是让 CLI 启动一个可在浏览器访问的 AnyAI Tools 实例，功能尽量与 Desktop 相同，并让 Desktop/Web 共享 renderer 源码。

非目标是把 Electron 能力搬进浏览器、让浏览器直接读写用户文件，或在服务端自动安装/执行 MCP 依赖。

## 分层

```text
packages/core
  配置模型、工具 manager、MCP registry/writer、同步、备份、清理

packages/desktop
  Electron main + preload
  renderer 源码（Web 复用）

packages/web
  Vite 入口、Web API 兼容注入、Web 构建产物

packages/cli
  aat web 命令、node:http server、静态资源托管、daemon 生命周期
```

Web 与 Desktop 使用相同的 renderer 源码。renderer 继续调用 `window.electronAPI` 这一现有契约，Desktop 由 preload 注入，Web 由浏览器端 HTTP client 注入同形对象。该兼容层是迁移桥，不是新的业务层；业务逻辑仍只在 Core。

## Web API

- 页面与 API 使用同一端口，API 前缀为 `/api/v1`，默认同源，不需要 CORS。
- `GET /api/v1/health` 返回版本、运行模式和时间。
- `POST /api/v1/rpc` 接收 `{ method: string, args: unknown[] }`，服务端复用 IPC channel 名称映射到 Core handler；响应为 `{ ok: true, result }` 或 `{ ok: false, error }`。
- Web client 把每个 renderer API 方法转换为同一个 RPC 调用，保持现有页面调用方式不变。
- 对 `system.openUrl` 使用浏览器 `window.open`；对 update、文件夹选择等 Electron 专属能力返回明确的 unsupported 错误或 Web 语义。

## CLI 运行契约

```text
aat web start [--port <port>] [--host <host>] [--mode <foreground|daemon>] [--token <token>]
aat web stop [--pid-file <path>]
aat web restart [options]
aat web status [--json]
```

- `foreground`：当前终端保持运行，日志输出到终端，`Ctrl+C` 停止。
- `daemon`：脱离当前终端后台运行，写入 PID 和日志文件，适合 Linux 服务器。
- 默认 `host=127.0.0.1`、`port=3000`、`mode=foreground`。
- `host` 为非 loopback 时必须显式提供 token；请求通过 `Authorization: Bearer <token>` 或 `X-AnyAI-Tools-Token` 校验。
- PID、日志和运行状态只放在 AnyAI Tools 自己的配置目录，不触碰 `~/.codex`、`~/.claude` 等宿主目录之外的语义。

## 功能兼容

P0 必须完整支持 provider、MCP、JSON、registry、模型目录、配置文件编辑和 WebDAV API。

P1 支持同步和清理；这些操作作用于 CLI 所在服务器的配置目录，页面需要明确提示。

P2 的自动更新、原生文件选择、打开服务器目录不在 Web 中伪造：更新由 CLI/package 管理，URL 用浏览器打开，文件选择和服务器路径操作返回 Web 版说明。

## 安全与验证

- 默认 loopback 降低误暴露风险。
- 非 loopback 无 token 直接拒绝启动。
- RPC 不接受任意模块名，只允许显式 channel 白名单。
- 所有写操作继续走 Core 现有备份/原子写入逻辑。
- 验证包括：server 单测、CLI 生命周期单测、Web build、CLI build、隔离 HOME smoke test、`git diff --check`。
