# Native-speaker triage queue — Probably Weather i18n

**Date:** 2026-05-12
**Branch:** `feat/pre-tester-5-lang` (SA5)
**Source audit:** `I18N_CROSS_LANGUAGE_AUDIT.md` (67 cross-language duplicates flagged)
**Producer:** SA5 language-QC pass using the 4 conservative QC skills (`af-qc`, `zu-qc`, `xh-qc`, `st-qc`).

## Summary

After running each QC skill against its column, **zero entries cleared the high-confidence bar for auto-apply**. Every flagged duplicate is either:

1. A legitimate Nguni cognate shared between Zulu and Xhosa (most of the list), OR
2. A genuine suspect (e.g. `days.sun.zu = "Son"` matches Afrikaans) where the **correct fix form** itself requires native speaker input (3-letter abbreviation convention is a UX/style call, not a dictionary lookup).

Conservative protocol: defer all 67 to native-speaker review. Apply zero in-place fixes in `assets/app.js`. Each entry below ships with: current value, proposed replacement (or `null` if uncertain), why it's borderline, and the action required from the native speaker.

---

## Zulu (zu) — 34 entries

### 1. Canonical suspect (highest priority)

| Key | Current | Proposed | Why borderline | Native action |
|---|---|---|---|---|
| `days.sun` | `"Son"` | `"Snt"` or `"Sont"` (uncertain) | Matches `af.sun = "Son"` exactly. Zulu Sunday is **iSonto**. The other zu day abbrevs are 3-letter consonant clusters (`Mso`, `Bil`, `Tha`, `Sin`, `Hla`, `Mgq`). `"Snt"` follows the consonant-cluster pattern; `"Sont"` follows readability. UX call, not dictionary. | Confirm the desired 3-letter abbreviation for **iSonto**. |

### 2. Nguni cognates with Xhosa (likely correct, confirm only)

| Key | EN | Current (zu) | Why borderline | Native action |
|---|---|---|---|---|
| `days.wed` | Wed | `"Tha"` | Matches `xh.wed`. uLwesithathu → "Tha" is the syllable from "thathu" (three). Plausible cognate. | Tick if correct. |
| `days.thu` | Thu | `"Sin"` | Matches `xh.thu`. uLwesine → "Sin" plausible. | Tick if correct. |
| `search.edit` | Edit | `"Hlela"` | Matches `xh.edit`. Common Nguni verb root. | Tick if the conventional Zulu UI label is "Hlela" or "Hlela!". |
| `search.done` | Done | `"Kwenziwe"` | Matches `xh.done`. Passive of -enza ("do"). | Confirm. |
| `settings.display` | Display | `"Ukubonisa"` | Matches `xh.display`. Verbal noun of -bonisa ("show"). | Confirm. |
| `sidebar.sources` | Sources | `"Imithombo"` | Matches `xh.sources`. Plural of -mthombo (well/source). | Confirm. |
| `weather.unlikely` | Unlikely | `"Akunakwenzeka"` | Matches `xh.unlikely`. Negative form of "can happen". | Confirm. |
| `weather.high` | High | `"Phezulu"` | Matches `xh.high`. Locative for "above/up". | Confirm. |
| `weather.veryHigh` | Very High | `"Phezulu Kakhulu"` | Matches `xh.veryHigh`. Intensifier "very much". | Confirm. |
| `weather.sunrise` | Sunrise | `"Ukuphuma kwelanga"` | Matches `xh.sunrise`. "The going-out of the sun." | Confirm. |
| `weather.day` | Day | `"Usuku"` | Matches `xh.day`. Identical noun in both. | Confirm. |
| `weather.wind` | Wind | `"Umoya"` | Matches `xh.wind`. Identical noun in both. | Confirm. |
| `weather.rain` | Rain | `"Imvula"` | Matches `xh.rain`. Identical noun in both. | Confirm. |
| `badges.rainy` | Rainy | `"Imvula"` | Same as `weather.rain.zu`. Noun used as adjective-badge — naturalness question. | Confirm or suggest adjective form (e.g. "Ngemvula"). |
| `badges.highUV` | High UV | `"UV Ephezulu"` | Matches `xh.highUV`. UV acronym + "high" agreement. | Confirm. |
| `badges.cold` | Cold | `"Kubanda"` | Matches `xh.cold`. Stative verb. | Confirm. |
| `toasts.removed` | Removed | `"Isusiwe"` | Matches `xh.removed`. Passive perfect. | Confirm. |
| `misc.loading` | Loading… | `"Iyalayisha…"` | Matches `xh.loading`. Loanword "layisha" in both. | Confirm. |
| `misc.share` | Share | `"Yabelana"` | Matches `xh.share`. Reciprocal of -abela. | Confirm. |
| `misc.shareIn` | in | `"e-"` | Matches `xh.shareIn`. Locative prefix in both. | Confirm. |
| `heroLabels.hail` | Hail | `"Isichotho"` | Matches `xh.heroLabels.hail`. Shared noun. | Confirm. |
| `heroLabels.cold` | Chilly | `"Kubanda"` | Matches `xh.heroLabels.cold`. | Confirm. |
| `heroLabels.uv` | High UV | `"I-UV ephezulu"` | Matches `xh.heroLabels.uv`. | Confirm. |
| `heroLabels.clear` | Pleasant | `"Kumnandi"` | Matches `xh.heroLabels.clear`. -mnandi = "nice/pleasant". | Confirm reads naturally for weather context. |
| `headlines.hail` | Hail incoming. | `"Isichotho siyeza."` | Matches `xh.headlines.hail`. | Confirm verb-form natural. |
| `headlines.rain` | Rain's here. | `"Imvula ikhona."` | Matches `xh.headlines.rain`. | Confirm. |
| `headlines.cold` | It's chilly. | `"Kuyabanda."` | Matches `xh.headlines.cold`. | Confirm. |
| `headlines.uv` | UV's hectic. | `"I-UV iphezulu."` | Matches `xh.headlines.uv`. | Confirm — does this convey "hectic" intensity? |
| `INSTALL_T.bannerInstall` | Install | `"Faka"` | Matches `xh.bannerInstall`. Common Nguni verb "put in". | Confirm UI tone. |
| `INSTALL_T.landingHero` | Install Probably Weather | `"Faka i-Probably Weather"` | Matches `xh.landingHero`. | Confirm tone for landing hero. |
| `INSTALL_T.footerInstallLink` | Install Probably Weather | `"Faka i-Probably Weather"` | Matches `xh.footerInstallLink`. | Confirm. |
| `INSTALL_T.resetInstallState` | Reset install state | `"Sula idatha yokufaka"` | Matches `xh.resetInstallState`. "Wipe install data". | Confirm. |
| `nav.home` | Home | `"Ikhaya"` | Matches `xh.home`. Identical noun. | Confirm tone for nav label. |

