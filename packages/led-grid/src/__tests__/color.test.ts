import { describe, expect, test } from 'vitest';

import { parseColor, parseColor01, type RGB } from '../color';

describe('parseColor (node: arrays + hex)', () => {
	test('arrays pass through untouched, including bloom values >1', () => {
		const c: RGB = [1.4, 0.3, 0];
		expect(parseColor(c)).toBe(c); // same reference, not clamped
	});

	test('#rrggbb hex → 0..1', () => {
		const [r, g, b] = parseColor('#ff8800');
		expect(r).toBeCloseTo(1);
		expect(g).toBeCloseTo(136 / 255);
		expect(b).toBeCloseTo(0);
	});

	test('#rgb shorthand expands', () => {
		expect(parseColor('#f80')).toEqual(parseColor('#ff8800'));
	});

	test('unparseable string (no DOM) falls back to black', () => {
		expect(parseColor('rebeccapurple-ish-nonsense')).toEqual([0, 0, 0]);
	});

	test('parseColor01 clamps out-of-range arrays', () => {
		expect(parseColor01([2, -1, 0.5])).toEqual([1, 0, 0.5]);
	});

	test('repeated strings are memoised to an equal result', () => {
		const a = parseColor('#abcdef');
		const b = parseColor('#abcdef');
		expect(a).toEqual(b);
	});
});
