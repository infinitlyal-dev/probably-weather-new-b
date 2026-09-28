# Wind, gusts, the sky call, the wind headline — the plan, written before any answer is scored (28 Sept 2026)

Al (28 Sept, Strand, 09:37–09:55 SAST): partly cloudy (thin high streaks, some low cloud on the mountains), the wind
"pumping", palms bent hard; Yr said 10 m/s from the east now, 10–12 m/s this afternoon, 14–15 m/s tonight. The app
said "Probably Cloudy vibes.", wind 20 km/h, 2/5 sources agree. *"If we launch the app and its weather prediction
sucks we are screwed."* His job list: wind (stop plain averaging; weight each source by how right it has been per
region and time of day, with the bias correction the precision run found; test the median too; ship whichever is
clearly better per region, block any region where it is worse), gusts the same way, a Strand/False Bay station, the
sky as the middle of the cloud readings, the headline following the wind, a replay of this morning, then ship.
Vonk builds; Fable 5.1 reviews this plan before anything is scored, then every diff. Tune on one period, prove on
another; a change reaches a region only where it is not clearly worse there. Worktree `C:\Users\27741\pw-launch-run`,
`main` = live `e688913` + two record commits.

## Seen before this plan (said, so nothing below is tuned on it)

- **This morning's recorder lines** (Strand, Cape Town city, Cape Town airport, 04:10–08:10 UTC). Strand 07:10:
  sources' wind OM 11.4, WA 10.4, Pirate 22.5, MET 39.2, TI 18.4 → served 19.2 km/h; largest gust 23 (OM); server key
  `clear` (majority override of `cloudy`, 1/5 cloudy votes), current cloud 76.56 % → the phone's sky rung (cloud ≥ 60)
  shows cloudy. 08:10: cloud 81.25 %, 2 overcast votes → `cloudy`. Cape Town airport METAR all morning CAVOK, wind
  30 → 11 km/h (04:00 → 07:00 UTC) while the served blend read 17–21.
- **The recorder's real-source wind, six airports, 25 Sept 16:10 → 28 Sept 08:10 UTC (299 hours)**, printed while
  taking inventory, before this plan: MAE vs METAR — served blend 5.8, median of the five 5.1, Pirate 4.4, OM 7.0,
  WA 7.0, MET 7.7, TI 8.8 (n 184). By airport the served→median change was 10.2→8.3 Cape Town, 4.6→4.7
  Johannesburg, 6.0→4.7 Durban, 5.1→4.8 Gqeberha, 3.1→2.9 George (Bloemfontein's reports carried no wind in the
  window). MET Norway reads +13 km/h at Durban and −4 at Cape Town; the served blend is −9.6 at Cape Town. **So the
  live check below is contaminated for the median** (seen) and only a guard, never a reason to ship. Nothing of
  the live gusts or the archive's wind, gust or cloud for any candidate below has been looked at.
- **Known from the precision run (EVAL §8.3, `v2/results/wind.json`):** on 2026, six models each corrected per
  station × season × day-part: 3.31 km/h vs best_match 4.52; the per-model ratios at Cape Town airport are 1.5–2.1
  (best_match bias there −8.1 km/h, windy hours caught 67 of 834). Largest-of-three gust 10.24 vs best_match
  corrected 10.01 (no clear gain).

## What cannot be done, said first

**Weighting each source by how right it has been cannot be learned yet for four of the five.** WeatherAPI, Pirate
Weather, MET Norway and Tomorrow.io keep no past forecasts; the archive's models are stand-ins, and the live data
already shows the stand-ins are wrong for wind (real Pirate is not GFS; real MET Norway reads 13 km/h high at Durban
and low at Cape Town — a grid-point effect no archive model reproduces). The recorder has 2.7 days at six
airports: too few for per-region × time-of-day weights. So:

- skill weights are **tested in the archive under each source guess** (does weighting by track record help at all,
  on top of the correction?) and **reported, not shipped**;
- the shipped candidates below are ones that need no source identity (a median; a correction applied to the whole
  blend, one table that must work under all three source guesses);
- the recorder keeps every source's own wind (already in `meta.sourceNow`) so the real-source weights can be learned
  once it holds enough: the plan's bar for that later step is written in §6.

## 1. Data, periods, source guesses

- **Truth:** METAR 10-minute mean wind, gust group, cloud layers at the 16 scored airports (`v2/stations.mjs` SCORED,
  11 regions), Iowa Environmental Mesonet archive. **Tune: 2025. Prove: 2026-01-01 → 2026-09-24.** Hours as `v2`.
