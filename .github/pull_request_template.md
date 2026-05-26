## Summary

<!-- One sentence: what does this PR change and why? -->

## Type

- [ ] Bug fix (existing repair behavior was wrong)
- [ ] New repair (new fix type, new tool schema, new platform)
- [ ] Docs / chore (no behavior change)
- [ ] Refactor (no behavior change, but code moves)
- [ ] Security fix (private patch landing — coordinate via SECURITY.md first)

## Linked issue

Closes #

## Repair contract changes

<!-- If you changed semver-bearing behavior, declare it here per README's heuristic semver policy. -->

- [ ] No behavior change.
- [ ] New repair added → minor version bump.
- [ ] Existing repair behavior changed (different output for the same input) → major version bump.
- [ ] Public TypeScript surface changed (`src/index.d.ts`).

## Verification

- [ ] `npm test` — all tests pass (current floor: 114).
- [ ] `node test/benchmark.js` — 12/12 @ 100% success.
- [ ] If you added a new fix or schema: added regression tests covering happy path + at least one rejection case.
- [ ] If you touched `src/index.js` / `src/index.mjs` / `src/index.d.ts`: updated all three and ran `test/integration/dual-export.test.js`.

## Risk

<!-- What's the worst that happens if this PR ships and is wrong? Who needs to roll it back? -->

## Reviewer checklist

- [ ] Repair functions stay O(n) — no exponential regex, no unbounded recursion.
- [ ] No new runtime dependencies (this is a zero-dep library).
- [ ] No telemetry value leaks (only metadata in `logTelemetry`).
- [ ] CHANGELOG.md updated under "Unreleased".
