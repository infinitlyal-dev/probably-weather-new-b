---
name: st-qc
description: Sesotho (st) translation quality checker for Probably Weather. Use whenever working on the `st` column of `T` in `assets/app.js`, `INSTALL_T`, `PTR_COPY`, or `WEATHER_COPY`. Triggers on: Sotho, Sesotho, ST translation, ST QC, st column, Mantaha, Sontaha, Sotho-Tswana, SADiLaR, CTexT, Sesotho word list. Conservative-by-default: no canonical bugs flagged in audit, but full column needs native-speaker review for naturalness.
---

# st-qc — Sesotho QC for Probably Weather

## When to use

- Any edit touching the `st:` value of an i18n leaf.
- Reviewing the Sesotho column for naturalness.
- The audit found **zero cross-language duplicates** for st — but the column still needs native review for grammar and naturalness.

## References (consult before flagging)

- **SADiLaR** (repo.sadilar.org) — Sesotho corpora.
- **NWU CTexT** — Sesotho word-list resources.
- Existing PW corpus — generally trustworthy, but the audit notes longer phrases (`toasts.permissionDeniedBrowser`, `settings.aboutText`, `INSTALL_T.iosChromeBody`) warrant extra attention.

## Conservative protocol

> **Low confidence = defer to human. Never auto-apply.**

Sesotho belongs to the Sotho-Tswana family, distinct from Nguni (Zulu, Xhosa). Identical strings between st and any other column are highly suspicious. The audit found none.

Watch instead for:

- Long phrases that read as "mechanically faithful but stiff" — flag for naturalness review.
- Intra-language merges (`weather.possible.st = weather.likely.st = "Ho ka etsahala"`) — likely correct but worth confirming.

## `check(string, key, context)` procedure

```
check(value, key, context) → { confidence: 0–1, flags: [], suggestions: [] }
```

Steps:

1. **Cross-language source check** — if value matches any of `en`, `af`, `zu`, `xh` exactly (excluding known acronyms), flag with confidence 0.85.
2. **Class prefix check** — Sesotho nouns use prefixes (`mo-`, `ba-`, `le-`, `ma-`, `se-`, `li-` etc.). Missing prefix on a noun is suspicious.
3. **Orthography** — Sesotho uses standard Latin alphabet, no clicks. Strings with click digraphs `q`/`c`/`x` in click positions are suspicious (suggests Nguni source).
4. **Idiom check** — Sesotho weather idioms are well-attested ("Letsatsi le chesa" = the sun shines, etc.). Long forms departing from documented idiom get a mild flag.

## High-confidence fix criteria (auto-apply allowed)

All three must hold:

- Value is verbatim from another language (excluding shared acronyms).
- A canonical Sesotho equivalent is in SADiLaR / existing PW corpus.
- The key is a short UI label (≤ 4 words).

## Examples (from this codebase)

- ⚠️ DEFER: `weather.possible.st = weather.likely.st = "Ho ka etsahala"` — intra-language merge, likely correct. Audit flagged for review.
- The full Sesotho column needs a native-speaker pass for **naturalness**, even though duplicate detection finds nothing wrong.

## Output format

```
{
  "key": "weather.possible",
  "current": "Ho ka etsahala",
  "confidence_is_bug": 0.15,
  "flags": ["intra-language-merge (probably / likely)"],
  "suggestion": null,
  "rationale": "Sesotho appears to use one phrase for both English senses 'possible' and 'likely'. Likely intentional."
}
```

If `confidence_in_fix < 0.85`, write to `TRIAGE_NATIVE_REVIEW.md`.
