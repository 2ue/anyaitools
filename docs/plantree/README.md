# AnyAI Tools Plan Tree

这是项目规划、需求、决策和实现状态的统一入口。当前活跃计划：

| Plan                                             | Status      | Current Phase      | Last Landed                                                        | Next Target                              |
| ------------------------------------------------ | ----------- | ------------------ | ------------------------------------------------------------------ | ---------------------------------------- |
| [MCP 管理与目录](plans/mcp-management/README.md) | In Progress | 回归验证与后续扩展 | canonical MCP、工具开关、JSON/Registry、内置来源和桌面端闭环已落地 | 维护来源 schema 兼容性，评估后续宿主适配 |
| [Web 运行版](plans/web-interface/README.md) | In Progress | 端到端实现 | 需求、共享 UI 方案和 CLI 运行契约已确定 | 实现 Web 构建、HTTP 适配器和 CLI 进程管理 |

## 阅读顺序

1. 先读对应计划的 `README.md` 和 `roadmap.md`。
2. 需要具体方案时读 `topics/requirements-and-design.md`。
3. 需要了解稳定取舍时读 `decisions/`。
4. 需要继续实现时读 `implementation-status.md`。

## 基线

- [模块地图](baseline/module-map.md)
- [运行流程](baseline/runtime-flows.md)
- [存储与状态边界](baseline/storage-and-state.md)
- [测试与发布门槛](baseline/test-and-release-gates.md)
- [风险热点](baseline/risk-hotspots.md)
