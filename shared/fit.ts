// Fitting a canvas's backing store to its CSS box, shared by every core.

/** A canvas's CSS box in px (floored at 1) and the device pixel ratio it renders at. */
export type CanvasBox = { w: number; h: number; dpr: number };

/** Measure the canvas: its CSS box, and the device ratio capped by `cap` (a non-positive
 *  cap means 1×, so a stray 0 can't zero the backing store). Never derived from
 *  `canvas.width` — that's the backing size, dpr× the box on a HiDPI screen. */
export function measureCanvas(canvas: HTMLCanvasElement, cap: number): CanvasBox {
	const device = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
	const r = canvas.getBoundingClientRect();
	return {
		w: Math.max(1, r.width || canvas.clientWidth || 1),
		h: Math.max(1, r.height || canvas.clientHeight || 1),
		dpr: Math.min(device, cap > 0 ? cap : 1)
	};
}

/** Size the backing store to `box` × dpr. A canvas with no CSS size of its own is laid
 *  out by its width/height attributes, so at any ratio but 1 this write would resize its
 *  box, re-fire the ResizeObserver and grow without bound. Such a canvas — no inline
 *  size, box equal to its attributes — has its display size pinned in CSS px first. At
 *  1× the write can't move the box, so a responsive canvas is never pinned there. */
export function fitCanvas(canvas: HTMLCanvasElement, { w, h, dpr }: CanvasBox): void {
	if (
		dpr !== 1 &&
		!canvas.style.width &&
		!canvas.style.height &&
		Math.abs(w - canvas.width) < 1 &&
		Math.abs(h - canvas.height) < 1
	) {
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
	}
	// Floored at 1 px: a sub-1 dpr on a tiny box must not round to a 0-size (blank) canvas.
	canvas.width = Math.max(1, Math.round(w * dpr));
	canvas.height = Math.max(1, Math.round(h * dpr));
}
