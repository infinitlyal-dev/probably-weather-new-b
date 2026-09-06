# Multilingual translation QC — evaluate, research, rebuild

**Date:** 2026-09-06 · **Branch:** main · **Scope:** af / zu / xh / st QC skills, no app code touched
**Deliverables:** `scripts/lang-check.mjs` (+ `scripts/lang-check/`), the four rewritten `.claude/skills/*-qc/SKILL.md`, `scripts/lang-check/gold-set.json`, `scripts/lang-check/exam-result.md`, `review/lang-check-triage-{af,zu,xh,st}.md`, `tests/lang-check.test.js`

## The short version

- The four May-2026 QC skills were heuristic checklists. Coded up and run against 3 625 items of native ground truth, they caught **1% of known-bad isiZulu, 0% of isiXhosa, 8% of Sesotho and 21% of Afrikaans**, and could not see the wrong-sense class at all in three of the four languages.
- Twelve public resources turned out to be reachable and cacheable from this machine: kaikki/Wiktionary extracts, the Leipzig corpora, SADiLaR's NCHLT annotated corpora, morphological annotations, Autshumato word lists, Bukantswe, the African Wordnets, the zu/st Wiktionaries, the zu/xh/st Wikipedias, the Constitution in all five languages and the Hunspell dictionaries. Pharos, the WAT, VivA, CTexT's online tools, isiZulu.net, eBible (no zul/xho/sot/afr) and the news sites (JS-rendered behind Cloudflare) are not usable programmatically.
- The rebuilt checker passed the validation exam on every language: wrong-sense recall 0→43% (zu), 0→62% (xh), 8→54% (st), 6→50% (af); wrong-language recall 5→84%, 0→100%, 0→95%, 11→100%; precision held or rose in all four (50→55%, 0→36%, 12→39%, 37→64%).
- Run on the 883-line Afrikaans set: **27 lines need a human, 4 high** — and the four high ones are pre-existing bank lines with a dropped `ë`/`ê`, not the new transcreations. The provisional zu/xh/st fills already in the bank were triaged too (56 / 105 / 91 to a reader).
- Three things the corpora disagree with the repo's own language packs about are listed under "Catches" — they need Al or a native, not the tool.

---

## Phase 1 — baseline: how good were the old skills?

### Gold set (`scripts/lang-check/build-gold.mjs` → `gold-set.json`, 3 631 items, 3 625 scored)

| | good | bad | bad classes scored |
|---|---|---|---|
| zu | 503 native-bank + 90 weak (UI labels) | 94 (+11 native rewrites, informational) | wrong-sense 28, wrong-language 19, untranslated 24, boundary 19, morphology 2, register 2 |
| xh | 518 + 91 weak (67 `future_review` rows) | 79 (+270 rewrites) | wrong-sense 21, wrong-language 18, untranslated 17, spelling 4, boundary 19, unattested 20 (weak) |
| st | 520 + 89 weak | 89 (+81 rewrites) | wrong-sense 26, wrong-language 19, untranslated 18, spelling 20, calque 4, register 1, wrong-dialect 1 |
| af | 990 + 90 weak | 75 (+10 rewrites) | wrong-sense 18, wrong-language 18, untranslated 17, diacritic 18, spelling 3, calque 1, capitalisation 1 |

Sources: `lang-packs/<l>/corpus-confirmed.jsonl` (the native-reviewed banks as seeded 2026-07-17, before the provisional fills), the before/after pairs of every native-review commit (`d51b173` zu, `ecdfe11` + `a38c32d` st via `review/sesotho-replacements.txt`, `0510415` xh via `review/xhosa-apply.csv`, `2fe4972`/`0519c3f`/`cb0fa87` af), every correction in `TRIAGE_NATIVE_REVIEW.md`, `LANGUAGE_AUDIT_PHASE3_REPORT.md`, `I18N_CROSS_LANGUAGE_AUDIT.md`, the two review addenda and the packs' `errors-observed.md`, plus adversarial mutations of native-good lines: a real word of the wrong sense (`imvu` for `imvula`, `wond` for `wind`), a Zulu function word in a Xhosa line and vice versa, Setswana/Sepedi forms in Sesotho, Dutch in Afrikaans, a stripped diacritic, an English word left in, two words fused. Every substitution is listed in the builder; adversarial pairs whose substitute the corpora do not attest were excluded from scoring so they could not be caught as mere unknown words. The GPT-5.5 audit commit `c7715c4` is not treated as ground truth (the Sesotho reviewer reverted part of it).

