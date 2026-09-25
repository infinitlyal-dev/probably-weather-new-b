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
