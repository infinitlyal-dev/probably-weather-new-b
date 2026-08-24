// Build review/lines-salvage.html — the 152 lines the swap-test sweep retired,
// grouped by condition, for Al to rescue the ones worth keeping.
//
// WHY THESE ARE WORTH A SECOND LOOK. PAIRING-TASTE finding 0: Al judges the
// PAIR, not the line. Of 214 lines proposed three or more times in pass 1, 174
// got different verdicts on different images. So a line that failed the swap
// test on ITS photograph is not necessarily a bad line — it may be a good line
// standing in front of the wrong picture. Retiring it from that frame and
// re-homing it on another is the move the taste doc predicts.
//
// Each row shows the frame it failed on and why it was killed, because "good
// line, wrong picture" and "bad line" look identical without that context.
//
//   node scripts/build-salvage-tool.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);

const audit = JSON.parse(readFileSync(p('review/set-001-swap-test-audit.json'), 'utf8')).verdicts;
const ORDER = ['clear', 'heat', 'rain', 'storm', 'cold-clear', 'cold', 'cloudy', 'fog', 'wind'];

const groups = [];
let count = 0;
for (const bucket of ORDER) {
  const src = JSON.parse(readFileSync(p(`review/set-001-lines-bespoke-${bucket}.json`), 'utf8'));
  const byImage = Object.fromEntries(src.images.map((i) => [i.image, i]));
  const rows = [];
  for (const [image, verdicts] of Object.entries(audit[bucket] || {})) {
    const img = byImage[image];
    verdicts.forEach((v, i) => {
      if (v.startsWith('PASS')) return;
      const [grade, ...why] = v.split(':');
      rows.push({
        id: `${image}#${i}`,
        text: img.lines[i],
        image,
        time: img.time,
        day: img.day,
        grade,
        why: why.join(':').trim() || 'weather is present but not the engine',
        seen: img.seen,
        wasBank: Boolean(img.rescue[i]),
      });
    });
  }
  if (rows.length) { groups.push({ bucket, rows }); count += rows.length; }
}

const DATA = JSON.stringify({ groups, count });

