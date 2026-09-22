# Decision 001: 来源目录与 MCP 配置解耦

## Decision

把“Registry 来源/目录条目”和“已配置 MCP server”建模为两个独立生命周期：

- 来源负责拉取、缓存、搜索和展示。
- 用户明确导入后才创建 canonical `MCPServer`。
- 导入后的 server 默认不启用任何宿主工具。
- 删除或刷新来源不得删除已导入 server。

## Rationale

目录可能失效、条目可能被删除或配置发生变化，但用户已经导入的 MCP 仍然需要稳定管理。解耦也能避免打开页面时自动改变宿主配置。

## Consequences

- 需要保存 source id 和导入来源信息。
- 需要处理目录条目更新与本地 server 的差异提示。
- 自动加载只能更新目录状态，不能调用 `addMCPServer` 或 `toggleMCPForApp`。