### Baseline (`scripts/lang-check/baseline.mjs` = the four SKILL.md `check()` procedures as code)

| | precision | recall | wrong-sense | wrong-language | cannot see at all |
|---|---|---|---|---|---|
| zu | 50% (1 TP / 1 FP) | 1% | 0% | 5% | wrong-sense, untranslated, boundary, morphology, register |
| xh | 0% | 0% | 0% | 0% | everything scored |
| st | 12% | 8% | 8% | 0% | wrong-language, spelling, calque, register, wrong-dialect |
| af | 37% | 21% | 6% | 11% | spelling, calque |

The skills' only real detector was cross-language exact match (which finds `Son` in the zu Sunday slot) and, for Afrikaans, the diacritic traps and the mid-sentence-capital rule. The Sesotho click-consonant rule produced 52 false positives on native lines (`ke`, `ka`, `ha`… are not clicks). This matches what the skill headers themselves admitted.

---

## Phase 2 — resources that answer from this machine

Verified 2026-09-06 with fetches from this machine (UA `ProbablyWeather-langcheck/0.1`). Cached under `.lang-check-cache/` (git-ignored, ~600 MB unpacked); `scripts/lang-check/fetch-corpora.mjs` reproduces it. Licences are echoed into every index by `lib/build-index.mjs`.

| Resource | Reachable | What was cached | Licence / limits |
|---|---|---|---|
| **kaikki.org** machine-readable English Wiktionary | yes, plain HTTPS download | Zulu 3 330 lemmas / 502 058 forms (full concord tables) / 60 MB; Xhosa 3 462 lemmas; Sotho 669 lemmas (thin); Afrikaans 9 909 lemmas, 617 example sentences | CC BY-SA (Wiktionary); no rate limit met |
| **Leipzig Corpora Collection** (`downloads.wortschatz-leipzig.de`) | yes for the tarballs; the website itself sits behind an Anubis bot-wall, and the REST API (`api.wortschatz-leipzig.de`) 404s for these corpora | zul_community_2017 (142 577 sentences), zul_mixed_2014_100K, zul-za_web_2018_30K, xho_community_2017 (23 993), xho-za_web_2018_30K, sot_community_2017 (9 773), sot-za_web_2018_10K, afr_mixed_2019_300K (300 000), tsn_community_2017, nso-za_web_2018_10K — each with word frequencies, inverted index and neighbour co-occurrence | LCC terms (CC BY-NC per their download page; the terms page could not be re-read this session because of the bot-wall — verify before commercial reuse) |
| **SADiLaR repository** (DSpace 7 REST at `/server/api`) | yes: search, item metadata, bundle and bitstream download without login | NCHLT Annotated Text Corpora for zu/xh/st/af/tn/nso (≈46–70k tokens each, token/lemma/POS in `.xls`, running text inside `LARA2` containers — both decoded); SADiLaR-II converted morphological annotations zu/xh/st (45–74k segmented tokens); Autshumato multilingual word & phrase lists (EN↔ all 10); Bukantswe Sesotho–English dictionary (10 072 entries); African Wordnet zu/xh (LMF XML, 6 518 / 9 515 lemmas). The Afrikaanse Speltoetser 3.1 item has no downloadable bitstream; CTexTools 2 is a 265 MB Windows installer (not used) | NCHLT/Autshumato CC BY 2.5 ZA (DAC + CTexT); morph data + Wordnet CC BY 4.0; Bukantswe CC BY 3.0 ZA |
| **NWU CTexT** online tools (ZulMorph, spellcheckers) | **no** — `ctext.nwu.ac.za` timed out | — | — |
| **zu / st Wiktionary** (MediaWiki API) | yes; xh.wiktionary has 0 articles, af.wiktionary 29 827 (not cached — kaikki af covers it) | zu 1 369 pages, st 1 579 pages (each st entry gives SA and Lesotho orthography, English gloss, noun class, an example) | CC BY-SA; polite 300 ms pacing used |
| **zu / xh / st Wikipedia** (dumps.wikimedia.org) | yes | pages-articles dumps, stripped to text: 13 100 / 2 983 / 2 568 articles | CC BY-SA |
| **Constitution 1996** (justice.gov.za PDFs) | yes, all official languages | zul, xho, sot, afr, eng → text via PyMuPDF (182–212 pages each). Used for attestation and examples; the section-numbered alignment across languages is possible but not implemented | Government publication |
| **Hunspell** (LibreOffice/dictionaries on GitHub) | yes | af_ZA (100 693 stems → 148 819 forms after affix expansion; 3 351 with diacritics), nl_NL (Dutch contamination), en_US (English contamination). zu_ZA exists as a hyphenation file only | LGPL 2.1 / BSD-CC BY / MIT |
| **HuggingFace** datasets/models API | yes | not cached: no Nguni/Sotho morphological analyser exists there; fill-mask models (Davlan xlm-r zulu/xhosa) would need torch, which is not installed | — |
| **GitHub** | yes (search API unauthenticated, 10 req/min) | no usable morphological analyser: three student repos (Morfessor isiZulu spell checker, isiXhosa error detector) without licences | — |
| **OPUS API** (`opus.nlpl.eu/opusapi`) | responds but returns only the request path — unusable this session | — | — |
| **eBible.org** | reachable; **no Bible text for zul/xho/sot/afr** (Bible Society of SA texts are not on it) | — | — |
| **Pharos Aanlyn, WAT (woordeboek.co.za), VivA** | reachable but login-walled, no API | — | — |
| **isiZulu.net** | gone (HTTP 410) | — | — |
| **Isolezwe, I'solezwe lesiXhosa** | homepages reachable, JS-rendered behind Cloudflare; no article links or RSS in the HTML | — | not crawlable without a browser |
| **SABC News Sesotho category** | reachable, server-rendered links | not cached (headlines are English) | — |
| **gov.za/zu, /xh, /st, /af** | reachable, server-rendered | not cached — the localised pages hold navigation chrome, not running text | — |
| Wikidata, Tatoeba, Glosbe | reachable; Tatoeba has a handful of zul sentences, Glosbe has no public API | not used | — |

