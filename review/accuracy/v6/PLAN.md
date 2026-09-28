# Wind gets its own weights, Strand against its station, temperatures frozen, a daily scorecard — the plan, written before any answer is scored (28 Sept 2026)

Al (28 Sept): *"Why does it suddenly feel that the whole app is wrong..."* Checked on the live app at 12:35 SAST for
Strand: sources' wind MET Norway 34.2 km/h, Tomorrow.io 26.3, Pirate 25.9, Open-Meteo 13.0, WeatherAPI 9.7 → the app
shows 20.2, because wind is blended with the weights every other number uses (OM 30, WA 22, MET 20, TI 15, Pirate 13):
the two calmest sources get over half the say. Al in Strand this morning: wind "pumping", palms bent hard; Yr 10 m/s
from the east (36 km/h). The brief: wind (and gusts) gets its own say-per-source per region and time of day, learned
from the recorder's live readings of the five real sources, and from the archive where the live data does not reach;
tune on one period, prove on another; ship per region only where clearly better, block where worse; the Western Cape
tested against Cape Town airport **and** Strand's station 68911 separately. Temperatures must not move (a test proves
it). A daily scorecard page for Al. Vonk builds; Fable 5.1 reviews this plan before anything is scored, then every diff.
Worktree `C:\Users\27741\pw-launch-run`, `main` = live `acd15b2` + `0b1dd38` (EVAL 12.7, records only).

## Seen before this plan (said, so nothing below is tuned on it)

- **The 10:10 UTC Strand reading** (the brief's numbers): OM 12.8, WA 9.7, Pirate 25.9, MET 34.2, TI 26.3 → served 20.1,
  rule `today` (blocked near 68911).
- **v5's live print (EVAL 12, PLAN v5 "seen")**: six airports, 25 Sept 16:10 → 28 Sept 08:10 UTC, MAE vs METAR: served
  blend 5.8, median 5.1, **Pirate 4.4, OM 7.0, WA 7.0, MET 7.7, TI 8.8**; MET +13 at Durban, −4 at Cape Town; served blend
  −9.6 at Cape Town. That covers both halves of the live window below, so **the live test is contaminated**: I know
  roughly which source was best overall. The rule below is mechanical (inverse error on the tune half, no choice made
  per region or per source by hand), which is the only defence; said plainly.
- **v5's archive results**: the wind table (today × ratio) passed; archive skill weights added only 0.04–0.08 km/h on
  top of it; the Strand transfer test failed (the Western Cape ratio reads too high at 68911); the south-easter ratio
  at 68911 was 12–42 % in the first half of 2026 and not clearly better on the second half.
- **Inventory only (no errors looked at):** 64 readings per place carry `meta.sourceNow` (25 Sept 16:10 → 28 Sept 10:10
  UTC, hourly with gaps); 68911's SYNOPs in `v2/data/synop-68911-*.txt` run Mar 2026 → 28 Sept 06 UTC (2025 and Jan–Feb
  2026: NIL); section 3 carries 1xxxx max / 2xxxx min groups and the 910ff gust; `36///` = no precipitation group
  (iR 3 = none fell) and no present weather (automatic station).

## What cannot be done, said first

- **2.7 days of live data.** One airport per live region, about 32 hours in each half. Per region × time of day
  (4 day-parts) is ~8 hours a cell — not learnable. The live weights are **per region, all hours**; per time of day comes
  only from the archive. Any live "clearly better" rests on ~1.3 days and is weak evidence however the interval falls.
- **The live recorder keeps each source's now value only**, not each source's hourly forecast. Live weights can be
  scored for the now-wind only. The hourly winds (days 0–1) would take the same weights unscored — see §1.5.
- **No season but spring** in the live data; weights learned in September are September's.

## 1. Wind — its own weights

### 1.1 Data and periods

- **Live (real sources):** the recorder's six airport lines (`FACT` Western Cape, `FAOR` Highveld, `FALE` KZN coast,
  `FAPE` Eastern Cape, `FABL` Free State, `FAGG` Garden Route) with `meta.sourceNow` and a METAR within ±40 min of
  `meta.updatedAtLabel` (as v5; duplicates by airport × moment dropped). Window: the first `sourceNow` reading → the
  last reading before `score6.mjs` runs (frozen in the results file). **Tune = the first half of each airport's
  readings in time, prove = the second half.** Each source's own wind is `sourceNow[].windKph` (Pirate's current, MET's
  instant, TI's current interval); METAR mean = `wspd` kt × 1.852.
- **Strand (real sources vs 68911):** the Strand spot's readings at HH:10 UTC matched to the 68911 SYNOP of HH:00
  (00/06/12/18 UTC; the reading 10 min after the report, ≤ 70 min). Window as above. **Never tuned on** for the Western
  Cape rule.
