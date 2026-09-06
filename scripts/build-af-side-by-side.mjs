// Builds review/af-side-by-side.html — every bespoke line, English beside Afrikaans, for
// Al's spot-check before zu/xh/st are started (his gate, 2026-09-06).
//
// Grouped by condition, newly transcreated lines first and marked, reused bank lines after
// and marked as already native-reviewed, because the two carry different risk: the 533 new
// ones are this run's work, the 350 reused have shipped and been read before.
//
// Tick = the Afrikaans is right. Cross = it is not, and the box takes his rewrite. Nothing
// is wired until this sheet comes back.
//
//   node scripts/build-af-side-by-side.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const work = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/af-worklist.json'), 'utf8'));
const qc = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/af-qc-report.json'), 'utf8'));
const flaggedBy = new Map(qc.flagged.map((f) => [f.en, f.flags]));

const af = new Map();
for (const b of [1, 2, 3, 4]) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, `review/af-batch-${b}.json`), 'utf8'));
  for (const [en, val] of doc.pairs) af.set(en, val);
}

const rows = [];
for (const e of work.fresh) {
  rows.push({ en: e.text, af: af.get(e.text) || '', condition: e.condition, time: e.time, source: 'new', flags: flaggedBy.get(e.text) || [] });
}
for (const e of work.reuse) {
  rows.push({ en: e.text, af: e.af, condition: e.condition, time: e.time, source: 'bank', flags: flaggedBy.get(e.text) || [] });
}
const CONDITIONS = ['clear', 'cloudy', 'wind', 'heat', 'cold', 'cold-clear', 'fog', 'rain', 'storm'];
rows.sort((a, b) => CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition)
  || (a.source === b.source ? 0 : a.source === 'new' ? -1 : 1)
  || a.time.localeCompare(b.time));

const counts = {};
for (const r of rows) {
  counts[r.condition] = counts[r.condition] || { new: 0, bank: 0 };
  counts[r.condition][r.source] += 1;
}

const DATA = JSON.stringify({ rows, conditions: CONDITIONS, counts });

