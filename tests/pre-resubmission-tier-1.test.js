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

  it('keeps the localized Probably and in vocabularies available for downstream copy', () => {
    const source = app();

    expect(source).toMatch(/probably:\s*\{\s*en:\s*"Probably",\s*af:\s*"Waarskynlik",\s*zu:\s*"Mhlawumbe",\s*xh:\s*"Mhlawumbi",\s*st:\s*"Mohlomong"\s*\}/);
    expect(source).toMatch(/shareIn:\s*\{\s*en:\s*"in",\s*af:\s*"in",\s*zu:\s*"e-",\s*xh:\s*"e-",\s*st:\s*"ho"\s*\}/);
  });

  it('builds the branded share message from the localized shareMessage template in all five languages', () => {
    const source = app();
    const shareBlock = source.match(/shareBtn\.addEventListener\('click', async \(\) => \{(?<body>[\s\S]*?)\n    \}\);/)?.groups?.body || '';

    // shareMessage and shareYourArea translation banks exist for all 5 langs.
    expect(source).toMatch(/shareMessage:\s*\{\s*en:\s*"Check the weather in \{city\}[\s\S]*?af:\s*"Check die weer in \{city\}[\s\S]*?zu:\s*"[\s\S]*?xh:\s*"[\s\S]*?st:\s*"/);
    expect(source).toMatch(/shareYourArea:\s*\{\s*en:\s*"your area",\s*af:\s*"jou omgewing"/);

    // Share handler composes a SHORT caption from the template (city only — no
    // {url} in the text; M-3) and passes the branded /share link via the
    // dedicated navigator.share `url` field so WhatsApp shows a clean preview.
    expect(shareBlock).toMatch(/t\('misc',\s*'shareMessage'\)/);
    expect(shareBlock).toMatch(/\.replace\('\{city\}'/);
    expect(shareBlock).not.toMatch(/\.replace\('\{url\}'/);
    expect(shareBlock).toMatch(/buildShareLink\(\{[\s\S]*?condition:\s*displayCond/);
    expect(shareBlock).toMatch(/navigator\.share\(\{[\s\S]*?url:\s*shareLink/);
  });
});
