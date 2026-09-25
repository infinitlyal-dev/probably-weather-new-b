# Precision plan — make the forecast as close to right as it can be (25 Sept 2026)

Al: "we should damn well be as close as possible and almost better than most other apps."
Bar: on what people act on — today's high and low, rain in the next few hours, rain today (and how
honest its %), wind and gusts, fog and frost — beat every single source we use and the best single raw
model, measured at SA weather stations, per region, in plain numbers.

## Evidence

- **Stations.** 23 SA airports were fetched from the IEM METAR archive (2025-01-01 → 2026-09-25). 16 are
  usable for scoring: FACT (Western Cape), FALW (West Coast), FAGG (Garden Route), FAPE · FAEL · FAUT
  (Eastern Cape; FAEL reports by day only → high and daytime only), FALE (KZN coast), FAOR · FAWB
  (Highveld), FABL (Free State), FAUP · FAKM (Northern Cape), FAMM (North West), FAKN · FAHS (Lowveld),
  FAPP (Limpopo). FAPM and FARB have no archive for the period; FABM, FACV, FADY, FAEO, FASB report once
  or twice a day. **Gaps: KZN inland and the Karoo** — no airport with hourly reports in the archive.
  FALW and FAHS report no present weather (no rain/fog truth there); FAWB almost none.
- **Real past forecasts, not stand-ins.** Open-Meteo previous-runs archive, hourly, 2025-01 → 2026-09, for
  six models: best_match (= production's Open-Meteo source; for SA it is ECMWF's 9 km model — identical
  values), ECMWF 0.25°, GFS, ICON, UK Met Office, Météo-France. For each hour: the latest run's value (t0)
  and the value from the run 24 h earlier (t1). Plus the short-lead archive for gusts, visibility and
  Open-Meteo's own rain probability (best_match, ECMWF, GFS). Downloaded through the free research
  endpoints (the paid key is only in Vercel), paced under their limits.
