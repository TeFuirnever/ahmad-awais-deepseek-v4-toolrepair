# Changelog

## Unreleased

Post-v1.0.0 infrastructure pass. **Contains validator-tightening bug fixes** that narrow accepted-input surface — see Fixed section. Per semver policy this would normally trigger a major bump, but the prior behavior was a documented-as-impossible silent acceptance of invalid input (treated as a bug, not contract). Bump target: minor (1.1.0) with prominent CHANGELOG note.

### Fixed

- **Step 1d passThrough leak** — when the schema validator produced unfixable errors (missing required, type mismatch), `passThrough` stayed `true` and the malformed call would be silently accepted downstream. Now any unfixable schema violation flips `passThrough=false` and surfaces in `errors[]`. Discovered by the new negative-control corpus.
- **Unsafe-path acceptance** — `path`-typed string fields containing control chars (`\x00–\x1f`), HTML brackets (`< >`), parent-dir traversal (`..`), or stray markdown-link syntax (`[text](url)` after autolink-fix declined to rewrite) used to pass through. Now rejected at validation time with `received: 'unsafe-path'`.

### Added

- **TypeScript declarations** (`src/index.d.ts`) — hand-written types mirroring the CJS surface. No build step required.
- **ESM/CJS dual export** — `src/index.mjs` wrapper via `createRequire`; `exports` map in `package.json` with `import`/`require`/`types`/`default` conditionals. Unblocks Vite, Next 14+, Bun, Deno consumers.
- **Schema registry expansion 7 → 12 tools** — added `Bash`, `Glob`, `Grep`, `TodoWrite`, `WebFetch` (Claude Code top-5 by call frequency).
- **Shadow benchmark harness** (`scripts/shadow-bench.js`) — 33-entry recorded corpus tagged by model (DeepSeek V4 / Qwen / GLM / generic) and failure pattern. Spec-oracle methodology: schema-validation as the accept oracle, unrepaired baseline pass vs. full repair pass. Writes `bench-results.json` with timestamps, raw counts, per-pattern + per-model breakdowns.
- **`SECURITY.md`** — scoped threat model (malformed-JSON DoS, autolink bypass, path traversal, prompt-injection-via-retry, telemetry leakage) + 30-day disclosure timeline.
- **`.github/ISSUE_TEMPLATE/`** (bug + feature) + **`pull_request_template.md`** with semver checklist and reviewer gates.
- **README per-fix verification** — every repair documents Problem → Principle → Test with a copy-paste Node REPL one-liner.
- **README "When repair fails" debug guide** — 5-step recipe (logging, telemetry, schema check, bench reproduce, false-negative patterns).
- **README semver policy** — new fix = minor, changed output = major, surface widened = minor, narrowed/removed = major.
- **README prior-art section** — comparison vs. `json-repair`, `zod-validation-error`, `partial-json`, `ajv` / `zod`.
- **README hero quote** — Ahmad Awais quote, linked (no screenshot — ToS-safe).
- **Live measured Before / After** — recorded-corpus benchmark: baseline 21.2% → repaired 97.0% (+75.8 pts).

### Changed

- Quality gates: 109 → **127 tests**, supported tools 7 → **12**, README/zh-CN refreshed.

### Quality gates

- 127/127 tests pass (Node 18 / 20 / 22 CI matrix all green)
- 12/12 benchmark scenarios — 100% success rate
- 32/33 shadow-bench corpus accepted (97.0%) vs. 7/33 baseline (21.2%)
- 100% line + function coverage on the repair engine
- 0 runtime dependencies

### Deferred (with triggers)

- `npm publish --provenance` + Codecov / bundle-size badges — blocked on package-name trademark resolution.
- Live-API benchmark replay (DeepSeek / Qwen / GLM credits) — deferred to v1.1.0.

---

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
