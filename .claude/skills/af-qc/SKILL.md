---
name: af-qc
description: Afrikaans (af) translation quality checker for Probably Weather. Use whenever working on the `af` column of the `T` object in `assets/app.js`, the `INSTALL_T` object in `assets/install.js`, the `PTR_COPY` object, or the `WEATHER_COPY` (`heroLabels`, `headlines`, `witty`). Triggers on: Afrikaans, AF translation, Afrikaanse, AF QC, af column, Maandag, Sondag, braai, donder, Suidooster, AWS spelling, Pharos. Conservative-by-default: never auto-apply low-confidence corrections — defer to native-speaker review.
---

# af-qc — Afrikaans QC for Probably Weather

> **Status: heuristic checklist, NOT dictionary-backed.**
>
> This skill performs pattern-based checks (cross-language exact-match comparison, AWS 2017 spelling heuristics, length / English-loanword sniff, capitalisation conventions) using only the source `T` object and Claude's in-context Afrikaans knowledge. It does **NOT** call Pharos Aanlyn, the AWS digital lookup, or any other dictionary API. The "consult Pharos / AWS 2017" references in the procedure below are documentation breadcrumbs for manual native-speaker review, not automated lookups.
>
> Use this skill as a structured checklist when triaging Afrikaans strings, and as a contract specification for what a future dictionary-backed tool would look like. Do **not** treat its "confidence" outputs as dictionary-validated. Confidence here is heuristic confidence (how strong the structural signal is), not lexicographic confidence (whether Pharos actually agrees).
>
> Semantic mismatches — a real Afrikaans word used in the wrong sense, e.g. `weather.gusts` translated to a literal but contextually wrong noun — are **not catchable by this skill**. They require native review or a bilingual gloss lookup that this skill does not perform.
>
> See `LANGUAGE_AUDIT_PHASE3_REPORT.md` for the full Phase 3 audit and the investigation behind this disclaimer.

## When to use

- Any edit touching the `af:` value of an i18n leaf in `T`, `INSTALL_T`, `PTR_COPY`, or `WEATHER_COPY`.
- Reviewing a batch of Afrikaans strings for a release.
- Investigating a cross-language duplicate flagged in `I18N_CROSS_LANGUAGE_AUDIT.md`.

## References (consult before flagging)

- **Pharos** (pharosaanlyn.co.za) — authoritative AF↔EN dictionary, free online.
- **AWS 2017** (Afrikaanse Woordelys en Spelreëls, 11de uitgawe) — official spelling rules.
- Native AF use locally: existing PW corpus in `assets/weather-copy.js` and `assets/app.js` (already tested in `tests/af-day-abbreviations.test.js`).

## Conservative protocol

> **Low confidence = defer to human. Never auto-apply.**

For every candidate fix:

1. Compare against the Pharos reference for that exact word/phrase.
2. Check the AWS 2017 spelling — common traps: `y` vs `i`, `ie` vs `ee`, double consonants, capitalisation of compound nouns.
3. If the string is identical to the English value AND English is not the canonical AF form (Pharos confirms a distinct AF word exists), this is a flag.
4. If unclear → write to `TRIAGE_NATIVE_REVIEW.md`, do **not** mutate `assets/app.js`.

## `check(string, key, context)` procedure

```
check(value, key, context) → { confidence: 0–1, flags: [], suggestions: [] }
```

Steps (mental model):

1. **Length sanity** — single English word like "Edit" / "Done" in the AF slot is suspicious unless AWS-listed as loan (e.g. "OK").
2. **English-loanword detection** — if value is verbatim English AND a Pharos AF equivalent exists, flag with confidence 0.6 max.
3. **Conjugation basics** — verb-form match (infinitive vs imperative): UI buttons in AF take imperative form for second-person commands ("Stel in" not "Stel"), but short labels often use infinitive ("Stoor"). Mild flag if mismatch is obvious.
4. **Capitalisation** — AF capitalises proper nouns and start-of-sentence only. Title-cased mid-sentence words are flagged (confidence 0.5).
5. **Known legitimate duplicates** — `Wind`, `Week`, `Sat`, `Son`, `Temp`, `UV`, `Later` shared with English are **expected** in AF (per `I18N_CROSS_LANGUAGE_AUDIT.md`). Suppress flag.

## High-confidence fix criteria (auto-apply allowed)

All three must hold:

- A canonical AF form exists in Pharos AND in the existing PW corpus.
- The current value is verbatim from another language (most often English) AND that language is not a known shared form.
- Edit distance from current to suggested ≤ 5 characters OR the words are entirely different lexemes.

## Examples (from this codebase)

- ✅ HIGH: `days.mon.af` was `"Maa"`, fixed to `"Ma"` in commit `0519c3f`. Pharos + AWS confirm. Auto-applied via test (`tests/af-day-abbreviations.test.js`).
- ⚠️ DEFER: `weather.probably.af = weather.likely.af = "Waarskynlik"` — same word for both senses, semantically merged. Not a bug.
- ⚠️ DEFER: `screens.week.af = "Week"` — Afrikaans actually uses "week", coincides with English. Pharos confirms.

## Output format

When invoked, return:

```
{
  "key": "settings.somekey",
  "current": "<af value>",
  "confidence": 0.85,
  "flags": ["english-loanword", "pharos-mismatch"],
  "suggestion": "Stoor",
  "rationale": "Pharos lists 'stoor' for 'save'; current value 'Save' is verbatim English."
}
```

If `confidence < 0.7`, write to `TRIAGE_NATIVE_REVIEW.md` instead of editing.
