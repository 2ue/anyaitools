# 如何手动配置 MCP

MCP 是工具服务器配置，不是模型配置。它决定宿主工具可以调用哪些外部工具；
最终使用哪个模型，仍由 Codex、Claude Code、Gemini CLI、OpenCode 或 OpenClaw
自身决定。

## AnyAI Tools 配置文件

AnyAI Tools 保存 MCP 服务商列表：

```text
~/.anyaitools/mcp.json
```

每个 server 使用统一的 canonical 结构保存，宿主工具的格式由适配层转换：

```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "filesystem",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        "env": {
          "API_KEY": "sk-xxx"
        }
      },
      "enabledTools": {
        "claude": true,
        "gemini": true,
        "codex": false
      }
    }
  ]
}
```

`enabledTools` 决定同步到哪些宿主工具。当前 Core 已支持 Claude Code、Gemini CLI、
Codex 和 Grok Build 的原生配置格式；OpenCode 与 OpenClaw 会显示为暂不支持，
不会强行写入猜测格式。旧版本的 `command`、`args`、`env`、`enabledApps` 配置会自动迁移。

支持的 `transport.type`：

- `stdio`：本地命令、参数和环境变量。
- `sse`：远程 SSE URL。
- `streamable-http`：远程 Streamable HTTP URL。
- `http`：通用 HTTP URL，按宿主工具能力映射。

## Claude Code 原生方式

Claude Code 的用户级 MCP 通常位于：

```text
~/.claude.json
```

项目级 MCP 可以写入项目根目录的 `.mcp.json`：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {
        "API_KEY": "sk-xxx"
      }
    }
  }
}
```

也可以使用 Claude Code 命令管理：

```bash
claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem /tmp
claude mcp list
```

进入会话后使用 `/mcp` 查看连接状态和工具列表。MCP 服务器不会改变 Claude
Code 的模型；模型仍通过 `settings.json`、`--model` 或 `/model` 设置。

## Gemini CLI 原生方式

Gemini CLI 使用 `~/.gemini/settings.json` 中的顶层 `mcpServers`：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {
        "API_KEY": "sk-xxx"
      }
    },
    "remote-tools": {
      "httpUrl": "https://mcp.example.com/mcp"
    }
  }
}
```

服务器可以使用 `command`、`url` 或 `httpUrl`。进入 Gemini CLI 后使用：

```text
/mcp
```

查看服务器连接状态和工具列表。MCP 仍然不负责 Gemini 模型切换；模型使用
`settings.json.model.name`、环境变量或当前版本支持的 CLI 参数设置。

## 使用 AnyAI Tools

```bash
aat mcp add
aat mcp list
aat mcp edit <name>
aat mcp remove <name>
```

AnyAI Tools 会：

1. 保存 MCP 到 `~/.anyaitools/mcp.json`。
2. 根据每个 server 的 `enabledTools` 独立同步到宿主工具：
   - Claude Code：`~/.claude.json` 的 `mcpServers`
   - Gemini CLI：`~/.gemini/settings.json` 的 `mcpServers`
   - Codex：`~/.codex/config.toml` 的 `mcp_servers`
   - Grok Build：`$GROK_HOME/config.toml` 的 `mcp_servers`
3. 保留宿主工具中未由 AnyAI Tools 管理的 MCP。
4. 在删除或禁用 server 后重新同步宿主配置。

## JSON 导入、导出与社区目录

桌面端的“添加 MCP”支持：

- 直接粘贴或选择 JSON 文件。
- 自动识别 AnyAI Tools canonical `servers` 和 Claude/Cursor/Gemini 常见的
  `mcpServers` 格式。
- 重名时选择跳过、覆盖或自动重命名。
- 一键导出 `mcp-servers.json`。
- 进入 MCP 页面自动加载内置目录：
  - 官方 MCP Registry API
  - MCP 官方参考服务器仓库
  - TensorBlock 社区 MCP catalog
- 在“添加来源”中保存自定义 HTTPS JSON、GitHub README 或兼容的 Registry API；
  来源会写入 `~/.anyaitools/mcp-registries.json`，下次进入页面继续加载。
- 目录请求会缓存到 `~/.anyaitools/mcp-registry-cache.json`，网络失败时显示上次成功结果。

Registry 只加载配置清单，不自动执行仓库代码或安装依赖。官方 package 条目只会生成
`npx`、`uvx` 或 `docker` 配置模板，真正启用前仍需用户确认依赖、权限和环境变量。
清单示例：

```json
{
  "name": "Community MCP Registry",
  "version": 1,
  "servers": [
    {
      "name": "filesystem",
      "description": "Access local files",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      },
      "enabledTools": {
        "claude": true,
        "gemini": true,
        "codex": true
      }
    }
  ]
}
```

旧版本 CLI 仍可使用 Provider 兼容入口，内部字段映射如下：

| AnyAI Tools 字段 | MCP 含义                                 |
| ---------------- | ---------------------------------------- |
| `name`           | server 名称                              |
| `baseUrl`        | MCP `command`                            |
| `apiKey`         | MCP `args`，以空格拆分                   |
| `model`          | JSON 字符串，保存 `env` 和 `description` |

因此 MCP 的 `model` 字段不是模型 ID，不要把它当成模型切换入口。

## 常见问题

### 为什么 MCP 已添加但工具里看不到

检查：

1. server 是否在目标工具的 `enabledTools` 中启用。
2. 目标工具的原生配置文件是否已经更新。
3. command、args、env 是否能在终端单独运行。
4. 重启宿主工具或使用 `/mcp` 重新查看连接状态。

### 为什么某个工具没有同步 MCP

检查该工具的能力卡片和传输类型。AnyAI Tools 不会把 MCP 强行写入没有稳定官方
配置契约的工具；当前 OpenCode 与 OpenClaw 会明确显示为“不支持”。Codex、
Gemini、Claude 和 Grok 则按各自的 JSON/TOML 原生格式同步。

## 官方资料

- <https://docs.anthropic.com/en/docs/claude-code/mcp>
- <https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html>
