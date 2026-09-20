// Builds review/slot-fill-rain-w2-d3.html — the one photograph the provenance cull
// left with no line, and the candidates for it.
//
// THE SLOT IS rain/week_2/day/3.webp + rain/week_4/day/3.webp, photograph
// fec85aba3f48. The 2026-09-20 brief named rain/week_2/day/5.webp; that was my
// error. The authoring entry still carries `image: rain/week_2/day/5.webp` from
// before the reroll, and I read it as the slot. day/5 holds a different
// photograph (a0ef2720c507, two men under one umbrella) and is untouched.
//
// TWO GROUPS, because the record turned out to be different from what the cull
// page said:
//
//   RESTORE — the three lines the cull removed. They were labelled "no record" on
//   the cull page. They have one: review/reroll-candidates/rain-w2-d3/candidates.json,
//   2026-09-16, `chosen.ruledBy: "Al"`, and the ruling NAMES these three lines —
//   Al picked candidate 2 of 3 as the photograph to carry them. Only the first was
//   also his own drag placement; the other two came from Astra's bucket and were
//   swept up by the reroll ruling. Nothing is resurrected by this page: it ticks,
//   it does not wire.
//
//   FILL — bank lines Al ruled KEEP that no photograph currently carries, picked
//   against what is actually in this frame: a windscreen in heavy rain, wipers
//   mid-sweep, stacked brake lights, a minibus taxi ahead, a hillside suburb
//   behind. Each already has native-reviewed Afrikaans in the condition bank, so
//   promoting one costs no new translation.
//
// Exports review/slot-fill-rain-w2-d3-ruled.json. The slot stays at zero — serving
// a condition-bank line, which is the documented behaviour for a photograph with
// no bespoke lines — until Al rules.
//
//   node scripts/build-slot-fill-page.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEATHER_COPY } from '../assets/weather-copy.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, 'review', ...p);

const authoring = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8'));
const slot = (authoring.awaitingLines || [])[0];
if (!slot) throw new Error('no photograph is awaiting lines — nothing to fill');

const reroll = JSON.parse(readFileSync(R('reroll-candidates', 'rain-w2-d3', 'candidates.json'), 'utf8'));
const draft = JSON.parse(readFileSync(R('set-001-draft.json'), 'utf8'));
const assignment = draft.assignments.find((a) => a.hash === slot.hash);
const paths = [...new Set([assignment.image, ...(assignment.paths || [])])];

// Al's own drag placement, as against the two the reroll ruling swept up with it.
const placed = new Set(
  (JSON.parse(readFileSync(R('set-001-line-matches-ruled.json'), 'utf8')).matchDetail || [])
    .filter((m) => m.hash === reroll.oldHash)
    .flatMap((m) => (m.lines || []).map((l) => l.text)),
);

const af = (en) => {
  const i = WEATHER_COPY.witty.rain.en.indexOf(en);
  return i >= 0 ? (WEATHER_COPY.witty.rain.af || [])[i] || '' : '';
};

const cards = [
  ...(slot.cutLines || []).map((text) => ({
    group: 'restore',
    text,
    id: '',
    why: placed.has(text)
      ? 'your own drag placement onto the photograph this one replaced, then named in your reroll ruling of 2026-09-16'
      : "Astra's rain bucket originally, then named in your reroll ruling of 2026-09-16 — you chose this photograph to carry it",
    af: af(text),
  })),
  ...[
    ['witty:rain:27', 'Every taxi on the road has decided to freestyle.', 'there is a minibus taxi in the middle of the frame'],
    ['witty:rain:14', "Everyone's forgotten how to drive. Again.", 'the stack of brake lights on wet tar is the whole picture'],
    ['witty:rain:5', 'Joburg drivers are panicking already.', 'highway traffic under a hillside suburb reads Joburg'],
  ].map(([id, text, why]) => ({
    group: 'fill',
    text,
    id,
    why: `bank line you ruled KEEP (2026-07-05), on no photograph — ${why}`,
    af: af(text),
  })),
];

const DATA = JSON.stringify({
  cards,
  slot: { hash: slot.hash, image: paths[0], paths, condition: slot.condition, time: slot.time, week: slot.week, day: slot.day },
  reroll: { ruledOn: reroll.chosen.ruledOn, chosen: reroll.chosen.n, of: reroll.candidates.length, oldHash: reroll.oldHash },
});

