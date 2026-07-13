# Grok CLI 配置与 AnyAI Tools 接入分析

> 调研日期：2026-07-12
> 接入目标：xAI 官方 Grok Build CLI
> 官方 npm 包：`@xai-official/grok`
> 可执行命令：`grok`

## 一、结论

用户最初指定的 `@vibe-kit/grok-cli` 不是 xAI 官方 CLI。它是 Superagent 社区项目的历史包名，对应项目当前也明确声明与 xAI 没有隶属、背书或赞助关系。

截至调研日期，xAI 官方 CLI 是：

```text
@xai-official/grok
```

官方产品名称为 Grok Build。npm 稳定版本为 `0.2.93`，`alpha` 标签为 `0.2.98`；发布者和维护者是 `xai-security <security@x.ai>`，最低要求 Node.js 20。

因此，本次 AnyAI Tools 应接入 `@xai-official/grok`，而不是为 `@vibe-kit/grok-cli` 的旧 JSON 配置格式新增兼容层。

## 二、身份核验

| 实现                  | npm 包               | 当前版本        | 身份           | 配置格式 |
| --------------------- | -------------------- | --------------- | -------------- | -------- |
| xAI Grok Build        | `@xai-official/grok` | stable `0.2.93` | xAI 官方       | TOML     |
| Superagent 当前社区版 | `grok-dev`           | `1.1.7`         | 社区项目       | JSON     |
| Superagent 历史包     | `@vibe-kit/grok-cli` | `0.0.34`        | 社区项目旧包名 | JSON     |

主要证据：

