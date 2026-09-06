// The four pre-rebuild QC skills' `check()` procedures, as code, so they can be scored against
// the gold set. This is the baseline the corpus-backed checker has to beat. Each function follows
// the steps written in .claude/skills/<lang>-qc/SKILL.md as of commit 5b952ff; af-qc is the
// mechanical implementation that actually ran (scripts/af-qc-check.mjs) minus its 'no-terminator'
// rule for items whose English source is itself not a sentence.
//
// Returns { flagged: boolean, confidence: 0-1, flags: [] } — flagged when any flag reaches 0.5.

const ACRONYMS = new Set(['UV', 'Temp', 'OK', 'km/h', 'mm', 'SA', 'N1', 'N2']);

function crossLanguage(value, siblings, lang) {
  const flags = [];
  if (!siblings || !value) return flags;
  const v = value.trim();
  if (!v || ACRONYMS.has(v)) return flags;
  for (const [other, ov] of Object.entries(siblings)) {
    if (other === lang || !ov) continue;
    if (ov.trim() !== v) continue;
    const nguni = (lang === 'zu' && other === 'xh') || (lang === 'xh' && other === 'zu');
    if (nguni) flags.push({ flag: `matches-${other} (Nguni cognate)`, confidence: 0.3 });
    else if (lang === 'st') flags.push({ flag: `matches-${other}`, confidence: 0.85 });
    else if (lang === 'af' && other === 'en' && /^(Wind|Week|Sat|Son|Temp|UV|Later|in)$/.test(v)) continue;
    else flags.push({ flag: `matches-${other}`, confidence: lang === 'af' ? 0.6 : 0.8 });
  }
  return flags;
}

const NGUNI_PREFIX = /^(u|um|umu|i|in|im|isi|is|ili|aba|ab|ama|am|izi|iz|izin|izim|ulu|ubu|uku|o|oo|iin|ii)/i;
const SOTHO_PREFIX = /^(mo|ba|bo|le|ma|se|di|li|ho|n|m)/i;

export function checkZuXh(value, en, siblings, lang) {
  const flags = crossLanguage(value, siblings, lang);
  const v = (value || '').trim();
  if (!v) return { flagged: true, confidence: 1, flags: [{ flag: 'empty', confidence: 1 }] };
  // Step 3: class prefix on a noun-meaning single-word label
  if (!/\s/.test(v) && en && !/\s/.test(en.trim()) && /^[A-Z]/.test(en.trim()) && !NGUNI_PREFIX.test(v) && !ACRONYMS.has(v)) {
    flags.push({ flag: 'missing-class-prefix', confidence: 0.5 });
  }
  // Step 5: orthography — no diacritics in Nguni
  if (/[éëïêôûáàäöü]/i.test(v)) flags.push({ flag: 'diacritic-not-nguni', confidence: 0.7 });
  const confidence = Math.max(0, ...flags.map((f) => f.confidence));
  return { flagged: confidence >= 0.5, confidence, flags };
}

export function checkSt(value, en, siblings) {
  const flags = crossLanguage(value, siblings, 'st');
  const v = (value || '').trim();
  if (!v) return { flagged: true, confidence: 1, flags: [{ flag: 'empty', confidence: 1 }] };
  if (!/\s/.test(v) && en && !/\s/.test(en.trim()) && /^[A-Z]/.test(en.trim()) && !SOTHO_PREFIX.test(v) && !ACRONYMS.has(v)) {
    flags.push({ flag: 'missing-class-prefix', confidence: 0.5 });
  }
  // Step 3: click digraphs in click positions suggest a Nguni source
  if (/(^|[\s-])[qcx][a-z]|n[qcx][a-z]|g[qcx][a-z]/i.test(v)) flags.push({ flag: 'click-consonant', confidence: 0.6 });
  const confidence = Math.max(0, ...flags.map((f) => f.confidence));
  return { flagged: confidence >= 0.5, confidence, flags };
}

