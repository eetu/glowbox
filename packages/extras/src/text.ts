// Text helper: draw a string onto a grid plane. Two font paths:
//   • 'bitmap' (default) — the bundled 5×7 LED font (font5x7.ts): deterministic across
//     OSes, DOM-free (works headlessly in node), multi-line via '\n', integer `scale`.
//   • 'system' — rasterize with a 2D canvas in the platform's bold sans-serif
//     (browser-only, single line; `fontSize`/`threshold` apply). The rasterize+sample
//     step is memoized on (str, dims, fontSize), so per-frame calls are cheap.
// Draws once — call it from your per-frame callback (it does not clear).
import { type Color, parseColor, type RGB, type VoxelGrid } from '@glowbox/led-grid';

import { FONT_5X7, glyph5x7 } from './font5x7';
import { type Axes, type PaintOptions, planeAxes } from './plane';
import { type ImageSource, sampleImageToGrid } from './sample';

export interface TextOptions extends Omit<PaintOptions, 'gain'> {
	/** Lit colour (default white). */
	color?: Color;
	/** `'bitmap'` (default): the bundled 5×7 LED font — deterministic, multi-line via
	 *  `\n`. `'system'`: the platform's bold sans-serif (single line, browser-only). */
	font?: 'bitmap' | 'system';
	/** Bitmap font: integer pixel scale (default 1 → a 6×8-cell advance per char). */
	scale?: number;
	/** System font only: size in grid cells (default: ~80% of the plane's V dimension). */
	fontSize?: number;
}

/** The ink-box size in cells of `str` in the bitmap font (multi-line aware). */
export function measureText(str: string, scale = 1): { width: number; height: number } {
	const lines = str.split('\n');
	const adv = FONT_5X7.width + 1;
	const width = Math.max(0, ...lines.map((l) => (l.length ? l.length * adv - 1 : 0)));
	const height = lines.length * (FONT_5X7.height + 1) - 1;
	return { width: width * scale, height: height * scale };
}

// Plot `str` in the bitmap font, block-centred on the plane (each line centred too).
// Grid v runs UP while glyph rows run down, so rows are laid out from a top v.
function drawBitmap(
	g: VoxelGrid,
	str: string,
	color: RGB,
	{ dimU, dimV, at }: Axes,
	depth: number,
	scale: number
) {
	const lines = str.split('\n');
	const advU = (FONT_5X7.width + 1) * scale;
	const advV = (FONT_5X7.height + 1) * scale;
	const blockH = lines.length * advV - scale;
	const vTop = Math.round((dimV - 1) / 2 + (blockH - 1) / 2);
	for (let li = 0; li < lines.length; li++) {
		const line = lines[li];
		const lineW = line.length ? line.length * advU - scale : 0;
		const u0 = Math.round((dimU - lineW) / 2);
		const lineTop = vTop - li * advV;
		for (let ci = 0; ci < line.length; ci++) {
			const rows = glyph5x7(line[ci]);
			const uBase = u0 + ci * advU;
			for (let gy = 0; gy < FONT_5X7.height; gy++) {
				const bits = rows[gy];
				if (!bits) continue;
				for (let gx = 0; gx < FONT_5X7.width; gx++) {
					if (!((bits >> (FONT_5X7.width - 1 - gx)) & 1)) continue;
					for (let sy = 0; sy < scale; sy++)
						for (let sx = 0; sx < scale; sx++) {
							const [x, y, z] = at(uBase + gx * scale + sx, lineTop - gy * scale - sy, depth);
							g.plot(x, y, z, color);
						}
				}
			}
		}
	}
}

// Rasterize `str` to an nx×ny RGBA buffer (white glyphs on black), centred.
function rasterizeText(str: string, nx: number, ny: number, fontSize?: number): ImageSource {
	if (typeof document === 'undefined') throw new Error('glowbox: 2D canvas unavailable');
	const canvas = document.createElement('canvas');
	canvas.width = nx;
	canvas.height = ny;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('glowbox: 2D canvas unavailable');
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, nx, ny);
	const px = Math.max(4, Math.floor(fontSize ?? ny * 0.8));
	ctx.font = `bold ${px}px sans-serif`;
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(str, nx / 2, ny / 2);
	const img = ctx.getImageData(0, 0, nx, ny);
	return { data: img.data, width: img.width, height: img.height };
}

// Memoize the expensive part — rasterizing + sampling to an alpha mask — keyed on the
// text and target dims. A caller that feeds changing substrings would grow this
// unbounded, so cap it and evict least-recently-used (Map keeps insertion order; a hit
// re-inserts to refresh recency).
const RASTER_CACHE = new Map<string, Float32Array>();
const RASTER_CACHE_MAX = 64;
function rasterAlpha(str: string, dimU: number, dimV: number, fontSize?: number): Float32Array {
	const key = `${str} ${dimU}x${dimV} ${fontSize ?? ''}`;
	const hit = RASTER_CACHE.get(key);
	if (hit) {
		RASTER_CACHE.delete(key);
		RASTER_CACHE.set(key, hit);
		return hit;
	}
	const raster = rasterizeText(str, dimU, dimV, fontSize);
	const { alpha } = sampleImageToGrid(raster, dimU, dimV, 'stretch');
	RASTER_CACHE.set(key, alpha);
	if (RASTER_CACHE.size > RASTER_CACHE_MAX) {
		const oldest = RASTER_CACHE.keys().next().value;
		if (oldest !== undefined) RASTER_CACHE.delete(oldest);
	}
	return alpha;
}

/** Draw `str` onto the grid plane (default the xy face, mid-depth), in `color`. */
export function text(g: VoxelGrid, str: string, opts: TextOptions = {}): void {
	const axes = planeAxes(g, opts.plane ?? 'xy');
	const depth = opts.depth ?? axes.dimW >> 1;
	const color = parseColor(opts.color ?? [1, 1, 1]);
	if ((opts.font ?? 'bitmap') === 'bitmap') {
		drawBitmap(g, str, color, axes, depth, Math.max(1, Math.floor(opts.scale ?? 1)));
		return;
	}
	const { dimU, dimV, at } = axes;
	const threshold = opts.threshold ?? 0.5;
	const alpha = rasterAlpha(str, dimU, dimV, opts.fontSize);
	for (let v = 0; v < dimV; v++)
		for (let u = 0; u < dimU; u++) {
			if (alpha[v * dimU + u] < threshold) continue;
			const [x, y, z] = at(u, v, depth);
			g.plot(x, y, z, color);
		}
}
