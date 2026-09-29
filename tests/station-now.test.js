// "Now" follows the live station (review/accuracy/stations/PLAN.md, EVAL §15, 29 Sept 2026).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/weather.js';
import { parseMetarWind, parseFeed, stationFor, stationNow, readStationObs, _resetStationMemo, STATION_KEY } from '../api/_lib/station-now.js';
import { STATION_MAP } from '../api/_lib/station-map.js';

const NOW = Date.parse('2026-09-29T06:20:00Z');
const feed = (raw, utc = '2026-09-29T06:00:00Z', station = 'FAPE') => ({ data: [{ station, utc_valid: utc, raw }] });
const obsOf = (raw, utc) => parseFeed(feed(raw, utc), NOW);

describe('the METAR wind group', () => {
  it('reads mean, gust and direction in knots and m/s', () => {
    expect(parseMetarWind('FAPE 281200Z 13025G40KT 9999 FEW020 19/12 Q1012')).toEqual({ meanKph: 46.3, gustKph: 74.1, dir: 130 });
    expect(parseMetarWind('FACT 290600Z VRB01KT CAVOK 14/09 Q1022 NOSIG')).toEqual({ meanKph: 1.9, gustKph: null, dir: null });
    expect(parseMetarWind('XXXX 290600Z 18010MPS 9999')).toEqual({ meanKph: 36, gustKph: null, dir: 180 });
    expect(parseMetarWind('garbage')).toBeNull();
    expect(parseMetarWind('FAPE 290600Z 13099KT 9999')).toBeNull();          // 183 km/h: a typo, dropped
    expect(parseMetarWind('FAPE 290600Z 13040G95KT 9999')).toBeNull();       // gust 176: dropped
  });
  it('keeps only the live stations', () => {
    const v = parseFeed({ data: [{ station: 'FAPE', utc_valid: '2026-09-29T06:00:00Z', raw: 'FAPE 290600Z 27012KT 9999' }, { station: 'FAOR', utc_valid: '2026-09-29T06:00:00Z', raw: 'FAOR 290600Z 08011KT 9999' }] }, NOW);
    expect(Object.keys(v.reports)).toEqual(['FAPE']);
  });
});

describe('which places a live station represents', () => {
  it('only the listed towns within 10 km, on the airports that passed', () => {
    expect(Object.keys(STATION_MAP.stations).sort()).toEqual(['FACT', 'FAEL', 'FALE', 'FAPE', 'FAUT']);
    expect(stationFor(-33.96, 25.62)?.id).toBe('FAPE');          // Gqeberha
    expect(stationFor(-33.90, 18.63)?.id).toBe('FACT');          // Bellville
    expect(stationFor(-34.11, 18.83)).toBeNull();                // Strand: no live station represents it
    expect(stationFor(-33.92, 18.42)).toBeNull();                // Cape Town city: 17 km from the airport
    expect(stationFor(-29.86, 31.02)).toBeNull();                // Durban: 30 km from King Shaka
    expect(stationFor(-26.20, 28.04)).toBeNull();                // Johannesburg: Highveld did not pass
  });
});

describe('the station word on "now" (rule SC)', () => {
  const at = { lat: -33.96, lon: 25.62, nowMs: NOW, shownWindKph: 15, heroWindKph: 15, windLineKph: 25, shownGustKph: 30, heroGustKph: 30, gustLineKph: 50 };
  it('a pumping report 20 min old makes "now" Windy and shows the measured numbers', () => {
    const w = stationNow({ ...at, obs: obsOf('FAPE 290600Z 13020G34KT 9999') });
    expect(w).toMatchObject({ station: 'FAPE', windy: true, fired: 'station', meanKph: 37, gustKph: 63, shownWindKph: 37, shownGustKph: 63 });
  });
  it('a calm report never makes it Windy, and pulls the shown numbers towards the station', () => {
    const w = stationNow({ ...at, obs: obsOf('FAPE 290600Z VRB02KT CAVOK') });
    expect(w.windy).toBe(false);
    expect(w.shownWindKph).toBeLessThan(15);
    expect(w.shownGustKph).toBe(30);                             // no gust group → the models' gust stays
  });
  it('a report in between lifts the numbers over the line (the carried gap)', () => {
    const w = stationNow({ ...at, obs: obsOf('FAPE 290600Z 13015KT 9999') });   // 27.8 km/h, no gust
    expect(w).toMatchObject({ windy: true, fired: 'gap' });
  });
  it('a pumping report older than F no longer fires by itself', () => {
    const w = stationNow({ ...at, obs: obsOf('FAPE 290300Z 13020G34KT 9999', '2026-09-29T03:00:00Z') });
    expect(w.fired).not.toBe('station');
  });
  it('the gap is carried at most 3 h (a quiet airport overnight never keeps a town Windy)', () => {
    const w = stationNow({ ...at, obs: obsOf('FAPE 290200Z 13015KT 9999', '2026-09-29T02:00:00Z') });   // 4.3 h old, 27.8 km/h
    expect(w).toMatchObject({ windy: false, fired: null, fade: 0, shownWindKph: 15 });
  });
  it('no report, a report over 12 h old, or no feed → null (today\'s answer)', () => {
    expect(stationNow({ ...at, obs: null })).toBeNull();
    expect(stationNow({ ...at, obs: obsOf('FAPE 281600Z 13020G34KT', '2026-09-28T16:00:00Z') })).toBeNull();
    expect(stationNow({ ...at, lat: -34.11, lon: 18.83, obs: obsOf('FAPE 290600Z 13020G34KT') })).toBeNull();
  });
});

