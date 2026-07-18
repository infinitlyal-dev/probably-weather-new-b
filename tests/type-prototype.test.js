import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const uiCss = readFileSync(new URL('../assets/type-prototype.css', import.meta.url), 'utf8');
const captionCss = readFileSync(new URL('../assets/type-prototype-caption.css', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../assets/fonts/type-prototype-fonts.json', import.meta.url), 'utf8'));

describe('adopted default typography (Onest + desktop Caveat)', () => {
  it('loads Onest by default — no ?type=proto flag machinery', () => {
    // The flag is gone: Onest ships as a static stylesheet for every visitor.
    expect(index).toMatch(/<link[^>]+rel="stylesheet"[^>]+href="assets\/type-prototype\.css"/);
    expect(index).not.toContain("get('type')");
    expect(index).not.toContain('data-type-prototype');
    expect(uiCss).not.toContain('data-type-prototype');
    expect(uiCss).toContain(":root {");
    expect(uiCss).toContain("--font-system: 'Onest Prototype'");
  });

  it('keeps the Caveat caption payload behind the desktop breakpoint (JS media-gated)', () => {
    expect(index).toContain("matchMedia('(min-width: 1024px)')");
    expect(index).toContain("postcardMedia.addEventListener('change', onChange)");
    expect(index).toContain("'assets/type-prototype-caption.css'");
    // Onest stylesheet must NOT carry Caveat (mobile never downloads Caveat bytes).
    expect(uiCss).not.toContain('Caveat Prototype');
    expect(captionCss).toContain("font-family: 'Caveat Prototype'");
    expect(captionCss).toContain('@media (min-width: 1024px)');
    // 2-id selector so the caption beats app.css's #headline caption rule.
    expect(captionCss).toContain('#home-screen #headline');
  });

  it('embeds the Onest subsets within the ruled mobile budget', () => {
    expect(manifest.subsets).toEqual(['latin', 'latin-ext']);
    expect(manifest.fonts.onest.totalBytes).toBe(48228);
    expect(manifest.fonts.onest.totalBytes).toBeLessThanOrEqual(manifest.fonts.onest.budgetBytes);
    expect(uiCss.match(/data:font\/woff2;base64,/g)).toHaveLength(2);
    expect(uiCss).not.toMatch(/url\(['"]?assets\/fonts\//);
  });

  it('pins the ruled type ladder with 200%-zoom-safe min() caps', () => {
    // Ruled sizes preserved at 100%; min(...) px caps stop the rem doubling past
    // the container/viewport at 200% text zoom (mobile hero clip + 148px 1440
    // range overflow, both fixed and measured to 0).
    expect(uiCss).toContain('font-size: min(clamp(2.75rem, 12vw, 3rem), 68px);');
    expect(uiCss).toContain('font-size: min(clamp(3rem, 13vw, 3.25rem), 72px);');
    expect(uiCss).toContain('font-size: min(4.25rem, 100px);');
    expect(uiCss).toContain('font-size: min(6.125rem, 115px);');
    expect(uiCss).toContain('letter-spacing: -0.045em;');
    // ungated ruled tokens for the byline + language button + action pills
    expect(uiCss).toMatch(/(^|\n)\s*\.sidebar \.weather-byline\s*{/);
    expect(uiCss).toMatch(/(^|\n)\s*\.language-btn\s*{/);
    expect(uiCss).toMatch(/\.share-btn,[\s\S]*\.nav-hourly-pill,[\s\S]*\.my-location-btn\s*{[^}]*font-size:\s*0\.9375rem;[^}]*font-weight:\s*650;/);
    expect(captionCss).toContain('font-size: clamp(1.25rem, 1.45vw, 1.375rem);');
  });

  it('records source, hashes, budgets, and OFL files for both self-hosted faces', () => {
    for (const font of Object.values(manifest.fonts)) {
      expect(font.license).toBe('SIL Open Font License 1.1');
      expect(font.source).toMatch(/^https:\/\/github\.com\//);
      expect(font.totalBytes).toBeLessThanOrEqual(font.budgetBytes);
      expect(font.faces).toHaveLength(2);
      for (const face of font.faces) expect(face.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(readFileSync(new URL(`../${font.licenseFile}`, import.meta.url), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }
  });
});
