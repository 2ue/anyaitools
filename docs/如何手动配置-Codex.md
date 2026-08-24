# 如何手动配置 Codex

## 前言

**anyaitools** 工具已经将 Codex 的配置切换过程完全自动化，只需一条命令即可完成服务商的切换：

```bash
aat cx
```

但如果你想了解底层原理，或者需要手动配置 Codex（例如在 anyaitools 不可用的情况下），本文将详细讲解手动配置的完整流程。

---

## 配置原理

Codex 通过读取用户目录下的两个配置文件来获取 API 认证信息和服务地址：

1. **`~/.codex/config.toml`**：服务商配置和模型设置
2. **`~/.codex/auth.json`**：API 认证密钥

当你运行 Codex 时，它会：

1. 从 `config.toml` 读取当前使用的服务商名称（`model_provider`）
2. 从 `config.toml` 读取该服务商的 `base_url` 等配置
3. 从 `auth.json` 读取 API 密钥

---

## 手动配置步骤

### 第 1 步：创建配置目录

首先，确保 `.codex` 目录存在（Codex 安装后通常会自动创建，但某些情况下可能需要手动创建）：

```bash
# macOS/Linux
mkdir -p ~/.codex

# Windows (PowerShell)
mkdir $env:USERPROFILE\.codex
```

**Windows 路径说明**：

- `$env:USERPROFILE` 是 PowerShell 中的环境变量，指向当前用户的主目录
- 例如：如果你的用户名是 `Administrator`，则 `$env:USERPROFILE` 等价于 `C:\Users\Administrator`
- 完整路径示例：`C:\Users\Administrator\.codex\config.toml`

**快速打开配置目录**：

```powershell
# Windows (PowerShell) - 直接在文件资源管理器中打开配置目录
explorer $env:USERPROFILE\.codex

# 或者在 PowerShell 中查看当前用户目录路径
echo $env:USERPROFILE
```

### 第 2 步：配置服务商信息（config.toml）

在 `.codex` 目录下创建或编辑 `config.toml` 文件：

```bash
# macOS/Linux
vi ~/.codex/config.toml

# 或使用你喜欢的编辑器
code ~/.codex/config.toml

# 或使用 VS Code
code $env:USERPROFILE\.codex\config.toml
```

填写关键字段即可（完整模板见 `packages/core/templates/codex/config.toml`）：

```toml
model_provider = "serverA"
model = "gpt-5.5"
model_reasoning_effort = "xhigh"

[model_providers.serverA]
name = "serverA"
base_url = "https://serverA.com/v1"
wire_api = "responses"
requires_openai_auth = true
```

**关键配置项说明**：

| 字段                         | 说明                                                                | 必填                |
| ---------------------------- | ------------------------------------------------------------------- | ------------------- |
| `model_provider`             | 当前使用的服务商名称（必须与 `[model_providers.xxx]` 中的名称一致） | ✅ 必填             |
| `model`                      | 使用的模型名称（如 `gpt-5.5`）                                      | ✅ 必填             |
| `model_reasoning_effort`     | 模型推理强度（可选，建议保留）                                      | ❌ 可选             |
| `review_model`               | `/review` 使用的独立模型（可选）                                    | ❌ 可选             |
| `plan_mode_reasoning_effort` | Plan 模式推理强度（可选）                                           | ❌ 可选             |
| `model_reasoning_summary`    | 推理摘要展示策略（如 `auto`）                                       | ❌ 可选             |
| `model_verbosity`            | GPT-5 输出详细程度（如 `high`）                                     | ❌ 可选             |
| `personality`                | 默认沟通风格（如 `pragmatic`）                                      | ❌ 可选             |
| `web_search`                 | Web 搜索策略（如 `cached`）                                         | ❌ 可选（建议保留） |
| `[model_providers.xxx]`      | 服务商配置块，`xxx` 为服务商名称                                    | ✅ 必填             |
| `name`                       | 服务商名称（必须与 `model_provider` 一致）                          | ✅ 必填             |
| `base_url`                   | 服务商的 API 基础地址                                               | ✅ 必填             |
| `wire_api`                   | API 协议类型（通常为 `responses`）                                  | ✅ 必填             |
| `requires_openai_auth`       | 是否需要 OpenAI 格式认证（通常为 `true`）                           | ✅ 必填             |

### 第 3 步：配置 API 密钥（auth.json）

在 `.codex` 目录下创建或编辑 `auth.json` 文件：

```bash
# macOS/Linux
vi ~/.codex/auth.json

# Windows (PowerShell)
notepad $env:USERPROFILE\.codex\auth.json
```

填写以下内容（替换为你的真实 API 密钥）：

```json
{
  "OPENAI_API_KEY": "sk-xxx"
}
```

**重要提示**：

- `OPENAI_API_KEY` 的值必须替换为服务商提供的真实 API 密钥
- 密钥格式通常为 `sk-xxx` 或 `sk-proj-xxx`

### 第 4 步：验证配置

保存文件后，重新启动 Codex 即可生效。你可以通过以下命令验证配置是否正确：

