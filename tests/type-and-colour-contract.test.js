import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const css = read('assets/app.css');

describe('type cascade and ruled colour semantics', () => {
  it('makes every button and form control inherit the app font family', () => {
    expect(css).toMatch(/button,\s*\ninput,\s*\nselect,\s*\ntextarea\s*{[^}]*font-family:\s*inherit/);
  });

  it('reserves the amber token for condition labels on every responsive surface', () => {
    expect(css).toMatch(/amber is semantic, not general brand chrome[\s\S]*--condition-amber:\s*#f5a623/);
    expect(css.match(/color:\s*var\(--condition-amber\)/g)).toHaveLength(3);
    expect(css.match(/#f5a623/gi)).toHaveLength(1);
    expect(css).not.toMatch(/rgba?\(\s*245\s*,\s*166\s*,\s*35/i);
    expect(read('api/og.js')).toMatch(/color:\s*'#f5a623',[\s\S]*model\.headline/);
  });

  it('routes former non-condition amber accents to brand gold', () => {
    expect(css).toMatch(/--brand-gold:\s*#ffd700/);
    expect(css).toMatch(/#scrim\s*{[^}]*background:\s*var\(--brand-gold\)/s);
    expect(css).toMatch(/\.install-footer-link\s*{[^}]*color:\s*var\(--brand-gold\)/s);
    expect(css).toMatch(/\.use-location-btn\s*{[^}]*background:\s*var\(--brand-gold\)/s);
    expect(read('index.html')).not.toMatch(/#f5a623/i);
    expect(read('privacy.html')).not.toMatch(/#f5a623/i);
    expect(read('api/og.js')).toContain("linear-gradient(135deg, #ffdd44, #ffaa00)");
  });
});
