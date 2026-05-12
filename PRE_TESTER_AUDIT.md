# Probably Weather — Pre-tester audit (Phase 2)

**Date:** 2026-05-12
**Main HEAD:** `2891d37` (Phase 1 report) on top of `da0ea2d` (SA6 merge)
**SW slot:** `pw-v2026-05-12-005`
**Test suite:** 1009/1009 passing, 26 files
**Audit scope:** post-Phase-1 state, tester-rollout safety only (NOT a refactor)

---

## Method

Read in full and cross-referenced:
- `sw.js` (191 lines)
- `middleware.js` (144 lines, edge OG meta swap)
- `assets/app.js` (2086 lines, focus: SW reg, URL params, innerHTML, refresh, share)
- `assets/install.js` (720 lines, focus: deep-link handlers, modal HTML)
- `assets/refresh-behaviour.js` (136 lines, pure logic)
- `assets/weather-emoji.js` (62 lines, pure)
- `assets/share-url.js` (60 lines, builders)
- `assets/startup-location.js` (15 lines)
- `api/og.js` (305 lines, dynamic OG)
- `api/share.js` (144 lines, server-side share meta)
- `index.html` (394 lines)

---

## CRITICAL — must fix before tester rollout

### C1. Settings → About has a duplicated "Data sources" section

**File:** `index.html` lines 293-296 (the "Data sources" block) is a near-duplicate of the longer About block at lines 297-304. Both list "Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather" — confusing on the screen Al's testers will see immediately on first launch.

**Fix:** delete the `<div class="settings-section">…<h3>Data sources</h3>…</div>` block (lines 293-296). Keep the longer About block (lines 297-304) — it has Version, contact email, copyright, and Privacy link.

**SW cache bump required:** yes (index.html change).

---

## SHOULD — fix soon, not blocking tester rollout

### S1. Dead i18n key `T.settings.wittyIn`

**File:** `assets/app.js:164`. Identical values to `T.settings.language` ({en:"Language", af:"Taal", zu:"Ulimi", xh:"Ulwimi", st:"Puo"}). Grep across `assets/` and `tests/` confirms it is never read. Stale leftover already flagged in `I18N_CROSS_LANGUAGE_AUDIT.md` (structural note 1), `LANG_QC_NOTES.md`, `TRIAGE_NATIVE_REVIEW.md`. Folding the delete into this phase costs nothing.

**Severity:** SHOULD (low) — wastes 5 lines, slightly slows i18n pre-loading. Not user-facing.

### S2. `api/share.js` line 132 embeds appUrl via `JSON.stringify` inside `<script>`

```js
<script>window.location.replace(${JSON.stringify(appUrl)});</script>
```

`JSON.stringify` does not escape the substring `</script>`. Today `appUrl` is built only from `SHARE_ORIGIN` + URL-encoded params (lat/lon/lang are all sanitized before reaching this line), so percent-encoding inside `URLSearchParams.toString()` keeps any literal `</script>` neutralized. But this is brittle defence-in-depth — a future code change that interpolates raw user input into `appUrl` would become exploitable. Wrap with the standard `JSON.stringify(...).replace(/</g, '\\u003c')` idiom.

**Severity:** SHOULD — not exploitable today, but the moment someone adds another field this becomes a real XSS sink.

### S3. Two `visibilitychange` listeners — soft race on tab return

`assets/app.js:492` registers one for SW update propagation. `assets/app.js:1910` registers another for weather refresh. They both fire on the same event. Order is registration-order (SW listener first because `setupServiceWorkerUpdates()` runs at line 1761 before the refresh wiring at line 1910). The race window: if SW update finds a new SW, it calls `reloadForUpdate()` → `window.location.reload()`. During the reload teardown, the refresh listener's `attemptRefresh` is also in-flight and may call `getCurrentPosition`, whose callback could fire after teardown started. Browsers handle this gracefully — the reload nukes any in-flight promises and listeners — but a `saveJSON` to `STORAGE.lastGps` could race ahead of the reload.

**Severity:** SHOULD — not a known user-facing bug, but worth noting that a single combined visibilitychange handler would eliminate the soft race.

### S4. Stale-place GPS callback on rapid place switching

`assets/app.js:1860` reads `activePlace` inside the `getCurrentPosition` callback. If the user switches places (taps a different favourite) during the GPS request, the callback writes weather for the OLD `activePlace`. Worst case: 1-2s of wrong-place data flash before the next render. PR #44's pinned-mode immunity covers most of this — pinned places skip GPS entirely. Only affects GPS-mode users switching rapidly.

