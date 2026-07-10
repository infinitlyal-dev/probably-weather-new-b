import { describe, expect, it } from 'vitest';

import { RATE_LIMITS } from '../api/_lib/limiters.js';

describe('weather per-IP daily limiter configuration', () => {
  it('S1 caps one IP at 300 weather requests per rolling day', () => {
    expect(RATE_LIMITS.weatherDaily).toEqual({ max: 300, window: '1 d' });
  });
});