---

## Xhosa (xh) — 33 entries

All 33 are Nguni cognates with Zulu. If the Zulu reviewer confirms each row above, the Xhosa reviewer can tick the matching row quickly.

| Key | EN | Current (xh) | Why borderline | Native action |
|---|---|---|---|---|
| `days.wed` | Wed | `"Tha"` | Mirrors zu. uLwesithathu → "Tha". | Tick if correct. |
| `days.thu` | Thu | `"Sin"` | Mirrors zu. Lwesine → "Sin". | Tick. |
| `search.edit` | Edit | `"Hlela"` | Confirm Xhosa UI verb. | Tick. |
| `search.done` | Done | `"Kwenziwe"` | Confirm. | Tick. |
| `settings.display` | Display | `"Ukubonisa"` | Confirm. | Tick. |
| `sidebar.sources` | Sources | `"Imithombo"` | Confirm. | Tick. |
| `weather.unlikely` | Unlikely | `"Akunakwenzeka"` | Confirm. | Tick. |
| `weather.high` | High | `"Phezulu"` | Confirm. | Tick. |
| `weather.veryHigh` | Very High | `"Phezulu Kakhulu"` | Confirm. | Tick. |
| `weather.sunrise` | Sunrise | `"Ukuphuma kwelanga"` | Confirm. | Tick. |
| `weather.day` | Day | `"Usuku"` | Confirm. | Tick. |
| `weather.wind` | Wind | `"Umoya"` | Confirm. | Tick. |
| `weather.rain` | Rain | `"Imvula"` | Confirm. | Tick. |
| `badges.rainy` | Rainy | `"Imvula"` | Same noun-as-badge concern as zu. | Suggest adjective form if needed. |
| `badges.highUV` | High UV | `"UV Ephezulu"` | Confirm. | Tick. |
| `badges.cold` | Cold | `"Kubanda"` | Confirm. | Tick. |
| `toasts.removed` | Removed | `"Isusiwe"` | Confirm. | Tick. |
| `misc.loading` | Loading… | `"Iyalayisha…"` | Confirm. | Tick. |
| `misc.share` | Share | `"Yabelana"` | Confirm. | Tick. |
| `misc.shareIn` | in | `"e-"` | Confirm. | Tick. |
| `heroLabels.hail` | Hail | `"Isichotho"` | Confirm. | Tick. |
| `heroLabels.cold` | Chilly | `"Kubanda"` | Confirm. | Tick. |
| `heroLabels.uv` | High UV | `"I-UV ephezulu"` | Confirm. | Tick. |
| `heroLabels.clear` | Pleasant | `"Kumnandi"` | Confirm natural for weather "Pleasant". | Tick. |
| `headlines.hail` | Hail incoming. | `"Isichotho siyeza."` | Confirm. | Tick. |
| `headlines.rain` | Rain's here. | `"Imvula ikhona."` | Confirm. | Tick. |
| `headlines.cold` | It's chilly. | `"Kuyabanda."` | Confirm. | Tick. |
| `headlines.uv` | UV's hectic. | `"I-UV iphezulu."` | Confirm. | Tick. |
| `INSTALL_T.bannerInstall` | Install | `"Faka"` | Confirm. | Tick. |
| `INSTALL_T.landingHero` | Install Probably Weather | `"Faka i-Probably Weather"` | Confirm. | Tick. |
| `INSTALL_T.footerInstallLink` | Install Probably Weather | `"Faka i-Probably Weather"` | Confirm. | Tick. |
| `INSTALL_T.resetInstallState` | Reset install state | `"Sula idatha yokufaka"` | Confirm. | Tick. |
| `nav.home` | Home | `"Ikhaya"` | Confirm. | Tick. |

