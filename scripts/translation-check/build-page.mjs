// The back-translation review page for Al (Job 4, 2026-09-19).
//
// Inputs (output/translation-check/, git-ignored working files):
//   pairs.json          every live af/zu/xh/st line with the English it is keyed to (build-pairs.mjs)
//   <batch>.bt.json     a fresh-context language agent's BLIND back-translation of each line
//   <batch>.cmp.json    the same agent's verdict after it opened the English: MATCH / DRIFT / MISMATCH
//   lc-all.json         scripts/lang-check.mjs on every pair (corpus evidence, shown as support)
//
// A pair is FLAGGED when the agent said MISMATCH or DRIFT, or when the wrong-source probe fires:
// the blind back-translation shares clearly more words with ANOTHER English line of the same
// pool (the other lines of the same bank bin, or of the same photograph) than with its own.
// Plus a seeded random sample of 30 unflagged pairs, shown in their own section, so Al can test
// the checker itself.
//
// Writes review/translation-check-data.json (the merged record) and review/translation-check.html
// (file://, localStorage, export -> translation-check-ruled.json in Downloads).
//
//   node scripts/translation-check/build-page.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_LINES } from '../../assets/hero-lines.js';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dir = path.join(root, 'output', 'translation-check');
const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
const { pairs: allPairs, batches } = rd(path.join(dir, 'pairs.json'));
const lc = new Map(rd(path.join(dir, 'lc-all.json')).map((r) => [r.key, r]));

// LIVE ONLY. The provenance cull (2026-09-20) took 417 lines off their
// photographs, and a pair whose only reference was one of those photographs is
// no longer anything Al can be shown — the app cannot put it on screen. The
// back-translations are kept on disk and are not re-run: this drops the dead
// pairs from the count so the number on the page is the real remaining work.
// A pair with a bank reference stays: the condition bank is untouched.
// The test is the LINE, not the slot: the cull took single lines off photographs
// that kept their others, so the slot is still live while the line is gone.
const liveEnglish = new Set(Object.values(HERO_LINES).flat());
const stillWired = (p) => p.refs.some((r) => (r.kind === 'bespoke' ? liveEnglish.has(p.en) : true));
const pairs = allPairs.filter(stillWired);
const dropped = allPairs.filter((p) => !stillWired(p));
if (dropped.length) {
  const byLang = dropped.reduce((m, p) => (m[p.lang] = (m[p.lang] || 0) + 1, m), {});
  console.log(`[translation-check] ${dropped.length} pair(s) dropped — their English line is no longer on a photograph: `
    + Object.entries(byLang).map(([l, n]) => `${l} ${n}`).join(', '));
}

const bt = new Map(), cmp = new Map(), missing = [];
for (const b of batches) {
  for (const [suffix, map] of [['bt', bt], ['cmp', cmp]]) {
    const f = path.join(dir, `${b.batch}.${suffix}.json`);
    if (!existsSync(f)) { missing.push(`${b.batch}.${suffix}.json`); continue; }
    for (const r of rd(f)) map.set(r.k, r);
  }
}
if (missing.length) { console.error(`[translation-check] missing agent output: ${missing.join(', ')}`); process.exit(1); }
const unjudged = pairs.filter((p) => !bt.has(p.k) || !cmp.has(p.k)).map((p) => p.k);
if (unjudged.length) { console.error(`[translation-check] ${unjudged.length} pairs have no back-translation/verdict: ${unjudged.slice(0, 10).join(', ')}`); process.exit(1); }

// ---- Al's own Afrikaans (provenance shown on the row) ----
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().replace(/[‘’]/g, "'").toLowerCase();
const alAf = new Set();
{
  const lr = rd(path.join(root, 'review', 'al-line-rulings.json')).rulings.filter((r) => r.verdict === 'KEEP');
  for (const r of lr) { alAf.add(norm(r.af)); if (r.comment) alAf.add(norm(r.comment)); }
  for (const r of rd(path.join(root, 'review', 'al-pair-rulings.json')).rulings) if (r.verdict === 'YES') alAf.add(norm(r.af));
  for (const r of rd(path.join(root, 'review', 'meme-batch-2-rulings.json')).rulings) if (r.verdict === 'YES') for (const l of r.lines) alAf.add(norm(l.af));
  for (const d of rd(path.join(root, 'review', 'af-al-decisions.json')).decisions) alAf.add(norm(d.afrikaans));
}

