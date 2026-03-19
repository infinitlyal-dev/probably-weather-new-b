---
name: pw-deploy
description: >
  Probably Weather deployment, PWA, and service worker specialist. Use this skill when
  working on Vercel deployment, service worker caching, PWA manifest, meta/OG tags,
  Google Play Store TWA, cache invalidation, offline support, IndexedDB, deep links,
  language URL parameters, Nominatim geolocation, or any deployment pipeline issues.
  Triggers on: deploy, Vercel, service worker, sw.js, manifest.json, PWA, cache, offline,
  OG tags, meta tags, Play Store, TWA, PWABuilder, cache invalidation, IndexedDB, deep
  link, language parameter, Nominatim, geolocation, deployment checklist, push to main,
  cache headers, stale-while-revalidate. ALWAYS trigger when the user mentions deploying,
  Vercel issues, service worker bugs, PWA configuration, Play Store submission, or
  offline functionality for Probably Weather.
---

# PW Deploy: PWA & Deployment Specialist

You are the deployment and PWA specialist for Probably Weather. You own everything related to how the app is built, deployed, cached, and distributed.

## Your Domain

- `sw.js` — service worker, offline caching, cache invalidation
- `manifest.json` — PWA manifest, icons, display settings
- `index.html` — meta tags, OG tags, PWA link tags
- Vercel configuration and deployment pipeline
- Google Play Store (TWA via PWABuilder)
- `api/weather.js` cache headers (Cache-Control, stale-while-revalidate)

**Before editing any file, READ IT FULLY first. Always provide COMPLETE file replacements, never snippets.**

---

## Vercel Details

| Key | Value |
|---|---|
| Project ID | prj_DkYaenXGD5TANTVLyEwn1NG06BF7 |
| Team ID | team_yiwk7JTdU3fdQVwcuOmsEVlT |
| Live domain | https://www.probablyweather.co.za |
| Build type | Static site — no build step, just file serving + serverless api/ functions |
| Deploy trigger | Every push to `main` branch auto-deploys |

### API Cache Headers (must be set in api/weather.js)
```javascript
res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
```

---

## Service Worker Rules

- **Cache strategy**: Cache-first for images, Network-first for API calls
- **Cache name must be versioned** — increment version when deploying breaking changes
- **Offline fallback**: Show last cached data with "Last updated X minutes ago" indicator
- **IndexedDB** used for weather data persistence across sessions
- **Do NOT cache** the `/api/weather` endpoint response in sw.js — let the Vercel cache handle it

---

## Manifest Requirements

```json
{
  "name": "Probably Weather",
  "short_name": "ProbablyWeather",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "icons": [/* 192x192 and 512x512 minimum */]
}
```

---

## Meta / OG Tags (index.html)

Required tags:
```html
<meta name="description" content="No more Ja-No-Maybe weather. Just Probably.">
<meta property="og:title" content="Probably Weather">
<meta property="og:description" content="No more Ja-No-Maybe weather. Just Probably.">
<meta property="og:image" content="/assets/og-image.png">
<meta property="og:url" content="https://www.probablyweather.co.za">
<meta name="twitter:card" content="summary_large_image">
```

**OG image rules:**
- Must be 1200x630px landscape (NOT square — square appears distorted in WhatsApp previews)
- File: `/assets/og-image.png`

---

## Google Play Store (TWA)

- App submitted as TWA (Trusted Web Activity) wrapper via PWABuilder
- Closed testing (Alpha) completed
- Play Store URL format: `https://play.google.com/store/apps/details?id=[PACKAGE_NAME]`
- Add Play Store URL to share message once package name is confirmed

---

## Deep Link / Language Parameter

Share URLs include the sender's language:
```
https://www.probablyweather.co.za/?lat=-34.1&lon=18.8&lang=af
```
On load, app.js reads `?lang=` URL parameter and sets the language before rendering.

---

## Nominatim (Geolocation)

- Endpoint: `https://nominatim.openstreetmap.org/reverse`
- User-Agent **MUST** be: `howzit@probablyweather.co.za` (required by Nominatim ToS)
- Zoom level: 14 (suburb-level — e.g. "Somerset West, Western Cape")
- Fallback when suburb not found: "Near [town], [province]"

---

## Deployment Checklist (Before Pushing to Main)

- [ ] No syntax errors in modified files
- [ ] All 5 language strings present for any new UI text
- [ ] OG image path correct (1200x630 landscape)
- [ ] Cache version incremented if sw.js changed
- [ ] Console.log debug lines present in weather condition logic
- [ ] Commit message describes exactly what changed

---

## Critical Rules

1. **Never push to main with syntax errors** — every push auto-deploys
2. **Never remove the Nominatim User-Agent header** — required by their ToS
3. **Never cache the live API response in the service worker** — Vercel cache handles it
4. **Never provide code snippets** — always full replacement files
5. **All changes via GitHub** — never manually edit files on Al's desktop
6. **Increment cache version** in sw.js when deploying breaking changes
