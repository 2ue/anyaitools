# 模块地图

- `packages/types`：跨进程共享类型。
- `packages/core/src/writers/mcp.ts`：MCP canonical 存储、迁移、导入导出、Registry 拉取和宿主适配器。
- `packages/core/src/tool-manager.ts`：兼容旧 Provider API 的 MCP 管理入口。
- `packages/desktop/src/main/index.ts`：Electron 主进程 MCP IPC。
- `packages/desktop/src/preload/index.ts`：渲染进程安全 API。
- `packages/desktop/src/renderer/components/MCPManagerPage.tsx`：MCP 管理页。
- `packages/desktop/src/renderer/components/MCPCard.tsx`：单个 MCP 卡片和按工具开关。
- `packages/desktop/src/renderer/components/AddMCPModal.tsx`：手动、JSON、Registry 添加流程。
- `packages/cli/src/commands/mcp`：旧版 CLI MCP Provider 兼容入口。