**Severity:** SHOULD — bounded blast radius, not worth blocking rollout.

### S5. `?lang=` not validated against allowlist before save

`assets/app.js:1757`: `if (urlLang && SUPPORTED_LANGS.includes(urlLang)) { saveJSON(SETTINGS_KEYS.lang, urlLang); }`. **Wait — this is fine.** The `.includes(urlLang)` check IS the allowlist. Mis-flagged on first read. Confirmed safe.

(Leaving this note in the doc as a positive — defence is present.)

---

## NICE — post-launch polish

### N1. SW.js `?reverse=1` pass-through could be cached

`sw.js:71` excludes `/api/weather?reverse=1` from the API cache. Reverse geocoding is idempotent and called once per fresh GPS fix — caching it for 24h would save Open-Meteo geocoding hits. Not urgent.

### N2. install.js x-safari URL scheme construction

`assets/install.js:532` does `window.location.href = \`x-safari-${window.location.href}\`` — concatenates current URL into a custom-scheme URI. Today's URL is sanitized by the browser before being shown in the address bar (browser doesn't render JS-injected scripts via `?` query params), so this is safe. But it's a fragile pattern — feels like it should encode the URL portion.

### N3. Long SW activate handler holds `event.waitUntil` until clients claim

Standard pattern, not actually a problem. Noted for completeness.

### N4. Bundle size — `assets/app.js` at 2086 lines

App.js is mounting close to a single-file maintenance ceiling. Search/Favorites/Settings could move into a separate module post-launch. Not blocking.

### N5. OG image fallback is silent

`api/og.js:302-304` catches all errors and serves the fallback PNG. Errors are not logged. Adding `console.error` would help debug a future tester report of "share preview is broken on link X".

---

## Items investigated and CLEARED

- **SW lifecycle race conditions:** `hadControllerAtStart` + `reloadInFlight` guards work correctly in the read; no infinite-reload path found.
- **OG image XSS via `?bg=`:** allowlist enforced in `middleware.js:54-58` and `share-url.js:21-27`. Non-allowlisted values fall to `default`. ✓
- **OG image XSS via `?city=`:** middleware.js escapeAttr properly escapes `&` and `"` for attribute-value context (which is sufficient for `content="..."` since `<`/`>` inside attribute values are not parsed as tags by browsers). Server-side. ✓
- **innerHTML XSS via shared place name:** `renderRecents()` / `renderFavorites()` / `renderSearchResults()` all wrap user-controlled names in `escapeHtml()` before innerHTML. `bylineEl.innerHTML` (line 1268) only interpolates translated strings + formatted numbers — no user input. ✓
- **CSRF on auto-update toast:** the `pw_sw_just_updated` sessionStorage key is per-tab and only written by the same-origin SW + same-origin page. ✓
- **Weather API multi-source failure:** `api/weather.js` is out of audit scope but inspected briefly — already has try/catch per source and returns `ok:false` with `error` field on total failure. Frontend `loadAndRender` handles the failure path.
- **Geocoding failure:** `assets/app.js:1812-1814` and `1875-1876` both have fallback `reverseGeocode` paths.
- **Offline-fallback corrupted cache:** SW activate handler at `sw.js:36-37` deletes ALL non-current-version caches on activation, so a corrupted cache from a prior version is purged before traffic hits it.
- **Location permission revoked mid-session:** `attemptRefresh` error callback at `app.js:1888-1897` silently falls back to existing data with a debug log. No user-visible crash. ✓
- **Service-worker race when both `controllerchange` AND `PW_UPDATE_AVAILABLE` fire:** `reloadInFlight` guard at `app.js:457` blocks the second reload. ✓
- **`getSharedPlaceFromSearch` lat/lon validation:** `assets/startup-location.js` clamps to [-90,90] and [-180,180]. ✓
- **`escapeHtml` correctness:** `app.js:347` escapes `&<>"'`. Sufficient for both HTML text and double-quoted attributes. ✓
- **Edge middleware idempotency:** `swapMeta` uses a regex matching only the EXACT `<meta property="X" content="...">` form rendered in index.html. Won't re-rewrite if accidentally invoked twice. ✓

---

## Plan after Codex review

1. Run Codex GPT-5.5 adversarial review on this audit + source files.
2. Save Codex output to `CODEX_REVIEW.md`.
3. Reconcile severities — default to higher severity unless Codex reasoning is clearly stronger.
4. Fix all CRITICAL items (currently: C1 only, plus folded-in S1 dead-key removal).
5. Bump SW slot.
6. Run tests, push, deploy.
7. Write final readiness report.
