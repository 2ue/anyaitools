# @vebing-tools/anyaitools

> 面向 Any AI Tools 工作流的 CLI，统一管理 Codex、Claude Code、Gemini CLI、OpenCode、OpenClaw、xAI Grok Build 和 MCP 的配置与同步。

---

## ✨ 核心特性

- 🔄 **一键切换**：一条命令切换服务商，自动修改配置文件
- 📦 **内置预设**：提供常用预设，包括 xAI 官方 Grok Build 模板
- 🛠️ **自定义配置**：支持添加任意第三方服务商
- 🔐 **安全写入**：常规管理命令默认增量更新；`aat okm` 等快捷配置命令对所涉及工具执行覆盖式写入
- 🎯 **多工具支持**：同时管理 Codex、Claude Code、Gemini CLI、OpenCode、OpenClaw、Grok Build 和 MCP 服务器
- 📱 **双界面**：提供 CLI（命令行）和 Desktop（图形界面）
- 🔁 **克隆功能**：快速复制配置，管理多个 API Key
- ☁️ **WebDAV 同步**（可选）：同步配置到你自己的 WebDAV 服务器（iCloud/Dropbox）
- 🔒 **无第三方上传**：不会上传到我们的服务器，配置权限 `0600`
- 🎨 **交互式菜单**：无需记忆命令，跟随提示操作

---

## 也许你不需要 anyaitools

anyaitools 的核心功能是自动化配置文件的切换：

- **Codex**：自动修改 `~/.codex/config.toml`
- **Claude Code**：自动修改 `~/.claude/settings.json`
- **Gemini CLI**：自动修改 `~/.gemini/settings.json` 和 `~/.gemini/.env`
- **OpenCode**：自动修改 `~/.config/opencode/opencode.json`
- **Grok Build**：安全合并 `$GROK_HOME/config.toml`（默认 `~/.grok/config.toml`）
- **MCP**：管理 MCP 服务器配置，并同步到 Claude Code 和 Gemini CLI
- **备份机制**：写入前自动备份，失败时自动回滚

如果你更喜欢手动编辑配置文件，或者只使用一个服务商从不切换，可能不需要这个工具。

