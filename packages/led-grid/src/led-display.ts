// Plain-JS core of @glowbox/led-grid: a 3D LED-grid *display* you can embed in any
// SPA (framework wrappers live in sibling packages). Give it a canvas + a size
// and it owns everything — WebGL rendering, orbit (auto + drag), zoom, resize and
// the animation loop. You draw voxels each frame through the canvas-like API
// (see voxel-grid.ts):
//
//   const d = createLedDisplay(canvas, { size: [8, 8, 8] });
//   d.onFrame((d, dt) => { d.clear(); d.sphere([4, 4, 4], 3, [0, 0.6, 1]); });
//
// Colours (background, offColor, tint, and every draw call) are a `Color`: an
// [r,g,b] triple 0..1 (values >1 bloom) or a CSS string. Appearance, camera and
// interaction are grouped options, all live-updatable via setOptions().
import { parseColor, parseColor01 } from './color';
import {
	createRenderer,
	type LedShape,
	type LedStyle,
	type Projection,
	type RendererParams,
	type RgbLayout
} from './renderer';
import { type Color, createVoxelGrid, type VoxelGrid } from './voxel-grid';

export type { LedShape, LedStyle, Projection, RgbLayout } from './renderer';
export type { Color, RGB, Vec3, VoxelGrid } from './voxel-grid';

/** LED appearance. */
export interface LedOptions {
	/** Visual look: 'hologram' (emissive glow, default) or 'comic' (cel-shaded + ink outline). */
	style?: LedStyle;
	/** Sprite shape: 'round' (default) or 'square' (tiles gap-free). */
	shape?: LedShape;
	/** Comic ink-border thickness, 0..1 of the sprite radius (default 0.25; 0 = no border). */
	outline?: number;
	/** Comic ink-border colour (default near-black). */
	outlineColor?: Color;
	/** Brick lattice: offset every other row by half a cell (default false). Also
	 *  breaks up the regular grid, reducing view-dependent moiré. */
	stagger?: boolean;
	/** Render each LED as three R/G/B sub-emitters — a real RGB-LED package look
	 *  (default false). Up close you see the R/G/B dies; they blend at a distance. */
	rgb?: boolean;
	/** Sub-die packing when `rgb` is on (default 'auto'): a delta `triad` for round
	 *  LEDs, an RGGB `quad` for square, or the classic R\|G\|B `stripe`. */
	rgbLayout?: RgbLayout;
	/** Comic brightness (default false): `false` = cel-shade — keep each LED's
	 *  brightness (posterized), so tonal content reads; `true` = flat **vivid**
	 *  pop-art — every lit LED at the full value of its hue. Comic style only. */
	vivid?: boolean;
	/** Sprite size relative to LED spacing (default 0.6). */
	size?: number;
	/** Glow tightness — the falloff exponent; higher = tighter (default 2.2). Hologram only. */
	glow?: number;
	/** Colour of the tiny speck shown at an *unlit* LED node. Default black (no
	 *  lattice — only lit LEDs show). Set e.g. `[0.03,0.03,0.03]` to hint the grid. Hologram only. */
	offColor?: Color;
	/** Size of the tiny "physical LED" speck shown when off, 0..1 of the glow sprite
	 *  (default 0.35). A real off LED is a small dark dot, not a full-size disc. Hologram only. */
	offSize?: number;
}

/** Global colour / brightness. */
export interface ColorOptions {
	/** Clear colour behind the LEDs (default near-black [0.01,0.01,0.02]). */
	background?: Color;
	/** Overall brightness multiplier (default 1). */
	gain?: number;
	/** Multiplies every lit colour — handy for theming (default white [1,1,1]). */
	tint?: Color;
}

