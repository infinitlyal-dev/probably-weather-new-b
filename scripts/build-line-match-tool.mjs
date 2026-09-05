// Builds review/line-match-tool.html — Al matches bank lines to photographs by hand.
// v2 (2026-08-26): Al's matches are the spec. Routing is reported, never enforced.
// Pattern follows review/crop-anchor-tool.html: file:// page, localStorage autosave,
// backup / import / export. Nothing here places a line except Al's own confirmed ticks.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const CARD = { w: 190, h: 301, radius: 12 };   // hero crop ratio preserved from 327x518
const BUCKETS = ['clear', 'cloudy', 'wind', 'heat', 'cold', 'cold-clear', 'fog', 'rain', 'storm'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// ---- the 294 photographs, with their slot context -------------------------
const rows = new Map();
for (const src of ['review/bespoke-worklist-remaining.json', 'review/set-001-lines-bespoke-final.json']) {
  const d = J(src);
  const arr = [d.images, d.set].find((x) => Array.isArray(x)) || [];
  for (const e of arr) {
    if (rows.has(e.hash)) continue;
    rows.set(e.hash, {
      hash: e.hash, image: e.image, condition: e.condition,
      time: e.time, week: e.week, day: e.day,
    });
  }
}
// Week A before Week B, Monday → Sunday inside each. Never grid or slot-index order.
const images = [...rows.values()].sort((a, b) =>
  BUCKETS.indexOf(a.condition) - BUCKETS.indexOf(b.condition)
  || TIMES.indexOf(a.time) - TIMES.indexOf(b.time)
  || String(a.week).localeCompare(String(b.week))
  || DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

const bank = J('review/set-001-bank-ruled.json').kept.map((b) => ({
  id: b.id, bin: b.condition, text: b.text, source: b.source || 'bank',
}));

// Al's confirmed one-to-one placements: the bank lines inside his wind ruled export.
const preplaced = {};
for (const e of J('review/set-001-lines-bespoke-wind-ruled.json').images) {
  for (const k of e.kept) if (k.source === 'bank' && k.rescue) (preplaced[e.hash] ||= []).push(k.rescue);
}
const legacy = J('review/set-001-humour-approved.json').approved;

const DATA = { CARD, BUCKETS, TIMES, DAYS, images, bank, preplaced, legacy };

const html = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PW — line match</title>
<style>
:root{--bg:#0d0f12;--panel:#161a20;--line:#262c35;--ink:#e9ebee;--dim:#98a1ad;--warn:#d19a2a;--no:#b8443c;--sel:#4b8ee6;--cross:#5aa6a0}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}
header{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap}
h1{margin:0;font-size:14px;font-weight:600;white-space:nowrap}
.tabs{display:flex;gap:4px;flex-wrap:wrap}
.tab{border:1px solid var(--line);background:none;color:var(--dim);border-radius:999px;padding:3px 10px;font-size:11.5px;cursor:pointer}
.tab.on{color:#fff;background:#22303f;border-color:#3a5670}
.tab b{font-weight:600;color:var(--ink)}
.spacer{flex:1}
button.act{border:1px solid var(--line);background:none;color:var(--dim);border-radius:6px;padding:5px 10px;font-size:11.5px;cursor:pointer}
button.act:disabled{opacity:.4;cursor:default}
button.pri{background:#2b6cb0;border-color:#2b6cb0;color:#fff}
.wrap{display:grid;grid-template-columns:1fr 360px;height:calc(100vh - 84px)}
#stage{overflow:auto;padding:14px 18px 70px}
#side{border-left:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;overflow:hidden}
h2.time{margin:16px 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);padding-bottom:5px;cursor:pointer;user-select:none;display:flex;align-items:center;gap:8px}
h2.time .caret{font-size:10px;width:10px}
h2.time .fold{margin-left:auto;padding-left:18px;font-size:10px;text-transform:none;letter-spacing:0;white-space:nowrap}
.grid{display:flex;flex-wrap:wrap;gap:12px}
.slot{width:${CARD.w}px}
.hero{position:relative;width:${CARD.w}px;height:${CARD.h}px;border-radius:${CARD.radius}px;overflow:hidden;background:#000;border:2px solid transparent;cursor:pointer}
.hero img{width:100%;height:100%;object-fit:cover;display:block}
.hero.over{border-color:var(--sel)}
.slot.sel .hero{border-color:var(--sel);box-shadow:0 0 0 3px #4b8ee633}
.cap{position:absolute;left:0;right:0;bottom:0;padding:0 9px 8px;background:linear-gradient(transparent,rgba(0,0,0,.82) 42%);min-height:34px;display:flex;flex-direction:column;justify-content:flex-end;gap:1px}
.cap div{font-size:10.5px;line-height:1.2;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.7)}
.tagline{position:absolute;top:6px;left:6px;background:#000b;border-radius:5px;padding:1px 6px;font-size:10px;color:#cfd6df}
.count{position:absolute;top:6px;right:6px;background:#000b;border-radius:5px;padding:1px 6px;font-size:10px}
.count.f3{background:#1e4d33dd;color:#9ff0c2}
.slot ul{list-style:none;margin:5px 0 0;padding:0}
.slot li{display:flex;gap:5px;align-items:flex-start;font-size:11px;line-height:1.35;color:var(--dim);padding:3px 0;border-top:1px solid var(--line)}
.slot li span.t{flex:1}
.slot li button{border:0;background:none;color:#79838f;cursor:pointer;font-size:12px;line-height:1;padding:0 1px}
.slot li button:hover{color:var(--no)}
.warn{display:inline-block;font-size:9px;padding:0 5px;border-radius:999px;background:#3a2c0e;color:#e5bb61;border:1px solid #6d5417;white-space:nowrap;margin-right:4px}
.xc{display:inline-block;font-size:9px;padding:0 5px;border-radius:999px;background:#12302e;color:#7fd0c8;border:1px solid #23504c;white-space:nowrap;margin-right:4px}
#side .head{padding:10px 12px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:7px}
#q,#fam{width:100%;background:#0d0f12;border:1px solid var(--line);color:var(--ink);border-radius:6px;padding:6px 9px;font-size:12.5px}
#binfo{font-size:11px;color:var(--dim)}
#list{overflow:auto;padding:9px 11px;flex:1}
.card{border:1px solid var(--line);background:#0f1318;border-radius:8px;padding:8px 10px;margin-bottom:6px;cursor:grab}
.card:hover{border-color:#3a4553}
.card.drag{opacity:.4}
.card .t{font-size:13.5px;line-height:1.3}
.card .m{display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap}
.card .id{font-family:ui-monospace,monospace;font-size:10px;color:var(--dim)}
.reach{font-size:9.5px;padding:0 6px;border-radius:999px;background:#2a2340;color:#b9a9ff;border:1px solid #443a76}
.reach.night{background:#1a2a3d;color:#93c2f0;border-color:#2f4d70}
.mine{font-size:9.5px;padding:0 6px;border-radius:999px;background:#3a2a12;color:#f0c48a;border:1px solid #6b4d1f}
.card .x{margin-left:auto;border:1px solid var(--line);background:none;color:#79838f;border-radius:5px;font-size:10.5px;padding:1px 7px;cursor:pointer}
.card .x:hover{border-color:var(--no);color:var(--no)}
footer{position:fixed;left:0;right:360px;bottom:0;background:#0d0f12f2;border-top:1px solid var(--line);padding:7px 18px;font-size:11.5px;color:var(--dim);display:flex;gap:16px;flex-wrap:wrap}
footer b{color:var(--ink)}
#hint{padding:5px 14px;font-size:11.5px;color:var(--dim);border-bottom:1px solid var(--line);background:#11151a}
#hint b{color:#9fc2ea}
#toast{position:fixed;left:50%;bottom:52px;transform:translateX(-50%);background:#1c2430;border:1px solid #38506b;color:#cfe0f2;padding:7px 13px;border-radius:8px;font-size:12.5px;opacity:0;transition:opacity .18s;pointer-events:none;z-index:20;max-width:640px;text-align:center}
#toast.on{opacity:1}
</style>
<header>
  <h1>PW — line match</h1>
  <div class="tabs" id="tabs"></div>
  <div class="spacer"></div>
  <button class="act" id="bUndo" disabled>Undo</button>
  <button class="act" id="bBackup">Backup</button>
  <button class="act" id="bImport">Import…</button>
  <button class="act" id="bLegacy">Import 2026-08-06 ticks</button>
  <button class="act pri" id="bExport">Export</button>
</header>
<div id="hint">Click a photograph to select it, then click a line to place it — or drag. Any line may go on any photograph; an amber <span class="warn">won't render</span> badge only means today's routing wouldn't serve it.</div>
<div class="wrap">
  <div id="stage"></div>
  <aside id="side">
    <div class="head">
      <select id="fam"></select>
      <input id="q" placeholder="search lines…" autocomplete="off">
      <div id="binfo"></div>
    </div>
    <div id="list"></div>
  </aside>
</div>
<footer id="foot"></footer>
<div id="toast"></div>
<input type="file" id="file" accept="application/json" style="display:none">
<script>
const D = ${JSON.stringify(DATA)};
const KEY = 'pw-line-match-v1';   // unchanged, so work in progress survives the rebuild
const FAM = { clear:['clear','uv'], cloudy:['cloudy','rain-possible','partly-cloudy'], storm:['storm','thunder','hail'],
              wind:['wind'], heat:['heat'], cold:['cold'], 'cold-clear':['cold-clear'], fog:['fog'], rain:['rain'] };
const EXTRA = { clear:['weekend','night'], heat:['weekend'] };   // bins a condition can natively reach
const homeBins = (c) => FAM[c].concat(EXTRA[c] || []);
const byId = Object.fromEntries(D.bank.map(b => [b.id, b]));
const imgByHash = Object.fromEntries(D.images.map(i => [i.hash, i]));

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
let S = { placed: {}, cut: [], folded: {} };
try { const raw = JSON.parse(LS.get(KEY) || 'null'); if (raw && raw.placed) { S = raw; S.folded = S.folded || {}; } else seed(); }
catch (e) { seed(); }
function seed() { S = { placed: JSON.parse(JSON.stringify(D.preplaced)), cut: [], folded: {} }; }
const save = () => LS.set(KEY, JSON.stringify(S));

// ---- undo, last 20 ----
const undoStack = [];
function snap() { undoStack.push(JSON.stringify(S)); if (undoStack.length > 20) undoStack.shift(); }
function undo() { const p = undoStack.pop(); if (!p) return; S = JSON.parse(p); paint(); toast('Undone.'); }

// ---- routing: reported, never enforced ----
const isWeekendSlot = (im) => ['sat','sun'].includes(im.day) || (im.day === 'fri' && ['dusk','night'].includes(im.time));
const isNightSlot   = (im) => im.condition === 'clear' && im.time === 'night';
function routingNote(im, bin) {
  if (isNightSlot(im)) return bin === 'night' ? null
    : 'clear night slots resolve to the night bin, so the app would not serve a ' + bin + ' line here';
  if (isWeekendSlot(im) && (im.condition === 'clear' || im.condition === 'heat')) return bin === 'weekend' ? null
    : 'the weekend bin pre-empts the ' + im.condition + ' pool on ' + im.day + ', so the app would not serve a ' + bin + ' line here';
  if (bin === 'weekend') return 'weekend lines only render on clear or heat images in a Sat/Sun (or Fri-from-16:00) slot';
  if (bin === 'night') return 'night lines only render on clear images at night';
  if (!FAM[im.condition].includes(bin)) return 'the app picks the image and the line from the same condition, so a ' + bin + ' line would not appear over a ' + im.condition + ' photograph';
  return null;
}
const isCross = (im, bin) => !homeBins(im.condition).includes(bin);

let bucket = LS.get(KEY + ':bucket') || 'clear';
let famFilter = LS.get(KEY + ':fam') || '__bucket__';
let query = '';
let selected = null;
const usedIds = () => new Set(Object.values(S.placed).flat());
const toastEl = document.getElementById('toast');
let toastT;
function toast(m) { toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 3400); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

// ---------------- stage ----------------
function renderStage() {
  const ims = D.images.filter(i => i.condition === bucket);   // already sorted A→B, Mon→Sun
  let h = '';
  for (const t of D.TIMES) {
    const grp = ims.filter(i => i.time === t);
    if (!grp.length) continue;
    const fkey = bucket + '|' + t, folded = !!S.folded[fkey];
    const done = grp.filter(i => (S.placed[i.hash] || []).length >= 3).length;
    h += '<h2 class="time" data-fold="' + fkey + '"><span class="caret">' + (folded ? '\\u25B8' : '\\u25BE') + '</span>'
      + t + ' · ' + grp.length + '<span class="fold">' + done + '/' + grp.length + ' full · click to '
      + (folded ? 'open' : 'fold') + '</span></h2>';
    if (folded) continue;
    h += '<div class="grid">';
    for (const im of grp) {
      const ids = S.placed[im.hash] || [];
      h += '<div class="slot' + (selected === im.hash ? ' sel' : '') + '" data-hash="' + im.hash + '">'
        + '<div class="hero" data-hash="' + im.hash + '">'
        + '<img loading="lazy" src="../assets/images/bg/' + im.image + '" alt="">'
        + '<div class="tagline">' + im.week + ' · ' + im.day + '</div>'
        + '<div class="count' + (ids.length >= 3 ? ' f3' : '') + '">' + ids.length + '/3</div>'
        + '<div class="cap">' + ids.map(id => '<div>' + esc((byId[id] || {}).text || id) + '</div>').join('') + '</div></div>'
        + '<ul>' + ids.map(id => {
            const b = byId[id] || { text: id, bin: '?' };
            const note = routingNote(im, b.bin);
            return '<li><span class="t">'
              + (note ? '<span class="warn" title="' + esc(note) + '">won\\'t render</span>' : '')
              + (isCross(im, b.bin) ? '<span class="xc" title="' + b.bin + ' line on a ' + im.condition + ' photograph">cross</span>' : '')
              + esc(b.text) + '</span><button title="remove" data-detach="' + im.hash + '|' + id + '">\\u2715</button></li>';
          }).join('') + '</ul></div>';
    }
    h += '</div>';
  }
  document.getElementById('stage').innerHTML = h;
}

// ---------------- line list ----------------
function famOptions() {
  const opts = [['__bucket__', 'this bucket — ' + homeBins(bucket).join(', ')]];
  for (const b of D.BUCKETS) opts.push([b, b + ' family — ' + homeBins(b).join(', ')]);
  opts.push(['__all__', 'all lines (any family)']);
  document.getElementById('fam').innerHTML = opts.map(([v, l]) =>
    '<option value="' + v + '"' + (v === famFilter ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
}
function poolBins() {
  if (famFilter === '__all__') return null;                       // null = no bin filter
  return new Set(homeBins(famFilter === '__bucket__' ? bucket : famFilter));
}
function renderList() {
  const bins = poolBins(), used = usedIds(), cut = new Set(S.cut);
  const pool = D.bank.filter(b => (!bins || bins.has(b.bin)) && !used.has(b.id) && !cut.has(b.id));
  const q = query.trim().toLowerCase();
  const show = q ? pool.filter(b => (b.text + ' ' + b.id).toLowerCase().includes(q)) : pool;
  const sel = selected ? imgByHash[selected] : null;
  document.getElementById('binfo').innerHTML = show.length + ' of ' + pool.length + ' unplaced'
    + (sel ? ' · placing on <b style="color:#9fc2ea">' + sel.condition + ' ' + sel.week + '/' + sel.day + ' ' + sel.time + '</b>'
           : ' · <span style="color:#d19a2a">no photograph selected</span>');
  document.getElementById('list').innerHTML = show.map(b => {
    const note = sel ? routingNote(sel, b.bin) : null;
    const cross = sel ? isCross(sel, b.bin) : false;
    return '<div class="card" draggable="true" data-id="' + b.id + '"><div class="t">' + esc(b.text) + '</div>'
      + '<div class="m"><span class="id">' + b.id + '</span>'
      + (b.bin === 'weekend' ? '<span class="reach">weekend slots</span>' : '')
      + (b.bin === 'night' ? '<span class="reach night">night slots</span>' : '')
      + (b.source === 'Al' ? '<span class="mine">Al\\'s line</span>' : '')
      + (cross ? '<span class="xc">cross</span>' : '')
      + (note ? '<span class="warn" title="' + esc(note) + '">won\\'t render</span>' : '')
      + '<button class="x" data-cut="' + b.id + '">cut</button></div></div>';
  }).join('') || '<div style="color:var(--dim);font-size:13px;padding:10px 2px">Nothing left under this filter.</div>';
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = D.BUCKETS.map(b => {
    const ims = D.images.filter(i => i.condition === b);
    const n = ims.reduce((m, i) => m + (S.placed[i.hash] || []).length, 0);
    return '<button class="tab' + (b === bucket ? ' on' : '') + '" data-b="' + b + '">' + b + ' <b>' + n + '</b>/' + (ims.length * 3) + '</button>';
  }).join('');
}
function renderFoot() {
  const ims = D.images.filter(i => i.condition === bucket);
  const at = (n) => ims.filter(i => (S.placed[i.hash] || []).length === n).length;
  const used = usedIds();
  let conflicts = 0, cross = 0;
  for (const [hash, ids] of Object.entries(S.placed)) { const im = imgByHash[hash]; if (!im) continue;
    for (const id of ids) { const b = byId[id]; if (!b) continue; if (routingNote(im, b.bin)) conflicts++; if (isCross(im, b.bin)) cross++; } }
  document.getElementById('foot').innerHTML =
    '<span>' + bucket + ': <b>' + at(0) + '</b> at 0 · <b>' + at(1) + '</b> at 1 · <b>' + at(2) + '</b> at 2 · <b>' + at(3) + '</b> at 3</span>'
    + '<span>overall <b>' + used.size + '</b> placed · <b>' + (D.bank.length - used.size - S.cut.length) + '</b> remaining · <b>' + S.cut.length + '</b> cut</span>'
    + '<span>photographs at 0: <b>' + D.images.filter(i => !(S.placed[i.hash] || []).length).length + '</b></span>'
    + '<span>routing warnings: <b style="color:#e5bb61">' + conflicts + '</b> · cross-condition: <b style="color:#7fd0c8">' + cross + '</b></span>';
  document.getElementById('bUndo').disabled = !undoStack.length;
}
function paint() {
  renderStage(); famOptions(); renderList(); renderTabs(); renderFoot();
  save(); LS.set(KEY + ':bucket', bucket); LS.set(KEY + ':fam', famFilter);
}

// ---------------- placing ----------------
function attach(hash, id) {
  const cur = S.placed[hash] || [];
  if (cur.includes(id)) return;
  if (cur.length >= 3) { toast('That photograph already has three lines. Remove one first.'); return; }
  snap();
  for (const h of Object.keys(S.placed)) S.placed[h] = S.placed[h].filter(x => x !== id);
  (S.placed[hash] = S.placed[hash] || []).push(id);
  S.cut = S.cut.filter(x => x !== id);
  const im = imgByHash[hash], b = byId[id];
  const note = routingNote(im, b.bin);
  paint();
  if (note) toast('Placed. Note: ' + note + '.');
}

// drag
let dragId = null;
const list = document.getElementById('list'), stage = document.getElementById('stage');
list.addEventListener('dragstart', (e) => {
  const c = e.target.closest('.card'); if (!c) return;
  dragId = c.dataset.id; c.classList.add('drag');
  e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move';
});
list.addEventListener('dragend', (e) => { const c = e.target.closest('.card'); if (c) c.classList.remove('drag'); dragId = null; });
stage.addEventListener('dragover', (e) => {
  const hero = e.target.closest('.hero'); if (!hero || !dragId) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move'; hero.classList.add('over');   // every image accepts
});
stage.addEventListener('dragleave', (e) => { const h = e.target.closest('.hero'); if (h) h.classList.remove('over'); });
stage.addEventListener('drop', (e) => {
  const hero = e.target.closest('.hero'); if (!hero) return;
  e.preventDefault(); hero.classList.remove('over');
  const id = e.dataTransfer.getData('text/plain') || dragId; if (!id) return;
  attach(hero.dataset.hash, id);
});

// click-to-select, click-to-place
stage.addEventListener('click', (e) => {
  const det = e.target.closest('[data-detach]');
  if (det) { const [hash, id] = det.dataset.detach.split('|'); snap(); S.placed[hash] = (S.placed[hash] || []).filter(x => x !== id); paint(); return; }
  const fold = e.target.closest('[data-fold]');
  if (fold) { S.folded[fold.dataset.fold] = !S.folded[fold.dataset.fold]; paint(); return; }
  const hero = e.target.closest('.hero');
  if (hero) { selected = selected === hero.dataset.hash ? null : hero.dataset.hash; paint(); }
});
list.addEventListener('click', (e) => {
  const cut = e.target.closest('[data-cut]');
  if (cut) { snap(); if (!S.cut.includes(cut.dataset.cut)) S.cut.push(cut.dataset.cut); paint(); return; }
  const card = e.target.closest('.card'); if (!card) return;
  if (!selected) { toast('Click a photograph first, then click a line to place it.'); return; }
  attach(selected, card.dataset.id);
});

document.getElementById('tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab'); if (!t) return;
  bucket = t.dataset.b; selected = null; query = ''; document.getElementById('q').value = '';
  paint(); stage.scrollTop = 0;
});
document.getElementById('q').addEventListener('input', (e) => { query = e.target.value; renderList(); });
document.getElementById('fam').addEventListener('change', (e) => { famFilter = e.target.value; paint(); });
document.getElementById('bUndo').onclick = undo;
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'Escape') { selected = null; paint(); }
});

// ---------------- backup / import / export ----------------
function dl(name, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }));
  a.download = name; a.click();
}
document.getElementById('bBackup').onclick = () => dl('line-match-backup.json', { version: 2, state: S });
document.getElementById('bImport').onclick = () => document.getElementById('file').click();
document.getElementById('file').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      snap();
      if (d.state && d.state.placed) S = Object.assign({ folded: {} }, d.state);
      else if (d.placed) S = Object.assign({ folded: {} }, d);
      else if (d.approved) return mergeLegacy(d.approved);
      else if (d.matches) S = { placed: JSON.parse(JSON.stringify(d.matches)), cut: (d.cut || []).map(c => c.id || c), folded: {} };
      else return toast('Not a line-match backup, a matches export, or a 2026-08-06 humour export.');
      paint(); toast('Imported.');
    } catch (err) { toast('Could not read that file.'); }
  };
  r.readAsText(f); e.target.value = '';
};
document.getElementById('bLegacy').onclick = () => mergeLegacy(D.legacy);

// The 2026-08-06 export ticked lines against slot keys and reused 235 of them across
// several slots. One image per line is the rule, so the first slot wins and the rest
// are dropped. Routing no longer blocks anything — conflicts are placed and flagged.
function mergeLegacy(approved) {
  snap();
  const slotToHash = {};
  for (const im of D.images) slotToHash[[im.condition, im.time, im.week, im.day].join('|')] = im.hash;
  const used = usedIds(); const cut = new Set(S.cut);
  let added = 0, flagged = 0, dup = 0, full = 0, unknown = 0;
  for (const [slot, ids] of Object.entries(approved)) {
    const hash = slotToHash[slot]; if (!hash) { unknown += ids.length; continue; }
    const im = imgByHash[hash];
    for (const id of ids) {
      if (!byId[id]) { unknown++; continue; }
      if (used.has(id) || cut.has(id)) { dup++; continue; }
      const cur = S.placed[hash] = S.placed[hash] || [];
      if (cur.length >= 3) { full++; continue; }
      cur.push(id); used.add(id); added++;
      if (routingNote(im, byId[id].bin)) flagged++;
    }
  }
  paint();
  toast('Legacy merge: ' + added + ' placed (' + flagged + ' with a routing warning) · ' + dup
      + ' already used elsewhere · ' + full + ' slot already full · ' + unknown + ' not in the bank.');
}

document.getElementById('bExport').onclick = () => {
  const used = usedIds(), matches = {}, detail = [], conflicts = [];
  for (const im of D.images) {
    const ids = (S.placed[im.hash] || []); if (!ids.length) continue;
    matches[im.hash] = ids.slice();
    detail.push({ hash: im.hash, image: im.image, condition: im.condition, time: im.time, week: im.week, day: im.day,
      lines: ids.map(id => {
        const b = byId[id], note = routingNote(im, b.bin), cross = isCross(im, b.bin);
        if (note) conflicts.push({ hash: im.hash, image: im.image, id, bin: b.bin, text: b.text, reason: note });
        return { id, text: b.text, bin: b.bin, source: b.source, crossCondition: cross, wouldRenderToday: !note };
      }) });
  }
  dl('set-001-line-matches-ruled.json', {
    generated: new Date().toISOString().slice(0, 10),
    ruledBy: 'Al, drag-match tool v2',
    set: 'set-001',
    note: 'Al\\'s matches are the spec. routingConflicts records where today\\'s witty-day-tags routing would not serve a match; the routing is to be re-ruled, not the match.',
    bankSize: D.bank.length,
    matches, matchDetail: detail, routingConflicts: conflicts,
    cut: S.cut.map(id => ({ id, text: byId[id].text, bin: byId[id].bin })),
    unplaced: D.bank.filter(b => !used.has(b.id) && !S.cut.includes(b.id)).map(b => ({ id: b.id, text: b.text, bin: b.bin })),
    placedCount: used.size, cutCount: S.cut.length, routingConflictCount: conflicts.length,
    crossConditionCount: detail.reduce((n, d) => n + d.lines.filter(l => l.crossCondition).length, 0),
    imagesAtZero: D.images.filter(i => !(S.placed[i.hash] || []).length).length,
    emptySlots: D.images.reduce((n, i) => n + (3 - (S.placed[i.hash] || []).length), 0),
  });
};

paint();
</script>`;

fs.writeFileSync(path.join(ROOT, 'review/line-match-tool.html'), html);
console.log('wrote review/line-match-tool.html — v2 —', images.length, 'photographs,', bank.length, 'bank lines,',
  Object.values(preplaced).flat().length, 'pre-placed from Al\'s wind export');