```bash
codex --version
```

## 切换模型

### 原生方式

修改 `~/.codex/config.toml` 的根级 `model`：

```toml
model_provider = "serverA"
model = "gpt-5.5"
review_model = "gpt-5.5"
```

只想本次启动临时切换时，使用命令行参数：

```bash
codex --model gpt-5.5
```

`model_provider` 决定服务商，`model` 决定该服务商下使用的模型。两者都要和
`[model_providers.<name>]` 对应。`review_model` 是 `/review` 的独立模型；
`model_reasoning_effort` 和 `plan_mode_reasoning_effort` 只是推理强度，不是模型。

### 使用 AnyAI Tools

```bash
aat cx add
aat cx use <服务商ID>
aat cx current
```

AnyAI Tools 核心 writer 支持 `provider.model` 写入根级 `model`，但当前 Desktop
通用表单和 CLI 的 Codex 添加/编辑命令没有单独的模型输入项。因此最稳妥的做法是：

1. 先在 `config.toml` 手动设置 `model`（必要时同时设置 `review_model`）。
2. 再用 `aat cx use` 切换服务商和 API Key。
3. 切换后检查 `config.toml`，确认命令行参数或项目配置没有覆盖它。

`aat cx current` 只能确认 AnyAI Tools 当前服务商，不代表最终模型一定是该值。

---

## 配置示例

### 使用 okmcode 服务商（关键字段）

**config.toml**（完整模板见 `packages/core/templates/codex/config.toml`）：

```toml
model_provider = "okmcode"
model = "gpt-5.5"

[model_providers.okmcode]
name = "okmcode"
base_url = "https://okmcode.com"
wire_api = "responses"
requires_openai_auth = true
```

**auth.json**：

```json
{
  "OPENAI_API_KEY": "sk-proj-abc123xyz456..."
}
```

---

后面是配置字段讲解，不想听的同学可以忽略

## 配置文件结构详解

### config.toml 文件详解

Codex 使用 TOML 格式存储配置（比 JSON 更易读）。
完整模板请参考 `packages/core/templates/codex/config.toml`。

#### 1. 全局配置

```toml
model_provider = "serverA"  # 当前使用的服务商名称
model = "gpt-5.5"        # 使用的模型
model_reasoning_effort = "xhigh" # 推理强度（可选）
```

#### 2. 服务商配置块

```toml
[model_providers.serverA]  # 服务商名称（必须与 model_provider 一致）
name = "serverA"           # 服务商显示名称
base_url = "https://serverA.com/v1"  # API 地址
wire_api = "responses"       # API 协议
requires_openai_auth = true  # 认证方式
```

**重要特性**：

- 你可以在同一个 `config.toml` 中配置**多个服务商**
- 通过修改 `model_provider` 的值来切换服务商

### auth.json 文件详解

```json
{
  "OPENAI_API_KEY": "你的 API 密钥"
}
```

**注意**：

- 这个文件只包含一个字段：`OPENAI_API_KEY`
- 密钥必须是服务商提供的有效密钥
- 文件格式为 JSON

---

## 配置多个服务商

Codex 支持在同一个 `config.toml` 中配置多个服务商，切换服务商只需修改 `model_provider` 的值。

### 示例：配置三个服务商

**config.toml**（仅关键字段；完整模板见 `packages/core/templates/codex/config.toml`）：

```toml
# 当前使用的服务商
model_provider = "serverA"
model = "gpt-5.5"
model_reasoning_effort = "xhigh"

# 服务商 A：serverA
[model_providers.serverA]
name = "serverA"
base_url = "https://codex-api.serverA.com/v1"
wire_api = "responses"
requires_openai_auth = true

# 服务商 B：openai
[model_providers.openai]
name = "openai"
base_url = "https://api.openai.com/v1"
wire_api = "responses"
requires_openai_auth = true

# 服务商 C：custom
[model_providers.custom]
name = "custom"
base_url = "https://api.custom.com/v1"
wire_api = "responses"
requires_openai_auth = true
```

### 切换服务商

1. **切换到 openai**：

   ```toml
   model_provider = "openai"  # 修改这一行
   ```

2. **切换到 custom**：

   ```toml
   model_provider = "custom"  # 修改这一行
   ```

3. **更新 API 密钥**（auth.json）：

   ```json
   {
     "OPENAI_API_KEY": "新服务商的密钥"
   }
   ```

4. **重启 Codex** 使配置生效

---

## 常见问题

### 1. 配置文件不存在怎么办？

**解决方法**：手动创建配置目录和文件：

```bash
# macOS/Linux
mkdir -p ~/.codex
touch ~/.codex/config.toml
touch ~/.codex/auth.json

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path $env:USERPROFILE\.codex
New-Item -ItemType File -Force -Path $env:USERPROFILE\.codex\config.toml
New-Item -ItemType File -Force -Path $env:USERPROFILE\.codex\auth.json
```

然后按照上述步骤填写配置内容。

---

### 2. TOML 格式错误？

