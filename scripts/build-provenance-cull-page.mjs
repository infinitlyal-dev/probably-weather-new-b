// Builds review/provenance-cull.html — Al's cull page (Job 2, 2026-09-20).
//
// His ruling: the app ships lines HE chose. scripts/provenance-split.mjs sorts
// every live (photograph, line) pair into A/B (his) and C/D (adopted in bulk, or
// on no record at all). This page is where he rules on the split.
//
//   VIEW 1 — THE KEEPERS. Every A and B line on its photograph, grouped by
//   condition. A confirmation pass, nothing more: the only act available is CUT,
//   for anything that slipped through. Default: kept.
//
//   VIEW 2 — THE CONDEMNED. Every C and D line on its photograph, with the label
//   saying how it got there. Default: CUT. The only act available is RESCUE. He
//   is not obliged to look at a single card — exporting without touching the view
//   cuts the lot, which is the ruling as briefed.
//
// The line is rendered ON the picture, never beside a thumbnail: PAIRING-TASTE
// finding 0 — he judges the pair.
//
// Exports review/provenance-cull-ruled.json. Nothing in this page writes to the
// repo and nothing here is wired: the export is the ruling, the wiring is a
// separate job after it.
//
//   node scripts/build-provenance-cull-page.mjs
// Open: review/provenance-cull.html straight off disk (file://).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitProvenance } from './provenance-split.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const PER_PAGE = 24;
const CARD = { w: 218, h: 345 };   // the 327x518 hero ratio, scaled

const { rows } = splitProvenance();

// One short, true sentence per card about how this line reached this photograph.
const WHY = (r) => {
  const rec = r.records.find((x) => x.bucket === r.bucket);
  if (r.bucket === 'A') return `you placed it — ${rec ? rec.how : 'drag-match tool'}`;
  if (r.bucket === 'B') return `you ticked it — ${rec ? rec.how : 'bespoke line review'}`;
  if (r.bucket === 'C') return `${rec ? rec.how : "Astra's verdict, adopted 2026-09-05"} — no per-line tick`;
  return r.orphaned
    ? 'no record for THIS photograph — the ruling was made on the picture this slot used to hold, before the reroll'
    : 'no ruled export behind it at all';
};

const cards = rows.map((r) => ({
  id: r.id,
  hash: r.hash,
  image: r.image,
  condition: r.condition,
  time: r.time,
  week: r.week,
  day: r.day,
  slots: r.slots,
  text: r.text,
  bucket: r.bucket,
  bank: r.bankTicked || '',
  why: WHY(r),
}));

const keepers = cards.filter((c) => c.bucket === 'A' || c.bucket === 'B');
const condemned = cards.filter((c) => c.bucket === 'C' || c.bucket === 'D');
const CONDITIONS = [...new Set(cards.map((c) => c.condition))].sort();
const photographs = new Set(cards.map((c) => c.hash)).size;

const DATA = JSON.stringify({
  cards, conditions: CONDITIONS, perPage: PER_PAGE, card: CARD, photographs,
  counts: {
    total: cards.length, keepers: keepers.length, condemned: condemned.length,
    A: cards.filter((c) => c.bucket === 'A').length, B: cards.filter((c) => c.bucket === 'B').length,
    C: cards.filter((c) => c.bucket === 'C').length, D: cards.filter((c) => c.bucket === 'D').length,
  },
});

