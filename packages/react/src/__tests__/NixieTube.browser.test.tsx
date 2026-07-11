import type { NixieTube as NixieTubeHandle } from '@glowbox/nixie';
import { createRef } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

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

test('mounts a canvas, lights the numeral, and forwards the tube handle', async () => {
	const ref = createRef<NixieTubeHandle | null>();
	const { container } = render(
		<NixieTube ref={ref} value={8} tubeStyle="classic" mesh={false} ghost={false} />
	);
	const canvas = container.querySelector('canvas')!;
	expect(canvas).not.toBeNull();
	await nextFrame();
	expect(ref.current).not.toBeNull();
	// Give the tube a concrete box and redraw at that size, then assert it lit up.
	canvas.style.width = '84px';
	canvas.style.height = '150px';
	ref.current!.resize();
	expect(litPixels(canvas)).toBeGreaterThan(0);
	expect(ref.current!.snapshot().startsWith('data:image/png')).toBe(true);
});