const html = `<!doctype html>
<meta charset="utf-8">
<title>PW — salvage the retired lines</title>
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --ink3:#7d7568;
          --gold:#ffd700; --yes:#63c98a; --fail:#ff6b6b; --weak:#ffb84d; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:12px 18px; display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0; }
  button { font:inherit; border:1px solid rgba(246,242,232,.18); background:var(--panel); color:var(--ink);
           border-radius:8px; padding:6px 12px; cursor:pointer; }
  button:hover { border-color:var(--gold); }
  button.primary { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  .tally { color:var(--ink2); font-variant-numeric:tabular-nums; }
  .hint { color:var(--ink2); font-size:12.5px; padding:14px 18px 0; max-width:90ch; line-height:1.55; }
  .hint b { color:var(--gold); }
  main { padding:10px 18px 80px; }
  h2 { font-size:13px; letter-spacing:.1em; text-transform:uppercase; color:var(--gold);
       margin:30px 0 10px; padding-bottom:6px; border-bottom:1px solid rgba(246,242,232,.14); }
  h2 span { color:var(--ink3); letter-spacing:0; text-transform:none; font-weight:400; margin-left:8px; }
  .row { display:grid; grid-template-columns:26px 92px 1fr; gap:12px; align-items:start;
         padding:9px 0; border-bottom:1px solid rgba(246,242,232,.07); }
  .row.on { background:rgba(99,201,138,.09); }
  .tick { width:26px; height:26px; padding:0; border-radius:6px; line-height:1; }
  .tick.on { background:var(--yes); border-color:var(--yes); color:#0d1b12; font-weight:700; }
  .thumb { width:92px; height:70px; border-radius:5px; background-size:cover; background-position:center 40%; }
  .line { font-size:15px; }
  .meta { color:var(--ink3); font-size:11.5px; margin-top:3px; }
  .meta .g { font-weight:700; }
  .meta .FAIL { color:var(--fail); }
  .meta .WEAK { color:var(--weak); }
  .meta .bank { color:#8fb7ff; border:1px solid #8fb7ff55; border-radius:4px; padding:0 4px; margin-left:5px; }
</style>

<header>
  <h1>Retired lines — salvage</h1>
  <span class="tally" id="tally"></span>
  <span style="flex:1"></span>
  <button id="none">clear all</button>
  <button id="export" class="primary">Export</button>
</header>

<p class="hint">
  These are the ${count} lines the swap test pulled out. <b>Tick the ones you want kept.</b> Leave the rest alone —
  untouched means discarded, you never have to ✕ anything.
  The thumbnail is the photograph it was written for and the note is why I killed it there. A line can be perfectly good
  and still have been standing in front of the wrong picture — that is what this page is for. Whatever you tick,
  I will go and find a frame it actually fits.
</p>

<main id="main"></main>

<script>
const DATA = ${DATA};
const LS = 'pw_salvage_v1';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
const $ = (id) => document.getElementById(id);

function tally() {
  const n = Object.values(state).filter(Boolean).length;
  $('tally').textContent = n + ' of ' + DATA.count + ' kept';
}
function save() { localStorage.setItem(LS, JSON.stringify(state)); tally(); }

function render() {
  const m = $('main');
  m.innerHTML = '';
  for (const g of DATA.groups) {
    const h = document.createElement('h2');
    h.textContent = g.bucket;
    const s = document.createElement('span');
    s.textContent = g.rows.length + (g.rows.length === 1 ? ' line' : ' lines');
    h.appendChild(s);
    m.appendChild(h);

    for (const r of g.rows) {
      const row = document.createElement('div');
      row.className = 'row' + (state[r.id] ? ' on' : '');

      const b = document.createElement('button');
      b.className = 'tick' + (state[r.id] ? ' on' : '');
      b.textContent = state[r.id] ? '✓' : '';
      b.title = 'keep this line';
      b.onclick = () => { state[r.id] = !state[r.id]; save(); render(); };
      row.appendChild(b);

      const t = document.createElement('div');
      t.className = 'thumb';
      t.style.backgroundImage = 'url("/assets/images/bg/' + r.image + '")';
      t.title = r.seen;
      row.appendChild(t);

      const right = document.createElement('div');
      const l = document.createElement('div');
      l.className = 'line';
      l.textContent = r.text;
      right.appendChild(l);
      // Built with DOM nodes rather than innerHTML: the strings here come from
      // the audit file and from image paths on disk, and a review tool has no
      // business being the one place that parses either as markup.
      const mm = document.createElement('div');
      mm.className = 'meta';
      const g1 = document.createElement('span');
      g1.className = 'g ' + r.grade;
      g1.textContent = r.grade;
      mm.appendChild(g1);
      mm.appendChild(document.createTextNode(' — ' + r.why + '  ·  written for ' + r.image
        + ' (' + r.time + ' ' + r.day + ')'));
      if (r.wasBank) {
        const bk = document.createElement('span');
        bk.className = 'bank';
        bk.textContent = 'was a bank line';
        mm.appendChild(bk);
      }
      right.appendChild(mm);
      row.appendChild(right);

      m.appendChild(row);
    }
  }
  tally();
}

$('none').onclick = () => { for (const k of Object.keys(state)) delete state[k]; save(); render(); };

$('export').onclick = () => {
  const out = { generated: new Date().toISOString().slice(0, 10), ruledBy: 'Al, retired-line salvage',
    note: 'Lines Al wants kept from the 152 the swap test retired. Each still needs a photograph found for it.',
    kept: [] };
  for (const g of DATA.groups) for (const r of g.rows) {
    if (state[r.id]) out.kept.push({ text: r.text, condition: g.bucket, retiredFrom: r.image, grade: r.grade, why: r.why });
  }
  out.keptCount = out.kept.length;
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'set-001-salvage-ruled.json';
  a.click();
};

render();
</script>
`;

writeFileSync(p('review/lines-salvage.html'), html);
console.log(`[salvage] review/lines-salvage.html — ${count} retired lines across ${groups.length} conditions`);
for (const g of groups) console.log(`  ${g.bucket.padEnd(12)}${g.rows.length}`);
