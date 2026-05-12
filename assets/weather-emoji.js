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
  cold:            { day: '❄️',  night: '❄️'  },
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

// Hourly/daily row icon: rain probability + cloud cover + temp, plus isNight.
// Mirrors the legacy getWeatherIcon in assets/app.js but routes through
// pickConditionEmojiForTime so day/night is honoured for every branch.
export function pickHourlyEmoji({ rainPct, cloudPct, tempC, isNight }) {
  const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
  const isDay = !isNight;
  if (isNum(tempC) && tempC <= 0) return pickConditionEmojiForTime('cold', isDay);
  if (isNum(rainPct) && rainPct >= 50) return pickConditionEmojiForTime('rain', isDay);
  if (isNum(rainPct) && rainPct >= 30) return pickConditionEmojiForTime('rain-possible', isDay);
  if (isNum(tempC) && tempC >= 35) return pickConditionEmojiForTime('heat', isDay);
  if (isNum(cloudPct) && cloudPct >= 70) return pickConditionEmojiForTime('cloudy', isDay);
  if (isNum(cloudPct) && cloudPct >= 40) return pickConditionEmojiForTime('partly-cloudy', isDay);
  if (isNum(tempC) && tempC <= 10) return pickConditionEmojiForTime('cold', isDay);
  return pickConditionEmojiForTime('clear', isDay);
}

// Small-icon variant used in search results / mini cards. Keeps the same
// day/night discipline as the main map.
export function pickSearchResultEmoji(conditionKey, isDay = true) {
  return pickConditionEmojiForTime(conditionKey, isDay);
}

export const __WEATHER_EMOJI_MAP = CONDITION_EMOJI_MAP;
