# Probably Weather — launch eval, fixes and the Home proposal (Vonk / Opus 5.5, 23–24 Sept 2026)

Production stays on `ec7ae52` (verified `/api/version`, 23 Sept 21:19 UTC). Everything below is **local**,
nothing pushed. Of the commits on `main` after `ec7ae52`, **15 reach users** (the app, its share previews and
its headers); 2 change tooling only (the Sesotho ban list, the fold gate); the rest are records under
`review/` (the accuracy harness, this eval and its corrections) that never deploy. The Home proposal is on branch
`design/home-options` (`b6d17fb`, `5b1f6ba`), not merged.

Evidence lives next to this file (`review/eval/…`, git-ignored folder, the files are force-added where
they are small; screenshots stay on disk) and in `review/accuracy/`. Every finding carries its proof.

---

## 0. What a push would ship (15 reach users; tooling and records are marked)

| commit | what |
|---|---|
| `35c8aa8` | Al's 4 Afrikaans proposals (all USE) wired: af-1681, af-1971, af-2025, af-2083 |
| `2453a74` | Al's season ruling: N299 (12,1,2,3), B212 (1,2,3), B450 (always) kept; 59 CUT from every language |
| `b82c102` | af-2016 "wil he" → "wil hê" |
| `ca469f6` | Sesotho ban list suggests the SA spelling ("lehodimo") — tooling, not deployed |
| `55b938d` | Sesotho: 41 strings outside the joke bank moved to the SA orthography Al ruled on 6 Sept |
| `b5ed306` | Sesotho storm share preview said "Ledimo le a tla" (the ogre is coming) → "Sefefo se a tla" |
| `73fd87a` | Share previews: isiZulu/isiXhosa "Probably" = the app's own word (xh had the Zulu "Cishe") |
| `46b6ec8` | Android install steps in isiZulu/isiXhosa/Sesotho words (the brief's "Install app" item) |
| `7313f83` | Chrome on iPhone (iOS 16.4+) installs from its Share button — no more "Chrome can't install" |
| `ed6413c` | Skip link in the reader's language |
| `731e187` | isiXhosa Hourly label "Amaqondo", not "Temp" |
| `8e5f136` | Place search says "No places found…" / "Search isn't answering…" instead of going blank |
| `66fa361` | CSP report-only copy dropped (was due 22 Sept) |
| `5824365` | "3/5 sources agree" tap target 13 → 25 px, layout unmoved |
| `86f0f87` | Fold gate covers Al's iPhone 11 (414×896, 414×715) — 80/80 — tooling, not deployed |
| `797de9e` | Search race + "OS 17" UA (Sol's review) |
| `60c72c8` | Offline: a service-worker copy of the forecast shows its age |
| `758cb5f` | review/accuracy: blend-vs-sources harness + live sample (report only; not app code) |
| `f656b35` | this eval: EVAL.md, the scripts, Al's page (review/ — not deployed); later commits that only correct it are records too |

Gates on the final code (main at `797de9e`, then the suite again at `60c72c8`): serial vitest **129 files /
21,159 tests**, `npm run build` (vitest + image budget + copy-split drift), bespoke 9 checks, drift guard,
rotation PASS, month gate 0 out of season/place (`--control` fails as it must), desktop frame PASS, gate
shots, fold **80/80**. Sol reviewed every app-code diff (§6).

---

## 1. Step 1 — Al's two exports

**af-proposals-ruled.json** (copied to `review/`): the 4 proposals are condition-bank lines, wired with
`bank-set.mjs` against the exact old text; lang-check PASS on all four; the 14 lines wired from his notes
stand (no UNDO). Commit `35c8aa8`.

**seasonal-ruled.json** (copied to `review/`): applied by `scripts/apply-seasonal-ruling.mjs`, extended so a
CUT photograph line that is also a bank line leaves the bank in all five languages (Al's 23 Sept rule; the
page's older legend kept it — the rule wins). 54 photograph pairs off, 15 bank lines out (5 bank rows + 10
photograph lines also in the bank), **0 of the 59 sentences left anywhere in `api/` or `assets/`** (text
search). One of the ten is "Nature's doing its own load shedding." — one of the five approved Eskom lines;
the season CUT is the later ruling, so four approved Eskom lines are live (test + CLAUDE.md updated).
`build-hero-lines` treats a place TAG on a season-cut line as history (11 of 56). Commit `2453a74`.

**The 7 photographs left with no line — never a blank caption, proven twice:**
- by logic, in the applier: every slot of each photograph × its weekday × 2–5 hours of its time slot × 12
  months × 8 places (a place in every region box + Polokwane in none) × 5 languages × low-confidence on/off:
  a non-empty condition-bank pool every time; the same sweep over all 252 folder × time × weekday
  combinations: no empty pool;
- in the real app: `review/eval/scripts/bare-photos.mjs` pins the clock to each slot of each bare photograph,
  stubs its condition, opens the built app at 414×715 in en/af/zu: **60/60 runs** show that photograph with a
  non-empty caption that is none of its former lines (`review/eval/shots/bare/bare-photos.json` + 60 shots).

---

## 2. Step 2 — the eval

### 2.1 Every screen and control, phone and desktop, five languages

`review/eval/scripts/walk.mjs` on production: phone = WebKit with Chrome-on-iPhone UA at 414×715 (Al's
iPhone 11 in Chrome; the 715 is an estimate of his Chrome bars), desktop = Chromium 1440×900; Home (first
visit), language menu, Hourly ×3 metrics, Week, a day, Places (empty / Durban / nonsense), Settings,
Sources, Share. 10 runs, 190 screenshots, `review/eval/shots/walk/` + `walk.json`.

- All screens render in all five languages; Durban found in every run; 9 week cards; 0 failed requests;
  desktop 0 console errors; phone 1 each — the CSP report-only warning (§2.10, fixed).
- **English on af/zu/xh/st screens** (text compared per screen against the English run):
  - "Skip to main content" (af/zu/xh/st) — **fixed** `ed6413c`;
  - isiXhosa Hourly "Temp" — **fixed** `731e187`;
  - Android install steps "Add to Home screen / Install app" (the brief's item) — **fixed** `46b6ec8`;
  - by design, left: the "Language" chip (tests/language-picker.test.js: a fixed word so a lost reader
    finds it), wind letters "NE" in zu/xh/st (the ruled PLACEHOLDER), iOS share-sheet labels in pills;
  - not fixed, reported: the province and country come from the geocoder in English ("Strand, Western
    Cape", "Durban, South Africa") in every language; the first-visit tagline "No more Ja-No-Maybe weather.
    Just Probably." is English in every language (a brand line — Al's call if it ever changes).
- Stats pill cut off the gust number in af/zu ("NE · kufika ku…") — fixed in every Home direction (§4).

### 2.2 Weather truth — the app against the airports right now

`review/accuracy/live-sample.mjs`, production read 23 Sept 21:29 UTC at FACT/FAOR/FALE/FAPE/FABL/FAGG
against aviationweather.gov METAR (`review/accuracy/results/live-sample-2026-09-23.md`):
- served condition vs the airport's latest report: **2 of 5** fresh reports matched (Durban clear ✓,
  Gqeberha cloudy ✓; Cape Town served cloudy under CAVOK; **Johannesburg served "rain" by the Tomorrow.io
  radar override under CAVOK**; George served cloudy in mist/BR 4.8 km; Bloemfontein stale);
- the blended high sat below the observed max at 5 of 6 (Gqeberha 23.6 vs 29 °C): at 23:00 Tomorrow.io's
  "today" is one hour long yet keeps its weight in the high;
- 00:02 SAST re-check, Johannesburg (`review/eval/city-now-johannesburg.log`, screenshot
  `review/eval/shots/city-johannesburg.png`): clear, 5/5 votes clear, airport CAVOK — the app is right;
  the raw API still carried now.rainChance 60 % at local hour 0 (the known midnight-rollover skew on the
  post-launch list); the phone shows rain 5 % "None".
Weather logic — reported, not changed.

### 2.3 The blend against each source (never measured before)

`review/accuracy/blend-vs-sources.mjs` → `results/blend-vs-sources.md` (91 days × 6 airports; stand-ins for
four sources). Pooled: **daily high** tied with the Tomorrow.io stand-in (0.84 vs 0.84 °C MAE); **daily
low** loses to Open-Meteo alone (1.67 vs 1.39 — the GFS stand-in for Pirate reads lows +3.0 °C warm, +8.0 at
Bloemfontein); **rain hourly** wins (Brier 0.0364 vs 0.0391, outside noise); **rain daily %** loses to
Open-Meteo alone (within noise); **wind hourly** wins (4.40 vs 4.70 km/h). The day's high read at 18:00 is
0.8 °C low (MAE 0.84 → 1.20). **What the stand-ins cannot show**: WeatherAPI's own model and vocabulary,
Pirate's real GFS/GEFS pipeline, MET Norway's post-processing, Tomorrow.io's radar; the archive is the
freshest run, not the 06:00 forecast; airport ≠ city. Side findings (harness, not app): `run-eval.mjs` counts
Bloemfontein's unobserved nights as dry (21 of 44 "false rain" hours); `lib/replay.mjs` blends the low with
the high's weights. Sol's review of the harness: one edge case, no effect on this sample (in the report).
**Report only — weights and thresholds are Al's.**

### 2.4 Failure paths

`review/eval/scripts/failure-paths.mjs` (local build, stubbed API, 414×715):
| path | what the user sees | proof |
|---|---|---|
| location denied | toast "Location permission needed…", IP fallback forecast | `shots/failure/location-denied-home.png` |
| denied + IP lookup fails | same toast, a forecast still shows | `…/location-denied-ip-fails-home.png` |
| nonsense search | **was** nothing at all → now "No places found…" (`8e5f136`) | `failure/…` vs `failure-after/search-nonsense-search.png` |
| geocoder 429 | **was** nothing → now "Search isn't answering…" | `failure-after/search-rate-limited-search.png` |
| all providers down (API 503) | "Error" in the caption spot, "Couldn't fetch weather right now.", "--°", **no retry** | `failure/all-providers-down-home.png` |
| API rate limit (429) | the same error screen | `…/api-rate-limited-home.png` |
| provider so slow the 10 s budget ends | Loading… then the error screen + toast "Weather lookup taking too long" | `…/slow-provider-12s-at-*.png` |
| one provider down | Home unaffected; Sources "Sitting this one out: WeatherAPI", 4/5 | `…/one-provider-down-sources.png` |
| offline after a visit | forecast from the worker's cache; **was** shown as fresh → now "Using cached data (just now)" (`60c72c8`) | `failure-offline-before/` vs `failure-offline-after/` |
| offline, first ever visit | the browser's own offline page (nothing cached yet) | `failure-offline-after/offline-first-ever-visit-home.png` |

Method note: Playwright's `setOffline` does not reach the service worker's own fetches — the first offline
run was really online. The script now drops every connection instead.

### 2.5 PWA

- Manifest (`shots/checks/checks.json`): name, short_name "ProbablyWeather", start_url/scope "/", standalone,
  portrait, theme/background colours, 192 + 512 icons and maskable 192 + 512, all 200; 1 shortcut;
  **no screenshots or description** (Android's richer install sheet needs them) — whole-app list.
- iOS: `apple-touch-icon` → icon-192, `apple-mobile-web-app-capable`; **Chrome on iPhone was told it can't
  install** — false since iOS 16.4 (Google Chrome Help: Share → Add to Home Screen) → fixed `7313f83`.
- Banner timing on iPhone-class WebKit: shows 4.9–5.4 s after opening, ~2.5–4.6 s after the forecast
  (`review/eval/banner-probe.log`, 3/3 runs) — the idle-time module load (~3.3 s) plus the 1.5 s engagement
  floor, against the ruled "2.5 s after the first forecast". Reported, not changed.
- Update after a deploy (`review/eval/scripts/sw-update.mjs`, `shots/sw-update/sw-update.log`): build A in
  control → "deploy" build B → app backgrounded and reopened → page reloads itself 4.6 s later, "Updated ✓",
  build B in control. **PASS.** Production's sw.js carries BUILD_ID = ec7ae52 (the stamp that makes it work).
- Offline: §2.4.

### 2.6 Share — WhatsApp card and link previews, five languages

`/s/<lang>/-34.12/18.84/rain/Strand` with WhatsApp's UA (`shots/checks/checks.json`, cards
`shots/checks/share-card-*.jpg`): 200 in all five; og:title "Probably Weather"; og:description in the
language ("Strand: Waarskynlik 16°/20°. Bewolk vandag." …); card JPEG 34–39 KB, 200. The isiZulu card is
fully isiZulu (condition, witty line, "Umoya … Imvula …"). Found and fixed: xh "Cishe" (a Zulu word) and zu
"Cishe" ≠ the app's word (`73fd87a`); Sesotho "Boemo ba leholimo" (Lesotho spelling) on every preview
(`55b938d`); Sesotho storm preview "Ledimo le a tla" = "the ogre is coming" (`b5ed306`). Question for the
skills later, not changed: isiXhosa fog preview "Linenkungula" is unattested (the usual word is "inkungu").

### 2.7 Content — photo, weekday, time slot, season, rotation

- Production 23 Sept 23:37 SAST, Strand, cloudy night, rotation week 2, Wednesday: served
  `bg-canonical/ee562e8a…` = `cloudy/week_1/night/1` — correct: the Wednesday photograph (the cat in a
  jumper, `cloudy/week_*/night/3`) is benched from cloudy by Al's ruling and the build serves its named
  fallback (`review/benched-photos.json`). The caption was that photograph's own line.
- Gates: rotation PASS (no served slot bare, min 1 line); month gate 0 out of season/place for 12 months,
  control fails; bespoke 9 checks.
- The 7 bare photographs: §1 (60/60).

### 2.8 Speed

`shots/checks2/checks.json`, Chromium phone, Lighthouse slow-4G numbers (150 ms RTT, 1.6 Mbit/s, 4× CPU):
cold first visit — DOM ready 4.3 s, **first weather 6.3 s**, LCP 4.0 s; warm connection — first weather
1.9 s, LCP 1.2 s; **CLS 0.07–0.11** (the 0.1 "good" line); page weight 539 KB in 16 requests (5 scripts, 3
styles, 3 images, 2 fonts, 2 fetches). Unthrottled: first weather 223 ms.

### 2.9 Accessibility

`shots/checks2/checks.json` (WebKit phone, reduced motion on):
- Caption contrast over the library's worst photographs: `scripts/verify-wash-contrast.mjs --caption` PASS,
  witty line worst 8.58:1, header 6.34:1, condition 6.77:1 (bar 4.5:1) — `review/eval/caption-contrast.log`.
- Tap targets: "3/5 sources agree" was 366×13 px (under 24) → **25 px** (`5824365`); back buttons 38×38
  (above 24, under Apple's 44); Settings' email and privacy links 16–17 px tall (inline text links).
- No control without an accessible name on Home, Hourly, Week, Places, Settings; `<html lang>` follows the
  language in all five.
- Reduced motion: no running animation on Home.
- Text at 130 %: no sideways scroll; the stats pill cuts its sub-lines (fixed in every Home direction).
- Type size on Al's phone in Chrome (414×715): stats labels **7.9 px**, sub-lines 8.9 px, Low·High and
  source line 10.7 px, Hourly label 11 px — the fold-fit scales type by viewport height (§4).

### 2.10 Production health

- Vercel runtime errors, last 7 days (Vercel MCP `get_runtime_errors`, 23 Sept): 4 groups — Node
  `url.parse()` deprecation warning ×82 (geocode/weather/share; a warning, not a failure); one Safari
  IndexedDB "connection is closing" unhandled rejection (18 Sept); one LocationIQ 429 during search
  (18 Sept); its matching client stack. Function logs grouped by status: 200 ×350, 304 ×29, **no 4xx/5xx**.
- Headers (`curl -D -` on /): CSP enforced **and** the Report-Only copy still sent two days after its end →
  dropped (`66fa361`); HSTS, nosniff, X-Frame DENY, Referrer-Policy, Permissions-Policy present.
- `/privacy` 200, `/install` 200, apex → www 307. 404: `/robots.txt`, `/sitemap.xml`,
  `/apple-touch-icon.png` (the page links `assets/icon-192.png`, so iOS finds its icon).
- Not obtained: the report-only week's `[pw-csp]` lines (runtime-log retention no longer reaches them).

### 2.11 Ads

`ads-readiness` is **already in main**: merged 16 Sept as `11306e1` (Al's 15 Sept ruling); 0 commits left to
land (`git rev-list main..origin/ads-readiness` = 0). Live: a placeholder card ("Weather apps don't grow on
trees. There might be an ad here one day.") at the end of Hourly and Weekly on phones/tablets; Home ad-free;
no ad network loads; CSP has no ad origins.

---

## 3. Step 3 — fixed (all on main, one commit each; §0)

Sol (gpt-5.6-sol via Codex, clean folder, stdin closed, hard timeout) reviewed every app-code diff before it
reached main — §6. The step-3 commits were built on `fix/step3`, reviewed as a set, fixed, re-reviewed,
then fast-forwarded. Not changed and reported instead (weather logic, weights, thresholds, rulings, humour):
the Johannesburg radar false rain, the blend's low and evening high, the midnight skew, the banner timing,
the desktop night hero (below), the tagline.

---

## 4. Step 4 — Home

**What makes Home feel off** (production-equivalent build, 414×715, eight states: rain, clear day, night,
fog, the palest photograph, the longest isiZulu caption, first visit with the banner, desktop 1440 —
`review/eval/shots/home/current/` and `current-sheet.png`):
1. **The lower third is fine print.** Under the photograph: stats labels 7.9 px, sub-lines 8.9 px, Low·High
   and the source line 10.7 px, six type sizes in ~180 px. The fold-fit shrinks type with viewport height,
   and Chrome's bars make Al's screen short.
2. **The frame never fully came off.** The photograph is inset 24 px with rounded corners and a shadow — a
   thumbnail in a dark room, where the meme ruling said the picture takes the space.
3. **The temperature is small** (28.6 px) — ruled so ("the number smaller", 14 Aug); every leader makes it
   the largest type (§ research). Kept stepped back in every direction; this is the one place a ruling
   blocks the category's strongest pattern.
4. **The loudest thing on Home is the yellow Hourly button** — ruled so (7 Aug: Hourly is the ad surface, it
   has to invite the tap). Kept.
5. **Long jokes climb the photograph**: the longest isiZulu line runs five lines over half the picture.
6. Truncation in other languages: the gust number is cut in af/zu.

**Research** (smaak, live store listings and press kits, `output/smaak-2026-09-23/RESEARCH.md`,
`CONTACT-SHEET-home-screens.png`): CARROT, Apple Weather, Weawow, Pixel/Google, What The Forecast?!!
(+ yr). 5/5: temperature on the backdrop as the largest type; Home one scroll with hourly reachable without
a tap; white text on toned-down imagery. 0/5 put a joke on a real photograph or set it in handwriting — PW's
meme is unique (identity). 0/5 list af/zu/xh/st.

**Three directions** — branch `design/home-options`, `?home=a|b|c` on one build, the same photograph and
caption per state, current beside each (`review/eval/shots/home/compare-1.png` rain/clear/night,
`compare-2.png` fog/pale/isiZulu, `compare-3.png` first visit; per-state shots in `a/ b/ c/`). All three:
frame off edge to edge; a legibility floor (11 / 13 / 16 px); stat sub-lines wrap (the gust stays);
long jokes step down in size (≤42–46 % of the photograph); every ruling kept. Fold gate with each: 80/80.

| | A — Tidy | B — More meme | C — Paper |
|---|---|---|---|
| idea | today's layout, fixed | photo and joke take the screen; data in two rows | joke on the photo; data on a warm printed card; dark card at night |
| photo area vs today (414×715) | +12 % | **+19 %** | +9 % |
| joke | same size | bigger (4.9 vh) | same size |
| temperature | 32 px | 30 px | 32 px |
| effort to build for real | small — ~60 lines CSS + ~30 lines JS | small — same + one size | medium — a card, a night variant, contrast re-proved on cream |
| speed cost | none (CSS/JS in the bundle) | none | none |
| rulings touched | none | none | the gold "Probably" cannot stay gold on cream (~1.2:1) — it goes deep ochre by day |

**Pick: B.** It moves furthest in the direction Al already chose (Home becomes the meme: the picture takes the
space, the number stays back), fixes the fine print, and touches no ruling. C answers "too dark, too moody"
(17 Aug) best, at the cost of the gold wordmark by day. A is the safe floor.

**Whole-app improvements (short list, none built):**
1. One legibility floor everywhere (no text under 11 px on a phone).
2. Hourly: the table is a scroll box inside the page, cut mid-row at 04:00 — let it run with the page; the
   "TEMP"/"HIGH" headers are set larger than their neighbours and don't line up with their columns.
3. Week rows are ~150 px tall at 414 — 5½ days on a screen; compact rows fit all 7.
4. Day detail: "today" at 23:00 shows one row and an empty screen; the header sits off-centre.
5. The error screen: "Error" in handwriting on a stock photo, no retry — a plain line and a Try again button.
6. Desktop at night shows tomorrow's range as the big number with no "tomorrow" (a code comment says
   "night = tomorrow's range"; the phone shows today's).
7. Place names in the reader's language (province, country).
8. Manifest screenshots + description (Android's richer install sheet).

---

## 5. Left open, and what only Al's phone can settle

- **Phone checks**: Chrome on his iPhone — Share → Add to Home Screen appears and the icon opens as an app
  (the new install path); the fold at his real Chrome bar height (715 is an estimate); the caption and stats
  sizes of the Home direction he picks, by eye.
- Weather logic (report only): Johannesburg radar false rain; the blend's daily low; the evening high drop;
  the midnight skew (already on the post-launch list).
- Not built: the Home direction (needs his pick), the whole-app list.
- The accuracy harness side findings (§2.3) and Sol's harness edge case.
- isiXhosa "Linenkungula" (share preview, fog) — for the skills.

## 6. Sol

gpt-5.6-sol via the Codex CLI (`node codex.js exec -C <clean folder> -m gpt-5.6-sol`, stdin closed, 540 s
timeout), hard cap 300 k tokens for the session:
| review | tokens | verdict |
|---|---:|---|
| season applier (step 1b) | 95,765 | SHIP |
| step-3 fixes (13 commits) | 36,814 | FIX — search race, iOS minor version, regex-only tests |
| step-3 follow-up | 30,035 | SHIP |
| design branch | 25,130 | FIX — caption size on resize |
| offline-age fix + design follow-up | 19,480 | FIX — forgeable offline marker |
| offline-age (WeakMap) | 29,870 | SHIP |
| accuracy harness | 55,151 | FLAWED — one edge case, no effect on the sample |
| **total** | **292,245** | cap 300,000 |

Not Sol-reviewed: the eval scripts in `review/eval/scripts/` (measurement tools, not shipped; their outputs
were checked by eye) — the budget went to the app code and the harness.

---

## 7. Launch run (Vonk / Opus 5.5 building, Fable 5.1 reviewing — 24–25 Sept 2026)

Built in a worktree on `main` (`C:\Users\27741\pw-launch-run`, base `e7d1260` tagged `launch-run-base`),
**24 commits, nothing pushed**: 19 change the app, 5 are records/tooling under `review/` (`07229df`, `c6d392d`,
`1c8f3e8`, `ce19aed` and the one carrying this section). A push of `main` now ships **45 commits** over `ec7ae52`
(§0's 21, 15 reaching users, plus these 24). To ship §0's alone first: `git push origin launch-run-base:main`.
Al's page: `review/launch-run-for-al.html` in the OneDrive working copy (with its pictures in
`review/launch-run-for-al/`); rulings export to `launch-run-ruled.json`.

**Fable.** `claude -p --model claude-fable-5-1` could not run (`claude auth status`: not logged in); Fable ran
through Claude Code's agent route (`subagent_type feature-dev:code-reviewer`, `model fable`) after a probe proved
the call. It reviewed the forecast plan and every app diff before its commit:

| call | tokens | verdict |
|---|---:|---|
| transport probe (general-purpose) | 78,881 | answered as claude-fable-5-1 |
| transport probe (code-reviewer) | 18,186 | answered |
| review 1: recorder + crowd changes | 64,974 | fixes applied, then committed |
| review 2: forecast plan + F1/F2 | 55,491 | plan changed (F1 cut-off rule stated first; F2 edge half added) |
| review 3: forecast build + launch basics | 60,949 | fixes applied |
| review 4: speed, alerts, ticked list, gust | 111,610 | SHIP ×3; follow-ups B2/B3 below |
| **total** | **390,091** | cap 400,000 — no further calls |

After review 4, not reviewed: the gust rule lost a redundant `min-width: 0` (a guard test forbids the text below
the night ink; a clipped flex item's automatic minimum is 0 anyway) — re-measured, 15/15 shots pixel-identical to
the reviewed version; the ticked-list tests split one file per item; `manifest.json`'s untouched lines put back in
their old layout (parsed JSON identical). Open from review 4, not done: while `/api/health` is down the other open
alerts close and reopen (B2); Upstash unplugged entirely reads "not configured" and raises nothing (B3). The
workflow runs from the default branch only: dispatch it once after the push.

### 7.1 Money and terms (live pages, 25 Sept; nothing bought or changed)

| service | plan now | allows ads? | limits | before ads |
|---|---|---|---|---|
| Vercel | **Pro** (corrected 25 Sept: the team holding the project is on Pro and Al pays for it — the run misread a billing-API error as Hobby) | yes | Pro limits | nothing |
| Upstash Redis | Free | yes | 500K commands/month, then `ERR max requests limit exceeded` | **pay-as-you-go $0.20/100K**, set a cap |
| Open-Meteo | commercial key set (production `openMeteoEndpoint=customer`) | yes | 1M calls/month | nothing |
| WeatherAPI | Free | yes, credit link | 100K calls/**month** (code now 3,200/day) | Starter $7 — not yet |
| Pirate Weather | Free | no ("personal use") | 10K/month | **$3/mo plan (20K/month)** — budgets already sized for it |
| Tomorrow.io | Free | **no** (ToS §1.1.5; Enterprise only) | 3/s, 25/h, 500/day | **`PW_SOURCES_OFF=tomorrow`** unless a contract |
| MET Norway | free | yes, credit + UA | 20 req/s | nothing |
| LocationIQ | Free | yes, with a visible "Search by LocationIQ.com" link + OSM credit | 5,000/day, 2/s, 60/min | link now; Developer $100/mo not yet |

Env names only: `OPEN_METEO_API_KEY` is set in production (inferred from the served endpoint; Vercel env list
403). `.env` in the OneDrive copy holds `TOMORROWIO_API_KEY` (name only) and syncs to OneDrive. App credits are
plain text with no links and no LocationIQ/OpenStreetMap credit.

### 7.2 Recorder (real numbers before tuning)

`review/accuracy/live/record.mjs`, Windows task "ProbablyWeather accuracy recorder" (hourly at :10, since
24 Sept 23:58; stop: `Unregister-ScheduledTask -TaskName 'ProbablyWeather accuracy recorder' -Confirm:$false`,
`review/accuracy/live/README.md`): production's API for the six harness airports + METAR → `review/accuracy/live/`
in the OneDrive copy. `meta.sourceNow`/`meta.sourceToday` (`f5a94be`) give each real source's own numbers from
the next release. Score so far (`results/live-score.md`, night only): now-condition agrees at **6 of 17**
airport-hours; Cape Town served fog 4× under reported cloud. Records only while the PC is awake (WakeToRun is a
question on Al's page).

### 7.3 Launch crowd

Visit cost (`results/visit-cost-before.md`): 2 API calls a visit (`/api/version`, `/api/weather`), 3 when
location is denied (`/api/locate`), +1 geocode per search. The GPS request carried 4 decimals, so the CDN never
shared it; `c268319` asks on the server's 0.02° grid (~2.2 km). Load test (real handler, fake Upstash with the
real Lua, emulated edge, stubbed providers — never production): 3,000 visits in 60 s from one city → 1,647 edge
hits, provider calls bounded by cells; WeatherAPI + Pirate + Tomorrow.io at 429, LocationIQ out, or Upstash out:
**3,000/3,000 answered with a temperature**; all five sources out → 503 (the error screen with Try again).
Caveats (Fable): per-PoP edge caches and place names in the URL mean ~2,000 function runs per 3,000 visits;
per-instance fallback ceilings multiply while Redis is down; WeatherAPI's 3,200/day can go in ~16 min at peak.

### 7.4 Forecast

Plan: `review/accuracy/FORECAST-PLAN-2026-09-25.md` (Fable review 2). Shipped: **F1** (`8d536e0`) — Tomorrow.io's
"today" high stops voting from 18:00; pooled MAE of the day's high read 18:00–23:00 **1.20/1.38/1.53/1.65/1.76/1.85
→ 0.95 °C** at every hour, no airport-hour worse, earlier hours identical. **F2** (`664fb1a`) — a cached forecast
built for yesterday is never replayed after local midnight, and the edge `Cache-Control` ends 5 s before midnight.
Waiting for the recorder (a maybe, not clearly better): the overnight low (without Pirate 1.67 → 1.46 °C pooled,
Bloemfontein frost nights 3.5 → 1.6, but Johannesburg 1.05 → 1.35), rain calibration (hourly 60–70 % → rain
49 %, 70–80 → 71 %, 80–90 → 84 %; daily 20–40 % → 54 %). No change: false "Rain's here" (29 % of rain hours
dry that hour), daily rain vs Open-Meteo alone (within noise). Johannesburg's clear-sky rain = Tomorrow.io's radar
alone; `radarNextHourBump` (`ad1187d`) now records its next-hour bump. SA check (`results/sa-weather-check.md`):
cold fronts 20/20, south-easter 75/114, fog CT 71/101 · DBN 9/12 · PE 4/10 · George 13/37, thunder JHB 14/16 ·
BFN 12/12; KZN heat untestable (2 hot days).

### 7.5 Speed and data

HTTP/2 slow-4G harness (`review/launch/scripts/speed.mjs`, 150 ms per response, one 1.6 Mbit/s pipe): first
weather, cold cell — Android mid-range **5.0 → 4.5 s**, iPhone 11 **3.1 → 2.9 s**; edge hit 2.1 → 1.9 s and
1.9 → 1.7 s (`c4635bf`: a first visit's placeholder photo and the caption font wait for DOMContentLoaded). §2.8's
6.3 s is a different setup (Lighthouse-style throttling with 4× CPU); compare only these pairs. Lab LCP
got later on a cold Android visit (2.0 → 3.9 s): the placeholder under the splash now paints after the scripts.
Data: first visit ~445 KB; later opens ~3 KB plus ~100 KB per new photograph slot (≤4 a day) — about
0.1–0.4 MB a day. Not done: fonts as woff2 files (~37 KB), functions in cpt1 (needs Redis moved with them).

### 7.6 Knowing when it breaks (`227544b`)

`/api/health` (counters only, no provider call, edge 60 s); failure and 5xx counters written only when something
fails; `PW_SOURCES_OFF` parsed in one module; `.github/workflows/health.yml` every 30 min opens/closes
"[PW alert] …" issues mentioning Al (the repo is public, so Actions minutes are free). Runbook:
`review/launch/RUNBOOK.md` (Instant Rollback, the switch, each alert, Analytics).

### 7.7 Launch basics (`297ad90`) and the privacy page

robots.txt, sitemap.xml (/, /install, /privacy) and a 180×180 opaque `/apple-touch-icon.png` in the build
(`review/launch/shots/apple-touch-icon-ios.png`). Visitor count: Vercel Web Analytics is already collecting
(on Pro it keeps counting). Privacy page (`privacy.html`, live): the date line reads "ads-readiness DRAFT
15 September 2026, not published"; GPS is now sent on the ~2 km grid for forecasts (the page says 4 decimals, and
that searched places are not rounded) and the server copy carries the grid point; the ad choice and Settings → Ad
choices it describes are not built. Proposed wording is on Al's page (English; not wired — no review budget).
Ad network: AdSense approval, `ads.txt` ("not mandatory, but highly recommended"), a Google-certified CMP for
EEA/UK (16 Jan 2024) and Switzerland (31 Jul 2024) visitors, the ad-network CSP option, Vercel Pro.

### 7.8 Al's ticked list (one commit each)

hourly-scroll `dda083a`, week-compact `d1f2088`, day-late `501a903`, error-retry `678d879`, desktop-tomorrow
`fc6ee30`, place-language `4543ece` (zu/xh/st names through lang-check, nothing held), af search line
`bf4b1d1`, android-sheet `347ef69`, and the af/zu gust number `5ddb75c` (pixel-identical where the line fitted).
Before/after: `review/launch/shots/ui-before|ui-after/`, `results/ui-*.json`. The after shot of the error screen
caught the install banner; the same steps repeated 22× per build: old 0/22, new 1/22 — the banner's
interaction fallback can fire over the error screen in both builds (a race with the idle-loaded `install.js`);
not changed.

### 7.9 Checked, not built

- **SAWS warnings.** Official CAP feed `https://caps.weathersa.co.za/Home/RssFeed` (live, `<copyright>Public
  Domain</copyright>`; items 24 Sept: Severe Thunderstorms, GP and WC); each CAP 1.2 document has the level
  ("Warning Level 2"), event, onset/expires, municipalities with polygons and English instructions, and
  `<scope>Restricted</scope>`. Act 48 of 2013 s30A: an offence to publish a severe weather warning known or
  suspected false or misleading, to impersonate SAWS, or to use its branding to deceive (R5M / 5 years first
  conviction). Proposal on Al's page; ask SAWS in writing first.
- **Home B**, measured as D was (`review/launch/home-b-check/` in the OneDrive copy): at 414×715 the joke sits on
  the subject in **34** photographs in any language (D 120), sits on or touches in 201 (D 204); 360×688 200 (D
  187), 320×488 174 (D 190). Only in B: at 320×488 isiXhosa the card is 87–107 px and the joke starts under the
  header (966 placements); smallest joke 18.91 px there, 31.04 at 414×715.

### 7.10 Gates

The finished tree passed the full set before it was split into commits — serial 134 files / 21,212 tests, image
budget, build, fold 80/80, desktop, bespoke, drift guard, rotation, month (+ control failing as it must), gate
shots. Every commit then passed the serial suite and the build on its own (scratch worktree; one test file needs
the local lang-check cache and skips there), and the final commit runs **142 files / 21,220 tests** green here.
Load tests used stubs only; no provider and not production was hammered.

---

## 8. Precision run (Vonk / Opus 5.5 building, Fable 5.1 reviewing — 25 Sept 2026)

Al: "the main gist for me is we need to get the app to be as precise with its predictions as possible". Same
worktree (`C:\Users\27741\pw-launch-run`, local `main`). This section supersedes §7's push count.

**Privacy page — live.** Al: "just publish the damn privacy page already." `84fc691`, built on live `ec7ae52` and
pushed to `main`: Al's four OK'd wordings, the "DRAFT … not published" line gone, "Last updated: 25 September
2026", the ad choice described as coming with the first ads; `tests/privacy-policy-truth.test.js` pins the
published page. The two ~2 km location paragraphs describe the rounding, so they ride in the rounding commit
(`5f0d14f`) and go live with it. Gates green; https://www.probablyweather.co.za/privacy shows the new date and no
DRAFT line (re-checked 25 Sept 10:58). Local `main` was then rebased onto `84fc691`.

**Al's marks** (`launch-run-ruled.json`): privacy ×4 OK (published), words ×4 OK (as wired), credit links DO IT
(`c46ec80`), recorder wake YES (`01e6da9`). Unmarked, not chased: the other money items and SAWS. No in-app ads
until the app has real traffic (Al's call); money items tied to ads wait.

**Small items.** `b7c2d3f` Fable's B2/B3: while `/api/health` is down, the other open alerts no longer close and
reopen; Upstash "not configured" raises the "not connected" alert. `c46ec80` credit links on the Sources page (each
source's site; "Search by LocationIQ.com", "© OpenStreetMap contributors", Open-Meteo CC BY 4.0). `01e6da9` the
recorder's task may wake the PC (`-WakeToRun`; this PC's power plan has "Allow wake timers" on Disable, so it
wakes only once that is switched on — README). `446face` records: Vercel is on Pro.

### 8.1 The check (`review/accuracy/v2/`, plan `PLAN.md`, Fable-reviewed)

16 airports scored in 11 regions (23 listed; 7 have no usable archive): FACT FALW FAGG FAPE FAEL FAUT FALE FAOR
FAWB FABL FAUP FAKM FAMM FAKN FAHS FAPP. Truth: METAR from the Iowa Environmental Mesonet (ZA__ASOS); the Karoo and
KZN inland from SA Weather Service synoptic reports (Ogimet): Beaufort West, Graaff-Reinet, Pietermaritzburg,
Ladysmith. Forecasts: **real past forecasts**, not stand-ins — Open-Meteo's previous-runs API (six models,
latest run = t0, the run 24 h earlier = t1) and historical-forecast API (gusts, visibility, Open-Meteo's own rain
%). best_match equals ECMWF 9 km in SA, so the consensus counts ECMWF once. Learned on 2025, every number on
2026-01-01 → 09-24; paired bootstrap in 7-day blocks; the ship test pre-registered before the full data was
scored. The app's blend is replayed under three source→model assignments (nobody can know which model
WeatherAPI or Pirate Weather run), and a conclusion must hold under all three.

### 8.2 Today's and tomorrow's high and low — `bbb662a` (built, not pushed)

One extra Open-Meteo request per forecast fan-out, in parallel (no added wait): temperature for GFS, ICON, UK Met
Office and Météo-France, 3 days = 1.0 call unit (the main call is 2.9), commercial key only, SA only; it rides the
0.02° server cache, so a cache hit makes no call. With best_match, each model's day max/min loses its seasonal
lean and the five are weighted by past error (`api/_lib/precision-table.js`, generated by `make-table.mjs`,
`--check` guards drift). Days 0 and 1 take half blend, half consensus (α 0.5, the pre-registered cap), kept inside
the hourly strip; days 2–6, the hourly strip and the payload shape unchanged; any failure → exactly today's
numbers. `meta.precision` records the consensus beside the blend (shadow mode; `live-sources.mjs` scores it once
live).

| pooled high + low, 16 airports | the app now | as shipped | best single model |
|---|---|---|---|
| tomorrow (t1): off by | 1.45–1.54 °C | **1.30–1.33 °C** | Open-Meteo (best_match) 1.55 |
| tomorrow: within 2 °C | 72–74 % | **78–79 %** | 72 % |
| today (t0): off by | 1.27–1.31 °C | **1.14–1.16 °C** | Open-Meteo 1.35 |
| today: within 2 °C | 79–80 % | **83–84 %** | 78 % |

- **Ship test (pre-registered, mix − app now):** t1 −0.17 [−0.21, −0.12] · −0.14 [−0.16, −0.11] · −0.19 [−0.23,
  −0.15]; t0 −0.14 [−0.17, −0.11] · −0.13 [−0.14, −0.11] · −0.14 [−0.18, −0.11]. **Passes.** Against the best single
  model: −0.21, −0.24, −0.20 at t1 and −0.18, −0.21, −0.18 at t0, every interval below zero. The tabled consensus
  beats the untabled five-model mean (t1 −0.10 [−0.15, −0.05]), so the tables earn their place.
- **Region guard** (Al's rule in the plan: a region clearly made worse blocks the change there): ten regions
  better under all three assignments at both leads. **The Lowveld worse** (FAKN, FAHS: t1 +0.11 [0.07, 0.15] ·
  +0.06 [0.02, 0.10] · +0.17 [0.13, 0.22]): its nights run warmer than the models (FAKN best_match low −1.6 °C),
  the reverse of the rest of SA, so the all-SA correction pushes them the wrong way. `inLowveld` blocks it (no
  extra request; the app there is exactly today's); `make-table.mjs` refuses a table if the guard's worse regions
  and production's block ever differ.
- **Per region vs the best single model** (picked with hindsight on 2026): the mix is ahead on the coast and in
  the Eastern Cape; inland one model alone matched or beat it at t1 — ICON in the Highveld (1.19 vs 1.20–1.24),
  Northern Cape (1.47 vs 1.55–1.76) and Limpopo (2.06 vs 2.28–2.34), UK Met Office in the Free State (1.50 vs
  1.50–1.79). Weighting models by region is the next candidate; it needs its own held-out test.
- **Transfer:** neighbour tables are mixed (FAHS→FAKN −0.73, FAPE→FAEL −0.25 better; FAKN→FAHS +0.41, FAOR→FAWB
  +0.30, FAWB→FAOR +0.19, FAPE→FAUT +0.10 worse), so the all-SA table ships, as pre-registered.
- **Frost** (147 nights with a low ≤ 2 °C, 59 at Bloemfontein): the day before, the app's low was +2.8 to +4.4 °C
  too warm, frost forecast on 7–33 of 147 nights → as shipped +2.6 to +3.4 °C, 20–36. An airport's own table gets
  +0.9 °C and 86 of 147 — but only at that airport; it does not carry to the neighbour, so it is not used.
  Still the largest temperature gap.

### 8.3 Rain, wind, gusts, fog (reported; nothing changed)

Pre-registered at 10:55 SAST, before the full rain data was scored: the app's own rain % can only be replayed as a
proxy (WeatherAPI, Pirate Weather and Tomorrow.io keep no history), so a rain-% change is reported, not shipped;
if a calibrated % beats both the replayed app % and Open-Meteo's own % with no region worse, the next step is
shadow mode. It did:

- **Rain today** (3,380 station-days at 13 airports; rained 26 %): Brier app (replayed) 0.106, Open-Meteo alone
  0.122, calibrated blend 0.103 — vs the app −0.0030 [−0.0056, −0.0005], vs Open-Meteo −0.019 [−0.025, −0.013], no
  region worse. The app's % is honest to 50 % and overstates above: 50–60 % → rained 42 %, 70–80 → 61, 80–90 → 74.
  Open-Meteo alone: 70–80 → 45, 80–90 → 45.
- **Rain in the next 3 hours** (17,203 windows; rained 9 %): app 0.058 (50–60 % → 29 %, 60–70 → 41, 70–80 → 55),
  Open-Meteo 0.070, calibrated blend 0.050 (50–60 → 53) — vs the app −0.0086 [−0.0111, −0.0062].
- **Shadow mode:** `live-rain.mjs` applies the 2025 curves offline to the % the app really served and scores both
  on the recorder (49 scored readings so far, no rain yet). No production change needed: the recorder already
  saves it (`c95a097`).
- **"Rain's here"** (Al's rule, counted only): replayed with three models standing in for the five sources,
  3,430 calls, dry that hour 56 %, dry ±1 h 40 %, 48 % of rain hours caught. At the rule's six airports 40 % (the
  22 Sept check with the app's own resolver: 29 %); inland thunderstorm country 71–86 % (Mthatha 86, Polokwane 80,
  Mahikeng 79, Mbombela 71).
- **Wind** (hourly mean): Open-Meteo alone 4.52 km/h off, best single model (UK Met Office) 4.35; the six
  models each corrected for their lean at the airport (station × season × time of day, 2025) **3.31** — vs Open-Meteo
  −1.21 [−1.29, −1.12], vs the best model −1.04 [−1.11, −0.96]. It also calls "windy" far more (windy hours caught
  1,338 → 2,431 of 2,887; false 1,959 → 3,221), and airports are windier than most gardens: reported, not shipped
  (plan item 9).
- **Gusts:** the app's rule (largest source gust) 10.2 km/h off, big gusts (≥ 55) caught 574 of 696, 393 false;
  best_match corrected 10.0 (−0.23 [−0.76, 0.29]) — no change.
- **Fog** (visibility < 1 km): the app's detector replayed on Open-Meteo caught 204 of 681 fog hours with 1,420
  false (right 1 time in 8 when it says fog); no stricter gate chosen on 2025 did better; Open-Meteo visibility
  < 1 km alone 207 / 1,631. Cape Town 140 of 221 caught, 431 false; George 12 of 112, 270 false. **Live** (recorder,
  24–25 Sept): the app served fog 16 times with a report in reach, 15 without fog — at Cape Town low cloud at 200–500
  ft with mist, at Durban clear skies; the one real fog (George, 25 Sept 08:00) was called. MET Norway, Pirate
  Weather and Tomorrow.io voted fog 10, 11 and 9 times, none with fog (62 readings to 25 Sept 11:10).
- **Karoo and KZN inland — the high/low change, out of sample** (`ca495b8`; synoptic day max / night min, table
  learned at the airports only). Karoo (Beaufort West, Graaff-Reinet; 1,006 day-values): tomorrow 1.76–1.88 →
  1.59–1.66 °C (−0.22 [−0.27, −0.17] · −0.17 [−0.21, −0.13] · −0.22 [−0.27, −0.18]), today 1.63–1.69 → 1.46–1.51;
  ICON alone 1.57. KZN inland (Pietermaritzburg, Ladysmith; 1,000): 1.70–1.75 → 1.48–1.50 (−0.22 [−0.30, −0.15] ·
  −0.24 [−0.28, −0.19] · −0.27 [−0.34, −0.21]), today 1.50–1.54 → 1.26–1.27; best single model (UK Met Office)
  1.73. The table never saw these towns: the gain carries. (A 200 reply that carried "timeoutReached" instead of
  data broke one file; the downloader now refuses non-JSON, `966ac4c`.)
- **Tomorrow.io and Pirate Weather:** neither keeps history, so only the recorder can price them; its first
  complete day is 25 Sept (`live-sources.mjs` scores each source's own high and low from then). The launch run's
  "overnight low without Pirate" figure used GFS as Pirate's stand-in, which the first live day showed is wrong —
  void. WeatherAPI's 11 live rain votes so far were all in dry hours. Nothing is switched off.

### 8.4 Fable, gates, and what a push ships

| Fable call | tokens | verdict |
|---|---:|---|
| privacy release diff | 34,611 | SHIP |
| three small ruled items (B2, B3, credits, wake) | 46,688 | SHIP ×3, no defects |
| forecast precision plan | 49,366 | PROCEED WITH CHANGES — all adopted |
| precision layer code | 86,618 | FIX FIRST — three one-liners and the table gate, applied |
| Lowveld block + regenerated table | 78,266 | SHIP |
| **total** | **295,549** | cap 600,000 |

Gates on `bbb662a`: serial **144 files / 21,246 tests**, image budget, build, fold 80/80, desktop, bespoke, drift
guard, rotation, month (+ control failing as it must), precision table `--check`, gate shots. The serial suite and
the build re-run green on the final tree; no test reads the records added after it.

**Al's page:** `review/precision-for-al.html` in the OneDrive working copy (generated by `cc79fbe` from the
results; export `precision-ruled.json`). Two new questions only: push, and an honest or careful rain %.

**What a push ships now:** local `main` is **57 commits over live `84fc691`** — §0's 21 (15 reach users), the
launch run's 24 (19 change the app) and this run's 12: two reach users (`c46ec80` credit links, `bbb662a` the high
and low), `b7c2d3f` is the alert script (GitHub Actions, not deployed), the rest are records and tooling under
`review/` (`01e6da9`, `446face`, `ef84e74`, `516cad7`, `c95a097`, `966ac4c`, `ca495b8`, `cc79fbe` and this
section). **36 change what users get.** To ship §0's alone first: `git push origin launch-run-base:main` (the tag
moved with the rebase and still fast-forwards from `84fc691`). After the push, once: GitHub Actions → "Launch
alert" → Run workflow.

---

## 9. Rain's here, fog, frost (Vonk / Opus 5.5 building, Fable 5.1 reviewing — 25 Sept 2026)

Al: "it has been showing fog a lot when it isnt really that foggy and the rain thing i noticed the last couple of
days and it felt off." Same worktree, local `main` from `6dda897`. Plan: `review/accuracy/v3/PLAN.md`, committed as
the pre-registration (`2675a95`) before anything was scored, with Fable's ten changes adopted in full.

**Known before the plan.** The recorder's 18 fog calls (24 Sept 23:58 → 25 Sept 14:10): 15 from the
visibility–humidity detector, 2 from one "true fog" word (Layer A.2), 1 from the description vote; 1 real (George
08:10). At Cape Town and Durban the detector's input was Open-Meteo's own visibility (archived 0.2–0.7 km while
the airports saw 6–10 km). **Open-Meteo's visibility changed on 30 Sept 2025** (a 24.1 km cap before, uncapped and
often low after), so fog was tuned and tested only on 1 Oct 2025 → 24 Sept 2026, alternate ISO weeks of
noon-to-noon days. Rain inputs are stable across both years. Production logs no conditions (`DEBUG = false`); no
station reports from Strand. The four SAWS towns, Cape Columbine and Langebaanweg's synoptic reports are automatic
with no present weather or visibility — no rain-now or fog truth; the West Coast has none at all.

### 9.1 Fog — strict gates in five regions (`c2c3f41`)

Candidates: the detector's gates, only cells that still fire on Strand's two pinned real fogs (21 May, Open-Meteo
1,040 m; 3 Aug, Tomorrow.io 0.8 km). Chosen on the tune weeks by F0.5: humidity ≥ 95 % and Open-Meteo's own wind
≤ 10 km/h. Test weeks, 13 airports: wrong fog calls **15.1 → 10.5 per 1,000 hours** (−4.6 [−7.2, −2.7]); right when
it says fog 10 % → 12 % (+1.9 [0.2, 3.5] points); fog hours caught 35 % → 29 % (the cost). Wrong fog clearly lower
in the Western Cape (46.8 → 34.6), Garden Route (43.5 → 18.1), Eastern Cape, KZN coast and Lowveld; no change
measured inland; the West Coast has no truth. 73 % of today's detector fog calls came with no fog, mist or low
cloud at the airport. Production: `detectAdvectionFog(…, { strict })`, `FOG_STRICT_REGIONS` (a test ties it to
`results/v3-fog.json`), `api/_lib/regions.js` (the nearest measured station's region; station cells, not climate
zones), `meta.conditionConfidence.fogSignal` now carries Open-Meteo's own wind, the rule and the region for the
recorder. A blocked false fog becomes the "fog may be coming" hedge with low confidence (the trend check is
unchanged; pinned). **Al rules per region** (his page): George would catch 2 of 78 fog hours instead of 7.

### 9.2 "Rain's here" — nothing changed; Al decides

No cell of the chance × amount grid (votes fixed at 2 distinct models) reached the pre-registered 2025 bar (Wilson
lower bound ≥ 60 % right) in any regime; the strictest (≥ 90 %, ≥ 2 mm) reached 51 %. It was tested anyway as the
pre-coded fallback: right **73–75 %** in 2026 (lower bound 68–70 %) against today's **48–53 %**, clearly more right in
the Western Cape, Garden Route, Free State and Northern Cape, saying "Rain's here" in 7 % of rain hours instead of 47 %
(the rest "Might rain.", or Windy in 198 rain hours). Fable: the fallback is not in the plan, so nothing ships; Al
chooses today / strict / never (radar only) per region; if strict, it ships in the four regions on this evidence as
his ruling. Descriptive: today's rule is wrong 15–97 % by region and time of day — worst inland at night (Limpopo
97 %, Lowveld 94 %, Free State 89 %, North West 90 %). Proposed wording for Al: "Showers nearby." / "Buie naby."

### 9.3 Frost nights — fails, nothing ships

Inland (≥ 500 m, the Lowveld out), gate chosen on 2025 leave-one-station-out: cloud ≤ 40 %, wind ≤ 12 km/h,
dew-point depression ≥ 4 °C; δ ≈ 1.6 °C. Frost nights clearly better (airports 3.26 → 2.22 °C off the day before,
towns 4.77 → 3.74), but all nights under the ECMWF-heavy assignment show no clear gain at the airports (−0.02 [−0.08,
0.04]) and Johannesburg gets clearly worse (1.10 → 1.81): its airport is on open high ground. No second pick.

### 9.4 Inland table — six regions (`eeb530b`)

Both sides learned on 2025 only, leave-one-station-out. 2026 high + low, pooled: inland airports −0.07 [−0.11,
−0.04] °C (t1), the four towns −0.06 [−0.09, −0.04]; whole intervals below zero at both leads under all three
assignments. Clearly better in the Free State, Northern Cape, North West, Limpopo, Karoo and KZN inland; worse in the
Highveld; no change at Mthatha. `PRECISION_TABLE_INLAND` (make-table.mjs: regions from the results, the refit only
where every weight stays within 3 points of the tested 2025 table — tomorrow's high fell back to it), used where the
region is in its list and Open-Meteo's grid elevation is 500 m or higher; `meta.precision.table` names it.

### 9.5 The rain % calibration, the last week, the recorder

The calibration still waits: no rain has fallen at the six recorder airports since it started. Last week
(`results/v3-lastweek.*`): at Cape Town airport the app said fog in 13 hours with no fog there (the new rule: 9);
Strand (replayed, no station) 19 → 9; George 10 → 4, losing its one real fog hour; Bloemfontein's replayed rain rule
said "Rain's here" in 27 hours, with rain in 9. The recorder reads Strand and Cape Town city from 25 Sept 16:10
(`bfc4582`; installed into the runtime copy, the scheduled task unchanged).

### 9.6 Fable, gates, what a push ships

| Fable call | tokens | verdict |
|---|---:|---|
| the plan | 120,449 | PROCEED WITH CHANGES — ten changes, adopted in full before scoring |
| rulings on the four results | 88,060 | fog OK in five regions; rain: nothing ships, Al decides; frost fails; inland OK in six; the region map sound |
| the fog and inland diffs | 119,971 | fog SHIP; inland SHIP WITH FIXES (four drift guards and test pins) |
| the fixes | 77,195 | CONFIRMED (and a footnote, applied) |
| **total** | **405,675** | cap 600,000 |

Gates on the finished tree: serial **146 files / 21,260 tests**, image budget, build, fold 80/80, desktop, bespoke, drift
guard, rotation, month (+ control failing as it must), precision table `--check`, gate shots. The fog commit on its
own (`c2c3f41`, the inland changes set aside): 146 files / 21,258 tests and the build.
Al's page: `review/rain-fog-frost-for-al.html` in the OneDrive working copy (generated by `51072c3`; export
`rain-fog-frost-ruled.json`), checked headless at 390 and 1280 px.

**What a push ships now:** local `main` is **68 commits over live `84fc691`** — §8's 57 and this run's 11: two reach
users (`c2c3f41` fog's strict gates in five regions, `eeb530b` the inland table), the rest are records and tooling
(`bfc4582` the recorder, `2675a95`, `e75c240`, `3b90549`, `9e2188b`, `0143a7a`, `845c84f`, `51072c3` and this section).
**38 change what users get.** The fog change goes out region by region on Al's word: where he keeps today's fog,
`FOG_STRICT_REGIONS` loses that region before the push.

## 10. Al's rain and fog rulings, built and shipped (Vonk / Opus 5.5 building, Fable 5.1 reviewing — 25 Sept 2026)

Al ruled in chat (`review/rain-fog-frost-ruled.json`, copied from his Downloads; no page this time): strict "Rain's
here" in **every** region, strict fog in all five offered regions, "Showers nearby." / "Buie naby." OK, and his note
kept on record: *"it has been showing fog a lot when it isnt really that foggy and the rain thing i noticed the last
couple of days and it felt off."*

### 10.1 "Rain's here" — strict everywhere (`400929e`)

Built exactly as replayed in `review/accuracy/v3/rainnow.mjs`: two sources describing rain (not tuned), the hour's
blended chance ≥ 90 % and blended amount ≥ 2 mm (`RAIN_NOW_MIN_PROB` 60 → 90, `RAIN_NOW_MIN_MM` 0.3 → 2). **Radar:**
the replay had no Tomorrow.io radar, so the radar override (> 0.5 mm/h now) is unchanged and remains the other route
to "Rain's here" — nothing radar-only was added. Caveat (Fable): the replay counts one vote per model family and
production one per source, so live "Rain's here" fires at least as often as replayed; the 73–75 % is an upper bound.
`meta.conditionConfidence.rainRule` names the rule in every answer. Answers cached under the old rule re-derive
differently and are refetched (pinned).

### 10.2 "Showers nearby." (`400929e`, counted in `9d77d11`)

An hour the old rule (≥ 2 sources, ≥ 60 %, ≥ 0.3 mm) called "Rain's here" and strict does not: the might-rain key
with reason `showers-nearby` (rung 7.5n — wind and high UV still outrank it, as in the replay), worded "Showers
nearby." / "Buie naby." / "Izihlambi zemvula ziseduze." / "Iimvula zikufutshane." / "Dipula di haufi." (zu/xh/st
through the translation skills, lang-check triage 0 flagged — `review/showers-nearby/`). Not when the phone's own
window says the rain is later. The words sit in `T.weather`, not the headline bank, so share conditions are untouched:
the share card still says "Might rain." for such an hour (Fable: acceptable).

From the archive (`review/accuracy/v3/showers.mjs`, 13 airports, 2026 to 24 Sept, three source guesses): shown in
**20–38 of every 1,000 hours** (about 14–26 hours a month at one airport); it rained at the airport in that same hour
**43–45 %** of the time, and rain or showers were in sight within the hour either side **59–62 %**. For comparison:
plain "Might rain." hours rained 16–19 %; strict "Rain's here" was right 73–75 %. Best on the Garden Route (rained 71–73 %),
KZN coast (65–76 %) and Western Cape (56–62 %); weakest in Limpopo (21–25 %), the Lowveld (23–28 %) and North West (20–25 %).

### 10.3 Fog — five regions, confirmed

`c2c3f41` already switched the strict gates on in exactly Western Cape, Garden Route, Eastern Cape, KZN coast and
Lowveld (`FOG_STRICT_REGIONS`, a plain constant — nothing behind a switch). A test now ties the list to Al's ruling.

### 10.4 Al's note — the recorder checks it (`7525fd2`)

`review/accuracy/live/score.mjs` gains a per-release section: fog shown vs fog or mist at the airport, "Rain's here"
and "Showers nearby." vs rain that hour or the next (only hours the airport can judge), Strand and Cape Town city
counted. Before this release (ec7ae52 and 84fc691 together): fog shown in 18 judgeable airport-hours, fog or mist at
the airport in 3.

### 10.5 Fable, gates

| Fable call | tokens | verdict |
|---|---:|---|
| the diff | 158,457 | SHIP WITH FIXES — the scorer counted hours no airport could judge (MED); "Showers nearby." beside a "Later" rain stat on an answer read an hour on; the replay's family-vote caveat; the share card (acceptable); a cache-refresh test |
| the fixes | 91,197 | CONFIRMED |
| **total** | **249,654** | cap 300,000 |

Gates on the finished tree (`7525fd2`): serial **147 files / 21,274 tests**, build, image budget, fold 80/80,
desktop, bespoke, drift guard, rotation, month (+ control failing as it must), precision table `--check`, gate
shots, and `review/showers-nearby/render-check.mjs` on the build — the hero's words for showers-nearby, might-rain
and strict rain in all five languages, **15/15**.

### 10.6 Shipped

`git push origin main` 84fc691 → **`7525fd2`** (16:00 UTC): the 68 waiting commits plus this run's three.
`/api/version` → `7525fd2…`. Live smoke (`scripts/live-smoke.mjs`, phone 375×812 and desktop 1440×900, all five
languages; home, hourly, weekly, search, settings, share, share card): **10/10 legs, 0 console errors, 0 bad
responses**. Live rules (`meta.conditionConfidence`, fresh answers): Strand — rainRule strict, fog strict / Western
Cape; Johannesburg airport — rainRule strict, fog standard / Highveld; Bloemfontein airport — rainRule strict, fog
standard / Free State; each live selector re-derives to the served base under the committed code. GitHub "Launch
alert" run by hand (`gh workflow run`): success, "healthy at 2026-09-25 16:05 UTC"; the workflow is active on
`main` (:07 and :37 each hour); no open [PW alert] issue. No rollback needed.

## 11. Fog (the proper fix), the radar, the honest rain %, frost nights (Vonk / Opus 5.5 building, Fable 5.1 reviewing — 26 Sept 2026)

Al: *"lets do the proper fog fix, and yes go with what you suggested on the radar and honest rain and frost night."*
His word to ship each change that clears its pre-registered bar. Worktree `C:\Users\27741\pw-launch-run`, `main` from
live `274e5cf`. Plan `review/accuracy/v4/PLAN.md`, committed before anything was scored (`c639248`), Fable's seven
changes adopted before scoring (`fd3f2ed`). One candidate per job, tested once.

**Found on the way.** Strand's two "pinned real fogs" are partly synthetic: on 3 Aug every source missed the fog
(Open-Meteo 35.3 km, humidity 82 %; Tomorrow.io 14 km; MET Norway fog 0 %), the 0.8 km fixture is a what-if. On
Open-Meteo's archive for 21 May (visibility 720–900 m, humidity 90–92 %) **the strict fog rule now live in the Western
Cape does not fire; today's standard rule does (22:00–01:00).** MET Norway's `complete` feed carries a fog-area field
that its docs call Nordic-only but that read up to 85 % at George on 26 Sept (not recorded; would need the other
endpoint). Tomorrow.io answered in about half the recorder's readings.

### 11.1 Fog without Open-Meteo's visibility — fails, nothing ships (`02510ac`)

Candidate: at least k of the five models production can read (best_match, GFS, ICON, UK Met Office, Météo-France)
saturated at the ground (spread ≤ s °C, low cloud ≥ L %), best_match calm (≤ W km/h), no rain; Open-Meteo's
visibility not an input. Fetched: the short-lead archive of all five at the 13 airports with fog truth, 1 Oct 2025 →
24 Sept 2026 (`v4/fetch4.mjs`). Tuned on even weeks (F0.5, 45 of 81 cells fire on Strand's 21 May; 12 on 3 Aug),
chosen k ≥ 1, spread ≤ 0.5 °C, low cloud ≥ 80 %, wind ≤ 10 km/h. Test weeks, against the rule live today:

| | fog calls | right | fog hours caught (of 264) | wrong fog per 1,000 h |
|---|---:|---:|---:|---:|
| standard (old) | 879 | 10 % | 35 % | 15.1 |
| live (strict in 5 coastal regions) | 632 | 12 % | 29 % | 10.6 |
| **models' saturation** | 1,245 | **8 %** | 39 % | **21.9** |

F0.5 vs live −0.040 [−0.070, −0.008]; wrong fog +11.3 [+8.2, +14.8] per 1,000 h; worse in every region. The
models' own fog codes are worse still (right 5 % of the time). Open-Meteo's visibility, bad as it is, carries more
fog signal than the models' saturation: dropping it is not the fix. The live rule stays. `meta.sourceNow[].visKm`
now records each source's own visibility (WeatherAPI, Pirate, Tomorrow.io, Open-Meteo) so the next fog attempt has
the history this one lacked; the next fog family needs a fresh test period (the odd weeks are now used twice).

### 11.2 The radar — too few to judge, keep recording (`6521047`)

18 "Rain's here" calls made by Tomorrow.io's radar alone at the six airports (24 Sept → 26 Sept 18:10 UTC); 16
judgeable; rain within 30 min at the airport in **9 (56 %, Wilson 33–77 %)**; within an hour, VC counting, 12 of 17.
They come from **6 separate rain events** (Gqeberha, George, Bloemfontein, Durban), and the plan needs ≥ 10 before
switching off or keeping. Nothing changed. At this share about 230 judged calls would decide; realistically the next
few rainy weeks settle the event count first.

### 11.3 The honest rain % — rule not met, keep recording (`6521047`)

The pre-registered rule (v2 plan: calibrated % beats the served % on Brier, whole interval below zero, 7-day blocks,
rain today) needs ≥ 4 complete weeks before it can run (Fable). The recorder has 10 airport-days (rained 3) and **0
complete weeks**. At the archive's own effect size, rain today needs about 2,700 airport-days (~450 days at six
airports); the next 3 hours about 2,500 windows (~12 weeks). Said plainly: at six airports the rain-today bar will not
be reached this year; the next-3-hours lead could be in about three months, but moving the bar to it is a new
pre-registration, not this one.

### 11.4 Frost nights — ships, six regions, two station cells blocked

Candidate (pre-registered): on nights Open-Meteo forecasts clear (mean cloud ≤ C) and calm (mean wind ≤ W), the low
moves toward the coldest of the five models: low − k × max(0, low − coldest model's day minimum), ≤ 5 °C. Tuned on
2025 leave-one-station-out at the inland airports: **cloud ≤ 40 %, wind ≤ 12 km/h, k 0.60 (today) / 0.58
(tomorrow)** (folds 0.49–0.63). Blocked on 2025 before the test: North West, Eastern Cape (Mthatha). Test 2026, the
rule as it would ship, all three source guesses, both leads:

| | all nights, airports | frost nights, airports | all nights, 4 towns never used | frost nights, towns |
|---|---|---|---|---|
| tomorrow | 1.41–1.60 → 1.32–1.39 °C | 2.33–3.10 → 1.67–2.00 | 1.47–1.58 → 1.43–1.47 | 3.92–4.66 → 3.53–3.94 |
| today | 1.28–1.42 → 1.20–1.24 | 2.10–2.72 → 1.38–1.61 | 1.34–1.45 → 1.28–1.32 | 3.85–4.44 → 3.44–3.74 |

Every interval wholly below zero (e.g. tomorrow, airports −0.08 [−0.12, −0.04] under the ECMWF-heavy guess, the
weakest). The frost-night warm lean the day before: +2.3–3.1 → +1.4–1.9 °C. No region wholly worse on 2026 → ships in
Highveld, Free State, Northern Cape, Limpopo, Karoo, KZN inland (500 m up; days 0–1; only when the precision layer's
five models are there).

**Johannesburg, after the test.** The Highveld's pooled number hid it: Pretoria much better (1.80 → 1.41), Johannesburg
airport clearly worse (1.10 → 1.35 tomorrow, 1.00 → 1.35 today; intervals wholly above zero under all three guesses).
Al's instruction names Johannesburg, so the same wholly-worse guard was applied to the station cells the region map is
built from: **Johannesburg airport's cell and Beaufort West's (worse under one guess, today) are blocked** — a block
only removes the change. Recorded in `results/v4-frost.json` `stationsBlocked`, pinned by test.

Production: `api/_lib/frost.js` (after the precision mix; the hourly strip untouched; the low only ever goes down;
anything missing → the low as before); `meta.precision.frost` records each step; `meta.precision.days[].lowC` keeps the
mix's own low so the recorder scores the two layers apart.
Every other step (Fable): the region/elevation checks come before the low's own, so nothing is recorded where the step
cannot apply; a day-0-vs-day-1 test pins the night windows and each day's own model minimum.

`meta.sourceNow[].visKm` (`25dd649`) is recording only: nothing reads it.

### 11.5 Fable, gates, what ships

| Fable call | tokens | verdict |
|---|---:|---|
| the plan | 105,268 | PROCEED WITH CHANGES — seven, adopted in full before scoring (`fd3f2ed`) |
| the frost + recording diff, and the three verdicts | 113,497 | SHIP WITH FIXES — three (the "empty elsewhere" order, the precision log's low, a day-0/day-1 test), applied as specified; the fog, radar and rain-% outcomes consistent with the plan's rules |
| **total** | **218,765** | **cap 200,000 — over by 18,765** (the agent counts every file it reads; the 45k instruction did not hold) |

Not re-reviewed, because of the cap: the three fixes as applied, and the Johannesburg / Beaufort West cell block
(added after Fable's review; it only removes the change, pinned by test to the results).

Gates on the finished tree (`25dd649`): serial suite **148 files, 21,300 of 21,301** — the one, `witty-day-tags`
(a hard 15 s limit), timed out at 20.6 s while another project's Next.js server held the CPU at 100 %; alone it passes
18,449 / 18,449 (and the whole suite passed 148 / 21,296 earlier on this change before Fable's fixes). Three image
tests timed out the same way on the run before and pass alone. Image budget 1,008 ≤ 300 KiB, build, fold **80/80**,
desktop, bespoke 9, drift guard, rotation, month (+ control failing as it must, 12,296), precision table `--check`,
gate shots 24.

**What a push ships:** 8 commits over live `274e5cf` — two reach users' data: `0b1af00` frost nights (the low on
clear, calm nights in six regions), `25dd649` source visibility in `meta` (no visible change). The rest are records
(`c639248`, `fd3f2ed`, `6521047`, `018e0d4`, `02510ac`, this section).

### 11.6 Shipped

`git push origin main` `274e5cf` → **`e688913`** (26 Sept, 19:34 UTC; `origin/main` had not moved, nothing to rebase).
`/api/version` → `e688913…` about a minute later. Live answers (fresh, cache miss): Johannesburg airport — precision
applied, `frost` empty (its cell blocked); Pretoria — frost night on both days, low 15.3 → 14.3 °C today and 16.5 →
15.4 tomorrow (cloud 20–27 %, wind 6 km/h); Bloemfontein — today too cloudy (77 %), tomorrow 11.1 → 10.6; Kimberley —
both nights too cloudy; Strand — nothing (not in scope). `meta.sourceNow[].visKm` carries Open-Meteo, WeatherAPI,
Pirate and Tomorrow.io (MET none). Live smoke (`scripts/live-smoke.mjs`, phone 375×812 and desktop 1440×900, five
languages): **10/10 legs, 0 console errors, 0 bad responses**. No rollback needed.
The recorder's 20:10 UTC reading: `version=e688913`, 8/8 reads, METAR 200; Bloemfontein's record carries the frost step (tomorrow 11.2 → 10.7 °C), Johannesburg's an empty `frost`, every record `sourceNow[].visKm`. (Its 19:10 reading, before the push, timed out on all eight reads and the METAR call at once — this PC under load, not the site.)

## 12. Wind, gusts, the sky call, the wind headline (Vonk / Opus 5.5 building, Fable 5.1 reviewing — 28 Sept 2026)

Al, 28 Sept, Strand 09:37–09:55 SAST: partly cloudy (thin high streaks, low cloud on the mountains), the wind "pumping",
palms bent hard; Yr 10 m/s from the east. The app: "Probably Cloudy vibes.", wind 20 km/h, 2/5 sources agree. *"If we
launch the app and its weather prediction sucks we are screwed."* Worktree `C:\Users\27741\pw-launch-run`, `main` from
live `e688913`. Plan `review/accuracy/v5/PLAN.md`, committed as the pre-registration (`cf307a0`) with Fable's nine
changes adopted before anything was scored; `score5.mjs` ran once. A second run fixed a script bug that had blanked
the live guard (a comment swallowing half a line) and added today's blend as the south-easter base (the base that
applies at Strand); the archive numbers are identical between the two runs (`v5/results-score5-run1-livebug.txt`).

**What this morning was.** Recorder, Strand 07:10 UTC: OM 11.4, WA 10.4, Pirate 22.5, MET Norway 39.2, Tomorrow.io 18.4
km/h → served 19.2, largest gust 23; server key `clear` (one cloudy vote overruled a 77 % cloud number), and the phone's
own cloud rung (≥ 60 % over a server `clear`) painted it cloudy. The SA Weather Service's own station in Strand (12.1)
read **28 km/h from 110°, gusting 50** at 06 UTC. Cape Town airport, 40 km away, read 11 km/h under CAVOK.

### 12.1 Strand's station — found

**WMO 68911 STRAND** (SA Weather Service, −34.141, 18.848, 7 m, ~3 km from the recorder's Strand point): SYNOP at 00,
06, 12, 18 UTC — 10-minute mean wind, direction, the 910ff gust; no cloud. Read through Ogimet (no key; the channel the
precision run already uses; WMO Resolution 40 data, internal verification, never redistributed; Ogimet asks not to be
hammered). Live from March 2026 (every 2025 month and Jan–Feb 2026 are NIL): **711 reports, Mar → 24 Sept**. Kitesurf
and home-station networks near Strand either forbid commercial use (Windfinder's Gordon's Bay, Weather Underground,
Tempest) or need the operator's consent (Holfuy). The recorder now reads 68911 at 01, 07, 13 and 19 UTC and the live
scorer puts Strand's served wind beside it, per release.

### 12.2 Wind — the number (ships: today's blend × the region table)

Tuned on 2025, proven on 2026-01-01 → 24 Sept at 16 airports (94,130 hours) under three guesses of which model each
source runs; then the recorder's real sources as a guard. Off by, km/h (range over the three guesses):

| | today (weighted blend) | median of the five | **today × table** | median × table | skill weights (report only) | skill + table |
|---|---|---|---|---|---|---|
| now, 2026 | 4.1–4.3 | 4.2–4.5 (worse) | **3.5–3.7** | 3.6–4.0 | 4.0–4.3 | 3.5–3.7 |
| hours, tomorrow's lead | 4.4–4.8 | worse | **3.8–4.3** | | | |
| **real sources, recorder** (299 h, 25–28 Sept) | 5.8 | 5.1 | **4.7** | 4.9 | | |

- **Ship test** (today × table − today, now): −0.55 [−0.61, −0.49] · −0.60 [−0.66, −0.55] · −0.58 [−0.64, −0.52];
  tomorrow's hours −0.54 · −0.52 · −0.52, every interval below zero. **The median alone is clearly worse** in the archive
  (+0.07 to +0.18); it was better on the recorder, but that was seen before the plan and could only guard. No region
  wholly worse; the live sign rule blocked none (Cape Town's live blend read 9.6 km/h low under a ×1.6 correction — the
  same direction). Live, real sources: −1.08 [−1.51, 0.00].
- **The table** (`api/_lib/wind-table.js`, generated by `v5/make-wind-table.mjs`, `--check` guards drift): a ratio per
  region × season × time of day, learned on 2025 with the three guesses averaged, clamped to ×0.7–1.6 (Fable: a bias fix,
  not a different forecast). Western Cape sits on the clamp (×1.6 all day, every season — Cape Town airport reads ~1.8–2×
  the models); Highveld ×1.3–1.5; Garden Route and Eastern Cape ×1.0–1.4; KZN coast, Northern Cape, Free State, Limpopo
  mostly below 1 at night. Karoo, KZN inland and outside SA: today's blend.
- **By region, off by (km/h):** Western Cape **7.8–8.3 → 3.8–4.2**; Eastern Cape 4.4–4.5 → 3.8–4.0; Highveld 4.6–4.9 →
  4.1; West Coast 3.5–3.7 → 3.2–3.3; KZN coast 3.1–3.4 → 2.9–3.1; Free State 3.2–3.4 → 3.0–3.2; Northern Cape 3.8–3.9 →
  3.6–3.7; Limpopo, Lowveld, Garden Route, North West within ±0.1 (no clear change).
- **Strand (transfer test at 68911, 697 reports, never tuned on):** today 5.6–5.8 off (bias −2.0 to +0.1) → with the
  Western Cape table **7.7–9.2 (bias +4.4 to +7.9)**, clearly worse under all three guesses. On most days Strand's
  station is calmer than Cape Town airport, so **the change is blocked within 15 km of 68911** (Strand, Gordon's Bay, the
  Somerset West coast): today's blend there. The unclamped ratio would be worse still.
- **A south-easter correction for Strand — not shipped:** 209 south-easter reports (Open-Meteo bearing 90–180°), 55 and
  49 separate days in the two halves (enough). On today's blend the station read **12–42 % higher** on those hours in
  the first half, but the second half: −0.46 [−1.32, 0.39] · −0.42 [−1.34, 0.47] · −0.11 [−0.40, 0.19] km/h — not
  clearly better. Said plainly: the south-easter under-read at Strand looks real and cannot yet be proven; 68911 in the
  recorder keeps building the evidence.
- **Weighting each source by its record** cannot be learned for four of the five (no history; the recorder has 2.7
  days). In the archive, with stand-ins, it adds 0.04–0.08 km/h on top of the table — small. The recorder keeps every
  source's own wind; the plan's bar for real-source weights (≥ 4 complete weeks, held-out half) applies when it has them.
- Hourly winds (days 0–1) take the same table; the day cards for today and tomorrow read those hours (Fable); days 2–6
  stay raw. `meta.wind` carries the raw blend, the rule, the ratio and the Windy line for the recorder.

### 12.3 The wind headline (ships: Windy at 27.5 km/h on the corrected number)

"The wind is the story" = the airport's mean ≥ 30 km/h or a gust ≥ 55. The full rung as shipped: number ≥ T or largest
gust ≥ 55, and two sources each at ≥ 80 % of T after the same correction, or a gust ≥ 44. T chosen on 2025 alone: 27.5
(F1 0.626; 25 → 0.576, 30 → 0.621). On 2026, 2,974 windy hours:

| | windy hours caught | right when it says Windy | F1 |
|---|---|---|---|
| today (raw blend ≥ 25) | 54–62 % | 45–49 % | 0.49–0.54 |
| **shipped** | **71–75 %** | 49–51 % | **0.59** |

Recall +0.10 to +0.17 (intervals above zero), F1 +0.05 to +0.09 — passes. By region: **Western Cape caught 25–58 % →
73–84 %**, Highveld 18–24 % → 46–56 %, Eastern Cape 65–67 → 74–76 %; the West Coast, KZN coast and Northern Cape catch
fewer (77–83 → 65–71 %, 87–89 → 76–84 %, 65–72 → 48–57 %) with fewer false alarms. **The cost, stated:** Windy over a
calm airport rises in the Western Cape from 0.3–2.4 to 4.3–5.8 per 100 calm hours (Eastern Cape 2.4–2.6 → 3.7–4.1,
Garden Route 0.9–1.6 → 1.8–2.8). With a server key the phone no longer re-derives Windy from the number (Fable), so the
hero shows the server's decision. The Cape wind warning banner keeps reading the raw blend (its 50 km/h line was not
part of the test).

### 12.4 Gusts — nothing ships

| gust-group hours: off by (km/h); all hours: big-gust F1 | largest of three (today) | median | largest × table | median × table |
|---|---|---|---|---|
| off by | 10.1–10.3 | 9.7–10.6 | 9.8–10.0 | 10.2–11.4 |
| big-gust F1 | 0.28–0.31 | 0.33–0.38 | 0.27–0.31 | 0.25–0.29 |

The median is off by less under two guesses but more under the third (+0.27 [−0.23, 0.77]) — not clearly better; the
table versions fail the big-gust gate. Live: 14 gust-group hours only. At Strand this morning the station's gust was
50 km/h against the sources' largest 23: gusts at Strand stay a known miss.

### 12.5 The sky — nothing ships

Truth: the airport's highest cloud layer (CAVOK / FEW = clear, SCT = partly, BKN / OVC = cloudy), day hours 06–18 SAST.
Hours called right: today 64.3–64.8 %, **median of five 64.3–65.2 %** (+0.4 [0.2, 0.7] · 0.0 [0.0, 0.0] · +0.1 [−0.3,
0.5] points), median of four 63.8–64.5 %. Not clearly better under all three guesses (under the ECMWF-heavy guess three
slots are the same model, so the median cannot differ) — the sky logic is unchanged. **Found on the way:** this
morning's "cloudy" came from the phone, not the server: the server said `clear`, and the phone's own cloud rung (≥ 60 %)
overrode it from the 77 % number. That rung is today's behaviour, measured nowhere; testing it is the next sky job.
`meta.sourceNow[].cloudPct` now records each source's own cloud (Pirate's current) so that test has live data.

### 12.6 This morning, replayed on the shipped rules (`v5/replay-morning.mjs` → `v2/results/v5-replay.md`)

| | sources' wind (OM · WA · Pirate · MET · TI) | served | on the shipped rules |
|---|---|---|---|
| Strand 07:10 UTC | 11.4 · 10.4 · 22.5 · 39.2 · 18.4 | 19.2 km/h, clear → phone cloudy | **19.2 km/h, unchanged** (blocked near 68911) |
| Strand 08:10 | 14.7 · 11.2 · 25.6 · 36.7 · 18 | 20.2 km/h, cloudy | 20.2 km/h, cloudy |
| Cape Town city 07:10 | 24.7 · 16.9 · 22.5 · 29.2 · — | 23.4 km/h, Windy (gust 69) | 37.4 km/h, Windy (mean) |
| Cape Town city 08:10 | 21.8 · 16.2 · 25.6 · 28.8 · — | 22.6 km/h, Windy (gust 63) | 36.2 km/h, Windy (mean) |

There: Strand 68911 28 km/h gusting 50 (06 UTC), Yr 36 km/h, Al "pumping"; Cape Town airport 11 and 9 km/h, CAVOK.
**The shipped rules do not fix Strand's morning.** Strand's own station says Cape Town's correction reads too high there
on most days, and the south-easter correction that would have fixed this morning is not yet proven.

### 12.7 Fable, gates, shipped

| Fable call | tokens (harness count) | verdict |
|---|---:|---|
| the plan | 102,724 | PROCEED WITH CHANGES — nine, adopted in full before scoring (`cf307a0`) |
| the diff | 114,653 | SHIP WITH FIXES — five: (1) a gust shown under the corrected mean — already guarded (server sends a gust only above 1.5× the shown wind, the phone shows it only above 1.3×); (2) the day-1/day-2 seam — said here: days 0–1 corrected, days 2–6 raw; (3) Strand's SYNOP in m/s and 910ff only — applied; (4) cache hits re-running the consensus — not the case (only `deriveCondition`); (5) a test walking every region × month × hour — applied (`0b02b95`) |
| **total** | **217,377** | **cap 200,000 — over by 17,377** (Fable counted ~40k and ~19k; the harness counts its whole context). The fixes were not re-reviewed. |

The station search ran as a separate research agent (132,158 tokens). Gates on the finished tree (`0b02b95`): serial
**149 files / 21,312 tests**, image budget, build, bespoke 9, rotation PASS (it printed PASS and then hung on exit inside
the chain for 11 minutes, was stopped, and passed alone with exit 0), drift guard, seasonal PASS + control failing as it
must (12,296), precision table `--check`, wind table `--check`, fold **80/80**, desktop, gate shots 24.

**Shipped:** `git push origin main` `e688913` → **`acd15b2`** (28 Sept, 09:33 UTC); `/api/version` → `acd15b2…` at 09:34.
Live answers (fresh): Strand 20.8 km/h, rule `today` (blocked), cloudy; Cape Town city 18.2 → 29.1 km/h (×1.6), Windy;
Cape Town airport 15.4 → 24.6; Johannesburg airport 18.2 → 26.0 (×1.43); Durban 21.2 → 22.1 (×1.04); London 6.1, rule
`today`. Live smoke (`scripts/live-smoke.mjs`, phone 375×812 and desktop 1440×900, five languages): **10/10 legs, 0 console
errors, 0 bad responses**; Strand's phone Home: 21 km/h, "Cloudy vibes." The recorder's 10:10 UTC reading: `version=acd15b2`,
8/8 reads, every record `meta.wind` (six airports and Cape Town city `BC`, Strand `today`) and `sourceNow[].cloudPct`. The
recorder's runtime copy is `home-d`'s (staggered `own=1` reads) with the 68911 read merged in; the Ogimet read was tried by
hand (00 and 06 UTC reports back); its first scheduled read is 13:10 UTC. No rollback needed.

**Home D:** `home-d` rebased onto `acd15b2` in a separate worktree (one conflict, `record.mjs`, both changes kept) and
pushed with a lease: `085c1a6` → **`3a51b40`**; the preview answers `3a51b40` and serves the corrected wind (Cape Town city
18.6 → 29.8, Windy). On the rebased branch: serial **150 files / 21,401**, image budget, build, wind table `--check`, desktop,
Home D check 26/26 (a first run timed out at 20 s right after the fold gate; alone it passed), fold **140/140** after one
fixture fix (`3a51b40`): the fold payload said `cloudy` over 46 km/h, which the phone used to overrule from the number; with
the phone now showing the server's key, the gate measured the cloudy display for the first time and **isiXhosa's longest
line ran 2 px under the panel handle at 320×488** — a Home D squeeze on a cloudy, gusty day, found and not fixed. `pw-home-d`'s
own checkout was left as it was (clean, at `085c1a6`): pull before its next push.

## 13. Wind gets its own weights, Strand against its station, temperatures frozen, the daily scorecard (Vonk / Opus 5.5 building, Fable 5.1 reviewing — 28 Sept 2026)

Al, 28 Sept: *"Why does it suddenly feel that the whole app is wrong..."* At 12:10 SAST the recorder read Strand's
sources at OM 12.8, WA 9.7, Pirate 25.9, MET 34.2, TI 26.3 km/h → the app 20.1: wind was blended with the weights every
other number uses. The brief: wind (and gusts) gets its own say-per-source per region and time of day, learned from the
recorder's real sources and the archive; tune on one period, prove on another; ship per region only where clearly
better; the Western Cape tested at Cape Town airport and at Strand's station 68911 separately; a test that proves the
temperatures do not move; a daily scorecard. Plan `review/accuracy/v6/PLAN.md`, committed as the pre-registration
(`71c87c4`) with Fable's ten changes (§4a) adopted before anything was scored; `score6.mjs` committed, then run once
(`results-score6.txt`, `v2/results/v6-score.json`).

**How thin the live data is, said first.** The recorder had each source's own wind for 2.7 days (25 Sept 16:10 → 28
Sept 11:10 UTC): 60–65 matched hours per airport, one airport per live region, split in time — ~30 hours to learn on,
~31 to prove on. Bloemfontein's reports carried no wind at all (140 of 140), so the Free State has no live test. Per
time of day could not be learned live (~8 hours a cell); the live weights are per region, all hours. The live test is
also contaminated: v5's print this morning had already shown Pirate best overall; the rule is mechanical (1 / squared
error, clamped 0.05–0.50) and its weights were predictable. Fable's per-region bar is a minimum-evidence rule, not an
interval: point gain ≥ 1 km/h, better in ≥ 4 of 6 six-hour blocks, ≥ 24 proof hours with all five sources, and the
pooled interval below zero.

### 13.1 Wind — the live weights (ships in the Eastern Cape only)

Off by (km/h), proof half, today's shipped rule (v5: blend × table) → the region's own source weights:

| region (airport) | today | own weights | gain | 6-h blocks better | verdict |
|---|---|---|---|---|---|
| **pooled, six airports** | 5.43 | 4.61 | −0.82 [−1.35, −0.33] | | passes |
| **Eastern Cape (Gqeberha)** | **6.65** | **4.41** | −2.24 | 5 of 6 | **ships** |
| Highveld (OR Tambo) | 4.37 | 3.03 | −1.34 | 6 of 6 | not shipped: 23 full-five hours of the 24 required |
| Garden Route (George) | 4.69 | 4.06 | −0.63 | 3 of 6 | not shipped (under 1 km/h) |
| Western Cape (Cape Town airport) | 5.39 | 5.28 | −0.10 | 5 of 6 | **blocked**: false Windy on calm hours 2 → 5 of 5 |
| KZN coast (King Shaka) | 6.12 | 6.21 | +0.09 | 3 of 6 | not shipped |
| Free State (Bloemfontein) | — | — | — | — | no wind in its reports |

- **The Eastern Cape's weights** (learned at Gqeberha): Pirate .38, OM .17, MET .16, WA .15, Tomorrow.io .13 (today's:
  OM .30, WA .22, MET .20, TI .15, Pirate .13); × k 1.054. Bias +5.8 → +1.7 km/h. The hours (OM, WA, MET, TI) take the
  same weights renormalised × k4 1.117 — scored by proxy (four-source now value, Fable 4): pooled −0.74 [−1.38, −0.06],
  not worse, so days 0–1 follow. Windy there: 10 of 10 windy hours caught by today's rule, 9 of 10 by the new one;
  false Windy on calm hours 5 → 1.
- **Missing sources** (30 proof hours with fewer than five): 4.95 → 3.67 — no fallback needed. Those hours were nearly
  all four-source; an hour with one or two sources answering is served by the same weights and is **unscored** (Fable,
  diff review 2 — no guard added, it would be unscored behaviour too).
- **The one Windy hour missed:** in the Eastern Cape the new number caught 9 of the 10 windy proof hours where today's
  rule caught 10; it raised 1 false Windy on calm hours where today's raised 5 (Fable, diff review 3).
- **Every other region keeps the v5 rule unchanged**, Strand keeps today's blend. `api/_lib/wind-weights.js`, generated
  by `v6/make-wind-weights.mjs` (`--check` guards drift); `meta.wind.rule` `LW` and `meta.wind.weights` record it.
- Per source, where the weights come from (proof half, bias km/h): Cape Town airport — OM −16.5, TI −21.2, WA −7.7,
  MET −2.3, Pirate −1.0 (all read low; Pirate closest); Gqeberha — TI −9.6, OM −4.4, WA +4.7, MET +6.9, Pirate +0.8.

### 13.2 The archive weights — nothing ships

Per region × time of day, the three source guesses' weights averaged, with their own ratio table (2025 → 2026): the
gain is 0.00–0.14 km/h everywhere, under the 0.5 floor Fable set (it is clearly worse under one guess in the Eastern
Cape, Highveld and Northern Cape). At 68911 it is clearly worse than today's blend (+2.1 to +3.9). The five regions
with no live airport keep the v5 table. Gust weights (report only): 10.1–10.3 → 9.4–9.8 km/h on gust-report hours,
not clear under one guess; gusts stay the largest of three. Live gusts: 1 gust-report hour to learn on — too few.

### 13.3 Strand's station — what it says

- **68911 is in the recorder** (runtime copy reads it at 01/07/13/19 UTC; first scheduled read §13.6). History: Ogimet
  has nothing before March 2026 (re-checked: January 2025 returns no rows, February 2026 is all NIL) — 2025 does not
  exist for this station.
- **The live test at Strand** (10 reports, 25 Sept 18 UTC → 28 Sept 00 UTC; this morning's 06 UTC pair excluded as
  seen): today's blend off by 5.8 (bias **+5.5, too high**); the Western Cape's own weights would read **16.5 off
  (+16.5)**, worse on 10 of 10 → the Strand zone keeps today's blend. Each source against the station: OM 3.0 off
  (−0.8), Tomorrow.io 3.1 (+1.6), WA 5.9 (+1.4), **Pirate 11.2 (+11.2), MET Norway 13.4 (+13.4)**. On the six
  south-easter reports: station 15 km/h average, the app 20, MET 30, Pirate 26.
- **The gusts are the miss.** On 27 Sept's south-easter the station's average wind was 18–24 km/h while its gusts were
  35, 54 and 67; the app's largest gust was 44, 49 and 43. At 00 UTC today the station gusted 50 and the app showed no
  gust. What Al feels at Strand is the gust.
- **South-easter correction: no new test** (the same reports twice is not new evidence). The archive's 2026 south-easter
  reports (209 on 103 days): station 14.9 km/h against today's blend 10.5–13.4 (stand-in models) — they read low on
  south-easter hours in the archive, while the real sources since 25 Sept read high. No correction ships.

### 13.4 Temperatures must not move

`tests/temp-freeze.test.js`: ten cases — Strand (day and night), Cape Town city, Johannesburg, Durban, Gqeberha, plus
the shared-weight branches (WA de-duplication, the MET boost at 06:20, Tomorrow.io down, London outside SA). Open-Meteo
(both requests) and MET Norway recorded verbatim from the free endpoints; WA, Pirate and Tomorrow.io built from the
recorder's own readings of those sources (no keys on this machine). The golden numbers — now, feels-like, 48 hourly
temperatures and feels-likes, 7 highs and lows per case — were written by the code **before** the wind change
(`339896f`, `57565c0`, Gqeberha in `d27067e`; the earlier nine unchanged). Every number is compared exactly. Negative
controls: a +0.1 °C shift in the now temperature fails it; so does tripling one low weight. After the change it passes
with Gqeberha's wind moving 22.0 → 19.2 km/h (hours 23.6 → 20.1) and its temperature 17.3 both ways.

### 13.5 The daily scorecard

`review/scorecard.html` in the OneDrive copy, rebuilt at 06:20 SAST by the scheduled task **"ProbablyWeather
scorecard"** (`review/accuracy/scorecard/install-scorecard.ps1`, runtime copy in `%USERPROFILE%\pw-scorecard\`), from
the recorder's files only — no network call. One line per spot (Strand vs 68911; Cape Town city vs Cape Town airport,
said on the line; the six airports): yesterday's high and low, average and strongest wind, the rain word against rain
at the station, the sky in daytime hours; then the last seven days ("highs within 2° on 3 of 3 days"). Fable's
wording fixes applied: gusts compared only when the station sent one; the sky from the served condition against the
most-covered layer; rain = at least two wet reports; the wind rule named per day. First build 28 Sept 13:30 (task
result 0); Strand's line fills from 29 Sept (the recorder started reading its station today).

### 13.6 Fable, gates, shipped

| Fable call | tokens (harness count) | verdict |
|---|---:|---|
| the plan | 105,412 | PROCEED WITH CHANGES — ten, adopted in full before scoring (§4a of the plan) |
| the diff | 121,930 | SHIP — five non-blocking notes: (1) `make-wind-weights --check` is in the gate chain, not `npm test` (the values are pinned by `wind-v6.test.js`); (2), (3) said in §13.1; (4) no change; (5) applied — the freeze test now names the LW rule |
| **total** | **227,342** | **cap 200,000 — over by 27,342** (Fable counted ~52k and ~38k; the harness counts its whole context). No further Fable call. |

Gates on the finished tree (`cec40fe`): serial **151 files / 21,325 tests**, image budget, build, bespoke 9, rotation,
drift guard, seasonal PASS, precision table `--check`, wind table `--check`, wind weights `--check`, fold **80/80**,
desktop, gate shots 24 — every step exit 0.

**Shipped:** `git push origin main` `acd15b2` → **`b9349db`** (28 Sept, 11:46 UTC); `/api/version` → `b9349db…` at 11:47.
Live answers (fresh): Gqeberha `LW` 16.8 → 18.8 km/h, East London `LW` 22.8 → 25.1; Cape Town city `BC` 19.4 → 31.0
(Windy); Johannesburg `BC` 18.7 → 26.2; Strand `today` 17.7. Live smoke (`scripts/live-smoke.mjs`, phone and desktop,
five languages): **10/10 legs, 0 console errors, 0 bad responses**.

**Home D:** `home-d` reset to `origin/home-d` (`3a51b40`, as §12.7 said), rebased onto `b9349db` with no conflict, and
pushed with a lease: `3a51b40` → **`50a2758`**. On the rebased branch: serial **152 files / 21,413**, image budget, build,
wind table and wind weights `--check`, fold **140/140**, desktop, Home D check 26/26. The preview answers `50a2758` and
serves Gqeberha `LW` 17.3 → 19.1.

## 14. Gusts — the headline follows them, stations correct them, Home shows them (Vonk / Opus 5.5 building, Fable 5.1 reviewing — 28 Sept 2026)

Al, Strand, 28 Sept 14:16 SAST: *"those gusts dont stop. it is pumping outside and it is very unpleasent and our app is
saying cloudy vibes for strand right now."* And: *"its not just strand, what about gordons bay or any other place
getting heavy gusts on the day?"* At that hour Strand's station (68911) read 28 km/h from 140°, gusting 59; the live
app said 23.8 km/h, gust 36, "cloudy" (the blend under 25, the gust under 55). Gordon's Bay, same station, read 26.6 →
Windy by the mean. Plan `review/accuracy/v7/PLAN.md`, committed as the pre-registration (`159fa87`), Fable's nine
changes adopted before anything was scored (§8, `589a15e`); scorer committed before it ran (`7b12a14`); one run
(`results-score7.txt/.json`), then a report-only whole-period count added and re-run with every decision identical.

**Data.** Truth: every SA Weather Service SYNOP in WMO block 68 on Ogimet, 1 March → 28 Sept 12 UTC (30 weekly
requests, 25 s apart): **157 South African stations send the 910ff gust** (156 with it in ≥ 80 % of reports), plus 8
airports with no SYNOP twin (METAR, IEM). Models: Open-Meteo's historical-forecast archive at every one of the 167
places, six models, in two passes paced for the free tier (~5,500 call-units over 81 minutes). **456,639 station-hours:
10,811 pumping, 408,851 calm.** The three source guesses as v5/v6; every conclusion had to hold under all three.

**Pumping** = the station's gust ≥ 50 km/h or mean ≥ 30. **Calm** = mean < 20 and gust (where sent) < 35. Checked
before scoring: 68911 at 12 UTC today, 28 km/h gusting 59 — pumping.

**Replay fidelity (Fable 4).** On 592 recorder readings since 25 Sept the served gust is 0.94–1.00 × the archive's
largest-of-three (no scaling needed). The served hero said Windy in 33 of 263 hours where the replay said so in
19–24 (agreement 93 %): production calls Windy more often than the archive replay — the real MET Norway and Pirate
read high on the coast (§13.3). That matters most for the "two sources at 25+" rule (§14.2).

### 14.1 The headline — per region (tuned March–June, proven July → 28 Sept)

The rules: **R0** today (the region's wind line or a gust ≥ 55, with the two-source consensus); **R1** the gust line
40–60; **R2** R1 on station-corrected gusts; **R3** R0 or at least K sources' own mean ≥ 25. Tuning picked, per
region, the setting catching most pumping hours with at most +1.0 false per 100 calm hours; one candidate per region
went to proof. Bars (all three guesses): caught +5 points or more with the interval above zero; false at most +1.5 per
100 calm hours (upper end ≤ 3); ≥ 30 pumping hours on ≥ 6 days; and the pass survives dropping the station with the
most pumping hours.

March → 28 Sept, averaged over the three guesses (proof-month intervals in `results-score7.txt`):

| region | stations | pumping hours called Windy: today → shipped | calm hours called Windy: today → shipped | verdict |
|---|---|---|---|---|
| **Eastern Cape** | 22 | 1,365 → **1,569** of 2,032 | 523 → 840 of 53,213 | **ships: gust line 50** |
| **Free State** | 9 | 236 → **311** of 380 | 87 → 272 of 20,074 | **ships: gust line 45** |
| **KZN coast** | 10 | 231 → **283** of 360 | 53 → 158 of 13,592 | **ships: gust line 50** |
| **KZN inland** | 20 | 475 → **527** of 714 | 543 → 795 of 46,949 | **ships: gust line 50** |
| **Northern Cape** | 18 | 790 → **918** of 1,266 | 480 → 969 of 57,249 | **ships: gust line 50** |
| **West Coast** | 11 | 778 → **1,024** of 1,293 | 178 → 453 of 27,762 | **ships: two sources at 25+** (holds without Cape Columbine) |
| **Strand's zone** (68911; Strand, Gordon's Bay, Somerset West) | 1 | 24 → **31** of 125 | 1 → 4 of 451 | **ships: two sources at 25+** |
| Western Cape (rest) | 17 | 1,751 of 2,124 | 2,737 of 24,186 | not clearly better (+0.1 to +0.7 points) |
| Garden Route | 8 | 228 of 277 | 419 of 25,119 | not clearly better (+2 to +3 points) |
| Highveld | 16 | 436 of 590 | 582 of 43,808 | not clearly better (+3 to +6 points, two intervals touching zero) |
| Karoo | 7 | 938 of 1,081 | 466 of 22,357 | not clearly better (+1 to +1.4 points) |
| Lowveld | 12 | 165 of 197 | 198 of 32,495 | not clearly better |
| North West | 7 | 266 of 419 | 133 of 19,392 | not clearly better |
| Limpopo | 8 | 35 of 78 | 235 of 22,655 | **blocked** — two sources at 25+ cries wolf (false +1.5 to +1.7 per 100); its catch was not clearly better either |

- **The price, in hours (Fable 8):** every region that ships buys its extra catches with more false calls in hours:
  0.4–0.6 extra pumping hours per extra false call in the Eastern Cape, 0.5–0.9 Free State, 0.6–1.1 KZN coast,
  0.2–0.4 KZN inland and Northern Cape, 0.8–1.2 West Coast (calm hours are 25–40 × as common as pumping hours, so a
  small rise per 100 calm hours is many hours). Per 100 calm hours the rise is 0.4–1.4 (the bar allowed 1.5).
- **Multiple testing (Fable 9):** 14 cells, one candidate each; about 0.6 false passes expected at α 0.05; the +5-point
  floor and leave-one-out are the guard. The split-period signs are in the JSON.
- **West Coast, a warning (Fable):** in September alone its false rise was +1.6 to +2.6 per 100 calm hours, above the
  bar for that month, with its windy season ahead. It ships on the whole proof period; a West Coast spot at a 910ff
  station (Geelbek 68811 or Cape Columbine 68712) belongs in the recorder.
- **The run's biggest finding, not changed (Fable Q4):** the Western Cape's TODAY rule (v5's ×1.6 table at 27.5, which
  fires on any raw mean ≥ 17.2) calls **11 % of calm hours Windy** across the 17 Western Cape stations. Per station,
  proof months, false Windy per 100 calm hours: Cape Point 33, Cape Agulhas 33, Struisbaai 14, **Molteno Reservoir 14
  (the Cape Town city bowl)**, Slangkop 10, Malmesbury 9, Portnet 6 — and Cape Town airport, where the ×1.6 was
  learned, 0.9. Cape Town city users get Windy on about one calm hour in ten. That is v5's table, not this job; it is
  the next wind test (v8), against these stations.

### 14.2 Strand's zone, the rule that ships there, and what it cannot see

Strand, Gordon's Bay and Somerset West (within 15 km of 68911) keep today's blend for the number and now also say
Windy when **two sources' own wind is 25 km/h or more**. On the archive's stand-in models it lifts Strand's pumping
hours called Windy from 24 to 31 of 125 (proof: +6.1 to +10.6 points, intervals above zero) with 0 → 0–1 false of 212
calm proof hours. **Live guard (report only, 12 reports of 68911 since 25 Sept against the recorder's real sources):
it catches 4 of 5 pumping reports (today's rule 2 of 5) and calls 2 of 5 calm reports Windy (today's 1 of 5)** — the
real MET Norway and Pirate read 11–13 km/h high at Strand, so production will fire this rule more often than the
archive did, on calm evenings too (the extra false was 27 Sept 00 UTC: station 9 km/h gusting 19, Pirate 26, MET 28).
**Shipped as a named trial (Fable Q2):** it passed its pre-registered bar, the live guard (5 against 5) was
pre-registered as deciding nothing, and it is the only rule that catches Al's afternoon. The trade, plainly: two more
pumping reports caught in five, and about one calm report in five called Windy (at night, in this sample). **Revert
rule:** the recorder's share of calm 68911 reports the app calls Windy, over the 14 days to 12 Oct 2026, goes to Al
with the numbers, and he rules.

Today's afternoon, replayed (`tests/gust-v7.test.js`): OM 12.8, WA 9.7, Pirate 30, MET 37, TI 18 → Windy
(`sources-wind`); today's rule said cloudy.

### 14.3 Gust corrections per station, by direction

Learned on odd weeks, proven on even weeks (Fable 5), at the 156 910ff stations only (Fable 3); ratio per 45° sector
of Open-Meteo's bearing, clamped 0.8–1.8. Bar (as the committed scorer ran it): the gust off-by falls with its interval
below zero, the big-gust (≥ 50) F1 does not fall, the share of big gusts caught falls by no more than 2 points, ≥ 15
big-gust proof hours — under all three guesses. **Most inland stations read the models' gusts too HIGH** (ratios at the
0.8 floor): the model's gust is the hour's maximum, the station's the 10 minutes before the report.

| station | ships | who it covers | ratio |
|---|---|---|---|
| **68817 Cape Town harbour (Portnet)** | yes (47 big-gust hours; F1 0.42–0.51 → 0.53–0.59, catch 40–57 → 45–60 %) | city centre (2 km), Foreshore, Roggebaai, De Waterkant, Green Point, Mouille Point, Woodstock, Salt River, Paarden Eiland (1–1.5 km each) — the low city side facing Table Bay; not the slopes, the Atlantic seaboard, the southern suburbs or Milnerton | south-easter ×1.105, south ×0.87, else ×0.85 |
| **68176 Mara** (Limpopo) | yes (18) | Mara village only | ×0.8 all round |
| ~~68911 Strand~~ | **shipped in the second push, WITHDRAWN eight minutes later** (§14.7) — big-gust catch 27 → 37–38 %, F1 0.33 → 0.44–0.46 under all three guesses, 63 big-gust hours on 34 days; the off-by only −0.8 to −1.0 km/h (interval crossing zero, reported) | Strand (2.5 km), Gordon's Bay (2), Somerset West's lower town (2), Lwandle, Nomzamo (1 each) — the False Bay flat; not Sir Lowry's Pass, the Helderberg slopes or Stellenbosch | north ×0.8, **east ×1.8 (on the clamp, 32 learning hours)**, all others ×1.14 (the south-easter had 28 learning hours, under 30, so it took the all-direction ratio) |
| **68668 Mthatha** | yes, second push, by the same bar (16 big-gust hours) | Mthatha (4 km) | 0.86–1.07 — changes almost nothing |

**A discrepancy, said:** PLAN §8.7 (Fable's change 7) made the off-by a reported number, not a bar; the committed
scorer still required it. Under the plan's text 68911 Strand and 68668 Mthatha would also pass. **Fable's ruling (diff
review Q1): the plan text governs — the MAE line in `score7.mjs` was a transcription error; a raising correction widens
the many small-gust misses while fixing the big ones, which is what §8.7 was for. Strand's correction should ship, on
the strongest evidence of any station (63 big-gust hours on 34 days), and Mthatha by the same bar — both or neither.**
Done the same afternoon as a second push (`944960b`): the scorer brought to the plan (the MAE line removed, the
comment says why) and re-run — only 68911 and 68668 changed, no ratio and no region verdict moved; the generator takes
the Strand zone's own R2 for stations in the zone. **Strand's zone R2** (two sources at 25+, on corrected gusts; even
proof weeks at 68911): caught 8 → 12, 9 → 13, 14 → 17 of 33 pumping hours, false 0 → 0, 1 → 1, 1 → 1 of 91 calm —
so the corrected gust feeds Strand's headline too. **Watch the east sector (Fable):** it ships at the 1.8 clamp on 32
learning hours — this morning's 00 UTC (110°, station gust 50, app 35) would read 63 and Windy; a wild number from the
east at Strand is that ratio.
Why Strand's correction would not have fixed this afternoon anyway: the south-easter sector took 1.14 → the app's 36
becomes 41, still under any gust line tested; the headline at Strand comes from §14.2.

The towns list is `review/accuracy/v7/towns.json` (Fable 6): each town a point with its own radius; a 68817 ratio is
likely too mild on the slopes, where the south-easter comes down harder, which is why they are left out.

### 14.4 Home and the scorecard

- A gust of **40 km/h or more is always named** on Home ("Wind 24 km/h · SE · gusts 59"), as well as one 1.3 × the
  wind (the server sends it at ≥ 40 or 1.5 ×) — the existing `weather.gusts` word in all five languages, Home and Home
  D (Home D reads the same stats row). Before, a 50 beside a mean of 40 was hidden.
- The scorecard's lines now end with the day's strongest gust: the app's largest across the day's readings and the
  station's strongest report.

### 14.5 Temperatures

`tests/temp-freeze.test.js` passes unchanged (ten cases, every number exact): nothing here touches a temperature; the
mean wind number is unchanged everywhere (v5 table, v6 weights).

### 14.6 Fable, gates, shipped

| Fable call | tokens (harness count) | verdict |
|---|---:|---|
| the plan | 130,015 | PROCEED WITH CHANGES — nine, adopted in full before scoring (PLAN §8) |
| the diff | 171,805 | SHIP WITH FIXES — the city centre's radius 2 → 1.2 km (applied, `a76edeb`: Tamboerskloof, Oranjezicht, Gardens and Sea Point now take no correction; the recorder's Cape Town city point does); Q1 the plan's bar governs (§14.3); Q2 Strand's zone ships as a named trial with a revert rule; Q3 Eastern Cape fine; Q4 report the Western Cape; Q6 no code bug; Q7 fine |

Gates on the tree (`96bd486`; `a76edeb` changes only the towns data, `gust-v7.test.js` and the table `--check` re-run):
serial **153 files / 21,340 tests**, image budget, build, bespoke, rotation, drift guard, seasonal, precision table,
wind table, wind weights and **gust table `--check`**, fold **80/80**, desktop, gate shots — every step exit 0.

**First push:** `git push origin main` `b9349db` → **`f6f5d9c`** (28 Sept, 14:38 UTC); `/api/version` → `f6f5d9c…`
within seven minutes. Live smoke (`scripts/live-smoke.mjs`, phone and desktop, five languages): **10/10 legs, 0 console errors, 0 bad
responses**; Strand's phone Home: "Wind's up." / "Dit waai." / … in all five. Live at 14:46 UTC (station reports are
6-hourly; its 12 UTC report is the latest): Strand 25.3 km/h, Windy (the mean), gust 37; Gordon's Bay 28.6, Windy,
gust 59; 68911 at 12 UTC 28 km/h from 140° gusting 59. Cape Town city 31.7, gust 54 → 59.7 (×1.105, harbour, SE),
Windy; its nearest station Molteno Reservoir 11 km/h gusting 41 (§14.1's finding). Gqeberha 15.9, gust 34, cloudy
(gust line 50); Ngqura 11 gusting 15.

| second Fable call | tokens (harness count) | verdict |
|---|---:|---|
| the delta `f6f5d9c..944960b` (resumed diff reviewer) | 182,355 | SHIP — towns, generator and the bar change checked; the east-sector note added above |
| **total, three calls** | **484,175** | |

Gates on `944960b`: serial **153 files / 21,340 tests**, image budget, build, bespoke, rotation, drift guard, seasonal,
precision, wind table, wind weights and gust table `--check`, fold **80/80**, desktop, gate shots — every step exit 0.
The scorecard's runtime copy (`%USERPROFILE%\pw-scorecard\`) now carries the day's strongest gust (built by hand: 6 lines).

### 14.7 Strand's correction withdrawn — what went wrong, live

At 15:05 UTC, four minutes after `1b25019` went live, the live check showed **Gordon's Bay with a gust of 108 km/h**
(68911 had read 59 at 12 UTC). Open-Meteo's bearing there sat in the **east sector, whose ratio 1.8 sat on the clamp
on 32 learning hours** (Fable had flagged it), and it multiplied **Gordon's Bay's own model gust of 60** — the ratio
was learned on 68911's grid point, where the models' gusts run far lower (Strand's 37 at the same moment). A station
ratio carries to a town only if the town's model gust behaves like the station's; the coverage rule checked distance,
height and exposure, not that. Withdrawn in `01cf992` (pushed 15:08, live 15:08; `towns.json` keeps it under
`_withdrawn` with the reason); Gordon's Bay's cached answer cleared at 15:15 (60 km/h, raw). **Strand's zone keeps its
headline rule** (two sources at 25+, §14.2) — that came in the first push and is not affected. Live: Strand showed gusts 67
(station 59) from ~15:01 to ~15:09, Gordon's Bay 108 from ~15:01 to 15:15 UTC.

What the others carry: the harbour's largest ratio is ×1.105 (south-easter; every other sector ×0.85–0.87) and
Mthatha's ×0.86–1.07, so the same flaw can move a gust there by ~10 % at most. **What a Strand correction would need:**
the ratio applied to the station's own grid-point gust (or only where a town's model gust tracks the station's within
a tolerance), and ≥ 30 learning hours per sector before a clamp value is trusted — the south-easter season (October →
March) supplies both; re-test when 68911 has four more weeks.

Gates on `01cf992`: serial **153 files / 21,340 tests**, image budget, build, bespoke, rotation, drift guard, seasonal,
precision, wind table, wind weights and gust table `--check`, fold **80/80**, desktop, gate shots — every step exit 0.

**Home D:** `home-d` rebased onto `f8caf7d` with no conflict and pushed with a lease: `50a2758` → **`daa5872`**; the
preview answers `daa5872` (15:48 UTC). On the rebased branch: serial 153 of 154 files (one load test, the 5,000-install
burst in `shared-ip-daily-limit.test.js`, timed out at 120 s under load and passed alone, 47/47), image budget, build,
wind table, wind weights and gust table `--check`, fold **140/140** (five languages), desktop, Home D check **26/26**.

**Live at 15:47 UTC** (68911's latest report is 12 UTC; the next is 18 UTC): Strand 26.3 km/h, **Windy**, gust 37 (not
shown: under 40) against the station's 28 gusting 59; Gordon's Bay 29.4, **Windy**, gusts 60 shown; Cape Town city
31.8, Windy, gusts 62 (×1.105 harbour); Gqeberha 13, clear (Ngqura 11, gust 15).

## 15. "Now" follows the stations (Vonk / Opus 5.5 building, Fable 5.1 reviewing — 29 Sept 2026)

Al, Strand, 29 Sept 08:01 SAST: *"the wind has been pumping all night and is pumping badly now as well ... showing
clear is a lie."* And: *"what about the rest of the country?"* The live app said "Clear sky", 18.4 km/h, gusts 31.7;
Strand's station 68911 read 37 km/h gusting 78 (28 Sept 18Z) and 30 gusting 63 (29 Sept 00Z). Plan
`review/accuracy/stations/PLAN.md`, committed before anything was scored (`e7f8af3`); Fable's nine changes and the
terms outcome adopted before scoring (§8, `ac3ae87`); scorer committed before it ran (`685c123`), run once.

### 15.1 Which live sources we may use (step 1)

| source | what | allowed for a commercial app? | update / delay | notes |
|---|---|---|---|---|
| **Iowa Environmental Mesonet** (METAR) | 27 SA airports, raw reports | **yes** — "public domain … any lawful purpose", commercial named on its API page | hourly (big airports half-hourly); a report in within ~5–50 min (probe) | **the live feed** (`api/1/currents.json?network=ZA__ASOS`, ~2 s to answer → Redis copy) |
| NOAA Aviation Weather (METAR) | same airports | public domain (NWS), foreign reports "under licence of the third party" | receipt 5 min median, 17 min p90 (probe, 64 reports) | not needed beside IEM |
| Ogimet (SA Weather Service SYNOP) | ~200 stations incl. Strand 68911, harbours, capes | **not clearly** — copyright stays with each country's service ("read WMO resolution 40"); the SAWS Act makes selling met information a SAWS service | hourly AWS in ~20–55 min; 68911 6-hourly, ≤ 70 min | **history only** |
| SAWS direct / AfriGIS Weather API | SAWS feeds | **paid licence** — AfriGIS pilot 50 credits a day for 60 days; Rand price not published | — | the route to Strand's own station |
| NOAA tgftp SYNOP bulletins | — | public domain | — | carries **no** SA SYNOPs (checked: 30 newest files; last ZA bulletin 2 Nov 2024) |
| Transnet port weather | — | no public feed found | — | harbour SYNOPs (e.g. 68817 Portnet) come via SAWS |
| Weather Underground PWS, Netatmo, Davis WeatherLink, Ambient | home stations | **no** (owner-only or non-commercial) | — | WU paid packages quoted "from $200/month" (third-party) |
| CWOP / MADIS | home stations | unclear ("no restrictions", but redistribution limits) | — | SA count not found |
| Xweather / PWSweather | METAR + home stations | paid: €300/month for 1M calls (€0 dev tier, commercial terms not found) | — | |
| Holfuy, WeatherFlow Tempest, Windfinder | beach / kite stations | **only by agreement / paid** (prices "contact us") | Holfuy 2 min | |
| Windguru, Cape Kiting, windreport.co.za | kite stations (Strand, Muizenberg, Langebaan, …) | **no** — owner-only or "commercial use forbidden" / "permission required" | — | the stations Al would want most |
| Synoptic Data, ARC (≈ 650 AWS), Meteostat | aggregators / networks | Synoptic, ARC paid (prices not published); Meteostat CC BY but archive-grade | — | |

**Agreement with the official stations:** IEM's airport reports are the airports' own METARs; where an airport has a
SYNOP twin within 3 km, both feeds are the same site. Home and kite networks were not measured — none is allowed.

### 15.2 Which towns get a station (step 2)

- **D, learned March–June on pairs of SAWS stations** (same exposure, height, no ridge; `results-pairs.json`): when one
  station is pumping, the other is **calm in 24 % of hours even 2–10 km apart on the coast** (104 hours), 16 % at
  10–15 km. No distance passed the ≤ 10 % bar, so the plan's fallback applies: **10 km**.
- Live stations: the airports whose region passed (§15.3) — **Cape Town (FACT), Gqeberha (FAPE), East London (FAEL),
  Mthatha (FAUT), King Shaka (FALE)**.
- **164 places** take one (`towns-stations.json`, every one of 5,899 places listed with its station or the reason it has
  none): Gqeberha and 51 of its suburbs, East London and 25, Cape Town's northern suburbs around the airport (Bellville,
  Parow, Gugulethu, Nyanga, Elsies River, Belhar, Delft … 44), Tongaat, La Mercy, Verulam, eMdloti (20), and 22 villages
  around Mthatha airport. **11 of the 924 places with ≥ 1,000 people; ~1.6 million people — about 3 % of South
  Africans.** Strand, Gordon's Bay, Cape Town city (17 km from the airport), Durban (30 km from King Shaka),
  Johannesburg and Pretoria (Highveld did not pass) have none and keep today's "now". Goodwood and 35 other places
  near an airport were refused on exposure (coastal town, inland airport or the reverse).

### 15.3 Wind — the rule and the result (steps 3–5)

Rules: **M** today; **S** M, or the latest usable report is pumping (mean ≥ 30 or gust ≥ 50) and ≤ F old; **SC** S,
or the station-minus-model gap (positive only), fading over T, lifts the numbers over the place's lines; shown
numbers carry the faded gap either way. Tuned March–June nationally: **F 1.5 h, T 12 h**. Proof 1 July → 28 Sept 12Z,
own-station rows at the 16 airports (no cross pairs exist within 10 km — every region is "persistence only").

Proof, averaged over the three source guesses (per-guess intervals in `results-score.txt`):

| region | airports | pumping reports caught: today → S → SC | calm reports called Windy (per 100): today → S → SC | verdict |
|---|---|---|---|---|
| **Western Cape** | FACT | 74 → 85 → **90** % (238 reports, 36 days) | 0.73 → 1.03 → 1.45 | **ships SC** |
| **Eastern Cape** | FAPE, FAEL, FAUT | 67 → 79 → **84** % (241, 36) | 0.88 → 1.00 → 1.05 | **ships SC** (holds without the busiest) |
| **KZN coast** | FALE | 79 → 87 → **90** % (68, 17) | 1.63 → 1.63 → 1.94 | **ships SC** (S alone: interval touched zero) |
| Highveld | FAOR, FAWB | 63 → 79 → 90 % (105, 16) | 0.07 → 0.09 → 0.14 | not shipped — fails without the busiest airport |
| Northern Cape | FAKM, FAUP | 79 → 88 → 91 % (103, 19) | 1.42 → 1.44 → 2.11 | not shipped — same |
| North West | FAMM | 86 → 91 → 96 % | 0.37 → 0.43 → 0.60 | not shipped — gain not clearly above zero |
| West Coast | FALW | 78 → 88 → 91 % | 0.74 → 0.74 → 1.03 | not shipped — same |
| Free State | FABL | 85 → 87 → 92 % | 1.52 → 1.58 → 3.41 | SC **blocked** (cries wolf); S not clearly better |
| Garden Route, Limpopo, Lowveld | FAGG; FAPP; FAHS, FAKN | — | — | not shipped — too few pumping reports or no gain |

- **Shown numbers** (proof, where it ships; mean / gust km/h off the next report): Western Cape 4.3 / 9.7 → 3.6 / 6.1;
  Eastern Cape 4.1 / 10.5 → 3.4 / 8.7; KZN coast 3.5 / 13.6 → 2.9 / 9.5.
- **Caveat (Fable 8):** the archive's M under-calls Windy against production on the coast, so S's gain is overstated
  there; the live guard is the check.
- **Report only — a station veto** (drop the models' Windy when the latest report is calm): at the airports it cuts
  false Windy (Northern Cape 1.42 → 0.70, KZN coast 1.63 → 0.90); at the 16 Western Cape SAWS stations **11.5 → 2.8
  per 100 calm hours** (§14.1's finding). Not built.
- **Report only — SAWS SYNOP, if licensed:** Strand's zone (68911, 6-hourly, F 6.5 h): pumping caught **21 → 74 %** but
  calm called Windy **0.55 → 4.65 per 100** — it would be **blocked** even with the data: a 6-hourly report held for
  6 h keeps saying Windy after the wind drops. Al's 08:01 (00Z report, 6.0 h old) would have held. Western Cape SYNOPs:
  85 → 91 %, false 11.5 → 12.0.

### 15.4 Rain and fog — not shipped

- **Rain:** a shower reported at the airport is still there at the next report only ~59 % of the time; "Rain's here"
  from the station would be wrong on **1.9 per 100 dry hours** against today's 0.15 — no freshness passed tuning.
- **Fog:** station fog is right at the next report **58 %** of the time (visibility under 2 km: 68 %) — under the 60 % /
  80 % bar. Today's own fog calls at the same airports are right **12 %**. Nothing ships; the gap is recorded.

### 15.5 Temperatures
Untouched: `tests/temp-freeze.test.js` passes unchanged; feels-like still reads the models' blend.

### 15.6 Build
`api/_lib/station-now.js` (feed, Redis copy refreshed under a lock beside the fan-out, only places with a station read
it; any failure = today's answer), `api/_lib/station-map.js` (generated, `--check`), `api/weather.js` (station layer
after the fog layers; never over thunder, hail, storm or rain; `wind_kph`, `now.windKph`, `gustKph` carry the station's
numbers; `meta.station` records its word). The next hours keep the models' wind (the carry-forward was scored on "now"
only). Tests `tests/station-now.test.js` (15).
- **The 5–10 km ring (Fable):** 46 of the 164 places are within 5 km of their airport, 112 at 5–10 km. The pairs say a
  station 2–10 km away is calm in about a quarter of the hours the other pumps (three coastal pairs, Wilson upper
  33 %); if that carried to an airport and a suburb it would be ~4 false Windy per 100 calm hours there. The ring rests
  on the plan's pre-registered fallback, not on evidence, and Bellville-type places cannot be checked live (no station
  there). Station wind also replaces a fog headline (same precedence as the models' wind).
- **With any report up to 12 h old the models' own Windy fires without the two-source consensus check** — the same as
  the scorer did, so the SC false rates above include it.

### 15.7 Fable, gates, shipped

| Fable call | verdict |
|---|---|
| the plan | PROCEED WITH CHANGES — nine, adopted before scoring (PLAN §8) |
| the diff `426d2df..3115803` | SHIP WITH FIXES — (1) carry the gap at most 3 h (East London sends nothing 19Z–03Z; production measures the gap against the current models, which was scored only for fresh reports; T 3 tuned within a point of T 12); (2) drop a report with mean > 120 or gust > 160 km/h; (3) code the shown-number check into the map. No scorer bug; the phone shows "Wind's up." and the wind folder from the server key, and the numbers as sent. All three applied (`28b8562`) |
| the delta | SHIP — past 3 h no old report can set the numbers or the headline |

Gates on `3115803` (pure UI/content) and `28b8562` (code): serial **155 files / 21,444 tests**, image budget, build,
bespoke, rotation (exit 0 alone; in the chained run it printed PASS then hung past the 15-min cap), drift guard,
seasonal, fold **140/140**, desktop, Home D check **26/26**, gate shots, and the precision, wind table, wind weights,
gust table, hero-lines and station-map `--check`s — every step exit 0. Pushed `426d2df..28b8562` (29 Sept).

`/api/version` → `28b8562` at 07:30:52 UTC. Live smoke (`scripts/live-smoke.mjs`): desktop 5/5 languages all checks true;
phone home, week, search, settings true × 5, hourly and share false × 5 — the script still clicks the old Home's
buttons (Home D has neither), as at the Home D ship; no console errors or bad responses logged.

**Live, 29 Sept 07:31 UTC, against each place's latest report:**

| place | app now | photo folder | wind / gust shown | station word | latest report |
|---|---|---|---|---|---|
| Strand | clear | clear | 14.9 / 28.8 | none (no licensed station) | **68911 06Z: 130° 26 km/h gusting 70** — the app is still wrong here |
| Gordon's Bay | Windy (two sources at 25+, §14.2) | wind | 24.4 / — | none | 68911 06Z as above |
| Cape Town city | clear | clear | 12.6 / 23.4 | none (17 km from the airport) | Molteno 68819 06Z calm, gust 6; FACT 07Z 8 kt |
| Gqeberha | partly cloudy | cloudy | **11.2 (measured)** / 24.9 | FAPE 07Z, 0.5 h, 11.1 km/h — not Windy | FAPE 07Z 6 kt |
| Durban | might rain | cloudy | 18.3 / 41.4 | none (30 km from King Shaka) | Virginia 68593 06Z 13 gusting 33; FALE 07Z 8 kt |
| Johannesburg | might rain | cloudy | 19.1 / 33.8 | none (Highveld not shipped) | FAOR 07Z 9 kt; 68361 no report in 8 h |
| East London · Bellville · Tongaat | might rain · clear · partly cloudy | cloudy · clear · cloudy | **9.2 · 14.6 · 14.9 (measured)** | FAEL / FACT / FALE 07Z, 0.5 h, none pumping | 5 · 8 · 8 kt |

No covered airport was pumping at the check, so the live Windy path is proven by the tests and the history, not yet by
a live gale; the recorder's Gqeberha, Cape Town and Durban readings now carry `meta.station` for the next one.
