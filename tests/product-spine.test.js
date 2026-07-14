import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const spine = readFileSync(new URL('../PRODUCT_SPINE.md', import.meta.url), 'utf8');
const dossier = readFileSync(new URL('../DESIGN_DOSSIER_probably-weather_2026-07-14.md', import.meta.url), 'utf8');

describe('draft Probably Weather product spine', () => {
  it('stays explicitly unsigned until Al rules it final', () => {
    expect(spine).toContain('DRAFT — AWAITING AL\'S SIGNATURE');
  });

  it('records all four owner-ruled kill criteria verbatim', () => {
    expect(spine).toContain('no new daily job');
    expect(spine).toContain('explainable in one glance');
    expect(spine).toContain('never weakens “Probably” honesty');
    expect(spine).toContain('never obscures Share');
  });

  it('records all five ruled KILLs', () => {
    for (const killed of ['Radar', '15-day forecasts', 'Weather news feeds', 'Collectibles', 'Metric dashboards']) expect(spine).toContain(`- ${killed}`);
  });

  it('keeps confidence, severe alerts, and Share instrumentation deferred in the dossier', () => {
    expect(dossier).toMatch(/Deferred — Recommendation 5, confidence line:[^\n]*five-language copy/);
    expect(dossier).toMatch(/Deferred — Recommendation 6, severe alerts:[^\n]*source contract/);
    expect(dossier).toMatch(/Deferred — Recommendation 7, Share instrumentation:[^\n]*marketing project[^\n]*privacy review/);
  });

  it('labels untracked dossier captures as local evidence instead of dead repository links', () => {
    expect(dossier).toContain('local run artifacts under `research/smaak-run4/`');
    expect(dossier).not.toMatch(/\]\((?:research|review|output)\//);
  });
});
