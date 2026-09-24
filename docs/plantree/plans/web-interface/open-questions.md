# Open Questions

1. 是否在后续版本把 Web 备份改为浏览器上传/下载文件，而不是复用当前需要服务器路径的备份 API。
2. 是否为守护进程增加 systemd 单元生成命令；第一期只提供 CLI daemon 生命周期。
3. 是否将当前兼容 RPC API 稳定化为公开 REST API；第一期先保持同源内部 API，避免重复实现。
