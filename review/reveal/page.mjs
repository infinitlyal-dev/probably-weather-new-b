// Al's page for the joke that arrives late (2026-09-25): review/reveal-for-al.html, built from the
// recording's timing file so every number on it is the page's own measurement.
//
//   node review/reveal/page.mjs [--preview <url>]
//
// House pattern (file://, marks in localStorage, Export -> Downloads/reveal-ruled.json). Needs
// review/reveal-for-al/ from review/reveal/record.mjs; draws a poster (the last frame) for every video.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const DIR = 'review/reveal-for-al';
const PREVIEW = (arg('--preview', '') || '').replace(/\/$/, '');
const T = JSON.parse(readFileSync(path.join(DIR, 'data', 'timing.json'), 'utf8'));
mkdirSync(path.join(DIR, 'posters'), { recursive: true });

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LANG = { en: 'English', af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const poster = (file) => {
  if (!file) return '';
  const out = path.join(DIR, 'posters', path.basename(file).replace(/\.mp4$/, '.jpg'));
  if (!existsSync(out)) {
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-0.2', '-i', path.join(DIR, file), '-frames:v', '1', '-vf', 'scale=414:-2', '-q:v', '4', out], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
  }
  return `reveal-for-al/posters/${path.basename(out)}`;
};
const video = (file, cap, sub = '') => `<figure class="clip"><video src="reveal-for-al/${esc(file)}" poster="${poster(file)}" preload="none" muted playsinline controls></video><figcaption><b>${esc(cap)}</b>${sub ? `<span>${sub}</span>` : ''}</figcaption></figure>`;

// Why each photograph is here, in a line (the photo check's own data: review/eval/photo-check/data/d-count.json).
const NOTES = {
  'pale-dog': 'The palest photo. The joke is about the dog lying at the bottom, so the joke sits on the dog.',
  'zu-longest': 'The longest isiZulu line in the bank: five lines on your phone.',
  sprinkler: 'One of the most-shown photos (every Sunday in heat, 10.9 hours a week). All four of its English lines sit on the kids.',
  parrot: 'One of the most-shown photos (every Friday in heat, 10.9 hours a week). Its English lines are short and miss the bird; the joke only sits on it in isiZulu, isiXhosa and Sesotho, so this one is in isiXhosa, with the tallest line measured on it.',
};

const groups = Object.entries(T.states).map(([id, s]) => {
  const c = s.clips;
  const ms = (v) => (v == null ? '—' : `${(v / 1000).toFixed(2)} s`);
  const clips = ['d-today', 'ink-1', 'word-1', 'fade-1', 'ink-2', 'ink-3.5'].filter((k) => c[k]?.file).map((k) => {
    const x = c[k];
    const sub = k === 'd-today' ? 'the joke is simply there' : `beat ${ms(x.beatMs)} · written in ${ms(x.writeMs)}`;
    return video(x.file, x.title, sub);
  }).join('');
  const any = c['ink-1'] || Object.values(c)[0];
  return `<section class="group" data-group="${esc(id)}">
<h3>${esc(s.title)}</h3>
<p class="joke">“${esc(s.joke)}”</p>
<p class="muted">${NOTES[id] ? `${esc(NOTES[id])} ` : ''}${LANG[s.lang] || s.lang} · the joke ${any?.risen ? 'rises under “Probably …” on this photo' : 'sits at the foot on this photo'} · ${esc(s.slot)}</p>
<button type="button" class="together">▶ Play all ${Object.values(c).filter((x) => x.file).length} together</button>
<div class="clips">${clips}</div>
</section>`;
}).join('\n');

const E = T.extras || {};
const extras = [
  E.repeat?.file && video(E.repeat.file, 'A repeat visit', 'first open writes it on; opened again, the same joke is simply there'),
  E.tap?.file && video(E.tap.file, 'Tap the photo', `hide, then show — the button's name goes “${esc((E.tap.labels || []).join('” → “'))}”`),
  E.reducedMotion?.file && video(E.reducedMotion.file, 'Reduce motion on', 'the joke arrives with the photo: no beat, no writing'),
].filter(Boolean).join('');

const cards = Object.entries(T.states).filter(([, s]) => s.postcard).map(([id, s]) => `<figure class="card-pair"><a href="reveal-for-al/${esc(s.postcard)}" target="_blank"><img loading="lazy" src="reveal-for-al/${esc(s.postcard)}" alt="The postcard for ${esc(s.title)}"></a><figcaption>${esc(s.title)}</figcaption></figure>`).join('');

const COMBOS = [];
for (const st of ['ink', 'word', 'fade']) for (const b of ['1', '2', '3.5']) COMBOS.push([st, b]);
const STYLE = { ink: 'Ink', word: 'Word by word', fade: 'Fade' };
const phone = PREVIEW ? `<div class="card">
<p class="answer">On your iPhone: <a href="${esc(PREVIEW)}/?home=d&amp;reveal=ink&amp;beat=1&amp;replay=1">${esc(PREVIEW.replace(/^https?:\/\//, ''))}</a></p>
<p class="muted">A preview of this branch only, with real weather for where you are. The live app is not touched. Each link below counts every open as a first sight, so you can open them again and again:</p>
<div class="links">${COMBOS.map(([st, b]) => `<a href="${esc(PREVIEW)}/?home=d&amp;reveal=${st}&amp;beat=${b}&amp;replay=1">${STYLE[st]} · ${b} s</a>`).join('')}</div>
<p class="muted">And two more: <a href="${esc(PREVIEW)}/?home=d&amp;reveal=ink&amp;beat=1">the real thing</a> (writes the joke the first time, then it is simply there — open it twice) and <a href="${esc(PREVIEW)}/?home=d">D as it is, no reveal</a>.</p>
</div>` : `<div class="card"><p class="answer">No phone link this time.</p><p class="muted" id="nolink">The videos below are the whole test.</p></div>`;

const beats = Object.values(T.states).flatMap((s) => Object.entries(s.clips).filter(([k]) => k !== 'd-today').map(([k, x]) => ({ k, beat: x.beatMs, write: x.writeMs })));
const range = (arr) => (arr.length ? `${Math.min(...arr)}–${Math.max(...arr)} ms` : '—');
const by = (pre) => beats.filter((b) => b.k.startsWith(pre));
const measured = `<table class="t"><tr><th>Asked for</th><th>Measured on the page (every clip)</th></tr>
<tr><td>Beat 1 s</td><td>${range(beats.filter((b) => b.k.endsWith('-1')).map((b) => b.beat))} from the photo landing to the first ink</td></tr>
<tr><td>Beat 2 s</td><td>${range(beats.filter((b) => b.k === 'ink-2').map((b) => b.beat))}</td></tr>
<tr><td>Beat 3.5 s</td><td>${range(beats.filter((b) => b.k === 'ink-3.5').map((b) => b.beat))}</td></tr>
<tr><td>Writing, at most ~1.6 s</td><td>ink ${range(by('ink').map((b) => b.write))} · word by word ${range(by('word').map((b) => b.write))} · fade ${range(by('fade').map((b) => b.write))}</td></tr></table>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The joke that arrives late — for Al</title>
<style>
:root { --bg:#f6f4ee; --fg:#1d1b18; --muted:#6b665c; --line:#dcd7cb; --card:#fffdf8; --accent:#1f5f8b; --use:#2e7d4f; --fix:#b7791f; --no:#a5452b; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#15140f; --fg:#eeebe3; --muted:#a8a296; --line:#35322b; --card:#1f1d18; --accent:#7fb6dd; --use:#7ccf9c; --fix:#e8b45a; --no:#e08a6e; } }
* { box-sizing: border-box; }
body { margin:0; padding:20px 16px 96px; background:var(--bg); color:var(--fg); font:15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width:1240px; margin:0 auto; }
h1 { font-size:1.55rem; margin:0 0 4px; } h2 { font-size:1.25rem; margin:36px 0 10px; } h3 { font-size:1.05rem; margin:0 0 4px; }
p { max-width:88ch; } p.lede, .muted { color:var(--muted); } p.lede { margin:0 0 16px; }
a { color:var(--accent); }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin:12px 0; }
.answer { font-size:1.08rem; font-weight:600; margin:0 0 6px; }
ul.plain { margin:6px 0 0; padding-left:20px; } ul.plain li { margin:5px 0; max-width:92ch; }
.links { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0; }
.links a { padding:6px 12px; border:1px solid var(--line); border-radius:16px; text-decoration:none; background:var(--bg); }
.group { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin:14px 0; }
.group .joke { font-style:italic; margin:2px 0; font-size:1.02rem; }
.together { font:inherit; margin:8px 0 10px; padding:7px 14px; border-radius:6px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; }
.clips { display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); gap:10px; }
.clip { margin:0; }
.clip video { width:100%; aspect-ratio: 414 / 715; display:block; border-radius:8px; background:#111; }
.clip figcaption { font-size:.8rem; line-height:1.3; margin-top:4px; } .clip figcaption span { display:block; color:var(--muted); }
.extras { display:grid; grid-template-columns:repeat(3, minmax(0, 220px)); gap:14px; }
.cards { display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:10px; }
.card-pair { margin:0; } .card-pair img { width:100%; display:block; border-radius:4px; border:1px solid var(--line); box-shadow:0 4px 14px rgba(0,0,0,.18); }
.card-pair figcaption { font-size:.78rem; color:var(--muted); margin-top:4px; line-height:1.3; }
table.t { border-collapse:collapse; margin:8px 0; font-size:.92rem; } table.t td, table.t th { border-bottom:1px solid var(--line); padding:6px 14px 6px 0; text-align:left; vertical-align:top; }
table.t th { color:var(--muted); font-weight:600; font-size:.82rem; }
.q { background:var(--card); border:1px solid var(--line); border-left:4px solid var(--line); border-radius:8px; padding:12px 14px; margin:10px 0; }
.q.done { border-left-color:var(--use); }
.q h3 { margin-bottom:6px; }
.act { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.act button { font:inherit; font-size:.9rem; padding:6px 14px; border-radius:6px; border:1px solid var(--line); background:transparent; color:inherit; cursor:pointer; }
.act button.on { background:var(--use); border-color:var(--use); color:#fff; }
.act button.on.NO, .act button.on.FIX { background:var(--no); border-color:var(--no); }
.words { font-size:1.05rem; margin:4px 0; } .words b { font-weight:600; }
textarea { width:100%; min-height:38px; font:inherit; font-size:.9rem; border:1px solid var(--line); border-radius:6px; padding:6px; background:transparent; color:inherit; margin-top:8px; }
.bar { position:fixed; left:0; right:0; bottom:0; background:var(--card); border-top:1px solid var(--line); padding:10px 16px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; z-index:5; }
.bar button { font:inherit; padding:8px 14px; border-radius:6px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; }
.bar button.ghost { background:transparent; color:var(--accent); }
#out { display:none; width:100%; min-height:110px; margin-top:8px; }
code { font-size:.85em; }
@media (max-width:980px) { .clips { grid-template-columns:repeat(3, minmax(0, 1fr)); } .cards { grid-template-columns:repeat(4, minmax(0, 1fr)); } }
@media (max-width:560px) { .clips { grid-template-columns:repeat(2, minmax(0, 1fr)); } .extras { grid-template-columns:repeat(2, minmax(0, 1fr)); } .cards { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
</style>
</head>
<body>
<main>
<h1>Probably Weather — the joke that arrives late</h1>
<p class="lede">25 Sept. Your idea, built onto Home D so you can watch it: the photo and the forecast come first, with no joke;
a beat later the joke writes itself onto the photo. Setup, beat, punchline. It is on the design branch only, behind a switch —
D without it is D as it was. Nothing on main, and the live app is not touched.</p>

<h2>1. Watch it on your phone</h2>
${phone}

<h2>2. What it does</h2>
<div class="card"><ul class="plain">
<li>The weather is there at once. The joke waits, and the wait starts when the photo is actually on screen — not when the app opens.</li>
<li>After the beat it writes itself on. Three ways to compare: <b>ink</b> (the handwriting appears left to right, line by line), <b>word by word</b>, and a plain <b>fade</b>. Three beats: 1, 2 and 3.5 seconds.</li>
<li>A longer line takes a little longer to write, but never more than about 1.6 seconds, so the long isiZulu lines don't drag.</li>
<li>Only a joke you haven't seen gets the show. Open the app again and the same joke is simply there.</li>
<li>Phones set to reduce motion get the joke straight away. Screen readers get the words at once.</li>
<li>The joke's space is kept from the start, so nothing on the screen moves when it lands. Checked: Home still fits on all 80 phone sizes, and with each of the three styles on, every measurement is the same as without it.</li>
<li>Tap the photo to hide the joke and see the whole picture; tap again to bring it back. The handle and Share still do their own jobs. There is also a proper button for keyboards and screen readers, named “Show the joke” / “Hide the joke” in all five languages.</li>
<li>Share now sends a postcard: the photo clean, the joke written under it on a light border. Nothing sits on the photo.</li>
</ul></div>
${measured}

<h2>3. The videos, by photo</h2>
<p class="muted">Recorded at real speed in the iPhone browser engine at your screen size (414×715). Every clip starts just before the photo lands.
“Play all together” starts a whole row at once, so the timing differences show side by side. Each photo's clips carry the same joke.</p>
${groups}

<h2>4. The rest, in motion</h2>
<div class="extras">${extras}</div>

<h2>5. The postcard Share sends</h2>
<p class="muted">Before: Share sent a picture of the screen, joke on the photo. Now: the photo clean, the joke under it in the same handwriting on the print's cream, then the place, the temperature and “Probably …”. Click one to see it full size.</p>
<div class="cards">${cards}</div>

<h2>6. Your picks</h2>
<div class="q" data-q="style"><h3>Which style?</h3><div class="act"><button type="button" data-q="style" data-v="ink">Ink</button><button type="button" data-q="style" data-v="word">Word by word</button><button type="button" data-q="style" data-v="fade">Fade</button></div><textarea data-note="style" placeholder="Note (optional)"></textarea></div>
<div class="q" data-q="beat"><h3>How long a beat?</h3><div class="act"><button type="button" data-q="beat" data-v="1">1 s</button><button type="button" data-q="beat" data-v="2">2 s</button><button type="button" data-q="beat" data-v="3.5">3.5 s</button></div><textarea data-note="beat" placeholder="Note (optional)"></textarea></div>
<div class="q" data-q="tap"><h3>Tap the photo to hide / show the joke</h3><div class="act"><button type="button" data-q="tap" data-v="USE">USE</button><button type="button" data-q="tap" data-v="NO" class="NO">NO</button></div><textarea data-note="tap" placeholder="Note (optional)"></textarea></div>
<div class="q" data-q="postcard"><h3>The postcard share picture</h3><div class="act"><button type="button" data-q="postcard" data-v="USE">USE</button><button type="button" data-q="postcard" data-v="NO" class="NO">NO</button></div><textarea data-note="postcard" placeholder="Note (optional)"></textarea></div>
<div class="q" data-q="en"><h3>The button's name in English</h3><p class="words"><b>Show the joke</b> · <b>Hide the joke</b></p><div class="act"><button type="button" data-q="en" data-v="OK">OK</button><button type="button" data-q="en" data-v="FIX" class="FIX">FIX</button></div><textarea data-note="en" placeholder="Your words, if FIX"></textarea></div>
<div class="q" data-q="af"><h3>The button's name in Afrikaans</h3><p class="words"><b>Wys die grap</b> · <b>Versteek die grap</b></p><div class="act"><button type="button" data-q="af" data-v="OK">OK</button><button type="button" data-q="af" data-v="FIX" class="FIX">FIX</button></div><textarea data-note="af" placeholder="Your words, if FIX"></textarea></div>
<p class="muted">isiZulu <i>Bonisa ihlaya / Fihla ihlaya</i>, isiXhosa <i>Bonisa isiqhulo / Fihla isiqhulo</i> and Sesotho <i>Bontsha motlae / Pata motlae</i> went through the translation skills and the language checker (all six passed; the evidence is in <code>review/reveal/labels.md</code>).</p>
<div class="q" data-q="other"><h3>Anything else</h3><textarea data-note="other" placeholder="Note (optional)"></textarea></div>
<textarea id="out" readonly></textarea>
</main>
<div class="bar"><span id="count" class="muted"></span><button id="export" type="button">Export reveal-ruled.json</button><button id="copy" type="button" class="ghost">Copy JSON</button></div>
<script>
var KEY = 'pw-reveal-2026-09-25';
var QS = ['style', 'beat', 'tap', 'postcard', 'en', 'af'];
var state = {}; try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state = {}; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} count(); }
function paint() {
  document.querySelectorAll('.act button').forEach(function (b) { b.classList.toggle('on', (state[b.dataset.q] || {}).pick === b.dataset.v); });
  document.querySelectorAll('.q[data-q]').forEach(function (q) { q.classList.toggle('done', !!(state[q.dataset.q] || {}).pick); });
  document.querySelectorAll('textarea[data-note]').forEach(function (t) { t.value = (state[t.dataset.note] || {}).note || ''; });
}
function count() { document.getElementById('count').textContent = QS.filter(function (q) { return (state[q] || {}).pick; }).length + ' of ' + QS.length + ' picked'; }
document.addEventListener('click', function (e) {
  var g = e.target.closest('.together');
  if (g) {
    var vs = g.parentElement.querySelectorAll('video');
    vs.forEach(function (v) { v.preload = 'auto'; v.pause(); try { v.currentTime = 0; } catch (x) {} });
    vs.forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); });
    return;
  }
  var b = e.target.closest('.act button'); if (!b) return;
  var o = state[b.dataset.q] = state[b.dataset.q] || {};
  o.pick = o.pick === b.dataset.v ? null : b.dataset.v; save(); paint();
});
document.addEventListener('input', function (e) {
  var t = e.target; if (!t.matches('textarea[data-note]')) return;
  var o = state[t.dataset.note] = state[t.dataset.note] || {}; o.note = t.value; save();
});
function exportJson() {
  var p = function (q) { var o = state[q] || {}; return { pick: o.pick || null, note: o.note || '' }; };
  return JSON.stringify({
    generated: new Date().toISOString(), ruledBy: 'Al, the joke that arrives late (review/reveal-for-al.html)',
    style: p('style'), beat: p('beat'),
    tapToHide: p('tap'), postcard: p('postcard'),
    words: { en: Object.assign({ show: 'Show the joke', hide: 'Hide the joke' }, p('en')), af: Object.assign({ show: 'Wys die grap', hide: 'Versteek die grap' }, p('af')) },
    other: (state.other || {}).note || ''
  }, null, 1);
}
document.getElementById('export').addEventListener('click', function () {
  var j = exportJson(), out = document.getElementById('out'); out.style.display = 'block'; out.value = j;
  try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'reveal-ruled.json'; a.click(); } catch (e) {}
});
document.getElementById('copy').addEventListener('click', function () {
  var j = exportJson(), out = document.getElementById('out'); out.style.display = 'block'; out.value = j; out.select();
  try { navigator.clipboard.writeText(j); } catch (e) { try { document.execCommand('copy'); } catch (e2) {} }
});
paint(); count();
</script>
</body>
</html>
`;
writeFileSync('review/reveal-for-al.html', html);
console.log(`review/reveal-for-al.html: ${Object.keys(T.states).length} photos, ${Object.values(T.states).reduce((n, s) => n + Object.values(s.clips).filter((c) => c.file).length, 0)} clips, extras ${Object.keys(E).length}, preview ${PREVIEW || 'none'}`);
