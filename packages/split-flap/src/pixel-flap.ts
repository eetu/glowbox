// Split-flap modules on whole pixels, as data, for a game painting the board into its own
// low-resolution raster. Built once: the board's cards, halves and hinges (`flapPixels`) and
// each character's print (`flapGlyph`, the shared 5×7 face cut at the hinge). Read each
// frame: which flap every module shows and how far its card has fallen (`flapState`, closed
// form from the time since the command), and which source row each row of a card shows
// mid-fall (`flapRows`). Nothing keeps state, reads a clock or calls Math.random.
import { DEFAULT_CHARSET, flapIndex, flapsOf, padCells, stepsBetween } from './drum';
import { compile5x7, FONT_5X7, glyph5x7 } from './font5x7';
import { LATIN_5X7 } from './latin5x7';
import type { PixelLayout, PixelPart, PixelRect } from './pixel';
import { maskRects } from './pixel-stroke';
import type { DrumZone } from './split-flap';

/** A card, `[w, h]` px. The hinge cuts it into two flaps of `floor((h − 1) / 2)` rows with
 *  one hinge row between, two on an even `h`. */
export type FlapCard = readonly [number, number];

/** Flap rows and hinge rows of a card `h` tall. */
const cut = (h: number) => {
	const half = Math.max(1, Math.floor((Math.max(3, h) - 1) / 2));
	return { half, hinge: Math.max(3, h) - 2 * half };
};

export interface FlapPixelOptions {
	/** Modules per row. */
	cols: number;
	/** Rows of modules. Default 1. */
	rows?: number;
	/** One card, `[w, h]` px: 7 × 11 carries the 5×7 face with a pixel to spare. */
	card: FlapCard;
	/** Pixels between cards, or `[across, down]`. Default 1. */
	gap?: number | readonly [number, number];
}

/** One piece of a module: its top flap, hinge row(s) or bottom flap. */
export interface FlapPart extends PixelPart {
	col: number;
	row: number;
	half: 'top' | 'hinge' | 'bottom';
}

/** A board on whole pixels. `cards` are the modules' card rects, row-major (the order of
 *  `flapState`'s cells); `half` is a flap's height. */
export interface FlapLayout extends PixelLayout<FlapPart> {
	cols: number;
	rows: number;
	cards: PixelRect[];
	half: number;
}

/**
 * A board of `cols` × `rows` cards on whole pixels: each card's top flap, hinge and bottom
 * flap as parts, in that order, module by module. Rects are from the board's top-left.
 */
export function flapPixels({ cols, rows = 1, card, gap = 1 }: FlapPixelOptions): FlapLayout {
	cols = Math.max(1, Math.floor(cols));
	rows = Math.max(1, Math.floor(rows));
	const w = Math.max(1, Math.floor(card[0]));
	const h = Math.max(3, Math.floor(card[1]));
	const [gx, gy] = typeof gap === 'number' ? [gap, gap] : gap;
	const { half, hinge } = cut(h);
	const parts: FlapPart[] = [];
	const cards: PixelRect[] = [];
	for (let row = 0; row < rows; row++)
		for (let col = 0; col < cols; col++) {
			const x = col * (w + gx);
			const y = row * (h + gy);
			cards.push({ x, y, w, h });
			parts.push(
				{ col, row, half: 'top', rects: [{ x, y, w, h: half }] },
				{ col, row, half: 'hinge', rects: [{ x, y: y + half, w, h: hinge }] },
				{ col, row, half: 'bottom', rects: [{ x, y: y + half + hinge, w, h: half }] }
			);
		}
	return {
		width: cols * w + (cols - 1) * gx,
		height: rows * h + (rows - 1) * gy,
		parts,
		cols,
		rows,
		cards,
		half
	};
}

export interface FlapGlyphOptions {
	/** Glyphs of your own, as 5×7 art ('#' ink, 7 rows of 5), ahead of the face's. */
	glyphs?: Record<string, string>;
	/** Pixels per face dot. Default the largest that leaves a pixel of card around the print;
	 *  never more than fits the card. */
	scale?: number;
}

/** A character printed on a card, in card coordinates. */
export interface FlapGlyph {
	/** The top flap's ink, as few rects as cover it. */
	top: PixelRect[];
	/** The bottom flap's ink. */
	bottom: PixelRect[];
	/** Each card row's ink runs (`x`, `w`), for painting a row where `flapRows` puts it. */
	rows: PixelRect[][];
}

/** Face rows above the hinge: the cut falls under the middle row, so a crossbar (A, E, H)
 *  rides the top flap. */
const ABOVE = 4;

/**
 * `char` in the 5×7 face (ASCII, and the Western European / Nordic set that carries the
 * Nordic drum's Å, Ä and Ö), centred across a card and cut at the hinge: four face rows on
 * the top flap, three on the bottom, so the hinge row runs through the letter as the seam
 * does on the hardware. Whole-pixel scales of a bitmap, so a stroke breaks only where the
 * seam crosses it. A card from 5 × 9 holds the whole face; a character the face lacks
 * prints as its hollow missing-glyph box; a blank prints nothing.
 */
