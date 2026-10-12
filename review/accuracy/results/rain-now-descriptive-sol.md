# Sol (gpt-5.6-sol) on the rain-now-descriptive diff, 12 Oct 2026

## Round 1 — HOLD
- **P1 — `api/weather.js:131-133`: source/family evidence fails open.** Votes are not deduplicated, and `null`, renamed, or unknown sources become families. Two Open-Meteo entries plus one null rain entry produce 3 votes/2 families and falsely trigger “Rain’s here.” **Fix:** count unique, recognised source names only; unknown sources must contribute neither a vote nor a family.

- **P1 — `review/accuracy/v3/rainnow-descriptive.mjs:52-68`: the archive replay invents independent evidence.** In assignment B, one rainy `best_match` forecast is copied into Open-Meteo, MET Norway, and Tomorrow.io, then counted as three votes across three families. Its strict baseline also deduplicates by model family, whereas production’s strict route counts source votes. **Fix:** use real per-provider descriptions, or deduplicate by stand-in model ID and clearly treat the result as a proxy rather than production accuracy evidence.

- **P2 — `review/accuracy/lib/replay.mjs:259-263`: replay parity omits the 70% bump.** A candidate at 46.5% becomes 70% in the handler but remains 46.5% in replay output; downstream stats/copy evaluation therefore measures a payload production never emits. **Fix:** feed `Math.max(rainPct ?? 0, 70)` into the replay norm when the reason is `rain-now-descriptive`.

- **P2 — `review/accuracy/live/rain-now-descriptive.mjs:35-38`: “today” is contaminated by candidate-enabled recordings.** Any later recording already carrying `rain-now-descriptive` has `conditionKey === 'rain'`, so it is counted in both the baseline and candidate, hiding the candidate’s added calls. **Fix:** reconstruct the pre-candidate decision from stored signals, or explicitly exclude the new reason from the baseline.

- **P3 — `tests/rain-now-descriptive.test.js:84-90`, `tests/hero-stats-consistency.test.js:71-73`: critical wiring is tested as source text, not behaviour.** The consistency fixture floors candidate rain at 60%, not the required 70%, and nothing executes cache acceptance or candidate-plus-radar/next-hour/thunder ordering. A later override could undo the bump while every added test still passes. **Fix:** add handler-level payload/cache tests asserting final key, reason, and `rainChance >= 70` for fresh, legacy-cache, radar, next-hour, and thunder cases.

For recognised, unique providers, I found no false-path ladder change: missing `rainFamilies` fails closed and the existing routes retain their order.

**HOLD**
## Round 2 (after fixes 1–5) — HOLD
Fixes 1–4 are correct and complete. Fix 5 remains incomplete.

- **P3 — `tests/rain-now-descriptive.test.js:168-204`: two required interaction paths remain untested.** The handler tests cover fresh, false-path, radar, and thunder, but never trigger the next-hour override or an actual legacy-cache hit. A later override could still replace/demote `rain-now-descriptive`, or old cached selector inputs could be mishandled, while all current tests pass. **Fix:** add handler-level tests that force candidate-plus-next-hour precedence and replay a legacy cached payload without `rainSources`/`rainFamilies`, asserting fail-closed behaviour and the final reason/chance.

No new production defect is evident in the fixes themselves, but the original critical wiring finding is not fully closed.

**HOLD**
## Round 3 (next-hour + cache-hit tests added) — SHIP
Yes. The new handler-level tests directly cover next-hour radar precedence and both current and legacy cache-hit paths, including final reason/chance and no provider call. The legacy case is synthesized rather than loaded from a historical fixture, but it accurately strips the new fields and proves fail-closed behavior.

I see no material flaw in these tests; they close the sole P3 finding.

SHIP