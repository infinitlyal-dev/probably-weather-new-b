// Phase A weather logic fixes:
// 1. UV temp gate — UV never fires as headline when dailyHighC < 15
// 2. Hail and thunder as distinct conditions with two-source consensus
// 3. Wind banner — ⚠️ Wind Warning prefix + 24h localStorage dismissal

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import handler, { deriveCondition, categorizeDesc } from '../api/weather.js';

// ---------------------------------------------------------------------------
// PART 1 — UV temp gate (unit tests on deriveCondition)
// ---------------------------------------------------------------------------

describe('UV temp gate (Bug 2)', () => {
  const baseArgs = {
    rainChance: 0,
    windKph: 5,
    cloudPct: 10,
    isDay: true,
  };

  it("does NOT return 'uv' on a cold day (dailyHighC=13, uvIndex=6)", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Clear sky',
      tempC: 9,
      uvIndex: 6,
      dailyHighC: 13,
    });
    expect(result.key).not.toBe('uv');
  });

  it("does NOT return 'uv' on a cold day (dailyHighC=13, uvIndex=8 — high UV rung)", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Clear sky',
      tempC: 9,
      uvIndex: 8,
      dailyHighC: 13,
    });
    expect(result.key).not.toBe('uv');
  });

  it("returns 'uv' on a warm day (dailyHighC=22, uvIndex=6)", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Clear sky',
      tempC: 18,
      uvIndex: 6,
      dailyHighC: 22,
    });
    expect(result.key).toBe('uv');
  });

  it("returns 'uv' when dailyHighC is missing (preserves data-gap behaviour, uvIndex=8)", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Clear sky',
      tempC: 18,
      uvIndex: 8,
      // dailyHighC intentionally omitted
    });
    expect(result.key).toBe('uv');
  });

  it("returns 'uv' at exactly dailyHighC=15 (boundary — NOT blocked)", () => {
    // cloudPct overridden to 30 so the new cold-clear branch (cloudPct<30) does
    // not catch this chilly-clear case. UV's own cloud gates accept cloudPct=30
    // (only blocks at >=55), so this still tests the UV-boundary intent.
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Clear sky',
      tempC: 12,
      cloudPct: 30,
      uvIndex: 8,
      dailyHighC: 15,
    });
    expect(result.key).toBe('uv');
  });

  it("does NOT return 'uv' just below the boundary (dailyHighC=14, uvIndex=8)", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Clear sky',
      tempC: 12,
      uvIndex: 8,
      dailyHighC: 14,
    });
    expect(result.key).not.toBe('uv');
  });
});

// ---------------------------------------------------------------------------
// PART 2 — Hail and thunder consensus (unit tests on deriveCondition)
// ---------------------------------------------------------------------------

describe('Hail consensus', () => {
  const baseArgs = {
    rainChance: 40,
    tempC: 12,
    windKph: 10,
    cloudPct: 80,
    isDay: true,
  };

  it("returns 'hail' when one source flags hail AND another corroborates with rain", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Thunderstorm with heavy hail',
      sourceDescs: ['Thunderstorm with heavy hail', 'Rain'],
    });
    expect(result.key).toBe('hail');
  });

  it("returns 'hail' when MET flags hagel (Afrikaans/Dutch) and another corroborates", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Hagel',
      sourceDescs: ['Hagel', 'Heavy rain showers'],
    });
    expect(result.key).toBe('hail');
  });

  it("does NOT return 'hail' when only one source flags it (no corroboration)", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Hail',
      sourceDescs: ['Hail', 'Partly cloudy'],
    });
    expect(result.key).not.toBe('hail');
  });

  it("does NOT return 'hail' without sourceDescs (single-source backward compat path)", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Thunderstorm with heavy hail',
      // sourceDescs omitted — falls through to priority 1 storm
    });
    // priority 1 'storm' wins because desc contains 'thunder'
    expect(result.key).toBe('storm');
    expect(result.key).not.toBe('hail');
  });
});

describe('Thunder consensus', () => {
  const baseArgs = {
    rainChance: 40,
    tempC: 18,
    windKph: 15,
    cloudPct: 70,
    isDay: true,
  };

  it("returns 'thunder' when one source flags thunder AND another corroborates with rain", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Thunderstorm',
      sourceDescs: ['Thunderstorm', 'Rain'],
    });
    expect(result.key).toBe('thunder');
  });

  it("returns 'thunder' for 'Rain and thunder' (MET Norway) + 'Patchy rain' corroborator", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Rain and thunder',
      sourceDescs: ['Rain and thunder', 'Patchy rain'],
    });
    expect(result.key).toBe('thunder');
  });

  it("returns 'thunder' for Afrikaans 'donder' keyword", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Donder en reën',
      sourceDescs: ['Donder en reën', 'Shower'],
    });
    expect(result.key).toBe('thunder');
  });

  it("does NOT return 'thunder' when only one source flags thunder (no corroboration)", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Thunderstorm',
      sourceDescs: ['Thunderstorm', 'Clear sky'],
    });
    expect(result.key).not.toBe('thunder');
    // Falls through to priority 1 storm (single-source thunder)
    expect(result.key).toBe('storm');
  });

  it("returns 'hail' when both hail AND thunder are present (hail beats thunder in priority order)", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Thunderstorm with hail',
      sourceDescs: ['Thunderstorm with hail', 'Rain'],
    });
    expect(result.key).toBe('hail');
  });
});

