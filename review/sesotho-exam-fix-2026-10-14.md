# Sesotho and the October exam — what failed, the fix, the evidence (14 Oct 2026, Vonk)

Al, 14 Oct: "if Sesotho flunked the oct exam, why arent we fixing that? We cant just give up on it."

## What failed

The October exam (`scripts/lang-check/exam-2026-10.mjs`) asks the rebuilt checker to raise recall on wrong-sense AND on
wrong-language in every language, without losing precision. On 10 Oct Sesotho improved on everything but one number:
wrong-language recall stayed at 95% (18 of 19), so the language failed and nothing was drafted in it.

The one miss: **st-bad-3541 "Ho tjhesa tota"** — the Setswana `tota` planted for the Sesotho `haholo`. The Sesotho
corpora attest `tota` once (1,253,894 tokens), Setswana 637×. The 6 Sept checker treats any attested word as Sesotho;
its Setswana function-word list (`gore`, `gape`, `jaanong` …) does not name `tota`.

## The blind spot is not one word

Words the Sesotho corpora attest 1–3 times while Setswana or Sepedi use them 100+ times and 50× as often: **110**
(`jwa`, `rre`, `mongwe`, `gape`, `bangwe`, `gomme`, `morago`, `dingwe`, `ngwaga`, `mmogo`, `tsone`, `tota`, `dilo`,
`leina`, `lefase`, `hwetsa`, `thoma`, `nyaka`, `tsea` …). These are exactly the slips a drafter makes in Sesotho.

## The rule

`scripts/lang-check/lib/checker-v2.mjs`, section (d) LOPSIDED SOTHO-TSWANA ATTESTATION: in Sesotho, a word attested at
most 3× while Setswana or Sepedi use it ≥ 100× and ≥ 50× as often is a contamination finding (medium). Hyphenated and
elided forms are judged part by part; a word the 6 Sept check already called contamination is raised, never counted
twice. It lives in the rebuilt checker only, so the exam's BEFORE column is still the 6 Sept checker. **It was written
after the failure, with the failing item in view**, and the exam report says so.

## Evidence (reproducible: `node scripts/lang-check/st-lopsided-evidence.mjs --independent review/sesotho-independent-set-2026-10-14.json` → `sesotho-exam-fix-2026-10-14.json`)

The production checker (no back-translation). "Without (d)" is the same rebuilt checker with rule (d)'s findings taken out — not the 6 Sept checker the exam calls BEFORE.

| set | flagged without (d) | flagged with (d) | rule fired |
|---|---|---|---|
| **Independent contaminated** — 40 Sesotho lines, each with one Setswana/Sepedi slip, 40 different words, written by a Sonnet 5.5 subagent told only which words the OLD checker already lists, not the rule | 18 | **25** | 7 |
| **Independent clean** — 40 correct Sesotho lines by the same writer | 2 | 2 | **0** |
| Live Sesotho bank, 901 lines | 198 | 198 | **0** |
| Good gold items, 486 | 91 | 91 | **0** |
| Gold wrong-language, 19 | 18 | **19** | 2 |

The rule fired on morago, mogolo, mmogo, mosimane, nyaka, bjang and gare in the independent set. It did **not** catch
15 of the independent slips (kamoso, maabane, botlhoko, tlhokomela, mogala, bokone, diphologolo, ge, kudu, kgonthe,
swanetše, leboga, kwala, tsena, bogareng): those words are attested more than three times in the Sesotho corpora, so
the counts cannot single them out. The thresholds were not loosened to catch them — that would be fitting the
independent set. The second model's blind back-translation (its `langSeen`) is the other net for those.

An earlier check (my own plants: 29 bank lines with one word swapped for a blind-spot word, 9 caught before, 29 after)
is superseded by the independent one: Sol (14 Oct) rightly pointed out that its words came from the rule's own list.

## The re-run exam (all four languages, same gold set, same threshold 0.25)

| lang | precision | recall | wrong-sense | wrong-language | verdict |
|---|---|---|---|---|---|
| zu | 55% → 56% | 60% → 67% | 37% → 53% | 84% → 89% | PASS (unchanged) |
| xh | 36% → 36% | 82% → 87% | 62% → 81% | 100% (ceiling) | PASS (unchanged) |
| **st** | 38% → **39%** | 82% → **90%** | 54% → 73% | 95% → **100%** | **PASS** |
| af | 67% → 69% | 77% → 86% | 50% → 83% | 100% (ceiling) | PASS (unchanged) |

Sesotho false alarms on the gold set: 101 after, the same as before the rule. No threshold, no other rule and no gold
label changed. The Afrikaans side measure (Al's accepted lines) now counts 1,687 lines, not 1,673: the decisions file
grew between 10 and 14 Oct, so that comparison is not a fixed-corpus re-run; the Afrikaans verdict is unchanged.

## What passing means, and does not

It means the checker that gates Sesotho is now as good, on this exam, as the ones gating isiZulu and isiXhosa, so
Sesotho is drafted the same way: drafts, a blind back-translation by a second model, then the gate. Every Sesotho line
it lets through is **provisional pending a native reader**, exactly like isiZulu and isiXhosa. The checker's Sesotho
precision is 39%: it raises many false alarms, which hold lines back, never wave bad ones through.
