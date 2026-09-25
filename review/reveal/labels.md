# The one new piece of copy: the joke toggle's name (2026-09-25)

Home D's joke that arrives late adds a control to hide or show the joke (a tap on the photograph, and a
button for keyboards and screen readers). Its name is the only new copy; every other word on D is read off
the app. Wired in `assets/home-options.js` (`JOKE_LABELS`), design branch only.

| | Show | Hide | Who rules |
|---|---|---|---|
| English | Show the joke | Hide the joke | Al (OK/FIX on `review/reveal-for-al.html`) |
| Afrikaans | Wys die grap | Versteek die grap | Al (OK/FIX on `review/reveal-for-al.html`) |
| isiZulu | Bonisa ihlaya | Fihla ihlaya | translation skill + lang-check (below) |
| isiXhosa | Bonisa isiqhulo | Fihla isiqhulo | translation skill + lang-check (below) |
| Sesotho | Bontsha motlae | Pata motlae | translation skill + lang-check (below) |

Afrikaans uses the everyday UI pair *Wys / Versteek* (as in "Wys wagwoord / Versteek wagwoord").

## How the three were made and checked

Drafted by the rules in `.claude/skills/{zu,xh,st}-qc` (a label stays a label; a command stays a command;
Sesotho in the South African orthography), then:

- `node scripts/lang-check/triage.mjs --lang <zu|xh|st> --file review/reveal/lang-check/labels-<lang>.json`
  → **2 of 2 pass in each language, 0 to a native reader** (`lang-check/triage-<lang>.md` / `.json`; the
  tracked `review/lang-check-triage-*.{md,json}` the tool writes were restored afterwards).
- `scripts/translation-skills/rule-checks.mjs` (`ruleCheck`, incl. the Sesotho SA-orthography rules) → 6/6 pass.

Sense evidence, because the checker could not match "joke" back from a gloss in isiXhosa and Sesotho:

- **isiZulu** — *ihlaya* = "joke" (kaikki / Wiktionary gloss; Leipzig 41×, plural *amahlaya* 69×);
  *bonisa* = "to make see, to show, to display"; *fihla* = "to hide, to conceal".
- **isiXhosa** — *isiqhulo* has no dictionary gloss offline; the corpus fixes the sense: Leipzig
  xho_community_2017 #19713 "Ukuba umntu ohleli kwigumbi lokuphumla wenza **iziqhulo**, musa ukuhleka."
  (if someone in the waiting room makes jokes, don't laugh); *iqhula* = comedian (#8675, Sifiso Nene).
  *bonisa* = show (the checker's English→isiXhosa index: "show" → veza, bonisa; the app's own "Display" is *Ukubonisa*);
  *fihla* = "to hide, to conceal" (kaikki).
- **Sesotho** — *motlae* = "joke" (the checker's dictionaries, Bukantswe/Autshumato: "motlae, metlae"); Leipzig sot-za_web_2018_10K #3828
  "Ho ne ho tla ba le lerato le **metlae** ho bohle." *bontsha* = "to show" (South African spelling; Lesotho
  writes *bontša*); *pata* = "hide (v.), conceal (v.)" (same dictionaries).

A native speaker has not read these; the gate above is the house rule for zu/xh/st (Al's ruling
2026-09-06: a triage-high line is not wired until a native rules — none were triage-high).

Noticed, not changed: the Settings row "Display" in Sesotho reads *Bonts'a* (`assets/app.js` T.display) —
the Lesotho apostrophe form; South African spelling is *Bontsha*.
