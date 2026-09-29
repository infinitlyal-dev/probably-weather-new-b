# v8 — the "measured at" line, a phone check for Home D, the Western Cape's false Windy, the Highveld weights re-scored (the plan, written before anything is scored, 29 Sept 2026)

Al's brief (29 Sept, after §15 shipped): the fixes that do not wait on AfriGIS. Weather Service stations stay out of
the live app; airports are the only live readings. Vonk builds; Fable 5.1 reviews this plan before anything is scored,
then every diff. Worktree `C:\Users\27741\pw-launch-run`, `main` = live `28b8562` + EVAL §15 (`1afaf4e`).
Temperatures are not touched (`tests/temp-freeze.test.js` unchanged).

## Seen before this plan (said, so nothing below is tuned on it)
- EVAL §14.1: the Western Cape's today rule (v5's ×1.6 table at 27.5, fires on a raw blend ≥ 17.2) called 11 % of calm
  hours Windy at 17 WC SAWS stations; per station: Cape Point 33, Agulhas 33, Struisbaai 14, Molteno (city bowl) 14,
  Slangkop 10, Malmesbury 9, Portnet 6, Cape Town airport 0.9 per 100 calm hours.
- EVAL §15.3 (report only): a veto by **each station's own** calm report cut the WC SAWS stations' false Windy
  11.5 → 2.8 per 100 calm hours with caught 84.8 → 87.1 %. That rule needs the stations' own reports live, which are not
  licensed. The candidate below uses only Cape Town airport's report — a different rule, not yet scored anywhere.
- EVAL §13.1: Highveld own weights at OR Tambo 4.37 → 3.03 km/h off, 6 of 6 blocks better, 23 full-five proof hours of
  the 24 required; weights Pirate .33, MET .21, WA .18, TI .16, OM .12, k 1.078 (learned on the 30 readings before
  27 Sept 04:10 UTC). The recorder has run since; none of its new FAOR readings has been looked at.

## 1. The "measured at" line (Al: go)
- Server: `meta.station.measured = true` when the airport's report set the numbers shown (the station word exists,
  its report is ≤ 3 h old — `GAP_MAX_H` — and the region's numbers flag is on); false otherwise. No line when the
  models set the wind.
- Phone: one small line under the wind (Home D's stats row, the desktop view): EN "Measured at Cape Town airport,
  09:00", AF "Gemeet by Kaapstad-lughawe, 09:00"; the time is the report's, in the place's local time (HH:MM).
  Airport names per station, all five languages; zu/xh/st through the language skills and lang-check (triage-high
  lines are not wired — the line is then hidden in that language, never shown in English).
- Fit: the longest language at 414×715 and at the fold gate's smallest phone, Home D and desktop — the fold gate gets
  the line in its fixture.

## 2. The phone check (Home D) — `scripts/live-smoke.mjs` phone legs rewritten
Five languages, at a place with a live airport word (Gqeberha) and one without (Strand): (a) the joke writes itself on
after the photo (hidden, then written); (b) tap hides, tap shows; (c) the pull-up list has hour rows, each with a wind
number; (d) Share hands over one JPEG postcard; (e) the "measured at" line shows where `meta.station.measured` is true
and not where it is absent. **Negative controls:** `--break=<a|b|c|d|e>` patches the served page in the browser (the
check's own route interception) so exactly that behaviour is broken; each run must fail on that leg and only that leg,
and the unbroken run must pass. Run on a local build, then on production.

## 3. The Western Cape's false Windy (Cape Town airport's report as the tool)

**Where:** places in the app's Western Cape region (`regionOf`) outside Strand's zone (15 km of 68911).
**Truth:** every WC SAWS SYNOP station outside Strand's zone with v7's models (history only — they are not used live)
and Cape Town airport's own METAR. Classes, timing, instants, weights and the three source guesses exactly as
`review/accuracy/stations/PLAN.md` §3.1–3.2 (pumping: gust ≥ 50 or mean ≥ 30; calm: mean < 20 and gust < 35; instants
HH:30, truth = next report, weight 1/k, METAR usable 10 min after its time).

**Rules (M = today, as production: v5 table, v7 gust rules, B-2 consensus, and at the airport's covered towns the §15
station layer):**
| | rule |
|---|---|
| **A** airport veto | M, except: when Cape Town airport's latest usable report (≤ F_v old) is calm-ish — mean < m_v and gust (where sent) < g_v — the models' Windy is dropped at places within R km of the airport. m_v ∈ {15, 20, 25} km/h, g_v ∈ {35, 45}, F_v ∈ {1.5, 3} h, R ∈ {30, 60, 200 (the whole region)} km |
| **B** a higher line | M with the WC's Windy line on the corrected number raised 27.5 → X, X ∈ {30, 32.5, 35, 37.5} (models only) |

**Tuning (March–June, all WC-rest stations pooled, the three guesses averaged):** for each family the setting with the
lowest false rate whose caught share is at most 2 points below M's; ties → the setting that vetoes least (lower
m_v, lower g_v, shorter F_v, smaller R; for B the lower X). 
