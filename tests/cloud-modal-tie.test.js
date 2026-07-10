import { describe, expect, it } from 'vitest';
import { pickModalCloud } from '../api/weather.js';

describe('B6 cloud-cover plurality ties', () => {
  it('B6 falls back to the provider-weighted median when cloud buckets tie', () => {
    expect(pickModalCloud([10, 45, 90], [0.4, 0.25, 0.25])).toBe(45);
  });

  it('B6 keeps the median of a uniquely winning cloud bucket', () => {
    expect(pickModalCloud([10, 40, 45, 90], [0.4, 0.2, 0.2, 0.2])).toBe(45);
  });
});
