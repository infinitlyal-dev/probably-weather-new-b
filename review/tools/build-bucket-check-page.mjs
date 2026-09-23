// Bucket check (2026-09-23, Job 3): every one of the 294 photographs was viewed on
// output/bucket-sheets/ against the bucket it is filed in. The ones whose look
// contradicts the bucket are listed here for Al — flag only, nothing moves.
//
//   node review/tools/build-bucket-check-page.mjs
// Reads  review/bucket-check-photos.json (node review/tools/build-bucket-sheets.mjs)
//        assets/hero-lines.js (the lines that would travel with a moved photograph)
// Writes review/bucket-check.html  → Al exports review/bucket-check-ruled.json
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { photos } = JSON.parse(readFileSync(path.join(root, 'review', 'bucket-check-photos.json'), 'utf8'));
const { HERO_LINES } = await import(pathToFileURL(path.join(root, 'assets', 'hero-lines.js')).href);

// n = the photograph's number on the contact sheets.
const FLAGS = [
  { n: 58, level: 'likely', suggest: 'cold', wrong: 'Dog in a grey jumper on a stoep, mountains at dusk. Served 22 Sept under "Partly cloudy." on a 30° day.', note: 'You ruled this cold on 22 Sept. It is benched already; its move has its own page, review/cold-move-dog.html.' },
  { n: 66, level: 'likely', suggest: 'cold', wrong: 'A cat asleep in a knitted jumper under a blanket by a lamp: the same winter cue as the dog, in a bucket that also serves warm cloudy nights.' },
  { n: 90, level: 'likely', suggest: 'cold-clear', wrong: 'Bright blue sky over snow-capped peaks, washing drying in the sun. Cold is served on grey or wet cold days; blue-sky cold is cold-clear.' },
  { n: 79, level: 'likely', suggest: 'rain', wrong: 'Rain falling, an umbrella up, a "road closed due to rain" sign. In cold it can show rain on a dry cold day.' },
  { n: 195, level: 'likely', suggest: 'clear', wrong: 'Blue sky and a golden sunrise; only the street is wet. In rain it sits under "Rain\'s here." with the sun out.' },
  { n: 229, level: 'likely', suggest: 'cloudy', wrong: 'A clear sunset sky over a dusty farm road; the storm is only a distant cloud bank. No lightning, no rain.' },
  { n: 40, level: 'possible', suggest: 'cold', wrong: 'Jacket, flat cap and a steaming mug; its own line says Joburg mornings under cloud start at about four degrees.' },
  { n: 69, level: 'possible', suggest: 'cold', wrong: 'Friends in blankets and knitted jumpers around a lantern; one of its lines says the evening is cold.' },
  { n: 70, level: 'possible', suggest: 'cold', wrong: 'A man in a puffer jacket on a rooftop at night. Cloudy also serves warm summer nights.' },
  { n: 203, level: 'possible', suggest: 'wind', wrong: 'A wave breaking over the harbour wall, raincoats, no rain visibly falling. Reads as wind; its lines say it is raining.' },
];
const BUCKETS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];

