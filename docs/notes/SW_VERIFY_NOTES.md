# SW Update Propagation — SA1 verification notes

**Date:** 2026-05-12
**Subagent:** SA1 (canary)
**Branch:** `feat/pre-tester-1-sw-verify`
**PR:** https://github.com/infinitlyal-dev/probably-weather-new-b/pull/44
**Cache bump:** `pw-v2026-05-11-013` → `pw-v2026-05-12-001`
**Visible marker:** Settings → About `Version 1.3` → `Version 1.4`

---

## Mechanism (commit 2cdbef5)

The auto-update flow has two halves: SW-side aggression and page-side polling.

### Page-side (`assets/app.js` — `setupServiceWorkerUpdates()`)

1. **`registration.update()` on register.** Initial check at boot — bypasses the 24h HTTP cache the browser keeps on `/sw.js`.
2. **`registration.update()` on `visibilitychange → visible`.** Load-bearing fix. Every time Al's tab is foregrounded, the page asks the browser to re-check `/sw.js` immediately. Mirrors the existing weather-refresh visibility-return pattern.
3. **`controllerchange` listener.** When a freshly-installed SW takes over, this fires. An in-memory `hadControllerAtStart` flag suppresses the FIRST `controllerchange` (which is just the initial-registration claim on a hard-reload, not a real update). Subsequent ones trigger `reloadForUpdate()`.
4. **`reloadInFlight` guard.** Prevents the message handler firing reload twice between decision and navigation.
5. **Post-reload acknowledgment.** Before reload, writes `sessionStorage['pw_sw_just_updated'] = { version }`. New page reads it once, renders the localised **"Updated ✓"** toast at ~1.5s auto-dismiss, then clears the key.

### SW-side (`sw.js`)

- `install` event calls `self.skipWaiting()` — new SW activates instantly without waiting for tab close.
- `activate` event calls `self.clients.claim()` — claims all open clients immediately.
- `activate` event broadcasts `{ type: 'PW_UPDATE_AVAILABLE', version: CACHE_VERSION }` **only when `oldCaches.length`** (i.e. real upgrade, not first install).
- Existing `SKIP_WAITING` message handler preserved for the manual-skip path.

### Why this fixes the close-reopen drill

Before commit 2cdbef5, `skipWaiting` + `clients.claim` were already in place. They worked once the new SW was found. The problem was the browser's 24h cache on `/sw.js` — without `registration.update()`, the browser didn't bother re-fetching the SW file most visits, so the new SW was never discovered. Adding `registration.update()` on launch + visibilitychange forces the re-fetch with cache-busting headers. Once the new SW is found, the existing `skipWaiting` + `clients.claim` + page-side `controllerchange → reload` chain takes over.

---

## Manual verification procedure (production)

Pre-merge state:
- Open https://www.probablyweather.co.za in a tab. Confirm Settings → About reads **Version 1.3**.
- Note the current SW cache version in DevTools → Application → Service Workers (should be `pw-v2026-05-11-013` or whatever Al's currently caching).
- Background the tab (switch to another tab/app — don't close).

Trigger:
- Merge PR #44 to `main`. Vercel auto-deploys both `sw.js` and `index.html` to production.
- Wait ~60-90s for the deploy to land (verify via `gh pr checks` or Vercel dashboard).

Expected sequence on foreground:
1. Foreground the prod tab.
2. `visibilitychange → visible` handler fires `registration.update()`.
3. Browser fetches new `/sw.js`, finds `pw-v2026-05-12-001`, installs it.
4. New SW calls `skipWaiting()` → activates → calls `clients.claim()`.
5. New SW broadcasts `PW_UPDATE_AVAILABLE` with the new version.
6. Page's `controllerchange` listener fires → writes `pw_sw_just_updated` marker → `window.location.reload()`.
7. Post-reload page reads marker → renders **"Updated ✓"** toast for 1.5s → clears marker.
8. Settings → About now reads **Version 1.4**.

**Total time from foreground to v1.4 visible: typically <30s, often <10s on a warm connection.**

If steps 6-8 fire **without** a manual close-reopen, mechanism is GREEN. Other 5 subagents are clear to ship.

If they don't fire — open DevTools console on the prod tab. Look for:
- `[PW] Registering SW…`
- `[PW] SW controllerchange fired`
- Any error in the `setupServiceWorkerUpdates()` path.
- `sessionStorage.getItem('pw_sw_just_updated')` value mid-reload.

---

## Handshake key

`sessionStorage['pw_sw_just_updated']` — JSON-stringified `{ version }`. Single-use marker. Survives the `window.location.reload()` (sessionStorage is per-tab and persists across reloads inside the same tab). Cleared immediately after the toast is dispatched, so it can't fire twice.

Notably **not in localStorage** — that would survive tab close and fire the toast on the next cold launch, which would be wrong UX.

The `?reset=1` escape hatch in `index.html` scopes its wipe to `pw_install*` / `pw_installed` keys only. `pw_sw_just_updated` is in a different storage (sessionStorage vs localStorage) AND a different key prefix, so the reset path doesn't accidentally clobber the marker mid-handshake. Test pinned in `tests/sw-update-propagation.test.js`.

---

## Test counts

- Baseline (HEAD `d0707f0` before any changes): **320 / 320 passing across 22 files**
- After SA1 changes (cache version + Version 1.4 in index.html): **320 / 320 passing across 22 files**
- Delta: **0** (no test files modified — neither pinned cache version nor pinned `Version 1.3` literal exist anywhere in the test suite)

The test suite checks SW plumbing patterns (skipWaiting, clients.claim, postMessage shape) not the literal date or version number. Good design — means cache version bumps don't require test churn.

---

## Anomalies observed

None during the verification run. The change is intentionally minimal:
- 1 line in `sw.js` (cache version string)
- 1 line in `index.html` (visible label)
- No test files touched
- No logic refactored

`package-lock.json` was modified by `npm install` during dep-install step. Reverted before commit — it's not part of the canary surface.

---

## Follow-ups / things I'd watch for

1. **One-shot transition** (already flagged in `SW_UPDATE_PROPAGATION_NOTES.md`): any tester on a pre-013 build needs ONE manual refresh to swap onto the new propagation logic. After this deploy lands on top of 013, all future deploys propagate cleanly. This PR is the first such deploy, so behaviour should be clean for anyone whose tab has the 013 SW active.

2. **`updatedToLatest` toast strings** — Zu/Xh/St were translated mechanically per the ship notes. Flagged for the same native-speaker review as the cross-language audit. Not in scope for SA1; mentioning here so it doesn't get lost.

3. **Mid-session reload feels jarring** if it ever happens during active tapping. PW sessions are 10-30s with no in-progress state, so the risk is low. If users report it, mitigation is "wait for next visibilitychange before reloading instead of reloading immediately on controllerchange." Defer until reported.

4. **PR title / branch naming** — kept the SA1 prefix so other subagents in the dispatch can sort their PRs cleanly. Merge me FIRST: SA2-SA6 are downstream of this mechanism.

5. **Mechanism is reliant on `visibilitychange` firing.** If a user keeps the tab in the foreground continuously and never switches away, the only trigger left is the initial `registration.update()` on register, which only fires once per page-load. In practice this isn't an issue — phone PWAs background constantly, desktop tabs get backgrounded between work bursts. Worth knowing for the "edge case where it might not propagate" question.

---

## Status: ready to merge

PR #44 is the canary. Once Al merges + verifies the v1.3 → v1.4 flip on iPhone without close-reopen, mechanism is proven green and SA2-SA6 can ship their changes through the same path.