📖 更多信息：[GitHub 仓库](https://github.com/2ue/anyaitools) - 包含手动配置方式和详细对比分析

---

## 安装

```bash
npm install -g @vebing-tools/anyaitools
```

**要求**：anyaitools 需要 Node.js >= 18.0.0；使用 xAI 官方 Grok Build CLI 需要 Node.js >= 20.0.0。

**Desktop 版本**：如果你更喜欢图形界面，可以从 [GitHub Releases](https://github.com/2ue/anyaitools/releases) 下载 Desktop 应用（macOS/Windows/Linux）。

---

## 快速开始

### 查看帮助

```bash
$ aat --help

Usage: aat [options] [command]

Any AI Tools 工作流配置与集成工具

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  cx              管理 Codex 服务商
  cc              管理 Claude 服务商
  gm              管理 Gemini CLI 服务商
  oc              管理 OpenCode 服务商
  openclaw|ow     管理 OpenClaw 服务商
  grok|gk         管理 xAI Grok Build 服务商
  mcp             管理 MCP 服务器
  sync            WebDAV 同步配置
  export [dir]    导出配置
  import [dir]    导入配置
  help [command]  display help for command
```

### 管理 Codex 服务商

```bash
aat cx           # 进入交互式菜单
aat cx add       # 添加服务商
aat cx use       # 切换服务商
aat cx list      # 查看所有服务商
```

**示例输出**：

```bash
$ aat cx list

📋 Codex 服务商 (2 个)

  ●  OpenAI Official [当前]
     https://api.openai.com/v1

  ○  OKMCode
     https://okmcode.com
```

```bash
$ aat cx current

📍 当前 Codex 服务商

  OpenAI Official
  ID: codex-1760178741529-hbgbad
  URL: https://api.openai.com/v1
  最后使用: 2025/10/11 18:32:25
```

### 管理 Claude Code 服务商

```bash
aat cc           # 进入交互式菜单
aat cc add       # 添加服务商
aat cc use       # 切换服务商
aat cc list      # 查看所有服务商
```

**示例输出**：

```bash
$ aat cc list

📋 Claude Code 服务商 (1 个)

  ●  Anthropic Official [当前]
     https://api.anthropic.com
```

```bash
$ aat cc current

📍 当前 Claude Code 服务商

  Anthropic Official
  ID: claude-1760182672751-unh2bp
  URL: https://api.anthropic.com
  最后使用: 2025/10/11 20:14:08
```

### 管理 Gemini CLI 服务商

```bash
aat gm           # 进入交互式菜单
aat gm add       # 添加服务商
aat gm use       # 切换服务商
aat gm list      # 查看所有服务商
```

### 管理 OpenCode 服务商

```bash
aat oc           # 进入交互式菜单
aat oc add       # 添加服务商
aat oc use       # 切换服务商
aat oc list      # 查看所有服务商
```

### 管理 xAI Grok Build 服务商

AnyAI Tools 接入的是 xAI 官方 npm 包 `@xai-official/grok`，不是社区历史包
`@vibe-kit/grok-cli`。先安装官方 CLI：

```bash
npm install -g @xai-official/grok
grok version
```

管理服务商：

```bash
aat grok             # 进入交互式菜单；gk 是等价别名
aat gk add           # 添加官方预设或自定义兼容服务商
aat gk list          # 查看模型、API backend 和 backend search
aat gk use           # 写入当前服务商
aat gk current       # 查看 AnyAI Tools 当前选择
aat gk edit          # 编辑或清除内联 API Key
aat gk clone         # 克隆服务商
aat gk remove        # 删除服务商
```

非交互示例：

```bash
# 官方预设：只选择内置 grok-build，保留官方登录和内置路由。
aat gk add --preset "xAI Grok Build" --switch

# 自定义 OpenAI Chat Completions 兼容服务；URL 不会被补写或替换。
aat gk add \
  --name gateway \
  --base-url https://gateway.example.com/custom \
  --api-key sk-example \
  --model model-id \
  --api-backend chat_completions \
  --no-supports-backend-search \
  --switch
```

Grok Build 的用户配置位于 `$GROK_HOME/config.toml`，未设置 `GROK_HOME` 时为
`~/.grok/config.toml`。企业 requirements 或环境变量可能覆盖用户配置，所以切换后使用：

```bash
grok inspect
```

检查最终生效配置。完整说明见
[Grok Build 接入指南](https://github.com/2ue/anyaitools/blob/main/docs/grok-build.md)。

### 管理 MCP 服务器

```bash
aat mcp add      # 添加 MCP 服务器
aat mcp list     # 查看所有 MCP 服务器
aat mcp edit     # 编辑 MCP 服务器
aat mcp remove   # 删除 MCP 服务器
```

---

## 完整命令

| 命令                    | 说明                                                      |
| ----------------------- | --------------------------------------------------------- |
| `aat`                   | 主菜单（选择 Codex、Claude Code、Gemini CLI 或 OpenCode） |
| **Codex 管理**          |                                                           |
| `aat cx`                | Codex 交互式菜单                                          |
| `aat cx add`            | 添加 Codex 服务商（支持预设模板和自定义）                 |
| `aat cx list`           | 列出所有 Codex 服务商                                     |
| `aat cx use [name]`     | 切换 Codex 服务商                                         |
| `aat cx current`        | 查看当前 Codex 服务商                                     |
| `aat cx edit [name]`    | 编辑 Codex 服务商                                         |
| `aat cx remove [name]`  | 删除 Codex 服务商                                         |
| `aat cx clone [source]` | 克隆 Codex 服务商                                         |
| **Claude Code 管理**    |                                                           |
| `aat cc`                | Claude Code 交互式菜单                                    |
| `aat cc add`            | 添加 Claude Code 服务商                                   |
| `aat cc list`           | 列出所有 Claude Code 服务商                               |
| `aat cc use [name]`     | 切换 Claude Code 服务商                                   |
| `aat cc current`        | 查看当前 Claude Code 服务商                               |
| `aat cc edit [name]`    | 编辑 Claude Code 服务商                                   |
| `aat cc remove [name]`  | 删除 Claude Code 服务商                                   |
| `aat cc clone [source]` | 克隆 Claude Code 服务商                                   |
| **Gemini CLI 管理**     |                                                           |
| `aat gm`                | Gemini CLI 交互式菜单                                     |
| `aat gm add`            | 添加 Gemini CLI 服务商                                    |
| `aat gm list`           | 列出所有 Gemini CLI 服务商                                |
| `aat gm use [name]`     | 切换 Gemini CLI 服务商                                    |
| `aat gm current`        | 查看当前 Gemini CLI 服务商                                |
| `aat gm edit [name]`    | 编辑 Gemini CLI 服务商                                    |
| `aat gm remove [name]`  | 删除 Gemini CLI 服务商                                    |
| `aat gm clone [source]` | 克隆 Gemini CLI 服务商                                    |
| **OpenCode 管理**       |                                                           |
| `aat oc`                | OpenCode 交互式菜单                                       |
| `aat oc add`            | 添加 OpenCode 服务商                                      |
| `aat oc list`           | 列出所有 OpenCode 服务商                                  |
| `aat oc use [name]`     | 切换 OpenCode 服务商                                      |
| `aat oc current`        | 查看当前 OpenCode 服务商                                  |
| `aat oc edit [name]`    | 编辑 OpenCode 服务商                                      |
| `aat oc remove [name]`  | 删除 OpenCode 服务商                                      |
| `aat oc clone [source]` | 克隆 OpenCode 服务商                                      |
| **Grok Build 管理**     |                                                           |
| `aat grok` / `aat gk`   | Grok Build 交互式菜单                                     |
| `aat gk add`            | 添加 Grok Build 服务商                                    |
| `aat gk list`           | 列出 Grok Build 服务商                                    |
| `aat gk use [name]`     | 切换 Grok Build 服务商                                    |
| `aat gk current`        | 查看当前 Grok Build 服务商                                |
| `aat gk edit [name]`    | 编辑 Grok Build 服务商                                    |
| `aat gk remove [name]`  | 删除 Grok Build 服务商                                    |
| `aat gk clone [source]` | 克隆 Grok Build 服务商                                    |
| **MCP 服务器管理**      |                                                           |
| `aat mcp add`           | 添加 MCP 服务器                                           |
| `aat mcp list`          | 列出所有 MCP 服务器                                       |
| `aat mcp edit [name]`   | 编辑 MCP 服务器                                           |
| `aat mcp remove [name]` | 删除 MCP 服务器                                           |
| **配置同步和导入导出**  |                                                           |
| `aat sync`              | WebDAV 同步配置（备份/恢复/合并）                         |
| `aat export [dir]`      | 导出配置到本地目录                                        |
| `aat import [dir]`      | 从本地目录导入配置                                        |

服务商管理命令也支持参数模式：

```bash
aat cx add --name work --base-url https://api.example.com --api-key sk-xxx --switch
aat cc add --preset OKMCode --api-key sk-xxx --switch
aat gm edit default --new-name personal --base-url '' --api-key ''
aat oc remove old-provider --yes
aat gk edit gateway --model new-model --api-backend responses --supports-backend-search
```

WebDAV 同步支持参数模式和环境变量模式，适合在其他机器非交互执行：

```bash
aat sync config \
  --webdav-url https://dav.example.com \
  --username alice \
  --password 'YOUR_WEBDAV_PASSWORD' \
  --remote-dir /anyaitools \
  --sync-password 'YOUR_SYNC_PASSWORD' \
  --remember-sync-password

aat sync download --yes
```

```bash
export ANYAITOOLS_WEBDAV_URL='https://dav.example.com'
export ANYAITOOLS_WEBDAV_USERNAME='alice'
export ANYAITOOLS_WEBDAV_PASSWORD='YOUR_WEBDAV_PASSWORD'
export ANYAITOOLS_WEBDAV_REMOTE_DIR='/anyaitools'
export ANYAITOOLS_SYNC_PASSWORD='YOUR_SYNC_PASSWORD'

aat sync config
aat sync upload --yes
```

---

## 内置预设

添加服务商时可以选择"使用预设模板"，只需填写 API Key：

### Claude Code 预设（3 个）

| 预设名称           | Base URL                    |
| ------------------ | --------------------------- |
| Anthropic Official | `https://api.anthropic.com` |
| OKMCode            | `https://okmcode.com`       |
| OKMCode            | `https://okmcode.com`       |

### Gemini CLI 预设（3 个）

| 预设名称                | Base URL              |
| ----------------------- | --------------------- |
| Google Gemini (API Key) | 官方默认              |
| OKMCode                 | `https://okmcode.com` |
| OKMCode                 | `https://okmcode.com` |

### Codex 预设（3 个）

| 预设名称        | Base URL                    |
| --------------- | --------------------------- |
| OpenAI Official | `https://api.openai.com/v1` |
| OKMCode         | `https://okmcode.com`       |
| OKMCode         | `https://okmcode.com`       |

### OpenCode 预设（2 个）

| 预设名称 | Base URL              |
| -------- | --------------------- |
| OKMCode  | `https://okmcode.com` |
| OKMCode  | `https://okmcode.com` |

### Grok Build 预设（1 个）

| 预设名称       | 模式     | Model        | 认证                      |
| -------------- | -------- | ------------ | ------------------------- |
| xAI Grok Build | 官方内置 | `grok-build` | Grok 登录或 `XAI_API_KEY` |

该预设只写 `models.default = "grok-build"`，不重定义官方内置模型。自定义 Base URL、
模型、协议和搜索能力会按用户输入写入，不按域名推断。

### MCP 预设（多个）

MCP 服务器预设包括：filesystem、github、postgres、brave-search、fetch、memory 等多个常用 MCP 服务器模板。

也可以选择"自定义配置"，手动填写 Base URL。

---

## 完整使用示例

### 场景 1：添加并切换服务商

```bash
# 1. 查看当前列表
$ aat cx list

📋 Codex 服务商 (1 个)

  ●  OpenAI Official [当前]
     https://api.openai.com/v1

# 2. 添加 OKMCode（交互式）
$ aat cx add
? 选择配置方式 › 使用预设模板
? 选择预设 › OKMCode
? 服务商名称 › OKMCode
? API Key › ••••••••••••••••••••
✅ 添加成功！
💡 切换到此服务商: aat cx use OKMCode

# 3. 切换到 OKMCode
$ aat cx use OKMCode
✅ 已切换到: OKMCode

# 4. 确认当前服务商
$ aat cx current

📍 当前 Codex 服务商

  OKMCode
  ID: codex-1760178741529-abc123
  URL: https://okmcode.com
  最后使用: 2025/10/11 18:32:25
```

### 场景 2：克隆服务商（管理多个 Key）

```bash
# 1. 添加生产配置
$ aat cc add
? 选择配置方式 › 自定义配置
? 服务商名称 › Claude Production
? Base URL › https://api.anthropic.com
? API Key › ••••••••••••••••••••
✅ 添加成功！

# 2. 克隆创建测试配置
$ aat cc clone
? 选择要克隆的服务商 › Claude Production
? 新服务商名称 › Claude Test
? API Key › ••••••••••••••••••••
✅ 克隆成功！
💡 切换到此服务商: aat cc use "Claude Test"

# 3. 查看列表
$ aat cc list

📋 Claude Code 服务商 (2 个)

  ●  Claude Production [当前]
     https://api.anthropic.com

  ○  Claude Test
     https://api.anthropic.com

# 4. 快速切换
$ aat cc use "Claude Test"
✅ 已切换到: Claude Test
```

---

## 配置文件

**anyaitools 配置**：

- `~/.anyaitools/codex.json` - Codex 服务商配置
- `~/.anyaitools/claude.json` - Claude Code 服务商配置
- `~/.anyaitools/gemini.json` - Gemini CLI 服务商配置
- `~/.anyaitools/opencode.json` - OpenCode 服务商配置
- `~/.anyaitools/grok.json` - Grok Build 服务商配置
- `~/.anyaitools/mcp.json` - MCP 服务器配置

**工具配置**（anyaitools 会自动修改）：

- **Codex**: `~/.codex/config.toml`
- **Claude Code**: `~/.claude/settings.json`
- **Gemini CLI**: `~/.gemini/settings.json` 和 `~/.gemini/.env`
- **OpenCode**: `~/.config/opencode/opencode.json`
- **Grok Build**: `$GROK_HOME/config.toml`（默认 `~/.grok/config.toml`）

**安全写入承诺**：

- 快捷覆盖和其他高风险入口写入前备份；常规 provider 管理不生成 `.bak`
- 常规管理命令（如 `aat cx` / `aat cc` / `aat gm` / `aat oc` / `aat openclaw` / `aat grok`）默认采用增量更新
- 快捷配置命令（如 `aat okm`）会对所涉及工具执行覆盖式写入
- API Key 存储在本地，权限 `0600`
- Grok 内置模式不创建受管模型节点或写入 `api_key`；自定义端点的 Key 留空时也不会生成内联密钥

---

## 常见问题

**Q: 支持配置导入/导出吗？**
A: 当前版本不支持。如需备份，手动复制 `~/.anyaitools/` 目录。

**Q: WebDAV 同步是什么？**
A: 将 anyaitools 配置同步到 WebDAV 服务器（如 iCloud/Dropbox），多设备共享配置。详见 `aat sync --help`。

---

## 许可证

MIT

---

## 相关链接

- [GitHub 仓库](https://github.com/2ue/anyaitools)
- [问题反馈](https://github.com/2ue/anyaitools/issues)
- [更新日志](https://github.com/2ue/anyaitools/blob/main/CHANGELOG.md)
- [Desktop 版本](https://github.com/2ue/anyaitools/releases)（图形界面）
