// Build review/crop-anchor-tool.html — the drag-the-crop tool.
//
// Al, 2026-08-10: "can we do this in a way that i can just drag and drop each
// frame to where the focus needs to lie." Yes. The contact sheets were built to
// RULE on, which is the wrong instrument for fixing 166 crops — this is the
// right one: one image at a time, drag the band onto the face, next.
//
// Self-contained: open it by double-clicking. Images load over relative file://
// paths out of assets/images/bg, every judgement autosaves to localStorage, and
// Export drops a JSON that scripts/apply-crop-anchors.mjs wires straight into
// assets/hero-crop.js.
//
//   node scripts/build-anchor-tool.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);

const draft = JSON.parse(readFileSync(p('review/set-001-draft.json'), 'utf8'));
const assignments = Array.isArray(draft) ? draft : (draft.assignments || draft.images);
const old = JSON.parse(readFileSync(p('review/m7-verdicts.json'), 'utf8')).verdicts;
const carried = JSON.parse(readFileSync(p('review/set-001-crop-offsets.json'), 'utf8'));
const geo = JSON.parse(readFileSync(p('output/m7-crop/sheet-index.json'), 'utf8'));

// The two real boxes, measured live off dist. The tool previews BOTH, because an
// anchor that saves the worst case can still look odd on the reference phone.
const SRC = 1080 / 1920;
const fOf = (b) => (b.height / b.width) * SRC;
const F_WORST = fOf(geo.worst);
const F_REF = fOf(geo.reference);

const buckets = new Map();
for (const a of assignments) {
  const key = `${a.condition}-${a.time}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(a);
}

const items = [];
for (const [bucket, list] of [...buckets.entries()].sort()) {
  list.forEach((a, i) => {
    const key = `${bucket}#${i + 1}`;
    const v = old[key] || {};
    const c = carried.offsets?.[a.hash];
    items.push({
      key,
      hash: a.hash,
      bucket,
      slot: `${a.week}/${a.day}`,
      src: `../assets/images/bg/${a.image}`,
      image: a.image,
      prev: v.verdict || 'UNRULED',
      // Where the handle starts: the carried anchor for a FIXABLE, otherwise the
      // shipped default. Never a blank slate — the first drag should be a nudge.
      start: c ? c.anchorY : 78,
      needsWork: v.verdict !== 'SURVIVES',
    });
  });
}

const DATA = JSON.stringify({
  fWorst: Number(F_WORST.toFixed(5)),
  fRef: Number(F_REF.toFixed(5)),
  worst: geo.worst,
  reference: geo.reference,
  items,
});

