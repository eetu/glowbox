// The canvas-like voxel API of @glowbox/core, factored out of the WebGL display
// so the geometry is usable — and unit-testable — with no GL context. A grid is
// "a tiny 3D canvas": an nx×ny×nz lattice of RGB LEDs backed by a flat
// Float32Array (x + nx*(y + ny*z), ×3). Colours accept a `Color` (an [r,g,b]
// triple 0..1 — values >1 bloom under the display's additive glow — or any CSS
// colour string); reads return a plain `RGB`. Integer coords; out of range is
// silently ignored.
//
// createLedDisplay composes a grid over the renderer's LED buffer; you can also
// use a grid on its own (e.g. to compute frames headlessly).
import { type Color, parseColor, type RGB, type Vec3 } from './color';

export type { Color, RGB, Vec3 } from './color';

/** The set of *lit* cells since the last clear, so the renderer (and clear) can
 *  work in O(lit) instead of O(volume). `all` = treat every cell as lit (after a
 *  fill, or markAll for raw-buffer writers). `list[0..count]` holds cell indices.
 *  Package-internal (the culling wiring) — not part of the public surface. */
export type ActiveSet = { list: Uint32Array; count: number; all: boolean };

/** A 3D LED lattice you draw voxels onto. Pure state — no rendering. */
export interface VoxelGrid {
	readonly nx: number;
	readonly ny: number;
	readonly nz: number;
	/** Raw LED buffer (nx*ny*nz*3 RGB). You can read it freely; if you *write* it
	 *  directly, call markAll() so culling/clear don't skip your cells. */
	readonly leds: Float32Array;
	/** Force every cell to be treated as lit (for raw-buffer writers). */
	markAll(): void;
	/** Flat buffer offset of (x,y,z) — start of its 3 RGB floats. */
	index(x: number, y: number, z: number): number;
	inBounds(x: number, y: number, z: number): boolean;

	// --- canvas-like voxel drawing (integer coords; out-of-range is ignored) ---
	plot(x: number, y: number, z: number, color: Color): void;
	add(x: number, y: number, z: number, color: Color): void;
	get(x: number, y: number, z: number): RGB;
	/** Clear the whole grid (default black). */
	clear(color?: Color): void;
	/** Fill every LED with a colour (alias of clear(color)). */
	fill(color: Color): void;
	line(a: Vec3, b: Vec3, color: Color): void;
	/** Axis-aligned box between two corners; `filled` fills it, else wireframe edges. */
	box(min: Vec3, max: Vec3, color: Color, filled?: boolean): void;
	/** `filled` fills the ball, else a ~1-voxel-thick shell. */
	sphere(center: Vec3, radius: number, color: Color, filled?: boolean): void;
}

/** A grid plus its internal culling handle — what `createVoxelGrid` actually
 *  returns; the display and renderer consume `active`, but it isn't part of the
 *  public `VoxelGrid` surface. */
export interface VoxelGridInternal extends VoxelGrid {
	/** Lit-cell tracking (used by the display to cull). */
	readonly active: ActiveSet;
}

/** Create a voxel grid. Pass an existing `leds` buffer (e.g. the display's) to
 *  draw straight into it; otherwise a fresh nx*ny*nz*3 Float32Array is allocated. */
