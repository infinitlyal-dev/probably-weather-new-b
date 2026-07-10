# P10 particle profile — 2026-07-10

Verdict: **within budget, leave alone**.

Method: local headless Chromium 145, 400×800 viewport at 2× device scale, CDP CPU throttling at 6×. Each condition ran three paired 30-second trials with particles and with the 28 particle nodes removed: 12 traces / 360 measured seconds total. The reproducible command is `npm run profile:particles`; raw compressed traces are written to the ignored `benchmarks/traces/` directory. Exact per-trial results are in `p10-particle-profile.json`.

| Median metric | Rain particles | Rain control | Storm particles | Storm control |
| --- | ---: | ---: | ---: | ---: |
| Observed FPS | 59.97 | 60.00 | 59.97 | 60.00 |
| p95 frame interval | 16.70 ms | 16.70 ms | 16.80 ms | 16.70 ms |
| Estimated dropped-frame rate | 0.06% | 0.00% | 0.06% | 0.00% |
| Main-thread task occupancy | 39.98% | 12.17% | 35.76% | 11.11% |
| Style-recalc time / 30s | 4,029 ms | 0 ms | 3,517 ms | 0 ms |
| Long tasks across all 3 trials | 0 | 0 | 0 | 0 |
| Particle compositor layers | 28 | 0 | 28 | 0 |
| Particle layer surface upper bound | 17,920 bytes | 0 bytes | 17,920 bytes | 0 bytes |

The attributable median cost at 6× CPU was +27.81 percentage points of main-thread task occupancy for rain and +24.64 points for storm. That is real work, mostly style recalculation, but it did not move median p95 frame delivery beyond one 60 Hz interval, caused only +0.06 percentage points estimated drops, and produced no long tasks in six particle trials. A Canvas rewrite is not automatically cheaper and the measured headroom does not justify that risk.

Chrome's LayerTree protocol does not expose compositor backing-store memory, so actual layer memory is recorded as unavailable rather than guessed. The 17,920-byte figure is only a geometric upper-bound calculation for the 28 particle surfaces (width × height × RGBA × device scale²), not measured GPU allocation.

This is a local low-end CPU proxy, not an on-device battery result. CDP throttling does not emulate a low-end mobile GPU, so the verdict is limited to measured frame delivery and renderer-main-thread cost on this setup. Under the requested 6× CPU constraint it stayed essentially at 60 FPS, produced no in-window long tasks, and did no layout work. Those measurements support leaving the bounded transform/opacity implementation alone.
