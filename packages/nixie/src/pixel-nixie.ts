// Nixie tubes on whole pixels, as data, for a game painting them into its own low-resolution
// raster (the way seven-segment hands out its pixel digits). A digit tube is its ten cathodes
// front to back: the lit one `on`, the rest the ghost wires stacked behind it. Each pixel
// belongs to one cathode — the lit one where wires cross, else the frontmost — so parts paint
// in any order. The wires are the canvas tube's own centrelines, flattened and drawn a pixel
// wide, each glyph's extremes snapped to whole pixels; at 11 px the digits are hand-drawn.
// The stack's parallax stays out: under 25 px it is sub-pixel jitter, and a back numeral
// shrunk by its depth stands pixels short.
import { glyphPath } from './nixie';
import { flattenPath } from './path-parse';
import type { PixelLayout, PixelPart, PixelRect } from './pixel';
import { maskRects, strokeRects } from './pixel-stroke';
import { type Wear, wearLevels } from './wear';

type Pt = [number, number];
interface Line {
	pts: Pt[];
	closed: boolean;
}
interface Box {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

/** The digit cathodes front to back, as `nixieCathodes` stacks them. */
const STACK = '1234567890';
const isSeparator = (ch: string) => ch !== '' && ':.-'.includes(ch);

/** One cathode of a laid-out row: its tube, its numeral and depth, lit or not. */
export interface NixiePixelPart extends PixelPart {
	/** The index of its tube's character in the text. */
	index: number;
	/** The cathode's numeral, or the separator a separator tube shows (`:` `.` `-`). */
	symbol: string;
	/** 0 (front) … 9 (back) in the stack — dim the ghosts by it; 0 for a separator. */
	depth: number;
	on: boolean;
}

export interface NixiePixelOptions {
	/** Wire width, px. Default the canvas tube's 4.2 of 100, rounded down: 1 px to 47 px. */
	wire?: number;
}

export interface NixiePixelTextOptions extends NixiePixelOptions {
	/** Tube height, px. */
	height: number;
	/** Pixels between tubes. Default 2. */
	gap?: number;
	/** Whether the colons are lit — a clock blinks them. Default true. */
	colon?: boolean;
}

// The digits at 11 px, by hand on the tube's 7 × 11 grid ('#' wire): flattened at this size
// the bowls lump and the 8 pinches into a bar. 6, 8 and 9 reach the bottom row, as their
// wires overshoot the others' baseline in the tube.
const AT_11: Record<string, string> = {
	'0': `
..###..
.#...#.
#.....#
#.....#
#.....#
#.....#
#.....#
#.....#
.#...#.
..###..
.......`,
	'1': `
...#...
...#...
...#...
...#...
...#...
...#...
...#...
...#...
...#...
...#...
.......`,
	'2': `
..###..
.#...#.
.#...#.
.....#.
....#..
...#...
..#....
.#.....
.#.....
.#####.
.......`,
	'3': `
..####.
....#..
...#...
...##..
.....#.
......#
#.....#
#.....#
.#...#.
..###..
.......`,
	'4': `
....#..
...##..
..#.#..
..#.#..
.#..#..
.#..#..
#...#..
#######
....#..
....#..
.......`,
	'5': `
..#####
..#....
.#.....
.####..
.....#.
......#
......#
.#....#
.#...#.
..###..
.......`,
	'6': `
...#...
..#....
.#.....
.#.....
#.###..
##...#.
#.....#
#.....#
#.....#
.#...#.
..###..`,
	'7': `
.#####.
.....#.
....#..
....#..
....#..
...#...
...#...
...#...
..#....
..#....
.......`,
	'8': `
..###..
.#...#.
.#...#.
.#...#.
..###..
.#...#.
#.....#
#.....#
#.....#
.#...#.
..###..`,
	'9': `
..###..
.#...#.
#.....#
#.....#
#.....#
.#...##
..###.#
.....#.
....#..
...#...
..#....`
};

const boxOf = (lines: Line[]): Box => {
	const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
	for (const { pts } of lines)
		for (const [x, y] of pts) {
			b.x0 = Math.min(b.x0, x);
			b.y0 = Math.min(b.y0, y);
			b.x1 = Math.max(b.x1, x);
			b.y1 = Math.max(b.y1, y);
		}
	return b;
};

const flat = new Map<string, Line[]>();
const linesOf = (ch: string): Line[] => {
	let lines = flat.get(ch);
	if (!lines) {
		const d = glyphPath(ch);
		// Finer than the default: the points are where the line steps, and sparse ones step
		// the curves in longer, lumpier runs.
		lines = d
			? flattenPath(d, { tolerance: 0.0005 }).map(({ pts, closed }) => ({
					pts: closed ? [...pts, pts[0]] : pts,
					closed
				}))
			: [];
		flat.set(ch, lines);
	}
	return lines;
};

/** The pixel grid every cathode of a `height` px tube shares: glyph units → px. */
const gridOf = (height: number, wire: number) => {
	const box = boxOf([...STACK].flatMap(linesOf));
	const scale = (height - wire) / (box.y1 - box.y0);
	return { box, scale, width: Math.round((box.x1 - box.x0) * scale) + wire };
};

const fill = (mask: Uint8Array, w: number, r: PixelRect) => {
	for (let y = r.y; y < r.y + r.h; y++)
		for (let x = r.x; x < r.x + r.w; x++)
			if (x >= 0 && x < w && y >= 0 && y * w + x < mask.length) mask[y * w + x] = 1;
};

// A 1 px wire drawn through many points clumps where it bends back on itself and steps
// in stair corners: drop each pixel that fills out a 2 × 2 square while its neighbours stay
// joined without it, then the inner corner of each step, whose two neighbours touch
// diagonally. Neither ever breaks the wire; loosen either test and a sharp bend (the 3's,
// the 5's) does, which the sweep test catches.
const tidy = (m: Uint8Array, w: number, h: number) => {
	const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			if (!m[y * w + x]) continue;
			// Clockwise from north.
			const n = [
				at(x, y - 1),
				at(x + 1, y - 1),
				at(x + 1, y),
				at(x + 1, y + 1),
				at(x, y + 1),
				at(x - 1, y + 1),
				at(x - 1, y),
				at(x - 1, y - 1)
			];
			let count = 0;
			let runs = 0;
			for (let i = 0; i < 8; i++) {
				count += n[i];
				if (!n[i] && n[(i + 1) % 8]) runs++;
			}
			const square = [0, 2, 4, 6].some((i) => n[i] && n[i + 1] && n[(i + 2) % 8]);
			if (count >= 3 && count <= 6 && runs === 1 && square) m[y * w + x] = 0;
		}
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			if (!m[y * w + x]) continue;
			for (const [dx, dy] of [
				[1, 1],
				[1, -1],
				[-1, 1],
				[-1, -1]
			])
				if (
					at(x + dx, y) &&
					at(x, y + dy) &&
					!at(x + dx, y + dy) &&
					!at(x - dx, y) &&
					!at(x, y - dy) &&
					!at(x - dx, y - dy)
				) {
					m[y * w + x] = 0;
					break;
				}
		}
};

