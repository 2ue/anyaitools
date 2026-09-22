# Implementation Status

## Current Phase

需求基线已落地，canonical MCP、宿主适配、JSON 导入导出和内置 Registry 目录闭环已完成，
当前进入回归验证与后续宿主扩展阶段。

## Last Landed

- canonical MCP 类型、宿主能力矩阵、宿主写入适配器。
- MCP 卡片按宿主工具独立开关。
- JSON 导入/导出和自定义 Registry URL 初版。
- `supportedTools` 与 `enabledTools` 语义拆分。
- 内置官方 MCP Registry、官方参考仓库和 TensorBlock 社区目录自动加载。
- Registry 缓存、超时、响应大小限制、分页、搜索、选择性导入和自定义来源管理。
- 桌面端 MCP 目录面板、JSON/手动添加流程和来源增删入口。
- Registry parser、分页、社区命令、GitHub README、generic JSON、缓存回退回归测试。

## Active TODO

1. 观察真实目录 schema 变化，必要时更新 parser fixture 和兼容映射。
2. 评估 OpenCode/OpenClaw 是否出现稳定、可验证的官方 MCP 配置契约。
3. 将目录筛选、来源详情和导入预览继续收敛到统一的添加流程。

## Blocked By

无。OpenCode/OpenClaw 是否支持仍按文档作为明确的延后项，不阻塞当前目标。

## Last Verified

2026-09-22：

- Core：20 个测试文件、116 个测试通过。
- CLI：28 个测试通过。
- Types/Core build 通过。
- Desktop type-check 和生产构建通过。
- Registry/UI 相关 Prettier、ESLint 和 `git diff --check` 通过。
