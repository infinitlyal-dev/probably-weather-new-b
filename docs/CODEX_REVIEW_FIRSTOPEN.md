# Codex adversarial review — first-open location race

**Date:** 2026-05-30
**Under review:** `assets/first-open-location.js` (new coordinator) + the cold-open
branch wiring in `assets/app.js`. Uncommitted change that kills the ~8s blank
"Locating…" wait on a fresh install with no saved location.

**Reviewer:** Codex (via codex-rescue). First run stalled on Windows-sandbox
friction (declined `rg`/`Select-String`, looped on `findstr`); killed and re-run
with a constrained read surface + inline code for the regions its output
truncated before reaching.

## Race mechanism

Ownership is tracked by **reference-equality**: the coordinator stores
`lastRendered` (the place object it last painted, starting `null`) and only
paints/upgrades while `getActivePlace() === lastRendered`. In `app.js`,
`loadAndRender(place)` reassigns module-level `activePlace = place`, so any manual
search swaps the reference and the late-GPS guard fails closed. This mirrors the
existing `attemptRefresh` snapshot guard (`activePlace === placeAtRequestTime`).

## Verdict — 7 hammer items

| # | Attack | Verdict | Mechanism |
|---|--------|---------|-----------|
| 1 | Late-GPS clobbers a manual search made after the IP paint | **SAFE** | GPS paints only inside `if (isOurs()) render(place)`; a manual search changed `activePlace`, so a late GPS persists home but cannot repaint the pick. |
| 2 | Slow IP `.then` downgrades a GPS fix that already painted | **SAFE** | GPS sets `gpsDone = true` **synchronously** before any await; IP checks `if (gpsDone) return` after `await fetchIpPlace()` and before render. |
| 3 | Upgrade's `loadAndRender` aborts a fetch the USER just started | **SAFE** | `loadAndRender` bumps `activeLocationSeq` + aborts its controller, but the upgrade reaches it only after `isOurs()` passes. A user search reassigns `activePlace`, so the upgrade fails `isOurs()` and never enters `render()` — the user's fetch is untouched. |
| 4 | Pick during "Locating…" before any paint | **SAFE** | `lastRendered` starts as `getActivePlace()` (`null`); both IP and GPS require `isOurs()`. A pre-paint pick makes `getActivePlace() !== null` → both later paints suppressed. |
| 5 | Grace-timer path AND GPS-error path both start IP | **SAFE** | `startIp()` guards `if (ipStarted || gpsDone) return` and sets `ipStarted` before fetch; grace exits on `gpsFailed`; GPS error starts IP only if `!ipStarted`. |
| 6 | Infinite spinner — neither source ever paints | **SAFE** | `getIPLocation()` try/catches and returns a Johannesburg fallback after the catch (no later `throw`), so `fetchIpPlace` always resolves to a concrete place. |
| 7 | Dropped `STORAGE.location` write breaks a reader | **SAFE** | Reader (a) `else if (savedLoc…)` checks `homePlace` first, and the cold-open path writes `STORAGE.home` via `persistHome`, so the branch is unreachable next open. Reader (b) `getCurrentLocation` error handler is optional-chained and falls through to `loadApproximateLocation()` when `STORAGE.location` is missing. No crash, no wrong render. |

## FINAL VERDICT: SHIP

Zero BROKEN findings. The dropped `STORAGE.location` city/admin write on the
cold-open GPS path is a deliberate, non-breaking trade-off (`homePlace` is the
primary and is fully populated; the secondary cache is only read when `homePlace`
is absent, which never happens after a successful cold-open).
