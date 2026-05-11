# Cross-language i18n audit — Probably Weather

**Date:** 2026-05-11 (evening, after AF day-abbreviations fix)
**Branch:** `main`, HEAD `1b35589`, SW `pw-v2026-05-11-011`
**Scope:** read-only. No code changes. Triage list for native-speaker review.

## How this was produced

Walked every 5-language i18n block in:

- `assets/app.js` — the `T` object (`nav`, `screens`, `search`, `settings`, `sidebar`, `weather`, `badges`, `days`, `capeDr`, `toasts`, `misc`, plus the imported `heroLabels`, `headlines`, `witty` from `weather-copy.js`)
- `assets/install.js` — the `INSTALL_T` object (banner / iOS modal / iOS Chrome handoff / landing page / footer copy)
- `assets/refresh-behaviour.js` — the `PTR_COPY` object (pull-to-refresh states)
- `assets/weather-copy.js` — `WEATHER_COPY.heroLabels`, `headlines`, `witty`

For every leaf string key, compared the five language values (`en` / `af` / `zu` / `xh` / `st`) and flagged any pair that matched.

### Caveats / non-trivial cases

- **`WEATHER_COPY.witty` pools were spot-checked, not exhaustively diffed.** Each pool is an array of ~30 lines × 5 languages = ~150 strings per condition, and each language's array contains culturally distinct content (English uses "Carte Blanche" / "load shedding" / "Eskom"; Afrikaans uses "donder" / "beurtkrag"; Zulu uses Zulu idioms etc.). No two witty arrays appear wholesale-identical across languages on a spot check. If a single line within a pool was accidentally cross-pasted, this audit would miss it — would need a dedicated witty-pool review.
- **`INSTALL_T.whyBullets`** is an array of 3 bullets per language. Spot-checked — all five language arrays contain distinct content. No duplicates.
- **`assets/language-preferences.js` `LANGUAGE_OPTIONS`** holds language names in their native form (`English` / `Afrikaans` / `isiZulu` / `isiXhosa` / `Sesotho`) — single-string-per-language, not a 5-language block, so no cross-language comparison applies.
- **`T.settings.wittyIn`** has values identical to `T.settings.language` (`{ en: "Language", af: "Taal", zu: "Ulimi", xh: "Ulwimi", st: "Puo" }`). Different KEYS, same values across all 5 languages. Looks like a stale duplicate key — flagged at the bottom under "Structural notes" rather than as a translation bug.
- **Intra-language same-word-different-key matches** were noted but not pursued here. Example: `T.weather.probably.af` = `T.weather.likely.af` = `"Waarskynlik"`. In Afrikaans the same word covers both English senses, so this is likely correct semantic merging rather than a translation bug. Same for Sesotho `"Ho ka etsahala"` covering both `possible` and `likely`. Flagged briefly at the bottom for completeness.

---

## Likely translation bugs — Zulu (zu)

Found **34 rows** where the Zulu value matches another language. Many overlap with Xhosa (Nguni-family cognates — see Xhosa section too). Suspect rows are listed where the duplicate is too long or topic-specific to be a plausible cognate, OR where the Zulu value matches an Afrikaans abbreviation (the canonical `zu.sun = "Son"` case).

