# 如何手动配置 Gemini CLI

## 前言

`anyaitools` 已经可以自动写入 Gemini CLI 配置（`aat gm` / `aat okm -p gemini`）。
如果你在特殊场景下需要手动配置，可按本文操作。

---

## 配置文件路径

```text
~/.gemini/settings.json
~/.gemini/.env
```

完整模板请参考：

- `packages/core/templates/gemini/settings.json`
- `packages/core/templates/gemini/.env`

---

## 最小可用配置（关键字段）

### 1) settings.json

```json
{
  "model": {
    "name": "gemini-model-id"
  },
  "ide": { "enabled": true },
  "security": { "auth": { "selectedType": "gemini-api-key" } }
}
```

### 2) .env

```bash
GOOGLE_GEMINI_BASE_URL=https://okmcode.com
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-model-id
```

官方当前配置结构推荐使用 `settings.json` 的 `model.name`：

```json
{
  "model": {
    "name": "gemini-model-id"
  }
}
```

`.env` 中的 `GEMINI_MODEL` 是 AnyAI Tools 当前兼容路径，具体优先级取决于
Gemini CLI 版本、环境变量和启动参数。模型名称应以你使用的 Gemini CLI 版本和
服务商实际支持列表为准，不要直接把本文示例当成固定型号。

## 切换模型

### 原生方式

1. 编辑 `~/.gemini/settings.json` 的 `model.name`。
2. 检查 `~/.gemini/.env` 和系统环境变量是否存在 `GEMINI_MODEL`。
3. 使用当前版本支持的 CLI 参数（先运行 `gemini --help` 确认）。
4. 新建会话验证。

### 使用 AnyAI Tools

```bash
aat gm add
aat gm use <服务商ID>
aat gm current
```

当前 writer 会写入 `~/.gemini/.env` 的 `GEMINI_MODEL`。普通字符串
`provider.model` 会直接作为模型名；高级 JSON 元数据可以使用 `defaultModel`
或 `env` 设置多个变量。`settings.json` 的官方 `model.name` 目前不会由
AnyAI Tools 自动同步，因此需要固定模型时应手动保持两个位置一致，并检查哪一层
最终优先级更高。

---

## 与 anyaitools 的关系

- `anyaitools` 写入 Gemini 时，会以模板为基准更新关键字段；
- `settings.json` 与 `.env` 的非托管字段会尽量保留；
- 需要统一团队默认配置时，优先维护模板文件而不是反复手改用户目录；
- 如果团队要求统一模型，优先把模型写入官方 `settings.json.model.name`，同时确认
  `.env` 和环境变量没有冲突。