export function flapGlyph(char: string, card: FlapCard, options: FlapGlyphOptions = {}): FlapGlyph {
	const w = Math.max(1, Math.floor(card[0]));
	const h = Math.max(3, Math.floor(card[1]));
	const { half, hinge } = cut(h);
	const { width: fw, height: fh } = FONT_5X7;
	const fits = Math.min(Math.floor(w / fw), Math.floor(half / ABOVE));
	const s = Math.max(
		1,
		Math.min(fits, Math.floor(options.scale ?? Math.min((w - 2) / fw, (half - 1) / ABOVE)))
	);
	const own = options.glyphs ?? {};
	const art = Object.hasOwn(own, char)
		? own[char]
		: Object.hasOwn(LATIN_5X7, char)
			? LATIN_5X7[char]
			: undefined;
	const bits = art !== undefined ? compile5x7(art) : glyph5x7(char);
	const x0 = Math.floor((w - fw * s) / 2);
	const y0 = half - ABOVE * s;
	const mask = new Uint8Array(w * h);
	for (let gy = 0; gy < fh * s; gy++) {
		const y = y0 + gy + (gy < ABOVE * s ? 0 : hinge);
		if (y < 0 || y >= h) continue;
		const line = bits[Math.floor(gy / s)];
		for (let gx = 0; gx < fw * s; gx++) {
			const x = x0 + gx;
			if (x >= 0 && x < w && (line >> (fw - 1 - Math.floor(gx / s))) & 1) mask[y * w + x] = 1;
		}
	}
	const below = half + hinge;
	return {
		top: maskRects(mask.subarray(0, half * w), w, half),
		bottom: maskRects(mask.subarray(below * w), w, half).map((r) => ({ ...r, y: r.y + below })),
		rows: Array.from({ length: h }, (_, y) =>
			maskRects(mask.subarray(y * w, (y + 1) * w), w, 1).map((r) => ({ ...r, y }))
		)
	};
}

/** The card's angle off upright at `fall` 0…1: released off the catch, gravity's torque grows
 *  with the swing (slow start, no ease-out: the stop is the stack). π is landed. */
export const flapAngle = (fall: number): number => Math.PI * Math.pow(fall, 1.7);

/** A `flapRows` entry: `& FLAP_ROW` is the source row (cards up to 256 rows), `& FLAP_NEXT`
 *  set means the next character's row, `& FLAP_FLIGHT` set means it is on the falling card. */
export const FLAP_ROW = 0xff;
export const FLAP_NEXT = 0x100;
export const FLAP_FLIGHT = 0x200;

/**
 * Which row each row of a card shows at `fall` (0…1 in flight, −1 at rest), into `out`; see
 * `FLAP_ROW` for the bits. The departing top flap folds down to the hinge, `round(half·cos θ)`
 * rows tall with its print squashed to fit, the next character's top standing behind it;
 * past edge-on the back of the card, the next character's bottom, unfolds over the old one.
 * Shading the falling card's rows is what makes a 5-row fold read as a card: its front lit
 * as it swings up toward the light, its back dim, both by `sin θ`.
 */
export function flapRows(
	fall: number,
	card: FlapCard,
	out: Int16Array = new Int16Array(Math.max(3, Math.floor(card[1])))
): Int16Array {
	const h = Math.max(3, Math.floor(card[1]));
	const { half, hinge } = cut(h);
	for (let y = 0; y < h; y++) out[y] = y;
	if (!(fall >= 0)) return out;
	const c = Math.cos(flapAngle(Math.min(1, fall)));
	const seen = Math.round(half * Math.abs(c));
	// Rows of a flap `seen` tall, sampled at their centres from its `half`.
	const src = (i: number) => Math.min(half - 1, Math.floor(((i + 0.5) * half) / seen));
	const below = half + hinge;
	for (let y = 0; y < half; y++) out[y] = y | FLAP_NEXT;
	if (c >= 0) for (let i = 0; i < seen; i++) out[half - seen + i] = src(i) | FLAP_FLIGHT;
	else for (let i = 0; i < seen; i++) out[below + i] = (below + src(i)) | FLAP_NEXT | FLAP_FLIGHT;
	return out;
}

export interface FlapStateOptions {
	/** Board size in modules. Default the longest line and the line count of the texts. */
	cols?: number;
	rows?: number;
	/** The drum (default `DRUM_NORDIC`), and zones with their own, as the canvas board's. */
	charset?: string;
	drums?: DrumZone[];
	/** The board: each module's timing (its address scatter, its drum's speed) hashes from it. */
	seed?: number;
	/** One flap's fall, ms. Default 90; 0 jumps. */
	flipMs?: number;
}

/** A module at a moment: the flap it shows (or is dropping), the next one, and how far the
 *  falling card is, 0…1, or −1 at rest. */
export interface FlapCell {
	idx: number;
	char: string;
	next: string;
	fall: number;
}

