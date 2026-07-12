// Pure image → grid sampling. Maps a source image (flat RGBA, as from an
// ImageData) onto an nx×ny grid plane by nearest-neighbour, honouring an aspect
// `fit`. No DOM, no WebGL — unit-testable and reusable headlessly.

/** How the image maps into the grid rectangle when aspect ratios differ. */
export type Fit = 'contain' | 'cover' | 'stretch';

/** A decoded image: RGBA bytes (row-major, y-down — like `ImageData`). */
export interface ImageSource {
	data: Uint8ClampedArray;
	width: number;
	height: number;
}

/** Per-cell colour (0..1 RGB) + coverage (0..1 alpha) for an nx×ny grid plane. */
export interface GridSample {
	nx: number;
	ny: number;
	/** nx*ny*3, row-major, y-UP (grid row 0 is the bottom). */
	rgb: Float32Array;
	/** nx*ny, y-UP. 0 = outside the image (letterbox) or a transparent source pixel. */
	alpha: Float32Array;
}

/**
 * Sample `src` onto an `nx`×`ny` grid. Grid rows run bottom-up (row 0 = bottom),
 * so the image lands upright on a `y`-up display. `fit`:
 * - `contain` (default) — whole image inside the grid, letterboxed (alpha 0 outside).
 * - `cover` — fill the grid, cropping the overflow.
 * - `stretch` — ignore aspect, map edge-to-edge.
 */
export function sampleImageToGrid(
	src: ImageSource,
	nx: number,
	ny: number,
	fit: Fit = 'contain'
): GridSample {
	const rgb = new Float32Array(nx * ny * 3);
	const alpha = new Float32Array(nx * ny);
	const { data, width, height } = src;

	// The grid-pixel rectangle the image draws into (offset can be negative for cover).
	let drawW = nx;
	let drawH = ny;
	let offX = 0;
	let offY = 0;
	if (fit !== 'stretch' && width > 0 && height > 0) {
		const scale =
			fit === 'cover' ? Math.max(nx / width, ny / height) : Math.min(nx / width, ny / height);
		drawW = width * scale;
		drawH = height * scale;
		offX = (nx - drawW) / 2;
		offY = (ny - drawH) / 2;
	}

	for (let gy = 0; gy < ny; gy++) {
		// Fraction down the draw rect (grid is y-up; the image is y-down → flip).
		const fy = (gy + 0.5 - offY) / drawH;
		for (let gx = 0; gx < nx; gx++) {
			const o = gy * nx + gx;
			const fx = (gx + 0.5 - offX) / drawW;
			if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) continue; // letterbox
			const sx = Math.min(width - 1, Math.max(0, (fx * width) | 0));
			const sy = Math.min(height - 1, Math.max(0, ((1 - fy) * height) | 0));
			const si = (sy * width + sx) * 4;
			const a = data[si + 3] / 255;
			if (a <= 0) continue;
			rgb[o * 3] = (data[si] / 255) * a;
			rgb[o * 3 + 1] = (data[si + 1] / 255) * a;
			rgb[o * 3 + 2] = (data[si + 2] / 255) * a;
			alpha[o] = a;
		}
	}
	return { nx, ny, rgb, alpha };
}
