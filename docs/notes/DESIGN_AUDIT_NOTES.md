# DESIGN_AUDIT_NOTES.md

SA6 — Probably Weather pre-tester audit Phase 1, design lane.
Branch: `feat/pre-tester-6-design`.

## What this PR contains

1. **`DESIGN.md`** — frontend-design skill compatible, Stitch-inspired spec for the shipped UI. Codifies brand, anti-slop guardrails (explicit), typography scale, colour, photographic background system, spacing/radii/motion principles, voice, and component patterns. Preamble states PW's distinctive voice takes precedence over generic best-practice.

2. **Low-risk polish applied** in `assets/app.css`:
   - **Focus-visible radius conflict fixed** — the global `focus-visible` rule was forcing `border-radius: 4px` on every focused element, which flattened pill buttons (`border-radius: 999px`) into 4px rectangles whenever they took focus. Removed the forced radius; the outline now follows each element's own radius. Comment added explaining the call.
   - **`.recent-item::before` bullet contrast** — was hardcoded `color: #111` on a translucent glass list (invisible). Switched to `currentColor` at `opacity: 0.6` so the bullet inherits the weather-state body colour.

3. **`DESIGN_AUDIT_FINDINGS.md`** — every non-low-risk drift item, categorised P0 / P1 / P2 with file:line references and fix sketches. See that file for full list. Summary: 2 P0, 8 P1 (one fixed in this PR), 7 P2 = 17 total drift items.

## What this PR does NOT contain

- No layout changes.
- No copy / translation changes (SA5 lane).
- No service-worker bump (visual polish doesn't need cache invalidation).
- No a11y-specific changes beyond the focus-visible radius bug — SA4 owns contrast adjudication for the Hi/Lo colours and the focus halo on dark photos (logged as P1).
- No design-token introduction (logged as P2-1 for a future refactor PR).

## Method

- Read `index.html` (381 lines) and `assets/app.css` (3088 lines) in full / scanned.
- Spot-read `assets/app.js` render paths via grep (description, screen title, language picker writers).
- Ran the `frontend-design` skill against the brief; applied its principles manually (Playwright/screenshots not used in this lane — code-level audit only).
- Anti-slop check: confirmed PW already avoids Inter, purple gradients, three-card AI-dashboard layouts, and chatbot UI. The brand's photographic spine and Ja-Nee-Miskien voice are intact.

## Files changed

- `DESIGN.md` (new, ~430 lines / ~3.0k words)
- `DESIGN_AUDIT_FINDINGS.md` (new)
- `DESIGN_AUDIT_NOTES.md` (new — this file)
- `assets/app.css` (2 edits: focus-visible block, `.recent-item::before`)

## Open questions for the merge reviewer

- Should P0-1 (settings panel surface) be batched into a follow-up "settings glass-up" PR before tester rollout? Recommend: yes, but as a separate visual change with screenshots.
- Should DESIGN.md's `--radius-large: 20px` be added as a fifth radius token, or should existing 20px elements move to 16px? Codebase currently splits; spec needs a casting vote.
