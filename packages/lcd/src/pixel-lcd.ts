// A character LCD module as data on whole pixels, for a game painting it into its own
// low-resolution raster: the dot layout once (`lcdPixels`), then at each moment the dots the
// controller drives (`lcdTargets`), where the crystals have got to (`stepCrystals`,
// `crystalAt`) and how much ink that puts on the glass (`lcdInk`). The canvas core runs the
// same drive, crystal and contrast maths. Ink darkens the pane, it does not glow; on the
// negative blue glass it is the backlight let through, so the backlit pane is the only light.
import { compile5x7, FONT_5X7, glyph5x7 } from './font5x7';
import { type PanelName, PANELS, type PanelSpec } from './panels';
import type { PixelLayout, PixelPart } from './pixel';
import { type Wear, wearLevels } from './wear';

// One character cell is 5×8 dots (the 5×7 face + the cursor/descender row); the advance
// adds one dot pitch between characters and two between rows — module glass, not a text grid.
export const CELL_W = FONT_5X7.width;
export const CELL_H = 8;
export const ADV_X = CELL_W + 1;
export const ADV_Y = CELL_H + 2;
/** A dot's share of its pitch: STN dots almost touch. */
export const DOT_FILL = 0.86;
/** The uninitialised boot row's dwell and the block cursor's blink half-period, seconds. */
export const BOOT_S = 0.8;
export const BLINK_S = 0.53;
// A dot this close to its target has arrived.
const SNAP = 0.004;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** What the controller is asked to show: the text, each character's 5-bit glyph rows, the
 *  cursor if it is showing, or the boot row. */
export interface Drive {
	cols: number;
	rows: number;
	lines: readonly string[];
	rowBits: (ch: string, r: number) => number;
	cursor: { col: number; row: number; style: 'line' | 'block' } | null;
	booting: boolean;
}

/** The dots `d` drives, into `target` (row-major, `cols·5` dots across), cleared first. */
export const driveDots = (target: Uint8Array, d: Drive): Uint8Array => {
	const across = d.cols * CELL_W;
	target.fill(0);
	// The uninitialised controller: DDRAM full of 0xFF on the top row.
	if (d.booting) return target.fill(1, 0, CELL_H * across);
	for (let cy = 0; cy < d.rows; cy++) {
		const line = d.lines[cy] ?? '';
		for (let cx = 0; cx < d.cols; cx++) {
			const ch = line[cx] ?? ' ';
			for (let ry = 0; ry < CELL_H; ry++) {
				const bits = d.rowBits(ch, ry);
				if (!bits) continue;
				const row = (cy * CELL_H + ry) * across + cx * CELL_W;
				for (let rx = 0; rx < CELL_W; rx++)
					if (bits & (1 << (CELL_W - 1 - rx))) target[row + rx] = 1;
			}
		}
	}
	// The cursor is drawn by the controller OVER the glyph (union), at crystal speed like
	// everything else — a blink genuinely smears.
	const c = d.cursor;
	if (c && c.col < d.cols && c.row < d.rows) {
		const top = c.style === 'line' ? CELL_H - 1 : 0;
		for (let ry = top; ry < CELL_H; ry++) {
			const row = (c.row * CELL_H + ry) * across + c.col * CELL_W;
			target.fill(1, row, row + CELL_W);
		}
	}
	return target;
};

// How far a dot closes on its target in `dt` seconds, rising and falling: rise beats fall,
// so moving text drags its ghost behind it.
const reach = (dt: number, response: number): [number, number] => {
	const base = 0.015 + response * 0.32;
	return [1 - Math.exp(-dt / (base * 0.75)), 1 - Math.exp(-dt / (base * 1.35))];
};
const toward = (s: number, t: number, k: number) => {
	const n = s + (t - s) * k;
	return Math.abs(t - n) < SNAP ? t : n;
};

/**
 * Move every dot's `state` toward its `target` over `dt` seconds, in place; true while any
 * dot is still on its way. `response` 0..1 is the canvas option's (default 0.4, about 100 ms
 * to rise and 180 ms to fall; 0 snaps). Each step is the exact exponential, so one step of a
 * second lands where twenty of 50 ms do.
 */
export const stepCrystals = (
	state: Float32Array,
	target: ArrayLike<number>,
	dt: number,
	response = 0.4
): boolean => {
	if (response <= 0) {
		state.set(target);
		return false;
	}
	const [up, down] = reach(dt, response);
	let moving = false;
	for (let i = 0; i < state.length; i++) {
		const t = target[i];
		const s = state[i];
		if (s === t) continue;
		const n = toward(s, t, t > s ? up : down);
		state[i] = n;
		if (n !== t) moving = true;
	}
	return moving;
};

