// The extension face is data — guard its shape so a pixel-art typo (a 6-wide row,
// a missing line) fails here instead of rendering garbage.
import { describe, expect, it } from 'vitest';

import { compile5x7, FONT_5X7, glyph5x7, repertoire5x7 } from '../font5x7';
import { LATIN_5X7 } from '../latin';

describe('LATIN_5X7', () => {
	it('every entry is one character mapped to 7 rows of exactly 5 dots', () => {
		for (const [ch, art] of Object.entries(LATIN_5X7)) {
			expect(ch).toHaveLength(1);
			const rows = art.trim().split('\n');
			expect(rows, ch).toHaveLength(FONT_5X7.height);
			for (const row of rows) expect(row, ch).toMatch(/^[#.]{5}$/);
		}
	});

	it('compiles to inked 5-bit masks — no blank glyphs, nothing out of the cell', () => {
		for (const [ch, art] of Object.entries(LATIN_5X7)) {
			const rows = compile5x7(art);
			expect(rows, ch).toHaveLength(FONT_5X7.height);
			expect(
				rows.some((r) => r > 0),
				ch
			).toBe(true);
			for (const r of rows) expect(r, ch).toBeLessThanOrEqual(0b11111);
		}
	});

	it('extends the face instead of shadowing it', () => {
		const base = new Set(repertoire5x7());
		for (const ch of Object.keys(LATIN_5X7)) expect(base.has(ch), ch).toBe(false);
	});
});

describe('repertoire5x7', () => {
	it('names the covered characters — known glyphs in, unknown out', () => {
		const covered = new Set(repertoire5x7());
		expect(covered.has('A')).toBe(true);
		expect(covered.has('ä')).toBe(false);
		// The fallback box is what non-repertoire characters render as.
		expect(glyph5x7('ä')).toEqual(glyph5x7('￿'));
	});
});
