# Session findings — 2026-07-18 closing session (logged, not fixed)

Per the "NO scope additions — new findings get LOGGED" rule. None of these block the
committed work; each is Al's call to action later.

## 1. Tzaneen falls outside the lowveld box (coverage gap, not mis-tag)
`lowveld` box minLon is 30.5, but Tzaneen (Limpopo lowveld) is at lon ~30.16 → it gets
**no** region tag. Not a mis-tag (no wrong region fires there), just a gap: a Lowveld-named
line won't serve in Tzaneen. Fix if wanted: widen `lowveld.minLon` to ~30.0 in
`assets/geo-regions.js` (check it doesn't pull in Polokwane/Highveld towns first). Named
test cities (Nelspruit/Hoedspruit/Phalaborwa) are all covered.

## 2. Border-town double-tags (informational, acceptable)
New boxes overlap the existing province/climate boxes at genuine border towns, so some
resolve to two regions: Kokstad→kzn+eastern-cape, Harrismith→free-state+kzn, Aliwal
North→free-state+eastern-cape, Graaff-Reinet→karoo+eastern-cape. The tag system allows
multiple matches; worst case a region-named line serves one adjacent-province border town.
Left as-is (tightening the boxes to be mutually exclusive would be more fragile than the
gain). Named targets each resolve to exactly one region.

## 3. verify-lines.mjs — completeness gap on non-audit bins (low severity)
`review/tools/verify-lines.mjs` reconciles (a) audit-line indices and (b) every manifested
key (three-way bank↔manifest↔draft↔verdict). It does NOT independently enumerate the bank,
so a silent fill of a non-manifested slot in a bin outside `audit.conditions`
(`partly-cloudy` / `witty_low_confidence`) would pass unseen. NOT reachable via the apply
(which writes bank+manifest together) and the `witty-empty-slot-safety` test pins those
bins' residual empties — so shipped data is clean. Header comment corrected to stop
overclaiming. A full close needs a reverse pass with a pre-batch baseline (else it
false-positives on the many legitimate pre-existing non-manifested fills).

## 4. CSP: install-page QR uses an external image (enforce-flip blocker)
`assets/install.js` renders `<img src="https://api.qrserver.com/…">` (desktop "open on
phone" flow). The strict `img-src 'self' data: blob:` reports/blocks it. Shipped as
Report-Only so nothing breaks. Before flipping to enforce, decide: allowlist
`api.qrserver.com` in `img-src`, or self-host the QR. Full checklist in `review/CSP-NOTES.md`.

## 5. generate-review-batch.mjs doesn't surface flag_reason (soft)
The 154 FLAG debt entries carry Sol's `flag_reason`, but `scripts/generate-review-batch.mjs`
emits only EN+AF+provisional draft to the native reviewer — the reviewer doesn't see WHY
Sol flagged the line. Consider printing `flag_reason` on flagged rows so the native has the
context. Out of scope this session.

## 6. Two heavy tests flake under full parallel load (infra, pre-existing)
`tests/client-bundle.test.js` (P6 bundle) and the 1.36M-iteration grid in
`tests/witty-day-tags.test.js` (15s `it` budget) intermittently time out when all 81 test
files run in parallel (CPU contention) — a different one each run. Both pass in isolation
and the whole suite passes green with `npx vitest run --no-file-parallelism` (21632/21632).
Not a regression from this session. Consider bumping those two `it` timeouts or marking them
`sequential` if CI flakes.

## 7. Mobile header brand title overlaps the Language button at 200% zoom (pre-existing)
At 200% text zoom on mobile, the header brand "Probably Weather" grows enough to overlap the
top-right Language button. Separate from the GATE-2 "mobile hero collision" (the Probably+temp
display, which IS fixed) — this is header chrome whose size comes from app.css, unaffected by
the Onest adoption, so it collides at 200% independent of this wave. Fix if wanted: cap/scale
the mobile `.brand`/header title at zoom, or let the header stack. Logged, not fixed (Al named
the hero; the header is a separate, pre-existing zoom issue).

---

# Session findings — 2026-08-03 fog incident + second visibility signal

## 8. INCIDENT: live fog miss at Strand (diagnosed, source-side, no code fault)
2026-08-03 16:29 SAST, Strand (-34.1163, 18.8362): thick fog physically present, app served
`clear` / "Partly cloudy" (`conditionReason: majority-override-clear`). Raw captures for all
five sources are in `review/fog-incident-20260803/` with `FINDINGS.md`.

**Nothing was dropped by the pipeline.** Every source missed the fog:
- Open-Meteo `hourly.visibility` @16:00 = **35300 m**; `weather_code` = 2 (partly cloudy)
- MET Norway `fog_area_fraction` = **0** at every timestep; symbol `partlycloudy_day`
- Tomorrow.io `visibility` = **14 km**; `weatherCode` 1102 (mostly cloudy)
- WeatherAPI / Pirate Weather: raw NOT captured (keys absent from local `.env`); the live
  payload shows their descs as "Clear sky" / "Partly cloudy", so neither cast a fog vote.

Both fog paths were correctly evaluated and correctly returned false:
`detectAdvectionFog` needs vis<1500 m AND RH>=90 AND dewSpread<=2 (got 35300 / 82 / 3.2);
`corroboratedFogUpgrade` needs >=1 fog vote (got 0).

**This is the SECOND recurrence at this exact location** — api/weather.js already records
"Strand 2026-06-01: 43.7 km in dense ground fog". Open-Meteo's grid is repeatably wrong about
visibility over Strand.

## 9. CHANGE: Tomorrow.io wired as a second visibility signal (shipped this session)
Directly from finding 8. Tomorrow.io's `/v4/timelines` request gains `visibility`;
`hourlies[3].visibilityKm` carries it (named for its unit — TIO publishes KM, OM publishes
METRES); `detectAdvectionFog(om, idx, tio = null)` now takes the **minimum of all available
visibility reads**, converting km→m explicitly, in both the current-hour gate and the 1-3h
trend loop. Detector thresholds are UNCHANGED — only the number they are applied to.
Absent/null/non-numeric Tomorrow.io degrades to Open-Meteo-only behaviour exactly.
Raw per-source reads (`omVisM`, `tioVisM`, `visSource`) are logged and added to
`meta.conditionConfidence.fogSignal` so a future incident can capture the pair from the
payload — during this incident the server log was unreachable and the payload was the only
evidence available.

Also corrected: the comment at ~591 claiming "the other four sources expose no visibility
field" was factually wrong. WeatherAPI's `current.vis_km` is noted in-code as a possible
THIRD signal — deliberately NOT wired, pending a ruling (it is current-hour only, with no
per-hour array to align to).

Tests: `tests/fog-detector-second-signal.test.js` — TIO absent → OM-only unchanged;
TIO 0.8 km + OM 35 km → detector sees 800 m and fires; TIO 14 km + OM 35.3 km (today's actual
values) → min 14 km, verdict none; exact km→m conversion table incl. the 1450/1500 m rounding
trap. Full suite 21649 passed, serial, build gate green.

## 10. Negative visibility is accepted by the Open-Meteo branch (LOGGED, Al's ruling: fix separately)
Found by Codex adversarial review. `isNum()` is `typeof number && Number.isFinite`, which
accepts **negatives**. A provider "no data" sentinel (-1, -999, -9999 are all common) becomes
the minimum and forces `currentFog: true` on **every request** — a permanent false positive,
the worst failure mode this detector has. Verified live:
`detectAdvectionFog({visibility: fill(-1000), ...}, 16)` → `currentFog: true, visKm: -1`.

The **Tomorrow.io** side is guarded as of this session (raw km < 0 → treated as no signal,
in both the current-hour read and the trend loop, with regression tests).
The **Open-Meteo** side is NOT — it is pre-existing (since 2026-05-21) and was deliberately
left untouched because this session's brief required OM-only behaviour preserved byte-for-byte.

Codex verdict on the shipped change was **DO NOT SHIP** solely on this point. Al ruled
2026-08-03: ship the Tomorrow.io change as-is, fix the OM exposure separately. Real-world
probability is low (Open-Meteo returns non-negative metres in practice) but the blast radius
is total, so this should not sit indefinitely. Fix is one line, mirroring the TIO guard.

## 11. Local `.env` is missing three provider keys (blocks incident capture)
`WEATHERAPI_KEY`, `PIRATE_WEATHER_KEY` and `MET_USER_AGENT` are all empty locally (0 chars);
only `TOMORROWIO_API_KEY` is set. During the fog incident this made it impossible to capture
WeatherAPI and Pirate Weather raw responses at the moment they mattered — the two gaps in
`review/fog-incident-20260803/`. MET Norway needs no key, only a non-empty User-Agent, so it
was re-fetched with a substitute. Fix: `vercel env pull` (Vercel CLI is not installed —
`npm i -g vercel`), or populate `.env` by hand, so the next incident capture is complete.