// ---------------------------------------------------------------------------
// PART 2 — Integration test through the full handler (hail consensus end-to-end)
// ---------------------------------------------------------------------------

const makeResponse = (payload, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn(async () => payload),
});

// Open-Meteo with weather_code=99 (Thunderstorm with heavy hail)
const makeOpenMeteoHailPayload = () => ({
  utc_offset_seconds: 7200,
  current: {
    temperature_2m: 15,
    apparent_temperature: 14,
    weather_code: 99, // Thunderstorm with heavy hail
    wind_speed_10m: 12,
    wind_gusts_10m: 25,
    relative_humidity_2m: 90,
    cloud_cover: 95,
  },
  hourly: {
    temperature_2m: Array(48).fill(15),
    apparent_temperature: Array(48).fill(14),
    precipitation_probability: Array(48).fill(80),
    wind_speed_10m: Array(48).fill(12),
    wind_gusts_10m: Array(48).fill(25),
    cloud_cover: Array(48).fill(95),
    relative_humidity_2m: Array(48).fill(90),
    uv_index: Array(48).fill(2),
  },
  daily: {
    temperature_2m_max: Array(7).fill(17),
    temperature_2m_min: Array(7).fill(12),
    precipitation_probability_max: Array(7).fill(80),
    uv_index_max: Array(7).fill(3),
    weather_code: Array(7).fill(99),
    sunrise: Array(7).fill('2026-05-11T06:00'),
    sunset: Array(7).fill('2026-05-11T18:00'),
  },
});

