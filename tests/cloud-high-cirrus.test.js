// Strand, 7 Oct 2026, 07:00 SAST — the hero said Cloudy ("Probably Cloudy vibes", a storm-sky
// photograph) over a blue sky with thin high haze. Live API at the time:
//   sources  Open-Meteo "Mainly clear", Pirate "Clear sky", MET "Partly cloudy"  (3 clear)
//            WeatherAPI "Overcast", Tomorrow.io "Cloudy"                         (2 cloudy)
//   now.cloudPct 71.88, conditionKey 'cloudy' / 'mostly-cloudy', conditionLabel "Mainly clear"
//   hourly[7] condition 'clear' — hero and its own hour disagreed
//   Open-Meteo 07:00: cloud_cover 67 = low 0 + mid 0 + high 67 (all cirrus), visibility 34 km
// The fix (api/weather.js skyCloudFor): the cloud figure the condition reads is capped at the top of
// the partly-cloudy band when Open-Meteo's cloud is all high, or when half the sources say clear.

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler, {
  skyCloudFor, conditionLabelFor, deriveCondition, applyVoteConsensus, categorizeDesc, conditionKeyToVoteBucket,
  SKY_PARTLY_CAP_PCT,
} from '../api/weather.js';

// ---------------------------------------------------------------------------
// The phone's own condition code, sliced from the shipped app.js.
// ---------------------------------------------------------------------------
const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const sliceFn = (name) => {
  const start = js.indexOf(`function ${name}(`);
  expect(start, `${name} missing from app.js`).toBeGreaterThan(-1);
  return js.slice(start, js.indexOf('\n  }', start) + 4);
};
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const noop = () => {};
const CLIENT_SCHEMA_MIN = Number(js.match(/const PAYLOAD_SCHEMA_MIN = (\d+);/)[1]);
const THRESH = { RAIN_PCT: 40, WIND_KPH: 25, COLD_C: 16, HOT_C: 35 };
const normalizePayload = new Function('isNum', 'debugLog', 'PAYLOAD_SCHEMA_MIN', `${sliceFn('normalizePayload')}; return normalizePayload;`)(isNum, noop, CLIENT_SCHEMA_MIN);
const computeSkyCondition = new Function('isNum', 'debugLog', `${sliceFn('computeSkyCondition')}; return computeSkyCondition;`)(isNum, noop);
const computeHomeDisplayCondition = new Function('isNum', 'debugLog', 'computeSkyCondition', 'THRESH',
  `${sliceFn('computeHomeDisplayCondition')}; return computeHomeDisplayCondition;`)(isNum, noop, computeSkyCondition, THRESH);
const hourSkyCloud = new Function('isNum', `${sliceFn('hourSkyCloud')}; return hourSkyCloud;`)(isNum);

// ---------------------------------------------------------------------------
// 1. This morning's numbers, through the decision functions.
// ---------------------------------------------------------------------------
const MORNING_VOTES = [
  { source: 'Open-Meteo', desc: 'Mainly clear' },
  { source: 'WeatherAPI', desc: 'Overcast' },
  { source: 'Pirate Weather', desc: 'Clear sky' },
  { source: 'MET Norway', desc: 'Partly cloudy' },
  { source: 'Tomorrow.io', desc: 'Cloudy' },
].map((v) => ({ ...v, vote: categorizeDesc(v.desc) }));
const activeNorms = MORNING_VOTES.map((v) => ({ source: v.source, desc: v.desc, windKph: 10.2, nowTemp: 11.2, feelsLike: 11.2 }));
const morningInputs = (cloudPct) => ({
  now: true, desc: 'Mainly clear', rainChance: 4.3, precipMm: 0, rainVotes: 0, tempC: 11.2, feelsLikeC: 11.2,
  windKph: 10.2, gustKph: 18, uvIndex: 0.4, cloudPct, isDay: true, dailyHighC: 19, dailyLowC: 9,
  sourceDescs: MORNING_VOTES.map((v) => v.desc),
});

