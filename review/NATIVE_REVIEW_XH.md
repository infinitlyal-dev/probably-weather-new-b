# Probably Weather — isiXhosa native-speaker review

Probably Weather is a South African weather app aimed at all 11 official languages. We need a quick native-speaker check on a few Xhosa strings before we send it to testers. Each item below has the current value in the app, where it appears, and what it should mean in context. **Please answer Y/N or correct.**

---

## Section A — HIGH priority items

No specific HIGH-confidence concerns flagged for Xhosa — just cognate confirmation needed in Section B. Three lower-priority items are listed at the end of this section in case you have an opinion:

### A1. `weather.gusts.xh`

- **Current value in app:** `"iimphuphuma"`
- **Where it appears:** Home screen wind byline, shown when wind gusts are at least 1.3× the average wind speed. Example output: `"Umoya 25 km/h (iimphuphuma 40 km/h)"`.
- **What it should mean (English):** "wind gusts" (short bursts of stronger wind).
- **Our concern:** `"iimphuphuma"` looks like the plural of `umphuphuma` = "outburst / overflow". Standard Xhosa for wind-gust might be closer to `"iziphango zomoya"`. Right?
- **Reviewer answer:**
  - Correct as-is: __________
  - Should be: __________

### A2. `heroLabels.partly-cloudy.xh`

- **Current value in app:** `"Kufukufuku kancinci"`
- **Where it appears:** Large condition label at the top of the home screen on partly-cloudy days.
- **What it should mean (English):** "Partly cloudy" (some clouds, some sun).
- **Our concern:** `"kufukufuku"` generally means "lukewarm / mildly warm" — which is temperature, not cloudiness. We'd expect something like `"Linamafu kancinci"` ("there are a few clouds"). Is `"Kufukufuku kancinci"` natural for partly cloudy in your region, or is it wrong?
- **Reviewer answer:**
  - Correct as-is: __________
  - Should be: __________

### A3. `badges.rainMorning.xh`

- **Current value in app:** `"Imvula kusasa"`
- **Where it appears:** Day badge on a forecast day where rain is expected in the morning hours.
- **What it should mean (English):** "Rain AM" / "Morning rain" (rain happening THIS morning).
- **Our concern:** `"kusasa"` can mean "in the morning" or "tomorrow" depending on context. The badge appears on the relevant day, so it should read as "this morning". Does it read clearly, or could it be misread as "tomorrow"? If ambiguous, would `"Imvula ngentsasa"` be clearer?
- **Reviewer answer:**
  - Correct as-is: __________
  - Should be: __________

---

## Section B — Cognate confirmation list

Most of these are probably legitimate cognates between related Bantu languages (Zulu and Xhosa share a lot of vocabulary) — we just need a quick scan to confirm. If a word **is** real Xhosa and means roughly the right thing in context, tick it. If anything's wrong, flag it.

| # | Word in app | Context (English meaning) | Is this real Xhosa? Or correct word? |
|---|---|---|---|
| 1  | Tha        | Day-name abbreviation: Wednesday (uLwesithathu) |   |
| 2  | Sin        | Day-name abbreviation: Thursday (uLwesine) |   |
| 3  | Hlela      | Search screen button: "Edit" |   |
| 4  | Kwenziwe   | Search screen button: "Done" (after editing) |   |
| 5  | Ukubonisa  | Settings: "Display" (section header for layout options) |   |
| 6  | Imithombo  | Sidebar label: "Sources" (data sources for weather) |   |
| 7  | Akunakwenzeka | Rain probability label: "Unlikely" |   |
| 8  | Phezulu    | UV / wind level: "High" |   |
| 9  | Phezulu Kakhulu | UV / wind level: "Very High" |   |
| 10 | Ukuphuma kwelanga | Weather table heading: "Sunrise" |   |
| 11 | Usuku      | Weather table heading: "Day" |   |
| 12 | Umoya      | Weather table heading: "Wind" |   |
| 13 | Imvula     | Weather table heading: "Rain" |   |
| 14 | Imvula     | Day badge: "Rainy" (same word used as adjective-style badge — does this read naturally?) |   |
| 15 | UV Ephezulu | Day badge: "High UV" |   |
| 16 | Kubanda    | Day badge: "Cold" |   |
| 17 | Isusiwe    | Toast: "Removed" (after deleting a saved place) |   |
| 18 | Iyalayisha… | Loading state: "Loading…" |   |
| 19 | Yabelana   | Share button: "Share" |   |
| 20 | e-         | Share message prefix: "in" (as in "weather in Cape Town" → "imozulu e-Cape Town") |   |
| 21 | Isichotho  | Hero label: "Hail" (large condition label) |   |
| 22 | Kubanda    | Hero label: "Chilly" |   |
| 23 | I-UV ephezulu | Hero label: "High UV" |   |
| 24 | Kumnandi   | Hero label: "Pleasant" (for nice weather days — does this read naturally as a weather adjective?) |   |
| 25 | Isichotho siyeza. | Headline: "Hail incoming." |   |
| 26 | Imvula ikhona. | Headline: "Rain's here." |   |
| 27 | Kuyabanda. | Headline: "It's chilly." |   |
| 28 | I-UV iphezulu. | Headline: "UV's hectic." (informal "high") — does this convey "hectic" intensity, or just "high"? |   |
| 29 | Faka       | Install banner button: "Install" |   |
| 30 | Faka i-Probably Weather | Install landing hero: "Install Probably Weather" |   |
| 31 | Faka i-Probably Weather | Footer install link: "Install Probably Weather" |   |
| 32 | Sula idatha yokufaka | Install settings: "Reset install state" (wipes saved install data) |   |
| 33 | Ikhaya     | Bottom nav: "Home" (the home tab) |   |

---

Estimated review time: 5–10 minutes. Thank you. Send back to: Al.
