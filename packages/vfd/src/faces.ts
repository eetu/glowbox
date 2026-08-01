// Character faces — the geometry and the glyph tables, all pure arithmetic (no canvas,
// no DOM), so the whole lot is node-testable and import-safe.
//
// Four ways a panel drew characters, and this file builds all four out of two
// primitives:
//   • `bar()` — one hexagonal segment with pointed ends and a joint gap. Horizontals,
//     verticals and DIAGONALS are the same shape along a different axis, so the
//     starburst modes cost no extra geometry code than the seven-segment one.
//   • the vendored 5×7 bitmaps — as one anode per dot ('matrix'), or merged into solid
//     runs (`wordRuns`, for legends and printed labels).
//
// The segment ladder is a strict superset chain: 16-seg splits the top and bottom bars
// in two and adds four diagonals plus two centre verticals; 14-seg is 16-seg with whole
// top/bottom bars; 7-seg drops the starburst entirely. Numerals are authored to use the
// SAME strokes in all three, so a frequency reads identically whichever mode the panel
// mixes in — which is what real faceplates did (7-seg for the numbers, starburst for
// the words, one envelope).
// The 5×7 face is used TWICE here, for two different-looking jobs:
//   • `glyphs: 'matrix'` — one anode per dot, the dot-matrix character field.
//   • `legend` words and printed labels — the SAME bitmaps, merged into solid horizontal
//     runs (`wordRuns`), so DOLBY NR reads as a screen-printed word rather than a grid of
//     dots. Real panel legends were 2–3 mm tall and chunky; this is that.
import { FONT_5X7, glyph5x7 } from './font5x7';

/** The character cell all face geometry is authored in (y-down). Elements scale it. */
export const CELL = { width: 60, height: 100 } as const;

/** The classic rightward italic as an x-shear per unit of height above the baseline. */
export const CELL_SLANT = 0.09;

/** The glyph repertoires a `digits` element can drive. */
export type VfdGlyphs = '7seg' | '14seg' | '16seg' | 'matrix';

// --- cell rails ---------------------------------------------------------------------
const L = 7; // left rail
const R = 47; // right rail
const CX = 27; // centre column
const TOP = 9;
const MID = 50;
const BOT = 91;
const GAP = 1.5; // joint gap, along the segment axis
const T7 = 7.2; // seven-segment thickness — the fat classic
const T16 = 5.4; // starburst thickness — thinner, because 16 of them share the cell

type Poly = number[]; // flat x0,y0,x1,y1,…

/** One segment: a hexagon along the axis a→b, pointed at both ends, inset by the joint
 *  gap. Axis-agnostic, so a diagonal is the same call as a horizontal. */
function bar(x0: number, y0: number, x1: number, y1: number, t: number): Poly {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const len = Math.hypot(dx, dy) || 1;
	const ux = dx / len;
	const uy = dy / len;
	const px = -uy; // perpendicular
	const py = ux;
	const h = t / 2;
	const ax = x0 + ux * GAP;
	const ay = y0 + uy * GAP;
	const bx = x1 - ux * GAP;
	const by = y1 - uy * GAP;
	return [
		ax,
		ay,
		ax + ux * h + px * h,
		ay + uy * h + py * h,
		bx - ux * h + px * h,
		by - uy * h + py * h,
		bx,
		by,
		bx - ux * h - px * h,
		by - uy * h - py * h,
		ax + ux * h - px * h,
		ay + uy * h - py * h
	];
}

/** A round dot (the decimal point / colon beads), as a sampled polygon so the renderer
 *  has exactly one geometry kind to fill. */
function dot(cx: number, cy: number, r: number): Poly {
	const out: Poly = [];
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * Math.PI * 2;
		out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
	}
	return out;
}