describe('Strand 07:00, 7 Oct 2026 — the numbers as the live API had them', () => {
  it('reproduces the bug on the raw figure: 71.88 % read straight is Cloudy', () => {
    expect(deriveCondition(morningInputs(71.88))).toEqual({ key: 'cloudy', reason: 'mostly-cloudy' });
  });

  it('Open-Meteo low 0 / mid 0 / high 67: the figure the hero reads is capped at the partly-cloudy band', () => {
    const sky = skyCloudFor({ cloudPct: 71.88, omLowPct: 0, omMidPct: 0, clearVotes: 3, activeSources: 5 });
    expect(sky).toEqual({ pct: SKY_PARTLY_CAP_PCT, rule: 'high-cloud-only' });
    expect(SKY_PARTLY_CAP_PCT).toBeLessThan(55); // below the mostly-cloudy rung
  });

  it('the hero now reads partly cloudy, and the vote consensus leaves it there', () => {
    const sky = skyCloudFor({ cloudPct: 71.88, omLowPct: 0, omMidPct: 0, clearVotes: 3, activeSources: 5 });
    const base = deriveCondition(morningInputs(sky.pct));
    expect(['partly-cloudy', 'clear']).toContain(base.key);
    const after = applyVoteConsensus({ ...base, activeNorms, sourceVotes: MORNING_VOTES });
    expect(['partly-cloudy', 'clear']).toContain(after.key);
  });

  it('without Open-Meteo\'s split, three clear votes of five still cap it (a minority of two cannot hold Cloudy)', () => {
    const sky = skyCloudFor({ cloudPct: 71.88, omLowPct: null, omMidPct: null, clearVotes: 3, activeSources: 5 });
    expect(sky).toEqual({ pct: SKY_PARTLY_CAP_PCT, rule: 'clear-majority' });
    expect(deriveCondition(morningInputs(sky.pct)).key).toBe('partly-cloudy');
  });

  it('the label can no longer contradict the key', () => {
    expect(conditionLabelFor('partly-cloudy', 'Mainly clear')).toBe('Mainly clear');
    // This morning's contradiction, had the key stayed cloudy: the key's own word replaces it.
    expect(conditionLabelFor('cloudy', 'Mainly clear')).toBe('Cloudy');
    // Sky keys: whatever the sources said, the label reads as the key's own sky.
    for (const key of ['clear', 'partly-cloudy', 'cloudy', 'rain', 'rain-possible', 'fog', 'storm']) {
      for (const desc of ['Mainly clear', 'Overcast', 'Slight rain', 'Fog', 'Snow showers']) {
        expect(categorizeDesc(conditionLabelFor(key, desc)), `${key} / ${desc}`).toBe(conditionKeyToVoteBucket(key));
      }
    }
    // Overlay keys: the sources' words stand when they agree, the key's own word when they do not.
    expect(conditionLabelFor('cold', 'Snow showers')).toBe('Snow showers');
    expect(conditionLabelFor('cold', 'Overcast')).toBe('Cold');
    expect(conditionLabelFor('wind', 'Overcast')).toBe('Windy');
  });
});

describe('the mirror: a real grey sky still says Cloudy', () => {
  const greyVotes = [
    { source: 'Open-Meteo', desc: 'Overcast' }, { source: 'WeatherAPI', desc: 'Overcast' },
    { source: 'Pirate Weather', desc: 'Clear sky' }, { source: 'MET Norway', desc: 'Partly cloudy' },
    { source: 'Tomorrow.io', desc: 'Overcast' },
  ].map((v) => ({ ...v, vote: categorizeDesc(v.desc) }));

  it('Open-Meteo low 70 / mid 20, three sources Overcast → the figure is untouched and the key is cloudy', () => {
    const sky = skyCloudFor({ cloudPct: 85, omLowPct: 70, omMidPct: 20, clearVotes: 2, activeSources: 5 });
    expect(sky).toEqual({ pct: 85, rule: null });
    const base = deriveCondition({ ...morningInputs(sky.pct), desc: 'Overcast', sourceDescs: greyVotes.map((v) => v.desc) });
    expect(base.key).toBe('cloudy');
    const after = applyVoteConsensus({ ...base, activeNorms: greyVotes.map((v) => ({ ...v, windKph: 10.2, nowTemp: 11.2 })), sourceVotes: greyVotes });
    expect(after.key).toBe('cloudy');
  });
});