export function createVoxelGrid(
	nx: number,
	ny: number,
	nz: number,
	leds: Float32Array = new Float32Array(nx * ny * nz * 3)
): VoxelGridInternal {
	const cap = nx * ny * nz;
	const idx = (x: number, y: number, z: number) => ((x | 0) + nx * ((y | 0) + ny * (z | 0))) * 3;
	const inBounds = (x: number, y: number, z: number) => {
		x |= 0;
		y |= 0;
		z |= 0;
		return x >= 0 && x < nx && y >= 0 && y < ny && z >= 0 && z < nz;
	};

	// Lit-cell tracking. `seen[cell]` stores the epoch a cell was last marked;
	// bumping `epoch` on clear invalidates all marks in O(1) (no array reset).
	const active: ActiveSet = { list: new Uint32Array(cap), count: 0, all: false };
	const seen = new Uint32Array(cap);
	let epoch = 1;
	let filled = false; // buffer has cells set outside the active list (fill/markAll)
	function mark(cell: number) {
		if (seen[cell] !== epoch) {
			seen[cell] = epoch;
			active.list[active.count++] = cell;
		}
	}

	// Internal writers take an already-parsed RGB so geometry helpers parse once.
	function put(x: number, y: number, z: number, c: RGB) {
		if (!inBounds(x, y, z)) return;
		const cell = (x | 0) + nx * ((y | 0) + ny * (z | 0));
		const i = cell * 3;
		leds[i] = c[0];
		leds[i + 1] = c[1];
		leds[i + 2] = c[2];
		mark(cell);
	}

	function plot(x: number, y: number, z: number, color: Color) {
		put(x, y, z, parseColor(color));
	}
	function add(x: number, y: number, z: number, color: Color) {
		if (!inBounds(x, y, z)) return;
		const c = parseColor(color);
		const cell = (x | 0) + nx * ((y | 0) + ny * (z | 0));
		const i = cell * 3;
		leds[i] += c[0];
		leds[i + 1] += c[1];
		leds[i + 2] += c[2];
		mark(cell);
	}
	function get(x: number, y: number, z: number): RGB {
		if (!inBounds(x, y, z)) return [0, 0, 0];
		const i = idx(x, y, z);
		return [leds[i], leds[i + 1], leds[i + 2]];
	}
	function clear(color: Color = [0, 0, 0]) {
		const c = parseColor(color);
		if (c[0] === 0 && c[1] === 0 && c[2] === 0) {
			// Fast clear: zero only the cells lit since the last clear (O(lit)).
			// If the buffer was fully written (fill/markAll) we must zero it all once.
			if (filled) {
				leds.fill(0);
				filled = false;
			} else {
				for (let a = 0; a < active.count; a++) {
					const i = active.list[a] * 3;
					leds[i] = leds[i + 1] = leds[i + 2] = 0;
				}
			}
			active.count = 0;
			active.all = false;
			epoch++;
		} else {
			// Fill every cell with a colour (rare) → whole buffer, marked "all".
			for (let i = 0; i < leds.length; i += 3) {
				leds[i] = c[0];
				leds[i + 1] = c[1];
				leds[i + 2] = c[2];
			}
			active.count = 0;
			active.all = true;
			filled = true;
			epoch++;
		}
	}
	function markAll() {
		active.all = true;
		filled = true;
	}
	function line(a: Vec3, b: Vec3, color: Color) {
		// 3D Bresenham: step the driving (longest) axis, accumulate error on the
		// other two → a contiguous voxel line, no gaps.
		const c = parseColor(color);
		let x0 = a[0] | 0,
			y0 = a[1] | 0,
			z0 = a[2] | 0;
		const x1 = b[0] | 0,
			y1 = b[1] | 0,
			z1 = b[2] | 0;
		const dx = Math.abs(x1 - x0),
			dy = Math.abs(y1 - y0),
			dz = Math.abs(z1 - z0);
		const sx = x0 < x1 ? 1 : -1,
			sy = y0 < y1 ? 1 : -1,
			sz = z0 < z1 ? 1 : -1;
		const dm = Math.max(dx, dy, dz);
		if (dm === 0) return put(x0, y0, z0, c);
		let ex = dm / 2,
			ey = dm / 2,
			ez = dm / 2;
		for (let s = 0; s <= dm; s++) {
			put(x0, y0, z0, c);
			ex -= dx;
			if (ex < 0) {
				ex += dm;
				x0 += sx;
			}
			ey -= dy;
			if (ey < 0) {
				ey += dm;
				y0 += sy;
			}
			ez -= dz;
			if (ez < 0) {
				ez += dm;
				z0 += sz;
			}
		}
	}
	function box(min: Vec3, max: Vec3, color: Color, filled = false) {
		const c = parseColor(color);
		const [x0, y0, z0] = [
			Math.min(min[0], max[0]),
			Math.min(min[1], max[1]),
			Math.min(min[2], max[2])
		];
		const [x1, y1, z1] = [
			Math.max(min[0], max[0]),
			Math.max(min[1], max[1]),
			Math.max(min[2], max[2])
		];
		// Clamp the iteration to the grid — put() bounds-checks per voxel, but an off-grid or
		// very large box would otherwise spin over up to billions of no-op cells (a main-
		// thread hang). Edge tests below keep the *true* bounds, so off-grid faces are omitted.
		const zLo = Math.max(z0, 0);
		const zHi = Math.min(z1, nz - 1);
		const yLo = Math.max(y0, 0);
		const yHi = Math.min(y1, ny - 1);
		const xLo = Math.max(x0, 0);
		const xHi = Math.min(x1, nx - 1);
		for (let z = zLo; z <= zHi; z++)
			for (let y = yLo; y <= yHi; y++)
				for (let x = xLo; x <= xHi; x++) {
					if (filled) {
						put(x, y, z, c);
					} else {
						// wireframe: on a face-boundary in ≥2 axes = an edge
						let edges = 0;
						if (x === x0 || x === x1) edges++;
						if (y === y0 || y === y1) edges++;
						if (z === z0 || z === z1) edges++;
						if (edges >= 2) put(x, y, z, c);
					}
				}
	}
	function sphere(center: Vec3, radius: number, color: Color, filled = false) {
		const c = parseColor(color);
		const r2 = radius * radius;
		// Clamp the bounding box to the grid so a huge radius / off-grid centre can't spin
		// over billions of no-op voxels (put() bounds-checks each, but the loop wouldn't).
		const x0 = Math.max(0, Math.floor(center[0] - radius)),
			x1 = Math.min(nx - 1, Math.ceil(center[0] + radius));
		const y0 = Math.max(0, Math.floor(center[1] - radius)),
			y1 = Math.min(ny - 1, Math.ceil(center[1] + radius));
		const z0 = Math.max(0, Math.floor(center[2] - radius)),
			z1 = Math.min(nz - 1, Math.ceil(center[2] + radius));
		for (let z = z0; z <= z1; z++)
			for (let y = y0; y <= y1; y++)
				for (let x = x0; x <= x1; x++) {
					const d2 = (x - center[0]) ** 2 + (y - center[1]) ** 2 + (z - center[2]) ** 2;
					if (filled ? d2 <= r2 : Math.abs(Math.sqrt(d2) - radius) <= 0.5) put(x, y, z, c);
				}
	}

	return {
		nx,
		ny,
		nz,
		leds,
		active,
		markAll,
		index: idx,
		inBounds,
		plot,
		add,
		get,
		clear,
		fill: (color) => clear(color),
		line,
		box,
		sphere
	};
}
