# Rain's here, fog, frost — the plan, written before any candidate is scored (25 Sept 2026)

Al: "it has been showing fog a lot when it isnt really that foggy and the rain thing i noticed the last couple of
days and it felt off." Vonk builds; Fable 5.1 reviews this plan before any candidate rule is scored, then every
diff. Same discipline as the precision run (`review/accuracy/v2/PLAN.md`): tune on one period, prove on another;
a change reaches a region only when the whole 95 % range of its improvement there is on the better side; a region
not proven keeps today's behaviour (a block, as the Lowveld). One local commit per change, nothing pushed.

## What is already known (seen before this plan; nothing below is tuned on it)

- **Live fog (recorder, 24 Sept 23:58 → 25 Sept 14:10, six airports):** 18 fog calls. 15 came from the
  visibility–humidity detector (Layer A), 2 from one "true fog" word + humidity + light wind (Layer A.2), 1 from
  the description vote. One was real fog (George 08:10, caught by the detector). Cape Town: the detector read
  0.2–1.4 km while the airport saw 2–10 km under cloud at 200–500 ft; Durban: 0.3–0.8 km under CAVOK.
- **Open-Meteo's visibility is the detector's main input and it changed on 30 Sept 2025:** before, a 24.1 km cap
  most hours and almost never under 1.5 km; since 1 Oct 2025 uncapped and under 1.5 km in 5–16 % of hours at
  Cape Town and George. Its archived value for the live false-fog hours was 0.2–0.7 km (Cape Town, Durban) —
  Open-Meteo's own number, not Tomorrow.io's. Open-Meteo never sends a fog weather code in SA.
