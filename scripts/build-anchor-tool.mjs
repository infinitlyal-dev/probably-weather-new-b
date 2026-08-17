// Build review/crop-anchor-tool.html — the curation tool.
//
// Al, 2026-08-10: "can we do this in a way that i can just drag and drop each
// frame to where the focus needs to lie." That was M7, and the answer was a
// drag-the-band tool against the polaroid's letterbox crop.
//
// REBUILT 2026-08-17 for the home meme + the light (Al's rulings of 08-14 and
// 08-17, both shipped in 2d793cd). Three things changed underneath it and all
// three change what curation means:
//
//   1. THE WINDOW IS ENORMOUS NOW. The polaroid showed 56% of a source frame on
//      Al's phone and 27% on the worst one. The meme hero shows 89% and 51%.
//      Measured, not estimated — scripts/verify-home-fold.mjs records the card
//      box on all 18 viewports and this reads it. The anchor still matters on
//      the small phones; on a normal one it is close to "the whole picture".
//   2. THE LINE IS ON THE PICTURE. So a crop is no longer judgeable on its own:
//      the bottom third of every photograph now sits under a scrim with the
//      joke written across it. This tool previews THE REAL COMPOSITION — the
//      card at its true pixel size, the real scrim, a real witty line for that
//      condition, in the caption font.
//   3. AL AUTHORISED A SECOND INK. "we can always easily have another colour as
//      well for the writing if an image loses the white." v1 shipped white-only
//      because per-image ink had to wait for a curation pass. This is that pass,
//      so the ink toggle lives here, per image, previewed both ways.
//
// And the verdict is no longer only about the crop. Al is re-curating the whole
// library against a composition he has not seen it in, so every image takes a
// KEEP or a CUT, and the cuts export as their own list for re-shooting.
//
// Self-contained: open it by double-clicking. Images load over relative file://
// paths out of assets/images/bg, the caption font over ../assets, every
// judgement autosaves to localStorage.
//
//   node scripts/build-anchor-tool.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);

const draft = JSON.parse(readFileSync(p('review/set-001-draft.json'), 'utf8'));
const assignments = Array.isArray(draft) ? draft : (draft.assignments || draft.images);
const ruled = JSON.parse(readFileSync(p('review/set-001-crop-anchors.json'), 'utf8')).anchors || {};
const fold = JSON.parse(readFileSync(p('output/m8-fold/fold.json'), 'utf8'));
const copy = (() => {
  const src = readFileSync(p('assets/copy/en.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
})();

// ---- geometry, taken from the fold gate rather than from arithmetic ---------
// Deriving the card box from margins would be a guess that a later CSS block
// can silently invalidate; the gate measures the live element on every run.
const boxOf = (viewport) => {
  const r = fold.rows.find((x) => x.viewport === viewport && x.caption === 'longest');
  if (!r || !r.heroWpx) throw new Error(`no measured hero box for ${viewport} — run node scripts/verify-home-fold.mjs`);
  return { viewport, device: r.device, width: r.heroWpx, height: r.heroPx };
};
const REF = boxOf('375x812');    // Al's phone
const WORST = boxOf('320x488');  // tightest card in the matrix
const SRC = 1008 / 1792;         // every source is this 9:16
// The share of a source frame the card can show: `cover` scales to the card's
// width, so the visible slice is (cardH / cardW) * sourceAspect.
const fOf = (b) => Math.min(1, (b.height / b.width) * SRC);

// The caption's own numbers, resolved at each viewport exactly as the clamps in
// app.css resolve them, so the preview is the shipped composition and not an
// impression of it. --meme-runway, --meme-cap-fs and the padding, in order.
const capMetrics = (b) => {
  const [vw, vh] = b.viewport.split('x').map(Number);
  const clamp = (lo, v, hi) => Math.max(lo, Math.min(hi, v));
  return {
    runway: clamp(38, 7 * vh / 100, 76),
    fontPx: clamp(0.95 * 16, Math.min(4.2 * vh / 100, 8.8 * vw / 100), 2.2 * 16),
    padBottom: clamp(10, 1.8 * vh / 100, 20),
    padSide: 16,
    lineHeight: 1.08,
    radius: 20,
  };
};

// ---- a real line per bucket, so the crop is judged with the joke on it ------
// Three per bucket: the shortest, a median one and the longest. The longest is
// the one that decides whether the ink survives, and it is the one an eye
// forgets to check.
const linesFor = (condition, time) => {
  const bank = copy.witty || {};
  const pool = (time === 'night' && Array.isArray(bank.night?.en) ? bank.night.en : null)
    || (Array.isArray(bank[condition]?.en) ? bank[condition].en : null)
    || (Array.isArray(bank.cloudy?.en) ? bank.cloudy.en : ['Probably weather.']);
  const sorted = [...pool].sort((a, b) => a.length - b.length);
  return [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]];
};

const buckets = new Map();
for (const a of assignments) {
  const key = `${a.condition}-${a.time}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(a);
}

const items = [];
for (const [bucket, list] of [...buckets.entries()].sort()) {
  list.forEach((a, i) => {
    const r = ruled[a.hash] || {};
    items.push({
      key: `${bucket}#${i + 1}`,
      hash: a.hash,
      bucket,
      condition: a.condition,
      time: a.time,
      slot: `${a.week}/${a.day}`,
      paths: a.paths || [a.image],
      src: `../assets/images/bg/${a.image}`,
      image: a.image,
      // The handle starts on the anchor Al already ruled in M7 — never a blank
      // slate. The window is 33 points bigger than it was when he set these, so
      // most of them should now need nothing.
      start: typeof r.anchorY === 'number' ? r.anchorY : 78,
      prev: r.verdict || 'UNRULED',
      lines: linesFor(a.condition, a.time),
    });
  });
}

