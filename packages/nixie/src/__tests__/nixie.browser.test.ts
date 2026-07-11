import { expect, test } from 'vitest';

import { createNixieTube } from '../nixie';

const makeCanvas = () => {
	const canvas = document.createElement('canvas');
	canvas.width = 120;
	canvas.height = 180;
	// jsdom-less browser: give it a box so getBoundingClientRect is non-zero.
	canvas.style.width = '120px';
	canvas.style.height = '180px';
	document.body.appendChild(canvas);
	return canvas;
};

// Count pixels noticeably brighter than the dark tube background.
const litPixels = (canvas: HTMLCanvasElement): number => {
	const ctx = canvas.getContext('2d')!;
	const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 120) n++;
	return n;
};

test('createNixieTube lights a numeral and a blank tube stays dark', () => {
	const canvas = makeCanvas();
	const tube = createNixieTube(canvas, { value: 8, mesh: false, ghost: false });
	expect(tube).not.toBeNull();
	if (!tube) return;
	const lit = litPixels(canvas);
	expect(lit).toBeGreaterThan(0);

	tube.setValue(null); // all cathodes dark — only the faint glass rim/highlight remain
	expect(litPixels(canvas)).toBeLessThan(lit / 5);
	tube.dispose();
});

test('a tiny tube still lights a legible numeral (small-size render path)', () => {
	// Below ~64px the tube switches to a bold-glyph path (no mesh/stack, fatter wire).
	const canvas = document.createElement('canvas');
	canvas.width = 30;
	canvas.height = 46;
	canvas.style.width = '30px';
	canvas.style.height = '46px';
	document.body.appendChild(canvas);
	const tube = createNixieTube(canvas, { value: 8, mesh: false, ghost: false });
	if (!tube) return;
	expect(litPixels(canvas)).toBeGreaterThan(0);
	tube.dispose();
});

test('setValue and setOptions redraw live', () => {
	const canvas = makeCanvas();
	const tube = createNixieTube(canvas, { value: 1, mesh: false, ghost: false });
	if (!tube) return;
	const one = litPixels(canvas);
	tube.setValue(8); // 8 lights more of the glyph than 1
	expect(litPixels(canvas)).toBeGreaterThan(one);
	tube.setOptions({ color: '#33ccff' }); // still lit after a live colour change
	expect(litPixels(canvas)).toBeGreaterThan(0);
	expect(tube.snapshot().startsWith('data:image/png')).toBe(true);
	tube.dispose();
});
