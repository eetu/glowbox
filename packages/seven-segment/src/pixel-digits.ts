// Seven-segment digits on whole pixels, as data, for a game drawing them into its own
// low-resolution raster (the way @glowbox/lcd hands out its 5×7 font). At a dozen pixels
// tall the outlines of `segmentGeometry` don't survive rounding: the slant jogs every
// stroke a pixel halfway down (a 1 reads as a J), and a fractional digit width lands each
// digit on a different sub-pixel phase. These are upright rects on an integer grid. The
// caller paints them; `on: false` segments are the unlit ghosts a real display shows.
import type { PixelLayout, PixelPart, PixelRect } from './pixel';
import { litSegments, type SegmentName } from './seven';

export interface PixelDigitOptions {
	/** Stroke thickness, px. Default 1. */
	stroke?: number;
	/** Digit width, px. Default `round(height / 2)`. */
	width?: number;
}

const SEGMENTS: Exclude<SegmentName, 'dp'>[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

/**
 * Each segment of a digit `height` px tall as a rect from the digit's top-left. The
 * horizontals sit between the verticals, so no two segments touch; the middle bar sits at
 * `floor((height − stroke) / 2)`, so with an odd split the lower half is the taller, as on
 * the hardware. `dp` sits just right of the digit's foot, in the gap to the next one.
 */
export function pixelSegments(
	height: number,
	{ stroke = 1, width = Math.round(height / 2) }: PixelDigitOptions = {}
): Record<SegmentName, PixelRect> {
	const s = stroke;
	const mid = Math.floor((height - s) / 2);
	const across = { x: s, w: width - 2 * s, h: s };
	const upper = { y: s, w: s, h: mid - s };
	const lower = { y: mid + s, w: s, h: height - s - (mid + s) };
	return {
		a: { ...across, y: 0 },
		b: { ...upper, x: width - s },
		c: { ...lower, x: width - s },
		d: { ...across, y: height - s },
		e: { ...lower, x: 0 },
		f: { ...upper, x: 0 },
		g: { ...across, y: mid },
		dp: { x: width, y: height - s, w: s, h: s }
	};
}

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
