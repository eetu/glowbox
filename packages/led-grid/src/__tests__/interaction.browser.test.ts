// Pointer interaction, exercised with synthetic events and observed through the
// framebuffer: the display exposes no camera getters (by design), so "the camera
// moved" is asserted as "the same content renders different pixels". Displays are
// paused, so every repaint is the handlers' own requestRender — deterministic reads.
import { expect, test } from 'vitest';

import { createLedDisplay, type LedDisplayOptions } from '../led-display';

const makeCanvas = () => {
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 128;
	return canvas;
};

const display = (canvas: HTMLCanvasElement, opts: Partial<LedDisplayOptions> = {}) =>
	createLedDisplay(canvas, {
		size: [5, 5, 5],
		camera: { autoOrbit: false },
		color: { background: '#000' },
		quality: { paused: true },
		...opts
	});

// Asymmetric content so any camera move changes the projected image.
const drawContent = (d: NonNullable<ReturnType<typeof display>>) => {
	d.clear();
	d.plot(0, 4, 0, [1, 1, 1]);
	d.plot(4, 0, 4, [0, 1, 0]);
	d.line([0, 0, 0], [4, 4, 4], [1, 0.4, 0]);
	d.render();
};

const frame = (canvas: HTMLCanvasElement): Uint8Array => {
	const gl = canvas.getContext('webgl')!;
	const px = new Uint8Array(canvas.width * canvas.height * 4);
	gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
	return px;
};

const differs = (a: Uint8Array, b: Uint8Array): boolean => {
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
	return false;
};

const pointer = (type: string, id: number, x: number, y: number) =>
	new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true });

test('pointer drag orbits (the view changes)', () => {
	const canvas = makeCanvas();
	const d = display(canvas)!;
	drawContent(d);
	const before = frame(canvas);
	canvas.dispatchEvent(pointer('pointerdown', 1, 40, 40));
	canvas.dispatchEvent(pointer('pointermove', 1, 90, 55));
	canvas.dispatchEvent(pointer('pointerup', 1, 90, 55));
	expect(differs(before, frame(canvas))).toBe(true);
	d.dispose();
});

test('drag: false leaves the view alone', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { interaction: { drag: false } })!;
	drawContent(d);
	const before = frame(canvas);
	canvas.dispatchEvent(pointer('pointerdown', 1, 40, 40));
	canvas.dispatchEvent(pointer('pointermove', 1, 90, 55));
	canvas.dispatchEvent(pointer('pointerup', 1, 90, 55));
	expect(differs(before, frame(canvas))).toBe(false);
	d.dispose();
});

test('wheel zooms when enabled, not when off (the default)', () => {
	const on = makeCanvas();
	const dOn = display(on, { interaction: { zoom: true } })!;
	drawContent(dOn);
	const beforeOn = frame(on);
	on.dispatchEvent(new WheelEvent('wheel', { deltaY: -600, bubbles: true, cancelable: true }));
	expect(differs(beforeOn, frame(on))).toBe(true);
	dOn.dispose();

	const off = makeCanvas();
	const dOff = display(off)!;
	drawContent(dOff);
	const beforeOff = frame(off);
	off.dispatchEvent(new WheelEvent('wheel', { deltaY: -600, bubbles: true, cancelable: true }));
	expect(differs(beforeOff, frame(off))).toBe(false);
	dOff.dispose();
});

test('two-pointer pinch zooms', () => {
	const canvas = makeCanvas();
	const d = display(canvas, { interaction: { zoom: true } })!;
	drawContent(d);
	const before = frame(canvas);
	canvas.dispatchEvent(pointer('pointerdown', 1, 40, 60));
	canvas.dispatchEvent(pointer('pointerdown', 2, 80, 60));
	canvas.dispatchEvent(pointer('pointermove', 2, 140, 60)); // spread → zoom in
	canvas.dispatchEvent(pointer('pointerup', 2, 140, 60));
	canvas.dispatchEvent(pointer('pointerup', 1, 40, 60));
	expect(differs(before, frame(canvas))).toBe(true);
	d.dispose();
});

test('pitch stays clamped under a huge vertical drag (still renders sanely)', () => {
	const canvas = makeCanvas();
	const d = display(canvas)!;
	drawContent(d);
	canvas.dispatchEvent(pointer('pointerdown', 1, 60, 0));
	canvas.dispatchEvent(pointer('pointermove', 1, 60, 100000));
	canvas.dispatchEvent(pointer('pointerup', 1, 60, 100000));
	const px = frame(canvas);
	let lit = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) lit++;
	expect(lit).toBeGreaterThan(0);
	d.dispose();
});
