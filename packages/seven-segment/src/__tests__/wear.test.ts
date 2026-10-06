// The seeded wear arc is pure — node-testable, and the same at the same (age, seed, t).
import { expect, test } from 'vitest';

import { pixelLevels, pixelText } from '../pixel-digits';
import { DEAD_AT, wearLevels, wearOf } from '../wear';

const most = (w: Float32Array) => w.indexOf(Math.max(...w));

test('wearLevels: fresh is 1; worn dims by up to half the wear; the most-worn part dies', () => {
	expect([...wearLevels(8, { age: 0, seed: 3, t: 5 })]).toEqual(Array(8).fill(1));
	const wear = wearOf(8, 3);
	const worn = wearLevels(8, { age: 0.5, seed: 3, t: 5 });
	worn.forEach((l, i) => expect(l).toBeCloseTo(1 - wear[i] * 0.25, 5));
	expect(wearLevels(8, { age: DEAD_AT, seed: 3, t: 5 })[most(wear)]).toBe(0);
});

test('wearLevels: the same at the same moment, dipping now and then past 0.7', () => {
	const at = (t: number) => wearLevels(8, { age: 0.8, seed: 3, t });
	expect([...at(12.3)]).toEqual([...at(12.3)]);
	const dying = most(wearOf(8, 3));
	const steady = 1 - wearOf(8, 3)[dying] * 0.4;
	let dips = 0;
	for (let t = 0; t < 60; t += 0.05) if (at(t)[dying] < steady * 0.9) dips++;
	// Dips are brief and sparse: some, but a small share of the time.
	expect(dips).toBeGreaterThan(5);
	expect(dips).toBeLessThan(0.2 * (60 / 0.05));
});

test('pixelLevels: unlit segments are ghosts at 0, lit ones at their wear', () => {
	const row = pixelText('1', { height: 14 });
	const levels = pixelLevels(row, { age: 0, seed: 1, t: 0 });
	row.parts.forEach((p, i) => expect(levels[i]).toBe(p.on ? 1 : 0));
});
