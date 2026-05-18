# Probably Weather — Monetisation & Infrastructure Cost Research

Date: 2026-05-14  
Scope: read-only research against the live site, current repo files, attached phone screenshots, and current public pricing/policy pages.

## Executive Read

Probably Weather can run ads as a PWA because ad networks see it as mobile web, not as an app. The practical first monetisation path is **Google AdSense in-feed/in-article display/native**, with a house-ad fallback for unfilled slots. Direct sales to SA brands becomes realistic once PW has proof of audience, install base, geography, and repeat usage.

Two assumptions in the brief are wrong or incomplete:

- **Open-Meteo is not currently free for commercial production use.** Its current pricing page marks Free/Open-Access as non-commercial only, with commercial use on paid Standard/Professional/Enterprise plans. It still uses open data with attribution requirements, but production commercial use should move to a customer plan. Source: [Open-Meteo pricing](https://open-meteo.com/en/pricing).
- **The image-size assumption is optimistic.** The repo has 193 background JPEGs totalling 430.38 MB; average is 2.23 MB, median 2.18 MB, max 6.81 MB. The model below uses the brief's 1.5 MB as the conservative baseline, but real savings may be larger.

## Part 1 — Native Ad Networks For A PWA

| Network | Native/in-feed support | PWA/mobile-web fit | Signup + approval | Traffic threshold | SA inventory / risk | Verdict |
|---|---:|---:|---|---:|---|---|
| Google AdSense | Yes: In-feed ads are native and can be styled to match a feed; in-article and display also available. | Yes. JS tags for websites/mobile web. PWA install status does not matter. | Add site, place code, site review. Google says review usually takes a few days but can take 2-4 weeks. Requires own original content, policy compliance, age 18+. | No explicit minimum traffic in eligibility docs. | South Africa is an AdSense-supported country. Fill is not guaranteed per slot; AdSense exposes `data-ad-status="filled/unfilled"` and coverage reporting. | Best first programmatic option. |
| Google Ad Manager | Yes: native templates and responsive flexible ad slots across desktop/web/app. | Yes, but operationally heavier than AdSense. | Needs GAM setup, line items, demand, ad ops. Usually overkill before direct sales or multiple networks. | No simple public threshold; practical threshold is ad-ops complexity. | Strong global demand, but fill depends on configured demand and floor prices. | Later, when PW has direct campaigns or header bidding. |
| Media.net | Yes: contextual native/custom units, one JS tag, mobile units. | Yes. Website ad tags, mobile web compatible. | Apply/contact; approval is editorial/quality based. Public pages do not list a clear timeline or traffic minimum. | Not publicly stated on official pages. | Global demand, but strongest historically on English/search-intent traffic. SA fill likely lower than Google unless contextual demand matches. | Worth applying after AdSense; not the first dependency. |
| Amazon Publisher Services | Display/programmatic/mobile web support; native is less self-serve for small publishers. | Technically yes for web/mobile web, but APS is more ad-stack infrastructure than starter network. | Requires APS account/integration; often paired with TAM/UAM and account support. | Not a small-publisher starter path. | Amazon demand exists globally, but SA weather PWA is unlikely to get meaningful managed attention early. | Not first wave. Consider only at scale. |
| Ezoic | Ad monetisation/platform, supports web tools/apps via JS. | Yes, if JS can be inserted. | Apply with GA verification; Ezoic quality review. | Current docs: generally 250,000+ monthly active users; Incubator possible below that. | Does not reject PWAs; no SA-specific rejection found. | Later. Threshold blocks early launch. |
| Outbrain/Teads | Yes: standard native, in-feed, all devices. | Yes. | Apply to Engage; publisher guidelines required. Outbrain says any scale, service level varies by size. | No minimum traffic according to current help page. | Native recommendation demand often performs best on content/news pages, not sparse utility screens. | Possible, but brand-fit risk is high. Use only with strict category blocking. |
| Taboola | Yes: native/display/performance feed units. | Yes. | Publisher application and policies. | Official traffic minimum was not found; market reality usually favours larger content publishers. | Same content-quality/brand-fit risk as Outbrain. | Not recommended for v1 unless PW is comfortable with "chumbox" style risk. |
| Mediavine / Journey | Premium ad management. | Yes, but content-site oriented. | Apply to Journey or Mediavine. | Mediavine: $5,000+ annual ad revenue; Journey starts at 1K sessions. Requires clean traffic and AdSense/AdX standing. | Strong premium demand but needs enough traffic/content depth. | Later, if PW builds content pages or a launch blog. |
| Raptive | Premium ad management. | Yes, but long-form content oriented. | Apply with GA. | 25,000 pageviews/month minimum; for 25k-99,999 PV, 50% traffic from US/UK/CA/NZ/AU; 100k+ requires 40% from those countries. | This effectively disadvantages SA-heavy PW traffic. | Not viable for SA-first PW unless traffic mix changes. |

Sources: [AdSense in-feed ads](https://support.google.com/adsense/answer/9189557), [AdSense eligibility](https://support.google.com/adsense/answer/9724), [AdSense site review timing](https://support.google.com/adsense/answer/7584263), [AdSense availability](https://support.google.com/adsense/answer/13402307), [AdSense unfilled units](https://support.google.com/adsense/answer/10762946), [Google Ad Manager native](https://admanager.google.com/home/resources/feature-brief-native-ads/), [Media.net publisher program](https://www.media.net/ads/publisher-program/), [Media.net native/contextual](https://www.media.net/ads/), [Ezoic requirements](https://support.ezoic.com/kb/article/getting-started-ezoics-requirements), [Outbrain minimum traffic](https://www.outbrain.com/help/publishers/outbrains-minimum-traffic-requirement/), [Outbrain ad specs](https://www.outbrain.com/help/ads-specs/), [Mediavine requirements](https://www.mediavine.com/mediavine-requirements/), [Raptive eligibility](https://help.raptive.com/hc/en-us/articles/360032840891-Who-is-eligible-for-Raptive).

## Part 2 — How PW Gets Advertisers And Fill

### Programmatic

Setup:

1. Apply to AdSense first.
2. Add `ads.txt`.
3. Add one manual in-feed/in-article unit, not Auto Ads everywhere.
4. Add a CSS/JS fallback for `data-ad-status="unfilled"` so the UI collapses or swaps to a house ad.
5. Track impressions, clicks, coverage, viewability, and revenue by placement.

Timeline:

- AdSense signup to first paid impression: likely a few days to 2-4 weeks if approved.
- Media.net/Outbrain: usually application + human/business review; assume 1-4 weeks unless they give a direct timeline.
- Ezoic/Mediavine/Raptive: blocked by threshold or content/audience fit until PW has scale.

Fill reality:

- Fill is never guaranteed at the slot level. It depends on country, device, ad size, viewability, advertiser demand, brand safety, floor prices, page content, consent signals, and invalid-traffic risk.
- Google is the best bet for SA because it has the broadest long-tail advertiser demand and supports SA accounts, but even Google documents unfilled units.
- PW should design the ad container to **hide cleanly when empty** and should keep a house-ad/direct-sponsor fallback ready.

Direct answer: PW ensures reliable ad serving by **not depending on one buyer**. Start with AdSense as baseline demand, collapse empty slots, then sell direct SA sponsorships into the same placement. Direct campaigns guarantee a creative exists; programmatic backfills unsold inventory.

### Direct Sales

Setup:

1. Build a one-page media kit: DAU/MAU, installs, repeat-open rate, top towns/provinces, language split, placement screenshots, rate card.
2. Define inventory: home sponsored card, week-list sponsored row, optional weather-triggered sponsor category.
3. Use simple fixed packages first: "Sponsored card, Western Cape users, 30 days, capped frequency."
4. Serve direct ads from a small JSON config or CMS later; do not overbuild before a buyer exists.

Timeline:

- First real paid direct ad: 2-8 weeks, depending on Al's sales network and proof of usage.
- Fastest likely buyers: local outdoor/retail/insurance/automotive/coffee/braai/farmstall brands, tourism, events, solar/battery, rainwear/outdoor gear.

Fill reality:

- Direct fill is guaranteed only for sold dates/geos. Unsold dates need programmatic or a house ad.
- Direct CPM can beat programmatic in SA if the sponsorship is contextual and local, but it needs sales effort and campaign reporting.

## Part 3 — Infrastructure Cost Model

### Current Pricing / Terms Checked

| Provider | Current terms/pricing found | PW implication |
|---|---|---|
| WeatherAPI.com | Free: 100k calls/month. Starter: $7/mo, 3M calls/month. Pro+: $25/mo, 5M calls/month. Business: $65/mo, 10M calls/month. Enterprise custom. Over limit stops receiving data for the month. | Fine up to mid-scale; 1M DAU needs Enterprise or aggressive caching. |
| Pirate Weather | Free key is 10k calls/month. Pirate Weather states a $2 monthly donation raises the limit to 20k calls/month. No public higher paid tier table was visible without the JS portal/login. | Current per-user call pattern makes Pirate Weather the first hard scaling blocker. |
| Vercel Pro | $20/mo + additional usage, with $20 included usage credit. Functions: 1M invocations/month included, then $0.60/1M; provisioned memory 360 GB-hrs included, then $0.0106/GB-hr; Fast Origin Transfer 10 GB/month included, then $0.06/GB. | Bandwidth dominates because of JPEG backgrounds; functions are secondary. |
| LocationIQ | Free: 5,000 requests/day, 2 req/sec, 60/min, limited commercial use with attribution. Maps Lite: $45/mo, 10k/day. Developer: $100/mo, 25k/day. Startup: $200/mo, 60k/day. Growth Plus: $500/mo, 7.5M/month. Business Plus: $950/mo, 30M/month. | Free tier is too small once autocomplete is live. Developer/Startup likely needed early. |
| Open-Meteo | Free/Open-Access: non-commercial, 600/min, 5,000/hour, 10,000/day, 300k/month. Commercial use requires Standard/Professional/Enterprise. Standard: 1M/month; Professional: 5M/month; Enterprise: >50M/month. Price amounts were not exposed in the fetched page text. | Brief's "free commercial" assumption is wrong. Budget must include a commercial plan or self-hosting decision. |
| MET Norway | Data is freely available under open licences including commercial use, with credit to MET Norway required. FAQ says no paid high-volume pricing model; it is a public service with finite resources. | Can stay free, but PW must keep a good User-Agent and attribution. |

Sources: [WeatherAPI pricing](https://www.weatherapi.com/pricing.aspx), [Pirate Weather docs](https://docs.pirateweather.net/en/latest/API/), [Pirate Weather site](http://pirateweather.net/en/latest/), [Vercel pricing](https://vercel.com/pricing), [LocationIQ pricing](https://locationiq.com/pricing), [Open-Meteo pricing](https://open-meteo.com/en/pricing), [MET Weather API](https://api.met.no/), [MET licensing](https://docs.api.met.no/doc/License.html), [MET FAQ](https://docs.api.met.no/doc/FAQ.html).

### Model Assumptions

- 1 DAU = one meaningful app open/day.
- Weather API bundles: **1.3 `/api/weather` calls per DAU/day**. This covers initial load plus some refreshes/reopens. Each bundle currently fans out to Open-Meteo, WeatherAPI, Pirate Weather, and MET Norway.
- Vercel function invocations: **1.4 per DAU/day** including weather plus reverse-geocode/API helper calls.
- Function duration sensitivity: modelled at **1 GB memory for 3 seconds wall time** per invocation. Real Vercel billing may vary; this is the right cautionary number because `/api/weather` waits on external providers.
- Geocoder migration model: **0.75 LocationIQ credits per DAU/day**: 0.15 reverse/name lookups plus 10% of users doing a six-request autocomplete search.
- Image bandwidth: conservative baseline **1.5 MB JPEG per DAU/day**. WebP/AVIF model assumes **0.45 MB** (70% reduction). Repo average is 2.23 MB, so this understates the image saving.
- Exchange rate not applied; all provider pricing below is USD.

### Monthly Cost Table

Known monthly cost floor, excluding Open-Meteo paid plan amount and Pirate Weather custom/high-volume cost:

| DAU | Weather calls/month/source | LocationIQ calls/month | Required known tiers | Vercel with JPEG | Vercel with WebP/AVIF | Known monthly floor with JPEG | Known monthly floor with WebP/AVIF |
|---:|---:|---:|---|---:|---:|---:|---:|
| 10,000 | 390,000 | 225,000 | WeatherAPI Starter $7; LocationIQ Developer $100; Pirate Weather custom/unsupported; Open-Meteo Standard required | ~$26 | $20 | **~$133 + unknowns** | **~$127 + unknowns** |
| 100,000 | 3.9M | 2.25M | WeatherAPI Pro+ $25; LocationIQ Growth Plus $500; Pirate Weather custom/unsupported; Open-Meteo Professional likely required | ~$305 | ~$116 | **~$830 + unknowns** | **~$641 + unknowns** |
| 1,000,000 | 39M | 22.5M | WeatherAPI Enterprise custom; LocationIQ Business Plus $950; Pirate Weather custom/unsupported; Open-Meteo Enterprise likely required | ~$3,092 | ~$1,202 | **~$4,042 + WeatherAPI/Open-Meteo/Pirate unknowns** | **~$2,152 + WeatherAPI/Open-Meteo/Pirate unknowns** |

Image conversion saving on Vercel bandwidth alone:

| DAU | JPEG transfer/month | WebP/AVIF transfer/month | Transfer saved/month | Approx Vercel transfer saving |
|---:|---:|---:|---:|---:|
| 10,000 | 450 GB | 135 GB | 315 GB | ~$19/month |
| 100,000 | 4.5 TB | 1.35 TB | 3.15 TB | ~$189/month |
| 1,000,000 | 45 TB | 13.5 TB | 31.5 TB | ~$1,890/month |

Cost conclusion:

- At **10k DAU**, LocationIQ and commercial weather-provider compliance matter more than Vercel.
- At **100k DAU**, Vercel bandwidth becomes material; image conversion is worth doing before launch scale.
- At **1M DAU**, the current "one user open = four provider calls" model breaks on WeatherAPI/Pirate/Open-Meteo quotas. PW would need caching, coarser location bucketing, provider sampling, or a paid enterprise weather contract.

## Part 4 — Geocoder Migration Surface

Current compliance issue confirmed: PW uses public `nominatim.openstreetmap.org` directly from the client for search-as-you-type. Nominatim's usage policy strictly forbids client-side autocomplete and says commercial apps should account for policy changes/withdrawal risk. Source: [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

LocationIQ compatibility:

- LocationIQ exposes `/v1/search`, `/v1/reverse`, and `/v1/autocomplete`.
- Its response shape preserves Nominatim-like fields such as `place_id`, `osm_type`, `osm_id`, `boundingbox`, `lat`, `lon`, `display_name`, `class`, `type`, `importance`, and `address`.
- It also adds LocationIQ-specific parameters. `source=nom` can restrict to its internal Nominatim cluster, but LocationIQ warns results may still vary from official Nominatim.
- For PW's current parsing, migration is mostly URL/key/header work, not a data-model rewrite.

Sources: [LocationIQ API reference](https://api-reference.locationiq.com/), [LocationIQ autocomplete docs](https://docs.locationiq.com/reference/autocomplete-4), [LocationIQ pricing](https://locationiq.com/pricing).

Every geocoding call found:

| File | Location | Current call | Migration note |
|---|---:|---|---|
| `api/weather.js` | reverse endpoint | `https://nominatim.openstreetmap.org/reverse?format=json&lat=...&lon=...&zoom=16&addressdetails=1` | Replace with LocationIQ reverse server-side using env token. |
| `api/weather.js` | resolve missing location name | `reverse?format=jsonv2...` | Same provider wrapper as above. |
| `assets/app.js` | `reverseGeocode(lat, lon)` | direct browser fetch to Nominatim reverse | Should stop direct client call. Route through PW API or LocationIQ token-restricted endpoint. |
| `assets/app.js` | `runSearch(query)` | direct browser fetch to Nominatim search, debounced 300ms | Main compliance fix. Replace with LocationIQ `/autocomplete` or server proxy. |
| `assets/app.js` | `loadAndRender` placeholder-name fallback | calls `reverseGeocode` | Covered if `reverseGeocode` changes. |
| `assets/app.js` | GPS startup | `/api/weather?reverse=1...`, fallback to `reverseGeocode` | Keep API path; remove Nominatim fallback. |
| `assets/app.js` | location refresh | `/api/weather?reverse=1...`, fallback to `reverseGeocode` | Keep API path; remove Nominatim fallback. |

Estimated code surface:

- `api/weather.js`: small change if a helper is introduced in the existing file: add `LOCATIONIQ_TOKEN`, replace two Nominatim URL builders, preserve current address parsing. Roughly 25-50 lines touched.
- `assets/app.js`: moderate change because search and reverse fallback both live here. Replace `reverseGeocode`, replace `runSearch`, add keyless server proxy or direct LocationIQ with restricted token, and adjust error handling. Roughly 60-120 lines touched.
- Best architecture: **server proxy for geocoding** (`/api/geocode?type=search|reverse`) so the key is not exposed and autocomplete can be rate-limited/cached. This adds a new API file, but only if implementation is requested later.

## Part 5 — Mockup Placement Notes

The attached screenshots establish the design language: full-bleed weather photo, dark scrim, big yellow hero temp, orange condition, soft smoky cards, pill buttons, and fixed bottom nav.

Home placement (a) needs layout shifts:

- The current home screen has the weather hero occupying most vertical space, with the byline near the lower right and Share/Save/Sources fixed just above the nav.
- A sponsored card below the weather byline and above the action row would need the action row to move down only if there is safe vertical room; on short phones it should either reduce hero text spacing or become a compact 64-76px card.
- The card must not push the bottom nav or overlap the iOS safe area. It should sit above Share/Save/Sources with `Sponsored` visible, and the existing sources card may need to move slightly lower/right or become part of a shared bottom action row.
- Week placement (b) is easier: insert one native row after day 2 or day 3, same height family as a forecast row but clearly labelled `Sponsored`.

Recommended first ad design:

- Label: `Sponsored`, small uppercase, high contrast.
- Body: one-line SA-relevant offer, e.g. `Weekend gear from Cape Union Mart` or `Local deal near Somerset West`.
- CTA: subtle gold pill, not a huge button.
- No fake forecast icon. Do not make the ad look like a weather source or safety alert.

Mockups are generated separately in this thread using the provided screenshots as visual reference.

## Evidence Checklist

- Live site fetched: `https://www.probablyweather.co.za` returned the current PWA shell with `assets/app.css`, `assets/app.js`, manifest, Ad/Analytics-free base app.
- Live API fetched: `https://www.probablyweather.co.za/api/weather?lat=-34.1163&lon=18.8362` returned all four sources OK and current weighted source metadata.
- Repo read: `index.html`, `assets/app.js`, `assets/app.css`, `api/weather.js`, `sw.js`, and `assets/weather-visuals.js`.
- Geocoder grep: Nominatim direct calls found in `api/weather.js` and `assets/app.js`; search-as-you-type found at `assets/app.js` debounced input path.
- Image library measured locally: 193 JPEGs, 430.38 MB total, 2.23 MB average.
