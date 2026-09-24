// Photo check, part 2 (2026-09-24): how many photographs D's joke covers, by language and phone size.
//
//   node review/eval/photo-check/d-count.mjs   -> data/d-count.json
//
// The judging is by eye (data/d-judged-1.json, d-judged-2.json: every photograph's worst case at
// 414x715; d-judged-other.json: the second look at photographs clear at 414 whose joke reaches
// further on a smaller phone or in the other placement). Each judgement that finds a subject under
// the joke marks the subject's band, in % of the 414x715 frame. The band is carried into the
// photograph's own coordinates, and every measured line (d-measure-*.json: every line that can show
// on the photograph, in five languages, at three sizes) counts as covering it when its text box
// overlaps the band by at least min(40 px, half the band) on that screen. Same rule, same bands, for
// every language and size, so the totals compare like with like.
//
// The anchor count is the one EVAL.md §4b used: the subject's centre estimated from Al's crop
// anchor, and whether it lands under the joke's text — D as built against the joke always at the
// foot, with the same line in both.
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'review/eval/photo-check';
const SIZES = ['414x715', '360x688', '320x488'];
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const D_CAP_FOOT = 6;   // assets/home-options.js
const read = (f) => JSON.parse(readFileSync(`${OUT}/data/${f}`, 'utf8'));
const W = read('d-worst.json');
const order = read('d-order.json');
const main = Object.fromEntries([...read('d-judged-1.json'), ...read('d-judged-2.json')].map((j) => [j[0], j]));
const other = Object.fromEntries(read('d-judged-other.json').map((j) => [j[0], j]));
const rows = Object.fromEntries(SIZES.map((s) => [s, read(`d-measure-${s}.json`)]));
const byHash = Object.fromEntries(SIZES.map((s) => [s, rows[s].reduce((m, r) => ((m[r.hash] ||= []).push(r), m), {})]));

const geom = (size, iw, ih, anchor) => {
  const [vw, vh] = size.split('x').map(Number);
  const k = Math.max(vw / iw, vh / ih);
  const dh = ih * k;
  return { vw, vh, dh, offY: (vh - dh) * ((anchor ?? 78) / 100) };
};
// Band in % of the 414x715 frame -> y range on another screen, through the photograph.
const bandOn = (size, p, band) => {
  const a = geom('414x715', p.iw, p.ih, p.anchor), b = geom(size, p.iw, p.ih, p.anchor);
  return band.map((pct) => b.offY + ((pct / 100) * a.vh - a.offY) / a.dh * b.dh);
};
const overlap = (r, [t, b]) => Math.max(0, Math.min(r.textBottom, b) - Math.max(r.textTop, t));
const covers = (r, yb) => overlap(r, yb) >= Math.min(40, (yb[1] - yb[0]) / 2);

const photos = [];
for (const o of order) {
  const p = W[o.hash];
  const m = main[o.n], x = other[o.n];
  const j = m[1] !== 'clear' ? { level: m[1], words: m[2], band: m[3], look: 'worst at 414x715' } : x ? { level: x[1], words: x[2], band: x[3], look: 'second look', clearWords: m[2] } : { level: 'clear', words: m[2], band: null, look: 'worst at 414x715' };
  const sizes = {};
  for (const s of SIZES) {
    const R = byHash[s][o.hash];
    const yb = j.band && bandOn(s, p, j.band);
    const hit = yb ? R.filter((r) => covers(r, yb)) : [];
    const worst = hit.length ? hit.reduce((a, b) => (overlap(b, yb) > overlap(a, yb) + 0.5 || (Math.abs(overlap(b, yb) - overlap(a, yb)) <= 0.5 && b.textBottom - b.textTop > a.textBottom - a.textTop) ? b : a)) : null;
    // Anchor count (EVAL.md §4b): the subject's centre under the text of each language's tallest
    // line at this size, D as built and the same line at the foot.
    const g = geom(s, p.iw, p.ih, p.anchor);
    const subjectY = p.anchor == null ? null : (0.25 + p.anchor / 200) * g.dh + g.offY;
    const anchor = subjectY == null ? null : Object.fromEntries(LANGS.map((l) => {
      const tall = R.filter((r) => r.lang === l).reduce((a, b) => (b.textBottom - b.textTop > a.textBottom - a.textTop ? b : a));
      const textH = tall.textBottom - tall.textTop;
      const footTop = tall.lineTop - D_CAP_FOOT - textH;
      return [l, { dOnJoke: subjectY >= tall.textTop && subjectY <= tall.textBottom, footOnJoke: subjectY >= footTop && subjectY <= footTop + textH }];
    }));
    sizes[s] = {
      covered: hit.length > 0,
      langs: LANGS.filter((l) => hit.some((r) => r.lang === l)),
      lines: hit.length, of: R.length,
      worst: worst && { lang: worst.lang, line: worst.line, source: worst.source, risen: worst.risen, px: worst.px, textTop: worst.textTop, textBottom: worst.textBottom, overlapPx: Math.round(overlap(worst, yb)) },
      anchor,
    };
  }
  const w = p.sizes['414x715'].worst;
  photos.push({
    n: o.n, hash: o.hash, hash8: o.hash8, folder: p.folder, anchor: p.anchor, hoursPerWeek: p.hoursPerWeek, slots: p.slots.length, ownLines: p.ownEn.length,
    judged: j, worst414: { lang: w.lang, line: w.line, source: w.source, risen: w.risen, share: w.share },
    risenLines414: p.sizes['414x715'].risen, lines414: p.sizes['414x715'].measured,
    sizes,
    flagged: SIZES.some((s) => sizes[s].covered),
  });
}

