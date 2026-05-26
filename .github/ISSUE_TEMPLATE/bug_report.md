---
name: Bug report
about: A repair fix produced the wrong result, crashed, or skipped a case it should handle
title: "[BUG] "
labels: bug
---

## What happened

<!-- One sentence: what did the repair layer do that you didn't expect? -->

## Reproduction

**Tool name:** `<e.g. read_file, execute_command>`

**Input the model produced:**

```json
{}
```

**What `validateAndRepair` returned:**

```json
{}
```

**What you expected:**

```json
{}
```

## Environment

- toolrepair version: `npm ls ahmad-awais-deepseek-v4-toolrepair` →
- Node version: `node --version` →
- Platform: Claude Code / OpenCode / other →
- Model: DeepSeek V4 / Qwen / GLM / other →

## Logs

<!-- Paste any stderr `tool_input_repaired` / `tool_input_invalid` telemetry lines. Redact secrets. -->

```
```

## Already checked

- [ ] Reproduction is minimal (no irrelevant fields).
- [ ] Issue is not already filed (searched open + closed).
- [ ] If this is a security issue, I filed it via SECURITY.md instead.
