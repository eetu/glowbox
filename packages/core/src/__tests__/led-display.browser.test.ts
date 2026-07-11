import { expect, test } from 'vitest';

import { createLedDisplay, type LedDisplayOptions } from '../led-display';
import { createRenderer } from '../renderer';

// The WebGL path can only run in a real browser (jsdom has no GL context), so
// this project runs in headless chromium via @vitest/browser-playwright.

const litPixels = (canvas: HTMLCanvasElement): number => {
	const gl = canvas.getContext('webgl');
	if (!gl) return -1;
	const px = new Uint8Array(canvas.width * canvas.height * 4);
	gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) n++;
	return n;
};

// Pixels that differ from a white background — for asserting visibility on light bg.
const nonWhitePixels = (canvas: HTMLCanvasElement): number => {
	const gl = canvas.getContext('webgl')!;
	const px = new Uint8Array(canvas.width * canvas.height * 4);
	gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235) n++;
	return n;
};

const makeCanvas = () => {
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 128;
	return canvas;
};

// Paused so the rAF loop never repaints between our draw and readPixels.
const display = (canvas: HTMLCanvasElement, opts: Partial<LedDisplayOptions> = {}) =>
	createLedDisplay(canvas, {
		size: [5, 5, 5],
		color: { background: '#000' },
		quality: { paused: true },
		...opts
	});

test('createRenderer initialises a live WebGL renderer', () => {
	const canvas = makeCanvas();
	const r = createRenderer(canvas, 4, 4, 4, {
		background: [0, 0, 0],
		offColor: [0, 0, 0],
		tint: [1, 1, 1],
		glow: 2.2,
		ledSize: 0.6,
		offSize: 0.35,
		style: 'hologram',
		shape: 'round',
		outline: 0.25,
		outlineColor: [0.02, 0.02, 0.02],
		stagger: false,
		rgb: false,
		rgbLayout: 'auto',
		vivid: false,
		antialias: true
	});
	expect(r).not.toBeNull();
	expect(r?.leds.length).toBe(4 * 4 * 4 * 3);
	r?.dispose();
});

test('renders drawn voxels as lit pixels (dark background)', () => {
	const canvas = makeCanvas();
	const d = display(canvas);
	expect(d).not.toBeNull();
	if (!d) return;
	d.clear();
	d.sphere([2, 2, 2], 2, [1, 1, 1], true);
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('renders bright LEDs on a white background (reads on any bg)', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { color: { background: '#fff', gain: 2 } });
	if (!d) return;
	d.clear();
	d.sphere([2, 2, 2], 2, [0, 0.4, 1], true);
	d.render();
	expect(nonWhitePixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('comic style renders cel-shaded LEDs (lit only) on a light background', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { color: { background: '#fff' }, led: { style: 'comic' } });
	if (!d) return;
	d.clear();
	d.render();
	expect(nonWhitePixels(canvas)).toBe(0); // nothing lit → clean background, no dark dots
	d.sphere([2, 2, 2], 2, [0, 0.4, 1], true);
	d.render();
	expect(nonWhitePixels(canvas)).toBeGreaterThan(0); // opaque cel-shaded LEDs read on light bg
	d.setOptions({ led: { vivid: true } }); // flat vivid pop-art variant
	d.render();
	expect(nonWhitePixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('unlit LEDs are transparent — no dark dots on a white background', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { color: { background: '#fff' }, led: { offColor: '#000' } });
	if (!d) return;
	d.clear(); // nothing lit
	d.render();
	expect(nonWhitePixels(canvas)).toBe(0); // coverage tracks brightness → off = transparent
	d.dispose();
});

test('offColor black + nothing drawn → a fully black frame on a dark background', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { led: { offColor: '#000' } });
	if (!d) return;
	d.clear();
	d.render();
	expect(litPixels(canvas)).toBe(0);
	d.dispose();
});