describe('the feed copy', () => {
  beforeEach(() => _resetStationMemo());
  const fakeRedis = (stored) => {
    const store = new Map(stored ? [[STATION_KEY, stored]] : []);
    return { store, get: vi.fn(async (k) => store.get(k) ?? null), set: vi.fn(async (k, v, o) => { if (o?.nx && store.has(k)) return null; store.set(k, v); return 'OK'; }) };
  };
  it('a fresh stored copy is used without fetching', async () => {
    const redis = fakeRedis({ fetchedAt: NOW - 60e3, reports: { FAPE: { obsUtc: '2026-09-29T06:00:00.000Z', meanKph: 10, gustKph: null } } });
    const fetchImpl = vi.fn();
    const v = await readStationObs({ redis, now: NOW, fetchImpl, schedule: () => {} });
    expect(v.reports.FAPE.meanKph).toBe(10);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('a stale copy is refreshed (under the lock) and the new one is used', async () => {
    const redis = fakeRedis({ fetchedAt: NOW - 20 * 60e3, reports: {} });
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => feed('FAPE 290600Z 13020G34KT 9999') }));
    const v = await readStationObs({ redis, now: NOW, fetchImpl, schedule: () => {} });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(v.reports.FAPE.gustKph).toBe(63);
    expect(redis.store.get(STATION_KEY).reports.FAPE.meanKph).toBe(37);
  });
  it('a failing feed and a copy older than 30 min → null', async () => {
    const redis = fakeRedis({ fetchedAt: NOW - 40 * 60e3, reports: { FAPE: {} } });
    const v = await readStationObs({ redis, now: NOW, fetchImpl: vi.fn(async () => { throw new Error('down'); }), schedule: () => {} });
    expect(v).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// End to end through the handler at Gqeberha: calm models (clear sky, 10 km/h), then the airport's report decides.
// ---------------------------------------------------------------------------
const res = () => { const r = { code: 200, body: null, setHeader: vi.fn(), status(c) { this.code = c; return this; }, json(p) { this.body = p; return this; } }; return r; };
const omPayload = () => ({
  utc_offset_seconds: 7200,
  current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 0, wind_speed_10m: 10, wind_gusts_10m: 18, wind_direction_10m: 130, relative_humidity_2m: 60, cloud_cover: 5 },
  hourly: {
    temperature_2m: Array(48).fill(18), apparent_temperature: Array(48).fill(18), precipitation_probability: Array(48).fill(0), precipitation: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10), wind_gusts_10m: Array(48).fill(18), wind_direction_10m: Array(48).fill(130), cloud_cover: Array(48).fill(5),
    relative_humidity_2m: Array(48).fill(60), uv_index: Array(48).fill(3), weather_code: Array(48).fill(0), visibility: Array(48).fill(30000), dew_point_2m: Array(48).fill(8),
  },
  daily: { temperature_2m_max: Array(7).fill(21), temperature_2m_min: Array(7).fill(12), precipitation_probability_max: Array(7).fill(0), uv_index_max: Array(7).fill(6),
    weather_code: Array(7).fill(0), sunrise: Array(7).fill('2026-09-29T06:10'), sunset: Array(7).fill('2026-09-29T18:30') },
});
const metPayload = () => ({ properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({ time: new Date(Date.UTC(2026, 8, 29) + i * 3600e3).toISOString(),
  data: { instant: { details: { air_temperature: 18, wind_speed: 3, relative_humidity: 60, cloud_area_fraction: 5 } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } } } })) } });

describe('end to end at Gqeberha', () => {
  let iem;
  beforeEach(() => {
    _resetStationMemo();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) return { ok: true, status: 200, json: async () => omPayload() };
      if (href.startsWith('https://api.met.no/')) return { ok: true, status: 200, json: async () => metPayload() };
      if (href === 'https://mesonet.agron.iastate.edu/api/1/currents.json?network=ZA__ASOS') return iem();
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const call = async () => { const r = res(); await handler({ query: { lat: '-33.96', lon: '25.62', name: 'Gqeberha' } }, r); return r; };

  it('the airport pumping → "now" is Windy with the measured numbers', async () => {
    iem = async () => ({ ok: true, json: async () => feed('FAPE 290600Z 13020G34KT 9999 FEW020 18/08 Q1015') });
    const { code, body } = await call();
    expect(code).toBe(200);
    expect(body.now.conditionKey).toBe('wind');
    expect(body.now.conditionReason).toBe('station-wind');
    expect(body.now.windKph).toBe(37);
    expect(body.wind_kph).toBe(37);
    expect(body.gustKph).toBe(63);
    expect(body.meta.station).toMatchObject({ station: 'FAPE', windy: true, fired: 'station' });
    expect(body.now.tempC).toBe(18);                             // temperatures untouched
  });
  it('the airport calm → not Windy', async () => {
    iem = async () => ({ ok: true, json: async () => feed('FAPE 290600Z VRB02KT CAVOK 18/08 Q1015') });
    const { body } = await call();
    expect(body.now.conditionKey).not.toBe('wind');
    expect(body.meta.station).toMatchObject({ station: 'FAPE', windy: false });
  });
  it('the feed down → exactly today\'s answer', async () => {
    iem = async () => { throw new Error('down'); };
    const { body } = await call();
    expect(body.meta.station).toBeNull();
    expect(body.now.conditionKey).not.toBe('wind');
    expect(body.now.windKph).toBe(body.meta.wind.kph);
  });
  it('Strand has no live station: nothing is fetched from the feed', async () => {
    iem = async () => { throw new Error('should not be called'); };
    const r = res(); await handler({ query: { lat: '-34.11', lon: '18.83', name: 'Strand' } }, r);
    expect(r.body.meta.station).toBeNull();
    expect(fetch.mock.calls.some(([u]) => String(u).includes('mesonet'))).toBe(false);
  });
});
