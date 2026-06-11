# SA3 — Share + OG + Privacy Ship Notes

Branch: `feat/pre-tester-3-share`
Worktree: `pw-sa3-share/`
Author: SA3 subagent
Date: 2026-05-12

## What shipped

A complete share-preview path that does not depend on the dynamic
`/api/og` endpoint:

1. **Static per-condition OG images** at `/og/<condition>.jpg` (1200×630 JPEG, all <300KB).
2. **Vercel Edge middleware** at repo root that swaps OG meta tags on `GET /` when `?bg=<condition>` is present.
3. **Updated share URL builder** so the in-app Share button now produces a root-level URL carrying `?bg=`, `?city=`, `?lat=`, `?lon=`, `?lang=`.
4. **Branded multi-lang share message** in `T.misc.shareMessage` + `T.misc.shareYourArea` for all 5 supported languages.
5. **POPIA-aware privacy policy update** (jurisdiction, user rights, share-link disclosure).
6. **Service worker cache version** bumped to `pw-v2026-05-12-003`.

The existing dynamic `/api/og` and `/api/share` paths are untouched and
remain the richest preview when `lat/lon` are known. The new static path
is a fast, no-API fallback that always works.

## Files added

- `og/clear.jpg`, `og/cloudy.jpg`, `og/cold.jpg`, `og/fog.jpg`, `og/heat.jpg`, `og/rain.jpg`, `og/storm.jpg`, `og/wind.jpg`, `og/default.jpg`, `og/uv.jpg`, `og/rain-possible.jpg` — 11 static OG images
- `middleware.js` — Vercel Edge middleware
- `tools/build-og-images.mjs` — one-shot script to regenerate the static OG images from source backgrounds (uses `sharp`)
- `tests/share-bg-middleware.test.js` — new test suite (14 cases)
- `SHARE_OG_NOTES.md` — this file

## Files changed

- `assets/share-url.js` — `buildShareUrl` now emits root-level `?bg=`/`?city=` URLs; new exported helper `normalizeShareCondition`
- `assets/app.js` — Share-button handler uses the branded multi-lang `shareMessage` template; `T.misc.shareMessage` and `T.misc.shareYourArea` added
- `tests/pre-resubmission-tier-1.test.js` — share-text test rewritten for the branded template
- `vercel.json` — cache header for `/og/*.jpg` (1-week browser, 30-day CDN)
- `privacy.html` — POPIA glance, hosting/jurisdiction, user rights, share-link disclosure
- `sw.js` — cache version bumped to `pw-v2026-05-12-003`
- `package.json` (devDependencies) — `sharp` added (was already installed at the system level; pinned now via lockfile)

## OG image source mapping

| OG slug          | Source file                              | Size    |
|------------------|------------------------------------------|---------|
| `clear.jpg`      | `assets/images/bg/clear/day_1.jpg`       | 100 KB  |
| `cloudy.jpg`     | `assets/images/bg/cloudy/day_1.jpg`      |  57 KB  |
| `cold.jpg`       | `assets/images/bg/cold/day_1.jpg`        |  48 KB  |
| `fog.jpg`        | `assets/images/bg/fog/day_1.jpg`         |  19 KB  |
| `heat.jpg`       | `assets/images/bg/heat/day_1.jpg`        |  70 KB  |
| `rain.jpg`       | `assets/images/bg/rain/day_1.jpg`        | 186 KB  |
| `storm.jpg`      | `assets/images/bg/storm/day_1.jpg`       |  58 KB  |
| `wind.jpg`       | `assets/images/bg/wind/day_1.jpg`        |  86 KB  |
| `default.jpg`    | same as `clear.jpg`                      | 100 KB  |
| `uv.jpg`         | alias-copy of `clear.jpg`                | 100 KB  |
| `rain-possible.jpg` | alias-copy of `cloudy.jpg`            |  57 KB  |

To regenerate: `node tools/build-og-images.mjs`

## Middleware contract

- Runtime: Vercel Edge (`runtime: 'edge'`)
- Matcher: `'/'` only (does NOT process other paths)
- Method: only `GET` requests for `/` or `/index.html`
- Trigger: only when `?bg=` is present in the URL (root with no `?bg=` falls through to upstream untouched, preserving the existing inline OG runtime script in `index.html`)
- Validation: `?bg=` is lowercased and must match the 11-slug allowlist; invalid → silently coerced to `clear`
- City: `?city=` is trimmed and capped at 80 chars; missing is fine
- Rewrites the following meta tags inline in the upstream HTML:
  - `<meta property="og:image">` → `/og/<bg>.jpg`
  - `<meta name="twitter:image">` → same
  - `<meta property="og:url">` → canonical root URL with `?bg=` and optional `?city=`
  - `<meta property="og:title">` / `<meta name="twitter:title">` → per-condition branded title
  - `<meta property="og:description">` / `<meta name="twitter:description">` / `<meta name="description">` → per-condition description, prefixed with city when present
