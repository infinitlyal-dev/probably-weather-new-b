// Home check, B (2026-09-25): each photograph's worst case in B, what to look at, and cards to look by.
// D's d-worst.mjs, adapted to B's geometry (review/eval/photo-check/, EVAL.md §4c part 2).
//
//   node review/launch/home-b-check/b-worst.mjs            -> data/b-worst.json, data/b-shots-list.json,
//                                                             shots/frame/<hash8>.png, shots/sheets/sheet-NN.png
//   node review/launch/home-b-check/b-worst.mjs --pairs    -> shots/sheets/look-NN.png (after b-cover-measure --shots)
//
// Worst case = the tallest joke (its text box, not the scrim) any line in any language puts on the
// photograph at a size; ties go to the one reaching furthest into the picture. B never moves the joke
// (no rise): it always sits at the foot of the photograph card, so a taller joke only reaches higher.
//
// Where the photograph is on B's screen: the card (#heroPhoto) is `background-size: cover`, centred,
// at background-position-y = the crop anchor (78% without one) — read off each measured row, because
// the card's height changes with the language and the weather (the data rows under it).
//
// The subject bands are D's (data/d-judged-1.json, d-judged-2.json, d-judged-other.json in
// review/eval/photo-check): in % of D's 414x715 frame, where the photograph filled the screen. Each is
// carried into the photograph's own coordinates (D's geometry) and from there onto B's card.
//
// What to look at (data/b-shots-list.json), all at the worst case:
//   near  — a band exists and B's worst box at 414x715 overlaps it or comes within 40 px (the brief);
//   small — the rule finds the band at 360x688 or 320x488 but not at 414x715 (D's --shots did the same);
//   open  — no band (D judged the photograph clear) and B's worst box at 414x715 reaches more than 3% of
//           the photograph past the box D's eye judged clear (D's own second-look test);
//   far / within — every other photograph's worst case at 414x715, so that all 293 are looked at.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'review/launch/home-b-check';
const D = 'review/eval/photo-check';
const SIZES = ['414x715', '360x688', '320x488'];
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const order = read(`${D}/data/d-order.json`);
const main = Object.fromEntries([...read(`${D}/data/d-judged-1.json`), ...read(`${D}/data/d-judged-2.json`)].map((j) => [j[0], j]));
const other = Object.fromEntries(read(`${D}/data/d-judged-other.json`).map((j) => [j[0], j]));
const DW = read(`${D}/data/d-worst.json`);

// ---------- geometry ----------
// D's frame at 414x715: the photograph covers the whole screen.
const dGeom = (iw, ih, anchor) => { const k = Math.max(414 / iw, 715 / ih); const dh = ih * k; return { dh, offY: (715 - dh) * ((anchor ?? 78) / 100) }; };
// B's card, from a measured row.
const bGeom = (r) => { const cw = r.heroW, ch = r.heroBottom - r.heroTop; const k = Math.max(cw / r.iw, ch / r.ih); const dh = r.ih * k; return { dh, top: r.heroTop + (ch - dh) * (r.bgY / 100) }; };
const toPhotoB = (r, y) => { const g = bGeom(r); return (y - g.top) / g.dh; };
const fromPhotoB = (r, f) => { const g = bGeom(r); return g.top + f * g.dh; };
// D's band (% of D's 414x715 frame) -> fraction of the photograph -> y on B's screen for this row.
const bandPhoto = (r, band) => { const g = dGeom(r.iw, r.ih, r.anchor); return band.map((pct) => ((pct / 100) * 715 - g.offY) / g.dh); };
const bandOnB = (r, band) => bandPhoto(r, band).map((f) => fromPhotoB(r, f));
const overlap = (r, [t, b]) => Math.max(0, Math.min(r.textBottom, b) - Math.max(r.textTop, t));
const gap = (r, [t, b]) => Math.max(t - r.textBottom, r.textTop - b, 0);
const covers = (r, yb) => overlap(r, yb) >= Math.min(40, (yb[1] - yb[0]) / 2);
const tall = (r) => r.textBottom - r.textTop;
const worse = (a, b) => (tall(b) > tall(a) + 0.5 || (Math.abs(tall(b) - tall(a)) <= 0.5 && b.textTop < a.textTop) ? b : a);
const judgedBand = (n) => {
  const m = main[n], x = other[n];
  if (m[1] !== 'clear') return { level: m[1], words: m[2], band: m[3], look: 'D, worst at 414x715' };
  if (x) return { level: x[1], words: x[2], band: x[3], look: 'D, second look' };
  return { level: 'clear', words: m[2], band: null, look: 'D, worst at 414x715' };
};

