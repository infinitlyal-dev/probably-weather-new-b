import { describe, expect, it } from 'vitest';

import handler from '../api/weather.js';

describe('weather API module', () => {
  it('loads the API handler', () => {
    expect(handler).toBeTypeOf('function');
  });
});
