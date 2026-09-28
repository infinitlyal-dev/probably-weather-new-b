# Gusts — when a place is getting hammered, the app says so (the plan, written before any answer is scored, 28 Sept 2026)

Al, Strand, 28 Sept 14:16 SAST: *"those gusts dont stop. it is pumping outside and it is very unpleasent and our app is
saying cloudy vibes for strand right now."* And: *"its not just strand, what about gordons bay or any other place
getting heavy gusts on the day?"* The job: the headline follows the gusts, gusts are corrected where a station proves
it, gusts show on Home — nationwide, where the evidence supports it. Vonk builds; Fable 5.1 reviews this plan before
anything is scored, then every diff. Worktree `C:\Users\27741\pw-launch-run`, `main` = live `b9349db` + EVAL 13.6.

## Seen before this plan (said, so nothing below is tuned on it)

- Al's brief: Strand's blend 20.2 km/h at 12:35 SAST today → the sky ("cloudy"); on 27 Sept 68911 read a mean of
  18–24 km/h with gusts 35, 54, 67 while the app's gust read 44, 49, 43; today the app's gust (28.4) came almost only
  from Open-Meteo; MET Norway and Tomorrow.io send no gust. Strand's mean reads ~5 km/h too high (EVAL §13.3).
- EVAL §12.4: in the 2025/2026 airport archive the gust candidates (median, largest × table) did not clearly beat
  the largest of three; nothing about gusts per station, per direction, or against SYNOP stations has been looked at.
- Inventory only (counts, not answers): Ogimet's block 68 returns ~200 stations; on 27 Sept 2,891 of 3,130 section-3
  reports carried a 910 group. Nothing else of the new data has been opened.

## 1. Data

- **Truth, SYNOP:** every SA Weather Service station in WMO block 68 on Ogimet (South Africa by NOAA ISD's country
  code SF and the app's SA box), 1 March 2026 → the last report today. Per on-the-hour report: 10-minute mean wind,
  direction, **910ff** (the highest gust in the 10 minutes before the report). 911ff is never used (another quantity).
  A station is used if it sent ≥ 100 910ff groups since March. Units from iw (knots / m/s; anything else skipped).
- **Truth, airports:** the 23 airports' METARs (Iowa Environmental Mesonet), same period; mean wind and the G group
  (a METAR only carries G when the gust beats the mean by ≥ 10 kt — so a missing G with a mean under 30 km/h means the
  gust was under ~48 km/h, i.e. not "pumping" by gust; §2 is consistent with that). Where an airport and a SYNOP
  station are the same site (≤ 3 km), the SYNOP row is used and the airport row dropped (no double counting).
- **Models:** Open-Meteo's historical-forecast archive at each station's own coordinates, six models (best_match,
  ECMWF IFS 0.25, GFS, ICON, UKMO, Météo-France), hourly wind, gust, direction, temperature, 1 March → today. One
  request per place (all models), 8 s apart — inside the free tier. Gust = the model's hourly gust (the hour's max).
- **The five sources, three guesses** (as v5/v6, `v2/temps-replay.mjs VARIANTS`, [OM, WA, Pirate, MET, TI]) for the
  mean; gusts [OM, WA, Pirate] = [best_match, ECMWF, GFS] · [best_match, ECMWF, ECMWF] · [best_match, best_match, GFS]
  (MET Norway and Tomorrow.io send no gust in production). **Every conclusion must hold under all three guesses.**
- **Periods:** tune 1 March → 30 June 2026 (SAST days); prove 1 July → today. Hours = SAST; a report is matched to
  the model hour it falls on (reports are on the hour).
- **Region:** each station takes the region of its nearest measured station (`api/_lib/regions.js regionOf`), the
  app's own map. Scored per region, pooling every station in it.
- **Live guard (report only):** the recorder's real served payloads at Strand, Cape Town city and the six airports since
  25 Sept against the nearest station report within 40 min. Too few to decide anything; shown so a rule that is
  fine in the archive but wrong in production is seen.

## 2. "Pumping" and "calm" — written down before scoring

- **Pumping hour:** the station's gust ≥ 50 km/h, or its mean ≥ 30 km/h.
- **Calm hour:** the station's mean < 20 km/h and its gust (where sent) < 35 km/h.
- In between (mean 20–30 with gusts 35–50) is neither: not counted either way.
- **Check against today before scoring:** Strand's 68911 must call this afternoon (the 12 UTC report of 28 Sept)
  pumping. If it does not, the definition is wrong and is fixed here, in writing, before anything is scored.

## 3. Headline rules ("Wind's up." — the hero's `wind` key)

The replay reproduces the wind rung and the B-2 wind consensus exactly as production (`api/weather.js` 6n and the
consensus predicate): the region's wind number and Windy line (`api/_lib/wind.js shapeWind` + `windLine`, called
directly), the largest gust of [OM, WA, Pirate], and the consensus (≥ 3 sources active → ≥ 2 must each support wind:
own mean × the region's factor ≥ 80 % of the line, or own gust ≥ 80 % of the gust line). Rungs above wind (rain now,
storm, extreme heat/cold) are not replayed — the score is "would the hero say Windy".