// --- the segment sets ---------------------------------------------------------------
// Names are the datasheet ones. The four diagonals all radiate from the cell CENTRE to a
// corner — nothing runs corner to corner — which is what makes X (`h j k m`) work, and
// what makes V the hardest glyph on the face.
//
// V IS DELIBERATELY HALF-HEIGHT (`h j`), and it has been "fixed" twice by people who
// assumed otherwise. Before changing it, note what the geometry allows:
//
//   • A V wants one vertex at the BOTTOM CENTRE with arms to the top corners. The only
//     stroke touching bottom-centre is `l`, and from the centre the only ways up are `h`
//     and `j` — so the one full-height V is `h j l`. That is exactly Y, and shipping it
//     as V made VERY read as YERY.
//   • `k m` is the LOWER pair radiating DOWN from the centre, so it draws a literal Λ.
//   • Dropping `e c` from W (`f b k m`) orphans the diagonals' feet: the verticals stop
//     at the waist while the Λ sits on the baseline, with a gap between them.
//   • `f e k j` renders as `1/`; `f e k m` as an N; `f e m` as a k.
//
// So V keeps the vertex at the cell's waist and Y is that same pair plus the stem. The
// two are then unmistakably different, which matters more than V matching its neighbours'
// height — a floating v is ugly, a V that reads as Y is wrong.
const SEG16_NAMES = [
	'a1',
	'a2',
	'b',
	'c',
	'd2',
	'd1',
	'e',
	'f',
	'g1',
	'g2',
	'h',
	'i',
	'j',
	'k',
	'l',
	'm'
] as const;
const SEG7_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

/** Extra anodes every segment cell carries past its segments, in this order. A driver
 *  chip wired them the same way: the point and the clock beads are their own anodes,
 *  not part of any glyph. */
const EXTRA_NAMES = ['dp', 'colon1', 'colon2'] as const;

function seg16Geometry(t: number): Poly[] {
	return [
		bar(L, TOP, CX, TOP, t), // a1
		bar(CX, TOP, R, TOP, t), // a2
		bar(R, TOP, R, MID, t), // b
		bar(R, MID, R, BOT, t), // c
		bar(R, BOT, CX, BOT, t), // d2
		bar(CX, BOT, L, BOT, t), // d1
		bar(L, BOT, L, MID, t), // e
		bar(L, MID, L, TOP, t), // f
		bar(L, MID, CX, MID, t), // g1
		bar(CX, MID, R, MID, t), // g2
		bar(L, TOP, CX, MID, t), // h  ╲ top-left → centre
		bar(CX, TOP, CX, MID, t), // i  │ top-centre → centre
		bar(R, TOP, CX, MID, t), // j  ╱ top-right → centre
		bar(CX, MID, L, BOT, t), // k  ╱ centre → bottom-left
		bar(CX, MID, CX, BOT, t), // l  │ centre → bottom-centre
		bar(CX, MID, R, BOT, t) // m  ╲ centre → bottom-right
	];
}

function seg7Geometry(t: number): Poly[] {
	return [
		bar(L, TOP, R, TOP, t), // a
		bar(R, TOP, R, MID, t), // b
		bar(R, MID, R, BOT, t), // c
		bar(R, BOT, L, BOT, t), // d
		bar(L, BOT, L, MID, t), // e
		bar(L, MID, L, TOP, t), // f
		bar(L, MID, R, MID, t) // g
	];
}

// All three ride the trailing gutter, outside the right rail — which is where a driver
// chip put them, and the only place they can go: a bead at the cell's horizontal centre
// lands ON the glyph, so `12:34` came out as two dots stamped through the 2.
const EXTRA_GEOMETRY: Poly[] = [
	dot(R + 6, BOT, T7 * 0.42), // dp
	dot(R + 6, MID - 15, T7 * 0.4), // colon1
	dot(R + 6, MID + 15, T7 * 0.4) // colon2
];

