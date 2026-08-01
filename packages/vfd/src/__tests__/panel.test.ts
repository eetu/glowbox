// The anode inventory and the value→address arithmetic — all pure, so it runs in node
// with no canvas. These are the tests that would otherwise be debugged through pixels.
import { describe, expect, it } from 'vitest';

import {
	CELL,
	CELL_EXTRAS,
	cellGeometry,
	matrixDotLit,
	segmentBits,
	segmentCount,
	segmentNames,
	wordRuns
} from '../faces';
import {
	compilePanel,
	driveElement,
	type ElementState,
	fallPeaks,
	GRID_COLS,
	layCells,
	type VfdElement
} from '../panel';

const drive = (panel: ReturnType<typeof compilePanel>, name: string, state: object) => {
	const out = new Float32Array(panel.anodes.length);
	const el = panel.elements[panel.byName.get(name)!];
	driveElement(el, state, out);
	return { out, el };
};

describe('faces — segment geometry and glyph tables', () => {
	it('counts segments per mode and names them in sub order', () => {
		expect(segmentCount('7seg')).toBe(7);
		expect(segmentCount('14seg')).toBe(16);
		expect(segmentCount('16seg')).toBe(16);
		// 14-seg carries the same anodes as 16-seg; it just drives the split bars welded.
		expect(segmentNames('16seg')).toHaveLength(16 + CELL_EXTRAS);
		expect(segmentNames('7seg')).toHaveLength(7 + CELL_EXTRAS);
		expect(segmentNames('7seg').slice(-CELL_EXTRAS)).toEqual(['dp', 'colon1', 'colon2']);
	});

	it('lights the same strokes for a numeral in every segment mode', () => {
		// The whole point of authoring numerals off the seven-segment strokes: a
		// frequency reads identically whichever mode a panel mixes in.
		const bits16 = segmentBits('16seg', '8');
		const names16 = segmentNames('16seg');
		const lit16 = new Set(names16.filter((_, i) => bits16 & (1 << i)));
		expect(lit16).toEqual(new Set(['a1', 'a2', 'b', 'c', 'd1', 'd2', 'e', 'f', 'g1', 'g2']));

		const bits7 = segmentBits('7seg', '8');
		const names7 = segmentNames('7seg');
		const lit7 = new Set(names7.filter((_, i) => bits7 & (1 << i)));
		expect(lit7).toEqual(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']));
	});

	it('welds the split top and bottom bars for 14-segment', () => {
		const names = segmentNames('16seg');
		const a1 = names.indexOf('a1');
		const a2 = names.indexOf('a2');
		// '?' lights a1 and a2 already; a glyph that lights only ONE half is the real
		// test, so use Z's diagonal-with-top-bar and a synthetic single-half check via
		// the '[' / ']' brackets, which are authored one half each.
		const open16 = segmentBits('16seg', '[');
		expect(!!(open16 & (1 << a1))).toBe(true);
		expect(!!(open16 & (1 << a2))).toBe(false);
		const open14 = segmentBits('14seg', '[');
		expect(!!(open14 & (1 << a1))).toBe(true);
		expect(!!(open14 & (1 << a2))).toBe(true);
	});

	it('is case tolerant and blanks unmapped characters', () => {
		expect(segmentBits('16seg', 'a')).toBe(segmentBits('16seg', 'A'));
		expect(segmentBits('16seg', ' ')).toBe(0);
		expect(segmentBits('16seg', 'é')).toBe(0);
		// Seven-segment's `b`/`d` shapes ARE the lowercase letters, either case accepted.
		expect(segmentBits('7seg', 'B')).toBe(segmentBits('7seg', 'b'));
	});

	it('matches the reference tables for the diagonal letters', () => {
		// The starburst makes these hard, so they are pinned against the classic
		// 16-segment ASCII tables rather than to taste. `h j`/`k m` are the upper and
		// lower diagonal pairs: W's middle peak is the lower one, M's valley the upper.
		const names = segmentNames('16seg');
		const set = (ch: string) =>
			new Set(names.filter((_, i) => segmentBits('16seg', ch) & (1 << i)));
		expect(set('V')).toEqual(new Set(['f', 'e', 'k', 'j']));
		expect(set('Y')).toEqual(new Set(['h', 'j', 'l']));
		expect(set('X')).toEqual(new Set(['h', 'j', 'k', 'm']));
		expect(set('W')).toEqual(new Set(['f', 'e', 'k', 'm', 'b', 'c']));
		expect(set('M')).toEqual(new Set(['f', 'e', 'h', 'j', 'b', 'c']));
	});

	it('gives every letter ink that reaches the baseline', () => {
		// A PROPERTY, not a snapshot: it says nothing about which segments a letter uses, so
		// it stays true through any re-spelling. It covers what the mask tests above cannot —
		// a glyph of the wrong SIZE, which every mask assertion happily passes. Letters bottom
		// out between 89.5 and 93.7 in a 100-tall cell, so 85 is a wide margin.
		for (const mode of ['14seg', '16seg'] as const) {
			const geom = cellGeometry(mode);
			for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
				const bits = segmentBits(mode, ch);
				const ys: number[] = [];
				for (let s = 0; s < segmentCount(mode); s++) {
					if (!(bits & (1 << s))) continue;
					for (let i = 1; i < geom[s].length; i += 2) ys.push(geom[s][i]);
				}
				expect(ys.length, `${ch} (${mode}) has no lit segments`).toBeGreaterThan(0);
				expect(Math.max(...ys), `${ch} (${mode}) floats above the baseline`).toBeGreaterThan(
					CELL.height * 0.85
				);
			}
		}
	});

	it('merges word bitmaps into solid runs', () => {
		const { rects, width, height } = wordRuns('ST');
		expect(height).toBe(7);
		expect(width).toBe(11); // two 5-wide glyphs + one column of gap
		expect(rects.length).toBeGreaterThan(0);
		// The merge has to actually merge: T's stem is one tall rect, not seven dots.
		const tall = rects.filter((r) => r.h > 1);
		expect(tall.length).toBeGreaterThan(0);
		// A solid word must use far fewer rects than it has lit dots.
		let dots = 0;
		for (const ch of 'ST')
			for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (matrixDotLit(ch, r, c)) dots++;
		expect(rects.length).toBeLessThan(dots);
	});

	it('gives an empty word no geometry', () => {
		expect(wordRuns('').rects).toHaveLength(0);
		expect(wordRuns('   ').rects).toHaveLength(0);
	});
});

