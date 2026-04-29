import { beforeEach, describe, expect, it, vi } from 'vitest';

const weatherPayload = {
  ok: true,
  location: { name: 'Strand, Western Cape', lat: -34.1, lon: 18.83 },
  now: {
    tempC: 28,
    feelsLikeC: 30,
    rainChance: 8,
    cloudPct: 35,
    windKph: 18,
    uv: 7,
    conditionKey: 'clear',
  },
  daily: [
    {
      highC: 34,
      lowC: 22,
      rainChance: 8,
      uv: 7,
      conditionKey: 'clear',
    },
  ],
  consensus: { confidenceKey: 'strong' },
  meta: { sources: [{ name: 'Open-Meteo', ok: true }] },
};

vi.mock('../api/weather.js', () => ({
  default: vi.fn(async (_req, res) => res.status(200).json(weatherPayload)),
}));

const { default: ogHandler, buildOgViewModel, CACHE_CONTROL } = await import('../api/og.js');

const callOg = async (query = {}) => {
  let statusCode = 200;
  let body;
  const headers = new Map();
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(key, value) {
      headers.set(key.toLowerCase(), value);
      return this;
    },
    end(value) {
      body = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };

  await ogHandler({ query }, res);
  return { statusCode, headers, body };
};

describe('dynamic OG image share endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a 200 PNG for a valid shared weather location', async () => {
    const res = await callOg({ lat: '-34.1', lon: '18.83', lang: 'en' });

    expect(res.statusCode).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('uses the lang param to pull copy from the requested language bank', () => {
    const model = buildOgViewModel(weatherPayload, { lang: 'af' });

    expect(model.lang).toBe('af');
    expect(model.headline).toBe('Helder lug.');
    expect(model.witty).toBeTruthy();
    expect(model.witty).not.toBe('Pack sunscreen. Or move into a fridge.');
  });

  it('falls back to a safe default image when params are missing or invalid', async () => {
    const res = await callOg({});

    expect(res.statusCode).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('sets the 5 minute cache header', async () => {
    const res = await callOg({ lat: '-34.1', lon: '18.83', lang: 'en' });

    expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL);
    expect(res.headers.get('cache-control')).toContain('max-age=300');
  });
});