// --- glyph tables ------------------------------------------------------------------
// Authored as segment NAMES, not hex: the readable single source of truth, compiled to
// bitmasks once at load (the `font5x7` philosophy — art in, bits out). Numerals reuse
// the seven-segment strokes exactly, split across a1/a2, d1/d2 and g1/g2.
const SEG16_FONT: Record<string, string> = {
	'0': 'a1 a2 b c d1 d2 e f',
	'1': 'b c',
	'2': 'a1 a2 b g1 g2 e d1 d2',
	'3': 'a1 a2 b c d1 d2 g1 g2',
	'4': 'f g1 g2 b c',
	'5': 'a1 a2 f g1 g2 c d1 d2',
	'6': 'a1 a2 f g1 g2 e c d1 d2',
	'7': 'a1 a2 b c',
	'8': 'a1 a2 b c d1 d2 e f g1 g2',
	'9': 'a1 a2 b c d1 d2 f g1 g2',
	A: 'a1 a2 b c e f g1 g2',
	B: 'a1 a2 b c d1 d2 g2 i l',
	C: 'a1 a2 f e d1 d2',
	D: 'a1 a2 b c d1 d2 i l',
	E: 'a1 a2 f e g1 g2 d1 d2',
	F: 'a1 a2 f e g1 g2',
	G: 'a1 a2 f e d1 d2 c g2',
	H: 'f e b c g1 g2',
	I: 'a1 a2 i l d1 d2',
	J: 'b c d1 d2 e',
	K: 'f e g1 j m',
	L: 'f e d1 d2',
	M: 'f e h j b c',
	N: 'f e h m b c',
	O: 'a1 a2 b c d1 d2 e f',
	P: 'a1 a2 b f e g1 g2',
	Q: 'a1 a2 b c d1 d2 e f m',
	R: 'a1 a2 b f e g1 g2 m',
	S: 'a1 a2 f g1 g2 c d1 d2',
	T: 'a1 a2 i l',
	U: 'f e d1 d2 c b',
	V: 'h j',
	W: 'f e k m b c',
	X: 'h j k m',
	Y: 'h j l',
	Z: 'a1 a2 j k d1 d2',
	'-': 'g1 g2',
	_: 'd1 d2',
	'=': 'g1 g2 d1 d2',
	'+': 'g1 g2 i l',
	'*': 'g1 g2 i l h j k m',
	'/': 'j k',
	'\\': 'h m',
	'<': 'j m',
	'>': 'h k',
	"'": 'i',
	'"': 'i b',
	'!': 'i l',
	'?': 'a1 a2 j g2 l',
	'[': 'a1 f e d1',
	']': 'a2 b c d2',
	'(': 'j k',
	')': 'h m',
	'^': 'h j',
	'|': 'i l',
	'°': 'a1 f i g1'
};

// Seven-segment: the classic driver-chip repertoire (digits, minus, hex letters), same
// strokes as the starburst numerals with the split bars welded whole.
const SEG7_FONT: Record<string, string> = {
	'0': 'a b c d e f',
	'1': 'b c',
	'2': 'a b g e d',
	'3': 'a b c d g',
	'4': 'f g b c',
	'5': 'a f g c d',
	'6': 'a f g e c d',
	'7': 'a b c',
	'8': 'a b c d e f g',
	'9': 'a b c d f g',
	'-': 'g',
	_: 'd',
	A: 'a b c e f g',
	b: 'f e d c g',
	C: 'a f e d',
	d: 'b c d e g',
	E: 'a f e d g',
	F: 'a f e g',
	H: 'b c e f g',
	L: 'f e d',
	P: 'a b f e g',
	U: 'b c d e f',
	'°': 'a b f g'
};

function compileFont(font: Record<string, string>, names: readonly string[]): Map<string, number> {
	const index = new Map(names.map((n, i) => [n, i]));
	const out = new Map<string, number>();
	for (const [ch, spec] of Object.entries(font)) {
		let bits = 0;
		for (const seg of spec.split(' ')) {
			const i = index.get(seg);
			if (i !== undefined) bits |= 1 << i;
		}
		out.set(ch, bits);
	}
	return out;
}

const BITS16 = compileFont(SEG16_FONT, SEG16_NAMES);
const BITS7 = compileFont(SEG7_FONT, SEG7_NAMES);

/** 14-segment is 16-segment with the split top and bottom bars welded whole: a glyph
 *  that lights either half lights the whole bar. Derived, never authored twice. */
const A1 = SEG16_NAMES.indexOf('a1');
const A2 = SEG16_NAMES.indexOf('a2');
const D1 = SEG16_NAMES.indexOf('d1');
const D2 = SEG16_NAMES.indexOf('d2');

function weld14(bits: number): number {
	let out = bits;
	if (out & ((1 << A1) | (1 << A2))) out |= (1 << A1) | (1 << A2);
	if (out & ((1 << D1) | (1 << D2))) out |= (1 << D1) | (1 << D2);
	return out;
}

/** How many segment anodes a mode's cell carries, before the dp/colon extras. */
export function segmentCount(mode: Exclude<VfdGlyphs, 'matrix'>): number {
	return mode === '7seg' ? SEG7_NAMES.length : SEG16_NAMES.length;
}

/** The extra (non-glyph) anodes every segment cell carries, in `sub` order after the
 *  segments: the decimal point and the two clock-colon beads. */
export const CELL_EXTRAS = EXTRA_NAMES.length;

/** Segment names in `sub` order for a mode — the geometry seam, so a 3D consumer can
 *  extrude the same cell (nixie's `nixieCathodes` / seven-segment's `segmentGeometry`
 *  philosophy). 14-seg reports the 16-seg names: it has the same anodes, driven welded. */
export function segmentNames(mode: Exclude<VfdGlyphs, 'matrix'>): readonly string[] {
	return [...(mode === '7seg' ? SEG7_NAMES : SEG16_NAMES), ...EXTRA_NAMES];
}