/** A dot's state `dt` seconds after it stood at `from` and was driven toward `to` (0 or 1):
 *  `stepCrystals` in one go, so a world that rewinds can re-derive a dot from its last
 *  change, folding back through the ones before it while they are under a second apart. */
export const crystalAt = (from: number, to: number, dt: number, response = 0.4): number => {
	if (response <= 0 || from === to) return to;
	const [up, down] = reach(Math.max(0, dt), response);
	return toward(from, to, to > from ? up : down);
};

/** The contrast pot's frame: full ink, the resting lattice, the share of a column's drive
 *  that leaks into its undriven dots, and how much of it all the glass lets through. */
export interface Pot {
	ink: number;
	rest: number;
	leak: number;
	through: number;
}

/** Ink strength saturates near the top of the sweet spot; overdrive past ~0.85 raises the
 *  resting lattice and the crosstalk. A negative panel's ink is light through the glass,
 *  so with no backlight there is (almost) no image. `lit` is the backlight 0..1. */
export const potOf = (
	spec: PanelSpec,
	contrast: number,
	ghost: boolean,
	age: number,
	lit: number
): Pot => {
	const over = Math.max(0, contrast - 0.85) / 0.15;
	return {
		ink: clamp01((contrast - 0.08) / 0.72) ** 0.9 * (1 - age * 0.15),
		rest: ghost ? spec.ghost * (1 + over * 1.6) : 0,
		leak: 0.02 + over * 0.22,
		through: spec.negative ? 0.12 + 0.88 * lit : 1
	};
};

/** One dot's ink from its state and its column's drive (driven dots in it over all its
 *  dots): undriven dots in a hard-driven column pick up a shadow. */
export const inkOf = (s: number, drive: number, p: Pot): number => {
	let a = p.rest + (p.ink - p.rest) * s;
	if (s < 1) a += drive * p.leak * (1 - s);
	return a * p.through;
};

export interface LcdPixelOptions {
	/** Character columns. Default 16. */
	cols?: number;
	/** Character rows. Default 2. */
	rows?: number;
	/** A dot's side, px. Default 1. */
	dot?: number;
	/** Dot to dot, px. Default `round(dot / 0.86)`, the canvas render's ratio: dots touch
	 *  up to 3 px and part by a pixel from 4. */
	pitch?: number;
}

/** One dot of the module and where it is wired. */
export interface LcdDot extends PixelPart {
	/** Dot column across the module, 0 … cols·5 − 1: the column driver it hangs on. */
	col: number;
	/** Dot row down the module, 0 … rows·8 − 1. */
	row: number;
	/** Its character cell, counted as `cellAt` does. */
	cell: { x: number; y: number };
}

/**
 * The module's dots on whole pixels, one rect each, row-major: part `i` is index `i` of
 * `lcdTargets`, the crystal state and `lcdInk`. The layout is the character field; the
 * glass around it is the caller's (the canvas core leaves two pitches). A 16×2 at 1 px a dot
 * is 95 × 18 px.
 */
export const lcdPixels = (options: LcdPixelOptions = {}): PixelLayout<LcdDot> => {
	const cols = Math.max(1, Math.floor(options.cols ?? 16));
	const rows = Math.max(1, Math.floor(options.rows ?? 2));
	const dot = Math.max(1, Math.floor(options.dot ?? 1));
	const pitch = Math.max(dot, Math.floor(options.pitch ?? Math.round(dot / DOT_FILL)));
	const parts: LcdDot[] = [];
	for (let row = 0; row < rows * CELL_H; row++) {
		for (let col = 0; col < cols * CELL_W; col++) {
			const cell = { x: Math.floor(col / CELL_W), y: Math.floor(row / CELL_H) };
			const x = (cell.x * ADV_X + (col % CELL_W)) * pitch;
			const y = (cell.y * ADV_Y + (row % CELL_H)) * pitch;
			parts.push({ col, row, cell, rects: [{ x, y, w: dot, h: dot }] });
		}
	}
	return {
		width: (cols * ADV_X - 2) * pitch + dot,
		height: (rows * ADV_Y - 3) * pitch + dot,
		parts
	};
};

