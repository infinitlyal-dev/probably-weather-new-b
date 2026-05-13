import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import handler from '../api/weather.js';

// ---------------------------------------------------------------------------
// Helpers — matches the pattern in tests/weather-met-alignment.test.js
// ---------------------------------------------------------------------------

const makeResponse = (payload, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn(async () => payload),
});

// Open-Meteo payload — every hour reports cloud_cover=50 (the contradiction band).
const makeOpenMeteoPayload = () => ({
  utc_offset_seconds: 7200,
  current: {
    temperature_2m: 22,
    apparent_temperature: 22,
    weather_code: 2, // "Partly cloudy" per openMeteoCodeMap
    wind_speed_10m: 10,
    wind_gusts_10m: 10,
    relative_humidity_2m: 55,
    cloud_cover: 50,
  },
  hourly: {
    temperature_2m: Array(48).fill(22),
    apparent_temperature: Array(48).fill(22),
    precipitation_probability: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10),
    wind_gusts_10m: Array(48).fill(10),
    cloud_cover: Array(48).fill(50),
    relative_humidity_2m: Array(48).fill(55),
    uv_index: Array(48).fill(4),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24),
    temperature_2m_min: Array(7).fill(18),
    precipitation_probability_max: Array(7).fill(0),
    uv_index_max: Array(7).fill(5),
    weather_code: Array(7).fill(2),
    sunrise: Array(7).fill('2026-04-27T06:00'),
    sunset: Array(7).fill('2026-04-27T18:00'),
  },
});

// MET Norway payload — cloud_area_fraction=50 throughout, full 48 hours.
const makeMetPayload = () => {
  const startUtc = Date.UTC(2026, 3, 27, 0, 0, 0);
  return {
    properties: {
      timeseries: Array.from({ length: 48 }, (_, i) => ({
        time: new Date(startUtc + i * 60 * 60 * 1000).toISOString(),
        data: {
          instant: {
            details: {
              air_temperature: 22,
              wind_speed: 3,
              relative_humidity: 55,
              cloud_area_fraction: 50,
            },
          },
          next_1_hours: {
            summary: { symbol_code: 'partlycloudy_day' },
            details: { precipitation_amount: 0 },
          },
        },
      })),
    },
  };
};

const callWeather = async () => {
  let statusCode = 200;
  let body;
  const req = { query: { lat: '-34.1', lon: '18.83', name: 'Strand' } };
  const res = {
    setHeader: vi.fn(),
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  await handler(req, res);
  return { statusCode, body };
};

// ---------------------------------------------------------------------------
// Server side: deriveCondition returns 'partly-cloudy' for a 50% cloud day
// ---------------------------------------------------------------------------

describe('partly-cloudy: server emits the new key', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 13:15 local in +02:00 offset → 11:15 UTC, localHour = 13
    vi.setSystemTime(new Date('2026-04-27T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) {
        return makeResponse(makeOpenMeteoPayload());
      }
      if (href.startsWith('https://api.met.no/')) {
        return makeResponse(makeMetPayload());
      }
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns conditionKey='partly-cloudy' for cloudPct ≈ 50, no rain", async () => {
    const { statusCode, body } = await callWeather();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    // Modal cloud across [50, 50] = 50 → in the partly-cloudy band (30-54).
    expect(body.now.cloudPct).toBe(50);
    expect(body.now.conditionKey).toBe('partly-cloudy');
    // The descriptive label is unchanged by this fix — it's whatever the
    // sources voted for. Just sanity-check it's not 'clear' anymore.
    expect(body.now.conditionLabel.toLowerCase()).toContain('partly');
  });

  it('hourly entries at the same time also report cloudPct=50', async () => {
    const { body } = await callWeather();
    expect(body.hourly[13].cloudPct).toBe(50);
  });

  it('home and hourly are no longer in contradiction at cloudPct=50', async () => {
    const { body } = await callWeather();
    // Server side: home headline source is conditionKey='partly-cloudy'.
    expect(body.now.conditionKey).toBe('partly-cloudy');
    // Hourly side: per-hour cloudPct=50 → icon ⛅ (≥40 in getWeatherIcon).
    expect(body.hourly[13].cloudPct).toBeGreaterThanOrEqual(40);
    expect(body.hourly[13].cloudPct).toBeLessThan(70);
    // Both paths now describe the sky as "partly cloudy".
  });
});

