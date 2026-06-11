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

// (L1 cleanup, 2026-06-11: getOgBackgroundPath + getOgBackgroundFallbackChain
// deleted — the WebP OG chain from a previous OG implementation. api/og.js
// uses the STATIC JPEG variants below; the WebP pair was exported and tested
// but never called in production.)

/**
 * OG-specific alias map — NARROWER than WEATHER_BACKGROUND_ALIASES.
 *
 * The picker's WEATHER_BACKGROUND_ALIASES treats `uv` and `rain-possible`
 * as aliases of `clear` and `cloudy` because there are NO dedicated
 * `assets/images/bg/uv/` or `assets/images/bg/rain-possible/` WebP folders.
 *
 * But `og/uv.jpg` and `og/rain-possible.jpg` ARE pre-built as dedicated
 * static OG cards (`tools/build-og-images.mjs` ALIASES block creates them).
 * If we re-used the picker's alias map for OG paths, those dedicated files
 * would never be served — `uv` would silently map to `og/clear.jpg`,
 * regressing the marketing-specific OG cards. So we maintain a separate
 * OG alias map that only collapses conditions WITHOUT a dedicated og file.
 *
 * partly-cloudy / hail / thunder do NOT have dedicated og files (not in
 * build-og-images.mjs CONDITIONS or ALIASES), so they map to existing ones.
 */
const OG_BACKGROUND_ALIASES = {
  'partly-cloudy': 'cloudy',
  hail: 'storm',
  thunder: 'storm',
};

function resolveOgFolder(condition) {
  const safe = String(condition || '').toLowerCase();
  return OG_BACKGROUND_ALIASES[safe] || safe || 'clear';
}

/**
 * STATIC OG background source — the pre-rendered og/<condition>.jpg files
 * produced by tools/build-og-images.mjs. JPEG instead of WebP because
 * @vercel/og 0.11.1 (Satori) can't render WebP cleanly inside an embedded
 * <img> data-URL — it throws "u2 is not iterable" deep in the Satori parser.
 *
 * Used by api/og.js. ONE canonical image per condition — no time-of-day
 * variation in dynamic OG cards (social/WhatsApp previews cache per shared
 * URL for ~30 days, so per-time variation is invisible to users anyway).
 *
 * Alias resolution uses OG_BACKGROUND_ALIASES (narrower than the picker's)
 * so dedicated og/uv.jpg and og/rain-possible.jpg are served as-is rather
 * than collapsed into og/clear.jpg / og/cloudy.jpg.
 *
 * Condition is lowercased defensively — on Linux/Vercel the filesystem is
 * case-sensitive so 'Storm' must not become a 404.
 */
export function getOgStaticBackgroundPath(condition) {
  return `og/${resolveOgFolder(condition)}.jpg`;
}

/**
 * 3-step fallback chain for the OG static background:
 *
 *   1. og/<resolved-folder>.jpg — primary
 *   2. og/clear.jpg             — condition collapse (always pre-built)
 *   3. og/default.jpg           — final guard (also pre-built by build-og-images)
 *
 * Order-preserving dedupe — if the resolved condition is already 'clear',
 * step 1 collapses into step 2.
 *
 * Final fallback is `og/default.jpg` (not `assets/images/bg/default.jpg`)
 * because all OG sources should live under og/ — build-og-images.mjs
 * explicitly produces og/default.jpg from the same source as og/clear.jpg.
 *
 * No timeOfDay parameter — OG static cards are per-condition only.
 */
export function getOgStaticBackgroundFallbackChain(condition) {
  const folder = resolveOgFolder(condition);
  const raw = [
    `og/${folder}.jpg`,
    `og/clear.jpg`,
    `og/default.jpg`,
  ];
  return Array.from(new Set(raw));
}
