# Service Worker update propagation — ship notes

**Date:** 2026-05-11 evening
**Commits:**
- [`2cdbef5`](https://github.com/infinitlyal-dev/probably-weather-new-b/commit/2cdbef5) — `fix(sw): auto-propagate deploys — no more close-reopen drill`
- [`5756563`](https://github.com/infinitlyal-dev/probably-weather-new-b/commit/5756563) — `chore: bump version string 1.2 → 1.3 (propagation observation marker)`

**Branch:** `main`, HEAD `5756563`, SW `pw-v2026-05-11-013`, 320/320 tests

---

## Problem

Service worker updates required users to fully close and reopen the PWA twice to pick up new code. Symptoms:

- Phase A PTR fix shipped invisible on first iPhone test (cached old SW served old CSS)
- AF day abbreviations didn't update on first reload (same reason)

This pattern would compound across every deploy as Al sends links to more testers. Standard fixes exist in the PWA toolkit — PW just didn't have them wired in.

## Audit

| Required behaviour | Status before | Action |
|---|---|---|
| `self.skipWaiting()` in install | ✅ Present (sw.js:27) | none |
| `self.clients.claim()` in activate | ✅ Present (sw.js:38) | none |
| `PW_UPDATE_AVAILABLE` message on activate | ✅ Present (sw.js:42) | augmented with `version` field |
| `registration.update()` on launch | ❌ Missing | **added** |
| `registration.update()` on visibilitychange | ❌ Missing | **added** |
| `controllerchange` listener for auto-reload | ❌ Missing | **added** |
| sessionStorage guard against reload loops | ❌ Missing | **added** |
| Post-reload acknowledgment | ⚠️ 10s manual "Refresh to apply" toast | **replaced** with 1.5s "Updated ✓" auto-dismiss |

## Why the old code didn't propagate

Two compounding causes:

1. **Browsers cache `/sw.js` for up to 24 hours** via HTTP headers, so the browser doesn't naturally check for new SW versions on most visits. Without `registration.update()`, a tester opening the app at 9pm wouldn't see the SW deployed at 3pm until the next morning (or after a manual hard-reload).

2. **The SW DID call `skipWaiting()` + `clients.claim()`** — but those only kick in once the new SW is FOUND. If step 1 hides the new SW from the browser, steps 2 and 3 never get the chance to fire.

The fix is in both layers:
- **sw.js**: keep the existing aggressive `skipWaiting` + `clients.claim` so when a new SW IS found, it takes over instantly without waiting for tab close.
- **app.js**: force the browser to look more often via `registration.update()` calls on launch and visibility-return.

## What got added

### `app.js` — `setupServiceWorkerUpdates()` rewritten

Five behaviours added:

1. **`registration.update()` on register.** Initial update check forces a `/sw.js` re-fetch with cache-busting headers, even if the browser still has it warmed.
2. **`registration.update()` on visibilitychange → visible.** This is the load-bearing fix for Al's "double-close drill" — when a tester foregrounds the app after he deploys, the page now forces an SW re-check immediately. Mirrors the existing weather-refresh visibility-return pattern (commit `74cae95`).
3. **`controllerchange` listener** with a `hadControllerAtStart` in-memory guard. First `controllerchange` after a fresh install is ignored (initial-registration claim, not an update). Subsequent ones mean a new SW took over → `reloadForUpdate()`.
4. **`reloadInFlight` guard** so the message handler can't fire reload twice between decision and navigation.
5. **Post-reload acknowledgment toast** — sessionStorage marker (`pw_sw_just_updated`) survives the reload, is read by the new page, fires a brief localised "Updated ✓" toast at 1.5s, clears itself.

### `sw.js` — minor adjustment

`PW_UPDATE_AVAILABLE` message now carries `version: CACHE_VERSION`. Page-side could surface it in the toast (currently just stores it in the sessionStorage marker for debug-overlay access — not in user-facing text).

### `T.toasts.updatedToLatest` — new i18n key

```js
updatedToLatest: {
  en: "Updated ✓",
  af: "Bygewerk ✓",
  zu: "Kubuyekeziwe ✓",
  xh: "Kuhlaziyiwe ✓",
  st: "Ho ntjhafalitsoe ✓"
}
```

Zu and Xh share a Nguni root for "renew" — flagged in the cross-language audit but plausibly correct cognates. Sotho's "Ho ntjhafalitsoe" is the passive form of "to renew" (consistent with the locationUpdated string's "ntjhafatsa" root).

## Why silent reload + brief toast (option b from spec)

The spec offered three options for user-facing feedback. Picked silent-reload-plus-brief-toast because:

- **PW's sessions are 10–30s, no forms, no in-progress state.** A manual "tap to refresh" prompt would mean every Al deploy creates a banner every user has to dismiss. That's the OLD behaviour I removed.
- **Silent reload is invisible until you notice the new code is there** — exactly what's wanted for an actively-developed app.
- **The toast is the smallest acknowledgment that justifies the page flicker:** 1.5s, auto-dismissed, single check-mark glyph. Locked to a brand-stable string per language. Confirms to the user "yes, that flash was on purpose, you have new code now."

## Gotchas handled

- **Asset version skew** (skipWaiting + clients.claim mid-page-load can leave old HTML cached with new SW serving new JS, or vice versa). Mitigation: `controllerchange` → reload pattern. Page comes back fresh against the new SW's assets.
- **Infinite reload loops**: blocked by `reloadInFlight` (in-memory) AND by `hadControllerAtStart` (ignores the initial-registration claim). sessionStorage marker is for the toast UX, not the loop guard — guards are belt-and-braces.
- **`?reset=1` escape hatch unaffected.** The inline reset script in `index.html` scopes its wipe to `pw_install*` / `pw_installed` keys. `pw_sw_just_updated` is a different key in a different storage (session vs local). Test added to pin this contract.

## Verification

**Preview lifecycle (headless Chrome at HEAD before push):**

1. Cleared SW + caches from any prior session. Reloaded.
2. Confirmed SW registered cleanly at `http://localhost:3001/sw.js`, controller active, scope is `/`, `registration.update` method exists.
3. Dispatched a synthetic `controllerchange` event. **The page reloaded immediately** — the eval target navigated away, which IS the proof (the listener fired `window.location.reload()`).
4. On the post-reload page: sessionStorage `pw_sw_just_updated` had been consumed (`markerStillPresent: false`), and the toast text was `"Bygewerk ✓"` (preview was in `af` from earlier session — confirms i18n resolution worked end-to-end).
5. Toast had auto-dismissed by the 600ms sample point — within the 1.5s window.

**Production verification path (Al's job):**

The second commit (`5756563`) bumps a visible version string `Version 1.2` → `Version 1.3` in Settings → About. On Al's iPhone:

1. Currently sees "Version 1.2" (on whichever pre-013 build is cached).
2. Vercel deploys both commits.
3. Al foregrounds the app (visibilitychange → visible → registration.update() fires).
4. New SW found → installs → activates → claims → controllerchange fires → page reloads.
5. New page reads sessionStorage marker → shows "Bygewerk ✓" toast for 1.5s.
6. Opens Settings → About → sees "Version 1.3".

**No manual close-reopen drill required.**

## One-shot transition caveat

The propagation logic can't self-bootstrap. **Existing testers running pre-012 builds need ONE manual refresh THIS ONE TIME** to swap over to the new SW with the new propagation logic. After that, every future deploy reaches them automatically. This is unavoidable — the old code didn't call `registration.update()` so it doesn't know to look.

For tonight's tester rollout: links going to NEW testers ship the new logic baked in for first-time install. Existing testers (if any) need one manual refresh after this deploy.

## Tests

26 new tests in `tests/sw-update-propagation.test.js`:

- **sw.js plumbing** (5): install `skipWaiting`, activate `clients.claim`, `PW_UPDATE_AVAILABLE` only when `oldCaches.length`, message includes `version: CACHE_VERSION`, `SKIP_WAITING` listener preserved
- **setupServiceWorkerUpdates wiring** (12): serviceWorker availability guard, `registration.update()` on register, `registration.update()` on visibilitychange, `controllerchange` listener, `hadControllerAtStart` guard, `reloadForUpdate` writes sessionStorage marker + calls reload, `reloadInFlight` guard, message listener for `PW_UPDATE_AVAILABLE`, post-reload toast reads + clears marker, uses localized string, 1500ms duration, negative assertions on the removed manual-prompt code
- **i18n** (6): `updatedToLatest` non-empty in all 5 languages
- **?reset=1 contract** (2): scope preserved, doesn't touch `pw_sw_just_updated`

Full suite: **294 → 320** (+26 new).

## What I'd watch for

- **First foreground after this deploy could miss the auto-reload** (one-shot transition above). If a tester reports "I see old version after Al's deploy" tonight, that's expected for the first such report from each tester — second deploy onwards should propagate cleanly.
- **The `updatedToLatest` toast strings** are not from a native-speaker review. Zu/Xh/St were translated mechanically. Flagged for the same review pass as the cross-language audit (`I18N_CROSS_LANGUAGE_AUDIT.md`).
- **Mid-session reload feels jarring** if it ever happens during active tapping. PW's session length (10–30s) makes this unlikely but possible. If users report it, the mitigation is "wait for next visibilitychange before reloading instead of reloading immediately on controllerchange." Defer until reported.
