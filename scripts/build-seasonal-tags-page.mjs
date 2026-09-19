// The season tagging page for Al (Job 2, 2026-09-19).
//
// Lists the 68 photograph lines the 2026-09-19 audit found naming a month, season, holiday,
// school term or dated event (review/LINE-AUDIT-2026-09-19.md §3), plus the 5 bank lines with a
// season in them and no month tag. Each gets ALWAYS / MONTH WINDOW / SEASON ONLY. The page is a
// local file (file://), remembers his choices in localStorage, and exports
// review/seasonal-tags-ruled.json, which scripts/build-hero-lines.mjs (photograph lines) and
// scripts/apply-seasonal-tags.mjs (bank lines -> witty-day-tags.js) wire.
//
// One ruling is already made and arrives pre-set: B450, Al's own "Clouds are crying like NZ at
// the 23 Rugby WC!" = ALWAYS (a past event; it plays on any hard-rain day).
//
// Writes review/seasonal-tags-worklist.json (read by scripts/verify-seasonal-gate.mjs) and
// review/seasonal-tags.html.
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

const W = { ruling: 'SEASON', season: 'winter' };
const S = { ruling: 'SEASON', season: 'summer' };
const A = { ruling: 'ALWAYS' };
const M = (...months) => ({ ruling: 'MONTHS', months });
const SCHOOL = M(2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
// [id, grade, what it names, suggestion]
const BESPOKE = [
  ['N299', 'A', 'November', M(11, 12, 1, 2, 3)], ['B212', 'A', 'December', M(1, 2, 3)], ['B450', 'A', 'the 2023 Rugby World Cup', null],
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
  ['B392', 'E', 'rugby', A], ['C344', 'E', 'load shedding (see the Eskom page)', A],
];
const BANK = [
  ['witty', 'clear', 21, 'A', 'December', M(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)],
  ['witty', 'clear', 71, 'B', 'winter', W],
  ['witty', 'clear', 63, 'B', 'Highveld winter', W],
  ['witty', 'clear', 72, 'B', 'off-season beach', W],
  ['witty', 'fog', 80, 'B', '"already winter"', M(5, 6)],
];

const slotsOf = new Map();
for (const [k, lines] of Object.entries(HERO_LINES)) if (k.startsWith('bg/')) for (const l of lines) {
  if (!slotsOf.has(l)) slotsOf.set(l, []);
  slotsOf.get(l).push(k);
}
const withMonths = (s) => (s && s.ruling === 'SEASON' ? { ...s, months: seasonMonths(s.season) } : s);
const bankRowOf = new Map();
for (const ns of ['witty', 'witty_low_confidence']) for (const [bin, v] of Object.entries(WEATHER_COPY[ns])) (v.en || []).forEach((t, i) => { if (!bankRowOf.has(t)) bankRowOf.set(t, `${ns}:${bin}#${i}`); });

const rows = [];
for (const [id, grade, names, suggest] of BESPOKE) {
  const en = idToEn.get(id);
  if (!en || !slotsOf.has(en)) throw new Error(`${id}: not a live photograph line`);
  const slots = slotsOf.get(en);
  rows.push({
    key: id, kind: 'bespoke', grade, names, en, af: HERO_LINES_AF[en] || null,
    image: slots[0].replace(/^bg\//, ''), slots: slots.length, photographs: new Set(slots.map((s) => s.split('/')[1] + '/' + s.split('/').slice(3).join('/'))).size,
    alsoBank: bankRowOf.get(en) || null, current: HERO_LINE_TAGS[en] || null,
    suggest: withMonths(suggest),
    preset: id === 'B450' ? { ruling: 'ALWAYS', by: "Al, in the 2026-09-19 brief: past event, plays on any hard-rain day" } : null,
  });
}
for (const [ns, bin, i, grade, names, suggest] of BANK) {
  const en = WEATHER_COPY[ns][bin].en[i];
  const onPhoto = slotsOf.get(en);
  const tag = WITTY_DAY_TAGS[ns]?.[bin]?.[i] || null;
  rows.push({
    key: `${ns}:${bin}#${i}`, kind: 'bank', grade, names, en, af: WEATHER_COPY[ns][bin].af?.[i] || null,
    // A bank line has no photograph of its own: it captions any <bin> photograph without lines,
    // share cards, and every zu/xh/st screen. Show one it could land on.
    image: onPhoto ? onPhoto[0].replace(/^bg\//, '') : `${bin === 'night' ? 'clear' : bin}/week_1/${bin === 'night' ? 'night' : 'day'}/1.webp`,
    onPhoto: onPhoto ? onPhoto[0].replace(/^bg\//, '') : null,
    current: tag, suggest: withMonths(suggest), preset: null,
  });
}

writeFileSync(path.join(root, 'review', 'seasonal-tags-worklist.json'), JSON.stringify({ generated: '2026-09-19', source: 'review/LINE-AUDIT-2026-09-19.md §3', rows }, null, 1));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Season tags</title>
<style>
:root { --bg:#f7f6f2; --fg:#1d1d1b; --muted:#6b6a64; --line:#dddbd2; --card:#fff; --accent:#1f5f8b; --pick:#e8f0f6; --warn:#a5452b; }
@media (prefers-color-scheme: dark) { :root { --bg:#161614; --fg:#ecebe6; --muted:#a3a29b; --line:#34332f; --card:#1f1f1c; --accent:#7fb6dd; --pick:#1d2a33; --warn:#e08a6e; } }
* { box-sizing:border-box; }
body { margin:0; padding:20px 16px 96px; background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, sans-serif; }
main { max-width:1100px; margin:0 auto; }
h1 { font-size:1.45rem; margin:0 0 4px; }
.lede { color:var(--muted); margin:0 0 14px; max-width:78ch; }
.bar { position:sticky; top:0; z-index:5; background:var(--bg); display:flex; flex-wrap:wrap; gap:10px; align-items:center; padding:10px 0; border-bottom:1px solid var(--line); margin-bottom:14px; }
.bar .count { font-weight:600; }
button, .btn { font:inherit; padding:7px 12px; border-radius:7px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; }
button.ghost { background:transparent; color:var(--accent); }
.card { display:grid; grid-template-columns:120px 1fr; gap:14px; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px; margin:0 0 12px; }
.card.done { border-color:var(--accent); }
.card img { width:120px; height:213px; object-fit:cover; border-radius:6px; background:#333; }
.en { font-size:1.08rem; font-weight:600; margin:0 0 3px; }
.af { color:var(--muted); margin:0 0 8px; font-style:italic; }
.meta { font-size:.82rem; color:var(--muted); margin:0 0 8px; }
.grade { display:inline-block; font-weight:700; font-size:.75rem; padding:1px 7px; border-radius:99px; border:1px solid currentColor; margin-right:6px; }
.gA,.gB { color:var(--warn); }
.choices { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0; }
.choices label { border:1px solid var(--line); border-radius:7px; padding:6px 10px; cursor:pointer; user-select:none; }
.choices input { margin-right:6px; }
.choices label.on { background:var(--pick); border-color:var(--accent); }
.months, .seasons { display:none; flex-wrap:wrap; gap:4px; margin:6px 0 0; }
.months.show, .seasons.show { display:flex; }
.months label, .seasons label { border:1px solid var(--line); border-radius:6px; padding:3px 7px; font-size:.85rem; cursor:pointer; }
.months label.on, .seasons label.on { background:var(--pick); border-color:var(--accent); }
.suggest { font-size:.85rem; margin-top:6px; }
.suggest button { padding:3px 9px; font-size:.82rem; }
.preset { font-size:.85rem; color:var(--accent); margin-top:4px; }
textarea { width:100%; min-height:90px; margin-top:8px; font:12px ui-monospace, monospace; }
@media (max-width:560px) { .card { grid-template-columns:84px 1fr; } .card img { width:84px; height:149px; } .bar { position:static; } }
</style>
</head>
<body>
<main>
<h1>Season tags: ${rows.length} lines</h1>
<p class="lede">Each line names a month, season, holiday, school term or event. Since 2026-09-19 the app hides a tagged line outside its months. For each line pick:
<b>ALWAYS</b> (fine all year), <b>MONTH WINDOW</b> (tick the months it may show) or <b>SEASON ONLY</b> (the app's two seasons: summer = Oct–Mar, winter = May–Sep).
Months follow the searched place's calendar. The tag covers every language the line appears in. Grades come from the audit: A names a month or date; B claims a season the photo's weather doesn't guarantee; C is a season matching the weather; D is school or holiday; E is low risk.
Suggestions are mine (Baken), and one click applies one. Nothing is pre-ticked except B450, which you already ruled.
Your choices save in this browser as you go. <b>Export</b> saves <code>seasonal-tags-ruled.json</code> to Downloads.</p>
<div class="bar"><span class="count" id="count"></span>
<label><input type="checkbox" id="onlyOpen"> show unruled only</label>
<button id="export">Export seasonal-tags-ruled.json</button>
<button class="ghost" id="copy">Copy JSON</button></div>
<div id="list"></div>
<textarea id="out" readonly placeholder="Exported JSON also appears here."></textarea>
</main>
<script>
const ROWS = ${JSON.stringify(rows)};
const MONTHS = ${JSON.stringify(MONTHS)};
const SEASONS = { summer: [10,11,12,1,2,3], winter: [5,6,7,8,9] };
const LS = 'pw_seasonal_tags_v1';
let state = {};
try { state = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { state = {}; }
for (const r of ROWS) if (r.preset && !state[r.key]) state[r.key] = { ruling: r.preset.ruling, preset: true };
const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} render(); };
const fmt = (ms) => ms && ms.length ? ms.slice().sort((a,b)=>a-b).map(m => MONTHS[m-1]).join(' ') : '';
const tagText = (t) => { if (!t) return 'none'; const p = []; if (t.months) p.push('months ' + fmt(t.months)); if (t.region) p.push('region ' + t.region); if (t.time) p.push('time ' + t.time); if (t.day) p.push('day ' + t.day); return p.join(' · ') || 'none'; };
const sugText = (s) => !s ? '' : s.ruling === 'ALWAYS' ? 'ALWAYS' : s.ruling === 'SEASON' ? 'SEASON ' + s.season + ' (' + fmt(s.months) + ')' : 'MONTHS ' + fmt(s.months);
const isDone = (st) => st && (st.ruling === 'ALWAYS' || (st.ruling === 'SEASON' && st.season) || (st.ruling === 'MONTHS' && st.months && st.months.length && st.months.length < 12));
function card(r) {
  const st = state[r.key] || {};
  const el = document.createElement('section');
  el.className = 'card' + (isDone(st) ? ' done' : '');
  const where = r.kind === 'bespoke'
    ? 'Photo line · ' + r.slots + ' slots' + (r.alsoBank ? ' · also bank line ' + r.alsoBank : '')
    : 'Bank line ' + r.key + ' · shows on any ' + r.key.split(':')[1].split('#')[0] + ' photo with no lines of its own, on share cards and on every zu/xh/st screen' + (r.onPhoto ? ' · also on a photo' : ' · the photo shown is only an example');
  el.innerHTML = '<img loading="lazy" src="../assets/images/bg/' + r.image + '" alt="">'
    + '<div><p class="en"><span class="grade g' + r.grade + '">' + r.grade + '</span>' + esc(r.en) + '</p>'
    + (r.af ? '<p class="af">' + esc(r.af) + '</p>' : '')
    + '<p class="meta">' + esc(r.key) + ' · names ' + esc(r.names) + ' · ' + esc(where) + ' · tag now: ' + esc(tagText(r.current)) + '</p>'
    + '<div class="choices">'
    + ['ALWAYS','MONTHS','SEASON'].map(v => '<label class="' + (st.ruling === v ? 'on' : '') + '"><input type="radio" name="r' + r.key + '" value="' + v + '"' + (st.ruling === v ? ' checked' : '') + '>' + (v === 'MONTHS' ? 'MONTH WINDOW' : v === 'SEASON' ? 'SEASON ONLY' : 'ALWAYS') + '</label>').join('')
    + '</div>'
    + '<div class="months' + (st.ruling === 'MONTHS' ? ' show' : '') + '">' + MONTHS.map((m, i) => '<label class="' + ((st.months || []).includes(i+1) ? 'on' : '') + '"><input type="checkbox" hidden value="' + (i+1) + '">' + m + '</label>').join('') + '</div>'
    + '<div class="seasons' + (st.ruling === 'SEASON' ? ' show' : '') + '">' + ['summer','winter'].map(s => '<label class="' + (st.season === s ? 'on' : '') + '"><input type="radio" hidden name="s' + r.key + '" value="' + s + '">' + s + ' (' + fmt(SEASONS[s]) + ')</label>').join('') + '</div>'
    + (r.preset ? '<p class="preset">Pre-set: ' + esc(r.preset.by) + '</p>' : '')
    + (r.suggest ? '<p class="suggest">Suggestion: ' + esc(sugText(r.suggest)) + ' <button class="ghost">use</button></p>' : '')
    + '</div>';
  el.querySelectorAll('.choices input').forEach(inp => inp.addEventListener('change', () => { state[r.key] = { ...(state[r.key] || {}), ruling: inp.value, preset: false }; save(); }));
  el.querySelectorAll('.months label').forEach(lb => lb.addEventListener('click', (e) => { e.preventDefault(); const m = +lb.querySelector('input').value; const cur = new Set(state[r.key].months || []); cur.has(m) ? cur.delete(m) : cur.add(m); state[r.key].months = [...cur].sort((a,b)=>a-b); save(); }));
  el.querySelectorAll('.seasons label').forEach(lb => lb.addEventListener('click', (e) => { e.preventDefault(); state[r.key].season = lb.querySelector('input').value; save(); }));
  const use = el.querySelector('.suggest button');
  if (use) use.addEventListener('click', () => { const s = r.suggest; state[r.key] = { ruling: s.ruling, months: s.months ? s.months.slice() : undefined, season: s.season, preset: false, fromSuggestion: true }; save(); });
  return el;
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function render() {
  const list = document.getElementById('list');
  const y = window.scrollY;
  list.innerHTML = '';
  const only = document.getElementById('onlyOpen').checked;
  for (const r of ROWS) if (!only || !isDone(state[r.key])) list.appendChild(card(r));
  const done = ROWS.filter(r => isDone(state[r.key])).length;
  document.getElementById('count').textContent = done + ' of ' + ROWS.length + ' ruled';
  window.scrollTo(0, y);
}
function exportJson() {
  const rulings = [], unruled = [];
  for (const r of ROWS) {
    const st = state[r.key];
    if (!isDone(st)) { unruled.push(r.key); continue; }
    const months = st.ruling === 'SEASON' ? SEASONS[st.season].slice() : st.ruling === 'MONTHS' ? st.months.slice() : null;
    rulings.push({ key: r.key, kind: r.kind, en: r.en, ruling: st.ruling, season: st.ruling === 'SEASON' ? st.season : undefined, months, bankId: r.kind === 'bank' ? r.key : undefined, fromSuggestion: !!st.fromSuggestion, preset: !!st.preset });
  }
  return JSON.stringify({ generated: new Date().toISOString(), ruledBy: 'Al, season tagging page (review/seasonal-tags.html)', total: ROWS.length, ruledCount: rulings.length, unruled, rulings }, null, 1);
}
document.getElementById('onlyOpen').addEventListener('change', render);
document.getElementById('export').addEventListener('click', () => {
  const json = exportJson(); document.getElementById('out').value = json;
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'seasonal-tags-ruled.json'; a.click(); } catch (e) {}
});
document.getElementById('copy').addEventListener('click', () => { const json = exportJson(); document.getElementById('out').value = json; try { navigator.clipboard.writeText(json).catch(() => {}); } catch (e) {} });
render();
</script>
</body>
</html>
`;
writeFileSync(path.join(root, 'review', 'seasonal-tags.html'), html);
console.log(`[seasonal-tags] ${rows.length} rows (${rows.filter((r) => r.kind === 'bespoke').length} photograph lines, ${rows.filter((r) => r.kind === 'bank').length} bank lines) -> review/seasonal-tags.html + review/seasonal-tags-worklist.json`);
