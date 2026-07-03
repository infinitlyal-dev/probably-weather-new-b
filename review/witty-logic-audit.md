# Witty-line logic audit — inventory for owner taxonomy ruling

**Scope:** every witty line, every bin, all five languages — `assets/weather-copy.js`
(source of truth). Detection runs on the **EN row**; translations inherit their row's
classification (row alignment is intact — all bins are equal-length across the five
languages). Low-resource detection (isiZulu / isiXhosa / Sesotho) is marked
**provisional**. This is an **inventory only** — no tags implemented, no wording changed
beyond the two owner-ruled fixes tracked at the end. The owner rules the taxonomy next.

Generated against `HEAD c945653` + the two ruled fixes. Extractor: keyword classifiers
over the real bank (not eyeballing); every row below is a real `bin[index]`.

---

## 0. Pool depth — EN lines per bin

So the owner can see depth before any rewording thins a pool.

| Bin (`witty`) | EN lines | | Bin (`witty`) | EN lines |
|---|---|---|---|---|
| storm | 32 | | wind | 20 |
| thunder | 3 | | cold | 38 |
| hail | 3 | | cold-clear | 30 |
| rain | 36 | | heat | 36 |
| rain-possible | 20 | | fog | 38 |
| cloudy | 38 | | clear | 38 |
| partly-cloudy | 20 | | night | 20 |
| uv | 20 | | weekend | 25 |

`witty_low_confidence`: **11 bins × 6 EN lines** each (clear, partly-cloudy, cloudy, fog,
rain, rain-possible, wind, cold, heat, storm, night).

**Totals: 417 EN witty lines + 66 low-confidence = 483 EN rows × 5 languages ≈ 2,415 strings.**
Thin pools to protect: **thunder (3)**, **hail (3)** — any gate or removal here risks a
single-line pool. `partly-cloudy`, `uv`, `wind`, `night`, `rain-possible` sit at 20.

---

## 1. Time-of-day references

No time-of-day gate exists today. `getWittyLine` computes `hour` but never consults it for
witty selection, so **every line below can fire at any hour** — e.g. a "6am" line at 8pm, a
"sunset" line at dawn. Proposed tag is a suggestion for the owner's taxonomy, not a decision.

The **`night` bin and `witty_low_confidence.night`** are already **condition-gated** (only
selected when `conditionKey` resolves to night / `isDay=false`), so their night references
fire correctly — **no time tag needed there.** Listed separately for completeness.

### 1a. Morning-coded (proposed tag: `morning`)

| bin[i] | EN line | note |
|---|---|---|
| cold[11] | "The duvet had the right idea this morning." | explicit "this morning" |
| cold[35] | "Coffee count: rising. Motivation count: still zero." | coffee-morning — borderline |
| cold-clear[0] | "Bloemfontein at 6am: jersey, gown, scarf, takkies, and a brave face." | clock "6am" (+ place) |
| cold-clear[15] | "Boiling-the-kettle-twice weather: once for the coffee, once for the hands." | coffee-morning |
| cold-clear[16] | "Karoo morning. The kind that makes you respect every farmer who chose this." | explicit "morning" (+ place) |
| cold-clear[28] | "Maluti-frost morning. Lesotho's exporting it for free." | explicit "morning" (+ place) |
| cold-clear[29] | "Coffee in the sun on the stoep. The whole reason we live here." | coffee-morning |
| heat[26] | "Your makeup has an expiry date of 9am." | clock "9am" |
| heat[33] | "Your iced coffee melted before you reached the car." | commute/coffee — borderline |
| fog[12] | "The world got a soft filter this morning." | explicit "this morning" |
| fog[37] | "The morning forgot to render." | explicit "morning" |
| clear[25] | "Take your coffee outside. You deserve it." | coffee — borderline (any hour?) |
| clear[33] | "Pour the coffee outside. Trust us." | coffee — borderline |
| weekend[22] | "Boerie roll for breakfast? On a weekend? Acceptable." | "breakfast" (+ weekend bin) |
| lc.cold[5] | "Probably nippy. The Boland mornings do this." | explicit "mornings" (+ place) |

### 1b. Afternoon / midday-coded (proposed tag: `day` or `afternoon`)

