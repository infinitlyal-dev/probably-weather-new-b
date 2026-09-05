// Builds review/astra-kill-gallery.html — the 444 lines Astra killed, on their photographs.
//
// Al's instruction, 2026-09-05: the KILLs are held as `unruled`, not rejected. This page is
// how he spot-checks them. 20 cards per screen, the line rendered ON the picture (taste doc
// finding 0: he judges the PAIR, never the line beside a thumbnail), Astra's score and
// reason underneath so he can see what it was applying.
//
// Ticking a card RESCUES that line — the export is a rescue list, never a rejection list.
// Anything he does not tick stays exactly as it is: unruled.
//
//   node scripts/build-astra-kill-gallery.mjs
// Serve: node scripts/serve-review.mjs -> /review/astra-kill-gallery.html
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUCKETS = ['cold', 'cold-clear', 'fog', 'rain', 'storm', 'heat'];
const PER_PAGE = 20;
const CARD = { w: 218, h: 345 };   // same 327x518 hero ratio as the review card, scaled

const cards = [];
for (const bucket of BUCKETS) {
  const file = `review/set-001-lines-bespoke-${bucket}-v3-astra-ruled.json`;
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  for (const image of doc.images) {
    for (const entry of image.unruled || []) {
      cards.push({
        bucket,
        image: image.image,
        hash: image.hash,
        photoId: image.photoId,
        time: image.time,
        week: image.week,
        day: image.day,
        text: entry.text,
        score: entry.score,
        reason: entry.reason,
      });
    }
  }
}

const counts = Object.fromEntries(BUCKETS.map((b) => [b, cards.filter((c) => c.bucket === b).length]));
const DATA = JSON.stringify({ cards, buckets: BUCKETS, counts, perPage: PER_PAGE, card: CARD });