**Morphology:** no packaged Nguni/Sotho analyser is reachable. The checker's morphology comes from kaikki's inflection tables (zu), the SADiLaR-II segmentations (noun-class prefixes, subject/object/possessive concords with counts) and the NCHLT class-tagged POS (`N09`, `CPOSS03`…).

---

## Phase 3 — the rebuilt checker

`node scripts/lang-check.mjs --lang zu --en "…" --text "…"` · `--file lines.json` · `--build-index` · `--sources`.

Per line it returns `{ confidence, action: pass | triage | triage-high, findings[], coverage, back }`; every finding carries `evidence` with the source, the frequency and an attested sentence.

- **(a) lexical** — each content word resolved (exact form → hyphenated loan → locative/copulative prefix stripped → stem attested under another concord; Afrikaans solid compounds). SA loans with fused class prefixes (`namabakkie`, `neebakkie`, `i-Carte`) recognised through the Afrikaans/English indexes and the source line. Unknown words: closest attested form, and a note when the word appears only in this app's own copy. The packs' `banned-words.json` (native rulings) applied: hard = HIGH, soft = MEDIUM.
- **(b) morphological** — Nguni noun class ↔ subject concord on the unambiguous concords only, with the expected form's own attestation quoted; fused boundaries (unattested word = two attested words); Sesotho NOUN + class concord as a low note; Afrikaans diacritics by frequency ratio plus the documented traps, the closing `nie`, AWS weekday abbreviations, mid-sentence capitals.
- **(c) semantic** — back-translation through glosses (walking plural→singular and concords), compared with the English source through a weather-domain synonym table; a time-of-day clash rule (today≠tonight — the documented badge bug); dictionary-expected target words checked for presence; a near-miss rule for a real word one to three letters from the expected word with a different meaning (`inkuku` for `inkungu`, `isijele` for `ijezi`), guarded against inflections of the same lemma; Leipzig collocation evidence quoted when the doubtful word does co-occur with the line's other words.
- **(d) contamination** — words attested only in a sibling language (zu↔xh, tn/nso/zu/xh→st, nl→af) or only in English, with cognate awareness: Nguni-pair attestation is weak evidence (the Xhosa corpus is a quarter of the Zulu one), Sotho-Tswana and Dutch attestation is strong; function-word markers (`ndiya`/`ngiya`, `gore`/`hore`, `niet`/`nie`) weighed by frequency ratio; core English weather words left in are MEDIUM even when the source has them, brands and SA register words never above LOW.