const DATA = JSON.stringify({
  ref: { ...REF, f: Number(fOf(REF).toFixed(5)), cap: capMetrics(REF) },
  worst: { ...WORST, f: Number(fOf(WORST).toFixed(5)), cap: capMetrics(WORST) },
  items,
});

const html = `<!doctype html>
<meta charset="utf-8">
<title>PW — curate set-001 against the meme hero</title>
<link rel="stylesheet" href="../assets/type-prototype-caption.css">
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700; --paper:#f6f2e8;
          --keep:#63c98a; --cut:#ff6b6b; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:10px 16px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0 8px 0 0; }
  .count { color:var(--ink2); font-variant-numeric:tabular-nums; }
  button { font:inherit; border:1px solid rgba(246,242,232,.18); background:var(--panel); color:var(--ink);
           border-radius:8px; padding:7px 12px; cursor:pointer; }
  button:hover { border-color:var(--gold); }
  button.primary { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  button.on { border-color:var(--gold); color:var(--gold); }
  button.keep { border-color:var(--keep); color:var(--keep); }
  button.cut { border-color:var(--cut); color:var(--cut); }
  main { display:grid; grid-template-columns: minmax(300px, 430px) auto 1fr; gap:20px; padding:18px; align-items:start; }
  .stage { position:relative; user-select:none; }
  .stage img { width:100%; display:block; border-radius:8px; }
  .band { position:absolute; left:0; right:0; cursor:grab; border:2px solid var(--gold);
          background:rgba(255,215,0,.07); box-shadow:0 0 0 9999px rgba(0,0,0,.55); }
  .band:active { cursor:grabbing; }
  .band .grip { position:absolute; left:50%; transform:translateX(-50%); bottom:-11px; width:54px; height:6px;
                border-radius:3px; background:var(--gold); }
  .refband { position:absolute; left:0; right:0; border:1.5px dashed #59d0ff; pointer-events:none; }

  /* The real composition. Sizes and radii come from the measured card box, the
     scrim and the type from app.css's own numbers. */
  .previews { display:flex; gap:18px; align-items:flex-start; }
  figure { margin:0; }
  .hero { position:relative; overflow:hidden; background-size:cover; background-repeat:no-repeat;
          border-radius:0 0 20px 20px; box-shadow:0 18px 44px rgba(0,0,0,.55), 0 4px 12px rgba(0,0,0,.40); }
  .cap { position:absolute; left:0; right:0; bottom:0; margin:0;
         font-family:'Caveat Prototype','Segoe Print','Bradley Hand',cursive; font-weight:700;
         letter-spacing:0; text-align:left; }
  figcaption { font-size:11px; color:var(--ink2); margin-top:6px; text-align:center; }
  .side { display:flex; flex-direction:column; gap:13px; }
  .meta { color:var(--ink2); font-size:12.5px; }
  .meta b { color:var(--ink); }
  .val { font-size:32px; font-weight:800; font-variant-numeric:tabular-nums; }
  .val small { font-size:13px; color:var(--ink2); font-weight:600; }
  .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .hint { color:var(--ink2); font-size:12px; max-width:62ch; margin:0; }
  .tag { font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid rgba(246,242,232,.25); color:var(--ink2); }
  .tag.keep { border-color:var(--keep); color:var(--keep); }
  .tag.cut { border-color:var(--cut); color:var(--cut); }
  .strip { display:flex; gap:4px; flex-wrap:wrap; margin-top:4px; max-width:70ch; }
  .dot { width:11px; height:11px; border-radius:3px; background:#3a332a; cursor:pointer; }
  .dot.keep { background:var(--keep); }
  .dot.cut { background:var(--cut); }
  .dot.cur { outline:2px solid var(--paper); outline-offset:1px; }
  .tally { color:var(--ink2); font-size:12.5px; font-variant-numeric:tabular-nums; }
  .tally b.k { color:var(--keep); } .tally b.c { color:var(--cut); }
</style>

<header>
  <h1>Curate set-001 — the crop, the ink, and whether it stays</h1>
  <span class="count" id="pos"></span>
  <button id="fAll" class="on">All 294</button>
  <button id="fTodo">Undecided</button>
  <button id="fCut">Cuts</button>
  <span style="flex:1"></span>
  <button id="prev">← Prev</button>
  <button id="keep" class="keep">Keep (K)</button>
  <button id="cut" class="cut">Cut (C)</button>
  <button id="next" class="primary">Next →</button>
  <button id="export">Export</button>
</header>

<main>
  <section class="stage" id="stage">
    <img id="img" alt="">
    <div class="refband" id="refband"></div>
    <div class="band" id="band"><div class="grip"></div></div>
  </section>

  <section class="previews">
    <figure><div class="hero" id="heroRef"><p class="cap" id="capRef"></p></div><figcaption id="figRef"></figcaption></figure>
    <figure><div class="hero" id="heroWorst"><p class="cap" id="capWorst"></p></div><figcaption id="figWorst"></figcaption></figure>
  </section>

  <section class="side">
    <div class="val"><span id="anchor">78</span><small>% anchor</small> <span id="tag" class="tag"></span></div>
    <div class="meta" id="meta"></div>
    <div class="row">
      <button data-nudge="-5">−5</button><button data-nudge="-1">−1</button>
      <button data-nudge="1">+1</button><button data-nudge="5">+5</button>
      <button data-set="78">reset 78%</button>
    </div>
    <div class="row">
      <span class="meta">Ink:</span>
      <button id="inkWhite">White on dark (W)</button>
      <button id="inkDark">Dark on cream (D)</button>
      <button id="cycleLine">Try another line (L)</button>
    </div>
    <div class="tally" id="tally"></div>
    <p class="hint" id="inert" style="display:none; color:#ffb84d;">This frame is wider than 9:16, so the card fills on
      height and crops sideways instead — the vertical anchor does nothing here. Judge it on the picture and the ink.</p>
    <p class="hint">The big preview is <b id="refName"></b> at its real size — that is what the picture and the joke
      actually look like together. The small one is the tightest phone in the matrix. Drag the gold band on the source
      to move the crop; the dashed blue band is what a normal phone shows.</p>
    <p class="hint">Ink is per image. White is what ships; switch to dark when a pale photograph swallows it — the scrim
      flips to cream with it. Cycle the line: the <b>longest</b> line in the bucket is the one that decides.</p>
    <p class="hint">Keys: <b>K</b> keep · <b>C</b> cut · <b>W/D</b> ink · <b>L</b> line · <b>↑↓</b> 1% · <b>PgUp/PgDn</b> 5% ·
      <b>←/→</b> move · <b>Enter</b> next. Autosaves as you go — close it and come back.</p>
    <div class="strip" id="strip"></div>
  </section>
</main>

<script>
const DATA = ${DATA};
const LS = 'pw_curation_v2';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
let filter = 'all';
let list = [];
let i = 0;
// The library is NOT one shape. 644 canonical sources come in nine sizes, and
// while eight of them are 9:16 to within half a percent, four images are 0.67 —
// wide enough that cover scales by HEIGHT and the vertical anchor does nothing
// at all. So the visible window is computed per image off the loaded bitmap
// rather than from a constant, and the tool says so when the anchor is inert.
let srcA = 0.5625;
let lineIdx = 2; // the longest, deliberately: it is the case an eye skips

const $ = (id) => document.getElementById(id);
const clamp = (v) => Math.max(0, Math.min(100, v));
const cur = () => list[i];
const rec = (it) => state[it.hash] || {};

// The two treatments, and the ONE reason there are two: dark ink cannot sit on
// a dark scrim, so choosing the ink chooses the scrim with it.
const TREATMENT = {
  white: { ink: '#ffffff', a: '0.80', b: '0.62', rgb: '0,0,0', shadow: '0 2px 14px rgba(0,0,0,.70), 0 1px 3px rgba(0,0,0,.80)' },
  dark:  { ink: '#17130d', a: '0.86', b: '0.70', rgb: '246,242,232', shadow: '0 1px 2px rgba(255,255,255,.55)' },
};

function rebuild() {
  list = DATA.items.filter((it) => {
    if (filter === 'todo') return !rec(it).verdict;
    if (filter === 'cut') return rec(it).verdict === 'CUT';
    return true;
  });
  if (!list.length) list = DATA.items;
  if (i >= list.length) i = 0;
  render();
}

const fOf = (box) => Math.min(1, (box.height / box.width) * srcA);
const anchorOf = (it) => (typeof rec(it).anchorY === 'number' ? rec(it).anchorY : it.start);
const inkOf = (it) => rec(it).ink || 'white';

function render() {
  const it = cur();
  if (!it) return;
  const a = anchorOf(it);
  const r = rec(it);
  $('img').src = it.src;
  $('anchor').textContent = a;
  $('pos').textContent = (i + 1) + ' / ' + list.length;
  $('meta').innerHTML = '<b>' + it.bucket + '</b> · cell ' + it.key.split('#')[1] + ' · slot ' + it.slot
    + '<br>' + it.image + '<br>M7 ruling: ' + it.prev + (it.paths.length > 1 ? ' · ' + it.paths.length + ' rotation slots' : '');
  $('tag').className = 'tag ' + (r.verdict === 'KEEP' ? 'keep' : r.verdict === 'CUT' ? 'cut' : '');
  // The ink shows even before a verdict: it is a choice Al makes by eye while
  // looking, and a label that only appears after K/C hides the state he is
  // actually judging.
  $('tag').textContent = (r.verdict || 'undecided') + ' · ' + inkOf(it) + ' ink';
  $('inkWhite').className = inkOf(it) === 'white' ? 'on' : '';
  $('inkDark').className = inkOf(it) === 'dark' ? 'on' : '';
  $('refName').textContent = DATA.ref.device + ' ' + DATA.ref.viewport;
  placeBands(a);
  paint('heroRef', 'capRef', 'figRef', DATA.ref, it, a);
  paint('heroWorst', 'capWorst', 'figWorst', DATA.worst, it, a);
  tally();
  strip();
}

function placeBands(a) {
  const h = $('img').clientHeight || 1;
  const fw = fOf(DATA.worst), fr = fOf(DATA.ref);
  $('band').style.top = ((a / 100) * (1 - fw) * h) + 'px';
  $('band').style.height = (fw * h) + 'px';
  $('refband').style.top = ((a / 100) * (1 - fr) * h) + 'px';
  $('refband').style.height = (fr * h) + 'px';
  // fr >= 1 means the card is taller than this source can fill at its width, so
  // cover scales by height and crops sideways instead. Dragging changes
  // nothing, and a band that moves while nothing happens is a lie.
  $('inert').style.display = fr >= 1 ? '' : 'none';
}

// The shipped composition, rebuilt from app.css's own numbers: cover at the
// measured card box, the scrim's last stop pinned to the runway (NOT to a
// percentage — that was the bug the contrast gate caught), the caption font.
function paint(heroId, capId, figId, box, it, a) {
  const t = TREATMENT[inkOf(it)];
  const el = $(heroId), cap = $(capId);
  el.style.width = box.width + 'px';
  el.style.height = box.height + 'px';
  el.style.backgroundImage = 'url("' + it.src + '")';
  el.style.backgroundPosition = 'center ' + a + '%';
  el.style.borderRadius = '0 0 ' + box.cap.radius + 'px ' + box.cap.radius + 'px';
  cap.textContent = it.lines[lineIdx];
  cap.style.padding = box.cap.runway.toFixed(1) + 'px ' + box.cap.padSide + 'px ' + box.cap.padBottom.toFixed(1) + 'px';
  cap.style.fontSize = box.cap.fontPx.toFixed(1) + 'px';
  cap.style.lineHeight = box.cap.lineHeight;
  cap.style.color = t.ink;
  cap.style.textShadow = t.shadow;
  cap.style.background = 'linear-gradient(to top, rgba(' + t.rgb + ',' + t.a + ') 0%, rgba(' + t.rgb + ',' + t.b
    + ') calc(100% - ' + box.cap.runway.toFixed(1) + 'px), rgba(' + t.rgb + ',0) 100%)';
  cap.style.borderRadius = '0 0 ' + box.cap.radius + 'px ' + box.cap.radius + 'px';
  $(figId).textContent = box.device + ' — ' + box.width + '×' + box.height + ', shows '
    + Math.round(fOf(box) * 100) + '% of the frame';
}

function tally() {
  let k = 0, c = 0;
  for (const it of DATA.items) { const v = rec(it).verdict; if (v === 'KEEP') k++; else if (v === 'CUT') c++; }
  const dark = DATA.items.filter((it) => rec(it).ink === 'dark').length;
  $('tally').innerHTML = '<b class="k">' + k + ' keep</b> · <b class="c">' + c + ' cut</b> · '
    + (DATA.items.length - k - c) + ' undecided · ' + dark + ' on dark ink';
}

function strip() {
  const s = $('strip');
  s.innerHTML = '';
  list.forEach((it, n) => {
    const d = document.createElement('div');
    const v = rec(it).verdict;
    d.className = 'dot' + (v === 'KEEP' ? ' keep' : v === 'CUT' ? ' cut' : '') + (n === i ? ' cur' : '');
    d.title = it.key + ' — ' + it.image;
    d.onclick = () => { i = n; render(); };
    s.appendChild(d);
  });
}

function save(patch) {
  const it = cur();
  state[it.hash] = Object.assign({ bucket: it.bucket, key: it.key, image: it.image }, rec(it), patch);
  localStorage.setItem(LS, JSON.stringify(state));
  render();
}
const setAnchor = (a) => save({ anchorY: clamp(Math.round(a)) });
const advance = (d) => { i = (i + d + list.length) % list.length; render(); };
function verdict(v) { save({ verdict: v, anchorY: anchorOf(cur()), ink: inkOf(cur()) }); advance(1); }

// ---- dragging: the band follows the pointer, the anchor follows the band ----
let dragging = false;
function anchorFromY(clientY) {
  const box = $('img').getBoundingClientRect();
  const h = box.height || 1;
  // The pointer sits at the band's CENTRE, which is what "put this face in the
  // middle of the crop" means to a hand.
  const centre = (clientY - box.top) / h;
  const fw = fOf(DATA.worst);
  return clamp(((centre - fw / 2) / (1 - fw)) * 100);
}
$('band').addEventListener('pointerdown', (e) => { dragging = true; $('band').setPointerCapture(e.pointerId); e.preventDefault(); });
$('band').addEventListener('pointermove', (e) => { if (dragging) setAnchor(anchorFromY(e.clientY)); });
$('band').addEventListener('pointerup', () => { dragging = false; });
$('img').addEventListener('click', (e) => setAnchor(anchorFromY(e.clientY)));
$('img').addEventListener('load', () => {
  const im = $('img');
  if (im.naturalWidth && im.naturalHeight) srcA = im.naturalWidth / im.naturalHeight;
  render();
});
window.addEventListener('resize', () => render());

for (const b of document.querySelectorAll('[data-nudge]')) b.onclick = () => setAnchor(anchorOf(cur()) + Number(b.dataset.nudge));
for (const b of document.querySelectorAll('[data-set]')) b.onclick = () => setAnchor(Number(b.dataset.set));
$('next').onclick = () => advance(1);
$('prev').onclick = () => advance(-1);
$('keep').onclick = () => verdict('KEEP');
$('cut').onclick = () => verdict('CUT');
$('inkWhite').onclick = () => save({ ink: 'white' });
$('inkDark').onclick = () => save({ ink: 'dark' });
$('cycleLine').onclick = () => { lineIdx = (lineIdx + 1) % 3; render(); };
const setFilter = (f, btn) => { filter = f; for (const b of ['fAll', 'fTodo', 'fCut']) $(b).classList.toggle('on', b === btn); i = 0; rebuild(); };
$('fAll').onclick = () => setFilter('all', 'fAll');
$('fTodo').onclick = () => setFilter('todo', 'fTodo');
$('fCut').onclick = () => setFilter('cut', 'fCut');

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowUp') { setAnchor(anchorOf(cur()) - 1); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { setAnchor(anchorOf(cur()) + 1); e.preventDefault(); }
  else if (e.key === 'PageUp') { setAnchor(anchorOf(cur()) - 5); e.preventDefault(); }
  else if (e.key === 'PageDown') { setAnchor(anchorOf(cur()) + 5); e.preventDefault(); }
  else if (e.key === 'Enter') advance(1);
  else if (k === 'k') $('keep').click();
  else if (k === 'c') $('cut').click();
  else if (k === 'w') $('inkWhite').click();
  else if (k === 'd') $('inkDark').click();
  else if (k === 'l') $('cycleLine').click();
  else if (e.key === 'ArrowLeft') advance(-1);
  else if (e.key === 'ArrowRight') advance(1);
});

// ---- export: the anchors file the pipeline already reads, plus the cut list --
function download(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
$('export').onclick = () => {
  const day = new Date().toISOString().slice(0, 10);
  // Same shape the M7 pipeline already consumes, with ink and keep alongside:
  // extra keys are ignored by the existing reader, so nothing downstream breaks.
  const anchors = { generated: day, ruledBy: 'Al, curation tool (meme hero)', anchors: {} };
  const cuts = { generated: day, ruledBy: 'Al, curation tool (meme hero)', cut: [] };
  for (const it of DATA.items) {
    const r = state[it.hash];
    if (!r || !r.verdict) continue;
    if (r.verdict === 'CUT') {
      cuts.cut.push({ hash: it.hash, bucket: it.bucket, condition: it.condition, time: it.time,
        slot: it.slot, image: it.image, paths: it.paths });
      continue;
    }
    anchors.anchors[it.hash] = { verdict: 'FIXABLE', anchorY: r.anchorY ?? it.start,
      ink: r.ink || 'white', bucket: it.bucket, image: it.image };
  }
  anchors.kept = Object.keys(anchors.anchors).length;
  cuts.count = cuts.cut.length;
  download('set-001-crop-anchors.json', anchors);
  setTimeout(() => download('set-001-cut-list.json', cuts), 400);
};

rebuild();
</script>
`;

writeFileSync(p('review/crop-anchor-tool.html'), html);
console.log(`[curation tool] review/crop-anchor-tool.html — ${items.length} images`);
console.log(`[curation tool] window: ${REF.device} ${REF.width}x${REF.height} shows ${(fOf(REF) * 100).toFixed(1)}% of a frame; ${WORST.device} ${WORST.width}x${WORST.height} shows ${(fOf(WORST) * 100).toFixed(1)}%`);
console.log(`[curation tool] caption at ${REF.viewport}: ${capMetrics(REF).fontPx.toFixed(1)}px on a ${capMetrics(REF).runway.toFixed(1)}px runway`);
