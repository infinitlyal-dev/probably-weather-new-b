# Afrikaans day-of-week abbreviations fix

**Date:** 2026-05-11 (evening)
**Commit:** [`0519c3f`](https://github.com/infinitlyal-dev/probably-weather-new-b/commit/0519c3f) — `fix(i18n): Afrikaans day-of-week abbreviations`
**Branch:** `main`, SW `pw-v2026-05-11-011`, 294/294 tests

---

## The bug

Afrikaans tester flagged the day-of-week abbreviations on the Week tab as wrong. The previous values in `T.days` (`assets/app.js`) were truncations that don't match standard Afrikaans usage:
- Maandag → was `"Maa"`, should be `"Ma"`
- Dinsdag → was `"Din"`, should be `"Dins"`
- Woensdag → was `"Woe"`, should be `"Wo"`

The other four already matched: Don (Donderdag), Vry (Vrydag), Sat (Saterdag), Son (Sondag).

## Single source of truth

Day abbreviations live in one place: the `T.days` block in `assets/app.js` (around line 225). The only consumer is `getTranslatedDayName(dayIndex)` (line 745), called from two places:
- `renderWeek` (Week tab daily list)
- `renderDayDetail` (header of the day-detail screen)

One edit fixes both. No fan-out to chase.

## What changed

```diff
days: {
-  sun: { en: "Sun", af: "Son", zu: "Son", xh: "Caw",   st: "Sont" },
-  mon: { en: "Mon", af: "Maa", zu: "Mso", xh: "Mvu",   st: "Mant" },
-  tue: { en: "Tue", af: "Din", zu: "Bil", xh: "Lwes",  st: "Lab" },
-  wed: { en: "Wed", af: "Woe", zu: "Tha", xh: "Tha",   st: "Lar" },
-  thu: { en: "Thu", af: "Don", zu: "Sin", xh: "Sin",   st: "Labo" },
-  fri: { en: "Fri", af: "Vry", zu: "Hla", xh: "Hlanu", st: "Laboh" },
-  sat: { en: "Sat", af: "Sat", zu: "Mgq", xh: "Mgqi",  st: "Moq" }
+  sun: { en: "Sun", af: "Son",  zu: "Son", xh: "Caw",   st: "Sont" },
+  mon: { en: "Mon", af: "Ma",   zu: "Mso", xh: "Mvu",   st: "Mant" },
+  tue: { en: "Tue", af: "Dins", zu: "Bil", xh: "Lwes",  st: "Lab" },
+  wed: { en: "Wed", af: "Wo",   zu: "Tha", xh: "Tha",   st: "Lar" },
+  thu: { en: "Thu", af: "Don",  zu: "Sin", xh: "Sin",   st: "Labo" },
+  fri: { en: "Fri", af: "Vry",  zu: "Hla", xh: "Hlanu", st: "Laboh" },
+  sat: { en: "Sat", af: "Sat",  zu: "Mgq", xh: "Mgqi",  st: "Moq" }
},
```

Three values changed (mon / tue / wed). EN / ZU / XH / ST untouched per the spec's scope guard.

## Layout verification

Concern: "Dins" is 4 chars vs the previous max of 3. Could a wider abbreviation wrap?

`.daily-row` uses `grid-template-columns: 1fr 40px 55px 55px 50px` (`assets/app.css:698`). The first column (`.d-day`) is `1fr` — flexible, takes whatever space the four fixed columns leave. At 375px mobile viewport, that's ~123px per the live measurement. "Dins" needs ~30px. No wrap risk.

**Preview-verified in 375×812 mobile:**
- All 7 Afrikaans abbreviations render with `renderedWidth: 123`, `scrollWidth === clientWidth` (no overflow), `wrapped: false`
- `rowHeight: 46px` consistent across all 7 (no row-tall regression from wrapping)

## Tests

37 new tests in `tests/af-day-abbreviations.test.js`:
- 7 per-day assertions that AF matches the spec exactly (one test per day so failures point at the specific wrong abbreviation)
- 28 non-AF regression guards (en/zu/xh/st × 7 days) so this fix doesn't accidentally edit other languages
- 1 layout guard asserting `.daily-row` first column is `1fr` (catches future regression where someone tightens layout and breaks Afrikaans)
- 1 structural sanity check on the `T.days` block extraction

Full suite: **257 → 294** (+37). All passing.

## Inspection note on other languages (per spec — not edited)

The spec said: "If any of them look obviously wrong on inspection, note it in the ship notes — don't edit. Al will get them flagged by native speakers."

On inspection:

- **`zu.sun: "Son"`** looks like an Afrikaans abbreviation, not Zulu. Zulu Sunday is **iSonto** — abbreviation would more naturally be "iSon" or "ISon" or "Sont". This is the same value as `af.sun: "Son"`, which suggests an old typo. **Flag for native-speaker review.**
- The rest of zu/xh/st abbreviations I can't judge without a native reader. Logging here so they get checked in the wider tester pass.
- English abbreviations are standard (Mon/Tue/Wed/Thu/Fri/Sat/Sun) — no concern.

## What I learned

- **Single-source-of-truth at the i18n layer pays off.** One `T.days` table fixes the Week tab AND the day-detail header AND any future consumer. The codebase getting this right earlier means this fix was a 3-line edit, not a 15-file sweep.
- **Layout-guard tests catch future regressions.** Asserting `grid-template-columns` starts with `1fr` is one line of test but locks in the "this column must be flexible" contract. If someone later tightens the Week tab to fixed widths, the AF test catches it before tester reports come back.
- **Same-string values across languages are a smell.** `af.sun === zu.sun === "Son"` is suspicious on its face — different languages rarely share an abbreviation by coincidence. Worth noting as a pattern: identical values in an i18n table are usually a sign that one language was copy-pasted from another and not actually translated.
