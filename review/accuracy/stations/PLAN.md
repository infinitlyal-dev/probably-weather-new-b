# "Right now" follows the stations — the plan, written before any answer is scored (29 Sept 2026)

Al, Strand, 29 Sept 08:01 SAST: *"the wind has been pumping all night and is pumping badly now as well ... showing
clear is a lie."* And: *"what about the rest of the country?"* At that moment the live app said "Clear sky", 18.4 km/h,
gusts 31.7 (MET 34.6, TI 21.6, OM 17.5 / gust 31.7, WA 9 / gust 27, Pirate 7.4). Strand's station 68911 (SYNOP):
28 Sept 18Z 130° 37 km/h gusting 78; 29 Sept 00Z 130° 30 km/h gusting 63. The job: when a representative station says
it is pumping, raining or foggy, "now" says so (headline, photo folder, measured numbers), nationwide, where history
proves it. Vonk builds; Fable 5.1 reviews this plan before anything is scored, then every diff. Worktree
`C:\Users\27741\pw-launch-run`, `main` = live `426d2df`. Temperatures are not touched (freeze test unchanged). No new
wording in this run.

## Seen before this plan (said, so nothing below is tuned on it)

- Al's brief numbers above; 68911's 28 Sept 12Z (140° 28 km/h gusting 59), 18Z and 29 Sept 00Z reports (Ogimet, read
  29 Sept 06:21 UTC); 68911's 06Z report was not on Ogimet at 06:21 UTC.
- Cape Town airport FACT 29 Sept 06Z: VRB 1 kt, CAVOK — calm while Strand pumps (27 km away, other side of the Cape
  Flats). Stated because it is exactly the "borrowed calm station" case §2 must refuse.
- Live latency, measured today, not tuned: aviationweather.gov's FACT 06Z METAR received 06:05:06 UTC (5 min);
  Ogimet at 06:21 UTC had the 05Z hour complete (107 reports) and 25 of the 06Z reports; the recorder saw 68911's
  12Z, 18Z and 00Z reports at its first poll after them (≤ 70 min, polls hourly at :10). A probe is logging first-seen
  times for both feeds every 15 min today (`scratchpad/probe`, reported in the EVAL section).
- Inventory only (counts, not answers): Ogimet block 68 on disk (v7, 1 March → 28 Sept 12Z): 199 stations — 96 report
  about hourly, 36 about 3-hourly, 67 6-hourly or less. In one week (20–26 Sept) most automatic stations send no
  present weather (ix = 6: 10,825 of 18,339 reports) and no precipitation group; 933 reports carried a 7ww group.
  NOAA's free SYNOP bulletins (tgftp DS.synop) carried no block-68 report in the 30 newest files.
- GeoNames ZA (on disk): 927 places with ≥ 1,000 people (not suburbs), 50.1 million people between them; Strand is a
  place with population 0 (its people are counted under Somerset West, 225,289).
- EVAL §14.1: Cape Town city's nearest station (Molteno Reservoir 68816) reads calm on many hours the app calls Windy.
  Not this job; a station veto of the models' Windy is reported (§3.4), not shipped.

## 1. Sources (step 1 of the brief)

For each: update rate, delay (the probe), commercial terms (quoted, with the page), agreement with the official
stations where both report. Agreement is measured where two feeds report the same site within 3 km (METAR vs SYNOP
twin): mean-wind difference and the share of hours both call pumping / calm the same. A feed whose terms do not allow a
commercial app is **not used live**, whatever its data are worth; the history test still uses Ogimet's archive (research
use) so the answer for each region is known, and the live station list (§2) takes only allowed feeds. Paid options are
listed with prices; nothing is bought.

## 2. Every place gets its representative station (step 2)

**The towns:** every GeoNames populated place in South Africa (PPL, PPLA–PPLA4, PPLC, PPLX) with ≥ 1,000 people, plus
every populated place of any size within 30 km of a live station (so Strand, Gordon's Bay and the suburbs are
listed), plus the recorder's places. Written to `stations/towns-stations.json` (town → station(s) or none, with the
reason). At request time a place takes the station of the nearest listed town within 5 km (as `gusts.js TOWN_KM`);
otherwise it keeps today's model-only "now".

**A station represents a town only if all hold** (terrain from Open-Meteo's elevation API, Copernicus 90 m):
1. **Live and allowed:** its feed passes §1, and it reported ≥ 70 % of its usual cadence over 1–28 Sept.
2. **Same exposure:** "coastal" = any of 16 points at 3, 6, 10 km in 8 directions (plus the point itself) at elevation
   0 m (sea). A coastal town takes only a coastal station and an inland town only an inland one.
3. **Same side of the mountains:** no point on the line between them (sampled every 500 m) is more than 150 m above
   the higher of the two ends.
4. **Height:** |town − station| ≤ 150 m (coastal) or ≤ 250 m (inland).
5. **Distance ≤ D**, D from history (below), separately for coastal and inland pairs.
When several pass, the nearest is the town's station (the others are listed as fallbacks, used when the first has no
report inside its freshness limit).

