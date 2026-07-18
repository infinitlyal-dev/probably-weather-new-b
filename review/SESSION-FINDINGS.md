# Session findings — 2026-07-18 closing session (logged, not fixed)

Per the "NO scope additions — new findings get LOGGED" rule. None of these block the
committed work; each is Al's call to action later.

## 1. Tzaneen falls outside the lowveld box (coverage gap, not mis-tag)
`lowveld` box minLon is 30.5, but Tzaneen (Limpopo lowveld) is at lon ~30.16 → it gets
**no** region tag. Not a mis-tag (no wrong region fires there), just a gap: a Lowveld-named
line won't serve in Tzaneen. Fix if wanted: widen `lowveld.minLon` to ~30.0 in
`assets/geo-regions.js` (check it doesn't pull in Polokwane/Highveld towns first). Named
test cities (Nelspruit/Hoedspruit/Phalaborwa) are all covered.

## 2. Border-town double-tags (informational, acceptable)
New boxes overlap the existing province/climate boxes at genuine border towns, so some
resolve to two regions: Kokstad→kzn+eastern-cape, Harrismith→free-state+kzn, Aliwal
North→free-state+eastern-cape, Graaff-Reinet→karoo+eastern-cape. The tag system allows
multiple matches; worst case a region-named line serves one adjacent-province border town.
Left as-is (tightening the boxes to be mutually exclusive would be more fragile than the
gain). Named targets each resolve to exactly one region.

## 3. verify-lines.mjs — completeness gap on non-audit bins (low severity)
`review/tools/verify-lines.mjs` reconciles (a) audit-line indices and (b) every manifested
key (three-way bank↔manifest↔draft↔verdict). It does NOT independently enumerate the bank,
so a silent fill of a non-manifested slot in a bin outside `audit.conditions`
(`partly-cloudy` / `witty_low_confidence`) would pass unseen. NOT reachable via the apply
(which writes bank+manifest together) and the `witty-empty-slot-safety` test pins those
bins' residual empties — so shipped data is clean. Header comment corrected to stop
overclaiming. A full close needs a reverse pass with a pre-batch baseline (else it
false-positives on the many legitimate pre-existing non-manifested fills).

## 4. CSP: install-page QR uses an external image (enforce-flip blocker)
`assets/install.js` renders `<img src="https://api.qrserver.com/…">` (desktop "open on
phone" flow). The strict `img-src 'self' data: blob:` reports/blocks it. Shipped as
Report-Only so nothing breaks. Before flipping to enforce, decide: allowlist
`api.qrserver.com` in `img-src`, or self-host the QR. Full checklist in `review/CSP-NOTES.md`.

## 5. generate-review-batch.mjs doesn't surface flag_reason (soft)
The 154 FLAG debt entries carry Sol's `flag_reason`, but `scripts/generate-review-batch.mjs`
emits only EN+AF+provisional draft to the native reviewer — the reviewer doesn't see WHY
Sol flagged the line. Consider printing `flag_reason` on flagged rows so the native has the
context. Out of scope this session.

## 6. Two heavy tests flake under full parallel load (infra, pre-existing)
`tests/client-bundle.test.js` (P6 bundle) and the 1.36M-iteration grid in
`tests/witty-day-tags.test.js` (15s `it` budget) intermittently time out when all 81 test
files run in parallel (CPU contention) — a different one each run. Both pass in isolation
and the whole suite passes green with `npx vitest run --no-file-parallelism` (21632/21632).
Not a regression from this session. Consider bumping those two `it` timeouts or marking them
`sequential` if CI flakes.

## 7. Mobile header brand title overlaps the Language button at 200% zoom (pre-existing)
At 200% text zoom on mobile, the header brand "Probably Weather" grows enough to overlap the
top-right Language button. Separate from the GATE-2 "mobile hero collision" (the Probably+temp
display, which IS fixed) — this is header chrome whose size comes from app.css, unaffected by
the Onest adoption, so it collides at 200% independent of this wave. Fix if wanted: cap/scale
the mobile `.brand`/header title at zoom, or let the header stack. Logged, not fixed (Al named
the hero; the header is a separate, pre-existing zoom issue).
