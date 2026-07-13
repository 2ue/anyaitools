# xAI Grok Build 接入指南

AnyAI Tools 接入的是 xAI 官方 Grok Build CLI：

```text
npm package: @xai-official/grok
command: grok
minimum Node.js: 20
```

社区历史包 `@vibe-kit/grok-cli` 和它的后续项目 `grok-dev` 不是 xAI 官方 CLI，
配置格式也与 Grok Build 不兼容。AnyAI Tools 不会读写它们的 JSON 配置。

## 安装和登录

```bash
npm install -g @xai-official/grok
grok version
```

首次运行 `grok` 可以通过浏览器登录。无浏览器环境可以使用：

```bash
grok login --device-auth
```

CI 或无交互环境可以设置：

```bash
export XAI_API_KEY='xai-...'
```

官方内置模型模式不写 Base URL、自定义模型节点或内联 Key，只选择 Grok Build 自带的
模型，因此可以继续使用当前登录会话或 `XAI_API_KEY`。自定义端点模式可以保存独立
API Key；留空时不会写入 `api_key`，后续认证按 Grok Build 自身的凭证优先级处理。

## 配置路径

AnyAI Tools 只管理 Grok Build 的用户级配置：

```text
$GROK_HOME/config.toml
```

未设置 `GROK_HOME` 时为：

```text
~/.grok/config.toml
```

项目级 `.grok/config.toml` 只用于 MCP、插件和权限，不用于 provider/model 配置。

## 管理命令

`grok` 和 `gk` 是等价的 AnyAI Tools 子命令：

```bash
aat grok
aat gk add
aat gk list
aat gk use [name]
aat gk current
aat gk edit [name]
aat gk clone [source-name] [new-name]
aat gk remove [name]
```

官方预设：

```bash
aat gk add --preset "xAI Grok Build" --switch
```

该预设使用官方内置模型：

```text
Model: grok-build
Base URL: empty (built-in mode)
Auth: grok login / XAI_API_KEY
```

切换后只设置 `[models].default = "grok-build"`。它不会把内置模型重定义到公开
`api.x.ai` 端点，也不会复制官方 CLI 的内部路由。

自定义兼容服务商：

```bash
aat gk add \
  --name gateway \
  --base-url https://gateway.example.com/custom \
  --api-key sk-example \
  --model model-id \
  --api-backend chat_completions \
  --no-supports-backend-search \
  --switch
```

支持的 API backend：

| 值                 | 用途                             |
| ------------------ | -------------------------------- |
| `chat_completions` | OpenAI Chat Completions 兼容 API |
| `responses`        | OpenAI Responses 兼容 API        |
| `messages`         | Anthropic Messages 兼容 API      |

AnyAI Tools 不根据域名推断协议，不添加 `/v1`，也不替换用户输入的域名。第三方
服务是否支持 backend search 必须由用户或预设明确指定。

编辑示例：

```bash
aat gk edit gateway \
  --model newer-model \
  --api-backend responses \
  --supports-backend-search

# 清除自定义端点的内联密钥，后续认证交给 Grok Build 的凭证解析。
aat gk edit gateway --api-key ''
```

## 写入结果

官方内置模式不创建 `[model.*]` 节点：

```toml
[models]
default = "grok-build"
```

自定义端点模式使用稳定 ID 作为 Grok 模型 alias，配置结构类似：

```toml
[models]
default = "grok-123456-example"

[model."grok-123456-example"]
model = "model-id"
base_url = "https://gateway.example.com/custom"
name = "gateway"
api_backend = "chat_completions"
supports_backend_search = false
```

当自定义 provider 有内联 API Key 时，目标模型节点还会包含 `api_key`。AnyAI Tools
根据 Base URL 是否为空区分两种显式模式，不查看或推断域名。它只更新
`models.default` 与自己的受管 alias，并保留其他模型、MCP、插件、权限、认证、未知
字段，以及官方 npm 安装器维护的 `[cli]` 配置。

TOML 无法解析时，切换会失败，不会覆盖原文件，也不会提前更新 AnyAI Tools 的当前
provider 状态。

## 验证最终配置

写入用户配置不代表它一定具有最高优先级。`GROK_DEFAULT_MODEL`、命令行 `-m` 和企业
`requirements.toml` 都可能改变最终结果。每次切换后运行：

```bash
grok inspect
```

以 Grok Build 报告的有效配置为准。

## 官方资料

- [Grok Build Overview](https://docs.x.ai/build/overview)
- [Grok Build Settings](https://docs.x.ai/build/settings)
- [Settings Reference](https://docs.x.ai/build/settings/reference)
- [官方 npm 包](https://www.npmjs.com/package/@xai-official/grok)
