// Candidate "rain-now-descriptive" (12 Oct 2026, branch fix/rain-now-descriptive — NOT RULED, nothing ships).
//
// Strand, 12 Oct 2026 20:55: steady light rain since 18:00. Open-Meteo "Slight rain", WeatherAPI "Light drizzle",
// MET Norway "Heavy rain", Pirate "Cloudy", Tomorrow.io "Light fog"; 1 mm blended, 46.5 % → "Might rain."
// (desc-rain-unconfirmed). The candidate: ≥ 3 sources describing rain now, from ≥ 2 model families (Open-Meteo and
// WeatherAPI are one ECMWF family), ≥ 0.5 mm for the hour. Probability is not read. Numbers:
// review/accuracy/results/rain-now-descriptive-2026-10-12.md.

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/_lib/weather-cache.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, weatherCacheGet: vi.fn(mod.weatherCacheGet), weatherCacheSetDeferred: vi.fn(mod.weatherCacheSetDeferred) };
});
import { weatherCacheGet, weatherCacheSetDeferred } from '../api/_lib/weather-cache.js';
import handler, {
  deriveCondition, applyVoteConsensus, categorizeDesc, descriptiveRainVotes,
  RAIN_NOW_DESC_MIN_VOTES, RAIN_NOW_DESC_MIN_FAMILIES, RAIN_NOW_DESC_MIN_MM, RAIN_FAMILY, RAIN_NOW_DESC_REGIONS,
  RAIN_NOW_MIN_VOTES, RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM, SHOWERS_NEARBY_MIN_PROB, SHOWERS_NEARBY_MIN_MM,
} from '../api/weather.js';
import { REGION_STATIONS, regionOf } from '../api/_lib/regions.js';

const incident = JSON.parse(readFileSync(new URL('../review/accuracy/incidents/strand-2026-10-12-2055.json', import.meta.url), 'utf8'));
const SOURCES = ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'];
const votesOf = (descs) => SOURCES.map((source) => ({ source, desc: descs[source], vote: categorizeDesc(descs[source]) }));
const STRAND_2055 = { 'Open-Meteo': 'Slight rain', 'WeatherAPI': 'Light drizzle', 'Pirate Weather': 'Cloudy', 'MET Norway': 'Heavy rain', 'Tomorrow.io': 'Light fog' };

// The selector inputs the live API recorded for Strand that evening, with the 20:55 numbers put back.
const strandInputs = (descs, over = {}) => {
  const ev = descriptiveRainVotes(votesOf(descs));
  return { ...incident.payload.now.conditionSignals.selector.inputs, sourceDescs: SOURCES.map((s) => descs[s]),
    rainVotes: ev.votes, rainSources: ev.sources, rainFamilies: ev.families, rainDescRegion: true, precipMm: 1, rainChance: 46.5, ...over };
};

describe('rain-now-descriptive — the constants and the family map', () => {
  it('pins the candidate and leaves the ruled cells alone', () => {
    expect([RAIN_NOW_DESC_MIN_VOTES, RAIN_NOW_DESC_MIN_FAMILIES, RAIN_NOW_DESC_MIN_MM]).toEqual([3, 2, 0.5]);
    expect([RAIN_NOW_MIN_VOTES, RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM]).toEqual([2, 90, 2]);
    expect([SHOWERS_NEARBY_MIN_PROB, SHOWERS_NEARBY_MIN_MM]).toEqual([60, 0.3]);
  });
  it('the coast switch: Western Cape, Garden Route, KZN coast only (Maat ruling, 12 Oct 2026)', () => {
    expect([...RAIN_NOW_DESC_REGIONS]).toEqual(['Western Cape', 'Garden Route', 'KZN coast']);
    expect(regionOf(-34.1083, 18.8283)).toBe('Western Cape');   // Strand
  });
  it('Open-Meteo and WeatherAPI are one family; the other three are each their own', () => {
    expect(RAIN_FAMILY['Open-Meteo']).toBe(RAIN_FAMILY.WeatherAPI);
    expect(new Set(SOURCES.map((s) => RAIN_FAMILY[s])).size).toBe(4);
  });
  it('"possible" is not a vote', () => {
    expect(descriptiveRainVotes([{ source: 'WeatherAPI', desc: 'Patchy rain possible', vote: 'rain' }])).toEqual({ votes: 0, sources: 0, families: 0 });
  });
  it('fails closed: an unknown or missing source, or the same source twice, adds no source and no family', () => {
    const v = [
      { source: 'Open-Meteo', desc: 'Rain', vote: 'rain' }, { source: 'Open-Meteo', desc: 'Rain', vote: 'rain' },
      { source: null, desc: 'Rain', vote: 'rain' }, { source: 'Someone else', desc: 'Rain', vote: 'rain' },
      { source: 'toString', desc: 'Rain', vote: 'rain' },
    ];
    expect(descriptiveRainVotes(v)).toEqual({ votes: 5, sources: 1, families: 1 });   // votes: the strict cell's count, unchanged
  });
});

