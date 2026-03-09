# Probably Weather — Task Backlog

Last updated: March 2026

---

## 🔴 URGENT (do next)

### FIX-001 — Condition detection bug
**Problem**: App shows cloudy/rain image and "Might rain" copy on clear days.
**Root cause**: WeatherAPI returning condition code 1003 (partly cloudy) or rain-possible flag is overriding clear consensus from other sources.
**Fix needed**:
1. In `api/weather.js`: WeatherAPI codes 1000 and 1003 with precip = 0mm must map to "clear"
2. In `assets/app.js`: Ensemble condition picker must require majority (≥2 sources) to declare rain/cloudy. Add console.log showing each source's vote.
**Agent**: weather-logic

### FIX-002 — OG image for WhatsApp share
**Problem**: `og:image` in index.html points to `icon-512.png` (square, appears distorted in WhatsApp preview cards)
**Fix needed**: 
1. Create a proper 1200x630px landscape OG image (`assets/og-image.png`)
2. Update `og:image` meta tag in index.html to point to it
**Agent**: pwa-deploy

### FIX-003 — Language-aware deep links
**Problem**: Share URL doesn't include the sender's language, so recipients see the app in default language
**Fix needed**: 
1. Append `?lang=[currentLang]` to share URLs in the share button logic
2. On app load, read `?lang=` URL parameter and set language before rendering
**Agent**: pwa-deploy + ui-copy

---

## 🟡 SOON

### FEAT-001 — Play Store link in share message
**Blocked by**: Package name not yet confirmed (apply for production first, then check Play Console → App integrity)
**Fix needed**: Once package name is known, add Play Store URL to share message copy
`https://play.google.com/store/apps/details?id=[PACKAGE_NAME]`
**Agent**: pwa-deploy + ui-copy

### FEAT-002 — Update image picking to 14-day cycle
**Blocked by**: All condition folders need full image sets first
**Fix needed**: Update image-picking logic in `assets/app.js` from 7-day to 14-day cycle
**Agent**: image-system
**Status**: CLEAR folder images in progress (see below)

---

## 🟢 IMAGE WORK IN PROGRESS

### CLEAR condition folder — image plan
**Existing images to rename:**
| Current | New name | Status |
|---|---|---|
| dawn.jpg | dawn_1.jpg | TODO |
| day_2.jpg | day_3.jpg | TODO |
| day_3.jpg | day_2.jpg | TODO |
| day_4.jpg | day_4.jpg | no change |
| day_5.jpg | day_14.jpg | TODO |
| day_7.jpg | day_13.jpg | TODO |
| dusk.jpg | dusk_1.jpg | TODO |
| night.jpg | night_1.jpg | TODO |

**Images to DELETE from clear folder:**
- day.jpg (keep as fallback only — remove from numbered cycle)
- day_1.jpg (duplicate)
- day_6.jpg (too similar to others)

**New images to generate in Leonardo AI (Nano Banana Pro, 1024x1024):**
| Slot | Description | Status |
|---|---|---|
| day_1 | Empty Cape Dutch pool, suburban garden, fynbos, bright blue sky | TODO |
| day_4 (new) | Pristine empty SA beach, white sand, turquoise water, flip flops | TODO |
| day_6 | Two SA colleagues having lunch outside modern Cape Town office park | TODO |
| day_7 | Jacaranda-lined suburban street, full purple bloom, bright blue sky | TODO |
| day_9 | SA grandmother and grandchild on sunny stoep, cold drinks | TODO |
| day_10 | Looking up through indigenous tree leaves toward perfect blue SA sky | TODO |
| day_11 | Perfectly prepared braai area, fire starting, cold drinks, no people | TODO |
| day_12 | Two women manning braai, two men confused over salad, mixed race | TODO |
| dawn_2 | Hadeda silhouette against deep pink/orange SA dawn sky | TODO |
| dawn_3 | Lone surfer walking toward ocean at first light, board under arm | TODO |
| dusk_2 | Two birds on telephone wire against vivid orange/pink WC sunset | TODO |
| dusk_3 | Mixed SA friends on stoep with cold drinks, golden hour light | TODO |
| night_2 | Large moth on warm lit outdoor wall next to yellow outdoor light | TODO |
| night_3 | SA friends around well-lit outdoor table, fairy lights overhead | TODO |

**Other condition folders** (cloudy, rain, wind, storm, cold, hot) — NOT STARTED. Plan after CLEAR is complete.

---

## ✅ COMPLETED

- m/s wind unit conversion in formatWind()
- About text aligned across all 5 languages
- Meta description and OG tags added to index.html
- Favicon link tags added
- Cache-Control headers on api/weather.js
- Nominatim User-Agent fixed
- Show temperature range toggle
- 48-hour hourly forecast (was 24)
- MET Norway added to meta.sourceWeights
- Cape Doctor wind alert banner
- Suburb-level geolocation (zoom=14)
- Offline IndexedDB cache with "Last updated X ago"
- Share button (Web Share API)
- Language-aware location display
