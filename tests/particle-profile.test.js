import { describe, expect, it } from 'vitest';

import { summarizeFrameIntervals } from '../scripts/profile-particles.mjs';

describe('P10 particle profiling metrics', () => {
  it('P10 reports missed deadlines and estimated dropped frames from rAF intervals', () => {
    const summary = summarizeFrameIntervals([16.7, 16.6, 33.4, 50.1]);

    expect(summary.samples).toBe(4);
    expect(summary.deadlineMissPct).toBe(50);
    expect(summary.estimatedDroppedFrames).toBe(3);
    expect(summary.estimatedDroppedFramePct).toBeCloseTo(42.86, 1);
    expect(summary.p95Ms).toBe(50.1);
  });
});
