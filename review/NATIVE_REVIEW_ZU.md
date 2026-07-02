# Probably Weather — isiZulu native-speaker review

Probably Weather is a South African weather app aimed at all 11 official languages. We need a quick native-speaker check on a few Zulu strings before we send it to testers. Each item below has the current value in the app, where it appears, and what it should mean in context. **Please answer Y/N or correct.**

---

## Section A — HIGH priority items (we suspect something is wrong)

### A1. `weather.gusts.zu`

- **Current value in app:** `"amafindo"`
- **Where it appears:** Home screen wind byline, shown when wind gusts are at least 1.3× the average wind speed. Example output: `"Umoya 25 km/h (amafindo 40 km/h)"`.
- **What it should mean (English):** "wind gusts" (the noun used for short bursts of stronger wind).
- **Our concern:** We think `"amafindo"` is the plural of `ifindo`, which generally means "knots" (as in knots tied in rope) or "nodes" — not wind gusts. The standard Zulu for wind-gust is closer to `"isivunguvungu somoya"` or `"isigqumo somoya"` (plural `izivunguvungu` / `izigqumo zomoya`). Is that right?
- **Reviewer answer:**
  - Correct as-is: __________
  - Should be: __________

### A2. `badges.rainTonight.zu`

- **Current value in app:** `"Imvula namhlanje"`
- **Where it appears:** Day badge under a day card in the 7-day forecast, shown when the day's rain falls in the evening / night hours.
- **What it should mean (English):** "Rain tonight" (rain happening in the evening hours).
- **Our concern:** `"namhlanje"` means "today" (any time of day), not "tonight". So the badge currently reads as "Rain today" not "Rain tonight". For comparison, the Xhosa equivalent in the app is `"Imvula ngokuhlwa"` which does mean "tonight". Likely fix: `"Imvula ebusuku"` or `"Imvula namhlanje ebusuku"`.
- **Reviewer answer:**
  - Correct as-is: __________
  - Should be: __________

---

## Section B — Cognate confirmation list

Most of these are probably legitimate cognates between related Bantu languages — we just need a quick scan to confirm. If a word **is** real Zulu and means roughly the right thing in context, tick it. If anything's wrong, flag it.

| # | Word in app | Context (English meaning) | Is this real Zulu? Or correct word? |
|---|---|---|---|
| 1  | Son        | Day-name abbreviation: Sunday (we use 3-letter forms — e.g. Mso, Bil, Tha, Sin). Suggested alternative: "Snt" or "Sont" for iSonto. |   |
| 2  | Tha        | Day-name abbreviation: Wednesday (uLwesithathu) |   |
| 3  | Sin        | Day-name abbreviation: Thursday (uLwesine) |   |
| 4  | Hlela      | Search screen button: "Edit" |   |
| 5  | Kwenziwe   | Search screen button: "Done" (after editing) |   |
| 6  | Ukubonisa  | Settings: "Display" (section header for layout options) |   |
| 7  | Imithombo  | Sidebar label: "Sources" (data sources for weather) |   |
| 8  | Akunakwenzeka | Rain probability label: "Unlikely" |   |
| 9  | Phezulu    | UV / wind level: "High" |   |
| 10 | Phezulu Kakhulu | UV / wind level: "Very High" |   |
| 11 | Ukuphuma kwelanga | Weather table heading: "Sunrise" |   |
| 12 | Usuku      | Weather table heading: "Day" |   |
| 13 | Umoya      | Weather table heading: "Wind" |   |
| 14 | Imvula     | Weather table heading: "Rain" |   |
| 15 | Imvula     | Day badge: "Rainy" (same word used as adjective-style badge — does this read naturally?) |   |
| 16 | UV Ephezulu | Day badge: "High UV" |   |
| 17 | Kubanda    | Day badge: "Cold" |   |
| 18 | Isusiwe    | Toast: "Removed" (after deleting a saved place) |   |
| 19 | Iyalayisha… | Loading state: "Loading…" |   |
| 20 | Yabelana   | Share button: "Share" |   |
| 21 | e-         | Share message prefix: "in" (as in "weather in Cape Town" → "isimo sezulu e-Cape Town") |   |
| 22 | Isichotho  | Hero label: "Hail" (large condition label) |   |
| 23 | Kubanda    | Hero label: "Chilly" |   |
| 24 | I-UV ephezulu | Hero label: "High UV" |   |
| 25 | Kumnandi   | Hero label: "Pleasant" (for nice weather days — does this read naturally as a weather adjective?) |   |
| 26 | Isichotho siyeza. | Headline: "Hail incoming." |   |
| 27 | Imvula ikhona. | Headline: "Rain's here." |   |
| 28 | Kuyabanda. | Headline: "It's chilly." |   |
| 29 | I-UV iphezulu. | Headline: "UV's hectic." (informal "high") — does this convey "hectic" intensity, or just "high"? |   |
| 30 | Faka       | Install banner button: "Install" |   |
| 31 | Faka i-Probably Weather | Install landing hero: "Install Probably Weather" |   |
| 32 | Faka i-Probably Weather | Footer install link: "Install Probably Weather" |   |
| 33 | Sula idatha yokufaka | Install settings: "Reset install state" (wipes saved install data) |   |
| 34 | Ikhaya     | Bottom nav: "Home" (the home tab) |   |

---

Estimated review time: 5–10 minutes. Thank you. Send back to: Al.
