# Humour line audit — 2026-09-19

Baken (Opus 5). Diagnosis only: nothing fixed, wired, committed or deployed. Live build checked: `/api/version` = `26c1a0b` (HEAD).

**Verdict.** The November line reached production by an approved route. Al ticked the English on 21 Aug for a photograph that shows jacaranda season, and Maat wired it on 6 Sep. On 15 Sep Baken translated it faithfully, and the item-H gate put the Afrikaans live without a human reading it. From 6 Sep (English) and 15 Sep (Afrikaans) it has served on every week-1 and week-3 Saturday with a clear-sky photograph, in any month, because the bespoke path never checks month or region.

## Files to open

| What | Path |
|---|---|
| EN table (the lines at 342 and 398) | `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\assets\hero-lines.js` |
| AF table (November at 801, "this month" at 1179) | `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\assets\hero-lines-af.js` |
| Serving code (`applyBespokeLine` 2118, `setBackgroundFor` 2149) | `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\assets\app.js` |
| Bank gate (`contextTagAllows` 659, `eligibleWittyPool` 694) | `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\assets\witty-day-tags.js` |
| Al's tick on both EN lines (lines 321 and 327) | `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\review\set-001-lines-bespoke-clear-v3-ruled.json` |
| Same export, original download (21 Aug 15:57) | `C:\Users\27741\Downloads\set-001-lines-bespoke-clear-v3-ruled.json` |
| AF judgement rows N299/N300 (line 11942) | `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\review\af-bespoke-decisions.json` |
| Al's item-H brief (2026-09-15T10:24:45Z) | `C:\Users\27741\.claude\projects\C--Users-27741-OneDrive-Desktop-Probably-weather-new-probably-weather-new-c\964d75a6-897a-4c8e-9bbd-be1917228b5c.jsonl` |

---

## 1. Trace

**What Al saw.** Both lines belong to the same photograph: hash `e9616cb7c61c`, served at `bg/clear/week_1/day/6.webp` and `bg/clear/week_3/day/6.webp`. That photograph has six English lines, and the November line is one of them. The Afrikaans line **is** a translation. It translates the photograph's *other* lawn line. Each language draws its line independently: the memo key is `${lang}:${src}` and each language gets its own `Math.random`. So EN showed line 6 while AF showed the translation of line 5. The runtime harness in §2 reproduces Al's exact pair with draws 0.95 (EN) and 0.70 (AF).

**The condition.** The photograph is in the `clear` folder. `uv` maps to `clear` (`assets/weather-visuals.js:11`), and `heat` has its own folder. So the forecast that day was `clear` or `uv`, not `heat`.

| | EN "…start of November." | EN "…this month than any mower ever will." | AF "…begin van November…" | AF "…hierdie maand…" |
|---|---|---|---|---|
| Written | `27910f3`, 2026-08-21 09:50, **Valk (Fable 5)**, doctrine rewrite. `writtenBy: "Fable 5 (Valk), viewing each photograph"`. Valk's note on the photograph: *"jacaranda petals on the paving… half-brown lawn… Saturday."* Session: `Son-Memory\projects\probably-weather\sessions\2026-08-21-bespoke-doctrine-rewrite.md` | same commit, same writer | `ccbaa1f`, 2026-09-15 15:02, **Baken (Opus 5)**, close-out item H. Row N299, group `new`, verdict `NEW`, score 5, reason blank. Session: `…\sessions\2026-09-15-post-eval-closeout.md` | same commit, row N300, score 5 |
| Ruled | **Al ticked it.** `review/set-001-lines-bespoke-clear-v3-ruled.json`: `ruledBy: "Al, bespoke line review"`, `kept`, round 2, `edited: false`. The file's `generated: "2026-08-19"` is a stale constant from the review page (the draft itself is dated 08-21). The real ruling time is the Downloads mtime, **2026-08-21 15:57**. The repo copy is byte-identical to the download. | **Al ticked it.** Same export, same image | **No Al tick.** The line is in no Al export and was never on `review/af-al.html`. It was written by the gate under Al's item-H instruction (§5) | **No Al tick.** Same as N299 |
| Into repo | Export copied in by `d748068`, 2026-09-05, Opus 5. No session log exists for 09-05 | same | — | — |
| Wired live | `0c81133`, 2026-09-06 16:49, **Maat (Fable 5.1)**, *"Al's rulings: no line cap, every ruled keep on its own photograph"*. Session: `…\sessions\2026-09-06-rotation-day-index-and-wiring-audit.md` | same | `ccbaa1f`, 2026-09-15. Also the commit that opened `applyBespokeLine` to Afrikaans | same |
| Where it lives now | `assets/hero-lines.js:175/342/398` | same keys | `assets/hero-lines-af.js:801` | `assets/hero-lines-af.js:1179` |
| Other files containing it | draft `review/set-001-lines-bespoke-clear-v3.json` (generated 2026-08-21, no ruledBy), `review/tools/clear-v3-batch3.json`, `review/lines-review-clear-v3.html`, `review/line-match-tool-r2.html`, authoring file `review/set-001-lines-bespoke-final.json` (header `generated 2026-08-19`, `ruledBy "Al, bespoke line review rounds 1 and 2"`, stale: the line was appended on 09-06), `review/af-bespoke-decisions.json` (generated 2026-09-15, judge "Baken (Opus 5)") | same | only `review/af-bespoke-decisions.json` and `assets/hero-lines-af.js` | same |
| Live in production | the production chunk `chunks/hero-lines-YUQCXEAA.js` contains it | contains it | `chunks/hero-lines-af-WE3X5SPI.js` contains it | contains it |

