import { describe, expect, it } from 'vitest';
import { weatherIconSvg, ICON_NAMES, ICON_CONDITION } from '../assets/weather-icons.js';
import { __WEATHER_ICON_MAP } from '../assets/weather-emoji.js';

// ---------------------------------------------------------------------------
// M5. These exist because the icon builder shipped with a bug that 21,674
// passing tests could not see: NOTHING called weatherIconSvg and looked at what
// came back. The `filled` option emitted a SECOND fill attribute after the
// template's own fill="none", every HTML parser kept the first, and the saved
// star rendered identically to the unsaved one.
//
// So the first thing asserted here is the thing that broke: one attribute, one
// value, no duplicates.
// ---------------------------------------------------------------------------

/** Attribute names and values from the opening <svg …> tag, in order. */
function svgAttrs(markup) {
  const open = markup.slice(0, markup.indexOf('>'));
  const pairs = [...open.matchAll(/([a-zA-Z-]+(?::[a-zA-Z-]+)?)="([^"]*)"/g)];
  return pairs.map(([, name, value]) => ({ name, value }));
}

describe('weatherIconSvg — attribute integrity', () => {
  it('never emits the same attribute twice, for any icon in either fill state', () => {
    for (const name of ICON_NAMES) {
      for (const filled of [false, true]) {
        const attrs = svgAttrs(weatherIconSvg(name, { filled }));
        const seen = attrs.map((a) => a.name);
        const dupes = seen.filter((n, i) => seen.indexOf(n) !== i);
        expect(dupes, `${name} (filled=${filled}) emitted duplicate attributes: ${dupes.join(',')}`).toEqual([]);
      }
    }
  });

  it('filled:true actually fills — the regression that made the saved star invisible', () => {
    const fills = svgAttrs(weatherIconSvg('star', { filled: true })).filter((a) => a.name === 'fill');
    expect(fills).toHaveLength(1);
    expect(fills[0].value).toBe('currentColor');
  });

  it('filled:false (and omitted) leaves the shape an outline', () => {
    for (const markup of [weatherIconSvg('star', { filled: false }), weatherIconSvg('star')]) {
      const fills = svgAttrs(markup).filter((a) => a.name === 'fill');
      expect(fills).toHaveLength(1);
      expect(fills[0].value).toBe('none');
    }
  });

  it('the two star states are actually different markup', () => {
    expect(weatherIconSvg('star', { filled: true })).not.toBe(weatherIconSvg('star', { filled: false }));
  });
});

describe('weatherIconSvg — the family contract', () => {
  it('every icon carries the one contract: 24-unit box, currentColor, weight 2, round caps', () => {
    for (const name of ICON_NAMES) {
      const attrs = Object.fromEntries(svgAttrs(weatherIconSvg(name)).map((a) => [a.name, a.value]));
      expect(attrs.viewBox, name).toBe('0 0 24 24');
      expect(attrs.stroke, name).toBe('currentColor');
      expect(attrs['stroke-width'], name).toBe('2');
      expect(attrs['stroke-linecap'], name).toBe('round');
      expect(attrs['stroke-linejoin'], name).toBe('round');
      expect(attrs['data-icon'], name).toBe(name);
      expect(attrs.class, name).toContain('pw-icon');
    }
  });

  it('no icon hard-codes a colour — the colour system has to be able to drive them', () => {
    for (const name of ICON_NAMES) {
      const markup = weatherIconSvg(name, { filled: true });
      expect(markup, name).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(markup, name).not.toMatch(/\b(?:rgb|hsl)a?\(/);
    }
  });

  it('every icon draws something', () => {
    for (const name of ICON_NAMES) {
      const body = weatherIconSvg(name).replace(/^[^>]*>/, '').replace('</svg>', '');
      expect(body.length, name).toBeGreaterThan(20);
      expect(body, name).toMatch(/<(?:path|circle)\b/);
    }
  });

  it('an unknown icon name returns nothing rather than a broken tag', () => {
    expect(weatherIconSvg('not-an-icon')).toBe('');
    expect(weatherIconSvg('')).toBe('');
    expect(weatherIconSvg(undefined)).toBe('');
  });
});

describe('weatherIconSvg — accessible name', () => {
  it('no label means decoration: aria-hidden, never an empty aria-label', () => {
    const markup = weatherIconSvg('sun');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('aria-label');
    expect(markup).not.toContain('role="img"');
  });

  it('a label makes it an image with that name', () => {
    const markup = weatherIconSvg('sun', { label: 'Aangenaam' });
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Aangenaam"');
    expect(markup).not.toContain('aria-hidden');
  });

  it('a blank or whitespace label falls back to decoration, not to an empty name', () => {
    for (const label of ['', '   ', null, 42]) {
      expect(weatherIconSvg('sun', { label })).toContain('aria-hidden="true"');
    }
  });

  it('the label is escaped — it lands inside an attribute', () => {
    const markup = weatherIconSvg('sun', { label: 'a "quoted" <tag> & more' });
    expect(markup).toContain('aria-label="a &quot;quoted&quot; &lt;tag&gt; &amp; more"');
    // The attribute must not have been terminated early.
    expect(svgAttrs(markup).filter((a) => a.name === 'aria-label')).toHaveLength(1);
  });
});

describe('weatherIconSvg — option hygiene', () => {
  it('size defaults to 22 and rejects non-finite input', () => {
    for (const size of [undefined, NaN, Infinity, 'big', null]) {
      const attrs = Object.fromEntries(svgAttrs(weatherIconSvg('sun', { size })).map((a) => [a.name, a.value]));
      expect(attrs.width).toBe('22');
      expect(attrs.height).toBe('22');
    }
    const attrs = Object.fromEntries(svgAttrs(weatherIconSvg('sun', { size: 16 })).map((a) => [a.name, a.value]));
    expect(attrs.width).toBe('16');
  });

  it('a hostile class name cannot break out of the attribute', () => {
    const markup = weatherIconSvg('sun', { cls: 'x" onload="alert(1)' });
    // The scrub keeps [\w- ] only, so the quotes, the `=` and the parens are
    // gone and what remains is an inert class token. Asserting the absence of
    // the substring "onload" would be asserting the wrong thing — what matters
    // is that no SECOND attribute was created and the tag never reopened.
    const attrs = svgAttrs(markup);
    expect(attrs.filter((a) => a.name === 'class')).toHaveLength(1);
    expect(attrs.map((a) => a.name)).not.toContain('onload');
    expect(attrs.find((a) => a.name === 'class').value).toBe('pw-icon x onloadalert1');
  });
});

describe('ICON_CONDITION — the accessible name comes from translated copy', () => {
  it('every weather icon the condition map can produce has a condition key', () => {
    const produced = new Set(Object.values(__WEATHER_ICON_MAP).flatMap((pair) => [pair.day, pair.night]));
    for (const name of produced) {
      expect(ICON_CONDITION[name], `${name} has no condition key, so it can never be labelled in the user's language`).toBeTruthy();
    }
  });

  it('every condition key it points at is a real drawing', () => {
    for (const [icon] of Object.entries(ICON_CONDITION)) {
      expect(ICON_NAMES, `${icon} is mapped but not drawn`).toContain(icon);
    }
  });
});
