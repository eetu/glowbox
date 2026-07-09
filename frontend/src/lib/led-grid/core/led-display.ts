// Plain-JS core of @scene/led-grid: a 3D LED-grid *display* you can embed in any
// SPA (framework wrappers live alongside). Give it a canvas + a size and it owns
// everything — WebGL rendering, orbit (auto + drag), resize, and the animation
// loop. You just draw voxels each frame through a small canvas-like API:
//
//   const d = createLedDisplay(canvas, { size: [8, 8, 8] });
//   d.onFrame((d, dt) => { d.clear(); d.sphere([4, 4, 4], 3, [0, 0.6, 1]); });
//
// The display holds NO game/viz logic — that's the client's (a torus, a game, a
// music viz). Colours are [r,g,b] with 0..1 the nominal range; values >1 bloom
// under the additive glow.
import { createRenderer } from './renderer';

export type RGB = [number, number, number];
export type Vec3 = [number, number, number];

export type LedDisplayOptions = {
	/** Grid size [nx, ny, nz]. */
	size: [number, number, number];
	/** Slowly spin the view (default true). Paused while dragging. */
	autoOrbit?: boolean;
	/** Pointer-drag to orbit (default true). */
	drag?: boolean;
	/** Overall brightness multiplier (default 1). */
	gain?: number;
	/** WebGL clear colour behind the LEDs (default near-black). */
	background?: RGB;
	/** Camera distance / vertical FOV (defaults frame a unit cube). */
	dist?: number;
	fov?: number;
};

/** A live LED-grid display. Draw voxels via the canvas-like methods, then let
 *  the built-in loop (onFrame) render, or call render() yourself. */
export interface LedDisplay {
	readonly nx: number;
	readonly ny: number;
	readonly nz: number;
	/** Raw LED buffer (nx*ny*nz*3 RGB) for power users; write directly if you like. */
	readonly leds: Float32Array;
	index(x: number, y: number, z: number): number;
	inBounds(x: number, y: number, z: number): boolean;

	// --- canvas-like voxel drawing (integer coords; out-of-range is ignored) ---
	plot(x: number, y: number, z: number, color: RGB): void;
	add(x: number, y: number, z: number, color: RGB): void;
	get(x: number, y: number, z: number): RGB;
	/** Clear the whole grid (default black). */
	clear(color?: RGB): void;
	/** Fill every LED with a colour (alias of clear(color)). */
	fill(color: RGB): void;
	line(a: Vec3, b: Vec3, color: RGB): void;
	/** Axis-aligned box between two corners; `filled` fills it, else wireframe edges. */
	box(min: Vec3, max: Vec3, color: RGB, filled?: boolean): void;
	/** `filled` fills the ball, else a ~1-voxel-thick shell. */
	sphere(center: Vec3, radius: number, color: RGB, filled?: boolean): void;

	// --- loop / lifecycle ---
	/** Run `cb(display, dt)` every animation frame (auto-pauses when hidden).
	 *  Returns a stop() that clears the callback. */
	onFrame(cb: (d: LedDisplay, dt: number) => void): () => void;
	/** Draw the current LED buffer once (also called each frame by the loop). */
	render(): void;
	/** Set the brightness multiplier. */
	setGain(gain: number): void;
	dispose(): void;
}

