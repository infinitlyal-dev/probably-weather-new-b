// The blind Afrikaans calibration page for Al (Part 2, step 6 — 2026-09-23).
//
// Al's brief: "40 Afrikaans lines, a mix of flagged and unflagged, not labelled which. For each he
// marks GOOD / DRIFT-BUT-FINE (deliberate adaptation that keeps the joke) / WRONG. Export
// review\af-calibration-ruled.json. Measure how well each checker agreed with Al and set the pass
// thresholds from that."
//
// The 40: live Afrikaans lines Al has never ruled on (his own lines are gold already, and he would
// recognise them). Only 8 of those were flagged by the 2026-09-19 check — 77 of its 85 Afrikaans
// flags are lines Al wrote or kept — so "flagged" here means flagged by ANY checker on the 300-line
// sample (output/translation-skills/calibration/candidates.json): the old check (a), Sol's blind
// back-translation judged against the English (b), the same judge on the old back-translation
// (a'), the rule checks (d). The draw: every old-check flag, up to 10 Sol flags, up to 4 others,
// and the rest clean by every checker. Seeded; shuffled together; nothing on the page or in its
// keys file says which group a line came from.
//
// Writes review/af-calibration.html and review/af-calibration-keys.json (keys only). The
// translation-check page leaves off the flagged ones, so no line is ruled twice and this page
// stays blind whichever Al opens first.
//
//   node scripts/translation-skills/build-calibration-page.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const KEYS = path.join(root, 'review', 'af-calibration-keys.json');
if (existsSync(KEYS) && !process.argv.includes('--force')) {
  console.log('[calibration] review/af-calibration-keys.json exists — keeping the 40 already chosen (--force draws a new 40, only before Al has started).');
}
const data = JSON.parse(readFileSync(path.join(root, 'review', 'translation-check-data.json'), 'utf8'));
const af = data.rows.filter((r) => r.lang === 'af' && !r.alRuledAf);
let seed = 20260923;
const rand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const take = (pool, n) => { const p = pool.slice(); const out = []; while (out.length < n && p.length) out.push(p.splice(Math.floor(rand() * p.length), 1)[0]); return out; };

