// Forecast side of the accuracy harness: archived model forecasts → the exact
// five-slot shape api/weather.js builds (norms / hourlies / dailies) for any
// past local hour, so the PRODUCTION resolver can be replayed over it.
//
// Files (review/accuracy/forecast/):
//   om/om-<ICAO>-<from>-<to>.json          Open-Meteo historical-forecast API, best_match
//                                          (this IS what production's Open-Meteo call returned
//                                          for those hours: same endpoint family, same fields)
//   om-models/models-<ICAO>-<from>-<to>.json  the same archive for four other models
//
// Slot mapping — production source → archived stand-in, with the reason:
//   [0] Open-Meteo     → best_match          identical provider and variables
//   [1] WeatherAPI     → ecmwf_ifs025        WeatherAPI mirrors ECMWF (CLAUDE.md), and production
//                                            halves its weight when it matches OM; the stand-in
//                                            triggers the same dedup rule the same way
//   [2] Pirate Weather → gfs_seamless        Pirate is NOAA GFS/GEFS
//   [3] MET Norway     → ukmo_seamless       an independent global model in the slot production
//                                            treats as its most trusted second opinion; its rain
//                                            figure is converted with production's mm→% proxy
//                                            ladder, exactly as MET's is
//   [4] Tomorrow.io    → icon_seamless       hourly-only, day-0-only, probability given natively
//
// What this cannot reproduce: Tomorrow.io's radar intensity (there is no radar archive),
// so the radar override is never simulated. It only ever ADDS rain when radar sees
// > 0.5 mm/h, so its absence cannot hide a false-rain case. WeatherAPI's own
// "Patchy rain possible" habit has no stand-in either; the replay is, if anything,
// kinder to the current rules than production is.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ACCURACY_ROOT = path.resolve(here, '..');

export const RANGE = { from: '2026-06-24', to: '2026-09-22' };

export const CITIES = {
  FACT: { name: 'Cape Town',    lat: -33.9648, lon: 18.6017 },
  FAOR: { name: 'Johannesburg', lat: -26.1392, lon: 28.2460 },
  FALE: { name: 'Durban',       lat: -29.6144, lon: 31.1197 },
  FAPE: { name: 'Gqeberha',     lat: -33.9849, lon: 25.6173 },
  FABL: { name: 'Bloemfontein', lat: -29.0927, lon: 26.3024 },
  FAGG: { name: 'George',       lat: -34.0056, lon: 22.3789 },
};

// api/weather.js openMeteoCodeMap (inside the handler, not exported) — copied verbatim.
export const OPEN_METEO_CODE_MAP = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};
const descOf = (code) => (code == null ? null : (OPEN_METEO_CODE_MAP[code] ?? null));

// api/weather.js MET Norway rain proxy — mm in the hour → % — copied verbatim (hourly ladder).
export const metHourlyRainProxy = (mm) => (mm == null ? null : mm === 0 ? 0 : mm < 0.5 ? 20 : mm < 1 ? 40 : mm < 2 ? 60 : 80);
// …and the daily ladder (max mm over today's remaining hours).
export const metDailyRainProxy = (maxMm) => (maxMm == null ? null : maxMm === 0 ? 0 : maxMm < 0.5 ? 20 : maxMm < 1 ? 40 : maxMm < 2 ? 60 : maxMm < 5 ? 80 : 95);

const MODELS = ['gfs_seamless', 'ecmwf_ifs025', 'ukmo_seamless', 'icon_seamless'];
const SLOT_MODEL = { 1: 'ecmwf_ifs025', 2: 'gfs_seamless', 3: 'ukmo_seamless', 4: 'icon_seamless' };
export const SLOT_NAMES = ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'];

function series(hourly, field, model) {
  const key = model ? `${field}_${model}` : field;
  return hourly[key] || null;
}

