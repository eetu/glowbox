// The bitmap font path is DOM-free by design — everything here runs headlessly in
// node, which is itself the point of the bundled font (deterministic, testable).
import { createVoxelGrid, type LedDisplay } from '@glowbox/led-grid';
import { describe, expect, test } from 'vitest';

import { FONT_5X7, glyph5x7 } from '../font5x7';
import { makeTextScroller } from '../scroller';
import { measureText, text } from '../text';

const lit = (g: ReturnType<typeof createVoxelGrid>): Set<string> => {
	const out = new Set<string>();
	for (let z = 0; z < g.nz; z++)
		for (let y = 0; y < g.ny; y++)
			for (let x = 0; x < g.nx; x++) {
				const [r, gr, b] = g.get(x, y, z);
				if (r + gr + b > 0) out.add(`${x},${y},${z}`);
			}
	return out;
};

describe('font5x7', () => {
	test('glyphs are 7 rows of 5-bit masks; A matches its classic shape', () => {
		expect(FONT_5X7).toEqual({ width: 5, height: 7 });
		// .###. / #...# / #...# / ##### / #...# / #...# / #...#
		expect(glyph5x7('A')).toEqual([14, 17, 17, 31, 17, 17, 17]);
		expect(glyph5x7(' ')).toEqual([0, 0, 0, 0, 0, 0, 0]);
		for (const ch of '!0Az~{|') {
			const rows = glyph5x7(ch);
			expect(rows).toHaveLength(7);
			for (const r of rows) expect(r).toBeGreaterThanOrEqual(0);
			for (const r of rows) expect(r).toBeLessThan(32);
		}
	});

	test('unknown characters fall back to the hollow box', () => {
		expect(glyph5x7('€')).toEqual([31, 17, 17, 17, 17, 17, 31]);
	});
});

describe('measureText', () => {
	test('ink box in cells, multi-line aware, scaled', () => {
		expect(measureText('AB')).toEqual({ width: 11, height: 7 });
		expect(measureText('AB', 2)).toEqual({ width: 22, height: 14 });
		expect(measureText('A\nBC')).toEqual({ width: 11, height: 15 });
	});
});

describe('text (bitmap)', () => {
	test('plots the exact A glyph, centred, without a DOM', () => {
		const g = createVoxelGrid(7, 9, 1);
		text(g, 'A'); // bitmap is the default; plane xy, depth 0 on nz=1
		// glyph box: u = 1..5, v = 7 (top row) .. 1 (bottom row)
		expect(g.get(3, 7, 0)).toEqual([1, 1, 1]); // top bar
		expect(g.get(1, 7, 0)).toEqual([0, 0, 0]); // top corners empty (.###.)
		expect(g.get(1, 6, 0)).toEqual([1, 1, 1]); // left stem
		expect(g.get(3, 6, 0)).toEqual([0, 0, 0]); // counter (hole)
		expect(g.get(3, 4, 0)).toEqual([1, 1, 1]); // crossbar
		expect(g.get(1, 1, 0)).toEqual([1, 1, 1]); // bottom-left leg
		expect(g.get(3, 1, 0)).toEqual([0, 0, 0]); // between the legs
		for (let x = 0; x < 7; x++) {
			expect(g.get(x, 8, 0)).toEqual([0, 0, 0]); // above the block
			expect(g.get(x, 0, 0)).toEqual([0, 0, 0]); // below the block
		}
	});

	test('multi-line stacks downward with a 1-row gap', () => {
		const g = createVoxelGrid(13, 17, 1);
		text(g, 'A\nB', { color: [1, 0, 0] });
		// block height 15 → vTop 15; line 2 top = 15 - 8 = 7
		expect(g.get(6, 12, 0)).toEqual([1, 0, 0]); // A crossbar (line 1, gy 3)
		expect(g.get(4, 7, 0)).toEqual([1, 0, 0]); // B top bar starts (####.)
		expect(g.get(8, 7, 0)).toEqual([0, 0, 0]); // B top bar's open corner
		for (let x = 0; x < 13; x++) expect(g.get(x, 8, 0)).toEqual([0, 0, 0]); // the gap row
	});

	test('scale doubles the pixel blocks', () => {
		const g = createVoxelGrid(14, 18, 1);
		text(g, 'A', { scale: 2 });
		// crossbar (gy 3) is now two rows thick and spans 10 cells
		const rows = [lit(g), null];
		expect(rows[0]!.size).toBeGreaterThan(0);
		const crossbarCells = [...rows[0]!].filter((k) => k.endsWith(',0')).length;
		expect(crossbarCells).toBeGreaterThan(16 * 2); // A at scale 2 ≥ 16 px × 4
	});
});

describe('makeTextScroller (bitmap)', () => {
	test('message tiles with a gap and shifts left as time advances', () => {
		const g = createVoxelGrid(24, 9, 1);
		const d = g as unknown as LedDisplay;
		const draw = makeTextScroller('AB', { speed: 6, gap: 4 });
		draw(d, 0); // scroll = 0: message cols land at u = src
		const before = lit(g);
		expect(before.size).toBeGreaterThan(0);
		// col 0 = A's left stem: rows gy1..6 lit → v = 1..6, not v = 7 (top row is .###.)
		expect(before.has('0,3,0')).toBe(true);
		expect(before.has('0,7,0')).toBe(false);
		// col 5 is the inter-character gap → fully dark
		for (let v = 0; v < 9; v++) expect(before.has(`5,${v},0`)).toBe(false);
		// period = 11 + 4 = 15 → the message repeats at u = 15
		expect(before.has('15,3,0')).toBe(true);

		draw(d, 0.5); // +3 columns at 6 cells/s
		const after = lit(g);
		for (let u = 0; u + 3 < 24; u++)
			for (let v = 0; v < 9; v++)
				expect(after.has(`${u},${v},0`)).toBe(before.has(`${u + 3},${v},0`));
	});

	test('live text getter rebuilds the message', () => {
		const g = createVoxelGrid(24, 9, 1);
		const d = g as unknown as LedDisplay;
		let msg = 'A';
		const draw = makeTextScroller(() => msg, { speed: 0 });
		draw(d, 0);
		const a = lit(g);
		msg = 'B';
		draw(d, 0);
		const b = lit(g);
		expect(a).not.toEqual(b);
		expect(b.size).toBeGreaterThan(0);
	});
});
