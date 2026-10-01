// Home check, B (2026-09-25): how many photographs B's joke covers, by language and phone size —
// D's d-count.mjs, same bands, same rule, B's geometry (review/eval/photo-check/, EVAL.md §4c part 2).
//
//   node review/launch/home-b-check/b-count.mjs   -> data/b-count.json
//
// The bands are D's (d-judged-1.json, d-judged-2.json, d-judged-other.json): each marks a
// photograph's subject, in % of D's 414x715 frame (the photograph filled the screen). A band is
// carried into the photograph's own coordinates and onto B's card for every measured row (the card's
// height changes with language and weather). A line counts as covering the subject when its text box
// overlaps the band by at least min(40 px, half the band) on that screen — D's rule, unchanged.
// "Sits on" = the photograph's subject judged covered; "touches" = judged partly covered, faces clear
// (D's "partly"). The level is D's unless my own look at B (data/b-judged.json) says otherwise.
//
// My look at B (data/b-judged.json, one entry per photograph and screen looked at): verdict
// 'covers' | 'partly' | 'clear' for the joke I looked at on that screen, a short note, and — only where
// B's joke sits on something D's bands do not mark (D's joke never went there: it had risen, or sat
// lower) — band, that subject's y range in px on the screen I looked at. It is carried into the
// photograph like D's and counted by the same rule, beside D's band.
// Where the look disagrees with the rule on that screen, the look decides that screen:
//   rule finds it, look says clear  -> not counted on that screen (any language);
//   rule misses it, look says on it -> counted for every language whose text reaches as far into the
//                                      band as the line I looked at.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OUT = 'review/launch/home-b-check';
const D = 'review/eval/photo-check';
const SIZES = ['414x715', '360x688', '320x488'];
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const order = read(`${D}/data/d-order.json`);
const main = Object.fromEntries([...read(`${D}/data/d-judged-1.json`), ...read(`${D}/data/d-judged-2.json`)].map((j) => [j[0], j]));
const other = Object.fromEntries(read(`${D}/data/d-judged-other.json`).map((j) => [j[0], j]));
const DC = read(`${D}/data/d-count.json`);
const look = existsSync(`${OUT}/data/b-judged.json`) ? read(`${OUT}/data/b-judged.json`) : [];
const lookAt = (n, size) => look.find((x) => x.n === n && x.size === size);
const rows = Object.fromEntries(SIZES.map((s) => [s, read(`${OUT}/data/b-measure-${s}.json`)]));
const byHash = Object.fromEntries(SIZES.map((s) => [s, rows[s].reduce((m, r) => ((m[r.hash] ||= []).push(r), m), {})]));

// ---------- geometry (as b-worst.mjs) ----------
const dGeom = (iw, ih, anchor) => { const k = Math.max(414 / iw, 715 / ih); const dh = ih * k; return { dh, offY: (715 - dh) * ((anchor ?? 78) / 100) }; };
const bGeom = (r) => { const cw = r.heroW, ch = r.heroBottom - r.heroTop; const k = Math.max(cw / r.iw, ch / r.ih); const dh = r.ih * k; return { dh, top: r.heroTop + (ch - dh) * (r.bgY / 100) }; };
const toPhotoB = (r, y) => { const g = bGeom(r); return (y - g.top) / g.dh; };
const fromPhotoB = (r, f) => { const g = bGeom(r); return g.top + f * g.dh; };
const dBandToPhoto = (r, band) => { const g = dGeom(r.iw, r.ih, r.anchor); return band.map((pct) => ((pct / 100) * 715 - g.offY) / g.dh); };
const overlap = (r, [t, b]) => Math.max(0, Math.min(r.textBottom, b) - Math.max(r.textTop, t));
const need = ([t, b]) => Math.min(40, (b - t) / 2);
const tall = (r) => r.textBottom - r.textTop;
const worse = (a, b) => (tall(b) > tall(a) + 0.5 || (Math.abs(tall(b) - tall(a)) <= 0.5 && b.textTop < a.textTop) ? b : a);

