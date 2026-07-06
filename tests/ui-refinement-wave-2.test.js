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
    it('leaves the semantic cold-temperature blues untouched', () => {
      const css = appCss();
      expect(css).toMatch(/\.temp-cold\s*\{\s*color:\s*#00bfff/);
      expect(css).toMatch(/\.hero-cold\s*\{\s*color:\s*#00bfff/);
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
