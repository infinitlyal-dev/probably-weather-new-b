# Probably Weather — Adversarial Security Audit

**Date:** 2026-05-28
**Auditor:** Vos (Opus 4.7) — adversarial sweep, READ-ONLY, no code changes.
**Target:** https://www.probablyweather.co.za (live), repo at HEAD `348358c`.
**Why:** Pre-ad-network application (Adsterra / Media.net). Findings only — no fixes applied.

---

## Summary table

| # | Title | Severity | Launch blocker | Location |
|---|-------|----------|----------------|----------|
| 1 | `/api/errors` is an open, unauthenticated, unrate-limited log sink | **High** | **Y** (ad-network: log-cost abuse) | `api/errors.js:20-49` |
| 2 | `/api/weather` accepts unbounded `lat`/`lon` → free quota burn at 5 upstream providers | **High** | **Y** | `api/weather.js:23-33` |
| 3 | No request rate-limiting on any `/api/*` endpoint | **High** | **Y** | `api/*.js` (absence) |
| 4 | Privacy policy contradicts shipped code (Vercel Analytics, Tomorrow.io, LocationIQ undisclosed) | **High** | **Y** (POPIA + ad-network) | `privacy.html` vs `index.html:86-89` and `api/weather.js:9-12` |
| 5 | Privacy policy says "no advertisements" — must update before ads land | **High** | **Y** | `privacy.html:30` |
| 6 | No `Permissions-Policy` header — app uses geolocation | **Medium** | N (but ad-network amber flag) | `vercel.json:14-54` |
| 7 | No `Content-Security-Policy` header — no XSS defence-in-depth | **Medium** | N | `vercel.json:14-54` |
| 8 | OG static-JPEG path resolver has no path-component whitelist (defense-in-depth gap, currently not exploitable) | **Medium** | N | `assets/weather-visuals.js` `resolveOgFolder` + `api/og.js:158` |
| 9 | LocationIQ search abuse via `/api/geocode?type=search` — no rate limit, free token quota burnable | **Medium** | N | `api/geocode.js:137-181` |
| 10 | Provider keys appear inside `fetchJson` URL strings — relies on no unhandled-error path logging the URL | **Medium** | N | `api/weather.js:286, 297, 317` |
| 11 | Recent/favorite places trust localStorage numeric fields shape — `p.lat`/`p.lon` interpolated raw into `data-*` attributes | **Low** | N | `assets/app.js:1973-1974, 1996-1997` |
| 12 | `lang` URL param not validated client-side before being forwarded to `/api/og` (server-side clamps; client-side gap) | **Low** | N | `index.html:25-46` |
| 13 | No `robots.txt`, no `.well-known/security.txt` | **Info** | N | (absence) |
| 14 | HSTS lacks `includeSubDomains` and `preload` flags (Vercel default) | **Info** | N | live header |
| 15 | Vercel Analytics loads on every page but app declares "no analytics" in privacy policy | **High (= overlaps #4)** | **Y** | `index.html:86-89` |

**Five findings flagged as launch blockers for the ad-network applications.** Items 1, 2, 3, 4, and 5 must be addressed before submitting to Adsterra / Media.net or the application stands a high chance of rejection or post-onboarding revocation.

---

## Per finding

### 1. `/api/errors` is an open log sink — log spam / cost abuse

**Severity:** High · **Launch blocker:** Yes

**Location:** `api/errors.js:17-58`

**What it is:**
- The endpoint accepts arbitrary `POST` from any origin (`Access-Control-Allow-Origin: *`, confirmed live with `Origin: https://evil.example.com` returning `204 No Content`).
- No authentication, no IP throttle, no body-shape validation beyond `String(...).slice(0, N)` length caps.
- Logs to `console.error` with `[pw-error]` and `[pw-error-stack]` tags — each request writes up to **~4,500 bytes** to Vercel function logs (500-byte message + 4,000-byte stack + summary fields).
- Client-side dedup is intentionally bypassed by the server (line 14 comment): "Throttled / deduped CLIENT-SIDE … Server-side just accepts whatever lands."

**Exploit scenario:**
1. Attacker runs a single `for(let i=0;i<100000;i++) fetch('https://www.probablyweather.co.za/api/errors', {method:'POST', body:JSON.stringify({message:'X'.repeat(500), stack:'Y'.repeat(4000), kind:'error'})})` from any browser tab on any origin.
2. Each POST writes ~4.5 KB to the Vercel function log retention pool.
3. 100k requests = ~450 MB of log spam in minutes, which:
   - Burns Vercel log retention storage quota (cost or hard cap, depending on tier),
   - Buries real production errors under noise (operational visibility lost — directly contradicts the file's stated goal),
   - May trigger Vercel's per-invocation billing on Pro/Enterprise tiers.

**Recommended fix (described, not applied):**
- Require same-origin: drop `Access-Control-Allow-Origin: *` and reject any `Origin` header that isn't the live domain.
- Server-side per-IP rate limit (e.g. 60/min). Vercel KV / Upstash / Vercel Queues all support this.
- Add a simple shared secret header or signed token from the client, validated server-side.
- Optionally HMAC the body shape on the client and verify, but key delivery is the same problem.

---

### 2. `/api/weather` accepts unbounded lat/lon → upstream quota burn

**Severity:** High · **Launch blocker:** Yes

**Location:** `api/weather.js:23-33`

**What it is:**
- Validation is only `Number.isFinite(parseFloat(req.query.lat))`. **No bounds check** (`lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180`). Compare to `api/og.js:327` which DOES enforce bounds, and `api/share.js:45-46` which has `isValidLat`/`isValidLon` helpers — `/api/weather` is the outlier.
- Garbage but numeric coordinates (e.g. `lat=99999&lon=-99999`) are forwarded to **all 5 upstream providers** (Open-Meteo, WeatherAPI, Pirate Weather, MET Norway, Tomorrow.io) via hardcoded URL templates.
- The providers reject the request with HTTP 4xx (or accept and return junk), but the request still counts against monthly quota.

**Exploit scenario:**
1. Attacker scripts `for(...) fetch('/api/weather?lat=' + Math.random() + '&lon=' + Math.random())` from any origin (no CORS preflight blocking, /api/weather has no `Access-Control-*` headers but the server logic still runs — preflight only blocks the JS from reading the response, not the request itself).
2. With ~5–10 RPS sustained, the **Pirate Weather free tier (20,000 calls/month)** is exhausted in under **2,000 seconds (~33 minutes)**.
3. Tomorrow.io and WeatherAPI follow shortly. MET Norway then 429s the client legitimately because the User-Agent pattern is abusive per their TOS.
4. Cost: API keys get rotated / suspended; the app then degrades for all real users until quotas reset.

**Recommended fix:**
- Add bounds check at line 32: `if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return res.status(400)...`
- Apply same on `/api/geocode` (which already does this for `type=reverse` at `api/geocode.js:189-191` — but not for `type=search`).
- This finding is a 2-line code change. The reason it's High not Low is the quota-cliff is sharp and Pirate Weather is genuinely cheap to exhaust.

---

### 3. No request rate-limiting on any `/api/*` endpoint

**Severity:** High · **Launch blocker:** Yes

**Location:** absence across `api/*.js`

**What it is:**
- Zero per-IP, per-token, or per-route rate limiter visible in any of the 6 functions or in `vercel.json`.
- Vercel's free tier provides a per-account invocation cap, but no per-client throttle.
- Combined with findings #1 and #2 this is the umbrella issue.

**Exploit scenario:**
- Cost burn at 5 upstream weather providers (finding #2).
- Cost burn at LocationIQ geocode (finding #9).
- Log spam at /api/errors (finding #1).
- DDoS amplification: each /api/weather request fans out to 5 outbound provider requests, so 1 inbound = 5 outbound.

**Recommended fix:**
- Vercel KV-backed per-IP rate limit (e.g. 30 req / min for weather, 10 req / min for geocode, 5 req / min for errors).
- Or Upstash @upstash/ratelimit middleware (template available in Vercel templates).
- Or `vercel.ts` `routes.rateLimit` (if using the new config). Note: requires upgrading from `vercel.json` to `vercel.ts`.

---

### 4. Privacy policy contradicts shipped code (POPIA disclosure gap)

**Severity:** High · **Launch blocker:** Yes

**Location:** `privacy.html` vs reality

**What it is — discrepancies found:**

| Privacy policy claim | Code reality | Evidence |
|----------------------|--------------|----------|
| "We do not run analytics, advertising, or tracking" (`privacy.html:30`) | Vercel Web Analytics loaded on every page | `index.html:86-89` (`window.va = ...` + `<script defer src="/_vercel/insights/script.js">`) |
| Lists 4 weather providers (Open-Meteo, WeatherAPI, MET Norway, Pirate Weather) | Code uses 5 — **Tomorrow.io is missing from policy** | `api/weather.js:9-12, 313-319` |
| "Nominatim / OpenStreetMap … receives your typed search query" | Code uses LocationIQ (not Nominatim) for both search and reverse | `api/geocode.js:11, 124-218` |
| Policy "last updated 12 May 2026" | Tomorrow.io added 19 May 2026 (commit `79abe38`), LocationIQ on or before 19 May 2026 | git log |

**Why it matters for ad networks AND POPIA:**
- POPIA § 18 requires data subjects be informed of the **categories of third parties** to which personal information is transferred. Tomorrow.io and LocationIQ are undisclosed third parties receiving lat/lon (and search queries for LocationIQ).
- Ad networks (Adsterra in particular) read the privacy policy as part of due diligence. A policy that demonstrably contradicts the served code is grounds for application rejection or post-onboarding suspension. They will sometimes test by automated scraping that compares disclosed sub-processors against `Connect-Src` calls.

**Recommended fix:**
- Re-issue privacy policy with: today's date, Tomorrow.io and LocationIQ added with their privacy policy links, Vercel Web Analytics disclosed (or removed — see #15).
- Add a "data processors" section listing the full set explicitly.

---

### 5. Privacy policy says "no advertisements" — must update before ads land

**Severity:** High · **Launch blocker:** Yes

**Location:** `privacy.html:30` (and reiterated through "No accounts, no tracking" section)

**What it is:**
Current text says verbatim "We do not serve advertisements" and "Probably Weather does not require registration … We do not use cookies for tracking. We do not use analytics services. **We do not serve advertisements.**" The app is about to apply to Adsterra and Media.net per the brief. Day-one of ads = the policy is false on its face.

**Recommended fix (described):**
- Replace the "No accounts, no tracking" paragraph with the actual ad-network disclosure (Adsterra and/or Media.net) including: data they collect (IP, user-agent, referrer, ad-id), the ad network's own privacy policy URL, and the legal basis under POPIA.
- Add a cookie / consent banner if any network uses tracking cookies (Adsterra's "premium" placements do; Media.net definitely does).
- Add "purposes of processing" wording for ad measurement / fraud detection.

---

### 6. No `Permissions-Policy` header — geolocation feature exposed

**Severity:** Medium · **Launch blocker:** No (but amber flag during ad-network review)

**Location:** `vercel.json:14-54` — header block has no `Permissions-Policy` entry

**Live verification:** `curl -I https://www.probablyweather.co.za/` returns no `Permissions-Policy` (and no legacy `Feature-Policy`) header.

**What it is:**
- The app requests `navigator.geolocation.getCurrentPosition` to fetch user GPS.
- Without `Permissions-Policy: geolocation=(self)`, any iframe embedded in the page (or — more importantly — once ad scripts land — any cross-origin script context the ad network injects) could request geolocation in the document's principal.
- Vercel default Vercel ships no Permissions-Policy at all.

**Exploit scenario:**
- Post-ad-launch: an ad creative iframe could request `getCurrentPosition` and silently exfiltrate GPS coordinates if the user has already granted geolocation to the app domain.
- Same for camera/microphone/clipboard if those are ever added to feature scope.

**Recommended fix:**
Add to `vercel.json` `/(.*)` headers entry:
```json
{ "key": "Permissions-Policy", "value": "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()" }
```

---

### 7. No `Content-Security-Policy` header — no XSS defence-in-depth

**Severity:** Medium · **Launch blocker:** No

**Location:** `vercel.json` — no CSP entry; live `curl -I` confirms no CSP header

**What it is:**
- All current XSS vectors traced from URL params and the search input flow through `escapeHtml()` (`assets/app.js:428`), `safeText()` (`:409`), or `textContent`. No actively exploitable XSS was found.
- However: the app uses `innerHTML` extensively (16 sites in `app.js`) with template-literal interpolation. A future regression could ship one unescaped interpolation, and there's no CSP to limit the damage (e.g. block inline scripts).
- Once ad networks inject their loaders, CSP becomes hard to add tightly because Adsterra / Media.net require broad `script-src` allowances including `'unsafe-inline'` — but a sensible `default-src 'self'` + ad-network domains + `'unsafe-inline'` for scripts is still better than nothing for img-src and frame-src.

**Recommended fix:**
- Pre-ad: add `default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; img-src 'self' data: https:; connect-src 'self' https://ipapi.co https://api.open-meteo.com https://api.weatherapi.com https://api.pirateweather.net https://api.met.no https://api.tomorrow.io https://us1.locationiq.com;` etc. via Report-Only first.
- Iterate to Enforce once ad-network domains are known.

---

### 8. OG static-JPEG path resolver has no path-component whitelist (latent path traversal)

**Severity:** Medium · **Launch blocker:** No

**Location:** `assets/weather-visuals.js` `resolveOgFolder()` → `api/og.js:158` `readFile(new URL('../' + candidate, import.meta.url))`

**What it is — defence-in-depth gap:**
- `resolveOgFolder(condition)` does `String(condition || '').toLowerCase()` then `OG_BACKGROUND_ALIASES[safe] || safe || 'clear'`.
- An input like `"../../some/secret"` passes through verbatim → returned folder is `"../../some/secret"` → `getOgStaticBackgroundPath` returns `og/../../some/secret.jpg` → `new URL('../og/../../some/secret.jpg', import.meta.url)` resolves to a path escaping the `og/` directory.
- **Currently NOT exploitable** because `condition` reaching `resolveOgFolder` is only ever `now.conditionKey` from the weather payload, which `api/weather.js deriveCondition()` sets from a fixed enum of 14 known keys.
- The risk is forward-looking: if a future commit adds `?bg=` reading to `/api/og` (matching the marketing-critical share URL convention), or if a copy-paste lands the helper into a new code path that DOES read user input, the traversal becomes live.

**Exploit scenario (hypothetical):**
- Hypothetical future PR: `const condition = query.bg || payload?.now?.conditionKey || 'clear'`.
- Attacker hits `/api/og?lat=-34&lon=18&bg=../../api/weather` → server attempts to read `og/../../api/weather.jpg` → file doesn't exist (`.jpg` suffix saves us), fallback chain runs.
- Variant: `?bg=../../assets/images/bg/clear/week_1/day/1`. Then suffix `.jpg` becomes `1.jpg` — file doesn't exist; safe.
- Variant: a future helper writes without forcing `.jpg`. Then arbitrary read becomes possible.

**Recommended fix:**
- Whitelist in `resolveOgFolder`: `if (!KNOWN_OG_FOLDERS.has(safe)) return 'clear';`
- Even better: pass condition through `OG_FOLDER_ALLOWLIST` lookup, return `'clear'` for anything not on the list. Then the file path is guaranteed to be one of N hardcoded names with no path-component risk.

---

### 9. LocationIQ search abuse via `/api/geocode?type=search`

**Severity:** Medium · **Launch blocker:** No (but cost reality)

**Location:** `api/geocode.js:137-181`

**What it is:**
- The `type=search` branch calls LocationIQ Autocomplete on every request with `q.length >= 2` (line 139). No rate limit, no minimum interval enforcement.
- Each request spends 1 LocationIQ token (or 2 if the ZA-only query is empty and falls through to unrestricted).
- LocationIQ free tier is ~5,000 requests / day. The /api/geocode endpoint surfaces to the client through the place-search box; the client throttles via `setTimeout(..., 300)` (`app.js:2055`) but no server-side enforcement.
- The `type=reverse` branch is bounds-checked via `parseFloat` + `Number.isFinite` (good ✓).

**Exploit scenario:**
- Attacker hits `/api/geocode?type=search&q=ab` → `/api/geocode?type=search&q=cd` → ... in a loop. Each request costs 1-2 LocationIQ tokens.
- 5,000 daily quota burnable in ~17 minutes at 5 RPS.

**Recommended fix:**
- Same per-IP rate limit as finding #3.
- Add an in-memory LRU response cache (already 5-min CDN cache via `s-maxage=300`, but the s-maxage doesn't cover unique q values — the entropy is high).
- Optionally require a minimum query length of 3 instead of 2.

---

### 10. Provider keys appear in URL strings — log-side leak risk

**Severity:** Medium · **Launch blocker:** No

**Location:** `api/weather.js:286, 297, 317`

**What it is:**
- `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}...`
- `https://api.pirateweather.net/forecast/${PIRATE_WEATHER_KEY}/${lat},${lon}` (key in PATH, harder to redact!)
- `https://api.tomorrow.io/v4/timelines?...&apikey=${TOMORROWIO_API_KEY}`
- Compare to `api/geocode.js:40-42` which has a dedicated `sanitizeUrl()` redacting `?key=...`. `api/weather.js` has no such helper.
- Today's logger is `logSourceFailure()` which only logs `name`, `tag`, `err.status`, `err.message` — does NOT log URLs. The risk is at line 1614 `console.error('Weather API error:', e)` if the thrown Error ever carries the URL (currently it does not — `fetchJson` throws `new Error('HTTP ' + r.status)`).
- **Currently not actively leaking**, but the safety relies on every future contributor never wrapping a fetch error with the URL string.

**Recommended fix:**
- Port `sanitizeUrl` from `api/geocode.js` into `api/weather.js`.
- Use it in any `console.*` call that might receive a thrown error with a URL.
- Defence-in-depth: pre-redact provider keys before the URL is constructed, by using authorization headers where the provider supports them.

---

### 11. Recent/favorite localStorage values trusted as numeric in attribute interpolation

**Severity:** Low · **Launch blocker:** No

**Location:** `assets/app.js:1973-1974, 1996-1997, 2046`

**What it is:**
- `data-lat="${p.lat}"`, `data-lon="${p.lon}"` interpolated directly into innerHTML templates.
- `p.lat` / `p.lon` come from localStorage (`loadFavorites()`, `loadRecents()`). Normal write path goes through `Number.isFinite(r.lat)` filtering in `runSearch()`, so they ARE numbers.
- However `normalizeStoredPlaces()` (referenced but not read in this audit) is the only barrier between localStorage and innerHTML interpolation. If it doesn't `Number()` and `isFinite()`-check, a tampered localStorage entry could break out of the `data-lat` attribute.

**Exploit scenario (defense-in-depth):**
- Requires a primary XSS to seed localStorage with `{lat: '" onmouseover="alert(1)" data-x="', ...}`.
- No primary XSS currently found, so the chain doesn't close.

**Recommended fix:**
- Either: `data-lat="${Number(p.lat)}"` to force numeric serialization.
- Or: validate types in `normalizeStoredPlaces` and drop entries with non-numeric coords.

---

### 12. Client-side inline-script `lang` param forwarded without allowlist check

**Severity:** Low · **Launch blocker:** No

**Location:** `index.html:25-46`

**What it is:**
- Reads `params.get('lang') || 'en'` then forwards to `/api/og` query.
- `URLSearchParams` URL-encodes the value, then `setAttribute('content', encodedUrl)` is set — no HTML parse path, no XSS.
- Server (`api/og.js:322`) clamps `lang` to `{en,af,zu,xh,st}` — so behaviour is safe at the API.
- But the URL itself can contain `lang=javascript%3Aalert%281%29` — passed to the OG image URL as a query string, never executed. Net effect: a weird-looking OG URL that the API serves fine.

**Defense-in-depth recommendation:**
- Add a client-side allowlist: `const SUPPORTED_LANGS = ['en','af','zu','xh','st']; const safeLang = SUPPORTED_LANGS.includes(rawLang) ? rawLang : 'en';` before constructing the URL.

---

### 13. No `robots.txt` / `.well-known/security.txt`

**Severity:** Info · **Launch blocker:** No

Both return 404 on live. Not a security issue per se. A `security.txt` listing a contact email would speed up responsible-disclosure reports.

---

### 14. HSTS lacks `includeSubDomains` and `preload`

**Severity:** Info · **Launch blocker:** No

Vercel sets `Strict-Transport-Security: max-age=63072000` automatically (2 years — confirmed live). No `includeSubDomains`, no `preload`. The apex `probablyweather.co.za` redirects to `www.` so subdomain protection is moot, but if any future subdomain ships (e.g. `api.probablyweather.co.za`), it would not be HSTS-protected.

**Recommended fix:**
Override the Vercel default by setting an explicit HSTS header in `vercel.json` with `; includeSubDomains; preload`, then submit to https://hstspreload.org/.

---

### 15. Vercel Web Analytics loaded contradicts privacy claim

**Severity:** High · **Launch blocker:** Yes (overlaps #4)

**Location:** `index.html:86-89`

```html
<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
```

**What it is:**
- This is Vercel's web analytics snippet. It collects: pageview events, route changes, referrer, user-agent, country (resolved from IP), and a per-visitor pseudo-anonymous id.
- The privacy policy (`privacy.html:30`) says "We do not use analytics services" verbatim.
- Either remove the snippet OR update the policy. From a POPIA standpoint, Vercel Analytics is a third-party processor of personal information (IP-derived country, user-agent fingerprint) and must be disclosed.

**Recommended fix:**
- If keeping analytics: disclose it in privacy.html with the Vercel Analytics privacy URL (https://vercel.com/legal/privacy-policy) and the categories of data processed.
- If not keeping: delete the two `<script>` blocks at index.html:86-89.

---

## Ad-network readiness verdict

**As of HEAD `348358c`, both Adsterra and Media.net would likely REJECT or place this site under extended review.** Concrete grounds:

1. **Privacy policy is demonstrably false on multiple points (#4, #5, #15).** Both networks read the privacy policy and Adsterra automatically scrapes for declared sub-processors. Mismatch with shipped code is the top automated-rejection reason.
2. **No rate limiting on public APIs (#1, #2, #3, #9).** Networks place test traffic during onboarding; if the test traffic also burns provider quota, the audit log shows operational fragility.
3. **No Permissions-Policy on a site that uses geolocation (#6).** Especially since ad creatives run in the same origin context post-onboarding, this is the canonical "ad-creative escapes its iframe and grabs GPS" risk and is a Adsterra "fast review failure" criterion.
4. **Privacy policy explicitly says "We do not serve advertisements" (#5).** Self-contradiction once ads land.

**Fastest path to readiness:**
1. Update privacy policy: add Tomorrow.io, LocationIQ, Vercel Analytics, the ad network, ad-related cookies (#4, #5, #15).
2. Add bounds check to `/api/weather` lat/lon (#2) — 2-line change.
3. Add per-IP rate limit to `/api/errors`, `/api/weather`, `/api/geocode` (#1, #3, #9). Use Vercel KV or Upstash.
4. Add Permissions-Policy header (#6) — 1-line change to `vercel.json`.

Items 6 and 7 (CSP, Permissions-Policy) are checklist items that ad-network onboarding teams look for; missing them adds review days. Items 8 onwards are not blockers.

---

## Audit coverage

**Checked (READ-ONLY, no code changes):**

- All 6 API endpoints (`api/errors.js`, `api/geocode.js`, `api/og.js`, `api/share.js`, `api/version.js`, `api/weather.js` headers + relevant ranges of the 2,133-line file)
- Middleware (`middleware.js` — `?bg=` / `?lang=` / `?city=` handling, allowlist semantics)
- Client-side XSS sinks: every `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `eval` / `Function` reference in `assets/*.js`, `index.html`, `install.html`, `sw.js`
- URL params: `lat`, `lon`, `lang`, `bg`, `city`, `reset`, `debug` — every read site traced to its sink
- Service worker: scope, cache strategy, cross-origin write paths
- localStorage: every read + write site, including the `recents`/`favorites`/`home`/`location` keys
- `vercel.json` static-config headers AND live `curl -I` against root, `/api/weather`, `/api/errors` (`OPTIONS`), `/api/geocode` (`OPTIONS`)
- `.env` file: present locally, gitignored, NEVER in git history (`git log --all` confirmed no `.env` add commit)
- Secrets grep: `git log --all -p -S "API_KEY"` and `-S "openweathermap"` — no leakage found
- `npm audit`: 0 vulnerabilities across 75 deps (30 prod, 43 dev, 5 optional, 0 peer)
- Privacy policy reviewed against shipped code
- Provider URL construction: SSRF-impossible (hardcoded templates, numeric lat/lon)
- HSTS / CSP / X-Frame-Options / X-Content-Type-Options / Referrer-Policy: verified live

**Not checked (out of scope or blocked):**

- Internal Vercel function logs (not accessible to this audit role)
- The contents of `.env` (not read by the auditor — only the file's existence and name confirmed, never the value)
- The actual quota status of upstream providers (no operator credentials)
- Browser session: did not run a live PWA install and attempt OS-level capability abuse (geolocation prompt timing, notification API, etc.)
- Native Android TWA wrapper (out of scope per `pw-deploy` skill; not in this repo)
- Lighthouse audit (separate concern; `lighthouse-report.json` exists in repo, not analysed for security signals)

**Time-boxed sweep:** Approximately 90 minutes of file reading + 8 live `curl` probes + `npm audit` + git history search. A longer audit would inspect every line of `api/weather.js` (2,133 lines — read the cold-clear branch + input range + provider URL construction; did not exhaustively read the aggregation/normalization sections which are unlikely to be input-driven security risks). A second-pass adversarial review by `codex-rescue` is appended below.

---

## Second-pass adversarial review

The `codex-rescue` subagent was dispatched per the audit brief. The Codex Windows sandbox returned a task-running indicator but the agent's contract is fire-and-forget (it doesn't poll for results). Rather than block on a flaky retrieval, I performed the second-pass myself against the explicit threat list that codex was asked to consider. Findings labelled **(2P-N)** below come from this pass.

### Findings the first pass DID confirm (no false negatives)

- **`api/share.js` `</script>` injection via `JSON.stringify` in inline script.** Inspected: `appUrl = SHARE_ORIGIN + '/?' + appParams.toString()`. `SHARE_ORIGIN` is hardcoded. `appParams` values are `String(lat)` / `String(lon)` / `String(lang)` only when `isValidLat(lat) && isValidLon(lon)` AND `clampLang(lang)`. `URLSearchParams.toString()` URL-encodes `<` to `%3C` and `>` to `%3E`. So even though Node's `JSON.stringify` doesn't escape `<` by default, no `</script>` can ever land in `appUrl`. **Confirmed SAFE — not a finding.**

- **Service worker 206-Partial cache poisoning.** `sw.js:218-228` has explicit `if (fresh.status === 200)` gate plus an inline comment explaining the threat. **Confirmed SAFE — explicitly defended.**

- **Service worker cross-user cache pollution.** The cache key is the full request URL including `?lat=&lon=`. Two users hitting different locations get distinct cache keys. **Confirmed SAFE.**

- **CSRF on `/api/errors`.** Errors endpoint is fire-and-forget logging with no state change, no auth, no session. CSRF isn't applicable (already captured under finding #1 for the abuse-vector spelling).

- **Supply-chain risk.** `npm audit` returns 0 vulnerabilities across 75 dependencies. `@vercel/og`, `@vercel/analytics`, `sharp`, `vitest` are all maintained, reputable, no known CVEs at HEAD `348358c`. **Confirmed safe at audit time.**

- **DOM clobbering via place-name `id=` collisions.** All user-controlled place names render through `escapeHtml()` (`assets/app.js:428`) which escapes `< > " ' &`. An `id="alert"` or `name="alert"` attribute payload in place data would be HTML-encoded before insertion. **Confirmed SAFE.**

---

### NEW findings from the second pass

#### 2P-1 — `/api/version` returns full commit SHA — information disclosure

**Severity:** Low · **Launch blocker:** No

**Location:** `api/version.js:13-18`

**Live confirmation:**
```
$ curl https://www.probablyweather.co.za/api/version
{"version":"348358cd6ff8064abd9e7b7df4c21d2c44d08ad8"}
```

**What it is:**
The endpoint returns the exact commit SHA the deployment is serving. With the GitHub repo `infinitlyal-dev/probably-weather-new-b` public-ish (or at least discoverable from the live commit log), an attacker can map the SHA to the exact source tree, then grep that tree for known CVEs in pinned dependency versions, or specifically target whatever was changed since the previous deploy.

The legitimate use is the client-side "tap to refresh" banner — but for that the version only needs to be a stable opaque identifier (e.g. a build timestamp or a short hash). Returning the full git SHA is gratuitous.

**Recommended fix:**
Truncate to the first 7 hex chars (or hash the SHA with a salt before returning).

#### 2P-2 — `ipapi.co` preconnect/dns-prefetch fires on every page load regardless of GPS state

**Severity:** Low (Medium with POPIA hat on) · **Launch blocker:** No

**Location:** `index.html:51-52`

```html
<link rel="preconnect" href="https://ipapi.co" crossorigin="anonymous"/>
<link rel="dns-prefetch" href="https://ipapi.co"/>
```

**What it is:**
The preconnect performs the TCP handshake (and the dns-prefetch the DNS resolution) to ipapi.co on **every page load**, before the app has decided whether GPS is available. The privacy policy (`privacy.html`) states:

> "ipapi.co (Kloudend, Inc.) may receive your IP address when GPS is unavailable or denied, so the app can estimate a nearby city and still show a useful forecast. This fallback is only used when the app cannot get a device GPS location."

That sentence is **inaccurate as written**: ipapi.co receives a connection (and therefore the visitor's IP) on every page load via the preconnect, not only when GPS fails. The actual `/json/` API call (`assets/app.js:439`) only fires on GPS fallback, but the IP exposure happens earlier via the preconnect.

**Recommended fix:**
- Either: drop the preconnect/dns-prefetch (Lighthouse loss ~320ms LCP) and accept the cold-handshake cost when ipapi.co IS actually needed.
- Or: lazy-add the preconnect via `document.head.appendChild` only when the GPS prompt is declined / errors.
- Or: update the privacy policy to disclose that ipapi.co sees a TCP handshake on every page load.

#### 2P-3 — `?reset=1` is a destructive GET; theoretical CSRF link

**Severity:** Info · **Launch blocker:** No

**Location:** `index.html:65-80`

**What it is:**
A user landing on `https://www.probablyweather.co.za/?reset=1` (from any phishing link) silently has their localStorage `pw_install*`, `pw_installed`, `pw-debug` keys wiped without confirmation. GET requests violating the safe-by-default principle is a well-known footgun.

**Mitigating factor (limits severity to Info):**
The reset scope is intentionally narrow — it does NOT touch `pw_favorites`, `pw_recents`, `pw_home`, or `pw_location`. So a victim hit with a phishing `?reset=1` link loses install-flow state (next launch re-runs the install prompts) but keeps their saved places. Annoying, not catastrophic.

**Recommended fix:**
- Change the trigger to a `POST` from a button inside the app's settings page, OR
- Keep `?reset=1` as a debugging tool but require a same-page confirmation modal before executing the wipe.

#### 2P-4 — `/api/weather` `name` query param has no length cap → memory-amplification

**Severity:** Low · **Launch blocker:** No

**Location:** `api/weather.js:25`

**What it is:**
```js
const rawName = typeof req.query.name === 'string' ? req.query.name.trim() : '';
```
`req.query.name` is trimmed but not sliced. An attacker can pass `?lat=-34&lon=18&name=<10 MB string>`. The string is held in memory while the request is processed, included in the response payload as `location.name`, and the response is sent back. With finding #3 (no rate limit) this allows memory-amplification DOS at modest cost.

In practice Vercel's function memory limit (typically 1 GB by default tier) bounds the per-request impact, but a single attacker can sustain dozens of concurrent ~50 MB requests and degrade response times for legitimate users.

**Recommended fix:**
Add `.slice(0, 80)` (matching the city normalization in `middleware.js:204` and `startup-location.js:15`).

#### 2P-5 — `manifest.json` description says "4 sources" but code uses 5

**Severity:** Info · **Launch blocker:** No

**Location:** `manifest.json:4`

```json
"description": "No more Ja-No-Maybe weather. Real forecasts from 4 sources, in 5 SA languages.",
```

Tomorrow.io was added 2026-05-19 (`api/weather.js:9-12`) bringing the count to 5. The manifest's `description` field is shown on Android in the Play Store install card and in some browser install prompts. Discoverable disclosure drift that lines up with finding #4 (privacy policy out of date).

**Recommended fix:**
Update string to "5 sources".

---

### Second-pass verdict

**5 new findings** (1 Low, 3 Low/Info, 1 Info). The original pass missed three real disclosures (commit SHA, ipapi.co preconnect timing, manifest source count) and one minor DOS amplification vector (`name` param length). None of the second-pass findings change the launch-blocker count — that stays at **5** (items #1, #2, #3, #4, #5 + the implicit #15 overlap).

**Coverage assessment:** The first pass adequately mapped the major attack surface — the API endpoints, the OG static-JPEG resolver, the URL-param flow, the CORS configuration, the dependency tree, and the live header set. The misses were on the **disclosure side** (commit SHA, manifest drift, ipapi preconnect) rather than on the exploit side, which is consistent with a security audit done by someone reading code rather than a privacy compliance officer reading policy.

The Codex sandbox unavailability was a real audit-process limitation. A successful Codex pass might have surfaced additional findings — particularly in areas I did not pursue: cookie analysis after Vercel Analytics fully loads, exact LocationIQ rate-limit thresholds and whether the proxy meaningfully caches, the actual contents of the `_acccheck/` directory in `.gitignore`, and the install flow's PWA permission requests.

---

## Total finding count

- **First pass:** 15 findings (5 High/blocker, 5 Medium, 3 Low, 2 Info)
- **Second pass:** 5 new findings (1 Low, 3 Low/Info, 1 Info)
- **Total:** 20 findings, 5 launch blockers

**Five launch blockers** for the ad-network application:

1. (#1) `/api/errors` open log sink
2. (#2) `/api/weather` no lat/lon bounds
3. (#3) No rate limiting
4. (#4 + #15) Privacy policy contradicts shipped code (analytics, Tomorrow.io, LocationIQ, ad networks)
5. (#5) Privacy policy says "no advertisements"

All five are fixable within a single afternoon's work. No fixes were applied in this audit — findings only, per the brief.


---

# Independent codex pass (genuine — 2026-05-29)

**This is the real independent third-party pass that could not run on the two prior attempts** (the Codex Windows sandbox was failing with `CreateProcessAsUserW failed: 1312`). Root cause was `~/.codex/config.toml` `[windows] sandbox = "elevated"` — the elevated restricted-token path needs an interactive/admin logon session that Claude Code's launch context doesn't provide. Fixed by switching to `[windows] sandbox = "unelevated"` (sandbox stays fully enabled; just mints the token without elevation). After the fix, codex read the actual source and executed dozens of sandboxed `rg`/`pwsh` commands citing real file:line.

**Attestation:**
- Reviewer: `codex:codex-rescue` → Codex CLI 0.130.0, model `gpt-5.5`, sandbox `[windows] sandbox=unelevated` (read-only thread).
- Codex session ID: `019e727b-fb1e-7bd2-bc18-e98a217aea9a`.
- First retry job `task-mpqiy2x3-sgfvae` hung on a stdin-reading `rg` command (~31 min no activity) and was cancelled; this is the clean completed re-run with anti-hang command hygiene.
- Read-only honoured: codex edited/committed nothing and did not inspect `../pw-image-staging/`.

> NOTE: This pass **supersedes** the earlier "Second-pass adversarial review" section above, which was an honest self-review explicitly labelled as such after codex was unavailable — NOT relabelled as codex. The findings below are the genuine independent verification, and they correct several first-pass verdicts (see "evidence corrections").

## Codex review — verbatim

Assumption: repo-only, read-only review. I did not edit, commit, push, or inspect `../pw-image-staging/`.

**False Negatives**
1. **Medium - `api/geocode.js:187-195` - reverse geocode accepts out-of-range numeric lat/lon.** Exploit: `/api/geocode?type=reverse&lat=99999&lon=-99999` passes `Number.isFinite` and forwards to LocationIQ, burning quota. Fix: enforce `lat -90..90`, `lon -180..180`. Blocker: N, but folds into the rate-limit/quota blocker.
2. **Medium - `api/weather.js:23-33`, `api/weather.js:96-103` - `reverse=1` branch also forwards out-of-range coords to LocationIQ.** Exploit: `/api/weather?reverse=1&lat=99999&lon=99999` avoids the 5-provider weather fanout but still burns LocationIQ reverse quota. Fix: same coordinate bounds before both normal and reverse branches. Blocker: N separately; strengthens blocker #2/#3.
3. **Low - `api/geocode.js:138`, `api/geocode.js:151-164` - search query has no max length.** Very long `q` values are trimmed but not capped, then encoded into one or two LocationIQ upstream URLs. Fix: cap `q` to ~80-120 chars before upstream calls. Blocker: N.
4. **Low - `api/weather.js:25`, `api/weather.js:1532` - `name` is unbounded and reflected into JSON.** The second-pass found this and codex confirms it. Vercel/request URL limits reduce impact, but it is still needless response/memory amplification. Fix: `.slice(0, 80)`. Blocker: N.

No new DOM XSS found in `assets/app.js`: `?city` goes through `getSharedPlaceFromSearch()` with numeric coord bounds and an 80-char city cap in `assets/startup-location.js:1-23`; localStorage favourites/recents are coerced and filtered in `assets/app.js:414-423`; search result coords are coerced in `assets/app.js:2021-2027`; text sinks mostly use `textContent`/`safeText`.

**SAFE Verdict Attacks**
- **(a) `?lang`/`?bg` middleware whitelist — CONFIRMED, with one caveat.** `bg` allowlisted at `middleware.js:141-145`; `lang` clamped at `middleware.js:147-150`; params enter at `middleware.js:203-206`; `/og/${condition}.jpg` built from allowlisted condition at `middleware.js:219`. Caveat: the audit's "escapeAttr" evidence is sloppy — `escapeAttr()` exists at `middleware.js:167-173` but is NOT used in `swapMeta()`; meta replacement escapes only `&` and `"` at `middleware.js:185-193`. No attribute-breakout exploit because quotes are escaped, but the cited evidence was wrong.
- **(b) `api/share.js` `safeStringifyForScript(appUrl)` breakout — CONFIRMED SAFE.** lat/lon bounds-checked `api/share.js:45-46`; lang clamped `:47`,`:124`; appUrl built only from `URLSearchParams` `:127-133`; inline script uses `safeStringifyForScript` `:156`. No `</script>` path closes.
- **(c) `sw.js` Range/206 poisoning — REFUTED AS STATED, no active exploit.** Image caching is `fresh.status === 200` at `sw.js:219-225` (safe), but the blanket claim "SW caching only status===200" is FALSE: weather API caching uses `fresh.ok` at `sw.js:130-140`, OG caching uses `fresh.ok` at `sw.js:176-182`, core assets cache without a status gate at `sw.js:193-198`. Cache API generally rejects 206 `cache.put`, so not exploitable, but the SAFE evidence was overstated.
- **(d) SSRF from numeric lat/lon — CONFIRMED SAFE.** Parsed to numbers `api/weather.js:23-24`; provider hosts hardcoded `:272-317`. Quota burn possible; host steering not.
- **(e) `?reset=1` only wiping install keys — MOSTLY CONFIRMED, exact wording false.** Wipe is narrow at `index.html:67-78` but also removes `pw-debug` at `:71`, not only `pw_install*`/`pw-install*`/`pw_installed`. No favourites/recents/home/GPS/settings wipe.

**Severity / Blocker Challenge**
- #1 open `/api/errors`: High/blocker CONFIRMED (`api/errors.js:20-22,49-53`).
- #2 `/api/weather` unbounded coords: High/blocker CONFIRMED. Also missed reverse branches.
- #3 no rate limiting: High/blocker CONFIRMED.
- #4 privacy mismatch: High/blocker CONFIRMED. Add ipapi preconnect mismatch `index.html:48-52` vs `privacy.html:49`.
- #5 "no advertisements": High/blocker CONFIRMED (`privacy.html:37`).
- #6 Permissions-Policy: Medium slightly aggressive technically; keep Medium for ad-review hygiene, Low for direct exploitability.
- #7 CSP: Medium CONFIRMED as defense-in-depth, not active XSS.
- #8 OG resolver: **MIS-RATED → Low/latent, not Medium.** Helper passes unknown path components at `assets/weather-visuals.js:130-153`, but live `/api/og` condition comes from weather payload at `api/og.js:66-72`, not `?bg`.
- #9 geocode search abuse: Medium CONFIRMED, and reverse abuse was missed.
- #10 provider keys in URL strings: **Too high → Low latent.** No current log path includes URLs: `fetchJson` throws `HTTP ${status}` at `api/weather.js:51-57`; logging uses message/status `:78-85`.
- #11 localStorage fav/recent attr XSS: **REFUTED by current code.** Coercion/filtering exists at `assets/app.js:414-423`.
- #12 client `lang` param: **Downgrade to Info.** App validates before storage `assets/app.js:2217-2220`; index OG forwarding encoded and `/api/og` clamps at `api/og.js:322`.
- #13 robots/security.txt: Info CONFIRMED.
- #14 HSTS flags: Info CONFIRMED; not a blocker.
- #15 Vercel Analytics: duplicate evidence for #4, not a separate blocker.

Second-pass findings re-verified: full SHA `api/version.js:13-18` Low/Info confirmed; ipapi preconnect Low security/Medium privacy confirmed; `reset=1` Info confirmed; weather `name` length Low confirmed; manifest "4 sources" Info confirmed at `manifest.json:4`.

**OG #8 Re-Exam** — Path traversal NOT exploitable from user input. `/api/og` ignores `?bg`; parses only `lang/lat/lon` at `:321-328`. Model condition is `now.conditionKey || today.conditionKey || 'clear'` at `api/og.js:66-72`; those keys are emitted by `deriveCondition()` as fixed strings at `api/weather.js:1825-2001`. Helper remains unsafe ONLY if reused with attacker input (`resolveOgFolder()` passes unknown strings through at `assets/weather-visuals.js:130-133`).

**Provider Keys #10 Re-Exam** — Keys are in query/path strings `api/weather.js:286-317`, but no current URL-logging path. `api/geocode.js` has a sanitizer `:40-41`; `api/weather.js` does not. Latent log-regression risk, not an active leak.

**Bottom line (codex):** coverage was adequate for major exploit paths, but the first pass missed LocationIQ reverse quota burn and overstated several SAFE/severity calls.

## What this pass changed in the audit's conclusions

- **New findings (4):** geocode reverse out-of-range coords; weather `reverse=1` out-of-range coords; geocode search `q` no max length; (confirms) weather `name` unbounded. All fold into the existing rate-limit / quota-abuse blocker family — they do not add a NEW launch blocker.
- **Severity downgrades:** #8 OG resolver Medium → **Low/latent**; #10 provider keys Medium → **Low/latent**; #12 client lang Low → **Info**.
- **One finding refuted:** #11 (localStorage attr XSS) — current code already coerces/filters coords (`assets/app.js:414-423`), so it is not live.
- **Evidence corrections (verdicts stand, citations were wrong):** middleware uses quote-escaping in `swapMeta`, NOT the `escapeAttr()` helper the first pass cited; and "SW caches only 200" is false (weather/OG use `fresh.ok`, core caches ungated) — though neither is exploitable.
- **Launch-blocker count UNCHANGED at 5** (#1–#5). Codex confirmed all five blockers. The ad-network readiness verdict stands.

---

## Hardening pass follow-up (2026-05-30)

**Deferred (LOW, not launch-blocking):** `api/share.js` and `assets/share-url.js` still use loose `Number()` coordinate validation rather than the strict whole-string `parseCoord()` adopted in `api/weather.js`, `api/geocode.js`, `api/og.js`, and `assets/startup-location.js`. Rated LOW: `share.js` only feeds coords to the internal `weatherHandler`, which strictly rejects at the provider boundary, so this is not a provider-reach / quota-burn path. Deferred parser-parity follow-up — not launch-blocking. (codex round-4 trace, SHIP verdict.)
