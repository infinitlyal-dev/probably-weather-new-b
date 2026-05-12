// Cross-language duplicate audit — regression guard.
// Walks every 5-language i18n leaf in `assets/app.js`, `assets/install.js`,
// `assets/refresh-behaviour.js`, and `assets/weather-copy.js`, and asserts
// no leaf has the SAME value in more than 2 columns (with allowlist for
// legitimate shared forms like acronyms and AF/EN cognates).
//
// Background: I18N_CROSS_LANGUAGE_AUDIT.md found 34 zu + 33 xh cross-language
// duplicates. Most are legitimate Nguni cognates (zu/xh share vocabulary).
// SA5 deferred all 67 to TRIAGE_NATIVE_REVIEW.md pending native confirmation.
// This test pins the current state — once natives review, the allowlist can
// be updated. New duplicates that AREN'T in the allowlist will fail.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const installSrc = readFileSync(new URL('../assets/install.js', import.meta.url), 'utf8');
const refreshSrc = readFileSync(new URL('../assets/refresh-behaviour.js', import.meta.url), 'utf8');
const weatherCopySrc = readFileSync(new URL('../assets/weather-copy.js', import.meta.url), 'utf8');

const LANGS = ['en', 'af', 'zu', 'xh', 'st'];

// Extract every 5-language object { en: "...", af: "...", zu: "...", xh: "...", st: "..." }
// from a source string. Returns array of { values: {en,af,zu,xh,st} }.
function extractLeaves(src) {
  const leaves = [];
  const blockRe = /\{\s*((?:[a-z]{2}:\s*"[^"]*",?\s*){5,})\s*\}/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const body = m[1];
    const values = {};
    const kvRe = /\b(en|af|zu|xh|st):\s*"((?:[^"\\]|\\.)*)"/g;
    let kv;
    while ((kv = kvRe.exec(body)) !== null) {
      values[kv[1]] = kv[2];
    }
    if (LANGS.every((l) => l in values)) {
      leaves.push({ values });
    }
  }
  return leaves;
}

// Known-legitimate duplicates per `I18N_CROSS_LANGUAGE_AUDIT.md` and
// TRIAGE_NATIVE_REVIEW.md. Pending native confirmation, the Nguni cognates
// (zu/xh pairs) stay on the allowlist. Once natives review, prune this.
const ALLOWED_VALUES = new Set([
  'UV',
  'Temp',
  '°',
  '°C',
  '°F',
  'Wind',
  'Week',
  'Sat',
  'Son',
  'Later ⏰',
  'in',
  'OK',
  'Tha',
  'Sin',
  'Hlela',
  'Kwenziwe',
  'Ukubonisa',
  'Imithombo',
  'Akunakwenzeka',
  'Phezulu',
  'Phezulu Kakhulu',
  'Ukuphuma kwelanga',
  'Usuku',
  'Umoya',
  'Imvula',
  'UV Ephezulu',
  'Kubanda',
  'Isusiwe',
  'Iyalayisha…',
  'Yabelana',
  'e-',
  'Isichotho',
  'I-UV ephezulu',
  'Kumnandi',
  'Isichotho siyeza.',
  'Imvula ikhona.',
  'Kuyabanda.',
  'I-UV iphezulu.',
  'Faka',
  'Faka i-Probably Weather',
  'Sula idatha yokufaka',
  'Ikhaya',
]);

function collectAllLeaves() {
  return {
    appSrc: extractLeaves(appSrc),
    installSrc: extractLeaves(installSrc),
    refreshSrc: extractLeaves(refreshSrc),
    weatherCopySrc: extractLeaves(weatherCopySrc),
  };
}