| bin[i] | EN line | note |
|---|---|---|
| heat[5] | "Hotter than a bakkie dashboard at noon." | "noon" |
| heat[19] | "Garage pie for lunch because the kitchen is lava." | "lunch" — already `DAYTAG:weekday` |
| uv[13] | "Your nose is going to betray you by 3pm." | clock "3pm" |
| cold-clear[19] | "Layers off by 11. Layers on by 4. Highveld classic." | **day-arc** (spans morning→afternoon) — not one slot; flag as not cleanly gateable (+ place) |

### 1c. Evening-coded (proposed tag: `evening`)

| bin[i] | EN line | note |
|---|---|---|
| cloudy[18] | "Nobody's posting this sunset on Instagram." | "sunset" |

### 1d. Night-coded, but NOT in a night-gated bin (proposed tag: `night` / review)

| bin[i] | EN line | note |
|---|---|---|
| uv[1] | "SPF 50 or regret it by tonight." | "tonight" is the **consequence**, not the firing slot — SPF advice belongs to daytime. Proposed: `day`/`morning`, NOT night. Flag. |
| cold-clear[13] | "Tile floors are tonight's villain. Wear something on your feet." | genuine evening/night line living in an all-hours bin |

### 1e. Night bin — already condition-gated (no time tag needed; listed for completeness)

`night[0]` "Stars out, load shedding can't touch this." · `night[1]` "…see the Milky Way." ·
`night[4]` "Night shift weather: approved." · `night[6]` "Good night, South Africa." ·
`night[7]` "The moon's doing the most tonight." · `lc.night[0,1,4,5]` (calm/clear-night lines).
These fire only when the condition is night — **correct as-is.**

---

## 2. Place references — claim vs imagery

**place-claim** = the line asserts the user's *location* behaves a specific way (wrong if the
user is elsewhere). **place-imagery** = an evocative national reference that reads fine
anywhere. Borderline cases are **flagged, not decided**. Proposed region gate applies only to
claims (owner's taxonomy: `western-cape` / `karoo` / `gauteng` (Highveld) / `free-state` /
`coast` / `none`).

### 2a. Western-Cape / Cape-coded (proposed gate: `western-cape` / `coast`)

| bin[i] | EN line | class | proposed gate |
|---|---|---|---|
| wind[2] | "Table Mountain's tablecloth is out." | **claim** (Cape-specific cloud) | western-cape |
| wind[3] | "The Cape Doctor is making house calls." | **claim** (WC SE wind) | western-cape |
| fog[9] | "Table Mountain? What Table Mountain?" | **claim** | western-cape / coast |
| fog[30] | "Cape Town just got a dimmer switch." | **claim** | western-cape / coast |
| clear[15] | "The Helderberg is showing off today." | **claim** (Somerset West / Strand) | western-cape |
| clear[18] | "The fynbos is loving it. You should too." | claim/imagery — borderline (WC flora) | western-cape? |
| night[9] | "Even Table Mountain's called it a day." | **claim** | western-cape / coast |
| night[15] | "Cape Town's twinkling. Probably." | **claim** | western-cape / coast |
| lc.clear[2] | "Clear, in theory. The Cape Doctor doesn't always RSVP." | **claim** | western-cape |
| lc.fog[1] | "Probably fog later. The Boland does this." | **claim** (Boland winelands) | western-cape |
| lc.wind[0] | "Probably windy. The Cape Doctor keeps its own diary." | **claim** | western-cape |
| lc.cold[5] | "Probably nippy. The Boland mornings do this." | **claim** | western-cape |

### 2b. Highveld / inland-cold-coded — concentrated in `cold-clear` (proposed gate: `gauteng` / `free-state` / `karoo`)

