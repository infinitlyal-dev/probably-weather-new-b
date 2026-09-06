// Regression guard for scripts/lang-check.mjs: the documented native-review catches must stay
// caught, and a handful of native-good lines must stay clean. Skips when the corpus cache is not
// built (it is git-ignored; see scripts/lang-check/fetch-corpora.mjs).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const INDEX = path.resolve('.lang-check-cache/index/zu.json');
const have = fs.existsSync(INDEX);

// loading the zu index (69 MB JSON) takes several seconds on first use
describe.skipIf(!have)('lang-check corpus-backed checker', { timeout: 120000 }, async () => {
  const { check } = await import('../scripts/lang-check/lib/checker.mjs');

  it('catches the documented wrong-sense labels', () => {
    expect(check({ lang: 'st', en: 'gusts', text: 'lifofane' }).ok).toBe(false);          // airplanes
    expect(check({ lang: 'zu', en: 'Rain tonight', text: 'Imvula namhlanje' }).ok).toBe(false); // today
    expect(check({ lang: 'st', en: 'sunscreen', text: 'setofo' }).ok).toBe(false);        // stove
  });

  it('catches sibling-language contamination', () => {
    expect(check({ lang: 'st', en: "It's cold tonight.", text: 'Ho bata bosigo bona.' }).ok).toBe(false); // Setswana bosigo
    expect(check({ lang: 'af', en: 'It is not raining today.', text: 'Dit regen niet vandaag.' }).ok).toBe(false); // Dutch
    expect(check({ lang: 'st', en: 'Respect the thunder.', text: 'Hlonepha modumo wa seaduma.' }).ok).toBe(false); // Nguni form
  });

  it('catches a dropped Afrikaans circumflex', () => {
    const v = check({ lang: 'af', en: 'Not the end of the world.', text: 'Nie die einde van die wereld nie.' });
    expect(v.findings.some((f) => f.message.includes('wêreld'))).toBe(true);
  });

  it('leaves native-reviewed lines alone', () => {
    expect(check({ lang: 'zu', en: "Rain's here.", text: 'Imvula isifikile.' }).ok).toBe(true);
    expect(check({ lang: 'xh', en: "Rain's here.", text: 'Imvula ikhona.' }).ok).toBe(true);
    expect(check({ lang: 'st', en: 'gusts', text: 'meea e fokang ka sefutho' }).ok).toBe(true);
    expect(check({ lang: 'af', en: 'The dog is under the bed. Smart move, honestly.', text: 'Die hond is onder die bed. Slim skuif, eerlikwaar.' }).ok).toBe(true);
  });

  it('cites corpus evidence and never proposes auto-apply', () => {
    const v = check({ lang: 'st', en: "It's cold tonight.", text: 'Ho bata bosigo bona.' });
    const f = v.findings.find((x) => x.check === 'contamination');
    expect(f.evidence.sibling).toBe('tn');
    expect(f.evidence.example?.text).toBeTruthy();
    expect(['pass', 'triage', 'triage-high']).toContain(v.action);
  });
});
