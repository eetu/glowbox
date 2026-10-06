// A neon sign as data at whole-pixel scale, for a game painting it into its own raster: the
// same tube sections `layoutTubes` bends, each rasterised as a 1 px (or wider) tube, and a
// separate function for each section's light at a moment. The blur passes, the hot core and
// absorb compositing stay with the canvas render; in a game the scene's light does the spill.
import { type NeonFont, resolveFont } from './font';
import { type LayoutOptions, layoutTubes } from './layout';
import { CHASE_MIN, FLASH_MIN, type NeonProgram, strikeBri } from './neon';
import type { PixelLayout, PixelPart, PixelRect } from './pixel';
import { maskRects } from './pixel-stroke';
import { wearLevels } from './wear';

type Point = [number, number];

export interface NeonPixelOptions extends Omit<LayoutOptions, 'outline'> {
	/** A capital's height, px, the tube included. */
	capHeight: number;
	/** Default 'script'. */
	font?: 'script' | 'sans' | NeonFont;
	/** Tube width, px. Default 1. */
	stroke?: number;
}

/** One tube section: its glass as rects, where it is wired, and its electrodes. */
export interface NeonPixelPart extends PixelPart {
	line: number;
	word?: number;
	art?: number;
	/** The electrode stubs, one rect per end: metal, never lit. */
	ends: PixelRect[];
	/** An art piece wired past the flasher. */
	steady?: boolean;
}

/** A switch: on, off, or on since this time, s (dark before it, struck from it). */
export type NeonSwitch = boolean | number;

export interface NeonLevelOptions {
	/** The sign; wear and each tube's strike follow it. Default 0. */
	seed?: number;
	/** Wear 0..1 (see `wearLevels`). Default 0. */
	age?: number;
	/** The flasher. Default 'steady'. */
	program?: NeonProgram;
	/** Flasher rate multiplier, 0.1..8; the floors still hold. Default 1. */
	speed?: number;
	/** One tube's strike, ms; 0 lights at once. Default 900. */
	strikeMs?: number;
	/** The wall switch. Default true. */
	on?: NeonSwitch;
	/** Per text line and per word, as `NeonSignOptions`; missing entries are on. */
	lineOn?: NeonSwitch[];
	wordOn?: NeonSwitch[];
}

