// The pixel panel is pure data — node-testable by design. It is driven by the canvas panel's
// own `driveElement`, so its parts must carry the canvas panel's addresses, part for part.
import { describe, expect, it } from 'vitest';

import { segmentBits, wordRuns } from '../faces';
import { compilePanel, driveElement, fallPeaks, GRID_COLS, type VfdElement } from '../panel';
import type { PixelRect } from '../pixel';
import { compilePixelPanel, stepPhosphor, vfdLevels, vfdTargets } from '../pixel-panel';
import { pixelSegments } from '../pixel-segments';

const FRAME: [number, number] = [96, 48];
const FACE: VfdElement[] = [
	{ kind: 'rule', name: 'edge', shape: 'box', x: 0, y: 0, w: 96, h: 48 },
	{ kind: 'digits', name: 'clock', chars: 4, glyphs: '7seg', x: 3, y: 3, w: 40, h: 14 },
	{ kind: 'digits', name: 'band', chars: 5, glyphs: 'matrix', x: 47, y: 3, w: 30, h: 7 },
	{ kind: 'legend', name: 'st', text: 'ST', x: 80, y: 3, w: 11, h: 7 },
	{ kind: 'legend', name: 'src', text: 'TUNER', x: 47, y: 12, w: 29, h: 7, printed: true },
	{
		kind: 'bars',
		name: 'spec',
		bands: 8,
		rows: 8,
		peakHold: true,
		scale: ['L', 'R'],
		x: 3,
		y: 20,
		w: 32,
		h: 24
	},
	{ kind: 'dots', name: 'ticker', cols: 24, rows: 7, gap: 0.5, x: 40, y: 24, w: 48, h: 14 }
];
const panel = compilePixelPanel(FRAME, FACE);
const partsOf = (name: string) => {
	const el = panel.elements[panel.byName.get(name)!];
	return panel.parts.slice(el.first, el.first + el.count);
};
const cells = (r: PixelRect) =>
	Array.from({ length: r.w * r.h }, (_, i) => `${r.x + (i % r.w)},${r.y + Math.floor(i / r.w)}`);

