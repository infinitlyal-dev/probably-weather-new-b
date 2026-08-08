import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// og.js imports the weather handler; stub it so the module loads cleanly. We
// call buildOgViewModel() directly with hand-built payloads, so the handler
// itself is never exercised here.
vi.mock('../api/weather.js', () => ({
  default: vi.fn(async (_req, res) => res.status(200).json({ ok: true })),
}));
const { buildOgViewModel } = await import('../api/og.js');

const appJs = () => readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const appCss = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const indexHtml = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// UI refinement wave 2 (2026-07-06) — four Al-ruled changes. Source-level locks
// for the DOM/CSS-only tasks (T1/T2/T3, driven inside the app.js IIFE) plus a
// behavioural test for the OG mirror (T4), which is an exported pure function.
describe('UI refinement wave 2', () => {
  describe('Task 1 — brand tagline retired to first-visit + share surfaces only', () => {
    it('gates the home tagline on STORAGE.home at boot (returning users hide it)', () => {
      const src = appJs();
      expect(src).toMatch(
        /getItem\(STORAGE\.home\)[\s\S]{0,160}querySelector\(['"]\.tagline['"]\)[\s\S]{0,40}classList\.add\(['"]hidden['"]\)/,
      );
    });
    it('keeps the tagline STRING in index.html (still shipped on a first visit)', () => {
      expect(indexHtml()).toContain('No more Ja-No-Maybe weather. Just Probably.');
    });
  });

  describe('Task 2 — hero temperature pair never breaks', () => {
    it('renders the hero as a label span + a separate range span', () => {
      const src = appJs();
      expect(src).toMatch(/const setHeroTemp\s*=/);
      expect(src).toContain("'hero-probably'");
      expect(src).toContain("'hero-range'");
    });
    it('makes the range an unbreakable (nowrap) unit in CSS', () => {
      expect(appCss()).toMatch(/\.hero-range\s*\{[^}]*white-space:\s*nowrap/s);
    });
  });

  describe('Task 3 — panel titles in the brand palette', () => {
    it('gives .screen-title one warm brand token (hero gold)', () => {
      expect(appCss()).toMatch(/\.screen-title\s*\{[^}]*color:\s*#ffd700/s);
    });
    it('retires blue from the heading role entirely', () => {
      const css = appCss();
      // No condition-scoped screen-title colour rules survive...
      expect(css).not.toMatch(/weather-\w+\s+\.screen-title\s*\{\s*color:/);
      // ...and #64b5f6 (only ever the rain title) is gone from the sheet.
      expect(css).not.toContain('#64b5f6');
    });
    it('keeps a semantic cold-temperature blue, now as the one cold token', () => {
      // The intent of this guard is unchanged — blue left the HEADING role but
      // must survive where it means "cold". M5 moved it from two literals onto
      // one token, and that token must not be the rain blue: a cold reading and
      // a wet one have to stay tellable apart.
      const css = appCss();
      expect(css).toMatch(/\.temp-cold,\s*\.temp-freezing\s*\{\s*color:\s*var\(--cold-blue\)/);
      expect(css).toMatch(/--cold-blue:\s*#[0-9a-f]{6}/i);
      const cold = /--cold-blue:\s*(#[0-9a-f]{6})/i.exec(css)[1].toLowerCase();
      const rain = /--rain-blue:\s*(#[0-9a-f]{6})/i.exec(css)[1].toLowerCase();
      expect(cold).not.toBe(rain);
    });
    it('retires the per-condition hero glow colours (M5 colour discipline)', () => {
      // .hero-cold used to be #00bfff and .hero-storm #9932cc, live in the
      // 769-1023px band. Purple and steel blue are in no rule of the colour
      // system, so the whole set is white now.
      const css = appCss();
      for (const literal of ['#9932cc', '#4682b4', '#a9a9a9', '#c0c0c0', '#a0a0a0']) {
        expect(css, `${literal} is back in the sheet`).not.toContain(literal);
      }
      expect(css).toMatch(/\.hero-storm,[\s\S]{0,200}\.hero-fog\s*\{\s*color:\s*#fff/);
    });
  });

  describe('Task 4 — dead stats dropped, not dashed', () => {
    it('home byline builds rows from present stats only (no "--" seed)', () => {
      const src = appJs();
      expect(src).toMatch(/const row1 = \[[\s\S]*?\]\.filter\(Boolean\)/);
      expect(src).toMatch(/const row2 = \[[\s\S]*?\]\.filter\(Boolean\)/);
    });

    it('OG card drops a stat with no value instead of rendering "--"', () => {
      // UV absent (no now.uv, no daily uv) — wind + rain present.
      const payload = {
        ok: true,
        location: { name: 'Strand' },
        now: { conditionKey: 'clear', tempC: 20, windKph: 18, rainChance: 8 },
        daily: [{ conditionKey: 'clear', highC: 24, lowC: 14, rainChance: 8 }],
      };
      const model = buildOgViewModel(payload, { lang: 'en' });
      expect(model.stats).toContain('Wind 18 km/h');
      expect(model.stats).toContain('Rain 8%');
      expect(model.stats).not.toContain('UV');
      expect(model.stats).not.toContain('--');
    });

    it('OG card renders an empty stats line when every stat is absent', () => {
      const payload = {
        ok: true,
        location: { name: 'Strand' },
        now: { conditionKey: 'clear', tempC: 20 },
        daily: [{ conditionKey: 'clear', highC: 24, lowC: 14 }],
      };
      const model = buildOgViewModel(payload, { lang: 'en' });
      expect(model.stats).toBe('');
    });

    it('OG card still shows all three stats when present', () => {
      const payload = {
        ok: true,
        location: { name: 'Strand' },
        now: { conditionKey: 'clear', tempC: 28, windKph: 18, rainChance: 8, uv: 7 },
        daily: [{ conditionKey: 'clear', highC: 34, lowC: 22, rainChance: 8, uv: 7 }],
      };
      const model = buildOgViewModel(payload, { lang: 'en' });
      expect(model.stats).toBe('Wind 18 km/h • Rain 8% • UV 7');
    });
  });
});
