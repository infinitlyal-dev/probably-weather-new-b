import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const css = read('assets/app.css');

describe('type cascade and ruled colour semantics', () => {
  it('makes every button and form control inherit the app font family', () => {
    expect(css).toMatch(/button,\s*\ninput,\s*\nselect,\s*\ntextarea\s*{[^}]*font-family:\s*inherit/);
  });

  it('reserves the amber token for genuine warnings, no longer for condition labels', () => {
    // RETIRED 2026-08-07 (Al). The 2026-07-14 ruling pinned #description to
    // --condition-amber on all three responsive surfaces. That is withdrawn: the
    // condition line is primary info and reads WHITE, and orange/red now signals
    // a genuine weather warning only. The token survives for that future use and
    // for the low-confidence dot; it must paint no condition label.
    expect(css).toMatch(/--condition-amber:\s*#f5a623/);
    expect(css.match(/color:\s*var\(--condition-amber\)/g)).toBeNull();
    expect(css).not.toMatch(/#description\s*{[^}]*var\(--condition-amber\)/s);
    expect(css.match(/#f5a623/gi)).toHaveLength(1);
    expect(css).not.toMatch(/rgba?\(\s*245\s*,\s*166\s*,\s*35/i);
    // api/og.js keeps amber — RULED 2026-08-08 (Al). The amber retirement is
    // IN-APP ONLY; share cards have to pop in a social feed, so the OG card's
    // condition treatment stays warm on purpose. This is settled, not pending.
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
