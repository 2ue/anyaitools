# OKMCode 快捷配置脚本说明

本目录中与 OKMCode 相关的快捷脚本，当前统一遵循同一条规则：

- **快捷配置脚本 = 覆盖写入**
- **常规 provider 管理 = 增量写入**

也就是说：

- `aat okm`
- `scripts/setup-okmcode.mjs`
- `scripts/setup-okmcode-standalone.mjs`
- `@2ue/aicoding`

都属于“快捷配置入口”，目标是快速落下一套已知可用的配置，因此采用覆盖写入语义。

## 脚本列表

### `scripts/setup-okmcode.mjs`

- 依赖 `anyaitools` 的 core 能力
- 会创建/复用 anyaitools 中的 provider 数据
- 最终按快捷覆盖语义应用到 Claude / Codex / Gemini / OpenCode
- 覆盖前备份 anyaitools provider 数据和目标工具配置；失败时回滚

用法：

```bash
node scripts/setup-okmcode.mjs
node scripts/setup-okmcode.mjs sk-ant-xxx
```

### `scripts/setup-okmcode-standalone.mjs`

- 不依赖 anyaitools
- 直接写 Claude / Codex / Gemini / OpenCode 的目标配置文件
- 当前同样遵循快捷覆盖语义
- 如果目标文件已存在，会先创建同路径 `.bak` 备份

用法：

```bash
node scripts/setup-okmcode-standalone.mjs
node scripts/setup-okmcode-standalone.mjs sk-ant-xxx
node scripts/setup-okmcode-standalone.mjs --overwrite
```

`--overwrite` 仅用于兼容旧用法；当前脚本默认即为快捷覆盖模式。

## 如果你想要“尽量保留现有配置”

不要使用这些快捷脚本。请改用常规管理入口：

```bash
aat cx
aat cc
aat gm
aat oc
aat openclaw
```

或者对应的：

```bash
aat cx add/use/edit
aat cc add/use/edit
aat gm add/use/edit
aat oc add/use/edit
aat openclaw add/use/edit
```

这些入口默认按增量管理语义执行，会尽量保留非托管字段。
