// Build review/new-sets-lines-2026-10-07.html — Al picks a line for each new photograph (7 Oct 2026 sets).
//
// Each card shows the photograph at phone size with the selected line set on it the way the app sets it (bottom
// scrim, caption font), the two candidate lines with their Afrikaans and lang-check verdict, a free slot for Al's
// own line, and keep / cut for the photograph itself. Export writes review/new-sets-lines-2026-10-07-ruled.json,
// which scripts/ingest-new-sets.mjs reads: kept photographs, and the lines picked for them.
//
//   node scripts/build-new-sets-lines-page.mjs
// Open review/new-sets-lines-2026-10-07.html in a browser (the photographs load from review/new-sets-2026-10-07/).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC = 'review/new-sets-lines-2026-10-07.json';
const OUT = 'review/new-sets-lines-2026-10-07.html';
const doc = JSON.parse(readFileSync(path.join(root, SRC), 'utf8'));
const DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const data = doc.set.map((e) => ({ file: e.file, condition: e.condition, time: e.time, day: DAY[e.day], slots: e.slots || null,
  candidates: e.candidates.map((c) => ({ en: c.en, af: c.af, check: c.afCheck?.action ?? null, note: c.afCheck?.note || (c.afCheck?.findings || []).join(' · ') || '' })) }));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>New sets — lines</title>
<link rel="stylesheet" href="../assets/type-prototype-caption.css">
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700; --yes:#63c98a; --no:#ff6b6b; --warn:#ffb84d; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:10px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0 8px 0 0; }
  button { font:inherit; border:1px solid rgba(246,242,232,.18); background:var(--panel); color:var(--ink); border-radius:8px; padding:6px 11px; cursor:pointer; }
  button:hover { border-color:var(--gold); }
  button.primary { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  .tally { color:var(--ink2); font-variant-numeric:tabular-nums; }
  .filters button.on { border-color:var(--gold); color:var(--gold); }
  main { padding:18px 16px; display:flex; flex-direction:column; gap:28px; max-width:1100px; }
  .lead { color:var(--ink2); max-width:80ch; margin:0; }
  .card { display:grid; grid-template-columns:300px minmax(0,1fr); gap:22px; border-top:1px solid rgba(246,242,232,.12); padding-top:18px; }
  @media (max-width:720px) { .card { grid-template-columns:1fr; } .hero { margin:0 auto; } }
  .hero { position:relative; width:300px; height:533px; overflow:hidden; background:#000 center / cover no-repeat; border-radius:0 0 20px 20px;
          box-shadow:0 18px 44px rgba(0,0,0,.55); }
  .hero.cut { opacity:.35; }
  .scrim { position:absolute; left:0; right:0; bottom:0; height:42%; background:linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,0)); }
  .cap { position:absolute; left:16px; right:16px; bottom:16px; margin:0; color:#fff; font-weight:700; font-size:27px; line-height:1.08;
         font-family:'Caveat Prototype','Segoe Print','Bradley Hand',cursive; text-shadow:0 2px 14px rgba(0,0,0,.7), 0 1px 3px rgba(0,0,0,.8); }
  .meta { color:var(--ink2); font-size:12.5px; margin:0 0 10px; }
  .meta b { color:var(--ink); }
  .keep { display:flex; gap:8px; margin:0 0 14px; }
  .keep .k.on { border-color:var(--yes); color:var(--yes); font-weight:700; }
  .keep .c.on { border-color:var(--no); color:var(--no); font-weight:700; }
  .cand { border:1px solid rgba(246,242,232,.14); border-radius:10px; padding:10px 12px; margin-bottom:10px; cursor:pointer; }
  .cand.picked { border-color:var(--yes); background:rgba(99,201,138,.07); }
  .cand.showing { box-shadow:0 0 0 1px var(--gold) inset; }
  .cand .en { font-size:15px; }
  .cand .af { color:var(--ink2); margin-top:4px; }
  .cand .row { display:flex; gap:10px; align-items:center; justify-content:space-between; margin-top:6px; }
  .badge { font-size:11px; padding:1px 7px; border-radius:999px; border:1px solid currentColor; }
  .badge.pass { color:var(--yes); } .badge.triage { color:var(--warn); } .badge.triage-high { color:var(--no); }
  .note { color:var(--warn); font-size:12px; }
  .pick.on { border-color:var(--yes); color:var(--yes); font-weight:700; }
  .own { width:100%; font:inherit; background:#181410; color:var(--ink); border:1px dashed rgba(246,242,232,.25); border-radius:8px; padding:8px 10px; }
  .own:focus { outline:none; border-color:var(--gold); }
  .wc { color:var(--ink2); font-size:11.5px; }
</style>
</head>
<body>
<header>
  <h1>New sets — lines (7 Oct 2026)</h1>
  <span class="tally" id="tally"></span>
  <span class="filters"><button data-f="all" class="on">All</button><button data-f="partly-cloudy">Partly cloudy</button><button data-f="breezy">Breezy</button><button data-f="cloudy">Cloudy</button></span>
  <button id="export" class="primary">Export</button>
</header>
<main>
  <p class="lead">Each photograph has two lines written for it. Click a line to see it on the picture; tick <b>Pick</b> on the one you want (both is fine, so is neither — then write your own in the box). <b>Keep</b> / <b>Cut</b> rules the photograph itself. The Afrikaans under each line is a draft for you to rule; its badge is lang-check's verdict. Export saves <code>new-sets-lines-2026-10-07-ruled.json</code> — send that file back. Your ticks are remembered in this browser.</p>
  <div id="cards"></div>
</main>
<script>
const DATA = ${JSON.stringify(data)};
const LS = 'pw_new_sets_lines_2026_10_07';
let state = {};
try { state = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { state = {}; }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} tally(); };
const st = (f) => (state[f] ||= { keep: null, pick: [], own: '' });
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = (s) => (s.trim() ? s.trim().split(/\\s+/).length : 0);
let filter = 'all';

