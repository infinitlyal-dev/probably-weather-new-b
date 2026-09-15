import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { allScriptHashes, buildAdsCsp, buildCsp, REPORT_URI } from '../scripts/generate-csp.mjs';

// ADS-READINESS DRAFT (branch ads-readiness, do not merge). The AdSense policy is Google's strict
// form (support.google.com/adsense/answer/16283098) built on the same inline-script hashes as the
// enforced policy, and it is not what vercel.json ships. This branch also never deploys.

const directives = (csp) => Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

describe('ads-readiness CSP (draft)', () => {
  const hashes = allScriptHashes();
  const ads = directives(buildAdsCsp(hashes));

  it("script-src is Google's strict form on our own hashes", () => {
    expect(ads['script-src']).toEqual(expect.arrayContaining(["'strict-dynamic'", "'unsafe-eval'", "'unsafe-inline'", 'https:', 'http:']));
    for (const h of hashes) expect(ads['script-src']).toContain(`'${h}'`);
    expect(ads['script-src']).not.toContain("'self'"); // ignored under 'strict-dynamic' anyway
  });

  it('keeps object-src none, frame-ancestors none and the report sink; base-uri none', () => {
    expect(ads['object-src']).toEqual(["'none'"]);
    expect(ads['frame-ancestors']).toEqual(["'none'"]);
    expect(ads['base-uri']).toEqual(["'none'"]);
    expect(ads['report-uri']).toEqual([REPORT_URI]);
  });

  it('lets ad frames, creatives and beacons load', () => {
    expect(ads['frame-src']).toEqual(['https:']);
    expect(ads['img-src']).toContain('https:');
    expect(ads['connect-src']).toContain('https:');
  });

  it('is not what vercel.json ships, and this branch never deploys', () => {
    const header = vercel.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy');
    expect(header.value).toBe(buildCsp(hashes));
    expect(header.value).not.toContain('strict-dynamic');
    expect(vercel.git?.deploymentEnabled?.['ads-readiness']).toBe(false);
  });
});

describe('ads-readiness Home slot (draft)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  it('ships hidden, after the home layout, with no ad script on the page', () => {
    expect(html).toMatch(/<aside id="homeAdSlot" class="home-ad-slot" aria-label="Advertisement" hidden>/);
    const layoutEnd = html.indexOf('<section id="hourly-screen"');
    const slot = html.indexOf('id="homeAdSlot"');
    const heroCard = html.indexOf('id="heroCard"');
    expect(slot).toBeGreaterThan(heroCard);
    expect(slot).toBeLessThan(layoutEnd);
    expect(html).not.toMatch(/adsbygoogle|googlesyndication|pagead2/);
  });
});