// ---------------------------------------------------------------------------
// 2. The same morning through the real handler, all five sources stubbed.
// ---------------------------------------------------------------------------
const makeResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn(async () => payload) });
const DAY = '2026-10-07';
const NOW_UTC = Date.UTC(2026, 9, 7, 5, 0, 0); // 07:00 SAST

const openMeteo = ({ code, hourCode, total, low, mid }) => ({
  utc_offset_seconds: 7200,
  current: { temperature_2m: 11.2, apparent_temperature: 11.2, weather_code: code, wind_speed_10m: 10.2, wind_gusts_10m: 18, wind_direction_10m: 120, relative_humidity_2m: 72, cloud_cover: total },
  hourly: {
    temperature_2m: Array(48).fill(11.2), apparent_temperature: Array(48).fill(11.2),
    precipitation_probability: Array(48).fill(4), precipitation: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10.2), wind_gusts_10m: Array(48).fill(18), wind_direction_10m: Array(48).fill(120),
    cloud_cover: Array(48).fill(total), cloud_cover_low: Array(48).fill(low), cloud_cover_mid: Array(48).fill(mid),
    relative_humidity_2m: Array(48).fill(72), uv_index: Array(48).fill(0.4), weather_code: Array(48).fill(hourCode),
    visibility: Array(48).fill(34000), dew_point_2m: Array(48).fill(6),
  },
  daily: {
    temperature_2m_max: Array(7).fill(19), temperature_2m_min: Array(7).fill(9), precipitation_probability_max: Array(7).fill(5),
    uv_index_max: Array(7).fill(7), weather_code: Array(7).fill(2), wind_speed_10m_max: Array(7).fill(20), wind_gusts_10m_max: Array(7).fill(30),
    sunrise: Array(7).fill(`${DAY}T06:35`), sunset: Array(7).fill(`${DAY}T19:05`),
  },
});
const waHour = (code, cloud) => ({ temp_c: 11.2, feelslike_c: 11.2, condition: { code, text: 'x' }, chance_of_rain: 5, precip_mm: 0, wind_kph: 11, gust_kph: 20, cloud, humidity: 72, uv: 0.4 });
const weatherApi = (code, cloud) => ({
  location: { tz_id: 'Africa/Johannesburg' },
  current: { temp_c: 11.2, feelslike_c: 11.2, condition: { code, text: 'x' }, wind_kph: 11, gust_kph: 20, humidity: 72, cloud, uv: 0.4, precip_mm: 0 },
  forecast: {
    forecastday: [0, 1].map(() => ({
      day: { maxtemp_c: 19, mintemp_c: 9, daily_chance_of_rain: 5, totalprecip_mm: 0, uv: 6, maxwind_kph: 20, condition: { code, text: 'x' } },
      astro: { sunrise: '06:35 AM', sunset: '07:05 PM' },
      hour: Array.from({ length: 24 }, () => waHour(code, cloud)),
    })),
  },
});
const pirate = (icon) => ({
  offset: 2,
  currently: { temperature: 11.2, windSpeed: 2.8, windGust: 5, humidity: 0.72, icon },
  daily: { data: Array.from({ length: 7 }, () => ({ temperatureHigh: 19, temperatureLow: 9, precipProbability: 0.05, uvIndex: 6, icon, windSpeed: 3, cloudCover: 0.2,
    sunriseTime: Date.UTC(2026, 9, 7, 4, 35) / 1000, sunsetTime: Date.UTC(2026, 9, 7, 17, 5) / 1000 })) },
});
const met = (symbol, cloud) => ({
  properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 9, 6, 22 + i)).toISOString(),
    data: { instant: { details: { air_temperature: 11.2, wind_speed: 2.8, relative_humidity: 72, cloud_area_fraction: cloud } },
      next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: 0 } } },
  })) },
});
const tomorrow = (weatherCode, cloudCover) => ({
  data: { timelines: [{ intervals: Array.from({ length: 48 }, (_, i) => ({
    startTime: new Date(NOW_UTC + i * 3600e3).toISOString(),
    values: { temperature: 11.2, precipitationIntensity: 0, precipitationProbability: 5, weatherCode, windSpeed: 3, humidity: 72, cloudCover, visibility: 30 },
  })) }] },
});

