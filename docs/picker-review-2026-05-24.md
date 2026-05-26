# Picker Adversarial Review Log — 2026-05-26

> Date in filename is per spec (`picker-review-2026-05-24.md`); review was actually performed 2026-05-26 in the same task block.

Reviewer: Codex (GPT-5-class) via `codex:codex-rescue` subagent.
Subject: `assets/image-picker.js`, `assets/app.js:setBackgroundFor`, `sw.js` image-cache branch, `tests/image-picker.test.js`.

Each round used the same adversarial prompt: brutal review, ten things before declaring clean, specific checks for timezone math, modulo on negative inputs, URL encoding for `cold-clear`, race conditions on preload, SW conflicts, CSS object-fit interactions.

---

## Round 1 — file-read sandboxing blocked review

Codex's sandbox couldn't spawn PowerShell or run Node REPL locally (`CreateProcessAsUserW failed: 1312`). It fell back to the GitHub connector but indexed `probably-weather-new-b` (the OLD repo); this work is in `probably-weather-new-c`. Both findings it returned were against stale code:

| # | Severity | Finding | Disposition |
|---|---------|---------|-------------|
| R1-1 | major | OG path still points at `day_1.jpg` | Acknowledged as known out-of-scope (separate task at promote-time) |
| R1-2 | major | SW CACHE_VERSION not bumped | False alarm — local sw.js had the bumped version; Codex saw the old repo |

**Verdict round 1**: BUGS REMAIN — but neither was a real finding against the actual work. Re-dispatched with files inlined verbatim.

---

## Round 2 — real findings (12 critical/major + 9 minor + coverage gaps)

### Applied (in-scope critical / major)

| # | Severity | Finding | Fix applied |
|---|----------|---------|-------------|
| R2-1 | critical | Stale `onerror` race — rapid `setBackgroundFor` calls could walk wrong chain | `__pickerToken` monotonic counter; every step checks `myToken === __pickerToken` before acting |
| R2-2 | critical | No `onload` cleanup — handler persists after success | `bgImg.onload` detaches both handlers on first successful load |
| R2-3 | major | Silent folder typo masking (`'cleer'` produces 404 chain with no signal) | Added `KNOWN_FOLDERS` allowlist + `console.warn` for unknown non-empty strings |
| R2-4 | major | Chain has duplicates when `r===1` (primary == week_1 fallback) | `Array.from(new Set(raw))` dedupe preserving order |
| R2-5 | major | Chain has duplicates when `folder === fallbackFolder` (step 2 == step 3) | Same dedupe |
| R2-6 | major | Worst-case chain has three identical paths (both above true) | Same dedupe — collapses to 2 entries (image + default) |
| R2-7 | major | No memoization causes background flicker across `renderSidebar` calls | `__pickerMemo` keyed by `folder\|time\|week`; same render-cycle reuses pick |
| R2-8 | major | SW caches `206 Partial Content` because `fresh.ok` is true for 200-299 | `fresh.status === 200` in image branch |
| R2-9 | major | `MAX_IMG_CACHE = 60` too small for 1,008-image rotation space | Bumped to 120 |
| R2-10 | minor | Tests only assert UTC side; would miss SAST shift if anchor edited | Added `Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', ... })` assertion |

### Deferred (out of scope per task spec — flagged in docs)

