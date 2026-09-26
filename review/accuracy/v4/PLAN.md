# Fog (the proper fix), the radar, the honest rain %, frost nights — the plan, written before any answer is scored (26 Sept 2026)

Al: "lets do the proper fog fix, and yes go with what you suggested on the radar and honest rain and frost night."
That is his word to ship each change that clears the bar written here. Vonk builds; Fable 5.1 reviews this plan
before anything is scored, then every diff. Same discipline as `v2/PLAN.md` and `v3/PLAN.md`: tune on one period,
prove on another, a change reaches a region only where it is clearly better there, a region not proven keeps
today's behaviour. One commit per change. Worktree `C:\Users\27741\pw-launch-run`, `main` = live `274e5cf`.

## Seen before this plan (said, so nothing below can be tuned on it)

- **The recorder so far** (24 Sept 21:57 → 26 Sept 19:10 UTC, six airports + Strand + Cape Town city, ~330
  readings). Running the existing scorer (`live/score.mjs`) printed: 17 "Rain's here" calls at the airports, all
  from Tomorrow.io's radar override, 9 with no rain in the airport's nearest report; `live-rain.mjs` printed rain
  today n = 10 station-days, next 3 hours n = 221. Tomorrow.io answered in ~53 % of readings (`ok: false` in the
  rest). The radar and rain-% bars below were written after seeing these headline counts; they are set from
  principle (a coin-flip line and the archive's own bar), not from the counts.
- **Strand's "two pinned real fogs" are partly synthetic.** `tests/fog-detector-second-signal.test.js` pins
  Tomorrow.io 0.8 km / RH 95 % for 3 Aug 2026 16:29; the incident capture (`review/fog-incident-20260803/`) says
  every source missed it: Open-Meteo 35.3 km, RH 82 %, spread 3.2 °C; Tomorrow.io 14 km; MET Norway fog 0 %. The
  21 May fixture (1,040 m, RH 97 %, spread 0.4 °C) is not what Open-Meteo's archive holds either. The archive at
  Strand (historical-forecast API, fetched 26 Sept for this plan): **21 May 22:00–00:00** best_match visibility
  900 / 800 / 720 m, RH 90–92 %, spread 1.3–1.5 °C, wind 7–10 km/h, low cloud 41–100 %; UK Met Office RH 94–97 %,
  spread 0.5–1.0 °C, low cloud 73–98 %; Météo-France low cloud 100 %. **3 Aug 16:00–18:00** only Météo-France came
  close (17:00 RH 94 %, spread 0.9 °C, low cloud 63 %; 18:00 RH 97 %, 0.5 °C, 88 %); best_match RH 84–89 %, low
  cloud 0 %. No model sent a fog weather code (45/48) at either. **On the archived inputs, the strict fog rule live
  in the Western Cape (RH ≥ 95 %) does not fire on 21 May; today's standard rule does (22:00–00:00).**
- **MET Norway's `complete` endpoint carries `fog_area_fraction`** (production reads `compact`). Its data-model
  page lists it for the Nordic short-range model; live on 26 Sept it was non-zero at George (5 of 61 steps, up to
  85 %) and 0 at Strand, Cape Town and Durban. No history anywhere.
- Production's `meta.sourceNow` carries no visibility per source; the recorder has Open-Meteo's and Tomorrow.io's
  (`fogSignal.omVisM`, `.tioVisM`) only.

## 1. Fog — the proper fix: stop trusting Open-Meteo's visibility

**Problem.** Layer A (the detector) fires on `min(Open-Meteo, Tomorrow.io) visibility < 1.5 km` + humidity +
spread + no rain; since 30 Sept 2025 Open-Meteo's visibility reads far too low on damp nights, and it is most of
the false fog. The fix replaces the Open-Meteo visibility gate with signals that have history and that production
can read.

- **Truth** (as v3): fog = the airport's visibility < 1 km with no precipitation in the hour; mist, low cloud,
  other as `v3/lib3.mjs fogTruth`. 13 airports (the v3 set). West Coast: no truth, keeps today's rule.
- **Period and split** (as v3): 1 Oct 2025 → 24 Sept 2026 (best_match changed on 30 Sept 2025, so nothing
  earlier), hours on noon-to-noon days, **even ISO weeks tune, odd weeks test**, weeks are the bootstrap blocks.
  Said: v3's fog candidate was tested on these same odd weeks; this is a different candidate family, and the test
  weeks are opened once more, for it only.
- **Inputs (archive = `v4/fetch4.mjs`, the short-lead historical-forecast archive; production = the same fields):**
  for each of the five models production can ask Open-Meteo for — best_match (the main call) and GFS, ICON,
  UK Met Office, Météo-France (the precision request) — temperature, dew point (→ spread, RH), 10 m wind, low
  cloud, weather code, rain amount; best_match's rain %. Open-Meteo's visibility is **not an input**.
- **Candidate rule** — "saturated at the ground": fog now when, for the current hour,
  - no rain: best_match rain % < 30 and rain < 0.2 mm (as today), and
  - at least **k** of the five models are saturated: spread ≤ **s** °C and low cloud ≥ **L** %, and
  - calm: best_match's own wind ≤ **W** km/h.
  Grid: k ∈ {1, 2, 3}, s ∈ {0.5, 1.0, 1.5}, L ∈ {0 (not used), 50, 80}, W ∈ {none, 10, 15} — 81 cells.
- **Hard constraint (Strand, archived inputs):** a cell qualifies only if it fires in at least one hour of each
  real fog window at Strand — 21 May 21:00 → 22 May 01:59 and 3 Aug 16:00 → 17:59 SAST. If no cell does, the
  constraint falls back to 21 May only, and that is reported plainly (3 Aug was invisible to every source).
- **Tuning:** among qualifying cells, maximise F0.5 on the tune weeks pooled over the 13 airports.
- **Kept, not changed:** Tomorrow.io's visibility path (< 1.5 km + RH ≥ 90 + spread ≤ 2 + no rain — no archive,
  and the 3 Aug unit tests pin it; now an OR beside the new rule instead of a min with Open-Meteo); the
  one-fog-word path (A.2) and the description path (no archive; the recorder counts them); the fog trend (copy
  confidence only). Open-Meteo's visibility stays in the payload and in `fogSignal` for the recorder.
