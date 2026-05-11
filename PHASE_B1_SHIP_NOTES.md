# Probably Weather — Phase B-1 Ship Notes

**Date:** 2026-05-11
**Branch:** `main` (HEAD `cacab43`, SW `pw-v2026-05-11-005`, 168/168 tests)

These notes were also written to `projects/probably-weather.md` in
`Son-Memory` but that repo had a pre-existing unresolved merge
conflict at the time of this commit. The Son-Memory copy is on disk
locally but unstaged; resolve the conflict first, then the same
content can be committed there. This file is the GitHub-accessible
fallback per the Phase B-1 brief.

---

## Phase A (2026-05-11)

Three bundled fixes for two known bugs + one wind-banner UX. Investigation files archived in repo at `docs/weather-logic/` (commit `eb09b28`).

**Commits:**
- `212178a` feat(weather): UV temp gate + hail/thunder distinct + wind banner UX
- `2b7f89c` fix(wind-banner): iOS safe-area + header overlap + 44x44 tap target

**Shipped:**
1. **UV temp gate**: UV no longer fires as headline condition when daily high < 15°C. Closes Bug 2 (Joburg 5°/13° + UV 6 → "High UV"). Applied at 4 sites: `deriveCondition` priorities 6 + 16 in `api/weather.js`; `computeTodaysHero` (~L512, ~L522) and `computeHomeDisplayCondition` (~L572) in `assets/app.js`.
2. **Hail and thunder as distinct conditions**: New first-class condition keys with two-source consensus rule mirroring fog. `bg/storm/` shared via `WEATHER_BACKGROUND_ALIASES` + `CSS_VARIANT_ALIAS` (no new image folders). Hero labels, headlines, witty copy added in 5 languages with defensive fallback to storm copy.
3. **Wind banner UX**: ⚠️ Wind Warning prefix in 5 languages, localStorage 24h dismissal, iOS safe-area padding, 44×44 dismiss tap target, header overlap fix via `body:has(#capeWindBanner:not(.hidden)) .container { padding-top: var(--cape-wind-offset) }` driven by JS measurement.

**Test count:** 105 → 133 (+28 in `tests/weather-logic-phase-a.test.js`).

**Phase A exports:** `deriveCondition` and `categorizeDesc` named-exported from `api/weather.js` for unit testing.

---

## Phase B-1 (2026-05-11, same day as Phase A)

Three items from the Codex adversarial review. Pre-Phase B work: investigation files copied from sibling worktree to repo at `docs/weather-logic/` so future threads can fetch via GitHub MCP.

**Commits:**
- `eb09b28` docs: archive Phase A investigation files
- `52ddaed` feat(weather): Phase B-1 Item 1 — conditionReason + conditionSignals
- `48539a6` feat(weather): Phase B-1 Item 2 — category-aware weighted voting
- `cacab43` feat(weather): Phase B-1 Item 3 — preserve per-hour condition through aggregation

**Shipped:**

### Item 1 — conditionReason + conditionSignals

`deriveCondition` return shape changed from `string` to `{ key, reason }`. 22 distinct rule identifiers (`'high-uv-with-temp-gate'`, `'two-source-consensus-hail'`, `'majority-override-clear'`, etc).

`now.conditionReason` and `now.conditionSignals` added to API response. Each `daily[i]` also gains `conditionReason` + `conditionSignals`.

`conditionSignals` shape:
```json
{
  "descWinner": "Light rain",
  "numeric": { "rainChance": 65, "tempC": 18, "windKph": 22, "uvIndex": 4, "cloudPct": 80, "dailyHighC": 22, "isDay": true },
  "sourceVotes": [
    { "source": "Open-Meteo", "desc": "Slight rain showers", "vote": "rain" },
    { "source": "MET Norway", "desc": "Rain", "vote": "rain" }
  ],
  "overrides": [
    { "rule": "majority-override-clear", "from": "rain-possible", "to": "clear", "reasonDetail": "1/2 sources voted rain/cloudy/storm, no trusted-source rain" }
  ]
}
```

