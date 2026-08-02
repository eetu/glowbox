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
	expect(canvas.getAttribute('role')).toBeNull(); // canvas handed back without our ARIA
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

test('patching color/background null resets to the tube defaults (family contract)', () => {
	const canvas = makeCanvas();
	const tube = createNixieTube(canvas, { value: 8, mesh: false, ghost: false, color: [0, 1, 0] })!;
	const channels = () => {
		const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
		let r = 0;
		let g = 0;
		let b = 0;
		for (let i = 0; i < px.length; i += 4) {
			r += px[i];
			g += px[i + 1];
			b += px[i + 2];
		}
		return { r, g, b };
	};
	expect(channels().g).toBeGreaterThan(channels().r);
	// The declared type is `Color` — null is the runtime reset, seven-segment's
	// contract, so a themed tube can hand the colour back without knowing it.
	tube.setOptions({ color: null as never });
	expect(channels().r).toBeGreaterThan(channels().g); // warm nixie orange again
	tube.setOptions({ background: '#2244cc' });
	const tinted = channels().b;
	tube.setOptions({ background: null as never });
	expect(channels().b).toBeLessThan(tinted / 2); // near-black glass again
	tube.dispose();
});

test('survives absurdly small canvases (regression: negative glass inset threw)', () => {
	// A sub-9px box used to feed roundRect a negative radius (IndexSizeError).
	for (const [cw, cy] of [
		['1px', '1px'],
		['6px', '150px'],
		['120px', '5px']
	]) {
		const canvas = document.createElement('canvas');
		canvas.style.width = cw;
		canvas.style.height = cy;
		document.body.appendChild(canvas);
		const tube = createNixieTube(canvas, { value: 8 });
		expect(tube).not.toBeNull();
		tube?.setValue(3);
		tube?.dispose();
	}
});