- **Test (odd weeks), against both rules — today's (standard) and the live one (strict in the Western Cape,
  Garden Route, Eastern Cape, KZN coast, Lowveld):**
  - *Pooled:* F0.5 higher than the live rule (as deployed per region), whole interval above zero.
  - *Per region, vs the rule live there:* wrong fog calls per 1,000 hours lower, whole interval below zero, **and**
    F0.5 not lower (point estimate). Where both hold, the new rule ships in that region; elsewhere the live rule
    stays. Fog hours caught before/after are reported per region (the cost), and what the airport reported when
    each rule said fog.
- **Production:** best_match adds `cloud_cover_low` to the main call; the four models add `dew_point_2m` and
  `cloud_cover_low` to the precision request (more call units — stated in the diff). Where the new rule ships
  and its inputs are missing (request failed, no key, outside SA, and the Lowveld unless the request is made
  there for fog), the region's live rule applies. `fogSignal` carries the rule, the saturated-model count and
  best_match wind for the recorder.
- **Recording for the sources with no history** (no condition change): `meta.sourceNow[]` gains each source's
  own visibility (WeatherAPI `vis_km`, Pirate `visibility`, Tomorrow.io, Open-Meteo), so the recorder builds the
  history the next fog run needs. MET's `fog_area_fraction` would need the `complete` endpoint: reported, not
  switched.
- **Live check after shipping:** the recorder's per-release fog count (`score.mjs`, Al's note section).

## 2. The radar — "Rain's here" from Tomorrow.io's radar alone

- **Calls:** every recorder reading at the six airports whose `conditionReason` is `tomorrow-io-radar-override`
  (the ladder did not say rain; the radar made it). Strand and Cape Town city: counted, no truth.
- **Truth:** *primary* — rain (RA / DZ / SH / TS with precipitation; not VC) in any airport report within 30 min
  of the forecast's own time (`meta.updatedAtLabel`). *Secondary* — within 60 min, VCSH / VCTS counting.
- **Decision (primary, hours; Wilson 95 % interval on the share right):** upper end < 50 % → **mostly wrong →
  switch off the radar-alone call** (the override no longer turns the hour to rain; the ladder's own key stands;
  the next-hour bump is untouched). Lower end ≥ 50 % → keep. Otherwise **too few to judge**: report n, and the
  number of calls at which the observed rate would decide, and keep recording. Distinct rain events (station-days)
  reported beside the hours; the decision is on hours.

