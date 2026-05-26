# Cold-Clear Copy Review Log — isiZulu

Date: 2026-05-26.
Reviewer: Codex (GPT-5-class) via `codex:codex-rescue` subagent.
**Status: NATIVE-SPEAKER REVIEW STILL REQUIRED.** Codex is non-native; this is a first-pass AI-translation-tell sweep only.

---

## Round 1 — NEEDS WORK

Reviewer caught a clear AI-translation pattern: overuse of `kodwa`, stiff abstract words like `ubuhle`, direct English idioms, several wrong terms around sky/blue/frost/breath. Count of lines was 19 not 20 (corrected — added a 20th line).

### Critical fixes (4)
- Line 6: `"esithenjisweni semoto"` (means "in the promise of the car") → `"Isithwathwa engilazini yemoto, izulu liluhlaza cwe."`
- Line 8: `"zase-impumulo"` should be `"zasemakhaleni"`; `"ziyajiyisa"` wrong; `"lokho okuluhlaza"` reads as "that green thing" → `"Kuyabanda kuze kuqine izinwele zasemakhaleni. Kodwa bheka lelo zulu eliluhlaza cwe."`
- Line 14: `"ukukhululela ubuhlungu"` doesn't land → `"Kuhle kangangokuthi ucishe uxolele amakhaza."`
- Line 16: `"isikwephuzi"` wrong word → `"Uphefumula kubonakale; izulu lona liyazikhulumela."`

### Major fixes (10)
| Line | Issue | Replacement |
|------|-------|-------------|
| Hero | Translated, too long for badge | `"Kubanda, izulu licwebile"` |
| Headline | Generic, no soul | `"Kubanda, kodwa izulu licwebe cwe."` |
| 1 | "isibhakabhaka sibukeka" incomplete (looks at what?) | `"Kuyabanda impela, kodwa bheka leso sibhakabhaka."` |
| 2 | "umoya wakho uyabonakala" = "your wind is visible"; calques | `"Ubusika baseHighveld: uphefumula kuze kubonakale umoya, ilanga likhazimula njengegolide."` |
| 3 | `kanye` formal, e-jacaranda clunky | `"Kuphansi kuka-zero, ama-jacaranda wona asabukeka kahle."` |
| 5 | English-calque "Bloemfontein energy" | `"IBloemfontein ngo-7 ekuseni: kubanda kuze kubuhlungu, kodwa kuhle."` |
| 9 | misery overlap | `"Isibhakabhaka sihle; iminwe yona ayivumelani."` |
| 10 | personification awkward | `"Amajazi amabili, nokumamatheka okuncane. Izulu lihle namhlanje."` |
| 11 | "izingubo" = blankets (wrong wearable), "izipili zelanga" too literal | `"Amakhaza omile aseHighveld. Thatha ijezi nezibuko zelanga."` |
| 12 | wrong agreement, abrupt "Hamba" | `"Kuyabanda, ilanga likhazimula njengegolide, akukho mvula. Phuma kancane."` |
| 15 | English idiom "choose your battles" | `"Kubanda kakhulu, izulu licwebe cwe. Khetha ukuthi ukhala ngani."` |
| 19 | repetitive, "zinhle" should be "zintle"... actually zu spelling | `"Isimo sezulu sezibuko zelanga nesikhafu. Kokubili kuyadingeka namhlanje."` |
| 20 (new) | added | `"Amakhaza asekuseni, izulu lihle nje."` |

### Minor fixes
Multiple — see git diff.

## Round 2 — NEEDS WORK (improvements applied)

Reviewer flagged 9 more polish items. Applied each suggested rewrite:
- Hero: confirmed needed `izulu` qualifier — applied
- Headline: `"izulu lihle cwe"` slightly stiff → `"izulu licwebe cwe"`
- Line 2: `"njengegolide"` more natural than `"ngegolide"`
- Line 6: `"engilazini yemoto"` cleaner than `"ku-windscreen"`
- Line 7: `"Kuyi-lekker koud"` better code-switching register
- Line 10: dropped `"nalo"` — slight rhythm fix
- Line 12: tightened list rhythm
- Line 15: `"licwebe cwe"` instead of `"licwebezele"` (which implies shiny, not clear)
- Line 20: `"izulu lihle nje"` (avoids duplication with line 15)

## Native-review pending

All zu entries (heroLabels, headlines, witty) flagged for native-speaker review per the project rule for low-resource languages. Codex caught the most obvious AI-translation tells; final naturalness needs a real isiZulu speaker.

**Status**: pre-native-review CLEAN. Ship to native reviewer.
