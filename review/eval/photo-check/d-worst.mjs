// Photo check, part 2 (2026-09-24): each photograph's worst case, and a frame card to judge it by.
//
//   node review/eval/photo-check/d-worst.mjs            -> data/d-worst.json + shots/frame/<hash8>.png
//   node review/eval/photo-check/d-worst.mjs --sheets   -> shots/sheets/sheet-NN.png (12 frames each)
//
// Worst case = the tallest joke (its text box, not the fade) any line in any language puts on the
// photograph at a size; ties go to the one reaching furthest into the picture. The frame card is the
// bare photograph exactly as D crops it at 414x715 (cover, Al's crop anchor or the 78% default), with
// the worst joke box outlined in green, the worst box of the other placement (risen or at the foot)
// dashed in magenta when there is one, and height ticks every 10% down the left edge.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'review/eval/photo-check';
const SIZES = ['414x715', '360x688', '320x488'];
const M = Object.fromEntries(SIZES.map((s) => [s, JSON.parse(readFileSync(`${OUT}/data/d-measure-${s}.json`, 'utf8'))]));
const rot = JSON.parse(readFileSync(`${OUT}/data/rotation.json`, 'utf8'));
const photos = Object.fromEntries(rot.photos.map((p) => [p.hash, p]));
const tall = (r) => r.textBottom - r.textTop;
const worse = (a, b) => (tall(b) > tall(a) + 0.5 || (Math.abs(tall(b) - tall(a)) <= 0.5 && (b.risen ? b.textBottom > a.textBottom : b.textTop < a.textTop)) ? b : a);
// Screen y -> fraction of the photograph's height, for a size and a photograph.
const toPhoto = (size, r, y) => {
  const [vw, vh] = size.split('x').map(Number);
  const k = Math.max(vw / r.iw, vh / r.ih);
  const dh = r.ih * k;
  const P = r.anchor ?? 78;
  const offY = (vh - dh) * (P / 100);
  return (y - offY) / dh;
};