**D from history (before any rule is scored):** every pair of SYNOP stations 2–40 km apart that passes 2–4 is binned
by distance (0–10, 10–15, 15–20, 20–25, 25–30, 30–40 km). For each bin, over the hours both report: when A is pumping,
the share of hours B is calm ("borrowing a calm station" — the case above). D = the largest bin edge such that every bin
up to it has that share ≤ 10 % (Wilson upper bound ≤ 15 %) with ≥ 50 A-pumping hours, coastal and inland separately.
If no bin qualifies, D = 10 km for that exposure (the harbour/city-centre scale v7 already uses) and it is said. Pumping
and calm as §3.1. Pairs are counted both ways.

## 3. The "now" rule and carry-forward (steps 3–4)

### 3.1 Classes (from v7, not retuned; history-defined there)
- **Pumping:** the report's gust ≥ 50 km/h or its 10-minute mean ≥ 30 km/h. **Calm:** mean < 20 and gust (where sent)
  < 35. In between: neither, not scored. Check: 68911 on 28 Sept 18Z (37, gust 78) and 29 Sept 00Z (30, gust 63) are
  both pumping.
- **Rain reported now:** METAR present weather with RA or DZ (incl. SH/TS/FZ forms, any intensity), not VC, not RE;
  SYNOP ww 50–67, 80–84, 91, 92, 95, 97 (manned ix 1, automatic wawa ix 7 mapped to the same: wawa 40–48 excluded,
  50–58, 60–68, 80–84, 91–96 included). Stations that send no present weather are never scored for rain or fog.
- **Fog reported now:** METAR FG or FZFG (not MIFG, BCFG, PRFG, VCFG) with visibility < 1,000 m; SYNOP ww 42–49 (wawa
  30–35) with VV < 1 km (VV ≤ 09).

### 3.2 Timing, replayed as production would see it
- **Decision instants:** every hour at HH:30 UTC (HH:30 SAST, both whole-hour zones) at every scored station.
- **Usable report:** obs time t with t + L ≤ the instant. **L** is the feed's delay: METAR 10 min; SYNOP 60 min —
  unless the probe's 90th percentile over today's first-seen times is larger, then that (fixed before scoring, and
  reported).
- **Truth ("the next real report"):** the first report with obs time after the instant, if it comes within 90 min
  (hourly stations), 3.5 h (3-hourly) or 6.5 h (6-hourly); otherwise the instant is not scored.
- **The model at the instant:** the archive hour HH (Open-Meteo historical-forecast, six models, the three source
  guesses of v7 — every conclusion must hold under all three).

### 3.3 The three rules
| | rule |
|---|---|
| **M** today | production's hero Windy rung, replayed as v7 did: v5/v6 wind number and line (`shapeWind`, `windLine`), the region's v7 gust line and "sources at 25" (`gustRuleAt`), v7 station gust corrections (`gustFactorAt`), B-2 consensus — each called from `api/_lib` so the replay is production's code |
| **S** station | M, **or** the latest usable report of the station is pumping and its age ≤ F → Windy. Holds until a newer usable report is not pumping (then M alone) or the age passes F. When S fires by the station, the shown mean and gust are the report's (a report with no gust group shows no gust) |
| **SC** station + carry-forward | the latest usable report (any class, age ≤ 12 h) sets two gaps against M at the report's own hour — mean: report − M's shown wind; gust: report gust − M's hero gust (only when the report sends a gust). At the instant, shown mean = M's + gap × fade, gust likewise; fade = max(0, 1 − age / T). Windy = S fires, **or** shown mean ≥ the place's line (`windLine`'s threshold) **or** shown gust ≥ the place's gust line (no consensus check: the numbers are anchored on a station). Gaps are carried both ways (a station reading below the models lowers the numbers) |

Rain and fog, each: **M** = production's rung (rain: ≥ 2 rain votes, ≥ 90 %, ≥ 2 mm, replayed as v3 `rainnow.mjs`
does at the airports that report weather — radar not replayable; fog: production's detector + corroborated fog +
description, replayed as v3 `fog.mjs`). **S** = M, or the latest usable report within F_r / F_f says rain / fog.
No carry-forward for rain or fog.

### 3.4 Report only, never shipped this run
- **S-veto:** S, and when the latest usable report (age ≤ F) is calm, M's Windy is dropped. Scored per region so Al
  sees what a station veto would do to the Western Cape's false Windy (EVAL §14.1); not built.
