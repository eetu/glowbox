// Every character on every drum the package ships, at every card size from the smallest that
// holds the 5×7 face (5 × 9) to 15 × 23, odd heights (a one-row hinge) and even (two): the
// print is a bitmap at whole-pixel scales, so nothing may be lost, clipped or broken
// anywhere but where the seam crosses a stroke.
import { expect, test } from 'vitest';

import { DRUM_ALNUM, DRUM_DIGITS, DRUM_NORDIC, flapsOf } from '../drum';
import { compile5x7, glyph5x7, repertoire5x7 } from '../font5x7';
import { LATIN_5X7 } from '../latin5x7';
import { type FlapGlyph, flapGlyph } from '../pixel-flap';

const CHARS = [...new Set([DRUM_ALNUM, DRUM_NORDIC, DRUM_DIGITS].flatMap(flapsOf))];
const SIZES: [number, number][] = [];
for (let w = 5; w <= 15; w++) for (let h = 9; h <= 23; h++) SIZES.push([w, h]);

const source = (ch: string) =>
	Object.hasOwn(LATIN_5X7, ch) ? compile5x7(LATIN_5X7[ch]) : glyph5x7(ch);

/** Rows `r0`…`r1` of a face bitmap as a 5-wide mask. */
const face = (bits: readonly number[], r0 = 0, r1 = 7) =>
	Uint8Array.from(
		{ length: 5 * (r1 - r0) },
		(_, i) => (bits[r0 + Math.floor(i / 5)] >> (4 - (i % 5))) & 1
	);

/** 8-connected pieces of ink in a mask. */
function pieces(mask: Uint8Array, w: number, h: number): number {
	const seen = new Uint8Array(w * h);
	let n = 0;
	for (let i = 0; i < w * h; i++) {
		if (!mask[i] || seen[i]) continue;
		n++;
		const stack = [i];
		seen[i] = 1;
		while (stack.length) {
			const j = stack.pop()!;
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const x = (j % w) + dx;
					const y = Math.floor(j / w) + dy;
					const k = y * w + x;
					if (x >= 0 && y >= 0 && x < w && y < h && mask[k] && !seen[k]) {
						seen[k] = 1;
						stack.push(k);
					}
				}
		}
	}
	return n;
}

/** The card as painted from rects, or null if a rect leaves the card. */
function paint(rects: { x: number; y: number; w: number; h: number }[], w: number, h: number) {
	const card = new Uint8Array(w * h);
	for (const r of rects)
		for (let y = r.y; y < r.y + r.h; y++)
			for (let x = r.x; x < r.x + r.w; x++) {
				if (x < 0 || y < 0 || x >= w || y >= h) return null;
				card[y * w + x] = 1;
			}
	return card;
}

/** Every case's verdict, by size: the face's scale and the glyph built for it. */
function sweep(check: (ch: string, card: [number, number], g: FlapGlyph) => string | null) {
	const failures: string[] = [];
	for (const card of SIZES)
		for (const ch of CHARS) {
			const why = check(ch, card, flapGlyph(ch, card));
			if (why) failures.push(`${JSON.stringify(ch)} at ${card.join('×')}: ${why}`);
		}
	return failures;
}

const geometry = ([w, h]: [number, number]) => {
	const half = Math.floor((h - 1) / 2);
	const hinge = h - 2 * half;
	// The largest scale that leaves a pixel of card around the print, at least 1.
	const s = Math.max(1, Math.min(Math.floor((w - 2) / 5), Math.floor((half - 1) / 4)));
	return { half, hinge, s, x0: Math.floor((w - 5 * s) / 2), y0: half - 4 * s };
};

test('every character on the shipped drums has a bitmap of its own, none the missing box', () => {
	const known = new Set([...repertoire5x7(), ...Object.keys(LATIN_5X7)]);
	expect(CHARS.filter((ch) => !known.has(ch))).toEqual([]);
	expect(CHARS).toEqual(expect.arrayContaining(['Å', 'Ä', 'Ö', '@', '&', '?']));
});

test('sweep: all ink on the card, none on the hinge, and top + bottom are the bitmap exactly', () => {
	const failures = sweep((ch, [w, h], g) => {
		const { half, hinge, s, x0, y0 } = geometry([w, h]);
		const card = paint([...g.top, ...g.bottom], w, h);
		if (!card) return 'a rect leaves the card';
		const rows = paint(g.rows.flat(), w, h);
		if (!rows || rows.some((v, i) => v !== card[i])) return 'rows differ from top + bottom';
		if (g.top.some((r) => r.y + r.h > half)) return 'top ink below the top flap';
		if (g.bottom.some((r) => r.y < half + hinge)) return 'bottom ink above the bottom flap';
		for (let i = half * w; i < (half + hinge) * w; i++) if (card[i]) return 'ink on the hinge';
		// Close the seam and read the face back, dot by dot, at its scale.
		const bits = source(ch);
		let ink = 0;
		for (let y = 0; y < 2 * half; y++)
			for (let x = 0; x < w; x++) {
				const on = card[(y < half ? y : y + hinge) * w + x];
				const fx = Math.floor((x - x0) / s);
				const fy = Math.floor((y - y0) / s);
				const want = fx >= 0 && fx < 5 && fy >= 0 && fy < 7 ? (bits[fy] >> (4 - fx)) & 1 : 0;
				if (on !== want) return `pixel ${x},${y} is ${on}, the bitmap says ${want}`;
				ink += on;
			}
		const dots = face(bits).reduce((n, v) => n + v, 0);
		return ink === dots * s * s ? null : `${ink} ink pixels for ${dots} dots at ×${s}`;
	});
	expect(failures).toEqual([]);
});

test('sweep: scaling keeps every stroke whole; the seam is the only break', () => {
	const failures = sweep((ch, [w, h], g) => {
		const { half, hinge } = geometry([w, h]);
		const card = paint([...g.top, ...g.bottom], w, h)!;
		const closed = card.filter((_, i) => i < half * w || i >= (half + hinge) * w);
		const bits = source(ch);
		const whole = pieces(face(bits), 5, 7);
		if (pieces(closed, w, 2 * half) !== whole) return 'scaling changed how its strokes connect';
		// As shown, the seam cuts the face between rows 3 and 4 and nowhere else.
		const cut = pieces(face(bits, 0, 4), 5, 4) + pieces(face(bits, 4, 7), 5, 3);
		return pieces(card, w, h) === cut ? null : 'a stroke breaks off the seam';
	});
	expect(failures).toEqual([]);
});

test('an asked-for scale stops at the largest that fits the card, so nothing clips', () => {
	for (const [w, h] of SIZES)
		for (const scale of [1, 2, 3, 4]) {
			const half = Math.floor((h - 1) / 2);
			const s = Math.max(1, Math.min(scale, Math.floor(w / 5), Math.floor(half / 4)));
			const g = flapGlyph('#', [w, h], { scale });
			const ink = paint([...g.top, ...g.bottom], w, h)!.reduce((n, v) => n + v, 0);
			expect(ink, `${w}×${h} ×${scale}`).toBe(
				face(glyph5x7('#')).reduce((n, v) => n + v, 0) * s * s
			);
		}
});
