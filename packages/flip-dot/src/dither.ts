// Dithering for a binary dot matrix — the roadmap's whole argument for flip-dot
// content: grayscale in, spatially-dithered on/off out. Pure logic (no canvas, no
// DOM) so it runs and tests under plain node, and the same frame drives the display
// (`board.setFrame(bits)`) or your own renderer.

/** A grayscale source: a row-major array of 0..1 values, or a function of (x, y). */
export type GraySource = ArrayLike<number> | ((x: number, y: number) => number);

export type DitherMode = 'bayer' | 'floyd' | 'threshold';

export interface DitherOptions {
	/** 'threshold' plain cut (default — at flip-dot resolutions the halftone patterns
	 *  read as noise and churn dots between frames; a clean cut gives stable
	 *  silhouettes), 'bayer' ordered halftone, or 'floyd' error-diffused (best for
	 *  stills). */
	mode?: DitherMode;
	/** Cut point 0..1 for 'threshold' (and bias for the others). Default 0.5. */
	threshold?: number;
}

// 8×8 Bayer matrix, values 0..63 — the standard recursive construction.
const BAYER8: number[] = (() => {
	let m = [0];
	let n = 1;
	while (n < 8) {
		const next = new Array<number>(n * n * 4);
		for (let y = 0; y < n; y++)
			for (let x = 0; x < n; x++) {
				const v = 4 * m[y * n + x];
				next[y * 2 * n + x] = v;
				next[y * 2 * n + (x + n)] = v + 2;
				next[(y + n) * 2 * n + x] = v + 3;
				next[(y + n) * 2 * n + (x + n)] = v + 1;
			}
		m = next;
		n *= 2;
	}
	return m;
})();

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Dither a grayscale field to a binary frame (row-major Uint8Array of 0/1, ready
 *  for `board.setFrame`). Out-of-range luma values are clamped. */
export function ditherFrame(
	src: GraySource,
	cols: number,
	rows: number,
	opts: DitherOptions = {}
): Uint8Array {
	const mode = opts.mode ?? 'threshold';
	const threshold = opts.threshold ?? 0.5;
	const at =
		typeof src === 'function'
			? (x: number, y: number) => clamp01(src(x, y))
			: (x: number, y: number) => clamp01(Number(src[y * cols + x]) || 0);
	const out = new Uint8Array(cols * rows);

	if (mode === 'threshold') {
		for (let y = 0; y < rows; y++)
			for (let x = 0; x < cols; x++) out[y * cols + x] = at(x, y) >= threshold ? 1 : 0;
		return out;
	}

	if (mode === 'bayer') {
		// The matrix cell shifts the cut point per pixel; `threshold` biases the whole
		// field (0.5 = neutral).
		const bias = threshold - 0.5;
		for (let y = 0; y < rows; y++)
			for (let x = 0; x < cols; x++) {
				const cut = (BAYER8[(y & 7) * 8 + (x & 7)] + 0.5) / 64 + bias;
				out[y * cols + x] = at(x, y) >= cut ? 1 : 0;
			}
		return out;
	}

	// Floyd–Steinberg, serpentine scan (halves the worm artifacts on flat fields).
	const buf = new Float32Array(cols * rows);
	for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) buf[y * cols + x] = at(x, y);
	for (let y = 0; y < rows; y++) {
		const ltr = y % 2 === 0;
		for (let i = 0; i < cols; i++) {
			const x = ltr ? i : cols - 1 - i;
			const idx = y * cols + x;
			const old = buf[idx];
			const on = old >= threshold ? 1 : 0;
			out[idx] = on;
			const err = old - on;
			const dx = ltr ? 1 : -1;
			if (x + dx >= 0 && x + dx < cols) buf[idx + dx] += (err * 7) / 16;
			if (y + 1 < rows) {
				if (x - dx >= 0 && x - dx < cols) buf[idx + cols - dx] += (err * 3) / 16;
				buf[idx + cols] += (err * 5) / 16;
				if (x + dx >= 0 && x + dx < cols) buf[idx + cols + dx] += (err * 1) / 16;
			}
		}
	}
	return out;
}
