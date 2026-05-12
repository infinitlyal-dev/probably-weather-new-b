---
name: xh-qc
description: isiXhosa (xh) translation quality checker for Probably Weather. Use whenever working on the `xh` column of `T` in `assets/app.js`, `INSTALL_T`, `PTR_COPY`, or `WEATHER_COPY`. Triggers on: Xhosa, isiXhosa, XH translation, XH QC, xh column, Cawe, Mvulo, Nguni, SADiLaR, CTexT, Xhosa word list. Conservative-by-default: most cross-language duplicates with Zulu are legitimate Nguni cognates — never auto-apply unless the source language is clearly non-Nguni.
---

# xh-qc — isiXhosa QC for Probably Weather

## When to use

- Any edit touching the `xh:` value of an i18n leaf.
- Reviewing the 33 cross-language duplicates flagged in `I18N_CROSS_LANGUAGE_AUDIT.md` for xh.
- Most duplicates are with Zulu and are genuine Nguni cognates.

## References (consult before flagging)

- **SADiLaR** (repo.sadilar.org) — isiXhosa corpora and word lists.
- **NWU CTexT** — spelling and word-list resources.
- **isiXhosa.net** — community reference.
- Existing PW corpus — accept as ground truth unless evidence says otherwise.

## Conservative protocol

> **Low confidence = defer to human. Never auto-apply.**

Xhosa shares heavy vocabulary with Zulu (Nguni family). Cross-language identicals between zu and xh are usually correct, not bugs. The audit pre-screened these — review the audit before assuming any duplicate is wrong.

Suspect patterns:

- **xh identical to af** — no shared genealogy, very suspicious.
- **xh identical to st** — different family (Nguni vs Sotho-Tswana), suspicious.
- **xh identical to en** — possible loanword (e.g. "UV", "Temp"), but otherwise suspicious for content strings.

## `check(string, key, context)` procedure

```
check(value, key, context) → { confidence: 0–1, flags: [], suggestions: [] }
```

Steps:

1. **Cross-language source check (non-Nguni)** — if value matches `af`, `en`, or `st` exactly (excluding known acronyms), flag with confidence 0.8.
2. **Cross-language source check (Nguni)** — if value matches `zu` exactly, downgrade to "likely cognate" (confidence 0.3 max for being a bug).
3. **Class prefix check** — Xhosa noun-classes (`u-`, `um-`, `i-`, `isi-`, `aba-`, `ama-`). Same as Zulu — missing prefix on a noun is mildly suspicious.
4. **Orthography** — Xhosa Latin alphabet, no diacritics. Click consonants are written as `c`, `q`, `x` digraphs. Strings with `é`, `ë`, `ï` flagged.
5. **Tone of UI labels** — Xhosa imperatives ("Hlela!") vs nominal labels ("Ukuhlela"). Either is acceptable; check consistency within the same UI section.

## High-confidence fix criteria (auto-apply allowed)

All three must hold:

- Value is verbatim from a non-Nguni language (af, st, or en — excluding shared acronyms).
- A canonical Xhosa equivalent is available in SADiLaR / existing PW corpus.
- The key is a short UI label (≤ 4 words).

## Examples (from this codebase)

- ✅ LEGITIMATE: `weather.wind.xh = "Umoya"` = `zu.wind` — shared Nguni. Keep.
- ✅ LEGITIMATE: `weather.day.xh = "Usuku"` = `zu.day` — shared Nguni. Keep.
- ✅ LEGITIMATE: `nav.home.xh = "Ikhaya"` = `zu.home` — shared Nguni. Keep.
- ⚠️ DEFER: `days.thu.xh = "Sin"` (matches `zu.thu`) — Xhosa Thursday is Lwesine, "Sin" plausible. Defer.

The audit shows **no canonical "obvious bug" cases for Xhosa** — every duplicate is a plausible Nguni cognate. Default action: defer the entire batch to native review.

## Output format

```
{
  "key": "weather.day",
  "current": "Usuku",
  "confidence_is_bug": 0.1,
  "flags": ["matches-zu (Nguni cognate)"],
  "suggestion": null,
  "rationale": "Both Zulu and Xhosa use 'usuku' for day. Legitimate shared form."
}
```

If `confidence_in_fix < 0.85`, write to `TRIAGE_NATIVE_REVIEW.md`.
