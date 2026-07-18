import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const assets = path.join(root, 'assets');
const fontDir = path.join(assets, 'fonts');
const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const families = [
  {
    key: 'onest',
    cssFamily: 'Onest Prototype',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Onest:wght@100..900&display=swap',
    source: 'https://github.com/simpals/onest',
    license: 'https://raw.githubusercontent.com/simpals/onest/master/OFL.txt',
    output: 'OFL-Onest.txt',
    budget: 50 * 1024,
  },
  {
    key: 'caveat',
    cssFamily: 'Caveat Prototype',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap',
    source: 'https://github.com/googlefonts/caveat',
    license: 'https://raw.githubusercontent.com/googlefonts/caveat/main/OFL.txt',
    output: 'OFL-Caveat.txt',
    budget: 110 * 1024,
  },
];

async function fetchText(url) {
  const response = await fetch(url, { headers: { Accept: 'text/css,*/*;q=0.1', 'User-Agent': chromeUserAgent } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function fetchSubsets(family) {
  const css = await fetchText(family.cssUrl);
  const blocks = [...css.matchAll(/\/\*\s*([^*]+?)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g)];
  const selected = [];
  for (const [, subsetName, declarations] of blocks) {
    const subset = subsetName.trim();
    if (!['latin-ext', 'latin'].includes(subset)) continue;
    const url = declarations.match(/src:\s*url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    const weight = declarations.match(/font-weight:\s*([^;]+);/)?.[1]?.trim();
    const unicodeRange = declarations.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();
    if (!url || !weight || !unicodeRange) throw new Error(`Incomplete ${family.key} ${subset} face`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    selected.push({ subset, url, weight, unicodeRange, bytes, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  if (selected.length !== 2) throw new Error(`Expected latin + latin-ext for ${family.key}; got ${selected.map((item) => item.subset).join(', ')}`);
  const totalBytes = selected.reduce((total, item) => total + item.bytes.length, 0);
  if (totalBytes > family.budget) throw new Error(`${family.key} subsets are ${totalBytes} bytes; budget is ${family.budget}`);
  return { ...family, subsets: selected, totalBytes };
}

function embeddedFaces(family) {
  return family.subsets.map((face) => `/* ${face.subset}; ${face.bytes.length} bytes; sha256 ${face.sha256} */
@font-face {
  font-family: '${family.cssFamily}';
  font-style: normal;
  font-weight: ${face.weight};
  font-display: swap;
  src: url(data:font/woff2;base64,${face.bytes.toString('base64')}) format('woff2');
  unicode-range: ${face.unicodeRange};
}`).join('\n\n');
}

const onestRules = `

/* Adopted default: these rem values equal the dossier's ruled pixel ladder at
   the normal 16px root while still responding to text zoom. */
:root {
  --font-system: 'Onest Prototype', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

body,
button,
input,
select,
textarea {
  font-family: var(--font-system);
}

@media (max-width: 768px) {
  .hero-probably {
    /* min() px cap keeps the ruled size at 100% but stops the rem from doubling
       past the viewport at 200% text zoom (was clipping off the right edge). */
    font-size: min(clamp(2.75rem, 12vw, 3rem), 68px);
    font-weight: 650;
    line-height: 0.98;
    letter-spacing: -0.035em;
  }

  .hero-range {
    font-size: min(clamp(3rem, 13vw, 3.25rem), 72px);
    font-weight: 800;
    line-height: 0.96;
    letter-spacing: -0.045em;
  }

  #home-screen #description {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.04;
  }

  #headline {
    font-size: clamp(1.25rem, 5.6vw, 1.375rem);
    font-weight: 650;
    line-height: 1.12;
  }

  .sidebar .weather-byline {
    font-size: 0.75rem;
    font-weight: 500;
  }
}

@media (min-width: 1024px) {
  #location {
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.14em;
  }

  .hero-probably {
    /* px cap: ruled 68px at 100%; caps growth at 200% zoom so "Probably" fits the
       voice column (which maxes at ~520px) instead of running past the frame. */
    font-size: min(4.25rem, 100px);
    font-weight: 300;
    line-height: 0.98;
    letter-spacing: -0.035em;
  }

  .hero-range {
    font-size: min(6.125rem, 115px);
    font-weight: 800;
    line-height: 0.96;
    letter-spacing: -0.045em;
  }

  #home-screen #description {
    font-size: 2.125rem;
    font-weight: 700;
    line-height: 1.02;
  }

  .sidebar .weather-byline {
    font-size: 0.9375rem;
    font-weight: 450;
  }

  .nav button,
  .language-btn {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .share-btn,
  .nav-hourly-pill,
  .my-location-btn {
    font-size: 0.9375rem;
    font-weight: 650;
  }

  #shareBtn {
    font-size: 1rem;
  }
}
`;

const caveatRules = `

/* Caveat is intentionally isolated in a desktop-only stylesheet. Mobile never
   downloads this file or its embedded caption bytes (JS media-gated loader).
   #home-screen #headline (2 ids) beats app.css's #headline caption rule. */
@media (min-width: 1024px) {
  #home-screen #headline {
    font-family: 'Caveat Prototype', 'Segoe Print', 'Bradley Hand', cursive;
    font-size: clamp(1.25rem, 1.45vw, 1.375rem);
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0;
  }
}
`;

mkdirSync(fontDir, { recursive: true });
const generated = [];
for (const family of families) {
  const result = await fetchSubsets(family);
  const license = await fetchText(result.license);
  writeFileSync(path.join(fontDir, result.output), license.endsWith('\n') ? license : `${license}\n`);
  generated.push(result);
}

const onest = generated.find((font) => font.key === 'onest');
const caveat = generated.find((font) => font.key === 'caveat');
writeFileSync(path.join(assets, 'type-prototype.css'), `/* GENERATED by scripts/generate-type-prototype-fonts.mjs — do not hand-edit. */\n${embeddedFaces(onest)}${onestRules}`);
writeFileSync(path.join(assets, 'type-prototype-caption.css'), `/* GENERATED by scripts/generate-type-prototype-fonts.mjs — do not hand-edit. */\n${embeddedFaces(caveat)}${caveatRules}`);

const manifest = {
  purpose: 'Production default typography (Onest UI + Caveat desktop caption)',
  subsets: ['latin', 'latin-ext'],
  fonts: Object.fromEntries(generated.map((font) => [font.key, {
    family: font.cssFamily,
    source: font.source,
    cssSource: font.cssUrl,
    license: 'SIL Open Font License 1.1',
    licenseFile: `assets/fonts/${font.output}`,
    budgetBytes: font.budget,
    totalBytes: font.totalBytes,
    faces: font.subsets.map(({ subset, url, bytes, sha256 }) => ({ subset, sourceUrl: url, bytes: bytes.length, sha256 })),
  }])),
};
writeFileSync(path.join(fontDir, 'type-prototype-fonts.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[type prototype] Onest ${onest.totalBytes}/${onest.budget} bytes; Caveat ${caveat.totalBytes}/${caveat.budget} bytes`);
