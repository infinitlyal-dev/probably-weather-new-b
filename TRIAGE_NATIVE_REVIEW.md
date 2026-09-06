# TRIAGE — native review queue
### Probably Weather · bespoke line transcreation · opened 2026-09-06

One list per language, so each can go to one native reader in one sitting.

**What this file is for.** The QC skills are heuristic, not dictionary-backed. `af-qc` says so
in its own header: it does not call Pharos or the AWS, and *"semantic mismatches — a real
Afrikaans word used in the wrong sense — are not catchable by this skill. They require native
review."* So a line passing QC means it passed a structural check, never that it is right.
Anything the checks could not decide is listed here rather than being marked approved.

---

## Afrikaans — 1 item

Scope checked: 883 distinct bespoke lines (533 newly transcreated, 350 reused from the
already native-reviewed condition bank). Mechanical checks: identical-to-English, length
ratio, mid-sentence capitalisation, surviving English function words, missing circumflex on
known traps, terminator, balanced quotes, double spaces. Report: `review/af-qc-report.json`.

### AF-1 · spelling and capitalisation in an already-shipped bank line
- **EN:** "Not Instagram weather. Not the end of the world."
- **AF, as it ships today:** "Nie Troufoto weer nie. Nie die einde van die wereld nie."
- **Two things:**
  1. `wereld` should almost certainly be **`wêreld`** — the circumflex is load-bearing and
     AWS 2017 requires it. High confidence, but it is existing shipped copy, so it is listed
     rather than silently edited.
  2. `Troufoto` carries a capital mid-sentence. Afrikaans capitalises sentence starts and
     proper nouns only, and "troufoto" (wedding photo) is a common noun. It may have been
     intended as a brand-ish stand-in for Instagram, which is why it is a question rather
     than a fix.
- **Note:** this is **not** from the new transcreation. It is pre-existing bank copy that the
  new check surfaced. Nothing in the 533 new Afrikaans lines was flagged.
- **Ask the reader:** confirm `wêreld`, and rule on whether `Troufoto` should be lowercase or
  replaced.

### Standing question for the AF reader, not machine-checkable
The 533 new lines were written as transcreations, not translations — the joke was carried
rather than the words. The checks cannot see whether a line lands. The side-by-side sheet
(`review/af-side-by-side.html`) is the instrument for that judgement.

---

## Afrikaans — corpus-backed pass (2026-09-06)

The heuristic checks above were superseded the same day by `scripts/lang-check.mjs`, which is
backed by corpora (Hunspell af_ZA, Leipzig, kaikki/Wiktionary, Autshumato, NCHLT) and passed a
validation exam against native rulings before it was allowed to touch this set
(`scripts/lang-check/exam-result.md`; report: `docs/notes/LANG_CHECK_REPORT.md`).

Result over the same 883 lines: **27 need a human (4 high), 856 pass every corpus check.**
Full ranked list with evidence: `review/lang-check-triage-af.md`.

### AF-2 · four bank lines with a dropped diacritic (HIGH, all pre-existing bank copy)
- `cloudy#24` "Ten minste **reen** dit nie." · `rain-possible#12` "**Reen**? Moontlik." ·
  `rain#35` "…'n ding soos **reen** bestaan weer." · and AF-1's `wereld`.
- Evidence: `reën` 530× vs `reen` 62× across Leipzig/kaikki/Hunspell; `wêreld` 3182× vs `wereld` 249×.
- These are Al's own lines, so they are questions, not edits: confirm `reën` / `wêreld`.

### AF-3 · 23 lower-confidence doubts in the new lines (see the triage file)
Mostly: a clause with `Niemand/Geen/niks` whose closing `nie` the tool could not find, four
unattested compounds (`bygevul`, `veertiggraaddag`, `ysbomme`, `bedonerd`), and one English word
left in (`sags`). None changes a joke; each is a thirty-second read.

## isiZulu — not yet started

Blocked on Al's approval of the Afrikaans set. 883 lines to transcreate; 324 already carry
native-reviewed zu in the condition bank, 6 of those are blank, so roughly 559 are new work.

Meanwhile the 443 **provisional** zu fills already in the bank were run through the corpus-backed
checker: 56 need a human (3 high) — `review/lang-check-triage-zu.md`. When the transcreations
arrive: `node scripts/lang-check/triage.mjs --lang zu --file <set.json>`.

## isiXhosa — not yet started

As above. 324 carry native-reviewed xh, 15 of those are blank → roughly 574 new.

The 404 provisional xh fills: 105 need a human (22 high), mostly unattested words — the isiXhosa
corpora are the thinnest, so many are coverage gaps rather than defects — `review/lang-check-triage-xh.md`.

## Sesotho — not yet started

As above. 324 carry native-reviewed st, 11 of those are blank → roughly 570 new.

The 434 provisional st fills: 91 need a human (21 high), including Setswana forms and sense slips
with corpus evidence — `review/lang-check-triage-st.md`.

---

## How this file is used

- One section per language; each entry gets an id (`AF-1`, `ZU-1`, …) so a reader can answer
  by id without quoting the string.
- A line reaches production only after its language's reader has ruled on every entry here
  that touches it.
- Entries are closed by recording the reader's ruling inline, not by deleting them.
