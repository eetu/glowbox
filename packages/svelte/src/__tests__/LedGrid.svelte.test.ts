import type { LedDisplay } from '@glowbox/core';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import LedGrid from '../lib/LedGrid.svelte';

// Wait for the display's rAF loop to run the draw callback + render at least once.
const nextFrame = () =>
	new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

const litPixels = (canvas: HTMLCanvasElement): number => {
	const gl = canvas.getContext('webgl')!;
	const px = new Uint8Array(canvas.width * canvas.height * 4);
	gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) n++;
	return n;
};

test('mounts a canvas and renders the draw callback via grouped props', async () => {
	const screen = render(LedGrid, {
		size: [5, 5, 5] as [number, number, number],
		camera: { autoOrbit: false },
		interaction: { drag: false },
		color: { background: '#000' },
		draw: (d: LedDisplay) => {
			d.clear();
			d.sphere([2, 2, 2], 2, '#ff8800', true);
		}
	});

	const canvas = screen.container.querySelector('canvas');
	expect(canvas).not.toBeNull();

	await nextFrame();
	expect(canvas!.getContext('webgl')).not.toBeNull();
	expect(litPixels(canvas!)).toBeGreaterThan(0);
});

test('reacts to option props via setOptions (offColor off → on)', async () => {
	const screen = render(LedGrid, {
		size: [5, 5, 5] as [number, number, number],
		camera: { autoOrbit: false },
		color: { background: '#000' },
		led: { offColor: '#000' } // lattice hidden, nothing drawn → black
	});
	const canvas = screen.container.querySelector('canvas')!;
	await nextFrame();
	expect(litPixels(canvas)).toBe(0);

	await screen.rerender({
		size: [5, 5, 5] as [number, number, number],
		camera: { autoOrbit: false },
		color: { background: '#000' },
		led: { offColor: [0.5, 0.5, 0.5] as [number, number, number] } // bright lattice
	});
	await nextFrame();
	expect(litPixels(canvas)).toBeGreaterThan(0);
});
