# Forecast candidates — launch run (2026-09-24)

Same days, truth and stand-ins as `blend-vs-sources.mjs` (2026-06-24 → 2026-09-22, six airports, 534 scored days). "Clearly better" = the 2000-draw bootstrap 95% interval of (candidate − current) MAE lies wholly below zero. "Within 1 °C" = share of days the forecast was within 1 °C of the airport.

## 1. The day's low (as served at 06:00; the same weights make every day's low, incl. tomorrow's on the night Home)

| airport | days | current MAE (bias) · within 1 °C | drop Pirate | Open-Meteo alone |
|---|---:|---|---|---|
| Cape Town | 90 | 0.96 (0.1) · 59% | 0.93 (-0.2) · 62% — not distinguishable [-0.123, 0.071] | 1.07 (-0.6) · 53% — not distinguishable [-0.036, 0.276] |
| Johannesburg | 90 | 1.05 (-0.3) · 61% | 1.35 (-1.1) · 46% — worse [0.134, 0.447] | 1.38 (-1.1) · 46% — worse [0.16, 0.489] |
| Durban | 90 | 2.18 (2.1) · 37% | 2.05 (1.9) · 39% — **clearly better** [-0.184, -0.083] | 1.6 (1.4) · 40% — **clearly better** [-0.72, -0.436] |
| Gqeberha | 90 | 1.95 (1.9) · 36% | 1.91 (1.9) · 32% — not distinguishable [-0.097, 0.009] | 2.03 (2) · 30% — worse [0.017, 0.146] |
| Bloemfontein | 85 | 2.94 (2.8) · 11% | 1.54 (1.2) · 35% — **clearly better** [-1.605, -1.188] | 1.23 (0.6) · 47% — **clearly better** [-1.995, -1.416] |
| George | 89 | 1.01 (0.4) · 61% | 0.99 (0.1) · 63% — not distinguishable [-0.111, 0.072] | 1.03 (0) · 57% — not distinguishable [-0.074, 0.119] |
| All six | 534 | 1.67 (1.2) · 44% | 1.46 (0.6) · 46% — **clearly better** [-0.278, -0.146] | 1.39 (0.4) · 46% — **clearly better** [-0.369, -0.188] |

## 2. The day's high read later in the day — current vs "only sources that forecast the whole day vote after noon"

| airport | 06:00 | 12:00 | 15:00 | 18:00 | 21:00 |
|---|---|---|---|---|---|
| Cape Town | 0.76 → 0.76 (bias 0.1 → 0.1) = | 0.76 → 0.93 (bias 0.1 → 0.2) ✘ | 0.83 → 0.93 (bias 0.1 → 0.2) ✘ | 1.01 → 0.93 (bias -0.4 → 0.2) = | 1.33 → 0.93 (bias -1 → 0.2) ✔ |
| Johannesburg | 0.66 → 0.66 (bias -0.3 → -0.3) = | 0.66 → 0.62 (bias -0.3 → -0.1) = | 0.58 → 0.62 (bias -0.2 → -0.1) ✘ | 1.06 → 0.62 (bias -0.9 → -0.1) ✔ | 1.89 → 0.62 (bias -1.8 → -0.1) ✔ |
| Durban | 0.99 → 0.99 (bias 0.5 → 0.5) = | 0.97 → 1.01 (bias 0.5 → 0.6) = | 0.92 → 1.01 (bias 0.3 → 0.6) ✘ | 0.87 → 1.01 (bias -0.2 → 0.6) = | 0.98 → 1.01 (bias -0.5 → 0.6) = |
| Gqeberha | 0.75 → 0.75 (bias 0.2 → 0.2) = | 0.75 → 0.75 (bias 0.1 → -0.1) = | 0.72 → 0.75 (bias 0 → -0.1) = | 0.96 → 0.75 (bias -0.6 → -0.1) ✔ | 1.24 → 0.75 (bias -1 → -0.1) ✔ |
| Bloemfontein | 0.99 → 0.99 (bias -0.7 → -0.7) = | 1 → 1.17 (bias -0.7 → -0.8) ✘ | 1.01 → 1.17 (bias -0.8 → -0.8) ✘ | 1.76 → 1.17 (bias -1.6 → -0.8) ✔ | 2.7 → 1.17 (bias -2.6 → -0.8) ✔ |
| George | 0.89 → 0.89 (bias -0.3 → -0.3) = | 0.9 → 1.21 (bias -0.3 → -0.7) ✘ | 1.27 → 1.21 (bias -0.9 → -0.7) = | 1.61 → 1.21 (bias -1.3 → -0.7) ✔ | 1.84 → 1.21 (bias -1.6 → -0.7) ✔ |
| All six | 0.84 → 0.84 (bias -0.1 → -0.1) = | 0.84 → 0.94 (bias -0.1 → -0.2) ✘ | 0.89 → 0.95 (bias -0.2 → -0.2) ✘ | 1.2 → 0.95 (bias -0.8 → -0.2) ✔ | 1.65 → 0.95 (bias -1.4 → -0.2) ✔ |

✔ clearly better · = not distinguishable · ✘ worse. Before noon the candidate is identical to current by construction.
