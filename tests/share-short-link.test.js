// Share link carries the place; /s/ short path; server name fallback (2026-09-15).
//
// WhatsApp previews read "Unknown" because /share had coordinates but no name
// and a forecast cell cached after a skipped LocationIQ lookup carries
// 'Unknown'. The link now carries the sender's place in a short path, the share
// page and the card prefer it, and a budgeted reverse lookup covers old links.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { weatherSpy, geocodeSpy } = vi.hoisted(() => ({
  weatherSpy: vi.fn(async (_req, res) => res.status(200).json({
    ok: true,
    location: { name: 'Unknown', lat: -34.12, lon: 18.84 },
    now: { tempC: 16, conditionKey: 'rain' },
    daily: [{ highC: 18, lowC: 13, conditionKey: 'rain' }],
    meta: {},
  })),
  geocodeSpy: vi.fn(async (_req, res) => res.status(200).json({ ok: true, name: 'Strand, Western Cape' })),
}));

vi.mock('../api/weather.js', async () => {
  const actual = await vi.importActual('../api/weather.js');
  return { ...actual, default: weatherSpy };
});
vi.mock('../api/geocode.js', () => ({ default: geocodeSpy }));

const { buildShareLink, buildOgImageUrl, cleanShareName, shareNameSegment, parseShareNameSegment } = await import('../assets/share-url.js');
const { buildShareMetaHtml } = await import('../api/share.js');
const { canonicalizeOgRequest, buildOgViewModel } = await import('../api/og.js');

const meta = (html, prop) => html.match(new RegExp(`(?:property|name)="${prop}" content="([^"]*)"`))?.[1]?.replace(/&amp;/g, '&') ?? null;

afterEach(() => { weatherSpy.mockClear(); geocodeSpy.mockClear(); });

describe('share link: short path with the place', () => {
  it('matches the ruled shape /s/<lang>/<lat>/<lon>/<condition>/<Place>', () => {
    expect(buildShareLink({ lat: -34.1163, lon: 18.8362, lang: 'en', condition: 'rain-possible', name: 'Strand, Western Cape' }))
      .toBe('https://probablyweather.co.za/s/en/-34.12/18.84/rain-possible/Strand');
  });

  it('spaces become +, the province is dropped, accents survive', () => {
    expect(buildShareLink({ lat: -34.08, lon: 18.85, lang: 'af', condition: 'clear', name: 'Somerset West, Western Cape' }))
      .toBe('https://probablyweather.co.za/s/af/-34.08/18.85/clear/Somerset+West');
    expect(shareNameSegment('Kwa-Nonqubela')).toBe('Kwa-Nonqubela');
    expect(parseShareNameSegment(shareNameSegment('Città del Capo'))).toBe('Città del Capo');
  });

  it('drops placeholder, coordinate-shaped and junk names — the link still works without one', () => {
    for (const bad of ['Unknown', 'My Location', 'Shared location', '34.1°S, 18.8°E', '<script>alert(1)</script>', 'https://evil.example', 'x'.repeat(61)]) {
      expect(cleanShareName(bad), bad).toBe('');
      expect(buildShareLink({ lat: -34.12, lon: 18.84, lang: 'en', condition: 'rain', name: bad })).toBe('https://probablyweather.co.za/s/en/-34.12/18.84/rain');
    }
  });

  it('without coordinates it stays the /share query form', () => {
    expect(buildShareLink({ lang: 'zu' })).toBe('https://probablyweather.co.za/share?lang=zu');
  });

  it('parses the segment whether or not the rewrite already decoded it', () => {
    expect(parseShareNameSegment('Somerset+West')).toBe('Somerset West');
    expect(parseShareNameSegment('Somerset West')).toBe('Somerset West');
    expect(parseShareNameSegment('Port%20Alfred')).toBe('Port Alfred');
    expect(parseShareNameSegment('100%')).toBe('');
  });

  it('vercel.json rewrites both /s/ shapes to /api/share and keeps /share', () => {
    const rewrites = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')).rewrites;
    const by = Object.fromEntries(rewrites.map((r) => [r.source, r.destination]));
    expect(by['/s/:lang/:lat/:lon/:c/:name']).toBe('/api/share?lang=:lang&lat=:lat&lon=:lon&c=:c&name=:name');
    expect(by['/s/:lang/:lat/:lon/:c']).toBe('/api/share?lang=:lang&lat=:lat&lon=:lon&c=:c');
    expect(by['/share']).toBe('/api/share');
  });

  it('the app hands the active place to the link builder', () => {
    const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
    expect(app).toMatch(/buildShareLink\(\{ lat, lon, lang, condition: displayCond, name: activePlace\?\.name \}\)/);
  });
});

