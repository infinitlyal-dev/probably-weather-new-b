import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { WEATHER_COPY } from '../assets/weather-copy.js';
import { safetyTopics } from '../scripts/translation-skills/rule-checks.mjs';
import { lesothoForms } from '../scripts/translation-skills/st-respell.mjs';

// The translation-skills pass of 2026-09-23 (Part 2, step 10). Al's brief: safety lines (headlights,
// stay inside, sunscreen, flooding, wind) must pass both back-translations, plus the automatic
// scorer where the language is covered, or they show in English; the Sesotho bank is written in the
// South African orthography. scripts/translation-skills/LIVE-RECORD.json is what the checks decided;
// this test holds the bank to it, so a safety line cannot be rewritten without being checked again.

const record = JSON.parse(readFileSync(new URL('../scripts/translation-skills/LIVE-RECORD.json', import.meta.url), 'utf8'));
const extra = new Set(JSON.parse(readFileSync(new URL('../scripts/translation-skills/rules/safety-lines.json', import.meta.url), 'utf8')).lines.map((l) => l.en));
const LANGS = ['zu', 'xh', 'st'];
const pairs = [];
for (const [ns, group] of Object.entries(WEATHER_COPY)) {
  for (const [bin, row] of Object.entries(group || {})) {
    if (!row || typeof row !== 'object' || !Array.isArray(row.en)) continue;
    row.en.forEach((en, i) => { for (const l of LANGS) if (row[l]?.[i]) pairs.push({ where: `${ns}.${bin}[${i}]`, lang: l, en, text: row[l][i] }); });
  }
}
const isSafety = (en) => safetyTopics(en).length > 0 || extra.has(en);
const recorded = new Map(record.safety.map((s) => [`${s.lang}|${s.en}`, s]));
const excused = new Set(record.stays.filter((s) => s.lang === 'st').map((s) => s.text));

describe('safety lines show checked text or the English', () => {
  it('every isiZulu, isiXhosa and Sesotho safety line in the bank is on the record', () => {
    const missing = pairs.filter((p) => isSafety(p.en) && !recorded.has(`${p.lang}|${p.en}`)).map((p) => `${p.lang} ${p.where}: ${p.en}`);
    expect(missing).toEqual([]);
    expect(recorded.size).toBeGreaterThan(90);
  });

  const driftOf = (list) => list.filter((p) => isSafety(p.en)).filter((p) => {
    const r = recorded.get(`${p.lang}|${p.en}`);
    return !r || (p.text !== r.text) || (r.outcome === 'english' ? p.text !== p.en : !(r.checks && r.checks.claude === 'MATCH' && r.checks.sol === 'MATCH'));
  }).map((p) => `${p.lang} ${p.where}: ${p.text}`);

  it('each shows exactly the text that passed the safety rule, or the English', () => {
    expect(driftOf(pairs)).toEqual([]);
  });

  it('negative control: an unchecked rewrite of a safety line, or a checked line swapped for English, is caught', () => {
    const checked = pairs.find((p) => recorded.get(`${p.lang}|${p.en}`)?.outcome === 'checked');
    const english = pairs.find((p) => recorded.get(`${p.lang}|${p.en}`)?.outcome === 'english');
    expect(checked).toBeTruthy();
    expect(driftOf([{ ...checked, text: `${checked.text} x` }])).toHaveLength(1);
    expect(driftOf([{ ...checked, text: checked.en }])).toHaveLength(1);
    if (english) expect(driftOf([{ ...english, text: 'Umbhalo ongahloliwe.' }])).toHaveLength(1);
  });
});

describe('Sesotho is written in the South African orthography', () => {
  it('no live Sesotho bank line carries a Lesotho form, except the lines recorded as staying', () => {
    const lesotho = pairs.filter((p) => p.lang === 'st' && p.text !== p.en && !excused.has(p.text) && lesothoForms(p.text, p.en).length)
      .map((p) => `${p.where}: ${lesothoForms(p.text, p.en).join(', ')}`);
    expect(lesotho).toEqual([]);
  });

  it('negative control: the check sees a Lesotho line', () => {
    expect(lesothoForms('Pula ea na, joale re tla bona.', 'Rain now.')).toEqual(['ea', 'joale']);
  });
});
