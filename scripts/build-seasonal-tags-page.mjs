// The season page for Al, as KEEP / CUT (2026-09-22).
//
// The 2026-09-19 audit found the lines that name a month, a season, a holiday, a
// school term or a dated event (review/LINE-AUDIT-2026-09-19.md §3). The first
// version of this page asked Al to tag every one ALWAYS / MONTH WINDOW / SEASON.
// He hates most of them, so the question is now the one he actually wants to
// answer: does this line stay at all? Every row starts CUT. Switching one to KEEP
// opens a small "when can it show" picker, pre-filled with my suggestion, so
// keeping a line and accepting its window is one click.
//
// One row arrives pre-set: B450, Al's own "Clouds are crying like NZ at the 23
// Rugby WC!", KEEP + ALWAYS (his ruling in the 2026-09-19 brief: a past event, it
// plays on any hard-rain day).
//
// WHAT CUT DOES, stated on every card so nothing surprises him:
//   photograph row — the line comes off every photograph it is on, English and
//     Afrikaans. If the same sentence is also a condition-bank line, the bank
//     copy stays, governed by its bank tag.
//   bank row — the line leaves the condition bank in all five languages (the
//     arrays are index-aligned; a line cannot leave one language only).
//
// The footer counts, live: kept, cut, and the photographs that would be left
// with no line at all — they fall back to a condition-bank line, never a blank.
//
// Writes review/seasonal-tags.html (file://, localStorage) and
// review/seasonal-tags-worklist.json (read by scripts/verify-seasonal-gate.mjs and
// by scripts/apply-seasonal-ruling.mjs). The page exports seasonal-ruled.json to
// Downloads; copy it into review/ and run scripts/apply-seasonal-ruling.mjs.
//
//   node scripts/build-seasonal-tags-page.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_LINES, HERO_LINE_TAGS } from '../assets/hero-lines.js';
import { HERO_LINES_AF } from '../assets/hero-lines-af.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import { WITTY_DAY_TAGS, seasonMonths } from '../assets/witty-day-tags.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const idToEn = new Map(JSON.parse(readFileSync(path.join(root, 'review', 'af-bespoke-decisions.json'), 'utf8')).rows.map((r) => [r.id, r.english]));
const authoring = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-lines-bespoke-final.json'), 'utf8'));

