// Build review/lines-review.html — tick the bespoke lines.
//
// Phase 3, Al's ruling of 2026-08-18 (option 2): a bespoke pass over the 15 new
// photographs plus the buckets with the weakest pass-1 approval rates. Five
// original EN lines per image, written for that specific picture against
// review/PAIRING-TASTE.md, plus a sixth free slot for Al's own.
//
// THE LINE IS SHOWN ON THE PICTURE, not beside it. The taste doc's finding 0 is
// that Al judges the PAIR, not the line: of 214 lines proposed three or more
// times, 174 got different verdicts on different images. A list of lines next to
// a thumbnail invites judging the writing. The card here is the real hero at its
// measured size with the shipped scrim and the caption font, and clicking a line
// puts it where it will actually live.
//
//   node scripts/build-lines-review-tool.mjs
// Serve it: node scripts/serve-review.mjs  ->  /review/lines-review.html
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);

const doc = JSON.parse(readFileSync(p('review/set-001-lines-bespoke.json'), 'utf8'));
const fold = JSON.parse(readFileSync(p('output/m8-fold/fold.json'), 'utf8'));
const row = fold.rows.find((r) => r.viewport === '375x812' && r.caption === 'longest');
const BOX = { w: row.heroWpx, h: row.heroPx };
const CAP = {
  runway: Math.max(38, Math.min(76, 7 * 812 / 100)),
  font: Math.min(4.2 * 812 / 100, 8.8 * 375 / 100),
  padBottom: Math.max(10, Math.min(20, 1.8 * 812 / 100)),
};

const DATA = JSON.stringify({ box: BOX, cap: CAP, images: doc.images });