const cathodes = new Map<string, Uint8Array[]>();
/** Each digit cathode's wire as a mask on the tube's grid, front to back. */
const cathodeMasks = (height: number, wire: number): Uint8Array[] => {
	const key = `${height},${wire}`;
	let masks = cathodes.get(key);
	if (masks) return masks;
	const { box, scale, width } = gridOf(height, wire);
	const lo = Math.floor((wire - 1) / 2);
	masks = [...STACK].map((ch) => {
		const mask = new Uint8Array(width * height);
		if (height === 11 && wire === 1 && width === 7) {
			[...AT_11[ch].replace(/\s/g, '')].forEach((c, i) => (mask[i] = c === '#' ? 1 : 0));
			return mask;
		}
		const lines = linesOf(ch);
		const g = boxOf(lines);
		// The glyph's own extremes land on whole pixels, so a bowl ends in a run, not a nub.
		const snap = (v: number, a: number, b: number, origin: number) => {
			const from = Math.round((a - origin) * scale);
			const to = Math.round((b - origin) * scale);
			return (b > a ? from + ((v - a) / (b - a)) * (to - from) : from) + lo + 0.5;
		};
		for (const { pts } of lines) {
			const px = pts.map(([x, y]): Pt => [
				snap(x, g.x0, g.x1, box.x0),
				snap(y, g.y0, g.y1, box.y0)
			]);
			for (const r of strokeRects(px, { width: wire })) fill(mask, width, r);
		}
		if (wire === 1) tidy(mask, width, height);
		return mask;
	});
	cathodes.set(key, masks);
	return masks;
};

/** A separator dot `size` px across: a square, or from 3 px a wire ring, as the canvas
 *  strokes it. */
