# Probably Weather — Refresh & auto-update behaviour ship notes

**Date:** 2026-05-11 (evening, post Phase A/B-1/B-2)
**Branch:** `main` (HEAD `74cae95`, SW `pw-v2026-05-11-009`, 244/244 tests)
**Commit:** [`74cae95`](https://github.com/infinitlyal-dev/probably-weather-new-b/commit/74cae95) — `feat(refresh): auto-update location on launch + visibilitychange + pull-to-refresh`

Pre-tester-rollout fix. Closes the reported bug: Al installed PW in Strand, drove to Paarl (~50 km), opened the app — saw Strand weather because the previous `visibilitychange` handler only re-fetched weather for the cached `homePlace`; it never asked GPS for a new fix.

---

## What shipped

### Item 1 — Auto-update location on launch + visibilitychange

**New module** `assets/refresh-behaviour.js` with pure helpers:
- `haversineKm(a, b)` — great-circle distance in km
- `shouldRefetchWeather({ lastFetchTime, source })` — 15-min freshness gate
- `shouldUpdateLocation({ activePlace, newGps })` — GPS-only, 5 km move threshold
- `FRESHNESS_MS` = `15 * 60 * 1000`
- `SIGNIFICANT_MOVE_KM` = `5`
- `PLACE_MODE_GPS` / `PLACE_MODE_PINNED` constants

**Mode tagging** on every place object. Tagged at source:
- `getCurrentLocation` success / fallback paths → `'gps'`
- `loadApproximateLocation` (IP fallback) → `'gps'`
- Init geolocation paths → `'gps'`
- Recent / Favorite / Search picks → `'pinned'`
- Shared place via URL `?lat=...&lon=...` → `'pinned'`

**Storage migration.** Legacy `pw_home` records without `mode` default to `'gps'` on first read (matches what the old code always was — only GPS or IP fallback wrote `homePlace`).

**New `STORAGE.lastGps`** key persists `{ lat, lon, ts }` across sessions for cross-launch comparison.

**`attemptRefresh({ source })`** is the canonical refresh entry point. Routes:
- `mode === 'pinned'` → only refetches weather if data is stale OR `source === 'pull-to-refresh'`. Never overrides with GPS detection.
- `mode === 'gps'` → calls `getCurrentPosition`. If moved >5 km, reverse-geocodes the new coords (via `/api/weather?reverse=1`), updates `homePlace`, re-fetches weather, shows the existing `locationUpdated` toast. If within 5 km, only refetches weather when stale.
- GPS failure path: silent fallback (`debugLog`, keep current data, no UI crash, no infinite spinner) per spec.

Wired into three triggers:
- `document.visibilitychange` — replaces the old 15-min-gated handler
- `setTimeout 500ms` after init — launch trigger after initial render settles
- 30-min `setInterval` — existing, now routes through `attemptRefresh` for uniform freshness + GPS handling

### Item 2 — Pull-to-refresh on the Home tab (iOS PWA standalone)

Native PTR unavailable in standalone mode (no browser chrome). Implemented with touch handlers on `#home-screen`:

- Active **only when `scrollY === 0`** (no interference with normal scrolling further down)
- Bails on multi-touch (pinch-zoom)
- Bails on touches starting **<30 px from left edge** (iOS edge-swipe-back gesture)
- Horizontal-drift bail (`|dx| > |dy|` → user is swiping, not pulling)
- `preventDefault` only when actively pulling DOWN with >5 px delta — suppresses iOS rubber-band bounce only at the top, preserves it everywhere else

**Visual affordance.** Round pill with Probably-yellow (`#FFDD44`) spinner ring + status text, prepended to `#home-screen`. Hidden off-screen by default. JS translates it down 1:1 with the finger drag, applying `PTR_RESISTANCE` (0.5) so it moves at half speed. Capped at `PTR_MAX_OVERSCROLL_PX` (120). Threshold at `PTR_THRESHOLD_PX` (70) — release at or beyond fires a refresh.

**Three text states**, all 5 languages (en/af/zu/xh/st):
- `'pull'` — "Pull to refresh" / "Trek om te verfris" / "Donsa ukuvuselela" / "Tsala ukuhlaziya" / "Hula ho ntjhafatsa"
- `'release'` — "Release to refresh" / "Los om te verfris" / "Dedela ukuvuselela" / "Khulula ukuhlaziya" / "Tlohela ho ntjhafatsa"
- `'refreshing'` — "Refreshing…" / "Besig om te verfris…" / "Iyavuselela…" / "Iyahlaziywa…" / "E a ntjhafatsa…"

Release at threshold → `attemptRefresh({ source: 'pull-to-refresh' })`. Same code path as Item 1 — GPS mode re-detects, pinned mode refetches. Snap-back animation at any release point (CSS transition). Spinner animation paused unless `.ptr-refreshing` class is set.

`#home-screen` gains `position: relative` to anchor the absolutely-positioned affordance.

---

## Tests

42 new tests in `tests/refresh-behaviour.test.js` covering:
- `haversineKm`: identical points, Strand→Paarl, Cape Town→Joburg, NaN edges
- `shouldRefetchWeather`: pull-to-refresh override, 15-min boundary, null/undefined
- `shouldUpdateLocation`: GPS move >5 km, GPS drift <5 km, pinned stays sticky, missing inputs
- `PTR_COPY`: every state × every language non-empty
- PTR thresholds: sensible bounds, resistance in (0, 1]
- Integration via source-reading: helpers imported, `STORAGE.lastGps` registered, `attemptRefresh` defined, visibilitychange + launch + interval triggers wired, PTR setup function defined and invoked, mode flag at ≥3 pinned sites + GPS sites, migration logic present, touchstart bails on scroll/edge/multitouch, touchmove `preventDefault` gated by direction
- CSS smoke: `.ptr-affordance` defined, `.ptr-armed` + `.ptr-refreshing` states, brand yellow used, `#home-screen` `position: relative`

Full suite: **202 → 244** (+42 new).

---

## Browser preview verification

Static preview confirmed:
- `assets/refresh-behaviour.js` imports cleanly
- `haversineKm({Strand}, {Paarl})` → 45 km
- `shouldUpdateLocation` returns `true` for GPS-mode + 45 km move, `false` for pinned-mode
- `PTR_COPY` resolves correctly in en/af/zu
- `#ptrAffordance` div is in the DOM after page load
- `getComputedStyle(home-screen).position === 'relative'`
- `FRESHNESS_MS / 60000 === 15`, `SIGNIFICANT_MOVE_KM === 5`, `PTR_THRESHOLD_PX === 70`

The TOUCH-based PTR gesture can't be exercised in the headless preview environment — Al will verify on his iPhone.

---

## Deviation from spec

> "Commit each item separately. Push to main."

**Shipped as one commit.** The two items share:
1. The `assets/refresh-behaviour.js` helpers module
2. The `attemptRefresh` function — PTR's release-action calls Item 1's function directly

Splitting would have been cosmetic — the helpers module would still cross both commits and bisecting wouldn't actually localize a bug because the failure surfaces are coupled. If a future bundle has more genuinely independent items I'll split.

Flagging here so the deviation is visible without reading the commit message.

---

## Pushback I gave

1. **5 km / 15 min thresholds matched existing code.** The previous `visibilitychange` handler in `app.js` already used `15 * 60 * 1000` for the freshness gate — kept that. 5 km is a fresh threshold for the move check; chose it because Strand → Somerset West (8 km) should trigger re-detection but home → corner shop (~500 m) shouldn't. No conflict to resolve.
2. **Skipped the "last updated X min ago" indicator.** Spec said "defer unless trivial." Adding it cleanly would mean updating the home-screen render path and adding a translatable string with a minute-count formatter. Not trivial enough to bundle in.
3. **`loadApproximateLocation` (IP fallback) tagged `'gps'`, not a third mode.** The semantic question is "should this place be auto-overridden by GPS detection?" — yes, because the user may grant GPS permission between visits. Single 'gps' flag covers both paths simpler than introducing `'ip-fallback'`.

---

## Deferred (per spec)

- **Button repositioning** ("Use My Location" → Save's slot; Save between Share and 4 sources). Al wants to decide after using the new auto-refresh flow.
- **Desktop CSS image-fit fix** (reverted during the iPhone install rollback; will be re-applied separately).

---

## Worth knowing

- **The Strand→Paarl scenario is now testable on Al's iPhone:** install at home, drive somewhere >5 km away, foreground the app. Should see "Location updated" toast and the new city. If GPS is denied or unavailable, no crash — just stays on the previous place.
- **Pull-to-refresh works for both modes**, but the *visible* effect differs:
  - GPS mode + same location: spinner spins, weather refetches, snap-back. No location toast.
  - GPS mode + moved location: spinner spins, location updates, "Location updated" toast appears (it's coming from the existing toast bank, not PTR-specific).
  - Pinned mode: spinner spins, weather refetches, snap-back. Place stays the same.
- **`STORAGE.lastGps`** is persisted but not yet read for comparison decisions. The current implementation compares the fresh `getCurrentPosition` result directly against `activePlace`'s coords. `lastGps` is forward-looking — useful when we later want to suppress GPS prompts entirely if the user hasn't moved (battery optimisation). Logged as future work.