if (process.argv.includes('--other')) {
  // The second look: photographs judged clear at 414x715 whose joke reaches further (>3% of the
  // photograph) at another size or in the other placement. Every such box is mapped onto the same
  // 414x715 crop through the photograph's own coordinates: green = the 414 worst already judged,
  // yellow = 360x688, red = 320x488; solid = that size's worst, dashed = the other placement.
  const out = JSON.parse(readFileSync(`${OUT}/data/d-worst.json`, 'utf8'));
  const order = JSON.parse(readFileSync(`${OUT}/data/d-order.json`, 'utf8'));
  const judged = Object.fromEntries([1, 2].flatMap((i) => JSON.parse(readFileSync(`${OUT}/data/d-judged-${i}.json`, 'utf8'))).map((j) => [j[0], j]));
  const VW = 414, VH = 715, COLOR = { '414x715': '#00ff88', '360x688': '#ffd400', '320x488': '#ff3030' };
  const picks = [];
  for (const o of order) {
    const p = out[o.hash];
    if (judged[o.n][1] !== 'clear') continue;
    const w = p.sizes['414x715'].worst;
    const boxes = SIZES.flatMap((s) => ['worst', 'worstFoot', 'worstRisen'].map((k) => p.sizes[s][k] && { s, k, b: p.sizes[s][k] })).filter(Boolean);
    const reach = Math.max(...boxes.map(({ b }) => Math.max(w.photoTop - b.photoTop, b.photoBottom - w.photoBottom)));
    if (reach > 0.03) picks.push({ o, p, boxes });
  }
  mkdirSync(`${OUT}/shots/other`, { recursive: true });
  for (const { o, p, boxes } of picks) {
    const k = Math.max(VW / p.iw, VH / p.ih);
    const dw = Math.round(p.iw * k), dh = Math.round(p.ih * k);
    const offX = Math.round((dw - VW) / 2), offY = Math.round((dh - VH) * ((p.anchor ?? 78) / 100));
    const base = await sharp(`dist/assets/images/bg-canonical/${p.hash}.webp`).resize(dw, dh).extract({ left: offX, top: offY, width: VW, height: VH }).toBuffer();
    const y = (f) => Math.round(f * dh - offY);
    const seen = new Set();
    const rects = boxes.filter(({ s, b }) => { const key = `${s}${b.photoTop.toFixed(3)}${b.photoBottom.toFixed(3)}`; return !seen.has(key) && seen.add(key); })
      .map(({ s, k: kind, b }, i) => `<rect x="${4 + i * 5}" y="${y(b.photoTop)}" width="${VW - 8 - i * 10}" height="${y(b.photoBottom) - y(b.photoTop)}" fill="none" stroke="${COLOR[s]}" stroke-width="3"${kind === 'worst' ? '' : ' stroke-dasharray="9 6"'}/>`).join('');
    const ticks = Array.from({ length: 9 }, (_, i) => { const t = Math.round(VH * (i + 1) / 10); return `<line x1="0" x2="18" y1="${t}" y2="${t}" stroke="#fff" stroke-width="2"/><text x="21" y="${t + 5}" font-family="Arial" font-size="13" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${(i + 1) * 10}</text>`; }).join('');
    await sharp(base).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}">${rects}${ticks}</svg>`) }]).png().toFile(`${OUT}/shots/other/${o.hash8}.png`);
  }
  const cellW = 250, cellH = Math.round(250 * 715 / 414), LABEL = 22, GAP = 10, COLS = 6, PER = 12;
  for (let s = 0; s * PER < picks.length; s++) {
    const cells = picks.slice(s * PER, s * PER + PER);
    const rows = Math.ceil(cells.length / COLS);
    const comps = [];
    for (const [i, { o }] of cells.entries()) {
      const x = GAP + (i % COLS) * (cellW + GAP), yy = GAP + Math.floor(i / COLS) * (cellH + LABEL + GAP);
      comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${LABEL}"><text x="2" y="16" font-family="Arial" font-size="14" font-weight="bold" fill="#111">#${o.n} ${o.hash8} ${o.folder}</text></svg>`), left: x, top: yy });
      comps.push({ input: await sharp(`${OUT}/shots/other/${o.hash8}.png`).resize(cellW, cellH).toBuffer(), left: x, top: yy + LABEL });
    }
    await sharp({ create: { width: COLS * cellW + (COLS + 1) * GAP, height: rows * (cellH + LABEL) + (rows + 1) * GAP, channels: 3, background: '#f4f2ec' } }).composite(comps).png().toFile(`${OUT}/shots/sheets/other-${String(s + 1).padStart(2, '0')}.png`);
  }
  console.log(`[d-worst] second look: ${picks.length} photographs judged clear reach further at another size or placement; ${Math.ceil(picks.length / PER)} sheets`);
} else if (!process.argv.includes('--sheets')) {
  const out = {};
  for (const hash of Object.keys(photos)) {
    const bySize = {};
    for (const size of SIZES) {
      const rows = M[size].filter((r) => r.hash === hash);
      const worst = rows.reduce(worse);
      const foot = rows.filter((r) => !r.risen);
      const risen = rows.filter((r) => r.risen);
      const perLang = {};
      for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
        const L = rows.filter((r) => r.lang === lang);
        if (L.length) {
          const w = L.reduce(worse);
          perLang[lang] = { line: w.line, risen: w.risen, textTop: w.textTop, textBottom: w.textBottom, photoTop: toPhoto(size, w, w.textTop), photoBottom: toPhoto(size, w, w.textBottom), lines: L.length, risenLines: L.filter((r) => r.risen).length };
        }
      }
      const pick = (r) => r && ({ lang: r.lang, line: r.line, source: r.source, risen: r.risen, px: r.px, textTop: r.textTop, textBottom: r.textBottom, statusBottom: r.statusBottom, lineTop: r.lineTop, photoTop: toPhoto(size, r, r.textTop), photoBottom: toPhoto(size, r, r.textBottom), share: (r.textBottom - r.textTop) / Number(size.split('x')[1]) });
      bySize[size] = {
        worst: pick(worst),
        worstFoot: pick(foot.length ? foot.reduce(worse) : null),
        worstRisen: pick(risen.length ? risen.reduce(worse) : null),
        measured: rows.length, risen: risen.length, perLang,
      };
    }
    const r0 = M['414x715'].find((r) => r.hash === hash);
    out[hash] = { hash, folder: r0.folder, anchor: r0.anchor, iw: r0.iw, ih: r0.ih, hoursPerWeek: photos[hash].hoursPerWeek, slots: photos[hash].slots, ownEn: photos[hash].ownEn, sizes: bySize };
  }
  writeFileSync(`${OUT}/data/d-worst.json`, JSON.stringify(out, null, 1));

  // Frame cards at Al's size.
  mkdirSync(`${OUT}/shots/frame`, { recursive: true });
  const VW = 414, VH = 715;
  for (const p of Object.values(out)) {
    const w = p.sizes['414x715'];
    const k = Math.max(VW / p.iw, VH / p.ih);
    const dw = Math.round(p.iw * k), dh = Math.round(p.ih * k);
    const offX = Math.round((dw - VW) / 2), offY = Math.round((dh - VH) * ((p.anchor ?? 78) / 100));
    const base = await sharp(`dist/assets/images/bg-canonical/${p.hash}.webp`).resize(dw, dh).extract({ left: offX, top: offY, width: VW, height: VH }).toBuffer();
    const other = w.worst.risen ? w.worstFoot : w.worstRisen;
    const ticks = Array.from({ length: 9 }, (_, i) => { const y = Math.round(VH * (i + 1) / 10); return `<line x1="0" x2="18" y1="${y}" y2="${y}" stroke="#fff" stroke-width="2"/><text x="21" y="${y + 5}" font-family="Arial" font-size="13" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${(i + 1) * 10}</text>`; }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}">
      <rect x="3" y="${w.worst.textTop}" width="${VW - 6}" height="${w.worst.textBottom - w.worst.textTop}" fill="rgba(0,255,136,0.12)" stroke="#00ff88" stroke-width="4"/>
      ${other ? `<rect x="10" y="${other.textTop}" width="${VW - 20}" height="${other.textBottom - other.textTop}" fill="none" stroke="#ff3bd4" stroke-width="3" stroke-dasharray="10 7"/>` : ''}
      <rect x="0" y="0" width="${VW}" height="${w.worst.statusBottom}" fill="rgba(0,0,0,0.25)"/>
      ${ticks}
    </svg>`;
    await sharp(base).composite([{ input: Buffer.from(svg) }]).png().toFile(`${OUT}/shots/frame/${p.hash.slice(0, 8)}.png`);
  }
  const all = Object.values(out);
  console.log(`[d-worst] ${all.length} photographs; worst case risen on ${all.filter((p) => p.sizes['414x715'].worst.risen).length}; some line risen on ${all.filter((p) => p.sizes['414x715'].risen > 0).length}; worst joke share of the screen at 414x715: median ${(all.map((p) => p.sizes['414x715'].worst.share).sort((a, b) => a - b)[Math.floor(all.length / 2)] * 100).toFixed(1)}%`);
} else {
  // Sheets for looking: 12 frames each, most-shown first, labelled with the number I judge them by.
  const out = JSON.parse(readFileSync(`${OUT}/data/d-worst.json`, 'utf8'));
  const list = Object.values(out).sort((a, b) => b.hoursPerWeek - a.hoursPerWeek || a.hash.localeCompare(b.hash));
  mkdirSync(`${OUT}/shots/sheets`, { recursive: true });
  const cellW = 250, cellH = Math.round(250 * 715 / 414), LABEL = 40, GAP = 10, COLS = 6, PER = 12;
  for (let s = 0; s * PER < list.length; s++) {
    const cells = list.slice(s * PER, s * PER + PER);
    const rows = Math.ceil(cells.length / COLS);
    const W = COLS * cellW + (COLS + 1) * GAP, H = rows * (cellH + LABEL) + (rows + 1) * GAP;
    const comps = [];
    for (const [i, p] of cells.entries()) {
      const x = GAP + (i % COLS) * (cellW + GAP), y = GAP + Math.floor(i / COLS) * (cellH + LABEL + GAP);
      const w = p.sizes['414x715'].worst;
      const n = s * PER + i + 1;
      const label = `#${n} ${p.hash.slice(0, 8)} ${p.folder} ${w.lang}${w.risen ? ' RISEN' : ''} a=${p.anchor ?? '-'}`;
      comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${LABEL}"><text x="2" y="16" font-family="Arial" font-size="14" font-weight="bold" fill="#111">${label}</text><text x="2" y="34" font-family="Arial" font-size="12" fill="#444">${p.hoursPerWeek.toFixed(1)} h/wk · ${(w.share * 100).toFixed(0)}% of screen</text></svg>`), left: x, top: y });
      comps.push({ input: await sharp(`${OUT}/shots/frame/${p.hash.slice(0, 8)}.png`).resize(cellW, cellH).toBuffer(), left: x, top: y + LABEL });
    }
    await sharp({ create: { width: W, height: H, channels: 3, background: '#f4f2ec' } }).composite(comps).png().toFile(`${OUT}/shots/sheets/sheet-${String(s + 1).padStart(2, '0')}.png`);
  }
  writeFileSync(`${OUT}/data/d-order.json`, JSON.stringify(list.map((p, i) => ({ n: i + 1, hash: p.hash, hash8: p.hash.slice(0, 8), folder: p.folder })), null, 1));
  console.log(`[d-worst] ${Math.ceil(list.length / PER)} sheets`);
}
