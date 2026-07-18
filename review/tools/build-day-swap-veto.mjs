// One-off: before/after montage of the 4 daytime slot-swaps (Al's GATE-1 veto view).
// OLD (removed) | NEW reroll, one row per swap. Usage: node review/tools/build-day-swap-veto.mjs <scratchpadDir>
import sharp from 'sharp';
const SP = process.argv[2];
const CAND = 'review/reroll-candidates';
const CW = 320, CH = 569, GAP = 6, HDR = 34;
const rows = [
  { label: 'rain/day  ->  rain-day-4 (A)',     old: SP + '/displaced-rain-w4d7.webp',   nw: CAND + '/rain-day-4_A.jpg' },
  { label: 'cloudy/day  ->  cloudy-day-2 (A)',  old: SP + '/displaced-cloudy-w4d7.webp', nw: CAND + '/cloudy-day-2_A.jpg' },
  { label: 'cold/day  ->  cold-day-4 (B)',      old: SP + '/displaced-cold-w4d7.webp',   nw: CAND + '/cold-day-4_B.jpg' },
  { label: 'cold/day  ->  cold-day-10 (B)',     old: SP + '/displaced-cold-w3d7.webp',   nw: CAND + '/cold-day-10_B.jpg' },
];
const W = CW * 2 + GAP * 3, RH = HDR + CH + GAP, H = RH * rows.length + GAP;
const hdr = (t) => Buffer.from(`<svg width="${W}" height="${HDR}"><rect width="100%" height="100%" fill="#12141a"/><text x="8" y="23" font-family="sans-serif" font-size="16" font-weight="700" fill="#ffd24a">OLD (removed)    |    NEW reroll   —   ${t}</text></svg>`);
const comp = [];
let y = GAP;
for (const r of rows) {
  comp.push({ input: hdr(r.label), top: y, left: GAP });
  comp.push({ input: await sharp(r.old).resize(CW, CH, { fit: 'cover' }).toBuffer(), top: y + HDR, left: GAP });
  comp.push({ input: await sharp(r.nw).resize(CW, CH, { fit: 'cover' }).toBuffer(), top: y + HDR, left: GAP * 2 + CW });
  y += RH;
}
await sharp({ create: { width: W, height: H, channels: 3, background: { r: 18, g: 20, b: 26 } } }).composite(comp).jpeg({ quality: 86 }).toFile(SP + '/day-swap-veto.jpg');
console.log('wrote day-swap-veto.jpg', W + 'x' + H);
