// Background-folder mapping + OG (Open Graph) share-card path helpers.
//
// Used by both the browser picker (assets/app.js → setBackgroundFor) and the
// Vercel serverless OG renderer (api/og.js). Pure functions, no DOM.

import { parseLocalIsoMinutes } from './weather-emoji.js';

export const WEATHER_BACKGROUND_ALIASES = {
  'rain-possible': 'cloudy',
  'partly-cloudy': 'cloudy',
  uv: 'clear',
  hail: 'storm',
  thunder: 'storm',
};

const VALID_TIMES = new Set(['dawn', 'day', 'dusk', 'night']);

export function getWeatherBackgroundFolder(condition) {
  return WEATHER_BACKGROUND_ALIASES[condition] || condition || 'clear';
}

export function getWeatherBackgroundFallbackFolder(condition) {
  return condition === 'cold' ? 'cloudy' : 'clear';
}

/**
 * Server-side equivalent of app.js's getTimeOfDay() — pure function, no globals.
 * Reads sunrise/sunset/localHour from a weather payload and buckets the current
 * UTC instant into one of 'dawn' | 'day' | 'dusk' | 'night'.
 *
 * Mirrors the browser logic (app.js:1203) so OG cards and the live UI agree on
 * which time-slot is active for a given location. Falls back to the localHour
 * clock buckets when sunrise/sunset are missing, and to 'day' as a final default.
 */
export function getTimeOfDaySlot(payload, nowMs = Date.now()) {
  const now = payload?.now || {};
  const meta = payload?.meta || {};
  const sunriseMin = parseLocalIsoMinutes(now.sunrise);
  const sunsetMin = parseLocalIsoMinutes(now.sunset);
  const offset = meta.utcOffsetSeconds;

  if (
    sunriseMin != null
    && sunsetMin != null
    && Number.isFinite(offset)
    && Number.isFinite(nowMs)
  ) {
    const locDate = new Date(nowMs + offset * 1000);
    const minutesNow = locDate.getUTCHours() * 60 + locDate.getUTCMinutes();
    // Same window shape as app.js getTimeOfDay():
    //   dawn = sunrise − 45 → sunrise + 30
    //   day  = sunrise + 30 → sunset  − 45
    //   dusk = sunset  − 45 → sunset  + 15
    //   night = everything else
    if (minutesNow >= sunriseMin - 45 && minutesNow < sunriseMin + 30) return 'dawn';
    if (minutesNow >= sunriseMin + 30 && minutesNow < sunsetMin - 45)  return 'day';
    if (minutesNow >= sunsetMin - 45  && minutesNow < sunsetMin + 15)  return 'dusk';
    return 'night';
  }

  const localHour = Number.isInteger(meta.localHour) ? meta.localHour : null;
  if (localHour == null) return 'day';
  if (localHour >= 5 && localHour < 8)  return 'dawn';
  if (localHour >= 8 && localHour < 17) return 'day';
  if (localHour >= 17 && localHour < 20) return 'dusk';
  return 'night';
}

/**
 * Canonical OG background source — ONE image per condition+time slot
 * (9 conditions × 4 times = 36 canonical files). Always week_1, never
 * randomised — OG cards are server-rendered and cached by Vercel /
 * scraped by WhatsApp etc., so per-user rotation makes no sense.
 *
 * timeOfDay defaults to 'day' for backward compatibility with older
 * callers that don't pass it.
 */
export function getOgBackgroundPath(condition, timeOfDay = 'day') {
  const folder = getWeatherBackgroundFolder(condition);
  const time = VALID_TIMES.has(timeOfDay) ? timeOfDay : 'day';
  return `assets/images/bg/${folder}/week_1/${time}/1.webp`;
}

/**
 * 4-step fallback chain for the OG renderer's background lookup. Mirrors the
 * picker's defensive shape but specialised for OG semantics (always week_1,
 * always image #1). Dedupe-preserving-order so collapse cases (e.g. condition
 * is already 'clear' and time is already 'day') don't issue redundant reads.
 *
 * 1. <condition>/week_1/<time>/1.webp        — primary
 * 2. <condition>/week_1/day/1.webp           — time collapse
 * 3. clear/week_1/day/1.webp                 — condition collapse to clear+day
 * 4. assets/images/bg/default.jpg            — last resort (pre-existing JPG)
 */
export function getOgBackgroundFallbackChain(condition, timeOfDay = 'day') {
  const folder = getWeatherBackgroundFolder(condition);
  const time = VALID_TIMES.has(timeOfDay) ? timeOfDay : 'day';
  const raw = [
    `assets/images/bg/${folder}/week_1/${time}/1.webp`,
    `assets/images/bg/${folder}/week_1/day/1.webp`,
    `assets/images/bg/clear/week_1/day/1.webp`,
    `assets/images/bg/default.jpg`,
  ];
  return Array.from(new Set(raw));
}
