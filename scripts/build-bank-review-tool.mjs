// Build review/lines-bank-review.html — the whole original condition bank, the
// lines written for a CONDITION rather than for a photograph, for Al to pick
// the keepers out of.
//
// SOURCE OF TRUTH IS assets/weather-copy.js, NOT review/tools/witty-lines.json.
// That extract holds 483 lines and is stale: the pairing pass of 2026-08-05
// proposed 276 line ids that are not in it, so it was taken before the bank
// grew. The live EN bank is 903 lines. Reading the module directly means this
// page cannot drift from what the app actually serves.
//
// Every line carries its pass-1 record where it has one — proposed N times,
// approved M — joined from review/pairing-proposals.json against Al's export in
// review/set-001-humour-approved.json. That join reproduces PAIRING-TASTE's
// published 885/1470 = 60%, which is how we know the ids line up.
//
//   node scripts/build-bank-review-tool.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEATHER_COPY } from '../assets/weather-copy.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);

const proposals = JSON.parse(readFileSync(p('review/pairing-proposals.json'), 'utf8'));
const approved = JSON.parse(readFileSync(p('review/set-001-humour-approved.json'), 'utf8')).approved;

// Pass-1 record per line id.
const shown = {}, kept = {};
for (const unit of proposals.units) {
  const yes = new Set((unit.slots || []).flatMap((s) => approved[s] || []));
  for (const pr of unit.proposals || []) {
    shown[pr.id] = (shown[pr.id] || 0) + 1;
    if (yes.has(pr.id)) kept[pr.id] = (kept[pr.id] || 0) + 1;
  }
}
const checkTotal = Object.values(shown).reduce((a, b) => a + b, 0);
const checkKept = Object.values(kept).reduce((a, b) => a + b, 0);
if (checkTotal !== 1470 || checkKept !== 885) {
  console.error(`[bank] the pass-1 join no longer reproduces 885/1470 (got ${checkKept}/${checkTotal}) — ids have drifted, refusing to build`);
  process.exit(1);
}

// Bank lines already placed on a photograph as a bespoke rescue.
const placed = {};
for (const b of ['wind', 'cloudy', 'cold', 'clear', 'rain', 'storm', 'cold-clear', 'fog', 'heat']) {
  for (const f of [`review/set-001-lines-bespoke-${b}-v2.json`, `review/set-001-lines-bespoke-${b}.json`]) {
    let doc; try { doc = JSON.parse(readFileSync(p(f), 'utf8')); } catch { continue; }
    for (const img of doc.images) for (const r of img.rescue || []) if (r) placed[r] = (placed[r] || 0) + 1;
    break;
  }
}

const ORDER = ['clear', 'cold-clear', 'cold', 'fog', 'heat', 'cloudy', 'rain', 'wind', 'storm',
  'weekend', 'night', 'uv', 'rain-possible', 'partly-cloudy', 'thunder', 'hail'];

const groups = [];
let count = 0;
for (const cond of ORDER) {
  const en = WEATHER_COPY.witty[cond]?.en;
  if (!en) continue;
  const rows = en.map((text, index) => {
    const id = `witty:${cond}#${index}`;
    const n = shown[id] || 0, k = kept[id] || 0;
    return {
      id, text, index,
      shown: n, kept: k,
      rate: n ? k / n : null,
      band: n === 0 ? 'untested' : k === 0 ? 'rejected' : 'proven',
      placed: placed[id] || 0,
    };
  });
  // Strongest evidence first, then the never-tested, then the ones that always lost.
  const rank = { proven: 0, untested: 1, rejected: 2 };
  rows.sort((a, b) => rank[a.band] - rank[b.band]
    || (b.rate ?? -1) - (a.rate ?? -1)
    || b.shown - a.shown
    || a.index - b.index);
  groups.push({ cond, rows, n: rows.length,
    proven: rows.filter((r) => r.band === 'proven').length,
    untested: rows.filter((r) => r.band === 'untested').length,
    rejected: rows.filter((r) => r.band === 'rejected').length });
  count += rows.length;
}

const DATA = JSON.stringify({ groups, count });