- Adds `x-pw-share-bg` response header for debugging
- Cache: `public, max-age=300, s-maxage=300` (5 min, matches existing share path)

## Share-copy native review

EN and AF are author-confirmed.

ZU, XH, ST translations of the new `shareMessage` template were composed
in-house following the patterns already established in `weather-copy.js`
and the existing `T` bank. They are functional and respectful but should
get a **light native-speaker pass** before TV-level release:

- ZU: `"Bheka isimo sezulu e-{city} — isimo sezulu saseNingizimu Afrika ngolimi lwakho: {url}"`
- XH: `"Jonga imozulu e-{city} — imozulu yaseMzantsi Afrika ngolwimi lwakho: {url}"`
- ST: `"Sheba boemo ba leholimo {city} — boemo ba leholimo ba Afrika Borwa ka puo ya hao: {url}"`

Specific items for native review:
- ZU/XH locative prefix `e-` before `{city}` works for most place names but reads awkwardly for some (e.g. `e-iThekwini` is technically right; `e-Strand` reads colloquially as `e-Strand`).
- ST `{city}` is bare without a prefix to mirror existing ST patterns in `T.misc.shareIn` (`"ho"`), which is sometimes elided.

These can be polished by SA5 (UI-copy specialist) without touching middleware or OG.

## Privacy policy diff (POPIA)

Added four blocks:

1. **POPIA at a glance** (intro section). Restates "no PII" plain and clearly under POPIA's definition.
2. **Hosting and cross-border processing**. Names Vercel (US), references POPIA section 72 on cross-border transfer, links Vercel's privacy policy.
3. **Your rights under POPIA**. Enumerates access/correction/deletion/objection/complaint, with the Information Regulator's contact details.
4. **Share links and the share preview**. Explains what is and isn't encoded in a share URL (coords, lang, condition slug, public city name — no PII).

Date stamp updated to 12 May 2026. No existing language was removed.

## Test coverage

`tests/share-bg-middleware.test.js` covers:

- Static OG image existence + size cap for all 11 slugs
- `normalizeShareCondition` for known conditions, aliases (`partly-cloudy`/`hail`/`thunder`/`night`), and unknowns
- `buildShareUrl` shape: includes `?bg=`, optional `?city=`, optional `lat/lon`, always `lang`
- Middleware config (edge runtime, root matcher only)
- Middleware allowlist parity with `share-url.js`
- `swapMeta` helper (replacement scope + escaping)
- End-to-end rewrite via mocked `fetch`: storm gets `/og/storm.jpg`, unknown→`clear`, missing `?bg=` passes through untouched

`tests/pre-resubmission-tier-1.test.js` (existing): share-text test updated to assert the new branded `shareMessage` template structure. The localized `probably` / `shareIn` vocabularies remain present and tested for any downstream use.

All other existing tests pass unchanged: 23 files, 347 tests green.

## SW bump

`sw.js:6` → `pw-v2026-05-12-003`. Forces refresh of cached `index.html`
so new clients pick up the meta tags the middleware rewrites and the
new share-button copy in `assets/app.js`.

## Blockers / uncertainty

- **Middleware not exercised against a live Vercel deployment in this worktree.** The unit tests cover the rewrite logic against a mocked `fetch`. The first Vercel preview deploy should be eyeballed in Facebook/WhatsApp/Slack debuggers before merging to main:
  - https://developers.facebook.com/tools/debug/?q=https://probably-weather-new-b-git-feat-pre-tester-3-share-...vercel.app/?bg=storm&city=Strand
- **The dynamic `/api/og` path is unchanged.** If lat/lon are present, the existing `index.html` inline runtime script still rewrites og:image to `/api/og?...` on page load. For crawlers that don't execute JS, the middleware-injected static image is what they will index — which is the correct fallback behavior.
- **`/share` legacy route still exists in `vercel.json`.** Left intact for back-compat with any historical share URLs already in the wild. New share URLs go to root with `?bg=` instead.

## Constraints respected

- Static-only except for the one new edge middleware file (`middleware.js`)
- City is optional everywhere — missing does not break URL or middleware
- ZU/XH/ST flagged for SA5 native pass (not edited beyond initial draft)
- No PR merge attempted