| Key | EN value | ZU value (matches) | Suggested action |
|---|---|---|---|
| `days.sun` | Sun | "Son" (same as `af.sun`) | **Almost certainly copy-paste from Afrikaans.** Zulu Sunday is iSonto — expected abbreviation closer to "iSon" or "Son" rendered differently. Get correct Zulu abbreviation. |
| `days.wed` | Wed | "Tha" (same as `xh.wed`) | Zulu Wednesday is uLwesithathu — "Tha" is plausibly the third-letter abbreviation, matching Xhosa Lwesithathu. Confirm with native speaker. |
| `days.thu` | Thu | "Sin" (same as `xh.thu`) | Zulu Thursday is uLwesine; Xhosa is Lwesine. Both end in "sine" so "Sin" is plausible in both. Confirm. |
| `search.edit` | Edit | "Hlela" (same as `xh.edit`) | Common Nguni verb. Plausibly correct in both, but worth confirming the Zulu UI button label is conventionally "Hlela." |
| `search.done` | Done | "Kwenziwe" (same as `xh.done`) | Plausibly correct in both. Confirm. |
| `settings.display` | Display | "Ukubonisa" (same as `xh.display`) | Plausibly correct in both. Confirm. |
| `sidebar.sources` | Sources | "Imithombo" (same as `xh.sources`) | Both use the Nguni word for "wells/sources." Plausibly correct, confirm. |
| `weather.unlikely` | Unlikely | "Akunakwenzeka" (same as `xh.unlikely`) | Plausibly correct in both. Confirm. |
| `weather.high` | High | "Phezulu" (same as `xh.high`) | Plausibly correct cognate. Confirm. |
| `weather.veryHigh` | Very High | "Phezulu Kakhulu" (same as `xh.veryHigh`) | Plausibly correct cognate. Confirm. |
| `weather.sunrise` | Sunrise | "Ukuphuma kwelanga" (same as `xh.sunrise`) | Plausibly correct cognate. Confirm. |
| `weather.day` | Day | "Usuku" (same as `xh.day`) | Both languages use "usuku." Plausibly correct. |
| `weather.wind` | Wind | "Umoya" (same as `xh.wind`) | Both languages use "umoya." Plausibly correct. |
| `weather.rain` | Rain | "Imvula" (same as `xh.rain`) | Both languages use "imvula." Plausibly correct. |
| `badges.rainy` | Rainy | "Imvula" (same as `xh.rainy`, also same as `weather.rain` in both) | "Imvula" means rain (noun). For an adjective "Rainy" / "Rainy day badge" the form might want to differ — check whether Zulu uses "ngemvula" or similar adjective form. |
| `badges.highUV` | High UV | "UV Ephezulu" (same as `xh.highUV`) | Plausibly correct cognate. Confirm. |
| `badges.cold` | Cold | "Kubanda" (same as `xh.cold`) | Plausibly correct cognate. Confirm. |
| `toasts.removed` | Removed | "Isusiwe" (same as `xh.removed`) | Plausibly correct cognate. Confirm. |
| `misc.loading` | Loading… | "Iyalayisha…" (same as `xh.loading`) | "Loading" loaned in both languages. Plausibly correct. |
| `misc.share` | Share | "Yabelana" (same as `xh.share`) | Plausibly correct cognate. Confirm. |
| `misc.shareIn` | in | "e-" (same as `xh.shareIn`) | Locative prefix in both Nguni languages. Plausibly correct. |
| `heroLabels.hail` | Hail | "Isichotho" (same as `xh.heroLabels.hail`) | Same noun in both Nguni languages. Plausibly correct. Confirm. |
| `heroLabels.cold` | Chilly | "Kubanda" (same as `xh.heroLabels.cold`, and `badges.cold`) | See `badges.cold` above. |
| `heroLabels.uv` | High UV | "I-UV ephezulu" (same as `xh.heroLabels.uv`) | Plausibly correct cognate. Confirm. |
| `heroLabels.clear` | Pleasant | "Kumnandi" (same as `xh.heroLabels.clear`) | Plausibly correct cognate. Confirm. |
| `headlines.hail` | Hail incoming. | "Isichotho siyeza." (same as `xh.headlines.hail`) | Plausibly correct in both. Verify the verb form is natural Zulu. |
| `headlines.rain` | Rain's here. | "Imvula ikhona." (same as `xh.headlines.rain`) | Plausibly correct in both. Verify. |
| `headlines.cold` | It's chilly. | "Kuyabanda." (same as `xh.headlines.cold`) | Plausibly correct cognate. Confirm. |
| `headlines.uv` | UV's hectic. | "I-UV iphezulu." (same as `xh.headlines.uv`) | Plausibly correct cognate. Confirm. |
| `INSTALL_T.bannerInstall` | Install | "Faka" (same as `xh.bannerInstall`) | Common Nguni verb for "put in." Plausibly correct. |
| `INSTALL_T.landingHero` | Install Probably Weather | "Faka i-Probably Weather" (same as `xh.landingHero`) | Plausibly correct in both. Confirm tone for landing page. |
| `INSTALL_T.footerInstallLink` | Install Probably Weather | "Faka i-Probably Weather" (same as `xh.footerInstallLink`) | Same as above. |
| `INSTALL_T.resetInstallState` | Reset install state | "Sula idatha yokufaka" (same as `xh.resetInstallState`) | Plausibly correct in both. Confirm — "data" is loanwordy in both. |
| `nav.home` | Home | "Ikhaya" (same as `xh.home`) | Plausibly correct cognate ("ikhaya" = home in both). Confirm tone for a nav label. |

---

## Likely translation bugs — Xhosa (xh)

Mirror of the Zulu list. Most rows above also appear here — included once below for the Xhosa-speaker pass. If the Zulu pass already confirmed a row is the correct cognate, the Xhosa pass can quickly tick the same row.