**How it reaches the screen.** It comes through the bespoke path, keyed by photograph, not through the condition bank:

1. `setBackgroundFor(condition)` → `buildPickerPaths(folder, …, getRotationWeek(), getRotationDay())` → `chain[0]`.
2. `applyBespokeLine(chain[0])` → `heroCropKey` → `HERO_LINES[key]`.
3. For AF, each English line is mapped through `heroLineAf`, and the pool is the subset that has Afrikaans.
4. One random pick per language and photograph → headline.

---

## 2. Gating

**Answer: bespoke lines never pass through `contextTagAllows` or `eligibleWittyPool`. Yes, a month- or season-bound line can render out of season, and it does.** `applyBespokeLine` takes two inputs, the image `src` and `settings.lang`. Nothing in it reads a date, month or region. The day and time-of-day gates hold only by accident of layout, because the photograph sits in its weekday slot and time folder. Month and region have no stand-in. The file admits it at `witty-day-tags.js:725`: *"This governs the CONDITION BANK only. The bespoke hero path … never calls this function."*

**Runtime proof.** The real bespoke block (`app.js` characters 123319–131927, `__pickerToken` through `setBackgroundFor`) was lifted out and run against the shipped `hero-lines.js`, `hero-lines-af.js`, `image-picker.js`, `weather-visuals.js` and `hero-crop.js`. The clock was faked and `Math.random` swept across the pool. The block contains no reference to `Date`, `month`, `contextTagAllows` or `eligibleWittyPool` (`false`). Every Saturday at 12:00 SAST with condition `uv`:

```
2026-06: 06 w2 -   | 13 w3 NOV | 20 w4 -   | 27 w1 NOV            (EN and AF identical in every row)
2026-07: 04 w2 -   | 11 w3 NOV | 18 w4 -   | 25 w1 NOV
2026-08: 01 w2 -   | 08 w3 NOV | 15 w4 -   | 22 w1 NOV | 29 w2 -
2026-09: 05 w3 NOV | 12 w4 -   | 19 w1 NOV | 26 w2 -
2026-10: 03 w3 NOV | 10 w4 -   | 17 w1 NOV | 24 w2 -   | 31 w3 NOV
2026-11: 07 w4 -   | 14 w1 NOV | 21 w2 -   | 28 w3 NOV
2026-12 … 2027-05: the same two-in-four pattern every month
Sat 2026-09-19 → assets/images/bg/clear/week_1/day/6.webp
  EN rotation (6): …, "That lawn stopped asking the sky for rain somewhere around the start of November.", "The sun has done more to that lawn this month than any mower ever will."
  AF rotation (6): …, "Daardie grasperk het êrens teen die begin van November opgehou…", "Die son het hierdie maand meer…"
  draws 0.95 (en) then 0.70 (af): EN → "The sun has done more…"  |  AF → "Daardie grasperk … November …"   ← Al's pair
```

