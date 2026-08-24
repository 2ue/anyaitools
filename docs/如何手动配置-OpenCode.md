# 如何手动配置 OpenCode

本文同时说明 OpenCode 的原生配置方式和 AnyAI Tools 的配置方式。

## 配置文件

OpenCode 主要使用：

```text
~/.config/opencode/opencode.json
```

通过 `/connect` 保存的 provider 凭据通常位于：

```text
~/.local/share/opencode/auth.json
```

AnyAI Tools 另外保存自己的服务商列表：

```text
~/.anyaitools/opencode.json
```

## 原生配置

最小配置需要把默认模型写成完整的 `provider/model-id`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "openai/gpt-5.5",
  "provider": {
    "openai": {
      "options": {
        "baseURL": "https://api.example.com/v1",
        "apiKey": "sk-xxx"
      },
      "models": {
        "gpt-5.5": {
          "name": "GPT-5.5",
          "variants": {
            "low": {},
            "medium": {},
            "high": {},
            "xhigh": {}
          }
        }
      }
    }
  }
}
```

这里有三层概念：

- `openai` 是 provider ID。
- `gpt-5.5` 是模型 ID。
- `low`、`high` 是同一个模型的 variant，不是新的模型。

如果 provider 已经通过 `/connect` 登录，可以只配置 provider 和 model，不必把
API Key 写进 `opencode.json`。

## 原生切换模型

查看当前 provider 能提供的模型：

```bash
opencode models
opencode models openai
```

修改默认模型：

```json
{
  "model": "anthropic/claude-sonnet-4-5"
}
```

只对本次运行临时切换：

```bash
opencode --model anthropic/claude-sonnet-4-5
opencode -m anthropic/claude-sonnet-4-5
```

在 TUI 中可以使用 `/models` 选择模型；支持 variant 的模型可以用
`Ctrl+T` 在不同推理档位之间切换。agent 也可以单独配置 `model`，没有配置时
继承全局模型。

验证时，确保顶层 `model` 的 provider/model 引用和 `provider.<id>.models` 中的
模型定义一致。裸写 `gpt-5.5`、把 variant 写进模型 ID，都会导致模型找不到。

## 使用 AnyAI Tools

```bash
aat oc add
aat oc use <服务商ID>
aat oc current
```

当前 AnyAI Tools 会：

- 写入 `~/.config/opencode/opencode.json`；
- 更新 OpenAI provider 的 Base URL 和 API Key；
- 把顶层默认模型固定为 `openai/gpt-5.5`；
- 维护 `gpt-5.5` 的 `low/medium/high/xhigh` variants；
- 尽量保留其他 provider、模型和用户配置。

当前 Desktop 和 CLI 没有真正的 OpenCode 模型选择字段，因此 `aat oc use` 主要是
切换服务商和认证，不是任意模型选择器。需要使用其他模型时：

1. 先用 `aat oc use` 切换服务商。
2. 再手动修改 `opencode.json` 的顶层 `model`。
3. 确认对应 provider 的 `models` 中存在该模型。
4. 重启 OpenCode 或新建会话。

`provider.model` 在当前 AnyAI Tools 中主要用于高级 JSON 元数据，不会直接替换
OpenCode 的默认模型。

## 常见问题

### 顶层模型写了但仍然报找不到

检查是否使用完整引用：

```text
正确：openai/gpt-5.5
错误：gpt-5.5
```

然后运行：

```bash
opencode models
```

确认 provider ID 和模型 ID 都存在。

### 为什么切换 provider 后模型没有变化

AnyAI Tools 的 provider 切换和 OpenCode 的模型切换是两件事。当前 writer 会把
默认模型规范化为 `openai/gpt-5.5`，需要其他模型时必须手动设置顶层 `model`。

## 官方资料

- <https://opencode.ai/docs/config/>
- <https://opencode.ai/docs/models/>
- <https://opencode.ai/docs/providers/>
- <https://opencode.ai/docs/cli/>
