// v7 (review/accuracy/v7/PLAN.md §8, Fable's minor note): a SYNOP report is UTC and the Open-Meteo archive files are
// Africa/Johannesburg — Strand 68911's 12 UTC report must land on the 14:00 SAST model hour, and its 910ff gust (not
// 911ff) must be read in the report's own unit.
import { describe, expect, it } from 'vitest';
import { parseSynopLine, sastKey } from '../review/accuracy/v7/synop7.mjs';

describe('v7 SYNOP reading', () => {
  it('12 UTC → the 14:00 SAST hour', () => {
    expect(sastKey(Date.UTC(2026, 8, 28, 12))).toBe('2026-09-28T14');
    expect(sastKey(Date.UTC(2026, 8, 28, 23))).toBe('2026-09-29T01');
  });
  it('910ff in m/s (iw = 1), 911ff ignored', () => {
    const r = parseSynopLine('68911,2026,09,27,18,00,AAXX 27181 68911 46/// /1206 10180 20110 30120 40150 58005 333 91115 91019 555 1////=');
    expect(r.utc).toBe(Date.UTC(2026, 8, 27, 18));
    expect(r.dir).toBe(120);
    expect(r.kph).toBeCloseTo(6 * 3.6);
    expect(r.gustKph).toBeCloseTo(19 * 3.6);
  });
  it('knots (iw = 4)', () => {
    const r = parseSynopLine('68004,2026,09,27,00,00,AAXX 27004 68004 36/// /0000 10178 21034 38541 48496 58003 333 10351 20178 91002 555 91017=');
    expect(r.kph).toBe(0);
    expect(r.gustKph).toBeCloseTo(2 * 1.852);
  });
});
