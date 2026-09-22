# 运行流程

## 桌面端

渲染进程 → preload `electronAPI.mcp` → Electron main IPC → `@anyaitools/core` → `~/.anyaitools/mcp.json` 和各宿主原生配置。

## 宿主同步

canonical MCP 服务器按照 `enabledTools` 独立筛选，再由工具适配器转换为：

- Claude Code：JSON `mcpServers`
- Gemini CLI：JSON `mcpServers`
- Codex：TOML `mcp_servers`
- Grok Build：TOML `mcp_servers`

OpenCode 和 OpenClaw 在没有稳定配置契约时保持不可写状态。