| bin[i] | EN line | class | proposed gate |
|---|---|---|---|
| cold-clear[0] | "Bloemfontein at 6am: jersey, gown, scarf, takkies, and a brave face." | **claim** | free-state |
| cold-clear[1] | "The Free State just remembered it has a winter setting." | **claim** (+ season) | free-state |
| cold-clear[3] | "Highveld winter: … two jackets to fetch the post." | **claim** (+ season) | gauteng / highveld |
| cold-clear[10] | "The kind of day Joburg pretends it doesn't have until you're standing in it." | **claim** | gauteng |
| cold-clear[12] | "Pretoria-bare-jacaranda energy. Beautiful and bleak." | **claim** | gauteng |
| cold-clear[16] | "Karoo morning. …respect every farmer who chose this." | **claim** (+ morning) | karoo |
| cold-clear[19] | "Layers off by 11. Layers on by 4. Highveld classic." | **claim** (+ day-arc) | gauteng / highveld |
| cold-clear[21] | "…Googling 'underfloor heating Bloemfontein'." | claim/imagery — borderline | free-state? |
| cold-clear[28] | "Maluti-frost morning. Lesotho's exporting it for free." | claim/imagery — borderline (border/E-FS) | free-state? |

**Observation:** `cold-clear` is heavily inland/Highveld-coded (Bloem, Joburg, Pretoria, Free
State, Highveld, Karoo, Maluti). A Durban or Cape Town user on a cold-clear day can get
"Highveld winter / fetch the post" — a place-claim mismatch. This is the densest claim cluster.

### 2c. National roads / imagery (proposed gate: `none` — reads fine anywhere)

| bin[i] | EN line | class |
|---|---|---|
| storm[11] | "Even the bakkies on the N2 pulled over." | imagery (borderline — N2 is Cape/coastal) |
| rain[5] | "Joburg drivers are panicking already." | imagery/stereotype (borderline) — already `DAYTAG:weekday` |
| rain[8] | "The N1 is now a waterpark." | imagery |
| partly-cloudy[9] | "Halfway to a Highveld thunderstorm. Or not." | **claim** — borderline (asserts Highveld storm) → gauteng? |
| cold-clear[26] | "Even the cattle on the N1 are huddled like they paid for it." | imagery |
| cold-clear[29] | "Coffee in the sun on the stoep. …reason we live here." | imagery ("stoep" cultural, not place) |
| heat[1] | "You could fry an egg on the N1." | imagery |

---

## 3. Day-reference re-sweep

**No day-named line escaped the tagging session.** Every explicitly day-named line carries a
tag: `cloudy[9]` = `mon`, `fog[7]` = `tue`, `weekend[19]` = `sat`. Confirmed by re-scan over
all weekday/workday markers.

**Untagged but weekday-implying (owner may want to tag `weekday`):**

| bin[i] | EN line | strength |
|---|---|---|
| cloudy[22] | "The sun sent an out-of-office reply." | strong (out-of-office = workday) |
| heat[29] | "The aircon remote is now public property. Negotiate." | borderline (office aircon, but aircon exists at home) |

`fog[26]` "The traffic lights are vibing in the mist." matched the scan on "traffic" but is a
**false positive** — traffic lights run every day, not a commute claim. No tag needed.

The `weekend` bin lines `[4,9,12,17,22]` are untagged but **bin-gated**: the whole bin is only
reached for clear/heat on weekends, so "out-of-office / weekend vibes" fire in-context. Only
`[19]` needed day-specificity (`sat`). No action unless the owner wants Sat-vs-Sun splits.

---

## 4. Seasons, rain-in-clear, duplicates

### 4a. Season references (fire year-round — no season gate exists)

| bin[i] | EN line | class |
|---|---|---|
| partly-cloudy[16] | "Some clouds. Some sun. South African summer admin." | **claim** (asserts summer) → summer gate? |
| cold-clear[1] | "The Free State just remembered it has a winter setting." | **claim** (asserts winter; thematically cold-clear is cold anyway) |
| cold-clear[3] | "Highveld winter: … two jackets to fetch the post." | **claim** (asserts winter) |
| clear[21] | "This is the weather you'll miss in December traffic." | imagery (December as future contrast) — already `DAYTAG:weekday` |
| clear[37] | "Bottle this one. Open it in winter." | imagery ("save it for winter" — contrast, not a claim) |
| lc.cold[3] | "Cold's the bet. Don't trust a sunny window in winter." | imagery (winter as caution, not a claim) |

Gateable season-claims (assert it *is* that season): `partly-cloudy[16]` (summer),
`cold-clear[1]`, `cold-clear[3]` (winter). The rest use season as contrast/imagery — leave.

### 4b. Rain assumed in a clear bin — none genuine

