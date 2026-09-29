# v8 — the "measured at" line, a phone check for Home D, the Western Cape's false Windy, the Highveld weights re-scored (the plan, written before anything is scored, 29 Sept 2026)

Al's brief (29 Sept, after §15 shipped): the fixes that do not wait on AfriGIS. Weather Service stations stay out of
the live app; airports are the only live readings. Vonk builds; Fable 5.1 reviews this plan before anything is scored,
then every diff. Worktree `C:\Users\27741\pw-launch-run`, `main` = live `28b8562` + EVAL §15 (`1afaf4e`).
Temperatures are not touched (`tests/temp-freeze.test.js` unchanged).

**Note on this file's history (said plainly):** the first two commits of this plan (`9fef42c`, `7cb96ef`) were
truncated after §3's tuning paragraph by a scripted edit of mine before the first commit — the bar, §3's production
notes, §4 and §5 were never on disk. Fable reviewed from the description and flagged it. This commit restores the full
text as written, unchanged in substance, with Fable's ten changes in §6. Nothing has been scored.

## Seen before this plan (said, so nothing below is tuned on it)
- EVAL §14.1: the Western Cape's today rule (v5's ×1.6 table at 27.5, fires on a raw blend ≥ 17.2) called 11 % of calm
  hours Windy at 17 WC SAWS stations; per station (proof months): Cape Point 33, Agulhas 33, Struisbaai 14, Molteno
  (city bowl) 14, Slangkop 10, Malmesbury 9, Portnet 6, Cape Town airport 0.9 per 100 calm hours.
- EVAL §15.3 (report only): a veto by **each station's own** calm report cut the WC SAWS stations' false Windy
  11.5 → 2.8 per 100 calm hours with caught 84.8 → 87.1 %. That rule needs the stations' own reports live, which are not
  licensed. The candidate below uses only Cape Town airport's report — a different rule, not yet scored anywhere.
- EVAL §13.1: Highveld own weights at OR Tambo 4.37 → 3.03 km/h off, 6 of 6 blocks better, 23 full-five proof hours of
  the 24 required; weights Pirate .33, MET .21, WA .18, TI .16, OM .12, k 1.078 (learned on the 30 readings before
  27 Sept 04:10 UTC). The recorder has run since; none of its new FAOR readings has been looked at.
- This session, while building §1: the live check at 07:31 UTC (§15) showed Cape Town city "clear" with Molteno calm.

## 1. The "measured at" line (Al: go)
- Server: `meta.station.measured = true` when the airport's report set the numbers shown; false otherwise. No line
  when the models set the wind. (Exact rule: §6 change 9.)
- Phone: one small line under the wind (Home D's credit line, the desktop sidebar): EN "Measured at Cape Town airport,
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
and Cape Town airport's own METAR (see §6 change 2). Classes, timing, instants, weights and the three source guesses
exactly as `review/accuracy/stations/PLAN.md` §3.1–3.2 (pumping: gust ≥ 50 or mean ≥ 30; calm: mean < 20 and gust
< 35; instants HH:30, truth = next report, weight 1/k, METAR usable 10 min after its time).

**Rules (M = today, as production: v5 table, v7 gust rules, B-2 consensus, and at the airport's covered towns the §15
station layer):**
| | rule |
|---|---|
| **A** airport veto | M, except: when Cape Town airport's latest usable report (≤ F_v old) is calm-ish — mean < m_v and gust (where sent) < g_v — the models' Windy is dropped at places within R km of the airport. m_v ∈ {15, 20, 25} km/h, g_v ∈ {35, 45}, F_v ∈ {1.5, 3} h, R ∈ {30, 60, 200 (the whole region)} km |
| **B** a higher line | M with the WC's Windy line on the corrected number raised 27.5 → X, X ∈ {30, 32.5, 35, 37.5} (models only) |

**Tuning (March–June, all WC-rest stations pooled, the three guesses averaged):** for each family the setting with the
lowest false rate whose caught share is at most 2 points below M's; ties → the setting that vetoes least (lower m_v,
lower g_v, shorter F_v, smaller R; for B the lower X). Then the one family with the lower tuning false rate goes to
proof.

**The bar (proof 1 July → 28 Sept 12Z, the v7 archive's end), under all three guesses:**
1. false Windy per 100 calm hours falls by ≥ 3, its 95 % interval (paired 7-day blocks, 1,000 draws, seed 7) wholly
   below zero;
2. caught (share of pumping reports called Windy) falls by at most 2 points (point) and its interval's lower end is
   ≥ −5 points (plus §6 change 3);
3. ≥ 30 pumping proof reports on ≥ 6 days;
4. it holds with the station that has the most calm hours called Windy under M left out;
5. reported, not a bar: Cape Town city (Molteno 68819, Portnet 68817), Cape Town airport, and each station.
Passes → ships in the WC-rest. Fails → today's rule, said why.

**In production (if A ships):** the veto runs after the ladder and the B-2 consensus, before the radar and fog layers:
a `wind` key from the models' wind rungs is re-derived with the wind inputs zeroed (the next rung the ladder gives —
sky, might-rain, UV), then the vote consensus again; reason `airport-calm`, recorded. The station layer (§15) then runs
unchanged, so a pumping airport can still say Windy. The feed read widens to WC-rest places (only when the models said
Windy, so most requests still read nothing). If B ships: a new generated threshold for the WC-rest in the wind table.
Numbers shown are unchanged either way.

