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
  // cold-clear: Highveld dry-cold under blue sky. The cold-face emoji 🥶 captures
  // the "deceptively beautiful" register better than ❄️ (which would conflict
  // with the snow particles rendered for plain 'cold'). Single glyph both day
  // and night — no composite sequences (iOS Safari renders multi-emoji side by
  // side which can break tight UI badges).
  'cold-clear':    { day: '🥶',  night: '🥶'  },
  heat:            { day: '🔥',  night: '🔥'  },
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

// ---------------------------------------------------------------------------
// Bug 2b (2026-05-24) — real solar day/night for hourly emojis.
//
// The hourly forecast rows used to hardcode "night" as hour >= 20 || hour < 5.
// On 2026-05-21 Cape Town's sunset was ~17:45, so the 18:00 and 19:00 slots
// rendered a bright ☀️ nearly two hours after dark. These helpers replace the
// clock band with the day's actual sunrise/sunset.
// ---------------------------------------------------------------------------

/**
 * Parse a local-labelled ISO timestamp ("2026-05-21T17:45", no timezone) to
 * minutes since local midnight. Open-Meteo / the PW API emit times in exactly
 * this shape. Returns null when the input is missing or unparseable.
 */
export function parseLocalIsoMinutes(iso) {
  if (typeof iso !== 'string' || iso.length < 16) return null;
  const h = parseInt(iso.slice(11, 13), 10);
  const m = parseInt(iso.slice(14, 16), 10);
  return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : null;
}

/**
 * Is a given hourly slot in daylight?
 *
 * Compares the slot's MIDPOINT (hour:30) against the day's sunrise/sunset.
 * The comparison is hour-of-day vs time-of-day, so it is inherently correct
 * across the midnight boundary: a tomorrow-02:00 slot and a today-02:00 slot
 * both resolve to night against the same sunrise. Sunrise/sunset drift under
 * ~2 min between consecutive days, so a single day's values are accurate for
 * the whole 48-hour hourly window — no per-day solar data is needed.
 *
 * @param {number} hourNum     hour-of-day 0-23
 * @param {number|null} sunriseMin minutes-since-midnight of sunrise
 * @param {number|null} sunsetMin  minutes-since-midnight of sunset
 * @returns {boolean|null}  true=day, false=night, null=no solar data (caller
 *                          should fall back to its own default)
 */
export function isHourDaylight(hourNum, sunriseMin, sunsetMin) {
  if (!Number.isInteger(hourNum)) return null;
  const okNum = (n) => typeof n === 'number' && Number.isFinite(n);
  if (!okNum(sunriseMin) || !okNum(sunsetMin)) return null;
  const slotMidMin = hourNum * 60 + 30;
  return slotMidMin >= sunriseMin && slotMidMin < sunsetMin;
}

export const __WEATHER_EMOJI_MAP = CONDITION_EMOJI_MAP;
