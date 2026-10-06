// The shared pixel-stroke helpers are pure — node-testable.
import { expect, test } from 'vitest';

import type { PixelRect } from '../pixel';
import { maskRects, strokeRects } from '../pixel-stroke';

const cells = (rects: PixelRect[]) => {
	const out: string[] = [];
	for (const r of rects)
		for (let y = r.y; y < r.y + r.h; y++)
			for (let x = r.x; x < r.x + r.w; x++) out.push(`${x},${y}`);
	return out.sort();
};

test('maskRects: rows run, repeated rows stack into one rect', () => {
	// A 3 × 4 "L": a column, then a foot.
	const mask = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1];
	const rects = maskRects(mask, 3, 4);
	expect(rects).toEqual([
		{ x: 0, y: 0, w: 1, h: 3 },
		{ x: 0, y: 3, w: 3, h: 1 }
	]);
});

test('strokeRects: a 1 px line through the points, each cell once, no gaps', () => {
	const rects = strokeRects([
		[0.5, 0.5],
		[6.5, 3.5]
	]);
	const got = cells(rects);
	expect(new Set(got).size).toBe(got.length);
	expect(got).toContain('0,0');
	expect(got).toContain('6,3');
	// 8-connected: every column 0..6 has a cell.
	for (let x = 0; x <= 6; x++) expect(got.some((c) => c.startsWith(`${x},`))).toBe(true);
	// A vertical stroke is a single rect.
	expect(
		strokeRects([
			[2, 0],
			[2, 9]
		])
	).toEqual([{ x: 2, y: 0, w: 1, h: 10 }]);
});

test('strokeRects: a 2 px brush and a closed loop', () => {
	const thick = cells(
		strokeRects(
			[
				[0, 0],
				[4, 0]
			],
			{ width: 2 }
		)
	);
	expect(thick).toHaveLength(12);
	const loop = cells(
		strokeRects(
			[
				[0, 0],
				[3, 0],
				[3, 3],
				[0, 3]
			],
			{ closed: true }
		)
	);
	expect(loop).toHaveLength(12);
});
