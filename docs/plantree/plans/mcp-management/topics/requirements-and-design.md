# MCP 管理功能需求与设计

> 状态：需求基线。后续实现必须以本文档的目标、边界和验收标准为准。  
> 计划根：[`../README.md`](../README.md)

## 1. 背景与问题

当前 MCP 配置主要依赖手动编辑或旧版单工具 Provider 入口，存在以下问题：

- 添加一个 MCP 后，不能在一个位置清楚地决定它是否同步到 Claude、Codex、Gemini、Grok 等不同宿主。
- 宿主之间的 MCP 配置字段和传输协议不一致，直接复制 JSON 会产生不可用配置。
- JSON 配置无法可靠预览、校验、选择性导入和导出。
- 用户需要自己寻找仓库、社区清单并逐条复制配置，应用内没有可持续的发现入口。
- 外部目录可能包含恶意命令、缺少安装信息或过时协议，不能把“发现”误当成“安装并执行”。

## 2. 用户目标

### 2.1 管理已配置 MCP

用户可以在 MCP 管理页：

1. 查看所有已经保存的 MCP。
2. 查看 stdio、SSE、Streamable HTTP、HTTP 的连接信息。
3. 在每个 MCP 卡片上分别打开或关闭每个宿主工具。
4. 看到宿主工具是否支持、传输类型是否兼容、MCP 是否声明支持该宿主。
5. 编辑、克隆、删除 MCP。

### 2.2 发现并加载 MCP

用户不需要每次手动粘贴配置。应用内置若干可信的来源入口，打开 MCP 页面或点击刷新后自动加载目录：

- 官方 MCP Registry API。
- MCP 官方参考服务器仓库或其可识别的结构化清单。
- 至少一个社区维护的结构化 MCP catalog。
- 用户自定义 HTTPS JSON、GitHub 仓库、GitHub raw 文件来源。

目录只负责发现和导入配置模板，不执行仓库代码，不自动安装 npm/PyPI/Docker 依赖，不自动启用任何宿主工具。

### 2.3 JSON 配置

用户可以：

- 粘贴 JSON。
- 选择本地 JSON 文件。
- 自动识别 canonical `servers`、Claude/Cursor/Gemini 的 `mcpServers`，以及单 server 和数组形式。
- 在写入前得到条目数、传输类型、错误和警告预览。
- 选择重名策略：跳过、覆盖、自动重命名。
- 导出 canonical JSON；默认导出完整配置以便备份。

## 3. 非目标

- 不在本阶段实现宿主工具本身的 MCP 调试、连接诊断或工具调用。
- 不自动安装外部包、不运行外部仓库脚本、不替用户填写真实密钥。
- 不在没有稳定官方 schema 的情况下猜测 OpenCode/OpenClaw 配置格式。
- 不把 `supportedTools` 当作用户启用状态。

## 4. 领域模型

### 4.1 Canonical MCP Server

```ts
interface MCPServer {
  id: string
  name: string
  transport:
    | {
        type: 'stdio'
        command: string
        args: string[]
        env?: Record<string, string | number>
        cwd?: string
        envVars?: string[]
      }
    | {
        type: 'sse' | 'streamable-http' | 'http'
        url: string
        headers?: Record<string, string>
        bearerTokenEnvVar?: string
      }
  description?: string
  source?: MCPSource
  supportedTools?: MCPToolType[]
  enabledTools: Partial<Record<MCPToolType, boolean>>
  createdAt: number
  lastModified: number
}
```

语义必须保持：

- `supportedTools`：来源或 manifest 声明“理论上可以接入哪些宿主”，可选；缺省表示不限制。
- `enabledTools`：用户实际打开的宿主开关；新导入的 Registry 条目默认为空。
- 实际可写入条件：宿主 adapter 支持 + transport 支持 + `supportedTools` 允许 + `enabledTools[tool] === true`。

### 4.2 Registry Source

Registry 来源不是 MCP Server。建议新增独立模型：

