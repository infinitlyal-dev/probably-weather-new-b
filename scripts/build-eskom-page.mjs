// The Eskom ruling page for Al (Job 3, 2026-09-19): one screen, KEEP / CUT per line.
//
// CLAUDE.md: "No Eskom jokes on home screen (removed — too dated/negative)". Yet Al
// hand-matched Eskom and load-shedding lines onto photographs, two of them on the
// sea-lightning frame (storm/week_1/dusk/7). The brief named three. The files hold seven
// live lines: four on photographs (each is also a condition-bank line) and three in the bank
// only (share cards, every zu/xh/st screen, and the English/Afrikaans fallback). All seven
// are shown so the ruling covers what is actually live.
//
// CUT removes the line everywhere it lives: from its photographs (the photograph keeps its
// other lines) and from the bank in all five languages. KEEP records an exception in CLAUDE.md.
// Export: review/eskom-ruled.json (lands in Downloads).
//
//   node scripts/build-eskom-page.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_LINES } from '../assets/hero-lines.js';
import { HERO_LINES_AF } from '../assets/hero-lines-af.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const RE = /eskom|load.?shed/i;
const rows = [];
for (const ns of ['witty', 'witty_low_confidence', 'headlines', 'heroLabels']) for (const [bin, v] of Object.entries(WEATHER_COPY[ns])) {
  (Array.isArray(v.en) ? v.en : []).forEach((en, i) => {
    if (!RE.test(en)) return;
    const photos = [];
    const seen = new Set();
    for (const [k, lines] of Object.entries(HERO_LINES)) {
      if (!k.startsWith('bg/') || !lines.includes(en)) continue;
      const id = k.replace(/week_\d\//, '');
      if (seen.has(id)) continue;
      seen.add(id);
      photos.push({ slot: k.replace(/^bg\//, ''), others: lines.filter((l) => l !== en).length });
    }
    rows.push({ key: `${ns}:${bin}#${i}`, en, af: HERO_LINES_AF[en] || v.af?.[i] || '', zu: v.zu?.[i] || '', xh: v.xh?.[i] || '', st: v.st?.[i] || '', photos });
  });
}
rows.sort((a, b) => b.photos.length - a.photos.length);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Eskom lines</title>
<style>
:root { --bg:#f7f6f2; --fg:#1d1d1b; --muted:#6b6a64; --line:#dddbd2; --card:#fff; --accent:#1f5f8b; --cut:#a5452b; --keep:#2e7d4f; }
@media (prefers-color-scheme: dark) { :root { --bg:#161614; --fg:#ecebe6; --muted:#a3a29b; --line:#34332f; --card:#1f1f1c; --accent:#7fb6dd; --cut:#e08a6e; --keep:#7ccf9c; } }
* { box-sizing:border-box; }
body { margin:0; padding:18px 16px 40px; background:var(--bg); color:var(--fg); font:15px/1.4 system-ui, sans-serif; }
main { max-width:1180px; margin:0 auto; }
h1 { font-size:1.35rem; margin:0 0 4px; }
.lede { color:var(--muted); margin:0 0 12px; max-width:90ch; font-size:.92rem; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:6px; }
.card.KEEP { border-color:var(--keep); } .card.CUT { border-color:var(--cut); }
.thumbs { display:flex; gap:6px; }
.thumbs img { width:84px; height:149px; object-fit:cover; border-radius:6px; }
.nophoto { font-size:.8rem; color:var(--muted); border:1px dashed var(--line); border-radius:6px; padding:8px; }
.en { font-weight:600; } .af { color:var(--muted); font-style:italic; font-size:.9rem; }
.meta { font-size:.78rem; color:var(--muted); }
.toggle { display:flex; gap:6px; margin-top:auto; }
.toggle button { flex:1; font:inherit; padding:7px; border-radius:7px; border:1px solid var(--line); background:transparent; color:var(--fg); cursor:pointer; }
.toggle button.on.KEEP { background:var(--keep); color:#fff; border-color:var(--keep); }
.toggle button.on.CUT { background:var(--cut); color:#fff; border-color:var(--cut); }
.bar { display:flex; gap:10px; align-items:center; margin:12px 0 0; flex-wrap:wrap; }
.bar button { font:inherit; padding:8px 14px; border-radius:7px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; }
textarea { width:100%; min-height:60px; margin-top:8px; font:12px ui-monospace, monospace; }
</style>
</head>
<body>
<main>
<h1>Eskom and load-shedding lines: ${rows.length} live</h1>
<p class="lede">CLAUDE.md bans Eskom jokes on the home screen ("too dated/negative"), but these are live. You named three; the files have ${rows.length}.
${rows.filter((r) => r.photos.length).length} are hand-matched to photos, including the two on the sea-lightning frame; each of those is also a condition-bank line.
${rows.filter((r) => !r.photos.length).length} are bank-only: they show on share cards, on every isiZulu/isiXhosa/Sesotho screen, and as the English/Afrikaans fallback.
<b>CUT</b> removes a line everywhere: from its photos (the photo keeps its other lines, count shown) and from the bank in all five languages.
<b>KEEP</b> records the line as a dated exception in CLAUDE.md. <b>Export</b> saves <code>eskom-ruled.json</code> to Downloads.</p>
<div class="grid" id="grid"></div>
<div class="bar"><span id="count"></span><button id="export">Export eskom-ruled.json</button></div>
<textarea id="out" readonly placeholder="Exported JSON also appears here."></textarea>
</main>
<script>
const ROWS = ${JSON.stringify(rows)};
const LS = 'pw_eskom_ruling_v1';
let state = {};
try { state = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { state = {}; }
const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function render() {
  const g = document.getElementById('grid'); g.innerHTML = '';
  for (const r of ROWS) {
    const v = state[r.key] || '';
    const c = document.createElement('section'); c.className = 'card ' + v;
    c.innerHTML = (r.photos.length
        ? '<div class="thumbs">' + r.photos.map(p => '<img src="../assets/images/bg/' + p.slot + '" alt="">').join('') + '</div>'
          + '<div class="meta">' + r.photos.map(p => p.slot.replace(/\\.webp$/, '') + ': ' + p.others + ' other lines stay').join(' · ') + '</div>'
        : '<div class="nophoto">Bank only: share cards, zu/xh/st screens, EN/AF fallback</div>')
      + '<div class="en">' + esc(r.en) + '</div><div class="af">' + esc(r.af) + '</div>'
      + '<div class="meta">' + esc(r.key) + '</div>'
      + '<div class="toggle"><button class="KEEP' + (v === 'KEEP' ? ' on' : '') + '">KEEP</button><button class="CUT' + (v === 'CUT' ? ' on' : '') + '">CUT</button></div>';
    c.querySelectorAll('.toggle button').forEach(b => b.addEventListener('click', () => { state[r.key] = b.textContent; try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} render(); }));
    g.appendChild(c);
  }
  document.getElementById('count').textContent = ROWS.filter(r => state[r.key]).length + ' of ' + ROWS.length + ' ruled';
}
document.getElementById('export').addEventListener('click', () => {
  const json = JSON.stringify({ generated: new Date().toISOString(), ruledBy: 'Al, Eskom ruling page (review/eskom-lines.html)', rulings: ROWS.map(r => ({ key: r.key, en: r.en, verdict: state[r.key] || null, photos: r.photos.map(p => p.slot) })) }, null, 1);
  document.getElementById('out').value = json;
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'eskom-ruled.json'; a.click(); } catch (e) {}
});
render();
</script>
</body>
</html>
`;
writeFileSync(path.join(root, 'review', 'eskom-lines.html'), html);
console.log(`[eskom] ${rows.length} live lines -> review/eskom-lines.html`);
for (const r of rows) console.log(`  ${r.key} | ${r.en} | photos: ${r.photos.map((p) => p.slot).join(', ') || 'none (bank only)'}`);