"NOV" means the November line is in that session's rotation, a one-in-six draw per language. It is eligible in June, July and August (mid-winter) exactly as in November.

**The bank gate works, for contrast.** On a Wednesday noon in Strand, `witty.heat.en` (90 raw lines) yields 46 eligible lines in January and 34 in July. `witty.cold.en` (107 raw) yields 42 in January and 60 in July.

**Tags lost on promotion.** 65 live bespoke lines are bank lines that carried a `months` tag, and 29 carried a `region` tag (17 carried both). Once a line moves onto a photograph, the bespoke path drops those tags. Examples: `partly-cloudy#16` "South African summer admin" (months 10–3) and `cold-clear#3` "Highveld winter…" (Gauteng, months 5–9). Both now serve in any month, in any city.

**Nothing tests for it.** `scripts/verify-bespoke-lines.mjs` and `tests/` contain no month or season check for the bespoke path. The month gate dates from `be06d33` (2026-07-03) and was never carried into the bespoke path when it was built (`cc7921a`, 2026-08-19).

---

## 3. Out-of-season inventory (every live line, five languages)

**Method.** Two lexical scans. The first covered every string in the live `HERO_LINES` (1,519 EN), the live AF subset (1,518) and `WEATHER_COPY` (`witty`, `witty_low_confidence`, `headlines`, `heroLabels`; en/af/zu/xh/st), using per-language month, season, holiday, school, date and event patterns. The second swept for seasonal markers: jacaranda, snow, uniform, load shedding and similar. Every hit was then read by hand.

**Grades.**
- **A** — names a month, a date or a dated event. Wrong most of the year.
- **B** — asserts a season that the photograph's condition does not guarantee.
- **C** — the season matches the condition (winter on cold, summer on heat). Wrong only on off-season cold or hot days.
- **D** — school run or holiday. Fires in school holidays or in term regardless.
- **E** — low risk: sport, "this month", imagery, load shedding.

**Bespoke lines have no tag of any kind.** † marks a line that carried a bank `months` tag before promotion. "AF: gate" means the Afrikaans went live with no Al tick.

### Bespoke — EN, with its AF twin (both live)

