# Probably Weather — Phase B-2 Ship Notes

**Date:** 2026-05-11 (same-day as Phases A and B-1)
**Branch:** `main` (HEAD `61fb10e`, SW `pw-v2026-05-11-008`, 202/202 tests)

These notes are the GitHub-accessible audit trail per the Phase B-2 brief. Son-Memory `projects/probably-weather.md` also gains a Phase B-2 section (committed separately).

---

## Commits

- `535a5ed` feat(weather): Phase B-2 Item 1 — `utcOffsetSeconds` fallback chain
- `c3e96dd` feat(weather): Phase B-2 Item 2 — broader multi-source consensus
- `61fb10e` feat(weather): Phase B-2 Item 3 — provider mapping completeness

Test count: **168 → 202** (+34 in `tests/weather-logic-phase-b2.test.js`: 7 Item 1, 7 Item 2, 20 Item 3).

SW cache: `pw-v2026-05-11-005` → `pw-v2026-05-11-008`.

---

## Item 1 — `utcOffsetSeconds` fallback chain

**Bug:** if Open-Meteo fails or returns no offset, `utcOffsetSeconds` silently defaulted to 0 (UTC). MET Norway hourly alignment + `isDay` derivation then broke for non-UTC users (SA shifted 2 hours, off-by-two on the entire local-hour mapping). This was a real production bug, surfaced while writing Phase B-1 Item 3 test fixtures.

**Fix:** four-step fallback chain with audit field:
1. Open-Meteo `utc_offset_seconds` (primary, unchanged)
2. Pirate Weather `offset` (hours × 3600)
3. WeatherAPI `location.tz_id` resolved via `Intl.DateTimeFormat` with `timeZoneName: 'longOffset'`
4. Default 0 (UTC) — last resort, debug-logged so it's not silent

`utcOffsetSource` audit field added to response meta. Values: `'open-meteo' | 'pirate-weather' | 'weatherapi' | 'default-utc'`. First non-default fill wins; later sources do NOT overwrite.

**Why option (b) chain over option (a) lat/lon-deterministic compute:** no new dependencies (option a needed a tz database like `tz-lookup`), `Intl.DateTimeFormat` handles DST automatically at request-handling time, we're already fetching all three providers so reusing their fields is cheaper than parallel computation.

**Helper added:** `computeTimezoneOffsetFromTzId(tzId)` near other helpers. Returns seconds, null on parse failure. Handles `"GMT"`, `"GMT+02:00"`, `"GMT-08:00"`, `"GMT+05:30"` (India). DST verified by test: America/Los_Angeles in January resolves to -28800 (PST).

---

## Item 2 — Broader multi-source consensus

**Pattern:** mirrors the existing FIX-001 (rain-possible / cloudy) and FIX-002 (fog) post-derive override pattern. After `deriveCondition`, if the key is one of {storm, wind, heat, cold} AND ≥3 sources are active AND <2 sources individually meet the per-condition predicate, demote to `'clear'` with an audit-trail entry.

