// The vendored Hershey faces, decoded — pure data, node-testable by design. These
// prove the packed strings before anything draws: 95 printable-ASCII glyphs each,
// sane advances and bounds, the canonical Hershey metrics, and the license string
// the Hershey terms require to travel with the data.
import { expect, test } from 'vitest';

import { SANS } from '../faces/sans';
import { SCRIPT } from '../faces/script';
import { HERSHEY_LICENSE, type NeonFont, resolveFont } from '../font';

const FACES = [
	['sans', resolveFont('sans')],
	['script', resolveFont('script')]
] as const;

test('both faces decode to the 95 printable-ASCII glyphs', () => {
	for (const [, f] of FACES) {
		const keys = Object.keys(f.glyphs);
		expect(keys.length).toBe(95);
		for (let c = 0x20; c <= 0x7e; c++) expect(f.glyphs[String.fromCharCode(c)]).toBeDefined();
	}
});

test('every glyph advances; every non-space glyph has strokes', () => {
	for (const [, f] of FACES) {
		for (const [ch, g] of Object.entries(f.glyphs)) {
			expect(g.adv, `'${ch}' advance`).toBeGreaterThan(0);
			if (ch !== ' ') expect(g.strokes.length, `'${ch}' strokes`).toBeGreaterThan(0);
			else expect(g.strokes.length).toBe(0);
		}
	}
});

test('coordinates stay near the glyph box (baseline 0, y-down)', () => {
	for (const [name, f] of FACES) {
		expect(f.capHeight).toBe(21); // the Hershey convention, both faces
		for (const [ch, g] of Object.entries(f.glyphs)) {
			for (const s of g.strokes)
				for (const [x, y] of s) {
					// Script entry/exit swashes overhang their advance a little; wildly
					// out-of-box points would mean a mis-parsed pair stream.
					expect(x, `${name} '${ch}' x`).toBeGreaterThan(-15);
					expect(x, `${name} '${ch}' x`).toBeLessThan(g.adv + 15);
					expect(y, `${name} '${ch}' y`).toBeGreaterThanOrEqual(-f.ascent);
					expect(y, `${name} '${ch}' y`).toBeLessThanOrEqual(f.descent);
				}
		}
	}
});

test("'H' spans exactly baseline to cap top", () => {
	for (const [name, f] of FACES) {
		let top = Infinity;
		let bottom = -Infinity;
		for (const s of f.glyphs['H'].strokes)
			for (const [, y] of s) {
				top = Math.min(top, y);
				bottom = Math.max(bottom, y);
			}
		expect(bottom, name).toBe(0);
		expect(top, name).toBe(-f.capHeight);
	}
});

test('face grouping: script declares word; sans leaves the wiring default', () => {
	// A face only declares grouping when it means something physical — script
	// words are one continuously-bent tube. Sans falls to the sign-wide default
	// (a word wired as one circuit), overridable per sign via tubes.
	expect(resolveFont('sans').grouping).toBeUndefined();
	expect(resolveFont('script').grouping).toBe('word');
	expect(resolveFont(undefined)).toBe(resolveFont('script')); // memoised default
});

test('a custom NeonFont passes through untouched', () => {
	const logo: NeonFont = {
		capHeight: 10,
		ascent: 10,
		descent: 0,
		glyphs: {
			'@': {
				adv: 12,
				strokes: [
					[
						[0, 0],
						[12, -10]
					]
				]
			}
		}
	};
	expect(resolveFont(logo)).toBe(logo);
});

test('the Hershey acknowledgement travels with the face data', () => {
	expect(HERSHEY_LICENSE).toContain('Hershey');
	expect(HERSHEY_LICENSE).toContain('National Bureau of Standards');
	expect(HERSHEY_LICENSE).toContain('James Hurt');
	expect(SANS.license).toBe(HERSHEY_LICENSE);
	expect(SCRIPT.license).toBe(HERSHEY_LICENSE);
	expect(resolveFont('sans').license).toBe(HERSHEY_LICENSE);
});
