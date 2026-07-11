import { expect, test } from 'vitest';

import { parseColor } from '../color';

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
