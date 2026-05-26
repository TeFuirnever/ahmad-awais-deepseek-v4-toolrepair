---
name: Feature request
about: Add a new tool schema, a new repair fix, or a new platform integration
title: "[FEATURE] "
labels: enhancement
---

## What's the gap

<!-- One sentence: what tool call fails today that you want repaired? -->

## Concrete example

**Model:** <DeepSeek V4 / Qwen / GLM / other>

**Tool:** `<tool_name>`

**Input the model produces (today, broken):**

```json
{}
```

**Schema the platform expects:**

```json
{}
```

**Desired repair behavior:**

```json
{}
```

## Why this belongs in toolrepair (not the consumer)

<!-- Check one. If neither fits, this might be a feature for the platform/agent, not this library. -->

- [ ] The error is **shape-level**, predictable across models (e.g. always sending null where field is optional).
- [ ] The schema is **public** in a published tool spec (Claude Code, OpenCode, etc.).
- [ ] Multiple consumers would benefit (not a single-app fix).

## Out of scope flags

This library does NOT handle:
- New agent frameworks (multi-agent orchestration, team mode, LSP).
- Hosted services or commercial features.
- LLM-side prompting changes (that's `CLAUDE.md` / `AGENTS.md` rules territory).

## Implementation sketch (optional)

<!-- Schema entry to add to src/repair/schemas.js, new fixer to add, etc. -->
