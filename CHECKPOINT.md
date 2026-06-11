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