describe('compilePixelPanel — the anodes in whole pixels', () => {
	it('draws whole rects inside the frame, no two parts sharing a pixel', () => {
		const seen = new Set<string>();
		for (const p of panel.parts) {
			for (const r of p.rects) {
				for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
				expect(r.w).toBeGreaterThan(0);
				expect(r.h).toBeGreaterThan(0);
				expect(r.x + r.w).toBeLessThanOrEqual(panel.width);
				expect(r.y + r.h).toBeLessThanOrEqual(panel.height);
				for (const c of cells(r)) {
					expect(seen.has(c)).toBe(false);
					seen.add(c);
				}
			}
			expect(p.col).toBeGreaterThanOrEqual(0);
			expect(p.col).toBeLessThan(GRID_COLS);
		}
	});

	it("carries the canvas panel's addresses, part for part", () => {
		const canvas = compilePanel(FRAME, FACE);
		const address = (a: { el: number; cell: number; sub: number; printed: boolean }) =>
			`${a.el}:${a.cell}:${a.sub}:${a.printed}`;
		expect(panel.parts.map(address)).toEqual(canvas.anodes.map(address));
		expect(panel.driven).toBe(canvas.driven);
		const shape = (e: (typeof panel.elements)[number]) =>
			[e.name, e.first, e.count, e.cells, e.stride, e.segments, e.dense].join(' ');
		expect(panel.elements.map(shape)).toEqual(canvas.elements.map(shape));
	});

	it('7seg digits are the shared pixel segments, the point and colon in the gutter', () => {
		const clock = partsOf('clock');
		// 4 cells × (7 segments + dp + 2 colon beads), on a 10 px pitch.
		expect(clock).toHaveLength(40);
		const seg = pixelSegments(14, { stroke: 1, width: 7 });
		const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
		names.forEach((n, i) =>
			expect(clock[10 + i].rects).toEqual([{ ...seg[n], x: 3 + 10 + seg[n].x, y: 3 + seg[n].y }])
		);
		const [dp, colon1, colon2] = clock.slice(7, 10).map((p) => p.rects[0]);
		// A pixel clear of its digit and of the next one.
		expect(dp).toEqual({ x: 3 + 8, y: 3 + 13, w: 1, h: 1 });
		expect(colon1).toEqual({ x: 11, y: 3 + 4, w: 1, h: 1 });
		expect(colon2).toEqual({ x: 11, y: 3 + 8, w: 1, h: 1 });
	});

	it('draws the 5×7 face: a matrix dot per part, a legend one part of merged runs', () => {
		const band = partsOf('band');
		expect(band).toHaveLength(5 * 35);
		expect(band.every((p) => p.rects.length === 1 && p.rects[0].w === 1)).toBe(true);
		// Dot (row 1, col 2) of cell 1: 6 px a cell, a pixel a dot.
		expect(band[35 + 7].rects[0]).toEqual({ x: 47 + 6 + 2, y: 3 + 1, w: 1, h: 1 });

		const [st] = partsOf('st');
		const ink = (rs: PixelRect[]) => rs.reduce((n, r) => n + r.w * r.h, 0);
		expect(ink(st.rects)).toBe(ink(wordRuns('ST').rects));
		expect(st.rects.length).toBe(wordRuns('ST').rects.length);
		expect(partsOf('src')[0].printed).toBe(true);

		// From a 3 px dot, a pixel of gutter between dots.
		const big = compilePixelPanel(
			[40, 30],
			[{ kind: 'digits', name: 'm', chars: 2, glyphs: 'matrix', x: 0, y: 0, w: 36, h: 21 }]
		);
		expect(big.parts[0].rects[0]).toMatchObject({ w: 2, h: 2 });
		expect(big.parts[1].rects[0].x - big.parts[0].rects[0].x).toBe(3);
	});

	it('bars: blocks with a gutter, row 0 at the bottom, a printed scale under them', () => {
		const spec = partsOf('spec');
		const blocks = spec.filter((p) => !p.printed);
		expect(blocks).toHaveLength(64);
		// 32 px over 8 bands, 16 px over 8 rows (the scale takes 8): 3×1 blocks.
		expect(blocks[0].rects).toEqual([{ x: 3, y: 20 + 16 - 1, w: 3, h: 1 }]);
		expect(blocks[1].rects[0].y).toBe(20 + 16 - 3);
		expect(blocks[8].rects[0].x).toBe(3 + 4);
		const labels = spec.filter((p) => p.printed);
		expect(labels).toHaveLength(2);
		expect(labels.every((p) => p.rects.every((r) => r.y >= 20 + 17))).toBe(true);
	});

	it('dots: column-major, row 0 at the top; `gap` opens a gutter, round dots lose corners', () => {
		const ticker = partsOf('ticker');
		expect(ticker).toHaveLength(24 * 7);
		expect(ticker[0].rects).toEqual([{ x: 40, y: 24, w: 1, h: 1 }]);
		expect(ticker[1].rects).toEqual([{ x: 40, y: 26, w: 1, h: 1 }]);
		expect(ticker[7].rects).toEqual([{ x: 42, y: 24, w: 1, h: 1 }]);
		const round = compilePixelPanel(
			[10, 5],
			[{ kind: 'dots', name: 'd', cols: 2, rows: 1, dot: 'round', gap: 0, x: 0, y: 0, w: 10, h: 5 }]
		);
		const covered = round.parts[0].rects.flatMap(cells);
		expect(covered).toHaveLength(25 - 4);
		expect(covered).not.toContain('0,0');
	});

	it('throws on kinds without a pixel form, naming the element', () => {
		const one = (el: VfdElement) => () => compilePixelPanel([64, 32], [el]);
		const box = { x: 0, y: 0, w: 60, h: 20 };
		expect(one({ kind: 'icon', name: 'play', d: 'M0 0 L10 5 L0 10 Z', ...box })).toThrow(
			/"play" is an icon/
		);
		expect(one({ kind: 'scale', name: 'tune', ...box })).toThrow(/"tune" is a scale/);
		expect(one({ kind: 'digits', name: 'main', chars: 4, ...box })).toThrow(
			/"main" is 14seg \(the default\) digits/
		);
		expect(one({ kind: 'digits', name: 'x', chars: 4, glyphs: '16seg', ...box })).toThrow(
			/"x" is 16seg/
		);
	});

	it('throws when a box is too small for its element, saying what it needs', () => {
		const one = (el: VfdElement) => () => compilePixelPanel([64, 32], [el]);
		expect(
			one({ kind: 'digits', name: 'c', chars: 8, glyphs: '7seg', x: 0, y: 0, w: 40, h: 14 })
		).toThrow(/"c" gives each digit 5 × 14 px/);
		expect(
			one({ kind: 'digits', name: 'm', chars: 8, glyphs: 'matrix', x: 0, y: 0, w: 40, h: 7 })
		).toThrow(/needs 6 × 7/);
		expect(one({ kind: 'legend', name: 'l', text: 'MONO', x: 0, y: 0, w: 20, h: 7 })).toThrow(
			/needs 23 × 7 px for "MONO"/
		);
		expect(one({ kind: 'bars', name: 'b', bands: 40, rows: 4, x: 0, y: 0, w: 30, h: 8 })).toThrow(
			/a pixel per band/
		);
		expect(() => compilePixelPanel([0, 32], [])).toThrow(/frame/);
	});
});