// ---- wrong-source probe ----
const STOP = new Set('a an the and or but of to in on at for with by from is are was were be been it its it\'s this that these those there here you your you\'re we our they their he his she her i me my just so very not no too all any some one two up out off over into than then as if about only still even more most what when who which how why do does did have has had will would can could should may might get got go going gone like'.split(' '));
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).map((w) => w.replace(/'s$/, '').replace(/(ing|ed|es|s)$/, '')).filter((w) => w.length > 2 && !STOP.has(w)));
const overlap = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n += 1; return n / Math.min(A.size, B.size); };
const photoLines = new Map(); // slot key -> lines
for (const [k, lines] of Object.entries(HERO_LINES)) if (k.startsWith('bg/')) photoLines.set(k, lines);
const siblings = (p) => {
  const out = new Set();
  for (const r of p.refs) {
    if (r.kind === 'bespoke') for (const s of r.slots) for (const l of photoLines.get(s) || []) out.add(l);
    else {
      const [nsBin] = r.id.split('#'); const [ns, bin] = nsBin.split(':');
      const en = WEATHER_COPY[ns]?.[bin]?.en;
      if (Array.isArray(en)) for (const l of en) out.add(l);
    }
  }
  out.delete(p.en);
  return [...out];
};

// ---- merge ----
const rows = pairs.map((p) => {
  const b = bt.get(p.k), c = cmp.get(p.k), l = lc.get(p.k);
  const own = overlap(b.back, p.en);
  // On a MATCH the agent read the line against its own English and found it right, so the probe
  // alone only counts when the back-translation barely touches its own English (a paraphrase of
  // the right line scores high against a similar sibling and is not a wrong key).
  const agentMatch = String(c.verdict || '').toUpperCase() === 'MATCH';
  let wrong = null;
  for (const s of siblings(p)) {
    const sc = overlap(b.back, s);
    if (sc >= 0.5 && sc >= own + 0.34 && (!agentMatch || own < 0.25) && (!wrong || sc > wrong.score)) wrong = { en: s, score: +sc.toFixed(2) };
  }
  const bespoke = p.refs.find((r) => r.kind === 'bespoke');
  const bank = p.refs.filter((r) => r.kind === 'bank').map((r) => r.id);
  const bin = bank[0] ? bank[0].split(':')[1].split('#')[0] : null;
  const image = bespoke ? bespoke.slots[0].replace(/^bg\//, '')
    : bin && ['clear', 'cloudy', 'rain', 'wind', 'storm', 'cold', 'cold-clear', 'fog', 'heat'].includes(bin) ? `${bin}/week_1/day/1.webp`
    : bin === 'night' ? 'clear/week_1/night/1.webp' : bin === 'weekend' ? 'clear/week_1/day/6.webp'
    : bin === 'uv' ? 'clear/week_1/day/2.webp' : bin === 'thunder' || bin === 'hail' ? 'storm/week_1/day/1.webp'
    : bin === 'rain-possible' || bin === 'partly-cloudy' ? 'cloudy/week_1/day/1.webp' : null;
  const verdict = String(c.verdict || '').toUpperCase();
  const reasons = [];
  if (verdict === 'MISMATCH' || verdict === 'DRIFT') reasons.push(`${verdict}: ${c.reason || '(no reason given)'}`);
  if (wrong) reasons.push(`WRONG SOURCE? The back-translation is closer to another line of the same ${bespoke ? 'photograph' : 'bin'}: "${wrong.en}"`);
  return {
    k: p.k, lang: p.lang, en: p.en, text: p.text, back: b.back, note: b.note || '',
    verdict, reason: c.reason || '', wrongSource: wrong,
    lc: l ? { action: l.action, findings: (l.findings || []).filter((f) => f.severity !== 'low').map((f) => `${f.severity.toUpperCase()} ${f.check}: ${f.message}`).slice(0, 3) } : null,
    where: bespoke ? { kind: 'photo', slots: bespoke.slots.length, bank } : { kind: 'bank', bank },
    image, imageIsExample: !bespoke,
    alRuledAf: p.lang === 'af' ? alAf.has(norm(p.text)) : null,
    flagged: reasons.length > 0,
    severity: verdict === 'MISMATCH' ? 0 : wrong ? 1 : verdict === 'DRIFT' ? 2 : 3,
    reasons,
  };
});

// Seeded sample of 30 unflagged pairs, spread across languages in proportion (mulberry32, seed 20260919).
let seed = 20260919;
const rand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clean = rows.filter((r) => !r.flagged);
const sample = [];
const pool = clean.slice();
while (sample.length < 30 && pool.length) sample.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
for (const s of sample) s.sample = true;

const flagged = rows.filter((r) => r.flagged).sort((a, b) => a.severity - b.severity || a.lang.localeCompare(b.lang) || a.k.localeCompare(b.k));
const counts = {};
for (const r of rows) { const c = (counts[r.lang] ||= { pairs: 0, MATCH: 0, DRIFT: 0, MISMATCH: 0, wrongSource: 0, flagged: 0 }); c.pairs += 1; c[r.verdict] = (c[r.verdict] || 0) + 1; if (r.wrongSource) c.wrongSource += 1; if (r.flagged) c.flagged += 1; }
writeFileSync(path.join(root, 'review', 'translation-check-data.json'), JSON.stringify({
  generated: '2026-09-19', method: 'blind back-translation by fresh-context language agents (one per batch, English opened only after the back-translation was written), verdict MATCH/DRIFT/MISMATCH against the keyed English; wrong-source probe by word overlap against sibling lines; lang-check.mjs findings as corpus support',
  counts, flagged: flagged.length, sample: sample.map((s) => s.k), rows,
}, null, 1));

const LANG = { af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const view = (r) => ({ k: r.k, lang: r.lang, en: r.en, text: r.text, back: r.back, note: r.note, reasons: r.reasons, verdict: r.verdict, reason: r.reason, lc: r.lc, where: r.where, image: r.image, ex: r.imageIsExample, al: r.alRuledAf, sample: !!r.sample, severity: r.severity });
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Translation check</title>
<style>
:root { --bg:#f7f6f2; --fg:#1d1d1b; --muted:#6b6a64; --line:#dddbd2; --card:#fff; --accent:#1f5f8b; --keep:#2e7d4f; --fix:#b7791f; --cut:#a5452b; --pick:#e8f0f6; }
@media (prefers-color-scheme: dark) { :root { --bg:#161614; --fg:#ecebe6; --muted:#a3a29b; --line:#34332f; --card:#1f1f1c; --accent:#7fb6dd; --keep:#7ccf9c; --fix:#e0b35c; --cut:#e08a6e; --pick:#1d2a33; } }
* { box-sizing:border-box; }
body { margin:0; padding:18px 16px 96px; background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, sans-serif; }
main { max-width:1180px; margin:0 auto; }
h1 { font-size:1.4rem; margin:0 0 4px; } h2 { font-size:1.1rem; margin:26px 0 8px; }
.lede { color:var(--muted); margin:0 0 10px; max-width:92ch; font-size:.93rem; }
.stats { font-size:.85rem; color:var(--muted); margin:0 0 10px; }
.bar { position:sticky; top:0; z-index:5; background:var(--bg); display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); margin-bottom:12px; }
.bar button, .bar select { font:inherit; padding:6px 11px; border-radius:7px; border:1px solid var(--accent); background:var(--accent); color:#fff; cursor:pointer; }
.bar select { background:transparent; color:var(--fg); border-color:var(--line); }
.bar .count { font-weight:600; }
.row { display:grid; grid-template-columns:96px 1fr; gap:12px; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px; margin:0 0 10px; }
.row.KEEP { border-color:var(--keep); } .row.FIX { border-color:var(--fix); } .row.CUT { border-color:var(--cut); }
.row img { width:96px; height:170px; object-fit:cover; border-radius:6px; background:#333; }
.ex { font-size:.7rem; color:var(--muted); text-align:center; margin-top:2px; }
.l { font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:4px 0 0; }
.en { font-weight:600; } .tx { font-style:italic; } .bk { }
.why { margin:6px 0 0; padding-left:18px; font-size:.9rem; } .why li.sev0 { color:var(--cut); } .why li.sev1 { color:var(--fix); }
.meta { font-size:.78rem; color:var(--muted); margin-top:4px; }
.act { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; align-items:center; }
.act button { font:inherit; padding:5px 14px; border-radius:7px; border:1px solid var(--line); background:transparent; color:var(--fg); cursor:pointer; }
.act button.on.KEEP { background:var(--keep); color:#fff; border-color:var(--keep); }
.act button.on.FIX { background:var(--fix); color:#fff; border-color:var(--fix); }
.act button.on.CUT { background:var(--cut); color:#fff; border-color:var(--cut); }
textarea.fixnote { flex:1 1 260px; min-height:34px; font:inherit; font-size:.88rem; border:1px solid var(--line); border-radius:6px; padding:5px; background:transparent; color:inherit; }
#out { width:100%; min-height:80px; margin-top:10px; font:12px ui-monospace, monospace; }
@media (max-width:560px) { .row { grid-template-columns:70px 1fr; } .row img { width:70px; height:124px; } .bar { position:static; } }
</style>
</head>
<body>
<main>
<h1>Translation check: ${flagged.length} flagged of ${rows.length}</h1>
<p class="lede">I checked every live Afrikaans, isiZulu, isiXhosa and Sesotho line against the English it is keyed to.
A fresh language agent translated each line back to English <b>without seeing the English</b>, then compared its back-translation with the English and judged MATCH, DRIFT (something a reader would notice changed) or MISMATCH (says something else).
A second check flags a line whose back-translation reads closer to <i>another</i> line on the same photo or in the same bin, i.e. a line that may be keyed to the wrong English. Corpus notes from lang-check are shown where they exist.
Rule each row <b>KEEP</b> (fine as is), <b>FIX</b> (re-translate; add a note if you know what it should say) or <b>CUT</b> (remove it; the photo keeps its other lines and a bank slot falls back).
At the bottom, <b>30 lines the checker passed</b> are yours to test the checker with: rule them too.
Choices save in this browser. <b>Export</b> saves <code>translation-check-ruled.json</code> to Downloads.</p>
<p class="stats">${Object.entries(counts).map(([l, c]) => `${LANG[l]}: ${c.pairs} pairs · ${c.MISMATCH || 0} mismatch · ${c.DRIFT || 0} drift · ${c.wrongSource} wrong-source? · ${c.flagged} flagged`).join('<br>')}</p>
<div class="bar"><span class="count" id="count"></span>
<select id="lang"><option value="">all languages</option>${Object.entries(LANG).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
<select id="sev"><option value="">all flags</option><option value="0">mismatch</option><option value="1">wrong source?</option><option value="2">drift</option></select>
<label><input type="checkbox" id="open"> unruled only</label>
<button id="export">Export translation-check-ruled.json</button><button id="copy">Copy JSON</button></div>
<div id="list"></div>
<h2>Control sample: 30 lines the checker passed</h2>
<div id="sample"></div>
<textarea id="out" readonly placeholder="Exported JSON also appears here."></textarea>
</main>
<script>
const FLAGGED = ${JSON.stringify(flagged.map(view))};
const SAMPLE = ${JSON.stringify(sample.map(view))};
const LANG = ${JSON.stringify(LANG)};
const LS = 'pw_translation_check_v1';
let state = {};
try { state = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { state = {}; }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} };
const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function rowEl(r) {
  const st = state[r.k] || {};
  const el = document.createElement('section');
  el.className = 'row ' + (st.v || '');
  const where = r.where.kind === 'photo' ? 'photo line · ' + r.where.slots + ' slots' + (r.where.bank.length ? ' · also bank ' + r.where.bank.join(', ') : '') : 'bank ' + r.where.bank.join(', ');
  const prov = r.lang === 'af' ? (r.al ? ' · you ruled this Afrikaans before' : ' · Afrikaans never ruled by you') : '';
  el.innerHTML = '<div>' + (r.image ? '<img loading="lazy" src="../assets/images/bg/' + r.image + '" alt="">' + (r.ex ? '<div class="ex">bank line: example photo</div>' : '') : '') + '</div>'
    + '<div><div class="l">English source</div><div class="en">' + esc(r.en) + '</div>'
    + '<div class="l">' + LANG[r.lang] + '</div><div class="tx">' + esc(r.text) + '</div>'
    + '<div class="l">Back-translation (blind)</div><div class="bk">' + esc(r.back) + (r.note ? ' <span class="meta">(' + esc(r.note) + ')</span>' : '') + '</div>'
    + (r.sample ? '<ul class="why"><li>Checker: ' + esc(r.verdict) + (r.reason ? ', ' + esc(r.reason) : '') + '</li></ul>'
      : '<ul class="why">' + r.reasons.map(x => '<li class="sev' + (x.startsWith('MISMATCH') ? 0 : x.startsWith('WRONG') ? 1 : 2) + '">' + esc(x) + '</li>').join('') + '</ul>')
    + (r.lc && r.lc.findings.length ? '<div class="meta">lang-check ' + esc(r.lc.action) + ': ' + r.lc.findings.map(esc).join(' · ') + '</div>' : '')
    + '<div class="meta">' + esc(r.k) + ' · ' + esc(where) + prov + '</div>'
    + '<div class="act">' + ['KEEP','FIX','CUT'].map(v => '<button class="' + v + (st.v === v ? ' on' : '') + '">' + v + '</button>').join('')
    + '<textarea class="fixnote" placeholder="note (what it should say / why)">' + esc(st.note || '') + '</textarea></div></div>';
  el.querySelectorAll('.act button').forEach(b => b.addEventListener('click', () => { state[r.k] = { ...(state[r.k] || {}), v: b.textContent }; save(); el.className = 'row ' + b.textContent; el.querySelectorAll('.act button').forEach(x => x.classList.toggle('on', x === b)); count(); }));
  el.querySelector('textarea').addEventListener('input', (e) => { state[r.k] = { ...(state[r.k] || {}), note: e.target.value }; save(); });
  return el;
}
function count() {
  const all = FLAGGED.concat(SAMPLE);
  document.getElementById('count').textContent = all.filter(r => state[r.k] && state[r.k].v).length + ' of ' + all.length + ' ruled';
}
function render() {
  const lang = document.getElementById('lang').value, sev = document.getElementById('sev').value, open = document.getElementById('open').checked;
  const keep = (r) => (!lang || r.lang === lang) && (!open || !(state[r.k] && state[r.k].v));
  const list = document.getElementById('list'); list.innerHTML = '';
  for (const r of FLAGGED) if (keep(r) && (sev === '' || String(r.severity) === sev)) list.appendChild(rowEl(r));
  const sm = document.getElementById('sample'); sm.innerHTML = '';
  for (const r of SAMPLE) if (keep(r)) sm.appendChild(rowEl(r));
  count();
}
function exportJson() {
  const pick = (r, group) => ({ k: r.k, group, lang: r.lang, en: r.en, text: r.text, back: r.back, checker: r.verdict, flags: r.reasons, verdict: (state[r.k] || {}).v || null, note: (state[r.k] || {}).note || '' });
  const rulings = FLAGGED.map(r => pick(r, 'flagged')).concat(SAMPLE.map(r => pick(r, 'sample')));
  return JSON.stringify({ generated: new Date().toISOString(), ruledBy: 'Al, translation check page (review/translation-check.html)', ruled: rulings.filter(r => r.verdict).length, total: rulings.length, rulings }, null, 1);
}
['lang','sev','open'].forEach(id => document.getElementById(id).addEventListener('change', render));
document.getElementById('export').addEventListener('click', () => { const j = exportJson(); document.getElementById('out').value = j; try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'translation-check-ruled.json'; a.click(); } catch (e) {} });
document.getElementById('copy').addEventListener('click', () => { const j = exportJson(); document.getElementById('out').value = j; try { navigator.clipboard.writeText(j).catch(() => {}); } catch (e) {} });
render();
</script>
</body>
</html>
`;
writeFileSync(path.join(root, 'review', 'translation-check.html'), html);
console.log(`[translation-check] ${rows.length} pairs, ${flagged.length} flagged, ${sample.length} in the control sample`);
for (const [l, c] of Object.entries(counts)) console.log(`  ${l}: ${JSON.stringify(c)}`);