const html = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PW — EN / AF side by side</title>
<style>
  :root { --bg:#14110d; --panel:#1f1a14; --ink:#fffaf3; --ink2:#b5ab9d; --gold:#ffd700; --yes:#63c98a; --no:#ff6b6b; --new:#8fb7ff; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(20,17,13,.97); border-bottom:1px solid rgba(246,242,232,.14);
           padding:9px 14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:14px; margin:0; white-space:nowrap; }
  .tabs { display:flex; gap:4px; flex-wrap:wrap; }
  .tab { border:1px solid rgba(246,242,232,.18); background:none; color:var(--ink2); border-radius:999px;
         padding:3px 10px; font:inherit; font-size:11.5px; cursor:pointer; }
  .tab.on { color:#fff; background:#2b2118; border-color:var(--gold); }
  button.act { font:inherit; font-size:12px; border:1px solid rgba(246,242,232,.18); background:var(--panel);
               color:var(--ink); border-radius:7px; padding:5px 10px; cursor:pointer; }
  button.pri { background:var(--gold); color:#1a1a2e; border-color:var(--gold); font-weight:700; }
  .tally { color:var(--ink2); font-size:12px; font-variant-numeric:tabular-nums; }
  .spacer { flex:1; }
  .hint { color:var(--ink2); font-size:12.5px; padding:10px 16px 0; margin:0; max-width:110ch; }
  main { padding:14px 16px 70px; }
  table { border-collapse:collapse; width:100%; }
  th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink2);
       border-bottom:1px solid rgba(246,242,232,.16); padding:8px 10px; position:sticky; top:44px; background:var(--bg); }
  td { border-bottom:1px solid rgba(246,242,232,.07); padding:9px 10px; vertical-align:top; }
  tr.on-yes td { background:rgba(99,201,138,.08); }
  tr.on-no td { background:rgba(255,107,107,.08); }
  .meta { color:var(--ink2); font-size:11px; white-space:nowrap; }
  .badge { font-size:10px; letter-spacing:.05em; text-transform:uppercase; border-radius:4px; padding:1px 5px; border:1px solid; }
  .badge.new { color:var(--new); border-color:#8fb7ff55; }
  .badge.bank { color:var(--ink2); border-color:rgba(246,242,232,.2); }
  .flag { color:#e0a94d; font-size:11px; display:block; margin-top:3px; }
  textarea { width:100%; font:inherit; background:#181410; color:var(--ink); resize:vertical; min-height:44px;
             border:1px solid rgba(246,242,232,.16); border-radius:6px; padding:6px 8px; }
  textarea:focus { outline:none; border-color:var(--gold); }
  .btns { display:flex; gap:5px; }
  .y.on { border-color:var(--yes); color:var(--yes); font-weight:700; }
  .n.on { border-color:var(--no); color:var(--no); font-weight:700; }
</style>

<header>
  <h1>EN / AF — 883 bespoke lines</h1>
  <div class="tabs" id="tabs"></div>
  <span class="spacer"></span>
  <span class="tally" id="tally"></span>
  <button class="act pri" id="export">Export</button>
</header>
<p class="hint">✓ means the Afrikaans is right. ✕ means it is not — type the fix in the box and it exports as your wording. Blue <b>new</b> is this run's transcreation; grey <b>bank</b> is existing copy that has already been through native review. Untouched rows export as unruled, not approved.</p>
<main><table><thead><tr>
  <th style="width:70px">#</th><th style="width:40%">English</th><th>Afrikaans</th><th style="width:96px">Verdict</th>
</tr></thead><tbody id="body"></tbody></table></main>

<script>
const DATA = ${DATA};
const LS = 'pw_af_side_by_side';
const state = JSON.parse(localStorage.getItem(LS) || '{}');
const $ = (id) => document.getElementById(id);
let cond = 'all';

const visible = () => cond === 'all' ? DATA.rows : DATA.rows.filter((r) => r.condition === cond);

function save() { localStorage.setItem(LS, JSON.stringify(state)); tally(); }

function tally() {
  let yes = 0, no = 0, edited = 0;
  for (const r of DATA.rows) {
    const s = state[r.en];
    if (!s) continue;
    if (s.verdict === 'YES') yes += 1;
    if (s.verdict === 'NO') no += 1;
    if (s.text && s.text !== r.af) edited += 1;
  }
  $('tally').textContent = yes + ' ok · ' + no + ' rejected · ' + edited + ' rewritten · '
    + (DATA.rows.length - yes - no) + ' untouched';
}

function renderTabs() {
  const t = $('tabs');
  t.innerHTML = '';
  const mk = (id, label, n) => {
    const b = document.createElement('button');
    b.className = 'tab' + (cond === id ? ' on' : '');
    b.textContent = label + ' ' + n;
    b.onclick = () => { cond = id; render(); };
    t.appendChild(b);
  };
  mk('all', 'all', DATA.rows.length);
  for (const c of DATA.conditions) {
    const n = (DATA.counts[c] || {});
    mk(c, c, (n.new || 0) + (n.bank || 0));
  }
}

function render() {
  renderTabs();
  const body = $('body');
  body.innerHTML = '';
  visible().forEach((r, i) => {
    const s = state[r.en] || {};
    const tr = document.createElement('tr');
    if (s.verdict === 'YES') tr.className = 'on-yes';
    if (s.verdict === 'NO') tr.className = 'on-no';

    const num = document.createElement('td');
    num.className = 'meta';
    const badge = document.createElement('span');
    badge.className = 'badge ' + r.source;
    badge.textContent = r.source;
    num.append(String(i + 1), document.createElement('br'), badge);
    tr.appendChild(num);

    const en = document.createElement('td');
    en.textContent = r.en;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = ' · ' + r.condition + '/' + r.time;
    en.appendChild(meta);
    tr.appendChild(en);

    const afCell = document.createElement('td');
    const ta = document.createElement('textarea');
    ta.value = s.text != null ? s.text : r.af;
    ta.addEventListener('input', () => {
      state[r.en] = Object.assign({}, state[r.en], { text: ta.value });
      save();
    });
    afCell.appendChild(ta);
    if (r.flags.length) {
      const f = document.createElement('span');
      f.className = 'flag';
      f.textContent = 'af-qc: ' + r.flags.join(', ');
      afCell.appendChild(f);
    }
    tr.appendChild(afCell);

    const v = document.createElement('td');
    const btns = document.createElement('div');
    btns.className = 'btns';
    const yes = document.createElement('button');
    yes.className = 'act y' + (s.verdict === 'YES' ? ' on' : '');
    yes.textContent = '✓';
    yes.onclick = () => {
      state[r.en] = Object.assign({}, state[r.en], { text: ta.value, verdict: s.verdict === 'YES' ? null : 'YES' });
      save(); render();
    };
    const no = document.createElement('button');
    no.className = 'act n' + (s.verdict === 'NO' ? ' on' : '');
    no.textContent = '✕';
    no.onclick = () => {
      state[r.en] = Object.assign({}, state[r.en], { text: ta.value, verdict: s.verdict === 'NO' ? null : 'NO' });
      save(); render();
    };
    btns.append(yes, no);
    v.appendChild(btns);
    tr.appendChild(v);

    body.appendChild(tr);
  });
  tally();
}

$('export').onclick = () => {
  const approved = [], rejected = [], untouched = [];
  for (const r of DATA.rows) {
    const s = state[r.en] || {};
    const text = s.text != null ? s.text : r.af;
    const entry = { en: r.en, af: text, condition: r.condition, source: r.source, edited: text !== r.af };
    if (s.verdict === 'YES') approved.push(entry);
    else if (s.verdict === 'NO') rejected.push(entry);
    else untouched.push(entry);
  }
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    ruledBy: 'Al, EN/AF side-by-side spot-check',
    note: 'Untouched rows are unruled, not approved. Only the approved list may be wired.',
    total: DATA.rows.length,
    approvedCount: approved.length, rejectedCount: rejected.length, untouchedCount: untouched.length,
    approved, rejected, untouched,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'af-side-by-side-ruled.json';
  a.click();
};

render();
</script>
`;

fs.writeFileSync(path.join(ROOT, 'review/af-side-by-side.html'), html);
console.log(`[af sheet] review/af-side-by-side.html — ${rows.length} lines (${work.freshCount} new, ${work.reuseCount} bank)`);
console.log(`  by condition: ${JSON.stringify(counts)}`);
