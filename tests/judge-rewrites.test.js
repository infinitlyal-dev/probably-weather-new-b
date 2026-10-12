// Maat's rulings on the judge's October verdicts (12 Oct 2026): what scripts/lang-check/apply-judge-rewrites.mjs reads
// from his file, and the loan rule that lifts a checker hold.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readRulings, onlyAcceptedLoans } from '../scripts/lang-check/apply-judge-rewrites.mjs';

const RULINGS = path.resolve('review/maat-rulings-2026-10-12.md');

describe('Maat\'s rulings, 12 Oct 2026', () => {
  // *.md is not uploaded to Vercel, where the suite also runs
  it.skipIf(!fs.existsSync(RULINGS))('reads his own lines, the not-applicable rows and the held line from the file', () => {
    const R = readRulings(fs.readFileSync(RULINGS, 'utf8'));
    expect(Object.keys(R.mine.xh).sort()).toEqual(['witty.clear[37]', 'witty.cold[99]', 'witty.cloudy[67]', 'witty.fog[95]', 'witty.rain[73]'].sort());
    expect(Object.keys(R.mine.zu)).toEqual(['witty.wind[41]']);
    expect(R.mine.zu['witty.wind[41]']).toBe('Indwangu yetafula yentaba isilungile, ilindele umsebenzi wakusasa.');
    expect([...R.notApplicable.xh].sort()).toEqual(['witty.clear[67]', 'witty.clear[78]', 'witty.cold-clear[39]', 'witty.heat[69]']);
    expect(R.notApplicable.zu).toBeUndefined();
    expect(R.mine['xh:held']).toEqual({ key: 'hero:2071c8a37d11', text: 'Isaqhwithi esincinci sothuli sihamba phambi kwakhe. Asinyatheli nokunyathela iipedali.' });
  });

  it('lifts a checker hold only when every serious finding is one of the judge\x27s loans, as a whole phrase', () => {
    const f = (check, severity, token) => ({ check, severity, token, message: '' });
    const v = (text, ...findings) => ({ text, findings });
    expect(onlyAcceptedLoans(v('Ipholisa simahla. I-aircon.', f('lexical', 'medium', 'I-aircon'), f('lexical', 'low', 'omncinci')))).toBe(true);
    expect(onlyAcceptedLoans(v('I-aircon sizigqumile', f('lexical', 'medium', 'I-aircon'), f('lexical', 'medium', 'sizigqumile')))).toBe(false);
    expect(onlyAcceptedLoans(v('ii-surfer', f('concord', 'medium', 'ii-surfer')))).toBe(false); // a concord fault is never a loan
    expect(onlyAcceptedLoans(v('I-city enkulu', f('lexical', 'medium', 'I-city')))).toBe(false);      // only "Friendly City" / "Windy City"
    expect(onlyAcceptedLoans(v('IFriendly City', f('lexical', 'medium', 'City')))).toBe(true);
    expect(onlyAcceptedLoans(v('IFriendly City', f('lexical', 'medium', 'IFriendly')))).toBe(true);
    expect(onlyAcceptedLoans(v('kwi-pier', f('lexical', 'medium', 'kwi-pier')))).toBe(true);
    expect(onlyAcceptedLoans(v('anti-zero', f('lexical', 'medium', 'anti-zero')))).toBe(false);
    expect(onlyAcceptedLoans(v('i.aircon', f('lexical', 'medium', 'i.aircon')))).toBe(false);
    expect(onlyAcceptedLoans(v('friendly/city', f('lexical', 'medium', 'city')))).toBe(false);
    expect(onlyAcceptedLoans(v('aircon2', f('lexical', 'medium', 'aircon2')))).toBe(false);
    expect(onlyAcceptedLoans(v('friendly 123 city', f('lexical', 'medium', 'city')))).toBe(false);
    expect(onlyAcceptedLoans(v('unfriendly city', f('lexical', 'medium', 'city')))).toBe(false);
    expect(onlyAcceptedLoans(v('x', f('lexical', 'low', 'x')))).toBe(false);                       // nothing to lift
  });
});
