import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const uiCss = readFileSync(new URL('../assets/type-prototype.css', import.meta.url), 'utf8');
const captionCss = readFileSync(new URL('../assets/type-prototype-caption.css', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../assets/fonts/type-prototype-fonts.json', import.meta.url), 'utf8'));

describe('query-gated typography prototype', () => {
  it('requests no prototype stylesheet unless type=proto is explicit', () => {
    expect(index).toContain("get('type') !== 'proto'");
    expect(index).toContain("loadPrototypeStyle('pwTypePrototype', 'assets/type-prototype.css')");
    expect(index).not.toMatch(/<link[^>]+type-prototype\.css/);
  });

  it('keeps the Caveat caption payload behind the desktop breakpoint', () => {
    expect(index).toContain("matchMedia('(min-width: 1024px)')");
    expect(index).toContain("postcardMedia.addEventListener('change', loadPostcardCaption)");
    expect(index).toContain("loadPrototypeStyle('pwTypePrototypeCaption', 'assets/type-prototype-caption.css')");
    expect(uiCss).not.toContain('Caveat Prototype');
    expect(captionCss).toContain("font-family: 'Caveat Prototype'");
    expect(captionCss).toContain('@media (min-width: 1024px)');
  });

  it('embeds the five-language Onest subsets within the ruled mobile budget', () => {
    expect(manifest.subsets).toEqual(['latin', 'latin-ext']);
    expect(manifest.fonts.onest.totalBytes).toBe(48228);
    expect(manifest.fonts.onest.totalBytes).toBeLessThanOrEqual(manifest.fonts.onest.budgetBytes);
    expect(uiCss.match(/data:font\/woff2;base64,/g)).toHaveLength(2);
    expect(uiCss).not.toMatch(/url\(['"]?assets\/fonts\//);
  });

  it('pins the proposed mobile and desktop type ladders in rem-based tokens', () => {
    expect(uiCss).toContain('font-size: clamp(2.75rem, 12vw, 3rem);');
    expect(uiCss).toContain('font-size: clamp(3rem, 13vw, 3.25rem);');
    expect(uiCss).toContain('font-size: 4.25rem;');
    expect(uiCss).toContain('font-size: 6.125rem;');
    expect(uiCss).toContain('letter-spacing: -0.045em;');
    expect(uiCss).toContain('html[data-type-prototype="true"] .sidebar .weather-byline');
    expect(uiCss).toContain('html[data-type-prototype="true"] .language-btn');
    expect(uiCss).toMatch(/\.share-btn,[\s\S]*\.nav-hourly-pill,[\s\S]*\.my-location-btn\s*{[^}]*font-size:\s*0\.9375rem;[^}]*font-weight:\s*650;/);
    expect(uiCss).not.toMatch(/\.stat-value|\.lang-select|\.home-action-btn/);
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
