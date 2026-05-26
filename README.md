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
[![codecov](https://codecov.io/gh/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/branch/main/graph/badge.svg)](https://codecov.io/gh/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair)
[![install size](https://packagephobia.com/badge?p=ahmad-awais-deepseek-v4-toolrepair)](https://packagephobia.com/result?p=ahmad-awais-deepseek-v4-toolrepair)

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

> "One repair layer. Open models now beat Opus 4.7 in our tool-calling evals."
> — [Ahmad Awais (@MrAhmadAwais)](https://x.com/MrAhmadAwais/status/2050956678502420612)

### Before / After (shadow benchmark)

Recorded-corpus benchmark over 33 real failure patterns from DeepSeek V4 / Qwen / GLM tool calls. Oracle = schema validation. Live-API replay is deferred to v1.1.0; methodology and raw counts are committed in [`bench-results.json`](bench-results.json).

| Pass | Accepted | Rate |
|---|---|---|
| Baseline (no repair) | 7 / 33 | **21.2%** |
| Repaired (this lib)  | 32 / 33 | **97.0%** |
| **Uplift** | +25 | **+75.8 pts** |

Reproduce: `node scripts/shadow-bench.js`. A `scripts/shadow-bench-live.js` harness also exists for replaying BFCL/ToolBench corpora when contributors provide a source file (see CONTRIBUTING.md).

## How is this different from `json-repair` / `zod-validation-error` / `partial-json`?

| Library | Solves | This library |
|---|---|---|
| [`json-repair`](https://www.npmjs.com/package/json-repair) / [`jsonrepair`](https://www.npmjs.com/package/jsonrepair) | Fixes malformed JSON syntax (missing quotes, trailing commas) | We assume JSON parses; we fix **post-parse semantic shape errors** (null in optional fields, JSON-string-in-array-slot, bare string where array expected) |
| [`zod-validation-error`](https://www.npmjs.com/package/zod-validation-error) | Pretty-prints Zod errors for humans | We **repair** the input so the call succeeds, then return a model-readable retry message if repair fails |
| [`partial-json`](https://www.npmjs.com/package/partial-json) | Parses streaming/truncated JSON | We act on complete tool-call payloads, not partial streams |
| [`ajv`](https://www.npmjs.com/package/ajv) / [`zod`](https://www.npmjs.com/package/zod) | General-purpose schema validation | We're tool-call-specific: schema-aware autolink scoping, relational invariants (offset/limit), validate-then-repair (no false positives) |

Use this when your model emits structurally valid JSON but the **shape doesn't match the tool's schema** — a class of errors generic JSON repair libraries pass through unchanged.

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
2. Outputting `'["a","b"]'` as a JSON string instead of an actual array (in array-typed fields)
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
| 2 | `parse-json-array` | `{ args: '["ls"]' }` → `{ args: ["ls"] }` (array-typed fields only) |
| 3 | `wrap-single-object` | `{ input: {} }` → `{ input: [{}] }` |
| 4 | `wrap-bare-string` | `{ input: "foo" }` → `{ input: ["foo"] }` |

Plus: autolink detection (scoped to `path`-typed fields), relational invariant fixing (offset/limit), security guards (rejects path traversal, control chars, HTML).

## Each fix: Problem → Principle → Test

Every repair documents (a) the model behavior that triggers it, (b) the invariant that justifies fixing it, and (c) a one-liner you can paste into a Node REPL to verify the fix triggers on your version.

### 1. `remove-nulls`
- **Problem:** DeepSeek V4 / Qwen / GLM emit `null` for optional fields the schema treats as absent (e.g. `read_file({offset: null, limit: null})`).
- **Principle:** `null` is never a valid value for an optional scalar in our schemas; absence is. Stripping is lossless.
- **Verify:** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('read_file',{file_path:'/x',offset:null}).fixes)"` → fix entry with `type:'remove-nulls'`.

### 2. `parse-json-array`
- **Problem:** Models stringify array arguments: `execute_command({args:'["ls","-la"]'})`.
- **Principle:** When the schema says `array` and the input is a string whose `JSON.parse` yields an array, parse it. Only on array-typed fields, only on parse success.
- **Verify:** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('execute_command',{command:'ls',args:'[\"-la\"]'}).fixes)"` → `parse-json-array`.

### 3. `wrap-single-object` / 4. `wrap-bare-string`
- **Problem:** Models pass a scalar or single object where the schema expects an array.
- **Principle:** A 1-element array is the conservative coercion; runs strictly after `parse-json-array` to avoid double-wrapping a parseable string.
- **Verify:** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('execute_command',{command:'ls',args:'-la'}).fixes)"` → `wrap-bare-string`.

### 5. `autolink-fix`
- **Problem:** Models render paths as Markdown autolinks: `file_path: '[notes.md](http://notes.md)'`.
- **Principle:** Only applied to fields the schema tags as `path`. Rejects `..`, control chars, `<>` to prevent traversal/HTML injection.
- **Verify:** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('read_file',{file_path:'[a.md](http://a.md)'}).input)"` → `{file_path:'a.md'}`.

### 6. `relational-fixes`
- **Problem:** `read_file({offset: 100})` without `limit` (or vice versa) — the platform requires both or neither.
- **Principle:** Enforce the documented co-occurrence invariant. Drop the lone field; emit a note.
- **Verify:** `node -e "const {repair}=require('.');console.log(repair.validateAndRepair('read_file',{file_path:'/x',offset:100}).fixes)"` → relational fix note.

## When repair fails

The library never throws on input shape — failures surface as `result.errors[]` with `result.repaired === false`. If you see unexpected rejection:

1. **Log the raw input** before calling `validateAndRepair`. Most "false rejections" are an unfamiliar shape we don't have a fix for yet — please file a [Bug report](.github/ISSUE_TEMPLATE/bug_report.md) with that payload.
2. **Inspect telemetry.** `logTelemetry` writes one JSON line per call to stderr: `{tool, repaired, passThrough, fixes:[...], errors:[...]}`. No field *values* are emitted — only metadata. Grep for `"repaired":false` to find rejections.
3. **Check the schema.** `getSchema(toolName)` returns `undefined` for unknown tools — those pass through unmodified. If you expected a fix, add the tool to `src/repair/schemas.js`.
4. **Reproduce in the bench.** Add the failing payload to `scripts/shadow-bench.js` corpus and re-run — if baseline rejects and repair still rejects, the gap is real.
5. **Common false-negative:** `parse-json-array` requires the string to `JSON.parse` cleanly into an array. `args: "[ls, -la]"` (unquoted) won't parse — that's a model-prompting fix, not a repair fix.

## Semver policy for heuristic changes

Repair behavior is part of the public contract. Versioning follows:

| Change | Bump |
|---|---|
| New fix added (new input now repaired) | **minor** |
| New tool schema added | **minor** |
| Existing fix produces a *different output* for the same input | **major** |
| Existing fix narrowed (input now rejected that previously repaired) | **major** |
| Pure refactor / docs / test changes | **patch** |
| TypeScript surface (`src/index.d.ts`) widened | **minor** |
| TypeScript surface narrowed/removed | **major** |

Rationale: consumers depend on the repaired *output*, not just on "did it pass." A silent change in repair output is a contract break even if no API changed.

## Quality

| Metric | Value |
|---|---|
| Tests | 127 / 127 ✅ |
| Benchmark scenarios | 12 / 12 — 100% success ✅ |
| Shadow bench (recorded corpus) | 32 / 33 — baseline 21.2% → repaired 97.0% ✅ |
| Line coverage | 100% ✅ |
| Function coverage | 100% ✅ |
| Runtime dependencies | 0 |
| Supported tools | 12 (`read_file`, `write_to_file`, `edit_file`, `search_content`, `execute_command`, `list_files`, `Read`, `Bash`, `Glob`, `Grep`, `TodoWrite`, `WebFetch`) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and [ROADMAP.md](ROADMAP.md) for planned work.

## Credits

- [Ahmad Awais](https://x.com/MrAhmadAwais) — original research and tool-input repair layer on [CommandCodeAI](https://commandcode.ai)
- DeepSeek V4 Pro — the model that now beats Opus 4.7 with the right repair layer

## License

[MIT](LICENSE)