Confidence is the sum of evidence weights (high 0.5, medium 0.25, low 0.05), capped at 1; notes alone never send a line to a human. Attestation from the app's own banks is shown but never counts as external evidence. Nothing is auto-applied.

---

## Phase 4 — validation exam (`scripts/lang-check/exam.mjs`, threshold 0.25)

| lang | precision old → new | recall old → new | wrong-sense | wrong-language | untranslated | boundary | diacritic / spelling | calque |
|---|---|---|---|---|---|---|---|---|
| zu | 50% → **55%** | 1% → **63%** | 0 → 43% | 5 → 84% | 0 → 67% | 0 → 79% | — | — |
| xh | 0% → **36%** | 0% → **82%** | 0 → 62% | 0 → 100% | 0 → 100% | 0 → 84% | spelling 0 → 25% | — |
| st | 12% → **39%** | 8% → **85%** | 8 → 54% | 0 → 95% | 28 → 100% | — | spelling 0 → 100% | 0 → 100% |
| af | 37% → **64%** | 21% → **77%** | 6 → 50% | 11 → 100% | 12 → 94% | — | diacritic 61 → 67%, spelling 0 → 100% | 0 → 0% |

Pass rule from the brief — recall up on wrong-sense and wrong-language without dropping precision — **holds in all four languages**. Two honest qualifications:

- The zu baseline precision of 50% is one true positive against one false positive; the rebuilt 55% is 59 against 48. The old skill's precision was not a property, it was an absence of flags.
- Wrong-sense recall on zu (43%) and af (50%) is where the tool is weakest: what it misses is `Kunamafu` (partly cloudy) for "Overcast" — the gloss is "cloud" —, register calls (`Kubanda` vs `Makhaza`), number agreement that is attested either way (`Isiphepho siyeza`), a calque of two correct words (`Verwyder onlangs`), and Afrikaans homographs mid-sentence (`se`/`sê`, `le`/`lê`). Full miss and false-positive lists are in `exam-result.md` (`--verbose`).

Several "false positives" on native-good lines are real catches the gold set could not know about: Al's own `reen`/`wereld` lines (below), `Petrichor` capitalised as English, `seaduma` (the reviewer's thunder word) unattested outside this app while `seadumo` is.

---

## Phase 5 — triage lists

| set | lines | need a human | high | doubt types | file |
|---|---|---|---|---|---|
| Afrikaans bespoke set (533 new + 350 reused) | 883 | **27** | 4 | morphology 15, lexical 11, contamination 3, semantic 2 | `review/lang-check-triage-af.md` |
| isiZulu provisional fills (pending native confirm) | 443 | 56 | 3 | semantic 30, lexical 24, contamination 3 | `review/lang-check-triage-zu.md` |
| isiXhosa provisional fills | 404 | 105 | 22 | lexical 87, semantic 28, morphology 5 | `review/lang-check-triage-xh.md` |
| Sesotho provisional fills | 434 | 91 | 21 | lexical 41, semantic 33, contamination 32 | `review/lang-check-triage-st.md` |

**Afrikaans, the four HIGH items — all pre-existing bank copy, none from the 533 new lines:**

1. `cloudy#21` "Nie Troufoto weer nie. Nie die einde van die **wereld** nie." — `wêreld` 3182× vs `wereld` 249× (also the AF-1 item already in triage).
2. `cloudy#24` "Ten minste **reen** dit nie. Dis die standaard." — `reën` 530× vs `reen` 62×.
3. `rain-possible#12` "**Reen**? Moontlik. Sal ek my lewe daar op wed? Nooit."
4. `rain#35` "Die verkeer het pas onthou daar is n ding soos **reen** bestaan weer."

