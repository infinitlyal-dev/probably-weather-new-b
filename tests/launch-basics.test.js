// Launch run (2026-09-25): /robots.txt, /sitemap.xml and /apple-touch-icon.png
// returned 404 in production. Crawlers and iOS ask for them at the root.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('launch basics at the site root', () => {
  it('the build ships all three', () => {
    const build = read('scripts/build.mjs');
    for (const f of ['robots.txt', 'sitemap.xml', 'apple-touch-icon.png']) expect(build).toContain(`'${f}'`);
  });

  it('robots.txt lets crawlers in and names the sitemap; the share image under /api/og stays fetchable', () => {
    const robots = read('robots.txt');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Sitemap: https:\/\/www\.probablyweather\.co\.za\/sitemap\.xml$/m);
    expect(robots).not.toMatch(/Disallow:\s*\/api/);
  });

  it('sitemap.xml lists the public pages on the canonical www host', () => {
    const xml = read('sitemap.xml');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(['https://www.probablyweather.co.za/', 'https://www.probablyweather.co.za/install', 'https://www.probablyweather.co.za/privacy']);
  });

  it('apple-touch-icon.png is 180×180 and opaque (iOS paints transparency black)', async () => {
    const meta = await sharp(new URL('../apple-touch-icon.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).metadata();
    expect([meta.width, meta.height]).toEqual([180, 180]);
    expect(meta.hasAlpha).toBe(false);
  });

  it('both pages point iOS at it', () => {
    for (const page of ['index.html', 'install.html']) {
      expect(read(page)).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>');
    }
  });
});