- **Rain inputs are stable across 2025 and 2026** (Open-Meteo's rain % and codes, month by month).
- **Rain's here, replayed (precision run, three models as the voters):** dry that hour on 40 % of calls at the six
  airports the rule was tuned on, 71–86 % at Mthatha, Polokwane, Mahikeng and Mbombela. The 22 Sept check with the
  app's own resolver and four stand-ins: 29 % at the six airports.
- **Frost nights:** the as-shipped low (`bbb662a`) is +2.6 to +3.4 °C warm the day before; an airport's own table
  reaches +0.9 but only there.
- **Production does not log conditions** (`DEBUG = false`), so what the app told Al at Strand last week is not on
  record anywhere; no weather station reports from Strand (nearest: Elgin 17 km over the mountain, Cape Town
  airport 27 km).

## Evidence

- **Archive (v2 data):** 16 airports' METAR, hourly (13 report present weather; FALW, FAHS, FAWB do not);
  Open-Meteo past runs of six models (latest run t0 and the run 24 h earlier t1: temperature, rain amount, wind;
  t0 only: cloud, dew point, weather code) and the short-lead archive of best_match, ECMWF 0.25° and GFS (rain %,
  code, visibility, gusts, cloud). SA Weather Service synoptic reports (3-hourly present weather, visibility, day
  max / night min) at Beaufort West, Graaff-Reinet, Pietermaritzburg, Ladysmith, and — new — Cape Columbine
  (68712) and Langebaanweg (68714) for the West Coast, where the airport reports no weather.
- **New downloads (`fetch3.mjs`):** best_match cloud, low cloud and dew point as forecast the day before (for the
  frost gate at t1); the short-lead archive for the synoptic towns and Cape Columbine.
- **The recorder:** what the app really served at six airports, hourly, with each source's words and the rule
  that decided. From this run it also reads Strand and Cape Town city (Al's spots; no METAR there).

## 1. "Rain's here" — only when rain is likely at that spot now

- **Truth.** Airports: precipitation in any report in that hour (primary); that hour or either neighbour
  (secondary). Synoptic towns: present weather 50–99 at the 3-hourly report (reported, not used to tune).
- **Replay.** The now-rung's inputs rebuilt from the archive — the number of sources describing rain, the blended
  current-hour chance and amount, Open-Meteo's code, the hour, the place's elevation — under three source
  assignments (the app's WeatherAPI / Pirate / MET Norway / Tomorrow.io have no archive): A = the 22 Sept harness's
  stand-ins (ECMWF, GFS, UK Met Office, ICON); B = ECMWF-heavy (MET Norway = ECMWF, as the first live day
  suggested); C = mixed. Tomorrow.io's radar override has no archive: it only adds rain; counted live.
- **Candidates.** R0 today's rule (≥ 2 sources, ≥ 60 %, ≥ 0.3 mm). R1 one national set from the grid: sources
  ≥ {2, 3} × chance ≥ {60, 70, 80, 90} % × amount ≥ {0.3, 0.5, 1, 2} mm. R2 the same grid chosen separately for
  shower/thunder hours (Open-Meteo code 80–82, 95–99) and the rest, with "never" (radar only) allowed. R3 the same
  grid chosen separately for inland afternoons (elevation ≥ 500 m, 12:00–20:59) and the rest, "never" allowed.
- **Tuning (TRAIN = 2025, airports only).** Per regime, the most permissive grid cell whose same-hour hit rate is
  ≥ 60 % under every assignment, with ≥ 30 calls; none → "never" (only radar can say it there). Among R1–R3, the
  one with the most true calls (mean over assignments).
- **Test (TEST = 2026-01-01 → 2026-09-24).** Per region and pooled: the false share (dry that hour) of the chosen
  rule minus R0's, 7-day-block bootstrap. The rule reaches a region only where the whole interval is below zero
  under all three assignments; elsewhere today's rule stays. Reported beside it: true calls kept and lost, the
  ±1 h figures, the synoptic towns.
- **What a demoted call shows.** The ladder continues: "Might rain." (the existing key, still wet on screen)
  when the chance is ≥ 30 %, or wind / the sky as today. If the demoted calls are mostly the inland-afternoon
  pattern, a softer wording ("showers around") goes on Al's page as a proposal — English and Afrikaans for him to
  OK; not shipped.

## 2. Fog — only when it is fog

- **Truth.** Fog = the station's visibility under 1 km with no precipitation reported (airports, hourly; Cape
  Columbine and Langebaanweg: present weather 40–49 or visibility under 1 km, 3-hourly). Mist = 1–5 km with BR;
  low cloud = broken / overcast / vertical visibility at 500 ft or lower with visibility ≥ 1 km.
- **Scope.** The detector (15 of 18 live calls) is replayable on Open-Meteo's archived visibility, humidity,
  dew point, wind and rain. The one-fog-word path (A.2) and the description path read the other sources' fog words,
  which have no archive: not changed here (A.2 exists for Strand's real fog that Open-Meteo missed, pinned by
  `tests/fog-corroboration.test.js`); the recorder counts them.
- **Period.** 1 Oct 2025 → 24 Sept 2026 only (the current visibility), split by alternating ISO weeks — even weeks
  tune, odd weeks test — so both halves hold every season. Bootstrap blocks are the weeks.
- **Candidates.** The detector's gates from the grid: visibility < {1500 (today), 1000, 700, 500, 300} m ×
  humidity ≥ {90 (today), 93, 95, 97} % × dew-point spread ≤ {2 (today), 1.5, 1, 0.5} °C × Open-Meteo wind ≤
  {none (today), 15, 10} km/h × hours {all (today), 18:00–09:59}.
- **Tuning.** Maximise F0.5 (precision counts double) on the tune weeks, pooled over the stations with fog truth.
- **Test.** Pooled: precision (fog calls that were fog) higher, whole interval above zero; F0.5 not lower (whole
  interval above zero). Per region: wrong fog hours per 1,000 hours lower, whole interval below zero; where not,
  today's detector stays there. Fog hours caught before and after reported (the cost).
- **When it is not fog.** The screen shows the ladder's own key (cloudy / partly cloudy / clear); how often that
  matches the airport's cloud is reported.

## 3. Frost nights — the low on clear, calm, dry nights inland

- **Truth.** Airports: the METAR night minimum (≥ 20 hours reported, as v2); synoptic towns: the 06 UTC minimum.
- **Base.** The low as shipped (`bbb662a`: blend + corrected consensus, the Lowveld as today), replayed as in v2
  under the three assignments.
- **Candidate.** Inland (elevation ≥ 500 m), when Open-Meteo's forecast night (20:00 → 08:00; today's low read in
  the morning: 00:00 → 08:00) is clear (mean cloud ≤ C), calm (mean wind ≤ W) and dry (dew-point depression at the
  window's start ≥ X), the low is lowered by δ. Grid: C ∈ {10, 20, 30, 40} %, W ∈ {6, 8, 10, 12} km/h,
  X ∈ {0, 4, 6, 8} °C. δ = the mean error of the as-shipped low on gated nights, learned per lead, capped at 5 °C.
  The inputs are the ones production already has (Open-Meteo's hourly cloud, wind, dew point; its `elevation`).
- **Tuning (TRAIN = 2025).** The gate minimising the low's MAE over all 2025 nights at the inland airports, δ
  learned leave-one-station-out.
- **Test (2026).** Inland airports with δ learned without them, and the four synoptic towns (never used): low
  MAE over all nights, and frost-night bias. Ships when the whole interval of the MAE drop is below zero at t1 and
  t0 under all three assignments, pooled over the inland airports AND over the four towns (the carry test);
  per-region guard. The hourly strip stays as it is (Fable, precision plan item 7); the low stays ≤ its minimum.

## 4. ICON inland — the precision run's lead

- **Candidate.** The consensus table learned on the inland airports only (2025), used inland (elevation ≥ 500 m);
  the coast keeps the all-SA table.
- **Test (2026).** Inland airports (the inland table learned without the station) and the four towns: the
  as-shipped low/high with the inland table vs with the all-SA table, pooled high + low MAE; whole interval below
  zero at t1 and t0 under all three assignments; per-region guard.

## 5. The rain % calibration

Stays waiting unless the recorder's evidence meets the precision run's pre-registered rule (`live-rain.mjs` on
the real sources). As of this plan: no rain has fallen at the six airports since the recorder started.

## 6. The last week at Strand, Cape Town and the six recorder cities

- **From 24 Sept 23:58:** what the app said (recorder), what the new rules say on the same recorded inputs, what the
  airport reported.
- **18 → 24 Sept (before the recorder):** the app's own resolver replayed on Open-Meteo's archive (best_match as
  itself, stand-ins for the other four) before and after the new rules, against the airports. Strand and Cape
  Town city: the same replay at their coordinates; what happened is Cape Town airport's reports (27 km from Strand)
  and Molteno Reservoir's synoptic report in the city, said so.

## Order

Plan → Fable → the analyses (one script each, results committed as records) → each change that passes, built with
tests, reviewed by Fable, gated, committed → the recorder reads Strand and Cape Town → Al's page
(`review/rain-fog-frost-for-al.html`, export `rain-fog-frost-ruled.json`) → EVAL.md §9 → Son-Memory.

## Fable's review (25 Sept, 15:10 SAST, verdict PROCEED WITH CHANGES) — adopted in full, before anything was scored

1. **Truth.** The four synoptic towns, Cape Columbine and Langebaanweg's synoptic report are automatic stations
   with no present-weather group and no visibility (checked in the files): they give no rain-now or fog truth.
   The towns stay the frost carry test (night minima). **The West Coast has no fog truth anywhere public**
   (Langebaanweg's METAR carries no weather or cloud either): it keeps today's detector.
2. **Strand's real fogs are hard constraints.** A fog candidate must still fire on both pinned cases — 21 May 2026
   21:00, Open-Meteo 1,040 m, humidity 97 %, spread 0.4 °C (`tests/fog-detector.test.js`); 3 Aug 2026 16:29,
   Tomorrow.io 0.8 km, humidity 95 %, spread 0.8 °C (`tests/fog-detector-second-signal.test.js`) — and
   Open-Meteo's archived wind at those hours was 6.5 and 5.2 km/h. So the grid is: visibility < 1,500 m (fixed),
   humidity ≥ {90, 93, 95} %, spread ≤ {2, 1.5, 1} °C, Open-Meteo wind ≤ {none, 15, 10} km/h, all hours
   (27 cells, today's among them). Every cell is a subset of today's gate, so precision rising is near-certain;
   **the binding number is fog hours still caught, per region, which goes to Al.** (Cape Town airport showed no fog
   on 21 May and CAVOK on 3 Aug while Strand was in fog: an airport cannot vouch for Strand.)
3. **The fog weeks.** Hours are first assigned to noon-to-noon days (12:00 → 11:59 the next day), then the day's
   ISO week decides tune (even) or test (odd), so one night's fog is never split.
4. **Votes.** The vote bar stays at 2 (not tuned) and the replay counts distinct models only (best_match is ECMWF
   9 km, so ECMWF 0.25° is never a second ECMWF vote); only the chance and the amount are tuned. Only best_match,
   ECMWF and GFS carry a rain probability in the archive, so the replayed blended chance is ECMWF-led under every
   assignment — said wherever it is shown.
5. **Winner's curse.** A cell qualifies only when the Wilson 95 % lower bound of its TRAIN hit rate is ≥ 60 %;
   the chosen cell's absolute TEST hit rate is reported with its interval, and "rain at the station, nothing wet on
   screen" is a guard.
6. **Regimes were chosen knowing 2026's regional numbers** (the precision run's Rain's-here table). Said here; R1,
   R2 and R3 are all reported on TEST; the ship decision is for the one candidate the TRAIN rule picks. A region
   needs ≥ 30 R0 calls on TEST to switch. **"Never" is removed from the grid** — no rain hero at all in a regime
   (radar only, all storm season) is Al's call, not a threshold; if even the strictest cell fails there, it goes on
   his page as a question.
7. **Frost.** Co-primary: frost-night MAE (observed low ≤ 2 °C) must improve too. The Lowveld stays blocked
   (Hoedspruit 500 m and Mbombela 862 m pass the elevation gate): not tuned on, not applied. Mthatha (752 m, coastal
   climate) is reported on its own guard row. The gap between the low and the hourly strip's minimum is shown on
   Al's page.
8. **ICON inland.** Both sides learned on 2025 only, leave-one-station-out: the 2025 all-SA table vs the 2025 inland
   table (the shipped refit has seen 2026). The Lowveld stays blocked; the table id goes in `meta.precision`.
9. **The last week.** The replay covers the detector path only (A.2 and the description path need the other
   sources' words); Cape Town airport is labelled context, not Strand truth; Al's page asks which hours he remembers.
   Recorded inputs carry the blended wind, not Open-Meteo's own, so a wind gate is not replayed on them.
10. **One candidate per section**, tested once; if it fails, nothing ships and there is no second pick.

Optional notes taken: vicinity showers (VCSH, VCTS) count toward the ±1 h truth; Open-Meteo's low cloud is a
reported fog diagnostic, not tuned; the recorder counts rain ↔ might-rain flicker; Al's page shows one "Likely"
stat under a "Might rain." hero.
