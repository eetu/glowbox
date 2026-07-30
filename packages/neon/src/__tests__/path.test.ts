// SVG path data → centreline polylines, pure node tests. The nib-authored die
// paths (cubic circles + a rounded rect) are the integration fixture; the rest
// covers the command vocabulary, relatives, reflections, arcs and the compact
// arc-flag form real exporters emit.
import { expect, test } from 'vitest';

import { pathToStrokes } from '../path';

// A pip from the nib die: an 8-radius circle at (28, 28) drawn as four cubics.
const NIB_PIP =
	'M 36 28 C 36 32.418 32.418 36 28 36 C 23.582 36 20 32.418 20 28 C 20 23.582 23.582 20 28 20 C 32.418 20 36 23.582 36 28 Z';

test('lines, closes and multiple subpaths', () => {
	const s = pathToStrokes('M0 0L10 0 10 10ZM20 0h5v5');
	expect(s.length).toBe(2);
	expect(s[0][0]).toEqual([0, 0]);
	expect(s[0][s[0].length - 1]).toEqual([0, 0]); // Z closes back to the start
	expect(s[1]).toEqual([
		[20, 0],
		[25, 0],
		[25, 5]
	]);
});

test('relative commands accumulate', () => {
	const [s] = pathToStrokes('m10 10l5 0l0 5l-5 0z');
	expect(s).toEqual([
		[10, 10],
		[15, 10],
		[15, 15],
		[10, 15],
		[10, 10]
	]);
});

test('a nib cubic circle flattens onto its radius', () => {
	const [s] = pathToStrokes(NIB_PIP);
	expect(s.length).toBeGreaterThan(8); // actually curved, not a polygon of 4
	for (const [x, y] of s) {
		expect(Math.hypot(x - 28, y - 28)).toBeGreaterThan(7.9);
		expect(Math.hypot(x - 28, y - 28)).toBeLessThan(8.1);
	}
	expect(s[0]).toEqual(s[s.length - 1]); // closed loop
});

test('S/T reflections and Q quads produce smooth curves', () => {
	const [q] = pathToStrokes('M0 0Q5 10 10 0T20 0');
	expect(q.length).toBeGreaterThan(6);
	const apex = Math.max(...q.map(([, y]) => Math.abs(y)));
	expect(apex).toBeGreaterThan(4); // the quad actually bows
	const [c] = pathToStrokes('M0 0C0 10 10 10 10 0S20 -10 20 0');
	expect(c.length).toBeGreaterThan(6);
});

test('arcs — including the compact run-together flag form', () => {
	// An 8-radius circle at (28,28) as two arcs with "11"-style compact flags.
	const [s] = pathToStrokes('M20 28a8 8 0 1116 0 8 8 0 11-16 0Z');
	for (const [x, y] of s) {
		expect(Math.hypot(x - 28, y - 28)).toBeGreaterThan(7.85);
		expect(Math.hypot(x - 28, y - 28)).toBeLessThan(8.15);
	}
	// Degenerate radius is a line, per spec.
	expect(pathToStrokes('M0 0A0 5 0 01 10 0')[0]).toEqual([
		[0, 0],
		[10, 0]
	]);
});

test('several d strings become separate glass runs', () => {
	const s = pathToStrokes(['M0 0L1 1', 'M2 2L3 3']);
	expect(s.length).toBe(2);
});

test('malformed data throws with position context', () => {
	expect(() => pathToStrokes('M0 0LX')).toThrow(/bad SVG path data/);
	expect(() => pathToStrokes('M0 0B1 1')).toThrow(/unknown command/);
});
