// Generate per-language copy banks: assets/copy/<lang>.js
//
// assets/weather-copy.js (the reviewable single source of truth, ~120 KB)
// ships every string in all five languages. The runtime only needs ONE
// language (plus the universal en fallback every getter in app.js already
// has). This script walks the bank, keeps {en, <lang>} at each leaf, and
// emits one compact module per language.
//
// The outputs are CHECKED IN so the source tree stays runnable with zero
// build (tests, vercel dev, the python static preview). Run after any copy
// change:  node scripts/generate-copy-splits.mjs
// tests/copy-splits.test.js fails the suite if the outputs drift.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { WEATHER_COPY } from '../assets/weather-copy.js';

export const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const LANG_KEY_SET = new Set(LANGS);

/** A leaf is an object whose keys are (a subset of) language codes. */
const isLangLeaf = (value) =>
  value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length > 0
  && Object.keys(value).every((k) => LANG_KEY_SET.has(k));

/** Deep-extract {en, lang} from every language leaf; copy everything else. */
export function extractLanguage(node, lang) {
  if (isLangLeaf(node)) {
    const out = {};
    if (node.en !== undefined) out.en = node.en;
    if (lang !== 'en' && node[lang] !== undefined) out[lang] = node[lang];
    return out;
  }
  if (Array.isArray(node)) return node;
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = extractLanguage(v, lang);
    return out;
  }
  return node;
}

export function buildModuleSource(lang) {
  const bank = extractLanguage(WEATHER_COPY, lang);
  return [
    `// GENERATED FILE — do not edit. Source: assets/weather-copy.js`,
    `// Regenerate: node scripts/generate-copy-splits.mjs   (lang: ${lang})`,
    `export const WEATHER_COPY = ${JSON.stringify(bank)};`,
    '',
  ].join('\n');
}

// Emit only when run directly (the drift test imports the helpers instead).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const outDir = fileURLToPath(new URL('../assets/copy/', import.meta.url));
  mkdirSync(outDir, { recursive: true });
  for (const lang of LANGS) {
    const file = path.join(outDir, `${lang}.js`);
    writeFileSync(file, buildModuleSource(lang), 'utf8');
    console.log(`wrote ${file}`);
  }
}
