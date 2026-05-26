# Security Policy

This is a zero-dependency, ~1.5k LoC repair layer for LLM tool calls. The threat surface is small but real — please report issues responsibly.

## Supported Versions

| Version | Supported |
|---|---|
| 1.x | ✅ |
| < 1.0 | ❌ |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security reports.**

Use GitHub's Private Vulnerability Reporting (PVR) to submit a confidential advisory:

**[Report a vulnerability](https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/security/advisories/new)**

1. Click the link above (you must be signed in to GitHub).
2. Fill in the advisory form — title, description, affected versions, and optional CVSS score.
3. Submit. The maintainer will receive a private notification and acknowledge within 72 hours.

Please include in the advisory description:
- A reproduction (model output payload, schema, expected vs. actual repair result).
- Affected versions.
- Whether the issue has been disclosed elsewhere.

## In-Scope Threats

These are real risks for a tool-call repair layer and are tracked:

| Threat | Status |
|---|---|
| **Malformed-JSON DoS** — pathological input (deeply nested, huge arrays, unicode bombs) causing the repair pipeline to hang, exhaust memory, or trigger catastrophic regex backtracking. | In scope. Repair functions must complete in O(n) over input size. |
| **Autolink bypass** — crafted `[text](http://text)` that evades the schema-scoping check and reaches a non-`path` field, or paths containing traversal (`..`) / control chars / HTML that slip past the validator in `src/repair/autolink-fix.js`. | In scope. The autolink fix is schema-gated and explicitly rejects `..`, `\x00-\x1f`, and `<>`. Report any bypass. |
| **Path traversal via repair output** — repair producing a path that escapes the intended workspace when consumed by a downstream tool. | In scope for the repair output contract; the consuming tool is responsible for its own boundary check. |
| **Prompt-injection-via-retry-message** — crafted error payloads that turn `generateRetryMessage` output into instructions the model interprets adversarially. | In scope. Retry messages must never echo unvalidated user content into model-facing strings. |
| **Telemetry leakage** — `logTelemetry` emitting field *values* (not just metadata) to stderr. | In scope. Telemetry contract is metadata-only; report any value leak. |

## Out of Scope

- Vulnerabilities in the consumer (Claude Code, OpenCode, your agent runtime) — report to those projects.
- Vulnerabilities in the LLM itself (DeepSeek, Qwen, GLM, Claude).
- Network-based attacks — this library makes no network calls.
- Supply-chain attacks against transitive dependencies — there are no runtime dependencies.

## Disclosure Timeline

- **Day 0**: Report received, acknowledgment within 72h.
- **Day 0–14**: Triage, reproduction, fix in a private branch.
- **Day 14–30**: Patch release, advisory published, credit to reporter (unless anonymity requested).
- **Day 30+**: Public disclosure after patched version reaches npm.

## Hall of Fame

Researchers who responsibly disclosed will be credited here (with permission).

## Maintainer Note: Enabling GitHub Private Vulnerability Reporting

PVR must be activated once per repository before the "Report a vulnerability" button becomes visible to external reporters. This is a one-time maintainer action:

1. Go to the repository on GitHub.
2. Open **Settings → Code security and analysis**.
3. Under **Private vulnerability reporting**, click **Enable**.

Reporters do not need to take any action — once PVR is enabled, the advisory submission link above works automatically for any signed-in GitHub user.
