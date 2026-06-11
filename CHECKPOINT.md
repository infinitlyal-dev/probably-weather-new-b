# Checkpoint: Full read-only evaluation — code audit, design opinion, optimisation report
**Generated:** 2026-06-11 (SAST)
**Task:** Full read-only evaluation of Probably Weather at HEAD 2931d9f. No code changes, no commits, no pushes. Report only.
**Skills Used:** supervisor (this checkpoint). Specialist domain knowledge from pw-weather-logic / pw-deploy / pw-ui-copy applied as context; no file-modifying skills used (read-only task).

## What Was Done
- Confirmed HEAD = 2931d9f, working tree as reported (1 modified test, untracked docs/screenshots).
- Ran the full test suite twice (4,636 tests) + a third isolated run to separate deterministic failures from flakes.
- Personally read in full: assets/app.js (2,597 lines), sw.js, index.html, assets/first-open-location.js, home-name.js, startup-location.js, image-picker.js, weather-copy.js (copy banks + weekend filter), api/_lib/rate-limit.js, api/_lib/limiters.js, key sections of api/weather.js and api/share.js, app.css (sampled).
- Dispatched 4 parallel read-only agents: backend deep audit, consistency/fragility sweep, dead-code sweep, test-suite quality review. Verified their headline claims against source before publishing.
- Screenshot-audited production (www.probablyweather.co.za) at 390×844 via Playwright: home (en + st), weekly, search, language menu, install banner state, with bounding-box layout verification.
- Verified production info-disclosure live (HTTP HEAD against /tests/*.test.js).

## Files Changed
| File | Action | What Changed |
|------|--------|-------------|
| CHECKPOINT.md | Created | This report. **No other file touched. Nothing committed or pushed (read-only run per task spec — supervisor commit protocol intentionally suspended).** |

## Decisions Made
- Decision: Report "no BLOCKER" despite a serious rate-limit flaw.
  - Why: nothing found takes production down today; the worst items degrade silently. Inflating severity would damage trust in the rest of the list.
  - Alternative considered: marking the shared rate-limit bucket BLOCKER (the backend agent did); downgraded to HIGH after verifying it fails soft (share cards degrade to static copy, not errors).
- Decision: Diagnose the two known bugs as **residual holes in already-shipped fixes** (a624c2e, ac6ced5), not as unfixed bugs.
  - Why: both fix commits exist at HEAD; the production symptoms are explained by gaps the fixes left open (detailed under H1/M2 below).
- Decision: Deepen the parked "buildLocationName coords-seed" item.
  - Why: new information found — the API echoes junk names back, which means the a624c2e heal can never repair a coords-seeded home. That converts a parked cosmetic seed into the active root cause of known bug (a).
- Decision: Verified agent findings before publishing; dropped one (Tomorrow.io errors "masked") because api/weather.js logSourceFailure already classifies 401/403/429.

---

# THE REPORT

**Scope:** HEAD 2931d9f. Severity order: BLOCKER / HIGH / MEDIUM / LOW / OPINION. Each finding: file:line + one-line proposed fix. Nothing implemented.

**Test suite:** 4,636 tests, **4,634 pass / 2 fail deterministically** (both in tests/offline-fallback.test.js — stale assertions against the pre-SWR service worker). Two additional tests are **flaky under the full parallel run only** (tests/api-input-hardening.test.js "rejects lat just past the pole", tests/image-picker.test.js "handles NaN / non-finite gracefully" — both pass in isolation). The committed tree is red: commit 2931d9f shipped without updating offline-fallback, and ecdfe11 changed a Sotho string whose matching test fix sits uncommitted in the working tree.

## BLOCKER
None. Nothing found that takes production down today. The two HIGH clusters below degrade silently, which is arguably worse for detection.

## HIGH

**H1 — Known bug (a) root cause: GPS-name heal can never receive a clean name (server/client placeholder mismatch + echo-back).** Independently found: YES.
- Chain of events: the first-open speed fix (2feed57) persists `{name:'My Location'}` to STORAGE.home synchronously ([assets/app.js:2296-2306](assets/app.js:2296)) and relies on render-time healing. Healing has exactly two paths: (1) the placeholder self-heal ([assets/app.js:1629-1631](assets/app.js:1629)) which calls client-side `/api/geocode`, and (2) the a624c2e heal `shouldPersistHomeName` ([assets/app.js:1625-1628](assets/app.js:1625), [assets/home-name.js:40-45](assets/home-name.js:40)) which needs `norm.locationName` to be a *real* name.
- The hole: [api/weather.js:79-83](api/weather.js:79) treats only `/^unknown/i` as a placeholder. `name=My Location` and coords-shaped names (`34.1°S, 18.8°E`) are **not** placeholders to the server, so the LocationIQ resolution block (line 171) is skipped and the junk name is **echoed back** as `location.name` (line 1604). Result: `shouldPersistHomeName` never fires (placeholder or `isCoordsName` rejects the echoed name), and the entire heal hangs on one client `/api/geocode` call — silent-null on failure, 5s timeout, rate-limited.
- Once a coords-shaped name is seeded (see H2 for how), **no path ever heals it**: it isn't a placeholder (no client re-geocode), and the API echoes it back (no server name). It is permanently stuck — exactly the production symptom.
- Fix: extend the api/weather.js placeholder predicate to also match `/^my location/i` and the coords shape (reuse home-name.js's `COORDS_NAME_RE`), so the weather response always carries a server-resolved name and the a624c2e heal closes the loop.

**H2 — Three reverse-geocode fetches missing `resp.ok` checks are the coords-seed trigger.**
- [assets/app.js:2148](assets/app.js:2148) (getCurrentLocation), [assets/app.js:2367](assets/app.js:2367) (attemptRefresh), [assets/app.js:2465](assets/app.js:2465) (applyWatchedMove) all call `await rev.json()` with no `rev.ok` check. A 429 from the new per-IP rate limiter (47b1883) or any 5xx throws → the catch falls through → `buildLocationName` coords fallback ([assets/app.js:2098-2107](assets/app.js:2098)) or the hardcoded `°S/°E` string at line 2161 → **persisted to STORAGE.home**. Note the timing: the rate limiter landed *after* the first-open speed fix, and first-open fires weather + reverse + geocode calls in a burst — this is the most plausible mechanism for the "next-day open after fresh install" regression. Combined with H1, the seed never heals.
- Fix: check `rev.ok` before `.json()` and treat non-OK as "keep previous name, retry later" — never seed coords into storage.

**H3 — All share/OG internal weather calls share one rate-limit bucket ('0.0.0.0').**
- [api/share.js:65-92](api/share.js:65) and api/og.js build a synthetic `req = { query: {...} }` with **no headers**; inside weatherHandler, `getClientIp` ([api/_lib/rate-limit.js:16-27](api/_lib/rate-limit.js:16)) falls through to `'0.0.0.0'`. Every share-card and OG-image weather lookup worldwide shares a single 60/min sliding window ([api/_lib/limiters.js:23](api/_lib/limiters.js:23)). Under modest aggregate traffic (WhatsApp link-preview crawlers count), the bucket saturates and share cards silently degrade to the static description — and one attacker can force that state cheaply. Fails soft, so nobody will notice it happening.
- Fix: thread the original request's client IP into the synthetic req (`headers: { 'x-real-ip': getClientIp(originalReq) }`), or bypass the limiter for trusted internal calls.

**H4 — Install banner completely covers the home CTA row on mobile.**
- Verified with live bounding boxes at 390×844: banner region y=694–760 sits exactly over ↗ Share (y=712), → Hourly (y=710), ☆ Save (y=712). The engagement gate is 1.5s ([assets/install.js:18](assets/install.js:18)), so on a first visit the banner appears before the user has touched anything and blocks all three primary actions — including Hourly, the designated ad-screen entry point.
- Fix: anchor the banner above the CTA row (or below the nav), or raise the engagement gate so it fires after first interaction.

**H5 — Committed test debt: red suite at HEAD.**
- [tests/offline-fallback.test.js:56](tests/offline-fallback.test.js:56) (2 tests) still asserts the v14 network-first shape (`catch { caches.match(req) }`) that 2931d9f replaced with stale-while-revalidate — pushed red, violating the "never commit broken code" working rule. The [tests/cloud-partly-cloudy.test.js](tests/cloud-partly-cloudy.test.js) fix for the ecdfe11 Sotho string change is sitting **uncommitted** — the committed tree fails it. Two further tests flake only under the parallel full run (api-input-hardening, image-picker) — likely cross-file interference worth a `test.sequential` or worker-isolation look.
- Fix: update offline-fallback assertions to the SWR contract, commit the cloud-partly-cloudy edit, then chase the two flakes.

## MEDIUM

**M1 — SWR app shell never matches share-link navigations; CORE_CACHE grows unbounded.**
- [sw.js:214-243](sw.js:214): `cache.match(req)` for a navigation to `/?lat=…&lon=…&lang=af` misses the precached `/` (no `ignoreSearch`), so share links never get the instant cached paint (the entire point of the v15 change), AND line 220 `cache.put(req,…)` stores every distinct share URL as a new permanent CORE_CACHE entry (no trim on that cache).
- Fix: `cache.match(req, { ignoreSearch: true })` for navigations and write back under the canonical `/index.html` key.

**M2 — Known bug (b) diagnosis + residual: weekend witty on the wrong day.** Independently found: YES (as residual).
- Historical root cause: one weekend pool served Sat/Sun/Fri-evening ([assets/app.js:1100-1107](assets/app.js:1100)) and the day-named line (index 19, "Saturday energy" / "Saterdagenergie" / "…Mgqibelo" / "…Moqebelo") could fire on any of them. Fixed in ac6ced5 via `filterWeekendPoolForDay` ([assets/weather-copy.js:273-293](assets/weather-copy.js:273)) — verified correct at HEAD in all 5 languages, including post-Sesotho-review strings.
- Residual hole: `getLocationDayOfWeek` ([assets/app.js:1189-1198](assets/app.js:1189)) trusts `utcOffsetSeconds` from the API, and [api/weather.js:233-243](api/weather.js:233) silently defaults the offset to **UTC** when Open-Meteo, Pirate AND WeatherAPI all fail to supply one. With offset 0, SA Sunday 00:00–01:59 computes as *Saturday* → the Saturday line can legitimately fire on a Sunday morning (and night/dawn image bucketing shifts 2h). The test suite never exercises this path with real Dates (tests/weekend-witty-day.test.js only tests the filter in isolation).
- Fix: when `utcOffsetSource === 'default-utc'`, derive the offset from a coordinate-based timezone guess (SA bounding box → +7200) instead of 0; add a real-Date timezone test.

**M3 — The entire test suite is publicly served on production.**
- Verified live: `https://www.probablyweather.co.za/tests/home-name.test.js` → HTTP 200. `.vercelignore` excludes `*.md`, `tools/`, `scripts/` but not `tests/` — same info-disclosure class as audit-2026-05-31 FIX 1 (test files document internals, bug history, and rate-limit thresholds).
- Fix: add `tests/` (and `eval/` once committed) to [.vercelignore](.vercelignore).

**M4 — Heat thresholds disagree across layers.** Badge "Hot" fires at ≥32°C (`THRESH.HOT_C`, [assets/app.js:85](assets/app.js:85), [1165](assets/app.js:1165)); the API's `heat` condition fires at ≥35°C (api/weather.js:2016). The 32–34°C band shows a Hot badge with non-heat hero/copy. Fix: align both on one constant.

**M5 — Hourly weight double-normalization.** [api/weather.js:1020] rounds recomputed hourly weights to 2dp, then `resolveWeights` re-normalizes — small unintended drift after a boost fires. Fix: drop the rounding, let resolveWeights normalize once.

**M6 — LOW_WEIGHTS ignores dynamic weight adjustments.** [api/weather.js:1047] hardcodes MET=0.10 for daily lows but inherits *adjusted* values for other slots — asymmetric high/low source ratios whenever the ECMWF dedup or MET boost fires. Fix: rebuild LOW_WEIGHTS explicitly after adjustment with a stated intent.

**M7 — CGNAT vs per-IP 60/min.** SA mobile carriers NAT thousands of users behind shared IPs; `x-real-ip` is the NAT IP. One busy carrier IP can hit the 60/min weather cap organically — and every 429 on `?reverse=1` feeds the H2 coords-seed. Each search also fires up to ~8 full weather calls (miniFetchTemp, [assets/app.js:2059](assets/app.js:2059)) against the same budget. Fix: raise the weather cap / use a burstier window, and make rate-limited reverse lookups non-destructive (H2).

**M8 — Share/OG weather failures are swallowed unlogged** ([api/share.js:119 area]) — degradation to STATIC_DESCRIPTION is invisible to the operator. Fix: one `console.error` with lat/lon before falling back.

## LOW

- **L1 Dead exports:** `pickSearchResultEmoji` ([assets/weather-emoji.js:80]), `getOgBackgroundPath` + `getOgBackgroundFallbackChain` ([assets/weather-visuals.js:78,95] — tested-only, the WebP OG chain api/og.js doesn't use), `'hot'` emoji entry ([assets/weather-emoji.js:33] — API only emits `heat`). Fix: delete (and their tests).
- **L2 Duplicated logic:** `parseCoord` ×4 (api/weather.js:33, api/geocode.js:24, api/og.js:50, assets/startup-location.js:10); `SUPPORTED_LANGS` ×3 (assets/language-preferences.js:1, api/og.js:18, api/share.js:6). Drift risk only. Fix: single shared module where runtime allows; otherwise a sync-comment in each.
- **L3 Footer is stale and untranslated:** [index.html:330] hardcodes 4 sources (no Tomorrow.io) and is never touched by `updateUILanguage`; the Settings About fallback ([index.html:309]) is also 4-source (healed at runtime). Fix: add footer to the i18n pass or drop the source list from it.
- **L4 'Viewing shared location' indicator untranslated** ([assets/app.js:790]). Fix: move to T.misc.
- **L5 sw.js default branch can respondWith(undefined)** ([sw.js:268-270]) when both network and cache miss. Fix: `|| Response.error()`.
- **L6 "Version 1.4" hardcoded** ([index.html:310]) while /api/version reports git SHA. Fix: drop or wire to version endpoint.
- **L7 Three CSS variables for one nav height** (`--nav-h`, `--bottom-nav-h`, `--bottom-nav-height`, [assets/app.css:1708-1715]) plus two generations of panel-layout vars — patched-not-designed layout debt. Fix: consolidate in a cleanup pass.
- **L8 resolveWeights 1/0 fragility** ([api/weather.js:1031]) — latent Infinity if the conditional structure ever changes. Fix: guard `count > 0`.
- **L9 Repo clutter:** 30+ root .md notes and mc-*.png MyChannel screenshots committed to the weather repo (deploy-excluded, but they don't belong here). Fix: move notes to docs/, delete foreign screenshots.

## PERFORMANCE (critical path)

- **P1 LCP is gated on the weather API.** `#bgImg` has `fetchpriority=high` but gets no `src` until the API responds and renderHome picks a condition — on cold loads the largest paint waits for a 5-source ensemble. Fix: paint last-known/default background immediately (cached condition from localStorage), swap when fresh data lands.
- **P2 ~350 KB unminified JS, ~430 KB with CSS, no build step.** app.js 155 KB + weather-copy.js 121 KB (all 5 languages shipped to every user; one is needed) + install.js 47 KB (loaded eagerly, needed rarely). Gzip mitigates transfer but parse cost on low-end SA Androids is real. Fix: an esbuild minify step and a per-language dynamic import of the copy bank would roughly halve the payload without changing the no-framework architecture.
- **P3 Nothing actively fights the new SWR shell** except M1 (share-link query-string miss). The 60s `registration.update()` poll + 5-min version poll + visibilitychange checks are three overlapping update channels — cheap (304s), but consolidation would simplify.
- **P4 Two client cache layers for weather** (IndexedDB 30-min in app.js + SW API_CACHE 3h) with different TTLs — works, but it's complexity that will bite during debugging. Note only.

## PART 2 — DESIGN / UI OPINION (390×844, production, en + st)

What works: the **voice is the product** and it survives translation — "Mohlomong 12°/17°" with "Leholimo ha le qeta. Le rona." is genuinely charming. The gold-on-photograph hero with heavy text shadow is distinctive and owns the brand colour. The weekly panel (dark glass, day badges, clean columns) is the most professional screen in the app. Real SA photography keeps it out of AI-gradient-slop territory.

What's weak — in order of how much it cheapens the product:
1. **Emoji as the entire iconography system.** 🌧️⛅☀️ in hourly rows, weekly rows, search minis. Emoji render differently per platform, carry no brand, and read "MVP". This is the single loudest "unpolished" tell. A 12-glyph custom icon set would lift every data screen at once.
2. **No typographic identity.** Everything is `-apple-system/Segoe UI/Roboto`. The hero gets its character from colour and shadow, not type. One licensed display face for the brand title + hero numerals would be transformative; right now the type says "default".
3. **Type scale chaos.** Dozens of ad-hoc sizes from 0.55rem to 4rem, with comments like "~11px to prevent cutoff by bottom nav" — the layout has been patched, not designed. A 6-step scale would expose how many of these are accidents.
4. **The install banner experience** (H4): fires 1.5s into a first visit, covers all three CTAs, "Not now" is low-contrast. Aggressive *and* self-defeating — it blocks the Hourly pill that monetisation depends on.
5. **The permanent tagline row.** "No more Ja-No-Maybe weather. Just Probably." occupies a header line on every screen forever, and stays English in all five languages. Great line — say it once (first open, install screen, share card), not permanently.
6. **The floating byline.** Wind/Rain/UV text floats bottom-right over the photo with no container; legibility is entirely shadow-dependent and it reads unanchored — the one element on home that looks accidental.
7. **Terminology drift:** nav says "Weekly", panel says "7-Day"; nav is five plain text labels with no icons, cramped at 390px.
8. **The ad placeholder** inside the weekly list is a large dim box with a joke in it. Pre-approval it reads as broken UI. Collapse the slot until a real ad exists.
9. **Background-vs-condition storytelling:** the rain-possible backdrop (rugby field, blue-ish sky) doesn't say "rain possible" — the condition-to-image promise breaks down in the in-between buckets, where most days live. The scrim + 0.5-black panels also mute the photography everywhere except home.
10. **Language switcher:** functional listbox, native-language names (good), but the trigger says "Language" instead of showing current state ("EN"), and the menu is a bare grey dropdown on an otherwise branded app.

Net: voice 9/10, layout system 6/10, iconography 4/10, overall polish 6/10. It reads "indie PWA with a great personality", not broadcast-grade. The gap is closable with one focused pass: icon set + type face + type scale + banner placement.

## PART 3 — STRUCTURAL, BEFORE 10k DAU

1. **Server-side weather cache keyed on rounded coords — required, not optional.** The quota math fails first: Pirate Weather free tier is 20k/month; 10k DAU × ~3 opens/day ≈ 900k ensemble calls/month (≈ 4.5M upstream calls across 5 sources). Vercel edge `s-maxage=300` only dedupes *exact* lat/lon strings — GPS users never collide. Snap the cache key to ~0.02° (~2 km) in the API and one Redis/edge entry serves a whole suburb for 5 minutes. This single change cuts upstream fan-out by 2-3 orders of magnitude in cities and is the difference between "free tiers hold" and "Pirate dies in week one". (Upstash Redis is already provisioned for rate limiting — reuse it.)
2. **Search minis shouldn't run the full ensemble.** Each search result row fires a 5-source aggregation for a temperature + emoji ([assets/app.js:2059]). A `?lite=1` single-source (Open-Meteo) path, or serving minis from the rounded-coords cache, removes the most expensive per-keystroke cost.
3. **Rate-limiter posture** (H3 + M7): fix the internal-call bucket, then rethink per-IP for CGNAT — e.g. 120/min with burst, or key on IP+coarse-UA. Keep fail-open.
4. **Bundle:** minify via esbuild in CI (no architecture change), dynamic-import the language copy bank per active language (saves ~95 KB raw for the 80%+ of users on one language), lazy-load install.js on idle.
5. **Image delivery:** the 1,008-image rotation space on Vercel CDN is fine at 10k DAU; verify `Cache-Control: immutable, max-age=31536000` on /assets/images/** in vercel.json (week-folder paths are stable per batch) and keep individual WebPs under ~250 KB at 1920w.
6. **ipapi.co free tier (30k/month)** is the silent first-open dependency; at 10k DAU growth it will throttle and the fallback is Johannesburg-for-everyone. Move IP-geo server-side (Vercel's `x-vercel-ip-*` headers are free and already on every request) — removes the third-party call entirely and the preconnect.
7. **Observability:** /api/errors → Vercel logs is fine today; at 10k DAU add sampling and a dashboard (or Sentry free tier), and alert on the `[pw-source-fail]` quota-shaped tags — those are the early warning for #1.
8. **Ship hygiene:** stop serving tests/ (M3); restore the suite to green and make it a push gate (H5).

## TOP 5 — FIX THESE FIRST
1. **Close the GPS-coords loop (H1+H2):** add `resp.ok` checks on the three reverse-geocode fetches and teach api/weather.js to resolve 'My Location'/coords-shaped names server-side. Kills known bug (a) permanently instead of probabilistically.
2. **Fix the shared '0.0.0.0' rate-limit bucket (H3):** pass the real client IP into og/share internal weather calls — share cards are the app's growth loop and they silently break under load right now.
3. **Move the install banner off the CTA row (H4):** it currently blocks Share/Hourly/Save — including the planned ad entry point — for every new visitor.
4. **Restore green tests (H5):** update offline-fallback to the SWR contract, commit the cloud-partly-cloudy fix, then de-flake the two parallel-run failures. A red baseline hides every future regression.
5. **Server-side rounded-coords weather cache (Part 3 #1):** the Pirate Weather/WeatherAPI quota math breaks well before 10k DAU without it; everything else about scaling is secondary.

## Issues Found
(Choosing the report-level highlights for the architect's queue — full detail above.)
- Issue: a624c2e and ac6ced5 both shipped real fixes with residual holes; symptoms will recur intermittently until H1/H2/M2 land. Severity: IMPORTANT. Status: NEEDS ARCHITECT INPUT (fix order proposed above).
- Issue: production serves the full test suite. Severity: IMPORTANT. Status: DEFERRED (one-line .vercelignore fix, needs a deploy).
- Issue: committed tree fails 3+ tests. Severity: IMPORTANT. Status: NEEDS ARCHITECT INPUT (test edits, then push).

## Blockers
None. Task completed read-only as specified.

## Quality Checklist
- [x] Supervisor skill loaded and followed (this checkpoint)
- [x] HEAD verified 2931d9f before starting
- [x] No code changes, no commits, no pushes (per task spec — supervisor commit protocol suspended for read-only run)
- [x] Excluded items honoured (Sesotho tjhesa/mohodi, Gap B/D/E; coords-seed deepened only with new information)
- [x] Both known bugs independently found and root-caused
- [x] Test suite run (3×) with pass/fail and flake analysis
- [ ] Changes committed/pushed — N/A, read-only run

## Next Steps
- Architect to triage the Top-5 and assign fix sessions (suggested: one session for H1+H2 together — they're one bug; one for H3+M8; one for H4; one for H5; Part 3 #1 as its own design-then-build).
- The Cinderella-style design pass (icon set + type face + scale + banner placement) is a separate creative session — Part 2 list is the brief.

---
# Checkpoint: Full backend/wiring fix session — Groups 0–7 (9 commits, pushed)
**Generated:** 2026-06-11 (SAST)
**Task:** Execute the fix groups from the 2026-06-11 evaluation (above). Sequenced atomic commits, suite green after every group, push at the end. Excluded per spec: H4 banner placement, Honor OEM install flow, anything Sesotho, L7 CSS variable consolidation.
**Skills Used:** supervisor (this checkpoint). pw-weather-logic / pw-deploy / pw-ui-copy domain context applied throughout.

## Per-commit map (2931d9f → 67b9004)
| # | SHA | Group | What it does |
|---|-----|-------|--------------|
| 1 | 3c9a46e | 0 (H5) | Green baseline: offline-fallback tests moved to the v15 SWR contract; image-picker's `getRotationWeek(undefined)` assert was DATE-DEPENDENT (broke when rotation entered week_2 on 2026-06-06 — not a parallel flake); api-input-hardening's 90/180 boundary test made network-free (it fanned out to live providers and blew the 5s vitest timeout under load — that was the real "flake"); stranded cloud-partly-cloudy st-string fix committed. |
| 2 | 7d4b190 | 1a | Static splash: PW logo + "Probably loading…" cycling en/af/zu/xh/st, pure HTML/CSS in the shell, visible from first paint, removed on first real render (renderHome/renderError). |
| 3 | 65a45f6 | 1b | Black-screen fixes: #bgImg ships a static default src + inline pw_last_bg upgrade; new /api/locate replaces ipapi.co (Vercel x-vercel-ip-* headers, 1dp rounding, private/no-store, 8 tests); loadAndRender starts the network fetch before the IndexedDB await. |
| 4 | 8e19da9 | 2 | H1 server placeholder predicate (+My Location/Shared location/coords shape) so junk names are never echoed back; H2 resp.ok on 3 reverse-geocode sites + buildLocationName never emits coords; H3 real client IP threaded into share/OG synthetic requests; M2 coord-estimate UTC fallback + real-Date SA Sunday-boundary test; M3 tests/+eval/ vercelignored. |
| 5 | 8e1827a | 3 | M4 shared heat thresholds (assets/weather-thresholds.js; THRESH.HOT_C 32→35); M5 hourly-weight double-normalisation removed; M6 LOW_WEIGHTS rebuilt from base weights (dedup carries, MET high-boost doesn't); M7 CGNAT caps (weather 60→480, geocode 60→240/min); M8 [pw-share-fail]/[pw-og-fail] logging. |
| 6 | a2b9bf3 | 4 | M1 SW ignoreSearch + canonical write-back (share links get the instant SWR paint; CORE_CACHE stops accumulating share-URL variants); L5 catch-all can never respondWith(undefined). |
| 7 | a494863 | 5 | Rounded-coords (0.02°≈2.2 km) server ensemble cache on the existing Upstash Redis, 5-min TTL, fail-open, hit path skips LocationIQ + all 5 providers, search minis ride it; per-request name + localHour rebuilt on hit; 17 tests. |
| 8 | b54fa96 | 6 | Build pipeline: esbuild per-file minify into dist/ (554→367 KB, −34% pre-gzip), buildCommand/outputDirectory in vercel.json, sw-asset existence check fails the build if a precache path is missing; per-language copy banks (checked-in generated assets/copy/<lang>.js, 23–46 KB each vs the 121 KB monolith, drift-gated by test); lazy install.js with the error boundary preserved. Source tree remains fully runnable with zero build. |
| 9 | 67b9004 | 7 | Dead exports deleted; parseCoord ×4 → assets/coord-parse.js; SUPPORTED_LANGS ×3 → language-preferences.js; footer 5-source + translated; "Viewing shared location" translated; APP_VERSION single source (1.4→1.5); resolveWeights 1/0 guard; 28 root notes + lighthouse json → docs/notes/, mc-*.png → MyChannel folder. |

## Black-screen timing evidence (Group 1 diagnosis, required by spec)
Measured on production (cold profile: storage/IDB/SW/caches wiped, fast desktop link):
- shell HTML/CSS/JS: done at ~0.2s
- **GPS grace timer: ipapi call only STARTS at T+1206ms** (1s deliberate grace — kept, privacy posture)
- **ipapi.co: 402ms best-case** (third-party handshake; 5s timeout worst case, and ipapi throttles hard behind SA carrier NAT — the big mobile variable)
- **/api/weather: 32ms on edge-cache hit; 730–1129ms measured on forced cache misses** (3 random coords)
- **bg image: starts only after weather returns; 359ms desktop** (1–3s on mobile radio for a ~200–400 KB webp)
Every step was strictly serial and #bgImg had NO src until the final step → on mobile radio with a throttled ipapi and a cache-miss ensemble, 8–10s of black screen is exactly what this chain produces. Fixes: paint default/last-known background at shell parse (kills the visual black screen outright), /api/locate removes the third-party leg, fetch/IDB parallelised. The splash floors whatever remains. Returning users additionally skip ipapi entirely (saved home) and now skip the IDB serialisation.

## Decisions Made
- Decision: keep the 1s GPS grace timer. Why: it encodes the privacy posture "IP lookup only when GPS is slow/blocked" — eliminating it would hit /api/locate for every fast-GPS user. The splash + instant background make the 1s invisible.
- Decision: splash cycles all five languages (1.8s each, EN first) instead of picking one. Why: the static shell can't know the language pre-JS, and a tiny inline localStorage reader would violate the zero-JS requirement; prefers-reduced-motion shows EN statically. Alternative considered: en-only line (rejected — the 5-language identity IS the brand).
- Decision: H3 threads the real client IP rather than bypassing the limiter for internal calls. Why: /api/share and /api/og are themselves unauthenticated entry points into the 5-provider fan-out; a bypass would reopen the quota-burn hole through crafted share URLs.
- Decision: M4 sets the client fallback to the EXTREME rung (35) rather than aligning down to 30. Why: the client numeric rungs are fallbacks behind the server conditionKey; the server verdict should win everywhere below extreme instead of being second-guessed in the 32–34 band.
- Decision: M7 sizes weather at 480/min/IP. Why: per-IP on SA mobile means per carrier NAT gateway; ~40 plausible concurrent users × ~8 search-mini calls in a burst minute clears 300; a single-machine script still trips it. Ceilings, not targets — Upstash cost scales with requests, not cap size.
- Decision: server cache key snaps to 0.02° (~2.2 km) with per-request name override on hit. Why: collapses a suburb into one entry (the provider quota math demands it) while a caller-supplied real place name is never replaced by a neighbour's; placeholder callers accept the populator's name — same tolerance the 1dp IP-locate path already accepts. localHour recomputed on hit so hour boundaries inside the TTL can't skew hourly slicing.
- Decision: per-language copy files are GENERATED but CHECKED IN. Why: the source tree must stay runnable with zero build (tests, vercel dev, static preview); drift is gated by tests/copy-splits.test.js and the build regenerates before packaging. weather-copy.js stays the single reviewable source of truth and becomes server-side-only.
- Decision: no CACHE_VERSION bump for the precache list changes. Why: the new SW byte-diff re-runs install, and addAll writes the new files into the existing cache; bumping would force a needless full re-download of all 24 precached assets (the v15 header documents this policy).
- Decision: APP_VERSION bumped 1.4 → 1.5. Why: splash + per-language bundles + server cache + the GPS-name fix is a user-visible release; flag to Al if he wants different numbering.

## PROVISIONAL strings pending native review (flagged per spec)
- Splash (index.html): zu "Cishe iyalayisha…", xh "Mhlawumbi iyalayisha…", st "Mohlomong e a jarolla…" (en "Probably loading…", af "Waarskynlik besig om te laai…" are ship-ready).
- T.misc.viewingShared: zu "Ubuka indawo eyabelwane ngayo", xh "Ujonge indawo ekwabelwene ngayo", st "O sheba sebaka se arolelanoeng".
- T.misc.dataFrom zu/xh/st are derived from the already-native-reviewed sources.attribution strings — low risk, but include in the next zu-qc/xh-qc/st-qc pass anyway.

## Issues Found
- Issue: the "flaky" image-picker test was actually a date-bomb (week-2 rollover), not parallel interference. Severity: MINOR (fixed). Status: FIXED — but note the pattern: any test asserting a default-`Date.now()` path will rot.
- Issue: deploys now REQUIRE the build to succeed (vercel.json buildCommand). First deploy after push should be watched: if the Vercel build container surprises us (npm install of esbuild, 177 MB image copy), the rollback is reverting b54fa96 + 67b9004's vercel.json lines. Severity: IMPORTANT (operational). Status: NEEDS ARCHITECT/AL ATTENTION on first deploy.
- Issue: /api/locate returns ok:false under vercel dev (no x-vercel-ip-* headers locally) → local first-opens fall back to Johannesburg. Severity: MINOR (local-dev only). Status: DEFERRED (documented in api/locate.js).
- Issue: server cache means a name resolved by one caller can serve a neighbour ≤2.2 km away for placeholder callers. Severity: MINOR (within existing IP-locate tolerance). Status: ACCEPTED (documented).

## Blockers
None. All gates passed: suite green after every group (final: 132 files / 4,663 tests), node --check clean on all 33 touched JS files, dist build verified (sw-asset check 25 paths OK; module graph, copy banks, lazy install, splash lifecycle smoke-tested on the built output via Playwright).

## Quality Checklist
- [x] Supervisor loaded; checkpoint appended (this entry)
- [x] HEAD verified 2931d9f before starting
- [x] Suite green after every group; per-group commit; nothing pushed until all groups passed
- [x] Exclusions honoured (H4, Honor flow, Sesotho strings, L7)
- [x] Black-screen diagnosis evidence captured before fixing (above)
- [x] Provisional zu/xh/st strings flagged
- [x] All changes committed (9 commits) and pushed to main (checkpoint commit last)

## Next Steps
- Watch the first Vercel deploy (new build pipeline) — verify www serves minified assets and /api/locate returns real coords in production.
- Queue zu-qc / xh-qc / st-qc passes for the provisional strings.
- H4 (install banner over the CTA row) remains open by design — feeds the upcoming front-end pass with L7.

---
# Checkpoint: Adversarial self-review of session 2931d9f..4eba23c (findings only, no code changes)
**Generated:** 2026-06-11 (SAST)
**Task:** Adversarial review of the 9-commit backend/wiring session, via codex-rescue (standing discipline). No code changes. Scope: git diff 2931d9f..4eba23c.
**Skills Used:** supervisor (this checkpoint); codex:rescue + codex:setup (attempted — see Tooling note).

## TOOLING NOTE — codex-rescue could not run; substituted independent subagents
- `codex:rescue` failed: Codex CLI is installed (v0.130.0) but **not authenticated**, and `~/.codex/config.toml:5` has a parse error (`unknown variant 'default', expected 'fast' or 'flex'`). Authentication needs an interactive `codex login` (browser/device flow) that cannot be completed autonomously.
- Per the prompt's hard rule (never let codex-rescue fetch the wrong repo on Windows), I had already generated the diff + full high-risk file contents LOCALLY and embedded them in two payload files (REVIEW_PAYLOAD_A/B.md, since deleted). Nothing was ever fetched.
- Substitute: two fresh-context general-purpose subagents ran the adversarial passes against those local payloads, plus my own independent verification of the headline findings (Node probes of snapCoord; grep traces of the import graph, build gate, splash failsafe; manual trace of the cache→persistence chain). When `codex login` is completed, re-running through Codex specifically is a one-command follow-up.
- ACTION FOR AL: run `codex login` (and fix the `default` profile in `~/.codex/config.toml`) if you want the Codex engine itself on future reviews.

## FINDINGS (severity-ordered)

### HIGH-1 — The 480/min weather cap is defeated by coordinate variation AND coupled to the limiter's own fail-open; one IP can exhaust Pirate Weather's monthly free tier in ~42 minutes.
**Files:** `api/_lib/limiters.js:23` (`weather: { max: 480 }`), `api/_lib/weather-cache.js` (`weatherCacheKey` derives the key from caller coords), `api/weather.js:182-183` (cache lookup), shared `getRedis()` `api/_lib/limiters.js:31`.
- The 60→480 raise was justified by "the rounded-coords cache protects the 5-provider fan-out." **False against any adversary**: the cache key is `weatherCacheKey(lat, lon)` and the caller controls lat/lon. Incrementing lon by 0.02° each request yields a fresh key → guaranteed miss → full fan-out every request. The cache only ever helps organic clustering; it gives zero adversarial protection.
- Quota math (binding constraint = Pirate Weather, 1 call per uncached request, 20,000 calls/**month** free tier): one IP at the cap = 480 Pirate calls/min → **20000 / 480 ≈ 42 min** for a single IP (no spoofing, no botnet) to burn the whole month and take Pirate offline app-wide. Total upstream burn 480 × 5 = 2,400 provider calls/min/IP. The raise multiplied single-IP burn capacity ~8× (60/min was ~5.5h).
- **Fail-open coupling:** the limiter and the cache share ONE Redis client. On an Upstash outage / missing env (`limiters.js:35` → null → `rate-limit.js:42` allows everything; `weather-cache.js` → permanent miss), the 480 ceiling vanishes at the *same instant* the cache vanishes → unbounded fan-out from one IP. Even with zero attackers, the comment's own organic scenario (≈320 req/min behind a busy carrier NAT) becomes all-misses across several carrier IPs → organic quota death.
- Pass A rated this BLOCKER; I rate it HIGH (availability/quota DoS on a free weather app, not RCE) — but it undercuts the central justification for the whole Group-3 limiter change. Note for fix session: a low per-IP weather cap, a Redis-independent global/provider budget guard, or per-provider call accounting that sheds Pirate before exhaustion.

### HIGH-2 — The splash has no failsafe dismissal; any throw in app.js init leaves the full-screen #1a1a2e splash stuck forever — the black screen, recolored.
**Files:** `index.html:62-90` (CSS — only `.splash-done` hides it; no `window.load`/`setTimeout`/CSS auto-hide), `assets/app.js:31` (entire init is one `DOMContentLoaded` handler), `:1606` (`hideSplash` only called by `renderHome`/`renderError`), `:2323` (`loadSettings()` runs before any render).
- `#pwSplash` is opaque, `inset:0`, `z-index:2147483000`, and is removed ONLY when app.js adds `.splash-done`. There is no independent failsafe. If init throws before the first render lands — corrupt `localStorage` JSON in `loadSettings`, a throw in `applySettings`, or any uncaught error on the first-open path (the no-`homePlace`/no-`savedLoc` branch) — the splash outlives the broken boot permanently, with no device console to diagnose it.
- This is the exact permanent-blank failure the session set out to kill (and the project's own history of "silent throws from install.js caused unexplained iPhone regressions" makes an init throw realistic). `install.js` is wrapped in an error boundary; the main app.js init shown is not. Verified independently: single DOMContentLoaded handler, no failsafe, settings load pre-render.

### HIGH-3 — Server cache poisons the location label cross-user AND the poisoned name is persisted into a stranger's STORAGE.home.
**Files:** `api/weather.js:1677` (miss path caches `name: resolvedName || name` — `name` is the caller-supplied `&name=`, capped 120 but arbitrary), `:200` (hit path serves `(!isPlaceholder && name) || cachedPayload.location?.name` — placeholder callers get the cached string), `api/_lib/weather-cache.js` `weatherCacheSet` (only refuses non-ok; doesn't distinguish caller-supplied from server-resolved name), `assets/home-name.js:40` `shouldPersistHomeName`, `assets/app.js:1688` (renderHome persists).
- Exploit: attacker primes a cell `GET /api/weather?lat=X&lon=Y&name=<arbitrary>` (non-placeholder → stored verbatim). For 5 min, every *placeholder* caller in that ~2.2 km cell gets the attacker's string as their location label.
- **Reaches real users:** the H1 change made the GPS first-open name `'My Location'` a server-side placeholder, so a genuine first-open GPS user in a primed cell renders the attacker string. Rendering is `safeText`/textContent → **no XSS**, but it is attacker-controlled cross-user location text.
- **Persistence escalation (both agents underweighted this):** for that GPS user, `shouldPersistHomeName({locationName:"<attacker>", homePlace, activePlace})` passes every gate — the string is not a placeholder, not coords-shaped; homePlace/activePlace coords match (GPS home == active); name differs — so `renderHome` WRITES `homePlace.name = "<attacker>"` to `STORAGE.home`. It then sticks (it's non-placeholder, so the placeholder-heal won't fire either) until a later uncached resolve returns the real name. So it is not purely transient — it writes to storage. Low real-world blast radius (no auth/money, textContent), but a trivially reproducible cross-user integrity + privacy leak. The non-malicious version: one user's custom favourite name ("Mom's house") leaks to strangers in the same cell. Seam to fix: never serve cached `location.name` to a different caller — strip the caller-supplied name before caching, or always re-resolve per request.

### MEDIUM-1 — Cache amplifies the coords-name problem per-cell during a LocationIQ outage; contradicts "coords loop closed for good."
**Files:** `api/weather.js:200/1677` (coords echoed when `resolvedName` stays null), `weatherCacheSet` (caches the ok:true coords-named payload), `assets/home-name.js` `isCoordsName`, `assets/app.js:1688` heal.
- When LocationIQ is down/token missing/limited: a coords-shaped legacy name → `isPlaceholder` true → `resolvedName=null` → LocationIQ resolve fails → final `location.name` = the coords string. That ok:true payload is **cached for the whole cell**. For 5 min every placeholder caller in the cell gets the coords string — and `isCoordsName` → `shouldPersistHomeName` false (won't overwrite) AND `isPlaceholderName(coords)` false → the renderHome heal never fires, so **neither side heals it** during the window, even for callers whose own resolve would have succeeded. Not permanent (a later success heals), but the new cache amplified a transient per-request failure into a per-cell 5-minute one. Don't cache/echo a coords- or placeholder-shaped `location.name`.

### MEDIUM-2 — `pw_last_bg` inline upgrade swaps a guaranteed-good default for an unverified path with no onerror.
**Files:** `index.html` (inline `pw_last_bg` script, ~L854-865), `assets/app.js:1402` (persist).
- `bgImg` ships `src="assets/images/bg/default.jpg"` (always present); the inline script overwrites it with `localStorage.pw_last_bg` and attaches **no `onerror`**. A stale stored pick — image-set redeploy that renames/drops a webp, evicted IMG_CACHE while offline, cleared cache — blanks the background for the entire cold-open window (the 8-10s the feature exists to fix), worse than leaving default.jpg. Self-corrects only when `setBackgroundFor` later runs its own chain. (one-line `img.onerror` reset would close it.)

### MEDIUM-3 — Build regenerates copy banks into the source tree and tests aren't in the build command, so prod self-heals while the committed artifact / drift test / local preview can silently diverge.
**Files:** `scripts/build.mjs` (regenerates before packaging), `scripts/generate-copy-splits.mjs` (writes to `assets/copy/` source), `vercel.json` (`buildCommand: npm run build` only — no test step).
- Edit `weather-copy.js`, forget to regenerate, forget to run tests, push → Vercel regenerates and ships **correct** banks, but committed `assets/copy/*.js` stay stale and `tests/copy-splits.test.js` only fails if someone runs it. `vercel dev`, the python preview, and the checked-in artifact diverge from the source of truth with no deploy-time signal. Benign for prod users; the "drift gate" doesn't bite on the path that actually deploys.

### LOW-1 — Build's "every precache path exists in dist" gate silently skips extensionless paths.
**Files:** `scripts/build.mjs` (sw-asset check filters matches by `/\.(js|css|json|html)$/`).
- `/` and `/install` from CORE_ASSETS are never `statSync`'d (no extension). Currently safe (`/`→index.html is checked; `/install`→vercel rewrite, not a literal dist file), but the gate's guarantee is weaker than its comment — a future extensionless precache entry (e.g. `/offline`) that 404s would sail through and white-screen the offline shell, the exact failure the gate exists to prevent. Verified by Node probe: 25/25 extension paths covered, `/install` uncovered.

### LOW-2 — No build invariant guards client imports of the dist-deleted weather-copy.js.
**Files:** `scripts/build.mjs` (`rmSync dist/assets/weather-copy.js`).
- Current client graph is clean (verified: only `api/og.js` + `api/share.js` import it, both server-side; `offline-shell-modules.test.js` asserts app.js doesn't). But the only build invariant checks sw.js's precache list, not the import graph — a future `import … from './weather-copy.js'` in a client module 404s in prod silently (minifies & ships fine; missing file only surfaces at runtime).

### LOW-3 — `hot` emoji key deleted while CLAUDE.md still lists `hot` as a condition folder/alias.
**Files:** `assets/weather-emoji.js` (CONDITION_EMOJI_MAP, `hot` removed), `CLAUDE.md` (condition folder list).
- Hero/badge logic uses `heat`, so normally fine. If `api/weather` ever emits `conditionKey:'hot'`, the emoji falls through to the `clear` default (☀️/🌙) instead of 🔥. Low likelihood; the doc/code disagreement is the smell. (`pickSearchResultEmoji` removal is safe — not in app.js's import list.)

### LOW-4 — Splash overlays the skip-link during the load window (minor a11y).
**Files:** `index.html` (`#pwSplash` renders before `.skip-link`, pointer-events active, aria-hidden correct).
- A keyboard user tabbing during load focuses a visually-obscured skip-link. Brief and minor; `prefers-reduced-motion` is handled correctly.

## SAFE SURFACES — verified by both passes + my own checks (no action)
- **snapCoord precision / antimeridian / poles** (`weather-cache.js`): Node-probed — `toFixed(2)`+`+0` normalises `-0`; ±180/±90 give distinct well-formed keys (two entries for one physical meridian = harmless inefficiency, not collision/crash). No exploitable float path.
- **Cross-user EXACT-coord leak on hit path** (`weather.js:201`): `location.lat/lon` overwritten with caller B's own coords; `meta.localHour` recomputed. Caller A's exact coordinates are NOT re-served — only `location.name` leaks (HIGH-3).
- **/api/locate header spoofing** (`api/locate.js`): `x-vercel-ip-*` are edge-set; a forged header returns only to that same caller (`Cache-Control: private, no-store` blocks cross-user CDN caching) — a spoofer only fools themselves; seeds an approximate default, no trust impact.
- **/api/locate headers absent** → `{ok:false}`; client `getIPLocation` falls back to Johannesburg and never rejects → first-open coordinator can't strand the spinner. No crash.
- **decodeURIComponent on city**: try/catch falls back to raw value; cannot throw uncaught.
- **sw.js v16 ignoreSearch + canonical write-back** (Attack surface 5): SAFE. index.html is a static shell — coords/lang/og-meta come from `window.location.search` read live on each load. Caching a `/?lat=&lon=&lang=` navigation under bare `/` serves identical static bytes; no shared-location/language HTML leaks to a later plain-`/` visit. ignoreSearch collapses query only, not pathnames (`/install` vs `/install.html` stay distinct). `new Request(canonical)` is a default GET matching the navigations cached. Crawler share-scrapes hit `/api/share` (no SW), unaffected.
- **Catch-all default branch**: the `respondWith(undefined)` footgun is closed — cache miss returns explicit 504.
- **getClientIp threading into og.js/share.js**: correctly replaces the pooled `0.0.0.0` bucket via `x-real-ip` (the Vercel-overwritten trustworthy header, not appendable XFF). No new issue.
- **buildLocationName null handling**: every caller coalesces (`|| 'My Location'` / `|| displayName` / `|| 'Unknown'`); null never persisted as a value or the literal `"null"`.
- **Share-link entry**: shared place is PLACE_MODE_PINNED, NOT written to STORAGE.home; coords won't match the GPS home so shouldPersistHomeName can't clobber it. A hostile/empty `city` only affects the transient (textContent) view.
- **parseCoord / SUPPORTED_LANGS dedupe**: `startup-location.js`→`coord-parse.js` precached + covered by `dynamicModules` in offline-shell test; app.js imports SUPPORTED_LANGS from language-preferences.js. Resolves cleanly.
- **OG dead-code deletion**: getOgBackgroundPath/FallbackChain + their tests removed together; getOgStaticBackgroundPath (the one api/og.js uses) retained.

## Footnote — pre-existing, OUT of this diff's scope
- `API_CACHE` (sw.js) has no `trimCache` cap (unlike IMG_CACHE's 120) — each unique lat/lon `/api/weather` response is a permanent SW-cache entry; a user searching many cities grows it unbounded. Not introduced this session; flagged for a future pass.

## Issues Found (for the architect's queue)
- Issue: HIGH-1 quota/limiter design — the 480 raise is unsafe; the cache it relies on is adversary-bypassable and fails open with the limiter. Severity: CRITICAL. Status: NEEDS ARCHITECT INPUT (design — cap size vs provider budget guard).
- Issue: HIGH-2 splash failsafe — recreates the black-screen on any init throw. Severity: IMPORTANT. Status: NEEDS FIX (independent auto-dismiss).
- Issue: HIGH-3 cache name poisoning + persistence — cross-user label injection written to a stranger's home. Severity: IMPORTANT. Status: NEEDS FIX (don't cache caller-supplied name).
- Issue: MEDIUM-1/2/3 — coords-cell amplification, pw_last_bg no-onerror, build/source divergence. Severity: MINOR-IMPORTANT. Status: DEFERRED to a follow-up fix session.
- Issue: codex-rescue unauthenticated + config.toml parse error. Severity: MINOR (tooling). Status: NEEDS AL (codex login + config fix).

## Blockers
None for the review itself (completed via substitute reviewers + independent verification). codex-rescue engine itself was unavailable — flagged above.

## Quality Checklist
- [x] Supervisor loaded; checkpoint appended (this entry)
- [x] Scope = git diff 2931d9f..4eba23c; NO code changes made (findings only)
- [x] No repo fetched — diff + file contents embedded locally; payload files cleaned up after
- [x] codex-rescue attempted; unavailability flagged; substitute independent passes run
- [x] Sesotho tjhesa/chesa/mohodi/moholi forms treated as reviewer-approved (not findings)
- [x] Findings severity-ordered with file:line and reproduction
- [x] Headline findings independently re-verified (Node probes + manual traces), not just relayed

## Next Steps
- Fix session priority: HIGH-1 (limiter/budget) → HIGH-2 (splash failsafe) → HIGH-3 (cache name). HIGH-2 and HIGH-3 are small, contained edits; HIGH-1 is a design decision (cap vs Redis-independent provider budget).
- These findings are review output only — nothing was changed. A separate session should action them.

---
# Checkpoint: Fix session from the adversarial review (HIGH-1/2/3, MEDIUMs, LOWs)
**Generated:** 2026-06-12 (SAST)
**Task:** Action the findings from the adversarial self-review (commit 10cd039). Sequenced atomic commits, suite green after every group, push at end. Excluded: H4 banner placement, Honor OEM flow, anything Sesotho.
**Skills Used:** supervisor (this checkpoint).

## Per-commit map (base 4eba23c → HEAD)
| SHA | Group | What it does |
|-----|-------|--------------|
| `8c25fff` | 1 (HIGH-1) | Global per-provider call-budget guard (`api/_lib/provider-budget.js`), enforced before fetch, keyed per-provider; per-IP weather cap 480→240. |
| `890dbc1` | 2 (HIGH-2) | Splash failsafe — CSS 8s auto-hide + index.html window error/load handlers + app.js in-handler guard. |
| `73a8266` | — | Test hygiene: `vitest.config.js` excludes stale `.claude/worktrees/*` clones (made the gate deterministic). |
| `879eff6` | 3 (HIGH-3) | Cache stores/serves only the server-resolved name, never the caller's `&name=`; two pure helpers + 12 tests. Also closes M-i. |
| `ceaf338` | 4 (MEDIUM) | `pw_last_bg` onerror→default (M-ii); build regenerate→**verify**, hard-fails on stale banks (M-iii). |
| `8474cbc` | 5 (LOW) | Build gate covers rewrite paths (L-i) + weather-copy client-import guard (L-ii); CLAUDE.md folder list (L-iii); skip-link z-index over splash (L-iv). |

## HIGH-1 — the Pirate-quota math behind the provider ceiling
**Why the per-IP cap couldn't protect quota:** the weather cache key is derived from caller coordinates, so an attacker varying coords by 0.02°/request misses the cache every time → full 5-provider fan-out per request. At the old 480/min per-IP cap, one IP exhausts Pirate Weather's **20,000/MONTH** free tier in ~42 min; and an Upstash outage fails the per-IP limiter open too.

**Fix — protect quota directly, keyed per-provider (coordinate-varying can't bypass):**
- **fail CLOSED on quota** (never a call past the ceiling), **fail OPEN on availability** (Redis down → conservative per-instance ceiling, never unlimited).
- Ceilings = each provider's published free tier with margin. **Pirate is binding (20k/month):**
  - `20000 / 31 days ≈ 645/day` → **perDay 600** (max `600 × 31 = 18,600 < 20,000` → exhausting the monthly tier is now *structurally impossible*, regardless of attacker behaviour or coordinate variation).
  - `600 / 1440 min ≈ 0.42/min avg` → **perMin 20** (single-minute spike cap; was effectively unbounded at 480/min/IP).
  - Others: OM 600/min·10k/day, WA 200/min·30k/day, MET 300/min, Tomorrow.io 25/min·500/day — all their published free limits.
- A provider over ceiling is skipped (request→null, ensemble proceeds on the rest); all-exhausted falls through to the existing 503 → SW/client serves its own cache.

**Proposed new per-IP weather cap: 240/min (down from 480).** Reasoning: with quota now owned by the provider budget, the per-IP cap is *purely abuse-dampening* (stop one IP monopolising function concurrency/Redis) — it no longer needs the 480 it was raised to (which defended quota it couldn't actually defend, and was the HIGH-1 vector). 240/min ≈ 4 req/s sustained per IP stays CGNAT-generous: a busy carrier-NAT bucket's search-mini bursts (~8/search × concurrent users, mostly cache-served now) clear comfortably, while the single-IP flood surface halves vs 480. Matches the geocode cap. Could go lower, but 240 keeps margin for genuine CGNAT peaks now that quota risk is decoupled.

## Decisions Made
- **Decision:** add a per-DAY window for Pirate (and Tomorrow.io), not just per-minute. **Why:** a per-minute cap alone can't bound a 20k/MONTH tier for bursty traffic; the daily cap is what makes monthly exhaustion structurally impossible. **Alternative considered:** per-minute only (the literal ask) — rejected as insufficient for the binding constraint; documented the math.
- **Decision:** skip the budget guard under vitest on the *implicit default path* (sentinel-distinguished from explicit-null). **Why:** mocked-fetch unit tests have no real upstream calls, so the budget is meaningless and the conservative instance fallback (pirate 5/min) would trip across a test file's many frozen-time handler calls. The guard logic is unit-tested directly with an injected client+clock; explicit-null callers still exercise the real instance fallback. **Alternative considered:** raising instance ceilings to not trip tests — rejected (weakens real outage protection).
- **Decision:** splash failsafe lives primarily in **index.html**, not app.js. **Why:** it must survive app.js failing to *load/parse*, which an app.js-internal try/catch can't. Three independent layers (CSS / index.html JS / app.js guard) so no single failure mode keeps the splash up. **Alternative considered:** a try/finally wrapping app.js init — rejected: init kicks async render, so `finally` would hide the splash before data loads; and it wouldn't cover module-load failure.
- **Decision:** HIGH-3 caches only the server-resolved name; a non-placeholder caller's real name is NOT shared to the cell (cell caches 'Unknown', neighbours re-resolve). **Why:** "never cache or re-serve a caller-supplied name" is the only safe rule — even a real typed name is caller-supplied. Slightly less cache benefit (one extra client geocode for a placeholder neighbour) for a hard guarantee.
- **Decision:** build M-iii is regenerate-and-**verify** (hard-fail on drift), not regenerate-overwrite. **Why:** the review's concern was silent self-heal masking divergence; failing the build forces the committed banks to stay correct.
- **Decision:** added `vitest.config.js` excluding worktrees (its own commit). **Why:** the suite was scanning 3 stale worktree clones, inflating the count ~3× (the real suite is 1521 tests, not ~4687) and causing the intermittent "1 failed" flakes seen across sessions. This makes "suite green after every group" actually deterministic.

## Code Changes (what each does)
- `api/_lib/provider-budget.js` (new) — per-provider Redis budget with per-minute/per-day windows, per-instance fallback, injectable client+clock.
- `api/weather.js` — consume budgets before the 5-provider fan-out, gate each request; `getSettledValue` treats fulfilled-null as a clean failure; split server-resolved name from caller name; cache only the sanitized name; serve `responseLocationName` on hit.
- `api/_lib/weather-cache.js` — `cacheableLocationName` + `responseLocationName` helpers (HIGH-3 + M-i).
- `api/_lib/limiters.js` — weather cap 480→240 with reasoning.
- `index.html` — splash CSS failsafe keyframe + inline window error/load handlers; `pw_last_bg` onerror→default.
- `assets/app.js` — in-handler splash error guard.
- `assets/app.css` — `.skip-link:focus` z-index above splash.
- `scripts/build.mjs` — copy-bank drift verify (fail on stale); precache gate covers rewrite/extensionless paths; client weather-copy import guard.
- `CLAUDE.md` — condition-folder list reconciled.
- `vitest.config.js` (new) — scope to `tests/`, exclude worktrees/dist.

## Issues Found
- Issue: the suite count was inflated ~3× by stale worktree clones; real suite is 1521 tests. Severity: MINOR (measurement). Status: FIXED (`vitest.config.js`). Note for the architect: prior "4636/4687 green" reports counted worktree duplicates — the canonical figure is 1521.
- Issue: per-minute provider ceilings alone can't guarantee a monthly free tier for bursty traffic. Severity: addressed via per-DAY window on the binding providers. Status: FIXED.
- Issue: during an Upstash outage the per-instance fallback bounds *each instance*, not the true global total (many Fluid instances). Severity: MINOR (outages are short; far better than unlimited). Status: ACCEPTED + documented in provider-budget.js.

## Blockers
None. All gates passed: every touched JS `node --check` clean; suite 1521/1521 green after every group (deterministic post-config); `npm run build` clean (26/26 precache paths, drift gate + import guard active); provider-budget fail-path and splash throw-path behaviourally tested.

## Quality Checklist
- [x] Supervisor loaded; checkpoint appended
- [x] HEAD confirmed (10cd039 = 4eba23c + review doc; origin/main at 4eba23c)
- [x] Sequenced atomic commits; suite green after every group; node --check per group
- [x] Exclusions honoured (H4, Honor flow, Sesotho)
- [x] Provider-budget tests: enforce-before-fetch, per-provider isolation, per-day cap, exhausted-skip, all-exhausted, Redis-down fallback
- [x] Splash throw-path tested; HIGH-3 cross-user poisoning tested end-to-end
- [x] Pushed to main (this checkpoint + 6 fix commits + the prior review doc)

## Next Steps
- Watch the first deploy after push — the build now has two new hard gates (copy-bank drift, client weather-copy import) plus the rewrite-aware precache check; all pass locally.
- Provider-budget ceilings are conservative starting points sized from published free tiers — tune perMin/perDay from real Vercel traffic once observed (the `[pw-budget]` skip logs surface throttling).
- Provisional zu/xh/st splash strings from the prior session still pending native review (unchanged here).