---

## Afrikaans (af) — 1 intra-language note

| Key | Current | Borderline | Native action |
|---|---|---|---|
| `weather.probably` | `"Waarskynlik"` | Same word as `weather.likely.af`. Afrikaans appears to use one word for both English senses ("probably" / "likely"). | Confirm intentional. If the UI ever needs a stronger "likely" form (e.g. "Heel waarskynlik"), surface that option. |

No other AF entries flagged. The previous canonical bug (`af.maa` for Monday) was fixed in commit `0519c3f`.

---

## Sesotho (st) — 1 intra-language note

| Key | Current | Borderline | Native action |
|---|---|---|---|
| `weather.possible` / `weather.likely` | both `"Ho ka etsahala"` | Sesotho uses one phrase for both. Likely correct, but if a stronger "likely" form is wanted ("ho tla etsahala" / "ho tla ba teng"), surface that. | Confirm intentional. |

No cross-language duplicates flagged for Sesotho. **However**, the entire Sesotho column should still get a native-speaker naturalness pass — duplicate detection only catches one bug class. Priority targets:

- `toasts.permissionDeniedBrowser.st` (long phrase)
- `settings.aboutText.st` (long phrase)
- `INSTALL_T.iosChromeBody.st` (long instructions)

---

## Structural notes (carry over from audit)

1. **`T.settings.wittyIn` is a duplicate key** of `T.settings.language` across all 5 languages. Looks like stale code. Worth deleting if not consumed anywhere.
2. **`T.badges.rainy` matches `T.weather.rain` in zu and xh** (`"Imvula"`). Noun-as-badge — confirm reads naturally.
3. **iOS native-UI labels** in `INSTALL_T` are intentionally English across all 5 languages (literal references to iOS Safari UI). This is by design.

---

## Recommended review order

1. **Zulu speaker first** — confirms `days.sun.zu` canonical fix and ticks the 33 Nguni cognates. ~15 min if speaker reads fluently.
2. **Xhosa speaker** — mirrors the Zulu pass, much faster since most rows are already confirmed.
3. **Afrikaans speaker** — confirms `weather.probably` / `weather.likely` merge is intentional. Otherwise sweep the longer phrases.
4. **Sesotho speaker** — full column naturalness review (no duplicates flagged, but bigger uncertainty surface).

## After native review

Once each speaker has ticked / corrected their rows, a follow-up PR can:

- Apply the confirmed `days.sun.zu` fix.
- Apply any rejected-cognate corrections.
- Update `tests/i18n-no-cross-language-duplicates.test.js` allowlist for confirmed legitimate duplicates (Nguni cognates, brand acronyms).
- Delete the `T.settings.wittyIn` stale key if confirmed unused. **(Already done in Phase 2 commit `2390e74`.)**

---

# Phase 3 audit findings (added 2026-05-12, branch `main`, HEAD `6614e1b`)

