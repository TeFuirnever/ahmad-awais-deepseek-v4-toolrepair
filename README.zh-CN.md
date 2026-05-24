# DeepSeek V4 靠一个修复层超越 Opus 4.7

30 秒安装。零依赖。

[![npm version](https://img.shields.io/npm/v/ahmad-awais-deepseek-v4-toolrepair)](https://www.npmjs.com/package/ahmad-awais-deepseek-v4-toolrepair)
[![npm downloads](https://img.shields.io/npm/dw/ahmad-awais-deepseek-v4-toolrepair)](https://www.npmjs.com/package/ahmad-awais-deepseek-v4-toolrepair)
[![CI](https://img.shields.io/github/actions/workflow/status/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/ci.yml)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/issues)

自动修复 DeepSeek V4 在 Claude Code CLI 和 OpenCode 中的工具调用格式错误。

基于 [Ahmad Awais](https://x.com/MrAhmadAwais) 的研究：一个工具输入修复层让 DeepSeek V4 Pro 在内部评估中以 **6/10 概率**超越 Opus 4.7。

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

```bash
# 自动检测平台
npx ahmad-awais-deepseek-v4-toolrepair install

# 指定平台
npx ahmad-awais-deepseek-v4-toolrepair install --platform opencode
npx ahmad-awais-deepseek-v4-toolrepair install --platform claude-code

# 仅规则
npx ahmad-awais-deepseek-v4-toolrepair install --rules-only

# 演习
npx ahmad-awais-deepseek-v4-toolrepair install --dry-run
```

> **LLM 优先：** 复制这段话给你的 AI agent："从 npm 安装 ahmad-awais-deepseek-v4-toolrepair，然后运行 `npx ahmad-awais-deepseek-v4-toolrepair install` 对我的平台执行安装。"

## 验证

```bash
npx ahmad-awais-deepseek-v4-toolrepair verify
```

## 卸载

```bash
npx ahmad-awais-deepseek-v4-toolrepair uninstall
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

附加：autolink 检测、关系不变量修复（offset/limit）。

## 参与贡献

详见 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [ROADMAP.md](ROADMAP.md)。

## 致谢

- [Ahmad Awais](https://x.com/MrAhmadAwais) — 原始研究和工具输入修复层，在 [CommandCodeAI](https://commandcode.ai) 上实现
- DeepSeek V4 Pro — 有了正确的修复层后，现在能击败 Opus 4.7 的模型

## 许可证

[MIT](LICENSE)
