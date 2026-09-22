# Roadmap

## Done

- canonical MCP 数据模型和旧配置迁移。
- Claude、Gemini、Codex、Grok 的独立宿主适配。
- MCP 卡片按工具开关。
- JSON 常见格式解析、导入、导出和重复名策略。
- 自定义 HTTPS/GitHub Registry URL 拉取。
- 内置官方 Registry API、官方参考仓库和社区 catalog 自动加载。
- Registry 分页、缓存回退、来源状态、搜索、选择性导入和自定义来源管理。
- 桌面端目录面板与 JSON/手动添加入口闭环。
- Core Registry、MCP adapter、CLI 和 Desktop 构建回归验证。

## In Progress

- 观察内置来源 schema 演进并维护 parser 兼容性。
- 优化大体量社区目录的分页、排序和已导入状态提示。
- 评估 CLI 是否需要暴露 Registry 来源管理命令。

## Next

- 为来源增加更明确的信任级别、协议、可用传输类型和解析器元数据。
- 为目录条目增加详情预览和环境变量填写辅助。
- 在官方契约稳定后再评估 OpenCode/OpenClaw adapter。

## Deferred

- OpenCode/OpenClaw 的 MCP 写入，直到有可验证、稳定的官方配置契约。
- 自动安装 npm、PyPI、Docker 或 Git 仓库依赖。
- 远程 Registry 的账号登录、私有仓库凭据和自动发布。