if (process.argv.includes('--other')) {
  // The second look (D's --other): after my look at 414x715, the photographs whose joke reaches more
  // than 3% of the photograph further on a smaller phone — past everything judged so far (B's worst
  // box at 414x715 and D's) when no band marks a subject, or higher than B's box at 414x715 when a
  // band does and the rule does not find it there. Each goes on the list at that phone, with its
  // tallest line there ('second'); the shots and sheets follow (b-cover-measure --shots --missing,
  // b-worst --pairs second).
  const out = read(`${OUT}/data/b-worst.json`);
  const judged = read(`${OUT}/data/b-judged.json`);
  const jobs = read(`${OUT}/data/b-shots-list.json`).filter((j) => j.why !== 'second');
  const M = Object.fromEntries(SIZES.map((s) => [s, read(`${OUT}/data/b-measure-${s}.json`)]));
  const byHash = Object.fromEntries(SIZES.map((s) => [s, M[s].reduce((m, r) => ((m[r.hash] ||= []).push(r), m), {})]));
  let added = 0;
  for (const o of order) {
    const p = out[o.hash];
    const mine = judged.find((e) => e.n === o.n && e.size === '414x715');
    const banded = !!p.judgedD.band || !!mine?.band;
    const b414 = p.sizes['414x715'].worst;
    const dw = DW[o.hash].sizes['414x715'].worst;
    let pick = null;
    for (const s of ['360x688', '320x488']) {
      if (jobs.some((j) => j.n === o.n && j.size === s)) continue;           // already looked at there
      const w = p.sizes[s].worst;
      const reach = banded
        ? (p.judgedD.band && byHash[s][o.hash].some((r) => covers(r, bandOnB(r, p.judgedD.band))) ? 0 : b414.photoTop - w.photoTop)
        : Math.max(Math.min(b414.photoTop, dw.photoTop) - w.photoTop, w.photoBottom - Math.max(b414.photoBottom, dw.photoBottom));
      if (reach > 0.03 && (!pick || reach > pick.reach)) pick = { s, reach, w };
    }
    if (!pick) continue;
    const row = byHash[pick.s][o.hash].find((r) => r.lang === pick.w.lang && r.line === pick.w.line);
    jobs.push({ n: o.n, hash: o.hash, anchor: p.anchor, folder: p.folder, size: pick.s, why: 'second', lang: pick.w.lang, line: pick.w.line, px: pick.w.px, textTop: pick.w.textTop, textBottom: pick.w.textBottom, band: p.judgedD.band, bandY: p.judgedD.band ? bandOnB(row, p.judgedD.band) : null, level: p.judgedD.level, words: p.judgedD.words, reach: +pick.reach.toFixed(3) });
    added += 1;
  }
  writeFileSync(`${OUT}/data/b-shots-list.json`, JSON.stringify(jobs, null, 1));
  console.log(`[b-worst] second look: ${added} photographs reach further on a smaller phone`);
  process.exit(0);
}

if (process.argv.includes('--third')) {
  // The third look: photographs I judged clear everywhere I looked whose D band the rule still finds
  // on a smaller phone (b-count.mjs, data/b-count.json) — the line with the deepest overlap there
  // ('third'). D's band can take in floor, wall or cushion under the subject; the eye decides.
  const C = read(`${OUT}/data/b-count.json`);
  const jobs = read(`${OUT}/data/b-shots-list.json`).filter((j) => j.why !== 'third');
  const M = Object.fromEntries(SIZES.map((s) => [s, read(`${OUT}/data/b-measure-${s}.json`)]));
  let added = 0;
  for (const p of C.photos) for (const s of ['360x688', '320x488']) {
    const z = p.sizes[s];
    if (!z.covered || z.decided !== 'rule' || !p.eye.length || p.eye.some((e) => e.size === s) || !p.eye.every((e) => e.verdict === 'clear')) continue;
    const row = M[s].find((r) => r.hash === p.hash && r.lang === z.worst.lang && r.line === z.worst.line);
    const w = read(`${OUT}/data/b-worst.json`)[p.hash];
    jobs.push({ n: p.n, hash: p.hash, anchor: p.anchor, folder: p.folder, size: s, why: 'third', lang: row.lang, line: row.line, px: row.px, textTop: row.textTop, textBottom: row.textBottom, band: w.judgedD.band, bandY: bandOnB(row, w.judgedD.band), level: w.judgedD.level, words: w.judgedD.words });
    added += 1;
  }
  writeFileSync(`${OUT}/data/b-shots-list.json`, JSON.stringify(jobs, null, 1));
  console.log(`[b-worst] third look: ${added} photograph × phone`);
  process.exit(0);
}

