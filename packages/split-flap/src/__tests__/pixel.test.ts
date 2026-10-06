// The pixel export is pure data and closed-form time — node-testable by design.
import { expect, test } from 'vitest';

import { DRUM_ALNUM, DRUM_DIGITS, flapsOf, stepsBetween } from '../drum';
import type { PixelRect } from '../pixel';
import {
	FLAP_FLIGHT,
	FLAP_NEXT,
	FLAP_ROW,
	flapAngle,
	type FlapCard,
	type FlapCell,
	flapGlyph,
	flapLandings,
	flapPixels,
	flapRows,
	flapState
} from '../pixel-flap';

const cells = (r: PixelRect) =>
	Array.from({ length: r.w * r.h }, (_, i) => `${r.x + (i % r.w)},${r.y + Math.floor(i / r.w)}`);

/** One card as a game paints it at `fall`: '#' ink, '+' the falling card, '-' the hinge. */
function dump(card: FlapCard, a: string, b: string, fall: number): string[] {
	const [w, h] = card;
	const { half } = flapPixels({ cols: 1, card });
	const map = flapRows(fall, card);
	const glyph = { [a]: flapGlyph(a, card), [b]: flapGlyph(b, card) };
	return Array.from({ length: h }, (_, y) => {
		const v = map[y];
		const line = Array<string>(w).fill(
			y >= half && y < h - half ? '-' : v & FLAP_FLIGHT ? '+' : '.'
		);
		for (const r of glyph[v & FLAP_NEXT ? b : a].rows[v & FLAP_ROW]) line.fill('#', r.x, r.x + r.w);
		return line.join('');
	});
}

test('flapPixels: each card a top flap, a hinge and a bottom flap, whole and apart', () => {
	const board = flapPixels({ cols: 3, rows: 2, card: [7, 11], gap: [1, 2] });
	expect(board).toMatchObject({ width: 3 * 7 + 2, height: 2 * 11 + 2, cols: 3, rows: 2, half: 5 });
	expect(board.parts).toHaveLength(3 * 2 * 3);
	expect(board.cards[4]).toEqual({ x: 8, y: 13, w: 7, h: 11 });
	expect(board.parts.slice(12, 15)).toEqual([
		{ col: 1, row: 1, half: 'top', rects: [{ x: 8, y: 13, w: 7, h: 5 }] },
		{ col: 1, row: 1, half: 'hinge', rects: [{ x: 8, y: 18, w: 7, h: 1 }] },
		{ col: 1, row: 1, half: 'bottom', rects: [{ x: 8, y: 19, w: 7, h: 5 }] }
	]);
	const seen = new Set<string>();
	for (const p of board.parts)
		for (const r of p.rects)
			for (const c of cells(r)) {
				expect(seen.has(c)).toBe(false);
				seen.add(c);
			}
	// An even card keeps its flaps equal and takes a two-row hinge.
	const even = flapPixels({ cols: 1, card: [8, 12] });
	expect(even.half).toBe(5);
	expect(even.parts[1].rects[0]).toEqual({ x: 0, y: 5, w: 8, h: 2 });
});

test('flapGlyph: the 5×7 face centred and cut under its middle row, four rows over three', () => {
	const card: FlapCard = [7, 11];
	expect(dump(card, 'A', 'B', -1)).toEqual([
		'.......',
		'..###..',
		'.#...#.',
		'.#...#.',
		'.#####.',
		'-------',
		'.#...#.',
		'.#...#.',
		'.#...#.',
		'.......',
		'.......'
	]);
	const g = flapGlyph('A', card);
	// The rects cover what the rows do, each half in its own flap.
	const fromRects = new Set([...g.top, ...g.bottom].flatMap(cells));
	const fromRows = new Set(g.rows.flat().flatMap(cells));
	expect(fromRects).toEqual(fromRows);
	for (const r of g.top) expect(r.y + r.h).toBeLessThanOrEqual(5);
	for (const r of g.bottom) expect(r.y).toBeGreaterThanOrEqual(6);
	// A vertical stroke is one rect, not one per row.
	expect(flapGlyph('|', card).top).toEqual([{ x: 3, y: 1, w: 1, h: 4 }]);
	expect(flapGlyph(' ', card).rows.flat()).toEqual([]);
});