describe('rain-now-descriptive — the four cases', () => {
  it('Strand 20:55 (3 sources, 2 families, 1 mm, 46.5 %) → Rain\'s here, by its own reason', () => {
    expect(descriptiveRainVotes(votesOf(STRAND_2055))).toEqual({ votes: 3, sources: 3, families: 2 });
    expect(deriveCondition(strandInputs(STRAND_2055))).toEqual({ key: 'rain', reason: 'rain-now-descriptive' });
  });
  it('without the new inputs (a selector cached before them) the same hour is today\'s might-rain', () => {
    expect(deriveCondition(strandInputs(STRAND_2055, { rainSources: undefined, rainFamilies: undefined, rainDescRegion: undefined }))).toEqual({ key: 'rain-possible', reason: 'desc-rain-unconfirmed' });
  });
  it('the same hour off the coast (rainDescRegion false) is today\'s might-rain', () => {
    expect(deriveCondition(strandInputs(STRAND_2055, { rainDescRegion: false }))).toEqual({ key: 'rain-possible', reason: 'desc-rain-unconfirmed' });
  });
  it('WeatherAPI "Cloudy" instead (2 votes, 2 families) → unchanged from today', () => {
    const descs = { ...STRAND_2055, WeatherAPI: 'Cloudy' };
    expect(descriptiveRainVotes(votesOf(descs))).toEqual({ votes: 2, sources: 2, families: 2 });
    expect(deriveCondition(strandInputs(descs))).toEqual({ key: 'rain-possible', reason: 'desc-rain-unconfirmed' });
  });
  it('3 votes all from the ECMWF family → unchanged from today', () => {
    expect(deriveCondition(strandInputs(STRAND_2055, { rainVotes: 3, rainSources: 3, rainFamilies: 1 }))).toEqual({ key: 'rain-possible', reason: 'desc-rain-unconfirmed' });
  });
  it('3 votes, 2 families, 0.3 mm → unchanged from today', () => {
    expect(deriveCondition(strandInputs(STRAND_2055, { precipMm: 0.3 }))).toEqual({ key: 'rain-possible', reason: 'desc-rain-unconfirmed' });
  });
  it('probability is not read: the same hour at 5 % and at 89 % is still rain-now-descriptive', () => {
    for (const rainChance of [5, 46.5, 89]) expect(deriveCondition(strandInputs(STRAND_2055, { rainChance })).reason).toBe('rain-now-descriptive');
  });
  it('the strict cell still wins when it holds', () => {
    expect(deriveCondition(strandInputs(STRAND_2055, { rainChance: 92, precipMm: 2.5 }))).toEqual({ key: 'rain', reason: 'rain-now' });
  });
  it('sits above wind, as the strict cell does (rain that is falling outranks wind)', () => {
    expect(deriveCondition(strandInputs(STRAND_2055, { windKph: 40, gustKph: 70 }))).toEqual({ key: 'rain', reason: 'rain-now-descriptive' });
  });
  it('the vote-consensus guard keeps it', () => {
    const votes = votesOf(STRAND_2055);
    expect(applyVoteConsensus({ key: 'rain', reason: 'rain-now-descriptive', activeNorms: votes.map(() => ({})), sourceVotes: votes }))
      .toMatchObject({ key: 'rain', reason: 'rain-now-descriptive' });
  });
});

