// Builds review/bare-photo-gallery.html — the photographs that still carry no bespoke line,
// each showing Astra's new lines for that photograph. Click = keep. Same format as the kill
// gallery (Al's instruction, 2026-09-06).
//
// "Bare" is computed against the SHIPPED table (assets/hero-lines.js), not against the
// matcher's view. The matching tool reports 87 photographs at zero and 50 after the rescues,
// but it only counts round-1 bank placements — it cannot see the bespoke lines already wired
// from earlier rounds. 28 of those 50 already carry approved lines (all 20 wind photographs
// carry five each), so the real bare set is 22, and 15 of those have Astra candidates.
//
//   node scripts/build-bare-photo-gallery.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CARD = { w: 218, h: 345 };
const PER_PAGE = 20;
const BUCKETS = ['cold', 'cold-clear', 'fog', 'rain', 'storm', 'heat'];

const heroSrc = fs.readFileSync(path.join(ROOT, 'assets/hero-lines.js'), 'utf8');
const heroBlock = heroSrc.slice(heroSrc.indexOf('__HERO_LINES__'), heroSrc.indexOf('\n});'));
const wiredSlots = new Set();
for (const m of heroBlock.matchAll(/^\s*"([^"]+)":\s*\[/gm)) {
  if (m[1].startsWith('bg/')) wiredSlots.add(m[1].slice(3));
}
if (!wiredSlots.size) throw new Error('parsed 0 wired slot keys from hero-lines.js');

const draft = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/set-001-draft.json'), 'utf8'));
const byHash = new Map();
for (const a of draft.assignments) if (!byHash.has(a.hash)) byHash.set(a.hash, a);

// Astra's new lines, keyed by photograph.
const candidates = new Map();
for (const bucket of BUCKETS) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, `review/set-001-lines-bespoke-${bucket}-v3-astra-ruled.json`), 'utf8'));
  for (const image of doc.images) {
    const fresh = (image.kept || []).filter((k) => k.source === 'astra-new');
    if (fresh.length) candidates.set(image.hash, fresh);
  }
}

const bare = [...byHash.values()].filter((a) => !wiredSlots.has(a.image));
const withCandidates = bare.filter((a) => candidates.has(a.hash));
const withoutCandidates = bare.filter((a) => !candidates.has(a.hash));

const cards = [];
for (const a of withCandidates) {
  for (const line of candidates.get(a.hash)) {
    cards.push({
      image: a.image, hash: a.hash, condition: a.condition, time: a.time,
      week: a.week, day: a.day, text: line.text, astraTime: line.astraTime || '',
    });
  }
}

const conditions = [...new Set(cards.map((c) => c.condition))];
const counts = Object.fromEntries(conditions.map((c) => [c, cards.filter((x) => x.condition === c).length]));
const DATA = JSON.stringify({
  cards, conditions, counts, perPage: PER_PAGE, card: CARD,
  photographs: withCandidates.length,
  noCandidates: withoutCandidates.map((a) => ({ image: a.image, condition: a.condition, time: a.time })),
});

const html = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PW — the bare photographs</title>
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
  .kept { color:var(--yes); font-size:11.5px; font-weight:700; }
  footer { position:sticky; bottom:0; background:rgba(20,17,13,.97); border-top:1px solid rgba(246,242,232,.14);
           padding:9px 14px; display:flex; gap:10px; align-items:center; }
  .hint { color:var(--ink2); font-size:12px; padding:0 16px; margin:6px 0 0; }
  .none { color:#e0a94d; font-size:12px; padding:0 16px; margin:6px 0 0; }
</style>

<header>
  <h1>The bare photographs — click a line to keep it</h1>
  <div class="tabs" id="tabs"></div>
  <span class="spacer"></span>
  <span class="tally" id="tally"></span>
  <button class="act pri" id="export">Export keeps</button>
</header>
<p class="hint" id="scope"></p>
<p class="none" id="none"></p>
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
const LS = 'pw_bare_photo_keeps';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
const $ = (id) => document.getElementById(id);
const keyOf = (c) => c.image + '#' + c.text;
let cond = 'all';
let page = 0;

const visible = () => cond === 'all' ? DATA.cards : DATA.cards.filter((c) => c.condition === cond);
const pages = () => Math.max(1, Math.ceil(visible().length / DATA.perPage));

function save() { localStorage.setItem(LS, JSON.stringify(state)); paintTally(); }

function paintTally() {
  const kept = Object.values(state).filter(Boolean).length;
  const covered = new Set(DATA.cards.filter((c) => state[keyOf(c)]).map((c) => c.image)).size;
  $('tally').textContent = kept + ' kept · ' + covered + '/' + DATA.photographs + ' photographs covered';
}

function renderTabs() {
  const t = $('tabs');
  t.innerHTML = '';
  const mk = (id, label, n) => {
    const b = document.createElement('button');
    b.className = 'tab' + (cond === id ? ' on' : '');
    b.textContent = label + ' ' + n;
    b.onclick = () => { cond = id; page = 0; render(); };
    t.appendChild(b);
  };
  mk('all', 'all', DATA.cards.length);
  for (const c of DATA.conditions) mk(c, c, DATA.counts[c]);
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
    meta.textContent = c.condition + ' · ' + c.time + ' · ' + c.week + '/' + c.day;
    card.appendChild(meta);

    if (state[k]) {
      const r = document.createElement('div');
      r.className = 'kept';
      r.textContent = '✓ keep';
      card.appendChild(r);
    }
    m.appendChild(card);
  }
  $('page').textContent = 'page ' + (page + 1) + ' of ' + pages();
  $('ctx').textContent = all.length + ' lines in ' + (cond === 'all' ? 'all conditions' : cond);
  $('prev').disabled = page === 0;
  $('next').disabled = page >= pages() - 1;
  $('scope').textContent = DATA.photographs + ' photographs with no bespoke line, ' + DATA.cards.length
    + ' Astra candidates between them. Anything you do not tick stays unruled.';
  $('none').textContent = DATA.noCandidates.length
    ? DATA.noCandidates.length + ' more bare photographs have NO candidates at all (never in Astra\\u2019s six buckets): '
      + DATA.noCandidates.map((n) => n.image).join(', ')
    : '';
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
  const kept = DATA.cards.filter((c) => state[keyOf(c)]).map((c) => ({
    image: c.image, hash: c.hash, condition: c.condition, time: c.time,
    week: c.week, day: c.day, text: c.text, source: 'astra-new',
  }));
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    ruledBy: 'Al, bare-photograph gallery',
    note: 'Kept lines only. Bare photographs left uncovered still have no bespoke line.',
    photographsOffered: DATA.photographs,
    photographsCovered: new Set(kept.map((k) => k.image)).size,
    noCandidates: DATA.noCandidates,
    keptCount: kept.length,
    kept,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'bare-photo-keeps.json';
  a.click();
};

render();
</script>
`;

fs.writeFileSync(path.join(ROOT, 'review/bare-photo-gallery.html'), html);
console.log(`[bare gallery] review/bare-photo-gallery.html`);
console.log(`  bare photographs (against the shipped table): ${bare.length}`);
console.log(`  with Astra candidates: ${withCandidates.length} (${cards.length} lines, ${Math.ceil(cards.length / PER_PAGE)} pages)`);
console.log(`  with no candidates at all: ${withoutCandidates.length} — ${withoutCandidates.map((a) => a.image).join(', ')}`);
