// Precision (review/accuracy/v2/PLAN.md, Fable-reviewed): the corrected five-model consensus joins the blend
// for today's and tomorrow's high and low, as one more member (α ≤ 0.5), SA only, commercial key only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/weather.js';
import { inSouthAfrica, inLowveld, precisionUrl, precisionConsensus, precisionMix, seasonOf, PRECISION_MODELS, PRECISION_DAYS } from '../api/_lib/precision.js';
import { PRECISION_TABLE } from '../api/_lib/precision-table.js';
import { _resetOpenMeteoMonthly } from '../api/_lib/provider-budget.js';
import { SCORED } from '../review/accuracy/v2/stations.mjs';

const ALL = ['best_match', ...PRECISION_MODELS];
const flatTable = (alpha = 0.5) => ({
  alpha,
  days: [0, 1].map(() => Object.fromEntries(['max', 'min'].map((v) => [v, {
    bias: Object.fromEntries(ALL.map((m) => [m, { DJF: 0, MAM: 0, JJA: 0, SON: 0 }])),
    w: Object.fromEntries(ALL.map((m) => [m, 1 / ALL.length])),
  }]))),
});
const hoursFrom = (date, n) => Array.from({ length: n }, (_, i) => { const t = new Date(Date.parse(`${date}T00:00:00Z`) + i * 3600e3); return t.toISOString().slice(0, 16); });
const models = (date, temps) => ({ time: hoursFrom(date, 72), ...Object.fromEntries(PRECISION_MODELS.map((m) => [`temperature_2m_${m}`, temps(m)])) });

describe('the consensus and the mix', () => {
  it('each model gives its day max/min; bias off, weights on, then the mix at α', () => {
    // best_match 10–20 each day; the four others 12–22 → max mean (20+4×22)/5 = 21.6, min (10+4×12)/5 = 11.6
    const day = (lo, hi) => Array.from({ length: 24 }, (_, h) => (h === 4 ? lo : h === 14 ? hi : (lo + hi) / 2));
    const bm = [...day(10, 20), ...day(10, 20), ...day(10, 20)];
    const cons = precisionConsensus({ bestMatch: bm, models: models('2026-07-10', () => [...day(12, 22), ...day(12, 22), ...day(12, 22)]), table: flatTable() });
    expect(cons).toHaveLength(PRECISION_DAYS);
    expect(cons[0]).toEqual({ date: '2026-07-10', high: 21.6, low: 11.6 });
    const t = flatTable(); t.days[0].max.bias.gfs_seamless.JJA = 2;   // GFS reads 2 °C warm in winter
    expect(precisionConsensus({ bestMatch: bm, models: models('2026-07-10', () => [...day(12, 22), ...day(12, 22), ...day(12, 22)]), table: t })[0].high).toBe(21.2);
    expect(precisionMix({ blendHigh: 20, blendLow: 10, consensus: { high: 22, low: 12 }, strip: [], alpha: 0.5 })).toEqual({ highC: 21, lowC: 11, applied: true });
  });

  it('no consensus: the blend stands exactly as it was', () => {
    expect(precisionMix({ blendHigh: 20.3, blendLow: 9.1, consensus: null, strip: [25] })).toEqual({ highC: 20.3, lowC: 9.1, applied: false });
  });

  it('a model missing any hour of a day: no consensus for that day', () => {
    const full = Array(72).fill(15);
    const cons = precisionConsensus({ bestMatch: full, models: models('2026-01-05', (m) => (m === 'icon_seamless' ? [...Array(30).fill(15), null, ...Array(41).fill(15)] : full)), table: flatTable() });
    expect(cons[0]).not.toBeNull();   // the gap is at hour 30: tomorrow
    expect(cons[1]).toBeNull();
  });

  it('the high is never under the strip\'s warmest hour, the low never over its coolest', () => {
    expect(precisionMix({ blendHigh: 20, blendLow: 10, consensus: { high: 18, low: 12 }, strip: [11, 19.5, 15], alpha: 0.5 })).toEqual({ highC: 19.5, lowC: 11, applied: true });
  });

  it('seasons, the SA box, and the request (temperature only, four models, three days)', () => {
    expect(['2026-12-01', '2026-03-01', '2026-06-30', '2026-09-24'].map(seasonOf)).toEqual(['DJF', 'MAM', 'JJA', 'SON']);
    for (const [lat, lon] of [[-33.97, 18.60], [-22.35, 30.04], [-29.60, 31.13], [-34.83, 20.00]]) expect(inSouthAfrica(lat, lon), `${lat},${lon}`).toBe(true);
    for (const [lat, lon] of [[51.5, -0.12], [-33.87, 151.2], [-15.4, 28.3], [-36.5, 20]]) expect(inSouthAfrica(lat, lon), `${lat},${lon}`).toBe(false);
    const url = precisionUrl('https://customer-api.open-meteo.com/v1/forecast', -34.1, 18.84, '&apikey=K');
    expect(url).toBe('https://customer-api.open-meteo.com/v1/forecast?latitude=-34.1&longitude=18.84&hourly=temperature_2m&models=gfs_seamless,icon_seamless,ukmo_seamless,meteofrance_seamless&timezone=auto&forecast_days=3&apikey=K');
  });
});

