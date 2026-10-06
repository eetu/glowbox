// SHARED SOURCE. This file lives in `shared/` and is SYMLINKED into each package that
// needs it (see `scripts/check-shared.mjs` and CLAUDE.md → Conventions). Editing it here
// edits it for every one of them. It is not a package and nothing depends on it at
// runtime: each bundler inlines it, so the cores stay genuinely zero-dep.
// Shared by: seven-segment, vfd.
//
// A seven-segment digit on whole pixels, for every core that has one (seven-segment, vfd's
// `7seg` digits). At a dozen pixels tall the outline geometry doesn't survive rounding: a slant
// jogs every stroke a pixel halfway down (a 1 reads as a J), and a fractional width lands each
// digit on a different sub-pixel phase. These are upright rects on an integer grid.
import type { PixelRect } from './pixel';

/** The seven segments, `a` the top and clockwise to `f`, `g` the middle, and the point. */
export type PixelSegmentName = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'dp';

export interface PixelDigitOptions {
	/** Stroke thickness, px. Default 1. */
	stroke?: number;
	/** Digit width, px. Default `round(height / 2)`. */
	width?: number;
}

/**
 * Each segment of a digit `height` px tall as a rect from the digit's top-left. The
 * horizontals sit between the verticals, so no two segments touch; the middle bar sits at
 * `floor((height − stroke) / 2)`, so with an odd split the lower half is the taller, as on
 * the hardware. `dp` sits just right of the digit's foot, in the gap to the next one.
 */
export function pixelSegments(
	height: number,
	{ stroke = 1, width = Math.round(height / 2) }: PixelDigitOptions = {}
): Record<PixelSegmentName, PixelRect> {
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
