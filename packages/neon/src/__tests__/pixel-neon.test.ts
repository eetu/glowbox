// The pixel sign is pure data and a function of time: node-testable by design.
import { expect, test } from 'vitest';

import { layoutTubes } from '../layout';
import type { PixelRect } from '../pixel';
import { neonLevels, neonPixels } from '../pixel-neon';
import { wearOf } from '../wear';

const cells = (rects: PixelRect[]) => {
	const out: string[] = [];
	for (const r of rects)
		for (let y = r.y; y < r.y + r.h; y++)
			for (let x = r.x; x < r.x + r.w; x++) out.push(`${x},${y}`);
	return out;
};
const rows = (rects: PixelRect[]) =>
	Math.max(...rects.map((r) => r.y + r.h)) - Math.min(...rects.map((r) => r.y));

test('neonPixels: one part per tube section, on whole pixels inside the sign', () => {
	const sign = neonPixels('HOTEL bar', { capHeight: 9, font: 'sans' });
	const sections = layoutTubes('HOTEL bar', 'sans').sections;
	expect(sign.parts.map(({ line, word }) => ({ line, word }))).toEqual(
		sections.map(({ line, word }) => ({ line, word }))
	);
	for (const p of sign.parts) {
		for (const r of [...p.rects, ...p.ends]) {
			for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
			expect(r.w).toBeGreaterThan(0);
			expect(r.h).toBeGreaterThan(0);
			expect(r.x).toBeGreaterThanOrEqual(0);
			expect(r.y).toBeGreaterThanOrEqual(0);
			expect(r.x + r.w).toBeLessThanOrEqual(sign.width);
			expect(r.y + r.h).toBeLessThanOrEqual(sign.height);
		}
		const glass = cells(p.rects);
		expect(new Set(glass).size).toBe(glass.length);
		// One stub per electrode, a pixel thick, a pixel long below 14 px, off the glass.
		expect(p.ends).toHaveLength(2);
		for (const e of p.ends) {
			expect(e.w * e.h).toBe(1);
			expect(glass).not.toContain(`${e.x},${e.y}`);
		}
	}
	expect(neonPixels('Open', { capHeight: 16 }).parts[0].ends[0].w).toBeLessThanOrEqual(2);
	expect(neonPixels('', { capHeight: 9 })).toEqual({ width: 0, height: 0, parts: [] });
});

test('neonPixels: a capital is capHeight rows, the tube included', () => {
	for (const capHeight of [7, 9, 14])
		for (const stroke of [1, 2]) {
			const [h] = neonPixels('H', { capHeight, font: 'sans', stroke }).parts;
			expect(rows(h.rects)).toBe(capHeight);
			// The stems run the full height, `stroke` wide.
			const stem = Math.min(...h.rects.map((r) => r.x));
			const left = cells(h.rects).filter((c) => +c.split(',')[0] < stem + stroke);
			expect(left).toHaveLength(capHeight * stroke);
		}
});

test('neonPixels: a 1 px tube stays one pixel wide round its curves, flat at the bottom of an O', () => {
	// Along one stroke; where two strokes meet (a stem and a diagonal) the glass may double.
	for (const [text, font, capHeight] of [
		['O', 'sans', 7],
		['O', 'sans', 9],
		['O', 'sans', 12],
		['CSG', 'sans', 11],
		['Oops', 'script', 16],
		['e', 'script', 20]
	] as const) {
		const sign = neonPixels(text, { capHeight, font });
		for (const p of sign.parts) {
			const lit = new Set(cells(p.rects));
			for (const c of lit) {
				const [x, y] = c.split(',').map(Number);
				const block = [`${x + 1},${y}`, `${x},${y + 1}`, `${x + 1},${y + 1}`];
				expect(block.every((b) => lit.has(b))).toBe(false);
			}
		}
		if (text === 'O') {
			const bottom = Math.max(...sign.parts[0].rects.map((r) => r.y + r.h)) - 1;
			const flat = cells(sign.parts[0].rects).filter((c) => +c.split(',')[1] === bottom);
			expect(flat.length).toBeGreaterThanOrEqual(2);
		}
	}
});

test('neonPixels: art keeps its index, and a steady piece says so', () => {
	const sign = neonPixels('BAR', {
		capHeight: 9,
		font: 'sans',
		art: [{ d: 'M0 0 L10 0 L10 10 L0 10 Z', place: 'left', steady: true }]
	});
	const art = sign.parts.filter((p) => p.art === 0);
	expect(art).toHaveLength(1);
	expect(art[0].steady).toBe(true);
	expect(art[0].word).toBeUndefined();
	expect(sign.parts.some((p) => p.steady && p.art == null)).toBe(false);
});

test('neonLevels: lit by default, unlit glass when off, the same at the same moment', () => {
	const sign = neonPixels('HOTEL', { capHeight: 9, font: 'sans', tubes: 'glyph' });
	expect([...neonLevels(sign, 3)]).toEqual([1, 1, 1, 1, 1]);
	expect([...neonLevels(sign, 3, { on: false })]).toEqual([0, 0, 0, 0, 0]);
	const at = (t: number) => [...neonLevels(sign, t, { on: 1, age: 0.8, seed: 4 })];
	expect(at(1.37)).toEqual(at(1.37));
	expect(at(1.37)).not.toEqual([...neonLevels(sign, 1.37, { on: 1, age: 0.8, seed: 5 })]);
});

