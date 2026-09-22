# MCP 管理与目录

## 目标

为 AnyAI Tools 建立完整的 MCP 管理闭环：统一保存 MCP、按宿主工具独立开关、按宿主协议写入、支持 JSON 导入导出，并内置官方/社区目录来源自动加载可导入的 MCP 配置。

## 当前状态

- 计划状态：In Progress
- 当前阶段：需求设计与实现收敛
- 需求与方案：[requirements-and-design.md](topics/requirements-and-design.md)
- 路线图：[roadmap.md](roadmap.md)
- 实现交接：[implementation-status.md](implementation-status.md)
- 决策：[001-catalog-sources.md](decisions/001-catalog-sources.md)
- 未决问题：[open-questions.md](open-questions.md)

## 约束

- 不回滚 fork 中已有的 Codex、Gemini、Grok、OpenClaw 和备份优化。
- 不删除用户已有的 `tmp/` 或手动宿主配置。
- 不提交 commit，除非用户明确要求。
- 任何外部目录默认只读拉取元数据，导入和启用必须由用户明确操作。
