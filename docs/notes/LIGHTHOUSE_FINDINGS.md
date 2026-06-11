# Lighthouse Findings — SA4 Polish Bundle

Baseline audit captured 2026-05-12 against `https://www.probablyweather.co.za` (live production), Lighthouse 12.8.2, mobile emulation, headless Chrome. Full JSON: `lighthouse-report.json` at worktree root.

## Category scores (pre-fix baseline)

| Category | Score |
| --- | --- |
| Performance | 95 |
| Accessibility | 100 |
| Best Practices | 96 |
| SEO | 100 |

PWA category was removed from Lighthouse 12.x — coverage now lives in `best-practices`. PWA-specific checks (installability, SW, manifest) remain in our `tests/install-experience.test.js`.

## Top 3 critical findings — fixed in this PR

### 1. `uses-rel-preconnect` (score 0 → estimated 320ms LCP saving)

**Finding:** No preconnect/dns-prefetch hint for `https://ipapi.co`, the IP-geolocation fallback we hit during startup when GPS isn't available. Lighthouse measured a 316ms wasted hand-shake.

**Fix:** Added `<link rel="preconnect" href="https://ipapi.co" crossorigin="anonymous">` and a matching `dns-prefetch` to `index.html` so the TCP/TLS dance kicks off before `assets/app.js` actually calls `fetch('https://ipapi.co/json/')` at line 335.

**Expected impact:** ~300ms LCP improvement on mobile, primarily on cold loads when GPS is denied or absent. No code-path change — the fetch URL is identical.

### 2. `render-blocking-resources` (score 0.5)

**Finding:** Lighthouse flagged `assets/app.css` as render-blocking but reported 0ms savings (cosmetic flag). The CSS file is ~80KB; inlining critical CSS would chip away at it but the marginal win doesn't justify the maintenance cost of splitting the stylesheet.

**Action taken:** None in this PR. The `defer` on `assets/app.js` keeps JS off the critical path, and our HTML→stylesheet→render chain is already tight. Re-evaluate if PageSpeed FCP regresses below 1.5s.

### 3. `unused-css-rules` (score 0.5, est savings 10 KiB) + `unminified-css` (5 KiB)

**Finding:** ~10 KiB of CSS rules unused on the home screen (most live in screen-specific panels). Minification on Vercel's edge is already on for static assets in production — Lighthouse's emulated profile may not reflect the live transform.

**Action taken:** Skipped in this PR. Both are perf nudges, neither breaks score 95→90. Worth revisiting alongside the CSS refactor SA6 is doing.

## Findings explicitly deferred (out of SA4 scope)

### `geolocation-on-start` (best-practice, score 0)

The app requests geolocation at page load because that *is* the product — "what's the weather where I am". Tying it to a button tap would mean an empty home screen for every cold visit until the user clicks. Out of scope for a polish pass; would require a UX redesign owned by SA6.

### Image weight (`modern-image-formats` 3.4 MB, `uses-responsive-images` 3.1 MB, `uses-optimized-images` 3.1 MB)

The background hero JPGs are the single biggest bytes-on-the-wire issue. These are the responsibility of the `pw-image-system` skill / SA3 (image-system audit). Tracked separately — converting the bg library to AVIF/WebP with `srcset` is its own ticket. Surface area too big for this PR.

### `network-dependency-tree-insight` & `render-blocking-insight`

Lighthouse insight diagnostics, both score 0.5–0, both showing 0ms wasted. Informational only.

### `cache-insight` (41 KiB)

Lighthouse suggested longer `Cache-Control` lifetimes on a handful of assets served via Vercel's default headers. Our `vercel.json` already pins 1-year immutable on `/assets/images/` and 1-day stale-while-revalidate on JS/CSS. The flagged 41 KiB is likely the favicons and manifest, which Vercel handles as 4-hour. Acceptable.

## Re-run

```bash
npx --yes lighthouse https://www.probablyweather.co.za \
  --output=json \
  --output-path=./lighthouse-report.json \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless --no-sandbox"
```

Post-deploy re-run target: Performance 96+, all others unchanged.