The 23 lower items among the new lines are one thirty-second read each: nine clauses with `Niemand/Geen/niks` where the tool could not find the closing `nie` (several are correct Afrikaans with the `nie` after a comma — worth a glance, not a rewrite), four unattested compounds (`bygevul` ×3, `veertiggraaddag`, `ysbomme`, `bedonerd`), one English word left in (`sags`), two sense doubts.

The isiZulu, isiXhosa and Sesotho transcreations Baken will produce do not exist yet (the triage file says "not yet started"); the command for them is `node scripts/lang-check/triage.mjs --lang zu --file <set.json>` with `[{ "en", "text", "key" }]`. The provisional fills were run instead so the native batches can start where the machine genuinely cannot decide. Highlights: st `Ho bata bosigo`-type Setswana forms (`loga`, `bosigo`), `'mala` (entrails) two letters from `mebala` (colour), `fetola` (change) for "turns"; xh 22 high items that are almost all unattested tokens in a thin corpus (`ifefa`, `belisel'`, `Abaqubhi` vs `abaqhubi`, `lwesinki`, `bwenza` vs `benza`); zu `amaphiksha`, `Ungakuthembi`, `i-night shift`.

---

## Catches the corpora make against the repo's own files

1. **`imbatata`.** `lang-packs/zu/lexicon-protected.md` row #1 calls it an AI-invented non-word that never shipped and builds the packs' prime rule on it. The live bank contains "Imbatata emgwaqeni beyiwumqondo omubi." for "Flip-flops on tar was a mistake." — introduced by the *native reviewer's* corrections in `d51b173` (2026-05-30). The corpora attest `imbatata` only in this app and `imbadada` (sandals) once. Either the reviewer's line or the pack's origin story is wrong; a native has to say which.
2. **`iqanda` = zero.** The zu addendum flags `iqanda` (egg) as misused for "zero". Autshumato lists `iqanda` and `unothi` as the isiZulu for *zero* (egg/duck = nought). The flag may itself be wrong.
3. **The Sesotho orthography labels are inverted.** `lang-packs/st/lexicon-protected.md` says "SA-Sesotho spelling — `joalo`/`joale` (not Lesotho `jwalo`/`jwale`)". In the SA web and community corpora `jwale` 907× / `jwalo` 2040× against `joale` 85× / `joalo` 249×; `lehodimo` 131× vs `leholimo` 76×; `tjhesa` 37× vs `chesa` 16×. The forms the native reviewer ruled for are the Lesotho orthography. The tool enforces the reviewer's rulings as the house standard and says so in each finding; whether the house standard should be the SA orthography is Al's decision.
4. **Al's own diacritics.** Four bank lines drop `ë`/`ê` (above). They are his lines, so they go to him as questions.
5. **`seaduma`.** The reviewer's word for thunder is unattested in every external Sesotho source; `seadumo` is the attested form (Autshumato, Leipzig).

---

## What the tool still cannot see (also stated in each SKILL.md)

