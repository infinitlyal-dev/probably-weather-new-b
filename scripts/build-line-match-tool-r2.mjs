// Builds review/line-match-tool-r2.html — round 2 of Al's hand-matching, bespoke-era lines.
//
// Round 1 (scripts/build-line-match-tool.mjs) matched the ORIGINAL CONDITION BANK to the
// 294 photographs. Round 2 matches the BESPOKE-ERA pool: every line Al has approved since
// the bespoke rewrite began, deduped across the wired live set, his ruled bucket exports,
// wind's non-bank keeps, and the 2026-08-30 humour test batch.
//
// Al's round-1 placements are carried in LOCKED — they stand, they show on their
// photographs, and they count toward the 3-per-image ceiling. Nothing here places a line
// except Al's own confirmed ticks.
//
// Same UX as v2, deliberately: Mon→Sun inside dawn/day/dusk/night, routing reported and
// never enforced, cross-condition allowed via the family filter and all-lines search,
// click-to-select then click-to-place, drag, undo, fold, inline remove, localStorage
// autosave, backup / import / export.
//
//   node scripts/build-line-match-tool-r2.mjs
import { createHash } from 'node:crypto';
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
const imgByHash = Object.fromEntries(images.map((i) => [i.hash, i]));

// ---- round 1: Al's placements, locked ------------------------------------
// These stand. They pre-load onto their photographs, cannot be moved from this tool, and
// their texts are excluded from the round-2 pool so nothing can be placed twice.
const r1 = J('review/set-001-line-matches-ruled.json');
const locked = {};
for (const d of r1.matchDetail) {
  locked[d.hash] = d.lines.map((l) => ({ id: l.id, text: l.text, bin: l.bin }));
}

// ---- the bespoke-era pool -------------------------------------------------
const norm = (s) => String(s).replace(/\s+/g, ' ').trim()
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();
const lineId = (text) => 'b2:' + createHash('sha1').update(norm(text)).digest('hex').slice(0, 8);

const pool = new Map();   // id -> entry
function add(text, { bin, source, bankOriginal = false, origin = null }) {
  if (typeof text !== 'string' || !text.trim()) return;
  const id = lineId(text);
  const cur = pool.get(id);
  if (!cur) {
    pool.set(id, { id, text: text.trim(), bin, source, sources: [source], bankOriginal, origins: origin ? [origin] : [] });
    return;
  }
  if (!cur.sources.includes(source)) cur.sources.push(source);
  if (origin && !cur.origins.includes(origin)) cur.origins.push(origin);
  cur.bankOriginal = cur.bankOriginal || bankOriginal;
}
const slotLabel = (im) => im ? im.condition + ' ' + im.week + '/' + im.day + ' ' + im.time : null;

// 1. the wired live set — assets/hero-lines.js, what the bespoke path serves today.
//    Slot-path keys carry the condition; bg-canonical keys are the same lines by sha256.
const heroSrc = fs.readFileSync(path.join(ROOT, 'assets/hero-lines.js'), 'utf8');
const heroBlock = heroSrc.slice(heroSrc.indexOf('__HERO_LINES__'), heroSrc.indexOf('\n});'));
const draftPathToHash = new Map();
for (const a of J('review/set-001-draft.json').assignments) {
  for (const p of new Set([a.image, ...(a.paths || [])])) draftPathToHash.set(p, a.hash);
}
let wiredKeys = 0;
for (const m of heroBlock.matchAll(/^\s*"([^"]+)":\s*(\[[\s\S]*?\]),\s*$/gm)) {
  const key = m[1];
  if (!key.startsWith('bg/')) continue;          // canonical keys duplicate the same lines
  wiredKeys++;
  const slot = key.slice(3);
  const hash = draftPathToHash.get(slot);
  const im = hash ? imgByHash[hash] : null;
  const cond = slot.split('/')[0];
  for (const text of JSON.parse(m[2])) add(text, { bin: cond, source: 'wired', origin: slotLabel(im) });
}
if (!wiredKeys) throw new Error('hero-lines.js: parsed 0 slot keys — the generated block changed shape');

