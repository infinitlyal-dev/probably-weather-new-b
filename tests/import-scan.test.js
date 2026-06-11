// G5 — the build's client-import guard must catch EVERY import form of the
// now-server-only weather-copy.js, including the bare side-effect import the
// old regex missed.

import { describe, expect, it } from 'vitest';

import { importsModule } from '../scripts/import-scan.mjs';

const hits = (src) => importsModule(src, 'weather-copy.js');

describe('importsModule — catches all import forms', () => {
  it('default / named / namespace static imports', () => {
    expect(hits("import WC from './weather-copy.js';")).toBe(true);
    expect(hits("import { WEATHER_COPY } from './weather-copy.js';")).toBe(true);
    expect(hits("import * as wc from './weather-copy.js';")).toBe(true);
  });

  it('bare SIDE-EFFECT import (the gap the old regex missed)', () => {
    expect(hits("import './weather-copy.js';")).toBe(true);
    expect(hits('import "./weather-copy.js"')).toBe(true);
  });

  it('re-exports', () => {
    expect(hits("export { filterWeekendPoolForDay } from './weather-copy.js';")).toBe(true);
    expect(hits("export * from './weather-copy.js';")).toBe(true);
  });

  it('dynamic import (mid-expression)', () => {
    expect(hits("const m = await import('./weather-copy.js');")).toBe(true);
    expect(hits("foo(import('../assets/weather-copy.js'))")).toBe(true);
  });

  it('minified forms (no spaces, semicolon-separated)', () => {
    expect(hits('import"./weather-copy.js";import"./x.js";')).toBe(true);
    expect(hits("a();import{WEATHER_COPY}from'./weather-copy.js';b();")).toBe(true);
  });

  it('multi-line module graph', () => {
    const src = "import { a } from './a.js';\nimport './weather-copy.js';\nexport const x = 1;";
    expect(hits(src)).toBe(true);
  });
});

describe('importsModule — no false positives', () => {
  it('a comment or string mentioning the module is NOT an import', () => {
    expect(hits("// weather-copy.js is server-only now")).toBe(false);
    expect(hits("const note = 'do not import weather-copy.js here';")).toBe(false);
  });

  it('a different module is not matched', () => {
    expect(hits("import { x } from './weekend-filter.js';")).toBe(false);
    expect(importsModule("import './copy-loader.js';", 'weather-copy.js')).toBe(false);
  });

  it('the real client copy modules do not import the monolith', () => {
    // copy-loader.js + weekend-filter.js are the client replacements; neither
    // imports the server-only monolith.
    expect(hits("import { COPY_BANK } from './copy-loader.js';\nimport { filterWeekendPoolForDay } from './weekend-filter.js';")).toBe(false);
  });
});
