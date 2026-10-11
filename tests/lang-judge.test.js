// The native-ear judge (scripts/lang-judge/, 11 Oct 2026): the verdict set's split must keep EXAM and TRAIN apart, the
// bundle a judge reads must hold no EXAM line, and the exam's arithmetic must match Al's pass bar.
// The bundle test reads markdown (the judge prompt, the packs, the doctrine), which .vercelignore keeps out of the
// Vercel build, so it runs only where those files exist.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { norm, similarity, verdictOf, stToSa, CUT_BELOW } from '../scripts/lang-judge/build-verdicts.mjs';
import { buildBundle, scoreRows, validAnswer, comparePair, pickAnchors, outsideRepo, PASS } from '../scripts/lang-judge/judge.mjs';

const V = JSON.parse(fs.readFileSync(path.resolve('scripts/lang-judge/data/native-verdicts.json'), 'utf8'));
const LANGS = ['zu', 'xh', 'st'];
const haveMarkdown = fs.existsSync(path.resolve('scripts/lang-judge/judge-prompt.md')) && fs.existsSync(path.resolve('review/HUMOUR-DOCTRINE.md'));

describe('native verdict set', () => {
  it('maps a native\'s change to KEEP / FIX / CUT by how much of the draft survives', () => {
    expect(verdictOf('Imvula ikhona.', 'Imvula ikhona.')).toBe('KEEP');
    expect(verdictOf('Isiphepho siyeza.', 'Iziphepho ziyeza.')).toBe('FIX');
    expect(verdictOf('Ledimo le a tla.', 'sefefo se atla')).toBe('CUT');
    expect(similarity('a b c', 'A, b. C!')).toBe(1); // punctuation and capitals are not a change
    expect(CUT_BELOW).toBe(0.3);
  });

  it('reads Lesotho spelling as South African, so a spelling-only change is not a ruling', () => {
    expect(stToSa('Joale ho chesa, moholi le lipula')).toBe(stToSa('Jwale ho tjhesa, mohodi le dipula'));
    expect(stToSa('re oa utsoarela')).not.toBe(stToSa('re u utloela bohloko'));
  });

  it('splits only scored witty lines, never puts one English or one line on both sides, and halves each verdict', () => {
    for (const r of V.rows) {
      if (r.split) expect(r.scope === 'line' && !r.excluded).toBe(true);
      if (r.scope === 'line' && !r.excluded) expect(['train', 'exam']).toContain(r.split);
    }
    for (const lang of LANGS) {
      const side = new Map();
      for (const r of V.rows.filter((x) => x.lang === lang && x.split)) {
        for (const k of [`en:${norm(r.en)}`, `text:${norm(r.draft)}`, r.rewrite ? `text:${norm(r.rewrite)}` : null].filter(Boolean)) {
          expect(side.get(k) ?? r.split).toBe(r.split);
          side.set(k, r.split);
        }
      }
      for (const v of ['KEEP', 'FIX', 'CUT']) expect(Math.abs(V.counts[lang].train[v] - V.counts[lang].exam[v])).toBeLessThanOrEqual(2);
    }
  });

  it('gives every changed line the native\'s own line, and no kept line a rewrite', () => {
    for (const r of V.rows) {
      if (r.verdict === 'KEEP') expect(r.rewrite).toBeNull();
      else expect(typeof r.rewrite === 'string' && r.rewrite.trim().length > 0).toBe(true);
    }
  });
});

describe('what a judge sees', () => {
  it('anchors and compare lines come from TRAIN only', () => {
    const train = new Set(V.rows.filter((r) => r.split === 'train').map((r) => r.id));
    for (const lang of LANGS) {
      // within the language: isiZulu and isiXhosa share some identical lines
      const examText = new Set(V.rows.filter((r) => r.lang === lang && r.split === 'exam').map((r) => norm(r.draft)));
      const anchors = pickAnchors(V, lang);
      expect(anchors).toHaveLength(12);
      expect(anchors.filter((r) => r.verdict === 'KEEP')).toHaveLength(6);
      for (const a of anchors) expect(train.has(a.id)).toBe(true);
      for (const r of V.rows.filter((x) => x.lang === lang && x.split === 'exam')) {
        for (const c of comparePair(V, lang, r.cond, r.id)) {
          expect(examText.has(norm(c.draft))).toBe(false);
          if (c.line) expect(examText.has(norm(c.line))).toBe(false);
        }
      }
    }
  });

  it('batches are written only outside the repository', () => {
    expect(outsideRepo(path.resolve('.'))).toBe(false);
    expect(outsideRepo(path.resolve('scripts/lang-judge/x'))).toBe(false);
    expect(outsideRepo(os.tmpdir())).toBe(true);
    if (process.platform === 'win32') expect(outsideRepo(path.resolve('.').toUpperCase())).toBe(false);
  });

  it.skipIf(!haveMarkdown)('the bundle holds no EXAM line and no EXAM English as a confirmed line', () => {
    for (const lang of LANGS) {
      const { text } = buildBundle(V, lang); // throws if an exam line survives
      const flat = norm(text);
      for (const r of V.rows.filter((x) => x.lang === lang && x.split === 'exam')) {
        for (const t of [r.draft, r.rewrite].filter(Boolean)) expect(` ${flat} `.includes(` ${norm(t)} `)).toBe(false);
      }
    }
  });
});

describe('the exam\'s arithmetic', () => {
  const P = (native, judge, n = 1) => Array.from({ length: n }, () => ({ native, judge }));

  it('scores keep-vs-not, false keeps and false cuts against Al\'s bar', () => {
    const s = scoreRows([...P('KEEP', 'KEEP', 16), ...P('KEEP', 'CUT', 1), ...P('FIX', 'FIX', 1), ...P('CUT', 'CUT', 9), ...P('CUT', 'KEEP', 1)]);
    expect(s.n).toBe(28);
    expect(s.keepVsNot).toBeCloseTo(26 / 28);
    expect(s.falseKeeps).toBe(1);
    expect(s.falseKeepRate).toBeCloseTo(0.1);
    expect(s.falseCuts).toBe(1);
    expect(s.pass).toBe(true); // 10% false keeps is at the bar, not over it
    expect(PASS).toEqual({ keepVsNot: 0.8, falseKeepsOfCuts: 0.1 });
  });

  it('fails a judge that keeps everything, and cannot pass an exam with no native cut', () => {
    expect(scoreRows([...P('KEEP', 'KEEP', 95), ...P('CUT', 'KEEP', 5)]).pass).toBe(false);
    expect(scoreRows([...P('KEEP', 'KEEP', 10), ...P('FIX', 'FIX', 2)]).pass).toBe(false);
  });

  it('accepts only well-formed answers given once', () => {
    const ok = { id: 'a', speaker: 4, joke: 3, verdict: 'FIX', reason: 'stiff', rewrite: 'x y' };
    const once = new Map([['a', 1]]);
    expect(validAnswer(ok, once)).toBe(true);
    expect(validAnswer({ ...ok, verdict: 'KEEP', rewrite: null }, once)).toBe(true);
    expect(validAnswer({ ...ok, rewrite: '' }, once)).toBe(false);          // a FIX needs a line
    expect(validAnswer({ ...ok, speaker: 4.5 }, once)).toBe(false);
    expect(validAnswer({ ...ok, joke: 0 }, once)).toBe(false);
    expect(validAnswer({ ...ok, verdict: 'KILL' }, once)).toBe(false);
    expect(validAnswer({ ...ok, reason: ' ' }, once)).toBe(false);
    expect(validAnswer(ok, new Map([['a', 2]]))).toBe(false);              // given twice
  });
});
