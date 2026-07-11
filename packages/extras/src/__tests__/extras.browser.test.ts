import { createLedDisplay, type LedDisplay } from '@glowbox/core';
import { expect, test } from 'vitest';

import { makeImagePlayer } from '../image';
import { paintImage } from '../plane';
import type { ImageSource } from '../sample';
import { text } from '../text';

const makeCanvas = () => {
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 128;
	return canvas;
};

const paused = (canvas: HTMLCanvasElement, size: [number, number, number] = [8, 8, 8]) =>
	createLedDisplay(canvas, {
		size,
		color: { background: '#000' },
		camera: { autoOrbit: false },
		quality: { paused: true }
	});

const litPixels = (canvas: HTMLCanvasElement): number => {
	const gl = canvas.getContext('webgl')!;
	const px = new Uint8Array(canvas.width * canvas.height * 4);
	gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) n++;
	return n;
};

const whiteImage = (w: number, h: number): ImageSource => ({
	data: new Uint8ClampedArray(w * h * 4).fill(255),
	width: w,
	height: h
});

test('paintImage plots an image plane that renders as lit pixels', () => {
	const canvas = makeCanvas();
	const d = paused(canvas);
	if (!d) return;
	d.clear();
	paintImage(d, whiteImage(8, 8), { plane: 'xy', fit: 'stretch' });
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('text() lights voxels on the grid plane', () => {
	const canvas = makeCanvas();
	const d = paused(canvas, [16, 16, 16]);
	if (!d) return;
	d.clear();
	text(d, 'A', { color: '#ffffff' });
	d.render();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});

test('makeImagePlayer loads an image and paints it after a few frames', async () => {
	const canvas = makeCanvas();
	const d = paused(canvas);
	if (!d) return;
	// A guaranteed-valid red PNG built from a canvas (no hand-rolled base64).
	const src = document.createElement('canvas');
	src.width = src.height = 4;
	const sctx = src.getContext('2d')!;
	sctx.fillStyle = '#ff0000';
	sctx.fillRect(0, 0, 4, 4);
	const url = src.toDataURL('image/png');
	const play: (d: LedDisplay, dt: number) => void = makeImagePlayer(url, { fit: 'cover' });
	// Poll until the async decode lands (or give up).
	for (let i = 0; i < 60; i++) {
		play(d, 0.016);
		d.render();
		if (litPixels(canvas) > 0) break;
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
	}
	expect(litPixels(canvas)).toBeGreaterThan(0);
	d.dispose();
});