function tally() {
  const n = DATA.length, kept = DATA.filter((d) => st(d.file).keep === true).length, cut = DATA.filter((d) => st(d.file).keep === false).length;
  const lined = DATA.filter((d) => st(d.file).pick.length || st(d.file).own.trim()).length;
  $('tally').textContent = kept + ' kept · ' + cut + ' cut · ' + lined + ' of ' + n + ' with a line';
}
function render() {
  const box = $('cards'); box.innerHTML = '';
  for (const d of DATA) {
    if (filter !== 'all' && d.condition !== filter) continue;
    const s = st(d.file);
    const card = document.createElement('section'); card.className = 'card';
    const shown = s.own.trim() || (s.pick.length ? d.candidates[s.pick[0]].en : d.candidates[0].en);
    card.innerHTML = '<div class="hero' + (s.keep === false ? ' cut' : '') + '" style="background-image:url(&quot;new-sets-2026-10-07/' + esc(d.file) + '&quot;)">'
      + '<div class="scrim"></div><p class="cap">' + esc(shown) + '</p></div>'
      + '<div><p class="meta"><b>' + esc(d.file) + '</b> · ' + esc(d.condition) + ' · ' + esc(d.time) + ' · ' + esc(d.day)
      + (d.slots ? ' · replaces ' + esc(d.slots.join(', ')) + ' (and its week 3/4 twin)' : '') + '</p>'
      + '<div class="keep"><button class="k' + (s.keep === true ? ' on' : '') + '">Keep photo</button><button class="c' + (s.keep === false ? ' on' : '') + '">Cut photo</button></div>'
      + d.candidates.map((c, i) => '<div class="cand' + (s.pick.includes(i) ? ' picked' : '') + '" data-i="' + i + '">'
        + '<div class="en">' + esc(c.en) + '</div><div class="af">AF: ' + esc(c.af) + '</div>'
        + '<div class="row"><span><span class="badge ' + esc(c.check || '') + '">lang-check: ' + esc(c.check || 'n/a') + '</span> '
        + (c.note ? '<span class="note">' + esc(c.note) + '</span>' : '') + ' <span class="wc">' + words(c.en) + ' words</span></span>'
        + '<button class="pick' + (s.pick.includes(i) ? ' on' : '') + '">Pick</button></div></div>').join('')
      + '<input class="own" placeholder="Or your own line for this photograph" value="' + esc(s.own) + '"></div>';
    const cap = card.querySelector('.cap');
    card.querySelector('.k').onclick = () => { s.keep = s.keep === true ? null : true; save(); render(); };
    card.querySelector('.c').onclick = () => { s.keep = s.keep === false ? null : false; save(); render(); };
    card.querySelectorAll('.cand').forEach((el) => {
      const i = Number(el.dataset.i);
      el.onclick = (ev) => {
        card.querySelectorAll('.cand').forEach((x) => x.classList.remove('showing')); el.classList.add('showing');
        cap.textContent = d.candidates[i].en;
        if (ev.target.classList.contains('pick')) { s.pick = s.pick.includes(i) ? s.pick.filter((x) => x !== i) : [...s.pick, i].sort(); save(); render(); }
      };
    });
    const own = card.querySelector('.own');
    own.oninput = () => { s.own = own.value; cap.textContent = own.value || d.candidates[0].en; save(); };
    box.appendChild(card);
  }
  tally();
}
document.querySelectorAll('.filters button').forEach((b) => b.onclick = () => {
  filter = b.dataset.f; document.querySelectorAll('.filters button').forEach((x) => x.classList.toggle('on', x === b)); render();
});
$('export').onclick = () => {
  const out = { source: ${JSON.stringify(SRC)}, ruledAt: new Date().toISOString(), photos: DATA.map((d) => {
    const s = st(d.file);
    const picked = s.pick.map((i) => ({ en: d.candidates[i].en, af: d.candidates[i].af, candidate: i + 1 }));
    if (s.own.trim()) picked.push({ en: s.own.trim(), af: null, own: true });
    return { file: d.file, condition: d.condition, keep: s.keep, lines: picked };
  }) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = 'new-sets-lines-2026-10-07-ruled.json'; a.click();
};
render();
</script>
</body>
</html>
`;
writeFileSync(path.join(root, OUT), html);
console.log(`[lines page] ${data.length} photographs → ${OUT}`);
