# Probably Weather — Deploy/PWA Audit Report
**Date:** 2026-03-19
**Scope:** Service Worker, Manifest, Meta Tags, Cache Headers, Deep Links, Nominatim User-Agent

---

## CRITICAL ISSUES

**[CRITICAL]** OG image using square icon instead of landscape format (index.html:15)
- Current: `<meta property="og:image" content="https://probablyweather.co.za/assets/icon-512.png"/>`
- Issue: icon-512.png is 512x512 (square). OG image spec requires 1200x630 landscape.
- Impact: Social sharing previews (Facebook, Twitter, WhatsApp) will display incorrectly. Square icons get cropped/letterboxed.
- Fix Required: Create `/assets/og-image.png` at 1200x630 and update meta tag path.

**[CRITICAL]** No vercel.json configuration file found
- Issue: No vercel.json exists in project root
- Impact: Missing Vercel-specific config for headers, redirects, caching rules. Relying only on default Vercel behavior.
- Recommendation: Create vercel.json to explicitly set cache headers, security headers, rewrites if needed.

**[CRITICAL]** Missing deep link ?lang= parameter support (assets/app.js)
- Issue: No URL parameter parsing for `?lang=` on page load
- Impact: Deep links like `probablyweather.co.za/?lang=af` won't auto-set language
- Spec requirement: "Deep links support ?lang= parameter"
- Current behavior: App loads with default/saved language, ignoring URL param
- Fix Required: Parse URLSearchParams on init, check for `lang` param, validate against supported languages (en, af, zu, xh, st), apply if present.

---

## SHOULD-FIX ISSUES

**[SHOULD-FIX]** Manifest short_name doesn't match spec (manifest.json:3)
- Current: `"short_name": "Probably"`
- Spec requirement: `"short_name": "ProbablyWeather"` (no space)
- Impact: Home screen app name may display as "Probably" instead of "ProbablyWeather"
- Note: This is minor but spec explicitly lists "ProbablyWeather" as the correct value

**[SHOULD-FIX]** Nominatim User-Agent uses incorrect format (assets/app.js:651, 1051)
- Current: `'User-Agent': 'ProbablyWeather/1.0'`
- Spec requirement: `'User-Agent': 'howzit@probablyweather.co.za'`
- Impact: Nominatim policy requires email-based User-Agent for identification. Current format violates their usage policy.
- Risk: Requests could be rate-limited or blocked if Nominatim detects policy violation.

**[SHOULD-FIX]** Twitter card uses "summary" instead of "summary_large_image" (index.html:16)
- Current: `<meta name="twitter:card" content="summary"/>`
- Issue: "summary" displays small square thumbnail. Since we're using square icon, this is currently consistent but wrong.
- Fix: Change to `content="summary_large_image"` once landscape OG image is created.

---

## NICE-TO-HAVE

**[NICE-TO-HAVE]** No X-Robots-Tag or security headers configured
- Issue: No vercel.json means no explicit security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Impact: Minor security posture improvement opportunity
- Recommendation: Add headers config to vercel.json when created

**[NICE-TO-HAVE]** Service worker API cache strategy could add max-age check (sw.js:74-108)
- Current: Network-first, cache as fallback for offline. No age expiry enforcement.
- Note: API already sets `Cache-Control: s-maxage=300, stale-while-revalidate=60` (line 787 of api/weather.js) ✓
- Consideration: SW caches API response with timestamp but doesn't enforce 3-hour max age from line 20. Could add age check before serving cached API response.

---

## CONFIRMED CORRECT

✓ **Service worker does NOT cache /api/weather** (sw.js:74)
- API path explicitly handled with network-first strategy, cache only used for offline fallback
- Correct behavior

✓ **Service worker cache name is versioned** (sw.js:6-9)
- Current version: `pw-v12`
- Cache names: `pw-v12-core`, `pw-v12-img`, `pw-v12-api`
- Old caches cleaned up on activate (sw.js:29-38)
- Correct implementation

✓ **Service worker cache strategy is appropriate** (sw.js:67-158)
- Weather API: Network-first, cache for offline (correct)
- Core assets: Network-first, cache for offline (correct)
- Images: Stale-while-revalidate with 60-item limit (correct)
- Reverse geocode API: Pass-through, no caching (correct)

✓ **Manifest.json structure matches spec** (manifest.json:1-52)
- name: "Probably Weather" ✓
- short_name: "Probably" (should be "ProbablyWeather" per spec, flagged above)
- display: "standalone" ✓
- icons: 192px + 512px (any + maskable) ✓
- All required fields present ✓

✓ **Required OG/meta tags present in index.html** (index.html:3-25)
- viewport with no-scaling ✓
- theme-color ✓
- apple-mobile-web-app-capable ✓
- og:title, og:description, og:type, og:url ✓
- twitter:card, twitter:title, twitter:description ✓
- manifest link ✓
- Only issue: og:image path (flagged as CRITICAL above)

✓ **API cache headers are correct** (api/weather.js:787)
- `res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');`
- Matches spec: s-maxage=300 (5 min), stale-while-revalidate=60 ✓

---

## SUMMARY

**Critical Issues:** 3
- Missing landscape OG image (1200x630)
- No vercel.json config file
- Missing ?lang= deep link parameter support

**Should-Fix Issues:** 3
- Manifest short_name format
- Nominatim User-Agent (policy violation risk)
- Twitter card type (once OG image fixed)

**Nice-to-Have:** 2
- Security headers in vercel.json
- SW API cache age enforcement

**Overall Rating:** 🟠 **AMBER**

**Rationale:**
Core PWA functionality is solid (SW caching, offline support, manifest). Cache headers are correct. Main blocker is social sharing (OG image), Nominatim policy compliance, and missing deep link support. No RED-level breaking issues but 3 CRITICALs prevent GREEN rating. Deploy will work but social features and some edge cases broken.

---

## RECOMMENDED FIX PRIORITY

1. **Create og-image.png** (1200x630 landscape) — fixes social sharing
2. **Add ?lang= parameter handling** — fixes deep link spec requirement
3. **Fix Nominatim User-Agent** — prevents potential rate-limiting/blocking
4. **Create vercel.json** — adds explicit config, security headers
5. **Fix manifest short_name** — minor spec compliance
6. **Update twitter:card** — improve social preview (after OG image done)

---

**Audit completed.** All findings documented with file paths and line numbers where applicable.
