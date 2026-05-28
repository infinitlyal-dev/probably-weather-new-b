# Promote Adversarial Review Log — 2026-05-24

Companion to: `docs/promote-plan-2026-05-24.md`, `docs/promote-report-2026-05-24.md`.

Reviewer: codex-rescue (GPT-5-class) via `codex:codex-rescue` subagent.

---

## Round 0 — failed dispatch

First codex dispatch attempted filesystem access via PowerShell + Node REPL — both failed in the Windows sandbox with `CreateProcessAsUserW failed: 1312` / `spawn setup refresh`. Codex correctly refused to invent findings without ground-truth. Verdict: DO NOT SHIP (couldn't review).

Operator response: re-dispatched with all file contents EMBEDDED inline in the prompt so the sandbox failure was bypassed.

---

## Round 1 — 24 findings against embedded files

Codex returned a structured list of CRITICAL / MAJOR / MINOR findings. Verdict: DO NOT SHIP.

### Findings applied (8)

| # | Sev | Issue | Fix |
|---|-----|-------|-----|
| 4 | CRITICAL | Phase 7 manual `git add` is unverified, can stage forbidden untracked dirs | Script now does scoped `git add -- <explicit paths>` itself |
| 5 | CRITICAL | `.agents/`, `eval/`, `NATIVE_REVIEW_*` etc. could be accidentally staged | Preflight ALLOWED_UNTRACKED_PATTERNS allowlist halts on any unexpected untracked path |
| 6 | CRITICAL | Unpushed commit stack not validated | Preflight asserts exactly 6 commits, prints SHAs |
| 9 | MAJOR | `.gitattributes` only has `text=auto`; binary assets could be CRLF-corrupted | Added `*.webp binary`, `*.jpg binary`, etc. |
| 13 | MAJOR | `set -euo pipefail` + grep with no matches can exit script silently | Defensive `\|\| true` on every grep pipeline |
| 15/16/17 | MAJOR | OneDrive sync race — placeholder files could be cp'd as zero-byte stubs | `-s` (non-empty) checks pre-AND-post copy, primary OneDrive guard |
| 19 | MAJOR | Picker fallback chain hides broken promotion | 144-file spot-check (one per cond × week × time) instead of 5 |
| 22 | MINOR | `wc -l` on Git Bash emits padded whitespace; could mis-compare | `num()` helper strips whitespace before integer compare |

### Findings rejected with reasoning (8)

| # | Sev | Claim | Why rejected |
|---|-----|-------|--------------|
| 1 | CRITICAL | Picker-script path contract not proven | Picker constants (`KNOWN_FOLDERS` = exactly our 9 folders, `safeWeek` clamps 1..4, `safeR` clamps 1..7, `safeTime` clamps to {dawn,day,dusk,night}) are static. Script writes literally the same names. Match proven by inspection. Operator did add 144 spot-checks anyway for runtime confirmation. |
| 11 | MAJOR | `find ... -name "*.webp"` globs unquoted | Re-read: every glob IS quoted `"*.webp"`. Hallucinated. |
| 12 | MAJOR | `$STAGING` / `$DEST_BASE` etc. unquoted | Re-read: every path variable IS double-quoted. Hallucinated. |
| 14 | MAJOR | `REMOVED_TOTAL=$((expr))` could exit non-zero if expr == 0 | False — only the bare `(( expr ))` compound command form exits 1 on zero. The `x=$((expr))` assignment form always succeeds. |
| 18 | MAJOR | OG generation order — runs against stale paths | Already enforced: Phase 5 runs after Phase 4 invariants. |
| 8 | MAJOR | 181 MB push without LFS will fail GitHub limits | GitHub per-file limit is 100 MB; individual WebPs are <500 KB; per-commit/push transfer is unlimited in practice. Push time is the only concern, accepted. |
| 2/3/20/21 | CRITICAL/MAJOR | Two-phase deploy: additive then destructive | Al's brief mandates single-deploy. A two-phase split would mean phase 1 ships images with OLD picker (can't read them) and phase 2 swaps picker code — same user-visible transition window in reverse. Net risk equivalent, coordination cost doubled. Single deploy accepted. |

### Findings deferred to operator (not script changes)

| # | Sev | Item | Handling |
|---|-----|------|----------|
| 7 | CRITICAL | Vercel deploy verification | Plan §9 — operator runs post-push |
| 10 | MAJOR | Live MIME smoke-test | Plan §9 step 2 — `curl -I` post-deploy |
| 23 | MINOR | Vitest reporter format brittle to upgrades | Accepted tech debt |
| 24 | MINOR | `wind/day_6.jpg` exception masks broader JPG drift | Pre-existing condition documented in §0 |

---

## Round 2 — verdict SHIP

Round 2 dispatch verified all 8 round-1 fixes landed in the revised script. Findings:

- **No new CRITICAL or MAJOR release blockers.**
- One MINOR non-blocker: codex noted HEAD_SHA / ORIGIN_SHA "captured but not printed."

### Round 2 minor — false positive

The actual script lines 147-150 are:

```bash
HEAD_SHA=$(git rev-parse HEAD)
ORIGIN_SHA=$(git rev-parse origin/main)
log "  HEAD:        $HEAD_SHA"
log "  origin/main: $ORIGIN_SHA"
```

Codex reviewed the ABBREVIATED paste in the round-2 prompt (operator trimmed the log lines for brevity). The actual script in the repo DOES print both SHAs. False positive against abbreviated source — no action needed.

### Final verdict: **SHIP**
