import type { LedDisplay } from '@glowbox/core';
import { createRef } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

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
	const { container } = render(
		<LedGrid
			size={[5, 5, 5]}
			camera={{ autoOrbit: false }}
			interaction={{ drag: false }}
			color={{ background: '#000' }}
			draw={(d: LedDisplay) => {
				d.clear();
				d.sphere([2, 2, 2], 2, '#ff8800', true);
			}}
		/>
	);
	const canvas = container.querySelector('canvas')!;
	expect(canvas).not.toBeNull();
	await nextFrame();
	expect(canvas.getContext('webgl')).not.toBeNull();
	expect(litPixels(canvas)).toBeGreaterThan(0);
});

test('forwards a ref to the imperative display handle', async () => {
	const ref = createRef<LedDisplay | null>();
	render(<LedGrid ref={ref} size={[4, 4, 4]} camera={{ autoOrbit: false }} />);
	await nextFrame();
	expect(ref.current).not.toBeNull();
	expect(ref.current?.snapshot().startsWith('data:image/png')).toBe(true);
});
