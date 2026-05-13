---
name: zu-qc
description: isiZulu (zu) translation quality checker for Probably Weather. Use whenever working on the `zu` column of `T` in `assets/app.js`, `INSTALL_T` in `assets/install.js`, `PTR_COPY`, or `WEATHER_COPY`. Triggers on: Zulu, isiZulu, ZU translation, ZU QC, zu column, iSonto, uMsombuluko, Nguni, SADiLaR, CTexT, Zulu word list. Conservative-by-default: most cross-language duplicates with Xhosa are legitimate Nguni cognates — never auto-apply unless the source language is clearly non-Nguni (e.g. Afrikaans).
---

# zu-qc — isiZulu QC for Probably Weather

> **Status: heuristic checklist, NOT dictionary-backed.**
>
> This skill performs pattern-based checks (cross-language exact-match comparison, Nguni class-prefix presence, orthography sanity, English-loanword detection) using only the source `T` object and Claude's in-context isiZulu knowledge. It does **NOT** call SADiLaR, NWU CTexT, isiZulu.net, or any external dictionary or word-list API. The "consult SADiLaR / CTexT" references in the procedure below are documentation breadcrumbs for manual native-speaker review, not automated lookups.
>
> Use this skill as a structured checklist when triaging isiZulu strings, and as a contract specification for what a future dictionary-backed tool would look like. Do **not** treat its "confidence" outputs as dictionary-validated. Confidence here is heuristic confidence (how strong the structural signal is), not lexicographic confidence (whether a SADiLaR lemma list actually contains the surface form).
>
> Semantic mismatches — a real isiZulu word used in the wrong sense (e.g. `weather.gusts.zu = "amafindo"`, which is the plural of `ifindo` meaning "knot/node" rather than wind gust) — are **not catchable by this skill**. Wordlist or lemma-list backing would not catch them either, since both source and intended-target forms are real isiZulu words. Catching this class of bug requires native review or a bilingual EN↔ZU gloss round-trip.
>
> See `LANGUAGE_AUDIT_PHASE3_REPORT.md` for the full Phase 3 audit and the investigation behind this disclaimer.

## When to use

- Any edit touching the `zu:` value of an i18n leaf.
- Reviewing a batch of isiZulu strings flagged in `I18N_CROSS_LANGUAGE_AUDIT.md`.
- The audit lists 34 cross-language duplicates for zu, but **most are legitimate Nguni cognates** shared with Xhosa.

## References (consult before flagging)

- **SADiLaR** (repo.sadilar.org) — South African Digital Language Resources, isiZulu corpora and word lists.
- **NWU CTexT** — Centre for Text Technology word lists / spelling resources.
- **isiZulu.net** — community dictionary, useful for sanity checks.
- Existing PW corpus — many zu strings have been native-reviewed; treat them as ground truth unless evidence says otherwise.

## Conservative protocol

> **Low confidence = defer to human. Never auto-apply.**

For Zulu specifically, the dominant cross-language pattern is **shared Nguni vocabulary with Xhosa**. Words like `umoya` (wind), `imvula` (rain), `usuku` (day), `ikhaya` (home), `phezulu` (high) are genuinely identical in both languages. Do **not** flag these as bugs.

The only **canonical** confirmed bug pattern is **Afrikaans-Zulu duplicates** (`days.sun.zu = "Son"` matches `days.sun.af = "Son"`). Afrikaans and Zulu share no genealogy — any identical string between these two is suspicious unless it's a brand/acronym (UV, Temp, etc.).

## `check(string, key, context)` procedure

```
check(value, key, context) → { confidence: 0–1, flags: [], suggestions: [] }
```

Steps:

1. **Cross-language source check** — if value matches `af`, `en`, or `st` exactly AND is not a known acronym, flag with confidence 0.8.
2. **Cross-language source check (Nguni)** — if value matches `xh` exactly, downgrade to "likely cognate" (confidence 0.3 max for being a bug — i.e. low confidence it's wrong).
3. **Class prefix check** — Zulu nouns carry class prefixes (`u-`, `um-`, `i-`, `isi-`, `aba-`, `ama-`). A noun-meaning string in the zu slot that lacks a prefix is suspicious (e.g. "Home" → should be "Ikhaya" not "Khaya"). Mild flag, confidence 0.5.
4. **Verb form** — Zulu UI labels typically use noun-of-action (`Ukuhlela` for "to edit") or imperative (`Hlela!`). Either is fine; the verb root present is the key check.
5. **Orthography** — Zulu uses standard Latin alphabet, no diacritics. Strings with `é`, `ë`, `ï` are flagged (likely from another language).

## High-confidence fix criteria (auto-apply allowed)

All three must hold:

- Value is verbatim from a non-Nguni language (af, st, or en — excluding shared acronyms).
- A canonical Zulu equivalent is available in SADiLaR / existing PW corpus.
- The key is a short UI label (≤ 4 words), not a paragraph (paragraphs need full native review).

## Examples (from this codebase)

- ⚠️ HIGH-SUSPICION but defer: `days.sun.zu = "Son"` — matches `af.sun`. Almost certainly a copy-paste from Afrikaans. Zulu Sunday is **iSonto**; the 3-letter abbreviation pattern used elsewhere (`Mso`, `Bil`, `Tha`, `Sin`, `Hla`, `Mgq`) would suggest something like `Snt` or `Sont`. **However**, the exact form is a UX/style decision (matches AF pattern? matches XH "Caw"?) — **defer to native speaker**, do not auto-apply.
- ✅ LEGITIMATE: `weather.wind.zu = "Umoya"` = `xh.wind` — shared Nguni word. Keep.
- ✅ LEGITIMATE: `weather.rain.zu = "Imvula"` = `xh.rain` — shared Nguni word. Keep.

## Output format

```
{
  "key": "days.sun",
  "current": "Son",
  "confidence_is_bug": 0.85,
  "confidence_in_fix": 0.4,
  "flags": ["matches-af", "copy-paste-suspect"],
  "suggestion": "Snt or Sont (uncertain — defer)",
  "rationale": "Matches af.sun exactly. Zulu Sunday is 'iSonto'. Exact 3-letter form requires native confirmation."
}
```

If `confidence_in_fix < 0.85`, write to `TRIAGE_NATIVE_REVIEW.md`.
