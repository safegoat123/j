// Run with: yarn test:unit   (uses Node's built-in test runner through tsx)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildTheme,
  contrastRatio,
  dominantColor,
  ensureContrast,
  parseColor,
  readableTextColor,
  toHex,
  type RGB,
} from './color';

test('parseColor handles rgb, rgba, 3/6/8-digit hex and rejects garbage', () => {
  assert.deepEqual(parseColor('rgb(10, 20, 30)'), [10, 20, 30]);
  assert.deepEqual(parseColor('rgba(10, 20, 30, 0.5)'), [10, 20, 30]); // old code failed here
  assert.deepEqual(parseColor('rgb(10 20 30 / 50%)'), [10, 20, 30]);
  assert.deepEqual(parseColor('#fff'), [255, 255, 255]); // old code failed here
  assert.deepEqual(parseColor('#1db954'), [29, 185, 84]);
  assert.deepEqual(parseColor('#1db95480'), [29, 185, 84]);
  assert.equal(parseColor('banana'), null);
  assert.equal(parseColor('#12'), null);
});

test('toHex round-trips', () => {
  assert.equal(toHex([29, 185, 84]), '#1db954');
  assert.equal(toHex([300, -5, 0]), '#ff0000');
});

test('contrast ratio matches WCAG reference values', () => {
  assert.ok(Math.abs(contrastRatio([0, 0, 0], [255, 255, 255]) - 21) < 0.01);
  assert.equal(contrastRatio([10, 10, 10], [10, 10, 10]), 1);
});

test('readableTextColor picks the higher-contrast colour', () => {
  assert.equal(readableTextColor([255, 255, 255]), '#000000');
  assert.equal(readableTextColor([0, 0, 0]), '#ffffff');
  assert.equal(readableTextColor('rgba(250, 250, 250, 0.9)'), '#000000');
  assert.equal(readableTextColor('#fff'), '#000000');
  assert.equal(readableTextColor('not a colour'), '#ffffff');
});

test('ensureContrast reaches the requested ratio', () => {
  const bg: RGB = [120, 120, 120];
  const fixed = ensureContrast([130, 130, 130], bg, 4.5);
  assert.ok(contrastRatio(fixed, bg) >= 4.5);
  // already fine -> untouched
  assert.deepEqual(ensureContrast([255, 255, 255], [0, 0, 0]), [255, 255, 255]);
});

test('dominantColor prefers the saturated colour and ignores near-black/white and transparent pixels', () => {
  const px: number[] = [];
  const push = (r: number, g: number, b: number, a: number, times: number) => {
    for (let i = 0; i < times; i++) px.push(r, g, b, a);
  };
  push(0, 0, 0, 255, 500); // black border
  push(255, 255, 255, 255, 300); // white
  push(200, 10, 10, 0, 900); // transparent red – ignored
  push(30, 90, 200, 255, 120); // blue
  push(120, 120, 120, 255, 150); // grey (less saturated)
  const [r, g, b] = dominantColor(px);
  assert.ok(b > r && b > 150, `expected a blue, got ${r},${g},${b}`);
  assert.deepEqual(dominantColor([]), [40, 40, 40]);
});

test('buildTheme always yields readable text on its background', () => {
  const samples: RGB[] = [
    [255, 255, 255],
    [250, 220, 20],
    [10, 10, 10],
    [200, 30, 30],
    [30, 90, 200],
    [128, 128, 128],
  ];
  for (const rgb of samples) {
    const t = buildTheme(rgb);
    const bg = parseColor(t.background) as RGB;
    assert.ok(contrastRatio(parseColor(t.text) as RGB, bg) >= 4.5, `text on ${t.background}`);
    assert.ok(contrastRatio(parseColor(t.mutedText) as RGB, bg) >= 4.5, `muted on ${t.background}`);
    assert.ok(t.gradient.startsWith('linear-gradient('));
  }
});
