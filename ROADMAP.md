# Roadmap

## v1.0.0 (Released)

- [x] 4 core shape fixes (remove-nulls, parse-json-array, wrap-single-object, wrap-bare-string)
- [x] Autolink detection for markdown paths
- [x] Relational invariant fixing (offset/limit)
- [x] Dual-platform support (Claude Code + OpenCode)
- [x] CLI (install, uninstall, verify, --version)
- [x] 45 tests, zero dependencies
- [x] 8 badges in README
- [x] CI/CD (GitHub Actions, matrix Node 18/20/22)
- [x] Community files (CHANGELOG, CONTRIBUTING, ROADMAP, CLA)
- [x] 中文 README (README.zh-CN.md)
- [x] GitHub Discussions enabled
- [x] Benchmark harness (test/benchmark.js, 100% on 10 scenarios)
- [x] GitHub Release v1.0.0
- [x] Branch protection (CI required + PR review)

## v1.1.0 (Planned)

- [ ] npm publish (`npm adduser` then `npm publish`)
- [ ] Homebrew formula (`brew install`)
- [ ] `install.sh` + `install.ps1` for non-npx users
- [ ] Code coverage (c8 + Codecov badge)
- [ ] `--force` flag for reinstall/upgrade
- [ ] Node version runtime check

## Future

- [ ] Support for additional open-source models (GLM, Qwen, Llama)
- [ ] CLI verify --json for machine-readable output
- [ ] Cursor + Gemini CLI platform support
- [ ] WASM-based repair engine for in-browser use
- [ ] Real DeepSeek V4 benchmark (N=50+ tool calls)
- [ ] Discord community

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues tagged `good-first-issue` are beginner-friendly.