// 2-7. Al's ruled bucket exports. `kept` is the tick; `rejected` never enters the pool.
//      Wind is the one bucket filtered: its bank rescues belong to round 1's pool, so only
//      the lines that are NOT bank-originals come across.
const RULED = [
  ['review/set-001-lines-bespoke-clear-v2-ruled.json', 'clear-v2', false],
  ['review/set-001-lines-bespoke-heat-v2-ruled.json', 'heat-v2', false],
  ['review/set-001-lines-bespoke-clear-v3-ruled.json', 'clear-v3', false],
  ['review/set-001-lines-bespoke-cloudy-v3-ruled.json', 'cloudy-v3', false],
  ['review/set-001-lines-bespoke-wind-ruled.json', 'wind', true],
  ['review/set-001-humour-test-batch-ruled.json', 'humour-test', false],
  // Astra's six bucket reviews, adopted as Al's rulings 2026-09-05 (veto list: none).
  // Their KILLs sit in `unruled`, not `rejected`, and never reach this pool either way.
  ['review/set-001-lines-bespoke-cold-v3-astra-ruled.json', 'cold-astra', false],
  ['review/set-001-lines-bespoke-cold-clear-v3-astra-ruled.json', 'cold-clear-astra', false],
  ['review/set-001-lines-bespoke-fog-v3-astra-ruled.json', 'fog-astra', false],
  ['review/set-001-lines-bespoke-rain-v3-astra-ruled.json', 'rain-astra', false],
  ['review/set-001-lines-bespoke-storm-v3-astra-ruled.json', 'storm-astra', false],
  ['review/set-001-lines-bespoke-heat-v3-astra-ruled.json', 'heat-astra', false],
];
for (const [file, source, dropBankOriginals] of RULED) {
  for (const e of J(file).images) {
    for (const k of e.kept || []) {
      const isBank = k.source === 'bank';
      if (dropBankOriginals && isBank) continue;
      add(k.text, { bin: e.condition, source, bankOriginal: isBank, origin: slotLabel(imgByHash[e.hash]) });
    }
  }
}

// Exclusion: anything Al already hand-placed in round 1. Those placements stand; a line
// cannot be in play twice. Matched on normalised text, because a bank rescue and a bespoke
// keep can be the same sentence arriving by two routes.
const placedR1 = new Set(Object.values(locked).flat().map((l) => norm(l.text)));
const excluded = [];
for (const [id, e] of [...pool]) {
  if (placedR1.has(norm(e.text))) { excluded.push(e); pool.delete(id); }
}

const bank = [...pool.values()].sort((a, b) =>
  BUCKETS.indexOf(a.bin) - BUCKETS.indexOf(b.bin) || a.text.localeCompare(b.text));

const DATA = { CARD, BUCKETS, TIMES, DAYS, images, bank, locked };

