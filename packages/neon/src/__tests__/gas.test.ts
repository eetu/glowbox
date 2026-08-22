// The gas table and the pigment law behind a named colour's ink — pure data and a
// pure function, so node runs them.
import { expect, test } from 'vitest';

import { type RGB } from '../color';
import { GASES, type GasName, pigment } from '../gas';

const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test('a named colour inks by its own lightness, and keeps its hue doing it', () => {
	const pale = pigment([0.83, 0.83, 0.83]);
	const deep = pigment([0.37, 0.7, 0.64]);
	expect(lum(pale)).toBeGreaterThan(lum(deep)); // pale pigment, faint mark
	// Monotone all the way down: a darker colour is never the lighter ink.
	let last = 1;
	for (let v = 1; v >= 0; v -= 0.05) {
		const l = lum(pigment([v, v, v]));
		expect(l).toBeLessThanOrEqual(last + 1e-9);
		last = l;
	}
	// Hue is the channel ratios, and they survive the curve unscaled by the cap.
	const teal = pigment([0.4, 0.8, 0.6]);
	expect(teal[1] / teal[0]).toBeGreaterThan(1);
	expect(teal[1]).toBeGreaterThan(teal[2]);
	// Even white lays down a mark rather than nothing, so a lit tube is never the
	// wall itself.
	expect(Math.max(...pigment([1, 1, 1]))).toBeLessThan(0.9);
	expect(Math.min(...pigment([1, 1, 1]))).toBeGreaterThan(0.8);
	expect(pigment([0, 0, 0])).toEqual([0, 0, 0]);
});

test('every gas carries an ink, and the white fill is the one that inverts', () => {
	for (const name of Object.keys(GASES) as GasName[]) {
		const g = GASES[name];
		expect(g.ink).toHaveLength(3);
		expect(lum(g.ink)).toBeLessThan(lum(g.color)); // ink is the dark half of the fill
		for (const ch of g.ink) expect(ch).toBeGreaterThanOrEqual(0);
	}
	// co2's near-white glow has nowhere to go but black — the invented inversion.
	expect(lum(GASES.co2.ink)).toBeLessThan(0.1);
	// …while the coloured fills stay themselves: gold inks warm, green inks green.
	expect(GASES.gold.ink[0]).toBeGreaterThan(GASES.gold.ink[2] * 3);
	expect(GASES.green.ink[1]).toBeGreaterThan(GASES.green.ink[0] * 3);
});