- **Archive:** as v5 — 16 airports, Open-Meteo previous runs of six models, METAR truth, tune 2025, prove 2026-01-01 →
  09-24, the three source guesses (`v2/temps-replay.mjs` VARIANTS), 7-day block bootstrap, 1,000 draws, seed 7.

### 1.2 Candidates (the now value)

| | rule |
|---|---|
| **BC** (baseline = live today) | today's weighted blend × the v5 table (region × season × day-part), today's blend where v5 blocked it (within 15 km of 68911, Karoo, KZN inland, outside SA) |
| **LW** (live weights) | per live region: each source's weight ∝ 1 / MSE of its own wind vs the airport's METAR on the tune half (a source with < 12 tune hours gets 0; weights over the sources that answered, renormalised), then × a ratio k = mean(METAR) / mean(LW blend) on the tune half, clamped [0.7, 1.6] (Fable's v5 display clamp) |
| **AW** (archive weights) | per region × day-part: each slot's weight ∝ 1 / MSE of its stand-in model on 2025 (per guess), normalised, then **the three guesses' weights averaged slot by slot** (one table, as v5's ratios); the AW blend × a ratio per region × season × day-part learned on 2025 for that blend (v5's `learnTable`, mean of the three guesses, clamp [0.7, 1.6]) |

- LW's weights and k are learned once, on the tune half, pooled over hours; nothing else is fitted. No per-region or
  per-source choice by hand.
- AW is scored in the archive in every region; it can ship only in the five regions with no live airport (West Coast
  FALW, Northern Cape FAUP/FAKM, North West FAMM, Lowveld FAKN/FAHS, Limpopo FAPP) — the brief's "the archive, for the
  regions the live data doesn't cover yet" — and, in a live region, only if LW did not ship there, AW passed there
  and is not clearly worse than BC on the live prove half (AW's weights need slot identities; the live data has real
  ones, so AW's slot table is applied to the real five).

### 1.3 Gates

Differences are MAE(candidate) − MAE(BC), km/h; "clearly" = the 95 % interval wholly on one side of zero.

- **LW, pooled:** prove half, the six airports together, blocks = airport × SAST day. Must be clearly below zero.
- **LW, per region:** prove half, that airport alone, **6-hour blocks** (≈ 5 per region — weaker than v5's 24 h,
  chosen because 24 h blocks leave 1–2 per region; said as a weakness). **Ships in a region only if the pooled gate
  passes and that region is clearly below zero.** Clearly above zero → blocked (BC stays). Neither → BC stays.
- **LW, Western Cape second test (Strand, 68911):** LW(Western Cape) at Strand's own readings vs what Strand is
  served today (today's blend, the v5 block), all matched reports in the window, blocks = SAST day. **LW reaches the
  Strand zone (within 15 km of 68911) only if clearly better there.** Otherwise the Strand zone keeps today's blend —
  even if LW ships at Cape Town. Clearly worse there and LW ships in the Western Cape → the 15 km block stays.
- **AW:** 2026, t0, per region: clearly below zero under all three guesses → ships in that region (subject to §1.2's
  limits); clearly above zero under any guess → blocked. t1 (the hourly array, the run 24 h earlier) not clearly above
  zero under any guess, else AW changes the now value and day 0's hours only. AW at 68911 (2026): clearly worse under
  any guess → the Strand zone keeps its rule.
- **Strand's own weights** (Strand readings vs 68911 alone): report only — about a dozen matched reports, too few.
- Reported beside every verdict: n, the airport(s), bias before/after, each source's weight, and windy hours
  (METAR mean ≥ 30 or gust ≥ 55) caught / false at the shipped Windy line (27.5 on the corrected number).

### 1.4 The Windy line

Stays at 27.5 km/h on whatever number ships (chosen on 2025 for BC; not re-tuned). The consensus check (a second
source near the line) multiplies each source's wind by the region's ratio, as today. Reported: windy hours caught /
false on the live prove half, LW vs BC, per region. A region where LW's false Windy on calm hours is more than double
BC's (and at least 3 more hours) is blocked for LW — written here, before looking.

### 1.5 Hourly winds (days 0–1)

The hourly array blends four sources (OM, WA, MET, TI — Pirate has no hourly wind). Where LW ships: the same weights
over those four, renormalised, × the same k. **Unscored live** (no per-source hourly on record) — the now value and
the first hourly row must not disagree on screen, which is why the hours follow. Where AW ships: its per-part weights
and ratio, gated at t1 as above. Days 2–6 stay raw (as v5).

### 1.6 Gusts — their own weights

- **Live:** LG = the three gust sources (OM, WA, Pirate) weighted ∝ 1 / MSE vs the METAR gust group on the tune half's
  gust-group hours, vs today's largest-of-three (G0). Needs ≥ 20 gust-group hours in the tune half **and** in the
  prove half, else report only. Gate as LW pooled + per region.
- **Archive:** AG = per region, the three gust slots weighted ∝ 1 / MSE on 2025 gust-group hours (three guesses'
  weights averaged), vs G0: MAE on 2026 gust-group hours clearly lower under all three guesses, big-gust (≥ 55) F1 not
  clearly lower under any, false big gusts on hours with no gust group not more than G0's.
- Neither passes → gusts unchanged (largest of three).

### 1.7 Recording

`meta.wind` gains `weights` (the five weights used, or null) and `rule` `LW` / `AW` / `BC` / `today`, so the recorder
and the scorecard can score the new rule per release.

## 2. Strand's station

- **Recorder:** 68911 is in the runtime copy (`%USERPROFILE%\pw-accuracy-recorder\record.mjs`, reads at 01/07/13/19
  UTC). Checked by its first scheduled read (13:10 UTC) writing a `synop` block on the Strand line.
- **History:** Ogimet (`getsynop`, the archive the Karoo stations came from): Mar 2026 → today on disk; 2025 and
  Jan–Feb 2026 confirmed NIL by one request each for Jan 2025 and Feb 2026 (a re-check, not a re-pull).
- **South-easter:** v5 found a 12–42 % under-read on south-easter reports in the first half and nothing clear on the
  second; four days have been added since. **No new test is run on the same reports** (a fresh split of the same data
  is a second look, not new evidence). Reported, not tested: at 68911 on south-easter reports (Open-Meteo bearing
  90–180°), the station's mean wind vs today's blend, and — new evidence, real sources — each source's own wind vs
  68911 on the live south-easter reports since 25 Sept. **No correction ships.** The bar stays v5's: tuned on one half,
  clearly better on the other, ≥ 14 days each side, and it can be re-run when the station has a new half of its own
  (≈ mid-2027 at the current rate, or sooner if a second archive of 68911 turns up).

## 3. Temperatures must not move

- **Fixture:** a fixed set of recorded provider responses, played through `api/weather.js`'s handler with the clock
  frozen: four places (Strand, Cape Town city, Johannesburg airport, Durban) at one moment, plus Strand at a night
  moment. Open-Meteo (main request and the precision request) and MET Norway are recorded verbatim from the free
  endpoints; WeatherAPI, Pirate Weather and Tomorrow.io have no keys on this machine, so their responses are built in
  each provider's own shape from the recorder's readings of those sources at that place (`sourceNow`, `sourceToday`),
  hours following Open-Meteo's curve shifted to that source's own now value — said in the fixture's header.
- **Golden:** now.tempC, now.feelsLikeC, every hourly tempC and feelsLikeC (48), every daily highC and lowC (7),
  computed by the code **before** any wind change and committed with the fixture in its own commit. The test compares
  exactly (`toEqual`, no tolerance). It must also show the wind path differs between the fixture places (so the
  fixture is not blind to wind). It joins the serial gate; one moved number fails the build.

## 4. The daily scorecard

`C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\review\scorecard.html`, rebuilt every
morning at 06:20 SAST (after the recorder's 06:10 SAST run; if the PC was asleep, when it wakes) by a scheduled task
**"ProbablyWeather scorecard"** running a runtime copy of `review/accuracy/scorecard/make-scorecard.mjs`. It reads the
recorder's `*.jsonl` only: **no network call of any kind** (no weather source, no place-name lookup, no METAR fetch).

- **Spots, one line each:** Strand (vs 68911), Cape Town city (no station in the city — vs Cape Town airport's METAR,
  said on the line), Cape Town airport, Johannesburg, Durban, Gqeberha, Bloemfontein, George.
- **"Yesterday"** = the SAST calendar day before the build. **What the app said:** the first reading of that day at or
  after 06:00 SAST (else the first of the day): `daily[0].highC`, `lowC`, `rainChance`; the served now-wind of every
  reading that day; the served sky at daytime readings.
- **High / low measured:** airports — max / min of that day's METAR temperatures (SAST 00–24). Strand — the 18 UTC
  report's 1xxxx max (06–18 UTC) and the 06 UTC report's 2xxxx min (the night into that morning); missing → "not
  reported".
- **Wind:** average = mean of the served now-wind at the hours the station reported, vs the station's mean wind at
  those hours; strongest = the largest wind or gust the app showed at those hours vs the station's largest gust
  group (else largest mean). Strand: its four reports. Words: "app 20, station 28 (app too low by 8)".
- **Rain:** the app's word for the day from `daily[0].rainChance` on the phone's ladder (< 10 none, < 30 unlikely,
  < 55 possible, else likely) vs rain at the station (METAR RA/DZ/SH/TS in any report that day; 68911: a 6RRR amount
  > 0, iR 3 = dry, iR 4 = not known). Right = likely & rained, or none/unlikely & dry; "possible" = hedged.
- **Sky (airports):** daytime readings (06–18 SAST), the served `now.cloudPct` (< 30 clear, 30–54 partly, ≥ 55
  cloudy) vs the METAR's highest layer (CAVOK/FEW clear, SCT partly, BKN/OVC cloudy) in the same hour: "sky right in
  7 of 11 hours". Strand's station does not measure cloud — said.
- **Running 7 days per spot:** "Highs within 2° on 6 of 7 days", lows within 2°, average wind within 5 km/h, rain
  right / wrong / hedged, sky hours right. A day with no readings says so ("no readings — PC asleep").
- Plain page: no buttons, no questions, no scripts needed to read it; light and dark.

## 4a. Fable's review of this plan — ten changes, adopted in full before anything was scored

Fable 5.1 (harness count 105,412 tokens): PROCEED WITH CHANGES. Where these collide with the text above, these win.

1. **Per-region live gate = a minimum-evidence rule, not an interval** (5 blocks cannot carry one). LW ships in a
   region only if the pooled gate passes (interval, airport × SAST day), the region's point MAE(LW) − MAE(BC) ≤ −1.0
   km/h, LW is better in ≥ 4 of that region's 6-hour blocks, and it has ≥ 24 prove hours with all five sources.
   Blocked if the point difference ≥ +1.0 or LW is worse in the majority of its blocks. Named as such on every page.
2. **Weight shrinkage:** each LW weight clamped to [0.05, 0.50] before renormalising. k learned only on tune hours where
   all five answered; if the tune half's mean METAR wind < 10 km/h, k = 1.
3. **Missing sources:** the prove half is scored with production's missing-source behaviour (weights renormalised
   over the sources that answered). Prove hours with < 5 sources are reported apart; if LW is worse there by > 2 km/h,
   LW ships with a fallback: fewer than 4 sources → BC.
4. **Hourly array by proxy:** LW4 = the same learned weights over OM, WA, MET, TI (renormalised) × its own k4 learned
   on the tune half, gated on the prove half like LW (pooled, and not clearly worse than BC). Days 0–1 take LW4 only
   where LW ships and LW4 passes; otherwise the hours stay BC and the seam between the now-wind and hour 0 is said.
5. **AW needs a practical floor:** ships in a region only if its gain is ≥ 0.5 km/h under all three guesses (on top of
   clearly better). **AG is report-only** this round (a weighted mean of gusts under-reads big gusts by construction);
   gusts stay the largest of three. (Live LG keeps its ≥ 20-hour floor; below it, report only.)
6. **Strand gate, deterministic:** LW reaches the 15 km zone only if better than today's blend on ≥ 75 % of the matched
   reports **and** MAE lower by ≥ 2 km/h; worse on the majority → the block stays. The seen 28 Sept 06 UTC pair is
   excluded. No new south-easter test (kept).
7. **Windy with a margin:** calm = METAR mean < 22 km/h and no gust ≥ 44; mean 22–30 is "near the line", reported and
   not counted. Under LW the consensus factor is k, not the v5 ratio. The rule is asymmetric (it can block LW for false
   Windy, never BC for missed Windy) — conservative on purpose.
8. **Fixture covers the shared-weight branches:** WA de-duplication, MET boost, a source down, a place outside SA —
   done before any wind change (`57565c0`: nine cases; a 0.1 °C shift in the now temperature fails it).
9. **Scorecard wording:** (a) strongest wind — with no gust group reported, "gusts not reported" (a METAR gust group
   is only sent at mean + 10 kt), never the app's gust against the station's mean; (b) sky — score the **served
   condition word** (clear / partly / cloudy family) against the METAR's **most-covered** layer (not the highest);
   (c) "rained" at an airport = precipitation in ≥ 2 reports that day (or a 6RRR ≥ 0.5 mm at 68911) — one passing
   shower is not a miss; the wind `rule` is printed per day so the 7-day run never mixes rules silently; airport
   highs are hourly-sampled whole degrees (the true max is ~0.5–1° higher) — said on the page.
10. **Seen-data ledger:** LW's inverse-error design was chosen after v5's print showed Pirate best overall; the rule is
   mechanical, but its weights are predictable — said at the verdict.

## 5. Ship

Each wind change that passes: one commit; full gates (serial incl. the new temperature test, image budget, build,
wind table `--check`, fold, desktop); Fable's diff review; push `main`; `/api/version`; live smoke; the recorder's
next reading shows the new `meta.wind`. Then `home-d` rebased onto `main` and pushed with a lease. Nothing passes →
the temperature test, the recording and the scorecard still ship (they change nothing users see).
