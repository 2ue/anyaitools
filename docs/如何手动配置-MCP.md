# 如何手动配置 MCP

MCP 是工具服务器配置，不是模型配置。它决定宿主工具可以调用哪些外部工具；
最终使用哪个模型，仍由 Codex、Claude Code、Gemini CLI、OpenCode 或 OpenClaw
自身决定。

## AnyAI Tools 配置文件

AnyAI Tools 保存 MCP 服务商列表：

```text
~/.anyaitools/mcp.json
```

每个 server 通常包含：

```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {
        "API_KEY": "sk-xxx"
      },
      "enabledApps": ["claude", "gemini"]
    }
  ]
}
```

`enabledApps` 决定同步到哪些宿主工具。当前支持 Claude Code 和 Gemini CLI；
Codex 在当前 writer 中不会同步 MCP。

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
2. 根据 `enabledApps` 同步到 `~/.claude.json` 和/或
   `~/.gemini/settings.json`。
3. 保留宿主工具中未由 AnyAI Tools 管理的 MCP。
4. 在删除或禁用 server 后重新同步宿主配置。

为了兼容统一 Provider 表单，内部字段映射如下：

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

1. server 是否包含在 `enabledApps`。
2. `~/.claude.json` 或 `~/.gemini/settings.json` 是否已经更新。
3. command、args、env 是否能在终端单独运行。
4. 重启宿主工具或使用 `/mcp` 重新查看连接状态。

### 为什么 Codex 没有同步 MCP

这是当前项目的明确限制：`writeMCPConfigForApp('codex', ...)` 直接返回。
需要在 Codex 中使用外部工具时，应按 Codex 当前版本提供的原生扩展能力单独配置，
不能依赖 AnyAI Tools 的 MCP 同步。

## 官方资料

- <https://docs.anthropic.com/en/docs/claude-code/mcp>
- <https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html>