export function createLedDisplay(
	canvas: HTMLCanvasElement,
	opts: LedDisplayOptions
): LedDisplay | null {
	const [nx, ny, nz] = opts.size;
	const bg = opts.background ?? [0.01, 0.01, 0.02];
	const maybe = createRenderer(canvas, nx, ny, nz, bg);
	if (!maybe) return null;
	const renderer = maybe; // non-null past the guard (closure-safe)
	const leds = renderer.leds;

	const idx = (x: number, y: number, z: number) => ((x | 0) + nx * ((y | 0) + ny * (z | 0))) * 3;
	const inBounds = (x: number, y: number, z: number) => {
		x |= 0;
		y |= 0;
		z |= 0;
		return x >= 0 && x < nx && y >= 0 && y < ny && z >= 0 && z < nz;
	};

	function plot(x: number, y: number, z: number, c: RGB) {
		if (!inBounds(x, y, z)) return;
		const i = idx(x, y, z);
		leds[i] = c[0];
		leds[i + 1] = c[1];
		leds[i + 2] = c[2];
	}
	function add(x: number, y: number, z: number, c: RGB) {
		if (!inBounds(x, y, z)) return;
		const i = idx(x, y, z);
		leds[i] += c[0];
		leds[i + 1] += c[1];
		leds[i + 2] += c[2];
	}
	function get(x: number, y: number, z: number): RGB {
		if (!inBounds(x, y, z)) return [0, 0, 0];
		const i = idx(x, y, z);
		return [leds[i], leds[i + 1], leds[i + 2]];
	}
	function clear(c: RGB = [0, 0, 0]) {
		for (let i = 0; i < leds.length; i += 3) {
			leds[i] = c[0];
			leds[i + 1] = c[1];
			leds[i + 2] = c[2];
		}
	}
	function line(a: Vec3, b: Vec3, c: RGB) {
		// 3D Bresenham: step the driving (longest) axis, accumulate error on the
		// other two → a contiguous voxel line, no gaps.
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
		if (dm === 0) return plot(x0, y0, z0, c);
		let ex = dm / 2,
			ey = dm / 2,
			ez = dm / 2;
		for (let s = 0; s <= dm; s++) {
			plot(x0, y0, z0, c);
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
	function box(min: Vec3, max: Vec3, c: RGB, filled = false) {
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
		for (let z = z0; z <= z1; z++)
			for (let y = y0; y <= y1; y++)
				for (let x = x0; x <= x1; x++) {
					if (filled) {
						plot(x, y, z, c);
					} else {
						// wireframe: on a face-boundary in ≥2 axes = an edge
						let edges = 0;
						if (x === x0 || x === x1) edges++;
						if (y === y0 || y === y1) edges++;
						if (z === z0 || z === z1) edges++;
						if (edges >= 2) plot(x, y, z, c);
					}
				}
	}
	function sphere(center: Vec3, radius: number, c: RGB, filled = false) {
		const r2 = radius * radius;
		const x0 = Math.floor(center[0] - radius),
			x1 = Math.ceil(center[0] + radius);
		const y0 = Math.floor(center[1] - radius),
			y1 = Math.ceil(center[1] + radius);
		const z0 = Math.floor(center[2] - radius),
			z1 = Math.ceil(center[2] + radius);
		for (let z = z0; z <= z1; z++)
			for (let y = y0; y <= y1; y++)
				for (let x = x0; x <= x1; x++) {
					const d2 = (x - center[0]) ** 2 + (y - center[1]) ** 2 + (z - center[2]) ** 2;
					if (filled ? d2 <= r2 : Math.abs(Math.sqrt(d2) - radius) <= 0.5) plot(x, y, z, c);
				}
	}

	// --- view / orbit ---
	let yaw = 0.6;
	let pitch = 0.4;
	const dist = opts.dist ?? 3.6;
	const fov = opts.fov ?? 0.9;
	let gain = opts.gain ?? 1;
	const autoOrbit = opts.autoOrbit ?? true;
	let dragging = false;
	let lastX = 0;
	let lastY = 0;
	const down = (e: PointerEvent) => {
		if (opts.drag === false) return;
		dragging = true;
		lastX = e.clientX;
		lastY = e.clientY;
		canvas.setPointerCapture?.(e.pointerId);
	};
	const move = (e: PointerEvent) => {
		if (!dragging) return;
		yaw += (e.clientX - lastX) * 0.01;
		pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - lastY) * 0.01));
		lastX = e.clientX;
		lastY = e.clientY;
	};
	const up = () => (dragging = false);
	canvas.addEventListener('pointerdown', down);
	canvas.addEventListener('pointermove', move);
	canvas.addEventListener('pointerup', up);
	canvas.addEventListener('pointercancel', up);

	// --- resize ---
	const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
	const ro = new ResizeObserver(() => {
		const r = canvas.getBoundingClientRect();
		canvas.width = Math.max(1, Math.round(r.width * dpr));
		canvas.height = Math.max(1, Math.round(r.height * dpr));
	});
	ro.observe(canvas);

	function render() {
		renderer.render({ yaw, pitch, dist, fov, gain });
	}

	// --- loop (runs from creation so the lattice + orbit are alive immediately) ---
	let frameCb: ((d: LedDisplay, dt: number) => void) | null = null;
	let raf = 0;
	let last = 0;
	const loop = (now: number) => {
		raf = requestAnimationFrame(loop);
		if (typeof document !== 'undefined' && document.hidden) return;
		const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
		last = now;
		if (autoOrbit && !dragging) yaw += dt * 0.45;
		frameCb?.(display, dt);
		render();
	};
	raf = requestAnimationFrame(loop);

	const display: LedDisplay = {
		nx,
		ny,
		nz,
		leds,
		index: idx,
		inBounds,
		plot,
		add,
		get,
		clear,
		fill: (c) => clear(c),
		line,
		box,
		sphere,
		onFrame(cb) {
			frameCb = cb;
			return () => {
				if (frameCb === cb) frameCb = null;
			};
		},
		render,
		setGain(g) {
			gain = g;
		},
		dispose() {
			cancelAnimationFrame(raf);
			ro.disconnect();
			canvas.removeEventListener('pointerdown', down);
			canvas.removeEventListener('pointermove', move);
			canvas.removeEventListener('pointerup', up);
			canvas.removeEventListener('pointercancel', up);
			renderer.dispose();
		}
	};
	return display;
}