const html = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PW — the provenance cull</title>
<link rel="stylesheet" href="../assets/type-prototype-caption.css">
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700;
          --yes:#63c98a; --no:#e05252; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:9px 14px; display:flex; gap:10px 12px; align-items:center; flex-wrap:wrap; }
  header .row { display:flex; gap:10px; align-items:center; flex:1 1 100%; flex-wrap:wrap; }
  h1 { font-size:14px; margin:0; white-space:nowrap; }
  .views { display:flex; gap:4px; }
  .view { border:1px solid rgba(246,242,232,.22); background:none; color:var(--ink2); border-radius:8px;
          padding:5px 12px; font:inherit; font-size:12.5px; cursor:pointer; }
  .view.on { color:#1a1a2e; background:var(--gold); border-color:var(--gold); font-weight:700; }
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
  .hint { color:var(--ink2); font-size:12.5px; padding:10px 16px 2px; max-width:96ch; line-height:1.5; }
  .hint b { color:var(--ink); }
  main { padding:14px 16px 20px; display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; }
  .card { width:${CARD.w}px; }
  .hero { position:relative; width:${CARD.w}px; height:${CARD.h}px; border-radius:0 0 14px 14px; overflow:hidden;
          background:#000 center/cover no-repeat; box-shadow:0 12px 30px rgba(0,0,0,.5);
          cursor:pointer; border:2px solid transparent; }
  .hero img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .card.cut .hero { border-color:var(--no); }
  .card.cut .hero img { filter:grayscale(1) brightness(.45); }
  .card.kept .hero { border-color:var(--yes); box-shadow:0 0 0 3px rgba(99,201,138,.25), 0 12px 30px rgba(0,0,0,.5); }
  .cap { position:absolute; left:0; right:0; bottom:0; margin:0; padding:26px 11px 9px; color:#fff; font-weight:700;
         font-family:'Caveat Prototype','Segoe Print','Bradley Hand',cursive; font-size:19px; line-height:1.1;
         text-shadow:0 2px 14px rgba(0,0,0,.7), 0 1px 3px rgba(0,0,0,.8);
         background:linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.62) 62%, rgba(0,0,0,0) 100%);
         border-radius:0 0 12px 12px; }
  .meta { color:var(--ink2); font-size:11px; margin:6px 0 2px; font-variant-numeric:tabular-nums; }
  .why { font-size:11.5px; line-height:1.35; }
  .why.a, .why.b { color:#8fbf9f; }
  .why.c, .why.d { color:#e0a94d; }
  .mark { font-size:11.5px; font-weight:700; margin-top:3px; }
  .mark.cut { color:var(--no); }
  .mark.kept { color:var(--yes); }
  .zero { color:var(--no); font-weight:700; }
  footer { position:sticky; bottom:0; background:rgba(20,17,13,.97); border-top:1px solid rgba(246,242,232,.14);
           padding:9px 14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
</style>

<header>
  <div class="row">
    <h1>The provenance cull</h1>
    <div class="views">
      <button class="view" id="v-keepers"></button>
      <button class="view" id="v-condemned"></button>
    </div>
    <span class="spacer"></span>
    <span class="tally" id="tally"></span>
    <button class="act" id="reset">Reset view</button>
    <button class="act pri" id="export">Export ruling</button>
  </div>
  <div class="tabs" id="tabs"></div>
</header>
<p class="hint" id="hint"></p>
<main id="main"></main>
<footer>
  <button class="act" id="prev">&larr; Prev</button>
  <span class="tally" id="page"></span>
  <button class="act" id="next">Next &rarr;</button>
  <span class="spacer"></span>
  <span class="tally" id="survive"></span>
</footer>

<script>
const DATA = ${DATA};
const LS = 'pw_provenance_cull';
const saved = JSON.parse(localStorage.getItem(LS) || '{}');
const state = { cut: saved.cut || {}, rescued: saved.rescued || {} };
const $ = (id) => document.getElementById(id);
const keyOf = (c) => c.hash + '#' + c.text;

let view = 'condemned';   // the view with the work in it opens first
let cond = 'all';
let page = 0;

const isKeeper = (c) => c.bucket === 'A' || c.bucket === 'B';
const pool = () => DATA.cards.filter((c) => (view === 'keepers') === isKeeper(c));
const visible = () => cond === 'all' ? pool() : pool().filter((c) => c.condition === cond);
const pages = () => Math.max(1, Math.ceil(visible().length / DATA.perPage));
// Where a card stands right now: keepers survive unless cut, condemned die unless rescued.
const surviving = (c) => isKeeper(c) ? !state.cut[keyOf(c)] : !!state.rescued[keyOf(c)];

function save() { localStorage.setItem(LS, JSON.stringify(state)); }

function toggle(c) {
  const k = keyOf(c);
  if (isKeeper(c)) { if (state.cut[k]) delete state.cut[k]; else state.cut[k] = true; }
  else { if (state.rescued[k]) delete state.rescued[k]; else state.rescued[k] = true; }
  save();
}

function stats() {
  const live = DATA.cards.filter(surviving);
  const photos = new Set(live.map((c) => c.hash));
  return {
    cut: Object.keys(state.cut).length,
    rescued: Object.keys(state.rescued).length,
    surviving: live.length,
    photosLeft: photos.size,
    atZero: DATA.photographs - photos.size,
  };
}

function paintChrome() {
  const s = stats();
  $('v-keepers').textContent = 'The keepers — A + B (' + DATA.counts.keepers + ')';
  $('v-condemned').textContent = 'The condemned — C + D (' + DATA.counts.condemned + ')';
  $('v-keepers').className = 'view' + (view === 'keepers' ? ' on' : '');
  $('v-condemned').className = 'view' + (view === 'condemned' ? ' on' : '');
  $('tally').textContent = view === 'keepers'
    ? s.cut + ' cut of ' + DATA.counts.keepers + ' keepers'
    : s.rescued + ' rescued of ' + DATA.counts.condemned + ' condemned';
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  $('survive').innerHTML = s.surviving + ' lines surviving on ' + plural(s.photosLeft, 'photograph', 'photographs') + ' · '
    + (s.atZero ? '<span class="zero">' + plural(s.atZero, 'photograph', 'photographs') + ' at zero</span>'
                : 'no photograph at zero');
  $('hint').innerHTML = view === 'keepers'
    ? 'Every line you placed or ticked yourself, on its photograph. <b>These are kept by default.</b> Click a card only to CUT one that slipped through. You do not have to go through them.'
    : 'Every line adopted in bulk or standing on no record. <b>These are all cut by default</b> — export now and the lot goes. Click a card to RESCUE one you want to keep.';
}

function renderTabs() {
  const t = $('tabs');
  t.innerHTML = '';
  const p = pool();
  const mk = (id, label, n) => {
    if (id !== 'all' && !n) return;
    const b = document.createElement('button');
    b.className = 'tab' + (cond === id ? ' on' : '');
    b.textContent = label + ' ' + n;
    b.onclick = () => { cond = id; page = 0; render(); };
    t.appendChild(b);
  };
  mk('all', 'all', p.length);
  for (const c of DATA.conditions) mk(c, c, p.filter((x) => x.condition === c).length);
}

function render() {
  paintChrome();
  renderTabs();
  const all = visible();
  if (page >= pages()) page = pages() - 1;
  if (page < 0) page = 0;
  const m = $('main');
  m.innerHTML = '';
  for (const c of all.slice(page * DATA.perPage, page * DATA.perPage + DATA.perPage)) {
    const live = surviving(c);
    const card = document.createElement('section');
    card.className = 'card ' + (live ? 'kept' : 'cut');

    const hero = document.createElement('div');
    hero.className = 'hero';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = '../assets/images/bg/' + c.image;
    img.alt = '';
    hero.appendChild(img);
    const cap = document.createElement('p');
    cap.className = 'cap';
    cap.textContent = c.text;
    hero.appendChild(cap);
    hero.onclick = () => { toggle(c); render(); };
    card.appendChild(hero);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = c.bucket + ' · ' + c.id + ' · ' + c.condition + '/' + c.time + ' · ' + c.week + '/' + c.day
      + (c.slots > 1 ? ' · ' + c.slots + ' slots' : '');
    card.appendChild(meta);

    const why = document.createElement('div');
    why.className = 'why ' + c.bucket.toLowerCase();
    why.textContent = c.why + (c.bank ? ' · you kept this sentence in the bank review (' + c.bank + ')' : '');
    card.appendChild(why);

    const mark = document.createElement('div');
    mark.className = 'mark ' + (live ? 'kept' : 'cut');
    mark.textContent = live ? (isKeeper(c) ? '' : '✓ rescued') : (isKeeper(c) ? '✗ cut' : '✗ cut');
    if (mark.textContent) card.appendChild(mark);

    m.appendChild(card);
  }
  $('page').textContent = 'page ' + (page + 1) + ' of ' + pages();
  $('prev').disabled = page === 0;
  $('next').disabled = page >= pages() - 1;
  window.scrollTo(0, 0);
}

$('v-keepers').onclick = () => { view = 'keepers'; cond = 'all'; page = 0; render(); };
$('v-condemned').onclick = () => { view = 'condemned'; cond = 'all'; page = 0; render(); };
$('prev').onclick = () => { if (page > 0) { page -= 1; render(); } };
$('next').onclick = () => { if (page < pages() - 1) { page += 1; render(); } };
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') $('prev').click();
  if (e.key === 'ArrowRight') $('next').click();
});

$('reset').onclick = () => {
  const what = view === 'keepers' ? 'cuts' : 'rescues';
  if (!confirm('Clear every one of your ' + what + ' in this view?')) return;
  if (view === 'keepers') state.cut = {}; else state.rescued = {};
  save(); render();
};

$('export').onclick = () => {
  const strip = (c) => ({
    id: c.id, hash: c.hash, image: c.image, condition: c.condition,
    time: c.time, week: c.week, day: c.day, slots: c.slots, text: c.text,
    bucket: c.bucket, provenance: c.why,
  });
  const cutFromKeepers = DATA.cards.filter((c) => isKeeper(c) && !surviving(c)).map(strip);
  const rescued = DATA.cards.filter((c) => !isKeeper(c) && surviving(c)).map(strip);
  const keep = DATA.cards.filter(surviving).map(strip);
  const cut = DATA.cards.filter((c) => !surviving(c)).map(strip);
  const photosLeft = new Set(keep.map((c) => c.hash));
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    ruledBy: 'Al, provenance cull',
    note: 'The app ships lines Al chose. A and B survive unless cut here; C and D are cut unless rescued here. '
        + 'Nothing in this file is wired — it is the ruling, not the change.',
    liveBefore: { lines: DATA.counts.total, photographs: DATA.photographs, ...DATA.counts },
    ruling: { cutFromKeepers: cutFromKeepers.length, rescued: rescued.length },
    after: { lines: keep.length, photographs: photosLeft.size, photographsAtZero: DATA.photographs - photosLeft.size },
    cutFromKeepers, rescued, keep, cut,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'provenance-cull-ruled.json';
  a.click();
};

render();
</script>
`;

writeFileSync(path.join(root, 'review/provenance-cull.html'), html);
const n = (b) => cards.filter((c) => c.bucket === b).length;
console.log(`[cull] review/provenance-cull.html — ${cards.length} pairs on ${photographs} photographs`);
console.log(`  keepers A ${n('A')} + B ${n('B')} = ${keepers.length}  |  condemned C ${n('C')} + D ${n('D')} = ${condemned.length}`);
console.log(`  ${PER_PAGE} per page; exports review/provenance-cull-ruled.json`);
