import { describe, expect, it } from 'vitest';
import { concordFindings } from '../scripts/lang-check/lib/concord.mjs';

// The concord check on constructed sentences (9 Oct 2026). A small explicit lexicon stands in for the corpus index,
// which is not in the repository; the classes are the ones the index carries for these nouns.
const ZU = { imvula: '9', izulu: '5', ilanga: '5', amafu: '6', umoya: '3', abantu: '2', izinsuku: '10', ubusuku: '14' };
const XH = { iimvula: '10', imvula: '9', ilanga: '5', amafu: '6', izulu: '5', ilifu: '5' };
const ST = { letsatsi: '5', maru: '6', moya: '3', pula: '10', sefefo: '7', bosiu: '14', leru: '5', dikgomo: '10' };
const zu = (t) => concordFindings(t, 'zu', { lexicon: ZU });
const xh = (t) => concordFindings(t, 'xh', { lexicon: XH });
const st = (t) => concordFindings(t, 'st', { lexicon: ST });

describe('isiZulu — subject and possessive concords', () => {
  it('right concords pass', () => {
    for (const t of ['Izulu liyaduma.', 'Imvula iyana namuhla.', 'Amafu ayabuthana.', 'Abantu bayajabula.', 'Ubusuku bubandayo.', 'Imvula yasekuseni iyaqhubeka.', 'Izinsuku ziyafushana.'])
      expect(zu(t), t).toEqual([]);
  });
  it('a class 5 noun with a class 8/10 concord is caught', () => {
    const [f] = zu('Izulu ziyaduma.');
    expect(f).toMatchObject({ kind: 'subject', noun: 'izulu', concord: 'zi' });
    expect(f.classes).toContain('5');
  });
  it('a class 9 noun with the class 5 concord is caught', () => {
    expect(zu('Imvula liyana kakhulu.')[0]).toMatchObject({ noun: 'imvula', concord: 'li' });
  });
  it('a class 6 noun with the class 2 concord is caught, past an adjective', () => {
    expect(zu('Amafu amnyama bayeza.')[0]).toMatchObject({ noun: 'amafu', concord: 'ba' });
  });
  it('a possessive of the wrong class is caught', () => {
    expect(zu('Imvula lasekuseni iyaqhubeka.')[0]).toMatchObject({ kind: 'possessive', noun: 'imvula' });
  });
  it('a copulative of a noun is not a verb (ukutshiswa lilanga — "burnt by the sun")', () => {
    expect(concordFindings('Ukutshiswa lilanga kubuhlungu.', 'zu', { lexicon: { ...ZU, ukutshiswa: '15' } })).toEqual([]);
  });
  it('si- is never read as a concord (it is also "we")', () => {
    expect(zu('Abantu siyabazi.')).toEqual([]);
  });
  it('only the clause-initial noun is judged; an object followed by another clause is not', () => {
    expect(zu('Ngibona imvula, zonke izinsuku ziyafana.')).toEqual([]);
  });
  it('a word the lexicon does not know as a noun is not judged (ukuthi, akukho …)', () => {
    expect(zu('Ukuthi liyana, ngiyazi.')).toEqual([]);
    expect(zu('Akukho zinto ezintsha.')).toEqual([]);
  });
});

describe('isiXhosa — subject concords', () => {
  it('right concords pass', () => {
    for (const t of ['Ilanga liyatshisa.', 'Iimvula ziyana.', 'Amafu ayahamba.', 'Ilifu lihamba kancinci.']) expect(xh(t), t).toEqual([]);
  });
  it('a class 10 plural with the class 5 concord is caught', () => {
    expect(xh('Iimvula liyana.')[0]).toMatchObject({ noun: 'iimvula', concord: 'li' });
  });
  it('a class 5 noun with the class 8/10 concord is caught', () => {
    expect(xh('Ilanga ziyatshisa.')[0]).toMatchObject({ noun: 'ilanga', concord: 'zi' });
  });
});

describe('Sesotho — disjunctive subject concords', () => {
  it('right concords pass', () => {
    for (const t of ['Letsatsi le a chesa.', 'Pula e a na.', 'Moya o a foka.', 'Sefefo se tla fihla.', 'Bosiu bo a bata.', 'Dikgomo di a fula.'])
      expect(st(t), t).toEqual([]);
  });
  it('class 5 with the class 4/9 concord is caught', () => {
    const [f] = st('Letsatsi e a chesa.');
    expect(f).toMatchObject({ kind: 'subject', noun: 'letsatsi', concord: 'e' });
    expect(f.message).toContain("'le'");
  });
  it('a bare class 9 noun with the class 8/10 concord is caught (pula is tagged 10 in the dictionaries, read as 9)', () => {
    expect(st('Pula di a na.')[0]).toMatchObject({ noun: 'pula', concord: 'di' });
  });
  it('class 7 with the class 5 concord is caught before a future marker', () => {
    expect(st('Sefefo le tla fihla.')[0]).toMatchObject({ noun: 'sefefo', concord: 'le' });
  });
  it("'le' as 'and' is not a concord", () => {
    expect(st('Pula le moya di a tla.')).toEqual([]);
  });
  it("'e' without present-tense 'a' after it is not read ('e ne e le' is the impersonal past)", () => {
    expect(st('Letsatsi e ne e le hantle.')).toEqual([]);
  });
  it('a locative in -ng is not a subject', () => {
    expect(st('Lehodimong le a bata.')).toEqual([]);
  });
});

describe('other languages and empty input', () => {
  it('returns nothing for Afrikaans, English or an empty line', () => {
    expect(concordFindings('Die reën val.', 'af')).toEqual([]);
    expect(concordFindings('', 'zu')).toEqual([]);
    expect(concordFindings(null, 'st')).toEqual([]);
  });
});