```ts
interface MCPRegistrySource {
  id: string
  name: string
  kind: 'official-api' | 'json' | 'github'
  url: string
  description?: string
  builtIn: boolean
  enabled: boolean
  parser: 'official-registry' | 'generic-json' | 'community-catalog' | 'github-readme'
  lastFetchedAt?: number
  lastSuccessAt?: number
  lastError?: string
}
```

用户来源存储在 `~/.anyaitools/mcp-registries.json`；内置来源由版本化代码提供，启动时与用户来源合并，按 `id` 去重。

### 4.3 Registry Entry

外部来源都先归一化为：

```ts
interface MCPRegistryEntry {
  id: string
  name: string
  description?: string
  repository?: string
  documentationUrl?: string
  license?: string
  transportType?: MCPTransportType
  supportedTools?: MCPToolType[]
  envRequirements?: string[]
  warnings: string[]
  sourceId: string
  sourceUrl: string
  installable: boolean
}
```

缺少明确 `transport.command` 或 remote URL 的条目可以展示，但 `installable=false`，只能打开详情，不能直接导入为可运行 MCP。

## 5. 内置来源设计

第一版内置来源按“官方优先、结构化优先、失败可降级”设计：

| 来源                  | 地址                                                                                       | 解析方式                                                    | 用途               |
| --------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| Official MCP Registry | `https://registry.modelcontextprotocol.io`                                                 | 官方 API adapter                                            | 主目录、搜索和分页 |
| MCP reference servers | `https://github.com/modelcontextprotocol/servers`                                          | GitHub JSON/可识别 manifest；无 manifest 时作为仓库详情来源 | 官方参考实现       |
| TensorBlock MCP Index | `https://raw.githubusercontent.com/TensorBlock/awesome-mcp-servers/main/data/catalog.json` | JSON catalog adapter                                        | 社区目录           |

地址、分支和清单路径必须集中在内置 source definitions 中，不散落在 UI。来源失败时不影响已配置 MCP，UI 显示上次成功缓存和失败原因。

说明：

- Official Registry 的响应不是简单的 `{ servers: MCPServerInput[] }` 时，必须由 adapter 把 package/remotes/transport 信息映射为 canonical transport。
- GitHub 仓库不能通过解析 README 猜测命令。只有命中结构化清单或明确的可解析配置文件时才允许导入；否则显示仓库链接和“不支持直接导入”。
- 社区 catalog 可能是数组、`servers`、`mcpServers` 或嵌套记录，归一化器必须保留原始来源和警告。

## 6. 自动加载流程

1. MCP 管理页挂载时加载 canonical servers、内置 source definitions 和用户 sources。
2. 对 `enabled=true` 的来源并行发起请求；每个来源独立超时（默认 10 秒）和大小限制（默认 2 MB）。
3. 首屏先显示已配置 MCP；目录结果异步填充，不阻塞开关操作。
4. 每个来源保存内存缓存和磁盘缓存元数据，刷新失败时保留最后一次成功结果。
5. 用户可刷新单个来源或全部来源。
6. 目录条目支持关键词、传输类型、来源和可导入状态过滤。
7. 用户勾选条目并选择重名策略后批量导入；导入后默认所有 `enabledTools` 关闭。
8. 用户回到 MCP 卡片上逐个打开宿主工具。

## 7. 宿主适配器

### 已支持

- Claude Code：`~/.claude.json` 的 `mcpServers`，支持 stdio、SSE、HTTP。
- Gemini CLI：`~/.gemini/settings.json` 的 `mcpServers`，区分 `url` 和 `httpUrl`。
- Codex：`~/.codex/config.toml` 的 `mcp_servers`，支持 stdio、Streamable HTTP、HTTP headers 和 bearer token 环境变量。
- Grok Build：`$GROK_HOME/config.toml` 的 `mcp_servers`，沿用其 TOML 结构。

### 暂不支持

- OpenCode、OpenClaw：能力卡片显示不可用并说明原因，不写入猜测格式。

