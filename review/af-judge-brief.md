# AFRIKAANS HUMOUR JUDGE — brief (identical for both judges)

Judge independently. Do not read, look for, or reference any other judge's verdicts or file.

## Inputs
- `review/af-judge-rows.json` — `canon`: 350 rows (English + native-approved Afrikaans; this is the voice). `blue`: 533 rows (English + drafted Afrikaans to judge). Every row carries `condition` and `time` (dawn/day/dusk/night).
- Voice references: `lang-packs/af/PACK.md`, `lang-packs/af/lexicon-protected.md`, `lang-packs/af/errors-observed.md`, `.claude/skills/af-qc/SKILL.md`.
- Brand: in Afrikaans the app says **Waarskynlik**, never "Probably".
- Weekend braai rule: a braai reference is allowed only if the English line itself carries it; never add one.

## Phase 1 — the voice
From the 350 canon lines only, extract the Afrikaans voice: at most ten rules, each with one quoted canon example. Then five anti-patterns, each with an invented failing line: (1) Anglicisms and calques, (2) English word order in Afrikaans clothing, (3) dictionary words nobody says, (4) jokes that only work in English, (5) forced slang.

## Phase 2 — the 533 blue rows
For each row: verdict `KEEP` / `FIX` / `KILL`; score 1–5 (5 = canon-grade); reason ≤ 12 words citing a rule number (`R3`) or anti-pattern (`A2`). For `FIX` and `KILL` propose a line: same joke, same length budget (±20 % characters), natural spoken Afrikaans in Al's register. Kill anything that reads like a translation or that lost the joke on the way over. KEEP needs no proposal.

Run the corpus-backed checker on every proposed line:
`node scripts/lang-check.mjs --file <proposals.json> --json` with input objects `{ "lang": "af", "en": "<english>", "text": "<proposed>" }`. Record per row `lang_check_result: { action, confidence, findings: [non-low messages] }`. A proposal that comes back `triage-high` is revised once; if still `triage-high`, keep the proposal but say so in the reason.

## Output
One file, `review/af-judge-<judge>.json`:
```
{ "judge": "<name>",
  "phase1": { "rules": [{ "n": 1, "rule": "...", "canon_example": "..." }], "anti_patterns": [{ "name": "...", "invented_failure": "..." }] },
  "rows": [{ "id": "B001", "english": "...", "drafted": "...", "verdict": "KEEP|FIX|KILL", "score": 1-5, "reason": "...", "proposed_line": "..." | null, "lang_check_result": {...} | null }],
  "counts": { "KEEP": n, "FIX": n, "KILL": n },
  "worst_recurring_failures": ["...", "...", "..."] }
```
All 533 rows, ids unchanged, drafted text copied verbatim. Write nothing else.