describe('layCells — the driver-chip text mapping', () => {
	it("attaches '.' and ':' to the cell before them", () => {
		// The point rode the '8', so five characters occupy four cells and the fifth
		// pads blank.
		const cells = layCells('98.50', 5, 'left', true);
		expect(cells.map((c) => c.ch).join('')).toBe('9850 ');
		expect(cells[1].dp).toBe(true);
		expect(cells[0].dp).toBe(false);
	});

	it('fits FM 98.50 in eight cells', () => {
		const cells = layCells('FM 98.50', 8, 'left', true);
		expect(cells.map((c) => c.ch).join('')).toBe('FM 9850 ');
		expect(cells.filter((c) => c.dp)).toHaveLength(1);
	});

	it('lets a matrix cell spend a whole cell on the point', () => {
		const cells = layCells('98.50', 5, 'left', false);
		expect(cells.map((c) => c.ch).join('')).toBe('98.50');
		expect(cells.every((c) => !c.dp)).toBe(true);
	});

	it('opens a new cell for a second consecutive point', () => {
		const cells = layCells('1..2', 4, 'left', true);
		expect(cells[0].ch).toBe('1');
		expect(cells[0].dp).toBe(true);
		expect(cells[1].ch).toBe('.');
	});

	it('pads right-aligned values from the left', () => {
		expect(
			layCells('7', 4, 'right', true)
				.map((c) => c.ch)
				.join('')
		).toBe('   7');
	});

	it('truncates past the hardware width', () => {
		expect(layCells('ABCDEFGH', 4, 'left', true)).toHaveLength(4);
		expect(
			layCells('ABCDEFGH', 4, 'left', true)
				.map((c) => c.ch)
				.join('')
		).toBe('ABCD');
	});
});