describe('share page: the place never reads "Unknown"', () => {
  it('uses the link name in the description, the card URL and og:url — no reverse lookup spent', async () => {
    const html = await buildShareMetaHtml({ lang: 'en', lat: '-34.12', lon: '18.84', c: 'rain', name: 'Strand' });
    expect(meta(html, 'og:description')).toMatch(/^Strand: Probably 13°\/18°\./);
    expect(meta(html, 'og:image')).toBe('https://probablyweather.co.za/api/og?lang=en&lat=-34.12&lon=18.84&c=rain&name=Strand');
    expect(meta(html, 'og:url')).toBe('https://probablyweather.co.za/s/en/-34.12/18.84/rain/Strand');
    expect(geocodeSpy).not.toHaveBeenCalled();
    expect(html).not.toContain('Unknown');
  });

  it('an old /share link whose forecast name is "Unknown" falls back to one budgeted reverse lookup', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const html = await buildShareMetaHtml({ lang: 'af', lat: '-34.12', lon: '18.84' });
    expect(geocodeSpy).toHaveBeenCalledTimes(1);
    expect(geocodeSpy.mock.calls[0][0].query).toMatchObject({ type: 'reverse', lat: '-34.12', lon: '18.84' });
    expect(meta(html, 'og:description')).toMatch(/^Strand, Western Cape: Waarskynlik/);
    expect(meta(html, 'og:image')).toContain('name=Strand');
    expect(html).not.toContain('Unknown');
  });

  it('a resolved forecast name is used as-is (no reverse call)', async () => {
    weatherSpy.mockImplementationOnce(async (_req, res) => res.status(200).json({
      ok: true, location: { name: 'Mthatha, Eastern Cape' }, now: { tempC: 20, conditionKey: 'clear' }, daily: [{ highC: 23, lowC: 14 }], meta: {},
    }));
    const html = await buildShareMetaHtml({ lang: 'xh', lat: '-31.59', lon: '28.79' });
    expect(geocodeSpy).not.toHaveBeenCalled();
    expect(meta(html, 'og:description')).toMatch(/^Mthatha, Eastern Cape: Mhlawumbi/);
  });

  it('a junk name in the link is ignored, never reflected', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const html = await buildShareMetaHtml({ lang: 'en', lat: '-34.12', lon: '18.84', c: 'rain', name: '<b>Win a prize</b>' });
    expect(html).not.toContain('Win a prize');
    expect(meta(html, 'og:description')).toMatch(/^Strand, Western Cape:/);
  });
});

describe('card: the place is part of the canonical URL and wins over "Unknown"', () => {
  it('keeps a clean name, drops a junk one', () => {
    const ok = canonicalizeOgRequest({ url: '/api/og?lang=en&lat=-34.12&lon=18.84&c=rain&name=Somerset+West' });
    expect(ok.needsRedirect).toBe(false);
    expect(ok.locationName).toBe('Somerset West');
    const junk = canonicalizeOgRequest({ url: '/api/og?lang=en&lat=-34.12&lon=18.84&c=rain&name=%3Cb%3E' });
    expect(junk.needsRedirect).toBe(true);
    expect(junk.canonicalPath).toBe('/api/og?lang=en&lat=-34.12&lon=18.84&c=rain');
  });

  it('buildOgImageUrl and the canonicaliser agree, so the crawler is never redirected', () => {
    const url = new URL(buildOgImageUrl({ lat: -34.1163, lon: 18.8362, lang: 'st', condition: 'rain', name: 'Strand, Western Cape' }));
    expect(canonicalizeOgRequest({ url: `${url.pathname}${url.search}` }).needsRedirect).toBe(false);
  });

  it('the view model prefers the link name, and never shows "Unknown"', () => {
    const payload = { location: { name: 'Unknown' }, now: { tempC: 16, conditionKey: 'rain' }, daily: [{ highC: 18, lowC: 13 }], meta: {} };
    expect(buildOgViewModel(payload, { lang: 'en', locationName: 'Strand' }).location).toBe('Strand');
    expect(buildOgViewModel(payload, { lang: 'en' }).location).toBe('South Africa');
  });
});
