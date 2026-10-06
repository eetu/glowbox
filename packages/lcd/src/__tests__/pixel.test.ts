// The pixel export is pure data and maths — node-testable by design.
import { describe, expect, it } from 'vitest';

import { compile5x7, glyph5x7 } from '../font5x7';
import { LATIN_5X7 } from '../latin';
import { PANELS } from '../panels';
import { crystalAt, lcdInk, lcdPixels, lcdTargets, stepCrystals } from '../pixel-lcd';
import { wearOf } from '../wear';

const ACROSS = 16 * 5;
const at = (col: number, row: number) => row * ACROSS + col;
/** One cell's 8 rows as 5-bit masks, read back off a target. */
const cellRows = (target: Uint8Array, cx: number, cy: number) =>
	Array.from({ length: 8 }, (_, ry) => {
		let bits = 0;
		for (let rx = 0; rx < 5; rx++) if (target[at(cx * 5 + rx, cy * 8 + ry)]) bits |= 1 << (4 - rx);
		return bits;
	});

describe('lcdPixels', () => {
	it('a 16×2 at 1 px a dot is 95 × 18, one whole-pixel rect per dot, row-major', () => {
		const lcd = lcdPixels();
		expect([lcd.width, lcd.height]).toEqual([95, 18]);
		expect(lcd.parts).toHaveLength(ACROSS * 16);
		const seen = new Set<string>();
		lcd.parts.forEach((p, i) => {
			expect(at(p.col, p.row)).toBe(i);
			expect(p.cell).toEqual({ x: Math.floor(p.col / 5), y: Math.floor(p.row / 8) });
			expect(p.rects).toHaveLength(1);
			const r = p.rects[0];
			for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
			expect(r.x + r.w).toBeLessThanOrEqual(lcd.width);
			expect(r.y + r.h).toBeLessThanOrEqual(lcd.height);
			expect(seen.has(`${r.x},${r.y}`)).toBe(false);
			seen.add(`${r.x},${r.y}`);
		});
	});

	it('a pitch between characters, two between rows', () => {
		const lcd = lcdPixels({ cols: 2, rows: 2 });
		const x = (col: number) => lcd.parts[col].rects[0].x;
		expect([x(4), x(5)]).toEqual([4, 6]);
		const y = (row: number) => lcd.parts.find((p) => p.row === row)!.rects[0].y;
		expect([y(7), y(8)]).toEqual([7, 10]);
	});

	it('dots touch up to 3 px and part by a pixel from 4, unless the pitch is given', () => {
		const second = (o: Parameters<typeof lcdPixels>[0]) => lcdPixels(o).parts[1].rects[0];
		expect(second({ dot: 3 })).toEqual({ x: 3, y: 0, w: 3, h: 3 });
		expect(second({ dot: 4 })).toEqual({ x: 5, y: 0, w: 4, h: 4 });
		expect(second({ dot: 1, pitch: 2 })).toEqual({ x: 2, y: 0, w: 1, h: 1 });
		expect(lcdPixels({ dot: 1, pitch: 2 }).width).toBe(189);
	});
});

describe('lcdTargets', () => {
	it('drives each cell with its glyph, the descender row empty; lines cut, rows split', () => {
		const target = lcdTargets('AB\nC');
		expect(target).toHaveLength(ACROSS * 16);
		expect(cellRows(target, 0, 0)).toEqual([...glyph5x7('A'), 0]);
		expect(cellRows(target, 0, 1)).toEqual([...glyph5x7('C'), 0]);
		expect(lcdTargets(['ABCDEFGHIJKLMNOPQ'], { cols: 2, rows: 1 })).toHaveLength(80);
	});

	it('CGRAM code points win; the glyphs table teaches the face more', () => {
		const target = lcdTargets('\u0000Å', { cgram: [[31, 0, 0, 0, 0, 0, 0, 31]] });
		expect(cellRows(target, 0, 0)).toEqual([31, 0, 0, 0, 0, 0, 0, 31]);
		expect(cellRows(target, 1, 0)).toEqual([...glyph5x7('Å'), 0]); // the fallback box
		const latin = lcdTargets(' Å', { glyphs: LATIN_5X7 });
		expect(cellRows(latin, 1, 0)).toEqual([...compile5x7(LATIN_5X7['Å']), 0]);
	});

	it('the line cursor holds; the block blinks with t, clamped onto the grid', () => {
		const line = lcdTargets('', { cursor: { col: 3, row: 1, style: 'line' }, t: 0.6 });
		expect(cellRows(line, 3, 1)).toEqual([0, 0, 0, 0, 0, 0, 0, 31]);
		const block = (t: number) =>
			cellRows(lcdTargets('', { cursor: { col: 99, row: 99, style: 'block' }, t }), 15, 1);
		expect(block(0)).toEqual(Array(8).fill(31));
		expect(block(0.6)).toEqual(Array(8).fill(0));
		expect(block(1.1)).toEqual(Array(8).fill(31));
	});

	it('boot shows the top row as solid blocks for 0.8 s; power off drives nothing', () => {
		const booting = lcdTargets('HI', { boot: true, t: 0.5 });
		expect(booting.subarray(0, 8 * ACROSS).every((v) => v === 1)).toBe(true);
		expect(booting.subarray(8 * ACROSS).every((v) => v === 0)).toBe(true);
		expect(cellRows(lcdTargets('HI', { boot: true, t: 0.9 }), 0, 0)).toEqual([...glyph5x7('H'), 0]);
		expect(lcdTargets('HI', { on: false }).every((v) => v === 0)).toBe(true);
	});
});