describe('compilePanel — the anode inventory', () => {
	it('gives a digits element stride anodes per cell', () => {
		const panel = compilePanel([100, 20], [
			{ kind: 'digits', name: 'main', chars: 4, glyphs: '16seg', x: 0, y: 0, w: 100, h: 20 }
		] satisfies VfdElement[]);
		const el = panel.elements[0];
		expect(el.stride).toBe(16 + CELL_EXTRAS);
		expect(el.count).toBe(4 * el.stride);
		expect(panel.anodes).toHaveLength(el.count);
		// Every anode is addressable — the drive path depends on it.
		expect(el.index.size).toBe(el.count);
	});

	it('gives a matrix cell one anode per dot', () => {
		const panel = compilePanel([100, 20], [
			{ kind: 'digits', name: 'm', chars: 2, glyphs: 'matrix', x: 0, y: 0, w: 100, h: 20 }
		] satisfies VfdElement[]);
		expect(panel.elements[0].stride).toBe(35);
		expect(panel.anodes).toHaveLength(70);
	});

	it('makes a legend word ONE anode with many polygons', () => {
		// Physically one printed patch on one wire: it must light as a unit, not as a
		// crowd of independent dots.
		const panel = compilePanel([100, 20], [
			{ kind: 'legend', name: 'dolby', text: 'DOLBY NR', x: 0, y: 0, w: 60, h: 8 }
		] satisfies VfdElement[]);
		expect(panel.anodes).toHaveLength(1);
		expect(panel.anodes[0].polys.length).toBeGreaterThan(5);
		expect(panel.driven).toBe(1);
	});

	it('marks printed elements as silkscreen and keeps them off the driven count', () => {
		const panel = compilePanel([100, 20], [
			{ kind: 'legend', name: 'lit', text: 'CD', x: 0, y: 0, w: 20, h: 8 },
			{ kind: 'legend', name: 'ink', text: 'TAPE', x: 20, y: 0, w: 20, h: 8, printed: true },
			{ kind: 'rule', name: 'box', shape: 'box', x: 0, y: 10, w: 90, h: 8 }
		] satisfies VfdElement[]);
		expect(panel.anodes).toHaveLength(3);
		expect(panel.driven).toBe(1);
		expect(panel.anodes[2].polys).toHaveLength(4); // a box outline is four sides
		// A printed anode is never addressable — nothing can drive ink.
		expect(panel.elements[1].index.size).toBe(0);
		expect(panel.elements[2].index.size).toBe(0);
	});

	it('lays bars out band-major with row 0 at the bottom', () => {
		const panel = compilePanel([100, 40], [
			{ kind: 'bars', name: 'spec', bands: 3, rows: 4, x: 0, y: 0, w: 60, h: 40 }
		] satisfies VfdElement[]);
		expect(panel.anodes).toHaveLength(12);
		const at = (b: number, r: number) => panel.anodes[panel.elements[0].index.get(b * 1024 + r)!];
		const yOf = (a: (typeof panel.anodes)[number]) => a.polys[0][1];
		// Row 0 sits lower on the plate (larger y) than row 3.
		expect(yOf(at(0, 0))).toBeGreaterThan(yOf(at(0, 3)));
		// Bands march rightward.
		expect(at(2, 0).polys[0][0]).toBeGreaterThan(at(0, 0).polys[0][0]);
	});

	it('reserves room for a printed bar scale', () => {
		const plain = compilePanel([100, 40], [
			{ kind: 'bars', name: 's', bands: 2, rows: 4, x: 0, y: 0, w: 40, h: 40 }
		] satisfies VfdElement[]);
		const scaled = compilePanel([100, 40], [
			{
				kind: 'bars',
				name: 's',
				bands: 2,
				rows: 4,
				scale: ['-30', '0dB'],
				x: 0,
				y: 0,
				w: 40,
				h: 40
			}
		] satisfies VfdElement[]);
		expect(scaled.driven).toBe(plain.driven);
		expect(scaled.anodes.length).toBeGreaterThan(plain.anodes.length);
		// The grid gave up height to the labels.
		const h = (p: typeof plain) => {
			const a = p.anodes[p.elements[0].index.get(0)!];
			return a.polys[0][5] - a.polys[0][1];
		};
		expect(h(scaled)).toBeLessThan(h(plain));
	});

	it('turns an icon path into one filled anode', () => {
		const panel = compilePanel([100, 20], [
			{ kind: 'icon', name: 'play', d: 'M0 0 L10 5 L0 10 Z', x: 0, y: 0, w: 10, h: 10 }
		] satisfies VfdElement[]);
		expect(panel.anodes).toHaveLength(1);
		expect(panel.anodes[0].polys).toHaveLength(1);
		expect(panel.anodes[0].polys[0]).toHaveLength(6); // three points, closed implicitly
	});

	it('builds a scale as discrete cursor steps plus printed ticks', () => {
		const panel = compilePanel([100, 20], [
			{
				kind: 'scale',
				name: 'tune',
				steps: 10,
				ticks: 5,
				labels: [{ at: 0, text: '88' }],
				x: 0,
				y: 0,
				w: 100,
				h: 20
			}
		] satisfies VfdElement[]);
		expect(panel.driven).toBe(10);
		expect(panel.anodes.length).toBe(10 + 5 + 1);
	});

	it('throws on a duplicate or missing element name', () => {
		// Names are the wiring. Keeping the first of a duplicate and warning about it left the
		// second element silently undriveable, which is a miserable thing to debug.
		expect(() =>
			compilePanel([100, 20], [
				{ kind: 'legend', name: 'dup', text: 'A', x: 0, y: 0, w: 20, h: 8 },
				{ kind: 'legend', name: 'dup', text: 'B', x: 30, y: 0, w: 20, h: 8 }
			] satisfies VfdElement[])
		).toThrow(/two panel elements are named "dup"/);
		expect(() =>
			compilePanel([100, 20], [
				{ kind: 'legend', name: '', text: 'A', x: 0, y: 0, w: 20, h: 8 }
			] satisfies VfdElement[])
		).toThrow(/needs a name/);
	});

	it('requires a box, unless an icon is placed in a shared frame', () => {
		expect(() =>
			// @ts-expect-error - deliberately omitting the box on a kind that needs one
			compilePanel([100, 20], [{ kind: 'legend', name: 'x', text: 'A' }])
		).toThrow(/needs x\/y\/w\/h/);
		// A framed icon needs none: its path is already in frame coordinates.
		const framed = compilePanel([320, 64], [
			{ kind: 'icon', name: 'mark', d: 'M10 10 L30 10 L30 26 L10 26 Z', frame: [320, 64] }
		] satisfies VfdElement[]);
		const el = framed.elements[0];
		// Placed exactly as authored — no scaling, no centring.
		expect(el.bounds.x).toBeCloseTo(10);
		expect(el.bounds.y).toBeCloseTo(10);
		expect(el.bounds.w).toBeCloseTo(20);
		expect(el.bounds.h).toBeCloseTo(16);
	});

	it('keeps several pieces of one drawing in register through a shared frame', () => {
		const shared: [number, number] = [100, 100];
		const panel = compilePanel([100, 100], [
			{ kind: 'icon', name: 'a', d: 'M0 0 L10 0 L10 10 Z', frame: shared },
			{ kind: 'icon', name: 'b', d: 'M90 90 L100 90 L100 100 Z', frame: shared }
		] satisfies VfdElement[]);
		// Each lands where the drawing put it, not centred in a box of its own.
		expect(panel.anodes[0].polys[0][0]).toBeCloseTo(0);
		expect(panel.anodes[1].polys[0][0]).toBeCloseTo(90);
	});

	it('assigns every anode a multiplex grid column from its own position', () => {
		// The column comes off the anode's own centroid, which is what makes a failing
		// grid dim a vertical band across whatever elements sit in it.
		const panel = compilePanel([320, 64], [
			{ kind: 'legend', name: 'l', text: 'L', x: 4, y: 0, w: 10, h: 8 },
			{ kind: 'legend', name: 'm', text: 'M', x: 150, y: 0, w: 20, h: 8 },
			{ kind: 'legend', name: 'r', text: 'R', x: 306, y: 0, w: 10, h: 8 }
		] satisfies VfdElement[]);
		const cols = panel.anodes.map((a) => a.col);
		expect(cols[0]).toBe(0);
		expect(cols[1]).toBe(GRID_COLS / 2); // centred on a 320-wide frame → middle grid
		expect(cols[2]).toBe(GRID_COLS - 1);
		// Never out of range, whatever the geometry.
		expect(cols.every((c) => c >= 0 && c < GRID_COLS)).toBe(true);
	});
});