/** Camera & projection. */
export interface CameraOptions {
	/** Initial orbit angles (radians; default yaw 0.6, pitch 0.4). */
	yaw?: number;
	pitch?: number;
	/** Camera distance (default 3.6); also the zoom target. */
	distance?: number;
	/** Vertical field of view in radians (default 0.9). */
	fov?: number;
	projection?: Projection; // 'perspective' (default) | 'orthographic'
	/** Slow auto-spin, paused while interacting (default true). */
	autoOrbit?: boolean;
	/** Auto-spin speed in rad/s (default 0.45). */
	orbitSpeed?: number;
	/** Clamp for drag pitch (default [-1.4, 1.4]). */
	pitchLimits?: [number, number];
}

/** Pointer interaction. */
export interface InteractionOptions {
	/** Pointer-drag to orbit (default true). */
	drag?: boolean;
	/** Drag sensitivity in radians per pixel (default 0.01). */
	dragSpeed?: number;
	/** Wheel + pinch to zoom (default false). */
	zoom?: boolean;
	/** Min/max camera distance for zoom (default [1.5, 10]). */
	zoomLimits?: [number, number];
}

/** Rendering quality / lifecycle. */
export interface QualityOptions {
	/** Cap on devicePixelRatio (default 2). */
	pixelRatio?: number;
	/** MSAA — fixed at creation, ignored by setOptions (default true). */
	antialias?: boolean;
	/** Freeze the render loop; interaction + render()/snapshot() still repaint (default false). */
	paused?: boolean;
	/** Cap the render loop to at most this many frames/sec (default: uncapped, i.e.
	 *  the display's refresh rate). A power/cadence knob — good for an always-on
	 *  ambient display (lower = less GPU/battery) or matching a hardware LED-cube's
	 *  refresh rate. Not a speed-up: each frame still costs the same. */
	fps?: number;
}

export interface LedDisplayOptions {
	/** Grid size [nx, ny, nz]. */
	size: [number, number, number];
	led?: LedOptions;
	color?: ColorOptions;
	camera?: CameraOptions;
	interaction?: InteractionOptions;
	quality?: QualityOptions;
	/** Accessible name for the canvas — a WebGL canvas is a black box to assistive
	 *  tech, so the display sets `role="img"` + `aria-label` (default 'LED grid'). */
	label?: string;
}

/** Everything except `size` — live-updatable. */
export type LedDisplayPatch = Omit<LedDisplayOptions, 'size'>;

/** Rolling per-frame performance stats (EMA-smoothed). `drawMs`/`renderMs` are
 *  CPU time in the frame callback vs issuing the GL commands; `frameMs`/`fps` are
 *  the true end-to-end rate. If fps is low but drawMs+renderMs are small, you're
 *  GPU/vsync-bound (CPU timers don't capture GPU execution). */
export type DisplayStats = { fps: number; frameMs: number; drawMs: number; renderMs: number };

/** A live LED-grid display: the voxel-drawing API (VoxelGrid) plus the loop,
 *  camera control and lifecycle. */
export interface LedDisplay extends VoxelGrid {
	/** Live, EMA-smoothed frame timings (updated while the loop runs). */
	readonly stats: DisplayStats;
	/** Run `cb(display, dt)` every animation frame (auto-pauses when hidden, and
	 *  does not fire while `paused` — drive updates yourself with `render()` then).
	 *  Single subscriber: a later call replaces the current callback (compose in your
	 *  own cb to layer programs). Returns a stop() that clears the callback. */
	onFrame(cb: (d: LedDisplay, dt: number) => void): () => void;
	/** Draw the current LED buffer once (also called each frame by the loop). */
	render(): void;
	/** Set the brightness multiplier (shortcut for setOptions({ color: { gain } })). */
	setGain(gain: number): void;
	/** Freeze/unfreeze the loop (render-on-demand when frozen). */
	setPaused(paused: boolean): void;
	/** Live-update any option except `size`. */
	setOptions(patch: LedDisplayPatch): void;
	/** Imperatively move the camera. */
	setCamera(c: { yaw?: number; pitch?: number; distance?: number }): void;
	/** Recompute the drawing-buffer size from the canvas box + pixelRatio, then render.
	 *  Pass a `[nx, ny, nz]` to also change the grid size in place — reallocating the
	 *  buffer on the *same* canvas (no context loss), preserving camera + options. */
	resize(size?: [number, number, number]): void;
	/** Render once and return a PNG data URL (for previews / frame export). */
	snapshot(): string;
	dispose(): void;
}

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);

