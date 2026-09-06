// Builds review/write-lines.html — the photographs that still carry no line, big, with a
// box under each one for Al to write in (his request, 2026-09-06).
//
// Nothing is proposed here. There are no candidates for these photographs: clear and cloudy
// were never in Astra's six buckets, so nothing was ever written for them. The page is a
// writing surface, not a review surface.
//
// The line he types paints onto the photograph as he types it, at the shipped caption size
// with the shipped scrim, because the pairing is the thing being judged (PAIRING-TASTE.md
// finding 0) and a line read beside a thumbnail is a different judgement.
//
//   node scripts/build-write-lines-page.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CARD = { w: 327, h: 518 };   // the measured hero box at 375x812

const heroSrc = fs.readFileSync(path.join(ROOT, 'assets/hero-lines.js'), 'utf8');
const heroBlock = heroSrc.slice(heroSrc.indexOf('__HERO_LINES__'), heroSrc.indexOf('\n});'));
const wired = new Set();
for (const m of heroBlock.matchAll(/^\s*"([^"]+)":\s*\[/gm)) if (m[1].startsWith('bg/')) wired.add(m[1].slice(3));
if (!wired.size) throw new Error('parsed 0 wired slot keys from hero-lines.js');

const draft = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/set-001-draft.json'), 'utf8'));
const seen = new Map();
for (const a of draft.assignments) if (!seen.has(a.hash)) seen.set(a.hash, a);

const bare = [...seen.values()]
  .filter((a) => !wired.has(a.image))
  .sort((a, b) => a.condition.localeCompare(b.condition) || a.time.localeCompare(b.time) || a.image.localeCompare(b.image))
  .map((a) => ({
    image: a.image, hash: a.hash, condition: a.condition, time: a.time,
    week: a.week, day: a.day, slots: (a.paths || [a.image]).length,
  }));

const DATA = JSON.stringify({ bare, card: CARD });

const html = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PW — write the last lines</title>
<link rel="stylesheet" href="../assets/type-prototype-caption.css">
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700; --yes:#63c98a; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:10px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0; }
  button.act { font:inherit; font-size:12.5px; border:1px solid rgba(246,242,232,.18); background:var(--panel);
               color:var(--ink); border-radius:7px; padding:6px 11px; cursor:pointer; }
  button.pri { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  .tally { color:var(--ink2); font-size:12.5px; font-variant-numeric:tabular-nums; }
  .spacer { flex:1; }
  .hint { color:var(--ink2); font-size:12.5px; padding:10px 16px 0; margin:0; max-width:96ch; }
  main { padding:18px 16px 60px; display:flex; flex-wrap:wrap; gap:26px; align-items:flex-start; }
  .card { width:${CARD.w}px; }
  .hero { position:relative; width:${CARD.w}px; height:${CARD.h}px; border-radius:0 0 20px 20px; overflow:hidden;
          background-size:cover; background-position:center 50%; box-shadow:0 18px 44px rgba(0,0,0,.55); }
  .cap { position:absolute; left:0; right:0; bottom:0; margin:0; padding:57px 16px 15px; color:#fff; font-weight:700;
         font-family:'Caveat Prototype','Segoe Print','Bradley Hand',cursive; font-size:33px; line-height:1.08;
         text-shadow:0 2px 14px rgba(0,0,0,.7), 0 1px 3px rgba(0,0,0,.8);
         background:linear-gradient(to top, rgba(0,0,0,.80) 0%, rgba(0,0,0,.62) calc(100% - 57px), rgba(0,0,0,0) 100%);
         border-radius:0 0 20px 20px; }
  .meta { color:var(--ink2); font-size:12px; margin:9px 0 6px; }
  .meta b { color:var(--ink); }
  textarea { width:100%; min-height:96px; font:inherit; background:#181410; color:var(--ink); resize:vertical;
             border:1px solid rgba(246,242,232,.18); border-radius:8px; padding:9px 11px; line-height:1.6; }
  textarea:focus { outline:none; border-color:var(--gold); }
  .row { display:flex; align-items:center; gap:10px; margin-top:5px; }
  .count { color:var(--ink2); font-size:11.5px; }
  .count b { color:var(--yes); }
</style>

<header>
  <h1>The last photographs — write their lines</h1>
  <span class="tally" id="tally"></span>
  <span class="spacer"></span>
  <button class="act pri" id="export">Export</button>
</header>
<p class="hint">One line per row. What you type paints onto the photograph at the size it ships — the top line in the box is the one shown. Nothing was ever written for these seven, so there is nothing here to react to. Autosaves as you type.</p>
<main id="main"></main>

<script>
const DATA = ${DATA};
const LS = 'pw_write_last_lines';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
const $ = (id) => document.getElementById(id);
const rows = (s) => String(s || '').split('\\n').map((x) => x.trim()).filter(Boolean);

function tally() {
  const done = DATA.bare.filter((b) => rows(state[b.image]).length).length;
  const lines = DATA.bare.reduce((n, b) => n + rows(state[b.image]).length, 0);
  $('tally').textContent = done + '/' + DATA.bare.length + ' photographs written · ' + lines + ' lines';
}

function save() { localStorage.setItem(LS, JSON.stringify(state)); tally(); }

for (const b of DATA.bare) {
  const card = document.createElement('section');
  card.className = 'card';

  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.style.backgroundImage = 'url("/assets/images/bg/' + b.image + '")';
  const cap = document.createElement('p');
  cap.className = 'cap';
  hero.appendChild(cap);
  card.appendChild(hero);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = '<b>' + b.condition + ' · ' + b.time + '</b> · ' + b.image + ' · ' + b.week + '/' + b.day
    + (b.slots > 1 ? ' · ' + b.slots + ' rotation slots' : '');
  card.appendChild(meta);

  const ta = document.createElement('textarea');
  ta.value = state[b.image] || '';
  ta.placeholder = 'One line per row…';
  const count = document.createElement('span');
  count.className = 'count';
  const paint = () => {
    const r = rows(ta.value);
    cap.textContent = r[0] || '';
    count.innerHTML = '<b>' + r.length + '</b> line' + (r.length === 1 ? '' : 's');
  };
  ta.addEventListener('input', () => { state[b.image] = ta.value; paint(); save(); });
  card.appendChild(ta);

  const row = document.createElement('div');
  row.className = 'row';
  row.appendChild(count);
  card.appendChild(row);

  $('main').appendChild(card);
  paint();
}

$('export').onclick = () => {
  const images = DATA.bare
    .map((b) => ({ image: b.image, hash: b.hash, condition: b.condition, time: b.time,
      week: b.week, day: b.day, lines: rows(state[b.image]) }))
    .filter((e) => e.lines.length);
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    ruledBy: 'Al, written directly onto the last bare photographs',
    offered: DATA.bare.length,
    written: images.length,
    lineCount: images.reduce((n, e) => n + e.lines.length, 0),
    stillBare: DATA.bare.filter((b) => !rows(state[b.image]).length).map((b) => b.image),
    images,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'al-written-lines.json';
  a.click();
};

tally();
</script>
`;

fs.writeFileSync(path.join(ROOT, 'review/write-lines.html'), html);
console.log(`[write lines] review/write-lines.html — ${bare.length} photographs with no line`);
for (const b of bare) console.log(`  ${b.condition.padEnd(7)} ${b.time.padEnd(5)} ${b.image}`);
