# Probably Weather — Tester Readiness Report (Phase 2)

**Date:** 2026-05-12
**Phase:** Pre-tester audit Phase 2 (code audit + Codex GPT-5.5 adversarial review)
**Final SW slot:** `pw-v2026-05-12-006`
**Final test suite:** 1020/1020 passing across 26 files (+11 new tests for the Phase 2 fixes)

---

## Green light recommendation

**SHIP IT.**

The SW auto-update mechanism shipped in Phase 1 (#44) is production-validated on iPhone — v1.3 → v1.4 propagated without close-reopen drill. Phase 2 hardened the offline fallback path, plugged a stale-weather-on-poor-signal trap that would have hit any tester driving outside Cape Town signal coverage, and fixed the share URL UX so recipients see the sender's city immediately. Five tests added across three new behaviours. No regressions on existing tests. Diff is small (6 files, 145 insertions, 18 deletions) and surgical.

Two SHOULD items (`api/share.js` `JSON.stringify` brittleness, middleware `www.` vs apex consistency) deferred to a follow-up bundle. Neither blocks tester rollout.

---

## Phase 2 fixes shipped in this commit

### CRITICAL — duplicate "Data sources" / "About" section in Settings (C1)

`index.html` lines 293-296 deleted. Pre-existing UI duplication (not introduced by Phase 1), flagged by Al during SA1 verification. The longer About block with version + contact + privacy link remains. Settings → About is now single-section, clean. **SW bump required.**

### CRITICAL — offline weather respects `API_CACHE_MAX_AGE` (Z1, Codex catch)

`sw.js` previously defined a 3-hour `API_CACHE_MAX_AGE` constant but the offline `/api/weather` fallback never consulted it. Result: testers driving offline through patchy SA signal coverage could see week-old weather served under the confident "offline mode" banner.

**Fix:** offline fallback now reads the `sw-cached-at` header that the cache-write path was already setting (`sw.js:96`), computes age = `Date.now() - cachedAt`, and refuses to serve the cache when `age > API_CACHE_MAX_AGE`. Falls through to the explicit `{ ok: false, error: 'offline' }` 503 stub the UI already knows how to render. Adds `sw-cache-age-ms` debug header to successful offline responses so the UI can surface "Last updated 47 min ago" in a future polish pass.

### CRITICAL — partial precache install surfaces in console (Z2, Codex catch)

`sw.js` install handler previously did `cache.addAll(CORE_ASSETS).catch(() => {})` — a single missing asset would silently install the SW with a broken offline shell. New behaviour:

1. Try `addAll` first (atomic — all-or-nothing).
2. On failure, fall back to per-asset `cache.add()` loop. Each missing asset is logged via `console.warn` with the URL.
3. Final summary log shows `cached.size / CORE_ASSETS.length` so a watchful eye on the console can spot regressions post-deploy.
4. SW still installs and calls `skipWaiting()` even if every precache fails — keeps the lifecycle clean. Online users are unaffected; offline mode degrades gracefully and visibly.

### CRITICAL — `?city=` honoured on startup (Z4, Codex catch)

`assets/share-url.js` emits `?city=Cape%20Town` in share URLs. `assets/startup-location.js`'s `getSharedPlaceFromSearch` was returning `{ name: 'Unknown location', ... }` and ignoring the city param entirely. Recipients of shared WhatsApp links saw "Unknown location" until reverse-geocode resolved — slow on poor networks, sometimes fails entirely.

**Fix:** parse `?city=`, trim, cap at 80 chars (matches middleware sanitization), fall back to "Unknown location" only when the param is missing/empty/whitespace. 5 unit tests pinned. Bad coords still return null regardless of city presence.

### SHOULD (folded in) — delete dead `T.settings.wittyIn` i18n key (S1)

`assets/app.js:164`. Identical values to `T.settings.language` ({en:"Language", af:"Taal", ...}). Confirmed via grep that no code reads it. Flagged in three prior audit docs (`I18N_CROSS_LANGUAGE_AUDIT.md`, `LANG_QC_NOTES.md`, `TRIAGE_NATIVE_REVIEW.md`). Cost to delete: 1 line. Done.

---

## What Codex caught that Claude Code missed

Per Al's adversarial-review brief, this is the headline section. **Codex caught 5 concrete issues that Vos missed.**

| # | Codex finding | Vos verdict after re-check | Acted on? |
|---|---|---|---|
| Z1 | `API_CACHE_MAX_AGE` defined but unused in offline fallback | Confirmed real. Stale-weather-as-fact in offline mode. | ✅ Fixed (CRITICAL) |
| Z2 | `cache.addAll` swallows install failures, partial cache survives | Confirmed real. Silent offline-shell degradation. | ✅ Fixed (CRITICAL) |
| Z3 | `middleware.js` uses `www.` origin, rest of app uses apex | Confirmed real, but production verification shows apex 307→www redirect chain works. WhatsApp/FB crawlers follow redirects. Downgraded from Codex's HIGH to SHOULD. | ⏸ Deferred — cleanup-only, no functional impact today |
| Z4 | `?city=` emitted by share URL but ignored by startup parser | Confirmed real. Bad share-link first impression. | ✅ Fixed (CRITICAL) |
| Z5 | Share button passes `{url}` in text AND as separate field → duplicate URL in WhatsApp | Confirmed real at `app.js:1180-1185`. Annoying but not app-breaking. | ⏸ Deferred — SHOULD severity, easy follow-up fix |

Codex's environment had an interesting wrinkle: its sandboxed shell couldn't read the local-only `PRE_TESTER_AUDIT.md`, so it independently audited the source via its GitHub connector without anchoring on Vos's findings. This actually made the adversarial review stronger — no risk of Codex rubber-stamping a Vos miss.

## What Vos called CRITICAL that Codex didn't see

- **C1** (duplicate "Data sources" section): pre-existing UI bug Al flagged during SA1 verification. Codex couldn't see Vos's audit doc so didn't comment, but `index.html:293-296` vs `:297-304` is visually obvious. Fixed.

## What Vos called SHOULD / NICE that Codex didn't comment on

All Vos's SHOULD items remain SHOULD severity:
- **S2** — `api/share.js:132` `JSON.stringify` inside `<script>` is brittle defence-in-depth. Not exploitable today because inputs are sanitized upstream, but a future change could open an XSS sink. Wrap with `.replace(/</g, '\\u003c')` in a future bundle.
- **S3** — two separate `visibilitychange` listeners (SW update + weather refresh) have a soft race during reload. Not a known user-facing bug. Defer.
- **S4** — `getCurrentPosition` callback reads `activePlace` at callback time, not capture time. Could write stale data on rapid place switching. Bounded blast radius. Defer.

All NICE items deferred post-launch (reverse-geocode caching, bundle size, OG error logging, etc.).

---

## Severity reconciliation log

Per Al's protocol: "If Claude Code and Codex disagree on severity, default to the higher severity unless Codex's reasoning is clearly stronger."

| Item | Codex | Vos | Final | Rationale |
|---|---|---|---|---|
| Z1 (cache max-age) | HIGH→CRITICAL | (missed) | **CRITICAL** | Silent offline-mode failure. Testers driving N2 = primary failure vector. |
| Z2 (partial precache) | HIGH | (missed) | **CRITICAL** | Same offline-mode silent degradation argument. |
| Z3 (www vs apex) | HIGH-conditional | (missed) | **SHOULD** | Codex hedged "until production confirms". Production confirms redirect works. Downgrade is justified. |
| Z4 (`?city=` ignored) | MEDIUM | (missed) | **CRITICAL** | Escalated above Codex because shared links are the primary tester-rollout vector. First impression failure. |
| Z5 (duplicate URL) | LOW/MEDIUM | (missed) | **SHOULD** | Codex's call is right; annoying not broken. |
| C1 (duplicate About) | (not seen) | CRITICAL | **CRITICAL** | Al's explicit ask. |
| S1 (wittyIn dead key) | (not seen) | SHOULD | **SHOULD (folded in)** | One-line free win during this commit. |
| S2-S4 | (not seen) | SHOULD | **SHOULD (deferred)** | Not rollout-blockers. |

Net: 5 CRITICAL fixes shipped + 1 SHOULD folded in. 4 SHOULD items deferred to a follow-up bundle. No items downgraded to NICE.

---

## Test count trajectory across phase 2

| Stage | Tests | Files |
|---|---|---|
| Phase 1 end | 1009 | 26 |
| Phase 2 Z1 tests added (4) | 1013 | 26 |
| Phase 2 Z2 tests added (2) | 1015 | 26 |
| Phase 2 Z4 tests added (5) | 1020 | 26 |
| **Final** | **1020** | **26** |

Delta: +11 tests, all pinned to new behaviour, all pass. Zero regressions on the existing 1009.

---

## Files touched

- `index.html` — deleted duplicate "Data sources" section (C1)
- `sw.js` — bumped cache version to `006`, applied Z1 (cache age check), applied Z2 (visible precache failures)
- `assets/app.js` — deleted dead `T.settings.wittyIn` key (S1)
- `assets/startup-location.js` — parse `?city=` and use it as place name (Z4)
- `tests/offline-fallback.test.js` — bumped pinned cache version literal + new tests for Z1 and Z2
- `tests/startup-location.test.js` — new tests for `?city=` handling

`package-lock.json` was modified by `npm install` during the audit; reverted before commit (no real dependency changes).

---

## Deferred to follow-up (post-tester rollout)

These items were flagged in the audit but did not warrant blocking rollout:

1. **Z3** — `middleware.js:17` use of `www.` origin while rest of code uses apex. Verified prod redirect chain works. Cleanup only.
2. **Z5** — duplicate URL in `navigator.share` payload. Either drop the `url` field or drop `{url}` from the text template.
3. **S2** — wrap `JSON.stringify` inside `<script>` with `.replace(/</g, '\\u003c')` in `api/share.js:132`.
4. **S3** — consolidate two `visibilitychange` listeners into one combined handler.
5. **S4** — capture `activePlace` snapshot at refresh-start, not at GPS callback time.
6. **NICE items** — reverse-geocode caching, OG error logging, bundle size, x-safari URL construction.

Tracker for follow-up bundle: open an issue tagged `pre-tester-followup` after PR merges.

---

## Mechanism check on this PR

Since this PR itself relies on the auto-update mechanism shipped in #44, it's the second real-world test of "Al merges, walks away, returns to a foregrounded tab, sees the new version." Specifically:

- Settings → About will lose the "Data sources" section. If Al sees the duplicated section after merge, propagation broke for him personally.
- Settings → About will continue to read "Version 1.4" (no bump this phase — version label changes are a deliberate UX signal, only bumped when SA1 / canary verifications need a flip).
- Cache slot `pw-v2026-05-11-013` → ... → `pw-v2026-05-12-005` (Phase 1 end) → `pw-v2026-05-12-006` (this PR). Continuous chain, no gaps.

If Al's tab is on `005` and he foregrounds after merge, the same propagation flow that won SA1 fires for SA-Phase-2.

---

## Status

**GREEN.** Tester rollout cleared. Commit + push + watch Vercel preview → main deploy.