// MET Norway with a rain symbol — corroborates the hail flag from Open-Meteo
const makeMetRainPayload = () => {
  const startUtc = Date.UTC(2026, 4, 11, 0, 0, 0);
  return {
    properties: {
      timeseries: Array.from({ length: 48 }, (_, i) => ({
        time: new Date(startUtc + i * 60 * 60 * 1000).toISOString(),
        data: {
          instant: {
            details: {
              air_temperature: 15,
              wind_speed: 3,
              relative_humidity: 90,
              cloud_area_fraction: 95,
            },
          },
          next_1_hours: {
            summary: { symbol_code: 'rain' },
            details: { precipitation_amount: 4 },
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
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  await handler(req, res);
  return { statusCode, body };
};

describe('Hail consensus — end-to-end through the API handler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) {
        return makeResponse(makeOpenMeteoHailPayload());
      }
      if (href.startsWith('https://api.met.no/')) {
        return makeResponse(makeMetRainPayload());
      }
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("conditionKey === 'hail' when OM reports thunder+hail and MET corroborates with rain", async () => {
    const { statusCode, body } = await callWeather();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.now.conditionKey).toBe('hail');
  });
});

// ---------------------------------------------------------------------------
// PART 2 — Background folder routing for hail/thunder
// ---------------------------------------------------------------------------

describe('Background folder mapping for hail/thunder', () => {
  it("hail and thunder both route to bg/storm/ via WEATHER_BACKGROUND_ALIASES", async () => {
    const { WEATHER_BACKGROUND_ALIASES, getWeatherBackgroundFolder } = await import('../assets/weather-visuals.js');
    expect(WEATHER_BACKGROUND_ALIASES.hail).toBe('storm');
    expect(WEATHER_BACKGROUND_ALIASES.thunder).toBe('storm');
    expect(getWeatherBackgroundFolder('hail')).toBe('storm');
    expect(getWeatherBackgroundFolder('thunder')).toBe('storm');
    // Sanity: storm itself is unchanged
    expect(getWeatherBackgroundFolder('storm')).toBe('storm');
  });
});

// ---------------------------------------------------------------------------
// PART 2 — Copy for hail/thunder in all 5 languages
// ---------------------------------------------------------------------------

describe('Hail/thunder copy in weather-copy.js', () => {
  const src = readFileSync(new URL('../assets/weather-copy.js', import.meta.url), 'utf8');

  it("heroLabels.thunder and heroLabels.hail exist for all 5 languages", () => {
    const block = src.match(/heroLabels:\s*\{[\s\S]*?\n\s*\},/m)[0];
    for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
      expect(block).toMatch(new RegExp(`thunder:[\\s\\S]*?${lang}:\\s*"[^"]+`));
      expect(block).toMatch(new RegExp(`hail:[\\s\\S]*?${lang}:\\s*"[^"]+`));
    }
  });

  it("headlines.thunder and headlines.hail exist for all 5 languages", () => {
    const block = src.match(/headlines:\s*\{[\s\S]*?\n\s*\},/m)[0];
    for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
      expect(block).toMatch(new RegExp(`thunder:[\\s\\S]*?${lang}:\\s*"[^"]+`));
      expect(block).toMatch(new RegExp(`hail:[\\s\\S]*?${lang}:\\s*"[^"]+`));
    }
  });

  it("witty.thunder and witty.hail buckets exist with non-empty arrays per language", () => {
    // Scope to the witty: block so the per-condition regex doesn't accidentally
    // hit the heroLabels block (which also has thunder:/hail: keys but with
    // scalar string values rather than arrays).
    const wittyBlock = src.match(/witty:\s*\{[\s\S]*?\n\s*\},?\s*\}/m)?.[0];
    expect(wittyBlock, 'witty top-level block missing').toBeTruthy();
    for (const condition of ['thunder', 'hail']) {
      const re = new RegExp(`${condition}:\\s*\\{[\\s\\S]*?\\n\\s*\\}`, 'm');
      const block = wittyBlock.match(re)?.[0];
      expect(block, `${condition} witty block missing`).toBeTruthy();
      for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
        expect(block).toMatch(new RegExp(`${lang}:\\s*\\[\\s*"`));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// PART 3 — Wind banner: warning-icon prefix + 24h localStorage dismissal
// ---------------------------------------------------------------------------

describe('Wind banner — warning label', () => {
  const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

  it("T.capeDr.warningLabel has translations in all 5 languages", () => {
    const block = src.match(/warningLabel:\s*\{[\s\S]*?\}/m)?.[0];
    expect(block).toBeTruthy();
    for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
      expect(block).toMatch(new RegExp(`${lang}:\\s*"[^"]+"`));
    }
  });

  it('renderCapeWind prefixes the banner with the drawn warning icon', () => {
    // M5 replaced the ⚠️ emoji with the icon family's warning glyph. Three
    // things have to hold, not one: the icon is the drawn one, the label and
    // line still ride together in that order, and the copy is still ESCAPED —
    // the prefix moved from a text string into innerHTML, so losing the escape
    // would turn a translated line into markup.
    expect(src).toMatch(/weatherIconSvg\('warning',\s*\{\s*size:\s*\d+\s*\}\)/);
    expect(src).toMatch(/capeWindText\.innerHTML\s*=[\s\S]{0,160}escapeHtml\(`\$\{label\} — \$\{capeWindLine\}`\)/);
    // And the emoji must not come back anywhere in the app source.
    expect(src).not.toMatch(/⚠/);
  });
});

describe('Wind banner — 24h localStorage dismissal', () => {
  const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

  it("dismissCapeWind writes a 24-hour expiry to localStorage", () => {
    // 24h expressed as 24 * 60 * 60 * 1000 — the constant.
    expect(src).toMatch(/WIND_BANNER_DISMISS_KEY\s*=\s*'pw-wind-banner-dismissed-until'/);
    expect(src).toMatch(/WIND_BANNER_DISMISS_MS\s*=\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(src).toMatch(/localStorage\.setItem\(WIND_BANNER_DISMISS_KEY,\s*String\(Date\.now\(\)\s*\+\s*WIND_BANNER_DISMISS_MS\)\)/);
  });

  it("isCapeWindDismissed reads the expiry and compares to Date.now()", () => {
    expect(src).toMatch(/localStorage\.getItem\(WIND_BANNER_DISMISS_KEY\)/);
    expect(src).toMatch(/Date\.now\(\)\s*<\s*until/);
  });

  it("the session-only `let capeWindDismissed` flag is no longer present", () => {
    // Old session behaviour reset on every reload. New code persists 24h.
    expect(src).not.toMatch(/let\s+capeWindDismissed\s*=/);
  });

  it("renderCapeWind gates on isCapeWindDismissed (not the old session flag)", () => {
    expect(src).toMatch(/if\s*\(!isCapeWindDismissed\(\)\s*&&\s*isWesternCape/);
  });
});

// ---------------------------------------------------------------------------
// PART 2 — categorizeDesc still bucketizes thunder as 'storm' for the
// existing FIX-001 majority check — we deliberately did NOT refactor the
// category-aware voting (deferred to Phase B).
// ---------------------------------------------------------------------------

describe('categorizeDesc backward compatibility', () => {
  it("'Thunderstorm' still buckets as 'storm' (so FIX-001 majority gate is unchanged)", () => {
    expect(categorizeDesc('Thunderstorm')).toBe('storm');
  });
  it("'Hail' still buckets as 'cold' (Phase B will refactor; Phase A only adds top-priority consensus)", () => {
    expect(categorizeDesc('Hail')).toBe('cold');
  });
});