export interface LcdTargetOptions {
	/** Character columns. Default 16. */
	cols?: number;
	/** Character rows. Default 2. */
	rows?: number;
	/** CGRAM: up to 8 glyphs of 8 rows of 5-bit masks, bit 4 the leftmost dot; text
	 *  addresses slot `i` as code point `i`. */
	cgram?: ArrayLike<ArrayLike<number>>;
	/** Extension glyphs over the vendored face, character → 5×7 art (the canvas `glyphs`
	 *  option's format, e.g. `LATIN_5X7`). CGRAM code points still win. */
	glyphs?: Record<string, string> | null;
	/** A cursor parked on a cell (clamped to the grid): 'line' a steady underline, 'block'
	 *  blinking at the controller's ~1 Hz. */
	cursor?: { col: number; row: number; style: 'line' | 'block' } | null;
	/** The uninitialised top row of solid blocks for the first 0.8 s. Default false. */
	boot?: boolean;
	/** Power. Off drives nothing, and `stepCrystals` drains the ink. Default true. */
	on?: boolean;
	/** Seconds since power-on: times the boot row and the blink. Default 0. */
	t?: number;
}

/**
 * The dots the controller drives for `text` ('\n' splits rows, or one string per row;
 * longer lines are cut, missing ones blank), 1 driven, row-major as `lcdPixels` lays them.
 * Feed it to `stepCrystals`; the crystals, not this, decide what shows.
 */
export const lcdTargets = (
	text: string | readonly string[],
	options: LcdTargetOptions = {}
): Uint8Array => {
	const { cols = 16, rows = 2, cgram, glyphs, cursor, boot = false, on = true, t = 0 } = options;
	const target = new Uint8Array(cols * CELL_W * rows * CELL_H);
	if (!on) return target;
	const faces = new Map<string, readonly number[]>();
	const rowBits = (ch: string, r: number): number => {
		const code = ch.codePointAt(0) ?? 32;
		if (code < 8) return (Number(cgram?.[code]?.[r]) || 0) & 0x1f;
		if (r >= FONT_5X7.height) return 0;
		let face = faces.get(ch);
		if (!face) {
			const art = glyphs?.[ch];
			face = art ? compile5x7(art) : glyph5x7(ch);
			faces.set(ch, face);
		}
		return face[r];
	};
	const park = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(v) || 0));
	const shown =
		cursor?.style === 'line' || (cursor?.style === 'block' && !(Math.floor(t / BLINK_S) & 1));
	return driveDots(target, {
		cols,
		rows,
		lines: typeof text === 'string' ? text.split('\n') : text,
		rowBits,
		cursor:
			cursor && shown
				? { col: park(cursor.col, cols), row: park(cursor.row, rows), style: cursor.style }
				: null,
		booting: boot && t < BOOT_S
	});
};

export interface LcdInkOptions extends Partial<Wear> {
	/** Character columns: wear and crosstalk run per dot column. Default 16. */
	cols?: number;
	/** The contrast trimmer 0..1. Default 0.8; past ~0.85 it overdrives. */
	contrast?: number;
	/** The resting dot lattice. Default true. */
	ghost?: boolean;
	/** The glass. Default 'green'. */
	panel?: PanelName;
	/** Backlight, true (= 1), false or 0..1; on the negative blue glass it is the image.
	 *  Default true. */
	backlight?: boolean | number;
}

/**
 * Each dot's ink at a moment, 0..1, from its crystal `state`: how far to mix the panel's
 * `ink` over its pane. Undriven dots keep the ghost lattice; overdriven contrast darkens it
 * and streaks driven columns, read off the crystals so the streaks come and go at crystal
 * speed. `age` wears the dot columns by `wearLevels`: dimming, past 0.7 a column flickering,
 * from 0.95 one dead (bare lattice).
 */
export const lcdInk = (state: ArrayLike<number>, options: LcdInkOptions = {}): Float32Array => {
	const { cols = 16, contrast = 0.8, ghost = true, panel = 'green', backlight = true } = options;
	const { age = 0, seed = 0, t = 0 } = options;
	const across = cols * CELL_W;
	const lit = backlight === true ? 1 : clamp01(Number(backlight) || 0);
	const pot = potOf(PANELS[panel] ?? PANELS.green, contrast, ghost, age, lit);
	const wear = wearLevels(across, { age, seed, t });
	const ink = new Float32Array(state.length);
	const drive = new Float32Array(across);
	for (let i = 0; i < ink.length; i++) {
		ink[i] = state[i] * wear[i % across];
		drive[i % across] += ink[i];
	}
	const down = ink.length / across;
	for (let c = 0; c < across; c++) drive[c] /= down;
	for (let i = 0; i < ink.length; i++) ink[i] = clamp01(inkOf(ink[i], drive[i % across], pot));
	return ink;
};