const html = `<!doctype html>
<meta charset="utf-8">
<title>PW — bespoke lines, set-001</title>
<link rel="stylesheet" href="../assets/type-prototype-caption.css">
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700; --yes:#63c98a; --no:#ff6b6b; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:10px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0 8px 0 0; }
  button { font:inherit; border:1px solid rgba(246,242,232,.18); background:var(--panel); color:var(--ink);
           border-radius:8px; padding:6px 11px; cursor:pointer; }
  button:hover { border-color:var(--gold); }
  button.primary { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  .tally { color:var(--ink2); font-variant-numeric:tabular-nums; }
  main { padding:18px; display:flex; flex-direction:column; gap:30px; }
  .card { display:grid; grid-template-columns:auto 1fr; gap:22px; border-top:1px solid rgba(246,242,232,.12); padding-top:18px; }
  .hero { position:relative; overflow:hidden; background-size:cover; background-repeat:no-repeat;
          border-radius:0 0 20px 20px; box-shadow:0 18px 44px rgba(0,0,0,.55); }
  .cap { position:absolute; left:0; right:0; bottom:0; margin:0; color:#fff; font-weight:700;
         font-family:'Caveat Prototype','Segoe Print','Bradley Hand',cursive; text-align:left; line-height:1.08;
         text-shadow:0 2px 14px rgba(0,0,0,.7), 0 1px 3px rgba(0,0,0,.8); }
  .meta { color:var(--ink2); font-size:12.5px; margin-bottom:10px; }
  .meta b { color:var(--ink); }
  .seen { color:var(--ink2); font-size:12.5px; max-width:80ch; margin:0 0 12px; font-style:italic; }
  .note { color:#ffb84d; font-size:12.5px; max-width:80ch; margin:0 0 12px; }
  .line { display:flex; gap:8px; align-items:flex-start; margin-bottom:7px; }
  .line input[type=text] { flex:1; min-width:0; font:inherit; background:#181410; color:var(--ink);
      border:1px solid rgba(246,242,232,.16); border-radius:7px; padding:7px 10px; }
  .line input[type=text]:focus { outline:none; border-color:var(--gold); }
  .line .n { width:18px; color:var(--ink2); font-variant-numeric:tabular-nums; padding-top:8px; }
  .line .wc { width:58px; color:var(--ink2); font-size:11.5px; padding-top:9px; text-align:right; }
  .y.on { border-color:var(--yes); color:var(--yes); font-weight:700; }
  .n2.on { border-color:var(--no); color:var(--no); font-weight:700; }
  .line.mine input[type=text] { border-style:dashed; }
  .hint { color:var(--ink2); font-size:12px; margin:10px 0 0; max-width:80ch; }
</style>

<header>
  <h1>Bespoke lines — 42 photographs, five each</h1>
  <span class="tally" id="tally"></span>
  <span style="flex:1"></span>
  <button id="export" class="primary">Export</button>
</header>
<main id="main"></main>

<script>
const DATA = ${DATA};
const LS = 'pw_bespoke_lines_v1';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
const $ = (id) => document.getElementById(id);
const key = (img, i) => img + '#' + i;
const wc = (s) => (s.trim() ? s.trim().split(/\\s+/).length : 0);

function save() { localStorage.setItem(LS, JSON.stringify(state)); tally(); }

function tally() {
  let yes = 0, no = 0, mine = 0;
  for (const [k, v] of Object.entries(state)) {
    if (v.verdict === 'YES') yes += 1;
    if (v.verdict === 'NO') no += 1;
    if (k.endsWith('#5') && v.text && v.text.trim()) mine += 1;
  }
  const imagesWithAYes = new Set(Object.entries(state).filter(([, v]) => v.verdict === 'YES')
    .map(([k]) => k.split('#')[0])).size;
  $('tally').textContent = yes + ' ticked · ' + no + ' rejected · ' + mine + ' of your own · '
    + imagesWithAYes + '/' + DATA.images.length + ' images have at least one';
}

function render() {
  const m = $('main');
  m.innerHTML = '';
  for (const img of DATA.images) {
    const card = document.createElement('section');
    card.className = 'card';

    const hero = document.createElement('div');
    hero.className = 'hero';
    hero.style.width = DATA.box.w + 'px';
    hero.style.height = DATA.box.h + 'px';
    hero.style.backgroundImage = 'url("/assets/images/bg/' + img.image + '")';
    hero.style.backgroundPosition = 'center 50%';
    const cap = document.createElement('p');
    cap.className = 'cap';
    cap.style.padding = DATA.cap.runway.toFixed(1) + 'px 16px ' + DATA.cap.padBottom.toFixed(1) + 'px';
    cap.style.fontSize = DATA.cap.font.toFixed(1) + 'px';
    cap.style.background = 'linear-gradient(to top, rgba(0,0,0,.80) 0%, rgba(0,0,0,.62) calc(100% - '
      + DATA.cap.runway.toFixed(1) + 'px), rgba(0,0,0,0) 100%)';
    cap.style.borderRadius = '0 0 20px 20px';
    cap.textContent = img.lines[0];
    hero.appendChild(cap);
    card.appendChild(hero);

    const right = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = '<b>' + img.index + '. ' + img.condition + ' · ' + img.time + '</b> · ' + img.image
      + ' · ' + img.week + '/' + img.day + ' · ' + img.why + (img.pass1 ? ' · pass-1 ' + img.pass1 : '');
    right.appendChild(meta);

    const seen = document.createElement('p');
    seen.className = 'seen';
    seen.textContent = img.seen;
    right.appendChild(seen);

    if (img.note) {
      const n = document.createElement('p');
      n.className = 'note';
      n.textContent = img.note;
      right.appendChild(n);
    }

    // Five written lines plus a sixth, empty, for Al's own.
    for (let i = 0; i < 6; i += 1) {
      const k = key(img.image, i);
      const rec = state[k] || {};
      const wrap = document.createElement('div');
      wrap.className = 'line' + (i === 5 ? ' mine' : '');

      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = i === 5 ? '+' : String(i + 1);
      wrap.appendChild(n);

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = rec.text != null ? rec.text : (i < 5 ? img.lines[i] : '');
      if (i === 5) inp.placeholder = 'your own line for this picture…';
      const count = document.createElement('span');
      count.className = 'wc';
      const paint = () => {
        cap.textContent = inp.value || img.lines[0];
        count.textContent = wc(inp.value) + 'w';
      };
      inp.addEventListener('focus', paint);
      inp.addEventListener('input', () => {
        state[k] = Object.assign({}, state[k], { text: inp.value });
        paint(); save();
      });
      wrap.appendChild(inp);
      count.textContent = wc(inp.value) + 'w';
      wrap.appendChild(count);

      const yes = document.createElement('button');
      yes.className = 'y' + (rec.verdict === 'YES' ? ' on' : '');
      yes.textContent = '✓';
      yes.title = 'keep this line for this picture';
      yes.onclick = () => {
        state[k] = Object.assign({}, state[k], { text: inp.value, verdict: rec.verdict === 'YES' ? null : 'YES' });
        save(); render();
      };
      const no = document.createElement('button');
      no.className = 'n2' + (rec.verdict === 'NO' ? ' on' : '');
      no.textContent = '✕';
      no.title = 'not for this picture';
      no.onclick = () => {
        state[k] = Object.assign({}, state[k], { text: inp.value, verdict: rec.verdict === 'NO' ? null : 'NO' });
        save(); render();
      };
      wrap.appendChild(yes);
      wrap.appendChild(no);
      right.appendChild(wrap);
    }

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Click into a line to see it on the picture. Edit the text freely — the edit is what exports. '
      + 'The dashed slot is yours.';
    right.appendChild(hint);
    card.appendChild(right);
    m.appendChild(card);
  }
  tally();
}

$('export').onclick = () => {
  const out = { generated: '2026-08-18', ruledBy: 'Al, bespoke line review', images: [] };
  for (const img of DATA.images) {
    const kept = []; const rejected = [];
    for (let i = 0; i < 6; i += 1) {
      const rec = state[key(img.image, i)] || {};
      const text = rec.text != null ? rec.text : (i < 5 ? img.lines[i] : '');
      if (!text || !text.trim()) continue;
      const entry = { text: text.trim(), source: i === 5 ? 'al' : 'bespoke', edited: i < 5 && text.trim() !== img.lines[i] };
      if (rec.verdict === 'YES') kept.push(entry);
      else if (rec.verdict === 'NO') rejected.push(entry);
    }
    out.images.push({ image: img.image, hash: img.hash, condition: img.condition, time: img.time,
      week: img.week, day: img.day, paths: img.paths, kept, rejected });
  }
  out.keptCount = out.images.reduce((n, i) => n + i.kept.length, 0);
  out.imagesWithNone = out.images.filter((i) => !i.kept.length).map((i) => i.image);
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'set-001-lines-bespoke.json';
  a.click();
};

render();
</script>
`;

writeFileSync(p('review/lines-review.html'), html);
console.log(`[lines review] review/lines-review.html — ${doc.images.length} photographs, ${doc.images.length * 5} lines, card ${BOX.w}x${BOX.h}`);
