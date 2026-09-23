import { describe, expect, it } from 'vitest';

import { WEATHER_COPY } from '../assets/weather-copy.js';
import { reversedLightAdvice } from '../scripts/translation-skills/safety-reversal.mjs';

// st-0870 (witty_low_confidence fog, Sesotho) told drivers "tlosa mabone a koloi" — take the car's
// lights OFF — for "Mist building, maybe. Headlights wouldn't hurt.", from the June 2026 native
// review until 2026-09-23. Al's brief: "Fix st-0870 first", and a safety line that cannot pass
// "shows in English". No line in any language may tell a driver the opposite of the English about
// their lights.

const LANGS = ['af', 'zu', 'xh', 'st'];
const pairs = [];
for (const [ns, group] of Object.entries(WEATHER_COPY)) {
  for (const [bin, row] of Object.entries(group || {})) {
    if (!row || typeof row !== 'object') continue;
    if (Array.isArray(row.en)) row.en.forEach((en, i) => { for (const l of LANGS) if (row[l]?.[i]) pairs.push({ where: `${ns}.${bin}[${i}]`, lang: l, en, text: row[l][i] }); });
    else if (typeof row.en === 'string') for (const l of LANGS) if (typeof row[l] === 'string') pairs.push({ where: `${ns}.${bin}`, lang: l, en: row.en, text: row[l] });
  }
}

describe('light advice is never reversed', () => {
  it('the check still sees the st-0870 reversal (negative control)', () => {
    expect(reversedLightAdvice('st', "Mist building, maybe. Headlights wouldn't hurt.", 'mohodi oa eketseha  tlosa mabone  a koloi')).toBe('tlosa');
    expect(reversedLightAdvice('af', "Mist building, maybe. Headlights wouldn't hurt.", 'Mis bou op. Sit die ligte af.')).toBeTruthy();
    expect(reversedLightAdvice('st', "Mist building, maybe. Headlights wouldn't hurt.", 'Mohodi o a eketseha. Bulela mabone a koloi.')).toBeNull();
  });

  it('no bank line in af, zu, xh or st tells drivers to switch their lights off', () => {
    const lightLines = pairs.filter((p) => /headlight|lights? on/i.test(p.en));
    expect(lightLines.length).toBeGreaterThan(4);
    const reversed = pairs.filter((p) => reversedLightAdvice(p.lang, p.en, p.text)).map((p) => `${p.lang} ${p.where}: ${p.text}`);
    expect(reversed).toEqual([]);
  });

  // 2026-09-23 (step 10): the sharpened Sesotho skill wrote it again — "Ho bulela mabone a koloi"
  // (switching the car's lights ON) — and it passed both blind back-translations as MATCH; the
  // English stopgap is gone on purpose. LIVE-RECORD.json holds the checks.
  it('st-0870 tells drivers to switch their lights ON, in the Sesotho that passed both back-translations', () => {
    const fog = WEATHER_COPY.witty_low_confidence.fog;
    const i = fog.en.indexOf("Mist building, maybe. Headlights wouldn't hurt.");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(fog.st[i]).not.toBe(fog.en[i]);
    expect(fog.st[i]).toMatch(/\bbulela mabone\b/);
    expect(reversedLightAdvice('st', fog.en[i], fog.st[i])).toBeNull();
  });
});
