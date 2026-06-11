# SA2 — Emoji + time-of-day fix

## Root cause (one-liner)

`assets/app.js:1257-1267` `getWeatherIcon(rp, cp, tc, isNight)` only consulted
`isNight` for the **clear** fallback. Every other branch (rain-possible 🌦️,
partly cloudy ⛅, cloudy ☁️, heat 🔥, cold ❄️) returned a glyph that
either contained a sun (🌦️, ⛅, ☀️) or had no day/night differentiation.
The Hourly tab at 20:00 with rain in the forecast therefore rendered
🌦️ — the "sun-behind-rain-cloud" glyph — i.e. a visible sun at night.

Same isDay-blind logic existed in the search-result emoji helper
`conditionEmoji` at `assets/app.js:329`, which also baked `☀️` into the
`clear` arm regardless of time.

The three compute functions (`computeSkyCondition`, `computeTodaysHero`,
`computeHomeDisplayCondition`) are **not** the source of the bug — they
produce condition keys correctly. The bug lives one layer down, in the
visual glyph picker that consumes those keys.

## Fix approach

New module `assets/weather-emoji.js` exports:

- `pickConditionEmojiForTime(condition, isDay)` — single source of truth.
  Looks up a `{ day, night }` pair per canonical condition key.
- `pickHourlyEmoji({ rainPct, cloudPct, tempC, isNight })` — preserves the
  legacy branch order of `getWeatherIcon` (cold → rain → heat → cloud → cold
  → clear) but routes every branch through `pickConditionEmojiForTime` so
  `isNight` is honoured everywhere, not just the clear fallback.

`assets/app.js`:

- `getWeatherIcon` now delegates to `pickHourlyEmoji`. All four call-sites
  (Hourly tab L1286, Week tab L1311, Day detail hourly L1382, Day detail
  summary L1397) pick up the fix for free.
- `conditionEmoji` now delegates to `pickConditionEmojiForTime`.
  Search/mini-card callers pass `isDay = true` by default since those
  cards don't carry a local hour — daytime glyph is the safe default and
  matches existing behaviour for the daytime case.

## Cloud day/night differentiation — approach taken

**Chose: emoji-pair lookup (no CSS filter, no overlay).**

Why not CSS `filter: brightness(0.7)`: Apple/Windows/Android emoji fonts
render colour glyphs as a raster bitmap. `brightness()` makes them muddy
in unpredictable ways — the sun in ⛅ goes orange-brown rather than
"hiding" the sun.

Why not a backdrop overlay: would require structural DOM changes around
every emoji span (Hourly, Week, Day detail, search results). Out of
scope for a visual fix and brittle across browsers.

Why the pair lookup works:

- `partly-cloudy` day → ⛅ (sun behind cloud, reads "some sun, some
  cloud").
- `partly-cloudy` night → ☁️ (plain cloud — the sun arc is gone, but
  the cloud read survives).
- `cloudy` day → ☁️, `cloudy` night → ☁️ (cloudy already had no sun;
  kept consistent).
- `rain-possible` day → 🌦️ (sun behind rain-cloud), night → 🌧️.

The differentiation between `partly-cloudy` and `cloudy` is now carried
by day-time only (⛅ vs ☁️). At night both collapse to ☁️ — accepted
trade-off since there is no widely-rendered "moon behind cloud" glyph
that reads cleanly across emoji fonts. `🌥️` and `🌤️` (sun-behind-cloud
variants) were rejected for the same sun-at-night reason.

## Test delta

- Baseline: 320 tests / 22 files
- After: 963 tests / 23 files
- Delta: **+643 tests / +1 file** (target was ≥40 — comfortably exceeded
  because of the `condition × hour 0-23` sweep)

New file: `tests/emoji-time-of-day.test.js` covering:

1. Every condition × every hour 0-23 — no sun glyph at night.
2. Direct 20:00 sun-at-night regression (`rain-possible`, `partly-cloudy`,
   `clear`, `uv`).
3. Cloud day/night differentiation (⛅ vs ☁️).
4. `pickHourlyEmoji` branch parity with the legacy `getWeatherIcon` order.
5. Hour-by-hour sweep guarding against future regressions.
6. Map contract (every entry has day + night, unknown keys fall back).

## Service worker bump

`sw.js:6` → `pw-v2026-05-12-002`.

## Deferred-consolidation follow-up

The three render functions (`computeSkyCondition`, `computeTodaysHero`,
`computeHomeDisplayCondition`) at `assets/app.js:582-700` still each make
their own `isDay = norm.isDay !== false` decision. The bug fixed here
lived in the emoji layer downstream, so consolidation was not required
for correctness. However, the duplication remains a footgun — a future
agent should fold the three into a shared `decideRenderState(norm)` that
returns `{ skyCondition, hero, displayCondition, isDay }` so any new
isDay-aware logic only has to be written once.

Also worth tracking: `getWeatherIcon` is called four times in `app.js`
(L1286, L1311, L1382, L1397). Two of those don't pass `isNight` at all
(daily rows) — fine for now because daily summaries represent the day,
but if anyone adds night-aware daily badges later, those call-sites
will silently fall back to "day" glyphs.

## Constraints respected

- No changes to `api/weather.js` (visual layer only).
- No translation/copy changes.
- The three compute functions are untouched.
- No PR merge.