/** A card landing: which module, and when, ms since the command. */
export interface FlapLanding {
	col: number;
	row: number;
	at: number;
}

const unit = (a: number, b: number): number => {
	let x = Math.imul(a ^ 0x5bd1e995, 0x27d4eb2d) ^ Math.imul(b + 1, 0x165667b1);
	x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
	x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
	return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

interface Plan {
	cols: number;
	flaps: string[][];
	from: number[];
	steps: number[];
	wait: number[];
	dur: number[];
}

/** Each module's command, the way the canvas board runs it: a fresh start waits 5–50 ms for
 *  its address strobe, then drops one card per `flipMs` × 0.85–1.15, its own drum's pace. */
function plan(
	from: string | string[],
	to: string | string[],
	{ cols, rows, charset = DEFAULT_CHARSET, drums = [], seed = 0, flipMs = 90 }: FlapStateOptions
): Plan {
	const a = typeof from === 'string' ? from.split('\n') : from;
	const b = typeof to === 'string' ? to.split('\n') : to;
	const nc = Math.max(
		1,
		Math.floor(cols ?? Math.max(0, ...[...a, ...b].map((l) => flapsOf(l).length)))
	);
	const nr = Math.max(1, Math.floor(rows ?? Math.max(a.length, b.length)));
	const cache = new Map<string, string[]>();
	const drum = (cs: string) => {
		let f = cache.get(cs);
		if (!f) {
			f = flapsOf(cs);
			if (!f.length) f = [' '];
			cache.set(cs, f);
		}
		return f;
	};
	const k = Math.round(seed * 1000);
	const p: Plan = { cols: nc, flaps: [], from: [], steps: [], wait: [], dur: [] };
	for (let y = 0; y < nr; y++) {
		const was = padCells(a[y] ?? '', nc);
		const now = padCells(b[y] ?? '', nc);
		for (let x = 0; x < nc; x++) {
			// Later zones win, as on the canvas board.
			let cs = charset;
			for (const z of drums) {
				const zx = Math.floor(z.x);
				const zy = Math.floor(z.y);
				const zc = Math.max(1, Math.floor(z.cols ?? 1));
				const zr = Math.max(1, Math.floor(z.rows ?? 1));
				if (x >= zx && x < zx + zc && y >= zy && y < zy + zr) cs = z.charset;
			}
			const f = drum(cs);
			const i = flapIndex(f, was[x]);
			const jit = unit(k, y * nc + x);
			p.flaps.push(f);
			p.from.push(i);
			p.steps.push(stepsBetween(i, flapIndex(f, now[x]), f.length));
			p.wait.push(flipMs > 0 ? 5 + 45 * jit : 0);
			p.dur.push(flipMs * (0.85 + 0.3 * jit));
		}
	}
	return p;
}

/** Cards a module has dropped `ms` after its command. */
const dropped = (p: Plan, i: number, ms: number) =>
	p.dur[i] > 0
		? Math.min(p.steps[i], Math.max(0, Math.floor((ms - p.wait[i]) / p.dur[i])))
		: ms >= 0
			? p.steps[i]
			: 0;

/**
 * Every module `ms` after the board was told to go from `from` to `to` (a string, newlines
 * between rows, or one string per row), row-major: drums only turn forward, so reaching an
 * earlier flap runs the whole way round. Closed form, so a world that rewinds or skips
 * frames sees the same board. `from` is a board at rest: to change course mid-run, command
 * from what the modules show (`char`).
 */
export function flapState(
	from: string | string[],
	to: string | string[],
	ms: number,
	options: FlapStateOptions = {}
): FlapCell[] {
	const p = plan(from, to, options);
	return p.flaps.map((f, i) => {
		const n = dropped(p, i, ms);
		const idx = (p.from[i] + n) % f.length;
		const e = ms - p.wait[i] - n * p.dur[i];
		const fall = n < p.steps[i] && p.dur[i] > 0 && ms >= p.wait[i] ? Math.max(0, e / p.dur[i]) : -1;
		return { idx, char: f[idx], next: f[(idx + 1) % f.length], fall };
	});
}

/**
 * The cards that landed after `ms0` and by `ms1`, in order: asked with each frame's window,
 * every slap comes once. A board told to jump (`flipMs` 0) lands nothing, as the canvas
 * board's reduced-motion jump is silent.
 */
export function flapLandings(
	from: string | string[],
	to: string | string[],
	ms0: number,
	ms1: number,
	options: FlapStateOptions = {}
): FlapLanding[] {
	const p = plan(from, to, options);
	const out: FlapLanding[] = [];
	p.flaps.forEach((_, i) => {
		if (!(p.dur[i] > 0)) return;
		for (let n = dropped(p, i, ms0) + 1; n <= dropped(p, i, ms1); n++)
			out.push({ col: i % p.cols, row: Math.floor(i / p.cols), at: p.wait[i] + n * p.dur[i] });
	});
	return out.sort((x, y) => x.at - y.at);
}
