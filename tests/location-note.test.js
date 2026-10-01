// The note under the Home place name after a refused location attempt fell back (1 Oct 2026).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { NOTE_APPROX, NOTE_SAVED, createLocationNote, noteTextKey } from '../assets/location-note.js';

const same = (a, b) => a.lat.toFixed(4) === b.lat.toFixed(4) && a.lon.toFixed(4) === b.lon.toFixed(4);
const cpt = { name: 'Cape Town', lat: -33.9249, lon: 18.4241 };
const jhb = { name: 'Johannesburg', lat: -26.2041, lon: 28.0473 };

describe('which text for which variant', () => {
  it('the saved GPS place and the IP rough guess each have their own T.home key', () => {
    expect(noteTextKey(NOTE_SAVED)).toBe('fallbackSaved');
    expect(noteTextKey(NOTE_APPROX)).toBe('fallbackApprox');
    expect(noteTextKey('nonsense')).toBeNull();
    expect(noteTextKey(null)).toBeNull();
  });
});

describe('when the note clears', () => {
  it('starts empty and shows only a known variant', () => {
    const n = createLocationNote();
    expect(n.current()).toBeNull();
    expect(n.show('nonsense', cpt)).toBe(false);
    expect(n.current()).toBeNull();
    expect(n.show(NOTE_SAVED, cpt)).toBe(true);
    expect(n.current()).toBe(NOTE_SAVED);
  });
  it('stays while the same place reloads (a weather refresh of the fallback place)', () => {
    const n = createLocationNote();
    n.show(NOTE_APPROX, cpt);
    expect(n.dropUnlessFor({ ...cpt, name: 'Cape Town, Western Cape' }, same)).toBe(false);
    expect(n.current()).toBe(NOTE_APPROX);
  });
  it('clears when any other place loads (the user picked one, or GPS moved Home)', () => {
    const n = createLocationNote();
    n.show(NOTE_SAVED, cpt);
    expect(n.dropUnlessFor(jhb, same)).toBe(true);
    expect(n.current()).toBeNull();
  });
  it('clear() is what a later GPS success calls, and says whether there was a note', () => {
    const n = createLocationNote();
    n.show(NOTE_SAVED, cpt);
    expect(n.clear()).toBe(true);
    expect(n.clear()).toBe(false);
    expect(n.current()).toBeNull();
  });
  it('with no note, a place load changes nothing', () => {
    expect(createLocationNote().dropUnlessFor(jhb, same)).toBe(false);
  });
  it('is in memory only: a new note object (a reload) starts empty and nothing is stored', () => {
    createLocationNote().show(NOTE_SAVED, cpt);
    expect(createLocationNote().current()).toBeNull();
    const src = readFileSync(new URL('../assets/location-note.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|saveJSON/);
  });
});

describe('the three strings', () => {
  const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('    home: {\n      fallbackSaved'), src.indexOf("    // ADS-READINESS (Al's ruling 2026-09-15): the slot label"));
  it("EN and AF are Al's wording, exactly", () => {
    expect(block).toContain(`en: "Can't use your location, so this is your saved place."`);
    expect(block).toContain(`af: "Kan nie jou ligging gebruik nie, so dit is jou gestoorde plek."`);
    expect(block).toContain(`en: "Can't use your location, so this is a rough guess."`);
    expect(block).toContain(`af: "Kan nie jou ligging gebruik nie, so dit is 'n skatting."`);
    expect(block).toContain(`pickPlace: { en: "Pick a place", af: "Kies 'n plek"`);
  });
  it('every key carries all five languages', () => {
    for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
      expect(block.match(new RegExp(`\\b${lang}: "`, 'g'))?.length).toBe(3);
    }
  });
});
