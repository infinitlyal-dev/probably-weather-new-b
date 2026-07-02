# Probably Weather — Sesotho native-speaker review

Probably Weather is a South African weather app aimed at all 11 official languages. We need a quick native-speaker check on a few Sesotho strings before we send it to testers. Each item below has the current value in the app, where it appears, and what it should mean in context. **Please answer Y/N or correct.**

(Note: the app uses South African Sesotho conventions — `joalo`, `joale`, etc. — rather than Lesotho Sesotho. Please review against the SA standard.)

---

## Section A — HIGH priority items (we suspect something is wrong)

### A1. `weather.gusts.st` — most urgent

- **Current value in app:** `"lifofane"`
- **Where it appears:** Home screen wind byline, shown when wind gusts are at least 1.3× the average wind speed. Example output shown to the user: `"Moea 25 km/h (lifofane 40 km/h)"`.
- **What it should mean (English):** "wind gusts" (short bursts of stronger wind, e.g. when the southeaster picks up).
- **Our concern:** `"lifofane"` is the plural of `sefofane`, which means **"airplane"**. So the wind banner currently reads to a Sesotho user as: "Wind 25 km/h (airplanes 40 km/h)". We need to replace it with a real Sesotho expression for wind gusts. Possible candidates we've seen: `"ho thunya ha moea"` (the eruption / bursting of the wind), `"ho foka ka matla"` (blowing with strength). Or is there a single concise noun?
- **Reviewer answer:**
  - Correct as-is: __________
  - Should be (single concise form preferred, but a short phrase is fine): __________

---

## Section B — Other items to confirm

The earlier audit did **not** flag any cross-language duplicate concerns for Sesotho, but the Sesotho column hasn't yet had a full native naturalness pass. The two items below are intra-language merges (one Sesotho word covering two English distinctions) plus the share-message preposition question. There are no Sesotho-vs-other-language cognate rows to confirm — Sesotho is in a different language family from Zulu/Xhosa, so we don't expect overlap.

| # | Word/phrase in app | Context (English meaning) | Is this correct / natural Sesotho? |
|---|---|---|---|
| 1 | Ho ka etsahala | Used for BOTH "Possible" (rain probability label) AND "Likely" (slightly higher rain probability label). The English app distinguishes the two; Sesotho seems to use the same phrase for both. Is that natural, or should "Likely" be a stronger form (e.g. `"ho tla etsahala"`)? |   |
| 2 | Sheba boemo ba leholimo {city} — boemo ba leholimo ba Afrika Borwa ka puo ya hao | The WhatsApp share message body. `{city}` gets replaced with the city name at runtime, e.g. `"Sheba boemo ba leholimo Cape Town — boemo ba leholimo ba Afrika Borwa ka puo ya hao"`. The Zulu and Xhosa equivalents use a preposition `"e-{city}"` ("in {city}"); the Sesotho version doesn't. Does it read naturally as-is, or should there be a preposition / locative suffix (e.g. `"{city}-ng"`)? |   |

### Section B — Long-phrase naturalness pass (optional but appreciated)

If you have a couple of extra minutes, please skim these three longer Sesotho strings for naturalness. They were flagged in an earlier audit as "long phrases that warrant native-speaker eye" but weren't suspected of being wrong — just unconfirmed:

| # | Where shown | Current Sesotho |
|---|---|---|
| 3 | Toast shown when location permission is denied in the browser | `"Tumello ea sebaka ea hlokahala. Tlanya letshwao la sebaka bareng ea aterese ea sebatli ho e bulela."` |
| 4 | Settings → About paragraph | `"Probably Weather e kopanya diponelopele tse tsoang ho Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather ho u fa ponelopele e tšepahalang."` |
| 5 | Install instructions for iPhone Chrome users | `"Chrome ho iPhone e ke ke ea kenya li-app. Tobetsa ka tlase ho bula sebaka sena ho Safari, joale latela mehato."` |

If anything reads stiff or non-idiomatic, flag the row and suggest a more natural form.

---

Estimated review time: 5–10 minutes. Thank you. Send back to: Al.
