# Reroll wave 1 — final ledger (2026-07-18)

Wave 1 is **closed**. This is the standing image-slot ledger after Phase 4.

## (a) Carried forward (pre-wave, unchanged)
- **154 flagged**
- **9 soft-flag drafts**
- **30 un-hold slots awaiting native batches**

## (b) Reroll wave 1 outcome
- **15 approved → wired** into serving (14 off-peak lossless week-demotes + 1 lossless day-into-duplicate, `storm-day-2`). Manifest 629 → 644 unique bodies. URL version `20260717-p1` → `20260718-p1`.
- **4 approved → day-swap VETOED by owner (2026-07-18), banked as spares** (owner preferred the original daytime images): `rain-day-4`, `cloudy-day-2`, `cold-day-4`, `cold-day-10`. Original day slots restored from `f68b146`; candidates kept in `review/reroll-spares/` (see `review/reroll-spares.json`) — not deleted. No serving change for these 4 bins.
- **17 NEITHER → CLOSED BY OWNER, no reroll, ever** (owner decision 2026-07-18 — this wave is over, "we have enough images"). Logged verbatim in `review/reroll-closed-slots.json`. **0 residual rerolls** — the owner closed them, so nothing carries to a residual reroll ledger.
- 36 original rejects removed from the bench (`review/reroll-bench.json` emptied).

## (c) Nothing else.

---
The 17 closed slots (verbatim reasons in `reroll-closed-slots.json`): storm-day-1, storm-dusk-2, clear-day-2, clear-day-8, rain-dawn-4, rain-night-4, cloudy-day-3, cloudy-dusk-5, cloudy-dusk-7, cloudy-night-1, cold-dawn-6, cold-day-3, cold-day-8, cold-dusk-4, cold-night-4, cold-night-8, cold-clear-day-12.