所有写入必须：

- 原子替换目标配置。
- 只删除 AnyAI Tools 之前管理的 key。
- 保留用户手动维护的 MCP。
- 写入失败时回滚 canonical 状态。

## 8. 桌面端交互

### MCP 管理页

- 顶部：已配置数量、搜索、刷新目录、添加、导出 JSON。
- 已配置区：MCP 卡片网格。
- 每个卡片显示名称、来源、传输类型、命令或 URL、环境变量名、支持/启用状态。
- 每个宿主工具使用独立 checkbox/switch；不支持时禁用并显示原因。

### 添加 MCP

使用分段模式：

1. 目录：展示内置来源和自动加载结果，支持搜索、筛选、选择性导入。
2. JSON：文件选择或粘贴，实时解析预览，显示错误/警告和重复名策略。
3. 手动：stdio、SSE、Streamable HTTP 表单。
4. 自定义来源：输入 HTTPS/GitHub 地址并保存为用户来源。

新增或导入的 MCP 默认不打开任何宿主工具。用户必须在卡片上明确打开。

## 9. IPC/API

Core 对外提供：

- `listMCPToolCapabilities`
- `listMCPRegistrySources`
- `addMCPRegistrySource`
- `removeMCPRegistrySource`
- `refreshMCPRegistrySource`
- `searchMCPRegistry`
- `addMCPServer` / `editMCPServer` / `cloneMCPServer`
- `toggleMCPForApp`
- `parseMCPJson` / `validateMCPJson` / `importMCPJson` / `exportMCPJson`

Desktop preload 暴露同名 `electronAPI.mcp` 方法；renderer 不直接访问文件系统或网络。

## 10. 安全与错误处理

- 仅允许 HTTPS；开发测试可允许 localhost HTTP。
- 请求使用 AbortController 超时，限制响应大小。
- 不执行 Registry 中的 shell 命令，不自动安装包。
- 显示或导入包含秘密的 env 值前给出警告，卡片只展示 key。
- 解析失败、来源不可达、条目缺 transport、宿主不兼容都必须是可见状态，不静默丢弃。
- 远程目录的任何 `description`、`name`、URL 都按普通文本渲染，不能注入 HTML。

## 11. 验收标准

### 管理与适配

- 在卡片上可以独立切换 Claude、Codex、Gemini、Grok；切换只影响对应宿主。
- 同一个 MCP 可对不同宿主使用不同 native schema，且不会覆盖用户手动 MCP。
- 不支持的宿主和不兼容传输类型不可勾选，并显示可理解原因。
- 重命名、删除、禁用后旧宿主 key 会被清理。

### JSON

- 能导入 canonical、`mcpServers`、单 server 和数组 JSON。
- 导入前能看到条目数和错误；重名策略行为可预测。
- 导出结果可再次导入；完整导出包含关闭状态。

### 内置目录

- 首次进入 MCP 页面自动显示至少一个内置来源的加载状态和结果。
- 内置来源失败不影响已配置 MCP，重试后可恢复。
- 用户可以从目录选择一个或多个条目导入，导入后默认关闭宿主开关。
- 支持添加自定义 GitHub/HTTPS 来源，并在下一次进入页面继续使用。
- 目录结果至少显示来源、描述、传输、仓库/文档链接和导入可用性。

### 验证

- Core、CLI、Desktop 类型检查和生产构建通过。
- 覆盖每个内置 parser、超时/错误/大小限制、重复名、缓存回退和宿主写入回滚。
- `pnpm lint` 和 `git diff --check` 通过。

## 12. 回滚与迁移

- 保留现有 `~/.anyaitools/mcp.json` 旧字段迁移逻辑。
- 新增 Registry 文件不存在时按空 sources 处理，不影响旧版本配置。
- 任何宿主写入失败都恢复 canonical 配置和 managed names。
- 删除新目录功能不会删除已经导入的 MCP；导入后的 server 与来源生命周期解耦。
