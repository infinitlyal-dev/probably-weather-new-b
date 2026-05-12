# SA5 — Language QC Notes

**Branch:** `feat/pre-tester-5-lang`
**Date:** 2026-05-12
**Owner:** SA5 (i18n / language-QC subagent of the pre-tester Phase 1 dispatch)

## What this PR does

1. Adds 4 conservative language-QC skills.
2. Runs each skill against its language column of `T` (`assets/app.js`) plus `INSTALL_T`, `PTR_COPY`, and `WEATHER_COPY`.
3. Triages every flagged cross-language duplicate per `I18N_CROSS_LANGUAGE_AUDIT.md`.
4. Adds a regression-guard test suite at `tests/i18n-no-cross-language-duplicates.test.js`.
5. Bumps the service-worker cache version.

## Skills shipped

- `.claude/skills/af-qc/SKILL.md` — Afrikaans QC, refs Pharos + AWS 2017.
- `.claude/skills/zu-qc/SKILL.md` — isiZulu QC, refs SADiLaR + NWU CTexT.
- `.claude/skills/xh-qc/SKILL.md` — isiXhosa QC, refs SADiLaR + NWU CTexT.
- `.claude/skills/st-qc/SKILL.md` — Sesotho QC, refs SADiLaR + NWU CTexT.

Each defines a `check(string, key, context) -> { confidence, flags, suggestions }` procedure and codifies the conservative protocol: **low confidence = defer to human, never auto-apply**.

## Audit walkthrough

Ran each skill against its column. Result counts per language:

| Lang | Flagged in audit | High-confidence fixes applied | Borderline (deferred to triage) |
|---|---|---|---|
| AF | 0 (1 intra-language note) | 0 | 1 (`weather.probably` = `weather.likely`, intentional merge) |
| ZU | 34 | **0** | 34 (1 canonical suspect + 33 Nguni cognates) |
| XH | 33 | **0** | 33 (all Nguni cognates with ZU) |
| ST | 0 (1 intra-language note) | 0 | 1 (`weather.possible` = `weather.likely`, intentional merge) |

### Why zero auto-applies

The conservative protocol of every skill ("bet money on every fix"). Reviewing each candidate:

- **33 of 34 Zulu flags are legitimate Nguni cognates with Xhosa** (`umoya`, `imvula`, `usuku`, `ikhaya`, `phezulu`, etc.). These are correct, not bugs. They go to triage for native confirmation rather than alteration.
- **1 Zulu canonical suspect** — `days.sun.zu = "Son"` matches `days.sun.af = "Son"`. Zulu Sunday is **iSonto**; the value is almost certainly an Afrikaans copy-paste. **However**, the correct 3-letter abbreviation form (`Snt`? `Sont`?) is a UX/style decision (other zu day abbrevs are consonant-clusters: `Mso`, `Bil`, `Tha`, `Sin`, `Hla`, `Mgq`). Confidence-in-fix < 0.85 → deferred to native speaker.
- **33 Xhosa flags** all mirror Zulu cognates → deferred.
- **Sesotho** had zero cross-language duplicates in the audit. Two intra-language merges flagged for confirmation.
- **Afrikaans** had no outstanding issues (canonical day-abbrev bug already fixed in `0519c3f`).

Net: every flag goes to `TRIAGE_NATIVE_REVIEW.md` with current value + proposed action + why borderline.

## Tests delta

`tests/i18n-no-cross-language-duplicates.test.js` adds **12 new tests** (baseline 320 -> total 332):

1. Extracts >= 50 five-language leaves from the four source files.
2. No leaf has the same value across all 5 languages (outside allowlist).
3. No leaf has the same value across >= 4 languages (outside allowlist).
4-7. No language slot is empty when EN is non-empty (per af / zu / xh / st).
8. **AF and ZU never share a string >3 chars outside allowlist** (catches the `days.sun` class).
9. ZU and ST never share a string outside allowlist (no shared family).
10. XH and ST never share a string outside allowlist.
11. Allowlist stays bounded (<= 45 entries) — guard against creeping growth.
12. Canonical tracker — `days.sun.zu` state is pinned so the native-speaker fix swap is visible.

All pass. Full suite: **332 / 332 passing**, zero regressions.

## SW bump

`sw.js:6` `CACHE_VERSION` `pw-v2026-05-11-013` -> `pw-v2026-05-12-005`. Existing `tests/sw-update-propagation.test.js` is format-pinned (date pattern), not version-pinned, so no test change needed.

## Native-speaker follow-ups

See `TRIAGE_NATIVE_REVIEW.md` for the full list. Recommended review order:

1. **Zulu speaker first** — confirms `days.sun.zu` canonical fix and ticks 33 Nguni cognates. ~15 min.
2. **Xhosa speaker** — mirrors the Zulu pass.
3. **Afrikaans speaker** — confirms the `weather.probably` / `weather.likely` merge.
4. **Sesotho speaker** — full column naturalness pass (no duplicates flagged; long phrases still need review).

After native review, a follow-up PR can:
- Apply the confirmed `days.sun.zu` fix.
- Prune the test allowlist where natives reject a Nguni cognate as wrong.
- Delete the stale `T.settings.wittyIn` key (per audit structural note 1) if confirmed unused.

## Blockers / open items

- None for this PR. Conservative-by-default by design: deferral is the correct action when "bet money on every fix" can't be met without a native speaker.

## Files touched

- `+ .claude/skills/af-qc/SKILL.md`
- `+ .claude/skills/zu-qc/SKILL.md`
- `+ .claude/skills/xh-qc/SKILL.md`
- `+ .claude/skills/st-qc/SKILL.md`
- `+ TRIAGE_NATIVE_REVIEW.md`
- `+ LANG_QC_NOTES.md`
- `+ tests/i18n-no-cross-language-duplicates.test.js`
- `M sw.js` (cache version bump)