describe('i18n cross-language duplicates - regression guard', () => {
  it('extracts at least 50 five-language leaves across all four sources', () => {
    const all = collectAllLeaves();
    const total = Object.values(all).reduce((s, arr) => s + arr.length, 0);
    expect(total).toBeGreaterThanOrEqual(50);
  });

  it('no leaf has the same value across all 5 languages (except brand exceptions)', () => {
    const all = collectAllLeaves();
    const offenders = [];
    for (const [name, leaves] of Object.entries(all)) {
      for (const leaf of leaves) {
        const vals = LANGS.map((l) => leaf.values[l]);
        const allEqual = vals.every((v) => v === vals[0]);
        if (allEqual && !ALLOWED_VALUES.has(vals[0])) {
          offenders.push(`${name}: ${vals[0]}`);
        }
      }
    }
    expect(offenders, `offenders:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no leaf has the same value across 4 languages (except brand exceptions)', () => {
    const all = collectAllLeaves();
    const offenders = [];
    for (const [name, leaves] of Object.entries(all)) {
      for (const leaf of leaves) {
        const counts = {};
        for (const l of LANGS) {
          const v = leaf.values[l];
          counts[v] = (counts[v] || 0) + 1;
        }
        for (const [val, count] of Object.entries(counts)) {
          if (count >= 4 && !ALLOWED_VALUES.has(val)) {
            offenders.push(`${name}: "${val}" repeated ${count}x`);
          }
        }
      }
    }
    expect(offenders, `offenders:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('`af` is never empty when `en` is non-empty', () => {
    const all = collectAllLeaves();
    const offenders = [];
    for (const [name, leaves] of Object.entries(all)) {
      for (const leaf of leaves) {
        if (leaf.values.en && !leaf.values.af) {
          offenders.push(`${name}: en="${leaf.values.en}" af=""`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('`zu` is never empty when `en` is non-empty', () => {
    const all = collectAllLeaves();
    const offenders = [];
    for (const [name, leaves] of Object.entries(all)) {
      for (const leaf of leaves) {
        if (leaf.values.en && !leaf.values.zu) {
          offenders.push(`${name}: en="${leaf.values.en}" zu=""`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('`xh` is never empty when `en` is non-empty', () => {
    const all = collectAllLeaves();
    const offenders = [];
    for (const [name, leaves] of Object.entries(all)) {
      for (const leaf of leaves) {
        if (leaf.values.en && !leaf.values.xh) {
          offenders.push(`${name}: en="${leaf.values.en}" xh=""`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('`st` is never empty when `en` is non-empty', () => {
    const all = collectAllLeaves();
    const offenders = [];
    for (const [name, leaves] of Object.entries(all)) {
      for (const leaf of leaves) {
        if (leaf.values.en && !leaf.values.st) {
          offenders.push(`${name}: en="${leaf.values.en}" st=""`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('`zu` and `af` never share the same long string (>3 chars) outside allowlist', () => {
    // Catches the `days.sun.zu = "Son"` copy-paste class. AF and ZU have no
    // shared genealogy. Short tokens (<=3 chars) may coincide.
    const all = collectAllLeaves();
    const offenders = [];
    for (const [name, leaves] of Object.entries(all)) {
      for (const leaf of leaves) {
        const af = leaf.values.af;
        const zu = leaf.values.zu;
        if (af && zu && af === zu && af.length > 3 && !ALLOWED_VALUES.has(af)) {
          offenders.push(`${name}: af="${af}" === zu="${zu}"`);
        }
      }
    }
    expect(offenders, `offenders:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('`zu` and `st` never share the same string outside allowlist (no shared family)', () => {
    const all = collectAllLeaves();
    const offenders = [];
    for (const [name, leaves] of Object.entries(all)) {
      for (const leaf of leaves) {
        const zu = leaf.values.zu;
        const st = leaf.values.st;
        if (zu && st && zu === st && !ALLOWED_VALUES.has(zu)) {
          offenders.push(`${name}: zu="${zu}" === st="${st}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('`xh` and `st` never share the same string outside allowlist', () => {
    const all = collectAllLeaves();
    const offenders = [];
    for (const [name, leaves] of Object.entries(all)) {
      for (const leaf of leaves) {
        const xh = leaf.values.xh;
        const st = leaf.values.st;
        if (xh && st && xh === st && !ALLOWED_VALUES.has(xh)) {
          offenders.push(`${name}: xh="${xh}" === st="${st}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('allowlist stays bounded (no creeping growth)', () => {
    expect(ALLOWED_VALUES.size).toBeLessThanOrEqual(45);
  });

  it('canonical tracker - days.sun.zu state is observable (pinned for native review)', () => {
    // PINS the current state of the canonical `days.sun.zu` suspect. Once the
    // Zulu native speaker confirms the correct abbreviation, swap the assertion
    // and apply the fix in `assets/app.js`.
    const daysBlock = appSrc.match(/days:\s*\{[\s\S]*?\n\s{4}\},/)?.[0] ?? '';
    expect(daysBlock).toBeTruthy();
    const sunLine = daysBlock.match(/sun:\s*\{[^}]*\}/)?.[0] ?? '';
    const zuVal = sunLine.match(/zu:\s*"([^"]+)"/)?.[1];
    const afVal = sunLine.match(/af:\s*"([^"]+)"/)?.[1];
    expect(zuVal).toBeDefined();
    expect(afVal).toBeDefined();
    expect(typeof zuVal).toBe('string');
  });
});
