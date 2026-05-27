# Contributing

## Setup

```bash
git clone https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair.git
cd ahmad-awais-deepseek-v4-toolrepair
npm test                       # 161+ tests, zero dependencies
node test/benchmark.js         # 12 real-world scenarios @ 100%
node scripts/shadow-bench.js   # 33-entry recorded corpus, writes bench-results.json
node scripts/shadow-bench-live.js --source path/to/file.jsonl  # external corpus replay (see below)
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
| `src/index.js` | CommonJS public entry — re-exports `repair`, `shapeFixes`, `autolinkFix`, `relationalFix` |
| `src/index.mjs` | ESM wrapper via `createRequire` (mirrors CJS surface, single source of truth) |
| `src/index.d.ts` | Hand-written TypeScript declarations (no build step) |
| `src/repair/repair-orchestrator.js` | validate-then-repair orchestrator |
| `src/repair/schemas.js` | Tool schema registry (19 tools, `!` = required, `path` = file-path with security checks) |
| `src/repair/shape-fixes.js` | 4 core shape fixes (strict ordering) |
| `src/repair/autolink-fix.js` | Markdown autolink detection (schema-scoped) |
| `src/repair/relational-fix.js` | offset/limit invariant handling |
| `scripts/shadow-bench.js` | Recorded-corpus benchmark harness (writes `bench-results.json`) |
| `scripts/shadow-bench-live.js` | External-corpus replay harness — accepts `--source <path>` pointing to a BFCL or ToolBench JSONL file; writes `bench-results-live.json` (gitignored) |
| `src/platforms/claude-code/` | Claude Code installer + PostToolUseFailure hook |
| `src/platforms/opencode/` | OpenCode installer + tool.execute.before plugin |
| `bin/cli.js` | CLI entry point (install/uninstall/verify) |

### Adding a new fix

1. Add fix function to `src/repair/shape-fixes.js`
2. Register in `applyFixesForPath()` with correct order position
3. Add test in `test/repair/shape-fixes.test.js`
4. Update schema in `src/repair/schemas.js` if a new tool/field is involved
5. Add a failing corpus entry to `scripts/shadow-bench.js` and confirm baseline rejects + repair accepts
6. Update README "Each fix: Problem → Principle → Test" with a copy-paste verification one-liner

### Adding a new tool schema

1. Add entry to `toolSchemas` in `src/repair/schemas.js` (use `!` for required, `path` for file paths)
2. Add regression tests in `test/repair/schemas-expansion.test.js` covering happy path + at least one rejection case
3. Add a representative failure pattern to the shadow-bench corpus
4. Bump version per semver policy (new tool = minor)

## PR Checklist

- [ ] Tests pass: `npm test` (current floor: 161)
- [ ] Benchmark passes: `node test/benchmark.js` (12/12)
- [ ] If you touched repair logic: re-run `node scripts/shadow-bench.js` and commit the updated `bench-results.json`
- [ ] If you touched `src/index.js` / `src/index.mjs` / `src/index.d.ts`: update all three; `test/integration/dual-export.test.js` must still pass
- [ ] New fixes include tests + a shadow-bench corpus entry
- [ ] Fix ordering preserves existing invariants
- [ ] Semver bump per `README.md` "Semver policy for heuristic changes"
- [ ] `CHANGELOG.md` updated under `## Unreleased`

## Good First Issues

See [ROADMAP.md](ROADMAP.md) for planned work. Issues tagged `good-first-issue` are beginner-friendly.
