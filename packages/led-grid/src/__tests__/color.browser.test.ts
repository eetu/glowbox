import { expect, test, vi } from 'vitest';

import { parseColor, type RGB } from '../color';

const near = (c: RGB, want: RGB, tol = 0.03) =>
	c.forEach((v, i) => expect(Math.abs(v - want[i]), `${c} vs ${want}`).toBeLessThan(tol));

test('modern CSS colour syntaxes read as their sRGB, not black', () => {
	// sRGB red, written in each space.
	near(parseColor('oklch(62.8% 0.2577 29.23)'), [1, 0, 0]);
	near(parseColor('oklab(62.8% 0.2249 0.1258)'), [1, 0, 0]);
	near(parseColor('lab(54.29% 80.8 69.89)'), [1, 0, 0]);
	near(parseColor('lch(54.29% 106.84 40.85)'), [1, 0, 0]);
	near(parseColor('color(srgb 1 0.5 0)'), [1, 0.5, 0]);
	// Display-P3 shares sRGB's white and transfer curve: a grey is the same grey, and its
	// red, past sRGB, maps to sRGB's.
	near(parseColor('color(display-p3 0.5 0.5 0.5)'), [0.5, 0.5, 0.5]);
	near(parseColor('color(display-p3 1 0 0)'), [1, 0, 0], 0.2);
	near(parseColor('color-mix(in srgb, red 50%, blue)'), [0.5, 0, 0.5]);
	// Alpha is ignored, as for rgba().
	near(parseColor('oklch(62.8% 0.2577 29.23 / 0.5)'), [1, 0, 0]);
	expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual([1, 0, 0]);
});

test('the memo stays bounded: a flood of fresh strings evicts the oldest', () => {
	const ctx = Object.getPrototypeOf(document.createElement('canvas').getContext('2d')!);
	const sets = vi.spyOn(ctx, 'fillStyle', 'set');
	try {
		parseColor('lightseagreen');
		const first = sets.mock.calls.length;
		expect(first).toBeGreaterThan(0);
		parseColor('lightseagreen');
		expect(sets.mock.calls.length).toBe(first); // memoised
		for (let i = 0; i < 5000; i++) parseColor(`#${i.toString(16).padStart(6, '0')}`);
		parseColor('lightseagreen');
		expect(sets.mock.calls.length).toBeGreaterThan(first); // evicted, parsed afresh
	} finally {
		sets.mockRestore();
	}
});

// CSS colour normalisation needs a real DOM (2D canvas), so it runs in the browser.

test('rgb() function syntax → 0..1', () => {
	const [r, g, b] = parseColor('rgb(0, 128, 255)');
	expect(r).toBeCloseTo(0);
	expect(g).toBeCloseTo(128 / 255, 2);
	expect(b).toBeCloseTo(1);
});

test('named CSS colours resolve', () => {
	const [r, g, b] = parseColor('tomato'); // #ff6347
	expect(r).toBeCloseTo(1);
	expect(g).toBeCloseTo(99 / 255, 2);
	expect(b).toBeCloseTo(71 / 255, 2);
});

test('invalid colour strings fall back to black', () => {
	expect(parseColor('definitely-not-a-color')).toEqual([0, 0, 0]);
});

test('arrays still pass through in the browser too', () => {
	expect(parseColor([0.2, 0.4, 0.6])).toEqual([0.2, 0.4, 0.6]);
});
