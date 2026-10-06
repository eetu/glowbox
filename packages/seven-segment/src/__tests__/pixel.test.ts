// The pixel layout is pure data — node-testable by design.
import { expect, test } from 'vitest';

import type { PixelRect } from '../pixel';
import { pixelSegments, pixelText } from '../pixel-digits';
import { litSegments } from '../seven';

const cells = (r: PixelRect) =>
	Array.from({ length: r.w * r.h }, (_, i) => `${r.x + (i % r.w)},${r.y + Math.floor(i / r.w)}`);

test('pixelSegments: whole-pixel rects inside the digit, none touching', () => {
	for (const [height, stroke] of [
		[14, 1],
		[13, 1],
		[16, 2],
		[7, 1]
	]) {
		const width = Math.round(height / 2);
		const parts = pixelSegments(height, { stroke });
		const seen = new Set<string>();
		for (const [name, r] of Object.entries(parts)) {
			for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
			expect(r.w).toBeGreaterThan(0);
			expect(r.h).toBeGreaterThan(0);
			if (name === 'dp') continue;
			expect(r.x + r.w).toBeLessThanOrEqual(width);
			expect(r.y + r.h).toBeLessThanOrEqual(height);
			for (const c of cells(r)) {
				expect(seen.has(c)).toBe(false);
				seen.add(c);
			}
		}
	}
});

test('pixelSegments: a 7 × 14 digit at one pixel, the middle bar splitting it 5 over 6', () => {
	const p = pixelSegments(14);
	expect(p.a).toEqual({ x: 1, y: 0, w: 5, h: 1 });
	expect(p.g).toEqual({ x: 1, y: 6, w: 5, h: 1 });
	expect(p.d).toEqual({ x: 1, y: 13, w: 5, h: 1 });
	expect(p.f).toEqual({ x: 0, y: 1, w: 1, h: 5 });
	expect(p.e).toEqual({ x: 0, y: 7, w: 1, h: 6 });
	expect(p.b.x).toBe(6);
});

test('pixelText: a clock row, every digit whole, the colon between', () => {
	const row = pixelText('10:34', { height: 14 });
	// 4 digits of 7, a 1 px colon, 4 gaps of 2.
	expect(row.width).toBe(4 * 7 + 1 + 4 * 2);
	const digit = (i: number) => row.parts.filter((s) => s.index === i && s.name !== 'colon');
	expect(
		digit(0)
			.filter((s) => s.on)
			.map((s) => s.name)
	).toEqual(litSegments('1'));
	expect(digit(0)).toHaveLength(7);
	const colon = row.parts.filter((s) => s.name === 'colon');
	// Digits at 0, 9, 21, 30; the colon at 18.
	expect(colon).toHaveLength(1);
	expect(colon[0].rects.map((r) => r.x)).toEqual([18, 18]);
	expect(colon.every((s) => s.on)).toBe(true);
	expect(digit(4)[0].rects[0].x).toBe(30 + 1);
	expect(
		pixelText('10:34', { height: 14, colon: false }).parts.some((s) => s.name === 'colon' && s.on)
	).toBe(false);
});

test('pixelText: a point lights in the gap after its digit; blanks and unknowns light nothing', () => {
	const row = pixelText('1.5', { height: 14 });
	const dp = row.parts.find((s) => s.name === 'dp');
	expect(dp).toMatchObject({ index: 0, on: true, rects: [{ x: 7, y: 13, w: 1, h: 1 }] });
	expect(row.width).toBe(7 + 2 + 7);
	expect(pixelText('5.', { height: 14 }).width).toBe(8);
	expect(pixelText(' x', { height: 14 }).parts.some((s) => s.on)).toBe(false);
	expect(pixelText(' x', { height: 14 }).parts).toHaveLength(14);
});
