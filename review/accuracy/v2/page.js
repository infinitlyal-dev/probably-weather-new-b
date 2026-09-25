// House pattern (review/launch-run-for-al.html): marks live in this browser only; Export writes
// precision-ruled.json to Downloads for the next session to read. QUESTIONS is injected by make-page.mjs.
var KEY = 'pw-precision-for-al-2026-09-25';
var state = {}; try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
state.q = state.q || {};
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} count(); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var box = document.getElementById('questions');
if (box) box.innerHTML = QUESTIONS.map(function (q) {
  return '<div class="row" data-row="q" data-k="' + esc(q.key) + '"><div>' + esc(q.text) + '</div><div class="act">' +
    q.options.map(function (o) { return '<button type="button" data-k="' + esc(q.key) + '" data-v="' + esc(o[0]) + '" class="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') +
    '</div><textarea data-note="q" data-k="' + esc(q.key) + '" placeholder="Note (optional)"></textarea></div>';
}).join('');
function paint() {
  document.querySelectorAll('.act button').forEach(function (b) { var cur = (state.q[b.dataset.k] || {}).verdict; b.classList.toggle('on', cur === b.dataset.v); });
  document.querySelectorAll('[data-row]').forEach(function (r) { var v = (state.q[r.dataset.k] || {}).verdict; r.className = 'row' + (v ? ' ' + v : ''); });
  document.querySelectorAll('textarea[data-note]').forEach(function (t) { t.value = (state.q[t.dataset.k] || {}).note || ''; });
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('.act button'); if (!b) return;
  var o = state.q[b.dataset.k] = state.q[b.dataset.k] || {};
  o.verdict = o.verdict === b.dataset.v ? null : b.dataset.v; save(); paint();
});
document.addEventListener('input', function (e) {
  var t = e.target; if (!t.matches('textarea[data-note]')) return;
  var o = state.q[t.dataset.k] = state.q[t.dataset.k] || {}; o.note = t.value; save();
});
function count() {
  var n = QUESTIONS.filter(function (q) { return (state.q[q.key] || {}).verdict; }).length;
  var el = document.getElementById('count'); if (el) el.textContent = QUESTIONS.length ? n + ' of ' + QUESTIONS.length + ' marked' : 'Nothing to mark — read only';
}
function exportJson() {
  return JSON.stringify({ generated: new Date().toISOString(), ruledBy: 'Al, precision page (review/precision-for-al.html)',
    questions: QUESTIONS.map(function (q) { var o = state.q[q.key] || {}; return { key: q.key, question: q.text, verdict: o.verdict || null, note: o.note || '' }; }) }, null, 1);
}
document.getElementById('export').addEventListener('click', function () {
  var j = exportJson(), out = document.getElementById('out'); out.style.display = 'block'; out.value = j;
  try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'precision-ruled.json'; a.click(); } catch (e) {}
});
document.getElementById('copy').addEventListener('click', function () {
  var j = exportJson(), out = document.getElementById('out'); out.style.display = 'block'; out.value = j; out.select();
  try { navigator.clipboard.writeText(j); } catch (e) { try { document.execCommand('copy'); } catch (e2) {} }
});
var z = document.getElementById('zoom');
document.addEventListener('click', function (e) { var i = e.target.closest('img.zoomable'); if (i) { z.querySelector('img').src = i.src; z.style.display = 'flex'; } });
z.addEventListener('click', function () { z.style.display = 'none'; });
paint(); count();
