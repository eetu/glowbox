import type { NixieTube as NixieTubeHandle } from '@glowbox/nixie';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';

import { NixieTube } from '../NixieTube';

const nextFrame = () =>
	new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// Count pixels noticeably brighter than the dark tube glass (the 2D-canvas core).
const litPixels = (canvas: HTMLCanvasElement): number => {
	const ctx = canvas.getContext('2d')!;
	const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 120) n++;
	return n;
};

test('mounts a canvas, lights the numeral, and exposes the tube handle', async () => {
	const wrapper = mount(NixieTube, {
		attachTo: document.body,
		props: { value: 8, tubeStyle: 'classic' as const, mesh: false, ghost: false }
	});
	const canvas = wrapper.element as HTMLCanvasElement;
	expect(canvas.tagName).toBe('CANVAS');
	await nextFrame();
	const tube = (wrapper.vm as unknown as { tube: NixieTubeHandle | null }).tube;
	expect(tube).not.toBeNull();
	// Give the tube a concrete box and redraw at that size, then assert it lit up.
	canvas.style.width = '84px';
	canvas.style.height = '150px';
	tube!.resize();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	expect(tube!.snapshot().startsWith('data:image/png')).toBe(true);
	wrapper.unmount();
});
