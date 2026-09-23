# Translation error taxonomy — the rubric (2026-09-23)

Probably Weather ships witty weather lines in English (the source) and Afrikaans (af), isiZulu (zu),
isiXhosa (xh) and Sesotho (st). Each item to classify is one of:

- **FLAG** — a live translation (`text`) that the 2026-09-19 blind back-translation check flagged.
  Evidence: `back` (a fresh agent translated `text` back to English WITHOUT seeing the English),
  `checker` + `checkerReason` (its verdict after it opened the English), `wrongSource` (the
  back-translation reads closer to another line of the same bin or photograph), `birth` (where a
  bank line's exact text sat in the arrays it was born in, April 2026, and whether its
  back-translation matches ANY current English line of its bin), `lesotho` (Lesotho-orthography
  forms in a Sesotho line), `langCheck` (corpus findings).
- **CORRECTION** — a human (a native reviewer, or Al for Afrikaans) replaced `before` with `after`
  for the English `en`. Classify what was wrong with `before` that the human fixed.

## One primary type, plus any secondary types

| Type | Use when |
|---|---|
| `REVERSED` | The line says the opposite of the English, or an instruction would make someone do the opposite (headlights OFF instead of ON). Negation lost or added. |
| `DETAIL` | The core claim survives but a detail a reader would notice is dropped, added or changed: a named thing becomes generic, a time/place/number/object/person/action changes, or a real word with a different meaning is used (roof → ship, jersey → jail, "cover" → "close"). |
| `WRONG_KEY` | The line is a faithful rendering of ANOTHER CURRENT English line (a sibling in the same bin or on the same photograph) — it is keyed to the wrong line. Evidence: `wrongSource`, `birth.bestCurrentEnglishInBin`. |
| `OUTDATED_LIST` | The line renders content that is in NO current English line of its bin: it was translated from an out-of-date or different source list, not adapted from its own English. Typical: the partly-cloudy arrays born misaligned in April 2026 (`birth.bornInApril`, `birth.matchesNoCurrentEnglish`, often following `afrikaansThen`). A loose translation of its OWN English is `DETAIL` or `JOKE_LOST`, not this. |
| `SPELLING_STANDARD` | Sesotho in the Lesotho orthography where Al ruled South African orthography (Lesotho `ea/oa`, `li-`, `tš`, `'ng`, `joale`, `leholimo`, `moholi`, `chesa`, `moea` → SA `ya/wa`, `di-`, `tsh`, `ng`, `jwale`, `lehodimo`, `mohodi`, `tjhesa`, `moya`); for any language, a spelling that breaks the standard orthography (Afrikaans without its diacritics: `wereld`/`wêreld`, `reen`/`reën`, `more`/`môre`, `se`/`sê`). |
| `LITERAL` | The meaning is right but the wording is word-for-word, stiff or unnatural — no native speaker would say it that way; a calqued idiom; the wrong register. |
| `JOKE_LOST` | The meaning is roughly right but the humour, wordplay, SA reference or punchline is gone or flattened (hadedas → birds; "load shedding" → "switching off"; the twist missing). |
| `OTHER` | None of the above: a grammar error that does not change the meaning, English left untranslated, mixed languages, a typo that does not change the meaning. Say what in `note`. |

For a CORRECTION where `before` was not wrong and the human simply preferred other words, use
`LITERAL` if `before` was stiff, `JOKE_LOST` if `after` restores humour `before` lacked, or `OTHER`
with the note "preference".

## Safety

`safety: true` when the ENGLISH line gives advice or a warning someone could act on — headlights,
stay inside / stay home, sunscreen / SPF / hat, flooding, wind or gusts (hold on, secure things),
hail (cover the car), don't drive / drive slowly, lightning, heat (drink water). About the English
line, whatever the error.

## Output

A JSON array, one object per input item, in the same order:

```json
{ "id": "st-0870", "primary": "REVERSED", "secondary": ["DETAIL"], "safety": true, "note": "tells drivers to switch headlights off in fog" }
```

`note` ≤ 20 words and names the specific failure (quote the offending word where it helps).
