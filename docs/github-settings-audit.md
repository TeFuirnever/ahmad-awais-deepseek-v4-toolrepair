# GitHub Repository Settings Audit — 2026-05-26

Snapshot of repo-level settings against the project's security & quality posture. Re-run via the commands in §6 if anything in this list drifts.

## 1. Branch protection (`main`) — ✅ correctly configured

| Setting | Value | Notes |
|---|---|---|
| Required PR review | ✅ 1 approver | + dismiss stale reviews on push |
| Required status check | ✅ `CI` | strict mode (must be up to date with base) |
| Force push | ❌ disabled | correct |
| Branch deletion | ❌ disabled | correct |
| Linear history | ❌ disabled | acceptable — squash + rebase both allowed |
| Enforce admins | ❌ disabled | by design — maintainer bypasses for emergency commits (see commit history `Bypassed rule violations` notes) |
| Required signed commits | ❌ disabled | low priority for a single-maintainer repo |
| Conversation resolution | ❌ disabled | low priority |

**Verdict:** branch protection is working. CI gate + 1-approver review is the right floor.

## 2. Repository surface — mostly ✅, two gaps

| Setting | Current | Target | Action |
|---|---|---|---|
| Visibility | public ✅ | public | none |
| License | MIT ✅ | MIT | none |
| Issues | enabled ✅ | enabled | none |
| Discussions | enabled ✅ | enabled | none |
| Wiki | enabled ✅ | **disabled** | low: turn off — README + ROADMAP cover docs, wiki is dead weight |
| Projects | enabled ✅ | enabled | none |
| Description | set ✅ | set | none |
| Homepage URL | empty ❌ | set | low: add `https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair` once published to npm, switch to npm URL |
| Repository topics | **none** ❌ | set | medium: add `deepseek`, `llm`, `tool-calling`, `claude-code`, `opencode`, `qwen`, `glm`, `repair`, `zero-dependency` |
| Delete branch on merge | ❌ disabled | enabled | low: enable to auto-clean merged PR branches |

## 3. Merge controls — ✅ acceptable

| Setting | Value |
|---|---|
| Squash merge | ✅ allowed |
| Rebase merge | ✅ allowed |
| Merge commit | ✅ allowed |
| Auto-merge | ❌ disabled |

**Verdict:** all three merge methods enabled is fine for a small project; consider locking to squash-only if commit history starts to drift.

## 4. Security — ⚠️ three items must be enabled

| Feature | Current | Target | Priority | Action |
|---|---|---|---|---|
| Secret scanning | ✅ enabled | enabled | — | none |
| Secret scanning push protection | ✅ enabled | enabled | — | none |
| Security policy (SECURITY.md) | ✅ present | present | — | none |
| **Private Vulnerability Reporting (PVR)** | ❌ **disabled** | enabled | **HIGH** | enable — SECURITY.md already references it (commit `1482658`); enabling the GitHub-side toggle makes the link in SECURITY.md actually work |
| **Dependabot security updates** | ❌ disabled | enabled | medium | enable — zero current deps, but enabling now protects against future dev-dep CVEs |
| **Vulnerability alerts** | ❌ disabled | enabled | medium | enable — pre-req for Dependabot security updates |
| Secret scanning validity checks | ❌ disabled | enabled | low | enable — verifies leaked tokens are still live |
| Secret scanning non-provider patterns | ❌ disabled | enabled | low | enable — catches custom-format secrets |

**Why PVR matters most:** SECURITY.md tells reporters to go to GitHub → Security tab → "Report a vulnerability". If the feature isn't enabled on the repo, that link 404s and reporters fall back to public disclosure on issues. This is the single most user-visible gap.

## 5. CI — ✅ green

| Workflow | Last status | Jobs |
|---|---|---|
| CI (`.github/workflows/ci.yml`) | ✅ success on `d73278f` | `test (18/20/22)`, `coverage`, `bundle-size` |

Codecov upload is `fail_ci_if_error: false` — intentional, prevents CI from failing on missing Codecov token. Acceptable until token is configured.

## 6. Re-run this audit

```bash
# Repo settings snapshot
gh api repos/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair --jq '{has_issues, has_discussions, has_wiki, has_projects, security_and_analysis, allow_squash_merge, allow_rebase_merge, allow_merge_commit, delete_branch_on_merge, allow_auto_merge}'

# Branch protection
gh api repos/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/branches/main/protection

# PVR status
gh api repos/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/private-vulnerability-reporting

# Vulnerability alerts (404 = disabled)
gh api repos/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/vulnerability-alerts

# Latest CI run
gh run list --limit 1 --json databaseId,conclusion,status
```

## 7. Recommended action order

1. **Enable PVR** (high — closes a user-visible doc claim)
2. **Enable Dependabot security updates + vulnerability alerts** (medium — defense in depth)
3. **Add repository topics** (medium — improves discoverability before npm publish)
4. **Set homepage URL + enable delete-branch-on-merge** (low — polish)
5. **Disable wiki, enable secret-scanning validity + non-provider patterns** (low — hygiene)

Steps 1–3 are commands the maintainer should run; see the next section for the `gh` invocations.

## 8. Commands to execute (copy-paste)

```bash
# 1. Enable Private Vulnerability Reporting
gh api -X PUT repos/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/private-vulnerability-reporting

# 2. Enable vulnerability alerts (pre-req)
gh api -X PUT repos/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/vulnerability-alerts

# 3. Enable Dependabot security updates
gh api -X PUT repos/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/automated-security-fixes

# 4. Add repository topics
gh api -X PUT repos/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/topics \
  -f 'names[]=deepseek' -f 'names[]=llm' -f 'names[]=tool-calling' \
  -f 'names[]=claude-code' -f 'names[]=opencode' -f 'names[]=qwen' \
  -f 'names[]=glm' -f 'names[]=repair' -f 'names[]=zero-dependency'

# 5. Polish: delete-branch-on-merge + disable wiki
gh api -X PATCH repos/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair \
  -F delete_branch_on_merge=true -F has_wiki=false

# 6. Re-run §6 to verify
```