describe('the crystals', () => {
	it('rise beats fall, so moving text drags its ghost', () => {
		const state = Float32Array.from([0, 1]);
		expect(stepCrystals(state, [1, 0], 0.05)).toBe(true);
		expect(state[0]).toBeGreaterThan(1 - state[1]);
	});

	it('a step is exact: one long step lands where many short ones do', () => {
		const one = Float32Array.from([0, 1, 0.3]);
		const many = Float32Array.from(one);
		stepCrystals(one, [1, 0, 1], 0.1);
		for (let i = 0; i < 10; i++) stepCrystals(many, [1, 0, 1], 0.01);
		[...one].forEach((v, i) => expect(many[i]).toBeCloseTo(v, 5));
		expect(crystalAt(0, 1, 0.1)).toBeCloseTo(one[0], 6);
		expect(crystalAt(1, 0, 0.1)).toBeCloseTo(one[1], 6);
	});

	it('settles exactly on its targets, and response 0 snaps', () => {
		const state = new Float32Array(4);
		expect(stepCrystals(state, [1, 0, 1, 0], 5)).toBe(false);
		expect([...state]).toEqual([1, 0, 1, 0]);
		const snap = new Float32Array(2);
		expect(stepCrystals(snap, [1, 1], 0.001, 0)).toBe(false);
		expect([...snap]).toEqual([1, 1]);
		expect(crystalAt(0, 1, 0.001, 0)).toBe(1);
		expect(crystalAt(0.4, 1, 0)).toBeCloseTo(0.4, 6);
	});
});

describe('lcdInk', () => {
	const { ghost } = PANELS.green;
	const blank = new Float32Array(ACROSS * 16);

	it('undriven dots keep the ghost lattice; driven dots are full ink', () => {
		expect([...new Set(lcdInk(blank))].map((v) => +v.toFixed(5))).toEqual([ghost]);
		expect(lcdInk(blank, { ghost: false }).every((v) => v === 0)).toBe(true);
		const state = Float32Array.from(lcdTargets('8'));
		const ink = lcdInk(state);
		state.forEach((s, i) => s && expect(ink[i]).toBeCloseTo(1, 5));
		expect(lcdInk(state, { contrast: 0.05 })[state.indexOf(1)]).toBeLessThan(ghost);
	});

	it('overdriven contrast darkens the lattice and streaks the driven columns', () => {
		// Column 0 half driven, column 40 empty.
		const state = new Float32Array(ACROSS * 16);
		for (let row = 0; row < 8; row++) state[at(0, row)] = 1;
		const clean = lcdInk(state);
		const over = lcdInk(state, { contrast: 1 });
		expect(over[at(40, 12)]).toBeGreaterThan(clean[at(40, 12)] * 2);
		expect(over[at(0, 12)]).toBeGreaterThan(over[at(40, 12)] * 1.5);
		expect(clean[at(0, 12)] - clean[at(40, 12)]).toBeLessThan(0.02);
	});

	it('the negative blue glass needs its backlight; ink there is the light let through', () => {
		const state = Float32Array.from(lcdTargets('8'));
		const i = state.indexOf(1);
		expect(lcdInk(state, { panel: 'blue' })[i]).toBeCloseTo(1, 5);
		expect(lcdInk(state, { panel: 'blue', backlight: false })[i]).toBeCloseTo(0.12, 5);
		expect(lcdInk(state, { backlight: false })[i]).toBeCloseTo(1, 5); // reflective
	});

	it('age wears the dot columns: one dies to bare lattice, seeded and repeatable', () => {
		const state = new Float32Array(ACROSS * 16).fill(1);
		const wear = wearOf(ACROSS, 7);
		const dying = wear.indexOf(Math.max(...wear));
		const worn = lcdInk(state, { age: 1, seed: 7, t: 3 });
		for (let row = 0; row < 16; row++) expect(worn[at(dying, row)]).toBeCloseTo(ghost, 5);
		const fresh = lcdInk(state);
		expect(worn[at((dying + 1) % ACROSS, 0)]).toBeLessThan(fresh[0]);
		expect([...lcdInk(state, { age: 0.8, seed: 7, t: 12.3 })]).toEqual([
			...lcdInk(state, { age: 0.8, seed: 7, t: 12.3 })
		]);
	});
});