const stubFive = (p) => vi.stubGlobal('fetch', vi.fn(async (url) => {
  const href = String(url);
  if (href.includes('open-meteo.com/')) return makeResponse(p.openMeteo);
  if (href.startsWith('https://api.met.no/')) return makeResponse(p.met);
  if (href.includes('api.weatherapi.com/')) return makeResponse(p.weatherApi);
  if (href.includes('api.pirateweather.net/')) return makeResponse(p.pirate);
  if (href.startsWith('https://api.tomorrow.io/')) return makeResponse(p.tomorrow);
  throw new Error(`Unexpected URL: ${href}`);
}));

const callHandler = async () => {
  let body;
  const req = { query: { lat: '-34.108', lon: '18.828', name: 'Strand' } };
  const res = { setHeader: vi.fn(), status() { return this; }, json(payload) { body = payload; return this; } };
  await handler(req, res);
  return body;
};

describe('Strand 07:00 through the handler — five sources, this morning\'s words and cloud', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_UTC));
    process.env.WEATHERAPI_KEY = 'wa-key'; process.env.PIRATE_WEATHER_KEY = 'pw-key'; process.env.TOMORROWIO_API_KEY = 'ti-key';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY; delete process.env.TOMORROWIO_API_KEY;
  });

  it('thin cirrus: hero partly cloudy, the raw cover still shipped, its hour row agrees, the phone agrees', async () => {
    stubFive({
      openMeteo: openMeteo({ code: 1, hourCode: 2, total: 67, low: 0, mid: 0 }),   // the 67 is all high cloud
      weatherApi: weatherApi(1009, 75),          // "Overcast"
      pirate: pirate('clear-day'),               // "Clear sky"
      met: met('partlycloudy_day', 60),          // "Partly cloudy"
      tomorrow: tomorrow(1102, 72),              // "Cloudy"
    });
    const body = await callHandler();
    expect(body.ok).toBe(true);
    expect(body.meta.localHour).toBe(7);
    expect(body.now.isDay).toBe(true);
    expect(body.now.conditionSignals.sourceVotes.map((v) => v.desc)).toEqual(['Mainly clear', 'Overcast', 'Clear sky', 'Partly cloudy', 'Cloudy']);

    expect(body.now.cloudPct).toBeGreaterThanOrEqual(55);           // what the models said, unchanged for display
    expect(body.now.skyCloudPct).toBe(SKY_PARTLY_CAP_PCT);           // what the condition read
    expect(body.now.conditionSignals.numeric.skyCloudRule).toBe('high-cloud-only');
    expect(['partly-cloudy', 'clear']).toContain(body.now.conditionKey);
    expect(categorizeDesc(body.now.conditionLabel)).toBe(conditionKeyToVoteBucket(body.now.conditionKey));

    // Hero and its own hour: one answer.
    expect(body.hourly[7].condition).toBe(body.now.conditionKey);
    expect(hourSkyCloud(body.hourly[7])).toBe(SKY_PARTLY_CAP_PCT);
    expect(body.hourly[7].cloudPct).toBe(body.now.cloudPct);

    // The phone, which used to re-derive Cloudy from the raw 71 %.
    const norm = normalizePayload(body);
    expect(['partly-cloudy', 'clear']).toContain(computeHomeDisplayCondition(norm));
  });

  it('mirror: Open-Meteo low 70 / mid 20 and three sources Overcast still read Cloudy, hero, hour and phone', async () => {
    stubFive({
      openMeteo: openMeteo({ code: 3, hourCode: 3, total: 85, low: 70, mid: 20 }),
      weatherApi: weatherApi(1009, 90),          // "Overcast"
      pirate: pirate('clear-day'),               // "Clear sky"
      met: met('partlycloudy_day', 60),          // "Partly cloudy"
      tomorrow: tomorrow(1001, 88),              // "Overcast"
    });
    const body = await callHandler();
    expect(body.ok).toBe(true);
    expect(body.now.conditionKey).toBe('cloudy');
    expect(body.now.skyCloudPct).toBe(body.now.cloudPct);
    expect(body.now.conditionSignals.numeric.skyCloudRule).toBeNull();
    expect(body.hourly[7].condition).toBe('cloudy');
    expect(computeHomeDisplayCondition(normalizePayload(body))).toBe('cloudy');
  });
});