**Predicates (now-path):**
- `storm`: `categorizeDesc(n.desc) === 'storm'`
- `wind`: `n.windKph >= 25` (lower threshold than derive's 30 so sources at the edge still count as supporting)
- `heat`: `n.nowTemp >= 30` OR `n.feelsLike >= 35`
- `cold`: `n.nowTemp <= 10` OR `n.feelsLike <= -5`

**Daily-path:** same pattern for storm/heat/cold. Wind omitted because per-source daily wind isn't directly available (daily wind is computed from the aggregated noon hour).

**Audit trail:** each consensus failure records `{ rule: '${key}-consensus-failed', from, to: 'clear', reasonDetail }` in `conditionSignals.overrides`. `conditionReason` becomes `'${key}-consensus-failed'`.

**Why `activeNorms.length >= 3` minimum:** matches the existing fog rule. With only 2 sources alive, consensus is too binary (both agree or one demotes) — the override only kicks in with enough data to be meaningful.

---

## Item 3 — Provider mapping completeness

**(A) Pirate Weather expanded-icon mode.** PW URL extended with `&icon=pirate` (superset request, default-safe). `pirateIconMap` gains 14 new entries: `mist`, `haze`, `smoke`, `mixed` (→ 'Sleet' → cold), `possible-rain-day/-night`, `possible-snow-day/-night`, `possible-sleet-day/-night`, `possible-thunderstorm-day/-night`, `breezy`, `drizzle`, `flurries`, and `none` → null.

**(B) MET Norway full symbol map.** Expanded from 20 → 45 entries per the official `api.met.no/weatherapi/weathericon/` spec. Added all missing sleet/snow/thunder permutations:
- Rain-shower-thunder variants: `rainshowersandthunder`, `lightrainshowersandthunder`, `heavyrainshowersandthunder`
- Sleet steady/showers/thunder permutations: 9 new entries
- Snow steady/showers/thunder permutations: 9 new entries
- Spec-spelling variant `lightssleetshowersandthunder` (double-s)

Day/night/polartwilight suffix stripping was already in place — verified by test that all three suffixes resolve to the same base description.

**(C) `categorizeDesc` bug fix.** Cold check moved ABOVE the rain check so "Snow showers" / "Sleet showers" route to `'cold'` (was `'rain'` because `'shower'` keyword matched first). `'ice'` keyword added to cold set so WA's ice-pellet codes route correctly. Phase A's sentinel test `expect(categorizeDesc('Hail')).toBe('cold')` still passes. `'haze'` and `'smoke'` added to the fog branch so low-visibility-but-still-light descriptions don't fall back to `'clear'`.

---

## Deviations from spec

1. **Option (b) over (a) for timezone fix.** Spec presented both options as candidates; picked the source fall-through chain because it has zero new dependencies and we're already fetching the data we need. (a) would have required adding `tz-lookup` or similar — bigger surface area for one fix.

2. **`pirateIconMap` includes a few PW synonyms beyond the explicit list** (`breezy`, `drizzle`, `flurries`). These are mentioned in PW's expanded-mode docs but weren't on the user's literal list of `mist/haze/smoke/mixed`. Adding them is defensive coverage — if PW returns them in `icon=pirate` mode, they now resolve correctly instead of falling through.

3. **`categorizeDesc` cold-check reorder and `'ice'` keyword addition.** This was a latent bug the Codex review actually flagged (WA ice pellets → `'rain'`) but not on the B-2 explicit list. Fixing it was necessary to make the new MET sleet/snow shower symbols categorise correctly — they were the test cases that exposed the latent bug. Phase A's sentinel test for `'Hail' → 'cold'` still passes, so the change is safe.

---

## Deferred (Phase B-3+ candidates)

- **WA rain-flag unreliability calibration.** DESC_WEIGHTS shift needs real fixture data showing how often WA's `chance_of_rain > 0` + code 1003 + 0mm is a false positive vs real signal. Not a code change — a data-collection task.
- **Triple-decision frontend architecture consolidation.** `computeSkyCondition` / `computeTodaysHero` / `computeHomeDisplayCondition` all re-rank conditions client-side. Refactor candidate (not a bug). Defer until visual-product or UX work touches these functions anyway.
- **Wider regional consensus tuning.** Phase B-2 Item 2 predicate thresholds (wind ≥25, heat ≥30, cold ≤10) are reasonable for SA. If the user base expands to colder or hotter regions, may need locale-aware bounds.

---

## Test count growth

| Phase | Tests | Delta |
|---|---|---|
| Pre-weather-work | 91 | — |
| Phase A | 133 | +28 |
| Phase B-1 | 168 | +35 |
| Phase B-2 | 202 | +34 |

Total weather-logic tests across phase-a + phase-b + phase-b2 files: **97**.