test('flapGlyph: the missing-glyph box, extension art, and a doubled face on a big card', () => {
	expect(dump([7, 11], 'Å', ' ', -1).slice(1, 5)).toEqual([
		'.#####.',
		'.#...#.',
		'.#...#.',
		'.#...#.'
	]);
	const ring = { Å: '..#..\n.#.#.\n..#..\n.###.\n#...#\n#####\n#...#' };
	const a = flapGlyph('Å', [7, 11], { glyphs: ring });
	expect(a.rows[1]).toEqual([{ x: 3, y: 1, w: 1, h: 1 }]);
	// 12 × 19 fits the face at two pixels a dot with a pixel of card each side.
	const big = flapGlyph('I', [12, 19]);
	expect(big.top[0]).toEqual({ x: 3, y: 1, w: 6, h: 2 });
	expect(flapGlyph('I', [12, 19], { scale: 1 }).top[0].w).toBe(3);
});

test('flapRows: the top flap folds to the hinge, then the next bottom unfolds over the old', () => {
	const card: FlapCard = [7, 11];
	const at = (fall: number) => [...flapRows(fall, card)];
	expect(at(-1)).toEqual([...Array(11).keys()]);
	// Released: the whole top flap is in flight, the next character not yet in view.
	expect(at(0)).toEqual([0, 1, 2, 3, 4].map((y) => y | FLAP_FLIGHT).concat([5, 6, 7, 8, 9, 10]));
	for (let f = 0; f < 1; f += 0.01) {
		const rows = at(f);
		const c = Math.cos(flapAngle(f));
		const flying = rows.filter((v) => v & FLAP_FLIGHT);
		expect(flying).toHaveLength(Math.round(5 * Math.abs(c)));
		if (c >= 0) {
			// The falling front is the shown character's top, against the hinge.
			expect(rows.slice(5 - flying.length, 5)).toEqual(flying);
			expect(flying.every((v) => !(v & FLAP_NEXT) && (v & FLAP_ROW) < 5)).toBe(true);
		} else {
			// Its back is the next character's bottom, hanging from the hinge.
			expect(rows.slice(6, 6 + flying.length)).toEqual(flying);
			expect(flying.every((v) => v & FLAP_NEXT && (v & FLAP_ROW) >= 6)).toBe(true);
			expect(rows.slice(0, 5).every((v) => v & FLAP_NEXT)).toBe(true);
		}
		expect(rows[5]).toBe(5);
	}
	// Squashed print is sampled, never out of its flap; the row order holds.
	const mid = at(0.5)
		.filter((v) => v & FLAP_FLIGHT)
		.map((v) => v & FLAP_ROW);
	expect(mid).toEqual([...mid].sort((a, b) => a - b));
	const out = new Int16Array(11);
	expect(flapRows(0.3, card, out)).toBe(out);
});

test('a 7 × 11 card mid-fall still reads: the next top over a squashed old one, then the fold', () => {
	const card: FlapCard = [7, 11];
	expect(dump(card, 'A', 'B', 0.42)).toEqual([
		'.......',
		'+++++++',
		'++###++',
		'+#+++#+',
		'+#####+',
		'-------',
		'.#...#.',
		'.#...#.',
		'.#...#.',
		'.......',
		'.......'
	]);
	expect(dump(card, 'A', 'B', 0.55)).toEqual([
		'.......',
		'.####..',
		'.#...#.',
		'++###++',
		'+#+++#+',
		'-------',
		'.#...#.',
		'.#...#.',
		'.#...#.',
		'.......',
		'.......'
	]);
	expect(dump(card, 'A', 'B', 0.82)).toEqual([
		'.......',
		'.####..',
		'.#...#.',
		'.#...#.',
		'.####..',
		'-------',
		'+#+++#+',
		'+####++',
		'+++++++',
		'.......',
		'.......'
	]);
});

const FROM = ['HELSINKI 12:40', 'TURKU    12:52'];
const TO = ['OULU     13:05', 'TAMPERE  13:10'];
const OPTS = { charset: DRUM_ALNUM, seed: 3 };

