import type { NixieTube } from '@glowbox/nixie';
import { tick } from 'svelte';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import NixieTubeComp from '../lib/NixieTube.svelte';

// Count pixels noticeably brighter than the dark tube glass (the 2D-canvas core).
const litPixels = (canvas: HTMLCanvasElement): number => {
	const ctx = canvas.getContext('2d')!;
	const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 120) n++;
	return n;
};

test('mounts a canvas, lights the numeral, and exposes the tube handle', async () => {
	let tube: NixieTube | null = null;
	const screen = render(NixieTubeComp, {
		value: 8,
		tubeStyle: 'classic',
		mesh: false,
		ghost: false,
		oncreate: (t: NixieTube | null) => (tube = t)
	});
	await tick();
	const canvas = screen.container.querySelector('canvas')!;
	expect(canvas).not.toBeNull();
	expect(tube).not.toBeNull();
	// Give the tube a concrete box and redraw at that size, then assert it lit up.
	canvas.style.width = '84px';
	canvas.style.height = '150px';
	tube!.resize();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	expect(tube!.snapshot().startsWith('data:image/png')).toBe(true);
});

test('the value prop drives setValue live (blank → lit)', async () => {
	let tube: NixieTube | null = null;
	const screen = render(NixieTubeComp, {
		value: null,
		mesh: false,
		ghost: false,
		oncreate: (t: NixieTube | null) => (tube = t)
	});
	await tick();
	const canvas = screen.container.querySelector('canvas')!;
	canvas.style.width = '84px';
	canvas.style.height = '150px';
	tube!.resize();
	const blank = litPixels(canvas);

	await screen.rerender({ value: 8, mesh: false, ghost: false });
	await tick();
	tube!.resize();
	expect(litPixels(canvas)).toBeGreaterThan(blank);
});