/** One cell's anode outlines in `CELL` units, in `sub` order: the mode's segments, then
 *  the decimal point, then the two colon beads. */
export function cellGeometry(mode: Exclude<VfdGlyphs, 'matrix'>): Poly[] {
	const segs = mode === '7seg' ? seg7Geometry(T7) : seg16Geometry(T16);
	return [...segs, ...EXTRA_GEOMETRY];
}

/** Which segments a character lights, as a bitmask over the mode's `sub` order. Case
 *  tolerant (the starburst is uppercase; seven-segment's `b d` shapes ARE lowercase).
 *  Unknown characters and the space are blank — a panel shows nothing rather than a
 *  fallback box, because a blank cell is what a real driver does with an unmapped code. */
export function segmentBits(mode: Exclude<VfdGlyphs, 'matrix'>, ch: string): number {
	if (mode === '7seg') {
		return BITS7.get(ch) ?? BITS7.get(ch.toUpperCase()) ?? BITS7.get(ch.toLowerCase()) ?? 0;
	}
	const raw = BITS16.get(ch) ?? BITS16.get(ch.toUpperCase()) ?? 0;
	return mode === '14seg' ? weld14(raw) : raw;
}

// --- the dot-matrix cell -----------------------------------------------------------
/** The 5×7 dot grid in `CELL` units — one anode per dot, `sub` = row * 5 + column.
 *  Square dots with a hairline gutter: a matrix VFD's dots are screen-printed squares,
 *  not the round dice of an LED module. */
export function matrixGeometry(): Poly[] {
	const cols = FONT_5X7.width;
	const rows = FONT_5X7.height;
	const pitchX = (R - L) / cols;
	const pitchY = (BOT - TOP) / rows;
	const gx = pitchX * 0.14;
	const gy = pitchY * 0.14;
	const out: Poly[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = L + c * pitchX;
			const y = TOP + r * pitchY;
			const w = pitchX - gx;
			const h = pitchY - gy;
			out.push([x, y, x + w, y, x + w, y + h, x, y + h]);
		}
	}
	return out;
}

/** Whether a character lights the dot at (row, col) of a matrix cell. */
export function matrixDotLit(ch: string, row: number, col: number): boolean {
	const rows = glyph5x7(ch);
	return !!((rows[row] ?? 0) & (1 << (FONT_5X7.width - 1 - col)));
}

export const MATRIX_DOTS = FONT_5X7.width * FONT_5X7.height;

// --- solid words (legends, printed labels) -----------------------------------------
/** A rectangle in word units: one dot is 1×1, glyph advance is 6, cap height is 7. */
export interface WordRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Compile text into SOLID rectangles — the same 5×7 bitmaps, but horizontal runs are
 *  merged, and vertically-identical runs are merged again, so a stem is one tall rect
 *  and DOLBY NR reads as a screen-printed word instead of a dot-matrix grid. The merge
 *  also keeps the anode count sane: a 8-letter legend lands around 30 rects, not 280
 *  dots. */
export function wordRuns(text: string): { rects: WordRect[]; width: number; height: number } {
	const cols = FONT_5X7.width;
	const rows = FONT_5X7.height;
	// Horizontal runs first, per row across the whole string.
	const perRow: WordRect[][] = Array.from({ length: rows }, () => []);
	let cursor = 0;
	for (const ch of text) {
		for (let r = 0; r < rows; r++) {
			let run = -1;
			for (let c = 0; c <= cols; c++) {
				const lit = c < cols && matrixDotLit(ch, r, c);
				if (lit && run < 0) run = c;
				else if (!lit && run >= 0) {
					perRow[r].push({ x: cursor + run, y: r, w: c - run, h: 1 });
					run = -1;
				}
			}
		}
		cursor += cols + 1;
	}
	// Then the vertical merge: a run sitting directly under one with the same x and
	// width grows it instead of adding a rect. `open` carries the previous row's rects.
	const rects: WordRect[] = [];
	let open: WordRect[] = [];
	for (let r = 0; r < rows; r++) {
		const carried: WordRect[] = [];
		for (const run of perRow[r]) {
			const above = open.find((o) => o.x === run.x && o.w === run.w && o.y + o.h === r);
			if (above) {
				above.h += 1;
				carried.push(above);
			} else {
				rects.push(run);
				carried.push(run);
			}
		}
		open = carried;
	}
	return { rects, width: Math.max(0, cursor - 1), height: rows };
}