test('flapState: at rest before the strobe, forward only, and at the new text once landed', () => {
	const flaps = flapsOf(DRUM_ALNUM);
	const start = flapState(FROM, TO, 0, OPTS);
	expect(start).toHaveLength(28);
	expect(start.map((c) => c.char).join('')).toBe(FROM.join(''));
	expect(start.every((c) => c.fall === -1)).toBe(true);
	const end = flapState(FROM, TO, 60_000, OPTS);
	expect(end.map((c) => c.char).join('')).toBe(TO.join(''));
	expect(end.every((c) => c.fall === -1)).toBe(true);
	// H → O is 7 flips; T → T none; 4 → 1 wraps the whole drum less three.
	const from = flaps.indexOf('4');
	expect(stepsBetween(from, flaps.indexOf('1'), flaps.length)).toBe(flaps.length - 3);
	// Mid-run every module is between its texts on the drum, its card part-way down.
	let prev: FlapCell[] = start;
	for (let ms = 0; ms <= 4000; ms += 7) {
		const now = flapState(FROM, TO, ms, OPTS);
		now.forEach((c, i) => {
			expect(c.char).toBe(flaps[c.idx]);
			expect(c.next).toBe(flaps[(c.idx + 1) % flaps.length]);
			expect(c.fall === -1 || (c.fall >= 0 && c.fall < 1)).toBe(true);
			const a = flaps.indexOf(start[i].char);
			const b = flaps.indexOf(TO.join('')[i]);
			const total = stepsBetween(a, b, flaps.length);
			const went = stepsBetween(a, c.idx, flaps.length);
			expect(went).toBeLessThanOrEqual(total);
			// Never backward between moments.
			expect(went).toBeGreaterThanOrEqual(stepsBetween(a, prev[i].idx, flaps.length));
		});
		prev = now;
	}
});

test('flapState: seeded — the same at the same moment, a different board on another seed', () => {
	expect(flapState(FROM, TO, 333, OPTS)).toEqual(flapState(FROM, TO, 333, OPTS));
	const falls = (seed: number) => flapState(FROM, TO, 333, { ...OPTS, seed }).map((c) => c.fall);
	expect(falls(3)).not.toEqual(falls(4));
	// Each drum keeps its own pace: a row released together drifts apart.
	expect(new Set(falls(3).filter((f) => f >= 0)).size).toBeGreaterThan(10);
});

test('flapState: a digit zone wraps short, and flipMs 0 jumps', () => {
	const drums = [{ x: 9, y: 0, cols: 5, rows: 2, charset: DRUM_DIGITS }];
	const board = (ms: number) => flapState(FROM, TO, ms, { ...OPTS, drums });
	// 4 → 0 on the digit drum is a short hop, not the alphanumeric wrap.
	const slow = flapState(FROM, TO, 1500, OPTS)[12];
	expect(board(1500)[12]).toMatchObject({ char: '0', fall: -1 });
	expect(slow.char).not.toBe('0');
	expect(flapState(FROM, TO, 0, { ...OPTS, flipMs: 0 }).map((c) => c.char)).toEqual(
		flapState(FROM, TO, 1e6, OPTS).map((c) => c.char)
	);
	// Defaults: the size comes from the texts, the drum is the Nordic one.
	expect(flapState('ÄÖ', 'ÖÄ', 0)).toMatchObject([{ char: 'Ä' }, { char: 'Ö' }]);
});

test('flapLandings: every flip lands once across windows, in order, where flapState steps', () => {
	const all = flapLandings(FROM, TO, -1, 60_000, OPTS);
	const flaps = flapsOf(DRUM_ALNUM);
	const total = FROM.join('')
		.split('')
		.reduce(
			(n, ch, i) =>
				n + stepsBetween(flaps.indexOf(ch), flaps.indexOf(TO.join('')[i]), flaps.length),
			0
		);
	expect(all).toHaveLength(total);
	expect(all.map((l) => l.at)).toEqual(all.map((l) => l.at).sort((a, b) => a - b));
	// Frame windows partition them.
	let n = 0;
	for (let t = -1; t < 60_000; t += 16) n += flapLandings(FROM, TO, t, t + 16, OPTS).length;
	expect(n).toBe(total);
	// A landing is the moment flapState moves on a flap.
	const { col, row, at } = all[40];
	const i = row * 14 + col;
	expect(flapState(FROM, TO, at, OPTS)[i].idx).toBe(
		(flapState(FROM, TO, at - 0.01, OPTS)[i].idx + 1) % flaps.length
	);
	expect(flapLandings(FROM, TO, -1, 1e6, { ...OPTS, flipMs: 0 })).toEqual([]);
});