- **What cannot be backtested.** WeatherAPI, Pirate Weather, MET Norway and Tomorrow.io keep no archive.
  The first live day of the recorder says: Open-Meteo = ECMWF 9 km exactly; MET Norway close to it;
  Pirate Weather does NOT look like GFS (the old harness's stand-in); WeatherAPI matches no single model.
  So "the app now" is replayed with production's own weighting code under **three plausible source→model
  assignments**, and every conclusion must hold under all three. The recorder (six airports, hourly, with
  each real source's numbers) keeps running and is folded in as it grows.
- **Plan of the test (Al's rules).** Learn everything (biases, weights, calibration curves) on 2025;
  report every number on 2026-01-01 → 2026-09-24 only. A change ships only when the whole 95 % range of
  its improvement (paired, day-block bootstrap) is on the better side — against the app now (all three
  assignments) and against the best single model. Per region as well as overall; a region clearly made
  worse blocks the change there.

## Candidates

1. **High and low: a corrected consensus of six models.** Each model's daily max/min gets its own bias
   removed (per season, learned at the stations), then the six are averaged with weights set by how
   right each has been (1 / mean squared error on 2025). Three ways to carry it to places without an
   airport, tested honestly: the nearest station's table; the region's table learned **without** that
   station (leave-one-station-out — what a user 60 km from an airport gets); one all-SA table.
   Also tested: correcting the app's own blend by its bias; mixing the consensus with the app's blend.
   Frost nights (observed low ≤ 2 °C) reported separately — the Bloemfontein 3.5 °C-too-warm case.
2. **Rain today, and how honest the %.** Proxy-free candidates: Open-Meteo's own daily %, calibrated to
   what happened (isotonic curve, 2025); the six models' share that rain ≥ 0.5 mm, calibrated; a mix.
   Scored by Brier score and "when it says 60 %, how often did it rain", per region.
3. **Rain in the next few hours.** Same, hourly (0–6 h ahead windows), from Open-Meteo's hourly % and the
   six models' hourly amounts. The hero's "Rain's here" rule stays as ruled; its false calls are counted.
4. **Wind and gusts.** Mean wind: per-station/season/time-of-day bias of each model; gusts: the short-lead
   gusts of best_match / ECMWF / GFS against the METAR gust group. The south-easter (Cape Town, dry SE
   ≥ 30 km/h) scored as its own event.
5. **Fog.** The short-lead visibility (< 1 km) and the models' dew-point spread, per region (George, Cape
   Town): hits and false alarms against FG in the METAR.
6. **Pirate Weather and Tomorrow.io.** Neither keeps history, so no archive can price them. The live
   recorder can (each source's own high/low per hour from `meta.sourceRanges`); anything it shows is
   reported with its sample size, and **nothing is switched off** without numbers.

## How a winner reaches the app (only if it passes)

- **One extra Open-Meteo request per forecast fan-out**, in parallel with the other providers (no added
  wait): `models=ecmwf_ifs025,gfs_seamless,icon_seamless,ukmo_seamless,meteofrance_seamless`,
  `hourly=temperature_2m,precipitation`, 7 days, on the same 2 km cache grid as everything else. Open-Meteo
  counts it as ~1 call (10 variable-model pairs, 7 days); production's call is 2.9, so +1 per fan-out,
  counted against the same monthly budget. best_match comes from the existing call.
- **A small table module** (`api/_lib/precision.js`): per-station, per-season biases and weights from
  this backtest, frozen as data (regenerated by a script, committed, reviewed). A location uses the
  nearest scored station within its region and 150 km, else the region's, else all-SA; outside SA the
  app behaves exactly as today.
- **Where it applies:** days 0–6 high/low, and — if it passes — the rain % mapping. Hourly temperatures
  are corrected by the same day-part bias so the hourly strip agrees with the high/low.
- **Fallbacks:** if the extra request fails or is over budget, the app computes exactly as today.
  Payload shape unchanged; the Sources page keeps listing each source's own numbers.
- **Guard tests:** the table's size and ranges; outside-SA identity; fallback identity; no extra request
  when the budget refuses; the fold and every existing gate.

## What Al reads

Top: how close the app is now vs after, region by region, against each single source/model and the
best single model — in plain numbers ("today's high: off by 1.3 °C on average, now 1.0"; "within 2 °C on
8 days in 10, now 9"). Then each change with before/after. Only new questions.

## Changes after Fable's review (25 Sept, verdict PROCEED WITH CHANGES) — adopted in full

1. **Only proven leads ship.** Scored at t0 (latest run ≈ today as seen during the day) and t1 (24 h
   before ≈ tomorrow as seen today). A winner applies to **days 0 and 1 only**; days 2–6 stay as today.
2. **No straw app, nothing switched off.** The consensus ships, if it passes, as **one more weighted
   member of the existing blend** (the mix), never as a replacement. Its weight α is chosen on 2025 and
   must win on 2026 under all three source assignments. And **shadow mode**: production writes the
   consensus high/low and whether it applied into `meta.precision`, so the recorder scores it beside the
   real blend at six airports; its weight grows only when that live record shows a whole-interval win
   on ≥ 60 station-days across two seasons.
3. **ECMWF once.** best_match is ECMWF 9 km; ECMWF 0.25° is the same run coarser. The consensus uses
   five models: best_match, GFS, ICON, UK Met Office, Météo-France (ECMWF 0.25° stays a single-model row).
4. **Transfer tested on real pairs.** Nearest-station tables are scored across real neighbours
   (FAOR→FAWB, FAWB→FAOR, FAKN→FAHS, FAHS→FAKN, FAUP→FAKM, FAKM→FAUP, FAPE→FAEL, FAPE→FAUT) against
   the all-SA table and the **untabled five-model mean**. Nearest-station only when the same coast/inland
   class and |Δ altitude| < 300 m; else the all-SA table. If the untabled mean is within the interval of
   the tabled consensus, ship the mean — no tables.
5. **Stricter statistics.** Bootstrap blocks are **7 days**. **Pre-registered primary**: the mix vs the
   app now, t1, MAE of high and low pooled, all stations; everything else is secondary and reported, not
   used to cherry-pick. Regions are chosen by transfer evidence, not by region-level significance.
6. **Coverage.** A station-day counts for the high/low only with ≥ 20 of 24 hours reported (East London:
   07:00–19:00 all present, high only, over the same hours for the forecasts).
7. **Hourly strip left alone;** the displayed high is clamped ≥ the strip's max and the low ≤ its min,
   with a guard test.
8. **Production details:** the extra response is used inside the same fan-out, so it is cached in the
   same entry and TTL as everything else; `timezone=auto` as the main call (Africa/Johannesburg in SA —
   the backtest's day split); its timeout no longer than the existing providers'; `meta.precision`
   carries applied / fallback / outside-SA and the table id; a drift test pins the committed table to the
   generator's output; once proven on 2026, the shipped table is refit on 2025 + 2026.
9. **Scope.** Production: high/low first, then rain % if it clears the bar. Wind, gusts, fog and the
   south-easter are reported, not shipped (thin truth).

## Pre-registered before the full data was scored (25 Sept, 10:05 SAST, 4 of 16 stations seen)

- The shipped weight of the consensus in the mix is **α = min(α chosen on 2025, 0.5)**: the backtest
  cannot see the real WeatherAPI / Pirate / MET / Tomorrow.io, so half the blend stays theirs until the
  live record (shadow mode, rule 2 above) earns the consensus more.
- **Ship test:** the α-capped mix beats the app now with the whole 95 % interval below zero (7-day
  blocks, pooled high + low MAE, all stations) at t1 **and** t0, under **each** of the three source
  assignments. Else nothing ships and the numbers are reported.
- **Table:** the all-SA table unless the transfer pairs show a neighbour's table clearly better than it.
- (10:40 SAST, still before the full data) The app replay at t1 uses production's **day-1** windows —
  MET Norway's whole day, no Tomorrow.io (day-0 only) — since t1 stands for tomorrow as seen today.

## Results on all 16 airports (25 Sept) — and the one decision taken after seeing them

- **Ship test: passes** at t1 and t0 under all three assignments (shipped mix − app now, pooled MAE):
  t1 −0.17 [−0.21, −0.12] · −0.14 [−0.16, −0.11] · −0.19 [−0.23, −0.15]; t0 −0.14 [−0.17, −0.11] ·
  −0.13 [−0.14, −0.11] · −0.14 [−0.18, −0.11] (39 weekly blocks, 2026). Against the best single model
  (best_match, 1.55 °C at t1) the shipped mix is 1.31–1.35 °C.
- **Region guard** (Al's rule above: "a region clearly made worse blocks the change there"), computed
  per region, per assignment, per lead (temps.mjs `regionGuard`): ten regions are better under all three
  assignments at both leads. **The Lowveld (FAKN, FAHS) is worse** — whole interval above zero under 3 of
  3 at t1 and 2 of 3 at t0 (+0.06 to +0.17 °C). Cause: its nights run warmer than the models (FAKN
  best_match low −1.6 °C), the reverse of the rest of SA, and the all-SA table removes a warm-night bias
  (+0.4 to +2.9 °C by model and season), so it pushes Lowveld lows the wrong way.
- **Decision:** production blocks the Lowveld (`precision.js` `inLowveld`: north of 24.4° S from 30.0° E,
  south of it from 30.8° E down to 27° S); there the app stays exactly as today and makes no extra request.
  A block can only remove the change, never add it. The table stays the pre-registered all-SA table (not
  refit without the Lowveld airports). `make-table.mjs` refuses to write a table if the guard's worse
  regions ever differ from what production blocks.
- **Shipped table:** all-SA, refit on 2025-01-01 → 2026-09-24, 16 airports, α 0.5.

## Rain %, pre-registered before the full rain data was scored (25 Sept, 10:55 SAST)

- The app's own % can only be **replayed as a proxy** (WeatherAPI, Pirate Weather and Tomorrow.io keep no
  history; ECMWF's and GFS's % stand in for the first two, Tomorrow.io is left out). One proxy cannot meet
  the plan's rule that a conclusion holds under all three source assignments, so **in this run a rain-%
  change is reported, not shipped**, whatever the numbers say.
- A calibrated method "clears the bar" when it beats both the replayed app % and Open-Meteo's own % on the
  Brier score with the whole 95 % interval below zero (7-day blocks, 2026), for rain today, with no region's
  interval above zero. If one does, the next step is shadow mode (the calibrated % recorded in `meta`
  beside the served one, not shown) so the recorder proves it on the real sources before anything a user
  sees changes. "Rain's here" is Al's ruled rule: its false calls are counted, not changed.