## 3. The honest rain % — the pre-registered rule (`v2/PLAN.md`, 25 Sept 10:55 SAST), applied to the recorder

- The archive bar passed on 25 Sept; its next step was shadow mode, "so the recorder proves it on the real sources
  before anything a user sees changes". Read as the archive's own bar on the recorder: **the calibrated % beats the
  served % on the Brier score with the whole 95 % interval below zero, 7-day blocks, for rain today** (the
  pre-registered lead), no airport's interval above zero. Next-3-hours reported as secondary. Nothing new is added
  that makes it easier.
- **Met →** the served % becomes the calibrated one (`v2/results/rain.json` curves), Al's word ("honest"). **Not met
  →** report n, complete 7-day blocks, and the readings needed: n at which the archive's own effect and spread
  would give a whole interval below zero (from `rain.json`'s bootstrap), in days at the recorder's rate.

## 4. Frost nights — a new attempt

v3's attempt (a fixed 1.6 °C off the low on clear, calm, dry nights) failed: all nights under the ECMWF-heavy
assignment showed no clear gain at the airports, and Johannesburg got worse (1.10 → 1.81 °C).

- **Truth, stations, leads, assignments** as v3: inland airports (grid elevation ≥ 500 m, Lowveld out) — FAUT
  (own guard row), FAOR, FABL, FAUP, FAKM, FAMM, FAPP; the four SAWS towns (Beaufort West, Graaff-Reinet,
  Pietermaritzburg, Ladysmith — **never used in tuning**, the carry test); t1 and t0; the three source
  assignments. Observed low ≤ 2 °C = a frost night.
- **Base = the low as production computes it now** (`bbb662a` + `eeb530b`: the blend mixed with the consensus, the
  inland table in its six regions, all-SA elsewhere; tables learned on 2025, leave-one-station-out at airports).
- **Gate:** Open-Meteo's forecast night (as v3) mean cloud ≤ C, mean wind ≤ W; C ∈ {10, 20, 30, 40} %,
  W ∈ {6, 8, 10, 12} km/h.
- **Two correction forms (the v3 fixed δ is not among them):**
  - *dry* — δ = k × D, D = the forecast dew-point depression at the night's start (how far the air can cool);
  - *spread* — δ = k × (base − the coldest of the five models' own night minimum) (how far the coldest model
    already sees it going).
  k ≥ 0 by least squares through zero on gated 2025 nights, δ capped at 5 °C.
- **Tuning (2025):** the (form, C, W) with the lowest leave-one-station-out MAE over all 2025 nights at the inland
  airports, mean over both leads and three assignments.
- **Region guard on 2025, before the test:** a region whose 2025 leave-one-station-out MAE gets worse (point
  estimate) under any assignment at either lead is **blocked** — the low there stays exactly as today.
- **Test (2026), the rule as it would ship** (blocked regions unchanged, counted at zero change): ships when the
  all-nights MAE drop has its whole interval below zero at t1 and t0, under all three assignments, pooled over the
  inland airports **and** pooled over the four towns; frost-night MAE likewise (co-primary). Then the 2026 guard: a
  region whose interval is wholly above zero under any assignment at either lead is blocked too (a block only
  removes the change). Mthatha on its own row.
- **Production:** days 0 and 1 only, after the precision mix, the displayed low only (the hourly strip unchanged,
  the low stays ≤ the strip's minimum); inputs Open-Meteo's hourly cloud, wind, dew point (and the four models'
  temperatures for *spread*); `meta.precision` records the correction. Any missing input → today's low.

## Ship, for every change that passes

Tests, full gates (serial suite, build, image budget, fold, desktop, bespoke, drift, rotation, month + control,
precision table `--check`, gate shots) → Fable's review of the diff → pull and rebase on `origin/main` (Home D is
being built in `C:\Users\27741\pw-home-d` at the same time; never force) → push → `/api/version` → live smoke
(`scripts/live-smoke.mjs`) → the recorder's next reading carries the new version and rule. Anything wrong live:
Vercel Instant Rollback (one step, `review/launch/RUNBOOK.md`). Nothing that fails its bar ships. No question
pages; EVAL.md §11; the Son-Memory log.
