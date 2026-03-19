# Probably Weather — Full App Audit Report

**Date:** 2026-03-19
**Audited by:** Claude Code (4 specialist skill agents)
**Scope:** All 4 domains — Weather Logic, UI Copy, Image System, Deploy/PWA

---

## SUMMARY SCORECARD

| Domain | Rating | Critical | Should-Fix | Nice-to-Have |
|--------|--------|----------|------------|--------------|
| Weather Logic | GREEN | 0 | 3 | 5 |
| UI Copy | GREEN | 0 | 2 | 3 |
| Image System | AMBER | 3 | 4 | 2 |
| Deploy/PWA | AMBER | 3 | 3 | 2 |
| **TOTAL** | **AMBER** | **6** | **12** | **12** |

---

## CRITICAL FINDINGS (6)

### Deploy/PWA

**D-CRIT-1: OG image using square icon instead of landscape format** (index.html:15)
- Current: `og:image` points to `icon-512.png` (512x512 square)
- Required: 1200x630px landscape at `/assets/og-image.png`
- Impact: WhatsApp/Facebook/Twitter share previews display incorrectly — square icons get cropped/letterboxed
- Fix: Create proper landscape OG image and update meta tag

**D-CRIT-2: No vercel.json configuration file**
- No vercel.json exists in project root
- Impact: No explicit cache headers, security headers, or redirect rules beyond defaults
- Fix: Create vercel.json with headers config

**D-CRIT-3: Missing deep link ?lang= parameter support** (assets/app.js)
- Share URLs include `?lang=af` but app never reads this parameter on load
- Impact: Recipients always see default/saved language, not the sender's language
- Fix: Parse URLSearchParams on init, validate against supported languages (en, af, zu, xh, st), apply if present

### Image System

