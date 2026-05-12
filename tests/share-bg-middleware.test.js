import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';

import middleware, { __test, config as middlewareConfig } from '../middleware.js';
import {
  buildShareUrl,
  normalizeShareCondition,
  SHARE_ORIGIN,
} from '../assets/share-url.js';

// Conditions that MUST exist as static OG images on disk.
const REQUIRED_OG_SLUGS = [
  'clear', 'cloudy', 'cold', 'fog', 'heat', 'rain',
  'storm', 'wind', 'rain-possible', 'uv', 'default',
];

const MAX_OG_BYTES = 300 * 1024;

describe('static OG image inventory', () => {
  it.each(REQUIRED_OG_SLUGS)('has /og/%s.jpg under 300KB', (slug) => {
    const url = new URL(`../og/${slug}.jpg`, import.meta.url);
    const stat = statSync(url);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBeGreaterThan(1000);
    expect(stat.size).toBeLessThan(MAX_OG_BYTES);
  });
});

describe('share URL builder (?bg= + ?city=)', () => {
  it('normalizes known conditions to their own slug', () => {
    expect(normalizeShareCondition('clear')).toBe('clear');
    expect(normalizeShareCondition('storm')).toBe('storm');
    expect(normalizeShareCondition('rain-possible')).toBe('rain-possible');
  });

  it('folds aliases to their visual equivalent', () => {
    expect(normalizeShareCondition('partly-cloudy')).toBe('cloudy');
    expect(normalizeShareCondition('hail')).toBe('storm');
    expect(normalizeShareCondition('thunder')).toBe('storm');
    expect(normalizeShareCondition('night')).toBe('clear');
  });

  it('falls back to default for unknown / missing conditions', () => {
    expect(normalizeShareCondition(undefined)).toBe('default');
    expect(normalizeShareCondition('')).toBe('default');
    expect(normalizeShareCondition('boom')).toBe('default');
  });

  it('emits ?bg= and ?city= and lat/lon on the root URL', () => {
    const url = buildShareUrl({ lat: -33.92, lon: 18.42, lang: 'af', condition: 'clear', city: 'Cape Town' });
    expect(url.startsWith(`${SHARE_ORIGIN}/?`)).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get('bg')).toBe('clear');
    expect(params.get('lat')).toBe('-33.92');
    expect(params.get('lon')).toBe('18.42');
    expect(params.get('lang')).toBe('af');
    expect(params.get('city')).toBe('Cape Town');
  });

  it('omits lat/lon when invalid; still produces a valid URL with bg=default', () => {
    const url = buildShareUrl({ lat: 'NaN', lon: undefined, lang: 'en' });
    const params = new URL(url).searchParams;
    expect(params.get('bg')).toBe('default');
    expect(params.has('lat')).toBe(false);
    expect(params.has('lon')).toBe(false);
    expect(params.get('lang')).toBe('en');
  });

  it('omits city when blank', () => {
    const url = buildShareUrl({ lat: -33.92, lon: 18.42, lang: 'en', condition: 'rain', city: '   ' });
    const params = new URL(url).searchParams;
    expect(params.has('city')).toBe(false);
    expect(params.get('bg')).toBe('rain');
  });
});

describe('edge middleware contract', () => {
  it('is configured to run on the edge and match only the root path', () => {
    expect(middlewareConfig.runtime).toBe('edge');
    expect(middlewareConfig.matcher).toEqual(['/']);
  });

  it('exposes the same condition allowlist used by share-url.js', () => {
    for (const slug of REQUIRED_OG_SLUGS) {
      expect(__test.CONDITION_ALLOWLIST.has(slug)).toBe(true);
    }
  });

  it('normalizes a known bg to itself, unknown to null', () => {
    expect(__test.normalizeBg('storm')).toBe('storm');
    expect(__test.normalizeBg('STORM')).toBe('storm');
    expect(__test.normalizeBg('rain-possible')).toBe('rain-possible');
    expect(__test.normalizeBg('boom')).toBe(null);
    expect(__test.normalizeBg(undefined)).toBe(null);
  });

  it('builds a canonical URL that includes bg and optional city', () => {
    const u = new URL('https://www.probablyweather.co.za/?bg=clear&city=Strand');
    const canonical = __test.buildCanonicalUrl(u, 'clear', 'Strand');
    const params = new URL(canonical).searchParams;
    expect(params.get('bg')).toBe('clear');
    expect(params.get('city')).toBe('Strand');
  });

  it('swapMeta replaces only the targeted tag', () => {
    const html = '<meta property="og:image" content="OLD"/><meta name="description" content="OLD"/>';
    const out = __test.swapMeta(html, 'property', 'og:image', 'NEW');
    expect(out).toContain('property="og:image" content="NEW"');
    expect(out).toContain('name="description" content="OLD"');
  });

  it('swapMeta escapes embedded quotes and ampersands', () => {
    const html = '<meta property="og:title" content="OLD"/>';
    const out = __test.swapMeta(html, 'property', 'og:title', 'A "tricky" & risky title');
    expect(out).toContain('A &quot;tricky&quot; &amp; risky title');
  });
});

describe('middleware rewrite end-to-end (mocked fetch)', () => {
  const SAMPLE_HTML = `<!doctype html><html><head>
<meta property="og:title" content="Probably Weather"/>
<meta property="og:description" content="South African weather, in your language."/>
<meta property="og:image" content="https://probablyweather.co.za/api/og?lang=en"/>
<meta property="og:url" content="https://probablyweather.co.za"/>
<meta name="twitter:title" content="Probably Weather"/>
<meta name="twitter:description" content="South African weather, in your language."/>
<meta name="twitter:image" content="https://probablyweather.co.za/api/og?lang=en"/>
<meta name="description" content="South African weather, in your language."/>
</head><body></body></html>`;

  function mockGet(url) {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(SAMPLE_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
    return {
      request: new Request(url, { method: 'GET' }),
      restore: () => { globalThis.fetch = realFetch; },
    };
  }

  it('rewrites og:image to /og/<bg>.jpg when ?bg=storm is present', async () => {
    const { request, restore } = mockGet('https://www.probablyweather.co.za/?bg=storm&city=Strand');
    try {
      const res = await middleware(request);
      expect(res).toBeInstanceOf(Response);
      const html = await res.text();
      expect(html).toContain('property="og:image" content="https://www.probablyweather.co.za/og/storm.jpg"');
      expect(html).toContain('name="twitter:image" content="https://www.probablyweather.co.za/og/storm.jpg"');
      expect(html).toContain('Storm watch');
      expect(html).toContain('Strand —');
      expect(res.headers.get('x-pw-share-bg')).toBe('storm');
    } finally {
      restore();
    }
  });

  it('falls back to clear when ?bg= is unknown', async () => {
    const { request, restore } = mockGet('https://www.probablyweather.co.za/?bg=garbage');
    try {
      const res = await middleware(request);
      const html = await res.text();
      expect(html).toContain('/og/clear.jpg');
      expect(res.headers.get('x-pw-share-bg')).toBe('clear');
    } finally {
      restore();
    }
  });

  it('does NOT intervene when ?bg= is absent', async () => {
    const { request, restore } = mockGet('https://www.probablyweather.co.za/');
    try {
      const res = await middleware(request);
      // Undefined means upstream response passes through unchanged.
      expect(res).toBeUndefined();
    } finally {
      restore();
    }
  });
});
