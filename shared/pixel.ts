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
