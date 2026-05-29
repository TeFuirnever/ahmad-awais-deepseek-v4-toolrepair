# DeepSeek V4 靠一个修复层超越 Opus 4.7

30 秒安装。零依赖。

[![npm version](https://img.shields.io/npm/v/ahmad-awais-deepseek-v4-toolrepair)](https://www.npmjs.com/package/ahmad-awais-deepseek-v4-toolrepair)
[![npm downloads](https://img.shields.io/npm/dw/ahmad-awais-deepseek-v4-toolrepair)](https://www.npmjs.com/package/ahmad-awais-deepseek-v4-toolrepair)
[![CI](https://img.shields.io/github/actions/workflow/status/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/ci.yml)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/actions)
[![Bundle size](https://img.shields.io/badge/size-674_B_gzip-brightgreen)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/blob/main/.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/issues)
[![codecov](https://codecov.io/gh/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/branch/main/graph/badge.svg)](https://codecov.io/gh/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair)
[![install size](https://packagephobia.com/badge?p=ahmad-awais-deepseek-v4-toolrepair)](https://packagephobia.com/result?p=ahmad-awais-deepseek-v4-toolrepair)

自动修复 DeepSeek V4 在 Claude Code CLI 和 OpenCode 中的工具调用格式错误。

基于 [Ahmad Awais](https://x.com/MrAhmadAwais) 的研究：一个工具输入修复层让 DeepSeek V4 Pro 在内部评估中以 **6/10 概率**超越 Opus 4.7。

> "一个修复层。开源模型在我们的工具调用评估中现在能击败 Opus 4.7。"
> — [Ahmad Awais (@MrAhmadAwais)](https://x.com/MrAhmadAwais/status/2050956678502420612)
<img width="1244" height="1088" alt="image" src="https://github.com/user-attachments/assets/7e494e58-75de-49d6-92fc-7e67a9a431d4" />

<details>
<summary>X/Twitter 链接打不开？（需翻墙）点击展开完整引用与上下文</summary>

**出处：** Ahmad Awais (@MrAhmadAwais) 在 X 上的公开推文，发布于 DeepSeek V4 Pro 发布前后。

**英文原文（逐字）：**

> "One repair layer. Open models now beat Opus 4.7 in our tool-calling evals."

**中文翻译：**

> "一个修复层。开源模型在我们的工具调用评估中现在能击败 Opus 4.7。"

**上下文（综合自该推文及关联讨论的转述，非逐字引用）：**
- 评估环境：[CommandCodeAI](https://commandcode.ai) 的内部工具调用基准
- 对比模型：DeepSeek V4 Pro vs Claude Opus 4.7
- 公开比分：DeepSeek V4 Pro 6/10 取胜
- 唯一变量：在模型输出上叠加一个薄薄的输入修复层（即本库复现的方法）
- 原推链接：`https://x.com/MrAhmadAwais/status/2050956678502420612`

</details>

### Before / After（影子基准）

基于 33 条来自 DeepSeek V4 / Qwen / GLM 真实失败模式的录制语料。Oracle = schema 验证。真实 API 回放推迟至 v1.1.0；方法学与原始计数提交在 [`bench-results.json`](bench-results.json)。

| 流程 | 接受 | 通过率 |
|---|---|---|
| 基线（不修复） | 7 / 33 | **21.2%** |
| 修复（本库） | 33 / 33 | **100%** |
| **提升** | +26 | **+78.8 个百分点** |

复现：`node scripts/shadow-bench.js`。另有 `scripts/shadow-bench-live.js` 可在贡献者提供源文件时回放 BFCL/ToolBench 语料（详见 CONTRIBUTING.md）。

## 与 `json-repair` / `zod-validation-error` / `partial-json` 有何不同？

| 库 | 解决什么 | 本库 |
|---|---|---|
| [`json-repair`](https://www.npmjs.com/package/json-repair) / [`jsonrepair`](https://www.npmjs.com/package/jsonrepair) | 修复 JSON 语法错误（缺引号、尾逗号） | 我们假设 JSON 可解析；修复**解析后的语义形状错误**（可选字段 null、JSON 字符串在 array 位、bare string 在 array 位） |
| [`zod-validation-error`](https://www.npmjs.com/package/zod-validation-error) | 美化 Zod 错误给人看 | 我们**修复**输入让调用成功，修复失败时返回模型可读的重试消息 |
| [`partial-json`](https://www.npmjs.com/package/partial-json) | 解析流式/截断 JSON | 我们处理完整工具调用负载，不处理流 |
| [`ajv`](https://www.npmjs.com/package/ajv) / [`zod`](https://www.npmjs.com/package/zod) | 通用 schema 验证 | 我们针对工具调用：schema 感知的 autolink 范围限定、关系不变量（offset/limit）、先验证后修复（无误报） |

当你的模型输出结构合法的 JSON 但**形状不匹配工具 schema** 时使用本库——这类错误通用 JSON 修复库会原样放行。

## 一键见效

### 修复前（DeepSeek V4 原始输出 → 崩溃）

```
❌ ZodError: Expected string, received null at "offset"
❌ ZodError: Expected array, received string at "cmd"
❌ FileNotFound: [notes.md](http://notes.md)
❌ Error: offset without limit
```

### 修复后（修复层介入 → 成功）

```
✓ null 从可选字段中剥离
✓ JSON 字符串解析为实际数组
✓ Markdown 自动链接提取为纯路径
✓ 缺失的关系字段自动补全
```

### Benchmark

| 修复类型 | 无修复 | 有修复 |
|----------|--------|--------|
| `remove-nulls` | ❌ ZodError 崩溃 | ✅ 通过 |
| `parse-json-array` | ❌ 类型不匹配 | ✅ 正确数组 |
| `wrap-single-object` | ❌ Schema 拒绝 | ✅ 包装为数组 |
| `wrap-bare-string` | ❌ Schema 拒绝 | ✅ 包装为数组 |
| `autolink` | ❌ 创建错误文件 | ✅ 纯路径 |
| `relational` | ❌ offset/limit 错误 | ✅ 自动默认值 |

> 基于 [Ahmad Awais 的研究](https://x.com/MrAhmadAwais)：4 个修复 + 自动链接检测 + 关系默认值。模型本身不变——合约在需要的地方变得更宽容。DeepSeek V4 Pro 现在在内部评估中以 6/10 概率超越 Opus 4.7。

## 问题

开源模型（DeepSeek、GLM、Qwen）产生可预测的工具调用格式错误：

1. 发送 `null` 而不是省略可选字段
2. 输出 `'["a","b"]'` 作为 JSON 字符串，而非实际数组
3. 将单个参数包装在 `{}` 中，而 schema 预期的是数组
4. 传递裸字符串而非数组（`"foo"` 而非 `["foo"]`）
5. 将文件路径格式化为 markdown 自动链接：`[notes.md](http://notes.md)`
6. 缺失关系不变量（有 offset 无 limit 等）

这些是合约层面的问题，不是模型能力问题。

## 修复策略

双层防御：

| 层 | Claude Code | OpenCode |
|----|-------------|----------|
| **主动修复** | ❌ (hook 协议限制) | ✅ `tool.execute.before` 插件 |
| **被动预防** | ✅ CLAUDE.md 规则 | ✅ AGENTS.md 规则 |
| **失败引导** | ✅ PostToolUseFailure hook | ✅ `tool.execute.after` 插件 |

## 安装

> **尚未发布到 npm —— 直接从 GitHub 本地安装。** 下面三条路径都不依赖 `npm publish`，选最适合你的环境。

### 方式一：一键脚本（推荐）

**macOS / Linux：**

```bash
curl -fsSL https://raw.githubusercontent.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/main/install.sh | sh
```

**Windows（PowerShell）：**

```powershell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/main/install.ps1 | iex"
```

会克隆到 `~/.toolrepair`，创建 `toolrepair` 命令，并对自动检测到的平台运行 `toolrepair install`。卸载：`rm -rf ~/.toolrepair ~/.local/bin/toolrepair`（macOS/Linux）或 `Remove-Item -Recurse -Force ~/.toolrepair, ~/.local/bin/toolrepair.cmd`（Windows）。

### 方式二：`npx` 直接拉 GitHub 仓库

```bash
# 自动检测平台
npx --package=github:TeFuirnever/ahmad-awais-deepseek-v4-toolrepair toolrepair install

# 指定平台
npx --package=github:TeFuirnever/ahmad-awais-deepseek-v4-toolrepair toolrepair install --platform opencode
npx --package=github:TeFuirnever/ahmad-awais-deepseek-v4-toolrepair toolrepair install --platform claude-code

# 仅规则 / 演习
npx --package=github:TeFuirnever/ahmad-awais-deepseek-v4-toolrepair toolrepair install --rules-only
npx --package=github:TeFuirnever/ahmad-awais-deepseek-v4-toolrepair toolrepair install --dry-run
```

不污染全局；`npx` 会在多次调用之间缓存。

### 方式三：`git clone` + `npm link`（贡献者）

```bash
git clone https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair.git
cd ahmad-awais-deepseek-v4-toolrepair
npm link
toolrepair install
```

### 单平台 / 部分安装

通过上面三种方式装好 CLI 后，可以单独指定平台或只装某一层：

```bash
toolrepair install --platform claude-code   # 只装 Claude Code
toolrepair install --platform opencode      # 只装 OpenCode
toolrepair install --rules-only             # 只装 CLAUDE.md / AGENTS.md 规则
toolrepair install --plugin-only            # 只装 hook / plugin（不装规则）
toolrepair install --force                  # 强制重装（先卸载再安装）
```

`install.sh` 默认自动检测双平台。一开始就要单装，请用方式二（`npx --package=github:... toolrepair install --platform <p>`）。

> **LLM 优先：** 复制这段话给你的 AI agent："从 GitHub 安装 ahmad-awais-deepseek-v4-toolrepair。" macOS/Linux 执行 `curl -fsSL https://raw.githubusercontent.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/main/install.sh | sh`，Windows 执行 `powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/main/install.ps1 | iex"`。

## 验证

```bash
toolrepair verify
```

## 卸载

```bash
toolrepair uninstall                              # 用 install.sh / npm link 安装的
rm -rf ~/.toolrepair ~/.local/bin/toolrepair      # macOS/Linux
```

```powershell
# Windows（PowerShell）
Remove-Item -Recurse -Force "$env:USERPROFILE\.toolrepair", "$env:USERPROFILE\.local\bin\toolrepair.cmd"
```

## 原理

### validate-then-repair（先验证后修复）策略

1. 尝试解析输入 → 有效则直接放行，不做修改
2. 验证失败 → 遍历验证器的问题列表
3. 按顺序尝试 4 种修复（顺序很关键！）
4. 再次验证 → 成功则返回修复后的输入，失败则返回模型可读的错误信息

### 四种核心 shape 修复

| 顺序 | 修复 | 示例 |
|------|------|------|
| 1 | `remove-nulls` | `{ offset: null }` → `{}` |
| 2 | `parse-json-array` | `{ args: '["ls"]' }` → `{ args: ["ls"] }`（仅 array 类型字段） |
| 3 | `wrap-single-object` | `{ input: {} }` → `{ input: [{}] }` |
| 4 | `wrap-bare-string` | `{ input: "foo" }` → `{ input: ["foo"] }` |

附加：autolink 检测（仅作用于 `path` 类型字段）、关系不变量修复（offset/limit）、安全护栏（拒绝路径穿越、控制字符、HTML）。

## 每个修复：问题 → 原则 → 测试

每个修复都记录 (a) 触发它的模型行为，(b) 证明修复合理的不变量，(c) 可粘到 Node REPL 验证修复生效的一行命令。

### 1. `remove-nulls`
- **问题：** DeepSeek V4 / Qwen / GLM 对 schema 视为缺省的可选字段发出 `null`（如 `read_file({offset: null, limit: null})`）。
- **原则：** 可选标量字段中 `null` 永不合法；缺省才合法。剥离无损。
- **验证：** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('read_file',{file_path:'/x',offset:null}).fixes)"` → 含 `type:'remove-nulls'` 的条目。

### 2. `parse-json-array`
- **问题：** 模型将数组参数字符串化：`execute_command({args:'["ls","-la"]'})`。
- **原则：** 当 schema 声明 `array` 且输入是 `JSON.parse` 后能得到数组的字符串时，解析它。仅在 array 类型字段，仅在解析成功时。
- **验证：** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('execute_command',{command:'ls',args:'[\"-la\"]'}).fixes)"` → `parse-json-array`。

### 3. `wrap-single-object` / 4. `wrap-bare-string`
- **问题：** 模型在 schema 期望数组的位置传入标量或单个对象。
- **原则：** 包成 1 元素数组是保守强转；严格运行在 `parse-json-array` 之后，避免对可解析字符串重复包装。
- **验证：** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('execute_command',{command:'ls',args:'-la'}).fixes)"` → `wrap-bare-string`。

### 5. `autolink-fix`
- **问题：** 模型把路径渲染成 Markdown autolink：`file_path: '[notes.md](http://notes.md)'`。
- **原则：** 仅对 schema 标记为 `path` 的字段生效。拒绝 `..`、控制字符、`<>` 以防穿越/HTML 注入。
- **验证：** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('read_file',{file_path:'[a.md](http://a.md)'}).input)"` → `{file_path:'a.md'}`。

### 6. `relational-fixes`
- **问题：** `read_file({offset: 100})` 缺 `limit`（或反之）—— 平台要求两者皆有或皆无。
- **原则：** 强制共现不变量。丢弃孤立字段，发出 note。
- **验证：** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('read_file',{file_path:'/x',offset:100}).fixes)"` → 关系修复 note。

## 修复失败时

本库对输入形状从不抛异常 —— 失败以 `result.errors[]` 和 `result.repaired === false` 暴露。若遇到非预期拒绝：

1. **打印原始输入** 在调用 `validateAndRepair` 之前。多数"误拒"是我们尚未覆盖的新形状 —— 请用该 payload 提交 [Bug report](.github/ISSUE_TEMPLATE/bug_report.md)。
2. **检视 telemetry。** `logTelemetry` 每次调用向 stderr 写一行 JSON：`{tool, repaired, passThrough, fixes:[...], errors:[...]}`。不包含字段*值*，仅元数据。`grep "\"repaired\":false"` 找出被拒条目。
3. **检查 schema。** `getSchema(toolName)` 对未知工具返回 `undefined`，那些会原样透传。若期望修复，请把工具加入 `src/repair/schemas.js`。
4. **在 bench 中复现。** 把失败 payload 加入 `scripts/shadow-bench.js` 语料并重跑 —— 若 baseline 拒绝且 repair 仍拒绝，则确为 gap。
5. **常见假阴：** `parse-json-array` 要求字符串能干净 `JSON.parse` 为数组。`args: "[ls, -la]"`（未引号）不会被解析 —— 属于模型 prompt 修复，不属于本库修复范畴。

## 启发式变更的 semver 政策

修复行为属于公开契约。版本号遵循：

| 变更 | bump |
|---|---|
| 新增修复（新输入现在被修复） | **minor** |
| 新增工具 schema | **minor** |
| 既有修复对同一输入产生*不同输出* | **major** |
| 既有修复收窄（之前能修，现在被拒） | **major** |
| 纯重构 / 文档 / 测试改动 | **patch** |
| TypeScript 表面（`src/index.d.ts`）扩大 | **minor** |
| TypeScript 表面收窄/移除 | **major** |

理由：消费者依赖修复后的*输出*，而非仅"是否通过"。修复输出的静默变化即便没有 API 变更也是契约破裂。

## 质量

| 指标 | 数值 |
|---|---|
| 测试 | 161 / 161 ✅ |
| Benchmark 场景 | 12 / 12 — 100% 成功率 ✅ |
| 影子基准（录制语料） | 33 / 33 — 基线 21.2% → 修复 100% ✅ |
| 行覆盖率 | 100% ✅ |
| 函数覆盖率 | 100% ✅ |
| 运行时依赖 | 0 |
| 支持工具 | 19（`read_file`、`write_to_file`、`edit_file`、`search_content`、`execute_command`、`list_files`、`Read`、`Bash`、`Glob`、`Grep`、`TodoWrite`、`WebFetch`、`read`、`glob`、`grep`、`edit`、`write`、`todowrite`、`webfetch`） |

## 参与贡献

详见 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [ROADMAP.md](ROADMAP.md)。

## 致谢

- [Ahmad Awais](https://x.com/MrAhmadAwais) — 原始研究和工具输入修复层，在 [CommandCodeAI](https://commandcode.ai) 上实现
- DeepSeek V4 Pro — 有了正确的修复层后，现在能击败 Opus 4.7 的模型

## 许可证

[MIT](LICENSE)
