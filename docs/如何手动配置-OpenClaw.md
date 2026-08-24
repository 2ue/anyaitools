# 如何手动配置 OpenClaw

本文同时说明 OpenClaw 的原生配置方式和 AnyAI Tools 的配置方式。

## 配置文件

OpenClaw 的主要配置文件是：

```text
~/.openclaw/openclaw.json
~/.openclaw/agents/main/agent/models.json
```

AnyAI Tools 自己的服务商列表位于：

```text
~/.anyaitools/openclaw.json
```

## 原生配置

OpenClaw 的模型引用必须使用 `provider/model-id`：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai/gpt-5.5",
        "fallbacks": ["openai/gpt-4.1"]
      },
      "imageModel": {
        "primary": "openai/gpt-5.5",
        "fallbacks": ["openai/gpt-4.1"]
      },
      "models": {
        "openai/gpt-5.5": {
          "alias": "GPT"
        }
      },
      "modelPolicy": {
        "allow": ["openai/*"]
      }
    }
  },
  "models": {
    "providers": {
      "openai": {
        "baseUrl": "https://api.example.com/v1",
        "apiKey": "sk-xxx",
        "api": "openai-responses",
        "models": [
          {
            "id": "gpt-5.5",
            "name": "gpt-5.5",
            "api": "openai-responses",
            "reasoning": true,
            "input": ["text", "image"]
          }
        ]
      }
    }
  }
}
```

重要字段的含义：

- `agents.defaults.model.primary`：默认文本主模型。
- `agents.defaults.model.fallbacks`：文本主模型失败时的备用链。
- `agents.defaults.imageModel.primary`：图片请求使用的模型。
- `agents.defaults.imageModel.fallbacks`：图片模型失败时的备用链。
- `agents.defaults.models`：模型别名和模型级设置，不会自动限制可选模型。
- `agents.defaults.modelPolicy.allow`：限制 `/model` 或其他覆盖入口的允许范围。
- `models.providers.<provider>.models[]`：模型池和能力声明。
- `input`：模型真实支持的输入模态，不是可以随便打开的开关。

## 原生切换模型

查看模型、认证和最终解析结果：

```bash
openclaw models list
openclaw models status
```

设置文本主模型和图像模型：

```bash
openclaw models set openai/gpt-5.5
openclaw models set-image openai/gpt-5.5
```

管理 fallback：

```bash
openclaw models fallbacks add openai/gpt-4.1
openclaw models image-fallbacks add openai/gpt-4.1
openclaw models fallbacks list
openclaw models fallbacks clear
```

管理 alias：

```bash
openclaw models aliases add fast openai/gpt-4.1-mini
openclaw models aliases list
```

创建独立 agent 时可以指定模型：

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.5
```

`openclaw models set` 和 `set-image` 修改的是默认 agent。需要确认某个 agent
实际使用的模型时，使用 `openclaw models status --agent <id>` 并检查
`agents.entries.<id>` 的覆盖配置。

## 使用 AnyAI Tools

```bash
aat openclaw add
aat openclaw use <服务商ID>
aat openclaw current
```

当前 AnyAI Tools writer 会同时更新：

```text
~/.openclaw/openclaw.json
~/.openclaw/agents/main/agent/models.json
```

它会为当前服务商写入一个 `gpt-5.5`，并设置：

```text
agents.defaults.model.primary = provider/gpt-5.5
agents.defaults.imageModel.primary = provider/gpt-5.5
```

常规切换会保留其他 provider 和未托管字段；覆盖模式只保留模板和当前 provider。
当前 Desktop 和 CLI 没有 fallback、image-fallback、alias、modelPolicy 或 agent
模型的编辑字段，因此多模型路由需要使用 OpenClaw 原生配置。

## 常见问题

### 为什么图片和文本没有使用同一个模型

OpenClaw 将 `model.primary` 和 `imageModel.primary` 分开处理。模型不支持图片时，
应配置真正支持图片的 `imageModel`，不要只修改 `input` 声明。

### 为什么改了配置但运行结果没变

检查以下优先级：

1. 当前 agent 是否有自己的模型覆盖。
2. `primary` 是否被 fallback 或 alias 解析到其他模型。
3. 是否存在 `modelPolicy.allow` 限制。
4. 使用 `openclaw models status` 查看最终解析结果。

## 官方资料

- <https://docs.openclaw.ai/providers>
- <https://docs.openclaw.ai/gateway/configuration>
- <https://docs.openclaw.ai/cli/models>
- <https://docs.openclaw.ai/cli/agents>
