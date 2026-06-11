# SA4 — Polish Bundle Ship Notes

Branch: `feat/pre-tester-4-polish`
Worktree: `C:/Users/27741/OneDrive/Desktop/Probably weather new/pw-sa4-polish`
Baseline: 22 test files / 320 tests passing → 23 / 327 passing after this PR.

## What shipped

### 1. Vercel Web Analytics — vanilla static-site snippet

- Installed `@vercel/analytics@2.0.1` as a dep (used as a reference for the queue stub shape — actual loader is the script-tag form, no module import).
- Added two small `<script>` blocks in `index.html` `<head>`:
  1. A queueing stub that initializes `window.va` so calls made before the loader script lands are buffered.
  2. `<script defer src="/_vercel/insights/script.js">` — Vercel's auto-injected loader path. Vercel rewrites this on the edge to the real analytics endpoint when the project's Web Analytics is enabled on the dashboard.
- Zero dashboard interaction. If Web Analytics isn't enabled at the project level, the script 404s harmlessly and `window.va('event', ...)` calls accumulate in `window.vaq` until a dashboard flick.

### 2. `appinstalled` event → analytics

- Hooked the existing `window.addEventListener('appinstalled', ...)` in `assets/install.js` (line ~368) to fire `window.va('event', { name: 'app_installed' })` alongside the existing storage writes.
- Guarded with `typeof window.va === 'function'` so it never throws when analytics is disabled or blocked by an ad-blocker.
- No behaviour change to install storage flags — `pw_install_completed` and `pw_installed` still get set as before.

### 3. Accessibility quick pass

- **Bottom tab nav** (`<nav class="nav">`) now declares `role="tablist"` with each button as `role="tab"` and `aria-selected="..."`. Existing `aria-current="page"` on the active button preserved for redundancy.
- **Focus-visible** already at AA-grade in `assets/app.css` (2px solid outline + 4px white shadow ring on focus). No change needed — would have over-tweaked an already-fine system.
- **Witty-copy contrast** already protected: `.headline` has `text-shadow: 3px 3px 6px rgba(0,0,0,0.9)`, `.tagline` has stacked shadow, `.description` has `2px 2px 6px rgba(0,0,0,0.9)`, and `.weather-byline` matches. The home-screen also paints a radial scrim at 30%-50% to lift body text off bright background art. Locked in by `tests/impeccable-a11y-static.test.js`.
- **Background image** wrapper at `#bg` already has `aria-hidden="true"` and the `<img>` carries empty `alt=""` — correct treatment for purely decorative imagery. No alt invented (Lighthouse a11y already scores 100).
- No alt-text edits to existing icon SVGs — they're already `aria-hidden="true"` with text labels next to them.

Lighthouse accessibility score: 100 (already perfect). No test additions needed beyond the offline test below; existing `tests/impeccable-a11y-static.test.js` covers our static guarantees.

### 4. Lighthouse — top 3 fixed

| # | Finding | Action |
| --- | --- | --- |
| 1 | `uses-rel-preconnect` for `ipapi.co` (~320ms LCP savings) | Added `<link rel="preconnect">` + `dns-prefetch` to `index.html` |
| 2 | `render-blocking-resources` (0ms savings, score 0.5) | Cosmetic flag, deferred — see `LIGHTHOUSE_FINDINGS.md` |
| 3 | `geolocation-on-start` (best-practice) | Out of scope — geolocation on load is core product behaviour |

Everything else documented in `LIGHTHOUSE_FINDINGS.md` at worktree root.

Baseline category scores (pre-fix, captured 2026-05-12):
- Performance 95
- Accessibility 100
- Best Practices 96
- SEO 100

Expected post-deploy: Performance 96–97 once preconnect lands. Other categories stable.

### 5. Offline verification

- Full read of `sw.js` (191 lines). Existing cache strategy already covers the offline UX:
  - **Install**: pre-caches `/`, `/index.html`, `/install`, `/install.html`, app JS/CSS, `manifest.json` into `CORE_CACHE`.
  - **`/api/weather`**: network-first → cache fallback with `sw-offline: true` header set so `app.js` can surface "last updated X ago".
  - **HTML/core assets**: network-first → cache fallback → `/index.html` fallback (deep-link recovery).
  - **Background images**: stale-while-revalidate via `IMG_CACHE`, max 60 entries, trimmed on insert.
  - **Default**: `fetch(req).catch(() => caches.match(req))` belt-and-braces.

- No cache-strategy gaps found. SW already does the right thing.
- New test `tests/offline-fallback.test.js` (7 cases, all passing) locks in:
  1. App-shell pre-cache on install
  2. Weather API cache fallback path
  3. `sw-offline` header marker
  4. HTML→cached index.html fallback
  5. Catch-all default branch
  6. Image branch cache-first behaviour
  7. CACHE_VERSION format + current value

### 6. Service worker version bump

`sw.js:6` → `pw-v2026-05-12-004` (was `pw-v2026-05-11-013`). Forces existing clients to drop the old caches on next activate and propagates the polish bundle via the existing `PW_UPDATE_AVAILABLE` postMessage flow.

## Files touched

- `index.html` — preconnect hints, Vercel Analytics snippet + loader, nav `role="tablist"` + per-tab `role="tab"`/`aria-selected`
- `assets/install.js` — analytics event on `appinstalled`
- `sw.js` — CACHE_VERSION bump
- `tests/offline-fallback.test.js` — new (7 tests)
- `package.json` + `package-lock.json` — `@vercel/analytics@2.0.1` added as dep
- `LIGHTHOUSE_FINDINGS.md` — new
- `POLISH_BUNDLE_NOTES.md` — new (this file)
- `lighthouse-report.json` — captured baseline artifact

## Verification

```bash
cd "C:/Users/27741/OneDrive/Desktop/Probably weather new/pw-sa4-polish"
npm test  # 23 files / 327 tests passing
```

## Blockers / notes for review

- **Sentry**: not done (dropped to post-launch per mission brief).
- **Vercel dashboard**: not touched. Analytics will start collecting only after someone enables Web Analytics on the project in the Vercel UI. Until then, the loader 404s silently and the queue stub buffers events — no user-visible impact.
- **i18n & redesign**: not touched (SA5 + SA6 scope).
- The package install added `@vercel/analytics` to `dependencies`. We don't actually import from the module in browser code, but it's there so anyone who wants to swap the snippet for a proper `inject()` call later has the package ready.