const html = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PW — Astra's kills, on their photographs</title>
<link rel="stylesheet" href="../assets/type-prototype-caption.css">
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700; --yes:#63c98a; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:9px 14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:14px; margin:0; white-space:nowrap; }
  .tabs { display:flex; gap:4px; flex-wrap:wrap; }
  .tab { border:1px solid rgba(246,242,232,.18); background:none; color:var(--ink2); border-radius:999px;
         padding:3px 10px; font:inherit; font-size:11.5px; cursor:pointer; }
  .tab.on { color:#fff; background:#2b2118; border-color:var(--gold); }
  button.act { font:inherit; font-size:12px; border:1px solid rgba(246,242,232,.18); background:var(--panel);
               color:var(--ink); border-radius:7px; padding:5px 10px; cursor:pointer; }
  button.act:disabled { opacity:.35; cursor:default; }
  button.pri { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  .tally { color:var(--ink2); font-size:12px; font-variant-numeric:tabular-nums; }
  .spacer { flex:1; }
  main { padding:16px; display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; }
  .card { width:${CARD.w}px; }
  .hero { position:relative; width:${CARD.w}px; height:${CARD.h}px; border-radius:0 0 14px 14px; overflow:hidden;
          background-size:cover; background-position:center 50%; box-shadow:0 12px 30px rgba(0,0,0,.5);
          cursor:pointer; border:2px solid transparent; }
  .card.on .hero { border-color:var(--yes); box-shadow:0 0 0 3px rgba(99,201,138,.25), 0 12px 30px rgba(0,0,0,.5); }
  .cap { position:absolute; left:0; right:0; bottom:0; margin:0; padding:26px 11px 9px; color:#fff; font-weight:700;
         font-family:'Caveat Prototype','Segoe Print','Bradley Hand',cursive; font-size:19px; line-height:1.1;
         text-shadow:0 2px 14px rgba(0,0,0,.7), 0 1px 3px rgba(0,0,0,.8);
         background:linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.62) 62%, rgba(0,0,0,0) 100%);
         border-radius:0 0 12px 12px; }
  .meta { color:var(--ink2); font-size:11px; margin:6px 0 2px; }
  .why { color:#e0a94d; font-size:11.5px; line-height:1.35; }
  .rescued { color:var(--yes); font-size:11.5px; font-weight:700; margin-top:3px; }
  footer { position:sticky; bottom:0; background:rgba(20,17,13,.97); border-top:1px solid rgba(246,242,232,.14);
           padding:9px 14px; display:flex; gap:10px; align-items:center; }
  .hint { color:var(--ink2); font-size:12px; padding:0 16px 4px; }
</style>

<header>
  <h1>Astra's kills — click a card to rescue it</h1>
  <div class="tabs" id="tabs"></div>
  <span class="spacer"></span>
  <span class="tally" id="tally"></span>
  <button class="act pri" id="export">Export rescues</button>
</header>
<p class="hint">Nothing here is rejected — every one of these is held unruled. Ticking rescues a line into the pool; leaving it alone changes nothing.</p>
<main id="main"></main>
<footer>
  <button class="act" id="prev">&larr; Prev</button>
  <span class="tally" id="page"></span>
  <button class="act" id="next">Next &rarr;</button>
  <span class="spacer"></span>
  <span class="tally" id="ctx"></span>
</footer>

<script>
const DATA = ${DATA};
const LS = 'pw_astra_kill_rescues';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
const $ = (id) => document.getElementById(id);
const keyOf = (c) => c.image + '#' + c.text;
let bucket = 'all';
let page = 0;

const visible = () => bucket === 'all' ? DATA.cards : DATA.cards.filter((c) => c.bucket === bucket);
const pages = () => Math.max(1, Math.ceil(visible().length / DATA.perPage));

function save() { localStorage.setItem(LS, JSON.stringify(state)); paintTally(); }

function paintTally() {
  const n = Object.values(state).filter(Boolean).length;
  $('tally').textContent = n + ' rescued of ' + DATA.cards.length + ' held';
}

function renderTabs() {
  const t = $('tabs');
  t.innerHTML = '';
  const mk = (id, label, n) => {
    const b = document.createElement('button');
    b.className = 'tab' + (bucket === id ? ' on' : '');
    b.textContent = label + ' ' + n;
    b.onclick = () => { bucket = id; page = 0; render(); };
    t.appendChild(b);
  };
  mk('all', 'all', DATA.cards.length);
  for (const b of DATA.buckets) mk(b, b, DATA.counts[b]);
}

function render() {
  renderTabs();
  const all = visible();
  if (page >= pages()) page = pages() - 1;
  const slice = all.slice(page * DATA.perPage, page * DATA.perPage + DATA.perPage);
  const m = $('main');
  m.innerHTML = '';
  for (const c of slice) {
    const k = keyOf(c);
    const card = document.createElement('section');
    card.className = 'card' + (state[k] ? ' on' : '');

    const hero = document.createElement('div');
    hero.className = 'hero';
    hero.style.backgroundImage = 'url("/assets/images/bg/' + c.image + '")';
    const cap = document.createElement('p');
    cap.className = 'cap';
    cap.textContent = c.text;
    hero.appendChild(cap);
    hero.onclick = () => { state[k] = !state[k]; save(); render(); };
    card.appendChild(hero);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = c.bucket + ' · ' + c.time + ' · ' + c.week + '/' + c.day + ' · photo ' + c.photoId
      + (c.score ? ' · Astra ' + c.score + '/5' : '');
    card.appendChild(meta);

    const why = document.createElement('div');
    why.className = 'why';
    why.textContent = c.reason;
    card.appendChild(why);

    if (state[k]) {
      const r = document.createElement('div');
      r.className = 'rescued';
      r.textContent = '✓ rescued';
      card.appendChild(r);
    }
    m.appendChild(card);
  }
  $('page').textContent = 'page ' + (page + 1) + ' of ' + pages();
  $('ctx').textContent = all.length + ' cards in ' + (bucket === 'all' ? 'all buckets' : bucket);
  $('prev').disabled = page === 0;
  $('next').disabled = page >= pages() - 1;
  paintTally();
  window.scrollTo(0, 0);
}

$('prev').onclick = () => { if (page > 0) { page -= 1; render(); } };
$('next').onclick = () => { if (page < pages() - 1) { page += 1; render(); } };
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') $('prev').click();
  if (e.key === 'ArrowRight') $('next').click();
});

$('export').onclick = () => {
  const rescued = DATA.cards.filter((c) => state[keyOf(c)]).map((c) => ({
    image: c.image, hash: c.hash, bucket: c.bucket, condition: c.bucket,
    time: c.time, week: c.week, day: c.day, photoId: c.photoId,
    text: c.text, astraScore: c.score, astraReason: c.reason,
  }));
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    ruledBy: "Al, spot-check of Astra's held kills",
    note: 'Rescued lines only. Everything absent from this file remains unruled — not rejected.',
    heldTotal: DATA.cards.length,
    rescuedCount: rescued.length,
    rescued,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'astra-kill-rescues.json';
  a.click();
};

render();
</script>
`;

fs.writeFileSync(path.join(ROOT, 'review/astra-kill-gallery.html'), html);
console.log(`[kill gallery] review/astra-kill-gallery.html — ${cards.length} held lines, ${PER_PAGE} per screen, ${Math.ceil(cards.length / PER_PAGE)} pages`);
console.log('  by bucket', JSON.stringify(counts));
