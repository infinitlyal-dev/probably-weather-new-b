# Cold-Clear Implementation Report

Date: 2026-05-26.
Task: wire the `cold-clear` condition fully across the Probably Weather app — algorithm + emoji + 5-language copy + routing + tests + adversarial review (code + copy).

Result: 112 pre-staged WebP images for the cold-clear bucket are now reachable from the Highveld dry-cold-with-blue-sky weather scenarios.

---

## Trigger logic

Cold-clear is emitted by `deriveCondition()` in `api/weather.js` when **all five gates** are satisfied. Position in the priority ladder: directly after the storm-desc rung and before all other branches.

```js
const isPrecipOrFogDesc =
  d.includes('snow') || d.includes('sleet') || d.includes('ice') ||
  d.includes('hail') || d.includes('blizzard') || d.includes('freezing') ||
  d.includes('rain') || d.includes('drizzle') || d.includes('shower') ||
  d.includes('precip') || d.includes('fog') || d.includes('mist') ||
  d.includes('haze') || d.includes('thunder') || d.includes('storm');

const hasClearSkySignal =
  (isNum(cloudPct) && cloudPct < 30) ||
  (!isNum(cloudPct) && (d.includes('clear') || d.includes('sunny') || d.includes('fair')));

const hasColdSignal =
  (isNum(feelsLikeC) && feelsLikeC <= 12) ||
  (isNum(dailyLowC)  && dailyLowC  <= 6)  ||
  (isNum(tempC)      && tempC      <= 12);

const isDryDay = isNum(rainChance) ? rainChance < 20 : !isPrecipOrFogDesc;
const dailyMaxAllowsColdClear = !isNum(dailyHighC) || dailyHighC <= 18;

if (hasColdSignal && hasClearSkySignal && isDryDay && !isPrecipOrFogDesc && dailyMaxAllowsColdClear) {
  return { key: 'cold-clear', reason: 'dry-cold-clear-sky' };
}
```

### What fires it

- A 7am Bloemfontein morning at 4°C with clear sky → cold-clear
- A Joburg July day with daily high 12°C, low 2°C, clear → cold-clear
- A Karoo winter day with current 8°C, no rain expected, clear sky → cold-clear

### What does NOT fire it

- Cold + overcast (clouds ≥ 30%) → routes to regular `cold`
- Cold + rain/snow/fog desc → routes to `rain` / `cold` / `fog` respectively
- Cold morning that warms above 18°C → falls through to UV or clear (correct: the day's headline shouldn't be cold-clear if the afternoon is mild/warm)
- Mild day with clear sky → falls through to `clear`

### Daily vs Now semantics

| Callsite | Has `feelsLikeC` | `tempC` represents | Behavior |
|----------|------------------|---------------------|----------|
| NOW | yes | current temp | Live moment classification — uses all 3 cold signals |
| DAILY | no | daily high (`highC`) | Day-overall classification — relies on `dailyLowC` + `dailyHighC` ceiling |

The daily callsite was updated to pass `dailyHighC: highC` so the ceiling gate works for daily classification too.

---

## Vote-bucket routing

```js
case 'cold': case 'cold-clear': return 'cold';
```

Per task spec: cold-clear votes count as cold for ensemble agreement. This means a payload where 3 sources say cold + 1 source says cold-clear still reads as 4-vote cold consensus (not 3+1 split).

---

## Copy samples per language

Every section (heroLabels, headlines, witty × 5 languages) was reviewed by the codex-rescue subagent for AI-translation tells, awkward phrasing, soul-overlap with regular `cold` / `clear`, and tonal accuracy.

### English (CLEAN — ship-ready)

- Hero: `"Cold but clear"`
- Headline: `"Cold but stunning."`
- Witty (20 lines, sample):
  - `"Cold enough to bite, blue enough to forgive it."`
  - `"Highveld winter: visible breath, golden light, no apologies."`
  - `"Frost on the windscreen, blue on the horizon."`
  - `"Highveld dry-cold. Bring layers, bring sunglasses."`
  - `"You'll complain. You'll also take photos."`

### Afrikaans (CLEAN — ship-ready)

- Hero: `"Koud maar helder"`
- Headline: `"Koud maar pragtig."`
- Witty (20 lines, sample):
  - `"Vrek koud, maar die hemel doen sy ding."`
  - `"Hoëveld-winter: sigbare asem, goue lig, geen verskonings nie."`
  - `"Ryp op die voorruit, blou aan die horison."`
  - `"Hoëveldse droë koue. Trek lae aan, vat 'n sonbril."`

### Zulu (NATIVE-REVIEW PENDING)

- Hero: `"Kubanda, izulu licwebile"`
- Headline: `"Kubanda, kodwa izulu licwebe cwe."`
- Witty (20 lines, sample):
  - `"Kuyabanda impela, kodwa bheka leso sibhakabhaka."`
  - `"Ubusika baseHighveld: uphefumula kuze kubonakale umoya, ilanga likhazimula njengegolide."`
  - `"IBloemfontein ngo-7 ekuseni: kubanda kuze kubuhlungu, kodwa kuhle."`

### Xhosa (NATIVE-REVIEW PENDING)