**I-CRIT-1: 22 completed cold images stuck in temp folder**
- Location: `C:\Users\27741\AppData\Local\Temp\pw-source\assets\images\bg\cold\`
- 22 files ready (dawn_1-3, day_1-14 minus day_5, dusk_1-3, night_1-3)
- Repo only has 11 files (7-day set + fallbacks)
- Fix: Move temp cold images to repo, generate missing `cold/day_5.jpg`

**I-CRIT-2: Missing `wind/day.jpg` fallback**
- Every other condition folder has `day.jpg` as fallback — wind does not
- Impact: If a numbered day image fails to load for wind condition, the fallback chain breaks
- Fix: Generate or copy a `wind/day.jpg` fallback image

**I-CRIT-3: Possible wind image version mismatch**
- Temp folder has `wind/day_6.jpg` — repo already has `wind/day_6.jpg`
- Unclear if temp version is a newer/better replacement
- Fix: Compare both files, keep the better one

---

## SHOULD-FIX FINDINGS (12)

### Weather Logic (3)

**W-SF-1: Wind gust 1.5x ratio check not enforced** (api/weather.js:686-701)
- Spec says gusts shown only if gust > average * 1.5
- API always includes `gustKph` if any source provides it
- Recommendation: Add 1.5x ratio check in API, or document that frontend filters

**W-SF-2: Hourly weights inherit MET Norway boost** (api/weather.js:509-512)
- When MET Norway boost triggers, hourly weights also shift heavily toward MET
- May over-influence hourly forecasts during heat waves
- Recommendation: Review whether hourly should use base or adjusted weights

**W-SF-3: Condition priority order could be optimised for SA** (api/weather.js:963-1045)
- Moderate UV (priority 16) currently ranks above moderate wind
- For Cape Town, strong southeaster is often more impactful than moderate UV
- Recommendation: Consider demoting moderate UV below strong wind for coastal SA

### UI Copy (2)

**C-SF-1: Eskom jokes still in witty line rotation** (assets/app.js:229-233, 250-254)
- Master docs say "No Eskom jokes — too dated/negative"
- 3 Eskom references remain in storm and cloudy witty lines across all 5 languages
- Examples: "Eskom wishes it had this power", "Lightning's putting Eskom's grid to shame", "Eskom-friendly weather"
- Fix: Remove these 3 jokes from the rotation (15 strings total across languages)

**C-SF-2: Weekend braai logic includes Friday** (assets/app.js:559)
- Current: `day === 0 || day === 5 || day === 6` (Sun, Fri, Sat)
- Image system spec says weekend = Saturday/Sunday only
- Inconsistency between copy and image domains
- Recommendation: Align — either change to Sat/Sun only, or explicitly decide Friday is "weekend vibes"

### Image System (4)

**I-SF-1: All condition folders stuck at 7-day coverage**
- Every folder has day_1 to day_7 only — 14-day spec needs day_8 to day_14
- Total missing: 7 conditions x 7 images = **49 images** to reach 14-day spec
- Code correctly stays on 7-day cycle until images are ready

**I-SF-2: No numbered dawn/dusk/night variants in repo**
- Spec calls for dawn_1-3, dusk_1-3, night_1-3 per condition
- Only cold/ has these (in temp folder, not repo)
- Impact: Users see same dawn/dusk/night image every time per condition

**I-SF-3: Fallback chain missing final default.jpg step** (assets/app.js:634)
- Current chain: try image → try condition/day.jpg → try fallback/day.jpg
- `assets/images/bg/default.jpg` exists but is never referenced
- Recommendation: Add as final safety net in onerror chain

**I-SF-4: Time slot code not documented** (assets/app.js:627)
- Time ranges are correct (dawn 05-08, day 08-17, dusk 17-20, night 20-05)
- But no code comment explaining the ranges
- Minor code hygiene issue

### Deploy/PWA (3)

**D-SF-1: Manifest short_name mismatch** (manifest.json:3)
- Current: `"short_name": "Probably"`
- Spec: `"short_name": "ProbablyWeather"`
- Impact: Home screen displays "Probably" instead of "ProbablyWeather"

**D-SF-2: Nominatim User-Agent violates policy** (assets/app.js:651, 1051)
- Current: `'User-Agent': 'ProbablyWeather/1.0'`
- Required: `'User-Agent': 'howzit@probablyweather.co.za'`
- Impact: Nominatim ToS requires email-format UA — risk of rate-limiting or blocking

**D-SF-3: Twitter card type should be summary_large_image** (index.html:16)
- Current: `content="summary"` (small square thumbnail)
- Should be: `content="summary_large_image"` once landscape OG image exists

---

## NICE-TO-HAVE FINDINGS (12)

### Weather Logic (5)
- **W-NTH-1:** CLAUDE.md base weights outdated — says 40/25/10/25, code is 35/25/15/25 after V2-2 research
- **W-NTH-2:** Add console log when MET Norway boost is skipped (currently only logs when applied)
- **W-NTH-3:** Rename `MET_USER_AGENT` env var — it's used for Nominatim too, not just MET
- **W-NTH-4:** Verify temperature badge rendering (HOT/COLD/fire emoji) in app.js frontend
- **W-NTH-5:** Verify frontend gust display applies the 1.5x ratio filter

### UI Copy (3)
- **C-NTH-1:** Share message missing "Waarskynlik" branding prefix
- **C-NTH-2:** Weekend braai copy could explicitly exclude night hours (braai at 2am edge case)
- **C-NTH-3:** Placeholder name detection could cover more non-English variants

### Image System (2)
- **I-NTH-1:** Dawn/dusk/night images don't cycle — always show static fallback
- **I-NTH-2:** No console logging for image selection (useful for debugging)

### Deploy/PWA (2)
- **D-NTH-1:** No security headers configured (X-Frame-Options, etc.)
- **D-NTH-2:** SW could enforce max-age check before serving cached API data

---

## CONFIRMED WORKING CORRECTLY

### Weather Logic
- ECMWF dedup (0.5C threshold, WA weight halved)
- MET Norway boost (>5C divergence, latitude-aware)
- WeatherAPI rain clamping (codes 1000/1003 + 0mm = clear)
- Condition voting (majority >=2 sources)
- WeatherAPI 10% weight in description voting
- Modal cloud cover (not average)
- WMO code mapping (all codes covered)
- MET Norway today filtering (no tomorrow leakage)
- MET Norway low temp weight reduction (V2-3)
- Cache headers (s-maxage=300, stale-while-revalidate=60)
- Console debug logging throughout
- Live API producing correct ensemble forecasts

### UI Copy
- 100% translation coverage — 229+ strings, all 5 languages
- SA tone consistent throughout — warm, funny, never corporate
- Condition copy mapping matches spec
- Braai weekend logic functional
- Share message format works (dynamic translation)
- No dead strings, no placeholder text, no American references

### Image System
- Time slot ranges match spec exactly (dawn/day/dusk/night)
- Alias map works (uv→clear, rain-possible→cloudy)
- Condition→folder mapping complete (all API keys map to existing folders)
- Fallback chain handles most missing images gracefully
- Location-aware hour calculation (respects time zones)

### Deploy/PWA
- Service worker does NOT cache /api/weather
- SW cache name versioned (pw-v12)
- Cache strategies appropriate (network-first for API, stale-while-revalidate for images)
- Old caches cleaned up on activate
- Manifest structure correct (icons, display, start_url)
- All required meta tags present
- API cache headers correct

---

## PRIORITISED PUNCH LIST — Before Next Google Play Testing Round

### Priority 1: Social Sharing (Blocks Play Store Review)
1. Create `/assets/og-image.png` at 1200x630px landscape
2. Update `index.html` og:image meta tag to point to `/assets/og-image.png`
3. Change twitter:card to `summary_large_image`

### Priority 2: Policy Compliance (Risk of Service Disruption)
4. Fix Nominatim User-Agent to `howzit@probablyweather.co.za` in app.js (2 locations)

### Priority 3: Deep Links (Spec Requirement)
5. Add `?lang=` URL parameter parsing on app load in app.js

### Priority 4: Manifest (Play Store Display)
6. Change manifest.json `short_name` from "Probably" to "ProbablyWeather"

### Priority 5: Image Gaps (User Experience)
7. Move 22 cold images from temp folder to repo
8. Generate missing `cold/day_5.jpg`
9. Generate missing `wind/day.jpg` fallback
10. Compare `wind/day_6.jpg` temp vs repo — keep better version

### Priority 6: Copy Cleanup (Brand Consistency)
11. Remove 3 Eskom jokes from storm/cloudy witty lines (15 strings across languages)
12. Decide Friday braai policy — align copy and image system

### Priority 7: Configuration (Best Practice)
13. Create `vercel.json` with cache headers and security headers

### Priority 8: Documentation (Housekeeping)
14. Update CLAUDE.md base weights to 35/25/15/25 (reflect V2-2 research)

---

**End of Audit Report**
*Generated 2026-03-19 by Claude Code using pw-weather-logic, pw-ui-copy, pw-image-system, and pw-deploy specialist skills.*
