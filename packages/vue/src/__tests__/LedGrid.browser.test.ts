import type { LedDisplay } from '@glowbox/core';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';

import { LedGrid } from '../LedGrid';

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
	const wrapper = mount(LedGrid, {
		attachTo: document.body,
		props: {
			size: [5, 5, 5] as [number, number, number],
			camera: { autoOrbit: false },
			interaction: { drag: false },
			color: { background: '#000' },
			draw: (d: LedDisplay) => {
				d.clear();
				d.sphere([2, 2, 2], 2, '#ff8800', true);
			}
		}
	});
	const canvas = wrapper.element as HTMLCanvasElement;
	expect(canvas.tagName).toBe('CANVAS');
	await nextFrame();
	expect(canvas.getContext('webgl')).not.toBeNull();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	wrapper.unmount();
});

test('exposes the imperative display handle', async () => {
	const wrapper = mount(LedGrid, {
		attachTo: document.body,
		props: { size: [4, 4, 4] as [number, number, number], camera: { autoOrbit: false } }
	});
	await nextFrame();
	const display = (wrapper.vm as unknown as { display: LedDisplay | null }).display;
	expect(display).not.toBeNull();
	expect(display?.snapshot().startsWith('data:image/png')).toBe(true);
	wrapper.unmount();
});
