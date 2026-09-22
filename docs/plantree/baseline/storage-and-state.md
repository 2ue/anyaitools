# 存储与状态边界

- AnyAI Tools 的 canonical MCP 配置：`~/.anyaitools/mcp.json`。
- 宿主配置只保存对应工具启用的 MCP，且必须保留未由 AnyAI Tools 管理的用户条目。
- Registry 来源配置和缓存属于 AnyAI Tools 自有状态，不得写入宿主 MCP 配置。
- Registry 元数据不等于已安装或已启用；目录导入后默认不自动打开任何宿主工具。
- 环境变量值可用于写入宿主配置，但 UI 列表只显示变量名，不能回显秘密。
