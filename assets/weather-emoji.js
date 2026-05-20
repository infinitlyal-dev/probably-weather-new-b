// Probably Weather — emoji selection helpers (visual layer only)
// Picks a weather emoji given a condition key and whether it is night.
// Notes on glyph choices:
// - We avoid the bare-sun "☀️" and partly-sunny "⛅" / "🌦️" at night because
//   browser emoji fonts render them with an obvious sun, which looks wrong
//   after sunset (the "20:00 sun-with-rain-cloud" bug).
// - For cloudy day vs night we use ⛅ (sun behind cloud) for day and ☁️ for
//   night so the cloud read still has day/night differentiation without
//   relying on CSS filters that change emoji colour unpredictably across
//   browsers/OS emoji fonts.
// - Rain at night uses 🌧️ (cloud + rain, no sun) and rain at day uses 🌦️
//   (sun behind rain cloud) — the same logic is mirrored for partly cloudy.

// Map of canonical condition keys → { day, night } glyph pair.
const CONDITION_EMOJI_MAP = {
  thunder:         { day: '⛈️', night: '⛈️' },
  storm:           { day: '⛈️', night: '⛈️' },
  hail:            { day: '🌨️', night: '🌨️' },
  rain:            { day: '🌧️', night: '🌧️' },
  'rain-possible': { day: '🌦️', night: '🌧️' },
  cloudy:          { day: '☁️',  night: '☁️'  },
  'partly-cloudy': { day: '⛅',  night: '☁️'  },
  fog:             { day: '🌫️', night: '🌫️' },
  wind:            { day: '💨',  night: '💨'  },
  cold:            { day: '🧥',  night: '🧥'  },
  heat:            { day: '🔥',  night: '🔥'  },
  hot:             { day: '🔥',  night: '🔥'  },
  uv:              { day: '☀️',  night: '🌙'  },
  clear:           { day: '☀️',  night: '🌙'  },
};

const DEFAULT_PAIR = { day: '⛅', night: '☁️' };

export function pickConditionEmojiForTime(condition, isDay) {
  const key = String(condition || '').toLowerCase();
  const pair = CONDITION_EMOJI_MAP[key] || DEFAULT_PAIR;
  return isDay === false ? pair.night : pair.day;
}

// Hourly row icon: rain probability + cloud cover + temp, plus isNight.
// `condition` is the optional per-hour categorised condition the API attaches
// to each hourly entry (categorizeDesc in api/weather.js).
//
// Cloud thresholds here MIRROR deriveCondition() in api/weather.js
// (partly-cloudy >= 30, mostly/overcast cloudy >= 55) so the hourly icon
// agrees with the home hero's consensus condition. The previous >= 40
// partly-cloudy floor left the 30-39% cloud band rendering a bare ☀️ while
// the home headline already read "partly cloudy" — Al's 2026-05-19 bug.
export function pickHourlyEmoji({ rainPct, cloudPct, tempC, isNight, condition }) {
  const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
  const isDay = !isNight;
  const cond = String(condition || '').toLowerCase();

  // categorizeDesc detects thunder and fog reliably, and the numeric ladder
  // below has no weather-code input so it could never surface them. Honour
  // those two directly. categorizeDesc is NOT reliable for the
  // clear/partly/cloudy split (it collapses "partly cloudy" into "clear"),
  // so every other key falls through to the cloud-cover ladder.
  if (cond === 'storm' || cond === 'thunder') return pickConditionEmojiForTime('storm', isDay);
  if (cond === 'fog') return pickConditionEmojiForTime('fog', isDay);

  if (isNum(tempC) && tempC <= 0)        return pickConditionEmojiForTime('cold', isDay);
  if (isNum(rainPct) && rainPct >= 50)   return pickConditionEmojiForTime('rain', isDay);
  if (isNum(rainPct) && rainPct >= 30)   return pickConditionEmojiForTime('rain-possible', isDay);
  if (isNum(tempC) && tempC >= 35)       return pickConditionEmojiForTime('heat', isDay);
  if (isNum(cloudPct) && cloudPct >= 55) return pickConditionEmojiForTime('cloudy', isDay);
  if (isNum(cloudPct) && cloudPct >= 30) return pickConditionEmojiForTime('partly-cloudy', isDay);
  if (isNum(tempC) && tempC <= 10)       return pickConditionEmojiForTime('cold', isDay);
  return pickConditionEmojiForTime('clear', isDay);
}

// Small-icon variant used in search results / mini cards. Keeps the same
// day/night discipline as the main map.
export function pickSearchResultEmoji(conditionKey, isDay = true) {
  return pickConditionEmojiForTime(conditionKey, isDay);
}

export const __WEATHER_EMOJI_MAP = CONDITION_EMOJI_MAP;