const W = { ruling: 'SEASON', season: 'winter' };
const S = { ruling: 'SEASON', season: 'summer' };
const A = { ruling: 'ALWAYS' };
const M = (...months) => ({ ruling: 'MONTHS', months });
const SCHOOL = M(2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
// [id, grade, what it names, suggestion] — the audit's list; lines the provenance cull removed are skipped below.
const BESPOKE = [
  ['N299', 'A', 'November', M(11, 12, 1, 2, 3)], ['B212', 'A', 'December', M(1, 2, 3)], ['B450', 'A', 'the 2023 Rugby World Cup', A],
  ['N277', 'B', 'summer arriving', M(10, 11)], ['N428', 'B', 'high summer', M(12, 1, 2)], ['C040', 'B', 'winter', W], ['N220', 'B', 'summer', S],
  ['C100', 'B', 'summer', S], ['N068', 'B', 'winter', W], ['B459', 'B', 'Joburg summer rain', S], ['B517', 'B', 'jacaranda season', M(10, 11)],
  ['B004', 'B', 'jacaranda blossom', M(10, 11)], ['B095', 'B', 'jacaranda blossom', M(10, 11)], ['B110', 'B', 'jacaranda blossom', M(10, 11)],
  ['B470', 'B', 'jacaranda blossom', M(10, 11)], ['N419', 'B', 'snow on the Apostles', M(6, 7, 8)], ['N421', 'B', 'snow on the mountain', M(6, 7, 8)],
  ['N425', 'B', 'snow on the berg', M(6, 7, 8)],
  ['C218', 'C', 'winter', W], ['C222', 'C', 'Highveld winter', W], ['C224', 'C', 'winter', W], ['C252', 'C', 'winter', W], ['C189', 'C', 'winter sun', W],
  ['B388', 'C', 'winter', W], ['N036', 'C', 'winter', W], ['N367', 'C', 'winter', W], ['B398', 'C', 'winter', W], ['B393', 'C', 'winter', W],
  ['B400', 'C', 'winter', W], ['B412', 'C', 'winter', W], ['N046', 'C', 'winter', W], ['B353', 'C', 'till spring', W], ['N172', 'C', 'summer clothes', W],
  ['B367', 'C', 'heater season', W], ['B368', 'C', 'winter', W], ['B381', 'C', 'winter nights', W], ['B378', 'C', 'winter', W], ['B385', 'C', 'Cape winter', W],
  ['B382', 'C', 'winter nights', W], ['B361', 'C', 'winter', W], ['B356', 'C', 'winter', W], ['B360', 'C', 'winter Sunday', W], ['B248', 'C', 'all summer', M(1, 2, 3)],
  ['N170', 'D', 'the walk to school', SCHOOL], ['N192', 'D', 'the school run', SCHOOL], ['N194', 'D', 'school bags', SCHOOL], ['B395', 'D', 'the school run', SCHOOL],
  ['N167', 'D', 'the school run', SCHOOL], ['N470', 'D', 'school tie and uniform', SCHOOL], ['N473', 'D', 'school starts', SCHOOL], ['N291', 'D', 'the school run', SCHOOL],
  ['N432', 'D', 'school shoes', SCHOOL], ['N433', 'D', 'school uniform', SCHOOL], ['N577', 'D', 'the school run', SCHOOL], ['N578', 'D', 'school', SCHOOL],
  ['N574', 'D', 'your holiday', A], ['N400', 'D', 'holiday photos', A],
  ['N300', 'E', '"this month"', A], ['B133', 'E', '"this month"', A], ['C015', 'E', 'winter (save it for)', M(10, 11, 12, 1, 2, 3, 4)], ['N519', 'E', 'winter colour, "whatever the calendar says"', A],
  ['N429', 'E', 'agapanthus', M(11, 12, 1, 2)], ['N199', 'E', 'cricket', S], ['N076', 'E', 'rugby', A], ['C235', 'E', 'rugby', A], ['C236', 'E', 'rugby, blankets', W],
  ['B392', 'E', 'rugby', A], ['C344', 'E', 'load shedding (approved in the Eskom ruling, 2026-09-22)', A],
];
// Bank lines, keyed by their TEXT. They were keyed by index until 2026-09-22, when
// the Eskom cut took two lines out of the clear bin and moved every later index
// — the page would have shown Al four lines he never saw on the audit.
const BANK = [
  ['witty', 'clear', "This is the weather you'll miss in December traffic.", 'A', 'December', M(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)],
  ['witty', 'clear', 'Cancel everything. This is THE day winter was hiding.', 'B', 'winter', W],
  ['witty', 'clear', "Highveld winter flex: laundry dry before the kettle's even done.", 'B', 'Highveld winter', W],
  ['witty', 'clear', 'Off-season beach: same ocean, zero fight for parking.', 'B', 'off-season beach', W],
  ['witty', 'fog', "Every glow down there is someone else who also can't believe it's already winter.", 'B', '"already winter"', M(5, 6)],
];

// photograph hash -> every slot it holds, and its current line count
const photoOf = new Map();       // "bg/<slot>" -> hash
const photoLines = {};           // hash -> live line count
const photoImage = {};           // hash -> a slot to show
const draft = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-draft.json'), 'utf8'));
const slotsByHash = new Map(draft.assignments.map((a) => [a.hash, [...new Set([a.image, ...(a.paths || [])])]]));
for (const e of authoring.set) {
  photoLines[e.hash] = e.lines.length;
  const slots = slotsByHash.get(e.hash) || [e.image];
  photoImage[e.hash] = slots[0];
  for (const s of slots) photoOf.set(`bg/${s}`, e.hash);
}
const hashesCarrying = (en) => [...new Set(Object.entries(HERO_LINES).filter(([k, v]) => k.startsWith('bg/') && v.includes(en)).map(([k]) => photoOf.get(k)).filter(Boolean))];
const withMonths = (s) => (s && s.ruling === 'SEASON' ? { ...s, months: seasonMonths(s.season) } : s);
const bankRowOf = new Map();
for (const ns of ['witty', 'witty_low_confidence']) for (const [bin, v] of Object.entries(WEATHER_COPY[ns])) (v.en || []).forEach((t, i) => { if (!bankRowOf.has(t)) bankRowOf.set(t, `${ns}:${bin}#${i}`); });

const rows = [];
const culled = [];
for (const [id, grade, names, suggest] of BESPOKE) {
  const en = idToEn.get(id);
  if (!en) throw new Error(`${id}: no such line id in review/af-bespoke-decisions.json`);
  const photos = hashesCarrying(en);
  if (!photos.length) { culled.push({ key: id, grade, names, en }); continue; }
  rows.push({
    key: id, kind: 'bespoke', grade, names, en, af: HERO_LINES_AF[en] || null,
    image: photoImage[photos[0]], photos, alsoBank: bankRowOf.get(en) || null,
    current: HERO_LINE_TAGS[en] || null, suggest: withMonths(suggest),
    preset: id === 'B450' ? { verdict: 'KEEP', ruling: 'ALWAYS', by: "Al, in the 2026-09-19 brief: a past event, it plays on any hard-rain day" } : null,
  });
}
for (const [ns, bin, en, grade, names, suggest] of BANK) {
  const i = WEATHER_COPY[ns][bin].en.indexOf(en);
  if (i < 0) { culled.push({ key: `${ns}:${bin}`, grade, names, en }); continue; }
  const photos = hashesCarrying(en);
  rows.push({
    key: `${ns}:${bin}#${i}`, kind: 'bank', grade, names, en, af: WEATHER_COPY[ns][bin].af?.[i] || null,
    // A bank line has no photograph of its own: it captions any <bin> photograph with
    // no lines, share cards, and every zu/xh/st screen. Show one it could land on.
    image: photos.length ? photoImage[photos[0]] : `${bin}/week_1/${ns === 'witty' && bin === 'fog' ? 'night' : 'day'}/1.webp`,
    photos: [], onPhoto: photos.length ? photoImage[photos[0]] : null,
    current: WITTY_DAY_TAGS[ns]?.[bin]?.[i] || null, suggest: withMonths(suggest), preset: null,
  });
}

writeFileSync(path.join(root, 'review', 'seasonal-tags-worklist.json'), JSON.stringify({
  generated: '2026-09-22',
  source: 'review/LINE-AUDIT-2026-09-19.md §3, less what the provenance cull removed on 2026-09-20',
  audited: BESPOKE.length + BANK.length,
  culledCount: culled.length,
  culled,
  rows,
}, null, 1));

// Only what the page needs to count photographs going to zero: each touched
// photograph's current line total.
const touched = [...new Set(rows.flatMap((r) => r.photos))];
const PHOTOS = Object.fromEntries(touched.map((h) => [h, { lines: photoLines[h], image: photoImage[h] }]));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Season lines</title>
<style>
:root { --bg:#f7f6f2; --fg:#1d1d1b; --muted:#6b6a64; --line:#dddbd2; --card:#fff; --accent:#1f5f8b; --pick:#e8f0f6;
        --keep:#2e7d4f; --keepbg:#e7f3ec; --cut:#a5452b; --cutbg:#f6ebe7; }
@media (prefers-color-scheme: dark) { :root { --bg:#161614; --fg:#ecebe6; --muted:#a3a29b; --line:#34332f; --card:#1f1f1c;
        --accent:#7fb6dd; --pick:#1d2a33; --keep:#7ccf9c; --keepbg:#17271e; --cut:#e08a6e; --cutbg:#2b1a15; } }
* { box-sizing:border-box; }
body { margin:0; padding:18px 16px 88px; background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, sans-serif; }
main { max-width:980px; margin:0 auto; }
h1 { font-size:1.4rem; margin:0 0 4px; }
.lede { color:var(--muted); margin:0 0 14px; max-width:80ch; font-size:.93rem; }
.lede b { color:var(--fg); }
.row { display:grid; grid-template-columns:64px 1fr auto; gap:12px; align-items:start; background:var(--card);
       border:1px solid var(--line); border-left:4px solid var(--cut); border-radius:9px; padding:9px 10px; margin:0 0 8px; }
.row.KEEP { border-left-color:var(--keep); }
.row img { width:64px; height:114px; object-fit:cover; border-radius:5px; background:#333; }
.row.CUT img { filter:grayscale(.7) brightness(.8); }
.en { font-weight:600; margin:0 0 2px; }
.row.CUT .en { color:var(--muted); text-decoration:line-through; text-decoration-color:var(--cut); }
.meta { font-size:.8rem; color:var(--muted); margin:0; }
.grade { display:inline-block; font-weight:700; font-size:.72rem; padding:0 6px; border-radius:99px; border:1px solid currentColor; margin-right:5px; }
.toggle { display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; white-space:nowrap; }
.toggle button { font:inherit; font-size:.85rem; font-weight:700; border:0; padding:7px 12px; cursor:pointer; background:transparent; color:var(--muted); }
.row.KEEP .toggle .k { background:var(--keep); color:#fff; }
.row.CUT .toggle .c { background:var(--cut); color:#fff; }
.when { grid-column:2 / 4; display:none; background:var(--keepbg); border-radius:7px; padding:7px 9px; margin-top:2px; }
.row.KEEP .when { display:block; }
.when .label { font-size:.78rem; color:var(--muted); margin-right:6px; }
.opts { display:inline-flex; flex-wrap:wrap; gap:4px; vertical-align:middle; }
.opts button, .months button, .seasons button { font:inherit; font-size:.8rem; border:1px solid var(--line); background:var(--card);
       color:var(--fg); border-radius:6px; padding:3px 8px; cursor:pointer; }
.opts button.on, .months button.on, .seasons button.on { background:var(--accent); border-color:var(--accent); color:#fff; }
.months, .seasons { display:flex; flex-wrap:wrap; gap:3px; margin-top:6px; }
.hint { font-size:.76rem; color:var(--muted); margin-top:5px; }
.preset { color:var(--keep); font-size:.78rem; margin-top:4px; }
footer { position:fixed; left:0; right:0; bottom:0; background:var(--bg); border-top:1px solid var(--line);
         padding:10px 16px; display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
footer .stat { font-variant-numeric:tabular-nums; font-size:.92rem; }
footer .stat b { font-size:1.05rem; }
footer .zero b { color:var(--cut); }
footer .spacer { flex:1; }
footer button { font:inherit; padding:7px 13px; border-radius:7px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; font-weight:600; }
footer button.ghost { background:transparent; color:var(--accent); }
@media (max-width:560px) { .row { grid-template-columns:52px 1fr; } .row img { width:52px; height:92px; } .toggle { grid-column:2; justify-self:start; } .when { grid-column:1 / 3; } }
</style>
</head>
<body>
<main>
<h1>Season lines — keep or cut: ${rows.length}</h1>
<p class="lede">Every line here names a month, a season, a holiday, school, or a dated event. <b>They all start CUT.</b> Switch the ones you want to <b>KEEP</b>;
each KEEP opens a "when can it show" picker already set to my suggestion — leave it and it applies, or change it.
<b>CUT on a photograph line</b> takes it off every photograph it is on, English and Afrikaans (a sentence that is also a condition-bank line stays in the bank under its own tag).
<b>CUT on a bank line</b> removes it from the condition bank in all five languages. A photograph left with no line shows a condition-bank line — never a blank.
Your choices save in this browser. <b>Export</b> saves <code>seasonal-ruled.json</code> to Downloads.</p>
<div id="list"></div>
</main>
<footer>
  <span class="stat">kept <b id="kept">0</b></span>
  <span class="stat">cut <b id="cut">0</b></span>
  <span class="stat zero" id="zeroWrap">photographs left with no line <b id="zero">0</b></span>
  <span class="spacer"></span>
  <button class="ghost" id="reset">Reset to all CUT</button>
  <button id="export">Export seasonal-ruled.json</button>
</footer>
<script>
const ROWS = ${JSON.stringify(rows)};
const PHOTOS = ${JSON.stringify(PHOTOS)};
const MONTHS = ${JSON.stringify(MONTHS)};
const SEASONS = { summer: [10, 11, 12, 1, 2, 3], winter: [5, 6, 7, 8, 9] };
const LS = 'pw_seasonal_keep_cut_v1';
let state = {};
try { state = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { state = {}; }

// A row's state: { verdict: 'KEEP'|'CUT', ruling, months, season }. Default CUT;
// B450 arrives KEEP + ALWAYS. A KEEP with no choice made yet takes the suggestion.
const initial = (r) => r.preset
  ? { verdict: 'KEEP', ruling: r.preset.ruling }
  : { verdict: 'CUT' };
const fromSuggestion = (r) => {
  const s = r.suggest || { ruling: 'ALWAYS' };
  return { ruling: s.ruling, months: s.months ? s.months.slice() : undefined, season: s.season };
};
const get = (r) => state[r.key] || initial(r);
const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} };
const fmt = (ms) => (ms || []).slice().sort((a, b) => a - b).map((m) => MONTHS[m - 1]).join(' ');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const monthsOf = (st) => st.ruling === 'SEASON' ? (SEASONS[st.season] || []) : st.ruling === 'MONTHS' ? (st.months || []) : null;

function whenHtml(r, st) {
  const opt = (v, label) => '<button data-ruling="' + v + '" class="' + (st.ruling === v ? 'on' : '') + '">' + label + '</button>';
  let h = '<span class="label">when can it show</span><span class="opts">' + opt('ALWAYS', 'ALWAYS') + opt('MONTHS', 'MONTH WINDOW') + opt('SEASON', 'SEASON ONLY') + '</span>';
  if (st.ruling === 'MONTHS') h += '<div class="months">' + MONTHS.map((m, i) => '<button data-month="' + (i + 1) + '" class="' + ((st.months || []).includes(i + 1) ? 'on' : '') + '">' + m + '</button>').join('') + '</div>';
  if (st.ruling === 'SEASON') h += '<div class="seasons">' + ['summer', 'winter'].map((s) => '<button data-season="' + s + '" class="' + (st.season === s ? 'on' : '') + '">' + s + ' (' + fmt(SEASONS[s]) + ')</button>').join('') + '</div>';
  const sug = r.suggest;
  const sugText = !sug ? '' : sug.ruling === 'ALWAYS' ? 'ALWAYS' : sug.ruling === 'SEASON' ? 'SEASON ONLY, ' + sug.season : 'MONTH WINDOW ' + fmt(sug.months);
  if (sugText) h += '<div class="hint">My suggestion: ' + esc(sugText) + (r.names ? ' — it names ' + esc(r.names) : '') + '</div>';
  if (r.preset) h += '<div class="preset">Pre-set: ' + esc(r.preset.by) + '</div>';
  return h;
}

function rowEl(r) {
  const st = get(r);
  const el = document.createElement('section');
  el.className = 'row ' + st.verdict;
  const where = r.kind === 'bespoke'
    ? 'on ' + r.photos.length + ' photograph' + (r.photos.length === 1 ? '' : 's') + (r.alsoBank ? ' · also bank line ' + r.alsoBank + ' (stays in the bank if cut here)' : '')
    : 'condition bank ' + r.key + ' · any ' + r.key.split(':')[1].split('#')[0] + ' photograph with no lines, share cards, zu/xh/st' + (r.onPhoto ? ' · also on a photograph (ruled on its own row)' : ' · picture is an example');
  el.innerHTML = '<img loading="lazy" src="../assets/images/bg/' + esc(r.image) + '" alt="">'
    + '<div><p class="en"><span class="grade">' + esc(r.grade) + '</span>' + esc(r.en) + '</p>'
    + '<p class="meta">' + esc(r.key) + ' · ' + esc(where) + '</p></div>'
    + '<div class="toggle"><button class="k">KEEP</button><button class="c">CUT</button></div>'
    + '<div class="when">' + whenHtml(r, st) + '</div>';
  el.querySelector('.k').onclick = () => { const cur = get(r); state[r.key] = cur.verdict === 'KEEP' ? cur : { verdict: 'KEEP', ...(cur.ruling ? cur : fromSuggestion(r)) }; state[r.key].verdict = 'KEEP'; save(); render(); };
  el.querySelector('.c').onclick = () => { state[r.key] = { ...get(r), verdict: 'CUT' }; save(); render(); };
  el.querySelectorAll('[data-ruling]').forEach((b) => b.onclick = () => {
    const v = b.dataset.ruling, cur = get(r);
    const next = { verdict: 'KEEP', ruling: v };
    if (v === 'MONTHS') next.months = cur.months && cur.months.length ? cur.months.slice() : (r.suggest && r.suggest.months ? r.suggest.months.slice() : []);
    if (v === 'SEASON') next.season = cur.season || (r.suggest && r.suggest.season) || 'winter';
    state[r.key] = next; save(); render();
  });
  el.querySelectorAll('[data-month]').forEach((b) => b.onclick = () => {
    const m = +b.dataset.month, cur = get(r), set = new Set(cur.months || []);
    set.has(m) ? set.delete(m) : set.add(m);
    state[r.key] = { ...cur, months: [...set].sort((a, c) => a - c) }; save(); render();
  });
  el.querySelectorAll('[data-season]').forEach((b) => b.onclick = () => { state[r.key] = { ...get(r), season: b.dataset.season }; save(); render(); });
  return el;
}

// A KEEP must leave the line somewhere it can show: a window of 1–11 months.
const usable = (st) => st.verdict === 'CUT' || st.ruling === 'ALWAYS'
  || (st.ruling === 'SEASON' && !!SEASONS[st.season])
  || (st.ruling === 'MONTHS' && st.months && st.months.length > 0 && st.months.length < 12);

function zeroed() {
  // Photograph lines only: a bank-row CUT never touches a photograph.
  const cutOn = {};
  for (const r of ROWS) if (r.kind === 'bespoke' && get(r).verdict === 'CUT') for (const h of r.photos) cutOn[h] = (cutOn[h] || 0) + 1;
  return Object.keys(cutOn).filter((h) => cutOn[h] >= PHOTOS[h].lines);
}

function render() {
  const list = document.getElementById('list');
  const y = window.scrollY;
  list.innerHTML = '';
  for (const r of ROWS) list.appendChild(rowEl(r));
  const kept = ROWS.filter((r) => get(r).verdict === 'KEEP').length;
  document.getElementById('kept').textContent = kept;
  document.getElementById('cut').textContent = ROWS.length - kept;
  const z = zeroed();
  document.getElementById('zero').textContent = z.length;
  document.getElementById('zeroWrap').title = z.map((h) => PHOTOS[h].image).join('\\n');
  window.scrollTo(0, y);
}

document.getElementById('reset').onclick = () => {
  if (!confirm('Put every row back to CUT (B450 back to KEEP + ALWAYS)?')) return;
  state = {}; save(); render();
};

document.getElementById('export').onclick = () => {
  const bad = ROWS.filter((r) => !usable(get(r)));
  if (bad.length) { alert('These KEEPs have no month to show in — pick at least one month (or ALWAYS):\\n\\n' + bad.map((r) => r.en).join('\\n')); return; }
  const rulings = ROWS.map((r) => {
    const st = get(r);
    const out = { key: r.key, kind: r.kind, en: r.en, verdict: st.verdict };
    if (st.verdict === 'KEEP') {
      out.ruling = st.ruling;
      if (st.ruling === 'SEASON') out.season = st.season;
      const m = monthsOf(st);
      if (m) out.months = m.slice().sort((a, c) => a - c);
    }
    return out;
  });
  const z = zeroed();
  const out = {
    generated: new Date().toISOString(),
    ruledBy: 'Al, season lines keep/cut page (review/seasonal-tags.html)',
    total: ROWS.length,
    kept: rulings.filter((x) => x.verdict === 'KEEP').length,
    cut: rulings.filter((x) => x.verdict === 'CUT').length,
    photographsLeftWithNoLine: z.map((h) => ({ hash: h, image: PHOTOS[h].image })),
    rulings,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'seasonal-ruled.json';
  a.click();
};

render();
</script>
</body>
</html>
`;

writeFileSync(path.join(root, 'review', 'seasonal-tags.html'), html);
console.log(`[season] ${BESPOKE.length} bespoke + ${BANK.length} bank lines audited; ${culled.length} no longer live; page has ${rows.length} rows (${rows.filter((r) => r.kind === 'bespoke').length} photograph + ${rows.filter((r) => r.kind === 'bank').length} bank)`);
console.log(`[season] ${touched.length} photographs carry a photograph row; default ruling (all CUT but B450) leaves ${touched.filter((h) => rows.filter((r) => r.kind === 'bespoke' && r.key !== 'B450' && r.photos.includes(h)).length >= photoLines[h]).length} of them with no line`);
console.log('[season] review/seasonal-tags.html + review/seasonal-tags-worklist.json');
