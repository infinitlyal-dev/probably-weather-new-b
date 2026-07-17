// Seed corpus-confirmed.jsonl + debt-ledger.jsonl for each of zu/xh/st from the LIVE
// copy banks (assets/weather-copy.js). Archaeology, not generation — every non-empty
// native string currently shipping is corpus-confirmed; every "" slot is debt.
//
// Key format: "<group>.<bin>[<idx>]" for arrays, "<group>.<bin>" for scalars.
// Each row carries EN + AF (the two languages that ARE filled) as the draft source.
//
// Usage: node lang-packs/tools/seed-corpus.mjs

import { writeFileSync } from 'node:fs';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const LANGS = ['zu', 'xh', 'st'];
const isStr = (s) => typeof s === 'string';
const nonEmpty = (s) => isStr(s) && s.trim() !== '';

// Walk the bank tree; yield {key, en, af, natives:{zu,xh,st}} rows.
function* rows(node, path) {
  if (!node || typeof node !== 'object') return;
  const hasEn = 'en' in node;
  if (hasEn && Array.isArray(node.en)) {
    for (let i = 0; i < node.en.length; i++) {
      yield {
        key: `${path}[${i}]`,
        en: node.en[i],
        af: Array.isArray(node.af) ? node.af[i] : undefined,
        natives: Object.fromEntries(LANGS.map((l) => [l, Array.isArray(node[l]) ? node[l][i] : undefined])),
      };
    }
    return;
  }
  if (hasEn && isStr(node.en)) {
    yield {
      key: path,
      en: node.en,
      af: isStr(node.af) ? node.af : undefined,
      natives: Object.fromEntries(LANGS.map((l) => [l, isStr(node[l]) ? node[l] : undefined])),
    };
    return;
  }
  for (const [k, v] of Object.entries(node)) yield* rows(v, path ? `${path}.${k}` : k);
}

const all = [];
for (const [group, bank] of Object.entries(WEATHER_COPY)) all.push(...rows(bank, group));

for (const lang of LANGS) {
  const corpus = [];
  const debt = [];
  for (const r of all) {
    const native = r.natives[lang];
    if (nonEmpty(native)) {
      corpus.push({ key: r.key, en: r.en, af: r.af ?? null, [lang]: native, status: 'confirmed-live' });
    } else if (native === '' || native === undefined) {
      // undefined = bin has no array for this lang (shouldn't happen post-alignment); '' = debt slot
      debt.push({ key: r.key, en: r.en, af: r.af ?? null, [lang]: '', status: 'debt-empty', priority: null });
    }
  }
  const cf = `lang-packs/${lang}/corpus-confirmed.jsonl`;
  const dl = `lang-packs/${lang}/debt-ledger.jsonl`;
  writeFileSync(cf, corpus.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(dl, debt.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${lang}: corpus-confirmed ${corpus.length} | debt ${debt.length}  -> ${cf}, ${dl}`);
}
console.log('total bank rows walked:', all.length);
