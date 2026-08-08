// Probably Weather — condition → icon SELECTION (visual layer only).
//
// M5 (2026-08-08) retired the platform emoji this module used to return. It now
// returns ICON NAMES from assets/weather-icons.js, which owns the drawings; the
// selection logic below — including the day/night split that fixed the "20:00
// sun-with-rain-cloud" bug — is unchanged.
//
// The filename is deliberately NOT changed: it is a precached service-worker
// path and renaming it buys nothing but an offline-cache risk.
//
// Notes on the day/night pairs, carried over from the emoji era because the
// reasoning survives the redraw:
// - Clear at night is the moon, never the sun.
// - Cloudy uses sun-behind-cloud by day and a bare cloud at night, so the cloud
//   read keeps day/night differentiation without a CSS filter.
// - Rain at night is cloud+rain (no sun); rain at day is sun+rain. Same for
//   partly cloudy.

// Map of canonical condition keys → { day, night } icon-name pair.
const CONDITION_ICON_MAP = {
  thunder:         { day: 'storm',      night: 'storm'      },
  storm:           { day: 'storm',      night: 'storm'      },
  hail:            { day: 'sleet',      night: 'sleet'      },
  rain:            { day: 'rain',       night: 'rain'       },
  'rain-possible': { day: 'rain-sun',   night: 'rain'       },
  cloudy:          { day: 'cloud',      night: 'cloud'      },
  'partly-cloudy': { day: 'cloud-sun',  night: 'cloud'      },
  fog:             { day: 'fog',        night: 'fog'        },
  wind:            { day: 'wind',       night: 'wind'       },
  cold:            { day: 'cold',       night: 'cold'       },
  // cold-clear: Highveld dry-cold under blue sky. Sun AND snowflake — the
  // "deceptively beautiful" register the cold-face emoji used to carry. Kept
  // distinct from plain 'cold' (bare snowflake), which also renders snow
  // particles in the app.
  'cold-clear':    { day: 'cold-clear', night: 'cold-clear' },
  heat:            { day: 'heat',       night: 'heat'       },
  uv:              { day: 'sun',        night: 'moon'       },
  clear:           { day: 'sun',        night: 'moon'       },
};

const DEFAULT_PAIR = { day: 'cloud-sun', night: 'cloud' };

export function pickConditionIconForTime(condition, isDay) {
  const key = String(condition || '').toLowerCase();
  const pair = CONDITION_ICON_MAP[key] || DEFAULT_PAIR;
  return isDay === false ? pair.night : pair.day;
}

// Hourly row icon: rain probability + cloud cover + temp, plus isNight.
// `condition` is the optional per-hour categorised condition the API attaches
// to each hourly entry (categorizeDesc in api/weather.js).
//
// Cloud thresholds here MIRROR deriveCondition() in api/weather.js
// (partly-cloudy >= 30, mostly/overcast cloudy >= 55) so the hourly icon
// agrees with the home hero's consensus condition. The previous >= 40
// partly-cloudy floor left the 30-39% cloud band rendering a bare sun while
// the home headline already read "partly cloudy" — Al's 2026-05-19 bug.
export function pickHourlyIcon({ rainPct, cloudPct, tempC, isNight, condition }) {
  const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
  const isDay = !isNight;
  const cond = String(condition || '').toLowerCase();

  // categorizeDesc detects thunder and fog reliably, and the numeric ladder
  // below has no weather-code input so it could never surface them. Honour
  // those two directly. categorizeDesc is NOT reliable for the
  // clear/partly/cloudy split (it collapses "partly cloudy" into "clear"),
  // so every other key falls through to the cloud-cover ladder.
  if (cond === 'storm' || cond === 'thunder') return pickConditionIconForTime('storm', isDay);
  if (cond === 'fog') return pickConditionIconForTime('fog', isDay);

  if (isNum(tempC) && tempC <= 0)        return pickConditionIconForTime('cold', isDay);
  if (isNum(rainPct) && rainPct >= 50)   return pickConditionIconForTime('rain', isDay);
  if (isNum(rainPct) && rainPct >= 30)   return pickConditionIconForTime('rain-possible', isDay);
  if (isNum(tempC) && tempC >= 35)       return pickConditionIconForTime('heat', isDay);
  if (isNum(cloudPct) && cloudPct >= 55) return pickConditionIconForTime('cloudy', isDay);
  if (isNum(cloudPct) && cloudPct >= 30) return pickConditionIconForTime('partly-cloudy', isDay);
  if (isNum(tempC) && tempC <= 10)       return pickConditionIconForTime('cold', isDay);
  return pickConditionIconForTime('clear', isDay);
}

// ---------------------------------------------------------------------------
// Bug 2b (2026-05-24) — real solar day/night for hourly icons.
//
// The hourly forecast rows used to hardcode "night" as hour >= 20 || hour < 5.
// On 2026-05-21 Cape Town's sunset was ~17:45, so the 18:00 and 19:00 slots
// rendered a bright sun nearly two hours after dark. These helpers replace the
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

export const __WEATHER_ICON_MAP = CONDITION_ICON_MAP;
