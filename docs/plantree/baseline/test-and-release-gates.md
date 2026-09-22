# 测试与发布门槛

实现 MCP 计划时至少通过：

- Core 测试和 MCP writer 回归测试。
- CLI 测试。
- Desktop `type-check`。
- Desktop production build。
- `pnpm lint`。
- `git diff --check`。

涉及 Registry 解析时还要覆盖：官方 API、JSON 清单、GitHub raw/仓库地址、错误响应、超时、大小限制和不完整条目。