if (process.argv.includes('--pairs')) {
  // Sheets for looking: the screen (left) and the card (right) of every listed shot, cut just below
  // the joke (the data rows are not what is judged), 2 pairs a row, 3 rows a sheet, in D's
  // numbering; labelled with the number I judge them by.
  // `--pairs second`: only the second look's shots, as second-NN.png.
  const only = process.argv[process.argv.indexOf('--pairs') + 1];   // 'second' | 'third' | undefined
  const jobs = read(`${OUT}/data/b-shots-list.json`).filter((j) => !['second', 'third'].includes(only) || j.why === only);
  const prefix = ['second', 'third'].includes(only) ? only : 'look';
  mkdirSync(`${OUT}/shots/sheets`, { recursive: true });
  const cellW = 330, LABEL = 40, GAP = 10, PAIRS = 2, ROWS = 3, PER = PAIRS * ROWS;
  let sheet = 0;
  for (let s = 0; s * PER < jobs.length; s++) {
    const cells = jobs.slice(s * PER, s * PER + PER);
    const comps = [];
    let W = 0, y = GAP, rowH = 0;
    for (const [i, j] of cells.entries()) {
      if (i && i % PAIRS === 0) { y += rowH + LABEL + GAP; rowH = 0; }
      const [vw, vh] = j.size.split('x').map(Number);
      const cropH = Math.min(vh, j.textBottom + 30);
      const cellH = Math.round(cellW * cropH / vw);
      rowH = Math.max(rowH, cellH);
      const x = GAP + (i % PAIRS) * (2 * cellW + 3 * GAP);
      const name = `${j.hash.slice(0, 8)}-${j.size}`;
      const label = `#${j.n} ${j.hash.slice(0, 8)} ${j.folder} ${j.size} ${j.lang} [${j.why}]`;
      const sub = (j.band ? `D ${j.level}: ${j.words}` : `D clear: ${j.words}`).slice(0, 90);
      const cut = async (f) => sharp(await sharp(f).extract({ left: 0, top: 0, width: vw * 2, height: cropH * 2 }).toBuffer()).resize(cellW, cellH).toBuffer();
      comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${2 * cellW + GAP}" height="${LABEL}"><text x="2" y="16" font-family="Arial" font-size="14" font-weight="bold" fill="#111">${label}</text><text x="2" y="34" font-family="Arial" font-size="12" fill="#444">${sub.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`), left: x, top: y });
      comps.push({ input: await cut(`${OUT}/shots/worst/${name}.jpg`), left: x, top: y + LABEL });
      comps.push({ input: await cut(`${OUT}/shots/card/${name}.jpg`), left: x + cellW + GAP, top: y + LABEL });
      W = Math.max(W, x + 2 * cellW + 2 * GAP);
    }
    sheet += 1;
    await sharp({ create: { width: W, height: y + rowH + LABEL + GAP, channels: 3, background: '#f4f2ec' } }).composite(comps).png().toFile(`${OUT}/shots/sheets/${prefix}-${String(sheet).padStart(2, '0')}.png`);
  }
  console.log(`[b-worst] ${sheet} look sheets for ${jobs.length} shots`);
  process.exit(0);
}