// ---- the handler end to end: five stubbed providers, Strand at 20:55 SAST ----
const makeResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn(async () => payload) });
const DAY = '2026-10-12';
const NOW_UTC = Date.UTC(2026, 9, 12, 18, 55, 0); // 20:55 SAST
const H0 = Date.UTC(2026, 9, 11, 22, 0, 0);       // 00:00 SAST
const PROB = 46, MM = 1;
const openMeteo = (code) => ({
  utc_offset_seconds: 7200,
  current: { temperature_2m: 15, apparent_temperature: 15, weather_code: code, wind_speed_10m: 9, wind_gusts_10m: 20, wind_direction_10m: 330, relative_humidity_2m: 91, cloud_cover: 100 },
  hourly: {
    temperature_2m: Array(48).fill(15), apparent_temperature: Array(48).fill(15),
    precipitation_probability: Array(48).fill(PROB), precipitation: Array(48).fill(MM),
    wind_speed_10m: Array(48).fill(9), wind_gusts_10m: Array(48).fill(20), wind_direction_10m: Array(48).fill(330),
    cloud_cover: Array(48).fill(100), cloud_cover_low: Array(48).fill(90), cloud_cover_mid: Array(48).fill(90),
    relative_humidity_2m: Array(48).fill(91), uv_index: Array(48).fill(0), weather_code: Array(48).fill(code),
    visibility: Array(48).fill(20000), dew_point_2m: Array(48).fill(13),
  },
  daily: {
    temperature_2m_max: Array(7).fill(21), temperature_2m_min: Array(7).fill(14), precipitation_probability_max: Array(7).fill(60),
    uv_index_max: Array(7).fill(5), weather_code: Array(7).fill(code), wind_speed_10m_max: Array(7).fill(20), wind_gusts_10m_max: Array(7).fill(30),
    sunrise: Array(7).fill(`${DAY}T06:20`), sunset: Array(7).fill(`${DAY}T19:20`),
  },
});
const waHour = (code) => ({ temp_c: 15, feelslike_c: 15, condition: { code, text: 'x' }, chance_of_rain: PROB, precip_mm: MM, wind_kph: 9, gust_kph: 20, cloud: 100, humidity: 91, uv: 0 });
const weatherApi = (code) => ({
  location: { tz_id: 'Africa/Johannesburg' },
  current: { temp_c: 15, feelslike_c: 15, condition: { code, text: 'x' }, wind_kph: 9, gust_kph: 20, humidity: 91, cloud: 100, uv: 0, precip_mm: MM },
  forecast: { forecastday: [0, 1].map(() => ({
    day: { maxtemp_c: 21, mintemp_c: 14, daily_chance_of_rain: 60, totalprecip_mm: 5, uv: 5, maxwind_kph: 20, condition: { code, text: 'x' } },
    astro: { sunrise: '06:20 AM', sunset: '07:20 PM' },
    hour: Array.from({ length: 24 }, () => waHour(code)),
  })) },
});
const pirate = (icon) => ({
  offset: 2,
  currently: { temperature: 15, windSpeed: 2.5, windGust: 5, humidity: 0.91, icon },
  daily: { data: Array.from({ length: 7 }, () => ({ temperatureHigh: 21, temperatureLow: 14, precipProbability: 0.6, uvIndex: 5, icon, windSpeed: 3, cloudCover: 1,
    sunriseTime: Date.UTC(2026, 9, 12, 4, 20) / 1000, sunsetTime: Date.UTC(2026, 9, 12, 17, 20) / 1000 })) },
});
const met = (symbol) => ({
  properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
    time: new Date(H0 + i * 3600e3).toISOString(),
    data: { instant: { details: { air_temperature: 15, wind_speed: 2.5, relative_humidity: 91, cloud_area_fraction: 100 } },
      next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: MM } } },
  })) },
});
const tomorrow = (weatherCode, intensity = 0.2) => ({
  data: { timelines: [{ intervals: Array.from({ length: 48 }, (_, i) => ({
    startTime: new Date(Date.UTC(2026, 9, 12, 18, 0, 0) + i * 3600e3).toISOString(),
    values: { temperature: 15, precipitationIntensity: intensity, precipitationProbability: PROB, weatherCode, windSpeed: 2.5, humidity: 91, cloudCover: 100, visibility: 8 },
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
const callHandler = async (lat = '-34.1083', lon = '18.8283', name = 'Strand') => {
  let body;
  await handler({ query: { lat, lon, name } }, { setHeader: vi.fn(), status() { return this; }, json(p) { body = p; return this; } });
  return body;
};
// Strand 20:55: Open-Meteo slight rain (61), WeatherAPI light drizzle (1153), Pirate cloudy, MET heavy rain, Tomorrow.io light fog (2100)
const strandFive = (over = {}) => ({ openMeteo: openMeteo(61), weatherApi: weatherApi(1153), pirate: pirate('cloudy'), met: met('heavyrain'), tomorrow: tomorrow(2100), ...over });

describe('rain-now-descriptive — the handler, end to end', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_UTC));
    process.env.WEATHERAPI_KEY = 'wa-key'; process.env.PIRATE_WEATHER_KEY = 'pw-key'; process.env.TOMORROWIO_API_KEY = 'ti-key';
    weatherCacheGet.mockReset();
    weatherCacheGet.mockResolvedValue(null);   // a miss unless a test serves an entry
    weatherCacheSetDeferred.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY; delete process.env.TOMORROWIO_API_KEY;
  });

  it('Strand 20:55 → rain / rain-now-descriptive, the chance shown lifted to 70, the inputs kept for a cache re-check', async () => {
    stubFive(strandFive());
    const body = await callHandler();
    const sel = body.now.conditionSignals.selector;
    expect(sel.inputs.rainChance).toBeLessThan(SHOWERS_NEARBY_MIN_PROB);
    expect([sel.inputs.rainSources, sel.inputs.rainFamilies]).toEqual([3, 2]);
    expect(sel.base).toEqual({ key: 'rain', reason: 'rain-now-descriptive' });
    expect(deriveCondition(sel.inputs)).toEqual(sel.base);                     // what the cache-hit path re-checks
    expect(body.now.conditionKey).toBe('rain');
    expect(body.now.conditionReason).toBe('rain-now-descriptive');
    expect(body.now.rainChance).toBeGreaterThanOrEqual(70);
  });

  it('WeatherAPI cloudy instead (2 sources) → today\'s might-rain, the chance untouched', async () => {
    stubFive(strandFive({ weatherApi: weatherApi(1006) }));
    const body = await callHandler();
    expect(body.now.conditionKey).toBe('rain-possible');
    expect(body.now.conditionReason).toBe('desc-rain-unconfirmed');
    expect(body.now.rainChance).toBeLessThan(70);
  });

  it('radar over the same hour → the radar route takes the reason, the chance stays ≥ 70', async () => {
    stubFive(strandFive({ tomorrow: tomorrow(4000, 1.2) }));
    const body = await callHandler();
    expect(body.now.conditionKey).toBe('rain');
    expect(body.now.conditionReason).toBe('tomorrow-io-radar-override');
    expect(body.now.rainChance).toBeGreaterThanOrEqual(70);
  });

  it('radar only for the NEXT hour: the candidate keeps the hour, the next-hour bump stands down (key is already rain)', async () => {
    const ti = tomorrow(2100);
    ti.data.timelines[0].intervals[1].values.precipitationIntensity = 1.2;
    stubFive(strandFive({ tomorrow: ti }));
    const body = await callHandler();
    expect(body.now.conditionReason).toBe('rain-now-descriptive');
    expect(body.now.conditionSignals.radarNextHourBump).toBeNull();
    expect(body.now.rainChance).toBeGreaterThanOrEqual(70);
  });

  it('a cache hit on an entry written by this code re-derives the same base and is served as rain', async () => {
    stubFive(strandFive());
    await callHandler();
    expect(weatherCacheSetDeferred).toHaveBeenCalledTimes(1);
    const written = weatherCacheSetDeferred.mock.calls[0][1];
    weatherCacheGet.mockResolvedValue(written);
    const fetchFn = vi.fn(async () => { throw new Error('no provider call on a hit'); });
    vi.stubGlobal('fetch', fetchFn);
    const body = await callHandler();
    expect(body.meta.serverCache).toBe('hit');
    expect(fetchFn).not.toHaveBeenCalled();
    expect([body.now.conditionKey, body.now.conditionReason]).toEqual(['rain', 'rain-now-descriptive']);
    expect(body.now.rainChance).toBeGreaterThanOrEqual(70);
  });

  it('an entry cached before the candidate (no rainSources / rainFamilies) is served as it was written: might-rain', async () => {
    stubFive(strandFive());
    await callHandler();
    const fresh = weatherCacheSetDeferred.mock.calls[0][1];
    const { rainSources, rainFamilies, rainDescRegion, ...oldInputs } = fresh.now.conditionSignals.selector.inputs;
    const oldBase = deriveCondition(oldInputs);
    expect(oldBase).toEqual({ key: 'rain-possible', reason: 'desc-rain-unconfirmed' });
    const legacy = { ...fresh, now: { ...fresh.now, conditionKey: oldBase.key, conditionReason: oldBase.reason, rainChance: oldInputs.rainChance,
      conditionSignals: { ...fresh.now.conditionSignals, selector: { inputs: oldInputs, base: oldBase } } } };
    weatherCacheGet.mockResolvedValue(legacy);
    const fetchFn = vi.fn(async () => { throw new Error('no provider call on a hit'); });
    vi.stubGlobal('fetch', fetchFn);
    const body = await callHandler();
    expect(body.meta.serverCache).toBe('hit');
    expect(fetchFn).not.toHaveBeenCalled();
    expect([body.now.conditionKey, body.now.conditionReason]).toEqual(['rain-possible', 'desc-rain-unconfirmed']);
    expect(body.now.rainChance).toBeLessThan(70);
  });

  it('the same sky at all 20 region points: rain on the coast, today\'s ladder exactly everywhere else', async () => {
    const seen = new Set();
    for (const st of REGION_STATIONS) {
      stubFive(strandFive());
      const body = await callHandler(String(st.lat), String(st.lon), st.id);
      const sel = body.now.conditionSignals.selector;
      const coast = RAIN_NOW_DESC_REGIONS.includes(st.region);
      expect(sel.inputs.rainDescRegion, st.id).toBe(coast);
      // today's ladder on the very same inputs: the candidate's three inputs removed
      const { rainSources, rainFamilies, rainDescRegion, ...todayInputs } = sel.inputs;
      if (coast) {
        expect([body.now.conditionKey, body.now.conditionReason], st.id).toEqual(['rain', 'rain-now-descriptive']);
      } else {
        expect(sel.base, st.id).toEqual(deriveCondition(todayInputs));
        expect(body.now.conditionReason, st.id).not.toBe('rain-now-descriptive');
        expect(body.now.rainChance, st.id).toBeLessThan(70);
      }
      seen.add(st.region);
    }
    expect(seen.size).toBe(13);
  });

  it('across the coast cells\' edges and outside South Africa, the flag follows regionOf and only the coast fires', async () => {
    const POINTS = [
      ['Saldanha', -33.01, 17.94, 'West Coast'], ['Plettenberg Bay', -34.05, 23.37, 'Garden Route'], ['Jeffreys Bay', -34.05, 24.92, 'Eastern Cape'],
      ['Ballito', -29.54, 31.21, 'KZN coast'], ['Pietermaritzburg', -29.60, 30.38, 'KZN inland'], ['London', 51.5, -0.12, null],
    ];
    for (const [name, lat, lon, region] of POINTS) {
      expect(regionOf(lat, lon), name).toBe(region);
      stubFive(strandFive());
      const body = await callHandler(String(lat), String(lon), name);
      const coast = RAIN_NOW_DESC_REGIONS.includes(region);
      expect(body.now.conditionSignals.selector.inputs.rainDescRegion, name).toBe(coast);
      expect(body.now.conditionReason === 'rain-now-descriptive', name).toBe(coast);
    }
  });

  it('Tomorrow.io thunder (8000) still turns it into a storm', async () => {
    stubFive(strandFive({ tomorrow: tomorrow(8000) }));
    const body = await callHandler();
    expect(body.now.conditionKey).toBe('storm');
    expect(body.now.conditionReason).toBe('tomorrow-io-thunder');
  });
});

describe('rain-now-descriptive — the phone', () => {
  const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  it('honours the reason as an evidenced rain (it would otherwise demote it to might-rain)', () => {
    expect(app).toMatch(/now\.conditionReason === 'rain-now-descriptive'/);
  });
});