const html = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PW — the one slot with no line</title>
<link rel="stylesheet" href="../assets/type-prototype-caption.css">
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700; --yes:#63c98a; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:9px 14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:14px; margin:0; white-space:nowrap; }
  h2 { font-size:12.5px; margin:16px 0 0; color:var(--gold); text-transform:uppercase; letter-spacing:.07em; }
  button.act { font:inherit; font-size:12px; border:1px solid rgba(246,242,232,.18); background:var(--panel);
               color:var(--ink); border-radius:7px; padding:5px 10px; cursor:pointer; }
  button.pri { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  .tally { color:var(--ink2); font-size:12px; font-variant-numeric:tabular-nums; }
  .spacer { flex:1; }
  .hint { color:var(--ink2); font-size:12.5px; padding:10px 16px 0; max-width:104ch; line-height:1.55; }
  .hint b { color:var(--ink); }
  .hint code { color:#e0a94d; font-size:12px; }
  main { padding:6px 16px 24px; }
  .row { display:flex; flex-wrap:wrap; gap:14px; align-items:flex-start; padding-top:10px; }
  .card { width:200px; }
  .hero { position:relative; width:200px; height:317px; border-radius:0 0 14px 14px; overflow:hidden;
          background:#000 center/cover no-repeat; box-shadow:0 12px 30px rgba(0,0,0,.5);
          cursor:pointer; border:2px solid transparent; }
  .hero img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .card.on .hero { border-color:var(--yes); box-shadow:0 0 0 3px rgba(99,201,138,.25), 0 12px 30px rgba(0,0,0,.5); }
  .card:not(.on) .hero img { filter:grayscale(.55) brightness(.72); }
  .cap { position:absolute; left:0; right:0; bottom:0; margin:0; padding:26px 11px 9px; color:#fff; font-weight:700;
         font-family:'Caveat Prototype','Segoe Print','Bradley Hand',cursive; font-size:18px; line-height:1.1;
         text-shadow:0 2px 14px rgba(0,0,0,.7), 0 1px 3px rgba(0,0,0,.8);
         background:linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.62) 62%, rgba(0,0,0,0) 100%);
         border-radius:0 0 12px 12px; }
  .meta { color:var(--ink2); font-size:11px; margin:6px 0 2px; }
  .why { color:#8fbf9f; font-size:11.5px; line-height:1.35; }
  .afx { color:var(--ink2); font-size:11px; margin-top:4px; font-style:italic; }
  .mark { color:var(--yes); font-size:11.5px; font-weight:700; margin-top:3px; }
</style>

<header>
  <h1>The one slot the cull left bare</h1>
  <span class="tally" id="slot"></span>
  <span class="spacer"></span>
  <span class="tally" id="tally"></span>
  <button class="act" id="reset">Clear ticks</button>
  <button class="act pri" id="export">Export ruling</button>
</header>
<p class="hint" id="hint"></p>
<main id="main"></main>

<script>
const DATA = ${DATA};
const LS = 'pw_slot_fill_rain_w2_d3';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
const $ = (id) => document.getElementById(id);

function save() { localStorage.setItem(LS, JSON.stringify(state)); }

function render() {
  $('slot').textContent = DATA.slot.paths.join(' + ') + ' · ' + DATA.slot.hash;
  $('tally').textContent = Object.values(state).filter(Boolean).length + ' ticked of ' + DATA.cards.length;
  $('hint').innerHTML = 'This photograph carries no line: all three of its lines came out in the cull, so it serves a condition-bank line. '
    + '<b>One correction first.</b> The cull page labelled those three "no record". They have one — <code>review/reroll-candidates/rain-w2-d3/candidates.json</code>, '
    + DATA.reroll.ruledOn + ', where you chose candidate ' + DATA.reroll.chosen + ' of ' + DATA.reroll.of + ' and the ruling names these three lines: '
    + 'this photograph was made to carry them. I read the slot off a stale field and called it orphaned. '
    + 'Tick whatever you want on this photograph — restore, replace, or a mix. Nothing is wired until you export and I apply it.';

  const m = $('main');
  m.innerHTML = '';
  for (const [group, title] of [['restore', 'The three the cull removed'], ['fill', 'Bank lines on no photograph']]) {
    const h = document.createElement('h2');
    h.textContent = title;
    m.appendChild(h);
    const row = document.createElement('div');
    row.className = 'row';
    for (const c of DATA.cards.filter((x) => x.group === group)) {
      const on = !!state[c.text];
      const card = document.createElement('section');
      card.className = 'card' + (on ? ' on' : '');

      const hero = document.createElement('div');
      hero.className = 'hero';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = '../assets/images/bg/' + DATA.slot.image;
      img.alt = '';
      hero.appendChild(img);
      const cap = document.createElement('p');
      cap.className = 'cap';
      cap.textContent = c.text;
      hero.appendChild(cap);
      hero.onclick = () => { if (state[c.text]) delete state[c.text]; else state[c.text] = true; save(); render(); };
      card.appendChild(hero);

      if (c.id) {
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = c.id;
        card.appendChild(meta);
      }
      const why = document.createElement('div');
      why.className = 'why';
      why.textContent = c.why;
      card.appendChild(why);

      const afx = document.createElement('div');
      afx.className = 'afx';
      afx.textContent = c.af ? 'AF: ' + c.af : 'AF: none yet — it would need one written';
      card.appendChild(afx);

      if (on) {
        const mk = document.createElement('div');
        mk.className = 'mark';
        mk.textContent = '✓ on this photograph';
        card.appendChild(mk);
      }
      row.appendChild(card);
    }
    m.appendChild(row);
  }
}

$('reset').onclick = () => { for (const k of Object.keys(state)) delete state[k]; save(); render(); };

$('export').onclick = () => {
  const chosen = DATA.cards.filter((c) => state[c.text]).map((c) => ({ text: c.text, group: c.group, id: c.id, af: c.af }));
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    ruledBy: 'Al, slot fill after the provenance cull',
    slot: DATA.slot,
    note: 'Lines Al wants on this photograph. An empty list means leave it on the condition bank.',
    chosenCount: chosen.length,
    chosen,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'slot-fill-rain-w2-d3-ruled.json';
  a.click();
};

render();
</script>
`;

writeFileSync(R('slot-fill-rain-w2-d3.html'), html);
console.log(`[slot fill] review/slot-fill-rain-w2-d3.html — ${slot.hash} at ${paths.join(' + ')}`);
console.log(`  ${cards.filter((c) => c.group === 'restore').length} to restore, ${cards.filter((c) => c.group === 'fill').length} bank candidates; exports review/slot-fill-rain-w2-d3-ruled.json`);
