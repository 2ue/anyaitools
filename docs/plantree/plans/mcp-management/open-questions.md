# Open Questions

1. TensorBlock catalog 的稳定分支、JSON schema 和更新频率仍可能变化，需要持续观察；
   当前 parser 对数组、`servers`、endpoint 和 install command 做了兼容。
2. Claude remote MCP 的 `type: "http" | "sse"` 和 headers 字段需用当前 Claude Code 版本做一次真实配置验证。
3. OpenCode/OpenClaw 后续是否公开稳定 MCP 配置契约；在此之前继续显示 unsupported。
