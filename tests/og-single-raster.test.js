import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import * as ogModule from '../api/og.js';

const source = readFileSync(new URL('../api/og.js', import.meta.url), 'utf8');

describe('P4 single-raster OG pipeline', () => {
  it('P4 renders a valid budgeted JPEG directly from the exported renderer', async () => {
    expect(typeof ogModule.renderJpeg).toBe('function');
    const model = ogModule.buildFallbackViewModel('en', 'clear');
    const jpeg = await ogModule.renderJpeg(model);
    const metadata = await sharp(jpeg).metadata();

    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
    expect(jpeg.length).toBeLessThanOrEqual(ogModule.JPEG_BYTE_BUDGET);
  });

  it('P4 uses Satori SVG followed by one Sharp raster pass, never ImageResponse PNG', () => {
    expect(source).toMatch(/import satori from ['"]satori['"]/);
    expect(source).toMatch(/await satori\(/);
    expect(source).toMatch(/sharp\(Buffer\.from\(svg\)\)/);
    expect(source).not.toMatch(/ImageResponse/);
    expect(source).not.toMatch(/image\.arrayBuffer\(\)/);
  });

  it('P4 keeps resolved background data URLs in a module-scope cache', () => {
    expect(source).toMatch(/const BACKGROUND_DATA_URL_CACHE = new Map\(\)/);
    expect(source).toMatch(/BACKGROUND_DATA_URL_CACHE\.get\(candidate\)/);
    expect(source).toMatch(/BACKGROUND_DATA_URL_CACHE\.set\(candidate, dataUrl\)/);
  });
});