describe('the shipped table', () => {
  it('two days (today at the latest-run lead, tomorrow at 24 h), five models, sane numbers, α ≤ 0.5', () => {
    expect(PRECISION_TABLE.models).toEqual(ALL);
    expect(PRECISION_TABLE.alpha).toBeGreaterThan(0);
    expect(PRECISION_TABLE.alpha).toBeLessThanOrEqual(0.5);
    expect(PRECISION_TABLE.days).toHaveLength(2);
    for (const day of PRECISION_TABLE.days) for (const v of ['max', 'min']) {
      const w = ALL.map((m) => day[v].w[m]);
      expect(w.every((x) => x > 0)).toBe(true);
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
      for (const m of ALL) for (const s of ['DJF', 'MAM', 'JJA', 'SON']) expect(Math.abs(day[v].bias[m][s])).toBeLessThan(6);
    }
  });

  it('the Lowveld block covers the region the backtest found made worse, and no other scored airport', () => {
    expect(PRECISION_TABLE.blocked).toEqual(['Lowveld']);
    for (const s of SCORED) expect(inLowveld(s.lat, s.lon), `${s.id} ${s.region}`).toBe(s.region === 'Lowveld');
    for (const [lat, lon] of [[-23.83, 30.16], [-23.94, 31.14], [-22.35, 30.04], [-25.79, 31.05], [-26.49, 31.38]]) expect(inLowveld(lat, lon), `${lat},${lon}`).toBe(true);
    for (const [lat, lon] of [[-23.90, 29.45], [-25.10, 30.45], [-26.50, 29.98], [-27.60, 32.03], [51.5, 31]]) expect(inLowveld(lat, lon), `${lat},${lon}`).toBe(false);
  });
});

// ---- the handler, end to end ----
const makeResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn(async () => payload) });
const flat = (n, v) => Array(n).fill(v);
const omPayload = {
  utc_offset_seconds: 7200,
  current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 0, wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 50, cloud_cover: 10 },
  hourly: {
    temperature_2m: Array.from({ length: 168 }, (_, i) => 12 + 8 * Math.sin(((i % 24) - 8) / 24 * Math.PI * 2 * 0.5) ** 2), apparent_temperature: flat(168, 18),
    precipitation_probability: flat(168, 0), precipitation: flat(168, 0), wind_speed_10m: flat(168, 10), wind_gusts_10m: flat(168, 12),
    wind_direction_10m: flat(168, 180), cloud_cover: flat(168, 10), relative_humidity_2m: flat(168, 50), uv_index: flat(168, 4),
    weather_code: flat(168, 0), visibility: flat(168, 20000), dew_point_2m: flat(168, 8),
  },
  daily: {
    temperature_2m_max: flat(7, 20), temperature_2m_min: flat(7, 12), precipitation_probability_max: flat(7, 0), uv_index_max: flat(7, 4),
    weather_code: flat(7, 0), wind_speed_10m_max: flat(7, 10),
    sunrise: Array.from({ length: 7 }, (_, i) => `2026-07-${10 + i}T07:30`), sunset: Array.from({ length: 7 }, (_, i) => `2026-07-${10 + i}T17:50`),
  },
};
const metPayload = { properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({ time: new Date(Date.UTC(2026, 6, 9, 22 + i)).toISOString(), data: { instant: { details: { air_temperature: 16, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } } } })) } };
const modelsPayload = { hourly: models('2026-07-10', () => Array.from({ length: 72 }, (_, i) => 13 + 9 * Math.sin(((i % 24) - 8) / 24 * Math.PI * 2 * 0.5) ** 2)) };

