# Afrikaans — errors observed (Al's corrections = the voice signal)

AF has no native-review debt (Al IS the native). These are patterns Al fixed when AI or an earlier
draft got the register wrong. Source: `review/af-gapfill.md`, commits `95fa5e8` (52 wording
rulings), `9803b8c` (binnestebuite + wegkruipertjie dup). Use as a negative prompt for future AF.

## half-English — a line left partly in English where full AF was wanted
| Draft (half-English) | Al's direction |
|---|---|
| Sky's playing kat-en-muis. | full AF rewrite: "Die lug speel kat en muis." |
| (English pun carried over literally) | localise the joke into AF idiom, don't half-translate |

## textbook-stiff → colloquial
Al consistently pushes drafts toward spoken Strand/Boland Afrikaans: contractions, "hey"/"nè"
tags, "boet", dry understatement. A grammatically perfect but stiff line is wrong for this app.

## literal calque of an English pun
English wordplay rarely survives literal translation. Al rewrites for a joke that lands in AF —
e.g. localising to the Cape Doctor, the tafeldoek, beurtkrag/Eskom, rather than translating the
English image. Conceive the gag in Afrikaans.

## spelling / word specifics Al ruled
- `binnestebuite` (inside-out) — correct form ruled in `9803b8c`.
- `wegkruipertjie` (peek-a-boo / hide-and-seek) — dedup ruled; one canonical use.
- Keep his loans exactly (braai, Weber, bakkie, Eskom, beurtkrag) — do not "translate" them.

## the meta-rule
For AF there is no imbatata risk (native author), but the same discipline holds in reverse: don't
"improve" Al's wording toward textbook correctness. His colloquial choice is final — the outsider
(model) is wrong until Al says otherwise. This is the imbatata rule pointed at AF.
