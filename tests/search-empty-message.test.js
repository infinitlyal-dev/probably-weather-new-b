// A place search that finds nothing, or that the geocoder does not answer, says so
// (launch eval, 2026-09-24). Both used to leave the list silently empty: a nonsense
// search and a LocationIQ 429 looked exactly like a search still running.
// Proven in the browser by review/eval/scripts/failure-paths.mjs (search-nonsense,
// search-rate-limited); this guards the wiring.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const runSearch = app.match(/async function runSearch\(query\) \{(?<body>[\s\S]*?)\n  \}/)?.groups?.body || '';
const render = app.match(/function renderSearchResults\(results, emptyKey\) \{(?<body>[\s\S]*?)\n  \}/)?.groups?.body || '';

describe('place search: nothing found / not answering', () => {
  it('both messages exist in all five languages', () => {
    for (const key of ['noResults', 'searchFailed']) {
      const m = app.match(new RegExp(`${key}: \\{ en: "([^"]+)", af: "([^"]+)", zu: "([^"]+)", xh: "([^"]+)", st: "([^"]+)" \\}`));
      expect(m, key).toBeTruthy();
      for (const s of m.slice(2)) expect(s, key).not.toBe(m[1]);
    }
  });

  it('a finished search with no results shows noResults; a refused or failed one shows searchFailed', () => {
    expect(runSearch).toMatch(/if \(!resp\.ok\) \{ searchFailed\(\); return; \}/);
    expect(runSearch).toMatch(/if \(data\?\.ok === false\) \{ searchFailed\(\); return; \}/);
    expect(runSearch).toMatch(/renderSearchResults\(searchResults, 'noResults'\)/);
    expect(runSearch).toMatch(/if \(e\.name === 'AbortError'\) return;[\s\S]*searchFailed\(\)/);
    // the failure clears the old results, so a language switch cannot bring them back
    expect(runSearch).toMatch(/const searchFailed = \(\) => \{ searchResults = \[\]; renderSearchResults\(\[\], 'searchFailed'\); \}/);
  });

  it('a cleared or too-short query empties the list and cancels any search still in flight', () => {
    // bumping the sequence makes a late answer fail the thisSeq check; the abort stops the fetch
    expect(runSearch).toMatch(/if \(!query \|\| query\.length < 2\) \{ \+\+searchSeq; activeSearchController\?\.abort\(\); renderSearchResults\(\[\]\); return; \}/);
    expect(runSearch).toMatch(/if \(thisSeq !== searchSeq\) return;/);
    expect(render).toMatch(/emptyKey \? `<li class="list-empty" role="status"/);
    expect(render).toMatch(/: '';/);
  });
});
