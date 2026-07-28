// The drum arithmetic is pure and node-testable by design — the forward-only
// ratchet is the display's defining constraint, so it gets pinned here.
import { expect, test } from 'vitest';

import {
	DEFAULT_CHARSET,
	DRUM_ALNUM,
	DRUM_DIGITS,
	DRUM_NORDIC,
	flapIndex,
	flapsOf,
	padCells,
	stepsBetween
} from '../drum';

test('the drum presets: blank first, no duplicate flap, colons everywhere', () => {
	for (const [drum, len] of [
		[DRUM_ALNUM, 40],
		[DRUM_NORDIC, 53],
		[DRUM_DIGITS, 14]
	] as const) {
		const flaps = flapsOf(drum);
		expect(flaps).toHaveLength(len);
		expect(flaps[0]).toBe(' ');
		expect(new Set(flaps).size).toBe(len);
		expect(flaps).toContain(':'); // every board spends its life showing times
	}
	// The default is the Nordic drum, ÅÄÖ after Z in alphabet order.
	expect(DEFAULT_CHARSET).toBe(DRUM_NORDIC);
	expect(flapsOf(DEFAULT_CHARSET).slice(27, 30)).toEqual(['Å', 'Ä', 'Ö']);
});

test('flapIndex: exact, uppercased, umlauts, and off-drum characters', () => {
	const flaps = flapsOf(DEFAULT_CHARSET);
	expect(flapIndex(flaps, 'A')).toBe(1);
	expect(flapIndex(flaps, 'a')).toBe(1); // drums are caps-only
	expect(flapIndex(flaps, 'ä')).toBe(28); // JYVÄSKYLÄ boards welcome
	expect(flapIndex(flaps, 'A\u0308')).toBe(28); // decomposed (NFD) Ä finds the same flap
	expect(flapIndex(flaps, '~')).toBe(0); // unprintable → the blank flap
	expect(flapIndex(flapsOf('AB'), '~')).toBe(0); // no blank on the drum → flap 0
});

test('stepsBetween is forward-only: an earlier flap costs a full wrap', () => {
	expect(stepsBetween(0, 5, 40)).toBe(5);
	expect(stepsBetween(5, 5, 40)).toBe(0);
	// Z → A: 39 → 1 must go the long way round, never backward.
	expect(stepsBetween(26, 1, 40)).toBe(15);
	expect(stepsBetween(1, 26, 40)).toBe(25);
	expect(stepsBetween(39, 0, 40)).toBe(1);
});

test('padCells fixes a line to the module row, one grapheme per cell', () => {
	expect(padCells('HI', 5)).toEqual(['H', 'I', ' ', ' ', ' ']);
	expect(padCells('TOO LONG', 3)).toEqual(['T', 'O', 'O']);
	expect(padCells('', 2)).toEqual([' ', ' ']);
	// Graphemes, not code units: the train is one cell, not two surrogates.
	expect(padCells('🚂X', 3)).toEqual(['🚂', 'X', ' ']);
});

test('a drum can be katakana, or anything else that prints on one card', () => {
	// The matrix-rain kind: half-width katakana ride as single flaps, and a
	// combining dakuten stays glued to its kana (one card, not two).
	const flaps = flapsOf(' ｱｳｴｵｶﾞ7');
	expect(flaps).toHaveLength(7);
	expect(flaps[5]).toBe('ｶﾞ');
	expect(flapIndex(flaps, 'ｳ')).toBe(2);
	expect(flapIndex(flaps, 'ｶﾞ')).toBe(5);
	// Emoji drums are legal too — a flap is a card face, not an ASCII byte.
	expect(flapsOf('☀☂🚂')).toHaveLength(3);
});
