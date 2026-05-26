# Roadmap

## v1.0.0 (Released — 2026-05-26, retagged)

Validate-then-repair engine stable release. Tag re-pointed to current `main`.

### Repair engine

- [x] 4 core shape fixes (remove-nulls, parse-json-array, wrap-single-object, wrap-bare-string)
- [x] Autolink detection for markdown paths (schema-scoped to `path`-typed fields only)
- [x] Security guards (path traversal, control chars, HTML rejection)
- [x] Relational invariant fixing (offset/limit) — `read_file`, `Read`, `list_files`
- [x] Required-field validation via `!` schema suffix
- [x] `generateRetryMessage` for model feedback loop
- [x] Telemetry split: `tool_input_repaired` vs `tool_input_invalid`

### Architecture

- [x] Schema registry extracted to `src/repair/schemas.js`
- [x] `runShapeFixLoop` helper extracted in orchestrator
- [x] Zero-dependency runtime
- [x] 7 supported tools (`read_file`, `write_to_file`, `edit_file`, `search_content`, `execute_command`, `list_files`, `Read`)

### Quality gates

- [x] 109 / 109 tests pass
- [x] 12 / 12 benchmark scenarios — 100% success rate
- [x] 100% line + function coverage
- [x] V8 branch coverage 97.73% (residual = sub-expression artifact)

### Platform integration

- [x] Dual-platform support (Claude Code + OpenCode)
- [x] CLI (install, uninstall, verify, --version)
- [x] CI/CD (GitHub Actions, matrix Node 18/20/22)
- [x] 8 badges in README
- [x] Community files (CHANGELOG, CONTRIBUTING, ROADMAP, CLA)
- [x] 中文 README (README.zh-CN.md)
- [x] GitHub Discussions enabled
- [x] GitHub Release v1.0.0
- [x] Branch protection (CI required + PR review)

## v1.1.0 (In progress — infrastructure pass shipped, awaiting npm)

Schema and reach expansion — driven by real-traffic shadow validation.

### Shipped (post-v1.0.0 retag)

- [x] TypeScript declarations (`src/index.d.ts`) — hand-written, zero-build
- [x] ESM/CJS dual export (`exports` map + `src/index.mjs` via `createRequire`)
- [x] Expanded `toolSchemas` 7 → 12 (added `Bash`, `Glob`, `Grep`, `TodoWrite`, `WebFetch`)
- [x] Shadow benchmark harness (`scripts/shadow-bench.js`) with 33-entry recorded corpus, spec-oracle methodology, committed `bench-results.json` artifact (baseline 21.2% → repaired 97.0%, +75.8 pts)
- [x] `SECURITY.md` with scoped threat model + 30-day disclosure timeline
- [x] Issue + PR templates (`.github/ISSUE_TEMPLATE/`, `pull_request_template.md`) with semver checklist
- [x] README hero quote, prior-art positioning, Problem → Principle → Test per fix, "When repair fails" debug guide, semver policy
- [x] 127/127 tests pass; CI matrix (Node 18/20/22) all green

### Pending

- [ ] Real DeepSeek V4 / Qwen / GLM shadow validation (N=500+ live tool calls) — needs API budget
  - [x] External-corpus replay harness (`scripts/shadow-bench-live.js`) — can replay BFCL/ToolBench when contributors provide a source file
- [ ] Negative-control corpus in shadow bench (inputs that *should* be rejected)
- [x] Codecov badge for branch coverage
- [x] Bundle-size badge (size-limit or bundlephobia)
- [ ] `--force` flag for reinstall/upgrade
- [ ] Node version runtime check
- [ ] npm publish with `--provenance` — blocked on package-name trademark resolution
- [x] GitHub Private Vulnerability Reporting enabled (SECURITY.md references PVR; enabling the GitHub setting is a maintainer action)

## v2.0.0 (Future)

Triggered by v1.1.0 shadow data showing the string DSL is insufficient.

- [ ] Structured schema DSL (enum, range, nested objects, `array<string>`)
- [ ] Recursive `validateField` for nested schemas
- [ ] WASM-based repair engine for in-browser use
- [ ] Cursor + Gemini CLI platform support
- [ ] Homebrew formula (`brew install`)
- [ ] `install.sh` + `install.ps1` for non-npx users

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues tagged `good-first-issue` are beginner-friendly.