Whether a joke lands; a real word used in a sense the dictionary also lists (calques of correct words); register and stiffness; sense shifts inside one weather domain (`Kunamafu` for overcast); agreement that is attested either way; anything the thin isiXhosa and Sesotho corpora simply do not hold (an unattested word there is a question, not a verdict); Afrikaans homographs mid-sentence; a wrong word the dictionaries do not gloss at all (`amafindo` is caught only because it is now in the pack's soft list). Low confidence defers to `TRIAGE_NATIVE_REVIEW.md`; nothing is auto-applied.

## Reproduce

```bash
node scripts/lang-check/fetch-corpora.mjs      # ~600 MB into .lang-check-cache/ (python + pymupdf + xlrd for two conversions)
node scripts/lang-check.mjs --build-index      # ~35 s, writes .lang-check-cache/index/*.json
node scripts/lang-check/build-gold.mjs         # gold-set.json from the repo's native rulings
node scripts/lang-check/exam.mjs --verbose     # exam-result.md / .json
node scripts/lang-check/triage.mjs --lang af   # review/lang-check-triage-af.md
npx vitest run tests/lang-check.test.js        # regression guard (skips without the cache)
```

Pack files changed this session: `lang-packs/st/banned-words.json` (+ `Leholimo le lebe`, `Modumo wa leholimo` as hard, both already in `errors-observed.md`), `lang-packs/zu/banned-words.json` (+ soft `amafindo`, `hlanzekile`), `lang-packs/xh/banned-words.json` (+ soft `iimphuphuma`, `kufukufuku`) — machine-readable copies of rulings the packs already document in prose.

---

## Rulings 2026-09-06 (Al) and what was done with them

| Ruling | Done |
|---|---|
| **Keep `imbatata`, fix the pack story** | `lang-packs/zu/lexicon-protected.md` row #1 and `lang-packs/README.md` now tell it straight: the word is the native reviewer's (d51b173), no external corpus attests it, Al keeps it. The rule survives its example. `lang-packs/zu/banned-words.json` gained an `allow` list the checker honours (ruled words count as attested, with the ruling cited). |
| **Drop the `iqanda` zero flag** | Removed from `banned-words.json`, `errors-observed.md`, `PACK.md`, `lexicon-protected.md`, `CHECKER_PROMPT.md`; the fog[3] bank line stands. |
| **Sesotho: SA orthography, flip the labels, re-check the bank** | Pack labels corrected in `PACK.md`, `lexicon-protected.md`, `errors-observed.md`, `harvest-notes.md`, `banned-words.json` (`joalo`/`joale` now banned, `tjhesa`/`mohodi` unbanned). The whole st bank (959 lines in `weather-copy.js` + 32 `T` strings in `app.js`) re-checked against the SA corpora using the 1 337 SA/Lesotho pairs in st.wiktionary plus the derived rules (`li→di`, `oa→wa`, `ea→ya`, `oe→we`, `kh→kg`, `ch→tjh`, `tš→tsh`); a spelling is proposed only when the SA form is attested at least three times and at least as often as the Lesotho form. Result: **515 proposals carrying 697 spelling changes** (leholimo→lehodimo 94, moea→moya 37, tsoa→tswa 23, moholi→mohodi 18, joalo→jwalo 17 …) in `review/lang-check-sheet-st.html`. |
| **Fix the four AF diacritics** | `wêreld`, `reën` ×3 in `assets/weather-copy.js`, the copy splits, `review/af-worklist.json`, the four `corpus-confirmed.jsonl` files and the regenerated side-by-side sheet. `Troufoto` stays open. A fifth bank line ("Die hond staar na die **reen**…") has the same defect and is not in the 883 set — not touched, flagged in `TRIAGE_NATIVE_REVIEW.md`. |
| **Propose corrections only on strong evidence, one accept/reject sheet per language** | `scripts/lang-check/build-sheet.mjs` → `review/lang-check-sheet-{zu,xh,st}.html` (+ `lang-check-proposals-<l>.json`). Strong = a pack ban with its fix, a pack wrong-word with a protected-lexicon fix, a real typo (edit inside the word, attested ≥ 50×, not English noise, 7+ letters), or an SA orthography form as above. Two candidate rules were tried and dropped after sampling: fused-boundary splits (`lingenadrama` is correct as one word) and sibling-language swaps (`omile` is correct). **zu: 1 proposal** (`baphambe`→`bahambe`), **xh: 0** (its 105 triaged lines are coverage gaps, all left to the reader), **st: 515**. Each sheet exports `lang-check-decisions-<l>.json`; nothing is applied without it. |
| **Every future zu/xh/st transcreation through lang-check before wiring** | `scripts/apply-provisional-drafts.mjs` now runs the gate itself (`scripts/lang-check/lib/gate.mjs`): a triage-high draft is held for a native and recorded in the debt ledger as `held-lang-check`; the run refuses without the corpus cache unless `--skip-lang-check` is passed explicitly. Rule 9 in `CLAUDE.md`, step 4b in `lang-packs/README.md`, rule 7 in the pw-ui-copy skill. `tests/lang-check.test.js` proves the gate holds a Setswana line and passes a clean one. |

Exam after the rulings (the Lesotho-spelling lines are no longer scored either way): precision 54 / 36 / 38 / 67 %, recall 62 / 82 / 82 / 77 %, wrong-sense 38 / 62 / 54 / 50 %, wrong-language 84 / 100 / 95 / 100 % — still a pass in all four. The 883 Afrikaans lines re-run: 23 to triage, 0 high.
