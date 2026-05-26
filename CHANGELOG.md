# Changelog

## 1.0.2 — 2026-05-26

**BREAKING-FIX for OpenCode users.** v1.0.0 and v1.0.1 shipped an OpenCode plugin whose `tool.execute.before` hook used the wrong signature — it read `input.parameters` while the real OpenCode API passes args via `output.args`. Result: the repair layer never fired on OpenCode. All 109 prior tests passed because they exercised the `validateAndRepair` pure function, never the plugin-hook integration. Users on v1.0.0 / v1.0.1 should upgrade. Claude Code path (CLAUDE.md rules + PostToolUseFailure hook) was unaffected.

### Fixed (OpenCode plugin layer)

- **Hook signature** — `tool.execute.before` now reads `output.args` (correct per `@opencode-ai/plugin`), not `input.parameters` (always `undefined`). Plugin previously appeared to load successfully but mutated nothing.
- **Removed broken `tool.execute.after` failure-injection path** — the hook only fires on tool *success* in OpenCode and `output` carries no `error` field. The branch was dead code that pretended to inject retry guidance.
- **In-place arg mutation + reassign** — empirical testing showed OpenCode captures `output.args` by reference at hook-call time; pure reassignment didn't always propagate. Plugin now mutates the original object in place AND reassigns, so either capture pattern works.
- **CJS → ESM (`.mjs`)** — OpenCode loads `file://` plugins via dynamic `import()` and rejects CJS `module.exports = fn` with `Plugin export is not a function`. Plugin converted to `export default async function` with `createRequire` shim for the CJS `./repair/*` siblings.
- **Schema registry: 7 OpenCode tool names added** — `read`, `glob`, `grep`, `edit`, `write`, `todowrite`, `webfetch` (lowercase ids, **camelCase** params: `filePath` / `oldString` / `newString` / `replaceAll`). Previously the registry only knew the legacy `read_file` / `Read` / `Bash` names, so every real OpenCode tool call took the passthrough branch with no repair attempted. Schema count: 12 → 19.

### Added

- **`test/integration/opencode-plugin-hook.test.js`** — loads the real `.mjs` plugin via dynamic import, asserts `tool.execute.before` mutates `output.args` for `read` / `glob` / `todowrite`, asserts no-op on valid input and unknown tools. Would have caught all three of the bugs above. Test count: 147 → 157.

### Changed (installer)

- `install.js`: copies `tool-repair-plugin.mjs` (was `.js`); for **global** installs registers `file://` absolute path in `opencode.json`; for **project** installs relies on OpenCode's auto-discovery of `.opencode/plugin/*` and skips the config entry entirely.
- `uninstall.js`: removes both `.mjs` and legacy `.js`, strips both PLUGIN_NAME and `file://` specs from the config so upgraders from 1.0.0/1.0.1 get a clean state.
- `verify.js`: looks for `.mjs`, accepts either legacy PLUGIN_NAME or current `file://` spec, reports `plugin-registered: AUTO_DISCOVERY` for project-local installs.

### Verified live

End-to-end test against OpenCode 1.15.10 + DeepSeek V4 Pro:

```
{"event":"tool_input_repaired","tool":"read","repaired":true,"fixes":["remove-nulls"]}
{"event":"tool_input_repaired","tool":"todowrite","repaired":true,"fixes":["parse-json-array"]}
```

Both calls succeeded after repair where v1.0.0/v1.0.1 would have failed with `SchemaError`.

## 1.1.0 — 2026-05-26

Post-v1.0.2 infrastructure release. **Contains validator-tightening bug fixes** that narrow accepted-input surface — see Fixed section. Per semver policy this would normally trigger a major bump, but the prior behavior was a documented-as-impossible silent acceptance of invalid input (treated as a bug, not contract).

### Fixed

- **Step 1d passThrough leak** — when the schema validator produced unfixable errors (missing required, type mismatch), `passThrough` stayed `true` and the malformed call would be silently accepted downstream. Now any unfixable schema violation flips `passThrough=false` and surfaces in `errors[]`. Discovered by the new negative-control corpus.
- **Unsafe-path acceptance** — `path`-typed string fields containing control chars (`\x00–\x1f`), HTML brackets (`< >`), parent-dir traversal (`..`), or stray markdown-link syntax (`[text](url)` after autolink-fix declined to rewrite) used to pass through. Now rejected at validation time with `received: 'unsafe-path'`.

### Added

- **Local-install paths** — `install.sh` one-shot installer (`curl -fsSL .../install.sh | sh`), `toolrepair` short bin alias alongside the long official name, README/zh-CN restructured into 3 install paths (install.sh / `npx --package=github:...` / `git clone + npm link`). Removes npm publish as a v1.1 blocker.
- **TypeScript declarations** (`src/index.d.ts`) — hand-written types mirroring the CJS surface. No build step required.
- **ESM/CJS dual export** — `src/index.mjs` wrapper via `createRequire`; `exports` map in `package.json` with `import`/`require`/`types`/`default` conditionals. Unblocks Vite, Next 14+, Bun, Deno consumers.
- **Schema registry expansion 7 → 19 tools** — added PascalCase Claude Code tools (`Bash`, `Glob`, `Grep`, `TodoWrite`, `WebFetch`) and lowercase camelCase OpenCode tools (`read`, `glob`, `grep`, `edit`, `write`, `todowrite`, `webfetch`).
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

- Quality gates: 109 → **161 tests**, supported tools 7 → **19**, README/zh-CN refreshed.
- `toolrepair verify` — added `plugin-runtime` smoke check that loads the installed .mjs and confirms `tool.execute.before` actually mutates `output.args` (catches the v1.0.0/v1.0.1 dead-code regression class).

### Quality gates

- 161/161 tests pass (Node 18 / 20 / 22 CI matrix all green)
- 12/12 benchmark scenarios — 100% success rate
- 32/33 shadow-bench corpus accepted (97.0%) vs. 7/33 baseline (21.2%)
- 100% line + function coverage on the repair engine
- 0 runtime dependencies

### Deferred (with triggers)

- `npm publish --provenance` — deferred to v1.2 as a distribution upgrade (local-install paths cover all scenarios today). Package-name trademark resolution no longer time-critical.
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
