# Cross-family draft checker — paste into Codex (GPT-5.6 Sol)

**Al: this is your only manual step.** Open Codex in the repo root
(`probably-weather-new-c`) and paste everything below the line. Codex (GPT family) screens the
isiZulu/isiXhosa/Sesotho drafts that a Claude subagent produced — a different model family checks
the drafter, which is the whole point (same-family reviewers share blind spots). When it finishes,
re-run Claude Code; it will detect the `checker-verdicts.jsonl` files and apply the PASS drafts.

Codex has no Stop hook — the durable rules live in the repo `AGENTS.md`. This prompt is
self-contained; it needs no other context.

---

## TASK: screen provisional low-resource translations for defects

You are a defect-finding reviewer for provisional isiZulu, isiXhosa, and Sesotho weather-app
copy. Drafts were produced by a different model and must be independently verified before they
ship. Your job is to CONSTRUCT A FAILING CASE for each draft where one exists — find the defects,
do not rubber-stamp. A draft that passes is one you could not falsify.

Work through all three languages: `zu`, `xh`, `st`. For each language `L`:

### 1. Read the reference material (in full)
- `lang-packs/L/lexicon-protected.md` — confirmed-correct words. Row #1 (in zu, cross-referenced
  in xh/st) is the **imbatata rule**: a word a model invented that is not real. The core defect
  class you are hunting is **invented or unattested words presented with false confidence.**
- `lang-packs/L/errors-observed.md` — the catalogue of real past defects: **calque** (word-for-word
  from English), **wrong-word** (real word, wrong meaning — e.g. isiZulu `umkhumbi`=ship used for
  kite, `iqanda`=egg for zero; Sesotho `lifofane`=airplanes for gusts, `tsie`=grasshopper for
  cricket), **wrong-dialect** (Zulu/Xhosa form in Sesotho, or Lesotho spelling in SA-Sesotho),
  **wrong-register**, **unattested token** (isiXhosa's main risk — plausible-looking non-words),
  **fused word boundary**.
- `lang-packs/L/banned-words.json` — machine-readable defect tokens: `hard` (always wrong —
  misspellings/wrong-dialect, e.g. Sesotho `mohodi`→`moholi`, `hlonepha`→`hlompha`) and `soft`
  (historically misused — verify in context). A `hard` token present in a draft is an automatic FLAG.
- `lang-packs/L/PACK.md` and `lang-packs/L/harvest-notes.md` — the target register (urban,
  colloquial, code-switched; NOT textbook). Code-switched loans (braai, brand/place names) are
  CORRECT, not defects — do not flag a naturally borrowed word.

### 2. Screen every draft
Read `lang-packs/L/drafts-batch-1.jsonl` (one JSON per line: `{key, en, af, L, confidence, note}`).
For each draft, test it against these failure checks:
- **Invented/unattested word** — does any content word appear in neither the confirmed corpus
  (`lang-packs/L/corpus-confirmed.jsonl`) nor standard attested vocabulary? Flag it. This is the
  highest-severity defect (imbatata class).
- **Banned wrong-word / calque** — does it reproduce or resemble any entry in errors-observed.md?
- **Protected-lexicon violation** — does it use a banned form where lexicon-protected.md fixes it
  (e.g. `mohodi`→`moholi`, `hlonepha`→`hlompha`, `lifofane`→gusts term)?
- **Wrong dialect** — Zulu/Xhosa form in Sesotho, or Lesotho spelling where SA-Sesotho is required.
- **Fused word boundary / morphology error** (esp. isiXhosa).
- **Meaning drift** — does the draft actually convey the English intent, or did the joke break?

The draft's own `confidence` tag is a hint, not a verdict — verify LOW ones hardest, but do not
trust HIGH ones blindly.

### 3. Write the verdict file
Write `lang-packs/L/checker-verdicts.jsonl`, one JSON object per draft, same order:
```
{"key":"<key>","verdict":"PASS|FLAG","severity":"none|low|high","defect":"invented-word|calque|wrong-word|wrong-dialect|protected-lexicon|unattested|boundary|meaning-drift|none","reason":"<one line: what and why, or empty for PASS>","suggested":"<optional safer wording; leave empty unless confident>"}
```
Rules:
- `PASS` only if you could not construct a failing case. When genuinely unsure, `FLAG` low —
  a flagged draft costs a native a glance; a wrongly-passed invented word ships a fake word.
- Do NOT rewrite drafts wholesale. `suggested` is optional and only when you are confident; the
  native speaker, not you, has final say on wording (you are also an outsider to these languages).
- Do NOT edit the copy banks, the drafts, or any file under `assets/`. Only write the three
  `checker-verdicts.jsonl` files.

### 4. Report
Print per language: total drafts, PASS count, FLAG count, and the FLAG breakdown by defect type.
Verify each verdicts file has exactly one row per draft before finishing.

Integrity: your summary is a claim, not proof — Claude Code re-runs a mechanical check that every
verdict row maps to a real draft key before trusting the file. Do not fabricate PASS rows for
drafts you did not actually read.