**Producer:** Phase 3 single-agent pass running each language's QC skill (`af-qc`, `zu-qc`, `xh-qc`, `st-qc`) plus direct Claude review for English. **Last gate before tester rollout.** Conservative thresholds per brief: AF auto-apply at ≥0.9, Nguni/Sotho auto-apply at ≥0.95, EN auto-apply only for obvious typos.

## Phase 3 summary

| Language | Strings audited | Auto-applied | HIGH flags (new) | MEDIUM flags (new) | LOW flags (new) |
|---|---|---|---|---|---|
| English (en) | ~110 | 0 (no typos) | 0 | 0 | 0 |
| Afrikaans (af) | ~110 | 0 | 1 | 1 | 4 |
| isiZulu (zu) | ~110 | 0 | 2 | 0 | 0 |
| isiXhosa (xh) | ~110 | 0 | 0 | 3 | 0 |
| Sesotho (st) | ~110 | 0 | 1 | 1 | 2 |
| **Total** | **~550** | **0** | **4** | **5** | **6** |

Witty copy in `WEATHER_COPY.witty` (40+ short SA-flavoured items per condition × 5 languages × 13 conditions = ~2600 lines of cultural humour) was **NOT word-by-word audited per the brand-voice protection rule**. Only spot-checked for cross-language paste errors. None found.

## Phase 3 HIGH-priority new findings

### HIGH 1 — `weather.gusts.st = "lifofane"` — semantic disaster

| Key | Current value | Issue | Suggestion | Confidence |
|---|---|---|---|---|
| `weather.gusts.st` | `"lifofane"` | "lifofane" is plural of "sefofane" meaning **"airplanes"**, not "gusts". This is currently shown when wind+gust > 1.3x: `"Moea 25 km/h (lifofane 40 km/h)"` — reads as "Wind 25 km/h (airplanes 40 km/h)". Cannot ship to Sesotho-speaking testers. | Likely `"ho thunya ha moea"` or `"ho foka ka matla"`; a single concise noun like `"liphunya"` may not exist — native confirmation essential. | confidence_is_bug = 0.95, confidence_in_fix = 0.55 |

### HIGH 2 — `search.clearRecents.af = "Verwyder onlangs"`

| Key | Current value | Issue | Suggestion | Confidence |
|---|---|---|---|---|
| `search.clearRecents.af` | `"Verwyder onlangs"` | Translates "Clear recents" word-by-word: "Remove recently" (adverb), not "Remove recent items" (noun-phrase). Reads as instruction about timing, not about objects. | `"Maak onlangse skoon"` (Make recent ones clean) or `"Verwyder onlangse soektogte"` (Remove recent searches). | confidence_is_bug = 0.85, confidence_in_fix = 0.75 |

### HIGH 3 — `badges.rainTonight.zu = "Imvula namhlanje"`

| Key | Current value | Issue | Suggestion | Confidence |
|---|---|---|---|---|
| `badges.rainTonight.zu` | `"Imvula namhlanje"` | "namhlanje" = "today", not "tonight". Badge reads as "Rain today" not "Rain tonight". Compare to `xh.rainTonight = "Imvula ngokuhlwa"` (correctly "tonight"). | `"Imvula ebusuku"` or `"Imvula namhlanje ebusuku"` | confidence_is_bug = 0.85, confidence_in_fix = 0.7 |

### HIGH 4 — `weather.gusts.zu = "amafindo"`

| Key | Current value | Issue | Suggestion | Confidence |
|---|---|---|---|---|
| `weather.gusts.zu` | `"amafindo"` | "amafindo" is plural of "ifindo" — generally means "knots" or "nodes", not "gusts of wind". Standard Zulu for wind-gust closer to `"isivunguvungu somoya"` or `"isigqumo somoya"`. | Likely `"izivunguvungu"` or `"izigqumo zomoya"` — native confirmation essential. | confidence_is_bug = 0.7, confidence_in_fix = 0.4 |

## Phase 3 MEDIUM-priority new findings