describe('vfdTargets — the drive API onto pixel parts', () => {
	const at = (t: Float32Array, name: string) => {
		const el = panel.elements[panel.byName.get(name)!];
		return Array.from(t.subarray(el.first, el.first + el.count));
	};

	it('drives each kind by name, matching driveElement on the canvas panel', () => {
		const levels = [1, 0.5, 0.25, 0, 0, 0, 0, 0];
		const t = vfdTargets(panel, {
			clock: '12:34',
			band: 'FM 98',
			st: true,
			spec: levels,
			ticker: (x, y) => (x === y ? 1 : 0)
		});
		const canvas = compilePanel(FRAME, FACE);
		const out = new Float32Array(canvas.anodes.length);
		const states = {
			clock: { text: '12:34' },
			band: { text: 'FM 98' },
			st: { on: true },
			spec: { levels },
			ticker: { bitmap: (x: number, y: number) => (x === y ? 1 : 0) }
		};
		for (const el of canvas.elements)
			driveElement(el, states[el.name as keyof typeof states] ?? {}, out);
		canvas.anodes.forEach((a, i) => {
			if (a.printed) out[i] = 0;
		});
		expect(Array.from(t)).toEqual(Array.from(out));

		// '1' on cell 0, its colon riding cell 1.
		const clock = at(t, 'clock');
		const bits = segmentBits('7seg', '1');
		for (let s = 0; s < 7; s++) expect(clock[s]).toBe(bits & (1 << s) ? 1 : 0);
		expect(clock.slice(17, 20)).toEqual([0, 1, 1]);
	});

	it("falls back to the layout's own value and on, and holds caps through an ElementState", () => {
		const declared = compilePixelPanel(
			[40, 20],
			[
				{ kind: 'legend', name: 'rec', text: 'REC', on: true, x: 0, y: 0, w: 17, h: 7 },
				{
					kind: 'digits',
					name: 'd',
					chars: 2,
					glyphs: '7seg',
					value: '8',
					x: 0,
					y: 8,
					w: 12,
					h: 8
				},
				{ kind: 'bars', name: 'b', bands: 1, rows: 4, peakHold: true, x: 20, y: 0, w: 4, h: 8 }
			]
		);
		const peaks = [-1];
		fallPeaks(peaks, [1], 4, 4, 0.016);
		fallPeaks(peaks, [0], 4, 4, 0.5);
		const t = vfdTargets(declared, { b: { levels: [0], peaks } });
		expect(t[0]).toBe(1);
		expect(Array.from(t.subarray(1, 8))).toEqual([1, 1, 1, 1, 1, 1, 1]);
		// The cap fell two rows in half a second; the body is gone.
		expect(Array.from(t.subarray(21, 25))).toEqual([0, 0, 1, 0]);
	});

	it('self-test lights every wired part; silkscreen stays 0', () => {
		const t = vfdTargets(panel, {}, { selfTest: true });
		panel.parts.forEach((p, i) => expect(t[i]).toBe(p.printed ? 0 : 1));
	});

	it('throws on an unknown name and on a value of the wrong kind', () => {
		expect(() => vfdTargets(panel, { nope: 'x' })).toThrow(/no pixel panel element named "nope"/);
		expect(() => vfdTargets(panel, { st: 'on' })).toThrow(
			/"st" is a legend element, driven by a boolean/
		);
		expect(() => vfdTargets(panel, { edge: true })).toThrow(/a rule is ink/);
	});
});