- **Forecasts:** Open-Meteo previous runs (`v2/data/runs-*`), six models, wind and cloud at lead t0 (latest run) and
  t1 (the run 24 h earlier); gusts from the short-lead archive (`hist-*`, best_match, ECMWF 0.25°, GFS; one lead).
- **The five sources, three guesses** (`v2/temps-replay.mjs` VARIANTS, [OM, WA, Pirate, MET, TI]):
  old harness [best_match, ECMWF, GFS, UKMO, ICON] · ECMWF-heavy [best_match, ECMWF, ICON, best_match, best_match] ·
  mixed [best_match, Météo-France, GFS, best_match, ICON]. Gusts ([OM, WA, Pirate]; only three models carry gusts):
  [best_match, ECMWF, GFS] · [best_match, ECMWF, ECMWF] · [best_match, best_match, GFS]. **Every conclusion must hold
  under all three.** (ECMWF-heavy makes the median best_match whenever three slots agree — a known weakness.)
- **Today's blend, replayed:** the now-wind is `wAvg` over the five with production's weights (base 0.30/0.22/0.13/
  0.20/0.15, the WA dedup and MET boost from each slot's day high, `temps-replay.mjs productionWeights`); the hourly
  wind is `wAvg` over [OM, WA, MET, TI] with the hourly weights; the gust is the largest of [OM, WA, Pirate].
- **Bootstrap:** paired, 7-day blocks, 1,000 draws, seed 7 (`v2/lib.mjs bootDiff`; ratio statistics such as F1 by
  `v4/lib4.mjs bootStat`). "Clearly better/worse" = the 95 % interval wholly below/above zero.
- **Day-part:** SAST night 00–06, morning 06–12, afternoon 12–18, evening 18–24. **Season:** DJF/MAM/JJA/SON.
- **Live check (real sources):** the recorder's six airports, from 25 Sept 16:10 UTC to the last reading before the
  diff, METAR within ±40 min, 6-hour blocks. Guard only (see above).

## 2. Wind — the number

Candidates (the now value; the same rule per hour for the hourly array):

| | rule |
|---|---|
| **B0** today | production's weighted mean |
| **M** | median of the sources that answered (even count → mean of the two middle values) |
| **BC** | B0 × R_B[region][season][part] |
| **MC** | M × R_M[region][season][part] |
| SW (report only) | weights ∝ 1 / MSE of each slot per region × part on 2025, per guess |
| SWC (report only) | SW over each slot corrected by its own model's ratio (as `v2` "each corrected") |

- **R tables:** per region × season × part, R = mean(obs) / mean(forecast) on 2025 at t0; a cell with fewer than 40
  hours falls back to region × part (all seasons), then 1; clamped [0.4, 2.5] (the `v2` bounds). Learned under each
  guess; **the production table is the mean of the three guesses' tables, cell by cell**, and that one table is what
  every number below scores. Regions without an airport (Karoo, KZN inland) and places outside SA: ratio 1 (today).
- **Primary:** MAE vs the METAR mean wind, 2026, t0.
- **A candidate passes** when its MAE − B0's is clearly below zero under all three guesses at t0, not clearly above
  zero at t1 under any guess, and not clearly above zero on the live check. Several pass → the lowest MAE averaged
  over the three guesses at t0 ships. None passes → nothing ships.
- **Region guard:** the shipped candidate is blocked (today's blend) in any region where its MAE − B0's is clearly
  above zero under any guess at t0. Where it is not clearly worse it ships (the pooled evidence stands).
- **Hourly array (days 0–1):** takes the same rule as the now value. If the t1 check fails but t0 passes, only the
  now value and day 0's hours change. **The daily ladder (day cards) keeps reading today's raw blend** — day-card
  wind keys are not part of this test and do not change.
- Reported beside it: bias, and windy hours (station mean ≥ 30) caught / false at ≥ 25, per region and guess.

## 3. The wind headline

- **"The wind is the story"** (truth): station mean ≥ 30 km/h (a fresh breeze, as the 22 Sept harness) or a gust
  group ≥ 55 km/h.
- **Today's rule:** B0 ≥ 25 or largest gust ≥ 55. **New rule:** the shipped wind number ≥ T or the shipped gust ≥ 55,
  **T chosen on 2025 alone** from {25, 27.5, 30, 32.5, 35} by F1 (pooled over the three guesses).
- **Ships with the number** when its F1 − today's is not clearly below zero under any guess (2026, t0); precision and
  recall reported per region. If F1 is clearly worse, the ladder keeps reading today's raw blend at 25 and only the
  displayed number changes.
- The consensus check (a second source must be near the trigger) keeps its shape: a source supports wind at
  ≥ 0.8·T after the same correction, or its gust ≥ 44. The phone's numeric wind rungs (30 early, 25 late) move to
  max(30, T) and T so they cannot say Windy where the server does not.
- Proven on this morning's Strand readings (§5); nothing is tuned on them.

## 4. Gusts

| | rule |
|---|---|
| **G0** today | largest of [OM, WA, Pirate] |
| **GM** | median of the three |
| **G0C / GMC** | G0 / GM × Rg[region] (2025, hours with a gust group, ≥ 30 per region else 1, clamp [0.5, 2]) — production table = mean of the three guesses' |

- **Primary:** MAE on 2026 hours whose METAR carries a gust group (a biased sample — gusts are only reported when
  ≥ 10 kt above the mean; said). **Secondary:** the big-gust call (forecast ≥ 55) against station big gust (gust
  group ≥ 55) on all hours, F1.
- **Passes** when MAE is clearly lower under all three guesses, big-gust F1 not clearly lower under any, and the live
  check (real OM, WA, Pirate gusts vs gust groups) not clearly worse. Region guard as §2.

## 5. The sky

- **Candidates:** **S0** today — `pickModalCloud` over [OM, WA, MET, TI] with the hourly weights; **S4** — median of
  those four; **S5** (the now value only) — median of the four plus Pirate Weather's current cloud (production reads
  `currently.cloudCover`; its stand-in is the guess's Pirate model at that hour).
- **Truth:** the METAR's highest layer: CAVOK / SKC / NSC / NCD / FEW (≤ 2 oktas) = clear, SCT = partly, BKN / OVC /
  VV = cloudy. **Caveat:** CAVOK hides every cloud above 5,000 ft, so thin high cloud counts as clear — the way Al
  read this morning's sky; a thick high overcast that dims the sun is scored clear too.
- **Call:** the ladder's lines — < 30 clear, 30–54 partly, ≥ 55 cloudy.
- **Primary:** share of 2026 hours in the right category (three-way), t0, S5 vs S0 for the now value, S4 vs S0 for
  the hourly array. **Passes** when the gain is clearly above zero under all three guesses. Reported: false cloudy
  (said cloudy, station clear) and missed cloud (said clear, station cloudy), day hours alone, per region. Region
  guard as §2 (clearly lower share in any guess → blocked there).
- Per-source cloud was never recorded live, so there is no live check for the sky; from this change
  `meta.sourceNow[].cloudPct` records it.

## 6. Strand and False Bay

- **Found (a research pass, before any scoring): WMO 68911 STRAND**, SA Weather Service, −34.141, 18.848, 7 m (WMO
  OSCAR), ~3 km from Strand's centre. SYNOP at 00/06/12/18 UTC: 10-minute mean wind and direction (knots), the
  333 910ff gust group; no cloud or visibility (`36///`). Read through Ogimet `getsynop` (no key, the channel the
  precision run already uses); terms: SYNOPs are the issuing country's, used under WMO Resolution 40 (now Res. 1),
  Ogimet asks not to abuse it and not for critical missions — internal verification, no redistribution, one
  request an hour fits. **Seen:** 28 Sept 06 UTC `/1115 … 91027` = 110° 15 kt (28 km/h), gust 27 kt (50 km/h),
  against the app's 18.8 km/h served at 06:10; the 20–28 Sept reports. History: the research sampled Jun, Jul and
  Oct 2025 as NIL; live in Jul and Sep 2026. Other stations near: Cape Point 68916 (40 km, hourly), Hermanus 68918
  (50 km, hourly), Elgin 68925 (17 km, inland); kitesurf/PWS networks' terms forbid commercial use (Windfinder
  Gordon's Bay, Weather Underground, Tempest) or need the operator's consent (Holfuy).
- **68911 joins the recorder** (one Ogimet request an hour, the last 12 h) and the live scorer (Strand's served wind
  vs 68911 at the synoptic hours).
- **Transfer test (not tuned there):** the shipped wind rule at 68911's own coordinates (Open-Meteo previous runs
  for the six models, fetched for this plan) vs 68911's reports, 2026, t0, the three guesses. Clearly worse under
  any guess → the change is blocked within 15 km of 68911 (Strand, Gordon's Bay, the Somerset West coast).
- **A Strand-specific south-easter correction** (a ratio for 68911's hours with Open-Meteo's bearing 90–180°) ships
  only on a held-out test at 68911: tuned on the first half of its usable reports in time, clearly better on the
  second under all three guesses, with ≥ 14 separate days of south-easter reports in each half. Too few → not
  shipped, said plainly.
- **Later, the real-source weights (for Al's ask):** once the recorder holds ≥ 4 complete weeks at the six airports,
  per-source weights per region are learned on the first half and must beat the shipped rule on the second (same
  bar as §2). Not this session.

## 7. Replay of this morning

Strand and Cape Town city, the 07:10 and 08:10 UTC recorder readings: what was served; what the shipped rules give
from the recorded inputs (`now.conditionSignals.selector.inputs`, `meta.sourceNow`, re-run through
`deriveCondition` and `applyVoteConsensus` with the new wind, gust and — where the inputs exist — cloud); against
Cape Town airport's METAR, Yr's 10 m/s and Al's description. Cloud per source was not recorded, so the sky replay
says what it can and no more. Plus a live read of both places on the shipped code.

## 7a. Fable's review of this plan — nine changes, adopted in full before anything was scored

Fable 5.1 (≈ 40k tokens): PROCEED WITH CHANGES. Where these collide with the text above, these win.

1. **Live guard:** 24-hour blocks, not 6. Plus a sign rule needing no interval: a region is blocked when the live
   base (served blend for BC, median for MC) runs against its correction — mean applied ratio > 1 with live bias
   > +3 km/h, or < 1 with bias < −3.
2. **Display clamp:** the production table's ratios are clamped to **[0.7, 1.6]** (a bias correction, not a
   different forecast; set by Fable from principle, before scoring). The [0.4, 2.5] learning clamp is `v2`'s code
   (25 Sept), reused unchanged. Every number above is scored with the clamped table. **Western Cape's cells lift to
   the unclamped ratio only if**, at 68911, the unclamped rule is clearly better than the clamped one under all three
   guesses (2026 to 24 Sept).
3. **Headline gate:** recall of windy hours clearly better under all three guesses **and** F1 not clearly worse
   under any, tested on the **full shipped ladder**: (number ≥ T or gust ≥ 55) and the consensus (≥ 2 slots each at
   ≥ 0.8·T after the same correction, or a slot gust ≥ 44); today's: (B0 ≥ 25 or gust ≥ 55) and ≥ 2 slots at ≥ 20
   or gust ≥ 44. Reported per region: false Windy per 100 calm hours, and how many hours flip to Windy.
4. **Gust ratios (G0C, GMC):** gated on the all-hours big-gust F1 (clearly better under all three) and false big
   gusts on hours with no gust group (not more than G0's); their MAE on gust-group hours is reported only. GM vs G0
   keeps the MAE gate.
5. **Sky:** primary = **day hours (06–18 SAST)**, three-way; two-way (cloudy vs not) reported. The phone: when the
   server sent a key it never re-derives wind or sky from the numbers (its numeric rungs serve old cached payloads
   only).
6. **Day cards:** days 0–1 read the same (corrected) hours the hourly array carries; days 2–6 (Pirate's daily)
   stay raw. Not scored — said.
7. **Phone:** as 5 — with a server key, no numeric wind or cloud rung runs.
8. **"Blocked" means B0** everywhere, outside South Africa included (no median there). The pooled pass is computed
   before any block; blocks never feed back. Every region verdict prints its n and its stations.
9. **68911:** the transfer test ends 24 Sept (the 28 Sept report was seen). The recorder polls Ogimet at the
   synoptic hours + ~1 h (01, 07, 13, 19 UTC), not every hour.

## 8. Production shape (if anything passes)

- `api/_lib/wind.js`: the tables (generated by `v5/make-wind-table.mjs` from `v5/results/*.json`, `--check` guards
  drift), the median, the correction, the region blocks. `meta.wind` records raw blend, rule, ratio, region, so the
  recorder scores both. `meta.sourceNow[].cloudPct` added (recording).
- `api/weather.js`: the now wind, the hourly winds (per §2), the gust, the consensus support, the cloud number.
- `assets/app.js`: the two phone wind rungs follow T.
- Tests pin the tables to the results, the blocked regions, the median, the ladder on this morning's Strand inputs.
- One commit per change that passes; full gates; Fable's diff review; push; `/api/version`; live smoke; the
  recorder's next reading shows the new `meta.wind`; then `home-d` rebased onto `main` and pushed.