| Key | EN value | XH value (matches) | Suggested action |
|---|---|---|---|
| `days.wed` | Wed | "Tha" (same as `zu.wed`) | Xhosa Wednesday is uLwesithathu → "Tha" abbreviation plausible. Confirm. |
| `days.thu` | Thu | "Sin" (same as `zu.thu`) | Xhosa Thursday is Lwesine → "Sin" plausible. Confirm. |
| `search.edit` | Edit | "Hlela" (same as `zu.edit`) | Confirm Xhosa UI verb. |
| `search.done` | Done | "Kwenziwe" (same as `zu.done`) | Confirm. |
| `settings.display` | Display | "Ukubonisa" (same as `zu.display`) | Confirm. |
| `sidebar.sources` | Sources | "Imithombo" (same as `zu.sources`) | Confirm. |
| `weather.unlikely` | Unlikely | "Akunakwenzeka" (same as `zu.unlikely`) | Confirm. |
| `weather.high` | High | "Phezulu" (same as `zu.high`) | Confirm. |
| `weather.veryHigh` | Very High | "Phezulu Kakhulu" (same as `zu.veryHigh`) | Confirm. |
| `weather.sunrise` | Sunrise | "Ukuphuma kwelanga" (same as `zu.sunrise`) | Confirm — should this be "Ukuphuma" (Xhosa) or "Ukuphuma" (Zulu)? Both spell same. Plausibly correct. |
| `weather.day` | Day | "Usuku" (same as `zu.day`) | Confirm. |
| `weather.wind` | Wind | "Umoya" (same as `zu.wind`) | Confirm. |
| `weather.rain` | Rain | "Imvula" (same as `zu.rain`) | Confirm. |
| `badges.rainy` | Rainy | "Imvula" (same as `zu.rainy`) | See note in Zulu section about adjective vs noun form. |
| `badges.highUV` | High UV | "UV Ephezulu" (same as `zu.highUV`) | Confirm. |
| `badges.cold` | Cold | "Kubanda" (same as `zu.cold`) | Confirm. |
| `toasts.removed` | Removed | "Isusiwe" (same as `zu.removed`) | Confirm. |
| `misc.loading` | Loading… | "Iyalayisha…" (same as `zu.loading`) | Confirm. |
| `misc.share` | Share | "Yabelana" (same as `zu.share`) | Confirm. |
| `misc.shareIn` | in | "e-" (same as `zu.shareIn`) | Confirm. |
| `heroLabels.hail` | Hail | "Isichotho" (same as `zu.heroLabels.hail`) | Confirm. |
| `heroLabels.cold` | Chilly | "Kubanda" (same as `zu.heroLabels.cold`) | Confirm. |
| `heroLabels.uv` | High UV | "I-UV ephezulu" (same as `zu.heroLabels.uv`) | Confirm. |
| `heroLabels.clear` | Pleasant | "Kumnandi" (same as `zu.heroLabels.clear`) | Confirm. Verify "Kumnandi" reads naturally for "Pleasant" weather in Xhosa. |
| `headlines.hail` | Hail incoming. | "Isichotho siyeza." (same as `zu.headlines.hail`) | Confirm. |
| `headlines.rain` | Rain's here. | "Imvula ikhona." (same as `zu.headlines.rain`) | Confirm. |
| `headlines.cold` | It's chilly. | "Kuyabanda." (same as `zu.headlines.cold`) | Confirm. |
| `headlines.uv` | UV's hectic. | "I-UV iphezulu." (same as `zu.headlines.uv`) | Confirm. |
| `INSTALL_T.bannerInstall` | Install | "Faka" (same as `zu.bannerInstall`) | Confirm. |
| `INSTALL_T.landingHero` | Install Probably Weather | "Faka i-Probably Weather" (same as `zu.landingHero`) | Confirm. |
| `INSTALL_T.footerInstallLink` | Install Probably Weather | "Faka i-Probably Weather" (same as `zu.footerInstallLink`) | Confirm. |
| `INSTALL_T.resetInstallState` | Reset install state | "Sula idatha yokufaka" (same as `zu.resetInstallState`) | Confirm. |
| `nav.home` | Home | "Ikhaya" (same as `zu.home`) | Confirm. |

---

## Likely translation bugs — Sotho (st)

No duplicates found between Sesotho and any other language in this audit. (Sesotho is Sotho-Tswana family, unrelated to the Nguni group, so cognate-overlap with Zulu/Xhosa is rare.)

The Sesotho strings still need native-speaker review for **correctness and naturalness** — duplicate detection only catches one class of bug (untranslated copy-paste). It can't tell you if a string is grammatically correct or reads weirdly. Worth a separate native-speaker QA pass on the full Sesotho column.

Two intra-language merges noted for context (not bugs per se):

- `weather.possible.st` = `weather.likely.st` = `"Ho ka etsahala"`. Sesotho appears to use one phrase for both English senses. Worth confirming this is intentional or whether `likely` could use a stronger phrase ("ho tla etsahala" / "ho tla ba teng").

---

## Likely translation bugs — Afrikaans (af)

One row only — the rest of Afrikaans's matches are with English on words Afrikaans actually shares with English (see "Likely legitimate duplicates" section).

