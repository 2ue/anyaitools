# Shared UI And Adapters

Date: 2026-09-22

## Context

Desktop renderer 已经形成完整的 provider、MCP、同步、清理和设置页面，但组件直接调用 `window.electronAPI`。直接复制页面会产生两套 UI，直接让浏览器 import Core 又会把 Node 文件系统和宿主配置泄露到前端。

## Decision

第一期保留 renderer 的现有 API 名称作为兼容契约：

- Desktop：`preload -> ipcRenderer -> Electron main -> Core`
- Web：`browser client -> HTTP RPC -> CLI server -> Core`

Web 构建直接引用 Desktop renderer 源码和 CSS，不复制页面。后续再把契约类型抽到 `packages/types` 并将名称迁移为 `AppApi`。

## Consequences

- 可以快速交付一套真正可用的 Desktop/Web 界面，避免大规模页面重写。
- HTTP API 初期是内部 RPC 兼容层，不是最终公开 REST 设计。
- Web 端必须为 Electron 专属能力提供降级实现或明确不可用提示。
- 组件对 `window.electronAPI` 的历史依赖会保留一段时间，后续需要清理迁移。