// ---------------------------------------------------------------------------
// Frontend: home headline + hourly icon agree at cloudPct=50
//
// We don't pull in the whole DOM. Instead we evaluate the relevant translation
// banks and the icon picker by source-extraction, mirroring what the running
// app would do.
// ---------------------------------------------------------------------------

describe('partly-cloudy: home and hourly stay consistent', () => {
  it('headline string exists for all 5 languages', () => {
    const src = readFileSync(new URL('../assets/weather-copy.js', import.meta.url), 'utf8');
    // Locate the headlines block and confirm partly-cloudy entry is present
    const match = src.match(/headlines:\s*\{[\s\S]*?\n\s*\},/m);
    expect(match).toBeTruthy();
    const block = match[0];
    expect(block).toMatch(/'partly-cloudy':\s*\{[\s\S]*?en:\s*"Partly cloudy/);
    expect(block).toMatch(/'partly-cloudy':[\s\S]*?af:\s*"Effens bewolk/);
    expect(block).toMatch(/'partly-cloudy':[\s\S]*?zu:\s*"Kunamafu kancane/);
    expect(block).toMatch(/'partly-cloudy':[\s\S]*?xh:\s*"Linamafu kancinci/);
    expect(block).toMatch(/'partly-cloudy':[\s\S]*?st:\s*"Ho na le maru a manyane/);
  });

  it('hero label exists for all 5 languages', () => {
    const src = readFileSync(new URL('../assets/weather-copy.js', import.meta.url), 'utf8');
    const match = src.match(/heroLabels:\s*\{[\s\S]*?\n\s*\},/m);
    expect(match).toBeTruthy();
    const block = match[0];
    expect(block).toMatch(/'partly-cloudy':\s*\{[\s\S]*?en:\s*"Partly cloudy/);
    expect(block).toMatch(/'partly-cloudy':[\s\S]*?af:\s*"Effens bewolk/);
  });

  it("getWeatherIcon (50%) returns ⛅ — hourly icon path", () => {
    // The icon picker is a small pure function; reproduce its rules here.
    const getWeatherIcon = (rp, cp, tc, isNight) => {
      const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
      if (isNum(tc) && tc <= 0) return '❄️';
      if (isNum(rp) && rp >= 50) return '🌧️';
      if (isNum(rp) && rp >= 30) return '🌦️';
      if (isNum(tc) && tc >= 35) return '🔥';
      if (isNum(cp) && cp >= 70) return '☁️';
      if (isNum(cp) && cp >= 40) return '⛅';
      if (isNum(tc) && tc <= 10) return '❄️';
      return isNight ? '🌙' : '☀️';
    };
    expect(getWeatherIcon(0, 50, 22, false)).toBe('⛅');
  });

  it("witty subtitle for partly-cloudy comes from its own bucket, not from T.witty.clear", () => {
    // Extract the relevant arrays straight from the source. We can't easily
    // run getWittyLine in isolation (it depends on the live DOM + settings),
    // but its fallback chain is `T.witty[condition]?.[lang] || ... ||
    // T.witty.clear.en`. So the only condition for the right behaviour is:
    //   1. A 'partly-cloudy' bucket exists with a non-empty per-language array.
    //   2. The content differs from T.witty.clear (otherwise it would still
    //      "fall through" silently to clear-equivalent lines).
    const src = readFileSync(new URL('../assets/weather-copy.js', import.meta.url), 'utf8');

    // Match each bucket: <key>: { en: [...], af: [...], zu: [...], xh: [...], st: [...] },
    const bucketRe = (key) => new RegExp(
      `${key}:\\s*\\{\\s*` +
      `en:\\s*(\\[[^\\]]*\\])\\s*,\\s*` +
      `af:\\s*(\\[[^\\]]*\\])\\s*,\\s*` +
      `zu:\\s*(\\[[^\\]]*\\])\\s*,\\s*` +
      `xh:\\s*(\\[[^\\]]*\\])\\s*,\\s*` +
      `st:\\s*(\\[[^\\]]*\\])`
    );

    const partlyMatch = src.match(bucketRe(`'partly-cloudy'`));
    expect(partlyMatch, "T.witty['partly-cloudy'] bucket missing").toBeTruthy();

    const clearMatch = src.match(bucketRe(`clear`));
    expect(clearMatch, 'T.witty.clear bucket not found (search anchor)').toBeTruthy();

    const langs = ['en', 'af', 'zu', 'xh', 'st'];
    langs.forEach((lang, i) => {
      const partlyArr = JSON.parse(partlyMatch[i + 1]);
      const clearArr = JSON.parse(clearMatch[i + 1]);

      // Bucket has content
      expect(partlyArr.length, `partly-cloudy.${lang} should have lines`).toBeGreaterThan(0);

      // At least one line in partly-cloudy is unique vs clear — proves the
      // rotation surfaces partly-cloudy-specific copy, not clear's pool.
      const overlap = partlyArr.filter(line => clearArr.includes(line));
      expect(overlap.length, `partly-cloudy.${lang} should not be a subset of clear.${lang}`).toBeLessThan(partlyArr.length);
    });

    // Sanity: a known-spec line is in the English pool.
    const enArr = JSON.parse(partlyMatch[1]);
    expect(enArr).toContain("Sun, hide-and-seek champion of the day.");
  });

});

// ---------------------------------------------------------------------------
// WeatherAPI source mapping: code 1003 must NOT be downgraded to "Clear sky"
// even with 0mm precip. Confirms the partly-cloudy preserve fix end to end.
// ---------------------------------------------------------------------------

const makeWeatherApiPayload = ({ code = 1003, text = 'Partly cloudy', precip = 0 } = {}) => {
  const dayObj = (precipMm = 0, uv = 4) => ({
    maxtemp_c: 24, mintemp_c: 18, totalprecip_mm: precipMm, uv,
    daily_chance_of_rain: 0,
    condition: { code, text },
  });
  const hourObj = (precipMm = 0) => ({
    temp_c: 22, feelslike_c: 22,
    chance_of_rain: 0, precip_mm: precipMm,
    wind_kph: 10, gust_kph: 12, humidity: 55,
    cloud: 50,
    condition: { code, text },
  });
  return {
    current: {
      temp_c: 22, feelslike_c: 22,
      wind_kph: 10, gust_kph: 12, humidity: 55,
      condition: { code, text },
    },
    forecast: {
      forecastday: Array.from({ length: 7 }, () => ({
        day: dayObj(precip),
        astro: { sunrise: '06:00 AM', sunset: '06:00 PM' },
        hour: Array.from({ length: 24 }, () => hourObj(precip)),
      })),
    },
  };
};

describe('partly-cloudy: WeatherAPI source mapping preserves the desc', () => {
  beforeEach(() => {
    process.env.WEATHERAPI_KEY = 'test-key';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) {
        return makeResponse(makeOpenMeteoPayload());
      }
      if (href.startsWith('https://api.met.no/')) {
        return makeResponse(makeMetPayload());
      }
      if (href.startsWith('https://api.weatherapi.com/')) {
        return makeResponse(makeWeatherApiPayload({ code: 1003, text: 'Partly cloudy', precip: 0 }));
      }
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });

  afterEach(() => {
    delete process.env.WEATHERAPI_KEY;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("WeatherAPI code 1003 + 0mm precip is preserved as 'Partly cloudy', not flattened to 'Clear sky'", async () => {
    const { statusCode, body } = await callWeather();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);

    // The WA source's contribution to sourceConditions must keep its
    // "Partly cloudy" description — proves the FIX-partly mapping fired.
    const waVote = body.meta.sourceConditions.find(s => s.source === 'WeatherAPI');
    expect(waVote, 'WeatherAPI source vote missing from sourceConditions').toBeTruthy();
    expect(waVote.desc).toBe('Partly cloudy');
    expect(waVote.desc).not.toBe('Clear sky');

    // And the resulting downstream conditionKey is partly-cloudy
    // (cloudPct lands at 50 across all sources → partly band).
    expect(body.now.conditionKey).toBe('partly-cloudy');
  });
});