const dot = (size: number, wire: number): PixelRect[] => {
	if (size < 3) return [{ x: 0, y: 0, w: size, h: size }];
	const c = size / 2;
	const r = (size - wire) / 2;
	const pts = Array.from({ length: 32 }, (_, i): Pt => {
		const a = (i / 32) * Math.PI * 2;
		return [c + r * Math.cos(a), c + r * Math.sin(a)];
	});
	const mask = new Uint8Array(size * size);
	for (const rect of strokeRects(pts, { width: wire, closed: true })) fill(mask, size, rect);
	if (wire === 1) tidy(mask, size, size);
	return maskRects(mask, size, size);
};

/** A separator tube: each closed subpath of its glyph a dot (the colon's two, the point's
 *  one), each open one a run (the dash), at the glyph's height in the stack. */
const separator = (ch: string, height: number, wire: number) => {
	const { box, scale } = gridOf(height, wire);
	const rects: PixelRect[] = [];
	let width = 0;
	for (const line of linesOf(ch)) {
		const b = boxOf([line]);
		const mid = ((b.y0 + b.y1) / 2 - box.y0) * scale + wire / 2;
		if (line.closed) {
			const size = Math.max(wire, Math.round((b.x1 - b.x0) * scale));
			const top = Math.round(mid - size / 2);
			for (const r of dot(size, wire)) rects.push({ ...r, y: r.y + top });
			width = Math.max(width, size);
		} else {
			const w = Math.round((b.x1 - b.x0) * scale) + wire;
			rects.push({ x: 0, y: Math.round(mid - wire / 2), w, h: wire });
			width = Math.max(width, w);
		}
	}
	return { width, rects };
};

/**
 * One tube `height` px tall on whole pixels. A digit, a blank or anything unknown is a digit
 * tube: its ten cathodes front to back, the symbol's lit and the rest ghosts (all of them for
 * a blank). `:` `.` `-` are separator tubes, one lit part as wide as its ink. Rects are from
 * the tube's top-left. It reads as a nixie from 16 px; 11 px is a hand-drawn fallback.
 */
export function nixiePixels(
	symbol: string | number | null,
	height: number,
	options: NixiePixelOptions = {}
): PixelLayout<NixiePixelPart> {
	const ch = [...String(symbol ?? '')][0] ?? '';
	const wire = options.wire ?? Math.max(1, Math.floor(height * 0.042));
	if (isSeparator(ch)) {
		const { width, rects } = separator(ch, height, wire);
		return { width, height, parts: [{ index: 0, symbol: ch, depth: 0, on: true, rects }] };
	}
	const { width } = gridOf(height, wire);
	const masks = cathodeMasks(height, wire);
	const lit = ch ? STACK.indexOf(ch) : -1;
	const owner = new Int8Array(width * height).fill(-1);
	for (let d = masks.length - 1; d >= 0; d--)
		masks[d].forEach((v, i) => {
			if (v) owner[i] = d;
		});
	if (lit >= 0)
		masks[lit].forEach((v, i) => {
			if (v) owner[i] = lit;
		});
	const parts = [...STACK].map((symbol, depth): NixiePixelPart => ({
		index: 0,
		symbol,
		depth,
		on: depth === lit,
		rects: maskRects(
			owner.map((o) => (o === depth ? 1 : 0)),
			width,
			height
		)
	}));
	return { width, height, parts };
}

/**
 * A row of tubes on whole pixels, one per character (`"12:34"`, `"-0.5"`), `gap` px apart:
 * the parts of each `nixiePixels` tube with `index` its character's. Rects are from the
 * row's top-left.
 */
export function nixiePixelText(
	text: string,
	options: NixiePixelTextOptions
): PixelLayout<NixiePixelPart> {
	const { height, gap = 2, colon = true } = options;
	const parts: NixiePixelPart[] = [];
	let x = 0;
	[...text].forEach((ch, index) => {
		if (index) x += gap;
		const tube = nixiePixels(ch, height, options);
		for (const p of tube.parts)
			parts.push({
				...p,
				index,
				on: p.on && (colon || p.symbol !== ':'),
				rects: p.rects.map((r) => ({ ...r, x: r.x + x }))
			});
		x += tube.width;
	});
	return { width: x, height, parts };
}

/**
 * Each part's light at `wear.t`, 0 (a ghost) … 1: lit cathodes at their worn level, the
 * most-worn flickering past age 0.7 and dead from 0.95 (see `wearLevels`), ghosts 0. Seeded,
 * so a world that rewinds sees the same flicker.
 */
export function nixieLevels(layout: PixelLayout<NixiePixelPart>, wear: Wear): Float32Array {
	const levels = wearLevels(layout.parts.length, wear);
	layout.parts.forEach((p, i) => {
		if (!p.on) levels[i] = 0;
	});
	return levels;
}
