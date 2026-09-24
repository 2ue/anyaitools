# Roadmap

## Done

- 明确 Web 版与 Desktop 共享 renderer 的目标。
- 明确使用 `foreground`（前台运行）和 `daemon`（守护进程运行）作为启动模式术语。
- 明确 `aat web start|stop|restart|status` 命令形态。
- 明确默认 `host=127.0.0.1`、`port=3000`、同源 `/api/v1` API 和非 loopback 必须 token。
- 明确复用现有 renderer 源码，通过 Web HTTP API 兼容 `window.electronAPI`。

## In Progress

- 新增 Web Vite 构建，直接复用 Desktop renderer 源码和样式。
- 新增 CLI HTTP server：静态资源、健康检查、RPC API、token 校验。
- 将 Electron IPC 中的 Core 调用映射为可测试的 Web API handler。
- 实现前台、守护进程、停止、重启和状态查询。

## Next

- 为 Web API 增加更细粒度的共享类型和 REST 路由文档。
- 增加浏览器文件上传/下载式备份交互，替代 Electron 文件选择器。
- 将 renderer 中的 `window.electronAPI` 名称逐步迁移为 `AppApi` context。
- 增加 Linux 打包和 systemd service 示例。

## Deferred

- 多用户账号、远程权限管理和复杂会话系统。
- 让 Web 端执行自动更新或打开服务器文件夹。
- 将 Electron main 与 Web server 合并为同一运行时。