| Grade | Id | English (AF where it differs in substance) | Photograph (first slot, ×slots) | EN ruled by | AF |
|---|---|---|---|---|---|
| **A** | N299 | That lawn stopped asking the sky for rain somewhere around the start of November. | clear/week_1/day/6 ×2 | Al (clear-v3) | gate |
| **A** | B212 | Nobody in this dorp has needed a stove since about the second week of December. | heat/week_1/dawn/1 ×4 | Al (heat-v2) | gate |
| **A** | B450 | Clouds are crying like NZ at the 23 Rugby WC! (AF: "…die All Blacks ná die 2023-Wêreldbeker!") | rain/week_1/day/1 ×2 | Al: his own line (`527b8e9`) | gate |
| **B** | N277 | Summer filed its arrival notice this morning; the shirt is the paperwork. | clear/week_1/day/1 ×2 | Al (clear-v3) | gate |
| **B** | N428 | Agapanthus out, hadeda busy, sky empty: high summer is running on schedule. | clear/week_2/day/1 ×2 | Al (clear-v3) | gate |
| **B** | C040 | Cancel everything. This is THE day winter was hiding. (AF drops the winter: "Kanselleer alles. Dis DIÉ dag.") | clear/week_2/day/1 ×2 | Al (bank match) | Al |
| **B** | N220 | Half this street is in summer and the other half is about to be somewhere else. | cloudy/week_2/day/1 ×2 | Al (cloudy-v3) | gate |
| **B** | C100 † | Some clouds. Some sun. South African summer admin. | cloudy/week_1/day/6 ×2 | Al (bank match) | Al |
| **B** | N068 | Pink-grey sky over the robots: winter is on the morning shift too. | cloudy/week_1/dawn/5 ×4 | Al (cloudy-v3) | gate |
| **B** | B459 | Joburg summer rain: arrives at five, soaks everything, gone by supper. | rain/week_1/dusk/3 ×4 | Al (rescues) | Al |
| **B** | B517 | Jacaranda season and a Monday, and the paving is taking both badly. | storm/week_1/night/1 ×4 | Al (round 1) | gate |
| **B** | B004 | The jacaranda is dropping purple on a lawn he has just finished watering. | clear/week_1/dawn/7 ×4 | Al (round 1) | gate |
| **B** | B095 | Every jacaranda on this street is emptying itself onto one man. | wind/week_2/day/3 ×2 | Al (round 1) | gate |
| **B** | B110 | The jacaranda is redecorating the whole road whether you like it or not. | wind/week_2/day/6 ×2 | Al (round 1) | gate |
| **B** | B470 | Jacaranda blossom and stormwater, which is Joburg's least favourite combination. | rain/week_1/night/3 ×4 | Al (round 1) | gate |
| **B** | N419 | Friday evening, snow on the Apostles, and the only queue is for the kettle. | cold/week_1/dusk/5 ×4 | Al (test batch) | gate |
| **B** | N421 | Snow on the mountain. The kind of cold Cape Town frames and hangs on the wall. | cold/week_1/dusk/5 ×4 | Al (test batch) | gate |
| **B** | N425 | Snow on the berg, washing on the line: cold enough to freeze, dry enough to try. | cold/week_2/day/6 ×2 | Al (rescues) | gate |
| C | C218 † | Clear skies, open roads, running nose. The full winter set. (AF drops the winter) | cold-clear/week_1/dawn/4 ×4 | Al | Al |
| C | C222 † | Highveld winter: the only place where you wear two jackets to fetch the post. | cold-clear/week_1/dawn/6 ×4 | Al | Al |
| C | C224 † | The Free State just remembered it has a winter setting. | cold-clear/week_1/dawn/6 ×4 | Al | Al |
| C | C252 † | Clear nights are winter's way of apologising. | cold-clear/week_1/night/5 ×4 | Al | Al |
| C | C189 † | Winter sun: all of the light, none of the heat. Nice try, sun. | cold/week_1/day/1 ×2 | Al | Al |
| C | B388 | Not one cloud, not one degree: a Highveld winter morning doing both at once. | cold-clear/week_1/dawn/4 ×4 | Al (rescues) | gate |
| C | N036 | Frost right up to the dam wall: the Karoo did its winter thing overnight. | cold-clear/week_1/dawn/6 ×4 | Al (rescues) | gate |
| C | N367 | Joburg winter dawn: the view is free; the air charges admission. | cold-clear/week_1/dawn/7 ×4 | Al (rescues) | Al |
| C | B398 | Coats and coffees in full sun: winter in this city photographs like summer. | cold-clear/week_1/day/5 ×4 | Al (rescues) | gate |
| C | B393 | Frost on the grass, steam off the field: winter running weather at its most honest. | cold-clear/week_1/day/7 ×4 | Al (rescues) | Al |
| C | B400 | That washing is not dry; it is preserved. Winter dusk works fast out here. | cold-clear/week_1/dusk/1 ×4 | Al (rescues) | gate |
| C | B412 | Braaiing in beanies under a hard clear sky: winter never cancelled anything here. | cold-clear/week_1/night/6 ×4 | Al (rescues) | gate |
| C | N046 | Small dog, thick jersey, short patrol: winter mornings run on reduced hours. | cold/week_1/dawn/1 ×4 | Al (rescues) | gate |
| C | B353 | Construction finished at nine: one duvet cave, single occupant, no visitors till spring. | cold/week_1/day/5 ×2 | Al (rescues) | gate |
| C | N172 | Your summer clothes can stop volunteering. | cold/week_1/day/6 ×2 | Astra only | gate |
| C | B367 | It is heater season, and the best seat in the house has fur on it. | cold/week_1/dusk/1 ×4 | Al (rescues) | gate |
| C | B368 | The mountain is in there somewhere, wrapped up for the winter. | cold/week_1/dusk/3 ×4 | Al (rescues) | gate |
| C | B381 | Every streetlamp down the road is lighting nobody; winter nights empty a dorp early. | cold/week_1/night/1 ×4 | Al (rescues) | gate |
| C | B378 | Fingerless gloves at a laptop: winter has entered the home office. | cold/week_1/night/4 ×4 | Al (rescues) | gate |
| C | B385 | Frost on the lawn and wors on the grid: a Cape winter compromise. | cold/week_1/night/6 ×4 | Al (rescues) | gate |
| C | B382 | Beanie, snood, torch, book: winter nights build the best reading rooms. | cold/week_1/night/7 ×4 | Al (rescues) | gate |
| C | B361 | Wet road, grey sky, dog in a jersey: winter is fully operational. | cold/week_2/day/1 ×2 | Al (rescues) | gate |
| C | B356 | Socks go on the heater first; feet join later — the winter system works. | cold/week_2/day/3 ×2 | Al (rescues) | gate |
| C | B360 | Chair turned to the heater, blanket up, tea close: winter Sunday, executed correctly. | cold/week_2/day/7 ×2 | Al (rescues) | gate |
| C | B248 | That sprinkler has been the best-value thing in this garden all summer. | heat/week_1/day/7 ×4 | Al (round 1) | gate |
| D | N170 | This light lasts about twenty minutes and the walk to school gets all of it. | clear/week_1/dawn/2 ×4 | Al (clear-v3) | gate |
| D | N192 | Two beanies, one scraper, minus three: the school run starts before the car agrees. | cold-clear/week_1/dawn/3 ×4 | Al (rescues) | gate |
| D | N194 | School bags packed. Hands still defrosting. | cold-clear/week_1/dawn/3 ×4 | Astra only | gate |
| D | B395 | Breath like smoke, frost on the glass, sun already out: Highveld school run. | cold-clear/week_1/day/3 ×4 | Al (rescues) | gate |
| D | N167 | The school run starts with negotiating the car doors. | cold-clear/week_1/day/3 ×4 | Astra only | gate |
| D | N470 | Beanie plus puffer plus school tie: the cold front has reached the uniform. | cold/week_1/dawn/3 ×4 | Al (rescues) | gate |
| D | N473 | School starts soon. Your fingers haven't. | cold/week_1/dawn/3 ×4 | Astra only | gate |
| D | N291 | The school run now involves finding the school. | fog/week_1/dawn/1 ×4 | Astra only | gate |
| D | N432 | Your school shoes will need their own bath. | rain/week_1/dawn/1 ×4 | Astra only | gate |
| D | N433 | Uniform on. Spare uniform suddenly makes sense. | rain/week_1/dawn/1 ×4 | Astra only | gate |
| D | N577 | The school run slows down. The bell doesn't. | rain/week_1/dawn/3 ×4 | Astra only | gate |
| D | N578 | The school still wants them there, unfortunately. | rain/week_1/dawn/3 ×4 | Astra only | gate |
| D | N574 | Dinner is looking like the highlight of your holiday. | fog/week_1/dusk/6 ×4 | Astra only | gate |
| D | N400 | Your holiday photos could have been taken at home. | fog/week_1/dusk/7 ×4 | Astra only | gate |
| E | N300 | The sun has done more to that lawn this month than any mower ever will. | clear/week_1/day/6 ×2 | Al (clear-v3) | gate |
| E | B133 | Every leaf the tree dropped this month is going past them at head height. | wind/week_1/day/1 ×2 | Al (wind) | gate |
| E | C015 | Bottle this one. Open it in winter. | clear/week_1/dawn/2 ×6 | Al | Al |
| E | N519 | The sea keeps its winter colour under a sky like this, whatever the calendar says. | cloudy/week_1/dawn/4 ×4 | Al (cloudy-v3) | gate |
| E | N429 | The agapanthus open for exactly this kind of sky, and they got it. | clear/week_2/day/1 ×2 | Al (clear-v3) | gate |
| E | N199 | Cricket till the light goes, and light like this takes its time going. | clear/week_1/dusk/5 ×4 | Al (clear-v3) | gate |
| E | N076 | Flat grey over the rugby field: perfect kicking weather, no wind to blame. | cloudy/week_1/day/3 ×2 | Al (cloudy-v3) | gate |
| E | C235 | Lekker koud, but the rugby fields are about to look perfect. | cold-clear/week_1/day/6 ×4 | Al | Al |
| E | C236 † | Perfect rugby weather. For the spectators with blankets. | cold-clear/week_1/day/6 ×4 | Al | Al |
| E | B392 | Blue sky, gold grass, white edges: a Highveld rugby morning in full kit. | cold-clear/week_1/day/6 ×4 | Al (rescues) | gate |
| E | C344 | Nature's doing its own load shedding. (see footnote 1) | storm/week_1/dusk/7 ×4 | Al | Al |

