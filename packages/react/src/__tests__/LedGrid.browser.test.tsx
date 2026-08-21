import type { LedDisplay } from '@glowbox/led-grid';
import { createRef, StrictMode } from 'react';
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
	const { container } = await render(
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
	await render(<LedGrid ref={ref} size={[4, 4, 4]} camera={{ autoOrbit: false }} />);
	await nextFrame();
	expect(ref.current).not.toBeNull();
	expect(ref.current?.snapshot().startsWith('data:image/png')).toBe(true);
});

test('StrictMode double-mount recreates on the same canvas and still paints', async () => {
	// Dev StrictMode runs mount → cleanup → mount: the display is disposed and
	// re-created on the SAME canvas. dispose() deliberately leaves the WebGL context
	// alive (no loseContext) so the second mount can render — lock that in.
	const ref = createRef<LedDisplay | null>();
	const { container } = await render(
		<StrictMode>
			<LedGrid
				ref={ref}
				size={[5, 5, 5]}
				camera={{ autoOrbit: false }}
				color={{ background: '#000' }}
				draw={(d: LedDisplay) => {
					d.clear();
					d.sphere([2, 2, 2], 2, '#00aaff', true);
				}}
			/>
		</StrictMode>
	);
	await nextFrame();
	await nextFrame();
	expect(ref.current).not.toBeNull();
	const canvas = container.querySelector('canvas')!;
	expect(litPixels(canvas)).toBeGreaterThan(0);
});

test('the theme prop updates the live display, not just the created one', async () => {
	// <LedGrid> passes grouped option bags with one update effect per group, so `theme`
	// needs its own — a prop flip after mount has to reach the live display.
	const corner = (canvas: HTMLCanvasElement) => {
		const gl = canvas.getContext('webgl')!;
		const px = new Uint8Array(4);
		gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px[0] + px[1] + px[2];
	};
	const { container, rerender } = await render(
		<LedGrid size={[4, 4, 4]} camera={{ autoOrbit: false }} theme="light" />
	);
	const canvas = container.querySelector('canvas')!;
	await nextFrame();
	const pale = corner(canvas);
	expect(pale).toBeGreaterThan(400); // the light theme's bone ground
	await rerender(<LedGrid size={[4, 4, 4]} camera={{ autoOrbit: false }} theme="dark" />);
	await nextFrame();
	expect(corner(canvas)).toBeLessThan(pale);
});