// af-qc as run in scripts/af-qc-check.mjs (commit 5b952ff)
const SHARED = new Set(['Weber', 'Karoo', 'Bo-Kaap', 'Gqeberha', 'Helderberg', 'NZ', 'Joburg']);
const ENGLISH_TELLS = /\b(the|and|with|that|this|there|which|because|about|from|they|their|would|could|should|been|were|what|when|where|still|just|only|every|nobody|somebody|anything|something)\b/i;
const PROPER = /^(Kaapse|Kaapstad|Kaap|Kapenaars|Tafelberg|Leeukop|Seinheuwel|Suiderkruis|Melkweg|Noord|Suid|Afrika|Afrikaans|Afrikaanse|Hoëveld|Hoëveldse|Vrystaat|Vrystaatse|Karoo|Joburg|Joburgse|Upington|Sani|Pass|Hill|Silent|Eskom|Instagram|Lotto|Spur|Toyota|Tupperware|Weber|Noag|Rugby|WB|NZ|Gqeberha|Helderberg|Dokter)$/;
const CALENDAR = /^(Maandag|Dinsdag|Woensdag|Donderdag|Vrydag|Saterdag|Sondag)(e|s)?$|^(Maan|Dins|Woens|Donder|Vry|Sater|Son)dae$|^(Januarie|Februarie|Maart|April|Mei|Junie|Julie|Augustus|September|Oktober|November|Desember)$|^Sondagklere$/;
const DIACRITIC_TRAPS = [[/\bwereld\b/i, 'wêreld'], [/\bmore\b(?!\s*(as|of))/i, 'môre'], [/\bse\b(?=\s*:)/i, 'sê'], [/\bhe\b/i, 'hê'], [/\boe\b/i, 'oë']];

export function checkAf(value, en, siblings) {
  const flags = [];
  const v = (value || '').trim();
  if (!v) return { flagged: true, confidence: 1, flags: [{ flag: 'empty', confidence: 1 }] };
  if (en && v === en.trim() && !/^(Wind|Week|Sat|Son|Temp|UV|Later|in)$/.test(v)) flags.push({ flag: 'identical-to-english', confidence: 0.6 });
  if (en) {
    const ratio = v.length / Math.max(1, en.length);
    if (ratio < 0.5 && en.length > 12) flags.push({ flag: 'suspiciously-short', confidence: 0.5 });
    if (ratio > 2.0 && en.length > 12) flags.push({ flag: 'suspiciously-long', confidence: 0.5 });
  }
  let probe = v;
  for (const s of SHARED) probe = probe.split(s).join(' ');
  if (ENGLISH_TELLS.test(probe)) flags.push({ flag: 'english-word-left-in', confidence: 0.6 });
  const unexplained = [];
  const re = /\b[A-Z][a-zêôîûë]{2,}/g;
  let m;
  while ((m = re.exec(v)) !== null) {
    const word = m[0];
    const before = v.slice(0, m.index);
    const atStart = m.index === 0 || /[.!?:—-]\s*["'‘“]?\s*$/.test(before) || /["'‘“]\s*$/.test(before) || /(^|\s)['’]n\s+$/.test(before);
    if (atStart || SHARED.has(word) || PROPER.test(word) || CALENDAR.test(word)) continue;
    unexplained.push(word);
  }
  if (unexplained.length) flags.push({ flag: `unexplained-capital:${unexplained.join(',')}`, confidence: 0.5 });
  for (const [trap, fix] of DIACRITIC_TRAPS) if (trap.test(v)) flags.push({ flag: `missing-diacritic:${fix}`, confidence: 0.8 });
  if (/\s{2,}/.test(v)) flags.push({ flag: 'double-space', confidence: 0.5 });
  if (en && /[.!?]$/.test(en.trim()) && !/[.!?…]$/.test(v)) flags.push({ flag: 'no-terminator', confidence: 0.5 });
  const dq = (v.match(/"/g) || []).length;
  if (dq % 2) flags.push({ flag: 'unbalanced-quote', confidence: 0.5 });
  flags.push(...crossLanguage(v, siblings, 'af').filter((f) => f.flag !== 'matches-en'));
  const confidence = Math.max(0, ...flags.map((f) => f.confidence));
  return { flagged: confidence >= 0.5, confidence, flags };
}

export function baselineCheck(item) {
  const { lang, text, en, siblings } = item;
  if (lang === 'af') return checkAf(text, en, siblings);
  if (lang === 'st') return checkSt(text, en, siblings);
  return checkZuXh(text, en, siblings, lang);
}
