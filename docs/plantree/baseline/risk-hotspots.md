# 风险热点

- 外部 Registry 内容不可信，不能执行仓库代码、安装依赖或自动写入宿主配置。
- 不同宿主的 MCP schema 不一致，不能用一个格式盲目覆盖所有工具。
- 用户手动配置的宿主 MCP 不能被 AnyAI Tools 删除或覆盖。
- Registry 条目可能缺少可执行安装配置、带有占位符或声明过时的传输协议。
- `supportedTools` 只能限制可选宿主，`enabledTools` 才是用户实际开关。
- OpenCode/OpenClaw 的真实 MCP 配置契约未确认前，不应伪造适配器。
