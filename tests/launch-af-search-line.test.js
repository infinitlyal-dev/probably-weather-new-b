// Launch run (2026-09-25): Al's Afrikaans "no places found" line from the eval page (search.noResults,
// marked FIX), wired as he wrote it with only the dropped apostrophe restored.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

describe('search.noResults (af)', () => {
  it('reads as Al wrote it', () => {
    const line = js.split('\n').find((l) => l.trim().startsWith('noResults: { en: "No places found.'));
    expect(line).toContain(`af: "Geen plek gevind nie. Kyk na die spelling of probeer 'n nabye dorp."`);
  });
});
