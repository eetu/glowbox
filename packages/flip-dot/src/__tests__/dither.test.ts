import { expect, test } from 'vitest';

import { ditherFrame } from '../dither';

const count = (bits: Uint8Array) => bits.reduce((s, b) => s + b, 0);

test('threshold mode cuts at the threshold', () => {
	const bits = ditherFrame([0, 0.4, 0.5, 0.6, 1, 0.49], 3, 2, {
		mode: 'threshold',
		threshold: 0.5
	});
	expect(Array.from(bits)).toEqual([0, 0, 1, 1, 1, 0]);
});

test('bayer: mid-gray dithers to roughly half on, black/white stay solid', () => {
	const n = 32 * 32;
	const bayer = { mode: 'bayer' } as const;
	const half = ditherFrame(() => 0.5, 32, 32, bayer);
	expect(count(half)).toBeGreaterThan(n * 0.4);
	expect(count(half)).toBeLessThan(n * 0.6);
	expect(count(ditherFrame(() => 0, 32, 32, bayer))).toBe(0);
	expect(count(ditherFrame(() => 1, 32, 32, bayer))).toBe(n);
});

test('bayer: brighter regions get more dots (gradient is monotonic by band)', () => {
	const cols = 64;
	const rows = 16;
	const bits = ditherFrame((x) => x / (cols - 1), cols, rows, { mode: 'bayer' });
	const band = (x0: number, x1: number) => {
		let s = 0;
		for (let y = 0; y < rows; y++) for (let x = x0; x < x1; x++) s += bits[y * cols + x];
		return s;
	};
	expect(band(0, 16)).toBeLessThan(band(24, 40));
	expect(band(24, 40)).toBeLessThan(band(48, 64));
});

test('floyd–steinberg preserves the average level', () => {
	const cols = 40;
	const rows = 40;
	const level = 0.3;
	const bits = ditherFrame(() => level, cols, rows, { mode: 'floyd' });
	const mean = count(bits) / (cols * rows);
	expect(Math.abs(mean - level)).toBeLessThan(0.05);
});

test('array and function sources agree', () => {
	const cols = 8;
	const rows = 8;
	const arr = Array.from({ length: cols * rows }, (_, i) => (i % 7) / 6);
	const a = ditherFrame(arr, cols, rows);
	const b = ditherFrame((x, y) => arr[y * cols + x], cols, rows);
	expect(Array.from(a)).toEqual(Array.from(b));
});

test('out-of-range luma clamps instead of exploding', () => {
	const bits = ditherFrame([-1, 2, NaN, 0.5], 2, 2, { mode: 'threshold' });
	expect(Array.from(bits)).toEqual([0, 1, 0, 1]);
});
