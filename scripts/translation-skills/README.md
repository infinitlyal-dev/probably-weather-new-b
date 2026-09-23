# Translation skills — evaluate and sharpen (af, zu, xh, st)

Al's brief of 2026-09-23, Part 2. No human checkers for isiZulu, isiXhosa or Sesotho; Al checks
Afrikaans only. This folder is the pipeline. Working outputs (large, regenerable) live under
`output/translation-skills/` (git-ignored); anything that must persist lives here.

## 1. What exists (step 1)

| What | Where |
|---|---|
| Translation skills (the ones being improved — no parallel new ones) | `.claude/skills/af-qc/SKILL.md`, `zu-qc`, `xh-qc`, `st-qc` (per-language), `.claude/skills/pw-ui-copy/SKILL.md` (voice + translation rules), global copy `~/.claude/skills/pw-ui-copy/SKILL.md` |
| The corpus checker | `scripts/lang-check.mjs`, `scripts/lang-check/lib/checker.mjs`, triage `scripts/lang-check/triage.mjs` |
| Its exam | `scripts/lang-check/build-gold.mjs`, `gold-set.json`, `exam.mjs`, `exam-result.md` (2026-09-06 PASS) |
| Native review — isiZulu | commit `d51b173` (30 corrections); `lang-packs/zu/corpus-confirmed.jsonl` |
| Native review — isiXhosa | `review/xhosa-apply.csv` (commit `0510415`, 256 rows), `review/xhosa-quarantine.csv`, `review/Xhosa-Review-Merge.xlsx` |
| Native review — Sesotho | `review/sesotho-replacements.txt` (commit `ecdfe11`, 90 strings), commit `a38c32d` (reviewer reverting model edits) |
| Al's Afrikaans | `review/al-line-rulings.json` (483 rulings, 54 July rewordings in `comment`), `review/al-pair-rulings.json`, `review/af-al-decisions.json`, commit `2fe4972` |
| The last back-translation check | `review/translation-check-data.json` (2026-09-19; 306 flags live: af 85, zu 72, xh 78, st 71) |
| Corpora already on disk (with licences) | `.lang-check-cache/` — NCHLT GOV-ZA, SADiLaR morph, Autshumato, Bukantswe, African Wordnet, Leipzig, Constitution (5 languages), Wikipedia; licences in `scripts/lang-check/lib/build-index.mjs` |

Left out of every human set, on purpose: commit `5efdc0c` (1,281 machine drafts that passed a
checker), `c7715c4` (a GPT-5.5 audit), `0519c3f` / `cb0fa87` (a model session's fixes), and
`al-pair-rulings.json` NO verdicts (they judge a line against a photograph, not the Afrikaans).

## 2. The pieces

| Step | Script | Output |
|---|---|---|
| Human feedback, one shape | `build-feedback.mjs` | `output/translation-skills/feedback.json` (2,463 items) |
| English history per bank index | `en-history.mjs` | `output/translation-skills/en-history.json` |
| Taxonomy inputs + rubric | `taxonomy-input.mjs`, `RUBRIC.md` | `output/translation-skills/taxonomy/*.in.json` → `*.out.json` |
| Gold sets (dev / sealed test) | `build-gold-sets.mjs` | `gold/<lang>-dev.json`, `gold/<lang>-test.json`, `gold/LOCK.json`, `gold/EXCLUSIONS.json` |
| SA Sesotho orthography (hard check) | `st-orthography.mjs` | `rules/st-orthography.json` — 13 rules, each backed by NCHLT GOV-ZA + the Constitution |
| Weather + safety word lists | `build-wordlists.mjs` | `wordlists/<lang>.json` — every term checked against Leipzig / Constitution / Autshumato |
| Checker (a) blind back-translation (Claude) | the 2026-09-19 check | `review/translation-check-data.json` |
| Checker (b) blind back-translation (Sol) | `sol-backtranslate.mjs` | Sol's own brief, never shown the English, capped; spend in `output/translation-skills/sol/usage.jsonl` |
| Judge (English vs English) | `JUDGE.md` | the same judge scores both back-translations, so the checkers differ only in the back-translator |
| Checker (c) automatic scorer | — | waits for Al's download permission (see below) |
| Checker (d) rule checks | `rule-checks.mjs` | SA Sesotho spelling, numbers and units, lang-check, safety words, reversed light advice |
| Calibration page (Afrikaans, blind) | `build-calibration-page.mjs` | `review/af-calibration.html`, `review/af-calibration-keys.json` |

## 3. The gold sets are sealed

`gold/LOCK.json` records the SHA-256 of each test file. The split is a hash of the English line, the
same for all four languages, so no English line in any test set appears in any dev set. Only the
final scorer reads the test files and it prints aggregates. The skills are built from dev files and
external reference text only. `gold/EXCLUSIONS.json` lists human references found to be wrong after
sealing (st-fb-0402: the June Sesotho reviewer's own `tlosa mabone`, the origin of st-0870).

## 4. Automatic scorers (checker c) — coverage, confirmed from the model cards (2026-09-23)

| Model | Human-judgment training covers | Licence | Use here |
|---|---|---|---|
| SSA-COMET (`McGill-NLP/ssa-comet-mtl`) | English→isiZulu (among 12 languages) | Apache-2.0 | isiZulu only |
| AfriCOMET (`masakhane/africomet-stl-1.1`) | English→isiXhosa (among 13 pairs) | Apache-2.0 | isiXhosa only |
| Either | Sesotho: dropped from SSA-COMET training for low annotator agreement; Afrikaans: not trained | — | not used for st or af |

Both need torch + unbabel-comet and a ~2.3 GB checkpoint each; this machine has no CUDA, so they run
on CPU. Nothing is downloaded until Al says yes.
