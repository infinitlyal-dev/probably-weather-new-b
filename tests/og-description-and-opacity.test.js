import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const weatherHandlerMock = vi.hoisted(() => vi.fn());

vi.mock('../api/weather.js', () => ({
  default: weatherHandlerMock,
}));

const { default: shareHandler } = await import('../api/share.js');

const css = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

const weatherPayload = {
  ok: true,
  location: { name: 'Cape Town, Western Cape' },
  now: { conditionKey: 'clear', tempC: 17 },
  daily: [{ lowC: 12, highC: 19, conditionKey: 'clear' }],
};

async function callShare(query = {}) {
  let statusCode = 200;
  let body = '';
  const headers = new Map();
  const res = {
    setHeader(key, value) {
      headers.set(key.toLowerCase(), value);
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    end(value) {
      body = String(value);
      return this;
    },
  };

  await shareHandler({ query }, res);
  return { statusCode, headers, body };
}

function getOgDescription(html) {
  return html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] || '';
}

describe('panel opacity and share OG descriptions', () => {
  beforeEach(() => {
    weatherHandlerMock.mockReset();
    weatherHandlerMock.mockImplementation(async (_req, res) => res.status(200).json(weatherPayload));
  });

  it('uses the lighter shared panel background token for glass panels', () => {
    expect(css()).toMatch(/--panel-bg:\s*rgba\(0,\s*0,\s*0,\s*0\.5\)/);
    expect(css()).toMatch(/\.screenPanel\s*{[\s\S]*background:\s*var\(--panel-bg\)[\s\S]*backdrop-filter:\s*blur\(16px\)\s*saturate\(120%\)/);
  });

  it('includes live English weather data in og:description', async () => {
    const res = await callShare({ lat: '-33.92', lon: '18.42', lang: 'en' });
    const description = getOgDescription(res.body);

    expect(description).toBe('Cape Town, Western Cape: Probably 12°/19°. Clear skies.');
    expect(description).not.toBe('South African weather, in your language.');
  });

  it('includes live Afrikaans weather data in og:description', async () => {
    const res = await callShare({ lat: '-33.92', lon: '18.42', lang: 'af' });

    expect(getOgDescription(res.body)).toBe('Cape Town, Western Cape: Waarskynlik 12°/19°. Helder lug.');
  });

  it('falls back to the static description if weather data cannot be fetched', async () => {
    weatherHandlerMock.mockImplementationOnce(async (_req, res) => res.status(500).json({ ok: false, error: 'boom' }));

    const res = await callShare({ lat: '-33.92', lon: '18.42', lang: 'en' });

    expect(res.statusCode).toBe(200);
    expect(getOgDescription(res.body)).toBe('South African weather, in your language.');
  });
});