// The cells a 1 px line through `pts` covers, in order, sampled every half pixel. Where the
// path turns a corner through a cell it doesn't need (the cells either side touch
// diagonally), that cell goes: a curve is then one pixel wide all the way round, a tube
// rather than a ribbon that thickens at every bend. Except where the turn reverses the
// path's way along an axis: that is the bottom of an O, and dropping the corner there
// leaves it a point; the next corner goes instead and the bottom stays flat.
const cellPath = (pts: Point[]): Point[] => {
	const path: Point[] = [];
	let tx = 0;
	let ty = 0;
	const add = (fx: number, fy: number) => {
		const x = Math.floor(fx);
		const y = Math.floor(fy);
		let b = path[path.length - 1];
		if (b && b[0] === x && b[1] === y) return;
		const a = path[path.length - 2];
		const onward = b && (x - b[0]) * tx >= 0 && (y - b[1]) * ty >= 0;
		if (a && onward && Math.abs(a[0] - x) === 1 && Math.abs(a[1] - y) === 1) {
			path.pop();
			b = a;
		}
		// Steps are one cell, so the last step along each axis is its way.
		if (b) {
			if (x !== b[0]) tx = x - b[0];
			if (y !== b[1]) ty = y - b[1];
		}
		path.push([x, y]);
	};
	add(...pts[0]);
	for (let i = 1; i < pts.length; i++) {
		const [ax, ay] = pts[i - 1];
		const [bx, by] = pts[i];
		const steps = Math.ceil(2 * Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
		for (let s = 1; s <= steps; s++)
			add(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps);
	}
	return path;
};

/**
 * `text` as tube sections on whole pixels, one part per section of `layoutTubes` (same
 * order, same `line`/`word`/`art`): its glass as rects, and an electrode stub at each end,
 * 1 px long on a 1 px tube under a 14 px cap height, 2 px otherwise. A capital is
 * `capHeight` rows, the tube included. Rects are from the sign's top-left.
 */
export const neonPixels = (text: string, options: NeonPixelOptions): PixelLayout<NeonPixelPart> => {
	const { capHeight, font = 'script', stroke = 1, ...rest } = options;
	const lay = layoutTubes(text, font, rest);
	const w = Math.max(1, Math.round(stroke));
	const lo = (w - 1) >> 1;
	const k = Math.max(1, capHeight - w) / resolveFont(font).capHeight;
	// A margin for the brush and the stubs; trimmed off once everything is placed.
	const m = w + 6;
	const W = Math.ceil(lay.width * k) + 2 * m;
	const H = Math.ceil(lay.height * k) + 2 * m;
	// Sign units to pixels, with a baseline and a cap top on cell centres.
	const px = ([x, y]: Point): Point => [(x - lay.left) * k + m + 0.5, (y - lay.top) * k + m + 0.5];
	const stub = capHeight < 14 && w < 2 ? 1 : 2;
	let x0 = W;
	let y0 = H;
	let x1 = 0;
	let y1 = 0;
	const grow = (x: number, y: number, ex = x, ey = y) => {
		x0 = Math.min(x0, x);
		y0 = Math.min(y0, y);
		x1 = Math.max(x1, ex);
		y1 = Math.max(y1, ey);
	};
	const masks = lay.sections.map((sec) => {
		const mask = new Uint8Array(W * H);
		for (const s of sec.strokes)
			for (const [x, y] of cellPath(s.map(px))) {
				grow(x - lo, y - lo, x - lo + w - 1, y - lo + w - 1);
				for (let dy = 0; dy < w; dy++)
					mask.fill(1, (y - lo + dy) * W + x - lo, (y - lo + dy) * W + x - lo + w);
			}
		// Each stub leaves the tube's last cell along its end's nearer axis, from the
		// first cell clear of the glass.
		const ends = sec.ends.map((e) => {
			let [x, y] = px([e.x, e.y]).map(Math.floor);
			const sx = Math.abs(e.dx) >= Math.abs(e.dy) ? Math.sign(e.dx) : 0;
			const sy = sx ? 0 : Math.sign(e.dy);
			for (let i = 0; i <= w && mask[y * W + x]; i++) {
				x += sx;
				y += sy;
			}
			const r = {
				x: sx < 0 ? x - stub + 1 : x,
				y: sy < 0 ? y - stub + 1 : y,
				w: sx ? stub : 1,
				h: sy ? stub : 1
			};
			grow(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
			return r;
		});
		return { sec, mask, ends };
	});
	const width = Math.max(0, x1 - x0 + 1);
	const height = Math.max(0, y1 - y0 + 1);
	const parts = masks.map(({ sec, mask, ends }) => {
		const trimmed = new Uint8Array(width * height);
		for (let y = 0; y < height; y++)
			trimmed.set(mask.subarray((y + y0) * W + x0, (y + y0) * W + x0 + width), y * width);
		const part: NeonPixelPart = {
			rects: maskRects(trimmed, width, height),
			line: sec.line,
			ends: ends.map((r) => ({ ...r, x: r.x - x0, y: r.y - y0 }))
		};
		if (sec.word != null) part.word = sec.word;
		if (sec.art != null) {
			part.art = sec.art;
			if (rest.art?.[sec.art].steady) part.steady = true;
		}
		return part;
	});
	return { width, height, parts };
};

/**
 * Each part's light at `t`, s: 0 is unlit glass (paint it as the ghost), 1 lit, up to 1.15
 * mid-strike. A circuit closes when its last switch does (the wall switch, then a text
 * part's line and word), and from then its tube strikes: dark while the electrodes arc, a
 * few partial pops, an overshoot, settling at 1, the tubes scattered as they warm, or in
 * order under 'reveal'. 'flash' and 'chase' run from the wall switch, never faster than the
 * canvas sign's floors (a state lasts at least 200 ms flashing, 120 ms chasing), relighting
 * in 50 ms and dying in 60. Wear multiplies it all (`wearLevels`). The same `t` and options
 * give the same levels.
 */
export const neonLevels = (
	layout: PixelLayout<NeonPixelPart>,
	t: number,
	options: NeonLevelOptions = {}
): Float32Array => {
	const { seed = 0, age = 0, program = 'steady', strikeMs = 900, on = true } = options;
	const speed = Math.max(0.1, Math.min(8, options.speed ?? 1));
	const flash = program === 'flash';
	const step = flash ? Math.max(FLASH_MIN, 800 / speed) : Math.max(CHASE_MIN, 320 / speed);
	const dur = strikeMs / 1000;
	const out = wearLevels(layout.parts.length, { age: Math.max(0, Math.min(1, age)), seed, t });
	layout.parts.forEach((p, i) => {
		const switches =
			p.art == null ? [on, options.lineOn?.[p.line], options.wordOn?.[p.word ?? -1]] : [on];
		if (switches.some((s) => s === false || (typeof s === 'number' && s > t))) {
			out[i] = 0;
			return;
		}
		const since = Math.max(...switches.map((s) => (typeof s === 'number' ? s : -Infinity)));
		const j = Math.abs(Math.sin(seed * 78.233 + i * 12.9898) * 43758.5453) % 1;
		let lit = 1;
		if (since > -Infinity && dur > 0) {
			const wait = program === 'reveal' && since === on ? i * Math.max(0.24, dur * 0.4) : j * 0.14;
			const u = (t - since - wait) / (dur * (0.85 + 0.3 * j));
			if (u < 1) lit = u < 0 ? 0 : strikeBri(u, j);
		}
		if (lit === 1 && !p.steady && (flash || program === 'chase')) {
			const c = (t - (typeof on === 'number' ? on : 0)) * 1000;
			const n = Math.floor(c / step);
			const e = c - n * step;
			const off = (q: number) => (flash ? (q & 1) === 1 : ((i + q) & 3) === 0);
			lit = off(n) ? Math.max(0, 1 - e / 60) : off(n - 1) ? Math.min(1, e / 50) : 1;
		}
		out[i] *= lit;
	});
	return out;
};
