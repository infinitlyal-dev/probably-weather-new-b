// Codex cross-API finding (2026-05-30): /api/og is a SECOND entry point into the
// weather aggregation — handler() parses lat/lon then calls callWeatherHandler()
// → weatherHandler internally. It must reject malformed coords with the same
// strict parse as /api/weather, or '90abc' partial-parses to 90 and still fans
// out to the 5 providers via the OG wrapper.
//
// This file mocks ../api/weather.js with a SPY so we can assert whether the
// internal weather call happened. (It lives in its own file because
// api-input-hardening.test.js imports the REAL weather handler and must not
// mock it.)

import { afterEach, describe, expect, it, vi } from 'vitest';

const weatherSpy = vi.fn(async (_req, res) => res.status(200).json({
  ok: true,
  location: { name: 'Test', lat: -34.1, lon: 18.83 },
  now: { tempC: 20, conditionKey: 'clear' },
  daily: [{ highC: 22, lowC: 14, conditionKey: 'clear' }],
  consensus: { confidenceKey: 'strong' },
  meta: { sources: [] },
}));

vi.mock('../api/weather.js', () => ({ default: weatherSpy }));

const { default: ogHandler } = await import('../api/og.js');

function callOg(query) {
  let statusCode = 200;
  const headers = new Map();
  let body;
  const res = {
    status(c) { statusCode = c; return this; },
    setHeader(k, v) { headers.set(String(k).toLowerCase(), v); return this; },
    end(v) { body = v; return this; },
    json(v) { body = v; return this; },
  };
  return ogHandler({ query }, res).then(() => ({ statusCode, headers, body }));
}

afterEach(() => { weatherSpy.mockClear(); });

describe('/api/og coordinate hardening (codex cross-API finding)', () => {
  it('calls the weather aggregation for a VALID coordinate', async () => {
    const res = await callOg({ lat: '-34.1', lon: '18.83', lang: 'en' });
    expect(res.statusCode).toBe(200);
    expect(weatherSpy).toHaveBeenCalledTimes(1); // valid coords → per-location card
  });

  it('does NOT call weather aggregation for a partial-numeric coord (90abc)', async () => {
    const res = await callOg({ lat: '90abc', lon: '18', lang: 'en' });
    // Still renders a (fallback) card, but must NOT have fanned out to providers.
    expect(res.statusCode).toBe(200);
    expect(weatherSpy).not.toHaveBeenCalled();
  });

  it('does NOT call weather aggregation for a hex coord (0x10)', async () => {
    await callOg({ lat: '0x10', lon: '18', lang: 'en' });
    expect(weatherSpy).not.toHaveBeenCalled();
  });

  it('does NOT call weather aggregation for an out-of-range coord (99999)', async () => {
    await callOg({ lat: '99999', lon: '18', lang: 'en' });
    expect(weatherSpy).not.toHaveBeenCalled();
  });

  it('does NOT call weather aggregation for an array-valued coord', async () => {
    await callOg({ lat: ['1', '2'], lon: '18', lang: 'en' });
    expect(weatherSpy).not.toHaveBeenCalled();
  });

  it('renders the generic card (200 PNG) with no coords at all', async () => {
    const res = await callOg({ lang: 'en' });
    expect(res.statusCode).toBe(200);
    expect(weatherSpy).not.toHaveBeenCalled();
  });
});