describe('driveElement — value to lit anodes', () => {
	const panel = compilePanel([320, 64], [
		{ kind: 'digits', name: 'main', chars: 4, glyphs: '7seg', x: 0, y: 0, w: 80, h: 30 },
		{ kind: 'legend', name: 'st', text: 'ST', x: 90, y: 0, w: 12, h: 8 },
		{ kind: 'bars', name: 'spec', bands: 2, rows: 8, peakHold: true, x: 120, y: 0, w: 40, h: 30 },
		{ kind: 'scale', name: 'tune', steps: 11, x: 170, y: 0, w: 100, h: 16 }
	] satisfies VfdElement[]);

	it('lights the segments a numeral asks for', () => {
		const { out, el } = drive(panel, 'main', { text: '1' });
		const names = segmentNames('7seg');
		const lit = names.filter((_, s) => out[el.index.get(0 * 1024 + s)!] > 0);
		expect(lit).toEqual(['b', 'c']);
	});

	it('lights the decimal point without spending a cell', () => {
		const { out, el } = drive(panel, 'main', { text: '1.5' });
		const dpIndex = el.index.get(0 * 1024 + el.segments)!;
		expect(out[dpIndex]).toBe(1);
		// The '5' landed in cell 1, not cell 2.
		const cell1 = segmentNames('7seg').filter((_, s) => out[el.index.get(1024 + s)!] > 0);
		expect(cell1).toContain('f');
		expect(cell1).toContain('g');
	});

	it('lights both colon beads together', () => {
		const { out, el } = drive(panel, 'main', { text: '1:2' });
		expect(out[el.index.get(el.segments + 1)!]).toBe(1);
		expect(out[el.index.get(el.segments + 2)!]).toBe(1);
	});

	it('lights a legend as a whole word', () => {
		const on = drive(panel, 'st', { on: true });
		expect(on.out[on.el.first]).toBe(1);
		const off = drive(panel, 'st', { on: false });
		expect(off.out[off.el.first]).toBe(0);
	});

	it('fills bar blocks from the bottom up to the level', () => {
		const { out, el } = drive(panel, 'spec', { levels: [0.5, 0] });
		const lit = (b: number) =>
			Array.from({ length: 8 }, (_, r) => out[el.index.get(b * 1024 + r)!]);
		expect(lit(0)).toEqual([1, 1, 1, 1, 0, 0, 0, 0]);
		expect(lit(1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
	});

	it('holds the peak cap above a fallen body', () => {
		// Silent band, cap still up: the cap is the top block staying driven while the
		// body drops away beneath it — not a second set of anodes.
		const gone = drive(panel, 'spec', { levels: [0], peaks: [6.4] });
		const litGone = Array.from({ length: 8 }, (_, r) => gone.out[gone.el.index.get(r)!]);
		expect(litGone).toEqual([0, 0, 0, 0, 0, 0, 1, 0]);
		// A quiet-but-present band lights its bottom block as well as the cap.
		const quiet = drive(panel, 'spec', { levels: [0.1], peaks: [6.4] });
		const litQuiet = Array.from({ length: 8 }, (_, r) => quiet.out[quiet.el.index.get(r)!]);
		expect(litQuiet).toEqual([1, 0, 0, 0, 0, 0, 1, 0]);
	});

	it('drops the peak cap at the fall rate and never below the live level', () => {
		const peaks = [8, 2];
		fallPeaks(peaks, [0, 0.5], 8, 4, 0.5); // 4 rows/s for half a second = 2 rows
		expect(peaks[0]).toBeCloseTo(6);
		// Band 1's live level (0.5 * 8 = 4) is louder than its sagging cap — it lifts it.
		expect(peaks[1]).toBeCloseTo(4);
	});

	it('leaves a capless band capless when it is silent', () => {
		// -1 is "no cap". Resting one on row 0 because the level is 0 would light the floor row
		// of an element nobody is driving — and keep it lit, since the cap never falls further.
		// That is what `VfdPanel.blank` would otherwise be unable to clear.
		const peaks = [-1, -1];
		fallPeaks(peaks, [0, 0.5], 8, 4, 0.5);
		expect(peaks[0]).toBe(-1);
		// A band with real level still gets its cap, from nothing.
		expect(peaks[1]).toBeCloseTo(4);
	});

	it('snaps a continuous cursor to the nearest discrete step', () => {
		const mid = drive(panel, 'tune', { pos: 0.5 });
		expect(mid.out[mid.el.index.get(5 * 1024)!]).toBe(1);
		const end = drive(panel, 'tune', { pos: 1 });
		expect(end.out[end.el.index.get(10 * 1024)!]).toBe(1);
		// Exactly one cursor block is ever driven.
		expect(Array.from(mid.out).filter((v) => v > 0)).toHaveLength(1);
	});

	it('drives a dots grid from a bitmap or a function, keeping grey levels', () => {
		const dotted = compilePanel([100, 20], [
			{ kind: 'dots', name: 'screen', cols: 3, rows: 2, x: 0, y: 0, w: 30, h: 20 }
		] satisfies VfdElement[]);
		const el = dotted.elements[0];
		const read = (out: Float32Array) =>
			Array.from({ length: 2 }, (_, y) =>
				Array.from({ length: 3 }, (_, x) => out[el.index.get(x * 1024 + y)!])
			);
		// Row-major from the top-left, and fractional values survive — a multiplexed anode
		// dims by duty cycle, so a greyscale frame needs no dithering.
		const flat = new Float32Array(dotted.anodes.length);
		driveElement(el, { bitmap: [1, 0.5, 0, 0, 0.25, 1] }, flat);
		expect(read(flat)).toEqual([
			[1, 0.5, 0],
			[0, 0.25, 1]
		]);
		// A function gets (x, y).
		const fn = new Float32Array(dotted.anodes.length);
		driveElement(el, { bitmap: (x, y) => (y === 0 ? 1 : 0) }, fn);
		expect(read(fn)).toEqual([
			[1, 1, 1],
			[0, 0, 0]
		]);
		// Out-of-range and non-finite values are clamped rather than smuggled through.
		const bad = new Float32Array(dotted.anodes.length);
		driveElement(el, { bitmap: [5, -3, NaN, 0, 0, 0] }, bad);
		expect(read(bad)[0]).toEqual([1, 0, 0]);
		// No bitmap at all is dark, not a crash.
		const none = new Float32Array(dotted.anodes.length);
		driveElement(el, {}, none);
		expect(Array.from(none).every((v) => v === 0)).toBe(true);
	});

	it('leaves a rule alone — ink is not driveable', () => {
		const inked = compilePanel([100, 20], [
			{ kind: 'rule', name: 'r', x: 0, y: 0, w: 50, h: 2 }
		] satisfies VfdElement[]);
		const out = new Float32Array(inked.anodes.length);
		driveElement(inked.elements[0], { on: true }, out);
		expect(Array.from(out)).toEqual([0]);
	});

	it('leaves a peak cap alone when a level arrives as NaN', () => {
		// A NaN cap never compares true again — Math.max(NaN, x) is NaN and `cap < 0` is
		// false — so one NaN level would dark the band for good.
		const peaks = [4, 4];
		fallPeaks(peaks, [Number.NaN, 0.5], 8, 4, 0.25);
		expect(Number.isFinite(peaks[0])).toBe(true);
		expect(peaks[0]).toBeCloseTo(3);
		expect(peaks[1]).toBeCloseTo(4);
		// And it recovers: a real level after the NaN drives the cap normally.
		fallPeaks(peaks, [1, 0.5], 8, 4, 0.25);
		expect(peaks[0]).toBeCloseTo(8);
	});

	it('never grows a peak cap when the clock steps backwards', () => {
		// A negative dt subtracts a negative — four rows became forty-four.
		const peaks = [4];
		fallPeaks(peaks, [0], 8, 4, -10);
		expect(peaks[0]).toBeCloseTo(4);
	});

	it('recovers a cap that is already NaN rather than keeping it', () => {
		const peaks = [Number.NaN];
		fallPeaks(peaks, [0], 8, 4, 0.1);
		expect(peaks[0]).toBe(-1);
	});

	it('throws a readable error for a frame with no area', () => {
		// Unchecked, this makes the scale Infinity and every coordinate NaN, which surfaces
		// as canvas throwing InvalidStateError from inside the render loop once a frame.
		for (const frame of [
			[0, 0],
			[320, 0],
			[-10, 64],
			[Number.NaN, 64],
			[Number.POSITIVE_INFINITY, 64]
		] as [number, number][]) {
			expect(() => compilePanel(frame, [])).toThrow(/finite positive numbers/);
		}
	});

	it('clamps a negative cell count instead of raising a bare RangeError', () => {
		// `out.length = -4` is a RangeError from deep inside the driver.
		expect(() => layCells('12', -4, 'left', true)).not.toThrow();
		expect(layCells('12', -4, 'left', true)).toEqual([]);
		expect(layCells('12', 2.7, 'left', true)).toHaveLength(2);
	});

	it('blanks a dots element whose bitmap function throws, once', () => {
		// A function bitmap is sampled every frame, so a thrower throws forever — out of a
		// rAF callback, where the consumer cannot catch it.
		const panel = compilePanel(
			[100, 40],
			[{ kind: 'dots', name: 'boom', cols: 4, rows: 4, x: 0, y: 0, w: 100, h: 40 }]
		);
		const el = panel.elements[0];
		const out = new Float32Array(panel.anodes.length);
		const state: ElementState = {
			bitmap: () => {
				throw new Error('nope');
			}
		};
		const warn = console.warn;
		console.warn = () => {};
		try {
			expect(() => driveElement(el, state, out)).not.toThrow();
			expect(out.every((v) => v === 0)).toBe(true);
			// The thrower is dropped, so the next frame is not another throw.
			expect(state.bitmap).toBeUndefined();
			expect(() => driveElement(el, state, out)).not.toThrow();
		} finally {
			console.warn = warn;
		}
	});

	it('puts the colon beads in the trailing gutter, clear of the glyph', () => {
		// At the cell centre they land ON the digit: `12:34` rendered as two dots stamped
		// through the 2. They belong beside the decimal point, where the driver wired them.
		const geom = cellGeometry('16seg');
		const bx = (poly: number[]) => {
			let lo = Infinity;
			let hi = -Infinity;
			for (let i = 0; i < poly.length; i += 2) {
				lo = Math.min(lo, poly[i]);
				hi = Math.max(hi, poly[i]);
			}
			return { lo, hi, mid: (lo + hi) / 2 };
		};
		const n = segmentCount('16seg');
		const dp = bx(geom[n]);
		const c1 = bx(geom[n + 1]);
		const c2 = bx(geom[n + 2]);
		// Same column as the point (their radii differ a little, so compare centres)…
		expect(c1.mid).toBeCloseTo(dp.mid, 3);
		expect(c2.mid).toBeCloseTo(dp.mid, 3);
		// …and well right of the cell's centre column, so no glyph runs through them.
		expect(c1.lo).toBeGreaterThan(CELL.width / 2);
	});
});