| # | Key | Current | Note | Action |
|---|---|---|---|---|
| M1 | `misc.shareMessage.af` | `"Check die weer in {city} — Suid-Afrikaanse weer in jou taal: {url}"` | Uses English loanword "Check" in AF text. May be intentional brand-voice casual SA-AF register, or could be replaced with `"Kyk na die weer"`. **Brand-voice question — defer to Al.** | Confirm intent. |
| M2 | `weather.gusts.xh` | `"iimphuphuma"` | Plural of "umphuphuma" = "outburst/overflow". Standard Xhosa for wind-gust closer to `"iziphango zomoya"`. Mirrors zu.gusts concern. | Native confirmation. |
| M3 | `heroLabels.partly-cloudy.xh` | `"Kufukufuku kancinci"` | "kufukufuku" generally means "lukewarm/mild warmth", not "cloudy". Semantically mismatched with "Partly cloudy". Possible regional usage. | Native confirmation; possible swap to `"Linamafu kancinci"`. |
| M4 | `badges.rainMorning.xh` | `"Imvula kusasa"` | "kusasa" can mean "in the morning (today)" OR "tomorrow" depending on context. Badge displayed today as "morning rain" — could read as "rain tomorrow" instead. | Native confirmation; consider `"Imvula ngentsasa"` (unambiguously "this morning"). |
| M5 | `misc.shareMessage.st` | `"Sheba boemo ba leholimo {city} — ..."` | Missing locative preposition before `{city}`. Compare `zu/xh: "e-{city}"`, `en/af: "in {city}"`. Reads as bare juxtaposition. | Native confirmation; likely `"... leholimo {city}-ng"` or `"... leholimo Cape Town-ng"`. |

## Phase 3 LOW-priority new findings

| # | Key | Current | Note |
|---|---|---|---|
| L1 | `search.savedPlaces.af` | `"Gestoorde Plekke"` | Title Case mid-phrase. AF would more typically use sentence case. Mirrors EN "Saved Places" pattern; acceptable for section title. Defer. |
| L2 | `weather.veryHigh.af` | `"Baie Hoog"` | Title Case mid-phrase. AF would normally write "Baie hoog". Mirrors EN "Very High". Defer. |
| L3 | `badges.rainMorning.af` | `"Reën oggend"` | Slightly stilted; "Oggendreën" or "Reën in die oggend" reads more natural. Compact badge label, acceptable. |
| L4 | `INSTALL_T.fallbackPrompt.af` | `"...dan Installeer app..."` | "Installeer" mid-sentence treated as button-label cap. Could be lowercase or wrapped in backticks per the existing iOS-label pattern. |
| L5 | `search.savedPlaces.st` | `"Libaka tse Bolokiloeng"` | "tse" capitalized mid-phrase. Sesotho doesn't capitalize relative pronouns. Mirrors EN Title Case. Defer. |
| L6 | `days.thu.st` / `days.fri.st` | `"Labo"` / `"Laboh"` | Length inconsistency with other 3-letter ST day abbreviations (`Lab`, `Lar`, `Moq`). Could trim to `"Lab"` / `"Lab"` but creates collision; defer. |

## Cross-language duplicates: status check

The 67 entries triaged in SA5 above are **unchanged in Phase 3**. None were touched. All still pending native review per the original protocol.

## What Phase 3 did NOT audit

- **`WEATHER_COPY.witty` arrays** — protected per cultural-voice rule. 13 conditions × 5 languages × 20-40 lines each = ~2,600 lines. Brand-voice items: Eskom jokes, braai references, Cape Doctor, hadedas, N1, Carte Blanche, Spur, Woolies, Helderberg, fynbos. Per `DESIGN.md` and the brief's hard rule: do not modify without Al's explicit approval. Spot-check confirmed no cross-language paste errors (no AF text in ZU slots, no EN text in ST slots, etc.).
- **Inline hardcoded English in `index.html` / `install.html` / `privacy.html`** — these are overridden by `updateUILanguage()` at runtime. Acceptable per current design. The tagline "No more Ja-No-Maybe weather. Just Probably." is intentionally English-only brand positioning per `DESIGN.md`.

## Recommended action

1. **HIGH 1 (`weather.gusts.st = "lifofane"`)** — get a Sesotho speaker to suggest a replacement before tester rollout if Al has a strong-wind-day scheduled for tester verification. Otherwise ship as-is and accept that one Sesotho tester may screenshot the airplane line and laugh. UX impact: only visible when `gust > wind * 1.3`, which is uncommon outside the Cape Doctor.
2. **HIGH 2 (`search.clearRecents.af`)** — easy native confirmation; if Al knows an AF speaker, 30-second fix.
3. **HIGH 3 (`badges.rainTonight.zu`)** — easy native fix; "namhlanje" → "ebusuku".
4. **HIGH 4 (`weather.gusts.zu`)** — same as HIGH 1; only shows on gusty days. Cape Doctor lines may surface it.
5. **MEDIUMs** — none rollout-blocking. Bundle into a follow-up native review pass.
6. **LOWs** — defer.

After native review on the 4 HIGH items, apply each as a separate short commit with the SW cache bumped once at the end.
