# Phase 3 — Language QC audit report

**Date:** 2026-05-12
**Branch:** main, HEAD `6614e1b`
**SW slot:** `pw-v2026-05-12-008` (unchanged — no runtime code modified by this audit)
**Test suite:** 1020/1020 passing (unchanged)
**Method:** Single-agent run using the 4 SA5-built QC skills (`af-qc`, `zu-qc`, `xh-qc`, `st-qc`) plus direct Claude review for English.

---

## Summary statistics

| Language | Strings audited | Auto-applied | HIGH (new) | MEDIUM (new) | LOW (new) |
|---|---|---|---|---|---|
| English (en) | ~110 | 0 | 0 | 0 | 0 |
| Afrikaans (af) | ~110 | 0 | 1 | 1 | 4 |
| isiZulu (zu) | ~110 | 0 | 2 | 0 | 0 |
| isiXhosa (xh) | ~110 | 0 | 0 | 3 | 0 |
| Sesotho (st) | ~110 | 0 | 1 | 1 | 2 |
| **Total** | **~550** | **0** | **4** | **5** | **6** |

**Zero auto-applies.** Conservative-by-default protocol held — every flagged candidate fell below the auto-apply threshold (AF ≥0.9, Nguni/Sotho ≥0.95, EN typo-only) and was deferred to native-speaker review.

This is consistent with SA5's outcome (also zero auto-applies). The pattern reinforces a real finding: the PW corpus has already been through a sanity pass; the remaining issues are not dictionary-mismatch typos but semantic, register, or stylistic questions that need a native speaker.

---

## Top HIGH-priority findings per language

### English (en)

**Zero issues found.** EN corpus is clean. Capitalisation, punctuation, register, and tone all consistent across all UI labels and toasts. The witty/cultural copy was not word-by-word audited (brand-voice protected) but spot-checks found no broken items.

### Afrikaans (af)

**1 HIGH-priority item:**

1. **`search.clearRecents.af = "Verwyder onlangs"`** — translates "Clear recents" word-by-word as "Remove recently" (adverb), not "Remove recent items" (noun-phrase). Reads as instruction about timing, not about objects. Suggested fix: `"Maak onlangse skoon"` or `"Verwyder onlangse soektogte"`. Confidence 0.85 it's wrong, 0.75 in proposed fix.

### isiZulu (zu)

**2 HIGH-priority items:**

1. **`badges.rainTonight.zu = "Imvula namhlanje"`** — "namhlanje" means "today", not "tonight". Compare to `xh.rainTonight = "Imvula ngokuhlwa"` (correctly "tonight"). Likely fix: `"Imvula ebusuku"`. Confidence 0.85 it's wrong, 0.7 in fix.
2. **`weather.gusts.zu = "amafindo"`** — "amafindo" is plural of "ifindo" = "knots" or "nodes". Wrong noun for wind-gusts. Standard Zulu closer to `"isivunguvungu somoya"` or `"izigqumo zomoya"`. Confidence 0.7 it's wrong, 0.4 in fix. Native confirmation essential.

### isiXhosa (xh)

**0 HIGH-priority items**, **3 MEDIUM**:

1. `weather.gusts.xh = "iimphuphuma"` — "outburst/overflow" plural, not "gusts". Mirrors the zu concern.
2. `heroLabels.partly-cloudy.xh = "Kufukufuku kancinci"` — "kufukufuku" generally means "lukewarm/mild warmth". Possible regional usage; semantically mismatches "Partly cloudy".
3. `badges.rainMorning.xh = "Imvula kusasa"` — "kusasa" ambiguous (in the morning today vs tomorrow). Could read as "rain tomorrow".

### Sesotho (st)

**1 HIGH-priority item** — the standout bug of the audit:

1. **`weather.gusts.st = "lifofane"`** — **semantic disaster.** "lifofane" is the plural of "sefofane" meaning **"airplanes"**. The byline currently reads to a Sesotho user as `"Moea 25 km/h (airplanes 40 km/h)"`. Likely fix uses a phrase like `"ho thunya ha moea"` or `"ho foka ka matla"` — there may not be a single concise noun. Confidence 0.95 it's wrong, 0.55 in fix. **The most visible item in the audit.** UX impact bounded: only displays when wind+gust > 1.3x, which is uncommon outside Cape Doctor days.

Plus 1 MEDIUM:

2. `misc.shareMessage.st` — missing locative preposition before `{city}`. Compare `zu/xh: "e-{city}"`. Native suggestion needed.

---

## Recommendation for Al's personal review

Send to native speakers in this priority order:

| Rank | Item | Why it matters | Native check time |
|---|---|---|---|
| 1 | `weather.gusts.st` (HIGH-ST-1) | "Airplanes" instead of "gusts" is a screenshot-worthy bug. First impression. | 2 min |
| 2 | `badges.rainTonight.zu` (HIGH-ZU-1) | Wrong day-period word; visible on rainy-evening days. | 30 sec |
| 3 | `weather.gusts.zu` (HIGH-ZU-2) | Same pattern as ST-1; Cape Doctor surfaces it. | 2 min |
| 4 | `search.clearRecents.af` (HIGH-AF-1) | Reads odd in AF UI flow. | 1 min |
| 5 | `misc.shareMessage.af` (MED-AF-M1) | `"Check"` loanword — confirm intent (brand voice vs translation gap). | 30 sec |

Total: about 6 minutes if Al has access to one speaker per language (or one polyglot SA contact). The 4 HIGH items would normally be the rollout blocker conversation; given PW's "send to friends" tester rollout context where any single tester only sees their chosen language, the actual exposure is limited per-link.

If a Sesotho speaker is not available before tester rollout: **avoid sending PW tester links to Sesotho-first contacts until HIGH-ST-1 is fixed.** Or send with a note: "Heads up: the Sesotho translation for wind gusts is wrong — we're fixing it. The rest is correct."

For all other languages, ship as-is and gather feedback. The MEDIUMs and LOWs are not first-impression breakers.

---

## What this audit didn't cover

- **`WEATHER_COPY.witty` arrays** — protected per cultural-voice rule. ~2,600 lines of intentional SA-flavoured humour. Spot-checked for cross-language paste errors only (none found).
- **Inline hardcoded English in HTML** — overridden by `updateUILanguage()` at runtime; acceptable per design.
- **Brand tagline "No more Ja-No-Maybe weather. Just Probably."** — intentional English-only positioning per `DESIGN.md`.

---

## Files changed in Phase 3

- `TRIAGE_NATIVE_REVIEW.md` — Phase 3 findings appended below the existing SA5 entries.
- `LANGUAGE_AUDIT_PHASE3_REPORT.md` — this file (new).

**No source code modified.** No SW slot bump. No tests changed. Test suite stays at 1020/1020.

---

## Final pre-tester decision for Al

The audit found **one truly embarrassing bug** (Sesotho gusts = airplanes), **three real but bounded bugs** (Zulu rainTonight, Zulu gusts, Afrikaans clearRecents), and a handful of stylistic deferred items. **None of these block tester rollout** if Al is comfortable accepting per-language risk that early Sesotho/Zulu testers may surface the gust issues themselves.

If Al wants zero embarrassment before testers: fix HIGH-ST-1 by hand with help from any Sesotho-speaking contact (one short text message), then ship. Total elapsed: maybe an hour including the message round-trip.

Otherwise: green light to send tester links. The audit is complete. PW's user-facing copy is in a strong state — the SA5 SADiLaR pass, Phase 1 i18n cleanup, and Phase 3 dictionary review have collectively raised the floor materially above where it started.