Counts: **A 3 · B 15 · C 25 · D 14 · E 11 = 68 bespoke lines, EN and AF both live.** No Afrikaans line adds a temporal reference its English lacks. Two AF lines drop one (C040, C218). "Slots" counts the week_1–4 grid paths the photograph occupies. Both key shapes ship: `bg/…` and `bg-canonical/<sha>`.

### Condition bank (en/af/zu/xh/st share each index's tag)

The bank serves zu/xh/st in the app, every share card (`api/og.js`), and the EN/AF fallback. It is gated by `months` and `region`, with the month taken from the searched location.

**Temporal lines with no `months` tag** (these fire in any month; the languages listed have the line):

| Grade | Id | English | Tag | Languages |
|---|---|---|---|---|
| A | witty:clear#21 | This is the weather you'll miss in December traffic. | none | en af zu xh st |
| B | witty:clear#71 | Cancel everything. This is THE day winter was hiding. | day, western-cape | en af zu xh st |
| B | witty:clear#63 | Highveld winter flex: laundry dry before the kettle's even done. | day, highveld | en af zu xh st |
| B | witty:clear#72 | Off-season beach: same ocean, zero fight for parking. | day, western-cape | en af zu xh st |
| B | witty:fog#80 | Every glow down there is someone else who also can't believe it's already winter. | night, western-cape | en af xh st |
| C | witty:cold-clear#12 | Pretoria-bare-jacaranda energy. Beautiful and bleak. | gauteng | en af zu xh st (twin not checked by eye) |
| C | witty_low_confidence:cold#3 | Cold's the bet. Don't trust a sunny window in winter. | none | en af zu xh st |
| D | witty:cold-clear#14 | The kids still going to school in shorts. They know things we don't. | none | en af zu xh st |
| D | witty:rain#67 | School shoes' greatest enemy has just landed. | day | en af zu xh st |
| E | witty:clear#37 | Bottle this one. Open it in winter. | none | en af zu xh st |
| E | witty:cold-clear#11 | Lekker koud, but the rugby fields are about to look perfect. | none | en af zu xh st |
| E | witty:rain#74 | In the Karoo you watch rain the way other people watch rugby. | evening, karoo | en af zu xh st |
| E | witty:fog#16 | The mountains are on holiday today. | none | en af zu xh st |
| E | witty:storm#5 · clear#9 · clear#29 · night#0 | load-shedding lines (footnote 1) | none | per index |