// Upper bound on the LED count (nx·ny·nz). Past this — or for a non-finite / < 1 count —
// createLedDisplay returns null and resize() is a no-op, rather than throwing on a failed
// TypedArray allocation. ~4M (≈158³) keeps the frame buffer + GPU packing to sane memory.
const MAX_LEDS = 4_000_000;
const withinCap = (x: number, y: number, z: number): boolean => {
	const n = x * y * z;
	return Number.isFinite(n) && n >= 1 && n <= MAX_LEDS;
};

export function createLedDisplay(
	canvas: HTMLCanvasElement,
	opts: LedDisplayOptions
): LedDisplay | null {
	let [nx, ny, nz] = opts.size; // mutable: resize() can change the grid in place
	if (!withinCap(nx, ny, nz)) return null;
	const led = opts.led ?? {};
	const col = opts.color ?? {};
	const cam = opts.camera ?? {};
	const it = opts.interaction ?? {};
	const q = opts.quality ?? {};

	const rendererParams: RendererParams = {
		background: parseColor01(col.background ?? [0.01, 0.01, 0.02]),
		offColor: parseColor01(led.offColor ?? [0, 0, 0]),
		tint: parseColor(col.tint ?? [1, 1, 1]),
		glow: led.glow ?? 2.2,
		ledSize: led.size ?? 0.6,
		offSize: led.offSize ?? 0.35,
		style: led.style ?? 'hologram',
		shape: led.shape ?? 'round',
		outline: led.outline ?? 0.25,
		outlineColor: parseColor01(led.outlineColor ?? [0.02, 0.02, 0.02]),
		stagger: led.stagger ?? false,
		rgb: led.rgb ?? false,
		rgbLayout: led.rgbLayout ?? 'auto',
		vivid: led.vivid ?? false,
		antialias: q.antialias ?? true
	};

	// The frame buffer is owned by the *display* (not the renderer) so it survives a
	// context rebuild (context-loss restore) and can be reallocated on resize().
	let leds = new Float32Array(nx * ny * nz * 3);
	const maybe = createRenderer(canvas, nx, ny, nz, rendererParams, leds);
	if (!maybe) return null;
	let renderer = maybe; // rebuilt on resize()/context-restore; closures read this let

	// Draw straight into the shared LED buffer: the grid writes, render() uploads.
	let grid = createVoxelGrid(nx, ny, nz, leds);

	// --- mutable view / interaction / lifecycle state ---
	let yaw = cam.yaw ?? 0.6;
	let pitch = cam.pitch ?? 0.4;
	let distance = cam.distance ?? 3.6;
	let fov = cam.fov ?? 0.9;
	let projection: Projection = cam.projection ?? 'perspective';
	let autoOrbit = cam.autoOrbit ?? true;
	let orbitSpeed = cam.orbitSpeed ?? 0.45;
	let pitchLimits: [number, number] = cam.pitchLimits ?? [-1.4, 1.4];
	let gain = col.gain ?? 1;

	let drag = it.drag ?? true;
	let dragSpeed = it.dragSpeed ?? 0.01;
	let zoom = it.zoom ?? false;
	let zoomLimits: [number, number] = it.zoomLimits ?? [1.5, 10];

	let pixelRatio = q.pixelRatio ?? 2;
	let paused = q.paused ?? false;
	let fpsCap = q.fps ?? 0; // 0 = uncapped (render every animation frame)

	let label = opts.label || 'LED grid';
	// A WebGL canvas is a black box to assistive tech — name it.
	const applyAria = () => {
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-label', label);
	};
	applyAria();

	// --- pointer interaction (drag = orbit, two-finger = pinch-zoom) ---
	const pointers = new Map<number, { x: number; y: number }>();
	let pinchDist = 0;
	const twoPointerDist = () => {
		const [a, b] = [...pointers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	};
	const down = (e: PointerEvent) => {
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		canvas.setPointerCapture?.(e.pointerId);
		if (pointers.size === 2) pinchDist = twoPointerDist();
	};
	const move = (e: PointerEvent) => {
		const p = pointers.get(e.pointerId);
		if (!p) return;
		const dx = e.clientX - p.x;
		const dy = e.clientY - p.y;
		p.x = e.clientX;
		p.y = e.clientY;
		if (pointers.size === 1 && drag) {
			yaw += dx * dragSpeed;
			pitch = clamp(pitch + dy * dragSpeed, pitchLimits[0], pitchLimits[1]);
			requestRender();
		} else if (pointers.size === 2 && zoom) {
			const d = twoPointerDist();
			if (pinchDist > 0 && d > 0) {
				distance = clamp((distance * pinchDist) / d, zoomLimits[0], zoomLimits[1]);
				requestRender();
			}
			pinchDist = d;
		}
	};
	const upCancel = (e: PointerEvent) => {
		pointers.delete(e.pointerId);
		pinchDist = 0;
	};
	const wheel = (e: WheelEvent) => {
		if (!zoom) return;
		e.preventDefault();
		distance = clamp(distance * Math.exp(e.deltaY * 0.001), zoomLimits[0], zoomLimits[1]);
		requestRender();
	};
	canvas.addEventListener('pointerdown', down);
	canvas.addEventListener('pointermove', move);
	canvas.addEventListener('pointerup', upCancel);
	canvas.addEventListener('pointercancel', upCancel);
	canvas.addEventListener('wheel', wheel, { passive: false });

	// While a touch gesture is claimed (drag orbit / pinch zoom), the browser must not
	// also scroll or pinch the page — without this, touch-orbit fights page scroll on
	// mobile. Tracks the live interaction options; the author's value returns on dispose.
	const prevTouchAction = canvas.style.touchAction;
	const applyTouchAction = () => {
		canvas.style.touchAction = drag || zoom ? 'none' : prevTouchAction;
	};
	applyTouchAction();

	// --- resize (drawing buffer, and optionally the grid dims) ---
	function resize(size?: [number, number, number]) {
		// Change the grid in place: reallocate the buffer + rebuild renderer/grid on
		// the SAME canvas (no context loss), preserving camera + appearance options.
		if (
			size &&
			withinCap(size[0], size[1], size[2]) &&
			(size[0] !== nx || size[1] !== ny || size[2] !== nz)
		) {
			const [mx, my, mz] = size;
			const nextLeds = new Float32Array(mx * my * mz * 3);
			const next = createRenderer(canvas, mx, my, mz, rendererParams, nextLeds);
			if (next) {
				renderer.dispose(); // free the old GL objects (context stays alive)
				renderer = next;
				leds = nextLeds;
				grid = createVoxelGrid(mx, my, mz, leds);
				[nx, ny, nz] = size;
				frameCb?.(display, 0); // repaint content at the new size before showing
			}
		}
		const dpr = Math.min(
			typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
			pixelRatio
		);
		const r = canvas.getBoundingClientRect();
		canvas.width = Math.max(1, Math.round(r.width * dpr));
		canvas.height = Math.max(1, Math.round(r.height * dpr));
		if (paused) render();
	}
	const ro = new ResizeObserver(() => resize());
	ro.observe(canvas);

	// --- WebGL context-loss recovery ---
	// The GPU can drop the context (tab backgrounded, driver reset, too many
	// contexts). Prevent the default (which would make it unrecoverable), pause,
	// and rebuild the renderer on restore — the display-owned `leds` + grid survive,
	// so content and wiring come back intact.
	let contextLost = false;
	const onContextLost = (e: Event) => {
		e.preventDefault();
		contextLost = true;
		stop();
	};
	const onContextRestored = () => {
		const next = createRenderer(canvas, nx, ny, nz, rendererParams, leds);
		if (!next) return; // couldn't rebuild; stay lost (nothing more we can do)
		renderer = next;
		contextLost = false;
		grid.markAll(); // repaint all existing content into the fresh context
		resize(); // re-establish the drawing buffer + offscreen targets
		if (!paused) start();
		else render();
	};
	canvas.addEventListener('webglcontextlost', onContextLost);
	canvas.addEventListener('webglcontextrestored', onContextRestored);

	function render() {
		if (contextLost) return; // nothing to draw into until the context is restored
		renderer.render({ yaw, pitch, dist: distance, fov, gain, projection }, grid.active);
	}
	// When frozen, repaint on demand (interaction / resize); otherwise the loop covers it.
	function requestRender() {
		if (paused) render();
	}

	// --- loop + perf stats ---
	const stats: DisplayStats = { fps: 0, frameMs: 0, drawMs: 0, renderMs: 0 };
	const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : 0);
	const ema = (prev: number, sample: number) =>
		prev === 0 ? sample : prev + (sample - prev) * 0.1;
	let frameCb: ((d: LedDisplay, dt: number) => void) | null = null;
	let raf = 0;
	let lastFrame = 0; // timestamp of the last *executed* frame (0 = none yet)
	const loop = (now: number) => {
		raf = requestAnimationFrame(loop);
		if (typeof document !== 'undefined' && document.hidden) return;
		// fps cap: keep the rAF loop running (so it still pauses when hidden) but only do
		// the frame work at the target cadence. The tolerance is a fraction of the target
		// interval (not a fixed 1ms, which would grow disproportionate at high caps and make
		// a >=1000 cap effectively uncapped) so it absorbs sub-ms vsync jitter at any cap.
		// dt spans executed frames, so orbit/animation speed stays correct at any cap.
		if (fpsCap > 0 && lastFrame) {
			const target = 1000 / fpsCap;
			if (now - lastFrame < target - Math.min(1, target * 0.1)) return;
		}
		const interval = lastFrame ? now - lastFrame : 0;
		const dt = lastFrame ? Math.min(0.05, interval / 1000) : 0;
		lastFrame = now;
		if (autoOrbit && pointers.size === 0) yaw += dt * orbitSpeed;
		const t0 = nowMs();
		frameCb?.(display, dt);
		const t1 = nowMs();
		render();
		const t2 = nowMs();
		stats.drawMs = ema(stats.drawMs, t1 - t0);
		stats.renderMs = ema(stats.renderMs, t2 - t1);
		if (interval > 0) {
			stats.frameMs = ema(stats.frameMs, interval);
			stats.fps = 1000 / stats.frameMs;
		}
	};
	function start() {
		if (!raf) {
			lastFrame = 0;
			raf = requestAnimationFrame(loop);
		}
	}
	function stop() {
		if (raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
	}
	function setPaused(b: boolean) {
		if (b === paused) return;
		paused = b;
		if (paused) {
			stop();
			render();
		} else {
			start();
		}
	}

	function setOptions(patch: LedDisplayPatch) {
		if (patch.led || patch.color) {
			const cfg: Partial<RendererParams> = {
				background:
					patch.color?.background != null ? parseColor01(patch.color.background) : undefined,
				offColor: patch.led?.offColor != null ? parseColor01(patch.led.offColor) : undefined,
				tint: patch.color?.tint != null ? parseColor(patch.color.tint) : undefined,
				glow: patch.led?.glow,
				ledSize: patch.led?.size,
				offSize: patch.led?.offSize,
				style: patch.led?.style,
				shape: patch.led?.shape,
				stagger: patch.led?.stagger,
				rgb: patch.led?.rgb,
				rgbLayout: patch.led?.rgbLayout,
				vivid: patch.led?.vivid,
				outline: patch.led?.outline,
				outlineColor:
					patch.led?.outlineColor != null ? parseColor01(patch.led.outlineColor) : undefined
			};
			renderer.configure(cfg);
			// Keep rendererParams current so a later resize()/context-restore rebuilds
			// the renderer with the LIVE appearance, not the creation-time values.
			Object.assign(
				rendererParams,
				Object.fromEntries(Object.entries(cfg).filter(([, v]) => v !== undefined))
			);
			if (patch.color?.gain != null) gain = patch.color.gain;
		}
		const c = patch.camera;
		if (c) {
			if (c.yaw != null) yaw = c.yaw;
			if (c.pitch != null) pitch = c.pitch;
			if (c.distance != null) distance = c.distance;
			if (c.fov != null) fov = c.fov;
			if (c.projection) projection = c.projection;
			if (c.autoOrbit != null) autoOrbit = c.autoOrbit;
			if (c.orbitSpeed != null) orbitSpeed = c.orbitSpeed;
			if (c.pitchLimits) pitchLimits = c.pitchLimits;
		}
		const i = patch.interaction;
		if (i) {
			if (i.drag != null) drag = i.drag;
			if (i.dragSpeed != null) dragSpeed = i.dragSpeed;
			if (i.zoom != null) zoom = i.zoom;
			if (i.zoomLimits) zoomLimits = i.zoomLimits;
			applyTouchAction();
		}
		if (patch.label !== undefined) {
			label = patch.label || 'LED grid';
			applyAria();
		}
		if (patch.quality?.pixelRatio != null) {
			pixelRatio = patch.quality.pixelRatio;
			resize();
		}
		if (patch.quality?.fps != null) fpsCap = patch.quality.fps;
		if (patch.quality?.paused != null) setPaused(patch.quality.paused);
		requestRender();
	}

	if (!paused) start();
	else render();

	// Delegate the VoxelGrid surface to the *current* grid (resize()/context-restore
	// swap `grid` for a new instance, so we can't spread a captured one).
	const display: LedDisplay = {
		get nx() {
			return grid.nx;
		},
		get ny() {
			return grid.ny;
		},
		get nz() {
			return grid.nz;
		},
		get leds() {
			return grid.leds;
		},
		markAll: () => grid.markAll(),
		index: (x, y, z) => grid.index(x, y, z),
		inBounds: (x, y, z) => grid.inBounds(x, y, z),
		plot: (x, y, z, c) => grid.plot(x, y, z, c),
		add: (x, y, z, c) => grid.add(x, y, z, c),
		get: (x, y, z) => grid.get(x, y, z),
		clear: (c) => grid.clear(c),
		fill: (c) => grid.fill(c),
		line: (a, b, c) => grid.line(a, b, c),
		box: (min, max, c, filled) => grid.box(min, max, c, filled),
		sphere: (center, radius, c, filled) => grid.sphere(center, radius, c, filled),
		stats,
		onFrame(cb) {
			frameCb = cb;
			requestRender();
			return () => {
				if (frameCb === cb) frameCb = null;
			};
		},
		render,
		setGain(g) {
			gain = g;
			requestRender();
		},
		setPaused,
		setOptions,
		setCamera(c) {
			if (c.yaw != null) yaw = c.yaw;
			if (c.pitch != null) pitch = clamp(c.pitch, pitchLimits[0], pitchLimits[1]);
			if (c.distance != null) distance = clamp(c.distance, zoomLimits[0], zoomLimits[1]);
			requestRender();
		},
		resize,
		snapshot() {
			render();
			return canvas.toDataURL('image/png');
		},
		dispose() {
			stop();
			ro.disconnect();
			canvas.style.touchAction = prevTouchAction;
			canvas.removeEventListener('pointerdown', down);
			canvas.removeEventListener('pointermove', move);
			canvas.removeEventListener('pointerup', upCancel);
			canvas.removeEventListener('pointercancel', upCancel);
			canvas.removeEventListener('wheel', wheel);
			canvas.removeEventListener('webglcontextlost', onContextLost);
			canvas.removeEventListener('webglcontextrestored', onContextRestored);
			// Free the GL objects but leave the context intact — forcing `loseContext()`
			// here poisons the canvas for reuse, which breaks re-creating a display on the
			// same element (e.g. React StrictMode's mount → unmount → remount in dev). The
			// context is released normally once the canvas is dropped/GC'd.
			renderer.dispose();
		}
	};
	return display;
}