- Hero: `"Kubanda, kucwebile"`
- Headline: `"Kubanda, kodwa mhle umhla."`
- Witty (19 lines, sample):
  - `"YiBloemfontein ngo-7 ekuseni: kubanda kabuhlungu, kodwa kuhle."`
  - `"Ukubanda okomileyo kweHighveld. Phatha ijezi, uthathe neglasi zelanga."`

### Sesotho (NATIVE-REVIEW PENDING)

- Hero: `"Hoa bata, leholimo le hlakile"`
- Headline: `"Hoa bata, empa leholimo le letle."`
- Witty (19 lines, sample):
  - `"Bloemfontein ka hora ea bosupa: ho bata, empa ho le botle."`
  - `"Serame se ommeng sa Highveld. Tlisa jase, tlisa le likhalase tsa letsatsi."`
  - `"Ke leholimo la likhalase tsa letsatsi le sekhafo. Tsohle lia hlokahala, tsohle li ntle."`

---

## Adversarial review summary

| Subject | Round 1 verdict | Round 2 verdict | Items applied |
|---------|----------------|-----------------|---------------|
| Code (algorithm + routing) | 22 findings — BUGS REMAIN | CLEAN | 9 in-scope critical/major + 13 deferred-with-justification |
| EN copy | NEEDS WORK | CLEAN | 7 majors |
| AF copy | NEEDS WORK | CLEAN | 4 criticals + 7 majors + 4 minors |
| ZU copy | NEEDS WORK | NEEDS WORK (round-2 polish applied) | 4 criticals + 10 majors + 9 round-2 polish — still needs native |
| XH copy | NEEDS WORK | CLEAN-FOR-PRE-NATIVE-REVIEW | 6 criticals + 6 majors + 6 minors |
| ST copy | NEEDS WORK | NEEDS WORK (round-2 polish applied) | 5 criticals + 8 majors + 7 minors + 8 round-2 polish — still needs native |

---

## Native-review-pending entries

The following copy entries are AI-drafted by Codex (a non-native model). Codex caught the most obvious AI-translation tells and grammar errors, but final naturalness signals require a real native speaker:

- All `zu` entries in `heroLabels['cold-clear']`, `headlines['cold-clear']`, `witty['cold-clear']`
- All `xh` entries in the same three sections
- All `st` entries in the same three sections

This mirrors the existing `witty_low_confidence._meta.requires_native_review: ['zu', 'xh', 'st']` pattern in `weather-copy.js`. Recommended action at next native-speaker session: read these out loud, swap stiff phrasings, confirm code-switching (`lekker koud`, `i-special effects`, `scarf`) lands in each language.

---

## Files changed

1. `api/weather.js` — added cold-clear branch in `deriveCondition`, updated `conditionKeyToVoteBucket`, threaded `dailyLowC` + `dailyHighC` through both callsites
2. `assets/weather-emoji.js` — added cold-clear emoji entry (🥶 day + night)
3. `assets/weather-copy.js` — added cold-clear entries in heroLabels + headlines + witty (5 languages, 19-20 witty lines each)
4. `assets/app.js` — added cold-clear handling in `computeTodaysHero`, `computeHomeDisplayCondition`, `getDayBadge`
5. `middleware.js` — added `cold-clear` to `CONDITION_ALLOWLIST`
6. `tools/build-og-images.mjs` — added `cold-clear` entry in CONDITIONS list (static-OG-cards builder)
7. `tests/cold-clear.test.js` — NEW, 49 cases covering algorithm + vote bucket + emoji + 5-language copy + middleware allowlist
8. `tests/weather-logic-phase-a.test.js` — updated UV boundary test with cloudPct override
9. `tests/weather-logic-phase-b.test.js` — updated chilly-with-daily-gate test with cloudPct override
10. `docs/cold-clear-{code,copy-en,copy-af,copy-zu,copy-xh,copy-st}-review-2026-05-24.md` — adversarial review logs
11. `docs/cold-clear-implementation-report.md` — this file

---

## Final test count

4,485 / 4,485 passing. Baseline was 4,436 — added 49 new cold-clear tests + 2 pre-existing test updates (net +49).

---

## Open questions for Al

1. **Native-speaker review for zu/xh/st**: when's the next session? Marked all three as pending in `docs/cold-clear-copy-review-{zu,xh,st}-2026-05-24.md`.
2. **`dailyHighC <= 18` ceiling threshold**: chose 18°C as the upper bound for cold-clear to fire on a daily call. A day that warms to 19°C with a clear morning would fall through to UV/clear instead of cold-clear. If your sense of high-veld winter is that days reach 20-22°C and the morning still feels cold-clear, raise this to 22.
3. **`tempC <= 12` cold signal threshold**: A 12.5°C clear-sky reading falls through. If you want cold-clear to fire more eagerly, bump to 14.
4. **Emoji choice (🥶)**: deliberately single-glyph to avoid iOS Safari composite-emoji issues. If you want a more distinctive cold-clear icon (e.g. `❄️☀️` composite), let me know.
5. **Cold-clear badge sharing with cold**: `getDayBadge` returns the `cold` translation for cold-clear days. Acceptable per task spec but if you want a distinct "Cold-clear" badge, the translation file needs a new `badges.cold-clear` entry in 5 languages.
