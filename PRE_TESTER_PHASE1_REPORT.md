# Pre-tester Audit Phase 1 — Post-Merge Report

**Date:** 2026-05-12
**Final main HEAD at end of Phase 1:** `da0ea2d` (Vercel production deploy: success)
**Final cache slot:** `pw-v2026-05-12-005`
**Final test suite:** **1009 / 1009 passing across 26 test files**
**Baseline at start of phase:** 320 / 320 across 22 files
**Delta:** +689 tests, +4 test files (one per SA2, SA3, SA4, SA5)

## SA1 — SW propagation verifier (canary)

- **PR:** [#44](https://github.com/infinitlyal-dev/probably-weather-new-b/pull/44) merged
- **Branch:** `feat/pre-tester-1-sw-verify`
- **Cache slot:** `pw-v2026-05-11-013` → `pw-v2026-05-12-001`
- **Visible marker:** Settings → About `Version 1.3` → `Version 1.4`
- **Files changed:** `sw.js`, `index.html`, `SW_VERIFY_NOTES.md`
- **Production validation:** confirmed on Al's iPhone — version flipped automatically on tab foreground, no close-reopen required. Auto-update mechanism shipped in commit `2cdbef5` is **GREEN on production**.

## SA2 — Emoji + time-of-day fix

- **PR:** [#45](https://github.com/infinitlyal-dev/probably-weather-new-b/pull/45) merged
- **Cache slot:** `001` → `002`
- **Conflict resolved:** `sw.js` cache version (took SA2's slot 002)
- **Vercel preview:** `pass`
- **Files:** `assets/app.js`, `assets/weather-emoji.js` (new), `sw.js`, `tests/emoji-time-of-day.test.js` (new), `EMOJI_FIX_NOTES.md`
- **Root cause:** `assets/app.js:1257-1267` `getWeatherIcon` consulted `isNight` only for the `clear` fallback; every other branch returned a sun-containing glyph regardless of time of day. Same isDay-blind logic at L329 in `conditionEmoji`.
- **Fix approach:** new `assets/weather-emoji.js` with `{ day, night }` pair lookup per canonical condition key. Daytime cloud differentiation (`partly-cloudy` ⛅ vs `cloudy` ☁️) preserved; night collapses both to ☁️ because no clean "moon-behind-cloud" glyph exists across emoji fonts. Documented as a deliberate limitation.

## SA3 — Share + OG + Privacy

- **PR:** [#48](https://github.com/infinitlyal-dev/probably-weather-new-b/pull/48) merged
- **Cache slot:** `002` → `003`
- **Conflict resolved:** `sw.js` cache version (took SA3's slot 003)
- **Vercel preview:** `pass`
- **Files:** `assets/app.js`, `assets/share-url.js` (new), `middleware.js` (new Vercel edge middleware), 11 OG images in `og/`, `privacy.html`, `vercel.json`, `tests/share-bg-middleware.test.js` (new), `tools/build-og-images.mjs`, `SHARE_OG_NOTES.md`
- **Allowlist:** 11 slugs (clear, cloudy, cold, default, fog, heat, rain, rain-possible, storm, uv, wind). Slight scope-stretch from the briefed 9 — `hot` renamed to `heat`, plus `fog` and `default` added.
- **Middleware:** only intervenes on `GET /` when `?bg=` is present. Falls through cleanly otherwise — existing inline runtime og script in `index.html` keeps working for non-share traffic.
- **Branded share copy:** EN + AF author-confirmed. ZU/XH/ST drafted following existing `weather-copy.js` patterns and flagged in `SHARE_OG_NOTES.md` + handed off to SA5's `TRIAGE_NATIVE_REVIEW.md` for native review.
- **POPIA:** existing privacy policy extended with 4 new blocks (POPIA-at-a-glance, hosting & cross-border, user rights + Information Regulator contact, share-link disclosure). Date bumped to 12 May 2026.
- **Known uncertainty:** middleware unit-tested via mocked `fetch` but not yet exercised against a live Vercel preview from this worktree. **Action for Al:** eyeball share preview in Facebook Sharing Debugger / WhatsApp / Slack post-deploy.

## SA4 — Polish bundle (analytics + a11y + lighthouse + offline)

- **PR:** [#49](https://github.com/infinitlyal-dev/probably-weather-new-b/pull/49) merged
- **Cache slot:** `003` → `004`
- **Conflicts resolved:** `sw.js` cache version (slot 004) + `package-lock.json` (regenerated after taking SA4's package.json with `@vercel/analytics`)
- **Vercel preview:** `pass`
- **Files:** `assets/install.js`, `index.html`, `lighthouse-report.json`, `package.json`, `package-lock.json`, `sw.js`, `tests/offline-fallback.test.js` (new), `LIGHTHOUSE_FINDINGS.md`, `POLISH_BUNDLE_NOTES.md`
- **Analytics:** vanilla snippet in `index.html` head. `window.va` queue stub + deferred `/_vercel/insights/script.js` loader. `appinstalled` event wired to `assets/install.js:368`. **No dashboard touched.** Will start collecting only after Web Analytics is enabled on the Vercel project — script 404s silently meanwhile, queue stub buffers events.
- **A11y:** structural — bottom nav now `role="tablist"` with `role="tab"` + `aria-selected` per button. App was already at AA on most existing surfaces.
- **Lighthouse baseline:** Perf 95 / A11y 100 / Best-Practices 96 / SEO 100. Top fix applied: `preconnect`+`dns-prefetch` for `ipapi.co` (~320ms LCP saving). Render-blocking and image-weight (3.4 MB) flagged as deferred in `LIGHTHOUSE_FINDINGS.md`.
- **Sentry:** dropped to post-launch per brief.

## SA5 — Language QC + i18n cleanup

- **PR:** [#47](https://github.com/infinitlyal-dev/probably-weather-new-b/pull/47) merged
- **Cache slot:** `004` → `005`
- **Conflicts resolved:** `sw.js` cache version (slot 005) + one pinned literal in `tests/offline-fallback.test.js` (bumped from `004` to `005` to match the new slot; matcher pattern unchanged)
- **Vercel preview:** `pass`
- **Files:** 4 new QC skills in `.claude/skills/` (af-qc, zu-qc, xh-qc, st-qc), `sw.js`, `tests/i18n-no-cross-language-duplicates.test.js` (new), `LANG_QC_NOTES.md`, `TRIAGE_NATIVE_REVIEW.md`
- **High-confidence auto-fixes applied:** 0 / 0 / 0 / 0 (AF / ZU / XH / ST). Conservative-by-default rule held strictly.
- **Why zero:** 33 of 34 ZU flags are legitimate Nguni cognates with XH (`umoya`, `imvula`, `usuku`, `ikhaya`, `phezulu`) — correct, not bugs. The single canonical suspect (`days.sun.zu = "Son"` matches `af.sun = "Son"`) has a clear diagnosis (Afrikaans copy-paste; Zulu Sunday is iSonto) but the 3-letter abbreviation form is a UX call requiring native confirmation.
- **Borderline cases deferred to native review:** 34 ZU + 33 XH + 1 AF intra-language note + 1 ST intra-language note = **69 entries** in `TRIAGE_NATIVE_REVIEW.md` with current value, proposed action, native-speaker action.
- **Recommended review order:** ZU first (resolves `days.sun` + 33 cognates) → XH (mirror pass) → AF (intra-language merge confirmation) → ST (full naturalness pass since duplicate detection found nothing).

## SA6 — DESIGN.md + design audit

- **PR:** [#46](https://github.com/infinitlyal-dev/probably-weather-new-b/pull/46) merged
- **Cache slot:** no change (doesn't touch sw.js)
- **Conflicts resolved:** none — clean rebase
- **Vercel preview:** `pass`
- **Files:** `DESIGN.md` (new, 2,132 words), `DESIGN_AUDIT_FINDINGS.md` (new), `DESIGN_AUDIT_NOTES.md` (new), `assets/app.css` (2 surgical edits)
- **DESIGN.md:** frontend-design skill compatible, Stitch-inspired. Preamble states PW's distinctive voice takes precedence. Covers brand, explicit anti-slop guardrails (no Inter, no purple gradients, no three-card AI-dashboards, no chatbot UI, no "AI" in copy), typography scale, colour + weather-state tints, photographic background system (14-day rotation per condition × slot), spacing/radii/motion principles ("subtle, not show-off"), voice + 5-lang parity, and component patterns.
- **Drift identified:** 17 items in `DESIGN_AUDIT_FINDINGS.md` — **2 P0**, **8 P1**, **7 P2**.
- **Low-risk fixes applied:**
  1. Removed forced `border-radius: 4px` from the global `:focus-visible` rule. Pill buttons (999px) were flattening into 4px rectangles on focus. Outline + halo preserved; radius now follows the element.
  2. `.recent-item::before` bullet was hardcoded `color: #111` (invisible on translucent glass). Switched to `currentColor` at `opacity: 0.6` so it inherits the weather-state body colour.
- **Cross-lane handoffs:** P1-2/P1-3 contrast items deferred to SA4 (a11y). Settings panel opaque white surface + heat-state `.screen-title`/`.description` orange collision left as P0 follow-ups for post-Phase-1.

---

## Merge sequence + Vercel preview status

| Order | PR | Slot | Preview | Merge result |
|---|---|---|---|---|
| 1 | #44 SA1 | 001 | pass | merged + iPhone-verified |
| 2 | #45 SA2 | 002 | pass | merged |
| 3 | #48 SA3 | 003 | pass | merged |
| 4 | #49 SA4 | 004 | pass | merged |
| 5 | #47 SA5 | 005 | pass | merged |
| 6 | #46 SA6 | n/a | pass | merged |

Each preview was waited-for and verified green before the next merge. Final production deploy on `da0ea2d` reports `Vercel: success`.

## Conflict resolution log

All conflicts were on the `sw.js` cache version constant — exactly the contention surface predicted by the SW-slot strategy. Each was resolved by taking the downstream PR's slot value (next sequential `pw-v2026-05-12-NNN`) and dropping main's older value. One additional pinned-literal update in `tests/offline-fallback.test.js` when SA5 inherited SA4's new test (bumped the pinned `004` → `005`, matcher untouched). No test logic was loosened. No SW logic was refactored. No business code was touched during conflict resolution.

## Test count trajectory

| Stage | Tests | Files |
|---|---|---|
| Pre-phase baseline | 320 | 22 |
| After SA1 | 320 | 22 |
| After SA2 | 963 | 23 |
| After SA3 | 990 | 24 |
| After SA4 | 997 | 25 |
| After SA5 | 1009 | 26 |
| After SA6 (final main) | 1009 | 26 |

## Blockers encountered

None. Mechanism worked first time on production (SA1), downstream merges followed the SW-slot rebase protocol cleanly, and Vercel previews were green on every iteration.

## Follow-up flags (not addressed in this phase)

1. **Settings → About has two overlapping ABOUT sections** about the four weather sources. Pre-existing UI duplication (not introduced by this batch). Small fix candidate for a future polish pass. Flagged by Al during SA1 iPhone verification.

2. **`updatedToLatest` toast translations** (ZU/XH/ST) were translated mechanically and have not had native-speaker review. Flagged in `SW_UPDATE_PROPAGATION_NOTES.md` and `SW_VERIFY_NOTES.md` — carries forward to the SA5 TRIAGE queue.

3. **Mid-session reload jarring case** — theoretical, not reported. Mitigation in `SW_VERIFY_NOTES.md` if it ever surfaces.

4. **One-shot transition caveat** — testers on builds older than `pw-v2026-05-11-013` need one manual refresh to swap onto the new propagation logic. Any tester whose tab already had `013` or later will auto-propagate cleanly through this entire batch.

5. **Vercel Web Analytics** — script is wired but won't collect until Al toggles Web Analytics ON in the Vercel project dashboard.

6. **Share OG middleware** — needs eyeball verification in Facebook Sharing Debugger / WhatsApp / Slack against the live production URL.

7. **SA6 P0 findings** — Settings panel opaque white surface; heat-state `.screen-title` collides with `.description` orange. Both are pre-existing visual bugs surfaced by the design audit. Not tester-blockers.

8. **Native-speaker review of 69 i18n entries** in `TRIAGE_NATIVE_REVIEW.md`.

## Recovery / housekeeping notes from this session

- Original local clone at `probably-weather-new-b` was corrupted by Windows file locks during worktree cleanup attempts (the `.claude/worktrees/` parent dir got removed but git metadata remained). Left intact on disk; not touched. Fresh clone at `probably-weather-new-c` is the live working copy.
- Recovery artifacts (broken-repo diagnostics, both stash patches) preserved at `C:\Users\27741\OneDrive\Desktop\pw-recovery-2026-05-12\`.
- Six worktrees created at sibling paths (`pw-sa1-sw-verify` through `pw-sa6-design`) under `Probably weather new\`. Safe to remove post-Phase-1 once all branches are confirmed merged.
- Tool-side bug surfaced: Claude Code's `Agent` tool with `isolation: "worktree"` fails on Windows with EEXIST on parent-dir mkdir, both for pre-existing dirs and concurrent dispatches. Workaround used: pre-create worktrees manually via `git worktree add`, dispatch Agent without isolation parameter, pass absolute worktree path in each prompt.

## Status

Phase 1 complete. All six subagent PRs merged. Production deploy is live and SW-propagating. Ready for pre-tester rollout.