describe('stepPhosphor — persistence', () => {
	it('lights in about a frame and lets go at the persistence × lag rate', () => {
		const up = stepPhosphor(new Float32Array([0]), [1], 0.012);
		expect(up[0]).toBeCloseTo(1 - Math.exp(-1), 3);
		const tau = (persistence: number, lag: number) => 0.02 + persistence * lag * 0.34;
		const down = stepPhosphor(new Float32Array([1]), [0], 0.05, { persistence: 0.5 });
		expect(down[0]).toBeCloseTo(Math.exp(-0.05 / tau(0.5, 1)), 3);
		const blue = stepPhosphor(new Float32Array([1]), [0], 0.05, {
			persistence: 0.5,
			phosphor: 'blue'
		});
		expect(blue[0]).toBeCloseTo(Math.exp(-0.05 / tau(0.5, 1.35)), 3);
	});

	it('snaps once the rest is invisible; persistence 0 lands at once; time only runs forward', () => {
		expect(stepPhosphor(new Float32Array([0.999]), [1], 0.02)[0]).toBe(1);
		expect(
			Array.from(stepPhosphor(new Float32Array([1, 0]), [0, 1], 0.001, { persistence: 0 }))
		).toEqual([0, 1]);
		expect(stepPhosphor(new Float32Array([0.5]), [1], -1)[0]).toBe(0.5);
	});
});

describe('vfdLevels — dimmer, wear and grid banding', () => {
	const lit = vfdTargets(panel, {}, { selfTest: true });

	it('raises the dimmer to 1.5 and leaves its input alone', () => {
		const copy = Float32Array.from(lit);
		expect(Array.from(vfdLevels(panel, lit))).toEqual(Array.from(lit));
		const dim = vfdLevels(panel, lit, { brightness: 0.25 });
		panel.parts.forEach((p, i) => expect(dim[i]).toBeCloseTo(p.printed ? 0 : 0.125, 5));
		expect(Array.from(lit)).toEqual(Array.from(copy));
	});

	it('wears the wired parts: one dead from 0.95, and a weak grid column dims a band', () => {
		const dead = vfdLevels(panel, lit, { age: 0.95, seed: 3, t: 0 });
		const wired = panel.parts.flatMap((p, i) => (p.printed ? [] : [dead[i]]));
		expect(wired.filter((v) => v === 0)).toHaveLength(1);
		expect(Array.from(vfdLevels(panel, lit, { age: 0.95, seed: 3, t: 0 }))).toEqual(
			Array.from(dead)
		);

		// Across the 0.6 threshold only one column's parts drop, by more than wear alone moves.
		const before = vfdLevels(panel, lit, { age: 0.599, seed: 3 });
		const after = vfdLevels(panel, lit, { age: 0.6, seed: 3 });
		const dropped = new Set<number>();
		panel.parts.forEach((p, i) => {
			if (!p.printed && after[i] < before[i] * 0.5) dropped.add(p.col);
		});
		expect(dropped.size).toBe(1);
	});
});
