import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { allScriptHashes, buildAdsCsp, buildCsp, REPORT_URI } from '../scripts/generate-csp.mjs';
import { ADS_CONFIG, slotEnabled } from '../assets/ads-config.js';

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

// Al's ruling 2026-09-15: no Home slot; Hourly and Weekly slots, phones and tablets only, below
// the fold, never over content or the nav; Search only behind a flag that is off; a placeholder
// card in five languages until a network is live.
describe('ads-readiness slots (draft)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  const section = (id) => { const start = html.indexOf(`<section id="${id}"`); return html.slice(start, html.indexOf('</section>', start)); };

  it('has no Home slot anywhere', () => {
    expect(html).not.toMatch(/homeAdSlot|home-ad-slot/);
    expect(section('hourly-screen')).toContain('data-ad-slot="hourly"');
    const home = html.slice(html.indexOf('<div class="home-layout">'), html.indexOf('<section id="hourly-screen"'));
    expect(home).not.toContain('data-ad-slot');
  });

  it('puts one slot at the end of Hourly and of Weekly, after the content, each hidden until the app enables it', () => {
    for (const [id, name] of [['hourly-screen', 'hourly'], ['week-screen', 'weekly']]) {
      const s = section(id);
      const body = s.indexOf('class="screen-panel-body"');
      const slot = s.indexOf(`data-ad-slot="${name}"`);
      expect(slot, id).toBeGreaterThan(body);
      expect(s).toMatch(new RegExp(`<aside class="ad-slot" data-ad-slot="${name}" aria-label="Advertisement" hidden>`));
    }
    expect(html.match(/data-ad-slot=/g)).toHaveLength(3);
  });

  it('keeps Search behind a flag that is off, and no network is live', () => {
    expect(section('search-screen')).toContain('data-ad-slot="search"');
    expect(ADS_CONFIG.network).toBeNull();
    expect(slotEnabled('hourly')).toBe(true);
    expect(slotEnabled('weekly')).toBe(true);
    expect(slotEnabled('search')).toBe(false);
    expect(slotEnabled('home')).toBe(false);
  });

  it('slots are phones and tablets only, in normal flow (never fixed), below a one-screen body', () => {
    const block = css.slice(css.indexOf('ADS-READINESS DRAFT: the ad slots'));
    expect(block).toMatch(/\.ad-slot \{ display: none; \}/);
    expect(block).toMatch(/@media \(max-width: 1023px\)/);
    expect(block).toMatch(/> \.screen-panel-body \{ min-height: 100dvh; \}/);
    expect(block).not.toMatch(/position:\s*(fixed|sticky|absolute)/);
  });

  it('the placeholder card exists in all five languages and there is still no ad script', () => {
    for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
      expect(app).toMatch(new RegExp(`placeholder: \\{[\\s\\S]*?${lang}: "[^"]+"`));
    }
    expect(html).not.toMatch(/adsbygoogle|googlesyndication|pagead2/);
  });
});