test('neonLevels: a strike runs from the switch: dark arc, pops, overshoot, settled at 1', () => {
	const sign = neonPixels('BAR', { capHeight: 9, font: 'sans' });
	const at = (t: number) => neonLevels(sign, t, { on: 10, seed: 2 })[0];
	expect(at(9.9)).toBe(0);
	expect(at(10.05)).toBe(0);
	const seen: number[] = [];
	for (let t = 10; t < 12; t += 0.005) seen.push(at(t));
	expect(Math.max(...seen)).toBeGreaterThan(1.05);
	expect(Math.max(...seen)).toBeLessThanOrEqual(1.15 + 1e-6);
	expect(seen.some((v) => v > 0.15 && v < 0.6)).toBe(true);
	expect(at(12)).toBe(1);
	expect(neonLevels(sign, 10, { on: 10, strikeMs: 0 })[0]).toBe(1);
});

test("neonLevels: 'reveal' strikes the tubes in order; otherwise they scatter", () => {
	const sign = neonPixels('OPEN', { capHeight: 9, font: 'sans', tubes: 'glyph' });
	const firstLight = (program: 'reveal' | 'steady') =>
		sign.parts.map((_, i) => {
			for (let t = 0; t < 4; t += 0.01)
				if (neonLevels(sign, t, { on: 0, program, seed: 7 })[i] > 0.9) return t;
			return Infinity;
		});
	const reveal = firstLight('reveal');
	expect(reveal).toEqual([...reveal].sort((a, b) => a - b));
	expect(reveal[3] - reveal[0]).toBeGreaterThan(0.9);
	const scatter = firstLight('steady');
	expect(Math.max(...scatter) - Math.min(...scatter)).toBeLessThan(0.5);
});

test('neonLevels: the flasher keeps its floors, relights in 50 ms, dies in 60', () => {
	const sign = neonPixels('OPEN', { capHeight: 9, font: 'sans', tubes: 'glyph' });
	const flips = (program: 'flash' | 'chase', part: number) => {
		const out: number[] = [];
		let was = neonLevels(sign, 1, { program, speed: 8 })[part] > 0.5;
		for (let t = 1; t < 7; t += 0.002) {
			const lit = neonLevels(sign, t, { program, speed: 8 })[part] > 0.5;
			if (lit !== was) out.push(t);
			was = lit;
		}
		return out;
	};
	const gaps = (f: number[]) => f.slice(1).map((t, i) => t - f[i]);
	expect(flips('flash', 0).length).toBeGreaterThan(10);
	expect(Math.min(...gaps(flips('flash', 0)))).toBeGreaterThan(0.19);
	expect(Math.min(...gaps(flips('chase', 1)))).toBeGreaterThan(0.11);
	// One dark slot in four, mid-step.
	expect(
		[...neonLevels(sign, 0.18, { program: 'chase', speed: 8 })].filter((v) => v === 0)
	).toHaveLength(1);
	expect(neonLevels(sign, 0.225, { program: 'flash', speed: 8 })[0]).toBeCloseTo(1 - 25 / 60, 5);
	expect(neonLevels(sign, 0.425, { program: 'flash', speed: 8 })[0]).toBeCloseTo(25 / 50, 5);
});

test('neonLevels: a word switches alone and strikes alone; art rides the wall switch', () => {
	const sign = neonPixels('NO VACANCY', {
		capHeight: 9,
		font: 'sans',
		art: [{ d: 'M0 0 L10 0 L10 4', place: 'below' }]
	});
	const [no, vacancy, art] = sign.parts;
	expect([no.word, vacancy.word, art.art]).toEqual([0, 1, 0]);
	expect([...neonLevels(sign, 3, { wordOn: [false] })]).toEqual([0, 1, 1]);
	expect([...neonLevels(sign, 3, { lineOn: [false] })]).toEqual([0, 0, 1]);
	const struck = neonLevels(sign, 5.4, { wordOn: [5] });
	expect(struck[0]).toBeLessThan(1);
	expect([struck[1], struck[2]]).toEqual([1, 1]);
	expect([...neonLevels(sign, 7, { wordOn: [5] })]).toEqual([1, 1, 1]);
});

test('neonLevels: wear dims every tube and kills the most worn', () => {
	const sign = neonPixels('HOTEL', { capHeight: 9, font: 'sans', tubes: 'glyph' });
	const wear = wearOf(5, 3);
	const dying = wear.indexOf(Math.max(...wear));
	const dead = neonLevels(sign, 2, { age: 0.95, seed: 3 });
	expect(dead[dying]).toBe(0);
	expect([...neonLevels(sign, 2, { age: 0.5, seed: 3 })].every((v) => v < 1 && v > 0.5)).toBe(true);
});
