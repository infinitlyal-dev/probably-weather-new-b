import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = () => readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

describe('tier 1 pre-resubmission fixes', () => {
  it('coerces Nominatim search lat/lon strings to numbers before rendering', () => {
    const source = app();
    const runSearchBlock = source.match(/async function runSearch\(query\) \{(?<body>[\s\S]*?)\n  \}/)?.groups?.body || '';

    expect(runSearchBlock).toMatch(/lat:\s*Number\(r\.lat\)/);
    expect(runSearchBlock).toMatch(/lon:\s*Number\(r\.lon\)/);
  });

  it('filters non-finite Nominatim coordinates out of search results', () => {
    const source = app();
    const runSearchBlock = source.match(/async function runSearch\(query\) \{(?<body>[\s\S]*?)\n  \}/)?.groups?.body || '';

    expect(runSearchBlock).toMatch(/\.filter\(r\s*=>\s*Number\.isFinite\(r\.lat\)\s*&&\s*Number\.isFinite\(r\.lon\)\)/);
    expect(runSearchBlock).not.toMatch(/lat:\s*r\.lat/);
    expect(runSearchBlock).not.toMatch(/lon:\s*r\.lon/);
  });

  it('migrates stale localStorage favourites and recents by coercing and filtering coordinates on read', () => {
    const source = app();

    expect(source).toMatch(/function normalizeStoredPlaces\(places\)/);
    expect(source).toMatch(/lat:\s*Number\(p\.lat\)/);
    expect(source).toMatch(/lon:\s*Number\(p\.lon\)/);
    expect(source).toMatch(/const loadFavorites\s*=\s*\(\)\s*=>\s*normalizeStoredPlaces\(loadJSON\(STORAGE\.favorites,\s*\[\]\)\)/);
    expect(source).toMatch(/const loadRecents\s*=\s*\(\)\s*=>\s*normalizeStoredPlaces\(loadJSON\(STORAGE\.recents,\s*\[\]\)\)/);
  });

  it('escapes weather API conditionLabel before inserting it into day-detail summary HTML', () => {
    const source = app();

    expect(source).toMatch(/<span class="ds-condition">\$\{escapeHtml\(cond\)\}<\/span>/);
  });

  it('builds share text with localized Probably and in words for all five languages', () => {
    const source = app();
    const shareBlock = source.match(/shareBtn\.addEventListener\('click', async \(\) => \{(?<body>[\s\S]*?)\n    \}\);/)?.groups?.body || '';

    expect(source).toMatch(/probably:\s*\{\s*en:\s*"Probably",\s*af:\s*"Waarskynlik",\s*zu:\s*"Mhlawumbe",\s*xh:\s*"Mhlawumbi",\s*st:\s*"Mohlomong"\s*\}/);
    expect(source).toMatch(/shareIn:\s*\{\s*en:\s*"in",\s*af:\s*"in",\s*zu:\s*"e-",\s*xh:\s*"e-",\s*st:\s*"ho"\s*\}/);
    expect(shareBlock).toMatch(/\$\{t\('weather',\s*'probably'\)\}/);
    expect(shareBlock).toMatch(/\$\{t\('misc',\s*'shareIn'\)\}/);
    expect(shareBlock).not.toMatch(/Waarskynlik \$\{loStr\}/);
  });
});