let chosen;
if (existsSync(KEYS) && !process.argv.includes('--force')) {
  const keys = JSON.parse(readFileSync(KEYS, 'utf8')).keys;
  const byK = new Map(data.rows.map((r) => [r.k, r]));
  chosen = keys.map((k) => byK.get(k)).filter(Boolean);
  if (chosen.length !== keys.length) { console.error('[calibration] some chosen lines are no longer live — re-draw with --force before Al starts'); process.exit(1); }
} else {
  const cand = JSON.parse(readFileSync(path.join(root, 'output', 'translation-skills', 'calibration', 'candidates.json'), 'utf8'));
  const byK = new Map(af.map((r) => [r.k, r]));
  const rowsOf = (pred) => cand.filter(pred).map((c) => byK.get(c.k)).filter(Boolean);
  const old = rowsOf((c) => c.oldFlag);
  const sol = rowsOf((c) => !c.oldFlag && c.solFlag);
  const other = rowsOf((c) => !c.oldFlag && !c.solFlag && (c.rejudgeFlag || c.ruleFlag));
  const clean = rowsOf((c) => !c.oldFlag && !c.solFlag && !c.rejudgeFlag && !c.ruleFlag);
  const picked = [...old, ...take(sol, 10), ...take(other, 4)];
  chosen = [...picked, ...take(clean, 40 - picked.length)];
  for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }
  writeFileSync(KEYS, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), note: 'The 40 lines on review/af-calibration.html, in page order. Which ones were flagged is recomputed from review/translation-check-data.json, never stored here, so nothing beside the page gives it away.', keys: chosen.map((r) => r.k) }, null, 1));
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rows = chosen.map((r, i) => ({ n: i + 1, k: r.k, en: r.en, af: r.text, image: r.where?.kind === 'photo' ? r.image : null }));
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Afrikaans calibration</title>
<style>
:root { --bg:#f7f6f2; --fg:#1d1d1b; --muted:#6b6a64; --line:#dddbd2; --card:#fff; --accent:#1f5f8b; --good:#2e7d4f; --fine:#b7791f; --wrong:#a5452b; }
@media (prefers-color-scheme: dark) { :root { --bg:#161614; --fg:#ecebe6; --muted:#a3a29b; --line:#34332f; --card:#1f1f1c; --accent:#7fb6dd; --good:#7ccf9c; --fine:#e0b35c; --wrong:#e08a6e; } }
* { box-sizing:border-box; }
body { margin:0; padding:18px 16px 96px; background:var(--bg); color:var(--fg); font:16px/1.45 system-ui, sans-serif; }
main { max-width:900px; margin:0 auto; }
h1 { font-size:1.4rem; margin:0 0 6px; }
.lede { color:var(--muted); margin:0 0 12px; font-size:.95rem; max-width:80ch; }
.lede b { color:var(--fg); }
.bar { position:sticky; top:0; z-index:5; background:var(--bg); display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); margin-bottom:12px; }
.bar button { font:inherit; padding:6px 12px; border-radius:7px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; }
.count { font-weight:600; }
.row { display:grid; grid-template-columns:84px 1fr; gap:12px; background:var(--card); border:2px solid var(--line); border-radius:10px; padding:10px; margin:0 0 10px; }
.row.GOOD { border-color:var(--good); } .row.FINE { border-color:var(--fine); } .row.WRONG { border-color:var(--wrong); }
.row img { width:84px; height:150px; object-fit:cover; border-radius:6px; background:#333; }
.noimg { width:84px; height:40px; font-size:.7rem; color:var(--muted); }
.n { font-size:.75rem; color:var(--muted); }
.l { font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:6px 0 0; }
.en { font-size:.95rem; } .af { font-size:1.15rem; font-weight:600; }
.act { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; align-items:center; }
.act button { font:inherit; font-size:.9rem; padding:6px 12px; border-radius:7px; border:1px solid var(--line); background:transparent; color:var(--fg); cursor:pointer; }
.act button.on.GOOD { background:var(--good); color:#fff; border-color:var(--good); }
.act button.on.FINE { background:var(--fine); color:#fff; border-color:var(--fine); }
.act button.on.WRONG { background:var(--wrong); color:#fff; border-color:var(--wrong); }
textarea { flex:1 1 240px; min-height:34px; font:inherit; font-size:.9rem; border:1px solid var(--line); border-radius:6px; padding:5px; background:transparent; color:inherit; }
#out { width:100%; min-height:80px; margin-top:10px; font:12px ui-monospace, monospace; }
@media (max-width:560px) { .row { grid-template-columns:64px 1fr; } .row img { width:64px; height:114px; } .bar { position:static; } }
</style>
</head>
<body>
<main>
<h1>Afrikaans: 40 lines, your ear</h1>
<p class="lede">These are 40 Afrikaans lines from the app, next to the English they come from. None of them is one you have ruled on before.
For each one, say whether the Afrikaans is right:
<b>GOOD</b> — it says what the English says, in natural Afrikaans.
<b>DRIFT BUT FINE</b> — it changes something on purpose and keeps the joke; you would ship it.
<b>WRONG</b> — it says something else, loses the joke, or reads wrong; you would not ship it.
Some of these passed the machine check and some did not. They are mixed and not marked, so your answers show which checker to trust. There is no trick and no quota.
A note is welcome where you know the better Afrikaans. Choices save in this browser. <b>Export</b> saves <code>af-calibration-ruled.json</code> to Downloads.</p>
<div class="bar"><span class="count" id="count"></span><button id="export">Export af-calibration-ruled.json</button><button id="copy">Copy JSON</button></div>
<div id="list"></div>
<textarea id="out" readonly placeholder="Exported JSON also appears here."></textarea>
</main>
<script>
const ROWS = ${JSON.stringify(rows)};
const LS = 'pw_af_calibration_v1';
const LABEL = { GOOD: 'GOOD', FINE: 'DRIFT BUT FINE', WRONG: 'WRONG' };
let state = {};
try { state = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { state = {}; }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} };
const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function count() { document.getElementById('count').textContent = ROWS.filter(r => state[r.k] && state[r.k].v).length + ' of ' + ROWS.length + ' marked'; }
function rowEl(r) {
  const st = state[r.k] || {};
  const el = document.createElement('section');
  el.className = 'row ' + (st.v || '');
  el.innerHTML = '<div>' + (r.image ? '<img loading="lazy" src="../assets/images/bg/' + r.image + '" alt="">' : '<div class="noimg">(condition line, no photo)</div>') + '</div>'
    + '<div><div class="n">' + r.n + ' of ' + ROWS.length + '</div>'
    + '<div class="l">English</div><div class="en">' + esc(r.en) + '</div>'
    + '<div class="l">Afrikaans</div><div class="af">' + esc(r.af) + '</div>'
    + '<div class="act">' + Object.keys(LABEL).map(v => '<button data-v="' + v + '" class="' + v + (st.v === v ? ' on' : '') + '">' + LABEL[v] + '</button>').join('')
    + '<textarea placeholder="note (optional): what is off, or the better Afrikaans">' + esc(st.note || '') + '</textarea></div></div>';
  el.querySelectorAll('.act button').forEach(b => b.addEventListener('click', () => {
    state[r.k] = { ...(state[r.k] || {}), v: b.dataset.v }; save();
    el.className = 'row ' + b.dataset.v; el.querySelectorAll('.act button').forEach(x => x.classList.toggle('on', x === b)); count();
  }));
  el.querySelector('textarea').addEventListener('input', (e) => { state[r.k] = { ...(state[r.k] || {}), note: e.target.value }; save(); });
  return el;
}
function exportJson() {
  const VERDICT = { GOOD: 'GOOD', FINE: 'DRIFT-BUT-FINE', WRONG: 'WRONG' };
  const rulings = ROWS.map(r => ({ k: r.k, en: r.en, af: r.af, verdict: VERDICT[(state[r.k] || {}).v] || null, note: (state[r.k] || {}).note || '' }));
  return JSON.stringify({ generated: new Date().toISOString(), ruledBy: 'Al, Afrikaans calibration page (review/af-calibration.html)', marked: rulings.filter(r => r.verdict).length, total: rulings.length, rulings }, null, 1);
}
const list = document.getElementById('list');
for (const r of ROWS) list.appendChild(rowEl(r));
count();
document.getElementById('export').addEventListener('click', () => { const j = exportJson(); document.getElementById('out').value = j; try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'af-calibration-ruled.json'; a.click(); } catch (e) {} });
document.getElementById('copy').addEventListener('click', () => { const j = exportJson(); document.getElementById('out').value = j; try { navigator.clipboard.writeText(j).catch(() => {}); } catch (e) {} });
</script>
</body>
</html>
`;
writeFileSync(path.join(root, 'review', 'af-calibration.html'), html);
const flaggedCount = chosen.filter((r) => r.flagged).length;
console.log(`[calibration] review/af-calibration.html: ${chosen.length} lines (${flaggedCount} flagged / ${chosen.length - flaggedCount} passed, not shown); ${rows.filter((r) => r.image).length} with their photograph`);