export function loadCity(icao) {
  const bmPath = path.join(ACCURACY_ROOT, 'forecast', 'om', `om-${icao}-${RANGE.from.replace(/-/g, '')}-${RANGE.to.replace(/-/g, '')}.json`);
  const mdPath = path.join(ACCURACY_ROOT, 'forecast', 'om-models', `models-${icao}-${RANGE.from.replace(/-/g, '')}-${RANGE.to.replace(/-/g, '')}.json`);
  const bm = JSON.parse(readFileSync(bmPath, 'utf8'));
  const md = JSON.parse(readFileSync(mdPath, 'utf8'));
  const times = bm.hourly.time;
  if (md.hourly.time.length !== times.length || md.hourly.time[0] !== times[0]) {
    throw new Error(`${icao}: model archive hours do not align with best_match`);
  }
  const H = {
    bm: {
      temp: bm.hourly.temperature_2m, feels: bm.hourly.apparent_temperature,
      pp: bm.hourly.precipitation_probability, mm: bm.hourly.precipitation,
      wind: bm.hourly.wind_speed_10m, gust: bm.hourly.wind_gusts_10m,
      cloud: bm.hourly.cloud_cover, rh: bm.hourly.relative_humidity_2m,
      uv: bm.hourly.uv_index, code: bm.hourly.weather_code,
      vis: bm.hourly.visibility, dew: bm.hourly.dew_point_2m,
    },
  };
  for (const m of MODELS) {
    H[m] = {
      temp: series(md.hourly, 'temperature_2m', m), feels: series(md.hourly, 'apparent_temperature', m),
      pp: series(md.hourly, 'precipitation_probability', m), mm: series(md.hourly, 'precipitation', m),
      wind: series(md.hourly, 'wind_speed_10m', m), gust: series(md.hourly, 'wind_gusts_10m', m),
      cloud: series(md.hourly, 'cloud_cover', m), rh: series(md.hourly, 'relative_humidity_2m', m),
      code: series(md.hourly, 'weather_code', m),
    };
  }
  const D = {
    dates: bm.daily.time,
    bm: {
      tmax: bm.daily.temperature_2m_max, tmin: bm.daily.temperature_2m_min,
      ppmax: bm.daily.precipitation_probability_max, uvmax: bm.daily.uv_index_max,
      code: bm.daily.weather_code, windmax: bm.daily.wind_speed_10m_max,
      sunrise: bm.daily.sunrise, sunset: bm.daily.sunset,
    },
  };
  for (const m of MODELS) {
    D[m] = { tmax: md.daily[`temperature_2m_max_${m}`], tmin: md.daily[`temperature_2m_min_${m}`] };
  }
  return { icao, ...CITIES[icao], times, H, D, nHours: times.length, nDays: D.dates.length };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const at = (arr, i) => (arr && isNum(arr[i]) ? arr[i] : null);
const maxOf = (vals) => { const v = vals.filter(isNum); return v.length ? Math.max(...v) : null; };
const dayMaxOfHourly = (arr, d) => maxOf((arr || []).slice(d * 24, d * 24 + 24));
// OM's daily weather_code is the day's most severe code; the stand-ins get the same
// treatment (max code over the day) so their daily desc is built the way OM's is.
const dayWorstCode = (arr, d) => maxOf((arr || []).slice(d * 24, d * 24 + 24));

/**
 * Build the production-shaped ensemble for hour index i of a loaded city.
 * Returns { norms, hourlies, dailies, localHour, dayIdx, isDay, sunriseMin, sunsetMin }.
 * Shapes follow api/weather.js exactly (field names included) so the replay can
 * hand them to the same aggregation the handler performs.
 */
export function ensembleAt(city, i) {
  const { H, D } = city;
  const d = Math.floor(i / 24);
  const h = i % 24;
  const base = d * 24;
  const slot = (k) => (k === 0 ? H.bm : H[SLOT_MODEL[k]]);
  const slotDaily = (k) => (k === 0 ? D.bm : D[SLOT_MODEL[k]]);

  const norms = [];
  for (let k = 0; k < 5; k++) {
    const s = slot(k), sd = slotDaily(k);
    const mm = at(s.mm, i);
    let todayRain;
    if (k === 0) todayRain = at(D.bm.ppmax, d);
    else if (k === 3) todayRain = metDailyRainProxy(maxOf((s.mm || []).slice(i, base + 24)));
    else if (k === 4) todayRain = maxOf((s.pp || []).slice(i, base + 24));
    else todayRain = dayMaxOfHourly(s.pp, d);
    norms[k] = {
      source: SLOT_NAMES[k],
      nowTemp: at(s.temp, i),
      feelsLike: at(s.feels, i),
      todayHigh: at(sd.tmax, d),
      todayLow: at(sd.tmin, d),
      todayRain,
      todayUv: k === 0 ? at(D.bm.uvmax, d) : null,
      desc: descOf(at(s.code, i)),
      windKph: at(s.wind, i),
      // Production reads gusts from Open-Meteo, WeatherAPI (current.gust_kph, since
      // 2026-09-22) and Pirate.
      gustKph: (k === 0 || k === 1 || k === 2) ? at(s.gust, i) : null,
      // Every stand-in's gust, kept aside for the wind-threshold derivation only.
      _gustAny: at(s.gust, i),
      // The gusts production can read after the fix: Open-Meteo, WeatherAPI (current.gust_kph), Pirate.
      _gust3: (k === 0 || k === 1 || k === 2) ? at(s.gust, i) : null,
      humidity: at(s.rh, i),
      // The stand-in for "precipitation reported for the current hour" by this source.
      precipNowMm: mm,
    };
  }

  // Hourlies: production slots [OM, WA, MET, TI] = [bm, ecmwf, ukmo, icon];
  // 48 entries from local midnight of day d. MET/TI start at NOW in production,
  // so their entries before h are null here too.
  const hourlySlots = [H.bm, H.ecmwf_ifs025, H.ukmo_seamless, H.icon_seamless];
  const hourlies = hourlySlots.map((s, hs) => {
    const startsNow = hs >= 2;
    const pick = (arr, conv = (v) => v) => Array.from({ length: 48 }, (_, j) => {
      if (startsNow && j < h) return null;
      const v = at(arr, base + j);
      return v == null ? null : conv(v);
    });
    const rains = hs === 2
      ? pick(s.mm, metHourlyRainProxy)             // MET: mm → % proxy ladder
      : pick(s.pp);                                 // OM / WA / TI: native probability
    return {
      source: SLOT_NAMES[[0, 1, 3, 4][hs]],
      temps: pick(s.temp),
      feelsLikes: pick(s.feels),
      rains,
      precipMm: pick(s.mm),
      winds: pick(s.wind),
      gusts: hs === 0 ? pick(s.gust) : Array(48).fill(null), // only OM's hourly gusts are read in production
      clouds: pick(s.cloud),
      humidity: pick(s.rh),
      uvs: hs === 0 ? pick(H.bm.uv) : Array(48).fill(null),
      visibility: hs === 0 ? pick(H.bm.vis) : Array(48).fill(null),
      dewPoints: hs === 0 ? pick(H.bm.dew) : Array(48).fill(null),
      descs: pick(s.code, descOf),
    };
  });

  // Dailies: 7-day for OM/WA/Pirate, day-0-only for MET/TI (as production).
  const dailies = [];
  for (let k = 0; k < 5; k++) {
    const s = slot(k), sd = slotDaily(k);
    if (k === 3 || k === 4) {
      dailies[k] = { source: SLOT_NAMES[k], highs: [norms[k].todayHigh], lows: [norms[k].todayLow], rains: [norms[k].todayRain], uvs: [], descs: [norms[k].desc], winds: [], clouds: [] };
      continue;
    }
    const days = Math.min(7, city.nDays - d);
    const idx = Array.from({ length: days }, (_, q) => d + q);
    dailies[k] = {
      source: SLOT_NAMES[k],
      highs: idx.map((q) => at(sd.tmax, q)),
      lows: idx.map((q) => at(sd.tmin, q)),
      rains: idx.map((q) => (k === 0 ? at(D.bm.ppmax, q) : dayMaxOfHourly(s.pp, q))),
      uvs: idx.map((q) => (k === 0 ? at(D.bm.uvmax, q) : null)),
      winds: idx.map((q) => (k === 0 ? at(D.bm.windmax, q) : dayMaxOfHourly(s.wind, q))),
      clouds: idx.map(() => null),
      descs: idx.map((q) => descOf(k === 0 ? at(D.bm.code, q) : dayWorstCode(s.code, q))),
    };
  }

  const toMin = (iso) => { const m = /T(\d\d):(\d\d)/.exec(iso || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const sunriseMin = toMin(D.bm.sunrise?.[d]);
  const sunsetMin = toMin(D.bm.sunset?.[d]);
  const nowMin = h * 60;
  const isDay = (sunriseMin != null && sunsetMin != null) ? (nowMin >= sunriseMin && nowMin <= sunsetMin) : (h >= 6 && h < 19);

  return { norms, hourlies, dailies, localHour: h, dayIdx: d, isDay, sunriseMin, sunsetMin, time: city.times[i] };
}
