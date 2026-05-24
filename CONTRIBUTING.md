# Contributing

## Setup

```bash
git clone https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair.git
cd ahmad-awais-deepseek-v4-toolrepair
npm test  # 45 tests, zero dependencies
```

## Architecture

```
Tool call → tryParse → valid? → pass through (untouched)
                    → invalid? → repair pipeline:
                                  1. remove-nulls
                                  2. parse-json-array
                                  3. wrap-single-object
                                  4. wrap-bare-string
                                  + autolink fix
                                  + relational fix
                                → re-validate → return
```

### Key files

| File | Purpose |
|------|---------|
| `src/repair/repair-orchestrator.js` | validate-then-repair orchestrator |
| `src/repair/shape-fixes.js` | 4 core shape fixes (strict ordering) |
| `src/repair/autolink-fix.js` | Markdown autolink detection |
| `src/repair/relational-fix.js` | offset/limit invariant handling |
| `src/platforms/claude-code/` | Claude Code installer + PostToolUseFailure hook |
| `src/platforms/opencode/` | OpenCode installer + tool.execute.before plugin |
| `bin/cli.js` | CLI entry point (install/uninstall/verify) |

### Adding a new fix

1. Add fix function to `src/repair/shape-fixes.js`
2. Register in `applyFixesForPath()` with correct order position
3. Add test in `test/repair/shape-fixes.test.js`
4. Update schema in `repair-orchestrator.js` if needed

## PR Checklist

- [ ] Tests pass: `npm test`
- [ ] New fixes include tests
- [ ] Fix ordering preserves existing invariants

## Good First Issues

See [ROADMAP.md](ROADMAP.md) for planned work. Issues tagged `good-first-issue` are beginner-friendly.