test('CSS-string draw colours light pixels', () => {
	const canvas = makeCanvas();
	const d = display(canvas);
	if (!d) return;
	d.clear();
	d.sphere([2, 2, 2], 2, '#ff8800', true);
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('orthographic projection renders', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { camera: { projection: 'orthographic' } });
	if (!d) return;
	d.clear();
	d.sphere([2, 2, 2], 2, [1, 1, 1], true);
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('snapshot() returns a PNG data URL', () => {
	const canvas = makeCanvas();
	const d = display(canvas);
	if (!d) return;
	d.clear();
	d.sphere([2, 2, 2], 2, [1, 1, 1], true);
	const url = d.snapshot();
	expect(url.startsWith('data:image/png')).toBe(true);
	d.dispose();
});

test('resize([nx,ny,nz]) changes the grid in place and keeps rendering', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { size: [4, 4, 4] });
	if (!d) return;
	expect(d.nx).toBe(4);
	d.resize([9, 9, 9]); // reallocate on the same canvas — no context loss
	expect(d.nx).toBe(9);
	expect(d.leds.length).toBe(9 * 9 * 9 * 3);
	d.clear();
	d.sphere([4, 4, 4], 3, [1, 1, 1], true);
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('led.stagger renders and toggles live without error', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { led: { stagger: true } });
	if (!d) return;
	d.clear();
	d.sphere([2, 2, 2], 2, [1, 1, 1], true);
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.setOptions({ led: { stagger: false } }); // recompute positions live
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('recovers from a WebGL context-loss/restore cycle', () => {
	const canvas = makeCanvas();
	const d = display(canvas);
	if (!d) return;
	d.clear();
	d.sphere([2, 2, 2], 2, [1, 1, 1], true);
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	// Simulate the browser's loss → restore wiring; the display rebuilds its renderer.
	canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
	canvas.dispatchEvent(new Event('webglcontextrestored'));
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0); // content survived the rebuild
	d.dispose();
});

test('led.rgb renders sub-pixels and toggles live', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { led: { rgb: true } });
	if (!d) return;
	d.clear();
	d.sphere([2, 2, 2], 2, [1, 1, 1], true);
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	for (const rgbLayout of ['triad', 'quad', 'stripe'] as const) {
		d.setOptions({ led: { rgb: true, rgbLayout } });
		d.render();
		expect(litPixels(canvas)).toBeGreaterThan(0);
	}
	d.setOptions({ led: { rgb: false } }); // back to blended dots, live
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('quality.fps caps the render loop', async () => {
	const canvas = makeCanvas();
	let frames = 0;
	// Not paused → the rAF loop runs; capped at 10fps.
	const d = createLedDisplay(canvas, {
		size: [4, 4, 4],
		camera: { autoOrbit: false },
		quality: { fps: 10 }
	});
	if (!d) return;
	d.onFrame(() => {
		frames++;
	});
	await new Promise((r) => setTimeout(r, 350));
	// ~3–4 frames at 10fps over 350ms — well under an uncapped ~21 (60Hz).
	expect(frames).toBeGreaterThan(0);
	expect(frames).toBeLessThan(10);
	d.dispose();
});

test('setOptions live-updates appearance (offColor on → lattice appears)', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { led: { offColor: '#000' } });
	if (!d) return;
	d.clear();
	d.render();
	expect(litPixels(canvas)).toBe(0);
	d.setOptions({ led: { offColor: [0.5, 0.5, 0.5] } }); // bright unlit specks
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('setOptions changes survive a resize (renderer rebuilt with live appearance)', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { led: { offColor: '#000' } }); // no lattice at creation
	if (!d) return;
	d.setOptions({ led: { offColor: [0.5, 0.5, 0.5] } }); // turn the lattice on, live
	d.clear();
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.resize([9, 9, 9]); // rebuild the renderer — the live offColor must persist
	d.clear();
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0); // still a lattice, not reset to creation's black
	d.dispose();
});

test('rejects a grid over the LED cap (returns null instead of throwing)', () => {
	const canvas = makeCanvas();
	// ~8 billion voxels would throw on the TypedArray allocation; the cap makes it null.
	expect(display(canvas, { size: [2000, 2000, 2000] })).toBeNull();
	// A sane size on the same (untouched) canvas still creates fine.
	const d = display(canvas, { size: [8, 8, 8] });
	expect(d).not.toBeNull();
	d?.dispose();
});

test('a display can be recreated on the same canvas after dispose (StrictMode-safe)', () => {
	const canvas = makeCanvas();
	const d1 = display(canvas);
	if (!d1) return;
	d1.clear();
	d1.sphere([2, 2, 2], 2, '#ff8800', true);
	d1.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d1.dispose(); // must NOT lose the context — that would poison the canvas for reuse
	// React StrictMode mounts → unmounts → remounts on the SAME element; the second
	// display must still acquire a live context and render on it.
	const d2 = display(canvas);
	expect(d2).not.toBeNull();
	d2!.clear();
	d2!.sphere([2, 2, 2], 2, '#00ff88', true);
	d2!.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d2!.dispose();
});