| | rule |
|---|---|
| **R0** today | the shipped rung: number ≥ the region's line (27.5 on the corrected number, 25 on the raw blend where the v5 rule does not apply, incl. the Strand zone) **or** largest gust ≥ 55; consensus as production |
| **R1** gust line | R0 with the gust line G ∈ {40, 45, 50, 55, 60} per region (the support line 0.8 × G) |
| **R2** corrected gust | R1 with each gust × the station's direction ratio (§4) where a correction ships for that station; elsewhere R1 |
| **R3** enough sources | R0 **or** at least K of the five sources' own means ≥ 25 km/h (raw), K ∈ {2, 3} |

- **Scores, per region:** caught = share of pumping hours called Windy; false = Windy calls per 100 calm hours.
- **Tuning (March–June), per region:** for each of R1 and R3, the setting with the most pumping hours caught whose false
  rate is at most R0's + 1.5 per 100 calm hours (all three guesses averaged); ties → the stricter setting. Then the
  one candidate per region with the higher tuning catch goes to proof (R2 is scored only where §4 ships a
  correction, as R1's G with the corrected gust — no new tuning).
- **The bar, proof months (July → today), per region, under all three guesses:**
  1. caught rises by ≥ 5 points, 95 % interval (paired, 7-day blocks, 1,000 draws, seed 7) wholly above zero;
  2. false rises by at most 1.5 per 100 calm hours (point) and its interval's upper end is ≤ 3;
  3. evidence: ≥ 30 pumping proof hours on ≥ 6 separate days in the region.
  Passes → ships in that region. Fails 1 or 3 → today's rule, said why. Fails 2 → **blocked** (cries wolf).
- Strand's zone (15 km of 68911) is scored as its own row too (it reads the raw blend at 25 today).

## 4. Gust correction per station, by direction

- **What is learned (March–June), per station:** the app's gust (largest of three, each guess) against the station's
  910ff / METAR gust, per wind-direction sector (8 × 45°, from best_match's hourly direction — production shows Open-
  Meteo's bearing). Ratio = Σ station gust / Σ app gust over the tuning hours with an app gust ≥ 20 km/h, clamped
  0.8–1.8; a sector with fewer than 30 such hours takes the station's all-direction ratio if that has ≥ 60 hours,
  else 1. The three guesses' ratios are averaged (one table).
- **The bar (proof months), per station, under all three guesses:** (a) gust off-by (MAE, hours with both) falls, 95 %
  interval wholly below zero; (b) big-gust F1 at 50 km/h (app ≥ 50 vs station ≥ 50) is not lower; (c) ≥ 15 proof
  hours with a station gust ≥ 50. All three → the correction ships for that station.
- **Which places take it:** a place within **12 km** of a passing station, whose ground is within 150 m of the
  station's height, and not across a mountain ridge or on the other side of a coast from it. The list of towns each
  shipped station covers is written into `EVAL.md` and into the generated table's comments, and Fable reviews it. The
  runtime check is the circle (per-station radius ≤ 12 km, cut smaller where the list says so). Places with no
  covering station: no correction, only their region's headline rule. Example to test, not a promise: 68911 → Strand,
  Gordon's Bay, Somerset West, if its correction passes.
- **Where the corrected gust is used:** the hero's gust rung and consensus (R2), the gust number shown (§5), the hourly
  gusts for days 0–1. Mean wind, temperatures and everything else untouched.

## 5. Gusts on Home

- Shown whenever strong: the gust (corrected where §4 applies) is shown when it is **≥ 40 km/h**, or (as today) more
  than 1.3 × the wind. Format as today: "Wind 22 km/h · SE · gusts 60" — the existing `weather.gusts` string in all
  five languages; no new copy. Server: `gustKph` is sent when ≥ 40 or > 1.5 × the wind (today: only the second).
- Today's Home (main) and Home D (`home-d`, rebased after the ship).
- The daily scorecard gets the day's strongest gust on each line: the station's strongest reported gust and the app's
  strongest served gust.

## 6. What must not move

- `tests/temp-freeze.test.js` passes unchanged: no temperature moves.
- The mean wind number (v5 table, v6 Eastern Cape weights) is unchanged; only the Windy decision and the gust change.

## 7. Ship

Full gates (serial suite, image budget, build, bespoke, rotation, drift, seasonal, precision/wind table/wind weights
`--check`, the new tables' `--check`, fold, desktop, gate shots), Fable's diff review, push to `main`, `/api/version`,
live smoke; then live now for Strand, Gordon's Bay, Cape Town city and Gqeberha against the nearest station's latest
report; `home-d` rebased and pushed. Nothing that fails its bar ships; where nothing passes, EVAL says why and what it
would need.