let fetched = [];
let precisionReply = () => makeResponse(modelsPayload);
const fetchStub = vi.fn(async (url) => {
  const href = String(url); fetched.push(href);
  if (href.includes('open-meteo.com/') && href.includes('models=')) return precisionReply();
  if (href.includes('open-meteo.com/')) return makeResponse(omPayload);
  if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
  throw new Error(`Unexpected URL: ${href}`);
});
const call = async (lat, lon) => {
  let body; const res = { setHeader: vi.fn(), status() { return this; }, json(p) { body = p; return this; } };
  await handler({ query: { lat: String(lat), lon: String(lon), name: 'Test' } }, res);
  return body;
};
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-10T06:30:00Z'));
  fetched = []; precisionReply = () => makeResponse(modelsPayload);
  vi.stubGlobal('fetch', fetchStub); _resetOpenMeteoMonthly();
});
afterEach(() => { delete process.env.OPEN_METEO_API_KEY; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('the forecast endpoint', () => {
  it('the models answer for a different local date (the two requests straddled midnight): that day is left alone', async () => {
    process.env.OPEN_METEO_API_KEY = 'k';
    precisionReply = () => makeResponse({ hourly: models('2026-07-11', () => Array(72).fill(15)) });
    const body = await call(-33.41, 18.51);
    expect(body.meta.precision.days.map((d) => d.day)).toEqual([]);          // day 0 is the 10th, the models' day 0 the 11th
    expect(body.meta.precision.status).toBe('fallback');
  });

  it('key and SA, but Open-Meteo switched off: no extra request, status "budget"', async () => {
    process.env.OPEN_METEO_API_KEY = 'k'; process.env.PW_SOURCES_OFF = 'open-meteo';
    try {
      const body = await call(-33.61, 18.51);
      expect(fetched.some((u) => u.includes('models='))).toBe(false);
      expect(body.meta.precision.status).toBe('budget');
    } finally { delete process.env.PW_SOURCES_OFF; }
  });

  it('in SA with the key: one extra request, days 0 and 1 take the mix, days 2–6 untouched, meta records it', async () => {
    process.env.OPEN_METEO_API_KEY = 'k';
    const body = await call(-33.21, 18.51);
    expect(fetched.filter((u) => u.includes('models=')).length).toBe(1);
    expect(body.meta.precision.status).toBe('applied');
    expect(body.meta.precision.table).toBe(PRECISION_TABLE.id);
    expect(body.meta.precision.days.map((d) => d.day)).toEqual([0, 1]);
    const a = PRECISION_TABLE.alpha, r1 = (x) => Math.round(x * 10) / 10;
    for (const d of body.meta.precision.days) {
      const strip = body.hourly.slice(d.day * 24, d.day * 24 + 24).map((h) => h.tempC).filter((x) => typeof x === 'number');
      expect(d.highC).toBe(Math.max(r1((1 - a) * d.blendHigh + a * d.consensusHigh), Math.max(...strip)));
      expect(d.lowC).toBe(Math.min(r1((1 - a) * d.blendLow + a * d.consensusLow), Math.min(...strip)));
      expect(body.daily[d.day].highC).toBe(d.highC);
      expect(body.daily[d.day].lowC).toBe(d.lowC);
    }
    const base = await (async () => { delete process.env.OPEN_METEO_API_KEY; return call(-33.23, 18.51); })();
    for (let i = 2; i < 7; i++) expect(body.daily[i].highC).toBe(base.daily[i].highC);
  });

  it('outside SA: no extra request and the days are exactly the blend', async () => {
    process.env.OPEN_METEO_API_KEY = 'k';
    const body = await call(51.5, -0.12);
    expect(fetched.some((u) => u.includes('models='))).toBe(false);
    expect(body.meta.precision).toMatchObject({ status: 'outside-sa', days: [] });
    delete process.env.OPEN_METEO_API_KEY;
    const keyless = await call(51.52, -0.12);
    expect(body.daily.map((d) => [d.highC, d.lowC])).toEqual(keyless.daily.map((d) => [d.highC, d.lowC]));
  });

  it('in the Lowveld: no extra request, status "lowveld", the days exactly the blend', async () => {
    process.env.OPEN_METEO_API_KEY = 'k';
    const body = await call(-25.47, 30.97);
    expect(fetched.some((u) => u.includes('models='))).toBe(false);
    expect(body.meta.precision).toMatchObject({ status: 'lowveld', days: [] });
    delete process.env.OPEN_METEO_API_KEY;
    const keyless = await call(-25.45, 30.97);
    expect(body.daily.map((d) => [d.highC, d.lowC])).toEqual(keyless.daily.map((d) => [d.highC, d.lowC]));
  });

  it('the extra request fails: the days are exactly what they are without it', async () => {
    process.env.OPEN_METEO_API_KEY = 'k';
    precisionReply = () => makeResponse({ error: 'server' }, 500);
    const failed = await call(-26.11, 28.25);
    expect(failed.meta.precision).toMatchObject({ status: 'fallback', days: [] });
    delete process.env.OPEN_METEO_API_KEY;
    const off = await call(-26.13, 28.25);
    expect(off.meta.precision).toMatchObject({ status: 'off', days: [] });
    expect(failed.daily.map((d) => [d.highC, d.lowC])).toEqual(off.daily.map((d) => [d.highC, d.lowC]));
    expect(fetched.filter((u) => u.includes('models=')).length).toBe(1);   // only the keyed call asked
  });
});
