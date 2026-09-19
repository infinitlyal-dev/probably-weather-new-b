// Every live non-English line, paired with the English line it is keyed to, split into
// blind batches for the back-translation check (Job 4, 2026-09-19).
//
// Live means what the app can put on screen or on a share card today:
//   af bespoke  assets/hero-lines-af.js rows whose English line is wired in hero-lines.js
//   bank        WEATHER_COPY witty, witty_low_confidence, headlines, heroLabels — af zu xh st
// A pair is (lang, text, english). The same pair reached two ways (an Afrikaans bank line
// reused on a photograph) is checked once and carries both references.
//
// Writes output/translation-check/pairs.json and, per batch, two files:
//   <lang>-<n>.in.json   [{ k, text }]        what the back-translator sees first (no English)
//   <lang>-<n>.en.json   [{ k, en }]          opened only after the back-translation is written
//
//   node scripts/translation-check/build-pairs.mjs [--batch 400]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_LINES } from '../../assets/hero-lines.js';
import { HERO_LINES_AF } from '../../assets/hero-lines-af.js';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const out = path.join(root, 'output', 'translation-check');
mkdirSync(out, { recursive: true });
const BATCH = Number(process.argv[process.argv.indexOf('--batch') + 1]) || 400;

const slotsOf = new Map();
for (const [k, lines] of Object.entries(HERO_LINES)) if (k.startsWith('bg/')) for (const l of lines) {
  if (!slotsOf.has(l)) slotsOf.set(l, []);
  slotsOf.get(l).push(k);
}
const pairs = new Map(); // lang|en|text -> pair
const add = (lang, en, text, ref) => {
  if (typeof text !== 'string' || !text.trim() || typeof en !== 'string' || !en.trim()) return;
  const key = `${lang}|${en}|${text}`;
  if (!pairs.has(key)) pairs.set(key, { lang, en, text, refs: [] });
  pairs.get(key).refs.push(ref);
};
for (const [en, slots] of slotsOf) {
  const af = HERO_LINES_AF[en];
  if (af) add('af', en, af, { kind: 'bespoke', slots });
}
for (const ns of ['witty', 'witty_low_confidence', 'headlines', 'heroLabels']) {
  for (const [bin, v] of Object.entries(WEATHER_COPY[ns])) {
    if (bin === '_meta') continue;
    for (const lang of ['af', 'zu', 'xh', 'st']) {
      if (Array.isArray(v.en)) v.en.forEach((en, i) => add(lang, en, v[lang]?.[i], { kind: 'bank', id: `${ns}:${bin}#${i}` }));
      else add(lang, v.en, v[lang], { kind: 'bank', id: `${ns}:${bin}` });
    }
  }
}
const all = [...pairs.values()];
const counts = {};
const byLang = {};
for (const p of all) { (byLang[p.lang] ||= []).push(p); counts[p.lang] = (counts[p.lang] || 0) + 1; }
const manifest = [];
for (const [lang, list] of Object.entries(byLang)) {
  list.forEach((p, i) => { p.k = `${lang}-${String(i + 1).padStart(4, '0')}`; });
  for (let b = 0; b * BATCH < list.length; b++) {
    const slice = list.slice(b * BATCH, (b + 1) * BATCH);
    const name = `${lang}-${b + 1}`;
    writeFileSync(path.join(out, `${name}.in.json`), JSON.stringify(slice.map((p) => ({ k: p.k, text: p.text })), null, 1));
    writeFileSync(path.join(out, `${name}.en.json`), JSON.stringify(slice.map((p) => ({ k: p.k, en: p.en })), null, 1));
    manifest.push({ batch: name, lang, n: slice.length, first: slice[0].k, last: slice[slice.length - 1].k });
  }
}
writeFileSync(path.join(out, 'pairs.json'), JSON.stringify({ generated: new Date().toISOString(), counts, batches: manifest, pairs: all }, null, 1));
console.log('[pairs]', JSON.stringify(counts), `total ${all.length}; ${manifest.length} batches of <= ${BATCH}`);
for (const m of manifest) console.log(`  ${m.batch}: ${m.n} (${m.first}..${m.last})`);
