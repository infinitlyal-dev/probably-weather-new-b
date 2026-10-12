# Sol (gpt-5.6-sol) on the coast switch, 12 Oct 2026

## Round 1 — HOLD
1. **High — live “switch” scoring does not replay the real ladder.**  
   `review/accuracy/live/rain-now-switch-lib.mjs:20-31` (`switch.patch:212-223`) defines `switch` as `today || coast && desc(...)`. A storm or another higher-priority condition can satisfy the descriptive-rain predicate while the real ladder correctly keeps that higher condition. The scorer would count a rain call that would never be served, corrupting accuracy, catch-rate, and `servedMatchesSwitch`.  
   **Fix:** run the recorded selector inputs through the shared selection pipeline twice—old inputs for `today`, region-gated inputs for `switch`—and add a higher-priority storm/fog case.

2. **Medium — the 12,740-hour proof can pass without proving that corpus.**  
   `review/accuracy/rain-now-switch-proof.mjs:12-40` (`switch.patch:304-332`) compares every column of the supplied aligned rows, which is useful, but it accepts empty/truncated files, the same file twice, missing required columns (`indexOf` becomes `-1`), incomplete station coverage, and unverified main/branch provenance. All can exit successfully with “INLAND: identical.”  
   **Fix:** require the expected row/key count and station coverage, validate required columns and unique `icao+time` keys, reject identical inputs, and embed/assert source commit IDs in each export.

3. **Low — the live cutoff is a lexical timestamp comparison.**  
   `review/accuracy/live/rain-now-switch-lib.mjs:35-40` (`switch.patch:227-233`) uses `r.runAtUtc < sinceUtc`. It works only while every timestamp has the same canonical UTC representation. Offsets, missing `Z`, or different fractional precision can classify records incorrectly; malformed/missing values can slip through.  
   **Fix:** validate `Date.parse()` results and compare epoch milliseconds. Use the actual activation time if “since ruling” is intended to represent live served behaviour.

4. **Test gap — boundaries, cache replay, and Strand record shape remain unproved.**  
   `tests/rain-now-descriptive.test.js:255-276` tests string coordinates at the 20 station centres, not points immediately across the FACT/FALW, FAGG/FAPE, or FALE/KZN-inland boundaries, outside-SA coordinates, or an older cached payload through the handler’s real re-check path. Also, `rain-now-descriptive.mjs:169-170` recognizes `city` or `spot`, while `rainNowRead()` requires top-level `lat/lon`; there is no Strand recorder fixture proving that shape.  
   **Fix:** add paired boundary/outside cases, an end-to-end old-cache fixture, and real airport/Strand recorder fixtures.

The production gate itself is fail-closed: only exact membership in the three named regions produces `true`, `deriveCondition` requires literal `=== true`, and absent cached flags retain the old ladder. No off-list-region route to the rung or its 70% lift is visible in this patch. One semantic caveat: these are nearest-station cells, not literal coastline geometry, so physically inland places inside a named coastal cell are intentionally enabled under the stated region ruling.

**HOLD**
## Round 2 — HOLD
1. **High — the proof can still pass without the full corpus.**  
   `rain-now-switch-proof.mjs:29-35` checks equal row counts, unique keys, and that every airport appears, but never requires the expected total or complete time coverage. Two equally truncated files containing one row per airport can pass. It also accepts any coast-only difference; it does not require a transition specifically to `rain/rain-now-descriptive`, so swapped or unrelated dumps can satisfy the gate. Main/branch commit provenance remains unverified.

2. **Low — an empty `sinceUtc` bypasses validation.**  
   `rain-now-switch-lib.mjs:37-39` correctly compares parsed epochs and rejects non-empty invalid timestamps, but `''`—including a missing value after `--since`—becomes “no filter” instead of throwing.

The other fixes are present in the diff:

- Recorded selector inputs are replayed through `deriveCondition`; the new evidence fields and region gate are supplied.
- The scorer requires the ladder to land on `rain-now-descriptive` and excludes served storm/thunder/hail overrides.
- Higher-rung and storm-served tests are included.
- The listed CSV shape, airport, duplicate-key, and coast-change refusals are implemented.
- Boundary/outside-SA handler coverage, legacy-cache stripping, and airport/Strand recorder-shaped fixtures are included.

The reported 21,582 tests and build were not rerun, per the read-only instruction.

HOLD
## Round 3 — SHIP
Yes. The 12,740-row requirement, unique/aligned hour keys, airport coverage, file-order checks, and mandatory `rain`/`rain-now-descriptive` result for every coastal difference close the first finding. The reported swapped and truncated refusals exercise the former failure paths.

The `sinceUtc` change and empty-string regression test close the second finding. I found no new blocker in these files; this verdict relies on the author’s reported executions, as requested. **SHIP**