// ---------- worst cases ----------
const M = Object.fromEntries(SIZES.map((s) => [s, read(`${OUT}/data/b-measure-${s}.json`)]));
const byHash = Object.fromEntries(SIZES.map((s) => [s, M[s].reduce((m, r) => ((m[r.hash] ||= []).push(r), m), {})]));
const out = {};
const jobs = [];
for (const o of order) {
  const j = judgedBand(o.n);
  const bySize = {};
  for (const size of SIZES) {
    const rows = byHash[size][o.hash];
    const w = rows.reduce(worse);
    const perLang = {};
    for (const lang of LANGS) {
      const L = rows.filter((r) => r.lang === lang);
      const lw = L.reduce(worse);
      perLang[lang] = { line: lw.line, px: lw.px, textTop: lw.textTop, textBottom: lw.textBottom, heroBottom: lw.heroBottom, photoTop: toPhotoB(lw, lw.textTop), photoBottom: toPhotoB(lw, lw.textBottom), lines: L.length };
    }
    const band = j.band && bandOnB(w, j.band);
    bySize[size] = {
      worst: { lang: w.lang, line: w.line, source: w.source, px: w.px, textTop: w.textTop, textBottom: w.textBottom, heroTop: w.heroTop, heroBottom: w.heroBottom, heroW: w.heroW, bgY: w.bgY, headerBottom: w.headerBottom, photoTop: toPhotoB(w, w.textTop), photoBottom: toPhotoB(w, w.textBottom), share: (w.textBottom - w.textTop) / Number(size.split('x')[1]) },
      // The card on this screen, in the photograph's own coordinates: what B shows of it.
      shows: [toPhotoB(w, w.heroTop), toPhotoB(w, w.heroBottom)],
      band: band && { y: band.map((v) => Math.round(v)), overlapPx: Math.round(overlap(w, band)), gapPx: Math.round(gap(w, band)), rule: covers(w, band) },
      ruleAny: j.band ? rows.some((r) => covers(r, bandOnB(r, j.band))) : false,
      measured: rows.length, perLang,
    };
  }
  const r0 = byHash['414x715'][o.hash][0];
  const p = { n: o.n, hash: o.hash, hash8: o.hash8, folder: r0.folder, anchor: r0.anchor, iw: r0.iw, ih: r0.ih, judgedD: j, sizes: bySize };
  out[o.hash] = p;
  // What to look at.
  const w414 = bySize['414x715'];
  const job = (size, why) => {
    const w = bySize[size].worst;
    const row = byHash[size][o.hash].find((r) => r.lang === w.lang && r.line === w.line);
    jobs.push({ n: o.n, hash: o.hash, anchor: r0.anchor, folder: r0.folder, size, why, lang: w.lang, line: w.line, px: w.px, textTop: w.textTop, textBottom: w.textBottom, band: j.band, bandY: j.band ? bandOnB(row, j.band) : null, level: j.level, words: j.words });
  };
  if (j.band && w414.band.gapPx <= 40) job('414x715', 'near');
  if (j.band && !w414.ruleAny && (bySize['360x688'].ruleAny || bySize['320x488'].ruleAny)) {
    // The smaller phone where the rule finds it, the one with the deeper overlap first.
    const s = ['360x688', '320x488'].filter((z) => bySize[z].ruleAny).sort((a, b) => {
      const ov = (z) => Math.max(...byHash[z][o.hash].map((r) => overlap(r, bandOnB(r, j.band))));
      return ov(b) - ov(a);
    })[0];
    // Its worst case on that phone is the line with the deepest overlap.
    const rows = byHash[s][o.hash];
    const deep = rows.reduce((a, b) => (overlap(b, bandOnB(b, j.band)) > overlap(a, bandOnB(a, j.band)) ? b : a));
    jobs.push({ n: o.n, hash: o.hash, anchor: r0.anchor, folder: r0.folder, size: s, why: 'small', lang: deep.lang, line: deep.line, px: deep.px, textTop: deep.textTop, textBottom: deep.textBottom, band: j.band, bandY: bandOnB(deep, j.band), level: j.level, words: j.words });
  } else if (!j.band) {
    const dw = DW[o.hash].sizes['414x715'].worst;          // the box D's eye judged clear, in the photograph
    const reach = Math.max(dw.photoTop - w414.worst.photoTop, w414.worst.photoBottom - dw.photoBottom);
    p.openReach = reach;
    if (reach > 0.03) job('414x715', 'open');
  }
  // Every other photograph's worst case at Al's size too, so every one is looked at: 'far' when D's
  // band is more than 40 px from B's joke (mostly photographs where D's joke had risen, so D's band
  // marks the top of the picture and B's joke sits at the foot), 'within' when D judged it clear and
  // B's joke stays inside the part of the picture D's eye judged clear.
  if (!jobs.some((x) => x.n === o.n && x.size === '414x715')) job('414x715', j.band ? 'far' : 'within');
}
writeFileSync(`${OUT}/data/b-worst.json`, JSON.stringify(out, null, 1));
writeFileSync(`${OUT}/data/b-shots-list.json`, JSON.stringify(jobs, null, 1));