const html = `<!doctype html>
<meta charset="utf-8">
<title>PW — crop anchors: drag the band onto the subject</title>
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700; --paper:#f6f2e8; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.96); border-bottom:1px solid rgba(246,242,232,.14);
           padding:10px 16px; display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0 8px 0 0; }
  .count { color:var(--ink2); font-variant-numeric:tabular-nums; }
  button { font:inherit; border:1px solid rgba(246,242,232,.18); background:var(--panel); color:var(--ink);
           border-radius:8px; padding:7px 12px; cursor:pointer; }
  button:hover { border-color:var(--gold); }
  button.primary { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  button.on { border-color:var(--gold); color:var(--gold); }
  main { display:grid; grid-template-columns: minmax(320px, 480px) 1fr; gap:22px; padding:18px; align-items:start; }
  .stage { position:relative; user-select:none; }
  .stage img { width:100%; display:block; border-radius:8px; }
  .band { position:absolute; left:0; right:0; cursor:grab; border:2px solid var(--gold);
          background:rgba(255,215,0,.10); box-shadow:0 0 0 9999px rgba(0,0,0,.55); }
  .band:active { cursor:grabbing; }
  .band .grip { position:absolute; left:50%; transform:translateX(-50%); bottom:-11px; width:54px; height:6px;
                border-radius:3px; background:var(--gold); }
  .refband { position:absolute; left:0; right:0; border:1.5px dashed #59d0ff; pointer-events:none; }
  .side { display:flex; flex-direction:column; gap:14px; }
  .prev { display:flex; gap:16px; flex-wrap:wrap; }
  figure { margin:0; }
  .crop { background-size:cover; background-position:center 78%; background-repeat:no-repeat; border-radius:6px;
          border:1px solid rgba(246,242,232,.2); }
  figcaption { font-size:11px; color:var(--ink2); margin-top:5px; }
  .meta { color:var(--ink2); font-size:12.5px; }
  .meta b { color:var(--ink); }
  .val { font-size:34px; font-weight:800; font-variant-numeric:tabular-nums; }
  .val small { font-size:13px; color:var(--ink2); font-weight:600; }
  .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .hint { color:var(--ink2); font-size:12px; max-width:60ch; }
  .tag { font-size:11px; padding:2px 7px; border-radius:999px; border:1px solid rgba(246,242,232,.25); color:var(--ink2); }
  .tag.fix { border-color:#ffb84d; color:#ffb84d; }
  .tag.surv { border-color:#63c98a; color:#63c98a; }
  .tag.fail { border-color:#ff6b6b; color:#ff6b6b; }
  .done { color:#63c98a; }
  .strip { display:flex; gap:4px; flex-wrap:wrap; margin-top:6px; }
  .dot { width:11px; height:11px; border-radius:3px; background:#3a332a; cursor:pointer; }
  .dot.set { background:var(--gold); }
  .dot.skip { background:#63c98a; }
  .dot.fail { background:#ff6b6b; }
  .dot.cur { outline:2px solid var(--paper); outline-offset:1px; }
</style>

<header>
  <h1>Crop anchors — drag the gold band onto the subject</h1>
  <span class="count" id="pos"></span>
  <button id="filterWork" class="on">Needs work (167)</button>
  <button id="filterAll">All 294</button>
  <span style="flex:1"></span>
  <button id="prev">← Prev</button>
  <button id="survives">Fine as-is (S)</button>
  <button id="fail">Can't be saved (X)</button>
  <button id="next" class="primary">Save &amp; next →</button>
  <button id="export">Export JSON</button>
</header>

<main>
  <section class="stage" id="stage">
    <img id="img" alt="">
    <div class="refband" id="refband"></div>
    <div class="band" id="band"><div class="grip"></div></div>
  </section>

  <section class="side">
    <div class="val"><span id="anchor">78</span><small>% anchor</small> <span id="tag" class="tag"></span></div>
    <div class="meta" id="meta"></div>
    <div class="prev">
      <figure><div class="crop" id="cropWorst"></div><figcaption id="capWorst"></figcaption></figure>
      <figure><div class="crop" id="cropRef"></div><figcaption id="capRef"></figcaption></figure>
    </div>
    <div class="row">
      <button data-nudge="-5">−5</button><button data-nudge="-1">−1</button>
      <button data-nudge="1">+1</button><button data-nudge="5">+5</button>
      <button data-set="78">reset to 78%</button>
    </div>
    <p class="hint">Drag the gold band (that is the <b>worst phone</b> — the tightest crop in the matrix) so the face or subject sits inside it.
       The blue dashed band is what a normal phone shows. Click anywhere on the photo to jump the band there.
       Keys: <b>↑ ↓</b> 1%, <b>PgUp/PgDn</b> 5%, <b>Enter</b> save &amp; next, <b>S</b> fine as-is, <b>X</b> can't be saved, <b>←/→</b> move.</p>
    <p class="hint">Everything autosaves in this browser as you go — close it and come back. When you are done, <b>Export JSON</b> and tell me; I wire it.</p>
    <div class="strip" id="strip"></div>
  </section>
</main>

<script>
const DATA = ${DATA};
const LS = 'pw_crop_anchors_v1';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
let onlyWork = true;
let list = [];
let i = 0;

const $ = (id) => document.getElementById(id);
const clamp = (v) => Math.max(0, Math.min(100, v));
const cur = () => list[i];

function rebuild() {
  list = DATA.items.filter((it) => (onlyWork ? it.needsWork : true));
  if (i >= list.length) i = 0;
  render();
}

function anchorOf(it) {
  const s = state[it.hash];
  if (s && typeof s.anchorY === 'number') return s.anchorY;
  if (s && s.verdict === 'SURVIVES') return 78;
  return it.start;
}

function render() {
  const it = cur();
  if (!it) return;
  const a = anchorOf(it);
  $('img').src = it.src;
  $('anchor').textContent = a;
  $('pos').textContent = \`\${i + 1} / \${list.length}\`;
  $('meta').innerHTML = \`<b>\${it.bucket}</b> · cell \${it.key.split('#')[1]} · slot \${it.slot}<br>\${it.image}<br>2026-08-09 ruling: \${it.prev}\`;
  const st = state[it.hash];
  $('tag').className = 'tag ' + (st?.verdict === 'SURVIVES' ? 'surv' : st?.verdict === 'FAILS' ? 'fail' : st ? 'fix' : '');
  $('tag').textContent = st ? (st.verdict === 'FIXABLE' ? 'anchored ' + st.anchorY + '%' : st.verdict) : 'not set';
  placeBands(a);
  previews(it, a);
  strip();
}

function placeBands(a) {
  const h = $('img').clientHeight || 1;
  const top = (a / 100) * (1 - DATA.fWorst);
  $('band').style.top = (top * h) + 'px';
  $('band').style.height = (DATA.fWorst * h) + 'px';
  const rtop = (a / 100) * (1 - DATA.fRef);
  $('refband').style.top = (rtop * h) + 'px';
  $('refband').style.height = (DATA.fRef * h) + 'px';
}

function previews(it, a) {
  const w = DATA.worst, r = DATA.reference;
  const cw = $('cropWorst'), cr = $('cropRef');
  cw.style.width = Math.round(w.width) + 'px';
  cw.style.height = Math.round(w.height) + 'px';
  cr.style.width = Math.round(r.width * 0.78) + 'px';
  cr.style.height = Math.round(r.height * 0.78) + 'px';
  for (const el of [cw, cr]) {
    el.style.backgroundImage = \`url("\${it.src}")\`;
    el.style.backgroundPosition = \`center \${a}%\`;
  }
  $('capWorst').textContent = \`worst phone — \${Math.round(w.width)}×\${Math.round(w.height)} (\${w.device})\`;
  $('capRef').textContent = \`normal phone — \${Math.round(r.width)}×\${Math.round(r.height)}, shown at 78%\`;
}

function strip() {
  const s = $('strip');
  s.innerHTML = '';
  list.forEach((it, n) => {
    const d = document.createElement('div');
    const st = state[it.hash];
    d.className = 'dot' + (st?.verdict === 'FIXABLE' ? ' set' : st?.verdict === 'SURVIVES' ? ' skip' : st?.verdict === 'FAILS' ? ' fail' : '') + (n === i ? ' cur' : '');
    d.title = it.key;
    d.onclick = () => { i = n; render(); };
    s.appendChild(d);
  });
}

function setAnchor(a) {
  const it = cur();
  state[it.hash] = { verdict: 'FIXABLE', anchorY: clamp(Math.round(a)), bucket: it.bucket, key: it.key, image: it.image };
  localStorage.setItem(LS, JSON.stringify(state));
  render();
}
function mark(verdict) {
  const it = cur();
  state[it.hash] = { verdict, bucket: it.bucket, key: it.key, image: it.image };
  localStorage.setItem(LS, JSON.stringify(state));
  advance(1);
}
function advance(d) { i = (i + d + list.length) % list.length; render(); }

// ---- dragging: the band follows the pointer, the anchor follows the band ----
let dragging = false;
function anchorFromY(clientY) {
  const box = $('img').getBoundingClientRect();
  const h = box.height || 1;
  // Pointer sits at the band's CENTRE while dragging, which is what "put this
  // face in the middle of the crop" means to a hand.
  const centre = (clientY - box.top) / h;
  const top = centre - DATA.fWorst / 2;
  return clamp((top / (1 - DATA.fWorst)) * 100);
}
$('band').addEventListener('pointerdown', (e) => { dragging = true; $('band').setPointerCapture(e.pointerId); e.preventDefault(); });
$('band').addEventListener('pointermove', (e) => { if (dragging) setAnchor(anchorFromY(e.clientY)); });
$('band').addEventListener('pointerup', () => { dragging = false; });
$('img').addEventListener('click', (e) => setAnchor(anchorFromY(e.clientY)));
window.addEventListener('resize', () => render());
$('img').addEventListener('load', () => render());

for (const b of document.querySelectorAll('[data-nudge]')) b.onclick = () => setAnchor(anchorOf(cur()) + Number(b.dataset.nudge));
for (const b of document.querySelectorAll('[data-set]')) b.onclick = () => setAnchor(Number(b.dataset.set));
$('next').onclick = () => { if (!state[cur().hash]) setAnchor(anchorOf(cur())); advance(1); };
$('prev').onclick = () => advance(-1);
$('survives').onclick = () => mark('SURVIVES');
$('fail').onclick = () => mark('FAILS');
$('filterWork').onclick = () => { onlyWork = true; $('filterWork').classList.add('on'); $('filterAll').classList.remove('on'); i = 0; rebuild(); };
$('filterAll').onclick = () => { onlyWork = false; $('filterAll').classList.add('on'); $('filterWork').classList.remove('on'); i = 0; rebuild(); };

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') { setAnchor(anchorOf(cur()) - 1); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { setAnchor(anchorOf(cur()) + 1); e.preventDefault(); }
  else if (e.key === 'PageUp') { setAnchor(anchorOf(cur()) - 5); e.preventDefault(); }
  else if (e.key === 'PageDown') { setAnchor(anchorOf(cur()) + 5); e.preventDefault(); }
  else if (e.key === 'Enter') $('next').click();
  else if (e.key.toLowerCase() === 's') $('survives').click();
  else if (e.key.toLowerCase() === 'x') $('fail').click();
  else if (e.key === 'ArrowLeft') advance(-1);
  else if (e.key === 'ArrowRight') advance(1);
});

$('export').onclick = () => {
  const out = { generated: new Date().toISOString().slice(0, 10), ruledBy: 'Al, drag tool', anchors: {} };
  for (const it of DATA.items) {
    const st = state[it.hash];
    if (!st) continue;
    out.anchors[it.hash] = st.verdict === 'FIXABLE'
      ? { verdict: 'FIXABLE', anchorY: st.anchorY, bucket: it.bucket, image: it.image }
      : { verdict: st.verdict, bucket: it.bucket, image: it.image };
  }
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'set-001-crop-anchors.json';
  a.click();
};

rebuild();
</script>
`;

writeFileSync(p('review/crop-anchor-tool.html'), html);
console.log(`[anchor-tool] review/crop-anchor-tool.html — ${items.length} images, ${items.filter((x) => x.needsWork).length} flagged as needing work`);
console.log(`[anchor-tool] worst band shows ${(F_WORST * 100).toFixed(1)}% of a source, reference shows ${(F_REF * 100).toFixed(1)}%`);
