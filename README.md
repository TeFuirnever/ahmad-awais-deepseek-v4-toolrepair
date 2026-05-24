# DeepSeek V4 beats Opus 4.7 with one repair layer

Install in 30 seconds. Zero dependencies.

[![npm version](https://img.shields.io/npm/v/ahmad-awais-deepseek-v4-toolrepair)](https://www.npmjs.com/package/ahmad-awais-deepseek-v4-toolrepair)
[![npm downloads](https://img.shields.io/npm/dw/ahmad-awais-deepseek-v4-toolrepair)](https://www.npmjs.com/package/ahmad-awais-deepseek-v4-toolrepair)
[![CI](https://img.shields.io/github/actions/workflow/status/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/ci.yml)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair)](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/issues)

### Quick Demo

```console
$ npx ahmad-awais-deepseek-v4-toolrepair install
toolrepair: installing for platforms: claude-code, opencode
toolrepair: global install

  claude-code: installed rules, hook
  opencode: installed rules, plugin

$ npx ahmad-awais-deepseek-v4-toolrepair verify

toolrepair: claude-code verification
  ✓ hook-registered: OK
  ✓ hook-script: OK (sha256: a1b2c3d4...)
  ✓ claude-md-rules: OK
toolrepair: opencode verification
  ✓ plugin-registered: OK
  ✓ plugin-script: OK
  ✓ rules: OK

toolrepair: all checks passed.
```

> **30 seconds to install. 6 repair types. Zero dependencies.**

[中文文档](README.zh-CN.md) | [English](README.md)

Auto-repair DeepSeek V4 tool-calling quirks in Claude Code CLI and OpenCode.

Based on [Ahmad Awais](https://x.com/MrAhmadAwais)'s research: a tool-input repair layer made DeepSeek V4 Pro beat Opus 4.7 **6/10 times** in internal evals.

## The Fix in One Glance

### Before (DeepSeek V4 raw output → crashes)

```
❌ ZodError: Expected string, received null at "offset"
❌ ZodError: Expected array, received string at "cmd"
❌ FileNotFound: [notes.md](http://notes.md)
❌ Error: offset without limit
```

### After (repair layer applied → succeeds)

```
✓ null stripped from optional fields
✓ JSON string parsed to actual array
✓ Markdown autolink extracted to plain path
✓ Missing relational field defaulted
```

### Benchmark

| Fix Type | Without Repair | With Repair |
|----------|---------------|-------------|
| `remove-nulls` | ❌ ZodError crash | ✅ Passes through |
| `parse-json-array` | ❌ Type mismatch | ✅ Correct array |
| `wrap-single-object` | ❌ Schema reject | ✅ Wrapped `[{}]` |
| `wrap-bare-string` | ❌ Schema reject | ✅ Wrapped `["val"]` |
| `autolink` | ❌ Creates wrong file | ✅ Plain path |
| `relational` | ❌ offset/limit error | ✅ Auto-defaulted |

> Based on [Ahmad Awais's research](https://x.com/MrAhmadAwais): 4 fixes + autolink detection + relational defaults. The model itself doesn't change — the contract becomes more forgiving where needed. DeepSeek V4 Pro now beats Opus 4.7 6/10 times in internal evals.

## The Problem

Open-source models (DeepSeek, GLM, Qwen) make predictable tool-calling format errors:

1. Sending `null` instead of omitting optional fields
2. Outputting `'["a","b"]'` as a JSON string instead of an actual array
3. Wrapping single params in `{}` when schema expects an array
4. Passing bare strings instead of arrays (`"foo"` not `["foo"]`)
5. Formatting file paths as markdown autolinks: `[notes.md](http://notes.md)`
6. Missing relational invariants (offset without limit, etc.)

These are contract-level issues, not model capability issues.

## The Fix

Two-layer defense:

| Layer | Claude Code | OpenCode |
|-------|-------------|----------|
| **Active repair** | ❌ (hook protocol limitation) | ✅ `tool.execute.before` plugin |
| **Passive prevention** | ✅ CLAUDE.md rules | ✅ AGENTS.md rules |
| **Failure guidance** | ✅ PostToolUseFailure hook | ✅ `tool.execute.after` plugin |

**OpenCode gets real input repair** — the plugin intercepts tool calls before execution and applies the validate-then-repair strategy.

**Claude Code gets best-effort** — passive instructions + failure detection with retry guidance.

## Install

```bash
# Auto-detect platform
npx ahmad-awais-deepseek-v4-toolrepair install

# Specific platform
npx ahmad-awais-deepseek-v4-toolrepair install --platform opencode
npx ahmad-awais-deepseek-v4-toolrepair install --platform claude-code

# Rules only
npx ahmad-awais-deepseek-v4-toolrepair install --rules-only

# Dry run
npx ahmad-awais-deepseek-v4-toolrepair install --dry-run
```

> **LLM-first:** Copy this prompt to your AI agent: _"Install ahmad-awais-deepseek-v4-toolrepair from npm and run `npx ahmad-awais-deepseek-v4-toolrepair install` for my platform."_

## Verify

```bash
npx ahmad-awais-deepseek-v4-toolrepair verify
```

## Uninstall

```bash
npx ahmad-awais-deepseek-v4-toolrepair uninstall
```

## How It Works

### validate-then-repair strategy

1. Try parsing input → if valid, pass through untouched
2. If validation fails → iterate through validator issues
3. Try 4 fixes in order (order matters!)
4. Re-validate → success = log repair, failure = return model-readable error

### Architecture

```
Tool call arrives
       │
       ▼
  tryParse(input)
       │
  ┌────┴────┐
  │ valid?   │
  └────┬────┘
       │
  ┌────┴────────────────────┐
  │ YES → pass through      │  NO → repair pipeline
  │       (untouched)       │        │
  └─────────────────────────┘   ┌────┴──────────┐
                                │ 1. remove-nulls│
                                │ 2. parse-json  │
                                │ 3. wrap-object │
                                │ 4. wrap-string │
                                │ + autolink fix │
                                │ + relational   │
                                └────┬───────────┘
                                     │
                                re-validate
                                     │
                              ┌──────┴──────┐
                              │ success?     │
                              └──┬────────┬──┘
                        repaired │        │ original returned
                        input     │        │ + error message
                        returned  │
```

### Four core shape fixes

| Order | Fix | Example |
|-------|-----|---------|
| 1 | `remove-nulls` | `{ offset: null }` → `{}` |
| 2 | `parse-json-array` | `{ cmd: '["ls"]' }` → `{ cmd: ["ls"] }` |
| 3 | `wrap-single-object` | `{ input: {} }` → `{ input: [{}] }` |
| 4 | `wrap-bare-string` | `{ input: "foo" }` → `{ input: ["foo"] }` |

Plus: autolink detection, relational invariant fixing (offset/limit).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and [ROADMAP.md](ROADMAP.md) for planned work.

## Credits

- [Ahmad Awais](https://x.com/MrAhmadAwais) — original research and tool-input repair layer on [CommandCodeAI](https://commandcode.ai)
- DeepSeek V4 Pro — the model that now beats Opus 4.7 with the right repair layer

## License

[MIT](LICENSE)
