// Shared plumbing for painting a 2D image onto a plane of the 3D grid: pick which
// two axes the image's (u, v) map to, at a fixed depth on the third.
import type { VoxelGrid } from '@glowbox/led-grid';

import { type Fit, type GridSample, type ImageSource, sampleImageToGrid } from './sample';

/** Which grid plane the image lands on. `xy` (default) faces the default camera. */
export type Plane = 'xy' | 'xz' | 'yz';

export interface PaintOptions {
	/** Grid plane the image maps onto (default `'xy'`). */
	plane?: Plane;
	/** Index on the plane's normal axis (default: the middle slice). */
	depth?: number;
	/** Aspect fit (default `'contain'`). */
	fit?: Fit;
	/** Skip cells with coverage below this (default 0.5). */
	threshold?: number;
	/** Multiply every painted colour (default 1; >1 blooms in the hologram style). */
	gain?: number;
}

interface Axes {
	dimU: number;
	dimV: number;
	dimW: number;
	at(u: number, v: number, w: number): [number, number, number];
}

function planeAxes(g: Pick<VoxelGrid, 'nx' | 'ny' | 'nz'>, plane: Plane): Axes {
	switch (plane) {
		case 'xz':
			return { dimU: g.nx, dimV: g.nz, dimW: g.ny, at: (u, v, w) => [u, w, v] };
		case 'yz':
			return { dimU: g.ny, dimV: g.nz, dimW: g.nx, at: (u, v, w) => [w, u, v] };
		default: // 'xy'
			return { dimU: g.nx, dimV: g.ny, dimW: g.nz, at: (u, v, w) => [u, v, w] };
	}
}

// A player repaints the SAME decoded source every frame (a still image always; a GIF
// whenever a frame comes round again), but the sampling only changes when the target
// dims or fit change (a grid resize). Cache the latest sample per source — weakly, so
// decoded frames stay collectable — treating `ImageSource` data as immutable.
const sampleCache = new WeakMap<ImageSource, { key: string; sample: GridSample }>();
function sampledFor(src: ImageSource, dimU: number, dimV: number, fit: Fit): GridSample {
	const key = `${dimU}x${dimV}:${fit}`;
	const hit = sampleCache.get(src);
	if (hit && hit.key === key) return hit.sample;
	const sample = sampleImageToGrid(src, dimU, dimV, fit);
	sampleCache.set(src, { key, sample });
	return sample;
}

/** Sample `src` to the plane's dims and plot it onto `g` (does not clear). */
export function paintImage(g: VoxelGrid, src: ImageSource, opts: PaintOptions = {}): void {
	const plane = opts.plane ?? 'xy';
	const threshold = opts.threshold ?? 0.5;
	const gain = opts.gain ?? 1;
	const { dimU, dimV, dimW, at } = planeAxes(g, plane);
	const depth = opts.depth ?? dimW >> 1;
	const { rgb, alpha } = sampledFor(src, dimU, dimV, opts.fit ?? 'contain');
	for (let v = 0; v < dimV; v++)
		for (let u = 0; u < dimU; u++) {
			const i = v * dimU + u;
			if (alpha[i] < threshold) continue;
			const [x, y, z] = at(u, v, depth);
			g.plot(x, y, z, [rgb[i * 3] * gain, rgb[i * 3 + 1] * gain, rgb[i * 3 + 2] * gain]);
		}
}