**Temporal lines correctly month-gated** (no action implied): `rain#37`, `rain#46` (Currie Cup), `partly-cloudy#16`, `cold#45 #47 #52 #53 #61 #62 #65 #79 #83 #86 #99 #101 #102 #105`, `cold-clear#1 #3 #40 #44 #46 #50 #51 #53` ("until September") `#58 #61 #65 #66 #68 #89 #102 #108 #111`, `heat#40` (uniform) `#55 #79 #87`.

**zu/xh/st.** The raw scan hit 46/54/40 lines. Of these, 27/32/26 are twins of the flagged EN lines above and carry the same tag. The rest are false positives: *uhlobo* = kind, *umhlobo* = friend, *inyanga* = moon, *hlakola* = cancel, *phomolo* = rest/leave, *ukuhlolwa* = test/review. No zu/xh/st line adds a date or season its English lacks. This scan is lexical. I don't read zu/xh/st natively, so a date expressed some way I didn't pattern would not show.

**Excluded as false positives (EN):** `wind#26` and B167 (South-Easter), `night#8` and C069 (cricket the insect), `partly-cloudy#12` ("braai day" = weekend, not 24 Sept).

**For the ads.** A screenshot is at risk from any grade A or B line. Nothing prevents N299 appearing on the Saturdays of 3, 17 and 31 Oct, 14 and 28 Nov, and so on, whenever the sky is clear.

---

## 4. The record

### Wiring ledger since the bespoke era began (`cc7921a`, 2026-08-19)

The seat comes from each commit's Co-Authored-By trailer: Opus 5 = Baken, Fable 5 = Valk, Fable 5.1 = Maat. Line counts come from diffing the served tables at each commit against its parent.