const photos = [];
for (const o of order) {
  const m = main[o.n], x = other[o.n];
  const j = m[1] !== 'clear' ? { level: m[1], words: m[2], band: m[3], look: 'D, worst at 414x715' }
    : x ? { level: x[1], words: x[2], band: x[3], look: 'D, second look' }
    : { level: 'clear', words: m[2], band: null, look: 'D, worst at 414x715' };
  const R414 = byHash['414x715'][o.hash];
  const eyes = look.filter((e) => e.n === o.n);
  const seenRow = (e) => { const R = byHash[e.size][o.hash]; return R.find((r) => r.lang === e.lang && r.line === e.line) || R.reduce(worse); };
  // The subjects, in the photograph's own coordinates (fractions of its height): D's band, and mine
  // where B's joke sits on something D's joke never reached (e.band: px on the screen I looked at).
  const bands = [];
  if (j.band) bands.push({ from: 'D', f: dBandToPhoto(R414[0], j.band) });
  for (const e of eyes) if (e.band) bands.push({ from: 'mine', f: e.band.map((y) => toPhotoB(seenRow(e), y)) });
  const ybOf = (r, b) => b.f.map((f) => fromPhotoB(r, f));
  const ruleHit = (r) => bands.some((b) => { const yb = ybOf(r, b); return overlap(r, yb) >= need(yb); });
  const bestOv = (r) => Math.max(0, ...bands.map((b) => overlap(r, ybOf(r, b))));
  // Sits on or touches: my look at B (Al's size first), else D's judgement of the band.
  const level = SIZES.map((s) => lookAt(o.n, s)).find((e) => e && e.verdict !== 'clear')?.verdict ?? j.level;
  const sizes = {};
  for (const s of SIZES) {
    const R = byHash[s][o.hash];
    let hit = bands.length ? R.filter(ruleHit) : [];
    const eye = lookAt(o.n, s);
    let decided = 'rule';
    if (eye) {
      const seen = seenRow(eye);
      if (eye.verdict === 'clear') { decided = hit.length ? 'look: clear (rule found it)' : 'look agrees (clear)'; hit = []; }
      else if (!ruleHit(seen)) {
        const ov = bestOv(seen);
        hit = R.filter((r) => ruleHit(r) || (ov > 0 && bestOv(r) >= ov));
        decided = `look: ${eye.verdict} (rule missed it, ${Math.round(ov)} px into the band)`;
      } else decided = `look agrees (${eye.verdict})`;
    }
    const worst = hit.length ? hit.reduce((a, b) => (bestOv(b) > bestOv(a) + 0.5 || (Math.abs(bestOv(b) - bestOv(a)) <= 0.5 && tall(b) > tall(a)) ? b : a)) : null;
    // How much of the subject (D's band) B's card shows on this screen; the rest is cropped off it.
    const w = R.reduce(worse);
    const dBand = bands.find((b) => b.from === 'D');
    const shown = dBand ? (() => { const [t, b] = ybOf(w, dBand); return Math.max(0, Math.min(b, w.heroBottom) - Math.max(t, w.heroTop)) / (b - t); })() : null;
    sizes[s] = {
      covered: hit.length > 0,
      langs: LANGS.filter((l) => hit.some((r) => r.lang === l)),
      lines: hit.length, of: R.length, decided,
      subjectShown: shown == null ? null : +shown.toFixed(2),
      worst: worst && { lang: worst.lang, line: worst.line, source: worst.source, px: worst.px, textTop: worst.textTop, textBottom: worst.textBottom, overlapPx: Math.round(bestOv(worst)) },
    };
  }
  const w = R414.reduce(worse);
  photos.push({
    n: o.n, hash: o.hash, hash8: o.hash8, folder: w.folder, anchor: w.anchor,
    judgedD: { level: j.level, words: j.words, band: j.band, look: j.look }, level,
    addedBand: bands.some((b) => b.from === 'mine'),
    eye: eyes.map((e) => ({ size: e.size, verdict: e.verdict, note: e.note, band: e.band || null })),
    worst414: { lang: w.lang, line: w.line, source: w.source, px: w.px, share: tall(w) / 715 },
    sizes, flagged: SIZES.some((s) => sizes[s].covered),
  });
}

