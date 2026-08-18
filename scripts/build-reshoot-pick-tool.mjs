// Build review/reshoot-pick.html — pick one of two candidates per cut slot.
//
// 15 slots were cut in Al's curation pass (review/set-001-cut-list.json). Two
// candidates were generated for each on GPT Image 2 (Al's rule, 2026-08-18 —
// two, not four, and never Flux). This is the instrument for choosing.
//
// It shows both candidates IN THE COMPOSITION THEY WILL LIVE IN — the hero card
// at its measured pixel size, the shipped scrim, a real witty line for that
// bucket in the caption font. Judging a replacement on a bare frame is what let
// the 2026-08-14 batch through at a 52% failure rate: those images were fine as
// pictures and wrong as backgrounds.
//
// REJECT BOTH is a first-class verdict. Two candidates is a sample, not a
// guarantee, and a slot with no acceptable frame should come back as work to do
// rather than be settled by picking the less bad one.
//
//   node scripts/build-reshoot-pick-tool.mjs
// Serve it: node scripts/serve-review.mjs  →  /review/reshoot-pick.html
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);

const cand = JSON.parse(readFileSync(p('review/reshoot-candidates-2026-08-18.json'), 'utf8')).candidates;
const cuts = JSON.parse(readFileSync(p('review/set-001-cut-list.json'), 'utf8')).cut;
const fold = JSON.parse(readFileSync(p('output/m8-fold/fold.json'), 'utf8'));
const copy = (() => {
  const src = readFileSync(p('assets/copy/en.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
})();

const row = fold.rows.find((r) => r.viewport === '375x812' && r.caption === 'longest');
const BOX = { w: row.heroWpx, h: row.heroPx };
// The caption clamps at 375x812, resolved exactly as app.css resolves them.
const CAP = { runway: Math.max(38, Math.min(76, 7 * 812 / 100)), font: Math.min(4.2 * 812 / 100, 8.8 * 375 / 100), padBottom: Math.max(10, Math.min(20, 1.8 * 812 / 100)) };

const lineFor = (condition, time) => {
  const bank = copy.witty || {};
  // The longest line the slot could EVER carry, across both pools it can draw
  // from — the condition's own and, at night, the night bank. This is a stress
  // frame, so the worst case is the honest one: a long line eats more picture
  // and reaches highest into the weakest part of the scrim.
  const pools = [bank[condition]?.en, time === 'night' ? bank.night?.en : null]
    .filter((x) => Array.isArray(x) && x.length);
  const all = pools.flat();
  return all.length ? all.sort((a, b) => b.length - a.length)[0] : 'Probably weather.';
};

// Pair the two candidate indices that share a slot.
const bySlot = new Map();
for (const c of cand) {
  if (!bySlot.has(c.slot)) bySlot.set(c.slot, { slot: c.slot, bucket: c.bucket, place: c.place, idx: [] });
  bySlot.get(c.slot).idx.push(c.index);
}
const slots = [...bySlot.values()].map((s) => {
  const cut = cuts.find((c) => c.image === s.slot) || {};
  return {
    ...s,
    condition: cut.condition, time: cut.time,
    paths: cut.paths || [s.slot],
    line: lineFor(cut.condition, cut.time),
    a: `/output/reshoot-2026-08-18/${String(s.idx[0]).padStart(2, '0')}.png`,
    b: `/output/reshoot-2026-08-18/${String(s.idx[1]).padStart(2, '0')}.png`,
    old: `/assets/images/bg/${s.slot}`,
  };
});
// Thinnest buckets first: storm-night and wind-night are down to three images.
const ORDER = ['storm-night', 'wind-night', 'rain-night', 'wind-day', 'wind-dusk'];
slots.sort((x, y) => ORDER.indexOf(x.bucket) - ORDER.indexOf(y.bucket) || x.slot.localeCompare(y.slot));

let seed = {};
try { seed = JSON.parse(readFileSync(p('review/reshoot-picks-seed.json'), 'utf8')); } catch { /* first run */ }
const DATA = JSON.stringify({ box: BOX, cap: CAP, slots });

const html = `<!doctype html>
<meta charset="utf-8">
<title>PW — pick the replacements</title>
<link rel="stylesheet" href="../assets/type-prototype-caption.css">
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700; --keep:#63c98a; --cut:#ff6b6b; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:10px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0 8px 0 0; }
  button { font:inherit; border:1px solid rgba(246,242,232,.18); background:var(--panel); color:var(--ink);
           border-radius:8px; padding:7px 12px; cursor:pointer; }
  button:hover { border-color:var(--gold); }
  button.primary { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  .tally { color:var(--ink2); font-variant-numeric:tabular-nums; }
  main { padding:18px; display:flex; flex-direction:column; gap:26px; }
  .slot { border-top:1px solid rgba(246,242,232,.12); padding-top:16px; }
  .head { display:flex; gap:14px; align-items:baseline; flex-wrap:wrap; margin-bottom:10px; }
  .head b { font-size:15px; }
  .head span { color:var(--ink2); font-size:12.5px; }
  .frames { display:flex; gap:18px; flex-wrap:wrap; align-items:flex-start; }
  figure { margin:0; }
  .hero { position:relative; overflow:hidden; background-size:cover; background-position:center 50%; background-repeat:no-repeat;
          border-radius:0 0 20px 20px; box-shadow:0 18px 44px rgba(0,0,0,.55); }
  .hero.old { filter:grayscale(.35) brightness(.7); }
  .cap { position:absolute; left:0; right:0; bottom:0; margin:0; color:#fff; font-weight:700;
         font-family:'Caveat Prototype','Segoe Print','Bradley Hand',cursive; text-align:left; line-height:1.08;
         text-shadow:0 2px 14px rgba(0,0,0,.7), 0 1px 3px rgba(0,0,0,.8); }
  figcaption { text-align:center; margin-top:8px; font-size:12px; color:var(--ink2); }
  .pick { margin-top:6px; }
  .pick.on { border-color:var(--keep); color:var(--keep); font-weight:700; }
  .rej.on { border-color:var(--cut); color:var(--cut); font-weight:700; }
  .verdict { margin-left:auto; font-size:12.5px; }
</style>

<header>
  <h1>Pick the replacements — 15 slots, two candidates each</h1>
  <span class="tally" id="tally"></span>
  <span style="flex:1"></span>
  <button id="export" class="primary">Export picks</button>
</header>
<main id="main"></main>

<script>
const DATA = ${DATA};
const LS = 'pw_reshoot_picks_v1';
// Al's picks from the first pass are seeded in, so a re-look opens on his
// existing choices. He judged those with a defective caption (the slot/cut-list
// join failed on a missing .webp, so every frame carried the fallback line and
// the old frame 404'd) — the picks are worth keeping, the second look is worth
// having.
const SEED = ${JSON.stringify(seed)};
const state = Object.assign({}, SEED, JSON.parse(localStorage.getItem(LS) || '{}'));
const $ = (id) => document.getElementById(id);

function scrim(runway) {
  return 'linear-gradient(to top, rgba(0,0,0,.80) 0%, rgba(0,0,0,.62) calc(100% - ' + runway.toFixed(1) + 'px), rgba(0,0,0,0) 100%)';
}

function frame(src, line, extraClass) {
  const d = document.createElement('div');
  d.className = 'hero ' + (extraClass || '');
  d.style.width = DATA.box.w + 'px';
  d.style.height = DATA.box.h + 'px';
  d.style.backgroundImage = 'url("' + src + '")';
  const cap = document.createElement('p');
  cap.className = 'cap';
  cap.textContent = line;
  cap.style.padding = DATA.cap.runway.toFixed(1) + 'px 16px ' + DATA.cap.padBottom.toFixed(1) + 'px';
  cap.style.fontSize = DATA.cap.font.toFixed(1) + 'px';
  cap.style.background = scrim(DATA.cap.runway);
  cap.style.borderRadius = '0 0 20px 20px';
  d.appendChild(cap);
  return d;
}

function render() {
  const m = $('main');
  m.innerHTML = '';
  DATA.slots.forEach((s) => {
    const sec = document.createElement('section');
    sec.className = 'slot';
    const head = document.createElement('div');
    head.className = 'head';
    const b = document.createElement('b'); b.textContent = s.bucket + ' · ' + s.place;
    const sp = document.createElement('span');
    sp.textContent = s.slot + ' · ' + s.paths.length + ' rotation slot(s)';
    const v = document.createElement('span'); v.className = 'verdict';
    v.textContent = state[s.slot] ? 'chosen: ' + state[s.slot] : 'undecided';
    head.append(b, sp, v);
    sec.appendChild(head);

    const row = document.createElement('div');
    row.className = 'frames';
    for (const which of ['a', 'b']) {
      const fig = document.createElement('figure');
      fig.appendChild(frame(s[which], s.line));
      const cap = document.createElement('figcaption');
      cap.textContent = which.toUpperCase();
      const btn = document.createElement('button');
      btn.className = 'pick' + (state[s.slot] === which.toUpperCase() ? ' on' : '');
      btn.textContent = 'Pick ' + which.toUpperCase();
      btn.onclick = () => { state[s.slot] = which.toUpperCase(); save(); };
      cap.appendChild(document.createElement('br'));
      cap.appendChild(btn);
      fig.appendChild(cap);
      row.appendChild(fig);
    }
    // The frame being replaced, dimmed, so the comparison is against what is
    // actually live rather than against a memory of it.
    const figOld = document.createElement('figure');
    figOld.appendChild(frame(s.old, s.line, 'old'));
    const capOld = document.createElement('figcaption');
    capOld.textContent = 'the cut one';
    const rej = document.createElement('button');
    rej.className = 'rej' + (state[s.slot] === 'NEITHER' ? ' on' : '');
    rej.textContent = 'Reject both';
    rej.onclick = () => { state[s.slot] = 'NEITHER'; save(); };
    capOld.appendChild(document.createElement('br'));
    capOld.appendChild(rej);
    figOld.appendChild(capOld);
    row.appendChild(figOld);

    sec.appendChild(row);
    m.appendChild(sec);
  });
  const done = DATA.slots.filter((s) => state[s.slot]).length;
  const nei = DATA.slots.filter((s) => state[s.slot] === 'NEITHER').length;
  $('tally').textContent = done + ' / ' + DATA.slots.length + ' decided · ' + nei + ' need another go';
}

function save() { localStorage.setItem(LS, JSON.stringify(state)); render(); }

$('export').onclick = () => {
  const out = { generated: '2026-08-18', ruledBy: 'Al, reshoot pick tool', picks: [], redo: [] };
  for (const s of DATA.slots) {
    const v = state[s.slot];
    if (!v) continue;
    if (v === 'NEITHER') { out.redo.push({ slot: s.slot, bucket: s.bucket, place: s.place }); continue; }
    out.picks.push({ slot: s.slot, bucket: s.bucket, place: s.place, paths: s.paths,
      candidate: v, file: v === 'A' ? s.a : s.b });
  }
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'reshoot-picks.json';
  a.click();
};

render();
</script>
`;

writeFileSync(p('review/reshoot-pick.html'), html);
console.log(`[pick tool] review/reshoot-pick.html — ${slots.length} slots, ${cand.length} candidates, card ${BOX.w}x${BOX.h}`);
