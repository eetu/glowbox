// SHARED SOURCE. This file lives in `shared/` and is SYMLINKED into each package that
// needs it (see `scripts/check-shared.mjs` and CLAUDE.md → Conventions). Editing it here
// edits it for every one of them. It is not a package and nothing depends on it at
// runtime: each bundler inlines it, so the cores stay genuinely zero-dep.
// Shared by: flip-dot, lcd, neon, nixie, seven-segment, split-flap, vfd.
//
// Whole-pixel geometry for a game painting a display into its own low-resolution raster: a
// layout is parts, a part is the rects it covers. What lights them each frame (levels, wear)
// stays apart, so a layout is built once per text or panel and read every frame. Each core
// extends `PixelPart` with its own address (a segment's name, a dot's column and row).

/** A rectangle in whole pixels: `x`, `y` from the layout's top-left, `w` × `h`. */
export interface PixelRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** One lightable piece (a segment, a dot, a tube section, an anode) as the rects it covers. */
export interface PixelPart {
	rects: PixelRect[];
}

/** A display laid out in whole pixels. */
export interface PixelLayout<P extends PixelPart = PixelPart> {
	width: number;
	height: number;
	parts: P[];
}

/** `value`, or a RangeError naming `name` when it is NaN or infinite: no layout has that size. */
export function finitePx(value: number, name: string): number {
	if (!Number.isFinite(value))
		throw new RangeError(`glowbox: ${name} must be a finite number (got ${value}).`);
	return value;
}

/** `value` rounded to whole pixels, or a RangeError naming `name` when it is not finite or
 *  rounds below `min`. */
export function wholePx(value: number, name: string, min = 1): number {
	const px = Math.round(finitePx(value, name));
	if (px < min) throw new RangeError(`glowbox: ${name} must be at least ${min} px (got ${value}).`);
	return px;
}
