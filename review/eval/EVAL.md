# Probably Weather — launch eval, fixes and the Home proposal (Vonk / Opus 5.5, 23–24 Sept 2026)

Production stays on `ec7ae52` (verified `/api/version`, 23 Sept 21:19 UTC). Everything below is **local**:
`main` is 18 commits ahead (`ec7ae52..758cb5f`), nothing pushed. The Home proposal is on branch
`design/home-options` (`b6d17fb`, `5b1f6ba`), not merged.

Evidence lives next to this file (`review/eval/…`, git-ignored folder, the files are force-added where
they are small; screenshots stay on disk) and in `review/accuracy/`. Every finding carries its proof.

---

## 0. What a push would ship (main, 18 commits)

| commit | what |
|---|---|
| `35c8aa8` | Al's 4 Afrikaans proposals (all USE) wired: af-1681, af-1971, af-2025, af-2083 |
| `2453a74` | Al's season ruling: N299 (12,1,2,3), B212 (1,2,3), B450 (always) kept; 59 CUT from every language |
| `b82c102` | af-2016 "wil he" → "wil hê" |
| `ca469f6` | Sesotho ban list suggests the SA spelling ("lehodimo") |
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
| `86f0f87` | Fold gate covers Al's iPhone 11 (414×896, 414×715) — 80/80 |
| `797de9e` | Search race + "OS 17" UA (Sol's review) |
| `60c72c8` | Offline: a service-worker copy of the forecast shows its age |
| `758cb5f` | review/accuracy: blend-vs-sources harness + live sample (report only; not app code) |

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