const html = `<!doctype html>
<meta charset="utf-8">
<title>PW — the original condition bank</title>
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --ink3:#7d7568;
          --gold:#ffd700; --yes:#63c98a; --proven:#63c98a; --untested:#8fb7ff; --rejected:#ff6b6b; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:11px 18px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0; }
  button { font:inherit; border:1px solid rgba(246,242,232,.18); background:var(--panel); color:var(--ink);
           border-radius:8px; padding:5px 11px; cursor:pointer; }
  button:hover { border-color:var(--gold); }
  button.on { border-color:var(--gold); color:var(--gold); }
  button.primary { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  .tally { color:var(--ink2); font-variant-numeric:tabular-nums; }
  .hint { color:var(--ink2); font-size:12.5px; padding:14px 18px 0; max-width:92ch; line-height:1.55; }
  .hint b { color:var(--gold); }
  nav { padding:10px 18px 0; display:flex; gap:6px; flex-wrap:wrap; }
  nav a { color:var(--ink2); font-size:12px; text-decoration:none; border:1px solid rgba(246,242,232,.14);
          border-radius:20px; padding:3px 10px; }
  nav a:hover { border-color:var(--gold); color:var(--gold); }
  main { padding:10px 18px 90px; }
  h2 { font-size:13px; letter-spacing:.1em; text-transform:uppercase; color:var(--gold);
       margin:32px 0 8px; padding-bottom:6px; border-bottom:1px solid rgba(246,242,232,.14); }
  h2 span { color:var(--ink3); letter-spacing:0; text-transform:none; font-weight:400; margin-left:10px; font-size:11.5px; }
  .row { display:grid; grid-template-columns:26px 74px 1fr; gap:11px; align-items:baseline;
         padding:6px 0; border-bottom:1px solid rgba(246,242,232,.06); }
  .row.on { background:rgba(99,201,138,.09); }
  .row.hide { display:none; }
  .tick { width:26px; height:26px; padding:0; border-radius:6px; line-height:1; }
  .tick.on { background:var(--yes); border-color:var(--yes); color:#0d1b12; font-weight:700; }
  .rec { font-size:11px; font-variant-numeric:tabular-nums; text-align:right; padding-top:3px; }
  .rec.proven { color:var(--proven); }
  .rec.untested { color:var(--untested); }
  .rec.rejected { color:var(--rejected); }
  .line { font-size:15px; }
  .tag { font-size:10.5px; color:#8fb7ff; border:1px solid #8fb7ff55; border-radius:4px; padding:0 5px; margin-left:7px; }
</style>

<header>
  <h1>The original condition bank</h1>
  <span class="tally" id="tally"></span>
  <span style="flex:1"></span>
  <button data-f="all" class="filt on">all</button>
  <button data-f="proven" class="filt">proven</button>
  <button data-f="untested" class="filt">never shown</button>
  <button data-f="rejected" class="filt">never kept</button>
  <button id="none">clear all</button>
  <button id="export" class="primary">Export</button>
</header>

<p class="hint">
  All ${count} lines from the original bank — the ones written for a <b>condition</b>, before any of them were written
  for a photograph. <b>Tick the ones worth keeping.</b> Untouched means dropped, so you never have to ✕ anything.
  The number on the left is its record from your pass-1 pairing review: <span style="color:#63c98a">4/4</span> means it was
  put in front of you four times and you kept it four times, <span style="color:#8fb7ff">never shown</span> means it has
  never been ruled on at all, and <span style="color:#ff6b6b">0/13</span> means it lost every time. Proven ones are at the
  top of each condition. Whatever you tick, I will go and find the photographs it actually fits.
</p>

<nav id="jump"></nav>
<main id="main"></main>

<script>
const DATA = ${DATA};
const LS = 'pw_bank_review_v1';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
let filter = 'all';
const $ = (id) => document.getElementById(id);

function tally() {
  const n = Object.values(state).filter(Boolean).length;
  $('tally').textContent = n + ' of ' + DATA.count + ' kept';
}
function save() { localStorage.setItem(LS, JSON.stringify(state)); tally(); }

function render() {
  const jump = $('jump'); jump.innerHTML = '';
  for (const g of DATA.groups) {
    const a = document.createElement('a');
    a.href = '#c-' + g.cond;
    a.textContent = g.cond + ' (' + g.n + ')';
    jump.appendChild(a);
  }

  const m = $('main'); m.innerHTML = '';
  for (const g of DATA.groups) {
    const h = document.createElement('h2');
    h.id = 'c-' + g.cond;
    h.textContent = g.cond;
    const s = document.createElement('span');
    s.textContent = g.n + ' lines · ' + g.proven + ' proven · ' + g.untested + ' never shown · ' + g.rejected + ' never kept';
    h.appendChild(s);
    m.appendChild(h);

    for (const r of g.rows) {
      const row = document.createElement('div');
      row.className = 'row' + (state[r.id] ? ' on' : '')
        + (filter !== 'all' && r.band !== filter ? ' hide' : '');

      const b = document.createElement('button');
      b.className = 'tick' + (state[r.id] ? ' on' : '');
      b.textContent = state[r.id] ? '✓' : '';
      b.title = r.id;
      b.onclick = () => { state[r.id] = !state[r.id]; save(); render(); };
      row.appendChild(b);

      const rec = document.createElement('div');
      rec.className = 'rec ' + r.band;
      rec.textContent = r.band === 'untested' ? 'never shown' : r.kept + '/' + r.shown;
      row.appendChild(rec);

      const right = document.createElement('div');
      const l = document.createElement('div');
      l.className = 'line';
      l.textContent = r.text;
      if (r.placed) {
        const t = document.createElement('span');
        t.className = 'tag';
        t.textContent = 'already on ' + r.placed + ' photo' + (r.placed === 1 ? '' : 's');
        l.appendChild(t);
      }
      right.appendChild(l);
      row.appendChild(right);

      m.appendChild(row);
    }
  }
  tally();
}

for (const b of document.querySelectorAll('.filt')) {
  b.onclick = () => {
    filter = b.dataset.f;
    for (const x of document.querySelectorAll('.filt')) x.classList.toggle('on', x === b);
    render();
  };
}
$('none').onclick = () => { for (const k of Object.keys(state)) delete state[k]; save(); render(); };

$('export').onclick = () => {
  const out = { generated: new Date().toISOString().slice(0, 10), ruledBy: 'Al, original condition bank review',
    note: 'Bank lines Al wants kept. Each still needs photographs found for it.', kept: [] };
  for (const g of DATA.groups) for (const r of g.rows) {
    if (state[r.id]) out.kept.push({ id: r.id, condition: g.cond, text: r.text,
      pass1: r.band === 'untested' ? null : { shown: r.shown, kept: r.kept } });
  }
  out.keptCount = out.kept.length;
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'set-001-bank-ruled.json';
  a.click();
};

render();
</script>
`;

writeFileSync(p('review/lines-bank-review.html'), html);
console.log(`[bank] review/lines-bank-review.html — ${count} EN lines across ${groups.length} conditions`);
for (const g of groups) {
  console.log(`  ${g.cond.padEnd(15)}${String(g.n).padStart(4)}   proven ${String(g.proven).padStart(3)} · never shown ${String(g.untested).padStart(3)} · never kept ${String(g.rejected).padStart(3)}`);
}