const rows = FLAGS.map((f) => {
  const p = photos[f.n - 1];
  if (!p || p.n !== f.n) throw new Error(`photo #${f.n} missing`);
  return { ...f, sha1: p.sha1, sha256: p.sha256, bucket: p.bucket, time: p.time, image: p.image, slots: p.slots, lines: HERO_LINES[`bg-canonical/${p.sha256}.webp`] || [] };
});
const likely = rows.filter((r) => r.level === 'likely').length;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bucket check</title>
<style>
:root { --bg:#f7f6f2; --fg:#1d1d1b; --muted:#6b6a64; --line:#dddbd2; --card:#fff; --accent:#1f5f8b; --cut:#a5452b; --keep:#2e7d4f; --warn:#b07a12; }
@media (prefers-color-scheme: dark) { :root { --bg:#161614; --fg:#ecebe6; --muted:#a3a29b; --line:#34332f; --card:#1f1f1c; --accent:#7fb6dd; --cut:#e08a6e; --keep:#7ccf9c; --warn:#e3b34f; } }
* { box-sizing: border-box; }
body { margin:0; padding:16px 16px 40px; background:var(--bg); color:var(--fg); font:15px/1.4 system-ui, sans-serif; }
h1 { font-size:20px; margin:0 0 4px; }
.sub { color:var(--muted); margin:0 0 14px; max-width:1000px; }
.grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:12px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:7px; }
.card img { width:100%; height:420px; object-fit:contain; background:#000; border-radius:6px; }
.meta { display:flex; justify-content:space-between; gap:8px; font-size:13px; color:var(--muted); }
.lvl { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
.lvl.likely { color:var(--cut); } .lvl.possible { color:var(--warn); }
.bucket { font-weight:700; }
.note { font-size:13px; color:var(--accent); }
details { font-size:13px; color:var(--muted); } details ul { margin:4px 0 0; padding-left:18px; }
.toggle { display:flex; gap:6px; }
.toggle button { flex:1; font:inherit; padding:8px; border-radius:7px; border:1px solid var(--line); background:transparent; color:var(--fg); cursor:pointer; }
.toggle button.on.KEEP { background:var(--keep); color:#fff; border-color:var(--keep); }
.toggle button.on.MOVE { background:var(--cut); color:#fff; border-color:var(--cut); }
.to { display:flex; gap:6px; align-items:center; font-size:14px; }
.to select, .card input { font:inherit; padding:6px; border-radius:7px; border:1px solid var(--line); background:var(--card); color:var(--fg); }
.card input { width:100%; }
.bar { position:sticky; bottom:0; margin-top:16px; padding:10px 0; background:var(--bg); display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.bar button { font:inherit; padding:9px 16px; border-radius:7px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; }
.bar span { color:var(--muted); }
</style>
</head>
<body>
<h1>Bucket check — ${rows.length} of 294 photographs flagged</h1>
<p class="sub">Every photograph in the rotation was looked at against the bucket it is filed in. These ${rows.length} contradict it: ${likely} clearly, ${rows.length - likely} possibly. Nothing moves from this page. MOVE says “re-file it”; the bucket box is where. A moved photograph takes its lines with it, so they are listed. Save the export as <code>review\\bucket-check-ruled.json</code>.</p>
<div class="grid" id="grid"></div>
<div class="bar"><button id="export" type="button">Export bucket-check-ruled.json</button><span id="count"></span></div>
<script>
const ROWS = ${JSON.stringify(rows)};
const BUCKETS = ${JSON.stringify(BUCKETS)};
const LS = 'pw-bucket-check-20260923';
let state = {};
try { state = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { state = {}; }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function render() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (const r of ROWS) {
    const s = state[r.sha1] || {};
    const to = s.moveTo || r.suggest;
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML =
      '<div class="meta"><span>#' + r.n + ' · ' + r.sha1 + ' · ' + r.slots.length + ' slots</span><span class="lvl ' + r.level + '">' + r.level + '</span></div>' +
      '<img loading="lazy" src="../assets/images/bg/' + r.image + '" alt="">' +
      '<div>Filed in <span class="bucket">' + r.bucket + '</span> · ' + r.time + '</div>' +
      '<div>' + esc(r.wrong) + '</div>' +
      (r.note ? '<div class="note">' + esc(r.note) + '</div>' : '') +
      '<details><summary>' + r.lines.length + ' line(s) go with it</summary><ul>' + r.lines.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul></details>' +
      '<div class="toggle"><button class="KEEP' + (s.verdict === 'KEEP' ? ' on' : '') + '">KEEP</button><button class="MOVE' + (s.verdict === 'MOVE' ? ' on' : '') + '">MOVE</button></div>' +
      '<label class="to">Move to <select>' + BUCKETS.filter((b) => b !== r.bucket).map((b) => '<option' + (b === to ? ' selected' : '') + '>' + b + '</option>').join('') + '</select> <span style="color:var(--muted)">(suggested: ' + r.suggest + ')</span></label>' +
      '<input type="text" placeholder="Comment (optional)" value="' + esc(s.comment || '') + '">';
    c.querySelectorAll('.toggle button').forEach((b) => b.addEventListener('click', () => { state[r.sha1] = { ...(state[r.sha1] || {}), verdict: b.textContent }; save(); render(); }));
    c.querySelector('select').addEventListener('change', (e) => { state[r.sha1] = { ...(state[r.sha1] || {}), moveTo: e.target.value }; save(); });
    c.querySelector('input').addEventListener('input', (e) => { state[r.sha1] = { ...(state[r.sha1] || {}), comment: e.target.value }; save(); });
    grid.appendChild(c);
  }
  const done = ROWS.filter((r) => state[r.sha1]?.verdict).length;
  document.getElementById('count').textContent = done + ' of ' + ROWS.length + ' ruled';
}
document.getElementById('export').addEventListener('click', () => {
  const out = {
    ruledOn: new Date().toISOString(),
    viewed: 294,
    rows: ROWS.map((r) => ({ n: r.n, sha1: r.sha1, sha256: r.sha256, bucket: r.bucket, time: r.time, slots: r.slots, level: r.level, wrong: r.wrong, suggested: r.suggest, verdict: state[r.sha1]?.verdict || null, moveTo: state[r.sha1]?.verdict === 'MOVE' ? (state[r.sha1]?.moveTo || r.suggest) : null, comment: state[r.sha1]?.comment || '' })),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'bucket-check-ruled.json';
  a.click();
});
render();
</script>
</body>
</html>
`;
writeFileSync(path.join(root, 'review', 'bucket-check.html'), html);
console.log(`review/bucket-check.html — ${rows.length} flagged (${likely} likely, ${rows.length - likely} possible) of ${photos.length} viewed`);
