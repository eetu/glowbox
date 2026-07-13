// Marquee helper: a per-frame draw callback that scrolls a message across a grid
// plane, wrapping seamlessly (message + gap tile end to end). Bitmap font by default
// (the bundled 5×7 — DOM-free and deterministic); 'system' rasterizes any installed
// face at the plane's height, like a chunky LED ticker. The text and the system font
// family accept getters so a live UI can retype/restyle without recreating the program.
import { type Color, parseColor, type RGB } from '@glowbox/led-grid';

import { FONT_5X7, glyph5x7 } from './font5x7';
import type { DrawFn } from './image';
import { type Plane, planeAxes } from './plane';

export interface TextScrollerOptions {
	/** Lit colour (default white), or a per-column function
	 *  `(column, elapsedSeconds, planeWidth) => Color` for gradients/rainbows. */
	color?: Color | ((column: number, elapsed: number, width: number) => Color);
	/** Grid plane the marquee runs across (default `'xy'`). */
	plane?: Plane;
	/** Index on the plane's normal axis (default: the middle slice). */
	depth?: number;
	/** Scroll speed in cells per second (default 10). */
	speed?: number;
	/** Blank columns between repeats (default: one glyph height). */
	gap?: number;
	/** `'bitmap'` (default, the bundled 5×7) or `'system'` (rasterized, browser-only). */
	font?: 'bitmap' | 'system';
	/** Bitmap font: integer pixel scale (default 1). */
	scale?: number;
	/** System font: CSS font family (default sans-serif); a getter re-styles live. */
	fontFamily?: string | (() => string);
	/** System font: size in grid cells (default: ~85% of the plane's V dimension). */
	fontSize?: number;
	/** Clear the grid before painting each frame (default true). */
	clear?: boolean;
}

// A message rendered as testable columns; row 0 = bottom (grid v-up).
interface ColumnSampler {
	width: number;
	height: number;
	lit(col: number, row: number): boolean;
}

function bitmapSampler(msg: string, scale: number): ColumnSampler {
	const adv = (FONT_5X7.width + 1) * scale;
	return {
		width: Math.max(1, msg.length * adv - scale),
		height: FONT_5X7.height * scale,
		lit(col, row) {
			const ci = Math.floor(col / adv);
			const gx = Math.floor((col - ci * adv) / scale);
			if (gx >= FONT_5X7.width) return false; // the inter-character gap column
			const gy = FONT_5X7.height - 1 - Math.floor(row / scale);
			return !!((glyph5x7(msg[ci] ?? ' ')[gy] >> (FONT_5X7.width - 1 - gx)) & 1);
		}
	};
}

// Rasterize the whole message once at the plane's height (1 canvas px = 1 cell), at its
// natural width, so columns sample 1:1 with no resampling. Browser-only; null on SSR.
function systemSampler(
	msg: string,
	dimV: number,
	family: string,
	fontSize?: number
): ColumnSampler | null {
	if (typeof document === 'undefined') return null;
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	const px = Math.max(6, Math.floor(fontSize ?? dimV * 0.85));
	const css = `bold ${px}px ${family}`;
	ctx.font = css;
	const width = Math.max(1, Math.ceil(ctx.measureText(msg).width));
	canvas.width = width;
	canvas.height = dimV;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, width, dimV);
	ctx.font = css; // resizing the canvas resets context state
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillText(msg, 0, dimV / 2);
	const { data } = ctx.getImageData(0, 0, width, dimV);
	return {
		width,
		height: dimV,
		lit: (col, row) => data[((dimV - 1 - row) * width + col) * 4] > 128
	};
}

/**
 * Build a scrolling-text draw callback. Give the result to `display.onFrame(...)`
 * (or a wrapper's `draw` prop). The message loops with `gap` blank columns between
 * repeats; text wider than the plane simply streams through.
 */
export function makeTextScroller(
	text: string | (() => string),
	opts: TextScrollerOptions = {}
): DrawFn {
	const font = opts.font ?? 'bitmap';
	const speed = opts.speed ?? 10;
	const clear = opts.clear ?? true;
	const scale = Math.max(1, Math.floor(opts.scale ?? 1));
	const colorOpt = opts.color ?? [1, 1, 1];
	const colorFn = typeof colorOpt === 'function' ? colorOpt : null;
	const staticColor: RGB = typeof colorOpt === 'function' ? [0, 0, 0] : parseColor(colorOpt);
	let sampler: ColumnSampler | null = null;
	let key = '';
	let scroll = 0;
	let elapsed = 0;
	return (d, dt) => {
		elapsed += dt;
		scroll += dt * speed;
		if (clear) d.clear();
		const axes = planeAxes(d, opts.plane ?? 'xy');
		const { dimU, dimV, at } = axes;
		const depth = opts.depth ?? axes.dimW >> 1;
		const msg = (typeof text === 'function' ? text() : text) || ' ';
		const family =
			typeof opts.fontFamily === 'function' ? opts.fontFamily() : (opts.fontFamily ?? 'sans-serif');
		const k = `${font}|${msg}|${family}|${dimV}|${scale}`;
		if (!sampler || k !== key) {
			sampler =
				font === 'bitmap'
					? bitmapSampler(msg, scale)
					: systemSampler(msg, dimV, family, opts.fontSize);
			key = k;
		}
		if (!sampler) return; // system font with no DOM — nothing to draw
		const gap = Math.max(1, Math.round(opts.gap ?? sampler.height));
		const period = sampler.width + gap;
		const base = Math.floor(scroll);
		const vLo = Math.round((dimV - sampler.height) / 2);
		for (let u = 0; u < dimU; u++) {
			const src = (((base + u) % period) + period) % period;
			if (src >= sampler.width) continue;
			const c = colorFn ? parseColor(colorFn(u, elapsed, dimU)) : staticColor;
			for (let row = 0; row < sampler.height; row++) {
				if (!sampler.lit(src, row)) continue;
				const [x, y, z] = at(u, vLo + row, depth);
				d.plot(x, y, z, c);
			}
		}
	};
}