**常见错误**：

- 字符串未使用引号（`base_url = https://...` ❌）
- 配置块名称写错（`[model_provider.xxx]` ❌，应为 `[model_providers.xxx]`）
- 布尔值写错（`requires_openai_auth = "true"` ❌，应为 `true`）

**正确示例**：

```toml
model_provider = "serverA"  # ✅ 字符串需要引号
requires_openai_auth = true   # ✅ 布尔值不需要引号
```

**验证工具**：使用 [TOML Lint](https://www.toml-lint.com/) 检查格式。

---

### 3. 修改配置后不生效？

**可能原因**：

- Codex 进程未重启
- `model_provider` 名称与服务商配置块名称不匹配
- `auth.json` 中的密钥错误

**解决方法**：

1. 完全退出 Codex
2. 检查 `model_provider` 是否与 `[model_providers.xxx]` 中的名称一致
3. 检查 `auth.json` 中的密钥是否正确
4. 重新启动 Codex

---

### 4. 如何验证当前使用的服务商?

**方法 1**：检查配置文件

```bash
# macOS/Linux
cat ~/.codex/config.toml | grep model_provider

# Windows (PowerShell)
Get-Content $env:USERPROFILE\.codex\config.toml | Select-String "model_provider"

# Windows (CMD)
type %USERPROFILE%\.codex\config.toml | findstr model_provider
```

**方法 2**：使用 anyaitools 工具（如果已安装）

```bash
aat cx current
```

---

### 5. 配置文件权限问题

如果遇到权限错误，请确保配置文件的权限正确：

```bash
# macOS/Linux
chmod 600 ~/.codex/config.toml
chmod 600 ~/.codex/auth.json
```

**Windows 说明**：

- Windows 系统的文件权限管理方式与 macOS/Linux 不同
- 通常情况下，用户主目录下的文件默认只有当前用户可访问
- 如果需要修改权限，可以右键点击文件 → 属性 → 安全选项卡进行设置
- 一般情况下不需要额外配置权限

---

### 6. 切换服务商后需要修改 auth.json 吗？

**是的！** 不同服务商的 API 密钥通常是不同的。

切换服务商的完整步骤：

1. 修改 `config.toml` 中的 `model_provider`
2. 修改 `auth.json` 中的 `OPENAI_API_KEY`
3. 重启 Codex

如果使用 **anyaitools**，这个过程会自动完成。

---

## 为什么推荐使用 anyaitools？

手动配置虽然可行，但存在以下问题：

| 手动配置                     | 使用 anyaitools                 |
| ---------------------------- | ------------------------------- |
| ❌ 需要记住两个配置文件路径  | ✅ 一条命令搞定                 |
| ❌ 需要同时修改 TOML 和 JSON | ✅ 自动同步更新                 |
| ❌ 容易写错 TOML 格式        | ✅ 自动生成正确配置             |
| ❌ 切换服务商需要改两个文件  | ✅ `aat cx use <id>` 即可       |
| ❌ 无法管理多个服务商        | ✅ 统一管理所有服务商           |
| ❌ 容易破坏现有配置          | ✅ 常规切换增量合并并清理废弃键 |

---

## 使用 anyaitools 快速配置

如果你已经安装了 **anyaitools**，只需以下步骤：

### 1. 添加服务商

```bash
aat cx add
```

按提示输入服务商信息：

- 名称（如 `serverA`）
- Base URL（如 `https://codex-api.serverA.com/v1`）
- API Key（如 `sk-xxx`）

### 2. 切换服务商

```bash
aat cx use <服务商ID>
```

anyaitools 会自动：

- 解析并增量更新 `config.toml`，保留其他 provider 和合法自定义字段
- 自动删除 Codex 已废弃的旧键；配置无法解析时中止，不覆盖原文件
- 更新 `auth.json` 的 `OPENAI_API_KEY`，保留其他字段

如果通过代码或高级 API 传入 `provider.model`，writer 会把它作为根级 `model`
写入；普通 CLI/桌面表单目前没有暴露该字段。

Desktop 的 Codex 页面提供“保护 `model_provider`”开关，默认关闭。开启后，普通切换若发现 `config.toml` 已有非空的顶层 `model_provider`，会保留该名称，并用切换目标更新同名 `model_providers` 配置块；没有现有名称时仍使用目标服务商名称初始化。

该开关保存在 `~/.anyaitools/codex.json`，因此后续 CLI 和 Desktop 普通切换都会遵守。`aat okm`、aicoding、standalone 等快捷配置入口采用覆盖模式，不应用此开关；它们会先备份其管理的目标文件，再写入一套完整托管配置。

### 3. 查看当前服务商

```bash
aat cx current
```

就是这么简单！

---

## 总结

- **手动配置**：适合了解底层原理，或在特殊环境下使用
- **使用 anyaitools**：一行命令搞定，零出错，推荐日常使用

```bash
npm install -g @vebing-tools/anyaitools
```

更多信息请参考：[anyaitools 官方文档](https://github.com/2ue/anyaitools)