const hours = Object.fromEntries(read(`${D}/data/rotation.json`).photos.map((p) => [p.hash, p.hoursPerWeek]));
const count = (pred) => photos.filter(pred).length;
const totals = {};
for (const s of [...SIZES, 'any']) {
  const on = (p, l) => (s === 'any' ? SIZES.some((z) => p.sizes[z].langs.includes(l)) : p.sizes[s].langs.includes(l));
  const any = (p, ls) => ls.some((l) => on(p, l));
  const pair = (ls) => [count((p) => any(p, ls) && p.level === 'covers'), count((p) => any(p, ls))];
  totals[s] = {
    ...Object.fromEntries(LANGS.map((l) => [l, pair([l])])),
    enAf: pair(['en', 'af']),
    all: pair(LANGS),
    addedByZuXhSt: count((p) => any(p, LANGS) && !any(p, ['en', 'af'])),
    sitsOn: count((p) => any(p, LANGS) && p.level === 'covers'),
    touches: count((p) => any(p, LANGS) && p.level === 'partly'),
    clear: count((p) => !any(p, LANGS)),
    hoursPerWeek: +photos.filter((p) => any(p, LANGS)).reduce((a, p) => a + hours[p.hash], 0).toFixed(1),
  };
}
// D beside it, from D's own count (review/eval/photo-check/data/d-count.json), in the same shape.
const dTotals = {};
for (const s of [...SIZES, 'any']) {
  const on = (p, l) => (s === 'any' ? SIZES.some((z) => p.sizes[z].langs.includes(l)) : p.sizes[s].langs.includes(l));
  const any = (p, ls) => ls.some((l) => on(p, l));
  const pair = (ls) => [DC.photos.filter((p) => any(p, ls) && p.judged.level === 'covers').length, DC.photos.filter((p) => any(p, ls)).length];
  dTotals[s] = { ...Object.fromEntries(LANGS.map((l) => [l, pair([l])])), enAf: pair(['en', 'af']), all: pair(LANGS) };
}
const looked = look.length;
const disagree = photos.flatMap((p) => SIZES.filter((s) => p.sizes[s].decided.startsWith('look:')).map((s) => `#${p.n} ${p.hash8} ${s}: ${p.sizes[s].decided}`));
const newBands = photos.filter((p) => p.addedBand).map((p) => `#${p.n} ${p.hash8}${p.judgedD.band ? ' (D banded another part)' : ''}`);
const onlySmaller = photos.filter((p) => p.flagged && !p.sizes['414x715'].covered).map((p) => `#${p.n}`);
const cropped = Object.fromEntries(SIZES.map((s) => [s, count((p) => p.sizes[s].subjectShown != null && p.sizes[s].subjectShown < 0.5)]));
const banded = count((p) => p.sizes['414x715'].subjectShown != null);
writeFileSync(`${OUT}/data/b-count.json`, JSON.stringify({ rule: 'text box overlaps the judged subject band by >= min(40 px, half the band) on that screen (D\'s rule); bands D\'s; B\'s card geometry per row', looked, disagree, newBands, onlySmaller, bandedPhotographs: banded, subjectMostlyOffB: cropped, totals, dTotals, photos }, null, 1));
console.log(`[b-count] looked at ${looked} (photograph × screen); look overrode the rule on ${disagree.length}: ${disagree.join(' | ')}`);
console.log(`[b-count] bands added where D had none: ${newBands.length} ${newBands.join(' ')}`);
for (const s of [...SIZES, 'any']) console.log(`[b-count] B ${s}:`, JSON.stringify(totals[s]));
for (const s of [...SIZES, 'any']) console.log(`[b-count] D ${s}:`, JSON.stringify(dTotals[s]));
console.log('[b-count] flagged only on a smaller phone:', onlySmaller.length, onlySmaller.join(' '));
console.log(`[b-count] of ${banded} banded photographs, subject mostly (>half) off B's card:`, JSON.stringify(cropped));
