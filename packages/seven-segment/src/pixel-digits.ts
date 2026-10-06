// Seven-segment digits laid out in a row on whole pixels, as data, for a game drawing them
// into its own low-resolution raster (the way @glowbox/lcd hands out its 5×7 font). One
// digit's rects are `pixelSegments` (shared/pixel-segments.ts). The caller paints them;
// `on: false` segments are the unlit ghosts a real display shows.
import type { PixelLayout, PixelPart } from './pixel';
import { type PixelDigitOptions, pixelSegments } from './pixel-segments';
import { litSegments, type SegmentName } from './seven';
import { type Wear, wearLevels } from './wear';

const SEGMENTS: Exclude<SegmentName, 'dp'>[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

export interface PixelTextOptions extends PixelDigitOptions {
	/** Digit height, px. */
	height: number;
	/** Pixels between digits. Default twice the stroke. */
	gap?: number;
	/** Whether the colons are lit — a clock blinks them. Default true. */
	colon?: boolean;
}

/** One segment of a laid-out row: which character it belongs to, which segment, lit or not. */
export interface PixelSegment extends PixelPart {
	/** The index of its character in the text. */
	index: number;
	name: SegmentName | 'colon';
	on: boolean;
}

/**
 * A row of digits laid out on whole pixels: `"12:34"`, `"-0.5"`, `"88:88"`. Each digit
 * gives all seven segments, lit or not; `:` is a colon, its two dots one part in a slot a
 * stroke wide; `.` lights the decimal point of the digit before it; a space, or anything
 * `litSegments` doesn't know, is a digit with nothing lit. Rects are from the row's
 * top-left.
 */
export function pixelText(text: string, options: PixelTextOptions): PixelLayout<PixelSegment> {
	const { height, stroke = 1, gap = 2 * stroke, colon = true } = options;
	const width = options.width ?? Math.round(height / 2);
	const digit = pixelSegments(height, { stroke, width });
	const mid = Math.floor((height - stroke) / 2);
	const parts: PixelSegment[] = [];
	let x = 0;
	let right = 0;
	let last = -1;
	[...text].forEach((ch, index) => {
		if (ch === '.') {
			if (last < 0) return;
			// In the gap after its digit, which is where `x` stands until the next one.
			const rect = { ...digit.dp, x: x + Math.floor((gap - digit.dp.w) / 2) };
			parts.push({ index: last, name: 'dp', rects: [rect], on: true });
			right = rect.x + rect.w;
			last = -1;
			return;
		}
		if (x > 0) x += gap;
		if (ch === ':') {
			const dot = (y: number) => ({ x, y, w: stroke, h: stroke });
			parts.push({
				index,
				name: 'colon',
				rects: [dot(mid - 2 * stroke), dot(mid + 2 * stroke)],
				on: colon
			});
			x += stroke;
			last = -1;
			return;
		}
		const lit = new Set(litSegments(ch));
		for (const name of SEGMENTS) {
			const r = digit[name];
			parts.push({ index, name, rects: [{ ...r, x: x + r.x }], on: lit.has(name) });
		}
		x += width;
		last = index;
	});
	return { width: Math.max(x, right), height, parts };
}

/**
 * Each part's light at `wear.t`, 0 (a ghost) … 1: lit parts at their worn level, the most-worn
 * segment flickering past age 0.7 and dead from 0.95 (see `wearLevels`), unlit parts 0. Paint
 * a part lit in proportion, or as a ghost at 0. Seeded, so a world that rewinds sees the same
 * flicker.
 */
export function pixelLevels(layout: PixelLayout<PixelSegment>, wear: Wear): Float32Array {
	const levels = wearLevels(layout.parts.length, wear);
	layout.parts.forEach((p, i) => {
		if (!p.on) levels[i] = 0;
	});
	return levels;
}
