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

## isiZulu — not yet started

Blocked on Al's approval of the Afrikaans set. 883 lines to transcreate; 324 already carry
native-reviewed zu in the condition bank, 6 of those are blank, so roughly 559 are new work.

## isiXhosa — not yet started

As above. 324 carry native-reviewed xh, 15 of those are blank → roughly 574 new.

## Sesotho — not yet started

As above. 324 carry native-reviewed st, 11 of those are blank → roughly 570 new.

---

## How this file is used

- One section per language; each entry gets an id (`AF-1`, `ZU-1`, …) so a reader can answer
  by id without quoting the string.
- A line reaches production only after its language's reader has ruled on every entry here
  that touches it.
- Entries are closed by recording the reader's ruling inline, not by deleting them.
