// Contact sheet: lay screenshots out in a grid with a label over each (sharp; no browser).
//   node review/eval/scripts/sheet.mjs <out.png> <cols> <width-per-cell> "<label>=<path>" ...
import sharp from 'sharp';
const [out, colsArg, cellArg, ...items] = process.argv.slice(2);
const cols = Number(colsArg), cellW = Number(cellArg);
const cells = [];
for (const it of items) {
  const i = it.indexOf('=');
  const label = it.slice(0, i), file = it.slice(i + 1);
  const img = sharp(file).resize({ width: cellW });
  const buf = await img.png().toBuffer();
  const meta = await sharp(buf).metadata();
  cells.push({ label, buf, h: meta.height });
}
const LABEL = 34, GAP = 16;
const rows = Math.ceil(cells.length / cols);
const rowH = [];
for (let r = 0; r < rows; r++) rowH.push(Math.max(...cells.slice(r * cols, r * cols + cols).map((c) => c.h)) + LABEL);
const W = cols * cellW + (cols + 1) * GAP;
const H = rowH.reduce((a, b) => a + b, 0) + (rows + 1) * GAP;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const composites = [];
let y = GAP;
for (let r = 0; r < rows; r++) {
  cells.slice(r * cols, r * cols + cols).forEach((c, k) => {
    const x = GAP + k * (cellW + GAP);
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${LABEL}"><text x="2" y="24" font-family="Segoe UI, Arial" font-size="20" font-weight="600" fill="#1d1d1b">${esc(c.label)}</text></svg>`);
    composites.push({ input: svg, left: x, top: y });
    composites.push({ input: c.buf, left: x, top: y + LABEL });
  });
  y += rowH[r] + GAP;
}
await sharp({ create: { width: W, height: H, channels: 3, background: '#f4f2ec' } }).composite(composites).png().toFile(out);
console.log(`[sheet] ${cells.length} cells → ${out} (${W}x${H})`);
