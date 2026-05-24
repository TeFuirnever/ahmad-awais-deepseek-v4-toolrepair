# ahmad-awais-deepseek-v4-toolrepair

Auto-repair DeepSeek V4 tool-calling quirks in Claude Code CLI and OpenCode.

Based on [Ahmad Awais](https://x.com/MrAhmadAwais)'s research: a tool-input repair layer made DeepSeek V4 Pro beat Opus 4.7 6/10 times in internal evals.

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

### Four core shape fixes

| Order | Fix | Example |
|-------|-----|---------|
| 1 | `remove-nulls` | `{ offset: null }` → `{}` |
| 2 | `parse-json-array` | `{ cmd: '["ls"]' }` → `{ cmd: ["ls"] }` |
| 3 | `wrap-single-object` | `{ input: {} }` → `{ input: [{}] }` |
| 4 | `wrap-bare-string` | `{ input: "foo" }` → `{ input: ["foo"] }` |

Plus: autolink detection, relational invariant fixing (offset/limit).

## Credits

- [Ahmad Awais](https://x.com/MrAhmadAwais) — original research and tool-input repair layer on [CommandCodeAI](https://commandcode.ai)
- DeepSeek V4 Pro — the model that now beats Opus 4.7 with the right repair layer

## License

MIT