Closes Codex's "make mismatches debuggable instead of relying on comments" finding.

### Item 2 — Category-aware weighted voting

`pickWeightedMostCommon` buckets descriptions by `categorizeDesc` BEFORE weight accumulation, so 'Light rain' / 'Moderate rain' / 'Rain showers' combine into one rain-category vote instead of fragmenting and losing to a generic 'Clear sky'. Returns the highest-weighted exact desc within the winning category as the representative label.

**`DESC_WEIGHTS = [1, 0.1, 1, 1]` intentionally unchanged** — WA's 0.1 weight handled both fragmentation (now solved here) AND unreliability (separate calibration question that wants real data, not a refactor side-effect). Documented in function docstring.

### Item 3 — Per-hour condition through aggregation

Open-Meteo URL extended to request `&hourly=...,weather_code`. Each source's hourlies gain a `descs[]` array. `aggregatedHourly[i]` adds two new fields per hour:
- `condition` (categorised: `storm | rain | cold | cloudy | fog | clear`)
- `descLabel` (winning provider desc string for that hour)

Frontend hourly chart can now decorate hour cells with thunder/storm/cloud icons. Uses Item 2's category-aware vote with `HOURLY_DESC_WEIGHTS = [1, 0.1, 1]`.

**Test count:** 133 → 168 (+35 in `tests/weather-logic-phase-b.test.js`: 19 Item 1 + 9 Item 2 + 7 Item 3).

**Phase B-1 exports:** `pickWeightedMostCommon` named-exported from `api/weather.js` (joins `deriveCondition` + `categorizeDesc`).

---

## Deferred to Phase B-2

Independent of voting/aggregation changes. Cleaner as follow-ups.

- Broader multi-source consensus — extend Phase A's two-source rule to `wind` / `heat` / `cold` / `storm`.
- Provider mapping completeness:
  - Pirate Weather expanded-icon mode (`mist` / `haze` / `smoke` / `mixed`)
  - MET Norway `metSymbolMap` filled in from `api.met.no/weatherapi/weathericon/` reference (day/night/polar variants `1` / `1n` / `1m` mapping correctly)
- WeatherAPI rain-flag unreliability calibration — DESC_WEIGHTS shift if real data justifies it.
- Open-Meteo `utcOffsetSeconds` timezone SPOF (Codex flagged: if OM fails, MET hourly alignment + isDay defaults to UTC).
- Triple-decision frontend architecture (`deriveCondition` + `computeTodaysHero` + `computeHomeDisplayCondition` all re-rank — consolidation candidate).

---

## Learnings from B-1

- Refactoring a function's return shape from string to `{ key, reason }` breaks tests cleanly with a sed-style `expect(result)` → `expect(result.key)`. Cleaner than feature-flagging a boolean param.
- Override audit trail (`conditionSignals.overrides` array of `{ rule, from, to, reasonDetail }`) makes post-hoc transformations traceable without reading code. FIX-001 majority-override-clear and FIX-002 fog-blocked-single-source both now record themselves.
- MET Norway timeseries alignment to local-midnight uses `utcOffsetSeconds` from Open-Meteo. Mock data in tests must account for this offset — entry at UTC hour H lands at aggregated local hour H + offset. Tripped me up writing Item 3 tests; fixed via a `SAST_OFFSET_HOURS = 2` constant in test helpers.
- Single-source thunder vote does NOT win the hourly category vote — by design, matches Phase A's two-source-consensus philosophy. Hourly thunder needs corroboration from another source to surface, same as the now-path. This is intentional; documented in test "Single-source severity is correctly NOT promoted".
- Category-aware voting is purely additive in the existing test corpus — all 152 prior tests passed without modification after the refactor. The new behaviour kicks in only for the previously-unhandled fragmentation cases.