The extractor flagged `clear[33]` "Pour the coffee outside." — a **false positive** ("pour"
matched the rain regex; it's pouring *coffee*). No clear/cold-clear line actually assumes rain.
Clean.

### 4c. Duplicated strings within one bin+language pool

**Exactly one duplicate in the entire bank** (all bins, all languages):

| bin | lang | indices | string | EN rows |
|---|---|---|---|---|
| partly-cloudy | af | [0], [5] | `"Son speel wegkruipertjie."` | [0] "Sun, hide-and-seek champion of the day." / [5] "Sun's playing peek-a-boo." |

This is the owner-flagged pair, and the target of ruled fix (2) below.

---

## 5. Translation faithfulness (EN-row inheritance check)

**No translation invents a time or place reference its EN row lacks.** Every apparent hit from
the cross-check was one of:
- a **clock-time on the EN side** the keyword pass under-counted (`6am`, `9am`, `overnight`,
  `3pm`) which the translation renders faithfully — folded into §1 above; or
- a **bucket overlap** (isiXhosa `ngokuhlwa` "this evening" for EN "tonight" — same underlying
  time, different bucket label).

isiZulu / isiXhosa / Sesotho detection is **provisional** (keyword-based, outsider judgement).
**Per the deference rule, none of the non-English wording is judged wrong here** — flagged rows
are for a native speaker to confirm, not for me to "correct."

---

## 6. What the picker needs to enforce time + region tags

### Time-of-day — **no new threading needed**
- `assets/app.js` `getWittyLine(condition)` already computes `hour` at line 1135
  (`getLocationHour(activePlace?.lon)`).
- `api/og.js` `pickWitty(condition, lang, seed, day, hour)` already **receives `hour`** (added
  with the F1 day-fix; `buildOgViewModel` computes it from `payload.meta.utcOffsetSeconds`).
- So a time-slot gate mirrors `dayTagAllows`: add a slot classifier
  (`hour → morning|day|evening|night`) + a tag map in `assets/witty-day-tags.js`, and both call
  sites already have `hour` in hand.

### Region — **partial threading gap in og.js**
- `assets/app.js`: `getWittyLine` has closure access to `activePlace.lat/lon` (used elsewhere at
  1558/1680). The only existing region helper is **`isWesternCape(place)`** (app.js:1507) — a
  lat/lon bounding box (`lat −34.5..−33.0, lon 17.5..20.0`). **No** Karoo / Highveld / Gauteng /
  Free-State / coast classifiers exist yet. app-side needs new classifiers only; no signature
  change (lat/lon already in scope).
- `api/og.js`: **`pickWitty` does not receive lat/lon, and `buildOgViewModel` reads
  `payload.location.name` but never `.lat/.lon`.** The coords **are** present on the payload
  (`payload.location = { name, lat, lon }` from `api/weather.js`), so og must: (a) read
  `payload.location.lat/lon`, (b) thread them into `pickWitty`, (c) share the classifier.
  **This is the one real threading gap for region gating.**
- Recommended: put the region classifiers in a **shared module** (alongside `witty-day-tags.js`)
  so app + og enforce from one source — the same single-enforcement-point pattern the day-tags
  already use (`dayAwarePool`).

---

## 7. Ruled-fix log (applied this session — the only wording changes)

1. **AF spelling — applied.** `binnestebuie → binnestebuite` at `rain.af[22]`
   ("Iewers het 'n sambreel net **binnestebuite** gedraai. Oomblik van stilte."). Single
   occurrence in the source; splits regenerated.
2. **"Die lug speel kat en muis." — applied to `partly-cloudy[0]` (owner-ruled).**
   No EN row reads "Sky's playing cat and mouse" verbatim ("mouse" appears nowhere in the bank),
   so the anchor was reported as ambiguous rather than guessed. The rewrite breaks the
   `partly-cloudy.af` `wegkruipertjie` duplicate (§4c), whose two identical AF lines were at
   `[0]` (EN "Sun, hide-and-seek champion of the day.") and `[5]` (EN "Sun's playing
   peek-a-boo."). **Owner ruled `[0]`.** So `partly-cloudy.af[0]` "Son speel wegkruipertjie." →
   **"Die lug speel kat en muis."**; `partly-cloudy.af[5]` keeps "Son speel wegkruipertjie."
   (now unique — the duplicate is resolved).