- Shown-number error: mean absolute error of the shown mean and gust against the truth report, per rule, per region.

## 4. Tuning (March → June 2026)

- **F (wind)** per cadence class (hourly / 3-hourly / 6-hourly), from {1.5, 2.5, 3.5, 4.5, 6.5, 7.5, 9.5} h (only values
  ≥ the class's cadence + L are meaningful); **T** from {3, 6, 9, 12} h; **F_r, F_f** from {1.5, 2.5, 3.5} h.
- Chosen nationally (all scored stations pooled, the three guesses averaged), not per region: the setting with the most
  pumping (rain, fog) truths caught whose false rate is at most M's + 1.0 per 100 calm (dry, clear) truths; ties → the
  smaller F / T. SC takes S's F and tunes only T.

## 5. The bar (proof, 1 July → 28 Sept 12Z for wind; → 24 Sept for rain and fog, the v3 archive's end)

**Wind, per region** (the app's regions, `regionOf`; Strand's zone — 15 km of 68911 — its own row), S vs M and SC vs M,
**under all three guesses:**
1. caught (share of pumping truths called Windy) rises ≥ 5 points, 95 % interval (paired, 7-day blocks, 1,000 draws,
   seed 7) wholly above zero;
2. false (Windy per 100 calm truths) rises by at most 1.5 (point) with its interval's upper end ≤ 3;
3. evidence: ≥ 30 pumping proof truths on ≥ 6 separate days in the region;
4. the pass survives dropping the station with the most pumping truths (Strand's zone: n/a, one station — said).
Passes → ships in that region. Fails 1 or 3 → today's model-only now, said why. Fails 2 → **blocked** (cries wolf).
If both S and SC pass, SC ships if its proof catch is higher and its false rate no more than 0.5 per 100 above S's;
otherwise S. **Shown numbers:** where S or SC ships, its shown-mean and shown-gust error must not rise against M
(point estimate), or the numbers stay M's and only the headline changes (said).

**Rain and fog, pooled nationally** (they are about how long a reported shower or fog lasts, not a region's models),
with a per-region block:
1. caught rises ≥ 5 points, interval above zero;
2. **of S's own calls** (hours where S says rain / fog and M does not), the truth report is wet (fog) in ≥ 60 %, and wet
   or with rain in the hour around it (fog: visibility < 2 km) in ≥ 80 %;
3. ≥ 30 proof truths on ≥ 6 days;
4. a region is blocked if it has ≥ 10 of S's own proof calls and fails 2 there.

**Live guard (report only):** the recorder's served payloads since 25 Sept at Strand and the six airports, against the
next 68911 report / METAR: what the app said, what S and SC would have said with the live latency. Too few to decide
anything; shown so a rule fine in the archive but wrong live is seen.

**What the replay cannot see:** production's real MET Norway and Pirate (they read high on the coast, §14), the radar,
and a user's exact minute. The live check after the push is the six places in the brief, against their latest reports.

## 6. Build, if anything passes
- `api/_lib/station-obs.js`: the allowed live feeds (one national request each, cached in memory 5 min, 1.5 s budget,
  never throws; on any failure the answer is today's).
- `api/_lib/station-map.js` (generated from the results + towns file, with `--check`): town → station, and per region
  which of S / SC / rain / fog ships, with F, T, L.
- `api/weather.js`: after the fog layers, before confidence: station rain → `rain` (reason `station-rain`), else station
  wind → `wind` (`station-wind`), else station fog → `fog` (`station-fog`); none of them replaces thunder, hail or storm,
  and station wind does not replace rain that the models or radar already call. Shown wind/gust = measured when the
  station fires; SC's faded gap on the shown numbers and the next hours' wind where SC ships. `now.station` = {id,
  name, obsUtc, ageMin, meanKph, gustKph, rule} for the recorder and the live check.
- Phone (`assets/app.js`, Home D): a `station-*` reason is taken as the display key (rain joins `rainNowOverride`), so
  the photo folder follows (wind, rain, fog folders). No new strings.
- Tests: the Strand morning replayed (29 Sept 00Z report, the live sources of 06:01 UTC → Windy, 30 km/h, gusts 63);
  a calm station never flips a model Windy; feed failure = today's answer; `temp-freeze.test.js` unchanged.

## 7. Ship
Full gates (serial vitest, image budget, build, table `--check`s, fold, desktop, Home D check), Fable's diff review, push
to main, `/api/version`, live smoke; then the six places live against their latest station report (headline, photo
folder, wind and gust). Nothing that fails its bar ships; where nothing passes, the region keeps today's now and the
report says why.
