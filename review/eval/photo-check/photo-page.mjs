// Photo check (2026-09-24): Al's page, built from the check's data.
//
//   node review/eval/photo-check/photo-page.mjs   -> review/photo-check-for-al.html
//
// Part 1 comes from data/rotation.json (main's build) and data/served-spot-check.json; part 2 from
// data/d-count.json and the shots in shots/worst, shots/card, shots/thumb. The page is the house
// pattern: opens from disk, marks kept in localStorage, Export writes photo-check-ruled.json.
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'review/eval/photo-check';
const read = (f) => JSON.parse(readFileSync(`${OUT}/data/${f}`, 'utf8'));
const R = read('rotation.json');
const C = read('d-count.json');
const spot = read('served-spot-check.json');
const W = read('d-worst.json');
const LANG = { en: 'English', af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const DAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOT = (s) => { const [time, r] = s.split('/'); return `${DAY[Number(r)]} ${time}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const thumb = (h8) => `eval/photo-check/shots/thumb/${h8}.jpg`;

// ---- part 1 facts ----
const newRepeats = [];
for (const r of R.repeats.filter((x) => !x.known && x.folder === 'cloudy')) {
  const key = `${r.folder}-${r.slots.join('-')}`;
  if (!newRepeats.some((x) => x.key === key)) newRepeats.push({ key, ...r, weeks: R.repeats.filter((x) => x.hash === r.hash && x.folder === r.folder).map((x) => x.week) });
}
const MOVED_FOR = { 'cloudy-dawn/2-dawn/5': '1a7797ca', 'cloudy-dusk/1-dusk/2': 'f20554e0' };
const REPEAT_WORDS = { '4f833d5c': 'the man painting the Bo-Kaap wall', '791e756e': 'the cyclist on the mountain road', '1a7797ca': 'the newspaper seller at the traffic light', 'f20554e0': 'the dog on its cushion' };
const REPEATS = newRepeats.map((r) => ({
  key: r.key, h8: r.hash.slice(0, 8), what: REPEAT_WORDS[r.hash.slice(0, 8)],
  days: r.slots.map(SLOT).join(' and '), weeks: r.weeks.length,
  moved: MOVED_FOR[r.key], movedWhat: REPEAT_WORDS[MOVED_FOR[r.key]],
}));
const knownNight = R.repeats.find((x) => x.known);
const bench79 = R.repeats.find((x) => x.folder === 'cold');
const noOwn = R.lines.noOwn.map((h) => { const p = R.photos.find((x) => x.hash === h); return { h8: h.slice(0, 8), folder: p.folders[0], slots: p.slots.length }; });
const MISFIT_GROUP = (m) => (/^(Not |A gradient|One planet|Saturday, and|Zero wind|The 7am sun|The only rain|That lawn stopped)/.test(m.line) ? 'absent'
  : m.folder === 'cloudy' || /dry/i.test(m.words.join(' ')) ? 'contrast' : 'sense');
const misfits = { absent: [], sense: [], contrast: [] };
for (const m of R.misfits) misfits[MISFIT_GROUP(m)].push({ folder: m.folder, line: m.line, word: m.words.join(', ') });
const moves = [...new Map(R.cross.moves.filter((m) => m.servedIn.length).map((m) => [m.sha256, m])).values()];
const eskomLive = R.cross.eskom.filter((e) => e.live).length;

// ---- part 2 facts ----
const T = C.totals;
const flagged = C.photos.filter((p) => p.flagged).map((p) => {
  const size = p.sizes['414x715'].covered ? '414x715' : ['320x488', '360x688'].filter((s) => p.sizes[s].covered).sort((a, b) => p.sizes[b].worst.overlapPx - p.sizes[a].worst.overlapPx)[0];
  const w = p.sizes[size].worst;
  return {
    n: p.n, h8: p.hash8, hash: p.hash, folder: p.folder, hw: +p.hoursPerWeek.toFixed(1), level: p.judged.level, words: p.judged.words,
    size, lang: w.lang, line: w.line, general: w.source !== 'own', risen: w.risen, noMark: p.anchor == null,
    at: Object.fromEntries(['414x715', '360x688', '320x488'].map((s) => [s, p.sizes[s].covered])),
    langs: p.sizes['414x715'].langs, langsAny: [...new Set(['414x715', '360x688', '320x488'].flatMap((s) => p.sizes[s].langs))],
  };
});
const med = (l) => { const a = Object.values(W).map((p) => p.sizes['414x715'].perLang[l]).map((x) => (x.textBottom - x.textTop) / 715 * 100).sort((x, y) => x - y); return Math.round(a[Math.floor(a.length / 2)]); };
const coversBy = (l) => C.photos.filter((p) => p.judged.level === 'covers' && p.sizes['414x715'].langs.includes(l)).length;
const coversAny = (ls) => C.photos.filter((p) => p.judged.level === 'covers' && p.sizes['414x715'].langs.some((l) => ls.includes(l))).length;
const LROWS = ['en', 'af', 'zu', 'xh', 'st'].map((l) => `<tr><td>${LANG[l]}</td><td>${coversBy(l)}</td><td>${T['414x715'][l]}</td><td>${med(l)}%</td></tr>`).join('');
const A = C.anchorCount['414x715'];
const onlySmall = flagged.filter((p) => !p.at['414x715']).length;
const clear414 = C.photos.length - T['414x715'].all;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Photo check — for Al</title>
<style>
:root { --bg:#f6f4ee; --fg:#1d1b18; --muted:#6b665c; --line:#dcd7cb; --card:#fffdf8; --accent:#1f5f8b; --use:#2e7d4f; --fix:#b7791f; --no:#a5452b; --gold:#b07d00; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#15140f; --fg:#eeebe3; --muted:#a8a296; --line:#35322b; --card:#1f1d18; --accent:#7fb6dd; --use:#7ccf9c; --fix:#e8b45a; --no:#e08a6e; --gold:#ffd35a; } }
* { box-sizing: border-box; }
body { margin:0; padding:20px 16px 90px; background:var(--bg); color:var(--fg); font:15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width:1180px; margin:0 auto; }
h1 { font-size:1.55rem; margin:0 0 4px; } h2 { font-size:1.25rem; margin:36px 0 10px; } h3 { font-size:1.02rem; margin:18px 0 6px; }
p.lede, .muted { color:var(--muted); } p.lede { margin:0 0 16px; max-width:80ch; }
p { max-width:86ch; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin:12px 0; }
.answer { font-size:1.08rem; font-weight:600; }
ul.plain { margin:6px 0 0; padding-left:20px; } ul.plain li { margin:5px 0; max-width:92ch; }
.known { display:inline-block; font-size:.7rem; letter-spacing:.05em; text-transform:uppercase; padding:1px 7px; border-radius:10px; border:1px solid var(--line); color:var(--muted); margin-right:6px; vertical-align:1px; }
.new { border-color:var(--fix); color:var(--fix); }
.thumbs { display:flex; flex-wrap:wrap; gap:10px; margin:8px 0; }
.thumbs figure { margin:0; width:120px; } .thumbs img { width:100%; display:block; border-radius:6px; border:1px solid var(--line); cursor:zoom-in; }
.thumbs figcaption { font-size:.76rem; color:var(--muted); line-height:1.3; margin-top:3px; }
table.t { border-collapse:collapse; margin:8px 0; font-size:.92rem; } table.t td, table.t th { border-bottom:1px solid var(--line); padding:6px 12px 6px 0; text-align:left; vertical-align:top; }
table.t th { color:var(--muted); font-weight:600; font-size:.82rem; }
table.t tr.sum td { font-weight:600; }
details { margin:8px 0; } summary { cursor:pointer; color:var(--accent); }
.q { background:var(--card); border:1px solid var(--line); border-left:4px solid var(--fix); border-radius:8px; padding:12px 14px; margin:10px 0; }
.act { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.act button { font:inherit; font-size:.88rem; padding:5px 12px; border-radius:6px; border:1px solid var(--line); background:transparent; color:inherit; cursor:pointer; }
.act button.on.FINE, .act button.on.OK { background:var(--use); border-color:var(--use); color:#fff; }
.act button.on.FIX, .act button.on.FILL { background:var(--fix); border-color:var(--fix); color:#fff; }
.act button.on.REDO { background:var(--no); border-color:var(--no); color:#fff; }
textarea { width:100%; min-height:34px; font:inherit; font-size:.88rem; border:1px solid var(--line); border-radius:6px; padding:6px; background:transparent; color:inherit; margin-top:6px; }
.filters { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 4px; position:sticky; top:0; background:var(--bg); padding:8px 0; z-index:3; }
.filters button { font:inherit; font-size:.86rem; padding:5px 12px; border-radius:16px; border:1px solid var(--line); background:var(--card); color:inherit; cursor:pointer; }
.filters button.on { background:var(--accent); border-color:var(--accent); color:#fff; }
.photo { display:grid; grid-template-columns:230px 230px 1fr; gap:14px; background:var(--card); border:1px solid var(--line); border-left:4px solid var(--line); border-radius:10px; padding:12px; margin:12px 0; }
.photo.FINE { border-left-color:var(--use); } .photo.FIX { border-left-color:var(--fix); } .photo.REDO { border-left-color:var(--no); }
.photo img { width:100%; display:block; border-radius:8px; border:1px solid var(--line); cursor:zoom-in; background:#222; }
.photo .cap { font-size:.74rem; color:var(--muted); margin-top:3px; }
@media (max-width:760px) { .photo { grid-template-columns:1fr 1fr; } .photo .info { grid-column:1 / -1; } .filters { position:static; } }
.lvl { display:inline-block; font-size:.72rem; letter-spacing:.05em; text-transform:uppercase; padding:1px 8px; border-radius:10px; color:#fff; background:var(--no); }
.lvl.partly { background:var(--fix); }
.info h3 { margin:0 0 4px; font-size:1rem; }
.info .words { font-size:1.02rem; margin:4px 0 8px; }
.info .line { font-style:italic; margin:4px 0; }
.info dl { display:grid; grid-template-columns:auto 1fr; gap:2px 10px; margin:6px 0; font-size:.86rem; } .info dt { color:var(--muted); }
.bar { position:fixed; left:0; right:0; bottom:0; background:var(--card); border-top:1px solid var(--line); padding:10px 16px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; z-index:5; }
.bar button { font:inherit; padding:8px 14px; border-radius:6px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; }
.bar button.ghost { background:transparent; color:var(--accent); }
#out { display:none; width:100%; min-height:100px; margin-top:8px; }
.zoom { position:fixed; inset:0; background:rgba(0,0,0,.85); display:none; align-items:center; justify-content:center; z-index:10; cursor:zoom-out; }
.zoom img { max-height:94vh; max-width:94vw; border-radius:10px; }
code { font-size:.85em; }
</style>
</head>
<body>
<main>
<h1>Probably Weather — the photo check</h1>
<p class="lede">24 Sept. Two questions: did the last few days of cutting and moving break anything, and how many photos does
D's joke cover, in all five languages. This was a check, not a fix: no photo and no line was changed, nothing was pushed,
and the live app is still ec7ae52. Full detail: <code>review/eval/EVAL.md</code>, section 4c.</p>

<h2>1. Is the rotation whole?</h2>
<div class="card"><p class="answer">Yes. Nothing is missing and nothing is broken. There is one new small thing for you to decide (below).</p>
<ul class="plain">
<li>I ran the app's own photo picker over every kind of weather, every week of the 4-week cycle, every time of day and every
weekday: <b>${R.served.rows.toLocaleString('en-ZA')}</b> spots. Every spot gets a photo, and all <b>${R.served.files}</b> photo files open. No gaps, no broken files.</li>
<li>To be sure the check matches the real app, I opened the app ${spot.length} times at chosen days and times: it showed exactly the photo the check said, ${spot.filter((s) => s.match).length} out of ${spot.length}.</li>
<li>No photo shows in two kinds of weather in the same week.</li>
<li>Every photo gets a line in every place, every month and every language — <b>${(R.lines.contexts / 1e6).toFixed(1)} million</b> combinations checked. The line is never blank.
It is never English in Afrikaans, isiZulu, isiXhosa or Sesotho, except the two safety lines you chose to keep in English <span class="known">known</span>.</li>
<li>No line talks about weather its folder doesn't have. (49 lines use a weather word; I read each one and they all fit — list below.)</li>
<li>Nothing needed fixing in the code.</li>
</ul></div>

<h3><span class="known new">new</span>Two photos now show twice a week</h3>
<p>When you moved a photo to another kind of weather, its old spot is filled with the first photo of the same folder and time of day, the same way photo #79's spot is. Two of your moves left a gap like that, so these two photos now show twice a week, every week. Nothing is broken. It's your call whether that's fine or the spot should get another photo.</p>
<div id="repeats"></div>

<h3><span class="known">known</span>Already parked, not new</h3>
<ul class="plain">
<li><b>Cloudy nights</b> have 4 photos for 7 nights, so this one shows on ${knownNight.slots.map(SLOT).join(', ').replace(/ night/g, '')} nights.
<div class="thumbs"><figure><img src="${thumb(knownNight.hash.slice(0, 8))}" alt="cloudy night"><figcaption>cloudy, night</figcaption></figure></div></li>
<li><b>Photo #79 is out of rotation.</b> Its spot on cold days shows this photo instead, so on Monday and Tuesday of weeks ${R.repeats.filter((x) => x.folder === 'cold').map((x) => x.week).join(' and ')} the same frosty tap shows twice.
<div class="thumbs"><figure><img src="${thumb(bench79.hash.slice(0, 8))}" alt="frosted tap"><figcaption>cold, day</figcaption></figure></div></li>
<li><b>${noOwn.length} photos have no line of their own</b>, so they always take the general lines for their weather. (Filling photos toward 3 lines each is parked.)
<div class="thumbs">${noOwn.map((p) => `<figure><img src="${thumb(p.h8)}" alt="${esc(p.folder)}"><figcaption>${esc(p.folder)} · ${p.h8}</figcaption></figure>`).join('')}</div></li>
<li><b>${R.lines.bankOnlyContexts.length} photos only have season or place lines</b>, so outside those months or places they take the general lines. That follows your season and place rulings. <span class="muted">(${R.lines.bankOnlyContexts.map((b) => b.hash.slice(0, 8)).join(', ')})</span></li>
<li>The 7 untagged place lines that live only in the general lines; the weekend and night re-ruling. Both parked.</li>
<li>The two safety lines in English: Sesotho fog "Let's call it atmosphere and go inside." and isiZulu wind "Close it, tie it down, surrender." As you left them.</li>
</ul>

<h3>Lines that use a weather word their folder doesn't have — none that are wrong</h3>
<details><summary>The 49 lines I read, and why each one fits</summary>
<p class="muted">The weather is missing, and the line says so (${misfits.absent.length}):</p><ul class="plain">${misfits.absent.map((m) => `<li><i>${esc(m.line)}</i> <span class="muted">— ${esc(m.folder)}</span></li>`).join('')}</ul>
<p class="muted">The word means something else — hot chocolate, ice cream, cold water on a hot day, "still" meaning "yet" (${misfits.sense.length}):</p><ul class="plain">${misfits.sense.map((m) => `<li><i>${esc(m.line)}</i> <span class="muted">— ${esc(m.folder)}</span></li>`).join('')}</ul>
<p class="muted">The joke is the contrast — cloudy lines about sunscreen and sunny forecasts, a dry spot in the rain (${misfits.contrast.length}):</p><ul class="plain">${misfits.contrast.map((m) => `<li><i>${esc(m.line)}</i> <span class="muted">— ${esc(m.folder)}</span></li>`).join('')}</ul>
</details>

<h3>Checked against your rulings</h3>
<table class="t">
<tr><th>Ruling</th><th>What the app does now</th></tr>
<tr><td>The ${R.cross.provenanceCull.cut} lines cut for their history (from ${R.cross.provenanceCull.photographs} photos)</td><td>None has come back.</td></tr>
<tr><td>The ${R.cross.translationCuts.cut} CUTs on the Afrikaans page</td><td>None shows.</td></tr>
<tr><td>The ${R.cross.seasonCuts.cut} CUTs in the season ruling</td><td>None shows. The ${R.cross.seasonCuts.kept.length} lines you kept show in their months.</td></tr>
<tr><td>The ${R.cross.placeLines.tagged} place lines you tagged to regions</td><td>${R.cross.placeLines.taggedLive} show, only in their region. ${R.cross.placeLines.taggedGoneBySeasonCut} went with the season cut. None lost its tag.</td></tr>
<tr><td>The ${moves.length} photos you moved to other weather</td><td>Each shows only in its new weather. I read their ${moves.reduce((a, m) => a + m.ownLines, 0)} lines, and they all fit the new weather.</td></tr>
<tr><td>Photo #79</td><td>Out of rotation <span class="known">known</span>.</td></tr>
<tr><td>Eskom</td><td>The ${eskomLive} approved lines show. The one the season ruling cut is gone, and so are the two you CUT.</td></tr>
</table>

<h2>2. D's joke on the photos</h2>
<div class="card">
<p>I put every line that can show on every photo, in all five languages, on three phone sizes (yours, a mid-size Android and the smallest iPhone). That's ${C.photos.length} photos, 14,697 placements, all measured in D itself. The lines are each photo's own lines plus the three longest general lines wherever it uses those. Then I looked at every photo's worst case and wrote down what the joke sits on.</p>
<p class="answer">On your phone, the joke sits on the subject of ${T['414x715'].covers} photos. On ${T['414x715'].partly} more it touches the subject but faces stay clear. ${clear414} are clear.</p>
<table class="t">
<tr><th>Language</th><th>Joke sits on the subject</th><th>Sits on it or touches it</th><th>Longest line, usual height</th></tr>
${LROWS}
<tr class="sum"><td>English + Afrikaans</td><td>${coversAny(['en', 'af'])}</td><td>${T['414x715'].enAf}</td><td></td></tr>
<tr class="sum"><td>All five</td><td>${coversAny(['en', 'af', 'zu', 'xh', 'st'])}</td><td>${T['414x715'].all}</td><td></td></tr>
</table>
<p><b>isiZulu, isiXhosa and Sesotho add ${coversAny(['en', 'af', 'zu', 'xh', 'st']) - coversAny(['en', 'af'])} photos where the joke sits on the subject</b> (${T['414x715'].addedByZuXhSt} counting the ones it only touches). Their longest lines usually take 21% of the screen, against 16% for English and Afrikaans.</p>
<p>On the other phones: ${T['360x688'].all} photos on the mid-size Android, ${T['320x488'].all} on the smallest iPhone. ${T.any.all} on at least one of the three, and ${onlySmall} of those only on a smaller phone.</p>
<p class="muted">Counted the way we did last time (the middle of the subject from your crop mark, under the joke, with each language's longest line, the same line in both layouts). Joke at the bottom → D as built: English ${A.en.foot} → ${A.en.d}, Afrikaans ${A.af.foot} → ${A.af.d}, isiZulu ${A.zu.foot} → ${A.zu.d}, isiXhosa ${A.xh.foot} → ${A.xh.d}, Sesotho ${A.st.foot} → ${A.st.d}. Last time, with the one English line the app picks for each photo, it was 73 → 28. D lifting the joke helps English and Afrikaans most. The longer isiZulu, isiXhosa and Sesotho lines are too tall to lift clear of the subject, so they mostly stay at the bottom. The crop mark is only a guess at the subject, which is why I looked at every photo myself.</p>
</div>

<h3>Every photo where the joke covers something (${flagged.length}), most-shown first</h3>
<p>Each one shows its worst case on your phone (or on the smaller phone, where only that one fails). Left: the screen as D shows it. Middle: the bare photo with the joke's text outlined in green and what it covers marked in orange. <b>FINE</b> = leave it. <b>FIX</b> = it could be saved by extending the photo or placing the joke differently. <b>REDO</b> = it needs a new image.</p>
<div class="filters" id="filters"></div>
<div id="photos"></div>

<textarea id="out" readonly></textarea>
</main>
<div class="bar"><span id="count" class="muted"></span><button id="export">Export photo-check-ruled.json</button><button id="copy" class="ghost">Copy JSON</button></div>
<div class="zoom" id="zoom"><img alt=""></div>
<script>
var KEY = 'pw-photo-check-2026-09-24';
var LANG = ${JSON.stringify(LANG)};
var SIZE = { '414x715': 'your phone (414×715)', '360x688': 'mid-size Android (360×688)', '320x488': 'smallest iPhone (320×488)' };
var REPEATS = ${JSON.stringify(REPEATS)};
var PHOTOS = ${JSON.stringify(flagged)};
var state = {}; try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
state.repeats = state.repeats || {}; state.photos = state.photos || {};
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} count(); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function btn(g, k, v, label) { return '<button type="button" data-g="' + g + '" data-k="' + k + '" data-v="' + v + '" class="' + v + '">' + label + '</button>'; }
function thumb(h) { return 'eval/photo-check/shots/thumb/' + h + '.jpg'; }

document.getElementById('repeats').innerHTML = REPEATS.map(function (r) {
  return '<div class="q" data-row="repeats" data-k="' + r.key + '"><div><b>Cloudy weather, ' + esc(r.days) + '</b>: ' + esc(r.what) + ' shows on both, every week. The second spot was ' + esc(r.movedWhat) + ', which you moved to cold.</div>' +
    '<div class="thumbs"><figure><img src="' + thumb(r.h8) + '" alt=""><figcaption>shows twice now</figcaption></figure><figure><img src="' + thumb(r.moved) + '" alt=""><figcaption>moved to cold</figcaption></figure></div>' +
    '<div class="act">' + btn('repeats', r.key, 'OK', 'OK AS IS') + btn('repeats', r.key, 'FILL', 'FILL THE SPOT') + '</div><textarea data-note="repeats" data-k="' + r.key + '" placeholder="Note (optional)"></textarea></div>';
}).join('');

var FILTERS = [['all', 'All ' + PHOTOS.length], ['covers', 'Sits on the subject'], ['partly', 'Touches it'], ['small', 'Only on a smaller phone'], ['nolang', 'Only in isiZulu / isiXhosa / Sesotho'], ['open', 'Not marked yet']];
var filter = 'all';
function shown(p) {
  if (filter === 'covers' || filter === 'partly') return p.level === filter;
  if (filter === 'small') return !p.at['414x715'];
  if (filter === 'nolang') return !p.langsAny.some(function (l) { return l === 'en' || l === 'af'; });
  if (filter === 'open') return !(state.photos[p.h8] || {}).verdict;
  return true;
}
function renderFilters() {
  document.getElementById('filters').innerHTML = FILTERS.map(function (f) {
    var n = f[0] === 'all' ? '' : ' (' + PHOTOS.filter(function (p) { var o = filter; filter = f[0]; var s = shown(p); filter = o; return s; }).length + ')';
    return '<button type="button" data-f="' + f[0] + '" class="' + (filter === f[0] ? 'on' : '') + '">' + f[1] + n + '</button>';
  }).join('');
}
function also(p) {
  var s = [];
  ['414x715', '360x688', '320x488'].forEach(function (k) { if (k !== p.size) s.push(SIZE[k].split(' (')[0] + ': ' + (p.at[k] ? 'also covers' : 'clear')); });
  return s.join(' · ');
}
function renderPhotos() {
  document.getElementById('photos').innerHTML = PHOTOS.filter(shown).map(function (p) {
    return '<div class="photo" data-row="photos" data-k="' + p.h8 + '">' +
      '<div><img loading="lazy" src="eval/photo-check/shots/worst/' + p.h8 + '.jpg" alt="' + esc(p.words) + '"><div class="cap">as D shows it</div></div>' +
      '<div><img loading="lazy" src="eval/photo-check/shots/card/' + p.h8 + '.jpg" alt="the bare photo"><div class="cap">the photo, joke outlined</div></div>' +
      '<div class="info"><h3>#' + p.n + ' · ' + esc(p.folder) + ' · on screen ' + p.hw + ' h a week in ' + esc(p.folder) + ' weather <span class="lvl ' + p.level + '">' + (p.level === 'covers' ? 'sits on the subject' : 'touches it') + '</span></h3>' +
      '<div class="words">Covers ' + esc(p.words.replace(/^risen: /, '')) + '.</div>' +
      '<dl><dt>Worst line</dt><dd class="line">' + esc(p.line) + '</dd>' +
      '<dt>Language</dt><dd>' + LANG[p.lang] + (p.general ? ' (a general line)' : " (the photo's own line)") + '</dd>' +
      '<dt>Phone</dt><dd>' + SIZE[p.size] + '</dd>' +
      '<dt>D moved it up</dt><dd>' + (p.risen ? 'yes, under “Probably…”' : 'no, it sits at the bottom') + (p.noMark ? ' · no crop mark' : '') + '</dd>' +
      '<dt>Other phones</dt><dd>' + also(p) + '</dd>' +
      '<dt>Languages that cover it</dt><dd>' + (p.langsAny.map(function (l) { return LANG[l]; }).join(', ')) + '</dd></dl>' +
      '<div class="act">' + btn('photos', p.h8, 'FINE', 'FINE') + btn('photos', p.h8, 'FIX', 'FIX') + btn('photos', p.h8, 'REDO', 'REDO') + '</div>' +
      '<textarea data-note="photos" data-k="' + p.h8 + '" placeholder="Note (optional)"></textarea></div></div>';
  }).join('');
  paint();
}
function paint() {
  document.querySelectorAll('.act button').forEach(function (b) { b.classList.toggle('on', (state[b.dataset.g][b.dataset.k] || {}).verdict === b.dataset.v); });
  document.querySelectorAll('.photo[data-row]').forEach(function (r) { var v = (state.photos[r.dataset.k] || {}).verdict; r.className = 'photo' + (v ? ' ' + v : ''); });
  document.querySelectorAll('textarea[data-note]').forEach(function (t) { t.value = (state[t.dataset.note][t.dataset.k] || {}).note || ''; });
}
document.addEventListener('click', function (e) {
  var f = e.target.closest('.filters button');
  if (f) { filter = f.dataset.f; renderFilters(); renderPhotos(); return; }
  var b = e.target.closest('.act button'); if (!b) return;
  var o = state[b.dataset.g][b.dataset.k] = state[b.dataset.g][b.dataset.k] || {};
  o.verdict = o.verdict === b.dataset.v ? null : b.dataset.v; save(); paint();
});
document.addEventListener('input', function (e) {
  var t = e.target; if (!t.matches('textarea[data-note]')) return;
  var o = state[t.dataset.note][t.dataset.k] = state[t.dataset.note][t.dataset.k] || {}; o.note = t.value; save();
});
function count() {
  var n = PHOTOS.filter(function (p) { return (state.photos[p.h8] || {}).verdict; }).length, r = REPEATS.filter(function (x) { return (state.repeats[x.key] || {}).verdict; }).length;
  document.getElementById('count').textContent = n + ' of ' + PHOTOS.length + ' photos marked · ' + r + ' of ' + REPEATS.length + ' repeats';
}
function exportJson() {
  return JSON.stringify({
    generated: new Date().toISOString(), ruledBy: 'Al, photo check page (review/photo-check-for-al.html)',
    repeats: REPEATS.map(function (x) { var o = state.repeats[x.key] || {}; return { key: x.key, photo: x.h8, days: x.days, verdict: o.verdict || null, note: o.note || '' }; }),
    photos: PHOTOS.map(function (p) { var o = state.photos[p.h8] || {}; return { n: p.n, hash: p.hash, folder: p.folder, covers: p.words, level: p.level, worst: { lang: p.lang, line: p.line, size: p.size }, verdict: o.verdict || null, note: o.note || '' }; })
  }, null, 1);
}
document.getElementById('export').addEventListener('click', function () {
  var j = exportJson(), out = document.getElementById('out'); out.style.display = 'block'; out.value = j;
  try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'photo-check-ruled.json'; a.click(); } catch (e) {}
});
document.getElementById('copy').addEventListener('click', function () {
  var j = exportJson(), out = document.getElementById('out'); out.style.display = 'block'; out.value = j; out.select();
  try { navigator.clipboard.writeText(j); } catch (e) { try { document.execCommand('copy'); } catch (e2) {} }
});
var z = document.getElementById('zoom');
document.addEventListener('click', function (e) { var i = e.target.closest('.photo img, .thumbs img'); if (i) { z.querySelector('img').src = i.src; z.style.display = 'flex'; } });
z.addEventListener('click', function () { z.style.display = 'none'; });
renderFilters(); renderPhotos(); count();
</script>
</body>
</html>
`;
writeFileSync('review/photo-check-for-al.html', html);
console.log(`[photo-page] review/photo-check-for-al.html: ${REPEATS.length} repeat questions, ${flagged.length} photos, ${(html.length / 1024).toFixed(0)} KB`);