const html = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PW — line match, round 2</title>
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
.cap div.r1{font-weight:400;color:#9aa6b2;font-style:italic}
.tagline{position:absolute;top:6px;left:6px;background:#000b;border-radius:5px;padding:1px 6px;font-size:10px;color:#cfd6df}
.count{position:absolute;top:6px;right:6px;background:#000b;border-radius:5px;padding:1px 6px;font-size:10px}
.count.f3{background:#1e4d33dd;color:#9ff0c2}
.slot ul{list-style:none;margin:5px 0 0;padding:0}
.slot li{display:flex;gap:5px;align-items:flex-start;font-size:11px;line-height:1.35;color:var(--dim);padding:3px 0;border-top:1px solid var(--line)}
.slot li.r1{color:#6f7a86;font-style:italic;background:#12161b}
.slot li span.t{flex:1}
.slot li button{border:0;background:none;color:#79838f;cursor:pointer;font-size:12px;line-height:1;padding:0 1px}
.slot li button:hover{color:var(--no)}
.warn{display:inline-block;font-size:9px;padding:0 5px;border-radius:999px;background:#3a2c0e;color:#e5bb61;border:1px solid #6d5417;white-space:nowrap;margin-right:4px}
.xc{display:inline-block;font-size:9px;padding:0 5px;border-radius:999px;background:#12302e;color:#7fd0c8;border:1px solid #23504c;white-space:nowrap;margin-right:4px}
.lk{display:inline-block;font-size:9px;padding:0 5px;border-radius:999px;background:#1b2129;color:#8c99a7;border:1px solid #313b47;white-space:nowrap;margin-right:4px;font-style:normal}
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
.src{font-size:9.5px;padding:0 6px;border-radius:999px;background:#1a2430;color:#9dc0e6;border:1px solid #2c3d52;white-space:nowrap}
.src.wired{background:#14301f;color:#8fdcae;border-color:#245239}
.src.humour-test{background:#2a2340;color:#b9a9ff;border-color:#443a76}
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
  <h1>PW — line match, round 2</h1>
  <div class="tabs" id="tabs"></div>
  <div class="spacer"></div>
  <button class="act" id="bUndo" disabled>Undo</button>
  <button class="act" id="bBackup">Backup</button>
  <button class="act" id="bImport">Import…</button>
  <button class="act pri" id="bExport">Export</button>
</header>
<div id="hint">Bespoke-era pool. Click a photograph to select it, then click a line to place it — or drag. Round-1 placements are <i style="color:#6f7a86">greyed and locked</i> and count toward the three. Any line may go on any photograph; <span class="xc">cross</span> only says it was written for another condition — a line is humour about the kind of day and need only <b>gel</b> with the picture.</div>
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
const KEY = 'pw-line-match-r2-v1';
const FAM = { clear:['clear','uv'], cloudy:['cloudy','rain-possible','partly-cloudy'], storm:['storm','thunder','hail'],
              wind:['wind'], heat:['heat'], cold:['cold'], 'cold-clear':['cold-clear'], fog:['fog'], rain:['rain'] };
const EXTRA = { clear:['weekend','night'], heat:['weekend'] };   // bins a condition can natively reach
const homeBins = (c) => (FAM[c] || [c]).concat(EXTRA[c] || []);
const byId = Object.fromEntries(D.bank.map(b => [b.id, b]));
const imgByHash = Object.fromEntries(D.images.map(i => [i.hash, i]));
const lockedOn = (hash) => D.locked[hash] || [];

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
let S = { placed: {}, cut: [], folded: {} };
try { const raw = JSON.parse(LS.get(KEY) || 'null'); if (raw && raw.placed) { S = raw; S.folded = S.folded || {}; } else seed(); }
catch (e) { seed(); }
function seed() { S = { placed: {}, cut: [], folded: {} }; }
const save = () => LS.set(KEY, JSON.stringify(S));

// ---- undo, last 20 ----
const undoStack = [];
function snap() { undoStack.push(JSON.stringify(S)); if (undoStack.length > 20) undoStack.shift(); }
function undo() { const p = undoStack.pop(); if (!p) return; S = JSON.parse(p); paint(); toast('Undone.'); }

// ---- routing: reported, never enforced ----
// The bespoke path (assets/app.js, applyBespokeLine) resolves the line FROM THE
// PHOTOGRAPH, before witty-day-tags' bin routing ever runs, so a bespoke-era line placed
// here always renders on the picture it is placed on. The amber badge therefore only
// fires for lines that are still bank-originals living in the condition pool, where
// today's routing genuinely decides whether they get served.
const isWeekendSlot = (im) => ['sat','sun'].includes(im.day) || (im.day === 'fri' && ['dusk','night'].includes(im.time));
const isNightSlot   = (im) => im.condition === 'clear' && im.time === 'night';
function routingNote(im, bin) {
  if (isNightSlot(im)) return bin === 'night' ? null
    : 'clear night slots resolve to the night bin, so the app would not serve a ' + bin + ' line here';
  if (isWeekendSlot(im) && (im.condition === 'clear' || im.condition === 'heat')) return bin === 'weekend' ? null
    : 'the weekend bin pre-empts the ' + im.condition + ' pool on ' + im.day + ', so the app would not serve a ' + bin + ' line here';
  if (bin === 'weekend') return 'weekend lines only render on clear or heat images in a Sat/Sun (or Fri-from-16:00) slot';
  if (bin === 'night') return 'night lines only render on clear images at night';
  if (!homeBins(im.condition).includes(bin)) return 'the app picks the image and the line from the same condition, so a ' + bin + ' line would not appear over a ' + im.condition + ' photograph';
  return null;
}
const warnFor = (im, b) => b && b.bankOriginal ? routingNote(im, b.bin) : null;
const isCross = (im, bin) => !homeBins(im.condition).includes(bin);

let bucket = LS.get(KEY + ':bucket') || 'clear';
let famFilter = LS.get(KEY + ':fam') || '__bucket__';
let query = '';
let selected = null;
const usedIds = () => new Set(Object.values(S.placed).flat());
const fill = (hash) => lockedOn(hash).length + (S.placed[hash] || []).length;
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
    const done = grp.filter(i => fill(i.hash) >= 3).length;
    h += '<h2 class="time" data-fold="' + fkey + '"><span class="caret">' + (folded ? '\\u25B8' : '\\u25BE') + '</span>'
      + t + ' · ' + grp.length + '<span class="fold">' + done + '/' + grp.length + ' full · click to '
      + (folded ? 'open' : 'fold') + '</span></h2>';
    if (folded) continue;
    h += '<div class="grid">';
    for (const im of grp) {
      const lock = lockedOn(im.hash), ids = S.placed[im.hash] || [], n = lock.length + ids.length;
      h += '<div class="slot' + (selected === im.hash ? ' sel' : '') + '" data-hash="' + im.hash + '">'
        + '<div class="hero" data-hash="' + im.hash + '">'
        + '<img loading="lazy" src="../assets/images/bg/' + im.image + '" alt="">'
        + '<div class="tagline">' + im.week + ' · ' + im.day + '</div>'
        + '<div class="count' + (n >= 3 ? ' f3' : '') + '">' + n + '/3</div>'
        + '<div class="cap">'
        + lock.map(l => '<div class="r1">' + esc(l.text) + '</div>').join('')
        + ids.map(id => '<div>' + esc((byId[id] || {}).text || id) + '</div>').join('')
        + '</div></div>'
        + '<ul>'
        + lock.map(l => '<li class="r1"><span class="t"><span class="lk" title="placed in round 1 — locked">R1</span>'
            + esc(l.text) + '</span></li>').join('')
        + ids.map(id => {
            const b = byId[id] || { text: id, bin: '?' };
            const note = warnFor(im, b);
            return '<li><span class="t">'
              + (note ? '<span class="warn" title="' + esc(note) + '">won\\'t render</span>' : '')
              + (isCross(im, b.bin) ? '<span class="xc" title="written for a ' + b.bin + ' photograph">cross</span>' : '')
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
  const show = q ? pool.filter(b => (b.text + ' ' + b.id + ' ' + b.sources.join(' ')).toLowerCase().includes(q)) : pool;
  const sel = selected ? imgByHash[selected] : null;
  document.getElementById('binfo').innerHTML = show.length + ' of ' + pool.length + ' unplaced'
    + (sel ? ' · placing on <b style="color:#9fc2ea">' + sel.condition + ' ' + sel.week + '/' + sel.day + ' ' + sel.time
             + '</b> (' + fill(sel.hash) + '/3)'
           : ' · <span style="color:#d19a2a">no photograph selected</span>');
  document.getElementById('list').innerHTML = show.map(b => {
    const note = sel ? warnFor(sel, b) : null;
    const cross = sel ? isCross(sel, b.bin) : false;
    const srcTitle = 'source: ' + b.sources.join(', ') + (b.origins.length ? ' · written for ' + b.origins.join(' / ') : '');
    return '<div class="card" draggable="true" data-id="' + b.id + '"><div class="t">' + esc(b.text) + '</div>'
      + '<div class="m"><span class="id">' + b.bin + '</span>'
      + '<span class="src ' + b.source + '" title="' + esc(srcTitle) + '">' + b.source
      + (b.sources.length > 1 ? ' +' + (b.sources.length - 1) : '') + '</span>'
      + (b.bankOriginal ? '<span class="mine" title="an original condition-bank line Al kept during the bespoke review">bank</span>' : '')
      + (cross ? '<span class="xc">cross</span>' : '')
      + (note ? '<span class="warn" title="' + esc(note) + '">won\\'t render</span>' : '')
      + '<button class="x" data-cut="' + b.id + '">cut</button></div></div>';
  }).join('') || '<div style="color:var(--dim);font-size:13px;padding:10px 2px">Nothing left under this filter.</div>';
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = D.BUCKETS.map(b => {
    const ims = D.images.filter(i => i.condition === b);
    const n = ims.reduce((m, i) => m + fill(i.hash), 0);
    return '<button class="tab' + (b === bucket ? ' on' : '') + '" data-b="' + b + '">' + b + ' <b>' + n + '</b>/' + (ims.length * 3) + '</button>';
  }).join('');
}
function renderFoot() {
  const ims = D.images.filter(i => i.condition === bucket);
  const at = (n) => ims.filter(i => fill(i.hash) === n).length;
  const used = usedIds();
  let conflicts = 0, cross = 0;
  for (const [hash, ids] of Object.entries(S.placed)) { const im = imgByHash[hash]; if (!im) continue;
    for (const id of ids) { const b = byId[id]; if (!b) continue; if (warnFor(im, b)) conflicts++; if (isCross(im, b.bin)) cross++; } }
  const toWrite = D.images.reduce((n, i) => n + (3 - fill(i.hash)), 0);
  document.getElementById('foot').innerHTML =
    '<span>' + bucket + ' (both rounds): <b>' + at(0) + '</b> at 0 · <b>' + at(1) + '</b> at 1 · <b>' + at(2) + '</b> at 2 · <b>' + at(3) + '</b> at 3</span>'
    + '<span>pool <b>' + used.size + '</b> placed · <b>' + (D.bank.length - used.size - S.cut.length) + '</b> remaining · <b>' + S.cut.length + '</b> cut</span>'
    + '<span>photographs at 0: <b>' + D.images.filter(i => !fill(i.hash)).length + '</b></span>'
    + '<span>still to write: <b style="color:#9ff0c2">' + toWrite + '</b></span>'
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
  if (fill(hash) >= 3) {
    const lk = lockedOn(hash).length;
    toast(lk ? 'That photograph is full — ' + lk + ' from round 1 plus ' + cur.length + ' from this round. Remove one of yours first.'
             : 'That photograph already has three lines. Remove one first.');
    return;
  }
  snap();
  for (const h of Object.keys(S.placed)) S.placed[h] = S.placed[h].filter(x => x !== id);
  (S.placed[hash] = S.placed[hash] || []).push(id);
  S.cut = S.cut.filter(x => x !== id);
  const im = imgByHash[hash], b = byId[id];
  const note = warnFor(im, b);
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
document.getElementById('bBackup').onclick = () => dl('line-match-r2-backup.json', { version: 1, round: 2, state: S });
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
      else if (d.matches) S = { placed: JSON.parse(JSON.stringify(d.matches)), cut: (d.cut || []).map(c => c.id || c), folded: {} };
      else return toast('Not a round-2 backup or a round-2 matches export.');
      // Anything the file names that is not in this pool — a round-1 bank id, a line
      // dropped since — is discarded rather than kept as a dead id.
      let dropped = 0;
      for (const h of Object.keys(S.placed)) {
        const keep = S.placed[h].filter(id => byId[id]);
        dropped += S.placed[h].length - keep.length;
        if (keep.length) S.placed[h] = keep; else delete S.placed[h];
      }
      S.cut = (S.cut || []).filter(id => byId[id]);
      paint(); toast('Imported.' + (dropped ? ' ' + dropped + ' line(s) not in this pool were dropped.' : ''));
    } catch (err) { toast('Could not read that file.'); }
  };
  r.readAsText(f); e.target.value = '';
};

document.getElementById('bExport').onclick = () => {
  const used = usedIds(), matches = {}, detail = [], conflicts = [], merged = {};
  for (const im of D.images) {
    const lock = lockedOn(im.hash), ids = (S.placed[im.hash] || []);
    if (lock.length || ids.length) merged[im.hash] = lock.map(l => l.text).concat(ids.map(id => byId[id].text));
    if (!ids.length) continue;
    matches[im.hash] = ids.slice();
    detail.push({ hash: im.hash, image: im.image, condition: im.condition, time: im.time, week: im.week, day: im.day,
      round1: lock.map(l => ({ id: l.id, text: l.text, bin: l.bin })),
      lines: ids.map(id => {
        const b = byId[id], note = warnFor(im, b), cross = isCross(im, b.bin);
        if (note) conflicts.push({ hash: im.hash, image: im.image, id, bin: b.bin, text: b.text, reason: note });
        return { id, text: b.text, bin: b.bin, source: b.source, sources: b.sources, bankOriginal: b.bankOriginal,
                 writtenFor: b.origins, crossCondition: cross, wouldRenderToday: !note };
      }) });
  }
  // ---- merged gap report: both rounds, per bucket ----
  const perBucket = {};
  for (const b of D.BUCKETS) {
    const ims = D.images.filter(i => i.condition === b);
    const at = (n) => ims.filter(i => fill(i.hash) === n).length;
    perBucket[b] = { images: ims.length, at0: at(0), at1: at(1), at2: at(2), at3: at(3),
      round1Lines: ims.reduce((n, i) => n + lockedOn(i.hash).length, 0),
      round2Lines: ims.reduce((n, i) => n + (S.placed[i.hash] || []).length, 0),
      linesToWrite: ims.reduce((n, i) => n + (3 - fill(i.hash)), 0) };
  }
  const totals = Object.values(perBucket).reduce((t, v) => {
    for (const k of Object.keys(v)) t[k] = (t[k] || 0) + v[k]; return t;
  }, {});
  dl('set-001-line-matches-r2-ruled.json', {
    generated: new Date().toISOString().slice(0, 10),
    ruledBy: 'Al, drag-match tool round 2 (bespoke-era pool)',
    set: 'set-001',
    round: 2,
    note: 'Al\\'s matches are the spec. Round-1 placements (review/set-001-line-matches-ruled.json) are carried in as round1 on each image and count toward the 3-per-image ceiling; they were not re-ruled here. A line is humour about the kind of day and need only gel with the photograph, so crossCondition is information, not a fault. routingConflicts only ever concerns bank-original lines: the bespoke path resolves a line from the photograph before witty-day-tags routing runs.',
    poolSize: D.bank.length,
    matches, matchDetail: detail, mergedByHash: merged, routingConflicts: conflicts,
    cut: S.cut.map(id => ({ id, text: byId[id].text, bin: byId[id].bin, source: byId[id].source })),
    unplaced: D.bank.filter(b => !used.has(b.id) && !S.cut.includes(b.id)).map(b => ({ id: b.id, text: b.text, bin: b.bin, source: b.source })),
    placedCount: used.size, cutCount: S.cut.length, routingConflictCount: conflicts.length,
    crossConditionCount: detail.reduce((n, d) => n + d.lines.filter(l => l.crossCondition).length, 0),
    gapReport: { countsBothRounds: true, images: D.images.length, perBucket, totals,
      linesToWrite: totals.linesToWrite, imagesAtZero: D.images.filter(i => !fill(i.hash)).length },
    imagesAtZero: D.images.filter(i => !fill(i.hash)).length,
    emptySlots: D.images.reduce((n, i) => n + (3 - fill(i.hash)), 0),
  });
};

paint();
</script>`;

fs.writeFileSync(path.join(ROOT, 'review/line-match-tool-r2.html'), html);

const bySource = {};
for (const b of bank) bySource[b.source] = (bySource[b.source] || 0) + 1;
const byBin = {};
for (const b of bank) byBin[b.bin] = (byBin[b.bin] || 0) + 1;
const lockedCount = Object.values(locked).flat().length;
console.log('wrote review/line-match-tool-r2.html');
console.log('  photographs        ', images.length);
console.log('  round-1 locked     ', lockedCount, 'lines on', Object.keys(locked).length, 'photographs');
console.log('  pool               ', bank.length, 'lines');
console.log('  by source          ', JSON.stringify(bySource));
console.log('  by condition       ', JSON.stringify(byBin));
console.log('  bank-originals kept', bank.filter((b) => b.bankOriginal).length);
console.log('  excluded (placed R1)', excluded.length);
console.log('  empty slots now    ', images.reduce((n, i) => n + (3 - (locked[i.hash] || []).length), 0));
