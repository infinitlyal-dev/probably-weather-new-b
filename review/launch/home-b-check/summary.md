# Home B, measured the way D was (review/photo-check) — launch run, 25 Sept 2026

Measured by a background agent for Vonk, from a checkout of `de09a2b` (design/home-options) with this folder at
`review/launch/home-b-check/`; the agent could not write this file, so it is written from its report. Nothing in the
app was changed.

## Checks

- **Placements:** 14,697, measured in place in the real `?home=b` build (B's photo card, B's own font-fitting
  code). The line list, rebuilt with D's code, is identical to D's.
- **Page scroll:** 0 everywhere.
- **In-place vs full page loads:** 78/78 agree (D: 77/77). Worst-case screenshots vs measured boxes: 350/350.
- **Smallest joke:** 18.91 px, in 1,575 placements, all at 320×488 (B's fitter can step one pixel under its 19 px
  floor; EVAL §4b reported this for A–C). At 414×715 the smallest is 31.04 px.

## At 414×715 (Al's phone): sits on the subject / sits on or touches — B (D)

| | B | D |
|---|---|---|
| en | 15 / 112 | 90 / 164 |
| af | 18 / 122 | 94 / 168 |
| zu | 28 / 176 | 116 / 199 |
| xh | 30 / 184 | 114 / 192 |
| st | 25 / 176 | 118 / 202 |
| en + af | 18 / 125 | 96 / 171 |
| all five | 34 / 201 | 120 / 204 |

Of 293 photographs, in any language: sits on 34 (D 120); touches with faces clear 167 more (D 84); clear 92 (D 89).
isiZulu, isiXhosa and Sesotho add 16 photographs, or 76 counting touches (D: 24 and 33).

**Other sizes (sits on or touches, any language):** 360×688 — 200 (D 187); 320×488 — 174 (D 190); any size — 210
(D 214). Nine photographs are flagged only on a smaller phone (D: 10).

B's joke always sits at the foot of the photo card, which is cut to Al's crop band, so it mostly covers legs, laps
and ground with faces clear. The card gets shorter as the data rows under it get longer (at 414×715: English 478 px,
isiXhosa 368–388 px), which is why the zu/xh/st gap is wider in B than in D.

**Only in B:** at 320×488 in isiXhosa the photo card is 87–107 px tall and the joke's text starts under the header
in 966 placements (all 879 isiXhosa, plus 87 Sesotho), on all 293 photographs. Example:
`shots/217-c19d5809-320x488.jpg`.

## How it was judged

- D's subject bands and D's rule (≥ min(40 px, half the band)); each band carried into B's card row by row, because
  the card height changes with language and weather. Fed D's own rows, the mapping reproduces D's count 879/879.
- By eye, 350 judgements (`data/b-judged.json`): all 293 worst cases at 414×715, 16 cases flagged only on a smaller
  phone, D's second look (38), 3 more. The eye overrode the rule 21 times (15 visible touches under 40 px into the
  band; 6 where D's band takes in the wall, floor or cushion under the subject). 18 bands are new, for subjects D's
  joke never reached.
- Vonk looked at the twelve worst cases in `shots/` and agrees: faces mostly clear; the text crosses legs, laps,
  tables and ground; 320×488 isiXhosa is broken (text under the header).

## Limits

A different judging session from D's, so the sits-on vs touches split is the softest number; D's one midday weather
state per folder; one level per photograph, as in D; nothing checked on a real phone.

## Files

Scripts `b-cover-measure.mjs`, `b-worst.mjs`, `b-judge.mjs`, `b-count.mjs`, `b-fullload-check.mjs`; `data/`
(including `b-judged.json` and `b-count.json`, B's and D's totals side by side); the run logs; `shots/` (12 worst
cases, `<#>-<photo>-<size>.jpg`).
