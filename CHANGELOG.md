# Changelog

## v1.0.0 (2026-05-26, retagged)

Tag `v1.0.0` re-pointed to current `main` HEAD. This is the stable, production-ready release of the validate-then-repair tool-call recovery engine based on [Ahmad Awais's research](https://x.com/MrAhmadAwais/status/2050956678502420612).

### Cumulative scope (vs. original v1.0.0)

Includes everything from v1.1.0 below, plus:

#### Added

- **Required-field validation** — `!` suffix in schema marks required fields; missing required fields reported as `received: 'missing'` errors.
- **API contract guarantees** — `repaired=true` distinguishes full vs. partial repair via `errors.length`; `retryMessage` always populated when errors exist.
- **`path` type in schema** — file-path fields get autolink detection + (future) traversal checks distinct from generic strings.
- **CI benchmark + integration tests** — `node test/benchmark.js` runs 12 real-world scenarios at 100% success.

#### Changed

- **Architecture refactor** — `toolSchemas` extracted to `src/repair/schemas.js`; Step 1d shape-fix loop extracted to internal `runShapeFixLoop` helper. Zero behavior change, 100% backward-compatible `module.exports`.

#### Quality gates

- 109/109 tests pass
- 12/12 benchmark scenarios — 100% success rate
- 100% line + function coverage (V8 branch 97.73% — residual is sub-expression artifact)

#### Docs

- Inline notes for `applyFixesForPath` (global removeNulls side-effect) and `validateField` (top-level-only scope) assumptions.

---

## v1.1.0 (2025-05-25)

### Breaking Changes

- **Removed Step 1b blind JSON-array parse** — Previously ALL string fields were scanned for JSON arrays regardless of schema type, causing data corruption: `write_to_file.content` containing `'["hello","world"]'` was silently parsed to array, `execute_command.command` produced contradictory `repaired:true` + `errors` state. The `parseJsonArray` in `applyFixesForPath` (Step 1e) already handles array-typed fields correctly via schema validation.

### Fixed

- **Autolink fix scoped to `path`-typed fields only** — Previously applied to all string fields, corrupting content like `[readme.md](http://readme.md)` in `write_to_file.content`. Now uses schema to target only `path`-typed fields. Unknown tools fall back to walk-all.
- **Benchmark false positive** — scenario tested string-typed `command` field instead of array-typed `args`.

### Added

- `Read` alias in `toolSchemas` — schema validation works for both `read_file` and `Read`.
- `list_files` added to relational fixers — `offset` without `limit` defaults `limit: 2000`.
- Relational fix notes surfaced in `generateRetryMessage` — model sees what was inferred.
- Telemetry events split: `tool_input_repaired` vs `tool_input_invalid`.
- 10 regression tests: content integrity, notes surfacing, Read alias, list_files relational.

## v1.0.0 (2025-05-24)

### Initial Release

Cross-platform CLI tool that auto-installs a DeepSeek V4 tool-calling repair layer into Claude Code and OpenCode.

**What it does:** Intercepts tool calls from DeepSeek V4 (and similar open-source models) and repairs 6 known format errors before they crash your session.

**Repair engine:**
- `remove-nulls`: Strips null values from optional fields
- `parse-json-array`: Fixes JSON-encoded array strings
- `wrap-single-object`: Wraps single objects where arrays expected
- `wrap-bare-string`: Wraps bare strings where arrays expected
- `autolink`: Detects and repairs markdown autolinks in file paths
- `relational`: Auto-fills missing offset/limit pairs

**Platform support:**
- **OpenCode**: Active repair via `tool.execute.before` plugin (real input repair)
- **Claude Code**: Passive prevention via CLAUDE.md rules + PostToolUseFailure hook guidance

**Stats:**
- 45 tests, zero dependencies
- 2 platforms, 1 install command
- Based on Ahmad Awais's research on CommandCodeAI

[See full README](README.md)