- [xAI Grok CLI](https://x.ai/cli)
- [官方 npm 包 `@xai-official/grok`](https://www.npmjs.com/package/@xai-official/grok)
- [Grok Build 官方文档](https://docs.x.ai/build/overview)
- [官方 Settings 文档](https://docs.x.ai/build/settings)
- [Superagent 社区项目](https://github.com/superagent-ai/grok-cli)
- [`@vibe-kit/grok-cli`](https://www.npmjs.com/package/@vibe-kit/grok-cli)

`@vibe-kit/grok-cli` 的 npm 元数据没有官方仓库或主页，作者仍是占位值 `Your Name`，维护者为个人账号 `homanp`。对应 Superagent 仓库当前 README 还明确写明：项目由社区构建，不隶属于 xAI，也未获得 xAI 背书或赞助。

## 三、安装与认证

官方 npm 安装方式：

```bash
npm install -g @xai-official/grok
```

验证安装：

```bash
grok version
grok inspect
```

官方支持以下认证方式：

1. 首次启动时通过浏览器登录。
2. 使用 `grok login --device-auth` 完成设备认证。
3. 使用 `XAI_API_KEY`。
4. 在单个模型配置中使用 `env_key` 引用环境变量。
5. 在单个模型配置中直接使用 `api_key`。

单模型凭证优先级为：

```text
model.api_key
> model.env_key 指向的环境变量
> 当前登录 session token
> XAI_API_KEY
```

认证必须区分两种模式：官方内置模型无需自定义模型节点，通过浏览器登录、设备认证或 `XAI_API_KEY` 工作；自定义端点才在受管模型节点中写入可选的 `api_key`。不能把登录 session 对应的内置 `grok-build` 重定义到公开 `api.x.ai` 端点，否则虽然 TOML 能解析，认证与路由语义并不等价。

## 四、官方配置文件

默认用户配置文件：

```text
~/.grok/config.toml
```

如果设置了 `GROK_HOME`，路径改为：

```text
$GROK_HOME/config.toml
```

Windows 默认路径：

```text
%USERPROFILE%\.grok\config.toml
```

项目级配置文件是：

```text
<project>/.grok/config.toml
```

项目级文件只允许存放 MCP、插件和权限规则，不允许存放完整的用户模型配置。因此 AnyAI Tools 必须只管理用户级 `config.toml`，不能根据 Desktop 或 CLI 的当前工作目录写项目配置。

## 五、官方模型配置结构

Grok Build 自带 `grok-build` 等内置模型。官方文档明确说明内置模型不需要自定义配置，持久选择只需：

```toml
[models]
default = "grok-build"
```

此时内置 catalog 提供正确的模型、Base URL 和能力，认证可使用 `grok login` 或环境变量。AnyAI Tools 不应为这种模式创建 `[model.<alias>]`，也不应复制或猜测内置端点。

自定义 API、代理或本地模型没有独立的 provider 表，一个 provider 与模型的组合表现为：

```toml
[model."provider-alias"]
model = "actual-model-id"
base_url = "https://api.example.com/v1"
name = "Provider A"
description = "Optional description"
api_key = "secret"
api_backend = "chat_completions"
supports_backend_search = false
```

当前默认模型由 `[models].default` 指向 alias：

```toml
[models]
default = "provider-alias"
```

官方支持的单模型字段包括：

```text
model
base_url
name
description
api_key
env_key
api_backend
temperature
top_p
max_completion_tokens
context_window
extra_headers
supports_backend_search
supports_reasoning_effort
reasoning_effort
stream_tool_calls
max_retries
inference_idle_timeout_secs
```

`api_backend` 支持：

| 值                 | 协议                             |
| ------------------ | -------------------------------- |
| `chat_completions` | OpenAI Chat Completions 兼容协议 |
| `responses`        | OpenAI Responses 兼容协议        |
| `messages`         | Anthropic Messages 兼容协议      |

AnyAI Tools 不能根据域名猜测协议，也不能自动给 URL 添加 `/v1`。用户输入的 Base URL 必须逐字写入；协议由用户或预设明确选择。

## 六、模型选择优先级

常见模型选择顺序为：

```text
本次命令的 -m/--model
> GROK_DEFAULT_MODEL
> [models].default
> 官方内置或远端 catalog 默认值
```

企业 requirements 配置可以继续覆盖用户选择，所以写入文件成功不等于最终一定生效。AnyAI Tools 应准确表述为“已写入用户配置”，最终有效配置可通过以下命令核验：

```bash
grok inspect
```

官方配置层从低到高为：

```text
/etc/grok/managed_config.toml
~/.grok/managed_config.toml
~/.grok/config.toml
~/.grok/requirements.toml
/etc/grok/requirements.toml
```

## 七、AnyAI Tools 的数据映射

AnyAI Tools provider 分为显式的内置模型和自定义端点两种模式，不根据域名判断：

| 模式       | 判定                    | Grok Build TOML                                                                 |
| ---------- | ----------------------- | ------------------------------------------------------------------------------- |
| 内置模型   | `provider.baseUrl` 为空 | `models.default = provider.model`，不创建自定义模型节点                         |
| 自定义端点 | `provider.baseUrl` 非空 | 使用 `provider.id` 创建稳定 `model.<alias>`，并令 `models.default` 指向该 alias |

自定义端点的字段映射如下：

| AnyAI Tools 字段                 | Grok Build TOML                         |
| -------------------------------- | --------------------------------------- |
| `provider.id`                    | `model.<alias>` 的稳定 alias            |
| `provider.name`                  | `model.<alias>.name`                    |
| `provider.desc`                  | `model.<alias>.description`             |
| `provider.baseUrl`               | `model.<alias>.base_url`                |
| `provider.apiKey`                | `model.<alias>.api_key`                 |
| `provider.model`                 | `model.<alias>.model`                   |
| `provider.apiBackend`            | `model.<alias>.api_backend`             |
| `provider.supportsBackendSearch` | `model.<alias>.supports_backend_search` |
| 当前 provider ID                 | 自定义模式下的 `models.default`         |

自定义 alias 使用内部稳定 ID，不使用可编辑的 provider 名称，也不根据域名生成。这可以避免用户改名后留下断裂引用，并允许多个 provider 配置同时保留。内置模式直接使用官方模型 ID，不创建 alias。

## 八、安全写入策略

Grok writer 必须满足以下要求：

1. 使用 TOML parser 解析和序列化，不能用字符串拼接修改配置。
2. TOML 解析失败时立即中止，不能用新模板覆盖损坏文件。
3. 默认采用 merge；内置模式只更新 `models.default`，自定义模式只更新目标 `model.<alias>` 和 `models.default`。
4. 保留所有其他模型节点及未知字段。
5. 保留 `mcp_servers`、`plugins`、`permission`、`auth` 和 `cli`。
6. 特别保留 `[cli].installer` 与 `[cli].npm_registry`，官方 npm 安装器会使用这些字段。
7. 使用同目录临时文件和原子 rename。
8. 配置文件权限设为 `0600`。
9. 日志、异常和测试快照不能输出 API Key。
10. 不修改 `~/.grok/auth` 或 `~/.grok/mcp_credentials.json`。

在 overwrite 模式下，也只重置 AnyAI Tools 管理的 `models` 与 `model` 段，仍保留 MCP、插件、权限、认证和 CLI 安装器配置。

## 九、内置预设与自定义服务商

官方预设选择 Grok Build 内置模型：

```text
名称：xAI Grok Build
Base URL：（空，表示显式内置模式）
Model：grok-build
认证：grok login / XAI_API_KEY
```

该预设切换后只写 `models.default = "grok-build"`，让官方 CLI 保留内置路由和能力。自定义端点则由用户明确填写 Base URL、模型、API Backend 和搜索能力；默认协议是 `chat_completions`，也可显式切换为 `responses` 或 `messages`。两种模式的选择来自配置字段，不来自域名识别。

## 十、MCP 边界

官方 Grok Build 的 MCP 配置与模型配置位于同一个 `config.toml`：

```toml
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
enabled = true

[mcp_servers.linear]
url = "https://mcp.linear.app/mcp"
headers = { "Authorization" = "Bearer ${LINEAR_API_KEY}" }
```

本次 provider writer 必须保留这些配置，但暂不把 Grok 加入 AnyAI Tools 的通用 MCP 开关。原因是现有 MCP 模块的应用模型和 Grok 官方 TOML schema 不同，混在本次 provider 接入中会扩大风险。后续可以独立增加 Grok MCP writer。

## 十一、产品接入范围

本次实现计划覆盖：

- Core：类型、路径、官方 TOML writer、预设、ToolManager。
- CLI：`aat grok` 与 `aat gk`，完整增删改查、克隆和切换。
- Desktop：侧栏、Dashboard、Grok 页面、provider 表单、预设管理、配置编辑器。
- 模型配置：模型 ID、API backend、backend search 开关。
- WebDAV：同步 `~/.anyaitools/grok.json`，API Key 继续加密。
- 导入导出：支持 `grok.json`。
- 文档：安装、优先级、路径和兼容性说明。
- 测试：安全合并、自定义 URL、协议选择、损坏 TOML、权限和状态回滚。

本次不覆盖：

- `@vibe-kit/grok-cli` 和 `grok-dev` 的 JSON 兼容层。
- 自动安装或升级官方 Grok CLI。
- 浏览器 OAuth 自动化。
- 企业 requirements 策略修改。
- Grok MCP 的可视化管理。

## 十二、验收标准

1. 任意自定义 Base URL 可以逐字写入，没有域名识别或替换。
2. 切换内置 provider 后，`models.default` 直接指向模型 ID，且不创建自定义模型节点。
3. 切换自定义 provider 后，`models.default` 指向稳定 ID，目标模型节点包含正确的模型、URL、名称、认证与 backend。
4. 原有模型、MCP、插件、权限、认证和 CLI 字段不丢失。
5. TOML 损坏时切换失败，AnyAI Tools 的 current provider 状态不前移。
6. 内置模式不写 `api_key`，允许官方登录或 `XAI_API_KEY` 生效；自定义模式的空 Key 不产生内联密钥。
7. 配置文件权限为 `0600`。
8. CLI 与 Desktop 均能完成添加、编辑、克隆、切换、删除和查看当前 provider。
9. WebDAV 同步和导入导出包含 Grok provider 库。
10. Core、CLI、Desktop 构建及相关测试全部通过。