| # | Severity | Finding | Reason for deferral |
|---|----------|---------|---------------------|
| R2-D1 | major | `pickRandomIndex` assumes 7 files per slot; no manifest validation | Task spec guarantees `1,008 WebP images, 9 × 4 × 4 × 7` via staging pipeline — invariant is upstream |
| R2-D2 | major | Step-2 fallback assumes `week_1/<time>/1.webp` exists in every folder | Same staging guarantee |
| R2-D3 | major | Step-3 fallback assumes fallback-folder has every time bucket | Same staging guarantee |
| R2-D4 | major | No preload-and-decode before swap → flicker on slow nets | Bigger architectural change; M9 memoization covers the dominant flicker case (same-condition refresh) |
| R2-D5 | major | SW serves stale cached images after deploy (URL stays same, content changes) | Cache-version bump invalidates all old caches on activate. Hashed URLs would be cleaner but require build-tool change |
| R2-D6 | minor | Clock-skew pins skewed users to week 1 indefinitely | By spec: "Edge case: dates BEFORE launch return week 1 (graceful default)" |
| R2-D7 | minor | No repeat-avoidance in random picker | Out of spec; memoization already prevents same-render repeats |
| R2-D8 | minor | No CSS opacity transition for swaps | Out of spec; memoization removes most flicker |
| R2-D9 | minor | No `Vary: Accept` handling; query-string sensitivity in cache key | Not currently triggered — URLs are static paths with no content negotiation or query params |

**Verdict round 2**: BUGS REMAIN — 10 critical/major in-scope items applied.

**Tests after round-2 patches**: 4,410 / 4,410 passing (was 4,404 + 6 new cases).

---

## Round 3 — zero critical, zero major — termination condition met

Round-2 patch verification by Codex:
- ✅ C1 race guard verified — step/onload/onerror all gate on `myToken !== __pickerToken`.
- ✅ C2 onload cleanup verified — onload is stale-guarded before clearing both handlers.
- ✅ M3/M4/M5 dedupe verified — `Array.from(new Set(raw))` preserves insertion order.
- ✅ M12 `fresh.status === 200` verified — 304s bypassed correctly.
- ✅ M13 MAX_IMG_CACHE 120 verified.

**Verdict round 3: BUGS REMAIN — but only minors. No critical or major issues found in the patched code.**

Per spec, the loop terminates at zero critical/zero major. Three minors flagged + applied:

| # | Severity | Finding | Fix applied |
|---|----------|---------|-------------|
| R3-1 | minor | `warnUnknownFolder` spams 2-3x per refresh for the same bad folder | Module-level `__warnedFolders` Set; warn-once per folder per session. Exposed `_resetWarnedFolders()` test helper. |
| R3-2 | minor | Single-slot memo allows churn on condition oscillation A→B→A | Replaced single-slot with `Map` capped at 16 entries with LRU-ish eviction (delete first key on overflow — Map preserves insertion order) |
| R3-3 | minor | SAST `Intl` test brittle on small-ICU Node builds | Added ICU-independent UTC-arithmetic sibling test (`sastMidnight.getUTCDay() === 6`); kept Intl test for intent-revealing power. Either alone catches anchor regressions. |

**Tests after round-3 patches**: 4,411 / 4,411 passing.

---

## Final test pass count

```
Test Files  116 passed (116)
      Tests  4411 passed (4411)
```

Baseline before this task: 4,404. New cases added across rounds: 7
(initial picker module + 6 cases for round-2 fixes + 1 case for round-3 warn-once semantics; one Intl test split into two so net +1).

---

## Summary of fix shape (for promote-time review)

The picker is now defensive at four layers:

1. **Input validation** (`buildPickerPaths` clamps + `warnUnknownFolder` surfaces typos once per session).
2. **Chain dedupe** (no redundant 404 fetches when collapse cases hit).
3. **Race-safe DOM wiring** (token-based stale-call guard + onload cleanup).
4. **Memoization** (`Map`-based cache keyed by condition/time/week; A→B→A reuses A's pick).

SW changes are minimal and surgical: `status === 200` for caching, cap raised 60→120, version bumped.

CSS required no change — `object-fit: cover` was already present.

---

## Summary of fix shape (for promote-time review)

The picker is now defensive at four layers:

1. **Input validation** (`buildPickerPaths` clamps + `warnUnknownFolder` surfaces typos).
2. **Chain dedupe** (no redundant 404 fetches when collapse cases hit).
3. **Race-safe DOM wiring** (token-based stale-call guard + onload cleanup).
4. **Memoization** (same condition/time/week reuses the pick, killing flicker).

SW changes are minimal and surgical: `status === 200` for caching, cap raised, version bumped.

CSS required no change — `object-fit: cover` was already present.
