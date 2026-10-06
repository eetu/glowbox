// The pixel tubes are pure data — node-testable by design.
import { expect, test } from 'vitest';

import type { PixelRect } from '../pixel';
import { nixieLevels, nixiePixels, nixiePixelText } from '../pixel-nixie';

const HEIGHTS = [11, 14, 16, 20, 24];

const cells = (rects: PixelRect[]) => {
	const out: string[] = [];
	for (const r of rects)
		for (let y = r.y; y < r.y + r.h; y++)
			for (let x = r.x; x < r.x + r.w; x++) out.push(`${x},${y}`);
	return out;
};

/** How many 8-connected pieces the cells make. */
const pieces = (list: string[]) => {
	const left = new Set(list);
	let n = 0;
	for (const start of list) {
		if (!left.delete(start)) continue;
		n++;
		const todo = [start];
		while (todo.length) {
			const [x, y] = todo.pop()!.split(',').map(Number);
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const k = `${x + dx},${y + dy}`;
					if (left.delete(k)) todo.push(k);
				}
		}
	}
	return n;
};

test('nixiePixels: ten cathodes front to back, one lit, whole pixels, each pixel once', () => {
	for (const height of HEIGHTS)
		for (const d of '0123456789') {
			const tube = nixiePixels(d, height);
			expect(tube.height).toBe(height);
			expect(tube.parts.map((p) => p.symbol).join('')).toBe('1234567890');
			expect(tube.parts.map((p) => p.depth)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
			expect(tube.parts.filter((p) => p.on).map((p) => p.symbol)).toEqual([d]);
			const all = tube.parts.flatMap((p) => cells(p.rects));
			expect(new Set(all).size).toBe(all.length);
			for (const p of tube.parts)
				for (const r of p.rects) {
					for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
					expect(r.x >= 0 && r.y >= 0).toBe(true);
					expect(r.x + r.w).toBeLessThanOrEqual(tube.width);
					expect(r.y + r.h).toBeLessThanOrEqual(height);
				}
		}
});

test('nixiePixels: lighting a cathode only hands it its pixels; the stack is the same', () => {
	for (const height of HEIGHTS) {
		const stack = (s: string) =>
			nixiePixels(s, height)
				.parts.flatMap((p) => cells(p.rects))
				.sort();
		const blank = stack('');
		for (const d of '0123456789') expect(stack(d)).toEqual(blank);
		expect(nixiePixels(' ', height).parts.some((p) => p.on)).toBe(false);
	}
});

test('nixiePixels: every lit numeral is one unbroken 1 px wire', () => {
	for (const height of HEIGHTS)
		for (const d of '0123456789') {
			const lit = nixiePixels(d, height).parts.find((p) => p.on)!;
			const wire = cells(lit.rects);
			expect(pieces(wire), `${d} at ${height}px`).toBe(1);
			// No 2 × 2 clump anywhere along it.
			const set = new Set(wire);
			for (const c of wire) {
				const [x, y] = c.split(',').map(Number);
				const square = [`${x + 1},${y}`, `${x},${y + 1}`, `${x + 1},${y + 1}`].every((k) =>
					set.has(k)
				);
				expect(square, `${d} at ${height}px clumps at ${c}`).toBe(false);
			}
		}
});

test('nixiePixels: a 7 × 11 tube is the hand-drawn set; the wire thickens from 48 px', () => {
	const one = nixiePixels(1, 11);
	expect(one.width).toBe(7);
	expect(one.parts[0].rects).toEqual([{ x: 3, y: 0, w: 1, h: 10 }]);
	const stem = (height: number) => nixiePixels('1', height).parts[0].rects;
	expect(stem(47)).toHaveLength(1);
	expect(stem(47)[0].w).toBe(1);
	expect(stem(48)[0].w).toBe(2);
	expect(nixiePixels('1', 48, { wire: 1 }).parts[0].rects[0].w).toBe(1);
});

test('nixiePixels: separators are one lit part as wide as their ink', () => {
	const colon = nixiePixels(':', 16);
	expect(colon.parts).toHaveLength(1);
	expect(colon.parts[0]).toMatchObject({ symbol: ':', depth: 0, on: true });
	// Two 2 px dots at 16 px.
	expect(colon.width).toBe(2);
	expect(colon.parts[0].rects).toHaveLength(2);
	expect(cells(colon.parts[0].rects)).toHaveLength(8);
	const point = nixiePixels('.', 16);
	expect(cells(point.parts[0].rects)).toHaveLength(4);
	// The point sits below the colon's lower dot.
	expect(point.parts[0].rects[0].y).toBeGreaterThan(colon.parts[0].rects[1].y);
	const dash = nixiePixels('-', 16).parts[0].rects;
	expect(dash).toHaveLength(1);
	expect(dash[0].h).toBe(1);
	// From 3 px the dots are rings, as the canvas strokes them.
	const ring = cells(nixiePixels(':', 24).parts[0].rects);
	expect(ring).toHaveLength(8);
});

test('nixiePixelText: a clock row, tubes gap apart, the colon blinkable', () => {
	const row = nixiePixelText('12:34', { height: 16 });
	const digit = nixiePixels('1', 16).width;
	const colon = nixiePixels(':', 16).width;
	expect(row.width).toBe(4 * digit + colon + 4 * 2);
	expect(row.parts).toHaveLength(41);
	const lit = row.parts.filter((p) => p.on);
	expect(lit.map((p) => p.symbol).join('')).toBe('12:34');
	expect(lit.map((p) => p.index)).toEqual([0, 1, 2, 3, 4]);
	// The colon's tube starts after two digits and two gaps.
	const sep = row.parts.find((p) => p.symbol === ':')!;
	expect(Math.min(...sep.rects.map((r) => r.x))).toBe(2 * digit + 2 * 2);
	expect(
		nixiePixelText('12:34', { height: 16, colon: false }).parts.some(
			(p) => p.symbol === ':' && p.on
		)
	).toBe(false);
	expect(nixiePixelText('1 2', { height: 16, gap: 3 }).width).toBe(3 * digit + 2 * 3);
});

test('nixieLevels: ghosts at 0, the lit cathodes at their wear', () => {
	const row = nixiePixelText('10', { height: 16 });
	const fresh = nixieLevels(row, { age: 0, seed: 1, t: 0 });
	row.parts.forEach((p, i) => expect(fresh[i]).toBe(p.on ? 1 : 0));
	const worn = nixieLevels(row, { age: 0.5, seed: 1, t: 3 });
	row.parts.forEach((p, i) => {
		if (p.on) expect(worn[i]).toBeLessThan(1);
		else expect(worn[i]).toBe(0);
	});
	expect([...nixieLevels(row, { age: 0.8, seed: 2, t: 9.1 })]).toEqual([
		...nixieLevels(row, { age: 0.8, seed: 2, t: 9.1 })
	]);
});
