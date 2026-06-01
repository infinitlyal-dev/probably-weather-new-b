// /api/share coordinate hardening (audit 2026-05-31, Gap C).
//
// /api/share was the 5th coordinate entry point and the only one that never got
// the strict parseCoord the other four got in 22ed6a3 — it validated with
// Number(), which accepts hex ('0x10' → 16) and empty/whitespace ('' / '  ' →
// 0). A junk coord therefore passed `hasCoords`, fanned out to the weather
// aggregation, and was reflected raw into the share/redirect URLs.
//
// Fix: share.js reuses the SAME exported parseCoord from api/weather.js (no new
// validator). These tests mirror og-coord-hardening: a spy stands in for the
// weather handler so we can assert whether a coord was accepted (handler
// called) or rejected (handler NOT called), while the REAL parseCoord export is
// preserved via importActual.

import { afterEach, describe, expect, it, vi } from 'vitest';

const { weatherSpy } = vi.hoisted(() => ({
  weatherSpy: vi.fn(async (_req, res) => res.status(200).json({
    ok: true,
    now: { tempC: 20, conditionKey: 'clear' },
    daily: [{ highC: 22, lowC: 14, conditionKey: 'clear' }],
    meta: {},
  })),
}));

vi.mock('../api/weather.js', async () => {
  const actual = await vi.importActual('../api/weather.js');
  return { ...actual, default: weatherSpy };
});

const { buildShareMetaHtml } = await import('../api/share.js');
const { parseCoord } = await import('../api/weather.js');

afterEach(() => { weatherSpy.mockClear(); });

describe('shared parseCoord — strict whole-string parser', () => {
  it('rejects hex, partial-numeric, exponent, empty, whitespace, and arrays', () => {
    for (const bad of ['0x10', '90abc', '1e3', '18.42abc', '', '  ', 'NaN', 'Infinity', ['1', '2']]) {
      expect(Number.isNaN(parseCoord(bad)), `expected NaN for ${JSON.stringify(bad)}`).toBe(true);
    }
  });
  it('accepts clean signed/decimal/zero coordinates', () => {
    expect(parseCoord('-33.92')).toBe(-33.92);
    expect(parseCoord('18.8362')).toBe(18.8362);
    expect(parseCoord('0')).toBe(0);
    expect(parseCoord('  -34.1163  ')).toBe(-34.1163); // trims
  });
});

describe('/api/share — strict coordinate validation (Gap C)', () => {
  // Each of these passed the old Number() check but must now be rejected.
  const REJECTED = ['0x10', '90abc', '1e3', '18.42abc', '', '  ', '91', '-91'];
  for (const bad of REJECTED) {
    it(`rejects lat=${JSON.stringify(bad)} — no weather call, no coords embedded`, async () => {
      const html = await buildShareMetaHtml({ lat: bad, lon: '18.42', lang: 'en' });
      expect(weatherSpy).not.toHaveBeenCalled();      // hasCoords=false → no fan-out
      expect(html).not.toMatch(/\/\?[^"']*lat=/);      // app redirect URL carries no lat
    });
  }

  it('rejects an out-of-range lon (181) too', async () => {
    await buildShareMetaHtml({ lat: '-33.92', lon: '181', lang: 'en' });
    expect(weatherSpy).not.toHaveBeenCalled();
  });

  it('accepts a clean coordinate pair — weather fetched, coords embedded', async () => {
    const html = await buildShareMetaHtml({ lat: '-33.92', lon: '18.42', lang: 'en' });
    expect(weatherSpy).toHaveBeenCalledTimes(1);
    expect(html).toContain('lat=-33.92');
    expect(html).toContain('lon=18.42');
  });
});

// C3 residual: buildOgImageUrl was called OUTSIDE the hasCoords guard with raw
// query coords, and its own loose Number() validator accepts hex ('0x10'→16),
// so a junk coord was reflected into the og:image / twitter:image tags (the app
// redirect URL — covered above — was already gated, which masked this).
const ogImageOf = (html) => html.match(/property="og:image" content="([^"]*)"/)?.[1] ?? '';
const twitterImageOf = (html) => html.match(/name="twitter:image" content="([^"]*)"/)?.[1] ?? '';

describe('/api/share — junk coords never reach the og:image / twitter:image tags (C3)', () => {
  for (const bad of ['0x10', '90abc']) {
    it(`lat=${bad} is absent from og:image, twitter:image, and the whole response`, async () => {
      const html = await buildShareMetaHtml({ lat: bad, lon: '18.42', lang: 'en' });
      expect(ogImageOf(html)).not.toContain(bad);
      expect(twitterImageOf(html)).not.toContain(bad);
      expect(ogImageOf(html)).not.toContain('lat=');   // junk input → default OG card, no coords
      expect(html).not.toContain(bad);                 // belt-and-braces: nowhere in the body
    });
  }

  it('valid coords DO reach the og:image card', async () => {
    const html = await buildShareMetaHtml({ lat: '-33.92', lon: '18.42', lang: 'en' });
    expect(ogImageOf(html)).toContain('lat=-33.92');
    expect(ogImageOf(html)).toContain('lon=18.42');
  });
});
