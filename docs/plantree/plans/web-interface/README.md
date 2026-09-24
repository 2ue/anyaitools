# Web 运行版

## 目标

让只安装 CLI 的 Linux/服务器环境也能通过浏览器使用 AnyAI Tools，且 Desktop 与 Web 维护同一套 React renderer 和业务能力契约。

## 当前状态

- 计划状态：In Progress
- 当前阶段：端到端实现
- 需求与方案：[architecture-and-runtime.md](topics/architecture-and-runtime.md)
- 路线图：[roadmap.md](roadmap.md)
- 实现交接：[implementation-status.md](implementation-status.md)
- 决策：[001-shared-ui-and-adapters.md](decisions/001-shared-ui-and-adapters.md)
- 未决问题：[open-questions.md](open-questions.md)

## 阅读顺序

1. 先读本文件和 [roadmap.md](roadmap.md)。
2. 实现前读 [architecture-and-runtime.md](topics/architecture-and-runtime.md) 和决策记录。
3. 恢复工作时读 [implementation-status.md](implementation-status.md)。

## 约束

- 不修改用户现有配置目录的默认语义；开发验证使用 `NODE_ENV=development` 或显式隔离目录。
- Web 默认只监听 `127.0.0.1`；绑定非 loopback 地址必须提供 token。
- 不让浏览器直接 import Node-only `@anyaitools/core`；所有文件、网络和宿主写入由 CLI 服务端完成。
- Desktop 保留 Electron preload/IPC 接入；Web 只替换接入层，不复制业务逻辑。
- 不自动安装 MCP 依赖、不执行外部仓库代码。
- Desktop 专属能力在 Web 中必须明确降级为浏览器语义或不可用状态，不能静默失败。
