// Every symbol at every height a 1 px wire is drawn at: no wire breaks, none clumps, and the
// ghost stack gives each pixel one owner. Failures are collected, so a run names them all.
import { expect, test } from 'vitest';

import { glyphPath } from '../nixie';
import { flattenPath } from '../path-parse';
import type { PixelRect } from '../pixel';
import { nixiePixels } from '../pixel-nixie';

const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => from + i);
// Every height of the 1 px wire, then the 2 px wire's for breaks alone.
const HEIGHTS = range(11, 47);
const THICK = range(48, 96);
const DIGITS = [...'0123456789'];
const STACK = [...'1234567890'];

type Pt = [number, number];

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

const clumps = (list: string[]) => {
	const set = new Set(list);
	return list.filter((c) => {
		const [x, y] = c.split(',').map(Number);
		return [`${x + 1},${y}`, `${x},${y + 1}`, `${x + 1},${y + 1}`].every((k) => set.has(k));
	});
};

const segDist = (p: Pt, a: Pt, b: Pt) => {
	const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
	const len = dx * dx + dy * dy;
	const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
	return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

/** The glyph's separate strokes: its subpaths, those that touch (within a glyph unit) one. */
const strokes = (ch: string) => {
	const subs = flattenPath(glyphPath(ch)!).map((s) => s.pts as Pt[]);
	const root = subs.map((_, i) => i);
	const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
	const near = (a: Pt[], b: Pt[]) =>
		a.some((p) => b.some((q, j) => j > 0 && segDist(p, b[j - 1], q) < 1));
	for (let i = 0; i < subs.length; i++)
		for (let j = i + 1; j < subs.length; j++)
			if (near(subs[i], subs[j]) || near(subs[j], subs[i])) root[find(i)] = find(j);
	return new Set(subs.map((_, i) => find(i))).size;
};

test('sweep: every lit wire is as many unbroken 1 px pieces as its glyph has strokes', () => {
	const broken: string[] = [];
	for (const ch of [...DIGITS, ':', '.', '-']) {
		const want = strokes(ch);
		for (const height of [...HEIGHTS, ...THICK]) {
			const lit = nixiePixels(ch, height).parts.find((p) => p.on)!;
			const wire = cells(lit.rects);
			const got = pieces(wire);
			if (got !== want) broken.push(`${ch} at ${height}px: ${got} pieces, glyph has ${want}`);
			// The separators' dots are solid below 3 px; only a 1 px wire must stay thin.
			if (height < 48 && DIGITS.includes(ch) && clumps(wire).length)
				broken.push(`${ch} at ${height}px: clumps at ${clumps(wire).join(' ')}`);
		}
	}
	expect(broken).toEqual([]);
});

test('sweep: the ghost stack gives every wire pixel one owner, the lit one or the frontmost', () => {
	const wrong: string[] = [];
	for (const height of HEIGHTS) {
		// A cathode's whole wire is what it lights.
		const wire = STACK.map(
			(ch) => new Set(cells(nixiePixels(ch, height).parts.find((p) => p.on)!.rects))
		);
		const stack = new Set(wire.flatMap((w) => [...w]));
		for (const lit of ['', ...DIGITS]) {
			const tube = nixiePixels(lit, height);
			const owned = new Map<string, number>();
			for (const p of tube.parts)
				for (const c of cells(p.rects)) {
					if (owned.has(c)) wrong.push(`${lit || 'blank'} at ${height}px: ${c} doubled`);
					owned.set(c, p.depth);
					if (!wire[p.depth].has(c))
						wrong.push(`${lit || 'blank'} at ${height}px: ${c} owned off its wire`);
				}
			for (const c of stack) {
				const depth = owned.get(c);
				if (depth === undefined) {
					wrong.push(`${lit || 'blank'} at ${height}px: ${c} orphaned`);
					continue;
				}
				const litDepth = STACK.indexOf(lit);
				const want = lit && wire[litDepth].has(c) ? litDepth : wire.findIndex((w) => w.has(c));
				if (depth !== want)
					wrong.push(`${lit || 'blank'} at ${height}px: ${c} owned by ${depth}, not ${want}`);
			}
			if (owned.size !== stack.size)
				wrong.push(`${lit || 'blank'} at ${height}px: ${owned.size} owned of ${stack.size}`);
		}
	}
	expect(wrong).toEqual([]);
});