## 4. The Highveld wind weights, re-scored (the v6 bar, not moved)
- **Frozen:** the weights and k learned in v6 (`v2/results/v6-score.json` `live.LW.Highveld`), not re-learned.
- **Proof:** every OR Tambo reading after v6's split (27 Sept 04:10 UTC) — v6's 31 proof readings plus every reading
  since — built exactly as `v6/score6.mjs` builds them (the same code path, a new window end).
- **Bar (v6 §4a, Fable 1):** point gain ≥ 1 km/h, better in ≥ 4 of 6 six-hour blocks (§6 change 8: two thirds of the
  blocks), not worse in more than half, ≥ 24 proof hours with all five sources; the pooled six-airport interval (frozen
  weights per region, the same extended window) below zero; and not blocked by Windy (false Windy on calm hours more
  than doubled and up by ≥ 3).
- Passes → Highveld joins the Eastern Cape in `api/_lib/wind-weights.js` (the generator, `--check`). Fails → unchanged,
  said why.

## 5. Ship
Each change that passes: full gates (serial vitest incl. the freeze test, image budget, build, bespoke, rotation, drift
guard, seasonal, fold, desktop, Home D check, gate shots, every table `--check`, and the new phone check with its
negative controls), Fable's diff review, pull --rebase, push. `/api/version`, the new live smoke on production, then
Cape Town city, Bellville, Gqeberha and Strand live: wind, gusts, headline, "measured at".

## 6. Fable's ten changes (plan review, 29 Sept), adopted before anything is scored
1. The full plan is committed (this file) before any scoring.
2. **Cape Town airport's own rows are out of family A's tuning and proof** (its own-station veto is the kind of rule
   §15.3 already showed); they are reported beside.
3. **Bar 2 tightened for "without losing the real pumping hours":** in addition, no station with ≥ 30 pumping proof
   hours loses more than 5 points caught (under all three guesses); the pass survives dropping the station with the
   most pumping hours (as v7); the price is stated in hours (pumping hours lost, false calls saved). R = 200 stays a
   candidate under these.
4. **Ledger:** §14.1's per-station rates were proof-month numbers; R and the family are chosen on March–June only.
5. **Production:** after the veto the re-derived key goes through `applyVoteConsensus` again; the vetoed inputs are what
   is stored as the selector (so the cache-hit detector re-derives the same way; a veto can stand ≤ 15 min after the
   airport's next report, as §15's key); the rule is recorded in `nowOverrides` (`airport-calm`) and in `meta.wind`.
6. **A test pins that the veto and the §15 station layer never both fire:** veto needs mean < m_v ≤ 25 and gust < g_v
   ≤ 45; the station fires at ≥ 30 / ≥ 50, and the gap path's numbers equal the report's.
7. **Said:** under a vetoed headline the numbers shown stay the models' (e.g. 31 km/h under "Clear sky").
8. **Highveld block bar:** `score6.mjs`'s `better >= 4` was written for 6 blocks; on the longer window the same bar is
   "better in at least two thirds of the blocks" (⌈⅔ × blocks⌉), `worse > blocks / 2` still blocks, full-five ≥ 24.
   The pooled gate, the Windy block (`blocksLW`) and the four-source proxy (LW4) are re-scored on the extended window.
   The new days alone are reported beside the union; **if the new days alone are worse than today's rule, it does not
   ship.**
9. **The measured flag:** `measured` is true when the airport's report fired "now" itself (pumping, ≤ F) or its report is
   at most **1.5 h** old (F, the freshness the history chose) — so the numbers shown are at least 87.5 % the airport's
   (T = 12 h fade) — and never when the region's numbers flag is off. Between 1.5 and 3 h the numbers still carry the
   faded gap, without the line. Phone legs read the DOM (rects, opacity, `elementFromPoint`), never `__PW_*` flags;
   leg (e) asserts both directions against the page's own `/api/weather` response (Gqeberha shows it iff its payload
   says measured; Strand never), and the positive case is proven on the local build with a fixture; break (a) has two
   variants (shown at once / never written); leg (d) asserts one file, `image/jpeg`. A language whose line is held by
   lang-check is listed and asserted hidden (none is: 15 of 15 passed).
10. **Live guard and revert rule:** the recorder adds Molteno Reservoir (68819, research use) beside the Cape Town city
    line; over the 14 days to 13 Oct 2026 the share of calm Molteno reports the app calls Windy, and of pumping ones it
    misses, goes to Al with the numbers, and he rules.