// ---------- frame cards at Al's size, every photograph, for the sheets ----------
mkdirSync(`${OUT}/shots/frame`, { recursive: true });
mkdirSync(`${OUT}/shots/sheets`, { recursive: true });
const VW = 414, VH = 715;
for (const p of Object.values(out)) {
  const w = p.sizes['414x715'].worst;
  const cw = w.heroW, ch = w.heroBottom - w.heroTop;
  const k = Math.max(cw / p.iw, ch / p.ih);
  const dw = Math.round(p.iw * k), dh = Math.round(p.ih * k);
  const offX = Math.round((dw - cw) / 2), offY = Math.round((dh - ch) * (w.bgY / 100));
  const crop = await sharp(`dist/assets/images/bg-canonical/${p.hash}.webp`).resize(dw, dh).extract({ left: offX, top: offY, width: cw, height: ch }).toBuffer();
  const b = p.sizes['414x715'].band;
  // D's worst box at 414x715 (what D's eye judged), carried through the photograph onto B's card.
  const dBox = DW[p.hash].sizes['414x715'].worst;
  const y = (f) => Math.round(w.heroTop + (ch - p.ih * k) * (w.bgY / 100) + f * p.ih * k);
  const ticks = Array.from({ length: 9 }, (_, i) => { const t = Math.round(VH * (i + 1) / 10); return `<line x1="0" x2="18" y1="${t}" y2="${t}" stroke="#fff" stroke-width="2"/><text x="21" y="${t + 5}" font-family="Arial" font-size="13" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${(i + 1) * 10}</text>`; }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}">
    <rect x="0" y="0" width="${VW}" height="${w.headerBottom}" fill="rgba(0,0,0,0.30)"/>
    <rect x="10" y="${y(dBox.photoTop)}" width="${VW - 20}" height="${y(dBox.photoBottom) - y(dBox.photoTop)}" fill="none" stroke="#ff3bd4" stroke-width="3" stroke-dasharray="10 7"/>
    <rect x="3" y="${w.textTop}" width="${VW - 6}" height="${w.textBottom - w.textTop}" fill="rgba(0,255,136,0.12)" stroke="#00ff88" stroke-width="4"/>
    ${b ? `<path d="M ${VW - 5} ${b.y[0]} h -18 M ${VW - 5} ${b.y[0]} V ${b.y[1]} M ${VW - 5} ${b.y[1]} h -18" stroke="#ff8a00" stroke-width="6" fill="none"/>` : ''}
    ${ticks}
  </svg>`;
  await sharp({ create: { width: VW, height: VH, channels: 3, background: '#14110d' } })
    .composite([{ input: crop, left: 0, top: w.heroTop }, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(`${OUT}/shots/frame/${p.hash8}.png`);
}
const list = Object.values(out);
const cellW = 250, cellH = Math.round(250 * 715 / 414), LABEL = 40, GAP = 10, COLS = 6, PER = 12;
for (let s = 0; s * PER < list.length; s++) {
  const cells = list.slice(s * PER, s * PER + PER);
  const rows = Math.ceil(cells.length / COLS);
  const comps = [];
  for (const [i, p] of cells.entries()) {
    const x = GAP + (i % COLS) * (cellW + GAP), yy = GAP + Math.floor(i / COLS) * (cellH + LABEL + GAP);
    const w = p.sizes['414x715'].worst, b = p.sizes['414x715'].band;
    const label = `#${p.n} ${p.hash8} ${p.folder} ${w.lang} a=${p.anchor ?? '-'}`;
    const sub = b ? `D ${p.judgedD.level} · overlap ${b.overlapPx} · gap ${b.gapPx}` : `D clear, no band`;
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${LABEL}"><text x="2" y="16" font-family="Arial" font-size="14" font-weight="bold" fill="#111">${label}</text><text x="2" y="34" font-family="Arial" font-size="12" fill="#444">${sub}</text></svg>`), left: x, top: yy });
    comps.push({ input: await sharp(`${OUT}/shots/frame/${p.hash8}.png`).resize(cellW, cellH).toBuffer(), left: x, top: yy + LABEL });
  }
  await sharp({ create: { width: COLS * cellW + (COLS + 1) * GAP, height: rows * (cellH + LABEL) + (rows + 1) * GAP, channels: 3, background: '#f4f2ec' } }).composite(comps).png().toFile(`${OUT}/shots/sheets/sheet-${String(s + 1).padStart(2, '0')}.png`);
}
const why = jobs.reduce((m, j) => ((m[j.why] = (m[j.why] || 0) + 1), m), {});
console.log(`[b-worst] ${list.length} photographs; to look at: ${JSON.stringify(why)}; worst joke share of the screen at 414x715: median ${(list.map((p) => p.sizes['414x715'].worst.share).sort((a, b) => a - b)[Math.floor(list.length / 2)] * 100).toFixed(1)}%`);
