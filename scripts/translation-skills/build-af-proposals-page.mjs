// The Afrikaans page for Al (Part 2, step 10 — 2026-09-23). Afrikaans never auto-wires: every
// Afrikaans change the checks suggest goes here, and only Al's export wires anything.
//
// Two sections:
//   1. Proposals — lines the calibrated checks fail that Al has not already ruled (his own lines he
//      KEPT on the translation page stay as they are), the two rows he marked FIX without a line, and
//      Afrikaans safety lines that do not pass both back-translations. Each shows the English, the
//      live Afrikaans, a proposal written by the sharpened af-qc skill, and why it is here.
//      Choice per row: KEEP (leave it), USE (the proposal), FIX (write the line).
//   2. Wired today as you wrote them — the 14 lines from his notes, with the spelling I restored
//      ('n, reën, vroeë, spieël, daardie) shown, so he can undo any of it (UNDO puts the old line back).
//
//   node scripts/translation-skills/build-af-proposals-page.mjs
//   in:  output/translation-skills/live/af-proposals.json  [{ id, key, en, current, proposal, why, where }]
//        output/translation-skills/af-rulings/summary.json (apply-af-rulings.mjs)
//   out: review/af-proposals.html → Export saves af-proposals-ruled.json to Downloads
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const rd = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const props = rd('output/translation-skills/live/af-proposals.json');
const wired = rd('output/translation-skills/af-rulings/summary.json');
const data = new Map(rd('review/translation-check-data.json').rows.map((r) => [r.k, r]));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const wiredRows = Object.entries(wired.lines).map(([k, l]) => ({ k, en: data.get(k)?.en, before: data.get(k)?.text, after: l.wired, note: l.note, restored: l.restored }));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Afrikaans proposals</title>
<style>
:root { --bg:#f7f6f2; --fg:#1d1d1b; --muted:#6b6a64; --line:#dddbd2; --card:#fff; --accent:#1f5f8b; --keep:#2e7d4f; --use:#1f5f8b; --fix:#b7791f; --undo:#a5452b; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#161614; --fg:#ecebe6; --muted:#a3a29b; --line:#34332f; --card:#1f1f1c; --accent:#7fb6dd; --keep:#7ccf9c; --use:#7fb6dd; --fix:#e0b35c; --undo:#e08a6e; } }
body { margin:0; padding:24px 16px 64px; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, sans-serif; }
main { max-width:980px; margin:0 auto; }
h1 { font-size:1.45rem; margin:0 0 6px; } h2 { font-size:1.1rem; margin:30px 0 8px; }
p.lede { color:var(--muted); margin:0 0 14px; max-width:72ch; }
.row { background:var(--card); border:1px solid var(--line); border-left:4px solid var(--line); border-radius:8px; padding:12px 14px; margin:10px 0; }
.row.KEEP { border-left-color:var(--keep); } .row.USE { border-left-color:var(--use); } .row.FIX { border-left-color:var(--fix); } .row.UNDO { border-left-color:var(--undo); }
.k { font-size:.8rem; color:var(--muted); } .en { font-weight:600; margin:2px 0 6px; }
.lbl { font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-top:6px; }
.af { margin:1px 0; } .why { font-size:.88rem; color:var(--muted); margin-top:6px; }
.act { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; align-items:flex-start; }
.act button { font:inherit; font-size:.9rem; padding:6px 12px; border-radius:6px; border:1px solid var(--line); background:transparent; color:inherit; cursor:pointer; }
.act button.on { color:#fff; } .act button.on.KEEP { background:var(--keep); border-color:var(--keep); } .act button.on.USE { background:var(--use); border-color:var(--use); } .act button.on.FIX { background:var(--fix); border-color:var(--fix); } .act button.on.UNDO { background:var(--undo); border-color:var(--undo); }
textarea { flex:1 1 260px; min-height:36px; font:inherit; font-size:.92rem; border:1px solid var(--line); border-radius:6px; padding:6px; background:transparent; color:inherit; }
.bar { position:sticky; top:0; background:var(--bg); padding:10px 0; display:flex; gap:10px; align-items:center; flex-wrap:wrap; border-bottom:1px solid var(--line); z-index:1; }
.bar button { font:inherit; padding:8px 14px; border-radius:6px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; }
#out { width:100%; min-height:110px; margin-top:12px; box-sizing:border-box; }
</style>
</head>
<body>
<main>
<h1>Afrikaans: ${props.length} proposals and ${wiredRows.length} lines wired from your notes</h1>
<p class="lede">Nothing on this page is live until you export it. <b>Proposals</b> are lines the checks failed that you have not ruled yet, the two lines you marked FIX without a new line, and Afrikaans safety lines one of the back-translations did not read back as the English. Your own lines you KEPT on the translation page are not here. Each proposal was written by the sharpened Afrikaans skill from the English. Rule each: <b>KEEP</b> the live line, <b>USE</b> the proposal, or <b>FIX</b> (write the line).</p>
<div class="bar"><span id="count"></span><button id="export">Export af-proposals-ruled.json</button><button id="copy">Copy JSON</button></div>
<h2>Proposals</h2>
<div id="props">
${props.map((p) => `<div class="row" data-id="${esc(p.id)}" data-key="${esc(p.key)}" data-en="${esc(p.en)}" data-current="${esc(p.current)}" data-proposal="${esc(p.proposal)}" data-kind="proposal">
<div class="k">${esc(p.key)} · ${esc(p.where)}</div>
<div class="en">${esc(p.en)}</div>
<div class="lbl">Live now</div><div class="af">${esc(p.current)}</div>
<div class="lbl">Proposal</div><div class="af">${esc(p.proposal)}</div>
<div class="why">${esc(p.why)}</div>
<div class="act"><button data-v="KEEP">KEEP</button><button data-v="USE">USE</button><button data-v="FIX">FIX</button><textarea placeholder="Your line (for FIX)"></textarea></div>
</div>`).join('\n')}
</div>
<h2>Wired today as you wrote them (${wiredRows.length})</h2>
<p class="lede">From your notes on the translation page and the calibration page. Your words; the only changes are spelling your keyboard dropped, listed on each row. Leave a row alone to keep it; <b>UNDO</b> puts the old line back; <b>FIX</b> to change it.</p>
<div id="wired">
${wiredRows.map((w) => `<div class="row" data-id="${esc(w.k)}" data-key="${esc(w.k)}" data-en="${esc(w.en)}" data-current="${esc(w.after)}" data-proposal="${esc(w.before)}" data-kind="wired">
<div class="k">${esc(w.k)}</div>
<div class="en">${esc(w.en)}</div>
<div class="lbl">Was</div><div class="af">${esc(w.before)}</div>
<div class="lbl">Your note</div><div class="af">${esc(w.note)}</div>
<div class="lbl">Live now</div><div class="af">${esc(w.after)}</div>
<div class="why">${w.restored.length ? `Restored: ${esc(w.restored.join('; '))}` : 'Exactly as you wrote it.'}</div>
<div class="act"><button data-v="UNDO">UNDO</button><button data-v="FIX">FIX</button><textarea placeholder="Your line (for FIX)"></textarea></div>
</div>`).join('\n')}
</div>
<textarea id="out" readonly placeholder="The export also appears here."></textarea>
</main>
<script>
var KEY = 'pw-af-proposals-2026-09-23';
var state = {}; try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
var rows = Array.prototype.slice.call(document.querySelectorAll('.row'));
function paint() {
  var n = 0;
  rows.forEach(function (r) {
    var s = state[r.dataset.id] || {};
    r.className = 'row' + (s.v ? ' ' + s.v : '');
    Array.prototype.forEach.call(r.querySelectorAll('button[data-v]'), function (b) { b.className = s.v === b.dataset.v ? 'on ' + b.dataset.v : ''; });
    var t = r.querySelector('textarea'); if (t && s.text !== undefined && t.value !== s.text) t.value = s.text;
    if (s.v) n++;
  });
  document.getElementById('count').textContent = n + ' of ' + rows.length + ' rows ruled';
}
rows.forEach(function (r) {
  Array.prototype.forEach.call(r.querySelectorAll('button[data-v]'), function (b) {
    b.addEventListener('click', function () { var s = state[r.dataset.id] || {}; s.v = s.v === b.dataset.v ? undefined : b.dataset.v; state[r.dataset.id] = s; save(); paint(); });
  });
  var t = r.querySelector('textarea');
  t.addEventListener('input', function () { var s = state[r.dataset.id] || {}; s.text = t.value; if (t.value.trim() && !s.v) s.v = 'FIX'; state[r.dataset.id] = s; save(); paint(); });
});
function exportJson() {
  var rulings = rows.map(function (r) { var s = state[r.dataset.id] || {}; return { id: r.dataset.id, key: r.dataset.key, kind: r.dataset.kind, en: r.dataset.en, live: r.dataset.current, proposal: r.dataset.proposal, verdict: s.v || null, text: (s.text || '').trim() }; });
  return JSON.stringify({ generated: new Date().toISOString(), ruledBy: 'Al, Afrikaans proposals page (review/af-proposals.html)', ruled: rulings.filter(function (x) { return x.verdict; }).length, total: rulings.length, rulings: rulings }, null, 1);
}
document.getElementById('export').addEventListener('click', function () { var j = exportJson(); document.getElementById('out').value = j; try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'af-proposals-ruled.json'; a.click(); } catch (e) {} });
document.getElementById('copy').addEventListener('click', function () { var j = exportJson(); document.getElementById('out').value = j; try { navigator.clipboard.writeText(j); } catch (e) {} });
paint();
</script>
</body>
</html>
`;
writeFileSync(path.join(root, 'review', 'af-proposals.html'), html);
console.log(`[af-page] review/af-proposals.html: ${props.length} proposals, ${wiredRows.length} wired rows`);