| SHA | Date | Seat | What it wired | Al-ruled export behind it? |
|---|---|---|---|---|
| `e42ae7c` | 08-19 | Opus 5 | authoring file `final.json` (not served) | ✓ `set-001-lines-bespoke-ruled.json` + `…round2-ruled.json` (Al, 08-18) |
| `cc7921a` | 08-19 | Opus 5 | `hero-lines.js` created: +210 EN, 42 photographs | ✓ 210/210 |
| `a00cef8` | 08-21 | Fable 5 | +169 EN (wind 60, clear 30, heat 79) | ✓ 169/169 (`wind-ruled`, `clear-v2-ruled`, `heat-v2-ruled`) |
| `bb5e9c9` | 09-06 | Opus 5 | +455 EN (Al's round-1 bank matches + 156 rescues) | ✓ 455/455. `set-001-line-matches-ruled.json` (Al, 08-27) + `astra-kill-rescues.json` (Al spot-check). **The rescues export is only in `C:\Users\27741\Downloads\`, not in the repo** |
| `a7d9317` `324d6b7` `4f48c14` | 09-06 | Opus 5 | +32, +2, +15 EN: Al's hand-written lines | ✓ `al-bare-photo-lines-2026-09-06.json`, `al-written-lines-2026-09-06.json` |
| `6ae66e0` `99f7b2a` | 09-06 | Opus 5 / Fable 5.1 | re-keying and grid layout only; 0 text change | n/a |
| `0c81133` | 09-06 | Fable 5.1 | +636 EN, **both lawn lines among them** | ✓ 226 Al-ticked (clear-v3, cloudy-v3, test batch, rescues). ⚠ **410 rest only on the six `*-v3-astra-ruled.json` files**: `ruledBy: "Astra editorial review, adopted as Al's ruling (his instruction, 2026-09-05; veto list: none)"` |
| `d6dd5dd` | 09-08 | Fable 5.1 | `hero-lines-af.js` created, 725 AF rows, **not served** (app was EN-only) | 324 match Al's July AF rulings; 375 accepted by two machine judges; 158 sent to Al on `af-judge-al.html`. **No export of that sheet exists** |
| `993f08e` | 09-15 | Opus 5 | lazy chunk; 0 text change | n/a |
| `ccbaa1f` | 09-15 | Opus 5 | **AF goes live**: +803/−47 AF rows (1,481); `applyBespokeLine` opened for AF; includes N299 and N300 | ⚠ no per-line Al export. Written by the gate Al specified in item H (§5). 1 row matches an Al text |
| `7c354ce` | 09-15 | Opus 5 | +37 AF, Al's `af-al.html` rulings | ✓ `af-al-decisions.json`. The repo copy differs from the download at C098 (apostrophe normalised, disclosed in the commit) |
| `891af5c` | 09-16 | Opus 5 | C333 bedonerd → bedonnerd | commit says "Al's spelling correction". The repo copy of Al's export was edited to match; no separate export |
| `69d6c54` | 09-16 | Opus 5 | photo reroll, key only | n/a |
| bank `3f56609` | 09-05 | Opus 5 | weekend routing additive; no text | Al's ruling per the commit; no export |
| bank `1f71b67` | 09-06 | Fable 5.1 | 4 AF diacritics (wêreld, reën ×3) | Al's ruling in session; no export file |
| bank `f436774` | 09-08 | Fable 5.1 | 515 Sesotho orthography rows, 1 zu typo, 2 AF fixes | Al's "accept all" per the session log; no export file |
| bank `6ea347d` | 09-15 | Opus 5 | zu/xh/st: 58 served lines corrected, 52 left for a native | Baken's judgement under lang-check. No Al export is possible and no native sign-off yet |
| bank `9458188` `0a75ca1` `a21425d` | 09-16 | Opus 5 | xh/st headline punctuation and spelling (headlines, not humour) | none |

Commits `27910f3` (08-21, Fable 5: the 699 draft lines) and `d748068` (09-05, Opus 5: the clear-v3 export copied in; the six Astra buckets built) wired nothing, but sit upstream of the November line.

**Session logs are missing** for every Opus 5 wiring day except 09-15: 08-19 (`e42ae7c`, `cc7921a`), 09-05 (`d748068`, `3f56609`), 09-06 (`bb5e9c9`…`4f48c14`) and 09-16. The only record for those days is the commit messages.

### Live lines with no Al-ruled export behind them

| Language / path | Live | Al-ruled (own text) | Only Astra's adopted verdict | **No Al export** |
|---|---|---|---|---|
| EN bespoke | 1,519 | 1,109 | 410 | **0** |
| AF bespoke | 1,518 | 376 | — | **1,142** (gate under item H) |
| EN bank (witty + low-confidence) | 969 | 969 | — | **0** |
| AF bank | 969 | 964 (incl. Al's 54 July rewordings in `al-line-rulings.json` `comment`) | — | **5**: the reën/wêreld/troufoto fixes, ruled in session 06/08 Sep, no export file |
| zu bank | 921 | n/a (no Al export can exist) | — | **921**. EN parent Al-ruled 921/921; native residue 14 |
| xh bank | 887 | n/a | — | **887**. EN parent 887/887; residue 17 |
| st bank | 915 | n/a | — | **915**. EN parent 915/915; residue 21 |

The ruled universe checked: all `review/*-ruled.json`, `al-line-rulings`, `al-pair-rulings`, `meme-batch-2-rulings`, `set-001-bank-ruled`, `al-*-lines-2026-09-06`, `af-al-decisions`, plus two Al exports that exist only in Downloads (`set-001-line-matches-r2-ruled.json`, `astra-kill-rescues.json`). Matching is on exact text after whitespace and quote normalisation.

---

## 5. Afrikaans provenance

- **How the AF lines were made.** The 1,518 live bespoke AF lines come from four sources:
  - **346 bank canon.** The native-reviewed AF bank, shown to Al beside the English and ruled by him in July (`al-line-rulings.json`, 54 of them his own rewordings). Some bank lines are his own writing (`review/af-gapfill.md`).
  - **446 + 84 + 3 blue rows.** Transcreated by Baken on 09-06 (`5b952ff`), judged by Fable and Astra on 09-08, then re-judged by Baken on 09-15.
  - **635 new rows.** Transcreated and scored by Baken on 09-15 (`ccbaa1f`), a write pass whose judge was also its writer.
  - **37 rows.** Ruled by Al on `af-al.html`.
- **Translation or independent?** Every AF bespoke line is keyed to one EN line (`HERO_LINES_AF` maps EN → AF). They are transcreations, not independent text. The screen can still show a non-matching pair, because the pick is drawn per language (§1).
- **Shipped without Al's approval?** Yes: **1,142 live AF lines, the November line (N299) included, have never been in front of Al.** That followed his own instruction. Al's brief, 2026-09-15, item H:
  > *"Wire, through the existing language gate … only lines that are KEEP or a proposal scoring ≥4 with zero lang-check flags. Everything else goes to one small review/af-al.html sheet for Al."*

  The gate did what the brief asked. It had no reason to stop N299: `scripts/lang-check/lib/af-content.mjs` screens for added weekdays and braai only, with no month or season check, and the English it translates already said November. The 158-row `af-judge-al.html` sheet from 09-08 was never exported by Al. Item H told Baken to judge every blue row, which absorbed it.
- **Stacked machine judgement.** 409 of the live NEW AF lines translate English lines whose only ruling is Astra's verdict, adopted wholesale on 09-05. No human ticked either language on those lines, apart from any of the 17 NEW rows Al ruled on `af-al.html`.

---

**Footnotes.**
1. Load-shedding lines are live: bespoke C344 (Al-ticked, both languages) and bank `storm#5`, `clear#9`, `clear#29`, `night#0`. `CLAUDE.md` says "No Eskom jokes on home screen (removed — too dated/negative)". This is out of scope; I'm flagging it only.
2. The AF bank line `storm#14` still reads "bedonerd". Only the bespoke row C333 was corrected in `891af5c`.
3. The photograph behind N299 (`e9616cb7c61c`) shows jacaranda petals, so the picture is itself seasonal. A month gate on the line alone would not fully fix that pairing.

*Runtime harness: scratchpad `gate-runtime.mjs` / `gate-runtime-2.mjs` (not committed). It lifts `app.js` from `  let __pickerToken = 0;` to `  function createParticles(`, stubs the DOM, imports, clock and `Math.random`, then calls `setBackgroundFor('uv')` per Saturday for `en` and `af`. Inventory and ledger: scratchpad `audit.mjs`, `ledger.mjs`, `rows.mjs`.*