// The judged-at-414 photographs the rule must also find at 414 (the band was drawn on that box).
const disagree = photos.filter((p) => p.judged.look === 'worst at 414x715' && p.judged.level !== 'clear' && !p.sizes['414x715'].covered).map((p) => `#${p.n} ${p.hash8}`);
const count = (pred) => photos.filter(pred).length;
const totals = {};
for (const s of [...SIZES, 'any']) {
  const on = (p, l) => (s === 'any' ? SIZES.some((z) => p.sizes[z].langs.includes(l)) : p.sizes[s].langs.includes(l));
  const any = (p, ls) => ls.some((l) => on(p, l));
  totals[s] = {
    ...Object.fromEntries(LANGS.map((l) => [l, count((p) => on(p, l))])),
    enAf: count((p) => any(p, ['en', 'af'])),
    all: count((p) => any(p, LANGS)),
    addedByZuXhSt: count((p) => any(p, LANGS) && !any(p, ['en', 'af'])),
    covers: count((p) => any(p, LANGS) && p.judged.level === 'covers'),
    partly: count((p) => any(p, LANGS) && p.judged.level === 'partly'),
    hoursPerWeek: +photos.filter((p) => any(p, LANGS)).reduce((a, p) => a + p.hoursPerWeek, 0).toFixed(1),
  };
}
const anchorCount = Object.fromEntries(SIZES.map((s) => [s, {
  withAnchor: count((p) => p.sizes[s].anchor),
  ...Object.fromEntries(LANGS.map((l) => [l, { foot: count((p) => p.sizes[s].anchor?.[l].footOnJoke), d: count((p) => p.sizes[s].anchor?.[l].dOnJoke) }])),
}]));
const judgedCounts = { covers: count((p) => p.judged.look === 'worst at 414x715' && p.judged.level === 'covers'), partly: count((p) => p.judged.look === 'worst at 414x715' && p.judged.level === 'partly'), clear: count((p) => main[p.n][1] === 'clear'), secondLook: Object.keys(other).length };
const onlySmaller = photos.filter((p) => p.flagged && !p.sizes['414x715'].covered).map((p) => `#${p.n}`);
const risenFlagged = count((p) => p.flagged && p.worst414.risen);
writeFileSync(`${OUT}/data/d-count.json`, JSON.stringify({ rule: 'text box overlaps the judged subject band by >= min(40 px, half the band) on that screen', judgedCounts, totals, anchorCount, disagree, onlySmaller, risenFlagged, photos }, null, 1));
console.log('[d-count] judged at 414 worst:', judgedCounts);
console.log('[d-count] rule disagrees with a 414 judgement on', disagree.length, disagree.join(' '));
for (const s of [...SIZES, 'any']) console.log(`[d-count] ${s}:`, JSON.stringify(totals[s]));
console.log('[d-count] flagged only on a smaller phone:', onlySmaller.length, onlySmaller.join(' '));
console.log('[d-count] anchor count (EVAL §4b way):', JSON.stringify(anchorCount));
