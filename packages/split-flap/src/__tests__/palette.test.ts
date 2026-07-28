// Chroma mapping is pure and node-testable — pin the nearest-colour maths, the
// dither path, and the generated full-chroma drum.
import { expect, test } from 'vitest';

import { parseColor } from '../color';
import { flapsOf } from '../drum';
import { chromaDrum, paletteFrame } from '../palette';

test('paletteFrame maps each pixel to the nearest flap colour', () => {
	const pal = { ' ': '#000000', R: '#ff0000', W: '#ffffff' };
	const rgb = Float32Array.from([
		...[0, 0, 0], // black → the blank flap
		...[1, 0, 0], // pure red → R
		...[0.95, 0.95, 0.95], // near white → W
		...[0.6, 0, 0] // dark red → still R, not black (weighted distance)
	]);
	expect(paletteFrame(rgb, 4, 1, pal)).toEqual([' RWR']);
});

test('rows split correctly and junk input clamps to black', () => {
	const pal = { K: '#000', W: '#fff' };
	const rgb = [0, 0, 0, 1, 1, 1, NaN, NaN, NaN, 1, 1, 1];
	expect(paletteFrame(rgb, 2, 2, pal)).toEqual(['KW', 'KW']);
});

test('floyd dithering mixes flaps across a midtone field; the cut stays flat', () => {
	const pal = { K: '#000', W: '#fff' };
	const rgb = new Float32Array(8 * 4 * 3).fill(0.5);
	const dithered = paletteFrame(rgb, 8, 4, pal, { dither: 'floyd' }).join('');
	expect(dithered).toContain('K');
	expect(dithered).toContain('W');
	// The default hard cut resolves a uniform field to one flap.
	expect(new Set(paletteFrame(rgb, 8, 4, pal).join('')).size).toBe(1);
});

test('an empty palette shows a blank board rather than throwing', () => {
	expect(paletteFrame([0.5, 0.5, 0.5], 1, 1, {})).toEqual([' ']);
});

test('chromaDrum generates a full image drum: blank first, every flap painted', () => {
	const { charset, palette } = chromaDrum();
	const flaps = flapsOf(charset);
	expect(flaps).toHaveLength(43); // blank + 6 greys + 12 hues × 3 shades
	expect(flaps[0]).toBe(' ');
	expect(new Set(flaps).size).toBe(flaps.length);
	expect(Object.keys(palette)).toHaveLength(flaps.length);
	// A pure red pixel lands on a flap that is actually red.
	const [line] = paletteFrame([1, 0.1, 0.1], 1, 1, palette);
	const rgb = parseColor(palette[line[0]]);
	expect(rgb[0]).toBeGreaterThan(rgb[1]);
	expect(rgb[0]).toBeGreaterThan(rgb[2]);
	// Custom intervals scale the drum; hues: 0 is the monochrome drum.
	expect(flapsOf(chromaDrum({ hues: 18, shades: 4, grays: 8 }).charset)).toHaveLength(81);
	expect(flapsOf(chromaDrum({ hues: 0, grays: 10 }).charset)).toHaveLength(11);
});
