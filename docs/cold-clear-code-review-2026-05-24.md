# Cold-Clear Code Review Log — 2026-05-26

Reviewer: Codex (GPT-5-class) via `codex:codex-rescue` subagent.

Subject: `api/weather.js:deriveCondition` (new cold-clear branch), `conditionKeyToVoteBucket`, daily/now callsites, `assets/weather-emoji.js`, `assets/app.js` display + badge, `middleware.js`, `tools/build-og-images.mjs`.

---

## Round 1 — 22 findings

Codex inlined the full set of changed code blocks and ran a brutal adversarial review.

### Critical / Major fixes applied

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Major | `cold-clear` could steal `snow` / `sleet` / `ice` / `hail` / `freezing` descs from the winter-precip branch | Added `!isPrecipOrFogDesc` exclusion gate |
| 2 | Major | `cold-clear` could steal `rain` / `drizzle` / `shower` descs when rainChance is missing or low | Same `!isPrecipOrFogDesc` gate + tightened `isDryDay` |
| 3 | Major | `cold-clear` could steal `fog` / `mist` / `haze` descs | Same exclusion gate |
| 4 | Major | High-UV days could be misclassified as cold-clear | Auto-resolved by the dailyHighC≤18 gate (warm-by-afternoon days fall through to UV) |
| 6 | Major | Daily callsite didn't pass dailyHighC, breaking the UV-priority interaction | Daily callsite now passes `dailyHighC: highC` |
| 7 | Major | Missing rainChance was treated as dry without verification | `isDryDay` falls back to desc check when rainChance is undefined |
| 19 | Major | Test coverage missed branch-steal regressions | Added 13 new defensive tests (snow-desc, rain-desc, fog-desc, drizzle, UV priority, daily variants, desc fallback) |
| 20 | Major | No tests for daily-callsite semantics | Added 3 daily-specific tests (highC=11/18/22 × lowC variants) |
| 21 | Major | Missing cloudPct silently disabled cold-clear emission | `hasClearSkySignal` accepts desc-based fallback (`clear`/`sunny`/`fair` keywords) |

### Deferred (out of scope per task spec or by-spec decision)

| # | Severity | Finding | Reason for deferral |
|---|----------|---------|---------------------|
| 5 | Major | Daily callsite tempC=highC steals cold-clear at highC=12 | Semantically correct — a daily high of 12°C with clear sky IS cold-clear territory |
| 8 | Minor | cloudPct<30 strict cutoff has no tolerance | Intentional; documented in tests |
| 9 | Major | cold-clear→cold vote bucket erases clear consensus | Per task spec: "Update conditionKeyToVoteBucket() to route 'cold-clear' to the 'cold' vote bucket" |
| 10 | Major | partly-cloudy → clear bucket (unchanged) | Pre-existing behavior, not in scope |
| 11 | Minor | Single 🥶 day/night emoji loses "blue-sky" signal | Per task spec: "Verify glyph compositions don't break on iOS Safari" — single glyph chosen to avoid composite-rendering issues |
| 12 | Minor | No dev-time warning for misspelled condition keys | Defer — picker already has KNOWN_FOLDERS warn |
| 13 | Major (suspected) | Translation coverage gaps in other copy groups | Verified — only heroLabels/headlines/witty index by condition key; other groups don't |
| 14 | Minor | Badge shares cold-clear with cold | Per task spec: badge label is shared by design |
| 15 | Major (suspected) | OG path scheme mismatch | Verified — matches picker week_1/day/1.webp scheme exactly |
| 16 | Minor (suspected) | Missing cold-clear asset has no alias fallback | Picker has 4-step fallback chain (week_1 → sibling → default.jpg) |
| 17 | Minor | middleware allowlist missing partly-cloudy | Pre-existing inconsistency, not in scope |
| 18 | Minor | heat vs hot naming inconsistency | Pre-existing inconsistency, separate task |
| 22 | Major | cold-clear not handled in createParticles | Intentional no-particle case (dry-cold-clear-sky, not snow) |

**Verdict round 1**: BUGS REMAIN — 9 in-scope critical/major applied.

---

## Round 2 — CLEAN

Patched algorithm and full test suite (4,485 passing) re-submitted.

**Verdict round 2**: **CLEAN** — no remaining critical or major bugs.

---

## Summary of fix shape

The cold-clear branch is now defensive at 5 layers:

1. **Position** — between storm-desc and extreme-cold-feels-like (line ~1876).
2. **Desc exclusion** — explicit allowlist-of-clear-sky-keywords / blocklist-of-precip-fog-storm-keywords.
3. **Cloud signal** — `cloudPct < 30` OR (missing cloudPct + clear/sunny/fair desc).
4. **Temp signal** — at least one of: feelsLikeC≤12, dailyLowC≤6, tempC≤12.
5. **Daily ceiling** — dailyHighC≤18 when present (warmer days fall through to UV/clear).

Daily-callsite parity restored by passing `dailyHighC: highC` alongside the existing `dailyLowC: lowC`.

Test coverage:
- 49 cold-clear-specific cases in `tests/cold-clear.test.js`
- 0 regressions in any pre-existing test (4,485 total)
