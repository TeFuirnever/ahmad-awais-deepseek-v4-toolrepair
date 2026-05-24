# Changelog

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