| Key | EN value | AF value (matches) | Suggested action |
|---|---|---|---|
| (none — all af matches are legit, see bucket 2) | | | |

The previous canonical case (`af.maa` for Monday) was already fixed in commit `0519c3f` (Ma / Dins / Wo / Don / Vry / Sat / Son). No outstanding Afrikaans-specific issues identified by this audit.

One intra-language merge to confirm:

- `weather.probably.af` = `weather.likely.af` = `"Waarskynlik"`. Afrikaans uses the same word for both senses — likely correct.

---

## Likely legitimate duplicates (review but probably fine)

| Key | Languages affected | Value | Why probably OK |
|---|---|---|---|
| `weather.uv` | all 5 | "UV" | Acronym — universal across languages. |
| `weather.temp` | all 5 | "Temp" | Universal abbreviation / loanword for temperature column header. |
| `weather.later.en` / `weather.later.af` | en + af | "Later ⏰" | Afrikaans actually uses the word "later" (German/Dutch root); identical English spelling. The ⏰ emoji is shared by design. |
| `weather.wind.en` / `weather.wind.af` | en + af | "Wind" | Afrikaans word for wind is "wind" (Dutch/German root). Identical spelling to English. |
| `screens.week.en` / `screens.week.af` | en + af | "Week" | Afrikaans word for week is "week" (capitalised as a screen title). Identical to English. |
| `misc.shareIn.en` / `misc.shareIn.af` | en + af | "in" | Tiny preposition, identical spelling in both languages. Used to form "Share **in** Afrikaans" / "Share **in** Afrikaans" — the language is interpolated next. |
| `days.sat.en` / `days.sat.af` | en + af | "Sat" | Saturday → Sat, Saterdag → Sat. Same abbreviation by coincidence. Confirmed correct in the AF day-abbreviations fix commit `0519c3f` (per spec). |

---

## Empty-string i18n values (related bug class)

Per the spec's request for a related bug class: **scanned for any string that is empty in one language but non-empty in another.**

**None found.** Every leaf i18n key has a non-empty string value in all 5 languages across `T`, `INSTALL_T`, `PTR_COPY`, `WEATHER_COPY.heroLabels`, `WEATHER_COPY.headlines`, and `WEATHER_COPY.witty` (witty arrays were spot-checked — each contains 5+ non-empty strings per language).

---

## Structural notes (not translation bugs, but worth flagging)

1. **`T.settings.wittyIn` is a duplicate key.** Values are identical to `T.settings.language` across all 5 languages (`{ en: "Language", af: "Taal", zu: "Ulimi", xh: "Ulwimi", st: "Puo" }`). Different key, same content. Looks like a stale leftover — possibly from when the "witty in" dropdown was a separate UI control. Worth checking whether `wittyIn` is actually consumed by the rendering code anywhere; if not, the key can be deleted.

2. **`T.badges.rainy` matches `T.weather.rain` in zu and xh** (`"Imvula"` in both). The label "Rainy" (adjective / badge marker) reuses the noun "rain." May read fine ("the day is rain" → "the day has rain") but worth confirming that's natural usage for a UI badge. Same flag applies to the `heroLabels.cold` / `badges.cold` overlap.

3. **`T.weather.probably` vs `T.weather.likely` in Afrikaans and Sesotho.** Same word for both English senses (af: "Waarskynlik", st: "Ho ka etsahala"). Likely correct — both languages naturally merge these — but if the UI ever wants to surface a stronger "likely" (when rain probability is high vs just probable), it's currently linguistically identical to "probably." Not a bug, just a design constraint to be aware of.

4. **iOS native-UI labels** (`Share`, `Add to Home Screen`, `Edit Actions`, `×`) are intentionally English-only across all five INSTALL_T languages — they're literal references to what iOS Safari renders on screen. Rendered as gold-pill `<code>` tags via the backtick parser. This is by design and was confirmed during the install flow work.

---

## Suggested triage order for native-speaker review

1. **Zulu speaker (highest priority).** The known canonical bug (`days.sun = "Son"` from Afrikaans) is in this column. ~34 rows total, but most are likely cognates so the review should be quick — flag the ones that read wrong, confirm the ones that read right.
2. **Xhosa speaker.** Mirror review — most rows overlap with Zulu, so if a row was confirmed in Zulu it can be ticked quickly here.
3. **Sesotho speaker.** No cross-language duplicates flagged, but Sesotho's whole column should be reviewed for naturalness anyway. Especially the longer phrases (`toasts.permissionDeniedBrowser`, `settings.aboutText`, `INSTALL_T.iosChromeBody`, etc.).
4. **Afrikaans speaker.** Already fixed (day abbreviations). Worth a sweep of the longer phrases to catch any "mechanically faithful but stiff" cases noted during Phase A.
