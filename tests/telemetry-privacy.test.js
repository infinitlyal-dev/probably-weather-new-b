import { readFile } from 'node:fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import errorsHandler from '../api/errors.js';
import { sanitizeTelemetryUrl } from '../assets/share-url.js';

const APP_ORIGIN = 'https://www.probablyweather.co.za';

function makeRes() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    setHeader() { return this; },
    json() { return this; },
    end() { return this; },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('S5 telemetry URL privacy', () => {
  it('S5 keeps only path, language and condition in a reported page URL', () => {
    expect(sanitizeTelemetryUrl(
      'https://probablyweather.co.za/share?lat=-34.1163&lon=18.8362&lang=AF&c=storm&city=Home&token=secret#details',
    )).toBe('/share?lang=af&c=storm');
  });

  it('S5 server logging sanitizes a forged full URL before writing it', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    await errorsHandler({
      method: 'POST',
      headers: { origin: APP_ORIGIN, 'x-real-ip': '41.2.3.4' },
      body: {
        message: 'boom',
        url: `${APP_ORIGIN}/?lat=-34.11&lon=18.84&lang=zu&bg=rain&session=secret`,
        source: `${APP_ORIGIN}/?lat=-34.11&lon=18.84&lang=zu&c=rain&sourceToken=secret`,
        stack: `Error: boom\n    at inline (${APP_ORIGIN}/?lat=-34.11&lon=18.84&lang=zu&c=rain)`,
      },
    }, res);

    expect(res.statusCode).toBe(204);
    const summary = errorSpy.mock.calls.find(([label]) => label === '[pw-error]')?.[1] || '';
    const stack = errorSpy.mock.calls.find(([label]) => label === '[pw-error-stack]')?.[1] || '';
    expect(summary).toContain('"url":"/?lang=zu&c=rain"');
    expect(summary).toContain('"source":"/?lang=zu&c=rain"');
    expect(stack).toContain('/?lang=zu&c=rain');
    expect(`${summary}\n${stack}`).not.toMatch(/lat|lon|session|sourceToken|secret|-34\.11|18\.84/);
  });

  it('S5 client reporter sends the sanitized URL instead of location.href', async () => {
    const source = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
    expect(source).toMatch(/url:\s*sanitizeTelemetryUrl\(location\.href\)/);
    expect(source).not.toMatch(/url:\s*location\.href/);
  });
});
